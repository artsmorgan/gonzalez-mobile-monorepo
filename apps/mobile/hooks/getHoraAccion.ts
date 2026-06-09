import AsyncStorage from '@react-native-async-storage/async-storage';
import { toZonedTime } from 'date-fns-tz';
import updateServerTime from './updateServerTime';

const COSTA_RICA_TZ = 'America/Costa_Rica';

function costaRicaNowMs(): number {
  return toZonedTime(new Date(), COSTA_RICA_TZ).getTime();
}

/** Hora de referencia del servidor (CR), extrapolada offline desde la última sincronización. */
export default async function getHoraAccion(): Promise<number> {
  try {
    await updateServerTime();
    const server_time = await AsyncStorage.getItem('server_time');
    if (server_time) {
      const server_time_obj = JSON.parse(server_time);
      const t = parseInt(String(server_time_obj.server_time), 10);
      if (Number.isFinite(t)) {
        return t;
      }
    }
    return costaRicaNowMs();
  } catch (error) {
    console.error('Error getting hora accion:', error);
    return costaRicaNowMs();
  }
}
