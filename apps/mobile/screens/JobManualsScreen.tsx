import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Dimensions, Image, Linking, Modal, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Network from 'expo-network';
import getCurrentUserDigitalSignature from '../hooks/getCurrentUserDigitalSignature';
import * as DocumentPicker from 'expo-document-picker';
import { Picker } from '@react-native-picker/picker';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { useAuth } from '../contexts/AuthContext';
import { ThemedView } from '../components/ThemedView';
import CambiosAppsModulesModal, { type CambiosAppsModulesRow } from '@/components/CambiosAppsModulesModal';
import { ThemedText } from '../components/ThemedText';
import AppHeader from '../components/AppHeader';
import AppFooter from '../components/AppFooter';
import SlideMenu from '../components/SlideMenu';
import { eventBus } from '../hooks/eventBus';
import { appendJobManualPuestos, createJobManual, listJobManualsByPuesto, deleteJobManual, signJobManual, putJobManualQuizResult } from '../hooks/jobManualsFunctions';
import {
  getManualPuestoId,
  manualIsVisibleForPuesto,
  mergeJobManualsCacheForPuesto,
  patchJobManualPuestosVinculadosInCache,
} from '../hooks/jobManualsCacheHelpers';
import { loadMainStructureTreeMerged } from '@/hooks/bitacoraMainStructureCache';
import { saveFile, getFile, deleteFile, getLocalFileDisplayUri, type StoredFileType } from '../hooks/fileStorage';
import getHoraAccion from '../hooks/getHoraAccion';
import { syncUnsyncedJobManualByLocalId } from '../hooks/jobManualsQueueUtils';
import { useQRScanner } from '../hooks/useQRScanner';
import authedFetch from '../hooks/authedFetch';
import getValidAccessTokenOrLogout from '../hooks/getValidAccessTokenOrLogout';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import { convertDateTimestampToLocalString } from '@/hooks/convertDateTimestampToLocalString';
import HierarchyPickerFields, { type HierarchyPickerValues } from '@/components/HierarchyPickerFields';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

function ScalePressButton({
  children,
  onPress,
  disabled,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: object | object[];
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () => {
    if (disabled) return;
    Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, friction: 6 }).start();
  };
  const pressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5 }).start();
  };
  return (
    <AnimatedTouchable
      activeOpacity={1}
      disabled={disabled}
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      style={[style, { transform: [{ scale }] }]}
    >
      {children}
    </AnimatedTouchable>
  );
}

type JobManualsNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

type RoleName = 'OPERATIVO' | 'SUPERVISOR' | 'ADMINISTRATIVO' | string | null;

interface Puesto {
  id: number;
  nombre: string;
}

type MainStructurePlazaNode = { id: number; nombre: string };
type MainStructurePuestoNode = { id: number; nombre: string; plazas: MainStructurePlazaNode[] };
type MainStructureSucursalNode = { id: number; nombre: string; puestos: MainStructurePuestoNode[] };
type MainStructureContratoNode = { id: number; nombre: string; sucursales: MainStructureSucursalNode[] };
type MainStructureDivisionNode = { id: number; nombre: string; contratos: MainStructureContratoNode[] };
type MainStructureClienteNode = { id: number; nombre: string; division: MainStructureDivisionNode[] };
type MainStructureEmpresaNode = { id: number; nombre: string; clientes: MainStructureClienteNode[] };
type MainStructureTree = MainStructureEmpresaNode[];

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

interface ManualFileLocal {
  id: string;
  type: 'image' | 'audio' | 'video' | 'document';
  name: string;
  extension: string;
  base64: string;
  uri?: string;
  mimeType?: string;
  /** Archivo en documentos (evita base64 en memoria / cola de sync) */
  localFileName?: string;
}

interface ManualFileRemote {
  id: number;
  type: string;
  extension: string;
  name: string;
  original_name?: string;
  url: string;
  base64?: string;
  mimeType?: string;
  id_local?: string;
  synced?: boolean;
  localFileName?: string;
}

interface JobManualRemote {
  id: number;
  title: string;
  description: string;
  quiz?: string | null;
  firma: string;
  puesto: {
    id: number;
    nombre: string;
  };
  created_by: string;
  created_at: string;
  files: ManualFileRemote[];
  visualizaciones: {
    id: number;
    empleado_id: number;
    manual_puesto_id: number;
    nombre_empleado: string;
    firma_empleado: string;
    quiz_answear?: string | null;
    approved?: boolean | null;
    created_at: string;
    updated_at?: string;
    approved_pending?: boolean; // solo para UI offline (no viene del server)
    files?: ManualFileRemote[];
  }[];
  currentEmployeeSigned: boolean;
  id_local?: string;
  synced?: boolean;
  /** Opcional en caché / normalización; preferir `puesto.id`. */
  puesto_id?: number;
  isActive?: boolean;
  corpo_id?: number | null;
  empresa_id?: number | null;
  cliente_id?: number | null;
  division_id?: number | null;
  contrato_id?: number | null;
  /** Puestos vinculados (misma lógica que e_puestos_manual_puesto); offline y merge en caché. */
  puestos_vinculados_ids?: number[];
}

/**
 * Quiz ya calificado (GET o caché): `approved` distinto de null; `updated_at` acompaña al resultado
 * al calificar. Firma recién creada: `approved` null aunque tenga `updated_at` de alta.
 */
function isVisualizationQuizGraded(vis: {
  approved?: boolean | null;
  updated_at?: string;
  approved_pending?: boolean;
}): boolean {
  if (vis.approved_pending) return false;
  const hasApproved = vis.approved === true || vis.approved === false;
  if (!hasApproved) return false;
  // Tras calificar, API y caché guardan el par; sin `updated_at` en datos viejos, confiar en `approved`.
  return vis.updated_at != null && String(vis.updated_at).trim() !== ''
    ? true
    : hasApproved;
}

export default function JobManualsScreen() {
  const { employee, refreshAccessToken, logout, accessToken } = useAuth();
  const navigation = useNavigation<JobManualsNavigationProp>();
  const [isMenuVisible, setIsMenuVisible] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [hasMarca, setHasMarca] = useState(false);
  const [marcaId, setMarcaId] = useState<number | null>(null);
  const [roleName, setRoleName] = useState<RoleName>(null);
  const [puestoActualNombre, setPuestoActualNombre] = useState<string>('');

  const [isCreating, setIsCreating] = useState(false);
  const [isCreatingManual, setIsCreatingManual] = useState(false);
  const [isDeletingManual, setIsDeletingManual] = useState(false);
  const [manuals, setManuals] = useState<JobManualRemote[]>([]);
  const [isLoadingManuals, setIsLoadingManuals] = useState(false);
  const [selectedManual, setSelectedManual] = useState<JobManualRemote | null>(null);
  const [isViewerVisible, setIsViewerVisible] = useState(false);
  const [viewSignature, setViewSignature] = useState<string | null>(null);
  const [viewFirmaData, setViewFirmaData] = useState<FirmaData | null>(null);
  const [isGeneratingViewFirma, setIsGeneratingViewFirma] = useState(false);
  const [isSigningManual, setIsSigningManual] = useState(false);
  const [viewTextFiles, setViewTextFiles] = useState<ManualFileLocal[]>([]);
  const [viewImageFiles, setViewImageFiles] = useState<ManualFileLocal[]>([]);
  const [viewAudioFiles, setViewAudioFiles] = useState<ManualFileLocal[]>([]);
  const [viewVideoFiles, setViewVideoFiles] = useState<ManualFileLocal[]>([]);

  // ----------------------
  // Quiz (visualización / respuestas)
  // ----------------------
  const [quizUserAnswers, setQuizUserAnswers] = useState<Record<string, string | string[]>>({});
  const [openListQuestionId, setOpenListQuestionId] = useState<string | null>(null);
  const [retakeAllowed, setRetakeAllowed] = useState(false);
  const [updatingQuizResultByEmployee, setUpdatingQuizResultByEmployee] = useState<Record<number, boolean>>({});

  // Quiz (revisión - puntajes por pregunta)
  const [quizReviewScores, setQuizReviewScores] = useState<Record<string, Record<string, number>>>({}); // {empleadoId: {questionId: score}}

  const tituloRef = useRef('');
  const descripcionRef = useRef('');

  const [selectedPuestos, setSelectedPuestos] = useState<number[]>([]);

  const [structure, setStructure] = useState<MainStructureTree>([]);
  const structureRef = useRef<MainStructureTree>([]);
  const [isStructureLoading, setIsStructureLoading] = useState(false);
  const [assignToAllDivision, setAssignToAllDivision] = useState(false);
  const [selectedDivisionForAll, setSelectedDivisionForAll] = useState<number | null>(null);
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<number | null>(null);
  const [selectedClienteId, setSelectedClienteId] = useState<number | null>(null);
  const [selectedDivisionId, setSelectedDivisionId] = useState<number | null>(null);
  const [selectedContratoId, setSelectedContratoId] = useState<number | null>(null);
  const [selectedSucursalId, setSelectedSucursalId] = useState<number | null>(null);
  const [selectedPuestoId, setSelectedPuestoId] = useState<number | null>(null);
  const [hasConfirmedPuestos, setHasConfirmedPuestos] = useState(false);
  const [isSelectedPuestosExpanded, setIsSelectedPuestosExpanded] = useState(false);

  /** Filtro de lista principal (solo no OPERATIVO) — precarga desde current_marca. */
  const [filterEmpresaId, setFilterEmpresaId] = useState<number | null>(null);
  const [filterClienteId, setFilterClienteId] = useState<number | null>(null);
  const [filterDivisionId, setFilterDivisionId] = useState<number | null>(null);
  const [filterContratoId, setFilterContratoId] = useState<number | null>(null);
  const [filterSucursalId, setFilterSucursalId] = useState<number | null>(null);
  const [filterPuestoId, setFilterPuestoId] = useState<number | null>(null);
  const listFiltersSyncedFromMarcaOnceRef = useRef(false);
  const filterSucursalIdRef = useRef<number | null>(null);
  /** puesto_id de la marca activa (lista OPERATIVO). */
  const [marcaPuestoIdFromMarca, setMarcaPuestoIdFromMarca] = useState<number | null>(null);
  /** corpo_id (sucursal) de la marca — listado offline OPERATIVO. */
  const [marcaCorpoIdFromMarca, setMarcaCorpoIdFromMarca] = useState<number | null>(null);
  const [isListFiltersExpanded, setIsListFiltersExpanded] = useState(false);

  /** Modal "Actualizar puestos" (misma jerarquía que en creación) */
  const [isUpdManualPuestosModalVisible, setIsUpdManualPuestosModalVisible] = useState(false);
  const [updManualForPuestos, setUpdManualForPuestos] = useState<JobManualRemote | null>(null);
  const [isSubmittingUpdManualPuestos, setIsSubmittingUpdManualPuestos] = useState(false);
  const [updAssignToAllDivision, setUpdAssignToAllDivision] = useState(false);
  const [updSelectedDivisionForAll, setUpdSelectedDivisionForAll] = useState<number | null>(null);
  const [updEmpresaId, setUpdEmpresaId] = useState<number | null>(null);
  const [updClienteId, setUpdClienteId] = useState<number | null>(null);
  const [updDivisionId, setUpdDivisionId] = useState<number | null>(null);
  const [updContratoId, setUpdContratoId] = useState<number | null>(null);
  const [updSucursalId, setUpdSucursalId] = useState<number | null>(null);
  const [updPuestoId, setUpdPuestoId] = useState<number | null>(null);
  const [updSelectedPuestos, setUpdSelectedPuestos] = useState<number[]>([]);
  const [updHasConfirmedPuestos, setUpdHasConfirmedPuestos] = useState(false);
  const [updIsSelectedPuestosExpanded, setUpdIsSelectedPuestosExpanded] = useState(false);

  const [isCambiosModalVisible, setIsCambiosModalVisible] = useState(false);
  const [cambiosTitle, setCambiosTitle] = useState('Cambios');
  const [cambiosItems, setCambiosItems] = useState<CambiosAppsModulesRow[]>([]);

  const [textFiles, setTextFiles] = useState<ManualFileLocal[]>([]);
  const [imageFiles, setImageFiles] = useState<ManualFileLocal[]>([]);
  const [audioFiles, setAudioFiles] = useState<ManualFileLocal[]>([]);
  const [videoFiles, setVideoFiles] = useState<ManualFileLocal[]>([]);

  const [firmaResponsable, setFirmaResponsable] = useState<FirmaData | null>(null);
  const [isGeneratingFirma, setIsGeneratingFirma] = useState(false);


  const { scanQR, QRScannerComponent } = useQRScanner();

  // ----------------------
  // Quiz (creación)
  // ----------------------
  type QuizQuestionType = 'short' | 'paragraph' | 'multiple_choice' | 'multiple_select' | 'list';
  type QuizQuestion = {
    id: string;
    title: string;
    type: QuizQuestionType;
    options?: string[];
    answer?: string;
    answers?: string[];
    points: number; // Puntaje de la pregunta (obligatorio)
  };

  type QuizConfig = {
    questions: QuizQuestion[];
    minApprovalPercentage?: number; // Porcentaje mínimo de aprobación
  };

  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizMinApprovalPercentage, setQuizMinApprovalPercentage] = useState<number>(70);
  const [isQuizModalVisible, setIsQuizModalVisible] = useState(false);
  const [quizTempTitle, setQuizTempTitle] = useState('');
  const [quizTempType, setQuizTempType] = useState<QuizQuestionType>('short');
  const [quizTempOptions, setQuizTempOptions] = useState<string[]>([]);
  const [quizTempOptionInput, setQuizTempOptionInput] = useState('');
  const [quizTempAnswer, setQuizTempAnswer] = useState('');
  const [quizTempAnswers, setQuizTempAnswers] = useState<string[]>([]);
  const [quizTempPoints, setQuizTempPoints] = useState<string>('');
  const [isSavingQuizQuestion, setIsSavingQuizQuestion] = useState(false);

  const getDivisionIdFromMarcaJson = (marca: any): number | null => {
    const raw =
      marca?.roleDivision?.division?.id ??
      marca?.role_division?.division?.id ??
      marca?.division?.id ??
      marca?.division_id;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const appendTokenToUrl = useCallback((url: string) => {
    if (!url) return '';
    if (!accessToken || accessToken.trim().length === 0) return url;
    if (/[?&]token=/.test(url)) return url;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}token=${encodeURIComponent(accessToken)}`;
  }, [accessToken]);

  // Helpers para construir URLs de archivos en el servidor (similar a IncidentsScreen)
  const getManualImageUrl = (manualId: number, fileName: string) => {
    console.log("Accediendo a la imagen: ", fileName);
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) return '';
    return appendTokenToUrl(`${apiUrl}/api/job-manuals/${manualId}/get-image/${encodeURIComponent(fileName)}`);
  };

  const getManualAudioUrl = (manualId: number, fileName: string) => {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) return '';
    return appendTokenToUrl(`${apiUrl}/api/job-manuals/${manualId}/get-audio/${encodeURIComponent(fileName)}`);
  };

  const getManualVideoUrl = (manualId: number, fileName: string) => {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) return '';
    return appendTokenToUrl(`${apiUrl}/api/job-manuals/${manualId}/get-video/${encodeURIComponent(fileName)}`);
  };

  const buildFileUrl = (manualId: number | undefined, file: ManualFileRemote) => {
    if (file.localFileName) {
      const uri = getLocalFileDisplayUri(String(file.localFileName));
      if (uri) return uri;
    }
    // Si es registro offline (tiene id_local no vacío), usamos base64
    const hasLocalId = file.id_local !== undefined && file.id_local !== null && file.id_local !== '';
    if (hasLocalId && file.base64) {
      const mime = file.mimeType || (file.type ? `${file.type}/${file.extension || 'octet-stream'}` : `application/${file.extension || 'octet-stream'}`);
      return `data:${mime};base64,${file.base64}`;
    }

    // Para registros sincronizados, preferir siempre la API
    if (manualId) {
      if (file.type === 'image') return getManualImageUrl(manualId, file.name);
      if (file.type === 'audio') return getManualAudioUrl(manualId, file.name);
      if (file.type === 'video') return getManualVideoUrl(manualId, file.name);
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (apiUrl) return appendTokenToUrl(`${apiUrl}/api/job-manuals/${manualId}/get-file/${encodeURIComponent(file.name)}`);
    }

    // Último recurso: URL ya provista (no añadir token a file/content/data)
    if (file.url) {
      const u = file.url;
      if (/^(file|content|data):/i.test(String(u).trim())) return u;
      return appendTokenToUrl(file.url);
    }

    return '';
  };

  const getRemoteFileDisplayName = (file: ManualFileRemote) => {
    const candidate = (file.original_name ?? '').trim();
    return candidate.length > 0 ? candidate : file.name;
  };

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

  const fetchCambios = useCallback(
    async (tabla: string, registroId: number) => {
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
            headers: { 'Content-Type': 'application/json' },
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
        Alert.alert('Error', e?.message || 'No se pudieron cargar los cambios');
      }
    },
    [refreshAccessToken, logout],
  );

  const fetchMainStructure = useCallback(async () => {
    if (structureRef.current.length > 0) {
      setStructure(structureRef.current);
      return;
    }
    try {
      setIsStructureLoading(true);
      const merged = await loadMainStructureTreeMerged();
      const next = Array.isArray(merged) ? merged : [];
      structureRef.current = next;
      setStructure(next);
    } catch (error) {
      console.error('Error fetching main structure for job manuals:', error);
      structureRef.current = [];
      setStructure([]);
    } finally {
      setIsStructureLoading(false);
    }
  }, []);

  const syncMarcaContextFromStorage = useCallback(
    async (opts?: { applyFiltersFromMarca?: boolean }) => {
      const applyFiltersFromMarca = opts?.applyFiltersFromMarca !== false;
      const currentMarcaStr = await AsyncStorage.getItem('current_marca');
      if (!currentMarcaStr) {
        setHasMarca(false);
        setMarcaId(null);
        setPuestoActualNombre('');
        setRoleName(null);
        setMarcaPuestoIdFromMarca(null);
        setMarcaCorpoIdFromMarca(null);
        if (applyFiltersFromMarca) {
          setFilterEmpresaId(null);
          setFilterClienteId(null);
          setFilterDivisionId(null);
          setFilterContratoId(null);
          setFilterSucursalId(null);
          filterSucursalIdRef.current = null;
          setFilterPuestoId(null);
        }
        return;
      }

      try {
        const currentMarca = JSON.parse(currentMarcaStr);
        if (!currentMarca?.id) {
          setHasMarca(false);
          setMarcaId(null);
          return;
        }
        setHasMarca(true);
        setMarcaId(Number(currentMarca.id));
        setPuestoActualNombre(currentMarca.puesto?.nombre || '');
        const role = currentMarca.roleDivision?.role?.nombre ?? currentMarca.role_division?.role?.nombre ?? null;
        setRoleName(typeof role === 'string' ? role : null);
        const pid = currentMarca.puesto?.id != null ? Number(currentMarca.puesto.id) : null;
        setMarcaPuestoIdFromMarca(Number.isFinite(pid as number) && (pid as number) > 0 ? pid : null);
        const corpoM = currentMarca.corpo?.id != null ? Number(currentMarca.corpo.id) : null;
        setMarcaCorpoIdFromMarca(Number.isFinite(corpoM as number) && (corpoM as number) > 0 ? corpoM : null);

        if (applyFiltersFromMarca) {
          const divId = getDivisionIdFromMarcaJson(currentMarca);
          const fs = currentMarca.corpo?.id != null ? Number(currentMarca.corpo.id) : null;
          setFilterEmpresaId(currentMarca.empresa?.id != null ? Number(currentMarca.empresa.id) : null);
          setFilterClienteId(currentMarca.cliente?.id != null ? Number(currentMarca.cliente.id) : null);
          setFilterDivisionId(divId);
          setFilterContratoId(currentMarca.contrato?.id != null ? Number(currentMarca.contrato.id) : null);
          setFilterSucursalId(fs);
          filterSucursalIdRef.current = fs;
          setFilterPuestoId(pid != null && Number.isFinite(pid) && pid > 0 ? pid : null);
        }
      } catch (error) {
        console.error('Error syncing marca for job manuals:', error);
        setHasMarca(false);
      }
    },
    []
  );

  const resetListFiltersFromCurrentMarca = useCallback(async () => {
    await syncMarcaContextFromStorage({ applyFiltersFromMarca: true });
  }, [syncMarcaContextFromStorage]);

  const handleFilterHierarchyChange = useCallback((v: HierarchyPickerValues) => {
    setFilterEmpresaId(v.empresaId);
    setFilterClienteId(v.clienteId);
    setFilterDivisionId(v.divisionId);
    setFilterContratoId(v.contratoId);
    filterSucursalIdRef.current = v.sucursalId;
    setFilterSucursalId(v.sucursalId);
    setFilterPuestoId(v.puestoId ?? null);
  }, []);

  const handleFormHierarchyChange = useCallback((v: HierarchyPickerValues) => {
    setSelectedEmpresaId(v.empresaId);
    setSelectedClienteId(v.clienteId);
    setSelectedDivisionId(v.divisionId);
    setSelectedContratoId(v.contratoId);
    setSelectedSucursalId(v.sucursalId);
    setSelectedPuestoId(v.puestoId ?? null);
    setHasConfirmedPuestos(false);
    setIsSelectedPuestosExpanded(false);
  }, []);

  const handleUpdPHierarchyChange = useCallback((v: HierarchyPickerValues) => {
    setUpdEmpresaId(v.empresaId);
    setUpdClienteId(v.clienteId);
    setUpdDivisionId(v.divisionId);
    setUpdContratoId(v.contratoId);
    setUpdSucursalId(v.sucursalId);
    setUpdPuestoId(v.puestoId ?? null);
    setUpdHasConfirmedPuestos(false);
    setUpdIsSelectedPuestosExpanded(false);
    setUpdSelectedPuestos([]);
  }, []);

  useEffect(() => {
    filterSucursalIdRef.current = filterSucursalId;
  }, [filterSucursalId]);

  const fetchManuals = useCallback(
    async (_marcaIdToUse: number, listPuestoId: number | null) => {
      try {
        setIsLoadingManuals(true);
        if (listPuestoId == null || !Number.isFinite(Number(listPuestoId)) || Number(listPuestoId) <= 0) {
          setManuals([]);
          return;
        }
        const puestoIdNum = Number(listPuestoId);

        /** El GET ya filtra por `puesto_id`; no excluir por `corpo_id` del registro (puede diferir del filtro jerárquico). */
        const manualsForListScope = (cacheArr: JobManualRemote[]) =>
          cacheArr.filter((m) => manualIsVisibleForPuesto(m, puestoIdNum));

        const isConnected = await getConnectionStatus();

        if (isConnected) {
          const result = await listJobManualsByPuesto({
            puestoId: puestoIdNum,
            refreshAccessToken,
            logout,
          });

          if (result.status && Array.isArray(result.manuals)) {
            const list = (result.manuals as JobManualRemote[]).filter((m) => m?.isActive !== false);
            const cacheStr = await AsyncStorage.getItem('job_manuals_cache');
            const existing: JobManualRemote[] = cacheStr ? JSON.parse(cacheStr) : [];
            const merged = mergeJobManualsCacheForPuesto(existing, list, puestoIdNum);
            await AsyncStorage.setItem('job_manuals_cache', JSON.stringify(merged));
            setManuals(manualsForListScope(merged));
          } else {
            const cacheStr = await AsyncStorage.getItem('job_manuals_cache');
            if (cacheStr) {
              try {
                const cache = JSON.parse(cacheStr);
                const filtered = Array.isArray(cache) ? manualsForListScope(cache) : [];
                setManuals(filtered);
              } catch {
                setManuals([]);
              }
            } else {
              setManuals([]);
            }
          }
        } else {
          const cacheStr = await AsyncStorage.getItem('job_manuals_cache');
          if (cacheStr) {
            const cache = JSON.parse(cacheStr);
            const filtered = Array.isArray(cache) ? manualsForListScope(cache) : [];
            setManuals(filtered);
          } else {
            setManuals([]);
          }
        }
      } catch (error) {
        console.error('Error fetching job manuals:', error);
        try {
          if (listPuestoId != null && Number.isFinite(Number(listPuestoId))) {
            const cacheStr = await AsyncStorage.getItem('job_manuals_cache');
            if (cacheStr) {
              const cache = JSON.parse(cacheStr);
              const puestoIdNum = Number(listPuestoId);
              const filtered = Array.isArray(cache)
                ? (cache as JobManualRemote[]).filter((m) => manualIsVisibleForPuesto(m, puestoIdNum))
                : [];
              setManuals(filtered);
            }
          }
        } catch (cacheErr) {
          console.error('Error loading job manuals from cache:', cacheErr);
        }
      } finally {
        setIsLoadingManuals(false);
      }
    },
    [refreshAccessToken, logout]
  );

  const resolveListPuestoId = useCallback((): number | null => {
    if (roleName === 'OPERATIVO') return marcaPuestoIdFromMarca;
    const fromFilter = filterPuestoId;
    if (fromFilter != null && Number.isFinite(Number(fromFilter)) && Number(fromFilter) > 0) {
      return Number(fromFilter);
    }
    return marcaPuestoIdFromMarca;
  }, [roleName, marcaPuestoIdFromMarca, filterPuestoId]);

  useEffect(() => {
    const listPuestoId = resolveListPuestoId();
    if (roleName === 'OPERATIVO' && (marcaPuestoIdFromMarca == null || !hasMarca)) return;
    void fetchManuals(marcaId ?? 0, listPuestoId);
  }, [hasMarca, marcaId, roleName, marcaPuestoIdFromMarca, filterPuestoId, fetchManuals, resolveListPuestoId]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        setIsLoading(true);
        try {
          await fetchMainStructure();
          if (!listFiltersSyncedFromMarcaOnceRef.current) {
            const marcaStr = await AsyncStorage.getItem('current_marca');
            const currentMarca = marcaStr ? JSON.parse(marcaStr) : null;
            if (currentMarca?.id) {
              await syncMarcaContextFromStorage({ applyFiltersFromMarca: true });
            } else {
              await syncMarcaContextFromStorage({ applyFiltersFromMarca: false });
            }
            listFiltersSyncedFromMarcaOnceRef.current = true;
          } else if (!cancelled) {
            await syncMarcaContextFromStorage({ applyFiltersFromMarca: false });
          }
        } catch (error) {
          console.error('Error on focus (job manuals):', error);
        } finally {
          if (!cancelled) setIsLoading(false);
        }
      })();
      const handler = () => {
        void syncMarcaContextFromStorage({ applyFiltersFromMarca: false });
      };
      eventBus.on('connectionRestored', handler);
      return () => {
        cancelled = true;
        eventBus.off('connectionRestored', handler);
      };
    }, [fetchMainStructure, syncMarcaContextFromStorage])
  );

  useEffect(() => {
    // La ubicación se solicitará cuando se inicie la creación de un nuevo manual
  }, []);

  const handleMenuPress = () => {
    setIsMenuVisible(true);
  };

  const handleMenuClose = () => {
    setIsMenuVisible(false);
  };

  const handleHomePress = () => {
    navigation.navigate('Home');
  };

  const applyCurrentMarcaToCreateHierarchy = async () => {
    try {
      const currentMarcaStr = await AsyncStorage.getItem('current_marca');
      if (!currentMarcaStr) return;
      const marca = JSON.parse(currentMarcaStr);
      if (!marca?.id) return;
      const divId = getDivisionIdFromMarcaJson(marca);
      setSelectedEmpresaId(marca.empresa?.id != null ? Number(marca.empresa.id) : null);
      setSelectedClienteId(marca.cliente?.id != null ? Number(marca.cliente.id) : null);
      setSelectedDivisionId(divId);
      setSelectedContratoId(marca.contrato?.id != null ? Number(marca.contrato.id) : null);
      setSelectedSucursalId(marca.corpo?.id != null ? Number(marca.corpo.id) : null);
      const puestoId = marca.puesto?.id != null ? Number(marca.puesto.id) : null;
      setSelectedPuestoId(puestoId != null && Number.isFinite(puestoId) && puestoId > 0 ? puestoId : null);
    } catch (e) {
      console.error('applyCurrentMarcaToCreateHierarchy:', e);
    }
  };

  const startCreating = () => {
    setIsCreating(true);
    tituloRef.current = '';
    descripcionRef.current = '';
    setSelectedPuestos([]);
    setTextFiles([]);
    setImageFiles([]);
    setAudioFiles([]);
    setVideoFiles([]);
    setFirmaResponsable(null);
    setQuizQuestions([]);
    void applyCurrentMarcaToCreateHierarchy();
  };

  const parseQuizFromManual = (quizStr: any): { questions: QuizQuestion[]; minApprovalPercentage?: number } => {
    if (!quizStr || typeof quizStr !== 'string') return { questions: [] };
    try {
      const parsed = JSON.parse(quizStr);

      // Si es un array (formato antiguo), convertir a nuevo formato
      if (Array.isArray(parsed)) {
        return {
          questions: parsed
            .map((q: any) => ({
              id: String(q?.id ?? ''),
              title: String(q?.title ?? ''),
              type: q?.type as QuizQuestionType,
              options: Array.isArray(q?.options) ? q.options.map((o: any) => String(o)) : undefined,
              answer: typeof q?.answer === 'string' ? q.answer : undefined,
              answers: Array.isArray(q?.answers) ? q.answers.map((o: any) => String(o)) : undefined,
              points: typeof q?.points === 'number' ? q.points : 0,
            }))
            .filter((q: any) => q.id && q.title && q.type),
          minApprovalPercentage: undefined,
        };
      }

      // Si es un objeto con el nuevo formato
      if (typeof parsed === 'object' && parsed !== null) {
        return {
          questions: Array.isArray(parsed.questions)
            ? parsed.questions
              .map((q: any) => ({
                id: String(q?.id ?? ''),
                title: String(q?.title ?? ''),
                type: q?.type as QuizQuestionType,
                options: Array.isArray(q?.options) ? q.options.map((o: any) => String(o)) : undefined,
                answer: typeof q?.answer === 'string' ? q.answer : undefined,
                answers: Array.isArray(q?.answers) ? q.answers.map((o: any) => String(o)) : undefined,
                points: typeof q?.points === 'number' ? q.points : 0,
              }))
              .filter((q: any) => q.id && q.title && q.type)
            : [],
          minApprovalPercentage: typeof parsed.minApprovalPercentage === 'number' ? parsed.minApprovalPercentage : undefined,
        };
      }

      return { questions: [] };
    } catch {
      return { questions: [] };
    }
  };

  type QuizAnswerPayloadItem = {
    question_id: string;
    type?: QuizQuestionType;
    correct_answer?: string | null;
    correct_answers?: string[] | null;
    user_answer?: string | null;
    user_answers?: string[] | null;
  };

  const parseQuizAnswersFromVisualization = (quizAnswerStr: any): QuizAnswerPayloadItem[] => {
    if (!quizAnswerStr || typeof quizAnswerStr !== 'string') return [];
    try {
      const parsed = JSON.parse(quizAnswerStr);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((x: any) => ({
          question_id: String(x?.question_id ?? ''),
          type: x?.type as QuizQuestionType,
          correct_answer: typeof x?.correct_answer === 'string' ? x.correct_answer : (x?.correct_answer ?? null),
          correct_answers: Array.isArray(x?.correct_answers) ? x.correct_answers.map((o: any) => String(o)) : (x?.correct_answers ?? null),
          user_answer: typeof x?.user_answer === 'string' ? x.user_answer : (x?.user_answer ?? null),
          user_answers: Array.isArray(x?.user_answers) ? x.user_answers.map((o: any) => String(o)) : (x?.user_answers ?? null),
        }))
        .filter((x: any) => x.question_id);
    } catch {
      return [];
    }
  };

  const getQuizTypeLabel = (t: QuizQuestionType) => {
    switch (t) {
      case 'short': return 'Respuesta corta';
      case 'paragraph': return 'Párrafo';
      case 'multiple_choice': return 'Selección única';
      case 'multiple_select': return 'Selección múltiple';
      case 'list': return 'Lista';
      default: return t;
    }
  };

  const commitQuizQuestionFromModal = () => {
    if (isSavingQuizQuestion) return;
    const title = quizTempTitle.trim();
    if (!title) {
      Alert.alert('Error', 'El título de la pregunta es obligatorio');
      return;
    }

    const needsOptions = quizTempType === 'multiple_choice' || quizTempType === 'multiple_select' || quizTempType === 'list';
    if (needsOptions && quizTempOptions.length === 0) {
      Alert.alert('Error', 'Debes agregar al menos una opción');
      return;
    }

    if ((quizTempType === 'short' || quizTempType === 'paragraph') && !quizTempAnswer.trim()) {
      Alert.alert('Error', 'Debes indicar la respuesta correcta');
      return;
    }

    if ((quizTempType === 'multiple_choice' || quizTempType === 'list') && !quizTempAnswer) {
      Alert.alert('Error', 'Selecciona la respuesta correcta');
      return;
    }

    if (quizTempType === 'multiple_select' && quizTempAnswers.length === 0) {
      Alert.alert('Error', 'Selecciona al menos una respuesta correcta');
      return;
    }

    if (!quizTempPoints.trim()) {
      Alert.alert('Error', 'El puntaje es obligatorio');
      return;
    }

    const pointsValue = parseFloat(quizTempPoints.trim());
    if (isNaN(pointsValue) || pointsValue < 0) {
      Alert.alert('Error', 'El puntaje debe ser un número válido mayor o igual a 0');
      return;
    }

    Alert.alert('Confirmar', '¿Agregar esta pregunta al quiz?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Aceptar',
        onPress: () => {
          void (async () => {
            setIsSavingQuizQuestion(true);
            try {
              const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
              let id = 'q_';
              for (let i = 0; i < 8; i++) id += chars.charAt(Math.floor(Math.random() * chars.length));

              const newQuestion: QuizQuestion = {
                id,
                title,
                type: quizTempType,
                options: needsOptions ? quizTempOptions : undefined,
                answer: (quizTempType === 'short' || quizTempType === 'paragraph' || quizTempType === 'multiple_choice' || quizTempType === 'list')
                  ? (quizTempAnswer.trim() || undefined)
                  : undefined,
                answers: quizTempType === 'multiple_select' ? quizTempAnswers : undefined,
                points: pointsValue,
              };

              setQuizQuestions(prev => [...prev, newQuestion]);
              setQuizTempTitle('');
              setQuizTempType('short');
              setQuizTempOptions([]);
              setQuizTempOptionInput('');
              setQuizTempAnswer('');
              setQuizTempAnswers([]);
              setQuizTempPoints('');
              setIsQuizModalVisible(false);
            } finally {
              setIsSavingQuizQuestion(false);
            }
          })();
        },
      },
    ]);
  };

  const handleSetQuizResult = async (manualId: number, empleadoId: number, approved: boolean) => {
    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert(
        'Confirmar',
        `¿Desea registrar el resultado del quiz como ${approved ? 'aprobado' : 'reprobado'}?`,
        [
          { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Aceptar', onPress: () => resolve(true) },
        ]
      );
    });
    if (!confirmed) return;

    try {
      const graderEmpId = typeof employee?.id === 'number' ? employee.id : Number(employee?.id || 0);
      if (Number.isFinite(graderEmpId) && graderEmpId > 0 && graderEmpId === Number(empleadoId)) {
        Alert.alert(
          'No permitido',
          'No puedes calificar tu propio intento de quiz. Debe hacerlo otro usuario con permisos de supervisión.'
        );
        return;
      }

      const marca = await AsyncStorage.getItem('current_marca');
      if (!marca) {
        Alert.alert('Error', 'No se encontró la marca');
        return;
      }
      const marcaId = JSON.parse(marca).id;
      if (!marcaId) {
        Alert.alert('Error', 'No se encontró el ID de la marca');
        return;
      }

      if (!empleadoId) return;
      if (!selectedManual) return;

      // Evitar cambios si ya hay una acción pending offline (para no "cambiar la respuesta" mientras se sincroniza)
      const currentVis = (selectedManual?.visualizaciones || []).find(v => v.empleado_id === empleadoId);
      if ((currentVis as any)?.approved_pending) {
        Alert.alert('Pendiente', 'Ya hay un cambio pendiente de sincronización para este quiz.');
        return;
      }

      if (currentVis && isVisualizationQuizGraded(currentVis)) {
        Alert.alert('Información', 'Este quiz ya fue calificado. No se puede modificar el resultado.');
        return;
      }

      setUpdatingQuizResultByEmployee(prev => ({ ...prev, [empleadoId]: true }));

      const isConnected = await getConnectionStatus();
      if (isConnected) {
        const result = await putJobManualQuizResult({
          id: manualId,
          marcaId,
          empleadoId,
          approved,
          refreshAccessToken,
          logout,
        });
        if (!result?.status) {
          throw new Error(result?.message || 'No se pudo actualizar el resultado del quiz');
        }
      } else {
        // Guardar acción offline (misma firma que consume checkJobManualsActionsCache: marcaId obligatorio)
        const actionsStr = await AsyncStorage.getItem('job_manuals_actions');
        let actions: any[] = actionsStr ? JSON.parse(actionsStr) : [];
        const sel = selectedManual;
        const isLocalUnsynced =
          sel && (!sel.id || sel.id === 0) && sel.id_local != null && String(sel.id_local).length > 0;
        actions = actions.filter((a: any) => {
          if (a.type !== 'quiz_result' || a.empleadoId !== empleadoId) return true;
          if (isLocalUnsynced && (a as any).manualLocalId) {
            return String((a as any).manualLocalId) !== String(sel!.id_local);
          }
          return a.id !== manualId;
        });
        actions.push({
          id: manualId,
          ...(isLocalUnsynced && sel?.id_local ? { manualLocalId: String(sel.id_local) } : {}),
          type: 'quiz_result',
          marcaId,
          empleadoId,
          approved,
        });
        await AsyncStorage.setItem('job_manuals_actions', JSON.stringify(actions));
      }

      const horaAccionUse = await getHoraAccion();
      const updatedIso = new Date(horaAccionUse).toISOString();
      const refManual = selectedManual;
      const isSameManualRow = (m: { id: number; id_local?: string }) => {
        if (manualId > 0) return m.id === manualId;
        if (refManual?.id_local) return String(m.id_local) === String(refManual.id_local);
        return m.id === manualId;
      };

      // Reflejar cambio en UI (selectedManual + manuals + cache)
      setSelectedManual(prev => {
        if (!prev) return prev;
        if (!isSameManualRow(prev)) return prev;
        const visualizaciones = (prev.visualizaciones || []).map(v => {
          if (v.empleado_id === empleadoId) {
            return {
              ...v,
              approved,
              approved_pending: !isConnected,
              updated_at: updatedIso,
            };
          }
          return v;
        });
        return { ...prev, visualizaciones };
      });

      setManuals(prev => prev.map(m => {
        if (!isSameManualRow(m)) return m;
        const visualizaciones = (m.visualizaciones || []).map(v => {
          if (v.empleado_id === empleadoId) {
            return {
              ...v,
              approved,
              approved_pending: !isConnected,
              updated_at: updatedIso,
            };
          }
          return v;
        });
        return { ...m, visualizaciones };
      }));

      const cacheStr = await AsyncStorage.getItem('job_manuals_cache');
      if (cacheStr) {
        const cache = JSON.parse(cacheStr);
        const updatedCache = cache.map((m: any) => {
          if (!isSameManualRow(m)) return m;
          const visualizaciones = (m.visualizaciones || []).map((v: any) => {
            if (v.empleado_id === empleadoId) {
              return {
                ...v,
                approved,
                approved_pending: !isConnected,
                updated_at: updatedIso,
              };
            }
            return v;
          });
          return { ...m, visualizaciones };
        });
        await AsyncStorage.setItem('job_manuals_cache', JSON.stringify(updatedCache));
      }

      Alert.alert('Éxito', isConnected ? 'Resultado del quiz actualizado' : 'Resultado guardado offline para sincronizarse');
    } catch (error) {
      console.error('Error updating quiz result:', error);
      Alert.alert('Error', 'No se pudo actualizar el resultado del quiz');
    } finally {
      setUpdatingQuizResultByEmployee(prev => ({ ...prev, [empleadoId]: false }));
    }
  };

  useEffect(() => {
    // Reset respuestas al cambiar manual seleccionado
    if (!selectedManual) {
      setQuizUserAnswers({});
      setOpenListQuestionId(null);
      setRetakeAllowed(false);
      return;
    }
    setQuizUserAnswers({});
    setOpenListQuestionId(null);
  }, [selectedManual?.id]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        if (!selectedManual) {
          if (!cancelled) setRetakeAllowed(false);
          return;
        }
        const empId = typeof employee?.id === 'number' ? employee.id : Number(employee?.id || 0);
        const myVis = (selectedManual.visualizaciones || []).find(v => v.empleado_id === empId);
        const approved = myVis?.approved ?? null;
        const updatedAtIso = (myVis as any)?.updated_at || myVis?.created_at;

        if (!(approved !== null && approved === false && updatedAtIso)) {
          if (!cancelled) setRetakeAllowed(false);
          return;
        }

        const updatedMs = Date.parse(String(updatedAtIso));
        if (Number.isNaN(updatedMs)) {
          if (!cancelled) setRetakeAllowed(false);
          return;
        }

        const nowMs = await getHoraAccion();
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        if (!cancelled) setRetakeAllowed(nowMs > updatedMs + sevenDays);
      } catch {
        if (!cancelled) setRetakeAllowed(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [selectedManual?.id, employee?.id, selectedManual?.visualizaciones]);

  const cancelCreating = () => {
    setIsCreating(false);
    // Limpiar formulario
    tituloRef.current = '';
    descripcionRef.current = '';
    setSelectedPuestos([]);
    setTextFiles([]);
    setImageFiles([]);
    setAudioFiles([]);
    setVideoFiles([]);
    setFirmaResponsable(null);
    setAssignToAllDivision(false);
    setSelectedDivisionForAll(null);
    setSelectedEmpresaId(null);
    setSelectedClienteId(null);
    setSelectedDivisionId(null);
    setSelectedContratoId(null);
    setSelectedSucursalId(null);
    setSelectedPuestoId(null);
    setHasConfirmedPuestos(false);
    setIsSelectedPuestosExpanded(false);
  };

  const togglePuestoSelection = (puestoId: number) => {
    setSelectedPuestos(prev => {
      if (prev.includes(puestoId)) {
        return prev.filter(id => id !== puestoId);
      }
      return [...prev, puestoId];
    });
  };

  // Función para obtener todos los puestos de una división
  const getAllPuestosFromDivision = useCallback((divisionId: number): Puesto[] => {
    if (!structure || structure.length === 0) return [];

    const seen = new Set<number>();
    const out: Puesto[] = [];

    for (const empresa of structure) {
      for (const cliente of empresa.clientes ?? []) {
        for (const division of cliente.division ?? []) {
          if (division.id === divisionId) {
            for (const contrato of division.contratos ?? []) {
              for (const sucursal of contrato.sucursales ?? []) {
                for (const puesto of sucursal.puestos ?? []) {
                  if (!seen.has(puesto.id)) {
                    seen.add(puesto.id);
                    out.push({ id: puesto.id, nombre: puesto.nombre });
                  }
                }
              }
            }
          }
        }
      }
    }

    return out;
  }, [structure]);

  const filteredPuestosFromTree: Puesto[] = useMemo(() => {
    // Si está en modo "asignar a todos los puestos de una división", retornar esos puestos
    if (assignToAllDivision && selectedDivisionForAll) {
      return getAllPuestosFromDivision(selectedDivisionForAll);
    }

    // Si no hay selección en el árbol, no sugerimos nada.
    const hasAnySelection =
      selectedEmpresaId !== null ||
      selectedClienteId !== null ||
      selectedDivisionId !== null ||
      selectedContratoId !== null ||
      selectedSucursalId !== null ||
      selectedPuestoId !== null;

    if (!hasAnySelection) return [];

    const seen = new Set<number>();
    const out: Puesto[] = [];

    for (const empresa of structure) {
      if (selectedEmpresaId !== null && empresa.id !== selectedEmpresaId) continue;
      for (const cliente of empresa.clientes ?? []) {
        if (selectedClienteId !== null && cliente.id !== selectedClienteId) continue;
        for (const division of cliente.division ?? []) {
          if (selectedDivisionId !== null && division.id !== selectedDivisionId) continue;
          for (const contrato of division.contratos ?? []) {
            if (selectedContratoId !== null && contrato.id !== selectedContratoId) continue;
            for (const sucursal of contrato.sucursales ?? []) {
              if (selectedSucursalId !== null && sucursal.id !== selectedSucursalId) continue;
              for (const puesto of sucursal.puestos ?? []) {
                if (selectedPuestoId !== null && puesto.id !== selectedPuestoId) continue;
                if (!seen.has(puesto.id)) {
                  seen.add(puesto.id);
                  out.push({ id: puesto.id, nombre: puesto.nombre });
                }
              }
            }
          }
        }
      }
    }

    return out;
  }, [
    structure,
    selectedEmpresaId,
    selectedClienteId,
    selectedDivisionId,
    selectedContratoId,
    selectedSucursalId,
    selectedPuestoId,
    assignToAllDivision,
    selectedDivisionForAll,
    getAllPuestosFromDivision,
  ]);

  const applyPuestosFromTreeConfirmed = () => {
    if (assignToAllDivision && selectedDivisionForAll) {
      const puestosFromDivision = getAllPuestosFromDivision(selectedDivisionForAll);
      if (puestosFromDivision.length === 0) {
        Alert.alert('Información', 'No se encontraron puestos para la división seleccionada.');
        return;
      }
      setSelectedPuestos(puestosFromDivision.map(p => p.id));
      setHasConfirmedPuestos(true);
      setIsSelectedPuestosExpanded(true);
      return;
    }

    if (filteredPuestosFromTree.length === 0) {
      Alert.alert('Información', 'Selecciona un nivel del árbol para obtener puestos.');
      return;
    }
    setSelectedPuestos(filteredPuestosFromTree.map(p => p.id));
    setHasConfirmedPuestos(true);
    setIsSelectedPuestosExpanded(true);
  };

  const applyPuestosFromTree = () => {
    Alert.alert('Confirmar', '¿Aplicar la selección de puestos según el filtro actual?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Aceptar', onPress: () => applyPuestosFromTreeConfirmed() },
    ]);
  };

  const empresaOptions = useMemo(() => structure ?? [], [structure]);

  const clienteOptions = useMemo(() => {
    const empresa = structure.find(e => e.id === selectedEmpresaId);
    return empresa?.clientes ?? [];
  }, [structure, selectedEmpresaId]);

  const divisionOptions = useMemo(() => {
    const cliente = clienteOptions.find(c => c.id === selectedClienteId);
    return cliente?.division ?? [];
  }, [clienteOptions, selectedClienteId]);

  const contratoOptions = useMemo(() => {
    const division = divisionOptions.find(d => d.id === selectedDivisionId);
    return division?.contratos ?? [];
  }, [divisionOptions, selectedDivisionId]);

  const sucursalOptions = useMemo(() => {
    const contrato = contratoOptions.find(c => c.id === selectedContratoId);
    return contrato?.sucursales ?? [];
  }, [contratoOptions, selectedContratoId]);

  const puestoOptions = useMemo(() => {
    const sucursal = sucursalOptions.find(s => s.id === selectedSucursalId);
    return sucursal?.puestos ?? [];
  }, [sucursalOptions, selectedSucursalId]);

  const filterEmpresaOptions = useMemo(() => structure ?? [], [structure]);
  const filterClienteOptionsMemo = useMemo(() => {
    const empresa = structure.find(e => e.id === filterEmpresaId);
    return empresa?.clientes ?? [];
  }, [structure, filterEmpresaId]);
  const filterDivisionOptionsMemo = useMemo(() => {
    const cliente = filterClienteOptionsMemo.find(c => c.id === filterClienteId);
    return cliente?.division ?? [];
  }, [filterClienteOptionsMemo, filterClienteId]);
  const filterContratoOptionsMemo = useMemo(() => {
    const division = filterDivisionOptionsMemo.find(d => d.id === filterDivisionId);
    return division?.contratos ?? [];
  }, [filterDivisionOptionsMemo, filterDivisionId]);
  const filterSucursalOptionsMemo = useMemo(() => {
    const contrato = filterContratoOptionsMemo.find(c => c.id === filterContratoId);
    return contrato?.sucursales ?? [];
  }, [filterContratoOptionsMemo, filterContratoId]);
  const filterPuestoOptionsMemo = useMemo(() => {
    const sucursal = filterSucursalOptionsMemo.find(s => s.id === filterSucursalId);
    return sucursal?.puestos ?? [];
  }, [filterSucursalOptionsMemo, filterSucursalId]);

  const puestoNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const empresa of structure) {
      for (const cliente of empresa.clientes ?? []) {
        for (const division of cliente.division ?? []) {
          for (const contrato of division.contratos ?? []) {
            for (const sucursal of contrato.sucursales ?? []) {
              for (const puesto of sucursal.puestos ?? []) {
                map.set(puesto.id, puesto.nombre);
              }
            }
          }
        }
      }
    }
    return map;
  }, [structure]);

  const selectedPuestosUi = useMemo(() => {
    return selectedPuestos
      .map((id) => ({ id, nombre: puestoNameById.get(id) || `Puesto #${id}` }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [selectedPuestos, puestoNameById]);

  const updFilteredPuestosFromTree: Puesto[] = useMemo(() => {
    if (updAssignToAllDivision && updSelectedDivisionForAll) {
      return getAllPuestosFromDivision(updSelectedDivisionForAll);
    }
    const hasAnySelection =
      updEmpresaId !== null ||
      updClienteId !== null ||
      updDivisionId !== null ||
      updContratoId !== null ||
      updSucursalId !== null ||
      updPuestoId !== null;
    if (!hasAnySelection) return [];
    const seen = new Set<number>();
    const out: Puesto[] = [];
    for (const empresa of structure) {
      if (updEmpresaId !== null && empresa.id !== updEmpresaId) continue;
      for (const cliente of empresa.clientes ?? []) {
        if (updClienteId !== null && cliente.id !== updClienteId) continue;
        for (const division of cliente.division ?? []) {
          if (updDivisionId !== null && division.id !== updDivisionId) continue;
          for (const contrato of division.contratos ?? []) {
            if (updContratoId !== null && contrato.id !== updContratoId) continue;
            for (const sucursal of contrato.sucursales ?? []) {
              if (updSucursalId !== null && sucursal.id !== updSucursalId) continue;
              for (const puesto of sucursal.puestos ?? []) {
                if (updPuestoId !== null && puesto.id !== updPuestoId) continue;
                if (!seen.has(puesto.id)) {
                  seen.add(puesto.id);
                  out.push({ id: puesto.id, nombre: puesto.nombre });
                }
              }
            }
          }
        }
      }
    }
    return out;
  }, [
    structure,
    updEmpresaId,
    updClienteId,
    updDivisionId,
    updContratoId,
    updSucursalId,
    updPuestoId,
    updAssignToAllDivision,
    updSelectedDivisionForAll,
    getAllPuestosFromDivision,
  ]);

  const updSelectedPuestosUi = useMemo(() => {
    return updSelectedPuestos
      .map((id) => ({ id, nombre: puestoNameById.get(id) || `Puesto #${id}` }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [updSelectedPuestos, puestoNameById]);

  const resetUpdManualPuestosFormOnly = useCallback(() => {
    setUpdAssignToAllDivision(false);
    setUpdSelectedDivisionForAll(null);
    setUpdEmpresaId(null);
    setUpdClienteId(null);
    setUpdDivisionId(null);
    setUpdContratoId(null);
    setUpdSucursalId(null);
    setUpdPuestoId(null);
    setUpdSelectedPuestos([]);
    setUpdHasConfirmedPuestos(false);
    setUpdIsSelectedPuestosExpanded(false);
  }, []);

  const closeUpdManualPuestosModal = useCallback(() => {
    setIsUpdManualPuestosModalVisible(false);
    resetUpdManualPuestosFormOnly();
    setUpdManualForPuestos(null);
  }, [resetUpdManualPuestosFormOnly]);

  const toggleUpdPuestoSelection = useCallback((puestoId: number) => {
    setUpdSelectedPuestos(prev => {
      if (prev.includes(puestoId)) return prev.filter(id => id !== puestoId);
      return [...prev, puestoId];
    });
  }, []);

  const applyUpdPuestosFromTreeConfirmed = useCallback(() => {
    if (updAssignToAllDivision && updSelectedDivisionForAll) {
      const puestosFromDivision = getAllPuestosFromDivision(updSelectedDivisionForAll);
      if (puestosFromDivision.length === 0) {
        Alert.alert('Información', 'No se encontraron puestos para la división seleccionada.');
        return;
      }
      setUpdSelectedPuestos(puestosFromDivision.map(p => p.id));
      setUpdHasConfirmedPuestos(true);
      setUpdIsSelectedPuestosExpanded(true);
      return;
    }
    if (updFilteredPuestosFromTree.length === 0) {
      Alert.alert('Información', 'Selecciona un nivel del árbol para obtener puestos.');
      return;
    }
    setUpdSelectedPuestos(updFilteredPuestosFromTree.map(p => p.id));
    setUpdHasConfirmedPuestos(true);
    setUpdIsSelectedPuestosExpanded(true);
  }, [updAssignToAllDivision, updSelectedDivisionForAll, updFilteredPuestosFromTree, getAllPuestosFromDivision]);

  const applyUpdPuestosFromTree = useCallback(() => {
    Alert.alert('Confirmar', '¿Aplicar la selección de puestos según el filtro actual?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Aceptar', onPress: () => applyUpdPuestosFromTreeConfirmed() },
    ]);
  }, [applyUpdPuestosFromTreeConfirmed]);

  const openUpdManualPuestosModal = useCallback(
    (manual: JobManualRemote) => {
      try {
        resetUpdManualPuestosFormOnly();
        setUpdManualForPuestos(manual);
        setIsUpdManualPuestosModalVisible(true);
      } catch (e) {
        console.error('openUpdManualPuestosModal', e);
        Alert.alert('Error', 'No se pudo abrir el formulario.');
      }
    },
    [resetUpdManualPuestosFormOnly]
  );

  const submitUpdManualPuestosModal = useCallback(async () => {
    if (!updManualForPuestos || marcaId == null) return;
    const ids = Array.from(
      new Set(updSelectedPuestos.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0))
    );
    if (ids.length === 0) {
      Alert.alert('Validación', 'Selecciona al menos un puesto.');
      return;
    }
    const manual = updManualForPuestos;
    const listPuestoReload =
      roleName === 'OPERATIVO' ? marcaPuestoIdFromMarca : (filterPuestoId ?? marcaPuestoIdFromMarca);

    const serverManualId = Number(manual.id);
    const isLocalOnly = !Number.isFinite(serverManualId) || serverManualId <= 0;

    if (isLocalOnly) {
      const lid = manual.id_local;
      if (!lid) {
        Alert.alert('Error', 'Manual local sin identificador.');
        return;
      }
      try {
        const actionsStr = await AsyncStorage.getItem('job_manuals_actions');
        let actions = actionsStr ? JSON.parse(actionsStr) : [];
        const idx = actions.findIndex((a: any) => a.type === 'create' && String(a.id) === String(lid));
        if (idx === -1) {
          Alert.alert('Error', 'No se encontró la creación pendiente de este manual.');
          return;
        }
        const createAction = { ...actions[idx] };
        let prev: number[] = [];
        try {
          const raw = createAction.requestData?.puestos;
          prev = Array.isArray(JSON.parse(raw || '[]')) ? JSON.parse(raw || '[]') : [];
        } catch {
          prev = [];
        }
        const merged = Array.from(
          new Set([
            ...prev.map((x: any) => Number(x)).filter((n: number) => Number.isFinite(n) && n > 0),
            ...ids,
          ])
        );
        createAction.requestData = {
          ...createAction.requestData,
          puestos: JSON.stringify(merged),
        };
        actions[idx] = createAction;
        await AsyncStorage.setItem('job_manuals_actions', JSON.stringify(actions));
        await patchJobManualPuestosVinculadosInCache(
          {
            idLocal: String(lid),
            replaceAll: true,
            getPuestoNombre: (id) => puestoNameById.get(id) || `Puesto #${id}`,
          },
          merged
        );
        Alert.alert('Listo', 'Se actualizaron los puestos en el borrador pendiente de sincronización.');
        closeUpdManualPuestosModal();
        await fetchManuals(marcaId, listPuestoReload);
      } catch (e) {
        console.error('submitUpdManualPuestosModal local merge', e);
        Alert.alert('Error', 'No se pudo guardar.');
      }
      return;
    }

    const isConnected = await getConnectionStatus();
    if (!isConnected) {
      try {
        const actionsStr = await AsyncStorage.getItem('job_manuals_actions');
        let actions = actionsStr ? JSON.parse(actionsStr) : [];
        const mid = Number(manual.id);
        actions = actions.filter((a: any) => !(a.type === 'append_puestos' && Number(a.manualId) === mid));
        const action_queue_id = `jm_append_${mid}_${Date.now()}`;
        actions.push({
          id: action_queue_id,
          action_queue_id,
          type: 'append_puestos',
          manualId: mid,
          marcaId,
          puestos_ids: ids,
        });
        await AsyncStorage.setItem('job_manuals_actions', JSON.stringify(actions));
        await patchJobManualPuestosVinculadosInCache(
          {
            manualServerId: serverManualId,
            replaceAll: false,
            getPuestoNombre: (id) => puestoNameById.get(id) || `Puesto #${id}`,
          },
          ids
        );
        Alert.alert('Modo offline', 'Se sincronizarán los nuevos puestos cuando haya conexión.');
        closeUpdManualPuestosModal();
        await fetchManuals(marcaId, listPuestoReload);
      } catch (e) {
        console.error('submitUpdManualPuestosModal offline queue', e);
        Alert.alert('Error', 'No se pudo guardar la acción offline.');
      }
      return;
    }

    setIsSubmittingUpdManualPuestos(true);
    try {
      const res = await appendJobManualPuestos({
        manualId: serverManualId,
        marcaId,
        puestosIds: ids,
        refreshAccessToken,
        logout,
      });
      if (res.status) {
        await patchJobManualPuestosVinculadosInCache(
          {
            manualServerId: serverManualId,
            replaceAll: false,
            getPuestoNombre: (id) => puestoNameById.get(id) || `Puesto #${id}`,
          },
          ids
        );
        Alert.alert('Éxito', res.message || 'Puestos actualizados.');
        closeUpdManualPuestosModal();
        await fetchManuals(marcaId, listPuestoReload);
      } else {
        Alert.alert('Error', res.message || 'No se pudo actualizar.');
      }
    } catch (err) {
      console.error('submitUpdManualPuestosModal', err);
      Alert.alert('Error', 'No se pudo completar la operación.');
    } finally {
      setIsSubmittingUpdManualPuestos(false);
    }
  }, [
    updManualForPuestos,
    updSelectedPuestos,
    marcaId,
    roleName,
    marcaPuestoIdFromMarca,
    marcaCorpoIdFromMarca,
    filterPuestoId,
    filterSucursalId,
    closeUpdManualPuestosModal,
    fetchManuals,
    refreshAccessToken,
    logout,
    getConnectionStatus,
    puestoNameById,
  ]);

  const handleAddFile = async (type: ManualFileLocal['type']) => {
    try {
      let pickerTypes: string | string[] | undefined;

      switch (type) {
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

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];

      let extension = '';
      if (asset.name && asset.name.includes('.')) {
        extension = asset.name.split('.').pop() || '';
      } else if (asset.mimeType && asset.mimeType.includes('/')) {
        extension = asset.mimeType.split('/').pop() || '';
      }
      const extUse = (extension || 'dat').replace(/^\./, '') || 'dat';
      const storedType: StoredFileType = type === 'document' ? 'text' : type;

      const localId = `local_file_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const fileName = await saveFile({
        uri: asset.uri,
        originalName: asset.name || 'archivo',
        extension: extUse,
        type: storedType,
        prefix: 'job_manuals_m',
      });

      const newFile: ManualFileLocal = {
        id: localId,
        type,
        name: asset.name || `archivo.${extUse || 'dat'}`,
        extension: extUse,
        base64: '',
        localFileName: fileName,
        uri: asset.uri,
        mimeType: asset.mimeType,
      };

      if (type === 'image') {
        setImageFiles(prev => [...prev, newFile]);
      } else if (type === 'audio') {
        setAudioFiles(prev => [...prev, newFile]);
      } else if (type === 'video') {
        setVideoFiles(prev => [...prev, newFile]);
      } else {
        setTextFiles(prev => [...prev, newFile]);
      }
    } catch (error) {
      console.error('Error picking file for job manual:', error);
      Alert.alert('Error', 'No se pudo seleccionar el archivo. Intenta nuevamente.');
    }
  };

  const handleAddViewFile = async (type: ManualFileLocal['type']) => {
    try {
      let pickerTypes: string | string[] | undefined;

      switch (type) {
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

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      let extension = '';
      if (asset.name && asset.name.includes('.')) extension = asset.name.split('.').pop() || '';
      else if (asset.mimeType && asset.mimeType.includes('/')) extension = asset.mimeType.split('/').pop() || '';
      const extUse = (extension || 'dat').replace(/^\./, '') || 'dat';
      const storedType: StoredFileType = type === 'document' ? 'text' : type;

      const localId = `local_vis_file_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const fileName = await saveFile({
        uri: asset.uri,
        originalName: asset.name || 'archivo',
        extension: extUse,
        type: storedType,
        prefix: 'job_manuals_v',
      });
      const newFile: ManualFileLocal = {
        id: localId,
        type,
        name: asset.name || `archivo.${extUse || 'dat'}`,
        extension: extUse,
        base64: '',
        localFileName: fileName,
        uri: asset.uri,
        mimeType: asset.mimeType,
      };

      if (type === 'image') setViewImageFiles(prev => [...prev, newFile]);
      else if (type === 'audio') setViewAudioFiles(prev => [...prev, newFile]);
      else if (type === 'video') setViewVideoFiles(prev => [...prev, newFile]);
      else setViewTextFiles(prev => [...prev, newFile]);
    } catch (e) {
      console.error('Error picking file for visualization:', e);
      Alert.alert('Error', 'No se pudo seleccionar el archivo. Intenta nuevamente.');
    }
  };

  const removeViewLocalFile = (type: ManualFileLocal['type'], id: string) => {
    const rm = (list: ManualFileLocal[]) => {
      const t = list.find((f) => f.id === id);
      if (t?.localFileName) void deleteFile(t.localFileName).catch(() => {});
      return list.filter((f) => f.id !== id);
    };
    if (type === 'image') setViewImageFiles((prev) => rm(prev));
    else if (type === 'audio') setViewAudioFiles((prev) => rm(prev));
    else if (type === 'video') setViewVideoFiles((prev) => rm(prev));
    else setViewTextFiles((prev) => rm(prev));
  };

  const buildVisualizationFilesPayload = async () => {
    const files = [...viewTextFiles, ...viewImageFiles, ...viewAudioFiles, ...viewVideoFiles];
    const rows: { type: string; extension: string; original_name: string; file_base64: string; mimeType?: string }[] = [];
    for (const f of files) {
      let b64 = f.base64;
      if (f.localFileName) {
        try {
          const g = await getFile(f.localFileName);
          b64 = g.base64;
        } catch {
          b64 = '';
        }
      }
      if (!b64) continue;
      rows.push({
        type: f.type,
        extension: f.extension,
        original_name: f.name,
        file_base64: b64,
        mimeType: f.mimeType,
      });
    }
    return JSON.stringify(rows);
  };

  /** Cola offline: referencias a disco en lugar de base64 */
  const buildVisualizationSignQueuePayload = () => {
    const files = [...viewTextFiles, ...viewImageFiles, ...viewAudioFiles, ...viewVideoFiles];
    return JSON.stringify(
      files.map((f) => ({
        type: f.type,
        extension: f.extension,
        original_name: f.name,
        mimeType: f.mimeType,
        localFileName: f.localFileName,
        file_base64: f.localFileName ? undefined : f.base64,
      }))
    );
  };

  const buildVisualizationFileUrl = (manualId: number | undefined, visId: number | undefined, file: ManualFileRemote) => {
    if (file.localFileName) {
      const uri = getLocalFileDisplayUri(String(file.localFileName));
      if (uri) return uri;
    }
    const hasLocalId = file.id_local !== undefined && file.id_local !== null && file.id_local !== '';
    if (hasLocalId && file.base64) {
      const mime = file.mimeType || (file.type ? `${file.type}/${file.extension || 'octet-stream'}` : `application/${file.extension || 'octet-stream'}`);
      return `data:${mime};base64,${file.base64}`;
    }

    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (manualId && visId && apiUrl) {
      if (file.type === 'image') return appendTokenToUrl(`${apiUrl}/api/job-manuals/${manualId}/visualizations/${visId}/get-image/${encodeURIComponent(file.name)}`);
      if (file.type === 'audio') return appendTokenToUrl(`${apiUrl}/api/job-manuals/${manualId}/visualizations/${visId}/get-audio/${encodeURIComponent(file.name)}`);
      if (file.type === 'video') return appendTokenToUrl(`${apiUrl}/api/job-manuals/${manualId}/visualizations/${visId}/get-video/${encodeURIComponent(file.name)}`);
      return appendTokenToUrl(`${apiUrl}/api/job-manuals/${manualId}/visualizations/${visId}/get-file/${encodeURIComponent(file.name)}`);
    }

    if (!file.url) return '';
    const u = file.url;
    if (/^(file|content|data):/i.test(String(u).trim())) return u;
    return appendTokenToUrl(file.url);
  };

  const removeLocalFile = (type: ManualFileLocal['type'], id: string) => {
    const rm = (list: ManualFileLocal[]) => {
      const t = list.find((f) => f.id === id);
      if (t?.localFileName) void deleteFile(t.localFileName).catch(() => {});
      return list.filter((f) => f.id !== id);
    };
    if (type === 'image') setImageFiles((prev) => rm(prev));
    else if (type === 'audio') setAudioFiles((prev) => rm(prev));
    else if (type === 'video') setVideoFiles((prev) => rm(prev));
    else setTextFiles((prev) => rm(prev));
  };

  const buildFirmaDataFromHash = async (hash: string): Promise<FirmaData | null> => {
    let decodedHash: string;
    try {
      decodedHash = atob(hash);
    } catch {
      Alert.alert('Error', 'La firma no es válida');
      return null;
    }
    const parts = decodedHash.split(':');

    if (parts.length !== 5) {
      Alert.alert('Error', 'La firma no tiene la estructura esperada');
      return null;
    }

    const [sessionId, empleadoId, latitud, longitud, timestamp] = parts;

    const hasConnection = await getConnectionStatus();
    let empleadoDetalle: FirmaData['empleadoDetalle'] | undefined = undefined;

    if (hasConnection) {
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (apiUrl) {
        const response = await authedFetch({
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
        if (response?.ok) {
          const empleadoData = await response.json();
          empleadoDetalle = {
            nombre: empleadoData.nombre,
            primer_apellido: empleadoData.primer_apellido,
            segundo_apellido: empleadoData.segundo_apellido,
            cedula_empleado: empleadoData.cedula,
          };
        }
      }
    }

    return {
      sessionId,
      empleadoId,
      latitud,
      longitud,
      timestamp,
      empleadoDetalle,
    };
  };

  const applyFirmaResponsableFromHash = async (hash: string) => {
    const data = await buildFirmaDataFromHash(hash);
    if (!data) return;
    setFirmaResponsable(data);
  };

  const clearViewFirma = () => {
    setViewSignature(null);
    setViewFirmaData(null);
  };

  const applyViewFirmaFromHash = async (hash: string) => {
    const data = await buildFirmaDataFromHash(hash);
    if (!data) return;
    setViewFirmaData(data);
    setViewSignature(hash);
  };

  const generateViewSignature = async () => {
    if (!employee) {
      Alert.alert('Error', 'No se pudo obtener la información del empleado');
      return;
    }

    setIsGeneratingViewFirma(true);

    try {
      const hash = await getCurrentUserDigitalSignature(employee);
      if (!hash) return;
      await applyViewFirmaFromHash(hash);
    } catch (error) {
      console.error('Error generating view signature for job manual:', error);
      Alert.alert('Error', 'No se pudo generar la firma');
    } finally {
      setIsGeneratingViewFirma(false);
    }
  };

  const handleScanViewQR = async () => {
    try {
      const qrData = await scanQR();
      if (!qrData) {
        return;
      }

      try {
        await applyViewFirmaFromHash(qrData);
      } catch (error) {
        console.error('Error decoding view QR for job manual:', error);
        Alert.alert('Error', 'El QR escaneado no es válido');
      }
    } catch (error) {
      console.error('Error scanning view QR for job manual:', error);
      Alert.alert('Error', 'No se pudo escanear el código QR');
    }
  };

  const generateSignature = async () => {
    if (!employee) {
      Alert.alert('Error', 'No se pudo obtener la información del empleado');
      return;
    }

    setIsGeneratingFirma(true);

    try {
      const hash = await getCurrentUserDigitalSignature(employee);
      if (!hash) return;
      await applyFirmaResponsableFromHash(hash);
    } catch (error) {
      console.error('Error generating signature for job manual:', error);
      Alert.alert('Error', 'No se pudo generar la firma');
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

      try {
        await applyFirmaResponsableFromHash(qrData);
      } catch (error) {
        console.error('Error decoding QR for job manual:', error);
        Alert.alert('Error', 'El QR escaneado no es válido');
      }
    } catch (error) {
      console.error('Error scanning QR for job manual:', error);
      Alert.alert('Error', 'No se pudo escanear el código QR');
    }
  };

  const proceedWithManualCreation = async () => {
    try {
      if (!marcaId) {
        Alert.alert('Error', 'No se encontró la marca actual');
        return;
      }

      const puestosArray = selectedPuestos.length > 0 ? selectedPuestos : [];
      const filesPayload: ManualFileLocal[] = [
        ...textFiles,
        ...imageFiles,
        ...audioFiles,
        ...videoFiles,
      ];

      const signatureString = `${firmaResponsable?.sessionId}:${firmaResponsable?.empleadoId}:${firmaResponsable?.latitud}:${firmaResponsable?.longitud}:${firmaResponsable?.timestamp}`;
      const signatureHash = btoa(signatureString);

      const listPuestoId =
        roleName === 'OPERATIVO' ? marcaPuestoIdFromMarca : (filterPuestoId ?? marcaPuestoIdFromMarca);
      const listCorpoId = roleName === 'OPERATIVO' ? marcaCorpoIdFromMarca : filterSucursalId;

      const currentMarcaStrForCreate = await AsyncStorage.getItem('current_marca');
      if (!currentMarcaStrForCreate) {
        Alert.alert('Error', 'No se encontró current_marca. No se puede vincular el manual a la jerarquía de la sesión.');
        return;
      }
      let currentMarcaForCreate: any;
      try {
        currentMarcaForCreate = JSON.parse(currentMarcaStrForCreate);
      } catch {
        Alert.alert('Error', 'Datos de current_marca inválidos.');
        return;
      }
      const divIdMarca = getDivisionIdFromMarcaJson(currentMarcaForCreate);
      const hierarchyFields = {
        empresa_id:
          currentMarcaForCreate.empresa?.id != null ? Number(currentMarcaForCreate.empresa.id) : null,
        cliente_id:
          currentMarcaForCreate.cliente?.id != null ? Number(currentMarcaForCreate.cliente.id) : null,
        corpo_id:
          currentMarcaForCreate.corpo?.id != null ? Number(currentMarcaForCreate.corpo.id) : null,
        division_id: divIdMarca,
        contrato_id:
          currentMarcaForCreate.contrato?.id != null
            ? Number(currentMarcaForCreate.contrato.id)
            : null,
      };

      const buildFilesJsonForOnline = async () => {
        const rows: { type: string; original_name: string; extension: string; file_base64: string }[] = [];
        for (const f of filesPayload) {
          let b64 = f.base64;
          if (f.localFileName) {
            try {
              const g = await getFile(f.localFileName);
              b64 = g.base64;
            } catch {
              b64 = '';
            }
          }
          if (!b64) continue;
          rows.push({
            type: f.type,
            original_name: f.name,
            extension: f.extension,
            file_base64: b64,
          });
        }
        return JSON.stringify(rows);
      };

      const filesJsonForOfflineQueue = JSON.stringify(
        filesPayload.map((f) => ({
          type: f.type,
          original_name: f.name,
          extension: f.extension,
          localFileName: f.localFileName,
          file_base64: f.localFileName ? undefined : f.base64,
        }))
      );

      const isConnected = await getConnectionStatus();

      if (isConnected) {
        const requestBody = {
          title: tituloRef.current,
          description: descripcionRef.current,
          firma_responsable: signatureHash,
          puestos: JSON.stringify(puestosArray),
          quiz: quizQuestions.length > 0 ? JSON.stringify({
            questions: quizQuestions,
            minApprovalPercentage: quizMinApprovalPercentage,
          }) : null,
          files: await buildFilesJsonForOnline(),
          ...hierarchyFields,
        };

        const result = await createJobManual({
          requestData: requestBody,
          marcaId,
          refreshAccessToken,
          logout,
        });

        if (result.status) {
          for (const f of filesPayload) {
            if (f.localFileName) {
              try {
                await deleteFile(f.localFileName);
              } catch {
                /* idempotente */
              }
            }
          }

          tituloRef.current = '';
          descripcionRef.current = '';
          setSelectedPuestos([]);
          setTextFiles([]);
          setImageFiles([]);
          setAudioFiles([]);
          setVideoFiles([]);
          setFirmaResponsable(null);
          setQuizQuestions([]);
          setQuizMinApprovalPercentage(70);

          setIsCreating(false);

          if (marcaId) {
            await fetchManuals(marcaId, listPuestoId);
          }

          Alert.alert('Éxito', result.message || 'Manual creado correctamente');
        } else {
          Alert.alert('Error', result.message || 'No se pudo crear el manual');
        }
      } else {
        const requestBody = {
          title: tituloRef.current,
          description: descripcionRef.current,
          firma_responsable: signatureHash,
          puestos: JSON.stringify(puestosArray),
          quiz: quizQuestions.length > 0 ? JSON.stringify({
            questions: quizQuestions,
            minApprovalPercentage: quizMinApprovalPercentage,
          }) : null,
          files: filesJsonForOfflineQueue,
          ...hierarchyFields,
        };
        const localId = `local_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const actionsStr = await AsyncStorage.getItem('job_manuals_actions');
        const actions = actionsStr ? JSON.parse(actionsStr) : [];
        actions.push({
          requestData: requestBody,
          marcaId,
          id: localId,
          type: 'create',
        });
        await AsyncStorage.setItem('job_manuals_actions', JSON.stringify(actions));

        const cacheStr = await AsyncStorage.getItem('job_manuals_cache');
        const cache = cacheStr ? JSON.parse(cacheStr) : [];
        const horaAccionUse = await getHoraAccion();
        const quizStrToStore = quizQuestions.length > 0 ? JSON.stringify({
          questions: quizQuestions,
          minApprovalPercentage: quizMinApprovalPercentage,
        }) : null;
        const primaryPuestoId = puestosArray[0];
        const puestosVinculados = puestosArray
          .map((x) => Number(x))
          .filter((n) => Number.isFinite(n) && n > 0);
        const primaryPuestoNombre =
          (primaryPuestoId != null ? puestoNameById.get(primaryPuestoId) : null) ||
          puestoActualNombre ||
          'Puesto';
        cache.push({
          id: 0,
          id_local: localId,
          title: tituloRef.current,
          description: descripcionRef.current,
          quiz: quizStrToStore,
          puesto: { id: primaryPuestoId ?? 0, nombre: primaryPuestoNombre },
          puestos_vinculados_ids: puestosVinculados.length > 0 ? puestosVinculados : undefined,
          puesto_id:
            primaryPuestoId != null && Number.isFinite(Number(primaryPuestoId)) && Number(primaryPuestoId) > 0
              ? Number(primaryPuestoId)
              : undefined,
          corpo_id: hierarchyFields.corpo_id ?? listCorpoId ?? undefined,
          empresa_id: hierarchyFields.empresa_id ?? undefined,
          cliente_id: hierarchyFields.cliente_id ?? undefined,
          division_id: hierarchyFields.division_id ?? undefined,
          contrato_id: hierarchyFields.contrato_id ?? undefined,
          created_by: employee?.id ? String(employee.id) : '-',
          created_at: new Date(horaAccionUse).toISOString(),
          files: filesPayload.map(f => ({
            id: Date.now() + Math.random(),
            id_local: `file_${localId}_${Math.random().toString(36).slice(2, 8)}`,
            type: f.type,
            extension: f.extension,
            name: f.name || `archivo.${f.extension || 'dat'}`,
            original_name: f.name,
            base64: f.base64,
            localFileName: f.localFileName,
            mimeType: f.mimeType,
            url: f.localFileName ? getLocalFileDisplayUri(f.localFileName) : '',
          })),
          visualizaciones: [],
          currentEmployeeSigned: false,
          synced: false,
        });
        await AsyncStorage.setItem('job_manuals_cache', JSON.stringify(cache));

        Alert.alert('Modo Offline', 'Manual registrado localmente. Se sincronizará cuando haya conexión.');

        tituloRef.current = '';
        descripcionRef.current = '';
        setSelectedPuestos([]);
        setTextFiles([]);
        setImageFiles([]);
        setAudioFiles([]);
        setVideoFiles([]);
        setFirmaResponsable(null);
        setQuizQuestions([]);
        setQuizMinApprovalPercentage(70);

        setIsCreating(false);

        if (marcaId) {
          await fetchManuals(marcaId, listPuestoId);
        }
      }
    } catch (error) {
      console.error('Error creating job manual:', error);
      Alert.alert('Error', 'No se pudo crear el manual');
      throw error;
    }
  };

  const runCreateManualConfirmed = async () => {
    if (isCreatingManual) return;
    setIsCreatingManual(true);
    try {
      if (!marcaId) {
        Alert.alert('Error', 'No se encontró la marca actual');
        return;
      }

      if (!tituloRef.current.trim()) {
        Alert.alert('Error', 'El título es obligatorio');
        return;
      }

      if (!descripcionRef.current.trim()) {
        Alert.alert('Error', 'La descripción es obligatoria');
        return;
      }

      if (!firmaResponsable) {
        Alert.alert('Error', 'La firma del responsable es obligatoria');
        return;
      }

      if (selectedPuestos.length === 0) {
        Alert.alert('Error', 'Debe seleccionar al menos un puesto');
        return;
      }

      const cmStr = await AsyncStorage.getItem('current_marca');
      if (!cmStr || String(cmStr).trim() === '') {
        Alert.alert('Error', 'No hay current_marca. No se puede vincular el manual a la jerarquía de la sesión.');
        return;
      }

      if (selectedPuestos.length > 100) {
        const go = await new Promise<boolean>((resolve) => {
          Alert.alert(
            'Advertencia',
            `Se intentarán guardar ${selectedPuestos.length} puestos. Debido a la cantidad de puestos, el proceso tomará uno o varios minutos. ¿Desea continuar?`,
            [
              { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Continuar', onPress: () => resolve(true) },
            ]
          );
        });
        if (!go) return;
      }

      await proceedWithManualCreation();
    } catch (error) {
      console.error('Error creating job manual:', error);
      Alert.alert('Error', 'No se pudo crear el manual');
    } finally {
      setIsCreatingManual(false);
    }
  };

  const handleCreateManual = () => {
    if (isCreatingManual) return;
    Alert.alert('Confirmar', '¿Desea registrar este manual?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Aceptar', onPress: () => void runCreateManualConfirmed() },
    ]);
  };

  /** Texto del botón principal de envío (confirmación previa vía Alert). */
  const createSubmitButtonLabel = isCreatingManual ? 'Registrando…' : 'Aceptar';

  const formatDateLabel = (iso: string) => {
    return convertDateTimestampToLocalString(iso);
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.fullContainer}>
        <AppHeader onMenuPress={handleMenuPress} title="Manuales de puesto" />
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Cargando...</ThemedText>
        </ThemedView>
        <AppFooter />
        <SlideMenu
          isVisible={isMenuVisible}
          onClose={handleMenuClose}
          onHomePress={handleHomePress}
          currentRoute="JobManuals"
        />
      </ThemedView>
    );
  }

  const canCreate = roleName === 'SUPERVISOR' || roleName === 'ADMINISTRATIVO';

  return (
    <ThemedView style={styles.fullContainer}>
      <AppHeader onMenuPress={handleMenuPress} title="Manuales de puesto" />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <ThemedView style={styles.contentContainer}>
          <ThemedView style={styles.titleContainer}>
            <ThemedText type="title" style={styles.title}>
              Manuales de puesto
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              Consulta y registra manuales asociados a tu puesto.
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.puestoContainer}>
            <ThemedText style={styles.puestoLabel}>Puesto actual:</ThemedText>
            <ThemedText style={styles.puestoName}>{puestoActualNombre || 'No disponible'}</ThemedText>
          </ThemedView>

          {!hasMarca ? (
            <ThemedView style={{ paddingHorizontal: 4, marginBottom: 12 }}>
              <ThemedText style={styles.noMarcaMessage}>
                No hay marca activa. Puede seleccionar la jerarquía manualmente en los filtros.
              </ThemedText>
            </ThemedView>
          ) : null}

          {!isCreating && roleName !== 'OPERATIVO' && (
            <ThemedView style={styles.filtersMain}>
              <ThemedView style={styles.filterHeader}>
                <TouchableOpacity
                  style={styles.filterToggleButton}
                  onPress={() => setIsListFiltersExpanded((e) => !e)}
                >
                  <ThemedText style={styles.filterToggleText}>Filtros</ThemedText>
                  <Ionicons
                    name={isListFiltersExpanded ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color="#007AFF"
                  />
                </TouchableOpacity>
                {isListFiltersExpanded && (
                  <TouchableOpacity
                    style={styles.resetFiltersButton}
                    onPress={() => void resetListFiltersFromCurrentMarca()}
                  >
                    <Ionicons name="refresh" size={16} color="#FF3B30" />
                    <ThemedText style={styles.resetFiltersText}>Reiniciar</ThemedText>
                  </TouchableOpacity>
                )}
              </ThemedView>
              {isListFiltersExpanded && (
                <ThemedView style={styles.filterContent}>
                  {isStructureLoading ? (
                    <ThemedView style={styles.loadingManualsContainer}>
                      <ActivityIndicator size="small" color="#007AFF" />
                      <ThemedText style={styles.loadingText}>Cargando estructura...</ThemedText>
                    </ThemedView>
                  ) : structure.length === 0 ? (
                    <ThemedText style={styles.emptyText}>Sin estructura en caché.</ThemedText>
                  ) : (
                    <>
                      <ThemedText style={styles.filterLabel}>Jerarquía (lista)</ThemedText>
                      <HierarchyPickerFields
                        structure={structure}
                        levels={['cliente', 'contrato', 'sucursal', 'puesto']}
                        isLoading={isStructureLoading}
                        emptyPickerValue={0}
                        values={{
                          empresaId: filterEmpresaId,
                          clienteId: filterClienteId,
                          divisionId: filterDivisionId,
                          contratoId: filterContratoId,
                          sucursalId: filterSucursalId,
                          puestoId: filterPuestoId,
                        }}
                        onChange={handleFilterHierarchyChange}
                        labels={{ sucursal: 'Sucursal (corpo)', puesto: 'Puesto *' }}
                        renderLabel={(text) => <ThemedText style={styles.filterLabel}>{text}</ThemedText>}
                        pickerWrapperStyle={styles.pickerWrapper}
                        fieldGroupStyle={styles.filterGroup}
                      />
                    </>
                  )}
                </ThemedView>
              )}
            </ThemedView>
          )}

          {!isCreating && canCreate && (
            <TouchableOpacity style={styles.createButton} onPress={startCreating}>
              <Ionicons name="add-circle" size={20} color="#FFFFFF" />
              <ThemedText style={styles.createButtonText}>Crear nuevo manual</ThemedText>
            </TouchableOpacity>
          )}

          {isCreating && (
            <ThemedView style={styles.formCard}>
              <ThemedText style={styles.formTitle}>Nuevo manual de puesto</ThemedText>

              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Título *</ThemedText>
                <TextInput
                  style={styles.formInput}
                  defaultValue={tituloRef.current}
                  onChangeText={(text) => {
                    tituloRef.current = text;
                  }}
                  placeholder="Título del manual"
                  placeholderTextColor="#999"
                />
              </ThemedView>

              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Descripción *</ThemedText>
                <TextInput
                  style={[styles.formInput, styles.textArea]}
                  defaultValue={descripcionRef.current}
                  onChangeText={(text) => {
                    descripcionRef.current = text;
                  }}
                  placeholder="Descripción del manual"
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={4}
                />
              </ThemedView>

              {/* Modal Agregar Pregunta */}
              <Modal
                visible={isQuizModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsQuizModalVisible(false)}
              >
                <View style={styles.modalOverlay}>
                  <ThemedView style={styles.viewerModalContainer}>
                    <View style={styles.modalHeader}>
                      <ThemedText style={styles.modalTitle}>Agregar pregunta</ThemedText>
                      <TouchableOpacity onPress={() => setIsQuizModalVisible(false)}>
                        <Ionicons name="close" size={24} color="#666666" />
                      </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.modalContent}>
                      <ThemedView style={styles.formGroup}>
                        <ThemedText style={styles.formLabel}>Título de la pregunta *</ThemedText>
                        <TextInput
                          style={styles.formInput}
                          value={quizTempTitle}
                          onChangeText={setQuizTempTitle}
                          placeholder="Ej: ¿Cuál es el procedimiento...?"
                          placeholderTextColor="#999"
                        />
                      </ThemedView>

                      <ThemedView style={styles.formGroup}>
                        <ThemedText style={styles.formLabel}>Tipo *</ThemedText>
                        <ThemedView style={styles.quizTypeList}>
                          {([
                            { key: 'short', label: 'Respuesta corta' },
                            { key: 'paragraph', label: 'Párrafo' },
                            { key: 'multiple_choice', label: 'Selección única' },
                            { key: 'multiple_select', label: 'Selección múltiple' },
                            { key: 'list', label: 'Lista' },
                          ] as { key: QuizQuestionType; label: string }[]).map((t) => {
                            const active = quizTempType === t.key;
                            return (
                              <TouchableOpacity
                                key={t.key}
                                style={[styles.quizTypePill, active && styles.quizTypePillActive]}
                                onPress={() => {
                                  setQuizTempType(t.key);
                                  setQuizTempOptions([]);
                                  setQuizTempOptionInput('');
                                  setQuizTempAnswer('');
                                  setQuizTempAnswers([]);
                                }}
                              >
                                <ThemedText style={[styles.quizTypePillText, active && styles.quizTypePillTextActive]}>
                                  {t.label}
                                </ThemedText>
                              </TouchableOpacity>
                            );
                          })}
                        </ThemedView>
                      </ThemedView>

                      {/* Opciones (cuando aplica) */}
                      {(quizTempType === 'multiple_choice' || quizTempType === 'multiple_select' || quizTempType === 'list') && (
                        <ThemedView style={styles.formGroup}>
                          <ThemedText style={styles.formLabel}>Opciones *</ThemedText>
                          <ThemedView style={styles.quizOptionRow}>
                            <TextInput
                              style={[styles.formInput, { flex: 1 }]}
                              value={quizTempOptionInput}
                              onChangeText={setQuizTempOptionInput}
                              placeholder="Agregar opción"
                              placeholderTextColor="#999"
                            />
                            <TouchableOpacity
                              style={styles.quizOptionAddBtn}
                              onPress={() => {
                                const v = quizTempOptionInput.trim();
                                if (!v) return;
                                if (quizTempOptions.includes(v)) {
                                  setQuizTempOptionInput('');
                                  return;
                                }
                                setQuizTempOptions(prev => [...prev, v]);
                                setQuizTempOptionInput('');
                              }}
                            >
                              <Ionicons name="add" size={18} color="#FFFFFF" />
                            </TouchableOpacity>
                          </ThemedView>

                          {quizTempOptions.length === 0 ? (
                            <ThemedText style={styles.quizEmptyText}>Aún no hay opciones</ThemedText>
                          ) : (
                            <ThemedView style={styles.quizOptionsList}>
                              {quizTempOptions.map((opt) => (
                                <ThemedView key={opt} style={styles.quizOptionItem}>
                                  <ThemedText style={styles.quizOptionText}>{opt}</ThemedText>
                                  <TouchableOpacity
                                    onPress={() => {
                                      setQuizTempOptions(prev => prev.filter(o => o !== opt));
                                      setQuizTempAnswer(prev => (prev === opt ? '' : prev));
                                      setQuizTempAnswers(prev => prev.filter(o => o !== opt));
                                    }}
                                  >
                                    <Ionicons name="close-circle" size={18} color="#FF3B30" />
                                  </TouchableOpacity>
                                </ThemedView>
                              ))}
                            </ThemedView>
                          )}
                        </ThemedView>
                      )}

                      {/* Respuesta correcta (según tipo) */}
                      {(quizTempType === 'short' || quizTempType === 'paragraph') && (
                        <ThemedView style={styles.formGroup}>
                          <ThemedText style={styles.formLabel}>Respuesta correcta *</ThemedText>
                          <TextInput
                            style={styles.formInput}
                            value={quizTempAnswer}
                            onChangeText={setQuizTempAnswer}
                            placeholder="Escribe la respuesta correcta"
                            placeholderTextColor="#999"
                          />
                        </ThemedView>
                      )}

                      {(quizTempType === 'multiple_choice' || quizTempType === 'list') && (
                        <ThemedView style={styles.formGroup}>
                          <ThemedText style={styles.formLabel}>Respuesta correcta *</ThemedText>
                          {quizTempOptions.length === 0 ? (
                            <ThemedText style={styles.quizEmptyText}>Primero agrega opciones</ThemedText>
                          ) : (
                            <ThemedView style={styles.quizSelectList}>
                              {quizTempOptions.map((opt) => {
                                const selected = quizTempAnswer === opt;
                                return (
                                  <TouchableOpacity
                                    key={opt}
                                    style={styles.quizSelectItem}
                                    onPress={() => setQuizTempAnswer(opt)}
                                  >
                                    <Ionicons
                                      name={selected ? "radio-button-on" : "radio-button-off"}
                                      size={18}
                                      color={selected ? "#007AFF" : "#999"}
                                    />
                                    <ThemedText style={styles.quizSelectText}>{opt}</ThemedText>
                                  </TouchableOpacity>
                                );
                              })}
                            </ThemedView>
                          )}
                        </ThemedView>
                      )}

                      {quizTempType === 'multiple_select' && (
                        <ThemedView style={styles.formGroup}>
                          <ThemedText style={styles.formLabel}>Respuestas correctas *</ThemedText>
                          {quizTempOptions.length === 0 ? (
                            <ThemedText style={styles.quizEmptyText}>Primero agrega opciones</ThemedText>
                          ) : (
                            <ThemedView style={styles.quizSelectList}>
                              {quizTempOptions.map((opt) => {
                                const selected = quizTempAnswers.includes(opt);
                                return (
                                  <TouchableOpacity
                                    key={opt}
                                    style={styles.quizSelectItem}
                                    onPress={() => {
                                      setQuizTempAnswers(prev => {
                                        if (prev.includes(opt)) return prev.filter(x => x !== opt);
                                        return [...prev, opt];
                                      });
                                    }}
                                  >
                                    <Ionicons
                                      name={selected ? "checkbox" : "square-outline"}
                                      size={18}
                                      color={selected ? "#007AFF" : "#999"}
                                    />
                                    <ThemedText style={styles.quizSelectText}>{opt}</ThemedText>
                                  </TouchableOpacity>
                                );
                              })}
                            </ThemedView>
                          )}
                        </ThemedView>
                      )}

                      {/* Puntaje de la pregunta */}
                      <ThemedView style={styles.formGroup}>
                        <ThemedText style={styles.formLabel}>Puntaje *</ThemedText>
                        <TextInput
                          style={styles.formInput}
                          value={quizTempPoints}
                          onChangeText={setQuizTempPoints}
                          placeholder="Ej: 10"
                          placeholderTextColor="#999"
                          keyboardType="numeric"
                        />
                        <ThemedText style={styles.signatureHintMuted}>
                          Todos los puntos se sumarán automáticamente para obtener el puntaje máximo del quiz.
                        </ThemedText>
                      </ThemedView>

                      <TouchableOpacity
                        style={[styles.signatureActionButton, isSavingQuizQuestion && styles.formButtonDisabled]}
                        onPress={commitQuizQuestionFromModal}
                        disabled={isSavingQuizQuestion}
                      >
                        {isSavingQuizQuestion ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                        <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                        )}
                        <ThemedText style={styles.signatureActionText}>
                          {isSavingQuizQuestion ? 'Guardando…' : 'Confirmar'}
                        </ThemedText>
                      </TouchableOpacity>

                      <ThemedView style={{ height: 16 }} />
                    </ScrollView>
                  </ThemedView>
                </View>
              </Modal>

              {/* Selección de puestos */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Puestos que recibirán el manual:</ThemedText>

                {isStructureLoading ? (
                  <ThemedView style={styles.loadingManualsContainer}>
                    <ActivityIndicator size="small" color="#007AFF" />
                    <ThemedText style={styles.loadingText}>Cargando estructura...</ThemedText>
                  </ThemedView>
                ) : structure.length === 0 ? (
                  <ThemedText style={styles.emptyText}>
                    No se pudo cargar la estructura. Conéctate a internet para descargarla o asegúrate de tener cache.
                  </ThemedText>
                ) : (
                  <>
                    {/* Checkbox para asignar a todos los puestos de una división */}
                    <ThemedView style={styles.checkboxContainer}>
                      <TouchableOpacity
                        style={styles.checkboxRow}
                        onPress={() => {
                          const newValue = !assignToAllDivision;
                          setAssignToAllDivision(newValue);
                          if (!newValue) {
                            setSelectedDivisionForAll(null);
                            setHasConfirmedPuestos(false);
                            setIsSelectedPuestosExpanded(false);
                            setSelectedPuestos([]);
                          }
                        }}
                      >
                        <Ionicons
                          name={assignToAllDivision ? "checkbox" : "square-outline"}
                          size={20}
                          color={assignToAllDivision ? "#007AFF" : "#999"}
                        />
                        <ThemedText style={styles.checkboxLabel}>
                          Asignar a todos los puestos de una división
                        </ThemedText>
                      </TouchableOpacity>
                    </ThemedView>

                    {/* Select de divisiones cuando el checkbox está activado */}
                    {assignToAllDivision && (
                      <ThemedView style={styles.structureGroup}>
                        <ThemedText style={styles.smallLabel}>División</ThemedText>
                        <ThemedView style={styles.pickerWrapper}>
                          <Picker
                            enabled={!isStructureLoading}
                            selectedValue={selectedDivisionForAll ?? 0}
                            onValueChange={(v) => {
                              const next = Number(v) || 0;
                              setSelectedDivisionForAll(next === 0 ? null : next);
                              setHasConfirmedPuestos(false);
                              setIsSelectedPuestosExpanded(false);
                              setSelectedPuestos([]);
                            }}
                          >
                            <Picker.Item label="Seleccione división..." value={0} color="#000000" />
                            <Picker.Item label="Aseo y limpieza" value={5} color="#000000" />
                            <Picker.Item label="Seguridad" value={4} color="#000000" />
                          </Picker>
                        </ThemedView>
                      </ThemedView>
                    )}

                    {/* Jerarquía normal (oculta cuando el checkbox está activado) */}
                    {!assignToAllDivision && (
                      <>
                        <ThemedText style={styles.signatureHintMuted}>
                          Filtra el árbol hasta el nivel deseado. Si seleccionas un nivel superior, se vincularán todos los puestos debajo.
                        </ThemedText>

                        <HierarchyPickerFields
                          structure={structure}
                          levels={['cliente', 'contrato', 'sucursal', 'puesto']}
                          isLoading={isStructureLoading}
                          emptyPickerValue={0}
                          values={{
                            empresaId: selectedEmpresaId,
                            clienteId: selectedClienteId,
                            divisionId: selectedDivisionId,
                            contratoId: selectedContratoId,
                            sucursalId: selectedSucursalId,
                            puestoId: selectedPuestoId,
                          }}
                          onChange={handleFormHierarchyChange}
                          labels={{ sucursal: 'Sucursal (Corpo)', puesto: 'Puesto' }}
                          renderLabel={(text) => <ThemedText style={styles.smallLabel}>{text}</ThemedText>}
                          pickerWrapperStyle={styles.pickerWrapper}
                          fieldGroupStyle={styles.structureGroup}
                        />
                      </>
                    )}

                    {/* Botón Confirmar y contador (siempre visible) */}
                    <ThemedView style={styles.treeActionsRow}>
                      <TouchableOpacity style={styles.treeActionPrimary} onPress={applyPuestosFromTree}>
                        <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                        <ThemedText style={styles.treeActionPrimaryText}>Confirmar</ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.treeActionSecondary}
                        onPress={() => {
                          setSelectedPuestos([]);
                          setHasConfirmedPuestos(false);
                          setIsSelectedPuestosExpanded(false);
                        }}
                      >
                        <Ionicons name="trash-outline" size={18} color="#007AFF" />
                        <ThemedText style={styles.treeActionSecondaryText}>Limpiar</ThemedText>
                      </TouchableOpacity>
                    </ThemedView>

                    <ThemedText style={styles.signatureHintMuted}>
                      Seleccionados: {selectedPuestos.length} | En el filtro: {filteredPuestosFromTree.length}
                    </ThemedText>

                    {/* Puestos confirmados en collapsable (siempre visible cuando hay puestos confirmados) */}
                    {hasConfirmedPuestos && selectedPuestosUi.length > 0 && (
                      <ThemedView style={styles.selectedPuestosBox}>
                        <TouchableOpacity
                          style={styles.selectedPuestosHeader}
                          onPress={() => setIsSelectedPuestosExpanded((p) => !p)}
                        >
                          <ThemedText style={styles.selectedPuestosHeaderText}>
                            Puestos seleccionados ({selectedPuestosUi.length})
                          </ThemedText>
                          <Ionicons
                            name={isSelectedPuestosExpanded ? 'chevron-up' : 'chevron-down'}
                            size={18}
                            color="#007AFF"
                          />
                        </TouchableOpacity>

                        {isSelectedPuestosExpanded && (
                          <>
                            {selectedPuestosUi.length <= 150 ? (
                              <ThemedView style={styles.puestosList}>
                                {selectedPuestosUi.map((puesto) => {
                                  const isSelected = selectedPuestos.includes(puesto.id);
                                  return (
                                    <TouchableOpacity
                                      key={puesto.id}
                                      style={[styles.puestoItem, isSelected && styles.puestoItemSelected]}
                                      onPress={() => togglePuestoSelection(puesto.id)}
                                    >
                                      <ThemedText style={[styles.puestoItemText, isSelected && styles.puestoItemTextSelected]}>
                                        {puesto.nombre}
                                      </ThemedText>
                                    </TouchableOpacity>
                                  );
                                })}
                              </ThemedView>
                            ) : (
                              <ThemedText style={styles.emptyText}>
                                Hay {selectedPuestosUi.length} puestos seleccionados. Filtra más y confirma por partes para verlos como etiquetas.
                              </ThemedText>
                            )}
                          </>
                        )}
                      </ThemedView>
                    )}

                    {!assignToAllDivision && filteredPuestosFromTree.length > 150 && (
                      <ThemedText style={styles.emptyText}>
                        Hay {filteredPuestosFromTree.length} puestos en este nivel. Filtra más o pulsa "Confirmar".
                      </ThemedText>
                    )}
                  </>
                )}
              </ThemedView>

              {/* Archivos por tipo - placeholders */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Archivos de texto</ThemedText>
                <TouchableOpacity
                  style={styles.addFileButton}
                  onPress={() => handleAddFile('document')}
                >
                  <Ionicons name="document-text-outline" size={18} color="#007AFF" />
                  <ThemedText style={styles.addFileButtonText}>Añadir archivo de texto</ThemedText>
                </TouchableOpacity>
                {textFiles.length > 0 && (
                  <ThemedView style={styles.filesList}>
                    {textFiles.map(file => (
                      <ThemedView key={file.id} style={styles.fileRow}>
                        <Ionicons name="document-text-outline" size={16} color="#007AFF" />
                        <ThemedText numberOfLines={1} style={styles.fileName}>
                          {file.name}
                        </ThemedText>
                        <TouchableOpacity onPress={() => removeLocalFile('document', file.id)}>
                          <Ionicons name="trash" size={16} color="#FF3B30" />
                        </TouchableOpacity>
                      </ThemedView>
                    ))}
                  </ThemedView>
                )}
              </ThemedView>

              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Imágenes</ThemedText>
                <TouchableOpacity
                  style={styles.addFileButton}
                  onPress={() => handleAddFile('image')}
                >
                  <Ionicons name="image-outline" size={18} color="#007AFF" />
                  <ThemedText style={styles.addFileButtonText}>Añadir imagen</ThemedText>
                </TouchableOpacity>
                {imageFiles.length > 0 && (
                  <ThemedView style={styles.filesList}>
                    {imageFiles.map(file => (
                      <ThemedView key={file.id} style={styles.fileRow}>
                        <Image
                          source={{
                            uri: `data:image/${file.extension || 'jpeg'};base64,${file.base64}`,
                          }}
                          style={styles.filePreviewImage}
                          resizeMode="cover"
                        />
                        <ThemedText numberOfLines={1} style={styles.fileName}>
                          {file.name}
                        </ThemedText>
                        <TouchableOpacity onPress={() => removeLocalFile('image', file.id)}>
                          <Ionicons name="trash" size={16} color="#FF3B30" />
                        </TouchableOpacity>
                      </ThemedView>
                    ))}
                  </ThemedView>
                )}
              </ThemedView>

              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Audio</ThemedText>
                <TouchableOpacity
                  style={styles.addFileButton}
                  onPress={() => handleAddFile('audio')}
                >
                  <Ionicons name="mic-outline" size={18} color="#007AFF" />
                  <ThemedText style={styles.addFileButtonText}>Añadir audio</ThemedText>
                </TouchableOpacity>
                {audioFiles.length > 0 && (
                  <ThemedView style={styles.filesList}>
                    {audioFiles.map(file => (
                      <ThemedView key={file.id} style={styles.fileRow}>
                        <Ionicons name="musical-notes-outline" size={16} color="#007AFF" />
                        <ThemedText numberOfLines={1} style={styles.fileName}>
                          {file.name}
                        </ThemedText>
                        <TouchableOpacity onPress={() => removeLocalFile('audio', file.id)}>
                          <Ionicons name="trash" size={16} color="#FF3B30" />
                        </TouchableOpacity>
                      </ThemedView>
                    ))}
                  </ThemedView>
                )}
              </ThemedView>

              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Video</ThemedText>
                <TouchableOpacity
                  style={styles.addFileButton}
                  onPress={() => handleAddFile('video')}
                >
                  <Ionicons name="videocam-outline" size={18} color="#007AFF" />
                  <ThemedText style={styles.addFileButtonText}>Añadir video</ThemedText>
                </TouchableOpacity>
                {videoFiles.length > 0 && (
                  <ThemedView style={styles.filesList}>
                    {videoFiles.map(file => (
                      <ThemedView key={file.id} style={styles.fileRow}>
                        <Ionicons name="videocam-outline" size={16} color="#007AFF" />
                        <ThemedText numberOfLines={1} style={styles.fileName}>
                          {file.name}
                        </ThemedText>
                        <TouchableOpacity onPress={() => removeLocalFile('video', file.id)}>
                          <Ionicons name="trash" size={16} color="#FF3B30" />
                        </TouchableOpacity>
                      </ThemedView>
                    ))}
                  </ThemedView>
                )}
              </ThemedView>

              {/* Quiz (opcional) */}
              <ThemedView style={styles.formGroup}>
                <ThemedView style={styles.quizHeaderRow}>
                  <ThemedText style={styles.formLabel}>Quiz (Opcional)</ThemedText>
                  <TouchableOpacity
                    style={styles.quizAddButton}
                    onPress={() => {
                      setQuizTempTitle('');
                      setQuizTempType('short');
                      setQuizTempOptions([]);
                      setQuizTempOptionInput('');
                      setQuizTempAnswer('');
                      setQuizTempAnswers([]);
                      setQuizTempPoints('');
                      setIsQuizModalVisible(true);
                    }}
                  >
                    <Ionicons name="add-circle-outline" size={18} color="#007AFF" />
                    <ThemedText style={styles.quizAddButtonText}>Agregar pregunta</ThemedText>
                  </TouchableOpacity>
                </ThemedView>

                {quizQuestions.length === 0 ? (
                  <ThemedText style={styles.quizEmptyText}>Sin preguntas configuradas</ThemedText>
                ) : (
                  <>
                    <ThemedView style={styles.quizList}>
                      {quizQuestions.map((q) => {
                        const totalPoints = quizQuestions.reduce((sum, question) => sum + (question.points || 0), 0);
                        return (
                          <ThemedView key={q.id} style={styles.quizQuestionCard}>
                            <ThemedView style={styles.quizQuestionHeader}>
                              <ThemedText style={styles.quizQuestionTitle} numberOfLines={2}>
                                {q.title}
                              </ThemedText>
                              <TouchableOpacity
                                onPress={() => setQuizQuestions(prev => prev.filter(x => x.id !== q.id))}
                                style={styles.quizRemoveButton}
                              >
                                <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                              </TouchableOpacity>
                            </ThemedView>
                            <ThemedText style={styles.quizQuestionMeta}>
                              Tipo: {getQuizTypeLabel(q.type)} • Puntaje: {q.points || 0} puntos
                            </ThemedText>
                          </ThemedView>
                        );
                      })}
                    </ThemedView>
                    {(() => {
                      const totalPoints = quizQuestions.reduce((sum, question) => sum + (question.points || 0), 0);
                      return (
                        <ThemedView style={styles.quizTotalPointsContainer}>
                          <ThemedText style={styles.quizTotalPointsText}>
                            Puntaje máximo del quiz: {totalPoints} puntos
                          </ThemedText>
                        </ThemedView>
                      );
                    })()}
                    <ThemedView style={styles.formGroup}>
                      <ThemedText style={styles.formLabel}>Porcentaje mínimo de aprobación (%) *</ThemedText>
                      <TextInput
                        style={styles.formInput}
                        value={String(quizMinApprovalPercentage)}
                        onChangeText={(text) => {
                          const value = parseFloat(text);
                          if (!isNaN(value) && value >= 0 && value <= 100) {
                            setQuizMinApprovalPercentage(value);
                          } else if (text === '') {
                            setQuizMinApprovalPercentage(0);
                          }
                        }}
                        placeholder="70"
                        placeholderTextColor="#999"
                        keyboardType="numeric"
                      />
                      <ThemedText style={styles.signatureHintMuted}>
                        El usuario debe obtener al menos este porcentaje del puntaje total para aprobar.
                      </ThemedText>
                    </ThemedView>
                  </>
                )}
              </ThemedView>

              {/* Firma responsable */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Firma del responsable *</ThemedText>
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
                          <Ionicons name="finger-print" size={18} color="#FFFFFF" />
                          <ThemedText style={styles.signatureButtonText}>Generar</ThemedText>
                        </>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.signatureButton}
                      onPress={handleScanQR}
                    >
                      <Ionicons name="qr-code-outline" size={18} color="#FFFFFF" />
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
                          {firmaResponsable.empleadoDetalle.nombre}{' '}
                          {firmaResponsable.empleadoDetalle.primer_apellido}{' '}
                          {firmaResponsable.empleadoDetalle.segundo_apellido}{' '}
                          ({firmaResponsable.empleadoDetalle.cedula_empleado})
                        </ThemedText>
                      </ThemedView>
                    )}
                    <ThemedText style={styles.signatureInfoText}>Latitud: {firmaResponsable.latitud}</ThemedText>
                    <ThemedText style={styles.signatureInfoText}>Longitud: {firmaResponsable.longitud}</ThemedText>
                    <ThemedText style={styles.signatureInfoText}>Fecha y hora: {convertDateTimestampToLocalString( new Date(Number(firmaResponsable.timestamp)).toISOString())}</ThemedText>
                    <TouchableOpacity
                      style={styles.clearSignatureButton}
                      onPress={() => setFirmaResponsable(null)}
                    >
                      <ThemedText style={styles.clearSignatureText}>Limpiar</ThemedText>
                    </TouchableOpacity>
                  </ThemedView>
                )}
              </ThemedView>

              {/* Acciones del formulario */}
              <ThemedView style={styles.formActions}>
                <TouchableOpacity
                  style={[styles.formButton, styles.cancelButton]}
                  onPress={cancelCreating}
                >
                  <ThemedText style={styles.formButtonText}>Cancelar</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.formButton, styles.confirmButton, isCreatingManual && styles.formButtonDisabled]}
                  onPress={handleCreateManual}
                  disabled={isCreatingManual}
                >
                  {isCreatingManual ? (
                    <>
                      <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                      <ThemedText style={styles.formButtonText}>{createSubmitButtonLabel}</ThemedText>
                    </>
                  ) : (
                    <ThemedText style={styles.formButtonText}>Aceptar</ThemedText>
                  )}
                </TouchableOpacity>
              </ThemedView>
            </ThemedView>
          )}

          {/* Lista de manuales para todos los roles */}
          <ThemedView style={styles.listContainer}>
            {isLoadingManuals ? (
              <ThemedView style={styles.loadingManualsContainer}>
                <ActivityIndicator size="small" color="#007AFF" />
                <ThemedText style={styles.loadingText}>Cargando manuales...</ThemedText>
              </ThemedView>
            ) : manuals.length === 0 ? (
              <ThemedText style={styles.emptyText}>
                No hay manuales de puesto registrados para este puesto.
              </ThemedText>
            ) : (
              manuals.map((manual) => (
                <ThemedView
                  key={manual.id || manual.id_local || `manual-${manual.title}`}
                  style={styles.manualCard}
                >
                  <TouchableOpacity
                    activeOpacity={0.85}
                  onPress={() => {
                    setSelectedManual(manual);
                    clearViewFirma();
                    setIsSigningManual(false);
                    setIsViewerVisible(true);
                  }}
                >
                  <ThemedText style={styles.manualTitle}>{manual.title}</ThemedText>
                  <ThemedText numberOfLines={2} style={styles.manualDescription}>
                    {manual.description}
                  </ThemedText>
                  <ThemedView style={styles.manualMetaRow}>
                    <ThemedText style={styles.manualMetaText}>
                      {manual.puesto?.nombre || puestoActualNombre}
                    </ThemedText>
                    <ThemedText style={styles.manualMetaText}>
                      {manual.files?.length || 0} archivo (s)
                    </ThemedText>
                  </ThemedView>
                </TouchableOpacity>
                  {roleName !== 'OPERATIVO' && (
                    <ThemedView style={styles.manualActionsRow}>
                      <ScalePressButton
                        style={styles.manualUpdatePuestosButton}
                        onPress={() => openUpdManualPuestosModal(manual)}
                      >
                        <Ionicons name="git-network-outline" size={18} color="#FFFFFF" />
                        <ThemedText style={styles.manualUpdatePuestosButtonText}>Actualizar puestos</ThemedText>
                      </ScalePressButton>
                    </ThemedView>
                  )}
                </ThemedView>
              ))
            )}
          </ThemedView>
        </ThemedView>
      </ScrollView>

      <CambiosAppsModulesModal
        visible={isCambiosModalVisible}
        title={cambiosTitle}
        items={cambiosItems}
        onClose={closeCambiosModal}
      />

      <AppFooter />

      <SlideMenu
        isVisible={isMenuVisible}
        onClose={handleMenuClose}
        onHomePress={handleHomePress}
        currentRoute="JobManuals"
      />

      <Modal
        visible={isUpdManualPuestosModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeUpdManualPuestosModal}
      >
        <ThemedView style={styles.modalOverlay}>
          <ThemedView style={styles.updPuestosModalContainer}>
            <ThemedText style={styles.modalTitle}>Actualizar puestos</ThemedText>
            <ThemedText style={styles.updPuestosDisclaimer}>
              Las asignaciones de puestos que ya tenía este manual no se eliminarán; solo se añadirán vínculos
              nuevos para los puestos que confirmes aquí.
            </ThemedText>
            {updManualForPuestos && (
              <ThemedText style={styles.updPuestosManualTitle} numberOfLines={2}>
                {updManualForPuestos.title}
              </ThemedText>
            )}
            <ScrollView
              style={styles.updPuestosScroll}
              contentContainerStyle={styles.updPuestosScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {isStructureLoading ? (
                <ThemedView style={styles.loadingManualsContainer}>
                  <ActivityIndicator size="small" color="#007AFF" />
                  <ThemedText style={styles.loadingText}>Cargando estructura...</ThemedText>
                </ThemedView>
              ) : structure.length === 0 ? (
                <ThemedText style={styles.emptyText}>
                  No hay estructura en caché. Conéctate o sincroniza para usar la jerarquía de puestos.
                </ThemedText>
              ) : (
                <>
                  <ThemedView style={styles.checkboxContainer}>
                    <TouchableOpacity
                      style={styles.checkboxRow}
                      onPress={() => {
                        const next = !updAssignToAllDivision;
                        setUpdAssignToAllDivision(next);
                        if (!next) {
                          setUpdSelectedDivisionForAll(null);
                          setUpdHasConfirmedPuestos(false);
                          setUpdIsSelectedPuestosExpanded(false);
                          setUpdSelectedPuestos([]);
                        }
                      }}
                    >
                      <Ionicons
                        name={updAssignToAllDivision ? 'checkbox' : 'square-outline'}
                        size={20}
                        color={updAssignToAllDivision ? '#007AFF' : '#999'}
                      />
                      <ThemedText style={styles.checkboxLabel}>
                        Asignar a todos los puestos de una división
                      </ThemedText>
                    </TouchableOpacity>
                  </ThemedView>

                  {updAssignToAllDivision && (
                    <ThemedView style={styles.structureGroup}>
                      <ThemedText style={styles.smallLabel}>División</ThemedText>
                      <ThemedView style={styles.pickerWrapper}>
                        <Picker
                          enabled={!isStructureLoading}
                          selectedValue={updSelectedDivisionForAll ?? 0}
                          onValueChange={(v) => {
                            const next = Number(v) || 0;
                            setUpdSelectedDivisionForAll(next === 0 ? null : next);
                            setUpdHasConfirmedPuestos(false);
                            setUpdIsSelectedPuestosExpanded(false);
                            setUpdSelectedPuestos([]);
                          }}
                        >
                          <Picker.Item label="Seleccione división..." value={0} color="#000000" />
                          <Picker.Item label="Aseo y limpieza" value={5} color="#000000" />
                          <Picker.Item label="Seguridad" value={4} color="#000000" />
                        </Picker>
                      </ThemedView>
                    </ThemedView>
                  )}

                  {!updAssignToAllDivision && (
                    <>
                      <ThemedText style={styles.signatureHintMuted}>
                        Filtra el árbol hasta el nivel deseado. Si seleccionas un nivel superior, se incluirán
                        todos los puestos debajo.
                      </ThemedText>
                      <HierarchyPickerFields
                        structure={structure}
                        levels={['cliente', 'contrato', 'sucursal', 'puesto']}
                        isLoading={isStructureLoading}
                        emptyPickerValue={0}
                        values={{
                          empresaId: updEmpresaId,
                          clienteId: updClienteId,
                          divisionId: updDivisionId,
                          contratoId: updContratoId,
                          sucursalId: updSucursalId,
                          puestoId: updPuestoId,
                        }}
                        onChange={handleUpdPHierarchyChange}
                        labels={{ sucursal: 'Sucursal (Corpo)', puesto: 'Puesto' }}
                        renderLabel={(text) => <ThemedText style={styles.smallLabel}>{text}</ThemedText>}
                        pickerWrapperStyle={styles.pickerWrapper}
                        fieldGroupStyle={styles.structureGroup}
                      />
                    </>
                  )}

                  <ThemedView style={styles.treeActionsRow}>
                    <ScalePressButton style={styles.treeActionPrimary} onPress={applyUpdPuestosFromTree}>
                      <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                      <ThemedText style={styles.treeActionPrimaryText}>Confirmar</ThemedText>
                    </ScalePressButton>
                    <ScalePressButton
                      style={styles.treeActionSecondary}
                      onPress={() => {
                        setUpdSelectedPuestos([]);
                        setUpdHasConfirmedPuestos(false);
                        setUpdIsSelectedPuestosExpanded(false);
                      }}
                    >
                      <Ionicons name="trash-outline" size={18} color="#007AFF" />
                      <ThemedText style={styles.treeActionSecondaryText}>Limpiar</ThemedText>
                    </ScalePressButton>
                  </ThemedView>

                  <ThemedText style={styles.signatureHintMuted}>
                    Seleccionados: {updSelectedPuestos.length} | En el filtro: {updFilteredPuestosFromTree.length}
                  </ThemedText>

                  {updHasConfirmedPuestos && updSelectedPuestosUi.length > 0 && (
                    <ThemedView style={styles.selectedPuestosBox}>
                      <TouchableOpacity
                        style={styles.selectedPuestosHeader}
                        onPress={() => setUpdIsSelectedPuestosExpanded((p) => !p)}
                      >
                        <ThemedText style={styles.selectedPuestosHeaderText}>
                          Puestos seleccionados ({updSelectedPuestosUi.length})
                        </ThemedText>
                        <Ionicons
                          name={updIsSelectedPuestosExpanded ? 'chevron-up' : 'chevron-down'}
                          size={18}
                          color="#007AFF"
                        />
                      </TouchableOpacity>
                      {updIsSelectedPuestosExpanded && updSelectedPuestosUi.length <= 150 && (
                        <ThemedView style={styles.puestosList}>
                          {updSelectedPuestosUi.map((puesto) => {
                            const isSel = updSelectedPuestos.includes(puesto.id);
                            return (
                              <TouchableOpacity
                                key={puesto.id}
                                style={[styles.puestoItem, isSel && styles.puestoItemSelected]}
                                onPress={() => toggleUpdPuestoSelection(puesto.id)}
                              >
                                <ThemedText
                                  style={[styles.puestoItemText, isSel && styles.puestoItemTextSelected]}
                                >
                                  {puesto.nombre}
                                </ThemedText>
                              </TouchableOpacity>
                            );
                          })}
                        </ThemedView>
                      )}
                    </ThemedView>
                  )}
                </>
              )}
            </ScrollView>

            <ThemedView style={styles.updPuestosModalActions}>
              <ScalePressButton
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={closeUpdManualPuestosModal}
              >
                <ThemedText style={styles.modalCancelButtonText}>Cancelar</ThemedText>
              </ScalePressButton>
              <ScalePressButton
                style={[styles.modalButton, styles.modalConfirmButton, isSubmittingUpdManualPuestos && { opacity: 0.7 }]}
                onPress={() => void submitUpdManualPuestosModal()}
                disabled={isSubmittingUpdManualPuestos}
              >
                {isSubmittingUpdManualPuestos ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <ThemedText style={styles.modalConfirmButtonText}>Guardar</ThemedText>
                )}
              </ScalePressButton>
            </ThemedView>
          </ThemedView>
        </ThemedView>
      </Modal>

      {/* QR Scanner (reutilizable) */}
      {QRScannerComponent}

      {/* Modal de visualización de manual con audio y video */}
      <Modal
        visible={isViewerVisible && !!selectedManual}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setIsViewerVisible(false);
          setSelectedManual(null);
          clearViewFirma();
          setIsSigningManual(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <ThemedView style={styles.viewerModalContainer}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle} numberOfLines={2}>
                {selectedManual?.title || 'Manual de puesto'}
              </ThemedText>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {selectedManual &&
                  String(selectedManual.created_by ?? '') === String(employee?.id ?? '') && (
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => {
                        if (!selectedManual) return;
                        Alert.alert(
                          'Eliminar manual',
                          '¿Estás seguro de eliminar este manual?',
                          [
                            { text: 'Cancelar', style: 'cancel' },
                            {
                              text: 'Eliminar',
                              style: 'destructive',
                              onPress: async () => {
                                try {
                                  setIsDeletingManual(true);
                                  const listPuestoReload =
                                    roleName === 'OPERATIVO'
                                      ? marcaPuestoIdFromMarca
                                      : (filterPuestoId ?? marcaPuestoIdFromMarca);
                                  const isConnected = await getConnectionStatus();

                                  // Si es local sin sincronizar, solo limpiar cache y acciones
                                  if (!selectedManual.id || selectedManual.id === 0 || selectedManual.id_local) {
                                    const actionsStr = await AsyncStorage.getItem('job_manuals_actions');
                                    const actions = actionsStr ? JSON.parse(actionsStr) : [];
                                    const lid = selectedManual.id_local;
                                    const filtered = actions.filter(
                                      (a: any) =>
                                        !(
                                          lid &&
                                          String(a.id) === String(lid) &&
                                          (a.type === 'create' || a.type === 'update')
                                        )
                                    );
                                    await AsyncStorage.setItem('job_manuals_actions', JSON.stringify(filtered));

                                    const cacheStr = await AsyncStorage.getItem('job_manuals_cache');
                                    if (cacheStr) {
                                      const cache = JSON.parse(cacheStr);
                                      const updatedCache = cache.filter((m: any) => m.id_local !== selectedManual.id_local);
                                      await AsyncStorage.setItem('job_manuals_cache', JSON.stringify(updatedCache));
                                    }

                                    Alert.alert('Modo Offline', 'Manual local eliminado.');
                                    setIsViewerVisible(false);
                                    setSelectedManual(null);
                                    clearViewFirma();
                                    setIsSigningManual(false);
                                    if (marcaId) {
                                      await fetchManuals(marcaId, listPuestoReload);
                                    }
                                    return;
                                  }

                                  if (isConnected) {
                                    const result = await deleteJobManual({
                                      id: selectedManual.id,
                                      refreshAccessToken,
                                      logout,
                                    });
                                    if (!result.status) {
                                      Alert.alert('Error', result.message || 'No se pudo eliminar el manual');
                                    } else {
                                      try {
                                        const as = await AsyncStorage.getItem('job_manuals_actions');
                                        if (as) {
                                          const parsed = JSON.parse(as);
                                          const mid = Number(selectedManual.id);
                                          const cleaned = Array.isArray(parsed)
                                            ? parsed.filter(
                                                (a: any) =>
                                                  !(
                                                    a.type === 'append_puestos' &&
                                                    Number(a.manualId) === mid
                                                  )
                                              )
                                            : parsed;
                                          await AsyncStorage.setItem('job_manuals_actions', JSON.stringify(cleaned));
                                        }
                                      } catch {
                                        /* ignore */
                                      }
                                      Alert.alert('Éxito', result.message || 'Manual eliminado');
                                      setIsViewerVisible(false);
                                      setSelectedManual(null);
                                      clearViewFirma();
                                      setIsSigningManual(false);
                                      if (marcaId) {
                                        await fetchManuals(marcaId, listPuestoReload);
                                      }
                                    }
                                  } else {
                                    // Agendar acción de borrado
                                    const actionsStr = await AsyncStorage.getItem('job_manuals_actions');
                                    let actions = actionsStr ? JSON.parse(actionsStr) : [];
                                    const mid = Number(selectedManual.id);
                                    actions = actions.filter(
                                      (a: any) =>
                                        !(a.type === 'append_puestos' && Number(a.manualId) === mid)
                                    );
                                    actions.push({
                                      id: selectedManual.id,
                                      type: 'delete',
                                      marcaId,
                                    });
                                    await AsyncStorage.setItem('job_manuals_actions', JSON.stringify(actions));

                                    // Remover de cache para que no aparezca
                                    const cacheStr = await AsyncStorage.getItem('job_manuals_cache');
                                    if (cacheStr) {
                                      const cache = JSON.parse(cacheStr);
                                      const updatedCache = cache.filter((m: any) => m.id !== selectedManual.id);
                                      await AsyncStorage.setItem('job_manuals_cache', JSON.stringify(updatedCache));
                                    }

                                    Alert.alert('Modo Offline', 'Manual marcado para eliminación cuando haya conexión.');
                                    setIsViewerVisible(false);
                                    setSelectedManual(null);
                                    clearViewFirma();
                                    setIsSigningManual(false);
                                    if (marcaId) {
                                      await fetchManuals(marcaId, listPuestoReload);
                                    }
                                  }
                                } catch (error) {
                                  console.error('Error deleting manual:', error);
                                  Alert.alert('Error', 'No se pudo eliminar el manual');
                                } finally {
                                  setIsDeletingManual(false);
                                }
                              },
                            },
                          ]
                        );
                      }}
                      disabled={isDeletingManual}
                    >
                      {isDeletingManual ? (
                        <ActivityIndicator size="small" color="#FF3B30" />
                      ) : (
                        <Ionicons name="trash" size={22} color="#FF3B30" />
                      )}
                    </TouchableOpacity>
                  )}
                <TouchableOpacity
                  onPress={() => {
                    setIsViewerVisible(false);
                    setSelectedManual(null);
                  }}
                >
                  <Ionicons name="close" size={24} color="#666666" />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView
              style={styles.modalContent}
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={true}
            >
              {selectedManual &&
                (selectedManual.id_local != null && String(selectedManual.id_local).length > 0
                  || selectedManual.synced === false
                  || !selectedManual.id
                  || selectedManual.id === 0) && (
                <ThemedView
                  style={{
                    marginBottom: 12,
                    padding: 10,
                    borderRadius: 8,
                    backgroundColor: 'rgba(255, 193, 7, 0.2)',
                    borderWidth: 1,
                    borderColor: 'rgba(200, 150, 0, 0.45)',
                  }}
                >
                  <ThemedText style={{ color: '#666', fontSize: 13, fontWeight: '600' }}>
                    Manual solo en dispositivo (pendiente de sincronizar)
                  </ThemedText>
                </ThemedView>
              )}
              {selectedManual?.description ? (
                <ThemedText style={styles.viewerDescription}>
                  {selectedManual.description}
                </ThemedText>
              ) : null}

              {/* Firmas registradas (solo supervisores / administrativos) */}
              {(selectedManual?.visualizaciones?.length ?? 0) > 0 &&
                (roleName === 'SUPERVISOR' || roleName === 'ADMINISTRATIVO') && (
                  <ThemedView style={styles.viewerSection}>
                    <ThemedText style={styles.viewerSectionTitle}>Firmas registradas</ThemedText>
                    {(() => {
                      const quizCfgData = parseQuizFromManual(selectedManual?.quiz);
                      const quizCfg = quizCfgData.questions;
                      const hasQuizConfigured = quizCfg.length > 0;

                      return (selectedManual?.visualizaciones || []).map((firma) => {
                        const quizAnswers = parseQuizAnswersFromVisualization((firma as any)?.quiz_answear);
                        const hasQuizAnswers = quizAnswers.length > 0;
                        const visFiles = ((firma as any)?.files || []) as ManualFileRemote[];

                        const approved = firma.approved ?? null;
                        const approvedPending = !!(firma as any)?.approved_pending;
                        const quizGraded = isVisualizationQuizGraded(firma);
                        const currentUserEmpIdForQuiz =
                          typeof employee?.id === 'number' ? employee.id : Number(employee?.id || 0);
                        const isOwnQuizAttempt =
                          Number.isFinite(currentUserEmpIdForQuiz) &&
                          currentUserEmpIdForQuiz > 0 &&
                          currentUserEmpIdForQuiz === Number(firma.empleado_id);
                        const hideQuizGradingForm = isOwnQuizAttempt && !quizGraded;
                        const statusLabel =
                          approvedPending ? 'Pendiente de sincronización'
                            : approved === true ? 'Aprobado'
                              : approved === false ? 'Reprobado'
                                : hasQuizConfigured ? 'Pendiente de revisión'
                                  : '—';

                        return (
                          <ThemedView key={firma.id} style={styles.quizReviewCard}>
                            <ThemedView style={styles.signatureListRow}>
                              <Ionicons name="person-circle-outline" size={20} color="#007AFF" />
                              <ThemedText style={styles.signatureListName}>
                                {firma.nombre_empleado || 'Empleado'}
                              </ThemedText>
                              <ThemedText style={styles.signatureListDate}>
                                {firma.created_at ? convertDateTimestampToLocalString(new Date(firma.created_at).toISOString()) : ''}
                              </ThemedText>
                            </ThemedView>

                            {hasQuizConfigured && (
                              <ThemedText style={styles.quizReviewStatusText}>
                                Estado del quiz: {statusLabel}
                              </ThemedText>
                            )}

                            {/* Archivos adjuntos de la visualización */}
                            {visFiles.length > 0 && (
                              <ThemedView style={{ marginTop: 10 }}>
                                <ThemedText style={styles.viewerSectionTitle}>Evidencias</ThemedText>

                                {visFiles.some(f => f.type === 'image') && selectedManual && (
                                  <ThemedView style={{ marginTop: 6 }}>
                                    <ThemedText style={styles.quizQuestionMeta}>Imágenes</ThemedText>
                                    {visFiles
                                      .filter(f => f.type === 'image')
                                      .map(file => (
                                        <ManualImageViewer
                                          key={`vis_${firma.id}_${file.id}`}
                                          imageUrl={buildVisualizationFileUrl(selectedManual.id, firma.id, file)}
                                        />
                                      ))}
                                  </ThemedView>
                                )}

                                {visFiles.some(f => f.type === 'audio') && selectedManual && (
                                  <ThemedView style={{ marginTop: 6 }}>
                                    <ThemedText style={styles.quizQuestionMeta}>Audios</ThemedText>
                                    {visFiles
                                      .filter(f => f.type === 'audio')
                                      .map(file => (
                                        <ManualAudioPlayer
                                          key={`vis_${firma.id}_${file.id}`}
                                          sourceUrl={buildVisualizationFileUrl(selectedManual.id, firma.id, file)}
                                          label={getRemoteFileDisplayName(file)}
                                        />
                                      ))}
                                  </ThemedView>
                                )}

                                {visFiles.some(f => f.type === 'video') && selectedManual && (
                                  <ThemedView style={{ marginTop: 6 }}>
                                    <ThemedText style={styles.quizQuestionMeta}>Videos</ThemedText>
                                    {visFiles
                                      .filter(f => f.type === 'video')
                                      .map(file => (
                                        <ManualVideoPlayer
                                          key={`vis_${firma.id}_${file.id}`}
                                          sourceUrl={buildVisualizationFileUrl(selectedManual.id, firma.id, file)}
                                        />
                                      ))}
                                  </ThemedView>
                                )}

                                {visFiles.some(f => f.type === 'document') && selectedManual && (
                                  <ThemedView style={{ marginTop: 6 }}>
                                    <ThemedText style={styles.quizQuestionMeta}>Documentos</ThemedText>
                                    {visFiles
                                      .filter(f => f.type === 'document')
                                      .map(file => (
                                        <TouchableOpacity
                                          key={`vis_${firma.id}_${file.id}`}
                                          style={styles.documentRow}
                                          onPress={() => {
                                            const url = buildVisualizationFileUrl(selectedManual.id, firma.id, file);
                                            if (url) Linking.openURL(url);
                                            else Alert.alert('Error', 'URL inválida para descargar el archivo');
                                          }}
                                        >
                                          <Ionicons name="document-text-outline" size={20} color="#007AFF" />
                                          <ThemedText numberOfLines={1} style={styles.documentText}>
                                            {getRemoteFileDisplayName(file)}
                                          </ThemedText>
                                        </TouchableOpacity>
                                      ))}
                                  </ThemedView>
                                )}
                              </ThemedView>
                            )}

                            {hasQuizConfigured && (
                              <ThemedView style={{ marginTop: 8 }}>
                                {hideQuizGradingForm ? (
                                  <ThemedView
                                    style={[
                                      styles.quizReviewScoringWarningBox,
                                      { borderColor: 'rgba(200, 150, 0, 0.5)', backgroundColor: 'rgba(255, 193, 7, 0.12)' },
                                    ]}
                                  >
                                    <ThemedText style={styles.quizReviewScoringWarningText}>
                                      No puedes calificar tu propio intento de quiz. El formulario de calificación no está
                                      disponible: debe revisarlo y registrar el resultado otra persona con rol supervisor o
                                      administrativo.
                                    </ThemedText>
                                  </ThemedView>
                                ) : !hasQuizAnswers ? (
                                  <ThemedText style={styles.quizEmptyText}>
                                    {firma.quiz_answear ? 'Respuestas inválidas' : 'Sin respuestas de quiz'}
                                  </ThemedText>
                                ) : (
                                  <ThemedView style={styles.quizReviewList}>
                                    {quizCfg.map((q) => {
                                      const ans = quizAnswers.find(a => String(a.question_id) === String(q.id));
                                      const userAnswer =
                                        (ans?.user_answer && String(ans.user_answer)) ||
                                        (Array.isArray(ans?.user_answers) ? ans?.user_answers?.join(', ') : '') ||
                                        '';
                                      const correctAnswer =
                                        (q.answer && String(q.answer)) ||
                                        (Array.isArray(q.answers) ? q.answers.join(', ') : '') ||
                                        '';

                                      // Calificación automática para multiple_choice
                                      const isAutoGraded = q.type === 'multiple_choice';
                                      const isCorrect = isAutoGraded && userAnswer === correctAnswer;

                                      // Obtener puntaje actual (si ya fue calificado) o calcular automáticamente
                                      const currentScore = quizReviewScores[firma.empleado_id]?.[q.id];
                                      const questionPoints = q.points || 0;
                                      const autoScore = isAutoGraded && isCorrect ? questionPoints : (isAutoGraded ? 0 : undefined);
                                      const displayScore = currentScore !== undefined ? currentScore : (autoScore !== undefined ? autoScore : null);

                                      return (
                                        <ThemedView key={q.id} style={styles.quizReviewItem}>
                                          <ThemedText style={styles.quizReviewQuestionTitle} numberOfLines={3}>
                                            {q.title}
                                          </ThemedText>
                                          <ThemedText style={styles.quizQuestionMeta}>
                                            • {getQuizTypeLabel(q.type)} {questionPoints > 0 ? `• Puntaje máximo: ${questionPoints}` : ''}
                                          </ThemedText>

                                          <ThemedView style={styles.quizReviewRow}>
                                            <ThemedText style={styles.quizReviewLabel}>Respuesta del usuario</ThemedText>
                                            <ThemedText style={styles.quizReviewValue}>{userAnswer || '—'}</ThemedText>
                                          </ThemedView>
                                          <ThemedView style={styles.quizReviewRow}>
                                            <ThemedText style={styles.quizReviewLabel}>Respuesta correcta</ThemedText>
                                            <ThemedText style={styles.quizReviewValue}>{correctAnswer || '—'}</ThemedText>
                                          </ThemedView>

                                          {/* Campo de puntaje (excepto para multiple_choice que se califica automáticamente) */}
                                          <ThemedView style={styles.quizReviewRow}>
                                            <ThemedText style={styles.quizReviewLabel}>
                                              Puntaje obtenido {isAutoGraded ? '(automático)' : `(máximo: ${questionPoints})`}
                                            </ThemedText>
                                            {isAutoGraded ? (
                                              <ThemedText style={[styles.quizReviewValue, isCorrect && { color: '#34C759' }, !isCorrect && { color: '#FF3B30' }]}>
                                                {displayScore !== null ? `${displayScore} / ${questionPoints}` : `0 / ${questionPoints}`}
                                              </ThemedText>
                                            ) : (
                                              <TextInput
                                                style={[styles.formInput, { width: 100, textAlign: 'right' }]}
                                                value={displayScore !== null ? String(displayScore) : ''}
                                                editable={!quizGraded && !approvedPending}
                                                onChangeText={(text) => {
                                                  const value = text.trim() === '' ? null : parseFloat(text);
                                                  if (text.trim() === '' || (!isNaN(value as number) && value! >= 0 && value! <= questionPoints)) {
                                                    setQuizReviewScores(prev => ({
                                                      ...prev,
                                                      [firma.empleado_id]: {
                                                        ...(prev[firma.empleado_id] || {}),
                                                        [q.id]: value === null ? 0 : value,
                                                      },
                                                    }));
                                                  }
                                                }}
                                                placeholder="0"
                                                placeholderTextColor="#999"
                                                keyboardType="numeric"
                                              />
                                            )}
                                          </ThemedView>
                                        </ThemedView>
                                      );
                                    })}

                                    {/* Resumen de puntajes */}
                                    {(() => {
                                      const totalPoints = quizCfg.reduce((sum, q) => sum + (q.points || 0), 0);
                                      const obtainedPoints = quizCfg.reduce((sum, q) => {
                                        if (q.type === 'multiple_choice') {
                                          const ans = quizAnswers.find(a => String(a.question_id) === String(q.id));
                                          const userAnswer = (ans?.user_answer && String(ans.user_answer)) || '';
                                          const correctAnswer = (q.answer && String(q.answer)) || '';
                                          return sum + (userAnswer === correctAnswer ? (q.points || 0) : 0);
                                        } else {
                                          const score = quizReviewScores[firma.empleado_id]?.[q.id];
                                          return sum + (score !== undefined ? score : 0);
                                        }
                                      }, 0);
                                      // Calcular porcentaje: puntos obtenidos / puntaje máximo * 100
                                      const percentage = totalPoints > 0 ? (obtainedPoints / totalPoints) * 100 : 0;
                                      const minPercentage = quizCfgData.minApprovalPercentage || 70;
                                      const isApproved = percentage >= minPercentage;

                                      return (
                                        <ThemedView style={styles.quizReviewSummary}>
                                          <ThemedText style={styles.quizReviewSummaryTitle}>Resumen</ThemedText>
                                          <ThemedView style={styles.quizReviewRow}>
                                            <ThemedText style={styles.quizReviewLabel}>Puntaje máximo</ThemedText>
                                            <ThemedText style={styles.quizReviewValue}>{totalPoints} puntos</ThemedText>
                                          </ThemedView>
                                          <ThemedView style={styles.quizReviewRow}>
                                            <ThemedText style={styles.quizReviewLabel}>Puntaje obtenido</ThemedText>
                                            <ThemedText style={styles.quizReviewValue}>{obtainedPoints} puntos</ThemedText>
                                          </ThemedView>
                                          <ThemedView style={styles.quizReviewRow}>
                                            <ThemedText style={styles.quizReviewLabel}>Porcentaje obtenido</ThemedText>
                                            <ThemedText style={styles.quizReviewValue}>{percentage.toFixed(1)}%</ThemedText>
                                          </ThemedView>
                                          <ThemedView style={styles.quizReviewRow}>
                                            <ThemedText style={styles.quizReviewLabel}>Mínimo requerido</ThemedText>
                                            <ThemedText style={styles.quizReviewValue}>{minPercentage}%</ThemedText>
                                          </ThemedView>
                                          <ThemedView style={styles.quizReviewRow}>
                                            <ThemedText style={styles.quizReviewLabel}>Estado</ThemedText>
                                            <ThemedText style={[styles.quizReviewValue, isApproved ? { color: '#34C759', fontWeight: '600' } : { color: '#FF3B30', fontWeight: '600' }]}>
                                              {isApproved ? 'Aprobado' : 'Reprobado'}
                                            </ThemedText>
                                          </ThemedView>
                                        </ThemedView>
                                      );
                                    })()}
                                  </ThemedView>
                                )}

                                {hasQuizAnswers && (() => {
                                  const totalPoints = quizCfg.reduce((sum, q) => sum + (q.points || 0), 0);
                                  const obtainedPoints = quizCfg.reduce((sum, q) => {
                                    if (q.type === 'multiple_choice') {
                                      const ans = quizAnswers.find(a => String(a.question_id) === String(q.id));
                                      const userAnswer = (ans?.user_answer && String(ans.user_answer)) || '';
                                      const correctAnswer = (q.answer && String(q.answer)) || '';
                                      return sum + (userAnswer === correctAnswer ? (q.points || 0) : 0);
                                    } else {
                                      const score = quizReviewScores[firma.empleado_id]?.[q.id];
                                      return sum + (score !== undefined ? score : 0);
                                    }
                                  }, 0);
                                  const percentage = totalPoints > 0 ? (obtainedPoints / totalPoints) * 100 : 0;
                                  const minPercentage = quizCfgData.minApprovalPercentage || 70;
                                  const isApproved = percentage >= minPercentage;

                                  // Verificar si todas las preguntas han sido calificadas
                                  const allQuestionsScored = quizCfg.every(q => {
                                    if (q.type === 'multiple_choice') return true; // Se califica automáticamente
                                    return quizReviewScores[firma.empleado_id]?.[q.id] !== undefined;
                                  });

                                  const cannotConfirmQuiz =
                                    quizGraded || updatingQuizResultByEmployee[firma.empleado_id] || approvedPending || !allQuestionsScored;

                                  return (
                                    <ThemedView style={styles.quizReviewActionsColumn}>
                                      {quizGraded && (
                                        <ThemedView style={styles.quizReviewScoringWarningBox}>
                                          <ThemedText style={styles.quizReviewScoringWarningText}>
                                            Este quiz ya fue calificado
                                            {firma.updated_at
                                              ? ` (${convertDateTimestampToLocalString(new Date(firma.updated_at).toISOString())})`
                                              : ''}
                                            .
                                          </ThemedText>
                                        </ThemedView>
                                      )}
                                      <TouchableOpacity
                                        style={[
                                          styles.quizReviewActionBtn,
                                          isApproved ? styles.quizReviewApproveBtn : styles.quizReviewRejectBtn,
                                          cannotConfirmQuiz && styles.formButtonDisabled,
                                        ]}
                                        disabled={cannotConfirmQuiz}
                                        onPress={() => handleSetQuizResult(selectedManual?.id ?? 0, firma.empleado_id, isApproved)}
                                      >
                                        {updatingQuizResultByEmployee[firma.empleado_id] ? (
                                          <ActivityIndicator size="small" color="#FFFFFF" />
                                        ) : (
                                          <>
                                            <Ionicons name={isApproved ? "checkmark-circle" : "close-circle"} size={18} color="#FFFFFF" />
                                            <ThemedText style={styles.quizReviewActionText}>
                                              Confirmar resultado {isApproved ? '(Aprobado)' : '(Reprobado)'}
                                            </ThemedText>
                                          </>
                                        )}
                                      </TouchableOpacity>
                                      {!allQuestionsScored && !quizGraded && (
                                        <ThemedView style={styles.quizReviewScoringWarningBox}>
                                          <ThemedText style={styles.quizReviewScoringWarningText}>
                                            Debe calificar todas las preguntas con puntaje antes de confirmar
                                          </ThemedText>
                                        </ThemedView>
                                      )}
                                    </ThemedView>
                                  );
                                })()}
                              </ThemedView>
                            )}
                          </ThemedView>
                        );
                      });
                    })()}
                  </ThemedView>
                )}

              {/* Imágenes */}
              {selectedManual?.files?.some(f => f.type === 'image') && selectedManual && (
                <ThemedView style={styles.viewerSection}>
                  <ThemedText style={styles.viewerSectionTitle}>Imágenes</ThemedText>
                  {selectedManual.files
                    .filter(f => f.type === 'image')
                    .map(file => (
                      <ManualImageViewer
                        key={file.id}
                        imageUrl={buildFileUrl(selectedManual.id, file)}
                      />
                    ))}
                </ThemedView>
              )}

              {/* Audio */}
              {selectedManual?.files?.some(f => f.type === 'audio') && selectedManual && (
                <ThemedView style={styles.viewerSection}>
                  <ThemedText style={styles.viewerSectionTitle}>Audios</ThemedText>
                  {selectedManual.files
                    .filter(f => f.type === 'audio')
                    .map(file => (
                      <ManualAudioPlayer
                        key={file.id}
                        sourceUrl={buildFileUrl(selectedManual.id, file)}
                        label={getRemoteFileDisplayName(file)}
                      />
                    ))}
                </ThemedView>
              )}

              {/* Video */}
              {selectedManual?.files?.some(f => f.type === 'video') && selectedManual && (
                <ThemedView style={styles.viewerSection}>
                  <ThemedText style={styles.viewerSectionTitle}>Videos</ThemedText>
                  {selectedManual.files
                    .filter(f => f.type === 'video')
                    .map(file => (
                      <ManualVideoPlayer
                        key={file.id}
                        sourceUrl={buildFileUrl(selectedManual.id, file)}
                      />
                    ))}
                </ThemedView>
              )}

              {/* Documentos / texto descargable */}
              {selectedManual?.files?.some(f => f.type === 'document') && (
                <ThemedView style={styles.viewerSection}>
                  <ThemedText style={styles.viewerSectionTitle}>Documentos</ThemedText>
                  {selectedManual.files
                    .filter(f => f.type === 'document')
                    .map(file => (
                      <TouchableOpacity
                        key={file.id}
                        style={styles.documentRow}
                        onPress={() => {
                          const url = buildFileUrl(selectedManual.id, file);
                          if (url) {
                            Linking.openURL(url);
                          } else {
                            Alert.alert('Error', 'URL inválida para descargar el archivo');
                          }
                        }}
                      >
                        <Ionicons name="document-text-outline" size={20} color="#007AFF" />
                        <ThemedText numberOfLines={1} style={styles.documentText}>
                          {getRemoteFileDisplayName(file)}
                        </ThemedText>
                      </TouchableOpacity>
                    ))}
                </ThemedView>
              )}

              {/* Quiz (responder) */}
              {(() => {
                if (!selectedManual) return null;
                const quizCfgData = parseQuizFromManual(selectedManual.quiz);
                const quizCfg = quizCfgData.questions;
                if (!quizCfg || quizCfg.length === 0) return null;

                // Regla: mostrar si no ha firmado o si puede reintentar por reprobación
                const canAnswer = !selectedManual.currentEmployeeSigned || retakeAllowed;
                if (!canAnswer) {
                  return (
                    <ThemedView style={styles.viewerSection}>
                      <ThemedText style={styles.viewerSectionTitle}>Quiz</ThemedText>
                      <ThemedText style={styles.quizEmptyText}>
                        Ya has firmado este manual.
                      </ThemedText>
                    </ThemedView>
                  );
                }

                return (
                  <ThemedView style={styles.viewerSection}>
                    <ThemedText style={styles.viewerSectionTitle}>Quiz (Obligatorio)</ThemedText>
                    {quizCfg.map((q) => {
                      const value = quizUserAnswers[q.id];
                      const options = q.options || [];

                      const setValue = (v: string | string[]) => {
                        setQuizUserAnswers(prev => ({ ...prev, [q.id]: v }));
                      };

                      return (
                        <ThemedView key={q.id} style={styles.quizQuestionCard}>
                          <ThemedText style={styles.quizQuestionTitle}>
                            {q.title}
                          </ThemedText>
                          <ThemedText style={styles.quizQuestionMeta}>
                            {getQuizTypeLabel(q.type)} • Puntaje: {q.points || 0} puntos
                          </ThemedText>

                          {q.type === 'short' && (
                            <TextInput
                              style={styles.formInput}
                              value={typeof value === 'string' ? value : ''}
                              onChangeText={(t) => setValue(t)}
                              placeholder="Tu respuesta"
                              placeholderTextColor="#999"
                            />
                          )}

                          {q.type === 'paragraph' && (
                            <TextInput
                              style={[styles.formInput, { height: 90, textAlignVertical: 'top' }]}
                              multiline
                              value={typeof value === 'string' ? value : ''}
                              onChangeText={(t) => setValue(t)}
                              placeholder="Tu respuesta"
                              placeholderTextColor="#999"
                            />
                          )}

                          {(q.type === 'multiple_choice') && (
                            <ThemedView style={styles.quizSelectList}>
                              {options.map((opt) => {
                                const selected = value === opt;
                                return (
                                  <TouchableOpacity
                                    key={opt}
                                    style={styles.quizSelectItem}
                                    onPress={() => setValue(opt)}
                                  >
                                    <Ionicons
                                      name={selected ? "radio-button-on" : "radio-button-off"}
                                      size={18}
                                      color={selected ? "#007AFF" : "#999"}
                                    />
                                    <ThemedText style={styles.quizSelectText}>{opt}</ThemedText>
                                  </TouchableOpacity>
                                );
                              })}
                            </ThemedView>
                          )}

                          {(q.type === 'multiple_select') && (
                            <ThemedView style={styles.quizSelectList}>
                              {options.map((opt) => {
                                const selectedArr = Array.isArray(value) ? value : [];
                                const selected = selectedArr.includes(opt);
                                return (
                                  <TouchableOpacity
                                    key={opt}
                                    style={styles.quizSelectItem}
                                    onPress={() => {
                                      const next = selected
                                        ? selectedArr.filter(x => x !== opt)
                                        : [...selectedArr, opt];
                                      setValue(next);
                                    }}
                                  >
                                    <Ionicons
                                      name={selected ? "checkbox" : "square-outline"}
                                      size={18}
                                      color={selected ? "#007AFF" : "#999"}
                                    />
                                    <ThemedText style={styles.quizSelectText}>{opt}</ThemedText>
                                  </TouchableOpacity>
                                );
                              })}
                            </ThemedView>
                          )}

                          {(q.type === 'list') && (
                            <ThemedView style={{ marginTop: 6 }}>
                              <TouchableOpacity
                                style={styles.quizSelectItem}
                                onPress={() => setOpenListQuestionId(prev => prev === q.id ? null : q.id)}
                              >
                                <Ionicons name="chevron-down" size={18} color="#999" />
                                <ThemedText style={styles.quizSelectText}>
                                  {typeof value === 'string' && value ? value : 'Selecciona una opción'}
                                </ThemedText>
                              </TouchableOpacity>
                              {openListQuestionId === q.id && (
                                <ThemedView style={[styles.quizSelectList, { marginTop: 8 }]}>
                                  {options.map((opt) => (
                                    <TouchableOpacity
                                      key={opt}
                                      style={styles.quizSelectItem}
                                      onPress={() => {
                                        setValue(opt);
                                        setOpenListQuestionId(null);
                                      }}
                                    >
                                      <Ionicons name="list" size={18} color="#999" />
                                      <ThemedText style={styles.quizSelectText}>{opt}</ThemedText>
                                    </TouchableOpacity>
                                  ))}
                                </ThemedView>
                              )}
                            </ThemedView>
                          )}
                        </ThemedView>
                      );
                    })}
                  </ThemedView>
                );
              })()}

              {/* Firma de visualización - al final de la lista */}
              {selectedManual && (!selectedManual.currentEmployeeSigned || retakeAllowed) && (
                <ThemedView style={styles.viewerSection}>
                  <ThemedText style={styles.viewerSectionTitle}>Confirmar visualización</ThemedText>
                  {!viewSignature ? (
                    <ThemedView style={styles.signatureButtons}>
                      <TouchableOpacity
                        style={styles.signatureButton}
                        onPress={generateViewSignature}
                        disabled={isGeneratingViewFirma}
                      >
                        {isGeneratingViewFirma ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Ionicons name="finger-print" size={18} color="#FFFFFF" />
                            <ThemedText style={styles.signatureButtonText}>Generar</ThemedText>
                          </>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.signatureButton}
                        onPress={handleScanViewQR}
                      >
                        <Ionicons name="qr-code-outline" size={18} color="#FFFFFF" />
                        <ThemedText style={styles.signatureButtonText}>Escanear QR</ThemedText>
                      </TouchableOpacity>
                    </ThemedView>
                  ) : (
                    <ThemedView style={styles.signatureRow}>
                      {viewFirmaData && (
                        <ThemedView style={styles.signatureInfo}>
                          <ThemedText style={styles.signatureInfoTitle}>Información de la firma:</ThemedText>
                          <ThemedText style={styles.signatureInfoText}>ID de sesión: {viewFirmaData.sessionId}</ThemedText>
                          <ThemedText style={styles.signatureInfoText}>ID del empleado: {viewFirmaData.empleadoId}</ThemedText>
                          {viewFirmaData.empleadoDetalle && (
                            <ThemedView style={styles.signatureInfoDetail}>
                              <ThemedText style={styles.signatureInfoDetailText}>
                                {viewFirmaData.empleadoDetalle.nombre}{' '}
                                {viewFirmaData.empleadoDetalle.primer_apellido}{' '}
                                {viewFirmaData.empleadoDetalle.segundo_apellido}{' '}
                                ({viewFirmaData.empleadoDetalle.cedula_empleado})
                              </ThemedText>
                            </ThemedView>
                          )}
                          <ThemedText style={styles.signatureInfoText}>Latitud: {viewFirmaData.latitud}</ThemedText>
                          <ThemedText style={styles.signatureInfoText}>Longitud: {viewFirmaData.longitud}</ThemedText>
                          <ThemedText style={styles.signatureInfoText}>
                            Fecha y hora:{' '}
                            {convertDateTimestampToLocalString(new Date(Number(viewFirmaData.timestamp)).toISOString())}
                          </ThemedText>
                          <TouchableOpacity
                            style={styles.clearSignatureButton}
                            onPress={clearViewFirma}
                          >
                            <ThemedText style={styles.clearSignatureText}>Limpiar</ThemedText>
                          </TouchableOpacity>
                        </ThemedView>
                      )}

                      {/* Evidencias (archivos) para la visualización */}
                      <ThemedView style={{ width: '100%', marginTop: 10 }}>
                        <ThemedText style={styles.signatureHintMuted}>
                          Evidencias (opcional): puedes adjuntar imágenes, audios, videos o documentos.
                        </ThemedText>

                        <ThemedView style={styles.fileIconButtonsRow}>
                          <TouchableOpacity style={styles.fileIconButton} onPress={() => handleAddViewFile('image')}>
                            <Ionicons name="image-outline" size={20} color="#007AFF" />
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.fileIconButton} onPress={() => handleAddViewFile('audio')}>
                            <Ionicons name="mic-outline" size={20} color="#007AFF" />
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.fileIconButton} onPress={() => handleAddViewFile('video')}>
                            <Ionicons name="videocam-outline" size={20} color="#007AFF" />
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.fileIconButton} onPress={() => handleAddViewFile('document')}>
                            <Ionicons name="document-text-outline" size={20} color="#007AFF" />
                          </TouchableOpacity>
                        </ThemedView>

                        {(viewTextFiles.length + viewImageFiles.length + viewAudioFiles.length + viewVideoFiles.length) > 0 && (
                          <ThemedView style={styles.filesList}>
                            {viewImageFiles.map(file => (
                              <ThemedView key={file.id} style={styles.fileRow}>
                                <Image
                                  source={{ uri: `data:image/${file.extension || 'jpeg'};base64,${file.base64}` }}
                                  style={styles.filePreviewImage}
                                  resizeMode="cover"
                                />
                                <ThemedText numberOfLines={1} style={styles.fileName}>{file.name}</ThemedText>
                                <TouchableOpacity onPress={() => removeViewLocalFile('image', file.id)}>
                                  <Ionicons name="trash" size={16} color="#FF3B30" />
                                </TouchableOpacity>
                              </ThemedView>
                            ))}

                            {viewAudioFiles.map(file => (
                              <ThemedView key={file.id} style={styles.fileRow}>
                                <Ionicons name="musical-notes-outline" size={16} color="#007AFF" />
                                <ThemedText numberOfLines={1} style={styles.fileName}>{file.name}</ThemedText>
                                <TouchableOpacity onPress={() => removeViewLocalFile('audio', file.id)}>
                                  <Ionicons name="trash" size={16} color="#FF3B30" />
                                </TouchableOpacity>
                              </ThemedView>
                            ))}

                            {viewVideoFiles.map(file => (
                              <ThemedView key={file.id} style={styles.fileRow}>
                                <Ionicons name="videocam-outline" size={16} color="#007AFF" />
                                <ThemedText numberOfLines={1} style={styles.fileName}>{file.name}</ThemedText>
                                <TouchableOpacity onPress={() => removeViewLocalFile('video', file.id)}>
                                  <Ionicons name="trash" size={16} color="#FF3B30" />
                                </TouchableOpacity>
                              </ThemedView>
                            ))}

                            {viewTextFiles.map(file => (
                              <ThemedView key={file.id} style={styles.fileRow}>
                                <Ionicons name="document-text-outline" size={16} color="#007AFF" />
                                <ThemedText numberOfLines={1} style={styles.fileName}>{file.name}</ThemedText>
                                <TouchableOpacity onPress={() => removeViewLocalFile('document', file.id)}>
                                  <Ionicons name="trash" size={16} color="#FF3B30" />
                                </TouchableOpacity>
                              </ThemedView>
                            ))}
                          </ThemedView>
                        )}
                      </ThemedView>

                      <TouchableOpacity
                        style={[styles.signatureActionButton, isSigningManual && styles.formButtonDisabled]}
                        onPress={async () => {
                          if (!selectedManual || !viewSignature) return;
                          const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
                          if (!apiUrl) {
                            Alert.alert('Error', 'URL del servidor no configurada');
                            return;
                          }
                          try {
                            if (!marcaId) {
                              Alert.alert('Error', 'No se encontró la marca actual');
                              return;
                            }

                            const quizCfgData = parseQuizFromManual(selectedManual.quiz);
                            const quizCfg = quizCfgData.questions;
                            const hasQuiz = quizCfg.length > 0;

                            // Validar quiz (obligatorio si existe)
                            if (hasQuiz) {
                              for (const q of quizCfg) {
                                const v = quizUserAnswers[q.id];
                                const isEmptyString = typeof v === 'string' && v.trim().length === 0;
                                const isEmptyArray = Array.isArray(v) && v.length === 0;
                                const missing = v === undefined || v === null || isEmptyString || isEmptyArray;
                                if (missing) {
                                  Alert.alert('Error', 'Debes responder todas las preguntas del quiz antes de firmar.');
                                  return;
                                }
                              }
                            }

                            // Construir payload de respuestas (incluye respuestas correctas + del usuario)
                            const quizAnswearStr = hasQuiz
                              ? JSON.stringify(
                                quizCfg.map((q) => {
                                  const userV = quizUserAnswers[q.id];
                                  return {
                                    question_id: q.id,
                                    type: q.type,
                                    correct_answer: q.answer ?? null,
                                    correct_answers: q.answers ?? null,
                                    user_answer: typeof userV === 'string' ? userV : null,
                                    user_answers: Array.isArray(userV) ? userV : null,
                                  };
                                })
                              )
                              : null;

                            const isConnected = await getConnectionStatus();
                            const visualizationFilesStr = isConnected
                              ? await buildVisualizationFilesPayload()
                              : buildVisualizationSignQueuePayload();

                            const confirmedSign = await new Promise<boolean>((resolve) => {
                                Alert.alert(
                                  'Confirmar',
                                isConnected
                                  ? 'Vas a firmar el manual y enviar tus respuestas del quiz (si aplica). ¿Deseas continuar?'
                                  : 'Se registrará tu firma y respuestas localmente para sincronizarse cuando haya conexión. ¿Deseas continuar?',
                                  [
                                    { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
                                    { text: 'Aceptar', onPress: () => resolve(true) },
                                  ]
                                );
                              });
                            if (!confirmedSign) return;

                            setIsSigningManual(true);

                            let manualRef: JobManualRemote = selectedManual;
                            if (!manualRef.id || manualRef.id === 0) {
                              if (!manualRef.id_local) {
                                throw new Error('No se puede firmar: manual sin id de servidor ni referencia local.');
                              }
                              const canSync = await getConnectionStatus();
                              if (canSync) {
                                const { serverId } = await syncUnsyncedJobManualByLocalId({
                                  idLocal: String(manualRef.id_local),
                                  refreshAccessToken,
                                  logout,
                                });
                                manualRef = {
                                  ...manualRef,
                                  id: serverId,
                                  id_local: undefined,
                                  synced: true,
                                };
                                setSelectedManual(manualRef);
                                if (marcaId) {
                                  const listPuestoR =
                                    roleName === 'OPERATIVO'
                                      ? marcaPuestoIdFromMarca
                                      : (filterPuestoId ?? marcaPuestoIdFromMarca);
                                  await fetchManuals(marcaId, listPuestoR);
                                }
                              }
                            }

                            const isConnectedSign = await getConnectionStatus();
                            let signResult: { status?: boolean; message?: string; visualizacion_id?: number; id?: number } | null =
                              null;
                            if (isConnectedSign) {
                              if (!manualRef.id || manualRef.id === 0) {
                                throw new Error(
                                  'Conéctate a internet y espera a que el manual se sincronice, o reintenta en unos segundos.'
                                );
                              }
                              signResult = await signJobManual({
                                id: manualRef.id,
                                firma: viewSignature,
                                quizAnswear: quizAnswearStr,
                                files: visualizationFilesStr,
                                refreshAccessToken,
                                logout,
                                marcaId,
                              });

                              if (!signResult?.status) {
                                throw new Error(signResult?.message || 'No se pudo firmar el manual');
                              }
                              for (const f of [...viewTextFiles, ...viewImageFiles, ...viewAudioFiles, ...viewVideoFiles]) {
                                if (f.localFileName) {
                                  try {
                                    await deleteFile(f.localFileName);
                                  } catch {
                                    /* idempotente */
                                  }
                                }
                              }
                            } else {
                              const actionsStr = await AsyncStorage.getItem('job_manuals_actions');
                              let actions: any[] = actionsStr ? JSON.parse(actionsStr) : [];
                              const sameSign = (a: any) => {
                                if (a.type !== 'sign') return false;
                                if (manualRef.id > 0) return a.id === manualRef.id;
                                if (manualRef.id_local) {
                                  return (
                                    (a as any).manualLocalId != null &&
                                    String((a as any).manualLocalId) === String(manualRef.id_local)
                                  );
                                }
                                return a.id === manualRef.id;
                              };
                              actions = actions.filter((a: any) => !sameSign(a));
                              actions.push(
                                !manualRef.id || manualRef.id === 0
                                  ? {
                                      id: 0,
                                      manualLocalId: String(manualRef.id_local),
                                      type: 'sign',
                                      firma: viewSignature,
                                      quizAnswear: quizAnswearStr,
                                      files: visualizationFilesStr,
                                      marcaId,
                                    }
                                  : {
                                      id: manualRef.id,
                                      type: 'sign',
                                      firma: viewSignature,
                                      quizAnswear: quizAnswearStr,
                                      files: visualizationFilesStr,
                                      marcaId,
                                    }
                              );
                              await AsyncStorage.setItem('job_manuals_actions', JSON.stringify(actions));
                            }

                            const horaAccionUse = await getHoraAccion();

                            const visServerId =
                              isConnectedSign && signResult
                                ? Number(signResult.visualizacion_id ?? signResult.id) || 0
                                : 0;
                            const newVisId =
                              visServerId > 0 ? visServerId : Date.now() + Math.floor(Math.random() * 1000);

                            const matchManualInCache = (item: { id: number; id_local?: string }) => {
                              if (manualRef.id > 0) return item.id === manualRef.id;
                              if (manualRef.id_local) {
                                return String(item.id_local) === String(manualRef.id_local);
                              }
                              return item.id === manualRef.id;
                            };

                            // Actualizar estado local y cache
                            const newVisualizacion = {
                              id: newVisId,
                              empleado_id: typeof employee?.id === 'number' ? employee.id : Number(employee?.id || 0),
                              manual_puesto_id: manualRef.id,
                              nombre_empleado: employee?.name || 'Empleado',
                              firma_empleado: viewSignature,
                              quiz_answear: quizAnswearStr,
                              approved: null,
                              created_at: new Date(horaAccionUse).toISOString(),
                              updated_at: new Date(horaAccionUse).toISOString(),
                              files: [...viewTextFiles, ...viewImageFiles, ...viewAudioFiles, ...viewVideoFiles].map((f) => ({
                                id: Date.now() + Math.random(),
                                id_local: f.id,
                                type: f.type,
                                extension: f.extension,
                                name: f.name,
                                original_name: f.name,
                                base64: f.localFileName ? undefined : f.base64,
                                localFileName: f.localFileName,
                                mimeType: f.mimeType,
                                url: f.localFileName ? getLocalFileDisplayUri(f.localFileName) : '',
                              })),
                            };

                            setSelectedManual(prev => {
                              if (!prev) return prev;
                              if (!matchManualInCache(prev)) return prev;
                              const filtered = (prev.visualizaciones || []).filter(v => v.empleado_id !== newVisualizacion.empleado_id);
                              return {
                                ...prev,
                                currentEmployeeSigned: true,
                                visualizaciones: [...filtered, newVisualizacion],
                              };
                            });

                            const cacheStr = await AsyncStorage.getItem('job_manuals_cache');
                            if (cacheStr) {
                              const cache = JSON.parse(cacheStr);
                              const updatedCache = cache.map((item: any) => {
                                if (!matchManualInCache(item)) return item;
                                const visualizaciones = (item.visualizaciones || []).filter((v: any) => v.empleado_id !== newVisualizacion.empleado_id);
                                return {
                                  ...item,
                                  currentEmployeeSigned: true,
                                  visualizaciones: [...visualizaciones, newVisualizacion],
                                };
                              });
                              await AsyncStorage.setItem('job_manuals_cache', JSON.stringify(updatedCache));
                            }

                            const listPuestoReload =
                              roleName === 'OPERATIVO'
                                ? marcaPuestoIdFromMarca
                                : (filterPuestoId ?? marcaPuestoIdFromMarca);
                            if (marcaId) {
                              await fetchManuals(marcaId, listPuestoReload);
                              const cacheAfter = await AsyncStorage.getItem('job_manuals_cache');
                              if (cacheAfter) {
                                try {
                                  const parsed = JSON.parse(cacheAfter);
                                  const m = Array.isArray(parsed)
                                    ? parsed.find(
                                        (x: { id: number; id_local?: string }) =>
                                          (manualRef.id > 0 && x.id === manualRef.id) ||
                                          (manualRef.id_local != null &&
                                            String(x.id_local) === String(manualRef.id_local))
                                      )
                                    : null;
                                  if (m) setSelectedManual(m);
                                } catch {
                                  /* ignore */
                                }
                              }
                            }

                            Alert.alert(
                              'Éxito',
                              isConnectedSign ? 'Manual firmado correctamente' : 'Firma registrada en modo offline'
                            );
                          } catch (error) {
                            console.error('Error signing manual:', error);
                            const msg = error instanceof Error ? error.message : 'No se pudo firmar el manual';
                            Alert.alert('Error', msg);
                          } finally {
                            setIsSigningManual(false);
                            clearViewFirma();
                            setViewTextFiles([]);
                            setViewImageFiles([]);
                            setViewAudioFiles([]);
                            setViewVideoFiles([]);
                          }
                        }}
                        disabled={isSigningManual}
                      >
                        {isSigningManual ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                        )}
                        <ThemedText style={styles.signatureActionText}>
                          {isSigningManual ? 'Firmando...' : 'Confirmar visualización'}
                        </ThemedText>
                      </TouchableOpacity>
                    </ThemedView>
                  )}
                </ThemedView>
              )}
            </ScrollView>
          </ThemedView>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fullContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    opacity: 0.7,
  },
  noMarcaTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  noMarcaMessage: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    width: '100%',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
  },
  puestoContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    width: '100%',
  },
  puestoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  puestoName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 20,
    gap: 8,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
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
  formCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginBottom: 24,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    color: '#000000',
  },
  // Quiz UI
  quizHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  quizAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D6E6FF',
    backgroundColor: '#F3F8FF',
  },
  quizAddButtonText: {
    color: '#007AFF',
    fontSize: 13,
    fontWeight: '600',
  },
  quizEmptyText: {
    marginTop: 8,
    fontSize: 13,
    color: '#777777',
  },
  quizList: {
    marginTop: 10,
    gap: 10,
  },
  quizQuestionCard: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    padding: 12,
    marginBottom: 10,
  },
  quizQuestionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  quizQuestionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111111',
    flex: 1,
  },
  quizRemoveButton: {
    padding: 4,
  },
  quizQuestionMeta: {
    marginTop: 4,
    fontSize: 12,
    color: '#666666',
  },
  quizTotalPointsContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F0F4FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D6E6FF',
  },
  quizTotalPointsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    textAlign: 'center',
  },
  quizTypeList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quizTypePill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  quizTypePillActive: {
    borderColor: '#007AFF',
    backgroundColor: '#EAF3FF',
  },
  quizTypePillText: {
    fontSize: 12,
    color: '#444444',
    fontWeight: '600',
  },
  quizTypePillTextActive: {
    color: '#007AFF',
  },
  quizOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  quizOptionAddBtn: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quizOptionsList: {
    marginTop: 10,
    gap: 8,
  },
  quizOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  quizOptionText: {
    flex: 1,
    marginRight: 12,
    fontSize: 13,
    color: '#222222',
  },
  quizSelectList: {
    gap: 8,
    marginTop: 6,
  },
  quizSelectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  quizSelectText: {
    fontSize: 13,
    color: '#222222',
    flex: 1,
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: '#FFFFFF',
    color: '#000000',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  signatureHintMuted: {
    fontSize: 12,
    color: '#666666',
    marginTop: 6,
    marginBottom: 8,
    fontWeight: '600',
  },
  checkboxContainer: {
    marginBottom: 16,
    paddingVertical: 8,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#000000',
    flex: 1,
  },
  structureGroup: {
    marginTop: 10,
  },
  smallLabel: {
    fontSize: 12,
    color: '#333333',
    fontWeight: '700',
    marginBottom: 6,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  treeActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    marginBottom: 6,
  },
  treeActionPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#007AFF',
  },
  treeActionPrimaryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  treeActionSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    backgroundColor: '#FFFFFF',
  },
  treeActionSecondaryText: {
    color: '#007AFF',
    fontSize: 13,
    fontWeight: '800',
  },
  selectedPuestosBox: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#FFFFFF',
  },
  selectedPuestosHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  selectedPuestosHeaderText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#007AFF',
  },
  puestosList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  puestoItem: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  puestoItemSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  puestoItemText: {
    fontSize: 12,
    color: '#333',
  },
  puestoItemTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
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
  fileIconButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  fileIconButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signatureButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  signatureButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  signatureButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  signatureInfo: {
    backgroundColor: '#F0F4FF',
    borderRadius: 8,
    padding: 12,
    gap: 4,
  },
  signatureInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  signatureInfoText: {
    fontSize: 12,
    color: '#333',
  },
  signatureInfoDetail: {
    marginTop: 4,
  },
  signatureInfoDetailText: {
    fontSize: 12,
    fontWeight: '600',
  },
  clearSignatureButton: {
    marginTop: 8,
    alignSelf: 'flex-end',
  },
  clearSignatureText: {
    fontSize: 12,
    color: '#FF3B30',
    fontWeight: '600',
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8,
  },
  formButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  cancelButton: {
    backgroundColor: '#FF3B30',
  },
  formButtonDisabled: {
    opacity: 0.6,
  },
  confirmButton: {
    backgroundColor: '#34C759',
  },
  formButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    opacity: 0.6,
  },
  listContainer: {
    marginTop: 8,
    marginBottom: 24,
    gap: 12,
  },
  loadingManualsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  manualCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    padding: 12,
  },
  manualTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  manualDescription: {
    fontSize: 13,
    color: '#555555',
    marginBottom: 8,
  },
  manualMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  manualMetaText: {
    fontSize: 12,
    color: '#777777',
  },
  manualActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  manualUpdatePuestosButton: {
    flex: 1,
    minWidth: 140,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#007AFF',
  },
  manualChangesButton: {
    flex: 1,
    minWidth: 120,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#5856D6',
  },
  manualUpdatePuestosButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  updPuestosModalContainer: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '88%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    overflow: 'hidden',
  },
  updPuestosDisclaimer: {
    fontSize: 13,
    color: '#555555',
    marginBottom: 8,
    lineHeight: 20,
  },
  updPuestosManualTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 10,
  },
  updPuestosScroll: {
    flexGrow: 0,
    maxHeight: 420,
    marginBottom: 8,
  },
  updPuestosScrollContent: {
    paddingBottom: 12,
  },
  updPuestosModalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: '#E0E0E0',
  },
  modalConfirmButton: {
    backgroundColor: '#007AFF',
  },
  modalCancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333333',
  },
  modalConfirmButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  viewerModalContainer: {
    width: '100%',
    maxWidth: 600,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 8,
  },
  modalContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  viewerDescription: {
    fontSize: 14,
    marginTop: 8,
    marginBottom: 12,
    color: '#333333',
  },
  viewerSection: {
    marginTop: 12,
    marginBottom: 8,
    overflow: 'hidden',
  },
  viewerSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
  },
  viewerImage: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#F0F0F0',
  },
  documentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  documentText: {
    flex: 1,
    fontSize: 13,
    color: '#007AFF',
  },
  signatureActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 6,
  },
  signatureActionText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  signatureRow: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 10,
    marginTop: 6,
  },
  signatureText: {
    flex: 1,
    fontSize: 13,
    color: '#333333',
  },
  signatureListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    width: '100%',
  },
  signatureListName: {
    flex: 1,
    fontSize: 13,
    color: '#333333',
  },
  signatureListDate: {
    fontSize: 12,
    color: '#777777',
    marginLeft: 'auto',
  },
  quizReviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    marginTop: 10,
  },
  quizReviewStatusText: {
    marginTop: 6,
    fontSize: 12,
    color: '#666666',
  },
  quizReviewList: {
    marginTop: 8,
    gap: 10,
  },
  quizReviewItem: {
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  quizReviewQuestionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  quizReviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    gap: 12,
    backgroundColor: '#F8F9FA',
  },
  quizReviewLabel: {
    fontSize: 12,
    color: '#666666',
    flex: 1,
  },
  quizReviewValue: {
    fontSize: 12,
    color: '#111111',
    flex: 1,
    textAlign: 'right',
  },
  /** Contenedor en columna: botón a ancho completo y aviso debajo (evita estirar el botón en fila con el texto) */
  quizReviewActionsColumn: {
    marginTop: 12,
    width: '100%',
    alignSelf: 'stretch',
  },
  quizReviewScoringWarningBox: {
    marginTop: 10,
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FFCCC7',
  },
  quizReviewScoringWarningText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#B91C1C',
    textAlign: 'center',
  },
  quizReviewActionBtn: {
    width: '100%',
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  quizReviewApproveBtn: {
    backgroundColor: '#34C759',
  },
  quizReviewRejectBtn: {
    backgroundColor: '#FF3B30',
  },
  quizReviewActionText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  quizReviewSummary: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  quizReviewSummaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  deleteButton: {
    padding: 6,
  },
  audioPlayerContainer: {
    marginVertical: 12,
    backgroundColor: '#fff',
  },
  audioLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#000000',
  },
  audioPlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  playButton: {
    padding: 8,
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
});

// Audio player for manuals (similar to VoiceNotesScreen)
function ManualAudioPlayer({ sourceUrl, label }: { sourceUrl: string; label?: string }) {
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
    // Sincronizar estado de reproducción con el estado del player
    if (status.playing !== isPlaying) {
      setIsPlaying(status.playing);
    }
  }, [status.playing]);

  return (
    <ThemedView style={styles.audioPlayerContainer}>
      {label ? (
        <ThemedText style={styles.audioLabel}>{label}</ThemedText>
      ) : null}
      <ThemedView style={styles.audioPlayer}>
        <TouchableOpacity
          style={styles.playButton}
          onPress={togglePlayPause}
        >
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={24}
            color="#007AFF"
          />
        </TouchableOpacity>
        <ThemedText style={styles.audioTime}>
          {formatTime(position)} / {formatTime(duration)}
        </ThemedText>
        <TouchableOpacity
          style={styles.resetAudioButton}
          onPress={resetAudio}
        >
          <Ionicons
            name="refresh"
            size={24}
            color="#FFFFFF"
          />
        </TouchableOpacity>
      </ThemedView>
    </ThemedView>
  );
}

// Image viewer that adjusts container based on image dimensions
function ManualImageViewer({ imageUrl }: { imageUrl: string }) {
  const [containerStyle, setContainerStyle] = useState<any>(styles.viewerImage);
  const maxContainerWidth = Dimensions.get('window').width - 64; // Ancho máximo del contenedor (pantalla - padding del modal)

  const handleImageLoad = (event: any) => {
    const { width, height } = event.nativeEvent.source;
    if (width && height) {
      const aspectRatio = width / height;
      let containerWidth = maxContainerWidth;
      let containerHeight: number;

      // Calcular dimensiones del contenedor basándose en las dimensiones reales de la imagen
      if (height > width) {
        // Imagen vertical: usar ancho completo disponible y calcular altura proporcional
        containerHeight = (maxContainerWidth / aspectRatio);
        // Limitar altura máxima
        if (containerHeight > 600) {
          containerHeight = 600;
          containerWidth = containerHeight * aspectRatio;
        }
      } else {
        // Imagen horizontal: ajustar ancho al tamaño real de la imagen (sin exceder el máximo)
        containerWidth = Math.min(maxContainerWidth, width);
        containerHeight = containerWidth / aspectRatio;
        // Si la altura calculada es muy pequeña, usar altura mínima y ajustar ancho
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
        alignSelf: 'center', // Centrar el contenedor
      });
    }
  };

  return (
    <Image
      source={{ uri: imageUrl }}
      style={containerStyle}
      resizeMode="contain"
      onLoad={handleImageLoad}
    />
  );
}

// Video player for manuals using expo-video (sin controles externos, solo VideoView con controles nativos)
function ManualVideoPlayer({ sourceUrl }: { sourceUrl: string }) {
  const player = useVideoPlayer(sourceUrl);
  const maxContainerWidth = Dimensions.get('window').width - 64; // Ancho máximo del contenedor (pantalla - padding del modal)

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
        allowsFullscreen={false}
        allowsPictureInPicture={false}
      />
    </View>
  );
}


