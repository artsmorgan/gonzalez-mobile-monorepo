/** Opciones de «Tipo de capacitación» del registro de inducción y recorrido (las mismas que el servidor acepta). */
export const TIPOS_CAPACITACION = ['Presencial', 'Virtual'] as const;
export type TipoCapacitacion = (typeof TIPOS_CAPACITACION)[number];

/** Valor guardado → opción válida (cualquier otra cosa, p. ej. un registro sin el dato, queda sin elegir). */
export function normalizeTipoCapacitacion(value: unknown): TipoCapacitacion | '' {
  const v = String(value ?? '').trim().toLowerCase();
  return TIPOS_CAPACITACION.find((t) => t.toLowerCase() === v) ?? '';
}
