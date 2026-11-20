import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calcularNota, esAutocalificable, leerQuiz, leerRespuestas, notaDesdeApp, notaDesdeCalculo } from "./notaQuiz";
import { archivosDeVersion, asignacionAplica, entregarDocumentoAEmpleados, entregarDocumentosPendientes, publicarNuevaVersion, type Dyn } from "./service";

/** Base en memoria: tablas como arreglos; where por igualdad, `in` y `not: null`. */
function memoria(seed: Record<string, any[]> = {}) {
    const tablas: Record<string, any[]> = Object.fromEntries(Object.entries(seed).map(([k, v]) => [k, v.map((r) => ({ ...r }))]));
    const ids: Record<string, number> = {};
    const coincide = (row: any, where: any = {}) =>
        Object.entries(where).every(([k, v]) => {
            if (v && typeof v === "object" && "in" in (v as any)) return (v as any).in.includes(row[k]);
            return row[k] === v;
        });
    const llamadas: string[] = [];
    const dyn: Dyn = {
        async find(t, a = {}) { llamadas.push(`find:${t}`); return (tablas[t] ??= []).filter((r) => coincide(r, a.where)).map((r) => ({ ...r })); },
        async create(t, d) { llamadas.push(`create:${t}`); const row = { id: (ids[t] = Math.max(ids[t] ?? 0, ...(tablas[t] ??= []).map((r) => r.id ?? 0)) + 1), ...d }; tablas[t]!.push(row); return { ...row }; },
        async update(t, w, d) { llamadas.push(`update:${t}`); const row = (tablas[t] ??= []).find((r) => r.id === w.id); if (!row) throw new Error("no existe"); Object.assign(row, d); return { ...row }; },
    };
    return { dyn, tablas, llamadas };
}
const AHORA = "2026-10-21T08:00:00";

describe("nota consolidada del quiz (issue #156)", () => {
    const quiz = JSON.stringify({ minApprovalPercentage: 80, questions: [
        { id: "q1", type: "multiple_choice", points: 10, answer: "A" },
        { id: "q2", type: "multiple_choice", points: 10, answer: "B" },
        { id: "q3", type: "paragraph", points: 20 },
    ] });
    it("lee el formato nuevo y el antiguo, y el mínimo por defecto es 70", () => {
        assert.equal(leerQuiz(quiz).minimo, 80);
        assert.equal(leerQuiz(JSON.stringify([{ id: "x", type: "short", points: 5 }])).minimo, 70);
        assert.deepEqual(leerQuiz("no json").preguntas, []);
    });
    it("las de selección única se califican solas y las demás con el puntaje de quien revisa; la nota es 0-100", () => {
        const respuestas = leerRespuestas(JSON.stringify([{ question_id: "q1", user_answer: "A" }, { question_id: "q2", user_answer: "X" }, { question_id: "q3", user_answer: "texto" }]));
        const n = calcularNota(leerQuiz(quiz), respuestas, { q3: 15 })!;
        assert.deepEqual([n.puntos, n.total, n.nota, n.minimo, n.aprobado, n.completa], [25, 40, 62.5, 80, false, true]);
    });
    it("sin el puntaje de una pregunta calificada a mano la nota no está completa", () => {
        const n = calcularNota(leerQuiz(quiz), leerRespuestas(JSON.stringify([{ question_id: "q1", user_answer: "A" }])))!;
        assert.equal(n.completa, false);
    });
    it("el puntaje de una pregunta no puede pasar del que vale", () => {
        const n = calcularNota(leerQuiz(quiz), [], { q3: 999 })!;
        assert.equal(n.puntos, 20);
    });
    it("un quiz solo de selección única lo califica el servidor sin ayuda", () => {
        const solo = JSON.stringify({ questions: [{ id: "a", type: "multiple_choice", points: 5, answer: "1" }, { id: "b", type: "multiple_choice", points: 5, answer: "2" }] });
        assert.equal(esAutocalificable(leerQuiz(solo)), true);
        assert.equal(esAutocalificable(leerQuiz(quiz)), false);
        const n = calcularNota(leerQuiz(solo), leerRespuestas(JSON.stringify([{ question_id: "a", user_answer: "1" }, { question_id: "b", user_answer: "2" }])))!;
        assert.deepEqual([n.nota, n.aprobado, n.completa], [100, true, true]);
    });
    it("lo que manda la app se valida y se vuelve la nota guardable; datos incoherentes se rechazan", () => {
        const n = notaDesdeApp({ obtained: 25, total: 40 }, 80, AHORA, 9)!;
        assert.deepEqual([n.nota, n.nota_puntos, n.nota_total, n.nota_minimo, n.nota_fecha, n.nota_calificado_por], [62.5, 25, 40, 80, AHORA, 9]);
        for (const malo of [null, {}, { obtained: 50, total: 40 }, { obtained: -1, total: 40 }, { obtained: 1, total: 0 }, { obtained: "x", total: 4 }]) assert.equal(notaDesdeApp(malo, 70, AHORA, 1), null, JSON.stringify(malo));
    });
    it("la nota calculada por el servidor tiene la misma forma que la que manda la app", () => {
        const c = calcularNota(leerQuiz(JSON.stringify({ questions: [{ id: "a", type: "multiple_choice", points: 4, answer: "1" }] })), [{ question_id: "a", user_answer: "1" }])!;
        assert.deepEqual(Object.keys(notaDesdeCalculo(c, AHORA, null)).sort(), Object.keys(notaDesdeApp({ obtained: 1, total: 2 }, 70, AHORA, null)!).sort());
    });
});

describe("versiones de un documento (issue #155)", () => {
    const manual = () => ({ id: 1, version: 1, title: "Manual", description: "v1", quiz: null, classification: "A", created_by: "5", created_at: "2026-09-01T00:00:00", externo_version_id: "ev1", sello: "s1" });
    it("publicar la v2 deja la v1 en el histórico, sube la versión y no borra nada", async () => {
        const { dyn, tablas } = memoria({
            e_manual_puesto: [manual()],
            e_archivos_manual_puesto: [{ id: 10, manual_puesto_id: 1, name: "a.pdf", version: 1, retirado_en_version: null }],
            e_empleado_visualizacion_manual_puesto: [{ id: 50, empleado_id: 7, manual_puesto_id: 1, version: 1, firma_empleado: "f" }],
        });
        const r = await publicarNuevaVersion(dyn, tablas.e_manual_puesto![0], {
            title: "Manual", description: "v2", externoVersionId: "ev2", sello: "s2", ahoraIso: AHORA, publicadoPor: "ana@x.com",
            archivosNuevos: [{ name: "b.pdf", type: "document", original_name: "b.pdf", extension: "pdf" }], archivosRetirar: [10],
        });
        assert.deepEqual(r, { version: 2, creada: true });
        assert.deepEqual([tablas.e_manual_puesto![0].version, tablas.e_manual_puesto![0].description, tablas.e_manual_puesto![0].sello], [2, "v2", "s2"]);
        // histórico: la v1 tal como estaba
        assert.deepEqual([tablas.e_manual_puesto_version!.length, tablas.e_manual_puesto_version![0].version, tablas.e_manual_puesto_version![0].description, tablas.e_manual_puesto_version![0].sello], [1, 1, "v1", "s1"]);
        // la firma de la v1 sigue intacta con su versión
        assert.deepEqual([tablas.e_empleado_visualizacion_manual_puesto![0].version, tablas.e_empleado_visualizacion_manual_puesto![0].firma_empleado], [1, "f"]);
        // archivos: el viejo se retira desde la v2 (sigue en la tabla) y el nuevo es de la v2
        const archivos = tablas.e_archivos_manual_puesto!;
        assert.equal(archivos.length, 2);
        assert.deepEqual(archivosDeVersion(archivos, 1).map((a) => a.name), ["a.pdf"]);
        assert.deepEqual(archivosDeVersion(archivos, 2).map((a) => a.name), ["b.pdf"]);
    });
    it("es idempotente por la versión de Guardify: reenviar la misma versión no duplica", async () => {
        const { dyn, tablas } = memoria({ e_manual_puesto: [manual()] });
        const a = await publicarNuevaVersion(dyn, tablas.e_manual_puesto![0], { externoVersionId: "ev2", description: "v2", ahoraIso: AHORA });
        const b = await publicarNuevaVersion(dyn, tablas.e_manual_puesto![0], { externoVersionId: "ev2", description: "v2", ahoraIso: AHORA });
        assert.deepEqual([a.creada, b.creada, b.version], [true, false, 2]);
        assert.equal(tablas.e_manual_puesto_version!.length, 1);
    });
    it("acepta el número de versión de Guardify pero nunca uno igual o menor a la vigente", async () => {
        const { dyn, tablas } = memoria({ e_manual_puesto: [manual()] });
        assert.equal((await publicarNuevaVersion(dyn, tablas.e_manual_puesto![0], { version: 5, ahoraIso: AHORA })).version, 5);
        await assert.rejects(publicarNuevaVersion(dyn, tablas.e_manual_puesto![0], { version: 5, ahoraIso: AHORA }), /mayor que la vigente/);
        await assert.rejects(publicarNuevaVersion(dyn, tablas.e_manual_puesto![0], { version: 2, ahoraIso: AHORA }), /mayor que la vigente/);
    });
    it("los archivos de una versión sin marca de versión (anteriores a esta función) son de la v1", () => {
        assert.equal(archivosDeVersion([{ name: "x" } as any], 1).length, 1);
        assert.equal(archivosDeVersion([{ name: "x" } as any], 3).length, 1);
    });
});

describe("asignaciones vigentes y entrega automática (issues #154 y #157)", () => {
    const hier = { puesto: 12, corpo: 4, contrato: 8, cliente: 2, empresa: 1, division: 3 };
    it("una asignación a unidades alcanza a quien está dentro de ellas (un código cubre todo lo que cuelga) y 'company'/'app_users' a todos", () => {
        assert.equal(asignacionAplica({ manual_puesto_id: 1, audience: "units", scope: "division:3" }, hier), true);
        assert.equal(asignacionAplica({ manual_puesto_id: 1, audience: "units", scope: "puesto:99,contrato:8" }, hier), true);
        assert.equal(asignacionAplica({ manual_puesto_id: 1, audience: "units", scope: "division:9" }, hier), false);
        assert.equal(asignacionAplica({ manual_puesto_id: 1, audience: "company" }, hier), true);
        assert.equal(asignacionAplica({ manual_puesto_id: 1, audience: "app_users" }, hier), true);
    });
    it("una asignación terminada, sin alcance o mal escrita no aplica", () => {
        assert.equal(asignacionAplica({ manual_puesto_id: 1, audience: "company", vigente: false }, hier), false);
        assert.equal(asignacionAplica({ manual_puesto_id: 1, audience: "units", scope: "" }, hier), false);
        assert.equal(asignacionAplica({ manual_puesto_id: 1, audience: "units", scope: "basura" }, hier), false);
        assert.equal(asignacionAplica({ manual_puesto_id: 1, audience: "otra" }, hier), false);
    });
    const base = () => memoria({
        e_manual_puesto: [{ id: 1, isActive: true, version: 1, puesto_id: 12 }, { id: 2, isActive: true, version: 3, puesto_id: 0 }, { id: 3, isActive: true, version: 1, puesto_id: 0 }, { id: 4, isActive: false, version: 1, puesto_id: 12 }],
        e_puestos_manual_puesto: [{ id: 1, manual_puesto_id: 3, puesto_id: 12 }],
        e_documento_asignacion: [{ id: 1, manual_puesto_id: 2, audience: "units", scope: "division:3", vigente: true }, { id: 2, manual_puesto_id: 1, audience: "company", vigente: false }],
        e_empleados_manual_puesto: [],
    });
    it("al marcar ingreso recibe los documentos de su puesto y los de las asignaciones vigentes, con la fecha de entrega", async () => {
        const { dyn, tablas } = base();
        const r = await entregarDocumentosPendientes(dyn, { empleadoId: 7, hier, ahoraIso: AHORA });
        assert.deepEqual([r.creados, r.actualizados], [3, 0]);
        const enlaces = tablas.e_empleados_manual_puesto!;
        assert.deepEqual(enlaces.map((e) => [e.manual_puesto_id, e.version, e.entregado_en, e.created_at, e.origen]).sort(), [[1, 1, AHORA, AHORA, "puesto"], [2, 3, AHORA, AHORA, "asignacion"], [3, 1, AHORA, AHORA, "puesto"]]);
        // el documento dado de baja (4) no se entrega
        assert.equal(enlaces.some((e) => e.manual_puesto_id === 4), false);
    });
    it("repetir el ingreso no duplica nada ni cambia la fecha de entrega original", async () => {
        const { dyn, tablas } = base();
        await entregarDocumentosPendientes(dyn, { empleadoId: 7, hier, ahoraIso: AHORA });
        const r = await entregarDocumentosPendientes(dyn, { empleadoId: 7, hier, ahoraIso: "2026-10-22T08:00:00" });
        assert.deepEqual([r.creados, r.actualizados], [0, 0]);
        assert.equal(tablas.e_empleados_manual_puesto!.length, 3);
        assert.equal(tablas.e_empleados_manual_puesto![0].created_at, AHORA);
    });
    it("una versión nueva se entrega de nuevo: sube la versión del vínculo y su fecha, conservando la entrega original", async () => {
        const { dyn, tablas } = base();
        await entregarDocumentosPendientes(dyn, { empleadoId: 7, hier, ahoraIso: AHORA });
        tablas.e_manual_puesto![0].version = 2;
        const r = await entregarDocumentosPendientes(dyn, { empleadoId: 7, hier, ahoraIso: "2026-10-22T08:00:00" });
        assert.deepEqual([r.creados, r.actualizados], [0, 1]);
        const v = tablas.e_empleados_manual_puesto!.find((e) => e.manual_puesto_id === 1)!;
        assert.deepEqual([v.version, v.entregado_en, v.created_at], [2, "2026-10-22T08:00:00", AHORA]);
    });
    it("quien entra después a un puesto con documentos asignados los recibe sin que nadie vuelva a enviar nada (y no los de otro puesto)", async () => {
        const { dyn, tablas } = base();
        await entregarDocumentosPendientes(dyn, { empleadoId: 99, hier: { ...hier, puesto: 12 }, ahoraIso: AHORA });
        assert.equal(tablas.e_empleados_manual_puesto!.filter((e) => e.empleado_id === 99).length, 3);
        const otro = await entregarDocumentosPendientes(dyn, { empleadoId: 100, hier: { puesto: 55, corpo: 9, contrato: 9, cliente: 9, empresa: 9, division: 9 }, ahoraIso: AHORA });
        assert.equal(otro.creados, 0);
    });
    it("nada se borra: quien deja el grupo conserva sus vínculos; terminar la asignación solo deja de entregar a quien entre después", async () => {
        const { dyn, tablas } = base();
        await entregarDocumentosPendientes(dyn, { empleadoId: 7, hier, ahoraIso: AHORA });
        tablas.e_documento_asignacion![0].vigente = false;
        const nuevo = await entregarDocumentosPendientes(dyn, { empleadoId: 8, hier: { ...hier, puesto: 55 }, ahoraIso: AHORA });
        assert.equal(nuevo.creados, 0);
        assert.equal(tablas.e_empleados_manual_puesto!.filter((e) => e.empleado_id === 7).length, 3);
    });
    it("entregar un documento a una lista de empleados: los que ya lo tienen en esa versión no se tocan", async () => {
        const { dyn, tablas } = memoria({ e_empleados_manual_puesto: [{ id: 1, manual_puesto_id: 9, empleado_id: 1, version: 2, created_at: "x", entregado_en: "x" }] });
        const r = await entregarDocumentoAEmpleados(dyn, { manual: { id: 9, version: 2 }, empleadoIds: [1, 2, 2, 3], ahoraIso: AHORA, origen: "guardify" });
        assert.deepEqual([r.creados, r.actualizados], [2, 0]);
        assert.deepEqual(tablas.e_empleados_manual_puesto!.map((e) => e.empleado_id).sort(), [1, 2, 3]);
    });
});
