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
const { actividades, buildActividadesRows, mapActividadPuestoRow } = require("./actividades") as typeof import("./actividades");

const tables: Record<string, any[]> = {
    e_estructura_puesto: [{ id: 40, sucursal_id: 30 }, { id: 41, sucursal_id: 31 }],
    n_ejecutivo_cuenta: [{ id: 7, nombre: "Rosa Vega" }],
    e_estructura_sucursal: [{ id: 30, contrato_id: 20, nombre: "Sede", nro_sucursal: "S1", ejecutivoCuenta_id: 7 }, { id: 31, contrato_id: 21, nombre: "Otra", nro_sucursal: null }],
    e_estructura_contrato: [{ id: 20, cliente_id: 5, empresa_id: 1, division_id: 9, nombre: "Contrato", nro_contrato: "C-20" }, { id: 21, cliente_id: 6, empresa_id: 1, division_id: null, nombre: "Otro", nro_contrato: null }],
    e_estructura_empresa: [{ id: 1, nombre: "Gonzalez", codigo: "G" }],
    e_estructura_cliente: [{ id: 5, nombre: "Cliente 5" }, { id: 6, nombre: "Cliente 6" }],
    n_division: [{ id: 9, nombre: "Norte", codigo: null }],
    c_empleado: [{ id: 50, nombre: "Ana", primer_apellido: "Soto", segundo_apellido: null }, { id: 51, nombre: "Beto", primer_apellido: "Mora", segundo_apellido: null }],
    c_cambios_apps_modules: [
        { id: 1, nombre_tabla: "e_actividades", registro_id: 1, created_by: 50, created_at: new Date("2026-09-01T10:00:00Z"), cambios: '[{"prop":"__created__"}]' },
        { id: 2, nombre_tabla: "e_actividades", registro_id: 1, created_by: 51, created_at: new Date("2026-09-03T11:30:00Z"), cambios: '[{"prop":"nombre_actividad"}]' },
        { id: 3, nombre_tabla: "e_actividades", registro_id: 3, created_by: 51, created_at: new Date("2026-09-04T08:00:00Z"), cambios: '[{"prop":"fecha_fin"}]' }, // sin alta (anterior al historial)
        { id: 4, nombre_tabla: "otra_tabla", registro_id: 1, created_by: 51, created_at: new Date("2026-09-09T08:00:00Z"), cambios: '[{"prop":"__created__"}]' },
    ],
};
const db = new Proxy({}, {
    get: (_t, name: string) => ({
        findMany: async (args: any = {}) => {
            const ids: number[] | undefined = args.where?.id?.in;
            const w = args.where ?? {};
            return (tables[name] ?? []).filter((r) =>
                (!ids || ids.includes(r.id)) &&
                (!w.nombre_tabla || r.nombre_tabla === w.nombre_tabla) &&
                (!w.registro_id?.in || w.registro_id.in.includes(r.registro_id)) &&
                (!w.cambios?.contains || String(r.cambios).includes(w.cambios.contains)));
        },
    }),
}) as any;

const act = (o: Record<string, any> = {}) => ({
    id: 1,
    nombre_actividad: "Revisar extintores",
    descripcion_actividad: "d".repeat(900),
    fecha_inicio: new Date("2026-09-05T00:00:00Z"),
    fecha_fin: null,
    tipo_turno: "n",
    es_revision_equipo: true,
    frecuencia_titulo: "Diaria",
    frecuencia_horario: "08:00, 20:00",
    e_actividades_puesto: [
        {
            id: 100, puesto_id: 40, e_estructura_puesto: { id: 40, nombre: "Recepción", codigo: "P40" },
            e_actividades_puesto_plaza: [
                { id: 1, marcada: true, articles: '[{"nombre":"x"}]', e_estructura_plazas: { codigo_plaza: "PL1" } },
                { id: 2, marcada: false, e_estructura_plazas: { codigo_plaza: "PL2" } },
                { id: 3, marcada: true, e_estructura_plazas: { codigo_plaza: "PL@3" } }, // hueco virtual: no cuenta
            ],
        },
        { id: 101, puesto_id: 41, e_estructura_puesto: { id: 41, nombre: "Garita", codigo: null }, e_actividades_puesto_plaza: [] },
    ],
    ...o,
});

describe("actividades: mapeo", () => {
    it("mapea una fila por actividad y puesto, con conteos y sin artículos", () => {
        const n = { empresa: new Map([[1, "G - Gonzalez"]]), cliente: new Map([[5, "Cliente 5"]]), division: new Map([[9, "Norte"]]), contrato: new Map([[20, "C-20 - Contrato"]]), corpo: new Map([[30, "S1 - Sede"]]) };
        const a = act();
        const o = mapActividadPuestoRow(a, a.e_actividades_puesto[0], { puesto: 40, corpo: 30, contrato: 20, cliente: 5, empresa: 1, division: 9 }, n, new Map([[30, "Rosa Vega"]]));
        assert.equal(o.ejecutivo_cuenta, "Rosa Vega");
        assert.equal(o.id, 100);
        assert.equal(o.fecha_inicio, "2026-09-05T00:00:00");
        assert.equal(o.fecha_fin, null);
        assert.equal(o.tipo_turno, "Nocturno");
        assert.equal(o.revision_equipo, "Sí");
        assert.equal((o.descripcion as string).length, 500);
        assert.deepEqual([o.empresa, o.cliente, o.division, o.contrato, o.sucursal, o.puesto], ["G - Gonzalez", "Cliente 5", "Norte", "C-20 - Contrato", "S1 - Sede", "P40 - Recepción"]);
        assert.deepEqual([o.plazas, o.marcadas], [2, 1]);
        assert.equal(JSON.stringify(o).includes('"nombre":"x"'), false);
    });
    it("trae las 11 columnas estándar", () => {
        const n = { empresa: new Map([[1, "G - Gonzalez"]]), cliente: new Map([[5, "Cliente 5"]]), division: new Map([[9, "Norte"]]), contrato: new Map([[20, "C-20 - Contrato"]]), corpo: new Map([[30, "S1 - Sede"]]) };
        const a = act();
        const aud = { creado: "2026-09-01T10:00:00", creado_por: "Ana Soto", modificado: "2026-09-03T11:30:00", modificado_por: "Beto Mora" };
        const o = mapActividadPuestoRow(a, a.e_actividades_puesto[0], { puesto: 40, corpo: 30, contrato: 20, cliente: 5, empresa: 1, division: 9 }, n, new Map(), aud);
        for (const k of ["empresa", "cliente", "division", "contrato", "sucursal", "puesto", "id", "creado", "creado_por", "modificado", "modificado_por"]) assert.ok(k in o, k);
        assert.deepEqual([o.id, o.creado, o.creado_por, o.modificado, o.modificado_por], [100, "2026-09-01T10:00:00", "Ana Soto", "2026-09-03T11:30:00", "Beto Mora"]);
        const sin = mapActividadPuestoRow(a, a.e_actividades_puesto[0], undefined, n);
        assert.deepEqual([sin.creado, sin.creado_por, sin.modificado, sin.modificado_por], [null, null, null, null]);
    });
    it("una actividad sin puestos sale sin ubicación y con nulos", () => {
        const o = mapActividadPuestoRow(act({ tipo_turno: null, descripcion_actividad: null, e_actividades_puesto: [] }), null, undefined, { empresa: new Map(), cliente: new Map(), division: new Map(), contrato: new Map(), corpo: new Map() });
        assert.equal(o.id, 1);
        assert.deepEqual([o.puesto, o.empresa, o.tipo_turno, o.descripcion, o.plazas, o.ejecutivo_cuenta], [null, null, null, null, 0, null]);
    });
});

describe("actividades: periodo y alcance", () => {
    const acts = [act(), act({ id: 2, fecha_inicio: new Date("2026-10-01T00:00:00Z") }), act({ id: 3, e_actividades_puesto: [] })];
    it("sin alcance: periodo [from, to), una fila por puesto y ubicación resuelta en lote", async () => {
        const out = await buildActividadesRows(db, acts, "2026-09-01", "2026-10-01", null);
        assert.equal(out.length, 3); // act 1 × 2 puestos + act 3 sin puestos
        const r40 = out.find((r) => r.id === 100)!;
        assert.deepEqual([r40.empresa, r40.cliente, r40.division, r40.contrato, r40.sucursal], ["G - Gonzalez", "Cliente 5", "Norte", "C-20 - Contrato", "S1 - Sede"]);
        const r41 = out.find((r) => r.id === 101)!;
        assert.deepEqual([r41.cliente, r41.division, r41.contrato, r41.sucursal], ["Cliente 6", null, "Otro", "Otra"]);
        assert.equal(r40.ejecutivo_cuenta, "Rosa Vega"); // ejecutivo de la sucursal, en lote
        assert.equal(r41.ejecutivo_cuenta, null);
    });
    it("auditoría: alta y última modificación del historial (por lote), null si no hay", async () => {
        const out = await buildActividadesRows(db, acts, "2026-09-01", "2026-10-01", null);
        const r40 = out.find((r) => r.id === 100)!;
        assert.deepEqual([r40.creado, r40.creado_por, r40.modificado, r40.modificado_por], ["2026-09-01T10:00:00", "Ana Soto", "2026-09-03T11:30:00", "Beto Mora"]);
        const r101 = out.find((r) => r.id === 101)!; // misma actividad, otro puesto: mismo historial
        assert.deepEqual([r101.creado_por, r101.modificado_por], ["Ana Soto", "Beto Mora"]);
        const sinAlta = out.find((r) => r.id === 3)!; // actividad 3: solo un cambio posterior, sin alta
        assert.deepEqual([sinAlta.creado, sinAlta.creado_por, sinAlta.modificado, sinAlta.modificado_por], [null, null, "2026-09-04T08:00:00", "Beto Mora"]);
    });
    it("con alcance: solo los puestos dentro; las actividades sin puestos quedan fuera; vacío no ve nada", async () => {
        const one = (nivel: any, id: number) => buildActividadesRows(db, acts, "2026-09-01", "2026-10-01", [{ nivel, id }]);
        assert.deepEqual((await one("contrato", 21)).map((r) => r.id), [101]);
        assert.deepEqual((await one("division", 9)).map((r) => r.id), [100]);
        assert.deepEqual((await one("empresa", 1)).map((r) => r.id).sort(), [100, 101]);
        assert.deepEqual(await buildActividadesRows(db, acts, "2026-09-01", "2026-10-01", []), []);
    });
    it("declara claves que existen en la fila", () => {
        const a = act();
        const keys = Object.keys(mapActividadPuestoRow(a, a.e_actividades_puesto[0], undefined, { empresa: new Map(), cliente: new Map(), division: new Map(), contrato: new Map(), corpo: new Map() }));
        for (const k of [...actividades.searchKeys, ...actividades.filterKeys, ...actividades.sortKeys, actividades.defaultSort]) assert.ok(keys.includes(k), k);
    });
});
