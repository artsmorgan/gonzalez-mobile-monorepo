/** Encuestas NPS en `surveys_cache` (lista plana con `puesto.id`). */

export function getSurveyRecordPuestoId(row: any): number | null {
  const n = Number(row?.puesto?.id ?? row?.puesto_id);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function filterSurveysCacheByPuesto(fullCache: any[], puestoId: number | null): any[] {
  if (puestoId == null || !Number.isFinite(Number(puestoId)) || Number(puestoId) <= 0) return [];
  const pid = Number(puestoId);
  return (fullCache || []).filter((s) => getSurveyRecordPuestoId(s) === pid);
}

/** Borradores locales: sin id de servidor numérico > 0. */
export function isSurveyLocalPendingRecord(s: any): boolean {
  const n = Number(s?.id);
  if (!Number.isFinite(n) || n <= 0) return true;
  if (s?.synced === false) return true;
  return false;
}

/**
 * Tras respuesta online: reemplaza en caché solo encuestas del `puestoId`;
 * conserva otros puestos y borradores locales pendientes de este puesto.
 */
export function mergeSurveysCacheForPuesto(
  fullCache: any[],
  freshFromServer: any[],
  puestoId: number
): any[] {
  const pid = Number(puestoId);
  const withoutPuesto = fullCache.filter((s) => getSurveyRecordPuestoId(s) !== pid);
  const existingPuesto = fullCache.filter((s) => getSurveyRecordPuestoId(s) === pid);
  const pending = existingPuesto.filter(isSurveyLocalPendingRecord);
  const normalizedServer = (freshFromServer || []).map((survey: any) => ({
    ...survey,
    id_local: survey.id_local || '',
  }));
  return [...withoutPuesto, ...pending, ...normalizedServer];
}
