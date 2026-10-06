import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { entregaPuesto, filterEntregasByScope, mapEntregaPuestoRow } from "./entregaPuesto";

const raw = (o: Record<string, unknown> = {}) => ({
    id: 3, created_at: new Date("2026-09-22T06:10:00Z"),
    cliente_id: 4, corpo_id: 55, puesto_id: 140, empresa_id_resolved: 9,
    empresa_nombre: "9 — Seguridad SA", cliente_nombre: "Cliente Uno", division_nombre: "Seguridad", contrato_nombre: "C-31 — Contrato", corpo_nombre: "55 — Sede", puesto_nombre: "P140 — Portón",
    e_estructura_sucursal: { contrato_id: 31, e_estructura_contrato: { division_id: 2 } },
    oficial_entrega: "Ana Soto", fecha_entrada_entrega: new Date("2026-09-21T00:00:00Z"), hora_entrada_entrega: new Date("1970-01-01T18:00:00Z"),
    fecha_salida_entrega: new Date("2026-09-22T00:00:00Z"), hora_salida_entrega: new Date("1970-01-01T06:00:00Z"), turno_entrega: "N",
    oficial_recibe: "Luis Mora", fecha_entrada_recibe: new Date("2026-09-22T00:00:00Z"), hora_entrada_recibe: "1970-01-01T06:00:00.000Z",
    fecha_salida_recibe: new Date("2026-09-22T00:00:00Z"), hora_salida_recibe: "14:00:00", turno_recibe: "D",
    marca_entrega_id: 123, marca_recibe_id: null,
    articulos_puesto: JSON.stringify([{ nombre: "Radio", estado: "Bueno" }, { nombre: "Linterna", estado: "Malo", observaciones: "sin pilas" }, { nombre: "Llave", estado: "No está" }]),
    observaciones: "o".repeat(700), firma_entrega: "data:image/png;base64,AAAA", firma_recibe: "BBBB", firma_responsable: "CCCC",
    ...o,
});

describe("entrega de puesto: mapeo", () => {
    it("une fecha y hora, traduce turnos y cuenta artículos", () => {
        const o = mapEntregaPuestoRow(raw());
        assert.equal(o.creado, "2026-09-22T06:10:00");
        assert.equal(o.entrada_entrega, "2026-09-21T18:00:00");
        assert.equal(o.salida_entrega, "2026-09-22T06:00:00");
        assert.equal(o.entrada_recibe, "2026-09-22T06:00:00");
        assert.equal(o.salida_recibe, "2026-09-22T14:00:00");
        assert.equal(o.turno_entrega, "Nocturno");
        assert.equal(o.turno_recibe, "Diurno");
        assert.equal(o.articulos, 3);
        assert.equal(o.articulos_con_novedad, 2);
        assert.equal(o.division, "Seguridad");
        assert.equal(o.sucursal, "55 — Sede");
        assert.equal((o.observaciones as string).length, 500);
    });
    it("no expone firmas, ids de marca ni el detalle de los artículos", () => {
        const o = mapEntregaPuestoRow(raw());
        const json = JSON.stringify(o);
        for (const s of ["base64", "BBBB", "CCCC", "sin pilas", "Linterna"]) assert.equal(json.includes(s), false, s);
        assert.deepEqual(Object.keys(o).filter((k) => k.includes("marca") || k.includes("firma")), []);
    });
    it("campos opcionales vacíos, artículos rotos y ubicaciones sin resolver dan nulos", () => {
        const o = mapEntregaPuestoRow(raw({ oficial_entrega: null, fecha_entrada_entrega: null, hora_entrada_entrega: null, fecha_salida_entrega: new Date("2026-09-22T00:00:00Z"), hora_salida_entrega: null, turno_entrega: null, articulos_puesto: "{roto", observaciones: "", empresa_id_resolved: 0, empresa_nombre: "", e_estructura_sucursal: null, division_nombre: "" }));
        assert.equal(o.oficial_entrega, null);
        assert.equal(o.entrada_entrega, null);
        assert.equal(o.salida_entrega, "2026-09-22T00:00:00"); // hay fecha pero no hora
        assert.equal(o.turno_entrega, null);
        assert.equal(o.articulos, 0);
        assert.equal(o.articulos_con_novedad, 0);
        assert.equal(o.observaciones, null);
        assert.equal(o.empresa, null);
        assert.equal(o.division, null);
    });
    it("el módulo declara columnas de búsqueda, filtro y orden que existen en la fila", () => {
        const cols = Object.keys(mapEntregaPuestoRow(raw()));
        for (const k of [...entregaPuesto.searchKeys, ...entregaPuesto.filterKeys, ...entregaPuesto.sortKeys, entregaPuesto.defaultSort]) assert.ok(cols.includes(k), k);
    });
});

describe("entrega de puesto: alcance", () => {
    const tables: Record<string, any[]> = {
        e_estructura_puesto: [{ id: 140, sucursal_id: 55 }, { id: 141, sucursal_id: 56 }],
        e_estructura_sucursal: [{ id: 55, contrato_id: 31 }, { id: 56, contrato_id: 32 }],
        e_estructura_contrato: [{ id: 31, cliente_id: 4, empresa_id: 9, division_id: 2 }, { id: 32, cliente_id: 5, empresa_id: 9, division_id: 2 }],
    };
    const db = new Proxy({}, { get: (_t, name: string) => ({ findMany: async (a: any) => (tables[name] ?? []).filter((r) => !a?.where?.id?.in || a.where.id.in.includes(r.id)) }) }) as any;
    const rows = [raw({ id: 1, puesto_id: 140 }), raw({ id: 2, puesto_id: 141 }), raw({ id: 3, puesto_id: 999 })];
    it("deduce la ubicación del puesto; los puestos desconocidos quedan fuera con alcance", async () => {
        assert.equal((await filterEntregasByScope(db, rows, null)).length, 3);
        assert.deepEqual((await filterEntregasByScope(db, rows, [{ nivel: "contrato", id: 32 }])).map((r) => r.id), [2]);
        assert.deepEqual((await filterEntregasByScope(db, rows, [{ nivel: "empresa", id: 9 }])).map((r) => r.id), [1, 2]);
        assert.deepEqual(await filterEntregasByScope(db, rows, []), []);
    });
});
