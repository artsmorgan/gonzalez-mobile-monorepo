import Constants from 'expo-constants';
import authedFetch from './authedFetch';
import getValidAccessTokenOrLogout, { getRequestAuthToken } from './getValidAccessTokenOrLogout';

export { authedFetch, getRequestAuthToken, getValidAccessTokenOrLogout };

export function getApiServerUrl(): string {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) {
    throw new Error('Server URL not configured');
  }
  return String(apiUrl).replace(/\/+$/, '');
}

export function resolveApiUrl(pathOrUrl: string): string {
  const trimmed = String(pathOrUrl ?? '').trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  const base = getApiServerUrl();
  if (!trimmed) return base;
  return `${base}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`;
}

/** Quita headers que authedFetch inyecta automáticamente. */
export function sanitizeAuthedInit(init?: RequestInit): RequestInit | undefined {
  if (!init) return init;
  const headers = init.headers;
  if (!headers) return init;

  if (headers instanceof Headers) {
    const next = new Headers(headers);
    next.delete('Authorization');
    next.delete('authorization');
    next.delete('ngrok-skip-browser-warning');
    return { ...init, headers: next };
  }

  if (Array.isArray(headers)) {
    const next = headers.filter(
      ([key]) =>
        !/^authorization$/i.test(String(key)) && !/^ngrok-skip-browser-warning$/i.test(String(key))
    );
    return { ...init, headers: next };
  }

  const record = { ...(headers as Record<string, string>) };
  delete record.Authorization;
  delete record.authorization;
  delete record['ngrok-skip-browser-warning'];
  return { ...init, headers: record };
}

type AuthedApiRequestArgs = {
  logout: () => Promise<unknown>;
  url: string;
  init?: RequestInit;
};

/**
 * Fetch autenticado contra la API. Lanza si la sesión expiró o la respuesta no es ok.
 */
export async function authedApiRequest({
  logout,
  url,
  init,
}: AuthedApiRequestArgs): Promise<Response> {
  const response = await authedFetch({
    url: resolveApiUrl(url),
    init: sanitizeAuthedInit(init),
    logout,
  });

  if (!response) {
    throw new Error('Sesión expirada');
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message =
      errorData && typeof errorData === 'object' && 'message' in errorData
        ? String((errorData as { message?: string }).message || '')
        : '';
    throw new Error(message || `HTTP error! status: ${response.status}`);
  }

  return response;
}

/** Token Bearer vigente (p. ej. para `?token=` en URLs de archivos). */
export async function getAuthBearerToken(logout: () => Promise<unknown>): Promise<string> {
  return getRequestAuthToken(logout);
}
