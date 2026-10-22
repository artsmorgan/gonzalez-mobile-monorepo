import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { construirEvidencia, filaDeEvidencia, huellaSha256 } from "../evidencia";
import { aplicarEvidencia, cargarEvidencias, conEvidencia, EVIDENCIA_COLUMNAS } from "./evidencia";
import { GUARDIFY_REPORT_MODULES } from "./registry";
import type { GuardifyReportModule } from "./types";

const P = { from: "2026-09-01", to: "2026-10-01", page: 1, pageSize: 50, sort: null, dir: "desc" as const, q: null, filters: [], scope: null };
const modulo = (rows: any[], extra: Partial<GuardifyReportModule> = {}): GuardifyReportModule => ({
    id: "demo", supportsScope: false, searchKeys: [], filterKeys: ["a"], sortKeys: ["a"], defaultSort: "a", load: async () => rows, ...extra,
});
/** Base simulada de `c_evidencia_registro`: devuelve las filas que cumplen tabla y registro_id. */
function fakeDb(filas: any[], opts: { fail?: boolean } = {}) {
    const consultas: any[] = [];
    const db = {
        c_evidencia_registro: {
            findMany: async (args: any) => {
                consultas.push(args);
                if (opts.fail) throw new Error("Table 'c_evidencia_registro' doesn't exist");
                return filas.filter((f) => f.tabla === args.where.tabla && args.where.registro_id.in.includes(f.registro_id));
            },
        },
    } as any;
    return { db, consultas };
}
const fila = (id: number, tabla: string, registro_id: number, over: Record<string, unknown> = {}) => ({
    id, tabla, registro_id, dispositivo_id: "dev-1", latitud: "9.9341", longitud: "-84.0877", firma: "ab".repeat(32), cedula: "1-0555-0666", ...over,
});

describe("columnas de evidencia en los reportes (issue #153)", () => {
    it("cada fila lleva dispositivo, latitud y longitud numéricas, firma y cédula de su registro", async () => {
        const { db } = fakeDb([fila(1, "c_incidente", 10)]);
        const rows = await conEvidencia(modulo([{ id: 10, a: 1 }, { id: 11, a: 2 }]), "c_incidente").load(db, P);
        assert.deepEqual(rows[0], { id: 10, a: 1, dispositivo: "dev-1", latitud: 9.9341, longitud: -84.0877, firma: "ab".repeat(32), cedula: "1-0555-0666" });
        // un registro anterior a la evidencia sale con las cinco vacías
        assert.deepEqual(EVIDENCIA_COLUMNAS.map((k) => rows[1]![k]), [null, null, null, null, null]);
    });
    it("de cada registro se muestra la evidencia más reciente (la de su última edición)", async () => {
        const { db } = fakeDb([fila(1, "c_incidente", 10, { dispositivo_id: "alta" }), fila(7, "c_incidente", 10, { dispositivo_id: "edicion" }), fila(4, "c_incidente", 10, { dispositivo_id: "intermedia" })]);
        const rows = await conEvidencia(modulo([{ id: 10 }]), "c_incidente").load(db, P);
        assert.equal(rows[0]!.dispositivo, "edicion");
    });
    it("solo la tabla del reporte: un registro con el mismo id en otra tabla no se mezcla", async () => {
        const { db } = fakeDb([fila(1, "c_otra_tabla", 10, { dispositivo_id: "ajeno" })]);
        const rows = await conEvidencia(modulo([{ id: 10 }]), "c_incidente").load(db, P);
        assert.equal(rows[0]!.dispositivo, null);
    });
    it("no pisa las columnas que el módulo ya devuelve (p. ej. latitud/longitud del puesto)", async () => {
        const { db } = fakeDb([fila(1, "c_ubicacion_puesto_registro_cambios", 3)]);
        const rows = await conEvidencia(modulo([{ id: 3, latitud: 10, longitud: -85 }]), "c_ubicacion_puesto_registro_cambios").load(db, P);
        assert.deepEqual([rows[0]!.latitud, rows[0]!.longitud, rows[0]!.dispositivo], [10, -85, "dev-1"]);
    });
    it("un reporte que mezcla tablas elige la tabla por fila (artículos del puesto: plan y entregados)", async () => {
        const { db } = fakeDb([fila(1, "plan", 5, { dispositivo_id: "p" }), fila(2, "entrega", 5, { dispositivo_id: "e" })]);
        const rows = await conEvidencia(modulo([{ id: 5, origen: "Plan" }, { id: 5, origen: "Asignado" }]), (r) => (r.origen === "Asignado" ? "entrega" : "plan")).load(db, P);
        assert.deepEqual(rows.map((r) => r.dispositivo), ["p", "e"]);
    });
    it("carga por lotes: una consulta por tanda de 1000 ids, nunca una por fila", async () => {
        const { db, consultas } = fakeDb([]);
        const rows = Array.from({ length: 2500 }, (_, i) => ({ id: i + 1 }));
        await conEvidencia(modulo(rows), "c_incidente").load(db, P);
        assert.equal(consultas.length, 3);
    });
    it("si la tabla de evidencia aún no existe el reporte sigue funcionando", async () => {
        const { db } = fakeDb([], { fail: true });
        const rows = await conEvidencia(modulo([{ id: 1 }]), "c_incidente").load(db, P);
        assert.equal(rows.length, 1);
        assert.equal(rows[0]!.dispositivo, null);
        assert.equal((await cargarEvidencias(db, "x", [1])).size, 0);
    });
    it("un reporte sin tabla (sesiones, marcas) lleva las columnas vacías y no consulta nada", async () => {
        const { db, consultas } = fakeDb([]);
        const rows = await conEvidencia(modulo([{ id: 1 }]), "").load(db, P);
        assert.equal(consultas.length, 0);
        assert.deepEqual(EVIDENCIA_COLUMNAS.map((k) => rows[0]![k]), [null, null, null, null, null]);
    });
    it("las columnas figuran como filtrables y ordenables, sin duplicar las que el módulo ya declaraba", () => {
        const m = conEvidencia(modulo([], { filterKeys: ["a", "latitud"], sortKeys: ["a"] }), "t");
        assert.deepEqual(m.filterKeys, ["a", "latitud", "dispositivo", "longitud", "firma", "cedula"]);
        assert.deepEqual(m.sortKeys, ["a", ...EVIDENCIA_COLUMNAS]);
    });
    it("sin filas no consulta", async () => {
        const { db, consultas } = fakeDb([]);
        assert.deepEqual(await conEvidencia(modulo([]), "t").load(db, P), []);
        assert.equal(consultas.length, 0);
    });
    it("aplicarEvidencia no muta las filas originales", () => {
        const original = [{ id: 1 }];
        const out = aplicarEvidencia(original, () => "t", new Map());
        assert.deepEqual(original, [{ id: 1 }]);
        assert.ok("firma" in out[0]!);
    });
});

describe("evidencia en los formularios (FormRecord.evidencia)", () => {
    const real = () => {
        const e = construirEvidencia({ tabla: "c_incidente", registroId: 10, accion: "CREATE" }, {
            headers: { "x-device-uid": "dev-1", "x-evidence-lat": "9.9341", "x-evidence-lng": "-84.0877", "x-evidence-at": String(Date.UTC(2026, 9, 21, 14, 0, 0)) },
            actor: { id: 7, cedula: "1-1", sessionId: "s" }, datos: {}, ahoraMs: Date.UTC(2026, 9, 21, 14, 30, 0),
        })!;
        return { id: 1, ...filaDeEvidencia(e, null, Date.UTC(2026, 9, 21, 14, 30, 0)) };
    };
    const modConForm = (): GuardifyReportModule => modulo([], {
        form: { loadRecords: async (_db, ids) => ids.map((id) => ({ id, variante: null, creado: null, estructura: { empresa: null, cliente: null, division: null, contrato: null, sucursal: null, puesto: null }, valores: {}, listas: {}, firmas: {}, firmasPresentes: [], hier: {} })) },
    });
    it("cada registro lleva dispositivo, coordenadas, cédula, fecha y el contenido firmado: Guardify recalcula la huella y coincide", async () => {
        const { db } = fakeDb([real()]);
        const [r] = await conEvidencia(modConForm(), "c_incidente").form!.loadRecords(db, [10], { firmas: false });
        const ev = r!.evidencia!;
        assert.deepEqual([ev.dispositivo, ev.latitud, ev.longitud, ev.cedula, ev.fecha], ["dev-1", 9.9341, -84.0877, "1-1", "2026-10-21T14:00:00"]);
        assert.equal(huellaSha256(ev.contenido), ev.firma);
    });
    it("un registro sin evidencia (anterior a la función) no lleva el bloque", async () => {
        const { db } = fakeDb([]);
        const [r] = await conEvidencia(modConForm(), "c_incidente").form!.loadRecords(db, [10], { firmas: false });
        assert.equal(r!.evidencia, undefined);
    });
    it("un módulo sin formulario no inventa uno", () => {
        assert.equal(conEvidencia(modulo([]), "c_incidente").form, undefined);
    });
});

describe("registro de reportes de Guardify con evidencia", () => {
    it("los 36 reportes llevan las cinco columnas como filtrables y ordenables", () => {
        const ids = Object.keys(GUARDIFY_REPORT_MODULES);
        assert.equal(ids.length, 36);
        for (const id of ids) {
            const m = GUARDIFY_REPORT_MODULES[id]!;
            for (const k of EVIDENCIA_COLUMNAS) {
                assert.ok(m.filterKeys.includes(k), `${id}: filterKeys sin ${k}`);
                assert.ok(m.sortKeys.includes(k), `${id}: sortKeys sin ${k}`);
            }
        }
    });
});
