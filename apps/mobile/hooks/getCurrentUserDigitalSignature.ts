import { Alert } from 'react-native';
import * as Location from 'expo-location';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';
import getHoraAccion from './getHoraAccion';

const LOCATION_TIMEOUT_MS = 15_000;

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
 * Obtiene coordenadas para la firma digital sin dejar estado global roto.
 * Cada intento es independiente: si falla, el usuario puede reintentar tras activar GPS.
 */
async function resolveSignatureCoordinates(): Promise<{ latitude: number; longitude: number } | null> {
  const isLocationEnabled = await Location.hasServicesEnabledAsync();
  if (!isLocationEnabled) {
    promptEnableLocation(
      'Los servicios de ubicación están apagados. Actívalos y vuelve a pulsar Generar.',
    );
    return null;
  }

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    promptEnableLocation(
      'Se necesita permiso de ubicación para generar la firma. Concede el permiso y vuelve a pulsar Generar.',
    );
    return null;
  }

  try {
    const location = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('LOCATION_TIMEOUT')), LOCATION_TIMEOUT_MS);
      }),
    ]);

    const { latitude, longitude } = location.coords;
    if (isValidCoords(latitude, longitude)) {
      return { latitude, longitude };
    }
  } catch (error) {
    console.warn('getCurrentPositionAsync failed, trying last known position:', error);
  }

  try {
    const lastKnown = await Location.getLastKnownPositionAsync();
    if (lastKnown?.coords) {
      const { latitude, longitude } = lastKnown.coords;
      if (isValidCoords(latitude, longitude)) {
        return { latitude, longitude };
      }
    }
  } catch (error) {
    console.warn('getLastKnownPositionAsync failed:', error);
  }

  Alert.alert(
    'Ubicación no disponible',
    'No se pudo obtener la ubicación. Activa el GPS, espera unos segundos y vuelve a pulsar Generar.',
    [{ text: 'Aceptar', style: 'default' }],
  );
  return null;
}

export default async function getCurrentUserDigitalSignature(employee: any): Promise<string | null> {
  console.log(' ++++++++++++++++++++++++++++++++++++++++++ getCurrentUserDigitalSignature');
  if (!employee) {
    Alert.alert('Error', 'No se pudo obtener la información del empleado');
    return null;
  }

  const coords = await resolveSignatureCoordinates();
  if (!coords) {
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

  const empleadoId = String(employee.id);
  return btoa(`${sessionId}:${empleadoId}:${coords.latitude}:${coords.longitude}:${timestamp}`);
}
