import fs from "fs";
import path from "path";

/** Intervalo entre consultas de cola cuando no hay actividad (5 min por defecto). */
export const DEFAULT_REPORT_WORKER_IDLE_POLL_MS = 5 * 60 * 1000;

const SCHEDULE_FILE = path.resolve(process.cwd(), ".report-worker-schedule.json");

export function getReportWorkerIdlePollMs(): number {
    const parsed = Number(process.env.REPORT_WORKER_IDLE_POLL_MS);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_REPORT_WORKER_IDLE_POLL_MS;
}

export function readReportWorkerActivityAt(): number {
    try {
        const raw = fs.readFileSync(SCHEDULE_FILE, "utf8");
        const parsed = JSON.parse(raw) as { at?: number };
        return Number(parsed?.at) || 0;
    } catch {
        return 0;
    }
}

/** Reinicia el conteo de inactividad del worker (p. ej. al encolar un reporte). */
export function signalReportWorkerActivity(reason = "activity"): void {
    const payload = { at: Date.now(), reason };
    fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(payload));
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Espera hasta `deadlineMs` o hasta detectar actividad posterior a `wakeSinceMs`. */
export async function waitUntilPollOrWake(
    deadlineMs: number,
    wakeSinceMs: number,
    checkMs = 1000,
): Promise<"deadline" | "wake"> {
    while (Date.now() < deadlineMs) {
        if (readReportWorkerActivityAt() > wakeSinceMs) return "wake";
        await sleep(Math.min(checkMs, Math.max(0, deadlineMs - Date.now())));
    }
    return "deadline";
}
