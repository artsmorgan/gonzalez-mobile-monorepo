import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseReportParams } from "../params";
import { loadSolicitudVacaciones, mapSolicitudVacacionesRow, solicitudVacaciones } from "./solicitudVacaciones";

const raw = (id: number, over: Record<string, unknown> = {}) => ({
    id, empleado_id: 7, plaza_id: 100, fecha_inicio: new Date("2026-09-14T00:00:00Z"), fecha_fin: new Date("2026-09-25T00:00:00Z"), dias: 10, semanas: 2,
    observaciones: "x".repeat(900), consecutivo: "VAC-1", estado_aprobacion: "Aprobada", tipo_vacaciones: "DIS", periodo: "2025-2026",
    fecha_insercion: new Date("2026-09-01T15:30:00Z"), usuario_insercion: "11",
    // Campos que nunca deben salir:
    monto: 123456.78, usuario_aprueba_ec: "jefe1", usuario_aprueba_ge: "gerente1", fecha_aprobado_ec: new Date("2026-09-02T00:00:00Z"), usuario_reversion: "rev", motivo_reversion: "m", observaciones_rechazo: "r", ...over,
});

const table = (rows: any[]) => ({ findMany: async (a: any) => rows.filter((r) => !a?.where?.id?.in || a.where.id.in.includes(r.id)) });
let calls: Record<string, any[]> = {};
const spy = (name: string, rows: any[]) => ({ findMany: async (a: any) => { (calls[name] ??= []).push(a); return table(rows).findMany(a); } });
const solicitudes = [
    raw(1),
    raw(2, { empleado_id: 8, plaza_id: 200, usuario_insercion: "jperez", dias: 5, semanas: 1, tipo_vacaciones: null, estado_aprobacion: null, observaciones: null, fecha_fin: null, fecha_insercion: null }),
    raw(3, { plaza_id: null }), // sin plaza: sin ubicación
    raw(4, { plaza_id: 300 }), // plaza sin puesto
];
const mkdb = (): any => ({
    v_vacacion_solicitud: spy("v_vacacion_solicitud", solicitudes),
    c_empleado: spy("c_empleado", [
        { id: 7, codigo: "1934", nombre: "Ana", primer_apellido: "Rojas", segundo_apellido: "Mora", cedula: "1-111" },
        { id: 8, codigo: "", nombre: "Beto", primer_apellido: "Soto", segundo_apellido: null, cedula: "2-222" },
        { id: 11, codigo: "5", nombre: "Carla", primer_apellido: "Vega", segundo_apellido: null, cedula: "3" },
    ]),
    e_estructura_plazas: spy("e_estructura_plazas", [{ id: 100, puesto_id: 6, codigo_plaza: "254-P1", nombre: "Oficial" }, { id: 200, puesto_id: 16, codigo_plaza: null, nombre: "Relevo" }, { id: 300, puesto_id: null, codigo_plaza: "X", nombre: "Sin puesto" }]),
    e_estructura_puesto: spy("e_estructura_puesto", [{ id: 6, sucursal_id: 5, codigo: "P1", nombre: "Puesto" }, { id: 16, sucursal_id: 15, codigo: null, nombre: "Puesto 2" }]),
    e_estructura_sucursal: spy("e_estructura_sucursal", [{ id: 5, contrato_id: 4, nro_sucursal: "S1", nombre: "Sucursal", ejecutivoCuenta_id: 10 }, { id: 15, contrato_id: 9, nro_sucursal: null, nombre: "Sucursal 2", ejecutivoCuenta_id: null }]),
    e_estructura_contrato: spy("e_estructura_contrato", [{ id: 4, cliente_id: 2, empresa_id: 1, division_id: 3, nro_contrato: "C1", nombre: "Contrato" }, { id: 9, cliente_id: 22, empresa_id: 1, division_id: null, nro_contrato: "C9", nombre: "Contrato 9" }]),
    e_estructura_cliente: spy("e_estructura_cliente", [{ id: 2, nombre: "Cliente" }, { id: 22, nombre: "Cliente 2" }]),
    e_estructura_empresa: spy("e_estructura_empresa", [{ id: 1, codigo: "9", nombre: "Empresa" }]),
    n_division: spy("n_division", [{ id: 3, nombre: "Seguridad" }]),
    n_ejecutivo_cuenta: spy("n_ejecutivo_cuenta", [{ id: 10, nombre: "Luis Mora" }]),
});
const params = (extra: Record<string, string> = {}) => parseReportParams(new URLSearchParams({ from: "2026-09-01", to: "2026-10-01", ...extra }));

describe("solicitud_vacaciones: carga", () => {
    it("pide el periodo [from, to) por fecha_inicio y solo columnas seguras", async () => {
        calls = {};
        await loadSolicitudVacaciones(mkdb(), params());
        const a = calls.v_vacacion_solicitud![0];
        assert.equal(a.where.fecha_inicio.gte.toISOString(), "2026-09-01T00:00:00.000Z");
        assert.equal(a.where.fecha_inicio.lt.toISOString(), "2026-10-01T00:00:00.000Z");
        for (const bad of ["monto", "usuario_aprueba_ec", "usuario_aprueba_ge", "usuario_reversion", "motivo_reversion", "observaciones_rechazo", "fecha_aprobado_ec"]) assert.equal(bad in a.select, false, bad);
    });
    it("mapea la fila completa con ubicación por la plaza y columnas comunes", async () => {
        const rows = await loadSolicitudVacaciones(mkdb(), params());
        assert.equal(rows.length, 4);
        const o = rows.find((r) => r.id === 1)!;
        assert.deepEqual(Object.keys(o), ["id", "creado", "consecutivo", "fecha_inicio", "fecha_fin", "dias", "semanas", "tipo_vacaciones", "periodo", "estado", "empleado", "cedula", "plaza", "puesto", "sucursal", "contrato", "cliente", "empresa", "division", "ejecutivo_cuenta", "observaciones", "usuario_inserta"]);
        assert.deepEqual([o.creado, o.consecutivo, o.fecha_inicio, o.fecha_fin, o.dias, o.semanas], ["2026-09-01T15:30:00", "VAC-1", "2026-09-14T00:00:00", "2026-09-25T00:00:00", 10, 2]);
        assert.deepEqual([o.tipo_vacaciones, o.periodo, o.estado], ["DIS", "2025-2026", "Aprobada"]);
        assert.deepEqual([o.empleado, o.cedula], ["1934 - Ana Rojas Mora", "1-111"]);
        assert.deepEqual([o.plaza, o.puesto, o.sucursal, o.contrato, o.cliente, o.empresa], ["254-P1 - Oficial", "P1 - Puesto", "S1 - Sucursal", "C1 - Contrato", "Cliente", "9 - Empresa"]);
        assert.deepEqual([o.division, o.ejecutivo_cuenta], ["Seguridad", "Luis Mora"]);
        assert.equal((o.observaciones as string).length, 500);
        assert.equal(o.usuario_inserta, "Carla Vega"); // id de empleado → nombre
    });
    it("tolera nulos: sin código solo el nombre, usuario de texto tal cual, sin ejecutivo ni división", async () => {
        const o = (await loadSolicitudVacaciones(mkdb(), params())).find((r) => r.id === 2)!;
        assert.deepEqual([o.empleado, o.plaza, o.puesto, o.sucursal], ["Beto Soto", "Relevo", "Puesto 2", "Sucursal 2"]);
        assert.deepEqual([o.fecha_fin, o.creado, o.tipo_vacaciones, o.estado, o.observaciones, o.division, o.ejecutivo_cuenta, o.usuario_inserta], [null, null, null, null, null, null, null, "jperez"]);
    });
    it("una solicitud sin plaza (o con plaza sin puesto) sale sin ubicación", async () => {
        const rows = await loadSolicitudVacaciones(mkdb(), params());
        for (const id of [3, 4]) {
            const o = rows.find((r) => r.id === id)!;
            assert.deepEqual([o.puesto, o.sucursal, o.contrato, o.cliente, o.empresa, o.division, o.ejecutivo_cuenta], [null, null, null, null, null, null, null]);
        }
        assert.equal(rows.find((r) => r.id === 4)!.plaza, "X - Sin puesto");
    });
    it("nunca expone montos ni usuarios o fechas de aprobación", async () => {
        const s = JSON.stringify(await loadSolicitudVacaciones(mkdb(), params()));
        for (const bad of ["123456", "jefe1", "gerente1", "rev", "monto"]) assert.equal(s.includes(bad), false, bad);
    });
    it("carga por lote: una consulta por tabla sin importar cuántas solicitudes", async () => {
        calls = {};
        await loadSolicitudVacaciones(mkdb(), params());
        for (const [t, c] of Object.entries(calls)) assert.ok(c.length <= 3, `${t}: ${c.length}`);
        assert.equal(calls.c_empleado!.length, 2); // empleados + quien registró (nombresEmpleado)
        assert.equal(calls.v_vacacion_solicitud!.length, 1);
    });
});

describe("solicitud_vacaciones: alcance", () => {
    it("sin alcance trae todo; con alcance solo la ubicación pedida (la que sale de la plaza)", async () => {
        assert.equal((await loadSolicitudVacaciones(mkdb(), params())).length, 4);
        assert.deepEqual((await loadSolicitudVacaciones(mkdb(), params({ scope: "contrato:4" }))).map((r) => r.id), [1]);
        assert.deepEqual((await loadSolicitudVacaciones(mkdb(), params({ scope: "corpo:15" }))).map((r) => r.id), [2]);
        assert.deepEqual((await loadSolicitudVacaciones(mkdb(), params({ scope: "division:3" }))).map((r) => r.id), [1]);
        assert.deepEqual((await loadSolicitudVacaciones(mkdb(), params({ scope: "empresa:1" }))).map((r) => r.id).sort(), [1, 2]);
        assert.deepEqual((await loadSolicitudVacaciones(mkdb(), params({ scope: "contrato:4,puesto:16" }))).map((r) => r.id).sort(), [1, 2]);
        assert.equal((await loadSolicitudVacaciones(mkdb(), params({ scope: "empresa:77" }))).length, 0);
        assert.equal((await loadSolicitudVacaciones(mkdb(), params({ scope: "" }))).length, 0);
    });
    it("declara alcance y sus claves de búsqueda, filtro y orden existen en la fila", () => {
        assert.equal(solicitudVacaciones.supportsScope, true);
        assert.equal(solicitudVacaciones.id, "solicitud_vacaciones");
        const o = mapSolicitudVacacionesRow(raw(1));
        for (const k of [...solicitudVacaciones.searchKeys, ...solicitudVacaciones.filterKeys, ...solicitudVacaciones.sortKeys, solicitudVacaciones.defaultSort]) assert.ok(k in o, k);
    });
    it("mapea sin datos de apoyo sin fallar", () => {
        const o = mapSolicitudVacacionesRow({ id: 9, fecha_inicio: "2026-09-14", dias: null, semanas: 0 });
        assert.deepEqual([o.id, o.fecha_inicio, o.dias, o.semanas, o.empleado, o.puesto, o.usuario_inserta], [9, "2026-09-14T00:00:00", null, 0, null, null, null]);
    });
});

describe("solicitud_vacaciones: base sin la tabla", () => {
    it("responde «reporte no disponible» con un mensaje claro (no un error interno)", async () => {
        const { ReportUnavailableError } = await import("../errors");
        const db: any = { v_vacacion_solicitud: { findMany: async () => { throw new Error("Tabla no soportada o no encontrada en Prisma"); } } };
        await assert.rejects(() => loadSolicitudVacaciones(db, params()), (e: unknown) => e instanceof ReportUnavailableError && /solicitudes de vacaciones/.test(e.message));
    });
});
