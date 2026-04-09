import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  Dimensions,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import SignatureScreen from 'react-native-signature-canvas';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import * as Network from 'expo-network';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { jwtDecode } from 'jwt-decode';

import AppHeader from '@/components/AppHeader';
import AppFooter from '@/components/AppFooter';
import SlideMenu from '@/components/SlideMenu';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useAuth } from '@/contexts/AuthContext';
import { RootStackParamList } from '../App';
import { eventBus } from '@/hooks/eventBus';
import getHoraAccion from '@/hooks/getHoraAccion';
import { useQRScanner } from '@/hooks/useQRScanner';
import authedFetch from '@/hooks/authedFetch';
import { convertDateTimestampToLocalString } from '@/hooks/convertDateTimestampToLocalString';
import {
  createActaEntregaProducto,
  deleteActaEntregaProducto,
  listActaEntregaProducto,
  listActaEntregaProductoByCorpo,
  updateActaEntregaProducto,
} from '@/hooks/evaluationFunctions';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'ActaEntregaProductos'>;

type MainStructureSucursalNode = { id: number; nombre: string; nro_sucursal: string };
type MainStructureContratoNode = { id: number; nombre: string; sucursales: MainStructureSucursalNode[] };
type MainStructureDivisionNode = { id: number; nombre: string; contratos: MainStructureContratoNode[] };
type MainStructureClienteNode = { id: number; nombre: string; division: MainStructureDivisionNode[] };
type MainStructureEmpresaNode = { id: number; nombre: string; clientes: MainStructureClienteNode[] };
type MainStructureTree = MainStructureEmpresaNode[];

/** Solo `current_marca.roleDivision.division.id` (MarcaIngresoSalida). */
function getMarcaRoleDivisionId(current: any): number | null {
  const idRaw = current?.roleDivision?.division?.id;
  if (idRaw == null || idRaw === '') return null;
  const n = Number(idRaw);
  return Number.isFinite(n) ? n : null;
}

/** Confirma que el id exista bajo empresa/cliente en main_structure; si no hay árbol o ramas, devuelve el mismo id. */
function resolveDivisionIdInStructure(
  structure: MainStructureTree,
  empresaId: number | null,
  clienteId: number | null,
  divisionId: number | null,
): number | null {
  if (divisionId == null || !Number.isFinite(divisionId)) return null;
  if (!empresaId || !clienteId || !Array.isArray(structure)) return Number(divisionId);
  const empresa = structure.find((e: any) => Number(e.id) === Number(empresaId));
  const cliente = empresa?.clientes?.find((c: any) => Number(c.id) === Number(clienteId));
  const divisions: any[] = Array.isArray(cliente?.division) ? cliente.division : [];
  const found = divisions.find((d: any) => Number(d.id) === Number(divisionId));
  return found ? Number(found.id) : Number(divisionId);
}

function resolveMarcaDivisionIdForTree(currentMarca: any, structure: MainStructureTree): number | null {
  const divisionId = getMarcaRoleDivisionId(currentMarca);
  if (divisionId == null) return null;
  const empresaIdRaw = currentMarca?.empresa?.id ?? currentMarca?.empresa_id;
  const clienteIdRaw = currentMarca?.cliente?.id ?? currentMarca?.cliente_id;
  const empresaId = empresaIdRaw != null && empresaIdRaw !== '' ? Number(empresaIdRaw) : null;
  const clienteId = clienteIdRaw != null && clienteIdRaw !== '' ? Number(clienteIdRaw) : null;
  return resolveDivisionIdInStructure(
    structure,
    empresaId != null && Number.isFinite(empresaId) ? empresaId : null,
    clienteId != null && Number.isFinite(clienteId) ? clienteId : null,
    divisionId,
  );
}

/**
 * Alcance de listado: misma jerarquía que `fetchRecords` (filtro explícito o `current_marca`).
 * La lista principal se identifica sobre todo por `corpo_id` (sucursal), junto con empresa → cliente → división → contrato cuando aplica.
 */
type ActaEntregaFetchScope = {
  empresaId: number | null;
  clienteId: number | null;
  divisionId: number | null;
  contratoId: number | null;
  corpoId: number | null;
};

/** Igual que el filtrado de `localRecords` en `fetchRecords` (offline / vista). */
function actaEntregaRecordMatchesFetchScope(r: any, scope: ActaEntregaFetchScope): boolean {
  const { empresaId, clienteId, divisionId, contratoId, corpoId } = scope;
  if (empresaId && Number(r.empresa_id) !== Number(empresaId)) return false;
  if (clienteId && Number(r.cliente_id) !== Number(clienteId)) return false;
  if (divisionId && Number(r.division_id) !== Number(divisionId)) return false;
  if (contratoId && Number(r.contrato_id) !== Number(contratoId)) return false;
  if (corpoId && Number(r.corpo_id) !== Number(corpoId)) return false;
  return true;
}

/**
 * Con respuesta del servidor (online): en `evaluations_cache` solo se sustituyen actas del mismo
 * alcance jerárquico que la búsqueda; se conservan actas de otras sucursas/rutas y los borradores
 * pendientes (`synced === false`) del alcance actual.
 */
async function mergeActaEntregaServerIntoEvaluationsCache(
  serverRecords: ActaEntregaProducto[],
  scope: ActaEntregaFetchScope
): Promise<void> {
  let raw: any[] = [];
  try {
    const cacheStr = await AsyncStorage.getItem('evaluations_cache');
    const parsed = cacheStr ? JSON.parse(cacheStr) : [];
    raw = Array.isArray(parsed) ? parsed : [];
  } catch {
    raw = [];
  }

  const preserved = raw.filter((it: any) => {
    if (it?.type !== 'acta_entrega_producto') return true;
    if (!actaEntregaRecordMatchesFetchScope(it, scope)) return true;
    if (it.synced === false) return true;
    return false;
  });

  const fromServer = serverRecords.map((r) => ({
    ...(r as Record<string, unknown>),
    type: 'acta_entrega_producto',
    synced: true,
  }));

  await AsyncStorage.setItem('evaluations_cache', JSON.stringify([...preserved, ...fromServer]));
}

type DetalleItem = {
  id_local: string;
  descripcion: string;
  unidad_medida: string;
  cantidad: string;
  devolucion: string;
  faltantes: string;
};

type ActaImage = {
  id?: number;
  name?: string; // server filename
  base64?: string; // dataURL (offline)
  extension?: string;
};

type ActaEntregaProducto = {
  id?: number | string;
  id_local: string;
  synced?: boolean;

  empresa_id?: number;
  cliente_id?: number;
  division_id?: number;
  contrato_id?: number;
  corpo_id?: number;

  fecha?: string;
  tipo_entrega: string;
  mensual: string;
  detalle: string; // JSON string
  observaciones: string;

  nombre_entrega: string;
  cedula_entrega: string;
  fecha_entrega: string; // ISO
  firma_entrega?: string | null; // dataURL, opcional

  nombre_recibe: string;
  cedula_recibe: string;
  fecha_recibe: string; // ISO
  firma_recibe?: string | null; // dataURL, opcional

  firma_responsable: string; // hash base64

  images?: ActaImage[];
};

const generateRandomId = (): string => `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const formatSignatureForDisplay = (value?: string | null) => {
  if (!value) return '';
  return value.startsWith('data:') ? value : `data:image/png;base64,${value}`;
};

const formatDateDMY = (date: Date) => {
  const dateString = date.toISOString().split('T')[0];
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  return `${day}-${month}-${year}`;
};

const formatDateStringDMY = (value?: any) => {
  if (!value) return 'N/A';
  try {
    const iso = String(value);
    const ymd = iso.includes('T') ? iso.split('T')[0] : iso;
    const [y, m, d] = ymd.split('-');
    if (!y || !m || !d) return ymd;
    return `${d.padStart(2, '0')}-${m.padStart(2, '0')}-${y}`;
  } catch {
    return String(value);
  }
};

const TIPO_ENTREGA_DEFAULT = '-';

/** Fecha local sin hora (evita valores inválidos → RangeError al llamar toISOString). */
function parseDateInputToLocalDate(value: unknown, fallback: Date): Date {
  const atLocalDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const fb = !fallback || Number.isNaN(fallback.getTime()) ? new Date() : fallback;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return atLocalDay(value);
  }
  if (value == null || value === '') return atLocalDay(fb);

  const s = String(value).trim();
  const head = s.includes('T') ? s.split('T')[0] : s;
  const isoParts = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(head);
  if (isoParts) {
    const y = parseInt(isoParts[1], 10);
    const mo = parseInt(isoParts[2], 10);
    const d = parseInt(isoParts[3], 10);
    const dt = new Date(y, mo - 1, d);
    if (!Number.isNaN(dt.getTime())) return dt;
  }

  const t = Date.parse(s);
  if (Number.isFinite(t)) {
    const dt = new Date(t);
    if (!Number.isNaN(dt.getTime())) return atLocalDay(dt);
  }
  return atLocalDay(fb);
}

/** ISO desde solo-fecha (mediodía local para el backend, sin hora elegida por el usuario). */
function dateOnlyToIsoString(d: Date): string {
  if (!d || Number.isNaN(d.getTime())) return new Date().toISOString();
  const y = d.getFullYear();
  const m = d.getMonth();
  const day = d.getDate();
  return new Date(y, m, day, 12, 0, 0, 0).toISOString();
}

function formatDateOnlyLabel(d: Date, fallbackLabel = '—'): string {
  if (!d || Number.isNaN(d.getTime())) return fallbackLabel;
  try {
    return convertDateTimestampToLocalString(dateOnlyToIsoString(d), false);
  } catch {
    return fallbackLabel;
  }
}

/** Epoch en firma responsable (getHoraAccion / servidor); evita RangeError en toISOString / convertDateTimestampToLocalString. */
function safeFirmaTimestampLabel(raw: string | undefined): string {
  if (raw == null || raw === '') return 'N/A';
  const n = Number(String(raw).trim());
  if (!Number.isFinite(n)) return 'N/A';
  let ms = n;
  if (n > 0 && n < 1e12) ms = n * 1000;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return 'N/A';
  try {
    return convertDateTimestampToLocalString(d.toISOString()) || 'N/A';
  } catch {
    return 'N/A';
  }
}

/** Ms desde getHoraAccion; si falta o es inválido, hora local (evita NaN → RangeError en toISOString). */
async function getHoraAccionSafeMs(): Promise<number> {
  try {
    const t = await getHoraAccion();
    return typeof t === 'number' && Number.isFinite(t) ? t : Date.now();
  } catch {
    return Date.now();
  }
}

function epochMsToIsoSafe(ms: number): string {
  if (!Number.isFinite(ms)) return new Date().toISOString();
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  try {
    return d.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

const signatureWebStyle = `
  .m-signature-pad {box-shadow: none; border: none;}
  .m-signature-pad--body {border: 1px solid #e0e0e0;}
  .m-signature-pad--footer {display: none; margin: 0px;}
  body,html {width: 100%; height: 100%; margin: 0; padding: 0;}
`;

export default function ActaEntregaProductosScreen() {
  const navigation = useNavigation<NavProp>();
  const { employee, isAuthenticated, isLoading, refreshAccessToken, logout, accessToken } = useAuth();
  const { scanQR } = useQRScanner();
  const appendTokenToUrl = (url: string) => {
    if (!url) return '';
    if (!accessToken || accessToken.trim().length === 0) return url;
    if (/[?&]token=/.test(url)) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}token=${encodeURIComponent(accessToken)}`;
  };

  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasCurrentMarca, setHasCurrentMarca] = useState(false);

  const [records, setRecords] = useState<ActaEntregaProducto[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ActaEntregaProducto | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResponse, setSubmitResponse] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [deletingRecordKey, setDeletingRecordKey] = useState<string | null>(null);

  // Modal: ver cambios (auditoría)
  const [isCambiosModalVisible, setIsCambiosModalVisible] = useState(false);
  const [cambiosTitle, setCambiosTitle] = useState<string>('Cambios');
  const [cambiosItems, setCambiosItems] = useState<any[]>([]);
  const [expandedCambioId, setExpandedCambioId] = useState<number | null>(null);

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
  /** Precarga de filtros desde la marca una vez por visita (no se reaplica si cambia `structure`). */
  const filtersMarcaAppliedOnceRef = useRef(false);
  /** El usuario pulsó "Limpiar Filtros": no volver a precargar jerarquía hasta la próxima entrada a la pantalla. */
  const userClearedHierarchyFiltersRef = useRef(false);

  // Estructura jerárquica
  const [structure, setStructure] = useState<MainStructureTree>([]);
  const [isStructureLoading, setIsStructureLoading] = useState(false);

  // Form - Jerarquía
  const [formEmpresaId, setFormEmpresaId] = useState<number | null>(null);
  const [formClienteId, setFormClienteId] = useState<number | null>(null);
  const [formDivisionId, setFormDivisionId] = useState<number | null>(null);
  const [formContratoId, setFormContratoId] = useState<number | null>(null);
  const [formCorpoId, setFormCorpoId] = useState<number | null>(null);

  // Form
  const [fecha, setFecha] = useState<Date>(new Date());
  const [mensual, setMensual] = useState('');
  const [observaciones, setObservaciones] = useState('');

  const [nombreEntrega, setNombreEntrega] = useState('');
  const [cedulaEntrega, setCedulaEntrega] = useState('');
  const [fechaEntrega, setFechaEntrega] = useState<Date>(new Date());
  const [firmaEntrega, setFirmaEntrega] = useState<string>('');

  const [nombreRecibe, setNombreRecibe] = useState('');
  const [cedulaRecibe, setCedulaRecibe] = useState('');
  const [fechaRecibe, setFechaRecibe] = useState<Date>(new Date());
  const [firmaRecibe, setFirmaRecibe] = useState<string>('');

  const [firmaResponsableHash, setFirmaResponsableHash] = useState<string>('');
  const [isGeneratingFirmaResponsable, setIsGeneratingFirmaResponsable] = useState(false);

  const [detalleItems, setDetalleItems] = useState<DetalleItem[]>([]);
  const [expandedDetalleIds, setExpandedDetalleIds] = useState<string[]>([]);
  const [expandedImagesIds, setExpandedImagesIds] = useState<string[]>([]);
  const [expandedSignaturesIds, setExpandedSignaturesIds] = useState<string[]>([]);

  // Photos
  const [images, setImages] = useState<ActaImage[]>([]);
  const [photosDirty, setPhotosDirty] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [isCameraVisible, setIsCameraVisible] = useState(false);

  // Signature modal
  const signatureRef = useRef<any>(null);
  const [isSignatureModalVisible, setIsSignatureModalVisible] = useState(false);
  const [signatureKey, setSignatureKey] = useState(0);
  const [signatureTarget, setSignatureTarget] = useState<'entrega' | 'recibe'>('entrega');

  // Date pickers (solo fecha, sin hora)
  const [showFechaEntregaPicker, setShowFechaEntregaPicker] = useState(false);
  const [showFechaRecibePicker, setShowFechaRecibePicker] = useState(false);

  const getConnectionStatus = async (): Promise<boolean> => {
    const networkState = await Network.getNetworkStateAsync();
    return networkState.isConnected && networkState.isInternetReachable ? true : false;
  };

  const closeCambiosModal = () => {
    setIsCambiosModalVisible(false);
    setCambiosItems([]);
    setExpandedCambioId(null);
  };

  const formatDetalleForDisplay = (detalleJson: string): string => {
    try {
      const detalle: DetalleItem[] = JSON.parse(detalleJson || '[]');
      if (!Array.isArray(detalle) || detalle.length === 0) return 'No hay productos en el detalle.';
      return detalle.map((d, idx) => {
        const descripcion = d.descripcion || 'N/A';
        const unidadMedida = d.unidad_medida || 'N/A';
        const cantidad = d.cantidad || 'N/A';
        const devolucion = d.devolucion || 'N/A';
        const faltantes = d.faltantes || 'N/A';
        return `${idx + 1}. ${descripcion}\n   Unidad: ${unidadMedida}, Cantidad: ${cantidad}\n   Devolución: ${devolucion}, Faltantes: ${faltantes}`;
      }).join('\n\n');
    } catch (e) {
      console.error('Error formatting detalle for display:', e);
      return 'Error al formatear detalle.';
    }
  };

  const formatChangeValue = (prop: string, value: any): string => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';
    if (typeof value === 'object') {
      if (prop === 'detalle') {
        return formatDetalleForDisplay(JSON.stringify(value));
      }
      return JSON.stringify(value, null, 2);
    }
    if (typeof value === 'string') {
      if (value.trim().startsWith('{') || value.trim().startsWith('[')) {
        try {
          const parsed = JSON.parse(value);
          if (prop === 'detalle') {
            return formatDetalleForDisplay(value);
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

  // Auth redirect
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigation.replace('Home');
    }
  }, [isAuthenticated, isLoading, navigation]);

  const resetForm = (horaAccion: number) => {
    setFecha(parseDateInputToLocalDate(new Date(horaAccion), new Date()));
    setMensual('');
    setObservaciones('');
    setNombreEntrega('');
    setCedulaEntrega('');
    setFechaEntrega(parseDateInputToLocalDate(new Date(horaAccion), new Date()));
    setFirmaEntrega('');
    setNombreRecibe('');
    setCedulaRecibe('');
    setFechaRecibe(parseDateInputToLocalDate(new Date(horaAccion), new Date()));
    setFirmaRecibe('');
    setFirmaResponsableHash('');
    setDetalleItems([]);
    setExpandedDetalleIds([]);
    setExpandedImagesIds([]);
    setExpandedSignaturesIds([]);
    setImages([]);
    setPhotosDirty(false);
  };

  const decodeFirmaHash = (hash: string) => {
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

  const generateFirmaHashForCurrentUser = async (): Promise<string | null> => {
    try {
      if (!employee) {
        Alert.alert('Error', 'No se pudo obtener la información del empleado');
        return null;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'Se necesita permiso de ubicación para generar la firma');
        return null;
      }

      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        Alert.alert('Error', 'No se pudo obtener el token de sesión');
        return null;
      }

      const decoded: any = jwtDecode(token);
      const sessionId = decoded.sessionId || 'unknown';
      const timestamp = await getHoraAccionSafeMs();

      const { latitude, longitude } = location.coords;
      const empleadoId = String(employee.id);
      return btoa(`${sessionId}:${empleadoId}:${latitude}:${longitude}:${timestamp}`);
    } catch (e) {
      console.error('Error generating firma_responsable:', e);
      return null;
    }
  };

  const handleGenerateFirmaResponsable = async () => {
    try {
      setIsGeneratingFirmaResponsable(true);
      const hash = await generateFirmaHashForCurrentUser();
      if (!hash) return;
      setFirmaResponsableHash(hash);
    } finally {
      setIsGeneratingFirmaResponsable(false);
    }
  };

  const handleScanFirmaResponsable = async () => {
    try {
      const qrData = await scanQR();
      if (!qrData) return;
      const decoded = decodeFirmaHash(qrData);
      if (!decoded) {
        Alert.alert('Error', 'El QR escaneado no tiene el formato correcto');
        return;
      }
      setFirmaResponsableHash(qrData);
    } catch (e) {
      console.error('Error scanning firma_responsable:', e);
      Alert.alert('Error', 'No se pudo escanear el QR');
    }
  };

  const addDetalleItem = () => {
    const id_local = generateRandomId();
    const newItem: DetalleItem = {
      id_local,
      descripcion: '',
      unidad_medida: '',
      cantidad: '',
      devolucion: '',
      faltantes: '',
    };
    setDetalleItems((prev) => [...prev, newItem]);
    setExpandedDetalleIds((prev) => [...prev, id_local]);
  };

  const updateDetalleItem = (id_local: string, field: keyof Omit<DetalleItem, 'id_local'>, value: string) => {
    setDetalleItems((prev) =>
      prev.map((it) => (it.id_local === id_local ? { ...it, [field]: value } : it))
    );
  };

  const removeDetalleItem = (id_local: string) => {
    Alert.alert('Confirmar', '¿Eliminar este detalle?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          setDetalleItems((prev) => prev.filter((it) => it.id_local !== id_local));
          setExpandedDetalleIds((prev) => prev.filter((id) => id !== id_local));
        },
      },
    ]);
  };

  const toggleDetalleExpand = (id_local: string) => {
    setExpandedDetalleIds((prev) => (prev.includes(id_local) ? prev.filter((id) => id !== id_local) : [...prev, id_local]));
  };

  const loadImageFromServer = useCallback(async (actaId: number, imageName: string): Promise<string | null> => {
    try {
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) return null;

      const resp = await authedFetch({
        url: appendTokenToUrl(`${apiUrl}/api/acta-entrega-productos/${actaId}/get-image/${encodeURIComponent(imageName)}?t=${Date.now()}`),
        init: {
          method: 'GET',
        },
        refreshAccessToken,
        logout,
      });
      if (!resp) return null;
      if (!resp.ok) return null;

      const blob = await resp.blob();
      const dataUrl = await new Promise<string | null>((resolve) => {
        const reader = new FileReader();
        reader.onerror = () => resolve(null);
        reader.onloadend = () => resolve((reader.result as string) || null);
        reader.readAsDataURL(blob);
      });
      return dataUrl;
    } catch (e) {
      console.error('Error loading acta image from server:', e);
      return null;
    }
  }, [refreshAccessToken, logout]);

  const preloadServerImagesForEdit = useCallback(async (record: ActaEntregaProducto) => {
    try {
      const isConnected = await getConnectionStatus();
      const actaId = typeof record.id === 'number' ? record.id : parseInt(String(record.id || ''), 10);
      if (!isConnected || !actaId) return;

      const imgs = Array.isArray(record.images) ? record.images : [];
      if (imgs.length === 0) return;

      const next: ActaImage[] = [];
      for (const img of imgs) {
        if (img.base64) {
          next.push(img);
          continue;
        }
        if (!img.name) {
          next.push(img);
          continue;
        }
        const dataUrl = await loadImageFromServer(actaId, img.name);
        if (dataUrl) next.push({ ...img, base64: dataUrl, extension: img.extension || 'jpg' });
        else next.push(img);
      }
      setImages(next);
    } catch (e) {
      console.error('Error preloading acta images:', e);
    }
  }, [loadImageFromServer]);

  const openCamera = async () => {
    try {
      // Evitar perder imágenes existentes si el registro ya está sincronizado y no hay conexión
      if (editingRecord?.id && !(await getConnectionStatus())) {
        Alert.alert('Sin conexión', 'Necesitas conexión para agregar fotos en un registro ya sincronizado.');
        return;
      }
      if (!permission?.granted) {
        const result = await requestPermission();
        if (!result.granted) {
          Alert.alert('Permiso denegado', 'Se necesita permiso para usar la cámara');
          return;
        }
      }
      setIsCameraVisible(true);
    } catch (e) {
      console.error('Error opening camera:', e);
      Alert.alert('Error', 'No se pudo abrir la cámara');
    }
  };

  const capturePhoto = async () => {
    if (!cameraRef.current) {
      Alert.alert('Error', 'La cámara no está lista');
      return;
    }
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.7,
        skipProcessing: false,
      });
      if (!photo?.base64) {
        Alert.alert('Error', 'No se pudo capturar la foto');
        setIsCameraVisible(false);
        return;
      }
      const base64Image = `data:image/jpeg;base64,${photo.base64}`;
      setIsCameraVisible(false);
      setTimeout(() => {
        setPhotosDirty(true);
        setImages((prev) => [...prev, { base64: base64Image, extension: 'jpg' }]);
      }, 100);
    } catch (e) {
      console.error('Error capturing photo:', e);
      Alert.alert('Error', 'No se pudo capturar la foto');
      setIsCameraVisible(false);
    }
  };

  const removeImage = (index: number) => {
    Alert.alert('Confirmar', '¿Eliminar esta foto?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          setPhotosDirty(true);
          setImages((prev) => prev.filter((_, i) => i !== index));
        },
      },
    ]);
  };

  const openSignatureModal = (target: 'entrega' | 'recibe') => {
    setSignatureTarget(target);
    setIsSignatureModalVisible(true);
    setSignatureKey((prev) => prev + 1);
  };

  const closeSignatureModal = () => setIsSignatureModalVisible(false);

  const clearSignatureInModal = () => {
    setSignatureKey((prev) => prev + 1);
    if (signatureRef.current) signatureRef.current.clearSignature();
  };

  const handleSignatureRead = (signature: string) => {
    if (!signature) {
      Alert.alert('Error', 'No se pudo obtener la firma');
      return;
    }
    const formatted = signature.startsWith('data:') ? signature : `data:image/png;base64,${signature}`;
    if (signatureTarget === 'entrega') setFirmaEntrega(formatted);
    else setFirmaRecibe(formatted);
    setIsSignatureModalVisible(false);
  };

  const acceptSignature = () => {
    if (signatureRef.current) signatureRef.current.readSignature();
    else Alert.alert('Error', 'Debe dibujar una firma antes de aceptar');
  };

  const buildDetalleJson = () => JSON.stringify(detalleItems.map((d) => ({
    descripcion: d.descripcion,
    unidad_medida: d.unidad_medida,
    cantidad: d.cantidad,
    devolucion: d.devolucion,
    faltantes: d.faltantes,
  })));

  const buildImagenesJson = () => JSON.stringify(images.map((img) => ({
    file_base64: img.base64 || '',
    extension: img.extension || 'jpg',
  })));

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
      const contratoIdRaw = current?.contrato?.id ?? current?.contrato_id;
      const corpoIdRaw = current?.corpo?.id ?? current?.corpo_id;
      const divId = getMarcaRoleDivisionId(current);
      setMarcaEmpresaId(empresaIdRaw ? Number(empresaIdRaw) : null);
      setMarcaClienteId(clienteIdRaw ? Number(clienteIdRaw) : null);
      setMarcaDivisionId(divId);
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
      if (!isConnected) return;
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) return;
      const response = await authedFetch({
        url: `${apiUrl}/api/main-structure`,
        init: {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        },
        refreshAccessToken,
        logout,
      });
      if (!response?.ok) return;
      const data = await response.json().catch(() => ({}));
      if (data.status && Array.isArray(data.structure)) {
        setStructure(data.structure);
        await AsyncStorage.setItem('main_structure_cache', JSON.stringify(data.structure));
        if (data.created_at != null && data.created_at !== undefined) {
          await AsyncStorage.setItem('main_structure_created_at', String(data.created_at));
        }
      }
    } catch (e) {
      console.error('ActaEntrega fetchMainStructure:', e);
    } finally {
      setIsStructureLoading(false);
    }
  }, [logout, refreshAccessToken]);

  const fetchRecords = useCallback(async () => {
    setIsLoadingData(true);
    setError(null);

    try {
      const currentMarcaStr = await AsyncStorage.getItem('current_marca');
      if (!currentMarcaStr) {
        setHasCurrentMarca(false);
        setRecords([]);
        setIsLoadingData(false);
        return;
      }
      const currentMarca = JSON.parse(currentMarcaStr);
      setHasCurrentMarca(true);

      // Obtener IDs de current_marca directamente sin usar estados
      const empresaIdRaw = currentMarca?.empresa?.id ?? currentMarca?.empresa_id;
      const clienteIdRaw = currentMarca?.cliente?.id ?? currentMarca?.cliente_id;
      const contratoIdRaw = currentMarca?.contrato?.id ?? currentMarca?.contrato_id;
      const corpoIdRaw = currentMarca?.corpo?.id ?? currentMarca?.corpo_id;

      let structureForDivision: MainStructureTree = [];
      try {
        const structStr = await AsyncStorage.getItem('main_structure_cache');
        const parsed = structStr ? JSON.parse(structStr) : [];
        if (Array.isArray(parsed)) structureForDivision = parsed;
      } catch {
        structureForDivision = [];
      }
      const divisionIdFromMarca = resolveMarcaDivisionIdForTree(currentMarca, structureForDivision);

      const empresaIdFromMarca = empresaIdRaw ? Number(empresaIdRaw) : null;
      const clienteIdFromMarca = clienteIdRaw ? Number(clienteIdRaw) : null;
      const contratoIdFromMarca = contratoIdRaw ? Number(contratoIdRaw) : null;
      const corpoIdFromMarca = corpoIdRaw ? Number(corpoIdRaw) : null;

      // Determinar si hay filtros explícitamente seleccionados
      const hasExplicitFilters = filterEmpresaId !== null || filterClienteId !== null || filterDivisionId !== null || filterContratoId !== null || filterCorpoId !== null;

      // Si hay filtros explícitos, usar SOLO esos (sin fallback a current_marca)
      // Si NO hay filtros explícitos, usar current_marca como valores iniciales
      const empresaId = hasExplicitFilters ? filterEmpresaId : (filterEmpresaId ?? empresaIdFromMarca);
      const clienteId = hasExplicitFilters ? filterClienteId : (filterClienteId ?? clienteIdFromMarca);
      const divisionId = hasExplicitFilters ? filterDivisionId : (filterDivisionId ?? divisionIdFromMarca);
      const contratoId = hasExplicitFilters ? filterContratoId : (filterContratoId ?? contratoIdFromMarca);
      const corpoId = hasExplicitFilters ? filterCorpoId : (filterCorpoId ?? corpoIdFromMarca);

      // Si no hay ningún filtro seleccionado, no hacer búsqueda
      if (!empresaId && !clienteId && !divisionId && !contratoId && !corpoId) {
        setRecords([]);
        setIsLoadingData(false);
        return;
      }

      const isConnected = await getConnectionStatus();

      // cache local (siempre)
      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
      const cache = cacheStr ? JSON.parse(cacheStr) : [];
      const localRecordsAll: ActaEntregaProducto[] = (cache || [])
        .filter((x: any) => x.type === 'acta_entrega_producto')
        .map((x: any) => x as ActaEntregaProducto);

      // Filtrar cache local aplicando TODOS los filtros seleccionados (no solo el más específico)
      let localRecords: ActaEntregaProducto[] = localRecordsAll;
      if (empresaId) {
        localRecords = localRecords.filter((r: any) => Number(r.empresa_id) === Number(empresaId));
      }
      if (clienteId) {
        localRecords = localRecords.filter((r: any) => Number(r.cliente_id) === Number(clienteId));
      }
      if (divisionId) {
        localRecords = localRecords.filter((r: any) => Number(r.division_id) === Number(divisionId));
      }
      if (contratoId) {
        localRecords = localRecords.filter((r: any) => Number(r.contrato_id) === Number(contratoId));
      }
      if (corpoId) {
        localRecords = localRecords.filter((r: any) => Number(r.corpo_id) === Number(corpoId));
      }

      const unsynced = localRecords.filter((r) => r.synced === false);

      if (!isConnected) {
        setRecords(localRecords);
        setIsLoadingData(false);
        return;
      }

      // Usar nueva función con filtros jerárquicos (solo enviar los que no son null)
      const res = await listActaEntregaProducto({
        empresa_id: empresaId ?? undefined,
        cliente_id: clienteId ?? undefined,
        division_id: divisionId ?? undefined,
        contrato_id: contratoId ?? undefined,
        corpo_id: corpoId ?? undefined,
        refreshAccessToken,
        logout,
      });
      if (!res.status) {
        setRecords(localRecords);
        setError(res.message || 'Error al obtener actas');
        setIsLoadingData(false);
        return;
      }

      const serverRecords: ActaEntregaProducto[] = Array.isArray(res.data) ? res.data : [];
      const scope: ActaEntregaFetchScope = {
        empresaId,
        clienteId,
        divisionId,
        contratoId,
        corpoId,
      };
      await mergeActaEntregaServerIntoEvaluationsCache(serverRecords, scope);

      // merge en pantalla: servidor + locales no sincronizados del alcance
      const unsyncedIds = new Set(unsynced.map((r) => String(r.id || r.id_local || '')));
      const filteredServer = serverRecords.filter((r) => !unsyncedIds.has(String(r.id || r.id_local || '')));
      setRecords([...unsynced, ...filteredServer]);
      setIsLoadingData(false);
    } catch (e) {
      console.error('Error fetching actas:', e);
      setError('Error al cargar actas');
      setIsLoadingData(false);
    }
  }, [logout, refreshAccessToken, filterEmpresaId, filterClienteId, filterDivisionId, filterContratoId, filterCorpoId]);

  const fetchRecordsRef = useRef(fetchRecords);
  useEffect(() => {
    fetchRecordsRef.current = fetchRecords;
  }, [fetchRecords]);

  // Nodos computados para filtros jerárquicos
  const filterEmpresas = useMemo(() => (Array.isArray(structure) ? structure : []), [structure]);

  const filterClientes = useMemo(() => {
    const empresa = filterEmpresas.find((e: any) => e.id === filterEmpresaId);
    return empresa?.clientes || [];
  }, [filterEmpresas, filterEmpresaId]);

  const filterDivisiones = useMemo(() => {
    if (!filterClienteId) return [];
    const cliente = filterClientes.find((c: any) => c.id === filterClienteId);
    return cliente?.division || [];
  }, [filterClientes, filterClienteId]);

  const filterContratos = useMemo(() => {
    if (!filterDivisionId) return [];
    const division = filterDivisiones.find((d: any) => d.id === filterDivisionId);
    return division?.contratos || [];
  }, [filterDivisiones, filterDivisionId]);

  const filterSucursales = useMemo(() => {
    if (!filterContratoId) return [];
    const division = filterDivisiones.find((d: any) => d.id === filterDivisionId);
    if (!division) return [];
    const contrato = division.contratos?.find((c: any) => c.id === filterContratoId);
    return contrato?.sucursales || [];
  }, [filterDivisiones, filterDivisionId, filterContratoId]);

  // Nodos computados para jerarquía del formulario
  const formEmpresas = useMemo(() => (Array.isArray(structure) ? structure : []), [structure]);

  const formClientes = useMemo(() => {
    const empresa = formEmpresas.find((e: any) => e.id === formEmpresaId);
    return empresa?.clientes || [];
  }, [formEmpresas, formEmpresaId]);

  const formDivisiones = useMemo(() => {
    if (!formClienteId) return [];
    const cliente = formClientes.find((c: any) => c.id === formClienteId);
    return cliente?.division || [];
  }, [formClientes, formClienteId]);

  const formContratos = useMemo(() => {
    if (!formDivisionId) return [];
    const division = formDivisiones.find((d: any) => d.id === formDivisionId);
    return division?.contratos || [];
  }, [formDivisiones, formDivisionId]);

  const formSucursales = useMemo(() => {
    if (!formContratoId) return [];
    const division = formDivisiones.find((d: any) => d.id === formDivisionId);
    if (!division) return [];
    const contrato = division.contratos?.find((c: any) => c.id === formContratoId);
    return contrato?.sucursales || [];
  }, [formDivisiones, formDivisionId, formContratoId]);

  // Precarga de filtros desde current_marca al entrar (una vez); ignorar nuevas referencias de `structure` tras limpiar filtros
  useEffect(() => {
    if (!structure?.length) return;
    if (userClearedHierarchyFiltersRef.current || filtersMarcaAppliedOnceRef.current) return;
    if (marcaEmpresaId == null && marcaClienteId == null) {
      filtersMarcaAppliedOnceRef.current = true;
      return;
    }

    const divisionResolved = resolveDivisionIdInStructure(structure, marcaEmpresaId, marcaClienteId, marcaDivisionId);

    if (marcaEmpresaId != null) setFilterEmpresaId(marcaEmpresaId);
    if (marcaClienteId != null) setFilterClienteId(marcaClienteId);
    if (divisionResolved != null) setFilterDivisionId(divisionResolved);
    if (marcaContratoId != null) setFilterContratoId(marcaContratoId);
    if (marcaCorpoId != null) setFilterCorpoId(marcaCorpoId);

    filtersMarcaAppliedOnceRef.current = true;
  }, [structure, marcaEmpresaId, marcaClienteId, marcaDivisionId, marcaContratoId, marcaCorpoId]);

  // Inicializar jerarquía del formulario con current_marca (división por nombre/id en árbol)
  useEffect(() => {
    if (!structure || structure.length === 0) return;
    if (!isCreating && !editingRecord) {
      const divisionResolved = resolveDivisionIdInStructure(structure, marcaEmpresaId, marcaClienteId, marcaDivisionId);
      if (marcaEmpresaId && formEmpresaId === null) setFormEmpresaId(marcaEmpresaId);
      if (marcaClienteId && formClienteId === null) setFormClienteId(marcaClienteId);
      if (divisionResolved != null && formDivisionId === null) setFormDivisionId(divisionResolved);
      if (marcaContratoId && formContratoId === null) setFormContratoId(marcaContratoId);
      if (marcaCorpoId && formCorpoId === null) setFormCorpoId(marcaCorpoId);
    }
  }, [structure, marcaEmpresaId, marcaClienteId, marcaDivisionId, marcaContratoId, marcaCorpoId, isCreating, editingRecord, formEmpresaId, formClienteId, formDivisionId, formContratoId, formCorpoId]);

  // Recargar listado solo cuando cambia la sucursal (corpo_id) seleccionada en el filtro
  useEffect(() => {
    if (!structure || structure.length === 0) return;
    if (filterCorpoId == null) return;
    fetchRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCorpoId, structure.length]);

  useFocusEffect(
    useCallback(() => {
      // No incluir fetchRecords en dependencias: al cambiar filtros se recrea y React Navigation
      // volvería a ejecutar este callback, reseteando los refs y precargando jerarquía otra vez.
      filtersMarcaAppliedOnceRef.current = false;
      userClearedHierarchyFiltersRef.current = false;
      let cancelled = false;
      (async () => {
        await loadMarcaContext();
        if (cancelled) return;
        await fetchMainStructure();
        if (cancelled) return;
        await fetchRecordsRef.current();
      })();
      const onConnectionRestored = () => {
        fetchRecordsRef.current();
      };
      eventBus.on('connectionRestored', onConnectionRestored);
      return () => {
        cancelled = true;
        eventBus.off('connectionRestored', onConnectionRestored);
      };
    }, [fetchMainStructure, loadMarcaContext])
  );

  const startCreating = async () => {
    const horaAccion = await getHoraAccionSafeMs();
    resetForm(horaAccion);
    setIsCreating(true);
    setEditingRecord(null);
  };

  const cancelCreating = async () => {
    const horaAccion = await getHoraAccionSafeMs();
    setIsCreating(false);
    resetForm(horaAccion);
  };

  const startEditing = async (record: ActaEntregaProducto) => {
    setIsCreating(false);
    setEditingRecord(record);
    const horaAccion = await getHoraAccionSafeMs();

    // Cargar IDs jerárquicos del registro
    setFormEmpresaId(record.empresa_id ? Number(record.empresa_id) : null);
    setFormClienteId(record.cliente_id ? Number(record.cliente_id) : null);
    setFormDivisionId(record.division_id ? Number(record.division_id) : null);
    setFormContratoId(record.contrato_id ? Number(record.contrato_id) : null);
    setFormCorpoId(record.corpo_id ? Number(record.corpo_id) : null);

    setFecha(parseDateInputToLocalDate(record.fecha, new Date(horaAccion)));
    setMensual(record.mensual || '');
    setObservaciones(record.observaciones || '');

    setNombreEntrega(record.nombre_entrega || '');
    setCedulaEntrega(record.cedula_entrega || '');
    setFechaEntrega(parseDateInputToLocalDate(record.fecha_entrega, new Date(horaAccion)));
    setFirmaEntrega(formatSignatureForDisplay(record.firma_entrega) || '');

    setNombreRecibe(record.nombre_recibe || '');
    setCedulaRecibe(record.cedula_recibe || '');
    setFechaRecibe(parseDateInputToLocalDate(record.fecha_recibe, new Date(horaAccion)));
    setFirmaRecibe(formatSignatureForDisplay(record.firma_recibe) || '');

    setFirmaResponsableHash(record.firma_responsable || '');

    // detalle JSON -> array
    try {
      const parsed = JSON.parse(record.detalle || '[]');
      const items: DetalleItem[] = Array.isArray(parsed)
        ? parsed.map((x: any) => ({
          id_local: generateRandomId(),
          descripcion: String(x.descripcion || ''),
          unidad_medida: String(x.unidad_medida || ''),
          cantidad: String(x.cantidad || ''),
          devolucion: String(x.devolucion || ''),
          faltantes: String(x.faltantes || ''),
        }))
        : [];
      setDetalleItems(items);
      setExpandedDetalleIds([]);
    } catch {
      setDetalleItems([]);
      setExpandedDetalleIds([]);
    }

    // imágenes (si es offline: base64; si es server: name)
    setImages(record.images || []);
    setPhotosDirty(false);
    preloadServerImagesForEdit(record);
  };

  const cancelEditing = async () => {
    setEditingRecord(null);
    const horaAccion = await getHoraAccionSafeMs();
    resetForm(horaAccion);
  };

  const validateForm = () => {
    if (!formEmpresaId) return 'Empresa es obligatoria';
    if (!formClienteId) return 'Cliente es obligatorio';
    if (!formDivisionId) return 'División es obligatoria';
    if (!formContratoId) return 'Contrato es obligatorio';
    if (!formCorpoId) return 'Sucursal es obligatoria';
    if (!mensual.trim()) return 'Mensual es obligatorio';
    if (!observaciones.trim()) return 'Observaciones es obligatorio';
    if (!nombreEntrega.trim()) return 'Nombre (entrega) es obligatorio';
    if (!cedulaEntrega.trim()) return 'Cédula (entrega) es obligatorio';
    if (!nombreRecibe.trim()) return 'Nombre (recibe) es obligatorio';
    if (!cedulaRecibe.trim()) return 'Cédula (recibe) es obligatorio';
    if (!firmaResponsableHash.trim()) return 'Firma del responsable es obligatoria (QR/Generar)';
    if (detalleItems.length === 0) return 'Debe agregar al menos un detalle';
    return null;
  };

  const saveHandler = async () => {
    const currentMarcaStr = await AsyncStorage.getItem('current_marca');
    if (!currentMarcaStr) return Alert.alert('Error', 'No se encontró la marca actual');
    const currentMarca = JSON.parse(currentMarcaStr);

    const validation = validateForm();
    if (validation) return Alert.alert('Error', validation);

    Alert.alert('Confirmar', '¿Deseas guardar el acta?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Aceptar',
        onPress: async () => {
          setIsSubmitting(true);
          setSubmitResponse(null);
          try {
            const requestData = {
              marca_id: currentMarca.id,
              empresa_id: formEmpresaId ?? undefined,
              cliente_id: formClienteId ?? undefined,
              division_id: formDivisionId ?? undefined,
              contrato_id: formContratoId ?? undefined,
              corpo_id: formCorpoId ?? undefined,
              tipo_entrega: TIPO_ENTREGA_DEFAULT,
              mensual: mensual.trim(),
              detalle: buildDetalleJson(),
              observaciones: observaciones.trim(),
              nombre_entrega: nombreEntrega.trim(),
              cedula_entrega: cedulaEntrega.trim(),
              fecha_entrega: dateOnlyToIsoString(fechaEntrega),
              firma_entrega: firmaEntrega,
              nombre_recibe: nombreRecibe.trim(),
              cedula_recibe: cedulaRecibe.trim(),
              fecha_recibe: dateOnlyToIsoString(fechaRecibe),
              firma_recibe: firmaRecibe,
              firma_responsable: firmaResponsableHash.trim(),
              imagenes: buildImagenesJson(),
            };

            const isConnected = await getConnectionStatus();
            if (isConnected) {
              const res = await createActaEntregaProducto({ requestData, refreshAccessToken, logout });
              if (res.status) {
                Alert.alert('Éxito', res.message || 'Acta creada correctamente');
                setTimeout(() => {
                  cancelCreating();
                  fetchRecords();
                }, 2000);
              } else {
                Alert.alert('Error', res.message || 'No se pudo crear el acta');
              }
              return;
            }

            // Offline
            const localId = generateRandomId();
            const actionsStr = await AsyncStorage.getItem('evaluations_actions');
            const actions = actionsStr ? JSON.parse(actionsStr) : [];
            actions.push({
              id: localId,
              action: 'create',
              type: 'acta_entrega_producto',
              payload: requestData,
              synced: false,
            });
            await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

            const cacheStr = await AsyncStorage.getItem('evaluations_cache');
            const cache = cacheStr ? JSON.parse(cacheStr) : [];
            const horaAccion = await getHoraAccionSafeMs();

            const newCacheRecord: ActaEntregaProducto = {
              id: '',
              id_local: localId,
              synced: false,
              fecha: epochMsToIsoSafe(horaAccion),
              empresa_id: requestData.empresa_id,
              cliente_id: requestData.cliente_id,
              division_id: requestData.division_id,
              contrato_id: requestData.contrato_id,
              corpo_id: requestData.corpo_id,
              tipo_entrega: requestData.tipo_entrega,
              mensual: requestData.mensual,
              detalle: requestData.detalle,
              observaciones: requestData.observaciones,
              nombre_entrega: requestData.nombre_entrega,
              cedula_entrega: requestData.cedula_entrega,
              fecha_entrega: requestData.fecha_entrega,
              firma_entrega: requestData.firma_entrega,
              nombre_recibe: requestData.nombre_recibe,
              cedula_recibe: requestData.cedula_recibe,
              fecha_recibe: requestData.fecha_recibe,
              firma_recibe: requestData.firma_recibe,
              firma_responsable: requestData.firma_responsable,
              images: images,
            };

            cache.push({ ...newCacheRecord, type: 'acta_entrega_producto' });
            await AsyncStorage.setItem('evaluations_cache', JSON.stringify(cache));

            Alert.alert('Éxito', 'Acta registrada localmente. Se sincronizará cuando haya conexión.');
            setTimeout(() => {
              cancelCreating();
              fetchRecords();
            }, 2000);
          } catch (e) {
            console.error('Error saving acta:', e);
            Alert.alert('Error', 'No se pudo guardar el acta');
          } finally {
            setIsSubmitting(false);
          }
        },
      },
    ]);
  };

  const updateHandler = async () => {
    if (!editingRecord) return;
    const recordId = editingRecord.id || editingRecord.id_local;
    if (!recordId) return Alert.alert('Error', 'ID de registro no encontrado');

    const validation = validateForm();
    if (validation) return Alert.alert('Error', validation);

    Alert.alert('Confirmar', '¿Deseas actualizar el acta?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Aceptar',
        onPress: async () => {
          setIsSubmitting(true);
          setSubmitResponse(null);
          try {
            const requestData = {
              empresa_id: formEmpresaId,
              cliente_id: formClienteId,
              division_id: formDivisionId,
              contrato_id: formContratoId,
              corpo_id: formCorpoId,
              tipo_entrega: TIPO_ENTREGA_DEFAULT,
              mensual: mensual.trim(),
              detalle: buildDetalleJson(),
              observaciones: observaciones.trim(),
              nombre_entrega: nombreEntrega.trim(),
              cedula_entrega: cedulaEntrega.trim(),
              fecha_entrega: dateOnlyToIsoString(fechaEntrega),
              firma_entrega: firmaEntrega,
              nombre_recibe: nombreRecibe.trim(),
              cedula_recibe: cedulaRecibe.trim(),
              fecha_recibe: dateOnlyToIsoString(fechaRecibe),
              firma_recibe: firmaRecibe,
              firma_responsable: firmaResponsableHash.trim(),
              ...(photosDirty ? { imagenes: buildImagenesJson() } : {}),
            };

            const isConnected = await getConnectionStatus();
            const isLocal = editingRecord.id_local && String(editingRecord.id_local).startsWith('local-');

            if (isConnected && !isLocal && editingRecord.id) {
              const res = await updateActaEntregaProducto({ id: editingRecord.id, requestData, refreshAccessToken, logout });
              if (res.status) {
                Alert.alert('Éxito', res.message || 'Acta actualizada correctamente');
                setTimeout(() => {
                  cancelEditing();
                  fetchRecords();
                }, 2000);
              } else {
                Alert.alert('Error', res.message || 'No se pudo actualizar');
              }
              return;
            }

            // Offline: actualizar cache + acción
            const actionsStr = await AsyncStorage.getItem('evaluations_actions');
            const actions = actionsStr ? JSON.parse(actionsStr) : [];

            if (isLocal) {
              // Borrador: fusionar en el "create" pendiente; no encolar "update" con id local.
              const lid = String(editingRecord.id_local);
              let next = actions.filter(
                (a: any) =>
                  !(
                    a.type === 'acta_entrega_producto' &&
                    a.action === 'update' &&
                    String(a.id) === lid
                  )
              );
              const idx = next.findIndex(
                (a: any) => a.id === editingRecord.id_local && a.action === 'create' && a.type === 'acta_entrega_producto'
              );
              if (idx !== -1) {
                next[idx] = { ...next[idx], payload: { ...next[idx].payload, ...requestData } };
              } else {
                next.push({
                  id: editingRecord.id_local,
                  action: 'create',
                  type: 'acta_entrega_producto',
                  payload: { ...requestData },
                  synced: false,
                });
              }
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(next));
            } else {
              const filtered = actions.filter((a: any) => !(a.id === editingRecord.id && a.action === 'update' && a.type === 'acta_entrega_producto'));
              filtered.push({ id: editingRecord.id, action: 'update', type: 'acta_entrega_producto', payload: requestData, synced: false });
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(filtered));
            }

            const cacheStr = await AsyncStorage.getItem('evaluations_cache');
            const cache = cacheStr ? JSON.parse(cacheStr) : [];
            const updatedCache = (cache || []).map((it: any) => {
              if (it.type === 'acta_entrega_producto' && (it.id_local === editingRecord.id_local || it.id === editingRecord.id)) {
                return {
                  ...it,
                  ...requestData,
                  synced: false,
                  images,
                };
              }
              return it;
            });
            await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));

            Alert.alert('Éxito', 'Cambios guardados localmente. Se sincronizarán al reconectar.');
            setTimeout(() => {
              cancelEditing();
              fetchRecords();
            }, 2000);
          } catch (e) {
            console.error('Error updating acta:', e);
            Alert.alert('Error', 'No se pudo actualizar el acta');
          } finally {
            setIsSubmitting(false);
          }
        },
      },
    ]);
  };

  const getRecordKey = (r: ActaEntregaProducto) => String(r.id ?? r.id_local ?? '');

  const deleteHandler = async (record: ActaEntregaProducto) => {
    const recordKey = getRecordKey(record);
    Alert.alert('Confirmar', '¿Deseas eliminar este acta?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          setDeletingRecordKey(recordKey);
          try {
            const isConnected = await getConnectionStatus();
            const isLocal = record.id_local && String(record.id_local).startsWith('local-');

            if (isConnected && !isLocal && record.id) {
              const res = await deleteActaEntregaProducto({ id: record.id, refreshAccessToken, logout });
              if (res.status) {
                Alert.alert('Éxito', 'Acta eliminada');
                fetchRecords();
              } else {
                Alert.alert('Error', res.message || 'No se pudo eliminar');
              }
              return;
            }

            const actionsStr = await AsyncStorage.getItem('evaluations_actions');
            const actions = actionsStr ? JSON.parse(actionsStr) : [];

            if (isLocal) {
              const lid = String(record.id_local);
              const updatedActions = actions.filter(
                (a: any) =>
                  !(
                    a.type === 'acta_entrega_producto' &&
                    (a.action === 'create' || a.action === 'update') &&
                    String(a.id) === lid
                  )
              );
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
            } else {
              const filtered = actions.filter((a: any) => !(a.id === record.id && a.action === 'delete' && a.type === 'acta_entrega_producto'));
              filtered.push({ id: record.id, action: 'delete', type: 'acta_entrega_producto', payload: {}, synced: false });
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(filtered));
            }

            const cacheStr = await AsyncStorage.getItem('evaluations_cache');
            const cache = cacheStr ? JSON.parse(cacheStr) : [];
            const updatedCache = (cache || []).filter((it: any) => {
              if (it.type !== 'acta_entrega_producto') return true;
              if (isLocal) return it.id_local !== record.id_local;
              return it.id !== record.id;
            });
            await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));

            setRecords((prev) => prev.filter((r) => (isLocal ? r.id_local !== record.id_local : r.id !== record.id)));
            Alert.alert('Modo Offline', 'Acta eliminada localmente. Se sincronizará al reconectar.');
            fetchRecords();
          } catch (e) {
            console.error('Error deleting acta:', e);
            Alert.alert('Error', 'No se pudo eliminar el acta');
          } finally {
            setDeletingRecordKey(null);
          }
        },
      },
    ]);
  };

  const toggleImagesExpand = (recordId: string) => {
    setExpandedImagesIds((prev) => (prev.includes(recordId) ? prev.filter((id) => id !== recordId) : [...prev, recordId]));
  };

  const toggleSignaturesExpand = (recordId: string) => {
    setExpandedSignaturesIds((prev) => (prev.includes(recordId) ? prev.filter((id) => id !== recordId) : [...prev, recordId]));
  };

  const renderSignaturesPreview = (record: ActaEntregaProducto) => {
    const firmaEntrega = record.firma_entrega || '';
    const firmaRecibe = record.firma_recibe || '';

    if (!firmaEntrega && !firmaRecibe) return null;

    const recordId = String(record.id || record.id_local || '');
    const expanded = expandedSignaturesIds.includes(recordId);

    return (
      <ThemedView style={styles.signaturesCollapsableCard}>
        <TouchableOpacity style={styles.signaturesCollapsableHeader} onPress={() => toggleSignaturesExpand(recordId)}>
          <ThemedText style={styles.signaturesCollapsableHeaderText}>
            Firmas
          </ThemedText>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color="#007AFF" />
        </TouchableOpacity>

        {expanded && (
          <ThemedView style={styles.signaturesCollapsableBody}>
            {firmaEntrega && (
              <ThemedView style={styles.signatureItem}>
                <ThemedText style={styles.signatureItemLabel}>Firma de entrega</ThemedText>
                <Image source={{ uri: formatSignatureForDisplay(firmaEntrega) }} style={styles.signaturePreviewImage} resizeMode="contain" />
              </ThemedView>
            )}
            {firmaRecibe && (
              <ThemedView style={styles.signatureItem}>
                <ThemedText style={styles.signatureItemLabel}>Firma de recibe</ThemedText>
                <Image source={{ uri: formatSignatureForDisplay(firmaRecibe) }} style={styles.signaturePreviewImage} resizeMode="contain" />
              </ThemedView>
            )}
          </ThemedView>
        )}
      </ThemedView>
    );
  };

  const renderImagesPreview = (record: ActaEntregaProducto) => {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    const idNum = typeof record.id === 'number' ? record.id : parseInt(String(record.id || ''), 10);
    const imgs = record.images || [];
    if (imgs.length === 0) return null;

    const recordId = String(record.id || record.id_local || '');
    const expanded = expandedImagesIds.includes(recordId);

    return (
      <ThemedView style={styles.imagesCollapsableCard}>
        <TouchableOpacity style={styles.imagesCollapsableHeader} onPress={() => toggleImagesExpand(recordId)}>
          <ThemedText style={styles.imagesCollapsableHeaderText}>
            Imágenes ({imgs.length})
          </ThemedText>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color="#007AFF" />
        </TouchableOpacity>

        {expanded && (
          <ThemedView style={styles.imagesCollapsableBody}>
            {imgs.map((img, idx) => {
              const uri = img.base64
                ? img.base64
                : (apiUrl && idNum && img.name)
                  ? appendTokenToUrl(`${apiUrl}/api/acta-entrega-productos/${idNum}/get-image/${encodeURIComponent(img.name)}`)
                  : '';
              if (!uri) return null;
              return (
                <Image key={`${img.name || 'local'}-${idx}`} source={{ uri }} style={styles.fullSizeImage} resizeMode="contain" />
              );
            })}
          </ThemedView>
        )}
      </ThemedView>
    );
  };

  const renderList = () => {
    if (isLoadingData) {
      return (
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Cargando actas...</ThemedText>
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

    if (records.length === 0) {
      return (
        <ThemedView style={styles.emptyContainer}>
          <ThemedText style={styles.emptyText}>No hay actas registradas.</ThemedText>
        </ThemedView>
      );
    }

    return (
      <ThemedView style={styles.listContainer}>
        {records.map((r) => (
          <ThemedView key={String(r.id || r.id_local)} style={styles.listItem}>
            <ThemedView style={styles.listItemHeader}>
              <ThemedView style={styles.listItemContent}>
                <ThemedText style={styles.listItemTitle}>{(r.nombre_entrega || '').trim() || 'Sin nombre entrega'}</ThemedText>
                <ThemedText style={styles.listItemSubtitle}>Mensual: {r.mensual || ''}</ThemedText>
                <ThemedText style={styles.listItemSubtitle}>
                  Fecha: {formatDateStringDMY(r.fecha || r.fecha_entrega)}
                </ThemedText>
                <ThemedText style={styles.listItemSubtitle}>
                  Cantidad de productos:{' '}
                  {(() => {
                    try {
                      return r.detalle ? JSON.parse(r.detalle).length : 0;
                    } catch {
                      return 0;
                    }
                  })()}
                </ThemedText>
              </ThemedView>
            </ThemedView>

            {renderImagesPreview(r)}

            {renderSignaturesPreview(r)}

            <ThemedView style={styles.listItemButtons}>
              <TouchableOpacity style={[styles.listItemButton, styles.editButton]} onPress={() => startEditing(r)}>
                <Ionicons name="pencil" size={18} color="#FFFFFF" />
              </TouchableOpacity>
              {!(r.id_local || String(r.id).startsWith('local-') || String(r.id) === '0') && (
                <TouchableOpacity
                  style={[styles.listItemButton, styles.changesButton]}
                  onPress={() => {
                    setCambiosTitle(`Cambios - Acta #${r.id}`);
                    fetchCambios('c_acta_entre_producto', Number(r.id));
                  }}
                >
                  <Ionicons name="list-outline" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.listItemButton, styles.deleteButton, deletingRecordKey !== null && styles.buttonDisabled]}
                onPress={() => deleteHandler(r)}
                disabled={deletingRecordKey !== null}
              >
                {deletingRecordKey === getRecordKey(r) ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="trash" size={18} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </ThemedView>
          </ThemedView>
        ))}
      </ThemedView>
    );
  };

  const renderDetalleSection = () => (
    <ThemedView style={styles.formGroup}>
      <ThemedView style={styles.sectionHeaderRow}>
        <ThemedText style={styles.sectionTitle}>Detalle *</ThemedText>
        <TouchableOpacity style={styles.smallAddButton} onPress={addDetalleItem}>
          <Ionicons name="add" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </ThemedView>

      {detalleItems.length === 0 ? (
        <ThemedText style={styles.helperText}>Agrega ítems al detalle.</ThemedText>
      ) : (
        detalleItems.map((it) => {
          const expanded = expandedDetalleIds.includes(it.id_local);
          return (
            <ThemedView key={it.id_local} style={styles.detailCard}>
              <TouchableOpacity style={styles.detailHeader} onPress={() => toggleDetalleExpand(it.id_local)}>
                <ThemedText style={styles.detailHeaderText}>{it.descripcion || 'Detalle'}</ThemedText>
                <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color="#007AFF" />
              </TouchableOpacity>

              {expanded && (
                <ThemedView style={styles.detailBody}>
                  <ThemedText style={styles.formLabel}>Descripción</ThemedText>
                  <TextInput style={styles.formInput} value={it.descripcion} onChangeText={(v) => updateDetalleItem(it.id_local, 'descripcion', v)} placeholder="Descripción" placeholderTextColor="#999" />

                  <ThemedText style={styles.formLabel}>Unidad de medida</ThemedText>
                  <TextInput style={styles.formInput} value={it.unidad_medida} onChangeText={(v) => updateDetalleItem(it.id_local, 'unidad_medida', v)} placeholder="Unidad de medida" placeholderTextColor="#999" />

                  <ThemedText style={styles.formLabel}>Cantidad</ThemedText>
                  <TextInput style={styles.formInput} value={it.cantidad} onChangeText={(v) => updateDetalleItem(it.id_local, 'cantidad', v)} placeholder="Cantidad" placeholderTextColor="#999" />

                  <ThemedText style={styles.formLabel}>Devolución</ThemedText>
                  <TextInput style={styles.formInput} value={it.devolucion} onChangeText={(v) => updateDetalleItem(it.id_local, 'devolucion', v)} placeholder="Devolución" placeholderTextColor="#999" />

                  <ThemedText style={styles.formLabel}>Faltantes</ThemedText>
                  <TextInput style={styles.formInput} value={it.faltantes} onChangeText={(v) => updateDetalleItem(it.id_local, 'faltantes', v)} placeholder="Faltantes" placeholderTextColor="#999" />

                  <TouchableOpacity style={styles.removeDetailButton} onPress={() => removeDetalleItem(it.id_local)}>
                    <Ionicons name="trash" size={16} color="#FFFFFF" />
                    <ThemedText style={styles.removeDetailButtonText}>Eliminar</ThemedText>
                  </TouchableOpacity>
                </ThemedView>
              )}
            </ThemedView>
          );
        })
      )}
    </ThemedView>
  );

  const renderPhotosSection = () => (
    <ThemedView style={styles.formGroup}>
      <ThemedText style={styles.formLabel}>Fotos (opcional):</ThemedText>
      <TouchableOpacity style={styles.captureImageButton} onPress={openCamera}>
        <Ionicons name="camera" size={20} color="#007AFF" />
        <ThemedText style={styles.captureImageButtonText}>
          {images.length > 0 ? 'Agregar otra foto' : 'Capturar foto'}
        </ThemedText>
      </TouchableOpacity>

      {images.length === 0 ? (
        <ThemedText style={styles.helperText}>Agrega una o varias fotos.</ThemedText>
      ) : (
        <ThemedView style={styles.thumbRow}>
          {images.map((img, idx) => {
            const uri = img.base64 || '';
            if (!uri) return null;
            return (
              <ThemedView key={`img-${idx}`} style={styles.thumbWrapper}>
                <Image source={{ uri }} style={styles.thumb} />
                <TouchableOpacity style={styles.thumbDelete} onPress={() => removeImage(idx)}>
                  <Ionicons name="close" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </ThemedView>
            );
          })}
        </ThemedView>
      )}
    </ThemedView>
  );

  return (
    <ThemedView style={styles.container}>
      <AppHeader onMenuPress={() => setIsMenuVisible(true)} title="Entrega de productos" />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <ThemedView style={styles.contentContainer}>
          <ThemedView style={styles.titleContainer}>
            <ThemedText style={styles.title}>
              <Ionicons name="clipboard" size={28} color="#000000" /> Entrega de productos
            </ThemedText>
            <ThemedText style={styles.subtitle}>Gestiona actas de entrega de productos</ThemedText>
          </ThemedView>

          {!hasCurrentMarca && (
            <ThemedView style={styles.noMarcaContainer}>
              <ThemedText style={styles.noMarcaTitle}>Marca no seleccionada</ThemedText>
              <ThemedText style={styles.noMarcaMessage}>
                No se encontró una marca seleccionada. Por favor, selecciona una marca desde el menú principal.
              </ThemedText>
            </ThemedView>
          )}

          {hasCurrentMarca && !isCreating && !editingRecord && (
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
                        <Picker.Item label="Seleccionar..." value="" color="#000000" />
                        {filterEmpresas.map((e: any) => (
                          <Picker.Item key={e.id} label={e.nombre} value={e.id} color="#000000" />
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
                          <Picker.Item label="Seleccionar..." value="" color="#000000" />
                          {filterClientes.map((c: any) => (
                            <Picker.Item key={c.id} label={c.nombre} value={c.id} color="#000000" />
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
                          <Picker.Item label="Seleccionar..." value="" color="#000000" />
                          {filterDivisiones.map((d: any) => (
                            <Picker.Item key={d.id} label={d.nombre} value={d.id} color="#000000" />
                          ))}
                        </Picker>
                      </View>
                    </ThemedView>
                  )}

                  {filterDivisionId && (
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
                          <Picker.Item label="Seleccionar..." value="" color="#000000" />
                          {filterContratos.map((c: any) => (
                            <Picker.Item key={c.id} label={c.nombre} value={c.id} color="#000000" />
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
                          <Picker.Item label="Seleccionar..." value="" color="#000000" />
                          {filterSucursales.map((s: any) => (
                            <Picker.Item key={s.id} label={s.nombre} value={s.id} color="#000000" />
                          ))}
                        </Picker>
                      </View>
                    </ThemedView>
                  )}

                  <TouchableOpacity
                    style={styles.resetFiltersButton}
                    onPress={() => {
                      userClearedHierarchyFiltersRef.current = true;
                      setFilterEmpresaId(null);
                      setFilterClienteId(null);
                      setFilterDivisionId(null);
                      setFilterContratoId(null);
                      setFilterCorpoId(null);
                      setTimeout(() => {
                        fetchRecords();
                      }, 0);
                    }}
                  >
                    <ThemedText style={styles.resetFiltersText}>Limpiar Filtros</ThemedText>
                  </TouchableOpacity>
                </ThemedView>
              )}
            </ThemedView>
          )}

          {isCreating || editingRecord ? (
            <ThemedView style={[styles.vehicleCard, styles.formCard]}>
              {/* Jerarquía del formulario */}
              <ThemedText style={styles.sectionTitle}>Jerarquía</ThemedText>

              {/* Empresa */}
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
                    <Picker.Item label="Seleccionar..." value="" color="#000000" />
                    {formEmpresas.map((e: any) => (
                      <Picker.Item key={e.id} label={e.nombre} value={e.id} color="#000000" />
                    ))}
                  </Picker>
                </View>
              </ThemedView>

              {/* Cliente */}
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
                      <Picker.Item label="Seleccionar..." value="" color="#000000" />
                      {formClientes.map((c: any) => (
                        <Picker.Item key={c.id} label={c.nombre} value={c.id} color="#000000" />
                      ))}
                    </Picker>
                  </View>
                </ThemedView>
              )}

              {/* División */}
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
                      <Picker.Item label="Seleccionar..." value="" color="#000000" />
                      {formDivisiones.map((d: any) => (
                        <Picker.Item key={d.id} label={d.nombre} value={d.id} color="#000000" />
                      ))}
                    </Picker>
                  </View>
                </ThemedView>
              )}

              {/* Contrato */}
              {formDivisionId && (
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
                      <Picker.Item label="Seleccionar..." value="" color="#000000" />
                      {formContratos.map((c: any) => (
                        <Picker.Item key={c.id} label={c.nombre} value={c.id} color="#000000" />
                      ))}
                    </Picker>
                  </View>
                </ThemedView>
              )}

              {/* Sucursal */}
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
                      <Picker.Item label="Seleccionar..." value="" color="#000000" />
                      {formSucursales.map((s: any) => (
                        <Picker.Item key={s.id} label={s.nombre} value={s.id} color="#000000" />
                      ))}
                    </Picker>
                  </View>
                </ThemedView>
              )}

              {/* Mensual */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Mensual *</ThemedText>
                <TextInput style={styles.formInput} value={mensual} onChangeText={setMensual} placeholder="Mensual" placeholderTextColor="#999" />
              </ThemedView>

              {renderDetalleSection()}

              {/* Observaciones */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Observaciones *</ThemedText>
                <TextInput
                  style={[styles.formInput, styles.textArea]}
                  value={observaciones}
                  onChangeText={setObservaciones}
                  placeholder="Observaciones"
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </ThemedView>

              {/* Entrega */}
              <ThemedText style={styles.sectionTitle}>Entrega</ThemedText>
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Nombre entrega *</ThemedText>
                <TextInput style={styles.formInput} value={nombreEntrega} onChangeText={setNombreEntrega} placeholder="Nombre" placeholderTextColor="#999" />
              </ThemedView>
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Cédula entrega *</ThemedText>
                <TextInput style={styles.formInput} value={cedulaEntrega} onChangeText={setCedulaEntrega} placeholder="Cédula" placeholderTextColor="#999" />
              </ThemedView>
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Fecha entrega *</ThemedText>
                <TouchableOpacity style={styles.dateButton} onPress={() => setShowFechaEntregaPicker(true)}>
                  <ThemedText style={styles.dateButtonText}>{formatDateOnlyLabel(fechaEntrega)}</ThemedText>
                  <Ionicons name="calendar" size={18} color="#007AFF" />
                </TouchableOpacity>
                {showFechaEntregaPicker && (
                  <DateTimePicker
                    value={Number.isNaN(fechaEntrega.getTime()) ? new Date() : fechaEntrega}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(_, d) => {
                      if (Platform.OS === 'android') setShowFechaEntregaPicker(false);
                      if (d) setFechaEntrega(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
                    }}
                  />
                )}
              </ThemedView>
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Firma entrega (Opcional)</ThemedText>
                {!firmaEntrega ? (
                  <TouchableOpacity style={styles.signatureDrawButton} onPress={() => openSignatureModal('entrega')}>
                    <Ionicons name="create-outline" size={22} color="#007AFF" />
                    <ThemedText style={styles.signatureDrawButtonText}>Toca para dibujar la firma</ThemedText>
                  </TouchableOpacity>
                ) : (
                  <ThemedView style={styles.signaturePreviewContainer}>
                    <Image source={{ uri: formatSignatureForDisplay(firmaEntrega) }} style={styles.signaturePreview} />
                    <TouchableOpacity style={styles.clearSignatureButton} onPress={() => setFirmaEntrega('')}>
                      <Ionicons name="trash" size={16} color="#FF3B30" />
                      <ThemedText style={styles.clearSignatureButtonText}>Eliminar</ThemedText>
                    </TouchableOpacity>
                  </ThemedView>
                )}
              </ThemedView>

              {/* Recibe */}
              <ThemedText style={styles.sectionTitle}>Recibe</ThemedText>
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Nombre recibe *</ThemedText>
                <TextInput style={styles.formInput} value={nombreRecibe} onChangeText={setNombreRecibe} placeholder="Nombre" placeholderTextColor="#999" />
              </ThemedView>
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Cédula recibe *</ThemedText>
                <TextInput style={styles.formInput} value={cedulaRecibe} onChangeText={setCedulaRecibe} placeholder="Cédula" placeholderTextColor="#999" />
              </ThemedView>
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Fecha recibe *</ThemedText>
                <TouchableOpacity style={styles.dateButton} onPress={() => setShowFechaRecibePicker(true)}>
                  <ThemedText style={styles.dateButtonText}>{formatDateOnlyLabel(fechaRecibe)}</ThemedText>
                  <Ionicons name="calendar" size={18} color="#007AFF" />
                </TouchableOpacity>
                {showFechaRecibePicker && (
                  <DateTimePicker
                    value={Number.isNaN(fechaRecibe.getTime()) ? new Date() : fechaRecibe}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(_, d) => {
                      if (Platform.OS === 'android') setShowFechaRecibePicker(false);
                      if (d) setFechaRecibe(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
                    }}
                  />
                )}
              </ThemedView>
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Firma recibe (Opcional)</ThemedText>
                {!firmaRecibe ? (
                  <TouchableOpacity style={styles.signatureDrawButton} onPress={() => openSignatureModal('recibe')}>
                    <Ionicons name="create-outline" size={22} color="#007AFF" />
                    <ThemedText style={styles.signatureDrawButtonText}>Toca para dibujar la firma</ThemedText>
                  </TouchableOpacity>
                ) : (
                  <ThemedView style={styles.signaturePreviewContainer}>
                    <Image source={{ uri: formatSignatureForDisplay(firmaRecibe) }} style={styles.signaturePreview} />
                    <TouchableOpacity style={styles.clearSignatureButton} onPress={() => setFirmaRecibe('')}>
                      <Ionicons name="trash" size={16} color="#FF3B30" />
                      <ThemedText style={styles.clearSignatureButtonText}>Eliminar</ThemedText>
                    </TouchableOpacity>
                  </ThemedView>
                )}
              </ThemedView>

              {/* Firma responsable (QR) */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Firma responsable (QR) *</ThemedText>
                {!firmaResponsableHash ? (
                  <ThemedView style={styles.signatureButtons}>
                    <TouchableOpacity
                      style={[styles.signatureButton, isGeneratingFirmaResponsable && styles.signatureButtonDisabled]}
                      onPress={handleGenerateFirmaResponsable}
                      disabled={isGeneratingFirmaResponsable}
                    >
                      {isGeneratingFirmaResponsable ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons name="finger-print" size={22} color="#FFFFFF" />
                          <ThemedText style={styles.signatureButtonText}>Generar</ThemedText>
                        </>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.signatureButton} onPress={handleScanFirmaResponsable}>
                      <Ionicons name="qr-code" size={18} color="#FFFFFF" />
                      <ThemedText style={styles.signatureButtonText}>Escanear QR</ThemedText>
                    </TouchableOpacity>
                  </ThemedView>
                ) : (
                  <ThemedView style={styles.signatureInfo}>
                    <ThemedView style={{ flex: 1, paddingRight: 10, backgroundColor: '#F9F9F9' }}>
                      <ThemedText style={styles.signatureInfoText}>Información de la firma:</ThemedText>
                      {(() => {
                        const info = decodeFirmaHash(firmaResponsableHash);
                        if (!info) {
                          return <ThemedText style={styles.signatureInfoValue}>Formato no decodificable</ThemedText>;
                        }
                        return (
                          <>
                            <ThemedText style={styles.signatureInfoValue}>Sesión: {info.sessionId || 'N/A'}</ThemedText>
                            <ThemedText style={styles.signatureInfoValue}>Empleado: {info.empleadoId || 'N/A'}</ThemedText>
                            <ThemedText style={styles.signatureInfoValue}>Lat: {info.latitud || 'N/A'} | Long: {info.longitud || 'N/A'}</ThemedText>
                            <ThemedText style={styles.signatureInfoValue}>Hora: {safeFirmaTimestampLabel(info.timestamp)}</ThemedText>
                          </>
                        );
                      })()}
                    </ThemedView>
                    <TouchableOpacity style={styles.clearSignatureButtonTiny} onPress={() => setFirmaResponsableHash('')}>
                      <Ionicons name="trash" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                  </ThemedView>
                )}
              </ThemedView>

              {renderPhotosSection()}

              {submitResponse && (
                <ThemedView style={[styles.responseContainer, submitResponse.type === 'success' ? styles.responseSuccess : styles.responseError]}>
                  <ThemedText style={styles.responseText}>
                    {submitResponse.type === 'success' ? '✓ ' : '✗ '}
                    {submitResponse.message}
                  </ThemedText>
                </ThemedView>
              )}
              <ThemedView style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.confirmButton, isSubmitting && styles.buttonDisabled]}
                  onPress={editingRecord ? updateHandler : saveHandler}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <ThemedText style={styles.confirmButtonText}>
                      <Ionicons name="checkmark" size={18} color="#FFFFFF" /> Aceptar
                    </ThemedText>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={editingRecord ? cancelEditing : cancelCreating}
                  disabled={isSubmitting}
                >
                  <ThemedText style={styles.cancelButtonText}>
                    <Ionicons name="close" size={18} color="#FFFFFF" />
                  </ThemedText>
                </TouchableOpacity>
              </ThemedView>
            </ThemedView>
          ) : (
            <ThemedView style={styles.listSection}>
              {!isLoadingData && !error && (
                <TouchableOpacity style={styles.createButton} onPress={startCreating}>
                  <ThemedText style={styles.createButtonText}>
                    <Ionicons name="add" size={20} color="#FFFFFF" />
                  </ThemedText>
                </TouchableOpacity>
              )}
              {renderList()}
            </ThemedView>
          )}
        </ThemedView>
      </ScrollView>

      {/* Camera Modal */}
      <Modal visible={isCameraVisible} animationType="slide" onRequestClose={() => setIsCameraVisible(false)}>
        <View style={styles.cameraContainer}>
          <CameraView ref={cameraRef} style={styles.camera} facing="back" />
          <View style={styles.cameraControls}>
            <TouchableOpacity style={styles.cameraCancelButton} onPress={() => setIsCameraVisible(false)}>
              <Ionicons name="close" size={30} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.cameraCaptureButton} onPress={capturePhoto}>
              <View style={styles.cameraCaptureButtonInner} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Signature Modal */}
      <Modal visible={isSignatureModalVisible} animationType="fade" transparent={true} onRequestClose={closeSignatureModal}>
        <ThemedView style={styles.modalOverlay}>
          <ThemedView style={styles.modalContainer}>
            <ThemedView style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>
                {signatureTarget === 'entrega' ? 'Firma de entrega' : 'Firma de recibe'}
              </ThemedText>
              <TouchableOpacity onPress={closeSignatureModal}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </ThemedView>

            <View style={styles.modalSignatureContainer}>
              <SignatureScreen
                ref={signatureRef}
                onOK={handleSignatureRead}
                descriptionText="Dibuja la firma en el área blanca"
                clearText=""
                confirmText=""
                webStyle={signatureWebStyle}
                key={signatureKey}
              />
            </View>

            <ThemedView style={styles.modalActions}>
              <TouchableOpacity style={styles.modalClearButton} onPress={clearSignatureInModal}>
                <Ionicons name="trash" size={20} color="#000000" />
                <ThemedText style={styles.modalClearButtonText}>Limpiar</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalAcceptButton} onPress={acceptSignature}>
                <Ionicons name="checkmark" size={20} color="#000000" />
                <ThemedText style={styles.modalAcceptButtonText}>Aceptar</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          </ThemedView>
        </ThemedView>
      </Modal>

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
                  const createdAtLabel = convertDateTimestampToLocalString(row?.created_at.toISOString());
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
                              {(Array.isArray(parsed) ? parsed : []).map((c: any, idx: number) => {
                                const prop = String(c?.prop ?? '-');
                                const value = c?.after;

                                // Caso especial: registro creado (__created__)
                                if (prop === '__created__' && value && typeof value === 'object') {
                                  const created: any = value;
                                  return (
                                    <React.Fragment key={`c-${row.id}-${idx}-created`}>
                                      <ThemedView style={styles.changeDescriptionContainer}>
                                        <ThemedText style={styles.changeDescription}>
                                          <ThemedText style={{ fontWeight: '800' }}>Registro creado</ThemedText>
                                        </ThemedText>
                                      </ThemedView>

                                      {/* Campos no relacionados con firmas */}
                                      {Object.entries(created).map(([k, v]) => {
                                        if (k === 'firma_entrega' || k === 'firma_recibe' || k === 'firma_responsable') return null;
                                        return (
                                          <ThemedView key={`c-${row.id}-${idx}-${k}`} style={styles.changeDescriptionContainer}>
                                            <ThemedText style={styles.changeDescription}>
                                              <ThemedText style={{ fontWeight: '800' }}>{k}: </ThemedText>
                                              {formatChangeValue(k, v)}
                                            </ThemedText>
                                          </ThemedView>
                                        );
                                      })}

                                      {typeof created.firma_responsable === 'string' && created.firma_responsable.trim() && (
                                        <ThemedView style={styles.changeDescriptionContainer}>
                                          <ThemedText style={styles.changeDescription}>
                                            <ThemedText style={{ fontWeight: '800' }}>firma_responsable: </ThemedText>
                                            {(() => {
                                              const info = decodeFirmaHash(created.firma_responsable);
                                              return info
                                                ? `Sesión: ${info.sessionId || 'N/A'} - Empleado: ${info.empleadoId || 'N/A'} - Hora: ${safeFirmaTimestampLabel(info.timestamp)}`
                                                : 'Firma responsable (formato no decodificable)';
                                            })()}
                                          </ThemedText>
                                        </ThemedView>
                                      )}

                                      {typeof created.firma_entrega === 'string' && created.firma_entrega.trim() && (
                                        <ThemedView style={styles.changeDescriptionContainer}>
                                          <ThemedText style={styles.changeDescription}>
                                            <ThemedText style={{ fontWeight: '800' }}>firma_entrega</ThemedText>
                                          </ThemedText>
                                          <Image
                                            source={{ uri: formatSignatureForDisplay(created.firma_entrega) }}
                                            style={styles.cambioSignatureImage}
                                            resizeMode="contain"
                                          />
                                        </ThemedView>
                                      )}

                                      {typeof created.firma_recibe === 'string' && created.firma_recibe.trim() && (
                                        <ThemedView style={styles.changeDescriptionContainer}>
                                          <ThemedText style={styles.changeDescription}>
                                            <ThemedText style={{ fontWeight: '800' }}>firma_recibe</ThemedText>
                                          </ThemedText>
                                          <Image
                                            source={{ uri: formatSignatureForDisplay(created.firma_recibe) }}
                                            style={styles.cambioSignatureImage}
                                            resizeMode="contain"
                                          />
                                        </ThemedView>
                                      )}
                                    </React.Fragment>
                                  );
                                }

                                const isManualSignatureField = prop === 'firma_entrega' || prop === 'firma_recibe';
                                const isResponsableSignatureField = prop === 'firma_responsable';

                                return (
                                  <ThemedView key={`c-${row.id}-${idx}`} style={styles.changeDescriptionContainer}>
                                    <ThemedText style={styles.changeDescription}>
                                      <ThemedText style={{ fontWeight: '800' }}>{prop}: </ThemedText>
                                      {!isManualSignatureField && !isResponsableSignatureField && formatChangeValue(prop, value)}
                                      {isResponsableSignatureField && (() => {
                                        const info = typeof value === 'string' ? decodeFirmaHash(value) : null;
                                        if (!info) return 'Firma responsable (formato no decodificable)';
                                        return `Sesión: ${info.sessionId || 'N/A'} - Empleado: ${info.empleadoId || 'N/A'} - Hora: ${safeFirmaTimestampLabel(info.timestamp)}`;
                                      })()}
                                    </ThemedText>

                                    {isManualSignatureField && typeof value === 'string' && value && (
                                      <Image
                                        source={{ uri: formatSignatureForDisplay(value) }}
                                        style={styles.cambioSignatureImage}
                                        resizeMode="contain"
                                      />
                                    )}
                                  </ThemedView>
                                );
                              })}
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
      <SlideMenu isVisible={isMenuVisible} onClose={() => setIsMenuVisible(false)} onHomePress={() => navigation.navigate('Home')} currentRoute="ActaEntregaProductos" />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { alignItems: 'center', padding: 20, backgroundColor: '#fff' },
  contentContainer: { width: '100%', maxWidth: 600 },

  titleContainer: {
    alignItems: 'center',
    marginBottom: 30,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    width: '100%',
  },
  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, opacity: 0.7, textAlign: 'center' },

  noMarcaContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: 20 },
  noMarcaTitle: { fontSize: 24, fontWeight: 'bold', color: '#FF9500', textAlign: 'center' },
  noMarcaMessage: { fontSize: 16, color: '#666', textAlign: 'center', lineHeight: 24 },

  listSection: { width: '100%' },
  createButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  createButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  listContainer: { width: '100%', gap: 16 },
  listItem: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#fff',
    padding: 16,
    gap: 8,
  },
  listItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  listItemContent: { flex: 1, paddingRight: 10 },
  listItemTitle: { fontSize: 20, fontWeight: 'bold', color: '#007AFF' },
  listItemSubtitle: { fontSize: 14, color: '#666', marginTop: 4 },
  offlineBadge: { backgroundColor: '#FF9500', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  offlineBadgeText: { color: '#FFF', fontWeight: '700', fontSize: 12 },
  listItemButtons: { flexDirection: 'row', gap: 12, marginTop: 8, backgroundColor: '#fff' },
  listItemButton: { flex: 1, padding: 12, borderRadius: 6, alignItems: 'center' },
  editButton: { backgroundColor: '#007AFF' },
  changesButton: { backgroundColor: '#5856D6', flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 8, gap: 8 },
  deleteButton: { backgroundColor: '#FF3B30' },
  listItemButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  thumbRow: { flexDirection: 'row', gap: 10, marginTop: 10, flexWrap: 'wrap' },
  thumbWrapper: { position: 'relative' },
  thumb: { width: 72, height: 72, borderRadius: 10, backgroundColor: '#EEE' },
  thumbDelete: { position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: '#FF3B30', alignItems: 'center', justifyContent: 'center' },

  imagesCollapsableCard: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
    overflow: 'hidden',
  },
  imagesCollapsableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F0F0F0',
  },
  imagesCollapsableHeaderText: { fontSize: 14, fontWeight: '600', color: '#007AFF', flex: 1, paddingRight: 8 },
  imagesCollapsableBody: { padding: 12, backgroundColor: '#F9F9F9', gap: 12 },
  fullSizeImage: { width: '100%', height: 300, borderRadius: 8, backgroundColor: '#EEE' },

  signaturesCollapsableCard: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
    overflow: 'hidden',
  },
  signaturesCollapsableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F0F0F0',
  },
  signaturesCollapsableHeaderText: { fontSize: 14, fontWeight: '600', color: '#007AFF', flex: 1, paddingRight: 8 },
  signaturesCollapsableBody: { padding: 12, backgroundColor: '#F9F9F9', gap: 16 },
  signatureItem: { gap: 8 },
  signatureItemLabel: { fontSize: 14, fontWeight: '600', color: '#333' },
  signaturePreviewImage: { width: '100%', height: 200, borderRadius: 8, backgroundColor: '#EEE' },

  vehicleCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#fff',
    padding: 16,
    gap: 8,
  },
  formCard: { marginBottom: 20 },
  formGroup: { marginBottom: 16, backgroundColor: '#fff' },
  formLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8, color: '#333' },
  formInput: {
    width: '100%',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: '#F9F9F9',
    color: '#000000',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
    overflow: 'hidden',
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F9F9F9',
  },
  picker: { width: '100%', height: 50 },
  textArea: { height: 100, textAlignVertical: 'top' },

  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, backgroundColor: '#fff' },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#007AFF' },
  smallAddButton: { backgroundColor: '#007AFF', width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  helperText: { color: '#666', fontSize: 13 },

  detailCard: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
    overflow: 'hidden',
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F0F0F0',
  },
  detailHeaderText: { fontSize: 14, fontWeight: '600', color: '#007AFF', flex: 1, paddingRight: 8 },
  detailBody: { padding: 12, backgroundColor: '#F9F9F9', gap: 10 },
  removeDetailButton: { backgroundColor: '#FF3B30', borderRadius: 6, padding: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 6 },
  removeDetailButtonText: { color: '#FFF', fontWeight: '800' },

  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
  },
  dateButtonText: { fontSize: 16, color: '#000000' },

  signatureDrawButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F0F0F0',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    marginTop: 8,
  },
  signatureDrawButtonText: { fontSize: 16, fontWeight: '600', color: '#333' },
  captureImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F0F0F0',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    marginTop: 8,
  },
  captureImageButtonText: { color: '#333', fontSize: 16, fontWeight: '600' },
  signaturePreviewContainer: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
    overflow: 'hidden',
  },
  signaturePreview: { width: '100%', height: 160, backgroundColor: '#F9F9F9' },
  clearSignatureButton: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8 },
  clearSignatureButtonText: { color: '#FF3B30', fontSize: 14, fontWeight: '600' },

  signatureButtons: { flexDirection: 'row', gap: 10 },
  signatureButton: { flex: 1, backgroundColor: '#007AFF', borderRadius: 6, padding: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  signatureButtonDisabled: { opacity: 0.6 },
  signatureButtonText: { color: '#FFF', fontWeight: '800' },
  signatureInfo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F9F9F9', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#E0E0E0' },
  signatureInfoText: { fontSize: 14, fontWeight: '600', color: '#007AFF' },
  signatureInfoValue: { fontSize: 13, color: '#666', marginTop: 4 },
  clearSignatureButtonTiny: { backgroundColor: '#FF3B30', width: 40, height: 40, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },

  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 8, backgroundColor: '#fff' },
  confirmButton: { flex: 1, backgroundColor: '#34C759', padding: 12, borderRadius: 6, alignItems: 'center' },
  confirmButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  cancelButton: { flex: 1, backgroundColor: '#8E8E93', padding: 12, borderRadius: 6, alignItems: 'center' },
  cancelButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
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

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 16, fontSize: 16, opacity: 0.7 },
  errorContainer: { padding: 40, alignItems: 'center' },
  errorText: { fontSize: 16, color: '#FF3B30', textAlign: 'center' },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 16, opacity: 0.5, textAlign: 'center' },

  cameraContainer: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  cameraControls: { position: 'absolute', bottom: 40, width: '100%', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 40, alignItems: 'center' },
  cameraCancelButton: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  cameraCaptureButton: { width: 70, height: 70, borderRadius: 35, borderWidth: 4, borderColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  cameraCaptureButtonInner: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#FFF' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  modalContainer: { backgroundColor: '#FFF', borderRadius: 12, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#111' },
  modalSignatureContainer: { height: 280, backgroundColor: '#FFF' },
  modalActions: { flexDirection: 'row', gap: 10, padding: 14, justifyContent: 'flex-end' },
  modalClearButton: { backgroundColor: '#F1F5F9', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', gap: 8, alignItems: 'center' },
  modalClearButtonText: { color: '#111', fontWeight: '800' },
  modalAcceptButton: { backgroundColor: '#D1FAE5', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', gap: 8, alignItems: 'center' },
  modalAcceptButtonText: { color: '#111', fontWeight: '800' },
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
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  floatModalCardMovimientos: { backgroundColor: '#FFFFFF', borderRadius: 12, width: '100%', maxWidth: 500, maxHeight: '80%', borderWidth: 1, borderColor: '#E0E0E0', overflow: 'hidden' },
  floatModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  cambioCollapsableMain: { width: '100%', marginBottom: 10, backgroundColor: '#fff', borderRadius: 6, borderWidth: 1, borderColor: '#E0E0E0', overflow: 'hidden' },
  cambioCollapsableHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#F8F9FA' },
  cambioCollapsableTitle: { fontSize: 14, fontWeight: '600', color: '#007AFF', flex: 1 },
  cambioCollapsableContent: { padding: 12, gap: 8, backgroundColor: '#F8F9FA' },
  changeDescriptionContainer: { marginBottom: 8 },
  changeDescription: { fontSize: 14, lineHeight: 20, color: '#666' },
  cambioSignatureImage: {
    marginTop: 6,
    height: 80,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  filterGroupSearch: { marginBottom: 12 },
});


