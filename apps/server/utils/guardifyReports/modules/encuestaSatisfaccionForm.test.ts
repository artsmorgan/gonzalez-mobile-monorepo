import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SAMPLE_PNG, writeFormSample } from "../formSamples";
import { armarRegistro, COMPROMISO, encuestaSatisfaccionForm, leerEvaluaciones, varianteDe } from "./encuestaSatisfaccionForm";

const q = (question: string, value: number, apply = true) => ({ question, value, apply });
/** Plantilla de la pantalla (SatisfactionSurveysScreen): las 5 secciones; la 3 cambia entre Seguridad y Aseo. */
const form = (aseo: boolean) => ({
    form: [
        { section_title: "Califique la calidad del servicio en cuanto a los siguientes aspectos", observations: "Faltó uniforme algunos días.", questions: ["¿Cómo es el trato del personal al público?", "¿El personal es respetuoso con los funcionarios?", "Domina el personal los lineamientos del puesto de trabajo", "¿El personal siempre lleva su uniforme completo y bien presentado?", "¿El equipo de trabajo diario se encuentra en optimas condiciones?", "¿El personal utiliza un vocabulario respetuoso durante su jornada laboral?"].map((t, i) => q(t, 1 + (i % 5))) },
        { section_title: "¿Cómo califica el servicio recibido por el personal (Marque solo para aquellos con los que tiene contacto)", observations: "Sin comentarios.", questions: [q("Gerencia de Operaciones", 5), q("Asistentes de Operaciones", 4), q("Supervisores", 3, false), q("Misceláneos", 2)] },
        aseo
            ? { section_title: "¿Cómo califica la calidad del servicio de Aseo y Limpieza en cuanto a nuestro trabajo?", observations: "Entregas tardías.", questions: ["¿Cumple el servicio lo estipulado en el contrato?", "¿Los productos de limpieza utilizados en el servicio son de la calidad esperada?", "¿El plazo de entregas de productos de limpieza cumple con sus necesidades?", "¿Son atendidas sus quejas en el plazo acordado con la empresa?", "¿Considera que la empresa ha mejorado el servicio con respecto al año anterior?"].map((t) => q(t, 4)) }
            : { section_title: "¿Cómo califica la calidad del servicio de Seguridad en cuanto a nuestro trabajo?", observations: "Sin comentarios.", questions: ["¿Cumple el servicio lo estipulado en el contrato?", "¿Son atendidas sus quejas en el plazo acordado con la empresa?", "¿Considera que la empresa ha mejorado el servicio con respecto al año anterior?"].map((t) => q(t, 5)) },
        { section_title: "¿Cómo califica la comunicación con la empresa?", observations: "Buena comunicación.", questions: [q("¿Cómo califica la comunicación entre la compañía y usted como cliente?", 4), q("¿Esa comunicación está generando los resultados esperados?", 3)] },
        { section_title: "APRECIACIONES GLOBALES", observations: "Satisfecho en general.", questions: [q("¿Cuál es su nivel de satisfacción global respecto al servicio que le brindamos?", 4)] },
    ],
    know_process: true,
});
const raw = (aseo: boolean, o: Record<string, unknown> = {}) => ({
    id: 41, created_at: new Date("2026-04-20T09:30:00Z"), fecha: new Date("2026-04-19T00:00:00Z"), empresa_id: 9, cliente_id: 4, division_id: 2, contrato_id: 31, corpo_id: 55, puesto_id: 140, responsable_id: 7,
    evaluaciones: JSON.stringify(form(aseo)), nombre_evaluado: "María Quesada", cedula_evaluado: "1-2345-6789", email_evaluado: "m@x.cr", telefono_evaluado: "88888888", empresa_evaluado: "Ministerio Uno",
    observaciones: "Reforzar la presencia en la mañana.", firma_evaluado: SAMPLE_PNG, firma_responsable: Buffer.from("sess:7:9.9:-84.0:1776000000000").toString("base64"), ...o,
});
const ubic = (division: string | null) => ({ empresa: "9 - Seguridad SA", cliente: "Cliente Uno", division, contrato: "C-31 - Contrato", sucursal: "55 - Sede", puesto: "P140 - Portón" });

describe("encuesta de satisfacción como formulario", () => {
    it("elige el formato como el generador (por división; sin división, por la sección 3)", () => {
        assert.equal(varianteDe("Seguridad"), "Seguridad");
        assert.equal(varianteDe("Aseo & Limpieza"), "Aseo y limpieza");
        assert.equal(varianteDe(null, ["¿Cómo califica la calidad del servicio de Seguridad en cuanto a nuestro trabajo?"]), "Seguridad");
        assert.equal(varianteDe(null, []), "Aseo y limpieza");
    });
    it("traduce cada calificación a la escala impresa, 'no aplica' a la última y las apreciaciones globales a la otra escala", () => {
        const r = armarRegistro(raw(false), ubic("Seguridad"), false);
        assert.equal(r.variante, "Seguridad");
        assert.deepEqual(r.listas.seccion_1!.map((f) => f.valor), ["Muy Malo", "Malo", "Regular", "Bueno", "Muy Bueno", "Muy Malo"]);
        assert.deepEqual(r.listas.seccion_2!.map((f) => f.valor), ["Muy Bueno", "Bueno", "No sabe/No aplica", "Malo"]);
        assert.equal(r.listas.seccion_3!.length, 3);
        assert.deepEqual(r.listas.seccion_5, [{ item: "¿Cuál es su nivel de satisfacción global respecto al servicio que le brindamos?", valor: "Más de lo esperado", observacion: null }]);
        assert.equal(r.valores.seccion_1_observaciones, "Faltó uniforme algunos días.");
        assert.equal(r.valores.conoce_procedimiento_quejas, "Sí");
        assert.equal(r.valores.fecha, "2026-04-19");
        assert.equal(r.valores.empresa_institucion, "Ministerio Uno");
        assert.equal(r.valores.compromiso, COMPROMISO);
    });
    it("Aseo y limpieza trae 5 preguntas en la sección 3", () => {
        const r = armarRegistro(raw(true), ubic("Aseo y Limpieza"), false);
        assert.equal(r.variante, "Aseo y limpieza");
        assert.equal(r.listas.seccion_3!.length, 5);
    });
    it("no entrega datos personales del evaluado ni la firma del responsable; la firma del evaluado solo con firmas=1", () => {
        const sin = armarRegistro(raw(false), ubic("Seguridad"), false);
        const con = armarRegistro(raw(false), ubic("Seguridad"), true);
        const todo = JSON.stringify(con);
        for (const prohibido of ["1-2345-6789", "m@x.cr", "88888888", "sess:7", "-84.0"]) assert.ok(!todo.includes(prohibido), prohibido);
        assert.deepEqual(sin.firmas, { firma_evaluado: null });
        assert.deepEqual(sin.firmasPresentes, ["firma_evaluado"]);
        assert.equal(con.firmas.firma_evaluado, SAMPLE_PNG);
        assert.deepEqual(armarRegistro(raw(false, { firma_evaluado: null }), ubic("Seguridad"), true).firmasPresentes, []);
    });
    it("formato anterior (lista plana, a veces doblemente codificada): se reparte en las secciones de la plantilla y no inventa 'conoce'", () => {
        const plano = Array.from({ length: 16 }, (_, i) => ({ question: `Pregunta ${i + 1}`, value: (i % 5) + 1 }));
        const r = armarRegistro(raw(false, { evaluaciones: JSON.stringify(JSON.stringify(plano)) }), ubic("Seguridad"), false);
        assert.deepEqual(Object.values(r.listas).map((l) => l.length), [6, 4, 3, 2, 1]);
        assert.equal(r.listas.seccion_1![0]!.item, "Pregunta 1");
        assert.equal(r.valores.conoce_procedimiento_quejas, null);
        assert.deepEqual(leerEvaluaciones("no es json", "Seguridad"), { secciones: [], conoce: null });
    });
    it("carga en lote: una consulta de encuestas y una por nivel de estructura", async () => {
        const calls: string[] = [];
        const t = (name: string, rows: any[]) => ({ findMany: async (a: any) => { calls.push(`${name}:${JSON.stringify(a.where)}`); return rows; } });
        const db: any = {
            c_encuesta_cliente: t("enc", [raw(false), raw(true, { id: 42, division_id: 3 })]),
            e_estructura_empresa: t("emp", [{ id: 9, codigo: "9", nombre: "Seguridad SA" }]), e_estructura_cliente: t("cli", [{ id: 4, nombre: "Cliente Uno" }]), n_division: t("div", [{ id: 2, nombre: "Seguridad" }, { id: 3, nombre: "Aseo y Limpieza" }]),
            e_estructura_contrato: t("con", [{ id: 31, nro_contrato: "C-31", nombre: "Contrato" }]), e_estructura_sucursal: t("suc", [{ id: 55, nro_sucursal: "55", nombre: "Sede" }]), e_estructura_puesto: t("pue", [{ id: 140, codigo: "P140", nombre: "Portón" }]),
        };
        const out = await encuestaSatisfaccionForm.loadRecords(db, [41, 42], { firmas: false });
        assert.deepEqual(out.map((r) => [r.id, r.variante]), [[41, "Seguridad"], [42, "Aseo y limpieza"]]);
        assert.equal(calls.length, 7);
        assert.ok(calls[0]!.includes('"isActive":true'));
    });
    it("muestras completas para Guardify: un registro por variante", () => {
        // Completas: todas las secciones con observación, 'conoce' respondido y la firma del evaluado.
        writeFormSample("encuestas-de-satisfaccion", [
            armarRegistro(raw(false), ubic("Seguridad"), true),
            armarRegistro(raw(true), ubic("Aseo y Limpieza"), true),
        ]);
    });
});
