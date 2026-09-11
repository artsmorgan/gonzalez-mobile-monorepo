import Constants from 'expo-constants';
import authedFetch from './authedFetch';
import {
  extractPlanillasTokenFromResponse,
  persistStoredPlanillasToken,
} from './planillasTokenStorage';

type RequestPlanillasTokenArgs = {
  password: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<unknown>;
};

type RequestPlanillasTokenResult =
  | { success: true }
  | { success: false; message: string };

export default async function requestPlanillasToken({
  password,
  refreshAccessToken,
  logout,
}: RequestPlanillasTokenArgs): Promise<RequestPlanillasTokenResult> {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) {
    return { success: false, message: 'Server URL not configured' };
  }

  try {
    const response = await authedFetch({
      url: `${apiUrl}/api/auth/planillas-token`,
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      },
      logout,
      refreshAccessToken,
    });

    if (!response) {
      return { success: false, message: 'Sesión expirada' };
    }

    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.status) {
      const message =
        data && typeof data === 'object' && 'message' in data
          ? String((data as { message?: string }).message || '')
          : '';
      return {
        success: false,
        message: message || 'No se pudo validar la contraseña de Planillas',
      };
    }

    const payload = extractPlanillasTokenFromResponse(data);
    if (!payload) {
      return { success: false, message: 'Respuesta inválida del servidor' };
    }

    await persistStoredPlanillasToken(payload);
    return { success: true };
  } catch (error) {
    console.error('requestPlanillasToken:', error);
    return { success: false, message: 'Error al validar la contraseña de Planillas' };
  }
}
