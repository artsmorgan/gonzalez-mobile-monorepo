import type { ReportDataAccess } from "./reportDynamicPrisma";

/** Un solo intento: si el reporte falla, no se reencola ni vuelve a llamar a dynamic-prisma. */
export const DEFAULT_REPORT_MAX_ATTEMPTS = Number(process.env.REPORT_JOB_MAX_ATTEMPTS) || 1;
/** Sin actualización de `locked_at` (heartbeat) durante este tiempo → job huérfano. */
export const REPORT_STUCK_MINUTES = Number(process.env.REPORT_JOB_STUCK_MINUTES) || 3;

export type ReportJobRow = {
    id: number;
    attemps: number | null;
    max_attempts: number | null;
    estado: string;
    error_message: string | null;
    finished_at?: Date | string | null;
};

export function resolveReportMaxAttempts(maxAttempts: number | null | undefined): number {
    const parsed = Number(maxAttempts);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_REPORT_MAX_ATTEMPTS;
}

export function hasExceededReportAttempts(
    attemps: number | null | undefined,
    maxAttempts: number | null | undefined,
): boolean {
    return (attemps ?? 0) >= resolveReportMaxAttempts(maxAttempts);
}

/** Marca el job como error definitivo (sin reencolar). */
export async function finalizeReportJobAsError(
    reportDb: ReportDataAccess,
    reportId: number,
    message: string,
    rowHint?: Pick<ReportJobRow, "attemps" | "error_message">,
): Promise<void> {
    const row =
        rowHint ??
        (await reportDb.e_reportes_mobile.findUnique({
            where: { id: reportId },
            select: { attemps: true, error_message: true },
        }));

    const nextAttempts = (row?.attemps ?? 0) + 1;
    const errorMessage = message || row?.error_message || "Error al generar el reporte";

    await reportDb.e_reportes_mobile.update({
        where: { id: reportId },
        data: {
            estado: "error",
            attemps: nextAttempts,
            error_message: errorMessage,
            finished_at: new Date(),
            locked_at: null,
            locked_by: null,
            progress: null,
        },
    });
}

/** Renueva el lock mientras el worker sigue procesando (evita reclaim de jobs activos largos). */
export async function touchReportJobLock(
    reportDb: ReportDataAccess,
    reportId: number,
    workerId: string,
): Promise<void> {
    try {
        await reportDb.e_reportes_mobile.update({
            where: { id: reportId, estado: "procesando", locked_by: workerId },
            data: { locked_at: new Date() },
        });
    } catch {
        /* otro worker o job ya finalizado */
    }
}

/** Reclama el job más antiguo en `pendiente` (update optimista si hay carrera entre workers). */
export async function claimNextReportJob(
    reportDb: ReportDataAccess,
    workerId: string,
): Promise<number | null> {
    for (let i = 0; i < 5; i++) {
        const candidate = await reportDb.e_reportes_mobile.findFirst({
            where: { estado: "pendiente" },
            orderBy: { created_at: "asc" },
            select: { id: true, attemps: true, max_attempts: true, error_message: true },
        });
        if (!candidate) return null;

        if (hasExceededReportAttempts(candidate.attemps, candidate.max_attempts)) {
            await finalizeReportJobAsError(
                reportDb,
                candidate.id,
                candidate.error_message || "Máximo de intentos alcanzado",
                candidate,
            );
            continue;
        }

        const now = new Date();
        try {
            await reportDb.e_reportes_mobile.update({
                where: { id: candidate.id, estado: "pendiente" },
                data: {
                    estado: "procesando",
                    locked_at: now,
                    locked_by: workerId,
                    started_at: now,
                    progress: 0,
                },
            });
            return candidate.id;
        } catch {
            continue;
        }
    }

    return null;
}

/** Reclama el siguiente job pendiente (reclaim de huérfanos: solo en el timer del worker). */
export async function claimNextReportJobWithReclaim(
    reportDb: ReportDataAccess,
    workerId: string,
): Promise<number | null> {
    return claimNextReportJob(reportDb, workerId);
}

/** Jobs en `procesando` sin heartbeat → error definitivo (sin reencolar). */
export async function reclaimStuckReportJobs(reportDb: ReportDataAccess): Promise<number> {
    const cutoff = new Date(Date.now() - REPORT_STUCK_MINUTES * 60 * 1000);
    const stuck = await reportDb.e_reportes_mobile.findMany({
        where: {
            estado: "procesando",
            locked_at: { lt: cutoff },
        },
        select: {
            id: true,
            attemps: true,
            max_attempts: true,
            error_message: true,
        },
    });

    let reclaimed = 0;
    for (const row of stuck) {
        await finalizeReportJobAsError(
            reportDb,
            row.id,
            row.error_message || "Tiempo de espera agotado al generar el reporte",
            row,
        );
        reclaimed++;
    }
    return reclaimed;
}

/** Tras `runMobileReportJob`: finaliza éxito o error definitivo según estado en BD. */
export async function handleReportJobResult(reportDb: ReportDataAccess, reportId: number): Promise<void> {
    const row = await reportDb.e_reportes_mobile.findUnique({
        where: { id: reportId },
        select: {
            id: true,
            estado: true,
            attemps: true,
            max_attempts: true,
            error_message: true,
            finished_at: true,
        },
    });
    if (!row) return;

    const estado = String(row.estado || "").toLowerCase();

    if (estado === "completado") {
        await reportDb.e_reportes_mobile.update({
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
        if (row.finished_at == null) {
            await finalizeReportJobAsError(
                reportDb,
                reportId,
                row.error_message || "Error al generar el reporte",
                row,
            );
        }
        return;
    }

    if (estado === "procesando") {
        await finalizeReportJobAsError(
            reportDb,
            reportId,
            "El proceso del reporte terminó sin registrar el estado final",
            row,
        );
    }
}
