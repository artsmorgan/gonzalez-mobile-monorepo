import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
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
import getCurrentUserDigitalSignature from '@/hooks/getCurrentUserDigitalSignature';
import AppHeader from '@/components/AppHeader';
import CambiosAppsModulesModal, { type CambiosAppsModulesRow } from '@/components/CambiosAppsModulesModal';
import AppFooter from '@/components/AppFooter';
import SlideMenu from '@/components/SlideMenu';
import HierarchyPickerFields, { type HierarchyPickerValues } from '@/components/HierarchyPickerFields';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useAuth } from '@/contexts/AuthContext';
import { RootStackParamList } from '../App';
import { eventBus } from '@/hooks/eventBus';
import getHoraAccion from '@/hooks/getHoraAccion';
import { useQRScanner } from '@/hooks/useQRScanner';
import authedFetch from '@/hooks/authedFetch';
import getValidAccessTokenOrLogout from '@/hooks/getValidAccessTokenOrLogout';
import { loadMainStructureTreeMerged } from '@/hooks/bitacoraMainStructureCache';
import {
  mergeActaEntregaServerIntoCache,
  migrateActaEntregaFromEvaluationsCacheIfEmpty,
  normalizeActaEntregaImagesForCache,
  normalizeSyncedActaEntregaRecord,
  readActaEntregaProductosCache,
  upsertActaEntregaInCache,
  writeActaEntregaProductosCache,
  type ActaEntregaFetchScope,
} from '@/hooks/actaEntregaProductosCache';
import { convertDateTimestampToLocalString } from '@/hooks/convertDateTimestampToLocalString';
import {
  createActaEntregaProducto,
  deleteActaEntregaProducto,
  deleteActaEntregaProductoImage,
  listActaEntregaProducto,
  listActaEntregaProductoByCorpo,
  updateActaEntregaProducto,
} from '@/hooks/evaluationFunctions';
import { saveFile, getFile, deleteFile, getLocalFileDisplayUri } from '@/hooks/fileStorage';
import { stripActaEntregaImagesForActionPayload } from '@/hooks/actaEntregaProductosImagesSync';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'ActaEntregaProductos'>;

type MainStructurePuestoNode = { id: number; nombre: string };
type MainStructureSucursalNode = {
  id: number;
  nombre: string;
  nro_sucursal: string;
  puestos?: MainStructurePuestoNode[];
};
type MainStructureContratoNode = { id: number; nombre: string; sucursales: MainStructureSucursalNode[] };
type MainStructureDivisionNode = { id: number; nombre: string; contratos: MainStructureContratoNode[] };
type MainStructureClienteNode = { id: number; nombre: string; division: MainStructureDivisionNode[] };
type MainStructureEmpresaNode = { id: number; nombre: string; clientes: MainStructureClienteNode[] };
type MainStructureTree = MainStructureEmpresaNode[];

type RoleName = 'OPERATIVO' | string | null;

/** Busca empresa..sucursal en el árbol mergeado por corpo_id (sucursal). */
function findHierarchyByCorpoId(
  tree: MainStructureTree,
  corpoId: number | string | null | undefined,
): {
  empresaId: number;
  clienteId: number;
  divisionId: number;
  contratoId: number;
  corpoId: number;
} | null {
  if (corpoId == null || corpoId === '') return null;
  const target = Number(corpoId);
  if (!Number.isFinite(target) || target <= 0) return null;
  if (!Array.isArray(tree)) return null;
  for (const emp of tree) {
    const clientes = Array.isArray(emp.clientes) ? emp.clientes : [];
    for (const cli of clientes) {
      const divisions: any[] = Array.isArray(cli.division) ? cli.division : [];
      for (const div of divisions) {
        const contratos: any[] = Array.isArray(div.contratos) ? div.contratos : [];
        for (const con of contratos) {
          const sucursales: any[] = Array.isArray(con.sucursales) ? con.sucursales : [];
          for (const suc of sucursales) {
            if (Number(suc.id) === target) {
              return {
                empresaId: Number(emp.id),
                clienteId: Number(cli.id),
                divisionId: Number(div.id),
                contratoId: Number(con.id),
                corpoId: Number(suc.id),
              };
            }
          }
        }
      }
    }
  }
  return null;
}

/**
 * Si `roleDivision.division.id` no viene (p. ej. 0 en API), infiere división desde
 * empresa + cliente + contrato en el árbol mergeado (padre del contrato).
 */
function findDivisionIdForContratoInStructure(
  tree: MainStructureTree,
  empresaId: number | null,
  clienteId: number | null,
  contratoId: number | null,
): number | null {
  if (!contratoId || !Number.isFinite(Number(contratoId)) || Number(contratoId) <= 0) return null;
  if (!empresaId || !clienteId) return null;
  if (!Array.isArray(tree)) return null;
  const empresa = tree.find((e: any) => Number(e.id) === Number(empresaId));
  const cliente = empresa?.clientes?.find((c: any) => Number(c.id) === Number(clienteId));
  const divisions: any[] = Array.isArray(cliente?.division) ? cliente.division : [];
  for (const div of divisions) {
    const contratos: any[] = Array.isArray(div.contratos) ? div.contratos : [];
    if (contratos.some((ct: any) => Number(ct.id) === Number(contratoId))) {
      return Number(div.id);
    }
  }
  return null;
}

/**
 * División en `current_marca` (misma fuente que MarcarIngresoSalida `data.marca`):
 * - `roleDivision.division.id` / `role_division.division.id` (ids > 0; el API puede enviar 0 si falta empleado_plaza.division_id)
 * - `division_id` en raíz
 */
function getMarcaRoleDivisionId(current: any): number | null {
  if (!current || typeof current !== 'object') return null;
  const idRaw =
    current.roleDivision?.division?.id ??
    current.role_division?.division?.id ??
    current.division_id;
  if (idRaw == null || idRaw === '') return null;
  const n = Number(idRaw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
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
  id_local?: string; // local-* = borrador capturado en el dispositivo
  name?: string; // nombre en servidor (get-image)
  url?: string; // URL absoluta (misma forma que el GET de lista)
  base64?: string; // dataURL (legado / precarga)
  extension?: string;
  /** Nombre de archivo en el directorio de documentos (expo-file-system / `fileStorage`) */
  localFileName?: string;
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
  puesto_id?: number;
  isActive?: boolean;

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

/** Tiene id numérico de servidor (ya no es solo borrador offline). */
function hasActaEntregaServerId(r: Pick<ActaEntregaProducto, 'id'>): boolean {
  return actaEntregaNumericServerId(r) > 0;
}

/** Id entero del acta en servidor (0 si es solo borrador / inválido). */
function actaEntregaNumericServerId(r: Pick<ActaEntregaProducto, 'id'>): number {
  const id = r.id;
  if (id == null || id === '') return 0;
  const s = String(id).trim();
  if (!s || s.startsWith('local-')) return 0;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** Borrador solo en cola: local-* en id_local y sin id de servidor todavía. */
function isActaEntregaLocalDraftOnly(r: ActaEntregaProducto): boolean {
  if (!r.id_local || !String(r.id_local).startsWith('local-')) return false;
  return !hasActaEntregaServerId(r);
}

/** Adjunto solo en dispositivo: archivo local o captura sin fila en servidor (sin id+name). */
function actaImageIsOfflineDraftAttachment(img: ActaImage): boolean {
  const id = img?.id;
  const hasServerMeta =
    id != null &&
    Number.isFinite(Number(id)) &&
    Number(id) > 0 &&
    img.name != null &&
    String(img.name).trim() !== '';
  if (hasServerMeta) return false;
  if (img.localFileName != null && String(img.localFileName).trim() !== '') return true;
  const il = img.id_local != null ? String(img.id_local).trim() : '';
  return il.startsWith('local-');
}

function hasActaImageBase64(img: ActaImage): boolean {
  const b = img.base64;
  return typeof b === 'string' && b.trim().length > 0;
}

/**
 * URI para <Image />: base64 (borrador), o siempre get-image bajo API_SERVER (mismo host que el resto de la app).
 * No depender primero de `img.url` del servidor: suele traer origin equivocado (localhost/ngrok) y la petición no llega al API configurado en el cliente.
 */
function mimeFromExtension(ext: string): string {
  const e = String(ext || 'jpg').replace(/^\./, '').toLowerCase();
  return e === 'png' ? 'png' : 'jpeg';
}

function resolveActaImageUri(
  img: ActaImage,
  actaId: number,
  apiUrl: string | undefined,
  appendToken: (u: string) => string,
): string {
  if (hasActaImageBase64(img)) return img.base64!;
  if (img.localFileName != null && String(img.localFileName).trim() !== '') {
    const u = getLocalFileDisplayUri(String(img.localFileName));
    if (u) return u;
  }
  if (actaImageIsOfflineDraftAttachment(img) && !img.localFileName) return '';

  const base = apiUrl != null ? String(apiUrl).replace(/\/$/, '') : '';
  const name = img.name != null ? String(img.name).trim() : '';

  if (base && actaId > 0 && name) {
    return appendToken(
      `${base}/api/acta-entrega-productos/${actaId}/get-image/${encodeURIComponent(name)}?t=${Date.now()}`,
    );
  }

  const rawUrl = img.url != null ? String(img.url).trim() : '';
  if (rawUrl.startsWith('data:')) return rawUrl;
  const lower = rawUrl.toLowerCase();
  if (lower.startsWith('http://') || lower.startsWith('https://')) {
    const sep = rawUrl.includes('?') ? '&' : '?';
    return appendToken(`${rawUrl}${sep}t=${Date.now()}`);
  }
  if (rawUrl.startsWith('/') && base) {
    const sep = rawUrl.includes('?') ? '&' : '?';
    return appendToken(`${base}${rawUrl}${sep}t=${Date.now()}`);
  }

  return '';
}

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

  /**
   * Mismo criterio que JobManualsScreen: URLs para <Image /> llevan ?token= porque no envían Authorization.
   * Peticiones con fetch usan authedFetch (Bearer). Refresco de token vía getValidAccessTokenOrLogout al entrar en pantalla.
   */
  const [queryAccessToken, setQueryAccessToken] = useState<string>('');

  const refreshQueryAccessToken = useCallback(async () => {
    try {
      const t = await getValidAccessTokenOrLogout({ refreshAccessToken, logout });
      setQueryAccessToken(t != null && String(t).trim() !== '' ? String(t).trim() : '');
    } catch {
      setQueryAccessToken('');
    }
  }, [refreshAccessToken, logout]);

  useEffect(() => {
    refreshQueryAccessToken();
  }, [accessToken, refreshQueryAccessToken]);

  const appendTokenToUrl = useCallback((url: string) => {
    if (!url) return '';
    const fromContext = accessToken != null ? String(accessToken).trim() : '';
    const fromRefresh = queryAccessToken.trim();
    const token = fromContext || fromRefresh;
    if (!token) return url;
    if (/[?&]token=/.test(url)) return url;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}token=${encodeURIComponent(token)}`;
  }, [accessToken, queryAccessToken]);

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
  const [cambiosItems, setCambiosItems] = useState<CambiosAppsModulesRow[]>([]);

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
  const [marcaPuestoId, setMarcaPuestoId] = useState<number | null>(null);
  /** Nombre del rol en marca (`roleDivision.role.nombre`), p. ej. OPERATIVO */
  const [roleName, setRoleName] = useState<RoleName>(null);
  /** Precarga de filtros desde la marca una vez por visita (no se reaplica si cambia `structure`). */
  const filtersMarcaAppliedOnceRef = useRef(false);
  /** El usuario pulsó "Limpiar Filtros": no volver a precargar jerarquía hasta la próxima entrada a la pantalla. */
  const userClearedHierarchyFiltersRef = useRef(false);

  // Estructura jerárquica (árbol mergeado + fragmentos para selects como en PuestoUbicacion)
  const [structure, setStructure] = useState<MainStructureTree>([]);
  const [isStructureLoading, setIsStructureLoading] = useState(false);

  // Form - Jerarquía
  const [formEmpresaId, setFormEmpresaId] = useState<number | null>(null);
  const [formClienteId, setFormClienteId] = useState<number | null>(null);
  const [formDivisionId, setFormDivisionId] = useState<number | null>(null);
  const [formContratoId, setFormContratoId] = useState<number | null>(null);
  const [formCorpoId, setFormCorpoId] = useState<number | null>(null);
  const [formPuestoId, setFormPuestoId] = useState<number | null>(null);

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
  const [deletingImageKey, setDeletingImageKey] = useState<string | null>(null);

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
    //return false;
    const networkState = await Network.getNetworkStateAsync();

    return (
      networkState.isConnected === true &&
      networkState.isInternetReachable === true
    );
  };

  const closeCambiosModal = () => {
    setIsCambiosModalVisible(false);
    setCambiosItems([]);
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
    setFormPuestoId(null);
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

  const generateFirmaHashForCurrentUser = async (employee: any): Promise<string | null> => {
    try {
      if (!employee) return null;
      const hash = await getCurrentUserDigitalSignature(employee);
      return hash;
    } catch (e) {
      return null;
    }
  };

  const handleGenerateFirmaResponsable = async () => {
    try {
      setIsGeneratingFirmaResponsable(true);
      const hash = await generateFirmaHashForCurrentUser(employee);
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
          headers: {
            'Content-Type': 'application/json',
          },
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
  }, [appendTokenToUrl, refreshAccessToken, logout]);

  const preloadServerImagesForEdit = useCallback(async (record: ActaEntregaProducto) => {
    try {
      const isConnected = await getConnectionStatus();
      const actaId = actaEntregaNumericServerId(record);
      const imgs = (Array.isArray(record.images) ? record.images : []) as ActaImage[];
      if (imgs.length === 0) return;

      if (!isConnected || !actaId || Number.isNaN(actaId)) {
        setImages(imgs);
        return;
      }

      const next: ActaImage[] = [];
      for (const img of imgs) {
        if (hasActaImageBase64(img)) {
          next.push(img);
          continue;
        }
        if (img.localFileName && String(img.localFileName).trim() !== '') {
          next.push(img);
          continue;
        }
        if (actaImageIsOfflineDraftAttachment(img)) {
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
        quality: 0.7,
        skipProcessing: false,
      });
      if (!photo?.uri) {
        Alert.alert('Error', 'No se pudo capturar la foto');
        setIsCameraVisible(false);
        return;
      }
      const fileName = await saveFile({
        uri: photo.uri,
        originalName: 'photo',
        extension: 'jpg',
        type: 'image',
        prefix: 'acta_entrega',
      });
      setIsCameraVisible(false);
      setTimeout(() => {
        setPhotosDirty(true);
        setImages((prev) => [
          ...prev,
          { id_local: generateRandomId(), localFileName: fileName, extension: 'jpg' },
        ]);
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
        onPress: async () => {
          const target = images[index];
          if (target?.localFileName) {
            try {
              await deleteFile(target.localFileName);
            } catch {
              /* ya borrado o ausente */
            }
          }
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

  const deleteLocalImageFiles = async (list: ActaImage[]) => {
    for (const im of list) {
      if (!im?.localFileName) continue;
      try {
        await deleteFile(String(im.localFileName));
      } catch {
        /* idempotente */
      }
    }
  };

  const buildImagenesJsonAsync = useCallback(async (opts?: { actaId?: number | null }) => {
    const actaId =
      opts?.actaId != null && Number.isFinite(Number(opts.actaId)) && Number(opts.actaId) > 0
        ? Number(opts.actaId)
        : null;
    const out: { file_base64: string; extension: string; original_name?: string }[] = [];
    for (const img of images) {
      let file_base64 = '';
      if (img.localFileName != null && String(img.localFileName).trim() !== '') {
        try {
          const g = await getFile(String(img.localFileName));
          const ext = String(img.extension || 'jpg').replace(/^\./, '').trim() || 'jpg';
          file_base64 = `data:image/${mimeFromExtension(ext)};base64,${g.base64}`;
        } catch {
          file_base64 = '';
        }
      }
      if (!file_base64 && hasActaImageBase64(img)) {
        file_base64 = String(img.base64).trim();
      }
      if (!file_base64 && actaId && img.name && !actaImageIsOfflineDraftAttachment(img)) {
        const fetched = await loadImageFromServer(actaId, img.name);
        if (fetched) file_base64 = fetched.trim();
      }
      if (!file_base64) continue;
      const ext = String(img.extension || 'jpg').replace(/^\./, '').trim() || 'jpg';
      const row: { file_base64: string; extension: string; original_name?: string } = {
        file_base64,
        extension: ext,
      };
      if (img.name) row.original_name = img.name;
      out.push(row);
    }
    return JSON.stringify(out);
  }, [images, loadImageFromServer]);

  const loadMarcaContext = useCallback(async () => {
    try {
      const currentMarca = await AsyncStorage.getItem('current_marca');
      if (!currentMarca) {
        setHasCurrentMarca(false);
        setMarcaEmpresaId(null);
        setMarcaClienteId(null);
        setMarcaDivisionId(null);
        setMarcaContratoId(null);
        setMarcaCorpoId(null);
        setMarcaPuestoId(null);
        setRoleName(null);
        return null;
      }
      setHasCurrentMarca(true);
      const current = JSON.parse(currentMarca);
      const roleRaw =
        current?.roleDivision?.role?.nombre ?? current?.role_division?.role?.nombre ?? null;
      setRoleName(typeof roleRaw === 'string' ? roleRaw : null);
      const empresaIdRaw = current?.empresa?.id ?? current?.empresa_id;
      const clienteIdRaw = current?.cliente?.id ?? current?.cliente_id;
      const contratoIdRaw = current?.contrato?.id ?? current?.contrato_id;
      const corpoIdRaw = current?.corpo?.id ?? current?.corpo_id;
      const puestoIdRaw = current?.puesto?.id ?? current?.puesto_id;
      const empresaNum = empresaIdRaw != null && empresaIdRaw !== '' ? Number(empresaIdRaw) : null;
      const clienteNum = clienteIdRaw != null && clienteIdRaw !== '' ? Number(clienteIdRaw) : null;
      const contratoNum = contratoIdRaw != null && contratoIdRaw !== '' ? Number(contratoIdRaw) : null;

      let divId: number | null = getMarcaRoleDivisionId(current);
      if (divId == null && empresaNum && clienteNum && contratoNum) {
        try {
          const tree: MainStructureTree = (await loadMainStructureTreeMerged()) as MainStructureTree;
          if (tree.length > 0) {
            const derived = findDivisionIdForContratoInStructure(
              tree,
              Number.isFinite(Number(empresaNum)) ? empresaNum : null,
              Number.isFinite(Number(clienteNum)) ? clienteNum : null,
              Number.isFinite(Number(contratoNum)) ? contratoNum : null,
            );
            if (derived != null) divId = derived;
          }
        } catch {
          /* ignore */
        }
      }

      setMarcaEmpresaId(empresaNum);
      setMarcaClienteId(clienteNum);
      setMarcaDivisionId(divId);
      setMarcaContratoId(contratoNum);
      setMarcaCorpoId(corpoIdRaw != null && corpoIdRaw !== '' ? Number(corpoIdRaw) : null);
      setMarcaPuestoId(puestoIdRaw != null && puestoIdRaw !== '' ? Number(puestoIdRaw) : null);
      return current;
    } catch {
      setHasCurrentMarca(false);
      setMarcaEmpresaId(null);
      setMarcaClienteId(null);
      setMarcaDivisionId(null);
      setMarcaContratoId(null);
      setMarcaCorpoId(null);
      setMarcaPuestoId(null);
      setRoleName(null);
      return null;
    }
  }, []);

  /**
   * Mismo origen que PhysicalMinuteAgendaScreen: `loadMainStructureTreeMerged` (fragmentos +
   * fallback a caché legada si el merge queda vacío o es parcial).
   */
  const fetchMainStructure = useCallback(async () => {
    setIsStructureLoading(true);
    try {
      const mergedTree = await loadMainStructureTreeMerged();
      setStructure(Array.isArray(mergedTree) ? (mergedTree as MainStructureTree) : []);
    } catch (e) {
      console.error('ActaEntrega fetchMainStructure:', e);
      setStructure([]);
    } finally {
      setIsStructureLoading(false);
    }
  }, []);

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
        const t = await loadMainStructureTreeMerged();
        structureForDivision = Array.isArray(t) ? (t as MainStructureTree) : [];
      } catch {
        structureForDivision = [];
      }
      const divisionIdFromMarca = resolveMarcaDivisionIdForTree(currentMarca, structureForDivision);

      const empresaIdFromMarca = empresaIdRaw ? Number(empresaIdRaw) : null;
      const clienteIdFromMarca = clienteIdRaw ? Number(clienteIdRaw) : null;
      const contratoIdFromMarca = contratoIdRaw ? Number(contratoIdRaw) : null;
      const corpoIdFromMarca = corpoIdRaw ? Number(corpoIdRaw) : null;

      const isOp = roleName === 'OPERATIVO';
      /** Lista/API: OPERATIVO → sucursal de marca; no OPERATIVO → filtro o marca (si no se limpió). */
      let corpoIdForList: number | null = null;
      if (isOp) {
        corpoIdForList = corpoIdFromMarca;
      } else if (filterCorpoId != null) {
        corpoIdForList = filterCorpoId;
      } else if (!userClearedHierarchyFiltersRef.current) {
        corpoIdForList = corpoIdFromMarca;
      } else {
        corpoIdForList = null;
      }

      if (!corpoIdForList) {
        setRecords([]);
        setIsLoadingData(false);
        return;
      }

      const empresaId = isOp ? empresaIdFromMarca : (filterEmpresaId ?? empresaIdFromMarca);
      const clienteId = isOp ? clienteIdFromMarca : (filterClienteId ?? clienteIdFromMarca);
      const divisionId = isOp ? divisionIdFromMarca : (filterDivisionId ?? divisionIdFromMarca);
      const contratoId = isOp ? contratoIdFromMarca : (filterContratoId ?? contratoIdFromMarca);
      const corpoId = corpoIdForList;

      const isConnected = await getConnectionStatus();

      await migrateActaEntregaFromEvaluationsCacheIfEmpty();
      const cache = await readActaEntregaProductosCache();
      const localRecordsAll: ActaEntregaProducto[] = (cache || [])
        .filter((x: any) => x.type === 'acta_entrega_producto')
        .map((x: any) => x as ActaEntregaProducto);

      let localRecords: ActaEntregaProducto[] = localRecordsAll;
      localRecords = localRecords.filter((r: any) => Number(r.corpo_id) === Number(corpoIdForList));
      localRecords = localRecords.filter((r: any) => r?.isActive !== false);
      if (!isOp) {
        if (empresaId) localRecords = localRecords.filter((r: any) => Number(r.empresa_id) === Number(empresaId));
        if (clienteId) localRecords = localRecords.filter((r: any) => Number(r.cliente_id) === Number(clienteId));
        if (divisionId) localRecords = localRecords.filter((r: any) => Number(r.division_id) === Number(divisionId));
        if (contratoId) localRecords = localRecords.filter((r: any) => Number(r.contrato_id) === Number(contratoId));
      }

      const unsynced = localRecords.filter((r) => r.synced === false);

      if (!isConnected) {
        setRecords(localRecords);
        setIsLoadingData(false);
        return;
      }

      const res = await listActaEntregaProducto({
        corpo_id: corpoIdForList,
        empresa_id: empresaId ?? undefined,
        cliente_id: clienteId ?? undefined,
        contrato_id: contratoId ?? undefined,
        refreshAccessToken,
        logout,
      });
      if (!res.status) {
        setRecords(localRecords);
        setError(res.message || 'Error al obtener actas');
        setIsLoadingData(false);
        return;
      }

      const serverRecords: ActaEntregaProducto[] = (Array.isArray(res.data) ? res.data : []).filter((r: any) => r?.isActive !== false);
      const scope: ActaEntregaFetchScope = {
        empresaId,
        clienteId,
        divisionId,
        contratoId,
        corpoId,
      };
      await mergeActaEntregaServerIntoCache(serverRecords, scope);

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
  }, [logout, refreshAccessToken, filterEmpresaId, filterClienteId, filterDivisionId, filterContratoId, filterCorpoId, roleName]);

  const fetchRecordsRef = useRef(fetchRecords);
  useEffect(() => {
    fetchRecordsRef.current = fetchRecords;
  }, [fetchRecords]);

  useEffect(() => {
    fetchRecordsRef.current();
  }, [
    filterEmpresaId,
    filterClienteId,
    filterDivisionId,
    filterContratoId,
    filterCorpoId,
    roleName,
  ]);

  /**
   * Jerarquía desde el mismo árbol que `loadMainStructureTreeMerged` (pantalla Minuta física), encadenando nodos.
   */
  const filterEmpresas = useMemo(
    () => (Array.isArray(structure) ? structure : []),
    [structure],
  );

  const filterClientes = useMemo(() => {
    if (filterEmpresaId == null) return [];
    const empresa = filterEmpresas.find((e: any) => Number(e.id) === Number(filterEmpresaId));
    return Array.isArray(empresa?.clientes) ? empresa.clientes : [];
  }, [filterEmpresaId, filterEmpresas]);

  const filterDivisiones = useMemo(() => {
    if (filterEmpresaId == null || filterClienteId == null) return [];
    const empresa = filterEmpresas.find((e: any) => Number(e.id) === Number(filterEmpresaId));
    const cliente = empresa?.clientes?.find((c: any) => Number(c.id) === Number(filterClienteId));
    return Array.isArray(cliente?.division) ? cliente.division : [];
  }, [filterEmpresaId, filterClienteId, filterEmpresas]);

  const filterContratos = useMemo(() => {
    if (filterDivisionId == null) return [];
    const division = filterDivisiones.find((d: any) => Number(d.id) === Number(filterDivisionId));
    return Array.isArray(division?.contratos) ? division.contratos : [];
  }, [filterDivisionId, filterDivisiones]);

  const filterSucursales = useMemo(() => {
    if (filterContratoId == null) return [];
    const contrato = filterContratos.find((c: any) => Number(c.id) === Number(filterContratoId));
    return Array.isArray(contrato?.sucursales) ? contrato.sucursales : [];
  }, [filterContratoId, filterContratos]);

  const formEmpresas = useMemo(
    () => (Array.isArray(structure) ? structure : []),
    [structure],
  );

  const formClientes = useMemo(() => {
    if (formEmpresaId == null) return [];
    const empresa = formEmpresas.find((e: any) => Number(e.id) === Number(formEmpresaId));
    return Array.isArray(empresa?.clientes) ? empresa.clientes : [];
  }, [formEmpresaId, formEmpresas]);

  const formDivisiones = useMemo(() => {
    if (formEmpresaId == null || formClienteId == null) return [];
    const empresa = formEmpresas.find((e: any) => Number(e.id) === Number(formEmpresaId));
    const cliente = empresa?.clientes?.find((c: any) => Number(c.id) === Number(formClienteId));
    return Array.isArray(cliente?.division) ? cliente.division : [];
  }, [formEmpresaId, formClienteId, formEmpresas]);

  const formContratos = useMemo(() => {
    if (formDivisionId == null) return [];
    const division = formDivisiones.find((d: any) => Number(d.id) === Number(formDivisionId));
    return Array.isArray(division?.contratos) ? division.contratos : [];
  }, [formDivisionId, formDivisiones]);

  const formSucursales = useMemo(() => {
    if (formContratoId == null) return [];
    const contrato = formContratos.find((c: any) => Number(c.id) === Number(formContratoId));
    return Array.isArray(contrato?.sucursales) ? contrato.sucursales : [];
  }, [formContratoId, formContratos]);

  const formPuestos = useMemo(() => {
    if (formCorpoId == null) return [];
    const contrato = formContratos.find((c: any) => Number(c.id) === Number(formContratoId));
    const sucursal = (Array.isArray(contrato?.sucursales) ? contrato.sucursales : []).find(
      (s: any) => Number(s.id) === Number(formCorpoId),
    );
    return (Array.isArray(sucursal?.puestos) ? sucursal.puestos : []) as MainStructurePuestoNode[];
  }, [formCorpoId, formContratoId, formContratos]);

  /**
   * Tras cargar `structure`, completar división desde contrato de la marca si el API dejó
   * `roleDivision.division` en 0 o vacío (ver attendance/user: empleado_plaza.division_id).
   */
  useEffect(() => {
    if (!structure?.length) return;
    if (marcaDivisionId != null) return;
    if (marcaEmpresaId == null || marcaClienteId == null || marcaContratoId == null) return;
    const d = findDivisionIdForContratoInStructure(
      structure,
      marcaEmpresaId,
      marcaClienteId,
      marcaContratoId,
    );
    if (d != null) setMarcaDivisionId(d);
  }, [structure, marcaEmpresaId, marcaClienteId, marcaContratoId, marcaDivisionId]);

  /**
   * Si `marcaDivisionId` llegó tarde (p. ej. tras derivarla del árbol), aplicar al filtro cuando aún faltaba.
   * Evita que el efecto de precarga inicial salga con `filtersMarcaAppliedOnceRef` antes de tener división.
   */
  useEffect(() => {
    if (roleName === 'OPERATIVO') return;
    if (userClearedHierarchyFiltersRef.current) return;
    if (!structure?.length) return;
    if (marcaDivisionId == null) return;
    if (filterDivisionId != null) return;
    const dr = resolveDivisionIdInStructure(structure, marcaEmpresaId, marcaClienteId, marcaDivisionId);
    if (dr != null) setFilterDivisionId(dr);
  }, [structure, marcaEmpresaId, marcaClienteId, marcaDivisionId, filterDivisionId, roleName]);

  /**
   * Mismo caso que el filtro: al crear, `startCreating` puede ejecutarse antes de que exista
   * `marcaDivisionId` derivado del árbol; completar división (y ids previos si faltan) al resolver.
   */
  useEffect(() => {
    if (roleName === 'OPERATIVO') return;
    if (!isCreating || editingRecord) return;
    if (!structure?.length) return;
    if (marcaDivisionId == null) return;
    if (formDivisionId != null) return;
    const dr = resolveDivisionIdInStructure(structure, marcaEmpresaId, marcaClienteId, marcaDivisionId);
    if (dr != null) setFormDivisionId(dr);
    if (formEmpresaId == null && marcaEmpresaId != null) setFormEmpresaId(marcaEmpresaId);
    if (formClienteId == null && marcaClienteId != null) setFormClienteId(marcaClienteId);
    if (formContratoId == null && marcaContratoId != null) setFormContratoId(marcaContratoId);
    if (formCorpoId == null && marcaCorpoId != null) setFormCorpoId(marcaCorpoId);
    if (formPuestoId == null && marcaPuestoId != null) setFormPuestoId(marcaPuestoId);
  }, [
    isCreating,
    editingRecord,
    structure,
    marcaEmpresaId,
    marcaClienteId,
    marcaDivisionId,
    marcaContratoId,
    marcaCorpoId,
    formDivisionId,
    formEmpresaId,
    formClienteId,
    formContratoId,
    formCorpoId,
    formPuestoId,
    roleName,
    marcaPuestoId,
  ]);

  // Precarga de filtros desde current_marca al entrar (una vez); OPERATIVO no usa filtros visibles
  useEffect(() => {
    if (roleName === 'OPERATIVO') {
      filtersMarcaAppliedOnceRef.current = true;
      return;
    }
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
  }, [structure, marcaEmpresaId, marcaClienteId, marcaDivisionId, marcaContratoId, marcaCorpoId, roleName]);

  // Inicializar jerarquía del formulario con current_marca (solo usuarios no OPERATIVO; formulario listo antes de crear)
  useEffect(() => {
    if (roleName === 'OPERATIVO') return;
    if (!structure || structure.length === 0) return;
    if (!isCreating && !editingRecord) {
      const divisionResolved = resolveDivisionIdInStructure(structure, marcaEmpresaId, marcaClienteId, marcaDivisionId);
      if (marcaEmpresaId && formEmpresaId === null) setFormEmpresaId(marcaEmpresaId);
      if (marcaClienteId && formClienteId === null) setFormClienteId(marcaClienteId);
      if (divisionResolved != null && formDivisionId === null) setFormDivisionId(divisionResolved);
      if (marcaContratoId && formContratoId === null) setFormContratoId(marcaContratoId);
      if (marcaCorpoId && formCorpoId === null) setFormCorpoId(marcaCorpoId);
      if (marcaPuestoId && formPuestoId === null) setFormPuestoId(marcaPuestoId);
    }
  }, [structure, marcaEmpresaId, marcaClienteId, marcaDivisionId, marcaContratoId, marcaCorpoId, marcaPuestoId, isCreating, editingRecord, formEmpresaId, formClienteId, formDivisionId, formContratoId, formCorpoId, formPuestoId, roleName]);

  useFocusEffect(
    useCallback(() => {
      // No incluir fetchRecords en dependencias: al cambiar filtros se recrea y React Navigation
      // volvería a ejecutar este callback, reseteando los refs y precargando jerarquía otra vez.
      filtersMarcaAppliedOnceRef.current = false;
      userClearedHierarchyFiltersRef.current = false;
      let cancelled = false;
      (async () => {
        await refreshQueryAccessToken();
        if (cancelled) return;
        await loadMarcaContext();
        if (cancelled) return;
        await fetchMainStructure();
        if (cancelled) return;
      })();
      const onConnectionRestored = () => {
        fetchRecordsRef.current();
      };
      eventBus.on('connectionRestored', onConnectionRestored);
      return () => {
        cancelled = true;
        eventBus.off('connectionRestored', onConnectionRestored);
      };
    }, [fetchMainStructure, loadMarcaContext, refreshQueryAccessToken])
  );

  const startCreating = async () => {
    const horaAccion = await getHoraAccionSafeMs();
    resetForm(horaAccion);
    setIsCreating(true);
    setEditingRecord(null);
    if (roleName !== 'OPERATIVO' && structure.length > 0) {
      const divisionResolved = resolveDivisionIdInStructure(structure, marcaEmpresaId, marcaClienteId, marcaDivisionId);
      if (marcaEmpresaId != null) setFormEmpresaId(marcaEmpresaId);
      if (marcaClienteId != null) setFormClienteId(marcaClienteId);
      if (divisionResolved != null) setFormDivisionId(divisionResolved);
      if (marcaContratoId != null) setFormContratoId(marcaContratoId);
      if (marcaCorpoId != null) setFormCorpoId(marcaCorpoId);
      if (marcaPuestoId != null) setFormPuestoId(marcaPuestoId);
    }
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

    if (roleName !== 'OPERATIVO') {
      const resolved = findHierarchyByCorpoId(structure, record.corpo_id);
      if (resolved) {
        setFormEmpresaId(resolved.empresaId);
        setFormClienteId(resolved.clienteId);
        setFormDivisionId(resolved.divisionId);
        setFormContratoId(resolved.contratoId);
        setFormCorpoId(resolved.corpoId);
        setFormPuestoId(record.puesto_id ? Number(record.puesto_id) : null);
      } else {
        setFormEmpresaId(record.empresa_id ? Number(record.empresa_id) : null);
        setFormClienteId(record.cliente_id ? Number(record.cliente_id) : null);
        setFormDivisionId(record.division_id ? Number(record.division_id) : null);
        setFormContratoId(record.contrato_id ? Number(record.contrato_id) : null);
        setFormCorpoId(record.corpo_id ? Number(record.corpo_id) : null);
        setFormPuestoId(record.puesto_id ? Number(record.puesto_id) : null);
      }
    } else {
      setFormEmpresaId(null);
      setFormClienteId(null);
      setFormDivisionId(null);
      setFormContratoId(null);
      setFormCorpoId(null);
      setFormPuestoId(null);
    }

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

    // En edición solo se muestran fotos nuevas tomadas/subidas en esta sesión.
    setImages([]);
    setPhotosDirty(false);
  };

  const cancelEditing = async () => {
    setEditingRecord(null);
    const horaAccion = await getHoraAccionSafeMs();
    resetForm(horaAccion);
  };

  const validateForm = () => {
    const op = roleName === 'OPERATIVO';
    if (op) {
      if (!marcaEmpresaId) return 'Empresa es obligatoria (marca actual)';
      if (!marcaClienteId) return 'Cliente es obligatorio (marca actual)';
      if (!marcaDivisionId) return 'División es obligatoria (marca actual)';
      if (!marcaContratoId) return 'Contrato es obligatorio (marca actual)';
      if (!marcaCorpoId) return 'Sucursal es obligatoria (marca actual)';
      if (!marcaPuestoId) return 'Puesto es obligatorio (marca actual)';
    } else {
      if (!formEmpresaId) return 'Empresa es obligatoria';
      if (!formClienteId) return 'Cliente es obligatorio';
      if (!formDivisionId) return 'División es obligatoria';
      if (!formContratoId) return 'Contrato es obligatorio';
      if (!formCorpoId) return 'Sucursal es obligatoria';
      if (!formPuestoId) return 'Puesto es obligatorio';
    }
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
            const hierarchyRow =
              roleName === 'OPERATIVO'
                ? {
                    empresa_id: marcaEmpresaId ?? undefined,
                    cliente_id: marcaClienteId ?? undefined,
                    division_id: marcaDivisionId ?? undefined,
                    contrato_id: marcaContratoId ?? undefined,
                    corpo_id: marcaCorpoId ?? undefined,
                    puesto_id: marcaPuestoId ?? undefined,
                  }
                : {
                    empresa_id: formEmpresaId ?? undefined,
                    cliente_id: formClienteId ?? undefined,
                    division_id: formDivisionId ?? undefined,
                    contrato_id: formContratoId ?? undefined,
                    corpo_id: formCorpoId ?? undefined,
                    puesto_id: formPuestoId ?? undefined,
                  };
            const basePayload = {
              marca_id: currentMarca.id,
              ...hierarchyRow,
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
            };

            const isConnected = await getConnectionStatus();
            if (isConnected) {
              const imagenes = await buildImagenesJsonAsync({});
              const requestData = { ...basePayload, imagenes };
              const res = await createActaEntregaProducto({ requestData, refreshAccessToken, logout });
              if (res.status) {
                const d = res.data as any;
                if (d && typeof d === 'object' && d.id != null) {
                  await upsertActaEntregaInCache(
                    normalizeSyncedActaEntregaRecord({ ...d, type: 'acta_entrega_producto', synced: true }),
                  );
                }
                await deleteLocalImageFiles(images);
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

            // Offline — cola con rutas locales (sin base64 en AsyncStorage)
            const acta_entrega_images_meta = stripActaEntregaImagesForActionPayload(images);
            const offlinePayload = { ...basePayload, acta_entrega_images_meta };
            const localId = generateRandomId();
            const actionsStr = await AsyncStorage.getItem('evaluations_actions');
            const actions = actionsStr ? JSON.parse(actionsStr) : [];
            actions.push({
              id: localId,
              action: 'create',
              type: 'acta_entrega_producto',
              payload: offlinePayload,
              synced: false,
            });
            await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

            const cache = await readActaEntregaProductosCache();
            const horaAccion = await getHoraAccionSafeMs();

            const newCacheRecord: ActaEntregaProducto = {
              id: '',
              id_local: localId,
              synced: false,
              fecha: epochMsToIsoSafe(horaAccion),
              empresa_id: basePayload.empresa_id,
              cliente_id: basePayload.cliente_id,
              division_id: basePayload.division_id,
              contrato_id: basePayload.contrato_id,
              corpo_id: basePayload.corpo_id,
              puesto_id: basePayload.puesto_id,
              tipo_entrega: basePayload.tipo_entrega,
              mensual: basePayload.mensual,
              detalle: basePayload.detalle,
              observaciones: basePayload.observaciones,
              nombre_entrega: basePayload.nombre_entrega,
              cedula_entrega: basePayload.cedula_entrega,
              fecha_entrega: basePayload.fecha_entrega,
              firma_entrega: basePayload.firma_entrega,
              nombre_recibe: basePayload.nombre_recibe,
              cedula_recibe: basePayload.cedula_recibe,
              fecha_recibe: basePayload.fecha_recibe,
              firma_recibe: basePayload.firma_recibe,
              firma_responsable: basePayload.firma_responsable,
              images: images,
            };

            cache.push({ ...newCacheRecord, type: 'acta_entrega_producto' });
            await writeActaEntregaProductosCache(cache);

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
            const imagenesPayload = photosDirty ? await buildImagenesJsonAsync({}) : undefined;

            const hierarchyRowUpdate =
              roleName === 'OPERATIVO'
                ? {
                    empresa_id: marcaEmpresaId,
                    cliente_id: marcaClienteId,
                    division_id: marcaDivisionId,
                    contrato_id: marcaContratoId,
                    corpo_id: marcaCorpoId,
                    puesto_id: marcaPuestoId,
                  }
                : {
                    empresa_id: formEmpresaId,
                    cliente_id: formClienteId,
                    division_id: formDivisionId,
                    contrato_id: formContratoId,
                    corpo_id: formCorpoId,
                    puesto_id: formPuestoId,
                  };
            const baseRequestData = {
              ...hierarchyRowUpdate,
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
            };

            const requestData = {
              ...baseRequestData,
              ...(photosDirty && imagenesPayload !== undefined ? { imagenes: imagenesPayload } : {}),
            };

            const isConnected = await getConnectionStatus();
            const isLocalDraft = isActaEntregaLocalDraftOnly(editingRecord);
            const hasServerId = hasActaEntregaServerId(editingRecord);

            if (isConnected && hasServerId) {
              const idForApi = editingRecord.id;
              if (idForApi == null || idForApi === '') {
                Alert.alert('Error', 'ID de registro no encontrado');
                return;
              }
              const res = await updateActaEntregaProducto({ id: idForApi, requestData, refreshAccessToken, logout });
              if (res.status) {
                const d = res.data as any;
                if (d && typeof d === 'object') {
                  await upsertActaEntregaInCache(
                    normalizeSyncedActaEntregaRecord({
                      ...editingRecord,
                      ...d,
                      type: 'acta_entrega_producto',
                      synced: true,
                      images: d.images ?? images,
                    }),
                  );
                } else {
                  const mergedImages = [
                    ...((Array.isArray(editingRecord.images) ? editingRecord.images : []) as ActaImage[]),
                    ...(Array.isArray(images) ? images : []),
                  ];
                  await upsertActaEntregaInCache(
                    normalizeSyncedActaEntregaRecord({
                      ...editingRecord,
                      ...requestData,
                      id: editingRecord.id,
                      type: 'acta_entrega_producto',
                      synced: true,
                      images: mergedImages,
                    }),
                  );
                }
                if (photosDirty) {
                  await deleteLocalImageFiles(images);
                }
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

            // Borrador local: siempre incluir metadatos de archivos para sincronizar. Servidor: solo si hubo cambio de fotos.
            const metaForOfflineResolved =
              isLocalDraft
                ? stripActaEntregaImagesForActionPayload(images)
                : hasServerId && photosDirty
                  ? stripActaEntregaImagesForActionPayload(images)
                  : undefined;
            const offlinePayload =
              metaForOfflineResolved != null
                ? { ...baseRequestData, acta_entrega_images_meta: metaForOfflineResolved }
                : { ...baseRequestData };

            // Offline: actualizar cache + acción
            const actionsStr = await AsyncStorage.getItem('evaluations_actions');
            const actions = actionsStr ? JSON.parse(actionsStr) : [];

            if (isLocalDraft) {
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
                next[idx] = { ...next[idx], payload: { ...next[idx].payload, ...offlinePayload } };
              } else {
                next.push({
                  id: editingRecord.id_local,
                  action: 'create',
                  type: 'acta_entrega_producto',
                  payload: { ...offlinePayload },
                  synced: false,
                });
              }
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(next));
            } else if (hasServerId) {
              const idForQueue = editingRecord.id;
              if (idForQueue == null || idForQueue === '') {
                Alert.alert('Error', 'ID de registro no encontrado');
                return;
              }
              const filtered = actions.filter((a: any) => !(a.id === idForQueue && a.action === 'update' && a.type === 'acta_entrega_producto'));
              filtered.push({ id: idForQueue, action: 'update', type: 'acta_entrega_producto', payload: offlinePayload, synced: false });
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(filtered));
            } else {
              Alert.alert('Error', 'No se pudo determinar el estado del registro para guardar offline.');
              return;
            }

            const cache = await readActaEntregaProductosCache();
            const editingServerId =
              editingRecord?.id != null &&
              Number.isFinite(Number(editingRecord.id)) &&
              Number(editingRecord.id) > 0
                ? Number(editingRecord.id)
                : 0;
            const editingLocalIdRaw = editingRecord?.id_local != null ? String(editingRecord.id_local).trim() : '';
            const editingLocalId = editingLocalIdRaw && editingLocalIdRaw !== '' && editingLocalIdRaw !== '0' ? editingLocalIdRaw : '';
            const updatedCache = (cache || []).map((it: any) => {
              const same =
                it.type === 'acta_entrega_producto' &&
                (
                  (editingServerId > 0 && Number(it?.id) === editingServerId) ||
                  (editingServerId <= 0 && editingLocalId !== '' && String(it?.id_local ?? '').trim() === editingLocalId)
                );
              if (same) {
                const mergedImagesForCache =
                  editingServerId > 0
                    ? [
                        ...((Array.isArray(it?.images) ? it.images : []) as ActaImage[]),
                        ...(Array.isArray(images) ? images : []),
                      ]
                    : images;
                return {
                  ...it,
                  ...baseRequestData,
                  synced: false,
                  images: mergedImagesForCache,
                };
              }
              return it;
            });
            await writeActaEntregaProductosCache(updatedCache);

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
            const isLocalDraft = isActaEntregaLocalDraftOnly(record);
            const hasServerId = hasActaEntregaServerId(record);

            if (isConnected && hasServerId) {
              const idForApi = record.id;
              if (idForApi == null || idForApi === '') {
                Alert.alert('Error', 'ID de registro no encontrado');
                return;
              }
              const res = await deleteActaEntregaProducto({ id: idForApi, refreshAccessToken, logout });
              if (res.status) {
                const c = await readActaEntregaProductosCache();
                await writeActaEntregaProductosCache(
                  c.filter((it: any) => !(it.type === 'acta_entrega_producto' && Number(it.id) === Number(idForApi))),
                );
                Alert.alert('Éxito', 'Acta eliminada');
                fetchRecords();
              } else {
                Alert.alert('Error', res.message || 'No se pudo eliminar');
              }
              return;
            }

            const actionsStr = await AsyncStorage.getItem('evaluations_actions');
            const actions = actionsStr ? JSON.parse(actionsStr) : [];

            if (isLocalDraft) {
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
            } else if (hasServerId) {
              const filtered = actions.filter((a: any) => !(
                (a.id === record.id && a.action === 'delete' && a.type === 'acta_entrega_producto') ||
                (a.type === 'acta_entrega_producto' && a.action === 'delete_file' && String(a.id) === String(record.id))
              ));
              filtered.push({ id: record.id, action: 'delete', type: 'acta_entrega_producto', payload: {}, synced: false });
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(filtered));
            }

            await deleteLocalImageFiles((record.images || []) as ActaImage[]);

            const cache = await readActaEntregaProductosCache();
            const updatedCache = (cache || []).filter((it: any) => {
              if (it.type !== 'acta_entrega_producto') return true;
              if (isLocalDraft) return it.id_local !== record.id_local;
              if (hasServerId) return Number(it.id) !== Number(record.id);
              return true;
            });
            await writeActaEntregaProductosCache(updatedCache);

            setRecords((prev) =>
              prev.filter((r) =>
                isLocalDraft ? r.id_local !== record.id_local : hasServerId ? Number(r.id) !== Number(record.id) : true,
              ),
            );
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

  const deleteImageHandler = async (record: ActaEntregaProducto, image: ActaImage) => {
    const recordServerId = actaEntregaNumericServerId(record);
    const imageServerId = image?.id != null && Number.isFinite(Number(image.id)) ? Number(image.id) : 0;
    const imageKey = `${record.id || record.id_local}-${image.id || image.id_local || image.name || 'img'}`;
    Alert.alert('Confirmar', '¿Deseas eliminar este adjunto?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          setDeletingImageKey(imageKey);
          try {
            const isConnected = await getConnectionStatus();
            const isLocalDraft = isActaEntregaLocalDraftOnly(record);
            const nextImages = (record.images || []).filter((im: any) => {
              const byId = image?.id != null && im?.id != null && Number(im.id) === Number(image.id);
              const byLocal = image?.id_local && im?.id_local && String(im.id_local) === String(image.id_local);
              const byName = image?.name && im?.name && String(im.name) === String(image.name);
              return !(byId || byLocal || byName);
            });

            if (isLocalDraft) {
              const actionsStr = await AsyncStorage.getItem('evaluations_actions');
              const actions = actionsStr ? JSON.parse(actionsStr) : [];
              const lid = String(record.id_local);
              const idx = actions.findIndex((a: any) => a.type === 'acta_entrega_producto' && a.action === 'create' && String(a.id) === lid);
              if (idx >= 0) {
                const payload = actions[idx]?.payload || {};
                const meta = Array.isArray(payload.acta_entrega_images_meta) ? payload.acta_entrega_images_meta : [];
                const filteredMeta = meta.filter((m: any) => {
                  const byId = image?.id != null && m?.id != null && Number(m.id) === Number(image.id);
                  const byLocal = image?.id_local && m?.id_local && String(m.id_local) === String(image.id_local);
                  const byName = image?.name && m?.name && String(m.name) === String(image.name);
                  return !(byId || byLocal || byName);
                });
                actions[idx] = { ...actions[idx], payload: { ...payload, acta_entrega_images_meta: filteredMeta } };
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));
              }
              if (image.localFileName) await deleteFile(String(image.localFileName));
            } else if (recordServerId > 0 && imageServerId > 0 && isConnected) {
              const res = await deleteActaEntregaProductoImage({
                id: recordServerId,
                imageId: imageServerId,
                refreshAccessToken,
                logout,
              });
              if (!res.status) {
                Alert.alert('Error', res.message || 'No se pudo eliminar el adjunto');
                return;
              }
            } else if (recordServerId > 0 && imageServerId > 0) {
              const actionsStr = await AsyncStorage.getItem('evaluations_actions');
              const actions = actionsStr ? JSON.parse(actionsStr) : [];
              const filtered = actions.filter((a: any) => !(
                a.type === 'acta_entrega_producto' &&
                a.action === 'delete_file' &&
                String(a.id) === String(recordServerId) &&
                Number(a.payload?.imageId) === imageServerId
              ));
              filtered.push({
                id: recordServerId,
                action: 'delete_file',
                type: 'acta_entrega_producto',
                payload: { imageId: imageServerId },
                synced: false,
              });
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(filtered));
            } else if (image.localFileName) {
              await deleteFile(String(image.localFileName));
            }

            const cache = await readActaEntregaProductosCache();
            const updatedCache = (cache || []).map((it: any) => {
              const same = it.type === 'acta_entrega_producto' && (
                (recordServerId > 0 && Number(it.id) === recordServerId) ||
                (record.id_local && String(it.id_local) === String(record.id_local))
              );
              if (!same) return it;
              return { ...it, images: nextImages };
            });
            await writeActaEntregaProductosCache(updatedCache);
            setRecords((prev) => prev.map((it) => {
              const same = (recordServerId > 0 && Number(it.id) === recordServerId) || (record.id_local && String(it.id_local) === String(record.id_local));
              if (!same) return it;
              return { ...it, images: nextImages };
            }));
          } catch (e) {
            console.error('Error deleting acta image:', e);
            Alert.alert('Error', 'No se pudo eliminar el adjunto');
          } finally {
            setDeletingImageKey(null);
          }
        }
      }
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
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER as string | undefined;
    const imgs = (record.images || []) as ActaImage[];
    if (imgs.length === 0) return null;

    const recordId = String(record.id || record.id_local || '');
    const expanded = expandedImagesIds.includes(recordId);
    const actaIdSafe = actaEntregaNumericServerId(record);

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
              const uri = resolveActaImageUri(img, actaIdSafe, apiUrl, appendTokenToUrl);
              if (!uri) return null;
              const imageKey = `${record.id || record.id_local}-${img.id || img.id_local || img.name || idx}`;
              return (
                <View key={`${img.name || img.id_local || 'local'}-${idx}`} style={styles.imagePreviewCard}>
                  <TouchableOpacity
                    style={styles.deleteImageIconButton}
                    onPress={() => deleteImageHandler(record, img)}
                    disabled={deletingImageKey === imageKey}
                  >
                    <Ionicons name="trash" size={14} color="#fff" />
                  </TouchableOpacity>
                  <Image source={{ uri }} style={styles.fullSizeImage} resizeMode="contain" />
                </View>
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

  const renderPhotosSection = () => {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER as string | undefined;
    const actaIdSafe = editingRecord ? actaEntregaNumericServerId(editingRecord) : 0;

    return (
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
              const uri = resolveActaImageUri(img, actaIdSafe, apiUrl, appendTokenToUrl);
              if (!uri) return null;
              return (
                <ThemedView key={`img-${img.id_local || img.name || idx}`} style={styles.thumbWrapper}>
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
  };

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

          {roleName !== 'OPERATIVO' && !isCreating && !editingRecord && (
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
                  <HierarchyPickerFields
                    structure={structure ?? []}
                    levels={['cliente', 'contrato', 'sucursal']}
                    values={{
                      empresaId: filterEmpresaId,
                      clienteId: filterClienteId,
                      divisionId: filterDivisionId,
                      contratoId: filterContratoId,
                      sucursalId: filterCorpoId,
                    }}
                    onChange={(v: HierarchyPickerValues) => {
                      setFilterEmpresaId(v.empresaId);
                      setFilterClienteId(v.clienteId);
                      setFilterDivisionId(v.divisionId);
                      setFilterContratoId(v.contratoId);
                      setFilterCorpoId(v.sucursalId);
                    }}
                    renderLabel={(text) => <ThemedText style={styles.filterLabel}>{text}:</ThemedText>}
                    pickerWrapperStyle={styles.pickerWrapper}
                    pickerStyle={styles.picker}
                    fieldGroupStyle={styles.filterGroup}
                  />

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
              {roleName !== 'OPERATIVO' && (
                <>
                  <ThemedText style={styles.sectionTitle}>Jerarquía</ThemedText>
                  <HierarchyPickerFields
                    structure={structure ?? []}
                    levels={['cliente', 'contrato', 'sucursal', 'puesto']}
                    values={{
                      empresaId: formEmpresaId,
                      clienteId: formClienteId,
                      divisionId: formDivisionId,
                      contratoId: formContratoId,
                      sucursalId: formCorpoId,
                      puestoId: formPuestoId,
                    }}
                    onChange={(v: HierarchyPickerValues) => {
                      setFormEmpresaId(v.empresaId);
                      setFormClienteId(v.clienteId);
                      setFormDivisionId(v.divisionId);
                      setFormContratoId(v.contratoId);
                      setFormCorpoId(v.sucursalId);
                      setFormPuestoId(v.puestoId ?? null);
                    }}
                    renderLabel={(text) => <ThemedText style={styles.formLabel}>{text} *</ThemedText>}
                    pickerWrapperStyle={styles.pickerWrapper}
                    pickerStyle={styles.picker}
                    fieldGroupStyle={styles.formGroup}
                  />
                </>
              )}

              {roleName === 'OPERATIVO' && (
                <ThemedView style={styles.formGroup}>
                  <ThemedText style={styles.helperText}>
                    La jerarquía (empresa, cliente, sucursal, etc.) se toma de la marca actual de ingreso/salida.
                  </ThemedText>
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

      <CambiosAppsModulesModal
        visible={isCambiosModalVisible}
        title={cambiosTitle}
        items={cambiosItems}
        onClose={closeCambiosModal}
      />

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
  imagePreviewCard: { position: 'relative' },
  deleteImageIconButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
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


