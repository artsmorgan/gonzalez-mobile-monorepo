import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { entregaPuesto, entregaUbicacionIds, filterEntregasByScope, mapEntregaPuestoRow, mapEntregasConExtras } from "./entregaPuesto";

const raw = (o: Record<string, unknown> = {}) => ({
    id: 3, created_at: new Date("2026-09-22T06:10:00Z"),
    cliente_id: 4, corpo_id: 55, puesto_id: 140, empresa_id_resolved: 9,
    e_estructura_sucursal: { contrato_id: 31, e_estructura_contrato: { division_id: 2 } },
    oficial_entrega: "Ana Soto", fecha_entrada_entrega: new Date("2026-09-21T00:00:00Z"), hora_entrada_entrega: new Date("1970-01-01T18:00:00Z"),
    fecha_salida_entrega: new Date("2026-09-22T00:00:00Z"), hora_salida_entrega: new Date("1970-01-01T06:00:00Z"), turno_entrega: "N",
    oficial_recibe: "Luis Mora", fecha_entrada_recibe: new Date("2026-09-22T00:00:00Z"), hora_entrada_recibe: "1970-01-01T06:00:00.000Z",
    fecha_salida_recibe: new Date("2026-09-22T00:00:00Z"), hora_salida_recibe: "14:00:00", turno_recibe: "D",
    created_by: 7, marca_entrega_id: 123, marca_recibe_id: null,
    articulos_puesto: JSON.stringify([{ nombre: "Radio", estado: "Bueno" }, { nombre: "Linterna", estado: "Malo", observaciones: "sin pilas" }, { nombre: "Llave", estado: "No está" }]),
    observaciones: "o".repeat(700), firma_entrega: "data:image/png;base64,AAAA", firma_recibe: "BBBB", firma_responsable: "CCCC",
    ...o,
});

describe("entrega de puesto: mapeo", () => {
    it("une fecha y hora, traduce turnos y cuenta artículos", () => {
        const o = mapEntregaPuestoRow(raw());
        assert.equal(o.creado, "2026-09-22T06:10:00");
        assert.equal(o.entrada_entrega, "2026-09-21T18:00:00");
        assert.equal(o.salida_entrega, "2026-09-22T06:00:00");
        assert.equal(o.entrada_recibe, "2026-09-22T06:00:00");
        assert.equal(o.salida_recibe, "2026-09-22T14:00:00");
        assert.equal(o.turno_entrega, "Nocturno");
        assert.equal(o.turno_recibe, "Diurno");
        assert.equal(o.articulos, 3);
        assert.equal(o.articulos_con_novedad, 2);
        assert.equal((o.observaciones as string).length, 500);
    });
    it("no expone firmas, ids de marca ni el detalle de los artículos", () => {
        const o = mapEntregaPuestoRow(raw());
        const json = JSON.stringify(o);
        for (const s of ["base64", "BBBB", "CCCC", "sin pilas", "Linterna"]) assert.equal(json.includes(s), false, s);
        assert.deepEqual(Object.keys(o).filter((k) => k.includes("marca") || k.includes("firma")), []);
    });
    it("campos opcionales vacíos, artículos rotos y ubicaciones sin resolver dan nulos", () => {
        const o = mapEntregaPuestoRow(raw({ oficial_entrega: null, fecha_entrada_entrega: null, hora_entrada_entrega: null, fecha_salida_entrega: new Date("2026-09-22T00:00:00Z"), hora_salida_entrega: null, turno_entrega: null, articulos_puesto: "{roto", observaciones: "", empresa_id_resolved: 0, e_estructura_sucursal: null }));
        assert.equal(o.oficial_entrega, null);
        assert.equal(o.entrada_entrega, null);
        assert.equal(o.salida_entrega, "2026-09-22T00:00:00"); // hay fecha pero no hora
        assert.equal(o.turno_entrega, null);
        assert.equal(o.articulos, 0);
        assert.equal(o.articulos_con_novedad, 0);
        assert.equal(o.observaciones, null);
        assert.equal(o.empresa, null);
        assert.equal(o.division, null);
        assert.deepEqual(entregaUbicacionIds(raw({ empresa_id_resolved: 0, e_estructura_sucursal: null })), { empresa: 0, cliente: 4, division: undefined, contrato: undefined, corpo: 55, puesto: 140 });
    });
    it("el módulo declara columnas de búsqueda, filtro y orden que existen en la fila", () => {
        const cols = Object.keys(mapEntregaPuestoRow(raw()));
        for (const k of [...entregaPuesto.searchKeys, ...entregaPuesto.filterKeys, ...entregaPuesto.sortKeys, entregaPuesto.defaultSort]) assert.ok(cols.includes(k), k);
    });
});

describe("entrega de puesto: columnas para filtros", () => {
    it("trae ejecutivo de cuenta y quien lo creó al final de la fila", () => {
        const o = mapEntregaPuestoRow(raw(), { ejecutivo: "Eva Rojas", creadoPor: "Luis Mora" });
        assert.equal(o.ejecutivo_cuenta, "Eva Rojas");
        assert.equal(o.creado_por, "Luis Mora");
        assert.equal(Object.keys(o).at(-1), "ejecutivo_cuenta");
        assert.equal("usuario_inserta" in o, false);
        assert.equal(mapEntregaPuestoRow(raw()).creado_por, null);
    });
    it("lleva siempre las 11 columnas estándar; modificado y modificado_por salen vacíos (la tabla no los guarda)", () => {
        const ubic = { empresa: "9 - Seguridad SA", cliente: "Cliente Uno", division: "Seguridad", contrato: "C-31 - Contrato", sucursal: "55 - Sede", puesto: "P140 - Portón" };
        const o = mapEntregaPuestoRow(raw(), { ubic, creadoPor: "Luis Mora" });
        assert.deepEqual(
            ["empresa", "cliente", "division", "contrato", "sucursal", "puesto", "id", "creado", "creado_por", "modificado", "modificado_por"].map((k) => o[k]),
            ["9 - Seguridad SA", "Cliente Uno", "Seguridad", "C-31 - Contrato", "55 - Sede", "P140 - Portón", 3, "2026-09-22T06:10:00", "Luis Mora", null, null],
        );
        const v = mapEntregaPuestoRow(raw({ created_at: null }));
        for (const k of ["empresa", "cliente", "division", "contrato", "sucursal", "puesto", "creado", "creado_por", "modificado", "modificado_por"]) assert.equal(v[k], null, k);
    });
    it("carga ubicación («código - nombre»), ejecutivos y nombres de quien registró por lote", async () => {
        const calls: string[] = [];
        const table = (name: string, rows: any[]) => ({ findMany: async (a: any) => { calls.push(name); return rows.filter((r) => !a?.where?.id?.in || a.where.id.in.includes(r.id)); } });
        const db: any = {
            e_estructura_empresa: table("e_estructura_empresa", [{ id: 9, codigo: "9", nombre: "Seguridad SA" }]),
            e_estructura_cliente: table("e_estructura_cliente", [{ id: 4, nombre: "Cliente Uno" }]),
            n_division: table("n_division", [{ id: 2, nombre: "Seguridad" }]),
            e_estructura_contrato: table("e_estructura_contrato", [{ id: 31, nro_contrato: "C-31", nombre: "Contrato" }]),
            e_estructura_sucursal: table("e_estructura_sucursal", [{ id: 55, nro_sucursal: "55", nombre: "Sede", ejecutivoCuenta_id: 10 }]),
            e_estructura_puesto: table("e_estructura_puesto", [{ id: 140, codigo: "P140", nombre: "Portón" }]),
            n_ejecutivo_cuenta: table("n_ejecutivo_cuenta", [{ id: 10, nombre: "Eva Rojas" }]),
            c_empleado: table("c_empleado", [{ id: 7, nombre: "Luis", primer_apellido: "Mora", segundo_apellido: null }]),
        };
        const out = await mapEntregasConExtras(db, [raw({ id: 1 }), raw({ id: 2, corpo_id: 56, created_by: 99, e_estructura_sucursal: { contrato_id: 99, e_estructura_contrato: { division_id: 2 } } })]);
        assert.deepEqual(out.map((o) => o.ejecutivo_cuenta), ["Eva Rojas", null]);
        assert.deepEqual(out.map((o) => o.creado_por), ["Luis Mora", null]);
        assert.deepEqual(["empresa", "cliente", "division", "contrato", "sucursal", "puesto"].map((k) => out[0]![k]), ["9 - Seguridad SA", "Cliente Uno", "Seguridad", "C-31 - Contrato", "55 - Sede", "P140 - Portón"]);
        assert.deepEqual(["contrato", "sucursal", "division"].map((k) => out[1]![k]), [null, null, "Seguridad"]);
        assert.equal(calls.filter((c) => c === "e_estructura_empresa").length, 1);
        assert.equal(calls.filter((c) => c === "n_ejecutivo_cuenta").length, 1);
    });
    it("las columnas de fecha y hora de quien entrega y recibe son fecha-hora (para los filtros de rango)", () => {
        const o = mapEntregaPuestoRow(raw());
        for (const k of ["entrada_entrega", "entrada_recibe"]) assert.match(String(o[k]), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
    });
});

describe("entrega de puesto: alcance", () => {
    const tables: Record<string, any[]> = {
        e_estructura_puesto: [{ id: 140, sucursal_id: 55 }, { id: 141, sucursal_id: 56 }],
        e_estructura_sucursal: [{ id: 55, contrato_id: 31 }, { id: 56, contrato_id: 32 }],
        e_estructura_contrato: [{ id: 31, cliente_id: 4, empresa_id: 9, division_id: 2 }, { id: 32, cliente_id: 5, empresa_id: 9, division_id: 2 }],
    };
    const db = new Proxy({}, { get: (_t, name: string) => ({ findMany: async (a: any) => (tables[name] ?? []).filter((r) => !a?.where?.id?.in || a.where.id.in.includes(r.id)) }) }) as any;
    const rows = [raw({ id: 1, puesto_id: 140 }), raw({ id: 2, puesto_id: 141 }), raw({ id: 3, puesto_id: 999 })];
    it("deduce la ubicación del puesto; los puestos desconocidos quedan fuera con alcance", async () => {
        assert.equal((await filterEntregasByScope(db, rows, null)).length, 3);
        assert.deepEqual((await filterEntregasByScope(db, rows, [{ nivel: "contrato", id: 32 }])).map((r) => r.id), [2]);
        assert.deepEqual((await filterEntregasByScope(db, rows, [{ nivel: "empresa", id: 9 }])).map((r) => r.id), [1, 2]);
        assert.deepEqual(await filterEntregasByScope(db, rows, []), []);
    });
});
