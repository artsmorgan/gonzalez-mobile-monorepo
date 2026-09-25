/**
 * Fusión de `llaveros_cache` por sucursal (`corpo_id`).
 */

import { getLlaveCorpoId, replaceLlavesCorpoSliceInCache, localizeMovimientosFirmas } from './llavesCacheHelpers';

export async function mergeLlaverosCacheForCorpo<T extends Record<string, any>>(
  existing: T[],
  freshFromServer: T[],
  corpoId: number
): Promise<T[]> {
  const cid = Number(corpoId);
  const pendingLocal = existing.filter((m: any) => {
    if (getLlaveCorpoId(m) !== cid) return false;
    return !!(m.id_local && (m.id === 0 || m.id == null));
  });
  const keepOtherCorpos = existing.filter((m: any) => getLlaveCorpoId(m) !== cid);
  const previousById = new Map(existing.map((m: any) => [String(m?.id ?? ''), m]));
  // El servidor devuelve `firma_entrega`/`firma_recibe` de cada movimiento en base64: se guardan en
  // expo-files antes de cachear (nunca base64 crudo en AsyncStorage).
  const tagged = await Promise.all(
    (freshFromServer || []).map(async (m: any) => ({
      ...m,
      movimientos: await localizeMovimientosFirmas(
        m.movimientos,
        previousById.get(String(m?.id ?? ''))?.movimientos,
        'mov_llavero_firma_entrega',
        'mov_llavero_firma_recibe'
      ),
      llaves: Array.isArray(m.llaves) ? m.llaves.map((x: any) => ({ ...x })) : m.llaves,
      id_local: m.id_local ?? '',
    }))
  );
  return [...keepOtherCorpos, ...pendingLocal, ...tagged] as T[];
}

export function filterLlaverosByCorpo<T extends Record<string, any>>(
  items: T[],
  corpoId: number | null
): T[] {
  if (corpoId == null || !Number.isFinite(Number(corpoId)) || Number(corpoId) <= 0) return [];
  const cid = Number(corpoId);
  return items.filter((m) => getLlaveCorpoId(m) === cid);
}

export function replaceLlaverosCorpoSliceInCache<T extends Record<string, any>>(
  existing: T[],
  sliceForCorpo: T[],
  corpoId: number | null
): T[] {
  return replaceLlavesCorpoSliceInCache(existing, sliceForCorpo, corpoId);
}
