import Constants from 'expo-constants';
import authedFetch from './authedFetch';

type BasicResponse = { status: boolean; message?: string;[k: string]: any };

export type LlaveroItem = {
  id: number;
  cliente_id: number;
  corpo_id: number;
  puesto_id: number;
  nombre_llavero: string;
  observaciones: string;
  firma_responsable: string;
  created_by: number;
  created_at: string;
  id_local?: string;
  movimientos?: any[];
  llaves?: any[];
};

export type ListLlaverosResponse = {
  status: boolean;
  data?: LlaveroItem[];
  message?: string;
};

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

export async function listLlaveros({ marcaId, refreshAccessToken, logout }: ListParams): Promise<ListLlaverosResponse> {
  try {
    const apiUrl = getApiUrl();
    const { refreshAccessToken: refresh, logout: doLogout } = requireAuthHandlers(refreshAccessToken, logout);

    const response = await authedFetch({
      url: `${apiUrl}/api/llaveros?m=${marcaId}`,
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
    console.error('Error listing llaveros:', error);
    return { status: false, message: error.message || 'Error al cargar llaveros' };
  }
}

export async function createLlavero({ requestData, refreshAccessToken, logout }: CreateParams): Promise<BasicResponse> {
  try {
    const apiUrl = getApiUrl();
    const { refreshAccessToken: refresh, logout: doLogout } = requireAuthHandlers(refreshAccessToken, logout);

    const response = await authedFetch({
      url: `${apiUrl}/api/llaveros`,
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
    console.error('Error creating llavero:', error);
    return { status: false, message: error.message || 'Error al crear llavero' };
  }
}

export async function updateLlavero({ id, requestData, refreshAccessToken, logout }: UpdateParams): Promise<BasicResponse> {
  try {
    const apiUrl = getApiUrl();
    const { refreshAccessToken: refresh, logout: doLogout } = requireAuthHandlers(refreshAccessToken, logout);

    const response = await authedFetch({
      url: `${apiUrl}/api/llaveros/${id}`,
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
    console.error('Error updating llavero:', error);
    return { status: false, message: error.message || 'Error al actualizar llavero' };
  }
}

export async function deleteLlavero({ id, marcaId, refreshAccessToken, logout }: DeleteParams): Promise<BasicResponse> {
  try {
    const apiUrl = getApiUrl();
    const { refreshAccessToken: refresh, logout: doLogout } = requireAuthHandlers(refreshAccessToken, logout);

    const response = await authedFetch({
      url: `${apiUrl}/api/llaveros/${id}?m=${marcaId}`,
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
    console.error('Error deleting llavero:', error);
    return { status: false, message: error.message || 'Error al eliminar llavero' };
  }
}


