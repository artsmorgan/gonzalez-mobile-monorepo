import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { deleteFile, getLocalFileDisplayUri, saveFile } from '@/hooks/fileStorage';
import type { StoredFileType } from '@/hooks/fileStorage';
import { loadPuestoArticulosForTable, resolveTargetMantenimientoForForm } from '@/hooks/puestoArticulosSync';
import {
  type ArticuloMantenimientoPendingFile,
  type ArticuloMantenimientoRemoteFile,
  remoteArchivosFromUltimoMantenimiento,
} from '@/utils/articuloMantenimientoFiles';

type FilePickKind = 'image' | 'audio' | 'video' | 'document';

function storageTypeFor(kind: FilePickKind): StoredFileType {
  if (kind === 'document') return 'text';
  return kind;
}

function ModalAudioPlayer({ sourceUrl, label }: { sourceUrl: string; label?: string }) {
  const player = useAudioPlayer(sourceUrl);
  const status = useAudioPlayerStatus(player);
  const [isPlaying, setIsPlaying] = useState(false);
  const duration = status.duration ?? 0;
  const position = status.currentTime ?? 0;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const togglePlayPause = () => {
    if (!player) return;
    try {
      if (!isPlaying) {
        player.play();
        setIsPlaying(true);
      } else {
        player.pause();
        setIsPlaying(false);
      }
    } catch {
      Alert.alert('Error', 'No se pudo reproducir el audio');
    }
  };

  return (
    <View style={styles.mediaRow}>
      <TouchableOpacity onPress={togglePlayPause} style={styles.mediaPlayBtn}>
        <Ionicons name={isPlaying ? 'pause' : 'play'} size={22} color="#FFFFFF" />
      </TouchableOpacity>
      <ThemedText style={styles.mediaLabel} numberOfLines={1}>
        {label || 'Audio'} ({formatTime(position)} / {formatTime(duration)})
      </ThemedText>
    </View>
  );
}

function ModalVideoPlayer({ sourceUrl }: { sourceUrl: string }) {
  const player = useVideoPlayer(sourceUrl, (p) => {
    p.loop = false;
  });
  return (
    <View style={styles.videoWrap}>
      <VideoView style={styles.video} player={player} nativeControls allowsFullscreen={false} />
    </View>
  );
}

export type ArticuloMantenimientoArchivosModalProps = {
  visible: boolean;
  onClose: () => void;
  puestoId: number;
  articuloId: number;
  articuloNombre: string;
  /** Estado actual del formulario: determina si se crea o actualiza mantenimiento. */
  formEstado: string;
  ultimoMantenimientoId?: number | null;
  pendingFiles: ArticuloMantenimientoPendingFile[];
  onPendingFilesChange: (files: ArticuloMantenimientoPendingFile[]) => void;
  accessToken?: string | null;
};

export default function ArticuloMantenimientoArchivosModal({
  visible,
  onClose,
  puestoId,
  articuloId,
  articuloNombre,
  formEstado,
  ultimoMantenimientoId = null,
  pendingFiles,
  onPendingFilesChange,
  accessToken,
}: ArticuloMantenimientoArchivosModalProps) {
  const [remoteFiles, setRemoteFiles] = useState<ArticuloMantenimientoRemoteFile[]>([]);
  const [loadingRemote, setLoadingRemote] = useState(false);
  const [resolvedMantId, setResolvedMantId] = useState<number | null>(ultimoMantenimientoId);
  const [isNewTargetRecord, setIsNewTargetRecord] = useState(false);

  const loadRemoteFiles = useCallback(async () => {
    if (!puestoId || !articuloId) return;
    setLoadingRemote(true);
    try {
      const list = await loadPuestoArticulosForTable(Number(puestoId));
      const art = list.find((a: any) => Number(a?.id) === Number(articuloId));
      const resolved = resolveTargetMantenimientoForForm(art, { estado: formEstado });
      setIsNewTargetRecord(resolved.isNewRecord);

      if (resolved.isNewRecord || !resolved.target) {
        setResolvedMantId(null);
        setRemoteFiles([]);
        return;
      }

      setResolvedMantId(resolved.targetId ?? ultimoMantenimientoId);
      setRemoteFiles(remoteArchivosFromUltimoMantenimiento(resolved.target));
    } catch {
      setRemoteFiles([]);
    } finally {
      setLoadingRemote(false);
    }
  }, [puestoId, articuloId, formEstado, ultimoMantenimientoId]);

  useEffect(() => {
    if (visible) {
      void loadRemoteFiles();
    }
  }, [visible, loadRemoteFiles]);

  const buildRemoteUrl = (file: ArticuloMantenimientoRemoteFile) => {
    const mantId = resolvedMantId;
    if (!mantId || mantId <= 0) return '';
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) return '';
    const appendToken = (url: string) => {
      if (!accessToken?.trim()) return url;
      if (/[?&]token=/.test(url)) return url;
      return `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(accessToken)}`;
    };
    const t = String(file.type || '').toLowerCase();
    if (t === 'image') {
      return appendToken(`${apiUrl}/api/articulo-mantenimiento/${mantId}/get-image/${encodeURIComponent(file.name)}`);
    }
    if (t === 'audio') {
      return appendToken(`${apiUrl}/api/articulo-mantenimiento/${mantId}/get-audio/${encodeURIComponent(file.name)}`);
    }
    if (t === 'video') {
      return appendToken(`${apiUrl}/api/articulo-mantenimiento/${mantId}/get-video/${encodeURIComponent(file.name)}`);
    }
    return appendToken(`${apiUrl}/api/articulo-mantenimiento/${mantId}/get-file/${encodeURIComponent(file.name)}`);
  };

  const pickFile = async (kind: FilePickKind) => {
    try {
      let pickerTypes: string | string[] = '*/*';
      switch (kind) {
        case 'image':
          pickerTypes = 'image/*';
          break;
        case 'audio':
          pickerTypes = 'audio/*';
          break;
        case 'video':
          pickerTypes = 'video/*';
          break;
        default:
          pickerTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain',
          ];
          break;
      }

      const result = await DocumentPicker.getDocumentAsync({
        type: pickerTypes,
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      let extension = '';
      if (asset.name?.includes('.')) {
        extension = asset.name.split('.').pop() || '';
      } else if (asset.mimeType?.includes('/')) {
        extension = asset.mimeType.split('/').pop() || '';
      }
      const extNorm = (extension || 'dat').replace(/^\./, '');

      const localFileName = await saveFile({
        uri: asset.uri,
        originalName: asset.name || 'archivo',
        extension: extNorm,
        type: storageTypeFor(kind),
        prefix: 'articulo_mantenimiento',
      });

      const newFile: ArticuloMantenimientoPendingFile = {
        id: `local_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        type: kind,
        name: asset.name || `archivo.${extNorm}`,
        extension: extNorm,
        localFileName,
        mimeType: asset.mimeType,
      };
      onPendingFilesChange([...pendingFiles, newFile]);
    } catch (e) {
      console.error('Error picking file:', e);
      Alert.alert('Error', 'No se pudo seleccionar el archivo.');
    }
  };

  const removePending = async (file: ArticuloMantenimientoPendingFile) => {
    if (file.localFileName) {
      try {
        await deleteFile(file.localFileName);
      } catch {
        /* idempotente */
      }
    }
    onPendingFilesChange(pendingFiles.filter((f) => f.id !== file.id));
  };

  const renderRemoteFile = (file: ArticuloMantenimientoRemoteFile) => {
    const t = String(file.type || '').toLowerCase();
    const label = file.original_name || file.name;

    const localUri =
      file.id_local && file.name ? getLocalFileDisplayUri(file.name) : '';
    const url = localUri || buildRemoteUrl(file);

    if (t === 'image' && url) {
      return <Image source={{ uri: url }} style={styles.previewImage} resizeMode="contain" />;
    }
    if (t === 'audio' && url) {
      return <ModalAudioPlayer sourceUrl={url} label={label} />;
    }
    if (t === 'video' && url) {
      return <ModalVideoPlayer sourceUrl={url} />;
    }
    return (
      <TouchableOpacity
        style={styles.docRow}
        onPress={() => {
          if (url) Linking.openURL(url);
          else Alert.alert('Sin conexión', 'No hay URL disponible para este archivo.');
        }}
      >
        <Ionicons name="document-text-outline" size={20} color="#007AFF" />
        <ThemedText style={styles.docText} numberOfLines={1}>
          {label}
        </ThemedText>
        <Ionicons name="download-outline" size={20} color="#007AFF" />
      </TouchableOpacity>
    );
  };

  const renderPendingFile = (file: ArticuloMantenimientoPendingFile) => {
    const uri = getLocalFileDisplayUri(file.localFileName);
    const t = file.type;

    return (
      <View style={styles.pendingItem}>
        <TouchableOpacity style={styles.deleteFab} onPress={() => void removePending(file)}>
          <Ionicons name="trash" size={18} color="#FF3B30" />
        </TouchableOpacity>
        {t === 'image' && uri ? (
          <Image source={{ uri }} style={styles.previewImage} resizeMode="contain" />
        ) : t === 'audio' && uri ? (
          <ModalAudioPlayer sourceUrl={uri} label={file.name} />
        ) : t === 'video' && uri ? (
          <ModalVideoPlayer sourceUrl={uri} />
        ) : (
          <View style={styles.docRow}>
            <Ionicons name="document-text-outline" size={20} color="#007AFF" />
            <ThemedText style={styles.docText} numberOfLines={1}>
              {file.name}
            </ThemedText>
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <ThemedView style={styles.card}>
          <View style={styles.header}>
            <ThemedText style={styles.title}>Archivos del artículo</ThemedText>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color="#333" />
            </TouchableOpacity>
          </View>
          <ThemedText style={styles.subtitle} numberOfLines={2}>
            {articuloNombre}
          </ThemedText>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
            <ThemedText style={styles.sectionTitle}>
              {isNewTargetRecord
                ? 'Registro de mantenimiento (nuevo al guardar)'
                : 'Archivos del registro de mantenimiento'}
            </ThemedText>
            {isNewTargetRecord ? (
              <ThemedText style={styles.emptyHint}>
                Al guardar se creará un nuevo registro de mantenimiento. Los archivos previos del
                último registro no se muestran aquí.
              </ThemedText>
            ) : null}
            {loadingRemote ? (
              <ActivityIndicator size="small" color="#007AFF" style={{ marginVertical: 12 }} />
            ) : remoteFiles.length === 0 ? (
              <ThemedText style={styles.emptyHint}>
                {isNewTargetRecord
                  ? 'Sin archivos en el registro nuevo.'
                  : 'No hay archivos en el registro de mantenimiento actual.'}
              </ThemedText>
            ) : (
              remoteFiles.map((f) => (
                <View key={`${f.id}-${f.name}-${f.id_local || ''}`} style={styles.remoteItem}>
                  {renderRemoteFile(f)}
                </View>
              ))
            )}

            <ThemedText style={[styles.sectionTitle, { marginTop: 20 }]}>Nuevos archivos</ThemedText>
            <View style={styles.addRow}>
              <TouchableOpacity style={styles.addBtn} onPress={() => void pickFile('image')}>
                <Ionicons name="image-outline" size={20} color="#007AFF" />
                <ThemedText style={styles.addBtnText}>Foto</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addBtn} onPress={() => void pickFile('video')}>
                <Ionicons name="videocam-outline" size={20} color="#007AFF" />
                <ThemedText style={styles.addBtnText}>Video</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addBtn} onPress={() => void pickFile('audio')}>
                <Ionicons name="mic-outline" size={20} color="#007AFF" />
                <ThemedText style={styles.addBtnText}>Audio</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addBtn} onPress={() => void pickFile('document')}>
                <Ionicons name="document-outline" size={20} color="#007AFF" />
                <ThemedText style={styles.addBtnText}>Archivo</ThemedText>
              </TouchableOpacity>
            </View>

            {pendingFiles.length === 0 ? (
              <ThemedText style={styles.emptyHint}>Sin archivos nuevos por subir.</ThemedText>
            ) : (
              pendingFiles.map((f) => <View key={f.id}>{renderPendingFile(f)}</View>)
            )}
          </ScrollView>

          <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
            <ThemedText style={styles.doneBtnText}>Listo</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 820,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    maxHeight: '92%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  title: { fontSize: 18, fontWeight: '700', color: '#111' },
  subtitle: { fontSize: 14, color: '#666', paddingHorizontal: 16, marginBottom: 8 },
  body: { maxHeight: '75%' },
  bodyContent: { paddingHorizontal: 16, paddingBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#333', marginBottom: 8 },
  emptyHint: { fontSize: 13, color: '#888', fontStyle: 'italic', marginBottom: 8 },
  addRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    backgroundColor: '#F0F8FF',
  },
  addBtnText: { color: '#007AFF', fontSize: 13, fontWeight: '600' },
  remoteItem: { marginBottom: 10 },
  pendingItem: { marginBottom: 12, position: 'relative' },
  deleteFab: {
    position: 'absolute',
    top: 4,
    right: 4,
    zIndex: 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 4,
    elevation: 2,
  },
  previewImage: { width: '100%', height: 180, borderRadius: 8, backgroundColor: '#EEE' },
  mediaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  mediaPlayBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaLabel: { flex: 1, fontSize: 13, color: '#333' },
  videoWrap: { width: '100%', borderRadius: 8, overflow: 'hidden', backgroundColor: '#000' },
  video: { width: '100%', height: 200 },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
  },
  docText: { flex: 1, fontSize: 13, color: '#333' },
  doneBtn: {
    margin: 16,
    marginTop: 8,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  doneBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 16 },
});
