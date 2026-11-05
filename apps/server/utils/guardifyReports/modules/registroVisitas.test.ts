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
    created_at: new Date("2026-09-10T08:20:00Z"),
    updated_at: new Date("2026-09-10T09:00:00Z"),
    puesto_salida_nombre: "",
    ubicacion: { empresa: "1 - Empresa Uno", cliente: "Cliente Cinco", division: null, contrato: "CT-2 - Contrato Dos", sucursal: "S3 - Sucursal Tres", puesto: "P7 - Recepción" },
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
        assert.equal(o.empresa, "1 - Empresa Uno");
        assert.equal(o.division, null);
        assert.equal(o.contrato, "CT-2 - Contrato Dos");
        assert.equal(o.sucursal, "S3 - Sucursal Tres");
        assert.equal(o.puesto, "P7 - Recepción");
        assert.equal(o.puesto_salida, null);
        assert.equal(o.activos, 2);
        assert.equal((o.observaciones as string).length, 500);
    });
    it("responsable sale como «código - nombre» (solo el nombre si no hay código)", () => {
        assert.equal(mapRegistroVisitaRow(raw).responsable, "E-20 - Ana Mora Solís");
        assert.equal(mapRegistroVisitaRow({ ...raw, c_empleado: { ...raw.c_empleado, codigo: "" } }).responsable, "Ana Mora Solís");
        assert.equal(mapRegistroVisitaRow({ ...raw, c_empleado: undefined }).responsable, "Ana Mora Solís");
    });
    it("columnas para filtros al final: ejecutivo_cuenta, la división del contrato y las de auditoría", () => {
        const o = mapRegistroVisitaRow({ ...raw, division_contrato: " Seguridad ", ejecutivo_cuenta_nombre: "Rosa Vega", creado_por_nombre: "Ana Mora Solís", modificado_por_nombre: "Luis Mena" });
        assert.equal(o.division, "Seguridad");
        assert.equal(o.ejecutivo_cuenta, "Rosa Vega");
        assert.deepEqual(Object.keys(o).slice(-4), ["ejecutivo_cuenta", "creado_por", "modificado", "modificado_por"]);
        const sin = mapRegistroVisitaRow(raw);
        assert.equal(sin.ejecutivo_cuenta, null);
        assert.equal(sin.creado_por, null);
        assert.equal(sin.modificado_por, null);
        assert.ok(!("usuario_inserta" in sin));
    });
    it("columnas estándar: jerarquía (6) y auditoría (id, creado, creado_por, modificado, modificado_por)", () => {
        const o = mapRegistroVisitaRow({ ...raw, creado_por_nombre: "Ana Mora Solís", modificado_por_nombre: "Luis Mena" });
        assert.deepEqual([o.empresa, o.cliente, o.division, o.contrato, o.sucursal, o.puesto], ["1 - Empresa Uno", "Cliente Cinco", null, "CT-2 - Contrato Dos", "S3 - Sucursal Tres", "P7 - Recepción"]);
        assert.deepEqual([o.id, o.creado, o.creado_por, o.modificado, o.modificado_por], [41, "2026-09-10T08:20:00", "Ana Mora Solís", "2026-09-10T09:00:00", "Luis Mena"]);
        assert.equal(o.entrada, "2026-09-10T08:15:30"); // la fecha del hecho es otra columna
        const vacia = mapRegistroVisitaRow({ id: 1 });
        for (const k of ["empresa", "cliente", "division", "contrato", "sucursal", "puesto", "creado", "creado_por", "modificado", "modificado_por"]) assert.equal(vacia[k], null, k);
    });
    it("nunca expone foto de la cédula ni firma", () => {
        const o = mapRegistroVisitaRow(raw);
        assert.ok(!JSON.stringify(o).includes("cedula.jpg") && !JSON.stringify(o).includes("base64"));
        assert.deepEqual(Object.keys(o).filter((k) => /foto|firma/.test(k)), []);
    });
    it("el id de la estructura que la consulta usa de relleno cuenta como sin dato", () => {
        const o = mapRegistroVisitaRow({ ...raw, ubicacion: { empresa: null, puesto: null }, e_activo_visitante: undefined });
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
        e_estructura_empresa: table([{ id: 1, codigo: "9", nombre: "Emp" }]),
        e_estructura_cliente: table([{ id: 5, nombre: "Cli" }]),
        e_estructura_sucursal: table([{ id: 3, ejecutivoCuenta_id: 10, nro_sucursal: "S3", nombre: "Suc" }]),
        e_estructura_puesto: table([{ id: 7, codigo: "P7", nombre: "Recepción" }]),
        n_ejecutivo_cuenta: table([{ id: 10, nombre: "Rosa Vega" }]),
        e_estructura_contrato: table([{ id: 2, division_id: 20, nro_contrato: "CT-2", nombre: "Dos" }]),
        n_division: table([{ id: 20, nombre: "Seguridad" }]),
        c_empleado: table([{ id: 20, nombre: "Ana", primer_apellido: "Mora", segundo_apellido: "Solís" }, { id: 21, nombre: "Luis", primer_apellido: "Mena", segundo_apellido: null }]),
        c_cambios_apps_modules: { findMany: async (a: any) => { calls++; return [
            { id: 1, nombre_tabla: "e_registro_personas", registro_id: 41, created_by: 20, created_at: new Date("2026-09-10T08:20:00Z") },
            { id: 2, nombre_tabla: "e_registro_personas", registro_id: 41, created_by: 21, created_at: new Date("2026-09-10T09:00:00Z") },
        ].filter((c) => c.nombre_tabla === a.where.nombre_tabla && a.where.registro_id.in.includes(c.registro_id)); } },
    };
    it("trae ubicación, ejecutivo, división, creador y último cambio en lote (no por fila) y los mapea", async () => {
        const rows = [raw, { ...raw, id: 42 }, { ...raw, id: 43, corpo_id: 0, contrato_id: 0, responsable_id: 0 }];
        const out = (await enrichVisitas(db, rows.map(({ ubicacion, ...r }) => r))).map(mapRegistroVisitaRow);
        assert.equal(calls, 11); // cambios (1), ejecutivo (2), división (2), empleado (1) y ubicación (5: la división vale 0 y no se consulta): una consulta por tabla, no por fila
        assert.equal(out[0].ejecutivo_cuenta, "Rosa Vega");
        assert.equal(out[0].division, "Seguridad");
        assert.deepEqual([out[0].empresa, out[0].cliente, out[0].contrato, out[0].sucursal, out[0].puesto], ["9 - Emp", "Cli", "CT-2 - Dos", "S3 - Suc", "P7 - Recepción"]);
        assert.deepEqual([out[0].creado_por, out[0].modificado_por], ["Ana Mora Solís", "Luis Mena"]);
        assert.equal(out[1].creado_por, "Ana Mora Solís");
        assert.deepEqual([out[1].modificado, out[1].modificado_por], ["2026-09-10T09:00:00", null]); // `modificado` es `updated_at` del registro; el cambio del historial es solo del 41
        assert.equal(out[2].ejecutivo_cuenta, null);
        assert.equal(out[2].creado_por, null);
        assert.equal(out[2].sucursal, null);
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
