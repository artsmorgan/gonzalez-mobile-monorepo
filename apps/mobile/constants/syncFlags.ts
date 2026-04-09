/**
 * Con `true`, se bloquea la sincronización automática de colas pendientes en App.tsx
 * (incluye el intento al montar, el eventBus tras login y el intervalo de red).
 * Cambia solo para pruebas locales; en producción debe ser `false`.
 */
export const FORCE_OFFLINE_SYNC = false;
