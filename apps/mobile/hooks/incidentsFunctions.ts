import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  BasicResponse,
  CreateIncidentRequest,
  CreateIncidentResponse,
  CreateIncidentContributionRequest,
  ExecutivesResponse,
  IncidentContributionsListResponse,
  IncidentsClassificationsResponse,
  IncidentsListResponse,
  UpdateIncidentContributionRequest,
  UpdateIncidentRequest,
} from './incidentsTypes';

type ListIncidentsParams = {
  marcaId: number;
  refreshAccessToken?: () => Promise<boolean>;
  logout?: () => Promise<any>;
};

type ListIncidentClassificationsParams = {
  refreshAccessToken?: () => Promise<boolean>;
  logout?: () => Promise<any>;
};

type ListExecutivesParams = {
  refreshAccessToken?: () => Promise<boolean>;
  logout?: () => Promise<any>;
};

type CreateIncidentParams = {
  requestData: CreateIncidentRequest;
  refreshAccessToken?: () => Promise<boolean>;
  logout?: () => Promise<any>;
};

type UpdateIncidentParams = {
  requestData: UpdateIncidentRequest;
  incidentId: number;
  refreshAccessToken?: () => Promise<boolean>;
  logout?: () => Promise<any>;
};

type ListIncidentContributionsParams = {
  incidentId: number;
  refreshAccessToken?: () => Promise<boolean>;
  logout?: () => Promise<any>;
};

type CreateIncidentContributionParams = {
  incidentId: number;
  requestData: CreateIncidentContributionRequest;
  refreshAccessToken?: () => Promise<boolean>;
  logout?: () => Promise<any>;
};

type UpdateIncidentContributionParams = {
  incidentId: number;
  contributionId: number;
  requestData: UpdateIncidentContributionRequest;
  refreshAccessToken?: () => Promise<boolean>;
  logout?: () => Promise<any>;
};

type DeleteIncidentContributionParams = {
  incidentId: number;
  contributionId: number;
  refreshAccessToken?: () => Promise<boolean>;
  logout?: () => Promise<any>;
};

type DeleteIncidentContributionFileParams = {
  incidentId: number;
  contributionId: number;
  fileId: number;
  refreshAccessToken?: () => Promise<boolean>;
  logout?: () => Promise<any>;
};

const normalizeBase64 = (b64: string) => {
  const idx = b64.indexOf('base64,');
  if (idx !== -1) return b64.slice(idx + 'base64,'.length);
  return b64;
};

export const listIncidentsByMarca = async ({ marcaId, refreshAccessToken, logout }: ListIncidentsParams): Promise<IncidentsListResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      if (refreshAccessToken) {
        const refreshed = await refreshAccessToken();
        if (!refreshed) throw new Error('No authentication token found');
        token = await AsyncStorage.getItem('access_token');
      } else {
        throw new Error('No authentication token found');
      }
    }

    const response = await fetch(`${apiUrl}/api/incidents?m=${marcaId}`, {
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
        if (refreshed) return listIncidentsByMarca({ marcaId, refreshAccessToken, logout });
        if (logout) await logout();
      }
      return { status: false, message: 'Sesión expirada' };
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('Error listing incidents:', error);
    return { status: false, message: error.message || 'Error al cargar los incidentes' };
  }
};

export const listIncidentClassifications = async ({ refreshAccessToken, logout }: ListIncidentClassificationsParams): Promise<IncidentsClassificationsResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      if (refreshAccessToken) {
        const refreshed = await refreshAccessToken();
        if (!refreshed) throw new Error('No authentication token found');
        token = await AsyncStorage.getItem('access_token');
      } else {
        throw new Error('No authentication token found');
      }
    }

    const response = await fetch(`${apiUrl}/api/incidents/classification`, {
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
        if (refreshed) return listIncidentClassifications({ refreshAccessToken, logout });
        if (logout) await logout();
      }
      return { status: false, message: 'Sesión expirada' };
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('Error listing incident classifications:', error);
    return { status: false, message: error.message || 'Error al cargar clasificaciones' };
  }
};

export const listExecutives = async ({ refreshAccessToken, logout }: ListExecutivesParams): Promise<ExecutivesResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      if (refreshAccessToken) {
        const refreshed = await refreshAccessToken();
        if (!refreshed) throw new Error('No authentication token found');
        token = await AsyncStorage.getItem('access_token');
      } else {
        throw new Error('No authentication token found');
      }
    }

    const response = await fetch(`${apiUrl}/api/executives`, {
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
        if (refreshed) return listExecutives({ refreshAccessToken, logout });
        if (logout) await logout();
      }
      return { status: false, message: 'Sesión expirada' };
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('Error listing executives:', error);
    return { status: false, message: error.message || 'Error al cargar ejecutivos' };
  }
};

export const createIncident = async ({ requestData, refreshAccessToken, logout }: CreateIncidentParams): Promise<CreateIncidentResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      if (refreshAccessToken) {
        const refreshed = await refreshAccessToken();
        if (!refreshed) {
          throw new Error('No authentication token found');
        }
        token = await AsyncStorage.getItem('access_token');
      } else {
        throw new Error('No authentication token found');
      }
    }

    // Normalizar archivos: el server acepta string JSON o array, pero siempre guardamos base64 puro
    const payload: any = { ...requestData };
    if (Array.isArray(payload.archivos)) {
      payload.archivos = payload.archivos.map((f: any) => ({
        ...f,
        file_base64: typeof f.file_base64 === 'string' ? normalizeBase64(f.file_base64) : f.file_base64,
      }));
    }

    const response = await fetch(`${apiUrl}/api/incidents`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(payload),
    });

    if (response.status === 401 || response.status === 403) {
      if (refreshAccessToken) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          return createIncident({ requestData, refreshAccessToken, logout });
        } else if (logout) {
          await logout();
          return { status: false, message: 'Sesión expirada' };
        }
      }
      return { status: false, message: 'Sesión expirada' };
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: CreateIncidentResponse = await response.json();
    return data;
  } catch (error: any) {
    console.error('Error creating incident:', error);
    return { status: false, message: error.message || 'Error al crear el incidente' };
  }
};

export const updateIncident = async ({ requestData, incidentId, refreshAccessToken, logout }: UpdateIncidentParams): Promise<BasicResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      if (refreshAccessToken) {
        const refreshed = await refreshAccessToken();
        if (!refreshed) {
          throw new Error('No authentication token found');
        }
        token = await AsyncStorage.getItem('access_token');
      } else {
        throw new Error('No authentication token found');
      }
    }

    const response = await fetch(`${apiUrl}/api/incidents/${incidentId}`, {
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
        if (refreshed) {
          return updateIncident({ requestData, incidentId, refreshAccessToken, logout });
        } else if (logout) {
          await logout();
          return { status: false, message: 'Sesión expirada' };
        }
      }
      return { status: false, message: 'Sesión expirada' };
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: BasicResponse = await response.json();
    return data;
  } catch (error: any) {
    console.error('Error updating incident:', error);
    return { status: false, message: error.message || 'Error al actualizar el incidente' };
  }
};

interface DeleteIncidentParams {
  incidentId: number;
  refreshAccessToken?: () => Promise<boolean>;
  logout?: () => Promise<any>;
}

export const deleteIncident = async ({ incidentId, refreshAccessToken, logout }: DeleteIncidentParams): Promise<BasicResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      if (refreshAccessToken) {
        const refreshed = await refreshAccessToken();
        if (!refreshed) throw new Error('No authentication token found');
        token = await AsyncStorage.getItem('access_token');
      } else {
        throw new Error('No authentication token found');
      }
    }

    const response = await fetch(`${apiUrl}/api/incidents/${incidentId}`, {
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
        if (refreshed) return deleteIncident({ incidentId, refreshAccessToken, logout });
        if (logout) await logout();
      }
      return { status: false, message: 'Sesión expirada' };
    }

    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `HTTP error! status: ${response.status}`);
    return data;
  } catch (error: any) {
    console.error('Error deleting incident:', error);
    return { status: false, message: error.message || 'Error al eliminar el incidente' };
  }
};

interface DeleteIncidentFileParams {
  incidentId: number;
  fileId: number;
  refreshAccessToken?: () => Promise<boolean>;
  logout?: () => Promise<any>;
}

export const deleteIncidentFile = async ({ incidentId, fileId, refreshAccessToken, logout }: DeleteIncidentFileParams): Promise<BasicResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      if (refreshAccessToken) {
        const refreshed = await refreshAccessToken();
        if (!refreshed) throw new Error('No authentication token found');
        token = await AsyncStorage.getItem('access_token');
      } else {
        throw new Error('No authentication token found');
      }
    }

    const response = await fetch(`${apiUrl}/api/incidents/${incidentId}/files/${fileId}`, {
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
        if (refreshed) return deleteIncidentFile({ incidentId, fileId, refreshAccessToken, logout });
        if (logout) await logout();
      }
      return { status: false, message: 'Sesión expirada' };
    }

    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `HTTP error! status: ${response.status}`);
    return data;
  } catch (error: any) {
    console.error('Error deleting incident file:', error);
    return { status: false, message: error.message || 'Error al eliminar el archivo' };
  }
};

export const listIncidentContributions = async ({
  incidentId,
  refreshAccessToken,
  logout,
}: ListIncidentContributionsParams): Promise<IncidentContributionsListResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      if (refreshAccessToken) {
        const refreshed = await refreshAccessToken();
        if (!refreshed) throw new Error('No authentication token found');
        token = await AsyncStorage.getItem('access_token');
      } else {
        throw new Error('No authentication token found');
      }
    }

    const response = await fetch(`${apiUrl}/api/incidents/${incidentId}/contributions`, {
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
        if (refreshed) return listIncidentContributions({ incidentId, refreshAccessToken, logout });
        if (logout) await logout();
      }
      return { status: false, message: 'Sesión expirada' };
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('Error listing incident contributions:', error);
    return { status: false, message: error.message || 'Error al cargar aportes' };
  }
};

export const createIncidentContribution = async ({
  incidentId,
  requestData,
  refreshAccessToken,
  logout,
}: CreateIncidentContributionParams): Promise<any> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      if (refreshAccessToken) {
        const refreshed = await refreshAccessToken();
        if (!refreshed) throw new Error('No authentication token found');
        token = await AsyncStorage.getItem('access_token');
      } else {
        throw new Error('No authentication token found');
      }
    }

    const payload: any = { ...requestData };
    if (Array.isArray(payload.archivos)) {
      payload.archivos = payload.archivos.map((f: any) => ({
        ...f,
        file_base64: typeof f.file_base64 === 'string' ? normalizeBase64(f.file_base64) : f.file_base64,
      }));
    }

    const response = await fetch(`${apiUrl}/api/incidents/${incidentId}/contributions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(payload),
    });

    if (response.status === 401 || response.status === 403) {
      if (refreshAccessToken) {
        const refreshed = await refreshAccessToken();
        if (refreshed) return createIncidentContribution({ incidentId, requestData, refreshAccessToken, logout });
        if (logout) await logout();
      }
      return { status: false, message: 'Sesión expirada' };
    }

    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `HTTP error! status: ${response.status}`);
    return data;
  } catch (error: any) {
    console.error('Error creating incident contribution:', error);
    return { status: false, message: error.message || 'Error al crear aporte' };
  }
};

export const updateIncidentContribution = async ({
  incidentId,
  contributionId,
  requestData,
  refreshAccessToken,
  logout,
}: UpdateIncidentContributionParams): Promise<BasicResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      if (refreshAccessToken) {
        const refreshed = await refreshAccessToken();
        if (!refreshed) throw new Error('No authentication token found');
        token = await AsyncStorage.getItem('access_token');
      } else {
        throw new Error('No authentication token found');
      }
    }

    const payload: any = { ...requestData };
    if (Array.isArray(payload.archivos)) {
      payload.archivos = payload.archivos.map((f: any) => ({
        ...f,
        file_base64: typeof f.file_base64 === 'string' ? normalizeBase64(f.file_base64) : f.file_base64,
      }));
    }

    const response = await fetch(`${apiUrl}/api/incidents/${incidentId}/contributions/${contributionId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(payload),
    });

    if (response.status === 401 || response.status === 403) {
      if (refreshAccessToken) {
        const refreshed = await refreshAccessToken();
        if (refreshed) return updateIncidentContribution({ incidentId, contributionId, requestData, refreshAccessToken, logout });
        if (logout) await logout();
      }
      return { status: false, message: 'Sesión expirada' };
    }

    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `HTTP error! status: ${response.status}`);
    return data;
  } catch (error: any) {
    console.error('Error updating incident contribution:', error);
    return { status: false, message: error.message || 'Error al actualizar aporte' };
  }
};

export const deleteIncidentContribution = async ({
  incidentId,
  contributionId,
  refreshAccessToken,
  logout,
}: DeleteIncidentContributionParams): Promise<BasicResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      if (refreshAccessToken) {
        const refreshed = await refreshAccessToken();
        if (!refreshed) throw new Error('No authentication token found');
        token = await AsyncStorage.getItem('access_token');
      } else {
        throw new Error('No authentication token found');
      }
    }

    const response = await fetch(`${apiUrl}/api/incidents/${incidentId}/contributions/${contributionId}`, {
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
        if (refreshed) return deleteIncidentContribution({ incidentId, contributionId, refreshAccessToken, logout });
        if (logout) await logout();
      }
      return { status: false, message: 'Sesión expirada' };
    }

    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `HTTP error! status: ${response.status}`);
    return data;
  } catch (error: any) {
    console.error('Error deleting incident contribution:', error);
    return { status: false, message: error.message || 'Error al eliminar aporte' };
  }
};

export const deleteIncidentContributionFile = async ({
  incidentId,
  contributionId,
  fileId,
  refreshAccessToken,
  logout,
}: DeleteIncidentContributionFileParams): Promise<BasicResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      if (refreshAccessToken) {
        const refreshed = await refreshAccessToken();
        if (!refreshed) throw new Error('No authentication token found');
        token = await AsyncStorage.getItem('access_token');
      } else {
        throw new Error('No authentication token found');
      }
    }

    const response = await fetch(`${apiUrl}/api/incidents/${incidentId}/contributions/${contributionId}/files/${fileId}`, {
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
        if (refreshed) return deleteIncidentContributionFile({ incidentId, contributionId, fileId, refreshAccessToken, logout });
        if (logout) await logout();
      }
      return { status: false, message: 'Sesión expirada' };
    }

    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `HTTP error! status: ${response.status}`);
    return data;
  } catch (error: any) {
    console.error('Error deleting contribution file:', error);
    return { status: false, message: error.message || 'Error al eliminar archivo' };
  }
};

