/** Producto no conforme dentro de `evaluations_cache` (tipo `non_conforming_product`). */

export const NON_CONFORMING_PRODUCT_CACHE_TYPE = 'non_conforming_product';

export function getPncRecordCorpoId(row: any): number | null {
  const n = Number(row?.corpo_id);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Registros PNC en caché que pertenecen a una sucursal (para UI offline / fallback).
 */
export function filterPncFromEvaluationsCacheByCorpo<T extends { type?: string; corpo_id?: any }>(
  fullCache: T[],
  corpoId: number | null
): T[] {
  if (corpoId == null || !Number.isFinite(Number(corpoId)) || Number(corpoId) <= 0) return [];
  const cid = Number(corpoId);
  return fullCache.filter(
    (item) => item.type === NON_CONFORMING_PRODUCT_CACHE_TYPE && Number(item.corpo_id) === cid
  ) as T[];
}

/**
 * Pendientes locales que no deben sustituirse por la respuesta del servidor.
 */
export function isPncLocalPendingRecord(r: any): boolean {
  return !r?.synced || String(r?.id_local || '').startsWith('local-');
}

/**
 * Tras respuesta online: quita solo entradas PNC de esta sucursal en el array mixto global,
 * conserva el resto de tipos y otras sucursales; inserta pendientes locales + filas servidor.
 */
export function mergeEvaluationsCachePncForCorpo(
  fullCache: any[],
  freshServerPncRows: any[],
  corpoId: number
): any[] {
  const cid = Number(corpoId);
  const withoutCorpoPnc = fullCache.filter(
    (item) =>
      !(item.type === NON_CONFORMING_PRODUCT_CACHE_TYPE && Number(item.corpo_id) === cid)
  );
  const existingCorpoPnc = fullCache.filter(
    (item) =>
      item.type === NON_CONFORMING_PRODUCT_CACHE_TYPE && Number(item.corpo_id) === cid
  );
  const pending = existingCorpoPnc.filter(isPncLocalPendingRecord);
  const serverTagged = (freshServerPncRows || []).map((r) => ({
    ...r,
    synced: true,
    type: NON_CONFORMING_PRODUCT_CACHE_TYPE,
  }));
  const mergedPnc = [
    ...pending.map((r) => ({ ...r, synced: false })),
    ...serverTagged,
  ];
  return [...withoutCorpoPnc, ...mergedPnc];
}
