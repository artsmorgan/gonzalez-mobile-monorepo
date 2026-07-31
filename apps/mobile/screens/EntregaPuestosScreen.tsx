import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Modal, View, Platform, Image } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useAuth } from '@/contexts/AuthContext';
import AppHeader from '@/components/AppHeader';
import AppFooter from '@/components/AppFooter';
import SlideMenu from '@/components/SlideMenu';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import * as Network from 'expo-network';
import SignatureScreen from "react-native-signature-canvas";
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useQRScanner } from '@/hooks/useQRScanner';
import getHoraAccion from '@/hooks/getHoraAccion';
import getCurrentUserDigitalSignature from '@/hooks/getCurrentUserDigitalSignature';
import authedFetch from '@/hooks/authedFetch';
import { Collapsible } from '@/components/Collapsible';
import { convertDateTimestampToLocalString } from '@/hooks/convertDateTimestampToLocalString';
import { rewritePuestoArticulosInMainStructure } from '@/hooks/puestoArticulosSync';
import ArticuloMantenimientoArchivosModal from '@/components/ArticuloMantenimientoArchivosModal';
import type { ArticuloMantenimientoPendingFile } from '@/utils/articuloMantenimientoFiles';
import {
  hydrateArticulosPuestoFilesForApi,
  serializeArticulosPuestoForStorage,
} from '@/utils/articuloMantenimientoFiles';
import { prioritizePlanByArticuloNomencladorId } from '@/hooks/prioritizePlanByArticuloNomencladorId';

type EntregaPuestosScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'EntregaPuestos'>;

interface CurrentMarca {
  id: number;
  hora_entrada_digitada: string | null;
  hora_salida_digitada: string | null;
  hora_inicio: string;
  hora_fin: string;
  fecha: string;
  tipo_turno: string;
  cliente: {
    id: number;
    nombre: string;
  };
  corpo: {
    id: number;
    nombre: string;
  };
  puesto: {
    id: number;
    nombre: string;
  };
  roleDivision: {
    division: {
      id: number;
      nombre: string;
    };
    role: {
      id: number;
      nombre: string;
    };
  };
  empleadoFijo_id?: number;
}

interface EntregaPuestosInfo {
  is_self_delivery?: boolean;
  marca_recibe_id?: number;
  marca_entrega_id?: number | null;
  previous_marca: {
    id?: number;
    fecha: string;
    hora_inicio: string;
    hora_fin: string;
    tipo_turno: string;
  };
  previous_employee: {
    id: number;
    nombre: string;
  };
  incidentes: Array<{
    id: number;
    clasificacion: string;
    description: string;
    involucrados: string;
    estado: boolean;
    responsable: string;
  }>;
  notas: Array<{
    id: number;
    titulo: string;
    description: string;
    categoria: string | null;
    empleado: string;
    updated_at: string;
  }>;
  articulos: Array<{
    id: number;
    nombre: string;
    cantidad: number;
    tipo?: string;
    articulo_nomenclador_id?: number | null;
    ultimo_mantenimiento?: {
      estado?: 'Bueno' | 'Malo' | 'No está' | string;
      cantidad_real?: number;
    } | null;
  }>;
}

interface ArticuloForm {
  id: number;
  nombre: string;
  tipo?: string;
  articulo_nomenclador_id?: number | null;
  cantidad_requerida: number;
  cantidad_real: number;
  estado: 'Bueno' | 'Malo' | 'No está';
  observaciones?: string;
  ultimo_mantenimiento_id?: number | null;
  mantenimiento_files?: ArticuloMantenimientoPendingFile[];
}

type MainStructurePuestoNode = { id: number; nombre: string };
type MainStructureSucursalNode = { id: number; nombre: string; puestos: MainStructurePuestoNode[] };
type MainStructureContratoNode = { id: number; nombre: string; sucursales: MainStructureSucursalNode[] };
type MainStructureDivisionNode = { id: number; nombre: string; contratos: MainStructureContratoNode[] };
type MainStructureClienteNode = { id: number; nombre: string; division: MainStructureDivisionNode[] };
type MainStructureEmpresaNode = { id: number; nombre: string; clientes: MainStructureClienteNode[] };
type MainStructureTree = MainStructureEmpresaNode[];

interface EntregaPuestoRecordArticulo {
  id: number;
  nombre: string;
  tipo?: string;
  cantidad_requerida: number;
  cantidad_real: number;
  estado: 'Bueno' | 'Malo' | 'No está' | string;
  observaciones?: string;
}

interface EntregaPuestoRecord {
  id: number;
  oficial_entrega: string | null;
  fecha_entrada_entrega: string | Date | null;
  fecha_salida_entrega: string | Date | null;
  hora_entrada_entrega: string | Date | null;
  hora_salida_entrega: string | Date | null;
  turno_entrega: string | null;
  marca_entrega_id: number | null;
  oficial_recibe: string;
  fecha_entrada_recibe: string | Date;
  fecha_salida_recibe: string | Date;
  hora_entrada_recibe: string | Date;
  hora_salida_recibe: string | Date;
  turno_recibe: string;
  marca_recibe_id: number | null;
  articulos_puesto: EntregaPuestoRecordArticulo[];
  observaciones: string;
  firma_recibe: string;
  firma_entrega: string | null;
  firma_responsable: string;
  image_delivery: string | null;
  image_receives: string | null;
  created_at: string | Date;
  created_by: number;
}

const signatureWebStyle = `
  body, html {
    margin: 0;
    padding: 0;
    height: 100%;
    width: 100%;
  }
  .m-signature-pad {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    margin: 0;
    padding: 0;
    box-shadow: none;
    border: none;
    background-color: #FFFFFF;
  }
  .m-signature-pad--body {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border: none;
    margin: 0;
    padding: 0;
  }
  .m-signature-pad--body canvas {
    width: 100% !important;
    height: 100% !important;
    touch-action: none;
  }
  .m-signature-pad--footer {
    display: none;
  }
`;

export default function EntregaPuestosScreen() {
  const { employee, refreshAccessToken, logout, accessToken } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<EntregaPuestosScreenNavigationProp>();
  const { scanQR, QRScannerComponent } = useQRScanner();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'front' | 'back'>('front');
  const [cameraTarget, setCameraTarget] = useState<'receives' | 'delivery'>('receives');
  const [photoRecibeBase64, setPhotoRecibeBase64] = useState<string>('');
  const [photoEntregaBase64, setPhotoEntregaBase64] = useState<string>('');
  const [photoRecibeUri, setPhotoRecibeUri] = useState<string>('');
  const [photoEntregaUri, setPhotoEntregaUri] = useState<string>('');

  const appendTokenToUrl = (url: string) => {
    if (!accessToken || accessToken.trim().length === 0) return url;
    if (/[?&]token=/.test(url)) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}token=${encodeURIComponent(accessToken)}`;
  };

  const buildEntregaPuestoImageUrl = (
    recordId: number | undefined,
    fileName: string | null | undefined,
  ): string => {
    const name = String(fileName || '').trim();
    if (!recordId || !name) return '';
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) return '';
    return appendTokenToUrl(
      `${String(apiUrl).replace(/\/+$/, '')}/api/entrega-puestos/${recordId}/get-image/${encodeURIComponent(name)}`,
    );
  };

  const openCameraForPhoto = async (target: 'receives' | 'delivery') => {
    try {
      if (!cameraPermission?.granted) {
        const res = await requestCameraPermission();
        if (!res.granted) {
          Alert.alert('Permiso denegado', 'Se necesita permiso para usar la cámara');
          return;
        }
      }
      setCameraTarget(target);
      setCameraFacing('front');
      setIsCameraVisible(true);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo abrir la cámara');
    }
  };

  const captureEntregaPhoto = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        base64: true,
        skipProcessing: false,
      });
      if (!photo?.uri) {
        Alert.alert('Error', 'No se pudo capturar la foto');
        return;
      }
      const rawB64 = String(photo.base64 || '').trim();
      if (!rawB64) {
        Alert.alert('Error', 'No se pudo obtener la foto en base64');
        return;
      }
      if (cameraTarget === 'receives') {
        setPhotoRecibeBase64(rawB64);
        setPhotoRecibeUri(photo.uri);
      } else {
        setPhotoEntregaBase64(rawB64);
        setPhotoEntregaUri(photo.uri);
      }
      setIsCameraVisible(false);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo capturar la foto');
    }
  };

  const handleHomePress = () => {
    navigation.navigate('Home');
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

  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentMarca, setCurrentMarca] = useState<CurrentMarca | null>(null);
  const [info, setInfo] = useState<EntregaPuestosInfo | null>(null);
  const [articulos, setArticulos] = useState<ArticuloForm[]>([]);
  const [archivosModalIndex, setArchivosModalIndex] = useState<number | null>(null);
  const [observaciones, setObservaciones] = useState('');
  const [firmaRecibe, setFirmaRecibe] = useState<string>('');
  const [firmaEntrega, setFirmaEntrega] = useState<string>('');
  const [firmaResponsable, setFirmaResponsable] = useState<string>('');
  const [isSignatureModalVisible, setIsSignatureModalVisible] = useState(false);
  const [signatureTarget, setSignatureTarget] = useState<'firma_recibe' | 'firma_entrega'>('firma_recibe');
  const [isReadingSignature, setIsReadingSignature] = useState(false);
  const [isGeneratingFirma, setIsGeneratingFirma] = useState(false);
  const signatureRef = useRef<any>(null);
  const [signatureKey, setSignatureKey] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResponse, setSubmitResponse] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [hasEntregaTurno, setHasEntregaTurno] = useState(false);

  const [showRecordsList, setShowRecordsList] = useState(false);
  const [isHierarchyFiltersExpanded, setIsHierarchyFiltersExpanded] = useState(false);
  const [records, setRecords] = useState<EntregaPuestoRecord[]>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);

  const [mainStructure, setMainStructure] = useState<MainStructureTree>([]);
  const [filterEmpresaId, setFilterEmpresaId] = useState<number | null>(null);
  const [filterClienteId, setFilterClienteId] = useState<number | null>(null);
  const [filterDivisionId, setFilterDivisionId] = useState<number | null>(null);
  const [filterContratoId, setFilterContratoId] = useState<number | null>(null);
  const [filterSucursalId, setFilterSucursalId] = useState<number | null>(null);
  const [filterPuestoId, setFilterPuestoId] = useState<number | null>(null);
  const [isStructureLoading, setIsStructureLoading] = useState(false);

  const getConnectionStatus = async (): Promise<boolean> => {
    const networkState = await Network.getNetworkStateAsync();

    return (
      networkState.isConnected === true &&
      networkState.isInternetReachable === true
    );
  };

  const generateRandomId = (): string => {
    return `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  /**
   * Sincroniza las actividades en activities_cache (solo revisión de equipo)
   * con el último estado de los artículos del puesto actual.
   */
  const updateActivitiesCacheWithEntrega = async () => {
    try {
      const cacheStr = await AsyncStorage.getItem('activities_cache');
      if (!cacheStr || !Array.isArray(articulos) || articulos.length === 0) return;
      const parsed: any = JSON.parse(cacheStr);
      if (!Array.isArray(parsed)) return;

      const articulosById = new Map<number, ArticuloForm>(
        articulos.map((a) => [a.id, a] as [number, ArticuloForm])
      );

      const updatedActivities = parsed.map((act: any) => {
        if (!act?.is_revision_equipo || !Array.isArray(act.inventario)) return act;

        const updatedInventario = act.inventario.map((inv: any) => {
          const form = articulosById.get(Number(inv.id));
          if (!form) return inv;

          const estado = form.estado;
          const cantidad_real = form.cantidad_real;
          const observaciones = form.observaciones || '';

          const rev = inv.revision_equipo || {};

          return {
            ...inv,
            cantidad_requerida:
              inv.cantidad_requerida != null ? inv.cantidad_requerida : form.cantidad_requerida,
            cantidad_real,
            estado,
            observaciones,
            revision_equipo: {
              ...rev,
              es_correcto: estado === 'Bueno',
              motivo_incorrecto: estado === 'Bueno' ? '-' : (observaciones || '-'),
            },
          };
        });

        return {
          ...act,
          inventario: updatedInventario,
        };
      });

      await AsyncStorage.setItem('activities_cache', JSON.stringify(updatedActivities));
    } catch (e) {
      console.error('Error updating activities_cache after entrega-puestos:', e);
    }
  };

  /**
   * Actualiza el último mantenimiento de los artículos del puesto tras confirmar la entrega.
   * Con esquema de fragmentos: escribe `puesto_{id}_articulos`; si no, mergea el árbol y persiste el monolito.
   */
  const updateMainStructureCacheWithEntrega = async (options?: { enqueueActions?: boolean }) => {
    try {
      if (!currentMarca || !Array.isArray(articulos) || articulos.length === 0) {
        return;
      }
      const shouldEnqueueActions = Boolean(options?.enqueueActions);

      const horaAccion = await getHoraAccion();
      if (!horaAccion) {
        throw new Error('No se pudo obtener la hora de acción');
      }

      const puestoId = currentMarca.puesto.id;
      const actionsKey = 'articulo_mantenimiento_actions';
      const actionsStr = shouldEnqueueActions ? await AsyncStorage.getItem(actionsKey) : null;
      const actions = shouldEnqueueActions && actionsStr ? JSON.parse(actionsStr) : [];
      const actionsArr: any[] = Array.isArray(actions) ? actions : [];

      const upsertAction = (newAction: any) => {
        if (!shouldEnqueueActions) return;
        if (newAction?.type === 'update' && newAction?.id) {
          const idx = actionsArr.findIndex((a: any) => a?.type === 'update' && Number(a?.id) === Number(newAction.id));
          if (idx !== -1) actionsArr[idx] = { ...actionsArr[idx], ...newAction };
          else actionsArr.push(newAction);
          return;
        }
        if (newAction?.type === 'create') {
          const planId = Number(newAction?.requestData?.articulo_plan_id || 0);
          const asigId = Number(newAction?.requestData?.articulo_asignado_id || 0);
          const idx = actionsArr.findIndex((a: any) => {
            if (a?.type !== 'create') return false;
            const aPlan = Number(a?.requestData?.articulo_plan_id || 0);
            const aAsig = Number(a?.requestData?.articulo_asignado_id || 0);
            return (planId > 0 && aPlan === planId) || (asigId > 0 && aAsig === asigId);
          });
          if (idx !== -1) actionsArr[idx] = { ...actionsArr[idx], ...newAction };
          else actionsArr.push(newAction);
        }
      };

      const enqueueFn = shouldEnqueueActions
        ? (p: {
            id: number;
            requestData: Record<string, unknown>;
            meta: { puestoId: number; source: 'plan' | 'asignado'; estructuraId: number | null };
          }) => {
            upsertAction({
              type: 'update',
              id: p.id,
              requestData: p.requestData,
              meta: p.meta,
            });
          }
        : undefined;

      const articulosById = new Map<number, ArticuloForm>(
        articulos.map((a) => [a.id, a] as [number, ArticuloForm])
      );
      await rewritePuestoArticulosInMainStructure({
        puestoId,
        formsById: articulosById,
        horaAccionMs: horaAccion,
        origin: 'entrega_puestos',
        enqueueUpdate: enqueueFn,
      });
      if (shouldEnqueueActions) {
        await AsyncStorage.setItem(actionsKey, JSON.stringify(actionsArr));
      }
    } catch (e) {
      console.error('Error updating main_structure_cache after entrega-puestos:', e);
    }
  };

  const formatDate = (date: Date | string): string => {
    if (typeof date === 'string') {
      return convertDateTimestampToLocalString(date, false);
    }
    return convertDateTimestampToLocalString(new Date(date).toISOString(), false);
  };

  const toApiDateYmd = (value: string | Date | null | undefined): string | null => {
    if (value == null || value === '') return null;

    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) return null;
      const y = value.getFullYear();
      const m = String(value.getMonth() + 1).padStart(2, '0');
      const d = String(value.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }

    const s = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    if (/^\d{2}-\d{2}-\d{4}$/.test(s)) {
      const [day, month, year] = s.split('-');
      return `${year}-${month}-${day}`;
    }

    const parsed = new Date(s);
    if (Number.isNaN(parsed.getTime())) return null;

    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const formatTime = (time: string | Date): string => {
    if (!time) return 'No definido';
    if (typeof time === 'string') {
      // Si es un string de tiempo (HH:MM:SS o HH:MM)
      const parts = time.split(':');
      if (parts.length >= 2) {
        return `${parts[0]}:${parts[1]}`;
      }
      return time;
    }
    // Si es un Date
    const hours = String(time.getHours()).padStart(2, '0');
    const minutes = String(time.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const currentMarcaStr = await AsyncStorage.getItem('current_marca');
      if (!currentMarcaStr) {
        setError('No hay marca actual activa');
        setIsLoading(false);
        return;
      }

      const currentMarcaData = JSON.parse(currentMarcaStr);
      setCurrentMarca(currentMarcaData);

      // Cargar jerarquía principal para filtros de ADMINISTRATIVO / SUPERVISOR
      try {
        setIsStructureLoading(true);
        const cache = await AsyncStorage.getItem('main_structure_cache');
        const parsed = cache ? JSON.parse(cache) : [];
        setMainStructure(Array.isArray(parsed) ? parsed : []);
      } catch (e) {
        console.error('Error loading main_structure_cache in EntregaPuestosScreen:', e);
        setMainStructure([]);
      } finally {
        setIsStructureLoading(false);
      }

      const isConnected = await getConnectionStatus();
      if (!isConnected) {
        setError('Se requiere conexión a internet para cargar los datos');
        setIsLoading(false);
        return;
      }

      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) {
        throw new Error('Server URL not configured');
      }
      const response = await authedFetch({
        url: `${apiUrl}/api/entrega-puestos?m=${currentMarcaData.id}`,
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
      if (!data.status) {
        const message = data.message || 'Error al cargar los datos';
        if (message === 'Ya has registrado la entrega de puesto para este turno') {
          setHasEntregaTurno(true);
          setError(null);
          setShowRecordsList(true);
          await fetchEntregaRecordsByPuesto(currentMarcaData?.puesto?.id ?? null);
        } else {
          setError(message);
        }
        setIsLoading(false);
        return;
      }

      setInfo(data.info);

      // Inicializar artículos: precargar estado + cantidad_real según último mantenimiento (si existe)
      const articulosForm: ArticuloForm[] = prioritizePlanByArticuloNomencladorId(
        data.info.articulos.map((art: any) => {
          const ultimo = art?.ultimo_mantenimiento ?? null;
          const estadoUltimo = ultimo?.estado;
          const estado =
            estadoUltimo === 'Bueno' || estadoUltimo === 'Malo' || estadoUltimo === 'No está'
              ? (estadoUltimo as ArticuloForm['estado'])
              : ('Bueno' as const);

          const cantidadRealRaw =
            typeof ultimo?.cantidad_real === 'number'
              ? ultimo.cantidad_real
              : typeof art?.cantidad === 'number'
                ? art.cantidad
                : Number(art?.cantidad) || 0;

          const cantidad_real = estado === 'No está' ? 0 : Math.max(0, Number(cantidadRealRaw) || 0);

          return {
            id: art.id,
            nombre: art.nombre,
            tipo: art.tipo || '',
            articulo_nomenclador_id: Number.isFinite(Number(art?.articulo_nomenclador_id))
              ? Number(art.articulo_nomenclador_id)
              : null,
            cantidad_requerida: typeof art?.cantidad === 'number' ? art.cantidad : Number(art?.cantidad) || 0,
            cantidad_real,
            estado,
            observaciones: art.observaciones || '',
            ultimo_mantenimiento_id:
              ultimo?.id != null && Number(ultimo.id) > 0 ? Number(ultimo.id) : null,
            mantenimiento_files: [],
          };
        }),
      );
      setArticulos(articulosForm);
    } catch (err: any) {
      console.error('Error loading data:', err);
      setError(err.message || 'Error al cargar los datos');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const isTimeParsable = (value: string | Date | null | undefined): boolean => {
    if (!value) return false;
    if (typeof value === 'string') {
      return value.includes(':');
    }
    return true;
  };

  const formatDateOnly = (value: string | Date | null | undefined): string => {
    if (!value) return 'No definido';
    if (typeof value === 'string') {
      return convertDateTimestampToLocalString(value, false);
    }
    return convertDateTimestampToLocalString(new Date(value).toISOString(), false);
  };

  const formatTimeOnly = (value: string | Date | null | undefined): string => {
    if (!value) return 'No definido';
    if (typeof value === 'string') {
      const parts = value.includes('T') ? value.split('T')[1] : value;
      const timePart = parts.split('.')[0];
      return timePart || value;
    }
    const hours = String(value.getHours()).padStart(2, '0');
    const minutes = String(value.getMinutes()).padStart(2, '0');
    const seconds = String(value.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  const fetchEntregaRecordsByPuesto = async (puestoId: number | null) => {
    if (!puestoId) {
      setRecords([]);
      return;
    }
    try {
      setIsLoadingRecords(true);
      const isConnected = await getConnectionStatus();
      if (!isConnected) {
        Alert.alert('Modo offline', 'Se requiere conexión a internet para cargar los registros.');
        setRecords([]);
        return;
      }

      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) {
        throw new Error('Server URL not configured');
      }

      const response = await authedFetch({
        url: `${apiUrl}/api/entrega-puestos/puesto/${puestoId}`,
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
      if (!data.status) {
        throw new Error(data.message || 'Error al cargar los registros');
      }

      const registros = Array.isArray(data.registros) ? data.registros : [];
      const parsed: EntregaPuestoRecord[] = registros.map((r: any) => ({
        id: r.id,
        oficial_entrega: r.oficial_entrega,
        fecha_entrada_entrega: r.fecha_entrada_entrega,
        fecha_salida_entrega: r.fecha_salida_entrega,
        hora_entrada_entrega: r.hora_entrada_entrega,
        hora_salida_entrega: r.hora_salida_entrega,
        turno_entrega: r.turno_entrega,
        marca_entrega_id: r.marca_entrega_id != null ? Number(r.marca_entrega_id) : null,
        oficial_recibe: r.oficial_recibe,
        fecha_entrada_recibe: r.fecha_entrada_recibe,
        fecha_salida_recibe: r.fecha_salida_recibe,
        hora_entrada_recibe: r.hora_entrada_recibe,
        hora_salida_recibe: r.hora_salida_recibe,
        turno_recibe: r.turno_recibe,
        marca_recibe_id: r.marca_recibe_id != null ? Number(r.marca_recibe_id) : null,
        articulos_puesto: Array.isArray(r.articulos_puesto) ? r.articulos_puesto : [],
        observaciones: r.observaciones || '',
        firma_recibe: r.firma_recibe,
        firma_entrega: r.firma_entrega ?? null,
        firma_responsable: r.firma_responsable,
        image_delivery: r.image_delivery ? String(r.image_delivery) : null,
        image_receives: r.image_receives ? String(r.image_receives) : null,
        created_at: r.created_at,
        created_by: r.created_by,
      }));

      setRecords(parsed);
    } catch (err: any) {
      console.error('Error fetching entrega-puestos records by puesto:', err);
      Alert.alert('Error', err.message || 'No se pudieron cargar los registros');
    } finally {
      setIsLoadingRecords(false);
    }
  };

  const handleArticuloEstadoChange = (index: number, estado: 'Bueno' | 'Malo' | 'No está') => {
    const newArticulos = [...articulos];
    newArticulos[index].estado = estado;
    if (estado === 'No está') {
      newArticulos[index].cantidad_real = 0;
    }
    setArticulos(newArticulos);
  };

  const handleArticuloCantidadChange = (index: number, cantidad: number) => {
    const newArticulos = [...articulos];
    newArticulos[index].cantidad_real = cantidad;
    if (cantidad === 0) {
      newArticulos[index].estado = 'No está';
    }
    setArticulos(newArticulos);
  };

  const handleArticuloObservacionesChange = (index: number, observaciones: string) => {
    const newArticulos = [...articulos];
    newArticulos[index].observaciones = observaciones;
    setArticulos(newArticulos);
  };

  const handleArticuloMantenimientoFilesChange = (
    index: number,
    files: ArticuloMantenimientoPendingFile[],
  ) => {
    setArticulos((prev) =>
      prev.map((a, i) => (i === index ? { ...a, mantenimiento_files: files } : a)),
    );
  };

  const openSignatureModal = (target: 'firma_recibe' | 'firma_entrega') => {
    setSignatureTarget(target);
    setIsSignatureModalVisible(true);
    setSignatureKey(prev => prev + 1);
  };

  const handleSignatureOK = (signature: string) => {
    setIsReadingSignature(false);
    if (!signature || !signature.trim()) {
      Alert.alert('Firma vacía', 'Dibuja tu firma antes de guardar.');
      return;
    }
    if (signatureTarget === 'firma_recibe') {
      setFirmaRecibe(signature);
    } else {
      setFirmaEntrega(signature);
    }
    setIsSignatureModalVisible(false);
    setSignatureKey(prev => prev + 1);
  };

  const clearSignatureInModal = () => {
    try {
      signatureRef.current?.clearSignature?.();
    } catch { }
    setIsReadingSignature(false);
  };

  const acceptSignature = () => {
    try {
      setIsReadingSignature(true);
      signatureRef.current?.readSignature?.();
    } catch {
      setIsReadingSignature(false);
      Alert.alert('Error', 'No se pudo leer la firma. Intenta nuevamente.');
    }
  };

  const handleSignatureClear = () => {
    if (signatureTarget === 'firma_recibe') {
      setFirmaRecibe('');
    } else {
      setFirmaEntrega('');
    }
    setSignatureKey(prev => prev + 1);
  };

  const handleGenerateFirma = async () => {
    if (isGeneratingFirma) return;
    setIsGeneratingFirma(true);
    try {
      if (!employee) {
        Alert.alert('Error', 'No se pudo obtener la información del empleado');
        return;
      }
      const hash = await getCurrentUserDigitalSignature(employee);
      if (!hash) return;
      setFirmaResponsable(hash);
    } finally {
      setIsGeneratingFirma(false);
    }
  };

  const handleScanFirma = async () => {
    try {
      const qrData = await scanQR();
      if (!qrData) return;
      setFirmaResponsable(qrData);
    } catch {
      Alert.alert('Error', 'No se pudo escanear el QR');
    }
  };

  const calculateFechaSalida = (
    fecha: string,
    horaInicio: string | null | undefined,
    horaFin: string | null | undefined
  ): string => {
    if (!horaInicio || !horaFin) {
      return 'Indeterminable';
    }
    const fechaObj = new Date(fecha);
    // Comparar solo las horas, no las fechas completas
    const inicioParts = horaInicio.split(':');
    const finParts = horaFin.split(':');
    const inicioHour = parseInt(inicioParts[0]) || 0;
    const inicioMin = parseInt(inicioParts[1]) || 0;
    const finHour = parseInt(finParts[0]) || 0;
    const finMin = parseInt(finParts[1]) || 0;

    const inicioMinutes = inicioHour * 60 + inicioMin;
    const finMinutes = finHour * 60 + finMin;

    if (inicioMinutes >= finMinutes) {
      // Si hora_inicio >= hora_fin, la fecha de fin es el día siguiente
      fechaObj.setDate(fechaObj.getDate() + 1);
    }
    return formatDate(fechaObj);
  };

  const handleSave = async () => {
    if (!currentMarca || !info) {
      Alert.alert('Error', 'Faltan datos necesarios');
      return;
    }

    if (!firmaRecibe) {
      Alert.alert('Error', 'Debe registrar la firma de quien recibe');
      return;
    }

    if (!photoRecibeBase64) {
      Alert.alert('Error', 'Debe tomar la foto de quien recibe');
      return;
    }

    Alert.alert(
      'Confirmar',
      '¿Desea guardar el registro de entrega de puesto?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Guardar',
          onPress: async () => {
            setIsSubmitting(true);
            setSubmitResponse(null);
            try {
              setIsCreating(true);

              const fechaEntradaEntrega = formatDate(info.previous_marca.fecha);
              const fechaSalidaEntrega = calculateFechaSalida(
                info.previous_marca.fecha,
                info.previous_marca.hora_inicio,
                info.previous_marca.hora_fin
              );
              const horaEntradaEntrega = formatTime(info.previous_marca.hora_inicio);
              const horaSalidaEntrega = formatTime(info.previous_marca.hora_fin);

              const fechaEntradaRecibe = formatDate(currentMarca.fecha);
              const fechaSalidaRecibe = calculateFechaSalida(
                currentMarca.fecha,
                currentMarca.hora_inicio,
                currentMarca.hora_fin
              );
              const horaEntradaRecibe = formatTime(currentMarca.hora_inicio);
              const horaSalidaRecibe = formatTime(currentMarca.hora_fin);

              const horaAccion = await getHoraAccion();
              if (!horaAccion) {
                throw new Error('No se pudo obtener la hora de acción');
              }
              const horaAccionIso = new Date(horaAccion).toISOString();
              const articulosPuestoStorage =
                articulos && articulos.length > 0
                  ? serializeArticulosPuestoForStorage(articulos, horaAccionIso)
                  : '[]';

              const isConnected = await getConnectionStatus();
              const articulosPuestoForRequest = isConnected
                ? await hydrateArticulosPuestoFilesForApi(articulosPuestoStorage)
                : articulosPuestoStorage;

              const isSelfDelivery = Boolean(info.is_self_delivery);
              const marcaRecibeId = currentMarca.id;
              const marcaEntregaId = isSelfDelivery
                ? null
                : (info.marca_entrega_id ?? info.previous_marca?.id ?? null);

              const fechaEntradaEntregaApi = toApiDateYmd(fechaEntradaEntrega);
              const fechaSalidaEntregaApi = toApiDateYmd(fechaSalidaEntrega);
              const fechaEntradaRecibeApi = toApiDateYmd(fechaEntradaRecibe);
              const fechaSalidaRecibeApi = toApiDateYmd(fechaSalidaRecibe);

              const requestData = {
                cliente_id: currentMarca.cliente.id,
                corpo_id: currentMarca.corpo.id,
                puesto_id: currentMarca.puesto.id,
                division: currentMarca.roleDivision.division.id,
                oficial_entrega: isSelfDelivery ? null : info.previous_employee.nombre,
                fecha_entrada_entrega: isSelfDelivery
                  ? null
                  : fechaEntradaEntregaApi ?? '1970-01-01',
                fecha_salida_entrega: isSelfDelivery
                  ? null
                  : fechaSalidaEntregaApi ?? '1970-01-01',
                hora_entrada_entrega: isSelfDelivery
                  ? null
                  : isTimeParsable(horaEntradaEntrega)
                    ? horaEntradaEntrega
                    : '1970-01-01T00:00',
                hora_salida_entrega: isSelfDelivery
                  ? null
                  : isTimeParsable(horaSalidaEntrega)
                    ? horaSalidaEntrega
                    : '1970-01-01T00:00',
                turno_entrega: isSelfDelivery ? null : info.previous_marca.tipo_turno,
                marca_entrega_id: marcaEntregaId,
                oficial_recibe: employee?.name || 'Desconocido',
                fecha_entrada_recibe: fechaEntradaRecibeApi ?? '1970-01-01',
                fecha_salida_recibe: fechaSalidaRecibeApi ?? '1970-01-01',
                hora_entrada_recibe: isTimeParsable(horaEntradaRecibe) ? horaEntradaRecibe : '1970-01-01T00:00',
                hora_salida_recibe: isTimeParsable(horaSalidaRecibe) ? horaSalidaRecibe : '1970-01-01T00:00',
                turno_recibe: currentMarca.tipo_turno,
                marca_recibe_id: marcaRecibeId,
                articulos_puesto: articulosPuestoForRequest,
                observaciones: observaciones,
                firma_recibe: firmaRecibe,
                firma_entrega: isSelfDelivery ? null : (firmaEntrega || null),
                firma_responsable: firmaResponsable,
                image_receives: photoRecibeBase64,
                image_delivery: isSelfDelivery ? null : (photoEntregaBase64 || null),
                marca_id: marcaRecibeId,
              };

              if (isConnected) {
                const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
                if (!apiUrl) {
                  throw new Error('Server URL not configured');
                }
                const response = await authedFetch({
                  url: `${apiUrl}/api/entrega-puestos`,
                  init: {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestData),
                  },
                  refreshAccessToken,
                  logout,
                });
                if (!response) return;

                if (!response.ok) {
                  const errorData = await response.json();
                  throw new Error(errorData.message || 'Error al guardar');
                }

                const data = await response.json();
                if (!data.status) {
                  throw new Error(data.message || 'Error al guardar');
                }

                // Actualizar caches locales con el nuevo estado de mantenimiento de los artículos
                await updateMainStructureCacheWithEntrega({ enqueueActions: false });
                await updateActivitiesCacheWithEntrega();

                Alert.alert('Éxito', data.message || 'Registro de entrega de puesto guardado correctamente');
                setTimeout(() => {
                  navigation.goBack();
                }, 2000);
              } else {
                // Modo offline
                const localId = generateRandomId();
                const actionsStr = await AsyncStorage.getItem('entrega_puestos_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  requestData,
                  marcaId: currentMarca.id,
                  id: localId,
                  type: 'create',
                });
                await AsyncStorage.setItem('entrega_puestos_actions', JSON.stringify(actions));

                // Mantener consistencia offline de caches y encolar sincronización de mantenimiento de artículos
                await updateMainStructureCacheWithEntrega({ enqueueActions: true });
                await updateActivitiesCacheWithEntrega();

                Alert.alert('Éxito', 'Registro guardado localmente. Se sincronizará cuando haya conexión.');
                setTimeout(() => {
                  navigation.goBack();
                }, 2000);
              }
            } catch (err: any) {
              console.error('Error saving:', err);
              Alert.alert('Error', err.message || 'No se pudo guardar el registro');
            } finally {
              setIsCreating(false);
              setIsSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const getInvolucrados = (involucrados: string) => {
    const involucradosArray = JSON.parse(involucrados);
    return involucradosArray
      .map((involucrado: { nombre?: string; codigo?: string }) =>
        `${involucrado.nombre} (${involucrado.codigo || ''})`.trim()
      )
      .join(', ');
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader onMenuPress={() => setIsMenuVisible(true)} title="Entrega de Puestos" />
        <ThemedView style={styles.centerContent}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Cargando datos...</ThemedText>
        </ThemedView>
        <AppFooter />
        <SlideMenu
          isVisible={isMenuVisible}
          onClose={() => setIsMenuVisible(false)}
          onHomePress={handleHomePress}
          currentRoute="EntregaPuestos"
        />
      </ThemedView>
    );
  }

  if (error || !currentMarca) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader onMenuPress={() => setIsMenuVisible(true)} title="Entrega de Puestos" />
        <ThemedView style={styles.centerContent}>
          <ThemedText style={styles.errorText}>{error || 'No se pudieron cargar los datos'}</ThemedText>
          <TouchableOpacity style={styles.retryButton} onPress={loadData}>
            <ThemedText style={styles.retryButtonText}>Reintentar</ThemedText>
          </TouchableOpacity>
        </ThemedView>
        <AppFooter />
        <SlideMenu
          isVisible={isMenuVisible}
          onClose={() => setIsMenuVisible(false)}
          onHomePress={handleHomePress}
          currentRoute="EntregaPuestos"
        />
      </ThemedView>
    );
  }

  const isSelfDelivery = Boolean(
    info?.is_self_delivery ??
    (
      info?.previous_employee?.id &&
      (
        Number(employee?.id) === Number(info.previous_employee.id) ||
        Number(currentMarca.empleadoFijo_id) === Number(info.previous_employee.id)
      )
    ),
  );

  const fechaEntradaEntrega = info && !isSelfDelivery ? formatDate(info.previous_marca.fecha) : '';
  const horaEntradaEntrega = info && !isSelfDelivery ? formatTime(info.previous_marca.hora_inicio) : '';
  const horaSalidaEntrega = info && !isSelfDelivery ? formatTime(info.previous_marca.hora_fin) : '';

  const fechaEntradaRecibe = formatDate(currentMarca.fecha);
  const horaEntradaRecibe = formatTime(currentMarca.hora_inicio);
  const horaSalidaRecibe = formatTime(currentMarca.hora_fin);

  const getTurnoLabel = (tipoTurno?: string): string => {
    switch ((tipoTurno || '').toUpperCase()) {
      case 'D':
        return 'Diurno';
      case 'N':
        return 'Nocturno';
      case 'M':
        return 'Mixto';
      default:
        return tipoTurno || 'No definido';
    }
  };

  const formatDateTimeValue = (fecha: string, hora: string): string => {
    if (!fecha && !hora) return 'No definido';
    if (!fecha) return hora;
    if (!hora) return fecha;
    return `${fecha} ${hora.split('T')[1]}`;
  };

  const dataLecturaEntrega = info && !isSelfDelivery
    ? [
      { label: 'Cliente', value: currentMarca.cliente.nombre },
      { label: 'Sucursal', value: currentMarca.corpo.nombre },
      { label: 'Puesto', value: currentMarca.puesto.nombre },
      { label: 'Oficial', value: info.previous_employee.nombre },
      { label: 'Fecha', value: fechaEntradaEntrega },
      { label: 'Hora entrada', value: horaEntradaEntrega.split('T')[1] },
      { label: 'Hora salida', value: horaSalidaEntrega.split('T')[1] },
      { label: 'Turno', value: getTurnoLabel(info.previous_marca.tipo_turno) },
    ]
    : [];

  const dataLecturaRecibe = [
    { label: 'Cliente', value: currentMarca.cliente.nombre },
    { label: 'Sucursal', value: currentMarca.corpo.nombre },
    { label: 'Puesto', value: currentMarca.puesto.nombre },
    { label: 'Oficial', value: employee?.name || 'Desconocido' },
    { label: 'Fecha', value: fechaEntradaRecibe },
    { label: 'Hora entrada', value: horaEntradaRecibe.split('T')[1] },
    { label: 'Hora salida', value: horaSalidaRecibe.split('T')[1] },
    { label: 'Turno', value: getTurnoLabel(currentMarca.tipo_turno) },
  ];

  const renderLecturaCard = (title: string, iconName: 'arrow-up-circle-outline' | 'arrow-down-circle-outline', data: Array<{ label: string; value: string }>) => (
    <ThemedView style={styles.readingCard}>
      <ThemedView style={styles.readingCardHeader}>
        <Ionicons name={iconName} size={18} color="#007AFF" />
        <ThemedText style={styles.readingCardTitle}>{title}</ThemedText>
      </ThemedView>
      <ThemedView style={styles.readingCardDetails}>
        {data.map((item) => (
          <ThemedView key={`${title}-${item.label}`} style={styles.readingCardRow}>
            <ThemedText style={styles.readingCardLabel}>{item.label}</ThemedText>
            <ThemedText style={styles.readingCardValue}>{item.value || 'No definido'}</ThemedText>
          </ThemedView>
        ))}
      </ThemedView>
    </ThemedView>
  );

  const isAdminOrSupervisor =
    currentMarca?.roleDivision?.role?.nombre === 'ADMINISTRATIVO' ||
    currentMarca?.roleDivision?.role?.nombre === 'SUPERVISOR';

  const selectedEmpresa = filterEmpresaId != null
    ? mainStructure.find((e) => e.id === filterEmpresaId) || null
    : null;
  const selectedCliente = selectedEmpresa && filterClienteId != null
    ? selectedEmpresa.clientes.find((c) => c.id === filterClienteId) || null
    : null;
  const selectedDivision = selectedCliente && filterDivisionId != null
    ? selectedCliente.division.find((d) => d.id === filterDivisionId) || null
    : null;
  const selectedContrato = selectedDivision && filterContratoId != null
    ? selectedDivision.contratos.find((c) => c.id === filterContratoId) || null
    : null;
  const selectedSucursal = selectedContrato && filterSucursalId != null
    ? selectedContrato.sucursales.find((s) => s.id === filterSucursalId) || null
    : null;

  const handleToggleRecordsView = async () => {
    const next = !showRecordsList;
    setShowRecordsList(next);
    if (next && records.length === 0) {
      const puestoIdToLoad = filterPuestoId ?? currentMarca?.puesto?.id ?? null;
      await fetchEntregaRecordsByPuesto(puestoIdToLoad);
    }
  };

  const renderRecordCard = (record: EntregaPuestoRecord) => {
    const decodedFirma = decodeFirmaHash(record.firma_responsable);
    const hasEntregaData = Boolean(record.oficial_entrega);
    return (
      <ThemedView key={record.id} style={styles.recordCard}>
        <ThemedText style={styles.recordTitle}>Registro #{record.id}</ThemedText>
        {hasEntregaData ? (
          <>
            <ThemedText style={styles.recordLine}>
              <ThemedText style={styles.recordLabel}>Oficial entrega: </ThemedText>
              <ThemedText style={styles.recordValue}>{record.oficial_entrega}</ThemedText>
            </ThemedText>
            <ThemedText style={styles.recordLine}>
              <ThemedText style={styles.recordLabel}>Entrada entrega: </ThemedText>
              <ThemedText style={styles.recordValue}>
                {formatDateOnly(record.fecha_entrada_entrega)} {formatTimeOnly(record.hora_entrada_entrega)}
              </ThemedText>
            </ThemedText>
            <ThemedText style={styles.recordLine}>
              <ThemedText style={styles.recordLabel}>Salida entrega: </ThemedText>
              <ThemedText style={styles.recordValue}>
                {formatDateOnly(record.fecha_salida_entrega)} {formatTimeOnly(record.hora_salida_entrega)}
              </ThemedText>
            </ThemedText>
            <ThemedText style={styles.recordLine}>
              <ThemedText style={styles.recordLabel}>Turno entrega: </ThemedText>
              <ThemedText style={styles.recordValue}>{getTurnoLabel(record.turno_entrega || '')}</ThemedText>
            </ThemedText>
          </>
        ) : (
          <ThemedText style={styles.recordLine}>
            <ThemedText style={styles.recordLabel}>Entrega: </ThemedText>
            <ThemedText style={styles.recordValue}>Recepción directa (sin oficial que entrega)</ThemedText>
          </ThemedText>
        )}
        <ThemedText style={styles.recordLine}>
          <ThemedText style={styles.recordLabel}>Oficial recibe: </ThemedText>
          <ThemedText style={styles.recordValue}>{record.oficial_recibe}</ThemedText>
        </ThemedText>
        <ThemedText style={styles.recordLine}>
          <ThemedText style={styles.recordLabel}>Entrada recibe: </ThemedText>
          <ThemedText style={styles.recordValue}>
            {formatDateOnly(record.fecha_entrada_recibe)} {formatTimeOnly(record.hora_entrada_recibe)}
          </ThemedText>
        </ThemedText>
        <ThemedText style={styles.recordLine}>
          <ThemedText style={styles.recordLabel}>Salida recibe: </ThemedText>
          <ThemedText style={styles.recordValue}>
            {formatDateOnly(record.fecha_salida_recibe)} {formatTimeOnly(record.hora_salida_recibe)}
          </ThemedText>
        </ThemedText>
            <ThemedText style={styles.recordLine}>
              <ThemedText style={styles.recordLabel}>Turno recibe: </ThemedText>
              <ThemedText style={styles.recordValue}>{getTurnoLabel(record.turno_recibe)}</ThemedText>
            </ThemedText>
            {record.marca_recibe_id ? (
              <ThemedText style={styles.recordLine}>
                <ThemedText style={styles.recordLabel}>Marca recibe: </ThemedText>
                <ThemedText style={styles.recordValue}>#{record.marca_recibe_id}</ThemedText>
              </ThemedText>
            ) : null}
            {record.marca_entrega_id ? (
              <ThemedText style={styles.recordLine}>
                <ThemedText style={styles.recordLabel}>Marca entrega: </ThemedText>
                <ThemedText style={styles.recordValue}>#{record.marca_entrega_id}</ThemedText>
              </ThemedText>
            ) : null}
            <ThemedText style={styles.recordLine}>
          <ThemedText style={styles.recordLabel}>Observaciones: </ThemedText>
          <ThemedText style={styles.recordValue}>{record.observaciones || 'Sin observaciones'}</ThemedText>
        </ThemedText>

        <ThemedView style={styles.recordPhotosRow}>
          <ThemedView style={styles.recordPhotoBlock}>
            <ThemedText style={styles.recordLabel}>Foto quien recibe</ThemedText>
            {buildEntregaPuestoImageUrl(record.id, record.image_receives) ? (
              <Image
                source={{ uri: buildEntregaPuestoImageUrl(record.id, record.image_receives) }}
                style={styles.recordPhotoImage}
                resizeMode="cover"
              />
            ) : (
              <ThemedText style={styles.recordValue}>Sin foto</ThemedText>
            )}
          </ThemedView>
          {hasEntregaData ? (
            <ThemedView style={styles.recordPhotoBlock}>
              <ThemedText style={styles.recordLabel}>Foto quien entrega</ThemedText>
              {buildEntregaPuestoImageUrl(record.id, record.image_delivery) ? (
                <Image
                  source={{ uri: buildEntregaPuestoImageUrl(record.id, record.image_delivery) }}
                  style={styles.recordPhotoImage}
                  resizeMode="cover"
                />
              ) : (
                <ThemedText style={styles.recordValue}>Sin foto</ThemedText>
              )}
            </ThemedView>
          ) : null}
        </ThemedView>

        <Collapsible title="Firmas">
          <ThemedText style={styles.recordLine}>
            <ThemedText style={styles.recordLabel}>Firma recibe: </ThemedText>
          </ThemedText>
          {record.firma_recibe ? (
            <Image
              source={{ uri: record.firma_recibe }}
              style={styles.signaturePreviewImageSmall}
              resizeMode="contain"
            />
          ) : (
            <ThemedText style={styles.recordValue}>No registrada</ThemedText>
          )}
          {hasEntregaData ? (
            <>
              <ThemedText style={[styles.recordLine, { marginTop: 6 }]}>
                <ThemedText style={styles.recordLabel}>Firma entrega: </ThemedText>
              </ThemedText>
              {record.firma_entrega ? (
                <Image
                  source={{ uri: record.firma_entrega }}
                  style={styles.signaturePreviewImageSmall}
                  resizeMode="contain"
                />
              ) : (
                <ThemedText style={styles.recordValue}>No registrada</ThemedText>
              )}
            </>
          ) : null}
          <ThemedText style={[styles.recordLine, { marginTop: 6 }]}>
            <ThemedText style={styles.recordLabel}>Firma responsable (digital): </ThemedText>
          </ThemedText>
          {decodedFirma ? (
            <ThemedView style={styles.firmaInfoBoxRecord}>
              <ThemedText style={styles.firmaInfoTitle}>Información de la firma:</ThemedText>
              <ThemedText style={styles.firmaInfoValue}>Sesión: {decodedFirma.sessionId || 'N/A'}</ThemedText>
              <ThemedText style={styles.firmaInfoValue}>Empleado: {decodedFirma.empleadoId || 'N/A'}</ThemedText>
              <ThemedText style={styles.firmaInfoValue}>
                Lat: {decodedFirma.latitud || 'N/A'} | Long: {decodedFirma.longitud || 'N/A'}
              </ThemedText>
              <ThemedText style={styles.firmaInfoValue}>Hora: { convertDateTimestampToLocalString(new Date(Number(decodedFirma.timestamp)).toISOString()) || 'N/A'}</ThemedText>
            </ThemedView>
          ) : (
            <ThemedText style={styles.recordValue}>No se pudo decodificar la firma</ThemedText>
          )}
        </Collapsible>

        <Collapsible title="Artículos del puesto">
          {record.articulos_puesto && record.articulos_puesto.length > 0 ? (
            record.articulos_puesto.map((art, index) => (
              <ThemedView key={`${record.id}-art-${index}`} style={styles.recordArticuloRow}>
                <ThemedText style={styles.recordArticuloNombre}>{art.nombre}</ThemedText>
                <ThemedText style={styles.recordArticuloDetail}>
                  Estado: {art.estado || 'No definido'}
                </ThemedText>
                <ThemedText style={styles.recordArticuloDetail}>
                  Cant. requerida: {art.cantidad_requerida} | Cant. real: {art.cantidad_real}
                </ThemedText>
                {art.observaciones ? (
                  <ThemedText style={styles.recordArticuloDetail}>
                    Observaciones: {art.observaciones}
                  </ThemedText>
                ) : null}
              </ThemedView>
            ))
          ) : (
            <ThemedText style={styles.recordValue}>No hay artículos registrados.</ThemedText>
          )}
        </Collapsible>
      </ThemedView>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <AppHeader onMenuPress={() => setIsMenuVisible(true)} title="Entrega de Puestos" />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <ThemedView style={styles.content}>
          {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}

          <ThemedView style={styles.titleContainer}>
            <ThemedText type="title" style={styles.title}>
              <Ionicons name="briefcase" size={22} color="#000000" /> Entrega de Puestos
            </ThemedText>
            <ThemedText style={styles.subtitle}>Registro de entrega y recepción de puestos</ThemedText>
          </ThemedView>

          <ThemedView style={styles.toggleBar}>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                showRecordsList && styles.toggleButtonActive,
              ]}
              onPress={handleToggleRecordsView}
            >
              <Ionicons
                name={showRecordsList ? 'arrow-forward-circle' : 'list-outline'}
                size={16}
                color={showRecordsList ? '#FFFFFF' : '#007AFF'}
              />
              <ThemedText
                style={[
                  styles.toggleButtonText,
                  showRecordsList && styles.toggleButtonTextActive,
                ]}
              >
                {showRecordsList ? 'Realizar entrega de puesto' : 'Ver registros'}
              </ThemedText>
            </TouchableOpacity>
          </ThemedView>

        {!showRecordsList && hasEntregaTurno && (
            <ThemedView style={styles.infoBanner}>
              <Ionicons name="information-circle-outline" size={18} color="#FF9500" />
              <ThemedText style={styles.infoBannerText}>
                Ya has registrado la entrega de puesto para este turno. Puedes revisar tus registros a continuación.
              </ThemedText>
            </ThemedView>
          )}

          {/* Formulario principal */}
          {!showRecordsList && info && (
          <ThemedView style={styles.formCard}>
            <ThemedText style={styles.formTitle}>Datos de Entrega y Recepción</ThemedText>

            {/* Sección de datos informativos */}
            <ThemedView style={styles.infoSection}>
              <ThemedText style={styles.sectionTitle}>Datos de Lectura</ThemedText>
              {isSelfDelivery ? (
                <ThemedView style={styles.infoBanner}>
                  <Ionicons name="information-circle-outline" size={18} color="#007AFF" />
                  <ThemedText style={styles.infoBannerText}>
                    Estás registrando la recepción del puesto para tu propio turno. No se requiere información del oficial que entrega.
                  </ThemedText>
                </ThemedView>
              ) : null}
              <ThemedView style={styles.readingCardsContainer}>
                {!isSelfDelivery ? renderLecturaCard('Entrega', 'arrow-up-circle-outline', dataLecturaEntrega) : null}
                {renderLecturaCard('Recibe', 'arrow-down-circle-outline', dataLecturaRecibe)}
              </ThemedView>
            </ThemedView>

            {/* Sección de incidentes */}
            <ThemedView style={styles.infoSection}>
              <ThemedText style={styles.sectionTitle}>Incidentes</ThemedText>
              {info.incidentes.length > 0 ? (
                info.incidentes.map((incidente) => (
                  <ThemedView key={incidente.id} style={styles.bitacoraCard}>
                    <ThemedText style={styles.bitTitle}>ID: {incidente.id}</ThemedText>
                    <ThemedText style={styles.bitLine}>
                      <ThemedText style={styles.bitLabel}>Clasificación: </ThemedText>
                      <ThemedText style={styles.bitValue}>{incidente.clasificacion}</ThemedText>
                    </ThemedText>
                    <ThemedText style={styles.bitLine}>
                      <ThemedText style={styles.bitLabel}>Descripción: </ThemedText>
                      <ThemedText style={styles.bitValue}>{incidente.description}</ThemedText>
                    </ThemedText>
                    <ThemedText style={styles.bitLine}>
                      <ThemedText style={styles.bitLabel}>Involucrados: </ThemedText>
                      <ThemedText style={styles.bitValue}>{getInvolucrados(incidente.involucrados)}</ThemedText>
                    </ThemedText>
                    <ThemedText style={styles.bitLine}>
                      <ThemedText style={styles.bitLabel}>Estado: </ThemedText>
                      <ThemedText style={styles.bitValue}>{incidente.estado ? 'Activo' : 'Resuelto'}</ThemedText>
                    </ThemedText>
                    <ThemedText style={styles.bitLine}>
                      <ThemedText style={styles.bitLabel}>Responsable: </ThemedText>
                      <ThemedText style={styles.bitValue}>{incidente.responsable}</ThemedText>
                    </ThemedText>
                  </ThemedView>
                ))
              ) : (
                <ThemedText style={styles.emptySectionText}>No hay incidentes para mostrar.</ThemedText>
              )}
            </ThemedView>

            {/* Sección de notas */}
            <ThemedView style={styles.infoSection}>
              <ThemedText style={styles.sectionTitle}>Novedades</ThemedText>
              {info.notas.length > 0 ? (
                info.notas.map((nota) => (
                  <ThemedView key={nota.id} style={styles.bitacoraCard}>
                    <ThemedText style={styles.bitTitle}>{nota.titulo}</ThemedText>
                    <ThemedText style={styles.bitLine}>
                      <ThemedText style={styles.bitValue}>{nota.description}</ThemedText>
                    </ThemedText>
                    {nota.categoria && (
                      <ThemedText style={styles.bitLine}>
                        <ThemedText style={styles.bitLabel}>Categoría: </ThemedText>
                        <ThemedText style={styles.bitValue}>{nota.categoria}</ThemedText>
                      </ThemedText>
                    )}
                    <ThemedText style={styles.bitLine}>
                      <ThemedText style={styles.bitLabel}>Empleado: </ThemedText>
                      <ThemedText style={styles.bitValue}>{nota.empleado}</ThemedText>
                    </ThemedText>
                    <ThemedText style={styles.bitLine}>
                      <ThemedText style={styles.bitLabel}>Fecha: </ThemedText>
                      <ThemedText style={styles.bitValue}>{ convertDateTimestampToLocalString(new Date(nota.updated_at).toISOString()) || 'N/A'}</ThemedText>
                    </ThemedText>
                  </ThemedView>
                ))
              ) : (
                <ThemedText style={styles.emptySectionText}>No hay novedades para mostrar.</ThemedText>
              )}
            </ThemedView>

            {/* Sección de artículos */}
            <ThemedView style={styles.infoSection}>
              <ThemedText style={styles.sectionTitle}>Artículos</ThemedText>
              {articulos.length > 0 ? (
                <View style={styles.tableWrapper}>
                  {/* Columna fija: Artículo */}
                  <View style={styles.tableFixedColumn}>
                    {/* Encabezado fijo */}
                    <View style={styles.tableHeaderFixed}>
                      <View style={styles.tableHeaderCellFirst}>
                        <ThemedText style={styles.tableHeaderText}>Artículo</ThemedText>
                      </View>
                    </View>
                    {/* Filas fijas */}
                    {articulos.map((articulo, index) => (
                      <View key={articulo.id} style={styles.tableRowFixed}>
                        <View style={styles.tableCellFirst}>
                          <ThemedText style={styles.tableCellFirstText}>
                            {articulo.nombre}
                          </ThemedText>
                        </View>
                      </View>
                    ))}
                  </View>
                  {/* Columnas con scroll horizontal */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={true}
                    contentContainerStyle={styles.articulosScrollContent}
                    style={styles.articulosScrollView}
                  >
                    <View style={styles.tableScrollableContainer}>
                      {/* Encabezados de la tabla */}
                      <View style={styles.tableHeader}>
                        <View style={styles.tableHeaderCell}>
                          <ThemedText style={styles.tableHeaderText}>Estado</ThemedText>
                        </View>
                        <View style={styles.tableHeaderCell}>
                          <ThemedText style={styles.tableHeaderText}>Cant. Requerida</ThemedText>
                        </View>
                        <View style={styles.tableHeaderCell}>
                          <ThemedText style={styles.tableHeaderText}>Cant. Real</ThemedText>
                        </View>
                        <View style={styles.tableHeaderCell}>
                          <ThemedText style={styles.tableHeaderText}>Observaciones</ThemedText>
                        </View>
                        <View style={styles.tableHeaderCellArchivos}>
                          <ThemedText style={styles.tableHeaderText}>Archivos</ThemedText>
                        </View>
                      </View>
                      {/* Filas de datos */}
                      {articulos.map((articulo, index) => (
                        <View key={articulo.id} style={styles.tableRow}>
                          <View style={styles.tableCell}>
                            <View style={styles.pickerContainerTable}>
                              <Picker
                                selectedValue={articulo.estado}
                                onValueChange={(value) => handleArticuloEstadoChange(index, value)}
                                style={styles.pickerTable}
                                itemStyle={styles.pickerItemStyle}
                              >
                                <Picker.Item label="Bueno" value="Bueno" color="#000000" />
                                <Picker.Item label="Malo" value="Malo" color="#000000" />
                                <Picker.Item label="No está" value="No está" color="#000000" />
                              </Picker>
                            </View>
                          </View>
                          <View style={styles.tableCell}>
                            <ThemedText style={styles.tableCellText}>
                              {String(articulo.cantidad_requerida)}
                            </ThemedText>
                          </View>
                          <View style={styles.tableCell}>
                            <TextInput
                              style={styles.inputTable}
                              value={String(articulo.cantidad_real)}
                              onChangeText={(text) => {
                                const num = parseInt(text) || 0;
                                handleArticuloCantidadChange(index, num);
                              }}
                              keyboardType="numeric"
                              placeholderTextColor="#999"
                            />
                          </View>
                          <View style={styles.tableCell}>
                            <TextInput
                              style={[styles.inputTable, styles.textAreaTable]}
                              value={articulo.observaciones || ''}
                              onChangeText={(text) => handleArticuloObservacionesChange(index, text)}
                              placeholder="Observaciones..."
                              placeholderTextColor="#999"
                              multiline
                              numberOfLines={3}
                            />
                          </View>
                          <View style={styles.tableCellArchivos}>
                            <TouchableOpacity
                              style={styles.archivosBtn}
                              onPress={() => setArchivosModalIndex(index)}
                            >
                              <Ionicons name="attach" size={20} color="#007AFF" />
                              {(articulo.mantenimiento_files?.length ?? 0) > 0 ? (
                                <ThemedText style={styles.archivosBadge}>
                                  {articulo.mantenimiento_files!.length}
                                </ThemedText>
                              ) : null}
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              ) : (
                <ThemedText style={styles.emptySectionText}>No hay artículos para mostrar.</ThemedText>
              )}
            </ThemedView>

            {/* Observaciones */}
            <ThemedText style={styles.label}>Observaciones</ThemedText>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={observaciones}
              onChangeText={setObservaciones}
              placeholder="Ingrese observaciones..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
            />

            {/* Foto quien recibe (obligatoria) */}
            <ThemedText style={styles.sectionTitle}>Foto de quien recibe *</ThemedText>
            <ThemedView style={styles.signatureButtons}>
              <TouchableOpacity
                style={styles.signatureButton}
                onPress={() => openCameraForPhoto('receives')}
              >
                <Ionicons name="camera" size={18} color="#FFFFFF" />
                <ThemedText style={styles.signatureButtonText}>Abrir cámara</ThemedText>
              </TouchableOpacity>
            </ThemedView>
            {!photoRecibeUri ? (
              <ThemedText style={styles.signatureHintMuted}>Aún no hay foto de quien recibe.</ThemedText>
            ) : (
              <ThemedView style={styles.photoPreviewContainer}>
                <Image source={{ uri: photoRecibeUri }} style={styles.photoPreviewImage} resizeMode="cover" />
                <TouchableOpacity
                  style={styles.photoPreviewDeleteButton}
                  onPress={() => {
                    setPhotoRecibeUri('');
                    setPhotoRecibeBase64('');
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </ThemedView>
            )}

            {/* Foto quien entrega (opcional) */}
            {!isSelfDelivery ? (
              <>
                <ThemedText style={styles.sectionTitle}>Foto de quien entrega (opcional)</ThemedText>
                <ThemedView style={styles.signatureButtons}>
                  <TouchableOpacity
                    style={styles.signatureButton}
                    onPress={() => openCameraForPhoto('delivery')}
                  >
                    <Ionicons name="camera" size={18} color="#FFFFFF" />
                    <ThemedText style={styles.signatureButtonText}>Abrir cámara</ThemedText>
                  </TouchableOpacity>
                </ThemedView>
                {!photoEntregaUri ? (
                  <ThemedText style={styles.signatureHintMuted}>No se agregó foto de quien entrega.</ThemedText>
                ) : (
                  <ThemedView style={styles.photoPreviewContainer}>
                    <Image source={{ uri: photoEntregaUri }} style={styles.photoPreviewImage} resizeMode="cover" />
                    <TouchableOpacity
                      style={styles.photoPreviewDeleteButton}
                      onPress={() => {
                        setPhotoEntregaUri('');
                        setPhotoEntregaBase64('');
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="trash" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                  </ThemedView>
                )}
              </>
            ) : null}

            {/* Firma Recibe */}
            <ThemedText style={styles.sectionTitle}>Firma de quien recibe *</ThemedText>
            <ThemedView style={styles.signatureButtons}>
              <TouchableOpacity
                style={styles.signatureButton}
                onPress={() => openSignatureModal('firma_recibe')}
              >
                <Ionicons name="create-outline" size={18} color="#FFFFFF" />
                <ThemedText style={styles.signatureButtonText}>Dibujar firma</ThemedText>
              </TouchableOpacity>
            </ThemedView>
            {!firmaRecibe ? (
              <ThemedText style={styles.signatureHintMuted}>Aún no hay firma de quien recibe.</ThemedText>
            ) : (
              <ThemedView style={styles.signaturePreviewContainer}>
                <Image source={{ uri: firmaRecibe }} style={styles.signaturePreviewImage} resizeMode="contain" />
                <TouchableOpacity style={styles.firmaClearButtonTiny} onPress={() => setFirmaRecibe('')}>
                  <Ionicons name="trash" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </ThemedView>
            )}

            {/* Firma Entrega (opcional) */}
            {!isSelfDelivery ? (
              <>
                <ThemedText style={styles.sectionTitle}>Firma de quien entrega (opcional)</ThemedText>
                <ThemedView style={styles.signatureButtons}>
                  <TouchableOpacity
                    style={styles.signatureButton}
                    onPress={() => openSignatureModal('firma_entrega')}
                  >
                    <Ionicons name="create-outline" size={18} color="#FFFFFF" />
                    <ThemedText style={styles.signatureButtonText}>Dibujar firma</ThemedText>
                  </TouchableOpacity>
                </ThemedView>
                {!firmaEntrega ? (
                  <ThemedText style={styles.signatureHintMuted}>No se agregó firma de quien entrega.</ThemedText>
                ) : (
                  <ThemedView style={styles.signaturePreviewContainer}>
                    <Image source={{ uri: firmaEntrega }} style={styles.signaturePreviewImage} resizeMode="contain" />
                    <TouchableOpacity style={styles.firmaClearButtonTiny} onPress={() => setFirmaEntrega('')}>
                      <Ionicons name="trash" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                  </ThemedView>
                )}
              </>
            ) : null}

            {/* Firma Responsable */}
            <ThemedText style={styles.sectionTitle}>Firma responsable *</ThemedText>
            <ThemedView style={styles.signatureButtons}>
              <TouchableOpacity
                style={[styles.signatureButton, isGeneratingFirma && styles.signatureButtonDisabled]}
                onPress={handleGenerateFirma}
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
              <TouchableOpacity style={styles.signatureButton} onPress={handleScanFirma}>
                <Ionicons name="qr-code" size={18} color="#FFFFFF" />
                <ThemedText style={styles.signatureButtonText}>Escanear QR</ThemedText>
              </TouchableOpacity>
            </ThemedView>

            {!firmaResponsable ? (
              <ThemedText style={styles.signatureHintMuted}>Aún no hay firma responsable.</ThemedText>
            ) : (
              <ThemedView style={styles.firmaInfoBox}>
                <ThemedView style={{ flex: 1, paddingRight: 10, backgroundColor: '#F9F9F9' }}>
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
                <TouchableOpacity style={styles.firmaClearButtonTiny} onPress={() => setFirmaResponsable('')}>
                  <Ionicons name="trash" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </ThemedView>
            )}

            {submitResponse && (
              <ThemedView style={[styles.responseContainer, submitResponse.type === 'success' ? styles.responseSuccess : styles.responseError]}>
                <ThemedText style={styles.responseText}>
                  {submitResponse.type === 'success' ? '✓ ' : '✗ '}
                  {submitResponse.message}
                </ThemedText>
              </ThemedView>
            )}
            <ThemedView style={styles.formActions}>
              <TouchableOpacity
                style={[styles.formActionButton, styles.formActionSave, isSubmitting && styles.buttonDisabled]}
                onPress={handleSave}
                disabled={isSubmitting || isCreating}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="save" size={18} color="#fff" />
                    <ThemedText style={styles.formActionSaveText}>Guardar</ThemedText>
                  </>
                )}
              </TouchableOpacity>
            </ThemedView>
          </ThemedView>
          )}

          {/* Lista de registros */}
          {showRecordsList && (
            <ThemedView>
              {true && (
                <ThemedView style={styles.hierarchyFiltersContainer}>
                  <ThemedView style={styles.hierarchyFiltersHeader}>
                    <TouchableOpacity
                      style={styles.hierarchyFilterToggleButton}
                      onPress={() => setIsHierarchyFiltersExpanded(!isHierarchyFiltersExpanded)}
                    >
                      <ThemedText style={styles.hierarchyFiltersTitle}>
                        Filtrar por jerarquía
                      </ThemedText>
                      <Ionicons
                        name={isHierarchyFiltersExpanded ? 'chevron-up' : 'chevron-down'}
                        size={20}
                        color="#007AFF"
                      />
                    </TouchableOpacity>
                  </ThemedView>

                  {isHierarchyFiltersExpanded && (
                    <ThemedView style={styles.hierarchyFiltersContent}>
                      {isStructureLoading ? (
                        <ActivityIndicator size="small" color="#007AFF" />
                      ) : (
                        <>
                          <ThemedText style={styles.label}>Empresa</ThemedText>
                          <View style={styles.pickerContainer}>
                            <Picker
                              selectedValue={filterEmpresaId ?? 0}
                              onValueChange={(value) => {
                                const v = Number(value) || 0;
                                setFilterEmpresaId(v || null);
                                setFilterClienteId(null);
                                setFilterDivisionId(null);
                                setFilterContratoId(null);
                                setFilterSucursalId(null);
                                setFilterPuestoId(null);
                                setRecords([]);
                              }}
                              style={styles.picker}
                            >
                              <Picker.Item label="Seleccione una empresa" value={0} color="#000000" />
                              {mainStructure.map((empresa) => (
                                <Picker.Item key={empresa.id} label={empresa.nombre} value={empresa.id} color="#000000" />
                              ))}
                            </Picker>
                          </View>

                          <ThemedText style={styles.label}>Cliente</ThemedText>
                          <View style={styles.pickerContainer}>
                            <Picker
                              selectedValue={filterClienteId ?? 0}
                              enabled={!!selectedEmpresa}
                              onValueChange={(value) => {
                                const v = Number(value) || 0;
                                setFilterClienteId(v || null);
                                setFilterDivisionId(null);
                                setFilterContratoId(null);
                                setFilterSucursalId(null);
                                setFilterPuestoId(null);
                                setRecords([]);
                              }}
                              style={styles.picker}
                            >
                              <Picker.Item label="Seleccione un cliente" value={0} color="#000000" />
                              {selectedEmpresa?.clientes.map((cliente) => (
                                <Picker.Item key={cliente.id} label={cliente.nombre} value={cliente.id} color="#000000" />
                              ))}
                            </Picker>
                          </View>

                          <ThemedText style={styles.label}>División</ThemedText>
                          <View style={styles.pickerContainer}>
                            <Picker
                              selectedValue={filterDivisionId ?? 0}
                              enabled={!!selectedCliente}
                              onValueChange={(value) => {
                                const v = Number(value) || 0;
                                setFilterDivisionId(v || null);
                                setFilterContratoId(null);
                                setFilterSucursalId(null);
                                setFilterPuestoId(null);
                                setRecords([]);
                              }}
                              style={styles.picker}
                            >
                              <Picker.Item label="Seleccione una división" value={0} color="#000000" />
                              {selectedCliente?.division.map((division) => (
                                <Picker.Item key={division.id} label={division.nombre} value={division.id} color="#000000" />
                              ))}
                            </Picker>
                          </View>

                          <ThemedText style={styles.label}>Contrato</ThemedText>
                          <View style={styles.pickerContainer}>
                            <Picker
                              selectedValue={filterContratoId ?? 0}
                              enabled={!!selectedDivision}
                              onValueChange={(value) => {
                                const v = Number(value) || 0;
                                setFilterContratoId(v || null);
                                setFilterSucursalId(null);
                                setFilterPuestoId(null);
                                setRecords([]);
                              }}
                              style={styles.picker}
                            >
                              <Picker.Item label="Seleccione un contrato" value={0} color="#000000" />
                              {selectedDivision?.contratos.map((contrato) => (
                                <Picker.Item key={contrato.id} label={contrato.nombre} value={contrato.id} color="#000000" />
                              ))}
                            </Picker>
                          </View>

                          <ThemedText style={styles.label}>Sucursal</ThemedText>
                          <View style={styles.pickerContainer}>
                            <Picker
                              selectedValue={filterSucursalId ?? 0}
                              enabled={!!selectedContrato}
                              onValueChange={(value) => {
                                const v = Number(value) || 0;
                                setFilterSucursalId(v || null);
                                setFilterPuestoId(null);
                                setRecords([]);
                              }}
                              style={styles.picker}
                            >
                              <Picker.Item label="Seleccione una sucursal" value={0} color="#000000" />
                              {selectedContrato?.sucursales.map((sucursal) => (
                                <Picker.Item key={sucursal.id} label={sucursal.nombre} value={sucursal.id} color="#000000" />
                              ))}
                            </Picker>
                          </View>

                          <ThemedText style={styles.label}>Puesto</ThemedText>
                          <View style={styles.pickerContainer}>
                            <Picker
                              selectedValue={filterPuestoId ?? 0}
                              enabled={!!selectedSucursal}
                              onValueChange={(value) => {
                                const v = Number(value) || 0;
                                const nextPuestoId = v || null;
                                setFilterPuestoId(nextPuestoId);
                                fetchEntregaRecordsByPuesto(nextPuestoId);
                              }}
                              style={styles.picker}
                            >
                              <Picker.Item label="Seleccione un puesto" value={0} color="#000000" />
                              {selectedSucursal?.puestos.map((puestoNode) => (
                                <Picker.Item key={puestoNode.id} label={puestoNode.nombre} value={puestoNode.id} color="#000000" />
                              ))}
                            </Picker>
                          </View>
                        </>
                      )}
                    </ThemedView>
                  )}
                </ThemedView>
              )}

              <ThemedView style={styles.infoSection}>
                {isLoadingRecords ? (
                  <ActivityIndicator size="small" color="#007AFF" />
                ) : records.length === 0 ? (
                  <ThemedText style={styles.emptySectionText}>
                    No hay registros de entrega de puesto para el puesto seleccionado.
                  </ThemedText>
                ) : (
                  records.map(renderRecordCard)
                )}
              </ThemedView>
            </ThemedView>
          )}
        </ThemedView>
      </ScrollView >

      {/* Modal de Firma (flotante) */}
      <Modal
        visible={isSignatureModalVisible}
        animationType="fade"
        transparent
        presentationStyle="overFullScreen"
        onRequestClose={() => setIsSignatureModalVisible(false)}
      >
        <View style={styles.overlay}>
          <ThemedView style={styles.floatModalCard}>
            <ThemedView style={styles.floatModalHeader}>
              <ThemedText style={styles.modalTitle}>
                {signatureTarget === 'firma_recibe' ? 'Firma de quien recibe' : 'Firma de quien entrega'}
              </ThemedText>
              <TouchableOpacity onPress={() => setIsSignatureModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </ThemedView>

            <ThemedText style={styles.signatureModalHint}>Firma dentro del recuadro blanco y pulsa Guardar.</ThemedText>

            <View style={styles.signaturePadBox}>
              <SignatureScreen
                ref={signatureRef}
                onOK={handleSignatureOK}
                onClear={handleSignatureClear}
                descriptionText=""
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
              <TouchableOpacity
                style={[styles.modalAcceptButton, isReadingSignature && { opacity: 0.7 }]}
                onPress={acceptSignature}
                disabled={isReadingSignature}
              >
                {isReadingSignature ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <Ionicons name="checkmark" size={20} color="#000000" />
                )}
                <ThemedText style={styles.modalAcceptButtonText}>Guardar</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          </ThemedView>
        </View>
      </Modal>

      {archivosModalIndex != null && currentMarca?.puesto?.id && articulos[archivosModalIndex] ? (
        <ArticuloMantenimientoArchivosModal
          visible
          onClose={() => setArchivosModalIndex(null)}
          puestoId={Number(currentMarca.puesto.id)}
          articuloId={articulos[archivosModalIndex].id}
          articuloNombre={articulos[archivosModalIndex].nombre}
          formEstado={articulos[archivosModalIndex].estado}
          ultimoMantenimientoId={articulos[archivosModalIndex].ultimo_mantenimiento_id ?? null}
          pendingFiles={articulos[archivosModalIndex].mantenimiento_files ?? []}
          onPendingFilesChange={(files) =>
            handleArticuloMantenimientoFilesChange(archivosModalIndex, files)
          }
          accessToken={accessToken}
        />
      ) : null}

      <Modal visible={isCameraVisible} animationType="slide" onRequestClose={() => setIsCameraVisible(false)}>
        <ThemedView style={{ flex: 1, backgroundColor: '#000' }}>
          <CameraView
            ref={cameraRef}
            style={{ flex: 1 }}
            facing={cameraFacing}
            onMountError={() => {
              setCameraFacing((prev) => (prev === 'front' ? 'back' : prev));
            }}
          >
            <TouchableOpacity style={styles.cameraCloseButton} onPress={() => setIsCameraVisible(false)}>
              <Ionicons name="close" size={30} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.cameraCaptureButton} onPress={captureEntregaPhoto}>
              <ThemedView style={styles.cameraCaptureButtonInner} />
            </TouchableOpacity>
          </CameraView>
        </ThemedView>
      </Modal>

      <AppFooter />
      <SlideMenu
        isVisible={isMenuVisible}
        onClose={() => setIsMenuVisible(false)}
        onHomePress={handleHomePress}
        currentRoute="EntregaPuestos"
      />
      {QRScannerComponent}
    </ThemedView >
  );
}

const styles = StyleSheet.create({
  // Estructura/layout (igual que LlavesScreen)
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },
  content: { width: '100%', maxWidth: 800, alignSelf: 'center' },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 16, fontSize: 16, opacity: 0.7 },
  errorText: { color: '#FF3B30', textAlign: 'center', marginBottom: 12 },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },

  titleContainer: {
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, opacity: 0.7, textAlign: 'center' },

  formCard: { marginTop: 12, backgroundColor: '#fff', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#E0E0E0' },
  formTitle: { fontSize: 18, fontWeight: '800', marginBottom: 10, color: '#000' },
  label: { fontSize: 13, fontWeight: '700', marginTop: 10, color: '#333' },
  input: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, backgroundColor: '#fff', color: '#000', marginBottom: 6 },
  inputReadOnly: { backgroundColor: '#F0F0F0' },
  textArea: { minHeight: 90, textAlignVertical: 'top' },

  infoSection: {
    marginBottom: 16,
    paddingBottom: 16,
  },
  sectionTitle: { marginTop: 14, fontSize: 15, fontWeight: '800', color: '#007AFF', marginBottom: 10 },
  readingCardsContainer: {
    marginTop: 8,
    gap: 12,
  },
  readingCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    padding: 12,
  },
  readingCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  readingCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  readingCardDetails: {
    marginTop: 6,
    gap: 6,
  },
  readingCardRow: {
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingBottom: 4,
  },
  readingCardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#777777',
  },
  readingCardValue: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333333',
    textAlign: 'left',
  },
  emptySectionText: {
    fontSize: 13,
    color: '#666666',
    marginTop: 4,
    marginBottom: 4,
  },

  // Filtros jerárquicos (inspirado en VisitorsScreen)
  hierarchyFiltersContainer: {
    width: '100%',
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
    marginTop: 10,
  },
  hierarchyFiltersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F8F9FA',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  hierarchyFilterToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  hierarchyFiltersTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#007AFF',
    textAlign: 'right',
  },
  hierarchyFiltersContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F8F9FA',
    gap: 6,
  },

  // Toggle formulario / registros
  toggleBar: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#007AFF',
    backgroundColor: '#FFFFFF',
    gap: 6,
  },
  toggleButtonActive: {
    backgroundColor: '#007AFF',
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  toggleButtonTextActive: {
    color: '#FFFFFF',
  },

  // Banner de información cuando ya existe registro en el turno
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FFF4E5',
    borderWidth: 1,
    borderColor: '#FFE0B2',
    marginBottom: 10,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#A15C00',
  },

  // Cards (igual que LlavesScreen)
  bitacoraCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  // Artículos con scroll horizontal - Tabla
  tableWrapper: {
    flexDirection: 'row',
    marginTop: 10,
  },
  tableFixedColumn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRightWidth: 0,
  },
  tableHeaderFixed: {
    backgroundColor: '#F5F5F5',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    height: 50,
  },
  tableRowFixed: {
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    height: 70,
  },
  articulosScrollView: {
    flex: 1,
  },
  articulosScrollContent: {
    paddingRight: 16,
  },
  tableScrollableContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderLeftWidth: 0,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    height: 50,
  },
  tableHeaderCell: {
    padding: 10,
    borderRightWidth: 1,
    borderRightColor: '#E0E0E0',
    width: 150,
    justifyContent: 'center',
    height: 50,
  },
  tableHeaderCellFirst: {
    padding: 10,
    borderRightWidth: 1,
    borderRightColor: '#E0E0E0',
    width: 100,
    justifyContent: 'center',
    height: 50,
  },
  tableHeaderCellArchivos: {
    padding: 10,
    borderRightWidth: 1,
    borderRightColor: '#E0E0E0',
    width: 80,
    justifyContent: 'center',
    height: 50,
  },
  tableHeaderText: {
    color: '#333',
    fontWeight: '600',
    fontSize: 13,
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    height: 70,
  },
  tableCell: {
    padding: 10,
    borderRightWidth: 1,
    borderRightColor: '#E0E0E0',
    width: 150,
    justifyContent: 'center',
    height: 70,
  },
  tableCellArchivos: {
    padding: 10,
    borderRightWidth: 1,
    borderRightColor: '#E0E0E0',
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
    height: 70,
  },
  archivosBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F0F8FF',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  archivosBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#007AFF',
  },
  tableCellFirst: {
    padding: 10,
    borderRightWidth: 1,
    borderRightColor: '#E0E0E0',
    width: 100,
    justifyContent: 'center',
    height: 70,
  },
  tableCellFirstText: {
    color: '#000',
    fontSize: 10,
    textAlign: 'center',
    flexShrink: 1,
  },
  tableCellText: {
    color: '#000',
    fontSize: 13,
    textAlign: 'center',
    flexShrink: 1,
  },
  pickerContainerTable: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 4,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  pickerTable: {
    height: 50,
    color: '#000',
  },
  pickerItemStyle: {
    color: '#000',
    fontSize: 13,
  },
  inputTable: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 4,
    padding: 8,
    fontSize: 13,
    backgroundColor: '#fff',
    minHeight: 35,
    textAlign: 'center',
  },
  textAreaTable: {
    minHeight: 50,
    textAlignVertical: 'top',
    textAlign: 'left',
  },
  bitTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10, color: '#000' },
  bitLine: { marginBottom: 6, color: '#000' },
  bitLabel: { fontWeight: '700', color: '#333' },
  bitValue: { color: '#000' },

  // Tarjetas de registros de entrega de puesto
  recordCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 12,
  },
  recordTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
    color: '#000',
  },
  recordLine: {
    marginBottom: 4,
  },
  recordLabel: {
    fontWeight: '700',
    color: '#333',
  },
  recordValue: {
    color: '#000',
  },
  recordArticuloRow: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  recordArticuloNombre: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
    marginBottom: 2,
  },
  recordArticuloDetail: {
    fontSize: 13,
    color: '#333',
    marginBottom: 1,
  },

  signaturePreviewImageSmall: {
    width: '100%',
    height: 70,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginTop: 4,
    marginBottom: 4,
  },

  firmaInfoBoxRecord: {
    marginTop: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
  },

  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    marginBottom: 6,
    backgroundColor: '#fff',
  },
  picker: {
    height: 50,
  },

  // Firma responsable (igual que LlavesScreen)
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
  signaturePreviewContainer: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#F9F9F9',
  },
  signaturePreviewImage: {
    flex: 1,
    height: 90,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },

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

  formActions: { marginTop: 16, flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  formActionButton: { flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12 },
  formActionSave: { backgroundColor: '#007AFF' },
  formActionSaveText: { color: '#fff', fontWeight: '800' },
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

  // Encabezado de sección de registros
  recordsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    gap: 12,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    width: '100%',
  },
  refreshButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },

  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  signatureContainer: {
    flex: 1,
  },
  // Modal flotante (como Usos en Llaves)
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  floatModalCard: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  floatModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#F8F9FA',
  },
  signatureModalHint: {
    paddingHorizontal: 16,
    paddingTop: 12,
    color: '#666',
    fontSize: 13,
  },
  signaturePadBox: {
    marginTop: 10,
    marginHorizontal: 16,
    marginBottom: 16,
    height: 260,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    gap: 12,
    backgroundColor: '#FFFFFF',
  },
  modalClearButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#EDEDED',
    gap: 8,
  },
  modalClearButtonText: { fontWeight: '800', color: '#000' },
  modalAcceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#D7F5E5',
    gap: 8,
  },
  modalAcceptButtonText: { fontWeight: '800', color: '#000' },
  photoPreviewContainer: {
    marginTop: 8,
    marginBottom: 12,
    position: 'relative',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    padding: 6,
    backgroundColor: '#F9F9F9',
    overflow: 'hidden',
  },
  photoPreviewImage: {
    width: 180,
    height: 180,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: '#D0D0D0',
  },
  photoPreviewDeleteButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
  },
  recordPhotosRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 10,
    marginBottom: 8,
    backgroundColor: 'transparent',
  },
  recordPhotoBlock: {
    flexGrow: 1,
    flexBasis: '40%',
    minWidth: 140,
    backgroundColor: 'transparent',
  },
  recordPhotoImage: {
    marginTop: 6,
    width: '100%',
    aspectRatio: 1,
    borderRadius: 10,
    backgroundColor: '#F0F0F0',
  },
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
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
  },
});

