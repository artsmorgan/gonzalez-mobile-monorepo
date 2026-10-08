import type { ReportDataAccess } from "../reportDynamicPrisma";
import { verifyGuardifyApiKey } from "./auth";
import { ParamError, ReportUnavailableError, ScopeUnsupportedError, UnsupportedFilterError } from "./errors";
import { loadRowsCached } from "./handler";
import { applyListing, ListingError } from "./listing";
import { parseReportParams } from "./params";
import { matchesScope, type Hierarchy } from "./scope";
import type { GuardifyReportModule } from "./types";

/**
 * Formularios por registro (`docs/protocolo-formularios.md` de Guardify): la app entrega cada registro ESTRUCTURADO (valores, listas,
 * firmas) y Guardify lo dibuja con la definición del formulario. Aquí no se arma ningún documento.
 */
export type FormRecord = {
    id: number;
    /** Tipo cuando el formato cambia según un campo (p. ej. Bicicleta, Motocicleta, Vehículo). */
    variante: string | null;
    /** Fecha y hora de registro, `YYYY-MM-DDTHH:mm:ss` (hora de pared, como las demás fechas). */
    creado: string | null;
    /** Dónde ocurrió, como texto («código - nombre»). */
    estructura: { empresa: string | null; cliente: string | null; division: string | null; contrato: string | null; sucursal: string | null; puesto: string | null };
    /** clave → texto o número de cada campo del formulario. */
    valores: Record<string, string | number | null>;
    /** nombre → filas (lista de chequeo, movimientos, participantes…). */
    listas: Record<string, Record<string, string | number | null>[]>;
    /** clave → imagen de la firma (data URL). Solo viene con `firmas=1`; si no, `null`. */
    firmas: Record<string, string | null>;
    /** Claves de las firmas que el registro SÍ tiene (se informa aunque no se pidan las imágenes). */
    firmasPresentes: string[];
    /** Ubicación por ids para aplicar el alcance; no sale en la respuesta. */
    hier: Hierarchy;
};

export type GuardifyFormModule = {
    /** Trae los registros con sus datos completos. `firmas` = incluir las imágenes de las firmas. */
    loadRecords: (db: ReportDataAccess, ids: number[], opts: { firmas: boolean }) => Promise<FormRecord[]>;
};

/** Máximo de registros por llamada (cada uno puede traer firmas en imagen). */
export const FORMS_PER_CALL = 50;
/** Máximo de ids que se listan de una vez. */
export const FORMS_MAX_IDS = 5000;

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

export type FormsDeps = { registry: Record<string, GuardifyReportModule>; getDb: () => any; env?: Record<string, string | undefined> };

/**
 *   GET …/{modulo}/forms/ids?from&to&<filtros>&scope   → { ids, total }   (los mismos filtros que la tabla, sin paginar)
 *   GET …/{modulo}/forms?ids=1,2,3&firmas=1&scope       → { records }       (hasta 50; lo que quede fuera del alcance se omite)
 */
export async function handleGuardifyForms(req: Request, modulo: string, kind: "ids" | "records", deps: FormsDeps): Promise<Response> {
    const started = Date.now();
    const auth = verifyGuardifyApiKey(req.headers, deps.env);
    if (!auth.ok) return json({ error: auth.error, message: auth.message }, auth.status);
    const mod = deps.registry[modulo];
    if (!mod) return json({ error: "report_not_found", message: `No existe el reporte «${modulo}».` }, 404);
    if (!mod.form) return json({ error: "form_unavailable", message: "Este reporte todavía no se puede exportar como formulario." }, 501);
    const log = (status: number, extra: Record<string, unknown> = {}) =>
        console.log(JSON.stringify({ level: "info", msg: "guardify_form", modulo, kind, status, ms: Date.now() - started, user: auth.user, ...extra }));
    try {
        const sp = new URL(req.url).searchParams;
        if (kind === "ids") {
            const p = parseReportParams(sp);
            if (p.scope !== null && !mod.supportsScope) throw new ScopeUnsupportedError();
            const all = await loadRowsCached(mod, p, deps);
            // Mismos filtros y búsqueda que la tabla; sin paginar.
            const { rows } = applyListing(all, { q: p.q, searchKeys: mod.searchKeys, filters: p.filters, sort: p.sort, dir: p.dir, defaultSort: mod.defaultSort, page: 1, pageSize: Number.MAX_SAFE_INTEGER });
            const ids = rows.map((r) => Number(r.id)).filter((n) => Number.isFinite(n));
            log(200, { total: ids.length });
            return json({ ids: ids.slice(0, FORMS_MAX_IDS), total: ids.length });
        }
        const ids = [...new Set((sp.get("ids") ?? "").split(",").map((x) => Number(x.trim())).filter((n) => Number.isInteger(n) && n > 0))];
        if (!ids.length) throw new ParamError("ids es obligatorio (números separados por coma).");
        if (ids.length > FORMS_PER_CALL) throw new ParamError(`Máximo ${FORMS_PER_CALL} registros por llamada.`);
        const scopeRaw = sp.get("scope");
        const scope = scopeRaw === null ? null : (await import("./scope")).parseScope(scopeRaw);
        if (scope !== null && !mod.supportsScope) throw new ScopeUnsupportedError();
        const firmas = sp.get("firmas") === "1";
        const found = await mod.form.loadRecords(deps.getDb(), ids, { firmas });
        // El alcance se aplica también aquí: un id suelto no da acceso a lo que la persona no puede ver.
        const kept = found.filter((r) => !scope || matchesScope(r.hier, scope));
        log(200, { pedidos: ids.length, entregados: kept.length, firmas });
        return json({ records: kept.map(({ hier: _h, ...r }) => r) });
    } catch (e) {
        if (e instanceof UnsupportedFilterError) return json({ error: "unsupported_filter", message: e.message }, 400);
        if (e instanceof ParamError || e instanceof ListingError) return json({ error: "bad_request", message: e.message }, 400);
        if (e instanceof ScopeUnsupportedError) return json({ error: "scope_unsupported", message: e.message }, 403);
        if (e instanceof ReportUnavailableError) return json({ error: "report_unavailable", message: e.message }, 501);
        console.error(JSON.stringify({ level: "error", msg: "guardify_form_failed", modulo, kind, error: String(e).slice(0, 300) }));
        return json({ error: "internal", message: "No se pudo armar el formulario.", detail: String(e).slice(0, 300) }, 500);
    }
}
