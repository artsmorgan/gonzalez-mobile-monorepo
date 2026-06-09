import Constants from 'expo-constants';
import authedFetch from './authedFetch';

export type EmpleadoLite = {
  id: number;
  codigo: string;
  nombre: string | null;
  primer_apellido: string | null;
  segundo_apellido: string | null;
};

export type StructureLite = {
  id: number;
  nombre: string;
  codigo?: string | null;
  numero?: string | null;
};

export type CedulaAlmuerzoLite = {
  cedula: string;
  empleado_nombre: string;
};

export function formatEmpleadoNombre(e: EmpleadoLite): string {
  return [e.nombre, e.primer_apellido, e.segundo_apellido].filter(Boolean).join(' ').trim() || String(e.codigo);
}

export async function searchEmployeesReportes(params: {
  q: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}): Promise<{ status: boolean; data?: EmpleadoLite[]; message?: string }> {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) return { status: false, message: 'Server URL not configured' };
  const res = await authedFetch({
    url: `${apiUrl}/api/reportes`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation: 'searchEmployees', q: params.q }),
    },
    refreshAccessToken: params.refreshAccessToken,
    logout: params.logout,
  });
  if (!res) return { status: false, message: 'Sesión expirada' };
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.status) return { status: false, message: j.message || `HTTP ${res.status}` };
  return { status: true, data: j.data };
}

export async function fetchReportesList(params: {
  query: Record<string, string | undefined>;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}): Promise<{ status: boolean; data?: any[]; message?: string }> {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) return { status: false, message: 'Server URL not configured' };
  const sp = new URLSearchParams();
  Object.entries(params.query).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v).trim() !== '') sp.set(k, String(v));
  });
  const res = await authedFetch({
    url: `${apiUrl}/api/reportes?${sp.toString()}`,
    init: { method: 'GET' },
    refreshAccessToken: params.refreshAccessToken,
    logout: params.logout,
  });
  if (!res) return { status: false, message: 'Sesión expirada' };
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.status) return { status: false, message: j.message || `HTTP ${res.status}` };
  return { status: true, data: j.data };
}

export async function previewUserLoginRefreshTokens(params: {
  moduleFilters: Record<string, unknown>;
  order_by: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}): Promise<{ status: boolean; data?: any[]; count?: number; message?: string }> {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) return { status: false, message: 'Server URL not configured' };
  const res = await authedFetch({
    url: `${apiUrl}/api/reportes`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'previewUserLoginRefreshTokens',
        moduleFilters: params.moduleFilters,
        order_by: params.order_by,
      }),
    },
    refreshAccessToken: params.refreshAccessToken,
    logout: params.logout,
  });
  if (!res) return { status: false, message: 'Sesión expirada' };
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.status) return { status: false, message: j.message || `HTTP ${res.status}` };
  return { status: true, data: j.data, count: j.count };
}

export async function searchActaStructure(params: {
  entity: 'empresa' | 'cliente' | 'division' | 'contrato' | 'corpo' | 'puesto' | 'plaza' | 'llavero' | 'ejecutivo';
  q: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}): Promise<{ status: boolean; data?: StructureLite[]; message?: string }> {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) return { status: false, message: 'Server URL not configured' };
  const res = await authedFetch({
    url: `${apiUrl}/api/reportes`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'searchActaStructure',
        entity: params.entity,
        q: params.q,
      }),
    },
    refreshAccessToken: params.refreshAccessToken,
    logout: params.logout,
  });
  if (!res) return { status: false, message: 'Sesión expirada' };
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.status) return { status: false, message: j.message || `HTTP ${res.status}` };
  return { status: true, data: j.data };
}

export type VehiculoCorporativoLite = {
  id: number;
  placa?: string | null;
  marca?: string | null;
  modelo?: string | null;
  tipo?: string | null;
  sucursal_id?: number | null;
  corpo_nombre?: string | null;
};

export async function searchCorporateVehicles(params: {
  q: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}): Promise<{ status: boolean; data?: VehiculoCorporativoLite[]; message?: string }> {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) return { status: false, message: 'Server URL not configured' };
  const res = await authedFetch({
    url: `${apiUrl}/api/reportes`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'searchCorporateVehicles',
        q: params.q,
      }),
    },
    refreshAccessToken: params.refreshAccessToken,
    logout: params.logout,
  });
  if (!res) return { status: false, message: 'Sesión expirada' };
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.status) return { status: false, message: j.message || `HTTP ${res.status}` };
  return { status: true, data: j.data };
}

export async function previewRevisionVehiculos(params: {
  moduleFilters: Record<string, unknown>;
  order_by: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}): Promise<{ status: boolean; data?: any[]; count?: number; message?: string }> {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) return { status: false, message: 'Server URL not configured' };
  const res = await authedFetch({
    url: `${apiUrl}/api/reportes`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'previewRevisionVehiculos',
        moduleFilters: params.moduleFilters,
        order_by: params.order_by,
      }),
    },
    refreshAccessToken: params.refreshAccessToken,
    logout: params.logout,
  });
  if (!res) return { status: false, message: 'Sesión expirada' };
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.status) return { status: false, message: j.message || `HTTP ${res.status}` };
  return { status: true, data: j.data, count: j.count };
}

export async function previewAgendaMinuta(params: {
  moduleFilters: Record<string, unknown>;
  order_by: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}): Promise<{ status: boolean; data?: any[]; count?: number; message?: string }> {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) return { status: false, message: 'Server URL not configured' };
  const res = await authedFetch({
    url: `${apiUrl}/api/reportes`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'previewAgendaMinuta',
        moduleFilters: params.moduleFilters,
        order_by: params.order_by,
      }),
    },
    refreshAccessToken: params.refreshAccessToken,
    logout: params.logout,
  });
  if (!res) return { status: false, message: 'Sesión expirada' };
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.status) return { status: false, message: j.message || `HTTP ${res.status}` };
  return { status: true, data: j.data, count: j.count };
}

export async function previewAperturaCierrePuesto(params: {
  moduleFilters: Record<string, unknown>;
  order_by: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}): Promise<{ status: boolean; data?: any[]; count?: number; message?: string }> {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) return { status: false, message: 'Server URL not configured' };
  const res = await authedFetch({
    url: `${apiUrl}/api/reportes`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'previewAperturaCierrePuesto',
        moduleFilters: params.moduleFilters,
        order_by: params.order_by,
      }),
    },
    refreshAccessToken: params.refreshAccessToken,
    logout: params.logout,
  });
  if (!res) return { status: false, message: 'Sesión expirada' };
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.status) return { status: false, message: j.message || `HTTP ${res.status}` };
  return { status: true, data: j.data, count: j.count };
}

export async function previewVulnerabilidad(params: {
  moduleFilters: Record<string, unknown>;
  order_by: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}): Promise<{ status: boolean; data?: any[]; count?: number; message?: string }> {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) return { status: false, message: 'Server URL not configured' };
  const res = await authedFetch({
    url: `${apiUrl}/api/reportes`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'previewVulnerabilidad',
        moduleFilters: params.moduleFilters,
        order_by: params.order_by,
      }),
    },
    refreshAccessToken: params.refreshAccessToken,
    logout: params.logout,
  });
  if (!res) return { status: false, message: 'Sesión expirada' };
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.status) return { status: false, message: j.message || `HTTP ${res.status}` };
  return { status: true, data: j.data, count: j.count };
}

export async function previewActividades(params: {
  moduleFilters: Record<string, unknown>;
  order_by: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}): Promise<{ status: boolean; data?: any[]; count?: number; message?: string }> {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) return { status: false, message: 'Server URL not configured' };
  const res = await authedFetch({
    url: `${apiUrl}/api/reportes`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'previewActividades',
        moduleFilters: params.moduleFilters,
        order_by: params.order_by,
      }),
    },
    refreshAccessToken: params.refreshAccessToken,
    logout: params.logout,
  });
  if (!res) return { status: false, message: 'Sesión expirada' };
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.status) return { status: false, message: j.message || `HTTP ${res.status}` };
  return { status: true, data: j.data, count: j.count };
}

export async function previewControlAsistencia(params: {
  moduleFilters: Record<string, unknown>;
  order_by: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}): Promise<{ status: boolean; data?: any[]; count?: number; message?: string }> {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) return { status: false, message: 'Server URL not configured' };
  const res = await authedFetch({
    url: `${apiUrl}/api/reportes`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'previewControlAsistencia',
        moduleFilters: params.moduleFilters,
        order_by: params.order_by,
      }),
    },
    refreshAccessToken: params.refreshAccessToken,
    logout: params.logout,
  });
  if (!res) return { status: false, message: 'Sesión expirada' };
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.status) return { status: false, message: j.message || `HTTP ${res.status}` };
  return { status: true, data: j.data, count: j.count };
}

export async function previewDocumentosEntregados(params: {
  moduleFilters: Record<string, unknown>;
  order_by: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}): Promise<{ status: boolean; data?: any[]; count?: number; message?: string }> {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) return { status: false, message: 'Server URL not configured' };
  const res = await authedFetch({
    url: `${apiUrl}/api/reportes`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'previewDocumentosEntregados',
        moduleFilters: params.moduleFilters,
        order_by: params.order_by,
      }),
    },
    refreshAccessToken: params.refreshAccessToken,
    logout: params.logout,
  });
  if (!res) return { status: false, message: 'Sesión expirada' };
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.status) return { status: false, message: j.message || `HTTP ${res.status}` };
  return { status: true, data: j.data, count: j.count };
}

export async function previewEncuestaSatisfaccion(params: {
  moduleFilters: Record<string, unknown>;
  order_by: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}): Promise<{ status: boolean; data?: any[]; count?: number; message?: string }> {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) return { status: false, message: 'Server URL not configured' };
  const res = await authedFetch({
    url: `${apiUrl}/api/reportes`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'previewEncuestaSatisfaccion',
        moduleFilters: params.moduleFilters,
        order_by: params.order_by,
      }),
    },
    refreshAccessToken: params.refreshAccessToken,
    logout: params.logout,
  });
  if (!res) return { status: false, message: 'Sesión expirada' };
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.status) return { status: false, message: j.message || `HTTP ${res.status}` };
  return { status: true, data: j.data, count: j.count };
}

export async function previewRegistroVisitas(params: {
  moduleFilters: Record<string, unknown>;
  order_by: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}): Promise<{ status: boolean; data?: any[]; count?: number; message?: string }> {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) return { status: false, message: 'Server URL not configured' };
  const res = await authedFetch({
    url: `${apiUrl}/api/reportes`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'previewRegistroVisitas',
        moduleFilters: params.moduleFilters,
        order_by: params.order_by,
      }),
    },
    refreshAccessToken: params.refreshAccessToken,
    logout: params.logout,
  });
  if (!res) return { status: false, message: 'Sesión expirada' };
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.status) return { status: false, message: j.message || `HTTP ${res.status}` };
  return { status: true, data: j.data, count: j.count };
}

export async function previewVisitasVehiculos(params: {
  moduleFilters: Record<string, unknown>;
  order_by: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}): Promise<{ status: boolean; data?: any[]; count?: number; message?: string }> {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) return { status: false, message: 'Server URL not configured' };
  const res = await authedFetch({
    url: `${apiUrl}/api/reportes`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'previewVisitasVehiculos',
        moduleFilters: params.moduleFilters,
        order_by: params.order_by,
      }),
    },
    refreshAccessToken: params.refreshAccessToken,
    logout: params.logout,
  });
  if (!res) return { status: false, message: 'Sesión expirada' };
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.status) return { status: false, message: j.message || `HTTP ${res.status}` };
  return { status: true, data: j.data, count: j.count };
}

export async function previewMutuosAcuerdos(params: {
  moduleFilters: Record<string, unknown>;
  order_by: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}): Promise<{ status: boolean; data?: any[]; count?: number; message?: string }> {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) return { status: false, message: 'Server URL not configured' };
  const res = await authedFetch({
    url: `${apiUrl}/api/reportes`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'previewMutuosAcuerdos',
        moduleFilters: params.moduleFilters,
        order_by: params.order_by,
      }),
    },
    refreshAccessToken: params.refreshAccessToken,
    logout: params.logout,
  });
  if (!res) return { status: false, message: 'Sesión expirada' };
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.status) return { status: false, message: j.message || `HTTP ${res.status}` };
  return { status: true, data: j.data, count: j.count };
}

export async function previewAccionesPersonales(params: {
  moduleFilters: Record<string, unknown>;
  order_by: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}): Promise<{ status: boolean; data?: any[]; count?: number; message?: string }> {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) return { status: false, message: 'Server URL not configured' };
  const res = await authedFetch({
    url: `${apiUrl}/api/reportes`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'previewAccionesPersonales',
        moduleFilters: params.moduleFilters,
        order_by: params.order_by,
      }),
    },
    refreshAccessToken: params.refreshAccessToken,
    logout: params.logout,
  });
  if (!res) return { status: false, message: 'Sesión expirada' };
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.status) return { status: false, message: j.message || `HTTP ${res.status}` };
  return { status: true, data: j.data, count: j.count };
}

export async function previewActaEntregaProductos(params: {
  moduleFilters: Record<string, unknown>;
  order_by: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}): Promise<{ status: boolean; data?: any[]; count?: number; message?: string }> {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) return { status: false, message: 'Server URL not configured' };
  const res = await authedFetch({
    url: `${apiUrl}/api/reportes`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'previewActaEntregaProductos',
        moduleFilters: params.moduleFilters,
        order_by: params.order_by,
      }),
    },
    refreshAccessToken: params.refreshAccessToken,
    logout: params.logout,
  });
  if (!res) return { status: false, message: 'Sesión expirada' };
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.status) return { status: false, message: j.message || `HTTP ${res.status}` };
  return { status: true, data: j.data, count: j.count };
}

export async function previewEntregaPuesto(params: {
  moduleFilters: Record<string, unknown>;
  order_by: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}): Promise<{ status: boolean; data?: any[]; count?: number; message?: string }> {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) return { status: false, message: 'Server URL not configured' };
  const res = await authedFetch({
    url: `${apiUrl}/api/reportes`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'previewEntregaPuesto',
        moduleFilters: params.moduleFilters,
        order_by: params.order_by,
      }),
    },
    refreshAccessToken: params.refreshAccessToken,
    logout: params.logout,
  });
  if (!res) return { status: false, message: 'Sesión expirada' };
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.status) return { status: false, message: j.message || `HTTP ${res.status}` };
  return { status: true, data: j.data, count: j.count };
}

export async function previewIncidentes(params: {
  moduleFilters: Record<string, unknown>;
  order_by: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}): Promise<{ status: boolean; data?: any[]; count?: number; message?: string }> {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) return { status: false, message: 'Server URL not configured' };
  const res = await authedFetch({
    url: `${apiUrl}/api/reportes`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'previewIncidentes',
        moduleFilters: params.moduleFilters,
        order_by: params.order_by,
      }),
    },
    refreshAccessToken: params.refreshAccessToken,
    logout: params.logout,
  });
  if (!res) return { status: false, message: 'Sesión expirada' };
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.status) return { status: false, message: j.message || `HTTP ${res.status}` };
  return { status: true, data: j.data, count: j.count };
}

export async function previewBitacoraNovedades(params: {
  moduleFilters: Record<string, unknown>;
  order_by: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}): Promise<{ status: boolean; data?: any[]; count?: number; message?: string }> {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) return { status: false, message: 'Server URL not configured' };
  const res = await authedFetch({
    url: `${apiUrl}/api/reportes`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'previewBitacoraNovedades',
        moduleFilters: params.moduleFilters,
        order_by: params.order_by,
      }),
    },
    refreshAccessToken: params.refreshAccessToken,
    logout: params.logout,
  });
  if (!res) return { status: false, message: 'Sesión expirada' };
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.status) return { status: false, message: j.message || `HTTP ${res.status}` };
  return { status: true, data: j.data, count: j.count };
}

export async function previewMaestroQuejas(params: {
  moduleFilters: Record<string, unknown>;
  order_by: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}): Promise<{ status: boolean; data?: any[]; count?: number; message?: string }> {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) return { status: false, message: 'Server URL not configured' };
  const res = await authedFetch({
    url: `${apiUrl}/api/reportes`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'previewMaestroQuejas',
        moduleFilters: params.moduleFilters,
        order_by: params.order_by,
      }),
    },
    refreshAccessToken: params.refreshAccessToken,
    logout: params.logout,
  });
  if (!res) return { status: false, message: 'Sesión expirada' };
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.status) return { status: false, message: j.message || `HTTP ${res.status}` };
  return { status: true, data: j.data, count: j.count };
}

export async function previewChecklistSupervision(params: {
  moduleFilters: Record<string, unknown>;
  order_by: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}): Promise<{ status: boolean; data?: any[]; count?: number; message?: string }> {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) return { status: false, message: 'Server URL not configured' };
  const res = await authedFetch({
    url: `${apiUrl}/api/reportes`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'previewChecklistSupervision',
        moduleFilters: params.moduleFilters,
        order_by: params.order_by,
      }),
    },
    refreshAccessToken: params.refreshAccessToken,
    logout: params.logout,
  });
  if (!res) return { status: false, message: 'Sesión expirada' };
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.status) return { status: false, message: j.message || `HTTP ${res.status}` };
  return { status: true, data: j.data, count: j.count };
}

export async function previewEvaluacionPersonal(params: {
  moduleFilters: Record<string, unknown>;
  order_by: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}): Promise<{ status: boolean; data?: any[]; count?: number; message?: string }> {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) return { status: false, message: 'Server URL not configured' };
  const res = await authedFetch({
    url: `${apiUrl}/api/reportes`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'previewEvaluacionPersonal',
        moduleFilters: params.moduleFilters,
        order_by: params.order_by,
      }),
    },
    refreshAccessToken: params.refreshAccessToken,
    logout: params.logout,
  });
  if (!res) return { status: false, message: 'Sesión expirada' };
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.status) return { status: false, message: j.message || `HTTP ${res.status}` };
  return { status: true, data: j.data, count: j.count };
}

export async function previewProductoNoConforme(params: {
  moduleFilters: Record<string, unknown>;
  order_by: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}): Promise<{ status: boolean; data?: any[]; count?: number; message?: string }> {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) return { status: false, message: 'Server URL not configured' };
  const res = await authedFetch({
    url: `${apiUrl}/api/reportes`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'previewProductoNoConforme',
        moduleFilters: params.moduleFilters,
        order_by: params.order_by,
      }),
    },
    refreshAccessToken: params.refreshAccessToken,
    logout: params.logout,
  });
  if (!res) return { status: false, message: 'Sesión expirada' };
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.status) return { status: false, message: j.message || `HTTP ${res.status}` };
  return { status: true, data: j.data, count: j.count };
}

export async function previewRegistroCapacitaciones(params: {
  moduleFilters: Record<string, unknown>;
  order_by: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}): Promise<{ status: boolean; data?: any[]; count?: number; message?: string }> {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) return { status: false, message: 'Server URL not configured' };
  const res = await authedFetch({
    url: `${apiUrl}/api/reportes`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'previewRegistroCapacitaciones',
        moduleFilters: params.moduleFilters,
        order_by: params.order_by,
      }),
    },
    refreshAccessToken: params.refreshAccessToken,
    logout: params.logout,
  });
  if (!res) return { status: false, message: 'Sesión expirada' };
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.status) return { status: false, message: j.message || `HTTP ${res.status}` };
  return { status: true, data: j.data, count: j.count };
}

export async function previewRegistroInduccionGeneral(params: {
  moduleFilters: Record<string, unknown>;
  order_by: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}): Promise<{ status: boolean; data?: any[]; count?: number; message?: string }> {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) return { status: false, message: 'Server URL not configured' };
  const res = await authedFetch({
    url: `${apiUrl}/api/reportes`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'previewRegistroInduccionGeneral',
        moduleFilters: params.moduleFilters,
        order_by: params.order_by,
      }),
    },
    refreshAccessToken: params.refreshAccessToken,
    logout: params.logout,
  });
  if (!res) return { status: false, message: 'Sesión expirada' };
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.status) return { status: false, message: j.message || `HTTP ${res.status}` };
  return { status: true, data: j.data, count: j.count };
}

export async function searchAlmuerzoCedulas(params: {
  q: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}): Promise<{ status: boolean; data?: CedulaAlmuerzoLite[]; message?: string }> {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) return { status: false, message: 'Server URL not configured' };
  const res = await authedFetch({
    url: `${apiUrl}/api/reportes`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation: 'searchAlmuerzoCedulas', q: params.q }),
    },
    refreshAccessToken: params.refreshAccessToken,
    logout: params.logout,
  });
  if (!res) return { status: false, message: 'Sesión expirada' };
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.status) return { status: false, message: j.message || `HTTP ${res.status}` };
  return { status: true, data: j.data };
}

export async function previewTiempoAlmuerzo(params: {
  moduleFilters: Record<string, unknown>;
  order_by: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}): Promise<{ status: boolean; data?: any[]; count?: number; message?: string }> {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) return { status: false, message: 'Server URL not configured' };
  const res = await authedFetch({
    url: `${apiUrl}/api/reportes`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'previewTiempoAlmuerzo',
        moduleFilters: params.moduleFilters,
        order_by: params.order_by,
      }),
    },
    refreshAccessToken: params.refreshAccessToken,
    logout: params.logout,
  });
  if (!res) return { status: false, message: 'Sesión expirada' };
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.status) return { status: false, message: j.message || `HTTP ${res.status}` };
  return { status: true, data: j.data, count: j.count };
}

export async function previewLoginMarca(params: {
  moduleFilters: Record<string, unknown>;
  order_by: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}): Promise<{ status: boolean; data?: any[]; count?: number; message?: string }> {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) return { status: false, message: 'Server URL not configured' };
  const res = await authedFetch({
    url: `${apiUrl}/api/reportes`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'previewLoginMarca',
        moduleFilters: params.moduleFilters,
        order_by: params.order_by,
      }),
    },
    refreshAccessToken: params.refreshAccessToken,
    logout: params.logout,
  });
  if (!res) return { status: false, message: 'Sesión expirada' };
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.status) return { status: false, message: j.message || `HTTP ${res.status}` };
  return { status: true, data: j.data, count: j.count };
}

export async function previewCambiosUbicacionPuesto(params: {
  moduleFilters: Record<string, unknown>;
  order_by: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}): Promise<{ status: boolean; data?: any[]; count?: number; message?: string }> {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) return { status: false, message: 'Server URL not configured' };
  const res = await authedFetch({
    url: `${apiUrl}/api/reportes`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'previewCambiosUbicacionPuesto',
        moduleFilters: params.moduleFilters,
        order_by: params.order_by,
      }),
    },
    refreshAccessToken: params.refreshAccessToken,
    logout: params.logout,
  });
  if (!res) return { status: false, message: 'Sesión expirada' };
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.status) return { status: false, message: j.message || `HTTP ${res.status}` };
  return { status: true, data: j.data, count: j.count };
}

export async function previewNotasVoz(params: {
  moduleFilters: Record<string, unknown>;
  order_by: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}): Promise<{ status: boolean; data?: any[]; count?: number; message?: string }> {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) return { status: false, message: 'Server URL not configured' };
  const res = await authedFetch({
    url: `${apiUrl}/api/reportes`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'previewNotasVoz',
        moduleFilters: params.moduleFilters,
        order_by: params.order_by,
      }),
    },
    refreshAccessToken: params.refreshAccessToken,
    logout: params.logout,
  });
  if (!res) return { status: false, message: 'Sesión expirada' };
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.status) return { status: false, message: j.message || `HTTP ${res.status}` };
  return { status: true, data: j.data, count: j.count };
}

export async function previewInduccionRecorrido(params: {
  moduleFilters: Record<string, unknown>;
  order_by: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}): Promise<{ status: boolean; data?: any[]; count?: number; message?: string }> {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) return { status: false, message: 'Server URL not configured' };
  const res = await authedFetch({
    url: `${apiUrl}/api/reportes`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'previewInduccionRecorrido',
        moduleFilters: params.moduleFilters,
        order_by: params.order_by,
      }),
    },
    refreshAccessToken: params.refreshAccessToken,
    logout: params.logout,
  });
  if (!res) return { status: false, message: 'Sesión expirada' };
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.status) return { status: false, message: j.message || `HTTP ${res.status}` };
  return { status: true, data: j.data, count: j.count };
}

export async function previewArticulosPuesto(params: {
  moduleFilters: Record<string, unknown>;
  order_by: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}): Promise<{ status: boolean; data?: any[]; count?: number; message?: string }> {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) return { status: false, message: 'Server URL not configured' };
  const res = await authedFetch({
    url: `${apiUrl}/api/reportes`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'previewArticulosPuesto',
        moduleFilters: params.moduleFilters,
        order_by: params.order_by,
      }),
    },
    refreshAccessToken: params.refreshAccessToken,
    logout: params.logout,
  });
  if (!res) return { status: false, message: 'Sesión expirada' };
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.status) return { status: false, message: j.message || `HTTP ${res.status}` };
  return { status: true, data: j.data, count: j.count };
}

export async function previewRegistroVehiculosCorporativos(params: {
  moduleFilters: Record<string, unknown>;
  order_by: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}): Promise<{ status: boolean; data?: any[]; count?: number; message?: string }> {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) return { status: false, message: 'Server URL not configured' };
  const res = await authedFetch({
    url: `${apiUrl}/api/reportes`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'previewRegistroVehiculosCorporativos',
        moduleFilters: params.moduleFilters,
        order_by: params.order_by,
      }),
    },
    refreshAccessToken: params.refreshAccessToken,
    logout: params.logout,
  });
  if (!res) return { status: false, message: 'Sesión expirada' };
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.status) return { status: false, message: j.message || `HTTP ${res.status}` };
  return { status: true, data: j.data, count: j.count };
}

export async function previewMantenimientoArticulos(params: {
  moduleFilters: Record<string, unknown>;
  order_by: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}): Promise<{ status: boolean; data?: any[]; count?: number; message?: string }> {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) return { status: false, message: 'Server URL not configured' };
  const res = await authedFetch({
    url: `${apiUrl}/api/reportes`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'previewMantenimientoArticulos',
        moduleFilters: params.moduleFilters,
        order_by: params.order_by,
      }),
    },
    refreshAccessToken: params.refreshAccessToken,
    logout: params.logout,
  });
  if (!res) return { status: false, message: 'Sesión expirada' };
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.status) return { status: false, message: j.message || `HTTP ${res.status}` };
  return { status: true, data: j.data, count: j.count };
}

export async function previewManualesPuesto(params: {
  moduleFilters: Record<string, unknown>;
  order_by: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}): Promise<{ status: boolean; data?: any[]; count?: number; message?: string }> {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) return { status: false, message: 'Server URL not configured' };
  const res = await authedFetch({
    url: `${apiUrl}/api/reportes`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'previewManualesPuesto',
        moduleFilters: params.moduleFilters,
        order_by: params.order_by,
      }),
    },
    refreshAccessToken: params.refreshAccessToken,
    logout: params.logout,
  });
  if (!res) return { status: false, message: 'Sesión expirada' };
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.status) return { status: false, message: j.message || `HTTP ${res.status}` };
  return { status: true, data: j.data, count: j.count };
}

export async function previewLlaves(params: {
  moduleFilters: Record<string, unknown>;
  order_by: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}): Promise<{ status: boolean; data?: any[]; count?: number; message?: string }> {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) return { status: false, message: 'Server URL not configured' };
  const res = await authedFetch({
    url: `${apiUrl}/api/reportes`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'previewLlaves',
        moduleFilters: params.moduleFilters,
        order_by: params.order_by,
      }),
    },
    refreshAccessToken: params.refreshAccessToken,
    logout: params.logout,
  });
  if (!res) return { status: false, message: 'Sesión expirada' };
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.status) return { status: false, message: j.message || `HTTP ${res.status}` };
  return { status: true, data: j.data, count: j.count };
}

export async function previewLlaveros(params: {
  moduleFilters: Record<string, unknown>;
  order_by: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}): Promise<{ status: boolean; data?: any[]; count?: number; message?: string }> {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) return { status: false, message: 'Server URL not configured' };
  const res = await authedFetch({
    url: `${apiUrl}/api/reportes`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'previewLlaveros',
        moduleFilters: params.moduleFilters,
        order_by: params.order_by,
      }),
    },
    refreshAccessToken: params.refreshAccessToken,
    logout: params.logout,
  });
  if (!res) return { status: false, message: 'Sesión expirada' };
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.status) return { status: false, message: j.message || `HTTP ${res.status}` };
  return { status: true, data: j.data, count: j.count };
}

export type PurgeOldMobileReportsResult = {
  cutoff: string;
  recordsFound: number;
  recordsDeleted: number;
  filesDeleted: number;
  fileDeleteErrors: number;
};

/** Limpia reportes móviles con más de 6 meses de antigüedad (registro + archivo en disco). */
export async function purgeOldMobileReports(params: {
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}): Promise<{ status: boolean; data?: PurgeOldMobileReportsResult; message?: string }> {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) return { status: false, message: 'Server URL not configured' };
  const res = await authedFetch({
    url: `${apiUrl}/api/reportes`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation: 'purgeOldReports' }),
    },
    refreshAccessToken: params.refreshAccessToken,
    logout: params.logout,
  });
  if (!res) return { status: false, message: 'Sesión expirada' };
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.status) return { status: false, message: j.message || `HTTP ${res.status}` };
  return { status: true, data: j.data as PurgeOldMobileReportsResult };
}

export async function previewSolicitudesPermiso(params: {
  moduleFilters: Record<string, unknown>;
  order_by: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}): Promise<{ status: boolean; data?: any[]; count?: number; message?: string }> {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) return { status: false, message: 'Server URL not configured' };
  const res = await authedFetch({
    url: `${apiUrl}/api/reportes`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'previewSolicitudesPermiso',
        moduleFilters: params.moduleFilters,
        order_by: params.order_by,
      }),
    },
    refreshAccessToken: params.refreshAccessToken,
    logout: params.logout,
  });
  if (!res) return { status: false, message: 'Sesión expirada' };
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.status) return { status: false, message: j.message || `HTTP ${res.status}` };
  return { status: true, data: j.data, count: j.count };
}

export async function createReportJob(params: {
  body: Record<string, unknown>;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}): Promise<{ status: boolean; message?: string; data?: any }> {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) return { status: false, message: 'Server URL not configured' };
  const res = await authedFetch({
    url: `${apiUrl}/api/reportes`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation: 'createReportJob', ...params.body }),
    },
    refreshAccessToken: params.refreshAccessToken,
    logout: params.logout,
  });
  if (!res) return { status: false, message: 'Sesión expirada' };
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.status) return { status: false, message: j.message || `HTTP ${res.status}` };
  return { status: true, message: j.message, data: j.data };
}
