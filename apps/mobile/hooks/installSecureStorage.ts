/**
 * Conecta el enrutador de `secureStorageRouter.ts` con `AsyncStorage` y `expo-secure-store` (issue #144).
 *
 * Se importa PRIMERO en `index.js`: reemplaza los métodos de `AsyncStorage` para que las llaves sensibles (ver `SENSITIVE_STORAGE_KEYS`)
 * vayan al Keystore / Keychain. Así los ~140 archivos que usan `AsyncStorage` no cambian y, tras actualizar, no quedan tokens ni datos del
 * empleado en `AsyncStorage`: se migran al abrir la app y la sesión existente se conserva.
 *
 * `expo-secure-store` es un módulo nativo: en un APK anterior (sin el módulo) o en Expo Go se cae a `AsyncStorage` sin error.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createDeviceUidProvider,
  createSecureRouter,
  SENSITIVE_STORAGE_KEYS,
  withChunks,
  type SecureBackend,
} from './secureStorageRouter';

type SecureStoreModule = typeof import('expo-secure-store');

let SecureStore: SecureStoreModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SecureStore = require('expo-secure-store') as SecureStoreModule;
} catch {
  SecureStore = null; // APK sin el módulo nativo
}

/** Prefijo de las llaves en el Keystore/Keychain (solo admiten letras, números, `.`, `-` y `_`). */
const KEY_PREFIX = 'mntr.';

/** Disponible tras el primer desbloqueo del equipo: lo necesitan las tareas en segundo plano (notificaciones, sincronización). */
function secureOptions() {
  return SecureStore ? { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK } : undefined;
}

export const secureBackend: SecureBackend = {
  async isAvailable() {
    if (!SecureStore) return false;
    try {
      return await SecureStore.isAvailableAsync();
    } catch {
      return false;
    }
  },
  async get(key) {
    return SecureStore!.getItemAsync(KEY_PREFIX + key, secureOptions());
  },
  async set(key, value) {
    await SecureStore!.setItemAsync(KEY_PREFIX + key, value, secureOptions());
  },
  async remove(key) {
    await SecureStore!.deleteItemAsync(KEY_PREFIX + key, secureOptions());
  },
};

// Métodos originales: el enrutador los usa para las llaves no sensibles y para la migración.
const plain = {
  getItem: AsyncStorage.getItem.bind(AsyncStorage) as (key: string) => Promise<string | null>,
  setItem: AsyncStorage.setItem.bind(AsyncStorage) as (key: string, value: string) => Promise<void>,
  removeItem: AsyncStorage.removeItem.bind(AsyncStorage) as (key: string) => Promise<void>,
};
const originalMultiGet = AsyncStorage.multiGet.bind(AsyncStorage);
const originalMultiSet = AsyncStorage.multiSet.bind(AsyncStorage);
const originalMultiRemove = AsyncStorage.multiRemove.bind(AsyncStorage);

export const secureRouter = createSecureRouter({
  plain,
  secure: secureBackend,
  onError: (context, error) => console.warn(`[secure-storage] ${context}:`, error),
});

/** Reemplaza los métodos de `AsyncStorage` por los del enrutador (las llaves no sensibles siguen yendo al `AsyncStorage` original). */
export function installSecureStorage(): void {
  const target = AsyncStorage as unknown as Record<string, unknown>;
  if (target.__secureRouted) return;
  const sensitive = new Set<string>(SENSITIVE_STORAGE_KEYS);
  const split = <T,>(items: readonly T[], keyOf: (item: T) => string) => ({
    secure: items.filter((i) => sensitive.has(keyOf(i))),
    other: items.filter((i) => !sensitive.has(keyOf(i))),
  });

  target.getItem = (key: string) => secureRouter.getItem(key);
  target.setItem = (key: string, value: string) => secureRouter.setItem(key, value);
  target.removeItem = (key: string) => secureRouter.removeItem(key);
  target.multiGet = async (keys: readonly string[]) => {
    const { secure, other } = split(keys, (k) => k);
    const fromPlain = other.length ? await originalMultiGet(other as string[]) : [];
    const fromSecure = await secureRouter.multiGet(secure);
    const byKey = new Map<string, string | null>([...fromPlain, ...fromSecure].map(([k, v]) => [k, v]));
    return keys.map((k) => [k, byKey.get(k) ?? null] as [string, string | null]);
  };
  target.multiSet = async (pairs: readonly [string, string][]) => {
    const { secure, other } = split(pairs, (p) => p[0]);
    if (other.length) await originalMultiSet(other as [string, string][]);
    await secureRouter.multiSet(secure);
  };
  target.multiRemove = async (keys: readonly string[]) => {
    const { secure, other } = split(keys, (k) => k);
    if (other.length) await originalMultiRemove(other as string[]);
    await secureRouter.multiRemove(secure);
  };
  target.__secureRouted = true;
  // Arranca la migración sin esperar: las primeras lecturas de llaves sensibles esperan a que termine.
  void secureRouter.ready();
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Identificador único del equipo

const DEVICE_UID_KEY = 'device_uid';
const chunkedSecure = withChunks(secureBackend);

/** UUID del equipo (`deviceUid`): el mismo siempre, sobrevive al cierre de sesión y se pierde al desinstalar. */
export const getDeviceUid = createDeviceUidProvider({
  async read() {
    if (await secureBackend.isAvailable()) {
      try {
        const v = await chunkedSecure.get(DEVICE_UID_KEY);
        if (v) return v;
      } catch {
        /* se prueba AsyncStorage */
      }
    }
    return plain.getItem(DEVICE_UID_KEY);
  },
  async write(uid) {
    if (await secureBackend.isAvailable()) {
      try {
        await chunkedSecure.set(DEVICE_UID_KEY, uid);
        return;
      } catch {
        /* se guarda en AsyncStorage */
      }
    }
    await plain.setItem(DEVICE_UID_KEY, uid);
  },
  generate: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Crypto = require('expo-crypto') as typeof import('expo-crypto');
    return Crypto.randomUUID();
  },
});

/**
 * Almacén `get / set / remove` para el SDK de Guardify (credencial del equipo, estado): siempre en el almacén seguro cuando existe,
 * con las llaves bajo el prefijo `guardify.`.
 */
export const guardifyStorage = {
  async get(key: string): Promise<string | null> {
    if (await secureBackend.isAvailable()) return chunkedSecure.get(`guardify.${key}`);
    return plain.getItem(`guardify.${key}`);
  },
  async set(key: string, value: string): Promise<void> {
    if (await secureBackend.isAvailable()) return chunkedSecure.set(`guardify.${key}`, value);
    return plain.setItem(`guardify.${key}`, value);
  },
  async remove(key: string): Promise<void> {
    if (await secureBackend.isAvailable()) return chunkedSecure.remove(`guardify.${key}`);
    return plain.removeItem(`guardify.${key}`);
  },
};

installSecureStorage();
