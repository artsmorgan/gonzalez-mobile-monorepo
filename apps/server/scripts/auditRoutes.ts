/**
 * Genera el inventario de rutas de la API (issue #181): `npx tsx scripts/auditRoutes.ts > ../../docs/auditoria-backend-2026-10-inventario.md`
 * (desde `apps/server`). Es un análisis estático de `app/api/**\/route.ts`; ver las advertencias de `utils/routeAudit.ts`.
 */
import fs from "node:fs";
import path from "node:path";
import { analyzeRoute, verifiesCaller, type RouteFacts } from "../utils/routeAudit";

const apiRoot = path.resolve(__dirname, "..", "app", "api");

function walk(dir: string, out: string[] = []): string[] {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, out);
        else if (e.name === "route.ts") out.push(p);
    }
    return out;
}

export function collectRouteFacts(): RouteFacts[] {
    return walk(apiRoot)
        .map((f) => analyzeRoute(path.relative(path.resolve(__dirname, ".."), f), fs.readFileSync(f, "utf8")))
        .sort((a, b) => a.endpoint.localeCompare(b.endpoint));
}

function authLabel(f: RouteFacts): string {
    if (f.auth.length) return f.auth.join(" + ");
    if (f.delegatedAuth) return "delegada (API dinámica)";
    return "**ninguna**";
}

if (require.main === module) {
    const facts = collectRouteFacts();
    const lines: string[] = [];
    lines.push("# Inventario de rutas de la API (generado)");
    lines.push("");
    lines.push("Generado con `scripts/auditRoutes.ts` (análisis estático, ver `utils/routeAudit.ts`). **No lo edites a mano**: vuelve a generarlo.");
    lines.push("«Alcance» = la ruta llama a un control de pertenencia del objeto (`authorizeSelfOrAdmin`, `authorizeMarcaAccess`, `authorizeReportesOperation`, `isSuperAdminEmpleado`).");
    lines.push("");
    lines.push(`Total: ${facts.length} rutas; con verificación de sesión: ${facts.filter(verifiesCaller).length}; con control de alcance: ${facts.filter((f) => f.objectScope).length}.`);
    lines.push("");
    lines.push("| Endpoint | Métodos | Autenticación | IDs de objeto (ruta / query / cuerpo) | BD directa | Identidad | Alcance |");
    lines.push("|---|---|---|---|---|---|---|");
    for (const f of facts) {
        const ids = [f.pathIds.join(", "), f.queryIds.join(", "), f.bodyIds.join(", ")].map((s) => s || "—").join(" / ");
        lines.push(`| \`${f.endpoint}\` | ${f.methods.join(", ") || "—"} | ${authLabel(f)} | ${ids} | ${f.directDb ? "sí" : "no"} | ${f.usesIdentity ? "sí" : "no"} | ${f.objectScope ? "sí" : "no"} |`);
    }
    process.stdout.write(lines.join("\n") + "\n");
}
