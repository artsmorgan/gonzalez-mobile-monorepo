import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import authedFetch from '@/hooks/authedFetch';

const VISITORS_CACHE_KEY = 'visitors_cache';

export type VisitorCacheRow = {
  id: number;
  corpo_id?: number;
  id_local?: string;
};

export function getVisitorCorpoId(v: VisitorCacheRow): number | null {
  if (v.corpo_id != null && !Number.isNaN(Number(v.corpo_id))) {
    return Number(v.corpo_id);
  }
  return null;
}

function isVisitorLocalPending(v: VisitorCacheRow): boolean {
  return v.id === 0 && Boolean(v.id_local);
}

/** Fusiona `visitors_cache` solo para la sucursal `corpoId`; conserva borradores locales y otras sucursales. */
export function mergeVisitorsCacheForCorpo<T extends VisitorCacheRow>(
  existing: T[],
  freshForCorpo: T[],
  corpoId: number
): T[] {
  const normalizedFresh = freshForCorpo.map((t) => ({
    ...t,
    corpo_id: t.corpo_id ?? corpoId,
  })) as T[];
  const others = existing.filter((t) => getVisitorCorpoId(t) !== corpoId);
  const sameCorpoPending = existing.filter(
    (t) => getVisitorCorpoId(t) === corpoId && isVisitorLocalPending(t)
  );
  return [...others, ...normalizedFresh, ...sameCorpoPending];
}

export function filterVisitorsCacheForCorpo<T extends VisitorCacheRow>(
  list: T[],
  corpoId: number
): T[] {
  return list.filter((t) => getVisitorCorpoId(t) === corpoId);
}

export async function readVisitorsCacheRaw(): Promise<VisitorCacheRow[]> {
  const raw = await AsyncStorage.getItem(VISITORS_CACHE_KEY);
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

export type SyncVisitorsCacheResult = { ok: true } | { ok: false; message?: string };

export async function syncVisitorsCacheFromNetwork(params: {
  marcaId: number;
  corpoId: number;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}): Promise<SyncVisitorsCacheResult> {
  const { marcaId, corpoId, refreshAccessToken, logout } = params;
  if (!Number.isFinite(marcaId) || marcaId <= 0 || !Number.isFinite(corpoId) || corpoId <= 0) {
    return { ok: false, message: 'Marca o sucursal no válidas' };
  }
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) {
    return { ok: false, message: 'Server URL not configured' };
  }
  const response = await authedFetch({
    url: `${apiUrl}/api/visitors?m=${marcaId}&corpo_id=${corpoId}`,
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
  const prev = await readVisitorsCacheRaw();
  const merged = mergeVisitorsCacheForCorpo(prev, data.data, corpoId);
  await AsyncStorage.setItem(VISITORS_CACHE_KEY, JSON.stringify(merged));
  return { ok: true };
}
