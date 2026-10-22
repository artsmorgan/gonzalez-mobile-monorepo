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
 * - Si el almacén seguro no está disponible (APK anterior sin el módulo nativo, Expo Go, web) todo sigue en `AsyncStorage` como hasta ahora.
 * - Si una operación del almacén seguro falla, se usa `AsyncStorage` para esa llave: es preferible conservar la sesión a dejar al guarda
 *   sin acceso por un error del Keystore.
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
}

export function createSecureRouter(opts: {
  plain: PlainStorage;
  secure: SecureBackend;
  sensitiveKeys?: readonly string[];
  onError?: (context: string, error: unknown) => void;
}): SecureRouter {
  const sensitive = new Set<string>(opts.sensitiveKeys ?? SENSITIVE_STORAGE_KEYS);
  const secure = withChunks(opts.secure);
  const { plain } = opts;
  const report = opts.onError ?? (() => undefined);
  let secureOk = false;
  let readyPromise: Promise<void> | null = null;

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
        if (secureOk) await migrate();
      })();
    }
    return readyPromise;
  };

  const useSecure = async (key: string): Promise<boolean> => {
    await ready();
    return secureOk && sensitive.has(key);
  };

  const getItem = async (key: string): Promise<string | null> => {
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
    if (await useSecure(key)) {
      try {
        await secure.set(key, value);
        await plain.removeItem(key);
        return;
      } catch (e) {
        report(`escritura de ${key}`, e);
        await plain.setItem(key, value);
        return;
      }
    }
    await plain.setItem(key, value);
  };

  const removeItem = async (key: string): Promise<void> => {
    if (await useSecure(key)) {
      try {
        await secure.remove(key);
      } catch (e) {
        report(`borrado de ${key}`, e);
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
      for (const k of keys) await removeItem(k);
    },
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
