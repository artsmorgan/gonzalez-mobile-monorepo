import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filterCapacitacionesByScope, mapRegistroCapacitacionRow, registroCapacitaciones } from "./registroCapacitaciones";

const raw = {
    id: 5,
    fecha: new Date("2026-09-03T00:00:00Z"),
    titulo: "Uso de extintores",
    tipo: "Presencial",
    resultado: null,
    descripcion: "d".repeat(800),
    observaciones: "",
    responsable_nombre: "S-1 - Marta Rojas",
    cedula_responsable: "1-1111-2222",
    empresa_id: 1, cliente_id: 5, division_id: 0, contrato_id: 2, corpo_id: 3, puesto_id: 0,
    empresa_nombre: "E1 - Empresa Uno",
    cliente_nombre: "Cliente Cinco",
    division_nombre: "—",
    contrato_nombre: "CT-2 - Contrato Dos",
    corpo_nombre: "Sucursal Tres",
    puesto_nombre: "—",
    empleados_cap: [{ id: 1, label: "A1 - Luis Vega", cedula: "3-1", resultado: null }, { id: 2, label: "A2 - Eva Soto", cedula: "3-2", resultado: null }],
    puestos_cap: [{ id: 70, label: "P70 - Recepción", resultado: null }],
    firma_responsable: "data:image/png;base64,ZZZZ",
    file: "/uploads/cap/5/lista.pdf",
};

describe("registro_capacitaciones: mapeo", () => {
    it("mapea la fila (fecha sin hora, conteos, participantes)", () => {
        const o = mapRegistroCapacitacionRow(raw);
        assert.equal(o.id, 5);
        assert.equal(o.fecha, "2026-09-03T00:00:00");
        assert.equal(o.titulo, "Uso de extintores");
        assert.equal(o.resultado, null);
        assert.equal(o.responsable, "S-1 - Marta Rojas");
        assert.equal(o.cedula_responsable, "1-1111-2222");
        assert.equal(o.empresa, "E1 - Empresa Uno");
        assert.equal(o.division, null);
        assert.equal(o.puesto, null);
        assert.equal(o.empleados, 2);
        assert.equal(o.puestos, 1);
        assert.equal(o.participantes, "A1 - Luis Vega; A2 - Eva Soto");
        assert.equal((o.descripcion as string).length, 500);
        assert.equal(o.observaciones, null);
    });
    it("no expone la firma ni el archivo", () => {
        const s = JSON.stringify(mapRegistroCapacitacionRow(raw));
        assert.ok(!s.includes("base64") && !s.includes("lista.pdf"));
    });
    it("sin participantes ni puestos da ceros y null", () => {
        const o = mapRegistroCapacitacionRow({ ...raw, empleados_cap: [], puestos_cap: undefined });
        assert.equal(o.empleados, 0);
        assert.equal(o.puestos, 0);
        assert.equal(o.participantes, null);
    });
    it("recorta los participantes a 500 caracteres", () => {
        const many = Array.from({ length: 80 }, (_, i) => ({ id: i, label: `Empleado número ${i}` }));
        assert.equal((mapRegistroCapacitacionRow({ ...raw, empleados_cap: many }).participantes as string).length, 500);
    });
    it("las claves del módulo existen en la fila", () => {
        const o = mapRegistroCapacitacionRow(raw);
        for (const k of [...registroCapacitaciones.searchKeys, ...registroCapacitaciones.filterKeys, ...registroCapacitaciones.sortKeys, registroCapacitaciones.defaultSort]) assert.ok(k in o, k);
    });
});

describe("registro_capacitaciones: alcance", () => {
    const db = {
        e_estructura_puesto: { findMany: async () => [{ id: 70, sucursal_id: 30 }] },
        e_estructura_sucursal: { findMany: async () => [{ id: 30, contrato_id: 20 }] },
        e_estructura_contrato: { findMany: async () => [{ id: 20, cliente_id: 50, empresa_id: 1, division_id: null }] },
    };
    const rows = [raw, { ...raw, id: 6, contrato_id: 9, corpo_id: 8, puestos_cap: [] }, { ...raw, id: 7, empresa_id: 1, contrato_id: 0, corpo_id: 0, cliente_id: 0, puestos_cap: [{ id: 70 }] }];
    it("sin alcance devuelve todo", async () => assert.equal((await filterCapacitacionesByScope(db, rows, null)).length, 3));
    it("usa la ubicación de la cabecera", async () => {
        assert.deepEqual((await filterCapacitacionesByScope(db, rows, [{ nivel: "contrato", id: 9 }])).map((r) => r.id), [6]);
    });
    it("también cuenta si un puesto destinatario cae en el alcance", async () => {
        assert.deepEqual((await filterCapacitacionesByScope(db, rows, [{ nivel: "contrato", id: 20 }])).map((r) => r.id), [5, 7]);
        assert.deepEqual((await filterCapacitacionesByScope(db, rows, [{ nivel: "puesto", id: 70 }])).map((r) => r.id), [5, 7]);
    });
    it("alcance vacío no ve nada", async () => assert.equal((await filterCapacitacionesByScope(db, rows, [])).length, 0));
});
