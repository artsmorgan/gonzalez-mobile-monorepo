import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { encuestaSatisfaccion, filterEncuestasByScope, mapEncuestaRow, mapEncuestasConExtras, resumenEvaluaciones } from "./encuestaSatisfaccion";

const form = JSON.stringify({
    form: [
        { section_title: "Servicio", questions: [{ question: "a", value: 5 }, { question: "b", value: 3 }, { question: "c", value: 1, apply: false }] },
        { section_title: "APRECIACIONES GLOBALES", questions: [{ question: "d", value: 4, apply: "true" }] },
    ],
    know_process: true,
});

const raw = (o: Record<string, unknown> = {}) => ({
    id: 12, created_at: new Date("2026-09-20T16:05:00Z"), fecha: new Date("2026-09-19T00:00:00Z"),
    empresa_id: 9, cliente_id: 4, division_id: 2, contrato_id: 31, corpo_id: 55, puesto_id: 140,
    empresa_nombre: "9 - Seguridad SA", cliente_nombre: "Cliente Uno", division_nombre: "Seguridad", contrato_nombre: "C-31 - Contrato", corpo_nombre: "55 - Sede", puesto_nombre: "P140 - Portón",
    responsable_id: 8, responsable_nombre: "Ana Soto", nombre_responsable: "Ana S.", cedula_responsable: "1-1111-1111",
    nombre_evaluado: "Carlos Cliente", cedula_evaluado: "9-9999-9999", email_evaluado: "c@cliente.test", telefono_evaluado: "8888-8888",
    firma_evaluado: "data:image/png;base64,AAAA", firma_responsable: "data:image/png;base64,BBBB",
    evaluaciones: form, observaciones: "o".repeat(700),
    ...o,
});

describe("encuesta de satisfacción: mapeo", () => {
    it("calcula el promedio de las preguntas que aplican y recorta observaciones", () => {
        const o = mapEncuestaRow(raw());
        assert.equal(o.promedio, 4); // (5 + 3 + 4) / 3
        assert.equal(o.conoce_quejas, "Sí");
        assert.equal(o.creado, "2026-09-20T16:05:00");
        assert.equal(o.fecha, "2026-09-19T00:00:00");
        assert.equal(o.responsable, "Ana Soto");
        assert.equal(o.evaluado, "Carlos Cliente");
        assert.equal((o.observaciones as string).length, 500);
    });
    it("no expone firmas, correo, teléfono ni cédula del evaluado", () => {
        const json = JSON.stringify(mapEncuestaRow(raw()));
        for (const s of ["base64", "c@cliente.test", "8888-8888", "9-9999-9999"]) assert.equal(json.includes(s), false, s);
    });
    it("formato legado, JSON roto y vacíos dan nulos", () => {
        assert.deepEqual(resumenEvaluaciones(JSON.stringify([{ question: "q", result: 4 }, { question: "r", value: "2" }, { question: "s", result: "n/a" }])), { promedio: 3, conoceQuejas: null });
        assert.deepEqual(resumenEvaluaciones("{no es json"), { promedio: null, conoceQuejas: null });
        const o = mapEncuestaRow(raw({ evaluaciones: "", observaciones: " ", responsable_nombre: "8", nombre_responsable: null, division_id: 0, division_nombre: "0", fecha: null }));
        assert.equal(o.promedio, null);
        assert.equal(o.conoce_quejas, null);
        assert.equal(o.observaciones, null);
        assert.equal(o.responsable, null);
        assert.equal(o.division, null);
        assert.equal(o.fecha, null);
    });
    it("el módulo declara columnas de búsqueda, filtro y orden que existen en la fila", () => {
        const cols = Object.keys(mapEncuestaRow(raw()));
        for (const k of [...encuestaSatisfaccion.searchKeys, ...encuestaSatisfaccion.filterKeys, ...encuestaSatisfaccion.sortKeys, encuestaSatisfaccion.defaultSort]) assert.ok(cols.includes(k), k);
    });
});

describe("encuesta de satisfacción: columnas para filtros", () => {
    it("trae ejecutivo de cuenta y muestra al responsable como «código - nombre»", () => {
        const o = mapEncuestaRow(raw(), { ejecutivo: "Eva Rojas", responsableCodigo: "1934" });
        assert.equal(o.responsable, "1934 - Ana Soto");
        assert.equal(o.ejecutivo_cuenta, "Eva Rojas");
                assert.equal(mapEncuestaRow(raw()).responsable, "Ana Soto");
        assert.equal(mapEncuestaRow(raw()).ejecutivo_cuenta, null);
        assert.equal(mapEncuestaRow(raw({ responsable_nombre: "1934" }), { responsableCodigo: "1934" }).responsable, "1934");
    });
    it("lleva las 11 columnas estándar; creado_por, modificado y modificado_por salen del historial (null si no hay)", () => {
        const o = mapEncuestaRow(raw());
        for (const k of ["empresa", "cliente", "division", "contrato", "sucursal", "puesto", "id", "creado", "creado_por", "modificado", "modificado_por"]) assert.ok(k in o, k);
        assert.deepEqual([o.empresa, o.cliente, o.division, o.contrato, o.sucursal, o.puesto], ["9 - Seguridad SA", "Cliente Uno", "Seguridad", "C-31 - Contrato", "55 - Sede", "P140 - Portón"]);
        assert.deepEqual([o.id, o.creado, o.creado_por, o.modificado, o.modificado_por], [12, "2026-09-20T16:05:00", null, null, null]);
        const m = mapEncuestaRow(raw(), { creadoPor: "1934 - Ana Soto", modificacion: { cuando: "2026-09-21T08:00:00", quien: "77 - Eva Rojas" } });
        assert.deepEqual([m.creado_por, m.modificado, m.modificado_por], ["1934 - Ana Soto", "2026-09-21T08:00:00", "77 - Eva Rojas"]);
    });
    it("carga quién creó y quién modificó desde el historial, en lote", async () => {
        const histor = [
            { id: 1, nombre_tabla: "c_encuesta_cliente", registro_id: 1, created_by: 8, created_at: new Date("2026-09-20T16:05:00Z"), cambios: "[{\"prop\":\"__created__\"}]" },
            { id: 2, nombre_tabla: "c_encuesta_cliente", registro_id: 1, created_by: 9, created_at: new Date("2026-09-21T08:00:00Z"), cambios: "[{\"prop\":\"firma_evaluado\"}]" },
            { id: 3, nombre_tabla: "c_encuesta_cliente", registro_id: 1, created_by: 9, created_at: new Date("2026-09-22T09:00:00Z"), cambios: "[{\"prop\":\"observaciones\"}]" },
            { id: 4, nombre_tabla: "c_encuesta_cliente", registro_id: 99, created_by: 9, created_at: new Date("2026-09-23T09:00:00Z"), cambios: "[]" },
        ];
        const tabla = (rows: any[]) => ({
            findMany: async (a: any = {}) => {
                const w = a.where ?? {};
                return rows.filter((r) => (!w.id?.in || w.id.in.includes(r.id)) && (!w.registro_id?.in || w.registro_id.in.includes(r.registro_id))
                    && (!w.cambios?.contains || r.cambios.includes(w.cambios.contains)) && !(w.NOT?.cambios?.contains && r.cambios.includes(w.NOT.cambios.contains)));
            },
        });
        const db: any = { e_estructura_sucursal: tabla([]), n_ejecutivo_cuenta: tabla([]), c_cambios_apps_modules: tabla(histor), c_empleado: tabla([{ id: 8, codigo: "1934", nombre: "Ana", primer_apellido: "Soto" }, { id: 9, codigo: "77", nombre: "Eva", primer_apellido: "Rojas" }]) };
        const out = await mapEncuestasConExtras(db, [raw({ id: 1 }), raw({ id: 2 })]);
        assert.deepEqual(out.map((o) => [o.creado_por, o.modificado, o.modificado_por]), [["1934 - Ana Soto", "2026-09-22T09:00:00", "77 - Eva Rojas"], [null, null, null]]);
    });
    it("si el historial no se puede leer, creado_por y modificado quedan null", async () => {
        const vacia = { findMany: async () => [] };
        const db: any = { e_estructura_sucursal: vacia, n_ejecutivo_cuenta: vacia, c_empleado: vacia, c_cambios_apps_modules: { findMany: async () => { throw new Error("sin tabla"); } } };
        const out = await mapEncuestasConExtras(db, [raw({ id: 1 })]);
        assert.deepEqual([out[0]!.creado_por, out[0]!.modificado, out[0]!.modificado_por], [null, null, null]);
    });
    it("carga ejecutivos y códigos por lote, una consulta por tabla", async () => {
        const table = (rows: any[]) => ({ findMany: async (a: any) => rows.filter((r) => !a?.where?.id?.in || a.where.id.in.includes(r.id)) });
        const calls: string[] = [];
        const wrap = (name: string, rows: any[]) => ({ findMany: async (a: any) => { calls.push(name); return table(rows).findMany(a); } });
        const db: any = {
            e_estructura_sucursal: wrap("sucursal", [{ id: 55, ejecutivoCuenta_id: 10 }, { id: 56, ejecutivoCuenta_id: null }]),
            n_ejecutivo_cuenta: wrap("ejecutivo", [{ id: 10, nombre: "Eva Rojas" }]),
            c_empleado: wrap("empleado", [{ id: 8, codigo: "1934" }]),
            c_cambios_apps_modules: table([]),
        };
        const out = await mapEncuestasConExtras(db, [raw({ id: 1 }), raw({ id: 2, corpo_id: 56 }), raw({ id: 3, responsable_id: 99 })]);
        assert.deepEqual(out.map((o) => o.ejecutivo_cuenta), ["Eva Rojas", null, "Eva Rojas"]);
        assert.deepEqual(out.map((o) => o.responsable), ["1934 - Ana Soto", "1934 - Ana Soto", "Ana Soto"]);
        assert.equal(calls.length, 3);
    });
});

describe("encuesta de satisfacción: alcance", () => {
    const rows = [raw({ id: 1 }), raw({ id: 2, cliente_id: 5, contrato_id: 32, corpo_id: 56, puesto_id: 141 })];
    it("filtra por los ids de la propia fila", () => {
        assert.equal(filterEncuestasByScope(rows, null).length, 2);
        assert.deepEqual(filterEncuestasByScope(rows, [{ nivel: "cliente", id: 5 }]).map((r) => r.id), [2]);
        assert.deepEqual(filterEncuestasByScope(rows, [{ nivel: "empresa", id: 9 }]).map((r) => r.id), [1, 2]);
        assert.deepEqual(filterEncuestasByScope(rows, []), []);
    });
});
