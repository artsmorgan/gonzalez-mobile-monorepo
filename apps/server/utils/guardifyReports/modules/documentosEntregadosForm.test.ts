import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { writeFormSample, SAMPLE_PNG } from "../formSamples";
import { armarRegistro, documentosEntregadosForm } from "./documentosEntregadosForm";

const DIGITAL = Buffer.from("sesion-1:20:9.93:-84.08:1788000000000").toString("base64");
const ubic = { empresa: "CH - Empresa", cliente: "Banco Central", division: "Seguridad", contrato: "C1 - Contrato", sucursal: "S1 - Sede", puesto: "P1 - Recepción" };
const raw = (extra: any = {}) => ({
    id: 31, empresa_id: 9, cliente_id: 2, division_id: 3, contrato_id: 4, corpo_id: 5, puesto_id: 6, fecha: new Date("2026-07-15T00:00:00Z"),
    nombre_oficial_entrega: "Carlos Mora", nombre_oficial_recibe: "Sandra Quirós", tipo_documento: "Informe mensual", descripcion: "Informe de junio, folio 1482.",
    firma_representante_cliente: SAMPLE_PNG, firma_responsable: DIGITAL, isActive: true, ...extra,
});

describe("documentos entregados como formulario", () => {
    it("arma el documento como el primer renglón de la tabla del papel", () => {
        const r = armarRegistro(raw(), ubic, false);
        assert.equal(r.variante, null);
        assert.equal(r.creado, "2026-07-15T00:00:00");
        assert.deepEqual(r.listas.documentos, [{ numero: "1", fecha: "2026-07-15", tipo_documento: "Informe mensual", descripcion: "Informe de junio, folio 1482.", oficial_entrega: "Carlos Mora", oficial_recibe: "Sandra Quirós" }]);
        assert.equal(r.valores.oficial_recibe, "Sandra Quirós");
        assert.deepEqual(r.hier, { empresa: 9, cliente: 2, division: 3, contrato: 4, corpo: 5, puesto: 6 });
    });
    it("la firma del representante (imagen) solo sale con firmas=1; la del oficial es digital y no es imagen", () => {
        const sin = armarRegistro(raw(), ubic, false);
        assert.deepEqual(sin.firmasPresentes, ["firma_representante_cliente", "firma_responsable"]);
        assert.deepEqual(sin.firmas, { firma_representante_cliente: null, firma_responsable: null });
        const con = armarRegistro(raw(), ubic, true);
        assert.equal(con.firmas.firma_representante_cliente, SAMPLE_PNG);
        assert.equal(con.firmas.firma_responsable, null);
        assert.ok(!JSON.stringify(con).includes(DIGITAL));
        assert.deepEqual(armarRegistro(raw({ firma_representante_cliente: null }), ubic, true).firmasPresentes, ["firma_responsable"]);
    });
    it("un documento sin fecha ni textos queda con celdas vacías, no con valores inventados", () => {
        const r = armarRegistro(raw({ fecha: null, tipo_documento: "", descripcion: null }), ubic, false);
        assert.equal(r.creado, null);
        assert.deepEqual(r.listas.documentos[0], { numero: "1", fecha: null, tipo_documento: null, descripcion: null, oficial_entrega: "Carlos Mora", oficial_recibe: "Sandra Quirós" });
    });
    it("carga en lote: una consulta de registros y una por nivel de estructura, solo activos y en el orden pedido", async () => {
        const calls: string[] = [];
        const t = (name: string, rows: any[]) => ({ findMany: async (a: any) => { calls.push(`${name}:${JSON.stringify(a.where)}`); return rows; } });
        const db: any = {
            e_control_documento_entregado_cliente: t("doc", [raw(), raw({ id: 32 })]),
            e_estructura_empresa: t("emp", [{ id: 9, codigo: "CH", nombre: "Empresa" }]), e_estructura_cliente: t("cli", [{ id: 2, nombre: "Banco Central" }]), n_division: t("div", [{ id: 3, nombre: "Seguridad" }]),
            e_estructura_contrato: t("con", [{ id: 4, nro_contrato: "C1", nombre: "Contrato" }]), e_estructura_sucursal: t("suc", [{ id: 5, nro_sucursal: "S1", nombre: "Sede" }]), e_estructura_puesto: t("pue", [{ id: 6, codigo: "P1", nombre: "Recepción" }]),
        };
        const out = await documentosEntregadosForm.loadRecords(db, [32, 31], { firmas: false });
        assert.deepEqual(out.map((r) => r.id), [32, 31]);
        assert.equal(calls.length, 7);
        assert.ok(calls[0]!.includes('"isActive":true'));
        assert.equal(out[0]!.estructura.cliente, "Banco Central");
        assert.equal(out[0]!.estructura.sucursal, "S1 - Sede");
    });
    it("muestra completa para Guardify", () => {
        const r = armarRegistro(raw(), ubic, true);
        writeFormSample("documentos-entregados", [r]);
        assert.equal(r.listas.documentos.length, 1);
    });
});
