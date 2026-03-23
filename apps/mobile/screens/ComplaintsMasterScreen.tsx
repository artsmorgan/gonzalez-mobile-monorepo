import React, { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  View,
  Platform,
  Image,
  Dimensions,
  Linking,
  Modal,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useAuth } from '@/contexts/AuthContext';
import AppHeader from '@/components/AppHeader';
import AppFooter from '@/components/AppFooter';
import SlideMenu from '@/components/SlideMenu';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import * as Network from 'expo-network';
import * as DocumentPicker from 'expo-document-picker';
import * as Location from 'expo-location';
import { jwtDecode } from 'jwt-decode';
import { useQRScanner } from '@/hooks/useQRScanner';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import { createComplaintsMaster, updateComplaintsMaster, deleteComplaintsMaster, deleteComplaintsMasterFile, listComplaintsMasterByCorpo } from '@/hooks/evaluationFunctions';
import { eventBus } from '@/hooks/eventBus';
import getHoraAccion from '@/hooks/getHoraAccion';
import authedFetch from '@/hooks/authedFetch';
import getValidAccessTokenOrLogout from '@/hooks/getValidAccessTokenOrLogout';
import { convertDateTimestampToLocalString } from '@/hooks/convertDateTimestampToLocalString';

type ComplaintsMasterScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ComplaintsMaster'>;

interface Complaint {
  id: string | number;
  id_local: string;
  files?: ComplaintFile[];
  sociedad: string | null;
  nombre_realiza_queja: string | null;
  cliente: string | null;
  empresa_presenta_queja: string | null;
  persona_presenta_queja: string | null;
  medio_recepcion_queja: string | null;
  tipo_queja: string | null;
  ubicacion: string | null;
  nivel_queja: string | null;
  fecha_queja: string | null;
  motivo_queja: string | null;
  descripcion_queja: string | null;
  fecha_inicio: string | null;
  fecha_revision: string | null;
  resolucion_queja: string | null;
  estado: string | null;
  accion_correctiva_preventiva: string | null;
  firma_responsable?: string | null;
  created_at: string;
  synced?: boolean;
}

interface EditingComplaint {
  id: string | number | null;
  id_local: string;
  files?: ComplaintFile[];
  sociedad: string;
  nombre_realiza_queja: string;
  cliente: string;
  empresa_presenta_queja: string;
  persona_presenta_queja: string;
  medio_recepcion_queja: string;
  tipo_queja: string;
  ubicacion: string;
  nivel_queja: string;
  fecha_queja: string;
  motivo_queja: string;
  descripcion_queja: string;
  fecha_inicio: string;
  fecha_revision: string;
  resolucion_queja: string;
  estado: string;
  accion_correctiva_preventiva: string;
  firma_responsable: string;
}

type ComplaintFile = {
  id: number;
  name: string;
  original_name: string;
  type: 'image' | 'audio' | 'video' | 'document' | string;
  extension: string;
};

type LocalFile = {
  id: string;
  type: 'image' | 'audio' | 'video' | 'document';
  name: string;
  extension: string;
  base64: string;
  uri?: string;
  mimeType?: string;
  server_file_id?: number; // para archivos existentes precargados (c_anexos_quejas.id)
};

interface FirmaData {
  sessionId: string;
  empleadoId: string;
  latitud: string;
  longitud: string;
  timestamp: string;
  empleadoDetalle?: {
    nombre: string;
    primer_apellido: string;
    segundo_apellido: string;
  };
}

const buildComplaintFileUrl = (complaintId: string | number, file: ComplaintFile, accessToken?: string | null) => {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) return '';
  const idNum = typeof complaintId === 'number' ? complaintId : parseInt(String(complaintId), 10);
  if (!idNum) return '';
  const appendTokenToUrl = (url: string) => {
    if (!accessToken || accessToken.trim().length === 0) return url;
    if (/[?&]token=/.test(url)) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}token=${encodeURIComponent(accessToken)}`;
  };

  if (file.type === 'image') return appendTokenToUrl(`${apiUrl}/api/complaints-master/${idNum}/get-image/${encodeURIComponent(file.name)}`);
  if (file.type === 'audio') return appendTokenToUrl(`${apiUrl}/api/complaints-master/${idNum}/get-audio/${encodeURIComponent(file.name)}`);
  if (file.type === 'video') return appendTokenToUrl(`${apiUrl}/api/complaints-master/${idNum}/get-video/${encodeURIComponent(file.name)}`);
  return appendTokenToUrl(`${apiUrl}/api/complaints-master/${idNum}/get-file/${encodeURIComponent(file.name)}`);
};

const getComplaintFileDisplayName = (file: ComplaintFile) => {
  if (file.original_name && String(file.original_name).trim().length > 0) return String(file.original_name);
  return file.name;
};

export default function ComplaintsMasterScreen() {
  const { employee, refreshAccessToken, logout, accessToken } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<ComplaintsMasterScreenNavigationProp>();
  const { scanQR, QRScannerComponent } = useQRScanner();

  // Data states
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasCurrentMarca, setHasCurrentMarca] = useState<boolean>(false);

  // Editing state
  const [editingRecord, setEditingRecord] = useState<EditingComplaint | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResponse, setSubmitResponse] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // Creating state
  const [isCreating, setIsCreating] = useState(false);

  // Form states
  const [sociedad, setSociedad] = useState('');
  const [nombreRealizaQueja, setNombreRealizaQueja] = useState('');
  const [cliente, setCliente] = useState('');
  const [empresaPresentaQueja, setEmpresaPresentaQueja] = useState('');
  const [personaPresentaQueja, setPersonaPresentaQueja] = useState('');
  const [medioRecepcionQueja, setMedioRecepcionQueja] = useState('');
  const [tipoQueja, setTipoQueja] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [nivelQueja, setNivelQueja] = useState('');
  const [fechaQueja, setFechaQueja] = useState('');
  const [motivoQueja, setMotivoQueja] = useState('');
  const [descripcionQueja, setDescripcionQueja] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaRevision, setFechaRevision] = useState('');
  const [resolucionQueja, setResolucionQueja] = useState('');
  const [estado, setEstado] = useState('');
  const [accionCorrectivaPreventiva, setAccionCorrectivaPreventiva] = useState('');
  const [imageFiles, setImageFiles] = useState<LocalFile[]>([]);
  const [audioFiles, setAudioFiles] = useState<LocalFile[]>([]);
  const [videoFiles, setVideoFiles] = useState<LocalFile[]>([]);
  const [documentFiles, setDocumentFiles] = useState<LocalFile[]>([]);
  const [isPreloadingEditFiles, setIsPreloadingEditFiles] = useState(false);

  // Firma responsable (requerida por Prisma)
  const [firmaResponsable, setFirmaResponsable] = useState<FirmaData | null>(null);
  const [isGeneratingFirma, setIsGeneratingFirma] = useState(false);

  // Date picker states
  const [showDatePickerQueja, setShowDatePickerQueja] = useState(false);
  const [showDatePickerInicio, setShowDatePickerInicio] = useState(false);
  const [showDatePickerRevision, setShowDatePickerRevision] = useState(false);

  // Expanded details state
  const [expandedRecordIds, setExpandedRecordIds] = useState<string[]>([]);

  // Modal: ver cambios (auditoría)
  const [isCambiosModalVisible, setIsCambiosModalVisible] = useState(false);
  const [cambiosTitle, setCambiosTitle] = useState<string>('Cambios');
  const [cambiosItems, setCambiosItems] = useState<any[]>([]);
  const [expandedCambioId, setExpandedCambioId] = useState<number | null>(null);

  const getConnectionStatus = async (): Promise<boolean> => {
    const networkState = await Network.getNetworkStateAsync();
    return networkState.isConnected && networkState.isInternetReachable ? true : false;
  };

  const closeCambiosModal = () => {
    setIsCambiosModalVisible(false);
    setCambiosItems([]);
    setExpandedCambioId(null);
  };

  const formatCambioCreatedAt = (value: any) => {
    if (!value) return '-';
    try {
      const date = new Date(value);
      return date.toLocaleString('es-CR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
    } catch {
      return String(value);
    }
  };

  const formatChangeValue = (prop: string, value: any): string => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  const fetchCambios = useCallback(async (tabla: string, registroId: number) => {
    const isConnected = await getConnectionStatus();
    if (!isConnected) {
      Alert.alert('Sin conexión', 'Esta función solo está disponible con conexión a internet.');
      return;
    }
    try {
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) throw new Error('Server URL not configured');

      const resp = await authedFetch({
        url: `${apiUrl}/api/cambios-apps-modules?tabla=${encodeURIComponent(tabla)}&registro_id=${registroId}`,
        init: {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        },
        refreshAccessToken,
        logout,
      });
      if (!resp) return;

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.status) {
        throw new Error(data.message || 'No se pudieron cargar los cambios');
      }
      setCambiosItems(Array.isArray(data.data) ? data.data : []);
      setIsCambiosModalVisible(true);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'No se pudieron cargar los cambios');
    }
  }, [refreshAccessToken, logout]);

  const generateRandomId = (): string => {
    return `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatYMDToDMY = (value?: string): string => {
    const v = String(value || '').trim();
    if (!v) return '';
    const onlyDate = v.split('T')[0];
    const ymd = onlyDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (ymd) return `${ymd[3]}-${ymd[2]}-${ymd[1]}`;
    const dmy = onlyDate.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
    if (dmy) return `${dmy[1]}-${dmy[2]}-${dmy[3]}`;
    return onlyDate;
  };

  const parseDateStringToDate = (value?: string): Date => {
    const v = String(value || '').trim();
    if (!v) return new Date();
    const onlyDate = v.split('T')[0];
    const ymd = onlyDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (ymd) return new Date(`${onlyDate}T00:00:00`);
    const dmy = onlyDate.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
    if (dmy) return new Date(`${dmy[3]}-${dmy[2]}-${dmy[1]}T00:00:00`);
    const parsed = new Date(v);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  };

  const handleAddFile = async (type: LocalFile['type']) => {
    try {
      let pickerTypes: string | string[] | undefined;
      switch (type) {
        case 'image':
          pickerTypes = ['image/*']; break;
        case 'audio':
          pickerTypes = ['audio/*']; break;
        case 'video':
          pickerTypes = ['video/*']; break;
        case 'document':
        default:
          pickerTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain',
            'text/csv',
          ];
          break;
      }

      const result = await DocumentPicker.getDocumentAsync({
        type: pickerTypes,
        multiple: false,
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      const response = await fetch(asset.uri);
      const blob = await response.blob();

      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const res = reader.result;
          if (typeof res === 'string') {
            const parts = res.split(',');
            resolve(parts.length > 1 ? parts[1] : parts[0]);
          } else {
            reject(new Error('No se pudo leer el archivo seleccionado'));
          }
        };
        reader.onerror = () => reject(reader.error ?? new Error('Error al leer el archivo seleccionado'));
        reader.readAsDataURL(blob);
      });

      let extension = '';
      if (asset.name && asset.name.includes('.')) extension = asset.name.split('.').pop() || '';
      else if (asset.mimeType && asset.mimeType.includes('/')) extension = asset.mimeType.split('/').pop() || '';

      const localId = `local_file_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const file: LocalFile = {
        id: localId,
        type,
        name: asset.name || `archivo.${extension || 'dat'}`,
        extension: extension || 'dat',
        base64,
        uri: asset.uri,
        mimeType: asset.mimeType,
      };

      if (type === 'image') setImageFiles(prev => [...prev, file]);
      else if (type === 'audio') setAudioFiles(prev => [...prev, file]);
      else if (type === 'video') setVideoFiles(prev => [...prev, file]);
      else setDocumentFiles(prev => [...prev, file]);
    } catch (e) {
      console.error('Error picking file for complaint:', e);
      Alert.alert('Error', 'No se pudo seleccionar el archivo. Intenta nuevamente.');
    }
  };

  const blobToBase64 = async (blob: Blob): Promise<string> => {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const res = reader.result;
        if (typeof res === 'string') {
          const parts = res.split(',');
          resolve(parts.length > 1 ? parts[1] : parts[0]);
        } else {
          reject(new Error('No se pudo leer el archivo'));
        }
      };
      reader.onerror = () => reject(reader.error ?? new Error('Error al leer el archivo'));
      reader.readAsDataURL(blob);
    });
  };

  const preloadExistingFilesForEdit = async (record: Complaint) => {
    try {
      const complaintId = parseInt(String(record.id), 10);
      if (!complaintId) return;
      const existingFiles: ComplaintFile[] = Array.isArray(record.files) ? record.files : [];
      if (existingFiles.length === 0) return;

      setIsPreloadingEditFiles(true);

      const nextImages: LocalFile[] = [];
      const nextAudios: LocalFile[] = [];
      const nextVideos: LocalFile[] = [];
      const nextDocs: LocalFile[] = [];

      for (const f of existingFiles) {
        const url = buildComplaintFileUrl(complaintId, f, accessToken);
        if (!url) continue;

        const resp = await fetch(url);
        if (!resp.ok) continue;

        const blob = await resp.blob();
        const base64 = await blobToBase64(blob);

        const lf: LocalFile = {
          id: `server_${f.id}`,
          type: (f.type as any) || 'document',
          name: f.original_name || f.name,
          extension: f.extension || (f.name.includes('.') ? (f.name.split('.').pop() || 'dat') : 'dat'),
          base64,
          server_file_id: f.id,
        };

        if (lf.type === 'image') nextImages.push(lf);
        else if (lf.type === 'audio') nextAudios.push(lf);
        else if (lf.type === 'video') nextVideos.push(lf);
        else nextDocs.push(lf);
      }

      // Estos arrays representan “todos los adjuntos” que se reenviarán al PUT (replace)
      setImageFiles(nextImages);
      setAudioFiles(nextAudios);
      setVideoFiles(nextVideos);
      setDocumentFiles(nextDocs);
    } catch (err) {
      console.error('Error preloading complaint files:', err);
      Alert.alert('Error', 'No se pudieron cargar los archivos adjuntos para edición');
    } finally {
      setIsPreloadingEditFiles(false);
    }
  };

  const removeLocalFile = (type: LocalFile['type'], id: string) => {
    if (type === 'image') setImageFiles(prev => prev.filter(f => f.id !== id));
    else if (type === 'audio') setAudioFiles(prev => prev.filter(f => f.id !== id));
    else if (type === 'video') setVideoFiles(prev => prev.filter(f => f.id !== id));
    else setDocumentFiles(prev => prev.filter(f => f.id !== id));
  };

  const generateSignature = async () => {
    try {
      setIsGeneratingFirma(true);

      if (!employee?.id) {
        Alert.alert('Error', 'No se pudo obtener el ID del empleado');
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permisos requeridos', 'Se necesita acceso a la ubicación para generar la firma');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const token = await getValidAccessTokenOrLogout({ refreshAccessToken, logout });
      if (!token) return;

      const decoded: any = jwtDecode(token);
      const sessionId = decoded.sessionId || 'unknown';

      const timestamp = await getHoraAccion();
      if (!timestamp) {
        Alert.alert('Error', 'No se pudo obtener la hora');
        return;
      }

      const { latitude, longitude } = location.coords;
      const empleadoId = employee.id.toString();

      // Fetch employee details (opcional)
      let empleadoDetalle = undefined;
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (apiUrl) {
        try {
          const empleadoResponse = await authedFetch({
            url: `${apiUrl}/api/empleados/${empleadoId}`,
            init: {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
              },
            },
            refreshAccessToken,
            logout,
          });
          if (!empleadoResponse) return;

          if (empleadoResponse.ok) {
            const empleadoData = await empleadoResponse.json();
            empleadoDetalle = {
              nombre: empleadoData.nombre,
              primer_apellido: empleadoData.primer_apellido,
              segundo_apellido: empleadoData.segundo_apellido,
            };
          }
        } catch (err) {
          console.error('Error fetching empleado details:', err);
        }
      }

      setFirmaResponsable({
        sessionId,
        empleadoId,
        latitud: latitude.toString(),
        longitud: longitude.toString(),
        timestamp: timestamp.toString(),
        empleadoDetalle,
      });
    } catch (error) {
      console.error('Error generating signature:', error);
      Alert.alert('Error', 'No se pudo generar la firma digital');
    } finally {
      setIsGeneratingFirma(false);
    }
  };

  const setFirmaFromHashIfPossible = async (firmaHash?: string | null) => {
    try {
      if (!firmaHash || String(firmaHash).trim().length === 0) return;
      const decodedData = atob(String(firmaHash));
      const parts = decodedData.split(':');
      if (parts.length !== 5) return;
      const [sessionId, empleadoId, latitud, longitud, timestamp] = parts;

      setFirmaResponsable({
        sessionId,
        empleadoId,
        latitud,
        longitud,
        timestamp,
      });
    } catch {
      // ignore decode errors (firma podría venir en otro formato)
    }
  };

  const handleScanQR = async () => {
    try {
      const qrData = await scanQR();
      if (!qrData) return;

      const decodedData = atob(qrData);
      const parts = decodedData.split(':');
      if (parts.length !== 5) {
        Alert.alert('Error', 'El QR escaneado no tiene el formato correcto');
        return;
      }

      const [sessionId, empleadoId, latitud, longitud, timestamp] = parts;

      let empleadoDetalle = undefined;
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (apiUrl) {
        try {
          const empleadoResponse = await authedFetch({
            url: `${apiUrl}/api/empleados/${empleadoId}`,
            init: {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
              },
            },
            refreshAccessToken,
            logout,
          });
          if (!empleadoResponse) return;

          if (empleadoResponse.ok) {
            const empleadoData = await empleadoResponse.json();
            empleadoDetalle = {
              nombre: empleadoData.nombre,
              primer_apellido: empleadoData.primer_apellido,
              segundo_apellido: empleadoData.segundo_apellido,
            };
          }
        } catch (err) {
          console.error('Error fetching empleado details:', err);
        }
      }

      setFirmaResponsable({ sessionId, empleadoId, latitud, longitud, timestamp, empleadoDetalle });
    } catch (error) {
      console.error('Error scanning QR:', error);
      Alert.alert('Error', 'No se pudo escanear el código QR');
    }
  };

  const deleteAttachedFile = async (file: ComplaintFile) => {
    if (!editingRecord) return;
    const recordId = editingRecord.id || editingRecord.id_local;
    if (!recordId || !file?.id) return;

    Alert.alert(
      'Confirmar',
      '¿Deseas eliminar este archivo adjunto?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const isConnected = await getConnectionStatus();

              // Online: borrar en server
              if (isConnected && editingRecord.id && !String(editingRecord.id).startsWith('local-')) {
                const res = await deleteComplaintsMasterFile({
                  id: String(editingRecord.id),
                  fileId: file.id,
                  refreshAccessToken,
                  logout,
                });
                if (!res.status) {
                  Alert.alert('Error', res.message || 'No se pudo eliminar el archivo');
                  return;
                }
              } else {
                // Offline: encolar acción
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: recordId,
                  action: 'delete_file',
                  type: 'complaints_master',
                  payload: { fileId: file.id },
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));
              }

              // Importante: removerlo de los arrays locales (porque el PUT hará replace)
              setImageFiles(prev => prev.filter(f => f.server_file_id !== file.id));
              setAudioFiles(prev => prev.filter(f => f.server_file_id !== file.id));
              setVideoFiles(prev => prev.filter(f => f.server_file_id !== file.id));
              setDocumentFiles(prev => prev.filter(f => f.server_file_id !== file.id));

              // Actualizar estado local (registro en edición)
              const nextFiles = (editingRecord.files || []).filter(f => f.id !== file.id);
              setEditingRecord(prev => prev ? ({ ...prev, files: nextFiles }) : prev);

              // Actualizar lista visible (complaints)
              setComplaints(prev => prev.map((c) => {
                const cid = c.id || c.id_local;
                if (String(cid) === String(recordId)) {
                  const currentFiles = Array.isArray(c.files) ? c.files : [];
                  return { ...c, files: currentFiles.filter((f2: any) => f2.id !== file.id) };
                }
                return c;
              }));

              // Actualizar cache
              const cacheStr = await AsyncStorage.getItem('evaluations_cache');
              if (cacheStr) {
                const cache = JSON.parse(cacheStr);
                const updatedCache = cache.map((item: any) => {
                  if ((String(item.id) === String(recordId) || String(item.id_local) === String(recordId)) && item.type === 'complaints_master') {
                    const currentFiles = Array.isArray(item.files) ? item.files : [];
                    return { ...item, files: currentFiles.filter((f: any) => f.id !== file.id) };
                  }
                  return item;
                });
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
              }
            } catch (err) {
              console.error('Error deleting attached file:', err);
              Alert.alert('Error', 'No se pudo eliminar el archivo');
            }
          },
        },
      ]
    );
  };

  useFocusEffect(
    useCallback(() => {
      fetchComplaints();
    }, [])
  );

  useEffect(() => {
    const handler = () => {
      fetchComplaints();
    };

    eventBus.on('connectionRestored', handler);
    return () => {
      eventBus.off('connectionRestored', handler);
    };
  }, []);

  const fetchComplaints = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const currentMarca = await AsyncStorage.getItem('current_marca');
      if (!currentMarca) {
        setHasCurrentMarca(false);
        setIsLoading(false);
        return;
      }

      setHasCurrentMarca(true);
      const currentMarcaData = JSON.parse(currentMarca);
      const corpoId = currentMarcaData.corpo?.id?.toString();

      if (!corpoId) {
        setError('No se encontró el ID del corpo');
        setIsLoading(false);
        return;
      }

      const isConnected = await getConnectionStatus();

      if (isConnected) {
        const result = await listComplaintsMasterByCorpo({
          corpo_id: corpoId,
          refreshAccessToken,
          logout,
        });

        if (result.status && result.data) {
          const serverRecords = (result.data as any[]).map((r) => ({
            ...r,
            id_local: r?.id_local || '',
            synced: true,
            type: 'complaints_master',
            files: Array.isArray(r?.files) ? r.files : [],
          }));

          setComplaints(serverRecords as any);

          // Overwrite cache "complaints_master" synced items, keep offline pending items
          const cacheStr = await AsyncStorage.getItem('evaluations_cache');
          const cache = cacheStr ? JSON.parse(cacheStr) : [];
          const nonComplaints = cache.filter((item: any) => item.type !== 'complaints_master');
          const pendingComplaints = cache.filter((item: any) => item.type === 'complaints_master' && (item.synced === false || (item.id_local && String(item.id_local).startsWith('local-'))));
          await AsyncStorage.setItem('evaluations_cache', JSON.stringify([...nonComplaints, ...pendingComplaints, ...serverRecords]));
        } else {
          setComplaints([]);
        }
      } else {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const complaintsCache = cache.filter((item: any) => item.type === 'complaints_master');
          setComplaints(complaintsCache);
        } else {
          setComplaints([]);
        }
      }
    } catch (err) {
      console.error('Error fetching complaints:', err);
      setError('Error al cargar las quejas');
      try {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const complaintsCache = cache.filter((item: any) => item.type === 'complaints_master');
          setComplaints(complaintsCache);
        }
      } catch (cacheErr) {
        console.error('Error loading from cache:', cacheErr);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const startCreating = () => {
    setIsCreating(true);
    setSociedad('');
    setNombreRealizaQueja('');
    setCliente('');
    setEmpresaPresentaQueja('');
    setPersonaPresentaQueja('');
    setMedioRecepcionQueja('');
    setTipoQueja('');
    setUbicacion('');
    setNivelQueja('');
    setFechaQueja('');
    setMotivoQueja('');
    setDescripcionQueja('');
    setFechaInicio('');
    setFechaRevision('');
    setResolucionQueja('');
    setEstado('');
    setAccionCorrectivaPreventiva('');
    setImageFiles([]);
    setAudioFiles([]);
    setVideoFiles([]);
    setDocumentFiles([]);
    setFirmaResponsable(null);
  };

  const cancelCreating = () => {
    setIsCreating(false);
  };

  const startEditing = (record: Complaint) => {
    // Reset first (avoid leaking previous form state between records)
    setImageFiles([]);
    setAudioFiles([]);
    setVideoFiles([]);
    setDocumentFiles([]);
    setFirmaResponsable(null);

    setEditingRecord({
      id: record.id,
      id_local: record.id_local,
      files: record.files || [],
      sociedad: record.sociedad || '',
      nombre_realiza_queja: record.nombre_realiza_queja || '',
      cliente: record.cliente || '',
      empresa_presenta_queja: record.empresa_presenta_queja || '',
      persona_presenta_queja: record.persona_presenta_queja || '',
      medio_recepcion_queja: record.medio_recepcion_queja || '',
      tipo_queja: record.tipo_queja || '',
      ubicacion: record.ubicacion || '',
      nivel_queja: record.nivel_queja || '',
      fecha_queja: record.fecha_queja || '',
      motivo_queja: record.motivo_queja || '',
      descripcion_queja: record.descripcion_queja || '',
      fecha_inicio: record.fecha_inicio || '',
      fecha_revision: record.fecha_revision || '',
      resolucion_queja: record.resolucion_queja || '',
      estado: record.estado || '',
      accion_correctiva_preventiva: record.accion_correctiva_preventiva || '',
      firma_responsable: record.firma_responsable || '',
    });
    setSociedad(record.sociedad || '');
    setNombreRealizaQueja(record.nombre_realiza_queja || '');
    setCliente(record.cliente || '');
    setEmpresaPresentaQueja(record.empresa_presenta_queja || '');
    setPersonaPresentaQueja(record.persona_presenta_queja || '');
    setMedioRecepcionQueja(record.medio_recepcion_queja || '');
    setTipoQueja(record.tipo_queja || '');
    setUbicacion(record.ubicacion || '');
    setNivelQueja(record.nivel_queja || '');
    setFechaQueja(record.fecha_queja || '');
    setMotivoQueja(record.motivo_queja || '');
    setDescripcionQueja(record.descripcion_queja || '');
    setFechaInicio(record.fecha_inicio || '');
    setFechaRevision(record.fecha_revision || '');
    setResolucionQueja(record.resolucion_queja || '');
    setEstado(record.estado || '');
    setAccionCorrectivaPreventiva(record.accion_correctiva_preventiva || '');

    // Si ya existe firma guardada, mostrarla en el UI
    setFirmaFromHashIfPossible(record.firma_responsable || null);

    // Precargar adjuntos existentes como si se hubiesen “adjuntado” para reenviarlos al PUT
    // (requerimiento: en update se borran y se vuelven a cargar).
    if (record.id && !String(record.id).startsWith('local-')) {
      preloadExistingFilesForEdit(record);
    }
  };

  const cancelEditing = () => {
    setEditingRecord(null);
  };

  const handleDateChangeQueja = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePickerQueja(false);
    }
    if (selectedDate) {
      setFechaQueja(formatDate(selectedDate));
    }
  };

  const handleDateChangeInicio = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePickerInicio(false);
    }
    if (selectedDate) {
      setFechaInicio(formatDate(selectedDate));
    }
  };

  const handleDateChangeRevision = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePickerRevision(false);
    }
    if (selectedDate) {
      setFechaRevision(formatDate(selectedDate));
    }
  };

  const saveComplaint = async () => {
    const currentMarca = await AsyncStorage.getItem('current_marca');
    if (!currentMarca) {
      Alert.alert('Error', 'No se encontró la marca actual');
      return;
    }

    setIsSubmitting(true);
    setSubmitResponse(null);

    try {
      const currentMarcaData = JSON.parse(currentMarca);

      if (!firmaResponsable) {
        Alert.alert('Error', 'La firma del responsable es requerida');
        setIsSubmitting(false);
        return;
      }

      const requestData = {
        marca_id: currentMarcaData.id,
        sociedad: sociedad.trim(),
        nombre_realiza_queja: nombreRealizaQueja.trim(),
        cliente: cliente.trim(),
        empresa_presenta_queja: empresaPresentaQueja.trim(),
        persona_presenta_queja: personaPresentaQueja.trim(),
        medio_recepcion_queja: medioRecepcionQueja.trim(),
        tipo_queja: tipoQueja.trim(),
        ubicacion: ubicacion.trim(),
        nivel_queja: nivelQueja.trim(),
        fecha_queja: fechaQueja.trim(),
        motivo_queja: motivoQueja.trim(),
        descripcion_queja: descripcionQueja.trim(),
        fecha_inicio: fechaInicio.trim(),
        fecha_revision: fechaRevision.trim(),
        resolucion_queja: resolucionQueja.trim(),
        estado: estado.trim(),
        accion_correctiva_preventiva: accionCorrectivaPreventiva.trim(),
        firma_responsable: firmaResponsable
          ? btoa(`${firmaResponsable.sessionId}:${firmaResponsable.empleadoId}:${firmaResponsable.latitud}:${firmaResponsable.longitud}:${firmaResponsable.timestamp}`)
          : '',
        archivos: [
          ...imageFiles.map(f => ({ type: 'image', extension: f.extension, original_name: f.name, file_base64: f.base64 })),
          ...audioFiles.map(f => ({ type: 'audio', extension: f.extension, original_name: f.name, file_base64: f.base64 })),
          ...videoFiles.map(f => ({ type: 'video', extension: f.extension, original_name: f.name, file_base64: f.base64 })),
          ...documentFiles.map(f => ({ type: 'document', extension: f.extension, original_name: f.name, file_base64: f.base64 })),
        ],
      };

      const isConnected = await getConnectionStatus();

      if (isConnected) {
        const result = await createComplaintsMaster({
          requestData,
          refreshAccessToken,
          logout,
        });

        if (result.status) {
          Alert.alert('Éxito', result.message || 'Queja guardada correctamente');
          setTimeout(() => {
            cancelCreating();
            fetchComplaints();
          }, 2000);
        } else {
          Alert.alert('Error', result.message || 'Error al guardar la queja');
        }
      } else {
        const localId = generateRandomId();

        const actionsStr = await AsyncStorage.getItem('evaluations_actions');
        const actions = actionsStr ? JSON.parse(actionsStr) : [];
        actions.push({
          id: localId,
          action: 'create',
          type: 'complaints_master',
          payload: requestData,
          synced: false,
        });
        await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        const cache = cacheStr ? JSON.parse(cacheStr) : [];

        const horaAccion = await getHoraAccion();
        if (!horaAccion) {
          Alert.alert('Error', 'No se pudo obtener la hora');
          return;
        }

        const newRecordCache: Complaint = {
          id: '',
          id_local: localId,
          files: [],
          sociedad: sociedad.trim() || null,
          nombre_realiza_queja: nombreRealizaQueja.trim() || null,
          cliente: cliente.trim() || null,
          empresa_presenta_queja: empresaPresentaQueja.trim() || null,
          persona_presenta_queja: personaPresentaQueja.trim() || null,
          medio_recepcion_queja: medioRecepcionQueja.trim() || null,
          tipo_queja: tipoQueja.trim() || null,
          ubicacion: ubicacion.trim() || null,
          nivel_queja: nivelQueja.trim() || null,
          fecha_queja: fechaQueja.trim() || null,
          motivo_queja: motivoQueja.trim() || null,
          descripcion_queja: descripcionQueja.trim() || null,
          fecha_inicio: fechaInicio.trim() || null,
          fecha_revision: fechaRevision.trim() || null,
          resolucion_queja: resolucionQueja.trim() || null,
          estado: estado.trim() || null,
          accion_correctiva_preventiva: accionCorrectivaPreventiva.trim() || null,
          firma_responsable: requestData.firma_responsable || null,
          created_at: new Date(horaAccion).toISOString(),
          synced: false,
        };

        cache.push({ ...newRecordCache, type: 'complaints_master' });
        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(cache));

        Alert.alert('Éxito', 'Queja registrada localmente. Se sincronizará cuando haya conexión.');
        setTimeout(() => {
          cancelCreating();
          fetchComplaints();
        }, 2000);
      }
    } catch (err) {
      console.error('Error saving complaint:', err);
      Alert.alert('Error', 'No se pudo guardar la queja');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateComplaintHandler = async () => {
    if (!editingRecord) return;

    setIsSubmitting(true);
    setSubmitResponse(null);

    try {
      if (!firmaResponsable && (!editingRecord.firma_responsable || editingRecord.firma_responsable.trim().length === 0)) {
        Alert.alert('Error', 'La firma del responsable es requerida');
        setIsSubmitting(false);
        return;
      }

      const requestData = {
        sociedad: sociedad.trim(),
        nombre_realiza_queja: nombreRealizaQueja.trim(),
        cliente: cliente.trim(),
        empresa_presenta_queja: empresaPresentaQueja.trim(),
        persona_presenta_queja: personaPresentaQueja.trim(),
        medio_recepcion_queja: medioRecepcionQueja.trim(),
        tipo_queja: tipoQueja.trim(),
        ubicacion: ubicacion.trim(),
        nivel_queja: nivelQueja.trim(),
        fecha_queja: fechaQueja.trim(),
        motivo_queja: motivoQueja.trim(),
        descripcion_queja: descripcionQueja.trim(),
        fecha_inicio: fechaInicio.trim(),
        fecha_revision: fechaRevision.trim(),
        resolucion_queja: resolucionQueja.trim(),
        estado: estado.trim(),
        accion_correctiva_preventiva: accionCorrectivaPreventiva.trim(),
        firma_responsable: firmaResponsable
          ? btoa(`${firmaResponsable.sessionId}:${firmaResponsable.empleadoId}:${firmaResponsable.latitud}:${firmaResponsable.longitud}:${firmaResponsable.timestamp}`)
          : (editingRecord.firma_responsable || ''),
        archivos: [
          ...imageFiles.map(f => ({ type: 'image', extension: f.extension, original_name: f.name, file_base64: f.base64 })),
          ...audioFiles.map(f => ({ type: 'audio', extension: f.extension, original_name: f.name, file_base64: f.base64 })),
          ...videoFiles.map(f => ({ type: 'video', extension: f.extension, original_name: f.name, file_base64: f.base64 })),
          ...documentFiles.map(f => ({ type: 'document', extension: f.extension, original_name: f.name, file_base64: f.base64 })),
        ],
      };

      const isConnected = await getConnectionStatus();
      const recordId = editingRecord.id || editingRecord.id_local;

      if (isConnected && editingRecord.id && !String(editingRecord.id).startsWith('local-')) {
        const result = await updateComplaintsMaster({
          id: String(editingRecord.id),
          requestData,
          refreshAccessToken,
          logout,
        });

        if (result.status) {
          Alert.alert('Éxito', result.message || 'Queja actualizada correctamente');
          setTimeout(() => {
            cancelEditing();
            fetchComplaints();
          }, 2000);
        } else {
          Alert.alert('Error', result.message || 'Error al actualizar la queja');
        }
      } else {
        const actionsStr = await AsyncStorage.getItem('evaluations_actions');
        const actions = actionsStr ? JSON.parse(actionsStr) : [];
        actions.push({
          id: recordId,
          action: 'update',
          type: 'complaints_master',
          payload: requestData,
          synced: false,
        });
        await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const updatedCache = cache.map((item: any) => {
            if ((item.id === recordId || item.id_local === recordId) && item.type === 'complaints_master') {
              return {
                ...item,
                sociedad: sociedad.trim() || null,
                nombre_realiza_queja: nombreRealizaQueja.trim() || null,
                cliente: cliente.trim() || null,
                empresa_presenta_queja: empresaPresentaQueja.trim() || null,
                persona_presenta_queja: personaPresentaQueja.trim() || null,
                medio_recepcion_queja: medioRecepcionQueja.trim() || null,
                tipo_queja: tipoQueja.trim() || null,
                ubicacion: ubicacion.trim() || null,
                nivel_queja: nivelQueja.trim() || null,
                fecha_queja: fechaQueja.trim() || null,
                motivo_queja: motivoQueja.trim() || null,
                descripcion_queja: descripcionQueja.trim() || null,
                fecha_inicio: fechaInicio.trim() || null,
                fecha_revision: fechaRevision.trim() || null,
                resolucion_queja: resolucionQueja.trim() || null,
                estado: estado.trim() || null,
                accion_correctiva_preventiva: accionCorrectivaPreventiva.trim() || null,
                firma_responsable: requestData.firma_responsable || item.firma_responsable,
              };
            }
            return item;
          });
          await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
        }

        Alert.alert('Éxito', 'Queja actualizada localmente. Se sincronizará cuando haya conexión.');
        setTimeout(() => {
          cancelEditing();
          fetchComplaints();
        }, 2000);
      }
    } catch (err) {
      console.error('Error updating complaint:', err);
      Alert.alert('Error', 'No se pudo actualizar la queja');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteComplaintHandler = async (record: Complaint) => {
    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas eliminar esta queja?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const isConnected = await getConnectionStatus();
              const recordId = record.id || record.id_local;

              if (isConnected && record.id && !String(record.id).startsWith('local-')) {
                const result = await deleteComplaintsMaster({
                  id: String(record.id),
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', result.message || 'Queja eliminada correctamente');
                  fetchComplaints();
                } else {
                  Alert.alert('Error', result.message || 'Error al eliminar la queja');
                }
              } else {
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: recordId,
                  action: 'delete',
                  type: 'complaints_master',
                  payload: {},
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                if (cacheStr) {
                  const cache = JSON.parse(cacheStr);
                  const updatedCache = cache.filter((item: any) => !(item.id === recordId || item.id_local === recordId));
                  await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                }

                Alert.alert('Modo Offline', 'Queja eliminada localmente. Se sincronizará cuando haya conexión.');
                fetchComplaints();
              }
            } catch (err) {
              console.error('Error deleting complaint:', err);
              Alert.alert('Error', 'No se pudo eliminar la queja');
            }
          },
        },
      ]
    );
  };

  const toggleExpanded = (recordId: string) => {
    if (expandedRecordIds.includes(recordId)) {
      setExpandedRecordIds(expandedRecordIds.filter(id => id !== recordId));
    } else {
      setExpandedRecordIds([...expandedRecordIds, recordId]);
    }
  };

  const renderForm = (isEditing: boolean = false) => {
    return (
      <ThemedView style={styles.formCard}>
        <ThemedText style={styles.formTitle}>
          {isEditing ? 'Editar Queja' : 'Nueva Queja'}
        </ThemedText>

        {/* Sociedad */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Sociedad</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="Sociedad"
            placeholderTextColor="#999"
            value={sociedad}
            onChangeText={setSociedad}
          />
        </ThemedView>

        {/* Nombre de quien recibe la queja */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Nombre de quien recibe la queja</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="Nombre completo"
            placeholderTextColor="#999"
            value={nombreRealizaQueja}
            onChangeText={setNombreRealizaQueja}
          />
        </ThemedView>

        {/* Cliente */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Cliente</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="Cliente"
            placeholderTextColor="#999"
            value={cliente}
            onChangeText={setCliente}
          />
        </ThemedView>

        {/* Empresa que presenta queja */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Empresa que presenta queja</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="Empresa que presenta queja"
            placeholderTextColor="#999"
            value={empresaPresentaQueja}
            onChangeText={setEmpresaPresentaQueja}
          />
        </ThemedView>

        {/* Persona que presenta queja */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Persona que presenta queja</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="Persona que presenta queja"
            placeholderTextColor="#999"
            value={personaPresentaQueja}
            onChangeText={setPersonaPresentaQueja}
          />
        </ThemedView>

        {/* Medio Recepcion Queja */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Medio Recepcion Queja</ThemedText>
          <ThemedView style={styles.pickerContainer}>
            <Picker
              selectedValue={medioRecepcionQueja}
              onValueChange={setMedioRecepcionQueja}
              style={styles.picker}
            >
              <Picker.Item label="Seleccionar" value="" color="#000000" />
              <Picker.Item label="Correo" value="Correo" color="#000000" />
              <Picker.Item label="Teléfono" value="Telefono" color="#000000" />
              <Picker.Item label="Presencial" value="Presencial" color="#000000" />
              <Picker.Item label="Otro" value="Otro" color="#000000" />
            </Picker>
          </ThemedView>
        </ThemedView>

        {/* Tipo de queja */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Tipo de queja</ThemedText>
          <ThemedView style={styles.pickerContainer}>
            <Picker
              selectedValue={tipoQueja}
              onValueChange={setTipoQueja}
              style={styles.picker}
            >
              <Picker.Item label="Seleccionar" value="" color="#000000" />
              <Picker.Item label="Público" value="Publico" color="#000000" />
              <Picker.Item label="Privado" value="Privado" color="#000000" />
              <Picker.Item label="Interno" value="Interno" color="#000000" />
            </Picker>
          </ThemedView>
        </ThemedView>

        {/* Ubicacion */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Ubicacion</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="Ubicación"
            placeholderTextColor="#999"
            value={ubicacion}
            onChangeText={setUbicacion}
          />
        </ThemedView>

        {/* Nivel Queja */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Nivel Queja</ThemedText>
          <ThemedView style={styles.pickerContainer}>
            <Picker
              selectedValue={nivelQueja}
              onValueChange={setNivelQueja}
              style={styles.picker}
            >
              <Picker.Item label="Seleccionar" value="" color="#000000" />
              <Picker.Item label="Leve" value="Leve" color="#000000" />
              <Picker.Item label="Moderada" value="Moderada" color="#000000" />
              <Picker.Item label="Grave" value="Grave" color="#000000" />
            </Picker>
          </ThemedView>
        </ThemedView>

        {/* Fecha de queja */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Fecha de queja</ThemedText>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowDatePickerQueja(true)}
          >
            <ThemedText style={styles.dateButtonText}>
              {fechaQueja ? convertDateTimestampToLocalString(new Date(fechaQueja).toISOString(), false) : 'Seleccionar fecha'}
            </ThemedText>
            <Ionicons name="calendar" size={20} color="#007AFF" />
          </TouchableOpacity>
          {showDatePickerQueja && (
            <DateTimePicker
              value={parseDateStringToDate(fechaQueja)}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChangeQueja}
            />
          )}
        </ThemedView>

        {/* Motivo de la queja */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Motivo de la queja</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="Motivo de la queja"
            placeholderTextColor="#999"
            value={motivoQueja}
            onChangeText={setMotivoQueja}
          />
        </ThemedView>

        {/* Descripcion de la queja */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Descripcion de la queja</ThemedText>
          <TextInput
            style={[styles.formInput, styles.textArea]}
            placeholder="Descripción detallada de la queja"
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            value={descripcionQueja}
            onChangeText={setDescripcionQueja}
          />
        </ThemedView>

        {/* Fecha de inicio */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Fecha de inicio</ThemedText>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowDatePickerInicio(true)}
          >
            <ThemedText style={styles.dateButtonText}>
              {fechaInicio ? convertDateTimestampToLocalString(new Date(fechaInicio).toISOString(), false) : 'Seleccionar fecha'}
            </ThemedText>
            <Ionicons name="calendar" size={20} color="#007AFF" />
          </TouchableOpacity>
          {showDatePickerInicio && (
            <DateTimePicker
              value={parseDateStringToDate(fechaInicio)}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChangeInicio}
            />
          )}
        </ThemedView>

        {/* Fecha de resolución */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Fecha de resolución</ThemedText>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowDatePickerRevision(true)}
          >
            <ThemedText style={styles.dateButtonText}>
              {fechaRevision ? convertDateTimestampToLocalString(new Date(fechaRevision).toISOString(), false) : 'Seleccionar fecha'}
            </ThemedText>
            <Ionicons name="calendar" size={20} color="#007AFF" />
          </TouchableOpacity>
          {showDatePickerRevision && (
            <DateTimePicker
              value={parseDateStringToDate(fechaRevision)}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChangeRevision}
            />
          )}
        </ThemedView>

        {/* Resolucion de la queja */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Resolucion de la queja</ThemedText>
          <TextInput
            style={[styles.formInput, styles.textArea]}
            placeholder="Resolución de la queja"
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            value={resolucionQueja}
            onChangeText={setResolucionQueja}
          />
        </ThemedView>

        {/* Estado */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Estado</ThemedText>
          <ThemedView style={styles.pickerContainer}>
            <Picker
              selectedValue={estado}
              onValueChange={setEstado}
              style={styles.picker}
            >
              <Picker.Item label="Seleccionar" value="" color="#000000" />
              <Picker.Item label="Pendiente" value="Pendiente" color="#000000" />
              <Picker.Item label="En proceso" value="En proceso" color="#000000" />
              <Picker.Item label="Resuelto" value="Resuelto" color="#000000" />
              <Picker.Item label="Descartada" value="Descartada" color="#000000" />
            </Picker>
          </ThemedView>
        </ThemedView>

        {/* Accion correctiva/preventiva */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Accion correctiva/preventiva (codigo de accion correctiva relacionado)</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="Código de acción correctiva"
            placeholderTextColor="#999"
            value={accionCorrectivaPreventiva}
            onChangeText={setAccionCorrectivaPreventiva}
          />
        </ThemedView>

        {/* Archivos adjuntos (miniaturas en creación; visor en edición) */}
        {isEditing && editingRecord?.files && (editingRecord.files.length > 0) && (
          <ComplaintFilesViewer
            complaintId={editingRecord.id || editingRecord.id_local}
            files={editingRecord.files}
            onDeleteFile={deleteAttachedFile}
            accessToken={accessToken}
          />
        )}

        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Agregar archivos</ThemedText>

          <ThemedView style={styles.fileIconButtonsRow}>
            <TouchableOpacity style={styles.fileIconButton} onPress={() => handleAddFile('image')}>
              <Ionicons name="image-outline" size={20} color="#007AFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.fileIconButton} onPress={() => handleAddFile('audio')}>
              <Ionicons name="mic-outline" size={20} color="#007AFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.fileIconButton} onPress={() => handleAddFile('video')}>
              <Ionicons name="videocam-outline" size={20} color="#007AFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.fileIconButton} onPress={() => handleAddFile('document')}>
              <Ionicons name="document-text-outline" size={20} color="#007AFF" />
            </TouchableOpacity>
          </ThemedView>

          {(imageFiles.length + audioFiles.length + videoFiles.length + documentFiles.length) > 0 && (
            <ThemedView style={styles.filesList}>
              {imageFiles.map(file => (
                <ThemedView key={file.id} style={styles.fileRow}>
                  <Image
                    source={{ uri: `data:image/${file.extension || 'jpeg'};base64,${file.base64}` }}
                    style={styles.filePreviewImage}
                    resizeMode="cover"
                  />
                  <ThemedText numberOfLines={1} style={styles.fileName}>{file.name}</ThemedText>
                  <TouchableOpacity onPress={() => removeLocalFile('image', file.id)}>
                    <Ionicons name="trash" size={16} color="#FF3B30" />
                  </TouchableOpacity>
                </ThemedView>
              ))}

              {audioFiles.map(file => (
                <ThemedView key={file.id} style={styles.fileRow}>
                  <Ionicons name="musical-notes-outline" size={16} color="#007AFF" />
                  <ThemedText numberOfLines={1} style={styles.fileName}>{file.name}</ThemedText>
                  <TouchableOpacity onPress={() => removeLocalFile('audio', file.id)}>
                    <Ionicons name="trash" size={16} color="#FF3B30" />
                  </TouchableOpacity>
                </ThemedView>
              ))}

              {videoFiles.map(file => (
                <ThemedView key={file.id} style={styles.fileRow}>
                  <Ionicons name="videocam-outline" size={16} color="#007AFF" />
                  <ThemedText numberOfLines={1} style={styles.fileName}>{file.name}</ThemedText>
                  <TouchableOpacity onPress={() => removeLocalFile('video', file.id)}>
                    <Ionicons name="trash" size={16} color="#FF3B30" />
                  </TouchableOpacity>
                </ThemedView>
              ))}

              {documentFiles.map(file => (
                <ThemedView key={file.id} style={styles.fileRow}>
                  <Ionicons name="document-text-outline" size={16} color="#007AFF" />
                  <ThemedText numberOfLines={1} style={styles.fileName}>{file.name}</ThemedText>
                  <TouchableOpacity onPress={() => removeLocalFile('document', file.id)}>
                    <Ionicons name="trash" size={16} color="#FF3B30" />
                  </TouchableOpacity>
                </ThemedView>
              ))}
            </ThemedView>
          )}
        </ThemedView>

        {/* Firma del responsable (requerida) */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Firma del Responsable *</ThemedText>

          {!firmaResponsable ? (
            <ThemedView style={styles.signatureButtons}>
              <TouchableOpacity
                style={[styles.signatureButton, isGeneratingFirma && styles.signatureButtonDisabled]}
                onPress={generateSignature}
                disabled={isGeneratingFirma}
              >
                {isGeneratingFirma ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="finger-print" size={24} color="#FFFFFF" />
                    <ThemedText style={styles.signatureButtonText}>Generar</ThemedText>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.signatureButton}
                onPress={handleScanQR}
              >
                <Ionicons name="qr-code" size={20} color="#FFFFFF" />
                <ThemedText style={styles.signatureButtonText}>Escanear QR</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          ) : (
            <ThemedView style={styles.signatureInfo}>
              <ThemedText style={styles.signatureInfoTitle}>Información de la firma:</ThemedText>
              <ThemedText style={styles.signatureInfoText}>ID de sesión: {firmaResponsable.sessionId}</ThemedText>
              <ThemedText style={styles.signatureInfoText}>ID del empleado: {firmaResponsable.empleadoId}</ThemedText>
              {firmaResponsable.empleadoDetalle && (
                <ThemedView style={styles.signatureInfoDetail}>
                  <ThemedText style={styles.signatureInfoDetailText}>
                    {firmaResponsable.empleadoDetalle.nombre} {firmaResponsable.empleadoDetalle.primer_apellido} {firmaResponsable.empleadoDetalle.segundo_apellido}
                  </ThemedText>
                </ThemedView>
              )}
              <ThemedText style={styles.signatureInfoText}>Latitud: {firmaResponsable.latitud}</ThemedText>
              <ThemedText style={styles.signatureInfoText}>Longitud: {firmaResponsable.longitud}</ThemedText>
              <ThemedText style={styles.signatureInfoText}>Hora: {convertDateTimestampToLocalString(new Date(Number(firmaResponsable.timestamp)).toISOString())}</ThemedText>
              <TouchableOpacity
                style={styles.clearSignatureButton}
                onPress={() => setFirmaResponsable(null)}
              >
                <Ionicons name="trash" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </ThemedView>
          )}
        </ThemedView>

        {/* Action Buttons */}
        <ThemedView style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.cancelButton]}
            onPress={isEditing ? cancelEditing : cancelCreating}
          >
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          {submitResponse && (
            <ThemedView style={[styles.responseContainer, submitResponse.type === 'success' ? styles.responseSuccess : styles.responseError]}>
              <ThemedText style={styles.responseText}>
                {submitResponse.type === 'success' ? '✓ ' : '✗ '}
                {submitResponse.message}
              </ThemedText>
            </ThemedView>
          )}
          <TouchableOpacity
            style={[styles.actionButton, styles.saveButton, (isSubmitting || isPreloadingEditFiles) && styles.buttonDisabled]}
            onPress={isEditing ? updateComplaintHandler : saveComplaint}
            disabled={isSubmitting || isPreloadingEditFiles}
          >
            {(isSubmitting || isPreloadingEditFiles) ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="checkmark" size={24} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </ThemedView>
      </ThemedView>
    );
  };

  const renderList = () => {
    if (isLoading) {
      return (
        <ThemedView style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Cargando quejas...</ThemedText>
        </ThemedView>
      );
    }

    if (error && complaints.length === 0) {
      return (
        <ThemedView style={styles.centerContainer}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        </ThemedView>
      );
    }

    if (complaints.length === 0) {
      return (
        <ThemedView style={styles.centerContainer}>
          <ThemedText style={styles.emptyText}>No hay quejas registradas</ThemedText>
        </ThemedView>
      );
    }

    return (
      <ThemedView style={styles.listContainer}>
        {complaints.map((record, index) => {
          const recordId = String(record.id || record.id_local || index);
          const isExpanded = expandedRecordIds.includes(recordId);
          const isOffline = !record.synced || record.id_local;

          return (
            <ThemedView key={recordId} style={styles.listItem}>
              <ThemedText style={styles.listItemTitle}>
                {record.nombre_realiza_queja || 'Sin nombre'}
              </ThemedText>
              <ThemedText style={styles.listItemSubtitle}>
                <ThemedText style={styles.detailLabel}>Cliente: </ThemedText>
                {record.cliente || 'Sin cliente'}
              </ThemedText>
              <ThemedText style={styles.listItemSubtitle}>
                <ThemedText style={styles.detailLabel}>Tipo de queja: </ThemedText>
                {record.tipo_queja || 'Sin tipo'}
              </ThemedText>
              <ThemedText style={styles.listItemSubtitle}>
                <ThemedText style={styles.detailLabel}>Estado: </ThemedText>
                {record.estado || 'No especificado'}
              </ThemedText>
              <ThemedText style={styles.listItemSubtitle}>
                <ThemedText style={styles.detailLabel}>Fecha de queja: </ThemedText>
                {record.fecha_queja
                  ? convertDateTimestampToLocalString(new Date(record.fecha_queja).toISOString(), false)
                  : 'No especificado'}
              </ThemedText>

              <ThemedView style={styles.listItemActions}>
                {isOffline && (
                  <ThemedView style={styles.offlineBadge}>
                    <ThemedText style={styles.offlineBadgeText}>Offline</ThemedText>
                  </ThemedView>
                )}
              </ThemedView>

              <TouchableOpacity
                style={styles.collapseButton}
                onPress={() => toggleExpanded(recordId)}
              >
                <ThemedText style={styles.collapseButtonText}>
                  {isExpanded ? 'Ocultar detalles de la queja' : 'Ver detalles de la queja'}
                </ThemedText>
                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#007AFF"
                />
              </TouchableOpacity>

              {isExpanded && (
                <ThemedView style={styles.listItemDetails}>
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Sociedad: </ThemedText>
                    {record.sociedad || 'No especificado'}
                  </ThemedText>
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Empresa que presenta queja: </ThemedText>
                    {record.empresa_presenta_queja || 'No especificado'}
                  </ThemedText>
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Persona que presenta queja: </ThemedText>
                    {record.persona_presenta_queja || 'No especificado'}
                  </ThemedText>
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Medio Recepcion Queja: </ThemedText>
                    {record.medio_recepcion_queja || 'No especificado'}
                  </ThemedText>
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Ubicacion: </ThemedText>
                    {record.ubicacion || 'No especificado'}
                  </ThemedText>
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Nivel Queja: </ThemedText>
                    {record.nivel_queja || 'No especificado'}
                  </ThemedText>
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Motivo de la queja: </ThemedText>
                    {record.motivo_queja || 'No especificado'}
                  </ThemedText>
                  {record.descripcion_queja && (
                    <ThemedText style={styles.detailText}>
                      <ThemedText style={styles.detailLabel}>Descripcion de la queja: </ThemedText>
                      {record.descripcion_queja}
                    </ThemedText>
                  )}
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Fecha de inicio: </ThemedText>
                    {record.fecha_inicio
                      ? convertDateTimestampToLocalString(new Date(record.fecha_inicio).toISOString(), false)
                      : 'No especificado'}
                  </ThemedText>
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Fecha de resolución: </ThemedText>
                    {record.fecha_revision
                      ? convertDateTimestampToLocalString(new Date(record.fecha_revision).toISOString(), false)
                      : 'No especificado'}
                  </ThemedText>
                  {record.resolucion_queja && (
                    <ThemedText style={styles.detailText}>
                      <ThemedText style={styles.detailLabel}>Resolucion de la queja: </ThemedText>
                      {record.resolucion_queja}
                    </ThemedText>
                  )}
                  {record.accion_correctiva_preventiva && (
                    <ThemedText style={styles.detailText}>
                      <ThemedText style={styles.detailLabel}>Accion correctiva/preventiva: </ThemedText>
                      {record.accion_correctiva_preventiva}
                    </ThemedText>
                  )}

                  {Array.isArray(record.files) && record.files.length > 0 && (
                    <ComplaintFilesViewer
                      complaintId={record.id || record.id_local}
                      files={record.files}
                      accessToken={accessToken}
                    />
                  )}
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Fecha de registro: </ThemedText>
                    {new Date(record.created_at).toLocaleDateString('es-CR')}
                  </ThemedText>
                </ThemedView>
              )}
              <ThemedView style={styles.listItemButtons}>
                <TouchableOpacity
                  style={[styles.listItemButton, styles.editButton]}
                  onPress={() => startEditing(record)}
                >
                  <Ionicons name="pencil" size={20} color="#FFFFFF" />
                  <ThemedText style={styles.listItemButtonText}>Editar</ThemedText>
                </TouchableOpacity>
                {!(record.id_local || String(record.id).startsWith('local-') || record.id === 0) && (
                  <TouchableOpacity
                    style={[styles.listItemButton, styles.changesButton]}
                    onPress={() => {
                      setCambiosTitle(`Cambios - Queja #${record.id}`);
                      fetchCambios('c_maestro_quejas', Number(record.id));
                    }}
                  >
                    <Ionicons name="list-outline" size={20} color="#FFFFFF" />
                    <ThemedText style={styles.listItemButtonText}>Cambios</ThemedText>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.listItemButton, styles.deleteButton]}
                  onPress={() => deleteComplaintHandler(record)}
                >
                  <Ionicons name="trash" size={20} color="#FFFFFF" />
                  <ThemedText style={styles.listItemButtonText}>Eliminar</ThemedText>
                </TouchableOpacity>
              </ThemedView>
            </ThemedView>
          );
        })}
      </ThemedView>
    );
  };

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'complaints': return <Ionicons name="document-text" size={25} color='#000000' />;
      case 'add': return <Ionicons name="add-sharp" size={20} color='#000000' />;
      case 'edit': return <Ionicons name="pencil" size={20} color='#FFFFFF' />;
      case 'delete': return <Ionicons name="trash" size={20} color='#FFFFFF' />;
      case 'cancel': return <Ionicons name="close-sharp" size={20} color='#FFFFFF' />;
      case 'confirm': return <Ionicons name="checkmark-sharp" size={20} color='#FFFFFF' />;
      default: return <Ionicons name="close-sharp" size={20} color='#FFFFFF' />;
    }
  };

  return (
    <ThemedView style={styles.container}>
      <AppHeader onMenuPress={() => setIsMenuVisible(true)} title="Maestro de Quejas" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <ThemedView style={styles.contentContainer}>
          {/* Module Title */}
          <ThemedView style={styles.titleContainer}>
            <ThemedText type="title" style={styles.title}>
              {getActionIcon('complaints')} Maestro de Quejas
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              Gestiona el registro de quejas
            </ThemedText>
          </ThemedView>

          {!hasCurrentMarca && (
            <ThemedView style={styles.warningContainer}>
              <ThemedText style={styles.warningText}>
                No se encontró la marca actual. Por favor, marca tu entrada primero.
              </ThemedText>
            </ThemedView>
          )}

          {hasCurrentMarca && (
            <>
              {!isCreating && !editingRecord && !isLoading && (
                <TouchableOpacity style={styles.createButton} onPress={startCreating}>
                  <Ionicons name="add" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              )}

              {isCreating && renderForm(false)}
              {editingRecord && renderForm(true)}
              {!isCreating && !editingRecord && renderList()}
            </>
          )}
        </ThemedView>
      </ScrollView>

      {/* Modal: ver cambios */}
      <Modal
        visible={isCambiosModalVisible}
        animationType="fade"
        transparent
        presentationStyle="overFullScreen"
        onRequestClose={closeCambiosModal}
      >
        <View style={styles.overlay}>
          <ThemedView style={styles.floatModalCardMovimientos}>
            <ThemedView style={styles.floatModalHeader}>
              <ThemedText style={styles.modalTitle}>{cambiosTitle}</ThemedText>
              <TouchableOpacity onPress={closeCambiosModal}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </ThemedView>

            <ScrollView style={{ maxHeight: Dimensions.get('window').height * 0.75 }} contentContainerStyle={{ padding: 16 }}>
              {(!cambiosItems || cambiosItems.length === 0) ? (
                <ThemedView style={styles.emptyContainer}>
                  <ThemedText style={styles.emptyText}>No hay cambios registrados</ThemedText>
                </ThemedView>
              ) : (
                cambiosItems.map((row: any) => {
                  let parsed: any[] = [];
                  try {
                    parsed = row?.cambios ? JSON.parse(row.cambios) : [];
                  } catch {
                    parsed = [];
                  }
                  const createdAtLabel = convertDateTimestampToLocalString(new Date(row?.created_at).toISOString());
                  const isOpen = expandedCambioId === row.id;

                  return (
                    <ThemedView key={`chg-${row.id}`} style={styles.cambioCollapsableMain}>
                      <TouchableOpacity
                        style={styles.cambioCollapsableHeader}
                        onPress={() => setExpandedCambioId((prev) => (prev === row.id ? null : row.id))}
                        activeOpacity={0.8}
                      >
                        <ThemedText style={styles.cambioCollapsableTitle}>
                          {createdAtLabel}
                        </ThemedText>
                        <Ionicons
                          name={isOpen ? "chevron-up" : "chevron-down"}
                          size={18}
                          color="#007AFF"
                        />
                      </TouchableOpacity>

                      {isOpen && (
                        <ThemedView style={styles.cambioCollapsableContent}>
                          <ThemedView style={styles.filterGroupSearch}>
                            <ThemedText style={styles.filterLabel}>Cambio realizado por:</ThemedText>
                            <ThemedText style={styles.changeDescription}>
                              {row.empleado_nombre || 'Desconocido'}
                              {row.empleado_cedula ? ` - Cédula: ${row.empleado_cedula}` : ''}
                            </ThemedText>
                          </ThemedView>

                          {(Array.isArray(parsed) ? parsed : []).length > 0 && (
                            <ThemedView style={styles.filterGroupSearch}>
                              <ThemedText style={styles.filterLabel}>Cambios:</ThemedText>
                              {(Array.isArray(parsed) ? parsed : []).map((c: any, idx: number) => (
                                <ThemedText key={`c-${row.id}-${idx}`} style={styles.changeDescription}>
                                  <ThemedText style={{ fontWeight: '800' }}>{String(c?.prop ?? '-')}: </ThemedText>
                                  {formatChangeValue(c?.prop, c?.after)}
                                </ThemedText>
                              ))}
                            </ThemedView>
                          )}
                        </ThemedView>
                      )}
                    </ThemedView>
                  );
                })
              )}
            </ScrollView>
          </ThemedView>
        </View>
      </Modal>

      <AppFooter />
      <SlideMenu
        isVisible={isMenuVisible}
        onClose={() => setIsMenuVisible(false)}
        onHomePress={() => navigation.navigate('Home')}
        currentRoute="ComplaintsMaster"
      />
      {QRScannerComponent}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    padding: 20,
  },
  contentContainer: {
    width: '100%',
    maxWidth: 600,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 30,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    width: '100%',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
  },
  warningContainer: {
    backgroundColor: '#FFE5E5',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  warningText: {
    color: '#D32F2F',
    fontSize: 14,
    textAlign: 'center',
  },
  createButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  formCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#fff',
    padding: 16,
    gap: 8,
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#000000',
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000000',
    backgroundColor: '#FFFFFF',
  },
  textArea: {
    minHeight: 100,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    color: '#000000',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#000000',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#8E8E93',
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  responseContainer: {
    padding: 12,
    borderRadius: 6,
    marginBottom: 12,
  },
  responseSuccess: {
    backgroundColor: '#D4EDDA',
    borderWidth: 1,
    borderColor: '#C3E6CB',
  },
  responseError: {
    backgroundColor: '#F8D7DA',
    borderWidth: 1,
    borderColor: '#F5C6CB',
  },
  responseText: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  listContainer: {
    width: '100%',
    gap: 16,
  },
  listItem: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#fff',
    padding: 16,
    gap: 8,
    marginBottom: 16,
    overflow: 'hidden',
  },
  listItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  listItemHeaderContent: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 4,
  },
  listItemSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  listItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  offlineBadge: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  offlineBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  listItemDetails: {
    borderTopWidth: 1,
    borderTopColor: '#EEE',
    paddingTop: 12,
    marginTop: 8,
  },
  collapseButton: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  collapseButtonText: {
    color: '#007AFF',
    fontWeight: '700',
    fontSize: 14,
    flex: 1,
  },
  detailText: {
    fontSize: 14,
    color: '#000000',
    marginBottom: 8,
  },
  detailLabel: {
    fontWeight: '600',
  },
  listItemButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  listItemButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  editButton: {
    backgroundColor: '#4CAF50',
  },
  changesButton: {
    backgroundColor: '#5856D6',
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  deleteButton: {
    backgroundColor: '#F44336',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  floatModalCardMovimientos: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  floatModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000',
  },
  cambioCollapsableMain: {
    width: '100%',
    marginBottom: 10,
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  cambioCollapsableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F8F9FA',
  },
  cambioCollapsableTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    flex: 1,
  },
  cambioCollapsableContent: {
    padding: 12,
    gap: 8,
    backgroundColor: '#F8F9FA',
  },
  changeDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: '#666',
    marginBottom: 8,
  },
  filterGroupSearch: {
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
  },
  listItemButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: '#F44336',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },

  // Adjuntos (miniaturas)
  fileIconButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  fileIconButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#007AFF',
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filesList: {
    marginTop: 10,
    gap: 8,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  fileName: {
    flex: 1,
    fontSize: 13,
    color: '#000000',
  },
  filePreviewImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
  },

  // Files viewer (edición / detalle)
  collapsableSection: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
    overflow: 'hidden',
  },
  collapsableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F0F0F0',
  },
  collapsableHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  collapsableContent: {
    padding: 12,
    backgroundColor: '#F9F9F9',
  },
  viewerSection: {
    marginBottom: 16,
    backgroundColor: '#F9F9F9',
  },
  viewerSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  viewerImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#F0F0F0',
  },
  documentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  documentText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  audioPlayerContainer: {
    marginBottom: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  audioLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  audioPlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioTime: {
    fontSize: 14,
    fontWeight: '500',
    color: '#007AFF',
    flex: 1,
  },
  resetAudioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#007AFF',
  },

  // Firma
  signatureButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    backgroundColor: '#fff',
  },
  signatureButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minWidth: '45%',
  },
  signatureButtonDisabled: {
    backgroundColor: '#999',
  },
  signatureButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  signatureInfo: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  signatureInfoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000000',
  },
  signatureInfoText: {
    fontSize: 14,
    marginBottom: 4,
    color: '#000000',
  },
  signatureInfoDetail: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#BDE4FF',
    borderRadius: 8,
    marginBottom: 4,
  },
  signatureInfoDetailText: {
    fontSize: 12,
    color: '#000000',
  },
  clearSignatureButton: {
    marginTop: 10,
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

function ComplaintFilesViewer({
  complaintId,
  files,
  accessToken,
  onDeleteFile,
}: {
  complaintId: string | number;
  files: ComplaintFile[];
  accessToken?: string | null;
  onDeleteFile?: (file: ComplaintFile) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const list = Array.isArray(files) ? files : [];
  if (list.length === 0) return null;

  const imageFiles = list.filter(f => f.type === 'image');
  const audioFiles = list.filter(f => f.type === 'audio');
  const videoFiles = list.filter(f => f.type === 'video');
  const documentFiles = list.filter(f => f.type === 'document' || (!f.type && f.extension));

  return (
    <ThemedView style={styles.collapsableSection}>
      <TouchableOpacity
        style={styles.collapsableHeader}
        onPress={() => setIsExpanded(!isExpanded)}
      >
        <ThemedText style={styles.collapsableHeaderText}>
          Archivos ({list.length})
        </ThemedText>
        <Ionicons
          name={isExpanded ? "chevron-up" : "chevron-down"}
          size={20}
          color="#007AFF"
        />
      </TouchableOpacity>

      {isExpanded && (
        <ThemedView style={styles.collapsableContent}>
          {imageFiles.length > 0 && (
            <ThemedView style={styles.viewerSection}>
              <ThemedText style={styles.viewerSectionTitle}>Imágenes</ThemedText>
              {imageFiles.map(file => (
                <ThemedView key={file.id} style={{ backgroundColor: 'transparent' }}>
                  <ComplaintImageViewer
                    imageUrl={buildComplaintFileUrl(complaintId, file, accessToken)}
                    onDeleteFile={onDeleteFile ? () => onDeleteFile(file) : undefined}
                  />
                </ThemedView>
              ))}
            </ThemedView>
          )}

          {audioFiles.length > 0 && (
            <ThemedView style={styles.viewerSection}>
              <ThemedText style={styles.viewerSectionTitle}>Audios</ThemedText>
              {audioFiles.map(file => (
                <ThemedView key={file.id} style={{ backgroundColor: 'transparent' }}>
                  <ComplaintAudioPlayer
                    sourceUrl={buildComplaintFileUrl(complaintId, file, accessToken)}
                    label={getComplaintFileDisplayName(file)}
                    onDeleteFile={onDeleteFile ? () => onDeleteFile(file) : undefined}
                  />
                </ThemedView>
              ))}
            </ThemedView>
          )}

          {videoFiles.length > 0 && (
            <ThemedView style={styles.viewerSection}>
              <ThemedText style={styles.viewerSectionTitle}>Videos</ThemedText>
              {videoFiles.map(file => (
                <ThemedView key={file.id} style={{ backgroundColor: 'transparent' }}>
                  <ComplaintVideoPlayer
                    sourceUrl={buildComplaintFileUrl(complaintId, file, accessToken)}
                    onDeleteFile={onDeleteFile ? () => onDeleteFile(file) : undefined}
                  />
                </ThemedView>
              ))}
            </ThemedView>
          )}

          {documentFiles.length > 0 && (
            <ThemedView style={styles.viewerSection}>
              <ThemedText style={styles.viewerSectionTitle}>Documentos</ThemedText>
              {documentFiles.map(file => (
                <TouchableOpacity
                  key={file.id}
                  style={styles.documentRow}
                  onPress={() => {
                    const url = buildComplaintFileUrl(complaintId, file, accessToken);
                    if (url) Linking.openURL(url);
                    else Alert.alert('Error', 'URL inválida para descargar el archivo');
                  }}
                >
                  <Ionicons name="document-text-outline" size={20} color="#007AFF" />
                  <ThemedText numberOfLines={1} style={styles.documentText}>
                    {getComplaintFileDisplayName(file)}
                  </ThemedText>
                  <Ionicons name="download-outline" size={20} color="#007AFF" />
                  {onDeleteFile && (
                    <TouchableOpacity onPress={() => onDeleteFile(file)}>
                      <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              ))}
            </ThemedView>
          )}
        </ThemedView>
      )}
    </ThemedView>
  );
}

function ComplaintImageViewer({
  imageUrl,
  onDeleteFile
}: {
  imageUrl: string;
  onDeleteFile?: () => void;
}) {
  const [containerStyle, setContainerStyle] = useState<any>(styles.viewerImage);
  const maxContainerWidth = Dimensions.get('window').width - 64;

  const handleImageLoad = (event: any) => {
    const { width, height } = event.nativeEvent.source;
    if (width && height) {
      const aspectRatio = width / height;
      let containerWidth = maxContainerWidth;
      let containerHeight: number;

      if (height > width) {
        containerHeight = (maxContainerWidth / aspectRatio);
        if (containerHeight > 600) {
          containerHeight = 600;
          containerWidth = containerHeight * aspectRatio;
        }
      } else {
        containerWidth = Math.min(maxContainerWidth, width);
        containerHeight = containerWidth / aspectRatio;
        if (containerHeight < 180) {
          containerHeight = 180;
          containerWidth = containerHeight * aspectRatio;
        }
      }

      setContainerStyle({
        width: containerWidth,
        height: containerHeight,
        borderRadius: 8,
        marginBottom: 8,
        backgroundColor: '#F0F0F0',
        alignSelf: 'center',
      });
    }
  };

  return (
    <ThemedView style={{ position: 'relative', backgroundColor: 'transparent' }}>
      <Image
        source={{ uri: imageUrl }}
        style={containerStyle}
        resizeMode="contain"
        onLoad={handleImageLoad}
      />
      {onDeleteFile && (
        <TouchableOpacity
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            backgroundColor: 'rgba(255, 59, 48, 0.9)',
            borderRadius: 20,
            width: 36,
            height: 36,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onPress={onDeleteFile}
        >
          <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      )}
    </ThemedView>
  );
}

function ComplaintAudioPlayer({
  sourceUrl,
  label,
  onDeleteFile
}: {
  sourceUrl: string;
  label?: string;
  onDeleteFile?: () => void;
}) {
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
    } catch (error) {
      console.error('Error controlling audio player:', error);
    }
  };

  const resetAudio = () => {
    if (!player) return;
    try {
      player.seekTo(0);
      player.pause();
      setIsPlaying(false);
    } catch (error) {
      console.error('Error resetting audio player:', error);
    }
  };

  useEffect(() => {
    if (!status.playing && isPlaying && position >= duration && duration > 0) {
      setIsPlaying(false);
    }
  }, [status.playing, position, duration, isPlaying]);

  useEffect(() => {
    if (status.playing !== isPlaying) {
      setIsPlaying(status.playing);
    }
  }, [status.playing]);

  return (
    <ThemedView style={styles.audioPlayerContainer}>
      <ThemedView style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: label ? 8 : 0 }}>
        {label ? <ThemedText style={styles.audioLabel}>{label}</ThemedText> : <ThemedView />}
        {onDeleteFile && (
          <TouchableOpacity
            style={{
              backgroundColor: '#FF3B30',
              borderRadius: 20,
              width: 36,
              height: 36,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onPress={onDeleteFile}
          >
            <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </ThemedView>
      <ThemedView style={styles.audioPlayer}>
        <TouchableOpacity style={styles.playButton} onPress={togglePlayPause}>
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <ThemedText style={styles.audioTime}>
          {formatTime(position)} / {formatTime(duration)}
        </ThemedText>
        <TouchableOpacity style={styles.resetAudioButton} onPress={resetAudio}>
          <Ionicons name="refresh" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </ThemedView>
    </ThemedView>
  );
}

function ComplaintVideoPlayer({
  sourceUrl,
  onDeleteFile
}: {
  sourceUrl: string;
  onDeleteFile?: () => void;
}) {
  const player = useVideoPlayer(sourceUrl);
  const maxContainerWidth = Dimensions.get('window').width - 64;

  return (
    <View
      style={{
        marginBottom: 8,
        overflow: 'hidden',
        borderRadius: 8,
        backgroundColor: '#000000',
        width: maxContainerWidth,
        maxWidth: '100%',
        alignSelf: 'center',
        position: 'relative',
      }}
    >
      <VideoView
        player={player}
        style={{
          width: '100%',
          aspectRatio: 16 / 9,
          backgroundColor: '#000000',
        }}
        contentFit="contain"
        nativeControls={true}
        allowsFullscreen={true}
        allowsPictureInPicture={false}
      />
      {onDeleteFile && (
        <TouchableOpacity
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            backgroundColor: 'rgba(255, 59, 48, 0.9)',
            borderRadius: 20,
            width: 36,
            height: 36,
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
          }}
          onPress={onDeleteFile}
        >
          <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      )}
    </View>
  );
}

