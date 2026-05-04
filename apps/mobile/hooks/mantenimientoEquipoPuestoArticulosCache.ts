import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Lista del puesto en AsyncStorage: clave `puesto_{id}_articulos`.
 * Es la **única** caché persistida de la lista (mantenimientos + movimientos) para el módulo Equipo
 * en offline y la que debe leerse sin conexión; alineada con el fragmento de jerarquía del mismo nombre.
 */
export function puestoArticulosStorageKey(puestoId: number | string | null | undefined): string {
  const n = puestoId != null && puestoId !== '' ? String(puestoId) : 'current';
  return `puesto_${n}_articulos`;
}

export async function readPuestoArticulosList(puestoId: number | null | undefined): Promise<any[] | null> {
  if (puestoId == null || !Number.isFinite(Number(puestoId)) || Number(puestoId) <= 0) return null;
  try {
    const s = await AsyncStorage.getItem(puestoArticulosStorageKey(Number(puestoId)));
    if (!s) return null;
    const p = JSON.parse(s);
    return Array.isArray(p) && p.length > 0 ? p : null;
  } catch {
    return null;
  }
}

export async function writePuestoArticulosList(puestoId: number, list: any[]): Promise<void> {
  if (!Number.isFinite(Number(puestoId)) || Number(puestoId) <= 0) return;
  await AsyncStorage.setItem(puestoArticulosStorageKey(Number(puestoId)), JSON.stringify(list));
}

export async function clearPuestoArticulosList(puestoId: number | null | undefined): Promise<void> {
  if (puestoId == null || !Number.isFinite(Number(puestoId)) || Number(puestoId) <= 0) return;
  try {
    await AsyncStorage.removeItem(puestoArticulosStorageKey(Number(puestoId)));
  } catch {
    /* ignore */
  }
}
