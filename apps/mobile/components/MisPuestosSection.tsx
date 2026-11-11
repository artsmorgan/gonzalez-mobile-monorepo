import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import Constants from 'expo-constants';
import * as Network from 'expo-network';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Collapsible } from '@/components/Collapsible';
import PuestoLocationBlock from '@/components/PuestoLocationBlock';
import authedFetch from '@/hooks/authedFetch';
import { misPuestoTitulo, parseMisPuestos, type MiPuesto } from '@/hooks/misPuestos';
import { formatDateDMY } from '@/utils/formatDate';

type Props = {
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<unknown>;
};

async function hasInternet(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    return state.isConnected === true && state.isInternetReachable === true;
  } catch {
    return false;
  }
}

/**
 * «Mis puestos» del módulo Ubicación del puesto: al abrir la sección y con conexión a internet busca los puestos del empleado (según sus marcas de hoy
 * en adelante) y los lista en secciones plegables; cada una, al abrirse, muestra el mapa con la ubicación del puesto y la actual del dispositivo y un
 * botón para llegar con Waze (solo si el puesto tiene coordenadas).
 */
export default function MisPuestosSection({ refreshAccessToken, logout }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [puestos, setPuestos] = useState<MiPuesto[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setMessage(null);
    if (!(await hasInternet())) {
      setMessage('Para buscar tus puestos necesitas conexión a internet.');
      return;
    }
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      setMessage('No se encontró la URL del servidor.');
      return;
    }
    setLoading(true);
    try {
      const response = await authedFetch({
        url: `${apiUrl}/api/puestos/mis-puestos`,
        init: { method: 'GET', headers: { 'Content-Type': 'application/json' } },
        refreshAccessToken,
        logout,
      });
      if (!response) return;
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.status === false) {
        setMessage(String(data?.message ?? 'No se pudieron cargar tus puestos.'));
        return;
      }
      setPuestos(parseMisPuestos(data));
    } catch {
      setMessage('No se pudieron cargar tus puestos. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  }, [refreshAccessToken, logout]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) void load();
  };

  return (
    <ThemedView style={styles.card}>
      <TouchableOpacity style={styles.header} onPress={toggle} activeOpacity={0.85} accessibilityRole="button">
        <Ionicons name="business-outline" size={20} color="#007AFF" />
        <ThemedText style={styles.headerText}>Mis puestos</ThemedText>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color="#007AFF" />
      </TouchableOpacity>

      {open ? (
        <ThemedView style={styles.body}>
          {loading ? (
            <ThemedView style={styles.centered}>
              <ActivityIndicator size="small" color="#007AFF" />
              <ThemedText style={styles.note}>Buscando tus puestos…</ThemedText>
            </ThemedView>
          ) : message ? (
            <>
              <ThemedText style={styles.note}>{message}</ThemedText>
              <TouchableOpacity style={styles.retry} onPress={() => void load()} activeOpacity={0.85}>
                <Ionicons name="refresh" size={16} color="#007AFF" />
                <ThemedText style={styles.retryText}>Reintentar</ThemedText>
              </TouchableOpacity>
            </>
          ) : puestos && puestos.length === 0 ? (
            <ThemedText style={styles.note}>No tienes turnos de hoy en adelante, por eso no hay puestos que mostrar.</ThemedText>
          ) : (
            (puestos ?? []).map((puesto) => (
              <Collapsible key={puesto.id} title={misPuestoTitulo(puesto)}>
                {puesto.sucursal ? <ThemedText style={styles.detail}>Sucursal: {puesto.sucursal.nombre}</ThemedText> : null}
                {puesto.proxima_fecha ? <ThemedText style={styles.detail}>Próximo turno: {formatDateDMY(puesto.proxima_fecha)}</ThemedText> : null}
                <PuestoLocationBlock ubicacion={puesto.ubicacion} puestoNombre={puesto.nombre} initiallyOpen />
              </Collapsible>
            ))
          )}
        </ThemedView>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, backgroundColor: '#FFFFFF', overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 14 },
  headerText: { flex: 1, fontSize: 16, fontWeight: '700', color: '#111827' },
  body: { padding: 12, gap: 8, borderTopWidth: 1, borderTopColor: '#E0E0E0', backgroundColor: '#FFFFFF' },
  centered: { alignItems: 'center', gap: 8, paddingVertical: 8, backgroundColor: 'transparent' },
  note: { fontSize: 14, color: '#4B5563' },
  detail: { fontSize: 13, color: '#374151', marginBottom: 6 },
  retry: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 8 },
  retryText: { color: '#007AFF', fontSize: 14, fontWeight: '600' },
});
