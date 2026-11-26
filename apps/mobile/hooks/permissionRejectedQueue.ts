/**
 * Acciones de la cola sin conexión que el servidor rechazó por FALTA DE PERMISO (issue #211).
 *
 * Una acción guardada sin conexión que, al sincronizar, recibe 403 `permission_denied` no se puede arreglar reintentando: se reenviaba en cada
 * sincronización para siempre. Aquí se decide cuáles se quitan de la cola, y se deja constancia para avisar una vez a la persona.
 *
 * Cómo se reconoce la acción: cada acción encolada lleva un sello de evidencia (`__evidencia.at`, ver `evidenceQueue.ts`) que viaja como la
 * cabecera `X-Evidence-At` al reenviarla. El `fetch` global anota la hora de las acciones denegadas y, al empezar la siguiente sincronización
 * (cuando ninguna cola se está procesando), se quitan de las colas las acciones con esa hora. No se quita durante el recorrido de una cola porque
 * cada ciclo reescribe su cola completa y volvería a dejar la acción.
 *
 * Solo se quitan las acciones con sello. Las anteriores a esa versión no se pueden reconocer: siguen como antes (frenadas por
 * `permissionDeniedNotice.ts` durante un rato). Módulo PURO: se prueba en Node; el almacenamiento está en `installQueueOwnership.ts`.
 */
import { stampAtOf } from './evidenceQueue';

/** Dónde se guardan las horas de las acciones denegadas (no termina en `_actions`: no es una cola). */
export const DENIED_STAMPS_KEY = 'queue_denied_stamps_v1' as const;
/** Evento que se emite cuando se quitaron acciones de la cola por falta de permiso. */
export const QUEUE_PERMISSION_REJECTED_EVENT = 'queuePermissionRejected' as const;
export type QueuePermissionRejectedPayload = { count: number; permissions: string[] };

/** Cuánto se recuerda una denegación: igual que la caducidad de las colas de un usuario que no se conecta; pasado eso la acción ya no puede estar en la cola. */
export const DENIED_STAMP_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
export const MAX_DENIED_STAMPS = 200;

export type DeniedStamp = { permission: string | null; at: number; notified?: boolean };
export type DeniedStamps = Record<string, DeniedStamp>;

export function parseDeniedStamps(raw: string | null | undefined): DeniedStamps {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    if (v === null || typeof v !== 'object' || Array.isArray(v)) return {};
    const out: DeniedStamps = {};
    for (const [k, e] of Object.entries(v as Record<string, unknown>)) {
      if (!/^\d+$/.test(k) || e === null || typeof e !== 'object') continue;
      const { permission, at, notified } = e as { permission?: unknown; at?: unknown; notified?: unknown };
      const when = Number(at);
      if (!Number.isFinite(when) || when <= 0) continue;
      out[k] = { permission: typeof permission === 'string' && permission ? permission : null, at: when, ...(notified === true ? { notified: true } : {}) };
    }
    return out;
  } catch {
    return {};
  }
}

/** Anota la hora de una acción denegada. Devuelve el texto a guardar (descarta lo viejo y limita el tamaño). */
export function addDeniedStamp(raw: string | null | undefined, stampAt: string, permission: string | null, now: number): string {
  const all = parseDeniedStamps(raw);
  if (!/^\d+$/.test(String(stampAt))) return JSON.stringify(all);
  const prev = all[stampAt];
  all[stampAt] = { permission: permission ?? prev?.permission ?? null, at: prev?.at ?? now, ...(prev?.notified ? { notified: true } : {}) };
  const kept = Object.entries(all)
    .filter(([, e]) => now - e.at <= DENIED_STAMP_MAX_AGE_MS)
    .sort((a, b) => b[1].at - a[1].at)
    .slice(0, MAX_DENIED_STAMPS);
  return JSON.stringify(Object.fromEntries(kept));
}

export type RejectedAction = { stampAt: string; permission: string | null };

/**
 * Quita de una cola (texto JSON) las acciones cuya hora de sello está entre las denegadas. Sin cambios devuelve el mismo texto;
 * `json: null` = la cola quedó vacía.
 */
export function splitRejected(json: string | null, denied: DeniedStamps): { json: string | null; rejected: RejectedAction[] } {
  if (!json || Object.keys(denied).length === 0) return { json, rejected: [] };
  let arr: unknown;
  try {
    arr = JSON.parse(json);
  } catch {
    return { json, rejected: [] };
  }
  if (!Array.isArray(arr)) return { json, rejected: [] };
  const kept: unknown[] = [];
  const rejected: RejectedAction[] = [];
  for (const el of arr) {
    const at = stampAtOf(el);
    const hit = at !== null ? denied[at] : undefined;
    if (at !== null && hit) rejected.push({ stampAt: at, permission: hit.permission });
    else kept.push(el);
  }
  if (rejected.length === 0) return { json, rejected };
  return { json: kept.length ? JSON.stringify(kept) : null, rejected };
}

/** De las acciones quitadas, las que todavía no se le avisaron a la persona (cada denegación avisa una sola vez, aunque la acción reaparezca). */
export function toNotify(rejected: RejectedAction[], denied: DeniedStamps): { payload: QueuePermissionRejectedPayload; stamps: string[] } | null {
  const stamps = [...new Set(rejected.map((r) => r.stampAt))].filter((s) => denied[s] && !denied[s]!.notified);
  if (stamps.length === 0) return null;
  const permissions = [...new Set(stamps.map((s) => denied[s]!.permission).filter((p): p is string => !!p))];
  return { payload: { count: rejected.filter((r) => stamps.includes(r.stampAt)).length, permissions }, stamps };
}

/** Marca como avisadas las denegaciones indicadas. Devuelve el texto a guardar. */
export function markNotified(denied: DeniedStamps, stamps: string[]): string {
  const next: DeniedStamps = { ...denied };
  for (const s of stamps) if (next[s]) next[s] = { ...next[s]!, notified: true };
  return JSON.stringify(next);
}

/** Texto para la persona. */
export function queueRejectedMessage(count: number): string {
  const n = Math.max(1, Math.round(count));
  return n === 1
    ? 'Una acción que guardaste sin conexión no se pudo enviar porque no tienes permiso para realizarla. Se quitó de los pendientes.'
    : `${n} acciones que guardaste sin conexión no se pudieron enviar porque no tienes permiso para realizarlas. Se quitaron de los pendientes.`;
}
