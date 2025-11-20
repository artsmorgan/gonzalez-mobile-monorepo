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

interface CreateUniformRequestParams {
  requestData: {
    marca_id: number;
    codigo: string;
    nombre_completo: string;
    cliente_area: string;
    ultima_fecha_uniformes: string;
    talla_scrub_naranja: string;
    talla_pantalon: string;
    talla_zapatos: string;
    estado: string | null;
    persona_designada_entrega: string | null;
    no_procede_hasta: string | null;
    estatus_designado_entrega: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface UpdateUniformRequestParams {
  id: string;
  requestData: {
    codigo?: string;
    nombre_completo?: string;
    cliente_area?: string;
    ultima_fecha_uniformes?: string;
    talla_scrub_naranja?: string;
    talla_pantalon?: string;
    talla_zapatos?: string;
    estado?: string | null;
    persona_designada_entrega?: string | null;
    no_procede_hasta?: string | null;
    estatus_designado_entrega?: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface DeleteUniformRequestParams {
  id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface ListUniformRequestsByCorpoParams {
  corpo_id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

export const createUniformRequest = async ({
  requestData,
  refreshAccessToken,
  logout,
}: CreateUniformRequestParams): Promise<ApiResponse> => {
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

    const response = await fetch(`${apiUrl}/api/uniform-request`, {
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
        return createUniformRequest({ requestData, refreshAccessToken, logout });
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
    console.error('Error creating uniform request:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al crear la solicitud de uniforme',
    };
  }
};

export const updateUniformRequest = async ({
  id,
  requestData,
  refreshAccessToken,
  logout,
}: UpdateUniformRequestParams): Promise<ApiResponse> => {
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

    const response = await fetch(`${apiUrl}/api/uniform-request/${id}`, {
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
        return updateUniformRequest({ id, requestData, refreshAccessToken, logout });
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
    console.error('Error updating uniform request:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al actualizar la solicitud de uniforme',
    };
  }
};

export const deleteUniformRequest = async ({
  id,
  refreshAccessToken,
  logout,
}: DeleteUniformRequestParams): Promise<ApiResponse> => {
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

    const response = await fetch(`${apiUrl}/api/uniform-request/${id}`, {
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
        return deleteUniformRequest({ id, refreshAccessToken, logout });
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
    console.error('Error deleting uniform request:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al eliminar la solicitud de uniforme',
    };
  }
};

export const listUniformRequestsByCorpo = async ({
  corpo_id,
  refreshAccessToken,
  logout,
}: ListUniformRequestsByCorpoParams): Promise<ApiResponse> => {
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

    const response = await fetch(`${apiUrl}/api/uniform-request/corpo/${corpo_id}`, {
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
        return listUniformRequestsByCorpo({ corpo_id, refreshAccessToken, logout });
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
    console.error('Error listing uniform requests:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al listar las solicitudes de uniforme',
      data: [],
    };
  }
};

interface CreateRouteAndTourParams {
  requestData: {
    marca_id: number;
    sociedad: string;
    cliente: string;
    zona: string;
    cantidad_personal: string;
    gira_ruta: string;
    dia_entrega: string;
    estatus: string | null;
    cumplimiento_supervision: string | null;
    cumplimiento_entrega_insumos: string | null;
    persona_refuerzo: string | null;
    notas_cambios: string | null;
    estado: string | null;
    nombre_persona_refuerzo: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface UpdateRouteAndTourParams {
  id: string;
  requestData: {
    sociedad?: string;
    cliente?: string;
    zona?: string;
    cantidad_personal?: string;
    gira_ruta?: string;
    dia_entrega?: string;
    estatus?: string | null;
    cumplimiento_supervision?: string | null;
    cumplimiento_entrega_insumos?: string | null;
    persona_refuerzo?: string | null;
    notas_cambios?: string | null;
    estado?: string | null;
    nombre_persona_refuerzo?: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface DeleteRouteAndTourParams {
  id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface ListRoutesAndToursByCorpoParams {
  corpo_id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

export const createRouteAndTour = async ({
  requestData,
  refreshAccessToken,
  logout,
}: CreateRouteAndTourParams): Promise<ApiResponse> => {
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

    const response = await fetch(`${apiUrl}/api/routes-and-tours`, {
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
        return createRouteAndTour({ requestData, refreshAccessToken, logout });
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
    console.error('Error creating route and tour:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al crear la ruta o gira',
    };
  }
};

export const updateRouteAndTour = async ({
  id,
  requestData,
  refreshAccessToken,
  logout,
}: UpdateRouteAndTourParams): Promise<ApiResponse> => {
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

    const response = await fetch(`${apiUrl}/api/routes-and-tours/${id}`, {
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
        return updateRouteAndTour({ id, requestData, refreshAccessToken, logout });
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
    console.error('Error updating route and tour:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al actualizar la ruta o gira',
    };
  }
};

export const deleteRouteAndTour = async ({
  id,
  refreshAccessToken,
  logout,
}: DeleteRouteAndTourParams): Promise<ApiResponse> => {
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

    const response = await fetch(`${apiUrl}/api/routes-and-tours/${id}`, {
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
        return deleteRouteAndTour({ id, refreshAccessToken, logout });
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
    console.error('Error deleting route and tour:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al eliminar la ruta o gira',
    };
  }
};

export const listRoutesAndToursByCorpo = async ({
  corpo_id,
  refreshAccessToken,
  logout,
}: ListRoutesAndToursByCorpoParams): Promise<ApiResponse> => {
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

    const response = await fetch(`${apiUrl}/api/routes-and-tours/corpo/${corpo_id}`, {
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
        return listRoutesAndToursByCorpo({ corpo_id, refreshAccessToken, logout });
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
    console.error('Error listing routes and tours:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al listar las rutas y giras',
      data: [],
    };
  }
};

interface CreateEmployeeSatisfactionParams {
  requestData: {
    marca_id: number;
    nombre_empleado: string;
    cliente_sede: string;
    tiempo_laborado: string | null;
    recibe_uniformes_tiempo: string | null;
    llevo_induccion: string | null;
    calificacion_induccion: string | null;
    recibe_visitas_supervision: string | null;
    recibe_atencion_oficina: string | null;
    problemas_pago_resueltos: string | null;
    equipo_proteccion: string | null;
    que_mejorar: string | null;
    considera_empresa_debe_mejorar: string | null;
    conoce_reportar_accidente: string | null;
    le_gustaria_capacitado: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface UpdateEmployeeSatisfactionParams {
  id: string;
  requestData: {
    nombre_empleado?: string;
    cliente_sede?: string;
    tiempo_laborado?: string | null;
    recibe_uniformes_tiempo?: string | null;
    llevo_induccion?: string | null;
    calificacion_induccion?: string | null;
    recibe_visitas_supervision?: string | null;
    recibe_atencion_oficina?: string | null;
    problemas_pago_resueltos?: string | null;
    equipo_proteccion?: string | null;
    que_mejorar?: string | null;
    considera_empresa_debe_mejorar?: string | null;
    conoce_reportar_accidente?: string | null;
    le_gustaria_capacitado?: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface DeleteEmployeeSatisfactionParams {
  id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface ListEmployeeSatisfactionByCorpoParams {
  corpo_id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

export const createEmployeeSatisfaction = async ({
  requestData,
  refreshAccessToken,
  logout,
}: CreateEmployeeSatisfactionParams): Promise<ApiResponse> => {
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

    const response = await fetch(`${apiUrl}/api/employee-satisfaction`, {
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
        return createEmployeeSatisfaction({ requestData, refreshAccessToken, logout });
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
    console.error('Error creating employee satisfaction:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al crear la encuesta de satisfacción',
    };
  }
};

export const updateEmployeeSatisfaction = async ({
  id,
  requestData,
  refreshAccessToken,
  logout,
}: UpdateEmployeeSatisfactionParams): Promise<ApiResponse> => {
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

    const response = await fetch(`${apiUrl}/api/employee-satisfaction/${id}`, {
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
        return updateEmployeeSatisfaction({ id, requestData, refreshAccessToken, logout });
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
    console.error('Error updating employee satisfaction:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al actualizar la encuesta de satisfacción',
    };
  }
};

export const deleteEmployeeSatisfaction = async ({
  id,
  refreshAccessToken,
  logout,
}: DeleteEmployeeSatisfactionParams): Promise<ApiResponse> => {
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

    const response = await fetch(`${apiUrl}/api/employee-satisfaction/${id}`, {
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
        return deleteEmployeeSatisfaction({ id, refreshAccessToken, logout });
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
    console.error('Error deleting employee satisfaction:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al eliminar la encuesta de satisfacción',
    };
  }
};

export const listEmployeeSatisfactionByCorpo = async ({
  corpo_id,
  refreshAccessToken,
  logout,
}: ListEmployeeSatisfactionByCorpoParams): Promise<ApiResponse> => {
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

    const response = await fetch(`${apiUrl}/api/employee-satisfaction/corpo/${corpo_id}`, {
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
        return listEmployeeSatisfactionByCorpo({ corpo_id, refreshAccessToken, logout });
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
    console.error('Error listing employee satisfaction:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al listar las encuestas de satisfacción',
      data: [],
    };
  }
};

interface CreateVehicleMaintenanceParams {
  requestData: {
    marca_id: number;
    nombre_vehiculo: string;
    matricula_vehiculo: string;
    mantenimientos: any[];
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface UpdateVehicleMaintenanceParams {
  id: string;
  requestData: {
    nombre_vehiculo?: string;
    matricula_vehiculo?: string;
    mantenimientos?: any[];
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface DeleteVehicleMaintenanceParams {
  id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface ListVehicleMaintenanceByCorpoParams {
  corpo_id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

export const createVehicleMaintenance = async ({
  requestData,
  refreshAccessToken,
  logout,
}: CreateVehicleMaintenanceParams): Promise<ApiResponse> => {
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

    const response = await fetch(`${apiUrl}/api/vehicle-maintenance`, {
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
        return createVehicleMaintenance({ requestData, refreshAccessToken, logout });
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
    console.error('Error creating vehicle maintenance:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al crear la planificación de mantenimiento',
    };
  }
};

export const updateVehicleMaintenance = async ({
  id,
  requestData,
  refreshAccessToken,
  logout,
}: UpdateVehicleMaintenanceParams): Promise<ApiResponse> => {
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

    const response = await fetch(`${apiUrl}/api/vehicle-maintenance/${id}`, {
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
        return updateVehicleMaintenance({ id, requestData, refreshAccessToken, logout });
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
    console.error('Error updating vehicle maintenance:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al actualizar la planificación de mantenimiento',
    };
  }
};

export const deleteVehicleMaintenance = async ({
  id,
  refreshAccessToken,
  logout,
}: DeleteVehicleMaintenanceParams): Promise<ApiResponse> => {
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

    const response = await fetch(`${apiUrl}/api/vehicle-maintenance/${id}`, {
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
        return deleteVehicleMaintenance({ id, refreshAccessToken, logout });
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
    console.error('Error deleting vehicle maintenance:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al eliminar la planificación de mantenimiento',
    };
  }
};

export const listVehicleMaintenanceByCorpo = async ({
  corpo_id,
  refreshAccessToken,
  logout,
}: ListVehicleMaintenanceByCorpoParams): Promise<ApiResponse> => {
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

    const response = await fetch(`${apiUrl}/api/vehicle-maintenance/corpo/${corpo_id}`, {
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
        return listVehicleMaintenanceByCorpo({ corpo_id, refreshAccessToken, logout });
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
    console.error('Error listing vehicle maintenance:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al listar las planificaciones de mantenimiento',
      data: [],
    };
  }
};

interface CreateNonConformingProductParams {
  requestData: {
    marca_id: number;
    cliente: string | null;
    numero_corpo: string | null;
    responsable_cuenta: string | null;
    macroactividad: string | null;
    actividad: string | null;
    tipo_servicio_no_conforme: string | null;
    tipo_registro: string | null;
    responsable_registro: string | null;
    acciones_seguir: string | null;
    responsable_corregir: string | null;
    responsable_aprobar: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface UpdateNonConformingProductParams {
  id: string;
  requestData: {
    cliente?: string | null;
    numero_corpo?: string | null;
    responsable_cuenta?: string | null;
    macroactividad?: string | null;
    actividad?: string | null;
    tipo_servicio_no_conforme?: string | null;
    tipo_registro?: string | null;
    responsable_registro?: string | null;
    acciones_seguir?: string | null;
    responsable_corregir?: string | null;
    responsable_aprobar?: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface DeleteNonConformingProductParams {
  id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface ListNonConformingProductByCorpoParams {
  corpo_id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

export const createNonConformingProduct = async ({
  requestData,
  refreshAccessToken,
  logout,
}: CreateNonConformingProductParams): Promise<ApiResponse> => {
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

    const response = await fetch(`${apiUrl}/api/non-conforming-product`, {
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
        return createNonConformingProduct({ requestData, refreshAccessToken, logout });
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
    console.error('Error creating non-conforming product:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al crear el producto no conforme',
    };
  }
};

export const updateNonConformingProduct = async ({
  id,
  requestData,
  refreshAccessToken,
  logout,
}: UpdateNonConformingProductParams): Promise<ApiResponse> => {
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

    const response = await fetch(`${apiUrl}/api/non-conforming-product/${id}`, {
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
        return updateNonConformingProduct({ id, requestData, refreshAccessToken, logout });
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
    console.error('Error updating non-conforming product:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al actualizar el producto no conforme',
    };
  }
};

export const deleteNonConformingProduct = async ({
  id,
  refreshAccessToken,
  logout,
}: DeleteNonConformingProductParams): Promise<ApiResponse> => {
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

    const response = await fetch(`${apiUrl}/api/non-conforming-product/${id}`, {
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
        return deleteNonConformingProduct({ id, refreshAccessToken, logout });
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
    console.error('Error deleting non-conforming product:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al eliminar el producto no conforme',
    };
  }
};

export const listNonConformingProductByCorpo = async ({
  corpo_id,
  refreshAccessToken,
  logout,
}: ListNonConformingProductByCorpoParams): Promise<ApiResponse> => {
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

    const response = await fetch(`${apiUrl}/api/non-conforming-product/corpo/${corpo_id}`, {
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
        return listNonConformingProductByCorpo({ corpo_id, refreshAccessToken, logout });
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
    console.error('Error listing non-conforming products:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al listar los productos no conformes',
      data: [],
    };
  }
};

interface CreateComplaintsMasterParams {
  requestData: {
    marca_id: number;
    sociedad: string | null;
    nombre_realiza_queja: string | null;
    cliente: string | null;
    empresa_presenta_queja: string | null;
    persona_presenta_queja: string | null;
    medio_recepcion_queja: string | null;
    tipo_queja: string | null;
    ubicacion: string | null;
    nivel_queja: string | null;
    fecha_queja: string | null;
    motivo_queja: string | null;
    descripcion_queja: string | null;
    fecha_inicio: string | null;
    fecha_revision: string | null;
    resolucion_queja: string | null;
    mes_queja: string | null;
    ano_queja: string | null;
    estado: string | null;
    accion_correctiva_preventiva: string | null;
    anexo_evidencia: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface UpdateComplaintsMasterParams {
  id: string;
  requestData: {
    sociedad?: string | null;
    nombre_realiza_queja?: string | null;
    cliente?: string | null;
    empresa_presenta_queja?: string | null;
    persona_presenta_queja?: string | null;
    medio_recepcion_queja?: string | null;
    tipo_queja?: string | null;
    ubicacion?: string | null;
    nivel_queja?: string | null;
    fecha_queja?: string | null;
    motivo_queja?: string | null;
    descripcion_queja?: string | null;
    fecha_inicio?: string | null;
    fecha_revision?: string | null;
    resolucion_queja?: string | null;
    mes_queja?: string | null;
    ano_queja?: string | null;
    estado?: string | null;
    accion_correctiva_preventiva?: string | null;
    anexo_evidencia?: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface DeleteComplaintsMasterParams {
  id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface ListComplaintsMasterByCorpoParams {
  corpo_id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

export const createComplaintsMaster = async ({
  requestData,
  refreshAccessToken,
  logout,
}: CreateComplaintsMasterParams): Promise<ApiResponse> => {
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

    const response = await fetch(`${apiUrl}/api/complaints-master`, {
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
        return createComplaintsMaster({ requestData, refreshAccessToken, logout });
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
    console.error('Error creating complaint:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al crear la queja',
    };
  }
};

export const updateComplaintsMaster = async ({
  id,
  requestData,
  refreshAccessToken,
  logout,
}: UpdateComplaintsMasterParams): Promise<ApiResponse> => {
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

    const response = await fetch(`${apiUrl}/api/complaints-master/${id}`, {
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
        return updateComplaintsMaster({ id, requestData, refreshAccessToken, logout });
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
    console.error('Error updating complaint:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al actualizar la queja',
    };
  }
};

export const deleteComplaintsMaster = async ({
  id,
  refreshAccessToken,
  logout,
}: DeleteComplaintsMasterParams): Promise<ApiResponse> => {
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

    const response = await fetch(`${apiUrl}/api/complaints-master/${id}`, {
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
        return deleteComplaintsMaster({ id, refreshAccessToken, logout });
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
    console.error('Error deleting complaint:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al eliminar la queja',
    };
  }
};

export const listComplaintsMasterByCorpo = async ({
  corpo_id,
  refreshAccessToken,
  logout,
}: ListComplaintsMasterByCorpoParams): Promise<ApiResponse> => {
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

    const response = await fetch(`${apiUrl}/api/complaints-master/corpo/${corpo_id}`, {
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
        return listComplaintsMasterByCorpo({ corpo_id, refreshAccessToken, logout });
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
    console.error('Error listing complaints:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al listar las quejas',
      data: [],
    };
  }
};

interface CreateCleanersControlParams {
  requestData: {
    marca_id: number;
    nombre_aseador: string | null;
    oficina_despacho: string | null;
    provincia: string | null;
    canton: string | null;
    distrito: string | null;
    direccion: string | null;
    metraje: string | null;
    horario: string | null;
    horas_dia: string | null;
    horas_semana: string | null;
    dias: string | null;
    cantidad_personal: string | null;
    detalle_supervision: string | null;
    fecha_inicio: string | null;
    lista_equipos_insumos: string | null;
    costo_mensual: string | null;
    costo_anual: string | null;
    codigo: string | null;
    plaza: string | null;
    observaciones: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface UpdateCleanersControlParams {
  id: string;
  requestData: {
    nombre_aseador?: string | null;
    oficina_despacho?: string | null;
    provincia?: string | null;
    canton?: string | null;
    distrito?: string | null;
    direccion?: string | null;
    metraje?: string | null;
    horario?: string | null;
    horas_dia?: string | null;
    horas_semana?: string | null;
    dias?: string | null;
    cantidad_personal?: string | null;
    detalle_supervision?: string | null;
    fecha_inicio?: string | null;
    lista_equipos_insumos?: string | null;
    costo_mensual?: string | null;
    costo_anual?: string | null;
    codigo?: string | null;
    plaza?: string | null;
    observaciones?: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface DeleteCleanersControlParams {
  id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface ListCleanersControlByCorpoParams {
  corpo_id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

export const createCleanersControl = async ({
  requestData,
  refreshAccessToken,
  logout,
}: CreateCleanersControlParams): Promise<ApiResponse> => {
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

    const response = await fetch(`${apiUrl}/api/cleaners-control`, {
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
        return createCleanersControl({ requestData, refreshAccessToken, logout });
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
    console.error('Error creating cleaners control:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al crear el control de aseadores',
    };
  }
};

export const updateCleanersControl = async ({
  id,
  requestData,
  refreshAccessToken,
  logout,
}: UpdateCleanersControlParams): Promise<ApiResponse> => {
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

    const response = await fetch(`${apiUrl}/api/cleaners-control/${id}`, {
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
        return updateCleanersControl({ id, requestData, refreshAccessToken, logout });
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
    console.error('Error updating cleaners control:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al actualizar el control de aseadores',
    };
  }
};

export const deleteCleanersControl = async ({
  id,
  refreshAccessToken,
  logout,
}: DeleteCleanersControlParams): Promise<ApiResponse> => {
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

    const response = await fetch(`${apiUrl}/api/cleaners-control/${id}`, {
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
        return deleteCleanersControl({ id, refreshAccessToken, logout });
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
    console.error('Error deleting cleaners control:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al eliminar el control de aseadores',
    };
  }
};

export const listCleanersControlByCorpo = async ({
  corpo_id,
  refreshAccessToken,
  logout,
}: ListCleanersControlByCorpoParams): Promise<ApiResponse> => {
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

    const response = await fetch(`${apiUrl}/api/cleaners-control/corpo/${corpo_id}`, {
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
        return listCleanersControlByCorpo({ corpo_id, refreshAccessToken, logout });
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
    console.error('Error listing cleaners control:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al listar los controles de aseadores',
      data: [],
    };
  }
};

interface CreatePhysicalMinuteAgendaParams {
  requestData: {
    marca_id: number;
    fecha: string | null;
    puesto: string | null;
    hora_inicio: string | null;
    hora_fin: string | null;
    elaborado_por: string | null;
    minuta_numero: string | null;
    presentes: string | null;
    observaciones: string | null;
    temas_tratados: string | null;
    notas: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface UpdatePhysicalMinuteAgendaParams {
  id: string;
  requestData: {
    fecha?: string | null;
    puesto?: string | null;
    hora_inicio?: string | null;
    hora_fin?: string | null;
    elaborado_por?: string | null;
    minuta_numero?: string | null;
    presentes?: string | null;
    observaciones?: string | null;
    temas_tratados?: string | null;
    notas?: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface DeletePhysicalMinuteAgendaParams {
  id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface ListPhysicalMinuteAgendaByCorpoParams {
  corpo_id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

export const createPhysicalMinuteAgenda = async ({
  requestData,
  refreshAccessToken,
  logout,
}: CreatePhysicalMinuteAgendaParams): Promise<ApiResponse> => {
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

    const response = await fetch(`${apiUrl}/api/physical-minute-agenda`, {
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
        return createPhysicalMinuteAgenda({ requestData, refreshAccessToken, logout });
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
    console.error('Error creating physical minute agenda:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al crear la agenda minuta física',
    };
  }
};

export const updatePhysicalMinuteAgenda = async ({
  id,
  requestData,
  refreshAccessToken,
  logout,
}: UpdatePhysicalMinuteAgendaParams): Promise<ApiResponse> => {
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

    const response = await fetch(`${apiUrl}/api/physical-minute-agenda/${id}`, {
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
        return updatePhysicalMinuteAgenda({ id, requestData, refreshAccessToken, logout });
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
    console.error('Error updating physical minute agenda:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al actualizar la agenda minuta física',
    };
  }
};

export const deletePhysicalMinuteAgenda = async ({
  id,
  refreshAccessToken,
  logout,
}: DeletePhysicalMinuteAgendaParams): Promise<ApiResponse> => {
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

    const response = await fetch(`${apiUrl}/api/physical-minute-agenda/${id}`, {
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
        return deletePhysicalMinuteAgenda({ id, refreshAccessToken, logout });
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
    console.error('Error deleting physical minute agenda:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al eliminar la agenda minuta física',
    };
  }
};

export const listPhysicalMinuteAgendaByCorpo = async ({
  corpo_id,
  refreshAccessToken,
  logout,
}: ListPhysicalMinuteAgendaByCorpoParams): Promise<ApiResponse> => {
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

    const response = await fetch(`${apiUrl}/api/physical-minute-agenda/corpo/${corpo_id}`, {
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
        return listPhysicalMinuteAgendaByCorpo({ corpo_id, refreshAccessToken, logout });
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
    console.error('Error listing physical minute agenda:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al listar las agendas minuta física',
      data: [],
    };
  }
};

interface CreateActionPlanParams {
  requestData: {
    marca_id: number;
    nombre_lugar: string | null;
    fecha_inicio_operaciones: string | null;
    tareas: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface UpdateActionPlanParams {
  id: string;
  requestData: {
    nombre_lugar?: string | null;
    fecha_inicio_operaciones?: string | null;
    tareas?: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface DeleteActionPlanParams {
  id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface ListActionPlanByCorpoParams {
  corpo_id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

export const createActionPlan = async ({
  requestData,
  refreshAccessToken,
  logout,
}: CreateActionPlanParams): Promise<ApiResponse> => {
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

    const response = await fetch(`${apiUrl}/api/action-plan`, {
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
        return createActionPlan({ requestData, refreshAccessToken, logout });
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
    console.error('Error creating action plan:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al crear el plan de acción',
    };
  }
};

export const updateActionPlan = async ({
  id,
  requestData,
  refreshAccessToken,
  logout,
}: UpdateActionPlanParams): Promise<ApiResponse> => {
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

    const response = await fetch(`${apiUrl}/api/action-plan/${id}`, {
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
        return updateActionPlan({ id, requestData, refreshAccessToken, logout });
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
    console.error('Error updating action plan:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al actualizar el plan de acción',
    };
  }
};

export const deleteActionPlan = async ({
  id,
  refreshAccessToken,
  logout,
}: DeleteActionPlanParams): Promise<ApiResponse> => {
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

    const response = await fetch(`${apiUrl}/api/action-plan/${id}`, {
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
        return deleteActionPlan({ id, refreshAccessToken, logout });
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
    console.error('Error deleting action plan:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al eliminar el plan de acción',
    };
  }
};

export const listActionPlanByCorpo = async ({
  corpo_id,
  refreshAccessToken,
  logout,
}: ListActionPlanByCorpoParams): Promise<ApiResponse> => {
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

    const response = await fetch(`${apiUrl}/api/action-plan/corpo/${corpo_id}`, {
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
        return listActionPlanByCorpo({ corpo_id, refreshAccessToken, logout });
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
    console.error('Error listing action plans:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al listar los planes de acción',
      data: [],
    };
  }
};

interface CreateWorkRoleParams {
  requestData: {
    marca_id: number;
    area: string | null;
    metraje: string | null;
    horario: string | null;
    personal: string | null;
    horarios: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface UpdateWorkRoleParams {
  id: string;
  requestData: {
    area?: string | null;
    metraje?: string | null;
    horario?: string | null;
    personal?: string | null;
    horarios?: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface DeleteWorkRoleParams {
  id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface ListWorkRoleByCorpoParams {
  corpo_id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

export const createWorkRole = async ({
  requestData,
  refreshAccessToken,
  logout,
}: CreateWorkRoleParams): Promise<ApiResponse> => {
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

    const response = await fetch(`${apiUrl}/api/work-role`, {
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
        return createWorkRole({ requestData, refreshAccessToken, logout });
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
    console.error('Error creating work role:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al crear el rol de trabajo',
    };
  }
};

export const updateWorkRole = async ({
  id,
  requestData,
  refreshAccessToken,
  logout,
}: UpdateWorkRoleParams): Promise<ApiResponse> => {
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

    const response = await fetch(`${apiUrl}/api/work-role/${id}`, {
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
        return updateWorkRole({ id, requestData, refreshAccessToken, logout });
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
    console.error('Error updating work role:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al actualizar el rol de trabajo',
    };
  }
};

export const deleteWorkRole = async ({
  id,
  refreshAccessToken,
  logout,
}: DeleteWorkRoleParams): Promise<ApiResponse> => {
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

    const response = await fetch(`${apiUrl}/api/work-role/${id}`, {
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
        return deleteWorkRole({ id, refreshAccessToken, logout });
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
    console.error('Error deleting work role:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al eliminar el rol de trabajo',
    };
  }
};

export const listWorkRoleByCorpo = async ({
  corpo_id,
  refreshAccessToken,
  logout,
}: ListWorkRoleByCorpoParams): Promise<ApiResponse> => {
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

    const response = await fetch(`${apiUrl}/api/work-role/corpo/${corpo_id}`, {
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
        return listWorkRoleByCorpo({ corpo_id, refreshAccessToken, logout });
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
    console.error('Error listing work roles:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al listar los roles de trabajo',
      data: [],
    };
  }
};

interface CreateContractBasicDataParams {
  requestData: {
    marca_id: number;
    fecha_inicio_contrato: string | null;
    cliente_contrato: string | null;
    ejecutivo_gerente_asistente: string | null;
    personal: string | null;
    lugar_servicio: string | null;
    roles_horarios: string | null;
    desglose_salarios: string | null;
    tipo_uniforme: string | null;
    tipo_arma: string | null;
    capacitaciones: string | null;
    otros_datos: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface UpdateContractBasicDataParams {
  id: string;
  requestData: {
    fecha_inicio_contrato?: string | null;
    cliente_contrato?: string | null;
    ejecutivo_gerente_asistente?: string | null;
    personal?: string | null;
    lugar_servicio?: string | null;
    roles_horarios?: string | null;
    desglose_salarios?: string | null;
    tipo_uniforme?: string | null;
    tipo_arma?: string | null;
    capacitaciones?: string | null;
    otros_datos?: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface DeleteContractBasicDataParams {
  id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface ListContractBasicDataByCorpoParams {
  corpo_id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

export const createContractBasicData = async ({
  requestData,
  refreshAccessToken,
  logout,
}: CreateContractBasicDataParams): Promise<ApiResponse> => {
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

    const response = await fetch(`${apiUrl}/api/contract-basic-data`, {
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
        return createContractBasicData({ requestData, refreshAccessToken, logout });
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
    console.error('Error creating contract basic data:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al crear los datos básicos de contrato',
    };
  }
};

export const updateContractBasicData = async ({
  id,
  requestData,
  refreshAccessToken,
  logout,
}: UpdateContractBasicDataParams): Promise<ApiResponse> => {
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

    const response = await fetch(`${apiUrl}/api/contract-basic-data/${id}`, {
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
        return updateContractBasicData({ id, requestData, refreshAccessToken, logout });
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
    console.error('Error updating contract basic data:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al actualizar los datos básicos de contrato',
    };
  }
};

export const deleteContractBasicData = async ({
  id,
  refreshAccessToken,
  logout,
}: DeleteContractBasicDataParams): Promise<ApiResponse> => {
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

    const response = await fetch(`${apiUrl}/api/contract-basic-data/${id}`, {
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
        return deleteContractBasicData({ id, refreshAccessToken, logout });
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
    console.error('Error deleting contract basic data:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al eliminar los datos básicos de contrato',
    };
  }
};

export const listContractBasicDataByCorpo = async ({
  corpo_id,
  refreshAccessToken,
  logout,
}: ListContractBasicDataByCorpoParams): Promise<ApiResponse> => {
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

    const response = await fetch(`${apiUrl}/api/contract-basic-data/corpo/${corpo_id}`, {
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
        return listContractBasicDataByCorpo({ corpo_id, refreshAccessToken, logout });
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
    console.error('Error listing contract basic data:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al listar los datos básicos de contrato',
      data: [],
    };
  }
};

interface CreateDeliveryScheduleParams {
  requestData: {
    marca_id: number;
    contrato: string | null;
    region: string | null;
    puesto: string | null;
    fecha_apertura_entrega: string | null;
    responsable_apertura_entrega: string | null;
    equipos_solicitados: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface UpdateDeliveryScheduleParams {
  id: string;
  requestData: {
    contrato?: string | null;
    region?: string | null;
    puesto?: string | null;
    fecha_apertura_entrega?: string | null;
    responsable_apertura_entrega?: string | null;
    equipos_solicitados?: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface DeleteDeliveryScheduleParams {
  id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface ListDeliveryScheduleByCorpoParams {
  corpo_id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

export const createDeliverySchedule = async ({
  requestData,
  refreshAccessToken,
  logout,
}: CreateDeliveryScheduleParams): Promise<ApiResponse> => {
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

    const response = await fetch(`${apiUrl}/api/delivery-schedule`, {
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
        return createDeliverySchedule({ requestData, refreshAccessToken, logout });
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
    console.error('Error creating delivery schedule:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al crear el cronograma de entrega',
    };
  }
};

export const updateDeliverySchedule = async ({
  id,
  requestData,
  refreshAccessToken,
  logout,
}: UpdateDeliveryScheduleParams): Promise<ApiResponse> => {
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

    const response = await fetch(`${apiUrl}/api/delivery-schedule/${id}`, {
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
        return updateDeliverySchedule({ id, requestData, refreshAccessToken, logout });
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
    console.error('Error updating delivery schedule:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al actualizar el cronograma de entrega',
    };
  }
};

export const deleteDeliverySchedule = async ({
  id,
  refreshAccessToken,
  logout,
}: DeleteDeliveryScheduleParams): Promise<ApiResponse> => {
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

    const response = await fetch(`${apiUrl}/api/delivery-schedule/${id}`, {
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
        return deleteDeliverySchedule({ id, refreshAccessToken, logout });
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
    console.error('Error deleting delivery schedule:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al eliminar el cronograma de entrega',
    };
  }
};

export const listDeliveryScheduleByCorpo = async ({
  corpo_id,
  refreshAccessToken,
  logout,
}: ListDeliveryScheduleByCorpoParams): Promise<ApiResponse> => {
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

    const response = await fetch(`${apiUrl}/api/delivery-schedule/corpo/${corpo_id}`, {
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
        return listDeliveryScheduleByCorpo({ corpo_id, refreshAccessToken, logout });
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
    console.error('Error listing delivery schedule:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al listar los cronogramas de entrega',
      data: [],
    };
  }
};

