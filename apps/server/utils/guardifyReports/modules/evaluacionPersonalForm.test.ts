import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SAMPLE_PNG, writeFormSample } from "../formSamples";
import { armarRegistro, evaluacionPersonalForm, firmaDigital, varianteDe } from "./evaluacionPersonalForm";

// Firma digital: base64 de «sesión:empleado:latitud:longitud:ms». 1_776_000_000_000 ms = 2026-04-12 13:20 UTC = 07:20 en Costa Rica.
const hash = (empleado: number) => Buffer.from(`sess-${empleado}:${empleado}:9.93:-84.08:1776000000000`).toString("base64");
const q = (title: string, answear: string) => ({ title, answear, image: null, images: [] });
const TITULOS_SEG = ["Cumplimiento de Tareas", "Vigilancia del Área Asignada", "Disponibilidad", "Ausentismo", "Incapacidades / Accidentes Laborales", "Puntualidad / Llegadas Tardías", "Actitud de Servicio", "Quejas de Clientes", "Relaciones con los compañeros y supervisores", "Buena presentación personal"];
const principal = (aseo: boolean) => [{ title: "Evaluación principal", minimum_score: 70, questions: TITULOS_SEG.map((t, i) => q(aseo && i === 1 ? "Limpieza del Área Asignada" : t, String(10 - (i % 4)))) }];
const otros = [
    { title: "Objetivos generales 50%", minimum_score: 20, questions: ["Entregar informes", "Cumplir rondas", "Reducir novedades", "Capacitar personal", "Atender clientes"].map((t, i) => q(t, String(i % 5))) },
    { title: "Competencias genéricas 10%", minimum_score: 12, questions: ["Responsabilidad", "Compromiso", "Espíritu de Servicio al cliente interno y externo"].map((t) => q(t, "3")) },
    { title: "Competencias específicas por área 10%", minimum_score: 16, questions: ["Capacidad de planificación y organización", "Comunicación", "Trabajo en equipo", "Orientación de resultados"].map((t) => q(t, "4")) },
    { title: "Competencias gerenciales liderazgo (Aplica sólo para puestos de Supervisión, Jefaturas y Directores)  20%", minimum_score: 24, questions: ["Es confiable", "Da sentido al futuro", "Dirige y ejecuta el trabajo", "Compromete el talento", "Desarrolla el talento", "Se desarrolla a sí mismo"].map((t) => q(t, "2")) },
    { title: "Formación valuable 10%", minimum_score: 20, questions: ["General (Políticas y Filosofía Corporativa )", "Cursos específicos o según licitacion", "Herramientas tecnológicas (Software o equipo que debe saber utilizar)", "Procedimientos, manuales, formularios, guías de puestos ó Instructivos específicos que debe saber utilizar", "Otra formación según funciones a ejecutar"].map((t) => q(t, "1")) },
    { title: "Retroalimentación", minimum_score: null, questions: ["Aspectos positivos del colaborador (Fortalezas)", "Áreas o competencias por mejorar (Oportunidad de mejora)", "Plan de acción (Recomendaciones)", "Aspiraciones personales - ¿Cuáles son sus metas próximas a nivel profesional?"].map((t, i) => q(t, `Respuesta ${i + 1}`)) },
    { title: "Comentarios", minimum_score: null, questions: [q("Colaborador", "Agradece la evaluación."), q("Jefatura", "Buen desempeño.")] },
];
const raw = (tipo: string, evaluacion: unknown, o: Record<string, unknown> = {}) => ({
    id: 51, created_at: new Date("2026-04-20T09:30:00Z"), empresa_id: 9, cliente_id: 4, division_id: 2, contrato_id: 31, corpo_id: 55, puesto_id: 140, plaza_id: 3, empleado_id: 7, evaluador_id: 8,
    nombre_empleado: "Pedro Rojas", cedula_empleado: "1-1111-2222", tipo, fecha_ingreso: new Date("2024-01-15T00:00:00Z"), fecha_evaluacion: new Date("2026-04-19T00:00:00Z"),
    evaluacion: JSON.stringify(evaluacion), comentarios: "Muy buen desempeño general.", nombre_evaluador: "Ana Soto",
    firma_evaluador: hash(8), firma_empleado: hash(7), firma_empleado_manual: SAMPLE_PNG, ...o,
});
const ubic = { empresa: "9 - Seguridad SA", cliente: "Cliente Uno", division: "Seguridad", contrato: "C-31 - Contrato", sucursal: "55 - Sede", puesto: "P140 - Portón" };
const empleados = new Map<number, any>([[7, { codigo: "E7", nombre: "Pedro", primer_apellido: "Rojas" }], [8, { codigo: "E8", nombre: "Ana", primer_apellido: "Soto" }]]);

describe("evaluación de personal como formulario", () => {
    it("normaliza el tipo", () => {
        assert.equal(varianteDe("seguridad"), "Seguridad");
        assert.equal(varianteDe("Aseo & limpieza"), "Aseo & limpieza");
        assert.equal(varianteDe("OTROS"), "Otros");
        assert.equal(varianteDe("Raro"), "Raro");
    });
    it("Seguridad: 10 preguntas con su número y el puntaje mínimo", () => {
        const r = armarRegistro(raw("Seguridad", principal(false)), ubic, false, { empleados });
        assert.equal(r.variante, "Seguridad");
        assert.equal(r.listas.evaluacion!.length, 10);
        assert.deepEqual(r.listas.evaluacion![0], { item: "Cumplimiento de Tareas", valor: "10", observacion: null });
        assert.equal(r.valores.puntaje_minimo, 70);
        assert.equal(r.valores.nombre_colaborador, "E7 - Pedro Rojas");
        assert.equal(r.valores.nombre_evaluador, "E8 - Ana Soto");
        assert.equal(r.valores.fecha_ingreso, "2024-01-15");
        assert.equal(r.valores.fecha_evaluacion, "2026-04-19");
        assert.equal(armarRegistro(raw("Aseo & limpieza", principal(true)), ubic, false, { empleados }).listas.evaluacion![1]!.item, "Limpieza del Área Asignada");
    });
    it("Otros: cada sección a su lista, calificación en palabras y respuestas de texto como valores", () => {
        const r = armarRegistro(raw("Otros", otros), ubic, false, { empleados });
        assert.equal(r.variante, "Otros");
        assert.deepEqual(Object.fromEntries(Object.entries(r.listas).map(([k, v]) => [k, v.length])), { objetivos: 5, competencias_genericas: 3, competencias_especificas: 4, competencias_gerenciales: 6, formacion: 5 });
        assert.deepEqual(r.listas.objetivos!.map((f) => f.valor), ["No aplica", "No cumple", "Requiere mejorar", "Cumple", "Supera estándar"]);
        assert.equal(r.valores.retroalimentacion_4, "Respuesta 4");
        assert.equal(r.valores.comentarios_2, "Buen desempeño.");
        assert.equal("evaluacion" in r.listas, false);
    });
    it("firmas: la manual es imagen (solo con firmas=1); las digitales solo se informan, sin sesión ni ubicación", () => {
        const sin = armarRegistro(raw("Seguridad", principal(false)), ubic, false, { empleados });
        assert.deepEqual(sin.firmas, { firma_empleado_manual: null, firma_evaluador: null, firma_empleado: null });
        assert.deepEqual(sin.firmasPresentes, ["firma_empleado_manual", "firma_evaluador", "firma_empleado"]);
        const con = armarRegistro(raw("Seguridad", principal(false)), ubic, true, { empleados });
        assert.equal(con.firmas.firma_empleado_manual, SAMPLE_PNG);
        assert.equal(con.firmas.firma_evaluador, null);
        assert.equal(con.valores.firma_evaluador_digital, "Firmada digitalmente por Ana Soto el 2026-04-12 07:20");
        const todo = JSON.stringify(con);
        assert.ok(!todo.includes("sess-") && !todo.includes("-84.08") && !todo.includes(hash(8)));
        assert.deepEqual(firmaDigital(hash(8)), { empleadoId: 8, cuando: "2026-04-12 07:20" });
    });
    it("sin firma del funcionario ni comentarios: nada presente y el «-» de la pantalla es vacío", () => {
        const r = armarRegistro(raw("Seguridad", principal(false), { firma_empleado: null, firma_empleado_manual: null, comentarios: "-" }), ubic, true, { empleados });
        assert.deepEqual(r.firmasPresentes, ["firma_evaluador"]);
        assert.equal(r.valores.firma_empleado_digital, null);
        assert.equal(r.valores.comentarios_generales, null);
    });
    it("tolera evaluación vacía o doblemente codificada", () => {
        assert.deepEqual(armarRegistro(raw("Seguridad", null, { evaluacion: "no es json" }), ubic, false).listas, {});
        const doble = armarRegistro(raw("Seguridad", null, { evaluacion: JSON.stringify(JSON.stringify(principal(false))) }), ubic, false);
        assert.equal(doble.listas.evaluacion!.length, 10);
    });
    it("carga en lote: una consulta de evaluaciones, una por nivel y una de empleados", async () => {
        const calls: string[] = [];
        const t = (name: string, rows: any[]) => ({ findMany: async (a: any) => { calls.push(`${name}:${JSON.stringify(a.where)}`); return rows; } });
        const db: any = {
            c_evaluacion_empleado: t("ev", [raw("Seguridad", principal(false)), raw("Otros", otros, { id: 52 })]),
            e_estructura_empresa: t("emp", [{ id: 9, codigo: "9", nombre: "Seguridad SA" }]), e_estructura_cliente: t("cli", [{ id: 4, nombre: "Cliente Uno" }]), n_division: t("div", [{ id: 2, nombre: "Seguridad" }]),
            e_estructura_contrato: t("con", [{ id: 31, nro_contrato: "C-31", nombre: "Contrato" }]), e_estructura_sucursal: t("suc", [{ id: 55, nro_sucursal: "55", nombre: "Sede" }]), e_estructura_puesto: t("pue", [{ id: 140, codigo: "P140", nombre: "Portón" }]),
            c_empleado: t("empl", [{ id: 7, codigo: "E7", nombre: "Pedro", primer_apellido: "Rojas" }, { id: 8, codigo: "E8", nombre: "Ana", primer_apellido: "Soto" }]),
        };
        const out = await evaluacionPersonalForm.loadRecords(db, [51, 52], { firmas: false });
        assert.deepEqual(out.map((r) => [r.id, r.variante]), [[51, "Seguridad"], [52, "Otros"]]);
        assert.equal(out[0]!.valores.nombre_evaluador, "E8 - Ana Soto");
        assert.equal(calls.length, 8);
        assert.ok(calls[0]!.includes('"isActive":true'));
    });
    it("muestras completas para Guardify: un registro por variante", () => {
        // Completas: todas las preguntas con respuesta, las dos firmas digitales, la manual con imagen y los comentarios.
        writeFormSample("evaluacion-de-personal", [
            armarRegistro(raw("Seguridad", principal(false)), ubic, true, { empleados }),
            armarRegistro(raw("Aseo & limpieza", principal(true)), ubic, true, { empleados }),
            armarRegistro(raw("Otros", otros), ubic, true, { empleados }),
        ]);
    });
});
