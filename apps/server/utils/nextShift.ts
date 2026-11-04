/**
 * Siguiente turno LABORAL de un empleado (no la siguiente marca sin más): un turno que no es día libre («L») y cuya hora de entrada, ya restados los
 * minutos previos de monitoreo, es posterior al momento de la consulta. Módulo puro para probarlo sin base de datos ni Planillas.
 */
export type NextShiftCandidate = {
    id: number;
    fecha: Date;
    hora_inicio: Date | null;
    tipo_turno: string | null;
};

/** Fecha de la marca + hora de inicio como un instante «ingenuo» (mismo criterio que `buildMarcaDateTime` de la ruta de asistencia). */
export function marcaStartMs(marca: Pick<NextShiftCandidate, "fecha" | "hora_inicio">): number {
    const fechaIso = new Date(marca.fecha).toISOString().split("T")[0];
    const horaIso = new Date(marca.hora_inicio ?? new Date("1970-01-01T00:00:00.000Z")).toISOString().split("T")[1];
    return new Date(`${fechaIso}T${horaIso}`).getTime();
}

/** Es un turno de trabajo: tiene tipo y no es «L» (día libre). */
export function isWorkShift(tipoTurno: string | null | undefined): boolean {
    const t = String(tipoTurno ?? "").trim().toUpperCase();
    return t !== "" && t !== "L";
}

/** Mensaje al empleado cuando el turno obtenido no trae hora de inicio ni tipo de turno: no se puede marcar. */
export const MENSAJE_TURNO_SIN_DATOS = "Imposible marcar entrada, contacta a tu administrador o supervisor para que revise el caso correspondiente";

/** Turno sin datos: `hora_inicio` nula y `tipo_turno` nulo (o vacío). Debe evaluarse ANTES de normalizar la hora nula a medianoche. */
export function turnoSinDatos(horaInicio: unknown, tipoTurno: unknown): boolean {
    return (horaInicio === null || horaInicio === undefined) && String(tipoTurno ?? "").trim() === "";
}

export function pickNextShift<T extends NextShiftCandidate>(marcas: T[], nowMs: number, previousMinutes: number): T | null {
    const previousMs = Math.max(0, Number(previousMinutes) || 0) * 60 * 1000;
    let best: { marca: T; start: number } | null = null;
    for (const marca of marcas) {
        if (!isWorkShift(marca.tipo_turno)) continue;
        const start = marcaStartMs(marca);
        if (!Number.isFinite(start)) continue;
        if (start - previousMs <= nowMs) continue;
        if (!best || start < best.start || (start === best.start && marca.id < best.marca.id)) best = { marca, start };
    }
    return best ? best.marca : null;
}
