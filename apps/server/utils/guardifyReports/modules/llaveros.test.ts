import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseReportParams } from "../params";
import { latestMovimiento, llaveros, loadLlaveros, mapLlaveroRow, movimientoDt } from "./llaveros";

const raw = {
    id: 7, created_at: new Date("2026-09-10T15:30:00Z"), numero_llavero: "L-7", nombre_llavero: "Llavero bodega",
    empresa_id: 1, cliente_id: 2, division_id: 3, contrato_id: 4, corpo_id: 5, puesto_id: 6,
    empresa_nombre: "9 - Empresa", cliente_nombre: "Cliente", division_nombre: "División", contrato_nombre: "C1 - Contrato", corpo_nombre: "S1 - Sucursal", puesto_nombre: "P1 - Puesto",
    observaciones: "x".repeat(900), firma_responsable: "data:image/png;base64,AAAA", created_by: 11,
    e_llave_en_llavero: [{ e_llave: { id: 1, numero_llave: "K-1" } }, { e_llave: { id: 2, numero_llave: "K-2" } }, { e_llave: null }],
    e_movimiento_llavero: [
        { id: 3, nombre_persona_entrega: "Ana", nombre_persona_recibe: "Beto", telefono: "8888-0000", fecha: new Date("2026-09-11T00:00:00Z"), hora: new Date("1970-01-01T08:15:00Z"), firma_entrega: "data:image/png;base64,BBBB", firma_recibe: null, firma_responsable: "data:image/png;base64,CCCC" },
        { id: 2, nombre_persona_entrega: "Zoe", nombre_persona_recibe: "Ana", telefono: "1", fecha: new Date("2026-09-12T00:00:00Z"), hora: new Date("1970-01-01T09:00:00Z"), firma_responsable: "" },
    ],
};

describe("llaveros: mapeo", () => {
    it("aplana la fila, recorta textos largos y toma el movimiento más reciente", () => {
        const o = mapLlaveroRow(raw, { nombre: "Carla", primer_apellido: "Soto", segundo_apellido: null });
        assert.equal(o.id, 7);
        assert.equal(o.creado, "2026-09-10T15:30:00");
        assert.deepEqual([o.numero, o.nombre, o.empresa, o.sucursal, o.puesto], ["L-7", "Llavero bodega", "9 - Empresa", "S1 - Sucursal", "P1 - Puesto"]);
        assert.deepEqual([o.llaves, o.numeros_llaves, o.movimientos], [2, "K-1; K-2", 2]);
        assert.deepEqual([o.ultimo_movimiento, o.ultima_entrega, o.ultima_recibe], ["2026-09-12T09:00:00", "Zoe", "Ana"]);
        assert.equal((o.observaciones as string).length, 500);
        assert.equal(o.creado_por, "Carla Soto");
        assert.deepEqual([o.division, o.ejecutivo_cuenta, o.modificado, o.modificado_por], ["División", null, null, null]);
        assert.ok(!("usuario_inserta" in o)); // era el mismo dato que creado_por
    });
    it("columnas estándar: jerarquía (6) y auditoría (id, creado, creado_por, modificado, modificado_por)", () => {
        const o = mapLlaveroRow(raw, { nombre: "Carla", primer_apellido: "Soto" }, " Ana Rojas ", { at: new Date("2026-09-12T10:00:00Z"), por: " Luis Mena " });
        assert.deepEqual([o.empresa, o.cliente, o.division, o.contrato, o.sucursal, o.puesto], ["9 - Empresa", "Cliente", "División", "C1 - Contrato", "S1 - Sucursal", "P1 - Puesto"]);
        assert.deepEqual([o.id, o.creado, o.creado_por, o.modificado, o.modificado_por], [7, "2026-09-10T15:30:00", "Carla Soto", "2026-09-12T10:00:00", "Luis Mena"]);
        assert.equal(o.ejecutivo_cuenta, "Ana Rojas");
        assert.deepEqual(Object.keys(o).slice(-4), ["creado_por", "modificado", "modificado_por", "ejecutivo_cuenta"]);
        // la consulta rellena con el id cuando no encuentra el nivel: eso es «sin dato»
        const sin = mapLlaveroRow({ ...raw, empresa_nombre: "1", cliente_nombre: "2", division_nombre: "3", contrato_nombre: "4", corpo_nombre: "5", puesto_nombre: "6" });
        assert.deepEqual([sin.empresa, sin.cliente, sin.division, sin.contrato, sin.sucursal, sin.puesto], [null, null, null, null, null, null]);
    });
    it("nunca expone firmas ni teléfonos", () => {
        const s = JSON.stringify(mapLlaveroRow(raw));
        for (const bad of ["base64", "8888-0000", "firma"]) assert.equal(s.includes(bad), false, bad);
    });
    it("tolera nulos y llaveros sin llaves ni movimientos", () => {
        const o = mapLlaveroRow({ id: 1, created_at: null, numero_llavero: "", nombre_llavero: null, observaciones: null });
        assert.deepEqual([o.creado, o.numero, o.nombre, o.llaves, o.numeros_llaves, o.movimientos, o.ultimo_movimiento, o.ultima_entrega, o.observaciones, o.creado_por, o.ejecutivo_cuenta, o.modificado, o.modificado_por], [null, null, null, 0, null, 0, null, null, null, null, null, null, null]);
    });
    it("combina fecha y hora del movimiento (también como texto) y elige el último", () => {
        assert.equal(movimientoDt({ fecha: "2026-09-11T00:00:00.000Z", hora: "1970-01-01T23:59:01.000Z" }), "2026-09-11T23:59:01");
        assert.equal(movimientoDt({ fecha: "2026-09-11", hora: null }), "2026-09-11T00:00:00");
        assert.equal(movimientoDt({ fecha: null, hora: "10:00:00" }), null);
        assert.equal(latestMovimiento([])?.id, undefined);
    });
});

describe("llaveros: carga y alcance", () => {
    const mk = (id: number, contrato: number) => ({ ...raw, id, contrato_id: contrato, e_movimiento_llavero: [], e_llave_en_llavero: [] });
    const data = [mk(1, 4), mk(2, 9)];
    let seen: any;
    const query = async (_db: any, filters: any, orderKey: string) => { seen = { filters, orderKey }; return data; };
    const table = (rows: any[]) => ({ findMany: async (a: any) => rows.filter((r) => !a?.where?.id?.in || a.where.id.in.includes(r.id)) });
    const db = {
        c_empleado: { findMany: async (a: any) => [{ id: 11, nombre: "Carla", primer_apellido: "Soto", segundo_apellido: null }, { id: 12, nombre: "Luis", primer_apellido: "Mena", segundo_apellido: null }].filter((e) => a.where.id.in.includes(e.id)) },
        // historial: el llavero 2 se creó y se editó (vale el último); el 1 no tiene cambios; un cambio de otra tabla con el mismo registro no cuenta
        c_cambios_apps_modules: { findMany: async (a: any) => [
            { id: 1, nombre_tabla: "e_llavero", registro_id: 2, created_by: 11, created_at: new Date("2026-09-10T15:30:00Z") },
            { id: 2, nombre_tabla: "e_llavero", registro_id: 2, created_by: 12, created_at: new Date("2026-09-12T10:00:00Z") },
            { id: 3, nombre_tabla: "e_movimiento_llavero", registro_id: 1, created_by: 12, created_at: new Date("2026-09-13T10:00:00Z") },
        ].filter((c) => c.nombre_tabla === a.where.nombre_tabla && a.where.registro_id.in.includes(c.registro_id)) },
        e_estructura_sucursal: table([{ id: 5, ejecutivoCuenta_id: 10 }]),
        n_ejecutivo_cuenta: table([{ id: 10, nombre: "Ana Rojas" }]),
    } as any;
    const params = (extra: Record<string, string> = {}) => parseReportParams(new URLSearchParams({ from: "2026-09-01", to: "2026-10-01", ...extra }));
    it("pide el periodo [from, to) con límite inclusivo al último día", async () => {
        await loadLlaveros(db, params(), query);
        assert.deepEqual(seen, { filters: { creadoDesde: "2026-09-01T00:00:00", creadoHasta: "2026-09-30T23:59:59" }, orderKey: "created_at" });
    });
    it("sin alcance trae todo; con alcance solo los nodos pedidos; vacío no ve nada", async () => {
        assert.equal((await loadLlaveros(db, params(), query)).length, 2);
        const one = await loadLlaveros(db, params({ scope: "contrato:9" }), query);
        assert.deepEqual(one.map((r) => r.id), [2]);
        assert.equal(one[0]!.creado_por, "Carla Soto");
        assert.deepEqual([one[0]!.modificado, one[0]!.modificado_por], ["2026-09-12T10:00:00", "Luis Mena"]);
        const todos = await loadLlaveros(db, params(), query);
        assert.deepEqual([todos[0]!.modificado, todos[0]!.modificado_por], [null, null]);
        assert.equal(one[0]!.ejecutivo_cuenta, "Ana Rojas");
        assert.equal((await loadLlaveros(db, params({ scope: "contrato:4,puesto:6" }), query)).length, 2);
        assert.equal((await loadLlaveros(db, params({ scope: "empresa:77" }), query)).length, 0);
        assert.equal((await loadLlaveros(db, params({ scope: "" }), query)).length, 0);
    });
    it("declara alcance y sus claves de filtro, orden y búsqueda existen en la fila", () => {
        assert.equal(llaveros.supportsScope, true);
        const o = mapLlaveroRow(raw);
        for (const k of [...llaveros.searchKeys, ...llaveros.filterKeys, ...llaveros.sortKeys, llaveros.defaultSort]) assert.ok(k in o, k);
    });
});
