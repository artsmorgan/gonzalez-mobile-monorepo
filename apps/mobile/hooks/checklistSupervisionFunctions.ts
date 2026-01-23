import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

type BasicResponse = { status: boolean; message?: string;[k: string]: any };

export type ChecklistSupervisionItem = {
  id: number;
  cliente_id: number;
  division_id: number;
  corpo_id: number;
  puesto_id: number;
  fecha: string;
  ejecutivo_cuenta: string;
  evaluacion: string;
  firma_supervisor: string;
  firma_responsable: string;
  created_by: number;
  created_at: string;
  id_local?: string;
  cliente?: { id: number; nombre: string };
  corpo?: { id: number; nombre: string };
  puesto?: { id: number; nombre: string; codigo: string };
};

export type ListChecklistSupervisionResponse = {
  status: boolean;
  data?: ChecklistSupervisionItem[];
  message?: string;
};

type ListParams = {
  clienteId?: number;
  corpoId?: number;
  puestoId?: number;
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

export async function listChecklistSupervision({
  clienteId,
  corpoId,
  puestoId,
  refreshAccessToken,
  logout,
}: ListParams): Promise<ListChecklistSupervisionResponse> {
  try {
    const apiUrl = getApiUrl();
    const token = await getToken(refreshAccessToken, logout);

    const params = new URLSearchParams();
    if (clienteId) params.append('cliente_id', String(clienteId));
    if (corpoId) params.append('corpo_id', String(corpoId));
    if (puestoId) params.append('puesto_id', String(puestoId));

    const response = await fetch(`${apiUrl}/api/checklist-supervision?${params.toString()}`, {
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
        if (refreshed) return listChecklistSupervision({ clienteId, corpoId, puestoId, refreshAccessToken, logout });
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
    console.error('Error listing checklist supervision:', error);
    return { status: false, message: error.message || 'Error al cargar checklist de supervisión' };
  }
}

export async function createChecklistSupervision({
  requestData,
  refreshAccessToken,
  logout,
}: CreateParams): Promise<BasicResponse> {
  try {
    const apiUrl = getApiUrl();
    const token = await getToken(refreshAccessToken, logout);
    const response = await fetch(`${apiUrl}/api/checklist-supervision`, {
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
        if (refreshed) return createChecklistSupervision({ requestData, refreshAccessToken, logout });
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
    console.error('Error creating checklist supervision:', error);
    return { status: false, message: error.message || 'Error al crear checklist de supervisión' };
  }
}

export async function updateChecklistSupervision({
  id,
  requestData,
  refreshAccessToken,
  logout,
}: UpdateParams): Promise<BasicResponse> {
  try {
    const apiUrl = getApiUrl();
    const token = await getToken(refreshAccessToken, logout);
    const response = await fetch(`${apiUrl}/api/checklist-supervision/${id}`, {
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
        if (refreshed) return updateChecklistSupervision({ id, requestData, refreshAccessToken, logout });
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
    console.error('Error updating checklist supervision:', error);
    return { status: false, message: error.message || 'Error al actualizar checklist de supervisión' };
  }
}

export async function deleteChecklistSupervision({
  id,
  refreshAccessToken,
  logout,
}: DeleteParams): Promise<BasicResponse> {
  try {
    const apiUrl = getApiUrl();
    const token = await getToken(refreshAccessToken, logout);
    const response = await fetch(`${apiUrl}/api/checklist-supervision/${id}`, {
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
        if (refreshed) return deleteChecklistSupervision({ id, refreshAccessToken, logout });
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
    console.error('Error deleting checklist supervision:', error);
    return { status: false, message: error.message || 'Error al eliminar checklist de supervisión' };
  }
}

