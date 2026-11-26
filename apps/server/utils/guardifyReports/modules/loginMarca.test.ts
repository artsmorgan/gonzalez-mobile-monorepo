import assert from "node:assert/strict";
import { describe, it } from "node:test";

/** Las consultas originales importan paquetes que solo sirven para armar el Excel (`exceljs`…): si no están instalados se sustituyen por un objeto inerte. */
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
const { loginMarca, mapLoginMarcaStdRow } = require("./loginMarca") as typeof import("./loginMarca");

const P = { from: "2026-09-01", to: "2026-10-01", page: 1, pageSize: 50, sort: null, dir: "desc", q: null, filters: [], scope: null } as any;

const login = (o: Record<string, any> = {}) => ({
    id: 5, nombre_empleado: "Ana Soto", cedula_empleado: "1-1", fecha_hora: new Date("2026-09-27T03:07:39.000Z"), device: "{secreto}", lat: "9.9",
    puesto_id: 40, marca_entrada_teorica: null, marca_entrada_real: new Date("2026-09-27T06:00:00.000Z"), marca_salida_teorica: null, marca_salida_real: null,
    hora_inicio_almuerzo: null, hora_fin_almuerzo: null, session_id: "s-1", ...o,
});

function fakeDb(tables: Record<string, any[]>, calls: string[] = []) {
    return new Proxy({}, {
        get: (_t, name: string) => ({
            findMany: async (args: any = {}) => {
                calls.push(name);
                const w = args.where ?? {};
                return (tables[name] ?? []).filter((r) => (!w.id?.in || w.id.in.includes(r.id)) && (!w.cedula?.in || w.cedula.in.includes(r.cedula)));
            },
        }),
    }) as any;
}

const estructura = () => ({
    e_estructura_puesto: [{ id: 40, sucursal_id: 30, codigo: "P40", nombre: "Recepción" }, { id: 41, sucursal_id: 31, codigo: null, nombre: "Garita" }],
    e_estructura_sucursal: [{ id: 30, contrato_id: 20, nro_sucursal: "S1", nombre: "Sede" }, { id: 31, contrato_id: 21, nro_sucursal: null, nombre: "Otra" }],
    e_estructura_contrato: [{ id: 20, cliente_id: 5, empresa_id: 1, division_id: 9, nro_contrato: "C-20", nombre: "Contrato" }, { id: 21, cliente_id: 6, empresa_id: 1, division_id: null, nro_contrato: null, nombre: "Otro" }],
    e_estructura_empresa: [{ id: 1, codigo: "G", nombre: "Gonzalez" }],
    e_estructura_cliente: [{ id: 5, nombre: "Cliente 5" }, { id: 6, nombre: "Cliente 6" }],
    n_division: [{ id: 9, nombre: "Norte" }],
});

describe("login_marca: 11 columnas estándar", () => {
    it("mapea creado (fecha_hora), creado_por (el empleado), modificado null y la jerarquía", () => {
        const u = { empresa: "G - Gonzalez", cliente: "Cliente 5", division: "Norte", contrato: "C-20 - Contrato", sucursal: "S1 - Sede", puesto: "P40 - Recepción" };
        const o = mapLoginMarcaStdRow(login(), u);
        assert.deepEqual([o.id, o.creado, o.creado_por, o.modificado, o.modificado_por], [5, "2026-09-27T03:07:39", "Ana Soto", null, null]);
        assert.deepEqual([o.empresa, o.cliente, o.division, o.contrato, o.sucursal, o.puesto], ["G - Gonzalez", "Cliente 5", "Norte", "C-20 - Contrato", "S1 - Sede", "P40 - Recepción"]);
        assert.ok(!("fecha" in o), "fecha se renombró a creado");
        assert.equal(o.empleado, "Ana Soto");
        assert.equal(JSON.stringify(o).includes("secreto"), false);
    });
    it("sin ubicación, los seis niveles salen null", () => {
        const o = mapLoginMarcaStdRow(login({ puesto_id: null }));
        assert.deepEqual([o.empresa, o.cliente, o.division, o.contrato, o.sucursal, o.puesto], [null, null, null, null, null, null]);
    });
    it("declara claves que existen en la fila", () => {
        const row = mapLoginMarcaStdRow(login());
        for (const k of [...loginMarca.searchKeys, ...loginMarca.filterKeys, ...loginMarca.sortKeys, loginMarca.defaultSort]) assert.ok(k in row, k);
    });
});

describe("login_marca: carga", () => {
    const tablas = (logins: any[]) => ({
        ...estructura(),
        c_login_marca_almuerzo: logins,
        c_empleado: [{ id: 1, cedula: "1-1", nombre: "Ana", primer_apellido: "Soto", plazaEmpleado_id: 70 }],
        c_empleado_plaza: [{ id: 70, empresa_id: 1, cliente_id: 6, division_id: null, contrato_id: 21, corpo_id: 31, puesto_id: 41 }],
    });
    it("jerarquía del puesto de la marca, y de la plaza del empleado si el ingreso aún no tiene puesto", async () => {
        const db = fakeDb(tablas([login(), login({ id: 6, puesto_id: null, cedula_empleado: "1-1" }), login({ id: 7, puesto_id: null, cedula_empleado: "9-9" })]));
        const out = await loginMarca.load(db, P);
        const r5 = out.find((r) => r.id === 5)!, r6 = out.find((r) => r.id === 6)!, r7 = out.find((r) => r.id === 7)!;
        assert.deepEqual([r5.empresa, r5.cliente, r5.division, r5.contrato, r5.sucursal, r5.puesto], ["G - Gonzalez", "Cliente 5", "Norte", "C-20 - Contrato", "S1 - Sede", "P40 - Recepción"]);
        assert.deepEqual([r6.cliente, r6.division, r6.contrato, r6.sucursal, r6.puesto], ["Cliente 6", null, "Otro", "Otra", "Garita"]);
        assert.deepEqual([r7.empresa, r7.puesto], [null, null]);
        assert.deepEqual([r5.creado_por, r5.modificado, r5.modificado_por], ["Ana Soto", null, null]);
    });
    it("con alcance filtra por la ubicación mostrada; vacío no ve nada", async () => {
        const db = () => fakeDb(tablas([login(), login({ id: 6, puesto_id: null }), login({ id: 7, puesto_id: 41, cedula_empleado: "9-9" })]));
        const ids = async (scope: any) => (await loginMarca.load(db(), { ...P, scope })).map((r) => r.id).sort();
        assert.deepEqual(await ids([{ nivel: "contrato", id: 20 }]), [5]);
        assert.deepEqual(await ids([{ nivel: "contrato", id: 21 }]), [6, 7]);
        assert.deepEqual(await ids([]), []);
    });
});
