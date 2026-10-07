import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { enrichVisitas, filterByEntrada, filterVisitasByScope, mapRegistroVisitaRow, registroVisitas } from "./registroVisitas";

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
    responsable_id: 20,
    c_empleado: { id: 20, codigo: "E-20", nombre: "Ana", primer_apellido: "Mora", segundo_apellido: "Solís" },
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
    it("responsable sale como «código - nombre» (solo el nombre si no hay código)", () => {
        assert.equal(mapRegistroVisitaRow(raw).responsable, "E-20 - Ana Mora Solís");
        assert.equal(mapRegistroVisitaRow({ ...raw, c_empleado: { ...raw.c_empleado, codigo: "" } }).responsable, "Ana Mora Solís");
        assert.equal(mapRegistroVisitaRow({ ...raw, c_empleado: undefined }).responsable, "Ana Mora Solís");
    });
    it("columnas para filtros al final: ejecutivo_cuenta, usuario_inserta y la división del contrato", () => {
        const o = mapRegistroVisitaRow({ ...raw, division_contrato: " Seguridad ", ejecutivo_cuenta_nombre: "Rosa Vega", usuario_inserta_nombre: "Ana Mora Solís" });
        assert.equal(o.division, "Seguridad");
        assert.equal(o.ejecutivo_cuenta, "Rosa Vega");
        assert.equal(o.usuario_inserta, "Ana Mora Solís");
        assert.deepEqual(Object.keys(o).slice(-3), ["observaciones", "ejecutivo_cuenta", "usuario_inserta"]);
        const sin = mapRegistroVisitaRow(raw);
        assert.equal(sin.ejecutivo_cuenta, null);
        assert.equal(sin.usuario_inserta, null);
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

describe("registro_visitas: enriquecimiento por lote", () => {
    let calls = 0;
    const table = (rows: any[]) => ({ findMany: async (a: any) => { calls++; return rows.filter((r) => a.where.id.in.includes(r.id)); } });
    const db: any = {
        e_estructura_sucursal: table([{ id: 3, ejecutivoCuenta_id: 10 }]),
        n_ejecutivo_cuenta: table([{ id: 10, nombre: "Rosa Vega" }]),
        e_estructura_contrato: table([{ id: 2, division_id: 20 }]),
        n_division: table([{ id: 20, nombre: "Seguridad" }]),
        c_empleado: table([{ id: 20, nombre: "Ana", primer_apellido: "Mora", segundo_apellido: "Solís" }]),
    };
    it("trae ejecutivo, división y usuario en lote (no por fila) y los mapea", async () => {
        const rows = [raw, { ...raw, id: 42 }, { ...raw, id: 43, corpo_id: 0, contrato_id: 0, responsable_id: 0 }];
        const out = (await enrichVisitas(db, rows)).map(mapRegistroVisitaRow);
        assert.equal(calls, 5); // sucursal, ejecutivo, contrato, división y empleado: una consulta cada uno, no una por fila
        assert.equal(out[0].ejecutivo_cuenta, "Rosa Vega");
        assert.equal(out[0].division, "Seguridad");
        assert.equal(out[1].usuario_inserta, "Ana Mora Solís");
        assert.equal(out[2].ejecutivo_cuenta, null);
        assert.equal(out[2].division, null);
        assert.equal(out[2].usuario_inserta, null);
    });
});

describe("registro_visitas: periodo por entrada", () => {
    const rows = [
        { id: 1, hora_entrada: new Date("2026-09-09T23:59:59Z") },
        { id: 2, hora_entrada: new Date("2026-09-10T00:00:00Z") },
        { id: 3, hora_entrada: new Date("2026-09-30T23:59:59Z") },
        { id: 4, hora_entrada: new Date("2026-10-01T00:00:00Z") },
        { id: 5, hora_entrada: null },
    ];
    it("from inclusivo, to exclusivo, sobre la hora de entrada", () => {
        assert.deepEqual(filterByEntrada(rows, "2026-09-10", "2026-10-01").map((r) => r.id), [2, 3]);
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
