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

interface CreateMileageControlParams {
  requestData: {
    marca_id: number;
    chofer_id: string;
    chofer_nombre: string;
    total_km: string | null;
    ruta: string | null;
    prox_mant_km: string | null;
    km_para_mantenimiento: string | null;
    km_actual: string;
    estado: string;
    vehiculo_id: string;
    registros_viaje: any[];
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface UpdateMileageControlParams {
  id: string;
  requestData: {
    chofer_id?: string;
    chofer_nombre?: string;
    total_km?: string | null;
    ruta?: string | null;
    prox_mant_km?: string | null;
    km_para_mantenimiento?: string | null;
    km_actual?: string;
    estado?: string;
    vehiculo_id?: string;
    registros_viaje?: any[];
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface DeleteMileageControlParams {
  id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface ListMileageControlsByCorpoParams {
  corpo_id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface ApiResponse {
  status: boolean;
  message: string;
  data?: any;
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

export const createMileageControl = async ({
  requestData,
  refreshAccessToken,
  logout,
}: CreateMileageControlParams): Promise<ApiResponse> => {
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

    const response = await fetch(`${apiUrl}/api/mileage-control`, {
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
        return createMileageControl({ requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating mileage control:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al crear el control de kilometraje',
    };
  }
};

export const updateMileageControl = async ({
  id,
  requestData,
  refreshAccessToken,
  logout,
}: UpdateMileageControlParams): Promise<ApiResponse> => {
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

    const response = await fetch(`${apiUrl}/api/mileage-control/${id}`, {
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
        return updateMileageControl({ id, requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating mileage control:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al actualizar el control de kilometraje',
    };
  }
};

export const deleteMileageControl = async ({
  id,
  refreshAccessToken,
  logout,
}: DeleteMileageControlParams): Promise<ApiResponse> => {
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

    const response = await fetch(`${apiUrl}/api/mileage-control/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401 || response.status === 403) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return deleteMileageControl({ id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error deleting mileage control:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al eliminar el control de kilometraje',
    };
  }
};

export const listMileageControlsByCorpo = async ({
  corpo_id,
  refreshAccessToken,
  logout,
}: ListMileageControlsByCorpoParams): Promise<ApiResponse> => {
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

    const response = await fetch(`${apiUrl}/api/mileage-control/corpo/${corpo_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401 || response.status === 403) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return listMileageControlsByCorpo({ corpo_id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error listing mileage controls:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al listar los controles de kilometraje',
      data: [],
    };
  }
};

