/**
 * Caducidad de las colas de un usuario que no se conecta (colas por propietario, issue #176).
 *
 * Cada usuario conserva sus acciones pendientes aunque otros usuarios usen el equipo; se sincronizan cuando ESE usuario vuelve a conectarse.
 * Si pasa más de 2 semanas sin conectarse, sus acciones se eliminan, junto con los archivos de expo-files a los que esas acciones apuntan.
 *
 * «Se conecta» = una sincronización con conexión real y sesión activa de ese usuario (`touch` de la última conexión). Módulo PURO: el
 * almacenamiento y los archivos se inyectan, así que se prueba en Node. La conexión real está en `installQueueOwnership.ts`.
 *
 * Reglas:
 *  - Nunca caduca el usuario con la sesión activa. Sin sesión activa no se borra nada.
 *  - Un propietario con acciones y sin registro empieza a contar desde la primera vez que se le ve (no se borra de golpe al actualizar).
 *  - Las acciones sin propietario (anteriores a esta versión) no se pueden atribuir y no caducan.
 *  - Un archivo solo se borra si lo citan las acciones eliminadas, existe, no está protegido y NINGUNA acción restante lo cita.
 *  - Primero se reescriben las colas y después se borran los archivos: un corte deja archivos huérfanos, nunca acciones sin archivo.
 */
import { isQueueKey } from './evidenceQueue';
import { isOwnedSingletonKey, ownerKey, ownerOf, type QueueOwner } from './queueOwnership';

export const QUEUE_OWNER_MAX_IDLE_MS = 14 * 24 * 60 * 60 * 1000;
export const LAST_SEEN_KEY = 'queue_owner_last_seen_v1' as const;
/** La última conexión del usuario activo se vuelve a escribir como mucho cada tanto (la sincronización corre cada minuto). */
export const TOUCH_GRANULARITY_MS = 10 * 60 * 1000;

export type LastSeen = Record<string, number>;

export function parseLastSeen(raw: string | null | undefined): LastSeen {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    if (v === null || typeof v !== 'object' || Array.isArray(v)) return {};
    const out: LastSeen = {};
    for (const [k, t] of Object.entries(v as Record<string, unknown>)) {
      if (typeof t === 'number' && Number.isFinite(t) && t > 0) out[k] = t;
    }
    return out;
  } catch {
    return {};
  }
}

function parseArray(json: string | null | undefined): unknown[] | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

function keyOfElement(el: unknown): string | null {
  const o = ownerOf(el);
  return o ? ownerKey(o) : null;
}

/** Quita de una cola (texto JSON) las acciones de los propietarios dados. Sin cambios devuelve el mismo texto. `json: null` = quedó vacía. */
export function removeOwnersFromQueueJson(json: string | null, owners: ReadonlySet<string>): { json: string | null; removed: unknown[] } {
  const arr = parseArray(json);
  if (!arr || owners.size === 0) return { json, removed: [] };
  const removed: unknown[] = [];
  const kept: unknown[] = [];
  for (const el of arr) {
    const k = keyOfElement(el);
    (k !== null && owners.has(k) ? removed : kept).push(el);
  }
  if (removed.length === 0) return { json, removed };
  return { json: kept.length ? JSON.stringify(kept) : null, removed };
}

const MAX_NODES = 200_000;
const MAX_LEAF_CHARS = 1024;

/** Textos (hojas) de un valor, sin recursión (la cola viene de un almacenamiento editable). */
export function collectStrings(values: unknown[], into: Set<string>): void {
  const stack: unknown[] = [...values];
  let nodes = 0;
  while (stack.length && nodes++ < MAX_NODES) {
    const v = stack.pop();
    if (typeof v === 'string') {
      if (v.length > 0 && v.length <= MAX_LEAF_CHARS) into.add(v);
    } else if (Array.isArray(v)) {
      for (const c of v) stack.push(c);
    } else if (v !== null && typeof v === 'object') {
      for (const c of Object.values(v as Record<string, unknown>)) stack.push(c);
    }
  }
}

/** Nombre de archivo que un texto puede estar citando: el texto mismo o lo que sigue al último «/» (sin `?query` ni `#`). */
export function fileNamesOf(text: string): string[] {
  const clean = text.split(/[?#]/)[0] ?? text;
  const base = clean.slice(clean.lastIndexOf('/') + 1);
  return base && base !== text ? [text, base] : [text];
}

export type QueueSnapshot = { key: string; json: string | null };

export type RetentionPlan = {
  /** Registro de última conexión ya actualizado (conexión del activo, inicio de cuenta, olvido de quien ya no tiene acciones). */
  lastSeen: LastSeen;
  purgedOwners: string[];
  purgedActions: number;
  queueWrites: Array<{ key: string; json: string | null }>;
  filesToDelete: string[];
};

export function planRetention(p: {
  queues: QueueSnapshot[];
  lastSeen: LastSeen;
  now: number;
  currentOwner: QueueOwner | null;
  existingFiles: ReadonlySet<string>;
  isProtectedFile?: (name: string) => boolean;
  maxIdleMs?: number;
}): RetentionPlan {
  const maxIdle = p.maxIdleMs ?? QUEUE_OWNER_MAX_IDLE_MS;
  const current = p.currentOwner ? ownerKey(p.currentOwner) : null;
  const parsed = p.queues.map((q) => ({ key: q.key, arr: parseArray(q.json) }));

  const withActions = new Set<string>();
  for (const q of parsed) for (const el of q.arr ?? []) {
    const k = keyOfElement(el);
    if (k !== null) withActions.add(k);
  }

  // Quién caduca: con sesión activa, todo propietario ajeno con registro y más de `maxIdle` sin conectarse.
  const expired = new Set<string>();
  if (current !== null) {
    for (const k of withActions) {
      const seen = p.lastSeen[k];
      if (k !== current && seen !== undefined && seen <= p.now && p.now - seen > maxIdle) expired.add(k);
    }
  }

  const lastSeen: LastSeen = {};
  for (const k of withActions) {
    if (expired.has(k) || k === current) continue;
    const seen = p.lastSeen[k];
    lastSeen[k] = seen === undefined || seen > p.now ? p.now : seen; // sin registro: empieza a contar; «futuro»: se acota
  }
  if (current !== null) {
    const seen = p.lastSeen[current];
    lastSeen[current] = seen !== undefined && seen <= p.now && p.now - seen < TOUCH_GRANULARITY_MS ? seen : p.now;
  }

  const queueWrites: RetentionPlan['queueWrites'] = [];
  const removedAll: unknown[] = [];
  const remaining: unknown[] = [];
  for (const q of parsed) {
    if (!q.arr) continue;
    const r = removeOwnersFromQueueJson(JSON.stringify(q.arr), expired);
    if (r.removed.length) {
      removedAll.push(...r.removed);
      queueWrites.push({ key: q.key, json: r.json });
      if (r.json) remaining.push(...(JSON.parse(r.json) as unknown[]));
    } else {
      remaining.push(...q.arr);
    }
  }

  const filesToDelete: string[] = [];
  if (removedAll.length) {
    const cited = new Set<string>();
    collectStrings(removedAll, cited);
    const stillUsed = new Set<string>();
    const remainingTexts = new Set<string>();
    collectStrings(remaining, remainingTexts);
    for (const t of remainingTexts) for (const n of fileNamesOf(t)) stillUsed.add(n);
    const seenNames = new Set<string>();
    for (const t of cited) {
      for (const n of fileNamesOf(t)) {
        if (seenNames.has(n) || !p.existingFiles.has(n)) continue;
        seenNames.add(n);
        if (p.isProtectedFile?.(n) || stillUsed.has(n)) continue;
        filesToDelete.push(n);
      }
    }
  }

  return { lastSeen, purgedOwners: [...expired], purgedActions: removedAll.length, queueWrites, filesToDelete };
}

export interface RetentionStore {
  getAllKeys(): Promise<readonly string[]>;
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface RetentionFiles {
  list(): Promise<string[]>;
  remove(name: string): Promise<void>;
}

/** Aplica la caducidad: lee las colas SIN filtrar, reescribe las que cambian, borra los archivos y guarda el registro. Nunca lanza por un archivo. */
export async function runRetention(p: {
  store: RetentionStore;
  files: RetentionFiles;
  now: number;
  currentOwner: QueueOwner | null;
  /** Escritura de una cola bajo el bloqueo de la capa de propietarios (evita pisar un guardado simultáneo). */
  mutateQueue?: (key: string, transform: (current: string | null) => string | null) => Promise<void>;
  isProtectedFile?: (name: string) => boolean;
  maxIdleMs?: number;
}): Promise<RetentionPlan> {
  // Colas `*_actions` y llaves únicas con propietario (p. ej. la firma pendiente): lo pendiente de cada usuario.
  const keys = (await p.store.getAllKeys()).filter((k) => isQueueKey(k) || isOwnedSingletonKey(k));
  const queues: QueueSnapshot[] = [];
  for (const key of keys) queues.push({ key, json: await p.store.getItem(key) });
  const storedRaw = await p.store.getItem(LAST_SEEN_KEY);
  const lastSeen = parseLastSeen(storedRaw);
  let existingFiles = new Set<string>();
  try {
    existingFiles = new Set(await p.files.list());
  } catch {
    /* sin lista de archivos no se borra ninguno */
  }

  const plan = planRetention({ queues, lastSeen, now: p.now, currentOwner: p.currentOwner, existingFiles, isProtectedFile: p.isProtectedFile, maxIdleMs: p.maxIdleMs });

  const owners = new Set(plan.purgedOwners);
  const mutate =
    p.mutateQueue ??
    (async (key: string, transform: (current: string | null) => string | null) => {
      const next = transform(await p.store.getItem(key));
      if (next === null) await p.store.removeItem(key);
      else await p.store.setItem(key, next);
    });
  for (const w of plan.queueWrites) await mutate(w.key, (current) => removeOwnersFromQueueJson(current, owners).json);

  for (const name of plan.filesToDelete) {
    try {
      await p.files.remove(name);
    } catch {
      /* un archivo que no se deja borrar no detiene el resto */
    }
  }

  const next = JSON.stringify(plan.lastSeen);
  if (next !== JSON.stringify(lastSeen)) {
    if (Object.keys(plan.lastSeen).length === 0) await p.store.removeItem(LAST_SEEN_KEY);
    else await p.store.setItem(LAST_SEEN_KEY, next);
  }
  return plan;
}
