import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import authedFetch from './authedFetch';

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

export type StaffEvaluationSignatureField = 'firma_empleado' | 'firma_empleado_manual';

interface UpdateStaffEvaluationSignatureParams {
  evaluationId: number;
  field: StaffEvaluationSignatureField;
  value: string | null;
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

    const response = await authedFetch({
      url: `${apiUrl}/api/evaluation`,
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      },
      refreshAccessToken,
      logout,
    });

    if (!response) {
      throw new Error('Sesión expirada');
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

    const response = await authedFetch({
      url: `${apiUrl}/api/evaluation/${id}`,
      init: {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      refreshAccessToken,
      logout,
    });

    if (!response) {
      throw new Error('Sesión expirada');
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

export const updateStaffEvaluationSignature = async ({
  evaluationId,
  field,
  value,
  refreshAccessToken,
  logout,
}: UpdateStaffEvaluationSignatureParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    const response = await authedFetch({
      url: `${apiUrl}/api/evaluation/${evaluationId}`,
      init: {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ field, value: value ?? '' }),
      },
      refreshAccessToken,
      logout,
    });

    if (!response) {
      throw new Error('Sesión expirada');
    }

    const data: ApiResponse = await response.json();

    if (!response.ok || !data.status) {
      throw new Error(data.message || `HTTP error! status: ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error('Error updating staff evaluation signature:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al actualizar la firma',
    };
  }
};


