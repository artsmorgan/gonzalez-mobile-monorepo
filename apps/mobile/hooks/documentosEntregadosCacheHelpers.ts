/** Caché plana en `documentos_entregados_cache` indexada por `corpo_id`. */

export function getDocEntregadoCorpoId(row: any): number {
  return Number(row?.corpo_id ?? 0);
}

function isLocalPendingDoc(row: any): boolean {
  const n = Number(row?.id);
  return !Number.isFinite(n) || n <= 0;
}

/**
 * Tras GET online: reemplaza filas de la sucursal con la respuesta del servidor;
 * conserva borradores locales (sin id servidor o con id_local).
 */
export function mergeDocumentosEntregadosCacheForCorpo(
  fullCache: any[],
  freshFromServer: any[],
  corpoId: number
): any[] {
  const cid = Number(corpoId);
  const without = (fullCache || []).filter((s) => getDocEntregadoCorpoId(s) !== cid);
  const existing = (fullCache || []).filter((s) => getDocEntregadoCorpoId(s) === cid);
  const pending = existing.filter(isLocalPendingDoc);
  const serverRows = (freshFromServer || [])
    .filter((r) => r && (r as any).isActive !== false)
    .map((r) => ({ ...r, id_local: (r as any).id_local || '' }));
  return [...without, ...pending, ...serverRows];
}

/** Inserta o reemplaza una fila (POST o sync) sin perder otras de la misma sucursal. */
export function upsertDocumentoEntregadoInCache(fullCache: any[], row: any): any[] {
  const cid = getDocEntregadoCorpoId(row);
  if (!Number.isFinite(cid) || cid <= 0) return fullCache;
  const list = fullCache || [];
  const without = list.filter((s) => getDocEntregadoCorpoId(s) !== cid);
  const forC = list.filter((s) => getDocEntregadoCorpoId(s) === cid);
  const newId = Number(row?.id);
  const newL = String(row?.id_local ?? '').trim();
  const kept = forC.filter((s) => {
    const sid = Number(s?.id);
    const sl = String(s?.id_local ?? '').trim();
    if (Number.isFinite(newId) && newId > 0 && Number.isFinite(sid) && sid > 0 && sid === newId) return false;
    if (newL !== '' && sl === newL) return false;
    return true;
  });
  const norm = { ...row, id_local: row?.id_local != null ? String(row.id_local) : '' };
  return [...without, ...kept, norm];
}

export function buildDocumentoEntregadoCacheRowFromRequest(
  requestData: any,
  serverId: number,
  idLocal = ''
): any {
  return {
    id: serverId,
    id_local: idLocal,
    cliente_id: Number(requestData?.cliente_id),
    corpo_id: Number(requestData?.corpo_id),
    empresa_id: Number(requestData?.empresa_id ?? 0) || 0,
    division_id: Number(requestData?.division_id ?? 0) || 0,
    contrato_id: Number(requestData?.contrato_id ?? 0) || 0,
    puesto_id: Number(requestData?.puesto_id ?? 0) || 0,
    fecha: requestData?.fecha,
    nombre_oficial_entrega: requestData?.nombre_oficial_entrega,
    nombre_oficial_recibe: requestData?.nombre_oficial_recibe,
    tipo_documento: requestData?.tipo_documento,
    descripcion: requestData?.descripcion,
    firma_representante_cliente: requestData?.firma_representante_cliente,
    firma_responsable: requestData?.firma_responsable,
    isActive: true,
  };
}
