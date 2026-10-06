import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseReportParams } from "../params";
import { llaves, loadLlaves, mapLlaveRow } from "./llaves";

const raw = {
    id: 21, created_at: new Date("2026-09-10T15:30:00Z"), numero_llave: "K-21", lugar_abre: "Bodega norte", cantidad_copias: 3,
    empresa_id: 1, cliente_id: 2, division_id: 3, contrato_id: 4, corpo_id: 5, puesto_id: 6,
    empresa_nombre: "9 - Empresa", cliente_nombre: "Cliente", division_nombre: "División", contrato_nombre: "C1 - Contrato", corpo_nombre: "S1 - Sucursal", puesto_nombre: "P1 - Puesto",
    observaciones: "y".repeat(800), firma_responsable: "data:image/png;base64,AAAA", created_by: 11,
    e_llave_en_llavero: [{ e_llavero: { id: 1, nombre_llavero: "Llavero A" } }, { e_llavero: { id: 2, nombre_llavero: "Llavero B" } }],
    e_movimiento_llave: [
        { id: 5, nombre_persona_entrega: "Ana", nombre_persona_recibe: "Beto", telefono: "8888-0000", fecha: new Date("2026-09-11T00:00:00Z"), hora: new Date("1970-01-01T08:15:00Z"), firma_entrega: "data:image/png;base64,BBBB", firma_recibe: "data:image/png;base64,CCCC", firma_responsable: "data:image/png;base64,DDDD" },
        { id: 4, nombre_persona_entrega: "Zoe", nombre_persona_recibe: "Ana", telefono: "1", fecha: new Date("2026-09-10T00:00:00Z"), hora: new Date("1970-01-01T09:00:00Z") },
    ],
};

describe("llaves: mapeo", () => {
    it("aplana la fila con ubicación, llaveros y último movimiento", () => {
        const o = mapLlaveRow(raw, { nombre: "Carla", primer_apellido: "Soto", segundo_apellido: "Ruiz" });
        assert.equal(o.id, 21);
        assert.equal(o.creado, "2026-09-10T15:30:00");
        assert.deepEqual([o.numero, o.lugar_abre, o.copias], ["K-21", "Bodega norte", 3]);
        assert.deepEqual([o.empresa, o.cliente, o.division, o.contrato, o.sucursal, o.puesto], ["9 - Empresa", "Cliente", "División", "C1 - Contrato", "S1 - Sucursal", "P1 - Puesto"]);
        assert.deepEqual([o.llaveros, o.movimientos], ["Llavero A; Llavero B", 2]);
        assert.deepEqual([o.ultimo_movimiento, o.ultima_entrega, o.ultima_recibe], ["2026-09-11T08:15:00", "Ana", "Beto"]);
        assert.equal((o.observaciones as string).length, 500);
        assert.equal(o.creado_por, "Carla Soto Ruiz");
    });
    it("nunca expone firmas ni teléfonos", () => {
        const s = JSON.stringify(mapLlaveRow(raw));
        for (const bad of ["base64", "8888-0000", "firma"]) assert.equal(s.includes(bad), false, bad);
    });
    it("tolera nulos", () => {
        const o = mapLlaveRow({ id: 1, created_at: null, numero_llave: null, lugar_abre: "", cantidad_copias: null, observaciones: null });
        assert.deepEqual([o.creado, o.numero, o.lugar_abre, o.copias, o.llaveros, o.movimientos, o.ultimo_movimiento, o.ultima_recibe, o.creado_por], [null, null, null, null, null, 0, null, null, null]);
    });
});

describe("llaves: carga y alcance", () => {
    const mk = (id: number, corpo: number) => ({ ...raw, id, corpo_id: corpo, e_movimiento_llave: [], e_llave_en_llavero: [] });
    const data = [mk(1, 5), mk(2, 8)];
    let seen: any;
    const query = async (_db: any, filters: any, orderKey: string) => { seen = { filters, orderKey }; return data; };
    const db = { c_empleado: { findMany: async () => [] } } as any;
    const params = (extra: Record<string, string> = {}) => parseReportParams(new URLSearchParams({ from: "2026-09-01", to: "2026-10-01", ...extra }));
    it("pide el periodo [from, to) con límite inclusivo al último día", async () => {
        await loadLlaves(db, params(), query);
        assert.deepEqual(seen, { filters: { creadoDesde: "2026-09-01T00:00:00", creadoHasta: "2026-09-30T23:59:59" }, orderKey: "created_at" });
    });
    it("filtra por alcance (unión de nodos) y un alcance vacío no ve nada", async () => {
        assert.equal((await loadLlaves(db, params(), query)).length, 2);
        assert.deepEqual((await loadLlaves(db, params({ scope: "corpo:8" }), query)).map((r) => r.id), [2]);
        assert.deepEqual((await loadLlaves(db, params({ scope: "corpo:8,cliente:2" }), query)).map((r) => r.id), [1, 2]);
        assert.equal((await loadLlaves(db, params({ scope: "" }), query)).length, 0);
    });
    it("declara alcance y sus claves existen en la fila", () => {
        assert.equal(llaves.supportsScope, true);
        const o = mapLlaveRow(raw);
        for (const k of [...llaves.searchKeys, ...llaves.filterKeys, ...llaves.sortKeys, llaves.defaultSort]) assert.ok(k in o, k);
    });
});
