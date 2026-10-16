import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { verifyGuardifyApiKey } from "./auth";
import { clearGuardifyReportCache, handleGuardifyReport } from "./handler";
import { applyListing, distinctValues, ListingError, type ListingOptions, type OutRow } from "./listing";
import { mapIngresoUsuarioRow, mapLoginMarcaRow, mapTiempoAlmuerzoRow } from "./mappers";
import { UnsupportedFilterError } from "./errors";
import { type ColumnFilter, ParamError, parseReportParams } from "./params";
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
        assert.deepEqual(p, { ...BASE, page: 2, pageSize: 20, sort: "fecha", dir: "asc", q: "Ana", filters: [{ col: "puesto", op: "eq", values: ["P1"] }], scope: [{ nivel: "contrato", id: 12 }, { nivel: "puesto", id: 340 }] });
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

describe("filtros (protocolo v2)", () => {
    const f = (o: [string, string][]) => parseReportParams(new URLSearchParams([...Object.entries(BASE), ...o])).filters;
    it("f.<col> es igualdad y f.<col>.<op> toma el operador", () => {
        assert.deepEqual(f([["f.estado", "Aprobado"], ["f.creado.ge", "2026-09-01T00:00:00"], ["f.creado.lt", "2026-10-01T00:00:00"], ["f.nombre.contains", "ron"], ["f.entrada.tge", "06:00"], ["f.entrada.tle", "14:00"], ["f.minutos.le", "45"]]), [
            { col: "estado", op: "eq", values: ["Aprobado"] },
            { col: "creado", op: "ge", values: ["2026-09-01T00:00:00"] },
            { col: "creado", op: "lt", values: ["2026-10-01T00:00:00"] },
            { col: "nombre", op: "contains", values: ["ron"] },
            { col: "entrada", op: "tge", values: ["06:00"] },
            { col: "entrada", op: "tle", values: ["14:00"] },
            { col: "minutos", op: "le", values: ["45"] },
        ]);
    });
    it("solo `in` es repetible (máx. 100); los demás toman un valor", () => {
        assert.deepEqual(f([["f.estado.in", "A"], ["f.estado.in", "B"], ["f.estado.in", "C"]]), [{ col: "estado", op: "in", values: ["A", "B", "C"] }]);
        assert.deepEqual(f([["f.estado.ge", "1"], ["f.estado.ge", "2"]]), [{ col: "estado", op: "ge", values: ["2"] }]);
        assert.doesNotThrow(() => f(Array.from({ length: 100 }, (_, i) => ["f.x.in", `v${i}`] as [string, string])));
        assert.throws(() => f(Array.from({ length: 101 }, (_, i) => ["f.x.in", `v${i}`] as [string, string])), ParamError);
    });
    it("ignora valores vacíos y recorta a 200 caracteres", () => {
        assert.deepEqual(f([["f.estado", ""], ["f.estado.in", ""]]), []);
        assert.equal(f([["f.estado", "x".repeat(500)]])[0]!.values[0]!.length, 200);
    });
    it("operador desconocido o columna mal formada: unsupported_filter", () => {
        for (const k of ["f.estado.zzz", "f.Estado", "f.1x", "f.a-b", "f.", "f.a.b.c", "f.a b", "f._x"]) {
            assert.throws(() => f([[k, "x"]]), UnsupportedFilterError, k);
        }
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
        { id: 1, nombre: "Ángela", monto: 30, tipo: "a", creado: "2026-09-01T08:30:00", texto: "9" },
        { id: 2, nombre: "Beto", monto: null, tipo: "b", creado: null, texto: "10" },
        { id: 3, nombre: "Zoe", monto: 10, tipo: "a", creado: "2026-09-15T14:00:00", texto: "abc" },
        { id: 4, nombre: "Ana", monto: 20, tipo: "b", creado: "2026-10-01T06:00:00", texto: null },
    ];
    const base = { q: null, searchKeys: ["nombre"], filters: [], sort: null, dir: "desc" as const, defaultSort: "monto", page: 1, pageSize: 50 };
    const ids = (filters: ColumnFilter[], extra: Partial<ListingOptions> = {}) => applyListing(rows, { ...base, sort: "id", dir: "asc", ...extra, filters }).rows.map((r) => r.id);
    const F = (col: string, op: ColumnFilter["op"], ...values: string[]): ColumnFilter => ({ col, op, values });

    it("ordena números y deja los vacíos al final en ambos sentidos", () => {
        assert.deepEqual(applyListing(rows, base).rows.map((r) => r.id), [1, 4, 3, 2]);
        assert.deepEqual(applyListing(rows, { ...base, dir: "asc" }).rows.map((r) => r.id), [3, 4, 1, 2]);
    });
    it("busca sin importar tildes ni mayúsculas, filtra y pagina", () => {
        assert.deepEqual(applyListing(rows, { ...base, q: "angela" }).rows.map((r) => r.id), [1]);
        assert.equal(applyListing(rows, { ...base, filters: [F("tipo", "eq", "a")] }).total, 2);
        const p = applyListing(rows, { ...base, sort: "nombre", dir: "asc", pageSize: 3, page: 2 });
        assert.deepEqual([p.rows.map((r) => r.id), p.total], [[3], 4]);
    });
    it("eq: igualdad exacta del texto o número", () => {
        assert.deepEqual(ids([F("tipo", "eq", "a")]), [1, 3]);
        assert.deepEqual(ids([F("monto", "eq", "20")]), [4]);
        assert.deepEqual(ids([F("tipo", "eq", "A")]), []);
    });
    it("in: uno de varios valores", () => {
        assert.deepEqual(ids([F("nombre", "in", "Zoe", "Beto", "Nadie")]), [2, 3]);
        assert.deepEqual(ids([F("monto", "in", "10", "30")]), [1, 3]);
    });
    it("ge, lt y le comparan como número si ambos lo son", () => {
        assert.deepEqual(ids([F("monto", "ge", "20")]), [1, 4]);
        assert.deepEqual(ids([F("monto", "lt", "20")]), [3]);
        assert.deepEqual(ids([F("monto", "le", "20")]), [3, 4]);
        assert.deepEqual(ids([F("monto", "ge", "9")]), [1, 3, 4]); // 10 >= 9 como número (como texto no)
    });
    it("si no son ambos numéricos compara como texto (fechas ISO)", () => {
        assert.deepEqual(ids([F("creado", "ge", "2026-09-15T00:00:00")]), [3, 4]);
        assert.deepEqual(ids([F("texto", "ge", "abc")]), [3]); // "abc" no es número: todo como texto ("9" y "10" < "abc"); null nunca
        assert.deepEqual(ids([F("texto", "ge", "9")]), [1, 2, 3]); // "9" y "10" numéricos (10 >= 9); "abc" como texto
        assert.deepEqual(ids([F("creado", "le", "2026-09-15T14:00:00")]), [1, 3]);
    });
    it("ge + lt arman un rango (Y sobre la misma columna)", () => {
        assert.deepEqual(ids([F("creado", "ge", "2026-09-01T00:00:00"), F("creado", "lt", "2026-10-01T00:00:00")]), [1, 3]);
        assert.deepEqual(ids([F("monto", "ge", "10"), F("monto", "lt", "30")]), [3, 4]);
    });
    it("filtros de columnas distintas se combinan con Y", () => {
        assert.deepEqual(ids([F("tipo", "eq", "a"), F("monto", "ge", "20")]), [1]);
    });
    it("tge/tle comparan la hora del día (inclusivos); sin formato de fecha y hora, no cumple", () => {
        assert.deepEqual(ids([F("creado", "tge", "08:30")]), [1, 3]);
        assert.deepEqual(ids([F("creado", "tle", "08:30")]), [1, 4]);
        assert.deepEqual(ids([F("creado", "tge", "06:00"), F("creado", "tle", "14:00")]), [1, 3, 4]);
        assert.deepEqual(ids([F("creado", "tge", "9:00")]), [3]); // se acepta H:MM
        assert.deepEqual(ids([F("nombre", "tge", "00:00")]), []);
        assert.deepEqual(ids([F("creado", "tge", "mañana")]), []);
    });
    it("contains no distingue mayúsculas ni tildes", () => {
        assert.deepEqual(ids([F("nombre", "contains", "ANGEL")]), [1]);
        assert.deepEqual(ids([F("nombre", "contains", "án")]), [1, 4]);
        assert.deepEqual(ids([F("nombre", "contains", "z")]), [3]);
    });
    it("un null nunca cumple comparaciones, rangos, horas ni contains", () => {
        assert.deepEqual(ids([F("monto", "lt", "1000")]), [1, 3, 4]); // el id 2 (monto null) no entra
        assert.deepEqual(ids([F("monto", "le", "1000")]), [1, 3, 4]);
        assert.deepEqual(ids([F("monto", "ge", "-1000")]), [1, 3, 4]);
        assert.deepEqual(ids([F("monto", "contains", "")]), [1, 3, 4]);
        assert.deepEqual(ids([F("creado", "lt", "9999")]), [1, 3, 4]);
        assert.deepEqual(ids([F("creado", "tge", "00:00")]), [1, 3, 4]);
        assert.deepEqual(ids([F("creado", "tle", "23:59")]), [1, 3, 4]);
        assert.deepEqual(ids([F("creado", "contains", "2026")]), [1, 3, 4]);
        assert.deepEqual(ids([F("texto", "contains", "")]), [1, 2, 3]); // el id 4 (texto null) nunca
        assert.deepEqual(ids([F("monto", "eq", "")]), []);
    });
    it("columna inexistente: unsupported_filter; sin filas no se valida", () => {
        assert.throws(() => ids([F("secreto", "eq", "x")]), UnsupportedFilterError);
        assert.throws(() => ids([F("constructor", "eq", "x")]), UnsupportedFilterError);
        assert.deepEqual(applyListing([], { ...base, filters: [F("secreto", "eq", "x")] }), { rows: [], total: 0 });
    });
    it("ordena por cualquier columna presente en las filas y rechaza las que no existen", () => {
        assert.deepEqual(applyListing(rows, { ...base, sort: "creado", dir: "asc" }).rows.map((r) => r.id), [1, 3, 4, 2]);
        assert.deepEqual(applyListing(rows, { ...base, sort: "tipo", dir: "asc" }).rows.map((r) => r.id), [1, 3, 2, 4]);
        assert.throws(() => applyListing(rows, { ...base, sort: "id); drop table x;--" }), ListingError);
        assert.throws(() => applyListing(rows, { ...base, sort: "secreto" }), ListingError);
    });
    it("lista los valores distintos de una dimensión, con q y limit", () => {
        assert.deepEqual(distinctValues(rows, "tipo"), ["a", "b"]);
        assert.deepEqual(distinctValues(rows, "nombre", { q: "AN" }), ["Ana", "Ángela"]);
        assert.deepEqual(distinctValues(rows, "nombre", { limit: 2 }), ["Ana", "Ángela"]);
        const many = Array.from({ length: 300 }, (_, i) => ({ v: `v${i}` }));
        assert.equal(distinctValues(many, "v").length, 200);
        assert.equal(distinctValues(many, "v", { limit: 999 }).length, 200);
        assert.equal(distinctValues(many, "v", { limit: 5 }).length, 5);
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
    it("501 report_unavailable si a la base le falta lo que el reporte necesita", async () => {
        const { ReportUnavailableError } = await import("./errors");
        const falta: GuardifyReportModule = { ...mk("falta", true), load: async () => { throw new ReportUnavailableError("Falta la tabla."); } };
        const r = await handleGuardifyReport(new Request(`http://x/api/guardify/reports/falta?${q}`, { headers: { authorization: `Bearer ${KEY}` } }), "falta", "rows", { ...deps, registry: { falta } });
        assert.equal(r.status, 501);
        assert.deepEqual(await r.json(), { error: "report_unavailable", message: "Falta la tabla." });
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
    });
    it("opciones: cualquier columna de las filas; una que no existe o mal formada es 400 unsupported_filter", async () => {
        assert.deepEqual(await (await call(`con/options?${q}&dimension=monto`, undefined, "options")).json(), { values: ["5", "7", "9"] });
        for (const d of ["zzz", "", "Puesto", "constructor"]) {
            const r = await call(`con/options?${q}&dimension=${d}`, undefined, "options");
            assert.equal(r.status, 400, d);
            assert.equal((await r.json()).error, "unsupported_filter");
        }
    });
    it("opciones con filtros dinámicos: aplica los demás filtros y excluye los de la propia columna", async () => {
        const opts = async (extra: string) => (await (await call(`con/options?${q}&dimension=puesto${extra}`, undefined, "options")).json()).values;
        assert.deepEqual(await opts("&f.monto.ge=8"), ["P2"]);
        assert.deepEqual(await opts("&f.puesto=P1"), ["P1", "P2"]); // el filtro de la propia dimensión no se aplica
        assert.deepEqual(await opts("&f.puesto.in=P1&f.monto.ge=8"), ["P2"]);
        assert.deepEqual(await opts("&f.monto.lt=6&f.puesto=P2"), ["P1"]);
        assert.equal((await call(`con/options?${q}&dimension=puesto&f.nada=1`, undefined, "options")).status, 400);
    });
    it("opciones con q (contiene, sin tildes) y limit (por defecto y tope 200)", async () => {
        const opts = async (extra: string) => (await (await call(`con/options?${q}&dimension=puesto${extra}`, undefined, "options")).json()).values;
        assert.deepEqual(await opts("&q=p2"), ["P2"]);
        assert.deepEqual(await opts("&q=zzz"), []);
        assert.deepEqual(await opts("&limit=1"), ["P1"]);
        const big: OutRow[] = Array.from({ length: 300 }, (_, i) => ({ id: i, puesto: `P${i}` }));
        const d = { registry: { big: { ...mk("big", true), load: async () => big } }, getDb: () => ({}), env };
        const get = async (extra: string) => (await (await handleGuardifyReport(new Request(`http://x/api/guardify/reports/big/options?${q}&dimension=puesto${extra}`, { headers: { authorization: `Bearer ${KEY}` } }), "big", "options", d)).json()).values;
        assert.equal((await get("")).length, 200);
        assert.equal((await get("&limit=5000")).length, 200);
        assert.equal((await get("&limit=7")).length, 7);
    });
    it("filtros en las filas: todos los operadores, columna inexistente y operador desconocido", async () => {
        const total = async (extra: string) => (await (await call(`con?${q}${extra}`)).json()).total;
        assert.equal(await total("&f.puesto=P1"), 2);
        assert.equal(await total("&f.puesto.in=P1&f.puesto.in=P2"), 3);
        assert.equal(await total("&f.monto.ge=6&f.monto.lt=9"), 1);
        assert.equal(await total("&f.monto.le=7"), 2);
        assert.equal(await total("&f.puesto.contains=p2"), 1);
        assert.equal(await total("&f.puesto="), 3); // vacío se ignora
        for (const bad of ["&f.nada=1", "&f.monto.zzz=1", "&f.Monto=1", "&f.monto.a.b=1"]) {
            const r = await call(`con?${q}${bad}`);
            assert.equal(r.status, 400, bad);
            assert.equal((await r.json()).error, "unsupported_filter", bad);
        }
    });
    it("ordena por cualquier columna de las filas", async () => {
        const ok = await call(`con?${q}&sort=puesto&dir=asc`);
        assert.equal(ok.status, 200);
        assert.deepEqual((await ok.json()).rows.map((r: OutRow) => r.id), [1, 3, 2]);
        const bad = await call(`con?${q}&sort=zzz`);
        assert.equal(bad.status, 400);
        assert.equal((await bad.json()).error, "bad_request");
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
