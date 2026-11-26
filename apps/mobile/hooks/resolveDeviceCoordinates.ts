import { Alert } from 'react-native';
import * as Location from 'expo-location';
import * as Linking from 'expo-linking';
import { convertDateTimestampToLocalString } from './convertDateTimestampToLocalString';
import {
  readLastLocationFromStorage,
  writeLastLocationFromGps,
} from './updateLastLocation';

/** Tiempo por defecto: firma digital en módulos generales. */
export const DEVICE_COORDS_GPS_TIMEOUT_MS_SIGNATURE_DEFAULT = 20_000;
/** Tiempo: Marcar ingreso, puesto ubicación, firma (pantalla/almuerzo). */
export const DEVICE_COORDS_GPS_TIMEOUT_MS_SCREEN = 10_000;
/** Aceptar lectura cuando accuracy (m) está por debajo de este umbral. */
const ACCURATE_LOCATION_MAX_ACCURACY_M = 50;
/** Edad máxima de lastKnownPosition antes de rechazarlo (ms). */
const MAX_LAST_KNOWN_AGE_MS = 5 * 60 * 1000;

export type DeviceCoordsResult =
  | { ok: true; latitude: number; longitude: number; warning?: string }
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

export const DEVICE_COORDS_LABELS_DIGITAL_SIGNATURE: DeviceCoordsLabels = {
  shortAction: 'generar la firma',
  retryAction: 'vuelve a pulsar Generar',
};

/** Sondeo periódico (~30 s): sin Alert; caché solo si GPS activo y falla la lectura nueva. */
export const DEVICE_COORDS_POLL_SILENT = { silent: true as const };

/** Acción del usuario: exige GPS activo; Alert «Ubicación en caché» solo tras intento fallido con GPS encendido. */
export const DEVICE_COORDS_USER_ACTION = { silent: false as const };

export type DeviceCoordsResolveOptions = {
  silent?: boolean;
  labels?: DeviceCoordsLabels;
  /** Ms esperando lectura GPS antes de usar caché o error. */
  gpsTimeoutMs?: number;
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

function formatLastLocationUpdatedAt(updatedAt: string): string {
  const ms = parseInt(String(updatedAt), 10);
  if (!Number.isFinite(ms)) return 'fecha desconocida';
  const formatted = convertDateTimestampToLocalString(new Date(ms).toISOString());
  return formatted.replace(/:\d{2}$/, '');
}

function buildCachedCoordsWarning(updatedAt: string): string {
  const when = formatLastLocationUpdatedAt(updatedAt);
  return `Se están utilizando las últimas coordenadas registradas (actualizadas el ${when}).`;
}

async function returnCachedCoordsIfAvailable(
  silent: boolean,
): Promise<DeviceCoordsResult | null> {
  const stored = await readLastLocationFromStorage();
  if (!stored) return null;

  const warning = buildCachedCoordsWarning(stored.updated_at);
  if (!silent) {
    Alert.alert('Ubicación en caché', warning);
  }
  return {
    ok: true,
    latitude: stored.latitude,
    longitude: stored.longitude,
    warning,
  };
}

/**
 * Obtiene coordenadas con watchPosition hasta precisión aceptable.
 * Funciona sin internet; requiere GPS activo y permisos.
 */
async function getAccurateLocation(
  timeoutMs: number,
): Promise<{ latitude: number; longitude: number } | null> {
  const isLocationEnabled = await Location.hasServicesEnabledAsync();
  if (!isLocationEnabled) return null;

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return null;

  return new Promise((resolve) => {
    let resolved = false;
    let subscription: Location.LocationSubscription | null = null;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        subscription?.remove();
        resolve(null);
      }
    }, timeoutMs);

    Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 1000,
        distanceInterval: 1,
      },
      (location) => {
        const { latitude, longitude, accuracy } = location.coords;
        if (!resolved && accuracy && accuracy < ACCURATE_LOCATION_MAX_ACCURACY_M) {
          resolved = true;
          clearTimeout(timeout);
          subscription?.remove();
          resolve({ latitude, longitude });
        }
      },
    )
      .then((sub) => {
        subscription = sub;
      })
      .catch(() => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve(null);
        }
      });
  });
}

async function tryReadFreshDeviceCoords(
  timeoutMs: number,
): Promise<{ latitude: number; longitude: number } | null> {
  const coords = await getAccurateLocation(timeoutMs);
  if (coords) return coords;

  try {
    const lastKnown = await Location.getLastKnownPositionAsync();
    if (lastKnown?.coords) {
      const { latitude, longitude, accuracy } = lastKnown.coords;
      const ageMs = Date.now() - (lastKnown.timestamp ?? 0);
      if (
        isValidCoords(latitude, longitude) &&
        accuracy != null &&
        accuracy < ACCURATE_LOCATION_MAX_ACCURACY_M &&
        ageMs >= 0 &&
        ageMs <= MAX_LAST_KNOWN_AGE_MS
      ) {
        return { latitude, longitude };
      }
    }
  } catch (error) {
    console.warn('getLastKnownPositionAsync failed:', error);
  }

  return null;
}

/**
 * Obtiene coordenadas GPS del dispositivo.
 *
 * Flujo:
 * 1. Verifica que los servicios de ubicación estén activados (sin caché si están apagados).
 * 2. Verifica permisos de ubicación (sin caché si no están concedidos).
 * 3. Intenta lectura GPS nueva; si falla, usa `last_location` con aviso (solo en este caso).
 */
export default async function resolveDeviceCoordinates(
  options?: DeviceCoordsResolveOptions,
): Promise<DeviceCoordsResult> {
  const silent = options?.silent === true;
  const labels = options?.labels ?? DEVICE_COORDS_LABELS_MARCA_INGRESO;
  const gpsTimeoutMs =
    options?.gpsTimeoutMs ?? DEVICE_COORDS_GPS_TIMEOUT_MS_SIGNATURE_DEFAULT;

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

  const freshCoords = await tryReadFreshDeviceCoords(gpsTimeoutMs);
  if (freshCoords) {
    await writeLastLocationFromGps(freshCoords.latitude, freshCoords.longitude, true);
    return {
      ok: true,
      latitude: freshCoords.latitude,
      longitude: freshCoords.longitude,
    };
  }

  const cached = await returnCachedCoordsIfAvailable(silent);
  if (cached) return cached;

  const message =
    'No se pudo obtener la ubicación. Mantén el GPS encendido unos segundos y vuelve a intentar.';
  if (!silent) {
    Alert.alert('Ubicación no disponible', message);
  }
  return { ok: false, message };
}
