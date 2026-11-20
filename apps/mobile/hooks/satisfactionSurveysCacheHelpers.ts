/** Encuestas NPS en `surveys_cache` (lista plana con `puesto.id` y `sucursal.id` / `corpo_id`). */

export function getSurveyRecordPuestoId(row: any): number | null {
  const n = Number(row?.puesto?.id ?? row?.puesto_id);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function getSurveyRecordCorpoId(row: any): number | null {
  const n = Number(row?.sucursal?.id ?? row?.corpo_id);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function filterSurveysCacheByPuesto(fullCache: any[], puestoId: number | null): any[] {
  if (puestoId == null || !Number.isFinite(Number(puestoId)) || Number(puestoId) <= 0) return [];
  const pid = Number(puestoId);
  return (fullCache || []).filter((s) => getSurveyRecordPuestoId(s) === pid);
}

export function filterSurveysCacheByCorpo(fullCache: any[], corpoId: number | null): any[] {
  if (corpoId == null || !Number.isFinite(Number(corpoId)) || Number(corpoId) <= 0) return [];
  const cid = Number(corpoId);
  return (fullCache || []).filter((s) => getSurveyRecordCorpoId(s) === cid);
}

/**
 * Borradores locales: sin id de servidor (≤0). Con id de servidor no se considera
 * pendiente aunque `synced === false` — si no, el merge con GET duplicaría la fila.
 */
export function isSurveyLocalPendingRecord(s: any): boolean {
  const n = Number(s?.id);
  return !Number.isFinite(n) || n <= 0;
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

/**
 * Tras POST exitoso (pantalla o sync en App): inserta/actualiza **una** fila sin perder
 * otras encuestas del mismo puesto. `mergeSurveysCacheForPuesto(…, [solo una fila], …)`
 * reemplazaba por error todo el listado de ese puesto.
 */
export function upsertSurveyCacheRowForPuesto(
  fullCache: any[],
  row: any,
  puestoId: number
): any[] {
  const pid = Number(puestoId);
  if (!Number.isFinite(pid) || pid <= 0) return fullCache;
  const newId = Number(row?.id);
  const newLocal = String(row?.id_local ?? '').trim();

  const list = fullCache || [];
  const withoutPuesto = list.filter((s) => getSurveyRecordPuestoId(s) !== pid);
  const forPuesto = list.filter((s) => getSurveyRecordPuestoId(s) === pid);

  const kept = forPuesto.filter((s) => {
    const sid = Number(s?.id);
    const sl = String(s?.id_local ?? '').trim();
    if (Number.isFinite(newId) && newId > 0 && Number.isFinite(sid) && sid > 0 && sid === newId) {
      return false;
    }
    if (newLocal !== '' && sl === newLocal) {
      return false;
    }
    return true;
  });

  const normalized = { ...row, id_local: row?.id_local != null ? String(row.id_local) : '' };
  return [...withoutPuesto, ...kept, normalized];
}

/**
 * Tras GET online por `corpo_id`: reemplaza en caché encuestas de esa sucursal;
 * conserva borradores locales pendientes de la misma sucursal.
 */
export function mergeSurveysCacheForCorpo(
  fullCache: any[],
  freshFromServer: any[],
  corpoId: number
): any[] {
  const cid = Number(corpoId);
  const without = fullCache.filter((s) => getSurveyRecordCorpoId(s) !== cid);
  const existing = fullCache.filter((s) => getSurveyRecordCorpoId(s) === cid);
  const pending = existing.filter(isSurveyLocalPendingRecord);
  const normalizedServer = (freshFromServer || []).map((survey: any) => ({
    ...survey,
    id_local: survey.id_local || '',
  }));
  return [...without, ...pending, ...normalizedServer];
}

/** Fila mínima para reemplazar un borrador local tras POST exitoso (p. ej. sync en App). */
export function buildSurveyCacheRowFromCreateRequest(
  requestData: any,
  serverId: number,
  idLocal?: string | null
): any {
  const eid = Number(requestData?.empresa_id);
  const clid = Number(requestData?.cliente_id);
  const did = Number(requestData?.division_id);
  const coid = Number(requestData?.corpo_id);
  const pid = Number(requestData?.puesto_id);
  const contrato =
    requestData?.contrato_id != null && String(requestData.contrato_id).trim() !== ''
      ? Number(requestData.contrato_id)
      : 0;
  return {
    id: serverId,
    id_local: idLocal || '',
    persona_evaluada: requestData?.persona_evaluada,
    empresa_evaluada: requestData?.empresa_evaluada,
    cedula_persona_evaluada: requestData?.cedula_persona_evaluada,
    telefono_persona_evaluada: requestData?.telefono_persona_evaluada,
    email_persona_evaluada: requestData?.email_persona_evaluada,
    firma_persona_evaluada: requestData?.firma_persona_evaluada,
    empresa: { id: Number.isFinite(eid) ? eid : 0, nombre: '' },
    cliente: { id: Number.isFinite(clid) ? clid : 0, nombre: '' },
    sucursal: { id: Number.isFinite(coid) ? coid : 0, nombre: '' },
    puesto: { id: Number.isFinite(pid) ? pid : 0, nombre: '' },
    division: { id: Number.isFinite(did) ? did : 0, nombre: '' },
    contrato_id: Number.isFinite(contrato) && contrato > 0 ? contrato : 0,
    responsable_id: 0,
    responsable: {
      nombre: requestData?.nombre_responsable,
      cedula: requestData?.cedula_responsable,
    },
    firma_responsable: requestData?.firma_responsable,
    nombre_firma: '',
    fecha: requestData?.fecha,
    evaluaciones: requestData?.evaluaciones,
    observations: requestData?.observaciones,
    synced: true,
  };
}
