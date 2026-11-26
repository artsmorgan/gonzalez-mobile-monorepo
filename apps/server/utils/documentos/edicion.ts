/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Edición de un documento (manual de trabajo) ya subido, solo con conexión (sin acciones en cola ni sincronización).
 *
 * Reglas (decididas con el cliente):
 *  - Se pueden editar el título, la descripción, la clasificación y el quiz, y agregar archivos. Los archivos se borran aparte y al instante.
 *  - «¿Los cambios suponen una nueva versión?» (por defecto NO). Con SÍ la versión sube, las firmas anteriores se conservan con su versión y todos los
 *    usuarios vinculados deben volver a ver y firmar el documento; reciben una notificación.
 *  - Modificar el quiz EXIGE nueva versión: las respuestas de cada persona se enlazan a la versión del documento (y su quiz se conserva en
 *    `e_manual_puesto_version`), así que cambiar el quiz de una versión ya respondida dejaría las respuestas apuntando a otro quiz.
 *  - Agregar archivos o corregir datos sin nueva versión NO obliga a firmar de nuevo. Editar no pide la firma del responsable.
 *  - Solo quien puede actualizar los puestos y empleados del documento (rol distinto de OPERATIVO).
 */
import { publicarNuevaVersion, type ArchivoNuevo, type Dyn } from "./service";

// ---------------------------------------------------------------------------------------------------------------------------------
// Permiso

/** Quien puede editar: la misma regla que ve la app para «Act. puestos» y «Act. empleados» (rol distinto de OPERATIVO). */
export function rolPuedeGestionar(roleName: unknown): boolean {
    const rol = String(roleName ?? "").trim().toUpperCase();
    return rol !== "" && rol !== "OPERATIVO";
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Quiz

export const TIPOS_PREGUNTA = ["short", "paragraph", "multiple_choice", "multiple_select", "list"] as const;
type TipoPregunta = (typeof TIPOS_PREGUNTA)[number];

export type PreguntaQuiz = { id: string; title: string; type: TipoPregunta; options?: string[]; answer?: string; answers?: string[]; points: number };
export type QuizNormalizado = { questions: PreguntaQuiz[]; minApprovalPercentage?: number };

const textoOpcional = (v: unknown): string | undefined => (typeof v === "string" && v.trim() !== "" ? v : undefined);

/** Lee un quiz (texto JSON, objeto o lista antigua) en su forma canónica; `null` si no tiene preguntas o no se puede leer. */
export function normalizarQuiz(raw: unknown): QuizNormalizado | null {
    let parsed: unknown = raw;
    if (typeof raw === "string") {
        if (!raw.trim()) return null;
        try {
            parsed = JSON.parse(raw);
        } catch {
            return null;
        }
    }
    const lista: unknown[] = Array.isArray(parsed) ? parsed : Array.isArray((parsed as any)?.questions) ? (parsed as any).questions : [];
    const questions: PreguntaQuiz[] = [];
    for (const q of lista as any[]) {
        const id = String(q?.id ?? "").trim();
        const title = String(q?.title ?? "").trim();
        const type = String(q?.type ?? "").trim() as TipoPregunta;
        if (!id || !title || !TIPOS_PREGUNTA.includes(type)) continue;
        const options = Array.isArray(q?.options) ? q.options.map((o: unknown) => String(o)) : undefined;
        const answers = Array.isArray(q?.answers) ? q.answers.map((o: unknown) => String(o)) : undefined;
        questions.push({
            id,
            title,
            type,
            ...(options ? { options } : {}),
            ...(textoOpcional(q?.answer) !== undefined ? { answer: String(q.answer) } : {}),
            ...(answers ? { answers } : {}),
            points: Number.isFinite(Number(q?.points)) && Number(q.points) >= 0 ? Number(q.points) : 0,
        });
    }
    if (questions.length === 0) return null;
    const min = !Array.isArray(parsed) ? Number((parsed as any)?.minApprovalPercentage) : NaN;
    return { questions, ...(Number.isFinite(min) && min > 0 ? { minApprovalPercentage: min } : {}) };
}

/** ¿El quiz nuevo es distinto del actual? Sin quiz, `null`, texto vacío y «sin preguntas» son lo mismo. */
export function quizCambio(actual: unknown, nuevo: unknown): boolean {
    return JSON.stringify(normalizarQuiz(actual)) !== JSON.stringify(normalizarQuiz(nuevo));
}

export function resumenQuiz(raw: unknown): string {
    const q = normalizarQuiz(raw);
    if (!q) return "Sin quiz";
    return `${q.questions.length} pregunta(s)${q.minApprovalPercentage ? `, aprobación mínima ${q.minApprovalPercentage} %` : ""}`;
}

/** Problemas de una pregunta (mismas reglas que el formulario de la app); lista vacía si está bien. */
export function problemasPregunta(q: any): string[] {
    const out: string[] = [];
    const type = String(q?.type ?? "");
    if (!String(q?.id ?? "").trim()) out.push("falta el id");
    if (!String(q?.title ?? "").trim()) out.push("falta el título");
    if (!TIPOS_PREGUNTA.includes(type as TipoPregunta)) return [...out, "tipo desconocido"];
    const opciones = Array.isArray(q?.options) ? q.options : [];
    if (["multiple_choice", "multiple_select", "list"].includes(type) && opciones.length === 0) out.push("faltan las opciones");
    if (["short", "paragraph"].includes(type) && !String(q?.answer ?? "").trim()) out.push("falta la respuesta correcta");
    if (["multiple_choice", "list"].includes(type) && !String(q?.answer ?? "").trim()) out.push("falta la respuesta correcta");
    if (type === "multiple_select" && !(Array.isArray(q?.answers) && q.answers.length > 0)) out.push("faltan las respuestas correctas");
    const puntos = Number(q?.points);
    if (!Number.isFinite(puntos) || puntos < 0) out.push("puntaje inválido");
    return out;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Entrada

export type ArchivoEntrada = { type: string; extension: string; original_name: string; file_base64: string };

export type EdicionEntrada = {
    marcaId: number;
    title?: string;
    description?: string;
    /** `undefined` = no cambia; `null` = sin clasificar. */
    classification?: string | null;
    /** `undefined` = no cambia; `null` = quitar el quiz. Es el texto JSON ya normalizado. */
    quiz?: string | null;
    nuevaVersion: boolean;
    archivosNuevos: ArchivoEntrada[];
};

export type ErrorEdicion = { ok: false; status: 400; code: "invalid_request"; message: string };

export const MAX_ARCHIVOS_NUEVOS = 20;
const TIPOS_ARCHIVO = new Set(["image", "audio", "video", "document", "text"]);
const MAX_TITULO = 300;
const MAX_DESCRIPCION = 20_000;

const invalido = (message: string): ErrorEdicion => ({ ok: false, status: 400, code: "invalid_request", message });

export function validarEdicion(body: any): { ok: true; edicion: EdicionEntrada } | ErrorEdicion {
    const marcaId = Number(body?.marca_id);
    if (!Number.isInteger(marcaId) || marcaId <= 0) return invalido("Marca inválida");

    const edicion: EdicionEntrada = { marcaId, nuevaVersion: body?.nueva_version === true, archivosNuevos: [] };

    if (body?.title !== undefined) {
        const t = typeof body.title === "string" ? body.title.trim() : "";
        if (!t) return invalido("El título es obligatorio");
        if (t.length > MAX_TITULO) return invalido(`El título no puede superar ${MAX_TITULO} caracteres`);
        edicion.title = t;
    }
    if (body?.description !== undefined) {
        const d = typeof body.description === "string" ? body.description.trim() : "";
        if (!d) return invalido("La descripción es obligatoria");
        if (d.length > MAX_DESCRIPCION) return invalido(`La descripción no puede superar ${MAX_DESCRIPCION} caracteres`);
        edicion.description = d;
    }
    if (body?.classification !== undefined) {
        if (body.classification !== null && typeof body.classification !== "string") return invalido("Clasificación inválida");
        const c = typeof body.classification === "string" ? body.classification.trim() : "";
        edicion.classification = c === "" ? null : c.slice(0, 190);
    }
    if (body?.quiz !== undefined) {
        if (body.quiz === null || (typeof body.quiz === "string" && body.quiz.trim() === "")) {
            edicion.quiz = null;
        } else {
            let parsed: any;
            try {
                parsed = typeof body.quiz === "string" ? JSON.parse(body.quiz) : body.quiz;
            } catch {
                return invalido("El quiz no tiene un formato válido");
            }
            const lista: any[] = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.questions) ? parsed.questions : [];
            if (lista.length === 0) {
                edicion.quiz = null;
            } else {
                const ids = new Set<string>();
                for (let i = 0; i < lista.length; i++) {
                    const problemas = problemasPregunta(lista[i]);
                    if (problemas.length) return invalido(`Pregunta ${i + 1} del quiz: ${problemas.join(", ")}`);
                    const id = String(lista[i].id).trim();
                    if (ids.has(id)) return invalido(`Pregunta ${i + 1} del quiz: el id está repetido`);
                    ids.add(id);
                }
                const normalizado = normalizarQuiz(parsed);
                edicion.quiz = normalizado ? JSON.stringify(normalizado) : null;
            }
        }
    }

    const rawFiles = body?.newFiles;
    if (rawFiles !== undefined && rawFiles !== null && rawFiles !== "") {
        let lista: any;
        try {
            lista = typeof rawFiles === "string" ? JSON.parse(rawFiles) : rawFiles;
        } catch {
            return invalido("Formato de archivos inválido");
        }
        if (!Array.isArray(lista)) return invalido("Formato de archivos inválido");
        if (lista.length > MAX_ARCHIVOS_NUEVOS) return invalido(`Máximo ${MAX_ARCHIVOS_NUEVOS} archivos por edición`);
        for (let i = 0; i < lista.length; i++) {
            const f = lista[i];
            const type = String(f?.type ?? "");
            const extension = String(f?.extension ?? "").replace(/^\./, "").trim();
            const base64 = typeof f?.file_base64 === "string" ? f.file_base64 : "";
            if (!TIPOS_ARCHIVO.has(type)) return invalido(`Archivo ${i + 1}: tipo no permitido`);
            if (!/^[A-Za-z0-9]{1,10}$/.test(extension)) return invalido(`Archivo ${i + 1}: extensión no válida`);
            if (!base64) return invalido(`Archivo ${i + 1}: está vacío`);
            edicion.archivosNuevos.push({ type, extension, original_name: String(f?.original_name ?? "").trim().slice(0, 190) || `archivo.${extension}`, file_base64: base64 });
        }
    }
    return { ok: true, edicion };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Aplicar

export type Cambio = { prop: string; before: unknown; after: unknown };

export type ResultadoEdicion = {
    /** Versión vigente después de editar. */
    version: number;
    versionCambio: boolean;
    quizCambio: boolean;
    cambios: Cambio[];
    /** Nada cambió (ni datos ni archivos). */
    sinCambios: boolean;
};

export class EdicionError extends Error {
    constructor(public code: "quiz_requires_new_version", message: string, public status = 400) {
        super(message);
    }
}

export const MENSAJE_QUIZ_REQUIERE_VERSION = "Modificar el quiz exige publicar una nueva versión del documento: las respuestas ya dadas quedan con su versión.";

const igualTexto = (a: unknown, b: unknown): boolean => String(a ?? "") === String(b ?? "");

export type ContextoEdicion = {
    ahoraIso: string;
    publicadoPor: string;
    /** `updated_at` / `updated_by` de quien edita. */
    auditFields: Record<string, unknown>;
    /** Archivos ya subidos al almacén (nombre guardado, tipo, nombre original y extensión). */
    archivosSubidos: ArchivoNuevo[];
};

export async function aplicarEdicionManual(dyn: Dyn, manual: any, edicion: EdicionEntrada, ctx: ContextoEdicion): Promise<ResultadoEdicion> {
    const versionActual = Number(manual.version ?? 1);
    const cambioQuiz = edicion.quiz !== undefined && quizCambio(manual.quiz, edicion.quiz);
    if (cambioQuiz && !edicion.nuevaVersion) throw new EdicionError("quiz_requires_new_version", MENSAJE_QUIZ_REQUIERE_VERSION);

    const cambios: Cambio[] = [];
    const nuevoTitulo = edicion.title !== undefined && !igualTexto(edicion.title, manual.title) ? edicion.title : undefined;
    const nuevaDescripcion = edicion.description !== undefined && !igualTexto(edicion.description, manual.description) ? edicion.description : undefined;
    const nuevaClasificacion = edicion.classification !== undefined && !igualTexto(edicion.classification, manual.classification) ? edicion.classification : undefined;
    if (nuevoTitulo !== undefined) cambios.push({ prop: "title", before: manual.title ?? null, after: nuevoTitulo });
    if (nuevaDescripcion !== undefined) cambios.push({ prop: "description", before: manual.description ?? null, after: nuevaDescripcion });
    if (nuevaClasificacion !== undefined) cambios.push({ prop: "classification", before: manual.classification ?? null, after: nuevaClasificacion });
    if (cambioQuiz) cambios.push({ prop: "quiz", before: resumenQuiz(manual.quiz), after: resumenQuiz(edicion.quiz) });
    if (ctx.archivosSubidos.length) cambios.push({ prop: "archivos_agregados", before: null, after: ctx.archivosSubidos.map((a) => a.original_name || a.name) });

    const hayCambios = cambios.length > 0;
    if (!hayCambios && !edicion.nuevaVersion) return { version: versionActual, versionCambio: false, quizCambio: false, cambios, sinCambios: true };

    if (edicion.nuevaVersion) {
        const r = await publicarNuevaVersion(dyn, manual, {
            title: nuevoTitulo,
            description: nuevaDescripcion,
            ...(nuevaClasificacion !== undefined ? { classification: nuevaClasificacion } : {}),
            ...(cambioQuiz ? { quiz: edicion.quiz } : {}),
            archivosNuevos: ctx.archivosSubidos,
            publicadoPor: ctx.publicadoPor,
            ahoraIso: ctx.ahoraIso,
        });
        await dyn.update("e_manual_puesto", { id: Number(manual.id) }, { ...ctx.auditFields });
        cambios.push({ prop: "version", before: versionActual, after: r.version });
        return { version: r.version, versionCambio: true, quizCambio: cambioQuiz, cambios, sinCambios: false };
    }

    // Corrección de la misma versión: los datos se corrigen en el propio registro y los archivos nuevos pertenecen a la versión vigente.
    await dyn.update("e_manual_puesto", { id: Number(manual.id) }, {
        ...(nuevoTitulo !== undefined ? { title: nuevoTitulo } : {}),
        ...(nuevaDescripcion !== undefined ? { description: nuevaDescripcion } : {}),
        ...(nuevaClasificacion !== undefined ? { classification: nuevaClasificacion } : {}),
        ...ctx.auditFields,
    });
    for (const a of ctx.archivosSubidos) await dyn.create("e_archivos_manual_puesto", { ...a, sha256: a.sha256 ?? null, manual_puesto_id: Number(manual.id), version: versionActual });
    return { version: versionActual, versionCambio: false, quizCambio: false, cambios, sinCambios: false };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Notificación y destinatarios

export function mensajeNuevaVersion(titulo: string, version: number, quizModificado: boolean): { title: string; description: string } {
    return {
        title: "Documento actualizado",
        description: `El documento «${titulo}» tiene una nueva versión (v${version}).${quizModificado ? " Incluye cambios en el quiz." : ""} Debes volver a visualizarlo y firmarlo.`,
    };
}

const unicos = (xs: unknown[]): number[] => [...new Set(xs.map(Number).filter((n) => Number.isInteger(n) && n > 0))];

/** Usuarios vinculados al documento: sus puestos (el principal y los vinculados) y los empleados que ya lo tienen entregado o vinculado. */
export async function destinatariosDelDocumento(dyn: Dyn, manual: any): Promise<{ puestoIds: number[]; empleadoIds: number[] }> {
    const manualId = Number(manual.id);
    const links = await dyn.find("e_puestos_manual_puesto", { where: { manual_puesto_id: manualId } });
    const emps = await dyn.find("e_empleados_manual_puesto", { where: { manual_puesto_id: manualId } });
    return { puestoIds: unicos([manual.puesto_id, ...links.map((l: any) => l.puesto_id)]), empleadoIds: unicos(emps.map((e: any) => e.empleado_id)) };
}
