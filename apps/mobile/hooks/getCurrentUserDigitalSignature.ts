import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';
import getHoraAccion from './getHoraAccion';
import resolveDeviceCoordinates, {
  DEVICE_COORDS_GPS_TIMEOUT_MS_SCREEN,
  DEVICE_COORDS_GPS_TIMEOUT_MS_SIGNATURE_DEFAULT,
  DEVICE_COORDS_LABELS_DIGITAL_SIGNATURE,
  DEVICE_COORDS_POLL_SILENT,
  DEVICE_COORDS_USER_ACTION,
} from './resolveDeviceCoordinates';

export { DEVICE_COORDS_POLL_SILENT as SIGNATURE_POLL_SILENT };
export { DEVICE_COORDS_USER_ACTION as SIGNATURE_USER_ACTION };
export { DEVICE_COORDS_GPS_TIMEOUT_MS_SCREEN as SIGNATURE_GPS_TIMEOUT_SCREEN_MS };
export { DEVICE_COORDS_GPS_TIMEOUT_MS_SIGNATURE_DEFAULT as SIGNATURE_GPS_TIMEOUT_DEFAULT_MS };

/** Firma en DigitalSignatureScreen / LunchTimeScreen (10 s). */
export const SIGNATURE_USER_ACTION_SCREEN = {
  silent: false as const,
  gpsTimeoutMs: DEVICE_COORDS_GPS_TIMEOUT_MS_SCREEN,
};

export const SIGNATURE_POLL_SILENT_SCREEN = {
  silent: true as const,
  gpsTimeoutMs: DEVICE_COORDS_GPS_TIMEOUT_MS_SCREEN,
};

export type DigitalSignatureOptions = {
  /** `true` = sondeo periódico, sin Alert de caché. `false` = acción del usuario (default). */
  silent?: boolean;
  /** Ms esperando GPS antes de caché/error. Default: 20 s (módulos generales). */
  gpsTimeoutMs?: number;
};

/**
 * Firma digital con coordenadas GPS.
 * Exige servicios de ubicación activos; `last_location` solo si el intento GPS falla con GPS encendido.
 * Por defecto (`silent: false`): acción del usuario → Alert si usa coordenadas en caché.
 */
export default async function getCurrentUserDigitalSignature(
  employee: unknown,
  options?: DigitalSignatureOptions,
): Promise<string | null> {
  const silent = options?.silent === true;

  if (!employee || typeof employee !== 'object') {
    if (!silent) {
      Alert.alert('Error', 'No se pudo obtener la información del empleado');
    }
    return null;
  }

  const coordsResult = await resolveDeviceCoordinates({
    silent,
    labels: DEVICE_COORDS_LABELS_DIGITAL_SIGNATURE,
    gpsTimeoutMs:
      options?.gpsTimeoutMs ?? DEVICE_COORDS_GPS_TIMEOUT_MS_SIGNATURE_DEFAULT,
  });
  if (!coordsResult.ok) {
    return null;
  }

  const token = await AsyncStorage.getItem('access_token');
  if (!token) {
    Alert.alert('Error', 'No se pudo obtener el token de sesión');
    return null;
  }

  let sessionId = 'unknown';
  try {
    const decoded: { sessionId?: string } = jwtDecode(token);
    sessionId = decoded.sessionId || 'unknown';
  } catch (error) {
    console.error('Error decoding access token for signature:', error);
    Alert.alert('Error', 'No se pudo leer la sesión. Vuelve a iniciar sesión e intenta de nuevo.');
    return null;
  }

  let timestamp = Date.now();
  try {
    const t = await getHoraAccion();
    if (typeof t === 'number' && Number.isFinite(t)) {
      timestamp = t;
    }
  } catch (error) {
    console.warn('getHoraAccion failed, using local time for signature:', error);
  }

  const empleadoId = String((employee as { id?: unknown }).id);
  const { latitude, longitude } = coordsResult;
  return btoa(`${sessionId}:${empleadoId}:${latitude}:${longitude}:${timestamp}`);
}
