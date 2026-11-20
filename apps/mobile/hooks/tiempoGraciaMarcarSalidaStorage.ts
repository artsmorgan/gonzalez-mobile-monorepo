import AsyncStorage from '@react-native-async-storage/async-storage';

export const TIEMPO_GRACIA_MARCAR_SALIDA_STORAGE_KEY = 'tiempo_gracia_marcar_salida';
export const DEFAULT_TIEMPO_GRACIA_MARCAR_SALIDA = 15;

export function parseTiempoGraciaMarcarSalida(raw: unknown): number {
  const n = Number(String(raw ?? '').trim());
  if (!Number.isFinite(n) || n < 0) {
    return DEFAULT_TIEMPO_GRACIA_MARCAR_SALIDA;
  }
  return Math.floor(n);
}

export async function getTiempoGraciaMarcarSalidaFromStorage(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(TIEMPO_GRACIA_MARCAR_SALIDA_STORAGE_KEY);
    if (raw == null || raw.trim() === '') {
      return DEFAULT_TIEMPO_GRACIA_MARCAR_SALIDA;
    }
    return parseTiempoGraciaMarcarSalida(raw);
  } catch {
    return DEFAULT_TIEMPO_GRACIA_MARCAR_SALIDA;
  }
}

export async function setTiempoGraciaMarcarSalidaStorage(value: unknown): Promise<number> {
  const minutes = parseTiempoGraciaMarcarSalida(value);
  await AsyncStorage.setItem(TIEMPO_GRACIA_MARCAR_SALIDA_STORAGE_KEY, String(minutes));
  return minutes;
}
