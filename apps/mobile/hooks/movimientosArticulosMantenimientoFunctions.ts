import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

type BasicResponse = { status: boolean; message?: string; [k: string]: any };

export type MovimientoArticuloMantenimientoItem = {
  id: number;
  articulo_plan_id?: number | null;
  articulo_asignado_id?: number | null;
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

type ParentRef = {
  source: 'plan' | 'asignado';
  estructuraId: number;
};

type ListParams = {
  parent: ParentRef;
  marcaId: number;
  refreshAccessToken?: () => Promise<boolean>;
  logout?: () => Promise<any>;
};

type CreateParams = {
  parent: ParentRef;
  requestData: any;
  refreshAccessToken?: () => Promise<boolean>;
  logout?: () => Promise<any>;
};

type UpdateParams = {
  parent: ParentRef;
  id: number;
  requestData: any;
  refreshAccessToken?: () => Promise<boolean>;
  logout?: () => Promise<any>;
};

type DeleteParams = {
  parent: ParentRef;
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

function parentBaseUrl(apiUrl: string, parent: ParentRef) {
  return `${apiUrl}/api/articulo-mantenimiento/${parent.source}/${parent.estructuraId}/movimientos`;
}

export async function listMovimientosArticuloMantenimiento({
  parent,
  marcaId,
  refreshAccessToken,
  logout,
}: ListParams): Promise<{ status: boolean; data?: MovimientoArticuloMantenimientoItem[]; message?: string }> {
  try {
    const apiUrl = getApiUrl();
    const token = await getToken(refreshAccessToken, logout);
    const response = await fetch(`${parentBaseUrl(apiUrl, parent)}?m=${marcaId}`, {
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
        if (refreshed) return listMovimientosArticuloMantenimiento({ parent, marcaId, refreshAccessToken, logout });
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
    console.error('Error listing movimientos articulo mantenimiento:', error);
    return { status: false, message: error.message || 'Error al cargar movimientos' };
  }
}

export async function createMovimientoArticuloMantenimiento({
  parent,
  requestData,
  refreshAccessToken,
  logout,
}: CreateParams): Promise<BasicResponse> {
  try {
    const apiUrl = getApiUrl();
    const token = await getToken(refreshAccessToken, logout);
    const response = await fetch(parentBaseUrl(apiUrl, parent), {
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
        if (refreshed) return createMovimientoArticuloMantenimiento({ parent, requestData, refreshAccessToken, logout });
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
    console.error('Error creating movimiento articulo mantenimiento:', error);
    return { status: false, message: error.message || 'Error al crear movimiento' };
  }
}

export async function updateMovimientoArticuloMantenimiento({
  parent,
  id,
  requestData,
  refreshAccessToken,
  logout,
}: UpdateParams): Promise<BasicResponse> {
  try {
    const apiUrl = getApiUrl();
    const token = await getToken(refreshAccessToken, logout);
    const response = await fetch(`${parentBaseUrl(apiUrl, parent)}/${id}`, {
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
        if (refreshed) return updateMovimientoArticuloMantenimiento({ parent, id, requestData, refreshAccessToken, logout });
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
    console.error('Error updating movimiento articulo mantenimiento:', error);
    return { status: false, message: error.message || 'Error al actualizar movimiento' };
  }
}

export async function deleteMovimientoArticuloMantenimiento({
  parent,
  id,
  marcaId,
  refreshAccessToken,
  logout,
}: DeleteParams): Promise<BasicResponse> {
  try {
    const apiUrl = getApiUrl();
    const token = await getToken(refreshAccessToken, logout);
    const response = await fetch(`${parentBaseUrl(apiUrl, parent)}/${id}?m=${marcaId}`, {
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
        if (refreshed) return deleteMovimientoArticuloMantenimiento({ parent, id, marcaId, refreshAccessToken, logout });
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
    console.error('Error deleting movimiento articulo mantenimiento:', error);
    return { status: false, message: error.message || 'Error al eliminar movimiento' };
  }
}


