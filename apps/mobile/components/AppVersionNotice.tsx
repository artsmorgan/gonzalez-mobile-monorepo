import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import { ThemedText } from '@/components/ThemedText';
import { getEmbeddedAppVersionInfo } from '@/hooks/appVariant';
import { pickApkAbi } from '@/hooks/apkAbi';
import { isNewerAppVersion } from '@/hooks/versionCompare';
import { downloadAndShareLargeFile } from '@/hooks/downloadReportFileToDevice';

type PublishedVersion = {
  version?: string;
  name?: string;
  title?: string;
  description?: string;
  created_at?: string;
  notas?: Array<string | { title?: string; description?: string }>;
};

type CheckState = 'idle' | 'checking' | 'upToDate' | 'available' | 'error';

const CHECK_TIMEOUT_MS = 15_000;

function noteText(n: string | { title?: string; description?: string }): string {
  return typeof n === 'string' ? n : `${n?.title ? `${n.title}: ` : ''}${n?.description ?? ''}`;
}

/**
 * Versión instalada + búsqueda de una versión nueva y descarga del instalador, para el inicio de sesión. No necesita sesión: `/api/mobile-versions` y
 * `/api/mobile-versions/{versión}` son públicas (la app declara su versión en la cabecera `X-App-Version`, que agrega `installEvidenceFetch`).
 * Se consulta sola al abrirse y también con el botón «Buscar actualización».
 */
export default function AppVersionNotice() {
  const installed = getEmbeddedAppVersionInfo();
  const installedVersion = String(installed.version ?? '').trim() || '—';
  const [state, setState] = useState<CheckState>('idle');
  const [latest, setLatest] = useState<PublishedVersion | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const apiUrl = String(Constants.expoConfig?.extra?.API_SERVER ?? '').replace(/\/+$/, '');

  const check = useCallback(
    async (silent: boolean) => {
      if (!apiUrl) {
        setState('error');
        return;
      }
      setState('checking');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
      try {
        const response = await fetch(`${apiUrl}/api/mobile-versions`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = (await response.json().catch(() => null)) as PublishedVersion | null;
        if (!data?.version) throw new Error('sin versión');
        setLatest(data);
        const newer = isNewerAppVersion(data.version, installedVersion);
        setState(newer ? 'available' : 'upToDate');
        if (!silent && newer) setDetailsOpen(true);
      } catch {
        setState('error');
        if (!silent) Alert.alert('Sin conexión', 'No se pudo consultar si hay una versión nueva. Revisa tu conexión a internet e inténtalo de nuevo.');
      } finally {
        clearTimeout(timer);
      }
    },
    [apiUrl, installedVersion],
  );

  useEffect(() => {
    void check(true);
  }, [check]);

  const download = async () => {
    const version = String(latest?.version ?? '').trim();
    if (!version || downloading) return;
    setDownloading(true);
    try {
      const abi = pickApkAbi(Device.supportedCpuArchitectures);
      const result = await downloadAndShareLargeFile({
        url: `${apiUrl}/api/mobile-versions/${encodeURIComponent(version)}${abi ? `?abi=${encodeURIComponent(abi)}` : ''}`,
        fileName: abi ? `MonitoreApp-${version}-${abi}.apk` : `MonitoreApp-${version}.apk`,
        mimeType: 'application/vnd.android.package-archive',
        dialogTitle: 'Instalar actualización',
        headers: {},
      });
      if (!result.ok && !result.cancelled) Alert.alert('Error', result.message || 'No se pudo descargar el archivo');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'No se pudo iniciar la descarga del APK');
    } finally {
      setDownloading(false);
    }
  };

  const statusText =
    state === 'checking'
      ? 'Buscando actualizaciones…'
      : state === 'upToDate'
        ? 'Tienes la última versión'
        : state === 'available'
          ? `Hay una versión nueva: ${latest?.version}`
          : state === 'error'
            ? 'No se pudo comprobar si hay una versión nueva'
            : '';

  return (
    <View style={styles.wrap}>
      <ThemedText style={styles.versionText} accessibilityLabel={`Versión de la aplicación ${installedVersion}`}>
        Versión: <ThemedText style={styles.versionStrong}>{installedVersion}</ThemedText>
      </ThemedText>
      {!!statusText && (
        <ThemedText style={[styles.statusText, state === 'available' && styles.statusAvailable, state === 'error' && styles.statusError]}>{statusText}</ThemedText>
      )}
      <View style={styles.actions}>
        {state === 'available' ? (
          <TouchableOpacity style={styles.primaryButton} onPress={() => setDetailsOpen(true)} activeOpacity={0.85}>
            <Ionicons name="download-outline" size={16} color="#FFFFFF" />
            <ThemedText style={styles.primaryButtonText}>Ver y descargar actualización</ThemedText>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.secondaryButton} onPress={() => void check(false)} disabled={state === 'checking'} activeOpacity={0.85}>
            {state === 'checking' ? <ActivityIndicator size="small" color="#007AFF" /> : <Ionicons name="refresh" size={16} color="#007AFF" />}
            <ThemedText style={styles.secondaryButtonText}>Buscar actualización</ThemedText>
          </TouchableOpacity>
        )}
      </View>

      <Modal visible={detailsOpen} animationType="fade" transparent onRequestClose={() => setDetailsOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <ThemedText style={styles.cardTitle}>Nueva versión disponible</ThemedText>
              <TouchableOpacity onPress={() => setDetailsOpen(false)} accessibilityLabel="Cerrar">
                <Ionicons name="close" size={24} color="#333333" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: Dimensions.get('window').height * 0.6 }} contentContainerStyle={styles.cardBody}>
              <ThemedText style={styles.line}>
                <ThemedText style={styles.label}>Versión instalada: </ThemedText>
                {installedVersion}
              </ThemedText>
              <ThemedText style={styles.line}>
                <ThemedText style={styles.label}>Versión disponible: </ThemedText>
                {latest?.version ?? '—'}
              </ThemedText>
              {!!latest?.title && (
                <ThemedText style={styles.line}>
                  <ThemedText style={styles.label}>Título: </ThemedText>
                  {latest.title}
                </ThemedText>
              )}
              {!!latest?.description && (
                <ThemedText style={styles.line}>
                  <ThemedText style={styles.label}>Descripción: </ThemedText>
                  {latest.description}
                </ThemedText>
              )}
              {Array.isArray(latest?.notas) && latest.notas.length > 0 && (
                <View style={{ marginTop: 6 }}>
                  <ThemedText style={[styles.label, { marginBottom: 4 }]}>Notas</ThemedText>
                  {latest.notas.map((n, i) => (
                    <ThemedText key={`n-${i}`} style={styles.line}>
                      - {noteText(n)}
                    </ThemedText>
                  ))}
                </View>
              )}
            </ScrollView>
            <TouchableOpacity
              style={[styles.primaryButton, styles.downloadButton, downloading && { opacity: 0.7 }]}
              onPress={download}
              disabled={downloading}
              activeOpacity={0.85}
            >
              {downloading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="download-outline" size={18} color="#FFFFFF" />}
              <ThemedText style={styles.primaryButtonText}>{downloading ? 'Descargando…' : 'Descargar APK'}</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', alignItems: 'center', gap: 6, marginTop: 8 },
  versionText: { fontSize: 13, color: '#666666' },
  versionStrong: { fontSize: 13, fontWeight: '700', color: '#333333' },
  statusText: { fontSize: 12, color: '#666666', textAlign: 'center' },
  statusAvailable: { color: '#1F6F3D', fontWeight: '600' },
  statusError: { color: '#B42318' },
  actions: { width: '100%', alignItems: 'center' },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    backgroundColor: '#FFFFFF',
  },
  secondaryButtonText: { color: '#007AFF', fontSize: 13, fontWeight: '600' },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#007AFF',
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  downloadButton: { marginTop: 12, alignSelf: 'stretch' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#222222' },
  cardBody: { paddingVertical: 4, gap: 4 },
  line: { fontSize: 14, color: '#333333', lineHeight: 20 },
  label: { fontWeight: '700', color: '#222222' },
});
