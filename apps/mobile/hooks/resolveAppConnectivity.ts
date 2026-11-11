import * as Network from 'expo-network';
import { FORCE_OFFLINE } from '../constants/syncFlags';

export type AppConnectivityReason = 'force_offline' | 'no_network' | 'error';

export type AppConnectivityResult =
  | { ok: true }
  | { ok: false; reason: AppConnectivityReason };

/**
 * Comprueba si la app puede asumir conectividad útil para operaciones online.
 * - `FORCE_OFFLINE` (solo pruebas en syncFlags) fuerza el mismo resultado que sin red.
 */
export async function resolveAppConnectivity(): Promise<AppConnectivityResult> {
  if (FORCE_OFFLINE) {
    return { ok: false, reason: 'force_offline' };
  }
  try {
    const state = await Network.getNetworkStateAsync();
    const connected = state.isConnected === true;
    const reach = state.isInternetReachable;
    const online = connected && (reach === true || reach === null);
    if (!online) {
      return { ok: false, reason: 'no_network' };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: 'error' };
  }
}
