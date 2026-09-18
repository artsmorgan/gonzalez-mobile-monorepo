/**
 * Fusión de `llaves_cache` por sucursal (`corpo_id`).
 */

export function getLlaveCorpoId(m: any): number | null {
  const raw = m?.corpo_id;
  if (raw === undefined || raw === null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Conserva llaves de otras sucursales y borradores locales (`id_local` + `id === 0`) de esta sucursal;
 * sustituye el resto del slice por la respuesta del servidor.
 */
export function mergeLlavesCacheForCorpo<T extends Record<string, any>>(
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
    id_local: m.id_local ?? '',
  }));
  return [...keepOtherCorpos, ...pendingLocal, ...tagged] as T[];
}

export function filterLlavesByCorpo<T extends Record<string, any>>(items: T[], corpoId: number | null): T[] {
  if (corpoId == null || !Number.isFinite(Number(corpoId)) || Number(corpoId) <= 0) return [];
  const cid = Number(corpoId);
  return items.filter((m) => getLlaveCorpoId(m) === cid);
}

/**
 * Sustituye en caché todas las llaves de una sucursal por `sliceForCorpo` (p. ej. estado en pantalla),
 * sin tocar filas de otras sucursales.
 */
export function replaceLlavesCorpoSliceInCache<T extends Record<string, any>>(
  existing: T[],
  sliceForCorpo: T[],
  corpoId: number | null
): T[] {
  if (corpoId == null || !Number.isFinite(Number(corpoId)) || Number(corpoId) <= 0) {
    return Array.isArray(sliceForCorpo) ? [...sliceForCorpo] : [...(existing || [])];
  }
  const cid = Number(corpoId);
  const keepOther = (existing || []).filter((m: any) => getLlaveCorpoId(m) !== cid);
  return [...keepOther, ...(sliceForCorpo || [])] as T[];
}
