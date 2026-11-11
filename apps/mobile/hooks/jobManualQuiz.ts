/**
 * Quiz de un documento (manual de trabajo): modelo, lectura, comparación y validación. Módulo puro, sin React Native ni Expo, para poder probarlo en Node.
 * El formato es el mismo que guarda el formulario de creación: `{ questions: [...], minApprovalPercentage? }` en texto JSON (y la lista antigua, sin objeto).
 *
 * `quizChanged` decide si el quiz cambió con la MISMA regla del servidor (`normalizarQuiz` / `quizCambio` en `apps/server/utils/documentos/edicion.ts`): si el
 * teléfono dijera «cambió» y el servidor «no», o al revés, se pediría una nueva versión sin motivo o se rechazaría la edición. Una prueba compara las dos.
 */

export type QuizQuestionType = 'short' | 'paragraph' | 'multiple_choice' | 'multiple_select' | 'list';

export const QUIZ_QUESTION_TYPES: { key: QuizQuestionType; label: string }[] = [
  { key: 'short', label: 'Respuesta corta' },
  { key: 'paragraph', label: 'Párrafo' },
  { key: 'multiple_choice', label: 'Selección única' },
  { key: 'multiple_select', label: 'Selección múltiple' },
  { key: 'list', label: 'Lista' },
];

export type QuizQuestion = {
  id: string;
  title: string;
  type: QuizQuestionType;
  options?: string[];
  answer?: string;
  answers?: string[];
  /** Puntaje de la pregunta (obligatorio). */
  points: number;
};

export type QuizConfig = {
  questions: QuizQuestion[];
  /** Porcentaje mínimo de aprobación; `undefined` = el quiz no lo fijó (el servidor usa 70). */
  minApprovalPercentage?: number;
};

export const DEFAULT_MIN_APPROVAL_PERCENTAGE = 70;

const TYPES = new Set<string>(QUIZ_QUESTION_TYPES.map((t) => t.key));
const needsOptions = (t: QuizQuestionType) => t === 'multiple_choice' || t === 'multiple_select' || t === 'list';

const optionalText = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() !== '' ? v : undefined);

/** Lee el quiz guardado en el documento (texto JSON, objeto o lista antigua). Sin quiz o ilegible: sin preguntas. */
export function parseQuiz(raw: unknown): QuizConfig {
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    if (!raw.trim()) return { questions: [] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { questions: [] };
    }
  }
  const list: unknown[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { questions?: unknown })?.questions)
      ? ((parsed as { questions: unknown[] }).questions)
      : [];
  const questions: QuizQuestion[] = [];
  for (const q of list as any[]) {
    const id = String(q?.id ?? '').trim();
    const title = String(q?.title ?? '').trim();
    const type = String(q?.type ?? '').trim();
    if (!id || !title || !TYPES.has(type)) continue;
    const options = Array.isArray(q?.options) ? q.options.map((o: unknown) => String(o)) : undefined;
    const answers = Array.isArray(q?.answers) ? q.answers.map((o: unknown) => String(o)) : undefined;
    const answer = optionalText(q?.answer);
    const points = Number(q?.points);
    questions.push({
      id,
      title,
      type: type as QuizQuestionType,
      ...(options ? { options } : {}),
      ...(answer !== undefined ? { answer: String(q.answer) } : {}),
      ...(answers ? { answers } : {}),
      points: Number.isFinite(points) && points >= 0 ? points : 0,
    });
  }
  const min = !Array.isArray(parsed) ? Number((parsed as { minApprovalPercentage?: unknown })?.minApprovalPercentage) : NaN;
  return { questions, ...(Number.isFinite(min) && min > 0 ? { minApprovalPercentage: min } : {}) };
}

/** Texto JSON para guardar; `null` si no hay preguntas (quitar el quiz). */
export function serializeQuiz(config: QuizConfig): string | null {
  if (config.questions.length === 0) return null;
  return JSON.stringify({
    questions: config.questions,
    ...(config.minApprovalPercentage !== undefined && config.minApprovalPercentage > 0 ? { minApprovalPercentage: config.minApprovalPercentage } : {}),
  });
}

const canonical = (raw: unknown): string => {
  const q = typeof raw === 'object' && raw !== null && !Array.isArray(raw) && 'questions' in (raw as object) && Array.isArray((raw as QuizConfig).questions)
    ? parseQuiz(JSON.stringify(raw))
    : parseQuiz(raw);
  return q.questions.length === 0 ? 'null' : JSON.stringify(q);
};

/** ¿Son distintos? Sin quiz, texto vacío y «sin preguntas» son lo mismo. Misma regla que el servidor. */
export function quizChanged(original: unknown, current: unknown): boolean {
  return canonical(original) !== canonical(current);
}

/** Resumen corto para mostrar: «3 pregunta(s), aprobación mínima 70 %». */
export function quizSummary(config: QuizConfig): string {
  if (config.questions.length === 0) return 'Sin quiz';
  const min = config.minApprovalPercentage ?? DEFAULT_MIN_APPROVAL_PERCENTAGE;
  const total = config.questions.reduce((acc, q) => acc + (Number.isFinite(q.points) ? q.points : 0), 0);
  return `${config.questions.length} pregunta(s) · ${total} punto(s) · aprobación mínima ${min} %`;
}

export function newQuestionId(random: () => number = Math.random): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = 'q_';
  for (let i = 0; i < 8; i++) id += chars.charAt(Math.floor(random() * chars.length));
  return id;
}

export type QuestionDraft = {
  title: string;
  type: QuizQuestionType;
  options: string[];
  answer: string;
  answers: string[];
  points: string;
};

export const emptyDraft = (): QuestionDraft => ({ title: '', type: 'short', options: [], answer: '', answers: [], points: '' });

export function draftFromQuestion(q: QuizQuestion): QuestionDraft {
  return { title: q.title, type: q.type, options: q.options ?? [], answer: q.answer ?? '', answers: q.answers ?? [], points: String(q.points) };
}

/** Mensaje de lo que falta en el borrador de una pregunta (mismas reglas del formulario de creación); `null` si está completo. */
export function validateDraft(d: QuestionDraft): string | null {
  if (!d.title.trim()) return 'El título de la pregunta es obligatorio';
  if (needsOptions(d.type) && d.options.length === 0) return 'Debes agregar al menos una opción';
  if ((d.type === 'short' || d.type === 'paragraph') && !d.answer.trim()) return 'Debes indicar la respuesta correcta';
  if ((d.type === 'multiple_choice' || d.type === 'list') && !d.answer) return 'Selecciona la respuesta correcta';
  if (d.type === 'multiple_select' && d.answers.length === 0) return 'Selecciona al menos una respuesta correcta';
  if (!d.points.trim()) return 'El puntaje es obligatorio';
  const p = parseFloat(d.points.trim());
  if (isNaN(p) || p < 0) return 'El puntaje debe ser un número válido mayor o igual a 0';
  return null;
}

/** Pregunta lista para guardar a partir de un borrador ya validado. Al editar se conserva el id (los intentos ya guardados se enlazan por id). */
export function questionFromDraft(d: QuestionDraft, id: string): QuizQuestion {
  return {
    id,
    title: d.title.trim(),
    type: d.type,
    options: needsOptions(d.type) ? d.options : undefined,
    answer: d.type === 'short' || d.type === 'paragraph' || d.type === 'multiple_choice' || d.type === 'list' ? d.answer.trim() || undefined : undefined,
    answers: d.type === 'multiple_select' ? d.answers : undefined,
    points: parseFloat(d.points.trim()),
  };
}
