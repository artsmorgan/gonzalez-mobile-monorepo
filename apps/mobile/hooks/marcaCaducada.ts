/**
 * Turno (marca) que ya terminó hace más de N horas (issue #159): deja de ser «el turno actual». Es la misma regla que aplica el servidor en
 * `apps/server/utils/marcaCaducada.ts` (mantener ambas iguales).
 *
 * - La referencia es la hora de salida: la `hora_salida_digitada` si la persona marcó salida y, si no, el FIN programado del turno
 *   (fecha + `hora_fin`, un día más si el turno cruza la medianoche).
 * - Solo caduca un turno que se inició (`hora_entrada_digitada`): una ausencia sin entrada conserva su flujo de «razón de ausencia».
 * - Todas las horas son «hora de reloj de Costa Rica» como UTC (mismo convenio que `getHoraAccion`).
 */

export const DEFAULT_HORAS_ELIMINAR_MARCA_TRAS_SALIDA = 4;

export type MarcaParaCaducar = {
    fecha?: Date | string | null;
    hora_inicio?: Date | string | null;
    hora_fin?: Date | string | null;
    horas_duracion?: unknown;
    hora_entrada_digitada?: Date | string | null;
    hora_salida_digitada?: Date | string | null;
};

/** Horas ≥ 0 (admite decimales); vacío o inválido → el valor por defecto (4). */
export function parseHorasEliminarMarca(raw: unknown): number {
    const s = String(raw ?? "").trim();
    if (!s) return DEFAULT_HORAS_ELIMINAR_MARCA_TRAS_SALIDA;
    const n = Number(s.replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? n : DEFAULT_HORAS_ELIMINAR_MARCA_TRAS_SALIDA;
}

function toMs(v: Date | string | null | undefined): number | null {
    if (v == null || v === "") return null;
    const ms = v instanceof Date ? v.getTime() : new Date(String(v)).getTime();
    return Number.isNaN(ms) ? null : ms;
}

/** Instante en que termina (o terminó) el turno según su horario programado, o null si no se puede calcular. */
export function finProgramadoMs(marca: MarcaParaCaducar): number | null {
    const fechaMs = toMs(marca.fecha);
    if (fechaMs == null) return null;
    const dia = new Date(fechaMs);
    const base = Date.UTC(dia.getUTCFullYear(), dia.getUTCMonth(), dia.getUTCDate());
    const inicioMs = toMs(marca.hora_inicio);
    const finMs = toMs(marca.hora_fin);
    if (finMs != null) {
        const fin = new Date(finMs);
        const finDelDia = base + ((fin.getUTCHours() * 60 + fin.getUTCMinutes()) * 60 + fin.getUTCSeconds()) * 1000;
        const inicio = inicioMs != null ? new Date(inicioMs) : null;
        const inicioDelDia = inicio ? base + ((inicio.getUTCHours() * 60 + inicio.getUTCMinutes()) * 60 + inicio.getUTCSeconds()) * 1000 : null;
        return inicioDelDia != null && inicioDelDia > finDelDia ? finDelDia + 24 * 60 * 60 * 1000 : finDelDia;
    }
    const horas = Number(marca.horas_duracion);
    if (inicioMs != null && Number.isFinite(horas) && horas > 0) {
        const inicio = new Date(inicioMs);
        const inicioDelDia = base + ((inicio.getUTCHours() * 60 + inicio.getUTCMinutes()) * 60 + inicio.getUTCSeconds()) * 1000;
        return inicioDelDia + horas * 60 * 60 * 1000;
    }
    return null;
}

/** Hora de referencia de la salida: la marcada por la persona o, si no hay, el fin programado del turno. */
export function salidaReferenciaMs(marca: MarcaParaCaducar): number | null {
    return toMs(marca.hora_salida_digitada) ?? finProgramadoMs(marca);
}

/** ¿El turno terminó hace `horas` horas o más (a `nowMs`)? Un turno que no se inició nunca caduca por esta regla. */
export function marcaCaducada(marca: MarcaParaCaducar, nowMs: number, horas: number): boolean {
    if (!Number.isFinite(nowMs)) return false;
    if (marca.hora_entrada_digitada == null && marca.hora_salida_digitada == null) return false;
    const ref = salidaReferenciaMs(marca);
    if (ref == null) return false;
    const limite = Number.isFinite(horas) && horas >= 0 ? horas : DEFAULT_HORAS_ELIMINAR_MARCA_TRAS_SALIDA;
    return nowMs >= ref + limite * 60 * 60 * 1000;
}
