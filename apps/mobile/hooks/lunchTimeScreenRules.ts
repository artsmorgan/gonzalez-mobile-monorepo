/**
 * Reglas de la pantalla de tiempo de alimentación. Módulo PURO (sin React Native) para probarlo en Node.
 */

/**
 * Los minutos del horario solo se vuelven a aplicar al contador si este está INACTIVO y SIN INICIAR: no corre, no tiene hora de inicio, no hay un
 * conteo guardado (`temp_state` con inicio) y no está en pausa. Si ya empezó, cambiarle los minutos a media cuenta alteraría el registro.
 */
export function canRefreshLunchMinutes(p: {
  isTimerActive: boolean;
  hasStartTime: boolean;
  counterStarted: boolean;
  hasPausedInactivity: boolean;
}): boolean {
  return !p.isTimerActive && !p.hasStartTime && !p.counterStarted && !p.hasPausedInactivity;
}

/** Iniciar el conteo pide confirmación la primera vez (ya no hay botón de reiniciar); reanudar una pausa no vuelve a preguntar. */
export function shouldConfirmLunchStart(p: { hasStartTime: boolean }): boolean {
  return !p.hasStartTime;
}

export const TIMER_FONT_MAX = 50;
export const TIMER_FONT_MIN = 18;
/** Ancho de un carácter de la fuente monoespaciada del contador, como fracción de su tamaño. */
const MONO_CHAR_WIDTH_RATIO = 0.62;

/**
 * Tamaño de letra del contador para que el texto (p. ej. «01:30:00») quepa en UNA línea en `availableWidth`. Crece con el ancho hasta
 * `TIMER_FONT_MAX` y nunca baja de `TIMER_FONT_MIN`. Sin ancho medido todavía se usa el máximo.
 */
export function fitTimerFontSize(text: string, availableWidth: number | null | undefined): number {
  if (typeof availableWidth !== 'number' || Number.isNaN(availableWidth)) return TIMER_FONT_MAX;
  if (availableWidth <= 0) return TIMER_FONT_MIN;
  const chars = Math.max(1, String(text ?? '').length);
  const fitted = Math.floor(availableWidth / (chars * MONO_CHAR_WIDTH_RATIO));
  return Math.max(TIMER_FONT_MIN, Math.min(TIMER_FONT_MAX, fitted));
}
