import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ChecklistSupervisionItem } from '@/hooks/checklistSupervisionFunctions';
import { sanitizeArticulosPuestoJsonForCache } from '@/utils/articuloMantenimientoFiles';

export const CHECKLIST_SUPERVISION_CACHE_KEY = 'checklist_supervision_cache';

export type ChecklistSupervisionCacheFile = {
  version: 2;
  byPuestoId: Record<string, ChecklistSupervisionItem[]>;
};

function emptyFile(): ChecklistSupervisionCacheFile {
  return { version: 2, byPuestoId: {} };
}

/** Solo borradores sin id de servidor (id === 0). Ediciones offline de filas ya sincronizadas tienen id > 0. */
export function checklistItemIsPendingLocal(it: any): boolean {
  return Number(it?.id ?? 0) === 0;
}

/** Elimina duplicados por id de servidor o id_local (conserva la fila con edición offline si existe). */
export function dedupeChecklistRows(rows: ChecklistSupervisionItem[]): ChecklistSupervisionItem[] {
  const byServerId = new Map<number, ChecklistSupervisionItem>();
  const localsByKey = new Map<string, ChecklistSupervisionItem>();

  for (const raw of rows) {
    const row = normalizeChecklistRowForCache(raw);
    const id = Number(row.id ?? 0);
    const idLocal = String((row as any).id_local ?? '').trim();

    if (id > 0) {
      const prev = byServerId.get(id);
      if (!prev) {
        byServerId.set(id, row);
        continue;
      }
      const prevLocal = String((prev as any).id_local ?? '').trim();
      if (idLocal && !prevLocal) {
        byServerId.set(id, row);
      } else if (idLocal && prevLocal) {
        byServerId.set(id, row);
      }
      continue;
    }

    const localKey = idLocal || `anon-${localsByKey.size}`;
    if (!localsByKey.has(localKey)) {
      localsByKey.set(localKey, row);
    }
  }

  return [...localsByKey.values(), ...byServerId.values()];
}

/** Resuelve id de sucursal desde campo plano o relación anidada. */
export function resolveChecklistRowCorpoId(it: any, fallbackCorpoId?: number | null): number {
  const fromRow = Number(it?.corpo_id ?? it?.corpo?.id ?? 0);
  if (Number.isFinite(fromRow) && fromRow > 0) return fromRow;
  const fb = Number(fallbackCorpoId ?? 0);
  return Number.isFinite(fb) && fb > 0 ? fb : 0;
}

/** Resuelve id de puesto desde campo plano o relación anidada. */
export function resolveChecklistRowPuestoId(it: any, fallbackPuestoId?: number | null): number {
  const fromRow = Number(it?.puesto_id ?? it?.puesto?.id ?? 0);
  if (Number.isFinite(fromRow) && fromRow > 0) return fromRow;
  const fb = Number(fallbackPuestoId ?? 0);
  return Number.isFinite(fb) && fb > 0 ? fb : 0;
}

export function normalizeChecklistRowForCache(
  it: any,
  fallbackPuestoId?: number | null,
): ChecklistSupervisionItem {
  const puesto_id = resolveChecklistRowPuestoId(it, fallbackPuestoId);
  const corpo_id = resolveChecklistRowCorpoId(it, it?.corpo_id ?? it?.corpo?.id ?? null);
  const row = {
    ...it,
    id: Number(it?.id ?? 0),
    empresa_id: Number(it?.empresa_id ?? 0),
    contrato_id: Number(it?.contrato_id ?? 0),
    cliente_id: Number(it?.cliente_id ?? 0),
    division_id: Number(it?.division_id ?? 0),
    puesto_id,
    corpo_id,
    isActive: it?.isActive !== false,
  } as ChecklistSupervisionItem;
  if (Number(row.id) > 0 && !String((row as any).id_local ?? '').trim()) {
    delete (row as any).id_local;
  }
  if ((row as any).articulos_puesto != null) {
    const sanitized = sanitizeArticulosPuestoJsonForCache((row as any).articulos_puesto);
    if (sanitized != null) (row as any).articulos_puesto = sanitized;
  }
  return row;
}

function pushRowToPuestoBuckets(
  target: Record<string, ChecklistSupervisionItem[]>,
  raw: any,
  fallbackPuestoId?: number | null,
) {
  const row = normalizeChecklistRowForCache(raw, fallbackPuestoId);
  const k = String(row.puesto_id);
  if (!Number.isFinite(Number(k)) || Number(k) <= 0) return;
  if (!target[k]) target[k] = [];
  target[k].push(row);
}

function migrateLegacyCache(parsed: any): ChecklistSupervisionCacheFile {
  const byPuestoId: Record<string, ChecklistSupervisionItem[]> = {};

  if (Array.isArray(parsed)) {
    for (const raw of parsed) pushRowToPuestoBuckets(byPuestoId, raw);
    return { version: 2, byPuestoId };
  }

  if (parsed && typeof parsed === 'object' && parsed.byPuestoId && typeof parsed.byPuestoId === 'object') {
    for (const [bucketKey, arr] of Object.entries(parsed.byPuestoId)) {
      if (!Array.isArray(arr)) continue;
      const bucketPuesto = Number(bucketKey);
      const fallback = Number.isFinite(bucketPuesto) && bucketPuesto > 0 ? bucketPuesto : null;
      for (const raw of arr) pushRowToPuestoBuckets(byPuestoId, raw, fallback);
    }
    return { version: 2, byPuestoId };
  }

  if (parsed && typeof parsed === 'object' && parsed.bySucursalId && typeof parsed.bySucursalId === 'object') {
    for (const arr of Object.values(parsed.bySucursalId)) {
      if (!Array.isArray(arr)) continue;
      for (const raw of arr) pushRowToPuestoBuckets(byPuestoId, raw);
    }
    return { version: 2, byPuestoId };
  }

  return emptyFile();
}

function normalizeParsed(parsed: any): ChecklistSupervisionCacheFile {
  if (
    parsed &&
    typeof parsed === 'object' &&
    parsed.version === 2 &&
    parsed.byPuestoId &&
    typeof parsed.byPuestoId === 'object'
  ) {
    const byPuestoId: Record<string, ChecklistSupervisionItem[]> = {};
    for (const [bucketKey, arr] of Object.entries(parsed.byPuestoId)) {
      if (!Array.isArray(arr)) continue;
      const bucketPuesto = Number(bucketKey);
      const fallback = Number.isFinite(bucketPuesto) && bucketPuesto > 0 ? bucketPuesto : null;
      for (const raw of arr) pushRowToPuestoBuckets(byPuestoId, raw, fallback);
    }
    return { version: 2, byPuestoId };
  }
  return migrateLegacyCache(parsed);
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

export async function loadChecklistSupervisionCacheForPuesto(puestoId: number): Promise<ChecklistSupervisionItem[]> {
  const pid = Number(puestoId);
  if (!Number.isFinite(pid) || pid <= 0) return [];
  const file = await loadChecklistSupervisionCacheFile();
  const arr = file.byPuestoId[String(pid)];
  if (!Array.isArray(arr)) return [];
  return dedupeChecklistRows(
    arr
      .map((raw) => normalizeChecklistRowForCache(raw, pid))
      .filter((it) => it.isActive !== false),
  );
}

/** Lista plana (todos los puestos) para operaciones de merge / cola offline. */
export async function loadChecklistSupervisionCacheFlat(): Promise<ChecklistSupervisionItem[]> {
  const f = await loadChecklistSupervisionCacheFile();
  const out: ChecklistSupervisionItem[] = [];
  for (const [bucketKey, arr] of Object.entries(f.byPuestoId)) {
    if (!Array.isArray(arr)) continue;
    const bucketPuesto = Number(bucketKey);
    const fallback = Number.isFinite(bucketPuesto) && bucketPuesto > 0 ? bucketPuesto : null;
    for (const raw of arr) {
      out.push(normalizeChecklistRowForCache(raw, fallback));
    }
  }
  return out;
}

export async function saveChecklistSupervisionCacheForPuesto(
  puestoId: number,
  rows: ChecklistSupervisionItem[],
): Promise<void> {
  const pid = Number(puestoId);
  if (!Number.isFinite(pid) || pid <= 0) return;

  const file = await loadChecklistSupervisionCacheFile();
  const normalized = dedupeChecklistRows(
    rows
      .map((raw) => normalizeChecklistRowForCache(raw, pid))
      .filter((it) => it.isActive !== false || checklistItemIsPendingLocal(it)),
  );

  await saveChecklistSupervisionCacheFile({
    version: 2,
    byPuestoId: {
      ...file.byPuestoId,
      [String(pid)]: normalized,
    },
  });
}

export function applyServerPayloadToCachedChecklistRow(
  existing: ChecklistSupervisionItem,
  serverPayload?: any,
  requestData?: any,
): ChecklistSupervisionItem {
  const puestoFallback = resolveChecklistRowPuestoId(existing, requestData?.puesto_id);
  const merged = {
    ...existing,
    ...(requestData && typeof requestData === 'object' ? requestData : {}),
    ...(serverPayload && typeof serverPayload === 'object' ? serverPayload : {}),
    id: Number(serverPayload?.id ?? existing.id ?? 0),
    puesto_id:
      serverPayload?.puesto_id ??
      existing.puesto_id ??
      requestData?.puesto_id ??
      existing.puesto?.id ??
      null,
    corpo_id:
      serverPayload?.corpo_id ??
      existing.corpo_id ??
      requestData?.corpo_id ??
      existing.corpo?.id ??
      null,
    cliente: serverPayload?.cliente ?? existing.cliente,
    corpo: serverPayload?.corpo ?? existing.corpo,
    puesto: serverPayload?.puesto ?? existing.puesto,
    images: serverPayload?.images ?? existing.images,
  };
  return normalizeChecklistRowForCache(merged, puestoFallback);
}

function checklistCacheRowMatches(
  it: any,
  opts: { idLocal?: string; serverId?: number; remove?: boolean },
): boolean {
  const idl = String(opts.idLocal ?? '').trim();
  const sid = Number(opts.serverId ?? 0);
  if (idl && String(it?.id_local ?? '').trim() === idl) return true;
  if (sid > 0 && Number(it?.id) === sid) return true;
  return false;
}

/** Actualiza o elimina una fila en caché tras sync online, sin borrar otros buckets. */
export async function patchChecklistSupervisionCacheAfterSync(options: {
  matchIdLocal?: string | null;
  matchServerId?: number | null;
  serverPayload?: any;
  requestData?: any;
  remove?: boolean;
}): Promise<void> {
  const file = await loadChecklistSupervisionCacheFile();
  const matchOpts = {
    idLocal: String(options.matchIdLocal ?? '').trim() || undefined,
    serverId: Number(options.matchServerId ?? 0) || undefined,
    remove: options.remove,
  };

  if (!matchOpts.idLocal && !matchOpts.serverId) return;

  let bucketKey: string | null = null;
  let rowIndex = -1;

  for (const [key, arr] of Object.entries(file.byPuestoId)) {
    if (!Array.isArray(arr)) continue;
    const idx = arr.findIndex((it) => checklistCacheRowMatches(it, matchOpts));
    if (idx !== -1) {
      bucketKey = key;
      rowIndex = idx;
      break;
    }
  }

  if (bucketKey == null || rowIndex < 0) return;

  const bucketPuesto = Number(bucketKey);
  const bucket = [...(file.byPuestoId[bucketKey] ?? [])];

  if (options.remove) {
    const next = bucket.filter((it) => !checklistCacheRowMatches(it, matchOpts));
    await saveChecklistSupervisionCacheForPuesto(bucketPuesto, next as ChecklistSupervisionItem[]);
    return;
  }

  const existing = bucket[rowIndex] as ChecklistSupervisionItem;
  const patched = applyServerPayloadToCachedChecklistRow(
    existing,
    options.serverPayload,
    options.requestData,
  );
  const next = bucket.map((it, i) => (i === rowIndex ? patched : it));
  await saveChecklistSupervisionCacheForPuesto(bucketPuesto, next);
}

/**
 * Persiste la lista plana agrupando por `puesto_id`.
 * Fusiona con buckets existentes; nunca vacía el archivo completo por error de normalización.
 */
export async function saveChecklistSupervisionCacheFlat(list: ChecklistSupervisionItem[]): Promise<void> {
  if (!Array.isArray(list) || list.length === 0) return;

  const existing = await loadChecklistSupervisionCacheFile();
  const grouped: Record<string, ChecklistSupervisionItem[]> = {};

  for (const raw of list) {
    let fallback = resolveChecklistRowPuestoId(raw, null);
    if (fallback <= 0) {
      for (const [k, arr] of Object.entries(existing.byPuestoId)) {
        if (
          !Array.isArray(arr) ||
          !arr.some(
            (r: any) =>
              (raw.id != null && Number(r.id) === Number(raw.id) && Number(raw.id) > 0) ||
              (raw.id_local != null &&
                String(raw.id_local).trim() !== '' &&
                String(r.id_local ?? '') === String(raw.id_local)),
          )
        ) {
          continue;
        }
        fallback = Number(k);
        break;
      }
    }
    const row = normalizeChecklistRowForCache(raw, fallback > 0 ? fallback : null);
    const k = String(row.puesto_id);
    if (!Number.isFinite(Number(k)) || Number(k) <= 0) continue;
    if (!grouped[k]) grouped[k] = [];
    grouped[k].push(row);
  }

  if (Object.keys(grouped).length === 0) return;

  await saveChecklistSupervisionCacheFile({
    version: 2,
    byPuestoId: { ...existing.byPuestoId, ...grouped },
  });
}

export function filterChecklistFlatByPuestoId(
  flat: ChecklistSupervisionItem[],
  puestoId: number | null,
): ChecklistSupervisionItem[] {
  if (puestoId == null) return [];
  const pid = Number(puestoId);
  return flat.filter((it: any) => {
    if (it?.isActive === false) return false;
    return resolveChecklistRowPuestoId(it, pid) === pid;
  });
}

export async function mergeChecklistSupervisionServerIntoCacheForPuesto(
  puestoId: number,
  serverList: ChecklistSupervisionItem[],
): Promise<void> {
  const pid = Number(puestoId);
  if (!Number.isFinite(pid) || pid <= 0 || !Array.isArray(serverList)) return;

  const file = await loadChecklistSupervisionCacheFile();
  const key = String(pid);

  const existingForPuesto = Array.isArray(file.byPuestoId[key]) ? [...file.byPuestoId[key]] : [];
  const pendingOnly = existingForPuesto
    .map((it) => normalizeChecklistRowForCache(it, pid))
    .filter((it) => checklistItemIsPendingLocal(it));

  const offlineServerEdits = new Map<number, ChecklistSupervisionItem>();
  for (const it of existingForPuesto) {
    const sid = Number(it?.id ?? 0);
    const idLocal = String((it as any)?.id_local ?? '').trim();
    if (sid > 0 && idLocal) {
      offlineServerEdits.set(sid, normalizeChecklistRowForCache(it, pid));
    }
  }

  const scopedServer = serverList
    .map((it) => {
      const normalized = normalizeChecklistRowForCache(it, pid);
      const edit = offlineServerEdits.get(Number(normalized.id));
      if (!edit) return normalized;
      return normalizeChecklistRowForCache({ ...normalized, ...edit, id: normalized.id }, pid);
    })
    .filter((it) => it.isActive !== false);

  await saveChecklistSupervisionCacheFile({
    version: 2,
    byPuestoId: {
      ...file.byPuestoId,
      [key]: dedupeChecklistRows([...pendingOnly, ...scopedServer]),
    },
  });
}
