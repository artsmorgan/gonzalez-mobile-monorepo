/** Registros de apertura/cierre de puesto en `evaluations_cache` (tipo `opening_closing_position`). */

export const OPENING_CLOSING_POSITION_CACHE_TYPE = 'opening_closing_position';

export function getOcpRecordCorpoId(row: any): number | null {
  const n = Number(row?.corpo_id);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function filterOcpFromEvaluationsCacheByCorpo(fullCache: any[], corpoId: number | null): any[] {
  if (corpoId == null || !Number.isFinite(Number(corpoId)) || Number(corpoId) <= 0) return [];
  const cid = Number(corpoId);
  return dedupeOcpRows((fullCache || []).filter(
    (item) =>
      item.type === OPENING_CLOSING_POSITION_CACHE_TYPE && Number(item.corpo_id) === cid
  ));
}

export function isOcpLocalPendingRecord(r: any): boolean {
  if (r?.id == null || r?.id === 0) return true;
  if (r?.id_local != null && String(r.id_local).length > 0 && r?.synced !== true) return true;
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
  const mergedOcp = dedupeOcpRows([
    ...pending.map((r) => ({ ...r, synced: false })),
    ...serverTagged,
  ]);
  return [...withoutCorpoOcp, ...mergedOcp];
}

/**
 * Quita duplicados priorizando registros sincronizados del servidor.
 * - Si existe `id` (>0), la clave principal es `id`.
 * - Si no, usa `id_local`.
 */
export function dedupeOcpRows(rows: any[]): any[] {
  const byServerId = new Map<string, any>();
  const localOnly: any[] = [];

  for (const row of rows || []) {
    const idNum = Number(row?.id);
    if (Number.isFinite(idNum) && idNum > 0) {
      const key = String(idNum);
      const prev = byServerId.get(key);
      if (!prev) {
        byServerId.set(key, row);
      } else {
        const prevSynced = prev?.synced === true;
        const nextSynced = row?.synced === true;
        byServerId.set(key, nextSynced || !prevSynced ? row : prev);
      }
      continue;
    }
    localOnly.push(row);
  }

  const byLocalId = new Map<string, any>();
  for (const row of localOnly) {
    const localKey = String(row?.id_local || '');
    if (!localKey) continue;
    byLocalId.set(localKey, row);
  }

  return [...Array.from(byLocalId.values()), ...Array.from(byServerId.values())];
}
