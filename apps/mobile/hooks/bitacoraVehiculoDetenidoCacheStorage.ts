import AsyncStorage from '@react-native-async-storage/async-storage';

/** Caché unificada por sucursal (corpo); lectura offline y tras CRUD / fetch. */
export const BITACORA_VEHICULO_DETENIDO_CACHE_KEY = 'bitacora_vehiculo_detenido_cache';

export type BitacoraVehiculoDetenidoCacheFile = {
  version: 1;
  bySucursalId: Record<string, any[]>;
};

function emptyState(): BitacoraVehiculoDetenidoCacheFile {
  return { version: 1, bySucursalId: {} };
}

/** Misma heurística que en bitacoraMainStructureCache (borradores / no sincronizados). */
export function isBitacoraDetenidoLocalDraftRow(b: any): boolean {
  if (!b) return false;
  if (b.id_local != null && String(b.id_local).trim() !== '') return true;
  if (b.id === 0 || b.id === '0') return true;
  if (typeof b.id === 'string' && String(b.id).startsWith('local-')) return true;
  if (b.synced === false) return true;
  return false;
}

function normalizeLoadedJson(parsed: any): BitacoraVehiculoDetenidoCacheFile {
  if (Array.isArray(parsed)) {
    const sid = Number(parsed[0]?.sucursal_id ?? parsed[0]?.corpo_id ?? 0);
    if (sid > 0) return { version: 1, bySucursalId: { [String(sid)]: parsed } };
    return emptyState();
  }
  if (parsed && typeof parsed === 'object' && parsed.bySucursalId && typeof parsed.bySucursalId === 'object') {
    return { version: 1, bySucursalId: { ...parsed.bySucursalId } };
  }
  return emptyState();
}

export async function loadBitacoraVehiculoDetenidoCacheFile(): Promise<BitacoraVehiculoDetenidoCacheFile> {
  const raw = await AsyncStorage.getItem(BITACORA_VEHICULO_DETENIDO_CACHE_KEY);
  if (!raw) return emptyState();
  try {
    return normalizeLoadedJson(JSON.parse(raw));
  } catch {
    return emptyState();
  }
}

export async function saveBitacoraVehiculoDetenidoCacheFile(state: BitacoraVehiculoDetenidoCacheFile): Promise<void> {
  await AsyncStorage.setItem(BITACORA_VEHICULO_DETENIDO_CACHE_KEY, JSON.stringify(state));
}

export async function hasBitacoraCacheKeyForSucursal(sucursalId: number): Promise<boolean> {
  const st = await loadBitacoraVehiculoDetenidoCacheFile();
  return Object.prototype.hasOwnProperty.call(st.bySucursalId, String(Number(sucursalId)));
}

export async function readBitacoraCacheRowsForSucursal(sucursalId: number): Promise<any[]> {
  const st = await loadBitacoraVehiculoDetenidoCacheFile();
  const rows = st.bySucursalId[String(Number(sucursalId))];
  return Array.isArray(rows) ? [...rows] : [];
}

export async function setBitacoraCacheRowsForSucursal(sucursalId: number, rows: any[]): Promise<void> {
  const st = await loadBitacoraVehiculoDetenidoCacheFile();
  st.bySucursalId[String(Number(sucursalId))] = Array.isArray(rows) ? [...rows] : [];
  await saveBitacoraVehiculoDetenidoCacheFile(st);
}

export async function findBitacoraRowInCacheByLocalKey(idLocal: string): Promise<{ row: any; sucursalId: number } | null> {
  if (!idLocal) return null;
  const st = await loadBitacoraVehiculoDetenidoCacheFile();
  for (const k of Object.keys(st.bySucursalId)) {
    const arr = st.bySucursalId[k];
    if (!Array.isArray(arr)) continue;
    const hit = arr.find((b: any) => String(b?.id_local) === String(idLocal));
    if (hit) return { row: hit, sucursalId: Number(k) };
  }
  return null;
}
