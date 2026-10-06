import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filterVisitasByScope, mapRegistroVisitaRow, registroVisitas } from "./registroVisitas";

const raw = {
    id: 41,
    hora_entrada: new Date("2026-09-10T08:15:30Z"),
    hora_salida: null,
    nombre: " Juan Pérez ",
    cedula: "1-0234-0567",
    es_funcionario: false,
    razon_visita: "Reunión con administración",
    dep_pers_visita: "Contabilidad",
    pers_autoriza_salida: null,
    responsable_label: "Ana Mora Solís",
    empresa_id: 1, cliente_id: 5, division_id: 0, contrato_id: 2, corpo_id: 3, puesto_id: 7, puesto_salida_id: null,
    empresa_nombre: "Empresa Uno",
    division_nombre: "",
    contrato_nombre: "CT-2 - Contrato Dos",
    puesto_salida_nombre: "",
    e_estructura_cliente: { id: 5, nombre: "Cliente Cinco" },
    e_estructura_sucursal: { id: 3, nombre: "Sucursal Tres" },
    e_estructura_puesto: { id: 7, nombre: "Recepción" },
    e_activo_visitante: [{ id: 1 }, { id: 2 }],
    observaciones: "x".repeat(600),
    foto_cedula: "cedula.jpg",
    firma_visitante: "data:image/png;base64,AAAA",
};

describe("registro_visitas: mapeo", () => {
    it("aplana la fila, recorta textos y trata faltantes como null", () => {
        const o = mapRegistroVisitaRow(raw);
        assert.equal(o.id, 41);
        assert.equal(o.entrada, "2026-09-10T08:15:30");
        assert.equal(o.salida, null);
        assert.equal(o.visitante, "Juan Pérez");
        assert.equal(o.funcionario, "No");
        assert.equal(o.depto_visita, "Contabilidad");
        assert.equal(o.autoriza_salida, null);
        assert.equal(o.empresa, "Empresa Uno");
        assert.equal(o.division, null);
        assert.equal(o.contrato, "CT-2 - Contrato Dos");
        assert.equal(o.sucursal, "Sucursal Tres");
        assert.equal(o.puesto, "Recepción");
        assert.equal(o.puesto_salida, null);
        assert.equal(o.activos, 2);
        assert.equal((o.observaciones as string).length, 500);
    });
    it("nunca expone foto de la cédula ni firma", () => {
        const o = mapRegistroVisitaRow(raw);
        assert.ok(!JSON.stringify(o).includes("cedula.jpg") && !JSON.stringify(o).includes("base64"));
        assert.deepEqual(Object.keys(o).filter((k) => /foto|firma/.test(k)), []);
    });
    it("el id de la estructura que la consulta usa de relleno cuenta como sin dato", () => {
        const o = mapRegistroVisitaRow({ ...raw, empresa_nombre: "0", empresa_id: 0, e_estructura_puesto: null, e_activo_visitante: undefined });
        assert.equal(o.empresa, null);
        assert.equal(o.puesto, null);
        assert.equal(o.activos, 0);
    });
    it("las claves del módulo existen en la fila", () => {
        const o = mapRegistroVisitaRow(raw);
        for (const k of [...registroVisitas.searchKeys, ...registroVisitas.filterKeys, ...registroVisitas.sortKeys, registroVisitas.defaultSort]) assert.ok(k in o, k);
    });
});

describe("registro_visitas: alcance", () => {
    const rows = [raw, { ...raw, id: 42, contrato_id: 9, corpo_id: 8, puesto_id: 70 }, { ...raw, id: 43, contrato_id: 0, corpo_id: 0, puesto_id: 0 }];
    it("sin alcance devuelve todo", () => assert.equal(filterVisitasByScope(rows, null).length, 3));
    it("une los nodos pedidos", () => {
        assert.deepEqual(filterVisitasByScope(rows, [{ nivel: "contrato", id: 2 }]).map((r) => r.id), [41]);
        assert.deepEqual(filterVisitasByScope(rows, [{ nivel: "contrato", id: 2 }, { nivel: "puesto", id: 70 }]).map((r) => r.id), [41, 42]);
        assert.deepEqual(filterVisitasByScope(rows, [{ nivel: "cliente", id: 5 }]).map((r) => r.id), [41, 42, 43]);
    });
    it("alcance vacío no ve nada y filas sin ubicación no entran a un nodo concreto", () => {
        assert.equal(filterVisitasByScope(rows, []).length, 0);
        assert.ok(!filterVisitasByScope(rows, [{ nivel: "puesto", id: 7 }]).some((r) => r.id === 43));
    });
});
