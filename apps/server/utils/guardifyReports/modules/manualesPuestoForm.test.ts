import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { writeFormSample, SAMPLE_PNG } from "../formSamples";
import { armarRegistro, celdaFirma, manualesPuestoForm, tipoPregunta, type ManualRaw } from "./manualesPuestoForm";

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
        { empleado: "E1 Ana Mora Soto", visto: true, firma: SAMPLE_PNG, approved: true }, { empleado: "E3 Eva Soto", visto: true, firma: null, approved: false },
        { empleado: "E2 Luis Vega Díaz", visto: false, firma: null, approved: null },
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
        assert.deepEqual(r.valores, { titulo: "Manual de limpieza", descripcion: "Procedimientos de limpieza diaria.", clasificacion: "Operativo", creado_por: "A1 - Marta Rojas", porcentaje_minimo: 70, version: 1 });
        assert.deepEqual(r.listas.puestos, [{ puesto: "P1 - Misceláneo" }, { puesto: "P2 - Jardinero" }]);
        assert.deepEqual(r.listas.cuestionario, [
            { numero: "1", enunciado: "¿Cuál es el horario de entrada?", tipo: "Respuesta corta", puntos: 5, opciones: null },
            { numero: "2", enunciado: "¿Qué equipo se usa para químicos?", tipo: "Selección múltiple", puntos: 10, opciones: "Guantes | Mascarilla | Sandalias" },
        ]);
        assert.deepEqual(r.listas.visualizacion, [
            { empleado: "E1 Ana Mora Soto", estado: "Firmado", visto: "Sí", fecha_visto: null, firmado: "Sí", fecha_firma: null, firma: "Firmada", aprobado: "Aprobado", version: 1, fecha_entrega: null, nota: null }, { empleado: "E3 Eva Soto", estado: "Visto", visto: "Sí", fecha_visto: null, firmado: "No", fecha_firma: null, firma: null, aprobado: "Reprobado", version: 1, fecha_entrega: null, nota: null }, { empleado: "E2 Luis Vega Díaz", estado: "No visto", visto: "No", fecha_visto: null, firmado: "No", fecha_firma: null, firma: null, aprobado: "Pendiente", version: 1, fecha_entrega: null, nota: null },
        ]);
        assert.deepEqual(r.hier, { empresa: 9, cliente: 2, division: 0, contrato: 4, corpo: 5, puesto: 6 });
    });
    it("el detalle por empleado dice si lo vio y lo firmó y cuándo; el que no lo ha visto sale sin fechas", () => {
        const r = armarRegistro(rawArmado({ visualizaciones: [
            { empleado: "E1", visto: true, firma: SAMPLE_PNG, approved: true, fechaVisto: "2026-04-01T08:00:00", fechaFirma: "2026-04-01T08:05:00" },
            { empleado: "E2", visto: true, firma: null, approved: null, fechaVisto: "2026-04-02T09:00:00", fechaFirma: "2026-04-02T09:00:00" },
            { empleado: "E3", visto: false, firma: null, approved: null },
        ] }), ubic, true);
        const f = r.listas.visualizacion!;
        assert.deepEqual([f[0]!.visto, f[0]!.fecha_visto, f[0]!.firmado, f[0]!.fecha_firma, f[0]!.firma], ["Sí", "2026-04-01T08:00:00", "Sí", "2026-04-01T08:05:00", SAMPLE_PNG]);
        assert.deepEqual([f[1]!.visto, f[1]!.firmado, f[1]!.fecha_firma, f[1]!.firma], ["Sí", "No", null, null]); // vio pero no firmó: no hay fecha de firma
        assert.deepEqual([f[2]!.visto, f[2]!.fecha_visto, f[2]!.firmado], ["No", null, "No"]);
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
            c_empleado_plaza: t("pla", []),
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
            { empleado: "E1 Ana Mora Soto", estado: "Firmado", visto: "Sí", fecha_visto: null, firmado: "Sí", fecha_firma: null, firma: "Firmada", aprobado: "Aprobado", version: 1, fecha_entrega: null, nota: null }, { empleado: "E2 Luis Vega", estado: "No visto", visto: "No", fecha_visto: null, firmado: "No", fecha_firma: null, firma: null, aprobado: "Pendiente", version: 1, fecha_entrega: null, nota: null },
        ]);
        assert.equal(m8.valores.creado_por, "A1 - Marta Rojas");
        assert.equal(out[0]!.listas.visualizacion.length, 0); // las visualizaciones son del manual 8
        assert.ok(!JSON.stringify(out).includes("data:image")); // con firmas=false la imagen de la firma manual jamás sale
    });
    it("celdaFirma y la firma manual por renglón: imagen solo con firmas=true; no-imagen «Firmada»; sin firma null", async () => {
        assert.equal(celdaFirma(SAMPLE_PNG, true), SAMPLE_PNG);
        assert.equal(celdaFirma(SAMPLE_PNG, false), "Firmada");
        assert.equal(celdaFirma("iVBORw0KGgo" + "A".repeat(40), true), "data:image/png;base64,iVBORw0KGgo" + "A".repeat(40));
        assert.equal(celdaFirma("/9j/" + "A".repeat(40), true), "data:image/jpeg;base64,/9j/" + "A".repeat(40));
        assert.equal(celdaFirma(DIGITAL, true), "Firmada");
        assert.equal(celdaFirma("", true), null);
        assert.equal(celdaFirma(null, false), null);
        const con = armarRegistro(rawArmado(), ubic, true).listas.visualizacion!;
        assert.deepEqual(con.map((v) => v.firma), [SAMPLE_PNG, null, null]);
        const sin = JSON.stringify(armarRegistro(rawArmado(), ubic, false));
        assert.ok(!sin.includes("data:image") && !sin.includes("iVBOR"));
        const digital = armarRegistro(rawArmado({ visualizaciones: [{ empleado: "E1", visto: true, firma: DIGITAL, approved: true }] }), ubic, true);
        assert.equal(digital.listas.visualizacion![0]!.firma, "Firmada");
        assert.equal(digital.listas.visualizacion![0]!.estado, "Firmado");
        assert.ok(!JSON.stringify(digital).includes(DIGITAL), "la cadena no-imagen nunca sale");
        // La carga en lote con firmas=true entrega la imagen del renglón.
        const db: any = {
            e_manual_puesto: { findMany: async () => [manual()] }, e_puestos_manual_puesto: { findMany: async () => [] }, e_empleados_manual_puesto: { findMany: async () => [] },
            e_empleado_visualizacion_manual_puesto: { findMany: async () => [{ id: 5, manual_puesto_id: 8, empleado_id: 1, nombre_empleado: "Ana Mora Soto", approved: true, firma_empleado_manual: SAMPLE_PNG }] },
            c_empleado: { findMany: async () => [] }, e_estructura_puesto: { findMany: async () => [] }, e_estructura_empresa: { findMany: async () => [] }, e_estructura_cliente: { findMany: async () => [] },
            n_division: { findMany: async () => [] }, e_estructura_contrato: { findMany: async () => [] }, e_estructura_sucursal: { findMany: async () => [] }, c_empleado_plaza: { findMany: async () => [] },
        };
        const [m] = await manualesPuestoForm.loadRecords(db, [8], { firmas: true });
        assert.equal(m!.listas.visualizacion![0]!.firma, SAMPLE_PNG);
    });
    it("muestra completa para Guardify (quiz, puestos, empleados y los tres estados)", () => {
        // Todas las preguntas con opciones y puntos, para que ninguna celda de la muestra quede vacía.
        const quizCompleto = { minApprovalPercentage: 70, questions: [
            { id: "q1", title: "¿A qué hora se marca la entrada?", type: "multiple_choice", points: 5, options: ["6:00 am", "7:00 am"], answer: "7:00 am" },
            { id: "q2", title: "¿Qué equipo se usa para químicos?", type: "multiple_select", points: 10, options: ["Guantes", "Mascarilla", "Sandalias"], answers: ["Guantes", "Mascarilla"] },
            { id: "q3", title: "Seleccione el producto para vidrios", type: "list", points: 5, options: ["Multiuso", "Limpiavidrios"], answer: "Limpiavidrios" },
        ] };
        // Los tres renglones con firma manual para que la celda de firma nunca quede vacía en la muestra.
        const visualizaciones = rawArmado().visualizaciones.map((v, i) => ({ ...v, visto: true, firma: SAMPLE_PNG, fechaVisto: `2026-04-0${i + 1}T08:00:00`, fechaFirma: `2026-04-0${i + 1}T08:05:00` }));
        const completo = armarRegistro(rawArmado({ manual: manual({ quiz: JSON.stringify(quizCompleto) }), puestos: ["P1 - Misceláneo", "P2 - Jardinero", "P3 - Bodega"], visualizaciones }), { ...ubic, division: "Aseo" }, true);
        writeFormSample("manuales-de-trabajo", [completo]);
        assert.equal(completo.listas.visualizacion.length, 3);
    });
    it("los empleados asignados a los puestos del manual salen como «No visto» aunque no estén vinculados", async () => {
        const db: any = {
            e_manual_puesto: { findMany: async () => [manual()] }, e_puestos_manual_puesto: { findMany: async () => [{ id: 1, manual_puesto_id: 8, puesto_id: 70 }] }, e_empleados_manual_puesto: { findMany: async () => [] },
            e_empleado_visualizacion_manual_puesto: { findMany: async () => [{ id: 5, manual_puesto_id: 8, empleado_id: 1, nombre_empleado: "Ana Mora Soto", approved: null, firma_empleado_manual: null }] },
            c_empleado_plaza: { findMany: async (a: any) => (a.where.puesto_id.in.includes(70) ? [{ empleado_id: 1, puesto_id: 70 }, { empleado_id: 2, puesto_id: 70 }, { empleado_id: 3, puesto_id: 70 }] : []) },
            c_empleado: { findMany: async (a: any) => [{ id: 1, codigo: "E1", nombre: "Ana", primer_apellido: "Mora", segundo_apellido: "Soto", estado: "Activo" }, { id: 2, codigo: "E2", nombre: "Luis", primer_apellido: "Vega", segundo_apellido: "", estado: "Activo" }, { id: 3, codigo: "E3", nombre: "Eva", primer_apellido: "Sola", segundo_apellido: "", estado: "Inactivo" }].filter((e) => a.where.id.in.includes(e.id)) },
            e_estructura_puesto: { findMany: async () => [{ id: 70, codigo: "P70", nombre: "Recepción" }] }, e_estructura_empresa: { findMany: async () => [] }, e_estructura_cliente: { findMany: async () => [] },
            n_division: { findMany: async () => [] }, e_estructura_contrato: { findMany: async () => [] }, e_estructura_sucursal: { findMany: async () => [] },
        };
        const [m] = await manualesPuestoForm.loadRecords(db, [8], { firmas: false });
        const filas = m!.listas.visualizacion!;
        // Ana ya lo abrió; Luis lo tiene asignado y no lo ha visto; Eva está dada de baja y no cuenta.
        assert.deepEqual(filas.map((f) => [f.empleado, f.estado]), [["E1 Ana Mora Soto", "Visto"], ["E2 Luis Vega", "No visto"]]);
    });
});

describe("detalle por versión, fecha de entrega y nota (issues #154, #155 y #156)", () => {
    it("cada empleado trae la fecha de entrega, la versión y su nota consolidada", () => {
        const r = armarRegistro(
            rawArmado({
                manual: { ...manual(), version: 3 },
                visualizaciones: [
                    { empleado: "E1", visto: true, firma: SAMPLE_PNG, approved: true, fechaVisto: "2026-10-02T08:00:00", fechaFirma: "2026-10-02T08:05:00", fechaEntrega: "2026-10-01T06:00:00", nota: 92.5 },
                    { empleado: "E2", visto: false, firma: null, approved: null, fechaEntrega: "2026-10-01T06:00:00" },
                ],
            }),
            ubic,
            false,
        );
        assert.equal(r.valores.version, 3);
        assert.deepEqual(r.listas.visualizacion!.map((v) => [v.empleado, v.version, v.fecha_entrega, v.nota]), [["E1", 3, "2026-10-01T06:00:00", 92.5], ["E2", 3, "2026-10-01T06:00:00", null]]);
    });
    it("las firmas y notas de versiones anteriores se conservan en su propia lista, con su versión", () => {
        const r = armarRegistro(
            rawArmado({ manual: { ...manual(), version: 2 }, anteriores: [{ empleado: "E1", version: 1, firma: SAMPLE_PNG, approved: true, fechaVisto: "2026-09-01T08:00:00", fechaFirma: "2026-09-01T08:05:00", nota: 88 }] }),
            ubic,
            true,
        );
        const ant = r.listas.visualizacion_anteriores!;
        assert.deepEqual(ant.map((a) => [a.empleado, a.version, a.estado, a.aprobado, a.nota, a.fecha_firma]), [["E1", 1, "Firmado", "Aprobado", 88, "2026-09-01T08:05:00"]]);
        assert.equal(ant[0]!.firma, SAMPLE_PNG);
        assert.deepEqual(armarRegistro(rawArmado(), ubic, false).listas.visualizacion_anteriores, []);
    });
});
