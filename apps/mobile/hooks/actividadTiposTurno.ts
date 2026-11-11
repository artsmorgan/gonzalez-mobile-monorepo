/**
 * Tipos de turno de una actividad en la app: una actividad puede aplicar a varios («Diurno», «Mixto», «Nocturno»), elegidos con casillas.
 * Módulo puro (sin React Native) para probarlo en Node. El servidor los guarda en `c_actividades_tipo_turno`.
 */
export type TipoTurnoActividad = 'D' | 'M' | 'N';

export const TIPOS_TURNO_OPCIONES: { value: TipoTurnoActividad; label: string }[] = [
  { value: 'D', label: 'Diurno' },
  { value: 'M', label: 'Mixto' },
  { value: 'N', label: 'Nocturno' },
];

/** Tipos válidos, sin repetir y en el orden D, M, N. */
export function normalizeTiposTurno(raw: unknown): TipoTurnoActividad[] {
  const items: unknown[] = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : raw == null ? [] : [raw];
  const found = new Set(items.map((i) => String(i ?? '').trim().toUpperCase()));
  return TIPOS_TURNO_OPCIONES.map((o) => o.value).filter((v) => found.has(v));
}

/** Marca o desmarca un tipo y devuelve la lista nueva (siempre en el orden D, M, N). */
export function toggleTipoTurno(current: readonly string[], value: TipoTurnoActividad): TipoTurnoActividad[] {
  const set = new Set<string>(normalizeTiposTurno(current));
  if (set.has(value)) set.delete(value);
  else set.add(value);
  return normalizeTiposTurno([...set]);
}

/** Tipos de una actividad ya guardada: `tipos_turno` del servidor y, de un servidor anterior, el valor único; sin ninguno, Diurno (como antes). */
export function tiposTurnoDeActividad(activity: { tipos_turno?: unknown; tipo_turno?: unknown } | null | undefined): TipoTurnoActividad[] {
  const tipos = normalizeTiposTurno(activity?.tipos_turno);
  if (tipos.length > 0) return tipos;
  const legado = normalizeTiposTurno(activity?.tipo_turno);
  return legado.length > 0 ? legado : ['D'];
}

/** «Diurno, Mixto» para mostrar. */
export function tiposTurnoTexto(tipos: readonly string[]): string {
  const lista = normalizeTiposTurno(tipos);
  return TIPOS_TURNO_OPCIONES.filter((o) => lista.includes(o.value)).map((o) => o.label).join(', ');
}
