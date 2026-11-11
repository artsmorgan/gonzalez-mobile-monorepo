/**
 * Fechas de inicio y fin de la solicitud de permiso: el fin nunca puede quedar antes del inicio. Módulo PURO (sin React Native) para probarlo en Node.
 *
 * Los selectores devuelven una fecha con la hora del valor anterior, así que además de elegir un día «al revés» podía quedar, el mismo día, una hora
 * de fin anterior a la de inicio. `reconcilePermitRange` corrige ambos casos moviendo la OTRA fecha (la que no acaba de elegir la persona):
 *  - elige un inicio posterior al fin → el fin pasa al inicio;
 *  - elige un fin anterior al inicio → el inicio pasa al fin;
 *  - mismo día con la hora de fin anterior a la de inicio → el fin toma la hora del inicio.
 * Trabaja en hora local, igual que el selector.
 */
export type PermitDateRange = { inicio: Date; fin: Date };

const isValid = (d: unknown): d is Date => d instanceof Date && !Number.isNaN(d.getTime());

/** AAAAMMDD del día local (comparable como número). */
export function dayKey(d: Date): number {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

/** El día de fin es anterior al de inicio (lo que el servidor rechazaría). Fechas inválidas no cuentan como invertidas. */
export function isPermitRangeInverted(inicio: Date, fin: Date): boolean {
  return isValid(inicio) && isValid(fin) && dayKey(fin) < dayKey(inicio);
}

/** Devuelve un rango coherente (copias; no muta las fechas recibidas). `changed` es la fecha que acaba de elegir la persona. */
export function reconcilePermitRange(range: PermitDateRange, changed: 'inicio' | 'fin'): PermitDateRange {
  if (!isValid(range.inicio) || !isValid(range.fin)) return range;
  let inicio = new Date(range.inicio.getTime());
  let fin = new Date(range.fin.getTime());
  if (dayKey(fin) < dayKey(inicio)) {
    if (changed === 'inicio') fin = new Date(inicio.getTime());
    else inicio = new Date(fin.getTime());
  } else if (dayKey(fin) === dayKey(inicio) && fin.getTime() < inicio.getTime()) {
    fin = new Date(inicio.getTime());
  }
  return { inicio, fin };
}
