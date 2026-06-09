import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
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
import HierarchyPickerFields, { type HierarchyPickerValues } from '@/components/HierarchyPickerFields';
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
import getCurrentUserDigitalSignature from '@/hooks/getCurrentUserDigitalSignature';
import { useQRScanner } from '@/hooks/useQRScanner';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import { createComplaintsMaster, updateComplaintsMaster, deleteComplaintsMaster, deleteComplaintsMasterFile, listComplaintsMasterByCorpo } from '@/hooks/evaluationFunctions';
import { eventBus } from '@/hooks/eventBus';
import getHoraAccion from '@/hooks/getHoraAccion';
import authedFetch from '@/hooks/authedFetch';
import getValidAccessTokenOrLogout from '@/hooks/getValidAccessTokenOrLogout';
import { convertDateTimestampToLocalString } from '@/hooks/convertDateTimestampToLocalString';
import { loadMainStructureTreeMerged } from '@/hooks/bitacoraMainStructureCache';
import {
  complaintCacheCorpoId,
  COMPLAINTS_MASTER_CACHE_TYPE,
  mergeComplaintsMasterServerIntoCacheForCorpo,
  loadComplaintsMasterRowsForCorpo,
  appendComplaintsMasterToCache,
  patchComplaintsMasterRowByRecordId,
  removeComplaintsMasterRowByRecordId,
  patchComplaintsMasterFilesForRecord,
  upsertComplaintsMasterRowInCache,
  complaintsMasterIsPendingLocal,
} from '@/hooks/complaintsMasterCacheStorage';
import {
  buildArchivoStorageListFromLocalAttachments,
  materializeComplaintLocalFilesForOffline,
  resolveComplaintsMasterArchivosForApiRequest,
  clearComplaintsMasterPendingFilesFromArchivoList,
  parseComplaintsMasterArchivosFromPayload,
  normalizeServerFilesForComplaintCache,
  complaintCacheFilesFromArchivoEntries,
  deleteComplaintsMasterLocalFileUri,
  downloadComplaintsMasterServerFileToLocal,
} from '@/hooks/complaintsMasterFilesSync';
import { deleteFile, saveFile, getLocalFileDisplayUri, type StoredFileType } from '@/hooks/fileStorage';
import * as DocumentPicker from 'expo-document-picker';

const COMPLAINTS_MASTER_FILE_STORAGE_PREFIX = 'complaints_master';
const COMPLAINTS_MASTER_DEBUG_LOG = '[ComplaintsMaster]';

function complaintsMasterDocumentPickerTypes(type: 'image' | 'audio' | 'video' | 'document'): string | string[] {
  switch (type) {
    case 'image':
      return ['image/*'];
    case 'audio':
      return ['audio/*'];
    case 'video':
      return ['video/*'];
    default:
      return [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        'text/csv',
      ];
  }
}

function complaintsMasterArchivosLogPreview(list: Record<string, unknown>[]) {
  return (list || []).map((a) => ({
    type: a?.type,
    original_name: a?.original_name,
    local_file_uri: a?.local_file_uri,
    stored_file_name: a?.stored_file_name,
    has_file_base64: typeof a?.file_base64 === 'string' && String(a.file_base64).length > 0,
  }));
}

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
  tipo_cliente: string | null;
  tipo_queja: string | null;
  estimacion_dannio: string | null;
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
  corpo_id?: number | null;
  empresa_id?: number | null;
  cliente_id?: number | null;
  contrato_id?: number | null;
  puesto_id?: number | null;
  plaza_id?: number | null;
  division_id?: number | null;
  isActive?: boolean | null;
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
  tipo_cliente: string;
  tipo_queja: string;
  estimacion_dannio: string;
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
  /** Ruta en documentDirectory (sin prefijo file://) para adjuntos offline / pre-sync. */
  local_uri?: string;
  /** Nombre bajo `Paths.document` (adjuntos locales / sincronización). */
  stored_file_name?: string;
};

type LocalFile = {
  id: string;
  type: 'image' | 'audio' | 'video' | 'document';
  name: string;
  extension: string;
  /** Solo para vistas previas puntuales; persistencia = `uri` en disco (binario). */
  base64?: string;
  uri?: string;
  mimeType?: string;
  /** Nombre bajo `Paths.document` devuelto por `saveFile`. */
  storedFileName?: string;
  server_file_id?: number; // para archivos existentes precargados (c_anexos_quejas.id)
};

/** Catálogos persistidos en AsyncStorage por `MarcarIngresoSalidaScreen` (`tipo_clientes_quejas_cache`, `tipo_quejas_cache`). */
type TipoCatalogoQuejaItem = { id: number; nombre: string };

const LEGACY_TIPO_CLIENTE_QUEJA_OPTIONS: TipoCatalogoQuejaItem[] = [
  { id: -1, nombre: 'Publico' },
  { id: -2, nombre: 'Privado' },
  { id: -3, nombre: 'Interno' },
];

function parseTipoCatalogoQuejasCache(raw: string | null): TipoCatalogoQuejaItem[] {
  if (raw == null || String(raw).trim() === '') return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: TipoCatalogoQuejaItem[] = [];
    for (const x of parsed) {
      if (x == null || typeof x !== 'object') continue;
      const o = x as Record<string, unknown>;
      const id = Number(o.id);
      const nombre = o.nombre != null ? String(o.nombre).trim() : '';
      if (!Number.isFinite(id) || nombre === '') continue;
      out.push({ id, nombre });
    }
    return out;
  } catch {
    return [];
  }
}

/** Evita peticiones duplicadas a tipo-quejas / tipo-clientes (p. ej. re-renders o Strict Mode). */
let tipoCatalogosServerFetchPromise: Promise<void> | null = null;

async function readDefaultTipoClienteYQuejaFromCaches(): Promise<{ tipoCliente: string; tipoQueja: string }> {
  let tipoCliente = 'Publico';
  let tipoQueja = 'Publico';
  try {
    const [rawC, rawQ] = await Promise.all([
      AsyncStorage.getItem('tipo_clientes_quejas_cache'),
      AsyncStorage.getItem('tipo_quejas_cache'),
    ]);
    const listC = parseTipoCatalogoQuejasCache(rawC);
    const listQ = parseTipoCatalogoQuejasCache(rawQ);
    if (listC.length > 0) tipoCliente = listC[0].nombre;
    if (listQ.length > 0) tipoQueja = listQ[0].nombre;
  } catch {
    /* defaults */
  }
  return { tipoCliente, tipoQueja };
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
  };
}

const buildComplaintFileUrl = (complaintId: string | number, file: ComplaintFile, accessToken?: string | null) => {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) return '';
  const idNum = typeof complaintId === 'number' ? complaintId : parseInt(String(complaintId), 10);
  if (!Number.isFinite(idNum) || idNum <= 0) return '';
  const enc = encodeURIComponent(file.name);
  const appendTokenToUrl = (url: string) => {
    if (!accessToken || accessToken.trim().length === 0) return url;
    if (/[?&]token=/.test(url)) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}token=${encodeURIComponent(accessToken)}`;
  };
  let base: string;
  if (file.type === 'image') base = `${apiUrl}/api/complaints-master/${idNum}/get-image/${enc}`;
  else if (file.type === 'audio') base = `${apiUrl}/api/complaints-master/${idNum}/get-audio/${enc}`;
  else if (file.type === 'video') base = `${apiUrl}/api/complaints-master/${idNum}/get-video/${enc}`;
  else base = `${apiUrl}/api/complaints-master/${idNum}/get-file/${enc}`;
  const withToken = appendTokenToUrl(base);
  const sep = withToken.includes('?') ? '&' : '?';
  return `${withToken}${sep}t=${Date.now()}`;
};

const getComplaintFileDisplayName = (file: ComplaintFile) => {
  if (file.original_name && String(file.original_name).trim().length > 0) return String(file.original_name);
  return file.name;
};

function normalizeLocalMediaUri(pathOrUri: string): string {
  const raw = String(pathOrUri || '').trim();
  if (!raw) return '';
  const without = raw.replace(/^file:\/\//, '');
  return `file://${without}`;
}

function resolveComplaintFileMediaUri(
  complaintId: string | number,
  file: ComplaintFile,
  accessToken?: string | null
): string {
  const loc = file.local_uri;
  if (loc != null && String(loc).trim() !== '') {
    return normalizeLocalMediaUri(String(loc));
  }
  return buildComplaintFileUrl(complaintId, file, accessToken);
}

type ComplaintsStructureTree = { id: number; codigo?: string; nombre: string; clientes?: any[] }[];

const getComplaintsMarcaDivisionIdFromCurrent = (current: any): number | null => {
  const raw =
    current?.roleDivision?.division?.id ??
    current?.role_division?.division?.id ??
    current?.division?.id ??
    current?.division_id;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const resolveComplaintsDivisionInTree = (
  tree: ComplaintsStructureTree,
  empresaId: number | null,
  clienteId: number | null,
  divisionId: number | null
): number | null => {
  if (!Array.isArray(tree) || tree.length === 0 || divisionId == null) return divisionId;
  const empresa = tree.find((e) => Number(e?.id) === Number(empresaId));
  const clientes = Array.isArray(empresa?.clientes) ? empresa.clientes : [];
  const cliente = clientes.find((c) => Number(c?.id) === Number(clienteId));
  const divisiones = Array.isArray(cliente?.division) ? cliente.division : [];
  if (divisiones.some((d: { id?: number }) => Number(d?.id) === Number(divisionId))) return divisionId;
  return null;
};

const findContratoIdForSucursalInTree = (
  tree: ComplaintsStructureTree,
  sucursalId: number | null
): number | null => {
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

/** c_maestro_quejas no guarda division_id; se deduce del árbol con empresa/cliente/contrato/corpo. */
const resolveDivisionIdForComplaintPath = (
  tree: ComplaintsStructureTree,
  empresaId: number | null,
  clienteId: number | null,
  contratoId: number | null,
  corpoId: number | null
): number | null => {
  if (empresaId == null || clienteId == null || contratoId == null || corpoId == null) return null;
  const empresa = tree.find((e) => Number(e?.id) === Number(empresaId));
  if (!empresa) return null;
  const clientes = Array.isArray(empresa.clientes) ? empresa.clientes : [];
  const cliente = clientes.find((c) => Number(c?.id) === Number(clienteId));
  if (!cliente) return null;
  const divisiones = Array.isArray((cliente as { division?: unknown[] }).division)
    ? (cliente as { division: any[] }).division
    : [];
  for (const division of divisiones) {
    const contratos = Array.isArray(division?.contratos) ? division.contratos : [];
    const contrato = contratos.find((c: any) => Number(c?.id) === Number(contratoId));
    if (!contrato) continue;
    const sucursales = Array.isArray(contrato.sucursales) ? contrato.sucursales : [];
    if (sucursales.some((s: any) => Number(s?.id) === Number(corpoId))) {
      return Number(division.id);
    }
  }
  return null;
};

function findSucursalNodeInFormPath(
  tree: ComplaintsStructureTree,
  empresaId: number | null,
  clienteId: number | null,
  divisionId: number | null,
  contratoId: number | null,
  corpoId: number | null
): { puestos?: { id: number; nombre: string; plazas?: { id: number; nombre: string }[] }[] } | null {
  if (empresaId == null || clienteId == null || divisionId == null || contratoId == null || corpoId == null) {
    return null;
  }
  const e = tree.find((x) => Number(x?.id) === Number(empresaId));
  if (!e) return null;
  const c = (e.clientes || []).find((x: any) => Number(x?.id) === Number(clienteId));
  if (!c) return null;
  const div = (c.division || []).find((x: any) => Number(x?.id) === Number(divisionId));
  if (!div) return null;
  const con = (div.contratos || []).find((x: any) => Number(x?.id) === Number(contratoId));
  if (!con) return null;
  return (con.sucursales || []).find((s: any) => Number(s?.id) === Number(corpoId)) || null;
}

export default function ComplaintsMasterScreen() {
  const { employee, refreshAccessToken, logout, accessToken } = useAuth();
  const [queryAccessToken, setQueryAccessToken] = useState('');
  const refreshQueryAccessToken = useCallback(async () => {
    try {
      const t = await getValidAccessTokenOrLogout({ refreshAccessToken, logout });
      setQueryAccessToken(t != null && String(t).trim() !== '' ? String(t).trim() : '');
    } catch {
      setQueryAccessToken('');
    }
  }, [refreshAccessToken, logout]);

  useEffect(() => {
    void refreshQueryAccessToken();
  }, [accessToken, refreshQueryAccessToken]);

  const effectiveMediaToken = useMemo(() => {
    const a = accessToken != null ? String(accessToken).trim() : '';
    const q = queryAccessToken.trim();
    return a || q || null;
  }, [accessToken, queryAccessToken]);

  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<ComplaintsMasterScreenNavigationProp>();
  const { scanQR, QRScannerComponent } = useQRScanner();

  // Data states
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [isListLoading, setIsListLoading] = useState(false);
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
  const [tipoCliente, setTipoCliente] = useState('');
  const [tipoQueja, setTipoQueja] = useState('');
  /** Listas desde AsyncStorage (`MarcarIngresoSalidaScreen`): `tipo_clientes_quejas_cache`, `tipo_quejas_cache`. */
  const [tipoClientesQuejasCache, setTipoClientesQuejasCache] = useState<TipoCatalogoQuejaItem[]>([]);
  const [tipoQuejasCache, setTipoQuejasCache] = useState<TipoCatalogoQuejaItem[]>([]);
  const [estimacionDannio, setEstimacionDannio] = useState('');
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
  /** Solo archivos **nuevos** en el formulario (se muestran al usuario). */
  const [imageFiles, setImageFiles] = useState<LocalFile[]>([]);
  const [audioFiles, setAudioFiles] = useState<LocalFile[]>([]);
  const [videoFiles, setVideoFiles] = useState<LocalFile[]>([]);
  const [documentFiles, setDocumentFiles] = useState<LocalFile[]>([]);
  /** Al editar: adjuntos ya existentes, precargados para el PUT; no se listan en la UI. */
  const [preservedImageFiles, setPreservedImageFiles] = useState<LocalFile[]>([]);
  const [preservedAudioFiles, setPreservedAudioFiles] = useState<LocalFile[]>([]);
  const [preservedVideoFiles, setPreservedVideoFiles] = useState<LocalFile[]>([]);
  const [preservedDocumentFiles, setPreservedDocumentFiles] = useState<LocalFile[]>([]);
  const [isPreloadingEditFiles, setIsPreloadingEditFiles] = useState(false);

  const allPickedFilesRef = useRef<LocalFile[]>([]);
  useEffect(() => {
    allPickedFilesRef.current = [...imageFiles, ...audioFiles, ...videoFiles, ...documentFiles];
  }, [imageFiles, audioFiles, videoFiles, documentFiles]);

  const discardQueuedPickedFilesWithSnapshot = (snapshot: LocalFile[]) => {
    void (async () => {
      
    })();
  };

  const buildArchivosPersistList = (): Record<string, unknown>[] =>
    buildArchivoStorageListFromLocalAttachments(imageFiles, audioFiles, videoFiles, documentFiles);

  /** Incluye “preservados” (edición) + nuevos; el servidor sustituye todos los anexos. */
  const buildArchivosPersistListForUpdate = (): Record<string, unknown>[] => {
    const fromPreserved = buildArchivoStorageListFromLocalAttachments(
      preservedImageFiles,
      preservedAudioFiles,
      preservedVideoFiles,
      preservedDocumentFiles
    );
    const fromNew = buildArchivoStorageListFromLocalAttachments(
      imageFiles,
      audioFiles,
      videoFiles,
      documentFiles
    );
    return [...fromPreserved, ...fromNew];
  };

  const materializeArchivosForOfflineStorage = () =>
    materializeComplaintLocalFilesForOffline(imageFiles, audioFiles, videoFiles, documentFiles);

  const materializeArchivosForOfflineUpdate = () =>
    materializeComplaintLocalFilesForOffline(
      [...preservedImageFiles, ...imageFiles],
      [...preservedAudioFiles, ...audioFiles],
      [...preservedVideoFiles, ...videoFiles],
      [...preservedDocumentFiles, ...documentFiles]
    );

  const localImagePreviewSource = (file: LocalFile) =>
    file.uri
      ? { uri: file.uri }
      : { uri: `data:image/${file.extension || 'jpeg'};base64,${file.base64 ?? ''}` };

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

  type RoleName = 'OPERATIVO' | 'SUPERVISOR' | 'ADMINISTRATIVO' | string | null;
  const [roleName, setRoleName] = useState<RoleName>(null);
  const [structure, setStructure] = useState<ComplaintsStructureTree>([]);
  const [isStructureLoading, setIsStructureLoading] = useState(false);
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  const [filterEmpresaId, setFilterEmpresaId] = useState<number | null>(null);
  const [filterClienteId, setFilterClienteId] = useState<number | null>(null);
  const [filterDivisionId, setFilterDivisionId] = useState<number | null>(null);
  const [filterContratoId, setFilterContratoId] = useState<number | null>(null);
  const [filterCorpoId, setFilterCorpoId] = useState<number | null>(null);
  const [marcaEmpresaId, setMarcaEmpresaId] = useState<number | null>(null);
  const [marcaClienteId, setMarcaClienteId] = useState<number | null>(null);
  const [marcaDivisionId, setMarcaDivisionId] = useState<number | null>(null);
  const [marcaContratoId, setMarcaContratoId] = useState<number | null>(null);
  const [marcaCorpoId, setMarcaCorpoId] = useState<number | null>(null);

  const [formEmpresaId, setFormEmpresaId] = useState<number | null>(null);
  const [formClienteId, setFormClienteId] = useState<number | null>(null);
  const [formDivisionId, setFormDivisionId] = useState<number | null>(null);
  const [formContratoId, setFormContratoId] = useState<number | null>(null);
  const [formCorpoId, setFormCorpoId] = useState<number | null>(null);
  const [formPuestoId, setFormPuestoId] = useState<number | null>(null);
  const [formPlazaId, setFormPlazaId] = useState<number | null>(null);

  const [deletingRecordKey, setDeletingRecordKey] = useState<string | null>(null);

  const tipoClienteOpcionesPicker = useMemo(() => {
    const base =
      tipoClientesQuejasCache.length > 0 ? tipoClientesQuejasCache : LEGACY_TIPO_CLIENTE_QUEJA_OPTIONS;
    if (tipoCliente && !base.some((x) => x.nombre === tipoCliente)) {
      return [{ id: -10_000, nombre: tipoCliente }, ...base];
    }
    return base;
  }, [tipoClientesQuejasCache, tipoCliente]);

  const tipoQuejaOpcionesPicker = useMemo(() => {
    const base = tipoQuejasCache.length > 0 ? tipoQuejasCache : LEGACY_TIPO_CLIENTE_QUEJA_OPTIONS;
    if (tipoQueja && !base.some((x) => x.nombre === tipoQueja)) {
      return [{ id: -10_000, nombre: tipoQueja }, ...base];
    }
    return base;
  }, [tipoQuejasCache, tipoQueja]);

  const isOperativo = roleName === 'OPERATIVO';

  /** Misma política que `MantenimientoEquipoScreen` / uso previo en esta pantalla. */
  const getConnectionStatus = async (): Promise<boolean> => {
    //return false;
    const networkState = await Network.getNetworkStateAsync();

    return (
      networkState.isConnected === true &&
      networkState.isInternetReachable === true
    );
  };

  /** Solo con internet: GET `complaints-master/tipo-quejas` y `tipo-clientes` → AsyncStorage + estado (`tipo_*_cache`). Una sola vez por sesión de carga. */
  const refreshTipoCatalogosFromServerIfOnline = useCallback(
    async (isCancelled?: () => boolean) => {
      if (tipoCatalogosServerFetchPromise) {
        await tipoCatalogosServerFetchPromise;
        return;
      }

      tipoCatalogosServerFetchPromise = (async () => {
        const isConnected = await getConnectionStatus();
        if (!isConnected) return;
        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl || String(apiUrl).trim() === '') return;

        const pull = async (
          path: 'tipo-quejas' | 'tipo-clientes',
          storageKey: 'tipo_quejas_cache' | 'tipo_clientes_quejas_cache',
          setList: React.Dispatch<React.SetStateAction<TipoCatalogoQuejaItem[]>>,
        ) => {
          try {
            const res = await authedFetch({
              url: `${apiUrl}/api/complaints-master/${path}`,
              init: {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
              },
              refreshAccessToken,
              logout,
            });
            if (!res?.ok) return;
            const data = (await res.json()) as {
              status?: boolean;
              tipoQuejas?: unknown;
              tipoClientes?: unknown;
            };
            if (!data?.status) return;
            const rawArr = path === 'tipo-quejas' ? data.tipoQuejas : data.tipoClientes;
            if (!Array.isArray(rawArr)) return;
            const json = JSON.stringify(rawArr);
            if (isCancelled?.()) return;
            await AsyncStorage.setItem(storageKey, json);
            if (isCancelled?.()) return;
            setList(parseTipoCatalogoQuejasCache(json));
          } catch {
            /* fallo puntual: se conserva el cache ya cargado */
          }
        };

        await Promise.all([
          pull('tipo-quejas', 'tipo_quejas_cache', setTipoQuejasCache),
          pull('tipo-clientes', 'tipo_clientes_quejas_cache', setTipoClientesQuejasCache),
        ]);
      })();

      try {
        await tipoCatalogosServerFetchPromise;
      } catch {
        tipoCatalogosServerFetchPromise = null;
      }
    },
    [refreshAccessToken, logout],
  );

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

  const loadMarcaContext = async () => {
    const currentMarcaStr = await AsyncStorage.getItem('current_marca');
    if (!currentMarcaStr) {
      setHasCurrentMarca(false);
      setMarcaEmpresaId(null);
      setMarcaClienteId(null);
      setMarcaDivisionId(null);
      setMarcaContratoId(null);
      setMarcaCorpoId(null);
      return null;
    }
    try {
      const current = JSON.parse(currentMarcaStr);
      if (!current?.id) {
        setHasCurrentMarca(false);
        setMarcaEmpresaId(null);
        setMarcaClienteId(null);
        setMarcaDivisionId(null);
        setMarcaContratoId(null);
        setMarcaCorpoId(null);
        return null;
      }
      setHasCurrentMarca(true);

      const empresaIdRaw = current?.empresa?.id ?? current?.empresa_id;
      const clienteIdRaw = current?.cliente?.id ?? current?.cliente_id;
      const contratoIdRaw = current?.contrato?.id ?? current?.contrato_id;
      const corpoIdRaw = current?.corpo?.id ?? current?.corpo_id;
      const divisionIdRaw = getComplaintsMarcaDivisionIdFromCurrent(current);

      setMarcaEmpresaId(empresaIdRaw !== undefined && empresaIdRaw !== null ? Number(empresaIdRaw) : null);
      setMarcaClienteId(clienteIdRaw !== undefined && clienteIdRaw !== null ? Number(clienteIdRaw) : null);
      setMarcaDivisionId(divisionIdRaw !== undefined && divisionIdRaw !== null ? Number(divisionIdRaw) : null);
      setMarcaContratoId(contratoIdRaw !== undefined && contratoIdRaw !== null ? Number(contratoIdRaw) : null);
      setMarcaCorpoId(corpoIdRaw !== undefined && corpoIdRaw !== null ? Number(corpoIdRaw) : null);

      return current;
    } catch {
      setHasCurrentMarca(false);
      setMarcaEmpresaId(null);
      setMarcaClienteId(null);
      setMarcaDivisionId(null);
      setMarcaContratoId(null);
      setMarcaCorpoId(null);
      return null;
    }
  };

  const fetchMainStructure = useCallback(async (): Promise<ComplaintsStructureTree> => {
    setIsStructureLoading(true);
    try {
      const parsed = await loadMainStructureTreeMerged();
      if (Array.isArray(parsed) && parsed.length > 0) {
        setStructure(parsed as ComplaintsStructureTree);
        return parsed as ComplaintsStructureTree;
      }
      setStructure([]);
      return [];
    } catch (e) {
      console.error('Error loading main structure for complaints master:', e);
      return [];
    } finally {
      setIsStructureLoading(false);
    }
  }, []);

  const applyHierarchyFiltersFromMarca = useCallback((current: any, tree: ComplaintsStructureTree) => {
    if (!current) return;
    const empresaIdRaw = current?.empresa?.id ?? current?.empresa_id;
    const clienteIdRaw = current?.cliente?.id ?? current?.cliente_id;
    const contratoIdRaw = current?.contrato?.id ?? current?.contrato_id;
    const corpoIdRaw = current?.corpo?.id ?? current?.corpo_id;
    const divisionIdRaw = getComplaintsMarcaDivisionIdFromCurrent(current);

    const empresaId = empresaIdRaw !== undefined && empresaIdRaw !== null ? Number(empresaIdRaw) : null;
    const clienteId = clienteIdRaw !== undefined && clienteIdRaw !== null ? Number(clienteIdRaw) : null;
    const contratoId = contratoIdRaw !== undefined && contratoIdRaw !== null ? Number(contratoIdRaw) : null;
    const corpoId = corpoIdRaw !== undefined && corpoIdRaw !== null ? Number(corpoIdRaw) : null;
    const divisionId = resolveComplaintsDivisionInTree(tree, empresaId, clienteId, divisionIdRaw);

    setFilterEmpresaId(empresaId);
    setFilterClienteId(clienteId);
    setFilterDivisionId(divisionId);
    setFilterContratoId(contratoId);
    setFilterCorpoId(corpoId);
  }, []);

  const handleFilterHierarchyChange = useCallback((v: HierarchyPickerValues) => {
    setFilterEmpresaId(v.empresaId);
    setFilterClienteId(v.clienteId);
    setFilterDivisionId(v.divisionId);
    setFilterContratoId(v.contratoId);
    setFilterCorpoId(v.sucursalId);
  }, []);

  const handleFormHierarchyChange = useCallback((v: HierarchyPickerValues) => {
    setFormEmpresaId(v.empresaId);
    setFormClienteId(v.clienteId);
    setFormDivisionId(v.divisionId);
    setFormContratoId(v.contratoId);
    setFormCorpoId(v.sucursalId);
    setFormPuestoId(v.puestoId ?? null);
    setFormPlazaId(v.plazaId ?? null);
  }, []);

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
    const division = filterDivisiones.find((d: any) => d.id === filterDivisionId);
    return division?.contratos || [];
  }, [filterDivisiones, filterDivisionId]);

  const filterSucursales = useMemo(() => {
    const contrato = filterContratos.find((c: any) => c.id === filterContratoId);
    return contrato?.sucursales || [];
  }, [filterContratos, filterContratoId]);

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

  const formSucursalNode = useMemo(
    () =>
      findSucursalNodeInFormPath(
        structure,
        formEmpresaId,
        formClienteId,
        formDivisionId,
        formContratoId,
        formCorpoId
      ),
    [structure, formEmpresaId, formClienteId, formDivisionId, formContratoId, formCorpoId]
  );

  const formPuestos = useMemo(
    () => (Array.isArray((formSucursalNode as any)?.puestos) ? (formSucursalNode as any).puestos : []),
    [formSucursalNode]
  );

  const formPuestoNode = useMemo(
    () => formPuestos.find((p: any) => Number(p?.id) === Number(formPuestoId)) || null,
    [formPuestos, formPuestoId]
  );

  const formPlazas = useMemo(
    () => (Array.isArray((formPuestoNode as any)?.plazas) ? (formPuestoNode as any).plazas : []),
    [formPuestoNode]
  );

  useEffect(() => {
    if ((!isCreating && !editingRecord) || isOperativo) return;
    if (formEmpresaId == null) {
      setSociedad('');
      return;
    }
    const e = structure.find((x: any) => Number(x?.id) === Number(formEmpresaId));
    const nombre = e?.nombre != null ? String(e.nombre).trim() : '';
    if (nombre) setSociedad(nombre);
  }, [isCreating, editingRecord, isOperativo, formEmpresaId, structure]);

  useEffect(() => {
    if ((!isCreating && !editingRecord) || isOperativo) return;
    if (formClienteId == null) {
      setCliente('');
      return;
    }
    const empresaNode = structure.find((x: any) => Number(x?.id) === Number(formEmpresaId));
    const c = (empresaNode?.clientes || []).find((x: any) => Number(x?.id) === Number(formClienteId));
    const nombre = c?.nombre != null ? String(c.nombre).trim() : '';
    if (nombre) setCliente(nombre);
  }, [isCreating, editingRecord, isOperativo, formClienteId, formEmpresaId, structure]);

  useEffect(() => {
    if (!filterEmpresaId) {
      setFilterClienteId(null);
      setFilterDivisionId(null);
      setFilterContratoId(null);
      setFilterCorpoId(null);
    }
  }, [filterEmpresaId]);

  useEffect(() => {
    if (!filterClienteId) {
      setFilterDivisionId(null);
      setFilterContratoId(null);
      setFilterCorpoId(null);
    }
  }, [filterClienteId]);

  useEffect(() => {
    if (!filterDivisionId) {
      setFilterContratoId(null);
      setFilterCorpoId(null);
    }
  }, [filterDivisionId]);

  useEffect(() => {
    if (!filterContratoId) {
      setFilterCorpoId(null);
    }
  }, [filterContratoId]);

  const refreshAccessTokenRef = useRef(refreshAccessToken);
  const logoutRef = useRef(logout);
  useEffect(() => {
    refreshAccessTokenRef.current = refreshAccessToken;
    logoutRef.current = logout;
  }, [refreshAccessToken, logout]);

  const fetchComplaintsForCorpo = useCallback(async (corpoId: number) => {
    try {
      setIsListLoading(true);
      setError(null);

      const corpoIdStr = String(corpoId);

      const isConnected = await getConnectionStatus();

      if (isConnected) {
        const result = await listComplaintsMasterByCorpo({
          corpo_id: corpoIdStr,
          refreshAccessToken: () => refreshAccessTokenRef.current(),
          logout: () => logoutRef.current(),
        });

        if (result.status && result.data) {
          const serverRecords = (result.data as any[])
            .filter((r) => r?.isActive !== false)
            .map((r) => ({
              ...r,
              id_local: r?.id_local || '',
              synced: true,
              type: COMPLAINTS_MASTER_CACHE_TYPE,
              corpo_id: r.corpo_id ?? corpoId,
              files: Array.isArray(r?.files) ? r.files : [],
            }));

          await mergeComplaintsMasterServerIntoCacheForCorpo(corpoId, serverRecords);
          const merged = await loadComplaintsMasterRowsForCorpo(corpoId);
          setComplaints((merged as any[]).filter((c) => c?.isActive !== false) as any);
        } else {
          setComplaints([]);
        }
      } else {
        try {
          const complaintsCache = await loadComplaintsMasterRowsForCorpo(corpoId);
          setComplaints(
            (complaintsCache as any[]).filter((c) => c?.isActive !== false) as any
          );
        } catch {
          setComplaints([]);
        }
      }
    } catch (err) {
      console.error('Error fetching complaints:', err);
      setError('Error al cargar las quejas');
      try {
        const complaintsCache = await loadComplaintsMasterRowsForCorpo(corpoId);
        setComplaints(
          (complaintsCache as any[]).filter((c) => c?.isActive !== false) as any
        );
      } catch (cacheErr) {
        console.error('Error loading from cache:', cacheErr);
      }
    } finally {
      setIsListLoading(false);
    }
  }, []);

  const refetchComplaintsList = useCallback(async () => {
    const current = await loadMarcaContext();
    if (!current?.id) return;
    const role = current?.roleDivision?.role?.nombre ?? current?.role_division?.role?.nombre ?? null;
    if (role === 'OPERATIVO') {
      const cid = current?.corpo?.id != null ? Number(current.corpo.id) : null;
      if (cid) await fetchComplaintsForCorpo(cid);
      return;
    }
    if (filterCorpoId) await fetchComplaintsForCorpo(filterCorpoId);
  }, [filterCorpoId, fetchComplaintsForCorpo]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const current = await loadMarcaContext();
        if (cancelled) return;
        const role = current?.roleDivision?.role?.nombre ?? current?.role_division?.role?.nombre ?? null;
        setRoleName(typeof role === 'string' ? role : null);

        const tree = await fetchMainStructure();
        if (cancelled || !current?.id) return;

        if (role !== 'OPERATIVO') {
          applyHierarchyFiltersFromMarca(current, tree);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [applyHierarchyFiltersFromMarca, fetchMainStructure])
  );

  const tipoCatalogosInitializedRef = useRef(false);

  useEffect(() => {
    if (tipoCatalogosInitializedRef.current) return;
    tipoCatalogosInitializedRef.current = true;

    let cancelled = false;
    const isCancelled = () => cancelled;

    void (async () => {
      try {
        const [rawClientes, rawQuejas] = await Promise.all([
          AsyncStorage.getItem('tipo_clientes_quejas_cache'),
          AsyncStorage.getItem('tipo_quejas_cache'),
        ]);
        if (cancelled) return;
        setTipoClientesQuejasCache(parseTipoCatalogoQuejasCache(rawClientes));
        setTipoQuejasCache(parseTipoCatalogoQuejasCache(rawQuejas));
      } catch {
        if (!cancelled) {
          setTipoClientesQuejasCache([]);
          setTipoQuejasCache([]);
        }
      }
      if (!cancelled) {
        await refreshTipoCatalogosFromServerIfOnline(isCancelled);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshTipoCatalogosFromServerIfOnline]);

  useEffect(() => {
    if (roleName === 'OPERATIVO') return;
    if (!filterCorpoId) {
      setComplaints([]);
      setIsListLoading(false);
      return;
    }
    void fetchComplaintsForCorpo(filterCorpoId);
  }, [roleName, filterCorpoId, fetchComplaintsForCorpo]);

  useEffect(() => {
    if (!hasCurrentMarca) return;
    if (roleName !== 'OPERATIVO') return;
    (async () => {
      const str = await AsyncStorage.getItem('current_marca');
      if (!str) return;
      const c = JSON.parse(str);
      const cid = c?.corpo?.id != null ? Number(c.corpo.id) : null;
      if (cid) await fetchComplaintsForCorpo(cid);
      else {
        setComplaints([]);
        setIsListLoading(false);
      }
    })();
  }, [hasCurrentMarca, roleName, fetchComplaintsForCorpo]);

  useEffect(() => {
    const handler = () => {
      void refetchComplaintsList();
    };
    eventBus.on('connectionRestored', handler);
    return () => {
      eventBus.off('connectionRestored', handler);
    };
  }, [refetchComplaintsList]);

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
      const result = await DocumentPicker.getDocumentAsync({
        type: complaintsMasterDocumentPickerTypes(type),
        multiple: false,
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      let extension = '';
      if (asset.name && asset.name.includes('.')) extension = asset.name.split('.').pop() || '';
      else if (asset.mimeType && asset.mimeType.includes('/')) extension = asset.mimeType.split('/').pop() || '';

      const displayName = asset.name || `archivo.${extension || 'dat'}`;
      const stem = displayName.includes('.') ? displayName.slice(0, displayName.lastIndexOf('.')) : displayName;
      const extNorm = String(extension || 'dat').replace(/^\./, '');

      const storedType: StoredFileType = type === 'document' ? 'text' : type;

      const storedFileName = await saveFile({
        uri: asset.uri,
        originalName: stem.trim() || 'archivo',
        extension: extNorm,
        type: storedType,
        prefix: COMPLAINTS_MASTER_FILE_STORAGE_PREFIX,
      });

      const savedUri = getLocalFileDisplayUri(storedFileName) || '';

      const localId = `local_file_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const file: LocalFile = {
        id: localId,
        type,
        name: displayName,
        extension: extNorm,
        uri: savedUri,
        mimeType: asset.mimeType,
        storedFileName,
      };

      try {
        console.log(COMPLAINTS_MASTER_DEBUG_LOG, '[ui:addFile] adjunto en disco (imagen/audio/video/documento)', {
          type,
          localStateId: file.id,
          original_name: file.name,
          extension: file.extension,
          prefix: COMPLAINTS_MASTER_FILE_STORAGE_PREFIX,
          stored_file_name: file.storedFileName,
          local_file_uri: file.uri,
        });
      } catch {
        /* noop */
      }

      if (type === 'image') setImageFiles(prev => [...prev, file]);
      else if (type === 'audio') setAudioFiles(prev => [...prev, file]);
      else if (type === 'video') setVideoFiles(prev => [...prev, file]);
      else setDocumentFiles(prev => [...prev, file]);
    } catch (e) {
      console.error('Error picking file for complaint:', e);
      Alert.alert('Error', 'No se pudo seleccionar el archivo. Intenta nuevamente.');
    }
  };

  const preloadExistingFilesForEdit = useCallback(async (record: Complaint) => {
    try {
      if (complaintsMasterIsPendingLocal(record)) return;
      const complaintId = parseInt(String(record.id), 10);
      if (!complaintId) return;
      const existingFiles: ComplaintFile[] = Array.isArray(record.files) ? record.files : [];
      if (existingFiles.length === 0) return;

      setIsPreloadingEditFiles(true);

      const nextImages: LocalFile[] = [];
      const nextAudios: LocalFile[] = [];
      const nextVideos: LocalFile[] = [];
      const nextDocs: LocalFile[] = [];

      let token = effectiveMediaToken;
      if (!token) {
        const t = await getValidAccessTokenOrLogout({ refreshAccessToken, logout });
        token = t != null && String(t).trim() !== '' ? String(t).trim() : null;
      }

      for (const f of existingFiles) {
        const url = buildComplaintFileUrl(complaintId, f, token);
        if (!url) continue;

        const fileType = ((f.type as any) || 'document') as LocalFile['type'];
        const dl = await downloadComplaintsMasterServerFileToLocal({
          url,
          fileType,
          suggestedName: f.original_name || f.name || `file.${f.extension || 'dat'}`,
          extension: f.extension || (f.name.includes('.') ? (f.name.split('.').pop() || 'dat') : 'dat'),
          refreshAccessToken,
          logout,
        });
        if (!dl) continue;

        const lf: LocalFile = {
          id: `server_${f.id}`,
          type: fileType,
          name: f.original_name || f.name,
          extension: f.extension || (f.name.includes('.') ? (f.name.split('.').pop() || 'dat') : 'dat'),
          uri: dl.uri,
          storedFileName: dl.storedFileName,
          server_file_id: f.id,
        };

        if (lf.type === 'image') nextImages.push(lf);
        else if (lf.type === 'audio') nextAudios.push(lf);
        else if (lf.type === 'video') nextVideos.push(lf);
        else nextDocs.push(lf);
      }

      setPreservedImageFiles(nextImages);
      setPreservedAudioFiles(nextAudios);
      setPreservedVideoFiles(nextVideos);
      setPreservedDocumentFiles(nextDocs);
    } catch (err) {
      console.error('Error preloading complaint files:', err);
      Alert.alert('Error', 'No se pudieron cargar los archivos adjuntos para edición');
    } finally {
      setIsPreloadingEditFiles(false);
    }
  }, [effectiveMediaToken, refreshAccessToken, logout]);

  const removeLocalFile = async (type: LocalFile['type'], file: LocalFile) => {
    if (file.storedFileName != null && String(file.storedFileName).trim() !== '') {
      await deleteFile(String(file.storedFileName).trim());
    } else if (file.uri != null && String(file.uri).trim() !== '') {
      await deleteComplaintsMasterLocalFileUri(file.uri);
    }
    const id = file.id;
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

      const hash = await getCurrentUserDigitalSignature(employee);
      if (!hash) return;

      const decodedData = atob(hash);
      const parts = decodedData.split(':');
      if (parts.length !== 5) {
        Alert.alert('Error', 'La firma generada no tiene el formato esperado');
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

      setFirmaResponsable({
        sessionId,
        empleadoId,
        latitud,
        longitud,
        timestamp,
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

  const executeDeleteComplaintAttachment = async (record: Complaint, file: ComplaintFile) => {
    const recordId = record.id || record.id_local;
    if (!recordId || !file?.id) return;

    const isOpenInForm =
      editingRecord != null &&
      String(editingRecord.id || editingRecord.id_local) === String(recordId);

    try {
      const isConnected = await getConnectionStatus();
      const serverId = record.id;
      const hasServerId =
        serverId != null &&
        String(serverId).trim() !== '' &&
        !String(serverId).startsWith('local-');

      if (isConnected && hasServerId) {
        const res = await deleteComplaintsMasterFile({
          id: String(serverId),
          fileId: file.id,
          refreshAccessToken,
          logout,
        });
        if (!res.status) {
          Alert.alert('Error', res.message || 'No se pudo eliminar el archivo');
          return;
        }
      } else if (
        file.stored_file_name != null ||
        (file.local_uri != null && String(file.local_uri).trim() !== '') ||
        Number(file.id) < 0
      ) {
        if (file.stored_file_name != null && String(file.stored_file_name).trim() !== '') {
          try {
            await deleteFile(String(file.stored_file_name).trim());
          } catch {
            /* noop */
          }
        } else if (file.local_uri) {
          await deleteComplaintsMasterLocalFileUri(String(file.local_uri));
        }
        const actionsStr = await AsyncStorage.getItem('evaluations_actions');
        const actions = actionsStr ? JSON.parse(actionsStr) : [];
        const rid = String(recordId);
        const nextActions = actions.map((a: any) => {
          if (a.type !== 'complaints_master' || String(a.id) !== rid) return a;
          if (a.action !== 'create' && a.action !== 'update') return a;
          const arch = parseComplaintsMasterArchivosFromPayload(a.payload?.archivos);
          const filtered = arch.filter((entry: any) => {
            const sn = entry?.stored_file_name;
            const uri = entry?.local_file_uri || entry?.file_path;
            if (
              file.stored_file_name != null &&
              sn != null &&
              String(sn) === String(file.stored_file_name)
            ) {
              return false;
            }
            if (file.local_uri && uri) {
              const a0 = String(uri).replace(/^file:\/\//, '');
              const b0 = String(file.local_uri).replace(/^file:\/\//, '');
              if (a0 === b0) return false;
            }
            return true;
          });
          return { ...a, payload: { ...a.payload, archivos: filtered } };
        });
        await AsyncStorage.setItem('evaluations_actions', JSON.stringify(nextActions));
      } else {
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

      if (isOpenInForm) {
        const notRemovedLocal = (f: LocalFile) =>
          f.server_file_id !== file.id &&
          !(
            file.stored_file_name != null &&
            f.storedFileName != null &&
            String(f.storedFileName) === String(file.stored_file_name)
          );
        setImageFiles(prev => prev.filter(notRemovedLocal));
        setAudioFiles(prev => prev.filter(notRemovedLocal));
        setVideoFiles(prev => prev.filter(notRemovedLocal));
        setDocumentFiles(prev => prev.filter(notRemovedLocal));
        setPreservedImageFiles(prev => prev.filter(notRemovedLocal));
        setPreservedAudioFiles(prev => prev.filter(notRemovedLocal));
        setPreservedVideoFiles(prev => prev.filter(notRemovedLocal));
        setPreservedDocumentFiles(prev => prev.filter(notRemovedLocal));
        const nextFiles = (record.files || []).filter(f => f.id !== file.id);
        setEditingRecord(prev => (prev ? { ...prev, files: nextFiles } : prev));
      }

      setComplaints(prev =>
        prev.map(c => {
          const cid = c.id || c.id_local;
          if (String(cid) === String(recordId)) {
            const currentFiles = Array.isArray(c.files) ? c.files : [];
            return { ...c, files: currentFiles.filter((f2: any) => f2.id !== file.id) };
          }
          return c;
        })
      );

      await patchComplaintsMasterFilesForRecord(recordId, file.id);
    } catch (err) {
      console.error('Error deleting attached file:', err);
      Alert.alert('Error', 'No se pudo eliminar el archivo');
    }
  };

  const deleteAttachedFileForListRecord = (record: Complaint) => (file: ComplaintFile) => {
    Alert.alert('Confirmar', '¿Deseas eliminar este archivo adjunto?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => void executeDeleteComplaintAttachment(record, file),
      },
    ]);
  };

  const startCreating = async () => {
    setIsCreating(true);

    let fechaHoy = formatDate(new Date());
    try {
      const ha = await getHoraAccion();
      if (ha != null) fechaHoy = formatDate(new Date(ha));
    } catch {
      // Sin server_time se deja la fecha local
    }

    setSociedad('');
    setNombreRealizaQueja('');
    setCliente('');
    setEmpresaPresentaQueja('');
    setPersonaPresentaQueja('');
    setMedioRecepcionQueja('Correo');
    const { tipoCliente: defTipoCliente, tipoQueja: defTipoQueja } = await readDefaultTipoClienteYQuejaFromCaches();
    setTipoCliente(defTipoCliente);
    setTipoQueja(defTipoQueja);
    setEstimacionDannio('');
    setUbicacion('');
    setNivelQueja('Leve');
    setFechaQueja(fechaHoy);
    setMotivoQueja('');
    setDescripcionQueja('');
    setFechaInicio(fechaHoy);
    setFechaRevision(fechaHoy);
    setResolucionQueja('');
    setEstado('');
    setAccionCorrectivaPreventiva('');
    setImageFiles([]);
    setAudioFiles([]);
    setVideoFiles([]);
    setDocumentFiles([]);
    setPreservedImageFiles([]);
    setPreservedAudioFiles([]);
    setPreservedVideoFiles([]);
    setPreservedDocumentFiles([]);
    setFirmaResponsable(null);

    const current = await loadMarcaContext();
    const tree = structure.length ? structure : await fetchMainStructure();
    const role = current?.roleDivision?.role?.nombre ?? current?.role_division?.role?.nombre ?? null;
    if (role !== 'OPERATIVO' && current) {
      const empresaIdRaw = current?.empresa?.id ?? current?.empresa_id;
      const clienteIdRaw = current?.cliente?.id ?? current?.cliente_id;
      const contratoIdRaw = current?.contrato?.id ?? current?.contrato_id;
      const corpoIdRaw = current?.corpo?.id ?? current?.corpo_id;
      const divisionIdRaw = getComplaintsMarcaDivisionIdFromCurrent(current);

      const empresaId = empresaIdRaw !== undefined && empresaIdRaw !== null ? Number(empresaIdRaw) : null;
      const clienteId = clienteIdRaw !== undefined && clienteIdRaw !== null ? Number(clienteIdRaw) : null;
      const contratoId = contratoIdRaw !== undefined && contratoIdRaw !== null ? Number(contratoIdRaw) : null;
      const corpoId = corpoIdRaw !== undefined && corpoIdRaw !== null ? Number(corpoIdRaw) : null;
      const divisionId = resolveComplaintsDivisionInTree(tree, empresaId, clienteId, divisionIdRaw);

      setFormEmpresaId(empresaId);
      setFormClienteId(clienteId);
      setFormDivisionId(divisionId);
      setFormContratoId(contratoId);
      setFormCorpoId(corpoId);
      const pMarca = current?.puesto?.id ?? current?.puesto_id;
      const plMarca = current?.plaza?.id ?? current?.plaza_id;
      if (pMarca != null && Number(pMarca) > 0) setFormPuestoId(Number(pMarca));
      if (plMarca != null && Number(plMarca) > 0) setFormPlazaId(Number(plMarca));
    } else {
      setFormEmpresaId(null);
      setFormClienteId(null);
      setFormDivisionId(null);
      setFormContratoId(null);
      setFormCorpoId(null);
      setFormPuestoId(null);
      setFormPlazaId(null);
      const en = current?.empresa?.nombre;
      if (en != null && String(en).trim()) setSociedad(String(en).trim());
      const cn = current?.cliente?.nombre;
      if (cn != null && String(cn).trim()) setCliente(String(cn).trim());
    }
  };

  const cancelCreating = () => {
    discardQueuedPickedFilesWithSnapshot([...allPickedFilesRef.current]);
    setImageFiles([]);
    setAudioFiles([]);
    setVideoFiles([]);
    setDocumentFiles([]);
    setPreservedImageFiles([]);
    setPreservedAudioFiles([]);
    setPreservedVideoFiles([]);
    setPreservedDocumentFiles([]);
    setFormEmpresaId(null);
    setFormClienteId(null);
    setFormDivisionId(null);
    setFormContratoId(null);
    setFormCorpoId(null);
    setFormPuestoId(null);
    setFormPlazaId(null);
    setIsCreating(false);
  };

  const startEditing = async (record: Complaint) => {
    setIsCreating(false);
    // Reset first (avoid leaking previous form state between records)
    setImageFiles([]);
    setAudioFiles([]);
    setVideoFiles([]);
    setDocumentFiles([]);
    setPreservedImageFiles([]);
    setPreservedAudioFiles([]);
    setPreservedVideoFiles([]);
    setPreservedDocumentFiles([]);
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
      tipo_cliente: record.tipo_cliente || '',
      tipo_queja: record.tipo_queja || '',
      estimacion_dannio: record.estimacion_dannio || '',
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
    setTipoCliente(record.tipo_cliente || '');
    setTipoQueja(record.tipo_queja || '');
    setEstimacionDannio(record.estimacion_dannio || '');
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

    if (!isOperativo) {
      const tree = structure.length ? structure : await fetchMainStructure();
      const eid =
        record.empresa_id != null && Number.isFinite(Number(record.empresa_id)) ? Number(record.empresa_id) : null;
      const cid =
        record.cliente_id != null && Number.isFinite(Number(record.cliente_id)) ? Number(record.cliente_id) : null;
      const ctid =
        record.contrato_id != null && Number.isFinite(Number(record.contrato_id)) ? Number(record.contrato_id) : null;
      const coidRaw = record.corpo_id ?? complaintCacheCorpoId(record);
      const coid = coidRaw != null && Number.isFinite(Number(coidRaw)) ? Number(coidRaw) : null;
      const did = resolveDivisionIdForComplaintPath(tree, eid, cid, ctid, coid);
      setFormEmpresaId(eid);
      setFormClienteId(cid);
      setFormDivisionId(did);
      setFormContratoId(ctid);
      setFormCorpoId(coid);
      if (record.puesto_id != null && Number(record.puesto_id) > 0) {
        setFormPuestoId(Number(record.puesto_id));
      } else {
        setFormPuestoId(null);
      }
      if (record.plaza_id != null && Number(record.plaza_id) > 0) {
        setFormPlazaId(Number(record.plaza_id));
      } else {
        setFormPlazaId(null);
      }
    } else {
      setFormEmpresaId(null);
      setFormClienteId(null);
      setFormDivisionId(null);
      setFormContratoId(null);
      setFormCorpoId(null);
      setFormPuestoId(null);
      setFormPlazaId(null);
    }

    // Si ya existe firma guardada, mostrarla en el UI
    setFirmaFromHashIfPossible(record.firma_responsable || null);

    // Precargar en arrays internos (no visibles) para reenviarlos al PUT sin listarlos en el formulario.
    if (record.id && !String(record.id).startsWith('local-') && !complaintsMasterIsPendingLocal(record)) {
      void preloadExistingFilesForEdit(record);
    } else if (complaintsMasterIsPendingLocal(record) && Array.isArray(record.files) && record.files.length > 0) {
      const nextImages: LocalFile[] = [];
      const nextAudios: LocalFile[] = [];
      const nextVideos: LocalFile[] = [];
      const nextDocs: LocalFile[] = [];
      for (const f of record.files) {
        const hasStored = f.stored_file_name != null && String(f.stored_file_name).trim() !== '';
        const hasUri = f.local_uri != null && String(f.local_uri).trim() !== '';
        if (!hasStored && !hasUri) continue;
        const t = f.type as LocalFile['type'];
        const lfType: LocalFile['type'] =
          t === 'image' || t === 'audio' || t === 'video' || t === 'document' ? t : 'document';
        const fromDisk =
          hasStored && f.stored_file_name ? getLocalFileDisplayUri(String(f.stored_file_name).trim()) : '';
        const uriNorm =
          fromDisk && fromDisk.length > 0
            ? fromDisk
            : normalizeLocalMediaUri(String(f.local_uri || ''));
        const lf: LocalFile = {
          id: `hydrated_${f.stored_file_name ?? f.id}_${f.extension}`,
          type: lfType,
          name: f.original_name || f.name,
          extension: f.extension || 'dat',
          uri: uriNorm,
          storedFileName: hasStored && f.stored_file_name ? String(f.stored_file_name).trim() : undefined,
        };
        if (lfType === 'image') nextImages.push(lf);
        else if (lfType === 'audio') nextAudios.push(lf);
        else if (lfType === 'video') nextVideos.push(lf);
        else nextDocs.push(lf);
      }
      setPreservedImageFiles(nextImages);
      setPreservedAudioFiles(nextAudios);
      setPreservedVideoFiles(nextVideos);
      setPreservedDocumentFiles(nextDocs);
    }
  };

  const cancelEditing = () => {
    discardQueuedPickedFilesWithSnapshot([...allPickedFilesRef.current]);
    setImageFiles([]);
    setAudioFiles([]);
    setVideoFiles([]);
    setDocumentFiles([]);
    setPreservedImageFiles([]);
    setPreservedAudioFiles([]);
    setPreservedVideoFiles([]);
    setPreservedDocumentFiles([]);
    setEditingRecord(null);
    setFormEmpresaId(null);
    setFormClienteId(null);
    setFormDivisionId(null);
    setFormContratoId(null);
    setFormCorpoId(null);
    setFormPuestoId(null);
    setFormPlazaId(null);
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

  const buildCreateFkIds = (
    currentMarcaData: any,
    tree: ComplaintsStructureTree
  ): {
    empresa_id: number;
    cliente_id: number;
    contrato_id: number;
    corpo_id: number;
    puesto_id: number;
    plaza_id: number;
    division_id: number;
  } | null => {
    if (isOperativo) {
      const puestoRaw = currentMarcaData?.puesto?.id ?? currentMarcaData?.puesto_id;
      const plazaRaw = currentMarcaData?.plaza?.id ?? currentMarcaData?.plaza_id;
      const puesto_id = puestoRaw != null ? Number(puestoRaw) : NaN;
      const plaza_id = plazaRaw != null ? Number(plazaRaw) : NaN;
      if (!Number.isFinite(puesto_id) || puesto_id <= 0 || !Number.isFinite(plaza_id) || plaza_id <= 0) {
        return null;
      }
      const empresa_id = Number(currentMarcaData?.empresa?.id ?? currentMarcaData?.empresa_id);
      const cliente_id = Number(currentMarcaData?.cliente?.id ?? currentMarcaData?.cliente_id);
      let contrato_id = Number(currentMarcaData?.contrato?.id ?? currentMarcaData?.contrato_id);
      const corpo_id = Number(currentMarcaData?.corpo?.id ?? currentMarcaData?.corpo_id);
      if (![empresa_id, cliente_id, corpo_id].every((n) => Number.isFinite(n) && n > 0)) return null;
      if (!Number.isFinite(contrato_id) || contrato_id <= 0) {
        const resolved = findContratoIdForSucursalInTree(tree, corpo_id);
        if (resolved == null) return null;
        contrato_id = resolved;
      }
      const division_id = resolveDivisionIdForComplaintPath(
        tree,
        empresa_id,
        cliente_id,
        contrato_id,
        corpo_id
      );
      if (division_id == null) return null;
      return { empresa_id, cliente_id, contrato_id, corpo_id, puesto_id, plaza_id, division_id };
    }

    if (
      formEmpresaId == null ||
      formClienteId == null ||
      formDivisionId == null ||
      formContratoId == null ||
      formCorpoId == null
    ) {
      return null;
    }
    const empresa_id = Number(formEmpresaId);
    const cliente_id = Number(formClienteId);
    const contrato_id = Number(formContratoId);
    const corpo_id = Number(formCorpoId);
    let puesto_id = formPuestoId != null ? Number(formPuestoId) : NaN;
    if (!Number.isFinite(puesto_id) || puesto_id <= 0) {
      const p = currentMarcaData?.puesto?.id ?? currentMarcaData?.puesto_id;
      if (p != null && Number(p) > 0) puesto_id = Number(p);
    }
    let plaza_id = formPlazaId != null ? Number(formPlazaId) : NaN;
    if (!Number.isFinite(plaza_id) || plaza_id <= 0) {
      const z = currentMarcaData?.plaza?.id ?? currentMarcaData?.plaza_id;
      if (z != null && Number(z) > 0) plaza_id = Number(z);
    }
    const division_id = Number(formDivisionId);
    if (
      ![
        empresa_id,
        cliente_id,
        contrato_id,
        corpo_id,
        puesto_id,
        plaza_id,
        division_id,
      ].every((n) => Number.isFinite(n) && n > 0)
    ) {
      return null;
    }

    return { empresa_id, cliente_id, contrato_id, corpo_id, puesto_id, plaza_id, division_id };
  };

  const saveComplaint = () => {
    Alert.alert('Confirmar', '¿Desea registrar esta queja?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Aceptar', onPress: () => void saveComplaintConfirmed() },
    ]);
  };

  const saveComplaintConfirmed = async () => {
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

      const treeForFk = structure.length ? structure : (await fetchMainStructure());
      const fk = buildCreateFkIds(currentMarcaData, treeForFk);
      if (!fk) {
        Alert.alert(
          'Error',
          isOperativo
            ? 'No se pudieron obtener empresa, cliente, contrato, corpo, puesto o plaza desde la marca actual.'
            : 'Seleccione la jerarquía completa hasta Sucursal, luego puesto y plaza.'
        );
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
        tipo_cliente: tipoCliente.trim(),
        tipo_queja: tipoQueja.trim(),
        estimacion_dannio: estimacionDannio.trim(),
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
        archivos: buildArchivosPersistList(),
        empresa_id: fk.empresa_id,
        cliente_id: fk.cliente_id,
        contrato_id: fk.contrato_id,
        corpo_id: fk.corpo_id,
        puesto_id: fk.puesto_id,
        plaza_id: fk.plaza_id,
        division_id: fk.division_id,
      };

      const isConnected = await getConnectionStatus();

      if (isConnected) {
        const archivosPersist = buildArchivosPersistList();
        try {
          console.log(
            COMPLAINTS_MASTER_DEBUG_LOG,
            '[ui:save create online] lista persist → resolveComplaintsMasterArchivosForApiRequest (lee disco por local_file_uri / cola)',
            { count: archivosPersist.length, archivos: complaintsMasterArchivosLogPreview(archivosPersist) }
          );
        } catch {
          /* noop */
        }
        const resolvedArchivos = await resolveComplaintsMasterArchivosForApiRequest(archivosPersist);
        if (!resolvedArchivos.diskHydrationComplete) {
          Alert.alert(
            'Error',
            'No se pudieron leer uno o más archivos adjuntos en el dispositivo. Comprueba que existan y vuelve a intentar.'
          );
          setIsSubmitting(false);
          return;
        }
        const requestDataApi = {
          ...requestData,
          archivos: resolvedArchivos.archivos,
        };
        const result = await createComplaintsMaster({
          requestData: requestDataApi,
          refreshAccessToken,
          logout,
        });

        if (result.status) {
          // No borrar adjuntos locales aquí: solo tras sincronizar la cola en App.tsx (éxito API desde evaluations_actions).
          const d = result.data as any;
          if (d) {
            const nid = d.id ?? (result as any).id;
            await upsertComplaintsMasterRowInCache({
              ...d,
              id: nid,
              id_local: '',
              synced: true,
              corpo_id: fk.corpo_id,
              files: normalizeServerFilesForComplaintCache(d.files),
            });
          }
          Alert.alert('Éxito', result.message || 'Queja guardada correctamente');
          setTimeout(() => {
            cancelCreating();
            void refetchComplaintsList();
          }, 2000);
        } else {
          Alert.alert('Error', result.message || 'Error al guardar la queja');
        }
      } else {
        const localId = generateRandomId();

        const archivosForStorage = await materializeArchivosForOfflineStorage();
        try {
          console.log(
            COMPLAINTS_MASTER_DEBUG_LOG,
            '[ui:save create offline] archivos materializados → AsyncStorage evaluations_actions (sync leerá estas rutas)',
            {
              actionLocalId: localId,
              archivos: complaintsMasterArchivosLogPreview(archivosForStorage as Record<string, unknown>[]),
            }
          );
        } catch {
          /* noop */
        }
        const actionsStr = await AsyncStorage.getItem('evaluations_actions');
        const actions = actionsStr ? JSON.parse(actionsStr) : [];
        actions.push({
          id: localId,
          action: 'create',
          type: 'complaints_master',
          payload: { ...requestData, archivos: archivosForStorage },
          synced: false,
        });
        await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

        const horaAccion = await getHoraAccion();
        if (!horaAccion) {
          Alert.alert('Error', 'No se pudo obtener la hora');
          setIsSubmitting(false);
          return;
        }

        const cacheFiles = complaintCacheFilesFromArchivoEntries(
          archivosForStorage as Record<string, unknown>[]
        ) as ComplaintFile[];
        const newRecordCache: Complaint = {
          id: '',
          id_local: localId,
          files: cacheFiles,
          sociedad: sociedad.trim() || null,
          nombre_realiza_queja: nombreRealizaQueja.trim() || null,
          cliente: cliente.trim() || null,
          empresa_presenta_queja: empresaPresentaQueja.trim() || null,
          persona_presenta_queja: personaPresentaQueja.trim() || null,
          medio_recepcion_queja: medioRecepcionQueja.trim() || null,
          tipo_cliente: tipoCliente.trim() || null,
          tipo_queja: tipoQueja.trim() || null,
          estimacion_dannio: estimacionDannio.trim() || null,
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
          corpo_id: fk.corpo_id,
          empresa_id: fk.empresa_id,
          cliente_id: fk.cliente_id,
          contrato_id: fk.contrato_id,
          puesto_id: fk.puesto_id,
          plaza_id: fk.plaza_id,
          division_id: fk.division_id,
        };

        await appendComplaintsMasterToCache({ ...newRecordCache, type: COMPLAINTS_MASTER_CACHE_TYPE });

        Alert.alert('Éxito', 'Queja registrada localmente. Se sincronizará cuando haya conexión.');
        setTimeout(() => {
          cancelCreating();
          void refetchComplaintsList();
        }, 2000);
      }
    } catch (err) {
      console.error('Error saving complaint:', err);
      Alert.alert('Error', 'No se pudo guardar la queja');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateComplaintHandler = () => {
    if (!editingRecord) return;
    Alert.alert('Confirmar', '¿Desea guardar los cambios de esta queja?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Aceptar', onPress: () => void updateComplaintConfirmed() },
    ]);
  };

  const updateComplaintConfirmed = async () => {
    if (!editingRecord) return;

    setIsSubmitting(true);
    setSubmitResponse(null);

    try {
      if (!firmaResponsable && (!editingRecord.firma_responsable || editingRecord.firma_responsable.trim().length === 0)) {
        Alert.alert('Error', 'La firma del responsable es requerida');
        setIsSubmitting(false);
        return;
      }

      const currentMarca = await AsyncStorage.getItem('current_marca');
      if (!currentMarca) {
        Alert.alert('Error', 'No se encontró la marca actual');
        setIsSubmitting(false);
        return;
      }
      const currentMarcaData = JSON.parse(currentMarca);
      const treeForFk = structure.length ? structure : (await fetchMainStructure());
      const fk = buildCreateFkIds(currentMarcaData, treeForFk);
      if (!fk) {
        Alert.alert(
          'Error',
          isOperativo
            ? 'No se pudieron obtener empresa, cliente, contrato, corpo, puesto o plaza desde la marca actual.'
            : 'Seleccione empresa, cliente, división, contrato, sucursal, puesto y plaza.'
        );
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
        tipo_cliente: tipoCliente.trim(),
        tipo_queja: tipoQueja.trim(),
        estimacion_dannio: estimacionDannio.trim(),
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
        archivos: buildArchivosPersistListForUpdate(),
        empresa_id: fk.empresa_id,
        cliente_id: fk.cliente_id,
        contrato_id: fk.contrato_id,
        corpo_id: fk.corpo_id,
        puesto_id: fk.puesto_id,
        plaza_id: fk.plaza_id,
        division_id: fk.division_id,
      };

      const isConnected = await getConnectionStatus();
      const recordId = editingRecord.id || editingRecord.id_local;

      if (isConnected && editingRecord.id && !String(editingRecord.id).startsWith('local-')) {
        const archivosPersistUpdate = buildArchivosPersistListForUpdate();
        try {
          console.log(
            COMPLAINTS_MASTER_DEBUG_LOG,
            '[ui:save update online] lista persist → resolveComplaintsMasterArchivosForApiRequest',
            {
              serverRecordId: String(editingRecord.id),
              count: archivosPersistUpdate.length,
              archivos: complaintsMasterArchivosLogPreview(archivosPersistUpdate),
            }
          );
        } catch {
          /* noop */
        }
        const resolvedUpdate = await resolveComplaintsMasterArchivosForApiRequest(archivosPersistUpdate);
        if (!resolvedUpdate.diskHydrationComplete) {
          Alert.alert(
            'Error',
            'No se pudieron leer uno o más archivos adjuntos en el dispositivo. Comprueba que existan y vuelve a intentar.'
          );
          setIsSubmitting(false);
          return;
        }
        const requestDataApi = {
          ...requestData,
          archivos: resolvedUpdate.archivos,
        };
        const result = await updateComplaintsMaster({
          id: String(editingRecord.id),
          requestData: requestDataApi,
          refreshAccessToken,
          logout,
        });

        if (result.status) {
          // No borrar adjuntos locales aquí: solo tras sincronizar la cola en App.tsx.
          const d = result.data as any;
          const clean =
            d && typeof d === 'object'
              ? (() => {
                  const { c_anexos_quejas: _a, archivos: _ar, ...r } = d;
                  return r;
                })()
              : {};
          const { archivos: _arch2, ...cachePatch } = requestData as any;
          await patchComplaintsMasterRowByRecordId(String(editingRecord.id), {
            ...cachePatch,
            ...clean,
            synced: true,
            id_local: '',
            ...(Array.isArray(d?.files)
              ? { files: normalizeServerFilesForComplaintCache(d.files) }
              : {}),
          });
          Alert.alert('Éxito', result.message || 'Queja actualizada correctamente');
          setTimeout(() => {
            cancelEditing();
            void refetchComplaintsList();
          }, 2000);
        } else {
          Alert.alert('Error', result.message || 'Error al actualizar la queja');
        }
      } else {
        const archivosForStorage = await materializeArchivosForOfflineUpdate();
        const offlineRequest = { ...requestData, archivos: archivosForStorage };

        const actionsStr = await AsyncStorage.getItem('evaluations_actions');
        let actions: any[] = actionsStr ? JSON.parse(actionsStr) : [];
        const eid = editingRecord.id;
        const isLocalOnly =
          eid == null ||
          (typeof eid === 'string' && eid.trim() === '') ||
          String(eid).startsWith('local-');

        try {
          console.log(
            COMPLAINTS_MASTER_DEBUG_LOG,
            '[ui:save update offline] materializado → evaluations_actions',
            {
              recordId,
              editingId: eid,
              id_local: editingRecord.id_local,
              isLocalOnly,
              archivos: complaintsMasterArchivosLogPreview(archivosForStorage as Record<string, unknown>[]),
            }
          );
        } catch {
          /* noop */
        }

        if (isLocalOnly && editingRecord.id_local) {
          const lid = String(editingRecord.id_local);
          actions = actions.filter(
            (a: any) =>
              !(
                a.type === 'complaints_master' &&
                a.action === 'update' &&
                String(a.id) === lid
              )
          );
          const createIdx = actions.findIndex(
            (a: any) =>
              a.type === 'complaints_master' && a.action === 'create' && String(a.id) === lid
          );
          if (createIdx !== -1) {
            actions[createIdx] = {
              ...actions[createIdx],
              payload: {
                ...actions[createIdx].payload,
                ...offlineRequest,
                marca_id: currentMarcaData.id,
              },
            };
          } else {
            actions.push({
              id: editingRecord.id_local,
              action: 'create',
              type: 'complaints_master',
              payload: { marca_id: currentMarcaData.id, ...offlineRequest },
              synced: false,
            });
          }
        } else {
        actions.push({
          id: recordId,
          action: 'update',
          type: 'complaints_master',
            payload: offlineRequest,
          synced: false,
        });
        }
        await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));
        try {
          console.log(COMPLAINTS_MASTER_DEBUG_LOG, '[ui:save update offline] evaluations_actions persistido', {
            recordId,
            totalActions: actions.length,
          });
        } catch {
          /* noop */
        }

        const offlineListFiles = complaintCacheFilesFromArchivoEntries(
          archivosForStorage as Record<string, unknown>[]
        ) as ComplaintFile[];
        await patchComplaintsMasterRowByRecordId(recordId, {
          synced: false,
                sociedad: sociedad.trim() || null,
                nombre_realiza_queja: nombreRealizaQueja.trim() || null,
                cliente: cliente.trim() || null,
                empresa_presenta_queja: empresaPresentaQueja.trim() || null,
                persona_presenta_queja: personaPresentaQueja.trim() || null,
                medio_recepcion_queja: medioRecepcionQueja.trim() || null,
                tipo_cliente: tipoCliente.trim() || null,
                tipo_queja: tipoQueja.trim() || null,
                estimacion_dannio: estimacionDannio.trim() || null,
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
          firma_responsable: offlineRequest.firma_responsable,
          empresa_id: fk.empresa_id,
          cliente_id: fk.cliente_id,
          contrato_id: fk.contrato_id,
          corpo_id: fk.corpo_id,
          puesto_id: fk.puesto_id,
          plaza_id: fk.plaza_id,
          division_id: fk.division_id,
          files: offlineListFiles,
        });

        Alert.alert('Éxito', 'Queja actualizada localmente. Se sincronizará cuando haya conexión.');
        setTimeout(() => {
          cancelEditing();
          void refetchComplaintsList();
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
    const recordKey = String(record.id || record.id_local || '');
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
              setDeletingRecordKey(recordKey);
              const isConnected = await getConnectionStatus();
              const recordId = record.id || record.id_local;
              const hasServerId =
                record.id != null &&
                record.id !== '' &&
                String(record.id).trim() !== '' &&
                !String(record.id).startsWith('local-');

              if (isConnected && hasServerId) {
                const result = await deleteComplaintsMaster({
                  id: String(record.id),
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', result.message || 'Queja eliminada correctamente');
                  void refetchComplaintsList();
                } else {
                  Alert.alert('Error', result.message || 'Error al eliminar la queja');
                }
              } else if (!isConnected && hasServerId) {
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

                await removeComplaintsMasterRowByRecordId(recordId);

                Alert.alert('Modo Offline', 'Queja eliminada localmente. Se sincronizará cuando haya conexión.');
                void refetchComplaintsList();
              } else if (record.id_local) {
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                const lid = String(record.id_local);
                const dropped = actions.filter(
                  (a: any) => a.type === 'complaints_master' && String(a.id) === lid
                );
                for (const a of dropped) {
                  await clearComplaintsMasterPendingFilesFromArchivoList(
                    parseComplaintsMasterArchivosFromPayload(a.payload?.archivos)
                  );
                }
                const filtered = actions.filter(
                  (a: any) => !(a.type === 'complaints_master' && String(a.id) === lid)
                );
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(filtered));

                await removeComplaintsMasterRowByRecordId(lid);

                Alert.alert('Éxito', 'Queja pendiente eliminada (no requiere borrado en servidor).');
                void refetchComplaintsList();
              }
            } catch (err) {
              console.error('Error deleting complaint:', err);
              Alert.alert('Error', 'No se pudo eliminar la queja');
            } finally {
              setDeletingRecordKey(null);
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

        {!isOperativo && (isCreating || isEditing) && (
          <ThemedView>
            <ThemedText style={styles.sectionTitle}>Jerarquía</ThemedText>
            {isStructureLoading ? (
              <ThemedText style={styles.formHintText}>Cargando estructura…</ThemedText>
            ) : (
              <HierarchyPickerFields
                structure={structure}
                levels={['cliente', 'contrato', 'sucursal', 'puesto', 'plaza']}
                isLoading={isStructureLoading}
                values={{
                  empresaId: formEmpresaId,
                  clienteId: formClienteId,
                  divisionId: formDivisionId,
                  contratoId: formContratoId,
                  sucursalId: formCorpoId,
                  puestoId: formPuestoId,
                  plazaId: formPlazaId,
                }}
                onChange={handleFormHierarchyChange}
                labels={{
                  empresa: 'Empresa *',
                  cliente: 'Cliente *',
                  division: 'División *',
                  contrato: 'Contrato *',
                  sucursal: 'Sucursal *',
                  puesto: 'Puesto *',
                  plaza: 'Plaza *',
                }}
                renderLabel={(text) => <ThemedText style={styles.formLabel}>{text}</ThemedText>}
                pickerStyle={styles.picker}
                fieldGroupStyle={styles.formGroup}
              />
            )}
          </ThemedView>
        )}

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
              selectedValue={isEditing ? medioRecepcionQueja : (medioRecepcionQueja || 'Correo')}
              onValueChange={setMedioRecepcionQueja}
              style={styles.picker}
            >
              {isEditing ? <Picker.Item label="Seleccionar" value="" color="#000000" /> : null}
              <Picker.Item label="Correo" value="Correo" color="#000000" />
              <Picker.Item label="Teléfono" value="Telefono" color="#000000" />
              <Picker.Item label="Presencial" value="Presencial" color="#000000" />
              <Picker.Item label="Otro" value="Otro" color="#000000" />
            </Picker>
          </ThemedView>
        </ThemedView>

        {/* Tipo de cliente */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Tipo de cliente</ThemedText>
          <ThemedView style={styles.pickerContainer}>
            <Picker
              selectedValue={
                isEditing
                  ? tipoCliente
                  : tipoCliente || tipoClienteOpcionesPicker[0]?.nombre || 'Publico'
              }
              onValueChange={setTipoCliente}
              style={styles.picker}
            >
              {isEditing ? <Picker.Item label="Seleccionar" value="" color="#000000" /> : null}
              {tipoClienteOpcionesPicker.map((opt) => (
                <Picker.Item
                  key={`tipo-cliente-${opt.id}-${opt.nombre}`}
                  label={opt.nombre}
                  value={opt.nombre}
                  color="#000000"
                />
              ))}
            </Picker>
          </ThemedView>
        </ThemedView>
        
        {/* Tipo de queja */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Tipo de queja</ThemedText>
          <ThemedView style={styles.pickerContainer}>
            <Picker
              selectedValue={
                isEditing
                  ? tipoQueja
                  : tipoQueja || tipoQuejaOpcionesPicker[0]?.nombre || 'Publico'
              }
              onValueChange={setTipoQueja}
              style={styles.picker}
            >
              {isEditing ? <Picker.Item label="Seleccionar" value="" color="#000000" /> : null}
              {tipoQuejaOpcionesPicker.map((opt) => (
                <Picker.Item
                  key={`tipo-queja-${opt.id}-${opt.nombre}`}
                  label={opt.nombre}
                  value={opt.nombre}
                  color="#000000"
                />
              ))}
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
              selectedValue={isEditing ? nivelQueja : (nivelQueja || 'Leve')}
              onValueChange={setNivelQueja}
              style={styles.picker}
            >
              {isEditing ? <Picker.Item label="Seleccionar" value="" color="#000000" /> : null}
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
        
        {/* Estimacion de daño */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Estimacion de daño</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="Estimacion de daño"
            placeholderTextColor="#999"
            value={estimacionDannio}
            onChangeText={setEstimacionDannio}
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

        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>
            {isEditing ? 'Añadir archivos nuevos' : 'Agregar archivos'}
          </ThemedText>
          {isEditing ? (
            <ThemedText style={styles.formHintText}>
              Aquí solo ves los que vas a agregar en este guardado. Para ver o eliminar adjuntos ya
              guardados, usa el listado principal.
            </ThemedText>
          ) : null}

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
                    source={localImagePreviewSource(file)}
                    style={styles.filePreviewImage}
                    resizeMode="cover"
                  />
                  <ThemedText numberOfLines={1} style={styles.fileName}>{file.name}</ThemedText>
                  <TouchableOpacity onPress={() => void removeLocalFile('image', file)}>
                    <Ionicons name="trash" size={16} color="#FF3B30" />
                  </TouchableOpacity>
                </ThemedView>
              ))}

              {audioFiles.map(file => (
                <ThemedView key={file.id} style={styles.fileRow}>
                  <Ionicons name="musical-notes-outline" size={16} color="#007AFF" />
                  <ThemedText numberOfLines={1} style={styles.fileName}>{file.name}</ThemedText>
                  <TouchableOpacity onPress={() => void removeLocalFile('audio', file)}>
                    <Ionicons name="trash" size={16} color="#FF3B30" />
                  </TouchableOpacity>
                </ThemedView>
              ))}

              {videoFiles.map(file => (
                <ThemedView key={file.id} style={styles.fileRow}>
                  <Ionicons name="videocam-outline" size={16} color="#007AFF" />
                  <ThemedText numberOfLines={1} style={styles.fileName}>{file.name}</ThemedText>
                  <TouchableOpacity onPress={() => void removeLocalFile('video', file)}>
                    <Ionicons name="trash" size={16} color="#FF3B30" />
                  </TouchableOpacity>
                </ThemedView>
              ))}

              {documentFiles.map(file => (
                <ThemedView key={file.id} style={styles.fileRow}>
                  <Ionicons name="document-text-outline" size={16} color="#007AFF" />
                  <ThemedText numberOfLines={1} style={styles.fileName}>{file.name}</ThemedText>
                  <TouchableOpacity onPress={() => void removeLocalFile('document', file)}>
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
    if (isListLoading) {
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
      const needSucursal =
        hasCurrentMarca && !isOperativo && filterCorpoId == null;
      return (
        <ThemedView style={styles.centerContainer}>
          <ThemedText style={styles.emptyText}>
            {needSucursal
              ? 'Seleccione sucursal (corpo) en los filtros o use la marca actual con sucursal para ver quejas.'
              : 'No hay quejas registradas para esta sucursal'}
          </ThemedText>
        </ThemedView>
      );
    }

    return (
      <ThemedView style={styles.listContainer}>
        {complaints.map((record, index) => {
          const recordId = String(record.id || record.id_local || index);
          const isDeletingThis = deletingRecordKey === recordId;
          const isExpanded = expandedRecordIds.includes(recordId);
          const isOffline = !record.synced || record.id_local;
          const serverComplaintIdNum = parseInt(String(record.id), 10);
          const hasFiles = Array.isArray(record.files) && record.files.length > 0;
          const hasLocalMedia =
            hasFiles && record.files!.some(f => f.local_uri && String(f.local_uri).trim() !== '');
          const serverPlaybackOk =
            !complaintsMasterIsPendingLocal(record) &&
            Number.isFinite(serverComplaintIdNum) &&
            serverComplaintIdNum > 0;
          const canShowListFilePlayback = hasFiles && (serverPlaybackOk || hasLocalMedia);

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
                <ThemedText style={styles.detailLabel}>Estimación de daño: </ThemedText>
                {record.estimacion_dannio || 'Sin estimación'}
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

              {canShowListFilePlayback && (
                <ComplaintFilesViewer
                  variant="list"
                  complaintId={record.id || record.id_local}
                  files={record.files!}
                  accessToken={effectiveMediaToken}
                  onDeleteFile={deleteAttachedFileForListRecord(record)}
                />
              )}

                <ThemedView style={styles.listItemActions}>
                  {isOffline && (
                    <ThemedView style={styles.offlineBadge}>
                      <ThemedText style={styles.offlineBadgeText}>Offline</ThemedText>
                    </ThemedView>
                  )}
              </ThemedView>

              <ThemedView style={styles.collapsableSection}>
                <TouchableOpacity
                  style={styles.listCardFilesHeader}
                  onPress={() => toggleExpanded(recordId)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isExpanded }}
                >
                  <ThemedText style={styles.collapsableHeaderText}>
                    {isExpanded ? 'Ocultar detalles de la queja' : 'Ver detalles de la queja'}
                  </ThemedText>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color="#007AFF"
                  />
              </TouchableOpacity>

                {isExpanded ? (
                  <ThemedView style={styles.collapsableContent}>
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

                  <ThemedText style={styles.detailText}>
                      <ThemedText style={styles.detailLabel}>Fecha de registro: </ThemedText>
                    {new Date(record.created_at).toLocaleDateString('es-CR')}
                  </ThemedText>
                  </ThemedView>
                ) : null}
              </ThemedView>
                  <ThemedView style={styles.listItemButtons}>
                    <TouchableOpacity
                      style={[styles.listItemButton, styles.editButton]}
                  onPress={() => void startEditing(record)}
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
                  style={[styles.listItemButton, styles.deleteButton, isDeletingThis && styles.buttonDisabled]}
                      onPress={() => deleteComplaintHandler(record)}
                  disabled={isDeletingThis}
                    >
                  {isDeletingThis ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="trash" size={20} color="#FFFFFF" />
                      <ThemedText style={styles.listItemButtonText}>Eliminar</ThemedText>
                    </>
                  )}
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
                No se encontró la marca actual. Puede seleccionar la jerarquía manualmente en los filtros.
              </ThemedText>
            </ThemedView>
          )}

          <>
              {!isCreating && !editingRecord && !isOperativo && (
                <ThemedView style={styles.filtersMain}>
                  <ThemedView style={styles.filterHeader}>
                    <TouchableOpacity
                      style={styles.filterToggleButton}
                      onPress={() => setIsFiltersExpanded(!isFiltersExpanded)}
                    >
                      <ThemedText style={styles.filterToggleText}>Filtros</ThemedText>
                      <Ionicons
                        name={isFiltersExpanded ? 'chevron-up' : 'chevron-down'}
                        size={20}
                        color="#007AFF"
                      />
                    </TouchableOpacity>
                    {isFiltersExpanded && (
                      <TouchableOpacity
                        style={styles.resetFiltersButton}
                        onPress={() => {
                          setFilterEmpresaId(marcaEmpresaId);
                          setFilterClienteId(marcaClienteId);
                          setFilterDivisionId(marcaDivisionId);
                          setFilterContratoId(marcaContratoId);
                          setFilterCorpoId(marcaCorpoId);
                        }}
                      >
                        <Ionicons name="refresh" size={16} color="#FF3B30" />
                        <ThemedText style={styles.resetFiltersText}>Reiniciar</ThemedText>
                      </TouchableOpacity>
                    )}
                  </ThemedView>
                  {isFiltersExpanded && (
                    <ThemedView style={styles.filterContent}>
                      <ThemedText style={[styles.subtitle, { textAlign: 'left', marginBottom: 6 }]}>
                        El listado se carga al elegir sucursal (o con la sucursal de la marca actual).
                      </ThemedText>
                      <HierarchyPickerFields
                        structure={structure}
                        levels={['cliente', 'contrato', 'sucursal']}
                        isLoading={isStructureLoading}
                        values={{
                          empresaId: filterEmpresaId,
                          clienteId: filterClienteId,
                          divisionId: filterDivisionId,
                          contratoId: filterContratoId,
                          sucursalId: filterCorpoId,
                        }}
                        onChange={handleFilterHierarchyChange}
                        labels={{ sucursal: 'Sucursal (Corpo)' }}
                        renderLabel={(text) => <ThemedText style={styles.filterLabel}>{text}</ThemedText>}
                        pickerStyle={styles.picker}
                        fieldGroupStyle={styles.filterGroup}
                      />
                    </ThemedView>
                  )}
                </ThemedView>
              )}
              {!isCreating && !editingRecord && !isListLoading && (
                <TouchableOpacity style={styles.createButton} onPress={() => void startCreating()}>
                  <Ionicons name="add" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              )}

              {isCreating && renderForm(false)}
              {editingRecord && renderForm(true)}
              {!isCreating && !editingRecord && renderList()}
          </>
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
  filtersMain: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    width: '100%',
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  filterToggleButton: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterToggleText: { fontSize: 14, fontWeight: '600', color: '#007AFF' },
  resetFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#FFECEC',
  },
  resetFiltersText: { fontSize: 12, color: '#FF3B30', fontWeight: '600' },
  filterContent: { padding: 12, backgroundColor: '#F9F9F9', gap: 8 },
  filterGroup: { marginBottom: 12 },
  filterLabel: { fontSize: 13, fontWeight: '600', marginBottom: 4, color: '#333' },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
  },
  formHierarchySection: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    backgroundColor: '#F9F9F9',
  },
  formHierarchyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 8,
  },
  formHintText: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 8,
    color: '#000000',
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
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
  listCardFilesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F0F0F0',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
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
  variant = 'default',
}: {
  complaintId: string | number;
  files: ComplaintFile[];
  accessToken?: string | null;
  onDeleteFile?: (file: ComplaintFile) => void;
  /** `list`: encabezado de tarjeta en el listado; el contenido solo se monta al expandir (sin peticiones hasta entonces). */
  variant?: 'default' | 'list';
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const list = Array.isArray(files) ? files : [];
  if (list.length === 0) return null;

  const imageFiles = list.filter(f => f.type === 'image');
  const audioFiles = list.filter(f => f.type === 'audio');
  const videoFiles = list.filter(f => f.type === 'video');
  const documentFiles = list.filter(f => f.type === 'document' || (!f.type && f.extension));

  const filesBody = (
    <>
          {imageFiles.length > 0 && (
            <ThemedView style={styles.viewerSection}>
              <ThemedText style={styles.viewerSectionTitle}>Imágenes</ThemedText>
              {imageFiles.map(file => (
                <ThemedView key={file.id} style={{ backgroundColor: 'transparent' }}>
                  <ComplaintImageViewer
                imageUrl={resolveComplaintFileMediaUri(complaintId, file, accessToken)}
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
                sourceUrl={resolveComplaintFileMediaUri(complaintId, file, accessToken)}
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
                sourceUrl={resolveComplaintFileMediaUri(complaintId, file, accessToken)}
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
                const url = resolveComplaintFileMediaUri(complaintId, file, accessToken);
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
    </>
  );

  const headerStyle = variant === 'list' ? styles.listCardFilesHeader : styles.collapsableHeader;
  const headerTitle =
    variant === 'list' ? `Archivos adjuntos (${list.length})` : `Archivos (${list.length})`;

  return (
    <ThemedView style={[styles.collapsableSection, { marginBottom : 0 }]}>
      <TouchableOpacity
        style={[headerStyle, { marginBottom : 0 }]}
        onPress={() => setIsExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpanded }}
      >
        <ThemedText style={styles.collapsableHeaderText}>{headerTitle}</ThemedText>
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color="#007AFF"
        />
      </TouchableOpacity>

      {isExpanded ? (
        <ThemedView style={styles.collapsableContent}>{filesBody}</ThemedView>
      ) : null}
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

