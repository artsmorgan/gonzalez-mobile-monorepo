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
const { checklistSupervision, mapChecklistSupervisionRow } = require("./checklistSupervision") as typeof import("./checklistSupervision");

const evaluacion = JSON.stringify([
    { title: "Presentación", subsections: [
        { title: "¿Uniforme completo?", inputs: [{ type: "checkbox", value: true }, { type: "photo", photos: [{ file_name: "a.jpg", value: "data:image/jpeg;base64,AAAA" }, { file_name: "b.jpg" }] }] },
        { title: "Observaciones", inputs: [{ type: "textarea", title: "Respuesta", value: "TEXTO-LIBRE-SECRETO" }] },
    ] },
    { title: "Equipo", subsections: [{ title: "Radio", inputs: [{ type: "photo", file_name: "c.jpg" }] }] },
]);
const articulos = JSON.stringify([
    { nombre: "Radio", tipo: "Equipo", cantidad_requerida: 2, cantidad_real: 1, estado: "Bueno" },
    { nombre: "Linterna", tipo: "Equipo", cantidad_requerida: "1", cantidad_real: "1" },
    { nombre: "Chaleco", tipo: "Equipo", cantidad_requerida: 3, cantidad_real: null },
]);
const base = { empresa_id: 1, cliente_id: 7, division_id: 3, contrato_id: 100, corpo_id: 10, puesto_id: 1, ejecutivo_cuenta: "5", evaluacion, articulos_puesto: articulos, firma_supervisor: "data:image/png;base64,SSSS", firma_responsable: "data:image/png;base64,RRRR", created_by: 50, empleado_codigo: "E9", empleado_nombre: "Pedro Mora", hora_inicio: "08:00:00", hora_fin: "09:30:00", isActive: true };
const tables: Record<string, any[]> = {
    c_checklist_supervision: [
        { ...base, id: 3, fecha: new Date("2026-09-10T08:00:00Z"), created_at: new Date("2026-09-10T09:40:00Z") },
        { ...base, id: 2, fecha: new Date("2026-09-30T08:00:00Z"), created_at: new Date("2026-09-30T09:40:00Z"), contrato_id: 101, corpo_id: 11, puesto_id: 2, ejecutivo_cuenta: "", evaluacion: "[]", articulos_puesto: "", empleado_codigo: null, empleado_nombre: null },
        { ...base, id: 1, fecha: new Date("2026-10-01T08:00:00Z"), created_at: new Date("2026-10-01T09:40:00Z") },
    ],
    e_estructura_empresa: [{ id: 1, nombre: "Gonzalez", codigo: "G" }],
    e_estructura_cliente: [{ id: 7, nombre: "Cliente 7" }],
    n_division: [{ id: 3, nombre: "Seguridad" }],
    e_estructura_contrato: [{ id: 100, nombre: "Contrato A", nro_contrato: "C1" }, { id: 101, nombre: "Contrato B", nro_contrato: null }],
    e_estructura_sucursal: [{ id: 10, nombre: "Central", nro_sucursal: "S1" }, { id: 11, nombre: "Norte", nro_sucursal: null }],
    e_estructura_puesto: [{ id: 1, nombre: "Entrada", codigo: "P1" }, { id: 2, nombre: "Garita", codigo: null }],
    n_ejecutivo_cuenta: [{ id: 5, nombre: "Laura Vega" }],
    c_empleado: [{ id: 50, nombre: "Ana", primer_apellido: "Soto", segundo_apellido: null }],
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

describe("checklist de supervisión", () => {
    it("mapea solo conteos de la evaluación y los artículos; nunca respuestas, fotos ni firmas", () => {
        const o = mapChecklistSupervisionRow({ ...base, id: 3, fecha: new Date("2026-09-10T08:00:00Z"), created_at: new Date("2026-09-10T09:40:00Z"), empresa_nombre: "G - Gonzalez", cliente_nombre: "Cliente 7", division_nombre: "Seguridad", contrato_nombre: "C1 - A", corpo_nombre: "S1 - B", puesto_nombre: "P1 - Entrada", empleado_display: "E9 - Pedro Mora", ejecutivo_cuenta_nombre: "Laura Vega", hora_inicio_txt: "08:00", hora_fin_txt: "09:30" }, { nombre: "Ana", primer_apellido: "Soto" });
        assert.deepEqual([o.secciones, o.preguntas, o.fotos, o.articulos, o.articulos_con_diferencia], [2, 3, 3, 3, 1]);
        assert.deepEqual([o.empleado, o.ejecutivo_cuenta, o.hora_inicio, o.hora_fin, o.creado_por, o.fecha, o.creado], ["E9 - Pedro Mora", "Laura Vega", "08:00", "09:30", "Ana Soto", "2026-09-10T08:00:00", "2026-09-10T09:40:00"]);
        const s = JSON.stringify(o);
        for (const secreto of ["base64", "TEXTO-LIBRE-SECRETO", "a.jpg", "SSSS", "RRRR"]) assert.equal(s.includes(secreto), false, secreto);
    });
    it("tolera nulos, JSON ilegible y horas como Date", () => {
        const o = mapChecklistSupervisionRow({ id: 9, fecha: null, created_at: null, evaluacion: "no es json", articulos_puesto: null, hora_inicio: new Date("1970-01-01T07:05:00Z"), hora_fin: null, empresa_nombre: "0", empresa_id: 0 });
        assert.deepEqual([o.fecha, o.empresa, o.empleado, o.hora_inicio, o.hora_fin, o.creado_por, o.secciones, o.preguntas, o.fotos, o.articulos, o.articulos_con_diferencia], [null, null, null, "07:05", null, null, 0, 0, 0, 0, 0]);
    });
    it("trae el periodo [from, to) por fecha del reporte, con ubicación y creador", async () => {
        const rows = await checklistSupervision.load(db, P);
        assert.deepEqual(rows.map((r) => r.id).sort(), [2, 3]);
        const r3 = rows.find((r) => r.id === 3)!;
        assert.deepEqual([r3.empresa, r3.contrato, r3.sucursal, r3.puesto, r3.ejecutivo_cuenta, r3.creado_por, r3.empleado], ["G - Gonzalez", "C1 - Contrato A", "S1 - Central", "P1 - Entrada", "Laura Vega", "Ana Soto", "E9 - Pedro Mora"]);
        const r2 = rows.find((r) => r.id === 2)!;
        assert.deepEqual([r2.empleado, r2.ejecutivo_cuenta, r2.secciones, r2.articulos], [null, null, 0, 0]);
        assert.equal(JSON.stringify(rows).includes("base64"), false);
    });
    it("alcance: filtra por los ids de la fila", async () => {
        assert.deepEqual((await checklistSupervision.load(db, { ...P, scope: [{ nivel: "corpo", id: 11 }] })).map((r) => r.id), [2]);
        assert.deepEqual((await checklistSupervision.load(db, { ...P, scope: [{ nivel: "empresa", id: 1 }] })).map((r) => r.id).sort(), [2, 3]);
        assert.deepEqual(await checklistSupervision.load(db, { ...P, scope: [] }), []);
    });
    it("las claves de orden, búsqueda y filtro existen en la fila", async () => {
        const [r] = await checklistSupervision.load(db, P);
        for (const k of [...checklistSupervision.searchKeys, ...checklistSupervision.filterKeys, ...checklistSupervision.sortKeys, checklistSupervision.defaultSort]) assert.ok(k in r!, k);
    });
});
