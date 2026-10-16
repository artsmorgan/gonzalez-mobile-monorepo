import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { AUTH_STORAGE_KEYS } from './authTokenStorage';

let refreshInFlight: Promise<boolean> | null = null;

async function parseJsonResponseSafe(response: Response): Promise<{ data: Record<string, unknown> | null; raw: string }> {
  const raw = await response.text();
  if (!raw || raw.trim().length === 0) {
    return { data: null, raw: '' };
  }
  try {
    return { data: JSON.parse(raw) as Record<string, unknown>, raw };
  } catch {
    return { data: null, raw };
  }
}

/** Renueva access_token legacy vía `/api/auth/refresh-token`. */
export async function refreshLegacyAccessToken(): Promise<boolean> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    try {
      const refreshToken = await AsyncStorage.getItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN);
      if (!refreshToken) {
        return false;
      }

      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) {
        return false;
      }

      const response = await fetch(`${apiUrl}/api/auth/refresh-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '69420',
        },
        body: JSON.stringify({
          refreshToken,
          deviceName: `${Device.brand}-${Device.modelName}`,
        }),
      });

      if (!response.ok) {
        return false;
      }

      const { data: responseData } = await parseJsonResponseSafe(response);
      if (!responseData?.status) {
        return false;
      }

      const newAccessToken = String(responseData.newAccessToken ?? '').trim();
      const newRefreshToken = String(responseData.newRefreshToken ?? refreshToken).trim();
      const newCreatedAt = Number(responseData.createdAt ?? Date.now());

      if (!newAccessToken) {
        return false;
      }

      await Promise.all([
        AsyncStorage.setItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN, newAccessToken),
        AsyncStorage.setItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN, newRefreshToken),
        AsyncStorage.setItem(AUTH_STORAGE_KEYS.TOKEN_CREATED_AT, String(newCreatedAt)),
      ]);

      return true;
    } catch (error) {
      console.error('refreshLegacyAccessToken error:', error);
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}
