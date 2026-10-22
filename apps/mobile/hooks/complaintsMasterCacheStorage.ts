import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeServerFilesForComplaintCache } from '@/hooks/complaintsMasterFilesSync';

export const COMPLAINTS_MASTER_CACHE_KEY = 'complaints_master_cache';
export const COMPLAINTS_MASTER_CACHE_TYPE = 'complaints_master';
const EVALUATIONS_CACHE_LEGACY = 'evaluations_cache';

export type ComplaintsMasterCacheFile = {
  version: 1;
  byCorpoId: Record<string, any[]>;
};

function emptyFile(): ComplaintsMasterCacheFile {
  return { version: 1, byCorpoId: {} };
}

export function complaintCacheCorpoId(item: any): number | null {
  const fromItem = item?.corpo_id;
  if (fromItem != null && Number.isFinite(Number(fromItem))) return Number(fromItem);
  const fromPayload = item?.payload?.corpo_id;
  if (fromPayload != null && Number.isFinite(Number(fromPayload))) return Number(fromPayload);
  return null;
}

export function complaintsMasterIsPendingLocal(it: any): boolean {
  if (it?.synced === false) return true;
  if (it?.id_local != null && String(it.id_local).trim() !== '' && String(it.id_local).startsWith('local-')) {
    return true;
  }
  const id = it?.id;
  if (id === '' || id == null) return true;
  if (typeof id === 'string' && id.startsWith('local-')) return true;
  return false;
}

function normalizeParsed(parsed: any): ComplaintsMasterCacheFile {
  if (Array.isArray(parsed)) {
    const file = emptyFile();
    for (const it of parsed) {
      if (it?.type != null && it.type !== COMPLAINTS_MASTER_CACHE_TYPE) continue;
      const k = String(Number(complaintCacheCorpoId(it) ?? 0));
      if (!Number.isFinite(Number(k)) || Number(k) <= 0) continue;
      if (!file.byCorpoId[k]) file.byCorpoId[k] = [];
      file.byCorpoId[k].push({ ...it, type: COMPLAINTS_MASTER_CACHE_TYPE });
    }
    return file;
  }
  if (parsed && typeof parsed === 'object' && parsed.byCorpoId && typeof parsed.byCorpoId === 'object') {
    return { version: 1, byCorpoId: { ...parsed.byCorpoId } };
  }
  return emptyFile();
}

export async function loadComplaintsMasterCacheFile(): Promise<ComplaintsMasterCacheFile> {
  const raw = await AsyncStorage.getItem(COMPLAINTS_MASTER_CACHE_KEY);
  if (!raw) return emptyFile();
  try {
    return normalizeParsed(JSON.parse(raw));
  } catch {
    return emptyFile();
  }
}

export async function saveComplaintsMasterCacheFile(file: ComplaintsMasterCacheFile): Promise<void> {
  await AsyncStorage.setItem(COMPLAINTS_MASTER_CACHE_KEY, JSON.stringify(file));
}

export async function loadComplaintsMasterCacheFlat(): Promise<any[]> {
  const f = await loadComplaintsMasterCacheFile();
  const out: any[] = [];
  for (const arr of Object.values(f.byCorpoId)) {
    if (Array.isArray(arr)) out.push(...arr);
  }
  return out;
}

export async function saveComplaintsMasterCacheFlat(list: any[]): Promise<void> {
  const byCorpoId: Record<string, any[]> = {};
  for (const it of list) {
    const k = String(Number(complaintCacheCorpoId(it) ?? 0));
    if (!Number.isFinite(Number(k)) || Number(k) <= 0) continue;
    if (!byCorpoId[k]) byCorpoId[k] = [];
    byCorpoId[k].push({ ...it, type: COMPLAINTS_MASTER_CACHE_TYPE });
  }
  await saveComplaintsMasterCacheFile({ version: 1, byCorpoId });
}

/**
 * Sustituye en caché las filas sincronizadas de esta sucursal; conserva otras sucursales y borradores locales.
 */
export async function mergeComplaintsMasterServerIntoCacheForCorpo(
  corpoId: number,
  serverList: any[]
): Promise<void> {
  const cid = Number(corpoId);
  const matchesScope = (it: any) => Number(complaintCacheCorpoId(it)) === cid;

  const flat = await loadComplaintsMasterCacheFlat();
  const preserved = flat.filter((it: any) => !matchesScope(it) || complaintsMasterIsPendingLocal(it));

  const scopedServer = serverList.map((r: any) => ({
    ...r,
    type: COMPLAINTS_MASTER_CACHE_TYPE,
    id_local: r?.id_local != null && String(r.id_local).trim() !== '' ? r.id_local : '',
    synced: true,
    corpo_id: r.corpo_id ?? cid,
    files: normalizeServerFilesForComplaintCache(r?.files),
  }));

  await saveComplaintsMasterCacheFlat([...preserved, ...scopedServer]);
}

/** Una sola sucursal: migración lazy desde evaluations_cache y lectura. */
export async function loadComplaintsMasterRowsForCorpo(corpoId: number): Promise<any[]> {
  const cid = Number(corpoId);
  const k = String(cid);
  const file = await loadComplaintsMasterCacheFile();
  let rows = file.byCorpoId[k];
  if (Array.isArray(rows) && rows.length > 0) {
    return rows;
  }
  await migrateComplaintsFromEvaluationsCacheForCorpo(cid);
  const file2 = await loadComplaintsMasterCacheFile();
  rows = file2.byCorpoId[k];
  return Array.isArray(rows) ? rows : [];
}

async function migrateComplaintsFromEvaluationsCacheForCorpo(corpoId: number): Promise<void> {
  const cid = Number(corpoId);
  const raw = await AsyncStorage.getItem(EVALUATIONS_CACHE_LEGACY);
  if (!raw) return;
  let cache: any[];
  try {
    cache = JSON.parse(raw);
  } catch {
    return;
  }
  if (!Array.isArray(cache)) return;

  const toMove = cache.filter(
    (item: any) =>
      item?.type === COMPLAINTS_MASTER_CACHE_TYPE && Number(complaintCacheCorpoId(item)) === cid
  );
  if (toMove.length === 0) return;

  const flat = await loadComplaintsMasterCacheFlat();
  const existingIds = new Set(
    flat.filter((it: any) => Number(complaintCacheCorpoId(it)) === cid).map((it: any) => `${it.id}-${it.id_local}`)
  );
  const merged = [...flat];
  for (const row of toMove) {
    const key = `${row.id}-${row.id_local}`;
    if (!existingIds.has(key)) {
      merged.push({ ...row, type: COMPLAINTS_MASTER_CACHE_TYPE });
      existingIds.add(key);
    }
  }
  await saveComplaintsMasterCacheFlat(merged);

  const remaining = cache.filter(
    (item: any) =>
      !(item?.type === COMPLAINTS_MASTER_CACHE_TYPE && Number(complaintCacheCorpoId(item)) === cid)
  );
  await AsyncStorage.setItem(EVALUATIONS_CACHE_LEGACY, JSON.stringify(remaining));
}

export async function appendComplaintsMasterToCache(row: any): Promise<void> {
  const flat = await loadComplaintsMasterCacheFlat();
  flat.push({ ...row, type: COMPLAINTS_MASTER_CACHE_TYPE });
  await saveComplaintsMasterCacheFlat(flat);
}

/** Inserta o reemplaza una fila en la sucursal (p. ej. tras POST online sin re-listar todo el corpo). */
export async function upsertComplaintsMasterRowInCache(row: any): Promise<void> {
  const corpo = complaintCacheCorpoId(row);
  if (corpo == null || !Number.isFinite(Number(corpo)) || Number(corpo) <= 0) return;
  const flat = await loadComplaintsMasterCacheFlat();
  const id = row.id;
  const idLocal = row.id_local;
  const next = flat.filter((it: any) => {
    if (Number(complaintCacheCorpoId(it)) !== Number(corpo)) return true;
    if (id != null && Number(id) > 0 && it.id != null && Number(it.id) === Number(id)) return false;
    if (idLocal != null && String(idLocal).trim() !== '' && String(it.id_local) === String(idLocal)) return false;
    return true;
  });
  next.push({
    ...row,
    type: COMPLAINTS_MASTER_CACHE_TYPE,
    corpo_id: row.corpo_id ?? corpo,
    files: Array.isArray(row.files) ? row.files : [],
    synced: row.synced !== false,
    id_local: row.id_local ?? '',
  });
  await saveComplaintsMasterCacheFlat(next);
}

export async function patchComplaintsMasterRowByRecordId(
  recordId: string | number,
  patch: Record<string, any>
): Promise<void> {
  const rid = String(recordId);
  const flat = await loadComplaintsMasterCacheFlat();
  const next = flat.map((it: any) => {
    if (String(it.id) !== rid && String(it.id_local) !== rid) return it;
    return { ...it, ...patch, type: COMPLAINTS_MASTER_CACHE_TYPE };
  });
  await saveComplaintsMasterCacheFlat(next);
}

export async function removeComplaintsMasterRowByRecordId(recordId: string | number): Promise<void> {
  const rid = String(recordId);
  const flat = await loadComplaintsMasterCacheFlat();
  const next = flat.filter((it: any) => String(it.id) !== rid && String(it.id_local) !== rid);
  await saveComplaintsMasterCacheFlat(next);
}

export async function patchComplaintsMasterFilesForRecord(
  recordId: string | number,
  fileIdToRemove: number
): Promise<void> {
  const rid = String(recordId);
  const flat = await loadComplaintsMasterCacheFlat();
  const next = flat.map((item: any) => {
    if (String(item.id) !== rid && String(item.id_local) !== rid) return item;
    const currentFiles = Array.isArray(item.files) ? item.files : [];
    return {
      ...item,
      files: currentFiles.filter((f: any) => Number(f?.id) !== Number(fileIdToRemove)),
      type: COMPLAINTS_MASTER_CACHE_TYPE,
    };
  });
  await saveComplaintsMasterCacheFlat(next);
}

/** Tras POST en sincronización: enlaza id de servidor y limpia id_local pendiente. */
export async function applyComplaintsMasterSyncCreateResult(
  localActionId: string,
  serverData: any
): Promise<void> {
  if (serverData == null) return;
  const {
    c_anexos_quejas: _anex,
    data: _nestedData,
    archivos: _arch,
    ...cleanServer
  } = serverData;
  const flat = await loadComplaintsMasterCacheFlat();
  const sid = cleanServer?.id ?? serverData?.id ?? serverData?.data?.id;
  const next = flat.map((it: any) => {
    if (String(it.id_local) !== String(localActionId)) return it;
    const corpo = Number(it.corpo_id ?? cleanServer?.corpo_id ?? 0);
    return {
      ...it,
      ...cleanServer,
      id: sid ?? it.id,
      id_local: '',
      synced: true,
      type: COMPLAINTS_MASTER_CACHE_TYPE,
      corpo_id: cleanServer?.corpo_id ?? corpo,
      files: (() => {
        const srv = cleanServer?.files;
        if (Array.isArray(srv) && srv.length > 0) {
          return normalizeServerFilesForComplaintCache(srv);
        }
        return Array.isArray(it.files) ? it.files : [];
      })(),
    };
  });
  await saveComplaintsMasterCacheFlat(next);
}
