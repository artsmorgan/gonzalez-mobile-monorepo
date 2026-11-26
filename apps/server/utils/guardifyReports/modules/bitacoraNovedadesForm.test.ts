import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { writeFormSample, SAMPLE_PNG } from "../formSamples";
import { armarRegistro, bitacoraNovedadesForm, firmaImagen } from "./bitacoraNovedadesForm";

const FIRMA = "data:image/png;base64," + "A".repeat(300);
const raw = {
    id: 12, titulo: "Portón dañado", description: "El portón de la entrada principal no cierra bien.\nSe avisó al cliente.", categoria_id: 3, puesto_id: 140,
    created_at: new Date("2026-09-22T06:10:30Z"), updated_at: new Date("2026-09-23T14:05:00Z"), relevancia: "Alta", is_modified: true, isActive: true,
    firma_manual_responsable: FIRMA, firma_responsable: "TOKEN-QR-GPS-999",
    empresa_id: 9, cliente_id: 0, division_id: 0, contrato_id: 0, corpo_id: 0,
};
const ubic = { empresa: "9 - Seguridad SA", cliente: "Cliente Uno", division: "Seguridad", contrato: "C-31 - Contrato", sucursal: "55 - Sede", puesto: "P140 - Portón" };

describe("bitácora de novedades como formulario", () => {
    it("acepta firma como data URL o base64 largo, no otra cosa", () => {
        assert.equal(firmaImagen(FIRMA), FIRMA);
        assert.equal(firmaImagen("A".repeat(150)), "data:image/png;base64," + "A".repeat(150));
        assert.equal(firmaImagen("note_firma_manual_1.png"), null);
        assert.equal(firmaImagen(null), null);
    });
    it("arma la nota: fechas YYYY-MM-DD, horas HH:mm, categoría y usuarios", () => {
        const r = armarRegistro(raw, ubic, false, { categoria: "Infraestructura", registrada_por: "Ana Soto", modificada_por: "Luis Mora" });
        assert.equal(r.variante, null);
        assert.equal(r.creado, "2026-09-22T06:10:30");
        assert.deepEqual([r.valores.titulo, r.valores.categoria, r.valores.relevancia], ["Portón dañado", "Infraestructura", "Alta"]);
        assert.match(String(r.valores.descripcion), /^El portón/);
        assert.deepEqual([r.valores.fecha_creacion, r.valores.hora_creacion, r.valores.fecha_actualizacion, r.valores.hora_actualizacion], ["2026-09-22", "06:10", "2026-09-23", "14:05"]);
        assert.deepEqual([r.valores.registrada_por, r.valores.modificada_por], ["Ana Soto", "Luis Mora"]);
        assert.deepEqual(r.listas, {});
    });
    it("firma manual solo con firmas=1; dice si la tiene; nunca la cadena del responsable", () => {
        const sin = armarRegistro(raw, ubic, false);
        assert.deepEqual(sin.firmas, { firma_manual: null });
        assert.deepEqual(sin.firmasPresentes, ["firma_manual"]);
        assert.equal(armarRegistro(raw, ubic, true).firmas.firma_manual, FIRMA);
        assert.ok(!JSON.stringify(sin).includes("TOKEN-QR"));
        const sinFirma = armarRegistro({ ...raw, firma_manual_responsable: null }, ubic, true);
        assert.deepEqual([sinFirma.firmas, sinFirma.firmasPresentes], [{}, []]);
    });
    it("carga en lote: una consulta por tabla; la ubicación en 0 sale del puesto; primer y último cambio", async () => {
        const calls: string[] = [];
        const t = (name: string, rows: any[]) => ({ findMany: async (a: any) => { calls.push(`${name}:${JSON.stringify(a.where)}`); const ids: number[] | undefined = a.where?.id?.in; return ids ? rows.filter((x) => ids.includes(x.id)) : rows; } });
        const db: any = {
            c_puesto_notas: t("not", [raw, { ...raw, id: 13 }]),
            n_novedades_categoria: t("cat", [{ id: 3, nombre: "Infraestructura" }]),
            c_cambios_apps_modules: t("cam", [{ id: 1, registro_id: 12, created_by: 7 }, { id: 2, registro_id: 12, created_by: 8 }, { id: 3, registro_id: 13, created_by: 8 }]),
            c_empleado: t("emp2", [{ id: 7, nombre: "Ana", primer_apellido: "Soto" }, { id: 8, nombre: "Luis", primer_apellido: "Mora" }]),
            e_estructura_empresa: t("emp", [{ id: 9, codigo: "9", nombre: "Seguridad SA" }]), e_estructura_cliente: t("cli", [{ id: 4, nombre: "Cliente Uno" }]), n_division: t("div", [{ id: 2, nombre: "Seguridad" }]),
            e_estructura_contrato: t("con", [{ id: 31, nro_contrato: "C-31", nombre: "Contrato", cliente_id: 4, empresa_id: 9, division_id: 2 }]), e_estructura_sucursal: t("suc", [{ id: 55, nro_sucursal: "55", nombre: "Sede", contrato_id: 31 }]),
            e_estructura_puesto: t("pue", [{ id: 140, codigo: "P140", nombre: "Portón", sucursal_id: 55 }]),
        };
        const out = await bitacoraNovedadesForm.loadRecords(db, [12, 13], { firmas: false });
        assert.deepEqual(out.map((r) => r.id), [12, 13]);
        assert.deepEqual(out[0]!.estructura, ubic);
        assert.deepEqual(out[0]!.hier, { empresa: 9, cliente: 4, division: 2, contrato: 31, corpo: 55, puesto: 140 });
        assert.deepEqual([out[0]!.valores.categoria, out[0]!.valores.registrada_por, out[0]!.valores.modificada_por], ["Infraestructura", "Ana Soto", "Luis Mora"]);
        assert.deepEqual([out[1]!.valores.registrada_por, out[1]!.valores.modificada_por], ["Luis Mora", "Luis Mora"]);
        assert.ok(calls[0]!.includes('"isActive":true'));
        for (const name of ["not", "cat", "cam", "emp2"]) assert.equal(calls.filter((c) => c.startsWith(`${name}:`)).length, 1, name);
        assert.ok(calls.length <= 14); // nunca una consulta por registro
    });
    it("sin registros no consulta nada más", async () => {
        const db: any = { c_puesto_notas: { findMany: async () => [] } };
        assert.deepEqual(await bitacoraNovedadesForm.loadRecords(db, [1], { firmas: true }), []);
    });
    it("muestra COMPLETA para Guardify: todas las claves con valor", () => {
        const r = armarRegistro({ ...raw, firma_manual_responsable: SAMPLE_PNG }, ubic, true, { categoria: "Infraestructura", registrada_por: "Ana Soto", modificada_por: "Luis Mora" });
        assert.deepEqual(r.firmasPresentes, ["firma_manual"]);
        writeFormSample("bitacora-de-novedades", [r]);
    });
});
