import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_HORAS_ELIMINAR_MARCA_TRAS_SALIDA, parseHorasEliminarMarca } from './marcaCaducada';

export const HORAS_ELIMINAR_MARCA_STORAGE_KEY = 'horas_eliminar_marca_tras_salida';

/** Horas (nomenclador «horas_eliminar_marca_tras_salida») tras la salida de un turno en que se elimina del almacenamiento; la última recibida del servidor. */
export async function getHorasEliminarMarcaFromStorage(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(HORAS_ELIMINAR_MARCA_STORAGE_KEY);
    if (raw == null || raw.trim() === '') return DEFAULT_HORAS_ELIMINAR_MARCA_TRAS_SALIDA;
    return parseHorasEliminarMarca(raw);
  } catch {
    return DEFAULT_HORAS_ELIMINAR_MARCA_TRAS_SALIDA;
  }
}

export async function setHorasEliminarMarcaStorage(value: unknown): Promise<number> {
  const horas = parseHorasEliminarMarca(value);
  await AsyncStorage.setItem(HORAS_ELIMINAR_MARCA_STORAGE_KEY, String(horas));
  return horas;
}
