import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { eventBus } from './eventBus';
import getHoraAccion from './getHoraAccion';

export const LAST_LOCATION_STORAGE_KEY = 'last_location';
export const LAST_LOCATION_UPDATED_EVENT = 'lastLocationUpdated';

/** Tiempo máximo por ciclo de sondeo (conserva lo último guardado si no hay lectura nueva). */
const LOCATION_POLL_TIMEOUT_MS = 30_000;
const ACCURATE_LOCATION_MAX_ACCURACY_M = 50;

export type LastLocationStored = {
  latitude: number;
  longitude: number;
  updated_at: string;
  location_services_enabled: boolean;
};

function isValidCoords(latitude: unknown, longitude: unknown): boolean {
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)
  );
}

export async function readLastLocationFromStorage(): Promise<LastLocationStored | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_LOCATION_STORAGE_KEY);
    if (!raw?.trim()) return null;
    const parsed = JSON.parse(raw);
    const latitude = Number(parsed.latitude);
    const longitude = Number(parsed.longitude);
    if (!isValidCoords(latitude, longitude)) return null;
    return {
      latitude,
      longitude,
      updated_at: String(parsed.updated_at ?? ''),
      location_services_enabled: parsed.location_services_enabled !== false,
    };
  } catch (error) {
    console.warn('readLastLocationFromStorage failed:', error);
    return null;
  }
}

async function persistLastLocation(data: LastLocationStored): Promise<void> {
  await AsyncStorage.setItem(LAST_LOCATION_STORAGE_KEY, JSON.stringify(data));
}

function emitLastLocationUpdated(): void {
  eventBus.emit(LAST_LOCATION_UPDATED_EVENT);
}

/** Guarda coordenadas nuevas con hora de acción (solo lecturas GPS exitosas). */
export async function writeLastLocationFromGps(
  latitude: number,
  longitude: number,
  locationServicesEnabled = true,
): Promise<void> {
  if (!isValidCoords(latitude, longitude)) return;
  let horaAccion = 0;
  try {
    const server_time = await AsyncStorage.getItem('server_time');
    if (server_time) {
      const server_time_obj = JSON.parse(server_time);
      const t = parseInt(String(server_time_obj.server_time), 10);
      if (Number.isFinite(t)) {
        horaAccion = t;
      }
    }
  } catch (error) {
    console.error('Error getting hora accion:', error);
    horaAccion = Date.now();
  }
  await persistLastLocation({
    latitude,
    longitude,
    updated_at: String(horaAccion),
    location_services_enabled: locationServicesEnabled,
  });
  emitLastLocationUpdated();
}

async function getCoordsWithinPollTimeout(): Promise<{ latitude: number; longitude: number } | null> {
  return new Promise((resolve) => {
    let resolved = false;
    let subscription: Location.LocationSubscription | null = null;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        subscription?.remove();
        resolve(null);
      }
    }, LOCATION_POLL_TIMEOUT_MS);

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

/**
 * Sondeo silencioso de GPS (sin Alert). Guarda en `last_location` o conserva la última lectura.
 */
let updateLastLocationInFlight: Promise<void> | null = null;

export default async function updateLastLocation(): Promise<void> {
  if (updateLastLocationInFlight) {
    return updateLastLocationInFlight;
  }

  updateLastLocationInFlight = (async () => {
    try {
      const previous = await readLastLocationFromStorage();
      const isLocationEnabled = await Location.hasServicesEnabledAsync();

      if (!isLocationEnabled) {
        if (previous) {
          await persistLastLocation({
            ...previous,
            location_services_enabled: false,
          });
        }
        emitLastLocationUpdated();
        return;
      }

      let permissionGranted = false;
      try {
        const current = await Location.getForegroundPermissionsAsync();
        if (current.status === 'granted') {
          permissionGranted = true;
        } else {
          const requested = await Location.requestForegroundPermissionsAsync();
          permissionGranted = requested.status === 'granted';
        }
      } catch (error) {
        console.warn('updateLastLocation permission check failed:', error);
      }

      if (!permissionGranted) {
        if (previous) {
          await persistLastLocation({
            ...previous,
            location_services_enabled: true,
          });
        }
        emitLastLocationUpdated();
        return;
      }

      let coords = await getCoordsWithinPollTimeout();

      if (!coords) {
        try {
          const lastKnown = await Location.getLastKnownPositionAsync();
          if (lastKnown?.coords && isValidCoords(lastKnown.coords.latitude, lastKnown.coords.longitude)) {
            coords = {
              latitude: lastKnown.coords.latitude,
              longitude: lastKnown.coords.longitude,
            };
          }
        } catch (error) {
          console.warn('updateLastLocation getLastKnownPositionAsync failed:', error);
        }
      }

      if (coords) {
        await writeLastLocationFromGps(coords.latitude, coords.longitude, true);
        return;
      }

      if (previous) {
        await persistLastLocation({
          ...previous,
          location_services_enabled: true,
        });
      }

      emitLastLocationUpdated();
    } catch (error) {
      console.error('Error updating last location:', error);
      emitLastLocationUpdated();
    }
  })();

  try {
    await updateLastLocationInFlight;
  } finally {
    updateLastLocationInFlight = null;
  }
}
