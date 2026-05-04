import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ChecklistSupervisionItem } from '@/hooks/checklistSupervisionFunctions';

export const CHECKLIST_SUPERVISION_CACHE_KEY = 'checklist_supervision_cache';

export type ChecklistSupervisionCacheFile = {
  version: 1;
  bySucursalId: Record<string, ChecklistSupervisionItem[]>;
};

function emptyFile(): ChecklistSupervisionCacheFile {
  return { version: 1, bySucursalId: {} };
}

export function checklistItemIsPendingLocal(it: any): boolean {
  if (it?.id_local != null && String(it.id_local).trim() !== '') return true;
  if (Number(it?.id) === 0) return true;
  return false;
}

function normalizeParsed(parsed: any): ChecklistSupervisionCacheFile {
  if (Array.isArray(parsed)) {
    const file = emptyFile();
    for (const it of parsed) {
      const k = String(Number(it?.corpo_id ?? 0));
      if (!Number.isFinite(Number(k)) || Number(k) <= 0) continue;
      if (!file.bySucursalId[k]) file.bySucursalId[k] = [];
      file.bySucursalId[k].push(it);
    }
    return file;
  }
  if (parsed && typeof parsed === 'object' && parsed.bySucursalId && typeof parsed.bySucursalId === 'object') {
    return { version: 1, bySucursalId: { ...parsed.bySucursalId } };
  }
  return emptyFile();
}

export async function loadChecklistSupervisionCacheFile(): Promise<ChecklistSupervisionCacheFile> {
  const raw = await AsyncStorage.getItem(CHECKLIST_SUPERVISION_CACHE_KEY);
  if (!raw) return emptyFile();
  try {
    return normalizeParsed(JSON.parse(raw));
  } catch {
    return emptyFile();
  }
}

export async function saveChecklistSupervisionCacheFile(file: ChecklistSupervisionCacheFile): Promise<void> {
  await AsyncStorage.setItem(CHECKLIST_SUPERVISION_CACHE_KEY, JSON.stringify(file));
}

/** Lista plana (todas las sucursales) para estado en pantalla / filtros. */
export async function loadChecklistSupervisionCacheFlat(): Promise<ChecklistSupervisionItem[]> {
  const f = await loadChecklistSupervisionCacheFile();
  const out: ChecklistSupervisionItem[] = [];
  for (const arr of Object.values(f.bySucursalId)) {
    if (!Array.isArray(arr)) continue;
    for (const raw of arr) {
      const it = raw as ChecklistSupervisionItem;
      out.push({
        ...it,
        empresa_id: Number(it.empresa_id ?? 0),
        contrato_id: Number(it.contrato_id ?? 0),
        isActive: it.isActive !== false,
      });
    }
  }
  return out;
}

/** Persiste la lista plana repartiendo por `corpo_id` (reemplaza el archivo completo: debe incluir todas las sucursales que se quieren conservar). */
export async function saveChecklistSupervisionCacheFlat(list: ChecklistSupervisionItem[]): Promise<void> {
  const bySucursalId: Record<string, ChecklistSupervisionItem[]> = {};
  for (const it of list) {
    const k = String(Number(it.corpo_id));
    if (!Number.isFinite(Number(k)) || Number(k) <= 0) continue;
    if (!bySucursalId[k]) bySucursalId[k] = [];
    bySucursalId[k].push(it);
  }
  await saveChecklistSupervisionCacheFile({ version: 1, bySucursalId });
}

/** Filas activas de una sucursal (lista UI acotada al filtro). */
export function filterChecklistFlatByCorpoId(
  flat: ChecklistSupervisionItem[],
  corpoId: number | null
): ChecklistSupervisionItem[] {
  if (corpoId == null) return [];
  const cid = Number(corpoId);
  return flat.filter((it: any) => it?.isActive !== false && Number(it.corpo_id) === cid);
}

/**
 * Tras un GET exitoso, actualiza solo `bySucursalId[corpoId]`: pendientes locales del bucket + filas del servidor.
 * No reescribe ni borra otras sucursales en caché.
 */
export async function mergeChecklistSupervisionServerIntoCacheForCorpo(
  corpoId: number,
  serverList: ChecklistSupervisionItem[]
): Promise<ChecklistSupervisionItem[]> {
  const cid = Number(corpoId);
  if (!Number.isFinite(cid) || cid <= 0) {
    return loadChecklistSupervisionCacheFlat();
  }

  const file = await loadChecklistSupervisionCacheFile();
  const key = String(cid);
  const matchesScope = (it: any) => Number(it?.corpo_id) === cid;

  if (!Array.isArray(serverList) || serverList.length === 0) {
    return loadChecklistSupervisionCacheFlat();
  }

  const existingForCorpo = Array.isArray(file.bySucursalId[key]) ? [...file.bySucursalId[key]] : [];
  const pendingOnly = existingForCorpo.filter((it: any) => checklistItemIsPendingLocal(it));

  const scopedServer = serverList
    .filter(matchesScope)
    .filter((it: any) => it?.isActive !== false)
    .map((it: any) => ({ ...it, id_local: it.id_local || '' })) as ChecklistSupervisionItem[];

  if (scopedServer.length === 0) {
    return loadChecklistSupervisionCacheFlat();
  }

  const nextFile: ChecklistSupervisionCacheFile = {
    version: 1,
    bySucursalId: {
      ...file.bySucursalId,
      [key]: [...pendingOnly, ...scopedServer],
    },
  };

  await saveChecklistSupervisionCacheFile(nextFile);
  return loadChecklistSupervisionCacheFlat();
}
