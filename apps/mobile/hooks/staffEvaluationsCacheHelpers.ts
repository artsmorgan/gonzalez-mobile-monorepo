/** Evaluaciones de personal en `evaluations_staff_cache` (`corpo_id` / `sucursal_id`). */

export function getStaffEvalRecordCorpoId(row: any): number | null {
  const n = Number(row?.corpo_id ?? row?.sucursal_id);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function filterStaffEvaluationsCacheByCorpo(fullCache: any[], corpoId: number | null): any[] {
  if (corpoId == null || !Number.isFinite(Number(corpoId)) || Number(corpoId) <= 0) return [];
  const cid = Number(corpoId);
  return (fullCache || []).filter((item) => getStaffEvalRecordCorpoId(item) === cid);
}

export function isStaffEvalLocalPendingRecord(r: any): boolean {
  if (r?.id == null || r?.id === 0) return true;
  if (r?.id_local != null && String(r.id_local).length > 0) return true;
  if (r?.synced === false) return true;
  return false;
}

/**
 * Tras respuesta online: reemplaza en caché solo evaluaciones del `corpoId` (sucursal);
 * conserva otras sucursales y borradores locales pendientes de esta sucursal.
 */
export function mergeStaffEvaluationsCacheForCorpo(
  fullCache: any[],
  freshFromServer: any[],
  corpoId: number
): any[] {
  const cid = Number(corpoId);
  const withoutCorpo = fullCache.filter((row) => getStaffEvalRecordCorpoId(row) !== cid);
  const existingCorpo = fullCache.filter((row) => getStaffEvalRecordCorpoId(row) === cid);
  const pending = existingCorpo.filter(isStaffEvalLocalPendingRecord);
  const serverTagged = (freshFromServer || []).map((e) => ({
    ...e,
    corpo_id: e.corpo_id ?? e.sucursal_id ?? cid,
    id_local: e.id_local ?? '',
  }));
  return [...withoutCorpo, ...pending, ...serverTagged];
}

