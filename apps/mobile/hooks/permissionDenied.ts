/**
 * Un 403 por FALTA DE PERMISO en una operación no es una sesión inválida (issues #169 y #174): el servidor lo marca con el código estable
 * `permission_denied` en el cuerpo y la app muestra «no tienes permiso» sin cerrar la sesión. Módulo puro, sin React Native.
 */
export const PERMISSION_DENIED_CODE = 'permission_denied';

/** También `message = permission_denied|<permiso>`: así responden las rutas cuando Guardify niega el permiso (fase 3 de roles). */
export function isPermissionDeniedPayload(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;
  const b = body as { code?: unknown; message?: unknown };
  return b.code === PERMISSION_DENIED_CODE || /^permission_denied\|/.test(String(b.message ?? ''));
}
