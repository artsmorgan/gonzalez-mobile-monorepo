import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { writeFormSample, SAMPLE_PNG } from "../formSamples";
import { armarRegistro, manualesPuestoForm, tipoPregunta, type ManualRaw } from "./manualesPuestoForm";

const DIGITAL = Buffer.from("sesion-1:20:9.93:-84.08:1788000000000").toString("base64");
const ubic = { empresa: "CH - Empresa", cliente: "Municipalidad", division: "Aseo", contrato: "C1 - Contrato", sucursal: "S1 - Sede", puesto: "P1 - Misceláneo" };
const quiz = {
    minApprovalPercentage: 70,
    questions: [
        { id: "q1", title: "¿Cuál es el horario de entrada?", type: "short", points: 5, answer: "7:00 am" },
        { id: "q2", title: "¿Qué equipo se usa para químicos?", type: "multiple_select", points: 10, options: ["Guantes", "Mascarilla", "Sandalias"], answers: ["Guantes", "Mascarilla"] },
    ],
};
const manual = (extra: any = {}) => ({
    id: 8, title: "Manual de limpieza", description: "Procedimientos de limpieza diaria.", classification: "Operativo", firma: DIGITAL, quiz: JSON.stringify(quiz),
    created_at: new Date("2026-03-10T13:20:00Z"), created_by: "20", empresa_id: 9, cliente_id: 2, division_id: 0, contrato_id: 4, corpo_id: 5, puesto_id: 6, isActive: true, ...extra,
});
const rawArmado = (extra: Partial<ManualRaw> = {}): ManualRaw => ({
    manual: manual(), puestos: ["P1 - Misceláneo", "P2 - Jardinero"], empleados: ["E1 Ana Mora Soto", "E2 Luis Vega Díaz"], creadoPor: "A1 - Marta Rojas", puestoPrincipal: "P1 - Misceláneo",
    visualizaciones: [
        { empleado: "E1 Ana Mora Soto", visto: true, firmado: true, approved: true }, { empleado: "E3 Eva Soto", visto: true, firmado: false, approved: false },
        { empleado: "E2 Luis Vega Díaz", visto: false, firmado: false, approved: null },
    ], ...extra,
});

describe("manuales de trabajo como formulario", () => {
    it("traduce los tipos de pregunta como la pantalla", () => {
        assert.equal(tipoPregunta("multiple_choice"), "Selección única");
        assert.equal(tipoPregunta("short"), "Respuesta corta");
        assert.equal(tipoPregunta("otro"), "otro");
        assert.equal(tipoPregunta(""), null);
    });
    it("arma el manual, sus puestos (el principal una sola vez), empleados, cuestionario y visualización", () => {
        const r = armarRegistro(rawArmado(), ubic, false);
        assert.equal(r.variante, null);
        assert.equal(r.creado, "2026-03-10T13:20:00");
        assert.deepEqual(r.valores, { titulo: "Manual de limpieza", descripcion: "Procedimientos de limpieza diaria.", clasificacion: "Operativo", creado_por: "A1 - Marta Rojas", porcentaje_minimo: 70 });
        assert.deepEqual(r.listas.puestos, [{ puesto: "P1 - Misceláneo" }, { puesto: "P2 - Jardinero" }]);
        assert.deepEqual(r.listas.cuestionario, [
            { numero: "1", enunciado: "¿Cuál es el horario de entrada?", tipo: "Respuesta corta", puntos: 5, opciones: null },
            { numero: "2", enunciado: "¿Qué equipo se usa para químicos?", tipo: "Selección múltiple", puntos: 10, opciones: "Guantes | Mascarilla | Sandalias" },
        ]);
        assert.deepEqual(r.listas.visualizacion, [
            { empleado: "E1 Ana Mora Soto", estado: "Firmado", aprobado: "Aprobado" }, { empleado: "E3 Eva Soto", estado: "Visto", aprobado: "Reprobado" }, { empleado: "E2 Luis Vega Díaz", estado: "No visto", aprobado: "Pendiente" },
        ]);
        assert.deepEqual(r.hier, { empresa: 9, cliente: 2, division: 0, contrato: 4, corpo: 5, puesto: 6 });
    });
    it("no entrega las respuestas correctas ni las de los empleados", () => {
        const s = JSON.stringify(armarRegistro(rawArmado(), ubic, true));
        assert.ok(!s.includes("7:00 am") && !s.includes('"answer') && !s.includes(DIGITAL));
    });
    it("sin cuestionario no hay porcentaje ni «Pendiente»; el quiz puede venir como lista simple", () => {
        const r = armarRegistro(rawArmado({ manual: manual({ quiz: null }) }), ubic, false);
        assert.equal(r.valores.porcentaje_minimo, null);
        assert.deepEqual(r.listas.cuestionario, []);
        assert.deepEqual(r.listas.visualizacion.map((v) => v.aprobado), ["Aprobado", "Reprobado", null]); // sin cuestionario el que no ha visto nada no queda «Pendiente»
        const plano = armarRegistro(rawArmado({ manual: manual({ quiz: JSON.stringify([{ id: "a", title: "Pregunta suelta", type: "paragraph" }]) }) }), ubic, false);
        assert.deepEqual(plano.listas.cuestionario, [{ numero: "1", enunciado: "Pregunta suelta", tipo: "Párrafo", puntos: null, opciones: null }]);
    });
    it("la firma del responsable es digital (presente, sin imagen); si fuera imagen solo sale con firmas=1", () => {
        assert.deepEqual(armarRegistro(rawArmado(), ubic, true).firmas, { firma_responsable: null });
        assert.deepEqual(armarRegistro(rawArmado(), ubic, true).firmasPresentes, ["firma_responsable"]);
        const img = rawArmado({ manual: manual({ firma: SAMPLE_PNG }) });
        assert.deepEqual(armarRegistro(img, ubic, false).firmas, { firma_responsable: null });
        assert.equal(armarRegistro(img, ubic, true).firmas.firma_responsable, SAMPLE_PNG);
        assert.deepEqual(armarRegistro(rawArmado({ manual: manual({ firma: "" }) }), ubic, true).firmasPresentes, []);
    });
    it("carga en lote: una consulta por tabla, solo activos, en el orden pedido y con la división del contrato", async () => {
        const calls: string[] = [];
        const t = (name: string, rows: any[]) => ({ findMany: async (a: any) => { calls.push(`${name}:${JSON.stringify(a.where)}`); return rows; } });
        const db: any = {
            e_manual_puesto: t("man", [manual(), manual({ id: 9, title: "Otro manual" })]),
            e_puestos_manual_puesto: t("lp", [{ id: 1, manual_puesto_id: 8, puesto_id: 70 }]),
            e_empleados_manual_puesto: t("le", [{ id: 1, manual_puesto_id: 8, empleado_id: 1 }, { id: 2, manual_puesto_id: 8, empleado_id: 2 }]),
            e_empleado_visualizacion_manual_puesto: t("vis", [{ id: 5, manual_puesto_id: 8, empleado_id: 1, nombre_empleado: "Ana Mora Soto", approved: true, firma_empleado_manual: SAMPLE_PNG }]),
            c_empleado: t("emp", [{ id: 1, codigo: "E1", nombre: "Ana", primer_apellido: "Mora", segundo_apellido: "Soto" }, { id: 2, codigo: "E2", nombre: "Luis", primer_apellido: "Vega", segundo_apellido: null }, { id: 20, codigo: "A1", nombre: "Marta", primer_apellido: "Rojas", segundo_apellido: null }]),
            e_estructura_puesto: t("pue", [{ id: 70, codigo: "P70", nombre: "Recepción" }, { id: 6, codigo: "P1", nombre: "Misceláneo" }]),
            e_estructura_empresa: t("empr", [{ id: 9, codigo: "CH", nombre: "Empresa" }]), e_estructura_cliente: t("cli", [{ id: 2, nombre: "Municipalidad" }]), n_division: t("div", [{ id: 9, nombre: "Seguridad" }]),
            e_estructura_contrato: t("con", [{ id: 4, nro_contrato: "C1", nombre: "Contrato", division_id: 9 }]), e_estructura_sucursal: t("suc", [{ id: 5, nro_sucursal: "S1", nombre: "Sede" }]),
        };
        const out = await manualesPuestoForm.loadRecords(db, [9, 8], { firmas: false });
        assert.deepEqual(out.map((r) => r.id), [9, 8]);
        assert.ok(calls[0]!.includes('"isActive":true'));
        const n = (p: string) => calls.filter((c) => c.startsWith(p)).length;
        assert.deepEqual([n("man:"), n("lp:"), n("le:"), n("vis:"), n("emp:")], [1, 1, 1, 1, 1]);
        const m8 = out[1]!;
        assert.equal(m8.estructura.division, "Seguridad"); // la cabecera no trae división: se toma la del contrato
        assert.deepEqual(m8.listas.puestos, [{ puesto: "P1 - Misceláneo" }, { puesto: "P70 - Recepción" }]);
        assert.deepEqual(m8.listas.empleados, [{ empleado: "E1 Ana Mora Soto" }, { empleado: "E2 Luis Vega" }]);
        assert.deepEqual(m8.listas.visualizacion, [
            { empleado: "E1 Ana Mora Soto", estado: "Firmado", aprobado: "Aprobado" }, { empleado: "E2 Luis Vega", estado: "No visto", aprobado: "Pendiente" },
        ]);
        assert.equal(m8.valores.creado_por, "A1 - Marta Rojas");
        assert.equal(out[0]!.listas.visualizacion.length, 0); // las visualizaciones son del manual 8
        assert.ok(!JSON.stringify(out).includes("data:image")); // la firma manual del empleado nunca sale
    });
    it("muestra completa para Guardify (quiz, puestos, empleados y los tres estados)", () => {
        // Todas las preguntas con opciones y puntos, para que ninguna celda de la muestra quede vacía.
        const quizCompleto = { minApprovalPercentage: 70, questions: [
            { id: "q1", title: "¿A qué hora se marca la entrada?", type: "multiple_choice", points: 5, options: ["6:00 am", "7:00 am"], answer: "7:00 am" },
            { id: "q2", title: "¿Qué equipo se usa para químicos?", type: "multiple_select", points: 10, options: ["Guantes", "Mascarilla", "Sandalias"], answers: ["Guantes", "Mascarilla"] },
            { id: "q3", title: "Seleccione el producto para vidrios", type: "list", points: 5, options: ["Multiuso", "Limpiavidrios"], answer: "Limpiavidrios" },
        ] };
        const completo = armarRegistro(rawArmado({ manual: manual({ quiz: JSON.stringify(quizCompleto) }), puestos: ["P1 - Misceláneo", "P2 - Jardinero", "P3 - Bodega"] }), { ...ubic, division: "Aseo" }, true);
        writeFormSample("manuales-de-trabajo", [completo]);
        assert.equal(completo.listas.visualizacion.length, 3);
    });
});
