import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SAMPLE_PNG, writeFormSample } from "../formSamples";
import { actaEntregaProductosForm, armarRegistro, imagenDeFirma, parseDetalle } from "./actaEntregaProductosForm";

const ubic = { empresa: "CH - Empresa", cliente: "CCSS", division: "Seguridad", contrato: "C1 - Contrato", sucursal: "S1 - Sede", puesto: "P1 - Puesto" };
const detalle = [
    { descripcion: "Cloro", unidad_medida: "Galón", cantidad: "4", devolucion: "0", faltantes: "1" },
    { descripcion: "Jabón líquido", unidad_medida: "Litro", cantidad: "6", devolucion: "1", faltantes: "0" },
];
const acta = (extra: Record<string, unknown> = {}) => ({
    id: 3, fecha: new Date("2026-06-10T09:00:00Z"), tipo_entrega: "Ordinaria", mensual: "Junio", detalle: JSON.stringify(detalle), observaciones: "Falta una unidad de cloro",
    nombre_entrega: "Ana Mora", cedula_entrega: "1-1111-1111", firma_entrega: SAMPLE_PNG, nombre_recibe: "Luis Vega", cedula_recibe: "2-2222-2222", firma_recibe: "B".repeat(300),
    empresa_id: 1, cliente_id: 2, division_id: 3, contrato_id: 4, corpo_id: 5, puesto_id: 6, ...extra,
});

describe("acta de entrega de productos como formulario", () => {
    it("lee el detalle de un JSON, de un arreglo o lo deja vacío si no sirve", () => {
        assert.deepEqual(parseDetalle(JSON.stringify(detalle)), detalle);
        assert.deepEqual(parseDetalle(detalle), detalle);
        assert.deepEqual(parseDetalle("no es json"), []);
        assert.deepEqual(parseDetalle(""), []);
        assert.deepEqual(parseDetalle('{"a":1}'), []);
    });
    it("solo una imagen cuenta como firma", () => {
        assert.equal(imagenDeFirma(SAMPLE_PNG), SAMPLE_PNG);
        assert.equal(imagenDeFirma("B".repeat(300)), `data:image/png;base64,${"B".repeat(300)}`);
        assert.equal(imagenDeFirma("pendiente"), null);
        assert.equal(imagenDeFirma(null), null);
    });
    it("arma el acta con productos, fecha ISO y firmas ocultas por defecto", () => {
        const r = armarRegistro(acta(), ubic, false);
        assert.deepEqual([r.variante, r.valores.fecha, r.valores.tipo_entrega, r.valores.mensual], [null, "2026-06-10", "Ordinaria", "Junio"]);
        assert.deepEqual(r.listas.productos[0], { descripcion: "Cloro", unidad_medida: "Galón", cantidad: "4", devolucion: "0", faltantes: "1" });
        assert.equal(r.listas.productos.length, 2);
        assert.deepEqual(r.firmas, { firma_entrega: null, firma_recibe: null });
        assert.deepEqual(r.firmasPresentes, ["firma_entrega", "firma_recibe"]);
        assert.deepEqual(r.hier, { empresa: 1, cliente: 2, division: 3, contrato: 4, corpo: 5, puesto: 6 });
    });
    it("con firmas=1 entrega las imágenes; una firma ausente no se informa", () => {
        const r = armarRegistro(acta({ firma_recibe: null }), ubic, true);
        assert.equal(r.firmas.firma_entrega, SAMPLE_PNG);
        assert.deepEqual(r.firmasPresentes, ["firma_entrega"]);
        assert.equal("firma_recibe" in r.firmas, false);
    });
    it("no entrega firma_responsable ni imágenes adjuntas", () => {
        const r = armarRegistro(acta({ firma_responsable: "c2Vzc2lvbg==", imagenes: [{ name: "foto.jpg" }] }), ubic, true);
        const s = JSON.stringify(r);
        assert.ok(!s.includes("c2Vzc2lvbg") && !s.includes("foto.jpg"));
    });
    it("carga en lote: actas activas en una consulta y una por nivel de estructura, sin firma_responsable", async () => {
        const calls: { name: string; args: any }[] = [];
        const t = (name: string, rows: any[]) => ({ findMany: async (a: any) => { calls.push({ name, args: a }); return rows; } });
        const db: any = {
            c_acta_entre_producto: t("acta", [acta(), acta({ id: 4 })]),
            e_estructura_empresa: t("e", [{ id: 1, codigo: "CH", nombre: "Empresa" }]), e_estructura_cliente: t("cli", [{ id: 2, nombre: "CCSS" }]), n_division: t("div", [{ id: 3, nombre: "Seguridad" }]),
            e_estructura_contrato: t("con", [{ id: 4, nro_contrato: "C1", nombre: "Contrato" }]), e_estructura_sucursal: t("suc", [{ id: 5, nro_sucursal: "S1", nombre: "Sede" }]), e_estructura_puesto: t("pue", [{ id: 6, codigo: "P1", nombre: "Puesto" }]),
        };
        const out = await actaEntregaProductosForm.loadRecords(db, [3, 4], { firmas: false });
        assert.deepEqual(out.map((r) => r.id), [3, 4]);
        assert.equal(out[0]!.estructura.cliente, "CCSS");
        assert.equal(calls.length, 7);
        assert.equal(calls[0]!.args.where.isActive, true);
        assert.ok(!("firma_responsable" in calls[0]!.args.select));
    });
    it("muestra completa para Guardify", () => {
        const { hier: _h, ...rec } = armarRegistro(acta({ firma_recibe: SAMPLE_PNG }), ubic, true);
        writeFormSample("acta-de-entrega-de-productos", [rec]);
    });
});
