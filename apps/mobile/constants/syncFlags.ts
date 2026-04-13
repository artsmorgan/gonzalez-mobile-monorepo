/**
 * Solo para pruebas locales: simula ausencia de conectividad para flujos online
 * (sincronización de colas, versiones móviles, notificaciones, deep links, etc.).
 * En producción debe ser `false`.
 */
export const FORCE_OFFLINE = false;

/** @deprecated Usar FORCE_OFFLINE (mismo valor). */
export const FORCE_OFFLINE_SYNC = FORCE_OFFLINE;
