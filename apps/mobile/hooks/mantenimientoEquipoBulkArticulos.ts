import Constants from 'expo-constants';
import authedFetch from './authedFetch';

export type BulkPlantillaArticulo = {
  codigo_puesto: string;
  puesto_nombre?: string;
  numero_articulo: number;
  cantidad: number;
  serie: string;
  marca: string;
  modelo?: string | null;
  fecha_entrega: string;
  articulo_nombre: string;
};

type AuthHandlers = {
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<unknown>;
};

function getApiUrl(): string {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) throw new Error('Server URL not configured');
  return apiUrl.replace(/\/+$/, '');
}

export async function validateMantenimientoEquipoPuestosCodigos({
  codigos,
  refreshAccessToken,
  logout,
}: {
  codigos: string[];
  refreshAccessToken: AuthHandlers['refreshAccessToken'];
  logout: AuthHandlers['logout'];
}): Promise<{
  status: boolean;
  message?: string;
  errors?: string[];
  puestos?: { codigo: string; id: number; nombre: string }[];
}> {
  const response = await authedFetch({
    url: `${getApiUrl()}/api/mantenimiento-equipo/validar-puestos-codigos`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigos }),
    },
    refreshAccessToken,
    logout,
  });
  if (!response) return { status: false, message: 'Sesión expirada' };
  const data = await response.json().catch(() => ({}));
  return data;
}

export async function submitMantenimientoEquipoBulkArticulos({
  articulos,
  refreshAccessToken,
  logout,
}: {
  articulos: BulkPlantillaArticulo[];
  refreshAccessToken: AuthHandlers['refreshAccessToken'];
  logout: AuthHandlers['logout'];
}): Promise<{
  status: boolean;
  message?: string;
  errors?: string[];
  skipped?: string[];
  created_plans?: number;
  created_entregas?: number;
}> {
  const response = await authedFetch({
    url: `${getApiUrl()}/api/mantenimiento-equipo/bulk-articulos`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        articulos: articulos.map((a) => ({
          codigo_puesto: a.codigo_puesto,
          numero_articulo: a.numero_articulo,
          cantidad: a.cantidad,
          serie: a.serie,
          marca: a.marca,
          modelo: a.modelo ?? null,
          fecha_entrega: a.fecha_entrega,
        })),
      }),
    },
    refreshAccessToken,
    logout,
  });
  if (!response) return { status: false, message: 'Sesión expirada' };
  const data = await response.json().catch(() => ({}));
  return data;
}
