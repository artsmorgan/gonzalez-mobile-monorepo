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
      body: JSON.stringify({ firma_empleado: firma, marca_id: marcaId, quiz_answear: quizAnswear ?? null, files: files ?? null }),
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


