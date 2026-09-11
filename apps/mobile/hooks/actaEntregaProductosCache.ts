import AsyncStorage from '@react-native-async-storage/async-storage';

export const ACTA_ENTREGA_PRODUCTOS_CACHE_KEY = 'acta_entrega_productos_cache';

/** Quita id_local de adjuntos ya persistidos en servidor (id + name). */
export function normalizeActaEntregaImagesForCache(images: any[] | undefined | null): any[] {
  if (!Array.isArray(images)) return [];
  return images.map((img: any) => {
    const id = img?.id;
    const name = img?.name;
    const hasServerFile =
      id != null &&
      Number.isFinite(Number(id)) &&
      Number(id) > 0 &&
      name != null &&
      String(name).trim() !== '';
    if (!hasServerFile) return { ...img };
    const { id_local: _drop, localFileName: _lf, ...rest } = img;
    return {
      ...rest,
      id,
      name: String(name),
      url: img.url != null ? String(img.url) : rest.url,
    };
  });
}

export function stripActaEntregaPrismaJoins(row: any): any {
  if (!row || typeof row !== 'object') return row;
  const { c_imagenes_acta_entrega_producto: _cimg, ...rest } = row;
  return rest;
}

/** Registro ya en servidor: sin id_local de cola; adjuntos alineados con el GET de lista. */
export function normalizeSyncedActaEntregaRecord(record: any): any {
  if (record?.type !== 'acta_entrega_producto') return record;
  const recordClean = stripActaEntregaPrismaJoins(record);
  const { imagenes: _payloadImagenes, ...recordNoPayloadFiles } = recordClean;
  const id = recordNoPayloadFiles?.id;
  const hasServerId =
    id != null &&
    String(id).trim() !== '' &&
    !String(id).startsWith('local-') &&
    Number.isFinite(Number(id)) &&
    Number(id) > 0;
  if (!hasServerId) return recordNoPayloadFiles;
  return {
    ...recordNoPayloadFiles,
    id_local: '',
    synced: true,
    images: normalizeActaEntregaImagesForCache(recordNoPayloadFiles.images),
  };
}

export type ActaEntregaFetchScope = {
  empresaId: number | null;
  clienteId: number | null;
  divisionId: number | null;
  contratoId: number | null;
  corpoId: number | null;
};

export function actaEntregaRecordMatchesFetchScope(r: any, scope: ActaEntregaFetchScope): boolean {
  const { empresaId, clienteId, divisionId, contratoId, corpoId } = scope;
  if (empresaId && Number(r.empresa_id) !== Number(empresaId)) return false;
  if (clienteId && Number(r.cliente_id) !== Number(clienteId)) return false;
  if (divisionId && Number(r.division_id) !== Number(divisionId)) return false;
  if (contratoId && Number(r.contrato_id) !== Number(contratoId)) return false;
  if (corpoId && Number(r.corpo_id) !== Number(corpoId)) return false;
  return true;
}

export async function readActaEntregaProductosCache(): Promise<any[]> {
  try {
    const raw = await AsyncStorage.getItem(ACTA_ENTREGA_PRODUCTOS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function writeActaEntregaProductosCache(records: any[]): Promise<void> {
  await AsyncStorage.setItem(ACTA_ENTREGA_PRODUCTOS_CACHE_KEY, JSON.stringify(records));
}

export async function mergeActaEntregaServerIntoCache(serverRecords: any[], scope: ActaEntregaFetchScope): Promise<void> {
  const raw = await readActaEntregaProductosCache();
  const preserved = raw.filter((it: any) => {
    if (!actaEntregaRecordMatchesFetchScope(it, scope)) return true;
    if (it.synced === false) return true;
    return false;
  });

  const fromServer = serverRecords.map((r) =>
    normalizeSyncedActaEntregaRecord({ ...r, type: 'acta_entrega_producto', synced: true }),
  );

  await writeActaEntregaProductosCache([...preserved, ...fromServer]);
}

export async function migrateActaEntregaFromEvaluationsCacheIfEmpty(): Promise<void> {
  const current = await readActaEntregaProductosCache();
  if (current.length > 0) return;

  try {
    const ev = await AsyncStorage.getItem('evaluations_cache');
    if (!ev) return;
    const parsed = JSON.parse(ev);
    if (!Array.isArray(parsed)) return;
    const actas = parsed.filter((x: any) => x?.type === 'acta_entrega_producto');
    if (actas.length === 0) return;
    await writeActaEntregaProductosCache(actas);
  } catch {
    /* ignore */
  }
}

function actaEntregaDedupeKey(it: any): string | null {
  if (it?.type !== 'acta_entrega_producto') return null;
  const il = it.id_local != null && String(it.id_local).trim() !== '' ? String(it.id_local) : '';
  if (il) return `l:${il}`;
  const id = it.id != null && String(it.id).trim() !== '' ? String(it.id) : '';
  if (id) return `i:${id}`;
  return null;
}

export async function mergeActaEntregaRowsFromEvaluationsCache(): Promise<void> {
  try {
    const evRaw = await AsyncStorage.getItem('evaluations_cache');
    if (!evRaw) return;
    const ev = JSON.parse(evRaw);
    if (!Array.isArray(ev)) return;
    const evActas = ev.filter((x: any) => x?.type === 'acta_entrega_producto');
    if (evActas.length === 0) return;

    const ded = await readActaEntregaProductosCache();
    const seen = new Set<string>();
    for (const it of ded) {
      const k = actaEntregaDedupeKey(it);
      if (k) seen.add(k);
    }

    let added = false;
    const next = [...ded];
    for (const a of evActas) {
      const k = actaEntregaDedupeKey(a);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      next.push({ ...a, type: 'acta_entrega_producto' });
      added = true;
    }
    if (added) await writeActaEntregaProductosCache(next);
  } catch {
    /* ignore */
  }
}

export async function applyActaEntregaCreateSyncFromServer(
  offlineQueueId: string | number,
  resultData: any,
  fallbackPayload?: Record<string, unknown>,
): Promise<void> {
  await mergeActaEntregaRowsFromEvaluationsCache();

  const aid = String(offlineQueueId ?? '');
  const dataRaw = resultData && typeof resultData === 'object' ? resultData : {};
  const data = stripActaEntregaPrismaJoins(dataRaw);
  const sid = data.id != null && String(data.id).trim() !== '' ? data.id : undefined;

  const cache = await readActaEntregaProductosCache();
  let matched = false;
  const next = cache.map((item: any) => {
    if (item.type !== 'acta_entrega_producto') return item;
    const il = item.id_local != null && String(item.id_local).trim() !== '' ? String(item.id_local) : '';
    if (il !== aid) return item;
    matched = true;
    return normalizeSyncedActaEntregaRecord({
      ...item,
      ...data,
      type: 'acta_entrega_producto',
      synced: true,
      id: sid != null ? sid : item.id,
      id_local: sid != null ? '' : (item.id_local ?? ''),
      images: normalizeActaEntregaImagesForCache(
        Array.isArray(data.images) ? data.images : (item.images ?? []),
      ),
    });
  });

  if (matched) {
    await writeActaEntregaProductosCache(next);
  } else {
    await upsertActaEntregaInCache(
      normalizeSyncedActaEntregaRecord({
        ...(fallbackPayload || {}),
        ...data,
        id_local: sid != null ? '' : String(offlineQueueId ?? ''),
        type: 'acta_entrega_producto',
        synced: true,
        id: sid != null ? sid : (data.id ?? ''),
        images: normalizeActaEntregaImagesForCache(Array.isArray(data.images) ? data.images : []),
      }),
    );
  }

  try {
    const evRaw = await AsyncStorage.getItem('evaluations_cache');
    if (!evRaw) return;
    const ev = JSON.parse(evRaw);
    if (!Array.isArray(ev)) return;
    const filtered = ev.filter(
      (it: any) => !(it.type === 'acta_entrega_producto' && String(it.id_local ?? '') === aid),
    );
    if (filtered.length !== ev.length) {
      await AsyncStorage.setItem('evaluations_cache', JSON.stringify(filtered));
    }
  } catch {
    /* ignore */
  }
}

export async function applyActaEntregaUpdateSyncFromServer(
  serverActaId: string | number,
  resultData: any,
): Promise<void> {
  const idStr = String(serverActaId ?? '');
  const dataRaw = resultData && typeof resultData === 'object' ? resultData : {};
  const data = stripActaEntregaPrismaJoins(dataRaw);
  const cache = await readActaEntregaProductosCache();
  let matched = false;
  const next = cache.map((item: any) => {
    if (item.type !== 'acta_entrega_producto') return item;
    if (String(item.id) !== idStr) return item;
    matched = true;
    return normalizeSyncedActaEntregaRecord({
      ...item,
      ...data,
      type: 'acta_entrega_producto',
      images: normalizeActaEntregaImagesForCache(
        Array.isArray(data.images) ? data.images : (item.images ?? []),
      ),
    });
  });
  if (matched) await writeActaEntregaProductosCache(next);
}

export async function upsertActaEntregaInCache(record: any): Promise<void> {
  const cache = await readActaEntregaProductosCache();
  const rid =
    record.id != null &&
    String(record.id).trim() !== '' &&
    !String(record.id).startsWith('local-') &&
    Number.isFinite(Number(record.id)) &&
    Number(record.id) > 0
      ? String(record.id)
      : '';
  const rloc = record.id_local != null && String(record.id_local).trim() !== '' ? String(record.id_local) : '';
  const idx = cache.findIndex((it: any) => {
    if (it.type !== 'acta_entrega_producto') return false;
    if (rid && Number(it.id) > 0 && String(it.id) === rid) return true;
    if (rloc && String(it.id_local ?? '') === rloc) return true;
    return false;
  });
  const raw = { ...record, type: 'acta_entrega_producto' };
  const entry =
    raw.synced === true || (raw.id != null && Number(raw.id) > 0 && !String(raw.id).startsWith('local-'))
      ? normalizeSyncedActaEntregaRecord(raw)
      : raw;
  if (idx >= 0) {
    cache[idx] = { ...cache[idx], ...entry };
  } else {
    cache.push(entry);
  }
  await writeActaEntregaProductosCache(cache);
}

export async function removeActaEntregaFromCache(pred: (it: any) => boolean): Promise<void> {
  const cache = await readActaEntregaProductosCache();
  const next = cache.filter((it: any) => !(it.type === 'acta_entrega_producto' && pred(it)));
  await writeActaEntregaProductosCache(next);
}
