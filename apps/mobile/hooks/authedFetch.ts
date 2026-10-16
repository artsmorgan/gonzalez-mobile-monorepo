import getValidAccessTokenOrLogout from './getValidAccessTokenOrLogout';

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
 * - Si la respuesta es 401/403 -> logout inmediato (sin retry).
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

            const response = await fetch(url, { ...(init ?? {}), headers });

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


