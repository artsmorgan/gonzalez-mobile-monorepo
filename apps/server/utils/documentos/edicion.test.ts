import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { aplicarEdicionManual, destinatariosDelDocumento, EdicionError, mensajeNuevaVersion, normalizarQuiz, quizCambio, resumenQuiz, rolPuedeGestionar, validarEdicion, MAX_ARCHIVOS_NUEVOS, type EdicionEntrada } from "./edicion";
import { autorizarGestionManual, MENSAJE_ROL_SIN_EDICION } from "./permisosEdicion";
import type { Dyn } from "./service";

// Todo estructural: ids, textos genéricos y preguntas de la propia prueba; ningún dato de negocio.
const pregunta = (id: string, over: Record<string, unknown> = {}) => ({ id, title: `pregunta ${id}`, type: "short", answer: "r", points: 1, ...over });
const quiz = (qs: unknown[], min?: number) => JSON.stringify({ questions: qs, ...(min ? { minApprovalPercentage: min } : {}) });

/** Base en memoria con lo mínimo que usa el servicio: filtros por igualdad. */
function fakeDyn(tablas: Record<string, any[]> = {}) {
    const db: Record<string, any[]> = JSON.parse(JSON.stringify(tablas));
    const llamadas: Array<[string, string, unknown]> = [];
    const coincide = (row: any, where: any = {}) => Object.entries(where).every(([k, v]) => (v && typeof v === "object" && "in" in (v as any) ? (v as any).in.includes(row[k]) : row[k] === v));
    const dyn: Dyn = {
        async find(t, a = {}) {
            return (db[t] ?? []).filter((r) => coincide(r, a.where)).map((r) => ({ ...r }));
        },
        async create(t, data) {
            llamadas.push(["create", t, data]);
            const row = { id: (db[t] ?? []).length + 1, ...data };
            (db[t] ??= []).push(row);
            return row;
        },
        async update(t, where, data) {
            llamadas.push(["update", t, data]);
            const row = (db[t] ?? []).find((r) => r.id === where.id);
            if (row) Object.assign(row, data);
            return row;
        },
    };
    return { dyn, db, llamadas };
}

const manualBase = (over: Record<string, unknown> = {}) => ({ id: 1, title: "titulo", description: "descripcion", classification: null, quiz: quiz([pregunta("q1")], 70), version: 1, puesto_id: 5, created_by: 9, created_at: "2026-10-01T00:00:00.000Z", ...over });
const ctx = (archivos: Array<{ name: string; type: string; original_name: string; extension: string }> = []) => ({ ahoraIso: "2026-10-28T10:00:00.000Z", publicadoPor: "7", auditFields: { updated_at: "2026-10-28T10:00:00.000Z", updated_by: 7 }, archivosSubidos: archivos });
const edit = (over: Partial<EdicionEntrada> = {}): EdicionEntrada => ({ marcaId: 3, nuevaVersion: false, archivosNuevos: [], ...over });

describe("quién puede editar un documento", () => {
    it("rol distinto de OPERATIVO; sin rol o desconocido no", () => {
        for (const r of ["SUPERVISOR", "ADMINISTRATIVO", " supervisor "]) assert.equal(rolPuedeGestionar(r), true, r);
        for (const r of ["OPERATIVO", " operativo ", "", null, undefined]) assert.equal(rolPuedeGestionar(r), false, String(r));
    });
    const marcaPropia = { empleadoFijo_id: 7, empleadoReemplaza_id: null };
    it("niega sin marca (404), marca ajena y rol OPERATIVO; permite SUPERVISOR en su marca y al administrador", async () => {
        const rol = (r: string) => async () => r;
        assert.deepEqual(await autorizarGestionManual({ callerId: 7, marca: null, roleNameOfMarca: rol("SUPERVISOR") }), { allowed: false, status: 404, code: "not_found", message: "Marca no encontrada" });
        const ajena = await autorizarGestionManual({ callerId: 8, marca: marcaPropia, roleNameOfMarca: rol("SUPERVISOR") });
        assert.deepEqual([ajena.allowed, (ajena as any).status, (ajena as any).code], [false, 403, "permission_denied"]);
        const operativo = await autorizarGestionManual({ callerId: 7, marca: marcaPropia, roleNameOfMarca: rol("OPERATIVO") });
        assert.deepEqual([operativo.allowed, (operativo as any).message], [false, MENSAJE_ROL_SIN_EDICION]);
        assert.equal((await autorizarGestionManual({ callerId: 7, marca: marcaPropia, roleNameOfMarca: rol("SUPERVISOR") })).allowed, true);
        assert.equal((await autorizarGestionManual({ callerId: 7, marca: { empleadoFijo_id: 1, empleadoReemplaza_id: 7 }, roleNameOfMarca: rol("ADMINISTRATIVO") })).allowed, true, "quien reemplaza también");
        assert.equal((await autorizarGestionManual({ callerId: 8, marca: marcaPropia, roleNameOfMarca: rol("OPERATIVO"), isAdmin: async () => true })).allowed, true, "administrador");
    });
    it("si no se puede saber el rol o si es administrador, se niega (nunca se concede por error)", async () => {
        const roto = await autorizarGestionManual({ callerId: 7, marca: marcaPropia, roleNameOfMarca: async () => { throw new Error("sin base"); } });
        assert.equal(roto.allowed, false);
        const adminRoto = await autorizarGestionManual({ callerId: 8, marca: marcaPropia, roleNameOfMarca: async () => "SUPERVISOR", isAdmin: async () => { throw new Error("sin base"); } });
        assert.equal(adminRoto.allowed, false);
        const idsRaros = await autorizarGestionManual({ callerId: "7; DROP", marca: marcaPropia, roleNameOfMarca: async () => "SUPERVISOR" });
        assert.equal(idsRaros.allowed, false);
    });
});

describe("quiz: lectura y comparación", () => {
    it("el mismo quiz escrito de otra forma no cuenta como cambio; un puntaje, una pregunta o el mínimo sí", () => {
        const a = quiz([pregunta("q1"), pregunta("q2", { type: "multiple_choice", options: ["x", "y"], answer: "x" })], 70);
        const reordenado = JSON.stringify({ minApprovalPercentage: 70, questions: [{ points: 1, answer: "r", type: "short", title: "pregunta q1", id: "q1" }, { points: 1, answer: "x", options: ["x", "y"], type: "multiple_choice", title: "pregunta q2", id: "q2" }] });
        assert.equal(quizCambio(a, reordenado), false);
        assert.equal(quizCambio(a, quiz([pregunta("q1", { points: 2 }), pregunta("q2", { type: "multiple_choice", options: ["x", "y"], answer: "x" })], 70)), true);
        assert.equal(quizCambio(a, quiz([pregunta("q1")], 70)), true);
        assert.equal(quizCambio(a, a.replace('"minApprovalPercentage":70', '"minApprovalPercentage":80')), true);
    });
    it("sin quiz, null, vacío y «sin preguntas» son lo mismo; el formato antiguo (lista) se entiende", () => {
        for (const vacio of [null, undefined, "", "   ", "{}", quiz([]), "no es json"]) assert.equal(quizCambio(null, vacio), false, String(vacio));
        assert.equal(quizCambio(null, quiz([pregunta("q1")])), true);
        assert.equal(quizCambio(JSON.stringify([pregunta("q1")]), quiz([pregunta("q1")])), false);
        assert.equal(normalizarQuiz(quiz([pregunta("q1")]))?.questions.length, 1);
    });
    it("resumen legible para la bitácora", () => {
        assert.equal(resumenQuiz(null), "Sin quiz");
        assert.equal(resumenQuiz(quiz([pregunta("q1"), pregunta("q2")], 80)), "2 pregunta(s), aprobación mínima 80 %");
    });
});

describe("validación de lo que manda la app", () => {
    const ok = (body: any) => validarEdicion({ marca_id: 3, ...body });
    it("exige marca; título y descripción no pueden quedar vacíos; la clasificación vacía es «sin clasificar»", () => {
        assert.equal((validarEdicion({}) as any).message, "Marca inválida");
        assert.equal((ok({ title: "  " }) as any).message, "El título es obligatorio");
        assert.equal((ok({ description: "" }) as any).message, "La descripción es obligatoria");
        assert.equal((ok({ title: "x".repeat(301) }) as any).ok, false);
        const r: any = ok({ title: "  t ", description: " d ", classification: "  " });
        assert.deepEqual([r.ok, r.edicion.title, r.edicion.description, r.edicion.classification, r.edicion.nuevaVersion], [true, "t", "d", null, false]);
        assert.equal(ok({ classification: 5 }).ok, false);
    });
    it("lo que no se manda no cambia; nueva_version solo vale con `true` exacto (por defecto NO)", () => {
        const r: any = ok({});
        assert.deepEqual([r.edicion.title, r.edicion.quiz, r.edicion.classification, r.edicion.nuevaVersion], [undefined, undefined, undefined, false]);
        for (const v of ["true", 1, "si", null]) assert.equal((ok({ nueva_version: v }) as any).edicion.nuevaVersion, false, String(v));
        assert.equal((ok({ nueva_version: true }) as any).edicion.nuevaVersion, true);
    });
    it("el quiz se valida pregunta por pregunta con las mismas reglas del formulario y se guarda normalizado", () => {
        assert.equal((ok({ quiz: "{" }) as any).message, "El quiz no tiene un formato válido");
        assert.match((ok({ quiz: quiz([pregunta("q1", { answer: "" })]) }) as any).message, /Pregunta 1 del quiz: falta la respuesta correcta/);
        assert.match((ok({ quiz: quiz([pregunta("q1", { type: "multiple_choice", options: [], answer: "x" })]) }) as any).message, /faltan las opciones/);
        assert.match((ok({ quiz: quiz([pregunta("q1", { type: "multiple_select", options: ["a"], answers: [] })]) }) as any).message, /faltan las respuestas correctas/);
        assert.match((ok({ quiz: quiz([pregunta("q1", { points: -1 })]) }) as any).message, /puntaje inválido/);
        assert.match((ok({ quiz: quiz([pregunta("q1", { type: "otro" })]) }) as any).message, /tipo desconocido/);
        assert.match((ok({ quiz: quiz([pregunta("q1"), pregunta("q1")]) }) as any).message, /id está repetido/);
        const bueno: any = ok({ quiz: quiz([pregunta("q1")], 60) });
        assert.deepEqual(JSON.parse(bueno.edicion.quiz), { questions: [pregunta("q1")], minApprovalPercentage: 60 });
        for (const vacio of [null, "", quiz([])]) assert.equal((ok({ quiz: vacio }) as any).edicion.quiz, null, "quitar el quiz");
    });
    it("archivos nuevos: tipo, extensión y contenido válidos, y un máximo por edición", () => {
        const f = (over: object = {}) => ({ type: "document", extension: "pdf", original_name: "a.pdf", file_base64: "AAAA", ...over });
        const bueno: any = ok({ newFiles: JSON.stringify([f(), f({ type: "image", extension: ".png", original_name: "" })]) });
        assert.deepEqual(bueno.edicion.archivosNuevos.map((a: any) => [a.type, a.extension, a.original_name]), [["document", "pdf", "a.pdf"], ["image", "png", "archivo.png"]]);
        assert.match((ok({ newFiles: JSON.stringify([f({ type: "exe" })]) }) as any).message, /tipo no permitido/);
        assert.match((ok({ newFiles: JSON.stringify([f({ extension: "../x" })]) }) as any).message, /extensión no válida/);
        assert.match((ok({ newFiles: JSON.stringify([f({ file_base64: "" })]) }) as any).message, /está vacío/);
        assert.equal((ok({ newFiles: "no json" }) as any).message, "Formato de archivos inválido");
        assert.equal((ok({ newFiles: JSON.stringify({}) }) as any).message, "Formato de archivos inválido");
        assert.equal(ok({ newFiles: JSON.stringify(Array.from({ length: MAX_ARCHIVOS_NUEVOS + 1 }, () => f())) }).ok, false);
        assert.equal((ok({ newFiles: "" }) as any).edicion.archivosNuevos.length, 0);
    });
});

describe("aplicar la edición", () => {
    it("SIN nueva versión: corrige los datos en el mismo registro, los archivos nuevos son de la versión vigente y no se toca el histórico", async () => {
        const { dyn, db } = fakeDyn({ e_manual_puesto: [manualBase({ version: 3 })], e_archivos_manual_puesto: [], e_manual_puesto_version: [] });
        const r = await aplicarEdicionManual(dyn, manualBase({ version: 3 }), edit({ title: "titulo nuevo", classification: "clase" }), ctx([{ name: "f1.pdf", type: "document", original_name: "uno.pdf", extension: "pdf" }]));
        assert.deepEqual([r.version, r.versionCambio, r.quizCambio, r.sinCambios], [3, false, false, false]);
        assert.equal(db.e_manual_puesto![0].title, "titulo nuevo");
        assert.equal(db.e_manual_puesto![0].classification, "clase");
        assert.equal(db.e_manual_puesto![0].description, "descripcion", "lo que no se manda no cambia");
        assert.equal(db.e_manual_puesto![0].version, 3);
        assert.equal(db.e_manual_puesto![0].updated_by, 7, "queda quién y cuándo");
        assert.deepEqual(db.e_archivos_manual_puesto!.map((a) => [a.name, a.version, a.manual_puesto_id]), [["f1.pdf", 3, 1]]);
        assert.equal(db.e_manual_puesto_version!.length, 0);
        assert.deepEqual(r.cambios.map((c) => c.prop), ["title", "classification", "archivos_agregados"]);
        assert.deepEqual(r.cambios[0], { prop: "title", before: "titulo", after: "titulo nuevo" });
    });
    it("sin nada que cambiar no escribe nada", async () => {
        const { dyn, llamadas } = fakeDyn({ e_manual_puesto: [manualBase()] });
        const r = await aplicarEdicionManual(dyn, manualBase(), edit({ title: "titulo", description: "descripcion", classification: null, quiz: manualBase().quiz }), ctx());
        assert.equal(r.sinCambios, true);
        assert.equal(llamadas.length, 0);
    });
    it("modificar el quiz SIN nueva versión se rechaza y no escribe nada (camino A)", async () => {
        const { dyn, llamadas } = fakeDyn({ e_manual_puesto: [manualBase()] });
        await assert.rejects(() => aplicarEdicionManual(dyn, manualBase(), edit({ quiz: quiz([pregunta("q1", { points: 5 })], 70) }), ctx()), (e: unknown) => e instanceof EdicionError && e.code === "quiz_requires_new_version" && e.status === 400);
        assert.equal(llamadas.length, 0);
    });
    it("un quiz igual al actual no exige nueva versión", async () => {
        const { dyn } = fakeDyn({ e_manual_puesto: [manualBase()] });
        const r = await aplicarEdicionManual(dyn, manualBase(), edit({ quiz: manualBase().quiz, description: "otra" }), ctx());
        assert.deepEqual([r.versionCambio, r.quizCambio], [false, false]);
    });
    it("CON nueva versión: la vigente pasa al histórico (con su quiz), la versión sube, el quiz nuevo queda y los archivos nuevos son de la versión nueva", async () => {
        const viejo = manualBase({ version: 2, quiz: quiz([pregunta("q1")], 70) });
        const { dyn, db } = fakeDyn({ e_manual_puesto: [viejo], e_archivos_manual_puesto: [], e_manual_puesto_version: [] });
        const nuevoQuiz = quiz([pregunta("q1", { points: 4 }), pregunta("q2")], 80);
        const r = await aplicarEdicionManual(dyn, viejo, edit({ nuevaVersion: true, title: "titulo v3", quiz: nuevoQuiz }), ctx([{ name: "f2.pdf", type: "document", original_name: "dos.pdf", extension: "pdf" }]));
        assert.deepEqual([r.version, r.versionCambio, r.quizCambio], [3, true, true]);
        assert.equal(db.e_manual_puesto![0].version, 3);
        assert.equal(db.e_manual_puesto![0].title, "titulo v3");
        assert.equal(db.e_manual_puesto![0].quiz, nuevoQuiz);
        assert.equal(db.e_manual_puesto![0].updated_by, 7);
        assert.deepEqual(db.e_manual_puesto_version!.map((v) => [v.manual_puesto_id, v.version, v.title, v.quiz]), [[1, 2, "titulo", viejo.quiz]], "el quiz original se consulta aquí");
        assert.deepEqual(db.e_archivos_manual_puesto!.map((a) => [a.name, a.version]), [["f2.pdf", 3]]);
        assert.deepEqual(r.cambios.map((c) => c.prop), ["title", "quiz", "archivos_agregados", "version"]);
        assert.deepEqual(r.cambios.at(-1), { prop: "version", before: 2, after: 3 });
        assert.deepEqual(r.cambios.find((c) => c.prop === "quiz"), { prop: "quiz", before: "1 pregunta(s), aprobación mínima 70 %", after: "2 pregunta(s), aprobación mínima 80 %" });
    });
    it("nueva versión sin otros cambios también vale (todos deben volver a firmar) y quitar el quiz es modificarlo", async () => {
        const { dyn, db } = fakeDyn({ e_manual_puesto: [manualBase()], e_manual_puesto_version: [] });
        const sola = await aplicarEdicionManual(dyn, manualBase(), edit({ nuevaVersion: true }), ctx());
        assert.deepEqual([sola.version, sola.versionCambio, sola.quizCambio, sola.sinCambios], [2, true, false, false]);
        const sinQuiz = fakeDyn({ e_manual_puesto: [manualBase()], e_manual_puesto_version: [] });
        await assert.rejects(() => aplicarEdicionManual(sinQuiz.dyn, manualBase(), edit({ quiz: null }), ctx()), EdicionError);
        const quitado = await aplicarEdicionManual(sinQuiz.dyn, manualBase(), edit({ quiz: null, nuevaVersion: true }), ctx());
        assert.equal(quitado.quizCambio, true);
        assert.equal(sinQuiz.db.e_manual_puesto![0].quiz, null);
        assert.equal(db.e_manual_puesto![0].version, 2);
    });
});

describe("notificación y destinatarios de la nueva versión", () => {
    it("el mensaje dice la versión, que deben volver a verlo y firmarlo y, si aplica, que cambió el quiz", () => {
        const m = mensajeNuevaVersion("doc", 4, false);
        assert.equal(m.title, "Documento actualizado");
        assert.match(m.description, /«doc».*nueva versión \(v4\)\. Debes volver a visualizarlo y firmarlo\./);
        assert.equal(m.description.includes("quiz"), false);
        assert.match(mensajeNuevaVersion("doc", 4, true).description, /Incluye cambios en el quiz\./);
    });
    it("destinatarios: el puesto principal, los puestos vinculados y los empleados con el documento, sin repetidos ni ids inválidos", async () => {
        const { dyn } = fakeDyn({ e_puestos_manual_puesto: [{ id: 1, manual_puesto_id: 1, puesto_id: 5 }, { id: 2, manual_puesto_id: 1, puesto_id: 6 }, { id: 3, manual_puesto_id: 2, puesto_id: 99 }], e_empleados_manual_puesto: [{ id: 1, manual_puesto_id: 1, empleado_id: 20 }, { id: 2, manual_puesto_id: 1, empleado_id: 20 }, { id: 3, manual_puesto_id: 1, empleado_id: 21 }, { id: 4, manual_puesto_id: 7, empleado_id: 22 }] });
        const d = await destinatariosDelDocumento(dyn, manualBase({ puesto_id: 5 }));
        assert.deepEqual(d, { puestoIds: [5, 6], empleadoIds: [20, 21] });
        assert.deepEqual(await destinatariosDelDocumento(dyn, manualBase({ id: 8, puesto_id: null })), { puestoIds: [], empleadoIds: [] });
    });
});
