import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { quizCambio } from "./edicion";
import { stripComments } from "../routeAudit";
import { emptyDraft, newQuestionId, parseQuiz, questionFromDraft, quizChanged, quizSummary, serializeQuiz, validateDraft } from "../../../mobile/hooks/jobManualQuiz";
import { buildEditBody, canEditManual, describeEditResult, effectiveNewVersion, formFromManual, isQuizModified, newVersionWarning, validateEditForm, NEW_VERSION_QUESTION, QUIZ_FORCES_VERSION_NOTE, type EditableManual } from "../../../mobile/hooks/jobManualEdit";

// Todo estructural: ids, textos genéricos y preguntas de la propia prueba; ningún dato de negocio.
const mobile = path.join(__dirname, "..", "..", "..", "mobile");
const leer = (rel: string) => stripComments(fs.readFileSync(path.join(mobile, rel), "utf8"));
const q = (id: string, over: Record<string, unknown> = {}) => ({ id, title: `pregunta ${id}`, type: "short", answer: "r", points: 1, ...over });
const quiz = (qs: unknown[], min?: number) => JSON.stringify({ questions: qs, ...(min ? { minApprovalPercentage: min } : {}) });
const manual = (over: Partial<EditableManual> = {}): EditableManual => ({ id: 10, title: "titulo", description: "descripcion", classification: null, quiz: quiz([q("a")]), version: 2, ...over });

describe("quién ve el botón «Editar» (misma regla que «Act. puestos»)", () => {
    it("rol distinto de OPERATIVO y documento ya en el servidor", () => {
        assert.equal(canEditManual("SUPERVISOR", manual()), true);
        assert.equal(canEditManual("ADMINISTRATIVO", manual()), true);
        assert.equal(canEditManual(null, manual()), true, "igual que los botones de puestos y empleados: solo se oculta a OPERATIVO");
        assert.equal(canEditManual("OPERATIVO", manual()), false);
        assert.equal(canEditManual("SUPERVISOR", manual({ id_local: "x" })), false, "creado sin conexión y sin sincronizar");
        assert.equal(canEditManual("SUPERVISOR", manual({ synced: false })), false);
        assert.equal(canEditManual("SUPERVISOR", manual({ id: 0 })), false);
        assert.equal(canEditManual("SUPERVISOR", manual({ isActive: false })), false);
    });
});

describe("el teléfono y el servidor deciden igual si el quiz cambió", () => {
    const casos: Array<[string, unknown, unknown]> = [
        ["igual", quiz([q("a")], 70), quiz([q("a")], 70)],
        ["otro orden de claves", quiz([q("a")], 70), JSON.stringify({ minApprovalPercentage: 70, questions: [{ points: 1, answer: "r", type: "short", title: "pregunta a", id: "a" }] })],
        ["puntaje distinto", quiz([q("a")]), quiz([q("a", { points: 3 })])],
        ["pregunta agregada", quiz([q("a")]), quiz([q("a"), q("b")])],
        ["mínimo distinto", quiz([q("a")], 70), quiz([q("a")], 80)],
        ["mínimo que antes no estaba", quiz([q("a")]), quiz([q("a")], 70)],
        ["sin quiz contra nulo", null, null],
        ["sin quiz contra vacío", null, ""],
        ["sin quiz contra sin preguntas", null, quiz([])],
        ["sin quiz contra uno nuevo", null, quiz([q("a")])],
        ["formato antiguo contra nuevo", JSON.stringify([q("a")]), quiz([q("a")])],
        ["opciones distintas", quiz([q("a", { type: "multiple_choice", options: ["x", "y"], answer: "x" })]), quiz([q("a", { type: "multiple_choice", options: ["x", "z"], answer: "x" })])],
        ["ilegible contra nada", "no es json", null],
    ];
    for (const [nombre, a, b] of casos) {
        it(nombre, () => assert.equal(quizChanged(a, b), quizCambio(a, b)));
    }
});

describe("quiz en la app: lectura, borrador y validación", () => {
    it("lee el quiz guardado sin inventar el mínimo, y lo serializa igual al formulario de creación", () => {
        const c = parseQuiz(quiz([q("a"), q("b", { type: "multiple_select", options: ["x", "y"], answers: ["x"] })]));
        assert.equal(c.questions.length, 2);
        assert.equal(c.minApprovalPercentage, undefined, "si el quiz no lo fijó, no se inventa 70 (sería un cambio falso)");
        assert.deepEqual(JSON.parse(serializeQuiz({ questions: c.questions, minApprovalPercentage: 60 })!), { questions: c.questions, minApprovalPercentage: 60 });
        assert.equal(serializeQuiz({ questions: [] }), null);
        assert.equal(quizSummary(parseQuiz(quiz([q("a", { points: 2 })], 80))), "1 pregunta(s) · 2 punto(s) · aprobación mínima 80 %");
        assert.equal(quizSummary({ questions: [] }), "Sin quiz");
    });
    it("el borrador exige lo mismo que el formulario de creación", () => {
        const d = (over: object = {}) => ({ ...emptyDraft(), title: "t", answer: "r", points: "1", ...over });
        assert.equal(validateDraft(d()), null);
        assert.equal(validateDraft(d({ title: " " })), "El título de la pregunta es obligatorio");
        assert.equal(validateDraft(d({ type: "multiple_choice", options: [] })), "Debes agregar al menos una opción");
        assert.equal(validateDraft(d({ type: "multiple_choice", options: ["x"], answer: "" })), "Selecciona la respuesta correcta");
        assert.equal(validateDraft(d({ type: "multiple_select", options: ["x"], answers: [] })), "Selecciona al menos una respuesta correcta");
        assert.equal(validateDraft(d({ answer: "" })), "Debes indicar la respuesta correcta");
        assert.equal(validateDraft(d({ points: "" })), "El puntaje es obligatorio");
        assert.equal(validateDraft(d({ points: "-1" })), "El puntaje debe ser un número válido mayor o igual a 0");
    });
    it("al editar una pregunta se conserva su id; una nueva recibe uno con el mismo formato", () => {
        const draft = { ...emptyDraft(), title: " nueva ", type: "list" as const, options: ["x", "y"], answer: "y", points: "2.5" };
        assert.deepEqual(questionFromDraft(draft, "q_fijo"), { id: "q_fijo", title: "nueva", type: "list", options: ["x", "y"], answer: "y", answers: undefined, points: 2.5 });
        assert.match(newQuestionId(), /^q_[A-Za-z0-9]{8}$/);
    });
    it("lo que lo servidor aceptará (validarEdicion) coincide con lo que el formulario produce", async () => {
        const { validarEdicion } = await import("./edicion");
        const draft = { ...emptyDraft(), title: "p", type: "multiple_select" as const, options: ["x", "y"], answers: ["x"], points: "1" };
        const r: any = validarEdicion({ marca_id: 1, quiz: serializeQuiz({ questions: [questionFromDraft(draft, newQuestionId())], minApprovalPercentage: 70 }) });
        assert.equal(r.ok, true, r.message);
    });
});

describe("armado de lo que se envía al guardar", () => {
    it("sin tocar nada no hay cambios; solo viaja lo que cambió y siempre la marca", () => {
        const m = manual();
        const sin = buildEditBody({ manual: m, form: formFromManual(m), marcaId: 7, files: [] });
        assert.deepEqual(sin, { body: { marca_id: 7 }, hasChanges: false });
        const f = { ...formFromManual(m), title: " nuevo ", classification: "clase" };
        const r = buildEditBody({ manual: m, form: f, marcaId: 7, files: [] });
        assert.deepEqual(r.body, { marca_id: 7, title: "nuevo", classification: "clase" });
        assert.equal(r.hasChanges, true);
        const sinClase = buildEditBody({ manual: manual({ classification: "clase" }), form: { ...formFromManual(manual({ classification: "clase" })), classification: "" }, marcaId: 7, files: [] });
        assert.equal(sinClase.body.classification, null, "«sin clasificar» viaja como null");
    });
    it("el quiz solo viaja si cambió, y modificarlo fuerza la nueva versión aunque el usuario no la haya pedido", () => {
        const m = manual();
        const igual = formFromManual(m);
        assert.equal(isQuizModified(m, igual), false);
        assert.equal(effectiveNewVersion(m, igual), false, "por defecto NO");
        assert.equal("quiz" in buildEditBody({ manual: m, form: igual, marcaId: 1, files: [] }).body, false);
        const cambiado = { ...igual, quiz: { ...igual.quiz, questions: [{ ...igual.quiz.questions[0]!, points: 9 }] } };
        assert.equal(isQuizModified(m, cambiado), true);
        assert.equal(effectiveNewVersion(m, cambiado), true);
        const r = buildEditBody({ manual: m, form: cambiado, marcaId: 1, files: [] });
        assert.deepEqual([r.body.nueva_version, typeof r.body.quiz], [true, "string"]);
        const quitado = { ...igual, quiz: { questions: [] } };
        assert.equal(buildEditBody({ manual: m, form: quitado, marcaId: 1, files: [] }).body.quiz, null, "quitar el quiz también es modificarlo");
    });
    it("«nueva versión: Sí» viaja aunque no haya otros cambios (todos vuelven a firmar); sin elegirla no viaja", () => {
        const m = manual();
        const si = buildEditBody({ manual: m, form: { ...formFromManual(m), newVersion: true }, marcaId: 1, files: [] });
        assert.deepEqual(si, { body: { marca_id: 1, nueva_version: true }, hasChanges: true });
        const files = [{ type: "document" as const, extension: "pdf", original_name: "a.pdf", file_base64: "AAAA" }];
        const conArchivos = buildEditBody({ manual: m, form: formFromManual(m), marcaId: 1, files });
        assert.equal("nueva_version" in conArchivos.body, false, "agregar archivos NO obliga a firmar de nuevo");
        assert.deepEqual(JSON.parse(conArchivos.body.newFiles as string), files);
    });
    it("título y descripción obligatorios; el mensaje de la advertencia dice la versión y lo que pasará", () => {
        assert.equal(validateEditForm({ ...formFromManual(manual()), title: " " }), "El título es obligatorio");
        assert.equal(validateEditForm({ ...formFromManual(manual()), description: "" }), "La descripción es obligatoria");
        assert.equal(validateEditForm(formFromManual(manual())), null);
        const w = newVersionWarning(3);
        assert.match(w, /versión 3/);
        assert.match(w, /volver a visualizarlo y a firmarlo/);
        assert.match(w, /notificación/);
        assert.match(QUIZ_FORCES_VERSION_NOTE, /quiz[\s\S]*nueva versión/);
        assert.equal(NEW_VERSION_QUESTION, "¿Los cambios suponen una nueva versión del documento?");
    });
    it("el resultado se cuenta según lo que respondió el servidor", () => {
        assert.equal(describeEditResult({ status: true, sin_cambios: true }).title, "Sin cambios");
        const v = describeEditResult({ status: true, version_cambio: true, version: 4, notificados: { plazas: 2, empleados: 1, ok: true } });
        assert.deepEqual([v.title, /versión 4/.test(v.message), /recibieron una notificación/.test(v.message)], ["Nueva versión publicada", true, true]);
        assert.match(describeEditResult({ status: true, version_cambio: true, version: 4, notificados: { plazas: 0, empleados: 0, ok: false } }).message, /No se pudo enviar la notificación/);
        assert.equal(describeEditResult({ status: true, message: "listo" }).title, "Documento actualizado");
    });
});

describe("la pantalla «Documentos»: cableado de la edición", () => {
    const screen = leer("screens/JobManualsScreen.tsx");
    const modal = leer("components/JobManualEditModal.tsx");
    const fns = leer("hooks/jobManualsFunctions.ts");

    it("la versión se ve SIEMPRE en la lista (también la v1), no solo a partir de la v2", () => {
        assert.match(screen, /Versión \{manual\.version \?\? 1\}/);
        assert.equal(/manual\.version && manual\.version > 1/.test(screen), false, "ya no depende de que sea mayor que 1");
    });
    it("«Editar» es el botón LARGO debajo de «Act. puestos» y «Act. empleados» (mismo bloque: rol distinto de OPERATIVO) y exige conexión, marca y documento sincronizado", () => {
        const i = screen.indexOf("roleName !== 'OPERATIVO' && (");
        const puestos = screen.indexOf("openUpdManualPuestosModal(manual)", i);
        const empleados = screen.indexOf("openUpdManualEmpleadosModal(manual)", i);
        const fila = screen.indexOf("</ThemedView>", empleados);
        const editar = screen.indexOf("openEditManual(manual)", i);
        assert.ok(i > 0 && puestos > i && empleados > puestos, "primero «Act. puestos» y «Act. empleados»");
        assert.ok(editar > fila, "«Editar» va DEBAJO de esa fila, no dentro de ella");
        assert.ok(editar < screen.indexOf("</>", editar), "…y dentro del mismo bloque de rol");
        const estilo = screen.indexOf("manualEditButton: {");
        assert.ok(estilo > 0);
        assert.match(screen.slice(estilo, estilo + 400), /width: '100%'/, "ocupa todo el ancho");
        const f = screen.indexOf("const openEditManual = async");
        const cuerpo = screen.slice(f, screen.indexOf("const closeCambiosModal", f));
        assert.match(cuerpo, /canEditManual\(roleName, manual\)/);
        assert.match(cuerpo, /!hasMarca \|\| !marcaId/);
        assert.match(cuerpo, /getConnectionStatus\(\)/);
        assert.match(cuerpo, /OFFLINE_EDIT_MESSAGE/);
    });
    it("la edición NO pasa por la cola ni la sincronización: llama directo al servidor", () => {
        assert.equal(/queue|Queue|enqueue|AsyncStorage/.test(modal), false);
        assert.match(fns, /\/api\/job-manuals\/\$\{id\}\/edit/);
        assert.match(fns, /\/api\/job-manuals\/\$\{id\}\/files\/\$\{fileId\}\?marca_id=/);
        assert.match(fns, /method: 'DELETE'/);
    });
    it("al elegir «Sí» en nueva versión se muestra la advertencia (y «No» es el valor por defecto)", () => {
        const f = modal.indexOf("const chooseNewVersion");
        const cuerpo = modal.slice(f, modal.indexOf("const submit", f));
        assert.match(cuerpo, /Alert\.alert\(NEW_VERSION_WARNING_TITLE, newVersionWarning\(nextVersion\)/);
        assert.match(cuerpo, /update\(\{ newVersion: true \}\)/);
        assert.match(cuerpo, /text: 'Cancelar', style: 'cancel'/, "puede arrepentirse y queda en No");
        assert.match(fs.readFileSync(path.join(mobile, "hooks/jobManualEdit.ts"), "utf8"), /newVersion: false/);
        assert.match(modal, /\{quizModified \? <ThemedText style=\{styles\.warning\}>\{QUIZ_FORCES_VERSION_NOTE\}/);
    });
    it("borrar un archivo pide confirmación y lo borra al instante, sin esperar a «Aceptar»", () => {
        const f = modal.indexOf("const deleteExisting");
        const cuerpo = modal.slice(f, modal.indexOf("/** «Sí» pide enterarse", f));
        assert.match(cuerpo, /DELETE_FILE_CONFIRM/);
        assert.match(cuerpo, /deleteJobManualFile\(/);
        assert.match(cuerpo, /setFiles\(\(prev\) => prev\.filter/);
        assert.match(cuerpo, /onFileDeleted\(\)/);
        // «Aceptar» (submit) no vuelve a tocar los archivos existentes.
        const s = modal.indexOf("const submit");
        assert.equal(/deleteJobManualFile/.test(modal.slice(s, modal.indexOf("return (", s))), false);
    });
    it("los archivos nuevos pasan por el almacenamiento de la app y se suben solo al pulsar «Aceptar»; se limpian al cancelar", () => {
        assert.match(modal, /saveFile\(\{[^}]*prefix: 'job_manuals_e'/);
        assert.match(modal, /getFile\(f\.localFileName\)/);
        assert.match(modal, /cleanupStaged\(staged\)/);
        assert.match(modal, /editJobManual\(\{ id: manual\.id, body, refreshAccessToken, logout \}\)/);
    });
    it("el formulario de edición no pide la firma del responsable ni toca puestos ni empleados", () => {
        assert.equal(/firma_responsable|SignatureScreen|getCurrentUserDigitalSignature|signatureHash/.test(modal), false);
        assert.equal(/appendJobManual|puestos_ids|empleados_ids|EmployeeSearch|selectedPuestos/.test(modal), false);
    });
    it("el formulario es una ventana flotante con el diseño de los demás formularios de «Documentos»", () => {
        assert.match(modal, /<Modal visible=\{visible\} transparent animationType="fade"/, "ventana flotante, no pantalla completa");
        const css = fs.readFileSync(path.join(mobile, "components/JobManualEditModal.tsx"), "utf8");
        // Mismos valores que modalOverlay, updPuestosModalContainer, formLabel, formInput y los botones de Cancelar/Aceptar de JobManualsScreen.
        for (const v of ["backgroundColor: 'rgba(0,0,0,0.5)'", "maxWidth: 560", "maxHeight: '88%'", "borderRadius: 12", "borderColor: '#E0E0E0'", "backgroundColor: '#FF3B30'", "backgroundColor: '#34C759'", "backgroundColor: '#007AFF'"]) assert.ok(css.includes(v), v);
        const pantalla = fs.readFileSync(path.join(mobile, "screens/JobManualsScreen.tsx"), "utf8");
        for (const v of ["backgroundColor: 'rgba(0,0,0,0.5)'", "maxWidth: 560", "maxHeight: '88%'", "backgroundColor: '#FF3B30'", "backgroundColor: '#34C759'"]) assert.ok(pantalla.includes(v), `la pantalla ya no tiene ${v}: actualizar la ventana de edición`);
        // El quiz se edita dentro de la misma ventana (sin un segundo modal encima).
        assert.equal(/<Modal/.test(leer("components/JobManualQuizEditor.tsx")), false);
    });
    it("los archivos del documento se ven en el formulario: imágenes se ven, audio y video se reproducen, el resto se descarga", () => {
        const vista = leer("components/ManualFilePreview.tsx");
        for (const c of ["ManualImageViewer", "ManualAudioPlayer", "ManualVideoPlayer"]) assert.match(vista, new RegExp(`export function ${c}\\(`), c);
        // El formulario usa los MISMOS componentes que el visor de la pantalla (no una copia).
        assert.match(modal, /import \{ ManualAudioPlayer, ManualImageViewer, ManualVideoPlayer \} from '\.\/ManualFilePreview'/);
        const f = modal.indexOf("const renderPreview");
        const cuerpo = modal.slice(f, modal.indexOf("/** Borrado inmediato", f));
        assert.match(cuerpo, /type === 'image'\) return <ManualImageViewer imageUrl=\{url\} \/>/);
        assert.match(cuerpo, /type === 'audio'\) return <ManualAudioPlayer sourceUrl=\{url\} \/>/);
        assert.match(cuerpo, /type === 'video'\) return <ManualVideoPlayer sourceUrl=\{url\} \/>/);
        assert.match(cuerpo, /Descargar/);
        // Cada archivo existente se muestra con la URL del servidor (la misma del visor) y se puede descargar.
        assert.match(modal, /renderPreview\(f\.type, buildFileUrl\(f\), \(\) => void downloadFile\(f\)\)/);
        assert.match(screen, /buildFileUrl=\{\(f\) => buildFileUrl\(manualToEdit\?\.id, \{ \.\.\.f, url: '' \}\)\}/);
        // Los archivos nuevos (todavía locales) también se pueden ver y reproducir antes de subirlos.
        assert.match(modal, /renderPreview\(f\.type, getLocalFileDisplayUri\(f\.localFileName\)\)/);
    });
    it("la descarga usa el mismo mecanismo que el visor de documentos y exige conexión", () => {
        const f = modal.indexOf("const downloadFile");
        const cuerpo = modal.slice(f, modal.indexOf("/** Vista del archivo", f));
        assert.match(cuerpo, /isOnline\(\)/);
        assert.match(cuerpo, /downloadAuthedUrlToDevice\(\{ url, fallbackFileName: f\.original_name \|\| f\.name, tempPrefix: 'job_manual_edit_file', refreshAccessToken, logout \}\)/);
        assert.match(cuerpo, /result\.cancelled/);
    });
    it("los reproductores y el visor se movieron a un componente compartido y la pantalla los sigue usando igual", () => {
        assert.equal(/^function Manual(Audio|Image|Video)/m.test(screen), false, "ya no se definen dentro de la pantalla");
        assert.match(screen, /import \{ ManualAudioPlayer, ManualImageViewer, ManualVideoPlayer \} from '\.\.\/components\/ManualFilePreview'/);
        assert.ok((screen.match(/<ManualImageViewer/g) ?? []).length >= 2, "el visor de documentos sigue mostrando imágenes");
        assert.ok((screen.match(/<ManualAudioPlayer/g) ?? []).length >= 2, "…audios");
        assert.ok((screen.match(/<ManualVideoPlayer/g) ?? []).length >= 2, "…y videos");
        const vista = leer("components/ManualFilePreview.tsx");
        // Mismos valores visuales que tenían en la pantalla.
        for (const v of ["height: 180", "backgroundColor: '#F0F0F0'", "marginVertical: 12", "borderColor: '#DDD'", "backgroundColor: '#007AFF'"]) assert.ok(vista.includes(v), v);
    });
    it("el formulario tiene título, descripción, clasificación, archivos, quiz y la pregunta de nueva versión", () => {
        for (const txt of ["Título *", "Descripción *", "Clasificación (opcional)", "Agregar archivos nuevos", "<JobManualQuizEditor", "NEW_VERSION_QUESTION", "Aceptar", "Cancelar"]) assert.ok(modal.includes(txt), txt);
    });
});
