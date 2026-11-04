import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseNextShift, type NextShift, type StoredNextShift } from './nextShiftCore';

/** Siguiente turno laboral del empleado (lo trae la consulta periódica de la marca actual); se lee sin conexión. */
export const NEXT_SHIFT_KEY = 'next_shift';

/** Guarda el siguiente turno; `null` (o un turno inválido / día libre) lo elimina. Un fallo del almacenamiento no interrumpe la consulta. */
export async function setNextShiftStorage(raw: unknown, empleadoId: number | string | null | undefined): Promise<void> {
  try {
    const shift = parseNextShift(raw);
    const id = Number(empleadoId);
    if (!shift || !Number.isFinite(id)) {
      await AsyncStorage.removeItem(NEXT_SHIFT_KEY);
      return;
    }
    const stored: StoredNextShift = { empleadoId: id, savedAt: Date.now(), shift };
    await AsyncStorage.setItem(NEXT_SHIFT_KEY, JSON.stringify(stored));
  } catch (e) {
    console.warn('[next_shift] no se pudo guardar:', e instanceof Error ? e.message : e);
  }
}

/** Lee el siguiente turno guardado; solo si es del empleado indicado (en un equipo compartido no se muestra el de otra persona). */
export async function getNextShiftFromStorage(empleadoId: number | string | null | undefined): Promise<NextShift | null> {
  try {
    const raw = await AsyncStorage.getItem(NEXT_SHIFT_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as Partial<StoredNextShift>;
    if (Number(stored.empleadoId) !== Number(empleadoId)) return null;
    return parseNextShift(stored.shift);
  } catch {
    return null;
  }
}
