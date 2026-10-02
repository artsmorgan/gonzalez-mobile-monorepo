import type { ReportDataAccess } from "./reportDynamicPrisma";
import { runMobileReportJob } from "./runMobileReportJob";
import {
    claimNextReportJob,
    handleReportJobResult,
    touchReportJobLock,
} from "./reportJobQueue";

const HEARTBEAT_MS = Number(process.env.REPORT_WORKER_HEARTBEAT_MS) || 30 * 1000;

/** Ejecuta un job ya reclamado (misma lógica que el worker en background). */
export async function executeReportJob(
    reportDb: ReportDataAccess,
    workerId: string,
    reportId: number,
): Promise<void> {
    const heartbeatTimer = setInterval(() => {
        void touchReportJobLock(reportDb, reportId, workerId).catch(() => {
            /* otro worker o job ya finalizado */
        });
    }, HEARTBEAT_MS);

    try {
        await runMobileReportJob(reportDb, reportId);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Error desconocido";
        try {
            await reportDb.e_reportes_mobile.update({
                where: { id: reportId },
                data: {
                    estado: "error",
                    error_message: message,
                },
            });
        } catch {
            /* ignore */
        }
    } finally {
        clearInterval(heartbeatTimer);
    }

    await handleReportJobResult(reportDb, reportId);
}

/** Procesa todos los jobs en `pendiente` (FIFO) hasta vaciar la cola. */
export async function drainPendingReportJobs(reportDb: ReportDataAccess, workerId: string): Promise<number> {
    let processed = 0;
    for (;;) {
        const reportId = await claimNextReportJob(reportDb, workerId);
        if (reportId == null) break;
        await executeReportJob(reportDb, workerId, reportId);
        processed++;
    }
    return processed;
}
