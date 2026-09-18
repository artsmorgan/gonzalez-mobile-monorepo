import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import getHoraAccion from './getHoraAccion';
import { resolveAppConnectivity } from './resolveAppConnectivity';

export type AuthSessionMode = 'planillas' | 'legacy';

export const AUTH_STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  TOKEN_CREATED_AT: 'token_created_at',
  PLANILLAS_TOKEN_EXPIRES_AT: 'planillas_token_expires_at',
  EMPLOYEE: 'employee_data',
  SESSION_MODE: 'auth_session_mode',
  /** Solo modo legacy (transición Fase 6). */
  REFRESH_TOKEN: 'refresh_token',
} as const;

export async function readStoredSessionMode(): Promise<AuthSessionMode> {
  const raw = await AsyncStorage.getItem(AUTH_STORAGE_KEYS.SESSION_MODE);
  if (raw === 'legacy' || raw === 'planillas') {
    return raw;
  }
  const refresh = await AsyncStorage.getItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN);
  if (refresh) {
    return 'legacy';
  }
  return 'planillas';
}

/** Si hay red útil para aplicar política de expiración (logout forzado). */
export async function isOnlineForSessionEnforcement(): Promise<boolean> {
  const connectivity = await resolveAppConnectivity();
  return connectivity.ok;
}

export function decodeJwtPayloadUnsafe(token: string): Record<string, unknown> | null {
  try {
    const segment = token.split('.')[1];
    if (!segment) return null;
    const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** sessionId para firmas: legacy UUID o username Planillas (cédula). */
export function getSignatureSessionIdFromToken(token: string): string {
  const payload = decodeJwtPayloadUnsafe(token);
  if (!payload) return 'unknown';
  const sessionId = String(payload.sessionId ?? '').trim();
  if (sessionId) return sessionId;
  const username = String(payload.username ?? '').trim();
  if (username) return username;
  return 'unknown';
}

type PlanillasSessionPayload = {
  planillasToken: string;
  createdAt: number;
  planillasTokenExpiresAt: number;
};

export function decodeJwtExpMs(token: string): number | null {
  try {
    const segment = token.split('.')[1];
    if (!segment) return null;
    const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    const exp = Number(payload?.exp);
    return Number.isFinite(exp) ? exp * 1000 : null;
  } catch {
    return null;
  }
}

export function getPlanillasSessionLifetimeMs(): number {
  const minutes = Number(Constants.expoConfig?.extra?.MINUTES_LIFE_TIME_TOKEN ?? 60);
  return minutes * 60 * 1000;
}

export async function readPlanillasSessionExpiryMs(): Promise<number | null> {
  const [expiresAtRaw, createdAtRaw] = await Promise.all([
    AsyncStorage.getItem(AUTH_STORAGE_KEYS.PLANILLAS_TOKEN_EXPIRES_AT),
    AsyncStorage.getItem(AUTH_STORAGE_KEYS.TOKEN_CREATED_AT),
  ]);

  // Misma escala que getHoraAccion() (no usar JWT exp: es UTC y no coincide).
  const expiresAtNum = parseInt(String(expiresAtRaw ?? ''), 10);
  if (Number.isFinite(expiresAtNum) && expiresAtNum > 0) {
    return expiresAtNum;
  }

  const createdAtNum = parseInt(String(createdAtRaw ?? ''), 10);
  if (Number.isFinite(createdAtNum) && createdAtNum > 0) {
    return createdAtNum + getPlanillasSessionLifetimeMs();
  }

  return null;
}

/** Compara vencimiento contra getHoraAccion() (hora de referencia de la app). */
export async function isPlanillasSessionExpired(referenceMs?: number): Promise<boolean> {
  const expiryMs = await readPlanillasSessionExpiryMs();
  if (expiryMs == null) return true;

  let nowMs = referenceMs;
  if (nowMs == null) {
    try {
      nowMs = await getHoraAccion();
    } catch {
      nowMs = new Date().getTime();
    }
  }

  return nowMs >= expiryMs;
}

export async function persistPlanillasSession({
  planillasToken,
  createdAt,
  planillasTokenExpiresAt,
}: PlanillasSessionPayload): Promise<void> {
  const expiresAt =
    Number.isFinite(planillasTokenExpiresAt) && planillasTokenExpiresAt > 0
      ? planillasTokenExpiresAt
      : createdAt + getPlanillasSessionLifetimeMs();

  await Promise.all([
    AsyncStorage.setItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN, planillasToken),
    AsyncStorage.setItem(AUTH_STORAGE_KEYS.TOKEN_CREATED_AT, String(createdAt)),
    AsyncStorage.setItem(AUTH_STORAGE_KEYS.PLANILLAS_TOKEN_EXPIRES_AT, String(expiresAt)),
    AsyncStorage.setItem(AUTH_STORAGE_KEYS.SESSION_MODE, 'planillas'),
    AsyncStorage.removeItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN),
  ]);
}

type LegacySessionPayload = {
  accessToken: string;
  refreshToken: string;
  createdAt: number;
};

export async function persistLegacySession({
  accessToken,
  refreshToken,
  createdAt,
}: LegacySessionPayload): Promise<void> {
  await Promise.all([
    AsyncStorage.setItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN, accessToken),
    AsyncStorage.setItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN, refreshToken),
    AsyncStorage.setItem(AUTH_STORAGE_KEYS.TOKEN_CREATED_AT, String(createdAt)),
    AsyncStorage.setItem(AUTH_STORAGE_KEYS.SESSION_MODE, 'legacy'),
    AsyncStorage.removeItem(AUTH_STORAGE_KEYS.PLANILLAS_TOKEN_EXPIRES_AT),
  ]);
}

export async function clearAuthStorage(): Promise<void> {
  // Solo credenciales de sesión; las colas offline (*_actions) se conservan para re-sync tras re-login.
  await Promise.all([
    AsyncStorage.removeItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN),
    AsyncStorage.removeItem(AUTH_STORAGE_KEYS.TOKEN_CREATED_AT),
    AsyncStorage.removeItem(AUTH_STORAGE_KEYS.PLANILLAS_TOKEN_EXPIRES_AT),
    AsyncStorage.removeItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN),
    AsyncStorage.removeItem(AUTH_STORAGE_KEYS.SESSION_MODE),
    AsyncStorage.removeItem(AUTH_STORAGE_KEYS.EMPLOYEE),
    AsyncStorage.removeItem('temp_state'),
  ]);
}
