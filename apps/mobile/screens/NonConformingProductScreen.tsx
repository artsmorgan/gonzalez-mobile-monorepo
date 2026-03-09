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
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Network from 'expo-network';
import * as DocumentPicker from 'expo-document-picker';
import * as Location from 'expo-location';
import DateTimePicker from '@react-native-community/datetimepicker';
import SignatureScreen from 'react-native-signature-canvas';
import { Picker } from '@react-native-picker/picker';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import { jwtDecode } from 'jwt-decode';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';

import AppHeader from '@/components/AppHeader';
import AppFooter from '@/components/AppFooter';
import SlideMenu from '@/components/SlideMenu';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { formatDateDMY } from '@/utils/formatDate';
import { useAuth } from '@/contexts/AuthContext';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';
import { eventBus } from '@/hooks/eventBus';
import getHoraAccion from '@/hooks/getHoraAccion';
import authedFetch from '@/hooks/authedFetch';
import { useQRScanner } from '@/hooks/useQRScanner';
import { createNonConformingProduct, deleteNonConformingProduct, listNonConformingProductByCorpo, updateNonConformingProduct } from '@/hooks/evaluationFunctions';

type Nav = NativeStackNavigationProp<RootStackParamList, 'NonConformingProduct'>;

type MainStructureSucursalNode = { id: number; nombre: string };
type MainStructureContratoNode = { id: number; nombre: string; sucursales: MainStructureSucursalNode[] };
type MainStructureDivisionNode = { id: number; nombre: string; contratos: MainStructureContratoNode[] };
type MainStructureClienteNode = { id: number; nombre: string; division: MainStructureDivisionNode[] };
type MainStructureEmpresaNode = { id: number; nombre: string; clientes: MainStructureClienteNode[] };
type MainStructureTree = MainStructureEmpresaNode[];
type TipoProductoNoConforme = { id: number; nombre: string };

type LocalFile = {
  id: string;
  type: 'image' | 'audio' | 'video' | 'document';
  name: string;
  extension: string;
  base64: string;
  mimeType?: string;
};

type PncFile = {
  id?: number;
  id_local?: string;
  type: 'image' | 'audio' | 'video' | 'document' | string;
  extension: string;
  name: string;
  original_name?: string;
  base64?: string;
  mimeType?: string;
};

type PncRecord = {
  id: number | string;
  id_local: string;
  cliente_id: number;
  corpo_id: number;
  fecha_identificacion: string;
  responsable_cuenta: string;
  tipo_servicio_no_conforme: string;
  persona_identifico_pnc: string;
  firma_persona_identifico_pnc: string;
  descripcion: string;
  persona_origino_pnc: string;
  firma_persona_origino_pnc: string;
  accion_implementada: string;
  fecha_solucion: string;
  responsable_aprobar: string;
  firma_responsable: string;
  created_at: string;
  files?: PncFile[];
  synced?: boolean;
  type?: string; // cache marker
};

const guessMimeType = (file: { type?: string; extension?: string; mimeType?: string }) => {
  if (file.mimeType) return file.mimeType;
  const ext = String(file.extension || '').replace('.', '').toLowerCase();
  const t = String(file.type || '').toLowerCase();
  if (t === 'image') return `image/${ext || 'jpeg'}`;
  if (t === 'audio') return `audio/${ext || 'mpeg'}`;
  if (t === 'video') return `video/${ext || 'mp4'}`;
  if (t === 'document') {
    if (ext === 'pdf') return 'application/pdf';
    if (ext === 'csv') return 'text/csv';
    if (ext === 'txt') return 'text/plain';
    return `application/${ext || 'octet-stream'}`;
  }
  return 'application/octet-stream';
};

type FirmaData = {
  sessionId: string;
  empleadoId: string;
  latitud: string;
  longitud: string;
  timestamp: string;
};

const dateToLocalString = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatDateForDisplay = (d: Date): string => {
  const ymd = dateToLocalString(d);
  const [y, m, day] = ymd.split('-');
  return `${day}-${m}-${y}`;
};

const getBase64Only = (value: string | null | undefined): string => {
  if (!value) return '';
  const s = String(value);
  if (s.startsWith('data:')) {
    const parts = s.split(',');
    return parts.length > 1 ? parts.slice(1).join(',') : '';
  }
  return s;
};

const formatSignatureForDisplay = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const s = String(value);
  if (s.startsWith('data:')) return s;
  return `data:image/png;base64,${s}`;
};

const formatFirmaDateLabel = (timestamp: string | undefined): string => {
  if (!timestamp) return '';
  const ms = Number(timestamp);
  if (!Number.isFinite(ms)) return String(timestamp);
  const d = new Date(ms);
  const date = d.toISOString().split('T')[0];
  const time = d.toISOString().split('T')[1]?.split('.')[0] ?? '';
  return `${date} ${time}`;
};

const decodeFirmaHash = (hash?: string | null) => {
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

export default function NonConformingProductScreen() {
  const navigation = useNavigation<Nav>();
  const { employee, refreshAccessToken, logout, accessToken } = useAuth();
  const { scanQR, QRScannerComponent } = useQRScanner();
  const appendTokenToUrl = (url: string) => {
    if (!url) return '';
    if (!accessToken || accessToken.trim().length === 0) return url;
    if (/[?&]token=/.test(url)) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}token=${encodeURIComponent(accessToken)}`;
  };

  const [isMenuVisible, setIsMenuVisible] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasCurrentMarca, setHasCurrentMarca] = useState(true);
  const [marcaDivisionId, setMarcaDivisionId] = useState<number | null>(null);
  const [marcaCorpoId, setMarcaCorpoId] = useState<number | null>(null);
  const [marcaClienteId, setMarcaClienteId] = useState<number | null>(null);

  // estructura
  const [structure, setStructure] = useState<MainStructureTree>([]);
  const [isStructureLoading, setIsStructureLoading] = useState(false);
  const [tiposProductoNoConforme, setTiposProductoNoConforme] = useState<TipoProductoNoConforme[]>([]);

  const [selectedEmpresaId, setSelectedEmpresaId] = useState<number | null>(null);
  const [selectedClienteId, setSelectedClienteId] = useState<number | null>(null);
  const [selectedDivisionId, setSelectedDivisionId] = useState<number | null>(null);
  const [selectedContratoId, setSelectedContratoId] = useState<number | null>(null);
  const [selectedSucursalId, setSelectedSucursalId] = useState<number | null>(null);

  // lista
  const [records, setRecords] = useState<PncRecord[]>([]);
  // Collapsable por tarjeta (similar a MutuosAcuerdosScreen)
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Modal: ver cambios (auditoría)
  const [isCambiosModalVisible, setIsCambiosModalVisible] = useState(false);
  const [cambiosTitle, setCambiosTitle] = useState<string>('Cambios');
  const [cambiosItems, setCambiosItems] = useState<any[]>([]);
  const [expandedCambioId, setExpandedCambioId] = useState<number | null>(null);

  // crear/editar
  const [isCreating, setIsCreating] = useState(false);
  const [editing, setEditing] = useState<{ id: number | string; id_local?: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResponse, setSubmitResponse] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // form
  const [fechaIdentificacion, setFechaIdentificacion] = useState<Date>(new Date());
  const [showFechaIdentPicker, setShowFechaIdentPicker] = useState(false);
  const [fechaSolucion, setFechaSolucion] = useState<Date>(new Date());
  const [showFechaSolPicker, setShowFechaSolPicker] = useState(false);

  const [responsableCuenta, setResponsableCuenta] = useState('');
  const [tipoServicioNoConforme, setTipoServicioNoConforme] = useState('');
  const [personaIdentifico, setPersonaIdentifico] = useState('');
  const [firmaPersonaIdentifico, setFirmaPersonaIdentifico] = useState<string>('');
  const [descripcion, setDescripcion] = useState('');
  const [personaOrigino, setPersonaOrigino] = useState('');
  const [firmaPersonaOrigino, setFirmaPersonaOrigino] = useState<string>('');
  const [accionImplementada, setAccionImplementada] = useState('');
  const [responsableAprobar, setResponsableAprobar] = useState('');

  // firma responsable (QR/generar)
  const [firmaResponsable, setFirmaResponsable] = useState<FirmaData | null>(null);
  const [isGeneratingFirma, setIsGeneratingFirma] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  // adjuntos
  const [imageFiles, setImageFiles] = useState<LocalFile[]>([]);
  const [audioFiles, setAudioFiles] = useState<LocalFile[]>([]);
  const [videoFiles, setVideoFiles] = useState<LocalFile[]>([]);
  const [documentFiles, setDocumentFiles] = useState<LocalFile[]>([]);

  // modal firma dibujada
  const [signatureModalVisible, setSignatureModalVisible] = useState(false);
  const signatureRef = useRef<any>(null);
  const [signatureKey, setSignatureKey] = useState(0);
  const [signatureTarget, setSignatureTarget] = useState<'identifico' | 'origino' | null>(null);

  const signatureWebStyle = `
    .m-signature-pad { box-shadow: none; border: none; }
    .m-signature-pad--body { border: 1px solid #E0E0E0; background: #FFFFFF; }
    .m-signature-pad--footer { display: none; margin: 0px; }
    body,html { width: 100%; height: 100%; }
    canvas { background: #FFFFFF; }
  `;

  const getConnectionStatus = async (): Promise<boolean> => {
    try {
      const state = await Network.getNetworkStateAsync();
      return !!(state.isConnected && state.isInternetReachable);
    } catch {
      return false;
    }
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

  const loadMarcaContext = async () => {
    const currentMarcaStr = await AsyncStorage.getItem('current_marca');
    if (!currentMarcaStr) {
      setHasCurrentMarca(false);
      setMarcaDivisionId(null);
      setMarcaCorpoId(null);
      setMarcaClienteId(null);
      return null;
    }
    try {
      const current = JSON.parse(currentMarcaStr);
      if (!current) {
        setHasCurrentMarca(false);
        return null;
      }
      setHasCurrentMarca(true);
      const divIdRaw = current?.roleDivision?.division?.id;
      const corpoIdRaw = current?.corpo?.id ?? current?.corpo_id;
      const clienteIdRaw = current?.cliente?.id ?? current?.cliente_id;
      setMarcaDivisionId(divIdRaw !== undefined && divIdRaw !== null ? Number(divIdRaw) : null);
      setMarcaCorpoId(corpoIdRaw !== undefined && corpoIdRaw !== null ? Number(corpoIdRaw) : null);
      setMarcaClienteId(clienteIdRaw !== undefined && clienteIdRaw !== null ? Number(clienteIdRaw) : null);
      return current;
    } catch {
      setHasCurrentMarca(false);
      setMarcaDivisionId(null);
      setMarcaCorpoId(null);
      setMarcaClienteId(null);
      return null;
    }
  };

  const fetchMainStructure = useCallback(async () => {
    setIsStructureLoading(true);
    try {
      const cacheStr = await AsyncStorage.getItem('main_structure_cache');
      if (cacheStr) {
        try {
          const parsed = JSON.parse(cacheStr);
          if (Array.isArray(parsed)) setStructure(parsed);
          else setStructure([]);
        } catch {
          // ignore
          setStructure([]);
        }
      }

      /*
      const isConnected = await getConnectionStatus();
      if (!isConnected) return;

      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) return;

      const response = await authedFetch({
        url: `${apiUrl}/api/main-structure`,
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
      if (!response.ok) return;
      const data = await response.json().catch(() => ({}));
      const incoming = data?.structure;
      if (data?.status && Array.isArray(incoming)) {
        setStructure(incoming);
        await AsyncStorage.setItem('main_structure_cache', JSON.stringify(incoming));
      }
      */
    } catch (e) {
      console.error('Error fetching main structure (PNC):', e);
    } finally {
      setIsStructureLoading(false);
    }
  }, [refreshAccessToken, logout]);

  const fetchTiposProductoNoConforme = useCallback(async () => {
    try {
      const cacheStr = await AsyncStorage.getItem('tipos_producto_no_conforme_cache');
      if (cacheStr) {
        try {
          const parsed = JSON.parse(cacheStr);
          if (Array.isArray(parsed)) setTiposProductoNoConforme(parsed);
        } catch {
          // ignore
        }
      }

      const isConnected = await getConnectionStatus();
      if (!isConnected) return;

      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) return;

      const response = await authedFetch({
        url: `${apiUrl}/api/non-conforming-product/types`,
        init: {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        },
        refreshAccessToken,
        logout,
      });

      if (!response || !response.ok) return;
      const data = await response.json().catch(() => ({}));
      const incoming = Array.isArray(data?.data) ? data.data : [];

      if (data?.status) {
        setTiposProductoNoConforme(incoming);
        await AsyncStorage.setItem('tipos_producto_no_conforme_cache', JSON.stringify(incoming));
      }
    } catch (e) {
      console.error('Error fetching non conforming product types:', e);
    }
  }, [refreshAccessToken, logout]);

  // --------- estructura: opciones ---------
  const empresaOptions = useMemo(() => structure.map((e) => ({ id: e.id, nombre: e.nombre })), [structure]);

  const selectedEmpresaNode = useMemo(() => {
    if (selectedEmpresaId === null) return null;
    return structure.find((e) => e.id === selectedEmpresaId) ?? null;
  }, [structure, selectedEmpresaId]);

  const clienteOptions = useMemo(() => {
    if (!selectedEmpresaNode) return [];
    return (selectedEmpresaNode.clientes || []).map((c) => ({ id: c.id, nombre: c.nombre }));
  }, [selectedEmpresaNode]);

  const selectedClienteNode = useMemo(() => {
    if (!selectedEmpresaNode || selectedClienteId === null) return null;
    return selectedEmpresaNode.clientes.find((c) => c.id === selectedClienteId) ?? null;
  }, [selectedEmpresaNode, selectedClienteId]);

  const divisionOptions = useMemo(() => {
    if (!selectedClienteNode) return [];
    return (selectedClienteNode.division || []).map((d) => ({ id: d.id, nombre: d.nombre }));
  }, [selectedClienteNode]);

  const selectedDivisionNode = useMemo(() => {
    if (!selectedClienteNode || selectedDivisionId === null) return null;
    return (selectedClienteNode.division || []).find((d) => d.id === selectedDivisionId) ?? null;
  }, [selectedClienteNode, selectedDivisionId]);

  const contratoOptions = useMemo(() => {
    if (!selectedDivisionNode) return [];
    return (selectedDivisionNode.contratos || []).map((c) => ({ id: c.id, nombre: c.nombre }));
  }, [selectedDivisionNode]);

  const selectedContratoNode = useMemo(() => {
    if (!selectedDivisionNode || selectedContratoId === null) return null;
    return (selectedDivisionNode.contratos || []).find((c) => c.id === selectedContratoId) ?? null;
  }, [selectedDivisionNode, selectedContratoId]);

  const sucursalOptions = useMemo(() => {
    if (!selectedContratoNode) return [];
    return (selectedContratoNode.sucursales || []).map((s) => ({ id: s.id, nombre: s.nombre }));
  }, [selectedContratoNode]);

  const handleEmpresaChange = (empresaId: number | null) => {
    setSelectedEmpresaId(empresaId);
    setSelectedClienteId(null);
    setSelectedDivisionId(null);
    setSelectedContratoId(null);
    setSelectedSucursalId(null);
  };

  const handleClienteChange = (clienteId: number | null) => {
    setSelectedClienteId(clienteId);
    // división se fuerza por marca, sin recursividad
    setSelectedDivisionId(marcaDivisionId !== null ? Number(marcaDivisionId) : null);
    setSelectedContratoId(null);
    setSelectedSucursalId(null);
  };

  // mantener división fija (marca)
  useEffect(() => {
    if (marcaDivisionId !== null) {
      setSelectedDivisionId(Number(marcaDivisionId));
    }
  }, [marcaDivisionId]);

  // preselección por marca (cliente/corpo) cuando haya estructura
  useEffect(() => {
    if (!structure.length) return;
    if (!marcaClienteId || !marcaCorpoId) return;
    if (!marcaDivisionId) return;

    // si el usuario ya escogió manualmente, no pisar
    if (selectedEmpresaId || selectedClienteId || selectedContratoId || selectedSucursalId) return;

    const empresaFound = structure.find((e) => (e.clientes || []).some((c) => c.id === Number(marcaClienteId))) ?? null;
    const clienteFound = empresaFound?.clientes?.find((c) => c.id === Number(marcaClienteId)) ?? null;
    const divisionFound = clienteFound?.division?.find((d) => d.id === Number(marcaDivisionId)) ?? null;
    const contratoFound = divisionFound?.contratos?.find((ct) => (ct.sucursales || []).some((s) => s.id === Number(marcaCorpoId))) ?? null;

    if (empresaFound) setSelectedEmpresaId(empresaFound.id);
    if (clienteFound) setSelectedClienteId(clienteFound.id);
    setSelectedDivisionId(Number(marcaDivisionId));
    if (contratoFound) setSelectedContratoId(contratoFound.id);
    setSelectedSucursalId(Number(marcaCorpoId));
  }, [structure, marcaClienteId, marcaCorpoId, marcaDivisionId, selectedEmpresaId, selectedClienteId, selectedContratoId, selectedSucursalId]);

  // --------- location ---------
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({});
        setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      } catch {
        // ignore
      }
    })();
  }, []);

  // --------- CRUD + cache ---------
  const fetchRecords = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const current = await loadMarcaContext();
      if (!current) {
        setIsLoading(false);
        return;
      }

      await fetchMainStructure();

      const corpoId = marcaCorpoId ?? Number(current?.corpo?.id ?? current?.corpo_id ?? 0);
      if (!corpoId) {
        setError('No se encontró el ID de la sucursal (corpo) en la marca actual');
        setIsLoading(false);
        return;
      }

      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
      const cache = cacheStr ? JSON.parse(cacheStr) : [];

      const localCacheAll: PncRecord[] = cache.filter((item: any) => item.type === 'non_conforming_product');
      const localCache: PncRecord[] = localCacheAll.filter((r: any) => Number(r.corpo_id) === Number(corpoId));
      const localOnly = localCache.filter((r: any) => !r?.synced || String(r?.id_local || '').startsWith('local-'));

      const isConnected = await getConnectionStatus();
      if (!isConnected) {
        setRecords(localCache);
        return;
      }

      const res = await listNonConformingProductByCorpo({
        corpo_id: String(corpoId),
        refreshAccessToken,
        logout,
      });

      if (!res.status) {
        setRecords(localCache);
        return;
      }

      const serverItems: PncRecord[] = Array.isArray(res.data) ? (res.data as any) : [];
      const merged: PncRecord[] = [
        ...localOnly.map((r: any) => ({ ...r, synced: false })),
        ...serverItems.map((r: any) => ({ ...r, synced: true })),
      ];

      setRecords(merged);

      const withoutThis = cache.filter((item: any) => !(item.type === 'non_conforming_product' && Number(item.corpo_id) === Number(corpoId)));
      await AsyncStorage.setItem('evaluations_cache', JSON.stringify([...withoutThis, ...merged.map((r: any) => ({ ...r, type: 'non_conforming_product' }))]));
    } catch (e: any) {
      console.error('Error fetching PNC:', e);
      setError(e?.message || 'Error al cargar productos no conformes');
    } finally {
      setIsLoading(false);
    }
  }, [fetchMainStructure, refreshAccessToken, logout, marcaCorpoId]);

  useFocusEffect(
    useCallback(() => {
      fetchRecords();
      fetchTiposProductoNoConforme();
      const handler = () => {
        fetchRecords();
        fetchTiposProductoNoConforme();
      };
      eventBus.on('connectionRestored', handler);
      return () => eventBus.off('connectionRestored', handler);
    }, [fetchRecords, fetchTiposProductoNoConforme])
  );

  const resetForm = (horaAccion: string) => {
    setFechaIdentificacion(new Date(horaAccion));
    setFechaSolucion(new Date(horaAccion));
    setResponsableCuenta('');
    setTipoServicioNoConforme('');
    setPersonaIdentifico('');
    setFirmaPersonaIdentifico('');
    setDescripcion('');
    setPersonaOrigino('');
    setFirmaPersonaOrigino('');
    setAccionImplementada('');
    setResponsableAprobar('');
    setFirmaResponsable(null);
    setImageFiles([]);
    setAudioFiles([]);
    setVideoFiles([]);
    setDocumentFiles([]);
  };

  const startCreate = async () => {
    const horaAccion = await getHoraAccion();
    if (!horaAccion) {
      Alert.alert('Error', 'No se pudo obtener la hora de acción');
      return;
    }
    setIsCreating(true);
    setEditing(null);
    resetForm(String(horaAccion));
    // si ya tenemos defaults por marca, mantenerlos (no limpiar selects)
  };

  const startEditing = async (r: PncRecord) => {
    setIsCreating(true);
    setEditing({ id: r.id, id_local: r.id_local });

    // reconstruir jerarquía como MutuosAcuerdos: empresa/contrato desde cliente+corpo
    const empresaFound = structure.find((e) => (e.clientes || []).some((c) => c.id === r.cliente_id)) ?? null;
    if (empresaFound) setSelectedEmpresaId(empresaFound.id);
    setSelectedClienteId(r.cliente_id);
    if (marcaDivisionId) setSelectedDivisionId(Number(marcaDivisionId));

    const clienteNode = empresaFound?.clientes?.find((c) => c.id === r.cliente_id);
    const divisionNode = clienteNode?.division?.find((d) => d.id === Number(marcaDivisionId)) ?? null;
    const contratoFound = divisionNode?.contratos?.find((ct) => (ct.sucursales || []).some((s) => s.id === r.corpo_id)) ?? null;
    if (contratoFound) setSelectedContratoId(contratoFound.id);
    setSelectedSucursalId(r.corpo_id);

    const horaAccion = await getHoraAccion();
    if (!horaAccion) {
      Alert.alert('Error', 'No se pudo obtener la hora de acción');
      return;
    }

    setFechaIdentificacion(r.fecha_identificacion ? new Date(String(r.fecha_identificacion)) : new Date(String(horaAccion)));
    setFechaSolucion(r.fecha_solucion ? new Date(String(r.fecha_solucion)) : new Date(String(horaAccion)));
    setResponsableCuenta(r.responsable_cuenta || '');
    setTipoServicioNoConforme(r.tipo_servicio_no_conforme || '');
    setPersonaIdentifico(r.persona_identifico_pnc || '');
    setFirmaPersonaIdentifico(formatSignatureForDisplay(r.firma_persona_identifico_pnc) || r.firma_persona_identifico_pnc || '');
    setDescripcion(r.descripcion || '');
    setPersonaOrigino(r.persona_origino_pnc || '');
    setFirmaPersonaOrigino(formatSignatureForDisplay(r.firma_persona_origino_pnc) || r.firma_persona_origino_pnc || '');
    setAccionImplementada(r.accion_implementada || '');
    setResponsableAprobar(r.responsable_aprobar || '');

    setFirmaResponsable(null);
    setImageFiles([]);
    setAudioFiles([]);
    setVideoFiles([]);
    setDocumentFiles([]);
  };

  const cancelCreateOrEdit = async () => {
    const horaAccion = await getHoraAccion();
    if (!horaAccion) {
      Alert.alert('Error', 'No se pudo obtener la hora de acción');
      return;
    }
    setIsCreating(false);
    setEditing(null);
    resetForm(String(horaAccion));
  };

  const toggleExpanded = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // --------- firmas ---------
  const openSignatureModal = (target: 'identifico' | 'origino') => {
    setSignatureTarget(target);
    setSignatureKey((k) => k + 1);
    setSignatureModalVisible(true);
  };

  const handleSignatureOK = (sig: string) => {
    if (!signatureTarget) return;
    if (signatureTarget === 'identifico') setFirmaPersonaIdentifico(sig);
    if (signatureTarget === 'origino') setFirmaPersonaOrigino(sig);
    setSignatureTarget(null);
    setSignatureModalVisible(false);
  };

  const generateFirmaResponsable = async () => {
    if (!employee) return Alert.alert('Error', 'No se pudo obtener el empleado');
    if (!location) return Alert.alert('Error', 'No se pudo obtener la ubicación');

    setIsGeneratingFirma(true);
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) throw new Error('No authentication token found');

      const decoded: any = jwtDecode(token);
      const sessionId = decoded.sessionId;
      const horaAccion = await getHoraAccion();
      if (!horaAccion) throw new Error('Hora de acción not found');

      const hash = btoa(`${sessionId}:${employee.id}:${location.latitude}:${location.longitude}:${horaAccion}`);
      const decodedHash = decodeFirmaHash(hash);
      if (!decodedHash) throw new Error('Firma inválida');

      setFirmaResponsable(decodedHash);
    } catch (e) {
      console.error('Error generating firma responsable:', e);
      Alert.alert('Error', 'No se pudo generar la firma');
    } finally {
      setIsGeneratingFirma(false);
    }
  };

  const handleScanQR = async () => {
    try {
      const qrData = await scanQR();
      if (!qrData) return;
      const decoded = decodeFirmaHash(qrData);
      if (!decoded) {
        Alert.alert('Error', 'El QR no tiene la estructura esperada');
        return;
      }
      setFirmaResponsable(decoded);
    } catch (e) {
      console.error('Error reading QR:', e);
      Alert.alert('Error', 'No se pudo leer el QR');
    }
  };

  // --------- archivos ---------
  const handleAddFile = async (type: LocalFile['type']) => {
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
          const r = reader.result;
          if (typeof r === 'string') {
            const parts = r.split(',');
            resolve(parts.length > 1 ? parts[1] : parts[0]);
          } else reject(new Error('No se pudo leer el archivo'));
        };
        reader.onerror = () => reject(reader.error ?? new Error('Error al leer el archivo'));
        reader.readAsDataURL(blob);
      });

      let extension = '';
      if (asset.name && asset.name.includes('.')) extension = asset.name.split('.').pop() || '';
      else if (asset.mimeType && asset.mimeType.includes('/')) extension = asset.mimeType.split('/').pop() || '';

      const localId = `local_file_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const newFile: LocalFile = {
        id: localId,
        type,
        name: asset.name || `archivo.${extension || 'dat'}`,
        extension: extension || 'dat',
        base64,
        mimeType: asset.mimeType,
      };

      if (type === 'image') setImageFiles((p) => [...p, newFile]);
      else if (type === 'audio') setAudioFiles((p) => [...p, newFile]);
      else if (type === 'video') setVideoFiles((p) => [...p, newFile]);
      else setDocumentFiles((p) => [...p, newFile]);
    } catch (e) {
      console.error('Error picking file (PNC):', e);
      Alert.alert('Error', 'No se pudo seleccionar el archivo.');
    }
  };

  const removeLocalFile = (type: LocalFile['type'], id: string) => {
    if (type === 'image') setImageFiles((p) => p.filter((f) => f.id !== id));
    else if (type === 'audio') setAudioFiles((p) => p.filter((f) => f.id !== id));
    else if (type === 'video') setVideoFiles((p) => p.filter((f) => f.id !== id));
    else setDocumentFiles((p) => p.filter((f) => f.id !== id));
  };

  const buildArchivosPayload = () => {
    const files = [...imageFiles, ...audioFiles, ...videoFiles, ...documentFiles];
    return files.map((f) => ({
      type: f.type,
      extension: f.extension,
      original_name: f.name,
      file_base64: f.base64,
      mimeType: f.mimeType,
    }));
  };

  const buildFileUrl = (pncId: number | undefined, file: PncFile) => {
    const hasLocalId = file.id_local !== undefined && file.id_local !== null && String(file.id_local).trim().length > 0;
    if (hasLocalId && file.base64) {
      const mime = guessMimeType(file);
      return `data:${mime};base64,${file.base64}`;
    }

    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (apiUrl && pncId) {
      if (file.type === 'image') return appendTokenToUrl(`${apiUrl}/api/non-conforming-product/${pncId}/get-image/${encodeURIComponent(file.name)}`);
      if (file.type === 'audio') return appendTokenToUrl(`${apiUrl}/api/non-conforming-product/${pncId}/get-audio/${encodeURIComponent(file.name)}`);
      if (file.type === 'video') return appendTokenToUrl(`${apiUrl}/api/non-conforming-product/${pncId}/get-video/${encodeURIComponent(file.name)}`);
      return appendTokenToUrl(`${apiUrl}/api/non-conforming-product/${pncId}/get-file/${encodeURIComponent(file.name)}`);
    }
    return '';
  };

  // --------- validación / requestData ---------
  const validateForm = () => {
    if (!hasCurrentMarca) return 'Debes tener una marca activa para usar este módulo.';
    if (!selectedEmpresaId || !selectedClienteId || !selectedSucursalId) return 'Empresa, Cliente y Sucursal son obligatorios';
    if (!selectedDivisionId) return 'No se pudo determinar la división (marca actual)';
    if (!responsableCuenta.trim()) return 'Responsable de la cuenta es requerido';
    if (!tipoServicioNoConforme.trim()) return 'Tipo de producto no conforme es requerido';
    if (!personaIdentifico.trim()) return 'Persona que identificó el PNC es requerida';
    if (!descripcion.trim()) return 'Descripción es requerida';
    if (!personaOrigino.trim()) return 'Persona que originó el PNC es requerida';
    if (!accionImplementada.trim()) return 'Acción implementada es requerida';
    if (!responsableAprobar.trim()) return 'Responsable de aprobar es requerido';
    const firmaHash = firmaResponsable
      ? btoa(`${firmaResponsable.sessionId}:${firmaResponsable.empleadoId}:${firmaResponsable.latitud}:${firmaResponsable.longitud}:${firmaResponsable.timestamp}`)
      : '';
    if (!firmaHash.trim()) return 'Firma del responsable (QR o Generar) es requerida';
    return null;
  };

  const buildRequestData = () => {
    const firmaHash = firmaResponsable
      ? btoa(`${firmaResponsable.sessionId}:${firmaResponsable.empleadoId}:${firmaResponsable.latitud}:${firmaResponsable.longitud}:${firmaResponsable.timestamp}`)
      : '';
    return {
      cliente_id: selectedClienteId,
      corpo_id: selectedSucursalId,
      fecha_identificacion: dateToLocalString(fechaIdentificacion),
      responsable_cuenta: responsableCuenta.trim(),
      tipo_servicio_no_conforme: tipoServicioNoConforme.trim(),
      persona_identifico_pnc: personaIdentifico.trim(),
      firma_persona_identifico_pnc: getBase64Only(firmaPersonaIdentifico) || null,
      descripcion: descripcion.trim(),
      persona_origino_pnc: personaOrigino.trim(),
      firma_persona_origino_pnc: getBase64Only(firmaPersonaOrigino) || null,
      accion_implementada: accionImplementada.trim(),
      fecha_solucion: dateToLocalString(fechaSolucion),
      responsable_aprobar: responsableAprobar.trim(),
      firma_responsable: firmaHash,
      archivos: buildArchivosPayload(),
    };
  };

  const handleSave = async () => {
    const validationError = validateForm();
    if (validationError) {
      Alert.alert('Error', validationError);
      return;
    }

    setIsSubmitting(true);
    setSubmitResponse(null);

    try {
      const requestData: any = buildRequestData();
      const isConnected = await getConnectionStatus();

      // CREATE
      if (!editing) {
        if (isConnected) {
          const res = await createNonConformingProduct({ requestData, refreshAccessToken, logout });
          if (res.status) {
            Alert.alert('Éxito', res.message || 'Registro creado correctamente');
            setTimeout(() => {
              cancelCreateOrEdit();
              fetchRecords();
            }, 2000);
          } else {
            Alert.alert('Error', res.message || 'No se pudo crear el registro');
          }
          return;
        }

        const horaAccion = await getHoraAccion();
        if (!horaAccion) {
          Alert.alert('Error', 'No se pudo obtener la hora de acción');
          return;
        }

        const localId = `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const nowIso = new Date(String(horaAccion)).toISOString();

        const localFiles: PncFile[] = (requestData.archivos || []).map((f: any) => ({
          id_local: `local_file_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          type: f.type,
          extension: f.extension,
          name: f.original_name || `archivo.${f.extension || 'dat'}`,
          original_name: f.original_name,
          base64: f.file_base64,
          mimeType: f.mimeType,
        }));

        const localItem: PncRecord = {
          id: '',
          id_local: localId,
          cliente_id: requestData.cliente_id,
          corpo_id: requestData.corpo_id,
          fecha_identificacion: requestData.fecha_identificacion,
          responsable_cuenta: requestData.responsable_cuenta,
          tipo_servicio_no_conforme: requestData.tipo_servicio_no_conforme,
          persona_identifico_pnc: requestData.persona_identifico_pnc,
          firma_persona_identifico_pnc: requestData.firma_persona_identifico_pnc,
          descripcion: requestData.descripcion,
          persona_origino_pnc: requestData.persona_origino_pnc,
          firma_persona_origino_pnc: requestData.firma_persona_origino_pnc,
          accion_implementada: requestData.accion_implementada,
          fecha_solucion: requestData.fecha_solucion,
          responsable_aprobar: requestData.responsable_aprobar,
          firma_responsable: requestData.firma_responsable,
          created_at: nowIso,
          files: localFiles,
          synced: false,
        };

        const actionsStr = await AsyncStorage.getItem('evaluations_actions');
        const actions = actionsStr ? JSON.parse(actionsStr) : [];
        actions.push({ id: localId, action: 'create', type: 'non_conforming_product', payload: requestData, synced: false });
        await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        const cache = cacheStr ? JSON.parse(cacheStr) : [];
        cache.push({ ...localItem, type: 'non_conforming_product' });
        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(cache));

        Alert.alert('Éxito', 'El registro se sincronizará cuando vuelva la conexión.');
        setTimeout(() => {
          cancelCreateOrEdit();
          fetchRecords();
        }, 2000);
        return;
      }

      // UPDATE
      const recordId = editing.id || editing.id_local;
      const isLocal = String(editing.id).startsWith('local-') || (editing.id_local && String(editing.id_local).startsWith('local-'));
      const willReplaceFiles = (imageFiles.length + audioFiles.length + videoFiles.length + documentFiles.length) > 0;

      const requestDataUpdate: any = {
        ...buildRequestData(),
      };
      if (!willReplaceFiles) {
        // no mandar archivos para no disparar reemplazo total
        delete requestDataUpdate.archivos;
      }

      if (isConnected && !isLocal && editing.id && !String(editing.id).startsWith('local-')) {
        const res = await updateNonConformingProduct({ id: String(editing.id), requestData: requestDataUpdate, refreshAccessToken, logout });
        if (res.status) {
          Alert.alert('Éxito', res.message || 'Registro actualizado correctamente');
          setTimeout(() => {
            cancelCreateOrEdit();
            fetchRecords();
          }, 2000);
        } else {
          Alert.alert('Error', res.message || 'No se pudo actualizar el registro');
        }
        return;
      }

      // offline update (incluye local)
      {
        const actionsStr = await AsyncStorage.getItem('evaluations_actions');
        const actions = actionsStr ? JSON.parse(actionsStr) : [];
        actions.push({ id: recordId, action: 'update', type: 'non_conforming_product', payload: requestDataUpdate, synced: false });
        await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        const cache = cacheStr ? JSON.parse(cacheStr) : [];
        const updatedCache = cache.map((item: any) => {
          if (item.type !== 'non_conforming_product') return item;
          if (!(item.id === recordId || item.id_local === recordId)) return item;
          return { ...item, ...requestDataUpdate, synced: false };
        });
        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));

        Alert.alert('Éxito', 'Registro guardado localmente. Se sincronizará cuando vuelva la conexión.');
        setTimeout(() => {
          cancelCreateOrEdit();
          fetchRecords();
        }, 2000);
      }
    } catch (error) {
      console.error('Error saving non conforming product:', error);
      Alert.alert('Error', 'No se pudo guardar el registro');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (r: PncRecord) => {
    Alert.alert('Confirmar', '¿Deseas eliminar este registro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            const isConnected = await getConnectionStatus();
            const recordId = r.id || r.id_local;
            const isLocal = String(r.id_local || '').startsWith('local-') || String(r.id || '').startsWith('local-') || !r.synced;

            if (isConnected && !isLocal && r.id && !String(r.id).startsWith('local-')) {
              const res = await deleteNonConformingProduct({ id: String(r.id), refreshAccessToken, logout });
              if (!res.status) {
                Alert.alert('Error', res.message || 'No se pudo eliminar');
                return;
              }
            } else {
              const actionsStr = await AsyncStorage.getItem('evaluations_actions');
              const actions = actionsStr ? JSON.parse(actionsStr) : [];
              actions.push({ id: recordId, action: 'delete', type: 'non_conforming_product', payload: {}, synced: false });
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));
            }

            const cacheStr = await AsyncStorage.getItem('evaluations_cache');
            const cache = cacheStr ? JSON.parse(cacheStr) : [];
            const updatedCache = cache.filter((item: any) => !(item.type === 'non_conforming_product' && (item.id === recordId || item.id_local === recordId)));
            await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));

            Alert.alert('Éxito', 'Registro eliminado');
            await fetchRecords();
          } catch (e) {
            console.error('Error deleting PNC:', e);
            Alert.alert('Error', 'No se pudo eliminar');
          }
        },
      },
    ]);
  };

  // --------- UI helpers ---------
  const renderLocalFilesList = () => {
    const all = [...imageFiles, ...audioFiles, ...videoFiles, ...documentFiles];
    if (all.length === 0) return null;

    return (
      <ThemedView style={styles.filesList}>
        {imageFiles.map((file) => (
          <ThemedView key={file.id} style={styles.fileRow}>
            <Image
              source={{ uri: `data:${guessMimeType({ type: 'image', extension: file.extension, mimeType: file.mimeType })};base64,${file.base64}` }}
              style={styles.filePreviewImage}
              resizeMode="cover"
            />
            <ThemedText numberOfLines={1} style={styles.fileName}>{file.name}</ThemedText>
            <TouchableOpacity onPress={() => removeLocalFile('image', file.id)}>
              <Ionicons name="trash" size={16} color="#FF3B30" />
            </TouchableOpacity>
          </ThemedView>
        ))}

        {audioFiles.map((file) => (
          <ThemedView key={file.id} style={styles.mediaBlock}>
            <ThemedText style={styles.mediaLabel} numberOfLines={1}>Audio: {file.name}</ThemedText>
            <PncAudioPlayer
              sourceUrl={`data:${guessMimeType({ type: 'audio', extension: file.extension, mimeType: file.mimeType })};base64,${file.base64}`}
            />
            <TouchableOpacity style={styles.removeMediaBtn} onPress={() => removeLocalFile('audio', file.id)}>
              <Ionicons name="trash" size={16} color="#FF3B30" />
              <ThemedText style={styles.removeMediaText}>Quitar</ThemedText>
            </TouchableOpacity>
          </ThemedView>
        ))}

        {videoFiles.map((file) => (
          <ThemedView key={file.id} style={styles.mediaBlock}>
            <ThemedText style={styles.mediaLabel} numberOfLines={1}>Video: {file.name}</ThemedText>
            <PncVideoPlayer
              sourceUrl={`data:${guessMimeType({ type: 'video', extension: file.extension, mimeType: file.mimeType })};base64,${file.base64}`}
            />
            <TouchableOpacity style={styles.removeMediaBtn} onPress={() => removeLocalFile('video', file.id)}>
              <Ionicons name="trash" size={16} color="#FF3B30" />
              <ThemedText style={styles.removeMediaText}>Quitar</ThemedText>
            </TouchableOpacity>
          </ThemedView>
        ))}

        {documentFiles.map((file) => (
          <ThemedView key={file.id} style={styles.fileRow}>
            <Ionicons name="document-text-outline" size={16} color="#007AFF" />
            <ThemedText numberOfLines={1} style={styles.fileName}>{file.name}</ThemedText>
            <TouchableOpacity onPress={() => removeLocalFile('document', file.id)}>
              <Ionicons name="trash" size={16} color="#FF3B30" />
            </TouchableOpacity>
          </ThemedView>
        ))}
      </ThemedView>
    );
  };

  const renderForm = () => {
    const decodedFirma = firmaResponsable
      ? firmaResponsable
      : decodeFirmaHash(
        editing
          ? (records.find((r) => String(r.id) === String(editing.id) || String(r.id_local) === String(editing.id_local))?.firma_responsable || '')
          : ''
      );

    const divisionName =
      selectedClienteId && selectedDivisionId
        ? (divisionOptions.find((d) => d.id === selectedDivisionId)?.nombre || 'División')
        : 'Seleccione cliente primero';

    return (
      <ThemedView style={styles.formCard}>
        <ThemedText style={styles.formTitle}>{editing ? 'Editar registro' : 'Nuevo registro'}</ThemedText>

        {isStructureLoading ? (
          <ThemedView style={styles.inlineLoading}>
            <ActivityIndicator size="small" color="#007AFF" />
            <ThemedText style={styles.inlineLoadingText}>Cargando estructura...</ThemedText>
          </ThemedView>
        ) : null}

        <ThemedText style={styles.sectionTitle}>Jerarquía (hasta sucursal)</ThemedText>

        <ThemedText style={styles.label}>Empresa *</ThemedText>
        <ThemedView style={styles.pickerWrapper}>
          <Picker selectedValue={selectedEmpresaId ?? 0} onValueChange={(v) => handleEmpresaChange(Number(v) || null)} style={styles.picker}>
            <Picker.Item label="Seleccione empresa..." value={0} />
            {empresaOptions.map((e) => (
              <Picker.Item key={e.id} label={e.nombre} value={e.id} />
            ))}
          </Picker>
        </ThemedView>

        <ThemedText style={styles.label}>Cliente *</ThemedText>
        <ThemedView style={styles.pickerWrapper}>
          <Picker
            selectedValue={selectedClienteId ?? 0}
            onValueChange={(v) => handleClienteChange(Number(v) || null)}
            enabled={selectedEmpresaId !== null && clienteOptions.length > 0}
            style={styles.picker}
          >
            <Picker.Item label={selectedEmpresaId ? 'Seleccione cliente...' : 'Seleccione empresa primero'} value={0} />
            {clienteOptions.map((c) => (
              <Picker.Item key={c.id} label={c.nombre} value={c.id} />
            ))}
          </Picker>
        </ThemedView>

        <ThemedText style={styles.label}>División (automática)</ThemedText>
        <ThemedView style={styles.pickerWrapper}>
          <Picker selectedValue={selectedDivisionId ?? 0} onValueChange={() => { }} enabled={false} style={styles.picker}>
            <Picker.Item label={divisionName} value={0} />
          </Picker>
        </ThemedView>

        <ThemedText style={styles.label}>Contrato</ThemedText>
        <ThemedView style={styles.pickerWrapper}>
          <Picker
            selectedValue={selectedContratoId ?? 0}
            onValueChange={(v) => {
              const next = Number(v) || null;
              setSelectedContratoId(next);
              setSelectedSucursalId(null);
            }}
            enabled={selectedDivisionId !== null && contratoOptions.length > 0}
            style={styles.picker}
          >
            <Picker.Item label={selectedDivisionId ? 'Seleccione contrato...' : 'Seleccione cliente primero'} value={0} />
            {contratoOptions.map((c) => (
              <Picker.Item key={c.id} label={c.nombre} value={c.id} />
            ))}
          </Picker>
        </ThemedView>

        <ThemedText style={styles.label}>Sucursal *</ThemedText>
        <ThemedView style={styles.pickerWrapper}>
          <Picker
            selectedValue={selectedSucursalId ?? 0}
            onValueChange={(v) => setSelectedSucursalId(Number(v) || null)}
            enabled={selectedContratoId !== null && sucursalOptions.length > 0}
            style={styles.picker}
          >
            <Picker.Item label={selectedContratoId ? 'Seleccione sucursal...' : 'Seleccione contrato primero'} value={0} />
            {sucursalOptions.map((s) => (
              <Picker.Item key={s.id} label={s.nombre} value={s.id} />
            ))}
          </Picker>
        </ThemedView>

        <ThemedText style={styles.sectionTitle}>Datos</ThemedText>

        <ThemedText style={styles.label}>Fecha identificación *</ThemedText>
        <TouchableOpacity style={styles.dateButton} onPress={() => setShowFechaIdentPicker(true)} activeOpacity={0.85}>
          <ThemedText style={styles.dateButtonText}>{formatDateForDisplay(fechaIdentificacion)}</ThemedText>
          <Ionicons name="calendar-outline" size={18} color="#007AFF" />
        </TouchableOpacity>
        {showFechaIdentPicker && (
          <DateTimePicker
            value={fechaIdentificacion}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_, d) => {
              setShowFechaIdentPicker(false);
              if (d) setFechaIdentificacion(d);
            }}
          />
        )}

        <ThemedText style={styles.label}>Responsable de la cuenta *</ThemedText>
        <TextInput style={styles.input} value={responsableCuenta} onChangeText={setResponsableCuenta} placeholder="Responsable de la cuenta" placeholderTextColor="#999" />

        <ThemedText style={styles.label}>Tipo de producto no conforme *</ThemedText>
        {tiposProductoNoConforme.length > 0 ? (
          <ThemedView style={styles.pickerWrapper}>
            <Picker
              selectedValue={tipoServicioNoConforme}
              onValueChange={(v) => setTipoServicioNoConforme(String(v))}
              style={styles.picker}
            >
              <Picker.Item label="Seleccione tipo de producto no conforme..." value="" />
              {tiposProductoNoConforme.map((tipo) => (
                <Picker.Item key={tipo.id} label={tipo.nombre} value={tipo.nombre} />
              ))}
            </Picker>
          </ThemedView>
        ) : (
          <TextInput style={styles.input} value={tipoServicioNoConforme} onChangeText={setTipoServicioNoConforme} placeholder="Tipo de producto no conforme" placeholderTextColor="#999" />
        )}

        <ThemedText style={styles.label}>Persona que identificó el PNC *</ThemedText>
        <TextInput style={styles.input} value={personaIdentifico} onChangeText={setPersonaIdentifico} placeholder="Nombre" placeholderTextColor="#999" />

        <ThemedText style={styles.label}>Firma persona que identificó el PNC (Opcional)</ThemedText>
        {formatSignatureForDisplay(firmaPersonaIdentifico) ? (
          <Image source={{ uri: formatSignatureForDisplay(firmaPersonaIdentifico)! }} style={styles.signaturePreview} resizeMode="contain" />
        ) : null}
        <TouchableOpacity style={styles.signatureButton} onPress={() => openSignatureModal('identifico')} activeOpacity={0.85}>
          <Ionicons name="create-outline" size={18} color="#007AFF" />
          <ThemedText style={styles.signatureButtonText}>{firmaPersonaIdentifico ? 'Editar firma' : 'Agregar firma'}</ThemedText>
        </TouchableOpacity>

        <ThemedText style={styles.label}>Descripción *</ThemedText>
        <TextInput style={[styles.input, styles.textArea]} value={descripcion} onChangeText={setDescripcion} placeholder="Descripción" placeholderTextColor="#999" multiline />

        <ThemedText style={styles.label}>Persona que originó el PNC *</ThemedText>
        <TextInput style={styles.input} value={personaOrigino} onChangeText={setPersonaOrigino} placeholder="Nombre" placeholderTextColor="#999" />

        <ThemedText style={styles.label}>Firma persona que originó el PNC (Opcional)</ThemedText>
        {formatSignatureForDisplay(firmaPersonaOrigino) ? (
          <Image source={{ uri: formatSignatureForDisplay(firmaPersonaOrigino)! }} style={styles.signaturePreview} resizeMode="contain" />
        ) : null}
        <TouchableOpacity style={styles.signatureButton} onPress={() => openSignatureModal('origino')} activeOpacity={0.85}>
          <Ionicons name="create-outline" size={18} color="#007AFF" />
          <ThemedText style={styles.signatureButtonText}>{firmaPersonaOrigino ? 'Editar firma' : 'Agregar firma'}</ThemedText>
        </TouchableOpacity>

        <ThemedText style={styles.label}>Acción implementada *</ThemedText>
        <TextInput style={[styles.input, styles.textArea]} value={accionImplementada} onChangeText={setAccionImplementada} placeholder="Acción implementada" placeholderTextColor="#999" multiline />

        <ThemedText style={styles.label}>Fecha solución *</ThemedText>
        <TouchableOpacity style={styles.dateButton} onPress={() => setShowFechaSolPicker(true)} activeOpacity={0.85}>
          <ThemedText style={styles.dateButtonText}>{formatDateForDisplay(fechaSolucion)}</ThemedText>
          <Ionicons name="calendar-outline" size={18} color="#007AFF" />
        </TouchableOpacity>
        {showFechaSolPicker && (
          <DateTimePicker
            value={fechaSolucion}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_, d) => {
              setShowFechaSolPicker(false);
              if (d) setFechaSolucion(d);
            }}
          />
        )}

        <ThemedText style={styles.label}>Responsable de aprobar *</ThemedText>
        <TextInput style={styles.input} value={responsableAprobar} onChangeText={setResponsableAprobar} placeholder="Responsable de aprobar" placeholderTextColor="#999" />

        <ThemedText style={styles.sectionTitle}>Adjuntos</ThemedText>
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
        {renderLocalFilesList()}

        {/* Firma del responsable (digital: generar o escanear QR) */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Firma del responsable *</ThemedText>
          {!decodedFirma ? (
            <ThemedView style={styles.signatureButtonsRow}>
              <TouchableOpacity
                style={[styles.signatureButtonPrimary, isGeneratingFirma && styles.signatureDisabled]}
                onPress={generateFirmaResponsable}
                disabled={isGeneratingFirma}
                activeOpacity={0.85}
              >
                {isGeneratingFirma ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="finger-print" size={20} color="#FFFFFF" />
                    <ThemedText style={styles.signatureButtonPrimaryText}>{isGeneratingFirma ? 'Generando...' : 'Generar firma'}</ThemedText>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.signatureButtonPrimary} onPress={handleScanQR} activeOpacity={0.85}>
                <Ionicons name="qr-code" size={20} color="#FFFFFF" />
                <ThemedText style={styles.signatureButtonPrimaryText}>Escanear QR</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          ) : (
            <ThemedView style={styles.signatureInfo}>
              <ThemedText style={styles.signatureInfoTitle}>
                Información de la firma del responsable
              </ThemedText>
              <ThemedText style={styles.signatureInfoText}>
                ID de sesión: {decodedFirma.sessionId}
              </ThemedText>
              <ThemedText style={styles.signatureInfoText}>
                ID del empleado: {decodedFirma.empleadoId}
              </ThemedText>
              <ThemedText style={styles.signatureInfoText}>
                Latitud: {decodedFirma.latitud}
              </ThemedText>
              <ThemedText style={styles.signatureInfoText}>
                Longitud: {decodedFirma.longitud}
              </ThemedText>
              <ThemedText style={styles.signatureInfoText}>
                Fecha y hora: {formatFirmaDateLabel(decodedFirma.timestamp)}
              </ThemedText>
            </ThemedView>
          )}
        </ThemedView>

        {submitResponse && (
          <ThemedView style={[styles.responseContainer, submitResponse.type === 'success' ? styles.responseSuccess : styles.responseError]}>
            <ThemedText style={styles.responseText}>
              {submitResponse.type === 'success' ? '✓ ' : '✗ '}
              {submitResponse.message}
            </ThemedText>
          </ThemedView>
        )}
        <ThemedView style={styles.actionButtons}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.cancelButton]} 
            onPress={cancelCreateOrEdit} 
            activeOpacity={0.85}
            disabled={isSubmitting}
          >
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionButton, styles.saveButton, isSubmitting && styles.buttonDisabled]} 
            onPress={handleSave} 
            activeOpacity={0.85}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="checkmark" size={22} color="#FFFFFF" />
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
          <ThemedText style={styles.loadingText}>Cargando registros...</ThemedText>
        </ThemedView>
      );
    }

    if (error && records.length === 0) {
      return (
        <ThemedView style={styles.centerContainer}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        </ThemedView>
      );
    }

    if (records.length === 0) {
      return (
        <ThemedView style={styles.centerContainer}>
          <ThemedText style={styles.emptyText}>No hay registros</ThemedText>
        </ThemedView>
      );
    }

    return (
      <ThemedView style={styles.listContainer}>
        {records.map((r) => {
          const recordKey = String(r.id || r.id_local);
          const isExpanded = expanded.has(recordKey);
          const isOffline = !r.synced || String(r.id_local || '').startsWith('local-');
          const pncId = typeof r.id === 'number' ? r.id : undefined;

          const files = Array.isArray(r.files) ? r.files : [];
          const imageFilesRemote = files.filter((f) => f.type === 'image');
          const audioFilesRemote = files.filter((f) => f.type === 'audio');
          const videoFilesRemote = files.filter((f) => f.type === 'video');
          const documentFilesRemote = files.filter((f) => f.type === 'document' || (f.type !== 'image' && f.type !== 'audio' && f.type !== 'video'));

          return (
            <ThemedView key={recordKey} style={styles.card}>
              <ThemedText style={styles.cardTitle}>
                {r.tipo_servicio_no_conforme || '—'}
              </ThemedText>

              <ThemedText style={styles.cardLine}>
                <ThemedText style={styles.cardLabel}>Fecha identificación: </ThemedText>
                <ThemedText style={styles.cardValue}>{formatDateDMY(r.fecha_identificacion, '—')}</ThemedText>
              </ThemedText>
              <ThemedText style={styles.cardLine}>
                <ThemedText style={styles.cardLabel}>Responsable: </ThemedText>
                <ThemedText style={styles.cardValue}>{r.responsable_cuenta || '—'}</ThemedText>
              </ThemedText>

              <TouchableOpacity style={styles.collapseButton} onPress={() => toggleExpanded(recordKey)} activeOpacity={0.85}>
                <ThemedText style={styles.collapseButtonText}>{isExpanded ? 'Ocultar detalles' : 'Ver detalles'}</ThemedText>
                <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color="#007AFF" />
              </TouchableOpacity>

              {isExpanded && (
                <ThemedView style={styles.collapseContent}>
                  <ThemedText style={styles.sectionTitle}>Tipo producto no conforme</ThemedText>
                  <ThemedText style={styles.detailText}>{r.tipo_servicio_no_conforme || '—'}</ThemedText>

                  <ThemedText style={styles.sectionTitle}>Descripción</ThemedText>
                  <ThemedText style={styles.detailText}>{r.descripcion || '—'}</ThemedText>

                  <ThemedText style={styles.sectionTitle}>Acción implementada</ThemedText>
                  <ThemedText style={styles.detailText}>{r.accion_implementada || '—'}</ThemedText>

                  <ThemedText style={styles.sectionTitle}>Adjuntos</ThemedText>

                  {imageFilesRemote.length > 0 ? (
                    <>
                      <ThemedText style={styles.mediaLabel}>Imágenes</ThemedText>
                      <ThemedView style={styles.imagesList}>
                        {imageFilesRemote.map((f, idx) => {
                          const uri = buildFileUrl(pncId, f);
                          return (
                            <ThemedView key={`${recordKey}_img_${idx}`} style={styles.imageWideWrap}>
                              <Image source={{ uri }} style={styles.imageWide} resizeMode="contain" />
                            </ThemedView>
                          );
                        })}
                      </ThemedView>
                    </>
                  ) : null}

                  {audioFilesRemote.length > 0 ? (
                    <>
                      <ThemedText style={styles.mediaLabel}>Audios</ThemedText>
                      {audioFilesRemote.map((f, idx) => {
                        const uri = buildFileUrl(pncId, f);
                        const label = (f.original_name || f.name || `audio_${idx}`).trim();
                        return (
                          <ThemedView key={`${recordKey}_aud_${idx}`} style={styles.mediaBlock}>
                            <ThemedText style={styles.mediaLabel} numberOfLines={1}>{label}</ThemedText>
                            <PncAudioPlayer sourceUrl={uri} />
                          </ThemedView>
                        );
                      })}
                    </>
                  ) : null}

                  {videoFilesRemote.length > 0 ? (
                    <>
                      <ThemedText style={styles.mediaLabel}>Videos</ThemedText>
                      {videoFilesRemote.map((f, idx) => {
                        const uri = buildFileUrl(pncId, f);
                        const label = (f.original_name || f.name || `video_${idx}`).trim();
                        return (
                          <ThemedView key={`${recordKey}_vid_${idx}`} style={styles.mediaBlock}>
                            <ThemedText style={styles.mediaLabel} numberOfLines={1}>{label}</ThemedText>
                            <PncVideoPlayer sourceUrl={uri} />
                          </ThemedView>
                        );
                      })}
                    </>
                  ) : null}

                  {documentFilesRemote.length > 0 ? (
                    <>
                      <ThemedText style={styles.mediaLabel}>Archivos</ThemedText>
                      {documentFilesRemote.map((f, idx) => {
                        const uri = buildFileUrl(pncId, f);
                        const label = (f.original_name || f.name || `archivo_${idx}`).trim();
                        return (
                          <TouchableOpacity
                            key={`${recordKey}_doc_${idx}`}
                            style={styles.fileRow}
                            onPress={async () => {
                              if (!uri) return;
                              try {
                                await Linking.openURL(uri);
                              } catch {
                                Alert.alert('Error', 'No se pudo abrir el archivo');
                              }
                            }}
                          >
                            <ThemedText numberOfLines={1} style={styles.fileName}>{label}</ThemedText>
                            <Ionicons name="open-outline" size={18} color="#007AFF" />
                          </TouchableOpacity>
                        );
                      })}
                    </>
                  ) : null}
                </ThemedView>
              )}

              <ThemedView style={styles.actionsRow}>
                <TouchableOpacity style={[styles.actionBtn, styles.editBtn]} onPress={() => startEditing(r)} activeOpacity={0.85}>
                  <Ionicons name="pencil" size={18} color="#FFFFFF" />
                  <ThemedText style={styles.actionBtnText}>Editar</ThemedText>
                </TouchableOpacity>
                {!(r.id_local || String(r.id).startsWith('local-') || r.id === 0) && (
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.changesButton]}
                    onPress={() => {
                      setCambiosTitle(`Cambios - PNC #${r.id}`);
                      fetchCambios('c_producto_no_conforme', Number(r.id));
                    }}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="list-outline" size={18} color="#FFFFFF" />
                    <ThemedText style={styles.actionBtnText}>Cambios</ThemedText>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={() => handleDelete(r)} activeOpacity={0.85}>
                  <Ionicons name="trash" size={18} color="#FFFFFF" />
                  <ThemedText style={styles.actionBtnText}>Eliminar</ThemedText>
                </TouchableOpacity>
              </ThemedView>
            </ThemedView>
          );
        })}
      </ThemedView>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <AppHeader title="Producto no conforme" onMenuPress={() => setIsMenuVisible(true)} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <ThemedView style={styles.content}>
          {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}

          <ThemedView style={styles.titleContainer}>
            <ThemedText type="title" style={styles.title}>
              <Ionicons name="alert-circle" size={22} color="#000000" /> Producto no conforme
            </ThemedText>
            <ThemedText style={styles.subtitle}>Registro con adjuntos y firmas (offline + sync)</ThemedText>
          </ThemedView>

          {!hasCurrentMarca ? (
            <ThemedView style={styles.emptyContainer}>
              <ThemedText style={styles.errorText}>Debes tener una marca activa para usar este módulo.</ThemedText>
            </ThemedView>
          ) : null}

          {!isCreating && hasCurrentMarca && !isLoading ? (
            <TouchableOpacity style={styles.createButton} onPress={startCreate} activeOpacity={0.85}>
              <ThemedText style={styles.createButtonText}>
                <Ionicons name="add" size={20} color="#FFFFFF" /> Nuevo registro
              </ThemedText>
            </TouchableOpacity>
          ) : null}

          {isCreating ? renderForm() : renderList()}
        </ThemedView>
      </ScrollView>

      <AppFooter />
      <SlideMenu isVisible={isMenuVisible} onClose={() => setIsMenuVisible(false)} onHomePress={() => navigation.navigate('Home')} currentRoute="NonConformingProduct" />

      {/* Modal firma dibujada */}
      <Modal visible={signatureModalVisible} transparent animationType="fade">
        <ThemedView style={styles.signatureOverlay}>
          <ThemedView style={styles.signatureContainer}>
            <ThemedText style={styles.signatureTitle}>Firma</ThemedText>
            <View style={styles.signaturePad}>
              <SignatureScreen
                key={signatureKey}
                ref={signatureRef}
                onOK={handleSignatureOK}
                webStyle={signatureWebStyle}
                autoClear={false}
                backgroundColor="transparent"
                descriptionText=""
              />
            </View>
            <ThemedView style={styles.signatureButtons}>
              <TouchableOpacity style={[styles.signatureActionBtn, styles.signatureCancel]} onPress={() => setSignatureModalVisible(false)} activeOpacity={0.85}>
                <ThemedText style={styles.signatureActionText}>Cerrar</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.signatureActionBtn, styles.signatureSave]} onPress={() => signatureRef.current?.readSignature?.()} activeOpacity={0.85}>
                <ThemedText style={styles.signatureActionText}>Guardar</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.signatureActionBtn, styles.signatureClear]} onPress={() => signatureRef.current?.clearSignature?.()} activeOpacity={0.85}>
                <ThemedText style={styles.signatureActionText}>Limpiar</ThemedText>
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
                                      {Object.entries(created).map(([k, v]) => {
                                        if (k === 'firma_persona_identifico_pnc' || k === 'firma_persona_origino_pnc' || k === 'firma_responsable') return null;
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
                                                ? `Sesión: ${info.sessionId || 'N/A'} - Empleado: ${info.empleadoId || 'N/A'} - Hora: ${info.timestamp || 'N/A'}`
                                                : 'Firma responsable (formato no decodificable)';
                                            })()}
                                          </ThemedText>
                                        </ThemedView>
                                      )}
                                      {created.firma_persona_identifico_pnc && (
                                        <ThemedView style={styles.changeDescriptionContainer}>
                                          <ThemedText style={styles.changeDescription}>
                                            <ThemedText style={{ fontWeight: '800' }}>firma_persona_identifico_pnc: </ThemedText>
                                          </ThemedText>
                                          <Image
                                            source={{ uri: formatSignatureForDisplay(created.firma_persona_identifico_pnc) ?? '' }}
                                            style={styles.cambioSignatureImage}
                                            resizeMode="contain"
                                          />
                                        </ThemedView>
                                      )}
                                      {created.firma_persona_origino_pnc && (
                                        <ThemedView style={styles.changeDescriptionContainer}>
                                          <ThemedText style={styles.changeDescription}>
                                            <ThemedText style={{ fontWeight: '800' }}>firma_persona_origino_pnc: </ThemedText>
                                          </ThemedText>
                                          <Image
                                            source={{ uri: formatSignatureForDisplay(created.firma_persona_origino_pnc) ?? '' }}
                                            style={styles.cambioSignatureImage}
                                            resizeMode="contain"
                                          />
                                        </ThemedView>
                                      )}
                                    </React.Fragment>
                                  );
                                }

                                const isResponsableSignature = prop === 'firma_responsable';
                                const isManualSignature = prop === 'firma_persona_identifico_pnc' || prop === 'firma_persona_origino_pnc';

                                return (
                                  <ThemedView key={`c-${row.id}-${idx}`} style={styles.changeDescriptionContainer}>
                                    <ThemedText style={styles.changeDescription}>
                                      <ThemedText style={{ fontWeight: '800' }}>{prop}: </ThemedText>
                                      {!isManualSignature && !isResponsableSignature && formatChangeValue(prop, value)}
                                      {isResponsableSignature && (() => {
                                        const info = typeof value === 'string' ? decodeFirmaHash(value) : null;
                                        if (!info) return 'Firma responsable (formato no decodificable)';
                                        return `Sesión: ${info.sessionId || 'N/A'} - Empleado: ${info.empleadoId || 'N/A'} - Hora: ${info.timestamp || 'N/A'}`;
                                      })()}
                                    </ThemedText>
                                    {isManualSignature && value && (
                                      <Image
                                        source={{ uri: formatSignatureForDisplay(value) ?? '' }}
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

      {QRScannerComponent}
    </ThemedView>
  );
}

// --- Media Players (igual a JobManualsScreen) ---
function PncAudioPlayer({ sourceUrl }: { sourceUrl: string }) {
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
    } catch (e) {
      console.error('Error controlling audio player (PNC):', e);
    }
  };

  const resetAudio = () => {
    if (!player) return;
    try {
      player.seekTo(0);
      player.pause();
      setIsPlaying(false);
    } catch (e) {
      console.error('Error resetting audio player (PNC):', e);
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
    <ThemedView style={styles.audioPlayer}>
      <TouchableOpacity style={styles.playButton} onPress={togglePlayPause}>
        <Ionicons name={isPlaying ? 'pause' : 'play'} size={24} color="#007AFF" />
      </TouchableOpacity>
      <ThemedText style={styles.audioTime}>
        {formatTime(position)} / {formatTime(duration)}
      </ThemedText>
      <TouchableOpacity style={styles.resetAudioButton} onPress={resetAudio}>
        <Ionicons name="refresh" size={22} color="#FFFFFF" />
      </TouchableOpacity>
    </ThemedView>
  );
}

function PncVideoPlayer({ sourceUrl }: { sourceUrl: string }) {
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
        allowsFullscreen={false}
        allowsPictureInPicture={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },
  content: { gap: 12 },

  titleContainer: { gap: 4, marginBottom: 6, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E0E0E0', paddingBottom: 16 },
  title: { color: '#000000', fontSize: 22, fontWeight: 'bold' },
  subtitle: { color: '#666666' },

  emptyContainer: { paddingVertical: 12 },

  createButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  createButtonText: { color: '#FFFFFF', fontWeight: '700' },

  formCard: { backgroundColor: '#FFFFFF', borderRadius: 8, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  formTitle: { fontSize: 18, fontWeight: '700', color: '#000000', marginBottom: 8 },

  inlineLoading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  inlineLoadingText: { color: '#666666' },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#000000', marginTop: 8, marginBottom: 6 },
  label: { fontSize: 14, fontWeight: '600', color: '#000000', marginTop: 10, marginBottom: 6 },

  pickerWrapper: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10, overflow: 'hidden', backgroundColor: '#FFFFFF' },
  picker: { backgroundColor: '#FFFFFF' },

  input: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10, padding: 12, color: '#000000', backgroundColor: '#FFFFFF' },
  textArea: { minHeight: 90, textAlignVertical: 'top' as any },

  dateButton: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  dateButtonText: { color: '#000000', fontWeight: '600' },

  signaturePreview: { height: 140, borderRadius: 10, borderWidth: 1, borderColor: '#E0E0E0', marginBottom: 10 },
  signatureButton: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 10 },
  signatureButtonText: { color: '#007AFF', fontWeight: '700' },

  fileIconButtonsRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  fileIconButton: { width: 42, height: 42, borderRadius: 12, borderWidth: 1, borderColor: '#E0E0E0', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },

  filesList: { marginTop: 10, gap: 8 },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  filePreviewImage: { width: 44, height: 44, borderRadius: 8, backgroundColor: '#F2F2F2' },
  fileName: { flex: 1, color: '#000000' },

  formGroup: { marginBottom: 16 },
  formLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8, color: '#333' },
  signatureButtonsRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  signatureButtonPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    gap: 8,
    flex: 1,
  },
  signatureButtonPrimaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  signatureBlueButton: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: '#007AFF', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, flex: 1, justifyContent: 'center' },
  signatureBlueButtonText: { color: '#FFFFFF', fontWeight: '700' },
  signatureDisabled: { opacity: 0.6 },
  signatureInfo: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  signatureInfoTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 4 },
  signatureInfoText: { fontSize: 12, marginBottom: 2 },
  firmaInfoBox: { marginTop: 10, padding: 12, borderRadius: 10, backgroundColor: '#F5F9FF', borderWidth: 1, borderColor: '#D7E8FF' },
  firmaInfoText: { color: '#000000' },
  helpText: { color: '#666666' },

  actionButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, gap: 12 },
  actionButton: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cancelButton: { backgroundColor: '#FF3B30' },
  saveButton: { backgroundColor: '#34C759' },
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

  // Lista (tarjetas estilo MutuosAcuerdosScreen)
  listContainer: { gap: 12 },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#000000', marginBottom: 10 },
  cardLine: { marginBottom: 6 },
  cardLabel: { fontWeight: '800', color: '#000000' },
  cardValue: { color: '#000000' },
  detailText: { color: '#000000', marginBottom: 8 },


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
  collapseButtonText: { color: '#007AFF', fontWeight: '800' },
  collapseContent: { marginTop: 12 },

  actionsRow: { flexDirection: 'row', gap: 12, marginTop: 14 },
  actionBtn: { flex: 1, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10 },
  editBtn: { backgroundColor: '#007AFF' },
  changesButton: { backgroundColor: '#5856D6', flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10, gap: 8 },
  deleteBtn: { backgroundColor: '#FF3B30' },
  actionBtnText: { color: '#FFFFFF', fontWeight: '800' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  floatModalCardMovimientos: { backgroundColor: '#FFFFFF', borderRadius: 12, width: '100%', maxWidth: 500, maxHeight: '80%', borderWidth: 1, borderColor: '#E0E0E0', overflow: 'hidden' },
  floatModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#000' },
  cambioCollapsableMain: { width: '100%', marginBottom: 10, backgroundColor: '#fff', borderRadius: 6, borderWidth: 1, borderColor: '#E0E0E0', overflow: 'hidden' },
  cambioCollapsableHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#F8F9FA' },
  cambioCollapsableTitle: { fontSize: 14, fontWeight: '600', color: '#007AFF', flex: 1 },
  cambioCollapsableContent: { padding: 12, gap: 8, backgroundColor: '#F8F9FA' },
  changeDescription: { fontSize: 14, lineHeight: 20, color: '#666', marginBottom: 8 },
  changeDescriptionContainer: { marginBottom: 8 },
  cambioSignatureImage: { marginTop: 6, height: 80, width: 160, backgroundColor: '#f0f0f0', borderRadius: 4 },
  filterGroupSearch: { marginBottom: 12 },
  filterLabel: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 4 },

  // Media (audio/video) similar a JobManualsScreen
  mediaBlock: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    padding: 12,
    marginTop: 10,
  },
  mediaLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  removeMediaBtn: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  removeMediaText: {
    color: '#FF3B30',
    fontWeight: '700',
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
  playButton: { padding: 8 },
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

  imagesList: {
    marginTop: 8,
    gap: 12,
    marginBottom: 10,
  },
  imageWideWrap: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#F2F2F2',
  },
  imageWide: {
    width: '100%',
    height: 220,
    backgroundColor: '#F2F2F2',
  },

  centerContainer: { paddingVertical: 30, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, color: '#666666' },
  errorText: { color: '#FF3B30', fontWeight: '700' },
  emptyText: { color: '#666666' },

  signatureOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 16 },
  signatureContainer: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12 },
  signatureTitle: { fontSize: 16, fontWeight: '800', color: '#000000', marginBottom: 10 },
  signaturePad: { height: 280, borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10, overflow: 'hidden' },
  signatureButtons: { flexDirection: 'row', gap: 10, marginTop: 12 },
  signatureActionBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  signatureCancel: { backgroundColor: '#CCCCCC' },
  signatureSave: { backgroundColor: '#34C759' },
  signatureClear: { backgroundColor: '#607D8B' },
  signatureActionText: { color: '#FFFFFF', fontWeight: '800' },
});


