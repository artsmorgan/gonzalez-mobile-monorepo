import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface CreateEvaluationParams {
  requestData: {
    marca_id: number;
    empleado_id: number;
    evaluador_id: number;
    fecha_ingreso: string;
    fecha_evaluacion: string;
    evaluacion: string;
    comentarios: string;
    firma_evaluador: string;
    firma_empleado: string;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface ApiResponse {
  status: boolean;
  message: string;
}

export const createEvaluation = async ({
  requestData,
  refreshAccessToken,
  logout,
}: CreateEvaluationParams): Promise<ApiResponse> => {
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
        return createEvaluation({ requestData, refreshAccessToken, logout });
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
    console.error('Error creating evaluation:', error);
    return {
      status: false,
      message: 'Error al crear la evaluación',
    };
  }
};
