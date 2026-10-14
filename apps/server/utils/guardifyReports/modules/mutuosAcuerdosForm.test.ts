import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SAMPLE_PNG, writeFormSample } from "../formSamples";
import { armarRegistro, mutuosAcuerdosForm, NOTA } from "./mutuosAcuerdosForm";

const DIGITAL = Buffer.from("sess-1:3:9.93:-84.08:1776000000000").toString("base64");
const raw = {
    id: 61, created_at: new Date("2026-04-20T09:30:00Z"), empresa_id: 9, cliente_id: 4, division_id: 2, contrato_id: 31, corpo_id: 55, puesto_id: 140,
    ejecutivo_cuenta: 3, motivo: "Cita médica del oficial.", empleadoAusente_id: 7, empleadoReemplaza_id: 8, marcaDiaAusente_id: 101, marcaDiaReemplaza_id: 102,
    firma_ausente_manual: SAMPLE_PNG, firma_reemplaza_manual: SAMPLE_PNG.replace("data:image/png;base64,", ""), firma_ejecutivo_cuenta_manual: SAMPLE_PNG,
    firma_ejecutivo_cuenta_digital: DIGITAL, firma_responsable: DIGITAL, file_name: "adjunto_secreto.pdf", estado: "aprobado", ausente_acepta: true, reemplaza_acepta: true,
};
const ubic = { empresa: "9 - Seguridad SA", cliente: "Cliente Uno", division: "Seguridad", contrato: "C-31 - Contrato", sucursal: "55 - Sede", puesto: "P140 - Portón" };
const empleados = new Map<number, any>([[7, { codigo: "E7", nombre: "Pedro", primer_apellido: "Rojas", segundo_apellido: "Mora" }], [8, { codigo: "E8", nombre: "Ana", primer_apellido: "Soto" }]]);
const marcas = new Map<number, any>([[101, { fecha: new Date("2026-04-25T00:00:00Z"), tipo_turno: "d" }], [102, { fecha: new Date("2026-04-26T00:00:00Z"), tipo_turno: "N" }]]);

describe("mutuos acuerdos como formulario", () => {
    it("cruza los roles como el generador: lo normal del interesado es lo cambio del que colabora", () => {
        const r = armarRegistro(raw, ubic, false, { empleados, marcas, ejecutivo: "Eva Ruiz" });
        assert.equal(r.variante, null);
        assert.equal(r.valores.ejecutivo_cuenta, "Eva Ruiz");
        assert.equal(r.valores.fecha, "2026-04-20");
        assert.equal(r.valores.interesado_codigo, "E7");
        assert.equal(r.valores.interesado_nombre, "E7 — Pedro Rojas Mora");
        assert.equal(r.valores.interesado_rol_normal, "2026-04-25 / D");
        assert.equal(r.valores.interesado_rol_cambio, "2026-04-26 / N");
        assert.equal(r.valores.colabora_rol_normal, "2026-04-26 / N");
        assert.equal(r.valores.colabora_rol_cambio, "2026-04-25 / D");
        assert.equal(r.valores.motivo, "Cita médica del oficial.");
        assert.equal(r.valores.nota, NOTA);
    });
    it("varias marcas por lado (lista JSON) y respaldo a la fecha suelta cuando no hay marcas", () => {
        const varias = armarRegistro({ ...raw, marcas_ausente: "[101,102]" }, ubic, false, { empleados, marcas });
        assert.equal(varias.valores.interesado_rol_normal, "2026-04-25 / D; 2026-04-26 / N");
        const sinMarcas = armarRegistro({ ...raw, marcaDiaAusente_id: 0, marcaDiaReemplaza_id: null, fecha_ausente: "2026-05-01", fecha_reemplaza: new Date("2026-05-02T00:00:00Z") }, ubic, false, { empleados, marcas });
        assert.equal(sinMarcas.valores.interesado_rol_normal, "2026-05-01");
        assert.equal(sinMarcas.valores.interesado_rol_cambio, "2026-05-02");
        const nada = armarRegistro({ ...raw, marcaDiaAusente_id: 0, marcaDiaReemplaza_id: 0 }, ubic, false, { empleados, marcas });
        assert.equal(nada.valores.interesado_rol_normal, null);
    });
    it("firmas: tres imágenes solo con firmas=1; la digital del ejecutivo solo se informa; nada de adjuntos ni de sesión", () => {
        const sin = armarRegistro(raw, ubic, false, { empleados, marcas });
        assert.deepEqual(sin.firmas, { firma_ausente_manual: null, firma_reemplaza_manual: null, firma_ejecutivo_cuenta_manual: null, firma_ejecutivo_cuenta_digital: null });
        assert.deepEqual(sin.firmasPresentes, ["firma_ausente_manual", "firma_reemplaza_manual", "firma_ejecutivo_cuenta_manual", "firma_ejecutivo_cuenta_digital"]);
        const con = armarRegistro(raw, ubic, true, { empleados, marcas });
        assert.equal(con.firmas.firma_ausente_manual, SAMPLE_PNG);
        assert.equal(con.firmas.firma_reemplaza_manual, SAMPLE_PNG); // el base64 puro se entrega como data URL
        assert.equal(con.firmas.firma_ejecutivo_cuenta_digital, null);
        const todo = JSON.stringify(con);
        for (const prohibido of ["adjunto_secreto", "sess-1", "-84.08", DIGITAL]) assert.ok(!todo.includes(prohibido), prohibido);
        assert.deepEqual(con.hier, { empresa: 9, cliente: 4, division: 2, contrato: 31, corpo: 55, puesto: 140 });
    });
    it("sin firmas: nada presente", () => {
        const r = armarRegistro({ ...raw, firma_ausente_manual: null, firma_reemplaza_manual: "", firma_ejecutivo_cuenta_manual: null, firma_ejecutivo_cuenta_digital: "" }, ubic, true, { empleados, marcas });
        assert.deepEqual(r.firmas, {});
        assert.deepEqual(r.firmasPresentes, []);
    });
    it("carga en lote: una consulta de mutuos, una por nivel, empleados, ejecutivos y marcas", async () => {
        const calls: string[] = [];
        const t = (name: string, rows: any[]) => ({ findMany: async (a: any) => { calls.push(`${name}:${JSON.stringify(a.where)}`); return rows; } });
        const db: any = {
            e_mutuos_acuerdos: t("mut", [raw, { ...raw, id: 62 }]),
            e_estructura_empresa: t("emp", [{ id: 9, codigo: "9", nombre: "Seguridad SA" }]), e_estructura_cliente: t("cli", [{ id: 4, nombre: "Cliente Uno" }]), n_division: t("div", [{ id: 2, nombre: "Seguridad" }]),
            e_estructura_contrato: t("con", [{ id: 31, nro_contrato: "C-31", nombre: "Contrato" }]), e_estructura_sucursal: t("suc", [{ id: 55, nro_sucursal: "55", nombre: "Sede" }]), e_estructura_puesto: t("pue", [{ id: 140, codigo: "P140", nombre: "Portón" }]),
            c_empleado: t("empl", [...empleados].map(([id, e]) => ({ id, ...e }))), n_ejecutivo_cuenta: t("eje", [{ id: 3, nombre: "Eva Ruiz" }]), c_marca_dia: t("marca", [...marcas].map(([id, m]) => ({ id, ...m }))),
        };
        const out = await mutuosAcuerdosForm.loadRecords(db, [61, 62], { firmas: false });
        assert.deepEqual(out.map((r) => r.id), [61, 62]);
        assert.equal(out[0]!.valores.ejecutivo_cuenta, "Eva Ruiz");
        assert.equal(out[1]!.valores.colabora_nombre, "E8 — Ana Soto");
        assert.equal(out[0]!.valores.interesado_rol_normal, "2026-04-25 / D");
        assert.equal(calls.length, 10);
        assert.ok(calls[0]!.includes('"isActive":true'));
    });
    it("muestra completa para Guardify", () => {
        // Completa: los dos oficiales, los roles cruzados, las tres firmas dibujadas (con imagen) y la firma digital del ejecutivo.
        writeFormSample("mutuos-acuerdos", [armarRegistro(raw, ubic, true, { empleados, marcas, ejecutivo: "Eva Ruiz" })]);
    });
});
