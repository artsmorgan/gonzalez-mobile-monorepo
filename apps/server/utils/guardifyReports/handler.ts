import { verifyGuardifyApiKey } from "./auth";
import { ParamError, ScopeUnsupportedError } from "./errors";
import { applyListing, distinctValues, ListingError, type OutRow } from "./listing";
import { parseReportParams } from "./params";
import type { GuardifyReportModule } from "./types";

export type HandlerDeps = {
    registry: Record<string, GuardifyReportModule>;
    getDb: () => any;
    env?: Record<string, string | undefined>;
    /** Reloj inyectable (pruebas). */
    now?: () => number;
};

// Cada página, cada orden y cada página de una exportación vuelven a pedir el mismo conjunto de filas: se reutiliza unos
// segundos para no repetir una consulta de hasta 50 000 filas a la base. Pocas entradas y vida corta (memoria y datos frescos).
const CACHE_TTL_MS = 30_000;
const CACHE_MAX = 4;
const cache = new Map<string, { at: number; rows: OutRow[] }>();
export const clearGuardifyReportCache = () => cache.clear();

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

/**
 * API de reportes para Guardify (solo lectura, de servidor a servidor).
 *   GET /api/guardify/reports/{modulo}?from&to&page&pageSize&sort&dir&q&f.<col>=…&scope=nivel:id,…  → { rows, total }
 *   GET /api/guardify/reports/{modulo}/options?dimension=<col>&from&to&scope=…                      → { values }
 */
export async function handleGuardifyReport(req: Request, modulo: string, kind: "rows" | "options", deps: HandlerDeps): Promise<Response> {
    const started = Date.now();
    const log = (status: number, extra: Record<string, unknown> = {}, user: string | null = null) =>
        console.log(JSON.stringify({ level: "info", msg: "guardify_report", modulo, kind, status, ms: Date.now() - started, user, ...extra }));

    const auth = verifyGuardifyApiKey(req.headers, deps.env);
    if (!auth.ok) {
        log(auth.status);
        return json({ error: auth.error, message: auth.message }, auth.status);
    }
    const mod = deps.registry[modulo];
    if (!mod) {
        log(404, {}, auth.user);
        return json({ error: "report_not_found", message: `No existe el reporte «${modulo}».` }, 404);
    }
    try {
        const sp = new URL(req.url).searchParams;
        const p = parseReportParams(sp);
        const dimension = sp.get("dimension") ?? "";
        if (kind === "options" && !mod.filterKeys.includes(dimension)) throw new ParamError(`«${dimension}» no es una dimensión de filtro de este reporte.`);
        if (p.scope !== null && !mod.supportsScope) throw new ScopeUnsupportedError();

        const now = (deps.now ?? Date.now)();
        const ck = JSON.stringify([modulo, p.from, p.to, p.scope]);
        let hit = cache.get(ck);
        if (!hit || now - hit.at > CACHE_TTL_MS) {
            hit = { at: now, rows: await mod.load(deps.getDb(), p) };
            cache.delete(ck);
            cache.set(ck, hit);
            while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
        }
        const all = hit.rows;
        if (kind === "options") {
            log(200, { rows: all.length }, auth.user);
            return json({ values: distinctValues(all, dimension) });
        }
        const out = applyListing(all, { q: p.q, searchKeys: mod.searchKeys, filters: p.filters, filterKeys: mod.filterKeys, sortKeys: mod.sortKeys, sort: p.sort, dir: p.dir, defaultSort: mod.defaultSort, page: p.page, pageSize: p.pageSize });
        log(200, { rows: out.rows.length, total: out.total, scoped: p.scope !== null }, auth.user);
        return json(out);
    } catch (e) {
        if (e instanceof ParamError || e instanceof ListingError) {
            log(400, {}, auth.user);
            return json({ error: "bad_request", message: e.message }, 400);
        }
        if (e instanceof ScopeUnsupportedError) {
            log(403, {}, auth.user);
            return json({ error: "scope_unsupported", message: e.message }, 403);
        }
        console.error(JSON.stringify({ level: "error", msg: "guardify_report_failed", modulo, kind, error: String(e) }));
        return json({ error: "internal", message: "No se pudo generar el reporte.", detail: String(e).slice(0, 400) }, 500);
    }
}
