import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { verifyGuardifyApiKey } from "./auth";
import { clearGuardifyReportCache, handleGuardifyReport } from "./handler";
import { applyListing, distinctValues, type OutRow } from "./listing";
import { mapIngresoUsuarioRow, mapLoginMarcaRow, mapTiempoAlmuerzoRow } from "./mappers";
import { ParamError, parseReportParams } from "./params";
import { loadPuestoHierarchy, matchesScope, parseScope } from "./scope";
import { handleGuardifyStructure } from "./structure";
import type { GuardifyReportModule } from "./types";

const KEY = "k".repeat(32);
const env = { GUARDIFY_REPORTS_API_KEY: KEY };
const h = (o: Record<string, string>) => new Headers(o);
const qs = (o: Record<string, string>) => new URLSearchParams(o);
const BASE = { from: "2026-09-01", to: "2026-10-01" };

describe("auth", () => {
    it("sin llave configurada (o corta) la API está deshabilitada", () => {
        assert.deepEqual(verifyGuardifyApiKey(h({ authorization: `Bearer ${KEY}` }), {}), { ok: false, status: 503, error: "not_configured", message: "La API de reportes para Guardify no está configurada." });
        assert.equal(verifyGuardifyApiKey(h({ authorization: "Bearer corta" }), { GUARDIFY_REPORTS_API_KEY: "corta" }).ok, false);
    });
    it("acepta Bearer o x-guardify-key y rechaza lo demás", () => {
        assert.equal(verifyGuardifyApiKey(h({ authorization: `Bearer ${KEY}` }), env).ok, true);
        assert.equal(verifyGuardifyApiKey(h({ "x-guardify-key": KEY }), env).ok, true);
        for (const bad of [{}, { authorization: "Bearer otra" }, { authorization: KEY }, { "x-guardify-key": `${KEY}x` }] as Record<string, string>[]) {
            const r = verifyGuardifyApiKey(h(bad), env);
            assert.equal(r.ok, false);
            if (!r.ok) assert.equal(r.status, 401);
        }
    });
    it("devuelve quién consulta, recortado", () => {
        const r = verifyGuardifyApiKey(h({ authorization: `Bearer ${KEY}`, "x-guardify-user": "ana@x.test" }), env);
        assert.deepEqual(r, { ok: true, user: "ana@x.test" });
    });
});

describe("parámetros", () => {
    it("lee periodo, página, orden, filtros y alcance", () => {
        const p = parseReportParams(qs({ ...BASE, page: "2", pageSize: "20", sort: "fecha", dir: "asc", q: " Ana ", "f.puesto": "P1", scope: "contrato:12,puesto:340" }));
        assert.deepEqual(p, { ...BASE, page: 2, pageSize: 20, sort: "fecha", dir: "asc", q: "Ana", filters: { puesto: "P1" }, scope: [{ nivel: "contrato", id: 12 }, { nivel: "puesto", id: 340 }] });
    });
    it("sin scope = toda la empresa; scope vacío = nada", () => {
        assert.equal(parseReportParams(qs(BASE)).scope, null);
        assert.deepEqual(parseReportParams(qs({ ...BASE, scope: "" })).scope, []);
    });
    it("rechaza fechas inválidas, periodos al revés o enormes y alcances mal formados", () => {
        for (const bad of [{}, { from: "2026-9-1", to: "2026-10-01" }, { from: "2026-10-01", to: "2026-09-01" }, { from: "2025-01-01", to: "2026-12-31" }, { ...BASE, scope: "planeta:1" }, { ...BASE, scope: "puesto:abc" }] as Record<string, string>[]) {
            assert.throws(() => parseReportParams(qs(bad)), ParamError);
        }
    });
    it("limita el tamaño de página", () => {
        assert.equal(parseReportParams(qs({ ...BASE, pageSize: "999999" })).pageSize, 1000);
        assert.equal(parseReportParams(qs({ ...BASE, page: "-4" })).page, 1);
    });
});

describe("alcance", () => {
    it("es la unión de los nodos y un alcance vacío no ve nada", () => {
        const s = parseScope("contrato:5,puesto:9");
        assert.equal(matchesScope({ contrato: 5, puesto: 1 }, s), true);
        assert.equal(matchesScope({ contrato: 6, puesto: 9 }, s), true);
        assert.equal(matchesScope({ contrato: 6, puesto: 1 }, s), false);
        assert.equal(matchesScope({ contrato: null }, s), false);
        assert.equal(matchesScope({ contrato: 5 }, []), false);
    });
    it("deduce la ubicación completa de un puesto", async () => {
        const tables: Record<string, any[]> = {
            e_estructura_puesto: [{ id: 1, sucursal_id: 10 }, { id: 2, sucursal_id: null }],
            e_estructura_sucursal: [{ id: 10, contrato_id: 100 }],
            e_estructura_contrato: [{ id: 100, cliente_id: 7, empresa_id: 1, division_id: 3 }],
        };
        const db = new Proxy({}, { get: (_t, name: string) => ({ findMany: async () => tables[name] ?? [] }) }) as any;
        const m = await loadPuestoHierarchy(db, [1, 2, 99]);
        assert.deepEqual(m.get(1), { puesto: 1, corpo: 10, contrato: 100, cliente: 7, empresa: 1, division: 3 });
        assert.deepEqual(m.get(2), { puesto: 2, corpo: null, contrato: null, cliente: null, empresa: null, division: null });
        assert.equal(m.has(99), false);
    });
});

describe("listado", () => {
    const rows: OutRow[] = [
        { id: 1, nombre: "Ángela", monto: 30, tipo: "a" },
        { id: 2, nombre: "Beto", monto: null, tipo: "b" },
        { id: 3, nombre: "Zoe", monto: 10, tipo: "a" },
        { id: 4, nombre: "Ana", monto: 20, tipo: "b" },
    ];
    const base = { q: null, searchKeys: ["nombre"], filters: {}, filterKeys: ["tipo"], sortKeys: ["monto", "nombre"], sort: null, dir: "desc" as const, defaultSort: "monto", page: 1, pageSize: 50 };
    it("ordena números y deja los vacíos al final en ambos sentidos", () => {
        assert.deepEqual(applyListing(rows, base).rows.map((r) => r.id), [1, 4, 3, 2]);
        assert.deepEqual(applyListing(rows, { ...base, dir: "asc" }).rows.map((r) => r.id), [3, 4, 1, 2]);
    });
    it("busca sin importar tildes ni mayúsculas, filtra y pagina", () => {
        assert.deepEqual(applyListing(rows, { ...base, q: "angela" }).rows.map((r) => r.id), [1]);
        assert.equal(applyListing(rows, { ...base, filters: { tipo: "a" } }).total, 2);
        const p = applyListing(rows, { ...base, sort: "nombre", dir: "asc", pageSize: 3, page: 2 });
        assert.deepEqual([p.rows.map((r) => r.id), p.total], [[3], 4]);
    });
    it("rechaza filtros y órdenes que el reporte no declara", () => {
        assert.throws(() => applyListing(rows, { ...base, filters: { secreto: "x" } }));
        assert.throws(() => applyListing(rows, { ...base, sort: "id); drop table x;--" }));
    });
    it("lista los valores distintos de una dimensión", () => {
        assert.deepEqual(distinctValues(rows, "tipo"), ["a", "b"]);
    });
});

describe("mapeo de filas", () => {
    it("login de marca: fechas de pared y sin dispositivo ni coordenadas", () => {
        const o = mapLoginMarcaRow({ id: 5, fecha_hora: new Date("2026-09-27T03:07:39.000Z"), cedula_empleado: "1-111", nombre_empleado: "Ana", puesto_nombre: "P1", device: "{secreto}", lat: "9.9", marca_entrada_real: null });
        assert.equal(o.fecha, "2026-09-27T03:07:39");
        assert.equal(o.entrada_real, null);
        assert.deepEqual(Object.keys(o).filter((k) => ["device", "lat", "lng", "session_id"].includes(k)), []);
    });
    it("tiempo de almuerzo: nunca expone la firma", () => {
        const o = mapTiempoAlmuerzoRow({ id: 1, inicio: new Date("2026-09-01T12:00:00Z"), fin: new Date("2026-09-01T12:45:00Z"), empleado_nombre: "Ana", cedula_empleado: "1", minutos_almuerzo: 44.999, firma_empleado: "data:image/png;base64,AAAA", pausas_list: [{}, {}], es_manual: true });
        assert.equal(o.minutos, 45);
        assert.equal(o.pausas, 2);
        assert.equal(o.manual, "Sí");
        assert.equal(JSON.stringify(o).includes("base64"), false);
    });
    it("ingresos de usuario: nunca expone el token de refresco", () => {
        const o = mapIngresoUsuarioRow({ id: 9, token: "TOKEN-SECRETO", createdAt: new Date("2026-09-01T00:00:00Z"), expiresAt: new Date("2026-09-08T00:00:00Z"), sessionId: "s-1", device: '["a","b"]', revoked: false, c_empleado: { nombre: "Ana", primer_apellido: "Soto", cedula: "1-1" } });
        assert.equal(JSON.stringify(o).includes("TOKEN-SECRETO"), false);
        assert.deepEqual([o.empleado, o.cedula, o.dispositivos, o.revocado], ["Ana Soto", "1-1", 2, "No"]);
    });
});

describe("manejador", () => {
    const data: OutRow[] = [{ id: 1, puesto: "P1", monto: 5 }, { id: 2, puesto: "P2", monto: 9 }, { id: 3, puesto: "P1", monto: 7 }];
    let lastScope: unknown;
    const mk = (id: string, supportsScope: boolean): GuardifyReportModule => ({
        id, supportsScope, searchKeys: ["puesto"], filterKeys: ["puesto"], sortKeys: ["monto", "id"], defaultSort: "id",
        load: async (_db, p) => { lastScope = p.scope; return p.scope ? data.filter((r) => p.scope!.some((s) => s.id === Number(String(r.puesto).slice(1)))) : data; },
    });
    const deps = { registry: { con: mk("con", true), sin: mk("sin", false) }, getDb: () => ({}), env };
    beforeEach(() => clearGuardifyReportCache());
    const call = (path: string, headers: Record<string, string> = { authorization: `Bearer ${KEY}` }, kind: "rows" | "options" = "rows") =>
        handleGuardifyReport(new Request(`http://x/api/guardify/reports/${path}`, { headers }), path.split("?")[0]!.split("/")[0]!, kind, deps);
    const q = `from=${BASE.from}&to=${BASE.to}`;

    it("exige la llave, y 503 si la API no está configurada", async () => {
        assert.equal((await call(`con?${q}`, {})).status, 401);
        assert.equal((await handleGuardifyReport(new Request("http://x"), "con", "rows", { ...deps, env: {} })).status, 503);
    });
    it("404 si el reporte no existe, 400 si la petición es inválida", async () => {
        assert.equal((await call(`nada?${q}`)).status, 404);
        assert.equal((await call("con?from=hoy&to=mañana")).status, 400);
        assert.equal((await call(`con?${q}&sort=zzz`)).status, 400);
    });
    it("responde filas ordenadas y paginadas con el total", async () => {
        const r = await call(`con?${q}&sort=monto&dir=desc&pageSize=2`);
        assert.equal(r.status, 200);
        assert.equal(r.headers.get("cache-control"), "no-store");
        assert.deepEqual(await r.json(), { rows: [data[1], data[2]], total: 3 });
    });
    it("con alcance filtra; sin soporte de alcance responde 403 scope_unsupported", async () => {
        const ok = await call(`con?${q}&scope=puesto:2`);
        assert.deepEqual((await ok.json()).total, 1);
        assert.deepEqual(lastScope, [{ nivel: "puesto", id: 2 }]);
        const no = await call(`sin?${q}&scope=puesto:2`);
        assert.equal(no.status, 403);
        assert.equal((await no.json()).error, "scope_unsupported");
        assert.equal((await call(`sin?${q}`)).status, 200); // toda la empresa sí
    });
    it("alcance vacío: no se ve nada", async () => {
        assert.equal((await (await call(`con?${q}&scope=`)).json()).total, 0);
    });
    it("reutiliza unos segundos las filas del mismo periodo y alcance (páginas, orden y exportación), y vuelve a pedirlas después", async () => {
        clearGuardifyReportCache();
        let loads = 0, t = 1_000_000;
        const counting: GuardifyReportModule = { ...mk("cnt", true), load: async () => { loads++; return data; } };
        const d = { registry: { cnt: counting }, getDb: () => ({}), env, now: () => t };
        const get = (extra: string) => handleGuardifyReport(new Request(`http://x/api/guardify/reports/cnt?${q}${extra}`, { headers: { authorization: `Bearer ${KEY}` } }), "cnt", "rows", d);
        await get(""); await get("&page=2&pageSize=1"); await get("&sort=monto&dir=asc");
        assert.equal(loads, 1);
        await get("&scope=puesto:1"); // otro alcance = otra consulta
        assert.equal(loads, 2);
        t += 31_000; await get("");
        assert.equal(loads, 3);
    });
    it("opciones de una dimensión", async () => {
        const r = await call(`con/options?${q}&dimension=puesto`, undefined, "options");
        assert.deepEqual(await r.json(), { values: ["P1", "P2"] });
        assert.equal((await call(`con/options?${q}&dimension=monto`, undefined, "options")).status, 400);
    });
});

describe("estructura para Guardify", () => {
    const db = {
        e_estructura_puesto: { findMany: async () => [{ id: 7, codigo: "1000-P1", nombre: "SUPERVISORES", sucursal_id: 3 }, { id: 8, codigo: null, nombre: "SIN CORPO", sucursal_id: null }] },
        e_estructura_sucursal: { findMany: async () => [{ id: 3, contrato_id: 2 }] },
        e_estructura_contrato: { findMany: async () => [{ id: 2, cliente_id: 5, empresa_id: 1, division_id: null }] },
    };
    const call = (headers: Record<string, string>, e: Record<string, string | undefined> = env) => handleGuardifyStructure(new Request("http://x/api/guardify/structure", { headers }), { getDb: () => db, env: e });
    it("pide la llave y no responde sin ella configurada", async () => {
        assert.equal((await call({})).status, 401);
        assert.equal((await call({ authorization: `Bearer ${KEY}` }, {})).status, 503);
    });
    it("devuelve cada puesto con su ubicación (y nulos si no la tiene)", async () => {
        const r = await call({ authorization: `Bearer ${KEY}` });
        assert.equal(r.status, 200);
        assert.deepEqual((await r.json()).puestos, [
            { id: 7, codigo: "1000-P1", nombre: "SUPERVISORES", corpo: 3, contrato: 2, cliente: 5, empresa: 1, division: null },
            { id: 8, codigo: null, nombre: "SIN CORPO", corpo: null, contrato: null, cliente: null, empresa: null, division: null },
        ]);
    });
});
