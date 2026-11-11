/** Parte pura (sin React Native) del aviso de «versión desactualizada»: se prueba en Node. */
export type AppUpdateRequiredPayload = { message: string; requiredVersion: string | null };

/** Interpreta el cuerpo de un 426 del control de versión; `null` si no es de ese tipo. */
export function parseUpdateRequired(body: unknown): AppUpdateRequiredPayload | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (b.update_required !== true) return null;
  const message = typeof b.message === 'string' && b.message.trim() ? b.message.trim() : 'Tu versión de la aplicación ya no es compatible. Actualiza para continuar.';
  const requiredVersion = typeof b.required_version === 'string' && b.required_version.trim() ? b.required_version.trim() : null;
  return { message, requiredVersion };
}
