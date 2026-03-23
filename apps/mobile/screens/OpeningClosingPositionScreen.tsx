import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
  View,
  Image,
  Dimensions,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Picker } from '@react-native-picker/picker';
import * as Location from 'expo-location';
import { jwtDecode } from 'jwt-decode';
import SignatureScreen from "react-native-signature-canvas";
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { formatDateDMY } from '@/utils/formatDate';
import { convertDateTimestampToLocalString } from '@/hooks/convertDateTimestampToLocalString';
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
import {
  createOpeningClosingPosition,
  updateOpeningClosingPosition,
  deleteOpeningClosingPosition,
  listOpeningClosingPositionByCorpo,
} from '@/hooks/evaluationFunctions';
import { eventBus } from '@/hooks/eventBus';
import getHoraAccion from '@/hooks/getHoraAccion';
import { useQRScanner } from '@/hooks/useQRScanner';
import authedFetch from '@/hooks/authedFetch';
import { Collapsible } from '@/components/Collapsible';

type OpeningClosingPositionScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'OpeningClosingPosition'>;

type MainStructurePlazaNode = { id: number; nombre: string };
type MainStructurePuestoNode = { id: number; nombre: string; plazas: MainStructurePlazaNode[] };
type MainStructureSucursalNode = { id: number; nombre: string; puestos: MainStructurePuestoNode[] };
type MainStructureContratoNode = { id: number; nombre: string; sucursales: MainStructureSucursalNode[] };
type MainStructureDivisionNode = { id: number; nombre: string; contratos: MainStructureContratoNode[] };
type MainStructureClienteNode = { id: number; nombre: string; division: MainStructureDivisionNode[] };
type MainStructureEmpresaNode = { id: number; nombre: string; clientes: MainStructureClienteNode[] };
type MainStructureTree = MainStructureEmpresaNode[];

type ArticuloCatalogItem = { id: number; nombre: string };

type ActividadRespuesta = 'Ok' | 'N/A' | null;
interface ActividadItem {
  pregunta: string;
  respuesta: ActividadRespuesta;
  observaciones: string;
}

interface InventarioItem {
  activos_equipos: string;
  tipo_id: number | null;
  tipo_nombre: string;
  numero_activo: string;
  numero_serie: string;
  marca: string;
  modelo: string;
  descripcion: string;
}

type OcpImageLocal = {
  id_local: string;
  base64: string;
  extension: string;
  original_name: string;
};

type OcpImageRemote = {
  id: number;
  name: string;
  original_name: string;
  url: string;
};

interface OpeningClosingPosition {
  id: number | null;
  id_local: string;
  cliente_id: number;
  corpo_id: number;
  puesto_id: number;
  division_id: number;
  fecha: string; // ISO
  tipo: string;
  nombre_representante_cliente: string;
  nombre_representante_empresa_entrante: string;
  nombre_representante_empresa_saliente: string;
  actividades: string;
  inventario: string;
  otras_observaciones: string | null;
  // Firmas de representantes son opcionales en BD y UI
  firma_representante_cliente?: string | null;
  firma_representante_empresa_entrante?: string | null;
  firma_representante_empresa_saliente?: string | null;
  firma_responsable: string;
  cliente_nombre?: string | null;
  corpo_nombre?: string | null;
  puesto_nombre?: string | null;
  division_nombre?: string | null;
  images?: OcpImageRemote[];
  images_local?: OcpImageLocal[]; // solo UI offline (base64)
  created_at: string;
  synced?: boolean;
}

interface EditingOpeningClosingPosition {
  id: number | null;
  id_local: string;
}

const ACTIVIDADES_ASEO_LIMPIEZA = [
  "Presentese al lugar y presente al misceláneo que va a prestar el servicio.",
  "Verifique ubicación de: Oficina de Aseo (si aplica), Cuartos de aseo, Comedor (lugar para toma de tiempos de alimentación trabajador).",
  "Realice una revisión de las condiciones: Fuentes de electricidad (para uso de cepillo, aspiradoras, etc), Mobiliario.",
  "Realice un recorrido del puesto.",
  "Entrega/Retiro de equipos e insumos.",
  "Entrega/Retiro de Papelería: AYL-F-002-Rol de Trabajo Mensual, AYL-F-013-Control de asistencia, AYL-M-001-Manual de Puestos Aseo y Limpieza, AYL-F-035-Guia de Funciones del puesto, AYL-F-028 Registro de Tareas de Limpieza, AYL-PO-001-Código de Vestimenta Aseo y Limpieza, AYL-F-018-Estándar de Dilución de Químicos, AYL-F-009-Solicitud de Permiso.",
];

const ACTIVIDADES_SEGURIDAD = [
  "Presentese al lugar",
  "Tome posesión de la(s) caseta(s) y realice una revisión de las condiciones y equipo con que cuenta la misma: Fuentes de electricidad, Mobiliario.",
  "Realice un recorrido del puesto, revisando el estado de los siguientes aspectos: Accesos (puertas, ventanas, portones), Barreras perimetrales e instalaciones, Alarmas, Cámaras.",
  "Revisión de activos y equipos del cliente",
  "Revisión de papelería: Formularios, Controles de ingreso/salida, entre otros",
  "Controles electrónicos: controles de mando, agujas",
  "Llaves de acceso",
  "Apertura o cierre de Libro de Novedades, donde se detallan las actividades de apertura de puesto.",
];

export default function OpeningClosingPositionScreen() {
  const { employee, refreshAccessToken, logout } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<OpeningClosingPositionScreenNavigationProp>();

  // Data states
  const [positions, setPositions] = useState<OpeningClosingPosition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasCurrentMarca, setHasCurrentMarca] = useState<boolean>(false);

  // Modal: ver cambios (auditoría)
  const [isCambiosModalVisible, setIsCambiosModalVisible] = useState(false);
  const [cambiosTitle, setCambiosTitle] = useState<string>('Cambios');
  const [cambiosItems, setCambiosItems] = useState<any[]>([]);
  const [expandedCambioId, setExpandedCambioId] = useState<number | null>(null);
  // UI: collapsables por item en lista
  const [expandedActivitiesById, setExpandedActivitiesById] = useState<Record<string, boolean>>({});
  const [expandedInventoryById, setExpandedInventoryById] = useState<Record<string, boolean>>({});
  const [expandedImagesById, setExpandedImagesById] = useState<Record<string, boolean>>({});

  // Editing state
  const [editingRecord, setEditingRecord] = useState<EditingOpeningClosingPosition | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResponse, setSubmitResponse] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // Marca context (para division automática)
  const [marcaId, setMarcaId] = useState<number | null>(null);
  const [marcaDivisionId, setMarcaDivisionId] = useState<number | null>(null); // current_marca.roleDivision.division.id

  // Estructura principal (árbol) + loading + selección
  const [mainStructureFetched, setMainStructureFetched] = useState(false);
  const [structure, setStructure] = useState<MainStructureTree>([]);
  const [isStructureLoading, setIsStructureLoading] = useState(false);
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<number | null>(null);
  const [selectedClienteId, setSelectedClienteId] = useState<number | null>(null);
  const [selectedDivisionId, setSelectedDivisionId] = useState<number | null>(null);
  const [selectedContratoId, setSelectedContratoId] = useState<number | null>(null);
  const [selectedSucursalId, setSelectedSucursalId] = useState<number | null>(null);
  const [selectedPuestoId, setSelectedPuestoId] = useState<number | null>(null); // solo 1 puesto

  // Filtros jerárquicos de la lista principal (Empresa -> Sucursal)
  const [filterEmpresaId, setFilterEmpresaId] = useState<number | null>(null);
  const [filterClienteId, setFilterClienteId] = useState<number | null>(null);
  const [filterDivisionId, setFilterDivisionId] = useState<number | null>(null);
  const [filterContratoId, setFilterContratoId] = useState<number | null>(null);
  const [filterCorpoId, setFilterCorpoId] = useState<number | null>(null);

  const [isConnected, setIsConnected] = useState<boolean>(true);

  // Catálogo artículos (inventario - solo Seguridad)
  const [articulosCatalog, setArticulosCatalog] = useState<ArticuloCatalogItem[]>([]);
  const [isArticulosLoading, setIsArticulosLoading] = useState(false);

  // Form states
  const [fechaRealizado, setFechaRealizado] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tipo, setTipo] = useState<'Apertura' | 'Cierre'>('Apertura');

  const [nombreRepresentanteCliente, setNombreRepresentanteCliente] = useState('');
  const [nombreRepresentanteEmpresaEntrante, setNombreRepresentanteEmpresaEntrante] = useState('');
  const [nombreRepresentanteEmpresaSaliente, setNombreRepresentanteEmpresaSaliente] = useState('');

  const [actividades, setActividades] = useState<ActividadItem[]>([]);
  const [inventario, setInventario] = useState<InventarioItem[]>([]);
  const [expandedInventarioIndices, setExpandedInventarioIndices] = useState<number[]>([]);

  const [imagenesLocal, setImagenesLocal] = useState<OcpImageLocal[]>([]);
  const [imagenesRemote, setImagenesRemote] = useState<OcpImageRemote[]>([]);
  const [deletedRemoteImageIds, setDeletedRemoteImageIds] = useState<number[]>([]);

  const [otrasObservaciones, setOtrasObservaciones] = useState('');

  // Firmas (3 dibujadas + 1 QR)
  const [firmaRepresentanteCliente, setFirmaRepresentanteCliente] = useState<string | null>(null);
  const [firmaRepresentanteEmpresaEntrante, setFirmaRepresentanteEmpresaEntrante] = useState<string | null>(null);
  const [firmaRepresentanteEmpresaSaliente, setFirmaRepresentanteEmpresaSaliente] = useState<string | null>(null);

  const [firmaResponsable, setFirmaResponsable] = useState<string>('');
  const [isGeneratingFirma, setIsGeneratingFirma] = useState(false);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const { scanQR, QRScannerComponent } = useQRScanner();

  // Camera states
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);

  // Signature modal states
  const [isSignatureModalVisible, setIsSignatureModalVisible] = useState(false);
  const [signatureTarget, setSignatureTarget] = useState<'cliente' | 'entrante' | 'saliente'>('cliente');
  const signatureRef = useRef<any>(null);
  const [signatureKey, setSignatureKey] = useState(0);

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

  const formatActividadesForDisplay = (actividadesJson: string): string => {
    try {
      const actividades: ActividadItem[] = JSON.parse(actividadesJson || '[]');
      if (!Array.isArray(actividades) || actividades.length === 0) return 'No hay actividades.';
      return actividades.map((a, idx) => {
        const pregunta = a.pregunta || 'N/A';
        const respuesta = a.respuesta || 'N/A';
        const observaciones = a.observaciones || 'Sin observaciones';
        return `${idx + 1}. ${pregunta}\n   Respuesta: ${respuesta}\n   Observaciones: ${observaciones}`;
      }).join('\n\n');
    } catch (e) {
      console.error('Error formatting actividades for display:', e);
      return 'Error al formatear actividades.';
    }
  };

  const formatInventarioForDisplay = (inventarioJson: string): string => {
    try {
      const inventario: InventarioItem[] = JSON.parse(inventarioJson || '[]');
      if (!Array.isArray(inventario) || inventario.length === 0) return 'No hay inventario.';
      return inventario.map((i, idx) => {
        const activosEquipos = i.activos_equipos || 'N/A';
        const tipoNombre = i.tipo_nombre || 'N/A';
        const numeroActivo = i.numero_activo || 'N/A';
        const numeroSerie = i.numero_serie || 'N/A';
        const marca = i.marca || 'N/A';
        const modelo = i.modelo || 'N/A';
        const descripcion = i.descripcion || 'N/A';
        return `${idx + 1}. ${activosEquipos} (Tipo: ${tipoNombre})\n   Número Activo: ${numeroActivo}, Serie: ${numeroSerie}\n   Marca: ${marca}, Modelo: ${modelo}\n   Descripción: ${descripcion}`;
      }).join('\n\n');
    } catch (e) {
      console.error('Error formatting inventario for display:', e);
      return 'Error al formatear inventario.';
    }
  };

  const formatChangeValue = (prop: string, value: any): string => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';
    if (typeof value === 'object') {
      if (prop === 'actividades') {
        return formatActividadesForDisplay(JSON.stringify(value));
      }
      if (prop === 'inventario') {
        return formatInventarioForDisplay(JSON.stringify(value));
      }
      return JSON.stringify(value, null, 2);
    }
    if (typeof value === 'string') {
      if (value.trim().startsWith('{') || value.trim().startsWith('[')) {
        try {
          const parsed = JSON.parse(value);
          if (prop === 'actividades') {
            return formatActividadesForDisplay(value);
          }
          if (prop === 'inventario') {
            return formatInventarioForDisplay(value);
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
    // yyyy-mm-dd (compatible con server new Date())
    const dateString = date.toISOString().split('T')[0].split('-');
    const year = dateString[0];
    const month = dateString[1];
    const day = dateString[2];
    return `${year}-${month}-${day}`;
  };

  const formatDateForDisplay = (date: Date): string => {
    console.log('date', date);
    const [year, month, day] = formatDate(date).split('-');
    const dateString = `${day}-${month}-${year}`;
    console.log('dateString', dateString);
    return dateString;
  };

  // Helper para extraer solo el base64 de las firmas
  const getBase64Only = (signature: string | null): string | null => {
    if (!signature) return null;
    if (signature.startsWith('data:')) {
      const parts = signature.split(',');
      return parts.length > 1 ? parts[1] : signature;
    }
    return signature;
  };

  // Helper para formatear la firma para mostrar
  const formatSignatureForDisplay = (signature: string | null): string | null => {
    if (!signature) return null;
    if (signature.startsWith('data:')) {
      return signature;
    }
    return `data:image/png;base64,${signature}`;
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

  const buildActividadesForDivision = (divId: number | null): ActividadItem[] => {
    const base =
      divId === 5 ? ACTIVIDADES_ASEO_LIMPIEZA
        : divId === 4 ? ACTIVIDADES_SEGURIDAD
          : [];

    return base.map((q) => ({
      pregunta: q,
      respuesta: null,
      observaciones: '',
    }));
  };

  const requestLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return null;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLocation(loc);
      return loc;
    } catch {
      return null;
    }
  };

  const handleGenerateFirmaResponsable = async () => {
    if (isGeneratingFirma) return;
    setIsGeneratingFirma(true);
    try {
      const loc = location ?? (await requestLocation());
      if (!loc || !employee) {
        Alert.alert('Error', 'No se pudo obtener ubicación o usuario');
        return;
      }
      const token = await AsyncStorage.getItem('access_token');
      if (!token) throw new Error('No authentication token found');
      const decodedToken: any = jwtDecode(token);
      const sessionId = decodedToken.sessionId;
      const horaAccion = await getHoraAccion();
      const hash = btoa(`${sessionId}:${employee.id}:${loc.coords.latitude}:${loc.coords.longitude}:${horaAccion}`);
      setFirmaResponsable(hash);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'No se pudo generar la firma');
    } finally {
      setIsGeneratingFirma(false);
    }
  };

  const handleScanFirmaResponsable = async () => {
    try {
      const qrData = await scanQR();
      if (!qrData) return;
      setFirmaResponsable(qrData);
    } catch {
      Alert.alert('Error', 'No se pudo escanear el QR');
    }
  };

  const fetchMainStructure = useCallback(async () => {
    if (mainStructureFetched) return;
    setIsStructureLoading(true);
    try {
      // cache-first
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
      else {
        setStructure([]);
      }
      /*
      const isConnected = await getConnectionStatus();
      if (!isConnected) return;

      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) throw new Error('Server URL not configured');

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
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json().catch(() => ({}));
      const incoming = data?.structure;
      if (data?.status && Array.isArray(incoming)) {
        setStructure(incoming);
        await AsyncStorage.setItem('main_structure_cache', JSON.stringify(incoming));
      }
      */
     setMainStructureFetched(true);
    } catch (e) {
      console.error('Error fetching main structure for opening-closing-position:', e);
    } finally {
      setIsStructureLoading(false);
    }
  }, [refreshAccessToken, logout]);

  const loadArticulosCatalog = useCallback(async () => {
    setIsArticulosLoading(true);
    try {
      const cache = await AsyncStorage.getItem('articulos_cache');
      if (cache) {
        try {
          const parsed = JSON.parse(cache);
          if (Array.isArray(parsed)) setArticulosCatalog(parsed);
        } catch {
          // ignore
        }
      }

      const isConnected = await getConnectionStatus();
      if (!isConnected) return;

      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) throw new Error('Server URL not configured');

      const response = await authedFetch({
        url: `${apiUrl}/api/articulos`,
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

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (data.status && Array.isArray(data.articulos)) {
        setArticulosCatalog(data.articulos);
        await AsyncStorage.setItem('articulos_cache', JSON.stringify(data.articulos));
      }
    } catch (e) {
      console.error('Error fetching articulos catalog:', e);
    } finally {
      setIsArticulosLoading(false);
    }
  }, [refreshAccessToken, logout]);

  const fetchPositions = useCallback(async (corpoIdOverride?: string | null) => {
    try {
      setIsLoading(true);
      setError(null);

      const currentMarca = await AsyncStorage.getItem('current_marca');
      if (!currentMarca) {
        setHasCurrentMarca(false);
        setIsLoading(false);
        return;
      }

      setHasCurrentMarca(true);
      const currentMarcaData = JSON.parse(currentMarca);
      const corpoIdFromMarca = currentMarcaData?.corpo?.id != null ? String(currentMarcaData.corpo.id) : null;
      const effectiveCorpoId = (corpoIdOverride !== undefined && corpoIdOverride !== null ? corpoIdOverride : null) ?? corpoIdFromMarca;

      setMarcaId(typeof currentMarcaData?.id === 'number' ? currentMarcaData.id : (currentMarcaData?.id ? Number(currentMarcaData.id) : null));
      const divIdRaw = currentMarcaData?.roleDivision?.division?.id;
      setMarcaDivisionId(divIdRaw !== undefined && divIdRaw !== null ? Number(divIdRaw) : null);

      // Preselección solo empresa y cliente; división, contrato, sucursal y puesto se eligen manualmente
      setSelectedEmpresaId(currentMarcaData?.empresa?.id ?? null);
      setSelectedClienteId(currentMarcaData?.cliente?.id ?? null);
      setSelectedDivisionId(null);
      setSelectedContratoId(null);
      setSelectedSucursalId(null);
      setSelectedPuestoId(null);

      // Estructura principal (cache-first + refresh online)
      await fetchMainStructure();

      if (!effectiveCorpoId) {
        setError('No se encontró el ID del corpo');
        setIsLoading(false);
        return;
      }

      const connected = await getConnectionStatus();
      setIsConnected(connected);

      if (connected) {
        console.log('Buscando aperturas-cierres de puesto por corpo:', effectiveCorpoId);
        const result = await listOpeningClosingPositionByCorpo({
          corpo_id: effectiveCorpoId,
          refreshAccessToken,
          logout,
        });

        if (result.status && result.data) {
          setPositions(result.data as OpeningClosingPosition[]);
        } else {
          setPositions([]);
        }
      } else {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const positionsCache = cache.filter((item: any) => item.type === 'opening_closing_position');
          setPositions(positionsCache);
        } else {
          setPositions([]);
        }
      }
    } catch (err) {
      console.error('Error fetching positions:', err);
      setError('Error al cargar las aperturas-cierres de puesto');
      try {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const positionsCache = cache.filter((item: any) => item.type === 'opening_closing_position');
          setPositions(positionsCache);
        }
      } catch (cacheErr) {
        console.error('Error loading from cache:', cacheErr);
      }
    } finally {
      setIsLoading(false);
    }
  }, [refreshAccessToken, logout, fetchMainStructure]);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const connected = await getConnectionStatus();
        setIsConnected(connected);
      })();
      fetchPositions();
      const onRestored = () => {
        setIsConnected(true);
        fetchPositions();
      };
      eventBus.on('connectionRestored', onRestored);
      return () => {
        eventBus.off('connectionRestored', onRestored);
      };
    }, [fetchPositions])
  );

  const selectedEmpresaNode = useMemo(() => {
    if (selectedEmpresaId === null) return null;
    return structure.find((e) => e.id === selectedEmpresaId) ?? null;
  }, [structure, selectedEmpresaId]);

  const selectedClienteNode = useMemo(() => {
    if (!selectedEmpresaNode || selectedClienteId === null) return null;
    return selectedEmpresaNode.clientes.find((c) => c.id === selectedClienteId) ?? null;
  }, [selectedEmpresaNode, selectedClienteId]);

  const selectedDivisionNode = useMemo(() => {
    if (!selectedClienteNode || selectedDivisionId === null) return null;
    return (selectedClienteNode.division || []).find((d) => d.id === selectedDivisionId) ?? null;
  }, [selectedClienteNode, selectedDivisionId]);

  const selectedContratoNode = useMemo(() => {
    if (!selectedDivisionNode || selectedContratoId === null) return null;
    return (selectedDivisionNode.contratos || []).find((c) => c.id === selectedContratoId) ?? null;
  }, [selectedDivisionNode, selectedContratoId]);

  const selectedSucursalNode = useMemo(() => {
    if (!selectedContratoNode || selectedSucursalId === null) return null;
    return (selectedContratoNode.sucursales || []).find((s) => s.id === selectedSucursalId) ?? null;
  }, [selectedContratoNode, selectedSucursalId]);

  // La división se selecciona manualmente; no se preselecciona desde la marca.

  // Cuando la división cambia, validar/limpiar selecciones inferiores si ya no pertenecen
  useEffect(() => {
    if (!selectedDivisionNode) {
      setSelectedContratoId(null);
      setSelectedSucursalId(null);
      setSelectedPuestoId(null);
      return;
    }
    if (selectedContratoId !== null) {
      const exists = (selectedDivisionNode.contratos || []).some((c) => c.id === selectedContratoId);
      if (!exists) setSelectedContratoId(null);
    }
  }, [selectedDivisionNode]);

  useEffect(() => {
    if (!selectedContratoNode) {
      setSelectedSucursalId(null);
      setSelectedPuestoId(null);
      return;
    }
    if (selectedSucursalId !== null) {
      const exists = (selectedContratoNode.sucursales || []).some((s) => s.id === selectedSucursalId);
      if (!exists) setSelectedSucursalId(null);
    }
  }, [selectedContratoNode]);

  useEffect(() => {
    if (!selectedSucursalNode) {
      setSelectedPuestoId(null);
      return;
    }
    if (selectedPuestoId !== null) {
      const exists = (selectedSucursalNode.puestos || []).some((p) => p.id === selectedPuestoId);
      if (!exists) setSelectedPuestoId(null);
    }
  }, [selectedSucursalNode]);

  const empresaOptions = useMemo(() => structure.map((e) => ({ id: e.id, nombre: e.nombre })), [structure]);
  const clienteOptions = useMemo(() => (selectedEmpresaNode?.clientes || []).map((c) => ({ id: c.id, nombre: c.nombre })), [selectedEmpresaNode]);
  const divisionOptions = useMemo(() => (selectedClienteNode?.division || []).map((d) => ({ id: d.id, nombre: d.nombre })), [selectedClienteNode]);
  const contratoOptions = useMemo(() => (selectedDivisionNode?.contratos || []).map((c) => ({ id: c.id, nombre: c.nombre })), [selectedDivisionNode]);
  const sucursalOptions = useMemo(() => (selectedContratoNode?.sucursales || []).map((s) => ({ id: s.id, nombre: s.nombre })), [selectedContratoNode]);
  const puestoOptions = useMemo(() => (selectedSucursalNode?.puestos || []).map((p) => ({ id: p.id, nombre: p.nombre })), [selectedSucursalNode]);

  const filterEmpresaNode = useMemo(() => {
    if (filterEmpresaId === null) return null;
    return structure.find((e) => e.id === filterEmpresaId) ?? null;
  }, [structure, filterEmpresaId]);

  const filterClienteNode = useMemo(() => {
    if (!filterEmpresaNode || filterClienteId === null) return null;
    return filterEmpresaNode.clientes.find((c) => c.id === filterClienteId) ?? null;
  }, [filterEmpresaNode, filterClienteId]);

  const filterDivisionNode = useMemo(() => {
    if (!filterClienteNode || filterDivisionId === null) return null;
    return (filterClienteNode.division || []).find((d) => d.id === filterDivisionId) ?? null;
  }, [filterClienteNode, filterDivisionId]);

  const filterContratoNode = useMemo(() => {
    if (!filterDivisionNode || filterContratoId === null) return null;
    return (filterDivisionNode.contratos || []).find((c) => c.id === filterContratoId) ?? null;
  }, [filterDivisionNode, filterContratoId]);

  const filterEmpresas = useMemo(() => structure.map((e) => ({ id: e.id, nombre: e.nombre })), [structure]);
  const filterClientes = useMemo(() => (filterEmpresaNode?.clientes || []).map((c) => ({ id: c.id, nombre: c.nombre })), [filterEmpresaNode]);
  const filterDivisiones = useMemo(() => (filterClienteNode?.division || []).map((d) => ({ id: d.id, nombre: d.nombre })), [filterClienteNode]);
  const filterContratos = useMemo(() => (filterDivisionNode?.contratos || []).map((c) => ({ id: c.id, nombre: c.nombre })), [filterDivisionNode]);
  const filterSucursales = useMemo(() => (filterContratoNode?.sucursales || []).map((s) => ({ id: s.id, nombre: s.nombre })), [filterContratoNode]);

  const filteredPositions = useMemo(() => {
    return (positions || []).filter((record) => {
      const recordClienteId = Number(record.cliente_id);
      const recordDivisionId = Number(record.division_id);
      const recordCorpoId = Number(record.corpo_id);

      if (filterEmpresaId !== null) {
        const empresa = structure.find((e) => e.id === filterEmpresaId);
        const clientesIds = new Set((empresa?.clientes || []).map((c) => Number(c.id)));
        if (!clientesIds.has(recordClienteId)) return false;
      }

      if (filterClienteId !== null && recordClienteId !== Number(filterClienteId)) return false;
      if (filterDivisionId !== null && recordDivisionId !== Number(filterDivisionId)) return false;

      if (filterContratoId !== null) {
        const contratoSucursales = new Set((filterContratoNode?.sucursales || []).map((s) => Number(s.id)));
        if (!contratoSucursales.has(recordCorpoId)) return false;
      }

      if (filterCorpoId !== null && recordCorpoId !== Number(filterCorpoId)) return false;
      return true;
    });
  }, [positions, structure, filterEmpresaId, filterClienteId, filterDivisionId, filterContratoId, filterCorpoId, filterContratoNode]);

  const isSeguridadDivision = selectedDivisionId === 4;

  // Actividades: cargar predefinidas según división cuando se inicia la creación (o si cambia cliente/división durante creación)
  useEffect(() => {
    if (!isCreating || editingRecord) return;
    setActividades(buildActividadesForDivision(selectedDivisionId));
  }, [isCreating, editingRecord, selectedDivisionId]);

  // Inventario: si no es Seguridad, asegurar [] y ocultar sección
  useEffect(() => {
    if (!isCreating && !editingRecord) return;
    if (!isSeguridadDivision) {
      setInventario([]);
      setExpandedInventarioIndices([]);
    } else {
      // Cargar catálogo de artículos solo cuando aplica
      loadArticulosCatalog();
    }
  }, [isSeguridadDivision, isCreating, editingRecord, loadArticulosCatalog]);

  const resetForm = async () => {
    const horaAccion = await getHoraAccion();
    if (!horaAccion) {
      Alert.alert('Error', 'No se pudo obtener la hora');
      return;
    }
    setFechaRealizado(new Date(horaAccion));
    setTipo('Apertura');
    setNombreRepresentanteCliente('');
    setNombreRepresentanteEmpresaEntrante('');
    setNombreRepresentanteEmpresaSaliente('');
    setActividades(buildActividadesForDivision(selectedDivisionId));
    setInventario([]);
    setExpandedInventarioIndices([]);
    setImagenesLocal([]);
    setImagenesRemote([]);
    setDeletedRemoteImageIds([]);
    setOtrasObservaciones('');
    setFirmaRepresentanteCliente(null);
    setFirmaRepresentanteEmpresaEntrante(null);
    setFirmaRepresentanteEmpresaSaliente(null);
    setFirmaResponsable('');
  };

  const startCreating = async () => {
    setIsCreating(true);
    setEditingRecord(null);
    await resetForm();
  };

  const cancelCreating = async () => {
    setIsCreating(false);
    await resetForm();
  };

  const startEditing = async (record: OpeningClosingPosition) => {
    setIsCreating(false);
    let actividadesArray: ActividadItem[] = [];
    let inventarioArray: InventarioItem[] = [];

    try {
      const parsed = JSON.parse(record.actividades || '[]');
      if (Array.isArray(parsed)) actividadesArray = parsed;
    } catch {
      actividadesArray = [];
    }

    try {
      const parsed = JSON.parse(record.inventario || '[]');
      if (Array.isArray(parsed)) inventarioArray = parsed;
    } catch {
      inventarioArray = [];
    }

    setEditingRecord({ id: record.id, id_local: record.id_local });

    // Intentar setear el árbol desde cliente/división/contrato/sucursal/puesto
    const empresaFound = structure.find((e) => (e.clientes || []).some((c) => c.id === record.cliente_id)) ?? null;
    if (empresaFound) setSelectedEmpresaId(empresaFound.id);
    setSelectedClienteId(record.cliente_id);
    setSelectedDivisionId(record.division_id);
    setSelectedSucursalId(record.corpo_id);
    setSelectedPuestoId(record.puesto_id);

    // Contrato: buscar el contrato que contiene la sucursal seleccionada
    const clienteNode = empresaFound?.clientes?.find((c) => c.id === record.cliente_id);
    const divisionNode = clienteNode?.division?.find((d) => d.id === record.division_id);
    const contratoFound =
      divisionNode?.contratos?.find((ct) => (ct.sucursales || []).some((s) => s.id === record.corpo_id)) ?? null;
    if (contratoFound) setSelectedContratoId(contratoFound.id);

    const horaAccion = await getHoraAccion();
    if (!horaAccion) {
      Alert.alert('Error', 'No se pudo obtener la hora');
      return;
    }

    setFechaRealizado(record.fecha ? new Date(record.fecha) : new Date(horaAccion));
    setTipo((record.tipo === 'Cierre' ? 'Cierre' : 'Apertura'));
    setNombreRepresentanteCliente(record.nombre_representante_cliente || '');
    setNombreRepresentanteEmpresaEntrante(record.nombre_representante_empresa_entrante || '');
    setNombreRepresentanteEmpresaSaliente(record.nombre_representante_empresa_saliente || '');
    setActividades(actividadesArray);
    setInventario(inventarioArray);
    setExpandedInventarioIndices(inventarioArray.map((_, i) => i));

    setImagenesRemote(record.images || []);
    setImagenesLocal(record.images_local || []);
    setDeletedRemoteImageIds([]);

    setOtrasObservaciones(record.otras_observaciones || '');
    setFirmaRepresentanteCliente(formatSignatureForDisplay(record.firma_representante_cliente ?? null));
    setFirmaRepresentanteEmpresaEntrante(formatSignatureForDisplay(record.firma_representante_empresa_entrante ?? null));
    setFirmaRepresentanteEmpresaSaliente(formatSignatureForDisplay(record.firma_representante_empresa_saliente ?? null));
    setFirmaResponsable(record.firma_responsable || '');
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
      setFechaRealizado(selectedDate);
    }
  };

  const setActividadRespuesta = (index: number, value: ActividadRespuesta) => {
    setActividades((prev) => prev.map((a, i) => (i === index ? { ...a, respuesta: value } : a)));
  };

  const setActividadObservaciones = (index: number, text: string) => {
    setActividades((prev) => prev.map((a, i) => (i === index ? { ...a, observaciones: text } : a)));
  };

  const addInventario = () => {
    const newInventario: InventarioItem = {
      activos_equipos: '',
      tipo_id: null,
      tipo_nombre: '',
      numero_activo: '',
      numero_serie: '',
      marca: '',
      modelo: '',
      descripcion: '',
    };
    setInventario([...inventario, newInventario]);
    setExpandedInventarioIndices([...expandedInventarioIndices, inventario.length]);
  };

  const updateInventarioText = (
    index: number,
    field: 'activos_equipos' | 'numero_activo' | 'numero_serie' | 'marca' | 'modelo' | 'descripcion',
    value: string
  ) => {
    const next = [...inventario];
    next[index] = { ...next[index], [field]: value };
    setInventario(next);
  };

  const updateInventarioTipo = (index: number, tipoId: number | null) => {
    const selected = tipoId ? (articulosCatalog.find((a) => a.id === tipoId) ?? null) : null;
    const next = [...inventario];
    next[index] = {
      ...next[index],
      tipo_id: tipoId,
      tipo_nombre: selected?.nombre || '',
    };
    setInventario(next);
  };

  const removeInventario = (index: number) => {
    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas eliminar este item del inventario?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            setInventario(inventario.filter((_, i) => i !== index));
            setExpandedInventarioIndices(expandedInventarioIndices.filter(i => i !== index).map(i => i > index ? i - 1 : i));
          },
        },
      ]
    );
  };

  const toggleInventarioExpansion = (index: number) => {
    setExpandedInventarioIndices(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

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
    } catch (error) {
      console.error('Error al abrir la cámara:', error);
      Alert.alert('Error', 'No se pudo abrir la cámara. Por favor intente nuevamente.');
    }
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

  const openSignatureModal = (target: 'cliente' | 'entrante' | 'saliente') => {
    setSignatureTarget(target);
    setIsSignatureModalVisible(true);
    setSignatureKey((prev) => prev + 1);
  };

  const closeSignatureModal = () => {
    setIsSignatureModalVisible(false);
  };

  const clearSignatureInModal = () => {
    setSignatureKey(prev => prev + 1);
    if (signatureRef.current) {
      signatureRef.current.clearSignature();
    }
  };

  const handleSignatureRead = (signature: string) => {
    if (signature) {
      let formattedSignature = signature;
      if (!signature.startsWith('data:')) {
        formattedSignature = `data:image/png;base64,${signature}`;
      }
      if (signatureTarget === 'cliente') setFirmaRepresentanteCliente(formattedSignature);
      if (signatureTarget === 'entrante') setFirmaRepresentanteEmpresaEntrante(formattedSignature);
      if (signatureTarget === 'saliente') setFirmaRepresentanteEmpresaSaliente(formattedSignature);
      setIsSignatureModalVisible(false);
    } else {
      Alert.alert('Error', 'No se pudo obtener la firma. Por favor, intente nuevamente.');
    }
  };

  const acceptSignature = () => {
    if (signatureRef.current) {
      signatureRef.current.readSignature();
    } else {
      Alert.alert('Error', 'Debe dibujar una firma antes de aceptar');
    }
  };

  const savePositionHandler = async () => {
    const currentMarca = await AsyncStorage.getItem('current_marca');
    if (!currentMarca) {
      Alert.alert('Error', 'No se encontró la marca actual');
      return;
    }

    setIsSubmitting(true);
    setSubmitResponse(null);

    try {
      const currentMarcaData = JSON.parse(currentMarca);

      if (!selectedClienteId || !selectedSucursalId || !selectedPuestoId || !selectedDivisionId) {
        Alert.alert('Error', 'Debes seleccionar Cliente / División / Contrato / Sucursal / Puesto');
        setIsSubmitting(false);
        return;
      }
      if (!nombreRepresentanteCliente.trim() || !nombreRepresentanteEmpresaEntrante.trim() || !nombreRepresentanteEmpresaSaliente.trim()) {
        Alert.alert('Error', 'Debes completar los nombres de representantes');
        setIsSubmitting(false);
        return;
      }
      const fCliente = getBase64Only(firmaRepresentanteCliente);
      const fEntrante = getBase64Only(firmaRepresentanteEmpresaEntrante);
      const fSaliente = getBase64Only(firmaRepresentanteEmpresaSaliente);
      
      if (!firmaResponsable) {
        Alert.alert('Error', 'Debes registrar la firma del responsable (QR)');
        setIsSubmitting(false);
        return;
      }

      const actividadesStr = JSON.stringify(actividades || []);
      const inventarioStr = JSON.stringify(isSeguridadDivision ? (inventario || []) : []);

      const imagenesStr =
        imagenesLocal.length > 0
          ? JSON.stringify(
            imagenesLocal.map((img) => ({
              file_base64: img.base64,
              extension: img.extension,
              original_name: img.original_name,
            }))
          )
          : null;

      const requestData: any = {
        marca_id: currentMarcaData.id,
        cliente_id: selectedClienteId,
        corpo_id: selectedSucursalId,
        puesto_id: selectedPuestoId,
        division_id: selectedDivisionId,
        fecha: formatDate(fechaRealizado),
        tipo,
        nombre_representante_cliente: nombreRepresentanteCliente.trim(),
        nombre_representante_empresa_entrante: nombreRepresentanteEmpresaEntrante.trim(),
        nombre_representante_empresa_saliente: nombreRepresentanteEmpresaSaliente.trim(),
        actividades: actividadesStr,
        inventario: inventarioStr,
        otras_observaciones: otrasObservaciones.trim() || null,
        firma_representante_cliente: fCliente,
        firma_representante_empresa_entrante: fEntrante,
        firma_representante_empresa_saliente: fSaliente,
        firma_responsable: firmaResponsable,
        ...(imagenesStr ? { imagenes: imagenesStr } : {}),
      };

      const isConnected = await getConnectionStatus();

      if (isConnected) {
        const result = await createOpeningClosingPosition({
          requestData,
          refreshAccessToken,
          logout,
        });

        if (result.status) {
          Alert.alert('Éxito', result.message || 'Apertura-Cierre de Puesto guardado correctamente');
          setTimeout(() => {
            cancelCreating();
            fetchPositions();
          }, 2000);
        } else {
          Alert.alert('Error', result.message || 'Error al guardar la apertura-cierre de puesto');
        }
      } else {
        const localId = generateRandomId();

        const actionsStr = await AsyncStorage.getItem('evaluations_actions');
        const actions = actionsStr ? JSON.parse(actionsStr) : [];
        actions.push({
          id: localId,
          action: 'create',
          type: 'opening_closing_position',
          payload: requestData,
          synced: false,
        });
        await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        const cache = cacheStr ? JSON.parse(cacheStr) : [];

        const horaAccion = await getHoraAccion();
        if (!horaAccion) {
          Alert.alert('Error', 'No se pudo obtener la hora');
          return;
        }

        const newRecordCache: OpeningClosingPosition = {
          id: null,
          id_local: localId,
          cliente_id: selectedClienteId,
          corpo_id: selectedSucursalId,
          puesto_id: selectedPuestoId,
          division_id: selectedDivisionId,
          fecha: formatDate(fechaRealizado),
          tipo,
          nombre_representante_cliente: nombreRepresentanteCliente.trim(),
          nombre_representante_empresa_entrante: nombreRepresentanteEmpresaEntrante.trim(),
          nombre_representante_empresa_saliente: nombreRepresentanteEmpresaSaliente.trim(),
          actividades: actividadesStr,
          inventario: inventarioStr,
          otras_observaciones: otrasObservaciones.trim() || null,
          firma_representante_cliente: fCliente,
          firma_representante_empresa_entrante: fEntrante,
          firma_representante_empresa_saliente: fSaliente,
          firma_responsable: firmaResponsable,
          cliente_nombre: selectedClienteNode?.nombre || null,
          corpo_nombre: selectedSucursalNode?.nombre || null,
          puesto_nombre: (selectedSucursalNode?.puestos || []).find((p) => p.id === selectedPuestoId)?.nombre || null,
          division_nombre: selectedDivisionNode?.nombre || null,
          images_local: imagenesLocal,
          created_at: new Date(horaAccion).toISOString(),
          synced: false,
        };

        cache.push({ ...newRecordCache, type: 'opening_closing_position' });
        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(cache));

        Alert.alert('Éxito', 'Apertura-Cierre de Puesto registrado localmente. Se sincronizará cuando haya conexión.');
        setTimeout(() => {
          cancelCreating();
          fetchPositions();
        }, 2000);
      }
    } catch (err) {
      console.error('Error saving position:', err);
      Alert.alert('Error', 'No se pudo guardar la apertura-cierre de puesto');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updatePositionHandler = async () => {
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

      const recordIdStr = typeof recordId === 'number' ? String(recordId) : recordId;

      if (!selectedClienteId || !selectedSucursalId || !selectedPuestoId || !selectedDivisionId) {
        Alert.alert('Error', 'Debes seleccionar Cliente / División / Contrato / Sucursal / Puesto');
        setIsSubmitting(false);
        return;
      }
      if (!nombreRepresentanteCliente.trim() || !nombreRepresentanteEmpresaEntrante.trim() || !nombreRepresentanteEmpresaSaliente.trim()) {
        Alert.alert('Error', 'Debes completar los nombres de representantes');
        setIsSubmitting(false);
        return;
      }
      const fCliente = getBase64Only(firmaRepresentanteCliente);
      const fEntrante = getBase64Only(firmaRepresentanteEmpresaEntrante);
      const fSaliente = getBase64Only(firmaRepresentanteEmpresaSaliente);
      
      if (!firmaResponsable) {
        Alert.alert('Error', 'Debes registrar la firma del responsable (QR)');
        setIsSubmitting(false);
        return;
      }

      const actividadesStr = JSON.stringify(actividades || []);
      const inventarioStr = JSON.stringify(isSeguridadDivision ? (inventario || []) : []);

      const imagenesStr =
        imagenesLocal.length > 0
          ? JSON.stringify(
            imagenesLocal.map((img) => ({
              file_base64: img.base64,
              extension: img.extension,
              original_name: img.original_name,
            }))
          )
          : null;

      const requestData: any = {
        cliente_id: selectedClienteId,
        corpo_id: selectedSucursalId,
        puesto_id: selectedPuestoId,
        division_id: selectedDivisionId,
        fecha: formatDate(fechaRealizado),
        tipo,
        nombre_representante_cliente: nombreRepresentanteCliente.trim(),
        nombre_representante_empresa_entrante: nombreRepresentanteEmpresaEntrante.trim(),
        nombre_representante_empresa_saliente: nombreRepresentanteEmpresaSaliente.trim(),
        actividades: actividadesStr,
        inventario: inventarioStr,
        otras_observaciones: otrasObservaciones.trim() || null,
        firma_representante_cliente: fCliente,
        firma_representante_empresa_entrante: fEntrante,
        firma_representante_empresa_saliente: fSaliente,
        firma_responsable: firmaResponsable,
        ...(imagenesStr ? { imagenes: imagenesStr } : {}),
        ...(deletedRemoteImageIds.length > 0 ? { delete_imagenes: JSON.stringify(deletedRemoteImageIds) } : {}),
      };

      const isConnected = await getConnectionStatus();

      if (isConnected) {
        const result = await updateOpeningClosingPosition({
          id: recordIdStr,
          requestData,
          refreshAccessToken,
          logout,
        });

        if (result.status) {
          Alert.alert('Éxito', result.message || 'Apertura-Cierre de Puesto actualizado correctamente');
          setTimeout(() => {
            cancelEditing();
            fetchPositions();
          }, 2000);
        } else {
          Alert.alert('Error', result.message || 'Error al actualizar la apertura-cierre de puesto');
        }
      } else {
        const actionsStr = await AsyncStorage.getItem('evaluations_actions');
        const actions = actionsStr ? JSON.parse(actionsStr) : [];
        actions.push({
          id: recordIdStr,
          action: 'update',
          type: 'opening_closing_position',
          payload: requestData,
          synced: false,
        });
        await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const updatedCache = cache.map((item: any) => {
            if ((item.id === recordIdStr || String(item.id) === recordIdStr || item.id_local === recordIdStr) && item.type === 'opening_closing_position') {
              return {
                ...item,
                cliente_id: selectedClienteId,
                corpo_id: selectedSucursalId,
                puesto_id: selectedPuestoId,
                division_id: selectedDivisionId,
                fecha: formatDate(fechaRealizado),
                tipo,
                nombre_representante_cliente: nombreRepresentanteCliente.trim(),
                nombre_representante_empresa_entrante: nombreRepresentanteEmpresaEntrante.trim(),
                nombre_representante_empresa_saliente: nombreRepresentanteEmpresaSaliente.trim(),
                actividades: JSON.stringify(actividades || []),
                inventario: JSON.stringify(isSeguridadDivision ? (inventario || []) : []),
                otras_observaciones: otrasObservaciones.trim() || null,
                firma_representante_cliente: getBase64Only(firmaRepresentanteCliente),
                firma_representante_empresa_entrante: getBase64Only(firmaRepresentanteEmpresaEntrante),
                firma_representante_empresa_saliente: getBase64Only(firmaRepresentanteEmpresaSaliente),
                firma_responsable: firmaResponsable,
                cliente_nombre: selectedClienteNode?.nombre || item.cliente_nombre || null,
                corpo_nombre: selectedSucursalNode?.nombre || item.corpo_nombre || null,
                puesto_nombre: (selectedSucursalNode?.puestos || []).find((p) => p.id === selectedPuestoId)?.nombre || item.puesto_nombre || null,
                division_nombre: selectedDivisionNode?.nombre || item.division_nombre || null,
                images_local: imagenesLocal,
                images: imagenesRemote,
                synced: false,
              };
            }
            return item;
          });
          await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
        }

        Alert.alert('Éxito', 'Apertura-Cierre de Puesto actualizado localmente. Se sincronizará cuando haya conexión.');
        setTimeout(() => {
          cancelEditing();
          fetchPositions();
        }, 2000);
      }
    } catch (err) {
      console.error('Error updating position:', err);
      Alert.alert('Error', 'No se pudo actualizar la apertura-cierre de puesto');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deletePositionHandler = async (record: OpeningClosingPosition) => {
    const recordId = record.id || record.id_local;
    if (!recordId) {
      Alert.alert('Error', 'ID de registro no encontrado para eliminar');
      return;
    }

    const recordIdStr = typeof recordId === 'number' ? String(recordId) : recordId;

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas eliminar esta apertura-cierre de puesto?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await deleteOpeningClosingPosition({
                  id: recordIdStr,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Apertura-Cierre de Puesto eliminado correctamente');
                  fetchPositions();
                } else {
                  Alert.alert('Error', result.message || 'Error al eliminar la apertura-cierre de puesto');
                }
              } else {
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: recordIdStr,
                  action: 'delete',
                  type: 'opening_closing_position',
                  payload: {},
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                if (cacheStr) {
                  const cache = JSON.parse(cacheStr);
                  const updatedCache = cache.filter((item: any) => !((item.id === recordIdStr || String(item.id) === recordIdStr || item.id_local === recordIdStr) && item.type === 'opening_closing_position'));
                  await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                }

                Alert.alert('Modo Offline', 'Apertura-Cierre de Puesto marcado para eliminación localmente. Se sincronizará cuando haya conexión.');
                fetchPositions();
              }
            } catch (err) {
              console.error('Error deleting position:', err);
              Alert.alert('Error', 'No se pudo eliminar la apertura-cierre de puesto');
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
      case 'position': return <Ionicons name="business" size={24} color='#000000' />;
      case 'add': return <Ionicons name="add" size={24} color='#FFFFFF' />;
      case 'cancel': return <Ionicons name="close" size={24} color='#FFFFFF' />;
      case 'confirm': return <Ionicons name="checkmark" size={24} color='#FFFFFF' />;
      case 'delete': return <Ionicons name="trash" size={24} color='#FFFFFF' />;
      case 'edit': return <Ionicons name="pencil" size={20} color="#FFFFFF" />;
      default: return <Ionicons name="business" size={24} color='#000000' />;
    }
  };

  const renderPositionList = () => {
    if (isLoading) {
      return (
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Cargando aperturas-cierres de puesto...</ThemedText>
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

    if (filteredPositions.length === 0) {
      return (
        <ThemedView style={styles.emptyContainer}>
          <ThemedText style={styles.emptyText}>No hay aperturas-cierres de puesto para los filtros seleccionados.</ThemedText>
        </ThemedView>
      );
    }

    return (
      <ThemedView style={styles.listContainer}>
        {filteredPositions.map((record) => {
          const itemKey = String((record.id ?? record.id_local) || '');
          let actividadesArr: any[] = [];
          let inventarioArr: any[] = [];
          const imagesRemoteArr = Array.isArray((record as any).images) ? ((record as any).images as any[]) : [];
          const imagesLocalArr = Array.isArray((record as any).images_local) ? ((record as any).images_local as any[]) : [];
          try {
            const parsed = JSON.parse(record.actividades || '[]');
            if (Array.isArray(parsed)) actividadesArr = parsed;
          } catch {
            actividadesArr = [];
          }
          try {
            const parsed = JSON.parse(record.inventario || '[]');
            if (Array.isArray(parsed)) inventarioArr = parsed;
          } catch {
            inventarioArr = [];
          }

          const isActivitiesOpen = !!expandedActivitiesById[itemKey];
          const isImagesOpen = !!expandedImagesById[itemKey];
          const isInventoryOpen = !!expandedInventoryById[itemKey];

          return (
            <ThemedView key={record.id || record.id_local} style={styles.listItem}>
              <ThemedView style={styles.listItemHeader}>
                <ThemedView style={styles.listItemContent}>
                  <ThemedText style={styles.listItemTitle}>
                    {record.puesto_nombre || 'N/A'}
                  </ThemedText>
                  <ThemedText style={styles.listItemSubtitle}>
                    Tipo: {record.tipo || 'N/A'}
                  </ThemedText>
                  <ThemedText style={styles.listItemSubtitle}>
                    División: {record.division_nombre || 'N/A'}
                  </ThemedText>
                  <ThemedText style={styles.listItemSubtitle}>
                    Cliente: {record.cliente_nombre || 'N/A'}
                  </ThemedText>
                  <ThemedText style={styles.listItemSubtitle}>
                    Corpo: {record.corpo_nombre || 'N/A'}
                  </ThemedText>
                  <ThemedText style={styles.listItemSubtitle}>
                    Fecha: {convertDateTimestampToLocalString(new Date(record.fecha).toISOString(), false)}
                  </ThemedText>
                </ThemedView>
              </ThemedView>

              <ThemedView style={styles.listItemDetails}>
                {!!itemKey && actividadesArr.length > 0 && (
                  <>
                    <TouchableOpacity
                      style={styles.collapseButton}
                      onPress={() =>
                        setExpandedActivitiesById((prev) => ({ ...prev, [itemKey]: !prev[itemKey] }))
                      }
                      activeOpacity={0.8}
                    >
                      <ThemedText style={styles.collapseButtonText}>
                        Actividades ({actividadesArr.length})
                      </ThemedText>
                      <Ionicons
                        name={isActivitiesOpen ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color="#007AFF"
                      />
                    </TouchableOpacity>
                    {isActivitiesOpen && (
                      <ThemedView style={styles.collapsableContent}>
                        {actividadesArr.map((a: any, idx: number) => (
                          <ThemedView key={`${itemKey}-act-${idx}`} style={styles.detailBlock}>
                            <ThemedText style={styles.detailLine}>
                              <ThemedText style={styles.detailLabel}>{idx + 1}. </ThemedText>
                              <ThemedText style={styles.detailValue}>{String(a?.pregunta || '').trim() || '—'}</ThemedText>
                            </ThemedText>
                            <ThemedText style={styles.detailLine}>
                              <ThemedText style={styles.detailLabel}>Respuesta: </ThemedText>
                              <ThemedText style={styles.detailValue}>{String(a?.respuesta || '').trim() || '—'}</ThemedText>
                            </ThemedText>
                            {String(a?.observaciones || '').trim().length > 0 && (
                              <ThemedText style={styles.detailLine}>
                                <ThemedText style={styles.detailLabel}>Obs: </ThemedText>
                                <ThemedText style={styles.detailValue}>{String(a?.observaciones).trim()}</ThemedText>
                              </ThemedText>
                            )}
                          </ThemedView>
                        ))}
                      </ThemedView>
                    )}
                  </>
                )}

                {!!itemKey && (imagesRemoteArr.length > 0 || imagesLocalArr.length > 0) && (
                  <>
                    <TouchableOpacity
                      style={styles.collapseButton}
                      onPress={() =>
                        setExpandedImagesById((prev) => ({ ...prev, [itemKey]: !prev[itemKey] }))
                      }
                      activeOpacity={0.8}
                    >
                      <ThemedText style={styles.collapseButtonText}>
                        Imágenes ({imagesRemoteArr.length + imagesLocalArr.length})
                      </ThemedText>
                      <Ionicons
                        name={isImagesOpen ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color="#007AFF"
                      />
                    </TouchableOpacity>
                    {isImagesOpen && (
                      <ThemedView style={styles.collapsableContent}>
                        {imagesRemoteArr.map((img: any) => (
                          <ThemedView key={`${itemKey}-img-r-${img?.id ?? img?.name ?? Math.random()}`} style={styles.photoItemMini}>
                            <Image
                              source={{ uri: String(img?.url || '') }}
                              style={styles.photoPreviewMini}
                              resizeMode="contain"
                            />
                            {!!String(img?.original_name || '').trim() && (
                              <ThemedText style={styles.photoCaption}>{String(img.original_name).trim()}</ThemedText>
                            )}
                          </ThemedView>
                        ))}
                        {imagesLocalArr.map((img: any) => {
                          const extRaw = String(img?.extension || 'jpg').replace('.', '').toLowerCase();
                          const mime = extRaw === 'jpg' ? 'jpeg' : extRaw;
                          const uri = `data:image/${mime};base64,${String(img?.base64 || '')}`;
                          return (
                            <ThemedView key={`${itemKey}-img-l-${img?.id_local ?? img?.original_name ?? Math.random()}`} style={styles.photoItemMini}>
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

                {!!itemKey && inventarioArr.length > 0 && (
                  <>
                    <TouchableOpacity
                      style={styles.collapseButton}
                      onPress={() =>
                        setExpandedInventoryById((prev) => ({ ...prev, [itemKey]: !prev[itemKey] }))
                      }
                      activeOpacity={0.8}
                    >
                      <ThemedText style={styles.collapseButtonText}>
                        Inventario ({inventarioArr.length})
                      </ThemedText>
                      <Ionicons
                        name={isInventoryOpen ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color="#007AFF"
                      />
                    </TouchableOpacity>
                    {isInventoryOpen && (
                      <ThemedView style={styles.collapsableContent}>
                        {inventarioArr.map((inv: any, idx: number) => (
                          <ThemedView key={`${itemKey}-inv-${idx}`} style={styles.detailBlock}>
                            <ThemedText style={styles.detailLine}>
                              <ThemedText style={styles.detailLabel}>Item {idx + 1}: </ThemedText>
                              <ThemedText style={styles.detailValue}>{String(inv?.activos_equipos || '').trim() || '—'}</ThemedText>
                            </ThemedText>
                            <ThemedText style={styles.detailLine}>
                              <ThemedText style={styles.detailLabel}>Tipo: </ThemedText>
                              <ThemedText style={styles.detailValue}>{String(inv?.tipo_nombre || '').trim() || '—'}</ThemedText>
                            </ThemedText>
                            {!!String(inv?.numero_activo || '').trim() && (
                              <ThemedText style={styles.detailLine}>
                                <ThemedText style={styles.detailLabel}># Activo: </ThemedText>
                                <ThemedText style={styles.detailValue}>{String(inv?.numero_activo).trim()}</ThemedText>
                              </ThemedText>
                            )}
                            {!!String(inv?.numero_serie || '').trim() && (
                              <ThemedText style={styles.detailLine}>
                                <ThemedText style={styles.detailLabel}>Serie: </ThemedText>
                                <ThemedText style={styles.detailValue}>{String(inv?.numero_serie).trim()}</ThemedText>
                              </ThemedText>
                            )}
                            {!!String(inv?.marca || '').trim() && (
                              <ThemedText style={styles.detailLine}>
                                <ThemedText style={styles.detailLabel}>Marca: </ThemedText>
                                <ThemedText style={styles.detailValue}>{String(inv?.marca).trim()}</ThemedText>
                              </ThemedText>
                            )}
                            {!!String(inv?.modelo || '').trim() && (
                              <ThemedText style={styles.detailLine}>
                                <ThemedText style={styles.detailLabel}>Modelo: </ThemedText>
                                <ThemedText style={styles.detailValue}>{String(inv?.modelo).trim()}</ThemedText>
                              </ThemedText>
                            )}
                            {!!String(inv?.descripcion || '').trim() && (
                              <ThemedText style={styles.detailLine}>
                                <ThemedText style={styles.detailLabel}>Desc: </ThemedText>
                                <ThemedText style={styles.detailValue}>{String(inv?.descripcion).trim()}</ThemedText>
                              </ThemedText>
                            )}
                          </ThemedView>
                        ))}
                      </ThemedView>
                    )}
                  </>
                )}

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
                        setCambiosTitle(`Cambios - ${record.tipo} #${record.id}`);
                        fetchCambios('c_apertura_cierre_puesto', Number(record.id));
                      }}
                    >
                      <Ionicons name="list-outline" size={20} color="#FFFFFF" />
                      <ThemedText style={styles.listItemButtonText}>Cambios</ThemedText>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.listItemButton, styles.deleteButton]}
                    onPress={() => deletePositionHandler(record)}
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

  const renderActividad = (actividad: ActividadItem, index: number) => {
    const selected = actividad.respuesta;

    const Radio = ({ label, value }: { label: string; value: ActividadRespuesta }) => {
      const isOn = selected === value;
      return (
        <TouchableOpacity
          style={styles.radioOption}
          onPress={() => setActividadRespuesta(index, value)}
        >
          <Ionicons
            name={isOn ? 'radio-button-on' : 'radio-button-off'}
            size={18}
            color={isOn ? '#007AFF' : '#999'}
          />
          <ThemedText style={styles.radioLabel}>{label}</ThemedText>
        </TouchableOpacity>
      );
    };

    return (
      <ThemedView key={index} style={styles.actividadItem}>
        <ThemedText style={styles.actividadHeaderText}>
          {index + 1}. {actividad.pregunta}
        </ThemedText>

        <ThemedView style={styles.radioRow}>
          <Radio label="Ok" value="Ok" />
          <Radio label="N/A" value="N/A" />
        </ThemedView>

        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Observaciones (opcional)</ThemedText>
          <TextInput
            style={[styles.formInput, styles.textArea]}
            placeholder="Observaciones"
            placeholderTextColor="#999"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            value={actividad.observaciones}
            onChangeText={(t) => setActividadObservaciones(index, t)}
          />
        </ThemedView>
      </ThemedView>
    );
  };

  const renderInventario = (item: InventarioItem, index: number) => {
    const isExpanded = expandedInventarioIndices.includes(index);

    return (
      <ThemedView key={index} style={styles.inventarioItem}>
        <TouchableOpacity
          style={styles.inventarioHeader}
          onPress={() => toggleInventarioExpansion(index)}
        >
          <ThemedView style={styles.inventarioHeaderContent}>
            <ThemedText style={styles.inventarioHeaderText}>
              Item {index + 1}: {item.activos_equipos || 'Sin nombre'}
            </ThemedText>
          </ThemedView>
          <ThemedView style={styles.inventarioHeaderActions}>
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                removeInventario(index);
              }}
              style={styles.removeInventarioButton}
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
          <ThemedView style={styles.inventarioContent}>
            {/* Activos o equipos */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Activos o equipos</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder="Activos o equipos"
                placeholderTextColor="#999"
                value={item.activos_equipos}
                onChangeText={(text) => updateInventarioText(index, 'activos_equipos', text)}
              />
            </ThemedView>

            {/* Tipo */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Tipo</ThemedText>
              <ThemedView style={styles.pickerWrapper}>
                <Picker
                  selectedValue={item.tipo_id ?? 0}
                  onValueChange={(val) => updateInventarioTipo(index, val === 0 ? null : Number(val))}
                  enabled={!isArticulosLoading && articulosCatalog.length > 0}
                  style={styles.picker}
                >
                  <Picker.Item
                    label={isArticulosLoading ? 'Cargando tipos...' : 'Seleccione tipo...'}
                    value={0}
                    color="#000000"
                  />
                  {articulosCatalog.map((a) => (
                    <Picker.Item key={a.id} label={a.nombre} value={a.id} color="#000000" />
                  ))}
                </Picker>
              </ThemedView>
            </ThemedView>

            {/* # de Activo */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}># de Activo</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder="# de Activo"
                placeholderTextColor="#999"
                value={item.numero_activo}
                onChangeText={(text) => updateInventarioText(index, 'numero_activo', text)}
              />
            </ThemedView>

            {/* Número de Serie */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Número de Serie</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder="Número de Serie"
                placeholderTextColor="#999"
                value={item.numero_serie}
                onChangeText={(text) => updateInventarioText(index, 'numero_serie', text)}
              />
            </ThemedView>

            {/* Marca */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Marca</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder="Marca"
                placeholderTextColor="#999"
                value={item.marca}
                onChangeText={(text) => updateInventarioText(index, 'marca', text)}
              />
            </ThemedView>

            {/* Modelo */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Modelo</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder="Modelo"
                placeholderTextColor="#999"
                value={item.modelo}
                onChangeText={(text) => updateInventarioText(index, 'modelo', text)}
              />
            </ThemedView>

            {/* Descripción */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Descripción</ThemedText>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                placeholder="Descripción"
                placeholderTextColor="#999"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                value={item.descripcion}
                onChangeText={(text) => updateInventarioText(index, 'descripcion', text)}
              />
            </ThemedView>
          </ThemedView>
        )}
      </ThemedView>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <AppHeader onMenuPress={handleMenuPress} title="Apertura-Cierre de Puesto" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <ThemedView style={styles.contentContainer}>
          <ThemedView style={styles.titleContainer}>
            <ThemedText type="title" style={styles.title}>
              {getActionIcon('position')} Apertura-Cierre de Puesto
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              Registra la apertura o cierre de un puesto, actividades, inventario y evidencias.
            </ThemedText>
          </ThemedView>

          {!hasCurrentMarca && (
            <ThemedView style={styles.noMarcaContainer}>
              <ThemedText style={styles.noMarcaTitle}>Marca no seleccionada</ThemedText>
              <ThemedText style={styles.noMarcaMessage}>
                No se encontró una marca seleccionada. Por favor, selecciona una marca desde el menú principal.
              </ThemedText>
            </ThemedView>
          )}

          {isCreating || editingRecord ? (
            <ThemedView style={styles.formContainer}>
              {/* Estructura principal (árbol) */}
              <ThemedView style={styles.sectionContainer}>
                <ThemedView style={styles.sectionHeader}>
                  <ThemedText style={styles.sectionTitle}>Estructura</ThemedText>
                </ThemedView>

                {isStructureLoading ? (
                  <ThemedView style={styles.loadingInline}>
                    <ActivityIndicator size="small" color="#007AFF" />
                    <ThemedText style={styles.loadingInlineText}>Cargando estructura...</ThemedText>
                  </ThemedView>
                ) : (
                  <ThemedView style={styles.sectionBody}>
                    <ThemedView style={styles.formGroup}>
                      <ThemedText style={styles.formLabel}>Empresa</ThemedText>
                      <ThemedView style={styles.pickerWrapper}>
                        <Picker
                          selectedValue={selectedEmpresaId ?? 0}
                          onValueChange={(v) => {
                            const next = Number(v) || null;
                            setSelectedEmpresaId(next);
                            setSelectedClienteId(null);
                            setSelectedDivisionId(null);
                            setSelectedContratoId(null);
                            setSelectedSucursalId(null);
                            setSelectedPuestoId(null);
                          }}
                          style={styles.picker}
                        >
                          <Picker.Item label="Seleccione empresa..." value={0} color="#000000" />
                          {empresaOptions.map((e) => (
                            <Picker.Item key={e.id} label={e.nombre} value={e.id} color="#000000" />
                          ))}
                        </Picker>
                      </ThemedView>
                    </ThemedView>

                    <ThemedView style={styles.formGroup}>
                      <ThemedText style={styles.formLabel}>Cliente</ThemedText>
                      <ThemedView style={styles.pickerWrapper}>
                        <Picker
                          selectedValue={selectedClienteId ?? 0}
                          onValueChange={(v) => {
                            const next = Number(v) || null;
                            setSelectedClienteId(next);
                            setSelectedContratoId(null);
                            setSelectedSucursalId(null);
                            setSelectedPuestoId(null);
                          }}
                          enabled={selectedEmpresaId !== null && clienteOptions.length > 0}
                          style={styles.picker}
                        >
                          <Picker.Item
                            label={selectedEmpresaId ? 'Seleccione cliente...' : 'Seleccione empresa primero'}
                            value={0}
                            color="#000000"
                          />
                          {clienteOptions.map((c) => (
                            <Picker.Item key={c.id} label={c.nombre} value={c.id} color="#000000" />
                          ))}
                        </Picker>
                      </ThemedView>
                      {selectedEmpresaId !== null && clienteOptions.length === 0 && (
                        <ThemedText style={styles.hintText}>No hay clientes disponibles para esta empresa.</ThemedText>
                      )}
                    </ThemedView>

                    <ThemedView style={styles.formGroup}>
                      <ThemedText style={styles.formLabel}>División *</ThemedText>
                      <ThemedView style={styles.pickerWrapper}>
                        <Picker
                          selectedValue={selectedDivisionId ?? 0}
                          onValueChange={(v) => {
                            const next = Number(v) || null;
                            setSelectedDivisionId(next);
                            setSelectedContratoId(null);
                            setSelectedSucursalId(null);
                            setSelectedPuestoId(null);
                          }}
                          enabled={selectedClienteId !== null && divisionOptions.length > 0}
                          style={styles.picker}
                        >
                          <Picker.Item
                            label={selectedClienteId ? 'Seleccione división...' : 'Seleccione cliente primero'}
                            value={0}
                            color="#000000"
                          />
                          {divisionOptions.map((d) => (
                            <Picker.Item key={d.id} label={d.nombre} value={d.id} color="#000000" />
                          ))}
                        </Picker>
                      </ThemedView>
                      {selectedClienteId !== null && divisionOptions.length === 0 && (
                        <ThemedText style={styles.hintText}>No hay divisiones disponibles para este cliente.</ThemedText>
                      )}
                    </ThemedView>

                    <ThemedView style={styles.formGroup}>
                      <ThemedText style={styles.formLabel}>Contrato</ThemedText>
                      <ThemedView style={styles.pickerWrapper}>
                        <Picker
                          selectedValue={selectedContratoId ?? 0}
                          onValueChange={(v) => {
                            const next = Number(v) || null;
                            setSelectedContratoId(next);
                            setSelectedSucursalId(null);
                            setSelectedPuestoId(null);
                          }}
                          enabled={selectedDivisionId !== null && contratoOptions.length > 0}
                          style={styles.picker}
                        >
                          <Picker.Item
                            label={selectedDivisionId ? 'Seleccione contrato...' : 'Seleccione cliente primero'}
                            value={0}
                            color="#000000"
                          />
                          {contratoOptions.map((c) => (
                            <Picker.Item key={c.id} label={c.nombre} value={c.id} color="#000000" />
                          ))}
                        </Picker>
                      </ThemedView>
                      {selectedDivisionId !== null && contratoOptions.length === 0 && (
                        <ThemedText style={styles.hintText}>No hay contratos disponibles para esta división.</ThemedText>
                      )}
                    </ThemedView>

                    <ThemedView style={styles.formGroup}>
                      <ThemedText style={styles.formLabel}>Sucursal</ThemedText>
                      <ThemedView style={styles.pickerWrapper}>
                        <Picker
                          selectedValue={selectedSucursalId ?? 0}
                          onValueChange={(v) => {
                            const next = Number(v) || null;
                            setSelectedSucursalId(next);
                            setSelectedPuestoId(null);
                          }}
                          enabled={selectedContratoId !== null && sucursalOptions.length > 0}
                          style={styles.picker}
                        >
                          <Picker.Item
                            label={selectedContratoId ? 'Seleccione sucursal...' : 'Seleccione contrato primero'}
                            value={0}
                            color="#000000"
                          />
                          {sucursalOptions.map((s) => (
                            <Picker.Item key={s.id} label={s.nombre} value={s.id} color="#000000" />
                          ))}
                        </Picker>
                      </ThemedView>
                      {selectedContratoId !== null && sucursalOptions.length === 0 && (
                        <ThemedText style={styles.hintText}>No hay sucursales disponibles para este contrato.</ThemedText>
                      )}
                    </ThemedView>

                    <ThemedView style={styles.formGroup}>
                      <ThemedText style={styles.formLabel}>Puesto (1 por registro)</ThemedText>
                      <ThemedView style={styles.pickerWrapper}>
                        <Picker
                          selectedValue={selectedPuestoId ?? 0}
                          onValueChange={(v) => setSelectedPuestoId((Number(v) || null))}
                          enabled={selectedSucursalId !== null && puestoOptions.length > 0}
                          style={styles.picker}
                        >
                          <Picker.Item
                            label={selectedSucursalId ? 'Seleccione puesto...' : 'Seleccione sucursal primero'}
                            value={0}
                            color="#000000"
                          />
                          {puestoOptions.map((p) => (
                            <Picker.Item key={p.id} label={p.nombre} value={p.id} color="#000000" />
                          ))}
                        </Picker>
                      </ThemedView>
                      {selectedSucursalId !== null && puestoOptions.length === 0 && (
                        <ThemedText style={styles.hintText}>No hay puestos disponibles para esta sucursal.</ThemedText>
                      )}
                    </ThemedView>
                  </ThemedView>
                )}
              </ThemedView>

              {/* Fecha en que se realizó */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Fecha en que se realizó</ThemedText>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <ThemedText style={styles.dateButtonText}>
                    {convertDateTimestampToLocalString(new Date(fechaRealizado).toISOString(), false)}
                  </ThemedText>
                  <Ionicons name="calendar" size={20} color="#007AFF" />
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={fechaRealizado}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleDateChange}
                  />
                )}
              </ThemedView>

              {/* Tipo */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Tipo</ThemedText>
                <ThemedView style={styles.pickerWrapper}>
                  <Picker selectedValue={tipo} onValueChange={(v) => setTipo(v)} style={styles.picker}>
                    <Picker.Item label="Apertura" value="Apertura" color="#000000" />
                    <Picker.Item label="Cierre" value="Cierre" color="#000000" />
                  </Picker>
                </ThemedView>
              </ThemedView>

              {/* Lista de actividades */}
              <ThemedView style={styles.sectionContainer}>
                <ThemedView style={styles.sectionHeader}>
                  <ThemedText style={styles.sectionTitle}>Actividades</ThemedText>
                </ThemedView>
                <ThemedView style={styles.sectionBody}>
                  {actividades.map((actividad, index) => renderActividad(actividad, index))}
                  {selectedDivisionId !== 4 && selectedDivisionId !== 5 && (
                    <ThemedText style={styles.hintText}>No hay actividades configuradas para esta división.</ThemedText>
                  )}
                </ThemedView>
              </ThemedView>

              {/* Lista de inventario */}
              {isSeguridadDivision && (
                <ThemedView style={styles.sectionContainer}>
                  <ThemedView style={styles.sectionHeader}>
                    <ThemedText style={styles.sectionTitle}>Inventario de activos y/o equipos</ThemedText>
                  </ThemedView>
                  <ThemedView style={styles.sectionBody}>
                    {inventario.map((item, index) => renderInventario(item, index))}
                    <TouchableOpacity style={styles.addButton} onPress={addInventario}>
                      <Ionicons name="add-circle" size={24} color="#4CAF50" />
                      <ThemedText style={styles.addButtonText}>Agregar Item de Inventario</ThemedText>
                    </TouchableOpacity>
                  </ThemedView>
                </ThemedView>
              )}

              {/* Fotografías */}
              <ThemedView style={styles.sectionContainer}>
                <ThemedView style={styles.sectionHeader}>
                  <ThemedText style={styles.sectionTitle}>Fotografías</ThemedText>
                </ThemedView>
                <ThemedView style={styles.sectionBody}>
                  <ThemedText style={styles.sectionSubtitle}>
                    Tome fotografías de las instalaciones estado de recibido/entrega
                  </ThemedText>
                  <TouchableOpacity style={styles.cameraButton} onPress={openCamera}>
                    <Ionicons name="camera" size={24} color="#FFFFFF" />
                    <ThemedText style={styles.cameraButtonText}>Tomar Foto</ThemedText>
                  </TouchableOpacity>
                  {(imagenesRemote.length > 0 || imagenesLocal.length > 0) && (
                    <ThemedView style={styles.photosContainer}>
                      {imagenesRemote.map((img) => (
                        <ThemedView key={`r-${img.id}`} style={styles.photoItem}>
                          <Image source={{ uri: img.url }} style={styles.photoPreview} resizeMode="contain" />
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
              </ThemedView>

              {/* Otras Observaciones */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Otras Observaciones</ThemedText>
                <TextInput
                  style={[styles.formInput, styles.textArea]}
                  placeholder="Otras Observaciones"
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                  value={otrasObservaciones}
                  onChangeText={setOtrasObservaciones}
                />
              </ThemedView>

              {/* Nombres de representantes */}
              <ThemedText style={styles.formSectionTitle}>Representantes</ThemedText>
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Nombre representante del cliente</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Nombre representante del cliente"
                  placeholderTextColor="#999"
                  value={nombreRepresentanteCliente}
                  onChangeText={setNombreRepresentanteCliente}
                />
              </ThemedView>

              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Nombre representante empresa entrante</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Nombre representante empresa entrante"
                  placeholderTextColor="#999"
                  value={nombreRepresentanteEmpresaEntrante}
                  onChangeText={setNombreRepresentanteEmpresaEntrante}
                />
              </ThemedView>

              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Nombre representante empresa saliente</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Nombre representante empresa saliente"
                  placeholderTextColor="#999"
                  value={nombreRepresentanteEmpresaSaliente}
                  onChangeText={setNombreRepresentanteEmpresaSaliente}
                />
              </ThemedView>

              {/* Firmas dibujadas */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formSectionTitle}>Firma representante cliente</ThemedText>
                {!firmaRepresentanteCliente ? (
                  <TouchableOpacity
                    style={styles.signatureButton}
                    onPress={() => openSignatureModal('cliente')}
                  >
                    <Ionicons name="create-outline" size={24} color="#007AFF" />
                    <ThemedText style={styles.signatureButtonText}>Toca para dibujar la firma</ThemedText>
                  </TouchableOpacity>
                ) : (
                  <ThemedView style={styles.signaturePreviewContainer}>
                    <Image
                      source={{ uri: formatSignatureForDisplay(firmaRepresentanteCliente) || '' }}
                      style={styles.signaturePreview}
                    />
                    <TouchableOpacity
                      style={styles.clearSignatureButton}
                      onPress={() => setFirmaRepresentanteCliente(null)}
                    >
                      <Ionicons name="trash" size={16} color="#FF3B30" />
                      <ThemedText style={styles.clearSignatureButtonText}>Eliminar Firma</ThemedText>
                    </TouchableOpacity>
                  </ThemedView>
                )}
              </ThemedView>

              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formSectionTitle}>Firma representante empresa entrante</ThemedText>
                {!firmaRepresentanteEmpresaEntrante ? (
                  <TouchableOpacity style={styles.signatureButton} onPress={() => openSignatureModal('entrante')}>
                    <Ionicons name="create-outline" size={24} color="#007AFF" />
                    <ThemedText style={styles.signatureButtonText}>Toca para dibujar la firma</ThemedText>
                  </TouchableOpacity>
                ) : (
                  <ThemedView style={styles.signaturePreviewContainer}>
                    <Image source={{ uri: formatSignatureForDisplay(firmaRepresentanteEmpresaEntrante) || '' }} style={styles.signaturePreview} />
                    <TouchableOpacity style={styles.clearSignatureButton} onPress={() => setFirmaRepresentanteEmpresaEntrante(null)}>
                      <Ionicons name="trash" size={16} color="#FF3B30" />
                      <ThemedText style={styles.clearSignatureButtonText}>Eliminar Firma</ThemedText>
                    </TouchableOpacity>
                  </ThemedView>
                )}
              </ThemedView>

              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formSectionTitle}>Firma representante empresa saliente</ThemedText>
                {!firmaRepresentanteEmpresaSaliente ? (
                  <TouchableOpacity style={styles.signatureButton} onPress={() => openSignatureModal('saliente')}>
                    <Ionicons name="create-outline" size={24} color="#007AFF" />
                    <ThemedText style={styles.signatureButtonText}>Toca para dibujar la firma</ThemedText>
                  </TouchableOpacity>
                ) : (
                  <ThemedView style={styles.signaturePreviewContainer}>
                    <Image source={{ uri: formatSignatureForDisplay(firmaRepresentanteEmpresaSaliente) || '' }} style={styles.signaturePreview} />
                    <TouchableOpacity style={styles.clearSignatureButton} onPress={() => setFirmaRepresentanteEmpresaSaliente(null)}>
                      <Ionicons name="trash" size={16} color="#FF3B30" />
                      <ThemedText style={styles.clearSignatureButtonText}>Eliminar Firma</ThemedText>
                    </TouchableOpacity>
                  </ThemedView>
                )}
              </ThemedView>

              {/* Firma responsable (QR) */}
              <ThemedView style={styles.sectionContainer}>
                <ThemedView style={styles.sectionHeader}>
                  <ThemedText style={styles.sectionTitle}>Firma responsable</ThemedText>
                </ThemedView>
                <ThemedView style={styles.sectionBody}>
                  <ThemedView style={styles.firmaButtonsRow}>
                    <TouchableOpacity style={styles.firmaBlueButton} onPress={handleGenerateFirmaResponsable} disabled={isGeneratingFirma}>
                      <Ionicons name="qr-code-outline" size={18} color="#FFFFFF" />
                      <ThemedText style={styles.firmaBlueButtonText}>{isGeneratingFirma ? 'Generando...' : 'Generar'}</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.firmaBlueButton} onPress={handleScanFirmaResponsable}>
                      <Ionicons name="scan-outline" size={18} color="#FFFFFF" />
                      <ThemedText style={styles.firmaBlueButtonText}>Escanear QR</ThemedText>
                    </TouchableOpacity>
                  </ThemedView>
                  {!firmaResponsable ? (
                    <ThemedText style={styles.hintText}>Debes generar o escanear una firma.</ThemedText>
                  ) : (
                    <ThemedView style={styles.firmaInfoBox}>
                      <ThemedView style={styles.firmaInfoHeader}>
                        <ThemedText style={styles.firmaInfoTitle}>Firma registrada</ThemedText>
                        <TouchableOpacity onPress={() => setFirmaResponsable('')} style={styles.firmaTinyTrash}>
                          <Ionicons name="trash" size={14} color="#FF3B30" />
                        </TouchableOpacity>
                      </ThemedView>
                      {(() => {
                        const info = decodeFirmaHash(firmaResponsable);
                        if (!info) return <ThemedText style={styles.hintText}>QR sin información decodificable.</ThemedText>;
                        return (
                          <>
                            <ThemedText style={styles.firmaInfoText}>Sesión: {info.sessionId}</ThemedText>
                            <ThemedText style={styles.firmaInfoText}>Empleado: {info.empleadoId}</ThemedText>
                            <ThemedText style={styles.firmaInfoText}>Lat/Lng: {info.latitud}, {info.longitud}</ThemedText>
                            <ThemedText style={styles.firmaInfoText}>Hora: {convertDateTimestampToLocalString(new Date(Number(info.timestamp)).toISOString())}</ThemedText>
                          </>
                        );
                      })()}
                    </ThemedView>
                  )}
                </ThemedView>
              </ThemedView>

              <ThemedView style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.cancelButton]}
                  onPress={editingRecord ? cancelEditing : cancelCreating}
                >
                  {getActionIcon('cancel')}
                  <ThemedText style={[styles.actionButtonText, styles.actionButtonTextDark]}>Cancelar</ThemedText>
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
                  style={[styles.actionButton, styles.saveButton, isSubmitting && styles.buttonDisabled]}
                  onPress={editingRecord ? updatePositionHandler : savePositionHandler}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      {getActionIcon('confirm')}
                      <ThemedText style={[styles.actionButtonText, styles.actionButtonTextLight]}>
                        {editingRecord ? 'Actualizar' : 'Guardar'}
                      </ThemedText>
                    </>
                  )}
                </TouchableOpacity>
              </ThemedView>
            </ThemedView>
          ) : (
            <ThemedView style={styles.listSection}>
              {isConnected && (
                <Collapsible title="Filtros jerárquicos">
                  <ThemedView style={styles.hierarchyFiltersContainer}>
                    <ThemedView style={styles.hierarchyFiltersHeader}>
                      <TouchableOpacity
                        style={styles.hierarchyResetButton}
                        onPress={() => {
                          setFilterEmpresaId(null);
                          setFilterClienteId(null);
                          setFilterDivisionId(null);
                          setFilterContratoId(null);
                          setFilterCorpoId(null);
                          fetchPositions();
                        }}
                      >
                        <Ionicons name="refresh" size={16} color="#FF3B30" />
                        <ThemedText style={styles.hierarchyResetText}>Reiniciar</ThemedText>
                      </TouchableOpacity>
                    </ThemedView>

                    <ThemedView style={styles.hierarchyFiltersContent}>
                  <ThemedView style={styles.formGroup}>
                    <ThemedText style={styles.formLabel}>Empresa</ThemedText>
                    <ThemedView style={styles.pickerWrapper}>
                      <Picker
                        selectedValue={filterEmpresaId ?? 0}
                        onValueChange={(v) => {
                          const next = Number(v) || null;
                          setFilterEmpresaId(next);
                          setFilterClienteId(null);
                          setFilterDivisionId(null);
                          setFilterContratoId(null);
                          setFilterCorpoId(null);
                        }}
                        style={styles.picker}
                      >
                        <Picker.Item label="Todas" value={0} color="#000000" />
                        {filterEmpresas.map((e) => (
                          <Picker.Item key={e.id} label={e.nombre} value={e.id} color="#000000" />
                        ))}
                      </Picker>
                    </ThemedView>
                  </ThemedView>

                  <ThemedView style={styles.formGroup}>
                    <ThemedText style={styles.formLabel}>Cliente</ThemedText>
                    <ThemedView style={styles.pickerWrapper}>
                      <Picker
                        selectedValue={filterClienteId ?? 0}
                        onValueChange={(v) => {
                          const next = Number(v) || null;
                          setFilterClienteId(next);
                          setFilterDivisionId(null);
                          setFilterContratoId(null);
                          setFilterCorpoId(null);
                        }}
                        enabled={filterEmpresaId !== null && filterClientes.length > 0}
                        style={styles.picker}
                      >
                        <Picker.Item label={filterEmpresaId !== null ? 'Todos' : 'Seleccione empresa primero'} value={0} color="#000000" />
                        {filterClientes.map((c) => (
                          <Picker.Item key={c.id} label={c.nombre} value={c.id} color="#000000" />
                        ))}
                      </Picker>
                    </ThemedView>
                  </ThemedView>

                  <ThemedView style={styles.formGroup}>
                    <ThemedText style={styles.formLabel}>División</ThemedText>
                    <ThemedView style={styles.pickerWrapper}>
                      <Picker
                        selectedValue={filterDivisionId ?? 0}
                        onValueChange={(v) => {
                          const next = Number(v) || null;
                          setFilterDivisionId(next);
                          setFilterContratoId(null);
                          setFilterCorpoId(null);
                        }}
                        enabled={filterClienteId !== null && filterDivisiones.length > 0}
                        style={styles.picker}
                      >
                        <Picker.Item label={filterClienteId !== null ? 'Todas' : 'Seleccione cliente primero'} value={0} color="#000000" />
                        {filterDivisiones.map((d) => (
                          <Picker.Item key={d.id} label={d.nombre} value={d.id} color="#000000" />
                        ))}
                      </Picker>
                    </ThemedView>
                  </ThemedView>

                  <ThemedView style={styles.formGroup}>
                    <ThemedText style={styles.formLabel}>Contrato</ThemedText>
                    <ThemedView style={styles.pickerWrapper}>
                      <Picker
                        selectedValue={filterContratoId ?? 0}
                        onValueChange={(v) => {
                          const next = Number(v) || null;
                          setFilterContratoId(next);
                          setFilterCorpoId(null);
                        }}
                        enabled={filterDivisionId !== null && filterContratos.length > 0}
                        style={styles.picker}
                      >
                        <Picker.Item label={filterDivisionId !== null ? 'Todos' : 'Seleccione división primero'} value={0} color="#000000" />
                        {filterContratos.map((c) => (
                          <Picker.Item key={c.id} label={c.nombre} value={c.id} color="#000000" />
                        ))}
                      </Picker>
                    </ThemedView>
                  </ThemedView>

                  <ThemedView style={styles.formGroup}>
                    <ThemedText style={styles.formLabel}>Sucursal</ThemedText>
                    <ThemedView style={styles.pickerWrapper}>
                      <Picker
                        selectedValue={filterCorpoId ?? 0}
                        onValueChange={(v) => {
                          const next = Number(v) || null;
                          setFilterCorpoId(next);
                          fetchPositions(next != null ? String(next) : undefined);
                        }}
                        enabled={filterContratoId !== null && filterSucursales.length > 0}
                        style={styles.picker}
                      >
                        <Picker.Item label={filterContratoId !== null ? 'Todas' : 'Seleccione contrato primero'} value={0} color="#000000" />
                        {filterSucursales.map((s) => (
                          <Picker.Item key={s.id} label={s.nombre} value={s.id} color="#000000" />
                        ))}
                      </Picker>
                    </ThemedView>
                  </ThemedView>
                </ThemedView>
              </ThemedView>
                </Collapsible>
              )}

              {!isLoading && (
                <TouchableOpacity style={styles.createButton} onPress={startCreating}>
                  <Ionicons name="add" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              )}
              {renderPositionList()}
            </ThemedView>
          )}
        </ThemedView>
      </ScrollView>

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

      {/* Signature Modal */}
      <Modal
        visible={isSignatureModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={closeSignatureModal}
      >
        <ThemedView style={styles.modalOverlay}>
          <ThemedView style={styles.modalContainer}>
            <ThemedView style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>
                {signatureTarget === 'cliente'
                  ? 'Firma representante cliente'
                  : signatureTarget === 'entrante'
                    ? 'Firma representante empresa entrante'
                    : 'Firma representante empresa saliente'}
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

      {/* QR Scanner */}
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
                              {(Array.isArray(parsed) ? parsed : []).map((c: any, idx: number) => {
                                const prop = String(c?.prop ?? '-');
                                const value = c?.after;
                                const manualSignatureProps = ['firma_representante_cliente', 'firma_representante_empresa_entrante', 'firma_representante_empresa_saliente'];

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
                                        if (manualSignatureProps.includes(k) || k === 'firma_responsable') return null;
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
                                                ? `Sesión: ${info.sessionId || 'N/A'} - Empleado: ${info.empleadoId || 'N/A'} - Hora: ${ convertDateTimestampToLocalString(new Date(Number(info.timestamp)).toISOString()) || 'N/A'}`
                                                : 'Firma responsable (formato no decodificable)';
                                            })()}
                                          </ThemedText>
                                        </ThemedView>
                                      )}
                                      {manualSignatureProps.map((firmaProp) => created[firmaProp] && (
                                        <ThemedView key={`c-${row.id}-${idx}-${firmaProp}`} style={styles.changeDescriptionContainer}>
                                          <ThemedText style={styles.changeDescription}>
                                            <ThemedText style={{ fontWeight: '800' }}>{firmaProp}: </ThemedText>
                                          </ThemedText>
                                          <Image source={{ uri: formatSignatureForDisplay(created[firmaProp]) ?? '' }} style={styles.cambioSignatureImage} resizeMode="contain" />
                                        </ThemedView>
                                      ))}
                                    </React.Fragment>
                                  );
                                }

                                const isResponsable = prop === 'firma_responsable';
                                const isManualSignature = manualSignatureProps.includes(prop);
                                return (
                                  <ThemedView key={`c-${row.id}-${idx}`} style={styles.changeDescriptionContainer}>
                                    <ThemedText style={styles.changeDescription}>
                                      <ThemedText style={{ fontWeight: '800' }}>{prop}: </ThemedText>
                                      {!isManualSignature && !isResponsable && formatChangeValue(prop, value)}
                                      {isResponsable && (() => {
                                        const info = typeof value === 'string' ? decodeFirmaHash(value) : null;
                                        if (!info) return 'Firma responsable (formato no decodificable)';
                                        return `Sesión: ${info.sessionId || 'N/A'} - Empleado: ${info.empleadoId || 'N/A'} - Hora: ${ convertDateTimestampToLocalString(new Date(Number(info.timestamp)).toISOString()) || 'N/A'}`;
                                      })()}
                                    </ThemedText>
                                    {isManualSignature && value && (
                                      <Image source={{ uri: formatSignatureForDisplay(value) ?? '' }} style={styles.cambioSignatureImage} resizeMode="contain" />
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

      <AppFooter />
      <SlideMenu
        isVisible={isMenuVisible}
        onClose={handleMenuClose}
        onHomePress={handleHomePress}
        currentRoute="OpeningClosingPosition"
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  // Layout (mismo patrón que LlavesScreen)
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },
  contentContainer: { width: '100%', maxWidth: 800, alignSelf: 'center' },
  // Header principal (como LlavesScreen: título + subtítulo + línea)
  titleContainer: {
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 8, color: '#000000' },
  subtitle: { fontSize: 14, opacity: 0.7, textAlign: 'center', color: '#000000' },
  noMarcaContainer: {
    padding: 20,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EF5350',
    alignItems: 'center',
    marginBottom: 20,
  },
  noMarcaTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#D32F2F',
    marginBottom: 10,
  },
  noMarcaMessage: {
    fontSize: 14,
    color: '#D32F2F',
    textAlign: 'center',
  },
  createButton: { backgroundColor: '#007AFF', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginBottom: 16, flexDirection: 'row', justifyContent: 'center', gap: 10 },
  createButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  // Form card (similar a LlavesScreen.formCard)
  formContainer: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#E0E0E0' },
  formGroup: {
    marginBottom: 15,
  },
  formLabel: { fontSize: 13, fontWeight: '700', marginBottom: 6, color: '#333' },
  formInput: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, fontSize: 14, color: '#000000', backgroundColor: '#FFFFFF' },
  pickerWrapper: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, overflow: 'hidden', backgroundColor: '#FFFFFF', justifyContent: 'center' },
  picker: { height: 54, width: '100%', color: '#000000', fontSize: 16 },
  pickerItem: { fontSize: 16, height: 54 },
  hintText: {
    marginTop: 6,
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  loadingInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  loadingInlineText: {
    fontSize: 14,
    color: '#000000',
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
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
  tipoContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tipoOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#F9F9F9',
    gap: 8,
  },
  tipoOptionSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  tipoCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  tipoOptionText: {
    fontSize: 14,
    color: '#000000',
  },
  tipoOptionTextSelected: {
    color: '#FFFFFF',
  },
  sectionContainer: {
    width: '100%',
    marginTop: 14,
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    flex: 1,
  },
  sectionBody: {
    marginTop: 10,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EAEAEA',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 10,
    fontStyle: 'italic',
  },
  actividadItem: {
    marginBottom: 15,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
    padding: 12,
  },
  actividadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#F5F5F5',
  },
  actividadHeaderContent: {
    flex: 1,
    marginRight: 10,
  },
  actividadHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  radioRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 10,
    marginBottom: 10,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  radioLabel: {
    fontSize: 14,
    color: '#000000',
  },
  actividadHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  removeActividadButton: {
    padding: 4,
  },
  actividadContent: {
    padding: 15,
  },
  inventarioItem: {
    marginBottom: 15,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  inventarioHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#F5F5F5',
  },
  inventarioHeaderContent: {
    flex: 1,
    marginRight: 10,
  },
  inventarioHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  inventarioHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  removeInventarioButton: {
    padding: 4,
  },
  inventarioContent: {
    padding: 15,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#FF9500',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#000000',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    marginTop: 10,
    gap: 8,
  },
  addButtonText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
  },
  cameraButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    gap: 10,
    marginBottom: 15,
  },
  firmaButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  firmaBlueButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 10,
    gap: 8,
  },
  firmaBlueButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  firmaInfoBox: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  firmaInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  firmaInfoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
  },
  firmaInfoText: {
    fontSize: 12,
    color: '#333',
    marginTop: 2,
  },
  firmaTinyTrash: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  cameraButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  photosContainer: {
    marginTop: 10,
  },
  photoItem: {
    width: '100%',
    position: 'relative',
    marginBottom: 15,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  photoPreview: {
    width: '100%',
    height: 300,
    borderRadius: 8,
  },
  removePhotoButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 15,
    padding: 5,
  },
  signatureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2196F3',
    gap: 8,
    minHeight: 100,
  },
  signatureButtonText: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '600',
  },
  signaturePreviewContainer: {
    padding: 10,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  signaturePreview: {
    width: '100%',
    height: 150,
    resizeMode: 'contain',
    marginBottom: 10,
  },
  clearSignatureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    backgroundColor: '#FFEBEE',
    borderRadius: 6,
    gap: 6,
  },
  clearSignatureButtonText: {
    fontSize: 12,
    color: '#FF3B30',
    fontWeight: '600',
  },
  actionButtons: { marginTop: 16, flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  actionButton: { flex: 1, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12 },
  cancelButton: { backgroundColor: '#EDEDED' },
  saveButton: { backgroundColor: '#007AFF' },
  actionButtonText: { fontSize: 16, fontWeight: '800' },
  actionButtonTextDark: { color: '#000000' },
  actionButtonTextLight: { color: '#FFFFFF' },
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
  listSection: {
    width: '100%',
  },
  hierarchyFiltersContainer: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 10,
  },
  hierarchyFiltersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  hierarchyFiltersTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#007AFF',
  },
  hierarchyResetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF3B30',
    backgroundColor: '#FFF5F5',
  },
  hierarchyResetText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF3B30',
  },
  hierarchyFiltersContent: {
    padding: 12,
    gap: 8,
    backgroundColor: '#F8F9FA',
  },
  listContainer: {
    width: '100%',
    marginTop: 10,
  },
  // Cards (similar a LlavesScreen.bitacoraCard)
  listItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 0,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    marginBottom: 12,
    overflow: 'hidden',
  },
  listItemHeader: { padding: 16 },
  listItemContent: {
    flex: 1,
  },
  listItemTitle: { fontSize: 16, fontWeight: '800', color: '#000000' },
  listItemSubtitle: { marginTop: 4, fontSize: 13, color: '#000000', opacity: 0.7 },
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
    borderTopWidth: 1,
    borderTopColor: '#EEE',
    padding: 16,
  },
  // Collapsables en items (mismo patrón que LlavesScreen)
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
  collapseButtonText: { fontSize: 13, fontWeight: '600', color: '#007AFF' },
  collapsableContent: { marginTop: 8, padding: 10, borderRadius: 8, backgroundColor: '#F8F9FA' },
  detailBlock: { marginBottom: 10, backgroundColor: '#F8F9FA' },
  detailLine: { marginBottom: 4, color: '#000', backgroundColor: '#F8F9FA' },
  detailLabel: { fontWeight: '700', color: '#333' },
  detailValue: { color: '#000' },
  photoItemMini: {
    width: '100%',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 8,
    backgroundColor: '#FFFFFF',
  },
  photoPreviewMini: { width: '100%', height: 200, borderRadius: 8, backgroundColor: '#F8F9FA' },
  photoCaption: { marginTop: 8, fontSize: 12, color: '#000', opacity: 0.7 },
  // Títulos del formulario como en módulos previos (azul)
  formSectionTitle: { marginTop: 14, fontSize: 15, fontWeight: '800', color: '#007AFF' },
  listItemButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 10,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 500,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalSignatureContainer: {
    height: 300,
    width: '100%',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 12,
  },
  modalClearButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    gap: 8,
  },
  modalClearButtonText: {
    fontSize: 16,
    color: '#000000',
    fontWeight: '600',
  },
  modalAcceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    gap: 8,
  },
  modalAcceptButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
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
  changeDescriptionContainer: { marginBottom: 8 },
  cambioSignatureImage: { marginTop: 6, height: 80, width: 160, backgroundColor: '#f0f0f0', borderRadius: 4 },
  filterGroupSearch: { marginBottom: 12 },
  filterLabel: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 4 },
});

