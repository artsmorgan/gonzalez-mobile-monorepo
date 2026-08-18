import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import authedFetch from './authedFetch';
import { eventBus } from './eventBus';

export const MODULES_RELEASE_UPDATED_EVENT = 'modulesReleaseUpdated';
export const MODULES_RELEASE_STORAGE_KEY = 'modules_release';

export type ModulesReleaseResult = {
  status: boolean;
  modules?: unknown[];
  message?: string;
  expired?: boolean;
};

type GetModulesReleaseParams = {
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<unknown>;
};

/**
 * Obtiene la visibilidad de módulos desde `/api/modules-release`.
 */
export default async function getModulesRelease({
  refreshAccessToken,
  logout,
}: GetModulesReleaseParams): Promise<ModulesReleaseResult> {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    const response = await authedFetch({
      url: `${String(apiUrl).replace(/\/+$/, '')}/api/modules-release`,
      init: {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      refreshAccessToken,
      logout,
    });

    if (!response) {
      return { status: false, message: 'Sesión expirada' };
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        status: false,
        message: String(data?.message || `HTTP error! status: ${response.status}`),
        expired: Boolean(data?.expired),
      };
    }

    return {
      status: Boolean(data?.status),
      modules: Array.isArray(data?.modules) ? data.modules : [],
      message: data?.message,
    };
  } catch (error) {
    console.error('Error fetching modules release:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al obtener módulos liberados',
    };
  }
}

export async function readModulesReleaseFromStorage(): Promise<any[]> {
  try {
    const raw = await AsyncStorage.getItem(MODULES_RELEASE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function persistModulesReleaseToStorage(modules: unknown[]): Promise<void> {
  const normalized = Array.isArray(modules) ? modules : [];
  await AsyncStorage.setItem(MODULES_RELEASE_STORAGE_KEY, JSON.stringify(normalized));
  eventBus.emit(MODULES_RELEASE_UPDATED_EVENT, normalized);
}

export async function fetchAndPersistModulesRelease(
  params: GetModulesReleaseParams
): Promise<ModulesReleaseResult> {
  const result = await getModulesRelease(params);
  if (result.status) {
    await persistModulesReleaseToStorage(result.modules || []);
  }
  return result;
}
