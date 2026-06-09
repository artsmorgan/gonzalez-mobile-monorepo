import { Alert } from 'react-native';
import * as Location from 'expo-location';
import * as Linking from 'expo-linking';

const LOCATION_TIMEOUT_MS = 15_000;

export type DeviceCoordsResult =
  | { ok: true; latitude: number; longitude: number }
  | { ok: false; message: string };

export type DeviceCoordsLabels = {
  /** Texto corto de la acción (ej. "marcar ingreso"). */
  shortAction: string;
  /** Indicación al reintentar tras activar GPS (ej. "vuelve a pulsar Marcar ingreso"). */
  retryAction: string;
};

export const DEVICE_COORDS_LABELS_MARCA_INGRESO: DeviceCoordsLabels = {
  shortAction: 'marcar ingreso',
  retryAction: 'vuelve a pulsar Marcar ingreso',
};

export const DEVICE_COORDS_LABELS_PUESTO_UBICACION: DeviceCoordsLabels = {
  shortAction: 'actualizar la ubicación del puesto',
  retryAction: 'vuelve a pulsar Actualizar ubicación o Reintentar',
};

function promptEnableLocation(message: string) {
  Alert.alert('Ubicación requerida', message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Abrir configuración', onPress: () => void Linking.openSettings() },
  ]);
}

function isValidCoords(latitude: unknown, longitude: unknown): boolean {
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)
  );
}

/**
 * Obtiene coordenadas GPS del dispositivo. Cada intento es independiente:
 * si falla, el usuario puede reintentar tras activar GPS o conceder permisos.
 */
export default async function resolveDeviceCoordinates(options?: {
  silent?: boolean;
  labels?: DeviceCoordsLabels;
}): Promise<DeviceCoordsResult> {
  const silent = options?.silent === true;
  const labels = options?.labels ?? DEVICE_COORDS_LABELS_MARCA_INGRESO;

  const isLocationEnabled = await Location.hasServicesEnabledAsync();
  if (!isLocationEnabled) {
    const message = `Los servicios de ubicación están apagados. Actívalos para ${labels.shortAction}.`;
    if (!silent) {
      promptEnableLocation(
        `Los servicios de ubicación están apagados. Actívalos y ${labels.retryAction}.`,
      );
    }
    return { ok: false, message };
  }

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    const message = `Se necesita permiso de ubicación para ${labels.shortAction}.`;
    if (!silent) {
      promptEnableLocation(
        `Se necesita permiso de ubicación. Concede el permiso y ${labels.retryAction}.`,
      );
    }
    return { ok: false, message };
  }

  let subscription: Location.LocationSubscription | null = null;

  try {
    subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Low,
        timeInterval: 1000,
        distanceInterval: 1,
      },
      () => {}
    );

    await new Promise((res) => setTimeout(res, 1000));
  } finally {
    subscription?.remove();
  }

  try {
    const location = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('LOCATION_TIMEOUT')), LOCATION_TIMEOUT_MS);
      }),
    ]);

    const { latitude, longitude } = location.coords;
    if (isValidCoords(latitude, longitude)) {
      return { ok: true, latitude, longitude };
    }
  } catch (error) {
    console.warn('getCurrentPositionAsync failed, trying last known position:', error);
  }

  try {
    const lastKnown = await Location.getLastKnownPositionAsync();
    if (lastKnown?.coords) {
      const { latitude, longitude } = lastKnown.coords;
      if (isValidCoords(latitude, longitude)) {
        return { ok: true, latitude, longitude };
      }
    }
  } catch (error) {
    console.warn('getLastKnownPositionAsync failed:', error);
  }

  const message = `No se pudo obtener la ubicación. Activa el GPS y espera unos segundos para ${labels.shortAction}.`;
  if (!silent) {
    Alert.alert('Ubicación no disponible', `${message} ${labels.retryAction}.`, [
      { text: 'Aceptar', style: 'default' },
    ]);
  }
  return { ok: false, message };
}
