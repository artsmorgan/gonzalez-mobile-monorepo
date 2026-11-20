import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ReportParams } from "../params";
import { ingresosUsuario, mapIngresoUsuarioStdRow, ubicacionPorEmpleado } from "./ingresosUsuario";

const P: ReportParams = { from: "2026-09-01", to: "2026-10-01", page: 1, pageSize: 50, sort: null, dir: "desc", q: null, filters: [], scope: null };

/** `db` falso: cada tabla devuelve sus filas (respeta `where.id.in` y `where.cedula.in`) y cuenta las consultas. */
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

const tablas = () => ({
    refresh_token: [
        { id: 9, token: "TOKEN-SECRETO", createdAt: new Date("2026-09-01T08:15:00Z"), expiresAt: new Date("2026-09-08T08:15:00Z"), sessionId: "s-1", device: '["a","b"]', revoked: false, empleadoId: 1 },
        { id: 8, token: "OTRO-SECRETO", createdAt: new Date("2026-09-02T09:00:00Z"), expiresAt: new Date("2026-09-09T09:00:00Z"), sessionId: "s-2", device: null, revoked: true, empleadoId: 2 },
    ],
    c_empleado: [
        { id: 1, nombre: "Ana", primer_apellido: "Soto", segundo_apellido: null, cedula: "1-1", plazaEmpleado_id: 70 },
        { id: 2, nombre: "Beto", primer_apellido: "Mora", segundo_apellido: null, cedula: "2-2", plazaEmpleado_id: null }, // sin plaza
    ],
    c_empleado_plaza: [{ id: 70, empresa_id: 1, cliente_id: 5, division_id: 9, contrato_id: 20, corpo_id: 30, puesto_id: 40 }],
    e_estructura_empresa: [{ id: 1, codigo: "G", nombre: "Gonzalez" }],
    e_estructura_cliente: [{ id: 5, nombre: "Cliente 5" }],
    n_division: [{ id: 9, nombre: "Norte" }],
    e_estructura_contrato: [{ id: 20, nro_contrato: "C-20", nombre: "Contrato" }],
    e_estructura_sucursal: [{ id: 30, nro_sucursal: "S1", nombre: "Sede" }],
    e_estructura_puesto: [{ id: 40, codigo: "P40", nombre: "Recepción" }],
});

describe("ingresos_usuario: 11 columnas estándar", () => {
    it("mapea creado, creado_por (el empleado), modificado null y la jerarquía", () => {
        const u = { empresa: "G - Gonzalez", cliente: "Cliente 5", division: "Norte", contrato: "C-20 - Contrato", sucursal: "S1 - Sede", puesto: "P40 - Recepción" };
        const o = mapIngresoUsuarioStdRow({ id: 9, token: "TOKEN-SECRETO", createdAt: new Date("2026-09-01T08:15:00Z"), expiresAt: new Date("2026-09-08T00:00:00Z"), sessionId: "s-1", device: '["a"]', revoked: false, c_empleado: { nombre: "Ana", primer_apellido: "Soto", cedula: "1-1" } }, u);
        assert.deepEqual([o.id, o.creado, o.creado_por, o.modificado, o.modificado_por], [9, "2026-09-01T08:15:00", "Ana Soto", null, null]);
        assert.deepEqual([o.empresa, o.cliente, o.division, o.contrato, o.sucursal, o.puesto], ["G - Gonzalez", "Cliente 5", "Norte", "C-20 - Contrato", "S1 - Sede", "P40 - Recepción"]);
        assert.equal(JSON.stringify(o).includes("TOKEN-SECRETO"), false);
    });
    it("sin ubicación ni empleado, todo null (sin romper)", () => {
        const o = mapIngresoUsuarioStdRow({ id: 1, createdAt: "2026-09-01 08:00:00", revoked: true });
        assert.deepEqual([o.creado, o.creado_por, o.empresa, o.cliente, o.division, o.contrato, o.sucursal, o.puesto, o.revocado], ["2026-09-01T08:00:00", null, null, null, null, null, null, null, "Sí"]);
    });
    it("load: jerarquía de la plaza del empleado en lote y null para quien no tiene plaza", async () => {
        const calls: string[] = [];
        const out = await ingresosUsuario.load(fakeDb(tablas(), calls), P);
        const ana = out.find((r) => r.id === 9)!, beto = out.find((r) => r.id === 8)!;
        assert.deepEqual([ana.empresa, ana.cliente, ana.division, ana.contrato, ana.sucursal, ana.puesto], ["G - Gonzalez", "Cliente 5", "Norte", "C-20 - Contrato", "S1 - Sede", "P40 - Recepción"]);
        assert.deepEqual([ana.creado_por, ana.modificado, ana.modificado_por], ["Ana Soto", null, null]);
        assert.deepEqual([beto.creado_por, beto.empresa, beto.puesto], ["Beto Mora", null, null]);
        // por lote: una consulta por tabla de plaza/estructura (c_empleado: nombres + plazas)
        assert.equal(calls.filter((c) => c === "c_empleado_plaza").length, 1);
        assert.equal(calls.filter((c) => c === "e_estructura_puesto").length, 1);
    });
    it("si la lectura de la plaza falla, el reporte sigue con la jerarquía en null", async () => {
        const t = tablas();
        const db = new Proxy({}, { get: (_t, name: string) => ({ findMany: async (a: any = {}) => {
            if (name === "c_empleado_plaza") throw new Error("sin tabla");
            return (t as any)[name]?.filter((r: any) => !a.where?.id?.in || a.where.id.in.includes(r.id)) ?? [];
        } }) }) as any;
        const out = await ingresosUsuario.load(db, P);
        assert.equal(out.length, 2);
        assert.deepEqual(out.map((r) => r.puesto), [null, null]);
    });
    it("ubicacionPorEmpleado devuelve los ids de la plaza", async () => {
        const m = await ubicacionPorEmpleado(fakeDb(tablas()), [1, 2, 99]);
        assert.deepEqual(m.get(1), { empresa: 1, cliente: 5, division: 9, contrato: 20, corpo: 30, puesto: 40 });
        assert.equal(m.has(2), false);
    });
    it("las claves de búsqueda, filtro y orden existen en la fila", () => {
        const row = mapIngresoUsuarioStdRow({ id: 1, createdAt: new Date(), revoked: false });
        for (const k of [...ingresosUsuario.searchKeys, ...ingresosUsuario.filterKeys, ...ingresosUsuario.sortKeys, ingresosUsuario.defaultSort]) assert.ok(k in row, k);
    });
});
