/**
 * Borrado remoto de los datos de la app (`WIPE` de la consola de Guardify o equipo retirado, issue #147). Parte PURA, sin dependencias de React
 * Native para poder probarla en Node; la ejecución está en `guardifyClient.ts`.
 *
 * Regla: el usuario final NO debe perder trabajo por un borrado. Al llegar la orden la app se bloquea y primero intenta sincronizar lo que quedó
 * en las colas sin conexión (`*_actions`); cuando la cola queda vacía borra todo lo local. Si pasan 72 horas sin lograrlo (el equipo no vuelve
 * a conectarse o el servidor ya no lo acepta) borra de todos modos: para entonces el dato de un equipo perdido pesa más que lo pendiente.
 */
import { isQueueKey } from './evidenceQueue';

export const WIPE_MAX_WAIT_MS = 72 * 60 * 60 * 1000;

/** Llave (en el almacén seguro, bajo `guardify.`) de la orden de borrado pendiente: sobrevive a reinicios y al propio borrado. */
export const WIPE_ORDER_KEY = 'guardify.wipe_order';
/** Un equipo retirado ya se borró: evita repetir el borrado en cada arranque (se quita al registrar de nuevo el equipo). */
export const RETIRED_WIPED_KEY = 'guardify.retired_wiped';

export type WipeReason = 'wipe' | 'retired';
/** `orderedAt` es la hora de `getHoraAccion` (reloj de Costa Rica en ms), igual que `now` en `decideWipe`. */
export type WipeOrder = { orderedAt: number; reason: WipeReason };

export function parseWipeOrder(raw: unknown): WipeOrder | null {
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!v || typeof v !== 'object') return null;
    const orderedAt = Number((v as { orderedAt?: unknown }).orderedAt);
    const reason = (v as { reason?: unknown }).reason === 'retired' ? 'retired' : 'wipe';
    return Number.isFinite(orderedAt) && orderedAt > 0 ? { orderedAt, reason } : null;
  } catch {
    return null;
  }
}

export type WipeDecision = { action: 'wipe' | 'wait'; cause: 'synced' | 'deadline' | null; deadlineAt: number; remainingMs: number };

/** ¿Se borra ya? Sí si no queda nada por sincronizar o si venció el plazo; si no, se espera. */
export function decideWipe(p: { order: WipeOrder; pending: number; now: number; maxWaitMs?: number }): WipeDecision {
  const deadlineAt = p.order.orderedAt + (p.maxWaitMs ?? WIPE_MAX_WAIT_MS);
  const remainingMs = Math.max(0, deadlineAt - p.now);
  if (p.pending <= 0) return { action: 'wipe', cause: 'synced', deadlineAt, remainingMs };
  // Un reloj que retrocede (now < orderedAt) no alarga la espera más allá del plazo completo.
  if (p.now >= deadlineAt) return { action: 'wipe', cause: 'deadline', deadlineAt, remainingMs: 0 };
  return { action: 'wait', cause: null, deadlineAt, remainingMs: Math.min(remainingMs, p.maxWaitMs ?? WIPE_MAX_WAIT_MS) };
}

/** Colas que impiden borrar. El desregistro de la notificación push (`push_device_actions`) no es trabajo del usuario y no bloquea. */
export function isBlockingQueueKey(key: string): boolean {
  return isQueueKey(key) && key !== 'push_device_actions';
}

/** Cantidad de acciones pendientes en las colas: `entries` = pares [llave de AsyncStorage, valor guardado]. */
export function countPendingActions(entries: ReadonlyArray<readonly [string, string | null]>): number {
  let n = 0;
  for (const [key, value] of entries) {
    if (!isBlockingQueueKey(key) || !value) continue;
    try {
      const arr = JSON.parse(value);
      if (Array.isArray(arr)) n += arr.length;
    } catch {
      /* cola ilegible: no se cuenta (no se puede sincronizar y no debe trabar el borrado) */
    }
  }
  return n;
}

/** Llaves de `AsyncStorage` que el borrado conserva: el registro del equipo en Guardify y su identificador. */
export function shouldKeepKeyOnWipe(key: string): boolean {
  return key.startsWith('guardify.') || key === 'device_uid';
}

/** Entradas de `Paths.document` que el borrado NO toca (almacenamiento propio de React Native / Expo, no datos de la app). */
export function shouldKeepFileOnWipe(name: string): boolean {
  return /^(RCTAsyncLocalStorage|ExponentExperienceData|SecureStore|\.)/.test(name);
}

/** Texto del tiempo que falta para el plazo (para la pantalla): «71 h», «45 min». */
export function formatRemaining(ms: number): string {
  const min = Math.max(0, Math.ceil(ms / 60_000));
  return min >= 60 ? `${Math.ceil(min / 60)} h` : `${min} min`;
}
