import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Linking, StyleSheet, TouchableOpacity, View } from 'react-native';
import * as Location from 'expo-location';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import { ThemedText } from '@/components/ThemedText';
import OutOfRangeMap from '@/components/OutOfRangeMap';
import { buildWazeLinks, formatCoordinates, parsePuestoPoint, type LatLng } from '@/hooks/puestoLocation';

type Props = {
  /** Coordenadas del puesto (`{ lat, lng }`, números o textos). Sin ellas se avisa que el puesto no las tiene definidas. */
  ubicacion?: { lat?: unknown; lng?: unknown } | null;
  /** Nombre del puesto, solo para el aviso y el enlace. */
  puestoNombre?: string | null;
  /** El mapa se muestra ya abierto (por ejemplo, dentro de una sección que el usuario ya desplegó). */
  initiallyOpen?: boolean;
  /** Texto del botón que abre el mapa. */
  buttonLabel?: string;
};

/** Abre Waze con el puesto como destino: primero la aplicación y, si no se puede, el enlace universal. */
export async function openWazeTo(destino: LatLng): Promise<void> {
  const links = buildWazeLinks(destino);
  try {
    await Linking.openURL(links.app);
    return;
  } catch {
    /* Waze no está instalada o el sistema no abre el esquema: se prueba el enlace universal */
  }
  try {
    await Linking.openURL(links.web);
  } catch {
    Alert.alert('Waze', 'No se pudo abrir Waze. Instálala o abre la ubicación del puesto en otra aplicación de mapas.');
  }
}

/**
 * Ubicación del puesto detrás de un botón: coordenadas del puesto y del dispositivo, mapa con ambos puntos y un botón para ir en Waze.
 * Pide la ubicación actual solo al abrir el mapa (no en segundo plano). Si el puesto no tiene coordenadas, lo dice en vez de ocultar la opción.
 */
export default function PuestoLocationBlock({ ubicacion, puestoNombre, initiallyOpen = false, buttonLabel = 'Mostrar ubicación del puesto' }: Props) {
  const puesto = parsePuestoPoint(ubicacion);
  const [open, setOpen] = useState(initiallyOpen);
  const [device, setDevice] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationNote, setLocationNote] = useState<string | null>(null);

  const locateDevice = useCallback(async () => {
    setLocating(true);
    setLocationNote(null);
    try {
      let perm = await Location.getForegroundPermissionsAsync();
      if (!perm.granted) perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        setLocationNote('Sin permiso de ubicación: se muestra solo el puesto.');
        return;
      }
      const gps = await Location.hasServicesEnabledAsync().catch(() => true);
      if (!gps) {
        setLocationNote('El GPS está apagado: se muestra solo el puesto.');
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null);
      const pos = current ?? (await Location.getLastKnownPositionAsync().catch(() => null));
      if (pos?.coords) setDevice({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      else setLocationNote('No se pudo obtener tu ubicación actual: se muestra solo el puesto.');
    } catch {
      setLocationNote('No se pudo obtener tu ubicación actual: se muestra solo el puesto.');
    } finally {
      setLocating(false);
    }
  }, []);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && puesto) void locateDevice();
  };

  React.useEffect(() => {
    if (initiallyOpen && puesto) void locateDevice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.wrap}>
      <TouchableOpacity style={styles.toggle} onPress={toggle} activeOpacity={0.85} accessibilityRole="button">
        <Ionicons name="location-outline" size={18} color="#007AFF" />
        <ThemedText style={styles.toggleText}>{open ? 'Ocultar ubicación del puesto' : buttonLabel}</ThemedText>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color="#007AFF" />
      </TouchableOpacity>

      {open ? (
        <View style={styles.panel}>
          {puesto ? (
            <>
              <View style={styles.coordRow}>
                <View style={[styles.dot, { backgroundColor: '#FF3B30' }]} />
                <ThemedText style={styles.coordText}>
                  {puestoNombre ? `${puestoNombre}: ` : 'Puesto: '}
                  {formatCoordinates(puesto)}
                </ThemedText>
              </View>
              <View style={styles.coordRow}>
                <View style={[styles.dot, { backgroundColor: '#007AFF' }]} />
                <ThemedText style={styles.coordText}>
                  Tu ubicación: {locating ? 'buscando…' : device ? formatCoordinates(device) : 'no disponible'}
                </ThemedText>
                {locating ? <ActivityIndicator size="small" color="#007AFF" /> : null}
              </View>
              {locationNote ? <ThemedText style={styles.note}>{locationNote}</ThemedText> : null}
              <View style={styles.mapBox}>
                <OutOfRangeMap deviceLat={device?.lat ?? null} deviceLng={device?.lng ?? null} puestoLat={puesto.lat} puestoLng={puesto.lng} />
              </View>
              <TouchableOpacity style={styles.wazeButton} onPress={() => void openWazeTo(puesto)} activeOpacity={0.85} accessibilityRole="button">
                <Ionicons name="navigate-outline" size={18} color="#FFFFFF" />
                <ThemedText style={styles.wazeButtonText}>Cómo llegar con Waze</ThemedText>
              </TouchableOpacity>
            </>
          ) : (
            <ThemedText style={styles.note}>Este puesto no tiene coordenadas definidas, por eso no se puede mostrar en el mapa.</ThemedText>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', gap: 8 },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    backgroundColor: '#FFFFFF',
  },
  toggleText: { color: '#007AFF', fontSize: 14, fontWeight: '600' },
  panel: { gap: 8, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E0E0E0', backgroundColor: '#FFFFFF' },
  coordRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  coordText: { flex: 1, fontSize: 13, color: '#333333' },
  note: { fontSize: 13, color: '#666666' },
  mapBox: { alignItems: 'center' },
  wazeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#1D8FC7',
  },
  wazeButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
