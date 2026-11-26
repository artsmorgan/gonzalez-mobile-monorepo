/**
 * ¿La persona tiene un turno activo? Lo decide la marca actual (`current_marca`): el turno está activo cuando la persona DIGITÓ su ingreso
 * (`hora_entrada_digitada`) y todavía no digitó su salida (`hora_salida_digitada`). No es lo mismo que la hora de inicio o de fin PROGRAMADA del turno
 * (`hora_inicio` / `hora_fin`): una marca con el turno ya programado pero sin ingreso digitado no está activa, y una con la salida digitada ya terminó.
 * Es la misma regla que usa el menú para mostrar «Entrega de puestos». Módulo puro: se prueba en Node.
 */
export const ACTIVITIES_NEEDS_SHIFT_MESSAGE = 'Debes tener un turno activo para ver tus actividades';

const hasValue = (v: unknown): boolean => v != null && !(typeof v === 'string' && v.trim() === '');

export function hasActiveShift(marca: unknown): boolean {
  if (!marca || typeof marca !== 'object' || Array.isArray(marca)) return false;
  const m = marca as { hora_entrada_digitada?: unknown; hora_salida_digitada?: unknown };
  return hasValue(m.hora_entrada_digitada) && !hasValue(m.hora_salida_digitada);
}
