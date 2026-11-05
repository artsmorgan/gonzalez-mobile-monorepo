/**
 * Un 403 por FALTA DE PERMISO en una operación no es una sesión inválida (issues #169 y #174): el servidor lo marca con el código estable
 * `permission_denied` en el cuerpo y la app muestra «no tienes permiso» sin cerrar la sesión. Módulo puro, sin React Native.
 */
export const PERMISSION_DENIED_CODE = 'permission_denied';

export function isPermissionDeniedPayload(body: unknown): boolean {
  return !!body && typeof body === 'object' && (body as { code?: unknown }).code === PERMISSION_DENIED_CODE;
}
