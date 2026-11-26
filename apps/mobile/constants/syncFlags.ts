/**
 * Solo para pruebas locales: simula ausencia de conectividad para flujos online
 * (sincronización de colas, versiones móviles, notificaciones, deep links, etc.).
 * En producción debe ser `false`.
 */
export const FORCE_OFFLINE = false;

// Hay que actualizar "apps\mobile\screens\BitacoraVehiculosDetenidosScreen.tsx" para que cumpla la lógica de "main-structure"

/** @deprecated Usar FORCE_OFFLINE (mismo valor). */
export const FORCE_OFFLINE_SYNC = FORCE_OFFLINE;