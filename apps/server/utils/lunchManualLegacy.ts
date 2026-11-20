/**
 * Almuerzos manuales de la versión ANTERIOR de la app (issue #158).
 *
 * Esa versión armaba el inicio, el fin y las pausas con `fromZonedTime(..., "America/Costa_Rica")`, o sea como instantes UTC reales: lo
 * digitado como 12:00 de Costa Rica llegaba como 18:00Z. El resto del sistema guarda la «hora de reloj de CR» tal cual como UTC
 * (12:00 → 12:00Z), así que esos registros quedaban 6 horas adelantados (y el fin mostrado al confirmar, 19:00 para un almuerzo de 12:00
 * a 13:00, parecía «el final del turno»).
 *
 * La versión corregida de la app envía `formato_hora: "cr_reloj"`. Una petición manual SIN esa marca viene de la versión anterior (también
 * las acciones que quedaron en cola sin conexión) y se corrige aquí restando esas 6 horas (Costa Rica no tiene horario de verano).
 */

export const FORMATO_HORA_CR_RELOJ = "cr_reloj";
export const DESFASE_LEGADO_MS = 6 * 60 * 60 * 1000;

export type AlmuerzoManualHoras = {
    inicio: string | Date;
    fin: string | Date;
    /** JSON de pausas `[{ startTime, endTime, reason }]` tal como lo manda la app. */
    pausas?: string | null;
};

const restar = (v: unknown): string => {
    const d = new Date(v as string | number | Date);
    return Number.isNaN(d.getTime()) ? String(v) : new Date(d.getTime() - DESFASE_LEGADO_MS).toISOString();
};

/** ¿La petición viene de la versión anterior? Solo los registros manuales sin la marca de formato. */
export function esManualLegado(esManual: unknown, formatoHora: unknown): boolean {
    return Boolean(esManual) && String(formatoHora ?? "").trim() !== FORMATO_HORA_CR_RELOJ;
}

/** Resta el desfase de 6 horas al inicio, al fin y a las pausas (las claves `startTime`/`endTime`, `inicio`/`fin` o `start`/`end`). */
export function corregirHorasManualLegado(horas: AlmuerzoManualHoras): { inicio: string; fin: string; pausas: string } {
    let pausas = String(horas.pausas ?? "[]");
    try {
        const parsed = JSON.parse(pausas);
        if (Array.isArray(parsed)) {
            pausas = JSON.stringify(
                parsed.map((p) => {
                    if (!p || typeof p !== "object") return p;
                    const out: Record<string, unknown> = { ...p };
                    for (const k of ["startTime", "endTime", "inicio", "fin", "start", "end"]) {
                        if (out[k] != null && out[k] !== "") out[k] = restar(out[k]);
                    }
                    return out;
                }),
            );
        }
    } catch {
        /* pausas ilegibles: se dejan como vienen */
    }
    return { inicio: restar(horas.inicio), fin: restar(horas.fin), pausas };
}
