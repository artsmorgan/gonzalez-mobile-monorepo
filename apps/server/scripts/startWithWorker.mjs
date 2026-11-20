/**
 * Arranca Next.js y el worker de reportes en el mismo contenedor (Railway / producción).
 */
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function spawnNamed(name, command, args) {
    const child = spawn(command, args, {
        cwd: serverRoot,
        stdio: "inherit",
        shell: true,
        env: process.env,
    });

    child.on("exit", (code, signal) => {
        if (signal) {
            console.error(`[startWithWorker] ${name} terminated (${signal})`);
        } else if (code !== 0 && code != null) {
            console.error(`[startWithWorker] ${name} exited with code ${code}`);
        }
        shutdown(code ?? 1);
    });

    child.on("error", (err) => {
        console.error(`[startWithWorker] Failed to start ${name}:`, err);
        shutdown(1);
    });

    return child;
}

let webProcess = null;
let workerProcess = null;
let exiting = false;

function shutdown(exitCode = 0) {
    if (exiting) return;
    exiting = true;
    if (webProcess && !webProcess.killed) webProcess.kill("SIGTERM");
    if (workerProcess && !workerProcess.killed) workerProcess.kill("SIGTERM");
    setTimeout(() => process.exit(exitCode), 500);
}

console.log("[startWithWorker] Starting Next.js + report worker…");
webProcess = spawnNamed("next", "npx", ["next", "start"]);
workerProcess = spawnNamed("worker", "npx", ["tsx", "scripts/reportWorker.ts"]);

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
