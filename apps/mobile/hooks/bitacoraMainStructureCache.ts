import AsyncStorage from '@react-native-async-storage/async-storage';
import { mergeMainStructureFragments } from '@/hooks/mergeMainStructureFragments';
import {
  fragmentToAsyncStorageKey,
  loadMainStructureFragmentsObjectAllowPartial,
  writeMainStructureFragmentPatch,
} from '@/hooks/mainStructureFragmentsStorage';
import { readMainStructureCacheString, writeMainStructureCacheString } from '@/hooks/mainStructureCacheStorage';
import {
  findBitacoraRowInCacheByLocalKey,
  hasBitacoraCacheKeyForSucursal,
  isBitacoraDetenidoLocalDraftRow,
  loadBitacoraVehiculoDetenidoCacheFile,
  readBitacoraCacheRowsForSucursal,
  setBitacoraCacheRowsForSucursal,
} from '@/hooks/bitacoraVehiculoDetenidoCacheStorage';

export function mainStructureCorporateVehiculosKey(sucursal: any): string {
  if (Array.isArray(sucursal?.vehiculos_corporativos)) return 'vehiculos_corporativos';
  if (Array.isArray(sucursal?.c_vehiculos_corporativos)) return 'c_vehiculos_corporativos';
  return 'vehiculos_corporativos';
}

export type BitacoraMainStructureLink = {
  sucursalId: number;
  vehiculoId?: number | null;
  vehiculoLocalKey?: string | null;
  usoId?: number | null;
  usoLocalKey?: string | null;
};

function vehicleMatches(v: any, vehiculoId?: number | null, vehiculoLocalKey?: string | null) {
  if (vehiculoId != null && Number(vehiculoId) > 0 && Number(v?.id) === Number(vehiculoId)) return true;
  if (vehiculoLocalKey && String(vehiculoLocalKey).trim()) {
    const k = String(vehiculoLocalKey);
    if (String(v?.id_local) === k || String(v?.id) === k) return true;
  }
  return false;
}

function usoMatches(u: any, usoId?: number | null, usoLocalKey?: string | null) {
  if (usoId != null && Number(usoId) > 0 && Number(u?.id) === Number(usoId)) return true;
  if (usoLocalKey && String(usoLocalKey).trim()) {
    const k = String(usoLocalKey);
    if (String(u?.id_local) === k || String(u?.id) === k) return true;
  }
  return false;
}

function bitacoraRefMatches(
  u: any,
  bitacoraId?: number | null,
  bitacoraLocalKey?: string | null
): boolean {
  if (bitacoraId != null && Number(bitacoraId) > 0 && Number(u?.bitacora_id) === Number(bitacoraId)) return true;
  const b = u?.bitacora;
  if (!b) return false;
  if (bitacoraId != null && Number(bitacoraId) > 0 && Number(b?.id) === Number(bitacoraId)) return true;
  if (bitacoraLocalKey && String(bitacoraLocalKey).trim()) {
    const k = String(bitacoraLocalKey);
    if (String(b?.id_local) === k || (String(b?.id) === k && k.startsWith('local-'))) return true;
  }
  return false;
}

/** Extrae vínculo uso/vehículo desde payload de bitácora (API o cache). */
export function bitacoraLinkFromRequestPayload(
  sucursalId: number | null | undefined,
  requestData: Record<string, any> | null | undefined
): BitacoraMainStructureLink | null {
  if (requestData == null) return null;
  const sid = Number(sucursalId ?? requestData.sucursal_id ?? requestData.corpo_id ?? 0);
  if (!sid) return null;

  let vehiculoId: number | null =
    requestData.vehiculo_id != null && Number(requestData.vehiculo_id) > 0
      ? Number(requestData.vehiculo_id)
      : null;
  if (String(requestData.vehiculo_id ?? '').startsWith('local-')) vehiculoId = null;

  let usoId: number | null =
    requestData.uso_id != null && Number(requestData.uso_id) > 0 ? Number(requestData.uso_id) : null;
  if (String(requestData.uso_id ?? '').startsWith('local-')) usoId = null;

  const vehiculoLocalKey =
    requestData.vehiculo_id_local != null && String(requestData.vehiculo_id_local).trim() !== ''
      ? String(requestData.vehiculo_id_local)
      : vehiculoId == null &&
          requestData.vehiculo_id != null &&
          String(requestData.vehiculo_id).startsWith('local-')
        ? String(requestData.vehiculo_id)
        : null;

  const usoLocalKey =
    requestData.uso_id_local != null && String(requestData.uso_id_local).trim() !== ''
      ? String(requestData.uso_id_local)
      : usoId == null && requestData.uso_id != null && String(requestData.uso_id).startsWith('local-')
        ? String(requestData.uso_id)
        : null;

  if (!usoId && !usoLocalKey) return null;
  if (!vehiculoId && !vehiculoLocalKey) return null;

  return {
    sucursalId: sid,
    vehiculoId,
    vehiculoLocalKey,
    usoId,
    usoLocalKey,
  };
}

/** Construye el vínculo desde un registro en `bitacora_vehiculo_detenido_cache`. */
export function bitacoraLinkFromCacheItem(item: Record<string, any> | null | undefined): BitacoraMainStructureLink | null {
  if (!item) return null;
  return bitacoraLinkFromRequestPayload(
    Number(item.sucursal_id ?? item.corpo_id ?? 0) || null,
    {
      sucursal_id: item.sucursal_id,
      corpo_id: item.corpo_id,
      vehiculo_id: item.vehiculo_id,
      uso_id: item.uso_id,
      vehiculo_id_local: item.vehiculo_id_local,
      uso_id_local: item.uso_id_local,
    }
  );
}

/** Clave lógica del fragmento (alineada con `mergeMainStructureFragments` y el API main-structure). */
export function bitacoraVehiculosDetenidosFragmentKey(sucursalId: number): string {
  return `sucursal_${Number(sucursalId)}_bitacora_vehiculos_detenidos`;
}

/** Lee solo el arreglo de bitácoras persistido en el fragmento de la sucursal. */
export async function readBitacorasFragmentArray(sucursalId: number): Promise<any[]> {
  const sid = Number(sucursalId);
  if (!Number.isFinite(sid) || sid <= 0) return [];
  const sk = fragmentToAsyncStorageKey(bitacoraVehiculosDetenidosFragmentKey(sid));
  const raw = await AsyncStorage.getItem(sk);
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

function forEachSucursalInMainTree(tree: any[], cb: (suc: any) => void): void {
  for (const emp of tree || []) {
    for (const cli of emp?.clientes || []) {
      const divs = cli?.division || cli?.divisiones || [];
      for (const div of divs) {
        for (const ct of div?.contratos || []) {
          for (const suc of ct?.sucursales || []) {
            cb(suc);
          }
        }
      }
    }
  }
}

/** Primera lectura: copia fragmento/árbol a `bitacora_vehiculo_detenido_cache` para esa sucursal. */
async function ensureBitacoraCacheHydratedForSucursal(sucursalId: number): Promise<void> {
  const sid = Number(sucursalId);
  if (!Number.isFinite(sid) || sid <= 0) return;
  if (await hasBitacoraCacheKeyForSucursal(sid)) return;

  const tree = await loadMainStructureTreeMerged();
  let fromTree: any[] = [];
  if (Array.isArray(tree) && tree.length > 0) {
    forEachSucursalInMainTree(tree, (suc) => {
      if (Number(suc?.id) === sid && Array.isArray(suc.bitacoras_vehiculos_detenidos)) {
        fromTree = [...suc.bitacoras_vehiculos_detenidos];
      }
    });
  }
  const fromFrag = await readBitacorasFragmentArray(sid);
  const initial = fromTree.length > 0 ? fromTree : fromFrag;
  await setBitacoraCacheRowsForSucursal(sid, initial);
}

/** Árbol principal: fragmentos mergeados, JSON legado o `main_structure_cache`. */
export async function loadMainStructureTreeMerged(): Promise<any[]> {
  const loadLegacyTrees = async (): Promise<any[]> => {
    const cacheStr = await readMainStructureCacheString();
    if (cacheStr) {
      try {
        const parsed = JSON.parse(cacheStr);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        /* ignore */
      }
    }
    const legacy = await AsyncStorage.getItem('main_structure_cache');
    if (legacy) {
      try {
        const parsed = JSON.parse(legacy);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        /* ignore */
      }
    }
    return [];
  };

  const fragments = await loadMainStructureFragmentsObjectAllowPartial();
  if (fragments && Object.keys(fragments).length > 0) {
    const merged = mergeMainStructureFragments(fragments);
    if (Array.isArray(merged) && merged.length > 0) {
      return merged;
    }
    // Fragmentos parciales (p. ej. solo parches) o sin `empresas`: merge vacío → usar legado si existe.
    const fallback = await loadLegacyTrees();
    if (fallback.length > 0) return fallback;
    return Array.isArray(merged) ? merged : [];
  }

  return loadLegacyTrees();
}

/**
 * Persiste fragmentos de vehículos y bitácoras.
 * `forcedBitacoras`: si se pasa, se escribe siempre en `sucursal_{id}_bitacora_vehiculos_detenidos` (aunque la sucursal no esté en el árbol).
 */
async function syncVehicleAndBitacoraFragmentsForSucursal(
  tree: any[],
  sid: number,
  forcedBitacoras?: any[]
): Promise<void> {
  const sidn = Number(sid);
  if (!Number.isFinite(sidn) || sidn <= 0) return;
  let suc: any = null;
  forEachSucursalInMainTree(tree, (s) => {
    if (Number(s?.id) === sidn) suc = s;
  });

  let bits: any[];
  if (forcedBitacoras !== undefined) {
    bits = Array.isArray(forcedBitacoras) ? [...forcedBitacoras] : [];
  } else {
    const fromDisk = await readBitacorasFragmentArray(sidn);
    /*
     * Si el nodo de sucursal existe en el árbol y trae `bitacoras_vehiculos_detenidos` como array
     * (aunque sea []), es la fuente de verdad — p. ej. tras migrar bitácoras a otra sucursal.
     * Solo si no hay array en el árbol, conservamos el fragmento en disco (merge parcial sin nodo).
     */
    if (suc != null && Array.isArray(suc.bitacoras_vehiculos_detenidos)) {
      bits = [...suc.bitacoras_vehiculos_detenidos];
    } else {
      bits = fromDisk;
    }
  }

  if (suc) {
    suc.bitacoras_vehiculos_detenidos = bits;
  }

  await writeMainStructureFragmentPatch(bitacoraVehiculosDetenidosFragmentKey(sidn), bits);

  if (!suc) return;
  const vk = mainStructureCorporateVehiculosKey(suc);
  const vehs = Array.isArray(suc[vk]) ? suc[vk] : [];
  await writeMainStructureFragmentPatch(`sucursal_${sidn}_vehiculos_corporativos`, vehs);
}

/** Persiste árbol mergeado + fragmentos `sucursal_*_vehiculos_corporativos` y bitácoras (mismo mecanismo que la jerarquía nueva). */
export async function persistMergedMainStructureTree(
  tree: any[],
  sucursalesToSync: number[],
  forcedBitacorasBySid?: Map<number, any[]>
): Promise<void> {
  const uniq = [...new Set(sucursalesToSync.map(Number).filter((n) => Number.isFinite(n) && n > 0))];
  for (const sid of uniq) {
    const hasForced = forcedBitacorasBySid != null && forcedBitacorasBySid.has(sid);
    const forced = hasForced ? forcedBitacorasBySid!.get(sid)! : undefined;
    await syncVehicleAndBitacoraFragmentsForSucursal(tree, sid, forced);
  }
  await writeMainStructureCacheString(JSON.stringify(tree));
}

async function persistMainStructureTreeAfterBitacora(
  tree: any[],
  sucursalesToSync: number[],
  forcedBitacorasBySid?: Map<number, any[]>
): Promise<void> {
  await persistMergedMainStructureTree(tree, sucursalesToSync, forcedBitacorasBySid);
}

export async function setBitacoraOnUsoInMainStructureCache(
  params: BitacoraMainStructureLink & { bitacora: any }
): Promise<boolean> {
  const { sucursalId, vehiculoId, vehiculoLocalKey, usoId, usoLocalKey, bitacora } = params;
  if (!sucursalId) return false;

  const tree = await loadMainStructureTreeMerged();
  if (!Array.isArray(tree)) return false;

  let changed = false;
  for (const emp of tree) {
    for (const cli of emp?.clientes || []) {
      const divs = cli?.division || cli?.divisiones || [];
      for (const div of divs) {
        for (const ct of div?.contratos || []) {
          for (const suc of ct?.sucursales || []) {
            if (Number(suc?.id) !== Number(sucursalId)) continue;
            const vk = mainStructureCorporateVehiculosKey(suc);
            const vehs = Array.isArray(suc[vk]) ? suc[vk] : [];
            for (const v of vehs) {
              if (!vehicleMatches(v, vehiculoId, vehiculoLocalKey)) continue;
              const usos = v?.usos || v?.c_usos_vehiculos_corporativos || [];
              for (const u of usos) {
                if (!usoMatches(u, usoId, usoLocalKey)) continue;
                u.bitacora_id = bitacora?.id > 0 ? bitacora.id : bitacora?.id_local ?? bitacora?.id ?? null;
                u.bitacora = bitacora ?? null;
                changed = true;
                break;
              }
            }
          }
        }
      }
    }
  }

  if (changed) await persistMainStructureTreeAfterBitacora(tree, [Number(sucursalId)]);
  return changed;
}

/** Quita bitácora del uso que coincide con el vínculo (sucursal / vehículo / uso). */
export async function clearBitacoraOnUsoInMainStructureCache(params: BitacoraMainStructureLink): Promise<boolean> {
  const { sucursalId, vehiculoId, vehiculoLocalKey, usoId, usoLocalKey } = params;
  if (!sucursalId) return false;

  const tree = await loadMainStructureTreeMerged();
  if (!Array.isArray(tree)) return false;

  let changed = false;
  for (const emp of tree) {
    for (const cli of emp?.clientes || []) {
      const divs = cli?.division || cli?.divisiones || [];
      for (const div of divs) {
        for (const ct of div?.contratos || []) {
          for (const suc of ct?.sucursales || []) {
            if (Number(suc?.id) !== Number(sucursalId)) continue;
            const vk = mainStructureCorporateVehiculosKey(suc);
            const vehs = Array.isArray(suc[vk]) ? suc[vk] : [];
            for (const v of vehs) {
              if (!vehicleMatches(v, vehiculoId, vehiculoLocalKey)) continue;
              const usos = v?.usos || v?.c_usos_vehiculos_corporativos || [];
              for (const u of usos) {
                if (!usoMatches(u, usoId, usoLocalKey)) continue;
                u.bitacora_id = null;
                u.bitacora = null;
                changed = true;
                break;
              }
            }
          }
        }
      }
    }
  }

  if (changed) await persistMainStructureTreeAfterBitacora(tree, [Number(sucursalId)]);
  return changed;
}

/**
 * Recorre el arbol y limpia cualquier uso que tenga esta bitacora (por id servidor o id local).
 * Util al eliminar o al mover de vinculo sin tener el uso anterior resuelto.
 */
export async function clearBitacoraFromMainStructureByBitacoraRef(params: {
  bitacoraId?: number | null;
  idLocal?: string | null;
}): Promise<boolean> {
  const { bitacoraId, idLocal } = params;
  if (!(bitacoraId && Number(bitacoraId) > 0) && !(idLocal && String(idLocal).trim())) return false;

  const tree = await loadMainStructureTreeMerged();
  if (!Array.isArray(tree)) return false;

  const touchedSucursales = new Set<number>();
  let changed = false;
  for (const emp of tree) {
    for (const cli of emp?.clientes || []) {
      const divs = cli?.division || cli?.divisiones || [];
      for (const div of divs) {
        for (const ct of div?.contratos || []) {
          for (const suc of ct?.sucursales || []) {
            const vk = mainStructureCorporateVehiculosKey(suc);
            const vehs = Array.isArray(suc[vk]) ? suc[vk] : [];
            for (const v of vehs) {
              const usos = v?.usos || v?.c_usos_vehiculos_corporativos || [];
              for (const u of usos) {
                if (!bitacoraRefMatches(u, bitacoraId ?? null, idLocal ?? null)) continue;
                u.bitacora_id = null;
                u.bitacora = null;
                changed = true;
                const sid = Number(suc?.id);
                if (Number.isFinite(sid) && sid > 0) touchedSucursales.add(sid);
              }
            }
          }
        }
      }
    }
  }

  if (changed) await persistMainStructureTreeAfterBitacora(tree, [...touchedSucursales]);
  return changed;
}

function sameBitacoraLink(a: BitacoraMainStructureLink | null, b: BitacoraMainStructureLink | null): boolean {
  if (!a || !b) return false;
  return (
    Number(a.sucursalId) === Number(b.sucursalId) &&
    Number(a.vehiculoId ?? 0) === Number(b.vehiculoId ?? 0) &&
    String(a.vehiculoLocalKey ?? '') === String(b.vehiculoLocalKey ?? '') &&
    Number(a.usoId ?? 0) === Number(b.usoId ?? 0) &&
    String(a.usoLocalKey ?? '') === String(b.usoLocalKey ?? '')
  );
}

export function isBitacoraDetenidoLocalDraft(b: any): boolean {
  return isBitacoraDetenidoLocalDraftRow(b);
}

function dedupeBitacoraRows(rows: any[]): any[] {
  const out: any[] = [];
  const seen = new Set<string>();
  for (const row of Array.isArray(rows) ? rows : []) {
    const sid = Number(row?.id);
    const local =
      row?.id_local != null && String(row.id_local).trim() !== '' ? String(row.id_local).trim() : '';
    const key =
      Number.isFinite(sid) && sid > 0
        ? `id:${sid}`
        : local
          ? `local:${local}`
          : `fallback:${JSON.stringify([row?.tipo, row?.created_at, row?.sucursal_id, row?.vehiculo_id])}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

export async function readBitacorasForSucursalFromMainStructure(sucursalId: number): Promise<any[]> {
  const sid = Number(sucursalId);
  if (!Number.isFinite(sid) || sid <= 0) return [];

  await ensureBitacoraCacheHydratedForSucursal(sid);
  const rows = await readBitacoraCacheRowsForSucursal(sid);
  return dedupeBitacoraRows(rows);
}

export async function mergeBitacorasDetenidosForSucursalFromServer(params: {
  sucursalId: number;
  serverRows: any[];
}): Promise<void> {
  const { sucursalId, serverRows } = params;
  const sid = Number(sucursalId);
  if (!Number.isFinite(sid) || sid <= 0) return;

  let tree = await loadMainStructureTreeMerged();
  if (!Array.isArray(tree)) tree = [];

  const serverIds = new Set(
    serverRows.map((r) => Number(r.id)).filter((n) => Number.isFinite(n) && n > 0)
  );

  let sucNode: any = null;
  forEachSucursalInMainTree(tree, (suc) => {
    if (Number(suc?.id) === sid) sucNode = suc;
  });

  let current: any[] = [];
  if (await hasBitacoraCacheKeyForSucursal(sid)) {
    current = await readBitacoraCacheRowsForSucursal(sid);
  } else if (sucNode && Array.isArray(sucNode.bitacoras_vehiculos_detenidos) && sucNode.bitacoras_vehiculos_detenidos.length > 0) {
    current = [...sucNode.bitacoras_vehiculos_detenidos];
  } else {
    current = await readBitacorasFragmentArray(sid);
  }

  const localOnly = current.filter((b: any) => {
    if (!isBitacoraDetenidoLocalDraft(b)) return false;
    const nid = typeof b.id === 'number' ? b.id : Number(b.id);
    if (Number.isFinite(nid) && nid > 0 && serverIds.has(nid)) return false;
    return true;
  });

  const normalizedServer = serverRows
    .filter((r: any) => r?.isActive !== false)
    .map((r) => ({
      ...r,
      id_local: r.id_local ?? '',
      sucursal_id: r.sucursal_id ?? sid,
      corpo_id: r.corpo_id ?? sid,
    }));

  const merged = dedupeBitacoraRows([...normalizedServer, ...localOnly]);
  await setBitacoraCacheRowsForSucursal(sid, merged);
  if (sucNode) {
    sucNode.bitacoras_vehiculos_detenidos = merged;
  }

  await persistMainStructureTreeAfterBitacora(tree, [sid], new Map([[sid, merged]]));
}

export async function upsertBitacoraDetenidoRowInMainStructure(
  row: any,
  sucursalId: number,
  matchLocalKey?: string | null
): Promise<void> {
  let tree = await loadMainStructureTreeMerged();
  if (!Array.isArray(tree)) tree = [];

  const sid = Number(sucursalId);
  if (!sid) return;

  await ensureBitacoraCacheHydratedForSucursal(sid);

  const normalized = {
    ...row,
    sucursal_id: row.sucursal_id ?? sid,
    corpo_id: row.corpo_id ?? sid,
  };

  let sucNode: any = null;
  forEachSucursalInMainTree(tree, (suc) => {
    if (Number(suc?.id) === sid) sucNode = suc;
  });

  const baseList = await readBitacoraCacheRowsForSucursal(sid);

  const list = [...baseList];
  const idx = list.findIndex((b: any) => {
    if (matchLocalKey && (String(b.id_local) === matchLocalKey || String(b.id) === matchLocalKey)) return true;
    if (typeof normalized.id === 'number' && normalized.id > 0 && Number(b.id) === Number(normalized.id)) return true;
    return false;
  });
  if (idx >= 0) list[idx] = { ...list[idx], ...normalized };
  else list.unshift(normalized);
  const deduped = dedupeBitacoraRows(list);

  if (sucNode) {
    sucNode.bitacoras_vehiculos_detenidos = deduped;
  }

  await setBitacoraCacheRowsForSucursal(sid, deduped);
  await persistMainStructureTreeAfterBitacora(tree, [sid], new Map([[sid, deduped]]));
}

export async function removeBitacoraDetenidoRowFromMainStructure(params: {
  bitacoraId?: number;
  idLocal?: string | null;
}): Promise<void> {
  const { bitacoraId, idLocal } = params;
  let tree = await loadMainStructureTreeMerged();
  if (!Array.isArray(tree)) tree = [];

  const touched = new Map<number, any[]>();
  forEachSucursalInMainTree(tree, (suc) => {
    if (!Array.isArray(suc.bitacoras_vehiculos_detenidos)) return;
    const next = suc.bitacoras_vehiculos_detenidos.filter((b: any) => {
      if (bitacoraId && Number(b.id) === Number(bitacoraId)) return false;
      if (idLocal && String(b.id_local) === String(idLocal)) return false;
      return true;
    });
    if (next.length !== suc.bitacoras_vehiculos_detenidos.length) {
      suc.bitacoras_vehiculos_detenidos = next;
      const sid = Number(suc?.id);
      if (Number.isFinite(sid) && sid > 0) touched.set(sid, next);
    }
  });

  if (touched.size === 0 && (bitacoraId || idLocal)) {
    const fragments = await loadMainStructureFragmentsObjectAllowPartial();
    if (fragments) {
      for (const key of Object.keys(fragments)) {
        const m = /^sucursal_(\d+)_bitacora_vehiculos_detenidos$/.exec(key);
        if (!m) continue;
        const sid = Number(m[1]);
        const arr = Array.isArray(fragments[key]) ? [...fragments[key]] : [];
        const next = arr.filter((b: any) => {
          if (bitacoraId && Number(b.id) === Number(bitacoraId)) return false;
          if (idLocal && String(b.id_local) === String(idLocal)) return false;
          return true;
        });
        if (next.length !== arr.length) {
          touched.set(sid, next);
          forEachSucursalInMainTree(tree, (suc) => {
            if (Number(suc?.id) === sid) suc.bitacoras_vehiculos_detenidos = next;
          });
        }
      }
    }
  }

  if (touched.size === 0 && (bitacoraId || idLocal)) {
    const st = await loadBitacoraVehiculoDetenidoCacheFile();
    for (const k of Object.keys(st.bySucursalId)) {
      const sid = Number(k);
      if (!Number.isFinite(sid) || sid <= 0) continue;
      const arr = Array.isArray(st.bySucursalId[k]) ? [...st.bySucursalId[k]] : [];
      const next = arr.filter((b: any) => {
        if (bitacoraId && Number(b.id) === Number(bitacoraId)) return false;
        if (idLocal && String(b.id_local) === String(idLocal)) return false;
        return true;
      });
      if (next.length !== arr.length) {
        touched.set(sid, next);
        forEachSucursalInMainTree(tree, (suc) => {
          if (Number(suc?.id) === sid) suc.bitacoras_vehiculos_detenidos = next;
        });
      }
    }
  }

  if (touched.size > 0) {
    for (const [sid, rows] of touched) {
      await setBitacoraCacheRowsForSucursal(sid, rows);
    }
    await persistMainStructureTreeAfterBitacora(tree, [...touched.keys()], touched);
  }
}

export async function findBitacoraDetenidoInMainStructureByLocalKey(
  idLocal: string
): Promise<{ row: any; sucursalId: number } | null> {
  if (!idLocal) return null;
  const fromCache = await findBitacoraRowInCacheByLocalKey(idLocal);
  if (fromCache) return fromCache;
  const tree = await loadMainStructureTreeMerged();
  if (Array.isArray(tree)) {
    let out: { row: any; sucursalId: number } | null = null;
    forEachSucursalInMainTree(tree, (suc) => {
      const arr = Array.isArray(suc.bitacoras_vehiculos_detenidos) ? suc.bitacoras_vehiculos_detenidos : [];
      const hit = arr.find((b: any) => String(b.id_local) === String(idLocal));
      if (hit) out = { row: hit, sucursalId: Number(suc.id) };
    });
    if (out) return out;
  }

  const fragments = await loadMainStructureFragmentsObjectAllowPartial();
  if (fragments) {
    for (const key of Object.keys(fragments)) {
      const m = /^sucursal_(\d+)_bitacora_vehiculos_detenidos$/.exec(key);
      if (!m) continue;
      const sid = Number(m[1]);
      const arr = Array.isArray(fragments[key]) ? fragments[key] : [];
      const hit = arr.find((b: any) => String(b.id_local) === String(idLocal));
      if (hit) return { row: hit, sucursalId: sid };
    }
  }

  return null;
}

export async function moveBitacoraDetenidoRowBetweenSucursales(params: {
  row: any;
  oldSucursalId: number;
  newSucursalId: number;
  matchLocalKey?: string | null;
}): Promise<void> {
  const { row, oldSucursalId, newSucursalId, matchLocalKey } = params;
  if (Number(oldSucursalId) === Number(newSucursalId)) {
    await upsertBitacoraDetenidoRowInMainStructure(row, newSucursalId, matchLocalKey ?? null);
    return;
  }
  await removeBitacoraDetenidoRowFromMainStructure({
    bitacoraId: typeof row.id === 'number' && row.id > 0 ? row.id : undefined,
    idLocal: matchLocalKey || row.id_local || null,
  });
  const moved = {
    ...row,
    sucursal_id: newSucursalId,
    corpo_id: newSucursalId,
  };
  await upsertBitacoraDetenidoRowInMainStructure(moved, newSucursalId, matchLocalKey ?? null);
}

/** Si cambia sucursal/vehículo/uso: limpia el vínculo anterior y asigna en el nuevo (solo si hay uso destino). */
export async function moveBitacoraOnMainStructureCache(params: {
  oldLink: BitacoraMainStructureLink | null;
  newLink: BitacoraMainStructureLink | null;
  bitacora: any;
}): Promise<void> {
  const { oldLink, newLink, bitacora } = params;
  if (oldLink && newLink && sameBitacoraLink(oldLink, newLink)) {
    await setBitacoraOnUsoInMainStructureCache({ ...newLink, bitacora });
    return;
  }
  if (oldLink?.sucursalId && (oldLink.usoId || oldLink.usoLocalKey) && (oldLink.vehiculoId || oldLink.vehiculoLocalKey)) {
    await clearBitacoraOnUsoInMainStructureCache(oldLink);
  }
  if (
    newLink?.sucursalId &&
    (newLink.usoId || newLink.usoLocalKey) &&
    (newLink.vehiculoId || newLink.vehiculoLocalKey)
  ) {
    await setBitacoraOnUsoInMainStructureCache({ ...newLink, bitacora });
  }
}

/**
 * Tras sincronizar un update desde cola: quita referencias previas de esta bitácora y vuelve a colgar en el uso del payload.
 */
export async function resyncMainStructureAfterBitacoraServerUpdate(
  bitacoraServerId: number,
  requestData: Record<string, any>
): Promise<void> {
  if (!bitacoraServerId) return;
  await clearBitacoraFromMainStructureByBitacoraRef({ bitacoraId: bitacoraServerId });
  await removeBitacoraDetenidoRowFromMainStructure({ bitacoraId: bitacoraServerId });
  const sid = Number(requestData.sucursal_id ?? requestData.corpo_id ?? 0);
  if (sid > 0) {
    await upsertBitacoraDetenidoRowInMainStructure(
      {
        id: bitacoraServerId,
        empresa_id: requestData.empresa_id,
        cliente_id: requestData.cliente_id,
        sucursal_id: sid,
        corpo_id: sid,
        division_id: requestData.division_id,
        contrato_id: requestData.contrato_id,
        puesto_id: requestData.puesto_id,
        isActive: requestData.isActive !== false,
        vehiculo_id: requestData.vehiculo_id ?? null,
        uso_id: requestData.uso_id ?? null,
        vehiculo_id_local: requestData.vehiculo_id_local,
        uso_id_local: requestData.uso_id_local,
        tipo: requestData.tipo,
        informacion_general: requestData.informacion_general,
        informacion_revision: requestData.informacion_revision,
        movimientos_vehiculos: requestData.movimientos_vehiculos,
        observaciones: requestData.observaciones,
        firma_responsable: requestData.firma_responsable,
        id_local: '',
      },
      sid,
      null
    );
  }
  const link = bitacoraLinkFromRequestPayload(sid || null, requestData);
  if (link) {
    await setBitacoraOnUsoInMainStructureCache({
      ...link,
      bitacora: {
        id: bitacoraServerId,
        tipo: requestData.tipo,
      },
    });
  }
}
