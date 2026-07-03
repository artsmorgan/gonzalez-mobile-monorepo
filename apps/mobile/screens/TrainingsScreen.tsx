import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Platform,
  Modal,
  Linking,
  unstable_batchedUpdates,
  Dimensions,
  View,
} from 'react-native';
import DateTimePicker from "@react-native-community/datetimepicker";
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useAuth } from '@/contexts/AuthContext';
import AppHeader from '@/components/AppHeader';
import AppFooter from '@/components/AppFooter';
import SlideMenu from '@/components/SlideMenu';
import { useNavigation, useFocusEffect, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import { Picker } from '@react-native-picker/picker';
import { formatDateDMY } from '@/utils/formatDate';
import getCurrentUserDigitalSignature from '@/hooks/getCurrentUserDigitalSignature';
import { useQRScanner } from '@/hooks/useQRScanner';
import * as Network from 'expo-network';
import {
  createTraining as createTrainingAPI,
  deleteTraining as deleteTrainingAPI,
  updateTraining as updateTrainingAPI,
  deleteTrainingArchivo,
} from '@/hooks/trainingFunctions';
import { loadMainStructureTreeMerged } from '@/hooks/bitacoraMainStructureCache';
import * as DocumentPicker from 'expo-document-picker';
import { saveFile, deleteFile, getLocalFileDisplayUri, type StoredFileType } from '@/hooks/fileStorage';
import {
  buildTrainingFilesAndMetaFromFileMeta,
  trainingFilesMetaForQueue,
  type TrainingFileQueueMeta,
} from '@/hooks/trainingAttachmentsSync';
import getHoraAccion from '@/hooks/getHoraAccion';
import { eventBus } from '@/hooks/eventBus';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Image } from 'react-native';
import authedFetch from '@/hooks/authedFetch';
import getValidAccessTokenOrLogout from '@/hooks/getValidAccessTokenOrLogout';
import {
  getTrainingRecordCorpoId,
  mergeTrainingsCacheForCorpo,
} from '@/hooks/trainingsCacheHelpers';
import HierarchyPickerFields, { type HierarchyPickerValues } from '@/components/HierarchyPickerFields';
import EmployeeSearchModal from '@/components/EmployeeSearchModal';
import PuestoSearchModal from '@/components/PuestoSearchModal';
import type { EmployeeSearchHit } from '@/hooks/employeeSearch';
import type { PuestoSearchHit } from '@/hooks/puestoSearch';

type TrainingsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Trainings'>;
type TrainingsScreenRouteProp = RouteProp<RootStackParamList, 'Trainings'>;

interface Empresa {
  id: number;
  nombre: string;
}

interface Cliente {
  id: number;
  nombre: string;
}

interface Sucursal {
  id: number;
  nombre: string;
}

interface Puesto {
  id: number;
  nombre: string;
}

interface Empleado {
  id: number;
  nombre: string;
  cedula: string;
  fecha_contratacion: string;
}

interface EmpleadoList {
  nombre: string;
  cedula: string;
}

interface Responsable {
  nombre: string;
  cedula: string;
}

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
    cedula_empleado: string;
  };
}

/** Adjuntos desde API (mismo criterio que job-manuals: `url` listo para authedFetch). */
interface TrainingArchivo {
  id?: number;
  name: string;
  type?: string;
  extension?: string;
  original_name?: string;
  originalName?: string;
  url?: string;
}

interface Training {
  id: number;
  empresa: Empresa;
  cliente: Cliente;
  sucursal: Sucursal;
  /** Jerarquía guardada en el registro principal */
  division_id?: number;
  contrato_id?: number;
  puesto_id?: number;
  titulo: string;
  descripcion: string;
  tipo: string;
  resultado: string | null;
  observaciones: string;
  responsable: Responsable;
  firma_responsable: string;
  nombre_firma: string;
  fecha: string;
  base64_file: string;
  archivos?: TrainingArchivo[];
  isActive?: boolean;
  empleados: Array<{
    id: number;
    nombre: string;
    cedula: string;
  }>;
  puestos: Array<{
    id: number;
    nombre: string;
  }>;
  id_local: string;
  /** Sucursal explícita en caché / offline (p. ej. al filtrar contra el corpo del filtro) */
  corpo_id?: number;
  /** Solo offline: metadatos de archivos (documentos) sin base64 en JSON */
  offline_pending_files?: TrainingFileQueueMeta[];
}

function stripQueuedTrainingDeletesForTrainingId(actions: any[], trainingId: number): any[] {
  const id = Number(trainingId);
  if (!Number.isFinite(id)) return actions;
  return actions.filter(
    (a: any) => !(a?.type === 'delete' && Number(a.trainingId) === id)
  );
}

function appendOfflineTrainingDelete(
  actions: any[],
  params: { queueId: string; trainingId: number; marcaId: number }
): any[] {
  const next = stripQueuedTrainingDeletesForTrainingId(actions, params.trainingId);
  next.push({
    type: 'delete',
    id: params.queueId,
    trainingId: params.trainingId,
    marcaId: params.marcaId,
  });
  return next;
}

/** Clasificación por extensión para listas al estilo JobManuals (sin recursividad, solo dato + comparación). */
type TrainingPendingFileKind = 'image' | 'document' | 'audio' | 'video';

function trainingPendingFileIsKind(
  f: { extension?: string },
  kind: TrainingPendingFileKind
): boolean {
  const ext = (f.extension || '').toLowerCase();
  const isImg = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'].includes(ext);
  const isVid = ['mp4', 'mov', 'm4v', 'webm', 'mkv'].includes(ext);
  const isAud = ['mp3', 'm4a', 'aac', 'wav', 'ogg', 'flac', 'oga'].includes(ext);
  if (kind === 'image') return isImg;
  if (kind === 'video') return isVid;
  if (kind === 'audio') return isAud;
  if (kind === 'document') return !isImg && !isVid && !isAud;
  return false;
}

/** Clasificación de adjunto de capacitación para URL y UI (API puede omitir `type`). */
function getTrainingArchivoMediaKind(a: TrainingArchivo): 'image' | 'audio' | 'video' | 'document' {
  const t = (a.type || '').toLowerCase();
  if (t === 'image' || t === 'audio' || t === 'video') return t;
  const ext = (a.extension || '').toLowerCase();
  const rawName = String(a.original_name || a.originalName || a.name || '');
  const dot = rawName.lastIndexOf('.');
  const extFromName = dot >= 0 ? rawName.slice(dot + 1).toLowerCase() : '';
  const e = ext || extFromName;
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'].includes(e)) return 'image';
  if (['mp3', 'm4a', 'aac', 'wav', 'ogg', 'flac', 'oga'].includes(e)) return 'audio';
  if (['mp4', 'mov', 'm4v', 'webm', 'mkv'].includes(e)) return 'video';
  return 'document';
}

function tryExtractNameFromCapacitacionFileUrl(url: string): string {
  if (!url) return '';
  try {
    const m = String(url).match(/\/api\/training\/\d+\/get-(?:image|audio|video|file)\/([^?&]+)/);
    if (m) return decodeURIComponent(m[1]);
  } catch {
    // ignore
  }
  return '';
}

/** Nombre en storage (misma idea que `file.name` en Job Manuals: clave de get-* y DELETE). */
function getTrainingArchivoStorageName(a: TrainingArchivo): string {
  const n = String(a.name ?? '').trim();
  if (n) return n;
  return tryExtractNameFromCapacitacionFileUrl(String(a.url ?? ''));
}

function parseFirmaBase64ToFirmaData(firmaB64: string): FirmaData | null {
  if (!firmaB64 || firmaB64.trim() === '') return null;
  try {
    const decodedString = atob(firmaB64);
    const parts = decodedString.split(':');
    if (parts.length !== 5) return null;
    const [sessionId, empleadoId, latitud, longitud, timestamp] = parts;
    return { sessionId, empleadoId, latitud, longitud, timestamp };
  } catch {
    return null;
  }
}

interface DivisionNode {
  id: number;
  nombre: string;
  contratos?: ContratoNode[];
}
interface ContratoNode {
  id: number;
  nombre: string;
  sucursales?: SucursalNode[];
}
interface SucursalNode extends Sucursal {
  nro_sucursal?: string;
  /** Árbol main-structure: puesto → plazas → empleados */
  puestos?: Array<{
    id: number;
    nombre?: string;
    plazas?: Array<{
      id?: number;
      nombre?: string;
      empleados?: Array<{
        id?: number;
        nombre?: string;
        primer_apellido?: string;
        segundo_apellido?: string;
        cedula?: string;
        fecha_contratacion?: string | null;
      }>;
    }>;
  }>;
}
interface ClienteStructure {
  id: number;
  nombre: string;
  division?: DivisionNode[];
}
interface EmpresaStructure {
  id: number;
  nombre: string;
  codigo?: string;
  clientes?: ClienteStructure[];
}
type StructureTree = EmpresaStructure[];

type HierarchyPath = {
  empresaId: number | null;
  clienteId: number | null;
  divisionId: number | null;
  contratoId: number | null;
  sucursalId: number | null;
  puestoId: number | null;
};

const getMarcaDivisionIdFromCurrent = (current: any): number | null => {
  const raw =
    current?.roleDivision?.division?.id ??
    current?.role_division?.division?.id ??
    current?.division?.id ??
    current?.division_id;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const resolveDivisionIdInTree = (
  tree: StructureTree,
  empresaId: number | null,
  clienteId: number | null,
  divisionId: number | null
): number | null => {
  if (!Array.isArray(tree) || tree.length === 0 || divisionId == null) return divisionId;
  const empresa = tree.find((e) => Number(e?.id) === Number(empresaId));
  const clientes = Array.isArray(empresa?.clientes) ? empresa.clientes : [];
  const cliente = clientes.find((c) => Number(c?.id) === Number(clienteId));
  const divisiones = Array.isArray(cliente?.division) ? cliente.division : [];
  if (divisiones.some((d) => Number(d?.id) === Number(divisionId))) return divisionId;
  return null;
};

const findContratoIdForSucursalIn = (tree: StructureTree, sucursalId: number | null): number | null => {
  if (sucursalId == null) return null;
  for (const empresa of tree || []) {
    for (const cliente of empresa.clientes || []) {
      for (const division of cliente.division || []) {
        for (const contrato of division.contratos || []) {
          for (const sucursal of contrato.sucursales || []) {
            if (Number(sucursal.id) === Number(sucursalId)) {
              return contrato.id;
            }
          }
        }
      }
    }
  }
  return null;
};

/** Jerarquía desde `current_marca` almacenada como en MarcarIngresoSalidaScreen (empresa, cliente, contrato, corpo, roleDivision.division, puesto). */
const buildHierarchyFromCurrentMarca = (current: any, tree: StructureTree): HierarchyPath => {
  const empresaId = current?.empresa?.id != null ? Number(current.empresa.id) : null;
  const clienteId = current?.cliente?.id != null ? Number(current.cliente.id) : null;
  const divisionIdRaw = getMarcaDivisionIdFromCurrent(current);
  const divisionId = resolveDivisionIdInTree(tree, empresaId, clienteId, divisionIdRaw);
  const corpoId = current?.corpo?.id != null ? Number(current.corpo.id) : null;
  let contratoId = current?.contrato?.id != null ? Number(current.contrato.id) : null;
  if (contratoId == null && corpoId != null) {
    contratoId = findContratoIdForSucursalIn(tree, corpoId);
  }
  const puestoId = current?.puesto?.id != null ? Number(current.puesto.id) : null;
  return {
    empresaId,
    clienteId,
    divisionId,
    contratoId,
    sucursalId: corpoId,
    puestoId,
  };
};

/** Al usar caché: filtra por el corpo seleccionado en el filtro (usa `corpo_id` si existe, si no `sucursal.id`). */
function filterCachedTrainingsForSelectedCorpo(
  list: Training[],
  selectedCorpoId: number,
  matchCacheToFilterCorpo: boolean
): Training[] {
  if (!matchCacheToFilterCorpo) {
    return list.filter((t) => t.sucursal?.id === selectedCorpoId);
  }
  return list.filter((t) => getTrainingRecordCorpoId(t) === selectedCorpoId);
}

export default function TrainingsScreen() {
  const route = useRoute<TrainingsScreenRouteProp>();
  const matchCacheToFilterCorpo = route.params?.matchCacheToFilterCorpo ?? true;

  const { employee, refreshAccessToken, logout, accessToken } = useAuth();
  const appendTokenToUrl = (url: string) => {
    if (!url) return '';
    if (!accessToken || accessToken.trim().length === 0) return url;
    if (/[?&]token=/.test(url)) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}token=${encodeURIComponent(accessToken)}`;
  };
  // URLs de adjuntos: mismo criterio que JobManualsScreen (getManual*Url + buildFileUrl)
  const getTrainingImageUrl = (trainingId: number, fileName: string) => {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) return '';
    return appendTokenToUrl(
      `${apiUrl}/api/training/${trainingId}/get-image/${encodeURIComponent(fileName)}`
    );
  };
  const getTrainingAudioUrl = (trainingId: number, fileName: string) => {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) return '';
    return appendTokenToUrl(
      `${apiUrl}/api/training/${trainingId}/get-audio/${encodeURIComponent(fileName)}`
    );
  };
  const getTrainingVideoUrl = (trainingId: number, fileName: string) => {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) return '';
    return appendTokenToUrl(
      `${apiUrl}/api/training/${trainingId}/get-video/${encodeURIComponent(fileName)}`
    );
  };
  const buildTrainingArchivoUrl = (trainingId: number, a: TrainingArchivo): string => {
    const fileName = getTrainingArchivoStorageName(a);
    if (trainingId > 0 && fileName) {
      const t = (a.type || '').toLowerCase();
      if (t === 'image') return getTrainingImageUrl(trainingId, fileName);
      if (t === 'audio') return getTrainingAudioUrl(trainingId, fileName);
      if (t === 'video') return getTrainingVideoUrl(trainingId, fileName);
      const kind = getTrainingArchivoMediaKind(a);
      if (kind === 'image') return getTrainingImageUrl(trainingId, fileName);
      if (kind === 'audio') return getTrainingAudioUrl(trainingId, fileName);
      if (kind === 'video') return getTrainingVideoUrl(trainingId, fileName);
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (apiUrl) {
        return appendTokenToUrl(
          `${apiUrl}/api/training/${trainingId}/get-file/${encodeURIComponent(fileName)}`
        );
      }
    }
    if (a.url && String(a.url).trim() !== '') return appendTokenToUrl(a.url);
    return '';
  };
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<TrainingsScreenNavigationProp>();

  // Data states
  const [trainings, setTrainings] = useState<Training[]>([]);
  /** Carga inicial: verificar marca y estructura */
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  /** Carga de listado desde API (no oculta filtros) */
  const [isListLoading, setIsListLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Importante: "sin internet" NO cuenta como error (solo es un estado informativo)
  const [offlineMessage, setOfflineMessage] = useState<string | null>(null);
  const [marcaId, setMarcaId] = useState<number | null>(null);
  const [corpoId, setCorpoId] = useState<number | null>(null);
  const [roleName, setRoleName] = useState<string | null>(null);
  const [structure, setStructure] = useState<EmpresaStructure[]>([]);

  // Form states
  const [isCreating, setIsCreating] = useState(false);
  const [isCreateSubmitting, setIsCreateSubmitting] = useState(false);
  const [formKey, setFormKey] = useState(0); // Key para forzar re-render de inputs
  const [fechaCapacitacion, setFechaCapacitacion] = useState('');
  const [showFechaCapacitacionPicker, setShowFechaCapacitacionPicker] = useState(false);
  const [firmaResponsable, setFirmaResponsable] = useState<FirmaData | null>(null);
  const [isGeneratingFirma, setIsGeneratingFirma] = useState(false);
  const [selectedTipo, setSelectedTipo] = useState<'Presencial' | 'Virtual'>('Presencial');
  const [selectedEmpleados, setSelectedEmpleados] = useState<Empleado[]>([]);
  const [selectedPuestos, setSelectedPuestos] = useState<Puesto[]>([]);
  const [employeeSearchModalVisible, setEmployeeSearchModalVisible] = useState(false);
  const [puestoSearchModalVisible, setPuestoSearchModalVisible] = useState(false);
  /** Nuevos archivos: persistidos con `fileStorage` (mismo criterio que acta-entrega). */
  const [pendingTrainingFiles, setPendingTrainingFiles] = useState<TrainingFileQueueMeta[]>([]);
  const [editingTraining, setEditingTraining] = useState<Training | null>(null);
  const [decodedFirmas, setDecodedFirmas] = useState<Map<number, FirmaData>>(new Map());

  // Form refs
  const tituloRef = useRef('');
  const descripcionRef = useRef('');
  const observacionesRef = useRef('');
  const nombreResponsableRef = useRef('');
  const cedulaResponsableRef = useRef('');

  // Form dropdowns
  const [selectedResultado, setSelectedResultado] = useState<string>('');

  // Location state

  // Camera state
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);

  // QR Scanner
  const { scanQR, QRScannerComponent } = useQRScanner();

  // Expanded trainings state (usando string para mayor compatibilidad)
  const [expandedTrainings, setExpandedTrainings] = useState<Set<string>>(new Set());

  const [filterEmpresaId, setFilterEmpresaId] = useState<number | null>(null);
  const [filterClienteId, setFilterClienteId] = useState<number | null>(null);
  const [filterDivisionId, setFilterDivisionId] = useState<number | null>(null);
  const [filterContratoId, setFilterContratoId] = useState<number | null>(null);
  const [filterCorpoId, setFilterCorpoId] = useState<number | null>(null);

  const [formEmpresaId, setFormEmpresaId] = useState<number | null>(null);
  const [formClienteId, setFormClienteId] = useState<number | null>(null);
  const [formDivisionId, setFormDivisionId] = useState<number | null>(null);
  const [formContratoId, setFormContratoId] = useState<number | null>(null);
  const [formCorpoId, setFormCorpoId] = useState<number | null>(null);
  /** Puesto de la jerarquía (id en e_estructura_puesto del registro principal) */
  const [formPuestoJerarquiaId, setFormPuestoJerarquiaId] = useState<number | null>(null);
  const [deletingTrainingKey, setDeletingTrainingKey] = useState<string | null>(null);

  // Filter states (solo campos no cubiertos por la jerarquía de selects)
  const [filterEmpleado, setFilterEmpleado] = useState('');
  const [filterPuestoNombre, setFilterPuestoNombre] = useState('');
  const [filterResponsable, setFilterResponsable] = useState('');
  const [filterDescripcion, setFilterDescripcion] = useState('');
  const [filterResultado, setFilterResultado] = useState('');
  const [filterObservaciones, setFilterObservaciones] = useState('');
  const [filterFecha, setFilterFecha] = useState('');
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  const [showFilterFechaPicker, setShowFilterFechaPicker] = useState(false);
  const listFiltersSyncedFromMarcaOnceRef = useRef(false);

  const fetchMainStructure = useCallback(async (): Promise<EmpresaStructure[]> => {
    try {
      const merged = await loadMainStructureTreeMerged();
      const arr = Array.isArray(merged) ? (merged as EmpresaStructure[]) : [];
      setStructure(arr);
      return arr;
    } catch {
      setStructure([]);
      return [];
    }
  }, []);

  const applyHierarchyToFilters = useCallback((current: any, tree: StructureTree) => {
    if (current?.id == null) return;
    const path = buildHierarchyFromCurrentMarca(current, tree);
    setFilterEmpresaId(path.empresaId);
    setFilterClienteId(path.clienteId);
    setFilterDivisionId(path.divisionId);
    setFilterContratoId(path.contratoId);
    setFilterCorpoId(path.sucursalId);
  }, []);

  /** Un solo lote (mismo criterio que InductionTourRecordScreen: sin useEffect en cascada). */
  const applyFormHierarchyBatchedFromMarca = useCallback((path: HierarchyPath) => {
    unstable_batchedUpdates(() => {
      setFormEmpresaId(path.empresaId);
      setFormClienteId(path.clienteId);
      setFormDivisionId(path.divisionId);
      setFormContratoId(path.contratoId);
      setFormCorpoId(path.sucursalId);
      setFormPuestoJerarquiaId(path.puestoId);
    });
  }, []);

  /** Precarga desde `current_marca` + árbol (paralelo a `applyCurrentMarcaToFormHierarchy` en InductionTourRecordScreen). */
  const applyCurrentMarcaToFormHierarchy = useCallback(async () => {
    try {
      const currentMarcaStr = await AsyncStorage.getItem('current_marca');
      if (!currentMarcaStr) return;
      const marcaObj = JSON.parse(currentMarcaStr);
      if (marcaObj?.id == null) return;
      const tree = structure.length > 0 ? structure : await fetchMainStructure();
      const path = buildHierarchyFromCurrentMarca(marcaObj, tree);
      applyFormHierarchyBatchedFromMarca(path);
    } catch (e) {
      console.error('Precarga jerarquía formulario:', e);
    }
  }, [structure, fetchMainStructure, applyFormHierarchyBatchedFromMarca]);

  const handleFilterHierarchyChange = (v: HierarchyPickerValues) => {
    setFilterEmpresaId(v.empresaId);
    setFilterClienteId(v.clienteId);
    setFilterDivisionId(v.divisionId);
    setFilterContratoId(v.contratoId);
    setFilterCorpoId(v.sucursalId);
  };

  const handleFormHierarchyChange = useCallback((v: HierarchyPickerValues) => {
    setFormEmpresaId(v.empresaId);
    setFormClienteId(v.clienteId);
    setFormDivisionId(v.divisionId);
    setFormContratoId(v.contratoId);
    setFormCorpoId(v.sucursalId);
    setFormPuestoJerarquiaId(v.puestoId ?? null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setIsBootstrapping(true);
        try {
          const currentMarca = await AsyncStorage.getItem('current_marca');
          const marcaData = currentMarca ? JSON.parse(currentMarca) : null;
          if (marcaData?.id != null) {
            const marca_id = Number(marcaData.id) || null;
            const corpo_id = Number(marcaData?.corpo?.id ?? marcaData?.corpo_id ?? 0) || null;
            if (!cancelled) {
              setMarcaId(marca_id);
              setCorpoId(corpo_id);
              setRoleName(marcaData?.roleDivision?.role?.nombre ?? null);
            }
          }
          const tree = await fetchMainStructure();
          if (!listFiltersSyncedFromMarcaOnceRef.current) {
            if (!cancelled && marcaData?.id != null) {
              applyHierarchyToFilters(marcaData, tree);
            }
            if (!cancelled) listFiltersSyncedFromMarcaOnceRef.current = true;
          }
        } catch {
          /* ignore bootstrap errors */
        } finally {
          if (!cancelled) setIsBootstrapping(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [fetchMainStructure, applyHierarchyToFilters])
  );

  const checkConnection = async (): Promise<boolean> => {
    //return false;
    const networkState = await Network.getNetworkStateAsync();

    return (
      networkState.isConnected === true &&
      networkState.isInternetReachable === true
    );
  };

  const isProbablyNetworkError = (err: any) => {
    const msg = String(err?.message ?? err ?? '').toLowerCase();
    return (
      msg.includes('network request failed') ||
      msg.includes('failed to fetch') ||
      msg.includes('networkerror') ||
      msg.includes('timeout') ||
      msg.includes('timed out')
    );
  };

  const listFetchGenRef = useRef(0);

  const fetchTrainingsForCorpo = useCallback(async () => {
    const marca_id = marcaId;
    const corpo_id = filterCorpoId != null ? Number(filterCorpoId) : null;
    if (!marca_id || corpo_id == null || !Number.isFinite(corpo_id) || corpo_id <= 0) {
      listFetchGenRef.current += 1;
      setIsListLoading(false);
      setTrainings([]);
      return;
    }
    const gen = ++listFetchGenRef.current;
    const isStale = () => gen !== listFetchGenRef.current;

    try {
      if (!isStale()) {
        setIsListLoading(true);
        setError(null);
        setOfflineMessage(null);
      }

      const hasConnection = await checkConnection();
      if (isStale()) return;

      if (hasConnection) {
        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) {
          throw new Error('Server URL not configured');
        }
        const response = await authedFetch({
          url: `${apiUrl}/api/training?m=${marca_id}&corpo_id=${corpo_id}`,
          init: {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          },
          refreshAccessToken,
          logout,
        });
        if (!response) return;
        if (isStale()) return;

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (isStale()) return;

        if (data.status && Array.isArray(data.capacitaciones)) {
          const trainingsWithDecodedFirmas = await Promise.all(
            data.capacitaciones.map(async (training: Training) => {
              if (training.firma_responsable && training.firma_responsable.trim() !== '') {
                try {
                  const decodedString = atob(training.firma_responsable);
                  const parts = decodedString.split(':');
                  if (parts.length === 5) {
                    const [sessionId, empleadoId, latitud, longitud, timestamp] = parts;

                    let empleadoDetalle = undefined;
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
                      if (!empleadoResponse) return training;

                      if (empleadoResponse.ok) {
                        const empleadoData = await empleadoResponse.json();
                        empleadoDetalle = {
                          nombre: empleadoData.nombre,
                          primer_apellido: empleadoData.primer_apellido,
                          segundo_apellido: empleadoData.segundo_apellido,
                          cedula_empleado: empleadoData.cedula || '',
                        };
                      }
                    } catch (err) {
                      console.error('Error fetching empleado details:', err);
                    }

                    const firmaData: FirmaData = {
                      sessionId,
                      empleadoId,
                      latitud,
                      longitud,
                      timestamp,
                      empleadoDetalle,
                    };

                    setDecodedFirmas(prev => {
                      const newMap = new Map(prev);
                      newMap.set(training.id, firmaData);
                      return newMap;
                    });
                  }
                } catch (err) {
                  console.error('Error decoding firma:', err);
                }
              }
              return training;
            })
          );

          if (!isStale()) {
            const withCorpo = trainingsWithDecodedFirmas.map((t: Training) => ({
              ...t,
              corpo_id: t.corpo_id ?? t.sucursal?.id,
            }));
            let prevCache: Training[] = [];
            try {
              const prevStr = await AsyncStorage.getItem('trainings_cache');
              if (prevStr) {
                const parsed = JSON.parse(prevStr);
                prevCache = Array.isArray(parsed) ? parsed : [];
              }
            } catch {
              prevCache = [];
            }
            const mergedCache = mergeTrainingsCacheForCorpo(prevCache, withCorpo, corpo_id);
            await AsyncStorage.setItem('trainings_cache', JSON.stringify(mergedCache));
            const forDisplay = filterCachedTrainingsForSelectedCorpo(
              mergedCache,
              corpo_id,
              matchCacheToFilterCorpo
            );
            setTrainings(forDisplay);
          }
        } else {
          if (!isStale()) {
            let readCacheOk = false;
            try {
              const trainingsCache = await AsyncStorage.getItem('trainings_cache');
              if (trainingsCache) {
                const parsed = JSON.parse(trainingsCache);
                const cachedTrainings = Array.isArray(parsed) ? (parsed as Training[]) : [];
                readCacheOk = true;
                const filteredCache = filterCachedTrainingsForSelectedCorpo(
                  cachedTrainings,
                  corpo_id,
                  matchCacheToFilterCorpo
                );
                setTrainings(filteredCache);
                if (filteredCache.length > 0) {
                  setOfflineMessage(
                    'La respuesta del servidor no fue válida; se muestran capacitaciones en caché para la sucursal seleccionada.'
                  );
                } else {
                  setOfflineMessage(null);
                }
              }
            } catch {
              /* ignorar caché corrupta */
            }
            if (!readCacheOk) {
              setTrainings([]);
            }
            if (data?.message) setError(String(data.message));
          }
        }

        if (!isStale()) {
          setCorpoId(corpo_id);
        }
      } else {
        const trainingsCache = await AsyncStorage.getItem('trainings_cache');
        if (isStale()) return;
        if (trainingsCache) {
          const cachedTrainings = JSON.parse(trainingsCache) as Training[];
          const filteredCache = filterCachedTrainingsForSelectedCorpo(
            cachedTrainings,
            corpo_id,
            matchCacheToFilterCorpo
          );
          setTrainings(filteredCache);
          setOfflineMessage('Modo Offline: mostrando capacitaciones guardadas para la sucursal seleccionada.');
        } else {
          setTrainings([]);
          setOfflineMessage('Sin conexión: no hay capacitaciones guardadas para mostrar.');
        }

      }
    } catch (error) {
      if (isStale()) return;
      console.error('Error fetching trainings:', error);
      const trainingsCache = await AsyncStorage.getItem('trainings_cache');
      if (trainingsCache) {
        const cachedTrainings = JSON.parse(trainingsCache) as Training[];
        const filteredCache = filterCachedTrainingsForSelectedCorpo(
          cachedTrainings,
          corpo_id,
          matchCacheToFilterCorpo
        );
        setTrainings(filteredCache);
        setOfflineMessage('Modo Offline: mostrando capacitaciones guardadas debido a un error de conexión.');
      } else {
        setTrainings([]);
        if (isProbablyNetworkError(error)) {
          setOfflineMessage('Sin conexión: no hay capacitaciones guardadas para mostrar.');
        } else {
          setError('Error al cargar las capacitaciones');
        }
      }

    } finally {
      if (!isStale()) setIsListLoading(false);
    }
  }, [marcaId, filterCorpoId, refreshAccessToken, logout, matchCacheToFilterCorpo]);

  const fetchTrainingsForCorpoRef = useRef<(() => Promise<void>) | null>(null);
  fetchTrainingsForCorpoRef.current = fetchTrainingsForCorpo;

  useEffect(() => {
    const cid = filterCorpoId != null ? Number(filterCorpoId) : null;
    if (!marcaId || cid == null || !Number.isFinite(cid) || cid <= 0) {
      listFetchGenRef.current += 1;
      setIsListLoading(false);
      setTrainings([]);
      return;
    }
    void fetchTrainingsForCorpoRef.current?.();
  }, [marcaId, filterCorpoId]);

  useEffect(() => {
    const handler = () => {
      if (filterCorpoId != null && marcaId != null) {
        void fetchTrainingsForCorpoRef.current?.();
      }
    };
    eventBus.on('connectionRestored', handler);
    return () => {
      eventBus.off('connectionRestored', handler);
    };
  }, [filterCorpoId, marcaId]);

  const dateToLocalString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDateForDisplay = (dateString: string): string => {
    if (!dateString) return 'Seleccionar fecha';
    const [year, month, day] = dateString.split('-');
    return `${day}-${month}-${year}`;
  };

  const formEmpresasList = useMemo(() => (Array.isArray(structure) ? structure : []), [structure]);
  const formClientesList = useMemo(() => {
    const e = formEmpresasList.find((x) => x.id === formEmpresaId);
    return e?.clientes || [];
  }, [formEmpresasList, formEmpresaId]);
  const formDivisionesList = useMemo(() => {
    const c = formClientesList.find((x) => x.id === formClienteId);
    return c?.division || [];
  }, [formClientesList, formClienteId]);
  const formContratosList = useMemo(() => {
    const d = formDivisionesList.find((x) => x.id === formDivisionId);
    return d?.contratos || [];
  }, [formDivisionesList, formDivisionId]);
  const formSucursalesList = useMemo(() => {
    const c = formContratosList.find((x) => x.id === formContratoId);
    return c?.sucursales || [];
  }, [formContratosList, formContratoId]);
  const handleTrainingEmployeeSearchSelect = useCallback((hit: EmployeeSearchHit) => {
    const nombre = hit.title.replace(/\s*\([^)]*\)\s*$/, '').trim() || hit.title;
    setSelectedEmpleados((prev) => {
      if (prev.some((e) => e.id === hit.empleadoId)) return prev;
      return [
        ...prev,
        {
          id: hit.empleadoId,
          nombre,
          cedula: hit.cedula,
          fecha_contratacion: hit.fechaContratacion,
        },
      ];
    });
  }, []);

  const handleTrainingPuestoSearchSelect = useCallback((hit: PuestoSearchHit) => {
    setSelectedPuestos((prev) => {
      if (prev.some((p) => p.id === hit.puestoId)) return prev;
      return [...prev, { id: hit.puestoId, nombre: hit.title }];
    });
  }, []);

  const startCreating = async () => {
    const horaAccion = await getHoraAccion();
    if (!horaAccion) {
      Alert.alert('Error', 'No se pudo obtener la hora');
      return;
    }
    setFormEmpresaId(null);
    setFormClienteId(null);
    setFormDivisionId(null);
    setFormContratoId(null);
    setFormCorpoId(null);
    setFormPuestoJerarquiaId(null);
    setEditingTraining(null);
    setIsCreating(true);
    setFormKey(prev => prev + 1); // Incrementar key para forzar re-render
    tituloRef.current = '';
    descripcionRef.current = '';
    observacionesRef.current = '';
    nombreResponsableRef.current = employee?.name || '';
    cedulaResponsableRef.current = employee?.cedula || '';
    setFechaCapacitacion(new Date(horaAccion).toISOString().split('T')[0]);
    setSelectedTipo('Presencial');
    setSelectedEmpleados([]);
    setSelectedPuestos([]);
    setSelectedResultado('');
    setFirmaResponsable(null);
    setPendingTrainingFiles([]);

    await applyCurrentMarcaToFormHierarchy();
  };

  const cancelCreating = () => {
    setEditingTraining(null);
    setIsCreating(false);
    resetForm();
  };

  const resetForm = () => {
    setFormEmpresaId(null);
    setFormClienteId(null);
    setFormDivisionId(null);
    setFormContratoId(null);
    setFormCorpoId(null);
    setFormPuestoJerarquiaId(null);
    setFormKey(prev => prev + 1); // Incrementar key para forzar re-render
    tituloRef.current = '';
    descripcionRef.current = '';
    observacionesRef.current = '';
    nombreResponsableRef.current = '';
    cedulaResponsableRef.current = '';
    setFechaCapacitacion('');
    setSelectedTipo('Presencial');
    setSelectedEmpleados([]);
    setSelectedPuestos([]);
    setSelectedResultado('');
    setFirmaResponsable(null);
    setPendingTrainingFiles([]);
  };

  const removeEmpleado = (empleadoId: number) => {
    setSelectedEmpleados(selectedEmpleados.filter(e => e.id !== empleadoId));
  };

  const removePuesto = (puestoId: number) => {
    setSelectedPuestos(selectedPuestos.filter(p => p.id !== puestoId));
  };

  const openCamera = async () => {
    if (!permission) {
      const permissionResult = await requestPermission();
      if (!permissionResult.granted) {
        Alert.alert('Error', 'Se necesita permiso para acceder a la cámara');
        return;
      }
    }

    if (!permission?.granted) {
      const permissionResult = await requestPermission();
      if (!permissionResult.granted) {
        Alert.alert('Error', 'Se necesita permiso para acceder a la cámara');
        return;
      }
    }

    setIsCameraVisible(true);
  };

  const takePicture = async () => {
    if (!cameraRef.current) {
      Alert.alert('Error', 'Cámara no disponible');
      return;
    }

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        skipProcessing: false,
      });

      if (!photo?.uri) {
        Alert.alert('Error', 'No se pudo capturar la foto. Por favor intente nuevamente.');
        setIsCameraVisible(false);
        return;
      }

      setIsCameraVisible(false);
      const fileName = await saveFile({
        uri: photo.uri,
        originalName: 'capacitacion_foto',
        extension: 'jpg',
        type: 'image',
        prefix: 'capacitacion',
      });
      const id = Math.random().toString(36).substring(2, 12);
      setPendingTrainingFiles((prev) => [
        ...prev,
        {
          id,
          localFileName: fileName,
          extension: 'jpg',
          originalName: `Foto_cámara_${Date.now()}.jpg`,
        },
      ]);
    } catch (error) {
      console.error('Error capturing image:', error);
      Alert.alert('Error', 'No se pudo capturar la imagen');
      setIsCameraVisible(false);
    }
  };

  /** Añade archivo por tipo (mismo criterio que JobManualsScreen: `DocumentPicker` por MIME). */
  const pickTrainingFileByType = async (kind: 'image' | 'document' | 'audio' | 'video') => {
    let pickerTypes: string | string[] | undefined;
    switch (kind) {
      case 'image':
        pickerTypes = ['image/*'];
        break;
      case 'audio':
        pickerTypes = ['audio/*'];
        break;
      case 'video':
        pickerTypes = ['video/*'];
        break;
      case 'document':
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
      default:
        pickerTypes = ['*/*'];
    }
    const storageType: StoredFileType =
      kind === 'document' ? 'text' : kind === 'image' ? 'image' : kind === 'video' ? 'video' : 'audio';

    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: pickerTypes,
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      const on = asset.name || (kind === 'image' ? 'imagen' : kind === 'audio' ? 'audio' : kind === 'video' ? 'video' : 'documento');
      let ext = '';
      if (on.includes('.')) {
        ext = (on.split('.').pop() || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 20) || '';
      }
      const mt = (asset.mimeType || '').split(';')[0].trim().toLowerCase();
      const PICKER_MIME_TO_EXT: Record<string, string> = {
        'application/pdf': 'pdf',
        'application/msword': 'doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
        'application/vnd.ms-excel': 'xls',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
        'text/plain': 'txt',
        'text/csv': 'csv',
        'text/html': 'html',
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'image/heic': 'heic',
        'image/heif': 'heif',
        'video/mp4': 'mp4',
        'video/quicktime': 'mov',
        'audio/mpeg': 'mp3',
        'audio/mp4': 'm4a',
        'audio/wav': 'wav',
        'application/octet-stream': '',
      };
      if (!ext && mt && PICKER_MIME_TO_EXT[mt]) {
        ext = PICKER_MIME_TO_EXT[mt];
      }
      if (!ext && mt && mt.includes('/')) {
        const part = mt.split('/').pop() || '';
        const guess = part.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20) || '';
        if (guess && guess !== 'octetstream' && guess.length <= 6) {
          ext = guess;
        }
      }
      if (!ext) {
        if (kind === 'image') ext = 'jpg';
        else if (kind === 'video') ext = 'mp4';
        else if (kind === 'audio') ext = 'm4a';
        else ext = 'pdf';
      }
      const fileName = await saveFile({
        uri: asset.uri,
        originalName: on,
        extension: ext,
        type: storageType,
        prefix: 'capacitacion',
      });
      const id = Math.random().toString(36).substring(2, 12);
      setPendingTrainingFiles((prev) => [
        ...prev,
        { id, localFileName: fileName, extension: ext, originalName: on },
      ]);
    } catch (e) {
      console.error('pickTrainingFileByType', kind, e);
      Alert.alert('Error', 'No se pudo adjuntar el archivo. Intenta de nuevo.');
    }
  };

  const removePendingTrainingFile = useCallback((pf: TrainingFileQueueMeta) => {
    void (async () => {
      try {
        await deleteFile(pf.localFileName);
      } catch {
        /* idempotente */
      }
      setPendingTrainingFiles((prev) => prev.filter((x) => x.id !== pf.id));
    })();
  }, []);

  const generateSignature = async () => {
    if (!employee) {
      Alert.alert('Error', 'No se pudo obtener la información del empleado');
      return;
    }

    setIsGeneratingFirma(true);

    try {
      const hash = await getCurrentUserDigitalSignature(employee);
      if (!hash) return;

      const parsed = parseFirmaBase64ToFirmaData(hash);
      if (!parsed) {
        Alert.alert('Error', 'La firma generada no es válida');
        return;
      }

      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      const connectionStatus = await checkConnection();
      let empleadoDetalle = parsed.empleadoDetalle;
      if (connectionStatus && apiUrl && !empleadoDetalle) {
        const empleadoResponse = await authedFetch({
          url: `${apiUrl}/api/empleados/${parsed.empleadoId}`,
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

      setFirmaResponsable({ ...parsed, empleadoDetalle });
    } catch (error) {
      console.error('Error generating signature:', error);
      Alert.alert('Error', 'No se pudo generar la firma digital');
    } finally {
      setIsGeneratingFirma(false);
    }
  };

  const handleScanQR = async () => {
    try {
      const qrData = await scanQR();
      if (!qrData) {
        return;
      }

      // Validar que sea base64 válido
      try {
        const decodedHash = atob(qrData);
        const parts = decodedHash.split(':');

        if (parts.length !== 5) {
          Alert.alert('Error', 'El QR no tiene la estructura esperada');
          return;
        }

        const [sessionId, empleadoId, latitud, longitud, timestamp] = parts;

        const connectionStatus = await checkConnection();

        let empleadoDetalle = undefined;
        if (connectionStatus) {
          // Fetch empleado details
          const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
          if (!apiUrl) {
            throw new Error('Server URL not configured');
          }
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
        Alert.alert('Error', 'El QR escaneado no es válido');
      }
    } catch (error) {
      console.error('Error scanning QR:', error);
      Alert.alert('Error', 'No se pudo escanear el código QR');
    }
  };

  const handleFechaCapacitacionChange = (event: any, selectedDate?: Date) => {
    setShowFechaCapacitacionPicker(Platform.OS === 'ios');
    if (selectedDate) {
      setFechaCapacitacion(dateToLocalString(selectedDate));
    }
  };

  const generateDateTime = (timestamp: string) => {
    const fecha = new Date(parseInt(timestamp)).toISOString();
    const fechaSplit = fecha.split('T');
    fechaSplit[1] = fechaSplit[1].split('.')[0];
    return fechaSplit[0] + ' ' + fechaSplit[1];
  };

  const toggleTrainingExpanded = (trainingKey: string) => {
    setExpandedTrainings(prev => {
      const newSet = new Set(prev);
      if (newSet.has(trainingKey)) {
        newSet.delete(trainingKey);
      } else {
        newSet.add(trainingKey);
      }
      return newSet;
    });
  };

  const resetAllFilters = useCallback(async () => {
    setFilterEmpleado('');
    setFilterPuestoNombre('');
    setFilterResponsable('');
    setFilterDescripcion('');
    setFilterResultado('');
    setFilterObservaciones('');
    setFilterFecha('');
    try {
      const raw = await AsyncStorage.getItem('current_marca');
      const tree = structure.length > 0 ? structure : await fetchMainStructure();
      if (raw) {
        applyHierarchyToFilters(JSON.parse(raw), tree);
      } else {
        setFilterEmpresaId(null);
        setFilterClienteId(null);
        setFilterDivisionId(null);
        setFilterContratoId(null);
        setFilterCorpoId(null);
      }
    } catch {
      setFilterEmpresaId(null);
      setFilterClienteId(null);
      setFilterDivisionId(null);
      setFilterContratoId(null);
      setFilterCorpoId(null);
    }
  }, [structure, fetchMainStructure, applyHierarchyToFilters]);

  const handleFilterFechaChange = (event: any, selectedDate?: Date) => {
    setShowFilterFechaPicker(Platform.OS === 'ios');
    if (selectedDate) {
      setFilterFecha(dateToLocalString(selectedDate));
    }
  };

  const filteredTrainings = trainings.filter((training) => {
    if (training.isActive === false) return false;
    const matchesEmpresa = !filterEmpresaId || training.empresa.id === filterEmpresaId;
    const matchesCliente = !filterClienteId || training.cliente.id === filterClienteId;
    const matchesSucursal = !filterCorpoId || training.sucursal.id === filterCorpoId;

    const matchesEmpleado = !filterEmpleado ||
      training.empleados.some(e => e.nombre.toLowerCase().includes(filterEmpleado.toLowerCase()) || e.cedula.toLowerCase().includes(filterEmpleado.toLowerCase()));

    const puestoNeedle = filterPuestoNombre.trim().toLowerCase();
    const matchesPuesto =
      !puestoNeedle ||
      (training.puestos?.some((p) => p.nombre.toLowerCase().includes(puestoNeedle)) ?? false);

    const matchesResponsable = !filterResponsable ||
      training.responsable.nombre.toLowerCase().includes(filterResponsable.toLowerCase());

    const matchesDescripcion = !filterDescripcion ||
      training.descripcion.toLowerCase().includes(filterDescripcion.toLowerCase());

    const matchesResultado = !filterResultado ||
      (training.resultado && training.resultado.toLowerCase().includes(filterResultado.toLowerCase()));

    const matchesObservaciones = !filterObservaciones ||
      (training.observaciones && training.observaciones.toLowerCase().includes(filterObservaciones.toLowerCase()));

    const matchesFecha = !filterFecha ||
      (training.fecha && training.fecha.split('T')[0] === filterFecha);

    return matchesEmpresa && matchesCliente && matchesSucursal &&
      matchesEmpleado && matchesPuesto && matchesResponsable &&
      matchesDescripcion && matchesResultado && matchesObservaciones && matchesFecha;
  });

  const validateForm = (): boolean => {
    if (
      !formEmpresaId ||
      !formClienteId ||
      !formDivisionId ||
      !formContratoId ||
      !formCorpoId ||
      !formPuestoJerarquiaId
    ) {
      Alert.alert('Error', 'Debes completar la jerarquía Empresa → Sucursal → Puesto');
      return false;
    }
    if (selectedPuestos.length === 0) {
      Alert.alert('Error', 'Debes seleccionar al menos un puesto');
      return false;
    }
    if (!tituloRef.current.trim()) {
      Alert.alert('Error', 'El título de la capacitación es requerido');
      return false;
    }

    if (!descripcionRef.current.trim()) {
      Alert.alert('Error', 'La descripción de la capacitación es requerida');
      return false;
    }

    if (!fechaCapacitacion) {
      Alert.alert('Error', 'La fecha de la capacitación es requerida');
      return false;
    }

    if (!nombreResponsableRef.current.trim()) {
      Alert.alert('Error', 'El nombre del responsable es requerido');
      return false;
    }

    if (!cedulaResponsableRef.current.trim()) {
      Alert.alert('Error', 'La cédula del responsable es requerida');
      return false;
    }

    if (!editingTraining) {
      if (!firmaResponsable) {
        Alert.alert('Error', 'Debes generar o escanear la firma del responsable');
        return false;
      }
    }

    return true;
  };

  const openEditTraining = (t: Training) => {
    if (t.id === 0) {
      Alert.alert('Aviso', 'No se puede editar un borrador pendiente de sincronización.');
      return;
    }
    setEditingTraining(t);
    setIsCreating(true);
    setFormKey((k) => k + 1);
    unstable_batchedUpdates(() => {
      setFormEmpresaId(t.empresa.id);
      setFormClienteId(t.cliente.id);
      setFormDivisionId(t.division_id ?? null);
      setFormContratoId(t.contrato_id ?? null);
      setFormCorpoId(t.sucursal.id);
      setFormPuestoJerarquiaId(t.puesto_id ?? null);
    });
    tituloRef.current = t.titulo;
    descripcionRef.current = t.descripcion;
    observacionesRef.current = t.observaciones;
    nombreResponsableRef.current = t.responsable.nombre;
    cedulaResponsableRef.current = t.responsable.cedula;
    setFechaCapacitacion(t.fecha.split('T')[0] || t.fecha);
    setSelectedTipo((t.tipo as 'Presencial' | 'Virtual') || 'Presencial');
    setSelectedResultado(t.resultado && t.resultado !== 'No disponible' ? t.resultado : '');
    setSelectedEmpleados(
      t.empleados.map((e) => ({
        id: e.id,
        nombre: e.nombre,
        cedula: e.cedula,
        fecha_contratacion: '',
      }))
    );
    setSelectedPuestos(t.puestos.map((p) => ({ id: p.id, nombre: p.nombre })));
    setPendingTrainingFiles([]);
    const firmaFromList = decodedFirmas.get(t.id);
    const firmaParsed = firmaFromList ?? parseFirmaBase64ToFirmaData(t.firma_responsable);
    setFirmaResponsable(firmaParsed);
    if (firmaParsed && !firmaParsed.empleadoDetalle && firmaParsed.empleadoId) {
      void (async () => {
        try {
          const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
          if (!apiUrl) return;
          const empleadoResponse = await authedFetch({
            url: `${apiUrl}/api/empleados/${firmaParsed.empleadoId}`,
            init: {
              method: 'GET',
              headers: { 'Content-Type': 'application/json' },
            },
            refreshAccessToken,
            logout,
          });
          if (!empleadoResponse?.ok) return;
          const empleadoData = await empleadoResponse.json();
          setFirmaResponsable((prev) =>
            prev && prev.sessionId === firmaParsed.sessionId
              ? {
                  ...prev,
                  empleadoDetalle: {
                    nombre: empleadoData.nombre,
                    primer_apellido: empleadoData.primer_apellido,
                    segundo_apellido: empleadoData.segundo_apellido,
                    cedula_empleado: empleadoData.cedula || '',
                  },
                }
              : prev
          );
        } catch (e) {
          console.error('Firma empleado detalle (edición):', e);
        }
      })();
    }
  };

  const submitCreateTraining = async () => {
    if (!validateForm() || !marcaId) return;
    if (!editingTraining && !firmaResponsable) return;
    setIsCreateSubmitting(true);
    try {
      const signatureHash =
        firmaResponsable != null
          ? btoa(
            firmaResponsable.sessionId +
              ':' +
              firmaResponsable.empleadoId +
              ':' +
              firmaResponsable.latitud +
              ':' +
              firmaResponsable.longitud +
              ':' +
              firmaResponsable.timestamp
          )
          : editingTraining?.firma_responsable || '';

      const { files: fileUris, files_meta: filesMetaForApi } =
        await buildTrainingFilesAndMetaFromFileMeta(pendingTrainingFiles);

      const baseRequestFields = {
        marca_id: marcaId,
        empresa_id: formEmpresaId,
        cliente_id: formClienteId,
        corpo_id: formCorpoId,
        division_id: formDivisionId,
        contrato_id: formContratoId,
        puesto_id: formPuestoJerarquiaId,
        titulo: tituloRef.current,
        descripcion: descripcionRef.current,
        tipo: selectedTipo,
        resultado: selectedResultado || null,
        observaciones: observacionesRef.current.trim() !== '' ? observacionesRef.current.trim() : '-',
        nombre_responsable: nombreResponsableRef.current,
        cedula_responsable: cedulaResponsableRef.current,
        firma_responsable: signatureHash,
        fecha: fechaCapacitacion,
        empleados: selectedEmpleados.map((e) => e.id),
        puestos: selectedPuestos.map((p) => p.id),
      };

      const requestData = {
        ...baseRequestFields,
        files: fileUris,
        ...(fileUris.length > 0 && filesMetaForApi.length > 0
          ? { files_meta: filesMetaForApi }
          : {}),
      };

      if (editingTraining && editingTraining.id > 0) {
        const hasConnection = await checkConnection();
        const updateBody = {
          ...requestData,
          files: fileUris,
        };
        if (hasConnection) {
          const result = await updateTrainingAPI({
            trainingId: editingTraining.id,
            requestData: updateBody,
            refreshAccessToken,
            logout,
          });
          if (result.status) {
            Alert.alert('Éxito', 'Capacitación actualizada');
            setEditingTraining(null);
            setIsCreating(false);
            resetForm();
            void fetchTrainingsForCorpoRef.current?.();
          } else {
            Alert.alert('Error', (result as { message?: string }).message || 'No se pudo actualizar');
          }
        } else {
          const uq = Math.random().toString(36).substring(2, 12);
          const actionsStr = await AsyncStorage.getItem('trainings_actions');
          let act: any[] = actionsStr ? JSON.parse(actionsStr) : [];
          if (!Array.isArray(act)) act = [];
          act = act.filter(
            (a: any) => !(a.type === 'update' && Number(a.trainingId) === Number(editingTraining.id))
          );
          const updatePayload =
            pendingTrainingFiles.length > 0
              ? {
                  ...baseRequestFields,
                  filesMeta: trainingFilesMetaForQueue(pendingTrainingFiles),
                }
              : { ...baseRequestFields };
          act.push({
            type: 'update',
            updateQueueId: uq,
            trainingId: editingTraining.id,
            requestData: updatePayload,
            marcaId,
          });
          await AsyncStorage.setItem('trainings_actions', JSON.stringify(act));
          const cacheStr = await AsyncStorage.getItem('trainings_cache');
          if (cacheStr) {
            const cache = JSON.parse(cacheStr) as Training[];
            const next = cache.map((row) =>
              row.id === editingTraining.id
                ? {
                    ...row,
                    empresa: { id: formEmpresaId!, nombre: row.empresa.nombre },
                    cliente: { id: formClienteId!, nombre: row.cliente.nombre },
                    sucursal: { id: formCorpoId!, nombre: row.sucursal.nombre },
                    responsable: {
                      nombre: nombreResponsableRef.current,
                      cedula: cedulaResponsableRef.current,
                    },
                    titulo: tituloRef.current,
                    descripcion: descripcionRef.current,
                    observaciones: observacionesRef.current.trim() !== '' ? observacionesRef.current.trim() : '-',
                    tipo: selectedTipo,
                    puesto_id: formPuestoJerarquiaId!,
                    division_id: formDivisionId!,
                    contrato_id: formContratoId!,
                    fecha: fechaCapacitacion,
                    resultado: selectedResultado || null,
                    empleados: selectedEmpleados.map((e) => ({
                      id: e.id,
                      nombre: e.nombre,
                      cedula: e.cedula,
                    })),
                    puestos: selectedPuestos.map((p) => ({ id: p.id, nombre: p.nombre })),
                  }
                : row
            );
            await AsyncStorage.setItem('trainings_cache', JSON.stringify(next));
          }
          setTrainings((prev) =>
            prev.map((row) =>
              row.id === editingTraining.id
                ? {
                    ...row,
                    titulo: tituloRef.current,
                    descripcion: descripcionRef.current,
                    observaciones: requestData.observaciones,
                    tipo: selectedTipo,
                    resultado: selectedResultado || null,
                    division_id: formDivisionId!,
                    contrato_id: formContratoId!,
                    puesto_id: formPuestoJerarquiaId!,
                    empleados: selectedEmpleados.map((e) => ({
                      id: e.id,
                      nombre: e.nombre,
                      cedula: e.cedula,
                    })),
                    puestos: selectedPuestos.map((p) => ({ id: p.id, nombre: p.nombre })),
                  }
                : row
            )
          );
          Alert.alert('Modo offline', 'Cambios guardados; se enviarán al reconectar.');
          setEditingTraining(null);
          setIsCreating(false);
          resetForm();
        }
        return;
      }

      const hasConnection = await checkConnection();

      if (hasConnection) {
        const result = await createTrainingAPI({
          requestData,
          marcaId,
          refreshAccessToken,
          logout,
        });

        if (result.status) {
          Alert.alert('Éxito', 'Capacitación creada correctamente');
          setIsCreating(false);
          resetForm();
          void fetchTrainingsForCorpoRef.current?.();
        } else {
          Alert.alert('Error', result.message || 'No se pudo crear la capacitación');
        }
      } else {
        const localId = Math.random().toString(36).substring(2, 12);
        const actionsStr = await AsyncStorage.getItem('trainings_actions');
        let actions: any[] = actionsStr ? JSON.parse(actionsStr) : [];
        if (!Array.isArray(actions)) actions = [];
        actions = actions.filter(
          (a: any) => !(a?.type === 'create' && String(a?.id) === String(localId))
        );
        const requestDataOffline = {
          ...baseRequestFields,
          filesMeta: trainingFilesMetaForQueue(pendingTrainingFiles),
        };
        actions.push({
          requestData: requestDataOffline,
          marcaId,
          id: localId,
          type: 'create',
        });
        await AsyncStorage.setItem('trainings_actions', JSON.stringify(actions));

        const cacheStr = await AsyncStorage.getItem('trainings_cache');
        const cache = cacheStr ? JSON.parse(cacheStr) : [];

        const empNode = formEmpresasList.find((e) => e.id === formEmpresaId);
        const cliNode = formClientesList.find((c) => c.id === formClienteId);
        const sucNode = formSucursalesList.find((s) => s.id === formCorpoId);

        const newTraining: Training = {
          id: 0,
          empresa: { id: formEmpresaId!, nombre: empNode?.nombre || '-' },
          cliente: { id: formClienteId!, nombre: cliNode?.nombre || '-' },
          sucursal: { id: formCorpoId!, nombre: sucNode?.nombre || '-' },
          division_id: formDivisionId!,
          contrato_id: formContratoId!,
          puesto_id: formPuestoJerarquiaId!,
          titulo: tituloRef.current,
          descripcion: descripcionRef.current,
          tipo: selectedTipo,
          resultado: selectedResultado || null,
          observaciones: observacionesRef.current.trim() !== '' ? observacionesRef.current.trim() : '-',
          responsable: {
            nombre: nombreResponsableRef.current,
            cedula: cedulaResponsableRef.current,
          },
          fecha: fechaCapacitacion,
          firma_responsable: signatureHash,
          nombre_firma: firmaResponsable?.empleadoDetalle
            ? `${firmaResponsable.empleadoDetalle.nombre} ${firmaResponsable.empleadoDetalle.primer_apellido} ${firmaResponsable.empleadoDetalle.segundo_apellido}`
            : '-',
          base64_file: '',
          archivos: [],
          offline_pending_files: trainingFilesMetaForQueue(pendingTrainingFiles),
          empleados: selectedEmpleados.map((e) => ({ id: e.id, nombre: e.nombre, cedula: e.cedula })),
          puestos: selectedPuestos.map((p) => ({ id: p.id, nombre: p.nombre })),
          corpo_id: formCorpoId!,
          id_local: localId,
        };

        cache.push(newTraining);
        await AsyncStorage.setItem('trainings_cache', JSON.stringify(cache));
        Alert.alert('Modo Offline', 'Capacitación registrada localmente. Se sincronizará cuando haya conexión.');
        setIsCreating(false);
        resetForm();
        const corpo = formCorpoId;
        if (corpo != null && filterCorpoId === corpo) {
          setTrainings((prev) => [...prev, newTraining]);
        }
      }
    } catch (error) {
      console.error('Error creating training:', error);
      Alert.alert('Error', 'No se pudo crear la capacitación');
    } finally {
      setIsCreateSubmitting(false);
    }
  };

  const createTraining = () => {
    if (isCreateSubmitting) return;
    if (!validateForm()) return;
    if (!marcaId) {
      Alert.alert('Error', 'No se encontró la marca actual');
      return;
    }
    const msg = editingTraining
      ? '¿Guardar los cambios de esta capacitación?'
      : '¿Estás seguro de que deseas crear esta capacitación?';
    Alert.alert('Confirmar', msg, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Aceptar', onPress: () => void submitCreateTraining() },
    ]);
  };

  const confirmDeleteArchivo = (training: Training, fileName: string) => {
    Alert.alert('Eliminar adjunto', '¿Eliminar este archivo del registro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            if (training.id === 0 && training.id_local) {
              const localIdx = (training.offline_pending_files || []).findIndex(
                (p) => p.id === fileName
              );
              const targetMeta = localIdx >= 0 ? training.offline_pending_files?.[localIdx] : undefined;
              if (targetMeta?.localFileName) {
                try {
                  await deleteFile(targetMeta.localFileName);
                } catch {
                  /* idempotente */
                }
              }
              const actionsStr = await AsyncStorage.getItem('trainings_actions');
              const list: any[] = actionsStr ? JSON.parse(actionsStr) : [];
              const next = list.map((a) => {
                if (a.type !== 'create' || String(a.id) !== String(training.id_local)) return a;
                const meta = Array.isArray(a.requestData?.filesMeta) ? [...a.requestData.filesMeta] : [];
                if (localIdx >= 0 && localIdx < meta.length) {
                  meta.splice(localIdx, 1);
                }
                return {
                  ...a,
                  requestData: { ...a.requestData, filesMeta: meta },
                };
              });
              await AsyncStorage.setItem('trainings_actions', JSON.stringify(next));
              const cacheStr = await AsyncStorage.getItem('trainings_cache');
              if (cacheStr) {
                const cache = JSON.parse(cacheStr) as Training[];
                const upd = cache.map((t) => {
                  if (t.id_local !== training.id_local) return t;
                  const of = Array.isArray(t.offline_pending_files) ? t.offline_pending_files : [];
                  const nextOf = of.filter((x) => x.id !== fileName);
                  return {
                    ...t,
                    offline_pending_files: nextOf,
                    base64_file: '',
                  };
                });
                await AsyncStorage.setItem('trainings_cache', JSON.stringify(upd));
              }
              setTrainings((prev) =>
                prev.map((t) =>
                  t.id_local === training.id_local
                    ? {
                        ...t,
                        offline_pending_files: (t.offline_pending_files || []).filter(
                          (x) => x.id !== fileName
                        ),
                        base64_file: '',
                      }
                    : t
                )
              );
              return;
            }

            const hasConnection = await checkConnection();
            if (hasConnection) {
              const result = await deleteTrainingArchivo({
                trainingId: training.id,
                fileName,
                refreshAccessToken,
                logout,
              });
              if (result.status) {
                setTrainings((prev) =>
                  prev.map((t) =>
                    t.id === training.id
                      ? {
                          ...t,
                          archivos: (t.archivos || []).filter(
                            (a) => getTrainingArchivoStorageName(a) !== fileName
                          ),
                        }
                      : t
                  )
                );
                const cacheStr = await AsyncStorage.getItem('trainings_cache');
                if (cacheStr) {
                  const cache = JSON.parse(cacheStr) as Training[];
                  const u = cache.map((t) =>
                    t.id === training.id
                      ? {
                          ...t,
                          archivos: (t.archivos || []).filter(
                            (a) => getTrainingArchivoStorageName(a) !== fileName
                          ),
                        }
                      : t
                  );
                  await AsyncStorage.setItem('trainings_cache', JSON.stringify(u));
                }
                void fetchTrainingsForCorpoRef.current?.();
              } else {
                Alert.alert('Error', (result as { message?: string }).message || 'No se pudo eliminar');
              }
            } else {
              if (marcaId == null) {
                Alert.alert('Error', 'No se encontró la marca');
                return;
              }
              const actionId = Math.random().toString(36).substring(2, 12);
              const actionsStr = await AsyncStorage.getItem('trainings_actions');
              let act: any[] = actionsStr ? JSON.parse(actionsStr) : [];
              if (!Array.isArray(act)) act = [];
              act.push({
                type: 'delete_file',
                id: actionId,
                trainingId: training.id,
                fileName,
                marcaId: marcaId,
              });
              await AsyncStorage.setItem('trainings_actions', JSON.stringify(act));
              setTrainings((prev) =>
                prev.map((t) =>
                  t.id === training.id
                    ? {
                        ...t,
                        archivos: (t.archivos || []).filter(
                          (a) => getTrainingArchivoStorageName(a) !== fileName
                        ),
                      }
                    : t
                )
              );
              const cacheStr = await AsyncStorage.getItem('trainings_cache');
              if (cacheStr) {
                const cache = JSON.parse(cacheStr) as Training[];
                const u = cache.map((t) =>
                  t.id === training.id
                    ? {
                        ...t,
                        archivos: (t.archivos || []).filter(
                          (a) => getTrainingArchivoStorageName(a) !== fileName
                        ),
                      }
                    : t
                );
                await AsyncStorage.setItem('trainings_cache', JSON.stringify(u));
              }
              Alert.alert('Cola', 'Eliminación de adjunto guardada; se enviará al reconectar.');
            }
          } catch (e) {
            console.error('delete archivo capacitación:', e);
            Alert.alert('Error', 'No se pudo eliminar el adjunto');
          }
        },
      },
    ]);
  };

  const confirmDeleteTraining = (training: Training, trainingKey: string) => {
    if (training.id === 0 && training.id_local) {
      Alert.alert('Eliminar', '¿Eliminar esta capacitación pendiente de sincronización?', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setDeletingTrainingKey(trainingKey);
            try {
              const actionsStr = await AsyncStorage.getItem('trainings_actions');
              const actions = actionsStr ? JSON.parse(actionsStr) : [];
              const list = Array.isArray(actions) ? actions : [];
              const next = list.filter(
                (a: any) =>
                  !(a?.type === 'create' && String(a?.id) === String(training.id_local))
              );
              await AsyncStorage.setItem('trainings_actions', JSON.stringify(next));
              const cacheStr = await AsyncStorage.getItem('trainings_cache');
              const cache = cacheStr ? JSON.parse(cacheStr) : [];
              const nextCache = cache.filter(
                (t: Training) => t.id_local !== training.id_local
              );
              await AsyncStorage.setItem('trainings_cache', JSON.stringify(nextCache));
              setTrainings((prev) => prev.filter((t) => t.id_local !== training.id_local));
              Alert.alert('Éxito', 'Capacitación eliminada correctamente.');
            } finally {
              setDeletingTrainingKey(null);
            }
          },
        },
      ]);
      return;
    }
    Alert.alert('Eliminar', '¿Eliminar esta capacitación? Esta acción no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          setDeletingTrainingKey(trainingKey);
          try {
            const hasConnection = await checkConnection();
            if (!hasConnection) {
              if (marcaId == null) {
                Alert.alert('Error', 'No se encontró la marca actual');
                return;
              }
              const actionId = Math.random().toString(36).substring(2, 12);
              const actionsStr = await AsyncStorage.getItem('trainings_actions');
              let actions: any[] = actionsStr ? JSON.parse(actionsStr) : [];
              if (!Array.isArray(actions)) actions = [];
              actions = appendOfflineTrainingDelete(actions, {
                queueId: actionId,
                trainingId: training.id,
                marcaId,
              });
              await AsyncStorage.setItem('trainings_actions', JSON.stringify(actions));
              const cacheStr = await AsyncStorage.getItem('trainings_cache');
              const cache = cacheStr ? JSON.parse(cacheStr) : [];
              const nextCache = cache.filter((t: Training) => t.id !== training.id);
              await AsyncStorage.setItem('trainings_cache', JSON.stringify(nextCache));
              setTrainings((prev) => prev.filter((t) => t.id !== training.id));
              Alert.alert(
                'Éxito',
                'Eliminación registrada. Se sincronizará con el servidor cuando haya conexión.'
              );
              return;
            }
            const result = await deleteTrainingAPI({
              trainingId: training.id,
              refreshAccessToken,
              logout,
            });
            if (result.status) {
              setTrainings((prev) => prev.filter((t) => t.id !== training.id));
              const cacheStr = await AsyncStorage.getItem('trainings_cache');
              if (cacheStr) {
                const cache = JSON.parse(cacheStr) as Training[];
                const nextCache = cache.filter((t) => t.id !== training.id);
                await AsyncStorage.setItem('trainings_cache', JSON.stringify(nextCache));
              }
              Alert.alert('Éxito', 'Capacitación eliminada correctamente.');
              void fetchTrainingsForCorpoRef.current?.();
            } else {
              Alert.alert('Error', (result as { message?: string }).message || 'No se pudo eliminar');
            }
          } finally {
            setDeletingTrainingKey(null);
          }
        },
      },
    ]);
  };

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'trainings': return <Ionicons name="school" size={25} color='#000000' />;
      case 'add': return <Ionicons name="add" size={24} color='#000000' />;
      case 'cancel': return <Ionicons name="close" size={24} color='#FFFFFF' />;
      case 'confirm': return <Ionicons name="checkmark" size={24} color='#FFFFFF' />;
      case 'signature': return <Ionicons name="finger-print" size={20} color='#000000' />;
      case 'qr': return <Ionicons name="qr-code" size={20} color='#000000' />;
      case 'clear': return <Ionicons name="trash" size={20} color='#000000' />;
      default: return <Ionicons name="school" size={25} color='#000000' />;
    }
  };

  const handleMenuPress = () => {
    setIsMenuVisible(true);
  };

  const handleMenuClose = () => {
    setIsMenuVisible(false);
  };

  const handleHomePress = () => {
    navigation.navigate('Home');
    setIsMenuVisible(false);
  };

  if (isBootstrapping) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader onMenuPress={handleMenuPress} title="Registro de Capacitaciones" />
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Cargando...</ThemedText>
        </ThemedView>
        <AppFooter />
        <SlideMenu
          isVisible={isMenuVisible}
          onClose={handleMenuClose}
          onHomePress={handleHomePress}
        />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <AppHeader onMenuPress={handleMenuPress} title="Registro de Capacitaciones" />
      {!!error && (
        <ThemedView style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={18} color="#B00020" />
          <ThemedText style={styles.errorBannerText}>{error}</ThemedText>
        </ThemedView>
      )}
      {!!offlineMessage && !error && (
        <ThemedView style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={18} color="#8A6D00" />
          <ThemedText style={styles.offlineBannerText}>{offlineMessage}</ThemedText>
        </ThemedView>
      )}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Module Title */}
        <ThemedView style={styles.titleContainer}>
          <ThemedText type="title" style={styles.title}>
            {getActionIcon('trainings')} Capacitaciones
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            Gestiona el registro de capacitaciones
          </ThemedText>
        </ThemedView>

        {/* Filters */}
        {!isCreating && (
          <ThemedView style={styles.filtersContainer}>
            <ThemedView style={styles.filtersHeader}>
              <TouchableOpacity
                style={styles.filterToggleButton}
                onPress={() => setIsFiltersExpanded(!isFiltersExpanded)}
              >
                <ThemedText style={styles.filtersTitle}>
                  Filtros
                </ThemedText>
                <Ionicons
                  name={isFiltersExpanded ? "chevron-up" : "chevron-down"}
                  size={20}
                  color="#007AFF"
                />
              </TouchableOpacity>

              {isFiltersExpanded && (
                <TouchableOpacity
                  style={styles.resetFiltersButton}
                  onPress={resetAllFilters}
                >
                  <Ionicons name="refresh" size={16} color="#FF3B30" />
                  <ThemedText style={styles.resetFiltersText}>Reiniciar</ThemedText>
                </TouchableOpacity>
              )}
            </ThemedView>

            {/* Filter Content */}
            {isFiltersExpanded && (
              <ThemedView style={styles.filtersContent}>
                <HierarchyPickerFields
                  structure={structure}
                  levels={['cliente', 'contrato', 'sucursal']}
                  isLoading={false}
                  emptyPickerValue=""
                  values={{
                    empresaId: filterEmpresaId,
                    clienteId: filterClienteId,
                    divisionId: filterDivisionId,
                    contratoId: filterContratoId,
                    sucursalId: filterCorpoId,
                  }}
                  onChange={handleFilterHierarchyChange}
                  labels={{ sucursal: 'Sucursal' }}
                  renderLabel={(text) => <ThemedText style={styles.filterLabel}>{text}</ThemedText>}
                  pickerStyle={styles.picker}
                  fieldGroupStyle={styles.filterGroup}
                />

                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.filterLabel}>Empleado:</ThemedText>
                  <TextInput
                    style={styles.searchInput}
                    value={filterEmpleado}
                    onChangeText={setFilterEmpleado}
                    placeholder="Filtrar por empleado..."
                    placeholderTextColor="#999"
                  />
                </ThemedView>

                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.filterLabel}>Puesto:</ThemedText>
                  <TextInput
                    style={styles.searchInput}
                    value={filterPuestoNombre}
                    onChangeText={setFilterPuestoNombre}
                    placeholder="Filtrar por nombre de puesto..."
                    placeholderTextColor="#999"
                  />
                </ThemedView>

                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.filterLabel}>Responsable:</ThemedText>
                  <TextInput
                    style={styles.searchInput}
                    value={filterResponsable}
                    onChangeText={setFilterResponsable}
                    placeholder="Filtrar por responsable..."
                    placeholderTextColor="#999"
                  />
                </ThemedView>

                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.filterLabel}>Descripción:</ThemedText>
                  <TextInput
                    style={styles.searchInput}
                    value={filterDescripcion}
                    onChangeText={setFilterDescripcion}
                    placeholder="Filtrar por descripción..."
                    placeholderTextColor="#999"
                  />
                </ThemedView>

                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.filterLabel}>Resultado:</ThemedText>
                  <TextInput
                    style={styles.searchInput}
                    value={filterResultado}
                    onChangeText={setFilterResultado}
                    placeholder="Filtrar por resultado..."
                    placeholderTextColor="#999"
                  />
                </ThemedView>

                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.filterLabel}>Observaciones:</ThemedText>
                  <TextInput
                    style={styles.searchInput}
                    value={filterObservaciones}
                    onChangeText={setFilterObservaciones}
                    placeholder="Filtrar por observaciones..."
                    placeholderTextColor="#999"
                  />
                </ThemedView>

                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.filterLabel}>Fecha:</ThemedText>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowFilterFechaPicker(true)}
                  >
                    <ThemedText style={styles.dateButtonText}>
                      {filterFecha ? formatDateForDisplay(filterFecha) : 'Seleccionar fecha'}
                    </ThemedText>
                    <Ionicons name="calendar-outline" size={20} color="#007AFF" />
                  </TouchableOpacity>
                  {filterFecha && (
                    <TouchableOpacity
                      style={styles.clearDateButton}
                      onPress={() => setFilterFecha('')}
                    >
                      <Ionicons name="close-circle" size={20} color="#FF3B30" />
                      <ThemedText style={styles.clearDateText}>Limpiar fecha</ThemedText>
                    </TouchableOpacity>
                  )}
                </ThemedView>
              </ThemedView>
            )}
          </ThemedView>
        )}

        {/* Create Button */}
        {!isCreating && !error && (
          <TouchableOpacity
            style={styles.createButton}
            onPress={startCreating}
          >
            <ThemedText style={styles.createButtonText}>
              {getActionIcon('add')}
            </ThemedText>
          </TouchableOpacity>
        )}

        {/* Create Form */}
        {isCreating && (
          <ThemedView style={styles.formCard}>
            <ThemedText style={styles.formTitle}>Nueva Capacitación</ThemedText>

            <HierarchyPickerFields
              structure={structure}
              levels={['cliente', 'contrato', 'sucursal', 'puesto']}
              isLoading={false}
              emptyPickerValue=""
              values={{
                empresaId: formEmpresaId,
                clienteId: formClienteId,
                divisionId: formDivisionId,
                contratoId: formContratoId,
                sucursalId: formCorpoId,
                puestoId: formPuestoJerarquiaId,
              }}
              onChange={handleFormHierarchyChange}
              labels={{
                empresa: 'Empresa *',
                cliente: 'Cliente *',
                division: 'División *',
                contrato: 'Contrato *',
                sucursal: 'Sucursal *',
                puesto: 'Puesto (jerarquía) *',
              }}
              renderLabel={(text) => <ThemedText style={styles.formLabel}>{text}</ThemedText>}
              pickerStyle={styles.picker}
              fieldGroupStyle={styles.formGroup}
            />

            {/* Título */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Título de la capacitación *:</ThemedText>
              <TextInput
                style={styles.formInput}
                defaultValue={tituloRef.current}
                onChangeText={(text) => { tituloRef.current = text; }}
                placeholder="Título"
                placeholderTextColor="#999"
                key={`titulo-${formKey}`}
              />
            </ThemedView>

            {/* Descripción */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Descripción de la capacitación *:</ThemedText>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                defaultValue={descripcionRef.current}
                onChangeText={(text) => { descripcionRef.current = text; }}
                placeholder="Descripción"
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
                key={`descripcion-${formKey}`}
              />
            </ThemedView>

            {/* Tipo de capacitación */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Tipo de capacitación *:</ThemedText>
              <ThemedView style={styles.radioGroup}>
                {['Presencial', 'Virtual'].map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={styles.radioOption}
                    onPress={() => setSelectedTipo(option as 'Presencial' | 'Virtual')}
                  >
                    <ThemedView style={[
                      styles.radioCircle,
                      selectedTipo === option && styles.radioCircleSelected
                    ]}>
                      {selectedTipo === option && <ThemedView style={styles.radioInner} />}
                    </ThemedView>
                    <ThemedText style={styles.radioLabel}>{option}</ThemedText>
                  </TouchableOpacity>
                ))}
              </ThemedView>
            </ThemedView>

            {/* Empleados en la capacitación */}
            <ThemedView style={[styles.formGroup]}>
              <ThemedText style={styles.formLabel}>Empleados en la capacitación:</ThemedText>
              <TouchableOpacity
                style={styles.addFileButton}
                onPress={() => setEmployeeSearchModalVisible(true)}
                activeOpacity={0.85}
                accessibilityLabel="Buscar empleado"
              >
                <Ionicons name="search" size={18} color="#007AFF" />
                <ThemedText style={styles.addFileButtonText}>Buscar empleado</ThemedText>
              </TouchableOpacity>
              {selectedEmpleados.length > 0 && (
                <ThemedView style={styles.selectedList}>
                  {selectedEmpleados.map((empleado) => (
                    <ThemedView key={empleado.id} style={styles.selectedItem}>
                      <ThemedText style={styles.selectedItemText}>
                        {empleado.nombre} - {empleado.cedula}
                      </ThemedText>
                      <TouchableOpacity onPress={() => removeEmpleado(empleado.id)}>
                        <Ionicons name="close-circle" size={24} color="#FF3B30" />
                      </TouchableOpacity>
                    </ThemedView>
                  ))}
                </ThemedView>
              )}
            </ThemedView>

            {/* Puestos de la capacitación */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Puestos de la capacitación:</ThemedText>
              <TouchableOpacity
                style={styles.addFileButton}
                onPress={() => setPuestoSearchModalVisible(true)}
                activeOpacity={0.85}
                accessibilityLabel="Buscar puesto"
              >
                <Ionicons name="search" size={18} color="#007AFF" />
                <ThemedText style={styles.addFileButtonText}>Buscar puesto</ThemedText>
              </TouchableOpacity>
              {selectedPuestos.length > 0 && (
                <ThemedView style={styles.selectedList}>
                  {selectedPuestos.map((puesto) => (
                    <ThemedView key={puesto.id} style={styles.selectedItem}>
                      <ThemedText style={styles.selectedItemText}>{puesto.nombre}</ThemedText>
                      <TouchableOpacity onPress={() => removePuesto(puesto.id)}>
                        <Ionicons name="close-circle" size={24} color="#FF3B30" />
                      </TouchableOpacity>
                    </ThemedView>
                  ))}
                </ThemedView>
              )}
            </ThemedView>

            {/* Fecha */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Fecha de la capacitación *:</ThemedText>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowFechaCapacitacionPicker(true)}
              >
                <ThemedText style={styles.dateButtonText}>
                  {formatDateForDisplay(fechaCapacitacion)}
                </ThemedText>
                <Ionicons name="calendar-outline" size={20} color="#007AFF" />
              </TouchableOpacity>
            </ThemedView>

            {/* Resultado */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Resultado (opcional):</ThemedText>
              <ThemedView style={styles.radioGroup}>
                {['Bueno', 'Regular', 'Malo'].map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={styles.radioOption}
                    onPress={() => setSelectedResultado(selectedResultado === option ? '' : option)}
                  >
                    <ThemedView style={[
                      styles.radioCircle,
                      selectedResultado === option && styles.radioCircleSelected
                    ]}>
                      {selectedResultado === option && <ThemedView style={styles.radioInner} />}
                    </ThemedView>
                    <ThemedText style={styles.radioLabel}>{option}</ThemedText>
                  </TouchableOpacity>
                ))}
              </ThemedView>
            </ThemedView>

            {/* Archivos (opcional) — mismo criterio visual que JobManualsScreen: botón + lista por tipo */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Documentos (opcional):</ThemedText>
              <TouchableOpacity
                style={styles.addFileButton}
                onPress={() => void pickTrainingFileByType('document')}
              >
                <Ionicons name="document-text-outline" size={18} color="#007AFF" />
                <ThemedText style={styles.addFileButtonText}>Añadir documento</ThemedText>
              </TouchableOpacity>
              {pendingTrainingFiles.filter((f) => trainingPendingFileIsKind(f, 'document')).length > 0 && (
                <ThemedView style={styles.filesList}>
                  {pendingTrainingFiles
                    .filter((f) => trainingPendingFileIsKind(f, 'document'))
                    .map((pf) => (
                      <ThemedView key={pf.id} style={styles.fileRow}>
                        <Ionicons name="document-text-outline" size={16} color="#007AFF" />
                        <ThemedText numberOfLines={1} style={styles.fileName}>
                          {pf.originalName || pf.localFileName}
                        </ThemedText>
                        <TouchableOpacity
                          onPress={() => {
                            void removePendingTrainingFile(pf);
                          }}
                        >
                          <Ionicons name="trash" size={16} color="#FF3B30" />
                        </TouchableOpacity>
                      </ThemedView>
                    ))}
                </ThemedView>
              )}
            </ThemedView>

            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Imágenes (opcional):</ThemedText>
              <ThemedView style={styles.addFileButtonRow}>
                <TouchableOpacity style={styles.addFileButton} onPress={openCamera}>
                  <Ionicons name="camera" size={18} color="#007AFF" />
                  <ThemedText style={styles.addFileButtonText}>Tomar foto</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.addFileButton}
                  onPress={() => void pickTrainingFileByType('image')}
                >
                  <Ionicons name="image-outline" size={18} color="#007AFF" />
                  <ThemedText style={styles.addFileButtonText}>Añadir imagen</ThemedText>
                </TouchableOpacity>
              </ThemedView>
              {pendingTrainingFiles.filter((f) => trainingPendingFileIsKind(f, 'image')).length > 0 && (
                <ThemedView style={styles.filesList}>
                  {pendingTrainingFiles
                    .filter((f) => trainingPendingFileIsKind(f, 'image'))
                    .map((pf) => {
                      const localUri = getLocalFileDisplayUri(pf.localFileName);
                      return (
                        <ThemedView key={pf.id} style={styles.fileRow}>
                          {localUri ? (
                            <Image
                              source={{ uri: localUri }}
                              style={styles.filePreviewImage}
                              resizeMode="cover"
                            />
                          ) : (
                            <Ionicons name="image-outline" size={16} color="#007AFF" />
                          )}
                          <ThemedText numberOfLines={1} style={styles.fileName}>
                            {pf.originalName || pf.localFileName}
                          </ThemedText>
                          <TouchableOpacity
                            onPress={() => {
                              void removePendingTrainingFile(pf);
                            }}
                          >
                            <Ionicons name="trash" size={16} color="#FF3B30" />
                          </TouchableOpacity>
                        </ThemedView>
                      );
                    })}
                </ThemedView>
              )}
            </ThemedView>

            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Audio (opcional):</ThemedText>
              <TouchableOpacity
                style={styles.addFileButton}
                onPress={() => void pickTrainingFileByType('audio')}
              >
                <Ionicons name="mic-outline" size={18} color="#007AFF" />
                <ThemedText style={styles.addFileButtonText}>Añadir audio</ThemedText>
              </TouchableOpacity>
              {pendingTrainingFiles.filter((f) => trainingPendingFileIsKind(f, 'audio')).length > 0 && (
                <ThemedView style={styles.filesList}>
                  {pendingTrainingFiles
                    .filter((f) => trainingPendingFileIsKind(f, 'audio'))
                    .map((pf) => (
                      <ThemedView key={pf.id} style={styles.fileRow}>
                        <Ionicons name="musical-notes-outline" size={16} color="#007AFF" />
                        <ThemedText numberOfLines={1} style={styles.fileName}>
                          {pf.originalName || pf.localFileName}
                        </ThemedText>
                        <TouchableOpacity
                          onPress={() => {
                            void removePendingTrainingFile(pf);
                          }}
                        >
                          <Ionicons name="trash" size={16} color="#FF3B30" />
                        </TouchableOpacity>
                      </ThemedView>
                    ))}
                </ThemedView>
              )}
            </ThemedView>

            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Video (opcional):</ThemedText>
              <TouchableOpacity
                style={styles.addFileButton}
                onPress={() => void pickTrainingFileByType('video')}
              >
                <Ionicons name="videocam-outline" size={18} color="#007AFF" />
                <ThemedText style={styles.addFileButtonText}>Añadir video</ThemedText>
              </TouchableOpacity>
              {pendingTrainingFiles.filter((f) => trainingPendingFileIsKind(f, 'video')).length > 0 && (
                <ThemedView style={styles.filesList}>
                  {pendingTrainingFiles
                    .filter((f) => trainingPendingFileIsKind(f, 'video'))
                    .map((pf) => (
                      <ThemedView key={pf.id} style={styles.fileRow}>
                        <Ionicons name="videocam-outline" size={16} color="#007AFF" />
                        <ThemedText numberOfLines={1} style={styles.fileName}>
                          {pf.originalName || pf.localFileName}
                        </ThemedText>
                        <TouchableOpacity
                          onPress={() => {
                            void removePendingTrainingFile(pf);
                          }}
                        >
                          <Ionicons name="trash" size={16} color="#FF3B30" />
                        </TouchableOpacity>
                      </ThemedView>
                    ))}
                </ThemedView>
              )}
            </ThemedView>

            {/* Observaciones */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Observaciones:</ThemedText>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                defaultValue={observacionesRef.current}
                onChangeText={(text) => { observacionesRef.current = text; }}
                placeholder="Observaciones"
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
                key={`observaciones-${formKey}`}
              />
            </ThemedView>

            {/* Nombre Responsable */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Nombre del responsable de la capacitación:</ThemedText>
              <TextInput
                style={styles.formInput}
                defaultValue={nombreResponsableRef.current}
                onChangeText={(text) => { nombreResponsableRef.current = text; }}
                placeholder="Nombre del responsable"
                placeholderTextColor="#999"
                key={`nombre-responsable-${formKey}`}
              />
            </ThemedView>

            {/* Cédula Responsable */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Cédula del responsable de la capacitación:</ThemedText>
              <TextInput
                style={styles.formInput}
                defaultValue={cedulaResponsableRef.current}
                onChangeText={(text) => { cedulaResponsableRef.current = text; }}
                placeholder="Cédula del responsable"
                placeholderTextColor="#999"
                key={`cedula-responsable-${formKey}`}
              />
            </ThemedView>

            {/* Firma Responsable */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>
                {editingTraining ? 'Firma del responsable (conservada o nueva):' : 'Firma del responsable *:'}
              </ThemedText>
              {!firmaResponsable ? (
                <ThemedView style={styles.signatureButtons}>
                  <TouchableOpacity
                    style={styles.signatureButton}
                    onPress={generateSignature}
                    disabled={isGeneratingFirma}
                  >
                    {isGeneratingFirma ? (
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
                    onPress={handleScanQR}
                  >
                    {getActionIcon('qr')}
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
                        {firmaResponsable.empleadoDetalle.nombre} {firmaResponsable.empleadoDetalle.primer_apellido} {firmaResponsable.empleadoDetalle.segundo_apellido} ({firmaResponsable.empleadoDetalle.cedula_empleado})
                      </ThemedText>
                    </ThemedView>
                  )}
                  <ThemedText style={styles.signatureInfoText}>Latitud: {firmaResponsable.latitud}</ThemedText>
                  <ThemedText style={styles.signatureInfoText}>Longitud: {firmaResponsable.longitud}</ThemedText>
                  <ThemedText style={styles.signatureInfoText}>Hora actual: {generateDateTime(firmaResponsable.timestamp)}</ThemedText>
                  <TouchableOpacity
                    style={styles.clearSignatureButton}
                    onPress={() => setFirmaResponsable(null)}
                  >
                    <ThemedText style={styles.clearSignatureText}>{getActionIcon('clear')}</ThemedText>
                  </TouchableOpacity>
                </ThemedView>
              )}
            </ThemedView>

            {/* Form Actions */}
            <ThemedView style={styles.formActions}>
              <TouchableOpacity
                style={[styles.formButton, styles.cancelButton]}
                onPress={cancelCreating}
                disabled={isCreateSubmitting}
              >
                <ThemedText style={styles.formButtonText}>
                  {getActionIcon('cancel')}
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.formButton,
                  styles.confirmButton,
                  isCreateSubmitting && { opacity: 0.6 },
                ]}
                onPress={createTraining}
                disabled={isCreateSubmitting}
              >
                {isCreateSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <ThemedText style={styles.formButtonText}>
                    {getActionIcon('confirm')}
                  </ThemedText>
                )}
              </TouchableOpacity>
            </ThemedView>
          </ThemedView>
        )}

        {/* Trainings List */}
        {!isCreating && (
          <ThemedView style={styles.listContainer}>
            {isListLoading ? (
              <ThemedView style={styles.listLoadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <ThemedText style={styles.loadingText}>Cargando capacitaciones...</ThemedText>
              </ThemedView>
            ) : filteredTrainings.length === 0 ? (
              <ThemedText style={styles.emptyText}>
                {trainings.length === 0
                  ? 'No hay capacitaciones registradas'
                  : 'No hay capacitaciones que coincidan con los filtros'}
              </ThemedText>
            ) : (
              filteredTrainings.map((training, index) => {
                // Get decoded firma from Map
                const firmaData = decodedFirmas.get(training.id);

                // Crear una clave única para identificar el training
                const trainingKey = training.id !== 0 ? `training-${training.id}` : (training.id_local ? `training-${training.id_local}` : `training-${index}`);
                const isExpanded = expandedTrainings.has(trainingKey);

                return (
                  <ThemedView key={training.id !== 0 ? training.id : training.id_local || `training-${index}`} style={styles.trainingCard}>
                    {/* Datos visibles por defecto */}
                    <ThemedText style={styles.trainingDetail}>
                      <ThemedText style={styles.trainingLabel}>Título: </ThemedText>
                      <ThemedText style={styles.trainingValue}>{training.titulo}</ThemedText>
                    </ThemedText>
                    <ThemedText style={styles.trainingDetail}>
                      <ThemedText style={styles.trainingLabel}>Fecha: </ThemedText>
                      <ThemedText style={styles.trainingValue}>{formatDateDMY(training.fecha)}</ThemedText>
                    </ThemedText>

                    <ThemedText style={styles.trainingDetail}>
                      <ThemedText style={styles.trainingLabel}>Tipo: </ThemedText>
                      <ThemedText style={styles.trainingValue}>{training.tipo}</ThemedText>
                    </ThemedText>
                    {training.resultado && (
                      <ThemedText style={styles.trainingDetail}>
                        <ThemedText style={styles.trainingLabel}>Resultado: </ThemedText>
                        <ThemedText style={styles.trainingValue}>{training.resultado}</ThemedText>
                      </ThemedText>
                    )}

                    {/* Collapsable Button */}
                    <TouchableOpacity
                      style={styles.collapseButton}
                      onPress={() => toggleTrainingExpanded(trainingKey)}
                    >
                      <ThemedText style={styles.collapseButtonText}>
                        {isExpanded ? 'Ocultar detalles' : 'Ver detalles'}
                      </ThemedText>
                      <Ionicons
                        name={isExpanded ? "chevron-up" : "chevron-down"}
                        size={20}
                        color="#007AFF"
                      />
                    </TouchableOpacity>

                    {/* Collapsable Content */}
                    {isExpanded && (
                      <ThemedView style={styles.collapsableContent}>
                        <ThemedText style={styles.trainingDetail}>
                          <ThemedText style={styles.trainingLabel}>Empresa: </ThemedText>
                          <ThemedText style={styles.trainingValue}>{training.empresa.nombre}</ThemedText>
                        </ThemedText>
                        <ThemedText style={styles.trainingDetail}>
                          <ThemedText style={styles.trainingLabel}>Cliente: </ThemedText>
                          <ThemedText style={styles.trainingValue}>{training.cliente.nombre}</ThemedText>
                        </ThemedText>
                        <ThemedText style={styles.trainingDetail}>
                          <ThemedText style={styles.trainingLabel}>Sucursal: </ThemedText>
                          <ThemedText style={styles.trainingValue}>{training.sucursal.nombre}</ThemedText>
                        </ThemedText>
                        <ThemedText style={styles.trainingDetail}>
                          <ThemedText style={styles.trainingLabel}>Descripción: </ThemedText>
                          <ThemedText style={styles.trainingValue}>{training.descripcion}</ThemedText>
                        </ThemedText>
                        {training.resultado && (
                          <ThemedText style={styles.trainingDetail}>
                            <ThemedText style={styles.trainingLabel}>Resultado: </ThemedText>
                            <ThemedText style={styles.trainingValue}>{training.resultado}</ThemedText>
                          </ThemedText>
                        )}
                        <ThemedText style={styles.trainingDetail}>
                          <ThemedText style={styles.trainingLabel}>Observaciones: </ThemedText>
                          <ThemedText style={styles.trainingValue}>{training.observaciones}</ThemedText>
                        </ThemedText>
                        <ThemedText style={styles.trainingDetail}>
                          <ThemedText style={styles.trainingLabel}>Responsable: </ThemedText>
                          <ThemedText style={styles.trainingValue}>{training.responsable.nombre} ({training.responsable.cedula})</ThemedText>
                        </ThemedText>
                        {firmaData && (
                          <ThemedView style={styles.signatureInfo}>
                            <ThemedText style={styles.signatureInfoTitle}>Firma:</ThemedText>
                            <ThemedText style={styles.signatureInfoText}>ID de sesión: {firmaData.sessionId}</ThemedText>
                            <ThemedText style={styles.signatureInfoText}>ID del empleado: {firmaData.empleadoId}</ThemedText>
                            {firmaData.empleadoDetalle && (
                              <ThemedView style={styles.signatureInfoDetail}>
                                <ThemedText style={styles.signatureInfoDetailText}>
                                  {firmaData.empleadoDetalle.nombre} {firmaData.empleadoDetalle.primer_apellido} {firmaData.empleadoDetalle.segundo_apellido}
                                </ThemedText>
                              </ThemedView>
                            )}
                            <ThemedText style={styles.signatureInfoText}>Latitud: {firmaData.latitud}</ThemedText>
                            <ThemedText style={styles.signatureInfoText}>Longitud: {firmaData.longitud}</ThemedText>
                            <ThemedText style={styles.signatureInfoText}>Hora: {generateDateTime(firmaData.timestamp)}</ThemedText>
                            {training.nombre_firma && (
                              <ThemedText style={styles.signatureInfoText}>Nombre: {training.nombre_firma}</ThemedText>
                            )}
                          </ThemedView>
                        )}
                        <ThemedView style={styles.detailSection}>
                          <ThemedText style={styles.detailSectionTitle}>Empleados:</ThemedText>
                          {training.empleados.map((emp) => (
                            <ThemedText key={emp.id} style={styles.detailItem}>
                              {emp.nombre} - {emp.cedula}
                            </ThemedText>
                          ))}
                        </ThemedView>
                        <ThemedView style={styles.detailSection}>
                          <ThemedText style={styles.detailSectionTitle}>Puestos:</ThemedText>
                          {training.puestos.map((puesto) => (
                            <ThemedText key={puesto.id} style={styles.detailItem}>
                              {puesto.nombre}
                            </ThemedText>
                          ))}
                        </ThemedView>
                        <ThemedView style={styles.detailSection}>
                          <ThemedText style={styles.detailSectionTitle}>Archivos:</ThemedText>
                          {training.id !== 0 && (training.archivos && training.archivos.length > 0) ? (
                            <ThemedView style={styles.archivosGrid}>
                              {training.archivos.map((a) => {
                                const label = a.original_name || a.originalName || a.name;
                                const kind = getTrainingArchivoMediaKind(a);
                                const displayUri = buildTrainingArchivoUrl(training.id, a);
                                const tileStyle =
                                  kind === 'video' || kind === 'audio'
                                    ? [styles.archivoTile, styles.archivoTileWide]
                                    : styles.archivoTile;
                                return (
                                <ThemedView
                                  key={`${a.id ?? 0}-${getTrainingArchivoStorageName(a) || 'f'}`}
                                  style={tileStyle}
                                >
                                  {kind === 'image' && displayUri ? (
                                    <Image
                                      source={{ uri: displayUri }}
                                      style={styles.trainingImage}
                                      resizeMode="contain"
                                    />
                                  ) : kind === 'audio' && displayUri ? (
                                    <CapacitacionArchivoAudioPlayer sourceUrl={displayUri} label={label} />
                                  ) : kind === 'video' && displayUri ? (
                                    <CapacitacionArchivoVideoPlayer sourceUrl={displayUri} />
                                  ) : (
                                    <ThemedView style={styles.docPlaceholder}>
                                      <Ionicons name="document-text-outline" size={32} color="#007AFF" />
                                      <ThemedText numberOfLines={2} style={styles.docNameText}>
                                        {label}
                                      </ThemedText>
                                      <TouchableOpacity
                                        onPress={() => {
                                          if (displayUri) void Linking.openURL(displayUri);
                                          else Alert.alert('Aviso', 'No hay URL para descargar este archivo.');
                                        }}
                                      >
                                        <ThemedText style={styles.openLinkText}>Descargar</ThemedText>
                                      </TouchableOpacity>
                                    </ThemedView>
                                  )}
                                  <TouchableOpacity
                                    style={styles.trashOnTile}
                                    onPress={() =>
                                      confirmDeleteArchivo(
                                        training,
                                        getTrainingArchivoStorageName(a) || a.name
                                      )
                                    }
                                  >
                                    <Ionicons name="trash" size={18} color="#B00020" />
                                  </TouchableOpacity>
                                </ThemedView>
                                );
                              })}
                            </ThemedView>
                          ) : null}
                          {training.id === 0 &&
                          training.offline_pending_files &&
                          training.offline_pending_files.length > 0 ? (
                            <ThemedView style={styles.archivosGrid}>
                              {training.offline_pending_files.map((pf) => {
                                const ext = (pf.extension || '').toLowerCase();
                                const isImg = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
                                const u = getLocalFileDisplayUri(pf.localFileName);
                                return (
                                <ThemedView key={pf.id} style={styles.archivoTile}>
                                  {isImg && u ? (
                                    <Image source={{ uri: u }} style={styles.trainingImage} />
                                  ) : (
                                    <ThemedText style={styles.noImageText}>
                                      {pf.originalName || 'Documento (pendiente)'}
                                    </ThemedText>
                                  )}
                                  <TouchableOpacity
                                    style={styles.trashOnTile}
                                    onPress={() => confirmDeleteArchivo(training, pf.id)}
                                  >
                                    <Ionicons name="trash" size={18} color="#B00020" />
                                  </TouchableOpacity>
                                </ThemedView>
                                );
                              })}
                            </ThemedView>
                          ) : null}
                          {(!training.archivos || training.archivos.length === 0) &&
                            (!training.offline_pending_files || training.offline_pending_files.length === 0) &&
                            training.id !== 0 && (
                            <TrainingImageComponent trainingId={training.id} />
                          )}
                          {training.id === 0 &&
                            (!training.offline_pending_files || training.offline_pending_files.length === 0) &&
                            training.base64_file &&
                            training.base64_file.trim() !== '' && (
                              <Image
                                source={{
                                  uri: training.base64_file.startsWith('data:')
                                    ? training.base64_file
                                    : `data:image/jpeg;base64,${training.base64_file}`,
                                }}
                                style={styles.trainingImage}
                              />
                            )}
                        </ThemedView>
                      </ThemedView>
                    )}

                    <ThemedView style={styles.cardActionsRow}>
                      {training.id > 0 && (
                        <TouchableOpacity
                          style={styles.trainingEditButton}
                          onPress={() => openEditTraining(training)}
                        >
                          <Ionicons name="pencil" size={18} color="#FFFFFF" />
                          <ThemedText style={styles.trainingEditButtonText}>Editar</ThemedText>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={[
                          styles.trainingDeleteButton,
                          deletingTrainingKey === trainingKey && styles.trainingDeleteButtonDisabled,
                        ]}
                        onPress={() => confirmDeleteTraining(training, trainingKey)}
                        disabled={deletingTrainingKey !== null}
                      >
                        {deletingTrainingKey === trainingKey ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
                            <ThemedText style={styles.trainingDeleteButtonText}>Eliminar</ThemedText>
                          </>
                        )}
                      </TouchableOpacity>
                    </ThemedView>
                  </ThemedView>
                );
              })
            )}
          </ThemedView>
        )}
      </ScrollView>

      {showFechaCapacitacionPicker && (
        <DateTimePicker
          value={fechaCapacitacion ? new Date(fechaCapacitacion) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleFechaCapacitacionChange}
        />
      )}

      {showFilterFechaPicker && (
        <DateTimePicker
          value={filterFecha ? new Date(filterFecha) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleFilterFechaChange}
        />
      )}

      <AppFooter />
      <SlideMenu
        isVisible={isMenuVisible}
        onClose={handleMenuClose}
        onHomePress={handleHomePress}
      />
      <EmployeeSearchModal
        visible={employeeSearchModalVisible}
        structure={structure}
        onClose={() => setEmployeeSearchModalVisible(false)}
        onSelect={handleTrainingEmployeeSearchSelect}
      />
      <PuestoSearchModal
        visible={puestoSearchModalVisible}
        structure={structure}
        onClose={() => setPuestoSearchModalVisible(false)}
        onSelect={handleTrainingPuestoSearchSelect}
      />
      {QRScannerComponent}

      {/* Camera Modal */}
      <Modal
        visible={isCameraVisible}
        animationType="slide"
        onRequestClose={() => setIsCameraVisible(false)}
      >
        <ThemedView style={{ flex: 1, backgroundColor: '#000' }}>
          <CameraView
            ref={cameraRef}
            style={{ flex: 1 }}
            facing="back"
          >
            <TouchableOpacity
              style={styles.cameraCloseButton}
              onPress={() => setIsCameraVisible(false)}
            >
              <Ionicons name="close" size={30} color="#000000" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cameraCaptureButton}
              onPress={takePicture}
            >
              <ThemedView style={styles.cameraCaptureButtonInner} />
            </TouchableOpacity>
          </CameraView>
        </ThemedView>
      </Modal>
    </ThemedView>
  );
}

// Carga un adjunto desde get-image: con `fileName` usa /get-image/[file] (igual que Job Manuals); sin nombre, ruta legada (campo `file` único).
const TrainingImageComponent: React.FC<{ trainingId: number; fileName?: string }> = ({
  trainingId,
  fileName,
}) => {
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { refreshAccessToken, logout, accessToken } = useAuth();
  const appendTokenToUrl = (url: string) => {
    if (!url) return '';
    if (!accessToken || accessToken.trim().length === 0) return url;
    if (/[?&]token=/.test(url)) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}token=${encodeURIComponent(accessToken)}`;
  };

  useEffect(() => {
    const fetchImage = async () => {
      try {
        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) return;
        const getImagePath =
          fileName && String(fileName).trim() !== ''
            ? `${apiUrl}/api/training/${trainingId}/get-image/${encodeURIComponent(String(fileName).trim())}`
            : `${apiUrl}/api/training/${trainingId}/get-image`;
        const response = await authedFetch({
          url: appendTokenToUrl(getImagePath),
          init: {
            method: 'GET',
          },
          refreshAccessToken,
          logout,
        });
        if (!response) return;

        if (response.ok) {
          const ct = response.headers.get('content-type') || '';
          if (!ct.startsWith('image/')) {
            setImageBase64(null);
            return;
          }
          const blob = await response.blob();
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64data = reader.result as string;
            setImageBase64(base64data);
          };
          reader.readAsDataURL(blob);
        }
      } catch (error) {
        console.error('Error loading training image:', error);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchImage();
  }, [trainingId, fileName]);

  if (isLoading) {
    return <ActivityIndicator size="small" color="#007AFF" />;
  }

  if (!imageBase64) {
    return <ThemedText style={styles.noImageText}>No hay imagen adjunta</ThemedText>;
  }

  return (
    <Image
      source={{ uri: imageBase64 }}
      style={styles.trainingImage}
      onError={(error) => {
        console.error('Error loading image:', error);
      }}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F5C2C7',
    backgroundColor: '#F8D7DA',
  },
  errorBannerText: {
    flex: 1,
    color: '#B00020',
    fontSize: 14,
    fontWeight: '600',
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFEBAA',
    backgroundColor: '#FFF3CD',
  },
  offlineBannerText: {
    flex: 1,
    color: '#8A6D00',
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
  },
  createButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#000000',
  },
  formGroup: {
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#000000',
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    color: '#000000',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  picker: {
    width: '100%',
    height: 50,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#000000',
  },
  radioGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#fff',
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
    marginBottom: 10,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#007AFF',
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  radioCircleSelected: {
    backgroundColor: '#fff',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#007AFF',
  },
  radioLabel: {
    fontSize: 16,
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
  signatureInfoDetailText: {
    fontSize: 12,
    color: '#000000',
  },
  signatureInfoDetail: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#BDE4FF',
    borderRadius: 8,
    marginBottom: 4,
  },
  clearSignatureButton: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#FF3B30',
    borderRadius: 6,
    alignItems: 'center',
    width: '100%',
  },
  clearSignatureText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 10,
    backgroundColor: '#fff',
  },
  formButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#FF3B30',
  },
  confirmButton: {
    backgroundColor: '#34C759',
  },
  formButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  listContainer: {
    width: '100%',
  },
  listLoadingContainer: {
    minHeight: 200,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
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
  filtersContainer: {
    width: '100%',
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
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
  filterGroup: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
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
  clearDateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  clearDateText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF3B30',
  },
  trainingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  trainingEditButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    flex: 1,
    minWidth: 120,
  },
  trainingEditButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  trainingDeleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    flex: 1,
    minWidth: 120,
  },
  trainingDeleteButtonDisabled: {
    opacity: 0.65,
  },
  trainingDeleteButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  trainingTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#007AFF',
  },
  trainingDetail: {
    fontSize: 14,
    marginBottom: 8,
    color: '#000000',
  },
  trainingLabel: {
    fontWeight: '600',
    color: '#000000',
  },
  trainingValue: {
    fontSize: 12,
    color: '#000000',
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#999',
    marginTop: 40,
  },
  collapseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    marginTop: 8,
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  collapseButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  collapsableContent: {
    padding: 12,
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    marginTop: 8,
  },
  addButton: {
    backgroundColor: '#34C759',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  selectedList: {
    marginTop: 12,
    gap: 8,
    backgroundColor: '#fff',
  },
  selectedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  selectedItemText: {
    fontSize: 14,
    color: '#000000',
    flex: 1,
  },
  addFileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#F8F9FA',
  },
  addFileButtonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  addFileButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  filesList: {
    marginTop: 8,
    gap: 6,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fileName: {
    flex: 1,
    fontSize: 13,
    color: '#333333',
  },
  filePreviewImage: {
    width: 40,
    height: 40,
    borderRadius: 4,
    backgroundColor: '#F0F0F0',
  },
  removeImageButton: {
    backgroundColor: '#FF3B30',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
  },
  removeImageText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  cameraCloseButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
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
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
  },
  trainingImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginTop: 8,
  },
  noImageText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 8,
  },
  detailSection: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  detailSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000000',
  },
  detailItem: {
    fontSize: 14,
    color: '#000000',
    marginBottom: 4,
    paddingLeft: 8,
  },
  archivosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  archivoTile: {
    position: 'relative',
    width: '100%',
    maxWidth: 280,
  },
  archivoTileWide: {
    maxWidth: '100%',
  },
  audioPlayerContainer: {
    marginVertical: 8,
    backgroundColor: '#fff',
  },
  audioLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    color: '#000000',
  },
  audioPlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  playButton: {
    padding: 6,
  },
  audioTime: {
    fontSize: 13,
    fontWeight: '500',
    color: '#007AFF',
    flex: 1,
  },
  resetAudioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#007AFF',
  },
  trashOnTile: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 14,
    padding: 6,
    zIndex: 2,
  },
  docPlaceholder: {
    padding: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  docNameText: {
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
  },
  openLinkText: {
    color: '#007AFF',
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
  },
});

/** Misma idea que JobManualsScreen: reproductor con URL autenticada (token en query). */
function CapacitacionArchivoAudioPlayer({ sourceUrl, label }: { sourceUrl: string; label?: string }) {
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
      console.error('Error controlling training audio player:', error);
    }
  };

  const resetAudio = () => {
    if (!player) return;
    try {
      player.seekTo(0);
      player.pause();
      setIsPlaying(false);
    } catch (error) {
      console.error('Error resetting training audio player:', error);
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
      {label ? <ThemedText style={styles.audioLabel}>{label}</ThemedText> : null}
      <ThemedView style={styles.audioPlayer}>
        <TouchableOpacity style={styles.playButton} onPress={togglePlayPause}>
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={22} color="#007AFF" />
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

function CapacitacionArchivoVideoPlayer({ sourceUrl }: { sourceUrl: string }) {
  const player = useVideoPlayer(sourceUrl);
  const maxW = Dimensions.get('window').width - 64;

  return (
    <View
      style={{
        marginBottom: 8,
        overflow: 'hidden',
        borderRadius: 8,
        backgroundColor: '#000000',
        width: maxW,
        maxWidth: '100%',
        alignSelf: 'center',
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
        nativeControls
        allowsFullscreen={false}
        allowsPictureInPicture={false}
      />
    </View>
  );
}

