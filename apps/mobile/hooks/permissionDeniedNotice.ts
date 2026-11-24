/**
 * Falta de permiso (fase 3 de roles de Guardify): aviso a la persona y freno a los reintentos de la cola.
 *
 * Con `GUARDIFY_PERMISSIONS=on` el servidor responde 403 `permission_denied|<permiso>` a una escritura de una pantalla para la que la persona no
 * tiene permiso. La sesión no se cierra (`apiFailure.ts`), pero cada pantalla mostraba su error genérico y la cola sin conexión reenviaba la misma
 * acción en cada sincronización, para siempre. Aquí, en un solo lugar (el `fetch` global, ver `installEvidenceFetch.ts`):
 *   1. se avisa UNA vez («No tienes permiso para realizar esta acción») en lugar de un error genérico por pantalla;
 *   2. se recuerda la acción denegada: durante un rato la misma petición no se vuelve a enviar al servidor (se responde el mismo 403 sin salir a la
 *      red). La acción NO se borra de la cola: si el permiso se concede después, se envía cuando pase el tiempo o al reiniciar la app.
 *
 * Módulo sin React Native: se prueba en Node.
 */
import { eventBus } from './eventBus';
import { isPermissionDeniedPayload } from './permissionDenied';

/** Evento que se emite cuando el servidor niega un permiso. */
export const PERMISSION_DENIED_EVENT = 'permissionDenied' as const;
export type PermissionDeniedPayload = { permission: string | null };

/** Texto para la persona (el mismo de `failureUserMessage('permission_denied')`). */
export const PERMISSION_DENIED_MESSAGE = 'No tienes permiso para realizar esta acción.';

/** Cuánto se recuerda una acción denegada: la misma petición no se reenvía durante este tiempo. */
export const DENIAL_MEMORY_MS = 2 * 60 * 60 * 1000;
/** El aviso a la persona no se repite para el mismo permiso antes de este tiempo. */
export const NOTICE_COOLDOWN_MS = 60 * 1000;
const MAX_REMEMBERED = 200;

/** Extrae el permiso de `message = permission_denied|<permiso>` (o null si el cuerpo no lo trae). */
export function permissionFromBody(body: unknown): string | null {
  const message = body && typeof body === 'object' ? String((body as { message?: unknown }).message ?? '') : '';
  const m = /^permission_denied\|(.+)$/.exec(message.trim());
  if (m) return m[1]!.trim() || null;
  // Respuesta ya reescrita con el texto para la persona (ver `friendlyPermissionResponse`): el permiso viaja aparte.
  const own = body && typeof body === 'object' ? (body as { permission?: unknown }).permission : null;
  return typeof own === 'string' && own.trim() ? own.trim() : null;
}

/**
 * Identificador de una petición de escritura: método + dirección + (clave de idempotencia, o el cuerpo si es texto). Un cuerpo que no es texto
 * (archivos, FormData) no se puede identificar sin leerlo entero: sin identificador no se frena nada (solo se avisa).
 */
export function denialKey(method: string, url: string, body: unknown, idempotencyKey?: string | null): string | null {
  const m = String(method ?? '').toUpperCase();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(m)) return null;
  const base = `${m} ${String(url).split('#')[0]}`;
  if (idempotencyKey && String(idempotencyKey).trim()) return `${base} #${String(idempotencyKey).trim()}`;
  if (typeof body === 'string') return `${base} @${body.length}:${body.slice(0, 120)}:${body.slice(-120)}`;
  return null;
}

const denied = new Map<string, { at: number; permission: string | null }>();
const lastNotice = new Map<string, number>();

/** Solo para pruebas y para limpiar al cambiar de usuario. */
export function resetPermissionDenials(): void {
  denied.clear();
  lastNotice.clear();
}

export function rememberDenial(key: string | null, permission: string | null, now: number = Date.now()): void {
  if (!key) return;
  denied.set(key, { at: now, permission });
  if (denied.size > MAX_REMEMBERED) {
    const oldest = [...denied.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) denied.delete(oldest[0]);
  }
}

/** ¿Esta misma petición fue denegada hace poco? Devuelve el permiso (o '' si no se conocía) o null si no hay que frenarla. */
export function recentDenial(key: string | null, now: number = Date.now()): { permission: string | null } | null {
  if (!key) return null;
  const e = denied.get(key);
  if (!e) return null;
  if (now - e.at > DENIAL_MEMORY_MS) {
    denied.delete(key);
    return null;
  }
  return { permission: e.permission };
}

/** La respuesta que daría el servidor, para una acción que no se reenvía. */
export function deniedResponse(permission: string | null): Response {
  return new Response(JSON.stringify({ status: false, code: 'permission_denied', permission, message: PERMISSION_DENIED_MESSAGE }), {
    status: 403,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

/** Decide si el aviso sale ahora (una vez por permiso y por minuto). */
export function shouldNotify(permission: string | null, now: number = Date.now()): boolean {
  const k = permission ?? '';
  const last = lastNotice.get(k) ?? 0;
  if (now - last < NOTICE_COOLDOWN_MS) return false;
  lastNotice.set(k, now);
  return true;
}

/**
 * Si la respuesta es un 403 por falta de permiso: recuerda la acción y avisa a la app. Nunca lanza ni consume la respuesta original.
 */
export async function notifyIfPermissionDenied(
  response: Response,
  request: { method: string; url: string; body?: unknown; idempotencyKey?: string | null },
): Promise<{ permission: string | null } | null> {
  try {
    if (response.status !== 403) return null;
    const body = await response.clone().json().catch(() => null);
    if (!isPermissionDeniedPayload(body)) return null;
    const permission = permissionFromBody(body);
    rememberDenial(denialKey(request.method, request.url, request.body, request.idempotencyKey), permission);
    if (shouldNotify(permission)) eventBus.emit(PERMISSION_DENIED_EVENT, { permission } satisfies PermissionDeniedPayload);
    return { permission };
  } catch {
    /* el aviso es complementario: la respuesta original sigue su camino */
    return null;
  }
}

/**
 * La respuesta de una falta de permiso con el texto para la persona en `message` (en lugar del técnico `permission_denied|<permiso>`): las pantallas
 * muestran `message` tal cual, así que TODAS dicen «No tienes permiso para realizar esta acción» sin tocarlas una por una. El código estable
 * `code: "permission_denied"` se conserva (la app lo reconoce por él) y el permiso pasa a `permission`. Cualquier otra respuesta se devuelve igual.
 */
export async function friendlyPermissionResponse(response: Response, permission: string | null): Promise<Response> {
  try {
    const body = await response.clone().json().catch(() => null);
    if (!body || typeof body !== 'object' || !isPermissionDeniedPayload(body)) return response;
    const headers = new Headers(response.headers);
    headers.delete('content-length');
    headers.set('content-type', 'application/json; charset=utf-8');
    return new Response(JSON.stringify({ ...body, code: 'permission_denied', permission, message: PERMISSION_DENIED_MESSAGE }), {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch {
    return response;
  }
}
