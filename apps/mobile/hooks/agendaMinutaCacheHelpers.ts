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

export function getAgendaMinutaRecordCorpoId(row: any): number | null {
  const n = Number(row?.corpo_id);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function filterAgendaFromEvaluationsCacheByCorpo(fullCache: any[], corpoId: number | null): any[] {
  if (corpoId == null || !Number.isFinite(Number(corpoId)) || Number(corpoId) <= 0) return [];
  const cid = Number(corpoId);
  return (fullCache || []).filter(
    (item) =>
      isAgendaMinutaCacheType(item.type) &&
      Number(item.corpo_id) === cid &&
      item?.isActive !== false
  );
}

export function isAgendaMinutaLocalPendingRecord(r: any): boolean {
  const serverId = Number(r?.id);
  const hasServerId = Number.isFinite(serverId) && serverId > 0;
  if (!hasServerId) return true;
  const localKey = String(r?.id_local ?? '').trim();
  if (localKey.length > 0 && (localKey.startsWith('local-') || r?.synced === false)) return true;
  if (r?.synced === false) return true;
  return false;
}

/** Compatibilidad temporal: si se requiere filtrar por puesto, filtra sobre resultados por corpo. */
export function filterAgendaFromEvaluationsCacheByPuesto(fullCache: any[], puestoId: number | null): any[] {
  if (puestoId == null || !Number.isFinite(Number(puestoId)) || Number(puestoId) <= 0) return [];
  const pid = Number(puestoId);
  return (fullCache || []).filter(
    (item) =>
      isAgendaMinutaCacheType(item.type) &&
      Number(item.puesto_id) === pid &&
      item?.isActive !== false
  );
}

/**
 * Tras respuesta online: reemplaza en caché global solo las entradas de agenda del `corpoId`;
 * conserva otros tipos, otros corpos y borradores locales pendientes de este corpo.
 */
export function mergeEvaluationsCacheAgendaMinutaForCorpo(
  fullCache: any[],
  freshFromServer: any[],
  corpoId: number
): any[] {
  const cid = Number(corpoId);
  const withoutCorpoAgenda = fullCache.filter(
    (item) => !(isAgendaMinutaCacheType(item.type) && Number(item.corpo_id) === cid)
  );
  const existingCorpoAgenda = fullCache.filter(
    (item) => isAgendaMinutaCacheType(item.type) && Number(item.corpo_id) === cid
  );
  const pending = existingCorpoAgenda.filter(isAgendaMinutaLocalPendingRecord);
  const serverTagged = (freshFromServer || [])
    .filter((r) => Number(r?.corpo_id) === cid && r?.isActive !== false)
    .map((r) => ({
      ...r,
      synced: true,
      type: AGENDA_MINUTA_CACHE_TYPE,
      isActive: r?.isActive ?? true,
    }));
  const mergedAgenda = [
    ...pending.map((r) => ({ ...r, synced: false })),
    ...serverTagged,
  ];
  const deduped = new Map<string, any>();
  for (const row of mergedAgenda) {
    const sid = Number(row?.id);
    const key = Number.isFinite(sid) && sid > 0 ? `id:${sid}` : `local:${String(row?.id_local ?? '')}`;
    deduped.set(key, row);
  }
  return [...withoutCorpoAgenda, ...Array.from(deduped.values())];
}
