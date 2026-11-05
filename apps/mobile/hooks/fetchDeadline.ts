import type { ApiFailureKind } from './apiFailure';

/**
 * Plazos y reintentos de las peticiones autenticadas (issue #172, H06). Módulo PURO, sin Expo/React Native, para probarlo en Node.
 *
 * Antes `authedFetch` no tenía plazo: una petición colgada bloqueaba a todas las demás (comparten un mutex) y la pantalla quedaba cargando.
 * Ahora cada petición tiene un plazo según su tipo, y solo se reintenta lo que es seguro repetir.
 *
 * El plazo cubre hasta recibir la respuesta (las cabeceras); la lectura posterior del cuerpo es de quien llama.
 */
export const DEADLINES_MS = {
  /** Consultas (GET). */
  read: 20_000,
  /** Escrituras con JSON (POST/PUT/PATCH/DELETE). */
  write: 30_000,
  /** Subidas de archivos (FormData). */
  upload: 120_000,
} as const;

/** Tope de un plazo pedido explícitamente. */
export const MAX_DEADLINE_MS = 300_000;

/** Reintentos de una lectura que falló por red / tiempo / 5xx (una lectura repetida no cambia nada en el servidor). */
export const MAX_READ_RETRIES = 1;
/** Reintentos de una escritura que el que llama declaró idempotente. */
export const MAX_IDEMPOTENT_WRITE_RETRIES = 1;

const READ_METHODS = new Set(['GET', 'HEAD']);

function isReadMethod(method: string | undefined): boolean {
  return READ_METHODS.has(String(method ?? 'GET').toUpperCase());
}

function isUploadBody(body: unknown): boolean {
  return typeof FormData !== 'undefined' && body instanceof FormData;
}

/** Plazo en ms de una petición; `override` solo se acepta si es un número finito positivo (y se acota a `MAX_DEADLINE_MS`). */
export function resolveDeadlineMs(params: { method?: string; body?: unknown; override?: number | null }): number {
  const { method, body, override } = params;
  if (typeof override === 'number' && Number.isFinite(override) && override > 0) return Math.min(override, MAX_DEADLINE_MS);
  if (isReadMethod(method)) return DEADLINES_MS.read;
  return isUploadBody(body) ? DEADLINES_MS.upload : DEADLINES_MS.write;
}

export type DeadlineTimers = {
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
};

const defaultTimers: DeadlineTimers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

/**
 * Señal que se aborta al cumplirse el plazo o cuando quien llama cancela. `timedOut` distingue el plazo agotado de una cancelación.
 * `cancel()` limpia el temporizador (hay que llamarlo siempre al recibir respuesta o fallar).
 */
export function createDeadline(ms: number, callerSignal?: AbortSignal | null, timers: DeadlineTimers = defaultTimers) {
  const controller = new AbortController();
  let timedOut = false;
  const onCallerAbort = () => controller.abort();
  if (callerSignal) {
    if (callerSignal.aborted) controller.abort();
    else callerSignal.addEventListener('abort', onCallerAbort, { once: true });
  }
  const handle = timers.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, ms);
  return {
    signal: controller.signal,
    get timedOut() {
      return timedOut;
    },
    cancel() {
      timers.clearTimeout(handle);
      callerSignal?.removeEventListener('abort', onCallerAbort);
    },
  };
}

/**
 * ¿Se debe repetir la petición tras este fallo? `attempt` es la cantidad de reintentos ya hechos.
 *  - Solo fallos de red / tiempo agotado / 5xx: un permiso, una sesión o un equipo no mejoran repitiendo.
 *  - Lecturas: sí, `MAX_READ_RETRIES` veces.
 *  - Escrituras: NO, salvo que quien llama declare que el servidor es idempotente (si la primera sí llegó, repetirla duplicaría el registro).
 *    La acción en cola se conserva y se reintenta en la siguiente sincronización.
 */
export function shouldRetry(params: {
  method?: string;
  idempotent?: boolean;
  failure: ApiFailureKind | null;
  attempt: number;
}): boolean {
  const { method, idempotent = false, failure, attempt } = params;
  if (failure !== 'network' && failure !== 'timeout' && failure !== 'server_error') return false;
  if (isReadMethod(method)) return attempt < MAX_READ_RETRIES;
  return idempotent === true && attempt < MAX_IDEMPOTENT_WRITE_RETRIES;
}

/** Espera antes del siguiente reintento: crece y tiene tope. */
export function retryDelayMs(attempt: number): number {
  const n = Math.max(0, Math.floor(Number.isFinite(attempt) ? attempt : 0));
  return Math.min(500 * 2 ** n, 4000);
}
