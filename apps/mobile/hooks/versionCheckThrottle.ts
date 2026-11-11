/**
 * Cada cuánto se consulta `/api/mobile-versions` (issue #179, H10). Antes se consultaba en cada sincronización de cachés (cada 60 s) con
 * un guarda activo, para un dato que cambia con cada publicación. Módulo puro, sin Expo/React Native.
 */
export const VERSION_CHECK_MIN_INTERVAL_MS = 30 * 60 * 1000;

export function shouldCheckVersion(params: {
  lastCheckedAt: number | null | undefined;
  now: number;
  /** Consulta pedida explícitamente (p. ej. al abrir la pantalla de actualización): siempre se hace. */
  force?: boolean;
  minIntervalMs?: number;
}): boolean {
  const { lastCheckedAt, now, force = false, minIntervalMs = VERSION_CHECK_MIN_INTERVAL_MS } = params;
  if (force) return true;
  if (typeof lastCheckedAt !== 'number' || !Number.isFinite(lastCheckedAt)) return true;
  const elapsed = now - lastCheckedAt;
  // Una marca en el futuro (reloj corregido) no debe bloquear la consulta.
  if (elapsed < 0) return true;
  return elapsed >= minIntervalMs;
}
