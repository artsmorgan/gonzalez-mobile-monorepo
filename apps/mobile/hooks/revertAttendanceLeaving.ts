import Constants from 'expo-constants';
import authedFetch from './authedFetch';

interface Params {
  marcaId: number;
  horaAccion: number;
  refreshAccessToken?: () => Promise<boolean>;
  logout?: () => Promise<{ status: boolean; message: string }>;
}

export default async function revertAttendanceLeaving({
  marcaId,
  horaAccion,
  refreshAccessToken,
  logout,
}: Params) {
  try {
    if (!refreshAccessToken || !logout) {
      throw new Error('Auth handlers not provided');
    }
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }
    if (!marcaId || marcaId <= 0) {
      throw new Error('Marca ID not found');
    }

    const response = await authedFetch({
      url: `${apiUrl}/api/attendance/${marcaId}/revert-leaving`,
      init: {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ horaAccion }),
      },
      refreshAccessToken,
      logout,
    });

    if (!response) {
      return { status: false, message: 'Sesión expirada' };
    }
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error revert leaving:', error);
    return { status: false, message: 'Error al revertir la salida' };
  }
}
