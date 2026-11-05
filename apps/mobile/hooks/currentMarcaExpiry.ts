import AsyncStorage from '@react-native-async-storage/async-storage';
import getHoraAccion from './getHoraAccion';
import { eventBus } from './eventBus';
import { CURRENT_MARCA_UPDATED_EVENT } from './pushNotificationsService';
import { getHorasEliminarMarcaFromStorage } from './horasEliminarMarcaStorage';
import { marcaCaducada } from './marcaCaducada';

/**
 * Claves de AsyncStorage que dependen del turno (marca) actual: al eliminar el turno se limpian junto con `current_marca` para que no
 * queden el temporizador de almuerzo ni el recordatorio de un turno anterior.
 *
 * NO se tocan las acciones pendientes de sincronizar (`*_actions`, `lunchtime_actions`, `evaluations_actions`…): lo registrado sin
 * conexión durante el turno se sincroniza igual al recuperar la red.
 */
export const CURRENT_MARCA_DEPENDENT_KEYS = ['current_marca', 'temp_state', 'alert_lunch_time', 'lunch_time_config'] as const;

/** Elimina el turno actual del almacenamiento (sin tocar las acciones pendientes de sincronizar) y avisa al resto de la app. */
export async function removeCurrentMarca(): Promise<void> {
  await AsyncStorage.multiRemove([...CURRENT_MARCA_DEPENDENT_KEYS]);
  eventBus.emit(CURRENT_MARCA_UPDATED_EVENT);
}

/**
 * Si el turno guardado (`current_marca`) terminó hace más de N horas (nomenclador, 4 por defecto; hora de referencia `getHoraAccion`),
 * lo elimina del almacenamiento. Devuelve true si lo eliminó. Funciona sin conexión: usa las horas guardadas la última vez.
 */
export async function removeCurrentMarcaIfExpired(nowMs?: number): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem('current_marca');
    if (!raw || raw.trim() === '') return false;
    const marca = JSON.parse(raw) as Record<string, any>;
    if (!marca || typeof marca !== 'object') return false;
    const now = Number.isFinite(nowMs) ? (nowMs as number) : Number(await getHoraAccion());
    if (!Number.isFinite(now) || now <= 0) return false;
    const horas = await getHorasEliminarMarcaFromStorage();
    if (!marcaCaducada(marca, now, horas)) return false;
    await removeCurrentMarca();
    return true;
  } catch (e) {
    console.error('[marca] Error revisando si el turno actual caducó:', e);
    return false;
  }
}
