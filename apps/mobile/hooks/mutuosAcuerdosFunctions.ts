import Constants from 'expo-constants';
import authedFetch from './authedFetch';
import type {
  BasicResponse,
  ListMarcasMutuoResponse,
  ListMutuosAcuerdosResponse,
  MutuoAcuerdoUpsertResponse,
} from './mutuosAcuerdosTypes';

type CommonAuth = {
  refreshAccessToken?: () => Promise<boolean>;
  logout?: () => Promise<any>;
};

const normalizeBase64 = (b64: string) => {
  const idx = b64.indexOf('base64,');
  if (idx !== -1) return b64.slice(idx + 'base64,'.length);
  return b64;
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

export const listMutuosAcuerdosMine = async ({
  refreshAccessToken,
  logout,
}: CommonAuth): Promise<ListMutuosAcuerdosResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');
    const { refreshAccessToken: refresh, logout: doLogout } = requireAuthHandlers(refreshAccessToken, logout);

    const response = await authedFetch({
      url: `${apiUrl}/api/mutuos-acuerdos`,
      init: {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      refreshAccessToken: refresh,
      logout: doLogout,
    });
    if (!response) return { status: false, message: 'Sesión expirada', data: [] };
    return (await response.json()) as ListMutuosAcuerdosResponse;
  } catch (error: any) {
    return { status: false, message: error?.message || 'Error al listar mutuos acuerdos', data: [] };
  }
};

export const listMarcasParaMutuo = async ({
  empleado_id,
  fecha,
  refreshAccessToken,
  logout,
}: { empleado_id: number; fecha: string } & CommonAuth): Promise<ListMarcasMutuoResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');
    const { refreshAccessToken: refresh, logout: doLogout } = requireAuthHandlers(refreshAccessToken, logout);

    const response = await authedFetch({
      url: `${apiUrl}/api/mutuos-acuerdos/marcas?empleado_id=${encodeURIComponent(String(empleado_id))}&fecha=${encodeURIComponent(fecha)}`,
      init: {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      refreshAccessToken: refresh,
      logout: doLogout,
    });
    if (!response) return { status: false, message: 'Sesión expirada', data: [] };
    return (await response.json()) as ListMarcasMutuoResponse;
  } catch (error: any) {
    return { status: false, message: error?.message || 'Error al listar marcas', data: [] };
  }
};

export const createMutuoAcuerdo = async ({
  requestData,
  refreshAccessToken,
  logout,
}: { requestData: any } & CommonAuth): Promise<MutuoAcuerdoUpsertResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');
    const { refreshAccessToken: refresh, logout: doLogout } = requireAuthHandlers(refreshAccessToken, logout);

    const response = await authedFetch({
      url: `${apiUrl}/api/mutuos-acuerdos`,
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      },
      refreshAccessToken: refresh,
      logout: doLogout,
    });
    if (!response) return { status: false, message: 'Sesión expirada' };
    return (await response.json()) as MutuoAcuerdoUpsertResponse;
  } catch (error: any) {
    return { status: false, message: error?.message || 'Error al crear mutuo acuerdo' };
  }
};

export const acceptMutuoAcuerdo = async ({
  id,
  role,
  refreshAccessToken,
  logout,
}: { id: number; role: 'ausente' | 'reemplaza' } & CommonAuth): Promise<BasicResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');
    const { refreshAccessToken: refresh, logout: doLogout } = requireAuthHandlers(refreshAccessToken, logout);

    const response = await authedFetch({
      url: `${apiUrl}/api/mutuos-acuerdos/${id}`,
      init: {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role }),
      },
      refreshAccessToken: refresh,
      logout: doLogout,
    });
    if (!response) return { status: false, message: 'Sesión expirada' };
    return (await response.json()) as BasicResponse;
  } catch (error: any) {
    return { status: false, message: error?.message || 'Error al aceptar mutuo acuerdo' };
  }
};

export const signMutuoAcuerdoEjecutivo = async ({
  id,
  firma_ejecutivo_cuenta_manual,
  firma_ejecutivo_cuenta_digital,
  hora_accion,
  refreshAccessToken,
  logout,
}: {
  id: number;
  firma_ejecutivo_cuenta_manual: string;
  firma_ejecutivo_cuenta_digital: string;
  hora_accion?: string;
} & CommonAuth): Promise<BasicResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');
    const { refreshAccessToken: refresh, logout: doLogout } = requireAuthHandlers(refreshAccessToken, logout);

    const payload = {
      firma_ejecutivo_cuenta_manual: normalizeBase64(String(firma_ejecutivo_cuenta_manual || '')),
      firma_ejecutivo_cuenta_digital: String(firma_ejecutivo_cuenta_digital || '').trim(),
      hora_accion: hora_accion || undefined,
    };

    const response = await authedFetch({
      url: `${apiUrl}/api/mutuos-acuerdos/${id}/firma-ejecutivo`,
      init: {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
      refreshAccessToken: refresh,
      logout: doLogout,
    });
    if (!response) return { status: false, message: 'Sesión expirada' };
    return (await response.json()) as BasicResponse;
  } catch (error: any) {
    return { status: false, message: error?.message || 'Error al firmar mutuo acuerdo' };
  }
};

export const rejectMutuoAcuerdoEjecutivo = async ({
  id,
  hora_accion,
  refreshAccessToken,
  logout,
}: { id: number; hora_accion?: string } & CommonAuth): Promise<BasicResponse> => {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');
    const { refreshAccessToken: refresh, logout: doLogout } = requireAuthHandlers(refreshAccessToken, logout);

    const response = await authedFetch({
      url: `${apiUrl}/api/mutuos-acuerdos/${id}/reject`,
      init: {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          hora_accion: hora_accion || undefined,
        }),
      },
      refreshAccessToken: refresh,
      logout: doLogout,
    });
    if (!response) return { status: false, message: 'Sesión expirada' };
    return (await response.json()) as BasicResponse;
  } catch (error: any) {
    return { status: false, message: error?.message || 'Error al rechazar mutuo acuerdo' };
  }
};

// Compatibilidad con referencias viejas (App sync legacy)
export const listMutuosAcuerdosByCorpo = listMutuosAcuerdosMine;
export const updateMutuoAcuerdo = async (): Promise<MutuoAcuerdoUpsertResponse> => ({ status: false, message: 'Operación no soportada en modo online' });
export const deleteMutuoAcuerdo = async (): Promise<BasicResponse> => ({ status: false, message: 'Operación no soportada en modo online' });
