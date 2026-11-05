/**
 * Causas de un fallo al llamar a la API (issue #174, H07). Módulo PURO, sin Expo/React Native, para probarlo en Node.
 *
 * Antes cualquier 401/403 cerraba la sesión y un error de red devolvía `null` sin decir por qué. Ahora se separan:
 *  - `session_expired`     401: el token venció → se cierra la sesión.
 *  - `permission_denied`   403 con `code: "permission_denied"`: falta permiso en esa operación → NO se cierra la sesión.
 *  - `device_not_approved` 403 `device_not_approved|ESTADO|motivo`: equipo bloqueado/pendiente → pantalla de estado, NO se cierra la sesión.
 *  - `session_revoked`     403 `session_revoked|motivo` (o `code: "session_revoked"`): un administrador cerró esa sesión → se cierra con su mensaje.
 *  - `forbidden`           cualquier otro 403 (token inválido) → se cierra la sesión, como siempre.
 *  - `server_error`        5xx → no se cierra la sesión.
 *  - `network` / `timeout` la petición no llegó o tardó demasiado → no se cierra la sesión.
 * El formato de los mensajes lo define `apps/server/utils/guardifyDevices.ts` (lo comprueba `apiFailure.test.ts`).
 */
export type ApiFailureKind =
  | 'session_expired'
  | 'permission_denied'
  | 'device_not_approved'
  | 'session_revoked'
  | 'forbidden'
  | 'server_error'
  | 'network'
  | 'timeout';

export function parseSessionRevokedMessage(message: unknown): { reason: string | null } | null {
  const m = /^session_revoked\|([\s\S]*)$/.exec(String(message ?? ''));
  if (!m) return null;
  const reason = (m[1] ?? '').trim();
  return { reason: reason || null };
}

/**
 * Causa de una respuesta HTTP fallida, o `null` si no es un fallo de sesión/servidor (éxito, o errores como 400/404/409 que cada pantalla
 * resuelve por su cuenta).
 */
export function classifyHttpFailure(status: number, payload: unknown): ApiFailureKind | null {
  const body = payload !== null && typeof payload === 'object' && !Array.isArray(payload) ? (payload as Record<string, unknown>) : null;
  const code = typeof body?.code === 'string' ? body.code : '';
  const message = typeof body?.message === 'string' ? body.message : '';

  if (status === 401) return 'session_expired';
  if (status === 403) {
    if (code === 'permission_denied') return 'permission_denied';
    if (code === 'session_revoked' || parseSessionRevokedMessage(message)) return 'session_revoked';
    if (/^device_not_approved\|/.test(message)) return 'device_not_approved';
    return 'forbidden';
  }
  if (status >= 500 && status <= 599) return 'server_error';
  return null;
}

/** Causa de una petición que ni siquiera obtuvo respuesta. */
export function classifyThrownError(error: unknown): 'timeout' | 'network' {
  const name = (error as { name?: unknown } | null | undefined)?.name;
  return name === 'AbortError' || name === 'TimeoutError' ? 'timeout' : 'network';
}

/** ¿Esta causa obliga a cerrar la sesión? Solo las que invalidan al usuario o a su token. */
export function shouldCloseSession(kind: ApiFailureKind): boolean {
  return kind === 'session_expired' || kind === 'session_revoked' || kind === 'forbidden';
}

/** Mensaje para la persona; cada causa dice lo suyo (un permiso faltante no es una sesión vencida). */
export function failureUserMessage(kind: ApiFailureKind): string {
  switch (kind) {
    case 'session_expired':
      return 'Tu sesión venció. Inicia sesión de nuevo.';
    case 'forbidden':
      return 'No se pudo validar tu sesión. Inicia sesión de nuevo.';
    case 'permission_denied':
      return 'No tienes permiso para realizar esta acción.';
    case 'device_not_approved':
      return 'Este equipo no está aprobado para usar la aplicación.';
    case 'session_revoked':
      return 'Un administrador cerró tu sesión. Inicia sesión de nuevo.';
    case 'server_error':
      return 'El servidor tuvo un problema. Intenta de nuevo en unos minutos.';
    case 'timeout':
      return 'El servidor tardó demasiado en responder. Intenta de nuevo.';
    case 'network':
    default:
      return 'Sin conexión con el servidor. Revisa tu conexión a internet.';
  }
}
