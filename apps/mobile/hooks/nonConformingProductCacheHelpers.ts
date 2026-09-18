/** Producto no conforme dentro de `evaluations_cache` (tipo `non_conforming_product`). */

export const NON_CONFORMING_PRODUCT_CACHE_TYPE = 'non_conforming_product';

/**
 * Clave estable por registro: mismo id de servidor o mismo id_local, no dos filas distintas con la misma clave.
 * El id de API puede venir como number o string.
 */
export function getStablePncRowKey(r: { id?: any; id_local?: any } | null | undefined): string {
  if (r == null) return 'null';
  const rawId = r.id;
  const idStr = rawId == null || rawId === '' ? '' : String(rawId);
  if (idStr.length > 0 && !idStr.startsWith('local-')) {
    const n = Number(rawId);
    if (Number.isFinite(n) && n > 0) {
      return `i:${n}`;
    }
  }
  const loc = r.id_local != null && String(r.id_local).length > 0 ? String(r.id_local) : '';
  if (loc.length > 0) {
    return `l:${loc}`;
  }
  return `u:${idStr || 'e'}`;
}

/**
 * Unifica filas PNC con la misma clave. Orden: las últimas en el array prevalecen
 * (útil: pending primero, servidor después → gana el servidor con `synced: true` si coincide id).
 */
export function dedupePncRowsByStableKey<T extends { id?: any; id_local?: any }>(rows: T[]): T[] {
  if (!Array.isArray(rows) || rows.length === 0) return rows;
  const m = new Map<string, T>();
  for (const row of rows) {
    m.set(getStablePncRowKey(row), row);
  }
  return Array.from(m.values());
}

export function getPncRecordCorpoId(row: any): number | null {
  const n = Number(row?.corpo_id);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Registros PNC en caché que pertenecen a una sucursal (para UI offline / fallback).
 */
export function filterPncFromEvaluationsCacheByCorpo<
  T extends { type?: string; corpo_id?: any; id?: any; id_local?: any },
>(fullCache: T[], corpoId: number | null): T[] {
  if (corpoId == null || !Number.isFinite(Number(corpoId)) || Number(corpoId) <= 0) return [];
  const cid = Number(corpoId);
  const filtered = fullCache.filter(
    (item) => item.type === NON_CONFORMING_PRODUCT_CACHE_TYPE && Number(item.corpo_id) === cid
  ) as T[];
  return dedupePncRowsByStableKey(filtered) as T[];
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
  const serverTagged = (freshServerPncRows || [])
    .filter((r: any) => r != null && r.isActive !== false)
    .map((r) => ({
    ...r,
    synced: true,
    type: NON_CONFORMING_PRODUCT_CACHE_TYPE,
  }));
  const mergedPnc = dedupePncRowsByStableKey([
    ...pending.map((r) => ({ ...r, synced: false })),
    ...serverTagged,
  ]);
  return [...withoutCorpoPnc, ...mergedPnc];
}
