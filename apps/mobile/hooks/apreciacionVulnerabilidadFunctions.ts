import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import authedFetch from './authedFetch';

type BasicResponse = { status: boolean; message?: string;[k: string]: any };

export type ApreciacionVulnerabilidadItem = {
  id: number;
  cliente_id: number;
  cliente_nombre?: string;
  corpo_id: number;
  corpo_nombre?: string;
  puesto_id: number;
  puesto_nombre?: string;
  fecha: string; // ISO
  enlace: string;
  nombre_solicitante: string;
  boleta: string; // JSON string
  metricas_vulnerablidad: string; // JSON string
  observaciones?: string;
  firma_solicitante: string; // dataURL
  firma_responsable: string; // QR hash
  id_local?: string;
};

export type ListApreciacionVulnerabilidadResponse = {
  status: boolean;
  data?: ApreciacionVulnerabilidadItem[];
  message?: string;
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

export async function listApreciacionVulnerabilidad({
  refreshAccessToken,
  logout,
}: {
  refreshAccessToken?: () => Promise<boolean>;
  logout?: () => Promise<any>;
}): Promise<ListApreciacionVulnerabilidadResponse> {
  try {
    const apiUrl = getApiUrl();
    const { refreshAccessToken: refresh, logout: doLogout } = requireAuthHandlers(refreshAccessToken, logout);

    const response = await authedFetch({
      url: `${apiUrl}/api/apreciacion-vulnerabilidad`,
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
    console.error('Error listing apreciacion vulnerabilidad:', error);
    return { status: false, message: error.message || 'Error al cargar registros' };
  }
}

export async function createApreciacionVulnerabilidad({
  requestData,
  refreshAccessToken,
  logout,
}: {
  requestData: any;
  refreshAccessToken?: () => Promise<boolean>;
  logout?: () => Promise<any>;
}): Promise<BasicResponse> {
  try {
    const apiUrl = getApiUrl();
    const { refreshAccessToken: refresh, logout: doLogout } = requireAuthHandlers(refreshAccessToken, logout);

    const response = await authedFetch({
      url: `${apiUrl}/api/apreciacion-vulnerabilidad`,
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
    console.error('Error creating apreciacion vulnerabilidad:', error);
    return { status: false, message: error.message || 'Error al crear registro' };
  }
}

export async function updateApreciacionVulnerabilidad({
  id,
  requestData,
  refreshAccessToken,
  logout,
}: {
  id: number;
  requestData: any;
  refreshAccessToken?: () => Promise<boolean>;
  logout?: () => Promise<any>;
}): Promise<BasicResponse> {
  try {
    const apiUrl = getApiUrl();
    const { refreshAccessToken: refresh, logout: doLogout } = requireAuthHandlers(refreshAccessToken, logout);

    const response = await authedFetch({
      url: `${apiUrl}/api/apreciacion-vulnerabilidad/${id}`,
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
    console.error('Error updating apreciacion vulnerabilidad:', error);
    return { status: false, message: error.message || 'Error al actualizar registro' };
  }
}

export async function deleteApreciacionVulnerabilidad({
  id,
  refreshAccessToken,
  logout,
}: {
  id: number;
  refreshAccessToken?: () => Promise<boolean>;
  logout?: () => Promise<any>;
}): Promise<BasicResponse> {
  try {
    const apiUrl = getApiUrl();
    const { refreshAccessToken: refresh, logout: doLogout } = requireAuthHandlers(refreshAccessToken, logout);

    const response = await authedFetch({
      url: `${apiUrl}/api/apreciacion-vulnerabilidad/${id}`,
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
    console.error('Error deleting apreciacion vulnerabilidad:', error);
    return { status: false, message: error.message || 'Error al eliminar registro' };
  }
}

export type MainStructureEmpresa = {
  id: number;
  nombre: string;
  clientes: MainStructureCliente[];
};
export type MainStructureCliente = {
  id: number;
  nombre: string;
  division: MainStructureDivision[];
};
export type MainStructureDivision = {
  id: number;
  nombre: string;
  contratos: MainStructureContrato[];
};
export type MainStructureContrato = {
  id: number;
  nombre: string;
  sucursales: MainStructureSucursal[];
};
export type MainStructureSucursal = {
  id: number;
  nombre: string;
  puestos: MainStructurePuesto[];
};
export type MainStructurePuesto = {
  id: number;
  nombre: string;
  plazas: { id: number; nombre: string }[];
};

export async function getMainStructure({
  refreshAccessToken,
  logout,
}: {
  refreshAccessToken?: () => Promise<boolean>;
  logout?: () => Promise<any>;
}): Promise<{ status: boolean; structure?: MainStructureEmpresa[]; message?: string }> {
  try {
    const apiUrl = getApiUrl();
    const { refreshAccessToken: refresh, logout: doLogout } = requireAuthHandlers(refreshAccessToken, logout);

    const response = await authedFetch({
      url: `${apiUrl}/api/main-structure`,
      init: {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      refreshAccessToken: refresh,
      logout: doLogout,
    });

    if (!response) {
      throw new Error('Sesión expirada');
    }

    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `HTTP error! status: ${response.status}`);
    if (data?.status && Array.isArray(data.structure)) {
      await AsyncStorage.setItem('main_structure_cache', JSON.stringify(data.structure));
    }
    return data;
  } catch (error: any) {
    const cacheStr = await AsyncStorage.getItem('main_structure_cache');
    if (cacheStr) {
      try {
        const cached = JSON.parse(cacheStr);
        if (Array.isArray(cached)) return { status: true, structure: cached };
      } catch { }
    }
    return { status: false, message: error.message || 'Error al cargar estructura' };
  }
}


