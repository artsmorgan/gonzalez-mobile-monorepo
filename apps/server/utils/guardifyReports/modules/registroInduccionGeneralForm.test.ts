import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TEMAS_DIV_AYL, TEMAS_DIV_SEG, flattenTemasForDocx } from "../../reports-functions/registroInduccionGeneralTemas";
import { writeFormSample, SAMPLE_PNG } from "../formSamples";
import { MARCA, armarRegistro, registroInduccionGeneralForm, varianteDe } from "./registroInduccionGeneralForm";

const DIGITAL = Buffer.from("sesion-1:20:9.93:-84.08:1788000000000").toString("base64");
const ubic = { empresa: "CH - Empresa", cliente: "Municipalidad", division: "Aseo", contrato: "C1 - Contrato", sucursal: "S1 - Sede", puesto: null };
const colaboradores = [
    { id: 1, registro_id: 3, nombre: "Ana Mora", cedula: "1-0111-0222", puesto_text: "P1 - Misceláneo", puesto_id: 11, firma: SAMPLE_PNG },
    { id: 2, registro_id: 3, nombre: "Luis Vega", cedula: "2-0333-0444", puesto_text: "P1 - Misceláneo", puesto_id: 11, firma: "" },
    { id: 3, registro_id: 3, nombre: "Eva Soto", cedula: "3-0555-0666", puesto_text: "P2 - Jardinero", puesto_id: 12, firma: SAMPLE_PNG },
];
const capacitadores = [{ id: 1, registro_id: 3, nombre: "Marta Rojas", cedula: "1-9999-8888", firma: SAMPLE_PNG }];
const raw = (extra: any = {}) => ({
    id: 3, empresa_id: 9, cliente_id: 2, corpo_id: 5, division: "Aseo y limpieza", division_id: 5, contrato_id: 4, puesto_id: 0,
    fecha: new Date("2026-05-10T00:00:00Z"), created_at: new Date("2026-05-10T14:30:00Z"), created_by: "20", firma_responsable: DIGITAL,
    temas_a_tratar: JSON.stringify({ leafs: [{ id: "1", checked: true }, { id: "3.2", checked: true }, { id: "3.3", checked: false }] }),
    colaboradores, capacitadores, ...extra,
});

describe("registro de inducción general como formulario", () => {
    it("elige el formato por la división, igual que el .docx de la app", () => {
        assert.equal(varianteDe(4, "x"), "Seguridad");
        assert.equal(varianteDe(5, "Seguridad"), "Aseo y limpieza");
        assert.equal(varianteDe(0, "Seguridad privada"), "Seguridad");
        assert.equal(varianteDe(0, ""), "Aseo y limpieza");
    });
    it("entrega todos los temas del catálogo, marcados o no, y las personas con la marca de firma", () => {
        const r = armarRegistro(raw(), ubic, false);
        assert.equal(r.variante, "Aseo y limpieza");
        assert.equal(r.listas.temas.length, flattenTemasForDocx(TEMAS_DIV_AYL).filter((t) => t.kind === "leaf").length);
        const por = Object.fromEntries(r.listas.temas.map((t) => [t.clave, t.valor]));
        assert.equal(por["tema_1"], MARCA);
        assert.equal(por["tema_3.2"], MARCA);
        assert.equal(por["tema_3.3"], "No");
        assert.equal(r.listas.temas[0]!.item, "1 Presentación del Asistente de Operaciones de Aseo y Limpieza");
        assert.deepEqual(r.listas.colaboradores[1], { nombre: "Luis Vega", firma: null, cedula: "2-0333-0444" });
        assert.deepEqual(r.listas.capacitadores[0], { nombre: "Marta Rojas", cedula: "1-9999-8888", firma: "Firmada" });
        assert.equal(r.valores.puesto_colaboradores, "P1 - Misceláneo, P2 - Jardinero");
        assert.equal(r.valores.fecha, "2026-05-10");
        assert.equal(r.creado, "2026-05-10T14:30:00");
        assert.deepEqual(r.firmasPresentes, ["firma_responsable"]);
        assert.deepEqual(r.hier, { empresa: 9, cliente: 2, division: 5, contrato: 4, corpo: 5, puesto: 0 });
    });
    it("el catálogo de seguridad tiene otros temas e ítems anidados", () => {
        const r = armarRegistro(raw({ division_id: 4, division: "Seguridad", temas_a_tratar: JSON.stringify({ leafs: [{ id: "8.1.i", checked: true }] }) }), ubic, false);
        assert.equal(r.variante, "Seguridad");
        assert.equal(r.listas.temas.length, flattenTemasForDocx(TEMAS_DIV_SEG).filter((t) => t.kind === "leaf").length);
        assert.equal(r.listas.temas.find((t) => t.clave === "tema_8.1.i")!.valor, MARCA);
    });
    it("la firma digital del responsable no es imagen; no se entregan firmas de las personas ni la firma en bruto", () => {
        const s = JSON.stringify(armarRegistro(raw(), ubic, true));
        assert.ok(!s.includes("data:image") && !s.includes(DIGITAL));
        assert.deepEqual(armarRegistro(raw({ firma_responsable: SAMPLE_PNG }), ubic, true).firmas, { firma_responsable: SAMPLE_PNG });
        assert.deepEqual(armarRegistro(raw({ firma_responsable: SAMPLE_PNG }), ubic, false).firmas, { firma_responsable: null });
        assert.deepEqual(armarRegistro(raw({ firma_responsable: "" }), ubic, true).firmasPresentes, []);
    });
    it("carga en lote: registros, colaboradores y capacitadores y una consulta por nivel de estructura", async () => {
        const calls: string[] = [];
        const t = (name: string, rows: any[]) => ({ findMany: async (a: any) => { calls.push(`${name}:${JSON.stringify(a.where)}`); return rows; } });
        const { colaboradores: _c, capacitadores: _k, ...fila } = raw();
        const db: any = {
            c_registro_induccion_general: t("reg", [fila, { ...fila, id: 4, division_id: 4, division: "Seguridad" }]),
            c_colaboradores_induccion_general: t("col", colaboradores), c_capacitadores_induccion_general: t("cap", capacitadores),
            e_estructura_empresa: t("emp", [{ id: 9, codigo: "CH", nombre: "Empresa" }]), e_estructura_cliente: t("cli", [{ id: 2, nombre: "Municipalidad" }]), n_division: t("div", []),
            e_estructura_contrato: t("con", [{ id: 4, nro_contrato: "C1", nombre: "Contrato" }]), e_estructura_sucursal: t("suc", [{ id: 5, nro_sucursal: "S1", nombre: "Sede" }]), e_estructura_puesto: t("pue", []),
        };
        const out = await registroInduccionGeneralForm.loadRecords(db, [4, 3], { firmas: false });
        assert.deepEqual(out.map((r) => [r.id, r.variante]), [[4, "Seguridad"], [3, "Aseo y limpieza"]]);
        assert.equal(calls.length, 8); // registros, colaboradores, capacitadores y cinco niveles (estos registros no traen puesto)
        assert.ok(calls[0]!.includes('"isActive":true'));
        assert.equal(out[1]!.listas.colaboradores.length, 3); // los de otros registros no se mezclan
        assert.equal(out[0]!.listas.colaboradores.length, 0);
        assert.equal(out[1]!.estructura.sucursal, "S1 - Sede");
    });
    it("muestras completas para Guardify: una por formato, todos los temas marcados", () => {
        const todos = (nodes: any) => JSON.stringify({ leafs: flattenTemasForDocx(nodes).filter((t) => t.kind === "leaf").map((t) => ({ id: t.id, checked: true })) });
        const personas = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i + 1, registro_id: 3, nombre: `Colaborador ${i + 1} Mora`, cedula: `1-0${i}11-0222`, puesto_text: "P1 - Misceláneo", puesto_id: 11, firma: SAMPLE_PNG }));
        const aseo = armarRegistro(raw({ temas_a_tratar: todos(TEMAS_DIV_AYL), colaboradores: personas(6) }), ubic, true);
        const seg = armarRegistro(raw({ id: 4, division_id: 4, division: "Seguridad", temas_a_tratar: todos(TEMAS_DIV_SEG), colaboradores: personas(6) }), { ...ubic, division: "Seguridad" }, true);
        writeFormSample("registro-de-induccion-general", [aseo, seg]);
        assert.ok(aseo.listas.temas.every((t) => t.valor === MARCA) && seg.listas.temas.every((t) => t.valor === MARCA));
    });
});
