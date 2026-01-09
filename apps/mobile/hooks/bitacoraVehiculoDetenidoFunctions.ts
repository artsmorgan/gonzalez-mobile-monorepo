import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

type BasicResponse = { status: boolean; message?: string; [k: string]: any };

export type BitacoraVehiculoDetenidoItem = {
  id: number;
  empresa_id: number;
  cliente_id: number;
  sucursal_id: number;
  tipo: string;
  informacion_general: any[]; // array de objetos
  informacion_revision: any[]; // array de objetos
  movimientos_vehiculos: any[]; // array de objetos
  observaciones: string;
  firma_responsable: string;
  created_by: number;
  created_at: string;
  id_local?: string;
};

export type ListBitacoraResponse = { status: boolean; data?: BitacoraVehiculoDetenidoItem[]; message?: string };

type ListParams = {
  marcaId: number;
  refreshAccessToken?: () => Promise<boolean>;
  logout?: () => Promise<any>;
};

type CreateParams = {
  requestData: any;
  refreshAccessToken?: () => Promise<boolean>;
  logout?: () => Promise<any>;
};

type UpdateParams = {
  id: number;
  requestData: any;
  refreshAccessToken?: () => Promise<boolean>;
  logout?: () => Promise<any>;
};

type DeleteParams = {
  id: number;
  refreshAccessToken?: () => Promise<boolean>;
  logout?: () => Promise<any>;
};

const getApiUrl = () => {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) throw new Error('Server URL not configured');
  return apiUrl;
};

async function getToken(refreshAccessToken?: () => Promise<boolean>) {
  let token = await AsyncStorage.getItem('access_token');
  if (!token && refreshAccessToken) {
    const refreshed = await refreshAccessToken();
    if (refreshed) token = await AsyncStorage.getItem('access_token');
  }
  if (!token) throw new Error('No authentication token found');
  return token;
}

export async function listBitacoraVehiculoDetenido({ marcaId, refreshAccessToken, logout }: ListParams): Promise<ListBitacoraResponse> {
  try {
    const apiUrl = getApiUrl();
    const token = await getToken(refreshAccessToken);
    const response = await fetch(`${apiUrl}/api/bitacora-vehiculo-detenido?m=${marcaId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401 || response.status === 403) {
      if (refreshAccessToken) {
        const refreshed = await refreshAccessToken();
        if (refreshed) return listBitacoraVehiculoDetenido({ marcaId, refreshAccessToken, logout });
        if (logout) await logout();
      }
      return { status: false, message: 'Sesión expirada' };
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('Error listing bitacora vehiculo detenido:', error);
    return { status: false, message: error.message || 'Error al cargar bitácoras' };
  }
}

export async function createBitacoraVehiculoDetenido({ requestData, refreshAccessToken, logout }: CreateParams): Promise<BasicResponse> {
  try {
    const apiUrl = getApiUrl();
    const token = await getToken(refreshAccessToken);
    const response = await fetch(`${apiUrl}/api/bitacora-vehiculo-detenido`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401 || response.status === 403) {
      if (refreshAccessToken) {
        const refreshed = await refreshAccessToken();
        if (refreshed) return createBitacoraVehiculoDetenido({ requestData, refreshAccessToken, logout });
        if (logout) await logout();
      }
      return { status: false, message: 'Sesión expirada' };
    }

    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `HTTP error! status: ${response.status}`);
    return data;
  } catch (error: any) {
    console.error('Error creating bitacora vehiculo detenido:', error);
    return { status: false, message: error.message || 'Error al crear bitácora' };
  }
}

export async function updateBitacoraVehiculoDetenido({ id, requestData, refreshAccessToken, logout }: UpdateParams): Promise<BasicResponse> {
  try {
    const apiUrl = getApiUrl();
    const token = await getToken(refreshAccessToken);
    const response = await fetch(`${apiUrl}/api/bitacora-vehiculo-detenido/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401 || response.status === 403) {
      if (refreshAccessToken) {
        const refreshed = await refreshAccessToken();
        if (refreshed) return updateBitacoraVehiculoDetenido({ id, requestData, refreshAccessToken, logout });
        if (logout) await logout();
      }
      return { status: false, message: 'Sesión expirada' };
    }

    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `HTTP error! status: ${response.status}`);
    return data;
  } catch (error: any) {
    console.error('Error updating bitacora vehiculo detenido:', error);
    return { status: false, message: error.message || 'Error al actualizar bitácora' };
  }
}

export async function deleteBitacoraVehiculoDetenido({ id, refreshAccessToken, logout }: DeleteParams): Promise<BasicResponse> {
  try {
    const apiUrl = getApiUrl();
    const token = await getToken(refreshAccessToken);
    const response = await fetch(`${apiUrl}/api/bitacora-vehiculo-detenido/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401 || response.status === 403) {
      if (refreshAccessToken) {
        const refreshed = await refreshAccessToken();
        if (refreshed) return deleteBitacoraVehiculoDetenido({ id, refreshAccessToken, logout });
        if (logout) await logout();
      }
      return { status: false, message: 'Sesión expirada' };
    }

    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `HTTP error! status: ${response.status}`);
    return data;
  } catch (error: any) {
    console.error('Error deleting bitacora vehiculo detenido:', error);
    return { status: false, message: error.message || 'Error al eliminar bitácora' };
  }
}


