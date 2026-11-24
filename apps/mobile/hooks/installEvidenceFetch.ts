/**
 * Evidencia en TODAS las peticiones a la API (issues #146 y #152).
 *
 * `authedFetch` ya manda `X-Device-Uid` y `X-Evidence-*`, pero muchas funciones (p. ej. `evaluationFunctions.ts`, con ~180 llamadas) usan
 * `fetch` directo con su propio token. En vez de tocarlas una por una, este módulo envuelve `fetch`: a toda petición hacia `API_SERVER` le
 * agrega `X-Device-Uid` y, si guarda datos (POST/PUT/PATCH/DELETE), las cabeceras de evidencia, sin pisar las que ya traiga.
 * Se importa en `index.js`, después de `installSecureStorage`. Nunca hace fallar la petición: ante un error envía la original sin cambios.
 */
import Constants from 'expo-constants';
import { getEvidenceHeaders, isMutatingMethod } from './evidenceCapture';
import { getDeviceUid } from './installSecureStorage';
import { getGuardifyIdentity } from './guardifyIdentity';
import { getEmbeddedAppVersionInfo } from './appVariant';
import { notifyIfUpdateRequired } from './updateRequired';
import { deniedResponse, denialKey, notifyIfPermissionDenied, recentDenial } from './permissionDeniedNotice';
import { headersFromStamp, takeStampFromBody } from './evidenceQueue';

const g = globalThis as unknown as { fetch: typeof fetch; __evidenceFetchInstalled?: boolean };

function requestUrl(input: unknown): string {
  if (typeof input === 'string') return input;
  if (input && typeof input === 'object' && 'url' in input) return String((input as { url: unknown }).url);
  return String(input ?? '');
}

function requestMethod(input: unknown, init?: RequestInit): string {
  return String(init?.method ?? (input && typeof input === 'object' && 'method' in input ? (input as { method: unknown }).method : 'GET'));
}

/** Agrega las cabeceras que falten (comparación sin distinguir mayúsculas) y devuelve el `init` nuevo. */
export async function withEvidenceHeaders(input: unknown, init: RequestInit | undefined, apiBase: string): Promise<RequestInit | undefined> {
  const url = requestUrl(input);
  if (!apiBase || !url.startsWith(apiBase)) return init;

  // Acción reenviada desde una cola sin conexión: lleva en el cuerpo el sello de ubicación y hora del momento en que se hizo (ver
  // `evidenceQueue.ts`). Se quita del cuerpo y sus valores pasan a cabeceras, en lugar de la ubicación y hora de la sincronización.
  let stampHeaders: Record<string, string> | null = null;
  if (typeof init?.body === 'string' && isMutatingMethod(requestMethod(input, init))) {
    const taken = takeStampFromBody(init.body);
    if (taken.body !== init.body) init = { ...init, body: taken.body };
    stampHeaders = headersFromStamp(taken.stamp);
  }

  const headers = new Headers(init?.headers ?? (input && typeof input === 'object' && 'headers' in input ? (input as Request).headers : undefined));
  try {
    if (!headers.has('X-Device-Uid')) headers.set('X-Device-Uid', await getDeviceUid());
  } catch {
    /* sin identificador: la petición sigue */
  }
  // Equipo tal como lo ve Guardify y versión de la app (el servidor exige una versión mínima).
  const { deviceId } = getGuardifyIdentity();
  if (deviceId && !headers.has('X-Guardify-Device')) headers.set('X-Guardify-Device', deviceId);
  if (!headers.has('X-App-Version')) {
    try {
      const version = String(getEmbeddedAppVersionInfo().version ?? '').trim();
      if (version) headers.set('X-App-Version', version);
    } catch {
      /* sin versión: el servidor la trata como una app anterior */
    }
  }
  if (stampHeaders) {
    // El sello manda sobre las cabeceras del momento que `authedFetch` pudo haber puesto (no se mezclan valores de dos momentos).
    for (const k of ['X-Evidence-Lat', 'X-Evidence-Lng', 'X-Evidence-At', 'X-Evidence-Perm']) headers.delete(k);
    for (const [k, v] of Object.entries(stampHeaders)) headers.set(k, v);
  } else if (isMutatingMethod(requestMethod(input, init))) {
    const evidence = await getEvidenceHeaders();
    for (const [k, v] of Object.entries(evidence)) if (!headers.has(k)) headers.set(k, v);
  }
  return { ...(init ?? {}), headers };
}

/** Valor de una cabecera de `init.headers` (objeto, arreglo o `Headers`), sin distinguir mayúsculas. */
function headerValue(headers: unknown, name: string): string | null {
  try {
    if (!headers) return null;
    const lower = name.toLowerCase();
    if (typeof (headers as Headers).get === 'function') return (headers as Headers).get(name);
    if (Array.isArray(headers)) {
      const hit = (headers as [string, string][]).find(([k]) => String(k).toLowerCase() === lower);
      return hit ? String(hit[1]) : null;
    }
    for (const [k, v] of Object.entries(headers as Record<string, unknown>)) if (k.toLowerCase() === lower) return String(v);
  } catch {
    /* sin cabecera */
  }
  return null;
}

export function installEvidenceFetch(): void {
  if (g.__evidenceFetchInstalled || typeof g.fetch !== 'function') return;
  g.__evidenceFetchInstalled = true;
  const original = g.fetch.bind(globalThis);
  g.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    let nextInit = init;
    try {
      const apiBase = String(Constants.expoConfig?.extra?.API_SERVER ?? '').replace(/\/+$/, '');
      nextInit = await withEvidenceHeaders(input, init, apiBase);
    } catch {
      nextInit = init;
    }
    // Una escritura que el servidor ya negó por falta de permiso no se vuelve a enviar durante un rato (la cola sin conexión la reintentaba en
    // cada sincronización): se responde el mismo 403 sin salir a la red. La acción sigue en la cola y se reintenta cuando pasa ese tiempo.
    const method = requestMethod(input, nextInit);
    const url = requestUrl(input);
    const idempotencyKey = headerValue(nextInit?.headers, 'Idempotency-Key');
    const key = denialKey(method, url, nextInit?.body, idempotencyKey);
    const blocked = recentDenial(key);
    if (blocked) return deniedResponse(blocked.permission);

    const response = await original(input as RequestInfo, nextInit);
    // El servidor exige otra versión de la app (HTTP 426): se avisa a la app para que lo muestre. La respuesta sigue su camino.
    if (response.status === 426) void notifyIfUpdateRequired(response);
    // El servidor niega el permiso (403 `permission_denied|<permiso>`): se avisa una vez y se recuerda la acción.
    if (response.status === 403) void notifyIfPermissionDenied(response, { method, url, body: nextInit?.body, idempotencyKey });
    return response;
  };
}

installEvidenceFetch();
