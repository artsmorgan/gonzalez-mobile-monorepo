/**
 * Filtros de fecha de las listas (Solicitud de permiso y Mutuos acuerdos). Módulo PURO (sin React Native) para probarlo en Node.
 *
 * Regla: los filtros nacen VACÍOS. Un filtro vacío no oculta nada: al abrir el módulo la persona ve todos sus registros (y los que debe aprobar o
 * rechazar) sin importar la fecha; solo se filtra cuando ella elige una fecha. Cada filtro es un rango «desde — hasta» y cualquiera de los dos
 * extremos puede quedar vacío (solo «desde» = desde esa fecha en adelante; solo «hasta» = hasta esa fecha; los dos iguales = ese día).
 */
export type DateRange = { desde: string | null; hasta: string | null };

export const EMPTY_RANGE: DateRange = { desde: null, hasta: null };

/** Costa Rica no tiene horario de verano: siempre UTC-6. */
const CR_OFFSET_MS = 6 * 60 * 60 * 1000;

/** `AAAA-MM-DD` desde `AAAA-MM-DD`, `AAAA-M-D`, `DD-MM-AAAA` o una fecha con hora (se queda con la parte de la fecha). Vacío si no se entiende. */
export function normalizeToYmd(value: unknown): string {
  const raw = String(value ?? '').trim().split('T')[0]!.split(' ')[0]!;
  if (!raw) return '';
  const ymd = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymd) return `${ymd[1]}-${ymd[2]!.padStart(2, '0')}-${ymd[3]!.padStart(2, '0')}`;
  const dmy = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]!.padStart(2, '0')}-${dmy[1]!.padStart(2, '0')}`;
  return '';
}

/** `DD-MM-AAAA` para mostrar. */
export function ymdToDmy(value: unknown): string {
  const n = normalizeToYmd(value);
  if (!n) return '';
  const [y, m, d] = n.split('-');
  return `${d}-${m}-${y}`;
}

/** Fecha local (a las 00:00 del dispositivo) para el selector de fecha. */
export function ymdToLocalDate(value: unknown): Date {
  const n = normalizeToYmd(value);
  if (!n) return new Date();
  const [y, m, d] = n.split('-').map((x) => parseInt(x, 10));
  return new Date(y!, m! - 1, d!);
}

/** `AAAA-MM-DD` de una fecha local (la que eligió la persona en el selector). */
export function dateToYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Día (hora de Costa Rica) en que se creó un registro. `created_at` llega como instante (`2026-11-20T02:30:00.000Z`): su día en Costa Rica puede ser
 * el anterior al de UTC. Un valor que es solo una fecha se toma tal cual.
 */
export function creationYmd(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (!/[T ]\d{1,2}:\d{2}/.test(raw)) return normalizeToYmd(raw);
  const withZone = /(Z|[+-]\d{2}:?\d{2})$/.test(raw) ? raw : `${raw.replace(' ', 'T')}Z`;
  const t = new Date(withZone).getTime();
  if (Number.isNaN(t)) return normalizeToYmd(raw);
  return new Date(t - CR_OFFSET_MS).toISOString().slice(0, 10);
}

/** ¿El rango tiene algún extremo elegido? */
export function isRangeActive(r: DateRange | null | undefined): boolean {
  return !!r && (!!r.desde || !!r.hasta);
}

/**
 * ¿Pasa el filtro? Rango vacío: sí, siempre (no oculta nada). Con rango y un registro sin fecha: no pasa (no se puede saber si cae dentro).
 * Extremos al revés (desde > hasta): se toman en el orden correcto en lugar de ocultar todo.
 */
export function inRange(ymd: string, range: DateRange | null | undefined): boolean {
  if (!isRangeActive(range)) return true;
  if (!ymd) return false;
  let desde = range!.desde ? normalizeToYmd(range!.desde) : '';
  let hasta = range!.hasta ? normalizeToYmd(range!.hasta) : '';
  if (desde && hasta && desde > hasta) [desde, hasta] = [hasta, desde];
  if (desde && ymd < desde) return false;
  if (hasta && ymd > hasta) return false;
  return true;
}
