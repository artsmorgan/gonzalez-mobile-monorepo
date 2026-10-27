import assert from "node:assert/strict";
import crypto from "node:crypto";
import { describe, it } from "node:test";
import { ACTOR_MAX_SKEW_MS, resolveActorEmployee, verifyActorHeaders } from "./actor";
import type { ActionEnv } from "./env";
import { handleActionDetail, handleActionExecute } from "./handler";
import { accionesDeMutuo, puedeRechazarMutuo, rechazarMutuoAcuerdo } from "./mutuos";
import { accionesDePermiso, esEjecutivoDelPermiso, rechazarPermisoSolicitud } from "./permisos";

// Solo estructuras de la lógica (ids, estados, banderas): ningún registro de negocio inventado. Los datos reales se crean en la app y se
// prueban de punta a punta contra el servidor de pruebas.
const KEY = "k".repeat(32);
const IDEM = "0123456789abcdef0123";
const NOW = 1_700_000_000_000;

/** Firma como lo describe el protocolo, sin usar el código de la app: así se prueba que cumple la especificación. */
function sign(claims: unknown, key = KEY) {
    const payload = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
    return { "x-guardify-actor": payload, "x-guardify-actor-sig": crypto.createHmac("sha256", key).update(payload).digest("hex") };
}
const actorClaims = (over: object = {}) => ({ actor: { email: "a@b.co", name: "n", ...over }, ts: NOW, tenant: "t" });
const hdrs = (o: Record<string, string>) => ({ get: (k: string) => o[k.toLowerCase()] ?? null });

describe("identidad del actor (protocolo de acciones)", () => {
    it("acepta una firma hecha según la especificación y devuelve quién es", () => {
        const c = verifyActorHeaders(hdrs(sign(actorClaims())), KEY, NOW + 1000);
        assert.equal(c?.actor.email, "a@b.co");
        assert.equal(c?.tenant, "t");
    });
    it("rechaza llave distinta, carga alterada, firma mal formada, cabeceras ausentes y vencida o del futuro", () => {
        const h = sign(actorClaims());
        assert.equal(verifyActorHeaders(hdrs(h), "otra".repeat(8), NOW), null);
        assert.equal(verifyActorHeaders(hdrs({ ...h, "x-guardify-actor": sign(actorClaims({ email: "x@y.co" }))["x-guardify-actor"] }), KEY, NOW), null);
        assert.equal(verifyActorHeaders(hdrs({ ...h, "x-guardify-actor-sig": "zz" }), KEY, NOW), null);
        assert.equal(verifyActorHeaders(hdrs({}), KEY, NOW), null);
        assert.equal(verifyActorHeaders(hdrs(h), "", NOW), null);
        assert.equal(verifyActorHeaders(hdrs(h), KEY, NOW + ACTOR_MAX_SKEW_MS + 1), null);
        assert.equal(verifyActorHeaders(hdrs(h), KEY, NOW - ACTOR_MAX_SKEW_MS - 1), null);
        assert.notEqual(verifyActorHeaders(hdrs(h), KEY, NOW + ACTOR_MAX_SKEW_MS), null);
        assert.equal(verifyActorHeaders(hdrs(sign({ actor: { name: "n" }, ts: NOW, tenant: "t" })), KEY, NOW), null);
    });
});

describe("quién es el actor en la app", () => {
    const db = (tabla: { findUnique?: (a: any) => any; findMany?: (a: any) => any }) => ({ c_empleado: { findUnique: async () => null, findMany: async () => [], ...tabla } });
    it("primero el id; luego la cédula y el correo, cada uno solo si da UNA persona", async () => {
        assert.deepEqual(await resolveActorEmployee(db({ findUnique: async () => ({ id: 7, supervisor_id: 3 }) }), { email: "a@b.co", name: "n", externalId: "7" }), { id: 7, supervisorId: 3 });
        assert.deepEqual(await resolveActorEmployee(db({ findMany: async (a: any) => (a.where.cedula ? [{ id: 5, supervisor_id: null }] : []) }), { email: "a@b.co", name: "n", cedula: "x" }), { id: 5, supervisorId: null });
        assert.deepEqual(await resolveActorEmployee(db({ findMany: async (a: any) => (a.where.Email ? [{ id: 9, supervisor_id: 1 }] : []) }), { email: "a@b.co", name: "n" }), { id: 9, supervisorId: 1 });
    });
    it("dos coincidencias o ninguna: no se adivina", async () => {
        assert.equal(await resolveActorEmployee(db({ findMany: async () => [{ id: 1 }, { id: 2 }] }), { email: "a@b.co", name: "n", cedula: "x" }), null);
        assert.equal(await resolveActorEmployee(db({ findMany: async () => [{ id: 1 }, { id: 2 }] }), { email: "a@b.co", name: "n" }), null);
        assert.equal(await resolveActorEmployee(db({}), { email: "a@b.co", name: "n", externalId: "no-numero" }), null);
    });
});

describe("quién puede qué", () => {
    it("permisos: el ejecutivo de la solicitud o su supervisor; solo si está pendiente", () => {
        assert.equal(esEjecutivoDelPermiso({ ejecutivo_cuenta: 5 }, 5, null), true);
        assert.equal(esEjecutivoDelPermiso({ ejecutivo_cuenta: 5 }, 1, 5), true);
        assert.equal(esEjecutivoDelPermiso({ ejecutivo_cuenta: 5 }, 1, 2), false);
        assert.deepEqual(accionesDePermiso({ estado: "pendiente", ejecutivo_cuenta: 5 }, 5, null), ["rechazar"]);
        assert.deepEqual(accionesDePermiso({ estado: " Pendiente ", ejecutivo_cuenta: 5 }, 5, null), ["rechazar"]);
        for (const estado of ["aprobado", "rechazado", ""]) assert.deepEqual(accionesDePermiso({ estado, ejecutivo_cuenta: 5 }, 5, null), []);
        assert.deepEqual(accionesDePermiso({ estado: "pendiente", ejecutivo_cuenta: 5 }, 1, 2), []);
    });
    it("`aprobar` nunca se ofrece (requiere el token de Planillas del ejecutivo)", () => {
        assert.equal(accionesDePermiso({ estado: "pendiente", ejecutivo_cuenta: 5 }, 5, null).includes("aprobar"), false);
        assert.equal(accionesDeMutuo({ estado: "pendiente", ejecutivo_cuenta: 5, ausente_acepta: true, reemplaza_acepta: true }, 5).includes("aprobar"), false);
    });
    it("mutuos: el supervisor del actor es el ejecutivo del acuerdo, ambos aceptaron y está pendiente (sin estado = pendiente)", () => {
        assert.equal(puedeRechazarMutuo({ ejecutivo_cuenta: 5 }, 5), true);
        assert.equal(puedeRechazarMutuo({ ejecutivo_cuenta: 5 }, null), false);
        assert.equal(puedeRechazarMutuo({ ejecutivo_cuenta: 5 }, 6), false);
        const base = { ejecutivo_cuenta: 5, ausente_acepta: true, reemplaza_acepta: true };
        assert.deepEqual(accionesDeMutuo({ ...base, estado: null }, 5), ["rechazar"]);
        assert.deepEqual(accionesDeMutuo({ ...base, estado: "pendiente" }, 5), ["rechazar"]);
        assert.deepEqual(accionesDeMutuo({ ...base, estado: "rechazado" }, 5), []);
        assert.deepEqual(accionesDeMutuo({ ...base, reemplaza_acepta: false, estado: "pendiente" }, 5), []);
    });
});

type Call = Record<string, any>;
/** Entorno falso: registra lo que se escribe y lo que se notifica; `tablas` responde las lecturas por nombre de tabla. */
function fakeEnv(opts: { tablas?: Record<string, any>; empleados?: Record<number, any>; notifyFails?: boolean; cambios?: any[] } = {}) {
    const calls: Call[] = [], notifs: { title: string; message: string; recipients: number[]; originators: number[] }[] = [], reports: [number, string][] = [];
    const table = (n: string) => ({ findUnique: async ({ where }: any) => (n === "c_empleado" ? opts.empleados?.[where.id] ?? null : null), findMany: async () => [] });
    const env: ActionEnv = {
        call: async (d) => {
            calls.push(d);
            if (d.action === "GET" && d.table === "c_cambios_apps_modules") return opts.cambios ?? [];
            if (d.action === "GET") return opts.tablas?.[d.table] ?? null;
            return { id: d.where?.id ?? 0, ...(d.data ?? {}) };
        },
        prisma: new Proxy({} as Record<string, any>, { get: (t, n: string) => (t[n] ??= table(n)) }),
        notify: async (title, message, recipients, originators) => { notifs.push({ title, message, recipients, originators }); if (opts.notifyFails) throw new Error("push"); },
        report: async (s, m) => { reports.push([s, m]); },
        nowIso: (h) => (h ? h.toISOString() : "2026-10-26T20:00:00.000Z"),
    };
    return { env, calls, notifs, reports };
}
const writes = (calls: Call[]) => calls.filter((c) => c.action !== "GET");

describe("rechazar un permiso (lógica compartida con la ruta de la app)", () => {
    const base = { estado: "pendiente", ejecutivo_cuenta: 5, empleado_id: 8 };
    const run = (f: ReturnType<typeof fakeEnv>, over: object = {}) => rechazarPermisoSolicitud(f.env, { id: 1, actorId: 5, payload: { id: 5 }, body: {}, ...over });
    it("registro inexistente → 404 y no escribe", async () => {
        const f = fakeEnv();
        assert.deepEqual(await run(f), { ok: false, status: 404, code: "not_found", message: "Registro no encontrado" });
        assert.equal(writes(f.calls).length, 0);
        assert.deepEqual(f.reports, [[404, "Registro no encontrado"]]);
    });
    it("empleado inválido → 400; sin ser el ejecutivo → 400 «No autorizado…»; sin escribir", async () => {
        let f = fakeEnv({ tablas: { c_solicitud_permiso: base } });
        assert.equal((await run(f, { actorId: 0 }) as any).message, "Empleado inválido");
        f = fakeEnv({ tablas: { c_solicitud_permiso: base }, empleados: { 6: { supervisor_id: 9 } } });
        const r: any = await run(f, { actorId: 6 });
        assert.deepEqual([r.ok, r.status, r.code, r.message], [false, 400, "out_of_scope", "No autorizado para rechazar esta solicitud"]);
        assert.equal(writes(f.calls).length, 0);
    });
    it("ya resuelta o en otro estado → «Solo se pueden rechazar solicitudes pendientes» (400) con el código del protocolo", async () => {
        for (const [estado, code] of [["aprobado", "already_resolved"], ["rechazado", "already_resolved"], ["otro", "invalid_state"]] as const) {
            const f = fakeEnv({ tablas: { c_solicitud_permiso: { ...base, estado } }, empleados: { 5: {} } });
            const r: any = await run(f);
            assert.deepEqual([r.status, r.code, r.message], [400, code, "Solo se pueden rechazar solicitudes pendientes"]);
            assert.equal(writes(f.calls).length, 0);
        }
    });
    it("rechaza: UPDATE con estado y auditoría del actor, bitácora con el cambio (y lo extra), y notifica al solicitante", async () => {
        const f = fakeEnv({ tablas: { c_solicitud_permiso: base }, empleados: { 5: { nombre: "e" }, 8: { nombre: "s" } } });
        const r: any = await run(f, { extraCambios: [{ prop: "origen", before: null, after: "x" }] });
        assert.equal(r.ok, true); assert.equal(r.body.message, "Solicitud de permiso rechazada correctamente");
        const [upd, cambio] = writes(f.calls);
        assert.equal(upd!.table, "c_solicitud_permiso"); assert.equal(upd!.data.estado, "rechazado"); assert.equal(upd!.data.updated_by, 5);
        assert.deepEqual(JSON.parse(cambio!.data.cambios), [{ prop: "estado", before: "pendiente", after: "rechazado" }, { prop: "origen", before: null, after: "x" }]);
        assert.equal(cambio!.data.created_by, 5);
        assert.equal(f.notifs.length, 1); assert.deepEqual([f.notifs[0]!.recipients, f.notifs[0]!.originators], [[8], [5]]);
        assert.equal(f.notifs[0]!.title, "Solicitud de permiso rechazada");
    });
    it("si la notificación falla, el rechazo ya hecho no falla; sin solicitante no hay notificación", async () => {
        let f = fakeEnv({ tablas: { c_solicitud_permiso: base }, empleados: { 5: {} }, notifyFails: true });
        assert.equal(((await run(f)) as any).ok, true);
        f = fakeEnv({ tablas: { c_solicitud_permiso: { ...base, empleado_id: 0 } }, empleados: { 5: {} } });
        assert.equal(((await run(f)) as any).ok, true); assert.equal(f.notifs.length, 0);
    });
    it("el supervisor del actor también puede (regla de la app)", async () => {
        const f = fakeEnv({ tablas: { c_solicitud_permiso: base }, empleados: { 6: { supervisor_id: 5 } } });
        assert.equal(((await run(f, { actorId: 6, payload: { id: 6 } })) as any).ok, true);
    });
});

describe("rechazar un mutuo acuerdo (lógica compartida con la ruta de la app)", () => {
    const base = { estado: "pendiente", ejecutivo_cuenta: 5, ausente_acepta: true, reemplaza_acepta: true, empleadoAusente_id: 11, empleadoReemplaza_id: 12 };
    const run = (f: ReturnType<typeof fakeEnv>, over: object = {}) => rechazarMutuoAcuerdo(f.env, { id: 1, actorId: 3, horaAccion: null, ...over });
    it("inexistente → 404; ya resuelto → 400; empleado inválido → 400; sin ser el ejecutivo → 400; sin aceptación de ambos → 400", async () => {
        assert.equal(((await run(fakeEnv())) as any).code, "not_found");
        for (const estado of ["aprobado", "rechazado"]) assert.equal(((await run(fakeEnv({ tablas: { e_mutuos_acuerdos: { ...base, estado } } }))) as any).code, "already_resolved");
        assert.equal(((await run(fakeEnv({ tablas: { e_mutuos_acuerdos: base } }), { actorId: 0 })) as any).message, "Empleado inválido");
        assert.equal(((await run(fakeEnv({ tablas: { e_mutuos_acuerdos: base }, empleados: { 3: { supervisor_id: 9 } } }))) as any).message, "No autorizado para rechazar este mutuo acuerdo");
        assert.equal(((await run(fakeEnv({ tablas: { e_mutuos_acuerdos: { ...base, reemplaza_acepta: false } }, empleados: { 3: { supervisor_id: 5 } } }))) as any).message, "Ambos empleados deben aceptar antes de rechazar");
    });
    it("rechaza: UPDATE a «rechazado», bitácora con el actor y notifica a los dos empleados", async () => {
        const f = fakeEnv({ tablas: { e_mutuos_acuerdos: base }, empleados: { 3: { supervisor_id: 5, nombre: "e" } } });
        const r: any = await run(f, { extraCambios: [{ prop: "origen", before: null, after: "x" }] });
        assert.equal(r.ok, true); assert.deepEqual(r.body.data, { id: 1, estado: "rechazado" });
        const [upd, cambio] = writes(f.calls);
        assert.equal(upd!.table, "e_mutuos_acuerdos"); assert.equal(upd!.data.estado, "rechazado");
        assert.deepEqual(JSON.parse(cambio!.data.cambios).map((c: any) => c.prop), ["estado", "origen"]);
        assert.equal(cambio!.data.created_by, 3);
        assert.deepEqual(f.notifs[0]!.recipients.sort(), [11, 12]); assert.deepEqual(f.notifs[0]!.originators, [3]);
    });
    it("un mutuo sin estado cuenta como pendiente", async () => {
        const f = fakeEnv({ tablas: { e_mutuos_acuerdos: { ...base, estado: null } }, empleados: { 3: { supervisor_id: 5 } } });
        assert.equal(((await run(f)) as any).ok, true);
    });
});

describe("API de acciones para Guardify", () => {
    const env0 = { GUARDIFY_REPORTS_API_KEY: KEY };
    const req = (method: string, headers: Record<string, string>, body?: unknown) => new Request("https://app.test/x", { method, headers: { ...headers, ...(body !== undefined ? { "content-type": "application/json" } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
    const good = () => ({ authorization: `Bearer ${KEY}`, ...sign(actorClaims({ cedula: "c" }), KEY) });
    const deps = (f: ReturnType<typeof fakeEnv>, extra: object = {}) => ({ getEnv: () => f.env, env: env0, now: () => NOW, ...extra });
    // El actor es el empleado 5 y es el ejecutivo del registro.
    const world = (reg: object = { estado: "pendiente", ejecutivo_cuenta: 5, empleado_id: 8 }, tabla = "c_solicitud_permiso") => {
        const f = fakeEnv({ tablas: { [tabla]: reg }, empleados: { 5: { nombre: "e" }, 8: {} } });
        (f.env.prisma as any).c_empleado.findMany = async (a: any) => (a.where.cedula ? [{ id: 5, supervisor_id: null }] : []);
        return f;
    };
    const jsonOf = async (r: Response) => r.json() as Promise<any>;

    it("sin llave 401; llave corta o ausente en el servidor 503; actor sin firma o vencido 401; tipo desconocido 404; id inválido 400", async () => {
        const f = world();
        assert.equal((await handleActionDetail(req("GET", {}), "permisos", "1", deps(f))).status, 401);
        assert.equal((await handleActionDetail(req("GET", good()), "permisos", "1", deps(f, { env: {} }))).status, 503);
        assert.equal((await handleActionDetail(req("GET", { authorization: `Bearer ${KEY}` }), "permisos", "1", deps(f))).status, 401);
        assert.equal((await handleActionDetail(req("GET", good()), "permisos", "1", deps(f, { now: () => NOW + ACTOR_MAX_SKEW_MS + 5 }))).status, 401);
        assert.equal((await handleActionDetail(req("GET", good()), "nada", "1", deps(f))).status, 404);
        assert.equal((await handleActionDetail(req("GET", good()), "permisos", "0", deps(f))).status, 400);
        assert.equal(f.calls.length, 0);
    });
    it("detalle: estado, acciones del actor e historial; nunca se ofrece «aprobar»", async () => {
        const f = world();
        const r = await handleActionDetail(req("GET", good()), "permisos", "1", deps(f));
        assert.equal(r.status, 200);
        const b = await jsonOf(r);
        assert.deepEqual([b.id, b.estado, b.acciones, b.historial], [1, "pendiente", ["rechazar"], []]);
    });
    it("detalle de un registro que el actor no puede resolver: sin acciones", async () => {
        const b = await jsonOf(await handleActionDetail(req("GET", good()), "permisos", "1", deps(world({ estado: "pendiente", ejecutivo_cuenta: 99 }))));
        assert.deepEqual(b.acciones, []);
    });
    it("actor que no se puede identificar → 403 out_of_scope; registro inexistente → 404 not_found", async () => {
        const f = world(); (f.env.prisma as any).c_empleado.findMany = async () => [];
        const r = await handleActionDetail(req("GET", good()), "permisos", "1", deps(f));
        assert.deepEqual([r.status, (await jsonOf(r)).code], [403, "out_of_scope"]);
        const g = world(); g.env.call = async () => null;
        const n = await handleActionDetail(req("GET", good()), "permisos", "1", deps(g));
        assert.deepEqual([n.status, (await jsonOf(n)).code], [404, "not_found"]);
    });
    it("ejecutar: exige clave de idempotencia; la acción debe existir; solo el ejecutivo, solo si está pendiente", async () => {
        let r = await handleActionExecute(req("POST", good(), {}), "permisos", "1", "rechazar", deps(world()));
        assert.equal(r.status, 400);
        r = await handleActionExecute(req("POST", { ...good(), "idempotency-key": IDEM }, {}), "permisos", "1", "aprobar", deps(world()));
        assert.equal(r.status, 404);
        r = await handleActionExecute(req("POST", { ...good(), "idempotency-key": IDEM }, {}), "permisos", "1", "rechazar", deps(world({ estado: "pendiente", ejecutivo_cuenta: 99 })));
        assert.deepEqual([r.status, (await jsonOf(r)).code], [403, "out_of_scope"]);
        r = await handleActionExecute(req("POST", { ...good(), "idempotency-key": IDEM }, {}), "permisos", "1", "rechazar", deps(world({ estado: "aprobado", ejecutivo_cuenta: 5 })));
        assert.deepEqual([r.status, (await jsonOf(r)).code], [409, "already_resolved"]);
    });
    it("ejecutar rechazar: escribe una vez con el actor, el motivo y el origen en la bitácora; responde el estado", async () => {
        const f = world();
        const r = await handleActionExecute(req("POST", { ...good(), "idempotency-key": IDEM }, { reason: "  texto del motivo  " }), "permisos", "1", "rechazar", deps(f));
        assert.equal(r.status, 200);
        assert.equal((await jsonOf(r)).estado, "rechazado");
        const [upd, cambio] = writes(f.calls);
        assert.equal(upd!.data.estado, "rechazado"); assert.equal(upd!.data.updated_by, 5);
        const cambios = JSON.parse(cambio!.data.cambios);
        assert.deepEqual(cambios.map((c: any) => [c.prop, c.after]), [["estado", "rechazado"], ["motivo_rechazo", "texto del motivo"], ["origen", "Guardify (a@b.co)"]]);
    });
    it("reintento del mismo actor sobre un registro ya rechazado por él: mismo resultado, sin escribir de nuevo; otro actor: 409", async () => {
        const rech = { estado: "rechazado", ejecutivo_cuenta: 5, empleado_id: 8 };
        const f = world(rech); f.env.call = async (d: any) => (d.action === "GET" && d.table === "c_cambios_apps_modules" ? [{ created_by: 5 }] : d.action === "GET" ? rech : { id: 1 });
        const r = await handleActionExecute(req("POST", { ...good(), "idempotency-key": IDEM }, {}), "permisos", "1", "rechazar", deps(f));
        assert.equal(r.status, 200); assert.equal((await jsonOf(r)).estado, "rechazado");
        const g = world(rech); g.env.call = async (d: any) => (d.action === "GET" && d.table === "c_cambios_apps_modules" ? [{ created_by: 77 }] : d.action === "GET" ? rech : { id: 1 });
        const o = await handleActionExecute(req("POST", { ...good(), "idempotency-key": IDEM }, {}), "permisos", "1", "rechazar", deps(g));
        assert.deepEqual([o.status, (await jsonOf(o)).code], [409, "already_resolved"]);
    });
    it("mutuos-acuerdos: mismo flujo con sus reglas (el supervisor del actor es el ejecutivo del acuerdo)", async () => {
        const reg = { estado: null, ejecutivo_cuenta: 5, ausente_acepta: true, reemplaza_acepta: true, empleadoAusente_id: 11, empleadoReemplaza_id: 12 };
        const f = fakeEnv({ tablas: { e_mutuos_acuerdos: reg }, empleados: { 3: { nombre: "e", supervisor_id: 5 } } });
        (f.env.prisma as any).c_empleado.findMany = async (a: any) => (a.where.cedula ? [{ id: 3, supervisor_id: 5 }] : []);
        const d = await jsonOf(await handleActionDetail(req("GET", good()), "mutuos-acuerdos", "1", deps(f)));
        assert.deepEqual([d.estado, d.acciones], ["pendiente", ["rechazar"]]);
        const r = await handleActionExecute(req("POST", { ...good(), "idempotency-key": IDEM }, {}), "mutuos-acuerdos", "1", "rechazar", deps(f));
        assert.equal(r.status, 200);
        assert.equal(writes(f.calls)[0]!.table, "e_mutuos_acuerdos");
    });
    it("un error inesperado no se filtra: 500 con mensaje genérico", async () => {
        const f = world(); f.env.call = async () => { throw new Error("detalle interno secreto"); };
        const r = await handleActionDetail(req("GET", good()), "permisos", "1", deps(f));
        assert.equal(r.status, 500); assert.equal(JSON.stringify(await jsonOf(r)).includes("secreto"), false);
    });
});
