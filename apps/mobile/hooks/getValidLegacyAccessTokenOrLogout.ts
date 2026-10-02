import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import getHoraAccion from './getHoraAccion';
import { AUTH_STORAGE_KEYS } from './authTokenStorage';
import { getLegacyTokenLifetimeMinutes } from './authMode';
import { refreshLegacyAccessToken } from './legacyAccessTokenRefresh';

type Args = {
  logout: () => Promise<unknown>;
};

const getConnectionStatus = async (): Promise<boolean> => {
  const networkState = await Network.getNetworkStateAsync();
  return networkState.isConnected === true && networkState.isInternetReachable === true;
};

/** Preflight sesión legacy (JWT propio + refresh_token). */
export async function getValidLegacyAccessTokenOrLogout({
  logout,
}: Args): Promise<string | null> {
  const isConnected = await getConnectionStatus();
  if (!isConnected) {
    return AsyncStorage.getItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN);
  }

  const [storedAccess, storedRefresh, storedCreatedAt] = await Promise.all([
    AsyncStorage.getItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN),
    AsyncStorage.getItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN),
    AsyncStorage.getItem(AUTH_STORAGE_KEYS.TOKEN_CREATED_AT),
  ]);

  if (!storedAccess || !storedRefresh || !storedCreatedAt) {
    await logout();
    return null;
  }

  const lifetimeMs = getLegacyTokenLifetimeMinutes() * 60 * 1000;
  const createdAtNum = parseInt(String(storedCreatedAt), 10);
  if (!Number.isFinite(createdAtNum)) {
    await logout();
    return null;
  }

  let shouldRefresh = false;
  try {
    const horaAccion = await getHoraAccion();
    shouldRefresh = horaAccion > createdAtNum + lifetimeMs;
  } catch {
    shouldRefresh = true;
  }

  if (shouldRefresh) {
    const refreshed = await refreshLegacyAccessToken();
    if (!refreshed) {
      await logout();
      return null;
    }
  }

  const [nextAccess, nextRefresh, nextCreatedAt] = await Promise.all([
    AsyncStorage.getItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN),
    AsyncStorage.getItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN),
    AsyncStorage.getItem(AUTH_STORAGE_KEYS.TOKEN_CREATED_AT),
  ]);

  if (!nextAccess || !nextRefresh || !nextCreatedAt) {
    await logout();
    return null;
  }

  return nextAccess;
}
