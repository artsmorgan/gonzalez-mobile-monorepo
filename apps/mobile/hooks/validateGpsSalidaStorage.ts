import AsyncStorage from '@react-native-async-storage/async-storage';

export const VALIDATE_GPS_SALIDA_STORAGE_KEY = 'validate_gps_salida';
export const DEFAULT_VALIDATE_GPS_SALIDA = false;

export function parseValidateGpsSalida(raw: unknown): boolean {
  const lower = String(raw ?? '').trim().toLowerCase();
  if (['true', '1', 'yes', 'si', 'sí'].includes(lower)) return true;
  if (['false', '0', 'no'].includes(lower)) return false;
  return DEFAULT_VALIDATE_GPS_SALIDA;
}

export async function getValidateGpsSalidaFromStorage(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(VALIDATE_GPS_SALIDA_STORAGE_KEY);
    if (raw == null || raw.trim() === '') {
      return DEFAULT_VALIDATE_GPS_SALIDA;
    }
    return parseValidateGpsSalida(raw);
  } catch {
    return DEFAULT_VALIDATE_GPS_SALIDA;
  }
}

export async function setValidateGpsSalidaStorage(value: unknown): Promise<boolean> {
  const enabled = parseValidateGpsSalida(value);
  await AsyncStorage.setItem(VALIDATE_GPS_SALIDA_STORAGE_KEY, enabled ? 'true' : 'false');
  return enabled;
}
