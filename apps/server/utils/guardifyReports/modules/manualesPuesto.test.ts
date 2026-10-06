import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseReportParams } from "../params";
import { loadManualesPuesto, manualesPuesto, mapManualPuestoRow } from "./manualesPuesto";

const raw = {
    id: 60, created_at: new Date("2026-09-20T09:00:00Z"), title: "Manual de rondas", description: "z".repeat(900), classification: "Seguridad",
    empresa_id: 1, cliente_id: 2, division_id: 3, contrato_id: 4, corpo_id: 5, puesto_id: 6,
    empresa_txt: "9 - Empresa", cliente_txt: "Cliente", division_txt: "D - División", contrato_txt: "C1 - Contrato", corpo_txt: "S1 - Sucursal", puesto_principal_txt: "P1 - Puesto",
    created_by: "11", created_by_nombre: "11 - Carla Soto", firma: "data:image/png;base64,AAAA", quiz: '{"questions":[{"title":"secreto"}]}',
    e_puestos_manual_puesto: [{ puesto_id: 10 }, { puesto_id: 11 }],
    e_empleados_manual_puesto: [{ empleado_id: 1 }, { empleado_id: 2 }, { empleado_id: 3 }],
    e_empleado_visualizacion_manual_puesto: [
        { empleado_id: 1, approved: true, firma_empleado_manual: "data:image/png;base64,BBBB", quiz_answear: "[]", firma_empleado: "data:image/png;base64,CCCC" },
        { empleado_id: 2, approved: false },
        { empleado_id: 3, approved: null },
    ],
};

describe("manuales de trabajo: mapeo", () => {
    it("aplana la fila con conteos de vínculos y visualizaciones", () => {
        const o = mapManualPuestoRow(raw);
        assert.equal(o.id, 60);
        assert.equal(o.creado, "2026-09-20T09:00:00");
        assert.deepEqual([o.titulo, o.clasificacion], ["Manual de rondas", "Seguridad"]);
        assert.equal((o.descripcion as string).length, 500);
        assert.deepEqual([o.empresa, o.cliente, o.division, o.contrato, o.sucursal, o.puesto], ["9 - Empresa", "Cliente", "D - División", "C1 - Contrato", "S1 - Sucursal", "P1 - Puesto"]);
        assert.deepEqual([o.puestos_vinculados, o.empleados_vinculados, o.visualizaciones, o.firmados, o.aprobados], [2, 3, 3, 1, 1]);
        assert.equal(o.creado_por, "11 - Carla Soto");
    });
    it("nunca expone firmas, cuestionario ni respuestas", () => {
        const s = JSON.stringify(mapManualPuestoRow(raw));
        for (const bad of ["base64", "secreto", "quiz"]) assert.equal(s.includes(bad), false, bad);
        assert.deepEqual(Object.keys(mapManualPuestoRow(raw)).filter((k) => k === "firma" || k.startsWith("firma_")), []);
    });
    it("tolera relaciones ausentes y nulos", () => {
        const o = mapManualPuestoRow({ id: 1, created_at: null, title: null, description: null });
        assert.deepEqual([o.creado, o.titulo, o.clasificacion, o.puestos_vinculados, o.empleados_vinculados, o.visualizaciones, o.firmados, o.aprobados], [null, null, null, 0, 0, 0, 0, 0]);
    });
});

describe("manuales de trabajo: carga y alcance", () => {
    const m = (id: number, puesto: number, linked: number[]) => ({ ...raw, id, puesto_id: puesto, corpo_id: 5, contrato_id: 4, e_puestos_manual_puesto: linked.map((puesto_id) => ({ puesto_id })) });
    const data = [m(1, 6, []), m(2, 90, [10]), m(3, 91, [11])];
    // Puesto 10 vive en el contrato 700; el 11 en el 4 (el mismo que el puesto principal de los manuales).
    const tables: Record<string, any[]> = {
        e_estructura_puesto: [{ id: 10, sucursal_id: 50 }, { id: 11, sucursal_id: 51 }],
        e_estructura_sucursal: [{ id: 50, contrato_id: 700 }, { id: 51, contrato_id: 701 }],
        e_estructura_contrato: [{ id: 700, cliente_id: 7, empresa_id: 1, division_id: 3 }, { id: 701, cliente_id: 7, empresa_id: 1, division_id: 3 }],
    };
    const db = new Proxy({}, { get: (_t, name: string) => ({ findMany: async () => tables[name] ?? [] }) }) as any;
    let seen: any;
    const query = async (_db: any, filters: any, orderKey: string) => { seen = { filters, orderKey }; return data; };
    const params = (extra: Record<string, string> = {}) => parseReportParams(new URLSearchParams({ from: "2026-09-01", to: "2026-10-01", ...extra }));
    it("pide el periodo [from, to) con límite inclusivo al último día", async () => {
        await loadManualesPuesto(db, params(), query);
        assert.deepEqual(seen, { filters: { creadoDesde: "2026-09-01T00:00:00", creadoHasta: "2026-09-30T23:59:59" }, orderKey: "created_at" });
    });
    it("con alcance cuenta el puesto principal y los puestos vinculados", async () => {
        assert.equal((await loadManualesPuesto(db, params(), query)).length, 3);
        // El contrato 4 es el de TODOS los puestos principales de la prueba: salen los tres.
        assert.equal((await loadManualesPuesto(db, params({ scope: "contrato:4" }), query)).length, 3);
        // Solo el manual 2 está vinculado al puesto 10 (contrato 700).
        assert.deepEqual((await loadManualesPuesto(db, params({ scope: "contrato:700" }), query)).map((r) => r.id), [2]);
        assert.deepEqual((await loadManualesPuesto(db, params({ scope: "puesto:11" }), query)).map((r) => r.id), [3]);
        assert.deepEqual((await loadManualesPuesto(db, params({ scope: "puesto:6" }), query)).map((r) => r.id), [1]);
        assert.equal((await loadManualesPuesto(db, params({ scope: "" }), query)).length, 0);
    });
    it("declara alcance y sus claves existen en la fila", () => {
        assert.equal(manualesPuesto.supportsScope, true);
        const o = mapManualPuestoRow(raw);
        for (const k of [...manualesPuesto.searchKeys, ...manualesPuesto.filterKeys, ...manualesPuesto.sortKeys, manualesPuesto.defaultSort]) assert.ok(k in o, k);
    });
});
