import { verifyGuardifyApiKey, MIN_API_KEY_LENGTH } from "../guardifyReports/auth";
import { verifyActorHeaders, resolveActorEmployee, type ActorEmployee, type GuardifyActor } from "./actor";
import type { ActionEnv, ActionErrorCode, ActionHttp } from "./env";
import { accionesDeMutuo, rechazarMutuoAcuerdo } from "./mutuos";
import { accionesDePermiso, rechazarPermisoSolicitud } from "./permisos";

/**
 * API de acciones para Guardify (`docs/protocolo-acciones.md` de Guardify). Solo servidor a servidor: llave compartida + identidad del actor
 * firmada. Guardify decide quién PUEDE pedir cada acción; la app decide si PROCEDE (estado, alcance del actor sobre este registro, reglas).
 *   GET  /api/guardify/actions/{tipo}/{id}            → { id, estado, campos, adjuntos, firmas, acciones, historial }
 *   POST /api/guardify/actions/{tipo}/{id}/{accion}   → { estado, ref?, message? }
 * Hoy: `permisos` y `mutuos-acuerdos`, acción `rechazar`. `aprobar` NO existe aún: crea el permiso / el cambio de guardia en Planillas con el
 * token de Planillas del propio ejecutivo y Guardify no lo tiene (pendiente de Planillas).
 */
export type ActionTypeImpl = {
    table: string;
    /** Estado normalizado del registro. */
    estado: (existing: any) => string;
    /** Acciones que ESTE actor puede ejecutar ahora. */
    acciones: (existing: any, actor: ActorEmployee) => string[];
    ejecutar: Record<string, (env: ActionEnv, a: { id: number; actor: ActorEmployee; claims: GuardifyActor; motivo: string | null; extraCambios: { prop: string; before: unknown; after: unknown }[] }) => Promise<ActionHttp>>;
};

const estadoDe = (e: any, vacio = "") => String(e?.estado || "").trim().toLowerCase() || vacio;

export const ACTION_TYPES: Record<string, ActionTypeImpl> = {
    permisos: {
        table: "c_solicitud_permiso",
        estado: (e) => estadoDe(e),
        acciones: (e, a) => accionesDePermiso(e, a.id, a.supervisorId),
        ejecutar: {
            rechazar: (env, a) => rechazarPermisoSolicitud(env, { id: a.id, actorId: a.actor.id, payload: { id: a.actor.id }, body: {}, extraCambios: a.extraCambios }),
        },
    },
    "mutuos-acuerdos": {
        table: "e_mutuos_acuerdos",
        estado: (e) => estadoDe(e, "pendiente"),
        acciones: (e, a) => accionesDeMutuo(e, a.supervisorId),
        ejecutar: {
            rechazar: (env, a) => rechazarMutuoAcuerdo(env, { id: a.id, actorId: a.actor.id, horaAccion: null, extraCambios: a.extraCambios }),
        },
    },
};

const HTTP: Record<ActionErrorCode, number> = { not_found: 404, already_resolved: 409, invalid_state: 409, conflict: 409, out_of_scope: 403, reason_required: 400, signature_required: 400, invalid_request: 400 };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const err = (code: ActionErrorCode, message: string, status = HTTP[code]) => json({ code, message }, status);

export type ActionDeps = { getEnv: () => ActionEnv; env?: Record<string, string | undefined>; now?: () => number };

type Ctx = { tipo: ActionTypeImpl; id: number; actor: ActorEmployee; claims: GuardifyActor; env: ActionEnv };

/** Llave, actor firmado, actor resuelto a una persona de la app y registro: lo común a las dos rutas. */
async function prepare(req: Request, tipoId: string, idStr: string, deps: ActionDeps): Promise<{ ok: true; c: Ctx; existing: any } | { ok: false; res: Response }> {
    const envVars = deps.env ?? process.env;
    const auth = verifyGuardifyApiKey(req.headers, envVars);
    if (!auth.ok) return { ok: false, res: json({ error: auth.error, message: auth.message }, auth.status) };
    const claims = verifyActorHeaders(req.headers, (envVars.GUARDIFY_REPORTS_API_KEY ?? "").trim(), (deps.now ?? Date.now)());
    if (!claims || (envVars.GUARDIFY_REPORTS_API_KEY ?? "").trim().length < MIN_API_KEY_LENGTH) return { ok: false, res: json({ error: "unauthorized", message: "Identidad del actor inválida o vencida." }, 401) };
    const tipo = ACTION_TYPES[tipoId];
    if (!tipo) return { ok: false, res: err("invalid_request", `No existe el tipo «${tipoId}».`, 404) };
    const id = Number(idStr);
    if (!Number.isInteger(id) || id <= 0) return { ok: false, res: err("invalid_request", "Id inválido.") };
    const env = deps.getEnv();
    const actor = await resolveActorEmployee(env.prisma, claims.actor);
    if (!actor) return { ok: false, res: err("out_of_scope", "No se pudo identificar a esta persona en la app.") };
    const existing = await env.call({ action: "GET", table: tipo.table, operation: "findUnique", where: { id } });
    if (!existing) return { ok: false, res: err("not_found", "Registro no encontrado") };
    return { ok: true, c: { tipo, id, actor, claims: claims.actor, env }, existing };
}

const iso = (d: unknown): string | null => { const t = d ? new Date(d as string) : null; return t && !isNaN(t.getTime()) ? t.toISOString() : null; };

/** Cambios del registro (quién, cuándo, qué) desde `c_cambios_apps_modules`, los más recientes primero. */
async function historial(env: ActionEnv, table: string, id: number) {
    const rows: any[] = (await env.call({ action: "GET", table: "c_cambios_apps_modules", operation: "findMany", where: { nombre_tabla: table, registro_id: id }, orderBy: { id: "desc" }, take: 20 })) ?? [];
    const ids = [...new Set(rows.map((r) => Number(r.created_by)).filter((n) => n > 0))];
    const people: any[] = ids.length ? await env.prisma.c_empleado.findMany({ where: { id: { in: ids } }, select: { id: true, nombre: true, primer_apellido: true, segundo_apellido: true } }) : [];
    const nombre = new Map(people.map((p) => [Number(p.id), `${p.nombre ?? ""} ${p.primer_apellido ?? ""} ${p.segundo_apellido ?? ""}`.trim() || null]));
    return rows.map((r) => {
        let cambios: any[] = [];
        try { cambios = JSON.parse(String(r.cambios ?? "[]")); } catch { /* texto libre */ }
        const est = cambios.find((c) => c?.prop === "estado");
        const motivo = cambios.find((c) => c?.prop === "motivo_rechazo")?.after ?? null;
        return { accion: est ? `Estado: ${est.before ?? "-"} → ${est.after ?? "-"}` : "Cambio", por: nombre.get(Number(r.created_by)) ?? null, en: iso(r.created_at), motivo: motivo ? String(motivo) : null };
    });
}

export async function handleActionDetail(req: Request, tipoId: string, idStr: string, deps: ActionDeps): Promise<Response> {
    try {
        const p = await prepare(req, tipoId, idStr, deps);
        if (!p.ok) return p.res;
        const { c, existing } = p;
        // Los campos, adjuntos y firmas los dibuja Guardify con el formulario del registro (`/api/guardify/reports/{modulo}/forms`).
        return json({ id: c.id, estado: c.tipo.estado(existing) || "pendiente", campos: [], adjuntos: [], firmas: [], acciones: c.tipo.acciones(existing, c.actor), historial: await historial(c.env, c.tipo.table, c.id) });
    } catch (e) {
        console.error(JSON.stringify({ level: "error", msg: "guardify_action_detail_failed", tipo: tipoId, error: String(e) }));
        return json({ code: "invalid_request", message: "No se pudo consultar el registro." }, 500);
    }
}

export async function handleActionExecute(req: Request, tipoId: string, idStr: string, accion: string, deps: ActionDeps): Promise<Response> {
    const started = Date.now();
    try {
        const p = await prepare(req, tipoId, idStr, deps);
        if (!p.ok) return p.res;
        const { c, existing } = p;
        const run = c.tipo.ejecutar[accion];
        if (!run) return err("invalid_request", `La acción «${accion}» no está disponible para este tipo.`, 404);
        const body: any = await req.json().catch(() => ({}));
        const idem = String(req.headers.get("idempotency-key") ?? body?.idempotencyKey ?? "").trim();
        if (idem.length < 16) return err("invalid_request", "Falta la clave de idempotencia.");
        const motivo = typeof body?.reason === "string" && body.reason.trim() ? body.reason.trim().slice(0, 500) : null;

        const estado = c.tipo.estado(existing) || "pendiente";
        // Idempotencia por estado: si el MISMO actor ya llevó el registro a ese resultado, el reintento devuelve el mismo resultado sin repetir el efecto.
        if (accion === "rechazar" && estado === "rechazado") {
            const ultimo: any[] = (await c.env.call({ action: "GET", table: "c_cambios_apps_modules", operation: "findMany", where: { nombre_tabla: c.tipo.table, registro_id: c.id }, orderBy: { id: "desc" }, take: 1 })) ?? [];
            if (Number(ultimo[0]?.created_by) === c.actor.id) return json({ estado: "rechazado", ref: null, message: "Ya estaba rechazado por esta persona." });
        }
        if (!c.tipo.acciones(existing, c.actor).includes(accion)) {
            // Distingue el motivo para que Guardify lo explique: ya resuelto / sin alcance / otro estado.
            if (estado !== "pendiente") return err(estado === "rechazado" || estado === "aprobado" ? "already_resolved" : "invalid_state", "El registro ya no está pendiente.");
            return err("out_of_scope", "No tienes alcance para esta acción sobre este registro.");
        }
        const res = await run(c.env, {
            id: c.id, actor: c.actor, claims: c.claims, motivo,
            extraCambios: [...(motivo ? [{ prop: "motivo_rechazo", before: null, after: motivo }] : []), { prop: "origen", before: null, after: `Guardify (${c.claims.email})` }],
        });
        console.log(JSON.stringify({ level: "info", msg: "guardify_action", tipo: tipoId, accion, status: res.status, ok: res.ok, ms: Date.now() - started, actor: c.actor.id }));
        if (!res.ok) return err(res.code, res.message);
        return json({ estado: "rechazado", ref: null, message: res.body.message ?? null });
    } catch (e) {
        console.error(JSON.stringify({ level: "error", msg: "guardify_action_failed", tipo: tipoId, accion, error: String(e) }));
        return json({ code: "invalid_request", message: "La app no pudo completar la acción." }, 500);
    }
}
