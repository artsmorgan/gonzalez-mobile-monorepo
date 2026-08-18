import Constants from 'expo-constants';
import authedFetch from './authedFetch';
import { hydrateChecklistEvaluationImagesForApi } from './checklistSupervisionEvaluationFiles';
import { hydrateArticulosPuestoFilesForApi } from '@/utils/articuloMantenimientoFiles';

async function requestDataWithHydratedEvaluacion(requestData: any): Promise<any> {
  const rd = { ...requestData };
  const raw = rd?.evaluacion;
  const evStr = typeof raw === 'string' ? raw : JSON.stringify(raw ?? []);
  rd.evaluacion = await hydrateChecklistEvaluationImagesForApi(evStr);
  const apRaw = rd?.articulos_puesto;
  const apStr = typeof apRaw === 'string' ? apRaw : JSON.stringify(apRaw ?? '[]');
  rd.articulos_puesto = await hydrateArticulosPuestoFilesForApi(apStr);
  return rd;
}

type BasicResponse = { status: boolean; message?: string;[k: string]: any };

export type ChecklistSupervisionImageMeta = {
  id: number;
  name: string;
  original_name: string;
  url: string;
};

export type ChecklistSupervisionItem = {
  id: number;
  empresa_id: number;
  cliente_id: number;
  division_id: number;
  contrato_id: number;
  corpo_id: number;
  puesto_id: number;
  /** Inactivo: no debe mostrarse ni devolverse en listados normales. */
  isActive?: boolean;
  fecha: string;
  ejecutivo_cuenta: string;
  evaluacion: string;
  articulos_puesto?: string | null;
  firma_supervisor: string;
  firma_responsable: string;
  created_by: number;
  created_at: string;
  empleado_id?: number | null;
  empleado_nombre?: string | null;
  empleado_codigo?: string | null;
  hora_inicio?: string | null;
  hora_fin?: string | null;
  id_local?: string;
  images?: ChecklistSupervisionImageMeta[];
  cliente?: { id: number; nombre: string };
  corpo?: { id: number; nombre: string };
  puesto?: { id: number; nombre: string; codigo: string };
};

export type ListChecklistSupervisionResponse = {
  status: boolean;
  data?: ChecklistSupervisionItem[];
  message?: string;
};

type ListParams = {
  clienteId?: number;
  corpoId?: number;
  puestoId?: number;
  refreshAccessToken?: () => Promise<boolean>;
  logout?: () => Promise<any>;
};

type CreateParams = {
  requestData: any;
  planillasToken?: string | null;
  refreshAccessToken?: () => Promise<boolean>;
  logout?: () => Promise<any>;
};

type UpdateParams = {
  id: number;
  requestData: any;
  planillasToken?: string | null;
  refreshAccessToken?: () => Promise<boolean>;
  logout?: () => Promise<any>;
};

type DeleteParams = {
  id: number;
  refreshAccessToken?: () => Promise<boolean>;
  logout?: () => Promise<any>;
};

type PatchFirmaSupervisorParams = {
  id: number;
  firma_supervisor: string;
  refreshAccessToken?: () => Promise<boolean>;
  logout?: () => Promise<any>;
};

const getApiUrl = () => {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) throw new Error('Server URL not configured');
  return apiUrl;
};

const requireAuthHandlers = (refreshAccessToken?: () => Promise<boolean>, logout?: () => Promise<any>) => {
  if (!refreshAccessToken || !logout) {
    throw new Error('Auth handlers not provided');
  }
  return {
    refreshAccessToken,
    logout,
  } as {
    refreshAccessToken: () => Promise<boolean>;
    logout: () => Promise<any>;
  };
};

export async function listChecklistSupervision({
  clienteId,
  corpoId,
  puestoId,
  refreshAccessToken,
  logout,
}: ListParams): Promise<ListChecklistSupervisionResponse> {
  try {
    const apiUrl = getApiUrl();
    const { refreshAccessToken: refresh, logout: doLogout } = requireAuthHandlers(refreshAccessToken, logout);

    const params = new URLSearchParams();
    if (clienteId) params.append('cliente_id', String(clienteId));
    if (corpoId) params.append('corpo_id', String(corpoId));
    if (puestoId) params.append('puesto_id', String(puestoId));

    const response = await authedFetch({
      url: `${apiUrl}/api/checklist-supervision?${params.toString()}`,
      init: {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      refreshAccessToken: refresh,
      logout: doLogout,
    });

    if (!response) return { status: false, message: 'Sesión expirada' };

    const data = await response.json();
    if (data?.status && Array.isArray(data.data)) {
      data.data = data.data.filter((row: any) => row?.isActive !== false);
    }
    return data;
  } catch (error: any) {
    console.error('Error listing checklist supervision:', error);
    return { status: false, message: error.message || 'Error al cargar checklist de supervisión' };
  }
}

export type CreateChecklistSupervisionResponse = BasicResponse & {
  id?: number;
  data?: ChecklistSupervisionItem & { id?: number };
};

const buildChecklistHeaders = (planillasToken?: string | null): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = String(planillasToken ?? '').trim();
  if (token) {
    headers['Planillas-Token'] = encodeURIComponent(token);
  }
  return headers;
};

const resolvePlanillasTokenFromParams = (
  planillasToken?: string | null,
  requestData?: any,
): string | undefined => {
  const direct = String(planillasToken ?? '').trim();
  if (direct) return direct;
  const fromRequest = String(requestData?.planillasToken ?? '').trim();
  return fromRequest || undefined;
};

export async function createChecklistSupervision({
  requestData,
  planillasToken,
  refreshAccessToken,
  logout,
}: CreateParams): Promise<CreateChecklistSupervisionResponse> {
  try {
    const apiUrl = getApiUrl();
    const { refreshAccessToken: refresh, logout: doLogout } = requireAuthHandlers(refreshAccessToken, logout);
    const payload = await requestDataWithHydratedEvaluacion(requestData);
    const resolvedPlanillasToken = resolvePlanillasTokenFromParams(planillasToken, requestData);

    const response = await authedFetch({
      url: `${apiUrl}/api/checklist-supervision`,
      init: {
        method: 'POST',
        headers: buildChecklistHeaders(resolvedPlanillasToken),
        body: JSON.stringify(payload),
      },
      refreshAccessToken: refresh,
      logout: doLogout,
    });

    if (!response) return { status: false, message: 'Sesión expirada' };

    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `HTTP error! status: ${response.status}`);
    const serverId = Number(data?.id ?? data?.data?.id ?? 0);
    return {
      ...data,
      ...(Number.isFinite(serverId) && serverId > 0 ? { id: serverId, data: { ...(data.data || {}), id: serverId } } : {}),
    };
  } catch (error: any) {
    console.error('Error creating checklist supervision:', error);
    return { status: false, message: error.message || 'Error al crear checklist de supervisión' };
  }
}

/**
 * Actualiza solo la firma del supervisor (evita enviar `evaluacion` y reprocesar imágenes).
 */
export async function updateChecklistSupervisionFirmaSupervisor({
  id,
  firma_supervisor,
  refreshAccessToken,
  logout,
}: PatchFirmaSupervisorParams): Promise<BasicResponse & { data?: ChecklistSupervisionItem }> {
  try {
    const apiUrl = getApiUrl();
    const { refreshAccessToken: refresh, logout: doLogout } = requireAuthHandlers(refreshAccessToken, logout);

    const response = await authedFetch({
      url: `${apiUrl}/api/checklist-supervision/${id}`,
      init: {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ firma_supervisor }),
      },
      refreshAccessToken: refresh,
      logout: doLogout,
    });

    if (!response) return { status: false, message: 'Sesión expirada' };

    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `HTTP error! status: ${response.status}`);
    return data;
  } catch (error: any) {
    console.error('Error updating checklist supervisor signature:', error);
    return { status: false, message: error.message || 'Error al actualizar firma del supervisor' };
  }
}

export async function updateChecklistSupervision({
  id,
  requestData,
  planillasToken,
  refreshAccessToken,
  logout,
}: UpdateParams): Promise<BasicResponse> {
  try {
    const apiUrl = getApiUrl();
    const { refreshAccessToken: refresh, logout: doLogout } = requireAuthHandlers(refreshAccessToken, logout);
    const payload = await requestDataWithHydratedEvaluacion(requestData);
    const resolvedPlanillasToken = resolvePlanillasTokenFromParams(planillasToken, requestData);

    const response = await authedFetch({
      url: `${apiUrl}/api/checklist-supervision/${id}`,
      init: {
        method: 'PUT',
        headers: buildChecklistHeaders(resolvedPlanillasToken),
        body: JSON.stringify(payload),
      },
      refreshAccessToken: refresh,
      logout: doLogout,
    });

    if (!response) return { status: false, message: 'Sesión expirada' };

    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `HTTP error! status: ${response.status}`);
    return data;
  } catch (error: any) {
    console.error('Error updating checklist supervision:', error);
    return { status: false, message: error.message || 'Error al actualizar checklist de supervisión' };
  }
}

export async function deleteChecklistSupervision({
  id,
  refreshAccessToken,
  logout,
}: DeleteParams): Promise<BasicResponse> {
  try {
    const apiUrl = getApiUrl();
    const { refreshAccessToken: refresh, logout: doLogout } = requireAuthHandlers(refreshAccessToken, logout);

    const response = await authedFetch({
      url: `${apiUrl}/api/checklist-supervision/${id}`,
      init: {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      refreshAccessToken: refresh,
      logout: doLogout,
    });

    if (!response) return { status: false, message: 'Sesión expirada' };

    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `HTTP error! status: ${response.status}`);
    return data;
  } catch (error: any) {
    console.error('Error deleting checklist supervision:', error);
    return { status: false, message: error.message || 'Error al eliminar checklist de supervisión' };
  }
}

