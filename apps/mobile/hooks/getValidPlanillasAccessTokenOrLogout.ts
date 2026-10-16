import AsyncStorage from '@react-native-async-storage/async-storage';
import getHoraAccion from './getHoraAccion';
import {
  AUTH_STORAGE_KEYS,
  isOnlineForSessionEnforcement,
  isPlanillasSessionExpired,
} from './authTokenStorage';

type Args = {
  logout: () => Promise<unknown>;
};

async function readStoredSession(): Promise<{ token: string | null; createdAt: string | null }> {
  const [token, createdAt] = await Promise.all([
    AsyncStorage.getItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN),
    AsyncStorage.getItem(AUTH_STORAGE_KEYS.TOKEN_CREATED_AT),
  ]);
  return { token, createdAt };
}

async function isSessionExpiredNow(): Promise<boolean> {
  try {
    const horaAccion = await getHoraAccion();
    return isPlanillasSessionExpired(horaAccion);
  } catch {
    return isPlanillasSessionExpired();
  }
}

/** Preflight sesión Planillas (1h, sin renovación). */
export async function getValidPlanillasAccessTokenOrLogout({
  logout,
}: Args): Promise<string | null> {
  const { token, createdAt } = await readStoredSession();
  if (!token || !createdAt) {
    if (await isOnlineForSessionEnforcement()) {
      await logout();
    }
    return null;
  }

  const createdAtNum = parseInt(String(createdAt), 10);
  if (!Number.isFinite(createdAtNum)) {
    if (await isOnlineForSessionEnforcement()) {
      await logout();
    }
    return null;
  }

  const expired = await isSessionExpiredNow();
  const online = await isOnlineForSessionEnforcement();

  if (expired) {
    if (online) {
      await logout();
      return null;
    }
    return token;
  }

  return token;
}
