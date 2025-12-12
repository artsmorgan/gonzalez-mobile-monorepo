import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

interface CreateStaffEvaluationParams {
  requestData: any;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface DeleteStaffEvaluationParams {
  id: number;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface ApiResponse {
  status: boolean;
  message: string;
  data?: any;
}

export const createStaffEvaluation = async ({
  requestData,
  refreshAccessToken,
  logout,
}: CreateStaffEvaluationParams): Promise<ApiResponse> => {
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

    const response = await fetch(`${apiUrl}/api/evaluation`, {
      method: 'POST',
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
        return createStaffEvaluation({ requestData, refreshAccessToken, logout });
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
    console.error('Error creating staff evaluation:', error);
    return {
      status: false,
      message: 'Error al crear la evaluación de personal',
    };
  }
};

export const deleteStaffEvaluation = async ({
  id,
  refreshAccessToken,
  logout,
}: DeleteStaffEvaluationParams): Promise<ApiResponse> => {
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

    const response = await fetch(`${apiUrl}/api/evaluation/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401 || response.status === 403) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return deleteStaffEvaluation({ id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    const data: ApiResponse = await response.json();

    if (!response.ok || !data.status) {
      throw new Error(data.message || `HTTP error! status: ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error('Error deleting staff evaluation:', error);
    return {
      status: false,
      message: 'Error al eliminar la evaluación de personal',
    };
  }
};


