import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Network from 'expo-network';
import { Picker } from '@react-native-picker/picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ThemedText } from './ThemedText';
import JobManualQuizEditor from './JobManualQuizEditor';
import { ManualAudioPlayer, ManualImageViewer, ManualVideoPlayer } from './ManualFilePreview';
import { downloadAuthedUrlToDevice } from '../hooks/downloadReportFileToDevice';
import { deleteFile, getFile, getLocalFileDisplayUri, saveFile, type StoredFileType } from '../hooks/fileStorage';
import { deleteJobManualFile, editJobManual } from '../hooks/jobManualsFunctions';
import { quizSummary } from '../hooks/jobManualQuiz';
import {
  DELETE_FILE_CONFIRM,
  NEW_VERSION_QUESTION,
  NEW_VERSION_WARNING_TITLE,
  OFFLINE_EDIT_MESSAGE,
  QUIZ_FORCES_VERSION_NOTE,
  buildEditBody,
  describeEditResult,
  effectiveNewVersion,
  formFromManual,
  isQuizModified,
  newVersionWarning,
  validateEditForm,
  type EditForm,
  type EditableManual,
  type NewFilePayload,
} from '../hooks/jobManualEdit';

type ManualFile = { id: number; type: string; name: string; original_name?: string; extension: string };
export type ManualForEdit = EditableManual & { files?: ManualFile[] };
type NewFileType = NewFilePayload['type'];
type StagedFile = { id: string; type: NewFileType; name: string; extension: string; localFileName: string };

type Props = {
  visible: boolean;
  manual: ManualForEdit | null;
  /** Marca activa de quien edita: el servidor comprueba con ella el rol y que la marca es suya. */
  marcaId: number | null;
  classificationOptions: { id: number; nombre: string }[];
  /** URL (con el token) de un archivo del documento en el servidor: la misma que usa el visor de la pantalla. */
  buildFileUrl: (file: ManualFile) => string;
  onClose: () => void;
  /** Se guardó la edición (con o sin versión nueva): la pantalla debe recargar la lista. */
  onSaved: () => void;
  /** Se borró un archivo (al instante): la pantalla debe recargar la lista. */
  onFileDeleted: () => void;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
};

const PICKER_TYPES: Record<NewFileType, string[]> = {
  image: ['image/*'],
  audio: ['audio/*'],
  video: ['video/*'],
  document: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
  ],
};

const ADD_BUTTONS: { type: NewFileType; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { type: 'document', label: 'Documento', icon: 'document-text-outline' },
  { type: 'image', label: 'Imagen', icon: 'image-outline' },
  { type: 'audio', label: 'Audio', icon: 'musical-notes-outline' },
  { type: 'video', label: 'Video', icon: 'videocam-outline' },
];

const iconFor = (type: string): React.ComponentProps<typeof Ionicons>['name'] =>
  type === 'image' ? 'image-outline' : type === 'audio' ? 'musical-notes-outline' : type === 'video' ? 'videocam-outline' : 'document-text-outline';

async function isOnline(): Promise<boolean> {
  try {
    const s = await Network.getNetworkStateAsync();
    return s.isConnected === true && s.isInternetReachable === true;
  } catch {
    return false;
  }
}

/**
 * Ventana flotante de edición de un documento ya subido. Solo con conexión (no hay acciones en cola). Permite corregir título, descripción y clasificación,
 * borrar archivos AL INSTANTE (con confirmación, sin esperar a «Aceptar»), agregar archivos nuevos y editar el quiz. «¿Nueva versión?» es NO por defecto; al
 * elegir SÍ se advierte que todos los usuarios vinculados deberán volver a verlo y firmarlo. Modificar el quiz obliga a nueva versión.
 */
export default function JobManualEditModal({ visible, manual, marcaId, classificationOptions, buildFileUrl, onClose, onSaved, onFileDeleted, refreshAccessToken, logout }: Props) {
  const [form, setForm] = useState<EditForm | null>(null);
  const [files, setFiles] = useState<ManualFile[]>([]);
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    if (visible && manual) {
      setForm(formFromManual(manual));
      setFiles(manual.files ?? []);
      setStaged([]);
      setSaving(false);
      setDeletingId(null);
    }
  }, [visible, manual?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const cleanupStaged = useCallback(async (list: StagedFile[]) => {
    for (const f of list) await deleteFile(f.localFileName).catch(() => {});
  }, []);

  const closeAndCleanup = useCallback(() => {
    void cleanupStaged(staged);
    setStaged([]);
    onClose();
  }, [cleanupStaged, onClose, staged]);

  const quizModified = useMemo(() => (manual && form ? isQuizModified(manual, form) : false), [manual, form]);
  const newVersion = useMemo(() => (manual && form ? effectiveNewVersion(manual, form) : false), [manual, form]);
  const nextVersion = Number(manual?.version ?? 1) + 1;

  const classificationItems = useMemo(() => {
    const names = classificationOptions.map((o) => o.nombre);
    const current = form?.classification ?? '';
    return current && !names.includes(current) ? [...names, current] : names; // una clasificación antigua no se pierde
  }, [classificationOptions, form?.classification]);

  if (!manual || !form) return null;

  const update = (patch: Partial<EditForm>) => setForm((f) => (f ? { ...f, ...patch } : f));

  const pickFile = async (type: NewFileType) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: PICKER_TYPES[type], multiple: false, copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0]!;
      let extension = '';
      if (asset.name?.includes('.')) extension = asset.name.split('.').pop() || '';
      else if (asset.mimeType?.includes('/')) extension = asset.mimeType.split('/').pop() || '';
      const ext = (extension || 'dat').replace(/^\./, '') || 'dat';
      const storedType: StoredFileType = type === 'document' ? 'text' : type;
      // Los archivos pasan por el almacenamiento de la app (expo-files), como en el resto de los formularios de documentos.
      const localFileName = await saveFile({ uri: asset.uri, originalName: asset.name || 'archivo', extension: ext, type: storedType, prefix: 'job_manuals_e' });
      setStaged((prev) => [...prev, { id: `edit_file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, type, name: asset.name || `archivo.${ext}`, extension: ext, localFileName }]);
    } catch (e) {
      console.error('Error picking file for job manual edit:', e);
      Alert.alert('Error', 'No se pudo seleccionar el archivo. Intenta nuevamente.');
    }
  };

  const removeStaged = (f: StagedFile) => {
    void deleteFile(f.localFileName).catch(() => {});
    setStaged((prev) => prev.filter((x) => x.id !== f.id));
  };

  /** Descarga el archivo al dispositivo, igual que en el visor de documentos. */
  const downloadFile = async (f: ManualFile) => {
    try {
      if (!(await isOnline())) {
        Alert.alert('Sin conexión', 'Descargar un archivo requiere conexión a internet.');
        return;
      }
      const url = buildFileUrl(f);
      if (!url) {
        Alert.alert('Error', 'URL inválida para descargar el archivo');
        return;
      }
      const result = await downloadAuthedUrlToDevice({ url, fallbackFileName: f.original_name || f.name, tempPrefix: 'job_manual_edit_file', refreshAccessToken, logout });
      if (result.ok) {
        Alert.alert('Descarga', `Archivo guardado: ${result.fileName}`);
        return;
      }
      if (result.cancelled) return;
      Alert.alert('Error', result.message || 'No se pudo descargar el archivo');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo descargar el archivo');
    }
  };

  /** Vista del archivo: imágenes se ven (y se amplían), audio y video se reproducen, y el resto se descarga. */
  const renderPreview = (type: string, url: string, onDownload?: () => void) => {
    if (!url) return null;
    if (type === 'image') return <ManualImageViewer imageUrl={url} />;
    if (type === 'audio') return <ManualAudioPlayer sourceUrl={url} />;
    if (type === 'video') return <ManualVideoPlayer sourceUrl={url} />;
    return onDownload ? (
      <TouchableOpacity style={styles.downloadRow} onPress={onDownload}>
        <Ionicons name="download-outline" size={20} color="#007AFF" />
        <ThemedText style={styles.downloadText}>Descargar</ThemedText>
      </TouchableOpacity>
    ) : null;
  };

  /** Borrado inmediato: confirmación y luego el servidor; no espera a «Aceptar». */
  const deleteExisting = (f: ManualFile) => {
    Alert.alert('Eliminar archivo', `${f.original_name || f.name}\n\n${DELETE_FILE_CONFIRM}`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            if (!(await isOnline())) {
              Alert.alert('Sin conexión', OFFLINE_EDIT_MESSAGE);
              return;
            }
            if (!marcaId) {
              Alert.alert('Error', 'Necesitas una marca activa para editar documentos.');
              return;
            }
            setDeletingId(f.id);
            try {
              const res = await deleteJobManualFile({ id: manual.id, fileId: f.id, marcaId, refreshAccessToken, logout });
              if (res?.status) {
                setFiles((prev) => prev.filter((x) => x.id !== f.id));
                onFileDeleted();
              } else {
                Alert.alert('Error', res?.message || 'No se pudo eliminar el archivo.');
              }
            } catch (e) {
              console.error('deleteJobManualFile', e);
              Alert.alert('Error', 'No se pudo eliminar el archivo. Revisa tu conexión e inténtalo de nuevo.');
            } finally {
              setDeletingId(null);
            }
          })();
        },
      },
    ]);
  };

  /** «Sí» pide enterarse de lo que implica antes de quedar marcado. */
  const chooseNewVersion = (yes: boolean) => {
    if (!yes) {
      update({ newVersion: false });
      return;
    }
    Alert.alert(NEW_VERSION_WARNING_TITLE, newVersionWarning(nextVersion), [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Entendido, es nueva versión', onPress: () => update({ newVersion: true }) },
    ]);
  };

  const submit = async () => {
    const problem = validateEditForm(form);
    if (problem) {
      Alert.alert('Error', problem);
      return;
    }
    if (!marcaId) {
      Alert.alert('Error', 'Necesitas una marca activa para editar documentos.');
      return;
    }
    if (!(await isOnline())) {
      Alert.alert('Sin conexión', OFFLINE_EDIT_MESSAGE);
      return;
    }

    setSaving(true);
    try {
      const filesPayload: NewFilePayload[] = [];
      for (const f of staged) {
        const stored = await getFile(f.localFileName);
        if (stored.base64) filesPayload.push({ type: f.type, extension: f.extension, original_name: f.name, file_base64: stored.base64 });
      }
      const { body, hasChanges } = buildEditBody({ manual, form: { ...form, newFilesCount: filesPayload.length }, marcaId, files: filesPayload });
      if (!hasChanges) {
        Alert.alert('Sin cambios', 'No hay nada que guardar.');
        return;
      }

      const confirmText = newVersion
        ? `${newVersionWarning(nextVersion)}\n\n¿Publicar los cambios como nueva versión?`
        : '¿Guardar los cambios? Los usuarios no tendrán que volver a firmar.';
      const confirmed = await new Promise<boolean>((resolve) => {
        Alert.alert(newVersion ? NEW_VERSION_WARNING_TITLE : 'Confirmar', confirmText, [
          { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Aceptar', onPress: () => resolve(true) },
        ], { cancelable: true, onDismiss: () => resolve(false) });
      });
      if (!confirmed) return;

      const res = await editJobManual({ id: manual.id, body, refreshAccessToken, logout });
      if (res?.status) {
        const done = describeEditResult(res);
        await cleanupStaged(staged);
        setStaged([]);
        Alert.alert(done.title, done.message);
        onSaved();
        onClose();
      } else {
        Alert.alert('Error', res?.message || 'No se pudo guardar el documento.');
      }
    } catch (e) {
      console.error('editJobManual', e);
      Alert.alert('Error', 'No se pudo guardar el documento. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={closeAndCleanup}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          <View style={styles.titleRow}>
            <ThemedText style={styles.title}>Editar documento</ThemedText>
            <TouchableOpacity onPress={closeAndCleanup} disabled={saving} accessibilityLabel="Cerrar">
              <Ionicons name="close" size={24} color="#333333" />
            </TouchableOpacity>
          </View>
          <ThemedText style={styles.manualTitle} numberOfLines={2}>
            {manual.title}
          </ThemedText>
          <ThemedText style={styles.versionText}>Versión actual: {manual.version ?? 1}</ThemedText>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Título *</ThemedText>
              <TextInput style={styles.formInput} value={form.title} onChangeText={(t) => update({ title: t })} placeholder="Título del documento" placeholderTextColor="#999" editable={!saving} />
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Descripción *</ThemedText>
              <TextInput style={[styles.formInput, styles.textArea]} value={form.description} onChangeText={(t) => update({ description: t })} placeholder="Descripción del documento" placeholderTextColor="#999" multiline numberOfLines={4} editable={!saving} />
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Clasificación (opcional)</ThemedText>
              <View style={styles.pickerWrapper}>
                <Picker selectedValue={form.classification} onValueChange={(v) => update({ classification: String(v) })} enabled={!saving}>
                  <Picker.Item label="Sin clasificar" value="" color="#000000" />
                  {classificationItems.map((name) => (
                    <Picker.Item key={name} label={name} value={name} color="#000000" />
                  ))}
                </Picker>
              </View>
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={styles.sectionLabel}>Archivos</ThemedText>
              {files.length === 0 ? <ThemedText style={styles.muted}>El documento no tiene archivos.</ThemedText> : null}
              {files.map((f) => (
                <View key={f.id} style={styles.fileBlock}>
                  <View style={styles.fileRow}>
                    <Ionicons name={iconFor(f.type)} size={20} color="#555555" />
                    <ThemedText style={styles.fileName} numberOfLines={1}>
                      {f.original_name || f.name}
                    </ThemedText>
                    {deletingId === f.id ? (
                      <ActivityIndicator size="small" color="#FF3B30" />
                    ) : (
                      <TouchableOpacity onPress={() => deleteExisting(f)} disabled={saving || deletingId !== null} accessibilityLabel="Eliminar archivo" style={styles.iconButton}>
                        <Ionicons name="trash-outline" size={22} color="#FF3B30" />
                      </TouchableOpacity>
                    )}
                  </View>
                  {renderPreview(f.type, buildFileUrl(f), () => void downloadFile(f))}
                </View>
              ))}
              <ThemedText style={styles.hint}>Al eliminar un archivo se borra de inmediato, sin esperar a «Aceptar».</ThemedText>
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Agregar archivos nuevos</ThemedText>
              <View style={styles.addRow}>
                {ADD_BUTTONS.map((b) => (
                  <TouchableOpacity key={b.type} style={styles.actionButton} onPress={() => void pickFile(b.type)} disabled={saving}>
                    <Ionicons name={b.icon} size={18} color="#FFFFFF" />
                    <ThemedText style={styles.actionButtonText}>{b.label}</ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
              {staged.map((f) => (
                <View key={f.id} style={styles.fileBlock}>
                  <View style={styles.fileRow}>
                    <Ionicons name={iconFor(f.type)} size={20} color="#007AFF" />
                    <ThemedText style={styles.fileName} numberOfLines={1}>
                      {f.name} (nuevo)
                    </ThemedText>
                    <TouchableOpacity onPress={() => removeStaged(f)} disabled={saving} style={styles.iconButton} accessibilityLabel="Quitar archivo nuevo">
                      <Ionicons name="close-circle-outline" size={22} color="#555555" />
                    </TouchableOpacity>
                  </View>
                  {renderPreview(f.type, getLocalFileDisplayUri(f.localFileName))}
                </View>
              ))}
              {staged.length > 0 ? <ThemedText style={styles.hint}>Los archivos nuevos se suben al pulsar «Aceptar».</ThemedText> : null}
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={styles.sectionLabel}>Quiz</ThemedText>
              <JobManualQuizEditor value={form.quiz} onChange={(quiz) => update({ quiz })} disabled={saving} />
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={styles.sectionLabel}>{NEW_VERSION_QUESTION}</ThemedText>
              <View style={styles.pills}>
                {[false, true].map((yes) => {
                  const active = newVersion === yes;
                  return (
                    <TouchableOpacity
                      key={String(yes)}
                      style={[styles.pill, active && styles.pillActive, quizModified && !yes && styles.pillDisabled]}
                      disabled={saving || quizModified}
                      onPress={() => chooseNewVersion(yes)}
                    >
                      <ThemedText style={[styles.pillText, active && styles.pillTextActive]}>{yes ? 'Sí' : 'No'}</ThemedText>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {quizModified ? <ThemedText style={styles.warning}>{QUIZ_FORCES_VERSION_NOTE}</ThemedText> : null}
              {newVersion && !quizModified ? <ThemedText style={styles.warning}>{newVersionWarning(nextVersion)}</ThemedText> : null}
              {!newVersion ? <ThemedText style={styles.hint}>Sin nueva versión, los usuarios no tienen que volver a firmar. Quiz actual: {quizSummary(form.quiz)}.</ThemedText> : null}
            </View>
          </ScrollView>

          <View style={styles.formActions}>
            <TouchableOpacity style={[styles.formButton, styles.cancelButton]} onPress={closeAndCleanup} disabled={saving}>
              <ThemedText style={styles.formButtonText}>Cancelar</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.formButton, styles.confirmButton, saving && styles.formButtonDisabled]} onPress={() => void submit()} disabled={saving}>
              {saving ? (
                <>
                  <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                  <ThemedText style={styles.formButtonText}>Guardando…</ThemedText>
                </>
              ) : (
                <ThemedText style={styles.formButtonText}>Aceptar</ThemedText>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// Ventana flotante con el mismo diseño de los formularios de «Documentos» (p. ej. «Actualizar puestos»): fondo oscuro translúcido, tarjeta blanca de
// bordes redondeados, etiquetas, campos y botones Cancelar (rojo) / Aceptar (verde) con los mismos colores y medidas.
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  container: { width: '100%', maxWidth: 560, maxHeight: '88%', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, overflow: 'hidden' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  title: { fontSize: 18, fontWeight: 'bold', flex: 1, marginRight: 8 },
  manualTitle: { fontSize: 15, fontWeight: '600', color: '#007AFF', marginBottom: 2 },
  versionText: { fontSize: 13, color: '#555555', marginBottom: 10 },
  scroll: { flexGrow: 0, marginBottom: 8 },
  scrollContent: { paddingBottom: 4 },
  formGroup: { marginBottom: 16 },
  formLabel: { fontSize: 14, fontWeight: '600', marginBottom: 6, color: '#000000' },
  sectionLabel: { fontSize: 16, fontWeight: 'bold', marginBottom: 8, color: '#000000' },
  formInput: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, backgroundColor: '#FFFFFF', color: '#000000' },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  pickerWrapper: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, backgroundColor: '#FFFFFF', overflow: 'hidden' },
  muted: { color: '#777777', fontSize: 14 },
  hint: { color: '#777777', fontSize: 12, marginTop: 6 },
  fileBlock: { borderBottomWidth: 1, borderBottomColor: '#E0E0E0', paddingBottom: 6, marginBottom: 2 },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  downloadRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  downloadText: { fontSize: 13, color: '#007AFF' },
  fileName: { flex: 1, fontSize: 14, color: '#000000' },
  iconButton: { padding: 6 },
  addRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  actionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#007AFF', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8 },
  actionButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: '#E0E0E0', backgroundColor: '#FFFFFF' },
  pillActive: { borderColor: '#007AFF', backgroundColor: '#EAF3FF' },
  pillDisabled: { opacity: 0.4 },
  pillText: { fontSize: 14, color: '#333333' },
  pillTextActive: { color: '#007AFF', fontWeight: '600' },
  warning: { marginTop: 10, padding: 10, borderRadius: 8, backgroundColor: '#FFF4E5', color: '#8A4B00', fontSize: 13, lineHeight: 18 },
  formActions: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 8 },
  formButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8 },
  cancelButton: { backgroundColor: '#FF3B30' },
  confirmButton: { backgroundColor: '#34C759' },
  formButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  formButtonDisabled: { opacity: 0.6 },
});
