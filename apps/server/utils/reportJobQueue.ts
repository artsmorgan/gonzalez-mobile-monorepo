import type { PrismaClient } from "@prisma/client";

export const DEFAULT_REPORT_MAX_ATTEMPTS = Number(process.env.REPORT_JOB_MAX_ATTEMPTS) || 3;
/** Sin actualización de `locked_at` (heartbeat) durante este tiempo → job huérfano. */
export const REPORT_STUCK_MINUTES = Number(process.env.REPORT_JOB_STUCK_MINUTES) || 3;

export type ReportJobRow = {
    id: number;
    attemps: number | null;
    max_attempts: number | null;
    estado: string;
    error_message: string | null;
};

/** Renueva el lock mientras el worker sigue procesando (evita reclaim de jobs activos largos). */
export async function touchReportJobLock(
    prisma: PrismaClient,
    reportId: number,
    workerId: string,
): Promise<void> {
    await prisma.e_reportes_mobile.updateMany({
        where: { id: reportId, estado: "procesando", locked_by: workerId },
        data: { locked_at: new Date() },
    });
}

/** Reclama el job más antiguo en `pendiente` (update optimista si hay carrera entre workers). */
export async function claimNextReportJob(
    prisma: PrismaClient,
    workerId: string,
): Promise<number | null> {
    for (let i = 0; i < 5; i++) {
        const candidate = await prisma.e_reportes_mobile.findFirst({
            where: { estado: "pendiente" },
            orderBy: { created_at: "asc" },
            select: { id: true },
        });
        if (!candidate) return null;

        const now = new Date();
        const updated = await prisma.e_reportes_mobile.updateMany({
            where: { id: candidate.id, estado: "pendiente" },
            data: {
                estado: "procesando",
                locked_at: now,
                locked_by: workerId,
                started_at: now,
                progress: 0,
            },
        });

        if (updated.count === 1) return candidate.id;
    }

    return null;
}

/**
 * Reclama el siguiente job pendiente; si la cola está vacía, intenta recuperar huérfanos en
 * `procesando` (worker caído / estado no finalizado) y vuelve a intentar una vez.
 */
export async function claimNextReportJobWithReclaim(
    prisma: PrismaClient,
    workerId: string,
): Promise<number | null> {
    const claimed = await claimNextReportJob(prisma, workerId);
    if (claimed != null) return claimed;

    const reclaimed = await reclaimStuckReportJobs(prisma);
    if (reclaimed > 0) {
        return claimNextReportJob(prisma, workerId);
    }
    return null;
}

/** Jobs en `procesando` sin heartbeat → reencolar o marcar error definitivo. */
export async function reclaimStuckReportJobs(prisma: PrismaClient): Promise<number> {
    const cutoff = new Date(Date.now() - REPORT_STUCK_MINUTES * 60 * 1000);
    const stuck = await prisma.e_reportes_mobile.findMany({
        where: {
            estado: "procesando",
            locked_at: { lt: cutoff },
        },
        select: {
            id: true,
            attemps: true,
            max_attempts: true,
        },
    });

    let reclaimed = 0;
    for (const row of stuck) {
        await requeueOrFailJob(prisma, row.id, "Tiempo de espera agotado al generar el reporte", row);
        reclaimed++;
    }
    return reclaimed;
}

export async function requeueOrFailJob(
    prisma: PrismaClient,
    reportId: number,
    message: string,
    rowHint?: Pick<ReportJobRow, "attemps" | "max_attempts">,
): Promise<void> {
    const row =
        rowHint ??
        (await prisma.e_reportes_mobile.findUnique({
            where: { id: reportId },
            select: { attemps: true, max_attempts: true },
        }));

    const nextAttempts = (row?.attemps ?? 0) + 1;
    const maxAttempts = row?.max_attempts ?? DEFAULT_REPORT_MAX_ATTEMPTS;

    if (nextAttempts < maxAttempts) {
        await prisma.e_reportes_mobile.update({
            where: { id: reportId },
            data: {
                estado: "pendiente",
                attemps: nextAttempts,
                error_message: message,
                locked_at: null,
                locked_by: null,
                progress: null,
            },
        });
        return;
    }

    await prisma.e_reportes_mobile.update({
        where: { id: reportId },
        data: {
            estado: "error",
            attemps: nextAttempts,
            error_message: message,
            finished_at: new Date(),
            locked_at: null,
            locked_by: null,
        },
    });
}

/** Tras `runMobileReportJob`: finaliza éxito o reencola según estado en BD. */
export async function handleReportJobResult(prisma: PrismaClient, reportId: number): Promise<void> {
    const row = await prisma.e_reportes_mobile.findUnique({
        where: { id: reportId },
        select: {
            id: true,
            estado: true,
            attemps: true,
            max_attempts: true,
            error_message: true,
        },
    });
    if (!row) return;

    const estado = String(row.estado || "").toLowerCase();

    if (estado === "completado") {
        await prisma.e_reportes_mobile.update({
            where: { id: reportId },
            data: {
                finished_at: new Date(),
                locked_at: null,
                locked_by: null,
                progress: 100,
                error_message: null,
            },
        });
        return;
    }

    if (estado === "error") {
        await requeueOrFailJob(
            prisma,
            reportId,
            row.error_message || "Error al generar el reporte",
            row,
        );
        return;
    }

    if (estado === "procesando") {
        await requeueOrFailJob(
            prisma,
            reportId,
            "El proceso del reporte terminó sin registrar el estado final",
            row,
        );
    }
}
