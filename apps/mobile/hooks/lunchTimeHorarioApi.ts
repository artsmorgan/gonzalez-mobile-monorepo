import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import authedFetch from './authedFetch';
import { buildPlanillasTokenRequestHeaders, readStoredPlanillasToken } from './planillasTokenStorage';

export const LUNCH_TIME_HORARIO_ACTIONS_KEY = 'lunch_time_horario_actions';

type AuthHandlers = {
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<unknown>;
};

export type LunchMinutesServerResponse = {
  status: boolean;
  minutos: number;
  tiene_almuerzo: boolean;
};

export function isValidLunchMinutesValue(minutos: unknown): boolean {
  const n = Number(minutos);
  return Number.isFinite(n) && n > 0;
}

function getApiUrl(): string {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) throw new Error('Server URL not configured');
  return String(apiUrl);
}

/** Obtiene minutos de alimentación del horario vinculado a la marca (`GET /api/lunch-time/[marcaId]`). */
export async function fetchLunchMinutesByMarcaId(
  marcaId: number,
  auth: AuthHandlers,
): Promise<LunchMinutesServerResponse | null> {
  const response = await authedFetch({
    url: `${getApiUrl()}/api/lunch-time/${marcaId}`,
    init: {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    },
    refreshAccessToken: auth.refreshAccessToken,
    logout: auth.logout,
  });
  if (!response || !response.ok) return null;

  const data = await response.json().catch(() => null);
  if (!data || data.status !== true || !isValidLunchMinutesValue(data.minutos)) {
    return null;
  }

  return {
    status: true,
    minutos: Number(data.minutos),
    tiene_almuerzo: data.tiene_almuerzo != null ? Boolean(data.tiene_almuerzo) : true,
  };
}

/** Actualiza `c_horario.minutos_almuerzo` en servidor. */
export async function updateHorarioMinutosAlmuerzo(
  horarioId: number,
  minutos: number,
  auth: AuthHandlers,
  planillasTokenOverride?: string | null,
): Promise<{ status: boolean; message?: string }> {
  const storedPlanillas = await readStoredPlanillasToken();
  const planillasToken =
    String(planillasTokenOverride ?? '').trim() || storedPlanillas?.token || null;

  const response = await authedFetch({
    url: `${getApiUrl()}/api/lunch-time/horario/${horarioId}/minutos-almuerzo`,
    init: {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...buildPlanillasTokenRequestHeaders(planillasToken),
      },
      body: JSON.stringify({ minutos_almuerzo: minutos }),
    },
    refreshAccessToken: auth.refreshAccessToken,
    logout: auth.logout,
  });

  if (!response) {
    return { status: false, message: 'Sesión expirada' };
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.status !== true) {
    return { status: false, message: String(data.message ?? 'No se pudo actualizar los minutos de alimentación') };
  }

  return { status: true, message: String(data.message ?? 'Minutos actualizados') };
}

export type LunchHorarioAction = {
  id: string;
  type: 'update_minutos';
  horarioId: number;
  minutos: number;
  planillasToken?: string;
};

/** Cola offline: como máximo 1 acción; una nueva reemplaza a la anterior. */
export async function queueHorarioMinutosUpdateAction(
  horarioId: number,
  minutos: number,
  planillasToken?: string | null,
): Promise<void> {
  const token = String(planillasToken ?? '').trim();
  const action: LunchHorarioAction = {
    id: 'horario_minutos',
    type: 'update_minutos',
    horarioId,
    minutos,
    ...(token ? { planillasToken: token } : {}),
  };
  await AsyncStorage.setItem(LUNCH_TIME_HORARIO_ACTIONS_KEY, JSON.stringify([action]));
}

export async function readHorarioMinutosActions(): Promise<LunchHorarioAction[]> {
  const raw = await AsyncStorage.getItem(LUNCH_TIME_HORARIO_ACTIONS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LunchHorarioAction[]) : [];
  } catch {
    return [];
  }
}

export async function clearHorarioMinutosActions(): Promise<void> {
  await AsyncStorage.removeItem(LUNCH_TIME_HORARIO_ACTIONS_KEY);
}

export async function persistLocalLunchMinutesConfig(
  minutos: number,
  extra?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const stored = await AsyncStorage.getItem('lunch_time_config');
  let configObj: Record<string, unknown> = { status: true };
  if (stored) {
    try {
      configObj = JSON.parse(stored);
    } catch {
      configObj = { status: true };
    }
  }

  const updated = {
    ...configObj,
    ...extra,
    status: true,
    minutos,
  };
  await AsyncStorage.setItem('lunch_time_config', JSON.stringify(updated));
  return updated;
}

export function extractHorarioIdFromMarca(marca: Record<string, unknown> | null | undefined): number | null {
  const horario = marca?.horario as Record<string, unknown> | undefined;
  const raw = horario?.id ?? marca?.horario_id;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}
