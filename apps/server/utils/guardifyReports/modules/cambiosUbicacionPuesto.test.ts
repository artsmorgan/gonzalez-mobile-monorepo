import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Las consultas originales (`reports-functions/`) importan paquetes que solo sirven para armar el Excel (`exceljs`, `axios`…).
 * Si alguno no está instalado en este entorno se sustituye por un objeto inerte: aquí nunca se genera un archivo. Si está
 * instalado se usa el real.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const NodeModule = require("node:module");
const realLoad = NodeModule._load;
const inert: any = new Proxy(function () {}, { get: (_t, k) => (k === "__esModule" ? false : inert), apply: () => inert, construct: () => inert });
NodeModule._load = function (request: string, ...rest: unknown[]) {
    try {
        return realLoad.call(this, request, ...rest);
    } catch (e: any) {
        if (e?.code === "MODULE_NOT_FOUND" && !request.startsWith(".") && !request.startsWith("/")) return inert;
        throw e;
    }
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { cambiosUbicacionPuesto, mapCambioUbicacionPuestoRow } = require("./cambiosUbicacionPuesto") as typeof import("./cambiosUbicacionPuesto");

const tables: Record<string, any[]> = {
    c_ubicacion_puesto_registro_cambios: [
        { id: 3, puesto_id: 1, latitud_anterior: "9.9300", longitud_anterior: "-84.0800", latitud_nueva: "9.9390", longitud_nueva: "-84.0800", created_at: new Date("2026-09-10T14:00:00Z"), created_by: 50 },
        { id: 2, puesto_id: 2, latitud_anterior: null, longitud_anterior: null, latitud_nueva: "10.0", longitud_nueva: "-84.0", created_at: new Date("2026-09-15T08:30:00Z"), created_by: 51 },
        { id: 1, puesto_id: 1, latitud_anterior: "9.9", longitud_anterior: "-84.0", latitud_nueva: "9.9", longitud_nueva: "-84.0", created_at: new Date("2026-10-01T00:00:00Z"), created_by: 50 },
    ],
    e_estructura_puesto: [{ id: 1, nombre: "Entrada", codigo: "P1", sucursal_id: 10 }, { id: 2, nombre: "Garita", codigo: null, sucursal_id: 11 }],
    e_estructura_sucursal: [{ id: 10, nombre: "Central", nro_sucursal: "S1", contrato_id: 100 }, { id: 11, nombre: "Norte", nro_sucursal: null, contrato_id: 101 }],
    e_estructura_contrato: [{ id: 100, nombre: "Contrato A", nro_contrato: "C1", cliente_id: 7, empresa_id: 1, division_id: 3 }, { id: 101, nombre: "Contrato B", nro_contrato: null, cliente_id: 8, empresa_id: 1, division_id: 3 }],
    e_estructura_empresa: [{ id: 1, nombre: "Gonzalez", codigo: "G" }],
    e_estructura_cliente: [{ id: 7, nombre: "Cliente 7" }, { id: 8, nombre: "Cliente 8" }],
    n_division: [{ id: 3, nombre: "Seguridad", codigo: null }],
    c_empleado: [{ id: 50, codigo: "E50", nombre: "Ana", primer_apellido: "Soto", segundo_apellido: null }],
};
const db = new Proxy({}, {
    get: (_t, name: string) => ({
        findMany: async (args: any = {}) => {
            const ids: number[] | undefined = args?.where?.id?.in;
            return (tables[name] ?? []).filter((r) => !ids || ids.includes(r.id));
        },
    }),
}) as any;
const P = { from: "2026-09-01", to: "2026-10-01", page: 1, pageSize: 50, sort: null, dir: "desc" as const, q: null, filters: {}, scope: null };

describe("cambios de ubicación del puesto", () => {
    it("mapea la fila sin coordenadas y con nulos", () => {
        const o = mapCambioUbicacionPuestoRow({ id: 2, created_at: new Date("2026-09-15T08:30:00Z"), empresa_nombre: "—", cliente_nombre: "Cliente 8", division_nombre: "—", contrato_nombre: "C - X", corpo_nombre: "S - Y", puesto_nombre: "77", puesto_id: 77, responsable_nombre: "99", created_by: 99, latitud_anterior: null, longitud_anterior: null, latitud_nueva: "10.0", longitud_nueva: "-84.0" });
        assert.equal(o.fecha, "2026-09-15T08:30:00");
        assert.equal(o.empresa, null);
        assert.equal(o.puesto, null); // la consulta puso el id cuando no halló el nombre
        assert.equal(o.responsable, null);
        assert.equal(o.tenia_ubicacion, "No");
        assert.equal(o.metros, null);
        const s = JSON.stringify(o);
        assert.equal(/10\.0|-84|lat|lng/i.test(s), false);
        assert.deepEqual(Object.keys(o).filter((k) => /lat|lng|long/i.test(k)), []);
    });
    it("calcula cuántos metros se movió el puesto, sin exponer coordenadas", () => {
        const o = mapCambioUbicacionPuestoRow({ id: 3, created_at: new Date("2026-09-10T14:00:00Z"), latitud_anterior: "9.9300", longitud_anterior: "-84.0800", latitud_nueva: "9.9390", longitud_nueva: "-84.0800", responsable_nombre: "E50 - Ana Soto", created_by: 50 });
        assert.equal(o.tenia_ubicacion, "Sí");
        assert.ok(Math.abs(Number(o.metros) - 1000) < 10, String(o.metros));
        assert.equal(o.responsable, "E50 - Ana Soto");
    });
    it("trae el periodo [from, to) con la ubicación completa y sin coordenadas", async () => {
        const rows = await cambiosUbicacionPuesto.load(db, P);
        assert.deepEqual(rows.map((r) => r.id).sort(), [2, 3]); // el 1 es del 1 de octubre: fuera (to exclusivo)
        const r3 = rows.find((r) => r.id === 3)!;
        assert.deepEqual([r3.empresa, r3.cliente, r3.division, r3.contrato, r3.sucursal, r3.puesto], ["G - Gonzalez", "Cliente 7", "Seguridad", "C1 - Contrato A", "S1 - Central", "P1 - Entrada"]);
        assert.equal(JSON.stringify(rows).includes("9.93"), false);
    });
    it("alcance: filtra por los ids de estructura de cada cambio", async () => {
        const byContrato = await cambiosUbicacionPuesto.load(db, { ...P, scope: [{ nivel: "contrato", id: 101 }] });
        assert.deepEqual(byContrato.map((r) => r.id), [2]);
        const byPuesto = await cambiosUbicacionPuesto.load(db, { ...P, scope: [{ nivel: "puesto", id: 1 }] });
        assert.deepEqual(byPuesto.map((r) => r.id), [3]);
        assert.deepEqual(await cambiosUbicacionPuesto.load(db, { ...P, scope: [] }), []);
    });
    it("las claves de orden, búsqueda y filtro existen en la fila", async () => {
        const [r] = await cambiosUbicacionPuesto.load(db, P);
        for (const k of [...cambiosUbicacionPuesto.searchKeys, ...cambiosUbicacionPuesto.filterKeys, ...cambiosUbicacionPuesto.sortKeys, cambiosUbicacionPuesto.defaultSort]) assert.ok(k in r!, k);
    });
});
