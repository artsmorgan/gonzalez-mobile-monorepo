/** Registros de apertura/cierre de puesto en `evaluations_cache` (tipo `opening_closing_position`). */

export const OPENING_CLOSING_POSITION_CACHE_TYPE = 'opening_closing_position';

export function getOcpRecordCorpoId(row: any): number | null {
  const n = Number(row?.corpo_id);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function filterOcpFromEvaluationsCacheByCorpo(fullCache: any[], corpoId: number | null): any[] {
  if (corpoId == null || !Number.isFinite(Number(corpoId)) || Number(corpoId) <= 0) return [];
  const cid = Number(corpoId);
  return (fullCache || []).filter(
    (item) =>
      item.type === OPENING_CLOSING_POSITION_CACHE_TYPE && Number(item.corpo_id) === cid
  );
}

export function isOcpLocalPendingRecord(r: any): boolean {
  if (r?.id == null || r?.id === 0) return true;
  if (r?.id_local != null && String(r.id_local).length > 0) return true;
  if (r?.synced === false) return true;
  return false;
}

/**
 * Tras respuesta online: reemplaza en caché global solo las entradas OCP del `corpoId`;
 * conserva otros tipos, otras sucursales y borradores locales pendientes de esta sucursal.
 */
export function mergeEvaluationsCacheOcpForCorpo(
  fullCache: any[],
  freshFromServer: any[],
  corpoId: number
): any[] {
  const cid = Number(corpoId);
  const withoutCorpoOcp = fullCache.filter(
    (item) =>
      !(item.type === OPENING_CLOSING_POSITION_CACHE_TYPE && Number(item.corpo_id) === cid)
  );
  const existingCorpoOcp = fullCache.filter(
    (item) =>
      item.type === OPENING_CLOSING_POSITION_CACHE_TYPE && Number(item.corpo_id) === cid
  );
  const pending = existingCorpoOcp.filter(isOcpLocalPendingRecord);
  const serverTagged = (freshFromServer || []).map((r) => ({
    ...r,
    synced: true,
    type: OPENING_CLOSING_POSITION_CACHE_TYPE,
  }));
  const mergedOcp = [
    ...pending.map((r) => ({ ...r, synced: false })),
    ...serverTagged,
  ];
  return [...withoutCorpoOcp, ...mergedOcp];
}
