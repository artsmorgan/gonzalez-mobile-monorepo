import Constants from 'expo-constants';
import authedFetch from './authedFetch';

type BasicResponse = { status: boolean; message?: string;[k: string]: any };

export type LlaveItem = {
  id: number;
  cliente_id: number;
  corpo_id: number;
  puesto_id: number;
  empresa_id?: number;
  division_id?: number;
  contrato_id?: number;
  isActive?: boolean;
  numero_llave: string;
  lugar_abre: string;
  cantidad_copias: number;
  observaciones: string;
  firma_responsable: string;
  created_by: number;
  created_at: string;
  id_local?: string;
  movimientos?: any[];
};

export type ListLlavesResponse = {
  status: boolean;
  data?: LlaveItem[];
  message?: string;
};

type ListParams = {
  corpoId: number;
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
  marcaId: number;
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

export async function listLlaves({ corpoId, refreshAccessToken, logout }: ListParams): Promise<ListLlavesResponse> {
  try {
    const apiUrl = getApiUrl();
    const { refreshAccessToken: refresh, logout: doLogout } = requireAuthHandlers(refreshAccessToken, logout);

    const cid = Number(corpoId);
    if (!Number.isFinite(cid) || cid <= 0) {
      return { status: false, message: 'corpo_id inválido', data: [] };
    }

    const response = await authedFetch({
      url: `${apiUrl}/api/llaves?corpo_id=${cid}`,
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
    console.error('Error listing llaves:', error);
    return { status: false, message: error.message || 'Error al cargar llaves' };
  }
}

export async function createLlave({ requestData, refreshAccessToken, logout }: CreateParams): Promise<BasicResponse> {
  try {
    const apiUrl = getApiUrl();
    const { refreshAccessToken: refresh, logout: doLogout } = requireAuthHandlers(refreshAccessToken, logout);

    const response = await authedFetch({
      url: `${apiUrl}/api/llaves`,
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
    console.error('Error creating llave:', error);
    return { status: false, message: error.message || 'Error al crear llave' };
  }
}

export async function updateLlave({ id, requestData, refreshAccessToken, logout }: UpdateParams): Promise<BasicResponse> {
  try {
    const apiUrl = getApiUrl();
    const { refreshAccessToken: refresh, logout: doLogout } = requireAuthHandlers(refreshAccessToken, logout);

    const response = await authedFetch({
      url: `${apiUrl}/api/llaves/${id}`,
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
    console.error('Error updating llave:', error);
    return { status: false, message: error.message || 'Error al actualizar llave' };
  }
}

export async function deleteLlave({ id, marcaId, refreshAccessToken, logout }: DeleteParams): Promise<BasicResponse> {
  try {
    const apiUrl = getApiUrl();
    const { refreshAccessToken: refresh, logout: doLogout } = requireAuthHandlers(refreshAccessToken, logout);

    const response = await authedFetch({
      url: `${apiUrl}/api/llaves/${id}?m=${marcaId}`,
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
    console.error('Error deleting llave:', error);
    return { status: false, message: error.message || 'Error al eliminar llave' };
  }
}


