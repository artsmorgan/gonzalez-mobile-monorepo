import { verifyGuardifyApiKey, MIN_API_KEY_LENGTH } from "../guardifyReports/auth";
import { verifyActorHeaders, resolveActorEmployee, type ActorEmployee, type GuardifyActor } from "./actor";
import type { ActionEnv, ActionErrorCode, ActionHttp } from "./env";
import { aprobarMutuoAcuerdo } from "./aprobar-mutuo";
import { cargarInventarioPuesto } from "./inventario";
import { aprobarPermisoSolicitud } from "./aprobar-permiso";
import { accionesDeMutuo, rechazarMutuoAcuerdo } from "./mutuos";
import { accionesDePermiso, rechazarPermisoSolicitud } from "./permisos";

/**
 * API de acciones para Guardify (`docs/protocolo-acciones.md` de Guardify). Solo servidor a servidor: llave compartida + identidad del actor
 * firmada. Guardify decide quién PUEDE pedir cada acción; la app decide si PROCEDE (estado, alcance del actor sobre este registro, reglas).
 *   GET  /api/guardify/actions/{tipo}/{id}            → { id, estado, campos, adjuntos, firmas, acciones, historial }
 *   POST /api/guardify/actions/{tipo}/{id}/{accion}   → { estado, ref?, message? }
 * Hoy: `permisos` y `mutuos-acuerdos`, acciones `aprobar` y `rechazar`. `aprobar` crea el permiso / el cambio de guardia en Planillas con el
 * token de Planillas que el propio ejecutivo dejó guardado al entrar en la app (`a_mobile_token_for_planillas`); si no hay uno vigente responde
 * `planillas_session_required` y la persona debe abrir MonitoreApp y escribir su contraseña de Planillas.
 *   GET  /api/guardify/actions/lookup/empleado?codigo=  → { id, nombre, codigo }   (para elegir el reemplazo de un turno)
 */
export type ActionTypeImpl = {
    table: string;
    /** Estado normalizado del registro. */
    estado: (existing: any) => string;
    /** Acciones que ESTE actor puede ejecutar ahora. */
    acciones: (existing: any, actor: ActorEmployee) => string[];
    /** Datos propios del registro que la pantalla necesita para pedir la acción (p. ej. los turnos de un permiso, para asignar su reemplazo). */
    datos?: (existing: any) => Record<string, unknown>;
    ejecutar: Record<string, { planillas?: boolean; run: (env: ActionEnv, a: RunArgs) => Promise<ActionHttp> }>;
};

export type RunArgs = {
    id: number;
    actor: ActorEmployee;
    claims: GuardifyActor;
    motivo: string | null;
    extraCambios: { prop: string; before: unknown; after: unknown }[];
    /** Cuerpo de la petición de Guardify (firmas, parámetros y fecha de la acción). */
    request: any;
    /** Token de Planillas vigente de la persona, solo para las acciones que lo necesitan. */
    planillasToken: string | null;
};

/** Imagen de la firma de un rol (`digital` / `manual`) tal como la manda Guardify. */
const firmaDe = (request: any, role: string): string => {
    const s = (Array.isArray(request?.signatures) ? request.signatures : []).find((x: any) => x?.role === role);
    return typeof s?.image === "string" ? s.image : "";
};
const horaDe = (request: any): Date | null => { const d = request?.requestedAt ? new Date(request.requestedAt) : null; return d && !isNaN(d.getTime()) ? d : null; };

const estadoDe = (e: any, vacio = "") => String(e?.estado || "").trim().toLowerCase() || vacio;

/** Los turnos de un permiso (`turnos` guarda un JSON) con una etiqueta legible y su reemplazo actual. */
export function turnosDe(existing: any): { id: number; etiqueta: string; reemplazoId: number | null; reemplazoNombre: string | null }[] {
    let rows: any[] = [];
    try { rows = JSON.parse(String(existing?.turnos || "[]")); } catch { rows = []; }
    if (!Array.isArray(rows)) return [];
    return rows.filter((t) => Number(t?.id) > 0).map((t) => ({
        id: Number(t.id),
        etiqueta: `Turno ${t.id} · ${t.puesto ?? "-"} · ${t.hora_inicio ?? "-"} a ${t.hora_fin ?? "-"} (${t.tipo_turno ?? "-"})`,
        reemplazoId: t.reemplazo_id != null ? Number(t.reemplazo_id) : null,
        reemplazoNombre: t.reemplazo_nombre ?? null,
    }));
}

export const ACTION_TYPES: Record<string, ActionTypeImpl> = {
    permisos: {
        table: "c_solicitud_permiso",
        estado: (e) => estadoDe(e),
        acciones: (e, a) => accionesDePermiso(e, a.id, a.supervisorId),
        datos: (e) => ({
            turnos: turnosDe(e),
            reemplazoObligatorio: e?.reemplazo_obligatorio ?? null,
        }),
        ejecutar: {
            rechazar: { run: (env, a) => rechazarPermisoSolicitud(env, { id: a.id, actorId: a.actor.id, payload: { id: a.actor.id }, body: {}, extraCambios: a.extraCambios }) },
            aprobar: {
                planillas: true,
                run: (env, a) => {
                    const p = a.request?.params ?? {};
                    return aprobarPermisoSolicitud(env, {
                        id: a.id, actorId: a.actor.id, payload: { id: a.actor.id }, planillasToken: a.planillasToken, extraCambios: a.extraCambios,
                        body: {
                            reemplazo_obligatorio: p.reemplazoObligatorio ?? null,
                            turnos: (Array.isArray(p.turnos) ? p.turnos : []).map((t: any) => ({ id: t?.id, reemplazo_id: t?.reemplazoId ?? null })),
                            observaciones: typeof p.observaciones === "string" ? p.observaciones : "",
                            firma_ejecutivo_cuenta_digital: firmaDe(a.request, "digital"),
                            firma_ejecutivo_cuenta_manual: firmaDe(a.request, "manual"),
                            hora_accion: horaDe(a.request)?.toISOString(),
                        },
                    });
                },
            },
        },
    },
    "mutuos-acuerdos": {
        table: "e_mutuos_acuerdos",
        estado: (e) => estadoDe(e, "pendiente"),
        acciones: (e, a) => accionesDeMutuo(e, a.supervisorId),
        ejecutar: {
            rechazar: { run: (env, a) => rechazarMutuoAcuerdo(env, { id: a.id, actorId: a.actor.id, horaAccion: null, extraCambios: a.extraCambios }) },
            aprobar: {
                planillas: true,
                run: (env, a) => aprobarMutuoAcuerdo(env, { id: a.id, actorId: a.actor.id, firmaDigital: firmaDe(a.request, "digital"), firmaManual: firmaDe(a.request, "manual"), horaAccion: horaDe(a.request), planillasToken: a.planillasToken, extraCambios: a.extraCambios }),
            },
        },
    },
};

const HTTP: Record<ActionErrorCode, number> = { planillas_session_required: 409, not_found: 404, already_resolved: 409, invalid_state: 409, conflict: 409, out_of_scope: 403, reason_required: 400, signature_required: 400, invalid_request: 400 };

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
        return json({ id: c.id, estado: c.tipo.estado(existing) || "pendiente", campos: [], adjuntos: [], firmas: [], acciones: c.tipo.acciones(existing, c.actor), datos: c.tipo.datos?.(existing) ?? {}, historial: await historial(c.env, c.tipo.table, c.id) });
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
        const impl = c.tipo.ejecutar[accion];
        if (!impl) return err("invalid_request", `La acción «${accion}» no está disponible para este tipo.`, 404);
        const body: any = await req.json().catch(() => ({}));
        const idem = String(req.headers.get("idempotency-key") ?? body?.idempotencyKey ?? "").trim();
        if (idem.length < 16) return err("invalid_request", "Falta la clave de idempotencia.");
        const motivo = typeof body?.reason === "string" && body.reason.trim() ? body.reason.trim().slice(0, 500) : null;

        const estado = c.tipo.estado(existing) || "pendiente";
        // Idempotencia por estado: si el MISMO actor ya llevó el registro a ese resultado, el reintento devuelve el mismo resultado sin repetir el efecto.
        const resultado = accion === "aprobar" ? "aprobado" : "rechazado";
        if ((accion === "rechazar" || accion === "aprobar") && estado === resultado) {
            const ultimo: any[] = (await c.env.call({ action: "GET", table: "c_cambios_apps_modules", operation: "findMany", where: { nombre_tabla: c.tipo.table, registro_id: c.id }, orderBy: { id: "desc" }, take: 1 })) ?? [];
            if (Number(ultimo[0]?.created_by) === c.actor.id) return json({ estado: resultado, ref: null, message: `Ya estaba ${resultado} por esta persona.` });
        }
        if (!c.tipo.acciones(existing, c.actor).includes(accion)) {
            // Distingue el motivo para que Guardify lo explique: ya resuelto / sin alcance / otro estado.
            if (estado !== "pendiente") return err(estado === "rechazado" || estado === "aprobado" ? "already_resolved" : "invalid_state", "El registro ya no está pendiente.");
            return err("out_of_scope", "No tienes alcance para esta acción sobre este registro.");
        }
        // Aprobar escribe en Planillas con el token que la persona dejó al entrar en la app: sin uno vigente no se toca nada.
        let planillasToken: string | null = null;
        if (impl.planillas) {
            planillasToken = await c.env.tokenPlanillas(c.actor.id);
            if (!planillasToken) return err("planillas_session_required", "Para esta acción hace falta la sesión de Planillas de la persona: debe abrir MonitoreApp y escribir su contraseña de Planillas, y luego reintentar.");
        }
        const res = await impl.run(c.env, {
            id: c.id, actor: c.actor, claims: c.claims, motivo, request: body, planillasToken,
            extraCambios: [...(motivo ? [{ prop: accion === "rechazar" ? "motivo_rechazo" : "observacion_guardify", before: null, after: motivo }] : []), { prop: "origen", before: null, after: `Guardify (${c.claims.email})` }],
        });
        console.log(JSON.stringify({ level: "info", msg: "guardify_action", tipo: tipoId, accion, status: res.status, ok: res.ok, ms: Date.now() - started, actor: c.actor.id }));
        if (!res.ok) return err(res.code, res.message);
        return json({ estado: resultado, ref: null, message: res.body.message ?? null });
    } catch (e) {
        console.error(JSON.stringify({ level: "error", msg: "guardify_action_failed", tipo: tipoId, accion, error: String(e) }));
        return json({ code: "invalid_request", message: "La app no pudo completar la acción." }, 500);
    }
}

/** Busca un empleado por su código (para elegir el reemplazo de un turno). Mismo contrato de autenticación que las demás rutas; solo devuelve id, nombre y código. */
export async function handleLookupEmpleado(req: Request, deps: ActionDeps): Promise<Response> {
    try {
        const envVars = deps.env ?? process.env;
        const auth = verifyGuardifyApiKey(req.headers, envVars);
        if (!auth.ok) return json({ error: auth.error, message: auth.message }, auth.status);
        const claims = verifyActorHeaders(req.headers, (envVars.GUARDIFY_REPORTS_API_KEY ?? "").trim(), (deps.now ?? Date.now)());
        if (!claims) return json({ error: "unauthorized", message: "Identidad del actor inválida o vencida." }, 401);
        const env = deps.getEnv();
        if (!(await resolveActorEmployee(env.prisma, claims.actor))) return err("out_of_scope", "No se pudo identificar a esta persona en la app.");
        const codigo = (new URL(req.url).searchParams.get("codigo") ?? "").trim();
        if (!codigo || codigo.length > 40) return err("invalid_request", "Escribe el código del empleado.");
        const e = await env.prisma.c_empleado.findFirst({ where: { codigo }, select: { id: true, codigo: true, nombre: true, primer_apellido: true, segundo_apellido: true } });
        if (!e) return err("not_found", "No hay un empleado con ese código.");
        return json({ id: Number(e.id), codigo: String(e.codigo), nombre: `${e.nombre ?? ""} ${e.primer_apellido ?? ""} ${e.segundo_apellido ?? ""}`.trim() || null });
    } catch (e) {
        console.error(JSON.stringify({ level: "error", msg: "guardify_lookup_failed", error: String(e) }));
        return json({ code: "invalid_request", message: "No se pudo consultar el empleado." }, 500);
    }
}

/** Máximo de filas por carga: cada fila revisa varias tablas y el envío a Planillas es de una vez. */
export const IMPORT_MAX_ROWS = 2000;

/**
 * Carga masiva para Guardify: `POST /api/guardify/actions/imports/inventario-puesto` con `{ modo: "validar" | "aplicar", filas: [...] }`.
 * `validar` hace todas las comprobaciones y devuelve lo que se crearía sin escribir nada; `aplicar` además lo envía a Planillas con el token de Planillas
 * que la persona dejó guardado en la app (sin uno vigente: `409 planillas_session_required`). Repetir una carga no duplica: lo ya cargado se omite.
 */
export async function handleImport(req: Request, tipo: string, deps: ActionDeps): Promise<Response> {
    try {
        const envVars = deps.env ?? process.env;
        const auth = verifyGuardifyApiKey(req.headers, envVars);
        if (!auth.ok) return json({ error: auth.error, message: auth.message }, auth.status);
        const claims = verifyActorHeaders(req.headers, (envVars.GUARDIFY_REPORTS_API_KEY ?? "").trim(), (deps.now ?? Date.now)());
        if (!claims) return json({ error: "unauthorized", message: "Identidad del actor inválida o vencida." }, 401);
        if (tipo !== "inventario-puesto") return err("invalid_request", `No existe la carga «${tipo}».`, 404);
        const body: any = await req.json().catch(() => ({}));
        const modo = body?.modo === "aplicar" ? "aplicar" : body?.modo === "validar" ? "validar" : null;
        if (!modo) return err("invalid_request", "El modo debe ser «validar» o «aplicar».");
        if (!Array.isArray(body?.filas) || body.filas.length === 0) return err("invalid_request", "Debe indicar al menos una fila.");
        if (body.filas.length > IMPORT_MAX_ROWS) return err("invalid_request", `Son demasiadas filas (máximo ${IMPORT_MAX_ROWS} por carga).`);
        const env = deps.getEnv();
        const actor = await resolveActorEmployee(env.prisma, claims.actor);
        if (!actor) return err("out_of_scope", "No se pudo identificar a esta persona en la app.");
        let planillasToken: string | null = null;
        if (modo === "aplicar") {
            planillasToken = await env.tokenPlanillas(actor.id);
            if (!planillasToken) return err("planillas_session_required", "Para cargar hace falta la sesión de Planillas de la persona: debe abrir MonitoreApp y escribir su contraseña de Planillas, y luego reintentar.");
        }
        const res = await cargarInventarioPuesto(env, { filas: body.filas, planillasToken, modo });
        console.log(JSON.stringify({ level: "info", msg: "guardify_import", tipo, modo, filas: body.filas.length, ok: res.ok, status: res.status, actor: actor.id }));
        if (!res.ok) return json({ code: res.code, message: res.message, ...(res.errors?.length ? { errores: res.errors } : {}) }, HTTP[res.code] ?? res.status);
        return json({ modo, creados: { planes: res.body.created_plans, entregas: res.body.created_entregas }, omitidos: res.body.skipped, mensaje: res.body.message });
    } catch (e) {
        console.error(JSON.stringify({ level: "error", msg: "guardify_import_failed", tipo, error: String(e) }));
        return json({ code: "invalid_request", message: "La app no pudo completar la carga." }, 500);
    }
}
