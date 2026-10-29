import getValidAccessTokenOrLogout from './getValidAccessTokenOrLogout';
import { getDeviceUid } from './installSecureStorage';
import { handleDeviceNotApprovedResponse } from './deviceNotApproved';
import { getEvidenceHeaders, isMutatingMethod } from './evidenceCapture';
import {
    classifyHttpFailure,
    classifyThrownError,
    failureUserMessage,
    parseSessionRevokedMessage,
    shouldCloseSession,
    type ApiFailureKind,
} from './apiFailure';
import { createDeadline, resolveDeadlineMs, retryDelayMs, shouldRetry } from './fetchDeadline';
import { eventBus } from './eventBus';

/** Evento: el servidor cerró la sesión (p. ej. la revocó un administrador). Lleva `{ message, reason }` para avisar a la persona. */
export const SESSION_REVOKED_EVENT = 'sessionEndedByServer';

let lastFailure: { kind: ApiFailureKind; at: number } | null = null;

/** Causa del último fallo de `authedFetch` (red, tiempo agotado, permiso, equipo, sesión…); `null` si la última petición salió bien. */
export function getLastAuthedFailure(): { kind: ApiFailureKind; at: number } | null {
    return lastFailure;
}

function recordAuthedFailure(kind: ApiFailureKind): void {
    lastFailure = { kind, at: Date.now() };
}

function clearAuthedFailure(): void {
    lastFailure = null;
}

type AuthedFetchArgs = {
    url: string;
    init?: RequestInit;
    refreshAccessToken: () => Promise<boolean>;
    logout: () => Promise<any>;
    shouldUpdateServerTime?: boolean;
    /** Plazo de esta petición en ms (hasta recibir la respuesta). Por defecto depende del tipo: lectura, escritura o subida (`fetchDeadline.ts`). */
    timeoutMs?: number;
    /**
     * El servidor garantiza que repetir ESTA escritura no duplica nada. Solo así se reintenta sola tras un fallo de red / tiempo agotado / 5xx;
     * sin esto una escritura no se repite (la acción en cola se conserva y se reintenta en la siguiente sincronización).
     */
    idempotent?: boolean;
    /** Clave de idempotencia estable de la acción (p. ej. su id en la cola): viaja en `Idempotency-Key` para que el servidor pueda deduplicar. */
    idempotencyKey?: string;
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Mutex para asegurar que solo una ejecución ocurra a la vez
// Usamos una promesa que se resuelve cuando la ejecución actual termina
let executionQueue: Promise<Response | null> = Promise.resolve(null);

/**
 * Wrapper reutilizable para `fetch` autenticado:
 * - Hace preflight (`getValidAccessTokenOrLogout`) antes del request.
 * - Inyecta `Authorization: Bearer <token>` y `ngrok-skip-browser-warning`.
 * - Manda el identificador único del equipo (`X-Device-Uid`) para que el servidor sepa desde qué teléfono llega la petición.
 * - En las peticiones que guardan datos (POST/PUT/PATCH/DELETE) manda la evidencia de la acción (`X-Evidence-*`: ubicación, hora y permiso de GPS).
 * - Separa las causas del fallo (`apiFailure.ts`, issue #174) y deja la última en `getLastAuthedFailure()`:
 *   - 403 `device_not_approved` (equipo bloqueado / rechazado / retirado / pendiente) -> pantalla de estado del equipo, SIN cerrar la sesión.
 *   - 403 `permission_denied` (falta de permiso en esa operación) -> devuelve la respuesta SIN cerrar la sesión.
 *   - 403 `session_revoked` (un administrador cerró la sesión) -> avisa con su mensaje (`SESSION_REVOKED_EVENT`) y cierra la sesión.
 *   - 401 o cualquier otro 403 (token vencido / inválido) -> logout inmediato (sin retry).
 *   - 5xx, red caída o tiempo agotado -> NO cierran la sesión.
 * - Cada petición tiene un plazo (`AbortController`, issue #172): una colgada ya no bloquea al resto. Las lecturas se reintentan una vez ante
 *   red / tiempo agotado / 5xx; las escrituras NO se repiten solas salvo `idempotent: true`.
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
    timeoutMs,
    idempotent = false,
    idempotencyKey,
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
            };
            try {
                headers['X-Device-Uid'] = await getDeviceUid();
            } catch {
                /* sin identificador: la petición sigue (el servidor decide según GUARDIFY_DEVICE_ENFORCE) */
            }
            if (isMutatingMethod(init?.method)) {
                Object.assign(headers, await getEvidenceHeaders());
            }
            if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

            let response: Response | null = null;
            for (let attempt = 0; ; attempt++) {
                const deadline = createDeadline(
                    resolveDeadlineMs({ method: init?.method, body: init?.body, override: timeoutMs }),
                    init?.signal ?? null,
                );
                try {
                    response = await fetch(url, { ...(init ?? {}), headers, signal: deadline.signal });
                } catch (error) {
                    deadline.cancel();
                    const kind = deadline.timedOut ? 'timeout' : classifyThrownError(error);
                    if (shouldRetry({ method: init?.method, idempotent, failure: kind, attempt })) {
                        await sleep(retryDelayMs(attempt));
                        continue;
                    }
                    throw Object.assign(new Error(failureUserMessage(kind)), { name: kind === 'timeout' ? 'TimeoutError' : 'NetworkError' });
                }
                deadline.cancel();
                if (classifyHttpFailure(response.status, null) === 'server_error' && shouldRetry({ method: init?.method, idempotent, failure: 'server_error', attempt })) {
                    await sleep(retryDelayMs(attempt));
                    continue;
                }
                break;
            }

            if (await handleDeviceNotApprovedResponse(response)) {
                recordAuthedFailure('device_not_approved');
                return null;
            }

            const payload = response.status === 403 ? await response.clone().json().catch(() => null) : null;
            const failure = classifyHttpFailure(response.status, payload);

            if (failure === 'permission_denied') {
                recordAuthedFailure(failure);
                return response;
            }

            if (failure && shouldCloseSession(failure)) {
                recordAuthedFailure(failure);
                if (failure === 'session_revoked') {
                    const reason = parseSessionRevokedMessage((payload as { message?: unknown } | null)?.message)?.reason ?? null;
                    eventBus.emit(SESSION_REVOKED_EVENT, { message: failureUserMessage(failure), reason });
                }
                await logout();
                return null;
            }

            if (failure === 'server_error') recordAuthedFailure(failure);
            else clearAuthedFailure();
            return response;
        } catch (error) {
            // Sin respuesta (red caída, tiempo agotado): se devuelve null pero se deja la causa, y NO se cierra la sesión.
            recordAuthedFailure(classifyThrownError(error));
            return null;
        }
    })();

    return executionQueue;
}


