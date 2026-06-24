import Constants from 'expo-constants';
import authedFetch from './authedFetch';

export type BulkPlantillaArticulo = {
  numero_articulo: number;
  cantidad: number;
  serie: string;
  marca: string;
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

export async function submitMantenimientoEquipoBulkArticulos({
  puestoIds,
  articulos,
  refreshAccessToken,
  logout,
}: {
  puestoIds: number[];
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
        puesto_ids: puestoIds,
        articulos: articulos.map((a) => ({
          numero_articulo: a.numero_articulo,
          cantidad: a.cantidad,
          serie: a.serie,
          marca: a.marca,
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
