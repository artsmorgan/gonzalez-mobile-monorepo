import AsyncStorage from '@react-native-async-storage/async-storage';
import { setBitacoraIdOnVehicleUseInCorpoCache } from './corporateVehiclesCorpoCache';
import type {
  CorporateVehicleMaintenanceRequest,
  CorporateVehicleUseRequest,
} from './evaluationFunctions';

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
  const actionRank = (a: string) => (a === 'create' ? 0 : a === 'update' ? 1 : a === 'delete' ? 2 : 3);
  return [...actions].sort((a, b) => {
    const ar = actionRank(a.action);
    const br = actionRank(b.action);
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

export async function patchPendingCorporateChildrenVehiculoId(vehicleLocalKey: string, serverVehiculoId: number) {
  const raw = await AsyncStorage.getItem('evaluations_actions');
  if (!raw) return;
  const list = JSON.parse(raw);
  const next = list.map((a: any) => {
    if (a.action !== 'create') return a;
    if (a.type !== 'corporate_vehicle_use' && a.type !== 'corporate_vehicle_maintenance') return a;
    const p = { ...(a.payload || {}) };
    const link =
      (p.vehiculo_id_local != null && String(p.vehiculo_id_local).trim() !== '' && String(p.vehiculo_id_local)) ||
      (String(p.vehiculo_id ?? '').startsWith('local-') ? String(p.vehiculo_id) : '');
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
    const keyStr =
      p.vehiculo_id_local != null && String(p.vehiculo_id_local).trim() !== ''
        ? String(p.vehiculo_id_local)
        : p.vehiculo_id != null && String(p.vehiculo_id).startsWith('local-')
          ? String(p.vehiculo_id)
          : '';
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
    const keyStr =
      p.uso_id_local != null && String(p.uso_id_local).trim() !== ''
        ? String(p.uso_id_local)
        : p.uso_id != null && String(p.uso_id).startsWith('local-')
          ? String(p.uso_id)
          : '';
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
  const mainRaw = await AsyncStorage.getItem('main_structure_cache');
  if (mainRaw) {
    const tree = JSON.parse(mainRaw);
    if (Array.isArray(tree)) {
      const sid = findSucursalIdForVehiculoInMainStructure(tree, vehiculoId);
      if (sid) return sid;
    }
  }
  const cacheStr = await AsyncStorage.getItem('evaluations_cache');
  if (!cacheStr) return null;
  const cache = JSON.parse(cacheStr);
  const found = cache.find(
    (item: any) => item.type === 'corporate_vehicle' && Number(item.id) === Number(vehiculoId)
  );
  if (found?.corpo_id != null) return Number(found.corpo_id);
  return null;
}

async function saveMainStructureIfChanged(tree: any[], changed: boolean) {
  if (changed) await AsyncStorage.setItem('main_structure_cache', JSON.stringify(tree));
}

/** Prioriza datos base del vehículo; conserva usos/mantenimientos salvo que vengan en layer. */
async function upsertMainStructureVehicle(
  sucursalId: number,
  vehiculoServerId: number,
  vehicleLayer: Record<string, any>,
  matchLocalId?: string | null
) {
  const raw = await AsyncStorage.getItem('main_structure_cache');
  if (!raw) return;
  const tree = JSON.parse(raw);
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
              vehiculos.push({
                ...vehicleLayer,
                id: vehiculoServerId,
                corpo_id: vehicleLayer.corpo_id ?? sucursalId,
                sucursal_id: vehicleLayer.sucursal_id ?? sucursalId,
                usos: Array.isArray(usosFromLayer) ? usosFromLayer : [],
                c_usos_vehiculos_corporativos: Array.isArray(usosFromLayer) ? usosFromLayer : [],
                mantenimientos: Array.isArray(mantsFromLayer) ? mantsFromLayer : [],
                c_mantenimiento_vehiculos_corporativos: Array.isArray(mantsFromLayer) ? mantsFromLayer : [],
              });
            } else {
              const cur = vehiculos[idx];
              const keepUsos = Array.isArray(usosFromLayer)
                ? usosFromLayer
                : cur.usos ?? cur.c_usos_vehiculos_corporativos ?? [];
              const keepMants = Array.isArray(mantsFromLayer)
                ? mantsFromLayer
                : cur.mantenimientos ?? cur.c_mantenimiento_vehiculos_corporativos ?? [];
              vehiculos[idx] = {
                ...cur,
                ...vehicleLayer,
                id: vehiculoServerId,
                usos: keepUsos,
                c_usos_vehiculos_corporativos: keepUsos,
                mantenimientos: keepMants,
                c_mantenimiento_vehiculos_corporativos: keepMants,
              };
              delete vehiculos[idx].id_local;
            }
            sucursal[key] = vehiculos;
            changed = true;
          }
        }
      }
    }
  }
  await saveMainStructureIfChanged(tree, changed);
}

async function mergeMainStructureUso(
  sucursalId: number,
  vehiculoId: number,
  usoMerged: Record<string, any>,
  matchLocalOrActionId?: string | null
) {
  const raw = await AsyncStorage.getItem('main_structure_cache');
  if (!raw) return;
  const tree = JSON.parse(raw);
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
            vehiculos[vi] = v;
            sucursal[key] = vehiculos;
            changed = true;
          }
        }
      }
    }
  }
  await saveMainStructureIfChanged(tree, changed);
}

async function mergeMainStructureMantenimiento(
  sucursalId: number,
  vehiculoId: number,
  mantMerged: Record<string, any>,
  matchLocalOrActionId?: string | null
) {
  const raw = await AsyncStorage.getItem('main_structure_cache');
  if (!raw) return;
  const tree = JSON.parse(raw);
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
            v.mantenimientos = mants;
            v.c_mantenimiento_vehiculos_corporativos = mants;
            vehiculos[vi] = v;
            sucursal[key] = vehiculos;
            changed = true;
          }
        }
      }
    }
  }
  await saveMainStructureIfChanged(tree, changed);
}

async function removeMainStructureVehiculo(sucursalId: number | null, vehiculoId: number, idLocalFallback?: string | null) {
  const raw = await AsyncStorage.getItem('main_structure_cache');
  if (!raw) return;
  const tree = JSON.parse(raw);
  if (!Array.isArray(tree)) return;
  let changed = false;

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
            }
          }
        }
      }
    }
  }
  await saveMainStructureIfChanged(tree, changed);
}

async function removeMainStructureUso(vehiculoId: number, useKey: string | number) {
  const raw = await AsyncStorage.getItem('main_structure_cache');
  if (!raw) return;
  const tree = JSON.parse(raw);
  if (!Array.isArray(tree)) return;
  let changed = false;
  const sk = String(useKey);

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
              if (Number(v?.id) !== Number(vehiculoId)) return v;
              const usos = [...(v.usos || v.c_usos_vehiculos_corporativos || [])].filter(
                (u: any) => String(u.id) !== sk && String(u.id_local) !== sk
              );
              if (usos.length !== (v.usos || v.c_usos_vehiculos_corporativos || []).length) touched = true;
              return {
                ...v,
                usos,
                c_usos_vehiculos_corporativos: usos,
              };
            });
            if (touched) {
              sucursal[key] = nextVeh;
              changed = true;
            }
          }
        }
      }
    }
  }
  await saveMainStructureIfChanged(tree, changed);
}

async function removeMainStructureMantenimiento(vehiculoId: number, mantKey: string | number) {
  const raw = await AsyncStorage.getItem('main_structure_cache');
  if (!raw) return;
  const tree = JSON.parse(raw);
  if (!Array.isArray(tree)) return;
  let changed = false;
  const sk = String(mantKey);

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
              if (Number(v?.id) !== Number(vehiculoId)) return v;
              const mants = [...(v.mantenimientos || v.c_mantenimiento_vehiculos_corporativos || [])].filter(
                (m: any) => String(m.id) !== sk && String(m.id_local) !== sk
              );
              if (mants.length !== (v.mantenimientos || v.c_mantenimiento_vehiculos_corporativos || []).length)
                touched = true;
              return {
                ...v,
                mantenimientos: mants,
                c_mantenimiento_vehiculos_corporativos: mants,
              };
            });
            if (touched) {
              sucursal[key] = nextVeh;
              changed = true;
            }
          }
        }
      }
    }
  }
  await saveMainStructureIfChanged(tree, changed);
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
    const cacheStr = await AsyncStorage.getItem('evaluations_cache');
    const cache = cacheStr ? JSON.parse(cacheStr) : [];
    const found = cache.find(
      (item: any) =>
        item.type === 'corporate_vehicle' &&
        (String(item.id_local) === String(vehiculoIdRaw) || String(item.id) === String(vehiculoIdRaw)) &&
        typeof item.id === 'number'
    );
    if (found?.id) vehiculoId = Number(found.id);
    else vehiculoId = 0;
  }
  return { vehiculoId: vehiculoId || null, rawVehiculo: vehiculoIdRaw };
}

function removeActionFromQueue(all: any[], action: any) {
  return all.filter(
    (a: any) => !(a.id === action.id && a.action === action.action && a.type === action.type)
  );
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
  if (raw != null && Number(raw) > 0 && !String(raw).startsWith('local-')) return Number(raw);
  const key = local != null && String(local).trim() !== '' ? String(local) : String(raw || '');
  if (!key || !String(key).startsWith('local-')) return null;
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
  if (raw != null && Number(raw) > 0 && !String(raw).startsWith('local-')) return Number(raw);
  const key = local != null && String(local).trim() !== '' ? String(local) : String(raw || '');
  if (!key || !String(key).startsWith('local-')) return null;
  if (!vehiculoServerId) return null;
  const cacheStr = await AsyncStorage.getItem('evaluations_cache');
  const cache = cacheStr ? JSON.parse(cacheStr) : [];
  const veh = cache.find(
    (item: any) => item.type === 'corporate_vehicle' && Number(item.id) === Number(vehiculoServerId)
  );
  if (!veh) return null;
  const usos = veh.usos || veh.c_usos_vehiculos_corporativos || [];
  const u = usos.find((x: any) => String(x.id_local) === key || String(x.id) === key);
  if (u && typeof u.id === 'number' && Number(u.id) > 0) return Number(u.id);
  return null;
}

async function processBitacoraVehiculoDetenidoCreates(deps: {
  refreshAccessToken: () => Promise<boolean>;
  logout: (...args: any[]) => any;
}): Promise<void> {
  const { refreshAccessToken, logout } = deps;
  const { createBitacoraVehiculoDetenido } = await import('@/hooks/bitacoraVehiculoDetenidoFunctions');

  for (let guard = 0; guard < 30; guard++) {
    const actionsStr = await AsyncStorage.getItem('evaluations_actions');
    const all: any[] = actionsStr ? JSON.parse(actionsStr) : [];
    const pending = all.filter(
      (a) => a.type === BITACORA_VEHICULO_DETENIDO_EVAL_TYPE && a.action === 'create'
    );
    if (pending.length === 0) break;

    let progressed = false;
    for (const action of pending) {
      const freshStr = await AsyncStorage.getItem('evaluations_actions');
      const fresh: any[] = freshStr ? JSON.parse(freshStr) : [];
      const stillThere = fresh.some(
        (a) => a.id === action.id && a.action === action.action && a.type === action.type
      );
      if (!stillThere) continue;

      const payload = JSON.parse(JSON.stringify(action.payload || {}));

      const vehKey =
        payload.vehiculo_id_local ||
        (payload.vehiculo_id != null && String(payload.vehiculo_id).startsWith('local-')
          ? String(payload.vehiculo_id)
          : null);

      let vId: number | null =
        payload.vehiculo_id != null &&
        Number(payload.vehiculo_id) > 0 &&
        !String(payload.vehiculo_id).startsWith('local-')
          ? Number(payload.vehiculo_id)
          : null;

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

      const usoKey =
        payload.uso_id_local ||
        (payload.uso_id != null && String(payload.uso_id).startsWith('local-') ? String(payload.uso_id) : null);

      let uId: number | null =
        payload.uso_id != null && Number(payload.uso_id) > 0 && !String(payload.uso_id).startsWith('local-')
          ? Number(payload.uso_id)
          : null;

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

        if (newId) {
          const cacheStr = await AsyncStorage.getItem('bitacora_vehiculo_detenido_cache');
          if (cacheStr) {
            const cache = JSON.parse(cacheStr);
            const updatedCache = cache.map((b: any) => {
              if (b.id_local && b.id_local === action.id) {
                return {
                  ...b,
                  id: newId,
                  id_local: '',
                  vehiculo_id: payload.vehiculo_id ?? b.vehiculo_id,
                  uso_id: payload.uso_id ?? b.uso_id,
                };
              }
              return b;
            });
            await AsyncStorage.setItem('bitacora_vehiculo_detenido_cache', JSON.stringify(updatedCache));
          }
        }

        if (newId && vId && uId && corpoId > 0) {
          await setBitacoraIdOnVehicleUseInCorpoCache({
            corpoId,
            vehiculoId: vId,
            usoId: uId,
            bitacoraId: newId,
            bitacora: { id: newId, tipo: payload.tipo },
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
        (a) => a.id === action.id && a.action === action.action && a.type === action.type
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

  await processBitacoraVehiculoDetenidoCreates({ refreshAccessToken, logout });
}

async function processOneCorporateAction(
  action: any,
  deps: { refreshAccessToken: () => Promise<boolean>; logout: (...args: any[]) => any }
): Promise<boolean> {
  const { refreshAccessToken, logout } = deps;

  if (action.action === 'create' && action.type === 'corporate_vehicle') {
    const { createCorporateVehicle } = await import('@/hooks/evaluationFunctions');
    const payload = { ...(action.payload || {}) };
    delete payload.id_local;
    const result = await createCorporateVehicle({ requestData: payload, refreshAccessToken, logout });
    if (!result.status) return false;

    const newId = Number(result.data?.id ?? 0);
    const corpoId = Number(payload.corpo_id ?? 0);

    let all = JSON.parse((await AsyncStorage.getItem('evaluations_actions')) || '[]');
    all = removeActionFromQueue(all, action);
    await AsyncStorage.setItem('evaluations_actions', JSON.stringify(all));

    if (newId && action.id) await patchPendingCorporateChildrenVehiculoId(String(action.id), newId);
    if (newId && action.id) await patchPendingBitacoraAfterVehicleVehiculoSync(String(action.id), newId);

    const cacheStr = await AsyncStorage.getItem('evaluations_cache');
    if (cacheStr) {
      const cache = JSON.parse(cacheStr);
      const updatedCache = cache.map((item: any) => {
        if (item.id_local === action.id && item.type === 'corporate_vehicle') {
          const nextItem = {
            ...item,
            synced: true,
            id: newId || item.id,
            images: result.data?.images || item.images || [],
          };
          delete (nextItem as any).id_local;
          return nextItem;
        }
        return item;
      });
      await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
    }

    if (corpoId && newId) {
      const vehicleLayer = {
        ...payload,
        ...result.data,
        id: newId,
        corpo_id: corpoId,
        synced: true,
      };
      delete (vehicleLayer as any).id_local;
      await upsertMainStructureVehicle(corpoId, newId, vehicleLayer, String(action.id));
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
    }
    return true;
  }

  if (action.action === 'create' && action.type === 'corporate_vehicle_maintenance') {
    const { createCorporateVehicleMaintenance } = await import('@/hooks/evaluationFunctions');
    const payload = action.payload || {};
    const { vehiculoId, rawVehiculo } = await resolveServerVehiculoIdFromPayload(payload);
    if (!vehiculoId) return false;

    const requestData = stripMaintenancePayloadForApi(payload);
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
    }
    return true;
  }

  if (action.action === 'update' && action.type === 'corporate_vehicle') {
    const { updateCorporateVehicle } = await import('@/hooks/evaluationFunctions');
    const result = await updateCorporateVehicle({
      id: action.id,
      requestData: action.payload,
      refreshAccessToken,
      logout,
    });
    if (!result.status) return false;

    let all = JSON.parse((await AsyncStorage.getItem('evaluations_actions')) || '[]');
    all = removeActionFromQueue(all, action);
    await AsyncStorage.setItem('evaluations_actions', JSON.stringify(all));

    const cacheStr = await AsyncStorage.getItem('evaluations_cache');
    let corpoFromCache: number | null = null;
    if (cacheStr) {
      const cache = JSON.parse(cacheStr);
      const updatedCache = cache.map((item: any) => {
        if (item.type !== 'corporate_vehicle') return item;
        if (String(item.id) === String(action.id) || String(item.id_local) === String(action.id)) {
          if (item.corpo_id != null && Number(item.corpo_id) > 0) corpoFromCache = Number(item.corpo_id);
          return {
            ...item,
            ...action.payload,
            synced: true,
            images: result.data?.images || item.images || [],
          };
        }
        return item;
      });
      await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
    }

    const vid = Number(action.id);
    const sid =
      (await resolveSucursalIdForVehiculo(vid)) ||
      (corpoFromCache && Number.isFinite(corpoFromCache) ? corpoFromCache : null);
    if (sid && vid) {
      const layer = { ...action.payload, id: vid, images: result.data?.images };
      await upsertMainStructureVehicle(sid, vid, layer, null);
    }
    return true;
  }

  if (action.action === 'update' && action.type === 'corporate_vehicle_use') {
    const { updateCorporateVehicleUse } = await import('@/hooks/evaluationFunctions');
    let useId: string | number = action.id;
    const isLocalUse = String(useId).startsWith('local-');
    const payload = action.payload || {};

    if (isLocalUse) {
      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
      const cache = cacheStr ? JSON.parse(cacheStr) : [];
      let foundServerUseId: number | null = null;
      for (const item of cache) {
        if (item.type !== 'corporate_vehicle') continue;
        const usos = Array.isArray(item.usos) ? item.usos : [];
        const foundUse = usos.find((u: any) => String(u.id_local) === String(useId) && typeof u.id === 'number');
        if (foundUse?.id) {
          foundServerUseId = Number(foundUse.id);
          break;
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
      }
    }
    return true;
  }

  if (action.action === 'update' && action.type === 'corporate_vehicle_maintenance') {
    const { updateCorporateVehicleMaintenance } = await import('@/hooks/evaluationFunctions');
    const payload = action.payload || {};
    let mid: string | number = action.id;
    if (String(mid).startsWith('local-')) {
      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
      const cache = cacheStr ? JSON.parse(cacheStr) : [];
      let found: number | null = null;
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
      if (!found) return false;
      mid = found;
    }
    const maintenanceId = String(mid);

    const requestData = stripMaintenancePayloadForApi(payload);
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
      if (sid)
        await mergeMainStructureMantenimiento(sid, vid, { ...requestData, id: maintenanceId }, String(action.id));
    }
    return true;
  }

  if (action.action === 'delete' && action.type === 'corporate_vehicle') {
    const { deleteCorporateVehicle } = await import('@/hooks/evaluationFunctions');
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

    const vid = Number(action.id);
    const sid = vid ? await resolveSucursalIdForVehiculo(vid) : null;
    await removeMainStructureVehiculo(sid, vid, String(action.id));
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
      if (vehNum) await removeMainStructureUso(vehNum, useId);
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
    if (vid) await removeMainStructureUso(vid, useId);
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
      if (vehNum) await removeMainStructureMantenimiento(vehNum, maintenanceId);
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
    if (vid) await removeMainStructureMantenimiento(vid, maintenanceId);
    return true;
  }

  return false;
}
