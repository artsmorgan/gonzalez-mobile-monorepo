import { verifyGuardifyApiKey, MIN_API_KEY_LENGTH } from "../guardifyReports/auth";
import { bindingOf, verifyActorHeaders, resolveActorEmployee, type ActorEmployee, type GuardifyActor } from "./actor";
import { PlanillasError, type ActionEnv, type ActionErrorCode, type ActionHttp } from "./env";
import { aprobarMutuoAcuerdo } from "./aprobar-mutuo";
import { cargarInventarioPuesto } from "./inventario";
import { aprobarPermisoSolicitud } from "./aprobar-permiso";
import { accionesDeMutuo, rechazarMutuoAcuerdo } from "./mutuos";
import { accionesDePermiso, rechazarPermisoSolicitud } from "./permisos";
import { claveValida, type IdempotencyStore } from "../idempotency";
import { conIdempotencia, readIdempotencyKey } from "../idempotencyHttp";

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
    /** Ids de empleado que son PARTE del registro (el solicitante, quien se ausenta y quien reemplaza): nadie resuelve lo suyo. */
    partes: (existing: any) => number[];
    /** Por qué una acción no aplica cuando el estado sí es pendiente, para que Guardify lo explique (si no hay motivo claro: sin alcance). */
    sinAccion: (existing: any) => { code: ActionErrorCode; message: string } | null;
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

const partesDePermiso = (e: any): number[] => [Number(e?.empleado_id)].filter((n) => n > 0);
const partesDeMutuo = (e: any): number[] => [Number(e?.empleadoAusente_id), Number(e?.empleadoReemplaza_id)].filter((n) => n > 0);

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
        acciones: (e, a) => (partesDePermiso(e).includes(a.id) ? [] : accionesDePermiso(e, a.id, a.supervisorId)),
        partes: partesDePermiso,
        sinAccion: (e) => (e?.firma_ejecutivo_cuenta_digital || e?.firma_ejecutivo_cuenta_manual ? { code: "already_resolved", message: "La solicitud ya fue completada por el ejecutivo." } : null),
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
                        // La hora de la acción es la del servidor (la convención de la app): la hora que mande el cliente no se usa en la bitácora.
                        readBody: async () => ({
                            reemplazo_obligatorio: p.reemplazoObligatorio ?? null,
                            turnos: (Array.isArray(p.turnos) ? p.turnos : []).map((t: any) => ({ id: t?.id, reemplazo_id: t?.reemplazoId ?? null })),
                            observaciones: typeof p.observaciones === "string" ? p.observaciones : "",
                            firma_ejecutivo_cuenta_digital: firmaDe(a.request, "digital"),
                            firma_ejecutivo_cuenta_manual: firmaDe(a.request, "manual"),
                        }),
                    });
                },
            },
        },
    },
    "mutuos-acuerdos": {
        table: "e_mutuos_acuerdos",
        estado: (e) => estadoDe(e, "pendiente"),
        acciones: (e, a) => (partesDeMutuo(e).includes(a.id) ? [] : accionesDeMutuo(e, a.supervisorId)),
        partes: partesDeMutuo,
        sinAccion: (e) => (e?.firma_ejecutivo_cuenta_digital || e?.firma_ejecutivo_cuenta_manual ? { code: "already_resolved", message: "Este mutuo acuerdo ya fue firmado por el ejecutivo." } : !e?.ausente_acepta || !e?.reemplaza_acepta ? { code: "invalid_state", message: "Ambos empleados deben aceptar antes de resolverlo." } : null),
        ejecutar: {
            rechazar: { run: (env, a) => rechazarMutuoAcuerdo(env, { id: a.id, actorId: a.actor.id, horaAccion: null, extraCambios: a.extraCambios }) },
            aprobar: {
                planillas: true,
                run: (env, a) => aprobarMutuoAcuerdo(env, { id: a.id, actorId: a.actor.id, firmaDigital: firmaDe(a.request, "digital"), firmaManual: firmaDe(a.request, "manual"), horaAccion: null, planillasToken: a.planillasToken, extraCambios: a.extraCambios }),
            },
        },
    },
};

const HTTP: Record<ActionErrorCode, number> = { planillas_session_required: 409, not_found: 404, already_resolved: 409, invalid_state: 409, conflict: 409, out_of_scope: 403, reason_required: 400, signature_required: 400, invalid_request: 400 };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const err = (code: ActionErrorCode, message: string, status = HTTP[code]) => json({ code, message }, status);
/** Un fallo de la lógica: los de servidor (500) conservan su estado; el resto sale con el estado del código tipado. */
const failure = (res: Extract<ActionHttp, { ok: false }>) => json({ code: res.code, message: res.message, ...(res.errors?.length ? { errores: res.errors } : {}) }, res.status >= 500 ? res.status : HTTP[res.code]);

/** Planillas respondió con error: se traduce a algo que Guardify pueda explicar. 401 = su sesión de Planillas no sirve; 403 = Planillas no se lo permite; 5xx o sin respuesta = no se completó. */
function planillasFailure(e: PlanillasError): Response {
    if (e.httpStatus === 401) return err("planillas_session_required", "Planillas no aceptó la sesión de la persona: debe abrir MonitoreApp y escribir su contraseña de Planillas, y luego reintentar.");
    if (e.httpStatus === 403) return err("out_of_scope", "Planillas no permitió esta operación para esta persona.");
    if (e.httpStatus >= 400 && e.httpStatus < 500) return err("invalid_request", "Planillas rechazó la solicitud.", 400);
    return json({ error: "planillas_unavailable", message: "Planillas no respondió o falló. Revisa en Planillas antes de reintentar si la operación llegó a completarse." }, 502);
}

/**
 * `idempotency`: almacén de claves de idempotencia (tabla `c_clave_idempotencia`). Con él, la misma `Idempotency-Key` sobre la misma acción devuelve el mismo
 * resultado sin repetir el efecto, y la misma clave con otra acción, otro registro u otra persona es `409 conflict` (protocolo de acciones). Sin él (pruebas)
 * solo rige la deducción por estado.
 */
export type ActionDeps = { getEnv: () => ActionEnv; env?: Record<string, string | undefined>; now?: () => number; idempotency?: (env: ActionEnv) => IdempotencyStore };

/** Cuerpo de los errores de la capa de idempotencia: tipados como el resto, salvo el almacén caído, que es un 503 sin `code` (Guardify lo lee como «app no disponible»). */
const idemErrorBody = (code: string, message: string) => (code === "store_unavailable" ? { error: code, message } : { code, message });

/** Tope del cuerpo de una petición (las firmas viajan como imagen). */
export const MAX_BODY_CHARS = 2_500_000;

/** Registros con una acción en curso en ESTE proceso: dos intentos a la vez sobre lo mismo no pasan los dos (el segundo recibe «conflicto»). */
const enCurso = new Set<string>();
async function conCandado<T>(llave: string, fn: () => Promise<T>): Promise<T | Response> {
    if (enCurso.has(llave)) return err("conflict", "Hay otra acción en curso sobre este registro. Espera un momento y revisa su estado.");
    enCurso.add(llave);
    try { return await fn(); } finally { enCurso.delete(llave); }
}

/** Llave y actor firmado (ligado a esta petición): lo común a todas las rutas. */
function autenticar(req: Request, raw: string, deps: ActionDeps): { ok: true; claims: GuardifyActor } | { ok: false; res: Response } {
    const envVars = deps.env ?? process.env;
    const auth = verifyGuardifyApiKey(req.headers, envVars);
    if (!auth.ok) return { ok: false, res: json({ error: auth.error, message: auth.message }, auth.status) };
    const key = (envVars.GUARDIFY_REPORTS_API_KEY ?? "").trim();
    const claims = key.length < MIN_API_KEY_LENGTH ? null : verifyActorHeaders(req.headers, key, (deps.now ?? Date.now)(), bindingOf(req.method, req.url, raw));
    if (!claims) return { ok: false, res: json({ error: "unauthorized", message: "Identidad del actor inválida o vencida." }, 401) };
    return { ok: true, claims: claims.actor };
}

const leerCuerpo = async (req: Request): Promise<string | Response> => {
    if (req.method === "GET") return "";
    const raw = await req.text();
    return raw.length > MAX_BODY_CHARS ? err("invalid_request", "El cuerpo de la petición es demasiado grande.", 413) : raw;
};
const parseJson = (raw: string): any => { try { return raw ? JSON.parse(raw) : {}; } catch { return {}; } };

type Ctx = { tipo: ActionTypeImpl; id: number; actor: ActorEmployee; claims: GuardifyActor; env: ActionEnv };

/** Llave, actor firmado, actor resuelto a una persona de la app y registro: lo común a las dos rutas de acciones. */
async function prepare(req: Request, raw: string, tipoId: string, idStr: string, deps: ActionDeps): Promise<{ ok: true; c: Ctx; existing: any } | { ok: false; res: Response }> {
    const a = autenticar(req, raw, deps);
    if (!a.ok) return a;
    const tipo = Object.hasOwn(ACTION_TYPES, tipoId) ? ACTION_TYPES[tipoId] : undefined;
    if (!tipo) return { ok: false, res: err("invalid_request", `No existe el tipo «${tipoId}».`, 404) };
    const id = Number(idStr);
    if (!Number.isInteger(id) || id <= 0) return { ok: false, res: err("invalid_request", "Id inválido.") };
    const env = deps.getEnv();
    const actor = await resolveActorEmployee(env.prisma, a.claims);
    if (!actor) return { ok: false, res: err("out_of_scope", "No se pudo identificar a esta persona en la app.") };
    const existing = await env.call({ action: "GET", table: tipo.table, operation: "findUnique", where: { id } });
    if (!existing) return { ok: false, res: err("not_found", "Registro no encontrado") };
    return { ok: true, c: { tipo, id, actor, claims: a.claims, env }, existing };
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
        const p = await prepare(req, "", tipoId, idStr, deps);
        if (!p.ok) return p.res;
        const { c, existing } = p;
        const acciones = c.tipo.acciones(existing, c.actor);
        // Quien no tiene nada que resolver aquí no ve el detalle (turnos, nombres, historial): solo el estado. Los campos, adjuntos y firmas los dibuja Guardify con el formulario del registro.
        return json({ id: c.id, estado: c.tipo.estado(existing) || "sin-estado", campos: [], adjuntos: [], firmas: [], acciones, datos: acciones.length ? c.tipo.datos?.(existing) ?? {} : {}, historial: acciones.length ? await historial(c.env, c.tipo.table, c.id) : [] });
    } catch (e) {
        console.error(JSON.stringify({ level: "error", msg: "guardify_action_detail_failed", tipo: tipoId, error: String(e) }));
        return json({ code: "invalid_request", message: "No se pudo consultar el registro." }, 500);
    }
}

export async function handleActionExecute(req: Request, tipoId: string, idStr: string, accion: string, deps: ActionDeps): Promise<Response> {
    const started = Date.now();
    try {
        const raw = await leerCuerpo(req);
        if (raw instanceof Response) return raw;
        const p = await prepare(req, raw, tipoId, idStr, deps);
        if (!p.ok) return p.res;
        const { c } = p;
        const impl = Object.hasOwn(c.tipo.ejecutar, accion) ? c.tipo.ejecutar[accion] : undefined;
        if (!impl) return err("invalid_request", `La acción «${accion}» no está disponible para este tipo.`, 404);
        const body: any = parseJson(raw);
        const idem = String(req.headers.get("idempotency-key") ?? body?.idempotencyKey ?? "").trim();
        if (!claveValida(idem)) return err("invalid_request", "Falta la clave de idempotencia o no es válida (16 a 128 caracteres visibles, sin espacios).");
        const motivo = typeof body?.reason === "string" && body.reason.trim() ? body.reason.trim().slice(0, 500) : null;

        const ejecutar = () => conCandado(`${tipoId}:${c.id}`, async () => {
            // Se vuelve a leer el registro DENTRO del candado: lo que decida ahora es lo que está en la base ahora.
            const existing = await c.env.call({ action: "GET", table: c.tipo.table, operation: "findUnique", where: { id: c.id } });
            if (!existing) return err("not_found", "Registro no encontrado");
            const estado = c.tipo.estado(existing) || "sin-estado";
            // Idempotencia por estado: si el MISMO actor ya llevó el registro a ese resultado, el reintento devuelve el mismo resultado sin repetir el efecto.
            const resultado = accion === "aprobar" ? "aprobado" : "rechazado";
            if ((accion === "rechazar" || accion === "aprobar") && estado === resultado) {
                const ultimo: any[] = (await c.env.call({ action: "GET", table: "c_cambios_apps_modules", operation: "findMany", where: { nombre_tabla: c.tipo.table, registro_id: c.id }, orderBy: { id: "desc" }, take: 1 })) ?? [];
                if (Number(ultimo[0]?.created_by) === c.actor.id) return json({ estado: resultado, ref: null, message: `Ya estaba ${resultado} por esta persona.` });
            }
            if (!c.tipo.acciones(existing, c.actor).includes(accion)) {
                // Distingue el motivo para que Guardify lo explique: ya resuelto / otro estado / parte del registro / sin alcance.
                if (c.tipo.partes(existing).includes(c.actor.id)) return err("out_of_scope", "No puedes resolver un registro en el que eres parte.");
                if (estado !== "pendiente") return err(estado === "rechazado" || estado === "aprobado" ? "already_resolved" : "invalid_state", "El registro ya no está pendiente.");
                const motivoNo = c.tipo.sinAccion(existing);
                if (motivoNo) return err(motivoNo.code, motivoNo.message);
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
            if (!res.ok) return failure(res);
            return json({ estado: resultado, ref: null, message: res.body.message ?? null });
        });
        // La reserva de la clave es el candado entre procesos (el `Set` de arriba solo cubre este); el reintento recibe el resultado original.
        if (!deps.idempotency) return await ejecutar();
        return await conIdempotencia(idem, { store: deps.idempotency(c.env), ambito: `${tipoId}:${accion}`, recurso: String(c.id), actorId: c.actor.id, onStoreError: "fail", errorBody: idemErrorBody }, async () => (await ejecutar()) as Response);
    } catch (e) {
        if (e instanceof PlanillasError) return planillasFailure(e);
        console.error(JSON.stringify({ level: "error", msg: "guardify_action_failed", tipo: tipoId, accion, error: String(e) }));
        return json({ code: "invalid_request", message: "La app no pudo completar la acción." }, 500);
    }
}

/** Busca un empleado por su código (para elegir el reemplazo de un turno). Mismo contrato de autenticación que las demás rutas; solo devuelve id, nombre y código. Un código repetido no se adivina. */
export async function handleLookupEmpleado(req: Request, deps: ActionDeps): Promise<Response> {
    try {
        const a = autenticar(req, "", deps);
        if (!a.ok) return a.res;
        const env = deps.getEnv();
        if (!(await resolveActorEmployee(env.prisma, a.claims))) return err("out_of_scope", "No se pudo identificar a esta persona en la app.");
        const codigo = (new URL(req.url).searchParams.get("codigo") ?? "").trim();
        if (!codigo || codigo.length > 40) return err("invalid_request", "Escribe el código del empleado.");
        const rows: any[] = await env.prisma.c_empleado.findMany({ where: { codigo }, select: { id: true, codigo: true, nombre: true, primer_apellido: true, segundo_apellido: true, estado: true }, take: 2 });
        if (!rows.length) return err("not_found", "No hay un empleado con ese código.");
        if (rows.length > 1) return err("conflict", "Hay más de un empleado con ese código: no se puede elegir uno solo.");
        const e = rows[0];
        if (String(e.estado ?? "").trim().toUpperCase() === "BA") return err("not_found", "No hay un empleado activo con ese código.");
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
 * Dos cargas `aplicar` a la vez de la misma persona no corren juntas (la segunda recibe «conflicto»).
 */
export async function handleImport(req: Request, tipo: string, deps: ActionDeps): Promise<Response> {
    try {
        const raw = await leerCuerpo(req);
        if (raw instanceof Response) return raw;
        const a = autenticar(req, raw, deps);
        if (!a.ok) return a.res;
        if (tipo !== "inventario-puesto") return err("invalid_request", `No existe la carga «${tipo}».`, 404);
        const body: any = parseJson(raw);
        const modo = body?.modo === "aplicar" ? "aplicar" : body?.modo === "validar" ? "validar" : null;
        if (!modo) return err("invalid_request", "El modo debe ser «validar» o «aplicar».");
        if (!Array.isArray(body?.filas) || body.filas.length === 0) return err("invalid_request", "Debe indicar al menos una fila.");
        if (body.filas.length > IMPORT_MAX_ROWS) return err("invalid_request", `Son demasiadas filas (máximo ${IMPORT_MAX_ROWS} por carga).`);
        const env = deps.getEnv();
        const actor = await resolveActorEmployee(env.prisma, a.claims);
        if (!actor) return err("out_of_scope", "No se pudo identificar a esta persona en la app.");
        const correr = async () => {
            let planillasToken: string | null = null;
            if (modo === "aplicar") {
                planillasToken = await env.tokenPlanillas(actor.id);
                if (!planillasToken) return err("planillas_session_required", "Para cargar hace falta la sesión de Planillas de la persona: debe abrir MonitoreApp y escribir su contraseña de Planillas, y luego reintentar.");
            }
            const res = await cargarInventarioPuesto(env, { filas: body.filas, planillasToken, modo });
            console.log(JSON.stringify({ level: "info", msg: "guardify_import", tipo, modo, filas: body.filas.length, ok: res.ok, status: res.status, actor: actor.id }));
            if (!res.ok) return failure(res);
            return json({ modo, creados: { planes: res.body.created_plans, entregas: res.body.created_entregas }, omitidos: res.body.skipped, mensaje: res.body.message });
        };
        if (modo !== "aplicar") return await correr();
        const clave = readIdempotencyKey(req, body?.idempotencyKey);
        const aplicar = () => conCandado(`import:${tipo}`, correr) as Promise<Response>;
        if (!deps.idempotency || clave === null) return await aplicar();
        return await conIdempotencia(clave, { store: deps.idempotency(env), ambito: `imports:${tipo}:aplicar`, recurso: "-", actorId: actor.id, onStoreError: "fail", errorBody: idemErrorBody }, aplicar);
    } catch (e) {
        if (e instanceof PlanillasError) return planillasFailure(e);
        console.error(JSON.stringify({ level: "error", msg: "guardify_import_failed", tipo, error: String(e) }));
        return json({ code: "invalid_request", message: "La app no pudo completar la carga." }, 500);
    }
}
