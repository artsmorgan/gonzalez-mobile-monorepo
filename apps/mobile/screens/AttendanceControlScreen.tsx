import React, { useState, useCallback, useEffect, useMemo } from 'react';
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
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useAuth } from '@/contexts/AuthContext';
import AppHeader from '@/components/AppHeader';
import AppFooter from '@/components/AppFooter';
import SlideMenu from '@/components/SlideMenu';
import { formatDateDMY } from '@/utils/formatDate';
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
  listAttendanceControlByCorpo,
} from '@/hooks/evaluationFunctions';
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
  nombre_colaborador: string;
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

interface AttendanceControl {
  id: string;
  id_local: string;
  empresa_id?: number | string | null;
  cliente_id?: number | string | null;
  division_id?: number | string | null;
  contrato_id?: number | string | null;
  corpo_id?: number | string | null;
  cliente: string | null;
  fecha: string | null;
  turno: string | null;
  area_piso: string | null;
  total_presentes: string | null;
  fijos: string | null;
  colaboradores: string | null;
  firma_responsable?: string | null;
  created_at: string;
  synced?: boolean;
}

interface EditingAttendanceControl {
  id: string | null;
  id_local: string;
  fecha: string;
  turno: string;
  area_piso: string;
  total_presentes: string;
  fijos: string;
  colaboradores: Colaborador[];
  firma_responsable: string;
}

const TURNO_OPTIONS = [
  { label: 'Seleccionar turno', value: '' },
  { label: 'Diurno', value: 'DIURNO' },
  { label: 'Mixto', value: 'MIXTO' },
  { label: 'Nocturno', value: 'NOCTURNO' },
];

type EmpleadoOption = { id: number; nombre: string; cedula: string };

const EMPLEADOS_CORPO_CACHE_KEY = (corpoId: string) => `empleados_corpo_cache_${corpoId}`;

export default function AttendanceControlScreen() {
  const { employee, refreshAccessToken, logout } = useAuth();
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
  const [marcaClienteName, setMarcaClienteName] = useState<string>('');
  const [marcaCorpoName, setMarcaCorpoName] = useState<string>('');
  const [corpoIdStr, setCorpoIdStr] = useState<string>('');
  const [empleadosOptions, setEmpleadosOptions] = useState<EmpleadoOption[]>([]);

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

  // Form states
  const [fecha, setFecha] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [turno, setTurno] = useState('');
  const [areaPiso, setAreaPiso] = useState('');
  const [totalPresentes, setTotalPresentes] = useState('');
  const [fijos, setFijos] = useState('');
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);

  // Time pickers for colaboradores
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerValue, setTimePickerValue] = useState<Date>(new Date());
  const [timePickerTarget, setTimePickerTarget] = useState<{ index: number; field: 'entrada' | 'salida' } | null>(null);

  // Expanded states
  const [expandedColaboradorIndices, setExpandedColaboradorIndices] = useState<number[]>([]);

  // QR scanning state
  const [currentQRType, setCurrentQRType] = useState<{ index: number; type: 'firma_comentario' | 'firma_sustituto' } | null>(null);

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

  const generateRandomId = (): string => {
    return `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDateForDisplay = (date: Date): string => {
    const [year, month, day] = formatDate(date).split('-');
    return `${day}-${month}-${year}`;
  };

  const formatTime = (date: Date): string => {
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  const parseTimeToDate = (time: string): Date => {
    const now = new Date();
    const parts = String(time || '').split(':');
    if (parts.length === 2) {
      const hh = parseInt(parts[0], 10);
      const mm = parseInt(parts[1], 10);
      if (!Number.isNaN(hh) && !Number.isNaN(mm)) {
        now.setHours(hh, mm, 0, 0);
        return now;
      }
    }
    now.setHours(0, 0, 0, 0);
    return now;
  };

  const normalizeControl = (raw: any): AttendanceControl => {
    const clienteName = raw?.cliente ?? raw?.nombre_cliente ?? null;
    return {
      ...raw,
      cliente: clienteName,
      total_presentes: raw?.total_presentes !== null && raw?.total_presentes !== undefined ? String(raw.total_presentes) : null,
      fijos: raw?.fijos !== null && raw?.fijos !== undefined ? String(raw.fijos) : null,
    } as AttendanceControl;
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
      setMarcaClienteName(current?.cliente?.nombre || '');
      setMarcaCorpoName(current?.corpo?.nombre || '');
      const corpoId = current?.corpo?.id?.toString() || current?.corpo_id?.toString();
      setCorpoIdStr(corpoId || '');

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

      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
      const cache = cacheStr ? JSON.parse(cacheStr) : [];
      const controlsCacheAll: AttendanceControl[] = cache.filter((item: any) => item.type === 'attendance_control');
      // Filtrar cache local por corpo_id
      const controlsCache: AttendanceControl[] = controlsCacheAll.filter((r: any) => Number(r.corpo_id) === Number(corpoIdNum));
      const localOnly = controlsCache.filter((r: any) => !r?.synced || String(r?.id_local || '').startsWith('local-'));

      const isConnected = await getConnectionStatus();
      if (!isConnected) {
        setControls(controlsCache);
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
        const unsyncedIds = new Set(localOnly.map((r) => String(r.id || r.id_local || '')));
        const filteredServer = serverItems.filter((r) => !unsyncedIds.has(String(r.id || r.id_local || '')));
        const merged = [...localOnly, ...filteredServer];
        setControls(merged);
      } else {
        setControls(controlsCache);
      }
    } catch (err) {
      console.error('Error fetching controls:', err);
      setError('Error al cargar los controles de asistencia');
      try {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const controlsCache = cache.filter((item: any) => item.type === 'attendance_control');
          setControls(controlsCache);
        }
      } catch (cacheErr) {
        console.error('Error loading from cache:', cacheErr);
      }
    } finally {
      setIsLoading(false);
    }
  }, [refreshAccessToken, logout, filterEmpresaId, filterClienteId, filterDivisionId, filterContratoId, filterCorpoId]);

  const fetchEmpleadosByCorpo = useCallback(async (corpoId: string) => {
    if (!corpoId) return;
    try {
      const hasConnection = await getConnectionStatus();
      const cacheKey = EMPLEADOS_CORPO_CACHE_KEY(corpoId);

      if (!hasConnection) {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) setEmpleadosOptions(parsed);
        }
        return;
      }

      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) return;

      const resp = await authedFetch({
        url: `${apiUrl}/api/empleados/corpo/${corpoId}`,
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

      const data = await resp.json().catch(() => null);
      if (resp.ok && data?.status && Array.isArray(data.empleados)) {
        const mapped: EmpleadoOption[] = data.empleados.map((e: any) => ({
          id: Number(e.id),
          nombre: String(e.nombre || ''),
          cedula: String(e.cedula || ''),
        }));
        setEmpleadosOptions(mapped);
        await AsyncStorage.setItem(cacheKey, JSON.stringify(mapped));
      }
    } catch (e) {
      console.error('Error fetching empleados by corpo:', e);
    }
  }, [refreshAccessToken, logout]);

  useEffect(() => {
    if (corpoIdStr) {
      fetchEmpleadosByCorpo(corpoIdStr);
    }
  }, [corpoIdStr, fetchEmpleadosByCorpo]);

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

  const resetForm = () => {
    setFecha(new Date());
    setTurno('');
    setAreaPiso('');
    setTotalPresentes('');
    setFijos('');
    setColaboradores([]);
    setExpandedColaboradorIndices([]);
    setFirmaResponsable(null);
    setFirmaResponsableHash('');
    // Resetear jerarquía del formulario
    setFormEmpresaId(null);
    setFormClienteId(null);
    setFormDivisionId(null);
    setFormContratoId(null);
    setFormCorpoId(null);
  };

  const startCreating = () => {
    setIsCreating(true);
    setEditingRecord(null);
    resetForm();

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

  const cancelCreating = () => {
    setIsCreating(false);
    resetForm();
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
      area_piso: record.area_piso || '',
      total_presentes: record.total_presentes !== null && record.total_presentes !== undefined ? String(record.total_presentes) : '',
      fijos: record.fijos !== null && record.fijos !== undefined ? String(record.fijos) : '',
      colaboradores: colaboradoresArray,
      firma_responsable: record.firma_responsable || '',
    });

    setFecha(parseFechaToDate(record.fecha));
    setTurno(record.turno || '');
    setAreaPiso(record.area_piso || '');
    setTotalPresentes(record.total_presentes !== null && record.total_presentes !== undefined ? String(record.total_presentes) : '');
    setFijos(record.fijos !== null && record.fijos !== undefined ? String(record.fijos) : '');
    setColaboradores(colaboradoresArray);
    setExpandedColaboradorIndices(colaboradoresArray.map((_, i) => i));
    // Cargar jerarquía del registro
    if (record.empresa_id) setFormEmpresaId(Number(record.empresa_id));
    if (record.cliente_id) setFormClienteId(Number(record.cliente_id));
    if (record.division_id) setFormDivisionId(Number(record.division_id));
    if (record.contrato_id) setFormContratoId(Number(record.contrato_id));
    if (record.corpo_id) setFormCorpoId(Number(record.corpo_id));

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
  };

  const cancelEditing = () => {
    setEditingRecord(null);
    resetForm();
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setFecha(selectedDate);
    }
  };

  const addColaborador = () => {
    const newColaborador: Colaborador = {
      empleado_id: null,
      nombre_colaborador: '',
      cedula: '',
      firma_comentario: '',
      firma_comentario_info: null,
      entrada: '',
      salida: '',
      sustituto_id: null,
      nombre_sustituto: '',
      cedula_sustituto: '',
      firma_sustituto: '',
      firma_sustituto_info: null,
    };
    setColaboradores([...colaboradores, newColaborador]);
    setExpandedColaboradorIndices([...expandedColaboradorIndices, colaboradores.length]);
  };

  const openTimePicker = (index: number, field: 'entrada' | 'salida') => {
    setTimePickerTarget({ index, field });
    const current = colaboradores[index]?.[field] || '';
    setTimePickerValue(parseTimeToDate(current));
    setShowTimePicker(true);
  };

  const handleTimeChange = (_event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    if (!selectedDate || !timePickerTarget) return;

    const { index, field } = timePickerTarget;
    updateColaborador(index, field, formatTime(selectedDate));
    setTimePickerValue(selectedDate);
  };

  const updateColaborador = (index: number, field: keyof Colaborador, value: string | boolean) => {
    const newColaboradores = [...colaboradores];
    newColaboradores[index] = {
      ...newColaboradores[index],
      [field]: value,
    };
    setColaboradores(newColaboradores);
  };

  const removeColaborador = (index: number) => {
    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas eliminar este colaborador?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            setColaboradores(colaboradores.filter((_, i) => i !== index));
            setExpandedColaboradorIndices(expandedColaboradorIndices.filter(i => i !== index).map(i => i > index ? i - 1 : i));
          },
        },
      ]
    );
  };

  const toggleColaboradorExpansion = (index: number) => {
    setExpandedColaboradorIndices(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const handleScanQR = async (index: number, type: 'firma_comentario' | 'firma_sustituto') => {
    try {
      setCurrentQRType({ index, type });
      const qrData = await scanQR();

      if (!qrData) {
        setCurrentQRType(null);
        return;
      }

      // Decodificar el QR para obtener la información
      let qrInfo: QRInfo | null = null;
      try {
        const decodedData = atob(qrData);
        const parts = decodedData.split(':');

        if (parts.length === 5) {
          const [sessionId, empleadoId, latitud, longitud, timestamp] = parts;

          // Intentar obtener detalles del empleado
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
              if (!empleadoResponse) {
                setCurrentQRType(null);
                return;
              }
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

          qrInfo = {
            sessionId,
            empleadoId,
            latitud,
            longitud,
            timestamp,
            empleadoDetalle,
          };
        }
      } catch (decodeError) {
        console.error('Error decoding QR:', decodeError);
        Alert.alert('Error', 'El QR escaneado no tiene el formato correcto');
        setCurrentQRType(null);
        return;
      }

      // Guardar el QR en base64 y la información decodificada
      const newColaboradores = [...colaboradores];
      const infoField = type === 'firma_comentario' ? 'firma_comentario_info' : 'firma_sustituto_info';
      newColaboradores[index] = {
        ...newColaboradores[index],
        [type]: qrData, // El QR en base64
        [infoField]: qrInfo, // La información decodificada
      };
      setColaboradores(newColaboradores);
      setCurrentQRType(null);
    } catch (error) {
      console.error('Error scanning QR:', error);
      Alert.alert('Error', 'No se pudo escanear el código QR');
      setCurrentQRType(null);
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

    const currentMarcaData = JSON.parse(currentMarca);

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas guardar este control de asistencia?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              // Preparar colaboradores para guardar (sin la información decodificada)
              const colaboradoresToSave = colaboradores.map((colab) => ({
                empleado_id: colab.empleado_id,
                nombre_colaborador: colab.nombre_colaborador,
                cedula: colab.cedula,
                firma_comentario: colab.firma_comentario,
                entrada: colab.entrada,
                salida: colab.salida,
                sustituto_id: colab.sustituto_id,
                nombre_sustituto: colab.nombre_sustituto,
                cedula_sustituto: colab.cedula_sustituto,
                firma_sustituto: colab.firma_sustituto,
              }));

              if (!firmaResponsableHash) {
                Alert.alert('Error', 'Debes generar la firma del responsable antes de guardar');
                return;
              }

              // Validar campos jerárquicos
              if (!formEmpresaId || !formClienteId || !formDivisionId || !formContratoId || !formCorpoId) {
                Alert.alert('Error', 'Debe seleccionar Empresa, Cliente, División, Contrato y Sucursal');
                return;
              }

              const requestData = {
                marca_id: currentMarcaData.id,
                empresa_id: formEmpresaId,
                cliente_id: formClienteId,
                division_id: formDivisionId,
                contrato_id: formContratoId,
                corpo_id: formCorpoId,
                cliente: (currentMarcaData?.cliente?.nombre || '').trim() || null,
                fecha: formatDate(fecha) || null,
                turno: turno.trim() || null,
                area_piso: areaPiso.trim() || null,
                total_presentes: totalPresentes.trim() || null,
                fijos: fijos.trim() || null,
                colaboradores: colaboradoresToSave.length > 0 ? JSON.stringify(colaboradoresToSave) : null,
                firma_responsable: firmaResponsableHash,
              };

              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await createAttendanceControl({
                  requestData,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Control de asistencia guardado correctamente');
                  cancelCreating();
                  fetchControls();
                } else {
                  Alert.alert('Error', result.message || 'Error al guardar el control de asistencia');
                }
              } else {
                const localId = generateRandomId();

                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: localId,
                  action: 'create',
                  type: 'attendance_control',
                  payload: requestData,
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                const cache = cacheStr ? JSON.parse(cacheStr) : [];

                const newRecordCache: AttendanceControl = {
                  id: '',
                  id_local: localId,
                  cliente: (currentMarcaData?.cliente?.nombre || '').trim() || null,
                  fecha: formatDate(fecha) || null,
                  turno: turno.trim() || null,
                  area_piso: areaPiso.trim() || null,
                  total_presentes: totalPresentes.trim() || null,
                  fijos: fijos.trim() || null,
                  colaboradores: colaboradoresToSave.length > 0 ? JSON.stringify(colaboradoresToSave) : null,
                  firma_responsable: firmaResponsableHash,
                  created_at: new Date().toISOString(),
                  synced: false,
                };

                cache.push({ ...newRecordCache, type: 'attendance_control' });
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(cache));

                Alert.alert('Modo Offline', 'Control de asistencia registrado localmente. Se sincronizará cuando haya conexión.');
                cancelCreating();
                fetchControls();
              }
            } catch (err) {
              console.error('Error saving control:', err);
              Alert.alert('Error', 'No se pudo guardar el control de asistencia');
            }
          },
        },
      ]
    );
  };

  const updateControlHandler = async () => {
    if (!editingRecord) return;

    const recordId = editingRecord.id || editingRecord.id_local;
    if (!recordId) {
      Alert.alert('Error', 'ID de registro no encontrado para actualizar');
      return;
    }

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas actualizar este control de asistencia?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              // Preparar colaboradores para guardar (sin la información decodificada)
              const colaboradoresToSave = colaboradores.map((colab) => ({
                empleado_id: colab.empleado_id,
                nombre_colaborador: colab.nombre_colaborador,
                cedula: colab.cedula,
                firma_comentario: colab.firma_comentario,
                entrada: colab.entrada,
                salida: colab.salida,
                sustituto_id: colab.sustituto_id,
                nombre_sustituto: colab.nombre_sustituto,
                cedula_sustituto: colab.cedula_sustituto,
                firma_sustituto: colab.firma_sustituto,
              }));

              if (!firmaResponsableHash) {
                Alert.alert('Error', 'Debes generar la firma del responsable antes de actualizar');
                return;
              }

              // Validar campos jerárquicos
              if (!formEmpresaId || !formClienteId || !formDivisionId || !formContratoId || !formCorpoId) {
                Alert.alert('Error', 'Debe seleccionar Empresa, Cliente, División, Contrato y Sucursal');
                return;
              }

              const requestData = {
                empresa_id: formEmpresaId,
                cliente_id: formClienteId,
                division_id: formDivisionId,
                contrato_id: formContratoId,
                corpo_id: formCorpoId,
                cliente: marcaClienteName.trim() || null,
                fecha: formatDate(fecha) || null,
                turno: turno.trim() || null,
                area_piso: areaPiso.trim() || null,
                total_presentes: totalPresentes.trim() || null,
                fijos: fijos.trim() || null,
                colaboradores: colaboradoresToSave.length > 0 ? JSON.stringify(colaboradoresToSave) : null,
                firma_responsable: firmaResponsableHash,
              };

              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await updateAttendanceControl({
                  id: recordId,
                  requestData,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Control de asistencia actualizado correctamente');
                  cancelEditing();
                  fetchControls();
                } else {
                  Alert.alert('Error', result.message || 'Error al actualizar el control de asistencia');
                }
              } else {
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: recordId,
                  action: 'update',
                  type: 'attendance_control',
                  payload: requestData,
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                if (cacheStr) {
                  const cache = JSON.parse(cacheStr);
                  const updatedCache = cache.map((item: any) => {
                    if ((item.id === recordId || item.id_local === recordId) && item.type === 'attendance_control') {
                      return {
                        ...item,
                        ...requestData,
                        synced: false,
                      };
                    }
                    return item;
                  });
                  await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                }

                Alert.alert('Modo Offline', 'Control de asistencia actualizado localmente. Se sincronizará cuando haya conexión.');
                cancelEditing();
                fetchControls();
              }
            } catch (err) {
              console.error('Error updating control:', err);
              Alert.alert('Error', 'No se pudo actualizar el control de asistencia');
            }
          },
        },
      ]
    );
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
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: recordId,
                  action: 'delete',
                  type: 'attendance_control',
                  payload: {},
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                if (cacheStr) {
                  const cache = JSON.parse(cacheStr);
                  const updatedCache = cache.filter((item: any) => !((item.id === recordId || item.id_local === recordId) && item.type === 'attendance_control'));
                  await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                }

                Alert.alert('Modo Offline', 'Control de asistencia marcado para eliminación localmente. Se sincronizará cuando haya conexión.');
                fetchControls();
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
                    {formatDateDMY(record.fecha)}
                  </ThemedText>
                  <ThemedText style={styles.listItemSubtitle}>
                    Cliente: {record.cliente || 'N/A'}
                  </ThemedText>
                  <ThemedText style={styles.listItemSubtitle}>
                    Área / Piso: {record.area_piso || 'N/A'}
                  </ThemedText>
                  <ThemedText style={styles.listItemSubtitle}>
                    Tipo de turno: {record.turno || 'N/A'}
                  </ThemedText>
                  <ThemedText style={styles.listItemSubtitle}>
                    Total Presentes: {record.total_presentes || 'N/A'}
                  </ThemedText>
                  <ThemedText style={styles.listItemSubtitle}>
                    Fijos: {record.fijos || 'N/A'}
                  </ThemedText>
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

  const renderColaborador = (colaborador: Colaborador, index: number) => {
    const isExpanded = expandedColaboradorIndices.includes(index);

    return (
      <ThemedView key={index} style={styles.colaboradorItem}>
        <TouchableOpacity
          style={styles.colaboradorHeader}
          onPress={() => toggleColaboradorExpansion(index)}
        >
          <ThemedView style={styles.colaboradorHeaderContent}>
            <ThemedText style={styles.colaboradorHeaderText}>
              {colaborador.nombre_colaborador || 'Sin nombre'}
            </ThemedText>
          </ThemedView>
          <ThemedView style={styles.colaboradorHeaderActions}>
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                removeColaborador(index);
              }}
              style={styles.removeColaboradorButton}
            >
              <Ionicons name="trash" size={20} color="#FF3B30" />
            </TouchableOpacity>
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={24}
              color="#000000"
            />
          </ThemedView>
        </TouchableOpacity>

        {isExpanded && (
          <ThemedView style={styles.colaboradorContent}>
            {/* Selector colaborador */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Colaborador</ThemedText>
              <ThemedView style={styles.pickerWrapper}>
                <Picker
                  selectedValue={colaborador.empleado_id ?? ''}
                  onValueChange={(value) => {
                    const idNum = value ? parseInt(String(value), 10) : null;
                    const emp = empleadosOptions.find((e) => e.id === idNum);
                    const newColaboradores = [...colaboradores];
                    newColaboradores[index] = {
                      ...newColaboradores[index],
                      empleado_id: idNum,
                      nombre_colaborador: emp?.nombre || '',
                      cedula: emp?.cedula || '',
                    };
                    setColaboradores(newColaboradores);
                  }}
                >
                  <Picker.Item label="Seleccionar colaborador" value="" />
                  {empleadosOptions.map((e) => (
                    <Picker.Item key={e.id} label={e.nombre} value={e.id} />
                  ))}
                </Picker>
              </ThemedView>
            </ThemedView>

            {/* Nombre colaborador */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Nombre colaborador</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder="Nombre colaborador"
                placeholderTextColor="#999"
                value={colaborador.nombre_colaborador}
                editable={false}
              />
            </ThemedView>

            {/* Cédula */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Cédula</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder="Cédula"
                placeholderTextColor="#999"
                value={colaborador.cedula}
                editable={false}
                keyboardType="numeric"
              />
            </ThemedView>

            {/* Firma/comentario */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Firma</ThemedText>
              {!colaborador.firma_comentario ? (
                <TouchableOpacity
                  style={styles.qrButton}
                  onPress={() => handleScanQR(index, 'firma_comentario')}
                >
                  {getActionIcon('qr')}
                  <ThemedText style={styles.qrButtonText}>Escanear QR</ThemedText>
                </TouchableOpacity>
              ) : (
                <ThemedView style={styles.qrInfoContainer}>
                  <ThemedText style={styles.qrInfoTitle}>Información del QR escaneado:</ThemedText>
                  {colaborador.firma_comentario_info && (
                    <>
                      <ThemedText style={styles.qrInfoText}>ID de sesión: {colaborador.firma_comentario_info.sessionId}</ThemedText>
                      <ThemedText style={styles.qrInfoText}>ID del empleado: {colaborador.firma_comentario_info.empleadoId}</ThemedText>
                      {colaborador.firma_comentario_info.empleadoDetalle && (
                        <ThemedText style={styles.qrInfoText}>
                          Empleado: {colaborador.firma_comentario_info.empleadoDetalle.nombre} {colaborador.firma_comentario_info.empleadoDetalle.primer_apellido} {colaborador.firma_comentario_info.empleadoDetalle.segundo_apellido}{colaborador.firma_comentario_info.empleadoDetalle.cedula_empleado ? ` (${colaborador.firma_comentario_info.empleadoDetalle.cedula_empleado})` : ''}
                        </ThemedText>
                      )}
                      <ThemedText style={styles.qrInfoText}>Latitud: {colaborador.firma_comentario_info.latitud}</ThemedText>
                      <ThemedText style={styles.qrInfoText}>Longitud: {colaborador.firma_comentario_info.longitud}</ThemedText>
                      <ThemedText style={styles.qrInfoText}>Timestamp: {new Date(parseInt(colaborador.firma_comentario_info.timestamp)).toLocaleString()}</ThemedText>
                    </>
                  )}
                  <TouchableOpacity
                    style={styles.clearQRButton}
                    onPress={() => {
                      const newColaboradores = [...colaboradores];
                      newColaboradores[index] = {
                        ...newColaboradores[index],
                        firma_comentario: '',
                        firma_comentario_info: null,
                      };
                      setColaboradores(newColaboradores);
                    }}
                  >
                    <Ionicons name="trash" size={16} color="#FF3B30" />
                    <ThemedText style={styles.clearQRButtonText}>Eliminar QR</ThemedText>
                  </TouchableOpacity>
                </ThemedView>
              )}
            </ThemedView>

            {/* Entrada */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Entrada</ThemedText>
              <TouchableOpacity style={styles.dateButton} onPress={() => openTimePicker(index, 'entrada')}>
                <ThemedText style={styles.dateButtonText}>{colaborador.entrada || 'Seleccionar hora'}</ThemedText>
                <Ionicons name="time" size={20} color="#007AFF" />
              </TouchableOpacity>
            </ThemedView>

            {/* Salida */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Salida</ThemedText>
              <TouchableOpacity style={styles.dateButton} onPress={() => openTimePicker(index, 'salida')}>
                <ThemedText style={styles.dateButtonText}>{colaborador.salida || 'Seleccionar hora'}</ThemedText>
                <Ionicons name="time" size={20} color="#007AFF" />
              </TouchableOpacity>
            </ThemedView>

            {/* Selector sustituto */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Sustituto</ThemedText>
              <ThemedView style={styles.pickerWrapper}>
                <Picker
                  selectedValue={colaborador.sustituto_id ?? ''}
                  onValueChange={(value) => {
                    const idNum = value ? parseInt(String(value), 10) : null;
                    const emp = empleadosOptions.find((e) => e.id === idNum);
                    const newColaboradores = [...colaboradores];
                    newColaboradores[index] = {
                      ...newColaboradores[index],
                      sustituto_id: idNum,
                      nombre_sustituto: emp?.nombre || '',
                      cedula_sustituto: emp?.cedula || '',
                    };
                    setColaboradores(newColaboradores);
                  }}
                >
                  <Picker.Item label="Seleccionar sustituto" value="" />
                  {empleadosOptions.map((e) => (
                    <Picker.Item key={e.id} label={e.nombre} value={e.id} />
                  ))}
                </Picker>
              </ThemedView>
            </ThemedView>

            {/* Nombre Sustituto */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Nombre Sustituto</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder="Nombre Sustituto"
                placeholderTextColor="#999"
                value={colaborador.nombre_sustituto}
                editable={false}
              />
            </ThemedView>

            {/* Cédula Sustituto */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Cédula Sustituto</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder="Cédula Sustituto"
                placeholderTextColor="#999"
                value={colaborador.cedula_sustituto}
                editable={false}
                keyboardType="numeric"
              />
            </ThemedView>

            {/* Firma Sustituto */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Firma Sustituto</ThemedText>
              {!colaborador.firma_sustituto ? (
                <TouchableOpacity
                  style={styles.qrButton}
                  onPress={() => handleScanQR(index, 'firma_sustituto')}
                >
                  {getActionIcon('qr')}
                  <ThemedText style={styles.qrButtonText}>Escanear QR</ThemedText>
                </TouchableOpacity>
              ) : (
                <ThemedView style={styles.qrInfoContainer}>
                  <ThemedText style={styles.qrInfoTitle}>Información del QR escaneado:</ThemedText>
                  {colaborador.firma_sustituto_info && (
                    <>
                      <ThemedText style={styles.qrInfoText}>ID de sesión: {colaborador.firma_sustituto_info.sessionId}</ThemedText>
                      <ThemedText style={styles.qrInfoText}>ID del empleado: {colaborador.firma_sustituto_info.empleadoId}</ThemedText>
                      {colaborador.firma_sustituto_info.empleadoDetalle && (
                        <ThemedText style={styles.qrInfoText}>
                          Empleado: {colaborador.firma_sustituto_info.empleadoDetalle.nombre} {colaborador.firma_sustituto_info.empleadoDetalle.primer_apellido} {colaborador.firma_sustituto_info.empleadoDetalle.segundo_apellido}{colaborador.firma_sustituto_info.empleadoDetalle.cedula_empleado ? ` (${colaborador.firma_sustituto_info.empleadoDetalle.cedula_empleado})` : ''}
                        </ThemedText>
                      )}
                      <ThemedText style={styles.qrInfoText}>Latitud: {colaborador.firma_sustituto_info.latitud}</ThemedText>
                      <ThemedText style={styles.qrInfoText}>Longitud: {colaborador.firma_sustituto_info.longitud}</ThemedText>
                      <ThemedText style={styles.qrInfoText}>Timestamp: {new Date(parseInt(colaborador.firma_sustituto_info.timestamp)).toLocaleString()}</ThemedText>
                    </>
                  )}
                  <TouchableOpacity
                    style={styles.clearQRButton}
                    onPress={() => {
                      const newColaboradores = [...colaboradores];
                      newColaboradores[index] = {
                        ...newColaboradores[index],
                        firma_sustituto: '',
                        firma_sustituto_info: null,
                      };
                      setColaboradores(newColaboradores);
                    }}
                  >
                    <Ionicons name="trash" size={16} color="#FF3B30" />
                    <ThemedText style={styles.clearQRButtonText}>Eliminar QR</ThemedText>
                  </TouchableOpacity>
                </ThemedView>
              )}
            </ThemedView>
          </ThemedView>
        )}
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
              {/* Cliente (read-only desde current_marca) */}

              {false && (
                <>
                  <ThemedView style={styles.formGroup}>
                    <ThemedText style={styles.formLabel}>Cliente</ThemedText>
                    <ThemedView style={styles.readonlyBox}>
                      <ThemedText style={styles.readonlyText}>{marcaClienteName || 'N/A'}</ThemedText>
                    </ThemedView>
                  </ThemedView>

                  <ThemedView style={styles.formGroup}>
                    <ThemedText style={styles.formLabel}>Sucursal</ThemedText>
                    <ThemedView style={styles.readonlyBox}>
                      <ThemedText style={styles.readonlyText}>{marcaCorpoName || 'N/A'}</ThemedText>
                    </ThemedView>
                  </ThemedView>
                </>
              )}

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
                    {formatDateForDisplay(fecha)}
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

              {/* Area/Piso */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Area/Piso</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Area/Piso"
                  placeholderTextColor="#999"
                  value={areaPiso}
                  onChangeText={setAreaPiso}
                />
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

              {/* Fijos */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Fijos</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Fijos"
                  placeholderTextColor="#999"
                  value={fijos}
                  onChangeText={setFijos}
                  keyboardType="numeric"
                />
              </ThemedView>

              {/* Lista de colaboradores */}
              {colaboradores.map((colaborador, index) => renderColaborador(colaborador, index))}

              {/* Time picker global para colaboradores */}
              {showTimePicker && (
                <DateTimePicker
                  value={timePickerValue}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleTimeChange}
                />
              )}

              <TouchableOpacity
                style={styles.addColaboradorButton}
                onPress={addColaborador}
              >
                <Ionicons name="add-circle" size={24} color="#4CAF50" />
                <ThemedText style={styles.addColaboradorButtonText}>Agregar Colaborador</ThemedText>
              </TouchableOpacity>

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
                        <ThemedText style={styles.qrInfoText}>Timestamp: {new Date(parseInt(firmaResponsable.timestamp)).toLocaleString()}</ThemedText>
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
                <TouchableOpacity
                  style={styles.confirmButton}
                  onPress={editingRecord ? updateControlHandler : saveControlHandler}
                >
                  <ThemedText style={styles.confirmButtonText}>
                    {getActionIcon('confirm')}
                  </ThemedText>
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
                  const createdAtLabel = formatCambioCreatedAt(row?.created_at);
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
  readonlyBox: {
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 8,
    padding: 14,
    backgroundColor: '#E3F2FD',
    marginBottom: 15,
  },
  readonlyText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007AFF',
    textAlign: 'left',
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
  compactInfoRow: {
    flexDirection: 'column',
    gap: 8,
    backgroundColor: '#E3F2FD',
  },
  compactInfoItem: {
    width: '100%',
    backgroundColor: '#E3F2FD',
  },
  compactInfoLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 3,
    color: '#000000',
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
  colaboradorItem: {
    marginBottom: 15,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  colaboradorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#F5F5F5',
  },
  colaboradorHeaderContent: {
    flex: 1,
    marginRight: 10,
  },
  colaboradorHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    backgroundColor: '#F5F5F5',
  },
  colaboradorHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F5F5F5',
  },
  removeColaboradorButton: {
    padding: 4,
  },
  colaboradorContent: {
    padding: 15,
  },
  qrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2196F3',
    gap: 8,
  },
  qrButtonText: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '600',
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
  addColaboradorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    marginTop: 10,
    marginBottom: 20,
    gap: 8,
  },
  addColaboradorButtonText: {
    color: '#4CAF50',
    fontSize: 14,
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
    justifyContent: 'space-between',
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
    backgroundColor: '#007AFF',
  },
  changesButton: { backgroundColor: '#5856D6', flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 8, gap: 8 },
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
});

