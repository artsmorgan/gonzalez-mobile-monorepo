import { toZonedTime } from "date-fns-tz";

export const ZONA_HORARIA_CR = "America/Costa_Rica";

/**
 * Hora «de pared» de Costa Rica para guardar en la base: el servidor guarda las horas como si el reloj de Costa Rica fuera UTC.
 * Con `hora_accion` (instante real que manda la app en acciones sincronizadas después) se convierte igual que la hora actual;
 * antes se guardaba el instante en UTC y el registro quedaba 6 horas adelantado (#218). Sin `hora_accion` o con una fecha inválida, usa `ahora`.
 */
export function horaDePared(horaAccion: Date | null | undefined, ahora: Date = new Date()): Date {
    const base = horaAccion instanceof Date && !Number.isNaN(horaAccion.getTime()) ? horaAccion : ahora;
    return toZonedTime(base, ZONA_HORARIA_CR);
}
