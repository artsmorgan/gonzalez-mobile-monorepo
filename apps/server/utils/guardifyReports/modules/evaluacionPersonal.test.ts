import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluacionPersonal, filterEvaluacionesByScope, mapEvaluacionesConExtras, mapEvaluacionPersonalRow, resumenEvaluacion } from "./evaluacionPersonal";

const evaluacion = JSON.stringify([
    { title: "Actitud", questions: [{ title: "Puntualidad", answear: "8", images: ["a.jpg"] }, { title: "Trato", answear: "10" }] },
    { title: "Otros", questions: [{ title: "Orden", answear: "" }, { title: "Nota", answear: "excelente" }] },
]);

const raw = (o: Record<string, unknown> = {}) => ({
    id: 21, created_at: new Date("2026-09-15T09:00:00Z"), fecha_evaluacion: new Date("2026-09-14T00:00:00Z"), fecha_ingreso: new Date("2020-01-01T00:00:00Z"),
    empresa_id: 9, cliente_id: 4, division_id: 2, contrato_id: 31, corpo_id: 55, puesto_id: 140, empleado_id: 7, evaluador_id: 8,
    empresa_nombre: "9 - Seguridad SA", cliente_nombre: "Cliente Uno", division_nombre: "Seguridad", contrato_nombre: "C-31 - Contrato", corpo_nombre: "55 - Sede", puesto_nombre: "P140 - Portón",
    tipo: "Seguridad", nombre_empleado: "Pedro Mora", cedula_empleado: "2-0222-0333", nombre_evaluador: "Ana Soto",
    empleado_evaluado_txt: "Pedro Mora (E1)", evaluador_txt: "Ana Soto (E2)",
    evaluacion, comentarios: "c".repeat(800), firma_evaluador: "data:image/png;base64,AAAA", firma_empleado_manual: "BBBB",
    ...o,
});

describe("evaluación de personal: mapeo", () => {
    it("promedia las calificaciones numéricas y cuenta las preguntas", () => {
        assert.deepEqual(resumenEvaluacion(evaluacion), { preguntas: 4, promedio: 9 });
        const o = mapEvaluacionPersonalRow(raw());
        assert.equal(o.promedio, 9);
        assert.equal(o.preguntas, 4);
        assert.equal(o.creado, "2026-09-15T09:00:00");
        assert.equal(o.fecha_evaluacion, "2026-09-14T00:00:00");
        assert.equal(o.empleado, "Pedro Mora");
        assert.equal(o.cedula, "2-0222-0333");
        assert.equal(o.evaluador, "Ana Soto");
        assert.equal(o.sucursal, "55 - Sede");
        assert.equal((o.comentarios as string).length, 500);
    });
    it("no expone firmas ni imágenes", () => {
        const json = JSON.stringify(mapEvaluacionPersonalRow(raw()));
        assert.equal(json.includes("base64"), false);
        assert.equal(json.includes("BBBB"), false);
        assert.equal(json.includes("a.jpg"), false);
    });
    it("sin evaluación, JSON roto y ubicaciones sin resolver dan nulos", () => {
        assert.deepEqual(resumenEvaluacion("{roto"), { preguntas: 0, promedio: null });
        assert.deepEqual(resumenEvaluacion(JSON.stringify({ questions: [{ title: "x", answear: "7" }] })), { preguntas: 1, promedio: 7 });
        const o = mapEvaluacionPersonalRow(raw({ evaluacion: "", comentarios: "", empresa_id: 0, empresa_nombre: "0", contrato_id: 0, contrato_nombre: "0", fecha_evaluacion: null }));
        assert.equal(o.promedio, null);
        assert.equal(o.preguntas, 0);
        assert.equal(o.comentarios, null);
        assert.equal(o.empresa, null);
        assert.equal(o.contrato, null);
        assert.equal(o.fecha_evaluacion, null);
    });
    it("el módulo declara columnas de búsqueda, filtro y orden que existen en la fila", () => {
        const cols = Object.keys(mapEvaluacionPersonalRow(raw()));
        for (const k of [...evaluacionPersonal.searchKeys, ...evaluacionPersonal.filterKeys, ...evaluacionPersonal.sortKeys, evaluacionPersonal.defaultSort]) assert.ok(cols.includes(k), k);
    });
});

describe("evaluación de personal: columnas para filtros", () => {
    it("muestra empleado y evaluador como «código - nombre» y trae el ejecutivo de cuenta al final", () => {
        const o = mapEvaluacionPersonalRow(raw(), { ejecutivo: "Eva Rojas", empleadoCodigo: "1934", evaluadorCodigo: "2001" });
        assert.equal(o.empleado, "1934 - Pedro Mora");
        assert.equal(o.evaluador, "2001 - Ana Soto");
        assert.equal(o.ejecutivo_cuenta, "Eva Rojas");
        assert.equal(Object.keys(o).at(-1), "ejecutivo_cuenta");
        const sin = mapEvaluacionPersonalRow(raw());
        assert.equal(sin.empleado, "Pedro Mora");
        assert.equal(sin.ejecutivo_cuenta, null);
    });
    it("usa la división del contrato solo cuando la evaluación no la guardó", () => {
        assert.equal(mapEvaluacionPersonalRow(raw({ division_id: 0, division_nombre: "0" }), { divisionContrato: "Aseo" }).division, "Aseo");
        assert.equal(mapEvaluacionPersonalRow(raw(), { divisionContrato: "Aseo" }).division, "Seguridad");
    });
    it("carga ejecutivos, códigos y divisiones por lote", async () => {
        const table = (rows: any[]) => ({ findMany: async (a: any) => rows.filter((r) => !a?.where?.id?.in || a.where.id.in.includes(r.id)) });
        const db: any = {
            e_estructura_sucursal: table([{ id: 55, ejecutivoCuenta_id: 10 }]),
            n_ejecutivo_cuenta: table([{ id: 10, nombre: "Eva Rojas" }]),
            c_empleado: table([{ id: 7, codigo: "1934" }, { id: 8, codigo: "2001" }]),
            e_estructura_contrato: table([{ id: 31, division_id: 20 }]),
            n_division: table([{ id: 20, nombre: "Aseo" }]),
        };
        const out = await mapEvaluacionesConExtras(db, [raw({ id: 1 }), raw({ id: 2, division_id: 0, division_nombre: "0", evaluador_id: 99 })]);
        assert.deepEqual(out.map((o) => o.empleado), ["1934 - Pedro Mora", "1934 - Pedro Mora"]);
        assert.deepEqual(out.map((o) => o.evaluador), ["2001 - Ana Soto", "Ana Soto"]);
        assert.deepEqual(out.map((o) => o.division), ["Seguridad", "Aseo"]);
        assert.deepEqual(out.map((o) => o.ejecutivo_cuenta), ["Eva Rojas", "Eva Rojas"]);
    });
});

describe("evaluación de personal: alcance", () => {
    const rows = [raw({ id: 1 }), raw({ id: 2, corpo_id: 56, puesto_id: 141 })];
    it("filtra por los ids de la propia fila", () => {
        assert.equal(filterEvaluacionesByScope(rows, null).length, 2);
        assert.deepEqual(filterEvaluacionesByScope(rows, [{ nivel: "corpo", id: 56 }]).map((r) => r.id), [2]);
        assert.deepEqual(filterEvaluacionesByScope(rows, [{ nivel: "puesto", id: 140 }, { nivel: "puesto", id: 141 }]).map((r) => r.id), [1, 2]);
        assert.deepEqual(filterEvaluacionesByScope(rows, []), []);
    });
});
