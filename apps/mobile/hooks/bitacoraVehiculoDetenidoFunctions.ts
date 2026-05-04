import Constants from 'expo-constants';
import authedFetch from './authedFetch';

type BasicResponse = { status: boolean; message?: string;[k: string]: any };

export type BitacoraVehiculoDetenidoItem = {
  id: number;
  empresa_id: number;
  cliente_id: number;
  sucursal_id: number;
  division_id?: number;
  contrato_id?: number;
  puesto_id?: number;
  isActive?: boolean;
  vehiculo_id?: number | null;
  uso_id?: number | null;
  tipo: string;
  informacion_general: any[]; // array de objetos
  informacion_revision: any[]; // array de objetos
  movimientos_vehiculos: any[]; // array de objetos
  observaciones: string;
  firma_responsable: string;
  created_by: number;
  created_at: string;
  id_local?: string;
  vehiculo_id_local?: string;
  uso_id_local?: string;
};

export type ListBitacoraResponse = { status: boolean; data?: BitacoraVehiculoDetenidoItem[]; message?: string };

type ListParams = {
  marcaId: number;
  empresaId?: number;
  clienteId?: number;
  sucursalId?: number;
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

export async function listBitacoraVehiculoDetenido({
  marcaId,
  empresaId,
  clienteId,
  sucursalId,
  refreshAccessToken,
  logout,
}: ListParams): Promise<ListBitacoraResponse> {
  try {
    const apiUrl = getApiUrl();
    const { refreshAccessToken: refresh, logout: doLogout } = requireAuthHandlers(refreshAccessToken, logout);
    const params = new URLSearchParams();
    if (marcaId) params.set('m', String(marcaId));
    // si vienen ids directos, los mandamos también (el server prioriza estos cuando están completos)
    if (typeof empresaId === 'number') params.set('empresa_id', String(empresaId));
    if (typeof clienteId === 'number') params.set('cliente_id', String(clienteId));
    if (typeof sucursalId === 'number') params.set('sucursal_id', String(sucursalId));

    const response = await authedFetch({
      url: `${apiUrl}/api/bitacora-vehiculo-detenido?${params.toString()}`,
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
    if (data?.status && Array.isArray(data.data)) {
      data.data = data.data.filter((row: any) => row?.isActive !== false);
    }
    return data;
  } catch (error: any) {
    console.error('Error listing bitacora vehiculo detenido:', error);
    return { status: false, message: error.message || 'Error al cargar bitácoras' };
  }
}

export type CreateBitacoraResponse = BasicResponse & {
  /** Id del registro en servidor (también en `data.id`). */
  id?: number;
  data?: { id?: number };
};

export async function createBitacoraVehiculoDetenido({
  requestData,
  refreshAccessToken,
  logout,
}: CreateParams): Promise<CreateBitacoraResponse> {
  try {
    const apiUrl = getApiUrl();
    const { refreshAccessToken: refresh, logout: doLogout } = requireAuthHandlers(refreshAccessToken, logout);

    const response = await authedFetch({
      url: `${apiUrl}/api/bitacora-vehiculo-detenido`,
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
    const serverId = Number(data?.id ?? data?.data?.id ?? 0);
    return {
      ...data,
      ...(Number.isFinite(serverId) && serverId > 0 ? { id: serverId, data: { ...(data.data || {}), id: serverId } } : {}),
    };
  } catch (error: any) {
    console.error('Error creating bitacora vehiculo detenido:', error);
    return { status: false, message: error.message || 'Error al crear bitácora' };
  }
}

export async function updateBitacoraVehiculoDetenido({ id, requestData, refreshAccessToken, logout }: UpdateParams): Promise<BasicResponse> {
  try {
    const apiUrl = getApiUrl();
    const { refreshAccessToken: refresh, logout: doLogout } = requireAuthHandlers(refreshAccessToken, logout);

    const response = await authedFetch({
      url: `${apiUrl}/api/bitacora-vehiculo-detenido/${id}`,
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
    console.error('Error updating bitacora vehiculo detenido:', error);
    return { status: false, message: error.message || 'Error al actualizar bitácora' };
  }
}

export async function deleteBitacoraVehiculoDetenido({ id, refreshAccessToken, logout }: DeleteParams): Promise<BasicResponse> {
  try {
    const apiUrl = getApiUrl();
    const { refreshAccessToken: refresh, logout: doLogout } = requireAuthHandlers(refreshAccessToken, logout);

    const response = await authedFetch({
      url: `${apiUrl}/api/bitacora-vehiculo-detenido/${id}`,
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
    console.error('Error deleting bitacora vehiculo detenido:', error);
    return { status: false, message: error.message || 'Error al eliminar bitácora' };
  }
}


