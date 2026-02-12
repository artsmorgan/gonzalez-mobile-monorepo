import Constants from 'expo-constants';
import authedFetch from './authedFetch';
import type { BasicResponse, ListMutuosAcuerdosResponse, MutuoAcuerdoUpsertResponse } from './mutuosAcuerdosTypes';

type CommonAuth = {
  refreshAccessToken?: () => Promise<boolean>;
  logout?: () => Promise<any>;
};

const normalizeBase64 = (b64: string) => {
  const idx = b64.indexOf('base64,');
  if (idx !== -1) return b64.slice(idx + 'base64,'.length);
  return b64;
};

const requireAuthHandlers = (refreshAccessToken?: () => Promise<boolean>, logout?: () => Promise<any>) => {
  if (!refreshAccessToken || !logout) {
    throw new Error('Auth handlers not provided');
  }
  return {
    refreshAccessToken,
    logout,
  } as {
    refreshAccessToken: () => Promise<boolean>;
    logout: () => Promise<any>;
  };
};

export const listMutuosAcuerdosByCorpo = async ({
  corpo_id,
  refreshAccessToken,
  logout,
}: { corpo_id: string } & CommonAuth): Promise<ListMutuosAcuerdosResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');
    const { refreshAccessToken: refresh, logout: doLogout } = requireAuthHandlers(refreshAccessToken, logout);

    const response = await authedFetch({
      url: `${apiUrl}/api/mutuos-acuerdos/corpo/${corpo_id}`,
      init: {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      refreshAccessToken: refresh,
      logout: doLogout,
    });

    if (!response) return { status: false, message: 'Sesión expirada', data: [] };

    const data = (await response.json()) as ListMutuosAcuerdosResponse;
    return data;
  } catch (error: any) {
    console.error('Error listing mutuos acuerdos:', error);
    return { status: false, message: error?.message || 'Error al listar mutuos acuerdos', data: [] };
  }
};

export const createMutuoAcuerdo = async ({
  requestData,
  refreshAccessToken,
  logout,
}: { requestData: any } & CommonAuth): Promise<MutuoAcuerdoUpsertResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');
    const { refreshAccessToken: refresh, logout: doLogout } = requireAuthHandlers(refreshAccessToken, logout);

    const payload: any = { ...requestData };
    if (typeof payload.firma_ejecutivo_cuenta === 'string') {
      payload.firma_ejecutivo_cuenta = normalizeBase64(payload.firma_ejecutivo_cuenta);
    }

    const response = await authedFetch({
      url: `${apiUrl}/api/mutuos-acuerdos`,
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
      refreshAccessToken: refresh,
      logout: doLogout,
    });

    if (!response) return { status: false, message: 'Sesión expirada' };

    const data = (await response.json()) as MutuoAcuerdoUpsertResponse;
    return data;
  } catch (error: any) {
    console.error('Error creating mutuo acuerdo:', error);
    return { status: false, message: error?.message || 'Error al crear mutuo acuerdo' };
  }
};

export const updateMutuoAcuerdo = async ({
  id,
  requestData,
  refreshAccessToken,
  logout,
}: { id: number; requestData: any } & CommonAuth): Promise<MutuoAcuerdoUpsertResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');
    const { refreshAccessToken: refresh, logout: doLogout } = requireAuthHandlers(refreshAccessToken, logout);

    const response = await authedFetch({
      url: `${apiUrl}/api/mutuos-acuerdos/${id}`,
      init: {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      },
      refreshAccessToken: refresh,
      logout: doLogout,
    });

    if (!response) return { status: false, message: 'Sesión expirada' };

    const data = (await response.json()) as MutuoAcuerdoUpsertResponse;
    return data;
  } catch (error: any) {
    console.error('Error updating mutuo acuerdo:', error);
    return { status: false, message: error?.message || 'Error al actualizar mutuo acuerdo' };
  }
};

export const deleteMutuoAcuerdo = async ({
  id,
  refreshAccessToken,
  logout,
}: { id: number } & CommonAuth): Promise<BasicResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');
    const { refreshAccessToken: refresh, logout: doLogout } = requireAuthHandlers(refreshAccessToken, logout);

    const response = await authedFetch({
      url: `${apiUrl}/api/mutuos-acuerdos/${id}`,
      init: {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      refreshAccessToken: refresh,
      logout: doLogout,
    });

    if (!response) return { status: false, message: 'Sesión expirada' };

    const data = (await response.json()) as BasicResponse;
    return data;
  } catch (error: any) {
    console.error('Error deleting mutuo acuerdo:', error);
    return { status: false, message: error?.message || 'Error al eliminar mutuo acuerdo' };
  }
};

export const signMutuoAcuerdoEjecutivo = async ({
  id,
  firma_ejecutivo_cuenta,
  refreshAccessToken,
  logout,
}: { id: number; firma_ejecutivo_cuenta: string } & CommonAuth): Promise<BasicResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');
    const { refreshAccessToken: refresh, logout: doLogout } = requireAuthHandlers(refreshAccessToken, logout);

    const payload = { firma_ejecutivo_cuenta: normalizeBase64(String(firma_ejecutivo_cuenta || '')) };

    const response = await authedFetch({
      url: `${apiUrl}/api/mutuos-acuerdos/${id}/firma-ejecutivo`,
      init: {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
      refreshAccessToken: refresh,
      logout: doLogout,
    });

    if (!response) return { status: false, message: 'Sesión expirada' };

    const data = (await response.json()) as BasicResponse;
    return data;
  } catch (error: any) {
    console.error('Error signing mutuo acuerdo:', error);
    return { status: false, message: error?.message || 'Error al firmar mutuo acuerdo' };
  }
};


