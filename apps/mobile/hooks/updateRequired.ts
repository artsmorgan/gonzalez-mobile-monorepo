import { eventBus } from './eventBus';
import { parseUpdateRequired, type AppUpdateRequiredPayload } from './updateRequiredCore';

export { parseUpdateRequired, type AppUpdateRequiredPayload };

/** Evento que se emite cuando el servidor rechaza la petición por versión desactualizada (HTTP 426 con `update_required`). */
export const APP_UPDATE_REQUIRED_EVENT = 'appUpdateRequired' as const;

/** Avisa a la app (una sola vez por minuto) de que el servidor exige otra versión. Nunca lanza ni consume el cuerpo de la respuesta original. */
let lastNotifiedAt = 0;
export async function notifyIfUpdateRequired(response: Response): Promise<void> {
  try {
    if (response.status !== 426) return;
    const payload = parseUpdateRequired(await response.clone().json().catch(() => null));
    if (!payload) return;
    const now = Date.now();
    if (now - lastNotifiedAt < 60_000) return;
    lastNotifiedAt = now;
    eventBus.emit(APP_UPDATE_REQUIRED_EVENT, payload);
  } catch {
    /* el aviso es complementario: la respuesta original sigue su camino */
  }
}
