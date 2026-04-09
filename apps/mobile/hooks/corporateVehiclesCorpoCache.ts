import AsyncStorage from '@react-native-async-storage/async-storage';

export const CORPORATE_VEHICLES_CORPO_CACHE_KEY = 'corporate_vehicles_corpo_cache';

/** `current_marca` incluye `corpo.id` (sucursal del día). Ver MarcarIngresoSalidaScreen. */
export async function getCurrentMarcaCorpoId(): Promise<number | null> {
  const raw = await AsyncStorage.getItem('current_marca');
  if (!raw) return null;
  try {
    const m = JSON.parse(raw);
    const id = m?.corpo?.id ?? m?.corpo_id;
    if (id === undefined || id === null || id === '') return null;
    const n = Number(id);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function vehicleSucursalId(v: Record<string, any>): number {
  return Number(v?.corpo_id ?? v?.sucursal_id ?? 0);
}

async function readCache(): Promise<any[]> {
  const raw = await AsyncStorage.getItem(CORPORATE_VEHICLES_CORPO_CACHE_KEY);
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

async function writeCache(list: any[]) {
  await AsyncStorage.setItem(CORPORATE_VEHICLES_CORPO_CACHE_KEY, JSON.stringify(list));
}

function sameSucursalAsMarca(vehicleCorpoId: number, marcaCorpoId: number): boolean {
  return Number.isFinite(vehicleCorpoId) && Number.isFinite(marcaCorpoId) && vehicleCorpoId === marcaCorpoId;
}

/**
 * Inserta o actualiza un vehículo en `corporate_vehicles_corpo_cache` solo si su sucursal
 * coincide con `current_marca.corpo`.
 */
export async function upsertVehicleInCorpoCache(
  vehicle: Record<string, any>,
  opts?: { synced?: boolean }
): Promise<void> {
  const sid = vehicleSucursalId(vehicle);
  const marcaCorpo = await getCurrentMarcaCorpoId();
  if (marcaCorpo == null || !sameSucursalAsMarca(sid, marcaCorpo)) return;

  const synced = opts?.synced !== undefined ? opts.synced : vehicle.synced !== false;

  const list = await readCache();
  const id = vehicle.id;
  const idLocal = vehicle.id_local;

  const idx = list.findIndex((x: any) => {
    if (id != null && typeof id === 'number' && id > 0 && Number(x.id) === Number(id)) return true;
    if (idLocal != null && String(idLocal).trim() !== '' && String(x.id_local) === String(idLocal)) return true;
    if (typeof id === 'string' && id.startsWith('local-') && (String(x.id_local) === id || String(x.id) === id))
      return true;
    return false;
  });

  const normalized = {
    ...vehicle,
    corpo_id: sid,
    id_local: vehicle.id_local ?? '',
    synced,
  };

  if (idx >= 0) list[idx] = { ...list[idx], ...normalized };
  else list.push(normalized);

  await writeCache(list);
}

/** Quita el vehículo del caché por sucursal (solo si coincide con current_marca). */
export async function removeVehicleFromCorpoCache(params: { id?: number | string; id_local?: string }): Promise<void> {
  const marcaCorpo = await getCurrentMarcaCorpoId();
  if (marcaCorpo == null) return;

  const list = await readCache();
  const next = list.filter((x: any) => {
    const xsid = vehicleSucursalId(x);
    if (!sameSucursalAsMarca(xsid, marcaCorpo)) return true;

    if (params.id != null && params.id !== '') {
      const idStr = String(params.id);
      if (!idStr.startsWith('local-') && Number(x.id) === Number(params.id)) return false;
      if (idStr.startsWith('local-') && (String(x.id_local) === idStr || String(x.id) === idStr)) return false;
    }
    if (params.id_local != null && String(params.id_local) !== '') {
      if (String(x.id_local) === String(params.id_local)) return false;
    }
    return true;
  });

  if (next.length !== list.length) await writeCache(next);
}

/** Actualiza la lista de usos de un vehículo en el caché (misma sucursal que la marca). */
export async function setVehicleUsosInCorpoCache(vehicleKey: string, usos: any[]): Promise<void> {
  const marcaCorpo = await getCurrentMarcaCorpoId();
  if (marcaCorpo == null) return;

  const list = await readCache();
  let changed = false;
  const next = list.map((x: any) => {
    const xsid = vehicleSucursalId(x);
    if (!sameSucursalAsMarca(xsid, marcaCorpo)) return x;
    const key = String(x.id ?? x.id_local);
    if (key !== vehicleKey) return x;
    changed = true;
    return { ...x, usos, c_usos_vehiculos_corporativos: usos };
  });

  if (changed) await writeCache(next);
}

/**
 * Tras crear la bitácora en servidor, marca `bitacora_id` (y opcionalmente `bitacora`) en el uso
 * dentro de `corporate_vehicles_corpo_cache`. Filtra por sucursal y id numérico de vehículo/uso.
 */
export async function setBitacoraIdOnVehicleUseInCorpoCache(params: {
  corpoId: number;
  vehiculoId: number;
  usoId: number;
  bitacoraId: number;
  bitacora?: Record<string, unknown> | null;
}): Promise<void> {
  const { corpoId, vehiculoId, usoId, bitacoraId, bitacora } = params;
  if (!Number.isFinite(corpoId) || corpoId <= 0) return;
  if (!Number.isFinite(vehiculoId) || vehiculoId <= 0) return;
  if (!Number.isFinite(usoId) || usoId <= 0) return;
  if (!Number.isFinite(bitacoraId) || bitacoraId <= 0) return;

  const list = await readCache();
  let changed = false;
  const next = list.map((v: any) => {
    const sid = vehicleSucursalId(v);
    if (Number(sid) !== Number(corpoId)) return v;
    if (Number(v?.id) !== Number(vehiculoId)) return v;
    const usos = [...(v.usos || v.c_usos_vehiculos_corporativos || [])];
    const ui = usos.findIndex((u: any) => Number(u?.id) === Number(usoId));
    if (ui < 0) return v;
    changed = true;
    const snap = bitacora && typeof bitacora === 'object' ? { ...bitacora, id: bitacoraId } : { id: bitacoraId };
    usos[ui] = {
      ...usos[ui],
      bitacora_id: bitacoraId,
      bitacora: snap,
    };
    return { ...v, usos, c_usos_vehiculos_corporativos: usos };
  });

  if (changed) await writeCache(next);
}

/**
 * Tras listar por API: conserva vehículos de otras sucursales y borradores locales de esta sucursal;
 * sustituye en caché los sincronizados de `sucursalId` por la respuesta del servidor.
 */
export async function mergeCorporateVehiclesCorpoCacheForSucursal(
  sucursalId: number,
  serverItems: Record<string, any>[]
): Promise<void> {
  if (!Number.isFinite(sucursalId) || sucursalId <= 0) return;

  const list = await readCache();
  const sid = Number(sucursalId);

  const isLocalPending = (v: any) =>
    !v?.synced ||
    String(v?.id_local || '').startsWith('local-') ||
    (typeof v?.id === 'string' && String(v.id).startsWith('local-'));

  const others = list.filter((v: any) => vehicleSucursalId(v) !== sid);
  const sameBranch = list.filter((v: any) => vehicleSucursalId(v) === sid);
  const localOnly = sameBranch.filter(isLocalPending);

  const merged = [
    ...localOnly,
    ...serverItems.map((v: any) => ({
      ...v,
      corpo_id: Number(v.corpo_id ?? v.sucursal_id ?? sid),
      synced: true,
    })),
  ];

  await writeCache([...others, ...merged]);
}
