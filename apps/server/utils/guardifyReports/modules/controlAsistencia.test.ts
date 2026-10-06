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
const { controlAsistencia, mapControlAsistenciaRow } = require("./controlAsistencia") as typeof import("./controlAsistencia");

const cols = JSON.stringify([
    { nombre_original: "Pedro", cedula: "1-1", ausente: false, hora_inicio: "06:00", hora_fin: "14:00" },
    { nombre_original: "Rosa", cedula: "2-2", ausente: true, nombre_reemplazo: "Juan", cedula_reemplazo: "3-3" },
    { nombre_original: "Mario", cedula: "4-4", ausente: true },
]);
const base = { empresa_id: 1, cliente_id: 7, division_id: 3, contrato_id: 100, corpo_id: 10, puesto_id: 1, turno: "D", total_presentes: 1, total_empleados_turno: 3, colaboradores: cols, created_by: 50, firma_responsable: "data:image/png;base64,AAAA", firma_manual_supervisor: "data:image/png;base64,BBBB", nombre_supervisor: "Sup", comentarios: null, isActive: true, c_control_asistencia_empleado_firmas: [{ id: 1, control_id: 3, empleado_id: 9, firma: "data:image/png;base64,CCCC" }] };
const tables: Record<string, any[]> = {
    c_control_asistencia: [
        { ...base, id: 3, fecha: new Date("2026-09-10T06:00:00Z"), created_at: new Date("2026-09-10T14:05:00Z") },
        { ...base, id: 2, fecha: new Date("2026-09-30T22:00:00Z"), created_at: new Date("2026-09-30T23:59:00Z"), contrato_id: 101, corpo_id: 11, puesto_id: 2, turno: "N", c_control_asistencia_empleado_firmas: [], colaboradores: "no es json" },
        { ...base, id: 1, fecha: new Date("2026-10-01T06:00:00Z"), created_at: new Date("2026-10-01T00:01:00Z") },
    ],
    e_estructura_empresa: [{ id: 1, nombre: "Gonzalez", codigo: "G" }],
    e_estructura_cliente: [{ id: 7, nombre: "Cliente 7" }],
    n_division: [{ id: 3, nombre: "Seguridad" }],
    e_estructura_contrato: [{ id: 100, nombre: "Contrato A", nro_contrato: "C1" }, { id: 101, nombre: "Contrato B", nro_contrato: null }],
    e_estructura_sucursal: [{ id: 10, nombre: "Central", nro_sucursal: "S1" }, { id: 11, nombre: "Norte", nro_sucursal: null }],
    e_estructura_puesto: [{ id: 1, nombre: "Entrada", codigo: "P1" }, { id: 2, nombre: "Garita", codigo: null }],
    c_empleado: [{ id: 50, nombre: "Ana", primer_apellido: "Soto", segundo_apellido: "Rojas" }],
};
const db = new Proxy({}, {
    get: (_t, name: string) => ({
        findMany: async (args: any = {}) => {
            const ids: number[] | undefined = args?.where?.id?.in;
            return (tables[name] ?? []).filter((r) => !ids || ids.includes(r.id));
        },
    }),
}) as any;
const P = { from: "2026-09-01", to: "2026-10-01", page: 1, pageSize: 50, sort: null, dir: "desc" as const, q: null, filters: {}, scope: null };

describe("control de asistencia", () => {
    it("mapea conteos de colaboradores, sin nombres de colaboradores ni firmas", () => {
        const o = mapControlAsistenciaRow({ ...base, id: 3, fecha: new Date("2026-09-10T06:00:00Z"), created_at: new Date("2026-09-10T14:05:00Z"), turno_label: "Diurno", empresa_nombre: "G - Gonzalez", cliente_nombre: "Cliente 7", division_nombre: "Seguridad", contrato_nombre: "C1 - A", corpo_nombre: "S1 - B", puesto_nombre: "P1 - Entrada", comentarios: "c".repeat(800) }, { nombre: "Ana", primer_apellido: "Soto", segundo_apellido: "Rojas" });
        assert.deepEqual([o.fecha, o.creado, o.turno, o.presentes, o.total_turno, o.ausentes, o.reemplazos, o.firmas], ["2026-09-10T06:00:00", "2026-09-10T14:05:00", "Diurno", 1, 3, 2, 1, 1]);
        assert.equal(o.creado_por, "Ana Soto Rojas");
        assert.equal(String(o.comentarios).length, 500);
        const s = JSON.stringify(o);
        for (const secreto of ["base64", "Pedro", "Rosa", "Juan", "1-1", "2-2"]) assert.equal(s.includes(secreto), false, secreto);
    });
    it("tolera nulos y colaboradores ilegibles", () => {
        const o = mapControlAsistenciaRow({ id: 9, fecha: null, created_at: null, colaboradores: "no es json", total_presentes: null, nombre_supervisor: " ", turno: "M" });
        assert.deepEqual([o.fecha, o.empresa, o.presentes, o.ausentes, o.reemplazos, o.firmas, o.supervisor, o.creado_por, o.comentarios, o.turno], [null, null, null, 0, 0, 0, null, null, null, "M"]);
    });
    it("trae el periodo [from, to) por fecha de creación, con ubicación y creador", async () => {
        const rows = await controlAsistencia.load(db, P);
        assert.deepEqual(rows.map((r) => r.id).sort(), [2, 3]);
        const r3 = rows.find((r) => r.id === 3)!;
        assert.deepEqual([r3.empresa, r3.contrato, r3.sucursal, r3.puesto, r3.turno, r3.creado_por], ["G - Gonzalez", "C1 - Contrato A", "S1 - Central", "P1 - Entrada", "Diurno", "Ana Soto Rojas"]);
        assert.equal(JSON.stringify(rows).includes("base64"), false);
    });
    it("alcance: filtra por los ids de la fila", async () => {
        assert.deepEqual((await controlAsistencia.load(db, { ...P, scope: [{ nivel: "puesto", id: 2 }] })).map((r) => r.id), [2]);
        assert.deepEqual((await controlAsistencia.load(db, { ...P, scope: [{ nivel: "contrato", id: 100 }] })).map((r) => r.id), [3]);
        assert.deepEqual(await controlAsistencia.load(db, { ...P, scope: [] }), []);
    });
    it("las claves de orden, búsqueda y filtro existen en la fila", async () => {
        const [r] = await controlAsistencia.load(db, P);
        for (const k of [...controlAsistencia.searchKeys, ...controlAsistencia.filterKeys, ...controlAsistencia.sortKeys, controlAsistencia.defaultSort]) assert.ok(k in r!, k);
    });
});
