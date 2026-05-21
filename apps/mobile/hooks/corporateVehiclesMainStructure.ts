import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  loadMainStructureTreeMerged,
  mainStructureCorporateVehiculosKey,
  persistMergedMainStructureTree,
  readBitacorasFragmentArray,
} from './bitacoraMainStructureCache';
import { fragmentToAsyncStorageKey, writeMainStructureFragmentPatch } from './mainStructureFragmentsStorage';

export function isCorporateVehicleLocalDraft(v: any): boolean {
  if (!v) return false;
  if (v.synced === false) return true;
  if (v.id_local != null && String(v.id_local).startsWith('local-')) return true;
  if (typeof v.id === 'string' && v.id.startsWith('local-')) return true;
  return false;
}

/** Id de servidor (no `local-*`). Acepta `id` string/number desde API o caché. */
export function parseCorporateVehicleServerId(id: unknown): number | undefined {
  if (id == null || id === '') return undefined;
  const s = String(id).trim();
  if (!s || s.startsWith('local-')) return undefined;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** Quita un vehículo de los fragmentos AsyncStorage aunque el nodo de sucursal no esté en el árbol mergeado. */
async function removeVehicleFromSucursalVehicleAndBitacoraFragments(
  sucursalId: number,
  vehicleIdNum: number | undefined,
  idLocal: string | null | undefined
): Promise<boolean> {
  const sid = Number(sucursalId);
  if (!Number.isFinite(sid) || sid <= 0) return false;
  const vehKey = `sucursal_${sid}_vehiculos_corporativos`;
  const sk = fragmentToAsyncStorageKey(vehKey);
  const rawV = await AsyncStorage.getItem(sk);
  let list: any[] = [];
  if (rawV) {
    try {
      const p = JSON.parse(rawV);
      list = Array.isArray(p) ? p : [];
    } catch {
      list = [];
    }
  }
  const nextV = list.filter((v: any) => {
    if (vehicleIdNum != null && Number(v?.id) === vehicleIdNum) return false;
    if (idLocal && (String(v?.id_local) === idLocal || String(v?.id) === idLocal)) return false;
    return true;
  });
  let touched = false;
  if (nextV.length !== list.length) {
    await writeMainStructureFragmentPatch(vehKey, nextV.map(normalizeVehiculoCorporativoForMainStructureCache));
    touched = true;
  }

  const bitKey = `sucursal_${sid}_bitacora_vehiculos_detenidos`;
  const skB = fragmentToAsyncStorageKey(bitKey);
  const rawB = await AsyncStorage.getItem(skB);
  let bits: any[] = [];
  if (rawB) {
    try {
      const p = JSON.parse(rawB);
      bits = Array.isArray(p) ? p : [];
    } catch {
      bits = [];
    }
  }
  const nextB = bits.filter((b: any) => {
    if (vehicleIdNum != null && Number(b?.vehiculo_id) === vehicleIdNum) return false;
    if (idLocal && (String(b?.vehiculo?.id_local) === idLocal || String(b?.vehiculo_id) === idLocal)) return false;
    return true;
  });
  if (nextB.length !== bits.length) {
    await writeMainStructureFragmentPatch(bitKey, nextB);
    touched = true;
  }
  return touched;
}

async function readSucursalVehiclesFragment(sucursalId: number): Promise<any[]> {
  const sid = Number(sucursalId);
  if (!Number.isFinite(sid) || sid <= 0) return [];
  const raw = await AsyncStorage.getItem(fragmentToAsyncStorageKey(`sucursal_${sid}_vehiculos_corporativos`));
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

async function upsertVehicleIntoSucursalVehiclesFragment(params: {
  sucursalId: number;
  normalizedVehicle: any;
  matchLocalKey?: string | null;
}): Promise<boolean> {
  const { sucursalId, normalizedVehicle, matchLocalKey } = params;
  const sid = Number(sucursalId);
  if (!Number.isFinite(sid) || sid <= 0) return false;
  const list = await readSucursalVehiclesFragment(sid);
  const idx = list.findIndex((x: any) => {
    if (
      matchLocalKey &&
      (String(x?.id_local) === String(matchLocalKey) || String(x?.id) === String(matchLocalKey))
    )
      return true;
    const nid = parseCorporateVehicleServerId(normalizedVehicle?.id);
    if (nid != null && Number(x?.id) === Number(nid)) return true;
    return false;
  });
  const next = [...list];
  if (idx >= 0) next[idx] = { ...next[idx], ...normalizedVehicle };
  else next.unshift(normalizedVehicle);
  await writeMainStructureFragmentPatch(
    `sucursal_${sid}_vehiculos_corporativos`,
    next.map(normalizeVehiculoCorporativoForMainStructureCache)
  );
  return true;
}

export function forEachSucursalInTree(
  tree: any[],
  cb: (sucursal: any, meta: { empresa?: any; cliente?: any }) => void
): void {
  for (const empresa of tree || []) {
    for (const cliente of empresa?.clientes || []) {
      const divisiones = cliente?.division || cliente?.divisiones || [];
      for (const division of divisiones) {
        for (const contrato of division?.contratos || []) {
          for (const sucursal of contrato?.sucursales || []) {
            cb(sucursal, { empresa, cliente });
          }
        }
      }
    }
  }
}

export function findSucursalInTree(tree: any[], sucursalId: number): any | null {
  let out: any = null;
  forEachSucursalInTree(tree, (suc) => {
    if (Number(suc?.id) === Number(sucursalId)) out = suc;
  });
  return out;
}

/** Árbol jerárquico + fragmentos de vehículos corporativos (mismo origen que bitácora / Activities). */
export async function loadMainStructureTree(): Promise<any[]> {
  return loadMainStructureTreeMerged();
}

function collectSucursalIdsFromTree(tree: any[]): number[] {
  const ids = new Set<number>();
  forEachSucursalInTree(tree, (suc) => {
    const n = Number(suc?.id);
    if (Number.isFinite(n) && n > 0) ids.add(n);
  });
  return Array.from(ids);
}

export async function saveMainStructureTree(tree: any[], opts?: { sucursalIds?: number[] }): Promise<void> {
  const sids =
    opts?.sucursalIds != null && opts.sucursalIds.length > 0
      ? opts.sucursalIds
      : collectSucursalIdsFromTree(tree);
  await persistMergedMainStructureTree(tree, sids);
}

/**
 * Igual que `mapVehiculoCorporativoSummaryForBitacora` en
 * `apps/server/app/api/dynamic-prisma/main-structure/route.ts`.
 * Opcional `id_local` para borradores móviles no sincronizados.
 */
export function mapVehiculoCorporativoSummaryForBitacora(v: any): any {
  if (!v) return null;
  const base: Record<string, any> = {
    id: v.id,
    empresa_id: v.empresa_id,
    cliente_id: v.cliente_id,
    division_id: v.division_id,
    contrato_id: v.contrato_id,
    sucursal_id: v.sucursal_id,
    puesto_id: v.puesto_id,
    placa: v.placa,
    tipo: v.tipo,
    tipo_autoria: v.tipo_autoria,
    estado: v.estado,
    kilometraje: v.kilometraje,
    prox_cambio_aceite: v.prox_cambio_aceite,
    modelo: v.modelo,
    marca: v.marca,
    anno: v.anno,
    descripcion: v.descripcion,
    titulo_propiedad: v.titulo_propiedad,
    rtv: v.rtv,
    marchamo: v.marchamo,
    firma_responsable: v.firma_responsable,
    created_by: v.created_by,
    created_at: v.created_at,
  };
  if (v.id_local != null && String(v.id_local).trim() !== '') {
    base.id_local = v.id_local;
  }
  return base;
}

/**
 * Forma persistida en `sucursal_{id}_vehiculos_corporativos`: como main-structure (Prisma + `usos` copiado de `c_usos_*`).
 * No persiste el alias `mantenimientos` (solo `c_mantenimiento_vehiculos_corporativos`).
 */
export function normalizeVehiculoCorporativoForMainStructureCache(raw: any): any {
  if (raw == null) return raw;
  const cUsos = Array.isArray(raw.c_usos_vehiculos_corporativos)
    ? raw.c_usos_vehiculos_corporativos
    : Array.isArray(raw.usos)
      ? raw.usos
      : [];
  const cMants = Array.isArray(raw.c_mantenimiento_vehiculos_corporativos)
    ? raw.c_mantenimiento_vehiculos_corporativos
    : Array.isArray(raw.mantenimientos)
      ? raw.mantenimientos
      : [];
  const { usos: _u, mantenimientos: _m, ...rest } = raw;
  return {
    ...rest,
    c_usos_vehiculos_corporativos: cUsos,
    c_mantenimiento_vehiculos_corporativos: cMants,
    usos: cUsos.map((x: any) => ({ ...x })),
  };
}

function usoRowWithoutNestedBitacora(u: any): any {
  if (u == null) return u;
  const o = { ...u };
  delete o.bitacora;
  return o;
}

/** Alinea filas de bitácora al fragmento del servidor: `vehiculo` resumido y `uso` copia del uso (sin bitácora anidada). */
export function enrichBitacoraDetenidoRowsForMainStructureCache(rows: any[], vehicles: any[]): any[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((b) => {
    const vid = b?.vehiculo_id != null ? Number(b.vehiculo_id) : null;
    const vFull =
      vid && Number.isFinite(vid) && vid > 0
        ? vehicles.find((x) => Number(x?.id) === vid)
        : vehicles.find(
            (x) =>
              b?.vehiculo?.id_local != null &&
              String(b.vehiculo.id_local).trim() !== '' &&
              (String(x?.id_local) === String(b.vehiculo.id_local) ||
                String(x?.id) === String(b.vehiculo.id_local))
          );
    const usosArr = vFull ? vFull.c_usos_vehiculos_corporativos || vFull.usos || [] : [];
    const uid = b?.uso_id != null ? Number(b.uso_id) : null;
    let usoRow =
      uid && Number.isFinite(uid) && uid > 0
        ? usosArr.find((u: any) => Number(u?.id) === uid)
        : null;
    if (!usoRow && b?.uso) usoRow = b.uso;
    const usoOut = usoRow != null ? usoRowWithoutNestedBitacora(usoRow) : null;
    const vehOut = vFull
      ? mapVehiculoCorporativoSummaryForBitacora(vFull)
      : b?.vehiculo != null
        ? mapVehiculoCorporativoSummaryForBitacora(b.vehiculo)
        : null;
    return {
      ...b,
      vehiculo: vehOut,
      uso: usoOut,
    };
  });
}

export function findBitacoraRowForUsoInList(
  bitacoras: any[] | undefined,
  vehiculoIdNum: number | null,
  usoIdNum: number | null,
  vehLocal?: string | null,
  usoLocal?: string | null
): any | null {
  if (!Array.isArray(bitacoras)) return null;
  for (const b of bitacoras) {
    const bv = b?.vehiculo_id != null ? Number(b.vehiculo_id) : null;
    const bu = b?.uso_id != null ? Number(b.uso_id) : null;
    if (vehiculoIdNum && usoIdNum && bv === vehiculoIdNum && bu === usoIdNum) return b;
    if (vehLocal && usoLocal) {
      const uv = b?.vehiculo;
      const uu = b?.uso;
      if (
        uv &&
        uu &&
        (String(uv.id_local) === vehLocal || String(uv.id) === vehLocal) &&
        (String(uu.id_local) === usoLocal || String(uu.id) === usoLocal)
      )
        return b;
    }
    if (vehiculoIdNum && usoLocal && bv === vehiculoIdNum) {
      const uu = b?.uso;
      if (uu && (String(uu.id_local) === usoLocal || String(uu.id) === usoLocal)) return b;
    }
  }
  if (usoIdNum) {
    for (const b of bitacoras) {
      if (Number(b?.uso_id) === usoIdNum && (!vehiculoIdNum || Number(b?.vehiculo_id) === vehiculoIdNum))
        return b;
    }
  }
  return null;
}

export function attachBitacorasToVehicleForDisplay(vehicle: any, bitacorasSucursal: any[] | undefined): any {
  const vidNum = typeof vehicle?.id === 'number' && vehicle.id > 0 ? Number(vehicle.id) : null;
  const vehLoc =
    vehicle?.id_local ||
    (typeof vehicle?.id === 'string' && vehicle.id.startsWith('local-') ? vehicle.id : null);
  const usosRaw = vehicle?.usos || vehicle?.c_usos_vehiculos_corporativos || [];
  const next = usosRaw.map((u: any) => {
    const uidNum = typeof u?.id === 'number' && u.id > 0 ? Number(u.id) : null;
    const ulo =
      u?.id_local ||
      (typeof u?.id === 'string' && String(u.id).startsWith('local-') ? String(u.id) : null);
    let row = findBitacoraRowForUsoInList(bitacorasSucursal, vidNum, uidNum, vehLoc, ulo);
    if (!row && u.bitacora_id) {
      row = (bitacorasSucursal || []).find((b: any) => Number(b.id) === Number(u.bitacora_id)) || null;
    }
    let bitacora: any = null;
    if (row) {
      bitacora = { ...row };
      delete bitacora.vehiculo;
      delete bitacora.uso;
    } else if ((u as any).bitacora) {
      bitacora = (u as any).bitacora;
    }
    return { ...u, bitacora };
  });
  return { ...vehicle, usos: next, c_usos_vehiculos_corporativos: next };
}

export async function readCorporateVehiclesForSucursalFromMainStructure(sucursalId: number): Promise<any[]> {
  const tree = await loadMainStructureTree();
  const suc = findSucursalInTree(tree, sucursalId);
  if (!suc) return [];
  const key = mainStructureCorporateVehiculosKey(suc);
  if (!Array.isArray(suc[key])) return [];
  const bits = Array.isArray(suc.bitacoras_vehiculos_detenidos) ? suc.bitacoras_vehiculos_detenidos : [];
  return suc[key]
    .filter((v: any) => v?.isActive !== false)
    .map((v: any) => {
    const att = attachBitacorasToVehicleForDisplay(v, bits);
    return {
      ...att,
      corpo_id: sucursalId,
      type: 'corporate_vehicle',
      synced: !isCorporateVehicleLocalDraft(v),
    };
    });
}

/**
 * Lista directamente desde el fragmento AsyncStorage `sucursal_{id}_vehiculos_corporativos`
 * (jerarquía por fragmentos), sin depender del árbol mergeado en memoria.
 * Útil offline cuando el árbol `empresas` aún no está hidratado.
 */
export async function readCorporateVehiclesForSucursalFromFragmentStorage(sucursalId: number): Promise<any[]> {
  const sid = Number(sucursalId);
  if (!Number.isFinite(sid) || sid <= 0) return [];
  const sk = fragmentToAsyncStorageKey(`sucursal_${sid}_vehiculos_corporativos`);
  const raw = await AsyncStorage.getItem(sk);
  let vehicles: any[] = [];
  if (raw) {
    try {
      const p = JSON.parse(raw);
      vehicles = Array.isArray(p) ? p : [];
    } catch {
      vehicles = [];
    }
  }
  const bits = await readBitacorasFragmentArray(sid);
  return vehicles
    .filter((v: any) => v?.isActive !== false)
    .map((v: any) => {
    const att = attachBitacorasToVehicleForDisplay(v, bits);
    return {
      ...att,
      corpo_id: sid,
      type: 'corporate_vehicle',
      synced: !isCorporateVehicleLocalDraft(v),
    };
    });
}

export function buildBitacorasFromVehiclesList(vehicles: any[]): any[] {
  const out: any[] = [];
  for (const v of vehicles || []) {
    const vid = typeof v.id === 'number' && v.id > 0 ? Number(v.id) : null;
    const usos = v.usos || v.c_usos_vehiculos_corporativos || [];
    for (const u of usos) {
      const bit = (u as any).bitacora;
      if (!bit || bit.id == null) continue;
      const uid = typeof u.id === 'number' && u.id > 0 ? Number(u.id) : null;
      out.push({
        ...bit,
        vehiculo_id: vid ?? bit.vehiculo_id,
        uso_id: uid ?? bit.uso_id,
        empresa_id: bit.empresa_id ?? v.empresa_id,
        cliente_id: bit.cliente_id ?? v.cliente_id,
        sucursal_id: bit.sucursal_id ?? v.sucursal_id ?? v.corpo_id,
        vehiculo: mapVehiculoCorporativoSummaryForBitacora(v),
        uso: usoRowWithoutNestedBitacora(u),
      });
    }
  }
  const map = new Map<number, any>();
  for (const x of out) {
    const id = Number(x.id);
    if (Number.isFinite(id)) map.set(id, x);
  }
  return Array.from(map.values());
}

export function pruneOrphanBitacorasOnSucursal(suc: any, vehicles: any[]): void {
  const vids = new Set<number>();
  const usoByVeh = new Map<number, Set<number>>();
  for (const v of vehicles) {
    const vid = typeof v.id === 'number' ? Number(v.id) : null;
    if (!vid || !Number.isFinite(vid)) continue;
    vids.add(vid);
    const us = new Set<number>();
    for (const u of v.usos || v.c_usos_vehiculos_corporativos || []) {
      const uid = typeof u.id === 'number' ? Number(u.id) : null;
      if (uid && Number.isFinite(uid)) us.add(uid);
    }
    usoByVeh.set(vid, us);
  }
  const bits = Array.isArray(suc.bitacoras_vehiculos_detenidos) ? suc.bitacoras_vehiculos_detenidos : [];
  suc.bitacoras_vehiculos_detenidos = bits.filter((b: any) => {
    const bv = b?.vehiculo_id != null ? Number(b.vehiculo_id) : null;
    if (!bv || !vids.has(bv)) return false;
    const bu = b?.uso_id != null ? Number(b.uso_id) : null;
    if (bu) {
      const set = usoByVeh.get(bv);
      if (!set || !set.has(bu)) return false;
    }
    return true;
  });
}

export function recomputeBitacorasForSucursalNode(suc: any, mergedVehicles: any[]): void {
  if (!Array.isArray(suc.bitacoras_vehiculos_detenidos)) suc.bitacoras_vehiculos_detenidos = [];
  const rebuilt = buildBitacorasFromVehiclesList(mergedVehicles);
  const localVehKeys = new Set(
    mergedVehicles.filter(isCorporateVehicleLocalDraft).map((v) => String(v.id_local || v.id))
  );
  const keep = suc.bitacoras_vehiculos_detenidos.filter((b: any) => {
    const veh = mergedVehicles.find(
      (x) =>
        (Number(b.vehiculo_id) > 0 && Number(x.id) === Number(b.vehiculo_id)) ||
        localVehKeys.has(String(x.id_local)) ||
        localVehKeys.has(String(x.id))
    );
    return veh && isCorporateVehicleLocalDraft(veh);
  });
  const byId = new Map<number, any>();
  for (const b of [...rebuilt, ...keep]) {
    const id = Number(b?.id);
    if (Number.isFinite(id)) byId.set(id, b);
  }
  suc.bitacoras_vehiculos_detenidos = Array.from(byId.values()).sort((a, b) => Number(b.id) - Number(a.id));
  pruneOrphanBitacorasOnSucursal(suc, mergedVehicles);
  suc.bitacoras_vehiculos_detenidos = enrichBitacoraDetenidoRowsForMainStructureCache(
    suc.bitacoras_vehiculos_detenidos,
    mergedVehicles
  );
}

export async function mergeCorporateVehiclesForSucursalFromServer(params: {
  sucursalId: number;
  serverVehicles: any[];
}): Promise<void> {
  const { sucursalId, serverVehicles } = params;
  const activeServerVehicles = (Array.isArray(serverVehicles) ? serverVehicles : []).filter(
    (v: any) => v?.isActive !== false
  );
  const tree = await loadMainStructureTree();
  if (!Array.isArray(tree) || tree.length === 0) return;

  const serverIds = new Set(
    activeServerVehicles.map((v) => Number(v.id)).filter((n) => Number.isFinite(n) && n > 0)
  );

  let changed = false;
  forEachSucursalInTree(tree, (suc) => {
    if (Number(suc?.id) !== Number(sucursalId)) return;
    const vk = mainStructureCorporateVehiculosKey(suc);
    const current: any[] = Array.isArray(suc[vk]) ? suc[vk] : [];

    const localOnly = current.filter(
      (v) =>
        isCorporateVehicleLocalDraft(v) &&
        !(typeof v.id === 'number' && serverIds.has(Number(v.id)))
    );

    const merged: any[] = [];

    for (const sv of activeServerVehicles) {
      const sid = Number(sv.id);
      const existing = current.find((x) => Number(x?.id) === sid);

      let usos = [...(sv.usos || sv.c_usos_vehiculos_corporativos || [])];
      let mants = [...(sv.mantenimientos || sv.c_mantenimiento_vehiculos_corporativos || [])];

      if (existing) {
        const curUsos = existing.usos || existing.c_usos_vehiculos_corporativos || [];
        const serverUsoIds = new Set(
          usos
            .map((u: any) => (typeof u?.id === 'number' ? u.id : null))
            .filter((x: any) => x != null)
        );
        const localU = curUsos.filter((u: any) => {
          const loc =
            (typeof u?.id_local === 'string' && u.id_local.startsWith('local-')) ||
            (typeof u?.id === 'string' && u.id.startsWith('local-')) ||
            u?.synced === false;
          if (!loc) return false;
          const n = typeof u?.id === 'number' ? u.id : null;
          if (n != null && serverUsoIds.has(n)) return false;
          return true;
        });
        usos = [...usos, ...localU];

        const curM = existing.mantenimientos || existing.c_mantenimiento_vehiculos_corporativos || [];
        const serverMIds = new Set(
          mants
            .map((m: any) => (typeof m?.id === 'number' ? m.id : null))
            .filter((x: any) => x != null)
        );
        const localM = curM.filter((m: any) => {
          const loc =
            (typeof m?.id_local === 'string' && m.id_local.startsWith('local-')) ||
            (typeof m?.id === 'string' && m.id.startsWith('local-')) ||
            m?.synced === false;
          if (!loc) return false;
          const n = typeof m?.id === 'number' ? m.id : null;
          if (n != null && serverMIds.has(n)) return false;
          return true;
        });
        mants = [...mants, ...localM];
      }

      merged.push(
        normalizeVehiculoCorporativoForMainStructureCache({
          ...sv,
          sucursal_id: sucursalId,
          corpo_id: sucursalId,
          usos,
          c_usos_vehiculos_corporativos: usos,
          c_mantenimiento_vehiculos_corporativos: mants,
        })
      );
    }

    for (const loc of localOnly) {
      merged.push(normalizeVehiculoCorporativoForMainStructureCache(loc));
    }

    suc[vk] = merged;
    recomputeBitacorasForSucursalNode(suc, merged);
    changed = true;
  });

  if (changed) await saveMainStructureTree(tree, { sucursalIds: [sucursalId] });
}

export async function resolveCorporateVehicleServerIdFromMainStructure(localKey: string): Promise<number | null> {
  const tree = await loadMainStructureTree();
  for (const empresa of tree) {
    for (const cliente of empresa?.clientes || []) {
      const divisiones = cliente?.division || cliente?.divisiones || [];
      for (const division of divisiones) {
        for (const contrato of division?.contratos || []) {
          for (const sucursal of contrato?.sucursales || []) {
            const vk = mainStructureCorporateVehiculosKey(sucursal);
            const vehs = sucursal[vk] || [];
            for (const v of vehs) {
              if (
                (String(v?.id_local) === String(localKey) || String(v?.id) === String(localKey)) &&
                typeof v.id === 'number' &&
                v.id > 0
              ) {
                return v.id;
              }
            }
          }
        }
      }
    }
  }
  return null;
}

export async function resolveCorporateUsoServerIdFromMainStructure(
  vehiculoServerId: number,
  usoLocalKey: string
): Promise<number | null> {
  const tree = await loadMainStructureTree();
  for (const empresa of tree) {
    for (const cliente of empresa?.clientes || []) {
      const divisiones = cliente?.division || cliente?.divisiones || [];
      for (const division of divisiones) {
        for (const contrato of division?.contratos || []) {
          for (const sucursal of contrato?.sucursales || []) {
            const vk = mainStructureCorporateVehiculosKey(sucursal);
            const vehs = sucursal[vk] || [];
            for (const v of vehs) {
              if (Number(v?.id) !== vehiculoServerId) continue;
              const usos = v.usos || v.c_usos_vehiculos_corporativos || [];
              const u = usos.find(
                (x: any) => String(x.id_local) === String(usoLocalKey) || String(x.id) === String(usoLocalKey)
              );
              if (u && typeof u.id === 'number' && u.id > 0) return u.id;
            }
          }
        }
      }
    }
  }
  return null;
}

export async function removeCorporateVehicleFromMainStructureEverywhere(params: {
  vehicleId?: number | string;
  idLocal?: string | null;
  /** Si el árbol no contiene la sucursal o el vehículo, actualiza fragmentos `sucursal_*` en AsyncStorage. */
  sucursalIdHint?: number | null;
}): Promise<void> {
  const idLocal = params.idLocal != null && String(params.idLocal).trim() !== '' ? String(params.idLocal) : undefined;
  const vehicleId =
    params.vehicleId != null && params.vehicleId !== ''
      ? parseCorporateVehicleServerId(params.vehicleId)
      : undefined;

  const tree = await loadMainStructureTree();
  let changed = false;
  forEachSucursalInTree(tree, (suc) => {
    const vk = mainStructureCorporateVehiculosKey(suc);
    const list = Array.isArray(suc[vk]) ? suc[vk] : [];
    const next = list.filter((v: any) => {
      if (vehicleId != null && Number(v.id) === vehicleId) return false;
      if (idLocal && (String(v.id_local) === idLocal || String(v.id) === idLocal)) return false;
      return true;
    });
    const bits = Array.isArray(suc.bitacoras_vehiculos_detenidos) ? suc.bitacoras_vehiculos_detenidos : [];
    const b2 = bits.filter((b: any) => {
      if (vehicleId != null && Number(b.vehiculo_id) === vehicleId) return false;
      if (idLocal && String(b?.vehiculo?.id_local) === idLocal) return false;
      return true;
    });
    if (next.length !== list.length || b2.length !== bits.length) {
      const nextNorm = next.map(normalizeVehiculoCorporativoForMainStructureCache);
      suc[vk] = nextNorm;
      suc.bitacoras_vehiculos_detenidos = b2;
      recomputeBitacorasForSucursalNode(suc, nextNorm);
      changed = true;
    }
  });
  if (changed) await saveMainStructureTree(tree);

  const sidHint = params.sucursalIdHint != null ? Number(params.sucursalIdHint) : NaN;
  if (
    !changed &&
    Number.isFinite(sidHint) &&
    sidHint > 0 &&
    (vehicleId != null || idLocal)
  ) {
    await removeVehicleFromSucursalVehicleAndBitacoraFragments(sidHint, vehicleId, idLocal);
  }
}

function patchBitacorasLocationForVehicleOnSucursal(
  suc: any,
  vehiculoId: number,
  empresa_id: number,
  cliente_id: number,
  sucursal_id: number
): void {
  if (!Array.isArray(suc.bitacoras_vehiculos_detenidos)) return;
  suc.bitacoras_vehiculos_detenidos = suc.bitacoras_vehiculos_detenidos.map((b: any) => {
    if (Number(b?.vehiculo_id) !== vehiculoId) return b;
    return {
      ...b,
      empresa_id,
      cliente_id,
      sucursal_id,
    };
  });
}

/** Usos del vehículo: ids numéricos y claves locales (para enlazar filas de bitácora por uso). */
function collectUsoLookupFromVehicle(vehicle: any): { numeric: Set<number>; locals: Set<string> } {
  const numeric = new Set<number>();
  const locals = new Set<string>();
  const usos = vehicle?.usos || vehicle?.c_usos_vehiculos_corporativos || [];
  for (const u of usos || []) {
    if (typeof u?.id === 'number' && Number.isFinite(u.id) && u.id > 0) numeric.add(Number(u.id));
    if (u?.id_local != null && String(u.id_local).trim() !== '') locals.add(String(u.id_local));
    if (typeof u?.id === 'string' && String(u.id).startsWith('local-')) locals.add(String(u.id));
  }
  return { numeric, locals };
}

/** Fila de bitácora vinculada a este vehículo (por vehiculo_id, objeto vehículo embebido o uso/uso_id). */
function bitacoraRowBelongsToCorporateVehicle(
  b: any,
  vehicle: any,
  matchLocalKey: string | null | undefined
): boolean {
  const vid = typeof vehicle?.id === 'number' && vehicle.id > 0 ? Number(vehicle.id) : null;
  if (vid != null && Number(b?.vehiculo_id) === vid) return true;
  if (matchLocalKey) {
    const k = String(matchLocalKey);
    if (String(b?.vehiculo?.id_local) === k || String(b?.vehiculo?.id) === k) return true;
    if (String(b?.vehiculo_id) === k) return true;
  }
  const { numeric, locals } = collectUsoLookupFromVehicle(vehicle);
  const usoIdNum = b?.uso_id != null ? Number(b.uso_id) : NaN;
  if (Number.isFinite(usoIdNum) && usoIdNum > 0 && numeric.has(usoIdNum)) return true;
  const ulo =
    b?.uso_id_local != null && String(b.uso_id_local).trim() !== ''
      ? String(b.uso_id_local)
      : b?.uso?.id_local != null && String(b.uso.id_local).trim() !== ''
        ? String(b.uso.id_local)
        : null;
  if (ulo && locals.has(ulo)) return true;
  const usoIdStr = b?.uso?.id != null ? String(b.uso.id) : '';
  if (usoIdStr && locals.has(usoIdStr)) return true;
  return false;
}

export async function moveCorporateVehicleInMainStructure(params: {
  vehicle: any;
  oldCorpoId: number;
  newCorpoId: number;
  matchLocalKey?: string | null;
}): Promise<void> {
  const { vehicle, oldCorpoId, newCorpoId, matchLocalKey } = params;
  if (Number(oldCorpoId) === Number(newCorpoId)) {
    await upsertCorporateVehicleInMainStructure(vehicle, matchLocalKey ?? null);
    return;
  }
  const tree = await loadMainStructureTree();
  let changed = false;
  const usos = vehicle.usos || vehicle.c_usos_vehiculos_corporativos || [];
  const mants = vehicle.mantenimientos || vehicle.c_mantenimiento_vehiculos_corporativos || [];
  const eid = Number(vehicle.empresa_id ?? 0);
  const cid = Number(vehicle.cliente_id ?? 0);
  const normalized = {
    ...vehicle,
    corpo_id: newCorpoId,
    sucursal_id: newCorpoId,
    empresa_id: eid,
    cliente_id: cid,
    usos,
    c_usos_vehiculos_corporativos: usos,
    mantenimientos: mants,
    c_mantenimiento_vehiculos_corporativos: mants,
  };

  const bitacorasToMigrate: any[] = [];

  forEachSucursalInTree(tree, (suc) => {
    if (Number(suc.id) !== Number(oldCorpoId)) return;
    const vk = mainStructureCorporateVehiculosKey(suc);
    const list = Array.isArray(suc[vk]) ? suc[vk] : [];
    const next = list.filter(
      (v: any) =>
        !(
          (matchLocalKey &&
            (String(v.id_local) === matchLocalKey || String(v.id) === matchLocalKey)) ||
          (typeof vehicle.id === 'number' && vehicle.id > 0 && Number(v.id) === Number(vehicle.id))
        )
    );
    if (next.length !== list.length) {
      suc[vk] = next;
      changed = true;
    }
    const bits = Array.isArray(suc.bitacoras_vehiculos_detenidos) ? suc.bitacoras_vehiculos_detenidos : [];
    const stay: any[] = [];
    for (const b of bits) {
      if (bitacoraRowBelongsToCorporateVehicle(b, vehicle, matchLocalKey ?? null)) {
        bitacorasToMigrate.push({
          ...b,
          empresa_id: eid,
          cliente_id: cid,
          sucursal_id: newCorpoId,
        });
      } else stay.push(b);
    }
    if (stay.length !== bits.length) {
      suc.bitacoras_vehiculos_detenidos = stay;
      changed = true;
    }
    recomputeBitacorasForSucursalNode(suc, next);
  });

  forEachSucursalInTree(tree, (suc) => {
    if (Number(suc.id) !== Number(newCorpoId)) return;
    const vk = mainStructureCorporateVehiculosKey(suc);
    if (!Array.isArray(suc[vk])) suc[vk] = [];
    if (!Array.isArray(suc.bitacoras_vehiculos_detenidos)) suc.bitacoras_vehiculos_detenidos = [];
    const list = [...suc[vk]];
    const idx = list.findIndex(
      (x: any) =>
        (matchLocalKey && (String(x.id_local) === matchLocalKey || String(x.id) === matchLocalKey)) ||
        (typeof normalized.id === 'number' && normalized.id > 0 && Number(x.id) === Number(normalized.id))
    );
    if (idx >= 0) list[idx] = { ...list[idx], ...normalized };
    else list.unshift(normalized);
    suc[vk] = list;
    const mergedBits = [...suc.bitacoras_vehiculos_detenidos, ...bitacorasToMigrate];
    const byId = new Map<number, any>();
    for (const b of mergedBits) {
      const id = Number(b?.id);
      if (Number.isFinite(id)) byId.set(id, b);
    }
    suc.bitacoras_vehiculos_detenidos = Array.from(byId.values());
    const vid = typeof vehicle.id === 'number' ? vehicle.id : 0;
    if (vid) patchBitacorasLocationForVehicleOnSucursal(suc, vid, eid, cid, newCorpoId);
    recomputeBitacorasForSucursalNode(suc, list);
    changed = true;
  });

  if (changed) await saveMainStructureTree(tree, { sucursalIds: [Number(oldCorpoId), Number(newCorpoId)] });
}

export async function upsertCorporateVehicleInMainStructure(
  vehicle: any,
  matchLocalKey?: string | null
): Promise<void> {
  const corpoId = Number(vehicle.corpo_id ?? vehicle.sucursal_id ?? 0);
  if (!corpoId) return;
  const tree = await loadMainStructureTree();
  let changed = false;
  forEachSucursalInTree(tree, (suc) => {
    if (Number(suc.id) !== corpoId) return;
    const vk = mainStructureCorporateVehiculosKey(suc);
    if (!Array.isArray(suc[vk])) suc[vk] = [];
    if (!Array.isArray(suc.bitacoras_vehiculos_detenidos)) suc.bitacoras_vehiculos_detenidos = [];
    const list = [...suc[vk]];
    const usos = vehicle.usos || vehicle.c_usos_vehiculos_corporativos || [];
    const mants = vehicle.mantenimientos || vehicle.c_mantenimiento_vehiculos_corporativos || [];
    const normalized = normalizeVehiculoCorporativoForMainStructureCache({
      ...vehicle,
      sucursal_id: corpoId,
      corpo_id: corpoId,
      usos,
      c_usos_vehiculos_corporativos: usos,
      c_mantenimiento_vehiculos_corporativos: mants,
    });
    const idx = list.findIndex(
      (x: any) =>
        (matchLocalKey && (String(x.id_local) === matchLocalKey || String(x.id) === matchLocalKey)) ||
        (typeof vehicle.id === 'number' &&
          vehicle.id > 0 &&
          Number(x.id) === Number(vehicle.id))
    );
    if (idx >= 0) list[idx] = { ...list[idx], ...normalized };
    else list.unshift(normalized);
    suc[vk] = list;
    const vid = typeof vehicle.id === 'number' ? vehicle.id : 0;
    if (vid) {
      patchBitacorasLocationForVehicleOnSucursal(
        suc,
        vid,
        Number(vehicle.empresa_id ?? 0),
        Number(vehicle.cliente_id ?? 0),
        corpoId
      );
    }
    recomputeBitacorasForSucursalNode(suc, list);
    changed = true;
  });
  if (changed) {
    await saveMainStructureTree(tree, { sucursalIds: [corpoId] });
    return;
  }
  const usos = vehicle.usos || vehicle.c_usos_vehiculos_corporativos || [];
  const mants = vehicle.mantenimientos || vehicle.c_mantenimiento_vehiculos_corporativos || [];
  const normalized = normalizeVehiculoCorporativoForMainStructureCache({
    ...vehicle,
    sucursal_id: corpoId,
    corpo_id: corpoId,
    usos,
    c_usos_vehiculos_corporativos: usos,
    c_mantenimiento_vehiculos_corporativos: mants,
  });
  await upsertVehicleIntoSucursalVehiclesFragment({
    sucursalId: corpoId,
    normalizedVehicle: normalized,
    matchLocalKey: matchLocalKey ?? null,
  });
}

export async function updateVehicleUsosInMainStructureBranch(
  sucursalId: number,
  vehicleKey: string,
  usos: any[]
): Promise<void> {
  const tree = await loadMainStructureTree();
  let changed = false;
  forEachSucursalInTree(tree, (suc) => {
    if (Number(suc.id) !== Number(sucursalId)) return;
    const vk = mainStructureCorporateVehiculosKey(suc);
    const list = Array.isArray(suc[vk]) ? [...suc[vk]] : [];
    const idx = list.findIndex(
      (v: any) => String(v.id) === vehicleKey || String(v.id_local) === vehicleKey
    );
    if (idx < 0) return;
    list[idx] = normalizeVehiculoCorporativoForMainStructureCache({
      ...list[idx],
      usos,
      c_usos_vehiculos_corporativos: usos,
    });
    suc[vk] = list;
    recomputeBitacorasForSucursalNode(suc, list);
    changed = true;
  });
  if (changed) {
    await saveMainStructureTree(tree, { sucursalIds: [Number(sucursalId)] });
    return;
  }
  const list = await readSucursalVehiclesFragment(Number(sucursalId));
  const idx = list.findIndex(
    (v: any) => String(v.id) === vehicleKey || String(v.id_local) === vehicleKey
  );
  if (idx < 0) return;
  const next = [...list];
  next[idx] = normalizeVehiculoCorporativoForMainStructureCache({
    ...next[idx],
    usos,
    c_usos_vehiculos_corporativos: usos,
  });
  await writeMainStructureFragmentPatch(`sucursal_${Number(sucursalId)}_vehiculos_corporativos`, next);
}

export async function updateVehicleMantenimientosInMainStructureBranch(
  sucursalId: number,
  vehicleKey: string,
  mantenimientos: any[]
): Promise<void> {
  const tree = await loadMainStructureTree();
  let changed = false;
  forEachSucursalInTree(tree, (suc) => {
    if (Number(suc.id) !== Number(sucursalId)) return;
    const vk = mainStructureCorporateVehiculosKey(suc);
    const list = Array.isArray(suc[vk]) ? [...suc[vk]] : [];
    const idx = list.findIndex(
      (v: any) => String(v.id) === vehicleKey || String(v.id_local) === vehicleKey
    );
    if (idx < 0) return;
    list[idx] = normalizeVehiculoCorporativoForMainStructureCache({
      ...list[idx],
      c_mantenimiento_vehiculos_corporativos: mantenimientos,
    });
    suc[vk] = list;
    changed = true;
  });
  if (changed) {
    await saveMainStructureTree(tree, { sucursalIds: [Number(sucursalId)] });
    return;
  }
  const list = await readSucursalVehiclesFragment(Number(sucursalId));
  const idx = list.findIndex(
    (v: any) => String(v.id) === vehicleKey || String(v.id_local) === vehicleKey
  );
  if (idx < 0) return;
  const next = [...list];
  next[idx] = normalizeVehiculoCorporativoForMainStructureCache({
    ...next[idx],
    c_mantenimiento_vehiculos_corporativos: mantenimientos,
  });
  await writeMainStructureFragmentPatch(`sucursal_${Number(sucursalId)}_vehiculos_corporativos`, next);
}

export async function resolveSucursalIdForVehiculoFromMainStructure(vehiculoId: number): Promise<number | null> {
  const tree = await loadMainStructureTree();
  for (const empresa of tree) {
    for (const cliente of empresa?.clientes || []) {
      const divisiones = cliente?.division || cliente?.divisiones || [];
      for (const division of divisiones) {
        for (const contrato of division?.contratos || []) {
          for (const sucursal of contrato?.sucursales || []) {
            const vk = mainStructureCorporateVehiculosKey(sucursal);
            const vehs = sucursal[vk] || [];
            if (vehs.some((v: any) => Number(v?.id) === Number(vehiculoId))) {
              return Number(sucursal.id);
            }
          }
        }
      }
    }
  }
  return null;
}

export async function findSucursalIdForVehicleKeyInMainStructure(vehicleKey: string): Promise<number | null> {
  const tree = await loadMainStructureTree();
  for (const empresa of tree) {
    for (const cliente of empresa?.clientes || []) {
      const divisiones = cliente?.division || cliente?.divisiones || [];
      for (const division of divisiones) {
        for (const contrato of division?.contratos || []) {
          for (const sucursal of contrato?.sucursales || []) {
            const vk = mainStructureCorporateVehiculosKey(sucursal);
            const vehs = sucursal[vk] || [];
            const hit = vehs.some(
              (v: any) => String(v.id) === vehicleKey || String(v.id_local) === vehicleKey
            );
            if (hit) return Number(sucursal.id);
          }
        }
      }
    }
  }
  return null;
}
