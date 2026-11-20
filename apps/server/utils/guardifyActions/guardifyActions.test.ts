import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { ACTOR_MAX_SKEW_MS, FIRMA_MANUAL_MAX_CHARS, firmaDigitalDeActor, resolveActorEmployee, validarFirmaManual, verifyActorHeaders } from "./actor";
import { decodificarFirmaCaptura } from "../evidencia";
import type { ActionEnv } from "./env";
import { handleActionDetail, handleActionExecute, handleImport, handleLookupEmpleado, IMPORT_MAX_ROWS, MAX_BODY_CHARS, turnosDe } from "./handler";
import { cargarInventarioPuesto, formatearParaPlanillas, INVENTARIO_MAX_FILAS, parseFechaEntregaParts, planificarCargaInventario } from "./inventario";
import { aprobarMutuoAcuerdo } from "./aprobar-mutuo";
import { aprobarPermisoSolicitud } from "./aprobar-permiso";
import { MARGEN_TOKEN_MS, tokenPlanillasVigente } from "./planillas";
import { makeActionEnv, type EnvDeps } from "./envFactory";
import { PlanillasError } from "./env";
import { isInternalRequest, markInternalRequest } from "../internalRequests";
import { accionesDeMutuo, puedeRechazarMutuo, rechazarMutuoAcuerdo } from "./mutuos";
import { memoryIdempotencyStore, type IdempotencyStore } from "../idempotency";
import { accionesDePermiso, esEjecutivoDelPermiso, rechazarPermisoSolicitud } from "./permisos";

// Solo estructuras de la lógica (ids, estados, banderas): ningún registro de negocio inventado. Los datos reales se crean en la app y se
// prueban de punta a punta contra el servidor de pruebas.
const KEY = "k".repeat(32);
const IDEM = "0123456789abcdef0123";
const NOW = 1_700_000_000_000;

/** Firma como lo describe el protocolo, sin usar el código de la app: así se prueba que cumple la especificación. */
const binding = (method: string, url: string, body = "") => { const u = new URL(url); return `${method.toUpperCase()}\n${u.pathname}${u.search}\n${crypto.createHash("sha256").update(body, "utf8").digest("hex")}`; };
const BIND0 = binding("POST", "https://app.test/x", "{}");
function sign(claims: unknown, key = KEY, bind = BIND0) {
    const payload = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
    return { "x-guardify-actor": payload, "x-guardify-actor-sig": crypto.createHmac("sha256", key).update(`${payload}\n${bind}`).digest("hex") };
}
/** Las pruebas de rutas piden `good()`; al armar la petición se firma ligada a SU método, ruta y cuerpo. */
const finalize = (h: Record<string, string>, method: string, url: string, body: string): Record<string, string> => {
    const { "x-test-actor": claims, ...rest } = h;
    return claims ? { ...rest, ...sign(JSON.parse(claims), KEY, binding(method, url, body)) } : rest;
};
const goodHeaders = () => ({ authorization: `Bearer ${KEY}`, "x-test-actor": JSON.stringify(actorClaims({ cedula: "c" })) });
const actorClaims = (over: object = {}) => ({ actor: { email: "a@b.co", name: "n", ...over }, ts: NOW, tenant: "t" });
const hdrs = (o: Record<string, string>) => ({ get: (k: string) => o[k.toLowerCase()] ?? null });

describe("identidad del actor (protocolo de acciones)", () => {
    it("acepta una firma hecha según la especificación y devuelve quién es", () => {
        const c = verifyActorHeaders(hdrs(sign(actorClaims())), KEY, NOW + 1000, BIND0);
        assert.equal(c?.actor.email, "a@b.co");
        assert.equal(c?.tenant, "t");
    });
    it("rechaza llave distinta, carga alterada, firma mal formada, cabeceras ausentes y vencida o del futuro", () => {
        const h = sign(actorClaims());
        assert.equal(verifyActorHeaders(hdrs(h), "otra".repeat(8), NOW, BIND0), null);
        assert.equal(verifyActorHeaders(hdrs({ ...h, "x-guardify-actor": sign(actorClaims({ email: "x@y.co" }))["x-guardify-actor"] }), KEY, NOW, BIND0), null);
        assert.equal(verifyActorHeaders(hdrs({ ...h, "x-guardify-actor-sig": "zz" }), KEY, NOW, BIND0), null);
        assert.equal(verifyActorHeaders(hdrs({}), KEY, NOW, BIND0), null);
        assert.equal(verifyActorHeaders(hdrs(h), "", NOW, BIND0), null);
        assert.equal(verifyActorHeaders(hdrs(h), KEY, NOW + ACTOR_MAX_SKEW_MS + 1, BIND0), null);
        assert.equal(verifyActorHeaders(hdrs(h), KEY, NOW - ACTOR_MAX_SKEW_MS - 1, BIND0), null);
        assert.notEqual(verifyActorHeaders(hdrs(h), KEY, NOW + ACTOR_MAX_SKEW_MS, BIND0), null);
        assert.equal(verifyActorHeaders(hdrs(sign({ actor: { name: "n" }, ts: NOW, tenant: "t" })), KEY, NOW, BIND0), null);
    });
    it("la firma queda LIGADA a la petición: otro método, otra ruta, otra consulta o otro cuerpo la invalidan", () => {
        const h = sign(actorClaims(), KEY, binding("POST", "https://app.test/api/guardify/actions/permisos/1/aprobar", '{"a":1}'));
        const ok = binding("POST", "https://app.test/api/guardify/actions/permisos/1/aprobar", '{"a":1}');
        assert.notEqual(verifyActorHeaders(hdrs(h), KEY, NOW, ok), null);
        for (const otra of [binding("GET", "https://app.test/api/guardify/actions/permisos/1/aprobar", '{"a":1}'), binding("POST", "https://app.test/api/guardify/actions/permisos/2/aprobar", '{"a":1}'), binding("POST", "https://app.test/api/guardify/actions/permisos/1/rechazar", '{"a":1}'), binding("POST", "https://app.test/api/guardify/actions/permisos/1/aprobar?scope=x", '{"a":1}'), binding("POST", "https://app.test/api/guardify/actions/permisos/1/aprobar", '{"a":2}')]) {
            assert.equal(verifyActorHeaders(hdrs(h), KEY, NOW, otra), null);
        }
    });
});

describe("quién es el actor en la app", () => {
    const db = (tabla: { findUnique?: (a: any) => any; findMany?: (a: any) => any }) => ({ c_empleado: { findUnique: async () => null, findMany: async () => [], ...tabla } });
    it("primero el id; luego la cédula y el correo, cada uno solo si da UNA persona", async () => {
        assert.deepEqual(await resolveActorEmployee(db({ findUnique: async () => ({ id: 7, supervisor_id: 3 }) }), { email: "a@b.co", name: "n", externalId: "7" }), { id: 7, supervisorId: 3, cedula: null });
        assert.deepEqual(await resolveActorEmployee(db({ findMany: async (a: any) => (a.where.cedula ? [{ id: 5, supervisor_id: null }] : []) }), { email: "a@b.co", name: "n", cedula: "x" }), { id: 5, supervisorId: null, cedula: null });
        assert.deepEqual(await resolveActorEmployee(db({ findMany: async (a: any) => (a.where.Email ? [{ id: 9, supervisor_id: 1 }] : []) }), { email: "a@b.co", name: "n" }), { id: 9, supervisorId: 1, cedula: null });
        // La cédula del actor sale de su registro en la app (va a la evidencia de la acción).
        assert.equal((await resolveActorEmployee(db({ findMany: async (a: any) => (a.where.cedula ? [{ id: 5, supervisor_id: null, cedula: " 111 " }] : []) }), { email: "a@b.co", name: "n", cedula: "111" }))?.cedula, "111");
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
        assert.deepEqual(accionesDePermiso({ estado: "pendiente", ejecutivo_cuenta: 5 }, 5, null), ["aprobar", "rechazar"]);
        assert.deepEqual(accionesDePermiso({ estado: " Pendiente ", ejecutivo_cuenta: 5 }, 5, null), ["aprobar", "rechazar"]);
        for (const estado of ["aprobado", "rechazado", ""]) assert.deepEqual(accionesDePermiso({ estado, ejecutivo_cuenta: 5 }, 5, null), []);
        assert.deepEqual(accionesDePermiso({ estado: "pendiente", ejecutivo_cuenta: 5 }, 1, 2), []);
    });
    it("`aprobar` se ofrece junto a `rechazar` mientras nadie haya firmado; con firma previa solo queda `rechazar`", () => {
        assert.deepEqual(accionesDePermiso({ estado: "pendiente", ejecutivo_cuenta: 5 }, 5, null), ["aprobar", "rechazar"]);
        assert.deepEqual(accionesDePermiso({ estado: "pendiente", ejecutivo_cuenta: 5, firma_ejecutivo_cuenta_manual: "x" }, 5, null), ["rechazar"]);
        const m = { estado: "pendiente", ejecutivo_cuenta: 5, ausente_acepta: true, reemplaza_acepta: true };
        assert.deepEqual(accionesDeMutuo(m, 5), ["aprobar", "rechazar"]);
        assert.deepEqual(accionesDeMutuo({ ...m, firma_ejecutivo_cuenta_digital: "x" }, 5), ["rechazar"]);
    });
    it("mutuos: el supervisor del actor es el ejecutivo del acuerdo, ambos aceptaron y está pendiente (sin estado = pendiente)", () => {
        assert.equal(puedeRechazarMutuo({ ejecutivo_cuenta: 5 }, 5), true);
        assert.equal(puedeRechazarMutuo({ ejecutivo_cuenta: 5 }, null), false);
        assert.equal(puedeRechazarMutuo({ ejecutivo_cuenta: 5 }, 6), false);
        const base = { ejecutivo_cuenta: 5, ausente_acepta: true, reemplaza_acepta: true };
        assert.deepEqual(accionesDeMutuo({ ...base, estado: null }, 5), ["aprobar", "rechazar"]);
        assert.deepEqual(accionesDeMutuo({ ...base, estado: "pendiente" }, 5), ["aprobar", "rechazar"]);
        assert.deepEqual(accionesDeMutuo({ ...base, estado: "rechazado" }, 5), []);
        assert.deepEqual(accionesDeMutuo({ ...base, reemplaza_acepta: false, estado: "pendiente" }, 5), []);
    });
});

type Call = Record<string, any>;
/** Entorno falso: registra lo que se escribe, lo que se notifica y lo que se manda a Planillas; `tablas` responde las lecturas por la API dinámica. */
function fakeEnv(opts: { tablas?: Record<string, any>; empleados?: Record<number, any>; rows?: Record<string, Record<number, any>>; many?: Record<string, any[]>; notifyFails?: boolean; cambios?: any[]; planillas?: (path: string, body: any) => any; token?: string | null } = {}) {
    const calls: Call[] = [], notifs: { title: string; message: string; recipients: number[]; originators: number[] }[] = [], reports: [number, string][] = [], planillasCalls: { path: string; body: any; token: string }[] = [];
    const table = (n: string) => ({
        findUnique: async ({ where }: any) => (n === "c_empleado" ? opts.empleados?.[where.id] ?? null : opts.rows?.[n]?.[where.id] ?? null),
        findFirst: async ({ where }: any) => (n === "c_empleado" ? Object.values(opts.empleados ?? {}).find((e: any) => e.codigo === where.codigo) ?? null : opts.rows?.[n]?.[where.id] ?? null),
        findMany: async () => opts.many?.[n] ?? [],
    });
    const env: ActionEnv = {
        call: async (d) => {
            calls.push(d);
            if (d.action === "GET" && d.table === "c_cambios_apps_modules") return opts.cambios ?? [];
            if (d.action === "GET") return opts.tablas?.[d.table] ?? null;
            // Como Prisma: un `update` devuelve la fila completa ya actualizada.
            return { ...(d.action === "UPDATE" ? opts.tablas?.[d.table] ?? {} : {}), id: d.where?.id ?? 0, ...(d.data ?? {}) };
        },
        prisma: new Proxy({} as Record<string, any>, { get: (t, n: string) => (t[n] ??= table(n)) }),
        notify: async (title, message, recipients, originators) => { notifs.push({ title, message, recipients, originators }); if (opts.notifyFails) throw new Error("push"); },
        report: async (s, m) => { reports.push([s, m]); },
        nowIso: (h) => (h ? h.toISOString() : "2026-10-26T20:00:00.000Z"),
        planillas: async (path, body, token) => { planillasCalls.push({ path, body, token }); return opts.planillas ? opts.planillas(path, body) : { success: true, data: { id: 1 } }; },
        tokenPlanillas: async () => (opts.token === undefined ? "token-estructural" : opts.token),
    };
    return { env, calls, notifs, reports, planillasCalls };
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
    const req = (method: string, headers: Record<string, string>, body?: unknown, url = "https://app.test/x") => { const text = body !== undefined ? JSON.stringify(body) : undefined; return new Request(url, { method, headers: { ...finalize(headers, method, url, text ?? ""), ...(body !== undefined ? { "content-type": "application/json" } : {}) }, body: text }); };
    const good = goodHeaders;
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
    it("detalle: estado, acciones del actor e historial", async () => {
        const f = world();
        const r = await handleActionDetail(req("GET", good()), "permisos", "1", deps(f));
        assert.equal(r.status, 200);
        const b = await jsonOf(r);
        assert.deepEqual([b.id, b.estado, b.acciones, b.historial], [1, "pendiente", ["aprobar", "rechazar"], []]);
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
        r = await handleActionExecute(req("POST", { ...good(), "idempotency-key": IDEM }, {}), "permisos", "1", "inventada", deps(world()));
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
        assert.deepEqual([d.estado, d.acciones], ["pendiente", ["aprobar", "rechazar"]]);
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

describe("token de Planillas guardado de la persona", () => {
    const AHORA = 1_000_000;
    it("vigente: lo devuelve; vencido, por vencer, vacío, sin fecha o con fecha ilegible: nada (no se usa un token dudoso)", () => {
        assert.equal(tokenPlanillasVigente({ token: " abc ", expires_at: new Date(AHORA + MARGEN_TOKEN_MS + 1) }, AHORA), "abc");
        assert.equal(tokenPlanillasVigente({ token: "abc", expires_at: AHORA + MARGEN_TOKEN_MS + 1 }, AHORA), "abc");
        assert.equal(tokenPlanillasVigente({ token: "abc", expires_at: new Date(AHORA + MARGEN_TOKEN_MS) }, AHORA), null);
        assert.equal(tokenPlanillasVigente({ token: "abc", expires_at: new Date(AHORA + 1000) }, AHORA), null, "uno que vence en un segundo se rechazaría a mitad de la acción");
        assert.equal(tokenPlanillasVigente({ token: "abc", expires_at: new Date(AHORA - 1) }, AHORA), null);
        assert.equal(tokenPlanillasVigente({ token: "", expires_at: new Date(AHORA + MARGEN_TOKEN_MS + 1) }, AHORA), null);
        assert.equal(tokenPlanillasVigente({ token: "abc" }, AHORA), null);
        assert.equal(tokenPlanillasVigente({ token: "abc", expires_at: "no es fecha" }, AHORA), null);
        assert.equal(tokenPlanillasVigente(null, AHORA), null);
        assert.equal(tokenPlanillasVigente(undefined, AHORA), null);
    });
});

describe("aprobar un permiso (lógica compartida con la ruta de la app)", () => {
    const FIRMA = "firma-con-mas-de-diez-caracteres";
    const turnos = JSON.stringify([{ id: 21 }, { id: 22 }]);
    const base = { estado: "pendiente", ejecutivo_cuenta: 5, empleado_id: 8, tipo: "Con goce", corpo_id: 3, turnos, fecha_inicio: "2026-10-01T00:00:00.000Z", fecha_fin: "2026-10-02T00:00:00.000Z", plaza_id: 4 };
    const body = (over: object = {}) => ({ firma_ejecutivo_cuenta_digital: FIRMA, firma_ejecutivo_cuenta_manual: FIRMA, observaciones: " obs ", turnos: [], ...over });
    const world = (reg: object = base, extra: object = {}) => fakeEnv({ tablas: { c_solicitud_permiso: reg }, empleados: { 5: { nombre: "e" }, 8: { nombre: "s" }, 31: { nombre: "r" } }, ...extra });
    const run = (f: ReturnType<typeof fakeEnv>, over: { body?: object; [k: string]: unknown } = {}) => { const { body: b, ...rest } = over; return aprobarPermisoSolicitud(f.env, { id: 1, actorId: 5, payload: { id: 5 }, readBody: async () => (b ?? body()) as never, planillasToken: "tp", ...rest }); };

    it("sin token de Planillas no se hace nada: «planillas_session_required»", async () => {
        const f = world();
        const r: any = await run(f, { planillasToken: null });
        assert.deepEqual([r.ok, r.status, r.code], [false, 400, "planillas_session_required"]);
        assert.equal(f.calls.length, 0); assert.equal(f.planillasCalls.length, 0);
    });
    it("inexistente 404; empleado inválido 400; sin ser el ejecutivo 400; no pendiente → «ya resuelta»; ya firmada → «ya resuelta»; firmas cortas → «signature_required»", async () => {
        assert.equal(((await run(fakeEnv())) as any).code, "not_found");
        assert.equal(((await run(world(), { actorId: 0 })) as any).message, "Empleado inválido");
        assert.equal(((await run(world(base, { empleados: { 6: { supervisor_id: 9 } } }), { actorId: 6 })) as any).message, "No autorizado para aprobar esta solicitud");
        assert.equal(((await run(world({ ...base, estado: "rechazado" }))) as any).code, "already_resolved");
        assert.equal(((await run(world({ ...base, firma_ejecutivo_cuenta_manual: "x" }))) as any).code, "already_resolved");
        for (const b of [body({ firma_ejecutivo_cuenta_digital: "corta" }), body({ firma_ejecutivo_cuenta_manual: "" })]) {
            const f = world(); const r: any = await run(f, { body: b });
            assert.deepEqual([r.status, r.code], [400, "signature_required"]);
            assert.equal(f.planillasCalls.length, 0); assert.equal(writes(f.calls).length, 0);
        }
    });
    it("mismo reemplazo en todos los turnos: UN permiso en Planillas con las fechas de la solicitud, y luego aprobada con firmas, bitácora y notificación", async () => {
        const f = world(base, { tablas: { c_solicitud_permiso: base, n_ejecutivo_cuenta_coordinador: { coordinador_id: 77 } }, rows: { e_estructura_sucursal: { 3: { ejecutivoCuenta_id: 9 } } } });
        const r: any = await run(f, { extraCambios: [{ prop: "origen", before: null, after: "x" }], body: body({ turnos: [{ id: 21, reemplazo_id: 31 }, { id: 22, reemplazo_id: 31 }], reemplazo_obligatorio: 31 }) });
        assert.equal(r.ok, true); assert.equal(r.body.message, "Solicitud de permiso completada correctamente");
        assert.equal(f.planillasCalls.length, 1);
        assert.deepEqual(f.planillasCalls[0], { path: "/acciones/permisos", token: "tp", body: { tipo: "PCG", empleado_id: 8, fecha_inicio: "2026-10-01", fecha_fin: "2026-10-02", comentarios: undefined, reemplazo_id: 31, coordinado_por_id: 3, coordinador_id: 77 } });
        const [upd, cambio] = writes(f.calls);
        assert.equal(upd!.data.estado, "aprobado"); assert.equal(upd!.data.observaciones, "obs"); assert.equal(upd!.data.reemplazo_obligatorio, 31); assert.equal(upd!.data.updated_by, 5);
        assert.deepEqual(JSON.parse(upd!.data.turnos), [{ id: 21, reemplazo_id: 31 }, { id: 22, reemplazo_id: 31 }]);
        assert.deepEqual(JSON.parse(cambio!.data.cambios).map((c: any) => c.prop), ["reemplazo_obligatorio", "turnos", "firma_ejecutivo_cuenta_digital", "firma_ejecutivo_cuenta_manual", "observaciones", "estado", "origen"]);
        assert.equal(cambio!.data.created_by, 5);
        assert.deepEqual([f.notifs[0]!.title, f.notifs[0]!.recipients, f.notifs[0]!.originators], ["Solicitud de permiso aprobada", [8], [5]]);
    });
    it("reemplazos distintos: un permiso en Planillas por turno, con la fecha de su marca", async () => {
        const marca = (d: string) => ({ fecha: new Date(d) });
        const f = world(base, { rows: { c_marca_dia: { 21: marca("2026-10-01T00:00:00Z"), 22: marca("2026-10-02T00:00:00Z") }, c_empleado: {} } });
        const r: any = await run(f, { body: body({ turnos: [{ id: 21, reemplazo_id: 31 }, { id: 22, reemplazo_id: null }] }) });
        assert.equal(r.ok, true);
        assert.deepEqual(f.planillasCalls.map((c) => [c.body.fecha_inicio, c.body.fecha_fin, c.body.reemplazo_id]), [["2026-10-01", "2026-10-01", 31], ["2026-10-02", "2026-10-02", null]]);
    });
    it("si Planillas rechaza o falla NO se marca aprobada ni queda bitácora", async () => {
        let f = world(base, { planillas: () => ({ success: false }) });
        const r: any = await run(f);
        assert.deepEqual([r.ok, r.status, r.message], [false, 500, "Error al crear el permiso en Planillas"]);
        assert.equal(writes(f.calls).length, 0); assert.equal(f.notifs.length, 0);
        f = world(base, { planillas: () => { throw new Error("401 de Planillas"); } });
        await assert.rejects(() => run(f), /401 de Planillas/);
        assert.equal(writes(f.calls).length, 0);
    });
    it("un reemplazo que no existe corta antes de llamar a Planillas", async () => {
        const f = world();
        const r: any = await run(f, { body: body({ turnos: [{ id: 21, reemplazo_id: 999 }, { id: 22, reemplazo_id: 999 }] }) });
        assert.equal(r.ok, false); assert.equal(f.planillasCalls.length, 0); assert.equal(writes(f.calls).length, 0);
    });
    it("la notificación fallida no deshace la aprobación", async () => {
        const f = world(base, { notifyFails: true });
        assert.equal(((await run(f)) as any).ok, true);
    });
});

describe("aprobar un mutuo acuerdo (lógica compartida con la ruta de la app)", () => {
    const FIRMA = "firma-con-mas-de-diez-caracteres";
    const base = { estado: "pendiente", ejecutivo_cuenta: 5, ausente_acepta: true, reemplaza_acepta: true, empleadoAusente_id: 11, empleadoReemplaza_id: 12, fecha_ausente: "2026-10-01", fecha_reemplaza: "2026-10-02" };
    const world = (reg: object = base, extra: object = {}) => fakeEnv({ tablas: { e_mutuos_acuerdos: reg, n_ejecutivo_cuenta_coordinador: { coordinador_id: 77 } }, empleados: { 3: { nombre: "e", supervisor_id: 5 } }, rows: { c_cambio_guardia: { 1: { id: 1 } } }, ...extra });
    const run = (f: ReturnType<typeof fakeEnv>, over: object = {}) => aprobarMutuoAcuerdo(f.env, { id: 1, actorId: 3, firmaDigital: FIRMA, firmaManual: FIRMA, horaAccion: null, planillasToken: "tp", ...over });

    it("sin token, con firmas cortas, inexistente, ya resuelto, ya firmado, sin aceptar o sin ser el ejecutivo: no toca nada", async () => {
        const check = async (f: ReturnType<typeof fakeEnv>, over: object, code: string) => { const r: any = await run(f, over); assert.equal(r.code, code); assert.equal(f.planillasCalls.length, 0); assert.equal(writes(f.calls).length, 0); };
        await check(world(), { planillasToken: null }, "planillas_session_required");
        await check(world(), { firmaDigital: "corta" }, "signature_required");
        await check(fakeEnv(), {}, "not_found");
        await check(world({ ...base, estado: "aprobado" }), {}, "already_resolved");
        await check(world({ ...base, firma_ejecutivo_cuenta_digital: "x" }), {}, "already_resolved");
        await check(world({ ...base, reemplaza_acepta: false }), {}, "invalid_state");
        await check(world(base, { empleados: { 3: { supervisor_id: 9 } } }), {}, "out_of_scope");
        await check(world(base), { actorId: 0 }, "invalid_request");
    });
    it("aprueba: guarda firmas y estado, crea el cambio de guardia en Planillas con el coordinador, guarda su id, deja bitácora y notifica a los dos", async () => {
        const f = world();
        const r: any = await run(f, { extraCambios: [{ prop: "origen", before: null, after: "x" }] });
        assert.equal(r.ok, true); assert.equal(r.body.message, "Firmas del ejecutivo guardadas correctamente");
        assert.deepEqual(f.planillasCalls, [{ path: "/cdg", token: "tp", body: { tipo: "MUT", empleado_reemplaza_id: 12, fecha_reemplaza: "2026-10-02", empleado_ausente_id: 11, fecha_ausente: "2026-10-01", coordinado_por_id: 3, coordinador_id: 77 } }]);
        const ws = writes(f.calls);
        assert.equal(ws[0]!.data.estado, "aprobado"); assert.equal(ws[0]!.data.firma_ejecutivo_cuenta_digital, FIRMA);
        assert.equal(ws[1]!.data.cambio_guardia_id, 1);
        assert.deepEqual(JSON.parse(ws[2]!.data.cambios).map((c: any) => c.prop), ["firma_ejecutivo_cuenta_manual", "firma_ejecutivo_cuenta_digital", "estado", "origen"]);
        assert.equal(ws[2]!.data.created_by, 3);
        assert.deepEqual(f.notifs[0]!.recipients.sort(), [11, 12]);
    });
    it("Planillas dice que no: 500, sin bitácora ni notificación (el acuerdo ya quedó aprobado: comportamiento heredado de la ruta, por eso se verifica el token antes)", async () => {
        const f = world(base, { planillas: () => ({ success: false }) });
        const r: any = await run(f);
        assert.deepEqual([r.ok, r.status, r.message], [false, 500, "Error al crear el cambio de guardia en Planillas"]);
        assert.equal(f.notifs.length, 0);
        assert.equal(writes(f.calls).some((c) => c.table === "c_cambios_apps_modules"), false);
    });
    it("sin coordinador o sin fechas ni marcas: 404 antes de llamar a Planillas", async () => {
        const f = world(base, { tablas: { e_mutuos_acuerdos: base } });
        assert.equal(((await run(f)) as any).message, "Coordinador no encontrado"); assert.equal(f.planillasCalls.length, 0);
        const g = world({ ...base, fecha_ausente: null });
        assert.equal(((await run(g)) as any).message, "Marca ausente o reemplaza no encontrada"); assert.equal(g.planillasCalls.length, 0);
    });
});

describe("API de acciones: aprobar y buscar reemplazo", () => {
    const env0 = { GUARDIFY_REPORTS_API_KEY: KEY };
    const req = (method: string, headers: Record<string, string>, body?: unknown, url = "https://app.test/x") => { const text = body !== undefined ? JSON.stringify(body) : undefined; return new Request(url, { method, headers: { ...finalize(headers, method, url, text ?? ""), ...(body !== undefined ? { "content-type": "application/json" } : {}) }, body: text }); };
    const good = goodHeaders;
    const H = () => ({ ...good(), "idempotency-key": IDEM });
    const deps = (f: ReturnType<typeof fakeEnv>) => ({ getEnv: () => f.env, env: env0, now: () => NOW });
    // Guardify manda SOLO la firma manual (imagen); la digital la genera el servidor (issue #194).
    const FIRMA = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";
    const sigs = [{ role: "manual", method: "manual", image: FIRMA }];
    const jsonOf = async (r: Response) => r.json() as Promise<any>;
    const permisos = (extra: object = {}) => {
        const f = fakeEnv({ tablas: { c_solicitud_permiso: { estado: "pendiente", ejecutivo_cuenta: 5, empleado_id: 8, tipo: "Sin goce", corpo_id: 3, turnos: JSON.stringify([{ id: 21, puesto: "p", hora_inicio: "06:00", hora_fin: "14:00", tipo_turno: "Diurno", reemplazo_id: null }]), fecha_inicio: "2026-10-01T00:00:00.000Z", fecha_fin: "2026-10-01T00:00:00.000Z" } }, empleados: { 5: {}, 8: {} }, ...extra });
        (f.env.prisma as any).c_empleado.findMany = async (a: any) => (a.where.cedula ? [{ id: 5, supervisor_id: null }] : []);
        return f;
    };

    it("el detalle de un permiso trae los turnos con su etiqueta y reemplazo actual (para asignarlos en la pantalla)", async () => {
        const b = await jsonOf(await handleActionDetail(req("GET", good()), "permisos", "1", deps(permisos())));
        assert.deepEqual(b.datos.turnos, [{ id: 21, etiqueta: "Turno 21 · p · 06:00 a 14:00 (Diurno)", reemplazoId: null, reemplazoNombre: null }]);
        assert.equal(b.datos.reemplazoObligatorio, null);
        assert.deepEqual(turnosDe({ turnos: "no es json" }), []);
        assert.deepEqual(turnosDe({ turnos: JSON.stringify([{ id: 0 }, { x: 1 }]) }), []);
    });
    it("aprobar sin sesión de Planillas vigente: 409 «planillas_session_required» y NO se toca nada", async () => {
        const f = permisos({ token: null });
        const r = await handleActionExecute(req("POST", H(), { signatures: sigs, params: { turnos: [] } }), "permisos", "1", "aprobar", deps(f));
        assert.deepEqual([r.status, (await jsonOf(r)).code], [409, "planillas_session_required"]);
        assert.equal(writes(f.calls).length, 0); assert.equal(f.planillasCalls.length, 0);
    });
    it("aprobar un permiso con sesión de Planillas: traduce firmas y parámetros, crea el permiso y responde «aprobado»", async () => {
        const f = permisos({ rows: { e_estructura_sucursal: { 3: {} }, c_empleado: {} }, empleados: { 5: {}, 8: {}, 31: { nombre: "r" } } });
        const r = await handleActionExecute(req("POST", H(), { signatures: sigs, requestedAt: "2026-10-26T19:00:00.000Z", params: { turnos: [{ id: 21, reemplazoId: 31 }], reemplazoObligatorio: 31, observaciones: "ok" } }), "permisos", "1", "aprobar", deps(f));
        assert.equal(r.status, 200); assert.equal((await jsonOf(r)).estado, "aprobado");
        assert.equal(f.planillasCalls.length, 1); assert.equal(f.planillasCalls[0]!.token, "token-estructural"); assert.equal(f.planillasCalls[0]!.body.reemplazo_id, 31); assert.equal(f.planillasCalls[0]!.body.tipo, "PSG");
        const upd = writes(f.calls)[0]!;
        assert.equal(upd.data.estado, "aprobado"); assert.equal(upd.data.firma_ejecutivo_cuenta_manual, FIRMA); assert.equal(upd.data.observaciones, "ok");
        // La firma digital la genera el servidor con la forma de la que arma la app (sesión:empleado:lat:lng:marca de tiempo); el cliente no la manda.
        assert.ok(decodificarFirmaCaptura(upd.data.firma_ejecutivo_cuenta_digital), "la digital es del servidor");
        assert.equal(decodificarFirmaCaptura(upd.data.firma_ejecutivo_cuenta_digital)!.empleadoId, "5");
        assert.deepEqual(JSON.parse(upd.data.turnos), [{ id: 21, puesto: "p", hora_inicio: "06:00", hora_fin: "14:00", tipo_turno: "Diurno", reemplazo_id: 31 }]);
    });
    it("aprobar sin la firma manual: 400 «signature_required»; con una firma digital del cliente o una manual que no es imagen: 400 «invalid_request»; nada llega a Planillas", async () => {
        const f = permisos();
        const prueba = async (signatures: unknown) => { const r = await handleActionExecute(req("POST", H(), { signatures, params: { turnos: [] } }), "permisos", "1", "aprobar", deps(f)); return [r.status, (await jsonOf(r)).code]; };
        assert.deepEqual(await prueba([]), [400, "signature_required"]);
        assert.deepEqual(await prueba(undefined), [400, "signature_required"]);
        assert.deepEqual(await prueba([{ role: "digital", method: "digital", image: FIRMA }, sigs[0]]), [400, "invalid_request"], "no se acepta una digital enviada por el cliente");
        assert.deepEqual(await prueba([{ role: "manual", method: "manual", image: "firma-con-mas-de-diez-caracteres" }]), [400, "invalid_request"], "la manual debe ser una imagen data:");
        assert.deepEqual(await prueba([{ role: "manual", method: "manual", image: "data:text/html;base64,AAAA" }]), [400, "invalid_request"]);
        assert.deepEqual(await prueba([{ role: "manual", method: "manual", image: `data:image/png;base64,${"A".repeat(FIRMA_MANUAL_MAX_CHARS)}` }]), [400, "invalid_request"], "sobre el tope");
        assert.equal(f.planillasCalls.length, 0);
    });
    it("aprobar un mutuo acuerdo con sesión de Planillas; el reintento del mismo actor sobre uno ya aprobado por él da el mismo resultado sin repetir", async () => {
        const reg = { estado: null, ejecutivo_cuenta: 5, ausente_acepta: true, reemplaza_acepta: true, empleadoAusente_id: 11, empleadoReemplaza_id: 12, fecha_ausente: "2026-10-01", fecha_reemplaza: "2026-10-02" };
        const mk = (r: object, cambios?: any[]) => {
            const f = fakeEnv({ tablas: { e_mutuos_acuerdos: r, n_ejecutivo_cuenta_coordinador: { coordinador_id: 77 } }, empleados: { 3: { supervisor_id: 5 } }, rows: { c_cambio_guardia: { 1: { id: 1 } } }, cambios });
            (f.env.prisma as any).c_empleado.findMany = async (a: any) => (a.where.cedula ? [{ id: 3, supervisor_id: 5 }] : []);
            return f;
        };
        const f = mk(reg);
        const r = await handleActionExecute(req("POST", H(), { signatures: sigs }), "mutuos-acuerdos", "1", "aprobar", deps(f));
        assert.equal(r.status, 200); assert.equal((await jsonOf(r)).estado, "aprobado"); assert.equal(f.planillasCalls[0]!.path, "/cdg");
        const g = mk({ ...reg, estado: "aprobado" }, [{ created_by: 3 }]);
        const again = await handleActionExecute(req("POST", H(), { signatures: sigs }), "mutuos-acuerdos", "1", "aprobar", deps(g));
        assert.equal(again.status, 200); assert.equal((await jsonOf(again)).estado, "aprobado");
        assert.equal(g.planillasCalls.length, 0); assert.equal(writes(g.calls).length, 0);
        const other = mk({ ...reg, estado: "aprobado" }, [{ created_by: 77 }]);
        const o = await handleActionExecute(req("POST", H(), { signatures: sigs }), "mutuos-acuerdos", "1", "aprobar", deps(other));
        assert.deepEqual([o.status, (await jsonOf(o)).code], [409, "already_resolved"]);
    });
    it("buscar un empleado por código: exige llave y actor, devuelve solo id, código y nombre; 404 si no existe; 400 sin código", async () => {
        const mk = () => { const empleados: Record<number, any> = { 5: { codigo: "A1" }, 31: { id: 31, codigo: "B2", nombre: "n", primer_apellido: "a", segundo_apellido: "b", cedula: "SECRETA" } }; const f = fakeEnv({ empleados }); (f.env.prisma as any).c_empleado.findMany = async (a: any) => (a.where.cedula ? [{ id: 5, supervisor_id: null }] : a.where.codigo ? Object.values(empleados).filter((e: any) => e.codigo === a.where.codigo) : []); return f; };
        const get = (h: Record<string, string>, q: string) => handleLookupEmpleado(req("GET", h, undefined, `https://app.test/x?codigo=${q}`), deps(mk()));
        assert.equal((await get({}, "B2")).status, 401);
        assert.equal((await get({ authorization: `Bearer ${KEY}` }, "B2")).status, 401);
        const ok = await get(good(), "B2");
        assert.equal(ok.status, 200);
        const b = await jsonOf(ok);
        assert.deepEqual(b, { id: 31, codigo: "B2", nombre: "n a b" });
        assert.equal(JSON.stringify(b).includes("SECRETA"), false);
        assert.equal((await get(good(), "NOEXISTE")).status, 404);
        assert.equal((await get(good(), "")).status, 400);
    });
});


describe("carga masiva del inventario de un puesto", () => {
    // El catálogo y los puestos que «existen» son estructuras de la prueba: solo ids y códigos.
    const world = (extra: object = {}) => fakeEnv({ many: { n_articulo_corpo_puesto: [{ id: 1 }, { id: 2 }], e_estructura_puesto: [{ id: 10, codigo: "P-A" }, { id: 11, codigo: "P-B" }], e_estructura_articulo_corpo_puesto_plan: [], e_estructura_articulo_corpo_puesto_entrega: [] }, empleados: { 5: {} }, ...extra });
    const fila = (over: object = {}) => ({ codigo_puesto: "P-A", numero_articulo: 1, cantidad: 2, serie: "S1", marca: "M1", modelo: "Mo1", fecha_entrega: "05-10-2026", ...over });
    const cargar = (f: ReturnType<typeof fakeEnv>, filas: unknown, modo: "validar" | "aplicar" = "aplicar", token: string | null = "tp") => cargarInventarioPuesto(f.env, { filas, modo, planillasToken: token });

    it("fechas DD-MM-YYYY o DD/MM/YYYY; hora se ignora; todo lo demás es inválido", () => {
        assert.deepEqual(parseFechaEntregaParts("5-10-2026"), { dd: "05", mm: "10", yyyy: "2026", hh: "00", mi: "00", ss: "00" });
        assert.equal(parseFechaEntregaParts("05/10/2026 13:45")?.dd, "05");
        for (const v of ["2026-10-05", "32-01-2026", "01-13-2026", "", "ayer", "5-10-26"]) assert.equal(parseFechaEntregaParts(v), null, v);
    });
    it("sin filas o con filas inválidas: 400 con el detalle por fila y sin tocar Planillas", async () => {
        for (const filas of [undefined, [], "x"]) { const r: any = await cargar(world(), filas); assert.deepEqual([r.ok, r.status, r.message], [false, 400, "Debe indicar al menos un artículo."]); }
        const f = world();
        const r: any = await cargar(f, [fila({ codigo_puesto: "" }), fila({ numero_articulo: 0 }), fila({ cantidad: -1 }), fila({ serie: "" }), fila({ marca: "" }), fila({ fecha_entrega: "mañana" })]);
        assert.equal(r.status, 400); assert.equal(r.errors.length, 6);
        assert.match(r.errors[0], /^Artículo 1: código de puesto obligatorio\.$/); assert.match(r.errors[5], /^Artículo 6: fecha de entrega inválida/);
        assert.equal(f.planillasCalls.length, 0);
    });
    it("artículo o puesto que no existen: 404 con la lista; sin escribir", async () => {
        let f = world();
        let r: any = await cargar(f, [fila({ numero_articulo: 99 })]);
        assert.deepEqual([r.status, r.message, r.errors], [404, "Algunos artículos no existen.", ["El artículo #99 no existe."]]);
        r = await cargar(f, [fila({ codigo_puesto: "NO" })]);
        assert.deepEqual([r.status, r.message, r.errors], [404, "Algunos códigos de puesto no existen.", ["El código de puesto «NO» no existe."]]);
        assert.equal(f.planillasCalls.length, 0);
    });
    it("modo validar: dice qué se crearía y NO manda nada a Planillas ni pide token", async () => {
        const f = world();
        const r: any = await cargar(f, [fila(), fila({ codigo_puesto: "P-B", numero_articulo: 2 })], "validar", null);
        assert.equal(r.ok, true); assert.equal(r.body.modo, "validar"); assert.deepEqual([r.body.created_plans, r.body.created_entregas, r.body.skipped], [2, 2, []]);
        assert.equal(f.planillasCalls.length, 0); assert.equal(writes(f.calls).length, 0);
    });
    it("modo aplicar sin token: «planillas_session_required»; con token manda a Planillas las filas con la fecha YYYY-MM-DD, sin repetir (puesto, artículo)", async () => {
        assert.equal(((await cargar(world(), [fila()], "aplicar", null)) as any).code, "planillas_session_required");
        const f = world();
        const r: any = await cargar(f, [fila(), fila({ serie: "S2" })]);
        // Planillas recibe UNA fila por (puesto, artículo): la segunda serie no viaja y se informa como omitida (issue #195), no se cuenta como creada.
        assert.equal(r.ok, true); assert.deepEqual([r.body.created_plans, r.body.created_entregas], [1, 1]);
        assert.deepEqual(r.body.filas.map((x: any) => [x.fila, x.estado]), [[1, "creada"], [2, "omitida"]]);
        assert.match(r.body.filas[1].motivo, /ya viaja la fila 1/);
        assert.deepEqual(r.body.resumen, { recibidas: 2, creadas: 1, omitidas: 1, errores: 0 });
        assert.deepEqual(f.planillasCalls, [{ path: "/articulos-puesto/carga-masiva", token: "tp", body: { items: [{ codigo_puesto: "P-A", numero_articulo: 1, cantidad: 2, serie: "S1", marca: "M1", modelo: "Mo1", fecha_entrega: "2026-10-05" }] } }]);
    });
    it("lo que ya existe se omite (plan y entrega repetidos): repetir la carga no duplica", async () => {
        const f = world({ many: { n_articulo_corpo_puesto: [{ id: 1 }], e_estructura_puesto: [{ id: 10, codigo: "P-A" }], e_estructura_articulo_corpo_puesto_plan: [{ puesto_id: 10, articuloCP_id: 1 }], e_estructura_articulo_corpo_puesto_entrega: [{ puesto_id: 10, nomencladorArticuloCP_id: 1, marca: "M1", serie: "S1", modelo: "Mo1" }] } });
        const r: any = await cargar(f, [fila()]);
        assert.equal(r.ok, true); assert.deepEqual([r.body.created_plans, r.body.created_entregas], [0, 0]); assert.equal(r.body.skipped.length, 1);
        assert.deepEqual(r.body.filas.map((x: any) => [x.fila, x.estado]), [[1, "omitida"]]);
        assert.match(r.body.filas[0].motivo, /Ya existe en la base/);
        // Issue #181: con todo ya cargado no se llama a Planillas (antes se le mandaba una lista vacía).
        assert.equal(f.planillasCalls.length, 0);
        assert.match(r.body.message, /todo ya existía/);
    });
    it("si Planillas dice que no: 502 «planillas_unavailable» (no «invalid_request», que el protocolo reserva para 400/422); si lanza, el error sube y no se da por hecho", async () => {
        const r: any = await cargar(world({ planillas: () => ({ success: false }) }), [fila()]);
        assert.deepEqual([r.ok, r.status, r.code], [false, 502, "planillas_unavailable"]);
        assert.equal(r.message, "Error al cargar los artículos en Planillas");
        await assert.rejects(() => cargar(world({ planillas: () => { throw new Error("401"); } }), [fila()]), /401/);
    });
    it("el formato para Planillas no repite (puesto, artículo) y completa el modelo vacío", () => {
        const out = formatearParaPlanillas([{ ...fila(), modelo: null, fecha_entrega: "05-10-2026 00:00:00" } as any, { ...fila(), serie: "otra", fecha_entrega: "05-10-2026 00:00:00" } as any]);
        assert.equal(out.items.length, 1); assert.equal(out.items[0]!.modelo, ""); assert.equal(out.items[0]!.fecha_entrega, "2026-10-05");
    });
    it("planificar no escribe nada y distingue lo nuevo de lo omitido", async () => {
        const f = world();
        const p = await planificarCargaInventario(f.env.prisma, [fila()]);
        assert.equal(p.kind, "ok"); assert.equal(f.calls.length, 0);
    });

    describe("API de cargas para Guardify", () => {
        const env0 = { GUARDIFY_REPORTS_API_KEY: KEY };
        const good = goodHeaders;
        const req = (h: Record<string, string>, body?: unknown) => { const text = body === undefined ? undefined : JSON.stringify(body); return new Request("https://app.test/x", { method: "POST", headers: { ...finalize(h, "POST", "https://app.test/x", text ?? ""), "content-type": "application/json" }, body: text }); };
        const mk = (extra: object = {}) => { const f = world(extra); (f.env.prisma as any).c_empleado.findMany = async (a: any) => (a.where.cedula ? [{ id: 5, supervisor_id: null }] : []); return f; };
        const deps = (f: ReturnType<typeof fakeEnv>) => ({ getEnv: () => f.env, env: env0, now: () => NOW });
        const jsonOf = async (r: Response) => r.json() as Promise<any>;

        it("exige llave y actor firmado; la carga debe existir; modo y filas válidos; tope de filas", async () => {
            const f = mk();
            assert.equal((await handleImport(req({}, {}), "inventario-puesto", deps(f))).status, 401);
            assert.equal((await handleImport(req({ authorization: `Bearer ${KEY}` }, {}), "inventario-puesto", deps(f))).status, 401);
            assert.equal((await handleImport(req(good(), { modo: "validar", filas: [fila()] }), "otra", deps(f))).status, 404);
            assert.equal((await handleImport(req(good(), { modo: "ya", filas: [fila()] }), "inventario-puesto", deps(f))).status, 400);
            assert.equal((await handleImport(req(good(), { modo: "validar", filas: [] }), "inventario-puesto", deps(f))).status, 400);
            assert.equal((await handleImport(req(good(), { modo: "validar", filas: Array(IMPORT_MAX_ROWS + 1).fill(fila()) }), "inventario-puesto", deps(f))).status, 400);
            assert.equal(f.planillasCalls.length, 0);
        });
        it("actor que no se puede identificar: 403 y no se lee nada", async () => {
            const f = mk(); (f.env.prisma as any).c_empleado.findMany = async () => [];
            const r = await handleImport(req(good(), { modo: "validar", filas: [fila()] }), "inventario-puesto", deps(f));
            assert.deepEqual([r.status, (await jsonOf(r)).code], [403, "out_of_scope"]);
        });
        it("validar: devuelve lo que se crearía y no pide la sesión de Planillas", async () => {
            const f = mk({ token: null });
            const r = await handleImport(req(good(), { modo: "validar", filas: [fila()] }), "inventario-puesto", deps(f));
            assert.equal(r.status, 200);
            const b = await jsonOf(r);
            assert.deepEqual([b.modo, b.creados, b.omitidos], ["validar", { planes: 1, entregas: 1 }, []]);
            assert.equal(f.planillasCalls.length, 0);
        });
        it("validar con errores de datos: 400 con el detalle por fila (`errores`)", async () => {
            const r = await handleImport(req(good(), { modo: "validar", filas: [fila({ serie: "" }), fila({ serie: "S9" })] }), "inventario-puesto", deps(mk()));
            const b = await jsonOf(r);
            assert.deepEqual([r.status, b.code, b.errores], [400, "invalid_request", ["Artículo 1: serie obligatoria."]]);
            // Resultado de CADA fila y que suma lo recibido (issue #195): la que tiene error lo dice; la otra no se procesó porque no se envió nada.
            assert.deepEqual(b.filas.map((x: any) => [x.fila, x.estado]), [[1, "error"], [2, "omitida"]]);
            assert.equal(b.filas[0].motivo, "serie obligatoria.");
            assert.deepEqual(b.resumen, { recibidas: 2, creadas: 0, omitidas: 1, errores: 1 });
        });
        it("aplicar sin sesión de Planillas vigente: 409 «planillas_session_required» y no se toca nada", async () => {
            const f = mk({ token: null });
            const r = await handleImport(req({ ...good(), "idempotency-key": IDEM }, { modo: "aplicar", filas: [fila()] }), "inventario-puesto", deps(f));
            assert.deepEqual([r.status, (await jsonOf(r)).code], [409, "planillas_session_required"]);
            assert.equal(f.planillasCalls.length, 0);
        });
        it("aplicar con sesión de Planillas: envía y responde lo creado", async () => {
            const f = mk();
            const r = await handleImport(req({ ...good(), "idempotency-key": IDEM }, { modo: "aplicar", filas: [fila()] }), "inventario-puesto", deps(f));
            assert.equal(r.status, 200);
            const b = await jsonOf(r);
            assert.deepEqual([b.modo, b.creados], ["aplicar", { planes: 1, entregas: 1 }]);
            assert.equal(f.planillasCalls.length, 1); assert.equal(f.planillasCalls[0]!.token, "token-estructural");
            // Resultado por fila (issue #195): `creadas + omitidas + errores = recibidas`; y la acción deja su evidencia con origen «Guardify» (issue #193).
            assert.deepEqual(b.filas, [{ fila: 1, estado: "creada", motivo: null }]);
            assert.deepEqual(b.resumen, { recibidas: 1, creadas: 1, omitidas: 0, errores: 0 });
            assert.equal(b.evidencia, "registrada");
        });
        it("aplicar SIN clave de idempotencia: 400 «invalid_request» y no se toca Planillas (issue #197); validar no la necesita", async () => {
            const f = mk();
            for (const h of [good(), { ...good(), "idempotency-key": "corta" }]) {
                const r = await handleImport(req(h, { modo: "aplicar", filas: [fila()] }), "inventario-puesto", deps(f));
                assert.deepEqual([r.status, (await jsonOf(r)).code], [400, "invalid_request"]);
            }
            assert.equal(f.planillasCalls.length, 0);
            assert.equal((await handleImport(req(good(), { modo: "validar", filas: [fila()] }), "inventario-puesto", deps(f))).status, 200);
        });
        it("un error inesperado no se filtra", async () => {
            const f = mk(); f.env.prisma = new Proxy({}, { get: () => { throw new Error("detalle interno secreto"); } }) as never;
            const r = await handleImport(req(good(), { modo: "validar", filas: [fila()] }), "inventario-puesto", deps(f));
            assert.equal(r.status, 500); assert.equal(JSON.stringify(await jsonOf(r)).includes("secreto"), false);
        });
    });
});


describe("entorno real de las acciones (lo que antes solo se probaba con piezas falsas)", () => {
    const deps = (over: Partial<EnvDeps> = {}) => {
        const log: { fn: string; args: any[] }[] = [];
        const d: EnvDeps = {
            callDynamicPrisma: async (p) => { log.push({ fn: "call", args: [p] }); return p.data.table === "a_mobile_token_for_planillas" ? { token: "t", expires_at: new Date(10 * 60_000 + 1_000_000) } : { ok: true }; },
            markInternalRequest: (r) => { log.push({ fn: "mark", args: [r] }); markInternalRequest(r); },
            reportError: async (...a) => { log.push({ fn: "report", args: a }); },
            sendNotificationByEmployee: async (...a) => { log.push({ fn: "notify", args: a }); },
            prisma: {},
            planillasPost: async (path, body, token) => { log.push({ fn: "planillas", args: [path, body, token] }); return { success: true }; },
            ahoraPared: () => new Date(1_000_000),
            ...over,
        };
        return { d, log };
    };
    it("desde Guardify la petición se marca como interna y TODA llamada va sin verificar al usuario; desde la app, nada cambia", async () => {
        const g = deps(); const reqG = {};
        const envG = makeActionEnv(g.d, reqG, "ruta", "POST", { verifyUser: false });
        await envG.call({ action: "GET", table: "x" });
        assert.equal(isInternalRequest(reqG), true);
        assert.equal(g.log.find((l) => l.fn === "call")!.args[0].shouldVerifyAccessToken, false);
        const a = deps(); const reqA = {};
        const envA = makeActionEnv(a.d, reqA, "ruta", "PUT", { verifyUser: true });
        await envA.call({ action: "GET", table: "x" });
        assert.equal(isInternalRequest(reqA), false);
        assert.equal(a.log.find((l) => l.fn === "call")!.args[0].shouldVerifyAccessToken, true);
        assert.equal(a.log.some((l) => l.fn === "mark"), false);
    });
    it("`report` NUNCA lanza: un fallo al registrar un error no tumba la respuesta de la acción", async () => {
        const { d } = deps({ reportError: async () => { throw new TypeError("Cannot read properties of null (reading 'id')"); } });
        const env = makeActionEnv(d, {}, "ruta", "POST", { verifyUser: false });
        await assert.doesNotReject(() => env.report(400, "mensaje"));
    });
    it("las notificaciones salen con quién la origina y a quién; el orden de los argumentos es el de la librería", async () => {
        const { d, log } = deps();
        const env = makeActionEnv(d, {}, "ruta", "POST", { verifyUser: false });
        await env.notify("título", "mensaje", [8, 9], [5]);
        assert.deepEqual(log.find((l) => l.fn === "notify")!.args.slice(1), [0, [5], "título", "mensaje", [8, 9]]);
    });
    it("el token de Planillas se busca sin usuario, el más reciente primero, y se descarta si vence pronto", async () => {
        const { d, log } = deps();
        const env = makeActionEnv(d, {}, "ruta", "POST", { verifyUser: false });
        assert.equal(await env.tokenPlanillas(5), "t");
        const q = log.find((l) => l.fn === "call")!.args[0];
        assert.deepEqual([q.shouldVerifyAccessToken, q.data.where, q.data.orderBy], [false, { empleado_id: 5 }, { id: "desc" }]);
        const corto = deps({ callDynamicPrisma: async () => ({ token: "t", expires_at: new Date(1_000_000 + 5_000) }) });
        assert.equal(await makeActionEnv(corto.d, {}, "r", "POST", { verifyUser: false }).tokenPlanillas(5), null);
    });
    it("los errores de Planillas llegan como `PlanillasError` con su estado HTTP y el mensaje original", async () => {
        const mk = (e: unknown) => makeActionEnv(deps({ planillasPost: async () => { throw e; } }).d, {}, "r", "POST", { verifyUser: false });
        await assert.rejects(() => mk(Object.assign(new Error("Request failed with status code 401"), { response: { status: 401 } })).planillas("/x", {}, "t"), (e: any) => e instanceof PlanillasError && e.httpStatus === 401 && e.message === "Request failed with status code 401");
        await assert.rejects(() => mk(new Error("timeout of 30000ms exceeded")).planillas("/x", {}, "t"), (e: any) => e instanceof PlanillasError && e.httpStatus === 0);
    });
    it("una petición interna no se confunde con otra (la marca es por objeto)", () => {
        const a = {}, b = {}; markInternalRequest(a);
        assert.equal(isInternalRequest(a), true); assert.equal(isInternalRequest(b), false);
    });
});

describe("mutuo: si Planillas falla, el acuerdo no queda aprobado a medias", () => {
    const FIRMA = "firma-con-mas-de-diez-caracteres";
    const base = { estado: "pendiente", ejecutivo_cuenta: 5, ausente_acepta: true, reemplaza_acepta: true, empleadoAusente_id: 11, empleadoReemplaza_id: 12, fecha_ausente: "2026-10-01", fecha_reemplaza: "2026-10-02", firma_ejecutivo_cuenta_manual: null, firma_ejecutivo_cuenta_digital: "" };
    const world = (extra: object = {}, reg: object = base) => fakeEnv({ tablas: { e_mutuos_acuerdos: reg, n_ejecutivo_cuenta_coordinador: { coordinador_id: 77 } }, empleados: { 3: { nombre: "e", supervisor_id: 5 } }, rows: { c_cambio_guardia: { 1: { id: 1 } } }, ...extra });
    const run = (f: ReturnType<typeof fakeEnv>) => aprobarMutuoAcuerdo(f.env, { id: 1, actorId: 3, firmaDigital: FIRMA, firmaManual: FIRMA, horaAccion: null, planillasToken: "tp" });
    it("Planillas dice que no: el acuerdo vuelve a pendiente y sin firmas, sin bitácora ni aviso (se puede reintentar)", async () => {
        const f = world({ planillas: () => ({ success: false }) });
        const r: any = await run(f);
        assert.deepEqual([r.ok, r.status], [false, 500]);
        const ws = writes(f.calls);
        assert.equal(ws.length, 2);
        assert.equal(ws[0]!.data.estado, "aprobado");
        assert.deepEqual([ws[1]!.data.estado, ws[1]!.data.firma_ejecutivo_cuenta_manual, ws[1]!.data.firma_ejecutivo_cuenta_digital], ["pendiente", null, ""]);
        assert.equal(f.notifs.length, 0); assert.equal(ws.some((c) => c.table === "c_cambios_apps_modules"), false);
    });
    it("Planillas lanza (401, 5xx, sin respuesta): también se revierte y el error sube", async () => {
        const f = world({ planillas: () => { throw new PlanillasError(401, "401"); } });
        await assert.rejects(() => run(f), (e: any) => e instanceof PlanillasError);
        const ws = writes(f.calls);
        assert.deepEqual([ws[0]!.data.estado, ws[1]!.data.estado], ["aprobado", "pendiente"]);
    });
    it("un dato que falta (coordinador, fechas, marcas) se detecta ANTES de escribir: no se toca nada", async () => {
        for (const f of [world({ tablas: { e_mutuos_acuerdos: base } }), world({}, { ...base, fecha_ausente: null })]) {
            const r: any = await run(f);
            assert.equal(r.status, 404);
            assert.equal(writes(f.calls).length, 0); assert.equal(f.planillasCalls.length, 0);
        }
    });
    it("si además falla el revertir, el error de Planillas es el que se informa (y queda en el log)", async () => {
        const f = world({ planillas: () => ({ success: false }) });
        const original = f.env.call;
        let updates = 0;
        f.env.call = async (d) => { if (d.action === "UPDATE" && ++updates === 2) throw new Error("db caída"); return original(d); };
        const r: any = await run(f);
        assert.deepEqual([r.ok, r.status], [false, 500]);
    });
});

describe("aprobar un permiso: entradas y orden", () => {
    const FIRMA = "firma-con-mas-de-diez-caracteres";
    const base = { estado: "pendiente", ejecutivo_cuenta: 5, empleado_id: 8, tipo: "Con goce", corpo_id: 3, turnos: JSON.stringify([{ id: 21 }]), fecha_inicio: "2026-10-01T00:00:00.000Z", fecha_fin: "2026-10-02T00:00:00.000Z" };
    const world = (reg: object = base) => fakeEnv({ tablas: { c_solicitud_permiso: reg }, empleados: { 5: {}, 8: {}, 31: {} } });
    const b = (over: object = {}) => ({ firma_ejecutivo_cuenta_digital: FIRMA, firma_ejecutivo_cuenta_manual: FIRMA, turnos: [], ...over });
    const run = (f: ReturnType<typeof fakeEnv>, body: object, readBody?: () => Promise<any>) => aprobarPermisoSolicitud(f.env, { id: 1, actorId: 5, payload: { id: 5 }, readBody: readBody ?? (async () => body), planillasToken: "tp" });
    it("los reemplazos y el reemplazo obligatorio deben ser números enteros: se revisan ANTES de crear nada en Planillas", async () => {
        for (const bad of [b({ reemplazo_obligatorio: "x" }), b({ reemplazo_obligatorio: 2.5 }), b({ turnos: [{ id: 21, reemplazo_id: "x" }] }), b({ turnos: [{ id: 21, reemplazo_id: -3 }] })]) {
            const f = world(); const r: any = await run(f, bad);
            assert.deepEqual([r.status, r.code], [400, "invalid_request"]);
            assert.equal(f.planillasCalls.length, 0); assert.equal(writes(f.calls).length, 0);
        }
        const ok = world(); assert.equal(((await run(ok, b({ turnos: [{ id: 21, reemplazo_id: 31 }], reemplazo_obligatorio: null }))) as any).ok, true);
    });
    it("un permiso sin turnos se rechaza con un mensaje claro (antes era un error interno)", async () => {
        const f = world({ ...base, turnos: "[]" });
        const r: any = await run(f, b());
        assert.deepEqual([r.status, r.code, r.message], [400, "invalid_state", "La solicitud no tiene turnos"]);
        assert.equal(f.planillasCalls.length, 0);
    });
    it("el cuerpo se lee DESPUÉS de las validaciones, como en la ruta original: registro inexistente o no autorizado no depende de un JSON válido", async () => {
        let leido = false;
        const boom = async () => { leido = true; throw new SyntaxError("JSON inválido"); };
        assert.equal(((await run(fakeEnv(), {}, boom)) as any).code, "not_found");
        assert.equal(((await run(world({ ...base, ejecutivo_cuenta: 99 }), {}, boom)) as any).code, "out_of_scope");
        assert.equal(leido, false);
        await assert.rejects(() => run(world(), {}, boom), SyntaxError);
        assert.equal(leido, true);
    });
});

describe("API de acciones: correcciones de la revisión", () => {
    const env0 = { GUARDIFY_REPORTS_API_KEY: KEY };
    // Guardify manda SOLO la firma manual (imagen); la digital la genera el servidor (issue #194).
    const FIRMA = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";
    const sigs = [{ role: "manual", method: "manual", image: FIRMA }];
    const IDEM = "0123456789abcdef0123";
    const url = (p: string) => `https://app.test${p}`;
    const reqAt = (method: string, p: string, body?: unknown, extra: Record<string, string> = {}, claims?: object) => {
        const text = body === undefined ? undefined : JSON.stringify(body);
        const u = url(p);
        const h = { authorization: `Bearer ${KEY}`, ...extra, ...sign(claims ?? actorClaims({ cedula: "c" }), KEY, binding(method, u, text ?? "")), ...(body !== undefined ? { "content-type": "application/json" } : {}) };
        return new Request(u, { method, headers: h, body: text });
    };
    const permiso = { estado: "pendiente", ejecutivo_cuenta: 5, empleado_id: 8, tipo: "Sin goce", corpo_id: 3, turnos: JSON.stringify([{ id: 21 }]), fecha_inicio: "2026-10-01T00:00:00.000Z", fecha_fin: "2026-10-01T00:00:00.000Z" };
    const mk = (reg: object = permiso, extra: object = {}, actorRow: object = { id: 5, supervisor_id: null, cedula: "c", estado: "A" }) => {
        const f = fakeEnv({ tablas: { c_solicitud_permiso: reg }, empleados: { 5: {}, 8: {} }, ...extra });
        (f.env.prisma as any).c_empleado.findMany = async (a: any) => (a.where.cedula ? [actorRow] : []);
        (f.env.prisma as any).c_empleado.findUnique = async ({ where }: any) => (where.id === 5 ? actorRow : where.id === 8 ? {} : null);
        return f;
    };
    const deps = (f: ReturnType<typeof fakeEnv>) => ({ getEnv: () => f.env, env: env0, now: () => NOW });
    const jsonOf = async (r: Response) => r.json() as Promise<any>;

    it("una firma hecha para otra ruta, otra acción o con otro cuerpo se rechaza (401)", async () => {
        const f = mk();
        const good = reqAt("POST", "/api/guardify/actions/permisos/1/aprobar", { signatures: sigs }, { "idempotency-key": IDEM });
        // Se reutilizan SUS cabeceras en una petición distinta.
        const robadas = Object.fromEntries(["authorization", "x-guardify-actor", "x-guardify-actor-sig", "idempotency-key"].map((k) => [k, good.headers.get(k)!]));
        const otraAccion = new Request(url("/api/guardify/actions/permisos/1/rechazar"), { method: "POST", headers: { ...robadas, "content-type": "application/json" }, body: JSON.stringify({ signatures: sigs }) });
        const otroCuerpo = new Request(url("/api/guardify/actions/permisos/1/aprobar"), { method: "POST", headers: { ...robadas, "content-type": "application/json" }, body: JSON.stringify({ signatures: [] }) });
        const otroId = new Request(url("/api/guardify/actions/permisos/2/aprobar"), { method: "POST", headers: { ...robadas, "content-type": "application/json" }, body: JSON.stringify({ signatures: sigs }) });
        for (const r of [otraAccion, otroCuerpo, otroId]) assert.equal((await handleActionExecute(r, ...(new URL(r.url).pathname.split("/").slice(-3) as [string, string, string]), deps(f))).status, 401);
        assert.equal(writes(f.calls).length, 0);
    });
    it("el tipo y la acción se buscan solo entre los propios (nada de «constructor» o «__proto__»)", async () => {
        const f = mk();
        for (const t of ["constructor", "__proto__", "toString", "hasOwnProperty"]) assert.equal((await handleActionDetail(reqAt("GET", `/x/${t}/1`), t, "1", deps(f))).status, 404, t);
        for (const a of ["constructor", "__proto__", "toString"]) assert.equal((await handleActionExecute(reqAt("POST", `/x/permisos/1/${a}`, {}, { "idempotency-key": IDEM }), "permisos", "1", a, deps(f))).status, 404, a);
        assert.equal(writes(f.calls).length, 0);
    });
    it("un cuerpo enorme se rechaza (413) sin procesarlo", async () => {
        const f = mk();
        const r = await handleActionExecute(reqAt("POST", "/x/permisos/1/aprobar", { x: "a".repeat(MAX_BODY_CHARS + 10) }, { "idempotency-key": IDEM }), "permisos", "1", "aprobar", deps(f));
        assert.equal(r.status, 413); assert.equal(f.calls.length, 0);
    });
    it("el solicitante (o una parte del acuerdo) no resuelve lo suyo, aunque su supervisor sea el ejecutivo", async () => {
        const f = mk({ ...permiso, empleado_id: 5 });
        const d = await jsonOf(await handleActionDetail(reqAt("GET", "/x/permisos/1"), "permisos", "1", deps(f)));
        assert.deepEqual(d.acciones, []);
        const r = await handleActionExecute(reqAt("POST", "/x/permisos/1/aprobar", { signatures: sigs }, { "idempotency-key": IDEM }), "permisos", "1", "aprobar", deps(f));
        const cuerpo = await jsonOf(r);
        assert.deepEqual([r.status, cuerpo.code, cuerpo.message], [403, "out_of_scope", "No puedes resolver un registro en el que eres parte."]);
        assert.equal(f.planillasCalls.length, 0);
        const m = fakeEnv({ tablas: { e_mutuos_acuerdos: { estado: null, ejecutivo_cuenta: 5, ausente_acepta: true, reemplaza_acepta: true, empleadoAusente_id: 3, empleadoReemplaza_id: 12 } }, empleados: { 3: { supervisor_id: 5 } } });
        (m.env.prisma as any).c_empleado.findMany = async (a: any) => (a.where.cedula ? [{ id: 3, supervisor_id: 5, cedula: "c", estado: "A" }] : []);
        assert.deepEqual((await jsonOf(await handleActionDetail(reqAt("GET", "/x/mutuos-acuerdos/1"), "mutuos-acuerdos", "1", deps(m)))).acciones, []);
    });
    it("un empleado dado de baja no actúa; un id que no coincide con su cédula tampoco", async () => {
        const baja = mk(permiso, {}, { id: 5, supervisor_id: null, cedula: "c", estado: "BA" });
        assert.equal((await handleActionDetail(reqAt("GET", "/x/permisos/1"), "permisos", "1", deps(baja))).status, 403);
        const ok = mk();
        const conOtroId = reqAt("GET", "/x/permisos/1", undefined, {}, actorClaims({ cedula: "otra-cedula", externalId: "5" }));
        assert.equal((await handleActionDetail(conOtroId, "permisos", "1", deps(ok))).status, 403);
        const coincide = reqAt("GET", "/x/permisos/1", undefined, {}, actorClaims({ cedula: "c", externalId: "5" }));
        assert.equal((await handleActionDetail(coincide, "permisos", "1", deps(ok))).status, 200);
    });
    it("quien no tiene nada que resolver ve solo el estado: sin turnos, nombres ni historial", async () => {
        const f = mk({ ...permiso, ejecutivo_cuenta: 99 }, { cambios: [{ created_by: 5, cambios: "[]" }] });
        const d = await jsonOf(await handleActionDetail(reqAt("GET", "/x/permisos/1"), "permisos", "1", deps(f)));
        assert.deepEqual([d.acciones, d.datos, d.historial], [[], {}, []]);
        assert.equal(d.estado, "pendiente");
    });
    it("el motivo por el que no se puede es el verdadero: ya firmado → resuelto; mutuo sin aceptar → estado; otro → sin alcance", async () => {
        const call = async (reg: object, tipo = "permisos", accion = "aprobar") => {
            const f = tipo === "permisos" ? mk(reg) : (() => { const x = fakeEnv({ tablas: { e_mutuos_acuerdos: reg }, empleados: { 5: { supervisor_id: 5 } } }); (x.env.prisma as any).c_empleado.findMany = async (a: any) => (a.where.cedula ? [{ id: 5, supervisor_id: 7, cedula: "c", estado: "A" }] : []); return x; })();
            const r = await handleActionExecute(reqAt("POST", `/x/${tipo}/1/${accion}`, { signatures: sigs }, { "idempotency-key": IDEM }), tipo, "1", accion, deps(f));
            return [r.status, (await jsonOf(r)).code];
        };
        assert.deepEqual(await call({ ...permiso, firma_ejecutivo_cuenta_manual: "x" }), [409, "already_resolved"]);
        assert.deepEqual(await call({ estado: null, ejecutivo_cuenta: 7, ausente_acepta: true, reemplaza_acepta: false, empleadoAusente_id: 1, empleadoReemplaza_id: 2 }, "mutuos-acuerdos"), [409, "invalid_state"]);
        assert.deepEqual(await call({ ...permiso, ejecutivo_cuenta: 99 }), [403, "out_of_scope"]);
    });
    it("un fallo de servidor conserva su estado (500), no se disfraza de 400; los de Planillas se traducen", async () => {
        const f = mk(permiso, { planillas: () => ({ success: false }), rows: { e_estructura_sucursal: { 3: {} } } });
        const r = await handleActionExecute(reqAt("POST", "/x/permisos/1/aprobar", { signatures: sigs, params: { turnos: [{ id: 21, reemplazoId: null }] } }, { "idempotency-key": IDEM }), "permisos", "1", "aprobar", deps(f));
        assert.equal(r.status, 500);
        const por = async (st: number) => { const g = mk(permiso, { planillas: () => { throw new PlanillasError(st, "x"); }, rows: { e_estructura_sucursal: { 3: {} } } }); const x = await handleActionExecute(reqAt("POST", "/x/permisos/1/aprobar", { signatures: sigs, params: { turnos: [] } }, { "idempotency-key": IDEM }), "permisos", "1", "aprobar", deps(g)); const c = await jsonOf(x); return [x.status, c.code ?? c.error]; };
        assert.deepEqual(await por(401), [409, "planillas_session_required"]);
        assert.deepEqual(await por(403), [403, "out_of_scope"]);
        assert.deepEqual(await por(422), [400, "invalid_request"]);
        assert.deepEqual(await por(502), [502, "planillas_unavailable"]);
        assert.deepEqual(await por(0), [502, "planillas_unavailable"]);
    });
    it("dos aprobaciones a la vez sobre el mismo registro: la segunda recibe «conflicto» y Planillas se llama una sola vez", async () => {
        let soltar!: () => void;
        const f = mk(permiso, { rows: { e_estructura_sucursal: { 3: {} } }, planillas: () => new Promise((res) => { soltar = () => res({ success: true }); }) as never });
        const lanzar = () => handleActionExecute(reqAt("POST", "/x/permisos/1/aprobar", { signatures: sigs, params: { turnos: [{ id: 21, reemplazoId: null }] } }, { "idempotency-key": IDEM }), "permisos", "1", "aprobar", deps(f));
        const primera = lanzar();
        for (let i = 0; i < 50 && !f.planillasCalls.length; i++) await new Promise((r) => setTimeout(r, 5));
        assert.equal(f.planillasCalls.length, 1, "la primera ya está llamando a Planillas");
        const segunda = await lanzar();
        assert.deepEqual([segunda.status, (await jsonOf(segunda)).code], [409, "conflict"]);
        soltar();
        assert.equal((await primera).status, 200);
        assert.equal(f.planillasCalls.length, 1);
    });
    it("la hora de la acción es la del servidor, no la que mande el cliente", async () => {
        const f = mk(permiso, { rows: { e_estructura_sucursal: { 3: {} } } });
        const r = await handleActionExecute(reqAt("POST", "/x/permisos/1/aprobar", { signatures: sigs, requestedAt: "2020-01-01T00:00:00.000Z", params: { turnos: [{ id: 21, reemplazoId: null }] } }, { "idempotency-key": IDEM }), "permisos", "1", "aprobar", deps(f));
        assert.equal(r.status, 200);
        const cambio = writes(f.calls).find((c) => c.table === "c_cambios_apps_modules")!;
        assert.equal(cambio.data.created_at, "2026-10-26T20:00:00.000Z");
    });
    it("buscar empleado: un código repetido no se adivina (409); uno dado de baja no sale", async () => {
        const arma = (rows: any[]) => { const f = fakeEnv({}); (f.env.prisma as any).c_empleado.findMany = async (a: any) => (a.where.cedula ? [{ id: 5, supervisor_id: null, cedula: "c", estado: "A" }] : rows); return f; };
        const get = (f: ReturnType<typeof fakeEnv>) => handleLookupEmpleado(reqAt("GET", "/x/lookup/empleado?codigo=Z"), deps(f));
        assert.equal((await get(arma([{ id: 1, codigo: "Z" }, { id: 2, codigo: "Z" }]))).status, 409);
        assert.equal((await get(arma([{ id: 1, codigo: "Z", estado: "BA" }]))).status, 404);
        assert.equal((await get(arma([{ id: 1, codigo: "Z", nombre: "n" }]))).status, 200);
    });
});

describe("carga de inventario: datos de entrada", () => {
    const world = () => fakeEnv({ many: { n_articulo_corpo_puesto: [{ id: 1 }], e_estructura_puesto: [{ id: 10, codigo: "P" }] } });
    const fila = (over: object = {}) => ({ codigo_puesto: "P", numero_articulo: 1, cantidad: 1, serie: "S", marca: "M", modelo: "Mo", fecha_entrega: "05-10-2026", ...over });
    it("una fecha que no existe en el calendario (31-02, 29-02 de un año sin bisiesto) es inválida; una real, válida", () => {
        for (const v of ["31-02-2026", "29-02-2026", "31-04-2026", "00-01-2026"]) assert.equal(parseFechaEntregaParts(v), null, v);
        for (const v of ["29-02-2028", "28-02-2026", "31-12-2026"]) assert.notEqual(parseFechaEntregaParts(v), null, v);
    });
    it("`true`, listas y objetos no valen como número; los textos demasiado largos se rechazan; todo con el detalle por fila", async () => {
        const r: any = await cargarInventarioPuesto(world().env, { modo: "validar", planillasToken: null, filas: [fila({ numero_articulo: true }), fila({ cantidad: [5] }), fila({ numero_articulo: {} }), fila({ serie: "s".repeat(121) }), fila({ codigo_puesto: "c".repeat(41) })] });
        assert.equal(r.status, 400); assert.equal(r.errors.length, 5);
        assert.match(r.errors[3], /demasiado largo/);
    });
    it("los números como texto numérico siguen valiendo (así vienen del Excel)", async () => {
        const r: any = await cargarInventarioPuesto(world().env, { modo: "validar", planillasToken: null, filas: [fila({ numero_articulo: "1", cantidad: "2" })] });
        assert.equal(r.ok, true);
    });
});

describe("API de acciones: idempotencia por clave (protocolo de acciones; issues #172 y #181)", () => {
    const env0 = { GUARDIFY_REPORTS_API_KEY: KEY };
    const req = (method: string, headers: Record<string, string>, body?: unknown, url = "https://app.test/x") => { const text = body !== undefined ? JSON.stringify(body) : undefined; return new Request(url, { method, headers: { ...finalize(headers, method, url, text ?? ""), ...(body !== undefined ? { "content-type": "application/json" } : {}) }, body: text }); };
    const H = (k = IDEM) => ({ ...goodHeaders(), "idempotency-key": k });
    const jsonOf = async (r: Response) => r.json() as Promise<any>;
    const mk = (tablas: Record<string, any> = { c_solicitud_permiso: { estado: "pendiente", ejecutivo_cuenta: 5, empleado_id: 8 } }, extra: object = {}) => {
        const f = fakeEnv({ ...extra, tablas, empleados: { 5: { nombre: "e" }, 8: {} }, many: { n_articulo_corpo_puesto: [{ id: 1 }], e_estructura_puesto: [{ id: 10, codigo: "P-A" }], e_estructura_articulo_corpo_puesto_plan: [], e_estructura_articulo_corpo_puesto_entrega: [] } });
        (f.env.prisma as any).c_empleado.findMany = async (a: any) => (a.where.cedula ? [{ id: 5, supervisor_id: null }] : []);
        return f;
    };
    const conAlmacen = (f: ReturnType<typeof fakeEnv>, idempotency: IdempotencyStore = memoryIdempotencyStore()) => ({ deps: { getEnv: () => f.env, env: env0, now: () => NOW, idempotency: () => idempotency }, idempotency: idempotency as ReturnType<typeof memoryIdempotencyStore> });
    const rechazar = (d: any, id = "1", accion = "rechazar", key = IDEM) => handleActionExecute(req("POST", H(key), accion === "aprobar" ? { signatures: [{ role: "manual", method: "manual", image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==" }] } : {}), "permisos", id, accion, d);
    const fila = { codigo_puesto: "P-A", numero_articulo: 1, cantidad: 2, serie: "S1", marca: "M1", modelo: "Mo1", fecha_entrega: "05-10-2026" };
    // Guardify manda SOLO la firma manual (imagen); la digital la genera el servidor (issue #194).
    const FIRMA = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";
    const sigs = [{ role: "manual", method: "manual", image: FIRMA }];
    const conTurnos = { c_solicitud_permiso: { estado: "pendiente", ejecutivo_cuenta: 5, empleado_id: 8, tipo: "Sin goce", corpo_id: 3, turnos: JSON.stringify([{ id: 21 }]), fecha_inicio: "2026-10-01T00:00:00.000Z", fecha_fin: "2026-10-01T00:00:00.000Z" } };
    const sucursal = { rows: { e_estructura_sucursal: { 3: {} } } };

    it("el reintento con la misma clave devuelve el mismo resultado y el efecto ocurre una sola vez", async () => {
        const f = mk();
        const { deps } = conAlmacen(f);
        const a = await rechazar(deps);
        const antes = writes(f.calls).length;
        const b = await rechazar(deps);
        assert.equal(a.status, 200);
        assert.equal(b.status, 200);
        assert.deepEqual(await jsonOf(b), await jsonOf(a));
        assert.equal(b.headers.get("idempotent-replay"), "true");
        assert.ok(antes > 0, "la primera sí escribió");
        assert.equal(writes(f.calls).length, antes, "el reintento no escribió nada");
    });
    it("aunque otra persona haya cambiado el registro después, el reintento recibe el resultado original (no «ya resuelto»)", async () => {
        const f = mk();
        const { deps } = conAlmacen(f);
        const a = await rechazar(deps);
        const original = await jsonOf(a);
        f.env.call = async (d) => (d.action === "GET" ? { estado: "aprobado", ejecutivo_cuenta: 5, empleado_id: 8 } : {});
        const b = await rechazar(deps);
        assert.deepEqual([b.status, await jsonOf(b)], [200, original]);
    });
    it("la misma clave con otra acción u otro registro es 409 conflict y no ejecuta", async () => {
        const f = mk();
        const { deps } = conAlmacen(f);
        await rechazar(deps);
        const antes = writes(f.calls).length;
        for (const [id, accion] of [["1", "aprobar"], ["2", "rechazar"]] as const) {
            const r = await rechazar(deps, id, accion);
            assert.deepEqual([r.status, (await jsonOf(r)).code], [409, "conflict"], `${id}/${accion}`);
        }
        assert.equal(writes(f.calls).length, antes);
    });
    it("un resultado que no es 2xx no se recuerda: la clave se puede reintentar (la persona abre sesión en Planillas y reintenta)", async () => {
        const f = mk(conTurnos, sucursal);
        const { deps, idempotency } = conAlmacen(f);
        f.env.tokenPlanillas = async () => null;
        const sin = await handleActionExecute(req("POST", H(), { signatures: sigs }), "permisos", "1", "aprobar", deps);
        assert.deepEqual([sin.status, (await jsonOf(sin)).code], [409, "planillas_session_required"]);
        assert.equal(idempotency.rows.size, 0, "no quedó reservada");
        f.env.tokenPlanillas = async () => "token-estructural";
        const con = await handleActionExecute(req("POST", H(), { signatures: sigs }), "permisos", "1", "aprobar", deps);
        assert.notEqual((await jsonOf(con)).code, "planillas_session_required", "con sesión de Planillas la misma clave ya sigue adelante");
    });
    it("una clave mal formada es 400 invalid_request", async () => {
        const f = mk();
        const { deps } = conAlmacen(f);
        for (const k of ["corta", "con espacios dentro 12345", "x".repeat(129)]) {
            const r = await rechazar(deps, "1", "rechazar", k);
            assert.deepEqual([r.status, (await jsonOf(r)).code], [400, "invalid_request"], k);
        }
    });
    it("si el almacén no está disponible la acción NO se ejecuta: 503 sin code (Guardify lo lee como «no disponible»)", async () => {
        const f = mk();
        const caido: IdempotencyStore = { reservar: async () => { throw new Error("tabla ausente"); }, leer: async () => null, completar: async () => undefined, liberar: async () => undefined };
        const { deps } = conAlmacen(f, caido);
        const r = await rechazar(deps);
        const cuerpo = await jsonOf(r);
        assert.equal(r.status, 503);
        assert.equal(cuerpo.code, undefined);
        assert.equal(cuerpo.error, "store_unavailable");
        assert.equal(writes(f.calls).length, 0);
    });
    it("un error de Planillas (lanzado) libera la clave y se traduce como siempre", async () => {
        const f = mk(conTurnos, sucursal);
        const { deps, idempotency } = conAlmacen(f);
        f.env.planillas = async () => { throw new PlanillasError(503, "caída"); };
        const r = await handleActionExecute(req("POST", H(), { signatures: sigs }), "permisos", "1", "aprobar", deps);
        assert.equal(r.status, 502);
        assert.equal(idempotency.rows.size, 0);
    });
    it("carga masiva `aplicar` con clave: el reintento no vuelve a llamar a Planillas; sin clave se rechaza; `validar` no reserva nada", async () => {
        const f = mk();
        const { deps, idempotency } = conAlmacen(f);
        const imp = (body: unknown, h: Record<string, string>) => handleImport(req("POST", h, body), "inventario-puesto", deps);
        const a = await imp({ modo: "aplicar", filas: [fila] }, H());
        const b = await imp({ modo: "aplicar", filas: [fila] }, H());
        assert.deepEqual([a.status, b.status], [200, 200]);
        assert.equal(b.headers.get("idempotent-replay"), "true");
        assert.equal(f.planillasCalls.length, 1, "Planillas recibió la carga una sola vez");
        const sinClave = await imp({ modo: "aplicar", filas: [fila] }, goodHeaders());
        assert.equal(sinClave.status, 400, "sin clave, «aplicar» se rechaza (issue #197)");
        const antes = idempotency.rows.size;
        await imp({ modo: "validar", filas: [fila] }, H("otra-clave-de-prueba-01"));
        assert.equal(idempotency.rows.size, antes, "validar no deja reservas");
    });
});

describe("API de acciones: evidencia «Guardify», firmas, errores tipados y candados (issues #193 a #197)", () => {
    const env0 = { GUARDIFY_REPORTS_API_KEY: KEY };
    const req = (method: string, headers: Record<string, string>, body?: unknown, url = "https://app.test/x") => { const text = body !== undefined ? JSON.stringify(body) : undefined; return new Request(url, { method, headers: { ...finalize(headers, method, url, text ?? ""), ...(body !== undefined ? { "content-type": "application/json" } : {}) }, body: text }); };
    const H = (k = IDEM) => ({ ...goodHeaders(), "idempotency-key": k });
    const IDEM2 = "abcdef0123456789abcd";
    const jsonOf = async (r: Response) => r.json() as Promise<any>;
    const FIRMA = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";
    const sigs = [{ role: "manual", method: "manual", image: FIRMA }];
    const permiso = (over: object = {}) => ({ estado: "pendiente", ejecutivo_cuenta: 5, empleado_id: 8, tipo: "Sin goce", corpo_id: 3, turnos: JSON.stringify([{ id: 21 }]), fecha_inicio: "2026-10-01T00:00:00.000Z", fecha_fin: "2026-10-01T00:00:00.000Z", ...over });
    const mk = (reg: Record<string, any> = permiso(), extra: object = {}) => {
        const f = fakeEnv({ tablas: { c_solicitud_permiso: reg }, empleados: { 5: { nombre: "e" }, 8: {} }, rows: { e_estructura_sucursal: { 3: {} } }, many: { n_articulo_corpo_puesto: [{ id: 1 }], e_estructura_puesto: [{ id: 10, codigo: "P-A" }, { id: 11, codigo: "P-B" }], e_estructura_articulo_corpo_puesto_plan: [], e_estructura_articulo_corpo_puesto_entrega: [] }, ...extra });
        (f.env.prisma as any).c_empleado.findMany = async (a: any) => (a.where.cedula ? [{ id: 5, supervisor_id: null, cedula: "c1" }] : []);
        // El registro cambia de verdad cuando se actualiza (como la base real): lo necesitan las pruebas de dos peticiones sobre lo mismo.
        const call = f.env.call;
        f.env.call = async (d) => { const r = await call(d); if (d.action === "UPDATE" && d.table === "c_solicitud_permiso") Object.assign(reg, d.data); return r; };
        return f;
    };
    const evid = (f: ReturnType<typeof fakeEnv>) => f.calls.filter((c) => c.table === "c_evidencia_registro");
    const conAlmacen = (f: ReturnType<typeof fakeEnv>, store = memoryIdempotencyStore(), extra: object = {}) => ({ deps: { getEnv: () => f.env, env: env0, now: () => NOW, idempotency: () => store as IdempotencyStore, ...extra }, store });
    const aprobar = (d: any, key = IDEM, body: object = { signatures: sigs }) => handleActionExecute(req("POST", H(key), body), "permisos", "1", "aprobar", d);
    const fila = { codigo_puesto: "P-A", numero_articulo: 1, cantidad: 2, serie: "S1", marca: "M1", modelo: "Mo1", fecha_entrega: "05-10-2026" };
    const huellaDe = (r: Request) => crypto.createHash("sha256").update(r.headers.get("x-guardify-actor-sig")!, "utf8").digest("hex");

    describe("#193 · evidencia con origen «Guardify»", () => {
        it("aprobar y rechazar un permiso dejan exactamente UNA fila: origen, actor, tabla, registro y la huella de la petición firmada, sin datos de dispositivo", async () => {
            const f = mk();
            const { deps } = conAlmacen(f);
            const peticion = req("POST", H(), { signatures: sigs });
            const r = await handleActionExecute(peticion, "permisos", "1", "aprobar", deps);
            assert.equal(r.status, 200);
            const filas = evid(f);
            assert.equal(filas.length, 1);
            const d = filas[0]!.data;
            assert.deepEqual([d.tabla, d.registro_id, d.accion, d.ubicacion_origen, d.usuario_id, d.cedula], ["c_solicitud_permiso", 1, "UPDATE", "guardify", 5, "c1"]);
            assert.deepEqual([d.dispositivo_id, d.latitud, d.longitud], [null, null, null], "sin datos de dispositivo ni ubicación");
            assert.equal(d.sesion_id, huellaDe(peticion), "la huella de lo que Guardify firmó");
            assert.match(d.firma, /^[0-9a-f]{64}$/);
            assert.equal((await jsonOf(r)).evidencia, "registrada");
            // Rechazar otro permiso: otra fila.
            const g = mk(permiso());
            const rr = await handleActionExecute(req("POST", H(IDEM2), {}), "permisos", "1", "rechazar", conAlmacen(g).deps);
            assert.equal(rr.status, 200);
            assert.equal(evid(g).length, 1);
        });
        it("también un mutuo acuerdo (su tabla) y la carga `aplicar` (un registro por puesto que recibió algo, en una sola escritura)", async () => {
            const m = fakeEnv({ tablas: { e_mutuos_acuerdos: { estado: null, ejecutivo_cuenta: 5, ausente_acepta: true, reemplaza_acepta: true, empleadoAusente_id: 11, empleadoReemplaza_id: 12, fecha_ausente: "2026-10-01", fecha_reemplaza: "2026-10-02" }, n_ejecutivo_cuenta_coordinador: { coordinador_id: 77 } }, empleados: { 3: { supervisor_id: 5 } }, rows: { c_cambio_guardia: { 1: { id: 1 } } } });
            (m.env.prisma as any).c_empleado.findMany = async (a: any) => (a.where.cedula ? [{ id: 3, supervisor_id: 5, cedula: "c3" }] : []);
            const rm = await handleActionExecute(req("POST", H(), { signatures: sigs }), "mutuos-acuerdos", "1", "aprobar", conAlmacen(m).deps);
            assert.equal(rm.status, 200);
            assert.deepEqual(evid(m).map((c) => [c.data.tabla, c.data.registro_id, c.data.usuario_id]), [["e_mutuos_acuerdos", 1, 3]]);

            const f = mk();
            const { deps } = conAlmacen(f);
            const r = await handleImport(req("POST", H(), { modo: "aplicar", filas: [fila, { ...fila, codigo_puesto: "P-B" }] }), "inventario-puesto", deps);
            assert.equal(r.status, 200);
            const e = evid(f);
            assert.equal(e.length, 1, "una sola escritura");
            assert.equal(e[0]!.operation, "createMany");
            assert.deepEqual(e[0]!.data.map((x: any) => [x.tabla, x.registro_id, x.ubicacion_origen, x.usuario_id]), [["e_estructura_puesto", 10, "guardify", 5], ["e_estructura_puesto", 11, "guardify", 5]]);
            assert.equal((await jsonOf(r)).evidencia, "registrada");
        });
        it("el reintento con la misma Idempotency-Key NO crea otra fila; `validar` y una acción que falla no dejan evidencia", async () => {
            const f = mk();
            const { deps } = conAlmacen(f);
            await aprobar(deps);
            const otra = await aprobar(deps);
            assert.equal(otra.headers.get("idempotent-replay"), "true");
            assert.equal(evid(f).length, 1, "el reintento no repite la evidencia");
            const g = mk();
            await handleImport(req("POST", H(), { modo: "validar", filas: [fila] }), "inventario-puesto", conAlmacen(g).deps);
            assert.equal(evid(g).length, 0);
            const h = mk(permiso({ estado: "aprobado" }));
            const nope = await aprobar(conAlmacen(h).deps);
            assert.equal(nope.status, 409);
            assert.equal(evid(h).length, 0, "una acción rechazada no deja evidencia");
        });
        it("si NO se puede escribir la evidencia: la acción no se revierte, se reintenta una vez, queda en el registro de errores y la respuesta lo dice", async () => {
            const f = mk();
            const call = f.env.call;
            let intentos = 0;
            f.env.call = async (d) => { if (d.table === "c_evidencia_registro") { intentos++; throw new Error("sin base"); } return call(d); };
            const r = await aprobar(conAlmacen(f).deps);
            assert.equal(r.status, 200, "la aprobación ya se aplicó");
            assert.equal((await jsonOf(r)).evidencia, "pendiente");
            assert.equal(f.planillasCalls.length, 1);
            assert.ok(f.reports.some(([status, msg]) => status === 500 && /No se pudo registrar la evidencia/.test(msg) && /c_solicitud_permiso 1/.test(msg)), "con lo necesario para reconstruir la fila");
            assert.equal(intentos, 2, "un reintento");
        });
    });

    describe("#194 · firma digital del servidor y firma manual como imagen", () => {
        it("la digital es determinista (mismo actor y misma petición firmada) y distinta si cambia la petición o el actor; tiene la forma de la que arma la app", () => {
            const a = firmaDigitalDeActor(5, "a".repeat(64), 1_700_000_000_000);
            assert.equal(firmaDigitalDeActor(5, "a".repeat(64), 1_700_000_000_000), a);
            assert.notEqual(firmaDigitalDeActor(5, "b".repeat(64), 1_700_000_000_000), a);
            assert.notEqual(firmaDigitalDeActor(6, "a".repeat(64), 1_700_000_000_000), a);
            const d = decodificarFirmaCaptura(a)!;
            assert.deepEqual([d.sessionId, d.empleadoId, d.latitud, d.longitud, d.timestamp], [`guardify-${"a".repeat(16)}`, "5", "", "", 1_700_000_000_000]);
            assert.ok(a.length >= 10);
        });
        it("la que se guarda sale de la petición firmada: la misma petición da la misma digital; el cliente no puede mandarla", async () => {
            const guardadas: string[] = [];
            for (let i = 0; i < 2; i++) {
                const f = mk();
                const r = await aprobar(conAlmacen(f).deps);
                assert.equal(r.status, 200);
                guardadas.push(writes(f.calls).find((c) => c.table === "c_solicitud_permiso")!.data.firma_ejecutivo_cuenta_digital);
            }
            assert.equal(guardadas[0], guardadas[1], "determinista");
            const f = mk();
            const r = await aprobar(conAlmacen(f).deps, IDEM, { signatures: [{ role: "digital", method: "digital", image: FIRMA }, ...sigs] });
            assert.deepEqual([r.status, (await jsonOf(r)).code], [400, "invalid_request"]);
            assert.equal(f.planillasCalls.length, 0);
        });
        it("la manual: solo data:image/png|jpeg en base64 y dentro del tope; faltante = signature_required; otra cosa o demasiado grande = invalid_request", () => {
            assert.deepEqual(validarFirmaManual(FIRMA), { ok: true, image: FIRMA });
            assert.equal((validarFirmaManual("data:image/jpeg;base64,/9j/4AAQSkZJRg==") as any).ok, true);
            for (const falta of [undefined, null, "", "   ", 5]) assert.equal((validarFirmaManual(falta) as any).code, "signature_required", String(falta));
            for (const mala of ["firma-con-mas-de-diez-caracteres", "data:image/gif;base64,AAAA", "data:image/svg+xml;base64,AAAA", "data:text/html;base64,AAAA", "data:image/png;base64,", "data:image/png;base64,%%%%", "data:image/png,AAAA"]) assert.equal((validarFirmaManual(mala) as any).code, "invalid_request", mala);
            const grande = `data:image/png;base64,${"A".repeat(FIRMA_MANUAL_MAX_CHARS)}`;
            assert.match((validarFirmaManual(grande) as any).message, /demasiado grande/);
            assert.equal((validarFirmaManual(`data:image/png;base64,${"A".repeat(FIRMA_MANUAL_MAX_CHARS - 30)}`) as any).ok, true, "justo bajo el tope");
        });
        it("una petición con firmas mal formadas no consume la clave de idempotencia", async () => {
            const f = mk();
            const { deps, store } = conAlmacen(f);
            const mala = await aprobar(deps, IDEM, { signatures: [] });
            assert.equal(mala.status, 400);
            assert.equal(store.rows.size, 0);
            assert.equal((await aprobar(deps)).status, 200, "la misma clave, ya bien formada, sí procede");
        });
    });

    describe("#195 · carga masiva: un solo tope y conteo honesto", () => {
        it("el tope es 2.000 filas, exportado y el mismo en la lógica compartida; 2.000 pasan y 2.001 se rechazan con el mensaje del tope", async () => {
            assert.equal(INVENTARIO_MAX_FILAS, 2000);
            assert.equal(IMPORT_MAX_ROWS, INVENTARIO_MAX_FILAS);
            const f = mk();
            const { deps } = conAlmacen(f);
            const filas = (n: number) => Array.from({ length: n }, (_, i) => ({ ...fila, serie: `S${i}` }));
            const ok = await handleImport(req("POST", H(), { modo: "validar", filas: filas(2000) }), "inventario-puesto", deps);
            assert.equal(ok.status, 200);
            const demasiadas = await handleImport(req("POST", H(), { modo: "validar", filas: filas(2001) }), "inventario-puesto", deps);
            const b = await jsonOf(demasiadas);
            assert.deepEqual([demasiadas.status, b.code], [400, "invalid_request"]);
            assert.match(b.message, /máximo 2000 por carga/);
        });
        it("filas con el mismo puesto y artículo y series distintas: una viaja y las demás se informan como omitidas con su motivo y su fila; todo suma lo recibido", async () => {
            const f = mk();
            const { deps } = conAlmacen(f);
            const r = await handleImport(req("POST", H(), { modo: "aplicar", filas: [fila, { ...fila, serie: "S2" }, { ...fila, serie: "S3" }, { ...fila, codigo_puesto: "P-B" }] }), "inventario-puesto", deps);
            const b = await jsonOf(r);
            assert.deepEqual(b.filas.map((x: any) => [x.fila, x.estado]), [[1, "creada"], [2, "omitida"], [3, "omitida"], [4, "creada"]]);
            assert.match(b.filas[1].motivo, /ya viaja la fila 1/);
            assert.deepEqual(b.resumen, { recibidas: 4, creadas: 2, omitidas: 2, errores: 0 });
            assert.equal(b.resumen.creadas + b.resumen.omitidas + b.resumen.errores, b.resumen.recibidas);
            assert.deepEqual(b.creados, { planes: 2, entregas: 2 }, "el conteo coincide con lo que llega a Planillas");
            const enviados = f.planillasCalls[0]!.body.items;
            assert.deepEqual(enviados.map((i: any) => [i.codigo_puesto, i.serie]), [["P-A", "S1"], ["P-B", "S1"]]);
            assert.equal(b.omitidos.length, 2, "y siguen las líneas de texto de siempre");
        });
        it("una fila repetida igual dentro de la misma carga se informa como repetida; repetir la carga no duplica y el conteo coincide", async () => {
            const f = mk();
            const { deps } = conAlmacen(f);
            const r = await handleImport(req("POST", H(), { modo: "validar", filas: [fila, { ...fila }] }), "inventario-puesto", deps);
            const b = await jsonOf(r);
            assert.deepEqual(b.filas.map((x: any) => x.estado), ["creada", "omitida"]);
            assert.match(b.filas[1].motivo, /Repetida en la carga: igual a la fila 1/);
            // Con todo ya cargado en la base: todas omitidas, nada que enviar, nada que contar.
            const g = mk(permiso(), { many: { n_articulo_corpo_puesto: [{ id: 1 }], e_estructura_puesto: [{ id: 10, codigo: "P-A" }], e_estructura_articulo_corpo_puesto_plan: [{ puesto_id: 10, articuloCP_id: 1 }], e_estructura_articulo_corpo_puesto_entrega: [{ puesto_id: 10, nomencladorArticuloCP_id: 1, marca: "M1", serie: "S1", modelo: "Mo1" }] } });
            const otra = await jsonOf(await handleImport(req("POST", H(), { modo: "aplicar", filas: [fila] }), "inventario-puesto", conAlmacen(g).deps));
            assert.deepEqual([otra.creados, otra.resumen], [{ planes: 0, entregas: 0 }, { recibidas: 1, creadas: 0, omitidas: 1, errores: 0 }]);
            assert.equal(g.planillasCalls.length, 0);
        });
        it("el error de Planillas sale como «planillas_unavailable» con HTTP 502, no como invalid_request con 500", async () => {
            const f = mk(permiso(), { planillas: () => ({ success: false }) });
            const r = await handleImport(req("POST", H(), { modo: "aplicar", filas: [fila] }), "inventario-puesto", conAlmacen(f).deps);
            assert.deepEqual([r.status, (await jsonOf(r)).code], [502, "planillas_unavailable"]);
        });
    });

    describe("#196 · todo error 4xx lleva `code`", () => {
        const PROTOCOLO = new Set(["not_found", "already_resolved", "invalid_state", "conflict", "out_of_scope", "reason_required", "signature_required", "planillas_session_required", "invalid_request", "unauthorized"]);
        const ejecutar = (f: ReturnType<typeof fakeEnv>, headers: Record<string, string>, over: { tipo?: string; id?: string; accion?: string; body?: unknown } = {}) =>
            handleActionExecute(req("POST", headers, over.body ?? { signatures: sigs }), over.tipo ?? "permisos", over.id ?? "1", over.accion ?? "aprobar", conAlmacen(f).deps);

        it("cada rama del 401 (sin llave, llave mala, sin actor, actor vencido, firma de otra ruta o de otro cuerpo) responde { code: \"unauthorized\", message } (y `error` como alias)", async () => {
            const f = mk();
            const deps = conAlmacen(f).deps;
            const mala = { authorization: `Bearer ${"x".repeat(32)}` };
            const buenaSinActor = { authorization: `Bearer ${KEY}` };
            const vencido = { authorization: `Bearer ${KEY}`, "x-test-actor": JSON.stringify({ actor: { email: "a@b.co", name: "n", cedula: "c" }, ts: NOW - ACTOR_MAX_SKEW_MS - 1000, tenant: "t" }) };
            const casos: Array<[string, Response]> = [
                ["sin llave", await handleActionExecute(req("POST", {}, { signatures: sigs }), "permisos", "1", "aprobar", deps)],
                ["llave mala", await handleActionExecute(req("POST", mala, { signatures: sigs }), "permisos", "1", "aprobar", deps)],
                ["sin actor", await handleActionExecute(req("POST", buenaSinActor, { signatures: sigs }), "permisos", "1", "aprobar", deps)],
                ["actor vencido", await handleActionExecute(req("POST", { ...vencido, "idempotency-key": IDEM }, { signatures: sigs }), "permisos", "1", "aprobar", deps)],
            ];
            // Firma hecha para OTRA ruta o para OTRO cuerpo: se reutilizan las cabeceras firmadas de una petición en otra.
            const ajena = req("POST", H(), { signatures: sigs }, "https://app.test/otra");
            const robadas = Object.fromEntries(["authorization", "x-guardify-actor", "x-guardify-actor-sig", "idempotency-key"].map((k) => [k, ajena.headers.get(k)!]));
            casos.push(["firma de otra ruta", await handleActionExecute(new Request("https://app.test/x", { method: "POST", headers: { ...robadas, "content-type": "application/json" }, body: JSON.stringify({ signatures: sigs }) }), "permisos", "1", "aprobar", deps)]);
            casos.push(["firma de otro cuerpo", await handleActionExecute(new Request("https://app.test/otra", { method: "POST", headers: { ...robadas, "content-type": "application/json" }, body: JSON.stringify({ signatures: sigs, otro: true }) }), "permisos", "1", "aprobar", deps)]);
            for (const [nombre, r] of casos) {
                const b = await jsonOf(r);
                assert.deepEqual([nombre, r.status, b.code, b.error], [nombre, 401, "unauthorized", "unauthorized"]);
                assert.equal(typeof b.message, "string");
            }
            // Las otras rutas también.
            for (const r of [await handleActionDetail(req("GET", {}), "permisos", "1", deps), await handleLookupEmpleado(req("GET", mala), deps), await handleImport(req("POST", mala, { modo: "validar", filas: [fila] }), "inventario-puesto", deps)]) {
                assert.deepEqual([r.status, (await jsonOf(r)).code], [401, "unauthorized"]);
            }
        });
        it("la API sin configurar sigue siendo un 503 SIN code (infraestructura: Guardify lo lee como «app no disponible»)", async () => {
            const r = await handleActionExecute(req("POST", H(), { signatures: sigs }), "permisos", "1", "aprobar", { getEnv: () => mk().env, env: { GUARDIFY_REPORTS_API_KEY: "corta" }, now: () => NOW });
            const b = await jsonOf(r);
            assert.deepEqual([r.status, b.code, b.error], [503, undefined, "not_configured"]);
        });
        it("recorre las respuestas 4xx del manejador y todas traen un `code` de la lista del protocolo", async () => {
            const buena = H();
            const sinClave = goodHeaders();
            const mkSinActor = () => { const f = mk(); (f.env.prisma as any).c_empleado.findMany = async () => []; return f; };
            const mkSinRegistro = () => { const f = mk(); f.env.call = async () => null; return f; };
            const mkSinSesionPlanillas = () => { const f = mk(); f.env.tokenPlanillas = async () => null; return f; };
            const respuestas: Array<[string, Response]> = [
                ["ejecutar: sin clave de idempotencia", await ejecutar(mk(), sinClave)],
                ["ejecutar: clave inválida", await ejecutar(mk(), H("corta"))],
                ["ejecutar: acción que no existe", await ejecutar(mk(), buena, { accion: "inventada" })],
                ["ejecutar: tipo desconocido", await ejecutar(mk(), buena, { tipo: "inventado" })],
                ["ejecutar: id inválido", await ejecutar(mk(), buena, { id: "no-numero" })],
                ["ejecutar: actor sin resolver", await ejecutar(mkSinActor(), buena)],
                ["ejecutar: registro inexistente", await ejecutar(mkSinRegistro(), buena)],
                ["ejecutar: fuera de alcance", await ejecutar(mk(permiso({ ejecutivo_cuenta: 99 })), buena)],
                ["ejecutar: ya resuelto", await ejecutar(mk(permiso({ estado: "aprobado" })), buena)],
                ["ejecutar: sin firma manual", await ejecutar(mk(), buena, { body: { signatures: [] } })],
                ["ejecutar: digital del cliente", await ejecutar(mk(), buena, { body: { signatures: [{ role: "digital", image: FIRMA }, ...sigs] } })],
                ["ejecutar: cuerpo gigante", await ejecutar(mk(), buena, { body: { signatures: sigs, relleno: "x".repeat(MAX_BODY_CHARS) } })],
                ["ejecutar: sin sesión de Planillas", await ejecutar(mkSinSesionPlanillas(), buena)],
                ["detalle: tipo desconocido", await handleActionDetail(req("GET", goodHeaders()), "inventado", "1", conAlmacen(mk()).deps)],
                ["detalle: id inválido", await handleActionDetail(req("GET", goodHeaders()), "permisos", "0", conAlmacen(mk()).deps)],
                ["carga: modo inválido", await handleImport(req("POST", buena, { modo: "ya", filas: [fila] }), "inventario-puesto", conAlmacen(mk()).deps)],
                ["carga: sin filas", await handleImport(req("POST", buena, { modo: "validar", filas: [] }), "inventario-puesto", conAlmacen(mk()).deps)],
                ["carga: sobre el tope", await handleImport(req("POST", buena, { modo: "validar", filas: Array.from({ length: IMPORT_MAX_ROWS + 1 }, () => fila) }), "inventario-puesto", conAlmacen(mk()).deps)],
                ["carga: tipo desconocido", await handleImport(req("POST", buena, { modo: "validar", filas: [fila] }), "otra", conAlmacen(mk()).deps)],
                ["carga: aplicar sin clave", await handleImport(req("POST", sinClave, { modo: "aplicar", filas: [fila] }), "inventario-puesto", conAlmacen(mk()).deps)],
                ["carga: fila con error", await handleImport(req("POST", buena, { modo: "validar", filas: [{ ...fila, serie: "" }] }), "inventario-puesto", conAlmacen(mk()).deps)],
                ["carga: artículo inexistente", await handleImport(req("POST", buena, { modo: "validar", filas: [{ ...fila, numero_articulo: 99 }] }), "inventario-puesto", conAlmacen(mk()).deps)],
                ["carga: puesto inexistente", await handleImport(req("POST", buena, { modo: "validar", filas: [{ ...fila, codigo_puesto: "NO" }] }), "inventario-puesto", conAlmacen(mk()).deps)],
                ["carga: sin sesión de Planillas", await handleImport(req("POST", buena, { modo: "aplicar", filas: [fila] }), "inventario-puesto", conAlmacen((() => { const f = mk(); f.env.tokenPlanillas = async () => null; return f; })()).deps)],
                ["buscar empleado: sin código", await handleLookupEmpleado(req("GET", goodHeaders(), undefined, "https://app.test/x?codigo="), conAlmacen(mk()).deps)],
                ["buscar empleado: no existe", await handleLookupEmpleado(req("GET", goodHeaders(), undefined, "https://app.test/x?codigo=ZZ"), conAlmacen(mk()).deps)],
            ];
            const sin4xx: string[] = [];
            const fuera: string[] = [];
            for (const [nombre, r] of respuestas) {
                if (r.status < 400 || r.status >= 500) { sin4xx.push(`${nombre} → ${r.status}`); continue; }
                const b = await jsonOf(r);
                if (typeof b.code !== "string" || !PROTOCOLO.has(b.code)) fuera.push(`${nombre} → ${r.status} ${JSON.stringify(b.code)}`);
            }
            assert.deepEqual(sin4xx, [], "cada escenario debe producir un 4xx");
            assert.deepEqual(fuera, []);
        });
        it("`unauthorized` está en la tabla de códigos y en el mapa de estados del manejador", () => {
            const fuente = fs.readFileSync(path.join(__dirname, "handler.ts"), "utf8");
            assert.match(fuente, /unauthorized: 401/);
            assert.match(fuente, /planillas_unavailable: 502/);
            for (const doc of ["protocolo-acciones.md", "guardify-actions-api.md"]) assert.match(fs.readFileSync(path.join(__dirname, "..", "..", "docs", doc), "utf8"), /unauthorized/, doc);
        });
    });

    describe("#197 · candado entre procesos también sin clave y con claves distintas", () => {
        const desbloqueo = () => { let soltar!: () => void; const espera = new Promise<void>((r) => (soltar = r)); return { espera, soltar }; };

        it("dos `aplicar` simultáneos con la MISMA clave: uno ejecuta y el otro recibe 409; Planillas recibe una sola carga", async () => {
            const { espera, soltar } = desbloqueo();
            const f = mk(permiso(), { planillas: async () => { await espera; return { success: true, data: { id: 1 } }; } });
            const { deps } = conAlmacen(f);
            const primera = handleImport(req("POST", H(), { modo: "aplicar", filas: [fila] }), "inventario-puesto", deps);
            await new Promise((r) => setTimeout(r, 30));
            const segunda = await handleImport(req("POST", H(), { modo: "aplicar", filas: [fila] }), "inventario-puesto", deps);
            assert.deepEqual([segunda.status, (await jsonOf(segunda)).code], [409, "conflict"]);
            soltar();
            assert.equal((await primera).status, 200);
            assert.equal(f.planillasCalls.length, 1);
        });
        it("`aplicar` sin clave: 400 y no se toca Planillas", async () => {
            const f = mk();
            const r = await handleImport(req("POST", goodHeaders(), { modo: "aplicar", filas: [fila] }), "inventario-puesto", conAlmacen(f).deps);
            assert.deepEqual([r.status, (await jsonOf(r)).code], [400, "invalid_request"]);
            assert.equal(f.planillasCalls.length, 0);
        });
        it("dos aprobaciones del mismo permiso con claves DISTINTAS: una aplica y la otra espera y recibe «already_resolved»; Planillas recibe UNA sola creación", async () => {
            const { espera, soltar } = desbloqueo();
            const f = mk(permiso(), { planillas: async () => { await espera; return { success: true, data: { id: 1 } }; } });
            const { deps, store } = conAlmacen(f);
            const a = aprobar(deps, IDEM);
            await new Promise((r) => setTimeout(r, 30));
            const b = aprobar(deps, IDEM2);
            await new Promise((r) => setTimeout(r, 120));
            soltar();
            const [ra, rb] = [await a, await b];
            assert.equal(ra.status, 200);
            assert.deepEqual([rb.status, (await jsonOf(rb)).code], [409, "already_resolved"]);
            assert.equal(f.planillasCalls.length, 1, "Planillas recibe una sola creación");
            assert.equal([...store.rows.values()].filter((r) => r.ambito === "candado").length, 0, "el candado se libera al terminar");
        });
        it("el candado ENTRE procesos: otra instancia con el mismo almacén también espera (el candado en memoria de una no basta)", async () => {
            const { espera, soltar } = desbloqueo();
            const store = memoryIdempotencyStore();
            const f1 = mk(permiso(), { planillas: async () => { await espera; return { success: true, data: { id: 1 } }; } });
            const a = aprobar(conAlmacen(f1, store).deps, IDEM);
            await new Promise((r) => setTimeout(r, 30));
            // La reserva del candado vive en el almacén COMPARTIDO (la tabla), no solo en la memoria de este proceso: otra instancia la encontraría ocupada.
            const candados = [...store.rows.values()].filter((r) => r.ambito === "candado");
            assert.deepEqual(candados.map((c) => [c.estado, c.recurso]), [["en_curso", "permisos:1"]]);
            soltar();
            assert.equal((await a).status, 200);
            assert.equal([...store.rows.values()].filter((r) => r.ambito === "candado").length, 0);
        });
        it("si el candado sigue ocupado pasado el tiempo de espera: 409 conflict, sin ejecutar", async () => {
            const { espera, soltar } = desbloqueo();
            const f = mk(permiso(), { planillas: async () => { await espera; return { success: true, data: { id: 1 } }; } });
            const { deps } = conAlmacen(f, memoryIdempotencyStore(), { lockWaitMs: 60 });
            const a = aprobar(deps, IDEM);
            await new Promise((r) => setTimeout(r, 30));
            const b = await aprobar(deps, IDEM2);
            assert.deepEqual([b.status, (await jsonOf(b)).code], [409, "conflict"]);
            soltar();
            await a;
            assert.equal(f.planillasCalls.length, 1);
        });
        it("el candado de la carga es POR PERSONA y tipo (como dice su comentario), no uno solo para todas", () => {
            const fuente = fs.readFileSync(path.join(__dirname, "handler.ts"), "utf8");
            assert.match(fuente, /conCandado\(`import:\$\{tipo\}:\$\{actor\.id\}`/);
            assert.equal(/conCandado\(`import:\$\{tipo\}`/.test(fuente), false);
        });
        it("si el almacén no responde, no se ejecuta nada (503 sin code)", async () => {
            const caido: IdempotencyStore = { reservar: async () => { throw new Error("sin base"); }, leer: async () => null, completar: async () => undefined, liberar: async () => undefined };
            const f = mk();
            const r = await aprobar({ getEnv: () => f.env, env: env0, now: () => NOW, idempotency: () => caido });
            assert.equal(r.status, 503);
            assert.equal(f.planillasCalls.length, 0);
        });
    });
});
