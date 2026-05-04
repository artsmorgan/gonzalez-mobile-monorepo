import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  findCorporateVehicleServerIdByLocalKey,
  findCorpoIdForVehicleServerIdInCorpoCache,
  findServerMantenimientoIdInCorpoCache,
  findServerUsoIdInCorpoCache,
  refreshCorpoCacheVehicleRowFromMainStructure,
  removeVehicleFromCorpoCache,
  setBitacoraIdOnVehicleUseInCorpoCache,
} from './corporateVehiclesCorpoCache';
import {
  clearBitacoraFromMainStructureByBitacoraRef,
  removeBitacoraDetenidoRowFromMainStructure,
  setBitacoraOnUsoInMainStructureCache,
} from './bitacoraMainStructureCache';
import {
  loadMainStructureTree,
  forEachSucursalInTree,
  resolveCorporateVehicleServerIdFromMainStructure,
  resolveCorporateUsoServerIdFromMainStructure,
  removeCorporateVehicleFromMainStructureEverywhere,
  moveCorporateVehicleInMainStructure,
  resolveSucursalIdForVehiculoFromMainStructure,
  saveMainStructureTree,
  normalizeVehiculoCorporativoForMainStructureCache,
  recomputeBitacorasForSucursalNode,
  parseCorporateVehicleServerId,
} from './corporateVehiclesMainStructure';
import type {
  CorporateVehicleMaintenanceRequest,
  CorporateVehicleUseRequest,
} from './evaluationFunctions';

/** Igual que `CreateCorporateVehicleParams['requestData']` en evaluationFunctions (payload tras hidratar imágenes). */
type CorporateVehicleRequestBody = {
  cliente_id: number;
  corpo_id: number;
  placa?: string;
  tipo?: string;
  kilometraje?: number;
  prox_cambio_aceite?: number;
  modelo?: string;
  anno?: number;
  descripcion?: string;
  titulo_propiedad?: boolean;
  rtv?: boolean;
  marchamo?: boolean;
  firma_responsable?: string;
  imagenes?: Array<{ extension: string; file_base64: string }>;
};

export const CORPORATE_EVALUATION_TYPES = new Set<string>([
  'corporate_vehicle',
  'corporate_vehicle_use',
  'corporate_vehicle_maintenance',
]);

/** Creación offline de bitácora de revisión de vehículos; se envía tras sincronizar vehículo/uso corporativo. */
export const BITACORA_VEHICULO_DETENIDO_EVAL_TYPE = 'bitacora_vehiculo_detenido';

function sortCorporateEvaluationActions(actions: any[]): any[] {
  const typeRankCreate = (t: string) =>
    t === 'corporate_vehicle' ? 0 : t === 'corporate_vehicle_use' ? 1 : t === 'corporate_vehicle_maintenance' ? 2 : 9;
  const typeRankDelete = (t: string) =>
    t === 'corporate_vehicle_use' ? 0 : t === 'corporate_vehicle_maintenance' ? 1 : t === 'corporate_vehicle' ? 2 : 9;
  const actionRank = (a: any) => {
    if (a?.action === 'create') return 0;
    if (a?.type === 'corporate_vehicle' && a?.action === 'delete_image') return 0.5;
    if (a?.type === 'corporate_vehicle_maintenance' && a?.action === 'delete_image') return 0.5;
    if (a?.action === 'update') return 1;
    if (a?.action === 'delete') return 2;
    return 3;
  };
  return [...actions].sort((a, b) => {
    const ar = actionRank(a);
    const br = actionRank(b);
    if (ar !== br) return ar - br;
    if (a.action === 'delete') return typeRankDelete(a.type) - typeRankDelete(b.type);
    return typeRankCreate(a.type) - typeRankCreate(b.type);
  });
}

function mainStructureVehiculosKey(sucursal: any): string {
  if (Array.isArray(sucursal?.vehiculos_corporativos)) return 'vehiculos_corporativos';
  if (Array.isArray(sucursal?.c_vehiculos_corporativos)) return 'c_vehiculos_corporativos';
  return 'vehiculos_corporativos';
}

function isServerEntityId(value: unknown): boolean {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

function extractLocalEntityKey(raw: unknown, localField?: unknown): string {
  if (localField != null && String(localField).trim() !== '') return String(localField).trim();
  if (raw == null) return '';
  const s = String(raw).trim();
  if (!s || isServerEntityId(s)) return '';
  return s;
}

export async function patchPendingCorporateChildrenVehiculoId(vehicleLocalKey: string, serverVehiculoId: number) {
  const raw = await AsyncStorage.getItem('evaluations_actions');
  if (!raw) return;
  const list = JSON.parse(raw);
  const next = list.map((a: any) => {
    if (a.action !== 'create') return a;
    if (a.type !== 'corporate_vehicle_use' && a.type !== 'corporate_vehicle_maintenance') return a;
    const p = { ...(a.payload || {}) };
    const link = extractLocalEntityKey(p.vehiculo_id, p.vehiculo_id_local);
    if (link && String(link) === String(vehicleLocalKey)) {
      return { ...a, payload: { ...p, vehiculo_id: serverVehiculoId } };
    }
    return a;
  });
  await AsyncStorage.setItem('evaluations_actions', JSON.stringify(next));
}

/** Cuando el vehículo corporativo recibe id de servidor, las bitácoras pendientes deben dejar de usar vehiculo_id_local (el caché evaluations ya no enlaza por id_local). */
export async function patchPendingBitacoraAfterVehicleVehiculoSync(vehicleLocalKey: string, serverVehiculoId: number) {
  const raw = await AsyncStorage.getItem('evaluations_actions');
  if (!raw) return;
  const list = JSON.parse(raw);
  const next = list.map((a: any) => {
    if (a.action !== 'create' || a.type !== BITACORA_VEHICULO_DETENIDO_EVAL_TYPE) return a;
    const p = { ...(a.payload || {}) };
    const keyStr = extractLocalEntityKey(p.vehiculo_id, p.vehiculo_id_local);
    if (!keyStr || String(keyStr) !== String(vehicleLocalKey)) return a;
    const nextPayload = { ...p, vehiculo_id: serverVehiculoId };
    delete nextPayload.vehiculo_id_local;
    return { ...a, payload: nextPayload };
  });
  await AsyncStorage.setItem('evaluations_actions', JSON.stringify(next));
}

/** Cuando el uso corporativo recibe id de servidor, actualizar la cola de bitácora (mismo motivo que el vehículo). */
export async function patchPendingBitacoraAfterUsoSync(usoLocalKey: string, serverUsoId: number, vehiculoServerId: number) {
  const raw = await AsyncStorage.getItem('evaluations_actions');
  if (!raw) return;
  const list = JSON.parse(raw);
  const next = list.map((a: any) => {
    if (a.action !== 'create' || a.type !== BITACORA_VEHICULO_DETENIDO_EVAL_TYPE) return a;
    const p = { ...(a.payload || {}) };
    const keyStr = extractLocalEntityKey(p.uso_id, p.uso_id_local);
    if (!keyStr || String(keyStr) !== String(usoLocalKey)) return a;
    const nextPayload = { ...p, uso_id: serverUsoId, vehiculo_id: vehiculoServerId };
    delete nextPayload.uso_id_local;
    delete nextPayload.vehiculo_id_local;
    return { ...a, payload: nextPayload };
  });
  await AsyncStorage.setItem('evaluations_actions', JSON.stringify(next));
}

function findSucursalIdForVehiculoInMainStructure(tree: any[], vehiculoId: number): number | null {
  for (const empresa of tree) {
    for (const cliente of empresa?.clientes || []) {
      const divisiones = cliente?.division || cliente?.divisiones || [];
      for (const division of divisiones) {
        for (const contrato of division?.contratos || []) {
          for (const sucursal of contrato?.sucursales || []) {
            const key = mainStructureVehiculosKey(sucursal);
            const vehiculos = Array.isArray(sucursal[key]) ? sucursal[key] : [];
            if (vehiculos.some((v: any) => Number(v?.id) === Number(vehiculoId))) {
              return Number(sucursal?.id);
            }
          }
        }
      }
    }
  }
  return null;
}

async function resolveSucursalIdForVehiculo(vehiculoId: number): Promise<number | null> {
  const tree = await loadMainStructureTree();
  if (Array.isArray(tree) && tree.length > 0) {
    const sid = findSucursalIdForVehiculoInMainStructure(tree, vehiculoId);
    if (sid) return sid;
  }
  const fromCorpo = await findCorpoIdForVehicleServerIdInCorpoCache(vehiculoId);
  if (fromCorpo) return fromCorpo;
  const cacheStr = await AsyncStorage.getItem('evaluations_cache');
  if (!cacheStr) return null;
  const cache = JSON.parse(cacheStr);
  const found = cache.find(
    (item: any) => item.type === 'corporate_vehicle' && Number(item.id) === Number(vehiculoId)
  );
  if (found?.corpo_id != null) return Number(found.corpo_id);
  return null;
}

async function saveMainStructureIfChanged(tree: any[], changed: boolean, sucursalIds?: number[]) {
  if (!changed) return;
  await saveMainStructureTree(tree, sucursalIds?.length ? { sucursalIds } : undefined);
}

/** Prioriza datos base del vehículo; conserva usos/mantenimientos salvo que vengan en layer. */
async function upsertMainStructureVehicle(
  sucursalId: number,
  vehiculoServerId: number,
  vehicleLayer: Record<string, any>,
  matchLocalId?: string | null
) {
  const tree = await loadMainStructureTree();
  if (!Array.isArray(tree)) return;
  let changed = false;

  for (const empresa of tree) {
    for (const cliente of empresa?.clientes || []) {
      const divisiones = cliente?.division || cliente?.divisiones || [];
      for (const division of divisiones) {
        for (const contrato of division?.contratos || []) {
          for (const sucursal of contrato?.sucursales || []) {
            if (Number(sucursal?.id) !== Number(sucursalId)) continue;
            const key = mainStructureVehiculosKey(sucursal);
            const vehiculos: any[] = Array.isArray(sucursal[key]) ? [...sucursal[key]] : [];
            const idx = vehiculos.findIndex(
              (v: any) =>
                (Number.isFinite(vehiculoServerId) && Number(v?.id) === Number(vehiculoServerId)) ||
                (matchLocalId &&
                  (String(v?.id_local) === String(matchLocalId) || String(v?.id) === String(matchLocalId)))
            );
            const usosFromLayer = vehicleLayer.usos ?? vehicleLayer.c_usos_vehiculos_corporativos;
            const mantsFromLayer = vehicleLayer.mantenimientos ?? vehicleLayer.c_mantenimiento_vehiculos_corporativos;

            if (idx < 0) {
              vehiculos.push(
                normalizeVehiculoCorporativoForMainStructureCache({
                  ...vehicleLayer,
                  id: vehiculoServerId,
                  corpo_id: vehicleLayer.corpo_id ?? sucursalId,
                  sucursal_id: vehicleLayer.sucursal_id ?? sucursalId,
                  usos: Array.isArray(usosFromLayer) ? usosFromLayer : [],
                  c_usos_vehiculos_corporativos: Array.isArray(usosFromLayer) ? usosFromLayer : [],
                  c_mantenimiento_vehiculos_corporativos: Array.isArray(mantsFromLayer) ? mantsFromLayer : [],
                })
              );
            } else {
              const cur = vehiculos[idx];
              const keepUsos = Array.isArray(usosFromLayer)
                ? usosFromLayer
                : cur.usos ?? cur.c_usos_vehiculos_corporativos ?? [];
              const keepMants = Array.isArray(mantsFromLayer)
                ? mantsFromLayer
                : cur.mantenimientos ?? cur.c_mantenimiento_vehiculos_corporativos ?? [];
              vehiculos[idx] = normalizeVehiculoCorporativoForMainStructureCache({
                ...cur,
                ...vehicleLayer,
                id: vehiculoServerId,
                usos: keepUsos,
                c_usos_vehiculos_corporativos: keepUsos,
                c_mantenimiento_vehiculos_corporativos: keepMants,
              });
              delete vehiculos[idx].id_local;
            }
            const vehNorm = vehiculos.map(normalizeVehiculoCorporativoForMainStructureCache);
            sucursal[key] = vehNorm;
            recomputeBitacorasForSucursalNode(sucursal, vehNorm);
            changed = true;
          }
        }
      }
    }
  }
  await saveMainStructureIfChanged(tree, changed, [sucursalId]);
}

async function mergeMainStructureUso(
  sucursalId: number,
  vehiculoId: number,
  usoMerged: Record<string, any>,
  matchLocalOrActionId?: string | null
) {
  const tree = await loadMainStructureTree();
  if (!Array.isArray(tree)) return;
  let changed = false;

  for (const empresa of tree) {
    for (const cliente of empresa?.clientes || []) {
      const divisiones = cliente?.division || cliente?.divisiones || [];
      for (const division of divisiones) {
        for (const contrato of division?.contratos || []) {
          for (const sucursal of contrato?.sucursales || []) {
            if (Number(sucursal?.id) !== Number(sucursalId)) continue;
            const key = mainStructureVehiculosKey(sucursal);
            const vehiculos: any[] = Array.isArray(sucursal[key]) ? [...sucursal[key]] : [];
            const vi = vehiculos.findIndex((v: any) => Number(v?.id) === Number(vehiculoId));
            if (vi < 0) continue;
            const v = { ...vehiculos[vi] };
            const usos = [...(v.usos || v.c_usos_vehiculos_corporativos || [])];
            const ui = usos.findIndex(
              (u: any) =>
                (matchLocalOrActionId &&
                  (String(u.id_local) === String(matchLocalOrActionId) ||
                    String(u.id) === String(matchLocalOrActionId))) ||
                (usoMerged.id != null && Number(u.id) === Number(usoMerged.id))
            );
            const nextUso =
              ui >= 0
                ? { ...usos[ui], ...usoMerged, id: usoMerged.id ?? usos[ui].id, synced: true }
                : { ...usoMerged, vehiculo_id: vehiculoId, synced: true };
            // Si ya se sincronizó, no debe seguir marcado como local/offline.
            delete (nextUso as any).id_local;
            if (ui >= 0) usos[ui] = nextUso;
            else usos.push(nextUso);
            v.usos = usos;
            v.c_usos_vehiculos_corporativos = usos;
            vehiculos[vi] = normalizeVehiculoCorporativoForMainStructureCache(v);
            const vehNormU = vehiculos.map(normalizeVehiculoCorporativoForMainStructureCache);
            sucursal[key] = vehNormU;
            recomputeBitacorasForSucursalNode(sucursal, vehNormU);
            changed = true;
          }
        }
      }
    }
  }
  await saveMainStructureIfChanged(tree, changed, [sucursalId]);
}

async function mergeMainStructureMantenimiento(
  sucursalId: number,
  vehiculoId: number,
  mantMerged: Record<string, any>,
  matchLocalOrActionId?: string | null
) {
  const tree = await loadMainStructureTree();
  if (!Array.isArray(tree)) return;
  let changed = false;

  for (const empresa of tree) {
    for (const cliente of empresa?.clientes || []) {
      const divisiones = cliente?.division || cliente?.divisiones || [];
      for (const division of divisiones) {
        for (const contrato of division?.contratos || []) {
          for (const sucursal of contrato?.sucursales || []) {
            if (Number(sucursal?.id) !== Number(sucursalId)) continue;
            const key = mainStructureVehiculosKey(sucursal);
            const vehiculos: any[] = Array.isArray(sucursal[key]) ? [...sucursal[key]] : [];
            const vi = vehiculos.findIndex((v: any) => Number(v?.id) === Number(vehiculoId));
            if (vi < 0) continue;
            const v = { ...vehiculos[vi] };
            const mants = [...(v.mantenimientos || v.c_mantenimiento_vehiculos_corporativos || [])];
            const mi = mants.findIndex(
              (m: any) =>
                (matchLocalOrActionId &&
                  (String(m.id_local) === String(matchLocalOrActionId) ||
                    String(m.id) === String(matchLocalOrActionId))) ||
                (mantMerged.id != null && Number(m.id) === Number(mantMerged.id))
            );
            const nextM =
              mi >= 0
                ? { ...mants[mi], ...mantMerged, id: mantMerged.id ?? mants[mi].id, synced: true }
                : { ...mantMerged, vehiculo_id: vehiculoId, synced: true };
            // Si ya se sincronizó, no debe seguir marcado como local/offline.
            delete (nextM as any).id_local;
            if (mi >= 0) mants[mi] = nextM;
            else mants.push(nextM);
            v.c_mantenimiento_vehiculos_corporativos = mants;
            vehiculos[vi] = normalizeVehiculoCorporativoForMainStructureCache(v);
            const vehNormM = vehiculos.map(normalizeVehiculoCorporativoForMainStructureCache);
            sucursal[key] = vehNormM;
            recomputeBitacorasForSucursalNode(sucursal, vehNormM);
            changed = true;
          }
        }
      }
    }
  }
  await saveMainStructureIfChanged(tree, changed, [sucursalId]);
}

async function removeMainStructureVehiculo(sucursalId: number | null, vehiculoId: number, idLocalFallback?: string | null) {
  const tree = await loadMainStructureTree();
  if (!Array.isArray(tree)) return;
  let changed = false;
  const touchedSucursales = new Set<number>();

  for (const empresa of tree) {
    for (const cliente of empresa?.clientes || []) {
      const divisiones = cliente?.division || cliente?.divisiones || [];
      for (const division of divisiones) {
        for (const contrato of division?.contratos || []) {
          for (const sucursal of contrato?.sucursales || []) {
            if (sucursalId != null && Number(sucursal?.id) !== Number(sucursalId)) continue;
            const key = mainStructureVehiculosKey(sucursal);
            const vehiculos: any[] = Array.isArray(sucursal[key]) ? sucursal[key] : [];
            const next = vehiculos.filter(
              (v: any) =>
                !(
                  Number(v?.id) === Number(vehiculoId) ||
                  (idLocalFallback &&
                    (String(v?.id_local) === String(idLocalFallback) || String(v?.id) === String(idLocalFallback)))
                )
            );
            if (next.length !== vehiculos.length) {
              sucursal[key] = next;
              changed = true;
              const sid = Number(sucursal?.id);
              if (Number.isFinite(sid) && sid > 0) touchedSucursales.add(sid);
            }
          }
        }
      }
    }
  }
  await saveMainStructureIfChanged(tree, changed, Array.from(touchedSucursales));
}

async function removeMainStructureUso(vehiculoId: number, useKey: string | number) {
  const tree = await loadMainStructureTree();
  if (!Array.isArray(tree)) return;
  let changed = false;
  const sk = String(useKey);
  const touchedSucursales = new Set<number>();

  for (const empresa of tree) {
    for (const cliente of empresa?.clientes || []) {
      const divisiones = cliente?.division || cliente?.divisiones || [];
      for (const division of divisiones) {
        for (const contrato of division?.contratos || []) {
          for (const sucursal of contrato?.sucursales || []) {
            const key = mainStructureVehiculosKey(sucursal);
            const vehiculos: any[] = Array.isArray(sucursal[key]) ? [...sucursal[key]] : [];
            let touched = false;
            const nextVeh = vehiculos.map((v: any) => {
              if (Number(v?.id) !== Number(vehiculoId)) return normalizeVehiculoCorporativoForMainStructureCache(v);
              const usos = [...(v.usos || v.c_usos_vehiculos_corporativos || [])].filter(
                (u: any) => String(u.id) !== sk && String(u.id_local) !== sk
              );
              if (usos.length !== (v.usos || v.c_usos_vehiculos_corporativos || []).length) touched = true;
              return normalizeVehiculoCorporativoForMainStructureCache({
                ...v,
                usos,
                c_usos_vehiculos_corporativos: usos,
              });
            });
            if (touched) {
              sucursal[key] = nextVeh;
              recomputeBitacorasForSucursalNode(sucursal, nextVeh);
              changed = true;
              const sid = Number(sucursal?.id);
              if (Number.isFinite(sid) && sid > 0) touchedSucursales.add(sid);
            }
          }
        }
      }
    }
  }
  await saveMainStructureIfChanged(tree, changed, Array.from(touchedSucursales));
}

async function removeMainStructureMantenimiento(vehiculoId: number, mantKey: string | number) {
  const tree = await loadMainStructureTree();
  if (!Array.isArray(tree)) return;
  let changed = false;
  const sk = String(mantKey);
  const touchedSucursales = new Set<number>();

  for (const empresa of tree) {
    for (const cliente of empresa?.clientes || []) {
      const divisiones = cliente?.division || cliente?.divisiones || [];
      for (const division of divisiones) {
        for (const contrato of division?.contratos || []) {
          for (const sucursal of contrato?.sucursales || []) {
            const key = mainStructureVehiculosKey(sucursal);
            const vehiculos: any[] = Array.isArray(sucursal[key]) ? [...sucursal[key]] : [];
            let touched = false;
            const nextVeh = vehiculos.map((v: any) => {
              if (Number(v?.id) !== Number(vehiculoId))
                return normalizeVehiculoCorporativoForMainStructureCache(v);
              const mants = [...(v.mantenimientos || v.c_mantenimiento_vehiculos_corporativos || [])].filter(
                (m: any) => String(m.id) !== sk && String(m.id_local) !== sk
              );
              if (mants.length !== (v.mantenimientos || v.c_mantenimiento_vehiculos_corporativos || []).length)
                touched = true;
              return normalizeVehiculoCorporativoForMainStructureCache({
                ...v,
                c_mantenimiento_vehiculos_corporativos: mants,
              });
            });
            if (touched) {
              sucursal[key] = nextVeh;
              recomputeBitacorasForSucursalNode(sucursal, nextVeh);
              changed = true;
              const sid = Number(sucursal?.id);
              if (Number.isFinite(sid) && sid > 0) touchedSucursales.add(sid);
            }
          }
        }
      }
    }
  }
  await saveMainStructureIfChanged(tree, changed, Array.from(touchedSucursales));
}

function stripUsePayloadForApi(payload: Record<string, any>) {
  const { vehiculo_id: _v, id_local: _il, vehiculo_id_local: _vil, ...rest } = payload || {};
  return rest;
}

function stripMaintenancePayloadForApi(payload: Record<string, any>) {
  const { vehiculo_id: _v, id_local: _il, vehiculo_id_local: _vil, ...rest } = payload || {};
  return rest;
}

async function resolveServerVehiculoIdFromPayload(
  payload: Record<string, any>
): Promise<{ vehiculoId: number | null; rawVehiculo: string | number | undefined }> {
  const vehiculoIdRaw = payload.vehiculo_id;
  let vehiculoId = typeof vehiculoIdRaw === 'number' ? vehiculoIdRaw : Number(vehiculoIdRaw || 0);

  if (!vehiculoId || String(vehiculoIdRaw || '').startsWith('local-')) {
    const fromMs = await resolveCorporateVehicleServerIdFromMainStructure(String(vehiculoIdRaw));
    if (fromMs) vehiculoId = Number(fromMs);
    else {
      const fromCorpo = await findCorporateVehicleServerIdByLocalKey(String(vehiculoIdRaw));
      if (fromCorpo) vehiculoId = fromCorpo;
      else {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        const cache = cacheStr ? JSON.parse(cacheStr) : [];
        const found = cache.find(
          (item: any) =>
            item.type === 'corporate_vehicle' &&
            (String(item.id_local) === String(vehiculoIdRaw) || String(item.id) === String(vehiculoIdRaw)) &&
            typeof item.id === 'number'
        );
        vehiculoId = found?.id ? Number(found.id) : 0;
      }
    }
  }
  return { vehiculoId: vehiculoId || null, rawVehiculo: vehiculoIdRaw };
}

function removeActionFromQueue(all: any[], action: any) {
  return all.filter((a: any) => {
    if (String(a.id) !== String(action.id) || a.action !== action.action || a.type !== action.type) return true;
    if (
      action.type === 'corporate_vehicle_maintenance' &&
      action.action === 'delete_image' &&
      action.payload?.slot != null
    ) {
      return a.payload?.slot !== action.payload?.slot;
    }
    return false;
  });
}

/** Quita creaciones pendientes duplicadas en la cola legacy (mismo id local que evaluations_actions). */
async function stripLegacyBitacoraCreateAction(localId: string) {
  try {
    const s = await AsyncStorage.getItem('bitacora_vehiculo_detenido_actions');
    if (!s) return;
    const legacy = JSON.parse(s);
    if (!Array.isArray(legacy)) return;
    const filtered = legacy.filter(
      (a: any) => !(a.type === 'create' && String(a.id) === String(localId))
    );
    if (filtered.length !== legacy.length) {
      await AsyncStorage.setItem('bitacora_vehiculo_detenido_actions', JSON.stringify(filtered));
    }
  } catch {
    /* ignore */
  }
}

async function resolveBitacoraVehiculoServerIdFromCache(payload: Record<string, any>): Promise<number | null> {
  const raw = payload.vehiculo_id;
  const local = payload.vehiculo_id_local;
  if (isServerEntityId(raw)) return Number(raw);
  const key = extractLocalEntityKey(raw, local);
  if (!key) return null;
  const fromMs = await resolveCorporateVehicleServerIdFromMainStructure(key);
  if (fromMs) return fromMs;
  const fromCorpo = await findCorporateVehicleServerIdByLocalKey(key);
  if (fromCorpo) return fromCorpo;
  const cacheStr = await AsyncStorage.getItem('evaluations_cache');
  const cache = cacheStr ? JSON.parse(cacheStr) : [];
  const found = cache.find(
    (item: any) =>
      item.type === 'corporate_vehicle' &&
      (String(item.id_local) === key || String(item.id) === key) &&
      typeof item.id === 'number' &&
      Number(item.id) > 0
  );
  return found?.id ? Number(found.id) : null;
}

async function resolveBitacoraUsoServerIdFromCache(
  payload: Record<string, any>,
  vehiculoServerId: number | null
): Promise<number | null> {
  const raw = payload.uso_id;
  const local = payload.uso_id_local;
  if (isServerEntityId(raw)) return Number(raw);
  const key = extractLocalEntityKey(raw, local);
  if (!key) return null;
  if (!vehiculoServerId) return null;
  const fromCorpo = await findServerUsoIdInCorpoCache(vehiculoServerId, key);
  if (fromCorpo) return fromCorpo;
  const cacheStr = await AsyncStorage.getItem('evaluations_cache');
  const cache = cacheStr ? JSON.parse(cacheStr) : [];
  const veh = cache.find(
    (item: any) => item.type === 'corporate_vehicle' && Number(item.id) === Number(vehiculoServerId)
  );
  if (veh) {
    const usos = veh.usos || veh.c_usos_vehiculos_corporativos || [];
    const u = usos.find((x: any) => String(x.id_local) === key || String(x.id) === key);
    if (u && typeof u.id === 'number' && Number(u.id) > 0) return Number(u.id);
  }
  return resolveCorporateUsoServerIdFromMainStructure(vehiculoServerId, key);
}

async function processBitacoraVehiculoDetenidoActions(deps: {
  refreshAccessToken: () => Promise<boolean>;
  logout: (...args: any[]) => any;
}): Promise<void> {
  const { refreshAccessToken, logout } = deps;
  const {
    createBitacoraVehiculoDetenido,
    updateBitacoraVehiculoDetenido,
    deleteBitacoraVehiculoDetenido,
  } = await import('@/hooks/bitacoraVehiculoDetenidoFunctions');

  for (let guard = 0; guard < 30; guard++) {
    const actionsStr = await AsyncStorage.getItem('evaluations_actions');
    const all: any[] = actionsStr ? JSON.parse(actionsStr) : [];
    const pending = all.filter(
      (a) =>
        a.type === BITACORA_VEHICULO_DETENIDO_EVAL_TYPE &&
        (a.action === 'create' || a.action === 'update' || a.action === 'delete')
    );
    if (pending.length === 0) break;

    let progressed = false;
    for (const action of pending) {
      const freshStr = await AsyncStorage.getItem('evaluations_actions');
      const fresh: any[] = freshStr ? JSON.parse(freshStr) : [];
      const stillThere = fresh.some(
        (a) =>
          String(a.id) === String(action.id) && a.action === action.action && a.type === action.type
      );
      if (!stillThere) continue;

      if (action.action === 'update') {
        const payloadUp = JSON.parse(JSON.stringify(action.payload || {}));
        const bid = Number(action.id);
        if (!Number.isFinite(bid) || bid <= 0) {
          const next = removeActionFromQueue(fresh, action);
          await AsyncStorage.setItem('evaluations_actions', JSON.stringify(next));
          progressed = true;
          continue;
        }
        const resUp = await updateBitacoraVehiculoDetenido({
          id: bid,
          requestData: payloadUp,
          refreshAccessToken,
          logout,
        });
        if (!resUp.status) continue;
        const next = removeActionFromQueue(fresh, action);
        await AsyncStorage.setItem('evaluations_actions', JSON.stringify(next));
        progressed = true;
        continue;
      }

      if (action.action === 'delete') {
        const bid = Number(action.id);
        if (!Number.isFinite(bid) || bid <= 0) {
          const next = removeActionFromQueue(fresh, action);
          await AsyncStorage.setItem('evaluations_actions', JSON.stringify(next));
          progressed = true;
          continue;
        }
        const resDel = await deleteBitacoraVehiculoDetenido({ id: bid, refreshAccessToken, logout });
        if (!resDel.status) continue;
        await clearBitacoraFromMainStructureByBitacoraRef({ bitacoraId: bid });
        await removeBitacoraDetenidoRowFromMainStructure({ bitacoraId: bid });
        const next = removeActionFromQueue(fresh, action);
        await AsyncStorage.setItem('evaluations_actions', JSON.stringify(next));
        progressed = true;
        continue;
      }

      const payload = JSON.parse(JSON.stringify(action.payload || {}));
      delete payload.bitacora_action_local_id;

      const vehKey = extractLocalEntityKey(payload.vehiculo_id, payload.vehiculo_id_local) || null;

      let vId: number | null =
        isServerEntityId(payload.vehiculo_id) ? Number(payload.vehiculo_id) : null;

      if (vehKey) {
        const resolved = await resolveBitacoraVehiculoServerIdFromCache({
          vehiculo_id: vehKey,
          vehiculo_id_local: vehKey,
        });
        if (!resolved) continue;
        vId = resolved;
        payload.vehiculo_id = vId;
        delete payload.vehiculo_id_local;
      }

      const usoKey = extractLocalEntityKey(payload.uso_id, payload.uso_id_local) || null;

      let uId: number | null =
        isServerEntityId(payload.uso_id) ? Number(payload.uso_id) : null;

      if (usoKey) {
        const resolvedUso = await resolveBitacoraUsoServerIdFromCache(
          { uso_id: usoKey, uso_id_local: usoKey },
          vId
        );
        if (!resolvedUso) continue;
        uId = resolvedUso;
        payload.uso_id = uId;
        delete payload.uso_id_local;
      }

      try {
        const result = await createBitacoraVehiculoDetenido({ requestData: payload, refreshAccessToken, logout });
        if (!result.status) continue;

        const next = removeActionFromQueue(fresh, action);
        await AsyncStorage.setItem('evaluations_actions', JSON.stringify(next));
        await stripLegacyBitacoraCreateAction(String(action.id));

        const newId = Number(
          (result as any).id ?? (result as any).data?.id ?? (result as any).data?.data?.id ?? 0
        );
        const corpoId = Number(payload.sucursal_id ?? 0);

        if (newId && corpoId > 0) {
          const {
            upsertBitacoraDetenidoRowInMainStructure,
            readBitacorasForSucursalFromMainStructure,
          } = await import('./bitacoraMainStructureCache');
          const list = await readBitacorasForSucursalFromMainStructure(corpoId);
          const prevRow = list.find((b: any) => String(b.id_local) === String(action.id)) || null;
          await upsertBitacoraDetenidoRowInMainStructure(
            {
              ...(prevRow || {}),
              id: newId,
              empresa_id: payload.empresa_id,
              cliente_id: payload.cliente_id,
              sucursal_id: corpoId,
              corpo_id: corpoId,
              division_id: payload.division_id ?? prevRow?.division_id,
              contrato_id: payload.contrato_id ?? prevRow?.contrato_id,
              puesto_id: payload.puesto_id ?? prevRow?.puesto_id,
              isActive: payload.isActive !== false,
              vehiculo_id: payload.vehiculo_id ?? prevRow?.vehiculo_id ?? null,
              uso_id: payload.uso_id ?? prevRow?.uso_id ?? null,
              vehiculo_id_local: payload.vehiculo_id_local,
              uso_id_local: payload.uso_id_local,
              tipo: payload.tipo,
              informacion_general: payload.informacion_general ?? prevRow?.informacion_general,
              informacion_revision: payload.informacion_revision ?? prevRow?.informacion_revision,
              movimientos_vehiculos: payload.movimientos_vehiculos ?? prevRow?.movimientos_vehiculos,
              observaciones: payload.observaciones ?? prevRow?.observaciones,
              firma_responsable: payload.firma_responsable ?? prevRow?.firma_responsable,
              created_by: prevRow?.created_by,
              created_at: prevRow?.created_at,
              id_local: '',
            },
            corpoId,
            String(action.id)
          );
        }

        if (newId && vId && uId && corpoId > 0) {
          const snap = { id: newId, tipo: payload.tipo };
          await setBitacoraIdOnVehicleUseInCorpoCache({
            corpoId,
            vehiculoId: vId,
            usoId: uId,
            bitacoraId: newId,
            bitacora: snap,
          });
          await setBitacoraOnUsoInMainStructureCache({
            sucursalId: corpoId,
            vehiculoId: vId,
            usoId: uId,
            bitacora: snap,
          });
        }

        progressed = true;
      } catch (e) {
        console.error('Error sync bitácora vehículo detenido:', e);
      }
    }

    if (!progressed) break;
  }
}

export async function runCorporateEvaluationsSync(deps: {
  refreshAccessToken: () => Promise<boolean>;
  logout: (...args: any[]) => any;
}): Promise<void> {
  const { refreshAccessToken, logout } = deps;

  for (let guard = 0; guard < 50; guard++) {
    const actionsStr = await AsyncStorage.getItem('evaluations_actions');
    const all: any[] = actionsStr ? JSON.parse(actionsStr) : [];
    const corporate = all.filter((a) => CORPORATE_EVALUATION_TYPES.has(a.type));
    if (corporate.length === 0) break;

    const sorted = sortCorporateEvaluationActions(corporate);
    let progressed = false;

    for (const action of sorted) {
      const freshStr = await AsyncStorage.getItem('evaluations_actions');
      const fresh: any[] = freshStr ? JSON.parse(freshStr) : [];
      const stillThere = fresh.some(
        (a) =>
          String(a.id) === String(action.id) && a.action === action.action && a.type === action.type
      );
      if (!stillThere) continue;

      try {
        const done = await processOneCorporateAction(action, { refreshAccessToken, logout });
        if (done) progressed = true;
      } catch (e) {
        console.error('Error en sync corporativa:', e);
      }
    }

    if (!progressed) break;
  }

  await processBitacoraVehiculoDetenidoActions({ refreshAccessToken, logout });
}

/** Convierte `stored_file_name` / `localFileName` en `file_base64` antes del POST/PUT al API. */
async function hydrateCorporateVehicleImagenesInPayload(payload: Record<string, any>): Promise<Record<string, any>> {
  const next: Record<string, any> = { ...payload };
  const raw = next.imagenes;
  if (raw == null) return next;
  let list: any[] = [];
  if (Array.isArray(raw)) list = raw;
  else if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      list = Array.isArray(p) ? p : [];
    } catch {
      list = [];
    }
  }
  if (list.length === 0) {
    // Sin adjuntos nuevos: no enviar `imagenes` en el PUT (el servidor no debe tocar existentes).
    delete next.imagenes;
    return next;
  }
  const { getFile } = await import('@/hooks/fileStorage');
  const hydrated: any[] = [];
  for (const img of list) {
    const key =
      (typeof img?.stored_file_name === 'string' && img.stored_file_name.trim()) ||
      (typeof img?.localFileName === 'string' && img.localFileName.trim()) ||
      '';
    if (key) {
      try {
        const { base64 } = await getFile(key.trim());
        if (base64 && String(base64).length > 0) {
          hydrated.push({
            extension: String(img.extension || 'jpg').replace(/^\./, ''),
            file_base64: String(base64),
            original_name: img.original_name || img.name,
          });
        }
      } catch {
        /* adjunto local ausente */
      }
    } else if (img?.file_base64 && String(img.file_base64).trim()) {
      hydrated.push({
        extension: String(img.extension || 'jpg').replace(/^\./, ''),
        file_base64: String(img.file_base64).trim(),
        original_name: img.original_name || img.name,
      });
    }
  }
  if (hydrated.length === 0) delete next.imagenes;
  else next.imagenes = hydrated;
  return next;
}

/** Convierte refs locales de imágenes de mantenimiento a base64 previo al POST/PUT. */
async function hydrateCorporateMaintenanceImagesInPayload(payload: Record<string, any>): Promise<Record<string, any>> {
  const next: Record<string, any> = { ...(payload || {}) };
  const slots: Array<{ field: 'imagen_antes' | 'imagen_despues'; refField: 'imagen_antes_local_file' | 'imagen_despues_local_file' }> = [
    { field: 'imagen_antes', refField: 'imagen_antes_local_file' },
    { field: 'imagen_despues', refField: 'imagen_despues_local_file' },
  ];
  const { getFile } = await import('@/hooks/fileStorage');
  for (const { field, refField } of slots) {
    const key = typeof next[refField] === 'string' ? String(next[refField]).trim() : '';
    if (key) {
      try {
        const g = await getFile(key);
        if (g?.base64 && String(g.base64).trim() !== '') {
          next[field] = String(g.base64).trim();
        }
      } catch {
        // ignore missing local file
      }
    }
    delete next[refField];
  }
  return next;
}

async function removeCorporateVehicleImageFromAllCaches(vehiculoId: number, imageRowId: number) {
  const tree = await loadMainStructureTree();
  if (!Array.isArray(tree)) return;
  let changed = false;
  const touched = new Set<number>();
  forEachSucursalInTree(tree, (suc) => {
    const vk = mainStructureVehiculosKey(suc);
    const list = Array.isArray(suc[vk]) ? [...suc[vk]] : [];
    let mod = false;
    const next = list.map((v: any) => {
      if (Number(v?.id) !== vehiculoId) return v;
      const imgs: any[] = Array.isArray(v?.images) ? v.images : [];
      const filtered = imgs.filter((im) => Number(im?.id) !== imageRowId);
      if (filtered.length === imgs.length) return v;
      mod = true;
      return { ...v, images: filtered };
    });
    if (mod) {
      suc[vk] = next;
      changed = true;
      const sid = Number(suc?.id);
      if (Number.isFinite(sid) && sid > 0) touched.add(sid);
    }
  });
  if (changed) await saveMainStructureTree(tree, { sucursalIds: Array.from(touched) });

  const cacheStr = await AsyncStorage.getItem('evaluations_cache');
  if (cacheStr) {
    const cache = JSON.parse(cacheStr);
    const out = cache.map((item: any) => {
      if (item.type !== 'corporate_vehicle' || Number(item.id) !== vehiculoId) return item;
      const imgs: any[] = Array.isArray(item?.images) ? item.images : [];
      return { ...item, images: imgs.filter((im) => Number(im?.id) !== imageRowId) };
    });
    await AsyncStorage.setItem('evaluations_cache', JSON.stringify(out));
  }
}

async function processOneCorporateAction(
  action: any,
  deps: { refreshAccessToken: () => Promise<boolean>; logout: (...args: any[]) => any }
): Promise<boolean> {
  const { refreshAccessToken, logout } = deps;

  if (action.type === 'corporate_vehicle' && action.action === 'delete_image') {
    const { deleteCorporateVehicleImage } = await import('@/hooks/evaluationFunctions');
    const imageId = Number(action.payload?.imageId);
    if (!imageId) return false;
    let vehId: number =
      typeof action.id === 'number' && action.id > 0 ? action.id : Number(action.id) || 0;
    if (!vehId || String(action.id).startsWith('local-')) {
      const resolved = await resolveCorporateVehicleServerIdFromMainStructure(String(action.id));
      if (resolved) vehId = Number(resolved);
    }
    if (!vehId) return false;
    const result = await deleteCorporateVehicleImage({
      vehiculoId: vehId,
      imageId,
      refreshAccessToken,
      logout,
    });
    if (!result.status) return false;
    let all = JSON.parse((await AsyncStorage.getItem('evaluations_actions')) || '[]');
    all = removeActionFromQueue(all, action);
    await AsyncStorage.setItem('evaluations_actions', JSON.stringify(all));
    await removeCorporateVehicleImageFromAllCaches(vehId, imageId);
    if (action.payload?.sucursalId) {
      const sid = Number(action.payload.sucursalId);
      if (sid) await refreshCorpoCacheVehicleRowFromMainStructure(sid, vehId);
    } else {
      const sid = await resolveSucursalIdForVehiculo(vehId);
      if (sid) await refreshCorpoCacheVehicleRowFromMainStructure(sid, vehId);
    }
    return true;
  }

  if (action.type === 'corporate_vehicle_maintenance' && action.action === 'delete_image') {
    const { deleteCorporateVehicleMaintenanceImage } = await import('@/hooks/evaluationFunctions');
    const slot = action.payload?.slot as 'antes' | 'despues' | undefined;
    if (slot !== 'antes' && slot !== 'despues') return false;
    const field = slot === 'antes' ? 'imagen_antes' : 'imagen_despues';
    let mid: string | number = action.id;
    if (String(mid).startsWith('local-')) {
      const payload = action.payload || {};
      let found: number | null = null;
      const { vehiculoId: vnum } = await resolveServerVehiculoIdFromPayload(payload);
      if (vnum) found = await findServerMantenimientoIdInCorpoCache(vnum, String(mid));
      if (!found) {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        const cache = cacheStr ? JSON.parse(cacheStr) : [];
        for (const item of cache) {
          if (item.type !== 'corporate_vehicle') continue;
          const mants = Array.isArray(item.mantenimientos)
            ? item.mantenimientos
            : Array.isArray(item.c_mantenimiento_vehiculos_corporativos)
              ? item.c_mantenimiento_vehiculos_corporativos
              : [];
          const m = mants.find((x: any) => String(x.id_local) === String(mid) && typeof x.id === 'number');
          if (m?.id) {
            found = Number(m.id);
            break;
          }
        }
      }
      if (!found) return false;
      mid = found;
    }
    const maintenanceId = String(mid);
    const result = await deleteCorporateVehicleMaintenanceImage({
      maintenance_id: maintenanceId,
      slot,
      refreshAccessToken,
      logout,
    });
    if (!result.status) return false;

    let all = JSON.parse((await AsyncStorage.getItem('evaluations_actions')) || '[]');
    all = removeActionFromQueue(all, action);
    await AsyncStorage.setItem('evaluations_actions', JSON.stringify(all));

    const { vehiculoId: vid } = await resolveServerVehiculoIdFromPayload(action.payload || {});
    const vehiculoIdNum = vid || 0;
    const cacheStr = await AsyncStorage.getItem('evaluations_cache');
    if (cacheStr) {
      const cache = JSON.parse(cacheStr);
      const updatedCache = cache.map((item: any) => {
        if (item.type !== 'corporate_vehicle') return item;
        const mants = Array.isArray(item.mantenimientos)
          ? item.mantenimientos
          : Array.isArray(item.c_mantenimiento_vehiculos_corporativos)
            ? item.c_mantenimiento_vehiculos_corporativos
            : [];
        const newMants = mants.map((m: any) => {
          const matches = String(m.id) === String(maintenanceId) || String(m.id_local) === String(action.id);
          if (!matches) return m;
          return { ...m, [field]: '', synced: true };
        });
        return {
          ...item,
          mantenimientos: newMants,
          c_mantenimiento_vehiculos_corporativos: newMants,
        };
      });
      await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
    }

    if (vehiculoIdNum) {
      const sid = await resolveSucursalIdForVehiculo(vehiculoIdNum);
      if (sid) {
        await mergeMainStructureMantenimiento(
          sid,
          vehiculoIdNum,
          { id: Number(maintenanceId), [field]: '' },
          String(action.id)
        );
        await refreshCorpoCacheVehicleRowFromMainStructure(sid, vehiculoIdNum);
      }
    }
    return true;
  }

  if (action.action === 'create' && action.type === 'corporate_vehicle') {
    const { createCorporateVehicle } = await import('@/hooks/evaluationFunctions');
    const payload = await hydrateCorporateVehicleImagenesInPayload({ ...(action.payload || {}) });
    delete payload.id_local;
    const result = await createCorporateVehicle({
      requestData: payload as CorporateVehicleRequestBody,
      refreshAccessToken,
      logout,
    });
    if (!result.status) return false;

    const newId = Number(result.data?.id ?? 0);
    const corpoId = Number(payload.corpo_id ?? 0);

    let all = JSON.parse((await AsyncStorage.getItem('evaluations_actions')) || '[]');
    all = removeActionFromQueue(all, action);
    await AsyncStorage.setItem('evaluations_actions', JSON.stringify(all));

    if (newId && action.id) await patchPendingCorporateChildrenVehiculoId(String(action.id), newId);
    if (newId && action.id) await patchPendingBitacoraAfterVehicleVehiculoSync(String(action.id), newId);

    if (corpoId && newId) {
      if (action.id) {
        // Limpia borrador local previo para evitar duplicado (sync + "(offline)") en la lista.
        await removeCorporateVehicleFromMainStructureEverywhere({
          idLocal: String(action.id),
          sucursalIdHint: corpoId,
        });
        await removeVehicleFromCorpoCache({ id: String(action.id), id_local: String(action.id) });
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const next = Array.isArray(cache)
            ? cache.filter(
                (it: any) =>
                  !(
                    it?.type === 'corporate_vehicle' &&
                    (String(it?.id_local ?? '') === String(action.id) || String(it?.id ?? '') === String(action.id))
                  )
              )
            : cache;
          await AsyncStorage.setItem('evaluations_cache', JSON.stringify(next));
        }
      }
      const vehicleLayer = {
        ...payload,
        ...result.data,
        id: newId,
        corpo_id: corpoId,
        synced: true,
      };
      delete (vehicleLayer as any).id_local;
      await upsertMainStructureVehicle(corpoId, newId, vehicleLayer, String(action.id));
      await refreshCorpoCacheVehicleRowFromMainStructure(corpoId, newId);
    }
    return true;
  }

  if (action.action === 'create' && action.type === 'corporate_vehicle_use') {
    const { createCorporateVehicleUse } = await import('@/hooks/evaluationFunctions');
    const payload = action.payload || {};
    const { vehiculoId, rawVehiculo } = await resolveServerVehiculoIdFromPayload(payload);
    if (!vehiculoId) return false;

    const requestData = stripUsePayloadForApi(payload);
    const result = await createCorporateVehicleUse({
      vehiculo_id: String(vehiculoId),
      requestData: requestData as unknown as CorporateVehicleUseRequest,
      refreshAccessToken,
      logout,
    });
    if (!result.status) return false;

    let all = JSON.parse((await AsyncStorage.getItem('evaluations_actions')) || '[]');
    all = removeActionFromQueue(all, action);
    await AsyncStorage.setItem('evaluations_actions', JSON.stringify(all));

    const newUsoId = Number(result.data?.id ?? 0);
    if (newUsoId && action.id) {
      await patchPendingBitacoraAfterUsoSync(String(action.id), newUsoId, vehiculoId);
    }

    const cacheStr = await AsyncStorage.getItem('evaluations_cache');
    if (cacheStr) {
      const cache = JSON.parse(cacheStr);
      const updatedCache = cache.map((item: any) => {
        if (item.type !== 'corporate_vehicle') return item;
        const matchVehicle =
          (typeof item.id === 'number' && Number(item.id) === Number(vehiculoId)) ||
          String(item.id_local) === String(rawVehiculo);
        if (!matchVehicle) return item;
        const usos = Array.isArray(item.usos) ? item.usos : [];
        const newUsos = usos.map((u: any) => {
          if (String(u.id) === String(action.id) || String(u.id_local) === String(action.id)) {
            const nextUse = { ...u, ...result.data, id: result.data?.id ?? u.id, synced: true };
            delete (nextUse as any).id_local;
            return nextUse;
          }
          return u;
        });
        return { ...item, usos: newUsos, c_usos_vehiculos_corporativos: newUsos };
      });
      await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
    }

    const sid = (await resolveSucursalIdForVehiculo(vehiculoId)) ?? undefined;
    if (sid) {
      const usoMerged = { ...requestData, ...result.data, id: result.data?.id, vehiculo_id: vehiculoId };
      await mergeMainStructureUso(sid, vehiculoId, usoMerged, String(action.id));
      await refreshCorpoCacheVehicleRowFromMainStructure(sid, vehiculoId);
    }
    return true;
  }

  if (action.action === 'create' && action.type === 'corporate_vehicle_maintenance') {
    const { createCorporateVehicleMaintenance } = await import('@/hooks/evaluationFunctions');
    const payload = action.payload || {};
    const { vehiculoId, rawVehiculo } = await resolveServerVehiculoIdFromPayload(payload);
    if (!vehiculoId) return false;

    const requestDataRaw = stripMaintenancePayloadForApi(payload);
    const requestData = await hydrateCorporateMaintenanceImagesInPayload(requestDataRaw);
    const result = await createCorporateVehicleMaintenance({
      vehiculo_id: String(vehiculoId),
      requestData: requestData as unknown as CorporateVehicleMaintenanceRequest,
      refreshAccessToken,
      logout,
    });
    if (!result.status) return false;

    let all = JSON.parse((await AsyncStorage.getItem('evaluations_actions')) || '[]');
    all = removeActionFromQueue(all, action);
    await AsyncStorage.setItem('evaluations_actions', JSON.stringify(all));

    const created = result.data as any;
    const newMantId = Number(created?.id ?? 0);

    const cacheStr = await AsyncStorage.getItem('evaluations_cache');
    if (cacheStr) {
      const cache = JSON.parse(cacheStr);
      const updatedCache = cache.map((item: any) => {
        if (item.type !== 'corporate_vehicle') return item;
        const matchVehicle =
          (typeof item.id === 'number' && Number(item.id) === Number(vehiculoId)) ||
          String(item.id_local) === String(rawVehiculo);
        if (!matchVehicle) return item;
        const mants = Array.isArray(item.mantenimientos)
          ? item.mantenimientos
          : Array.isArray(item.c_mantenimiento_vehiculos_corporativos)
            ? item.c_mantenimiento_vehiculos_corporativos
            : [];
        const newMants = mants.map((m: any) => {
          if (String(m.id) === String(action.id) || String(m.id_local) === String(action.id)) {
            const nextMaintenance = { ...m, ...created, id: newMantId || m.id, synced: true };
            delete (nextMaintenance as any).id_local;
            return nextMaintenance;
          }
          return m;
        });
        return {
          ...item,
          mantenimientos: newMants,
          c_mantenimiento_vehiculos_corporativos: newMants,
        };
      });
      await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
    }

    const sid = (await resolveSucursalIdForVehiculo(vehiculoId)) ?? undefined;
    if (sid && newMantId) {
      const mantMerged = { ...requestData, ...created, id: newMantId, vehiculo_id: vehiculoId };
      await mergeMainStructureMantenimiento(sid, vehiculoId, mantMerged, String(action.id));
      await refreshCorpoCacheVehicleRowFromMainStructure(sid, vehiculoId);
    }
    return true;
  }

  if (action.action === 'update' && action.type === 'corporate_vehicle') {
    const { updateCorporateVehicle } = await import('@/hooks/evaluationFunctions');
    const requestData = await hydrateCorporateVehicleImagenesInPayload({ ...(action.payload || {}) });
    const result = await updateCorporateVehicle({
      id: action.id,
      requestData: requestData as CorporateVehicleRequestBody,
      refreshAccessToken,
      logout,
    });
    if (!result.status) return false;

    let all = JSON.parse((await AsyncStorage.getItem('evaluations_actions')) || '[]');
    all = removeActionFromQueue(all, action);
    await AsyncStorage.setItem('evaluations_actions', JSON.stringify(all));

    const vid = Number(action.id);
    const oldSid = await resolveSucursalIdForVehiculoFromMainStructure(vid);
    const newSid =
      Number(action.payload?.corpo_id ?? action.payload?.sucursal_id ?? 0) ||
      (await resolveSucursalIdForVehiculo(vid)) ||
      oldSid ||
      0;
    const layer = {
      ...action.payload,
      id: vid,
      corpo_id: newSid,
      sucursal_id: newSid,
      images: result.data?.images,
    };
    if (oldSid && newSid && oldSid !== newSid) {
      await moveCorporateVehicleInMainStructure({
        vehicle: { ...layer, ...result.data },
        oldCorpoId: oldSid,
        newCorpoId: newSid,
        matchLocalKey: null,
      });
    } else if (newSid && vid) {
      await upsertMainStructureVehicle(newSid, vid, layer, null);
    }
    if (newSid && vid) await refreshCorpoCacheVehicleRowFromMainStructure(newSid, vid);
    return true;
  }

  if (action.action === 'update' && action.type === 'corporate_vehicle_use') {
    const { updateCorporateVehicleUse } = await import('@/hooks/evaluationFunctions');
    let useId: string | number = action.id;
    const isLocalUse = String(useId).startsWith('local-');
    const payload = action.payload || {};

    if (isLocalUse) {
      let foundServerUseId: number | null = null;
      const { vehiculoId: vnum } = await resolveServerVehiculoIdFromPayload(payload);
      if (vnum) foundServerUseId = await findServerUsoIdInCorpoCache(vnum, String(useId));
      if (!foundServerUseId) {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        const cache = cacheStr ? JSON.parse(cacheStr) : [];
        for (const item of cache) {
          if (item.type !== 'corporate_vehicle') continue;
          const usos = Array.isArray(item.usos) ? item.usos : [];
          const foundUse = usos.find((u: any) => String(u.id_local) === String(useId) && typeof u.id === 'number');
          if (foundUse?.id) {
            foundServerUseId = Number(foundUse.id);
            break;
          }
        }
      }
      if (!foundServerUseId) return false;
      useId = String(foundServerUseId);
    }

    const requestData = stripUsePayloadForApi(payload);
    const result = await updateCorporateVehicleUse({
      use_id: String(useId),
      requestData: requestData as unknown as Partial<CorporateVehicleUseRequest>,
      refreshAccessToken,
      logout,
    });
    if (!result.status) return false;

    let all = JSON.parse((await AsyncStorage.getItem('evaluations_actions')) || '[]');
    all = removeActionFromQueue(all, action);
    await AsyncStorage.setItem('evaluations_actions', JSON.stringify(all));

    const cacheStr = await AsyncStorage.getItem('evaluations_cache');
    let vehiculoIdForStruct: number | null = null;
    if (cacheStr) {
      const cache = JSON.parse(cacheStr);
      const updatedCache = cache.map((item: any) => {
        if (item.type !== 'corporate_vehicle') return item;
        const usos = Array.isArray(item.usos) ? item.usos : [];
        const newUsos = usos.map((u: any) => {
          const matches = String(u.id) === String(useId) || String(u.id_local) === String(action.id);
          if (!matches) return u;
          if (!vehiculoIdForStruct && item.id) vehiculoIdForStruct = Number(item.id);
          return { ...u, ...payload, id: u.id, synced: true };
        });
        return { ...item, usos: newUsos, c_usos_vehiculos_corporativos: newUsos };
      });
      await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
    }

    const vehiculoId =
      vehiculoIdForStruct ||
      Number((payload as any).vehiculo_id) ||
      (await (async () => {
        const { vehiculoId: v } = await resolveServerVehiculoIdFromPayload(payload);
        return v;
      })());
    if (vehiculoId) {
      const sid = await resolveSucursalIdForVehiculo(vehiculoId);
      if (sid) {
        await mergeMainStructureUso(sid, vehiculoId, { ...requestData, ...payload, id: useId }, String(action.id));
        await refreshCorpoCacheVehicleRowFromMainStructure(sid, vehiculoId);
      }
    }
    return true;
  }

  if (action.action === 'update' && action.type === 'corporate_vehicle_maintenance') {
    const { updateCorporateVehicleMaintenance } = await import('@/hooks/evaluationFunctions');
    const payload = action.payload || {};
    let mid: string | number = action.id;
    if (String(mid).startsWith('local-')) {
      let found: number | null = null;
      const { vehiculoId: vnum } = await resolveServerVehiculoIdFromPayload(payload);
      if (vnum) found = await findServerMantenimientoIdInCorpoCache(vnum, String(mid));
      if (!found) {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        const cache = cacheStr ? JSON.parse(cacheStr) : [];
        for (const item of cache) {
          if (item.type !== 'corporate_vehicle') continue;
          const mants = Array.isArray(item.mantenimientos)
            ? item.mantenimientos
            : Array.isArray(item.c_mantenimiento_vehiculos_corporativos)
              ? item.c_mantenimiento_vehiculos_corporativos
              : [];
          const m = mants.find((x: any) => String(x.id_local) === String(mid) && typeof x.id === 'number');
          if (m?.id) {
            found = Number(m.id);
            break;
          }
        }
      }
      if (!found) return false;
      mid = found;
    }
    const maintenanceId = String(mid);

    const requestDataRaw = stripMaintenancePayloadForApi(payload);
    const requestData = await hydrateCorporateMaintenanceImagesInPayload(requestDataRaw);
    const result = await updateCorporateVehicleMaintenance({
      maintenance_id: maintenanceId,
      requestData: requestData as unknown as Partial<CorporateVehicleMaintenanceRequest>,
      refreshAccessToken,
      logout,
    });
    if (!result.status) return false;

    let all = JSON.parse((await AsyncStorage.getItem('evaluations_actions')) || '[]');
    all = removeActionFromQueue(all, action);
    await AsyncStorage.setItem('evaluations_actions', JSON.stringify(all));

    const { vehiculoId } = await resolveServerVehiculoIdFromPayload(payload);
    const vid = vehiculoId || 0;
    const cacheStr = await AsyncStorage.getItem('evaluations_cache');
    if (cacheStr) {
      const cache = JSON.parse(cacheStr);
      const updatedCache = cache.map((item: any) => {
        if (item.type !== 'corporate_vehicle') return item;
        const mants = Array.isArray(item.mantenimientos)
          ? item.mantenimientos
          : Array.isArray(item.c_mantenimiento_vehiculos_corporativos)
            ? item.c_mantenimiento_vehiculos_corporativos
            : [];
        const newMants = mants.map((m: any) => {
          const matches = String(m.id) === String(maintenanceId) || String(m.id_local) === String(action.id);
          if (!matches) return m;
          return { ...m, ...payload, id: m.id, synced: true };
        });
        return {
          ...item,
          mantenimientos: newMants,
          c_mantenimiento_vehiculos_corporativos: newMants,
        };
      });
      await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
    }

    if (vid) {
      const sid = await resolveSucursalIdForVehiculo(vid);
      if (sid) {
        await mergeMainStructureMantenimiento(sid, vid, { ...requestData, id: maintenanceId }, String(action.id));
        await refreshCorpoCacheVehicleRowFromMainStructure(sid, vid);
      }
    }
    return true;
  }

  if (action.action === 'delete' && action.type === 'corporate_vehicle') {
    const { deleteCorporateVehicle } = await import('@/hooks/evaluationFunctions');
    const vid = parseCorporateVehicleServerId(action.id) ?? 0;
    const sidHintBeforeCaches =
      vid > 0 ? ((await resolveSucursalIdForVehiculo(vid)) ?? undefined) : undefined;

    const result = await deleteCorporateVehicle({ id: action.id, refreshAccessToken, logout });
    if (!result.status) return false;

    let all = JSON.parse((await AsyncStorage.getItem('evaluations_actions')) || '[]');
    all = removeActionFromQueue(all, action);
    await AsyncStorage.setItem('evaluations_actions', JSON.stringify(all));

    const cacheStr = await AsyncStorage.getItem('evaluations_cache');
    if (cacheStr) {
      const cache = JSON.parse(cacheStr);
      const updatedCache = cache.filter(
        (item: any) =>
          !(
            item.type === 'corporate_vehicle' &&
            (String(item.id) === String(action.id) || String(item.id_local) === String(action.id))
          )
      );
      await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
    }

    await removeCorporateVehicleFromMainStructureEverywhere({
      vehicleId: vid > 0 ? vid : action.id,
      sucursalIdHint: sidHintBeforeCaches ?? null,
    });
    await removeVehicleFromCorpoCache({ id: action.id });
    return true;
  }

  if (action.action === 'delete' && action.type === 'corporate_vehicle_use') {
    const { deleteCorporateVehicleUse } = await import('@/hooks/evaluationFunctions');
    let useId: string | number = action.id;
    const isLocalUse = String(useId).startsWith('local-');
    const payload = action.payload || {};

    if (isLocalUse) {
      let all = JSON.parse((await AsyncStorage.getItem('evaluations_actions')) || '[]');
      all = all.filter(
        (a: any) =>
          !(
            (a.id === action.id && a.action === 'delete' && a.type === 'corporate_vehicle_use') ||
            (a.id === action.id && a.type === 'corporate_vehicle_use')
          )
      );
      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(all));

      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
      if (cacheStr) {
        const cache = JSON.parse(cacheStr);
        const updatedCache = cache.map((item: any) => {
          if (item.type !== 'corporate_vehicle') return item;
          const usos = Array.isArray(item.usos) ? item.usos : [];
          const nextUsos = usos.filter(
            (u: any) => String(u.id) !== String(useId) && String(u.id_local) !== String(useId)
          );
          return { ...item, usos: nextUsos, c_usos_vehiculos_corporativos: nextUsos };
        });
        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
      }
      const pvid = payload.vehiculo_id;
      const vehNum =
        typeof pvid === 'number'
          ? pvid
          : !String(pvid || '').startsWith('local-')
            ? Number(pvid)
            : null;
      if (vehNum) {
        await removeMainStructureUso(vehNum, useId);
        const sid = await resolveSucursalIdForVehiculo(vehNum);
        if (sid) await refreshCorpoCacheVehicleRowFromMainStructure(sid, vehNum);
      }
      return true;
    }

    const result = await deleteCorporateVehicleUse({
      use_id: String(useId),
      refreshAccessToken,
      logout,
    });
    if (!result.status) return false;

    let all = JSON.parse((await AsyncStorage.getItem('evaluations_actions')) || '[]');
    all = removeActionFromQueue(all, action);
    await AsyncStorage.setItem('evaluations_actions', JSON.stringify(all));

    const cacheStr = await AsyncStorage.getItem('evaluations_cache');
    let vehiculoIdNum: number | null = null;
    if (cacheStr) {
      const cache = JSON.parse(cacheStr);
      const updatedCache = cache.map((item: any) => {
        if (item.type !== 'corporate_vehicle') return item;
        const usos = Array.isArray(item.usos) ? item.usos : [];
        const hit = usos.find((u: any) => String(u.id) === String(useId));
        if (hit?.vehiculo_id) vehiculoIdNum = Number(hit.vehiculo_id);
        const nextUsos = usos.filter((u: any) => String(u.id) !== String(useId));
        return { ...item, usos: nextUsos, c_usos_vehiculos_corporativos: nextUsos };
      });
      await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
    }
    const vid = vehiculoIdNum || Number(payload.vehiculo_id) || null;
    if (vid) {
      await removeMainStructureUso(vid, useId);
      const sid = await resolveSucursalIdForVehiculo(vid);
      if (sid) await refreshCorpoCacheVehicleRowFromMainStructure(sid, vid);
    }
    return true;
  }

  if (action.action === 'delete' && action.type === 'corporate_vehicle_maintenance') {
    const { deleteCorporateVehicleMaintenance } = await import('@/hooks/evaluationFunctions');
    let maintenanceId = String(action.id || '');
    const payload = action.payload || {};

    if (maintenanceId.startsWith('local-')) {
      let all = JSON.parse((await AsyncStorage.getItem('evaluations_actions')) || '[]');
      all = all.filter(
        (a: any) =>
          !(
            (a.id === action.id && a.action === 'delete' && a.type === 'corporate_vehicle_maintenance') ||
            (a.id === action.id && a.type === 'corporate_vehicle_maintenance')
          )
      );
      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(all));

      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
      if (cacheStr) {
        const cache = JSON.parse(cacheStr);
        const updatedCache = cache.map((item: any) => {
          if (item.type !== 'corporate_vehicle') return item;
          const mants = Array.isArray(item.mantenimientos) ? item.mantenimientos : [];
          const nextM = mants.filter(
            (m: any) => String(m.id) !== maintenanceId && String(m.id_local) !== maintenanceId
          );
          return {
            ...item,
            mantenimientos: nextM,
            c_mantenimiento_vehiculos_corporativos: nextM,
          };
        });
        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
      }
      const pvid = payload.vehiculo_id;
      const vehNum =
        typeof pvid === 'number'
          ? pvid
          : !String(pvid || '').startsWith('local-')
            ? Number(pvid)
            : null;
      if (vehNum) {
        await removeMainStructureMantenimiento(vehNum, maintenanceId);
        const sid = await resolveSucursalIdForVehiculo(vehNum);
        if (sid) await refreshCorpoCacheVehicleRowFromMainStructure(sid, vehNum);
      }
      return true;
    }

    const result = await deleteCorporateVehicleMaintenance({
      maintenance_id: maintenanceId,
      refreshAccessToken,
      logout,
    });
    if (!result.status) return false;

    let all = JSON.parse((await AsyncStorage.getItem('evaluations_actions')) || '[]');
    all = removeActionFromQueue(all, action);
    await AsyncStorage.setItem('evaluations_actions', JSON.stringify(all));

    const cacheStr = await AsyncStorage.getItem('evaluations_cache');
    let vehiculoIdNum: number | null = null;
    if (cacheStr) {
      const cache = JSON.parse(cacheStr);
      const updatedCache = cache.map((item: any) => {
        if (item.type !== 'corporate_vehicle') return item;
        const mants = Array.isArray(item.mantenimientos) ? item.mantenimientos : [];
        const hit = mants.find((m: any) => String(m.id) === maintenanceId);
        if (hit?.vehiculo_id) vehiculoIdNum = Number(hit.vehiculo_id);
        const nextM = mants.filter((m: any) => String(m.id) !== maintenanceId);
        return {
          ...item,
          mantenimientos: nextM,
          c_mantenimiento_vehiculos_corporativos: nextM,
        };
      });
      await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
    }

    const vid = vehiculoIdNum || Number(payload.vehiculo_id) || null;
    if (vid) {
      await removeMainStructureMantenimiento(vid, maintenanceId);
      const sid = await resolveSucursalIdForVehiculo(vid);
      if (sid) await refreshCorpoCacheVehicleRowFromMainStructure(sid, vid);
    }
    return true;
  }

  return false;
}
