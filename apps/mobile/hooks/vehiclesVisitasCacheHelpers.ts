import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import authedFetch from '@/hooks/authedFetch';

const VEHICLES_CACHE_KEY = 'vehicles_cache';

export type VehicleVisitasCacheRow = {
  id: number;
  corpo_id?: number;
  puesto_id?: number;
  empresa_id?: number;
  cliente_id?: number;
  division_id?: number;
  contrato_id?: number;
  id_local?: string;
  base64_image?: string;
  file_name?: string | null;
  /** Nombre de archivo en `Paths.document` (expo `fileStorage`) pendiente de subir */
  local_attachment_file?: string | null;
  isActive?: boolean;
};

export function getVehicleVisitasCorpoId(v: VehicleVisitasCacheRow): number | null {
  if (v.corpo_id != null && !Number.isNaN(Number(v.corpo_id))) {
    return Number(v.corpo_id);
  }
  return null;
}

function isVehicleVisitasLocalPending(v: VehicleVisitasCacheRow): boolean {
  return v.id === 0 && Boolean(v.id_local);
}

/**
 * Reemplaza en `vehicles_cache` solo las visitas sincronizadas de la sucursal;
 * conserva borradores locales (`id === 0` + `id_local`) y el resto de sucursales.
 */
export function mergeVehiclesVisitasCacheForCorpo<T extends VehicleVisitasCacheRow>(
  existing: T[],
  freshForCorpo: T[],
  corpoId: number
): T[] {
  const normalizedFresh = freshForCorpo.map((t) => ({
    ...t,
    corpo_id: t.corpo_id ?? corpoId,
  })) as T[];
  const others = existing.filter((t) => getVehicleVisitasCorpoId(t) !== corpoId);
  const sameCorpoPending = existing.filter(
    (t) => getVehicleVisitasCorpoId(t) === corpoId && isVehicleVisitasLocalPending(t)
  );
  return [...others, ...normalizedFresh, ...sameCorpoPending];
}

export function filterVehiclesVisitasCacheForCorpo<T extends VehicleVisitasCacheRow>(
  list: T[],
  corpoId: number
): T[] {
  return list.filter((t) => getVehicleVisitasCorpoId(t) === corpoId);
}

export async function readVehiclesVisitasCacheRaw(): Promise<VehicleVisitasCacheRow[]> {
  const raw = await AsyncStorage.getItem(VEHICLES_CACHE_KEY);
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

export async function writeVehiclesVisitasCache(rows: VehicleVisitasCacheRow[]): Promise<void> {
  await AsyncStorage.setItem(VEHICLES_CACHE_KEY, JSON.stringify(rows));
}

/** Tras POST exitoso al sincronizar un borrador local (`id === 0` + `id_local`). */
export async function patchVehicleVisitasLocalCreateWithServerId(
  localActionId: string,
  serverId: number
): Promise<void> {
  const prev = await readVehiclesVisitasCacheRaw();
  const next = prev.map((r) => {
    if (r.id === 0 && String(r.id_local || '') === String(localActionId)) {
      return {
        ...r,
        id: serverId,
        id_local: '',
        local_attachment_file: null,
        isActive: true,
      };
    }
    return r;
  });
  await writeVehiclesVisitasCache(next);
}

export async function stripVehicleVisitasAttachmentForRow(vehicleId: number, idLocal: string): Promise<void> {
  const prev = await readVehiclesVisitasCacheRaw();
  const next = prev.map((r) => {
    const hitLocal = idLocal !== '' && String(r.id_local || '') === String(idLocal);
    const hitServer =
      idLocal === '' &&
      Number(vehicleId) > 0 &&
      Number(r.id) === Number(vehicleId);
    if (!hitLocal && !hitServer) return r;
    return {
      ...r,
      file_name: null,
      base64_image: '',
      local_attachment_file: null,
    };
  });
  await writeVehiclesVisitasCache(next);
}

export type SyncVehiclesVisitasResult =
  | { ok: true }
  | { ok: false; message?: string };

/** GET `/api/vehicles` con marca + sucursal y fusiona `vehicles_cache` por `corpoId`. */
export async function syncVehiclesVisitasCacheFromNetwork(params: {
  marcaId: number;
  corpoId: number;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}): Promise<SyncVehiclesVisitasResult> {
  const { marcaId, corpoId, refreshAccessToken, logout } = params;
  if (!Number.isFinite(marcaId) || marcaId <= 0 || !Number.isFinite(corpoId) || corpoId <= 0) {
    return { ok: false, message: 'Marca o sucursal no válidas' };
  }
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) {
    return { ok: false, message: 'Server URL not configured' };
  }
  const response = await authedFetch({
    url: `${apiUrl}/api/vehicles?m=${marcaId}&corpo_id=${corpoId}`,
    init: {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    },
    refreshAccessToken,
    logout,
  });
  if (!response) {
    return { ok: false, message: 'Sesión expirada' };
  }
  if (!response.ok) {
    return { ok: false, message: `HTTP ${response.status}` };
  }
  const data = await response.json().catch(() => ({}));
  if (!data?.status || !Array.isArray(data.data)) {
    return { ok: false, message: data?.message || 'Respuesta inválida' };
  }
  const fresh = (data.data as VehicleVisitasCacheRow[]).filter((row) => row?.isActive !== false);
  const prev = await readVehiclesVisitasCacheRaw();
  const merged = mergeVehiclesVisitasCacheForCorpo(prev, fresh, corpoId);
  await AsyncStorage.setItem(VEHICLES_CACHE_KEY, JSON.stringify(merged));
  return { ok: true };
}
