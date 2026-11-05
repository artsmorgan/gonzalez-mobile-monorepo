/**
 * Identidad del equipo ante Guardify, accesible de forma síncrona y sin dependencias (issues #145 y #146).
 *
 * `guardifyClient.ts` la actualiza cuando el SDK carga o cambia el registro del equipo; `installEvidenceFetch.ts` la lee para mandar
 * `X-Guardify-Device` en las peticiones y `AuthContext` para enviar `guardifyDeviceId` / `guardifySessionId` al iniciar y renovar la sesión.
 */
let deviceId: string | undefined;
let sessionId: string | undefined;

export function setGuardifyIdentity(next: { deviceId?: string | null; sessionId?: string | null }): void {
  deviceId = next.deviceId ? String(next.deviceId) : undefined;
  sessionId = next.sessionId ? String(next.sessionId) : undefined;
}

export function getGuardifyIdentity(): { deviceId?: string; sessionId?: string } {
  return { deviceId, sessionId };
}
