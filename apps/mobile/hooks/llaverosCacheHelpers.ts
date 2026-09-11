/**
 * Fusión de `llaveros_cache` por sucursal (`corpo_id`).
 */

import { getLlaveCorpoId, replaceLlavesCorpoSliceInCache } from './llavesCacheHelpers';

export function mergeLlaverosCacheForCorpo<T extends Record<string, any>>(
  existing: T[],
  freshFromServer: T[],
  corpoId: number
): T[] {
  const cid = Number(corpoId);
  const pendingLocal = existing.filter((m: any) => {
    if (getLlaveCorpoId(m) !== cid) return false;
    return !!(m.id_local && (m.id === 0 || m.id == null));
  });
  const keepOtherCorpos = existing.filter((m: any) => getLlaveCorpoId(m) !== cid);
  const tagged = (freshFromServer || []).map((m: any) => ({
    ...m,
    movimientos: Array.isArray(m.movimientos)
      ? m.movimientos.map((x: any) => ({ ...x, id_local: x.id_local ?? '' }))
      : m.movimientos,
    llaves: Array.isArray(m.llaves) ? m.llaves.map((x: any) => ({ ...x })) : m.llaves,
    id_local: m.id_local ?? '',
  }));
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
