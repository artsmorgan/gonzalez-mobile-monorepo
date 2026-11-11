/**
 * Token de Planillas que se usa al ENVIAR una petición (issue #170). Módulo PURO, sin React Native, para probarlo en Node.
 *
 * Las acciones encoladas ya no guardan el token (quedaba en claro en AsyncStorage): al enviar, el token sale de lo que el que llama tenga en
 * memoria (`explicit`, p. ej. el que acaba de validar la pantalla) o, si no hay, del almacén seguro (`stored`). Nunca de la acción.
 */
export function pickPlanillasToken(explicit: string | null | undefined, stored: string | null | undefined): string | null {
  const direct = String(explicit ?? '').trim();
  if (direct) return direct;
  const fromStore = String(stored ?? '').trim();
  return fromStore || null;
}
