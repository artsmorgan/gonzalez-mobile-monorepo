import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  View,
  Dimensions,
  Modal,
  Image,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
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
import Ionicons from '@expo/vector-icons/build/Ionicons';
import * as Network from 'expo-network';
import { useQRScanner } from '@/hooks/useQRScanner';
import { Picker } from '@react-native-picker/picker';
import * as Location from 'expo-location';
import { jwtDecode } from 'jwt-decode';
import getHoraAccion from '@/hooks/getHoraAccion';
import authedFetch from '@/hooks/authedFetch';
import getValidAccessTokenOrLogout from '@/hooks/getValidAccessTokenOrLogout';
import {
  createAttendanceControl,
  updateAttendanceControl,
  deleteAttendanceControl,
  listAttendanceControl,
} from '@/hooks/evaluationFunctions';
import { convertDateTimestampToLocalString } from '@/hooks/convertDateTimestampToLocalString';
import { eventBus } from '@/hooks/eventBus';

type AttendanceControlScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'AttendanceControl'>;

type MainStructurePlazaNode = { id: number; nombre: string };
type MainStructurePuestoNode = { id: number; nombre: string; plazas: MainStructurePlazaNode[] };
type MainStructureSucursalNode = { id: number; nombre: string; nro_sucursal: string; puestos: MainStructurePuestoNode[] };
type MainStructureContratoNode = { id: number; nombre: string; sucursales: MainStructureSucursalNode[] };
type MainStructureDivisionNode = { id: number; nombre: string; contratos: MainStructureContratoNode[] };
type MainStructureClienteNode = { id: number; nombre: string; division: MainStructureDivisionNode[] };
type MainStructureEmpresaNode = { id: number; nombre: string; clientes: MainStructureClienteNode[] };
type MainStructureTree = MainStructureEmpresaNode[];

interface QRInfo {
  sessionId: string;
  empleadoId: string;
  latitud: string;
  longitud: string;
  timestamp: string;
  empleadoDetalle?: {
    nombre: string;
    primer_apellido: string;
    segundo_apellido: string;
    cedula_empleado?: string;
  };
}

interface Colaborador {
  empleado_id: number | null;
  marca_id?: number | null;
  ausente?: boolean;
  nombre_colaborador?: string;
  nombre?: string;
  cliente?: string;
  sucursal?: string;
  puesto?: string;
  cedula: string;
  firma_comentario: string; // base64 del QR
  firma_comentario_info: QRInfo | null; // Información decodificada del QR
  entrada: string;
  salida: string;
  sustituto_id: number | null;
  nombre_sustituto: string;
  cedula_sustituto: string;
  firma_sustituto: string; // base64 del QR
  firma_sustituto_info: QRInfo | null; // Información decodificada del QR
}

type AttendanceControlImageLocal = {
  id_local: string;
  base64: string;
  extension: string;
  original_name: string;
};

type AttendanceControlImageRemote = {
  id: number;
  name: string;
  original_name: string;
  url: string;
};

interface AttendanceControl {
  id: string;
  id_local: string;
  empresa_id?: number | string | null;
  cliente_id?: number | string | null;
  division_id?: number | string | null;
  contrato_id?: number | string | null;
  corpo_id?: number | string | null;
  sucursal_nombre?: string | null;
  cliente: string | null;
  fecha: string | null;
  turno: string | null;
  total_presentes: string | null;
  colaboradores: string | null;
  firma_responsable?: string | null;
  created_at: string;
  synced?: boolean;
  images?: AttendanceControlImageRemote[];
  images_local?: AttendanceControlImageLocal[];
}

interface EditingAttendanceControl {
  id: string | null;
  id_local: string;
  fecha: string;
  turno: string;
  total_presentes: string;
  colaboradores: Colaborador[];
  firma_responsable: string;
}

const TURNO_OPTIONS = [
  { label: 'Seleccionar turno', value: '' },
  { label: 'Diurno', value: 'DIURNO' },
  { label: 'Mixto', value: 'MIXTO' },
  { label: 'Nocturno', value: 'NOCTURNO' },
];

const TURNOS_API_MAP: Record<string, string> = {
  DIURNO: 'D',
  MIXTO: 'M',
  NOCTURNO: 'N',
};

const normalizeTurnoToApi = (turno: string): string => {
  const key = String(turno || '').trim().toUpperCase();
  return TURNOS_API_MAP[key] || key.charAt(0) || '';
};

export default function AttendanceControlScreen() {
  const { employee, refreshAccessToken, logout, accessToken } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<AttendanceControlScreenNavigationProp>();
  const { scanQR, QRScannerComponent } = useQRScanner();

  // Data states
  const [controls, setControls] = useState<AttendanceControl[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal: ver cambios (auditoría)
  const [isCambiosModalVisible, setIsCambiosModalVisible] = useState(false);
  const [cambiosTitle, setCambiosTitle] = useState<string>('Cambios');
  const [cambiosItems, setCambiosItems] = useState<any[]>([]);
  const [expandedCambioId, setExpandedCambioId] = useState<number | null>(null);
  const [hasCurrentMarca, setHasCurrentMarca] = useState<boolean>(false);

  // Filtros jerárquicos
  const [filterEmpresaId, setFilterEmpresaId] = useState<number | null>(null);
  const [filterClienteId, setFilterClienteId] = useState<number | null>(null);
  const [filterDivisionId, setFilterDivisionId] = useState<number | null>(null);
  const [filterContratoId, setFilterContratoId] = useState<number | null>(null);
  const [filterCorpoId, setFilterCorpoId] = useState<number | null>(null);
  const [isHierarchyFiltersExpanded, setIsHierarchyFiltersExpanded] = useState(false);

  // IDs de current_marca para inicialización
  const [marcaEmpresaId, setMarcaEmpresaId] = useState<number | null>(null);
  const [marcaClienteId, setMarcaClienteId] = useState<number | null>(null);
  const [marcaDivisionId, setMarcaDivisionId] = useState<number | null>(null);
  const [marcaContratoId, setMarcaContratoId] = useState<number | null>(null);
  const [marcaCorpoId, setMarcaCorpoId] = useState<number | null>(null);

  // Estructura jerárquica
  const [structure, setStructure] = useState<MainStructureTree>([]);
  const [isStructureLoading, setIsStructureLoading] = useState(false);

  // Form states - Jerarquía
  const [formEmpresaId, setFormEmpresaId] = useState<number | null>(null);
  const [formClienteId, setFormClienteId] = useState<number | null>(null);
  const [formDivisionId, setFormDivisionId] = useState<number | null>(null);
  const [formContratoId, setFormContratoId] = useState<number | null>(null);
  const [formCorpoId, setFormCorpoId] = useState<number | null>(null);

  // Firma responsable (similar a TrainingsScreen)
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [isGeneratingFirmaResponsable, setIsGeneratingFirmaResponsable] = useState(false);
  const [firmaResponsable, setFirmaResponsable] = useState<QRInfo | null>(null);
  const [firmaResponsableHash, setFirmaResponsableHash] = useState<string>('');

  // Editing state
  const [editingRecord, setEditingRecord] = useState<EditingAttendanceControl | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResponse, setSubmitResponse] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // Form states
  const [fecha, setFecha] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [turno, setTurno] = useState('');
  const [totalPresentes, setTotalPresentes] = useState('');
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [isRefreshingColaboradores, setIsRefreshingColaboradores] = useState(false);
  const [isResumenModalVisible, setIsResumenModalVisible] = useState(false);
  const [resumenModalTitle, setResumenModalTitle] = useState('Resumen colaboradores');
  const [resumenColaboradores, setResumenColaboradores] = useState<Colaborador[]>([]);

  // Carga de marcas al seleccionar fecha, sucursal y turno
  const [loadingMarcas, setLoadingMarcas] = useState(false);
  const [errorMarcas, setErrorMarcas] = useState<string | null>(null);
  const [previewColaboradores, setPreviewColaboradores] = useState<Colaborador[]>([]);

  // Image states
  const [imagenesLocal, setImagenesLocal] = useState<AttendanceControlImageLocal[]>([]);
  const [imagenesRemote, setImagenesRemote] = useState<AttendanceControlImageRemote[]>([]);
  const [deletedRemoteImageIds, setDeletedRemoteImageIds] = useState<number[]>([]);
  const [expandedImagesById, setExpandedImagesById] = useState<Record<string, boolean>>({});

  // Camera states
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);

  // Expanded states

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

  const formatColaboradoresForDisplay = (colaboradoresJson: string): string => {
    try {
      const colaboradores: Colaborador[] = JSON.parse(colaboradoresJson || '[]');
      if (!Array.isArray(colaboradores) || colaboradores.length === 0) return 'No hay colaboradores.';
      return colaboradores.map((c, idx) => {
        const nombre = c?.nombre_colaborador || '-';
        const cedula = c?.cedula || '-';
        const entrada = c?.entrada || '-';
        const salida = c?.salida || '-';
        const sustituto = c?.nombre_sustituto ? ` (Sustituto: ${c.nombre_sustituto} - ${c.cedula_sustituto || '-'})` : '';
        const tieneFirmaComentario = c?.firma_comentario ? 'Sí' : 'No';
        const tieneFirmaSustituto = c?.firma_sustituto ? 'Sí' : 'No';
        return `${idx + 1}. ${nombre} (Cédula: ${cedula})\n   Entrada: ${entrada}, Salida: ${salida}\n   Firma comentario: ${tieneFirmaComentario}, Firma sustituto: ${tieneFirmaSustituto}${sustituto}`;
      }).join('\n\n');
    } catch (e) {
      console.error('Error formatting colaboradores for display:', e);
      return 'Error al formatear colaboradores.';
    }
  };

  const formatChangeValue = (prop: string, value: any): string => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';
    if (typeof value === 'object') {
      if (prop === 'colaboradores') {
        return formatColaboradoresForDisplay(JSON.stringify(value));
      }
      return JSON.stringify(value, null, 2);
    }
    if (typeof value === 'string') {
      if (value.trim().startsWith('{') || value.trim().startsWith('[')) {
        try {
          const parsed = JSON.parse(value);
          if (prop === 'colaboradores') {
            return formatColaboradoresForDisplay(value);
          }
          if (Array.isArray(parsed)) {
            return parsed.map((item, idx) => {
              if (typeof item === 'object' && item !== null) {
                return `Item ${idx + 1}: ${JSON.stringify(item, null, 2)}`;
              }
              return String(item);
            }).join('\n');
          }
          if (typeof parsed === 'object') {
            return JSON.stringify(parsed, null, 2);
          }
        } catch {
          // Not valid JSON, return as string
        }
      }
      return value;
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

  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const normalizeControl = (raw: any): AttendanceControl => {
    const clienteName = raw?.cliente ?? raw?.nombre_cliente ?? null;
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER || '';
    const recordId = raw?.id;
    const mappedImages: AttendanceControlImageRemote[] = (Array.isArray(raw?.images) ? raw.images : []).map((img: any) => {
      const name = String(img?.name || '');
      const safeUrl =
        apiUrl && recordId && name
          ? `${apiUrl}/api/attendance-control/${encodeURIComponent(String(recordId))}/get-image/${encodeURIComponent(name)}`
          : String(img?.url || '');
      return {
        id: Number(img?.id || 0),
        name,
        original_name: String(img?.original_name || name),
        url: safeUrl,
      };
    });
    return {
      ...raw,
      cliente: clienteName,
      sucursal_nombre: raw?.sucursal_nombre ?? raw?.e_estructura_sucursal?.nombre ?? null,
      total_presentes: raw?.total_presentes !== null && raw?.total_presentes !== undefined ? String(raw.total_presentes) : null,
      images: mappedImages,
    } as AttendanceControl;
  };

  const appendTokenToUrl = (url: string) => {
    if (!url) return '';
    if (!accessToken || accessToken.trim().length === 0) return url;
    if (/[?&]token=/.test(url)) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}token=${encodeURIComponent(accessToken)}`;
  };

  const appendTokenAndCacheToUrl = (url: string) => {
    const withToken = appendTokenToUrl(url);
    if (!withToken) return '';
    const sep = withToken.includes('?') ? '&' : '?';
    return `${withToken}${sep}t=${Date.now()}`;
  };

  const formatTurnoLabel = (value?: string | null) => {
    const val = String(value || '').trim().toUpperCase();
    if (val === 'D' || val === 'DIURNO') return 'Diurno';
    if (val === 'M' || val === 'MIXTO') return 'Mixto';
    if (val === 'N' || val === 'NOCTURNO') return 'Nocturno';
    return value || 'N/A';
  };

  const formatHoraLabel = (value?: string | null) => {
    if (!value) return '-';
    const str = String(value).trim();
    if (!str) return '-';
    if (str.includes('T')) {
      const afterT = str.split('T')[1] || '';
      return afterT.replace(/\.\d+Z?$/i, '').trim() || str;
    }
    return str.replace(/\.\d+Z?$/i, '').trim();
  };

  const parseFechaToDate = (value: any): Date => {
    if (!value) return new Date();
    if (typeof value === 'string' && value.includes('/')) {
      const parts = value.split('/');
      if (parts.length === 3) {
        const dd = parseInt(parts[0], 10);
        const mm = parseInt(parts[1], 10);
        const yyyy = parseInt(parts[2], 10);
        if (!Number.isNaN(dd) && !Number.isNaN(mm) && !Number.isNaN(yyyy)) {
          return new Date(yyyy, mm - 1, dd);
        }
      }
    }
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  };

  const loadMarcas = useCallback(async () => {
    if (!formCorpoId || !turno || !fecha) return;
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) return;
    setLoadingMarcas(true);
    setErrorMarcas(null);
    setPreviewColaboradores([]);
    try {
      const params = new URLSearchParams({
        fecha: formatDate(fecha),
        corpo_id: String(formCorpoId),
        turno: turno.trim(),
      });
      const resp = await authedFetch({
        url: `${apiUrl}/api/attendance-control/marcas?${params.toString()}`,
        init: { method: 'GET', headers: { 'Content-Type': 'application/json' } },
        refreshAccessToken,
        logout,
      });
      if (!resp) {
        setErrorMarcas('No se pudo conectar con el servidor');
        return;
      }
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.status) {
        setErrorMarcas(data?.message || 'Error al cargar las marcas');
        return;
      }
      const list = Array.isArray(data?.data?.colaboradores) ? data.data.colaboradores : [];
      const total = typeof data?.data?.total_presentes === 'number' ? data.data.total_presentes : list.filter((c: any) => !c?.ausente).length;
      setPreviewColaboradores(list);
      setTotalPresentes(String(total));
    } catch (e: any) {
      setErrorMarcas(e?.message || 'Error al cargar las marcas de empleados');
    } finally {
      setLoadingMarcas(false);
    }
  }, [fecha, formCorpoId, turno, refreshAccessToken, logout]);

  useEffect(() => {
    if (!isCreating && !editingRecord) return;
    if (!formCorpoId || !turno.trim()) {
      setPreviewColaboradores([]);
      setErrorMarcas(null);
      return;
    }
    loadMarcas();
  }, [isCreating, editingRecord, formCorpoId, turno, fecha, loadMarcas]);

  const refreshColaboradoresFromServer = useCallback(async (recordId: string, openModalAfter = true) => {
    try {
      setIsRefreshingColaboradores(true);
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) throw new Error('Server URL not configured');

      const refreshResp = await authedFetch({
        url: `${apiUrl}/api/attendance-control/${recordId}/refresh-colaboradores`,
        init: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
        refreshAccessToken,
        logout,
      });
      if (!refreshResp) return;
      const refreshJson = await refreshResp.json().catch(() => ({}));
      if (!refreshResp.ok || !refreshJson?.status) {
        throw new Error(refreshJson?.message || 'No se pudo actualizar la lista de colaboradores');
      }

      const listResp = await authedFetch({
        url: `${apiUrl}/api/attendance-control?corpo_id=${encodeURIComponent(String(filterCorpoId || formCorpoId || marcaCorpoId || ''))}`,
        init: { method: 'GET', headers: { 'Content-Type': 'application/json' } },
        refreshAccessToken,
        logout,
      });
      if (!listResp) return;
      const listJson = await listResp.json().catch(() => ({}));
      if (!listResp.ok || !listJson?.status) {
        throw new Error(listJson?.message || 'No se pudo recargar el registro');
      }

      const updatedRecords: AttendanceControl[] = Array.isArray(listJson.data) ? listJson.data.map(normalizeControl) : [];
      setControls(updatedRecords);

      console.log("updatedRecords", updatedRecords);

      const updated = updatedRecords.find((r: any) => String(r.id) === String(recordId));
      let parsed: Colaborador[] = [];
      if (updated?.colaboradores) {
        try {
          const arr = JSON.parse(updated.colaboradores);
          if (Array.isArray(arr)) parsed = arr;
        } catch {
          parsed = [];
        }
      }

      if (editingRecord && String(editingRecord.id) === String(recordId)) {
        setColaboradores(parsed);
        setTotalPresentes(String(parsed.filter((c: any) => !c?.ausente).length));
      }

      setResumenColaboradores(parsed);
      if (openModalAfter) {
        setResumenModalTitle(`Resumen colaboradores - Control #${recordId}`);
        setIsResumenModalVisible(true);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo actualizar la lista de colaboradores');
    } finally {
      setIsRefreshingColaboradores(false);
    }
  }, [refreshAccessToken, logout, filterCorpoId, formCorpoId, marcaCorpoId, editingRecord]);

  const loadMarcaContext = useCallback(async () => {
    try {
      const currentMarca = await AsyncStorage.getItem('current_marca');
      if (!currentMarca) {
        setMarcaEmpresaId(null);
        setMarcaClienteId(null);
        setMarcaDivisionId(null);
        setMarcaContratoId(null);
        setMarcaCorpoId(null);
        return null;
      }
      const current = JSON.parse(currentMarca);
      const empresaIdRaw = current?.empresa?.id ?? current?.empresa_id;
      const clienteIdRaw = current?.cliente?.id ?? current?.cliente_id;
      const divisionIdRaw = current?.division?.id ?? current?.division_id;
      const contratoIdRaw = current?.contrato?.id ?? current?.contrato_id;
      const corpoIdRaw = current?.corpo?.id ?? current?.corpo_id;
      setMarcaEmpresaId(empresaIdRaw ? Number(empresaIdRaw) : null);
      setMarcaClienteId(clienteIdRaw ? Number(clienteIdRaw) : null);
      setMarcaDivisionId(divisionIdRaw ? Number(divisionIdRaw) : null);
      setMarcaContratoId(contratoIdRaw ? Number(contratoIdRaw) : null);
      setMarcaCorpoId(corpoIdRaw ? Number(corpoIdRaw) : null);
      return current;
    } catch {
      setMarcaEmpresaId(null);
      setMarcaClienteId(null);
      setMarcaDivisionId(null);
      setMarcaContratoId(null);
      setMarcaCorpoId(null);
      return null;
    }
  }, []);

  const fetchMainStructure = useCallback(async () => {
    setIsStructureLoading(true);
    try {
      const cacheStr = await AsyncStorage.getItem('main_structure_cache');
      if (cacheStr) {
        try {
          const parsed = JSON.parse(cacheStr);
          if (Array.isArray(parsed)) setStructure(parsed);
        } catch {
          // ignore
        }
      }
      const isConnected = await getConnectionStatus();
      if (!isConnected) {
        setIsStructureLoading(false);
        return;
      }
      // La estructura ya se guarda desde otras pantallas, aquí solo usamos cache
    } finally {
      setIsStructureLoading(false);
    }
  }, []);

  const fetchControls = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const currentMarca = await AsyncStorage.getItem('current_marca');
      if (!currentMarca) {
        setHasCurrentMarca(false);
        setIsLoading(false);
        return;
      }

      const current = JSON.parse(currentMarca);
      setHasCurrentMarca(true);

      // Obtener IDs de current_marca directamente sin usar estados
      const empresaIdRaw = current?.empresa?.id ?? current?.empresa_id;
      const clienteIdRaw = current?.cliente?.id ?? current?.cliente_id;
      const divisionIdRaw = current?.division?.id ?? current?.division_id;
      const contratoIdRaw = current?.contrato?.id ?? current?.contrato_id;
      const corpoIdRaw = current?.corpo?.id ?? current?.corpo_id;

      const empresaIdFromMarca = empresaIdRaw ? Number(empresaIdRaw) : null;
      const clienteIdFromMarca = clienteIdRaw ? Number(clienteIdRaw) : null;
      const divisionIdFromMarca = divisionIdRaw ? Number(divisionIdRaw) : null;
      const contratoIdFromMarca = contratoIdRaw ? Number(contratoIdRaw) : null;
      const corpoIdFromMarca = corpoIdRaw ? Number(corpoIdRaw) : null;

      // Usar filtros jerárquicos si están disponibles, sino usar current_marca
      const empresaId = filterEmpresaId ?? empresaIdFromMarca ?? 0;
      const clienteId = filterClienteId ?? clienteIdFromMarca ?? 0;
      const divisionId = filterDivisionId ?? divisionIdFromMarca ?? 0;
      const contratoId = filterContratoId ?? contratoIdFromMarca ?? 0;
      const corpoIdNum = filterCorpoId ?? corpoIdFromMarca ?? 0;

      if (!corpoIdNum) {
        setError('No se encontró el ID del corpo');
        setIsLoading(false);
        return;
      }

      const isConnected = await getConnectionStatus();
      if (!isConnected) {
        setError('Este módulo funciona exclusivamente con internet.');
        setControls([]);
        setIsLoading(false);
        return;
      }

      // Usar nueva función con filtros jerárquicos
      const result = await listAttendanceControl({
        empresa_id: empresaId || undefined,
        cliente_id: clienteId || undefined,
        division_id: divisionId || undefined,
        contrato_id: contratoId || undefined,
        corpo_id: corpoIdNum || undefined,
        refreshAccessToken,
        logout,
      });

      if (result.status && result.data) {
        const serverItems: AttendanceControl[] = Array.isArray(result.data) ? (result.data as any[]).map(normalizeControl) : [];
        setControls(serverItems);
      } else {
        setControls([]);
      }
    } catch (err) {
      console.error('Error fetching controls:', err);
      setError('Error al cargar los controles de asistencia');
      setControls([]);
    } finally {
      setIsLoading(false);
    }
  }, [refreshAccessToken, logout, filterEmpresaId, filterClienteId, filterDivisionId, filterContratoId, filterCorpoId]);

  // En modo online actual, la lista de colaboradores se calcula desde c_marca_dia en backend.

  // Nodos computados para filtros jerárquicos
  const filterEmpresas = useMemo(() => (Array.isArray(structure) ? structure : []), [structure]);

  const filterClientes = useMemo(() => {
    const empresa = filterEmpresas.find((e: any) => e.id === filterEmpresaId);
    return empresa?.clientes || [];
  }, [filterEmpresas, filterEmpresaId]);

  const filterDivisiones = useMemo(() => {
    const cliente = filterClientes.find((c: any) => c.id === filterClienteId);
    return cliente?.division || [];
  }, [filterClientes, filterClienteId]);

  const filterContratos = useMemo(() => {
    if (!filterClienteId) return [];
    const cliente = filterClientes.find((c: any) => c.id === filterClienteId);
    if (!cliente) return [];
    const divisiones = cliente?.division || [];
    // Recopilar todos los contratos de todas las divisiones del cliente
    const contratos: any[] = [];
    divisiones.forEach((division: any) => {
      division.contratos?.forEach((contrato: any) => {
        if (!contratos.find(c => c.id === contrato.id)) {
          contratos.push(contrato);
        }
      });
    });
    return contratos;
  }, [filterClientes, filterClienteId]);

  const filterSucursales = useMemo(() => {
    if (!filterContratoId) return [];
    const cliente = filterClientes.find((c: any) => c.id === filterClienteId);
    if (!cliente) return [];
    const divisiones = cliente?.division || [];
    const sucursales: any[] = [];
    divisiones.forEach((division: any) => {
      division.contratos?.forEach((contrato: any) => {
        if (contrato.id === filterContratoId) {
          contrato.sucursales?.forEach((sucursal: any) => {
            if (!sucursales.find(s => s.id === sucursal.id)) {
              sucursales.push(sucursal);
            }
          });
        }
      });
    });
    return sucursales;
  }, [filterClientes, filterClienteId, filterContratoId]);

  // Nodos computados para jerarquía del formulario
  const formEmpresas = useMemo(() => (Array.isArray(structure) ? structure : []), [structure]);

  const formClientes = useMemo(() => {
    const empresa = formEmpresas.find((e: any) => e.id === formEmpresaId);
    return empresa?.clientes || [];
  }, [formEmpresas, formEmpresaId]);

  const formDivisiones = useMemo(() => {
    const cliente = formClientes.find((c: any) => c.id === formClienteId);
    return cliente?.division || [];
  }, [formClientes, formClienteId]);

  const formContratos = useMemo(() => {
    if (!formClienteId) return [];
    const cliente = formClientes.find((c: any) => c.id === formClienteId);
    if (!cliente) return [];
    const divisiones = cliente?.division || [];
    const contratos: any[] = [];
    divisiones.forEach((division: any) => {
      division.contratos?.forEach((contrato: any) => {
        if (!contratos.find(c => c.id === contrato.id)) {
          contratos.push(contrato);
        }
      });
    });
    return contratos;
  }, [formClientes, formClienteId]);

  const formSucursales = useMemo(() => {
    if (!formContratoId) return [];
    const cliente = formClientes.find((c: any) => c.id === formClienteId);
    if (!cliente) return [];
    const divisiones = cliente?.division || [];
    const sucursales: any[] = [];
    divisiones.forEach((division: any) => {
      division.contratos?.forEach((contrato: any) => {
        if (contrato.id === formContratoId) {
          contrato.sucursales?.forEach((sucursal: any) => {
            if (!sucursales.find(s => s.id === sucursal.id)) {
              sucursales.push(sucursal);
            }
          });
        }
      });
    });
    return sucursales;
  }, [formClientes, formClienteId, formContratoId]);

  // Inicializar filtros jerárquicos con current_marca (solo una vez cuando se carga la estructura)
  useEffect(() => {
    if (!structure || structure.length === 0) return;
    // Solo inicializar si los filtros no están establecidos
    if (marcaEmpresaId && filterEmpresaId === null) setFilterEmpresaId(marcaEmpresaId);
    if (marcaClienteId && filterClienteId === null) setFilterClienteId(marcaClienteId);
    if (marcaDivisionId && filterDivisionId === null) setFilterDivisionId(marcaDivisionId);
    if (marcaContratoId && filterContratoId === null) setFilterContratoId(marcaContratoId);
    if (marcaCorpoId && filterCorpoId === null) setFilterCorpoId(marcaCorpoId);
  }, [structure, marcaEmpresaId, marcaClienteId, marcaDivisionId, marcaContratoId, marcaCorpoId, filterEmpresaId, filterClienteId, filterDivisionId, filterContratoId, filterCorpoId]);

  // Trigger fetch cuando cambien los filtros jerárquicos
  useEffect(() => {
    if (structure && structure.length > 0 && (filterEmpresaId || filterClienteId || filterDivisionId || filterContratoId || filterCorpoId)) {
      fetchControls();
    }
  }, [filterEmpresaId, filterClienteId, filterDivisionId, filterContratoId, filterCorpoId, structure, fetchControls]);

  // Inicializar jerarquía del formulario con current_marca
  useEffect(() => {
    if (!structure || structure.length === 0) return;
    if (marcaEmpresaId && !formEmpresaId) setFormEmpresaId(marcaEmpresaId);
    if (marcaClienteId && !formClienteId) setFormClienteId(marcaClienteId);
    if (marcaDivisionId && !formDivisionId) setFormDivisionId(marcaDivisionId);
    if (marcaContratoId && !formContratoId) setFormContratoId(marcaContratoId);
    if (marcaCorpoId && !formCorpoId) setFormCorpoId(marcaCorpoId);
  }, [structure, marcaEmpresaId, marcaClienteId, marcaDivisionId, marcaContratoId, marcaCorpoId]);

  useFocusEffect(
    useCallback(() => {
      fetchMainStructure();
      loadMarcaContext();
      fetchControls();
      eventBus.on('connectionRestored', fetchControls);
      return () => {
        eventBus.off('connectionRestored', fetchControls);
      };
    }, [fetchControls, fetchMainStructure, loadMarcaContext])
  );

  const generateRandomId = (): string => {
    return `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const resetForm = async () => {
    const horaAccion = await getHoraAccion();
    if (!horaAccion) {
      Alert.alert('Error', 'No se pudo obtener la hora');
      return;
    }
    setFecha(new Date(horaAccion));
    setTurno('');
    setTotalPresentes('');
    setColaboradores([]);
    setFirmaResponsable(null);
    setFirmaResponsableHash('');
    // Resetear jerarquía del formulario
    setFormEmpresaId(null);
    setFormClienteId(null);
    setFormDivisionId(null);
    setFormContratoId(null);
    setFormCorpoId(null);
    // Resetear imágenes
    setImagenesLocal([]);
    setImagenesRemote([]);
    setDeletedRemoteImageIds([]);
  };

  const openCamera = async () => {
    if (!permission) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Permiso denegado', 'Se necesita permiso de cámara para tomar fotos');
        return;
      }
    }
    if (permission && !permission.granted) {
      Alert.alert('Permiso denegado', 'Se necesita permiso de cámara para tomar fotos');
      return;
    }
    setIsCameraVisible(true);
  };

  const capturePhoto = async () => {
    if (!cameraRef.current) {
      Alert.alert('Error', 'La cámara no está lista. Por favor intente nuevamente.');
      return;
    }

    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.7,
        skipProcessing: false
      });

      if (!photo || !photo.base64) {
        Alert.alert('Error', 'No se pudo capturar la foto. Por favor intente nuevamente.');
        setIsCameraVisible(false);
        return;
      }
      setIsCameraVisible(false);

      setTimeout(() => {
        setImagenesLocal((prev) => [
          ...prev,
          {
            id_local: generateRandomId(),
            base64: String(photo.base64),
            extension: 'jpg',
            original_name: `foto_${Date.now()}.jpg`,
          },
        ]);
      }, 100);
    } catch (error) {
      console.error('Error al capturar foto:', error);
      Alert.alert('Error', 'No se pudo capturar la foto. Por favor intente nuevamente.');
      setIsCameraVisible(false);
    }
  };

  const removeLocalImage = (idLocal: string) => {
    Alert.alert('Confirmar', '¿Eliminar esta foto?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => setImagenesLocal((prev) => prev.filter((x) => x.id_local !== idLocal)),
      },
    ]);
  };

  const removeRemoteImage = (id: number) => {
    Alert.alert('Confirmar', '¿Eliminar esta foto?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          setImagenesRemote((prev) => prev.filter((x) => x.id !== id));
          setDeletedRemoteImageIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
        },
      },
    ]);
  };

  const startCreating = async () => {
    setIsCreating(true);
    setEditingRecord(null);
    await resetForm();

    // Request location permissions (firma)
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Error', 'Se necesita permiso de ubicación para generar la firma');
          return;
        }
        const currentLocation = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setLocation(currentLocation);
      } catch (error) {
        console.error('Error getting location:', error);
      }
    })();
  };

  const cancelCreating = async () => {
    setIsCreating(false);
    await resetForm();
  };

  const startEditing = async (record: AttendanceControl) => {
    setIsCreating(false);
    let colaboradoresArray: Colaborador[] = [];

    if (record.colaboradores) {
      try {
        colaboradoresArray = JSON.parse(record.colaboradores);
        if (!Array.isArray(colaboradoresArray)) colaboradoresArray = [];

        // Decodificar los QR guardados para mostrar la información
        colaboradoresArray = await Promise.all(colaboradoresArray.map(async (colab: any) => {
          const decoded: Colaborador = {
            empleado_id: typeof colab.empleado_id === 'number' ? colab.empleado_id : null,
            nombre_colaborador: colab.nombre_colaborador || '',
            cedula: colab.cedula || '',
            firma_comentario: colab.firma_comentario || '',
            firma_comentario_info: null,
            entrada: colab.entrada || '',
            salida: colab.salida || '',
            sustituto_id: typeof colab.sustituto_id === 'number' ? colab.sustituto_id : null,
            nombre_sustituto: colab.nombre_sustituto || '',
            cedula_sustituto: colab.cedula_sustituto || '',
            firma_sustituto: colab.firma_sustituto || '',
            firma_sustituto_info: null,
          };

          // Decodificar firma_comentario si existe
          if (colab.firma_comentario) {
            try {
              const decodedData = atob(colab.firma_comentario);
              const parts = decodedData.split(':');
              if (parts.length === 5) {
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
                    if (!empleadoResponse) return decoded;
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

                decoded.firma_comentario_info = {
                  sessionId,
                  empleadoId,
                  latitud,
                  longitud,
                  timestamp,
                  empleadoDetalle,
                };
              }
            } catch (e) {
              console.error('Error decoding firma_comentario:', e);
            }
          }

          // Decodificar firma_sustituto si existe
          if (colab.firma_sustituto) {
            try {
              const decodedData = atob(colab.firma_sustituto);
              const parts = decodedData.split(':');
              if (parts.length === 5) {
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
                    if (!empleadoResponse) return decoded;
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

                decoded.firma_sustituto_info = {
                  sessionId,
                  empleadoId,
                  latitud,
                  longitud,
                  timestamp,
                  empleadoDetalle,
                };
              }
            } catch (e) {
              console.error('Error decoding firma_sustituto:', e);
            }
          }

          return decoded;
        }));
      } catch (e) {
        colaboradoresArray = [];
      }
    }

    setEditingRecord({
      id: record.id,
      id_local: record.id_local,
      fecha: record.fecha || '',
      turno: record.turno || '',
      total_presentes: record.total_presentes !== null && record.total_presentes !== undefined ? String(record.total_presentes) : '',
      colaboradores: colaboradoresArray,
      firma_responsable: record.firma_responsable || '',
    });

    setFecha(parseFechaToDate(record.fecha));
    setTurno(record.turno || '');
    setTotalPresentes(record.total_presentes !== null && record.total_presentes !== undefined ? String(record.total_presentes) : '');
    setColaboradores(colaboradoresArray);
    // Cargar jerarquía del registro
    if (record.empresa_id) setFormEmpresaId(Number(record.empresa_id));
    if (record.cliente_id) setFormClienteId(Number(record.cliente_id));
    if (record.division_id) setFormDivisionId(Number(record.division_id));
    if (record.contrato_id) setFormContratoId(Number(record.contrato_id));
    if (record.corpo_id) setFormCorpoId(Number(record.corpo_id));
    // Cargar imágenes
    setImagenesRemote(record.images || []);
    setImagenesLocal(record.images_local || []);
    setDeletedRemoteImageIds([]);

    // Cargar firma responsable si existe
    if (record.firma_responsable) {
      try {
        const decodedData = atob(String(record.firma_responsable));
        const parts = decodedData.split(':');
        if (parts.length === 5) {
          const [sessionId, empleadoId, latitud, longitud, timestamp] = parts;
          setFirmaResponsableHash(String(record.firma_responsable));
          setFirmaResponsable({
            sessionId,
            empleadoId,
            latitud,
            longitud,
            timestamp,
            empleadoDetalle: undefined,
          });
        } else {
          setFirmaResponsableHash('');
          setFirmaResponsable(null);
        }
      } catch {
        setFirmaResponsableHash('');
        setFirmaResponsable(null);
      }
    } else {
      setFirmaResponsableHash('');
      setFirmaResponsable(null);
    }

    // Ensure location for firma on edit
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const currentLocation = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setLocation(currentLocation);
      } catch (error) {
        console.error('Error getting location:', error);
      }
    })();

    if (record.id) {
      await refreshColaboradoresFromServer(String(record.id), false);
    }
  };

  const cancelEditing = async () => {
    setEditingRecord(null);
    await resetForm();
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setFecha(selectedDate);
    }
  };

  const generateSignatureResponsable = async () => {
    try {
      if (!employee) {
        Alert.alert('Error', 'No se pudo obtener la información del empleado');
        return;
      }

      if (!location) {
        Alert.alert('Error', 'No se pudo obtener la ubicación');
        return;
      }

      setIsGeneratingFirmaResponsable(true);

      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) throw new Error('Server URL not configured');
      const token = await getValidAccessTokenOrLogout({ refreshAccessToken, logout });
      if (!token) return;
      const decodedToken = jwtDecode(token);
      const sessionId = JSON.parse(JSON.stringify(decodedToken)).sessionId;

      const horaAccion = await getHoraAccion();
      if (!horaAccion) throw new Error('Hora de acción not found');

      const hash = btoa(sessionId + ':' + employee.id + ':' + location.coords.latitude + ':' + location.coords.longitude + ':' + horaAccion);
      setFirmaResponsableHash(hash);

      const decodedHash = atob(hash);
      const [decodedSessionId, decodedEmpleadoId, decodedLatitud, decodedLongitud, decodedTimestamp] = decodedHash.split(':');

      // Fetch empleado details si hay internet
      const connectionStatus = await getConnectionStatus();
      let empleadoDetalle = undefined;
      if (connectionStatus) {
        try {
          const empleadoResponse = await authedFetch({
            url: `${apiUrl}/api/empleados/${decodedEmpleadoId}`,
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
              cedula_empleado: empleadoData.cedula,
            };
          }
        } catch (e) {
          console.error('Error fetching empleado details for firma responsable:', e);
        }
      }

      setFirmaResponsable({
        sessionId: decodedSessionId,
        empleadoId: decodedEmpleadoId,
        latitud: decodedLatitud,
        longitud: decodedLongitud,
        timestamp: decodedTimestamp,
        empleadoDetalle,
      });
    } catch (e) {
      console.error('Error generating firma responsable:', e);
      Alert.alert('Error', 'No se pudo generar la firma digital');
    } finally {
      setIsGeneratingFirmaResponsable(false);
    }
  };

  const handleScanQRResponsable = async () => {
    try {
      const qrData = await scanQR();
      if (!qrData) return;

      const decodedHash = atob(qrData);
      const parts = decodedHash.split(':');
      if (parts.length !== 5) {
        Alert.alert('Error', 'El QR no tiene la estructura esperada');
        return;
      }

      const [sessionId, empleadoId, latitud, longitud, timestamp] = parts;
      setFirmaResponsableHash(qrData);

      const connectionStatus = await getConnectionStatus();
      let empleadoDetalle = undefined;
      if (connectionStatus) {
        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) throw new Error('Server URL not configured');
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
            cedula_empleado: empleadoData.cedula,
          };
        }
      }

      setFirmaResponsable({
        sessionId,
        empleadoId,
        latitud,
        longitud,
        timestamp,
        empleadoDetalle,
      });
    } catch (error) {
      console.error('Error scanning QR responsable:', error);
      Alert.alert('Error', 'No se pudo escanear el código QR');
    }
  };

  const saveControlHandler = async () => {
    const currentMarca = await AsyncStorage.getItem('current_marca');
    if (!currentMarca) {
      Alert.alert('Error', 'No se encontró la marca actual');
      return;
    }

    setIsSubmitting(true);
    setSubmitResponse(null);

    try {
      const currentMarcaData = JSON.parse(currentMarca);

      if (!firmaResponsableHash) {
        Alert.alert('Error', 'Debes generar la firma del responsable antes de guardar');
        setIsSubmitting(false);
        return;
      }

      // Validar campos jerárquicos
      if (!formEmpresaId || !formClienteId || !formDivisionId || !formContratoId || !formCorpoId) {
        Alert.alert('Error', 'Debe seleccionar Empresa, Cliente, División, Contrato y Sucursal');
        setIsSubmitting(false);
        return;
      }

      const imagenesStr =
        imagenesLocal.length > 0
          ? JSON.stringify(
            imagenesLocal.map((img) => ({
              file_base64: img.base64,
              extension: img.extension,
              original_name: img.original_name,
            }))
          )
          : undefined;

      const requestData = {
        marca_id: currentMarcaData.id,
        empresa_id: formEmpresaId,
        cliente_id: formClienteId,
        division_id: formDivisionId,
        contrato_id: formContratoId,
        corpo_id: formCorpoId,
        fecha: formatDate(fecha) || null,
        turno: normalizeTurnoToApi(turno.trim() || ''),
        firma_responsable: firmaResponsableHash,
        ...(imagenesStr ? { imagenes: imagenesStr } : {}),
      };

      const isConnected = await getConnectionStatus();

      if (!isConnected) {
        Alert.alert('Error', 'Este módulo funciona exclusivamente con internet');
        return;
      }

      const result = await createAttendanceControl({
        requestData,
        refreshAccessToken,
        logout,
      });

      if (result.status) {
        Alert.alert('Éxito', result.message || 'Control de asistencia guardado correctamente');
        setTimeout(() => {
          cancelCreating();
          fetchControls();
        }, 2000);
      } else {
        Alert.alert('Error', result.message || 'Error al guardar el control de asistencia');
      }
    } catch (err) {
      console.error('Error saving control:', err);
      Alert.alert('Error', 'No se pudo guardar el control de asistencia');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateControlHandler = async () => {
    if (!editingRecord) return;

    setIsSubmitting(true);
    setSubmitResponse(null);

    try {
      const recordId = editingRecord.id || editingRecord.id_local;
      if (!recordId) {
        Alert.alert('Error', 'ID de registro no encontrado para actualizar');
        setIsSubmitting(false);
        return;
      }

      if (!firmaResponsableHash) {
        Alert.alert('Error', 'Debes generar la firma del responsable antes de actualizar');
        setIsSubmitting(false);
        return;
      }

      // Validar campos jerárquicos
      if (!formEmpresaId || !formClienteId || !formDivisionId || !formContratoId || !formCorpoId) {
        Alert.alert('Error', 'Debe seleccionar Empresa, Cliente, División, Contrato y Sucursal');
        setIsSubmitting(false);
        return;
      }

      const imagenesStr =
        imagenesLocal.length > 0
          ? JSON.stringify(
            imagenesLocal.map((img) => ({
              file_base64: img.base64,
              extension: img.extension,
              original_name: img.original_name,
            }))
          )
          : undefined;

      const deleteImagenesStr =
        deletedRemoteImageIds.length > 0 ? JSON.stringify(deletedRemoteImageIds) : undefined;

      const requestData = {
        empresa_id: formEmpresaId,
        cliente_id: formClienteId,
        division_id: formDivisionId,
        contrato_id: formContratoId,
        corpo_id: formCorpoId,
        fecha: formatDate(fecha) || null,
        turno: normalizeTurnoToApi(turno.trim() || ''),
        firma_responsable: firmaResponsableHash,
        ...(imagenesStr ? { imagenes: imagenesStr } : {}),
        ...(deleteImagenesStr ? { delete_imagenes: deleteImagenesStr } : {}),
      };

      const isConnected = await getConnectionStatus();

      if (!isConnected) {
        Alert.alert('Error', 'Este módulo funciona exclusivamente con internet');
        return;
      }

      const result = await updateAttendanceControl({
        id: recordId,
        requestData,
        refreshAccessToken,
        logout,
      });

      if (result.status) {
        Alert.alert('Éxito', result.message || 'Control de asistencia actualizado correctamente');
        setTimeout(() => {
          cancelEditing();
          fetchControls();
        }, 2000);
      } else {
        Alert.alert('Error', result.message || 'Error al actualizar el control de asistencia');
      }
    } catch (err) {
      console.error('Error updating control:', err);
      Alert.alert('Error', 'No se pudo actualizar el control de asistencia');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteControlHandler = async (record: AttendanceControl) => {
    const recordId = record.id || record.id_local;
    if (!recordId) {
      Alert.alert('Error', 'ID de registro no encontrado para eliminar');
      return;
    }

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas eliminar este control de asistencia?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await deleteAttendanceControl({
                  id: recordId,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Control de asistencia eliminado correctamente');
                  fetchControls();
                } else {
                  Alert.alert('Error', result.message || 'Error al eliminar el control de asistencia');
                }
              } else {
                Alert.alert('Sin conexión', 'Este módulo funciona exclusivamente con internet.');
              }
            } catch (err) {
              console.error('Error deleting control:', err);
              Alert.alert('Error', 'No se pudo eliminar el control de asistencia');
            }
          },
        },
      ]
    );
  };

  const handleMenuPress = () => {
    setIsMenuVisible(true);
  };

  const handleMenuClose = () => {
    setIsMenuVisible(false);
  };

  const handleHomePress = () => {
    navigation.navigate('Home');
  };

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'attendance': return <Ionicons name="people" size={24} color='#000000' />;
      case 'add': return <Ionicons name="add" size={24} color='#FFFFFF' />;
      case 'cancel': return <Ionicons name="close" size={24} color='#FFFFFF' />;
      case 'confirm': return <Ionicons name="checkmark" size={24} color='#FFFFFF' />;
      case 'delete': return <Ionicons name="trash" size={24} color='#FFFFFF' />;
      case 'edit': return <Ionicons name="pencil" size={20} color="#FFFFFF" />;
      case 'qr': return <Ionicons name="qr-code" size={20} color="#007AFF" />;
      case 'qr-responsable': return <Ionicons name="qr-code" size={20} color="#FFFFFF" />;
      case 'signature': return <Ionicons name="finger-print" size={24} color="#FFFFFF" />;
      default: return <Ionicons name="people" size={24} color='#000000' />;
    }
  };

  const renderControlList = () => {
    if (isLoading) {
      return (
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Cargando controles de asistencia...</ThemedText>
        </ThemedView>
      );
    }

    if (error) {
      return (
        <ThemedView style={styles.errorContainer}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        </ThemedView>
      );
    }

    if (controls.length === 0) {
      return (
        <ThemedView style={styles.emptyContainer}>
          <ThemedText style={styles.emptyText}>No hay controles de asistencia registrados.</ThemedText>
        </ThemedView>
      );
    }

    return (
      <ThemedView style={styles.listContainer}>
        {controls.map((record) => {
          let colaboradoresArray: Colaborador[] = [];
          if (record.colaboradores) {
            try {
              colaboradoresArray = JSON.parse(record.colaboradores);
            } catch (e) {
              colaboradoresArray = [];
            }
          }

          return (
            <ThemedView key={record.id || record.id_local} style={styles.listItem}>
              <ThemedView style={styles.listItemHeader}>
                <ThemedView style={styles.listItemContent}>
                  <ThemedText style={styles.listItemTitle}>
                    {convertDateTimestampToLocalString(new Date(record.fecha || new Date()).toISOString(), false)}
                  </ThemedText>
                  <ThemedText style={styles.listItemSubtitle}>
                    Sucursal: {record.sucursal_nombre || 'N/A'}
                  </ThemedText>
                  <ThemedText style={styles.listItemSubtitle}>
                    Tipo de turno: {formatTurnoLabel(record.turno)}
                  </ThemedText>
                  <ThemedText style={styles.listItemSubtitle}>
                    Total Presentes: {record.total_presentes || 'N/A'}
                  </ThemedText>
                  {!!(record.id || record.id_local) && ((record.images && record.images.length > 0) || (record.images_local && record.images_local.length > 0)) && (
                    <>
                      <TouchableOpacity
                        style={styles.collapseButton}
                        onPress={() => {
                          const itemKey = record.id || record.id_local;
                          setExpandedImagesById((prev) => ({ ...prev, [itemKey]: !prev[itemKey] }));
                        }}
                        activeOpacity={0.8}
                      >
                        <ThemedText style={styles.collapseButtonText}>
                          Imágenes ({((record.images || []).length + (record.images_local || []).length)})
                        </ThemedText>
                        <Ionicons
                          name={expandedImagesById[record.id || record.id_local] ? 'chevron-up' : 'chevron-down'}
                          size={18}
                          color="#007AFF"
                        />
                      </TouchableOpacity>
                      {expandedImagesById[record.id || record.id_local] && (
                        <ThemedView style={styles.collapsableContent}>
                          {(record.images || []).map((img: any) => (
                            <ThemedView key={`${record.id || record.id_local}-img-r-${img?.id ?? img?.name ?? Math.random()}`} style={styles.photoItemMini}>
                              <Image
                                source={{ uri: appendTokenAndCacheToUrl(String(img?.url || '')) }}
                                style={styles.photoPreviewMini}
                                resizeMode="contain"
                              />
                              {!!String(img?.original_name || '').trim() && (
                                <ThemedText style={styles.photoCaption}>{String(img.original_name).trim()}</ThemedText>
                              )}
                            </ThemedView>
                          ))}
                          {(record.images_local || []).map((img: any) => {
                            const extRaw = String(img?.extension || 'jpg').replace('.', '').toLowerCase();
                            const mime = extRaw === 'jpg' ? 'jpeg' : extRaw;
                            const uri = `data:image/${mime};base64,${String(img?.base64 || '')}`;
                            return (
                              <ThemedView key={`${record.id || record.id_local}-img-l-${img?.id_local ?? img?.original_name ?? Math.random()}`} style={styles.photoItemMini}>
                                <Image source={{ uri }} style={styles.photoPreviewMini} resizeMode="contain" />
                                {!!String(img?.original_name || '').trim() && (
                                  <ThemedText style={styles.photoCaption}>{String(img.original_name).trim()}</ThemedText>
                                )}
                              </ThemedView>
                            );
                          })}
                        </ThemedView>
                      )}
                    </>
                  )}
                </ThemedView>
              </ThemedView>

              <ThemedView style={styles.listItemDetails}>
                <ThemedView style={styles.listItemButtons}>
                  <TouchableOpacity
                    style={[styles.listItemButton, styles.editButton]}
                    onPress={() => startEditing(record)}
                  >
                    {getActionIcon('edit')}
                    <ThemedText style={styles.listItemButtonText}>Editar</ThemedText>
                  </TouchableOpacity>
                  {!!record.id && (
                    <TouchableOpacity
                      style={[styles.listItemButton, styles.changesButton]}
                      onPress={() => refreshColaboradoresFromServer(String(record.id), true)}
                    >
                      <Ionicons name="list-outline" size={20} color="#FFFFFF" />
                      <ThemedText style={styles.listItemButtonText}>
                        {isRefreshingColaboradores ? 'Actualizando...' : 'Ver lista'}
                      </ThemedText>
                    </TouchableOpacity>
                  )}
                  {!(record.id_local || String(record.id).startsWith('local-') || String(record.id) === '0') && (
                    <TouchableOpacity
                      style={[styles.listItemButton, styles.changesButton]}
                      onPress={() => {
                        setCambiosTitle(`Cambios - Control #${record.id}`);
                        fetchCambios('c_control_asistencia', Number(record.id));
                      }}
                    >
                      <Ionicons name="list-outline" size={20} color="#FFFFFF" />
                      <ThemedText style={styles.listItemButtonText}>Cambios</ThemedText>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.listItemButton, styles.deleteButton]}
                    onPress={() => deleteControlHandler(record)}
                  >
                    {getActionIcon('delete')}
                    <ThemedText style={styles.listItemButtonText}>Eliminar</ThemedText>
                  </TouchableOpacity>
                </ThemedView>
              </ThemedView>
            </ThemedView>
          );
        })}
      </ThemedView>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <AppHeader onMenuPress={handleMenuPress} title="Control de Asistencia" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <ThemedView style={styles.contentContainer}>
          <ThemedView style={styles.titleContainer}>
            <ThemedText style={styles.title}>
              Control de Asistencia
            </ThemedText>
            {hasCurrentMarca && (
              <ThemedText style={styles.subtitle}>
                Controla la asistencia de los colaboradores
              </ThemedText>
            )}
          </ThemedView>

          {!hasCurrentMarca && (
            <ThemedView style={styles.noMarcaContainer}>
              <ThemedText style={styles.noMarcaTitle}>Marca no seleccionada</ThemedText>
              <ThemedText style={styles.noMarcaMessage}>
                No se encontró una marca seleccionada. Por favor, selecciona una marca desde el menú principal.
              </ThemedText>
            </ThemedView>
          )}

          {hasCurrentMarca && !isCreating && !editingRecord && !isLoading && (
            <ThemedView style={styles.filtersContainer}>
              <TouchableOpacity
                style={styles.filtersHeader}
                onPress={() => setIsHierarchyFiltersExpanded(!isHierarchyFiltersExpanded)}
              >
                <ThemedText style={styles.filtersTitle}>Filtros Jerárquicos</ThemedText>
                <Ionicons
                  name={isHierarchyFiltersExpanded ? 'chevron-up' : 'chevron-down'}
                  size={24}
                  color="#000000"
                />
              </TouchableOpacity>
              {isHierarchyFiltersExpanded && (
                <ThemedView style={styles.filtersContent}>
                  <ThemedView style={styles.filterGroup}>
                    <ThemedText style={styles.filterLabel}>Empresa:</ThemedText>
                    <View style={styles.pickerWrapper}>
                      <Picker
                        selectedValue={filterEmpresaId || ''}
                        onValueChange={(value) => {
                          setFilterEmpresaId(value && value !== '' ? Number(value) : null);
                          setFilterClienteId(null);
                          setFilterDivisionId(null);
                          setFilterContratoId(null);
                          setFilterCorpoId(null);
                        }}
                        style={styles.picker}
                      >
                        <Picker.Item label="Seleccionar..." value="" />
                        {filterEmpresas.map((e: any) => (
                          <Picker.Item key={e.id} label={e.nombre} value={e.id} />
                        ))}
                      </Picker>
                    </View>
                  </ThemedView>

                  {filterEmpresaId && (
                    <ThemedView style={styles.filterGroup}>
                      <ThemedText style={styles.filterLabel}>Cliente:</ThemedText>
                      <View style={styles.pickerWrapper}>
                        <Picker
                          selectedValue={filterClienteId || ''}
                          onValueChange={(value) => {
                            setFilterClienteId(value && value !== '' ? Number(value) : null);
                            setFilterDivisionId(null);
                            setFilterContratoId(null);
                            setFilterCorpoId(null);
                          }}
                          style={styles.picker}
                        >
                          <Picker.Item label="Seleccionar..." value="" />
                          {filterClientes.map((c: any) => (
                            <Picker.Item key={c.id} label={c.nombre} value={c.id} />
                          ))}
                        </Picker>
                      </View>
                    </ThemedView>
                  )}

                  {filterClienteId && (
                    <ThemedView style={styles.filterGroup}>
                      <ThemedText style={styles.filterLabel}>División:</ThemedText>
                      <View style={styles.pickerWrapper}>
                        <Picker
                          selectedValue={filterDivisionId || ''}
                          onValueChange={(value) => {
                            setFilterDivisionId(value && value !== '' ? Number(value) : null);
                            setFilterContratoId(null);
                            setFilterCorpoId(null);
                          }}
                          style={styles.picker}
                        >
                          <Picker.Item label="Seleccionar..." value="" />
                          {filterDivisiones.map((d: any) => (
                            <Picker.Item key={d.id} label={d.nombre} value={d.id} />
                          ))}
                        </Picker>
                      </View>
                    </ThemedView>
                  )}

                  {filterClienteId && (
                    <ThemedView style={styles.filterGroup}>
                      <ThemedText style={styles.filterLabel}>Contrato:</ThemedText>
                      <View style={styles.pickerWrapper}>
                        <Picker
                          selectedValue={filterContratoId || ''}
                          onValueChange={(value) => {
                            setFilterContratoId(value && value !== '' ? Number(value) : null);
                            setFilterCorpoId(null);
                          }}
                          style={styles.picker}
                        >
                          <Picker.Item label="Seleccionar..." value="" />
                          {filterContratos.map((c: any) => (
                            <Picker.Item key={c.id} label={c.nombre} value={c.id} />
                          ))}
                        </Picker>
                      </View>
                    </ThemedView>
                  )}

                  {filterContratoId && (
                    <ThemedView style={styles.filterGroup}>
                      <ThemedText style={styles.filterLabel}>Sucursal:</ThemedText>
                      <View style={styles.pickerWrapper}>
                        <Picker
                          selectedValue={filterCorpoId || ''}
                          onValueChange={(value) => {
                            setFilterCorpoId(value && value !== '' ? Number(value) : null);
                          }}
                          style={styles.picker}
                        >
                          <Picker.Item label="Seleccionar..." value="" />
                          {filterSucursales.map((s: any) => (
                            <Picker.Item key={s.id} label={s.nombre} value={s.id} />
                          ))}
                        </Picker>
                      </View>
                    </ThemedView>
                  )}

                  <TouchableOpacity
                    style={styles.resetFiltersButton}
                    onPress={() => {
                      setFilterEmpresaId(null);
                      setFilterClienteId(null);
                      setFilterDivisionId(null);
                      setFilterContratoId(null);
                      setFilterCorpoId(null);
                    }}
                  >
                    <ThemedText style={styles.resetFiltersText}>Limpiar Filtros</ThemedText>
                  </TouchableOpacity>
                </ThemedView>
              )}
            </ThemedView>
          )}

          {isCreating || editingRecord ? (
            <ThemedView style={styles.formContainer}>
              {/* Jerarquía del formulario */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Empresa *</ThemedText>
                <View style={styles.pickerWrapper}>
                  <Picker
                    selectedValue={formEmpresaId || ''}
                    onValueChange={(value) => {
                      setFormEmpresaId(value && value !== '' ? Number(value) : null);
                      setFormClienteId(null);
                      setFormDivisionId(null);
                      setFormContratoId(null);
                      setFormCorpoId(null);
                    }}
                    style={styles.picker}
                  >
                    <Picker.Item label="Seleccionar..." value="" />
                    {formEmpresas.map((e: any) => (
                      <Picker.Item key={e.id} label={e.nombre} value={e.id} />
                    ))}
                  </Picker>
                </View>
              </ThemedView>

              {formEmpresaId && (
                <ThemedView style={styles.formGroup}>
                  <ThemedText style={styles.formLabel}>Cliente *</ThemedText>
                  <View style={styles.pickerWrapper}>
                    <Picker
                      selectedValue={formClienteId || ''}
                      onValueChange={(value) => {
                        setFormClienteId(value && value !== '' ? Number(value) : null);
                        setFormDivisionId(null);
                        setFormContratoId(null);
                        setFormCorpoId(null);
                      }}
                      style={styles.picker}
                    >
                      <Picker.Item label="Seleccionar..." value="" />
                      {formClientes.map((c: any) => (
                        <Picker.Item key={c.id} label={c.nombre} value={c.id} />
                      ))}
                    </Picker>
                  </View>
                </ThemedView>
              )}

              {formClienteId && (
                <ThemedView style={styles.formGroup}>
                  <ThemedText style={styles.formLabel}>División *</ThemedText>
                  <View style={styles.pickerWrapper}>
                    <Picker
                      selectedValue={formDivisionId || ''}
                      onValueChange={(value) => {
                        setFormDivisionId(value && value !== '' ? Number(value) : null);
                        setFormContratoId(null);
                        setFormCorpoId(null);
                      }}
                      style={styles.picker}
                    >
                      <Picker.Item label="Seleccionar..." value="" />
                      {formDivisiones.map((d: any) => (
                        <Picker.Item key={d.id} label={d.nombre} value={d.id} />
                      ))}
                    </Picker>
                  </View>
                </ThemedView>
              )}

              {formClienteId && (
                <ThemedView style={styles.formGroup}>
                  <ThemedText style={styles.formLabel}>Contrato *</ThemedText>
                  <View style={styles.pickerWrapper}>
                    <Picker
                      selectedValue={formContratoId || ''}
                      onValueChange={(value) => {
                        setFormContratoId(value && value !== '' ? Number(value) : null);
                        setFormCorpoId(null);
                      }}
                      style={styles.picker}
                    >
                      <Picker.Item label="Seleccionar..." value="" />
                      {formContratos.map((c: any) => (
                        <Picker.Item key={c.id} label={c.nombre} value={c.id} />
                      ))}
                    </Picker>
                  </View>
                </ThemedView>
              )}

              {formContratoId && (
                <ThemedView style={styles.formGroup}>
                  <ThemedText style={styles.formLabel}>Sucursal *</ThemedText>
                  <View style={styles.pickerWrapper}>
                    <Picker
                      selectedValue={formCorpoId || ''}
                      onValueChange={(value) => {
                        setFormCorpoId(value && value !== '' ? Number(value) : null);
                      }}
                      style={styles.picker}
                    >
                      <Picker.Item label="Seleccionar..." value="" />
                      {formSucursales.map((s: any) => (
                        <Picker.Item key={s.id} label={s.nombre} value={s.id} />
                      ))}
                    </Picker>
                  </View>
                </ThemedView>
              )}

              {/* Fecha */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Fecha</ThemedText>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <ThemedText style={styles.dateButtonText}>
                    {convertDateTimestampToLocalString(new Date(fecha).toISOString(), false)}
                  </ThemedText>
                  <Ionicons name="calendar" size={20} color="#007AFF" />
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={fecha}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleDateChange}
                  />
                )}
              </ThemedView>

              {/* Turno */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Turno</ThemedText>
                <ThemedView style={styles.pickerWrapper}>
                  <Picker selectedValue={turno} onValueChange={(val) => setTurno(String(val))}>
                    {TURNO_OPTIONS.map((o) => (
                      <Picker.Item key={o.value} label={o.label} value={o.value} />
                    ))}
                  </Picker>
                </ThemedView>
              </ThemedView>

              {/* Total presentes */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Total presentes</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Total presentes"
                  placeholderTextColor="#999"
                  value={totalPresentes}
                  onChangeText={setTotalPresentes}
                  keyboardType="numeric"
                />
              </ThemedView>

              {/* Lista de colaboradores según marcas */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Colaboradores (marcas del día)</ThemedText>
                {loadingMarcas ? (
                  <ThemedView style={styles.marcasLoadingBox}>
                    <ActivityIndicator size="small" color="#007AFF" />
                    <ThemedText style={styles.marcasLoadingText}>Cargando marcas...</ThemedText>
                  </ThemedView>
                ) : errorMarcas ? (
                  <ThemedView style={styles.marcasErrorBox}>
                    <Ionicons name="alert-circle" size={20} color="#FF3B30" />
                    <ThemedText style={styles.marcasErrorText}>{errorMarcas}</ThemedText>
                  </ThemedView>
                ) : previewColaboradores.length > 0 ? (
                  <ThemedView style={styles.previewColaboradoresBox}>
                    <ThemedText style={styles.previewColaboradoresSummary}>
                      Total presentes: {previewColaboradores.filter((c: any) => !c?.ausente).length} / {previewColaboradores.length}
                    </ThemedText>
                    <ThemedText style={styles.previewColaboradoresSub}>Presentes:</ThemedText>
                    {previewColaboradores.filter((c: any) => !c?.ausente).map((c: any, idx: number) => (
                      <ThemedText key={`p-${idx}`} style={styles.previewColaboradorLine}>
                        • {c?.nombre || c?.nombre_colaborador || '-'} {c?.cedula ? `(${c.cedula})` : ''}
                        {`\n`}  Puesto: {c?.puesto || '-'} | Inicio: {formatHoraLabel(c?.hora_inicio)} | Fin: {formatHoraLabel(c?.hora_fin)}
                      </ThemedText>
                    ))}
                    <ThemedText style={styles.previewColaboradoresSub}>Ausentes:</ThemedText>
                    {previewColaboradores.filter((c: any) => c?.ausente).map((c: any, idx: number) => (
                      <ThemedText key={`a-${idx}`} style={styles.previewColaboradorLine}>
                        • {c?.nombre || c?.nombre_colaborador || '-'} {c?.cedula ? `(${c.cedula})` : ''}
                        {`\n`}  Puesto: {c?.puesto || '-'} | Inicio: {formatHoraLabel(c?.hora_inicio)} | Fin: {formatHoraLabel(c?.hora_fin)}
                      </ThemedText>
                    ))}
                  </ThemedView>
                ) : formCorpoId && turno.trim() ? (
                  <ThemedView style={styles.marcasEmptyBox}>
                    <ThemedText style={styles.marcasEmptyText}>No hay marcas para la fecha, sucursal y turno seleccionados.</ThemedText>
                  </ThemedView>
                ) : (
                  <ThemedText style={styles.formSubLabel}>
                    Seleccione fecha, sucursal y turno para cargar las marcas de empleados.
                  </ThemedText>
                )}
              </ThemedView>

              {/* Fotografías */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Fotografías</ThemedText>
                <ThemedText style={styles.formSubLabel}>
                  Tome fotografías del control de asistencia
                </ThemedText>
                <TouchableOpacity style={styles.cameraButton} onPress={openCamera}>
                  <Ionicons name="camera" size={24} color="#FFFFFF" />
                  <ThemedText style={styles.cameraButtonText}>Tomar Foto</ThemedText>
                </TouchableOpacity>
                {(imagenesRemote.length > 0 || imagenesLocal.length > 0) && (
                  <ThemedView style={styles.photosContainer}>
                    {imagenesRemote.map((img) => (
                      <ThemedView key={`r-${img.id}`} style={styles.photoItem}>
                        <Image source={{ uri: appendTokenAndCacheToUrl(String(img.url || '')) }} style={styles.photoPreview} resizeMode="contain" />
                        <TouchableOpacity style={styles.removePhotoButton} onPress={() => removeRemoteImage(img.id)}>
                          <Ionicons name="trash" size={20} color="#FF3B30" />
                        </TouchableOpacity>
                      </ThemedView>
                    ))}
                    {imagenesLocal.map((img) => (
                      <ThemedView key={`l-${img.id_local}`} style={styles.photoItem}>
                        <Image source={{ uri: `data:image/jpeg;base64,${img.base64}` }} style={styles.photoPreview} resizeMode="contain" />
                        <TouchableOpacity style={styles.removePhotoButton} onPress={() => removeLocalImage(img.id_local)}>
                          <Ionicons name="trash" size={20} color="#FF3B30" />
                        </TouchableOpacity>
                      </ThemedView>
                    ))}
                  </ThemedView>
                )}
              </ThemedView>

              {/* Firma responsable (generada) */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Firma responsable</ThemedText>

                {!firmaResponsableHash ? (
                  <ThemedView style={styles.signatureButtons}>
                    <TouchableOpacity
                      style={[styles.signatureButton, isGeneratingFirmaResponsable && styles.signatureButtonDisabled]}
                      onPress={generateSignatureResponsable}
                      disabled={isGeneratingFirmaResponsable}
                    >
                      {isGeneratingFirmaResponsable ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          {getActionIcon('signature')}
                          <ThemedText style={styles.signatureButtonText}>Generar</ThemedText>
                        </>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.signatureButton}
                      onPress={handleScanQRResponsable}
                    >
                      {getActionIcon('qr-responsable')}
                      <ThemedText style={styles.signatureButtonText}>Escanear QR</ThemedText>
                    </TouchableOpacity>
                  </ThemedView>
                ) : (
                  <ThemedView style={styles.qrInfoContainer}>
                    <ThemedText style={styles.qrInfoTitle}>Información del QR:</ThemedText>
                    {firmaResponsable && (
                      <>
                        <ThemedText style={styles.qrInfoText}>ID de sesión: {firmaResponsable.sessionId}</ThemedText>
                        <ThemedText style={styles.qrInfoText}>ID del empleado: {firmaResponsable.empleadoId}</ThemedText>
                        {firmaResponsable.empleadoDetalle && (
                          <ThemedText style={styles.qrInfoText}>
                            Empleado: {firmaResponsable.empleadoDetalle.nombre} {firmaResponsable.empleadoDetalle.primer_apellido} {firmaResponsable.empleadoDetalle.segundo_apellido}
                            {firmaResponsable.empleadoDetalle.cedula_empleado ? ` (${firmaResponsable.empleadoDetalle.cedula_empleado})` : ''}
                          </ThemedText>
                        )}
                        <ThemedText style={styles.qrInfoText}>Latitud: {firmaResponsable.latitud}</ThemedText>
                        <ThemedText style={styles.qrInfoText}>Longitud: {firmaResponsable.longitud}</ThemedText>
                        <ThemedText style={styles.qrInfoText}>Timestamp: {convertDateTimestampToLocalString(new Date(Number(firmaResponsable.timestamp)).toISOString())}</ThemedText>
                      </>
                    )}

                    <TouchableOpacity
                      style={styles.clearQRButton}
                      onPress={() => {
                        setFirmaResponsableHash('');
                        setFirmaResponsable(null);
                      }}
                    >
                      <Ionicons name="trash" size={16} color="#FF3B30" />
                      <ThemedText style={styles.clearQRButtonText}>Eliminar firma</ThemedText>
                    </TouchableOpacity>
                  </ThemedView>
                )}
              </ThemedView>

              <ThemedView style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={editingRecord ? cancelEditing : cancelCreating}
                >
                  <ThemedText style={styles.cancelButtonText}>
                    {getActionIcon('cancel')}
                  </ThemedText>
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
                  style={[styles.confirmButton, isSubmitting && styles.buttonDisabled]}
                  onPress={editingRecord ? updateControlHandler : saveControlHandler}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <ThemedText style={styles.confirmButtonText}>
                      {getActionIcon('confirm')}
                    </ThemedText>
                  )}
                </TouchableOpacity>
              </ThemedView>
            </ThemedView>
          ) : (
            <>
              <ThemedView style={styles.listSection}>
                {!isLoading && (
                  <TouchableOpacity style={styles.createButton} onPress={startCreating}>
                    <Ionicons name="add" size={24} color="#FFFFFF" />
                  </TouchableOpacity>
                )}
                {renderControlList()}
              </ThemedView>
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

      {/* Modal: resumen colaboradores */}
      <Modal
        visible={isResumenModalVisible}
        animationType="fade"
        transparent
        presentationStyle="overFullScreen"
        onRequestClose={() => setIsResumenModalVisible(false)}
      >
        <View style={styles.overlay}>
          <ThemedView style={styles.floatModalCardMovimientos}>
            <ThemedView style={styles.floatModalHeader}>
              <ThemedText style={styles.modalTitle}>{resumenModalTitle}</ThemedText>
              <TouchableOpacity onPress={() => setIsResumenModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </ThemedView>

            <ScrollView style={{ maxHeight: Dimensions.get('window').height * 0.75 }} contentContainerStyle={{ padding: 16 }}>
              {resumenColaboradores.length === 0 ? (
                <ThemedText style={styles.emptyText}>No hay colaboradores para mostrar.</ThemedText>
              ) : (
                resumenColaboradores.map((c: any, idx: number) => (
                  <ThemedView key={`res-col-${idx}`} style={styles.cambioCollapsableMain}>
                    <ThemedView style={styles.cambioCollapsableContent}>
                      <ThemedText style={styles.changeDescription}>
                        <ThemedText style={{ fontWeight: '800' }}>Empleado: </ThemedText>
                        {c?.nombre || c?.nombre_colaborador || '-'}
                      </ThemedText>
                      <ThemedText style={styles.changeDescription}>
                        <ThemedText style={{ fontWeight: '800' }}>Cédula: </ThemedText>
                        {c?.cedula || '-'}
                      </ThemedText>
                      <ThemedText style={styles.changeDescription}>
                        <ThemedText style={{ fontWeight: '800' }}>Marca ID: </ThemedText>
                        {String(c?.marca_id ?? '-')}
                      </ThemedText>
                      <ThemedText style={styles.changeDescription}>
                        <ThemedText style={{ fontWeight: '800' }}>Puesto: </ThemedText>
                        {c?.puesto || '-'}
                      </ThemedText>
                      <ThemedText style={styles.changeDescription}>
                        <ThemedText style={{ fontWeight: '800' }}>Hora inicio: </ThemedText>
                        {formatHoraLabel(c?.hora_inicio)}
                      </ThemedText>
                      <ThemedText style={styles.changeDescription}>
                        <ThemedText style={{ fontWeight: '800' }}>Hora fin: </ThemedText>
                        {formatHoraLabel(c?.hora_fin)}
                      </ThemedText>
                      <ThemedText style={styles.changeDescription}>
                        <ThemedText style={{ fontWeight: '800' }}>Estado: </ThemedText>
                        {c?.ausente ? 'Ausente' : 'Presente'}
                      </ThemedText>
                    </ThemedView>
                  </ThemedView>
                ))
              )}
            </ScrollView>
          </ThemedView>
        </View>
      </Modal>

      {/* Camera Modal */}
      <Modal
        visible={isCameraVisible}
        animationType="slide"
        onRequestClose={() => setIsCameraVisible(false)}
      >
        <View style={styles.cameraContainer}>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing="back"
          />
          <View style={styles.cameraControls}>
            <TouchableOpacity
              style={styles.cameraCancelButton}
              onPress={() => setIsCameraVisible(false)}
            >
              <Ionicons name="close" size={30} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cameraCaptureButton}
              onPress={capturePhoto}
            >
              <View style={styles.cameraCaptureButtonInner} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {QRScannerComponent}

      <AppFooter />
      <SlideMenu
        isVisible={isMenuVisible}
        onClose={handleMenuClose}
        onHomePress={handleHomePress}
        currentRoute="AttendanceControl"
      />
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
    color: '#000000',
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
    color: '#000000',
  },
  noMarcaContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 20,
  },
  noMarcaTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF9500',
    textAlign: 'center',
  },
  noMarcaMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 400,
  },
  createButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  formContainer: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    padding: 16,
  },
  formGroup: {
    marginBottom: 15,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 5,
    color: '#000000',
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000000',
    backgroundColor: '#F9F9F9',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#F9F9F9',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#000000',
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F9F9F9',
  },
  picker: {
    height: 50,
    width: '100%',
  },
  // Filtros jerárquicos
  filtersContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 15,
    overflow: 'hidden',
  },
  filtersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#F5F5F5',
  },
  filtersTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
  filtersContent: {
    padding: 15,
  },
  filterGroup: {
    marginBottom: 15,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#000000',
  },
  resetFiltersButton: {
    marginTop: 10,
    padding: 12,
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    alignItems: 'center',
  },
  resetFiltersText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
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
  qrInfoContainer: {
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  qrInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  qrInfoText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  clearQRButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    padding: 8,
    backgroundColor: '#FFEBEE',
    borderRadius: 6,
    gap: 6,
  },
  clearQRButtonText: {
    fontSize: 12,
    color: '#FF3B30',
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#34C759',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
  cancelButton: {
    backgroundColor: '#8E8E93',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  listSection: {
    width: '100%',
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
  },
  listItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  listItemContent: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: 16,
    fontWeight: '600',
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
    paddingTop: 8,
  },
  listItemButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  listItemButton: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  editButton: {
    backgroundColor: '#007AFF',
  },
  changesButton: { backgroundColor: '#5856D6', width: '48%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 8, gap: 8 },
  deleteButton: {
    backgroundColor: '#FF3B30',
  },
  listItemButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#000000',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    marginTop: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#D32F2F',
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  floatModalCardMovimientos: { backgroundColor: '#FFFFFF', borderRadius: 12, width: '100%', maxWidth: 500, maxHeight: '80%', borderWidth: 1, borderColor: '#E0E0E0', overflow: 'hidden' },
  floatModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#000' },
  cambioCollapsableMain: { width: '100%', marginBottom: 10, backgroundColor: '#fff', borderRadius: 6, borderWidth: 1, borderColor: '#E0E0E0', overflow: 'hidden' },
  cambioCollapsableHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#F8F9FA' },
  cambioCollapsableTitle: { fontSize: 14, fontWeight: '600', color: '#007AFF', flex: 1 },
  cambioCollapsableContent: { padding: 12, gap: 8, backgroundColor: '#F8F9FA' },
  changeDescription: { fontSize: 14, lineHeight: 20, color: '#666', marginBottom: 8 },
  filterGroupSearch: { marginBottom: 12 },
  // Image styles
  formSubLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 10,
  },
  marcasLoadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    backgroundColor: '#F0F8FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  marcasLoadingText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  marcasErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  marcasErrorText: {
    fontSize: 14,
    color: '#C62828',
    fontWeight: '600',
    flex: 1,
  },
  marcasEmptyBox: {
    padding: 14,
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFA000',
  },
  marcasEmptyText: {
    fontSize: 14,
    color: '#E65100',
  },
  previewColaboradoresBox: {
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  previewColaboradoresSummary: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
    marginBottom: 10,
  },
  previewColaboradoresSub: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginTop: 8,
    marginBottom: 4,
  },
  previewColaboradorLine: {
    fontSize: 13,
    color: '#555',
    marginLeft: 8,
    marginBottom: 2,
  },
  cameraButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
    gap: 10,
  },
  cameraButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  photosContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 15,
  },
  photoItem: {
    width: '48%',
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  photoPreview: {
    width: '100%',
    height: 200,
    backgroundColor: '#F8F9FA',
  },
  removePhotoButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 59, 48, 0.9)',
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoItemMini: {
    width: '100%',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 8,
    backgroundColor: '#FFFFFF',
  },
  photoPreviewMini: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
  },
  photoCaption: {
    marginTop: 8,
    fontSize: 12,
    color: '#000',
    opacity: 0.7,
  },
  collapseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginTop: 8,
    backgroundColor: '#FAFAFA',
  },
  collapseButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007AFF',
  },
  collapsableContent: {
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  cameraControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  cameraCancelButton: {
    padding: 10,
  },
  cameraCaptureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#fff',
    padding: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraCaptureButtonInner: {
    flex: 1,
    borderRadius: 30,
    backgroundColor: '#007AFF',
    width: '100%',
  },
});

