/**
 * Avisos de «Marcar Ingreso/Salida» que solo deben verse cuando su situación realmente se presenta. Módulo PURO (sin React Native) para probarlo en Node.
 *
 * La marca «Tardía» antes se mostraba con solo leer una bandera guardada (del servidor o de una consulta anterior): si la bandera quedaba en verdadero
 * aunque el turno todavía no hubiera empezado, el aviso salía sin motivo. Ahora se decide con la hora actual.
 */
export type TardiaInput = {
  /** La persona ya marcó la entrada (entonces el aviso de tardía de este recuadro no aplica). */
  ingresada: boolean;
  /** La marca tiene hora de inicio y de fin: sin horario no hay contra qué medir. */
  tieneHorario: boolean;
  /** Día libre: no hay entrada que esperar. */
  diaLibre: boolean;
  /** Inicio del turno (misma convención de hora de reloj que `horaAccionMs`). */
  inicioMs: number | null;
  /** Hora actual de la aplicación. */
  horaAccionMs: number | null;
  /** Minutos de gracia después del inicio del turno. */
  postMinutes: number;
};

/** ¿Hay que mostrar «Tardía»? Solo si todavía no marcó, el turno tiene horario y ya pasó la hora de inicio más la gracia. */
export function esTardiaAhora(i: TardiaInput): boolean {
  if (i.ingresada || !i.tieneHorario || i.diaLibre) return false;
  if (i.inicioMs == null || i.horaAccionMs == null) return false;
  if (!Number.isFinite(i.inicioMs) || !Number.isFinite(i.horaAccionMs)) return false;
  const gracia = Number.isFinite(i.postMinutes) && i.postMinutes > 0 ? i.postMinutes : 0;
  return i.horaAccionMs > i.inicioMs + gracia * 60 * 1000;
}
