/**
 * Nota del quiz de un documento (issue #156): se calcula UNA vez, al calificar, y se guarda en la visualización del empleado
 * (`nota`, `nota_puntos`, `nota_total`, `nota_minimo`, `nota_fecha`); no se recalcula después con la estructura actual del quiz.
 *
 * Reglas (las mismas de la app, `JobManualsScreen`): las preguntas de selección única (`multiple_choice`) se califican solas comparando con la respuesta
 * correcta; las demás las califica a mano quien revisa (puntaje por pregunta, de 0 al puntaje de la pregunta). La nota es 0-100.
 */

export type QuizPregunta = { id: string; type: string; points: number; answer: string | null };

export type QuizLeido = { preguntas: QuizPregunta[]; minimo: number };

/** Porcentaje mínimo cuando el quiz no lo trae (igual que la app). */
export const MINIMO_POR_DEFECTO = 70;

/** Acepta el formato nuevo `{ questions, minApprovalPercentage }` y el antiguo (arreglo de preguntas). */
export function leerQuiz(raw: unknown): QuizLeido {
    let parsed: unknown = raw;
    if (typeof raw === "string") {
        if (!raw.trim()) return { preguntas: [], minimo: MINIMO_POR_DEFECTO };
        try {
            parsed = JSON.parse(raw);
        } catch {
            return { preguntas: [], minimo: MINIMO_POR_DEFECTO };
        }
    }
    const lista: unknown[] = Array.isArray(parsed) ? parsed : Array.isArray((parsed as any)?.questions) ? (parsed as any).questions : [];
    const minRaw = !Array.isArray(parsed) ? Number((parsed as any)?.minApprovalPercentage) : NaN;
    const preguntas = lista
        .map((q: any) => ({
            id: String(q?.id ?? "").trim(),
            type: String(q?.type ?? "").trim().toLowerCase(),
            points: Number.isFinite(Number(q?.points)) && Number(q.points) > 0 ? Number(q.points) : 0,
            answer: typeof q?.answer === "string" && q.answer !== "" ? q.answer : Array.isArray(q?.answers) ? q.answers.join(", ") : null,
        }))
        .filter((q) => q.id);
    return { preguntas, minimo: Number.isFinite(minRaw) && minRaw > 0 ? minRaw : MINIMO_POR_DEFECTO };
}

export type RespuestaLeida = { question_id: string; user_answer: string | null };

export function leerRespuestas(raw: unknown): RespuestaLeida[] {
    let parsed: unknown = raw;
    if (typeof raw === "string") {
        try {
            parsed = JSON.parse(raw);
        } catch {
            return [];
        }
    }
    if (!Array.isArray(parsed)) return [];
    return parsed
        .map((x: any) => ({ question_id: String(x?.question_id ?? "").trim(), user_answer: x?.user_answer != null ? String(x.user_answer) : null }))
        .filter((x) => x.question_id);
}

export type NotaCalculada = {
    /** Puntos obtenidos y puntos del quiz. */
    puntos: number;
    total: number;
    /** 0-100 con un decimal. */
    nota: number;
    minimo: number;
    aprobado: boolean;
    /** true = todas las preguntas tienen puntaje (las de selección única solas y las demás con el puntaje dado). */
    completa: boolean;
};

const redondear1 = (n: number) => Math.round(n * 10) / 10;

/**
 * @param puntajesManuales puntaje por pregunta (id → puntos) de las preguntas calificadas a mano. Si falta alguna, `completa` es false y esas cuentan 0.
 */
export function calcularNota(quiz: QuizLeido, respuestas: RespuestaLeida[], puntajesManuales: Record<string, number> = {}): NotaCalculada | null {
    const total = quiz.preguntas.reduce((s, q) => s + q.points, 0);
    if (total <= 0) return null;
    let puntos = 0;
    let completa = true;
    for (const q of quiz.preguntas) {
        if (q.type === "multiple_choice") {
            const r = respuestas.find((a) => a.question_id === q.id);
            if (q.answer !== null && r?.user_answer === q.answer) puntos += q.points;
        } else {
            const p = puntajesManuales[q.id];
            if (p === undefined) completa = false;
            else puntos += Math.min(Math.max(0, Number(p) || 0), q.points);
        }
    }
    const nota = redondear1((puntos / total) * 100);
    return { puntos, total, nota, minimo: quiz.minimo, aprobado: nota >= quiz.minimo, completa };
}

/** ¿Todas las preguntas con puntaje se califican solas? Entonces el servidor puede calcular la nota sin ayuda de quien revisa. */
export function esAutocalificable(quiz: QuizLeido): boolean {
    return quiz.preguntas.some((q) => q.points > 0) && quiz.preguntas.filter((q) => q.points > 0).every((q) => q.type === "multiple_choice");
}

export type NotaGuardable = {
    nota: number;
    nota_puntos: number;
    nota_total: number;
    nota_minimo: number;
    nota_fecha: string;
    nota_calificado_por: number | null;
};

/** Valida el desglose que manda la app al calificar (`score`) y lo vuelve la nota a guardar; null si no es coherente. */
export function notaDesdeApp(score: unknown, minimoDelQuiz: number, ahoraIso: string, calificadoPor: number | null): NotaGuardable | null {
    const s = (score && typeof score === "object" ? score : {}) as Record<string, unknown>;
    const puntos = Number(s.obtained ?? s.puntos);
    const total = Number(s.total);
    if (!Number.isFinite(puntos) || !Number.isFinite(total) || total <= 0 || puntos < 0 || puntos > total + 1e-9) return null;
    return {
        nota: redondear1((puntos / total) * 100),
        nota_puntos: puntos,
        nota_total: total,
        nota_minimo: minimoDelQuiz,
        nota_fecha: ahoraIso,
        nota_calificado_por: calificadoPor,
    };
}

export function notaDesdeCalculo(c: NotaCalculada, ahoraIso: string, calificadoPor: number | null): NotaGuardable {
    return { nota: c.nota, nota_puntos: c.puntos, nota_total: c.total, nota_minimo: c.minimo, nota_fecha: ahoraIso, nota_calificado_por: calificadoPor };
}
