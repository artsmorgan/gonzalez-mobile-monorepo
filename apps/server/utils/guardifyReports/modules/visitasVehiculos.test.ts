import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filterVehiculosByScope, mapVisitaVehiculoRow, visitasVehiculos } from "./visitasVehiculos";

const raw = {
    id: 9,
    hora_entrada: new Date("2026-09-12T14:00:00Z"),
    hora_salida: new Date("2026-09-12T15:30:00Z"),
    tipo: "Camión",
    placa: "ABC-123",
    nombre: "Pedro Gómez",
    cedula: "2-0111-0222",
    razon_visita: "Entrega de insumos",
    persona_lugar_visita: "Bodega / Carlos",
    responsable_label: "Ana Mora",
    empresa_id: 0, cliente_id: 5, division_id: 0, contrato_id: 2, corpo_id: 3, puesto_id: 7,
    empresa_nombre: "0",
    division_nombre: "0",
    contrato_nombre: "CT-2 - Contrato Dos",
    puesto_salida_nombre: "P-9 - Portón",
    e_estructura_cliente: { id: 5, nombre: "Cliente Cinco" },
    e_estructura_sucursal: { id: 3, nombre: "Sucursal Tres" },
    e_estructura_puesto: { id: 7, nombre: "Portón principal" },
    file_name: "/uploads/vehiculos/9/foto.jpg",
};

describe("visitas_vehiculos: mapeo", () => {
    it("aplana la fila y trata los rellenos de id como nulos", () => {
        const o = mapVisitaVehiculoRow(raw);
        assert.equal(o.id, 9);
        assert.equal(o.entrada, "2026-09-12T14:00:00");
        assert.equal(o.salida, "2026-09-12T15:30:00");
        assert.equal(o.tipo, "Camión");
        assert.equal(o.placa, "ABC-123");
        assert.equal(o.persona_lugar_visita, "Bodega / Carlos");
        assert.equal(o.empresa, null);
        assert.equal(o.division, null);
        assert.equal(o.contrato, "CT-2 - Contrato Dos");
        assert.equal(o.puesto, "Portón principal");
        assert.equal(o.puesto_salida, "P-9 - Portón");
    });
    it("con nulos no revienta y no expone el archivo", () => {
        const o = mapVisitaVehiculoRow({ ...raw, hora_salida: null, persona_lugar_visita: "", e_estructura_cliente: null, razon_visita: null, puesto_salida_nombre: "" });
        assert.equal(o.salida, null);
        assert.equal(o.persona_lugar_visita, null);
        assert.equal(o.cliente, null);
        assert.equal(o.motivo, null);
        assert.ok(!JSON.stringify(o).includes("foto.jpg"));
    });
    it("recorta el motivo a 500 caracteres", () => {
        assert.equal((mapVisitaVehiculoRow({ ...raw, razon_visita: "y".repeat(900) }).motivo as string).length, 500);
    });
    it("las claves del módulo existen en la fila", () => {
        const o = mapVisitaVehiculoRow(raw);
        for (const k of [...visitasVehiculos.searchKeys, ...visitasVehiculos.filterKeys, ...visitasVehiculos.sortKeys, visitasVehiculos.defaultSort]) assert.ok(k in o, k);
    });
});

describe("visitas_vehiculos: alcance", () => {
    const rows = [raw, { ...raw, id: 10, corpo_id: 4, puesto_id: 8, contrato_id: 6 }];
    it("filtra por la unión de los nodos", () => {
        assert.equal(filterVehiculosByScope(rows, null).length, 2);
        assert.deepEqual(filterVehiculosByScope(rows, [{ nivel: "corpo", id: 4 }]).map((r) => r.id), [10]);
        assert.deepEqual(filterVehiculosByScope(rows, [{ nivel: "puesto", id: 7 }, { nivel: "contrato", id: 6 }]).map((r) => r.id), [9, 10]);
        assert.equal(filterVehiculosByScope(rows, []).length, 0);
    });
});
