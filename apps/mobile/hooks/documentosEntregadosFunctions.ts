import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import authedFetch from './authedFetch';

type BasicResponse = { status: boolean; message?: string;[k: string]: any };

export type DocumentoEntregadoItem = {
  id: number;
  cliente_id: number;
  corpo_id: number;
  empresa_id?: number;
  division_id?: number;
  contrato_id?: number;
  puesto_id?: number;
  fecha: string; // ISO / yyyy-mm-dd
  nombre_oficial_entrega: string;
  nombre_oficial_recibe: string;
  tipo_documento: string;
  descripcion: string;
  firma_representante_cliente: string;
  firma_responsable: string;
  id_local?: string;
  isActive?: boolean;
};

export type DocumentTypeItem = {
  id: number;
  nombre: string;
};

export type ListDocumentosEntregadosResponse = {
  status: boolean;
  data?: DocumentoEntregadoItem[];
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
  corpoId: number;
  clienteId: number;
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

export async function listDocumentosEntregados({
  corpoId,
  refreshAccessToken,
  logout,
}: ListParams): Promise<ListDocumentosEntregadosResponse> {
  try {
    const apiUrl = getApiUrl();
    const { refreshAccessToken: refresh, logout: doLogout } = requireAuthHandlers(refreshAccessToken, logout);

    const response = await authedFetch({
      url: `${apiUrl}/api/documentos-entregados?corpo_id=${encodeURIComponent(String(corpoId))}`,
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

    const data: any = await response.json();
    if (data?.data && Array.isArray(data.data)) {
      data.data = data.data.filter((r: any) => r && (r as any).isActive !== false);
    }
    return data;
  } catch (error: any) {
    console.error('Error listing documentos entregados:', error);
    return { status: false, message: error.message || 'Error al cargar documentos entregados' };
  }
}

export async function createDocumentoEntregado({
  requestData,
  refreshAccessToken,
  logout,
}: CreateParams): Promise<BasicResponse> {
  try {
    const apiUrl = getApiUrl();
    const { refreshAccessToken: refresh, logout: doLogout } = requireAuthHandlers(refreshAccessToken, logout);

    const response = await authedFetch({
      url: `${apiUrl}/api/documentos-entregados`,
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
    const id = data.id != null ? Number(data.id) : data?.data?.id != null ? Number(data.data.id) : undefined;
    return { ...data, id };
  } catch (error: any) {
    console.error('Error creating documento entregado:', error);
    return { status: false, message: error.message || 'Error al crear documento entregado' };
  }
}

export async function updateDocumentoEntregado({
  id,
  requestData,
  refreshAccessToken,
  logout,
}: UpdateParams): Promise<BasicResponse> {
  try {
    const apiUrl = getApiUrl();
    const { refreshAccessToken: refresh, logout: doLogout } = requireAuthHandlers(refreshAccessToken, logout);

    const response = await authedFetch({
      url: `${apiUrl}/api/documentos-entregados/${id}`,
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
    console.error('Error updating documento entregado:', error);
    return { status: false, message: error.message || 'Error al actualizar documento entregado' };
  }
}

export async function deleteDocumentoEntregado({
  id,
  corpoId,
  clienteId,
  refreshAccessToken,
  logout,
}: DeleteParams): Promise<BasicResponse> {
  try {
    const apiUrl = getApiUrl();
    const { refreshAccessToken: refresh, logout: doLogout } = requireAuthHandlers(refreshAccessToken, logout);

    const response = await authedFetch({
      url: `${apiUrl}/api/documentos-entregados/${id}?corpo_id=${encodeURIComponent(String(corpoId))}&cliente_id=${encodeURIComponent(String(clienteId))}`,
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
    console.error('Error deleting documento entregado:', error);
    return { status: false, message: error.message || 'Error al eliminar documento entregado' };
  }
}

export async function getDocumentTypes({
  refreshAccessToken,
  logout,
}: {
  refreshAccessToken?: () => Promise<boolean>;
  logout?: () => Promise<any>;
}): Promise<{ status: boolean; documentTypes?: DocumentTypeItem[]; message?: string }> {
  try {
    const apiUrl = getApiUrl();
    const { refreshAccessToken: refresh, logout: doLogout } = requireAuthHandlers(refreshAccessToken, logout);

    const response = await authedFetch({
      url: `${apiUrl}/api/document-types`,
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
    if (data?.status && Array.isArray(data.documentTypes)) {
      await AsyncStorage.setItem('document_types_cache', JSON.stringify(data.documentTypes));
    }
    return data;
  } catch (error: any) {
    // fallback offline: document_types_cache
    const cacheStr = await AsyncStorage.getItem('document_types_cache');
    if (cacheStr) {
      try {
        const cached = JSON.parse(cacheStr);
        if (Array.isArray(cached)) {
          return { status: true, documentTypes: cached };
        }
      } catch { }
    }
    return { status: false, message: error.message || 'Error al cargar tipos de documento' };
  }
}


