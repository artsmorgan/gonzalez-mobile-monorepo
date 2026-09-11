import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { hydrateAgendaMinutaRequestData } from '@/hooks/agendaMinutaImageHydration';

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
        if (logout) await logout();
        throw new Error('Sesión expirada');
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

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return createEvaluation({ requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
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
        if (logout) await logout();
        throw new Error('Sesión expirada');
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

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return createMileageControl({ requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
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
        if (logout) await logout();
        throw new Error('Sesión expirada');
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

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return updateMileageControl({ id, requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
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
        if (logout) await logout();
        throw new Error('Sesión expirada');
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

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return deleteMileageControl({ id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
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
        if (logout) await logout();
        throw new Error('Sesión expirada');
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

    if (response.status === 401) {
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
        if (logout) await logout();
        throw new Error('Sesión expirada');
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

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return createUniformRequest({ requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
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
        if (logout) await logout();
        throw new Error('Sesión expirada');
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

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return updateUniformRequest({ id, requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
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
        if (logout) await logout();
        throw new Error('Sesión expirada');
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

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return deleteUniformRequest({ id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
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
        if (logout) await logout();
        throw new Error('Sesión expirada');
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

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return listUniformRequestsByCorpo({ corpo_id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
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
        if (logout) await logout();
        throw new Error('Sesión expirada');
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

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return createRouteAndTour({ requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
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
        if (logout) await logout();
        throw new Error('Sesión expirada');
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

    if (response.status === 401) {
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
        if (logout) await logout();
        throw new Error('Sesión expirada');
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

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return deleteRouteAndTour({ id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
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
        if (logout) await logout();
        throw new Error('Sesión expirada');
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

    if (response.status === 401) {
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
        if (logout) await logout();
        throw new Error('Sesión expirada');
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

    if (response.status === 401) {
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
        if (logout) await logout();
        throw new Error('Sesión expirada');
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

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return updateEmployeeSatisfaction({ id, requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
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
        if (logout) await logout();
        throw new Error('Sesión expirada');
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

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return deleteEmployeeSatisfaction({ id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
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
        if (logout) await logout();
        throw new Error('Sesión expirada');
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

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return listEmployeeSatisfactionByCorpo({ corpo_id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
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
        if (logout) await logout();
        throw new Error('Sesión expirada');
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

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return createVehicleMaintenance({ requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
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
        if (logout) await logout();
        throw new Error('Sesión expirada');
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

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return updateVehicleMaintenance({ id, requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
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
        if (logout) await logout();
        throw new Error('Sesión expirada');
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

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return deleteVehicleMaintenance({ id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
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
        if (logout) await logout();
        throw new Error('Sesión expirada');
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

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return listVehicleMaintenanceByCorpo({ corpo_id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
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
    cliente_id: number;
    corpo_id: number;
    empresa_id: number;
    division_id: number;
    contrato_id: number;
    puesto_id: number;
    fecha_identificacion: string; // YYYY-MM-DD
    responsable_cuenta: string;
    tipo_servicio_no_conforme: string;
    persona_identifico_pnc: string;
    firma_persona_identifico_pnc: string; // base64 o data-url
    descripcion: string;
    persona_origino_pnc: string;
    firma_persona_origino_pnc: string; // base64 o data-url
    accion_implementada: string;
    fecha_solucion: string; // YYYY-MM-DD
    responsable_aprobar: string;
    firma_responsable: string; // hash (QR)
    archivos?: Array<{
      type: 'image' | 'audio' | 'video' | 'document' | string;
      extension: string;
      original_name?: string;
      file_base64: string;
      mimeType?: string;
    }>;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface UpdateNonConformingProductParams {
  id: string;
  requestData: {
    cliente_id?: number;
    corpo_id?: number;
    empresa_id?: number;
    division_id?: number;
    contrato_id?: number;
    puesto_id?: number;
    fecha_identificacion?: string; // YYYY-MM-DD
    responsable_cuenta?: string;
    tipo_servicio_no_conforme?: string;
    persona_identifico_pnc?: string;
    firma_persona_identifico_pnc?: string;
    descripcion?: string;
    persona_origino_pnc?: string;
    firma_persona_origino_pnc?: string;
    accion_implementada?: string;
    fecha_solucion?: string; // YYYY-MM-DD
    responsable_aprobar?: string;
    firma_responsable?: string;
    archivos?: Array<{
      type: 'image' | 'audio' | 'video' | 'document' | string;
      extension: string;
      original_name?: string;
      file_base64: string;
      mimeType?: string;
    }>;
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

interface DeleteNonConformingProductArchivoParams {
  productoId: string | number;
  archivoId: number;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface ListCorporateVehiclesByCorpoParams {
  corpo_id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface CreateCorporateVehicleParams {
  requestData: {
    empresa_id?: number;
    cliente_id: number;
    corpo_id: number; // sucursal_id
    division_id?: number;
    contrato_id?: number;
    puesto_id?: number;
    placa?: string | null;
    tipo?: string;
    tipo_autoria?: string;
    estado?: string;
    kilometraje?: number | null;
    prox_cambio_aceite?: number | null;
    modelo?: string | null;
    marca: string;
    anno?: number | null;
    descripcion?: string | null;
    titulo_propiedad?: boolean | null;
    rtv?: boolean | null;
    marchamo?: boolean | null;
    firma_responsable?: string;
    imagenes?: Array<{
      extension: string;
      file_base64: string;
      original_name?: string;
    }>;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface UpdateCorporateVehicleParams {
  id: string;
  requestData: CreateCorporateVehicleParams['requestData'];
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface DeleteCorporateVehicleParams {
  id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface DeleteCorporateVehicleImageParams {
  vehiculoId: string | number;
  imageId: number;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

export type CorporateVehicleUseRequest = {
  nombre_conductor: string;
  codigo_conductor: string;
  fecha_inicio: string; // ISO
  fecha_fin: string; // ISO
  hora_inicio: string; // ISO
  hora_fin: string; // ISO
  fecha?: string; // compatibilidad legacy
  inicio?: string; // compatibilidad legacy
  fin?: string; // compatibilidad legacy
  combustible_inicio: string;
  combustible_fin: string;
  km_inicio: number;
  km_fin: number;
  motivo: string;
  firma_conductor?: string | null;
  firma_responsable: string;
  // bitacora_id ignorado por solicitud
};

interface ListCorporateVehicleUsesParams {
  vehiculo_id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface CreateCorporateVehicleUseParams {
  vehiculo_id: string;
  requestData: CorporateVehicleUseRequest;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface UpdateCorporateVehicleUseParams {
  use_id: string;
  requestData: Partial<CorporateVehicleUseRequest>;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface DeleteCorporateVehicleUseParams {
  use_id: string;
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
        if (logout) await logout();
        throw new Error('Sesión expirada');
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

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return createNonConformingProduct({ requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
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
        if (logout) await logout();
        throw new Error('Sesión expirada');
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

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return updateNonConformingProduct({ id, requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
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
        if (logout) await logout();
        throw new Error('Sesión expirada');
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

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return deleteNonConformingProduct({ id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
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

export const deleteNonConformingProductArchivo = async ({
  productoId,
  archivoId,
  refreshAccessToken,
  logout,
}: DeleteNonConformingProductArchivoParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(
      `${apiUrl}/api/non-conforming-product/${productoId}/archivo/${archivoId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '69420',
        },
      }
    );

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return deleteNonConformingProductArchivo({ productoId, archivoId, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error deleting non-conforming product attachment:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al eliminar el adjunto',
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
        if (logout) await logout();
        throw new Error('Sesión expirada');
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

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return listNonConformingProductByCorpo({ corpo_id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
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

export const createCorporateVehicle = async ({
  requestData,
  refreshAccessToken,
  logout,
}: CreateCorporateVehicleParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/corporate-vehicles`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) return createCorporateVehicle({ requestData, refreshAccessToken, logout });
      await logout();
      throw new Error('Sesión expirada');
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating corporate vehicle:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al crear el vehículo corporativo',
    };
  }
};

export const updateCorporateVehicle = async ({
  id,
  requestData,
  refreshAccessToken,
  logout,
}: UpdateCorporateVehicleParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/corporate-vehicles/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) return updateCorporateVehicle({ id, requestData, refreshAccessToken, logout });
      await logout();
      throw new Error('Sesión expirada');
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating corporate vehicle:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al actualizar el vehículo corporativo',
    };
  }
};

export const deleteCorporateVehicleImage = async ({
  vehiculoId,
  imageId,
  refreshAccessToken,
  logout,
}: DeleteCorporateVehicleImageParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(
      `${apiUrl}/api/corporate-vehicles/${encodeURIComponent(String(vehiculoId))}/image/${encodeURIComponent(String(imageId))}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '69420',
        },
      }
    );

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return deleteCorporateVehicleImage({ vehiculoId, imageId, refreshAccessToken, logout });
      }
      await logout();
      throw new Error('Sesión expirada');
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error deleting corporate vehicle image:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'No se pudo eliminar la imagen',
    };
  }
};

export const deleteCorporateVehicle = async ({
  id,
  refreshAccessToken,
  logout,
}: DeleteCorporateVehicleParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/corporate-vehicles/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) return deleteCorporateVehicle({ id, refreshAccessToken, logout });
      await logout();
      throw new Error('Sesión expirada');
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error deleting corporate vehicle:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al eliminar el vehículo corporativo',
    };
  }
};

export const listCorporateVehiclesByCorpo = async ({
  corpo_id,
  refreshAccessToken,
  logout,
}: ListCorporateVehiclesByCorpoParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/corporate-vehicles/corpo/${corpo_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) return listCorporateVehiclesByCorpo({ corpo_id, refreshAccessToken, logout });
      await logout();
      throw new Error('Sesión expirada');
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error listing corporate vehicles:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al cargar vehículos corporativos',
    };
  }
};

export interface ListCorporateVehiclesParams {
  empresa_id?: number | null;
  cliente_id?: number | null;
  corpo_id?: number | null;
  refreshAccessToken?: () => Promise<boolean>;
  logout?: () => Promise<{ status: boolean; message: string }>;
}

export const listCorporateVehicles = async ({
  empresa_id,
  cliente_id,
  corpo_id,
  refreshAccessToken,
  logout,
}: ListCorporateVehiclesParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken?.();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const queryParams = new URLSearchParams();
    if (empresa_id) queryParams.append('empresa_id', empresa_id.toString());
    if (cliente_id) queryParams.append('cliente_id', cliente_id.toString());
    if (corpo_id) queryParams.append('corpo_id', corpo_id.toString());

    const response = await fetch(`${apiUrl}/api/corporate-vehicles?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken?.();
      if (refreshed) return listCorporateVehicles({ empresa_id, cliente_id, corpo_id, refreshAccessToken, logout });
      if (logout) await logout();
      throw new Error('Sesión expirada');
    }

    if (response.status === 403) {
      if (logout) await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error listing corporate vehicles:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al cargar vehículos corporativos',
    };
  }
};

export const listCorporateVehicleUses = async ({
  vehiculo_id,
  refreshAccessToken,
  logout,
}: ListCorporateVehicleUsesParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/corporate-vehicles/${vehiculo_id}/uses`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) return listCorporateVehicleUses({ vehiculo_id, refreshAccessToken, logout });
      await logout();
      throw new Error('Sesión expirada');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error listing corporate vehicle uses:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al listar los usos del vehículo',
      data: [],
    };
  }
};

export const createCorporateVehicleUse = async ({
  vehiculo_id,
  requestData,
  refreshAccessToken,
  logout,
}: CreateCorporateVehicleUseParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/corporate-vehicles/${vehiculo_id}/uses`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) return createCorporateVehicleUse({ vehiculo_id, requestData, refreshAccessToken, logout });
      await logout();
      throw new Error('Sesión expirada');
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating corporate vehicle use:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al crear el uso del vehículo',
    };
  }
};

export const updateCorporateVehicleUse = async ({
  use_id,
  requestData,
  refreshAccessToken,
  logout,
}: UpdateCorporateVehicleUseParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/corporate-vehicles/uses/${use_id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) return updateCorporateVehicleUse({ use_id, requestData, refreshAccessToken, logout });
      await logout();
      throw new Error('Sesión expirada');
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating corporate vehicle use:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al actualizar el uso del vehículo',
    };
  }
};

export const deleteCorporateVehicleUse = async ({
  use_id,
  refreshAccessToken,
  logout,
}: DeleteCorporateVehicleUseParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/corporate-vehicles/uses/${use_id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) return deleteCorporateVehicleUse({ use_id, refreshAccessToken, logout });
      await logout();
      throw new Error('Sesión expirada');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error deleting corporate vehicle use:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al eliminar el uso del vehículo',
    };
  }
};

// Corporate Vehicle Maintenance types and functions
export type CorporateVehicleMaintenanceRequest = {
  fecha: string; // ISO
  imagen_antes: string; // base64
  tipo: string;
  mantenimiento: string;
  diagnostico: string;
  kilometraje_siguiente_revision: number;
  imagen_despues: string; // base64
  nombre_mecanico: string;
  firma_mecanico?: string | null; // base64 signature (opcional)
  firma_responsable: string; // base64 hash
};

interface ListCorporateVehicleMaintenancesParams {
  vehiculo_id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface CreateCorporateVehicleMaintenanceParams {
  vehiculo_id: string;
  requestData: CorporateVehicleMaintenanceRequest;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface UpdateCorporateVehicleMaintenanceParams {
  maintenance_id: string;
  requestData: Partial<CorporateVehicleMaintenanceRequest>;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface DeleteCorporateVehicleMaintenanceParams {
  maintenance_id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

export const listCorporateVehicleMaintenances = async ({
  vehiculo_id,
  refreshAccessToken,
  logout,
}: ListCorporateVehicleMaintenancesParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/corporate-vehicles/${vehiculo_id}/maintenances`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) return listCorporateVehicleMaintenances({ vehiculo_id, refreshAccessToken, logout });
      await logout();
      throw new Error('Sesión expirada');
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error listing corporate vehicle maintenances:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al listar los mantenimientos del vehículo',
      data: [],
    };
  }
};

export const createCorporateVehicleMaintenance = async ({
  vehiculo_id,
  requestData,
  refreshAccessToken,
  logout,
}: CreateCorporateVehicleMaintenanceParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/corporate-vehicles/${vehiculo_id}/maintenances`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) return createCorporateVehicleMaintenance({ vehiculo_id, requestData, refreshAccessToken, logout });
      await logout();
      throw new Error('Sesión expirada');
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating corporate vehicle maintenance:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al crear el mantenimiento del vehículo',
    };
  }
};

export const updateCorporateVehicleMaintenance = async ({
  maintenance_id,
  requestData,
  refreshAccessToken,
  logout,
}: UpdateCorporateVehicleMaintenanceParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/corporate-vehicles/maintenances/${maintenance_id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) return updateCorporateVehicleMaintenance({ maintenance_id, requestData, refreshAccessToken, logout });
      await logout();
      throw new Error('Sesión expirada');
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating corporate vehicle maintenance:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al actualizar el mantenimiento del vehículo',
    };
  }
};

export const deleteCorporateVehicleMaintenanceImage = async ({
  maintenance_id,
  slot,
  refreshAccessToken,
  logout,
}: {
  maintenance_id: string;
  slot: 'antes' | 'despues';
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const pathSlot = slot === 'antes' ? 'antes' : 'despues';
    const response = await fetch(
      `${apiUrl}/api/corporate-vehicles/maintenances/${encodeURIComponent(maintenance_id)}/image/${pathSlot}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '69420',
        },
      }
    );

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return deleteCorporateVehicleMaintenanceImage({
          maintenance_id,
          slot,
          refreshAccessToken,
          logout,
        });
      }
      await logout();
      throw new Error('Sesión expirada');
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error deleting maintenance image:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al eliminar la imagen del mantenimiento',
    };
  }
};

export const deleteCorporateVehicleMaintenance = async ({
  maintenance_id,
  refreshAccessToken,
  logout,
}: DeleteCorporateVehicleMaintenanceParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/corporate-vehicles/maintenances/${maintenance_id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) return deleteCorporateVehicleMaintenance({ maintenance_id, refreshAccessToken, logout });
      await logout();
      throw new Error('Sesión expirada');
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error deleting corporate vehicle maintenance:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al eliminar el mantenimiento del vehículo',
    };
  }
};

interface CreateComplaintsMasterParams {
  requestData: {
    marca_id: number;
    sociedad: string;
    nombre_realiza_queja: string;
    cliente: string;
    empresa_presenta_queja: string;
    persona_presenta_queja: string;
    medio_recepcion_queja: string;
    tipo_cliente: string;
    tipo_queja: string;
    estimacion_dannio: string;
    ubicacion: string;
    nivel_queja: string;
    fecha_queja: string;
    motivo_queja: string;
    descripcion_queja: string;
    fecha_inicio: string;
    fecha_revision: string;
    resolucion_queja: string;
    estado: string;
    accion_correctiva_preventiva: string;
    firma_responsable: string;
    archivos?: any; // array o JSON string [{type, extension, original_name, file_base64}]
    empresa_id?: number;
    cliente_id?: number;
    contrato_id?: number;
    corpo_id?: number;
    puesto_id?: number;
    plaza_id?: number;
    division_id?: number;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface UpdateComplaintsMasterParams {
  id: string;
  requestData: {
    sociedad?: string;
    nombre_realiza_queja?: string;
    cliente?: string;
    empresa_presenta_queja?: string;
    persona_presenta_queja?: string;
    medio_recepcion_queja?: string;
    tipo_cliente?: string;
    tipo_queja?: string;
    estimacion_dannio?: string;
    ubicacion?: string;
    nivel_queja?: string;
    fecha_queja?: string;
    motivo_queja?: string;
    descripcion_queja?: string;
    fecha_inicio?: string;
    fecha_revision?: string;
    resolucion_queja?: string;
    estado?: string;
    accion_correctiva_preventiva?: string;
    firma_responsable?: string;
    archivos?: any;
    empresa_id?: number;
    cliente_id?: number;
    contrato_id?: number;
    corpo_id?: number;
    puesto_id?: number;
    plaza_id?: number;
    division_id?: number;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface DeleteComplaintsMasterParams {
  id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface DeleteComplaintsMasterFileParams {
  id: string;
  fileId: string | number;
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
        if (logout) await logout();
        throw new Error('Sesión expirada');
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

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return createComplaintsMaster({ requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
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
        if (logout) await logout();
        throw new Error('Sesión expirada');
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

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return updateComplaintsMaster({ id, requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
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
        if (logout) await logout();
        throw new Error('Sesión expirada');
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

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return deleteComplaintsMaster({ id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
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

export const deleteComplaintsMasterFile = async ({
  id,
  fileId,
  refreshAccessToken,
  logout,
}: DeleteComplaintsMasterFileParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/complaints-master/${id}/files/${fileId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return deleteComplaintsMasterFile({ id, fileId, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error deleting complaint file:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al eliminar el archivo de la queja',
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
        if (logout) await logout();
        throw new Error('Sesión expirada');
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

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return listComplaintsMasterByCorpo({ corpo_id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    if (data.status && Array.isArray((data as any).data)) {
      (data as any).data = (data as any).data.filter((row: any) => row?.isActive !== false);
    }
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
        if (logout) await logout();
        throw new Error('Sesión expirada');
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

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return createCleanersControl({ requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
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
        if (logout) await logout();
        throw new Error('Sesión expirada');
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

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return updateCleanersControl({ id, requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
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
        if (logout) await logout();
        throw new Error('Sesión expirada');
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

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return deleteCleanersControl({ id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
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
        if (logout) await logout();
        throw new Error('Sesión expirada');
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

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return listCleanersControlByCorpo({ corpo_id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
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

interface CreateAgendaMinutaParams {
  requestData: {
    cliente_id: number;
    corpo_id: number;
    puesto_id: number;
    numero: number;
    titulo: string;
    fecha: string; // dd/MM/yyyy o ISO
    hora_inicio: string; // HH:mm
    hora_fin: string; // HH:mm
    autor: string;
    participantes: string; // JSON string
    acuerdos: string; // JSON string
    temas_a_tratar?: string; // JSON string (array of strings)
    observaciones: string;
    firma_responsable: string;
    estado?: boolean;
    /** Referencias livianas a expo-file-system (`localFileName`); nunca base64 aquí. */
    imagenes?: { localFileName: string; extension: string; original_name?: string }[];
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface UpdateAgendaMinutaParams {
  id: string | number;
  requestData: Partial<CreateAgendaMinutaParams['requestData']>;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface DeleteAgendaMinutaParams {
  id: string | number;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface DeleteAgendaMinutaImageParams {
  agendaId: string | number;
  imageId: number;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface ListAgendaMinutaByCorpoParams {
  corpo_id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

export const createAgendaMinuta = async ({
  requestData,
  refreshAccessToken,
  logout,
}: CreateAgendaMinutaParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const hydratedRequestData = await hydrateAgendaMinutaRequestData(requestData);

    const response = await fetch(`${apiUrl}/api/agenda-minuta`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(hydratedRequestData),
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return createAgendaMinuta({ requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating agenda minuta:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al crear la agenda minuta',
    };
  }
};

export const updateAgendaMinuta = async ({
  id,
  requestData,
  refreshAccessToken,
  logout,
}: UpdateAgendaMinutaParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const hydratedRequestData = await hydrateAgendaMinutaRequestData(requestData);

    const response = await fetch(`${apiUrl}/api/agenda-minuta/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(hydratedRequestData),
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return updateAgendaMinuta({ id, requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating agenda minuta:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al actualizar la agenda minuta',
    };
  }
};

export const deleteAgendaMinuta = async ({
  id,
  refreshAccessToken,
  logout,
}: DeleteAgendaMinutaParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/agenda-minuta/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return deleteAgendaMinuta({ id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error deleting agenda minuta:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al eliminar la agenda minuta',
    };
  }
};

export const deleteAgendaMinutaImage = async ({
  agendaId,
  imageId,
  refreshAccessToken,
  logout,
}: DeleteAgendaMinutaImageParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/agenda-minuta/${agendaId}/image/${imageId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return deleteAgendaMinutaImage({ agendaId, imageId, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error deleting agenda minuta image:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al eliminar la imagen',
    };
  }
};

export const listAgendaMinutaByCorpo = async ({
  corpo_id,
  refreshAccessToken,
  logout,
}: ListAgendaMinutaByCorpoParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/agenda-minuta/corpo/${corpo_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return listAgendaMinutaByCorpo({ corpo_id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error listing agenda minuta:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al listar las agendas minuta',
      data: [],
    };
  }
};

// Backwards-compatible aliases (antes: agenda minuta física)
export const createPhysicalMinuteAgenda = createAgendaMinuta as any;
export const updatePhysicalMinuteAgenda = updateAgendaMinuta as any;
export const deletePhysicalMinuteAgenda = deleteAgendaMinuta as any;
export const listPhysicalMinuteAgendaByCorpo = listAgendaMinutaByCorpo as any;

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
        if (logout) await logout();
        throw new Error('Sesión expirada');
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

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return createActionPlan({ requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
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
        if (logout) await logout();
        throw new Error('Sesión expirada');
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

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return updateActionPlan({ id, requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
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
        if (logout) await logout();
        throw new Error('Sesión expirada');
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

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return deleteActionPlan({ id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
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
        if (logout) await logout();
        throw new Error('Sesión expirada');
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

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return listActionPlanByCorpo({ corpo_id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
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
        if (logout) await logout();
        throw new Error('Sesión expirada');
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

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return createWorkRole({ requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
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
        if (logout) await logout();
        throw new Error('Sesión expirada');
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

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return updateWorkRole({ id, requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
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
        if (logout) await logout();
        throw new Error('Sesión expirada');
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

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return deleteWorkRole({ id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
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
        if (logout) await logout();
        throw new Error('Sesión expirada');
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

    if (response.status === 401) {
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
        if (logout) await logout();
        throw new Error('Sesión expirada');
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

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return createContractBasicData({ requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
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
        if (logout) await logout();
        throw new Error('Sesión expirada');
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

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return updateContractBasicData({ id, requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
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
        if (logout) await logout();
        throw new Error('Sesión expirada');
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

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return deleteContractBasicData({ id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
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
        if (logout) await logout();
        throw new Error('Sesión expirada');
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

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return listContractBasicDataByCorpo({ corpo_id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
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
        if (logout) await logout();
        throw new Error('Sesión expirada');
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

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return createDeliverySchedule({ requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
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
        if (logout) await logout();
        throw new Error('Sesión expirada');
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

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return updateDeliverySchedule({ id, requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
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
        if (logout) await logout();
        throw new Error('Sesión expirada');
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

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return deleteDeliverySchedule({ id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
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
        if (logout) await logout();
        throw new Error('Sesión expirada');
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

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return listDeliveryScheduleByCorpo({ corpo_id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
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

interface SeccionElement {
  tipo: 'titulo' | 'descripcion' | 'lista' | 'seccion';
  contenido?: string;
  elementos?: string[];
  secciones?: SeccionElement[];
}

interface CreateEnvironmentalManagementPlanParams {
  requestData: {
    marca_id: number;
    ubicacion: string | null;
    objetivo: string | null;
    metodologia: string | null;
    rol_horario: string | null;
    uniformes: string | null;
    equipos: string | null;
    accesorios_varios: string | null;
    tiempo_respuesta: string | null;
    distribucion_labores: string | null;
    frecuencia_limpieza: string | null;
    supervision: string | null;
    estrategia: string | null;
    responsable: string | null;
    formularios: string | null;
    plan_capacitacion: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface UpdateEnvironmentalManagementPlanParams {
  id: string;
  requestData: {
    ubicacion?: string | null;
    objetivo?: string | null;
    metodologia?: string | null;
    rol_horario?: string | null;
    uniformes?: string | null;
    equipos?: string | null;
    accesorios_varios?: string | null;
    tiempo_respuesta?: string | null;
    distribucion_labores?: string | null;
    frecuencia_limpieza?: string | null;
    supervision?: string | null;
    estrategia?: string | null;
    responsable?: string | null;
    formularios?: string | null;
    plan_capacitacion?: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface DeleteEnvironmentalManagementPlanParams {
  id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface ListEnvironmentalManagementPlanByCorpoParams {
  corpo_id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

export const createEnvironmentalManagementPlan = async ({
  requestData,
  refreshAccessToken,
  logout,
}: CreateEnvironmentalManagementPlanParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/environmental-management-plan`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return createEnvironmentalManagementPlan({ requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating environmental management plan:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al crear el plan de gestión ambiental',
    };
  }
};

export const updateEnvironmentalManagementPlan = async ({
  id,
  requestData,
  refreshAccessToken,
  logout,
}: UpdateEnvironmentalManagementPlanParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/environmental-management-plan/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return updateEnvironmentalManagementPlan({ id, requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating environmental management plan:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al actualizar el plan de gestión ambiental',
    };
  }
};

export const deleteEnvironmentalManagementPlan = async ({
  id,
  refreshAccessToken,
  logout,
}: DeleteEnvironmentalManagementPlanParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/environmental-management-plan/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return deleteEnvironmentalManagementPlan({ id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error deleting environmental management plan:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al eliminar el plan de gestión ambiental',
    };
  }
};

export const listEnvironmentalManagementPlanByCorpo = async ({
  corpo_id,
  refreshAccessToken,
  logout,
}: ListEnvironmentalManagementPlanByCorpoParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/environmental-management-plan/corpo/${corpo_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return listEnvironmentalManagementPlanByCorpo({ corpo_id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error listing environmental management plan:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al listar los planes de gestión ambiental',
      data: [],
    };
  }
};

interface CreateCleaningWorkPlanParams {
  requestData: {
    marca_id: number;
    objetivo: string | null;
    metodologia_trabajo_ambitos_accion: string | null;
    rol_horario_trabajo: string | null;
    uniformes: string | null;
    equipos: string | null;
    accesorios_varios: string | null;
    tiempo_respuesta_disposicion_imprevistos: string | null;
    distribucion_diaria_labores_personal: string | null;
    frecuencia_minima_limpieza_areas: string | null;
    supervision_metodo_rol_visitas: string | null;
    estrategia_adecuado_continuo_servicio: string | null;
    responsable_general_contrato: string | null;
    formularios_registro_control_puestos_equipos: string | null;
    plan_capacitacion: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface UpdateCleaningWorkPlanParams {
  id: string;
  requestData: {
    objetivo?: string | null;
    metodologia_trabajo_ambitos_accion?: string | null;
    rol_horario_trabajo?: string | null;
    uniformes?: string | null;
    equipos?: string | null;
    accesorios_varios?: string | null;
    tiempo_respuesta_disposicion_imprevistos?: string | null;
    distribucion_diaria_labores_personal?: string | null;
    frecuencia_minima_limpieza_areas?: string | null;
    supervision_metodo_rol_visitas?: string | null;
    estrategia_adecuado_continuo_servicio?: string | null;
    responsable_general_contrato?: string | null;
    formularios_registro_control_puestos_equipos?: string | null;
    plan_capacitacion?: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface DeleteCleaningWorkPlanParams {
  id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface ListCleaningWorkPlanByCorpoParams {
  corpo_id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

export const createCleaningWorkPlan = async ({
  requestData,
  refreshAccessToken,
  logout,
}: CreateCleaningWorkPlanParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/cleaning-work-plan`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return createCleaningWorkPlan({ requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating cleaning work plan:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al crear el plan de trabajo - Personal Aseo y limpieza',
    };
  }
};

export const updateCleaningWorkPlan = async ({
  id,
  requestData,
  refreshAccessToken,
  logout,
}: UpdateCleaningWorkPlanParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/cleaning-work-plan/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return updateCleaningWorkPlan({ id, requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating cleaning work plan:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al actualizar el plan de trabajo - Personal Aseo y limpieza',
    };
  }
};

export const deleteCleaningWorkPlan = async ({
  id,
  refreshAccessToken,
  logout,
}: DeleteCleaningWorkPlanParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/cleaning-work-plan/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return deleteCleaningWorkPlan({ id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error deleting cleaning work plan:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al eliminar el plan de trabajo - Personal Aseo y limpieza',
    };
  }
};

export const listCleaningWorkPlanByCorpo = async ({
  corpo_id,
  refreshAccessToken,
  logout,
}: ListCleaningWorkPlanByCorpoParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/cleaning-work-plan/corpo/${corpo_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return listCleaningWorkPlanByCorpo({ corpo_id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error listing cleaning work plan:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al listar los planes de trabajo - Personal Aseo y limpieza',
      data: [],
    };
  }
};

interface CreateSpecialSituationsPlanParams {
  requestData: {
    marca_id: number;
    edificio: string | null;
    supervisor: string | null;
    situaciones: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface UpdateSpecialSituationsPlanParams {
  id: string;
  requestData: {
    edificio?: string | null;
    supervisor?: string | null;
    situaciones?: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface DeleteSpecialSituationsPlanParams {
  id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface ListSpecialSituationsPlanByCorpoParams {
  corpo_id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

export const createSpecialSituationsPlan = async ({
  requestData,
  refreshAccessToken,
  logout,
}: CreateSpecialSituationsPlanParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/special-situations-plan`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return createSpecialSituationsPlan({ requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating special situations plan:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al crear el plan para la atención de situaciones especiales',
    };
  }
};

export const updateSpecialSituationsPlan = async ({
  id,
  requestData,
  refreshAccessToken,
  logout,
}: UpdateSpecialSituationsPlanParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/special-situations-plan/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return updateSpecialSituationsPlan({ id, requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating special situations plan:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al actualizar el plan para la atención de situaciones especiales',
    };
  }
};

export const deleteSpecialSituationsPlan = async ({
  id,
  refreshAccessToken,
  logout,
}: DeleteSpecialSituationsPlanParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/special-situations-plan/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return deleteSpecialSituationsPlan({ id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error deleting special situations plan:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al eliminar el plan para la atención de situaciones especiales',
    };
  }
};

export const listSpecialSituationsPlanByCorpo = async ({
  corpo_id,
  refreshAccessToken,
  logout,
}: ListSpecialSituationsPlanByCorpoParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/special-situations-plan/corpo/${corpo_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return listSpecialSituationsPlanByCorpo({ corpo_id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error listing special situations plan:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al listar los planes para la atención de situaciones especiales',
      data: [],
    };
  }
};

interface CreateCleaningTasksActivitiesParams {
  requestData: {
    marca_id: number;
    miscelaneo: string | null;
    area_piso: string | null;
    turno_inicio: string | null;
    turno_fin: string | null;
    mes: string | null;
    supervisor: string | null;
    sucursal: string | null;
    area: string | null;
    cliente: string | null;
    actividades_ejecucion_diaria: string | null;
    actividades_ejecucion_semanal: string | null;
    actividades_quincenales: string | null;
    actividades_mensual: string | null;
    actividades_bimensual: string | null;
    actividades_trimestral: string | null;
    actividades_cuatrimestral: string | null;
    actividades_semestral: string | null;
    actividades_anual: string | null;
    otras_actividades: string | null;
    programa_eventos_especiales: string | null;
    firma_miscelaneo: string | null;
    firma_supervisor: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface UpdateCleaningTasksActivitiesParams {
  id: string;
  requestData: {
    miscelaneo?: string | null;
    area_piso?: string | null;
    turno_inicio?: string | null;
    turno_fin?: string | null;
    mes?: string | null;
    supervisor?: string | null;
    sucursal?: string | null;
    area?: string | null;
    cliente?: string | null;
    actividades_ejecucion_diaria?: string | null;
    actividades_ejecucion_semanal?: string | null;
    actividades_quincenales?: string | null;
    actividades_mensual?: string | null;
    actividades_bimensual?: string | null;
    actividades_trimestral?: string | null;
    actividades_cuatrimestral?: string | null;
    actividades_semestral?: string | null;
    actividades_anual?: string | null;
    otras_actividades?: string | null;
    programa_eventos_especiales?: string | null;
    firma_miscelaneo?: string | null;
    firma_supervisor?: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface DeleteCleaningTasksActivitiesParams {
  id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface ListCleaningTasksActivitiesByCorpoParams {
  corpo_id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

export const createCleaningTasksActivities = async ({
  requestData,
  refreshAccessToken,
  logout,
}: CreateCleaningTasksActivitiesParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/cleaning-tasks-activities`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return createCleaningTasksActivities({ requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating cleaning tasks activities:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al crear el registro de tareas o actividades de limpieza',
    };
  }
};

export const updateCleaningTasksActivities = async ({
  id,
  requestData,
  refreshAccessToken,
  logout,
}: UpdateCleaningTasksActivitiesParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/cleaning-tasks-activities/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return updateCleaningTasksActivities({ id, requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating cleaning tasks activities:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al actualizar el registro de tareas o actividades de limpieza',
    };
  }
};

export const deleteCleaningTasksActivities = async ({
  id,
  refreshAccessToken,
  logout,
}: DeleteCleaningTasksActivitiesParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/cleaning-tasks-activities/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return deleteCleaningTasksActivities({ id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error deleting cleaning tasks activities:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al eliminar el registro de tareas o actividades de limpieza',
    };
  }
};

export const listCleaningTasksActivitiesByCorpo = async ({
  corpo_id,
  refreshAccessToken,
  logout,
}: ListCleaningTasksActivitiesByCorpoParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/cleaning-tasks-activities/corpo/${corpo_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return listCleaningTasksActivitiesByCorpo({ corpo_id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error listing cleaning tasks activities:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al listar los registros de tareas o actividades de limpieza',
      data: [],
    };
  }
};

interface CreateRiskMatrixParams {
  requestData: {
    marca_id: number;
    riesgos: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface UpdateRiskMatrixParams {
  id: string;
  requestData: {
    riesgos?: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface DeleteRiskMatrixParams {
  id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface ListRiskMatrixByCorpoParams {
  corpo_id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

export const createRiskMatrix = async ({
  requestData,
  refreshAccessToken,
  logout,
}: CreateRiskMatrixParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/risk-matrix`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return createRiskMatrix({ requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating risk matrix:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al crear la matriz de riesgos',
    };
  }
};

export const updateRiskMatrix = async ({
  id,
  requestData,
  refreshAccessToken,
  logout,
}: UpdateRiskMatrixParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/risk-matrix/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return updateRiskMatrix({ id, requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating risk matrix:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al actualizar la matriz de riesgos',
    };
  }
};

export const deleteRiskMatrix = async ({
  id,
  refreshAccessToken,
  logout,
}: DeleteRiskMatrixParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/risk-matrix/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return deleteRiskMatrix({ id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error deleting risk matrix:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al eliminar la matriz de riesgos',
    };
  }
};

export const listRiskMatrixByCorpo = async ({
  corpo_id,
  refreshAccessToken,
  logout,
}: ListRiskMatrixByCorpoParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/risk-matrix/corpo/${corpo_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return listRiskMatrixByCorpo({ corpo_id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error listing risk matrix:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al listar las matrices de riesgos',
      data: [],
    };
  }
};

interface CreateOpportunityMatrixParams {
  requestData: {
    marca_id: number;
    oportunidades: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface UpdateOpportunityMatrixParams {
  id: string;
  requestData: {
    oportunidades?: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface DeleteOpportunityMatrixParams {
  id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface ListOpportunityMatrixByCorpoParams {
  corpo_id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

export const createOpportunityMatrix = async ({
  requestData,
  refreshAccessToken,
  logout,
}: CreateOpportunityMatrixParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/opportunity-matrix`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return createOpportunityMatrix({ requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating opportunity matrix:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al crear la matriz de oportunidades',
    };
  }
};

export const updateOpportunityMatrix = async ({
  id,
  requestData,
  refreshAccessToken,
  logout,
}: UpdateOpportunityMatrixParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/opportunity-matrix/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return updateOpportunityMatrix({ id, requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating opportunity matrix:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al actualizar la matriz de oportunidades',
    };
  }
};

export const deleteOpportunityMatrix = async ({
  id,
  refreshAccessToken,
  logout,
}: DeleteOpportunityMatrixParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/opportunity-matrix/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return deleteOpportunityMatrix({ id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error deleting opportunity matrix:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al eliminar la matriz de oportunidades',
    };
  }
};

export const listOpportunityMatrixByCorpo = async ({
  corpo_id,
  refreshAccessToken,
  logout,
}: ListOpportunityMatrixByCorpoParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/opportunity-matrix/corpo/${corpo_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return listOpportunityMatrixByCorpo({ corpo_id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error listing opportunity matrix:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al listar las matrices de oportunidades',
      data: [],
    };
  }
};

interface CreateProcessIndicatorMatrixParams {
  requestData: {
    marca_id: number;
    procesos: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface UpdateProcessIndicatorMatrixParams {
  id: string;
  requestData: {
    procesos?: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface DeleteProcessIndicatorMatrixParams {
  id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface ListProcessIndicatorMatrixByCorpoParams {
  corpo_id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

export const createProcessIndicatorMatrix = async ({
  requestData,
  refreshAccessToken,
  logout,
}: CreateProcessIndicatorMatrixParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/process-indicator-matrix`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return createProcessIndicatorMatrix({ requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating process indicator matrix:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al crear la matriz de indicador de procesos',
    };
  }
};

export const updateProcessIndicatorMatrix = async ({
  id,
  requestData,
  refreshAccessToken,
  logout,
}: UpdateProcessIndicatorMatrixParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/process-indicator-matrix/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return updateProcessIndicatorMatrix({ id, requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating process indicator matrix:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al actualizar la matriz de indicador de procesos',
    };
  }
};

export const deleteProcessIndicatorMatrix = async ({
  id,
  refreshAccessToken,
  logout,
}: DeleteProcessIndicatorMatrixParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/process-indicator-matrix/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return deleteProcessIndicatorMatrix({ id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error deleting process indicator matrix:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al eliminar la matriz de indicador de procesos',
    };
  }
};

export const listProcessIndicatorMatrixByCorpo = async ({
  corpo_id,
  refreshAccessToken,
  logout,
}: ListProcessIndicatorMatrixByCorpoParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/process-indicator-matrix/corpo/${corpo_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return listProcessIndicatorMatrixByCorpo({ corpo_id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error listing process indicator matrix:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al listar las matrices de indicador de procesos',
      data: [],
    };
  }
};

interface CreateMonthlyWorkRoleParams {
  requestData: {
    marca_id: number;
    mes_ano?: string | null;
    cliente?: string | null;
    empleados?: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface UpdateMonthlyWorkRoleParams {
  id: string;
  requestData: {
    mes_ano?: string | null;
    cliente?: string | null;
    empleados?: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface DeleteMonthlyWorkRoleParams {
  id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface ListMonthlyWorkRoleByCorpoParams {
  corpo_id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

export const createMonthlyWorkRole = async ({
  requestData,
  refreshAccessToken,
  logout,
}: CreateMonthlyWorkRoleParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/monthly-work-role`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return createMonthlyWorkRole({ requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating monthly work role:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al crear el rol de trabajo mensual',
    };
  }
};

export const updateMonthlyWorkRole = async ({
  id,
  requestData,
  refreshAccessToken,
  logout,
}: UpdateMonthlyWorkRoleParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/monthly-work-role/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return updateMonthlyWorkRole({ id, requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating monthly work role:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al actualizar el rol de trabajo mensual',
    };
  }
};

export const deleteMonthlyWorkRole = async ({
  id,
  refreshAccessToken,
  logout,
}: DeleteMonthlyWorkRoleParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/monthly-work-role/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return deleteMonthlyWorkRole({ id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error deleting monthly work role:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al eliminar el rol de trabajo mensual',
    };
  }
};

export const listMonthlyWorkRoleByCorpo = async ({
  corpo_id,
  refreshAccessToken,
  logout,
}: ListMonthlyWorkRoleByCorpoParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/monthly-work-role/corpo/${corpo_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return listMonthlyWorkRoleByCorpo({ corpo_id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error listing monthly work role:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al listar los roles de trabajo mensual',
      data: [],
    };
  }
};

interface CreatePermitRequestParams {
  requestData: {
    marca_id: number;
    division: string;
    persona_solicita: string;
    codigo: string;
    contrato: string;
    horario: string;
    fecha_solicitud: string; // dd/mm/yyyy (server lo convierte a DateTime)
    motivo_permiso: string;
    permiso_sustituido_por: string;
    codigo_sustituto: string;
    firma_gerente: string;
    firma_encargado_monitoreo: string;
    permiso_coordinado_por: string;
    firma_responsables: string;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface UpdatePermitRequestParams {
  id: string | number;
  requestData: {
    division?: string | null;
    persona_solicita?: string | null;
    codigo?: string | null;
    contrato?: string | null;
    horario?: string | null;
    fecha_solicitud?: string | null;
    motivo_permiso?: string | null;
    permiso_sustituido_por?: string | null;
    codigo_sustituto?: string | null;
    firma_gerente?: string | null;
    firma_encargado_monitoreo?: string | null;
    permiso_coordinado_por?: string | null;
    firma_responsables?: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface DeletePermitRequestParams {
  id: string | number;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface ListPermitRequestByCorpoParams {
  corpo_id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

export const createPermitRequest = async ({
  requestData,
  refreshAccessToken,
  logout,
}: CreatePermitRequestParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/permit-request`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return createPermitRequest({ requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating permit request:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al crear la solicitud de permiso',
    };
  }
};

export const updatePermitRequest = async ({
  id,
  requestData,
  refreshAccessToken,
  logout,
}: UpdatePermitRequestParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/permit-request/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return updatePermitRequest({ id, requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating permit request:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al actualizar la solicitud de permiso',
    };
  }
};

export const deletePermitRequest = async ({
  id,
  refreshAccessToken,
  logout,
}: DeletePermitRequestParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/permit-request/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return deletePermitRequest({ id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error deleting permit request:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al eliminar la solicitud de permiso',
    };
  }
};

export const listPermitRequestByCorpo = async ({
  corpo_id,
  refreshAccessToken,
  logout,
}: ListPermitRequestByCorpoParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/permit-request/corpo/${corpo_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return listPermitRequestByCorpo({ corpo_id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data = (await response.json()) as ApiResponse;
    if (Array.isArray(data.data)) {
      data.data = data.data.filter((r: any) => r?.isActive !== false);
    }
    return data;
  } catch (error) {
    console.error('Error listing permit requests:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al listar las solicitudes de permiso',
      data: [],
    };
  }
};

interface ListPermitRequestMineParams {
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

export const listPermitRequestMine = async ({
  refreshAccessToken,
  logout,
}: ListPermitRequestMineParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/permit-request?mode=mine`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return listPermitRequestMine({ refreshAccessToken, logout });
      }
      await logout();
      throw new Error('Sesión expirada');
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data = (await response.json()) as ApiResponse;
    if (Array.isArray(data.data)) {
      data.data = data.data.filter((r: any) => r?.isActive !== false);
    }
    return data;
  } catch (error) {
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al listar solicitudes de permiso',
      data: [],
    };
  }
};

// =========================
// Acta de entrega de productos
// =========================

interface ActaEntregaProductoImageInput {
  file_base64: string; // base64 o dataURL
  extension?: string; // jpg | png | etc
}

interface CreateActaEntregaProductoParams {
  requestData: {
    marca_id: number;
    empresa_id?: number;
    cliente_id?: number;
    division_id?: number;
    contrato_id?: number;
    corpo_id?: number;
    tipo_entrega: string;
    mensual: string;
    detalle: string; // JSON string
    observaciones: string;
    nombre_entrega: string;
    cedula_entrega: string;
    fecha_entrega: string; // ISO string
    firma_entrega: string; // dataURL/base64
    nombre_recibe: string;
    cedula_recibe: string;
    fecha_recibe: string; // ISO string
    firma_recibe: string; // dataURL/base64
    firma_responsable: string; // hash base64 (QR)
    imagenes?: string; // JSON string (ActaEntregaProductoImageInput[])
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface UpdateActaEntregaProductoParams {
  id: string | number;
  requestData: {
    empresa_id?: number | null;
    cliente_id?: number | null;
    division_id?: number | null;
    contrato_id?: number | null;
    corpo_id?: number | null;
    tipo_entrega?: string | null;
    mensual?: string | null;
    detalle?: string | null;
    observaciones?: string | null;
    nombre_entrega?: string | null;
    cedula_entrega?: string | null;
    fecha_entrega?: string | null;
    firma_entrega?: string | null;
    nombre_recibe?: string | null;
    cedula_recibe?: string | null;
    fecha_recibe?: string | null;
    firma_recibe?: string | null;
    firma_responsable?: string | null;
    imagenes?: string | null; // JSON string (ActaEntregaProductoImageInput[])
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface DeleteActaEntregaProductoParams {
  id: string | number;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface DeleteActaEntregaProductoImageParams {
  id: string | number;
  imageId: string | number;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface ListActaEntregaProductoByCorpoParams {
  corpo_id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

export const createActaEntregaProducto = async ({
  requestData,
  refreshAccessToken,
  logout,
}: CreateActaEntregaProductoParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/acta-entrega-productos`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) return createActaEntregaProducto({ requestData, refreshAccessToken, logout });
      await logout();
      throw new Error('Sesión expirada');
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating acta entrega producto:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al crear el acta de entrega de productos',
    };
  }
};

export const updateActaEntregaProducto = async ({
  id,
  requestData,
  refreshAccessToken,
  logout,
}: UpdateActaEntregaProductoParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/acta-entrega-productos/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) return updateActaEntregaProducto({ id, requestData, refreshAccessToken, logout });
      await logout();
      throw new Error('Sesión expirada');
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating acta entrega producto:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al actualizar el acta de entrega de productos',
    };
  }
};

export const deleteActaEntregaProducto = async ({
  id,
  refreshAccessToken,
  logout,
}: DeleteActaEntregaProductoParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/acta-entrega-productos/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) return deleteActaEntregaProducto({ id, refreshAccessToken, logout });
      await logout();
      throw new Error('Sesión expirada');
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error deleting acta entrega producto:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al eliminar el acta de entrega de productos',
    };
  }
};

export const deleteActaEntregaProductoImage = async ({
  id,
  imageId,
  refreshAccessToken,
  logout,
}: DeleteActaEntregaProductoImageParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/acta-entrega-productos/${id}/image/${imageId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) return deleteActaEntregaProductoImage({ id, imageId, refreshAccessToken, logout });
      await logout();
      throw new Error('Sesión expirada');
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error deleting acta entrega image:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al eliminar adjunto del acta',
    };
  }
};

interface ListActaEntregaProductoParams {
  empresa_id?: number;
  cliente_id?: number;
  division_id?: number;
  contrato_id?: number;
  corpo_id?: number;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

export const listActaEntregaProducto = async ({
  empresa_id,
  cliente_id,
  division_id,
  contrato_id,
  corpo_id,
  refreshAccessToken,
  logout,
}: ListActaEntregaProductoParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    // Construir query parameters
    const params = new URLSearchParams();
    if (empresa_id) params.append('empresa_id', String(empresa_id));
    if (cliente_id) params.append('cliente_id', String(cliente_id));
    if (division_id) params.append('division_id', String(division_id));
    if (contrato_id) params.append('contrato_id', String(contrato_id));
    if (corpo_id) params.append('corpo_id', String(corpo_id));

    const response = await fetch(`${apiUrl}/api/acta-entrega-productos?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return listActaEntregaProducto({ empresa_id, cliente_id, division_id, contrato_id, corpo_id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error listing actas entrega producto:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al listar actas de entrega de productos',
      data: [],
    };
  }
};

export const listActaEntregaProductoByCorpo = async ({
  corpo_id,
  refreshAccessToken,
  logout,
}: ListActaEntregaProductoByCorpoParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/acta-entrega-productos/corpo/${corpo_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) return listActaEntregaProductoByCorpo({ corpo_id, refreshAccessToken, logout });
      await logout();
      throw new Error('Sesión expirada');
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error listing actas entrega producto:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al listar actas de entrega de productos',
      data: [],
    };
  }
};

interface CreateAttendanceControlParams {
  requestData: {
    marca_id: number;
    empresa_id?: number;
    cliente_id?: number;
    division_id?: number;
    contrato_id?: number;
    corpo_id?: number;
    puesto_id?: number;
    fecha?: string | null;
    turno?: string | null;
    firma_responsable?: string | null;
    total_empleados_turno?: number;
    nombre_supervisor?: string | null;
    comentarios?: string | null;
    firma_manual_supervisor?: string | null;
    firmas_empleados?: string;
    imagenes?: string;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface UpdateAttendanceControlParams {
  id: string;
  requestData: {
    empresa_id?: number;
    cliente_id?: number;
    division_id?: number;
    contrato_id?: number;
    corpo_id?: number;
    puesto_id?: number;
    fecha?: string | null;
    turno?: string | null;
    firma_responsable?: string | null;
    total_empleados_turno?: number;
    nombre_supervisor?: string | null;
    comentarios?: string | null;
    firma_manual_supervisor?: string | null;
    firmas_empleados?: string;
    imagenes?: string;
    delete_imagenes?: string;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface DeleteAttendanceControlParams {
  id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface ListAttendanceControlByCorpoParams {
  corpo_id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

export const createAttendanceControl = async ({
  requestData,
  refreshAccessToken,
  logout,
}: CreateAttendanceControlParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/attendance-control`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return createAttendanceControl({ requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating attendance control:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al crear el control de asistencia',
    };
  }
};

export const updateAttendanceControl = async ({
  id,
  requestData,
  refreshAccessToken,
  logout,
}: UpdateAttendanceControlParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/attendance-control/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return updateAttendanceControl({ id, requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating attendance control:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al actualizar el control de asistencia',
    };
  }
};

export const deleteAttendanceControl = async ({
  id,
  refreshAccessToken,
  logout,
}: DeleteAttendanceControlParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/attendance-control/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return deleteAttendanceControl({ id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error deleting attendance control:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al eliminar el control de asistencia',
    };
  }
};

interface DeleteAttendanceControlImageParams {
  controlId: string | number;
  imageId: number;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

export const deleteAttendanceControlImage = async ({
  controlId,
  imageId,
  refreshAccessToken,
  logout,
}: DeleteAttendanceControlImageParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const url = `${apiUrl}/api/attendance-control/${encodeURIComponent(String(controlId))}/images/${encodeURIComponent(String(imageId))}`;
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return deleteAttendanceControlImage({ controlId, imageId, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error deleting attendance control image:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al eliminar la imagen',
    };
  }
};

interface UpdateAttendanceEmpleadoSignatureParams {
  controlId: string | number;
  marca_id: number;
  firma: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

export const updateAttendanceEmpleadoSignature = async ({
  controlId,
  marca_id,
  firma,
  refreshAccessToken,
  logout,
}: UpdateAttendanceEmpleadoSignatureParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/attendance-control/${encodeURIComponent(String(controlId))}/employee-signature`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify({ marca_id, firma }),
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return updateAttendanceEmpleadoSignature({ controlId, marca_id, firma, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating attendance employee signature:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al actualizar la firma manual del empleado',
    };
  }
};

interface ListAttendanceControlParams {
  empresa_id?: number;
  cliente_id?: number;
  division_id?: number;
  contrato_id?: number;
  corpo_id?: number;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

export const listAttendanceControl = async ({
  empresa_id,
  cliente_id,
  division_id,
  contrato_id,
  corpo_id,
  refreshAccessToken,
  logout,
}: ListAttendanceControlParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    // Construir query parameters
    const params = new URLSearchParams();
    if (empresa_id) params.append('empresa_id', String(empresa_id));
    if (cliente_id) params.append('cliente_id', String(cliente_id));
    if (division_id) params.append('division_id', String(division_id));
    if (contrato_id) params.append('contrato_id', String(contrato_id));
    if (corpo_id) params.append('corpo_id', String(corpo_id));

    const response = await fetch(`${apiUrl}/api/attendance-control?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return listAttendanceControl({ empresa_id, cliente_id, division_id, contrato_id, corpo_id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    if (data?.data && Array.isArray(data.data)) {
      data.data = data.data.filter((r: any) => r && r.isActive !== false);
    }
    return data;
  } catch (error) {
    console.error('Error listing attendance control:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al listar los controles de asistencia',
      data: [],
    };
  }
};

export const listAttendanceControlByCorpo = async ({
  corpo_id,
  refreshAccessToken,
  logout,
}: ListAttendanceControlByCorpoParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/attendance-control/corpo/${corpo_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return listAttendanceControlByCorpo({ corpo_id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    if (data?.data && Array.isArray(data.data)) {
      data.data = data.data.filter((r: any) => r && r.isActive !== false);
    }
    return data;
  } catch (error) {
    console.error('Error listing attendance control:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al listar los controles de asistencia',
      data: [],
    };
  }
};

interface CreateOpeningClosingPositionParams {
  requestData: {
    marca_id: number;
    empresa_id?: number;
    cliente_id: number;
    corpo_id: number;
    puesto_id: number;
    division_id: number;
    contrato_id?: number;
    fecha: string; // ISO date string
    tipo: "Apertura" | "Cierre";
    nombre_representante_cliente: string;
    nombre_representante_empresa_entrante: string;
    nombre_representante_empresa_saliente: string;
    actividades: string; // JSON string
    inventario: string; // JSON string (si no aplica, enviar "[]")
    otras_observaciones?: string | null;
    firma_representante_cliente: string; // base64
    firma_representante_empresa_entrante: string; // base64
    firma_representante_empresa_saliente: string; // base64
    firma_responsable: string; // hash QR
    imagenes?: string | null; // JSON string [{file_base64, extension, original_name}]
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface UpdateOpeningClosingPositionParams {
  id: string;
  requestData: {
    empresa_id?: number;
    cliente_id?: number;
    corpo_id?: number;
    puesto_id?: number;
    division_id?: number;
    contrato_id?: number;
    fecha?: string;
    tipo?: "Apertura" | "Cierre";
    nombre_representante_cliente?: string;
    nombre_representante_empresa_entrante?: string;
    nombre_representante_empresa_saliente?: string;
    actividades?: string;
    inventario?: string;
    otras_observaciones?: string | null;
    firma_representante_cliente?: string;
    firma_representante_empresa_entrante?: string;
    firma_representante_empresa_saliente?: string;
    firma_responsable?: string;
    imagenes?: string | null; // nuevas a agregar
    delete_imagenes?: string | null; // JSON string number[]
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface DeleteOpeningClosingPositionParams {
  id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface ListOpeningClosingPositionByCorpoParams {
  corpo_id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface DeleteOpeningClosingPositionImageParams {
  id: string;
  imageId: number;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

export const createOpeningClosingPosition = async ({
  requestData,
  refreshAccessToken,
  logout,
}: CreateOpeningClosingPositionParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/opening-closing-position`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return createOpeningClosingPosition({ requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    if (data?.status && Array.isArray((data as any).data)) {
      (data as any).data = ((data as any).data as any[]).filter((row) => row?.isActive !== false);
    }
    return data;
  } catch (error) {
    console.error('Error creating opening-closing position:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al crear la apertura-cierre de puesto',
    };
  }
};

export const deleteOpeningClosingPositionImage = async ({
  id,
  imageId,
  refreshAccessToken,
  logout,
}: DeleteOpeningClosingPositionImageParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');
    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }
    const response = await fetch(`${apiUrl}/api/opening-closing-position/${id}/image/${imageId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });
    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) return deleteOpeningClosingPositionImage({ id, imageId, refreshAccessToken, logout });
      await logout();
      throw new Error('Sesión expirada');
    }
    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }
    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error deleting opening-closing image:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al eliminar imagen de apertura-cierre de puesto',
    };
  }
};

export const updateOpeningClosingPosition = async ({
  id,
  requestData,
  refreshAccessToken,
  logout,
}: UpdateOpeningClosingPositionParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/opening-closing-position/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return updateOpeningClosingPosition({ id, requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating opening-closing position:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al actualizar la apertura-cierre de puesto',
    };
  }
};

export const deleteOpeningClosingPosition = async ({
  id,
  refreshAccessToken,
  logout,
}: DeleteOpeningClosingPositionParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/opening-closing-position/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return deleteOpeningClosingPosition({ id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error deleting opening-closing position:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al eliminar la apertura-cierre de puesto',
    };
  }
};

export const listOpeningClosingPositionByCorpo = async ({
  corpo_id,
  refreshAccessToken,
  logout,
}: ListOpeningClosingPositionByCorpoParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/opening-closing-position/corpo/${corpo_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return listOpeningClosingPositionByCorpo({ corpo_id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error listing opening-closing position:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al listar las aperturas-cierres de puesto',
      data: [],
    };
  }
};

interface CreateInductionTourRecordParams {
  requestData: {
    marca_id: number;
    /** Jerarquía completa requerida por el servidor (empresa → plaza). */
    empresa_id?: number | null;
    cliente_id?: number | null;
    division_id?: number | null;
    contrato_id?: number | null;
    corpo_id?: number | null;
    puesto_id?: number | null;
    plaza_id?: number | null;
    empleado_id?: number | null;
    fecha?: string | null;
    division?: string | null;
    renglon_edificio?: string | null;
    supervisor_cliente?: string | null;
    supervisor_corporacion?: string | null;
    temas_desarrollados?: string | null;
    aspectos_especificos?: string | null;
    participantes?: string | null;
    firma_supervisor?: string | null;
    firma_empleado?: string | null;
    firma_responsable?: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface UpdateInductionTourRecordParams {
  id: string;
  requestData: {
    empresa_id?: number | null;
    cliente_id?: number | null;
    division_id?: number | null;
    contrato_id?: number | null;
    corpo_id?: number | null;
    puesto_id?: number | null;
    plaza_id?: number | null;
    empleado_id?: number | null;
    fecha?: string | null;
    division?: string | null;
    renglon_edificio?: string | null;
    supervisor_cliente?: string | null;
    supervisor_corporacion?: string | null;
    temas_desarrollados?: string | null;
    aspectos_especificos?: string | null;
    participantes?: string | null;
    firma_supervisor?: string | null;
    firma_empleado?: string | null;
    firma_responsable?: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface DeleteInductionTourRecordParams {
  id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface ListInductionTourRecordByCorpoParams {
  corpo_id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

export const createInductionTourRecord = async ({
  requestData,
  refreshAccessToken,
  logout,
}: CreateInductionTourRecordParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/induction-tour-record`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return createInductionTourRecord({ requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating induction tour record:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al crear el registro de inducción y recorrido',
    };
  }
};

export const updateInductionTourRecord = async ({
  id,
  requestData,
  refreshAccessToken,
  logout,
}: UpdateInductionTourRecordParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/induction-tour-record/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return updateInductionTourRecord({ id, requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating induction tour record:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al actualizar el registro de inducción y recorrido',
    };
  }
};

export const deleteInductionTourRecord = async ({
  id,
  refreshAccessToken,
  logout,
}: DeleteInductionTourRecordParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/induction-tour-record/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return deleteInductionTourRecord({ id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error deleting induction tour record:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al eliminar el registro de inducción y recorrido',
    };
  }
};

export interface ListInductionTourRecordsParams {
  empresa_id?: number;
  cliente_id?: number;
  division_id?: number;
  contrato_id?: number;
  corpo_id?: number;
  puesto_id?: number;
  plaza_id?: number;
  refreshAccessToken?: () => Promise<boolean>;
  logout?: () => Promise<any>;
}

export const listInductionTourRecords = async ({
  empresa_id,
  cliente_id,
  division_id,
  contrato_id,
  corpo_id,
  puesto_id,
  plaza_id,
  refreshAccessToken,
  logout,
}: ListInductionTourRecordsParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken?.();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const queryParams = new URLSearchParams();
    if (empresa_id) queryParams.append('empresa_id', empresa_id.toString());
    if (cliente_id) queryParams.append('cliente_id', cliente_id.toString());
    if (division_id) queryParams.append('division_id', division_id.toString());
    if (contrato_id) queryParams.append('contrato_id', contrato_id.toString());
    if (corpo_id) queryParams.append('corpo_id', corpo_id.toString());
    if (puesto_id) queryParams.append('puesto_id', puesto_id.toString());
    if (plaza_id) queryParams.append('plaza_id', plaza_id.toString());

    const response = await fetch(`${apiUrl}/api/induction-tour-record?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken?.();
      if (refreshed) return listInductionTourRecords({ empresa_id, cliente_id, division_id, contrato_id, corpo_id, puesto_id, plaza_id, refreshAccessToken, logout });
      if (logout) await logout();
      throw new Error('Sesión expirada');
    }

    if (response.status === 403) {
      if (logout) await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    if (data.status && Array.isArray(data.data)) {
      (data as any).data = (data.data as any[]).filter((r: any) => r?.isActive !== false);
    }
    return data;
  } catch (error) {
    console.error('Error listing induction tour records:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al listar los registros de inducción y recorrido',
      data: [],
    };
  }
};

export const listInductionTourRecordByCorpo = async ({
  corpo_id,
  refreshAccessToken,
  logout,
}: ListInductionTourRecordByCorpoParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/induction-tour-record/corpo/${corpo_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return listInductionTourRecordByCorpo({ corpo_id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    if (data.status && Array.isArray(data.data)) {
      (data as any).data = (data.data as any[]).filter((r: any) => r?.isActive !== false);
    }
    return data;
  } catch (error) {
    console.error('Error listing induction tour record:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al listar los registros de inducción y recorrido',
      data: [],
    };
  }
};

// =========================================================
// Registro Inducción General
// =========================================================

interface CreateGeneralInductionRegisterParams {
  requestData: {
    empresa_id: number;
    cliente_id: number;
    corpo_id: number;
    division_id: number;
    contrato_id: number;
    puesto_id: number;
    division: string;
    fecha?: string | null;
    temas_a_tratar: string;
    colaboradores: string;
    capacitadores: string;
    firma_responsable: string;
    imagenes?: string | null; // JSON string [{file_base64, extension, original_name}]
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface UpdateGeneralInductionRegisterParams {
  id: string;
  requestData: {
    empresa_id?: number;
    cliente_id?: number;
    corpo_id?: number;
    division_id?: number;
    contrato_id?: number;
    puesto_id?: number;
    division?: string;
    fecha?: string | null;
    temas_a_tratar?: string;
    colaboradores?: string;
    capacitadores?: string;
    firma_responsable?: string;
    imagenes?: string | null; // JSON string [{file_base64, extension, original_name}]
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface DeleteGeneralInductionRegisterParams {
  id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface ListGeneralInductionRegisterByCorpoParams {
  corpo_id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

export const createGeneralInductionRegister = async ({
  requestData,
  refreshAccessToken,
  logout,
}: CreateGeneralInductionRegisterParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/general-induction-register`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) return createGeneralInductionRegister({ requestData, refreshAccessToken, logout });
      await logout();
      throw new Error('Sesión expirada');
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating general induction register:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al crear el registro de inducción general',
    };
  }
};

export const updateGeneralInductionRegister = async ({
  id,
  requestData,
  refreshAccessToken,
  logout,
}: UpdateGeneralInductionRegisterParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/general-induction-register/${id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) return updateGeneralInductionRegister({ id, requestData, refreshAccessToken, logout });
      await logout();
      throw new Error('Sesión expirada');
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating general induction register:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al actualizar el registro de inducción general',
    };
  }
};

interface DeleteGeneralInductionRegisterImageParams {
  registroId: string;
  imageId: number;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

export const deleteGeneralInductionRegisterImage = async ({
  registroId,
  imageId,
  refreshAccessToken,
  logout,
}: DeleteGeneralInductionRegisterImageParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(
      `${apiUrl}/api/general-induction-register/${encodeURIComponent(registroId)}/image/${encodeURIComponent(String(imageId))}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '69420',
        },
      }
    );

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return deleteGeneralInductionRegisterImage({ registroId, imageId, refreshAccessToken, logout });
      }
      await logout();
      throw new Error('Sesión expirada');
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    return (await response.json()) as ApiResponse;
  } catch (error) {
    console.error('Error deleting general induction register image:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al eliminar la imagen',
    };
  }
};

export const deleteGeneralInductionRegister = async ({
  id,
  refreshAccessToken,
  logout,
}: DeleteGeneralInductionRegisterParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/general-induction-register/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) return deleteGeneralInductionRegister({ id, refreshAccessToken, logout });
      await logout();
      throw new Error('Sesión expirada');
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error deleting general induction register:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al eliminar el registro de inducción general',
    };
  }
};

export interface ListGeneralInductionRegistersParams {
  empresa_id?: number;
  cliente_id?: number;
  corpo_id?: number;
  refreshAccessToken?: () => Promise<boolean>;
  logout?: () => Promise<any>;
}

export const listGeneralInductionRegisters = async ({
  empresa_id,
  cliente_id,
  corpo_id,
  refreshAccessToken,
  logout,
}: ListGeneralInductionRegistersParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken?.();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const queryParams = new URLSearchParams();
    if (empresa_id) queryParams.append('empresa_id', empresa_id.toString());
    if (cliente_id) queryParams.append('cliente_id', cliente_id.toString());
    if (corpo_id) queryParams.append('corpo_id', corpo_id.toString());

    const response = await fetch(`${apiUrl}/api/general-induction-register?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken?.();
      if (refreshed) return listGeneralInductionRegisters({ empresa_id, cliente_id, corpo_id, refreshAccessToken, logout });
      if (logout) await logout();
      throw new Error('Sesión expirada');
    }

    if (response.status === 403) {
      if (logout) await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    if (data.status && Array.isArray(data.data)) {
      data.data = data.data.filter((r: any) => r?.isActive !== false);
    }
    return data;
  } catch (error) {
    console.error('Error listing general induction registers:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al listar los registros de inducción general',
      data: [],
    };
  }
};

export const listGeneralInductionRegisterByCorpo = async ({
  corpo_id,
  refreshAccessToken,
  logout,
}: ListGeneralInductionRegisterByCorpoParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/general-induction-register/corpo/${corpo_id}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) return listGeneralInductionRegisterByCorpo({ corpo_id, refreshAccessToken, logout });
      await logout();
      throw new Error('Sesión expirada');
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data = (await response.json()) as ApiResponse;
    if (Array.isArray(data.data)) {
      data.data = data.data.filter((r: any) => r?.isActive !== false);
    }
    return data;
  } catch (error) {
    console.error('Error listing general induction register:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al listar los registros de inducción general',
      data: [],
    };
  }
};

interface CreateSupervisionReportParams {
  requestData: {
    marca_id: number;
    fecha?: string | null;
    piso?: string | null;
    area?: string | null;
    aseador?: string | null;
    supervisor?: string | null;
    limpieza_general?: string | null;
    cuarto_aseo?: string | null;
    servicios_sanitarios?: string | null;
    uniforme_presentacion?: string | null;
    estado_equipos?: string | null;
    calificacion_general?: string | null;
    firma_aseador?: string | null;
    firma_supervisor?: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface UpdateSupervisionReportParams {
  id: string;
  requestData: {
    fecha?: string | null;
    piso?: string | null;
    area?: string | null;
    aseador?: string | null;
    supervisor?: string | null;
    limpieza_general?: string | null;
    cuarto_aseo?: string | null;
    servicios_sanitarios?: string | null;
    uniforme_presentacion?: string | null;
    estado_equipos?: string | null;
    calificacion_general?: string | null;
    firma_aseador?: string | null;
    firma_supervisor?: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface DeleteSupervisionReportParams {
  id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface ListSupervisionReportByCorpoParams {
  corpo_id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

export const createSupervisionReport = async ({
  requestData,
  refreshAccessToken,
  logout,
}: CreateSupervisionReportParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/supervision-report`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return createSupervisionReport({ requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }
    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating supervision report:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al crear el informe de supervisión',
    };
  }
};

export const updateSupervisionReport = async ({
  id,
  requestData,
  refreshAccessToken,
  logout,
}: UpdateSupervisionReportParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/supervision-report/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return updateSupervisionReport({ id, requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating supervision report:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al actualizar el informe de supervisión',
    };
  }
};

export const deleteSupervisionReport = async ({
  id,
  refreshAccessToken,
  logout,
}: DeleteSupervisionReportParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/supervision-report/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return deleteSupervisionReport({ id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error deleting supervision report:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al eliminar el informe de supervisión',
    };
  }
};

export const listSupervisionReportByCorpo = async ({
  corpo_id,
  refreshAccessToken,
  logout,
}: ListSupervisionReportByCorpoParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/supervision-report/corpo/${corpo_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return listSupervisionReportByCorpo({ corpo_id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error listing supervision report:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al listar los informes de supervisión',
      data: [],
    };
  }
};

interface CreateElectricBrushGuideParams {
  requestData: {
    marca_id: number;
    miscelaneo?: string | null;
    capacitador?: string | null;
    cedula?: string | null;
    fecha?: string | null;
    firma_miscelaneo?: string | null;
    firma_capacitador?: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface UpdateElectricBrushGuideParams {
  id: string;
  requestData: {
    miscelaneo?: string | null;
    capacitador?: string | null;
    cedula?: string | null;
    fecha?: string | null;
    firma_miscelaneo?: string | null;
    firma_capacitador?: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface DeleteElectricBrushGuideParams {
  id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface ListElectricBrushGuideByCorpoParams {
  corpo_id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

export const createElectricBrushGuide = async ({
  requestData,
  refreshAccessToken,
  logout,
}: CreateElectricBrushGuideParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/electric-brush-guide`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return createElectricBrushGuide({ requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating electric brush guide:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al crear la guía de uso de cepillo eléctrico',
    };
  }
};

export const updateElectricBrushGuide = async ({
  id,
  requestData,
  refreshAccessToken,
  logout,
}: UpdateElectricBrushGuideParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/electric-brush-guide/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return updateElectricBrushGuide({ id, requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating electric brush guide:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al actualizar la guía de uso de cepillo eléctrico',
    };
  }
};

export const deleteElectricBrushGuide = async ({
  id,
  refreshAccessToken,
  logout,
}: DeleteElectricBrushGuideParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/electric-brush-guide/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return deleteElectricBrushGuide({ id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error deleting electric brush guide:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al eliminar la guía de uso de cepillo eléctrico',
    };
  }
};

export const listElectricBrushGuideByCorpo = async ({
  corpo_id,
  refreshAccessToken,
  logout,
}: ListElectricBrushGuideByCorpoParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/electric-brush-guide/corpo/${corpo_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return listElectricBrushGuideByCorpo({ corpo_id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error listing electric brush guide:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al listar las guías de uso de cepillo eléctrico',
      data: [],
    };
  }
};

interface CreateGeneralClientsListParams {
  requestData: {
    marca_id: number;
    numero_cliente?: string | null;
    fecha_inicio?: string | null;
    fecha_finalizacion?: string | null;
    extension_prorroga?: string | null;
    nombre_cliente?: string | null;
    area_sede?: string | null;
    numero_corpo?: string | null;
    numero_licitacion?: string | null;
    cantidad_miscelaneos?: string | null;
    tipo_requerimiento_insumos?: string | null;
    tipo_requerimiento_utencilios?: string | null;
    tipo_requerimiento_equipos?: string | null;
    ubicacion?: string | null;
    fecha_reunion_apertura?: string | null;
    necesidades?: string | null;
    gustos_preferencias?: string | null;
    supervisor_asignado?: string | null;
    condiciones_licitaciones?: string | null;
    plan_trabajo?: string | null;
    encuestas?: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface UpdateGeneralClientsListParams {
  id: string;
  requestData: {
    numero_cliente?: string | null;
    fecha_inicio?: string | null;
    fecha_finalizacion?: string | null;
    extension_prorroga?: string | null;
    nombre_cliente?: string | null;
    area_sede?: string | null;
    numero_corpo?: string | null;
    numero_licitacion?: string | null;
    cantidad_miscelaneos?: string | null;
    tipo_requerimiento_insumos?: string | null;
    tipo_requerimiento_utencilios?: string | null;
    tipo_requerimiento_equipos?: string | null;
    ubicacion?: string | null;
    fecha_reunion_apertura?: string | null;
    necesidades?: string | null;
    gustos_preferencias?: string | null;
    supervisor_asignado?: string | null;
    condiciones_licitaciones?: string | null;
    plan_trabajo?: string | null;
    encuestas?: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface DeleteGeneralClientsListParams {
  id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface ListGeneralClientsListByCorpoParams {
  corpo_id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

export const createGeneralClientsList = async ({
  requestData,
  refreshAccessToken,
  logout,
}: CreateGeneralClientsListParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/general-clients-list`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return createGeneralClientsList({ requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating general clients list:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al crear el listado general de clientes',
    };
  }
};

export const updateGeneralClientsList = async ({
  id,
  requestData,
  refreshAccessToken,
  logout,
}: UpdateGeneralClientsListParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/general-clients-list/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return updateGeneralClientsList({ id, requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating general clients list:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al actualizar el listado general de clientes',
    };
  }
};

export const deleteGeneralClientsList = async ({
  id,
  refreshAccessToken,
  logout,
}: DeleteGeneralClientsListParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/general-clients-list/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return deleteGeneralClientsList({ id, refreshAccessToken, logout });
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
    console.error('Error deleting general clients list:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al eliminar el listado general de clientes',
    };
  }
};

export const listGeneralClientsListByCorpo = async ({
  corpo_id,
  refreshAccessToken,
  logout,
}: ListGeneralClientsListByCorpoParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/general-clients-list/corpo/${corpo_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return listGeneralClientsListByCorpo({ corpo_id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error listing general clients list:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al listar los listados generales de clientes',
      data: [],
    };
  }
};

interface CreateImprovementActionsControlParams {
  requestData: {
    marca_id: number;
    numero_accion?: string | null;
    causa_origen?: string | null;
    fecha_deteccion_incidencia?: string | null;
    mes_deteccion?: string | null;
    tipo_accion?: string | null;
    proceso_relacionado?: string | null;
    encargado_proceso?: string | null;
    origen_accion?: string | null;
    fecha_elaboracion_plan?: string | null;
    tiempo_plan_vs_deteccion?: string | null;
    plan_elaborado_a_tiempo?: string | null;
    detalle_nc_opr_dm?: string | null;
    analisis_causas?: string | null;
    accion_inmediata?: string | null;
    accion_mejora?: string | null;
    fecha_aprobacion?: string | null;
    responsable_ejecucion?: string | null;
    fecha_programada_ejecucion?: string | null;
    fecha_real_ejecucion?: string | null;
    mes_ejecucion?: string | null;
    modif_fecha_ejecucion_motivo?: string | null;
    aplica_seguimiento?: string | null;
    seguimiento_meses?: string | null;
    evidencias?: string | null;
    estado_accion?: string | null;
    a_tiempo?: string | null;
    no_conformidades_similares?: string | null;
    reincidencia?: string | null;
    actualiza_matriz_riesgos?: string | null;
    efectividad?: string | null;
    no_efectiva?: string | null;
    cambiar_al_8d?: string | null;
    cerrada?: string | null;
    dueño_proceso?: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface UpdateImprovementActionsControlParams {
  id: string;
  requestData: {
    numero_accion?: string | null;
    causa_origen?: string | null;
    fecha_deteccion_incidencia?: string | null;
    mes_deteccion?: string | null;
    tipo_accion?: string | null;
    proceso_relacionado?: string | null;
    encargado_proceso?: string | null;
    origen_accion?: string | null;
    fecha_elaboracion_plan?: string | null;
    tiempo_plan_vs_deteccion?: string | null;
    plan_elaborado_a_tiempo?: string | null;
    detalle_nc_opr_dm?: string | null;
    analisis_causas?: string | null;
    accion_inmediata?: string | null;
    accion_mejora?: string | null;
    fecha_aprobacion?: string | null;
    responsable_ejecucion?: string | null;
    fecha_programada_ejecucion?: string | null;
    fecha_real_ejecucion?: string | null;
    mes_ejecucion?: string | null;
    modif_fecha_ejecucion_motivo?: string | null;
    aplica_seguimiento?: string | null;
    seguimiento_meses?: string | null;
    evidencias?: string | null;
    estado_accion?: string | null;
    a_tiempo?: string | null;
    no_conformidades_similares?: string | null;
    reincidencia?: string | null;
    actualiza_matriz_riesgos?: string | null;
    efectividad?: string | null;
    no_efectiva?: string | null;
    cambiar_al_8d?: string | null;
    cerrada?: string | null;
    dueño_proceso?: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface DeleteImprovementActionsControlParams {
  id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface ListImprovementActionsControlByCorpoParams {
  corpo_id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

export const createImprovementActionsControl = async ({
  requestData,
  refreshAccessToken,
  logout,
}: CreateImprovementActionsControlParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/improvement-actions-control`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return createImprovementActionsControl({ requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating improvement actions control:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al crear el control de acciones de mejora',
    };
  }
};

export const updateImprovementActionsControl = async ({
  id,
  requestData,
  refreshAccessToken,
  logout,
}: UpdateImprovementActionsControlParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/improvement-actions-control/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return updateImprovementActionsControl({ id, requestData, refreshAccessToken, logout });
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
    console.error('Error updating improvement actions control:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al actualizar el control de acciones de mejora',
    };
  }
};

export const deleteImprovementActionsControl = async ({
  id,
  refreshAccessToken,
  logout,
}: DeleteImprovementActionsControlParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/improvement-actions-control/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return deleteImprovementActionsControl({ id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error deleting improvement actions control:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al eliminar el control de acciones de mejora',
    };
  }
};

export const listImprovementActionsControlByCorpo = async ({
  corpo_id,
  refreshAccessToken,
  logout,
}: ListImprovementActionsControlByCorpoParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/improvement-actions-control/corpo/${corpo_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return listImprovementActionsControlByCorpo({ corpo_id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error listing improvement actions control:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al listar los controles de acciones de mejora',
      data: [],
    };
  }
};

interface CreateQualityPolicyParams {
  requestData: {
    marca_id: number;
    politica_contenido?: string | null;
    nombre_aprobado?: string | null;
    firma_aprobado?: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface UpdateQualityPolicyParams {
  id: string;
  requestData: {
    politica_contenido?: string | null;
    nombre_aprobado?: string | null;
    firma_aprobado?: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface DeleteQualityPolicyParams {
  id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface ListQualityPolicyByCorpoParams {
  corpo_id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

export const createQualityPolicy = async ({
  requestData,
  refreshAccessToken,
  logout,
}: CreateQualityPolicyParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/quality-policy`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return createQualityPolicy({ requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating quality policy:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al crear la política de calidad',
    };
  }
};

export const updateQualityPolicy = async ({
  id,
  requestData,
  refreshAccessToken,
  logout,
}: UpdateQualityPolicyParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/quality-policy/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return updateQualityPolicy({ id, requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating quality policy:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al actualizar la política de calidad',
    };
  }
};

export const deleteQualityPolicy = async ({
  id,
  refreshAccessToken,
  logout,
}: DeleteQualityPolicyParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/quality-policy/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return deleteQualityPolicy({ id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error deleting quality policy:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al eliminar la política de calidad',
    };
  }
};

export const listQualityPolicyByCorpo = async ({
  corpo_id,
  refreshAccessToken,
  logout,
}: ListQualityPolicyByCorpoParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/quality-policy/corpo/${corpo_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return listQualityPolicyByCorpo({ corpo_id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error listing quality policy:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al listar las políticas de calidad',
      data: [],
    };
  }
};

interface CreateBusinessQualityObjectivesParams {
  requestData: {
    marca_id: number;
    ambitos?: string | null;
    nombre_aprobado?: string | null;
    firma_aprobado?: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface UpdateBusinessQualityObjectivesParams {
  id: string;
  requestData: {
    ambitos?: string | null;
    nombre_aprobado?: string | null;
    firma_aprobado?: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface DeleteBusinessQualityObjectivesParams {
  id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface ListBusinessQualityObjectivesByCorpoParams {
  corpo_id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

export const createBusinessQualityObjectives = async ({
  requestData,
  refreshAccessToken,
  logout,
}: CreateBusinessQualityObjectivesParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/business-quality-objectives`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return createBusinessQualityObjectives({ requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating business quality objectives:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al crear los objetivos empresariales de calidad',
    };
  }
};

export const updateBusinessQualityObjectives = async ({
  id,
  requestData,
  refreshAccessToken,
  logout,
}: UpdateBusinessQualityObjectivesParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/business-quality-objectives/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return updateBusinessQualityObjectives({ id, requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating business quality objectives:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al actualizar los objetivos empresariales de calidad',
    };
  }
};

export const deleteBusinessQualityObjectives = async ({
  id,
  refreshAccessToken,
  logout,
}: DeleteBusinessQualityObjectivesParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/business-quality-objectives/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return deleteBusinessQualityObjectives({ id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error deleting business quality objectives:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al eliminar los objetivos empresariales de calidad',
    };
  }
};

export const listBusinessQualityObjectivesByCorpo = async ({
  corpo_id,
  refreshAccessToken,
  logout,
}: ListBusinessQualityObjectivesByCorpoParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/business-quality-objectives/corpo/${corpo_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return listBusinessQualityObjectivesByCorpo({ corpo_id, refreshAccessToken, logout });
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
    console.error('Error listing business quality objectives:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al listar los objetivos empresariales de calidad',
      data: [],
    };
  }
};

interface CreateStakeholderAnalysisMatrixParams {
  requestData: {
    marca_id: number;
    partes_interesadas?: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface UpdateStakeholderAnalysisMatrixParams {
  id: string;
  requestData: {
    partes_interesadas?: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface DeleteStakeholderAnalysisMatrixParams {
  id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface ListStakeholderAnalysisMatrixByCorpoParams {
  corpo_id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

export const createStakeholderAnalysisMatrix = async ({
  requestData,
  refreshAccessToken,
  logout,
}: CreateStakeholderAnalysisMatrixParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/stakeholder-analysis-matrix`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return createStakeholderAnalysisMatrix({ requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating stakeholder analysis matrix:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al crear la matriz de análisis de partes interesadas',
    };
  }
};

export const updateStakeholderAnalysisMatrix = async ({
  id,
  requestData,
  refreshAccessToken,
  logout,
}: UpdateStakeholderAnalysisMatrixParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/stakeholder-analysis-matrix/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return updateStakeholderAnalysisMatrix({ id, requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating stakeholder analysis matrix:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al actualizar la matriz de análisis de partes interesadas',
    };
  }
};

export const deleteStakeholderAnalysisMatrix = async ({
  id,
  refreshAccessToken,
  logout,
}: DeleteStakeholderAnalysisMatrixParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/stakeholder-analysis-matrix/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return deleteStakeholderAnalysisMatrix({ id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error deleting stakeholder analysis matrix:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al eliminar la matriz de análisis de partes interesadas',
    };
  }
};

export const listStakeholderAnalysisMatrixByCorpo = async ({
  corpo_id,
  refreshAccessToken,
  logout,
}: ListStakeholderAnalysisMatrixByCorpoParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/stakeholder-analysis-matrix/corpo/${corpo_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return listStakeholderAnalysisMatrixByCorpo({ corpo_id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error listing stakeholder analysis matrix:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al listar la matriz de análisis de partes interesadas',
      data: [],
    };
  }
};

interface CreateCommunicationPlanParams {
  requestData: {
    marca_id: number;
    comunicaciones?: string | null;
    responsable_aprobacion?: string | null;
    puesto_aprobacion?: string | null;
    fecha_aprobacion?: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface UpdateCommunicationPlanParams {
  id: string;
  requestData: {
    comunicaciones?: string | null;
    responsable_aprobacion?: string | null;
    puesto_aprobacion?: string | null;
    fecha_aprobacion?: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface DeleteCommunicationPlanParams {
  id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface ListCommunicationPlanByCorpoParams {
  corpo_id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

export const createCommunicationPlan = async ({
  requestData,
  refreshAccessToken,
  logout,
}: CreateCommunicationPlanParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/communication-plan`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return createCommunicationPlan({ requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating communication plan:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al crear el plan de comunicación',
    };
  }
};

export const updateCommunicationPlan = async ({
  id,
  requestData,
  refreshAccessToken,
  logout,
}: UpdateCommunicationPlanParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/communication-plan/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return updateCommunicationPlan({ id, requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating communication plan:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al actualizar el plan de comunicación',
    };
  }
};

export const deleteCommunicationPlan = async ({
  id,
  refreshAccessToken,
  logout,
}: DeleteCommunicationPlanParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/communication-plan/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return deleteCommunicationPlan({ id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error deleting communication plan:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al eliminar el plan de comunicación',
    };
  }
};

export const listCommunicationPlanByCorpo = async ({
  corpo_id,
  refreshAccessToken,
  logout,
}: ListCommunicationPlanByCorpoParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/communication-plan/corpo/${corpo_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return listCommunicationPlanByCorpo({ corpo_id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error listing communication plan:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al listar el plan de comunicación',
      data: [],
    };
  }
};

interface CreateKnowledgeManagementMatrixParams {
  requestData: {
    marca_id: number;
    registros?: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface UpdateKnowledgeManagementMatrixParams {
  id: string;
  requestData: {
    registros?: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface DeleteKnowledgeManagementMatrixParams {
  id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface ListKnowledgeManagementMatrixByCorpoParams {
  corpo_id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

export const createKnowledgeManagementMatrix = async ({
  requestData,
  refreshAccessToken,
  logout,
}: CreateKnowledgeManagementMatrixParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/knowledge-management-matrix`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return createKnowledgeManagementMatrix({ requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating knowledge management matrix:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al crear la matriz de gestión del conocimiento',
    };
  }
};

export const updateKnowledgeManagementMatrix = async ({
  id,
  requestData,
  refreshAccessToken,
  logout,
}: UpdateKnowledgeManagementMatrixParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/knowledge-management-matrix/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return updateKnowledgeManagementMatrix({ id, requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating knowledge management matrix:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al actualizar la matriz de gestión del conocimiento',
    };
  }
};

export const deleteKnowledgeManagementMatrix = async ({
  id,
  refreshAccessToken,
  logout,
}: DeleteKnowledgeManagementMatrixParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/knowledge-management-matrix/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return deleteKnowledgeManagementMatrix({ id, refreshAccessToken, logout });
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
    console.error('Error deleting knowledge management matrix:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al eliminar la matriz de gestión del conocimiento',
    };
  }
};

export const listKnowledgeManagementMatrixByCorpo = async ({
  corpo_id,
  refreshAccessToken,
  logout,
}: ListKnowledgeManagementMatrixByCorpoParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/knowledge-management-matrix/corpo/${corpo_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return listKnowledgeManagementMatrixByCorpo({ corpo_id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error listing knowledge management matrix:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al listar la matriz de gestión del conocimiento',
      data: [],
    };
  }
};

interface CreateChangePlanningParams {
  requestData: {
    marca_id: number;
    datos_cambio?: string | null;
    actividades?: string | null;
    aprobado_por?: string | null;
    firma_representante?: string | null;
    fecha_aprobacion?: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface UpdateChangePlanningParams {
  id: string;
  requestData: {
    datos_cambio?: string | null;
    actividades?: string | null;
    aprobado_por?: string | null;
    firma_representante?: string | null;
    fecha_aprobacion?: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface DeleteChangePlanningParams {
  id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface ListChangePlanningByCorpoParams {
  corpo_id: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

export const createChangePlanning = async ({
  requestData,
  refreshAccessToken,
  logout,
}: CreateChangePlanningParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/change-planning`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return createChangePlanning({ requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating change planning:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al crear la planificación de cambios del SGC',
    };
  }
};

export const updateChangePlanning = async ({
  id,
  requestData,
  refreshAccessToken,
  logout,
}: UpdateChangePlanningParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/change-planning/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
      body: JSON.stringify(requestData),
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return updateChangePlanning({ id, requestData, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating change planning:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al actualizar la planificación de cambios del SGC',
    };
  }
};

export const deleteChangePlanning = async ({
  id,
  refreshAccessToken,
  logout,
}: DeleteChangePlanningParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/change-planning/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return deleteChangePlanning({ id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error deleting change planning:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al eliminar la planificación de cambios del SGC',
    };
  }
};

export const listChangePlanningByCorpo = async ({
  corpo_id,
  refreshAccessToken,
  logout,
}: ListChangePlanningByCorpoParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (logout) await logout();
        throw new Error('Sesión expirada');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    const response = await fetch(`${apiUrl}/api/change-planning/corpo/${corpo_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return listChangePlanningByCorpo({ corpo_id, refreshAccessToken, logout });
      } else {
        await logout();
        throw new Error('Sesión expirada');
      }
    }

    if (response.status === 403) {
      await logout();
      throw new Error('Acceso denegado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error listing change planning:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Error al listar la planificación de cambios del SGC',
      data: [],
    };
  }
};

