/**
 * Almacenamiento seguro de la sesión (issue #144): las llaves sensibles (tokens, datos y roles del empleado) viven en `expo-secure-store`
 * (Keystore / Keychain) y el resto de la app sigue usando `AsyncStorage` sin cambios.
 *
 * Este módulo es PURO (sin importar React Native ni Expo): recibe los dos almacenes por parámetro, así que se prueba en Node. La conexión
 * real con `AsyncStorage` y `expo-secure-store` está en `installSecureStorage.ts`.
 *
 * - `createSecureRouter` expone la misma interfaz de `AsyncStorage` (getItem, setItem, removeItem, multiGet, multiSet, multiRemove). Las
 *   llaves sensibles van al almacén seguro; las demás, al normal.
 * - Migración al abrir: si una llave sensible sigue en `AsyncStorage` (instalación anterior) se copia al almacén seguro, se verifica la
 *   lectura y SOLO ENTONCES se borra del normal. La sesión existente no se pierde.
 * - Credenciales NUNCA en claro (issue #173): si el almacén seguro no está disponible o rechaza la escritura de una llave sensible, `setItem`
 *   lanza `SecureStorageError` (tipado) y no escribe nada en `AsyncStorage`. El respaldo en claro solo existe con `allowPlainFallback`
 *   (desarrollo / Expo Go). Leer lo que una versión anterior dejó en `AsyncStorage` sigue funcionando para no perder la sesión.
 * - Borrado que falla (issue #173): no se oculta ni se da por hecho. La llave queda como PENDIENTE (persistida en `secure_pending_deletes`), no
 *   se vuelve a leer su valor viejo y se reintenta al abrir la app, al leerla y con `retryPendingDeletes()`.
 */

/** Llaves de la sesión que no deben quedar en `AsyncStorage` (el rol del empleado va dentro de `employee_data`). */
export const SENSITIVE_STORAGE_KEYS = [
  'access_token',
  'refresh_token',
  'token_created_at',
  'employee_data',
  'planillas_token',
  'planillas_token_expires_at',
  'auth_session_mode',
] as const;

export type SecureStorageErrorCode = 'secure_unavailable' | 'secure_write_failed';

/** La credencial no se pudo guardar de forma segura; NO se escribió en claro. */
export class SecureStorageError extends Error {
  readonly code: SecureStorageErrorCode;
  readonly key: string;
  constructor(code: SecureStorageErrorCode, key: string, cause?: unknown) {
    super(
      code === 'secure_unavailable'
        ? `El almacenamiento seguro del equipo no está disponible (${key}).`
        : `No se pudo guardar ${key} en el almacenamiento seguro del equipo.`,
    );
    this.name = 'SecureStorageError';
    this.code = code;
    this.key = key;
    (this as { cause?: unknown }).cause = cause;
  }
}

export function isSecureStorageError(e: unknown): e is SecureStorageError {
  return e instanceof SecureStorageError || (e as { name?: unknown } | null)?.name === 'SecureStorageError';
}

/** Llaves cuyo borrado seguro falló y se reintenta (solo nombres, nunca valores). Vive en el almacén normal. */
export const PENDING_SECURE_DELETES_KEY = 'secure_pending_deletes' as const;

/** Intentos de escritura segura antes de rendirse (un fallo pasajero del Keystore no debe cerrar la sesión). */
const SECURE_WRITE_ATTEMPTS = 2;

export interface PlainStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface SecureBackend {
  isAvailable(): Promise<boolean>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

/** El Keystore / Keychain recomienda valores de hasta ~2 KB: se parten en trozos de este tamaño. */
export const SECURE_CHUNK_SIZE = 1500;
const CHUNK_MARKER = '__securechunks__:';

/** Envuelve un almacén seguro para guardar valores de cualquier tamaño partiéndolos en trozos (`llave.part0`, `llave.part1`…). */
export function withChunks(backend: SecureBackend, chunkSize = SECURE_CHUNK_SIZE): SecureBackend {
  const chunkCount = (marker: string | null): number => {
    if (!marker || !marker.startsWith(CHUNK_MARKER)) return 0;
    const n = Number(marker.slice(CHUNK_MARKER.length));
    return Number.isInteger(n) && n > 0 ? n : 0;
  };
  return {
    isAvailable: () => backend.isAvailable(),
    async get(key) {
      const head = await backend.get(key);
      const n = chunkCount(head);
      if (!n) return head;
      const parts: string[] = [];
      for (let i = 0; i < n; i++) {
        const part = await backend.get(`${key}.part${i}`);
        if (part == null) return null; // trozos incompletos: se trata como ausente
        parts.push(part);
      }
      return parts.join('');
    },
    async set(key, value) {
      const previous = chunkCount(await backend.get(key));
      if (value.length <= chunkSize) {
        await backend.set(key, value);
        for (let i = 0; i < previous; i++) await backend.remove(`${key}.part${i}`);
        return;
      }
      const parts: string[] = [];
      for (let i = 0; i < value.length; i += chunkSize) parts.push(value.slice(i, i + chunkSize));
      for (let i = 0; i < parts.length; i++) await backend.set(`${key}.part${i}`, parts[i]!);
      await backend.set(key, `${CHUNK_MARKER}${parts.length}`);
      for (let i = parts.length; i < previous; i++) await backend.remove(`${key}.part${i}`);
    },
    async remove(key) {
      const previous = chunkCount(await backend.get(key));
      for (let i = 0; i < previous; i++) await backend.remove(`${key}.part${i}`);
      await backend.remove(key);
    },
  };
}

export interface SecureRouter extends PlainStorage {
  multiGet(keys: readonly string[]): Promise<[string, string | null][]>;
  multiSet(pairs: readonly [string, string][]): Promise<void>;
  multiRemove(keys: readonly string[]): Promise<void>;
  /** Fuerza la verificación de disponibilidad y la migración (se hace sola en la primera operación). */
  ready(): Promise<void>;
  /** ¿Se está usando el almacén seguro? (false si no está disponible). */
  isSecure(): boolean;
  /** Llaves cuyo borrado seguro falló y siguen pendientes. */
  getPendingDeletes(): string[];
  /** Reintenta los borrados pendientes y devuelve los que siguen pendientes. */
  retryPendingDeletes(): Promise<string[]>;
}

export function createSecureRouter(opts: {
  plain: PlainStorage;
  secure: SecureBackend;
  sensitiveKeys?: readonly string[];
  onError?: (context: string, error: unknown) => void;
  /**
   * Solo desarrollo / Expo Go: permite guardar credenciales en `AsyncStorage` cuando el almacén seguro no está o falla.
   * En producción debe ser `false` (valor por defecto): es la degradación a texto plano que corrige el issue #173.
   */
  allowPlainFallback?: boolean;
}): SecureRouter {
  const sensitive = new Set<string>(opts.sensitiveKeys ?? SENSITIVE_STORAGE_KEYS);
  const secure = withChunks(opts.secure);
  const { plain } = opts;
  const report = opts.onError ?? (() => undefined);
  const allowPlain = opts.allowPlainFallback === true;
  let secureOk = false;
  let readyPromise: Promise<void> | null = null;
  let migrated = false;
  const pending = new Set<string>();

  const persistPending = async (): Promise<void> => {
    try {
      if (pending.size === 0) await plain.removeItem(PENDING_SECURE_DELETES_KEY);
      else await plain.setItem(PENDING_SECURE_DELETES_KEY, JSON.stringify([...pending]));
    } catch (e) {
      report('registro de borrados pendientes', e); // queda en memoria y se reintenta en esta ejecución
    }
  };

  const loadPending = async (): Promise<void> => {
    try {
      const raw = await plain.getItem(PENDING_SECURE_DELETES_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) for (const k of parsed) if (typeof k === 'string' && sensitive.has(k)) pending.add(k);
    } catch (e) {
      report('lectura de borrados pendientes', e);
    }
  };

  /** Intenta borrar una llave pendiente; `true` si ya no está en el almacén seguro. */
  const tryDeletePending = async (key: string): Promise<boolean> => {
    try {
      await secure.remove(key);
    } catch (e) {
      report(`reintento de borrado de ${key}`, e);
      return false;
    }
    pending.delete(key);
    return true;
  };

  const retryPendingDeletes = async (): Promise<string[]> => {
    await ready();
    if (pending.size === 0) return [];
    if (secureOk) {
      let changed = false;
      for (const key of [...pending]) if (await tryDeletePending(key)) changed = true;
      if (changed) await persistPending();
    }
    return [...pending];
  };

  const migrate = async () => {
    for (const key of sensitive) {
      try {
        const legacy = await plain.getItem(key);
        if (legacy == null) continue;
        const current = await secure.get(key);
        if (current == null) {
          await secure.set(key, legacy);
          if ((await secure.get(key)) !== legacy) continue; // no se pudo verificar: se deja en AsyncStorage
        }
        await plain.removeItem(key);
      } catch (e) {
        report(`migración de ${key}`, e);
      }
    }
  };

  const ready = (): Promise<void> => {
    if (!readyPromise) {
      readyPromise = (async () => {
        try {
          secureOk = await secure.isAvailable();
        } catch {
          secureOk = false;
        }
        await loadPending();
        if (secureOk) {
          await migrate();
          migrated = true;
          if (pending.size > 0) {
            let changed = false;
            for (const key of [...pending]) if (await tryDeletePending(key)) changed = true;
            if (changed) await persistPending();
          }
        }
      })();
    }
    return readyPromise;
  };

  /** Si el almacén seguro estaba momentáneamente no disponible, lo vuelve a probar (y migra) en vez de quedar fijado en «no disponible». */
  const reprobe = async (): Promise<void> => {
    if (secureOk) return;
    try {
      secureOk = await secure.isAvailable();
    } catch {
      secureOk = false;
    }
    if (secureOk && !migrated) {
      await migrate();
      migrated = true;
    }
  };

  const useSecure = async (key: string): Promise<boolean> => {
    await ready();
    return secureOk && sensitive.has(key);
  };

  const getItem = async (key: string): Promise<string | null> => {
    await ready();
    // Un borrado pendiente nunca devuelve el valor viejo: se reintenta y, si sigue sin poder borrarse, se trata como ausente.
    if (pending.has(key)) {
      if (secureOk && (await tryDeletePending(key))) await persistPending();
      if (pending.has(key)) return null;
    }
    if (await useSecure(key)) {
      try {
        const v = await secure.get(key);
        if (v != null) return v;
      } catch (e) {
        report(`lectura de ${key}`, e);
      }
      return plain.getItem(key); // por si quedó solo en AsyncStorage (falló una escritura segura)
    }
    return plain.getItem(key);
  };

  const setItem = async (key: string, value: string): Promise<void> => {
    await ready();
    if (!sensitive.has(key)) {
      await plain.setItem(key, value);
      return;
    }
    if (!secureOk) await reprobe();
    if (!secureOk) {
      if (allowPlain) {
        await plain.setItem(key, value);
        return;
      }
      throw new SecureStorageError('secure_unavailable', key);
    }

    let lastError: unknown = null;
    for (let attempt = 0; attempt < SECURE_WRITE_ATTEMPTS; attempt++) {
      try {
        await secure.set(key, value);
        lastError = null;
        break;
      } catch (e) {
        lastError = e;
        report(`escritura de ${key}`, e);
      }
    }
    if (lastError) {
      if (allowPlain) {
        await plain.setItem(key, value);
        return;
      }
      throw new SecureStorageError('secure_write_failed', key, lastError);
    }

    if (pending.delete(key)) await persistPending(); // el valor nuevo sustituye al que estaba por borrarse
    try {
      await plain.removeItem(key);
    } catch (e) {
      report(`limpieza de ${key} en AsyncStorage`, e);
    }
  };

  const removeItem = async (key: string): Promise<void> => {
    if (await useSecure(key)) {
      try {
        await secure.remove(key);
        if (pending.delete(key)) await persistPending();
      } catch (e) {
        // No se oculta: queda pendiente (persistido), no se vuelve a leer su valor y se reintenta.
        report(`borrado de ${key}`, e);
        pending.add(key);
        await persistPending();
      }
    }
    await plain.removeItem(key);
  };

  return {
    ready,
    isSecure: () => secureOk,
    getItem,
    setItem,
    removeItem,
    async multiGet(keys) {
      const out: [string, string | null][] = [];
      for (const k of keys) out.push([k, await getItem(k)]);
      return out;
    },
    async multiSet(pairs) {
      for (const [k, v] of pairs) await setItem(k, v);
    },
    async multiRemove(keys) {
      // Un error en una llave no debe dejar las demás sin borrar (cerrar sesión debe intentarlas todas).
      let firstError: unknown = null;
      for (const k of keys) {
        try {
          await removeItem(k);
        } catch (e) {
          firstError = firstError ?? e;
        }
      }
      if (firstError) throw firstError;
    },
    getPendingDeletes: () => [...pending],
    retryPendingDeletes,
  };
}

/**
 * Identificador único del equipo (issue #144): el mismo en cada llamada, sobrevive a cerrar sesión y se pierde al desinstalar.
 * `read`/`write` apuntan al almacén seguro (o a `AsyncStorage` si no está disponible); `generate` crea el UUID la primera vez.
 */
export function createDeviceUidProvider(opts: {
  read: () => Promise<string | null>;
  write: (uid: string) => Promise<void>;
  generate: () => string;
}): () => Promise<string> {
  let cached: Promise<string> | null = null;
  return () => {
    if (!cached) {
      cached = (async () => {
        const existing = (await opts.read().catch(() => null))?.trim();
        if (existing) return existing;
        const uid = opts.generate();
        await opts.write(uid);
        return uid;
      })().catch((e) => {
        cached = null; // permite reintentar si falló la lectura/escritura
        throw e;
      });
    }
    return cached;
  };
}
