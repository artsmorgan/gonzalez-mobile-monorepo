import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

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

export async function listApreciacionVulnerabilidad({
  refreshAccessToken,
  logout,
}: {
  refreshAccessToken?: () => Promise<boolean>;
  logout?: () => Promise<any>;
}): Promise<ListApreciacionVulnerabilidadResponse> {
  try {
    const apiUrl = getApiUrl();
    const token = await getToken(refreshAccessToken, logout);
    const response = await fetch(`${apiUrl}/api/apreciacion-vulnerabilidad`, {
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
        if (refreshed) return listApreciacionVulnerabilidad({ refreshAccessToken, logout });
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
    const token = await getToken(refreshAccessToken, logout);
    const response = await fetch(`${apiUrl}/api/apreciacion-vulnerabilidad`, {
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
        if (refreshed) return createApreciacionVulnerabilidad({ requestData, refreshAccessToken, logout });
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
    const token = await getToken(refreshAccessToken, logout);
    const response = await fetch(`${apiUrl}/api/apreciacion-vulnerabilidad/${id}`, {
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
        if (refreshed) return updateApreciacionVulnerabilidad({ id, requestData, refreshAccessToken, logout });
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
    const token = await getToken(refreshAccessToken, logout);
    const response = await fetch(`${apiUrl}/api/apreciacion-vulnerabilidad/${id}`, {
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
        if (refreshed) return deleteApreciacionVulnerabilidad({ id, refreshAccessToken, logout });
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
    const token = await getToken(refreshAccessToken, logout);
    const response = await fetch(`${apiUrl}/api/main-structure`, {
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
        if (refreshed) return getMainStructure({ refreshAccessToken, logout });
        if (logout) await logout();
      }
      throw new Error('Sesión expirada');
    }

    if (response.status === 403) {
      if (logout) await logout();
      throw new Error('Acceso denegado');
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


