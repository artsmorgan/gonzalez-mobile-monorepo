import getValidAccessTokenOrLogout from './getValidAccessTokenOrLogout';
import { getDeviceUid } from './installSecureStorage';
import { handleDeviceNotApprovedResponse } from './deviceNotApproved';
import { getEvidenceHeaders, isMutatingMethod } from './evidenceCapture';

type AuthedFetchArgs = {
    url: string;
    init?: RequestInit;
    refreshAccessToken: () => Promise<boolean>;
    logout: () => Promise<any>;
    shouldUpdateServerTime?: boolean;
};

// Mutex para asegurar que solo una ejecución ocurra a la vez
// Usamos una promesa que se resuelve cuando la ejecución actual termina
let executionQueue: Promise<Response | null> = Promise.resolve(null);

/**
 * Wrapper reutilizable para `fetch` autenticado:
 * - Hace preflight (`getValidAccessTokenOrLogout`) antes del request.
 * - Inyecta `Authorization: Bearer <token>` y `ngrok-skip-browser-warning`.
 * - Manda el identificador único del equipo (`X-Device-Uid`) para que el servidor sepa desde qué teléfono llega la petición.
 * - En las peticiones que guardan datos (POST/PUT/PATCH/DELETE) manda la evidencia de la acción (`X-Evidence-*`: ubicación, hora y permiso de GPS).
 * - Si la respuesta es 403 `device_not_approved` (equipo bloqueado / rechazado / retirado / pendiente) -> muestra la pantalla de estado del
 *   equipo, SIN cerrar la sesión.
 * - Si la respuesta es cualquier otro 401/403 -> logout inmediato (sin retry).
 * - Solo permite una ejecución a la vez (mutex).
 *
 * Retorna `Response` o `null` si se deslogueó / tokens inválidos.
 */
export default async function authedFetch({
    url,
    init,
    refreshAccessToken,
    logout,
    shouldUpdateServerTime = true,
}: AuthedFetchArgs): Promise<Response | null> {
    // Esperar a que la ejecución anterior termine
    await executionQueue;

    // Crear nueva ejecución y agregarla a la cola
    executionQueue = (async () => {
        try {
            const token = await getValidAccessTokenOrLogout({ refreshAccessToken, logout, shouldUpdateServerTime });
            if (!token) return null;

            const headers: any = {
                ...((init?.headers as any) ?? {}),
                Authorization: `Bearer ${token}`,
                'ngrok-skip-browser-warning': '69420',
            };
            try {
                headers['X-Device-Uid'] = await getDeviceUid();
            } catch {
                /* sin identificador: la petición sigue (el servidor decide según GUARDIFY_DEVICE_ENFORCE) */
            }
            if (isMutatingMethod(init?.method)) {
                Object.assign(headers, await getEvidenceHeaders());
            }

            const response = await fetch(url, { ...(init ?? {}), headers });

            if (await handleDeviceNotApprovedResponse(response)) {
                return null;
            }

            if (response.status === 401 || response.status === 403) {
                await logout();
                return null;
            }

            return response;
        } catch (error) {
            // En caso de error, también retornar null
            return null;
        }
    })();

    return executionQueue;
}


