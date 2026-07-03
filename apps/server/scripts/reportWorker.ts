import dotenv from "dotenv";

dotenv.config();

import { prisma } from "../utils/prismaClient";
import { runMobileReportJob } from "../utils/runMobileReportJob";
import {
    claimNextReportJobWithReclaim,
    handleReportJobResult,
    reclaimStuckReportJobs,
    touchReportJobLock,
} from "../utils/reportJobQueue";

const WORKER_ID =
    process.env.REPORT_WORKER_ID?.trim() || `report-worker-${process.pid}-${Date.now()}`;
const POLL_MS = Number(process.env.REPORT_WORKER_POLL_MS) || 1000;
const RECLAIM_EVERY_MS = Number(process.env.REPORT_WORKER_RECLAIM_MS) || 60 * 1000;
const HEARTBEAT_MS = Number(process.env.REPORT_WORKER_HEARTBEAT_MS) || 30 * 1000;

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processReportJob(reportId: number): Promise<void> {
    console.log(`[${WORKER_ID}] Processing report job #${reportId}`);

    const heartbeatTimer = setInterval(() => {
        void touchReportJobLock(prisma, reportId, WORKER_ID).catch((err) => {
            console.warn(`[${WORKER_ID}] Heartbeat failed for #${reportId}:`, err);
        });
    }, HEARTBEAT_MS);

    try {
        await runMobileReportJob(prisma, reportId);
    } catch (error) {
        console.error(`[${WORKER_ID}] Report job #${reportId} threw:`, error);
        const message = error instanceof Error ? error.message : "Error desconocido";
        await prisma.e_reportes_mobile.update({
            where: { id: reportId },
            data: {
                estado: "error",
                error_message: message,
            },
        });
    } finally {
        clearInterval(heartbeatTimer);
    }

    await handleReportJobResult(prisma, reportId);
    const row = await prisma.e_reportes_mobile.findUnique({
        where: { id: reportId },
        select: { estado: true, attemps: true, error_message: true },
    });
    console.log(
        `[${WORKER_ID}] Report job #${reportId} finished → estado=${row?.estado ?? "?"} attemps=${row?.attemps ?? 0}`,
    );
}

async function workerLoop(): Promise<void> {
    await prisma.$connect();
    const reclaimedOnStart = await reclaimStuckReportJobs(prisma);
    if (reclaimedOnStart > 0) {
        console.log(`[${WORKER_ID}] Reclaimed ${reclaimedOnStart} stuck job(s) on startup`);
    }

    console.log(
        `[${WORKER_ID}] Report worker started (poll=${POLL_MS}ms, heartbeat=${HEARTBEAT_MS}ms, reclaimEvery=${RECLAIM_EVERY_MS}ms)`,
    );

    let lastReclaim = Date.now();

    while (true) {
        const now = Date.now();
        if (now - lastReclaim >= RECLAIM_EVERY_MS) {
            const reclaimed = await reclaimStuckReportJobs(prisma);
            if (reclaimed > 0) {
                console.log(`[${WORKER_ID}] Reclaimed ${reclaimed} stuck job(s)`);
            }
            lastReclaim = now;
        }

        const reportId = await claimNextReportJobWithReclaim(prisma, WORKER_ID);
        if (reportId != null) {
            await processReportJob(reportId);
            continue;
        }

        await sleep(POLL_MS);
    }
}

workerLoop().catch(async (error) => {
    console.error(`[${WORKER_ID}] Fatal worker error:`, error);
    try {
        await prisma.$disconnect();
    } catch {
        /* ignore */
    }
    process.exit(1);
});

process.on("SIGINT", () => {
    console.log(`[${WORKER_ID}] SIGINT — shutting down`);
    void prisma.$disconnect().finally(() => process.exit(0));
});

process.on("SIGTERM", () => {
    console.log(`[${WORKER_ID}] SIGTERM — shutting down`);
    void prisma.$disconnect().finally(() => process.exit(0));
});
