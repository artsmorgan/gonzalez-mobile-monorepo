import dotenv from "dotenv";

dotenv.config();

import { createWorkerReportDb, resolveReportServiceBaseUrl } from "../utils/reportDynamicPrisma";
import {
    claimNextReportJob,
    reclaimStuckReportJobs,
} from "../utils/reportJobQueue";
import { executeReportJob } from "../utils/runReportJobCycle";
import {
    getReportWorkerIdlePollMs,
    readReportWorkerActivityAt,
    waitUntilPollOrWake,
} from "../utils/reportWorkerSchedule";

const reportDb = createWorkerReportDb();

const WORKER_ID =
    process.env.REPORT_WORKER_ID?.trim() || `report-worker-${process.pid}-${Date.now()}`;
const IDLE_POLL_MS = getReportWorkerIdlePollMs();

async function runPollCycle(): Promise<number | null> {
    try {
        const reclaimed = await reclaimStuckReportJobs(reportDb);
        if (reclaimed > 0) {
            console.log(`[${WORKER_ID}] Reclaimed ${reclaimed} stuck job(s)`);
        }
    } catch (error) {
        console.warn(`[${WORKER_ID}] Reclaim pass failed:`, error);
    }

    try {
        return await claimNextReportJob(reportDb, WORKER_ID);
    } catch (error) {
        console.warn(`[${WORKER_ID}] Could not claim next job:`, error);
        return null;
    }
}

async function workerLoop(): Promise<void> {
    console.log(
        `[${WORKER_ID}] Report worker started (idlePoll=${IDLE_POLL_MS}ms, SERVER_URL=${resolveReportServiceBaseUrl()})`,
    );

    let wakeSinceMs = readReportWorkerActivityAt();
    let pollDueAt = Date.now();

    while (true) {
        const now = Date.now();

        if (now >= pollDueAt) {
            const reportId = await runPollCycle();

            if (reportId != null) {
                console.log(`[${WORKER_ID}] Processing report job #${reportId}`);
                await executeReportJob(reportDb, WORKER_ID, reportId);
                const row = await reportDb.e_reportes_mobile.findUnique({
                    where: { id: reportId },
                    select: { estado: true, attemps: true, error_message: true },
                });
                console.log(
                    `[${WORKER_ID}] Report job #${reportId} finished → estado=${row?.estado ?? "?"} attemps=${row?.attemps ?? 0}`,
                );
            }

            wakeSinceMs = readReportWorkerActivityAt();
            pollDueAt = Date.now() + IDLE_POLL_MS;
            continue;
        }

        const wakeResult = await waitUntilPollOrWake(pollDueAt, wakeSinceMs);
        if (wakeResult === "wake") {
            wakeSinceMs = readReportWorkerActivityAt();
            pollDueAt = Date.now();
        }
    }
}

workerLoop().catch((error) => {
    console.error(`[${WORKER_ID}] Fatal worker error:`, error);
    process.exit(1);
});

process.on("SIGINT", () => {
    console.log(`[${WORKER_ID}] SIGINT — shutting down`);
    process.exit(0);
});

process.on("SIGTERM", () => {
    console.log(`[${WORKER_ID}] SIGTERM — shutting down`);
    process.exit(0);
});
