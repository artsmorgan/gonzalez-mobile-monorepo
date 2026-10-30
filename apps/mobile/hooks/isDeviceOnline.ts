import * as Network from 'expo-network';

/**
 * Criterio alineado con la sincronización global en App.tsx:
 * hay interfaz conectada y la reachability no es explícitamente false
 * (`null` = desconocido en muchos dispositivos, se trata como permitido).
 */
export function isNetworkStateOnline(state: Network.NetworkState): boolean {
  const connected = !!state.isConnected;
  const reach = state.isInternetReachable;
  return connected && (reach === true || reach === null);
}

/** Evalúa si el dispositivo puede usar Internet con el criterio anterior. */
export default async function isDeviceOnline(): Promise<boolean> {
  const state = await Network.getNetworkStateAsync();
  return isNetworkStateOnline(state);
}
