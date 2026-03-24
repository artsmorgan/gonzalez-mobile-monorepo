import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import SignatureScreen from 'react-native-signature-canvas';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import * as Location from 'expo-location';
import * as DocumentPicker from 'expo-document-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import { jwtDecode } from 'jwt-decode';
import Constants from 'expo-constants';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import AppHeader from '@/components/AppHeader';
import AppFooter from '@/components/AppFooter';
import SlideMenu from '@/components/SlideMenu';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Collapsible } from '@/components/Collapsible';
import { useAuth } from '@/contexts/AuthContext';
import authedFetch from '@/hooks/authedFetch';
import { useQRScanner } from '@/hooks/useQRScanner';
import getHoraAccion from '@/hooks/getHoraAccion';
import { RootStackParamList } from '../App';
import { convertDateTimestampToLocalString } from '@/hooks/convertDateTimestampToLocalString';

type Nav = NativeStackNavigationProp<RootStackParamList, 'PermitRequest'>;
type PermitType = 'Con goce' | 'Sin goce';

type Turno = {
  id: number;
  cliente: string | null;
  sucursal: string | null;
  puesto: string | null;
  hora_inicio: string | null;
  hora_fin: string | null;
  tipo_turno: string | null;
  horas_duracion: string | null;
  reemplazo_id?: number | null;
  reemplazo_nombre?: string | null;
};

type PermitRecord = {
  id: number;
  empleado_id: number;
  estado?: string | null;
  tipo: string;
  fecha_inicio: string;
  fecha_fin: string;
  ejecutivo_cuenta: number;
  comentarios?: string | null;
  reemplazo_obligatorio?: number | null;
  turnos: Turno[];
  archivos?: PermitAttachment[];
  firma_ejecutivo_cuenta_digital?: string | null;
  firma_ejecutivo_cuenta_manual?: string | null;
  created_at: string;
  empleado_nombre?: string | null;
  reemplazo_obligatorio_nombre?: string | null;
  is_own_record?: boolean;
  can_complete_by_executive?: boolean;
  is_executive_for_record?: boolean;
};

type PermitAttachment = {
  id?: number;
  name: string;
  original_name?: string;
  extension?: string;
  type: string;
  is_main?: boolean;
};

type PlazaOption = {
  id: number;
  nombre_plaza: string;
  nombre_puesto: string | null;
  nombre_sucursal: string | null;
  nombre_cliente: string | null;
};

type AttachedDocument = {
  id: string;
  base64: string;
  extension: string;
  original_name: string;
  mimeType?: string;
  type: string;
  is_main: boolean;
};

const SIGNATURE_WEB_STYLE = `
.m-signature-pad--footer { display: none; margin: 0; }
.m-signature-pad { box-shadow: none; border: none; }
body,html { width: 100%; height: 100%; background: #ffffff; }
`;

const formatDateYMD = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatDateDMY = (value?: string | null) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
};

/** Acepta YYYY-MM-DD o DD-MM-YYYY (mismo criterio que VisitorsScreen). */
const normalizeDateToYMD = (value: string): string => {
  const raw = String(value || '').trim().split('T')[0];
  if (!raw) return '';
  const ymd = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
  const dmy = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  return '';
};

const permitRecordDateYmd = (value?: string | null): string => {
  if (!value) return '';
  try {
    const onlyDate = String(value).split('T')[0];
    return normalizeDateToYMD(onlyDate);
  } catch {
    return '';
  }
};

/** Fecha local medianoche desde YYYY-MM-DD (evita desfases al abrir el picker). */
const localDateFromYmd = (ymd: string): Date => {
  const normalized = normalizeDateToYMD(ymd);
  if (!normalized) return new Date();
  const [y, m, d] = normalized.split('-').map((x) => parseInt(x, 10));
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return new Date();
  return new Date(y, m - 1, d);
};

const formatYmdStringAsDMY = (ymd: string) => {
  const normalized = normalizeDateToYMD(ymd);
  if (!normalized) return '-';
  const [y, m, d] = normalized.split('-');
  return `${d}-${m}-${y}`;
};

/** Bucket para el filtro UI: pendiente | aprobado | rechazado */
const permitEstadoFilterBucket = (record: PermitRecord): 'pendiente' | 'aprobado' | 'rechazado' => {
  const raw = String(record?.estado || '').trim().toLowerCase();
  if (!raw || raw === 'pendiente') return 'pendiente';
  if (raw === 'rechazado') return 'rechazado';
  if (raw === 'completado' || raw === 'aprobado') return 'aprobado';
  return 'pendiente';
};

const decodeFirmaHash = (hash?: string | null): { sessionId: string; empleadoId: string; latitud: string; longitud: string; timestamp: string } | null => {
  try {
    if (!hash || String(hash).trim().length === 0) return null;
    const decoded = atob(String(hash));
    const parts = decoded.split(':');
    if (parts.length !== 5) return null;
    const [sessionId, empleadoId, latitud, longitud, timestamp] = parts;
    return { sessionId, empleadoId, latitud, longitud, timestamp };
  } catch {
    return null;
  }
};

const appendTokenToUrl = (url: string, accessToken?: string | null): string => {
  if (!url) return '';
  if (!accessToken || accessToken.trim().length === 0) return url;
  if (/[?&]token=/.test(url)) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}token=${encodeURIComponent(accessToken)}`;
};

const buildPermitRequestMediaUrl = (
  recordId: number,
  fileName: string,
  type: string,
  accessToken?: string | null
): string => {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) return '';
  if (!recordId || !fileName || !String(fileName).trim()) return '';
  const cleanType = String(type || '').toLowerCase().trim();
  const endpoint = cleanType === 'image'
    ? 'get-image'
    : cleanType === 'audio'
      ? 'get-audio'
      : cleanType === 'video'
        ? 'get-video'
        : 'get-file';
  return appendTokenToUrl(
    `${apiUrl}/api/permit-request/${recordId}/${endpoint}/${encodeURIComponent(String(fileName).trim())}`,
    accessToken
  );
};

export default function PermitRequestScreenV2() {
  const navigation = useNavigation<Nav>();
  const { employee, refreshAccessToken, logout, accessToken } = useAuth();
  const { scanQR, QRScannerComponent } = useQRScanner();

  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [records, setRecords] = useState<PermitRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [isCreating, setIsCreating] = useState(false);
  const [plazas, setPlazas] = useState<PlazaOption[]>([]);
  const [selectedPlazaId, setSelectedPlazaId] = useState<number | null>(null);
  const [isLoadingPlazas, setIsLoadingPlazas] = useState(false);
  const [tipo, setTipo] = useState<PermitType | ''>('');
  const [fechaInicio, setFechaInicio] = useState(new Date());
  const [fechaFin, setFechaFin] = useState(new Date());
  const [showDateInicio, setShowDateInicio] = useState(false);
  const [showDateFin, setShowDateFin] = useState(false);
  const [comentarios, setComentarios] = useState('');
  const [turnosPreview, setTurnosPreview] = useState<Turno[]>([]);
  const [turnosMessage, setTurnosMessage] = useState('');
  const [attachedDocuments, setAttachedDocuments] = useState<AttachedDocument[]>([]);
  const [firmaResponsable, setFirmaResponsable] = useState('');
  const [isGeneratingFirma, setIsGeneratingFirma] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const cameraRef = useRef<CameraView | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<PermitRecord | null>(null);
  const [turnosComplete, setTurnosComplete] = useState<Turno[]>([]);
  const [reemplazoObligatorio, setReemplazoObligatorio] = useState<number | null>(null);
  const [reemplazoObligatorioCode, setReemplazoObligatorioCode] = useState('');
  const [byTurnoCode, setByTurnoCode] = useState<Record<number, string>>({});
  const [firmaEjecutivoDigital, setFirmaEjecutivoDigital] = useState('');
  const [firmaEjecutivoManual, setFirmaEjecutivoManual] = useState('');
  const [isGeneratingFirmaEjecutivo, setIsGeneratingFirmaEjecutivo] = useState(false);
  const [isSavingComplete, setIsSavingComplete] = useState(false);

  const [currentPuestoNombre, setCurrentPuestoNombre] = useState<string | null>(null);

  const [isDrawModalVisible, setIsDrawModalVisible] = useState(false);
  const [isReadingSignature, setIsReadingSignature] = useState(false);
  const [signatureKey, setSignatureKey] = useState(0);
  const signatureRef = useRef<any>(null);
  const PERMIT_REQUEST_CACHE_KEY = 'permit_request_records_cache_v2';
  const isFetchingAllRef = useRef(false);
  const hasLoadedOnOpenRef = useRef(false);

  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  const [filterEstado, setFilterEstado] = useState<'all' | 'pendiente' | 'aprobado' | 'rechazado'>('all');
  const [filterNombreSolicitante, setFilterNombreSolicitante] = useState('');
  /** YYYY-MM-DD o null; primitivos para que el listado filtrado se recalcule siempre. */
  const [filterFechaDesde, setFilterFechaDesde] = useState<string | null>(null);
  const [filterFechaHasta, setFilterFechaHasta] = useState<string | null>(null);
  const [showFilterDesdePicker, setShowFilterDesdePicker] = useState(false);
  const [showFilterHastaPicker, setShowFilterHastaPicker] = useState(false);
  const [filterTipoListado, setFilterTipoListado] = useState<'all' | PermitType>('all');

  const resetPermitFilters = useCallback(() => {
    setFilterEstado('all');
    setFilterNombreSolicitante('');
    setFilterFechaDesde(null);
    setFilterFechaHasta(null);
    setShowFilterDesdePicker(false);
    setShowFilterHastaPicker(false);
    setFilterTipoListado('all');
  }, []);

  const getConnectionStatus = useCallback(async () => {
    const n = await Network.getNetworkStateAsync();
    return Boolean(n.isConnected && n.isInternetReachable);
  }, []);

  const loadCurrentMarcaInfo = useCallback(async () => {
    try {
      const cache = await AsyncStorage.getItem('current_marca');
      if (!cache) {
        setCurrentPuestoNombre("Indeterminado");
        return;
      }
      const marca = JSON.parse(cache);
      const nombrePuesto: string | null =
        marca?.puesto?.nombre != null ? String(marca.puesto.nombre).trim() : null;
      setCurrentPuestoNombre(nombrePuesto);
    } catch {
      setCurrentPuestoNombre("Indeterminado");
    }
  }, []);

  const generateFirmaHashForCurrentUser = async (): Promise<string | null> => {
    try {
      if (!employee?.id) return null;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'Se requiere ubicación para generar firma digital');
        return null;
      }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const token = await AsyncStorage.getItem('access_token');
      if (!token) return null;
      const decoded: any = jwtDecode(token);
      const sessionId = decoded?.sessionId || 'unknown';
      const timestamp = await getHoraAccion();
      if (!timestamp) return null;
      return btoa(`${sessionId}:${employee.id}:${location.coords.latitude}:${location.coords.longitude}:${timestamp}`);
    } catch {
      return null;
    }
  };

  const getEmpleadoByCodigo = async (codigo: string) => {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');
    const response = await authedFetch({
      url: `${apiUrl}/api/empleados/codigo/${encodeURIComponent(String(codigo).trim())}`,
      init: { method: 'GET', headers: { 'Content-Type': 'application/json' } },
      refreshAccessToken,
      logout,
    });
    if (!response) throw new Error('Sesión expirada');
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData?.message || 'No se pudo obtener el empleado por código');
    }
    const data = await response.json();
    if (!data?.status || !data?.data) throw new Error(data?.message || 'Empleado no encontrado');
    return data.data;
  };

  const getEmpleadoById = async (id: number) => {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');
    const response = await authedFetch({
      url: `${apiUrl}/api/empleados/${id}`,
      init: { method: 'GET', headers: { 'Content-Type': 'application/json' } },
      refreshAccessToken,
      logout,
    });
    if (!response) throw new Error('Sesión expirada');
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData?.message || 'No se pudo obtener el empleado por ID');
    }
    return await response.json();
  };

  const loadRecordsFromCache = useCallback(async () => {
    try {
      const cache = await AsyncStorage.getItem(PERMIT_REQUEST_CACHE_KEY);
      if (!cache) return;
      const parsed = JSON.parse(cache);
      if (!Array.isArray(parsed)) return;
      setRecords(parsed);
    } catch {
      // ignore cache parse errors
    }
  }, []);

  const fetchAll = useCallback(async () => {
    if (isFetchingAllRef.current) return;
    isFetchingAllRef.current = true;
    setIsLoading(true);
    setError(null);
    try {
      const online = await getConnectionStatus();
      setIsOnline(online);
      if (!online) {
        setError('Este módulo funciona únicamente con internet.');
        await loadRecordsFromCache();
        return;
      }
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) throw new Error('Server URL not configured');
      const mode = String(currentPuestoNombre || '').toLowerCase().includes('ejecutivo') ? '' : 'mine';
      const query = mode ? `?mode=${encodeURIComponent(mode)}` : '';
      const resp = await authedFetch({
        url: `${apiUrl}/api/permit-request${query}`,
        init: { method: 'GET', headers: { 'Content-Type': 'application/json' } },
        refreshAccessToken,
        logout,
      });
      if (!resp) throw new Error('Sesión expirada');
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.status) throw new Error(json?.message || 'No se pudieron cargar las solicitudes');
      const data = Array.isArray(json.data) ? json.data : [];
      setRecords(data);
      await AsyncStorage.setItem(PERMIT_REQUEST_CACHE_KEY, JSON.stringify(data));
    } catch (e: any) {
      setError(e?.message || 'Error al cargar solicitudes');
      await loadRecordsFromCache();
    } finally {
      setIsLoading(false);
      isFetchingAllRef.current = false;
    }
  }, [getConnectionStatus, refreshAccessToken, logout, loadRecordsFromCache, currentPuestoNombre]);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      if (hasLoadedOnOpenRef.current || !isMounted) return;
      hasLoadedOnOpenRef.current = true;
      await loadRecordsFromCache();
      if (!isMounted) return;
      await loadCurrentMarcaInfo();
      if (!isMounted) return;
      await fetchAll();
    })();
    return () => {
      isMounted = false;
    };
  }, [fetchAll, loadCurrentMarcaInfo, loadRecordsFromCache]);

  const closeCreateFormAndReloadList = useCallback(async () => {
    setIsCreating(false);
    await fetchAll();
  }, [fetchAll]);

  const closeCompleteFormAndReloadList = useCallback(async () => {
    setIsCompleteModalOpen(false);
    setSelectedRecord(null);
    await fetchAll();
  }, [fetchAll]);

  const fetchPlazas = useCallback(async () => {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) return;
    setIsLoadingPlazas(true);
    try {
      const resp = await authedFetch({
        url: `${apiUrl}/api/permit-request/plazas`,
        init: { method: 'GET', headers: { 'Content-Type': 'application/json' } },
        refreshAccessToken,
        logout,
      });
      if (!resp) throw new Error('Sesión expirada');
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.status) throw new Error(json?.message || 'No se pudieron cargar las plazas');
      const data = Array.isArray(json.data) ? json.data : [];
      const mapped = data.map((p: any) => ({
        id: Number(p.id),
        nombre_plaza: String(p.nombre_plaza ?? '').trim() || 'Plaza',
        nombre_puesto: p.nombre_puesto != null ? String(p.nombre_puesto).trim() : null,
        nombre_sucursal: p.nombre_sucursal != null ? String(p.nombre_sucursal).trim() : null,
        nombre_cliente: p.nombre_cliente != null ? String(p.nombre_cliente).trim() : null,
      }));
      setPlazas(mapped);
      if (mapped.length === 0) {
        setSelectedPlazaId(null);
        Alert.alert(
          'Sin plazas',
          'No se encontraron plazas asignadas a tu usuario. No puedes crear una solicitud de permiso sin una plaza válida.'
        );
      } else {
        setSelectedPlazaId(Number(mapped[0]?.id) || null);
      }
    } catch (e: any) {
      setPlazas([]);
      setSelectedPlazaId(null);
      Alert.alert('Error', e?.message || 'No se pudieron cargar las plazas');
    } finally {
      setIsLoadingPlazas(false);
    }
  }, [refreshAccessToken, logout]);

  const fetchTurnosPreview = async () => {
    if (!selectedPlazaId) {
      setTurnosMessage('Selecciona primero una plaza');
      return;
    }
    try {
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) throw new Error('Server URL not configured');
      const fi = formatDateYMD(fechaInicio);
      const ff = formatDateYMD(fechaFin);
      const resp = await authedFetch({
        url: `${apiUrl}/api/permit-request/turnos?fecha_inicio=${encodeURIComponent(fi)}&fecha_fin=${encodeURIComponent(ff)}&plaza_id=${encodeURIComponent(String(selectedPlazaId))}`,
        init: { method: 'GET', headers: { 'Content-Type': 'application/json' } },
        refreshAccessToken,
        logout,
      });
      if (!resp) throw new Error('Sesión expirada');
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.status) throw new Error(json?.message || 'No se pudieron obtener los turnos');
      const rows = Array.isArray(json.data) ? json.data : [];
      setTurnosPreview(rows);
      setTurnosMessage(rows.length ? '' : 'El usuario está libre en ese rango de fechas para esta plaza.');
    } catch (e: any) {
      setTurnosPreview([]);
      setTurnosMessage(e?.message || 'No se pudieron obtener los turnos');
    }
  };

  const handleGenerateFirmaResponsable = async () => {
    if (isGeneratingFirma) return;
    setIsGeneratingFirma(true);
    try {
      const hash = await generateFirmaHashForCurrentUser();
      if (!hash) {
        Alert.alert('Error', 'No se pudo generar la firma digital');
        return;
      }
      setFirmaResponsable(hash);
    } finally {
      setIsGeneratingFirma(false);
    }
  };

  const handleScanFirmaResponsable = async () => {
    try {
      const qrData = await scanQR();
      if (!qrData) return;
      setFirmaResponsable(qrData);
    } catch {
      Alert.alert('Error', 'No se pudo escanear el QR');
    }
  };

  const normalizeFileType = (mimeType?: string | null): 'image' | 'audio' | 'video' | 'text' => {
    const m = String(mimeType || '').toLowerCase();
    if (m.startsWith('image/')) return 'image';
    if (m.startsWith('audio/')) return 'audio';
    if (m.startsWith('video/')) return 'video';
    return 'text';
  };

  const markOneAsMain = (files: AttachedDocument[], mainId: string): AttachedDocument[] =>
    files.map((f) => ({ ...f, is_main: f.id === mainId }));

  const addAttachedDocument = (doc: Omit<AttachedDocument, 'id' | 'is_main'>) => {
    const id = `local_file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setAttachedDocuments((prev) => {
      const nextItem: AttachedDocument = { ...doc, id, is_main: prev.length === 0 };
      return [...prev, nextItem];
    });
  };

  const handlePickDocuments = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'audio/*', 'video/*', 'text/plain', 'text/csv', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      for (const asset of result.assets) {
        const fileResponse = await fetch(asset.uri);
        const blob = await fileResponse.blob();
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const raw = reader.result;
            if (typeof raw !== 'string') return reject(new Error('No se pudo leer archivo'));
            const parts = raw.split(',');
            resolve(parts.length > 1 ? parts[1] : parts[0]);
          };
          reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer archivo'));
          reader.readAsDataURL(blob);
        });
        const extension = String(asset.name || '').split('.').pop()?.toLowerCase()
          || String(asset.mimeType || '').split('/').pop()?.toLowerCase()
          || 'dat';
        addAttachedDocument({
          base64,
          extension,
          original_name: asset.name || `archivo.${extension}`,
          mimeType: asset.mimeType || undefined,
          type: normalizeFileType(asset.mimeType),
        });
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo adjuntar archivo(s)');
    }
  };

  const openCameraForPhoto = async () => {
    try {
      if (!cameraPermission?.granted) {
        const res = await requestCameraPermission();
        if (!res.granted) {
          Alert.alert('Permiso denegado', 'Se necesita permiso para usar la cámara');
          return;
        }
      }
      setIsCameraVisible(true);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo abrir la cámara');
    }
  };

  const capturePermitPhoto = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.7,
        skipProcessing: false,
      });
      if (!photo?.base64) {
        Alert.alert('Error', 'No se pudo capturar la foto');
        return;
      }
      const extension = 'jpg';
      addAttachedDocument({
        base64: photo.base64,
        extension,
        original_name: `foto_${Date.now()}.jpg`,
        mimeType: 'image/jpeg',
        type: 'image',
      });
      setIsCameraVisible(false);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo capturar la foto');
    }
  };

  const resetCreateForm = async () => {
    const horaAccion = await getHoraAccion();
    if (!horaAccion) {
      Alert.alert('Error', 'No se pudo obtener la hora');
      return;
    }
    setSelectedPlazaId(null);
    setTipo('');
    setFechaInicio(new Date(horaAccion));
    setFechaFin(new Date(horaAccion));
    setComentarios('');
    setTurnosPreview([]);
    setTurnosMessage('');
    setAttachedDocuments([]);
    setFirmaResponsable('');
  };

  const onPlazaChange = (plazaId: number | null) => {
    setSelectedPlazaId(plazaId);
    setTurnosPreview([]);
    setTurnosMessage(plazaId ? 'Cambiaste de plaza. Vuelve a buscar turnos.' : 'Selecciona una plaza y busca turnos.');
  };

  const handleCreate = async () => {
    if (!isOnline) return Alert.alert('Sin conexión', 'Este módulo funciona únicamente con internet');
    if (!selectedPlazaId) return Alert.alert('Error', 'Debes seleccionar una plaza');
    if (!tipo) return Alert.alert('Error', 'Debes seleccionar tipo de solicitud');
    if (!firmaResponsable) return Alert.alert('Error', 'Debes generar la firma responsable');
    if (!turnosPreview.length) return Alert.alert('Error', 'Debes consultar un rango con turnos disponibles');

    setIsSubmitting(true);
    try {
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) throw new Error('Server URL not configured');
      const payload: any = {
        plaza_id: selectedPlazaId,
        tipo,
        fecha_inicio: formatDateYMD(fechaInicio),
        fecha_fin: formatDateYMD(fechaFin),
        comentarios: comentarios.trim() || undefined,
        firma_responsable: firmaResponsable,
        files: attachedDocuments.map((f) => ({
          type: f.type,
          extension: f.extension,
          original_name: f.original_name,
          file_base64: f.base64,
          mimeType: f.mimeType,
          is_main: Boolean(f.is_main),
        })),
      };
      const resp = await authedFetch({
        url: `${apiUrl}/api/permit-request`,
        init: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
        refreshAccessToken,
        logout,
      });
      if (!resp) throw new Error('Sesión expirada');
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.status) throw new Error(json?.message || 'No se pudo crear');
      Alert.alert('Éxito', 'Solicitud creada correctamente');
      await resetCreateForm();
      await closeCreateFormAndReloadList();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo crear la solicitud');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openCompleteModal = (record: PermitRecord) => {
    const rows = Array.isArray(record.turnos) ? record.turnos : [];
    setSelectedRecord(record);
    setTurnosComplete(rows);
    setByTurnoCode({});
    setReemplazoObligatorio(record.reemplazo_obligatorio || null);
    setReemplazoObligatorioCode('');
    setFirmaEjecutivoDigital('');
    setFirmaEjecutivoManual('');
    setSignatureKey((v) => v + 1);
    setIsCompleteModalOpen(true);
  };

  const handleGenerateFirmaEjecutivo = async () => {
    if (isGeneratingFirmaEjecutivo) return;
    setIsGeneratingFirmaEjecutivo(true);
    try {
      const hash = await generateFirmaHashForCurrentUser();
      if (!hash) {
        Alert.alert('Error', 'No se pudo generar firma digital');
        return;
      }
      setFirmaEjecutivoDigital(hash);
    } finally {
      setIsGeneratingFirmaEjecutivo(false);
    }
  };

  const handleScanFirmaEjecutivo = async () => {
    try {
      const qrData = await scanQR();
      if (!qrData) return;
      setFirmaEjecutivoDigital(qrData);
    } catch {
      Alert.alert('Error', 'No se pudo escanear el QR');
    }
  };

  const assignReemplazoGlobalById = async (empId: number) => {
    const emp = await getEmpleadoById(empId);
    const nombre = [emp.nombre, emp.primer_apellido, emp.segundo_apellido].filter(Boolean).join(' ').trim();
    setReemplazoObligatorio(emp.id);
    setTurnosComplete((prev) => prev.map((t) => ({ ...t, reemplazo_id: emp.id, reemplazo_nombre: nombre || null })));
  };

  const handleAssignGlobalByCode = async () => {
    try {
      if (!reemplazoObligatorioCode.trim()) return Alert.alert('Error', 'Ingresa un código');
      const emp = await getEmpleadoByCodigo(reemplazoObligatorioCode.trim());
      await assignReemplazoGlobalById(Number(emp.id));
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo asignar reemplazo global');
    }
  };

  const handleAssignGlobalByQR = async () => {
    try {
      const qrData = await scanQR();
      if (!qrData) return;
      const decoded = atob(qrData).split(':');
      if (decoded.length < 2) return Alert.alert('Error', 'QR inválido');
      const empleadoId = Number(decoded[1]);
      if (!empleadoId) return Alert.alert('Error', 'QR inválido');
      await assignReemplazoGlobalById(empleadoId);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo leer QR');
    }
  };

  const assignTurnoById = async (turnoId: number, empId: number) => {
    const emp = await getEmpleadoById(empId);
    const nombre = [emp.nombre, emp.primer_apellido, emp.segundo_apellido].filter(Boolean).join(' ').trim();
    setTurnosComplete((prev) =>
      prev.map((t) => (t.id === turnoId ? { ...t, reemplazo_id: emp.id, reemplazo_nombre: nombre || null } : t))
    );
  };

  const handleAssignTurnoByCode = async (turnoId: number) => {
    try {
      const code = String(byTurnoCode[turnoId] || '').trim();
      if (!code) return Alert.alert('Error', 'Ingresa un código');
      const emp = await getEmpleadoByCodigo(code);
      await assignTurnoById(turnoId, Number(emp.id));
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo asignar reemplazo del turno');
    }
  };

  const handleAssignTurnoByQR = async (turnoId: number) => {
    try {
      const qrData = await scanQR();
      if (!qrData) return;
      const decoded = atob(qrData).split(':');
      if (decoded.length < 2) return Alert.alert('Error', 'QR inválido');
      const empleadoId = Number(decoded[1]);
      if (!empleadoId) return Alert.alert('Error', 'QR inválido');
      await assignTurnoById(turnoId, empleadoId);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo leer QR');
    }
  };

  const handleRemoveReemplazoFromTurno = (turnoId: number) => {
    setTurnosComplete((prev) =>
      prev.map((t) => (t.id === turnoId ? { ...t, reemplazo_id: null, reemplazo_nombre: null } : t))
    );
    setByTurnoCode((prev) => {
      const next = { ...prev };
      delete next[turnoId];
      return next;
    });
  };

  const openDrawModal = () => {
    setIsDrawModalVisible(true);
    setSignatureKey((v) => v + 1);
    setIsReadingSignature(false);
  };

  const clearSignatureInModal = () => {
    if (signatureRef.current?.clearSignature) signatureRef.current.clearSignature();
  };

  const onManualSignatureRead = (signature: string) => {
    const formatted = String(signature || '').includes('base64,')
      ? String(signature).split('base64,')[1]
      : String(signature || '');
    if (!formatted || formatted.length < 20) {
      setIsReadingSignature(false);
      Alert.alert('Error', 'Firma manual inválida');
      return;
    }
    setFirmaEjecutivoManual(formatted);
    setIsReadingSignature(false);
    setIsDrawModalVisible(false);
  };

  const acceptSignature = () => {
    if (!signatureRef.current?.readSignature) return;
    setIsReadingSignature(true);
    signatureRef.current.readSignature();
  };

  const saveCompletion = async () => {
    if (!selectedRecord) return;
    if (!firmaEjecutivoDigital) return Alert.alert('Error', 'Debes generar firma digital del ejecutivo');
    if (!firmaEjecutivoManual) return Alert.alert('Error', 'Debes generar firma manual del ejecutivo');

    setIsSavingComplete(true);
    try {
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) throw new Error('Server URL not configured');
      const resp = await authedFetch({
        url: `${apiUrl}/api/permit-request/${selectedRecord.id}`,
        init: {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reemplazo_obligatorio: reemplazoObligatorio,
            turnos: turnosComplete.map((t) => ({ id: t.id, reemplazo_id: t.reemplazo_id ?? null })),
            firma_ejecutivo_cuenta_digital: firmaEjecutivoDigital,
            firma_ejecutivo_cuenta_manual: firmaEjecutivoManual,
          }),
        },
        refreshAccessToken,
        logout,
      });
      if (!resp) throw new Error('Sesión expirada');
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.status) throw new Error(json?.message || 'No se pudo aprobar la solicitud');
      Alert.alert('Éxito', 'Solicitud aprobada correctamente');
      await closeCompleteFormAndReloadList();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo aprobar');
    } finally {
      setIsSavingComplete(false);
    }
  };

  const rejectRecord = async (record: PermitRecord) => {
    try {
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) throw new Error('Server URL not configured');
      const resp = await authedFetch({
        url: `${apiUrl}/api/permit-request/${record.id}/reject`,
        init: {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
        },
        refreshAccessToken,
        logout,
      });
      if (!resp) throw new Error('Sesión expirada');
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.status) throw new Error(json?.message || 'No se pudo rechazar la solicitud');
      Alert.alert('Éxito', 'Solicitud rechazada correctamente');
      await fetchAll();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo rechazar');
    }
  };

  const openAttachment = async (record: PermitRecord, file: PermitAttachment) => {
    try {
      if (!file?.name) return;
      const token = accessToken?.trim() || (await AsyncStorage.getItem('access_token'))?.trim() || '';
      const url = buildPermitRequestMediaUrl(record.id, file.name, file.type, token);
      if (!url) {
        Alert.alert('Error', 'No se pudo generar el enlace. Verifica tu sesión o la configuración del servidor.');
        return;
      }
      await Linking.openURL(url);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo acceder al archivo');
    }
  };

  const setMainAttachment = (fileId: string) => {
    setAttachedDocuments((prev) => markOneAsMain(prev, fileId));
  };

  const removeAttachment = (fileId: string) => {
    setAttachedDocuments((prev) => {
      const filtered = prev.filter((f) => f.id !== fileId);
      if (!filtered.some((f) => f.is_main) && filtered.length > 0) {
        filtered[0] = { ...filtered[0], is_main: true };
      }
      return filtered;
    });
  };

  const filteredRecords = useMemo(() => {
    const desdeYmd = filterFechaDesde ? normalizeDateToYMD(filterFechaDesde) : '';
    const hastaYmd = filterFechaHasta ? normalizeDateToYMD(filterFechaHasta) : '';
    const qNombre = filterNombreSolicitante.trim().toLowerCase();

    return records.filter((r) => {
      const bucket = permitEstadoFilterBucket(r);
      const matchesEstado = filterEstado === 'all' || bucket === filterEstado;

      const nombre = String(r.empleado_nombre || '').trim().toLowerCase();
      const matchesNombre =
        !qNombre ||
        nombre.includes(qNombre) ||
        String(r.empleado_id || '').includes(filterNombreSolicitante.trim());

      const tipoRec = String(r.tipo || '').trim().toLowerCase();
      const matchesTipo =
        filterTipoListado === 'all' || tipoRec === filterTipoListado.toLowerCase().trim();

      const inicioYmd = permitRecordDateYmd(r.fecha_inicio);
      const finYmd = permitRecordDateYmd(r.fecha_fin);
      let matchesRangoFechas = true;
      if (desdeYmd || hastaYmd) {
        if (!inicioYmd || !finYmd) {
          matchesRangoFechas = false;
        } else {
          const afterDesde = !desdeYmd || finYmd >= desdeYmd;
          const beforeHasta = !hastaYmd || inicioYmd <= hastaYmd;
          matchesRangoFechas = afterDesde && beforeHasta;
        }
      }

      return matchesEstado && matchesNombre && matchesTipo && matchesRangoFechas;
    });
  }, [records, filterEstado, filterNombreSolicitante, filterFechaDesde, filterFechaHasta, filterTipoListado]);

  return (
    <ThemedView style={styles.container}>
      <AppHeader title="Solicitud de permiso" onMenuPress={() => setIsMenuVisible(true)} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <ThemedView style={styles.content}>
          {!!error && <ThemedText style={styles.errorText}>{error}</ThemedText>}

          <ThemedView style={styles.titleContainer}>
            <ThemedText type="title" style={styles.title}>
              <Ionicons name="document-text" size={22} color="#000000" /> Solicitud de permiso
            </ThemedText>
            <ThemedText style={styles.subtitle}>Módulo exclusivamente online</ThemedText>
          </ThemedView>

          {!isOnline && (
            <ThemedView style={styles.errorBox}>
              <ThemedText style={styles.errorText}>Este módulo funciona únicamente con internet.</ThemedText>
            </ThemedView>
          )}


          {!isCreating && (
            <>
              <ThemedView style={styles.filtersContainer}>
                <ThemedView style={styles.filtersHeader}>
                  <TouchableOpacity
                    style={styles.filterToggleButton}
                    onPress={() => setIsFiltersExpanded(!isFiltersExpanded)}
                    activeOpacity={0.85}
                  >
                    <ThemedText style={styles.filtersTitle}>Filtros</ThemedText>
                    <Ionicons
                      name={isFiltersExpanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color="#007AFF"
                    />
                  </TouchableOpacity>
                  {isFiltersExpanded ? (
                    <TouchableOpacity style={styles.resetFiltersButton} onPress={resetPermitFilters} activeOpacity={0.85}>
                      <Ionicons name="refresh" size={16} color="#FF3B30" />
                      <ThemedText style={styles.resetFiltersText}>Reiniciar</ThemedText>
                    </TouchableOpacity>
                  ) : null}
                </ThemedView>
                {isFiltersExpanded ? (
                  <ThemedView style={styles.filtersContent}>
                    <ThemedView style={styles.filterGroupSearch}>
                      <ThemedText style={styles.filterLabel}>Estado:</ThemedText>
                      <ThemedView style={styles.pickerContainer}>
                        <Picker
                          selectedValue={filterEstado}
                          onValueChange={(v) => setFilterEstado(v as typeof filterEstado)}
                          style={styles.picker}
                        >
                          <Picker.Item label="Todos" value="all" color="#000000" />
                          <Picker.Item label="Pendiente" value="pendiente" color="#000000" />
                          <Picker.Item label="Aprobado" value="aprobado" color="#000000" />
                          <Picker.Item label="Rechazado" value="rechazado" color="#000000" />
                        </Picker>
                      </ThemedView>
                    </ThemedView>
                    <ThemedView style={styles.filterGroupSearch}>
                      <ThemedText style={styles.filterLabel}>Nombre del solicitante:</ThemedText>
                      <TextInput
                        style={styles.searchInput}
                        value={filterNombreSolicitante}
                        onChangeText={setFilterNombreSolicitante}
                        placeholder="Buscar por nombre o código de empleado..."
                        placeholderTextColor="#999"
                      />
                    </ThemedView>
                    <ThemedView style={styles.filterGroupSearch}>
                      <ThemedText style={styles.filterLabel}>Desde — período de la solicitud:</ThemedText>
                      <TouchableOpacity
                        style={styles.dateBtn}
                        onPress={() => setShowFilterDesdePicker(true)}
                        activeOpacity={0.85}
                      >
                        <ThemedText style={styles.filterDateBtnText}>
                          {filterFechaDesde ? formatYmdStringAsDMY(filterFechaDesde) : 'Tocar para elegir fecha'}
                        </ThemedText>
                      </TouchableOpacity>
                      {filterFechaDesde ? (
                        <TouchableOpacity onPress={() => setFilterFechaDesde(null)} style={styles.filterClearLinkWrap}>
                          <ThemedText style={styles.filterClearLink}>Quitar filtro de fecha</ThemedText>
                        </TouchableOpacity>
                      ) : null}
                      {showFilterDesdePicker ? (
                        <DateTimePicker
                          value={filterFechaDesde ? localDateFromYmd(filterFechaDesde) : new Date()}
                          mode="date"
                          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                          onChange={(event: { type?: string }, d?: Date) => {
                            if (Platform.OS === 'android') {
                              setShowFilterDesdePicker(false);
                              if (event?.type === 'dismissed') {
                                return;
                              }
                            } else {
                              setShowFilterDesdePicker(false);
                            }
                            if (d) {
                              setFilterFechaDesde(formatDateYMD(d));
                            }
                          }}
                        />
                      ) : null}
                    </ThemedView>
                    <ThemedView style={styles.filterGroupSearch}>
                      <ThemedText style={styles.filterLabel}>Hasta — período de la solicitud:</ThemedText>
                      <TouchableOpacity
                        style={styles.dateBtn}
                        onPress={() => setShowFilterHastaPicker(true)}
                        activeOpacity={0.85}
                      >
                        <ThemedText style={styles.filterDateBtnText}>
                          {filterFechaHasta ? formatYmdStringAsDMY(filterFechaHasta) : 'Tocar para elegir fecha'}
                        </ThemedText>
                      </TouchableOpacity>
                      {filterFechaHasta ? (
                        <TouchableOpacity onPress={() => setFilterFechaHasta(null)} style={styles.filterClearLinkWrap}>
                          <ThemedText style={styles.filterClearLink}>Quitar filtro de fecha</ThemedText>
                        </TouchableOpacity>
                      ) : null}
                      {showFilterHastaPicker ? (
                        <DateTimePicker
                          value={filterFechaHasta ? localDateFromYmd(filterFechaHasta) : new Date()}
                          mode="date"
                          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                          onChange={(event: { type?: string }, d?: Date) => {
                            if (Platform.OS === 'android') {
                              setShowFilterHastaPicker(false);
                              if (event?.type === 'dismissed') {
                                return;
                              }
                            } else {
                              setShowFilterHastaPicker(false);
                            }
                            if (d) {
                              setFilterFechaHasta(formatDateYMD(d));
                            }
                          }}
                        />
                      ) : null}
                    </ThemedView>
                    <ThemedView style={styles.filterGroupSearch}>
                      <ThemedText style={styles.filterLabel}>Tipo de solicitud:</ThemedText>
                      <ThemedView style={styles.pickerContainer}>
                        <Picker
                          selectedValue={filterTipoListado}
                          onValueChange={(v) => setFilterTipoListado(v as typeof filterTipoListado)}
                          style={styles.picker}
                        >
                          <Picker.Item label="Todos" value="all" color="#000000" />
                          <Picker.Item label="Con goce" value="Con goce" color="#000000" />
                          <Picker.Item label="Sin goce" value="Sin goce" color="#000000" />
                        </Picker>
                      </ThemedView>
                    </ThemedView>
                  </ThemedView>
                ) : null}
              </ThemedView>

              {!isLoading ? (
                <TouchableOpacity
                  style={[styles.createButton, !isOnline && styles.disabledButton]}
                  disabled={!isOnline}
                  onPress={() => {
                    resetCreateForm();
                    setIsCreating(true);
                    fetchPlazas();
                  }}
                  activeOpacity={0.85}
                >
                  <ThemedText style={styles.createButtonText}>
                    <Ionicons name="add" size={20} color="#FFFFFF" /> Nueva solicitud
                  </ThemedText>
                </TouchableOpacity>
              ) : null}

              {isLoading ? (
                <ThemedView style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#007AFF" />
                  <ThemedText style={styles.loadingText}>Cargando...</ThemedText>
                </ThemedView>
              ) : !records.length ? (
                <ThemedView style={styles.emptyContainer}>
                  <ThemedText style={styles.emptyText}>No hay solicitudes registradas</ThemedText>
                </ThemedView>
              ) : !filteredRecords.length ? (
                <ThemedView style={styles.emptyContainer}>
                  <ThemedText style={styles.emptyText}>No hay solicitudes que coincidan con los filtros actuales</ThemedText>
                </ThemedView>
              ) : (
                <ThemedView style={styles.listContainer}>
                  {filteredRecords.map((r) => (
                    <ThemedView key={r.id} style={styles.card}>
                      <ThemedText style={styles.cardTitle}>
                        Solicitud de {String(r.empleado_nombre || `empleado #${r.empleado_id}`)}
                      </ThemedText>
                      <ThemedText style={styles.cardLine}>
                        <ThemedText style={styles.cardLabel}>Estado: </ThemedText>{String(r.estado || '-')}
                      </ThemedText>
                      <ThemedText style={styles.cardLine}>
                        <ThemedText style={styles.cardLabel}>Tipo: </ThemedText>{r.tipo}
                      </ThemedText>
                      <ThemedText style={styles.cardLine}>
                        <ThemedText style={styles.cardLabel}>Inicio: </ThemedText>{formatDateDMY(r.fecha_inicio)}
                      </ThemedText>
                      <ThemedText style={styles.cardLine}>
                        <ThemedText style={styles.cardLabel}>Fin: </ThemedText>{formatDateDMY(r.fecha_fin)}
                      </ThemedText>
                      <ThemedText style={styles.cardLine}>
                        <ThemedText style={styles.cardLabel}>Turnos: </ThemedText>{Array.isArray(r.turnos) ? r.turnos.length : 0}
                      </ThemedText>
                      <ThemedText style={styles.cardLine}>
                        <ThemedText style={styles.cardLabel}>Adjuntos: </ThemedText>{Array.isArray(r.archivos) ? r.archivos.length : 0}
                      </ThemedText>
                      {!!r.archivos?.length && (
                        <Collapsible title="Ver adjuntos">
                          <ThemedView style={styles.attachmentsList}>
                            {r.archivos.map((file, idx) => {
                              const mediaUrl = buildPermitRequestMediaUrl(r.id, file.name, file.type, accessToken);
                              const displayName = String(file.original_name || file.name || `Archivo ${idx + 1}`);
                              const normalizedType = String(file.type || '').toLowerCase();
                              const isTextLike = normalizedType !== 'image' && normalizedType !== 'audio' && normalizedType !== 'video';
                              return (
                                <ThemedView key={`rf-${r.id}-${file.id || file.name}-${idx}`} style={styles.attachmentCard}>
                                  <ThemedText style={styles.attachmentName}>
                                    {file.is_main ? '⭐ ' : ''}{displayName}
                                  </ThemedText>
                                  <ThemedText style={styles.attachmentMeta}>Tipo: {normalizedType || 'file'}</ThemedText>
                                  {!Boolean(r.is_executive_for_record) ? (
                                    <ThemedText style={styles.signatureHintMuted}>Disponible para el ejecutivo asignado.</ThemedText>
                                  ) : normalizedType === 'image' ? (
                                    <Image source={{ uri: mediaUrl }} style={styles.attachmentImage} resizeMode="contain" />
                                  ) : normalizedType === 'audio' ? (
                                    <PermitAudioPlayer sourceUrl={mediaUrl} />
                                  ) : normalizedType === 'video' ? (
                                    <PermitVideoPlayer sourceUrl={mediaUrl} />
                                  ) : null}
                                  {Boolean(r.is_executive_for_record) && isTextLike && (
                                    <TouchableOpacity
                                      style={[styles.actionBtn, styles.downloadBtn, { marginTop: 8 }]}
                                      onPress={() => openAttachment(r, file)}
                                      activeOpacity={0.85}
                                    >
                                      <Ionicons name="download-outline" size={18} color="#FFFFFF" />
                                      <ThemedText style={styles.actionBtnText}>Descargar</ThemedText>
                                    </TouchableOpacity>
                                  )}
                                </ThemedView>
                              );
                            })}
                          </ThemedView>
                        </Collapsible>
                      )}

                      <ThemedView style={styles.actionsRow}>
                        {Boolean(r.can_complete_by_executive) && (
                          <>
                            <TouchableOpacity
                              style={[styles.actionBtn, styles.completeBtn]}
                              onPress={() => openCompleteModal(r)}
                              activeOpacity={0.85}
                            >
                              <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                              <ThemedText style={styles.actionBtnText}>Aprobar</ThemedText>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.actionBtn, styles.rejectBtn]}
                              onPress={() =>
                                Alert.alert(
                                  'Confirmar rechazo',
                                  'Esta solicitud será rechazada. ¿Deseas continuar?',
                                  [
                                    { text: 'Cancelar', style: 'cancel' },
                                    { text: 'Rechazar', style: 'destructive', onPress: () => rejectRecord(r) },
                                  ],
                                  { cancelable: true }
                                )
                              }
                              activeOpacity={0.85}
                            >
                              <Ionicons name="close-circle-outline" size={18} color="#FFFFFF" />
                              <ThemedText style={styles.actionBtnText}>Rechazar</ThemedText>
                            </TouchableOpacity>
                          </>
                        )}
                      </ThemedView>
                    </ThemedView>
                  ))}
                </ThemedView>
              )}
            </>
          )}

          {isCreating && (
            <ThemedView style={styles.formCard}>
              {currentPuestoNombre && (
                <ThemedText style={styles.currentPuestoText}>
                  Puesto actual:{' '}
                  <ThemedText style={styles.currentPuestoName}>{currentPuestoNombre}</ThemedText>
                </ThemedText>
              )}
              <ThemedText style={styles.label}>Tipo de solicitud *</ThemedText>
              <View style={styles.pickerWrap}>
                <Picker selectedValue={tipo} onValueChange={(v) => setTipo(v as PermitType | '')}>
                  <Picker.Item label="Seleccionar" value="" color="#000000" />
                  <Picker.Item label="Con goce" value="Con goce" color="#000000" />
                  <Picker.Item label="Sin goce" value="Sin goce" color="#000000" />
                </Picker>
              </View>
              <ThemedText style={styles.label}>Plaza *</ThemedText>
              {isLoadingPlazas ? (
                <ThemedView style={{ paddingVertical: 12 }}>
                  <ActivityIndicator size="small" color="#007AFF" />
                  <ThemedText style={styles.signatureHintMuted}>Cargando plazas...</ThemedText>
                </ThemedView>
              ) : (
                <View style={styles.plazasList}>
                  {plazas.map((p) => (
                    <TouchableOpacity
                      key={p.id}
                      style={[
                        styles.plazaCard,
                        selectedPlazaId === p.id && styles.plazaCardSelected,
                      ]}
                      onPress={() => onPlazaChange(selectedPlazaId === p.id ? null : p.id)}
                      activeOpacity={0.85}
                    >
                      <ThemedText style={styles.plazaCardTitle}>{p.nombre_plaza}</ThemedText>
                      <ThemedText style={styles.cardLine}>
                        <ThemedText style={styles.cardLabel}>Puesto: </ThemedText>
                        {p.nombre_puesto ?? '-'}
                      </ThemedText>
                      <ThemedText style={styles.cardLine}>
                        <ThemedText style={styles.cardLabel}>Sucursal: </ThemedText>
                        {p.nombre_sucursal ?? '-'}
                      </ThemedText>
                      <ThemedText style={styles.cardLine}>
                        <ThemedText style={styles.cardLabel}>Cliente: </ThemedText>
                        {p.nombre_cliente ?? '-'}
                      </ThemedText>
                      {selectedPlazaId === p.id && (
                        <ThemedView style={styles.plazaCardBadge}>
                          <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                          <ThemedText style={styles.plazaCardBadgeText}>Seleccionada</ThemedText>
                        </ThemedView>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}


              <ThemedText style={styles.label}>Fecha inicio *</ThemedText>
              <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDateInicio(true)}>
                <ThemedText>{formatDateDMY(fechaInicio.toISOString())}</ThemedText>
              </TouchableOpacity>
              {showDateInicio && (
                <DateTimePicker
                  value={fechaInicio}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_, d) => {
                    setShowDateInicio(false);
                    if (d) setFechaInicio(d);
                  }}
                />
              )}

              <ThemedText style={styles.label}>Fecha fin *</ThemedText>
              <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDateFin(true)}>
                <ThemedText>{formatDateDMY(fechaFin.toISOString())}</ThemedText>
              </TouchableOpacity>
              {showDateFin && (
                <DateTimePicker
                  value={fechaFin}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_, d) => {
                    setShowDateFin(false);
                    if (d) setFechaFin(d);
                  }}
                />
              )}

              <TouchableOpacity style={styles.secondaryAction} onPress={fetchTurnosPreview}>
                <ThemedText style={styles.secondaryActionText}>Buscar turnos</ThemedText>
              </TouchableOpacity>
              {!!turnosMessage && <ThemedText style={styles.warningText}>{turnosMessage}</ThemedText>}

              {!!turnosPreview.length && (
                <View style={styles.turnosBox}>
                  {turnosPreview.map((t) => (
                    <View key={t.id} style={styles.turnoRow}>
                      <ThemedText style={styles.turnoText}>#{t.id} | {t.cliente || '-'} | {t.sucursal || '-'} | {t.puesto || '-'}</ThemedText>
                      <ThemedText style={styles.turnoText}>{t.hora_inicio || '-'} - {t.hora_fin || '-'} | {t.tipo_turno || '-'}</ThemedText>
                    </View>
                  ))}
                </View>
              )}

              <ThemedText style={styles.label}>Comentarios</ThemedText>
              <TextInput
                style={styles.textArea}
                multiline
                numberOfLines={4}
                value={comentarios}
                onChangeText={setComentarios}
                placeholder="Opcional"
                placeholderTextColor="#999"
              />

              <ThemedText style={styles.label}>Adjuntos (opcional)</ThemedText>
              <ThemedView style={styles.attachButtonsRow}>
                <TouchableOpacity style={[styles.secondaryAction, { backgroundColor: '#007AFF', gap: 6 }]} onPress={handlePickDocuments}>
                  <ThemedText style={styles.secondaryActionText}>Adjuntar archivo(s)</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.secondaryAction, { backgroundColor: '#34C759', gap: 6 }]} onPress={openCameraForPhoto}>
                  <ThemedText style={styles.secondaryActionText}>Abrir cámara</ThemedText>
                </TouchableOpacity>
              </ThemedView>
              {!!attachedDocuments.length && (
                <ThemedView style={styles.attachmentsList}>
                  {attachedDocuments.map((f, idx) => (
                    <ThemedView key={f.id} style={styles.attachmentCard}>
                      <ThemedText style={styles.attachmentName}>{f.original_name}</ThemedText>
                      <ThemedText style={styles.attachmentMeta}>Tipo: {f.type}</ThemedText>
                      <ThemedView style={styles.mainCheckRow}>
                        <TouchableOpacity onPress={() => setMainAttachment(f.id)} style={styles.checkboxSquare} activeOpacity={0.8}>
                          {f.is_main ? <Ionicons name="checkmark" size={16} color="#007AFF" /> : null}
                        </TouchableOpacity>
                        <ThemedText style={styles.mainCheckText}>Descatar</ThemedText>
                        <TouchableOpacity onPress={() => removeAttachment(f.id)} style={styles.removeAttachmentBtn} activeOpacity={0.8}>
                          <Ionicons name="trash-outline" size={16} color="#FFFFFF" />
                        </TouchableOpacity>
                      </ThemedView>
                      {f.type === 'image' ? (
                        <Image
                          source={{ uri: `data:${f.mimeType || 'image/jpeg'};base64,${f.base64}` }}
                          style={styles.attachmentImage}
                          resizeMode="contain"
                        />
                      ) : null}
                      {idx === 0 && !attachedDocuments.some((x) => x.is_main) ? (
                        <ThemedText style={styles.warningText}>Se marcará como destacado automáticamente.</ThemedText>
                      ) : null}
                    </ThemedView>
                  ))}
                </ThemedView>
              )}

              <ThemedText style={styles.sectionTitle}>Firma responsable *</ThemedText>
              <ThemedView style={styles.signatureButtons}>
                <TouchableOpacity
                  style={[styles.signatureButton, isGeneratingFirma && styles.signatureButtonDisabled]}
                  onPress={handleGenerateFirmaResponsable}
                  disabled={isGeneratingFirma}
                  activeOpacity={0.85}
                >
                  {isGeneratingFirma ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="finger-print" size={18} color="#FFFFFF" />
                      <ThemedText style={styles.signatureButtonText}>Generar</ThemedText>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={styles.signatureButton} onPress={handleScanFirmaResponsable} activeOpacity={0.85}>
                  <Ionicons name="qr-code" size={18} color="#FFFFFF" />
                  <ThemedText style={styles.signatureButtonText}>Escanear QR</ThemedText>
                </TouchableOpacity>
              </ThemedView>

              {!firmaResponsable ? (
                <ThemedText style={styles.signatureHintMuted}>Aún no hay firma responsable.</ThemedText>
              ) : (
                <ThemedView style={styles.firmaInfoBox}>
                  <ThemedView style={{ flex: 1, paddingRight: 10 }}>
                    <ThemedText style={styles.firmaInfoTitle}>Información de la firma:</ThemedText>
                    {(() => {
                      const info = decodeFirmaHash(firmaResponsable);
                      if (!info) {
                        return <ThemedText style={styles.firmaInfoValue}>Formato no decodificable</ThemedText>;
                      }
                      return (
                        <>
                          <ThemedText style={styles.firmaInfoValue}>Sesión: {info.sessionId || 'N/A'}</ThemedText>
                          <ThemedText style={styles.firmaInfoValue}>Empleado: {info.empleadoId || 'N/A'}</ThemedText>
                          <ThemedText style={styles.firmaInfoValue}>Lat: {info.latitud || 'N/A'} | Long: {info.longitud || 'N/A'}</ThemedText>
                          <ThemedText style={styles.firmaInfoValue}>Hora: { convertDateTimestampToLocalString(new Date(Number(info.timestamp)).toISOString()) || 'N/A'}</ThemedText>
                        </>
                      );
                    })()}
                  </ThemedView>
                  <TouchableOpacity style={styles.firmaClearButtonTiny} onPress={() => setFirmaResponsable('')} activeOpacity={0.85}>
                    <Ionicons name="trash" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </ThemedView>
              )}

              <View style={styles.rowButtons}>
                <TouchableOpacity style={[styles.secondaryButton, { backgroundColor: '#8E8E93' }]} onPress={closeCreateFormAndReloadList}>
                  <ThemedText style={styles.secondaryButtonText}>Cancelar</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.secondaryButton, { backgroundColor: '#007AFF' }]} onPress={handleCreate} disabled={isSubmitting}>
                  {isSubmitting ? <ActivityIndicator size="small" color="#fff" /> : <ThemedText style={styles.secondaryButtonText}>Guardar</ThemedText>}
                </TouchableOpacity>
              </View>
            </ThemedView>
          )}
        </ThemedView>
      </ScrollView>

      <Modal visible={isCompleteModalOpen} transparent animationType="fade" onRequestClose={closeCompleteFormAndReloadList}>
        <View style={styles.overlay}>
          <ThemedView style={styles.floatCard}>
            <View style={styles.floatHeader}>
              <ThemedText style={styles.modalTitle}>Aprobar solicitud #{selectedRecord?.id}</ThemedText>
              <TouchableOpacity onPress={closeCompleteFormAndReloadList}>
                <Ionicons name="close" size={22} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 560 }} contentContainerStyle={{ padding: 12 }}>
              <ThemedText style={styles.label}>Asignar reemplazo a todos</ThemedText>
              <View style={styles.inlineRow}>
                <TextInput
                  style={styles.codeInput}
                  placeholder="Código empleado"
                  placeholderTextColor="#999"
                  value={reemplazoObligatorioCode}
                  onChangeText={setReemplazoObligatorioCode}
                />
                <TouchableOpacity style={styles.inlineButton} onPress={handleAssignGlobalByCode}>
                  <ThemedText style={styles.inlineButtonText}>Buscar</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity style={styles.inlineButton} onPress={handleAssignGlobalByQR}>
                  <Ionicons name="qr-code" size={18} color="#fff" />
                </TouchableOpacity>
              </View>

              {turnosComplete.map((t) => (
                <View key={t.id} style={styles.turnoCard}>
                  <ThemedText style={styles.turnoText}>
                    Turno: #{t.id} | Cliente: {t.cliente || '-'} | Sucursal: {t.sucursal || '-'} | Puesto: {t.puesto || '-'}
                  </ThemedText>
                  <ThemedText style={styles.turnoText}>
                    Inicio: {t.hora_inicio || '-'} | Fin: {t.hora_fin || '-'} | Tipo: {t.tipo_turno || '-'} | Duración: {t.horas_duracion ?? '-'} h
                  </ThemedText>
                  <ThemedText style={styles.turnoText}>
                    Reemplazo:{' '}
                    <ThemedText style={[styles.turnoText, t.reemplazo_nombre ? styles.reemplazoAsignado : undefined]}>
                      {t.reemplazo_nombre || '-'}
                    </ThemedText>
                  </ThemedText>
                  {t.reemplazo_nombre ? (
                    <TouchableOpacity style={styles.removeReemplazoButton} onPress={() => handleRemoveReemplazoFromTurno(t.id)} activeOpacity={0.85}>
                      <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
                      <ThemedText style={styles.removeReemplazoButtonText}>Eliminar reemplazo</ThemedText>
                    </TouchableOpacity>
                  ) : (
                    <>
                      <ThemedText style={styles.labelSmall}>Asignar reemplazo</ThemedText>
                      <View style={styles.inlineRow}>
                        <TextInput
                          style={styles.codeInput}
                          placeholder="Código"
                          placeholderTextColor="#999"
                          value={byTurnoCode[t.id] || ''}
                          onChangeText={(txt) => setByTurnoCode((prev) => ({ ...prev, [t.id]: txt }))}
                        />
                        <TouchableOpacity style={styles.inlineButton} onPress={() => handleAssignTurnoByCode(t.id)}>
                          <ThemedText style={styles.inlineButtonText}>Buscar</ThemedText>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.inlineButton} onPress={() => handleAssignTurnoByQR(t.id)}>
                          <Ionicons name="qr-code" size={18} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </View>
              ))}

              <ThemedText style={styles.sectionTitle}>Firma digital ejecutivo *</ThemedText>
              <ThemedView style={styles.signatureButtons}>
                <TouchableOpacity
                  style={[styles.signatureButton, isGeneratingFirmaEjecutivo && styles.signatureButtonDisabled]}
                  onPress={handleGenerateFirmaEjecutivo}
                  disabled={isGeneratingFirmaEjecutivo}
                  activeOpacity={0.85}
                >
                  {isGeneratingFirmaEjecutivo ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="finger-print" size={18} color="#FFFFFF" />
                      <ThemedText style={styles.signatureButtonText}>Generar</ThemedText>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={styles.signatureButton} onPress={handleScanFirmaEjecutivo} activeOpacity={0.85}>
                  <Ionicons name="qr-code" size={18} color="#FFFFFF" />
                  <ThemedText style={styles.signatureButtonText}>Escanear QR</ThemedText>
                </TouchableOpacity>
              </ThemedView>

              {!firmaEjecutivoDigital ? (
                <ThemedText style={styles.signatureHintMuted}>Aún no hay firma digital ejecutivo.</ThemedText>
              ) : (
                <ThemedView style={styles.firmaInfoBox}>
                  <ThemedView style={{ flex: 1, paddingRight: 10 }}>
                    <ThemedText style={styles.firmaInfoTitle}>Información de la firma:</ThemedText>
                    {(() => {
                      const info = decodeFirmaHash(firmaEjecutivoDigital);
                      if (!info) {
                        return <ThemedText style={styles.firmaInfoValue}>Formato no decodificable</ThemedText>;
                      }
                      return (
                        <>
                          <ThemedText style={styles.firmaInfoValue}>Sesión: {info.sessionId || 'N/A'}</ThemedText>
                          <ThemedText style={styles.firmaInfoValue}>Empleado: {info.empleadoId || 'N/A'}</ThemedText>
                          <ThemedText style={styles.firmaInfoValue}>Lat: {info.latitud || 'N/A'} | Long: {info.longitud || 'N/A'}</ThemedText>
                          <ThemedText style={styles.firmaInfoValue}>Hora: { convertDateTimestampToLocalString(new Date(Number(info.timestamp)).toISOString()) || 'N/A'}</ThemedText>
                        </>
                      );
                    })()}
                  </ThemedView>
                  <TouchableOpacity style={styles.firmaClearButtonTiny} onPress={() => setFirmaEjecutivoDigital('')} activeOpacity={0.85}>
                    <Ionicons name="trash" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </ThemedView>
              )}

              <TouchableOpacity style={styles.secondaryAction} onPress={openDrawModal}>
                <ThemedText style={styles.secondaryActionText}>
                  {firmaEjecutivoManual ? 'Firma manual lista (editar)' : 'Dibujar firma manual ejecutivo'}
                </ThemedText>
              </TouchableOpacity>

              {firmaEjecutivoManual ? (
                <View style={styles.firmaManualPreviewWrap}>
                  <ThemedText style={styles.labelSmall}>Vista previa de la firma manual</ThemedText>
                  <Image
                    source={{ uri: `data:image/png;base64,${firmaEjecutivoManual}` }}
                    style={styles.firmaManualPreviewImage}
                    resizeMode="contain"
                  />
                  <TouchableOpacity style={styles.removeReemplazoButton} onPress={() => setFirmaEjecutivoManual('')} activeOpacity={0.85}>
                    <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
                    <ThemedText style={styles.removeReemplazoButtonText}>Borrar firma manual</ThemedText>
                  </TouchableOpacity>
                </View>
              ) : null}

              <View style={styles.rowButtons}>
                <TouchableOpacity style={[styles.secondaryButton, { backgroundColor: '#8E8E93' }]} onPress={closeCompleteFormAndReloadList}>
                  <ThemedText style={styles.secondaryButtonText}>Cancelar</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.secondaryButton, { backgroundColor: '#007AFF' }]} onPress={saveCompletion} disabled={isSavingComplete}>
                  {isSavingComplete ? <ActivityIndicator size="small" color="#fff" /> : <ThemedText style={styles.secondaryButtonText}>Guardar</ThemedText>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </ThemedView>
        </View>
      </Modal>

      <Modal visible={isDrawModalVisible} transparent animationType="fade" onRequestClose={() => setIsDrawModalVisible(false)}>
        <View style={styles.overlay}>
          <ThemedView style={styles.floatCard}>
            <View style={styles.floatHeader}>
              <ThemedText style={styles.modalTitle}>Firma manual ejecutivo</ThemedText>
              <TouchableOpacity onPress={() => setIsDrawModalVisible(false)}>
                <Ionicons name="close" size={22} color="#333" />
              </TouchableOpacity>
            </View>
            <View style={{ height: 280, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#E0E0E0' }}>
              <SignatureScreen
                ref={signatureRef}
                key={signatureKey}
                onOK={onManualSignatureRead}
                onEmpty={() => {
                  setIsReadingSignature(false);
                  Alert.alert('Error', 'La firma manual está vacía');
                }}
                autoClear={false}
                webStyle={SIGNATURE_WEB_STYLE}
                imageType="image/png"
              />
            </View>
            <View style={styles.rowButtonsModal}>
              <TouchableOpacity style={[styles.secondaryButton, { backgroundColor: '#8E8E93' }]} onPress={clearSignatureInModal}>
                <ThemedText style={styles.secondaryButtonText}>Limpiar</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.secondaryButton, { backgroundColor: '#007AFF' }]} onPress={acceptSignature} disabled={isReadingSignature}>
                {isReadingSignature ? <ActivityIndicator size="small" color="#fff" /> : <ThemedText style={styles.secondaryButtonText}>Guardar</ThemedText>}
              </TouchableOpacity>
            </View>
          </ThemedView>
        </View>
      </Modal>

      {/* Cámara pantalla aprobar (mismo patrón que ActivitiesScreen) */}
      <Modal visible={isCameraVisible} animationType="slide" onRequestClose={() => setIsCameraVisible(false)}>
        <ThemedView style={{ flex: 1, backgroundColor: '#000' }}>
          <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back">
            <TouchableOpacity style={styles.cameraCloseButton} onPress={() => setIsCameraVisible(false)}>
              <Ionicons name="close" size={30} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.cameraCaptureButton} onPress={capturePermitPhoto}>
              <ThemedView style={styles.cameraCaptureButtonInner} />
            </TouchableOpacity>
          </CameraView>
        </ThemedView>
      </Modal>

      <AppFooter />
      <SlideMenu
        isVisible={isMenuVisible}
        onClose={() => setIsMenuVisible(false)}
        onHomePress={() => navigation.navigate('Home')}
        currentRoute="PermitRequest"
      />
      {QRScannerComponent}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },
  content: { width: '100%', maxWidth: 860, alignSelf: 'center' },

  titleContainer: { alignItems: 'center', marginBottom: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  title: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, opacity: 0.7, textAlign: 'center' },
  currentPuestoText: { marginTop: 6, fontSize: 13, textAlign: 'center', color: '#555' },
  currentPuestoName: { fontWeight: '700', color: '#000' },

  errorBox: { backgroundColor: '#FCE8E6', borderRadius: 8, padding: 12, marginBottom: 12 },
  errorText: { color: '#FF3B30', textAlign: 'center', marginBottom: 12, fontWeight: '700' },

  loadingContainer: { padding: 20, alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 14, color: '#000', opacity: 0.7 },
  emptyContainer: { padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 14, opacity: 0.6, textAlign: 'center', color: '#000' },

  createButton: { backgroundColor: '#007AFF', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginBottom: 16 },
  createButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  disabledButton: { opacity: 0.6 },

  filtersContainer: {
    width: '100%',
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  filtersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  filterToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#F8F9FA',
  },
  filtersTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  filtersContent: {
    padding: 16,
    gap: 10,
    backgroundColor: '#F8F9FA',
  },
  filterGroupSearch: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  filterDateBtnText: {
    fontSize: 16,
    color: '#000',
  },
  filterClearLinkWrap: {
    marginTop: 6,
  },
  filterClearLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  searchInput: {
    width: '100%',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: '#F9F9F9',
    color: '#000000',
  },
  resetFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  resetFiltersText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF3B30',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
    overflow: 'hidden',
  },
  picker: {
    width: '100%',
    height: 50,
  },

  listContainer: {},
  card: { backgroundColor: '#FFFFFF', borderRadius: 8, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  cardTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10, color: '#000' },
  cardLine: { marginBottom: 6, color: '#000' },
  cardLabel: { fontWeight: '700', color: '#333' },

  actionsRow: { marginTop: 12, flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  actionBtn: { minWidth: 150, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, gap: 8 },
  completeBtn: { backgroundColor: '#007AFF' },
  rejectBtn: { backgroundColor: '#FF3B30' },
  downloadBtn: { backgroundColor: '#34C759' },
  actionBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  rowButtons: { flexDirection: 'row', gap: 8, marginTop: 8 },
  secondaryButton: { flex: 1, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  secondaryButtonText: { color: '#fff', fontWeight: '700' },
  formCard: { marginTop: 12, backgroundColor: '#fff', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#E0E0E0', gap: 8 },
  sectionTitle: { marginTop: 14, fontSize: 15, fontWeight: '800', color: '#007AFF' },

  signatureButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, backgroundColor: '#fff', marginTop: 8 },
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
  signatureButtonDisabled: { backgroundColor: '#999' },
  signatureButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', marginLeft: 8 },
  signatureHintMuted: { marginTop: 6, color: '#999' },

  firmaInfoBox: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
  },
  firmaInfoTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8, color: '#333' },
  firmaInfoValue: { fontSize: 13, color: '#333', marginBottom: 4 },
  firmaClearButtonTiny: { width: 38, height: 38, borderRadius: 8, backgroundColor: '#FF3B30', alignItems: 'center', justifyContent: 'center' },

  label: { fontWeight: '700', fontSize: 13 },
  labelSmall: { fontWeight: '700', fontSize: 12, marginTop: 6 },
  pickerWrap: { borderWidth: 1, borderColor: '#DDD', borderRadius: 8, overflow: 'hidden' },
  dateBtn: { borderWidth: 1, borderColor: '#DDD', borderRadius: 8, padding: 12, backgroundColor: '#F7F7F7' },
  secondaryAction: { backgroundColor: '#0A84FF', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  secondaryActionText: { color: '#fff', fontWeight: '700' },
  attachButtonsRow: { flexDirection: 'column', width: '100%', gap: 8 },
  attachmentsList: { gap: 8, marginTop: 8 },
  attachmentCard: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, padding: 10, backgroundColor: '#FAFAFA' },
  attachmentName: { fontWeight: '700', color: '#222' },
  attachmentMeta: { marginTop: 4, marginBottom: 6, fontSize: 12, color: '#555' },
  attachmentImage: { width: '100%', height: 190, borderRadius: 8, backgroundColor: '#00000010' },
  mainCheckRow: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkboxSquare: { width: 22, height: 22, borderWidth: 1, borderColor: '#007AFF', borderRadius: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  mainCheckText: { fontWeight: '700', color: '#333' },
  removeAttachmentBtn: { marginLeft: 'auto', width: 28, height: 28, borderRadius: 6, backgroundColor: '#FF3B30', alignItems: 'center', justifyContent: 'center' },
  warningText: { color: '#C62828', fontWeight: '700' },
  turnosBox: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, overflow: 'hidden' },
  turnoRow: { padding: 8, borderBottomWidth: 1, borderBottomColor: '#F0F0F0', backgroundColor: '#FAFAFA' },
  turnoText: { fontSize: 12 },
  reemplazoAsignado: { color: '#228B22', fontWeight: '600' },
  removeReemplazoButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#FF3B30', borderRadius: 8, alignSelf: 'flex-start', marginTop: 4 },
  removeReemplazoButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  firmaManualPreviewWrap: { marginTop: 12, padding: 10, borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, backgroundColor: '#FAFAFA' },
  firmaManualPreviewImage: { width: '100%', height: 140, marginTop: 6 },
  textArea: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    minHeight: 88,
    padding: 10,
    color: '#000',
    textAlignVertical: 'top',
  },
  fileText: { fontSize: 12, color: '#333' },
  cameraCloseButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 25,
    padding: 10,
  },
  cameraCaptureButton: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#fff',
  },
  cameraCaptureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  floatCard: { width: '100%', maxWidth: 820, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden' },
  floatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: { fontSize: 16, fontWeight: '800' },
  inlineRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 4, marginBottom: 8 },
  codeInput: { flex: 1, borderWidth: 1, borderColor: '#DDD', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: '#000' },
  inlineButton: { backgroundColor: '#007AFF', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, alignItems: 'center', justifyContent: 'center' },
  inlineButtonText: { color: '#fff', fontWeight: '700' },
  turnoCard: { borderWidth: 1, borderColor: '#E7E7E7', borderRadius: 8, padding: 8, marginBottom: 8, backgroundColor: '#FAFAFA' },
  plazasList: { gap: 10, marginTop: 6 },
  plazaCard: {
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#FAFAFA',
    position: 'relative',
  },
  plazaCardSelected: { borderColor: '#007AFF', backgroundColor: '#F0F7FF' },
  plazaCardTitle: { fontSize: 15, fontWeight: '800', marginBottom: 8, color: '#000' },
  plazaCardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#007AFF',
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  plazaCardBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  rowButtonsModal: { flexDirection: 'row', gap: 8, padding: 12 },
  audioPlayerContainer: { marginTop: 8, marginBottom: 4 },
  audioPlayer: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, padding: 8, backgroundColor: '#FFF' },
  playButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center' },
  audioTime: { fontSize: 12, color: '#333' },
  resetAudioButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#007AFF', alignItems: 'center', justifyContent: 'center' },
  videoContainer: { marginTop: 8, borderRadius: 8, overflow: 'hidden', backgroundColor: '#000' },
});

function PermitAudioPlayer({ sourceUrl }: { sourceUrl: string }) {
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
    if (isPlaying) {
      player.pause();
      setIsPlaying(false);
    } else {
      player.play();
      setIsPlaying(true);
    }
  };

  const resetAudio = () => {
    if (!player) return;
    player.seekTo(0);
    player.pause();
    setIsPlaying(false);
  };

  return (
    <ThemedView style={styles.audioPlayerContainer}>
      <ThemedView style={styles.audioPlayer}>
        <TouchableOpacity style={styles.playButton} onPress={togglePlayPause}>
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={20} color="#007AFF" />
        </TouchableOpacity>
        <ThemedText style={styles.audioTime}>{formatTime(position)} / {formatTime(duration)}</ThemedText>
        <TouchableOpacity style={styles.resetAudioButton} onPress={resetAudio}>
          <Ionicons name="refresh" size={16} color="#FFFFFF" />
        </TouchableOpacity>
      </ThemedView>
    </ThemedView>
  );
}

function PermitVideoPlayer({ sourceUrl }: { sourceUrl: string }) {
  const player = useVideoPlayer(sourceUrl);
  const maxContainerWidth = Dimensions.get('window').width - 100;
  return (
    <View style={[styles.videoContainer, { width: maxContainerWidth, maxWidth: '100%' }]}>
      <VideoView
        player={player}
        style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' }}
        contentFit="contain"
        nativeControls
        allowsFullscreen={false}
        allowsPictureInPicture={false}
      />
    </View>
  );
}
