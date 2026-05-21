import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import authedFetch from './authedFetch';
import { getFile } from './fileStorage';

/** Convierte `file_local_file_name` en `file` (data URL) antes del PUT; idempotente si ya viene `file`. */
async function hydrateMarkRequestFileField(requestData: any): Promise<any> {
  const rd = { ...requestData };
  const fn = rd?.file_local_file_name;
  if (typeof fn === 'string' && fn.trim()) {
    try {
      const { base64 } = await getFile(fn.trim());
      rd.file = `data:image/jpeg;base64,${base64}`;
    } catch (e) {
      console.warn('[activitiesFunctions] getFile failed for file_local_file_name:', fn, e);
      if (rd.file === undefined) rd.file = null;
    }
    delete rd.file_local_file_name;
  }
  return rd;
}

interface UpdateActivityParams {
  /** Incluye `file_local_file_name` (disco) o `file` (data URL) para marcado con imagen. */
  requestData: any;
  activityId: number;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface CreateActivityParams {
  requestData: any;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface UpdateRevisionEquipoParams {
  /** Incluye `file_local_file_name` o `file` para imagen de artículo. */
  requestData: any;
  revisionEquipoId: number;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}

interface ApiResponse {
  status: boolean;
  message: string;
}

export const listCreatedActivitiesByPuesto = async ({
  puestoId,
  refreshAccessToken,
  logout,
}: {
  puestoId: number;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}): Promise<{ status: boolean; message?: string; actividades?: any[] }> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');

    const response = await authedFetch({
      url: `${apiUrl}/api/activities/created/puesto/${puestoId}`,
      init: { method: 'GET' },
      refreshAccessToken,
      logout,
    });
    if (!response) throw new Error('Sesión expirada');
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error listing created activities by puesto:', error);
    return { status: false, message: 'Error al listar actividades creadas' };
  }
};

export const appendCreatedActivityPuestos = async ({
  activityId,
  marcaId,
  puestosIds,
  refreshAccessToken,
  logout,
}: {
  activityId: number;
  marcaId: number;
  puestosIds: number[];
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}): Promise<ApiResponse & { created_count?: number; skipped_already_linked?: number }> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');
    const response = await authedFetch({
      url: `${apiUrl}/api/activities/created/${activityId}/puestos`,
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marca_id: marcaId, puestos_ids: puestosIds }),
      },
      refreshAccessToken,
      logout,
    });
    if (!response) throw new Error('Sesión expirada');
    return await response.json();
  } catch (error) {
    console.error('Error appendCreatedActivityPuestos:', error);
    return { status: false, message: 'Error al actualizar puestos de la actividad' };
  }
};

export const updateCreatedActivity = async ({
  activityId,
  requestData,
  refreshAccessToken,
  logout,
}: {
  activityId: number;
  requestData: any;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');
    const response = await authedFetch({
      url: `${apiUrl}/api/activities/created/${activityId}`,
      init: {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      },
      refreshAccessToken,
      logout,
    });
    if (!response) throw new Error('Sesión expirada');
    return await response.json();
  } catch (error) {
    console.error('Error updating created activity:', error);
    return { status: false, message: 'Error al actualizar actividad' };
  }
};

export const duplicateCreatedActivity = async ({
  activityId,
  refreshAccessToken,
  logout,
}: {
  activityId: number;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}): Promise<ApiResponse & { actividad?: any; actividad_id?: number; puestos_duplicados?: number }> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');
    const response = await authedFetch({
      url: `${apiUrl}/api/activities/created/${activityId}/duplicate`,
      init: { method: 'POST' },
      refreshAccessToken,
      logout,
    });
    if (!response) throw new Error('Sesión expirada');
    return await response.json();
  } catch (error) {
    console.error('Error duplicating created activity:', error);
    return { status: false, message: 'Error al duplicar actividad' };
  }
};

export const unlinkCreatedActivityPuesto = async ({
  activityId,
  puestoId,
  refreshAccessToken,
  logout,
}: {
  activityId: number;
  puestoId: number;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}): Promise<ApiResponse & { actividad_id?: number; puesto_id?: number }> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');
    const response = await authedFetch({
      url: `${apiUrl}/api/activities/created/${activityId}/puestos/${puestoId}`,
      init: { method: 'DELETE' },
      refreshAccessToken,
      logout,
    });
    if (!response) throw new Error('Sesión expirada');
    return await response.json();
  } catch (error) {
    console.error('Error unlinking created activity puesto:', error);
    return { status: false, message: 'Error al desvincular puesto' };
  }
};

export const deleteCreatedActivity = async ({
  activityId,
  refreshAccessToken,
  logout,
}: {
  activityId: number;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');
    const response = await authedFetch({
      url: `${apiUrl}/api/activities/created/${activityId}`,
      init: { method: 'DELETE' },
      refreshAccessToken,
      logout,
    });
    if (!response) throw new Error('Sesión expirada');
    return await response.json();
  } catch (error) {
    console.error('Error deleting created activity:', error);
    return { status: false, message: 'Error al eliminar actividad' };
  }
};

export const createActivity = async ({
  requestData,
  refreshAccessToken,
  logout,
}: CreateActivityParams): Promise<ApiResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    const response = await authedFetch({
      url: `${apiUrl}/api/activities`,
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
    console.error('Error creating activity:', error);
    return {
      status: false,
      message: 'Error al crear la actividad',
    };
  }
};

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

    const payload = await hydrateMarkRequestFileField(requestData);

    const response = await authedFetch({
      url: `${apiUrl}/api/activities/${activityId}`,
      init: {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
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

    const payload = await hydrateMarkRequestFileField(requestData);

    const response = await authedFetch({
      url: `${apiUrl}/api/activities/equipo/${revisionEquipoId}`,
      init: {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
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
    console.error('Error updating revision equipo:', error);
    return {
      status: false,
      message: 'Error al actualizar la revisión del equipo',
    };
  }
};

