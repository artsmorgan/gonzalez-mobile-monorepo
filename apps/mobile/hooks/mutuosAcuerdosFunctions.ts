import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

async function getTokenOrRefresh(refreshAccessToken?: () => Promise<boolean>, logout?: () => Promise<any>) {
  let token = await AsyncStorage.getItem('access_token');
  if (!token && refreshAccessToken) {
    const refreshed = await refreshAccessToken();
    if (refreshed) token = await AsyncStorage.getItem('access_token');
    else if (logout) await logout();
  }
  if (!token) {
    if (logout) await logout();
    throw new Error('Sesión expirada');
  }
  return token;
}

export const listMutuosAcuerdosByCorpo = async ({
  corpo_id,
  refreshAccessToken,
  logout,
}: { corpo_id: string } & CommonAuth): Promise<ListMutuosAcuerdosResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');

    const token = await getTokenOrRefresh(refreshAccessToken, logout);
    if (!token) {
      if (logout) await logout();
      throw new Error('Sesión expirada');
    }

    const response = await fetch(`${apiUrl}/api/mutuos-acuerdos/corpo/${corpo_id}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      if (refreshAccessToken) {
        const refreshed = await refreshAccessToken();
        if (refreshed) return listMutuosAcuerdosByCorpo({ corpo_id, refreshAccessToken, logout });
      }
      if (logout) await logout();
      return { status: false, message: 'Sesión expirada', data: [] };
    }

    if (response.status === 403) {
      if (logout) await logout();
      throw new Error('Acceso denegado');
    }

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

    const token = await getTokenOrRefresh(refreshAccessToken, logout);
    if (!token) {
      if (logout) await logout();
      throw new Error('Sesión expirada');
    }

    const payload: any = { ...requestData };
    if (typeof payload.firma_ejecutivo_cuenta === 'string') {
      payload.firma_ejecutivo_cuenta = normalizeBase64(payload.firma_ejecutivo_cuenta);
    }

    const response = await fetch(`${apiUrl}/api/mutuos-acuerdos`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(payload),
    });

    if (response.status === 401) {
      if (refreshAccessToken) {
        const refreshed = await refreshAccessToken();
        if (refreshed) return createMutuoAcuerdo({ requestData, refreshAccessToken, logout });
      }
      if (logout) await logout();
      return { status: false, message: 'Sesión expirada' };
    }

    if (response.status === 403) {
      if (logout) await logout();
      throw new Error('Acceso denegado');
    }

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

    const token = await getTokenOrRefresh(refreshAccessToken, logout);
    if (!token) throw new Error('No authentication token found');

    const response = await fetch(`${apiUrl}/api/mutuos-acuerdos/${id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401) {
      if (refreshAccessToken) {
        const refreshed = await refreshAccessToken();
        if (refreshed) return updateMutuoAcuerdo({ id, requestData, refreshAccessToken, logout });
      }
      if (logout) await logout();
      return { status: false, message: 'Sesión expirada' };
    }

    if (response.status === 403) {
      if (logout) await logout();
      throw new Error('Acceso denegado');
    }

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

    const token = await getTokenOrRefresh(refreshAccessToken, logout);
    if (!token) {
      if (logout) await logout();
      throw new Error('Sesión expirada');
    }

    const response = await fetch(`${apiUrl}/api/mutuos-acuerdos/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      if (refreshAccessToken) {
        const refreshed = await refreshAccessToken();
        if (refreshed) return deleteMutuoAcuerdo({ id, refreshAccessToken, logout });
      }
      if (logout) await logout();
      return { status: false, message: 'Sesión expirada' };
    }

    if (response.status === 403) {
      if (logout) await logout();
      throw new Error('Acceso denegado');
    }

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

    const token = await getTokenOrRefresh(refreshAccessToken, logout);
    if (!token) {
      if (logout) await logout();
      throw new Error('Sesión expirada');
    }

    const payload = { firma_ejecutivo_cuenta: normalizeBase64(String(firma_ejecutivo_cuenta || '')) };

    const response = await fetch(`${apiUrl}/api/mutuos-acuerdos/${id}/firma-ejecutivo`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(payload),
    });

    if (response.status === 401) {
      if (refreshAccessToken) {
        const refreshed = await refreshAccessToken();
        if (refreshed) return signMutuoAcuerdoEjecutivo({ id, firma_ejecutivo_cuenta, refreshAccessToken, logout });
      }
      if (logout) await logout();
      return { status: false, message: 'Sesión expirada' };
    }

    if (response.status === 403) {
      if (logout) await logout();
      throw new Error('Acceso denegado');
    }

    const data = (await response.json()) as BasicResponse;
    return data;
  } catch (error: any) {
    console.error('Error signing mutuo acuerdo:', error);
    return { status: false, message: error?.message || 'Error al firmar mutuo acuerdo' };
  }
};


