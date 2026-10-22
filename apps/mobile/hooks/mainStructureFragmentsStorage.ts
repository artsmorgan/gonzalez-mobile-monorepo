import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearMainStructureCacheLegacy,
  MAIN_STRUCTURE_FILE_FLAG_ASYNC_KEY,
  MAIN_STRUCTURE_MONOLITH_ASYNC_KEY,
} from './mainStructureCacheStorage';

/** Lista los nombres completos de las claves en AsyncStorage usadas para cada fragmento. */
export const MAIN_STRUCTURE_FRAGMENT_STORAGE_KEYS = 'main_structure_fragment_storage_keys';

/** Ubicaciones GPS guardadas al confirmar desde el dispositivo (no desde la respuesta main-structure). */
export const PUESTO_UBICACION_DISPOSITIVO_KEY = 'puesto_ubicacion_dispositivo_v1';

export type PuestoUbicacionDispositivoEntry = { lat: string; lng: string };

export async function readPuestoUbicacionDispositivoMap(): Promise<
  Record<string, PuestoUbicacionDispositivoEntry>
> {
  const raw = await AsyncStorage.getItem(PUESTO_UBICACION_DISPOSITIVO_KEY);
  if (!raw) return {};
  try {
    const o = JSON.parse(raw);
    return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
  } catch {
    return {};
  }
}

export async function writePuestoUbicacionDispositivo(
  puestoId: number,
  lat: string | null,
  lng: string | null,
): Promise<void> {
  const map = await readPuestoUbicacionDispositivoMap();
  const k = String(Number(puestoId));
  const lt = lat != null ? String(lat).trim() : '';
  const lg = lng != null ? String(lng).trim() : '';
  if (lt.length > 0 && lg.length > 0) {
    map[k] = { lat: lt, lng: lg };
  } else {
    delete map[k];
  }
  await AsyncStorage.setItem(PUESTO_UBICACION_DISPOSITIVO_KEY, JSON.stringify(map));
}

/**
 * Claves de jerarquía (monolito + registro de fragmentos + flag de archivo) que deben conservarse
 * en borrados masivos; si no, `main_structure_frag__*` queda huérfano o el merge devuelve [].
 */
export const MAIN_STRUCTURE_SWEEP_PRESERVE_ASYNC_KEYS: readonly string[] = [
  MAIN_STRUCTURE_MONOLITH_ASYNC_KEY,
  MAIN_STRUCTURE_FILE_FLAG_ASYNC_KEY,
  MAIN_STRUCTURE_FRAGMENT_STORAGE_KEYS,
  PUESTO_UBICACION_DISPOSITIVO_KEY,
];

/** Prefijo de cada clave física en AsyncStorage para un fragmento lógico. */
export const MAIN_STRUCTURE_FRAG_ASYNC_PREFIX = 'main_structure_frag__';

export function fragmentToAsyncStorageKey(logicalKey: string): string {
  return `${MAIN_STRUCTURE_FRAG_ASYNC_PREFIX}${logicalKey}`;
}

export function asyncStorageKeyToFragment(storageKey: string): string {
  return storageKey.startsWith(MAIN_STRUCTURE_FRAG_ASYNC_PREFIX)
    ? storageKey.slice(MAIN_STRUCTURE_FRAG_ASYNC_PREFIX.length)
    : storageKey;
}

/** Elimina todas las claves listadas en el registro anterior (y el registro). No escribe nada nuevo. */
export async function clearRegisteredMainStructureFragments(): Promise<void> {
  const raw = await AsyncStorage.getItem(MAIN_STRUCTURE_FRAGMENT_STORAGE_KEYS);
  if (!raw) return;
  let keys: string[] = [];
  try {
    keys = JSON.parse(raw);
  } catch {
    await AsyncStorage.removeItem(MAIN_STRUCTURE_FRAGMENT_STORAGE_KEYS);
    return;
  }
  if (!Array.isArray(keys) || keys.length === 0) {
    await AsyncStorage.removeItem(MAIN_STRUCTURE_FRAGMENT_STORAGE_KEYS);
    return;
  }
  await AsyncStorage.multiRemove([...keys, MAIN_STRUCTURE_FRAGMENT_STORAGE_KEYS]);
}

/**
 * Limpia fragmentos anteriores + cache monolítico legado, luego guarda un AsyncStorage por cada entrada de `fragments`.
 * Actualiza `main_structure_fragment_storage_keys` con el listado de claves físicas guardadas.
 */
export async function persistMainStructureFragments(fragments: Record<string, unknown>): Promise<void> {
  await clearRegisteredMainStructureFragments();

  const logicalKeys = Object.keys(fragments);
  if (logicalKeys.length === 0) {
    await AsyncStorage.setItem(MAIN_STRUCTURE_FRAGMENT_STORAGE_KEYS, JSON.stringify([]));
    // No borrar el caché monolítico aquí: el llamador suele escribir `writeMainStructureCacheString` justo después.
    return;
  }

  await clearMainStructureCacheLegacy();

  const pairs: [string, string][] = [];
  const storageKeys: string[] = [];

  for (const lk of logicalKeys) {
    const sk = fragmentToAsyncStorageKey(lk);
    storageKeys.push(sk);
    pairs.push([sk, JSON.stringify(fragments[lk])]);
  }

  await AsyncStorage.multiSet(pairs);
  await AsyncStorage.setItem(MAIN_STRUCTURE_FRAGMENT_STORAGE_KEYS, JSON.stringify(storageKeys));
}

/** Lee todos los fragmentos desde AsyncStorage y los devuelve con las claves lógicas del servidor. */
export async function loadMainStructureFragmentsObject(): Promise<Record<string, any> | null> {
  const raw = await AsyncStorage.getItem(MAIN_STRUCTURE_FRAGMENT_STORAGE_KEYS);
  if (!raw) return null;
  let storageKeys: string[] = [];
  try {
    storageKeys = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(storageKeys) || storageKeys.length === 0) return null;

  const rows = await AsyncStorage.multiGet(storageKeys);
  let missing = 0;
  const out: Record<string, any> = {};
  for (const [sk, val] of rows) {
    if (sk == null) continue;
    if (val == null) {
      missing += 1;
      continue;
    }
    const logical = asyncStorageKeyToFragment(sk);
    try {
      out[logical] = JSON.parse(val);
    } catch {
      out[logical] = val;
    }
  }
  if (storageKeys.length > 0 && missing > 0) {
    return null;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Como `loadMainStructureFragmentsObject`, pero no falla si falta alguna clave del registro:
 * útil cuando el índice y AsyncStorage están desalineados o solo existe un parche puntual
 * (p. ej. `sucursal_X_puestos` tras actualizar ubicación).
 * También incorpora claves físicas `main_structure_frag__*` que existan en disco pero no en el registro.
 */
export async function loadMainStructureFragmentsObjectAllowPartial(): Promise<Record<string, any> | null> {
  const out: Record<string, any> = {};

  const raw = await AsyncStorage.getItem(MAIN_STRUCTURE_FRAGMENT_STORAGE_KEYS);
  if (raw) {
    try {
      const storageKeys: string[] = JSON.parse(raw);
      if (Array.isArray(storageKeys) && storageKeys.length > 0) {
        const rows = await AsyncStorage.multiGet(storageKeys);
        for (const [sk, val] of rows) {
          if (!sk || val == null) continue;
          const logical = asyncStorageKeyToFragment(sk);
          try {
            out[logical] = JSON.parse(val);
          } catch {
            out[logical] = val;
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  const allKeys = await AsyncStorage.getAllKeys();
  const prefix = MAIN_STRUCTURE_FRAG_ASYNC_PREFIX;
  for (const ak of allKeys) {
    if (!ak.startsWith(prefix)) continue;
    const logical = asyncStorageKeyToFragment(ak);
    if (out[logical] !== undefined) continue;
    const val = await AsyncStorage.getItem(ak);
    if (val == null) continue;
    try {
      out[logical] = JSON.parse(val);
    } catch {
      out[logical] = val;
    }
  }

  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Actualiza un fragmento puntual y lo registra en `main_structure_fragment_storage_keys` si aún no estaba
 * (p. ej. patch de `puesto_{id}_articulos` desde Actividades).
 */
export async function writeMainStructureFragmentPatch(logicalKey: string, value: unknown): Promise<void> {
  const sk = fragmentToAsyncStorageKey(logicalKey);
  await AsyncStorage.setItem(sk, JSON.stringify(value));

  const raw = await AsyncStorage.getItem(MAIN_STRUCTURE_FRAGMENT_STORAGE_KEYS);
  let keys: string[] = [];
  if (raw) {
    try {
      keys = JSON.parse(raw);
    } catch {
      keys = [];
    }
  }
  if (!Array.isArray(keys)) keys = [];
  if (!keys.includes(sk)) {
    keys.push(sk);
    await AsyncStorage.setItem(MAIN_STRUCTURE_FRAGMENT_STORAGE_KEYS, JSON.stringify(keys));
  }
}

/** Encuentra `sucursal_id` a partir del fragmento `sucursal_*_puestos` que contiene el puesto. */
export function findSucursalIdForPuestoInFragments(fragments: Record<string, unknown>, puestoId: number): number | null {
  const pid = Number(puestoId);
  for (const k of Object.keys(fragments)) {
    const m = /^sucursal_(\d+)_puestos$/.exec(k);
    if (!m) continue;
    const list = fragments[k];
    if (!Array.isArray(list)) continue;
    if (list.some((p: unknown) => Number((p as { id?: unknown })?.id) === pid)) {
      return Number(m[1]);
    }
  }
  return null;
}

/**
 * Actualiza `ubicacion` del puesto dentro de `sucursal_[id]_puestos` y persiste el fragmento.
 * `lat` / `lng` en null limpian la ubicación en el árbol local (alineado con main-structure).
 *
 * @param sucursalIdHint - `corpo_id` / id de sucursal cuando ya se conoce (filtro o marca); evita fallos si la búsqueda por puesto en fragmentos no resuelve.
 */
async function readSucursalPuestosArrayFromDisk(sucursalId: number): Promise<any[] | null> {
  const k = `sucursal_${Number(sucursalId)}_puestos`;
  const raw = await AsyncStorage.getItem(fragmentToAsyncStorageKey(k));
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p : null;
  } catch {
    return null;
  }
}

export async function patchSucursalPuestosUbicacionInFragments(
  puestoId: number,
  lat: string | null,
  lng: string | null,
  sucursalIdHint?: number | null,
): Promise<void> {
  const fragments = (await loadMainStructureFragmentsObjectAllowPartial()) ?? {};
  const pid = Number(puestoId);

  const tryPatch = async (sid: number): Promise<boolean> => {
    const k = `sucursal_${sid}_puestos`;
    let list: any[] | null = Array.isArray(fragments[k]) ? fragments[k] : null;
    if (!Array.isArray(list)) {
      list = await readSucursalPuestosArrayFromDisk(sid);
    }
    if (!Array.isArray(list) || list.length === 0) return false;
    if (!list.some((p: unknown) => Number((p as { id?: unknown })?.id) === pid)) return false;
    const next = list.map((p: Record<string, unknown>) =>
      Number(p?.id) === pid ? { ...p, ubicacion: { lat, lng } } : p,
    );
    await writeMainStructureFragmentPatch(k, next);
    return true;
  };

  const hintNum =
    sucursalIdHint !== undefined && sucursalIdHint !== null ? Number(sucursalIdHint) : NaN;
  if (Number.isFinite(hintNum) && hintNum > 0) {
    if (await tryPatch(hintNum)) return;
  }

  let sid = findSucursalIdForPuestoInFragments(fragments, puestoId);
  if (sid != null && (await tryPatch(sid))) return;

  const allKeys = await AsyncStorage.getAllKeys();
  const re = /^main_structure_frag__sucursal_(\d+)_puestos$/;
  for (const ak of allKeys) {
    const m = re.exec(ak);
    if (!m) continue;
    const cand = Number(m[1]);
    if (!Number.isFinite(cand) || cand <= 0) continue;
    if (await tryPatch(cand)) return;
  }
}
