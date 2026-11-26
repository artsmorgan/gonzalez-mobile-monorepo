import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { writeFormSample, SAMPLE_PNG } from "../formSamples";
import { armarRegistro, entregaPuestoForm, firmaImagen, hmOf, turnoLegible } from "./entregaPuestoForm";

const FIRMA = "data:image/png;base64," + "A".repeat(300);
const raw = {
    id: 3, created_at: new Date("2026-09-22T06:10:00Z"),
    cliente_id: 4, corpo_id: 55, puesto_id: 140,
    oficial_entrega: "Ana Soto", fecha_entrada_entrega: new Date("2026-09-21T00:00:00Z"), hora_entrada_entrega: new Date("1970-01-01T18:00:00Z"),
    fecha_salida_entrega: new Date("2026-09-22T00:00:00Z"), hora_salida_entrega: new Date("1970-01-01T06:00:00Z"), turno_entrega: "N", marca_entrega_id: 123,
    oficial_recibe: "Luis Mora", fecha_entrada_recibe: new Date("2026-09-22T00:00:00Z"), hora_entrada_recibe: "1970-01-01T06:00:00.000Z", turno_recibe: "D", marca_recibe_id: null,
    articulos_puesto: JSON.stringify([
        { id: 1, nombre: "Radio", cantidad_requerida: 2, cantidad_real: 2, estado: "Bueno", observaciones: "" },
        { id: 2, nombre: "Linterna", cantidad_requerida: 1, cantidad_real: 0, estado: "No está", observaciones: "Se perdió" },
        { id: 3, nombre: "Libro", cantidad: 1, cantidad_real: 1, estado: "Malo" },
    ]),
    observaciones: "Sin novedad.", created_by: 7, firma_entrega: FIRMA, firma_recibe: "BBBB", firma_responsable: "TOKEN-QR-GPS-999", image_delivery: "foto1.jpg", image_receives: "foto2.jpg",
};
const ubic = { empresa: "9 - Seguridad SA", cliente: "Cliente Uno", division: "Seguridad", contrato: "C-31 - Contrato", sucursal: "55 - Sede", puesto: "P140 - Portón" };

describe("entrega de puesto como formulario", () => {
    it("traduce turno, hora y firma", () => {
        assert.equal(turnoLegible("N"), "Nocturno");
        assert.equal(turnoLegible("m"), "Mixto");
        assert.equal(turnoLegible(null), null);
        assert.equal(hmOf(new Date("1970-01-01T18:05:00Z")), "18:05");
        assert.equal(hmOf("14:00:00"), "14:00");
        assert.equal(hmOf(null), null);
        assert.equal(firmaImagen("BBBB"), null);
        assert.equal(firmaImagen(FIRMA), FIRMA);
    });
    it("arma el registro: fechas YYYY-MM-DD, horas HH:mm, artículos con cantidades (0 incluido)", () => {
        const r = armarRegistro(raw, ubic, false, { puesto: 140 });
        assert.equal(r.variante, null);
        assert.equal(r.creado, "2026-09-22T06:10:00");
        assert.deepEqual([r.valores.corpo, r.valores.cliente], ["55 - Sede", "Cliente Uno"]);
        assert.deepEqual([r.valores.fecha_entrada, r.valores.hora_entrada, r.valores.fecha_salida, r.valores.hora_salida], ["2026-09-21", "18:00", "2026-09-22", "06:00"]);
        assert.deepEqual([r.valores.turno, r.valores.dia], ["Nocturno", "2026-09-21"]);
        assert.deepEqual([r.valores.oficial_entrega, r.valores.oficial_recibe, r.valores.observaciones], ["Ana Soto", "Luis Mora", "Sin novedad."]);
        assert.deepEqual(r.listas.articulos, [
            { nombre: "Radio", cantidad_requerida: 2, cantidad_real: 2, estado: "Bueno", observaciones: null },
            { nombre: "Linterna", cantidad_requerida: 1, cantidad_real: 0, estado: "No está", observaciones: "Se perdió" },
            { nombre: "Libro", cantidad_requerida: 1, cantidad_real: 1, estado: "Malo", observaciones: null },
        ]);
    });
    it("lo que quien entrega no llenó sale «N/A», como en el generador", () => {
        const r = armarRegistro({ ...raw, oficial_entrega: null, fecha_entrada_entrega: null, hora_entrada_entrega: null, turno_entrega: "", articulos_puesto: "{roto" }, ubic, false);
        assert.deepEqual([r.valores.oficial_entrega, r.valores.fecha_entrada, r.valores.hora_entrada, r.valores.turno, r.valores.dia], ["N/A", "N/A", "N/A", "N/A", "N/A"]);
        assert.deepEqual(r.listas.articulos, []);
    });
    it("firmas solo con firmas=1; dice cuáles tiene; nunca fotos, marcas ni la firma del responsable", () => {
        const sin = armarRegistro(raw, ubic, false);
        assert.deepEqual(sin.firmas, { firma_entrega: null });
        assert.deepEqual(sin.firmasPresentes, ["firma_entrega"]); // «BBBB» no es una imagen
        assert.equal(armarRegistro(raw, ubic, true).firmas.firma_entrega, FIRMA);
        const json = JSON.stringify(sin);
        for (const s of ["TOKEN-QR", "foto1", "foto2", "123"]) assert.equal(json.includes(s), false, s);
    });
    it("carga en lote: una consulta por tabla, la ubicación sale del puesto", async () => {
        const calls: string[] = [];
        const t = (name: string, rows: any[]) => ({ findMany: async (a: any) => { calls.push(`${name}:${JSON.stringify(a.where)}`); const ids: number[] | undefined = a.where?.id?.in; return ids ? rows.filter((x) => ids.includes(x.id)) : rows; } });
        const db: any = {
            e_registro_entrega_puesto: t("ent", [raw, { ...raw, id: 4 }]),
            e_estructura_empresa: t("emp", [{ id: 9, codigo: "9", nombre: "Seguridad SA" }]), e_estructura_cliente: t("cli", [{ id: 4, nombre: "Cliente Uno", empresa_id: 9 }]), n_division: t("div", [{ id: 2, nombre: "Seguridad" }]),
            e_estructura_contrato: t("con", [{ id: 31, nro_contrato: "C-31", nombre: "Contrato", cliente_id: 4, empresa_id: 9, division_id: 2 }]), e_estructura_sucursal: t("suc", [{ id: 55, nro_sucursal: "55", nombre: "Sede", contrato_id: 31 }]),
            e_estructura_puesto: t("pue", [{ id: 140, codigo: "P140", nombre: "Portón", sucursal_id: 55 }]),
        };
        const out = await entregaPuestoForm.loadRecords(db, [3, 4], { firmas: false });
        assert.deepEqual(out.map((r) => r.id), [3, 4]);
        assert.deepEqual(out[0]!.estructura, ubic);
        assert.deepEqual(out[0]!.hier, { puesto: 140, corpo: 55, contrato: 31, cliente: 4, empresa: 9, division: 2 });
        for (const name of ["ent", "emp", "cli", "div"]) assert.ok(calls.filter((c) => c.startsWith(`${name}:`)).length <= 2, name);
        assert.equal(calls.filter((c) => c.startsWith("ent:")).length, 1);
        assert.ok(calls.length <= 12); // nunca una consulta por registro
    });
    it("sin registros no consulta nada más", async () => {
        const db: any = { e_registro_entrega_puesto: { findMany: async () => [] } };
        assert.deepEqual(await entregaPuestoForm.loadRecords(db, [1], { firmas: true }), []);
    });
    it("muestra COMPLETA para Guardify: todas las claves con valor", () => {
        const articulos_puesto = JSON.stringify([
            { nombre: "Radio", cantidad_requerida: 2, cantidad_real: 2, estado: "Bueno", observaciones: "Con batería" },
            { nombre: "Linterna", cantidad_requerida: 1, cantidad_real: 0, estado: "No está", observaciones: "Se perdió" },
            { nombre: "Libro de novedades", cantidad_requerida: 1, cantidad_real: 1, estado: "Malo", observaciones: "Hojas sueltas" },
        ]);
        const r = armarRegistro({ ...raw, articulos_puesto, firma_entrega: SAMPLE_PNG, firma_recibe: SAMPLE_PNG }, ubic, true);
        assert.deepEqual(r.firmasPresentes.sort(), ["firma_entrega", "firma_recibe"]);
        writeFormSample("entrega-de-puesto", [r]);
    });
});
