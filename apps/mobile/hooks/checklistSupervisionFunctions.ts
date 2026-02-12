import Constants from 'expo-constants';
import authedFetch from './authedFetch';

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

export async function listChecklistSupervision({
  clienteId,
  corpoId,
  puestoId,
  refreshAccessToken,
  logout,
}: ListParams): Promise<ListChecklistSupervisionResponse> {
  try {
    const apiUrl = getApiUrl();
    const { refreshAccessToken: refresh, logout: doLogout } = requireAuthHandlers(refreshAccessToken, logout);

    const params = new URLSearchParams();
    if (clienteId) params.append('cliente_id', String(clienteId));
    if (corpoId) params.append('corpo_id', String(corpoId));
    if (puestoId) params.append('puesto_id', String(puestoId));

    const response = await authedFetch({
      url: `${apiUrl}/api/checklist-supervision?${params.toString()}`,
      init: {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      refreshAccessToken: refresh,
      logout: doLogout,
    });

    if (!response) return { status: false, message: 'Sesión expirada' };

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
    const { refreshAccessToken: refresh, logout: doLogout } = requireAuthHandlers(refreshAccessToken, logout);

    const response = await authedFetch({
      url: `${apiUrl}/api/checklist-supervision`,
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      },
      refreshAccessToken: refresh,
      logout: doLogout,
    });

    if (!response) return { status: false, message: 'Sesión expirada' };

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
    const { refreshAccessToken: refresh, logout: doLogout } = requireAuthHandlers(refreshAccessToken, logout);

    const response = await authedFetch({
      url: `${apiUrl}/api/checklist-supervision/${id}`,
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
    const { refreshAccessToken: refresh, logout: doLogout } = requireAuthHandlers(refreshAccessToken, logout);

    const response = await authedFetch({
      url: `${apiUrl}/api/checklist-supervision/${id}`,
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

    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `HTTP error! status: ${response.status}`);
    return data;
  } catch (error: any) {
    console.error('Error deleting checklist supervision:', error);
    return { status: false, message: error.message || 'Error al eliminar checklist de supervisión' };
  }
}

