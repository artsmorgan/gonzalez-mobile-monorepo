import Constants from 'expo-constants';
import authedFetch from './authedFetch';

type CreateJobManualParams = {
  requestData: any;
  marcaId: number;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
};

type ListJobManualsParams = {
  puestoId: number;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
};

type ListJobManualsByEmpleadoParams = {
  empleadoId: number;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
};

type UpdateJobManualVisualizacionFieldParams = {
  id: number;
  marcaId: number;
  field: string;
  value: string | null;
  firmaEmpleado?: string | null;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
};

type DeleteJobManualParams = {
  id: number;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
};

type SignJobManualParams = {
  id: number;
  firma: string;
  quizAnswear?: string | null;
  files?: string | null;
  /** Fusiona `firma_empleado_manual` en la misma petición (p. ej. una `visualizacion_field_update` pendiente). */
  firmaEmpleadoManual?: string | null;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
  marcaId: number;
};

type PutQuizResultParams = {
  id: number; // manual id
  marcaId: number;
  empleadoId: number;
  approved: boolean;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
};

export const createJobManual = async ({
  requestData,
  marcaId,
  refreshAccessToken,
  logout,
}: CreateJobManualParams): Promise<any> => {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) {
    throw new Error('Server URL not configured');
  }

  const response = await authedFetch({
    url: `${apiUrl}/api/job-manuals`,
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...requestData,
        marca_id: marcaId,
      }),
    },
    refreshAccessToken,
    logout,
  });

  if (!response) {
    return { status: false, message: 'Sesión expirada' };
  }

  const data = await response.json();
  return data;
};

export const listJobManualsByPuesto = async ({
  puestoId,
  refreshAccessToken,
  logout,
}: ListJobManualsParams): Promise<any> => {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) {
    throw new Error('Server URL not configured');
  }

  const pid = Number(puestoId);
  if (!Number.isFinite(pid) || pid <= 0) {
    return { status: false, message: 'puesto_id inválido', manuals: [] };
  }

  const response = await authedFetch({
    url: `${apiUrl}/api/job-manuals?puesto_id=${pid}`,
    init: {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    },
    refreshAccessToken,
    logout,
  });

  if (!response) {
    return { status: false, message: 'Sesión expirada' };
  }

  const data = await response.json();
  if (data?.status && Array.isArray(data.manuals)) {
    return {
      ...data,
      manuals: data.manuals.filter((m: { isActive?: boolean }) => m?.isActive !== false),
    };
  }
  return data;
};

export const listJobManualsByEmpleado = async ({
  empleadoId,
  refreshAccessToken,
  logout,
}: ListJobManualsByEmpleadoParams): Promise<any> => {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) {
    throw new Error('Server URL not configured');
  }

  const eid = Number(empleadoId);
  if (!Number.isFinite(eid) || eid <= 0) {
    return { status: false, message: 'empleado_id inválido', manuals: [] };
  }

  const response = await authedFetch({
    url: `${apiUrl}/api/job-manuals?empleado_id=${eid}`,
    init: {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    },
    refreshAccessToken,
    logout,
  });

  if (!response) {
    return { status: false, message: 'Sesión expirada' };
  }

  const data = await response.json();
  if (data?.status && Array.isArray(data.manuals)) {
    return {
      ...data,
      manuals: data.manuals.filter((m: { isActive?: boolean }) => m?.isActive !== false),
    };
  }
  return data;
};

export const deleteJobManual = async ({
  id,
  refreshAccessToken,
  logout,
}: DeleteJobManualParams): Promise<any> => {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) {
    throw new Error('Server URL not configured');
  }

  const response = await authedFetch({
    url: `${apiUrl}/api/job-manuals/${id}`,
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
    return { status: false, message: 'Sesión expirada' };
  }

  const data = await response.json();
  return data;
};

export const signJobManual = async ({
  id,
  firma,
  quizAnswear,
  files,
  firmaEmpleadoManual,
  refreshAccessToken,
  logout,
  marcaId,
}: SignJobManualParams): Promise<any> => {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) {
    throw new Error('Server URL not configured');
  }

  const response = await authedFetch({
    url: `${apiUrl}/api/job-manuals/${id}/sign`,
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        firma_empleado: firma,
        marca_id: marcaId,
        quiz_answear: quizAnswear ?? null,
        files: files ?? null,
        ...(firmaEmpleadoManual !== undefined ? { firma_empleado_manual: firmaEmpleadoManual } : {}),
      }),
    },
    refreshAccessToken,
    logout,
  });

  if (!response) {
    return { status: false, message: 'Sesión expirada' };
  }

  const data = await response.json();
  return data;
};

export const appendJobManualPuestos = async ({
  manualId,
  marcaId,
  puestosIds,
  refreshAccessToken,
  logout,
}: {
  manualId: number;
  marcaId: number;
  puestosIds: number[];
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}): Promise<any> => {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) {
    throw new Error('Server URL not configured');
  }

  const response = await authedFetch({
    url: `${apiUrl}/api/job-manuals/${manualId}/puestos`,
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ marca_id: marcaId, puestos_ids: puestosIds }),
    },
    refreshAccessToken,
    logout,
  });

  if (!response) {
    return { status: false, message: 'Sesión expirada' };
  }

  return await response.json();
};

export const appendJobManualEmpleados = async ({
  manualId,
  marcaId,
  empleadosIds,
  refreshAccessToken,
  logout,
}: {
  manualId: number;
  marcaId: number;
  empleadosIds: number[];
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}): Promise<any> => {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) {
    throw new Error('Server URL not configured');
  }

  const response = await authedFetch({
    url: `${apiUrl}/api/job-manuals/${manualId}/empleados`,
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ marca_id: marcaId, empleados_ids: empleadosIds }),
    },
    refreshAccessToken,
    logout,
  });

  if (!response) {
    return { status: false, message: 'Sesión expirada' };
  }

  return await response.json();
};

export const updateJobManualVisualizacionField = async ({
  id,
  marcaId,
  field,
  value,
  firmaEmpleado,
  refreshAccessToken,
  logout,
}: UpdateJobManualVisualizacionFieldParams): Promise<any> => {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) {
    throw new Error('Server URL not configured');
  }

  const response = await authedFetch({
    url: `${apiUrl}/api/job-manuals/${id}/visualizacion`,
    init: {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        marca_id: marcaId,
        field,
        value: value ?? '',
        ...(firmaEmpleado ? { firma_empleado: firmaEmpleado } : {}),
      }),
    },
    refreshAccessToken,
    logout,
  });

  if (!response) {
    return { status: false, message: 'Sesión expirada' };
  }

  const data = await response.json();
  return data;
};

export const putJobManualQuizResult = async ({
  id,
  marcaId,
  empleadoId,
  approved,
  refreshAccessToken,
  logout,
}: PutQuizResultParams): Promise<any> => {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) {
    throw new Error('Server URL not configured');
  }

  const response = await authedFetch({
    url: `${apiUrl}/api/job-manuals/${id}/quiz-result`,
    init: {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ empleado_id: empleadoId, approved, marca_id: marcaId }),
    },
    refreshAccessToken,
    logout,
  });

  if (!response) {
    return { status: false, message: 'Sesión expirada' };
  }

  const data = await response.json();
  return data;
};


