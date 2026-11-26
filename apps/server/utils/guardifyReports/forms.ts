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
    /** Evidencia de la acción (issue #153), opcional: `contenido` es lo que se firmó, tal cual, y Guardify recalcula la huella y la compara con `firma`. */
    evidencia?: {
        dispositivo: string | null;
        latitud: number | null;
        longitud: number | null;
        firma: string;
        cedula: string | null;
        fecha: string;
        contenido: Record<string, unknown>;
    };
    /** Archivos adjuntos del registro (opcional). El contenido se baja aparte: `GET …/{modulo}/forms/{id}/attachments/{adjunto.id}`. */
    adjuntos?: FormAttachment[];
    /** Ubicación por ids para aplicar el alcance; no sale en la respuesta. */
    hier: Hierarchy;
};

/** Un adjunto como lo lista el registro: `tipo` es el MIME (null si no se reconoce) y `bytes` el tamaño si se conoce. */
export type FormAttachment = { id: string; nombre: string; tipo?: string | null; bytes?: number | null };

/**
 * Baja un archivo del almacenamiento de la app por su ruta relativa (p. ej. `permit-request/12/archivo.pdf`). La ruta de Next lo arma con
 * `fetchDynamicFile`; en las pruebas se inyecta. `null` = el archivo no existe.
 */
export type AttachmentFetcher = (relPath: string) => Promise<{ bytes: Uint8Array; contentType?: string | null } | null>;

/** Contenido de un adjunto con la ubicación de su registro (para aplicar el alcance). */
export type LoadedAttachment = { bytes: Uint8Array; contentType: string; nombre: string; hier: Hierarchy };

export type GuardifyFormModule = {
    /** Trae los registros con sus datos completos. `firmas` = incluir las imágenes de las firmas. */
    loadRecords: (db: ReportDataAccess, ids: number[], opts: { firmas: boolean }) => Promise<FormRecord[]>;
    /**
     * Opcional: un adjunto de un registro. Debe devolver `null` si el registro no existe (o no está activo) o si el adjunto no es de ESE
     * registro. `fetchFile` baja el archivo del almacenamiento de la app (lo pone la ruta).
     */
    loadAttachment?: (db: ReportDataAccess, recordId: number, attachmentId: string, fetchFile?: AttachmentFetcher) => Promise<LoadedAttachment | null>;
};

/** Tope del tamaño de un adjunto que se entrega a Guardify (25 MB). */
export const ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;

/** Máximo de registros por llamada (cada uno puede traer firmas en imagen). */
export const FORMS_PER_CALL = 50;
/** Máximo de ids que se listan de una vez. */
export const FORMS_MAX_IDS = 5000;

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

/**
 * Los cargadores piden solo las columnas que usan (`select`). Si la base real no tiene alguna (el esquema del repo y el de la base se han
 * desfasado), esa consulta falla y no habría formulario. Se reintenta UNA vez sin `select` (los cargadores igual solo leen lo suyo) y queda
 * un aviso en el log para corregir el cargador.
 */
export function lenientDb(db: any, log: (msg: string) => void = (m) => console.warn(JSON.stringify({ level: "warn", msg: "guardify_form_select_fallback", detail: m }))): any {
    const wrap = (table: string, h: any) => new Proxy(h, {
        get(target, prop, recv) {
            const fn = Reflect.get(target, prop, recv);
            if (typeof fn !== "function" || !["findMany", "findFirst", "findUnique"].includes(String(prop))) return typeof fn === "function" ? fn.bind(target) : fn;
            return async (args: any = {}) => {
                try { return await fn.call(target, args); } catch (e) {
                    if (!args?.select) throw e;
                    log(`${table}.${String(prop)} falló con select (${String(e).replace(/\s+/g, " ").slice(-160)}); se reintenta sin select`);
                    const { select: _s, ...rest } = args;
                    return fn.call(target, rest);
                }
            };
        },
    });
    return new Proxy(db, { get: (t, table) => { const h = Reflect.get(t, table); return h && typeof h === "object" ? wrap(String(table), h) : h; } });
}

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
        const found = await mod.form.loadRecords(lenientDb(deps.getDb()), ids, { firmas });
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

export type AttachmentDeps = FormsDeps & { fetchFile?: AttachmentFetcher };

/** `filename*` de RFC 5987/6266 (UTF-8, codificado). */
export function contentDispositionAttachment(nombre: string): string {
    const enc = encodeURIComponent(nombre.replace(/[\r\n"]/g, " ").trim() || "archivo").replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
    return `attachment; filename*=UTF-8''${enc}`;
}

/**
 *   GET …/{modulo}/forms/{id}/attachments/{attachmentId}?scope   → el archivo (binario)
 *
 * Misma llave que el resto. Con `scope`, el registro debe caer dentro del alcance (si no, 404, igual que si no existiera). Solo los módulos
 * cuyo formulario declara `loadAttachment`; lo demás → 404 `attachment_not_found`. Más de 25 MB → 413.
 */
export async function handleGuardifyAttachment(req: Request, modulo: string, recordId: string, attachmentId: string, deps: AttachmentDeps): Promise<Response> {
    const started = Date.now();
    const auth = verifyGuardifyApiKey(req.headers, deps.env);
    if (!auth.ok) return json({ error: auth.error, message: auth.message }, auth.status);
    const mod = deps.registry[modulo];
    if (!mod) return json({ error: "report_not_found", message: `No existe el reporte «${modulo}».` }, 404);
    const notFound = () => json({ error: "attachment_not_found", message: "No existe el adjunto." }, 404);
    const log = (status: number, extra: Record<string, unknown> = {}) =>
        console.log(JSON.stringify({ level: "info", msg: "guardify_form_attachment", modulo, status, ms: Date.now() - started, user: auth.user, ...extra }));
    try {
        const sp = new URL(req.url).searchParams;
        const scopeRaw = sp.get("scope");
        const scope = scopeRaw === null ? null : (await import("./scope")).parseScope(scopeRaw);
        if (scope !== null && !mod.supportsScope) throw new ScopeUnsupportedError();
        const id = /^\d{1,10}$/.test(recordId) ? Number(recordId) : 0;
        const aid = String(attachmentId ?? "").trim();
        if (!mod.form?.loadAttachment || !id || !/^[A-Za-z0-9_-]{1,64}$/.test(aid)) { log(404); return notFound(); }
        const file = await mod.form.loadAttachment(lenientDb(deps.getDb()), id, aid, deps.fetchFile);
        // Fuera del alcance responde igual que si no existiera: no se confirma que el registro exista.
        if (!file || (scope && !matchesScope(file.hier, scope))) { log(404, { id, adjunto: aid }); return notFound(); }
        if (file.bytes.byteLength > ATTACHMENT_MAX_BYTES) {
            log(413, { id, adjunto: aid, bytes: file.bytes.byteLength });
            return json({ error: "attachment_too_large", message: "El adjunto supera el máximo de 25 MB." }, 413);
        }
        log(200, { id, adjunto: aid, bytes: file.bytes.byteLength });
        return new Response(file.bytes as any, {
            status: 200,
            headers: {
                "content-type": file.contentType || "application/octet-stream",
                "content-disposition": contentDispositionAttachment(file.nombre),
                "content-length": String(file.bytes.byteLength),
                "cache-control": "no-store",
            },
        });
    } catch (e) {
        if (e instanceof ParamError) return json({ error: "bad_request", message: e.message }, 400);
        if (e instanceof ScopeUnsupportedError) return json({ error: "scope_unsupported", message: e.message }, 403);
        console.error(JSON.stringify({ level: "error", msg: "guardify_form_attachment_failed", modulo, error: String(e).slice(0, 300) }));
        return json({ error: "internal", message: "No se pudo entregar el adjunto.", detail: String(e).slice(0, 300) }, 500);
    }
}
