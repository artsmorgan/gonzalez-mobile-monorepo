import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SAMPLE_PNG, writeFormSample } from "../formSamples";
import { agendaMinutaForm, armarRegistro, celdaFirma, horaHHmm, rowHierarchy } from "./agendaMinutaForm";

const FIRMA = "data:image/png;base64,iVBORw0KGgo" + "A".repeat(300);
const raw = {
    id: 71, empresa_id: 1, cliente_id: 2, division_id: 3, contrato_id: 4, corpo_id: 5, puesto_id: 6, numero: 14, titulo: "Reunión mensual de seguridad",
    fecha: new Date("2026-04-20T00:00:00Z"), hora_inicio: new Date("1970-01-01T09:00:00Z"), hora_fin: new Date("1970-01-01T10:30:00Z"), autor: "Marta Quesada",
    participantes: JSON.stringify([{ id_local: "a", nombre: "Luis Mora", puesto: "Oficial", firma: FIRMA }, { id_local: "b", nombre: "Rosa Vega", puesto: "Supervisora", firma: null }]),
    acuerdos: JSON.stringify({ items: [{ id_local: "x", texto: "Revisar rondas", responsable: "Luis Mora", fecha_limite: "2026-05-01" }, { texto: "Entregar informe", responsable: "Rosa Vega", fecha_limite: "2026-05-10" }], meta: { x: 1 } }),
    temas_a_tratar: JSON.stringify(["Rondas nocturnas", "Equipo de comunicación"]),
    observaciones: "No se imprime", firma_responsable: "aGFzaC1kZS1zZXNpb24=", created_at: new Date("2026-04-20T16:00:00Z"), created_by: "9", estado: true, isActive: true,
};
const ubic = { empresa: "CH - Empresa", cliente: "CCSS", division: "Seguridad", contrato: "C1 - Contrato", sucursal: "S1 - Sede", puesto: "P1 - Puesto" };

describe("agenda / minuta como formulario", () => {
    it("lee la hora de una columna Time", () => {
        assert.equal(horaHHmm(new Date("1970-01-01T09:05:00Z")), "09:05");
        assert.equal(horaHHmm("1970-01-01T14:30:00.000Z"), "14:30");
        assert.equal(horaHHmm(null), null);
        assert.equal(horaHHmm("basura"), null);
    });
    it("arma los valores, participantes, temas y acuerdos numerados", () => {
        const r = armarRegistro(raw, ubic, false);
        assert.equal(r.variante, null);
        assert.deepEqual(r.valores, {
            titulo: "Reunión mensual de seguridad", fecha: "2026-04-20", hora_inicio: "09:00", hora_fin: "10:30", autor: "Marta Quesada", numero: 14, temas: "1. Rondas nocturnas\n2. Equipo de comunicación",
        });
        assert.deepEqual(r.listas.participantes, [{ nombre: "Luis Mora", puesto: "Oficial", firma: "Firmada" }, { nombre: "Rosa Vega", puesto: "Supervisora", firma: null }]);
        assert.deepEqual(r.listas.acuerdos, [
            { acuerdo: "1) Revisar rondas", responsable: "Luis Mora", fecha_limite: "2026-05-01" },
            { acuerdo: "2) Entregar informe", responsable: "Rosa Vega", fecha_limite: "2026-05-10" },
        ]);
        assert.deepEqual(r.hier, { empresa: 1, cliente: 2, division: 3, contrato: 4, corpo: 5, puesto: 6 });
    });
    it("acuerdos como lista suelta (registros viejos) y temas como { items }", () => {
        const r = armarRegistro({ ...raw, acuerdos: JSON.stringify([{ texto: "Uno", responsable: "A", fecha_limite: "x" }, { texto: "  " }]), temas_a_tratar: JSON.stringify({ items: ["T1"] }) }, ubic, false);
        assert.equal(r.listas.acuerdos!.length, 1);
        assert.equal(r.valores.temas, "1. T1");
    });
    it("JSON dañado o vacío: listas vacías, sin inventar", () => {
        const r = armarRegistro({ ...raw, participantes: "no es json", acuerdos: "", temas_a_tratar: null, numero: null, hora_fin: null }, ubic, true);
        assert.deepEqual(r.listas, { participantes: [], acuerdos: [] });
        assert.equal(r.valores.temas, null);
        assert.equal(r.valores.numero, null);
        assert.equal(r.valores.hora_fin, null);
    });
    it("celdaFirma: imagen solo con firmas=true; sin pedirla o si no es imagen, «Firmada»; sin firma, null", () => {
        assert.equal(celdaFirma(FIRMA, true), FIRMA);
        assert.equal(celdaFirma(FIRMA, false), "Firmada");
        assert.equal(celdaFirma("iVBORw0KGgo" + "A".repeat(50), true), "data:image/png;base64,iVBORw0KGgo" + "A".repeat(50));
        assert.equal(celdaFirma("/9j/" + "A".repeat(50), true), "data:image/jpeg;base64,/9j/" + "A".repeat(50));
        assert.equal(celdaFirma("c2VzaW9uLWVtcGxlYWRvLWdwcw==", true), "Firmada");
        assert.equal(celdaFirma("", true), null);
        assert.equal(celdaFirma(undefined, true), null);
    });
    it("con firmas=true los participantes traen la imagen; con firmas=false jamás", () => {
        const con = armarRegistro(raw, ubic, true);
        assert.deepEqual(con.listas.participantes, [{ nombre: "Luis Mora", puesto: "Oficial", firma: FIRMA }, { nombre: "Rosa Vega", puesto: "Supervisora", firma: null }]);
        const sin = JSON.stringify(armarRegistro(raw, ubic, false));
        assert.ok(!sin.includes("data:image") && !sin.includes("iVBOR"));
    });
    it("una firma de participante que no es imagen sale «Firmada» aun con firmas=1 y la cadena no aparece", () => {
        const r = armarRegistro({ ...raw, participantes: JSON.stringify([{ nombre: "Luis Mora", puesto: "Oficial", firma: "c2VzaW9uLWVtcGxlYWRvLWdwcw==" }]) }, ubic, true);
        assert.equal(r.listas.participantes![0]!.firma, "Firmada");
        assert.ok(!JSON.stringify(r).includes("c2VzaW9u"));
    });
    it("no salen firmas sueltas, ni la digital del responsable ni las observaciones", () => {
        const r = armarRegistro(raw, ubic, true);
        assert.deepEqual(r.firmas, {});
        assert.deepEqual(r.firmasPresentes, []);
        assert.ok(!JSON.stringify(r).includes("aGFzaC1k"));
        assert.ok(!JSON.stringify(r).includes("No se imprime"), "las observaciones no están en el formato del papel");
    });
    it("registros viejos con ids en 0 usan la ubicación del puesto para el alcance", () => {
        assert.deepEqual(rowHierarchy({ ...raw, empresa_id: 0, division_id: 0, contrato_id: 0 }, { empresa: 9, division: 8, contrato: 7, cliente: 99, corpo: 55, puesto: 6 }),
            { empresa: 9, cliente: 2, division: 8, contrato: 7, corpo: 5, puesto: 6 });
    });
    it("carga en lote: una consulta de minutas y una por nivel de estructura; completa por puesto solo las viejas", async () => {
        const calls: string[] = [];
        const t = (name: string, rows: any[]) => ({ findMany: async (a: any) => { calls.push(`${name}:${JSON.stringify(a.where)}`); return rows; } });
        const db: any = {
            c_agenda_minuta: t("min", [raw, { ...raw, id: 72, empresa_id: 0, division_id: 0, contrato_id: 0 }]),
            e_estructura_puesto: t("pue", [{ id: 6, codigo: "P1", nombre: "Puesto", sucursal_id: 5 }]),
            e_estructura_sucursal: t("suc", [{ id: 5, nro_sucursal: "S1", nombre: "Sede", contrato_id: 4 }]),
            e_estructura_contrato: t("con", [{ id: 4, nro_contrato: "C1", nombre: "Contrato", cliente_id: 2, empresa_id: 1, division_id: 3 }]),
            e_estructura_empresa: t("emp", [{ id: 1, codigo: "CH", nombre: "Empresa" }]), e_estructura_cliente: t("cli", [{ id: 2, nombre: "CCSS" }]), n_division: t("div", [{ id: 3, nombre: "Seguridad" }]),
        };
        const out = await agendaMinutaForm.loadRecords(db, [71, 72], { firmas: false });
        assert.deepEqual(out.map((r) => r.id), [71, 72]);
        assert.equal(out[1]!.estructura.empresa, "CH - Empresa", "la minuta vieja se ubica por su puesto");
        assert.deepEqual(out[1]!.hier, { empresa: 1, cliente: 2, division: 3, contrato: 4, corpo: 5, puesto: 6 });
        assert.ok(calls[0]!.includes('"isActive":true'));
        assert.equal(calls.length, 1 + 3 + 6);
    });
    it("escribe la muestra COMPLETA para Guardify (participantes con firma, temas y acuerdos)", () => {
        const r = armarRegistro({
            ...raw,
            participantes: JSON.stringify([{ nombre: "Luis Mora", puesto: "Oficial", firma: SAMPLE_PNG }, { nombre: "Rosa Vega", puesto: "Supervisora", firma: SAMPLE_PNG }]),
        }, ubic, true);
        writeFormSample("agenda-minuta", [r]);
        assert.ok(r.listas.participantes!.every((p) => p.firma === SAMPLE_PNG));
    });
});
