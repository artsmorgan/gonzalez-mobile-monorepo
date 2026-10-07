import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { enrichSolicitudes, filterSolicitudesByScope, mapSolicitudPermisoRow, solicitudesPermiso } from "./solicitudesPermiso";

const raw = {
    id: 12,
    created_at: new Date("2026-09-20T10:05:09.123Z"),
    empleado_id: 33,
    empleado_nombre: "Luis Vega Mora",
    empleado_cedula: "3-0456-0789",
    empleado_codigo: "A1",
    empresa_id: 1, cliente_id: 5, division_id: 0, contrato_id: 2, corpo_id: 3, puesto_id: 7,
    empresa_nombre: "E1 - Empresa Uno",
    cliente_nombre: "Cliente Cinco",
    division_nombre: "0",
    contrato_nombre: "CT-2 - Contrato Dos",
    corpo_nombre: "S3 - Sucursal Tres",
    puesto_nombre: "P7 - Recepción",
    ejecutivo_cuenta: 4,
    ejecutivo_cuenta_nombre: "4",
    tipo: "Con goce",
    estado: "pendiente",
    fecha_inicio: new Date("2026-09-25T08:00:00Z"),
    fecha_fin: new Date("2026-09-27T17:00:00Z"),
    dias_permiso: 3,
    turnos_list: [{ puesto: "x", tipo_turno: "diurno" }, { puesto: "y", tipo_turno: "Nocturno" }, { puesto: "z", tipo_turno: "DIURNO" }],
    motivo_txt: "Cita médica",
    observaciones_txt: "",
    created_by: 90,
    creado_por_nombre: "Jefa Directa",
    firma_empleado_manual: "iVBORw0KGgo",
    firma_ejecutivo_cuenta_manual: "iVBORw0KGgo",
    firma_responsable: "iVBORw0KGgo",
};

describe("solicitudes_permiso: mapeo", () => {
    it("mapea la fila", () => {
        const o = mapSolicitudPermisoRow(raw);
        assert.equal(o.id, 12);
        assert.equal(o.creado, "2026-09-20T10:05:09");
        assert.equal(o.empleado, "A1 - Luis Vega Mora");
        assert.equal(o.cedula, "3-0456-0789");
        assert.equal(o.codigo, "A1");
        assert.equal(o.division, null);
        assert.equal(o.sucursal, "S3 - Sucursal Tres");
        assert.equal(o.ejecutivo_cuenta, null); // la consulta rellena con el id
        assert.equal(o.tipo_salario, "Con goce");
        assert.equal(o.estado, "Pendiente");
        assert.equal(o.fecha_inicio, "2026-09-25T08:00:00");
        assert.equal(o.fecha_fin, "2026-09-27T17:00:00");
        assert.equal(o.dias, 3);
        assert.equal(o.turnos, 3);
        assert.equal(o.tipo_turno, "Diurno; Nocturno");
        assert.equal(o.motivo, "Cita médica");
        assert.equal(o.observaciones, null);
        assert.equal(o.creado_por, "Jefa Directa");
    });
    it("empleado: «código - nombre»; sin código solo el nombre; sin nombre el código; sin nada null", () => {
        assert.equal(mapSolicitudPermisoRow({ ...raw, empleado_codigo: "" }).empleado, "Luis Vega Mora");
        assert.equal(mapSolicitudPermisoRow({ ...raw, empleado_nombre: "A1" }).empleado, "A1");
        assert.equal(mapSolicitudPermisoRow({ ...raw, empleado_nombre: "33", empleado_codigo: "A1" }).empleado, "A1");
        assert.equal(mapSolicitudPermisoRow({ ...raw, empleado_nombre: "33", empleado_codigo: "" }).empleado, null);
    });
    it("estado con mayúscula inicial y tipo_turno de los turnos (otros tipos tal cual, sin turnos null)", () => {
        assert.equal(mapSolicitudPermisoRow({ ...raw, estado: "APROBADO" }).estado, "Aprobado");
        assert.equal(mapSolicitudPermisoRow({ ...raw, estado: "" }).estado, null);
        assert.equal(mapSolicitudPermisoRow({ ...raw, turnos_list: [{ tipo_turno: "Mixto" }, { tipo_turno: "especial" }, {}] }).tipo_turno, "Especial; Mixto");
        assert.equal(mapSolicitudPermisoRow({ ...raw, turnos_list: [] }).tipo_turno, null);
        assert.equal(mapSolicitudPermisoRow({ ...raw, turnos_list: undefined }).tipo_turno, null);
    });
    it("la división sale del contrato (respaldo: la de la cabecera) y tipo_turno va al final", () => {
        assert.equal(mapSolicitudPermisoRow({ ...raw, division_contrato: "Seguridad" }).division, "Seguridad");
        assert.equal(mapSolicitudPermisoRow({ ...raw, division_nombre: "Limpieza", division_id: 4 }).division, "Limpieza");
        assert.deepEqual(Object.keys(mapSolicitudPermisoRow(raw)).slice(-2), ["creado_por", "tipo_turno"]);
    });
    it("no expone firmas", () => {
        const o = mapSolicitudPermisoRow(raw);
        assert.ok(!JSON.stringify(o).includes("iVBOR"));
        assert.deepEqual(Object.keys(o).filter((k) => /firma/.test(k)), []);
    });
    it("tolera nulos y recorta textos largos", () => {
        const o = mapSolicitudPermisoRow({ ...raw, empleado_cedula: undefined, turnos_list: undefined, dias_permiso: null, fecha_fin: null, motivo_txt: undefined, motivo: "m".repeat(700) });
        assert.equal(o.cedula, null);
        assert.equal(o.turnos, 0);
        assert.equal(o.dias, null);
        assert.equal(o.fecha_fin, null);
        assert.equal((o.motivo as string).length, 500);
    });
    it("las claves del módulo existen en la fila", () => {
        const o = mapSolicitudPermisoRow(raw);
        for (const k of [...solicitudesPermiso.searchKeys, ...solicitudesPermiso.filterKeys, ...solicitudesPermiso.sortKeys, solicitudesPermiso.defaultSort]) assert.ok(k in o, k);
    });
});

describe("solicitudes_permiso: enriquecimiento por lote", () => {
    it("trae la cédula y la división del contrato en lote (no por fila) y las mapea", async () => {
        let calls = 0;
        const table = (rows: any[]) => ({ findMany: async (a: any) => { calls++; return rows.filter((r) => a.where.id.in.includes(r.id)); } });
        const db: any = {
            c_empleado: table([{ id: 33, cedula: "3-0456-0789" }]),
            e_estructura_contrato: table([{ id: 2, division_id: 20 }]),
            n_division: table([{ id: 20, nombre: "Seguridad" }]),
        };
        const { empleado_cedula: _c, ...base } = raw;
        const rows = [base, { ...base, id: 13 }, { ...base, id: 14, empleado_id: 0, contrato_id: 0 }];
        const out = (await enrichSolicitudes(db, rows)).map(mapSolicitudPermisoRow);
        assert.equal(calls, 3); // empleados, contrato y división: una consulta cada uno
        assert.equal(out[0].cedula, "3-0456-0789");
        assert.equal(out[1].division, "Seguridad");
        assert.equal(out[2].cedula, null);
        assert.equal(out[2].division, null);
    });
});

describe("solicitudes_permiso: alcance", () => {
    const rows = [raw, { ...raw, id: 13, contrato_id: 9, corpo_id: 8, puesto_id: 80 }, { ...raw, id: 14, empresa_id: 0, cliente_id: 0, contrato_id: 0, corpo_id: 0, puesto_id: 0 }];
    it("filtra por la unión de los nodos", () => {
        assert.equal(filterSolicitudesByScope(rows, null).length, 3);
        assert.deepEqual(filterSolicitudesByScope(rows, [{ nivel: "contrato", id: 9 }]).map((r) => r.id), [13]);
        assert.deepEqual(filterSolicitudesByScope(rows, [{ nivel: "empresa", id: 1 }, { nivel: "puesto", id: 80 }]).map((r) => r.id), [12, 13]);
        assert.equal(filterSolicitudesByScope(rows, []).length, 0);
    });
});
