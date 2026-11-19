import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Linking, Modal, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import * as Location from 'expo-location';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import { ThemedText } from '@/components/ThemedText';
import OutOfRangeMap from '@/components/OutOfRangeMap';
import { buildMapAppOptions, formatCoordinates, parsePuestoPoint, type LatLng, type MapAppOption } from '@/hooks/puestoLocation';

type Props = {
  /** Coordenadas del puesto (`{ lat, lng }`, números o textos). Sin ellas se avisa que el puesto no tiene coordenadas definidas. */
  ubicacion?: { lat?: unknown; lng?: unknown } | null;
  /** Nombre del puesto, para el título de la ventana y el destino en el mapa. */
  puestoNombre?: string | null;
  /** Texto del botón que abre la ventana con el mapa. */
  buttonLabel?: string;
};

/** Abre la aplicación elegida (con su enlace alterno si la primera no abre). */
export async function openMapApp(option: MapAppOption): Promise<void> {
  const urls = [option.url, ...(option.fallbackUrl ? [option.fallbackUrl] : [])];
  for (const url of urls) {
    try {
      await Linking.openURL(url);
      return;
    } catch {
      /* se prueba el siguiente enlace */
    }
  }
  Alert.alert(option.label, 'No se pudo abrir esa aplicación. Elige otra o instálala en el teléfono.');
}

/**
 * Ubicación del puesto en una ventana flotante: coordenadas del puesto y del dispositivo, el mapa con ambos puntos y un botón «Cómo llegar» que deja elegir con
 * qué aplicación de mapas abrirlo (Google Maps, Waze u otra instalada en el teléfono). El mapa va en una ventana propia, fuera de la pantalla que se desplaza,
 * para poder moverlo y acercarlo sin chocar con el desplazamiento vertical. La ubicación actual se pide al abrir la ventana.
 */
export default function PuestoLocationBlock({ ubicacion, puestoNombre, buttonLabel = 'Mostrar ubicación del puesto' }: Props) {
  const puesto = parsePuestoPoint(ubicacion);
  const [open, setOpen] = useState(false);
  const [choosing, setChoosing] = useState(false);
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

  const openWindow = () => {
    setChoosing(false);
    setOpen(true);
    if (puesto) void locateDevice();
  };

  const options = puesto ? buildMapAppOptions(puesto, device, puestoNombre, Platform.OS) : [];
  const mapHeight = Math.round(Dimensions.get('window').height * 0.5);

  return (
    <View style={styles.wrap}>
      <TouchableOpacity style={styles.toggle} onPress={openWindow} activeOpacity={0.85} accessibilityRole="button">
        <Ionicons name="location-outline" size={18} color="#007AFF" />
        <ThemedText style={styles.toggleText}>{buttonLabel}</ThemedText>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.window}>
            <View style={styles.header}>
              <ThemedText style={styles.title} numberOfLines={2}>
                {puestoNombre ? `Ubicación de ${puestoNombre}` : 'Ubicación del puesto'}
              </ThemedText>
              <TouchableOpacity onPress={() => setOpen(false)} accessibilityLabel="Cerrar">
                <Ionicons name="close" size={24} color="#333333" />
              </TouchableOpacity>
            </View>

            {puesto ? (
              choosing ? (
                <View style={styles.body}>
                  <ThemedText style={styles.subtitle}>¿Con qué aplicación quieres abrir el mapa?</ThemedText>
                  {options.map((option) => (
                    <TouchableOpacity key={option.id} style={styles.option} onPress={() => void openMapApp(option)} activeOpacity={0.85} accessibilityRole="button">
                      <Ionicons name="navigate-outline" size={20} color="#007AFF" />
                      <View style={styles.optionText}>
                        <ThemedText style={styles.optionTitle}>{option.label}</ThemedText>
                        <ThemedText style={styles.optionDetail}>{option.detalle}</ThemedText>
                      </View>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity style={styles.back} onPress={() => setChoosing(false)} activeOpacity={0.85}>
                    <Ionicons name="arrow-back" size={16} color="#007AFF" />
                    <ThemedText style={styles.backText}>Volver al mapa</ThemedText>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.body}>
                  <View style={styles.coordRow}>
                    <View style={[styles.dot, { backgroundColor: '#FF3B30' }]} />
                    <ThemedText style={styles.coordText}>Puesto: {formatCoordinates(puesto)}</ThemedText>
                  </View>
                  <View style={styles.coordRow}>
                    <View style={[styles.dot, { backgroundColor: '#007AFF' }]} />
                    <ThemedText style={styles.coordText}>Tu ubicación: {locating ? 'buscando…' : device ? formatCoordinates(device) : 'no disponible'}</ThemedText>
                    {locating ? <ActivityIndicator size="small" color="#007AFF" /> : null}
                  </View>
                  {locationNote ? <ThemedText style={styles.note}>{locationNote}</ThemedText> : null}
                  <View style={styles.mapBox}>
                    <OutOfRangeMap
                      deviceLat={device?.lat ?? null}
                      deviceLng={device?.lng ?? null}
                      puestoLat={puesto.lat}
                      puestoLng={puesto.lng}
                      style={{ width: '100%', height: mapHeight, marginTop: 0, marginBottom: 0 }}
                    />
                  </View>
                  <TouchableOpacity style={styles.go} onPress={() => setChoosing(true)} activeOpacity={0.85} accessibilityRole="button">
                    <Ionicons name="navigate-outline" size={18} color="#FFFFFF" />
                    <ThemedText style={styles.goText}>Cómo llegar</ThemedText>
                  </TouchableOpacity>
                </View>
              )
            ) : (
              <View style={styles.body}>
                <ThemedText style={styles.note}>Este puesto no tiene coordenadas definidas, por eso no se puede mostrar en el mapa.</ThemedText>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
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
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  window: { backgroundColor: '#FFFFFF', borderRadius: 12, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: 14, borderBottomWidth: 1, borderBottomColor: '#E0E0E0', backgroundColor: '#FFFFFF' },
  title: { flex: 1, fontSize: 16, fontWeight: '700', color: '#111827' },
  body: { padding: 14, gap: 10, backgroundColor: '#FFFFFF' },
  subtitle: { fontSize: 14, color: '#374151', fontWeight: '600' },
  coordRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  coordText: { flex: 1, fontSize: 13, color: '#333333' },
  note: { fontSize: 13, color: '#666666' },
  mapBox: { width: '100%', borderRadius: 8, overflow: 'hidden' },
  go: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 8, backgroundColor: '#007AFF' },
  goText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E0E0E0', backgroundColor: '#FFFFFF' },
  optionText: { flex: 1, backgroundColor: 'transparent' },
  optionTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  optionDetail: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 8 },
  backText: { color: '#007AFF', fontSize: 14, fontWeight: '600' },
});
