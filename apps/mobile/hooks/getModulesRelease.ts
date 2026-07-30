import Constants from 'expo-constants';
import authedFetch from './authedFetch';

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
