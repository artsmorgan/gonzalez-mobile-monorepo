import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  View,
  Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from "@react-native-community/datetimepicker";
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
import * as Location from 'expo-location';
import { jwtDecode } from 'jwt-decode';
import { useQRScanner } from '@/hooks/useQRScanner';
import { useAudioRecorder, useAudioRecorderState, useAudioPlayer, useAudioPlayerStatus, RecordingPresets, requestRecordingPermissionsAsync } from 'expo-audio';
import getHoraAccion from '@/hooks/getHoraAccion';
import * as Network from 'expo-network';
import { createVoiceNote as createVoiceNoteAPI, deleteVoiceNote as deleteVoiceNoteAPI, updateVoiceNote as updateVoiceNoteAPI } from '@/hooks/voiceNotesFunctions';
import { eventBus } from '@/hooks/eventBus';
import authedFetch from '@/hooks/authedFetch';
import getValidAccessTokenOrLogout from '@/hooks/getValidAccessTokenOrLogout';
import { readMainStructureCacheString } from '@/hooks/mainStructureCacheStorage';
import {
  filterVoiceNotesToPuestoFetchScope,
  isPendingOfflineVoiceNoteCreate,
  mergeVoiceNotesCacheForPuestoScope,
  voiceNoteInPuestoFetchScope,
} from '@/hooks/voiceNotesCacheHelpers';
import { saveFile, deleteFile, getLocalFileDisplayUri } from '@/hooks/fileStorage';

type VoiceNotesScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'VoiceNotes'>;

interface Empresa {
  id: number;
  nombre: string;
}

interface Cliente {
  id: number;
  nombre: string;
}

interface Corpo {
  id: number;
  nombre: string;
}

interface Puesto {
  id: number;
  nombre: string;
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

interface VoiceNote {
  id: number;
  empresa: Empresa;
  cliente: Cliente;
  corpo: Corpo;
  puesto: Puesto | null;
  titulo: string;
  descripcion: string;
  transcripcion: string | null;
  firma_responsable: string;
  nombre_creator: string;
  id_local: string;
  file_base64: string;
  created_at: string;
  created_by: number;
  nombre_firma: string;
  isActive?: boolean;
  /** Archivo de audio en documentos (offline / cola); prioridad sobre file_base64 al reproducir. */
  local_audio_file?: string;
}

type RoleName = 'OPERATIVO' | 'SUPERVISOR' | 'ADMINISTRATIVO' | string | null;

type MainStructurePlazaNode = { id: number; nombre: string };
type MainStructurePuestoNode = { id: number; nombre: string; plazas: MainStructurePlazaNode[] };
type MainStructureSucursalNode = { id: number; nombre: string; puestos: MainStructurePuestoNode[] };
type MainStructureContratoNode = { id: number; nombre: string; sucursales: MainStructureSucursalNode[] };
type MainStructureDivisionNode = { id: number; nombre: string; contratos: MainStructureContratoNode[] };
type MainStructureClienteNode = { id: number; nombre: string; division: MainStructureDivisionNode[] };
type MainStructureEmpresaNode = { id: number; nombre: string; clientes: MainStructureClienteNode[] };
type MainStructureTree = MainStructureEmpresaNode[];

type TracedVoiceNotePath = {
  empresaId: number;
  clienteId: number;
  divisionId: number;
  contratoId: number;
  sucursalId: number;
  puestoId: number | null;
};

/** Rastrea en main_structure la ruta hasta corpo (sucursal) y opcionalmente puesto. */
function traceVoiceNoteInStructure(
  tree: MainStructureTree,
  corpoId: number,
  puestoId: number | null
): TracedVoiceNotePath | null {
  const wantPuesto =
    puestoId != null && Number.isFinite(Number(puestoId)) && Number(puestoId) > 0 ? Number(puestoId) : null;
  for (const e of tree) {
    for (const c of e.clientes ?? []) {
      for (const d of c.division ?? []) {
        for (const co of d.contratos ?? []) {
          for (const s of co.sucursales ?? []) {
            if (Number(s.id) !== Number(corpoId)) continue;
            let resolvedPuesto: number | null = null;
            if (wantPuesto != null) {
              const inTree = (s.puestos ?? []).some((p) => Number(p.id) === wantPuesto);
              resolvedPuesto = inTree ? wantPuesto : wantPuesto;
            }
            return {
              empresaId: e.id,
              clienteId: c.id,
              divisionId: d.id,
              contratoId: co.id,
              sucursalId: s.id,
              puestoId: resolvedPuesto,
            };
          }
        }
      }
    }
  }
  return null;
}

/** Primer puesto de una sucursal en el árbol (para filtro de lista cuando la nota no lleva puesto). */
function getFirstPuestoIdInSucursalCorpo(
  tree: MainStructureTree,
  corpoId: number
): number | null {
  for (const e of tree) {
    for (const c of e.clientes ?? []) {
      for (const d of c.division ?? []) {
        for (const co of d.contratos ?? []) {
          for (const s of co.sucursales ?? []) {
            if (Number(s.id) !== Number(corpoId)) continue;
            const p0 = s.puestos?.[0];
            return p0 != null && Number(p0.id) > 0 ? Number(p0.id) : null;
          }
        }
      }
    }
  }
  return null;
}

// Componente para reproducir audio de notas de voz con cleanup
function VoiceNoteAudioPlayer({
  audioUri,
  isPlaying,
  onStatusUpdate,
  shouldReset
}: {
  audioUri: string;
  isPlaying: boolean;
  onStatusUpdate?: (duration: number, position: number, playing: boolean) => void;
  shouldReset?: boolean;
}) {
  const audioPlayer = useAudioPlayer(audioUri);
  const playerStatus = useAudioPlayerStatus(audioPlayer);
  const onStatusUpdateRef = useRef(onStatusUpdate);

  // Mantener la referencia más reciente de onStatusUpdate sin causar re-renders
  useEffect(() => {
    onStatusUpdateRef.current = onStatusUpdate;
  }, [onStatusUpdate]);

  // Controlar play/pause basado en isPlaying
  useEffect(() => {
    if (!audioPlayer) return;

    try {
      if (isPlaying && !playerStatus.playing) {
        audioPlayer.play();
      } else if (!isPlaying && playerStatus.playing) {
        audioPlayer.pause();
      }
    } catch (error) {
      const errorMsg = String(error);
      if (!errorMsg.includes('already released') && !errorMsg.includes('has been rejected')) {
        console.error('Error controlling audio playback:', error);
      }
    }
  }, [isPlaying, audioPlayer, playerStatus.playing]);

  // Manejar reset
  useEffect(() => {
    if (shouldReset && audioPlayer) {
      try {
        audioPlayer.seekTo(0);
        audioPlayer.pause();
      } catch (error) {
        const errorMsg = String(error);
        if (!errorMsg.includes('already released') && !errorMsg.includes('has been rejected')) {
          console.error('Error resetting audio:', error);
        }
      }
    }
  }, [shouldReset, audioPlayer]);

  // Notificar cambios de estado con valores correctos
  // Usar useRef para evitar loop infinito (onStatusUpdate no está en dependencias)
  useEffect(() => {
    if (!onStatusUpdateRef.current) return;

    // playerStatus.currentTime y duration ya están en segundos
    const duration = playerStatus.duration !== undefined ? playerStatus.duration : 0;
    const position = playerStatus.currentTime !== undefined ? playerStatus.currentTime : 0;
    const playing = playerStatus.playing || false;

    onStatusUpdateRef.current(duration, position, playing);
  }, [playerStatus.duration, playerStatus.currentTime, playerStatus.playing]);

  // Cleanup al desmontar el componente
  useEffect(() => {
    return () => {
      try {
        if (audioPlayer && playerStatus.playing) {
          try {
            audioPlayer.pause();
          } catch (pauseError) {
            console.log('Audio player already released, skipping pause');
          }
        }
        if (audioPlayer && typeof audioPlayer.remove === 'function') {
          try {
            audioPlayer.remove();
          } catch (removeError) {
            console.log('Audio player already removed');
          }
        }
      } catch (error) {
        // Ignorar errores de objetos ya liberados
        console.log('Error during audio cleanup:', error);
      }
    };
  }, [audioPlayer, playerStatus.playing]);

  return null; // Este componente no renderiza nada, solo maneja el audio
}

function stripQueuedVoiceNoteUpdatesForNoteId(actions: any[], voiceNoteId: number): any[] {
  const id = Number(voiceNoteId);
  if (!Number.isFinite(id)) return actions;
  return actions.filter(
    (a: any) => !(a?.type === 'update' && Number(a.id) === id)
  );
}

function stripQueuedVoiceNoteDeletesForNoteId(actions: any[], voiceNoteId: number): any[] {
  const id = Number(voiceNoteId);
  if (!Number.isFinite(id)) return actions;
  return actions.filter(
    (a: any) => !(a?.type === 'delete' && Number(a.id) === id)
  );
}

function appendOfflineVoiceNoteDelete(actions: any[], voiceNoteId: number): any[] {
  let next = stripQueuedVoiceNoteDeletesForNoteId(actions, voiceNoteId);
  next = stripQueuedVoiceNoteUpdatesForNoteId(next, voiceNoteId);
  next.push({ id: voiceNoteId, type: 'delete' });
  return next;
}

function stripErroneousVoiceNoteUpdatesForLocalQueueId(actions: any[], idLocal: string): any[] {
  if (!idLocal) return actions;
  const k = String(idLocal);
  return actions.filter(
    (a: any) => !(a?.type === 'update' && a.id != null && String(a.id) === k)
  );
}

/** `puesto` o `puesto_id` en el JSON de `current_marca`. */
function getMarcaPuestoIdFromJson(marca: any): number | null {
  const raw =
    marca?.puesto?.id != null
      ? Number(marca.puesto.id)
      : marca?.puesto_id != null
        ? Number(marca.puesto_id)
        : NaN;
  return Number.isFinite(raw) && raw > 0 ? raw : null;
}

export default function VoiceNotesScreen() {
  const { employee, refreshAccessToken, logout, accessToken } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<VoiceNotesScreenNavigationProp>();

  // Data states
  const [voiceNotes, setVoiceNotes] = useState<VoiceNote[]>([]);
  /** Carga de la lista (inicial o al cambiar sucursal/puesto en filtro). Oculta lista + botón nueva nota. */
  const [isLoading, setIsLoading] = useState(true);
  const [marcaChecked, setMarcaChecked] = useState(false);
  const [hasMarca, setHasMarca] = useState<boolean>(false);
  const [marcaId, setMarcaId] = useState<number | null>(null);
  const [corpoId, setCorpoId] = useState<number | null>(null);
  const [roleName, setRoleName] = useState<RoleName>(null);
  const [marcaPuestoIdFromMarca, setMarcaPuestoIdFromMarca] = useState<number | null>(null);

  const [structure, setStructure] = useState<MainStructureTree>([]);
  const [isStructureLoading, setIsStructureLoading] = useState(false);

  const [filterEmpresaId, setFilterEmpresaId] = useState<number | null>(null);
  const [filterClienteId, setFilterClienteId] = useState<number | null>(null);
  const [filterDivisionId, setFilterDivisionId] = useState<number | null>(null);
  const [filterContratoId, setFilterContratoId] = useState<number | null>(null);
  const [filterSucursalId, setFilterSucursalId] = useState<number | null>(null);
  const [filterPuestoId, setFilterPuestoId] = useState<number | null>(null);

  const [createEmpresaId, setCreateEmpresaId] = useState<number | null>(null);
  const [createClienteId, setCreateClienteId] = useState<number | null>(null);
  const [createDivisionId, setCreateDivisionId] = useState<number | null>(null);
  const [createContratoId, setCreateContratoId] = useState<number | null>(null);
  const [createSucursalId, setCreateSucursalId] = useState<number | null>(null);
  const [createPuestoId, setCreatePuestoId] = useState<number | null>(null);

  const [editEmpresaId, setEditEmpresaId] = useState<number | null>(null);
  const [editClienteId, setEditClienteId] = useState<number | null>(null);
  const [editDivisionId, setEditDivisionId] = useState<number | null>(null);
  const [editContratoId, setEditContratoId] = useState<number | null>(null);
  const [editSucursalId, setEditSucursalId] = useState<number | null>(null);
  const [editPuestoId, setEditPuestoId] = useState<number | null>(null);
  const [editSetPuesto, setEditSetPuesto] = useState(false);

  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [editingVoiceNote, setEditingVoiceNote] = useState<VoiceNote | null>(null);
  const editTituloRef = useRef('');
  const editDescripcionRef = useRef('');
  const [editFormKey, setEditFormKey] = useState(0);

  // Form states
  const [isCreating, setIsCreating] = useState(false);
  const [setPuesto, setSetPuesto] = useState<boolean>(false);
  const [puestoActualNombre, setPuestoActualNombre] = useState<string>('');
  const [firmaResponsable, setFirmaResponsable] = useState<FirmaData | null>(null);
  const [isGeneratingFirma, setIsGeneratingFirma] = useState(false);

  // Form refs
  const tituloRef = useRef('');
  const descripcionRef = useRef('');
  const [formKey, setFormKey] = useState(0); // Key para forzar re-render de inputs

  // Audio recording states
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder, 1000); // Actualizar cada segundo
  const [recordedAudioUri, setRecordedAudioUri] = useState<string | null>(null);
  const recordedAudioPlayer = useAudioPlayer(recordedAudioUri || undefined);
  const recordedPlayerStatus = useAudioPlayerStatus(recordedAudioPlayer);
  const [recordedAudioBase64, setRecordedAudioBase64] = useState<string | null>(null);

  // Location state
  const [location, setLocation] = useState<Location.LocationObject | null>(null);

  // QR Scanner
  const { scanQR, QRScannerComponent } = useQRScanner();

  // Helper function to get unique identifier for voice notes
  // Use id_local for offline notes (id: 0), otherwise use id
  const getUniqueKey = (voiceNote: VoiceNote): string => {
    return voiceNote.id_local && voiceNote.id_local !== ''
      ? `local-${voiceNote.id_local}`
      : `server-${voiceNote.id}`;
  };

  // Expanded voice notes state
  const [expandedVoiceNotes, setExpandedVoiceNotes] = useState<Set<string>>(new Set());

  // Audio players for list items - using Maps to store audio URIs
  const [audioUris, setAudioUris] = useState<Map<string, string>>(new Map());
  const audioUrisRef = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    audioUrisRef.current = audioUris;
  }, [audioUris]);
  const [audioDurations, setAudioDurations] = useState<Map<string, number>>(new Map());
  const [resetFlags, setResetFlags] = useState<Map<string, boolean>>(new Map());
  const [loadingAudioUris, setLoadingAudioUris] = useState<Set<string>>(() => new Set());

  // Filter states (texto)
  const [filterTitulo, setFilterTitulo] = useState('');
  const [filterDescripcion, setFilterDescripcion] = useState('');
  const [filterTranscripcion, setFilterTranscripcion] = useState('');
  const [filterCreatedAt, setFilterCreatedAt] = useState('');
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  const [showFilterCreatedAtPicker, setShowFilterCreatedAtPicker] = useState(false);

  const appendTokenToUrl = useCallback(
    (url: string) => {
      if (!url) return '';
      if (!accessToken || accessToken.trim().length === 0) return url;
      if (/[?&]token=/.test(url)) return url;
      const separator = url.includes('?') ? '&' : '?';
      return `${url}${separator}token=${encodeURIComponent(accessToken)}`;
    },
    [accessToken]
  );

  const getDivisionIdFromMarcaJson = (marca: any): number | null => {
    const raw =
      marca?.roleDivision?.division?.id ??
      marca?.role_division?.division?.id ??
      marca?.division?.id ??
      marca?.division_id;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const applyMarcaToHierarchyIds = useCallback((marca: any) => {
    const divId = getDivisionIdFromMarcaJson(marca);
    setFilterEmpresaId(marca.empresa?.id != null ? Number(marca.empresa.id) : null);
    setFilterClienteId(marca.cliente?.id != null ? Number(marca.cliente.id) : null);
    setFilterDivisionId(divId);
    setFilterContratoId(marca.contrato?.id != null ? Number(marca.contrato.id) : null);
    setFilterSucursalId(marca.corpo?.id != null ? Number(marca.corpo.id) : null);
    setFilterPuestoId(getMarcaPuestoIdFromJson(marca));
  }, []);

  const fetchMainStructure = useCallback(async () => {
    try {
      setIsStructureLoading(true);
      const cacheStr = await readMainStructureCacheString();
      if (cacheStr) {
        try {
          const cached = JSON.parse(cacheStr);
          if (Array.isArray(cached)) setStructure(cached);
          else setStructure([]);
        } catch {
          setStructure([]);
        }
      } else {
        setStructure([]);
      }
    } catch (e) {
      console.error('fetchMainStructure voice notes:', e);
      setStructure([]);
    } finally {
      setIsStructureLoading(false);
    }
  }, []);

  const resetListFiltersFromCurrentMarca = useCallback(async () => {
    try {
      const currentMarcaStr = await AsyncStorage.getItem('current_marca');
      if (!currentMarcaStr) return;
      const currentMarca = JSON.parse(currentMarcaStr);
      const rn =
        currentMarca?.roleDivision?.role?.nombre ??
        currentMarca?.role_division?.role?.nombre ??
        null;
      if (rn === 'OPERATIVO') {
        setFilterEmpresaId(null);
        setFilterClienteId(null);
        setFilterDivisionId(null);
        setFilterContratoId(null);
        setFilterSucursalId(null);
        setFilterPuestoId(null);
      } else {
        applyMarcaToHierarchyIds(currentMarca);
      }
    } catch (e) {
      console.error('resetListFiltersFromCurrentMarca:', e);
    }
  }, [applyMarcaToHierarchyIds]);

  const applyMarcaToCreateHierarchy = useCallback(async () => {
    try {
      const currentMarcaStr = await AsyncStorage.getItem('current_marca');
      if (!currentMarcaStr) return;
      const marca = JSON.parse(currentMarcaStr);
      const divId = getDivisionIdFromMarcaJson(marca);
      setCreateEmpresaId(marca.empresa?.id != null ? Number(marca.empresa.id) : null);
      setCreateClienteId(marca.cliente?.id != null ? Number(marca.cliente.id) : null);
      setCreateDivisionId(divId);
      setCreateContratoId(marca.contrato?.id != null ? Number(marca.contrato.id) : null);
      setCreateSucursalId(marca.corpo?.id != null ? Number(marca.corpo.id) : null);
      setCreatePuestoId(null);
    } catch (e) {
      console.error('applyMarcaToCreateHierarchy:', e);
    }
  }, []);

  const checkConnection = async () => {
    //return false;
    const networkState = await Network.getNetworkStateAsync();
    return networkState.isConnected && networkState.isInternetReachable ? true : false;
  };

  const refetchVoiceNotesForFilter = useCallback(
    async (corpoIdQuery: number, puestoIdQuery: number | null) => {
      try {
        setIsLoading(true);
        if (
          !Number.isFinite(Number(corpoIdQuery)) ||
          Number(corpoIdQuery) <= 0 ||
          puestoIdQuery == null ||
          !Number.isFinite(Number(puestoIdQuery)) ||
          Number(puestoIdQuery) <= 0
        ) {
          setVoiceNotes([]);
          return;
        }
        const cid = Number(corpoIdQuery);
        const pid = Number(puestoIdQuery);
        const hasConnection = await checkConnection();
        if (!hasConnection) {
          try {
            const raw = await AsyncStorage.getItem('voice_notes_cache');
            const prev = raw ? JSON.parse(raw) : [];
            const arr = Array.isArray(prev) ? prev : [];
            setVoiceNotes(filterVoiceNotesToPuestoFetchScope(arr, cid, pid));
          } catch {
            setVoiceNotes([]);
          }
          return;
        }
        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) {
          return;
        }
        const url = `${apiUrl}/api/voice-notes?corpo_id=${cid}&puesto_id=${pid}`;
        const response = await authedFetch({
          url,
          init: {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          },
          refreshAccessToken,
          logout,
        });
        if (!response?.ok) {
          return;
        }
        const data = await response.json();
        if (data.status && data.voiceNotes) {
          let prev: VoiceNote[] = [];
          try {
            const rawCache = await AsyncStorage.getItem('voice_notes_cache');
            const parsed = rawCache ? JSON.parse(rawCache) : [];
            prev = Array.isArray(parsed) ? parsed : [];
          } catch {
            prev = [];
          }
          const merged = mergeVoiceNotesCacheForPuestoScope(prev, cid, pid, data.voiceNotes);
          await AsyncStorage.setItem('voice_notes_cache', JSON.stringify(merged));
          setVoiceNotes(filterVoiceNotesToPuestoFetchScope(merged, cid, pid));
        } else {
          setVoiceNotes([]);
        }
      } catch (e) {
        console.error('refetchVoiceNotesForFilter:', e);
      } finally {
        setIsLoading(false);
      }
    },
    [refreshAccessToken, logout]
  );

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);

      const marcaStr = await AsyncStorage.getItem('current_marca');
      if (!marcaStr) {
        setHasMarca(false);
        return;
      }

      const marca = JSON.parse(marcaStr);
      setHasMarca(true);
      setMarcaId(marca.id);
      setCorpoId(marca.corpo?.id || null);
      setPuestoActualNombre(marca.puesto?.nombre || '');

      const role = marca.roleDivision?.role?.nombre ?? marca.role_division?.role?.nombre ?? null;
      setRoleName(typeof role === 'string' ? role : null);

      setMarcaPuestoIdFromMarca(getMarcaPuestoIdFromJson(marca));

      if (role === 'OPERATIVO') {
        setFilterEmpresaId(null);
        setFilterClienteId(null);
        setFilterDivisionId(null);
        setFilterContratoId(null);
        setFilterSucursalId(null);
        setFilterPuestoId(null);
      } else {
        applyMarcaToHierarchyIds(marca);
      }
      await fetchMainStructure();

      const hasConnection = await checkConnection();

      const corpoIdQuery = marca.corpo?.id != null ? Number(marca.corpo.id) : null;
      const listPuestoId = getMarcaPuestoIdFromJson(marca);

      if (hasConnection) {
        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) {
          throw new Error('Server URL not configured');
        }
        if (!corpoIdQuery || corpoIdQuery <= 0) {
          Alert.alert('Error', 'La marca no tiene sucursal (corpo) asociada');
          setVoiceNotes([]);
          return;
        }
        if (listPuestoId == null) {
          if (role === 'OPERATIVO') {
            setVoiceNotes([]);
          }
          return;
        }
        const listUrl = `${apiUrl}/api/voice-notes?corpo_id=${corpoIdQuery}&puesto_id=${listPuestoId}`;
        const response = await authedFetch({
          url: listUrl,
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

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.status && data.voiceNotes) {
          let prev: VoiceNote[] = [];
          try {
            const rawCache = await AsyncStorage.getItem('voice_notes_cache');
            const parsed = rawCache ? JSON.parse(rawCache) : [];
            prev = Array.isArray(parsed) ? parsed : [];
          } catch {
            prev = [];
          }
          const merged = mergeVoiceNotesCacheForPuestoScope(
            prev,
            corpoIdQuery,
            listPuestoId,
            data.voiceNotes
          );
          await AsyncStorage.setItem('voice_notes_cache', JSON.stringify(merged));
          setVoiceNotes(filterVoiceNotesToPuestoFetchScope(merged, corpoIdQuery, listPuestoId));
        } else {
          setVoiceNotes([]);
          if (data.message) {
            Alert.alert('Info', data.message);
          }
        }
      } else {
        if (!corpoIdQuery || corpoIdQuery <= 0) {
          setVoiceNotes([]);
          Alert.alert('Modo Offline', 'La marca no tiene sucursal asociada.');
        } else if (listPuestoId == null) {
          if (role === 'OPERATIVO') {
            setVoiceNotes([]);
            Alert.alert(
              'Modo Offline',
              'Se requiere puesto en la marca para ver notas en caché.'
            );
          } else {
            setVoiceNotes([]);
          }
        } else {
          const voiceNotesCache = await AsyncStorage.getItem('voice_notes_cache');
          if (voiceNotesCache) {
            const cachedVoiceNotes = JSON.parse(voiceNotesCache);
            const arr = Array.isArray(cachedVoiceNotes) ? cachedVoiceNotes : [];
            setVoiceNotes(filterVoiceNotesToPuestoFetchScope(arr, corpoIdQuery, listPuestoId));
            Alert.alert('Modo Offline', 'No hay conexión a internet. Mostrando datos guardados.');
          } else {
            setVoiceNotes([]);
            Alert.alert('Modo Offline', 'No hay conexión a internet y no hay datos guardados.');
          }
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      try {
        let corpoIdForCache: number | null = null;
        let puestoIdForCache: number | null = null;
        const marcaStrErr = await AsyncStorage.getItem('current_marca');
        if (marcaStrErr) {
          try {
            const m = JSON.parse(marcaStrErr);
            corpoIdForCache = m.corpo?.id != null ? Number(m.corpo.id) : null;
            puestoIdForCache = getMarcaPuestoIdFromJson(m);
          } catch {
            corpoIdForCache = null;
            puestoIdForCache = null;
          }
        }
        const voiceNotesCache = await AsyncStorage.getItem('voice_notes_cache');
        if (voiceNotesCache) {
          const cachedVoiceNotes = JSON.parse(voiceNotesCache);
          const arr = Array.isArray(cachedVoiceNotes) ? cachedVoiceNotes : [];
          if (
            corpoIdForCache != null &&
            corpoIdForCache > 0 &&
            puestoIdForCache != null &&
            puestoIdForCache > 0
          ) {
            setVoiceNotes(filterVoiceNotesToPuestoFetchScope(arr, corpoIdForCache, puestoIdForCache));
            Alert.alert('Modo Offline', 'Error de conexión. Mostrando datos guardados.');
          } else {
            setVoiceNotes([]);
            Alert.alert(
              'Modo Offline',
              'Error de conexión. Se requiere puesto en la marca para mostrar datos guardados.'
            );
          }
        } else {
          setVoiceNotes([]);
          Alert.alert('Error', 'No se pudieron cargar las notas de voz');
        }
      } catch (cacheError) {
        console.error('Error loading cache:', cacheError);
        setVoiceNotes([]);
        Alert.alert('Error', 'No se pudieron cargar las notas de voz');
      }
    } finally {
      setMarcaChecked(true);
      setIsLoading(false);
    }
  }, [applyMarcaToHierarchyIds, fetchMainStructure, refreshAccessToken, logout]);

  useFocusEffect(
    useCallback(() => {
      void fetchData();
    }, [fetchData])
  );

  useEffect(() => {
    const handler = () => {
      void fetchData();
    };
    eventBus.on('connectionRestored', handler);
    return () => {
      eventBus.off('connectionRestored', handler);
    };
  }, [fetchData]);


  const generateDateTime = (time: string) => {
    let fechaSplit = time.split('T');
    fechaSplit[1] = fechaSplit[1].split('.')[0];
    return fechaSplit[0] + ' ' + fechaSplit[1];
  };

  const startCreating = async () => {
    try {
      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Error', 'Se necesitan permisos de ubicación');
        return;
      }

      // Request audio permissions
      const { granted, canAskAgain } = await requestRecordingPermissionsAsync();
      if (!granted) {
        if (canAskAgain) {
          Alert.alert('Permisos requeridos', 'Se necesitan permisos de audio para grabar');
        } else {
          Alert.alert('Permisos denegados', 'Por favor habilita los permisos de audio en la configuración de tu dispositivo');
        }
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      setLocation(loc);

      setEditingVoiceNote(null);
      setEditEmpresaId(null);
      setEditClienteId(null);
      setEditDivisionId(null);
      setEditContratoId(null);
      setEditSucursalId(null);
      setEditPuestoId(null);
      setEditSetPuesto(false);
      editTituloRef.current = '';
      editDescripcionRef.current = '';

      setIsCreating(true);
      setFormKey(prev => prev + 1); // Incrementar key para forzar re-render
      resetForm();
      await applyMarcaToCreateHierarchy();
    } catch (error) {
      console.error('Error starting creation:', error);
      Alert.alert('Error', 'No se pudo iniciar la creación');
    }
  };

  const cancelCreating = () => {
    setIsCreating(false);
    resetForm();
    void applyMarcaToCreateHierarchy();
    stopRecordedAudioPlayback();
    if (recorderState.isRecording) {
      stopRecording();
    }
  };

  const resetForm = () => {
    tituloRef.current = '';
    descripcionRef.current = '';
    setSetPuesto(false);
    setFirmaResponsable(null);
    setRecordedAudioUri(null);
    setRecordedAudioBase64(null);
    stopRecordedAudioPlayback();
    if (recorderState.isRecording) {
      audioRecorder.stop();
    }
  };

  const generateSignature = async () => {
    try {
      setIsGeneratingFirma(true);

      if (!employee?.id) {
        Alert.alert('Error', 'No se pudo obtener el ID del empleado');
        return;
      }

      if (!location) {
        Alert.alert('Error', 'No se pudo obtener la ubicación');
        return;
      }

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
      const decodedEmpleadoId = employee.id.toString();
      const decodedLatitud = latitude.toString();
      const decodedLongitud = longitude.toString();
      const decodedTimestamp = timestamp.toString();

      const signatureString = `${sessionId}:${decodedEmpleadoId}:${decodedLatitud}:${decodedLongitud}:${decodedTimestamp}`;
      const signatureHash = btoa(signatureString);

      // Fetch employee details
      let empleadoDetalle = undefined;
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (apiUrl) {
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
            };
          }
        } catch (err) {
          console.error('Error fetching empleado details:', err);
        }
      }

      setFirmaResponsable({
        sessionId,
        empleadoId: decodedEmpleadoId,
        latitud: decodedLatitud,
        longitud: decodedLongitud,
        timestamp: decodedTimestamp,
        empleadoDetalle,
      });
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

      // Validate QR structure
      const decodedData = atob(qrData);
      const parts = decodedData.split(':');

      if (parts.length !== 5) {
        Alert.alert('Error', 'El QR escaneado no tiene el formato correcto');
        return;
      }

      const [sessionId, empleadoId, latitud, longitud, timestamp] = parts;

      // Fetch employee details
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
      console.error('Error scanning QR:', error);
      Alert.alert('Error', 'No se pudo escanear el código QR');
    }
  };

  const startRecording = async () => {
    try {
      // Solicitar permisos de grabación
      const { granted, canAskAgain } = await requestRecordingPermissionsAsync();

      if (!granted) {
        if (canAskAgain) {
          Alert.alert('Permisos requeridos', 'Se necesitan permisos de audio para grabar');
        } else {
          Alert.alert('Permisos denegados', 'Por favor habilita los permisos de audio en la configuración de tu dispositivo');
        }
        return;
      }

      // Preparar el grabador
      await audioRecorder.prepareToRecordAsync();

      // Iniciar grabación (no es async)
      audioRecorder.record();
    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert('Error', 'No se pudo iniciar la grabación: ' + (error as Error).message);
    }
  };

  const stopRecording = async () => {
    try {
      if (!recorderState.isRecording) return;

      await audioRecorder.stop();

      const uri = audioRecorder.uri;
      if (!uri) {
        Alert.alert('Error', 'No se pudo obtener el URI del audio');
        return;
      }

      setRecordedAudioUri(uri);

      // Convert to base64
      const base64 = await fetch(uri)
        .then(res => res.blob())
        .then(blob => {
          return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64data = reader.result as string;
              resolve(base64data.split(',')[1]);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        });

      setRecordedAudioBase64(base64);
    } catch (error) {
      console.error('Error stopping recording:', error);
      Alert.alert('Error', 'No se pudo detener la grabación');
    }
  };

  const restartRecording = () => {
    try {
      if (recordedAudioPlayer && recordedPlayerStatus.playing) {
        recordedAudioPlayer.pause();
      }
    } catch (error) {
      // Ignorar errores de objetos ya liberados
    }
    setRecordedAudioUri(null);
    setRecordedAudioBase64(null);
  };

  const resetRecordedAudio = async () => {
    try {
      if (!recordedAudioPlayer) return;

      recordedAudioPlayer.seekTo(0);
      recordedAudioPlayer.pause();
    } catch (error) {
      const errorMsg = String(error);
      if (!errorMsg.includes('already released') && !errorMsg.includes('has been rejected')) {
        console.error('Error resetting recorded audio:', error);
      }
    }
  };

  const playRecordedAudio = async () => {
    try {
      if (!recordedAudioUri || !recordedAudioPlayer) return;

      if (recordedPlayerStatus.playing) {
        recordedAudioPlayer.pause();
      } else {
        recordedAudioPlayer.play();
      }
    } catch (error) {
      const errorMsg = String(error);
      if (errorMsg.includes('already released') || errorMsg.includes('has been rejected')) {
        console.log('Audio player was released');
      } else {
        console.error('Error playing audio:', error);
        Alert.alert('Error', 'No se pudo reproducir el audio');
      }
    }
  };

  const stopRecordedAudioPlayback = async () => {
    try {
      if (recordedAudioPlayer && recordedPlayerStatus.playing) {
        recordedAudioPlayer.pause();
      }
    } catch (error) {
      // Ignorar errores de objetos ya liberados
      const errorMsg = String(error);
      if (!errorMsg.includes('already released') && !errorMsg.includes('has been rejected')) {
        console.error('Error stopping audio playback:', error);
      }
    }
  };

  const validateForm = (): boolean => {
    if (!tituloRef.current.trim()) {
      Alert.alert('Error', 'El título es requerido');
      return false;
    }

    if (!descripcionRef.current.trim()) {
      Alert.alert('Error', 'La descripción es requerida');
      return false;
    }

    if (!recordedAudioBase64) {
      Alert.alert('Error', 'Debe grabar un audio');
      return false;
    }

    if (!firmaResponsable) {
      Alert.alert('Error', 'La firma del responsable es requerida');
      return false;
    }

    if (roleName === 'OPERATIVO') {
      if (setPuesto && (marcaPuestoIdFromMarca == null || marcaPuestoIdFromMarca <= 0)) {
        Alert.alert('Error', 'La marca actual no tiene puesto para asignar');
        return false;
      }
    } else {
      if (
        createEmpresaId == null ||
        createClienteId == null ||
        createSucursalId == null ||
        createDivisionId == null ||
        createContratoId == null
      ) {
        Alert.alert('Error', 'Complete al menos hasta sucursal (corpo)');
        return false;
      }
    }

    return true;
  };

  const resolveCreateHierarchyLabels = () => {
    const em = structure.find((e) => e.id === createEmpresaId);
    const cl = em?.clientes?.find((c) => c.id === createClienteId);
    const div = cl?.division?.find((d) => d.id === createDivisionId);
    const co = div?.contratos?.find((c) => c.id === createContratoId);
    const su = co?.sucursales?.find((s) => s.id === createSucursalId);
    const pu = su?.puestos?.find((p) => p.id === createPuestoId);
    return { em, cl, su, pu };
  };

  const resolveEditHierarchyLabels = () => {
    const em = structure.find((e) => e.id === editEmpresaId);
    const cl = em?.clientes?.find((c) => c.id === editClienteId);
    const div = cl?.division?.find((d) => d.id === editDivisionId);
    const co = div?.contratos?.find((c) => c.id === editContratoId);
    const su = co?.sucursales?.find((s) => s.id === editSucursalId);
    const pu = su?.puestos?.find((p) => p.id === editPuestoId);
    return { em, cl, su, pu };
  };

  const runCreateVoiceNoteConfirmed = async () => {
    if (isSubmittingCreate) return;
    if (!validateForm()) return;

    setIsSubmittingCreate(true);
    try {
      const signatureString = `${firmaResponsable!.sessionId}:${firmaResponsable!.empleadoId}:${firmaResponsable!.latitud}:${firmaResponsable!.longitud}:${firmaResponsable!.timestamp}`;
      const signatureHash = btoa(signatureString);

      const horaAccion = await getHoraAccion();
      if (!horaAccion) {
        Alert.alert('Error', 'No se pudo obtener la hora');
        return;
      }

      const useHierarchy = roleName !== 'OPERATIVO';
      const requestData: Record<string, unknown> = {
        marca_id: marcaId,
        titulo: tituloRef.current,
        descripcion: descripcionRef.current,
        setPuesto: useHierarchy ? false : setPuesto,
        firma_responsable: signatureHash,
        file_base64: recordedAudioBase64,
        created_at: horaAccion,
        use_structure_from_hierarchy: useHierarchy,
      };

      if (useHierarchy) {
        requestData.structure_empresa_id = createEmpresaId;
        requestData.structure_cliente_id = createClienteId;
        requestData.structure_corpo_id = createSucursalId;
        requestData.structure_puesto_id =
          createPuestoId != null && createPuestoId > 0 ? createPuestoId : null;
        if (createDivisionId != null && createDivisionId > 0) {
          requestData.structure_division_id = createDivisionId;
        }
        if (createContratoId != null && createContratoId > 0) {
          requestData.structure_contrato_id = createContratoId;
        }
      }

      const hasConnection = await checkConnection();

      if (hasConnection) {
        const result = await createVoiceNoteAPI({
          requestData,
          marcaId: marcaId!,
          refreshAccessToken,
          logout,
        });

        if (result.status) {
          Alert.alert('Éxito', 'Nota de voz creada correctamente');
          setIsCreating(false);
          resetForm();
          await applyMarcaToCreateHierarchy();
          void fetchData();
        } else {
          Alert.alert('Error', result.message || 'No se pudo crear la nota de voz');
        }
      } else {
        const localId = `local_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        if (!recordedAudioUri) {
          Alert.alert('Error', 'No se pudo guardar el audio (URI ausente).');
          return;
        }

        let localAudioFileName: string;
        try {
          localAudioFileName = await saveFile({
            uri: recordedAudioUri,
            originalName: 'note',
            extension: 'm4a',
            type: 'audio',
            prefix: 'voice_note',
          });
        } catch (e) {
          console.error('voice note saveFile:', e);
          Alert.alert('Error', 'No se pudo guardar el audio en el dispositivo');
          return;
        }

        const requestDataForQueue: Record<string, unknown> = { ...requestData };
        delete requestDataForQueue.file_base64;
        requestDataForQueue.audio_local_file = localAudioFileName;

        const actionsStr = await AsyncStorage.getItem('voice_notes_actions');
        let actions: any[] = actionsStr ? JSON.parse(actionsStr) : [];
        if (!Array.isArray(actions)) actions = [];
        actions = actions.filter(
          (a: any) => !(a?.type === 'create' && String(a?.id) === String(localId))
        );
        actions.push({
          requestData: requestDataForQueue,
          marcaId,
          id: localId,
          type: 'create',
        });
        await AsyncStorage.setItem('voice_notes_actions', JSON.stringify(actions));

        const cacheStr = await AsyncStorage.getItem('voice_notes_cache');
        const cache = cacheStr ? JSON.parse(cacheStr) : [];

        const currentMarcaStr = await AsyncStorage.getItem('current_marca');
        if (!currentMarcaStr) throw new Error('No current_marca');

        const currentMarca = JSON.parse(currentMarcaStr);

        let empresaVo: Empresa;
        let clienteVo: Cliente;
        let corpoVo: Corpo;
        let puestoVo: Puesto | null;

        if (useHierarchy) {
          const { em, cl, su, pu } = resolveCreateHierarchyLabels();
          empresaVo = { id: createEmpresaId!, nombre: em?.nombre ?? '' };
          clienteVo = { id: createClienteId!, nombre: cl?.nombre ?? '' };
          corpoVo = { id: createSucursalId!, nombre: su?.nombre ?? '' };
          puestoVo =
            createPuestoId != null && createPuestoId > 0
              ? { id: createPuestoId, nombre: pu?.nombre ?? '' }
              : null;
        } else {
          empresaVo = currentMarca.empresa;
          clienteVo = currentMarca.cliente;
          corpoVo = currentMarca.corpo;
          puestoVo =
            setPuesto && currentMarca.puesto?.id != null
              ? {
                  id: Number(currentMarca.puesto.id),
                  nombre: String(currentMarca.puesto.nombre ?? ''),
                }
              : null;
        }

        const newVoiceNoteCache: VoiceNote = {
          id: 0,
          empresa: empresaVo,
          cliente: clienteVo,
          corpo: corpoVo,
          puesto: puestoVo,
          titulo: tituloRef.current,
          descripcion: descripcionRef.current,
          transcripcion: null,
          firma_responsable: signatureHash,
          nombre_creator: employee?.name || '-',
          id_local: localId,
          file_base64: '',
          local_audio_file: localAudioFileName,
          isActive: true,
          created_at: new Date(horaAccion).toISOString(),
          created_by: (employee?.id || 0) as number,
          nombre_firma: firmaResponsable?.empleadoDetalle
            ? `${firmaResponsable?.empleadoDetalle.nombre} ${firmaResponsable?.empleadoDetalle.primer_apellido} ${firmaResponsable?.empleadoDetalle.segundo_apellido}`
            : '-',
        };

        const cacheArr = Array.isArray(cache) ? cache : [];
        cacheArr.push(newVoiceNoteCache);
        await AsyncStorage.setItem('voice_notes_cache', JSON.stringify(cacheArr));

        if (useHierarchy) {
          const cid = createSucursalId != null ? Number(createSucursalId) : 0;
          const pidFromForm =
            createPuestoId != null && createPuestoId > 0 ? Number(createPuestoId) : null;
          const pidForList =
            pidFromForm && pidFromForm > 0
              ? pidFromForm
              : (cid > 0 ? getFirstPuestoIdInSucursalCorpo(structure, cid) : null);

          if (roleName !== 'OPERATIVO') {
            if (createEmpresaId != null) setFilterEmpresaId(createEmpresaId);
            if (createClienteId != null) setFilterClienteId(createClienteId);
            if (createDivisionId != null) setFilterDivisionId(createDivisionId);
            if (createContratoId != null) setFilterContratoId(createContratoId);
            if (cid > 0) setFilterSucursalId(cid);
            if (pidForList != null && pidForList > 0) {
              setFilterPuestoId(pidForList);
            }
          }

          if (cid > 0 && pidForList != null && pidForList > 0) {
            setVoiceNotes(filterVoiceNotesToPuestoFetchScope(cacheArr, cid, pidForList));
          } else if (cid > 0) {
            setVoiceNotes(
              cacheArr.filter(
                (v) =>
                  Number(v?.corpo?.id) === cid &&
                  (isPendingOfflineVoiceNoteCreate(v) || (v as VoiceNote).isActive !== false)
              )
            );
          }
        } else {
          const cid =
            currentMarca.corpo?.id != null ? Number(currentMarca.corpo.id) : null;
          const pid = getMarcaPuestoIdFromJson(currentMarca);
          if (cid != null && cid > 0 && pid != null) {
            setVoiceNotes(filterVoiceNotesToPuestoFetchScope(cacheArr, cid, pid));
          }
        }

        Alert.alert('Modo Offline', 'Nota de voz registrada localmente. Se sincronizará cuando haya conexión.');
        setIsCreating(false);
        resetForm();
        await applyMarcaToCreateHierarchy();
      }
    } catch (error) {
      console.error('Error creating voice note:', error);
      Alert.alert('Error', 'No se pudo crear la nota de voz');
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  const handleCreateVoiceNote = () => {
    if (isSubmittingCreate) return;
    if (!validateForm()) return;
    Alert.alert('Confirmar', '¿Está seguro de que desea crear esta nota de voz?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Aceptar', onPress: () => void runCreateVoiceNoteConfirmed() },
    ]);
  };

  const runDeleteVoiceNoteConfirmed = async (voiceNote: VoiceNote) => {
    const key = getUniqueKey(voiceNote);
    setDeletingKey(key);
    try {
      const voiceNoteId = voiceNote.id;
      const id_local = voiceNote.id_local;

      setAudioUris((prev) => {
        const newMap = new Map(prev);
        newMap.delete(key);
        return newMap;
      });
      setPlayingStates((prev) => {
        const newMap = new Map(prev);
        newMap.delete(key);
        return newMap;
      });
      setAudioDurations((prev) => {
        const newMap = new Map(prev);
        newMap.delete(key);
        return newMap;
      });
      setAudioPositions((prev) => {
        const newMap = new Map(prev);
        newMap.delete(key);
        return newMap;
      });
      setExpandedVoiceNotes((prev) => {
        const newSet = new Set(prev);
        newSet.delete(key);
        return newSet;
      });

      const hasConnection = await checkConnection();

      if (voiceNote.local_audio_file) {
        try {
          await deleteFile(voiceNote.local_audio_file);
        } catch {
          /* idempotente */
        }
      }

      const isLocalDraft =
        id_local != null &&
        String(id_local) !== '' &&
        (!Number.isFinite(Number(voiceNoteId)) || Number(voiceNoteId) <= 0);

      if (isLocalDraft) {
        const actionsStr = await AsyncStorage.getItem('voice_notes_actions');
        let actions: any[] = actionsStr ? JSON.parse(actionsStr) : [];
        if (!Array.isArray(actions)) actions = [];
        const filteredActions = actions.filter(
          (a: any) => !(a?.type === 'create' && String(a?.id) === String(id_local))
        );
        await AsyncStorage.setItem('voice_notes_actions', JSON.stringify(filteredActions));

        const cacheStr = await AsyncStorage.getItem('voice_notes_cache');
        const cache = cacheStr ? JSON.parse(cacheStr) : [];
        const filteredCache = (Array.isArray(cache) ? cache : []).filter(
          (v: VoiceNote) => String(v.id_local) !== String(id_local)
        );
        await AsyncStorage.setItem('voice_notes_cache', JSON.stringify(filteredCache));

        setVoiceNotes((prev) => prev.filter((v) => String(v.id_local) !== String(id_local)));

        Alert.alert(
          'Éxito',
          hasConnection
            ? 'Borrador local eliminado.'
            : 'Nota de voz eliminada localmente; se quitó de la cola y la caché.'
        );
        return;
      }

      if (hasConnection) {
        const result = await deleteVoiceNoteAPI({
          voiceNoteId,
          refreshAccessToken,
          logout,
        });

        if (result.status) {
          Alert.alert('Éxito', 'Nota de voz eliminada correctamente');
          void fetchData();
        } else {
          Alert.alert('Error', result.message || 'No se pudo eliminar la nota de voz');
        }
      } else {
        const actionsStr = await AsyncStorage.getItem('voice_notes_actions');
        let actions: any[] = actionsStr ? JSON.parse(actionsStr) : [];
        if (!Array.isArray(actions)) actions = [];

        actions = appendOfflineVoiceNoteDelete(actions, voiceNoteId);
        await AsyncStorage.setItem('voice_notes_actions', JSON.stringify(actions));

        const cacheStr = await AsyncStorage.getItem('voice_notes_cache');
        const cache = cacheStr ? JSON.parse(cacheStr) : [];

        const filteredCache = (Array.isArray(cache) ? cache : []).filter(
          (v: VoiceNote) => v.id !== voiceNoteId
        );
        await AsyncStorage.setItem('voice_notes_cache', JSON.stringify(filteredCache));

        setVoiceNotes((prev) => prev.filter((v) => v.id !== voiceNoteId));

        Alert.alert('Modo Offline', 'Nota de voz eliminada localmente. Se sincronizará cuando haya conexión.');
      }
    } catch (error) {
      console.error('Error deleting voice note:', error);
      Alert.alert('Error', 'No se pudo eliminar la nota de voz');
    } finally {
      setDeletingKey(null);
    }
  };

  const deleteVoiceNote = (voiceNote: VoiceNote) => {
    if (deletingKey !== null) return;
    Alert.alert('Confirmar', '¿Está seguro de que desea eliminar esta nota de voz?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => void runDeleteVoiceNoteConfirmed(voiceNote),
      },
    ]);
  };

  const openEditVoiceNote = (voiceNote: VoiceNote) => {
    setIsCreating(false);
    editTituloRef.current = voiceNote.titulo;
    editDescripcionRef.current = voiceNote.descripcion;
    setEditFormKey((k) => k + 1);
    setEditingVoiceNote(voiceNote);

    const corpoRaw = voiceNote.corpo?.id != null ? Number(voiceNote.corpo.id) : null;
    const puestoRaw = voiceNote.puesto?.id != null ? Number(voiceNote.puesto.id) : null;
    const corpoId = corpoRaw != null && Number.isFinite(corpoRaw) && corpoRaw > 0 ? corpoRaw : null;
    const puestoId = puestoRaw != null && Number.isFinite(puestoRaw) && puestoRaw > 0 ? puestoRaw : null;

    if (roleName !== 'OPERATIVO' && structure.length > 0 && corpoId != null) {
      const traced = traceVoiceNoteInStructure(structure, corpoId, puestoId);
      if (traced) {
        setEditEmpresaId(traced.empresaId);
        setEditClienteId(traced.clienteId);
        setEditDivisionId(traced.divisionId);
        setEditContratoId(traced.contratoId);
        setEditSucursalId(traced.sucursalId);
        setEditPuestoId(traced.puestoId ?? puestoId);
      } else {
        setEditEmpresaId(voiceNote.empresa?.id != null ? Number(voiceNote.empresa.id) : null);
        setEditClienteId(voiceNote.cliente?.id != null ? Number(voiceNote.cliente.id) : null);
        setEditDivisionId(null);
        setEditContratoId(null);
        setEditSucursalId(corpoId);
        setEditPuestoId(puestoId);
      }
      setEditSetPuesto(false);
    } else if (roleName === 'OPERATIVO') {
      setEditEmpresaId(null);
      setEditClienteId(null);
      setEditDivisionId(null);
      setEditContratoId(null);
      setEditSucursalId(null);
      setEditPuestoId(null);
      setEditSetPuesto(puestoId != null);
    } else {
      setEditEmpresaId(null);
      setEditClienteId(null);
      setEditDivisionId(null);
      setEditContratoId(null);
      setEditSucursalId(null);
      setEditPuestoId(null);
      setEditSetPuesto(false);
    }
  };

  const closeEditVoiceNote = () => {
    setEditingVoiceNote(null);
    editTituloRef.current = '';
    editDescripcionRef.current = '';
    setEditEmpresaId(null);
    setEditClienteId(null);
    setEditDivisionId(null);
    setEditContratoId(null);
    setEditSucursalId(null);
    setEditPuestoId(null);
    setEditSetPuesto(false);
  };

  const validateEditForm = (): boolean => {
    if (!editTituloRef.current.trim()) {
      Alert.alert('Error', 'El título es requerido');
      return false;
    }
    if (!editDescripcionRef.current.trim()) {
      Alert.alert('Error', 'La descripción es requerida');
      return false;
    }
    if (roleName === 'OPERATIVO') {
      if (editSetPuesto && (marcaPuestoIdFromMarca == null || marcaPuestoIdFromMarca <= 0)) {
        Alert.alert('Error', 'La marca actual no tiene puesto para asignar');
        return false;
      }
    } else if (structure.length > 0) {
      if (
        editEmpresaId == null ||
        editClienteId == null ||
        editSucursalId == null ||
        editDivisionId == null ||
        editContratoId == null
      ) {
        Alert.alert('Error', 'Complete al menos hasta sucursal (corpo)');
        return false;
      }
    }
    return true;
  };

  const runUpdateVoiceNoteConfirmed = async () => {
    if (!editingVoiceNote || isSubmittingEdit) return;
    if (!validateEditForm()) return;

    setIsSubmittingEdit(true);
    try {
      const useHierarchy = roleName !== 'OPERATIVO' && structure.length > 0;
      const patchPayload: Record<string, unknown> = {
        titulo: editTituloRef.current.trim(),
        descripcion: editDescripcionRef.current.trim(),
      };
      if (useHierarchy) {
        patchPayload.marca_id = marcaId;
        patchPayload.use_structure_from_hierarchy = true;
        patchPayload.setPuesto = false;
        patchPayload.structure_empresa_id = editEmpresaId;
        patchPayload.structure_cliente_id = editClienteId;
        patchPayload.structure_corpo_id = editSucursalId;
        patchPayload.structure_puesto_id =
          editPuestoId != null && editPuestoId > 0 ? editPuestoId : null;
      } else if (roleName === 'OPERATIVO') {
        patchPayload.marca_id = marcaId;
        patchPayload.use_structure_from_hierarchy = false;
        patchPayload.setPuesto = editSetPuesto;
      }

      const hasConnection = await checkConnection();

      // Borrador local (aún no sincronizado): fusionar en cola `create`
      if (editingVoiceNote.id <= 0) {
        if (!editingVoiceNote.id_local) {
          Alert.alert('Error', 'No se puede actualizar esta nota sin referencia local');
          return;
        }
        const actionsStr = await AsyncStorage.getItem('voice_notes_actions');
        let actions: any[] = actionsStr ? JSON.parse(actionsStr) : [];
        if (!Array.isArray(actions)) actions = [];
        actions = stripErroneousVoiceNoteUpdatesForLocalQueueId(actions, editingVoiceNote.id_local);
        const idx = actions.findIndex(
          (a: any) => a?.type === 'create' && String(a.id) === String(editingVoiceNote.id_local)
        );
        if (idx === -1) {
          Alert.alert(
            'Error',
            'No se encontró la acción pendiente de creación. Intente crear de nuevo o sincronice.'
          );
          return;
        }
        const rd: Record<string, unknown> = {
          ...(actions[idx].requestData as Record<string, unknown>),
          titulo: editTituloRef.current.trim(),
          descripcion: editDescripcionRef.current.trim(),
        };
        if (useHierarchy) {
          rd.marca_id = marcaId;
          rd.use_structure_from_hierarchy = true;
          rd.setPuesto = false;
          rd.structure_empresa_id = editEmpresaId;
          rd.structure_cliente_id = editClienteId;
          rd.structure_corpo_id = editSucursalId;
          rd.structure_puesto_id =
            editPuestoId != null && editPuestoId > 0 ? editPuestoId : null;
          if (editDivisionId != null && editDivisionId > 0) {
            rd.structure_division_id = editDivisionId;
          }
          if (editContratoId != null && editContratoId > 0) {
            rd.structure_contrato_id = editContratoId;
          }
        } else if (roleName === 'OPERATIVO') {
          rd.marca_id = marcaId;
          rd.use_structure_from_hierarchy = false;
          rd.setPuesto = editSetPuesto;
        }
        actions[idx].requestData = rd;
        if (actions[idx].marcaId == null && marcaId != null) {
          actions[idx].marcaId = marcaId;
        }
        await AsyncStorage.setItem('voice_notes_actions', JSON.stringify(actions));

        const cacheStr = await AsyncStorage.getItem('voice_notes_cache');
        const cache = cacheStr ? JSON.parse(cacheStr) : [];
        const vi = Array.isArray(cache)
          ? cache.findIndex(
              (v: VoiceNote) => String(v.id_local) === String(editingVoiceNote.id_local)
            )
          : -1;
        if (vi !== -1) {
          let nextEmpresa: Empresa;
          let nextCliente: Cliente;
          let nextCorpo: Corpo;
          let nextPuesto: Puesto | null;
          if (useHierarchy) {
            const { em, cl, su, pu } = resolveEditHierarchyLabels();
            nextEmpresa = { id: editEmpresaId!, nombre: em?.nombre ?? '' };
            nextCliente = { id: editClienteId!, nombre: cl?.nombre ?? '' };
            nextCorpo = { id: editSucursalId!, nombre: su?.nombre ?? '' };
            nextPuesto =
              editPuestoId != null && editPuestoId > 0
                ? { id: editPuestoId, nombre: pu?.nombre ?? '' }
                : null;
          } else {
            const currentMarcaStr = await AsyncStorage.getItem('current_marca');
            if (!currentMarcaStr) throw new Error('No current_marca');
            const currentMarca = JSON.parse(currentMarcaStr);
            nextEmpresa = currentMarca.empresa;
            nextCliente = currentMarca.cliente;
            nextCorpo = currentMarca.corpo;
            nextPuesto =
              editSetPuesto && currentMarca.puesto?.id != null
                ? {
                    id: Number(currentMarca.puesto.id),
                    nombre: String(currentMarca.puesto.nombre ?? ''),
                  }
                : null;
          }
          cache[vi] = {
            ...cache[vi],
            empresa: nextEmpresa,
            cliente: nextCliente,
            corpo: nextCorpo,
            puesto: nextPuesto,
            titulo: editTituloRef.current.trim(),
            descripcion: editDescripcionRef.current.trim(),
          };
          await AsyncStorage.setItem('voice_notes_cache', JSON.stringify(cache));
        }

        Alert.alert(
          hasConnection ? 'Éxito' : 'Modo Offline',
          hasConnection
            ? 'Nota actualizada. Se sincronizará la creación cuando corresponda.'
            : 'Nota actualizada localmente. Se sincronizará cuando haya conexión.'
        );
        closeEditVoiceNote();
        try {
          const rawList = await AsyncStorage.getItem('voice_notes_cache');
          const parsedList = rawList ? JSON.parse(rawList) : [];
          const arrList = Array.isArray(parsedList) ? parsedList : [];
          if (useHierarchy) {
            const cid = editSucursalId != null ? Number(editSucursalId) : 0;
            const pid =
              editPuestoId != null && editPuestoId > 0 ? Number(editPuestoId) : NaN;
            if (cid > 0 && Number.isFinite(pid) && pid > 0) {
              setVoiceNotes(filterVoiceNotesToPuestoFetchScope(arrList, cid, pid));
            }
          } else {
            const currentMarcaStrUpd = await AsyncStorage.getItem('current_marca');
            if (currentMarcaStrUpd) {
              const mUpd = JSON.parse(currentMarcaStrUpd);
              const cid = mUpd.corpo?.id != null ? Number(mUpd.corpo.id) : null;
              const pid = getMarcaPuestoIdFromJson(mUpd);
              if (cid != null && cid > 0 && pid != null) {
                setVoiceNotes(filterVoiceNotesToPuestoFetchScope(arrList, cid, pid));
              }
            }
          }
        } catch {
          /* ignore */
        }
        return;
      }

      if (hasConnection) {
        const result = await updateVoiceNoteAPI({
          voiceNoteId: editingVoiceNote.id,
          payload: patchPayload,
          refreshAccessToken,
          logout,
        });

        if (result.status) {
          Alert.alert('Éxito', result.message || 'Nota actualizada');
          closeEditVoiceNote();
          void fetchData();
        } else {
          Alert.alert('Error', result.message || 'No se pudo actualizar la nota');
        }
        return;
      }

      const vid = Number(editingVoiceNote.id);
      const actionsStrOff = await AsyncStorage.getItem('voice_notes_actions');
      let actionsOff: any[] = actionsStrOff ? JSON.parse(actionsStrOff) : [];
      if (!Array.isArray(actionsOff)) actionsOff = [];
      actionsOff = stripQueuedVoiceNoteUpdatesForNoteId(actionsOff, vid);
      actionsOff.push({
        type: 'update',
        id: vid,
        payload: patchPayload,
      });
      await AsyncStorage.setItem('voice_notes_actions', JSON.stringify(actionsOff));

      const cacheStrOff = await AsyncStorage.getItem('voice_notes_cache');
      const cacheOff = cacheStrOff ? JSON.parse(cacheStrOff) : [];
      const vidx = Array.isArray(cacheOff)
        ? cacheOff.findIndex((v: VoiceNote) => Number(v.id) === vid)
        : -1;
      if (vidx !== -1) {
        let nextEmpresa: Empresa;
        let nextCliente: Cliente;
        let nextCorpo: Corpo;
        let nextPuesto: Puesto | null;
        if (useHierarchy) {
          const { em, cl, su, pu } = resolveEditHierarchyLabels();
          nextEmpresa = { id: editEmpresaId!, nombre: em?.nombre ?? '' };
          nextCliente = { id: editClienteId!, nombre: cl?.nombre ?? '' };
          nextCorpo = { id: editSucursalId!, nombre: su?.nombre ?? '' };
          nextPuesto =
            editPuestoId != null && editPuestoId > 0
              ? { id: editPuestoId, nombre: pu?.nombre ?? '' }
              : null;
        } else {
          const currentMarcaStr = await AsyncStorage.getItem('current_marca');
          if (!currentMarcaStr) throw new Error('No current_marca');
          const currentMarca = JSON.parse(currentMarcaStr);
          nextEmpresa = currentMarca.empresa;
          nextCliente = currentMarca.cliente;
          nextCorpo = currentMarca.corpo;
          nextPuesto =
            editSetPuesto && currentMarca.puesto?.id != null
              ? {
                  id: Number(currentMarca.puesto.id),
                  nombre: String(currentMarca.puesto.nombre ?? ''),
                }
              : null;
        }
        cacheOff[vidx] = {
          ...cacheOff[vidx],
          empresa: nextEmpresa,
          cliente: nextCliente,
          corpo: nextCorpo,
          puesto: nextPuesto,
          titulo: editTituloRef.current.trim(),
          descripcion: editDescripcionRef.current.trim(),
        };
        await AsyncStorage.setItem('voice_notes_cache', JSON.stringify(cacheOff));
      }

      Alert.alert('Modo Offline', 'Nota actualizada localmente. Se sincronizará cuando haya conexión.');
      closeEditVoiceNote();
      try {
        const rawOff = await AsyncStorage.getItem('voice_notes_cache');
        const parsedOff = rawOff ? JSON.parse(rawOff) : [];
        const arrOff = Array.isArray(parsedOff) ? parsedOff : [];
        if (useHierarchy) {
          const cid = editSucursalId != null ? Number(editSucursalId) : 0;
          const pid =
            editPuestoId != null && editPuestoId > 0 ? Number(editPuestoId) : NaN;
          if (cid > 0 && Number.isFinite(pid) && pid > 0) {
            setVoiceNotes(filterVoiceNotesToPuestoFetchScope(arrOff, cid, pid));
          }
        } else {
          const currentMarcaStrOff = await AsyncStorage.getItem('current_marca');
          if (currentMarcaStrOff) {
            const mOff = JSON.parse(currentMarcaStrOff);
            const cid = mOff.corpo?.id != null ? Number(mOff.corpo.id) : null;
            const pid = getMarcaPuestoIdFromJson(mOff);
            if (cid != null && cid > 0 && pid != null) {
              setVoiceNotes(filterVoiceNotesToPuestoFetchScope(arrOff, cid, pid));
            }
          }
        }
      } catch {
        /* ignore */
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'No se pudo actualizar la nota de voz');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleUpdateVoiceNote = () => {
    if (isSubmittingEdit) return;
    if (!validateEditForm()) return;
    Alert.alert('Confirmar', '¿Guardar los cambios en esta nota de voz?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Aceptar', onPress: () => void runUpdateVoiceNoteConfirmed() },
    ]);
  };

  const toggleVoiceNoteExpanded = (voiceNote: VoiceNote) => {
    const key = getUniqueKey(voiceNote);
    setExpandedVoiceNotes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
        if (!audioUris.has(key)) {
          setLoadingAudioUris((s) => new Set(s).add(key));
          void loadVoiceNoteAudio(voiceNote).finally(() => {
            setLoadingAudioUris((s) => {
              const n = new Set(s);
              n.delete(key);
              return n;
            });
          });
        }
      }
      return newSet;
    });
  };

  /**
   * Resuelve la URI reproducible. Devuelve el string para uso inmediato (p. ej. play justo al cargar).
   */
  const loadVoiceNoteAudio = async (voiceNote: VoiceNote): Promise<string | null> => {
    const key = getUniqueKey(voiceNote);
    const already = audioUrisRef.current.get(key);
    if (already) return already;

    try {
      if (voiceNote.local_audio_file) {
        const display = getLocalFileDisplayUri(voiceNote.local_audio_file);
        if (!display) {
          Alert.alert('Error', 'No se encontró el archivo de audio en el dispositivo.');
          return null;
        }
        setAudioUris((prev) => {
          const newMap = new Map(prev);
          newMap.set(key, display);
          return newMap;
        });
        return display;
      }

      if (voiceNote.id_local !== '') {
        if (!voiceNote.file_base64) {
          Alert.alert('Error', 'No se puede reproducir el audio offline sin datos guardados.');
          return null;
        }

        const audioUri = `data:audio/m4a;base64,${voiceNote.file_base64}`;
        setAudioUris((prev) => {
          const newMap = new Map(prev);
          newMap.set(key, audioUri);
          return newMap;
        });
        return audioUri;
      }

      const hasConnection = await checkConnection();
      if (!hasConnection) {
        Alert.alert('Error', 'No se puede reproducir el audio sin conexión a internet.');
        return null;
      }

      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) {
        throw new Error('Server URL not configured');
      }

      const rawUrl = `${apiUrl}/api/voice-notes/${voiceNote.id}/get-note`;
      const audioUri = appendTokenToUrl(rawUrl);
      setAudioUris((prev) => {
        const newMap = new Map(prev);
        newMap.set(key, audioUri);
        return newMap;
      });
      return audioUri;
    } catch (error) {
      console.error('Error loading voice note audio:', error);
      Alert.alert('Error', 'No se pudo cargar el audio');
      return null;
    }
  };

  const formatTime = (seconds: number): string => {
    if (!seconds || isNaN(seconds) || seconds < 0) {
      return '0:00';
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDateForDisplay = (dateString: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const filterClienteOptionsMemo = useMemo(() => {
    const empresa = structure.find((e) => e.id === filterEmpresaId);
    return empresa?.clientes ?? [];
  }, [structure, filterEmpresaId]);

  const filterDivisionOptionsMemo = useMemo(() => {
    const cliente = filterClienteOptionsMemo.find((c) => c.id === filterClienteId);
    return cliente?.division ?? [];
  }, [filterClienteOptionsMemo, filterClienteId]);

  const filterContratoOptionsMemo = useMemo(() => {
    const division = filterDivisionOptionsMemo.find((d) => d.id === filterDivisionId);
    return division?.contratos ?? [];
  }, [filterDivisionOptionsMemo, filterDivisionId]);

  const filterSucursalOptionsMemo = useMemo(() => {
    const contrato = filterContratoOptionsMemo.find((c) => c.id === filterContratoId);
    return contrato?.sucursales ?? [];
  }, [filterContratoOptionsMemo, filterContratoId]);

  const filterPuestoOptionsMemo = useMemo(() => {
    const sucursal = filterSucursalOptionsMemo.find((s) => s.id === filterSucursalId);
    return sucursal?.puestos ?? [];
  }, [filterSucursalOptionsMemo, filterSucursalId]);

  const createClienteOptionsMemo = useMemo(() => {
    const empresa = structure.find((e) => e.id === createEmpresaId);
    return empresa?.clientes ?? [];
  }, [structure, createEmpresaId]);

  const createDivisionOptionsMemo = useMemo(() => {
    const cliente = createClienteOptionsMemo.find((c) => c.id === createClienteId);
    return cliente?.division ?? [];
  }, [createClienteOptionsMemo, createClienteId]);

  const createContratoOptionsMemo = useMemo(() => {
    const division = createDivisionOptionsMemo.find((d) => d.id === createDivisionId);
    return division?.contratos ?? [];
  }, [createDivisionOptionsMemo, createDivisionId]);

  const createSucursalOptionsMemo = useMemo(() => {
    const contrato = createContratoOptionsMemo.find((c) => c.id === createContratoId);
    return contrato?.sucursales ?? [];
  }, [createContratoOptionsMemo, createContratoId]);

  const createPuestoOptionsMemo = useMemo(() => {
    const sucursal = createSucursalOptionsMemo.find((s) => s.id === createSucursalId);
    return sucursal?.puestos ?? [];
  }, [createSucursalOptionsMemo, createSucursalId]);

  const editClienteOptionsMemo = useMemo(() => {
    const empresa = structure.find((e) => e.id === editEmpresaId);
    return empresa?.clientes ?? [];
  }, [structure, editEmpresaId]);

  const editDivisionOptionsMemo = useMemo(() => {
    const cliente = editClienteOptionsMemo.find((c) => c.id === editClienteId);
    return cliente?.division ?? [];
  }, [editClienteOptionsMemo, editClienteId]);

  const editContratoOptionsMemo = useMemo(() => {
    const division = editDivisionOptionsMemo.find((d) => d.id === editDivisionId);
    return division?.contratos ?? [];
  }, [editDivisionOptionsMemo, editDivisionId]);

  const editSucursalOptionsMemo = useMemo(() => {
    const contrato = editContratoOptionsMemo.find((c) => c.id === editContratoId);
    return contrato?.sucursales ?? [];
  }, [editContratoOptionsMemo, editContratoId]);

  const editPuestoOptionsMemo = useMemo(() => {
    const sucursal = editSucursalOptionsMemo.find((s) => s.id === editSucursalId);
    return sucursal?.puestos ?? [];
  }, [editSucursalOptionsMemo, editSucursalId]);

  const listScopedVoiceNotes = useMemo(() => {
    if (roleName === 'OPERATIVO') {
      const cid = corpoId;
      const pid = marcaPuestoIdFromMarca;
      if (cid == null || !Number.isFinite(Number(cid)) || Number(cid) <= 0) return [];
      if (pid == null || !Number.isFinite(Number(pid)) || Number(pid) <= 0) return [];
      return voiceNotes.filter((vn) => voiceNoteInPuestoFetchScope(vn, Number(cid), Number(pid)));
    }
    const cid = filterSucursalId;
    const pid = filterPuestoId;
    if (cid == null || !Number.isFinite(Number(cid)) || Number(cid) <= 0) return [];
    if (pid == null || !Number.isFinite(Number(pid)) || Number(pid) <= 0) {
      return voiceNotes.filter(
        (vn) =>
          Number(vn?.corpo?.id) === Number(cid) &&
          (isPendingOfflineVoiceNoteCreate(vn) || (vn as VoiceNote).isActive !== false)
      );
    }
    return voiceNotes.filter((vn) => voiceNoteInPuestoFetchScope(vn, Number(cid), Number(pid)));
  }, [
    voiceNotes,
    filterSucursalId,
    filterPuestoId,
    roleName,
    corpoId,
    marcaPuestoIdFromMarca,
  ]);

  const resetAllFilters = () => {
    void resetListFiltersFromCurrentMarca();
    setFilterTitulo('');
    setFilterDescripcion('');
    setFilterTranscripcion('');
    setFilterCreatedAt('');
  };

  const filteredVoiceNotes = useMemo(
    () =>
      listScopedVoiceNotes.filter((voiceNote) => {
        const matchesTitulo =
          !filterTitulo ||
          (voiceNote.titulo && voiceNote.titulo.toLowerCase().includes(filterTitulo.toLowerCase()));

        const matchesDescripcion =
          !filterDescripcion ||
          (voiceNote.descripcion && voiceNote.descripcion.toLowerCase().includes(filterDescripcion.toLowerCase()));

        const matchesTranscripcion =
          !filterTranscripcion ||
          (voiceNote.transcripcion &&
            voiceNote.transcripcion.toLowerCase().includes(filterTranscripcion.toLowerCase()));

        const matchesCreatedAt =
          !filterCreatedAt ||
          (voiceNote.created_at && voiceNote.created_at.split('T')[0] === filterCreatedAt);

        return matchesTitulo && matchesDescripcion && matchesTranscripcion && matchesCreatedAt;
      }),
    [
      listScopedVoiceNotes,
      filterTitulo,
      filterDescripcion,
      filterTranscripcion,
      filterCreatedAt,
    ]
  );

  const [playingStates, setPlayingStates] = useState<Map<string, boolean>>(new Map());
  const [audioPositions, setAudioPositions] = useState<Map<string, number>>(new Map());

  const playVoiceNoteAudio = async (voiceNote: VoiceNote) => {
    const key = getUniqueKey(voiceNote);
    let audioUri = audioUrisRef.current.get(key) ?? (await loadVoiceNoteAudio(voiceNote));
    if (!audioUri) {
      return;
    }

    setPlayingStates((prev) => {
      const newMap = new Map(prev);
      const isCurrentlyPlaying = newMap.get(key) || false;
      newMap.set(key, !isCurrentlyPlaying);
      return newMap;
    });
  };

  const resetVoiceNoteAudio = (voiceNote: VoiceNote) => {
    const key = getUniqueKey(voiceNote);
    setAudioPositions((prev) => {
      const newMap = new Map(prev);
      newMap.set(key, 0);
      return newMap;
    });
    setPlayingStates((prev) => {
      const newMap = new Map(prev);
      newMap.set(key, false);
      return newMap;
    });
    setResetFlags((prev) => {
      const newMap = new Map(prev);
      newMap.set(key, true);
      return newMap;
    });
    setTimeout(() => {
      setResetFlags((prev) => {
        const newMap = new Map(prev);
        newMap.set(key, false);
        return newMap;
      });
    }, 100);
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'add':
        return <Ionicons name="add" size={24} color="#000000" />;
      case 'delete':
        return <Ionicons name="trash-outline" size={20} color="#000000" />;
      case 'qr':
        return <Ionicons name="qr-code" size={20} color="#000000" />;
      case 'clear':
        return <Ionicons name="trash" size={20} color="#000000" />;
      case 'play':
        return <Ionicons name="play" size={24} color="#007AFF" />;
      case 'pause':
        return <Ionicons name="pause" size={24} color="#007AFF" />;
      case 'microphone':
        return <Ionicons name="mic" size={24} color="#000000" />;
      case 'stop':
        return <Ionicons name="stop" size={24} color="#FF3B30" />;
      case 'restart':
        return <Ionicons name="refresh" size={24} color="#FFFFFF" />;
      case 'confirm':
        return <Ionicons name="checkmark" size={24} color="#FFFFFF" />;
      case 'cancel':
        return <Ionicons name="close" size={24} color="#FFFFFF" />;
      case 'signature':
        return <Ionicons name="finger-print" size={24} color="#000000" />;
      default:
        return null;

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

  if (marcaChecked && !hasMarca) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader onMenuPress={handleMenuPress} title="Notas de Voz" />
        <ThemedView style={styles.emptyContainer}>
          <ThemedText style={styles.emptyText}>No hay una marca registrada</ThemedText>
        </ThemedView>
        <AppFooter />
        <SlideMenu
          isVisible={isMenuVisible}
          onClose={handleMenuClose}
          onHomePress={handleHomePress}
          currentRoute="VoiceNotes"
        />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <AppHeader onMenuPress={handleMenuPress} title="Notas de Voz" />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollViewContent}>
        {/* Title Section */}
        <ThemedView style={styles.titleContainer}>
          <ThemedText type="title" style={styles.title}>
            {getActionIcon('microphone')} Notas de Voz
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            Gestiona las notas de voz
          </ThemedText>
        </ThemedView>

        {/* Filtros */}
        {hasMarca && !isCreating && !editingVoiceNote && (
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
                <>
                  {roleName != null && roleName !== 'OPERATIVO' && (
                    <>
                    <ThemedText style={styles.hierarchyHint}>
                      Filtro por sucursal y puesto (precarga hasta sucursal desde la marca actual):
                    </ThemedText>
                    {isStructureLoading ? (
                      <ThemedView style={styles.inlineLoader}>
                        <ActivityIndicator size="small" color="#007AFF" />
                        <ThemedText style={styles.inlineLoaderText}>Cargando estructura…</ThemedText>
                      </ThemedView>
                    ) : structure.length === 0 ? (
                      <ThemedText style={styles.emptyText}>Sin estructura en caché.</ThemedText>
                    ) : (
                      <>
                        <ThemedView style={styles.filterGroup}>
                          <ThemedText style={styles.filterLabel}>Empresa</ThemedText>
                          <View style={styles.pickerWrapper}>
                            <Picker
                              selectedValue={filterEmpresaId ?? 0}
                              onValueChange={(v) => {
                                const next = Number(v) || 0;
                                setFilterEmpresaId(next === 0 ? null : next);
                                setFilterClienteId(null);
                                setFilterDivisionId(null);
                                setFilterContratoId(null);
                                setFilterSucursalId(null);
                                setFilterPuestoId(null);
                              }}
                            >
                              <Picker.Item label="Seleccione empresa…" value={0} color="#000000" />
                              {structure.map((e) => (
                                <Picker.Item key={e.id} label={e.nombre} value={e.id} color="#000000" />
                              ))}
                            </Picker>
                          </View>
                        </ThemedView>

                        <ThemedView style={styles.filterGroup}>
                          <ThemedText style={styles.filterLabel}>Cliente</ThemedText>
                          <View style={styles.pickerWrapper}>
                            <Picker
                              enabled={filterEmpresaId != null && filterClienteOptionsMemo.length > 0}
                              selectedValue={filterClienteId ?? 0}
                              onValueChange={(v) => {
                                const next = Number(v) || 0;
                                setFilterClienteId(next === 0 ? null : next);
                                setFilterDivisionId(null);
                                setFilterContratoId(null);
                                setFilterSucursalId(null);
                                setFilterPuestoId(null);
                              }}
                            >
                              <Picker.Item
                                label={filterEmpresaId ? 'Seleccione cliente…' : 'Seleccione empresa primero'}
                                value={0}
                                color="#000000"
                              />
                              {filterClienteOptionsMemo.map((c) => (
                                <Picker.Item key={c.id} label={c.nombre} value={c.id} color="#000000" />
                              ))}
                            </Picker>
                          </View>
                        </ThemedView>

                        <ThemedView style={styles.filterGroup}>
                          <ThemedText style={styles.filterLabel}>División</ThemedText>
                          <View style={styles.pickerWrapper}>
                            <Picker
                              enabled={filterClienteId != null && filterDivisionOptionsMemo.length > 0}
                              selectedValue={filterDivisionId ?? 0}
                              onValueChange={(v) => {
                                const next = Number(v) || 0;
                                setFilterDivisionId(next === 0 ? null : next);
                                setFilterContratoId(null);
                                setFilterSucursalId(null);
                                setFilterPuestoId(null);
                              }}
                            >
                              <Picker.Item
                                label={filterClienteId ? 'Seleccione división…' : 'Seleccione cliente primero'}
                                value={0}
                                color="#000000"
                              />
                              {filterDivisionOptionsMemo.map((d) => (
                                <Picker.Item key={d.id} label={d.nombre} value={d.id} color="#000000" />
                              ))}
                            </Picker>
                          </View>
                        </ThemedView>

                        <ThemedView style={styles.filterGroup}>
                          <ThemedText style={styles.filterLabel}>Contrato</ThemedText>
                          <View style={styles.pickerWrapper}>
                            <Picker
                              enabled={filterDivisionId != null && filterContratoOptionsMemo.length > 0}
                              selectedValue={filterContratoId ?? 0}
                              onValueChange={(v) => {
                                const next = Number(v) || 0;
                                setFilterContratoId(next === 0 ? null : next);
                                setFilterSucursalId(null);
                                setFilterPuestoId(null);
                              }}
                            >
                              <Picker.Item
                                label={filterDivisionId ? 'Seleccione contrato…' : 'Seleccione división primero'}
                                value={0}
                                color="#000000"
                              />
                              {filterContratoOptionsMemo.map((c) => (
                                <Picker.Item key={c.id} label={c.nombre} value={c.id} color="#000000" />
                              ))}
                            </Picker>
                          </View>
                        </ThemedView>

                        <ThemedView style={styles.filterGroup}>
                          <ThemedText style={styles.filterLabel}>Sucursal (corpo)</ThemedText>
                          <View style={styles.pickerWrapper}>
                            <Picker
                              enabled={filterContratoId != null && filterSucursalOptionsMemo.length > 0}
                              selectedValue={filterSucursalId ?? 0}
                              onValueChange={(v) => {
                                const next = Number(v) || 0;
                                const nextSuc = next === 0 ? null : next;
                                setFilterSucursalId(nextSuc);
                                setFilterPuestoId(null);
                                setVoiceNotes([]);
                              }}
                            >
                              <Picker.Item
                                label={filterContratoId ? 'Seleccione sucursal…' : 'Seleccione contrato primero'}
                                value={0}
                                color="#000000"
                              />
                              {filterSucursalOptionsMemo.map((s) => (
                                <Picker.Item key={s.id} label={s.nombre} value={s.id} color="#000000" />
                              ))}
                            </Picker>
                          </View>
                        </ThemedView>

                        <ThemedView style={styles.filterGroup}>
                          <ThemedText style={styles.filterLabel}>Puesto</ThemedText>
                          <View style={styles.pickerWrapper}>
                            <Picker
                              enabled={filterSucursalId != null && filterPuestoOptionsMemo.length > 0}
                              selectedValue={filterPuestoId ?? 0}
                              onValueChange={(v) => {
                                const next = Number(v) || 0;
                                const nextP = next === 0 ? null : next;
                                setFilterPuestoId(nextP);
                                if (filterSucursalId != null && filterSucursalId > 0) {
                                  void refetchVoiceNotesForFilter(filterSucursalId, nextP);
                                }
                              }}
                            >
                              <Picker.Item
                                label={filterSucursalId ? 'Seleccione puesto…' : 'Seleccione sucursal primero'}
                                value={0}
                                color="#000000"
                              />
                              {filterPuestoOptionsMemo.map((p) => (
                                <Picker.Item key={p.id} label={p.nombre} value={p.id} color="#000000" />
                              ))}
                            </Picker>
                          </View>
                        </ThemedView>
                      </>
                    )}
                    </>
                  )}
                  {roleName === 'OPERATIVO' && (
                    <ThemedText style={[styles.hierarchyHint, { marginBottom: 8 }]}>
                      La lista muestra las notas de la sucursal y puesto de tu marca actual; edita los filtros de texto abajo para acotar resultados.
                    </ThemedText>
                  )}
                </>

                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.filterLabel}>Título:</ThemedText>
                  <TextInput
                    style={styles.filterInput}
                    value={filterTitulo}
                    onChangeText={setFilterTitulo}
                    placeholder="Filtrar por título..."
                    placeholderTextColor="#999"
                  />
                </ThemedView>

                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.filterLabel}>Descripción:</ThemedText>
                  <TextInput
                    style={styles.filterInput}
                    value={filterDescripcion}
                    onChangeText={setFilterDescripcion}
                    placeholder="Filtrar por descripción..."
                    placeholderTextColor="#999"
                  />
                </ThemedView>

                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.filterLabel}>Transcripción:</ThemedText>
                  <TextInput
                    style={styles.filterInput}
                    value={filterTranscripcion}
                    onChangeText={setFilterTranscripcion}
                    placeholder="Filtrar por transcripción..."
                    placeholderTextColor="#999"
                  />
                </ThemedView>

                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.filterLabel}>Fecha de creación:</ThemedText>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowFilterCreatedAtPicker(true)}
                  >
                    <ThemedText style={styles.dateButtonText}>
                      {filterCreatedAt ? formatDateForDisplay(filterCreatedAt) : 'Seleccionar fecha'}
                    </ThemedText>
                    <Ionicons name="calendar-outline" size={20} color="#007AFF" />
                  </TouchableOpacity>
                  {filterCreatedAt && (
                    <TouchableOpacity
                      style={styles.clearDateButton}
                      onPress={() => setFilterCreatedAt('')}
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
        {hasMarca && !isCreating && !editingVoiceNote && !isLoading && (
          <TouchableOpacity
            style={styles.createVoiceNoteButton}
            onPress={startCreating}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={22} color="#fff" />
            <ThemedText style={styles.createVoiceNoteButtonText}>Nueva nota de voz</ThemedText>
          </TouchableOpacity>
        )}

        {isCreating && !editingVoiceNote && (
          <ThemedView style={styles.formFrame}>
            <ThemedView style={styles.formContainer}>
            <ThemedText style={styles.formTitle}>Nueva Nota de Voz</ThemedText>

            {/* Título */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.label}>Título *</ThemedText>
              <TextInput
                key={`titulo-${formKey}`}
                style={styles.input}
                placeholder="Ingrese el título"
                placeholderTextColor="#999"
                defaultValue={tituloRef.current}
                onChangeText={(text) => { tituloRef.current = text; }}
              />
            </ThemedView>

            {/* Descripción */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.label}>Descripción *</ThemedText>
              <TextInput
                key={`descripcion-${formKey}`}
                style={[styles.input, styles.textArea]}
                placeholder="Ingrese la descripción"
                placeholderTextColor="#999"
                defaultValue={descripcionRef.current}
                onChangeText={(text) => { descripcionRef.current = text; }}
                multiline
                numberOfLines={4}
              />
            </ThemedView>

            {roleName !== 'OPERATIVO' && structure.length > 0 && (
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.label}>Ubicación (empresa → sucursal) * — puesto opcional</ThemedText>
                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.filterLabel}>Empresa</ThemedText>
                  <View style={styles.pickerWrapper}>
                    <Picker
                      selectedValue={createEmpresaId ?? 0}
                      onValueChange={(v) => {
                        const next = Number(v) || 0;
                        setCreateEmpresaId(next === 0 ? null : next);
                        setCreateClienteId(null);
                        setCreateDivisionId(null);
                        setCreateContratoId(null);
                        setCreateSucursalId(null);
                        setCreatePuestoId(null);
                      }}
                    >
                      <Picker.Item label="Seleccione empresa…" value={0} color="#000000" />
                      {structure.map((e) => (
                        <Picker.Item key={e.id} label={e.nombre} value={e.id} color="#000000" />
                      ))}
                    </Picker>
                  </View>
                </ThemedView>
                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.filterLabel}>Cliente</ThemedText>
                  <View style={styles.pickerWrapper}>
                    <Picker
                      enabled={createEmpresaId != null && createClienteOptionsMemo.length > 0}
                      selectedValue={createClienteId ?? 0}
                      onValueChange={(v) => {
                        const next = Number(v) || 0;
                        setCreateClienteId(next === 0 ? null : next);
                        setCreateDivisionId(null);
                        setCreateContratoId(null);
                        setCreateSucursalId(null);
                        setCreatePuestoId(null);
                      }}
                    >
                      <Picker.Item
                        label={createEmpresaId ? 'Seleccione cliente…' : 'Seleccione empresa primero'}
                        value={0}
                        color="#000000"
                      />
                      {createClienteOptionsMemo.map((c) => (
                        <Picker.Item key={c.id} label={c.nombre} value={c.id} color="#000000" />
                      ))}
                    </Picker>
                  </View>
                </ThemedView>
                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.filterLabel}>División</ThemedText>
                  <View style={styles.pickerWrapper}>
                    <Picker
                      enabled={createClienteId != null && createDivisionOptionsMemo.length > 0}
                      selectedValue={createDivisionId ?? 0}
                      onValueChange={(v) => {
                        const next = Number(v) || 0;
                        setCreateDivisionId(next === 0 ? null : next);
                        setCreateContratoId(null);
                        setCreateSucursalId(null);
                        setCreatePuestoId(null);
                      }}
                    >
                      <Picker.Item
                        label={createClienteId ? 'Seleccione división…' : 'Seleccione cliente primero'}
                        value={0}
                        color="#000000"
                      />
                      {createDivisionOptionsMemo.map((d) => (
                        <Picker.Item key={d.id} label={d.nombre} value={d.id} color="#000000" />
                      ))}
                    </Picker>
                  </View>
                </ThemedView>
                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.filterLabel}>Contrato</ThemedText>
                  <View style={styles.pickerWrapper}>
                    <Picker
                      enabled={createDivisionId != null && createContratoOptionsMemo.length > 0}
                      selectedValue={createContratoId ?? 0}
                      onValueChange={(v) => {
                        const next = Number(v) || 0;
                        setCreateContratoId(next === 0 ? null : next);
                        setCreateSucursalId(null);
                        setCreatePuestoId(null);
                      }}
                    >
                      <Picker.Item
                        label={createDivisionId ? 'Seleccione contrato…' : 'Seleccione división primero'}
                        value={0}
                        color="#000000"
                      />
                      {createContratoOptionsMemo.map((c) => (
                        <Picker.Item key={c.id} label={c.nombre} value={c.id} color="#000000" />
                      ))}
                    </Picker>
                  </View>
                </ThemedView>
                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.filterLabel}>Sucursal (corpo)</ThemedText>
                  <View style={styles.pickerWrapper}>
                    <Picker
                      enabled={createContratoId != null && createSucursalOptionsMemo.length > 0}
                      selectedValue={createSucursalId ?? 0}
                      onValueChange={(v) => {
                        const next = Number(v) || 0;
                        setCreateSucursalId(next === 0 ? null : next);
                        setCreatePuestoId(null);
                      }}
                    >
                      <Picker.Item
                        label={createContratoId ? 'Seleccione sucursal…' : 'Seleccione contrato primero'}
                        value={0}
                        color="#000000"
                      />
                      {createSucursalOptionsMemo.map((s) => (
                        <Picker.Item key={s.id} label={s.nombre} value={s.id} color="#000000" />
                      ))}
                    </Picker>
                  </View>
                </ThemedView>
                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.filterLabel}>Puesto (opcional)</ThemedText>
                  <View style={styles.pickerWrapper}>
                    <Picker
                      enabled={createSucursalId != null && createPuestoOptionsMemo.length > 0}
                      selectedValue={createPuestoId ?? 0}
                      onValueChange={(v) => {
                        const next = Number(v) || 0;
                        setCreatePuestoId(next === 0 ? null : next);
                      }}
                    >
                      <Picker.Item
                        label={createSucursalId ? 'Sin puesto específico' : 'Seleccione sucursal primero'}
                        value={0}
                        color="#000000"
                      />
                      {createPuestoOptionsMemo.map((p) => (
                        <Picker.Item key={p.id} label={p.nombre} value={p.id} color="#000000" />
                      ))}
                    </Picker>
                  </View>
                </ThemedView>
              </ThemedView>
            )}

            {roleName === 'OPERATIVO' && (
              <ThemedView style={styles.formGroup}>
                <ThemedView style={styles.checkboxContainer}>
                  <TouchableOpacity
                    style={[
                      styles.checkbox,
                      setPuesto ? styles.checkboxChecked : styles.checkboxUnchecked
                    ]}
                    onPress={() => setSetPuesto(!setPuesto)}
                  >
                    {setPuesto && (
                      <Ionicons name="checkmark" size={16} color="#000000" />
                    )}
                  </TouchableOpacity>
                  <ThemedText style={styles.checkboxLabel}>Asignar SOLAMENTE al puesto actual</ThemedText>
                </ThemedView>
                {puestoActualNombre ? (
                  <ThemedView style={styles.puestoActualContainer}>
                    <ThemedText style={styles.puestoActualText}>{puestoActualNombre}</ThemedText>
                  </ThemedView>
                ) : null}
              </ThemedView>
            )}

            {/* Audio Recording */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.label}>Grabación de Audio *</ThemedText>

              {!recordedAudioUri && (
                <ThemedView style={styles.recordingControls}>
                  {!recorderState.isRecording ? (
                    <TouchableOpacity
                      style={styles.recordButton}
                      onPress={startRecording}
                    >
                      <ThemedText style={styles.recordButtonText}>
                        {getActionIcon('microphone')} Iniciar Grabación
                      </ThemedText>
                    </TouchableOpacity>
                  ) : (
                    <ThemedView style={styles.recordingActiveContainer}>
                      <TouchableOpacity
                        style={styles.stopButton}
                        onPress={stopRecording}
                      >
                        <ThemedText style={styles.stopButtonText}>
                          {getActionIcon('stop')} Detener Grabación
                        </ThemedText>
                      </TouchableOpacity>
                      <ThemedText style={styles.recordingTime}>
                        {formatTime((recorderState.durationMillis || 0) / 1000)}
                      </ThemedText>
                    </ThemedView>
                  )}
                </ThemedView>
              )}

              {recordedAudioUri && (
                <ThemedView style={styles.audioPreview}>
                  <ThemedText style={styles.audioPreviewLabel}>Audio grabado:</ThemedText>
                  <ThemedView style={styles.audioControls}>
                    <TouchableOpacity
                      style={styles.playButton}
                      onPress={playRecordedAudio}
                    >
                      {getActionIcon(recordedPlayerStatus.playing ? 'pause' : 'play')}
                    </TouchableOpacity>
                    <ThemedText style={styles.audioDuration}>
                      {formatTime(recordedPlayerStatus.currentTime || 0)} / {formatTime(recordedPlayerStatus.duration || 0)}
                    </ThemedText>
                    <TouchableOpacity
                      style={styles.resetRecordedButton}
                      onPress={resetRecordedAudio}
                    >
                      {getActionIcon('restart')}
                    </TouchableOpacity>
                  </ThemedView>
                  <ThemedView style={styles.recordedAudioActions}>
                    <TouchableOpacity
                      style={styles.restartButton}
                      onPress={restartRecording}
                    >
                      {getActionIcon('clear')}
                    </TouchableOpacity>
                  </ThemedView>
                </ThemedView>
              )}
            </ThemedView>

            {/* Firma del responsable */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.label}>Firma del Responsable *</ThemedText>

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
                        {firmaResponsable.empleadoDetalle.nombre} {firmaResponsable.empleadoDetalle.primer_apellido} {firmaResponsable.empleadoDetalle.segundo_apellido}
                      </ThemedText>
                    </ThemedView>
                  )}
                  <ThemedText style={styles.signatureInfoText}>Latitud: {firmaResponsable.latitud}</ThemedText>
                  <ThemedText style={styles.signatureInfoText}>Longitud: {firmaResponsable.longitud}</ThemedText>
                  <ThemedText style={styles.signatureInfoText}>Hora actual: {generateDateTime(new Date(parseInt(firmaResponsable.timestamp)).toISOString())}</ThemedText>
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
                style={[styles.formActionBtn, styles.formCancelBtn, isSubmittingCreate && styles.buttonDisabled]}
                onPress={cancelCreating}
                disabled={isSubmittingCreate}
                activeOpacity={0.85}
              >
                <Ionicons name="close" size={18} color="#000" />
                <ThemedText style={styles.formCancelBtnText}>Cancelar</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.formActionBtn, styles.formSaveBtn, isSubmittingCreate && styles.buttonDisabled]}
                onPress={handleCreateVoiceNote}
                disabled={isSubmittingCreate}
                activeOpacity={0.85}
              >
                {isSubmittingCreate ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={18} color="#fff" />
                    <ThemedText style={styles.formSaveBtnText}>Aceptar</ThemedText>
                  </>
                )}
              </TouchableOpacity>
            </ThemedView>
          </ThemedView>
          </ThemedView>
        )}

        {editingVoiceNote && !isCreating && (
          <ThemedView style={styles.formFrame}>
            <ThemedView style={styles.formContainer}>
              <ThemedText style={styles.formTitle}>Modificar nota</ThemedText>

              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.label}>Título *</ThemedText>
                <TextInput
                  key={`edit-titulo-${editFormKey}`}
                  style={styles.input}
                  placeholder="Ingrese el título"
                  placeholderTextColor="#999"
                  defaultValue={editTituloRef.current}
                  onChangeText={(t) => { editTituloRef.current = t; }}
                />
              </ThemedView>

              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.label}>Descripción *</ThemedText>
                <TextInput
                  key={`edit-desc-${editFormKey}`}
                  style={[styles.input, styles.textArea]}
                  placeholder="Ingrese la descripción"
                  placeholderTextColor="#999"
                  defaultValue={editDescripcionRef.current}
                  onChangeText={(t) => { editDescripcionRef.current = t; }}
                  multiline
                  numberOfLines={4}
                />
              </ThemedView>

              {roleName !== 'OPERATIVO' && structure.length > 0 && (
                <ThemedView style={styles.formGroup}>
                  <ThemedText style={styles.label}>Ubicación (empresa → sucursal) * — puesto opcional</ThemedText>
                  <ThemedView style={styles.filterGroup}>
                    <ThemedText style={styles.filterLabel}>Empresa</ThemedText>
                    <View style={styles.pickerWrapper}>
                      <Picker
                        selectedValue={editEmpresaId ?? 0}
                        onValueChange={(v) => {
                          const next = Number(v) || 0;
                          setEditEmpresaId(next === 0 ? null : next);
                          setEditClienteId(null);
                          setEditDivisionId(null);
                          setEditContratoId(null);
                          setEditSucursalId(null);
                          setEditPuestoId(null);
                        }}
                      >
                        <Picker.Item label="Seleccione empresa…" value={0} color="#000000" />
                        {structure.map((e) => (
                          <Picker.Item key={e.id} label={e.nombre} value={e.id} color="#000000" />
                        ))}
                      </Picker>
                    </View>
                  </ThemedView>
                  <ThemedView style={styles.filterGroup}>
                    <ThemedText style={styles.filterLabel}>Cliente</ThemedText>
                    <View style={styles.pickerWrapper}>
                      <Picker
                        enabled={editEmpresaId != null && editClienteOptionsMemo.length > 0}
                        selectedValue={editClienteId ?? 0}
                        onValueChange={(v) => {
                          const next = Number(v) || 0;
                          setEditClienteId(next === 0 ? null : next);
                          setEditDivisionId(null);
                          setEditContratoId(null);
                          setEditSucursalId(null);
                          setEditPuestoId(null);
                        }}
                      >
                        <Picker.Item
                          label={editEmpresaId ? 'Seleccione cliente…' : 'Seleccione empresa primero'}
                          value={0}
                          color="#000000"
                        />
                        {editClienteOptionsMemo.map((c) => (
                          <Picker.Item key={c.id} label={c.nombre} value={c.id} color="#000000" />
                        ))}
                      </Picker>
                    </View>
                  </ThemedView>
                  <ThemedView style={styles.filterGroup}>
                    <ThemedText style={styles.filterLabel}>División</ThemedText>
                    <View style={styles.pickerWrapper}>
                      <Picker
                        enabled={editClienteId != null && editDivisionOptionsMemo.length > 0}
                        selectedValue={editDivisionId ?? 0}
                        onValueChange={(v) => {
                          const next = Number(v) || 0;
                          setEditDivisionId(next === 0 ? null : next);
                          setEditContratoId(null);
                          setEditSucursalId(null);
                          setEditPuestoId(null);
                        }}
                      >
                        <Picker.Item
                          label={editClienteId ? 'Seleccione división…' : 'Seleccione cliente primero'}
                          value={0}
                          color="#000000"
                        />
                        {editDivisionOptionsMemo.map((d) => (
                          <Picker.Item key={d.id} label={d.nombre} value={d.id} color="#000000" />
                        ))}
                      </Picker>
                    </View>
                  </ThemedView>
                  <ThemedView style={styles.filterGroup}>
                    <ThemedText style={styles.filterLabel}>Contrato</ThemedText>
                    <View style={styles.pickerWrapper}>
                      <Picker
                        enabled={editDivisionId != null && editContratoOptionsMemo.length > 0}
                        selectedValue={editContratoId ?? 0}
                        onValueChange={(v) => {
                          const next = Number(v) || 0;
                          setEditContratoId(next === 0 ? null : next);
                          setEditSucursalId(null);
                          setEditPuestoId(null);
                        }}
                      >
                        <Picker.Item
                          label={editDivisionId ? 'Seleccione contrato…' : 'Seleccione división primero'}
                          value={0}
                          color="#000000"
                        />
                        {editContratoOptionsMemo.map((c) => (
                          <Picker.Item key={c.id} label={c.nombre} value={c.id} color="#000000" />
                        ))}
                      </Picker>
                    </View>
                  </ThemedView>
                  <ThemedView style={styles.filterGroup}>
                    <ThemedText style={styles.filterLabel}>Sucursal (corpo)</ThemedText>
                    <View style={styles.pickerWrapper}>
                      <Picker
                        enabled={editContratoId != null && editSucursalOptionsMemo.length > 0}
                        selectedValue={editSucursalId ?? 0}
                        onValueChange={(v) => {
                          const next = Number(v) || 0;
                          setEditSucursalId(next === 0 ? null : next);
                          setEditPuestoId(null);
                        }}
                      >
                        <Picker.Item
                          label={editContratoId ? 'Seleccione sucursal…' : 'Seleccione contrato primero'}
                          value={0}
                          color="#000000"
                        />
                        {editSucursalOptionsMemo.map((s) => (
                          <Picker.Item key={s.id} label={s.nombre} value={s.id} color="#000000" />
                        ))}
                      </Picker>
                    </View>
                  </ThemedView>
                  <ThemedView style={styles.filterGroup}>
                    <ThemedText style={styles.filterLabel}>Puesto (opcional)</ThemedText>
                    <View style={styles.pickerWrapper}>
                      <Picker
                        enabled={editSucursalId != null && editPuestoOptionsMemo.length > 0}
                        selectedValue={editPuestoId ?? 0}
                        onValueChange={(v) => {
                          const next = Number(v) || 0;
                          setEditPuestoId(next === 0 ? null : next);
                        }}
                      >
                        <Picker.Item
                          label={editSucursalId ? 'Sin puesto específico' : 'Seleccione sucursal primero'}
                          value={0}
                          color="#000000"
                        />
                        {editPuestoOptionsMemo.map((p) => (
                          <Picker.Item key={p.id} label={p.nombre} value={p.id} color="#000000" />
                        ))}
                      </Picker>
                    </View>
                  </ThemedView>
                </ThemedView>
              )}

              {roleName === 'OPERATIVO' && (
                <ThemedView style={styles.formGroup}>
                  <ThemedView style={styles.checkboxContainer}>
                    <TouchableOpacity
                      style={[
                        styles.checkbox,
                        editSetPuesto ? styles.checkboxChecked : styles.checkboxUnchecked,
                      ]}
                      onPress={() => setEditSetPuesto(!editSetPuesto)}
                    >
                      {editSetPuesto && (
                        <Ionicons name="checkmark" size={16} color="#000000" />
                      )}
                    </TouchableOpacity>
                    <ThemedText style={styles.checkboxLabel}>Asignar al puesto actual</ThemedText>
                  </ThemedView>
                  {puestoActualNombre ? (
                    <ThemedView style={styles.puestoActualContainer}>
                      <ThemedText style={styles.puestoActualText}>{puestoActualNombre}</ThemedText>
                    </ThemedView>
                  ) : null}
                </ThemedView>
              )}

              <ThemedView style={styles.formActions}>
                <TouchableOpacity
                  style={[styles.formActionBtn, styles.formCancelBtn, isSubmittingEdit && styles.buttonDisabled]}
                  onPress={closeEditVoiceNote}
                  disabled={isSubmittingEdit}
                  activeOpacity={0.85}
                >
                  <Ionicons name="close" size={18} color="#000" />
                  <ThemedText style={styles.formCancelBtnText}>Cancelar</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.formActionBtn, styles.formSaveBtn, isSubmittingEdit && styles.buttonDisabled]}
                  onPress={handleUpdateVoiceNote}
                  disabled={isSubmittingEdit}
                  activeOpacity={0.85}
                >
                  {isSubmittingEdit ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={18} color="#fff" />
                      <ThemedText style={styles.formSaveBtnText}>Aceptar</ThemedText>
                    </>
                  )}
                </TouchableOpacity>
              </ThemedView>
            </ThemedView>
          </ThemedView>
        )}

        {/* Voice Notes List (oculto mientras isLoading) */}
        {hasMarca && !isCreating && !editingVoiceNote && isLoading && (
          <ThemedView style={styles.listLoadingArea}>
            <ActivityIndicator size="large" color="#007AFF" />
            <ThemedText style={styles.listLoadingText}>Cargando notas…</ThemedText>
          </ThemedView>
        )}

        {hasMarca && !isCreating && !editingVoiceNote && !isLoading && filteredVoiceNotes.length > 0 && (
          <ThemedView style={styles.listContainer}>
            {filteredVoiceNotes.map((voiceNote, index) => {
              // Create unique key for each voice note (handles offline notes with id: 0)
              const voiceNoteKey = voiceNote.id !== 0 ? `voicenote-${voiceNote.id}` : (voiceNote.id_local || `voicenote-${index}`);
              const key = getUniqueKey(voiceNote);

              const isExpanded = expandedVoiceNotes.has(key);
              const isPlaying = playingStates.get(key) || false;
              const duration = audioDurations.get(key) || 0;
              const position = audioPositions.get(key) || 0;

              // Decode firma
              let firmaData = null;
              try {
                const decodedHash = atob(voiceNote.firma_responsable);
                const [sessionId, empleadoId, latitud, longitud, timestamp] = decodedHash.split(':');
                firmaData = {
                  sessionId,
                  empleadoId,
                  latitud,
                  longitud,
                  timestamp,
                };
              } catch (error) {
                console.error('Error decoding signature:', error);
              }

              return (
                <ThemedView key={voiceNoteKey} style={styles.voiceNoteCard}>
                  <ThemedView style={styles.voiceNoteHeader}>
                    <ThemedText style={styles.voiceNoteTitle}>{voiceNote.titulo}</ThemedText>
                  </ThemedView>

                  <ThemedText style={styles.voiceNoteDetail}>
                    <ThemedText style={styles.voiceNoteLabel}>Empresa: </ThemedText>
                    {voiceNote.empresa.nombre}
                  </ThemedText>

                  <ThemedText style={styles.voiceNoteDetail}>
                    <ThemedText style={styles.voiceNoteLabel}>Cliente: </ThemedText>
                    {voiceNote.cliente.nombre}
                  </ThemedText>

                  <ThemedText style={styles.voiceNoteDetail}>
                    <ThemedText style={styles.voiceNoteLabel}>Corpo: </ThemedText>
                    {voiceNote.corpo.nombre}
                  </ThemedText>

                  {voiceNote.puesto && (
                    <ThemedText style={styles.voiceNoteDetail}>
                      <ThemedText style={styles.voiceNoteLabel}>Puesto: </ThemedText>
                      {voiceNote.puesto.nombre}
                    </ThemedText>
                  )}

                  <ThemedText style={styles.voiceNoteDetail}>
                    <ThemedText style={styles.voiceNoteLabel}>Descripción: </ThemedText>
                    {voiceNote.descripcion}
                  </ThemedText>

                  <ThemedText style={styles.voiceNoteDetail}>
                    <ThemedText style={styles.voiceNoteLabel}>Creado por: </ThemedText>
                    {voiceNote.nombre_creator}
                  </ThemedText>

                  <ThemedText style={styles.voiceNoteDetail}>
                    <ThemedText style={styles.voiceNoteLabel}>Creado el: </ThemedText>
                    {generateDateTime(voiceNote.created_at)}
                  </ThemedText>

                  {/* Collapsable Button - Audio */}
                  <TouchableOpacity
                    style={styles.collapseButton}
                    onPress={() => toggleVoiceNoteExpanded(voiceNote)}
                  >
                    <ThemedText style={styles.collapseButtonText}>
                      {isExpanded ? 'Ocultar Audio' : 'Ver Audio'}
                    </ThemedText>
                    <Ionicons
                      name={isExpanded ? "chevron-up" : "chevron-down"}
                      size={20}
                      color="#007AFF"
                    />
                  </TouchableOpacity>

                  {/* Collapsable Content - Audio and Transcription */}
                  {isExpanded && (
                    <ThemedView style={styles.collapsableContent}>
                      {loadingAudioUris.has(key) && (
                        <ThemedView style={styles.loadingAudioRow}>
                          <ActivityIndicator size="small" color="#007AFF" />
                          <ThemedText style={styles.loadingAudioText}>Cargando audio…</ThemedText>
                        </ThemedView>
                      )}
                      {/* Firma (dentro del colapsable) */}
                      {firmaData && (
                        <ThemedView style={styles.signatureInfo}>
                            <ThemedText style={styles.signatureInfoTitle}>Firma:</ThemedText>
                            {voiceNote.nombre_firma ? (
                              <ThemedText style={styles.signatureInfoText}>
                                <ThemedText style={styles.voiceNoteLabel}>Responsable: </ThemedText>
                                {voiceNote.nombre_firma}
                              </ThemedText>
                            ) : null}
                            <ThemedText style={styles.signatureInfoText}>ID de sesión: {firmaData.sessionId}</ThemedText>
                            <ThemedText style={styles.signatureInfoText}>ID del empleado: {firmaData.empleadoId}</ThemedText>
                            <ThemedText style={styles.signatureInfoText}>Latitud: {firmaData.latitud}</ThemedText>
                            <ThemedText style={styles.signatureInfoText}>Longitud: {firmaData.longitud}</ThemedText>
                            <ThemedText style={styles.signatureInfoText}>Hora: {generateDateTime(new Date(parseInt(firmaData.timestamp)).toISOString())}</ThemedText>
                          </ThemedView>
                      )}

                      {/* Audio Player */}
                      {audioUris.has(key) && (
                        <>
                          <VoiceNoteAudioPlayer
                            audioUri={audioUris.get(key)!}
                            isPlaying={isPlaying}
                            shouldReset={resetFlags.get(key) || false}
                            onStatusUpdate={(dur, pos, playing) => {
                              // Actualizar estados con valores en segundos
                              setAudioDurations(prev => {
                                const newMap = new Map(prev);
                                newMap.set(key, dur);
                                return newMap;
                              });
                              setAudioPositions(prev => {
                                const newMap = new Map(prev);
                                newMap.set(key, pos);
                                return newMap;
                              });
                              setPlayingStates(prev => {
                                const newMap = new Map(prev);
                                newMap.set(key, playing);
                                return newMap;
                              });
                            }}
                          />
                          <ThemedView style={styles.audioPlayerContainer}>
                            <ThemedView style={styles.audioPlayer}>
                              <TouchableOpacity
                                style={styles.playButton}
                                onPress={() => {
                                  const audioUri = audioUris.get(key);
                                  if (audioUri) {
                                    // Toggle play/pause through state
                                    playVoiceNoteAudio(voiceNote);
                                  }
                                }}
                              >
                                {getActionIcon(isPlaying ? 'pause' : 'play')}
                              </TouchableOpacity>
                              <ThemedText style={styles.audioTime}>
                                {formatTime(position || 0)} / {formatTime(duration || 0)}
                              </ThemedText>
                              <TouchableOpacity
                                style={styles.resetAudioButton}
                                onPress={() => resetVoiceNoteAudio(voiceNote)}
                              >
                                {getActionIcon('restart')}
                              </TouchableOpacity>
                            </ThemedView>
                          </ThemedView>
                        </>
                      )}

                      {/* Transcription */}
                      {voiceNote.transcripcion && (
                        <>
                          <ThemedText style={styles.transcriptionTitle}>Transcripción:</ThemedText>
                          <ThemedText style={styles.transcriptionText}>{voiceNote.transcripcion}</ThemedText>
                        </>
                      )}
                    </ThemedView>
                  )}

                  {voiceNote.created_by === (employee?.id || 0) && (
                    <ThemedView style={styles.listItemButtons}>
                      <TouchableOpacity
                        style={[
                          styles.listItemButton,
                          styles.deleteButton,
                          deletingKey !== null && styles.buttonDisabled,
                        ]}
                        onPress={() => deleteVoiceNote(voiceNote)}
                        disabled={deletingKey !== null}
                        activeOpacity={0.85}
                      >
                        {deletingKey === key ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Ionicons name="trash" size={18} color="#FFFFFF" />
                        )}
                      </TouchableOpacity>
                    </ThemedView>
                  )}
                </ThemedView>
              );
            })}
          </ThemedView>
        )}

        {hasMarca && !isCreating && !editingVoiceNote && !isLoading && filteredVoiceNotes.length === 0 && voiceNotes.length > 0 && (
          <ThemedView style={styles.emptyContainer}>
            <ThemedText style={styles.emptyText}>No se encontraron notas de voz con los filtros aplicados</ThemedText>
          </ThemedView>
        )}

        {hasMarca && !isCreating && !editingVoiceNote && !isLoading && voiceNotes.length === 0 && (
          <ThemedView style={styles.emptyContainer}>
            <ThemedText style={styles.emptyText}>No hay notas de voz registradas</ThemedText>
          </ThemedView>
        )}
      </ScrollView>

      <AppFooter />
      <SlideMenu
        isVisible={isMenuVisible}
        onClose={handleMenuClose}
        onHomePress={handleHomePress}
        currentRoute="VoiceNotes"
      />

      {QRScannerComponent}

      {showFilterCreatedAtPicker && (
        <DateTimePicker
          value={filterCreatedAt ? new Date(filterCreatedAt) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => {
            setShowFilterCreatedAtPicker(Platform.OS === 'ios');
            if (selectedDate) {
              const year = selectedDate.getFullYear();
              const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
              const day = String(selectedDate.getDate()).padStart(2, '0');
              setFilterCreatedAt(`${year}-${month}-${day}`);
            }
          }}
        />
      )}
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
  scrollViewContent: {
    padding: 16,
  },
  listLoadingArea: {
    minHeight: 160,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  listLoadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
  titleContainer: {
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  createVoiceNoteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  createVoiceNoteButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  formFrame: {
    marginBottom: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  formContainer: {
    backgroundColor: '#fff',
    padding: 16,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#007AFF',
  },
  formGroup: {
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#000000',
  },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000000',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  checkboxContainer: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#34C759',
    borderColor: '#34C759',
  },
  checkboxUnchecked: {
    backgroundColor: '#fff',
    borderColor: '#E0E0E0',
  },
  checkboxLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
  },
  puestoActualText: {
    fontSize: 14,
    color: '#666',
  },
  puestoActualContainer: {
    marginTop: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DDD',
  },
  recordingControls: {
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  recordButton: {
    backgroundColor: '#FF3B30',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  recordButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  recordingActiveContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
  },
  stopButton: {
    backgroundColor: '#FF3B30',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
  },
  stopButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  recordingTime: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF3B30',
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  audioPreview: {
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  audioPreviewLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#000000',
  },
  audioControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  playButton: {
    padding: 8,
  },
  audioDuration: {
    fontSize: 16,
    fontWeight: '500',
    color: '#007AFF',
    flex: 1,
  },
  recordedAudioActions: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-start',
    backgroundColor: '#fff',
  },
  resetRecordedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderRadius: 8,
    gap: 4,
  },
  resetRecordedButtonText: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: '600',
  },
  restartButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    backgroundColor: '#FF9500',
    borderRadius: 8,
    gap: 8,
  },
  restartButtonText: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: '600',
    marginLeft: 4,
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
    marginTop: 16,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    backgroundColor: '#fff',
  },
  formActionBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  formCancelBtn: {
    backgroundColor: '#EDEDED',
  },
  formCancelBtnText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 15,
  },
  formSaveBtn: {
    backgroundColor: '#007AFF',
  },
  formSaveBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  hierarchyHint: {
    fontSize: 13,
    opacity: 0.75,
    marginBottom: 8,
    color: '#000',
  },
  inlineLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  inlineLoaderText: {
    fontSize: 14,
    color: '#000',
  },
  listItemButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    marginBottom: 0,
    backgroundColor: '#fff',
  },
  listItemButton: {
    flex: 1,
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButton: {
    backgroundColor: '#007AFF',
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
  },
  listContainer: {
    gap: 16,
  },
  voiceNoteCard: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#fff',
  },
  voiceNoteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  voiceNoteTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    color: '#007AFF',
    paddingRight: 8,
  },
  voiceNoteDetail: {
    fontSize: 14,
    marginBottom: 8,
    color: '#666',
  },
  voiceNoteLabel: {
    fontWeight: '600',
    color: '#000000',
  },
  audioPlayerContainer: {
    marginVertical: 12,
    backgroundColor: '#fff',
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
    gap: 4,
  },
  resetAudioButtonText: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: '600',
  },
  collapseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#E8F4FF',
    borderRadius: 8,
    marginTop: 8,
    gap: 8,
  },
  collapseButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  loadingAudioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  loadingAudioText: {
    fontSize: 14,
    color: '#007AFF',
  },
  collapsableContent: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  transcriptionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000000',
  },
  transcriptionText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#666',
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
  },
  filtersTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
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
  filtersContent: {
    padding: 16,
    gap: 16,
    backgroundColor: '#fff',
  },
  filterGroup: {
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  filterInput: {
    width: '100%',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: '#F9F9F9',
    color: '#000000',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#000000',
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
});

