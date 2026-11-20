/**
 * Actualización automática de la marca en «Marcar Ingreso/Salida». Módulo PURO (sin React Native) para probarlo en Node.
 *
 * Regla: los 30 segundos de espera para volver a consultar la marca empiezan ÚNICAMENTE cuando la marca ya apareció en pantalla. Mientras el sistema la
 * busca (o se está marcando una entrada o salida, o se está cargando) no corre ningún conteo, y al terminar la búsqueda el conteo vuelve a empezar de cero.
 */
export const ATTENDANCE_POLL_DELAY_MS = 30_000;

export type AttendancePollingState = {
  isAuthenticated: boolean;
  hasEmployee: boolean;
  /** Se está registrando una entrada o salida. */
  isProcessingMark: boolean;
  /** Pantalla de carga de la marca (cargando o procesando). */
  isLoadingData: boolean;
  /** Hay una búsqueda de la marca en curso, desde que empieza (incluida la sincronización de hora y la revisión del token) hasta que termina. */
  isSearchingMarca: boolean;
  /** Hay una marca visible en pantalla. */
  hasAttendanceData: boolean;
};

/** ¿Debe estar corriendo la espera de 30 segundos? Solo con la marca en pantalla y sin ninguna búsqueda ni proceso en curso. */
export function shouldRunAttendancePolling(s: AttendancePollingState): boolean {
  return s.isAuthenticated && s.hasEmployee && !s.isProcessingMark && !s.isLoadingData && !s.isSearchingMarca && s.hasAttendanceData;
}

/**
 * Plazo de la búsqueda de la marca y de su información adjunta (horario de alimentación y actividades): se deja el máximo permitido (5 minutos) para que
 * alcance a traerlo todo aunque la red o el servicio vayan lentos. Antes una consulta se cortaba a los 20 segundos y la pantalla mostraba un error.
 */
export const ATTENDANCE_SEARCH_DEADLINE_MS = 300_000;

/** Tiempo de búsqueda tras el cual el texto de la pantalla de carga cambia para avisar que está tardando. */
export const ATTENDANCE_SEARCH_SLOW_NOTICE_MS = 20_000;

/** Texto de la pantalla de carga mientras se busca la marca (se reemplaza por el de «tardando demasiado» a los 20 segundos). */
export const ATTENDANCE_LOADING_MESSAGE = 'Cargando datos de asistencia...';

export const ATTENDANCE_SEARCH_SLOW_MESSAGE = 'La búsqueda está tardando demasiado, espere por favor...';
