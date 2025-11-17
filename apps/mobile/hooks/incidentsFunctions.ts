import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface CreateIncidentParams {
  requestData: {
    marca_id: number;
    empleado_id: number;
    fecha_incidente: string;
    fecha_reporte: string;
    nombre_responsable: string;
    clasificacion_id: number;
    descripcion: string;
    involucrados: string; // JSON string
    fecha_libro_novedades: string; // JSON string
    nombre_responsable_atencion: string;
    file_image?: string; // Base64 image
    file_audio?: string; // Base64 audio
  };
  refreshAccessToken?: () => Promise<boolean>;
  logout?: () => Promise<any>;
}

interface UpdateIncidentParams {
  requestData: {
    solucion: string;
    fecha_solucion: string;
    fecha_real_solucion: string;
    costo_asociado: string;
    consecutivo_informe: string;
    link_informe: string;
  };
  incidentId: number;
  refreshAccessToken?: () => Promise<boolean>;
  logout?: () => Promise<any>;
}

export const createIncident = async ({ requestData, refreshAccessToken, logout }: CreateIncidentParams): Promise<{ status: boolean; message: string }> => {
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

    const response = await fetch(`${apiUrl}/api/incidents`, {
      method: 'POST',
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

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('Error creating incident:', error);
    return { status: false, message: error.message || 'Error al crear el incidente' };
  }
};

export const updateIncident = async ({ requestData, incidentId, refreshAccessToken, logout }: UpdateIncidentParams): Promise<{ status: boolean; message: string }> => {
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

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('Error updating incident:', error);
    return { status: false, message: error.message || 'Error al actualizar el incidente' };
  }
};

