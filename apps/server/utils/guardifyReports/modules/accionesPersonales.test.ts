import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Las consultas originales (`reports-functions/`) importan paquetes que solo sirven para armar el Excel (`exceljs`, `axios`…).
 * Si alguno no está instalado en este entorno se sustituye por un objeto inerte: aquí nunca se genera un archivo. Si está
 * instalado se usa el real.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const NodeModule = require("node:module");
const realLoad = NodeModule._load;
const inert: any = new Proxy(function () {}, { get: (_t, k) => (k === "__esModule" ? false : inert), apply: () => inert, construct: () => inert });
NodeModule._load = function (request: string, ...rest: unknown[]) {
    try {
        return realLoad.call(this, request, ...rest);
    } catch (e: any) {
        if (e?.code === "MODULE_NOT_FOUND" && !request.startsWith(".") && !request.startsWith("/")) return inert;
        throw e;
    }
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { accionesPersonales, mapAccionPersonalRow } = require("./accionesPersonales") as typeof import("./accionesPersonales");

const raw = (o: Record<string, any> = {}) => ({
    id: 7,
    empleado_id: 3,
    consecutivo: "AP-0007",
    fecha_inicio: new Date("2026-09-10T00:00:00Z"),
    fecha_fin: null,
    fecha_insercion: new Date("2026-09-09T14:30:15Z"),
    estado_aprobacion: "Aprobada",
    reversible: true,
    document: "/uploads/secreto.pdf",
    comentarios: "x".repeat(900),
    salario: 999999,
    salario_base_mensual: 888888,
    usuario_insercion: "jefe@x.test",
    empresa_id: 1, cliente_id: 5, contrato_id: 20, corpo_id: 30, puesto_id: 40,
    c_empleado_c_accion_personal_empleado_idToc_empleado: { id: 3, nombre: "Ana", primer_apellido: "Soto", segundo_apellido: null, codigo: "E1" },
    c_empleado_c_accion_personal_reemplazo_idToc_empleado: null,
    e_estructura_empresa: { id: 1, nombre: "Gonzalez SA", codigo: "G" },
    e_estructura_cliente: { id: 5, nombre: "Cliente 5" },
    e_estructura_contrato: { id: 20, nombre: "Contrato 20", nro_contrato: "C-20", division_id: 9, n_division: { id: 9, nombre: "Norte", codigo: "N" } },
    e_estructura_sucursal: { id: 30, nombre: "Sede", nro_sucursal: "S1" },
    e_estructura_puesto: { id: 40, nombre: "Recepción", codigo: "P40" },
    e_estructura_plazas: null,
    c_tipo_accion: { id: 1, nombre: "Ausencia", codigo: "AUS" },
    c_horario: { id: 1, titulo: "Diurno" },
    c_ausencia: { id: 1, tipo: "Justificada" },
    c_ajuste_salario: { id: 1, salario_inicial: 1, salario_final: 2, motivo: "Ajuste anual" },
    ...o,
});

describe("acciones_personales: mapeo", () => {
    it("mapea la fila con ubicación, cédula, textos recortados y sin salarios ni documentos", () => {
        const o = mapAccionPersonalRow(raw(), new Map([[3, "1-111-111"]]));
        assert.equal(o.fecha_inicio, "2026-09-10T00:00:00");
        assert.equal(o.fecha_fin, null);
        assert.equal(o.registrada, "2026-09-09T14:30:15");
        assert.equal(o.tipo_accion, "AUS — Ausencia");
        assert.equal(o.empleado, "Ana Soto");
        assert.equal(o.cedula, "1-111-111");
        assert.equal(o.estado, "Aprobada");
        assert.deepEqual([o.empresa, o.cliente, o.division, o.contrato, o.sucursal, o.puesto], ["G - Gonzalez SA", "Cliente 5", "N - Norte", "C-20 - Contrato 20", "S1 - Sede", "P40 - Recepción"]);
        assert.equal((o.comentarios as string).length, 500);
        assert.equal(o.adjunto, "Sí");
        assert.equal(o.detalle, "Justificada · Ajuste anual");
        const s = JSON.stringify(o);
        for (const secreto of ["999999", "888888", "secreto.pdf", "jefe@x.test"]) assert.equal(s.includes(secreto), false);
    });
    it("tolera nulos", () => {
        const o = mapAccionPersonalRow({ id: 1, fecha_inicio: null, reversible: null, document: null });
        assert.equal(o.fecha_inicio, null);
        assert.equal(o.empleado, null);
        assert.equal(o.cedula, null);
        assert.equal(o.reversible, null);
        assert.equal(o.adjunto, "No");
        assert.equal(o.detalle, null);
        assert.equal(o.puesto, null);
    });
});

describe("acciones_personales: periodo y alcance", () => {
    const rows = [
        raw({ id: 1 }),
        raw({ id: 2, fecha_inicio: new Date("2026-10-01T00:00:00Z"), contrato_id: 21, e_estructura_contrato: { id: 21, nombre: "Otro", division_id: 9, n_division: null } }), // to exclusivo
        raw({ id: 3, fecha_inicio: new Date("2026-09-01T00:00:00Z"), puesto_id: 41, corpo_id: 31, contrato_id: 21, e_estructura_contrato: { id: 21, nombre: "Otro", division_id: 10, n_division: null } }),
    ];
    const db = {
        c_accion_personal: { findMany: async () => rows },
        c_empleado: { findMany: async () => [{ id: 3, cedula: "1-111-111" }] },
    } as any;
    const p = (scope: any) => ({ from: "2026-09-01", to: "2026-10-01", page: 1, pageSize: 50, sort: null, dir: "desc" as const, q: null, filters: {}, scope });

    it("sin alcance: solo el periodo [from, to)", async () => {
        const out = await accionesPersonales.load(db, p(null));
        assert.deepEqual(out.map((r) => r.id).sort(), [1, 3]);
        assert.equal(out[0]!.cedula, "1-111-111");
    });
    it("con alcance filtra por contrato, división o puesto; vacío no ve nada", async () => {
        assert.deepEqual((await accionesPersonales.load(db, p([{ nivel: "contrato", id: 20 }]))).map((r) => r.id), [1]);
        assert.deepEqual((await accionesPersonales.load(db, p([{ nivel: "division", id: 10 }]))).map((r) => r.id), [3]);
        assert.deepEqual((await accionesPersonales.load(db, p([{ nivel: "puesto", id: 41 }]))).map((r) => r.id), [3]);
        assert.deepEqual(await accionesPersonales.load(db, p([])), []);
    });
    it("declara claves de búsqueda, filtro y orden que existen en la fila", () => {
        const keys = Object.keys(mapAccionPersonalRow(raw()));
        for (const k of [...accionesPersonales.searchKeys, ...accionesPersonales.filterKeys, ...accionesPersonales.sortKeys, accionesPersonales.defaultSort]) assert.ok(keys.includes(k), k);
    });
});
