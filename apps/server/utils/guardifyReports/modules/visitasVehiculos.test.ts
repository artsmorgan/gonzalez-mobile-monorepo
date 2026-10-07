import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { enrichVehiculos, filterByEntrada, filterVehiculosByScope, mapVisitaVehiculoRow, visitasVehiculos } from "./visitasVehiculos";

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
    responsable_id: 20,
    c_empleado: { id: 20, codigo: "E-20", nombre: "Ana", primer_apellido: "Mora", segundo_apellido: null },
    departamento_visita: "Bodega",
    persona_visita: "Carlos",
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
    it("responsable sale como «código - nombre» (solo el nombre si no hay código)", () => {
        assert.equal(mapVisitaVehiculoRow(raw).responsable, "E-20 - Ana Mora");
        assert.equal(mapVisitaVehiculoRow({ ...raw, c_empleado: { ...raw.c_empleado, codigo: null } }).responsable, "Ana Mora");
        assert.equal(mapVisitaVehiculoRow({ ...raw, c_empleado: undefined }).responsable, "Ana Mora");
    });
    it("columnas para filtros al final: departamento, persona_visita, ejecutivo_cuenta, usuario_inserta y la división del contrato", () => {
        const o = mapVisitaVehiculoRow({ ...raw, division_contrato: "Seguridad", ejecutivo_cuenta_nombre: "Rosa Vega", usuario_inserta_nombre: "Ana Mora" });
        assert.equal(o.departamento, "Bodega");
        assert.equal(o.persona_visita, "Carlos");
        assert.equal(o.division, "Seguridad");
        assert.equal(o.ejecutivo_cuenta, "Rosa Vega");
        assert.equal(o.usuario_inserta, "Ana Mora");
        assert.deepEqual(Object.keys(o).slice(-4), ["departamento", "persona_visita", "ejecutivo_cuenta", "usuario_inserta"]);
        const sin = mapVisitaVehiculoRow({ ...raw, departamento_visita: " ", persona_visita: null });
        assert.equal(sin.departamento, null);
        assert.equal(sin.persona_visita, null);
        assert.equal(sin.ejecutivo_cuenta, null);
        assert.equal(sin.usuario_inserta, null);
        assert.equal(sin.division, null);
    });
    it("recorta el motivo a 500 caracteres", () => {
        assert.equal((mapVisitaVehiculoRow({ ...raw, razon_visita: "y".repeat(900) }).motivo as string).length, 500);
    });
    it("las claves del módulo existen en la fila", () => {
        const o = mapVisitaVehiculoRow(raw);
        for (const k of [...visitasVehiculos.searchKeys, ...visitasVehiculos.filterKeys, ...visitasVehiculos.sortKeys, visitasVehiculos.defaultSort]) assert.ok(k in o, k);
    });
});

describe("visitas_vehiculos: enriquecimiento por lote", () => {
    let calls = 0;
    const table = (rows: any[]) => ({ findMany: async (a: any) => { calls++; return rows.filter((r) => a.where.id.in.includes(r.id)); } });
    const db: any = {
        e_estructura_sucursal: table([{ id: 3, ejecutivoCuenta_id: 10 }]),
        n_ejecutivo_cuenta: table([{ id: 10, nombre: "Rosa Vega" }]),
        e_estructura_contrato: table([{ id: 2, division_id: 20 }]),
        n_division: table([{ id: 20, nombre: "Seguridad" }]),
        c_empleado: table([{ id: 20, nombre: "Ana", primer_apellido: "Mora" }]),
    };
    it("trae ejecutivo, división y usuario en lote (no por fila) y los mapea", async () => {
        const out = (await enrichVehiculos(db, [raw, { ...raw, id: 10 }, { ...raw, id: 11, corpo_id: 0, contrato_id: 0, responsable_id: 0 }])).map(mapVisitaVehiculoRow);
        assert.equal(calls, 5); // sucursal, ejecutivo, contrato, división y empleado: una consulta cada uno
        assert.equal(out[0].ejecutivo_cuenta, "Rosa Vega");
        assert.equal(out[0].division, "Seguridad");
        assert.equal(out[1].usuario_inserta, "Ana Mora");
        assert.equal(out[2].ejecutivo_cuenta, null);
        assert.equal(out[2].usuario_inserta, null);
    });
});

describe("visitas_vehiculos: periodo por entrada", () => {
    const rows = [
        { id: 1, hora_entrada: new Date("2026-09-09T23:59:59Z") },
        { id: 2, hora_entrada: new Date("2026-09-10T00:00:00Z") },
        { id: 3, hora_entrada: new Date("2026-09-30T23:59:59Z") },
        { id: 4, hora_entrada: new Date("2026-10-01T00:00:00Z") },
    ];
    it("from inclusivo, to exclusivo, sobre la hora de entrada", () => {
        assert.deepEqual(filterByEntrada(rows, "2026-09-10", "2026-10-01").map((r) => r.id), [2, 3]);
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
