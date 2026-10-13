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
    it("columnas estándar: 6 de jerarquía + 5 de auditoría (la auditoría viene del historial; sin historial, null)", () => {
        const o = mapActaEntregaRow(raw(), null, { creado: "2026-09-15T10:00:00", creado_por: "Ana Soto", modificado: "2026-09-16T09:00:00", modificado_por: "Luis Mora" });
        assert.deepEqual(
            [o.id, o.empresa, o.cliente, o.division, o.contrato, o.sucursal, o.puesto, o.creado, o.creado_por, o.modificado, o.modificado_por],
            [4, "G - Gonzalez", "Cliente 5", "Norte", "C-20 - Contrato", "S1 - Sede", "P40 - Recepción", "2026-09-15T10:00:00", "Ana Soto", "2026-09-16T09:00:00", "Luis Mora"],
        );
        const sin = mapActaEntregaRow(raw({ puesto_nombre: "0", puesto_id: 0 }));
        assert.equal(sin.puesto, null);
        for (const k of ["creado", "creado_por", "modificado", "modificado_por"]) assert.ok(k in sin && sin[k] === null, k);
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
        c_empleado: [{ id: 50, nombre: "Ana", primer_apellido: "Soto", segundo_apellido: null }, { id: 51, nombre: "Luis", primer_apellido: "Mora", segundo_apellido: null }],
        c_cambios_apps_modules: [
            { id: 1, nombre_tabla: "c_acta_entre_producto", registro_id: 1, cambios: '[{"prop":"__created__"}]', created_by: 50, created_at: new Date("2026-09-15T10:00:00Z") },
            { id: 2, nombre_tabla: "c_acta_entre_producto", registro_id: 1, cambios: '[{"prop":"observaciones"}]', created_by: 51, created_at: new Date("2026-09-16T09:00:00Z") },
            { id: 3, nombre_tabla: "otra_tabla", registro_id: 2, cambios: '[{"prop":"__created__"}]', created_by: 51, created_at: new Date("2026-09-17T09:00:00Z") },
        ],
    };
    const db = new Proxy({}, {
        get: (_t, name: string) => ({
            findMany: async (a: any = {}) => {
                const w = a.where ?? {};
                return (tables[name] ?? [])
                    .filter((r) => !w.id?.in || w.id.in.includes(r.id))
                    .filter((r) => !w.nombre_tabla || r.nombre_tabla === w.nombre_tabla)
                    .filter((r) => !w.registro_id?.in || w.registro_id.in.includes(r.registro_id))
                    .filter((r) => !w.cambios?.contains || String(r.cambios).includes(w.cambios.contains));
            },
        }),
    }) as any;
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
    it("agrega la auditoría del historial en lote (alta = creado, última edición = modificado)", async () => {
        const out = await actaEntregaProductos.load(db, p(null));
        const a = out.find((r) => r.id === 1)!, b = out.find((r) => r.id === 2)!;
        assert.deepEqual([a.creado, a.creado_por, a.modificado, a.modificado_por], ["2026-09-15T10:00:00", "Ana Soto", "2026-09-16T09:00:00", "Luis Mora"]);
        assert.deepEqual([b.creado, b.creado_por, b.modificado, b.modificado_por], [null, null, null, null]); // sin historial de esta tabla
    });
    it("declara claves que existen en la fila", () => {
        const keys = Object.keys(mapActaEntregaRow(raw()));
        for (const k of [...actaEntregaProductos.searchKeys, ...actaEntregaProductos.filterKeys, ...actaEntregaProductos.sortKeys, actaEntregaProductos.defaultSort]) assert.ok(keys.includes(k), k);
    });
});
