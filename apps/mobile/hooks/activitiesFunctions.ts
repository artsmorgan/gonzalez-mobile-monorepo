import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface UpdateActivityParams {
  requestData: {
    e: number;
    estado: 'marcar' | 'desmarcar';
    bitacora: string;
  };
  activityId: number;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface UpdateRevisionEquipoParams {
  requestData: {
    e: number;
    es_correcto: boolean;
    motivo_incorrecto: string;
  };
  revisionEquipoId: number;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface ApiResponse {
  status: boolean;
  message: string;
}

export const updateActivity = async ({
  requestData,
  activityId,
  refreshAccessToken,
  logout,
}: UpdateActivityParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        throw new Error('No authentication token found');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/activities/${activityId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401 || response.status === 403) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return updateActivity({ requestData, activityId, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating activity:', error);
    return {
      status: false,
      message: 'Error al actualizar la actividad',
    };
  }
};

export const updateRevisionEquipo = async ({
  requestData,
  revisionEquipoId,
  refreshAccessToken,
  logout,
}: UpdateRevisionEquipoParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        throw new Error('No authentication token found');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/activities/equipo/${revisionEquipoId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401 || response.status === 403) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return updateRevisionEquipo({ requestData, revisionEquipoId, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating revision equipo:', error);
    return {
      status: false,
      message: 'Error al actualizar la revisión del equipo',
    };
  }
};

