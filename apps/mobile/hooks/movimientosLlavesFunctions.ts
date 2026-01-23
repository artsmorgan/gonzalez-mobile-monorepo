import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

type BasicResponse = { status: boolean; message?: string;[k: string]: any };

export type MovimientoLlaveItem = {
  id: number;
  llave_id: number;
  nombre_persona_recibe: string;
  nombre_persona_entrega: string;
  departamento: string;
  telefono: string;
  entrega: string;
  recibe: string;
  fecha: string; // ISO / yyyy-mm-dd
  hora: string; // ISO / hh:mm:ss
  firma_entrega: string;
  firma_recibe: string;
  firma_responsable: string;
  id_local?: string;
};

type ListParams = {
  llaveId: number;
  marcaId: number;
  refreshAccessToken?: () => Promise<boolean>;
  logout?: () => Promise<any>;
};

type CreateParams = {
  llaveId: number;
  requestData: any;
  refreshAccessToken?: () => Promise<boolean>;
  logout?: () => Promise<any>;
};

type UpdateParams = {
  llaveId: number;
  id: number;
  requestData: any;
  refreshAccessToken?: () => Promise<boolean>;
  logout?: () => Promise<any>;
};

type DeleteParams = {
  llaveId: number;
  id: number;
  marcaId: number;
  refreshAccessToken?: () => Promise<boolean>;
  logout?: () => Promise<any>;
};

const getApiUrl = () => {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) throw new Error('Server URL not configured');
  return apiUrl;
};

async function getToken(refreshAccessToken?: () => Promise<boolean>, logout?: () => Promise<any>) {
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

export async function listMovimientosLlave({
  llaveId,
  marcaId,
  refreshAccessToken,
  logout,
}: ListParams): Promise<{ status: boolean; data?: MovimientoLlaveItem[]; message?: string }> {
  try {
    const apiUrl = getApiUrl();
    const token = await getToken(refreshAccessToken, logout);
    const response = await fetch(`${apiUrl}/api/llaves/${llaveId}/movimientos?m=${marcaId}`, {
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
        if (refreshed) return listMovimientosLlave({ llaveId, marcaId, refreshAccessToken, logout });
        if (logout) await logout();
      }
      return { status: false, message: 'Sesión expirada' };
    }

    if (response.status === 403) {
      if (logout) await logout();
      throw new Error('Acceso denegado');
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('Error listing movimientos llave:', error);
    return { status: false, message: error.message || 'Error al cargar movimientos' };
  }
}

export async function createMovimientoLlave({
  llaveId,
  requestData,
  refreshAccessToken,
  logout,
}: CreateParams): Promise<BasicResponse> {
  try {
    const apiUrl = getApiUrl();
    const token = await getToken(refreshAccessToken, logout);
    const response = await fetch(`${apiUrl}/api/llaves/${llaveId}/movimientos`, {
      method: 'POST',
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
        if (refreshed) return createMovimientoLlave({ llaveId, requestData, refreshAccessToken, logout });
        if (logout) await logout();
      }
      return { status: false, message: 'Sesión expirada' };
    }

    if (response.status === 403) {
      if (logout) await logout();
      throw new Error('Acceso denegado');
    }

    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `HTTP error! status: ${response.status}`);
    return data;
  } catch (error: any) {
    console.error('Error creating movimiento llave:', error);
    return { status: false, message: error.message || 'Error al crear movimiento' };
  }
}

export async function updateMovimientoLlave({
  llaveId,
  id,
  requestData,
  refreshAccessToken,
  logout,
}: UpdateParams): Promise<BasicResponse> {
  try {
    const apiUrl = getApiUrl();
    const token = await getToken(refreshAccessToken, logout);
    const response = await fetch(`${apiUrl}/api/llaves/${llaveId}/movimientos/${id}`, {
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
        if (refreshed) return updateMovimientoLlave({ llaveId, id, requestData, refreshAccessToken, logout });
        if (logout) await logout();
      }
      return { status: false, message: 'Sesión expirada' };
    }

    if (response.status === 403) {
      if (logout) await logout();
      throw new Error('Acceso denegado');
    }

    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `HTTP error! status: ${response.status}`);
    return data;
  } catch (error: any) {
    console.error('Error updating movimiento llave:', error);
    return { status: false, message: error.message || 'Error al actualizar movimiento' };
  }
}

export async function deleteMovimientoLlave({
  llaveId,
  id,
  marcaId,
  refreshAccessToken,
  logout,
}: DeleteParams): Promise<BasicResponse> {
  try {
    const apiUrl = getApiUrl();
    const token = await getToken(refreshAccessToken, logout);
    const response = await fetch(`${apiUrl}/api/llaves/${llaveId}/movimientos/${id}?m=${marcaId}`, {
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
        if (refreshed) return deleteMovimientoLlave({ llaveId, id, marcaId, refreshAccessToken, logout });
        if (logout) await logout();
      }
      return { status: false, message: 'Sesión expirada' };
    }

    if (response.status === 403) {
      if (logout) await logout();
      throw new Error('Acceso denegado');
    }

    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `HTTP error! status: ${response.status}`);
    return data;
  } catch (error: any) {
    console.error('Error deleting movimiento llave:', error);
    return { status: false, message: error.message || 'Error al eliminar movimiento' };
  }
}


