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
const { documentosEntregados, mapDocumentoEntregadoRow } = require("./documentosEntregados") as typeof import("./documentosEntregados");

const base = { empresa_id: 1, cliente_id: 7, division_id: 3, contrato_id: 100, corpo_id: 10, puesto_id: 0, firma_representante_cliente: "data:image/png;base64,AAAA", firma_responsable: "data:image/png;base64,BBBB", tipo_documento: "Informe", nombre_oficial_entrega: "Ana", nombre_oficial_recibe: "Luis", descripcion: "x" };
const tables: Record<string, any[]> = {
    e_control_documento_entregado_cliente: [
        { ...base, id: 3, fecha: new Date("2026-09-10T00:00:00Z") },
        { ...base, id: 2, fecha: new Date("2026-09-30T00:00:00Z"), contrato_id: 101, corpo_id: 11, cliente_id: 8, tipo_documento: "Acta" },
        { ...base, id: 1, fecha: new Date("2026-10-01T00:00:00Z") },
        { ...base, id: 0, fecha: new Date("2026-08-31T00:00:00Z") },
    ],
    e_estructura_empresa: [{ id: 1, nombre: "Gonzalez", codigo: "G" }],
    e_estructura_cliente: [{ id: 7, nombre: "Cliente 7" }, { id: 8, nombre: "Cliente 8" }],
    n_division: [{ id: 3, nombre: "Seguridad", codigo: null }],
    e_estructura_contrato: [{ id: 100, nombre: "Contrato A", nro_contrato: "C1" }, { id: 101, nombre: "Contrato B", nro_contrato: null }],
    e_estructura_sucursal: [{ id: 10, nombre: "Central", nro_sucursal: "S1", ejecutivoCuenta_id: 5 }, { id: 11, nombre: "Norte", nro_sucursal: null, ejecutivoCuenta_id: null }],
    e_estructura_puesto: [],
    // Historial de cambios: solo la entrada `__created__` dice quién registró el documento (el 2 tiene además una edición posterior de otro empleado).
    c_cambios_apps_modules: [
        { id: 1, nombre_tabla: "e_control_documento_entregado_cliente", registro_id: 3, cambios: '[{"prop":"__created__","after":{}}]', created_by: 50, created_at: new Date("2026-09-10T10:00:00Z") },
        { id: 2, nombre_tabla: "e_control_documento_entregado_cliente", registro_id: 2, cambios: '[{"prop":"descripcion"}]', created_by: 51, created_at: new Date("2026-10-02T10:00:00Z") },
        { id: 3, nombre_tabla: "e_control_documento_entregado_cliente", registro_id: 2, cambios: '[{"prop":"__created__","after":{}}]', created_by: 51, created_at: new Date("2026-09-30T10:00:00Z") },
    ],
    c_empleado: [{ id: 50, nombre: "Ana", primer_apellido: "Soto", segundo_apellido: null }, { id: 51, nombre: "Luis", primer_apellido: "Mora", segundo_apellido: "Paz" }],
    n_ejecutivo_cuenta: [{ id: 5, nombre: "Laura Vega" }],
};
const db = new Proxy({}, {
    get: (_t, name: string) => ({
        findMany: async (args: any = {}) => {
            const ids: number[] | undefined = args?.where?.id?.in;
            const regs: number[] | undefined = args?.where?.registro_id?.in;
            const contains: string | undefined = args?.where?.cambios?.contains;
            if (name === "c_cambios_apps_modules" && args?.select?.cambios) throw new Error("no debe traer el contenido de los cambios (firmas)");
            return (tables[name] ?? []).filter((r) => (!ids || ids.includes(r.id)) && (!regs || regs.includes(r.registro_id)) && (!contains || String(r.cambios).includes(contains)));
        },
    }),
}) as any;
const P = { from: "2026-09-01", to: "2026-10-01", page: 1, pageSize: 50, sort: null, dir: "desc" as const, q: null, filters: [], scope: null };

describe("documentos entregados", () => {
    it("mapea la fila: fecha sin hora, vacíos como null, descripción recortada y sin firmas", () => {
        const o = mapDocumentoEntregadoRow({ ...base, id: 5, fecha: new Date("2026-09-10T00:00:00Z"), empresa_nombre: "1", cliente_nombre: "Cliente 7", division_nombre: "0", contrato_nombre: "C1 - A", corpo_nombre: "S1 - B", puesto_nombre: "0", descripcion: "d".repeat(900), nombre_oficial_recibe: "  " }, "Laura Vega", "Ana Soto");
        assert.deepEqual([o.ejecutivo_cuenta, o.usuario_inserta], ["Laura Vega", "Ana Soto"]);
        assert.deepEqual(Object.keys(o).slice(-2), ["ejecutivo_cuenta", "usuario_inserta"]);
        assert.deepEqual([mapDocumentoEntregadoRow({ id: 6 }).ejecutivo_cuenta, mapDocumentoEntregadoRow({ id: 6 }).usuario_inserta], [null, null]);
        assert.equal(o.fecha, "2026-09-10T00:00:00");
        assert.equal(o.empresa, null); // la consulta puso el id
        assert.equal(o.division, null);
        assert.equal(o.puesto, null);
        assert.equal(o.oficial_recibe, null);
        assert.equal(String(o.descripcion).length, 500);
        const s = JSON.stringify(o);
        assert.equal(s.includes("base64"), false);
        assert.deepEqual(Object.keys(o).filter((k) => /firma/.test(k)), []);
    });
    it("trae el periodo [from, to) con su ubicación y sin firmas", async () => {
        const rows = await documentosEntregados.load(db, P);
        assert.deepEqual(rows.map((r) => r.id).sort(), [2, 3]);
        const r3 = rows.find((r) => r.id === 3)!;
        assert.deepEqual([r3.empresa, r3.cliente, r3.contrato, r3.sucursal, r3.puesto, r3.tipo_documento], ["G - Gonzalez", "Cliente 7", "C1 - Contrato A", "S1 - Central", null, "Informe"]);
        assert.equal(JSON.stringify(rows).includes("base64"), false);
    });
    it("agrega por lote el ejecutivo de la sucursal y quien registró (entrada de alta del historial)", async () => {
        const rows = await documentosEntregados.load(db, P);
        assert.deepEqual(rows.map((r) => [r.id, r.ejecutivo_cuenta, r.usuario_inserta]).sort(), [[2, null, "Luis Mora Paz"], [3, "Laura Vega", "Ana Soto"]]);
    });
    it("si el historial no se puede leer, el reporte sigue sin usuario_inserta", async () => {
        const roto = new Proxy({}, { get: (_t, name: string) => name === "c_cambios_apps_modules" ? { findMany: async () => { throw new Error("falla"); } } : (db as any)[name] }) as any;
        const rows = await documentosEntregados.load(roto, P);
        assert.deepEqual(rows.map((r) => r.usuario_inserta), [null, null]);
        assert.equal(rows.length, 2);
    });
    it("alcance: filtra por los ids de la fila", async () => {
        assert.deepEqual((await documentosEntregados.load(db, { ...P, scope: [{ nivel: "corpo", id: 11 }] })).map((r) => r.id), [2]);
        assert.deepEqual((await documentosEntregados.load(db, { ...P, scope: [{ nivel: "cliente", id: 7 }, { nivel: "contrato", id: 101 }] })).map((r) => r.id).sort(), [2, 3]);
        assert.deepEqual(await documentosEntregados.load(db, { ...P, scope: [] }), []);
    });
    it("las claves de orden, búsqueda y filtro existen en la fila", async () => {
        const [r] = await documentosEntregados.load(db, P);
        for (const k of [...documentosEntregados.searchKeys, ...documentosEntregados.filterKeys, ...documentosEntregados.sortKeys, documentosEntregados.defaultSort]) assert.ok(k in r!, k);
    });
});
