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
const { actaEntregaProductos, mapActaEntregaRow } = require("./actaEntregaProductos") as typeof import("./actaEntregaProductos");

const raw = (o: Record<string, any> = {}) => ({
    id: 4,
    empresa_id: 1, cliente_id: 5, division_id: 9, contrato_id: 20, corpo_id: 30, puesto_id: 40,
    fecha: new Date("2026-09-15T10:20:30Z"),
    tipo_entrega: "Uniformes",
    mensual: "Sí",
    detalle: JSON.stringify([{ descripcion: "Camisa", cantidad: 2 }, { descripcion: "Pantalón", cantidad: 1 }]),
    nombre_entrega: "Ana Soto",
    cedula_entrega: "1-111",
    firma_entrega: "data:image/png;base64,AAAA",
    nombre_recibe: "Beto Mora",
    cedula_recibe: "2-222",
    firma_recibe: "BBBB",
    empresa_nombre: "G - Gonzalez", cliente_nombre: "Cliente 5", division_nombre: "Norte",
    contrato_nombre: "C-20 - Contrato", corpo_nombre: "S1 - Sede", puesto_nombre: "P40 - Recepción",
    ...o,
});

describe("acta_entrega_productos: mapeo", () => {
    it("mapea la fila y nunca expone firmas", () => {
        const o = mapActaEntregaRow(raw());
        assert.equal(o.fecha, "2026-09-15T10:20:30");
        assert.equal(o.articulos, 2);
        assert.equal(o.descripcion, "Camisa; Pantalón");
        assert.deepEqual([o.nombre_recibe, o.cedula_recibe, o.puesto, o.sucursal], ["Beto Mora", "2-222", "P40 - Recepción", "S1 - Sede"]);
        assert.equal(o.ejecutivo_cuenta, null);
        assert.equal(o.empleado, "1-111 - Ana Soto · 2-222 - Beto Mora");
        const s = JSON.stringify(o);
        assert.equal(s.includes("base64"), false);
        assert.equal(s.includes("BBBB"), false);
    });
    it("tolera nulos, detalle inválido y nombres que son solo el id", () => {
        const o = mapActaEntregaRow(raw({ detalle: "no-json", nombre_recibe: "", empresa_nombre: "1", fecha: null }));
        assert.equal(o.articulos, 0);
        assert.equal(o.descripcion, null);
        assert.equal(o.nombre_recibe, null);
        assert.equal(o.empresa, null);
        assert.equal(o.fecha, null);
        assert.equal(o.empleado, "1-111 - Ana Soto"); // solo quien entrega
        assert.equal(mapActaEntregaRow(raw({ nombre_entrega: "", nombre_recibe: "" })).empleado, null);
        assert.equal(mapActaEntregaRow(raw({ cedula_recibe: "" }), "  Rosa Vega ").empleado, "1-111 - Ana Soto · Beto Mora");
        assert.equal(mapActaEntregaRow(raw(), "  Rosa Vega ").ejecutivo_cuenta, "Rosa Vega");
    });
    it("recorta la descripción a 500 caracteres", () => {
        const o = mapActaEntregaRow(raw({ detalle: JSON.stringify([{ descripcion: "x".repeat(900) }]) }));
        assert.equal((o.descripcion as string).length, 500);
    });
});

describe("acta_entrega_productos: alcance", () => {
    const rows = [raw({ id: 1 }), raw({ id: 2, contrato_id: 21, corpo_id: 31, puesto_id: 41, division_id: 10 })];
    const tables: Record<string, any[]> = {
        c_acta_entre_producto: rows,
        e_estructura_sucursal: [{ id: 30, ejecutivoCuenta_id: 7 }, { id: 31, ejecutivoCuenta_id: null }],
        n_ejecutivo_cuenta: [{ id: 7, nombre: "Rosa Vega" }],
    };
    const db = new Proxy({}, { get: (_t, name: string) => ({ findMany: async (a: any = {}) => (tables[name] ?? []).filter((r) => !a.where?.id?.in || a.where.id.in.includes(r.id)) }) }) as any;
    const p = (scope: any) => ({ from: "2026-09-01", to: "2026-10-01", page: 1, pageSize: 50, sort: null, dir: "desc" as const, q: null, filters: [], scope });
    it("sin alcance trae todo; con alcance filtra por nivel; vacío no ve nada", async () => {
        assert.equal((await actaEntregaProductos.load(db, p(null))).length, 2);
        assert.deepEqual((await actaEntregaProductos.load(db, p([{ nivel: "contrato", id: 21 }]))).map((r) => r.id), [2]);
        assert.deepEqual((await actaEntregaProductos.load(db, p([{ nivel: "division", id: 9 }, { nivel: "puesto", id: 41 }]))).map((r) => r.id).sort(), [1, 2]);
        assert.deepEqual(await actaEntregaProductos.load(db, p([])), []);
    });
    it("agrega el ejecutivo de cuenta de la sucursal en lote", async () => {
        const out = await actaEntregaProductos.load(db, p(null));
        assert.equal(out.find((r) => r.id === 1)!.ejecutivo_cuenta, "Rosa Vega");
        assert.equal(out.find((r) => r.id === 2)!.ejecutivo_cuenta, null);
    });
    it("declara claves que existen en la fila", () => {
        const keys = Object.keys(mapActaEntregaRow(raw()));
        for (const k of [...actaEntregaProductos.searchKeys, ...actaEntregaProductos.filterKeys, ...actaEntregaProductos.sortKeys, actaEntregaProductos.defaultSort]) assert.ok(keys.includes(k), k);
    });
});
