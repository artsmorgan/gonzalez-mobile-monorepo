/**
 * Colas sin conexión (`*_actions`): propietario de cada acción y token de Planillas fuera de ellas (issues #176 H03 y #170 H01).
 * Módulo PURO, sin Expo/React Native: la capa (`createQueueLayer`) recibe el almacenamiento por parámetro, así que se prueba en Node con
 * `AsyncStorage` en memoria. La conexión real está en `installQueueOwnership.ts`.
 *
 * #176: antes todas las colas eran de «quien use el teléfono». Si entraba otro empleado se borraba lo pendiente del anterior, o se le
 * sincronizaba con la sesión equivocada. Ahora cada acción guardada lleva `__owner = { empleadoId, orgId }` (la sesión que la creó) y:
 *  - cada usuario ve en `getItem` SOLO sus acciones (más las anteriores a esta versión, que no tienen propietario) y sin el campo `__owner`;
 *  - al guardar, las acciones ajenas se conservan intactas y las propias se sellan; vaciar la cola no borra lo ajeno;
 *  - sin sesión (cerrada) no se filtra nada: comportamiento de siempre.
 *  Las pantallas y los ciclos de sincronización no cambian: ven una cola que solo contiene lo suyo.
 *
 * #170: el token de Planillas es una credencial de sesión y vive solo en el almacén seguro. Antes se copiaba dentro de las acciones
 * encoladas (`planillasToken`), en claro en AsyncStorage. Ahora la capa lo quita de todo lo que se guarda, y `scrubStoredQueues` limpia lo
 * que ya estaba guardado sin perder ninguna acción. Al enviar, cada llamada toma el token vigente del almacén seguro.
 */
import { isQueueKey } from './evidenceQueue';

export const OWNER_KEY = '__owner' as const;

/** Sesión que creó una acción: el empleado y la organización (servidor) en la que inició sesión. */
export type QueueOwner = { empleadoId: number; orgId: string | null };

const EMPLOYEE_KEY = 'employee_data';
/** Llaves con token en texto plano que NO son colas ni se tocan (el token de la sesión vive en el almacén seguro). */
const SESSION_TOKEN_KEYS = new Set(['planillas_token', 'planillas_token_expires_at']);
/** Además de las `*_actions`, la migración limpia la marca pendiente de versiones anteriores. */
const EXTRA_SCRUB_KEYS = ['marca_cache'];

// ---------------------------------------------------------------------------------------------------------------------------------
// Propietario

export function ownerFromEmployeeJson(raw: string | null | undefined, orgId: string | null): QueueOwner | null {
  if (!raw) return null;
  try {
    const id = Number((JSON.parse(raw) as { id?: unknown } | null)?.id);
    return Number.isFinite(id) && id > 0 ? { empleadoId: id, orgId } : null;
  } catch {
    return null;
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** Clave estable de un propietario (empleado + organización), para registros como la última conexión. */
export function ownerKey(o: QueueOwner): string {
  return `${o.orgId ?? ''}|${o.empleadoId}`;
}

export function ownerOf(el: unknown): QueueOwner | null {
  if (!isPlainObject(el)) return null;
  const o = el[OWNER_KEY];
  if (!isPlainObject(o)) return null;
  const id = Number(o.empleadoId);
  if (!Number.isFinite(id) || id <= 0) return null; // propietario mal formado = como si no tuviera
  return { empleadoId: id, orgId: typeof o.orgId === 'string' ? o.orgId : null };
}

function sameOwner(a: QueueOwner, b: QueueOwner): boolean {
  return a.empleadoId === b.empleadoId && a.orgId === b.orgId;
}

function parseArray(raw: string | null | undefined): unknown[] | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

/** Lo que ve `owner`: sus acciones y las sin propietario, sin el campo `__owner`. Lo que no es una cola de objetos se devuelve igual. */
export function viewForOwner(storedJson: string | null, owner: QueueOwner | null): string | null {
  if (!owner || !storedJson) return storedJson;
  const arr = parseArray(storedJson);
  if (!arr) return storedJson;
  const visible = arr
    .filter((el) => {
      const o = ownerOf(el);
      return o === null || sameOwner(o, owner);
    })
    .map((el) => {
      if (!isPlainObject(el) || !(OWNER_KEY in el)) return el;
      const { [OWNER_KEY]: _omit, ...rest } = el;
      return rest;
    });
  return JSON.stringify(visible);
}

/**
 * Valor a guardar cuando `owner` escribe `incomingJson` (su vista, ya modificada): las acciones ajenas que había se conservan, las propias
 * se sellan. `null` = no queda nada y hay que borrar la llave. Si lo que se guarda no es un arreglo de objetos se devuelve tal cual.
 */
export function mergeForWrite(existingJson: string | null, incomingJson: string, owner: QueueOwner | null): string | null {
  if (!owner) return incomingJson;
  const incoming = parseArray(incomingJson);
  if (!incoming || !incoming.every(isPlainObject)) return incomingJson;
  const foreign = (parseArray(existingJson) ?? []).filter((el) => {
    const o = ownerOf(el);
    return o !== null && !sameOwner(o, owner);
  });
  const mine = (incoming as Record<string, unknown>[]).map((el) => ({ ...el, [OWNER_KEY]: owner }));
  const all = [...foreign, ...mine];
  return all.length ? JSON.stringify(all) : null;
}

/** Valor que queda al quitar la llave de la cola: solo se van las acciones propias (y las sin propietario). `null` = borrar la llave. */
export function removeForOwner(existingJson: string | null, owner: QueueOwner | null): string | null {
  if (!owner) return null;
  const foreign = (parseArray(existingJson) ?? []).filter((el) => {
    const o = ownerOf(el);
    return o !== null && !sameOwner(o, owner);
  });
  return foreign.length ? JSON.stringify(foreign) : null;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Llaves únicas con propietario (p. ej. la firma manual pendiente de subir)

/**
 * Llaves que guardan UN valor pendiente de sincronizar (no una cola) y por eso también son de quien las creó. Se guardan por dentro como un
 * arreglo `[{ __owner, value }]`, uno por propietario, para que dos usuarios con algo pendiente no se pisen. Lo guardado antes de esta versión
 * (el valor en texto plano) lo ve cualquiera y se reemplaza al primer guardado.
 */
export const OWNED_SINGLETON_KEYS: readonly string[] = ['manual_signature_cache'];

export function isOwnedSingletonKey(key: string): boolean {
  return OWNED_SINGLETON_KEYS.includes(key);
}

type SingletonEntry = { value: string; [OWNER_KEY]?: QueueOwner };

/** Entradas del valor guardado; `legacy` = texto plano de una versión anterior (sin propietario). */
function singletonEntries(raw: string | null): SingletonEntry[] {
  if (!raw) return [];
  const arr = parseArray(raw);
  if (arr && arr.every((e) => isPlainObject(e) && typeof e.value === 'string')) return arr as SingletonEntry[];
  return [{ value: raw }];
}

/** Valor que ve `owner`: el suyo, o el heredado sin propietario. Sin sesión solo el heredado. */
export function singletonView(raw: string | null, owner: QueueOwner | null): string | null {
  const entries = singletonEntries(raw);
  const mine = owner ? entries.find((e) => { const o = ownerOf(e); return o !== null && sameOwner(o, owner); }) : undefined;
  if (mine) return mine.value;
  const legacy = entries.find((e) => ownerOf(e) === null);
  return legacy ? legacy.value : null;
}

/** Valor a guardar cuando `owner` escribe `value`: lo ajeno se conserva, lo propio y lo heredado se reemplazan. */
export function singletonWrite(raw: string | null, value: string, owner: QueueOwner): string {
  const foreign = singletonEntries(raw).filter((e) => { const o = ownerOf(e); return o !== null && !sameOwner(o, owner); });
  return JSON.stringify([...foreign, { value, [OWNER_KEY]: owner }]);
}

/** Valor que queda cuando `owner` borra el suyo: solo lo ajeno. `null` = borrar la llave. */
export function singletonErase(raw: string | null, owner: QueueOwner): string | null {
  const foreign = singletonEntries(raw).filter((e) => { const o = ownerOf(e); return o !== null && !sameOwner(o, owner); });
  return foreign.length ? JSON.stringify(foreign) : null;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Token de Planillas fuera de las colas

const TOKEN_KEY_RE = /^planillas[-_]?token$/i;
const SCRUB_MAX_DEPTH = 64;

/** Copia del valor sin ninguna clave `planillasToken` (en cualquier nivel). Lo que supere 64 niveles de anidación se descarta. */
export function scrubPlanillasTokens(value: unknown, depth = 0): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (depth > SCRUB_MAX_DEPTH) return null;
  if (Array.isArray(value)) return value.map((child) => scrubPlanillasTokens(child, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, child] of Object.entries(value as Record<string, unknown>)) {
    if (TOKEN_KEY_RE.test(k)) continue;
    out[k] = scrubPlanillasTokens(child, depth + 1);
  }
  return out;
}

const MAY_HAVE_TOKEN_RE = /planillas[-_]?token/i;

/** Texto JSON → mismo texto sin el token. Si no hay nada que quitar, o no es JSON de objeto/arreglo, se devuelve igual. */
export function scrubSerializedQueue(text: string): string {
  if (typeof text !== 'string' || text.length < 3) return text;
  const first = text.trimStart()[0];
  if (first !== '[' && first !== '{') return text;
  if (!MAY_HAVE_TOKEN_RE.test(text)) return text;
  try {
    return JSON.stringify(scrubPlanillasTokens(JSON.parse(text)));
  } catch {
    return text;
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Capa sobre el almacenamiento

export interface LayerStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  multiGet(keys: readonly string[]): Promise<readonly (readonly [string, string | null])[]>;
  multiSet(pairs: readonly [string, string][]): Promise<void>;
  multiRemove(keys: readonly string[]): Promise<void>;
  getAllKeys(): Promise<readonly string[]>;
}

/** Acceso a las colas SIN filtrar ni fusionar (borrado remoto, migraciones): ve y borra el trabajo de todos. */
export interface RawQueueAccess {
  getAllKeys(): Promise<readonly string[]>;
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  multiGet(keys: readonly string[]): Promise<readonly (readonly [string, string | null])[]>;
  multiRemove(keys: readonly string[]): Promise<void>;
}

/** Limpia el token de las colas ya guardadas (`*_actions` y `marca_cache`) sin perder ninguna acción. Idempotente. */
export async function scrubStoredQueues(storage: Pick<LayerStorage, 'getAllKeys' | 'getItem' | 'setItem'>): Promise<{ cleaned: number }> {
  let cleaned = 0;
  const keys = (await storage.getAllKeys()).filter((k) => isQueueKey(k) || EXTRA_SCRUB_KEYS.includes(k));
  for (const key of keys) {
    try {
      const raw = await storage.getItem(key);
      if (!raw) continue;
      const clean = scrubSerializedQueue(raw);
      if (clean !== raw) {
        await storage.setItem(key, clean);
        cleaned++;
      }
    } catch {
      /* una cola ilegible no detiene la limpieza de las demás */
    }
  }
  return { cleaned };
}

/**
 * Envuelve los métodos de `storage` (modifica el objeto). Devuelve el acceso sin filtrar. El propietario se deduce de las escrituras en
 * `employee_data` (inicio y cierre de sesión), sin que la capa dependa de `AuthContext`.
 */
export function createQueueLayer(
  storage: LayerStorage,
  opts: { getOrgId: () => string | null },
): {
  raw: RawQueueAccess;
  getOwner: () => Promise<QueueOwner | null>;
  /** Lee el valor CRUDO de una cola, lo transforma y lo guarda (`null` = borrar la llave), bajo el mismo bloqueo que las escrituras normales. */
  mutateQueue: (key: string, transform: (current: string | null) => string | null) => Promise<void>;
} {
  const raw = {
    getItem: storage.getItem.bind(storage),
    setItem: storage.setItem.bind(storage),
    removeItem: storage.removeItem.bind(storage),
    multiGet: storage.multiGet.bind(storage),
    multiSet: storage.multiSet.bind(storage),
    multiRemove: storage.multiRemove.bind(storage),
    getAllKeys: storage.getAllKeys.bind(storage),
  };

  let owner: QueueOwner | null = null;
  let ownerKnown = false;
  const getOwner = async (): Promise<QueueOwner | null> => {
    if (!ownerKnown) {
      try {
        owner = ownerFromEmployeeJson(await raw.getItem(EMPLOYEE_KEY), opts.getOrgId());
      } catch {
        owner = null;
      }
      ownerKnown = true;
    }
    return owner;
  };
  const onEmployeeWritten = (value: string | null) => {
    owner = ownerFromEmployeeJson(value, opts.getOrgId());
    ownerKnown = true;
  };

  // Una escritura de cola lee y vuelve a escribir: se serializa por llave para que dos guardados seguidos no se pisen.
  const locks = new Map<string, Promise<unknown>>();
  const withLock = <T>(key: string, fn: () => Promise<T>): Promise<T> => {
    const run = (locks.get(key) ?? Promise.resolve()).then(fn, fn);
    locks.set(key, run.then(() => undefined, () => undefined));
    return run;
  };

  const prepare = (key: string, value: string): string =>
    SESSION_TOKEN_KEYS.has(key) || typeof value !== 'string' ? value : scrubSerializedQueue(value);

  const write = async (key: string, value: string): Promise<void> => {
    const clean = prepare(key, value);
    if (key === EMPLOYEE_KEY) {
      await raw.setItem(key, clean);
      onEmployeeWritten(clean);
      return;
    }
    if (isOwnedSingletonKey(key)) {
      const who = await getOwner();
      if (!who) return raw.setItem(key, clean);
      return withLock(key, async () => raw.setItem(key, singletonWrite(await raw.getItem(key), clean, who)));
    }
    if (!isQueueKey(key)) return raw.setItem(key, clean);
    const who = await getOwner();
    if (!who) return raw.setItem(key, clean);
    return withLock(key, async () => {
      const merged = mergeForWrite(await raw.getItem(key), clean, who);
      if (merged === null) await raw.removeItem(key);
      else await raw.setItem(key, merged);
    });
  };

  const erase = async (key: string): Promise<void> => {
    if (key === EMPLOYEE_KEY) {
      await raw.removeItem(key);
      onEmployeeWritten(null);
      return;
    }
    if (isOwnedSingletonKey(key)) {
      const who = await getOwner();
      if (!who) return raw.removeItem(key);
      return withLock(key, async () => {
        const left = singletonErase(await raw.getItem(key), who);
        if (left === null) await raw.removeItem(key);
        else await raw.setItem(key, left);
      });
    }
    if (!isQueueKey(key)) return raw.removeItem(key);
    const who = await getOwner();
    if (!who) return raw.removeItem(key);
    return withLock(key, async () => {
      const left = removeForOwner(await raw.getItem(key), who);
      if (left === null) await raw.removeItem(key);
      else await raw.setItem(key, left);
    });
  };

  const view = async (key: string, stored: string | null): Promise<string | null> => {
    if (isQueueKey(key)) return viewForOwner(stored, await getOwner());
    if (isOwnedSingletonKey(key)) return singletonView(stored, await getOwner());
    return stored;
  };

  storage.getItem = async (key) => view(key, await raw.getItem(key));
  storage.setItem = (key, value) => write(key, value);
  storage.removeItem = (key) => erase(key);
  storage.multiGet = async (keys) => {
    const rows = await raw.multiGet(keys);
    const out: [string, string | null][] = [];
    for (const [k, v] of rows) out.push([k, await view(k, v)]);
    return out;
  };
  storage.multiSet = async (pairs) => {
    for (const [k, v] of pairs) await write(k, v);
  };
  storage.multiRemove = async (keys) => {
    for (const k of keys) await erase(k);
  };

  const mutateQueue = (key: string, transform: (current: string | null) => string | null): Promise<void> =>
    withLock(key, async () => {
      const next = transform(await raw.getItem(key));
      if (next === null) await raw.removeItem(key);
      else await raw.setItem(key, next);
    });

  return {
    raw: {
      getAllKeys: raw.getAllKeys,
      getItem: raw.getItem,
      setItem: raw.setItem,
      removeItem: raw.removeItem,
      multiGet: raw.multiGet,
      multiRemove: raw.multiRemove,
    },
    getOwner,
    mutateQueue,
  };
}
