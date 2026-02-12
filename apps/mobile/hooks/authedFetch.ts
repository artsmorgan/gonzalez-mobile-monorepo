import getValidAccessTokenOrLogout from './getValidAccessTokenOrLogout';

type AuthedFetchArgs = {
    url: string;
    init?: RequestInit;
    refreshAccessToken: () => Promise<boolean>;
    logout: () => Promise<any>;
};

/**
 * Wrapper reutilizable para `fetch` autenticado:
 * - Hace preflight (`getValidAccessTokenOrLogout`) antes del request.
 * - Inyecta `Authorization: Bearer <token>` y `ngrok-skip-browser-warning`.
 * - Si la respuesta es 401/403 -> logout inmediato (sin retry).
 *
 * Retorna `Response` o `null` si se deslogueó / tokens inválidos.
 */
export default async function authedFetch({
    url,
    init,
    refreshAccessToken,
    logout,
}: AuthedFetchArgs): Promise<Response | null> {
    const token = await getValidAccessTokenOrLogout({ refreshAccessToken, logout });
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
}


