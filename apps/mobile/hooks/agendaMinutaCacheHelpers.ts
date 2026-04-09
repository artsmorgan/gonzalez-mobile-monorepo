/** Registros de agenda minuta en `evaluations_cache` (`agenda_minuta` / `physical_minute_agenda`). */

export const AGENDA_MINUTA_CACHE_TYPE = 'agenda_minuta';
export const AGENDA_MINUTA_LEGACY_CACHE_TYPE = 'physical_minute_agenda';

export function isAgendaMinutaCacheType(itemType: unknown): boolean {
  return itemType === AGENDA_MINUTA_CACHE_TYPE || itemType === AGENDA_MINUTA_LEGACY_CACHE_TYPE;
}

export function getAgendaMinutaRecordPuestoId(row: any): number | null {
  const n = Number(row?.puesto_id);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function filterAgendaFromEvaluationsCacheByPuesto(fullCache: any[], puestoId: number | null): any[] {
  if (puestoId == null || !Number.isFinite(Number(puestoId)) || Number(puestoId) <= 0) return [];
  const pid = Number(puestoId);
  return (fullCache || []).filter(
    (item) => isAgendaMinutaCacheType(item.type) && Number(item.puesto_id) === pid
  );
}

export function isAgendaMinutaLocalPendingRecord(r: any): boolean {
  if (r?.id == null || r?.id === 0) return true;
  if (r?.id_local != null && String(r.id_local).length > 0) return true;
  if (r?.synced === false) return true;
  return false;
}

/**
 * Tras respuesta online: reemplaza en caché global solo las entradas de agenda del `puestoId`;
 * conserva otros tipos, otros puestos y borradores locales pendientes de este puesto.
 */
export function mergeEvaluationsCacheAgendaMinutaForPuesto(
  fullCache: any[],
  freshFromServer: any[],
  puestoId: number
): any[] {
  const pid = Number(puestoId);
  const withoutPuestoAgenda = fullCache.filter(
    (item) => !(isAgendaMinutaCacheType(item.type) && Number(item.puesto_id) === pid)
  );
  const existingPuestoAgenda = fullCache.filter(
    (item) => isAgendaMinutaCacheType(item.type) && Number(item.puesto_id) === pid
  );
  const pending = existingPuestoAgenda.filter(isAgendaMinutaLocalPendingRecord);
  const serverTagged = (freshFromServer || []).map((r) => ({
    ...r,
    synced: true,
    type: AGENDA_MINUTA_CACHE_TYPE,
  }));
  const mergedAgenda = [
    ...pending.map((r) => ({ ...r, synced: false })),
    ...serverTagged,
  ];
  return [...withoutPuestoAgenda, ...mergedAgenda];
}
