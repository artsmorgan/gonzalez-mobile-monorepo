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
import { CameraView, useCameraPermissions } from 'expo-camera';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import SignatureScreen from 'react-native-signature-canvas';
import * as Location from 'expo-location';
import { jwtDecode } from 'jwt-decode';
import * as Network from 'expo-network';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import Constants from 'expo-constants';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import AppHeader from '@/components/AppHeader';
import AppFooter from '@/components/AppFooter';
import SlideMenu from '@/components/SlideMenu';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { formatDateDMY as formatDateDMYValue } from '@/utils/formatDate';
import { useAuth } from '@/contexts/AuthContext';
import { eventBus } from '@/hooks/eventBus';
import getHoraAccion from '@/hooks/getHoraAccion';
import { useQRScanner } from '@/hooks/useQRScanner';
import authedFetch from '@/hooks/authedFetch';
import {
  createGeneralInductionRegister,
  deleteGeneralInductionRegister,
  listGeneralInductionRegisterByCorpo,
  listGeneralInductionRegisters,
  updateGeneralInductionRegister,
} from '@/hooks/evaluationFunctions';
import { RootStackParamList } from '../App';
import { convertDateTimestampToLocalString } from '@/hooks/convertDateTimestampToLocalString';

type GeneralInductionRegisterScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'GeneralInductionRegister'
>;

type MainStructureEmpleadoNode = { id: number; nombre: string; cedula?: string | null };
type MainStructurePlazaNode = { id: number; nombre: string; empleados?: MainStructureEmpleadoNode[] };
type MainStructurePuestoNode = { id: number; nombre: string; plazas: MainStructurePlazaNode[] };
type MainStructureSucursalNode = { id: number; nombre: string; puestos: MainStructurePuestoNode[] };
type MainStructureContratoNode = { id: number; nombre: string; sucursales: MainStructureSucursalNode[] };
type MainStructureDivisionNode = { id: number; nombre: string; contratos: MainStructureContratoNode[] };
type MainStructureClienteNode = { id: number; nombre: string; division: MainStructureDivisionNode[] };
type MainStructureEmpresaNode = { id: number; nombre: string; clientes: MainStructureClienteNode[] };
type MainStructureTree = MainStructureEmpresaNode[];

type TemaNode = { id: string; text: string; children?: TemaNode[] };
type TemaFlatItem = { key: string; id: string; text: string; level: number; isLeaf: boolean };
type TemaSelectedItem = { id: string; text: string };
type TemaData = { flat: TemaFlatItem[]; leafTextById: Record<string, string> };

type PersonaItem = {
  id_local: string;
  nombre: string;
  cedula: string;
  puesto_text: string;
  puesto_id: number | null;
  firma: string | null;
};

type GeneralInductionRegisterRecord = {
  id: number | string;
  id_local: string;
  empresa_id: number;
  cliente_id: number;
  corpo_id: number;
  division: string;
  fecha: string | null;
  temas_a_tratar: string;
  colaboradores: string;
  capacitadores: string;
  firma_responsable: string;
  created_at: string;
  created_by: string;
  empresa_nombre?: string | null;
  cliente_nombre?: string | null;
  corpo_nombre?: string | null;
  images?: Array<{ id?: number; name?: string; base64?: string; extension?: string; url?: string }>;
  synced?: boolean;
};

type EditingRecord = {
  id: string | null;
  id_local: string;
};

const TEMAS_DIV_AYL: TemaNode[] = [
  { id: '1', text: 'Presentación del Asistente de Operaciones de Aseo y Limpieza' },
  { id: '2', text: 'Nombre de los Supervisores' },
  {
    id: '3',
    text: 'Manual de Puesto',
    children: [
      { id: '3.1', text: 'Información del cliente' },
      { id: '3.2', text: 'Reporte de asistencia' },
      { id: '3.3', text: 'Funciones y Responsabilidades' },
      { id: '3.4', text: 'Servicio al cliente' },
      { id: '3.5', text: 'Código de vestimenta' },
      { id: '3.6', text: 'Uso del teléfono' },
      { id: '3.7', text: 'Confidencialidad' },
      { id: '3.8', text: 'Gestión Documental: uso de registros y bitácoras' },
      { id: '3.9', text: 'Manejo de papelería del cliente (si aplica)' },
      { id: '3.10', text: 'Cuidados del Equipo' },
      { id: '3.11', text: 'Evaluación del Desempeño' },
    ],
  },
  {
    id: '4',
    text: 'Horario de trabajo',
    children: [
      { id: '4.1', text: 'Fecha y Hora de Primer día Ingreso' },
      { id: '4.2', text: 'Rol de trabajo (hora de entrada y salida)' },
      { id: '4.3', text: 'Prohibición de salida de las instalaciones' },
      { id: '4.4', text: 'Tiempo de alimentación' },
      { id: '4.5', text: 'Jornada laboral (8 horas/ 12 horas/ Mixta/ Diurna, etc)' },
      { id: '4.6', text: 'Día de descanso' },
    ],
  },
  {
    id: '5',
    text: 'Uso de Equipos',
    children: [
      { id: '5.1', text: 'Uso Correcto y Cuidado de Cepillo Eléctrico' },
      { id: '5.2', text: 'Uso Correcto y Cuidado de Aspiradora' },
      { id: '5.3', text: 'Uso Correcto y Cuidado de Hidrolavadora' },
      { id: '5.4', text: 'Uso Correcto y Cuidado de Máquina de vapor' },
      { id: '5.5', text: 'Uso Correcto y Cuidado de Equipo de Jardinería (guadañas, chapeadoras, orilladoras,etc)' },
    ],
  },
  {
    id: '6',
    text: 'Políticas',
    children: [
      { id: '6.1', text: 'Incapacidad' },
      { id: '6.2', text: 'Vacaciones' },
      { id: '6.3', text: 'Permisos con y sin goce salarial' },
      { id: '6.4', text: 'Devolución de uniformes, gafetes y otros' },
      { id: '6.5', text: 'Disciplina Progresiva' },
      { id: '6.6', text: 'Feriados' },
      { id: '6.7', text: 'Reporte de Accidentes (inmediato)' },
      { id: '6.8', text: 'Acoso Sexual y Laboral' },
    ],
  },
];

const TEMAS_DIV_SEG: TemaNode[] = [
  { id: '1', text: 'Presentación del Ejecutivo de cuenta o Coordinador Regional' },
  { id: '2', text: 'Nombre de los Supervisores' },
  { id: '3', text: 'Nombre de los Coordinadores (cuando aplique)' },
  { id: '4', text: 'Información sobre el Cliente y el Contrato' },
  { id: '5', text: 'Enlace del cliente en el lugar de trabajo' },
  { id: '6', text: 'Ubicación geográfica del puesto' },
  {
    id: '7',
    text: 'Horario de trabajo',
    children: [
      { id: '7.1', text: 'Fecha y Hora de Primer día Ingreso' },
      { id: '7.2', text: 'Rol de trabajo' },
      { id: '7.3', text: 'Jornada laboral (8 horas/ 12 horas/ Mixta/ Diurna, etc)' },
      { id: '7.4', text: 'Día de descanso' },
      { id: '7.5', text: 'Obligatoriedad de trabajar días feriados' },
    ],
  },
  {
    id: '8',
    text: 'Manual del puesto',
    children: [
      {
        id: '8.1',
        text: 'Descripción de funciones y responsabilidades en el puesto',
        children: [
          { id: '8.1.i', text: 'Espera de relevo' },
          { id: '8.1.ii', text: 'Reporte de asistencia' },
          { id: '8.1.iii', text: 'Tiempos de alimentación' },
          { id: '8.1.iv', text: 'Prohibición de salida de las instalaciones' },
          { id: '8.1.v', text: 'Revisión de perímetro' },
          { id: '8.1.vi', text: 'Manejo de llaves' },
          { id: '8.1.vii', text: 'Revisión de vehículos' },
          { id: '8.1.viii', text: 'Control de ingreso y salida de personas y activos' },
        ],
      },
      { id: '8.2', text: 'Reporte de incidencias' },
      { id: '8.3', text: 'Uso de sistemas de alarmas y CCTV' },
      { id: '8.4', text: 'Guía de funciones del puesto' },
      { id: '8.5', text: 'Correcto llenado de bitácoras.' },
      { id: '8.6', text: 'Gestión documental, uso y llenado de registros y papelería del cliente' },
      { id: '8.7', text: 'Realización correcta de rondas y realización de marcas' },
      { id: '8.8', text: 'Protocolos de Emergencia' },
      { id: '8.9', text: 'Uso y cuidado de los equipos del puesto y propiedad del cliente' },
      { id: '8.10', text: 'Evaluación de desempeño' },
      { id: '8.11', text: 'Multas en caso de que apliquen' },
      { id: '8.12', text: 'Servicio al cliente y trato de personas con capacidades reducidas' },
    ],
  },
  {
    id: '9',
    text: 'Políticas y procedimientos',
    children: [
      { id: '9.1', text: 'Código de Ética' },
      { id: '9.2', text: 'Confidencialidad' },
      { id: '9.3', text: 'Código de vestimenta' },
      { id: '9.4', text: 'Permisos con y sin goce' },
      { id: '9.5', text: 'Procedimiento para otorgar Horas extras' },
      { id: '9.6', text: 'Procedimiento para otorgar Vacaciones' },
      { id: '9.7', text: 'Procedimiento de incapacidades' },
      { id: '9.8', text: 'Procedimiento de traslados' },
      { id: '9.9', text: 'Manual de disciplina progresiva' },
      { id: '9.10', text: 'Reporte de accidentes (inmediato)' },
      { id: '9.11', text: 'Reglamento de Acoso Sexual y Acoso Laboral' },
    ],
  },
  { id: '10', text: 'Asistencia obligatoria a las Capacitaciones, según contrato con el cliente en el que se le asigne.' },
  {
    id: '11',
    text: 'Capacitaciones básicas',
    children: [
      { id: '11.1', text: 'Correcta entrega de puesto' },
      { id: '11.2', text: 'Protocolo de entrega y manejo de arma de fuego de forma segura.' },
      { id: '11.3', text: 'Uso de legítima defensa' },
      { id: '11.4', text: 'Uso de equipo contra incendio (extintores)' },
      { id: '11.5', text: 'Uso correcto de arma letal (armas de fuego)' },
      { id: '11.6', text: 'Vara de extensión (Black Jack)' },
      { id: '11.7', text: 'Esposas' },
      { id: '11.8', text: 'Uso correcto de arma menos letal (cuando corresponda)' },
      { id: '11.9', text: 'Gas pimienta' },
      { id: '11.10', text: 'Técnicas de aprensión o detención' },
      { id: '11.11', text: 'Uso de computadora, correo electrónico, office básico.' },
      { id: '11.12', text: 'Técnicas de descripción de personal y detección de posibles amenazas' },
      { id: '11.13', text: 'Uso de radio y sistemas de comunicación' },
    ],
  },
  {
    id: '12',
    text: 'Equipo de protección personal (EPP), equipo de seguridad y uso correcto de uniforme',
    children: [
      { id: '12.1', text: 'Chaleco antibalas' },
      { id: '12.2', text: 'Chaleco reflectivo o de seguridad' },
      { id: '12.3', text: 'Cinturón porta herramientas de seguridad' },
      { id: '12.4', text: 'Botas de hule' },
      { id: '12.5', text: 'Capa o poncho' },
      { id: '12.6', text: 'Casco de seguridad' },
      { id: '12.7', text: 'Calzado apropiado según el puesto de trabajo' },
      { id: '12.8', text: 'Gorra' },
      { id: '12.9', text: 'Cubre bocas o mascarilla' },
      { id: '12.10', text: 'Bloqueador solar' },
      { id: '12.11', text: 'Equipo Motorizados: casco, rodilleras, coderas, guantes, botas altas' },
      { id: '12.12', text: 'Uso correcto y completo de uniforme (limpio, planchado)' },
    ],
  },
];

function generateRandomId() {
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function getConnectionStatus() {
  try {
    const state = await Network.getNetworkStateAsync();
    return !!(state.isConnected && state.isInternetReachable);
  } catch {
    return false;
  }
}

// Funciones para formatear datos dinámicos para mostrar en cambios
function formatTemasATratarForDisplay(temasJson: string, temasData: TemaData): string {
  try {
    const temas: TemaSelectedItem[] = safeJsonParse<TemaSelectedItem[]>(temasJson, []);
    if (!Array.isArray(temas) || temas.length === 0) return 'No hay temas seleccionados.';
    return temas.map((t, idx) => {
      const temaText = temasData.leafTextById[t.id] || t.text || t.id || '-';
      return `${idx + 1}. ${temaText}`;
    }).join('\n');
  } catch (e) {
    console.error('Error formatting temas a tratar for display:', e);
    return 'Error al formatear temas a tratar.';
  }
}

function formatPersonasForDisplay(personasJson: string, label: string): string {
  try {
    const personas: PersonaItem[] = safeJsonParse<PersonaItem[]>(personasJson, []);
    if (!Array.isArray(personas) || personas.length === 0) return `No hay ${label}.`;
    return personas.map((p, idx) => {
      const nombre = p?.nombre || '-';
      const cedula = p?.cedula || '-';
      const puesto = p?.puesto_text || '-';
      const tieneFirma = p?.firma ? 'Sí' : 'No';
      return `${idx + 1}. ${nombre} (Cédula: ${cedula}, Puesto: ${puesto}, Firma: ${tieneFirma})`;
    }).join('\n');
  } catch (e) {
    console.error(`Error formatting ${label} for display:`, e);
    return `Error al formatear ${label}.`;
  }
}

function safeJsonParse<T>(value: any, fallback: T): T {
  try {
    if (!value) return fallback;
    if (typeof value === 'string') return JSON.parse(value) as T;
    return value as T;
  } catch {
    return fallback;
  }
}

function getBase64Only(signature: string | null | undefined): string | null {
  if (!signature) return null;
  const s = String(signature);
  if (s.startsWith('data:')) {
    const parts = s.split(',');
    return parts.length >= 2 ? parts.slice(1).join(',') : null;
  }
  return s;
}

function formatSignatureForDisplay(signature: string | null | undefined): string | null {
  if (!signature) return null;
  const s = String(signature);
  if (s.startsWith('data:')) return s;
  return `data:image/png;base64,${s}`;
}

function formatDateDMY(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  return `${day}-${month}-${year}`;
}

function buildTemaDataIterative(nodes: TemaNode[]): TemaData {
  const flat: TemaFlatItem[] = [];
  const leafTextById: Record<string, string> = {};

  // DFS iterativo (sin recursividad)
  const stack: Array<{ node: TemaNode; level: number }> = [];
  for (let i = nodes.length - 1; i >= 0; i--) stack.push({ node: nodes[i], level: 0 });

  while (stack.length > 0) {
    const current = stack.pop()!;
    const n = current.node;
    const level = current.level;
    const hasChildren = !!(n.children && n.children.length > 0);
    const isLeaf = !hasChildren;

    flat.push({ key: n.id, id: n.id, text: n.text, level, isLeaf });
    if (isLeaf) leafTextById[n.id] = n.text;

    if (hasChildren) {
      for (let i = n.children!.length - 1; i >= 0; i--) {
        stack.push({ node: n.children![i], level: level + 1 });
      }
    }
  }

  return { flat, leafTextById };
}

const TEMAS_DATA_AYL: TemaData = buildTemaDataIterative(TEMAS_DIV_AYL);
const TEMAS_DATA_SEG: TemaData = buildTemaDataIterative(TEMAS_DIV_SEG);
const TEMAS_DATA_EMPTY: TemaData = { flat: [], leafTextById: {} };

export default function GeneralInductionRegisterScreen() {
  const navigation = useNavigation<GeneralInductionRegisterScreenNavigationProp>();
  const { employee, refreshAccessToken, logout, accessToken } = useAuth();
  const { scanQR, QRScannerComponent } = useQRScanner();

  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const handleMenuPress = () => setIsMenuVisible(true);
  const handleMenuClose = () => setIsMenuVisible(false);
  const handleHomePress = () => {
    setIsMenuVisible(false);
    navigation.navigate('Home');
  };

  // list state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Importante: "sin internet" NO cuenta como error (solo es un estado informativo)
  const [offlineMessage, setOfflineMessage] = useState<string | null>(null);

  const isProbablyNetworkError = (err: any) => {
    const msg = String((err as any)?.message ?? err ?? '').toLowerCase();
    return (
      msg.includes('network request failed') ||
      msg.includes('failed to fetch') ||
      msg.includes('networkerror') ||
      msg.includes('timeout') ||
      msg.includes('timed out')
    );
  };
  const [hasCurrentMarca, setHasCurrentMarca] = useState(true);
  const [records, setRecords] = useState<GeneralInductionRegisterRecord[]>([]);

  // Modal: ver cambios (auditoría)
  const [isCambiosModalVisible, setIsCambiosModalVisible] = useState(false);
  const [cambiosTitle, setCambiosTitle] = useState<string>('Cambios');
  const [cambiosItems, setCambiosItems] = useState<any[]>([]);
  const [expandedCambioId, setExpandedCambioId] = useState<number | null>(null);

  // Filtros jerárquicos
  const [isHierarchyFiltersExpanded, setIsHierarchyFiltersExpanded] = useState(false);
  const [filterEmpresaId, setFilterEmpresaId] = useState<number | null>(null);
  const [filterClienteId, setFilterClienteId] = useState<number | null>(null);
  const [filterCorpoId, setFilterCorpoId] = useState<number | null>(null);

  // IDs de current_marca para inicialización
  const [marcaEmpresaId, setMarcaEmpresaId] = useState<number | null>(null);
  const [marcaClienteId, setMarcaClienteId] = useState<number | null>(null);
  const [marcaCorpoId, setMarcaCorpoId] = useState<number | null>(null);

  // structure tree
  const [structure, setStructure] = useState<MainStructureTree>([]);
  const [isStructureLoading, setIsStructureLoading] = useState(false);

  const [marcaDivisionId, setMarcaDivisionId] = useState<number | null>(null);

  const [selectedEmpresaId, setSelectedEmpresaId] = useState<number | null>(null);
  const [selectedClienteId, setSelectedClienteId] = useState<number | null>(null);
  const [selectedDivisionId, setSelectedDivisionId] = useState<number | null>(null);
  const [selectedContratoId, setSelectedContratoId] = useState<number | null>(null);
  const [selectedSucursalId, setSelectedSucursalId] = useState<number | null>(null);
  const [divisionOptions, setDivisionOptions] = useState<Array<{ id: number; nombre: string }>>([]);
  const [isDivisionOptionsLoading, setIsDivisionOptionsLoading] = useState(false);

  // form
  const [isCreating, setIsCreating] = useState(false);
  const [editingRecord, setEditingRecord] = useState<EditingRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResponse, setSubmitResponse] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const [fecha, setFecha] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Temas seleccionados: array de objetos {id, text} (se guarda en DB como string JSON)
  const [selectedTemas, setSelectedTemas] = useState<TemaSelectedItem[]>([]);
  const [temasVisibleCount, setTemasVisibleCount] = useState(60);
  const [colaboradoresList, setColaboradoresList] = useState<PersonaItem[]>([]);
  const [capacitadoresList, setCapacitadoresList] = useState<PersonaItem[]>([]);
  const [expandedColaboradores, setExpandedColaboradores] = useState<string[]>([]);
  const [expandedCapacitadores, setExpandedCapacitadores] = useState<string[]>([]);
  const [colaboradorCodigoInput, setColaboradorCodigoInput] = useState<Record<string, string>>({});

  const [images, setImages] = useState<Array<{ id?: number; name?: string; base64?: string; extension?: string; url?: string }>>([]);
  const [photosDirty, setPhotosDirty] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [isCameraVisible, setIsCameraVisible] = useState(false);

  const [firmaResponsableHash, setFirmaResponsableHash] = useState('');
  const [isGeneratingFirmaResponsable, setIsGeneratingFirmaResponsable] = useState(false);

  const [signatureModalVisible, setSignatureModalVisible] = useState(false);
  const [signatureTarget, setSignatureTarget] = useState<{ list: 'colab' | 'cap'; id_local: string } | null>(null);
  const signatureRef = useRef<any>(null);
  const [signatureKey, setSignatureKey] = useState(0);
  const [isImagePreviewVisible, setIsImagePreviewVisible] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

  const signatureWebStyle = `
    .m-signature-pad { box-shadow: none; border: none; }
    .m-signature-pad--body { border: 1px solid #E0E0E0; background: #FFFFFF; }
    .m-signature-pad--footer { display: none; margin: 0px; }
    body,html { width: 100%; height: 100%; }
    canvas { background: #FFFFFF; }
  `;

  const closeSignatureModal = () => {
    setSignatureModalVisible(false);
  };

  const clearSignatureInModal = () => {
    setSignatureKey((prev) => prev + 1);
    if (signatureRef.current?.clearSignature) {
      signatureRef.current.clearSignature();
    }
  };

  const acceptSignature = () => {
    if (signatureRef.current?.readSignature) {
      signatureRef.current.readSignature();
      return;
    }
    Alert.alert('Error', 'Debe dibujar una firma antes de aceptar');
  };

  const handleSignatureRead = (signature: string) => {
    if (!signature) {
      Alert.alert('Error', 'No se pudo obtener la firma. Por favor, intente nuevamente.');
      return;
    }
    let formatted = signature;
    if (!signature.startsWith('data:')) {
      formatted = `data:image/png;base64,${signature}`;
    }
    onSignatureOK(formatted);
  };

  const appendTokenToUrl = (url?: string | null) => {
    const raw = String(url || '').trim();
    if (!raw) return '';
    if (!accessToken) return raw;
    return `${raw}${raw.includes('?') ? '&' : '?'}token=${encodeURIComponent(String(accessToken))}`;
  };

  const loadImageFromServer = useCallback(async (registroId: number, imageName: string): Promise<string | null> => {
    try {
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) return null;

      const resp = await authedFetch({
        url: appendTokenToUrl(`${apiUrl}/api/general-induction-register/${registroId}/get-image/${encodeURIComponent(imageName)}?t=${Date.now()}`),
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
      console.error('Error loading general induction image from server:', e);
      return null;
    }
  }, [refreshAccessToken, logout, accessToken]);

  const preloadServerImagesForList = useCallback(async (recordsInput: GeneralInductionRegisterRecord[]) => {
    try {
      const isConnected = await getConnectionStatus();
      if (!isConnected) return recordsInput;

      const nextRecords: GeneralInductionRegisterRecord[] = [];
      for (const rec of recordsInput) {
        const recId = typeof rec.id === 'number' ? rec.id : parseInt(String(rec.id || ''), 10);
        const imgs = Array.isArray((rec as any).images) ? (rec as any).images : [];
        if (!recId || imgs.length === 0) {
          nextRecords.push(rec);
          continue;
        }

        const nextImgs: any[] = [];
        for (const img of imgs) {
          if (img?.base64) {
            nextImgs.push(img);
            continue;
          }
          if (!img?.name) {
            nextImgs.push(img);
            continue;
          }
          const dataUrl = await loadImageFromServer(recId, String(img.name));
          if (dataUrl) nextImgs.push({ ...img, base64: dataUrl, extension: img.extension || 'jpg' });
          else nextImgs.push(img);
        }
        nextRecords.push({ ...rec, images: nextImgs });
      }
      return nextRecords;
    } catch (e) {
      console.error('Error preloading general induction images for list:', e);
      return recordsInput;
    }
  }, [loadImageFromServer]);

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
          setStructure([]);
        }
      } else {
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
    } catch (e) {
      console.error('Error fetching main structure for general induction register:', e);
    } finally {
      setIsStructureLoading(false);
    }
  }, [refreshAccessToken, logout]);

  const loadMarcaContext = useCallback(async () => {
    const currentMarcaStr = await AsyncStorage.getItem('current_marca');
    if (!currentMarcaStr) {
      setHasCurrentMarca(false);
      setMarcaEmpresaId(null);
      setMarcaClienteId(null);
      setMarcaCorpoId(null);
      return null;
    }
    try {
      const current = JSON.parse(currentMarcaStr);
      if (!current) {
        setHasCurrentMarca(false);
        return null;
      }
      setHasCurrentMarca(true);
      const empresaIdRaw = current?.empresa?.id ?? current?.empresa_id;
      const clienteIdRaw = current?.cliente?.id ?? current?.cliente_id;
      const corpoIdRaw = current?.corpo?.id ?? current?.corpo_id;
      setMarcaEmpresaId(empresaIdRaw !== undefined && empresaIdRaw !== null ? Number(empresaIdRaw) : null);
      setMarcaClienteId(clienteIdRaw !== undefined && clienteIdRaw !== null ? Number(clienteIdRaw) : null);
      setMarcaCorpoId(corpoIdRaw !== undefined && corpoIdRaw !== null ? Number(corpoIdRaw) : null);
      const divIdRaw = current?.roleDivision?.division?.id;
      setMarcaDivisionId(divIdRaw !== undefined && divIdRaw !== null ? Number(divIdRaw) : null);
      return current;
    } catch {
      setHasCurrentMarca(false);
      setMarcaEmpresaId(null);
      setMarcaClienteId(null);
      setMarcaCorpoId(null);
      return null;
    }
  }, []);

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
      if (prop === 'temas_a_tratar') {
        // Determinar qué temas data usar basado en la división del registro
        // Por ahora, usar AYL como default, pero esto podría mejorarse
        return formatTemasATratarForDisplay(JSON.stringify(value), TEMAS_DATA_AYL);
      }
      if (prop === 'colaboradores') {
        return formatPersonasForDisplay(JSON.stringify(value), 'colaboradores');
      }
      if (prop === 'capacitadores') {
        return formatPersonasForDisplay(JSON.stringify(value), 'capacitadores');
      }
      return JSON.stringify(value, null, 2);
    }
    if (typeof value === 'string') {
      if (value.trim().startsWith('{') || value.trim().startsWith('[')) {
        try {
          const parsed = JSON.parse(value);
          if (prop === 'temas_a_tratar') {
            return formatTemasATratarForDisplay(value, TEMAS_DATA_AYL);
          }
          if (prop === 'colaboradores') {
            return formatPersonasForDisplay(value, 'colaboradores');
          }
          if (prop === 'capacitadores') {
            return formatPersonasForDisplay(value, 'capacitadores');
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

  const fetchRecords = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      setOfflineMessage(null);

      const current = await loadMarcaContext();
      if (!current && !filterCorpoId) {
        setHasCurrentMarca(false);
        setIsLoading(false);
        return;
      }

      // Usar filtros jerárquicos si están disponibles, sino usar current_marca
      const empresaId = filterEmpresaId ?? marcaEmpresaId ?? Number(current?.empresa?.id ?? current?.empresa_id ?? 0);
      const clienteId = filterClienteId ?? marcaClienteId ?? Number(current?.cliente?.id ?? current?.cliente_id ?? 0);
      const corpoId = filterCorpoId ?? marcaCorpoId ?? Number(current?.corpo?.id ?? current?.corpo_id ?? 0);

      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
      const cache = cacheStr ? JSON.parse(cacheStr) : [];
      const local = (cache || []).filter((i: any) => i.type === 'general_induction_register');

      const isConnected = await getConnectionStatus();
      if (!corpoId) {
        setRecords(await preloadServerImagesForList(local));
        return;
      }

      if (isConnected) {
        const result = await listGeneralInductionRegisters({
          empresa_id: empresaId || undefined,
          cliente_id: clienteId || undefined,
          corpo_id: corpoId || undefined,
          refreshAccessToken,
          logout,
        });

        const serverRecords = (result.status && Array.isArray(result.data) ? (result.data as any[]) : []).map((r) => ({
          ...r,
          synced: true,
        }));
        const merged = [...local, ...serverRecords];
        setRecords(await preloadServerImagesForList(merged));
      } else {
        setRecords(await preloadServerImagesForList(local));
      }
    } catch (e) {
      console.error('Error fetching general induction register records:', e);
      if (isProbablyNetworkError(e)) {
        setOfflineMessage('Modo Offline: error de conexión. Mostrando datos guardados si existen.');
      } else {
        setError('Error al cargar los registros de inducción general');
      }
      try {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        const cache = cacheStr ? JSON.parse(cacheStr) : [];
        const local = (cache || []).filter((i: any) => i.type === 'general_induction_register');
        setRecords(await preloadServerImagesForList(local));
      } catch {
        // ignore
      }
    } finally {
      setIsLoading(false);
    }
  }, [refreshAccessToken, logout, filterEmpresaId, filterClienteId, filterCorpoId, marcaEmpresaId, marcaClienteId, marcaCorpoId, loadMarcaContext, preloadServerImagesForList]);

  // Cargar main_structure solo una vez al abrir la pantalla
  useFocusEffect(
    useCallback(() => {
      fetchMainStructure();
    }, [fetchMainStructure])
  );

  useFocusEffect(
    useCallback(() => {
      fetchRecords();
      eventBus.on('connectionRestored', fetchRecords);
      return () => {
        eventBus.off('connectionRestored', fetchRecords);
      };
    }, [fetchRecords])
  );

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
    // Si hay filtro de cliente, buscar todas las sucursales de todos los contratos del cliente
    if (filterClienteId) {
      const cliente = filterClientes.find((c: any) => c.id === filterClienteId);
      if (!cliente) return [];
      const divisiones = cliente?.division || [];
      const sucursales: any[] = [];
      divisiones.forEach((division: any) => {
        division.contratos?.forEach((contrato: any) => {
          contrato.sucursales?.forEach((sucursal: any) => {
            if (!sucursales.find(s => s.id === sucursal.id)) {
              sucursales.push(sucursal);
            }
          });
        });
      });
      return sucursales;
    }
    return [];
  }, [filterContratos, filterClienteId, filterClientes]);

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

  // Opciones memoizadas (patrón de OpeningClosingPositionScreen)
  const empresaOptions = useMemo(() => structure.map((e) => ({ id: e.id, nombre: e.nombre })), [structure]);
  const clienteOptions = useMemo(
    () => (selectedEmpresaNode?.clientes || []).map((c) => ({ id: c.id, nombre: c.nombre })),
    [selectedEmpresaNode]
  );
  const contratoOptions = useMemo(
    () => (selectedDivisionNode?.contratos || []).map((c) => ({ id: c.id, nombre: c.nombre })),
    [selectedDivisionNode]
  );
  const sucursalOptions = useMemo(
    () => (selectedContratoNode?.sucursales || []).map((s) => ({ id: s.id, nombre: s.nombre })),
    [selectedContratoNode]
  );

  const puestosForSelectedSucursal = useMemo(() => {
    return (selectedSucursalNode?.puestos || []) as MainStructurePuestoNode[];
  }, [selectedSucursalNode]);
  const plazasForSelectedSucursal = useMemo(
    () => puestosForSelectedSucursal.flatMap((p) => (Array.isArray(p.plazas) ? p.plazas : [])),
    [puestosForSelectedSucursal]
  );

  const temasData = useMemo(() => {
    if (selectedDivisionId === 5) return TEMAS_DATA_AYL;
    if (selectedDivisionId === 4) return TEMAS_DATA_SEG;
    return TEMAS_DATA_EMPTY;
  }, [selectedDivisionId]);
  const temasFlat = temasData.flat;
  const temasLeafTextById = temasData.leafTextById;
  const allTemasLeafSelected = useMemo<TemaSelectedItem[]>(
    () =>
      temasFlat
        .filter((t) => t.isLeaf)
        .map((t) => ({ id: t.id, text: t.text })),
    [temasFlat]
  );
  const temasVisible = useMemo(() => temasFlat.slice(0, temasVisibleCount), [temasFlat, temasVisibleCount]);
  const selectedTemaIdSet = useMemo(() => new Set(selectedTemas.map((t) => t.id)), [selectedTemas]);

  useEffect(() => {
    // Reiniciar cantidad visible cuando cambie la división (formulario dinámico)
    setTemasVisibleCount(60);
    if (!editingRecord) setSelectedTemas(allTemasLeafSelected);
  }, [selectedDivisionId, editingRecord, allTemasLeafSelected]);

  const handleEmpresaChange = (empresaId: number | null) => {
    setSelectedEmpresaId(empresaId);
    setSelectedClienteId(null);
    setSelectedDivisionId(null);
    setSelectedContratoId(null);
    setSelectedSucursalId(null);
    setDivisionOptions([]);
    setSelectedTemas([]);
  };

  const handleClienteChange = (clienteId: number | null) => {
    setSelectedClienteId(clienteId);
    // limpiar división inmediatamente para evitar estado inconsistente con el cliente anterior
    setSelectedDivisionId(null);
    setSelectedContratoId(null);
    setSelectedSucursalId(null);
    setDivisionOptions([]);
    setSelectedTemas([]);
  };

  // 1) Al seleccionar cliente, primero "cargar" divisiones en opciones (sin recursividad)
  useEffect(() => {
    if (editingRecord) return;
    if (isStructureLoading) return;
    setIsDivisionOptionsLoading(true);
    try {
      const opts = (selectedClienteNode?.division || []).map((d) => ({ id: Number(d.id), nombre: String(d.nombre || '') }));
      setDivisionOptions(opts);
    } finally {
      setIsDivisionOptionsLoading(false);
    }
  }, [selectedClienteNode, editingRecord, isStructureLoading]);

  // 2) La división ya no se auto-selecciona; el usuario debe elegirla manualmente

  // Cascada: si cambia división/contrato, limpiar selecciones inferiores (patrón de OpeningClosingPositionScreen)
  useEffect(() => {
    if (!selectedDivisionNode) {
      setSelectedContratoId(null);
      setSelectedSucursalId(null);
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
      return;
    }
    if (selectedSucursalId !== null) {
      const exists = (selectedContratoNode.sucursales || []).some((s) => s.id === selectedSucursalId);
      if (!exists) setSelectedSucursalId(null);
    }
  }, [selectedContratoNode]);

  const toggleTemaLeaf = useCallback(
    (id: string) => {
      const text = temasLeafTextById[id];
      if (!text) return; // solo hojas tienen checkbox
      setSelectedTemas((prev) => {
        const exists = prev.some((t) => t.id === id);
        if (exists) return prev.filter((t) => t.id !== id);
        return [...prev, { id, text }];
      });
    },
    [temasLeafTextById]
  );

  const openSignatureFor = (list: 'colab' | 'cap', id_local: string) => {
    setSignatureTarget({ list, id_local });
    setSignatureModalVisible(true);
  };

  const toggleExpandedPersona = (list: 'colab' | 'cap', id_local: string) => {
    const setter = list === 'colab' ? setExpandedColaboradores : setExpandedCapacitadores;
    setter((prev) => (prev.includes(id_local) ? prev.filter((x) => x !== id_local) : [...prev, id_local]));
  };

  const isPersonaExpanded = (list: 'colab' | 'cap', id_local: string) => {
    return (list === 'colab' ? expandedColaboradores : expandedCapacitadores).includes(id_local);
  };

  const onSignatureOK = (sig: string) => {
    if (!signatureTarget) return;
    const value = sig ? formatSignatureForDisplay(sig) : null;
    if (signatureTarget.list === 'colab') {
      setColaboradoresList((prev) => prev.map((p) => (p.id_local === signatureTarget.id_local ? { ...p, firma: value } : p)));
    } else {
      setCapacitadoresList((prev) => prev.map((p) => (p.id_local === signatureTarget.id_local ? { ...p, firma: value } : p)));
    }
    setSignatureModalVisible(false);
    setSignatureTarget(null);
  };

  const onSignatureEmpty = () => {
    Alert.alert('Error', 'La firma está vacía');
  };

  const decodeFirmaHash = (hash: string) => {
    try {
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
      const timestamp = await getHoraAccion();
      if (!timestamp) {
        Alert.alert('Error', 'No se pudo obtener la hora');
        return null;
      }
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
      Alert.alert('Error', 'No se pudo escanear el código QR');
    }
  };

  const findEmployeeInMain = useCallback((empleadoId: number) => {
    // Prioridad: sucursal seleccionada en formulario
    for (const puesto of puestosForSelectedSucursal) {
      for (const plaza of (puesto.plazas || [])) {
        const empleados = Array.isArray((plaza as any).empleados) ? (plaza as any).empleados : [];
        if (empleados.some((emp: any) => Number(emp?.id) === Number(empleadoId))) {
          return { puesto_id: puesto.id, puesto_text: puesto.nombre };
        }
      }
    }

    // Fallback: búsqueda global en main_structure
    for (const empresa of structure || []) {
      for (const cliente of (empresa.clientes || [])) {
        for (const division of (cliente.division || [])) {
          for (const contrato of (division.contratos || [])) {
            for (const sucursal of (contrato.sucursales || [])) {
              for (const puesto of (sucursal.puestos || [])) {
                for (const plaza of (puesto.plazas || [])) {
                  const empleados = Array.isArray((plaza as any).empleados) ? (plaza as any).empleados : [];
                  if (empleados.some((emp: any) => Number(emp?.id) === Number(empleadoId))) {
                    return { puesto_id: puesto.id, puesto_text: puesto.nombre };
                  }
                }
              }
            }
          }
        }
      }
    }

    return null;
  }, [puestosForSelectedSucursal, structure]);

  const applyEmployeeToColaborador = useCallback(
    (id_local: string, empleado: any) => {
      const id = Number(empleado?.id || 0);
      const nombre = [
        String(empleado?.nombre || '').trim(),
        String(empleado?.primer_apellido || '').trim(),
        String(empleado?.segundo_apellido || '').trim(),
      ]
        .filter(Boolean)
        .join(' ')
        .trim() || String(empleado?.nombre_completo || '').trim();
      const cedula = String(empleado?.cedula || '').trim();

      const foundInMain = id ? findEmployeeInMain(id) : null;
      updatePersona('colab', id_local, {
        nombre,
        cedula,
        puesto_id: foundInMain?.puesto_id ?? null,
        puesto_text: foundInMain?.puesto_text ?? '',
      });
      if (!foundInMain) {
        Alert.alert('Aviso', 'Empleado encontrado, pero no se ubicó en main_structure para autocompletar el puesto.');
      }
    },
    [findEmployeeInMain]
  );

  const fetchEmpleadoByIdForColaborador = useCallback(
    async (id_local: string, empleadoId: number) => {
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) throw new Error('Server URL not configured');
      const response = await authedFetch({
        url: `${apiUrl}/api/empleados/${empleadoId}`,
        init: {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        },
        refreshAccessToken,
        logout,
      });
      if (!response) return;
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.message || 'No se pudo obtener el empleado por ID');
      }
      const empleadoData = await response.json();
      applyEmployeeToColaborador(id_local, empleadoData);
    },
    [refreshAccessToken, logout, applyEmployeeToColaborador]
  );

  const fetchEmpleadoByCodigoForColaborador = useCallback(
    async (id_local: string, codigo: string) => {
      const code = String(codigo || '').trim();
      if (!code) {
        Alert.alert('Error', 'Debes ingresar un código');
        return;
      }
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) throw new Error('Server URL not configured');
      const response = await authedFetch({
        url: `${apiUrl}/api/empleados/codigo/${encodeURIComponent(code)}`,
        init: {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        },
        refreshAccessToken,
        logout,
      });
      if (!response) return;
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.message || 'No se pudo obtener el empleado por código');
      }
      const data = await response.json();
      if (!data?.status || !data?.data) {
        throw new Error(data?.message || 'No se encontró el empleado');
      }
      applyEmployeeToColaborador(id_local, data.data);
    },
    [refreshAccessToken, logout, applyEmployeeToColaborador]
  );

  const handleScanColaboradorQR = useCallback(async (id_local: string) => {
    try {
      const isConnected = await getConnectionStatus();
      if (!isConnected) {
        Alert.alert('Sin conexión', 'Esta función requiere internet');
        return;
      }
      const qrData = await scanQR();
      if (!qrData) return;
      const decoded = decodeFirmaHash(qrData);
      if (!decoded?.empleadoId) {
        Alert.alert('Error', 'El QR no contiene un ID de empleado válido');
        return;
      }
      await fetchEmpleadoByIdForColaborador(id_local, Number(decoded.empleadoId));
    } catch (e: any) {
      console.error('Error scanning collaborator QR:', e);
      Alert.alert('Error', e?.message || 'No se pudo leer el QR del colaborador');
    }
  }, [scanQR, fetchEmpleadoByIdForColaborador]);

  const resetForm = async ( horaAccion: number ) => {
    setFecha(new Date(horaAccion));
    setSelectedTemas(allTemasLeafSelected);
    setColaboradoresList([]);
    setCapacitadoresList([]);
    setColaboradorCodigoInput({});
    setImages([]);
    setPhotosDirty(false);
    setFirmaResponsableHash('');
    setEditingRecord(null);
  };

  const startCreate = async () => {
    const horaAccion = await getHoraAccion();
    if (!horaAccion) {
      Alert.alert('Error', 'No se pudo obtener la hora');
      return;
    }
    resetForm(horaAccion);
    setIsCreating(true);
  };

  const startEditing = async (record: GeneralInductionRegisterRecord) => {
    const horaAccion = await getHoraAccion();
    if (!horaAccion) {
      Alert.alert('Error', 'No se pudo obtener la hora');
      return;
    }
    try {
      setIsCreating(true);
      setEditingRecord({ id: record.id ? String(record.id) : null, id_local: record.id_local || '' });

      setFecha(record.fecha ? new Date(record.fecha) : new Date(horaAccion));

      // Parse temas meta for structure IDs
      const temasObj = safeJsonParse<any>(record.temas_a_tratar, null);
      const meta = temasObj?.meta;
      if (meta) {
        if (meta.empresa_id) setSelectedEmpresaId(Number(meta.empresa_id));
        if (meta.cliente_id) setSelectedClienteId(Number(meta.cliente_id));
        if (meta.division_id) setSelectedDivisionId(Number(meta.division_id));
        if (meta.contrato_id) setSelectedContratoId(Number(meta.contrato_id));
        if (meta.sucursal_id) setSelectedSucursalId(Number(meta.sucursal_id));
      }

      const selected = Array.isArray(temasObj?.selected) ? temasObj.selected : [];
      const leafs = Array.isArray(temasObj?.leafs) ? temasObj.leafs : null;
      if (leafs && leafs.length > 0) {
        const normalizedFromLeafs: TemaSelectedItem[] = leafs
          .filter((l: any) => !!l?.checked)
          .map((l: any) => ({ id: String(l?.id || '').trim(), text: String(l?.text || '').trim() }))
          .filter((s: any) => !!s.id && !!s.text);
        setSelectedTemas(normalizedFromLeafs);
      } else {
        const normalized: TemaSelectedItem[] = selected
          .map((s: any) => ({ id: String(s?.id || '').trim(), text: String(s?.text || '').trim() }))
          .filter((s: any) => !!s.id && !!s.text);
        setSelectedTemas(normalized);
      }

      setColaboradoresList(safeJsonParse<PersonaItem[]>(record.colaboradores, []).map((p: any) => ({
        id_local: p.id_local || generateRandomId(),
        nombre: String(p.nombre || ''),
        cedula: String(p.cedula || ''),
        puesto_text: String(p.puesto_text || ''),
        puesto_id: p.puesto_id !== undefined && p.puesto_id !== null ? Number(p.puesto_id) : null,
        firma: p.firma ? formatSignatureForDisplay(String(p.firma)) : null,
      })));
      setCapacitadoresList(safeJsonParse<PersonaItem[]>(record.capacitadores, []).map((p: any) => ({
        id_local: p.id_local || generateRandomId(),
        nombre: String(p.nombre || ''),
        cedula: String(p.cedula || ''),
        puesto_text: String(p.puesto_text || ''),
        puesto_id: p.puesto_id !== undefined && p.puesto_id !== null ? Number(p.puesto_id) : null,
        firma: p.firma ? formatSignatureForDisplay(String(p.firma)) : null,
      })));

      setImages(Array.isArray((record as any).images) ? (record as any).images : []);
      setPhotosDirty(false);
      setFirmaResponsableHash(record.firma_responsable || '');
    } catch (e) {
      console.error('Error startEditing general induction register:', e);
      Alert.alert('Error', 'No se pudo cargar el registro para edición');
    }
  };

  const buildTemasPayload = () => {
    const meta = {
      empresa_id: selectedEmpresaId,
      cliente_id: selectedClienteId,
      division_id: selectedDivisionId,
      division_nombre: selectedDivisionNode?.nombre || null,
      contrato_id: selectedContratoId,
      contrato_nombre: selectedContratoNode?.nombre || null,
      sucursal_id: selectedSucursalId,
      sucursal_nombre: selectedSucursalNode?.nombre || null,
    };

    // Persistimos como array de objetos (string JSON)
    // Por seguridad, dejamos únicamente hojas conocidas para la división actual.
    const selectedSafe = selectedTemas.filter((t) => !!temasLeafTextById[t.id]);
    // Guardar TODO el resultado (marcado/desmarcado) para poder mostrar el formulario completo en la lista
    const leafs = temasFlat
      .filter((t) => t.isLeaf)
      .map((t) => ({
        id: t.id,
        text: t.text,
        checked: selectedTemaIdSet.has(t.id),
      }));
    return { meta, selected: selectedSafe, leafs };
  };

  const openCamera = async () => {
    try {
      if (editingRecord?.id && !(await getConnectionStatus())) {
        Alert.alert('Sin conexión', 'Necesitas conexión para agregar fotos en un registro ya sincronizado.');
        return;
      }
      if (!cameraPermission?.granted) {
        const result = await requestCameraPermission();
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

  const buildImagenesJson = () =>
    JSON.stringify(
      images.map((img, idx) => ({
        file_base64: img.base64 || '',
        extension: img.extension || 'jpg',
        original_name: img.name || `general-induction-${Date.now()}-${idx + 1}.jpg`,
      }))
    );

  const saveHandler = async () => {
    setIsSubmitting(true);
    setSubmitResponse(null);

    try {
      if (!selectedEmpresaId || !selectedClienteId || !selectedSucursalId) {
        Alert.alert('Error', 'Empresa, Cliente y Sucursal son obligatorios');
        setIsSubmitting(false);
        return;
      }
      if (!selectedDivisionId || !selectedDivisionNode) {
        Alert.alert('Error', 'No se pudo determinar la división (marca actual)');
        setIsSubmitting(false);
        return;
      }
      if (!firmaResponsableHash.trim()) {
        Alert.alert('Error', 'Firma responsable (QR/Generar) es obligatoria');
        setIsSubmitting(false);
        return;
      }

      const temasPayload = buildTemasPayload();
      if (!Array.isArray(temasPayload.selected) || temasPayload.selected.length === 0) {
        Alert.alert('Error', 'Debe seleccionar al menos 1 tema (checkbox)');
        setIsSubmitting(false);
        return;
      }

      const requestData = {
        empresa_id: selectedEmpresaId,
        cliente_id: selectedClienteId,
        corpo_id: selectedSucursalId,
        division: selectedDivisionNode.nombre,
        fecha: fecha.toISOString(),
        temas_a_tratar: JSON.stringify(temasPayload),
        colaboradores: JSON.stringify(
          colaboradoresList.map((c) => ({
            id_local: c.id_local,
            nombre: c.nombre,
            cedula: c.cedula,
            puesto_text: c.puesto_text,
            puesto_id: c.puesto_id,
            firma: getBase64Only(c.firma),
          }))
        ),
        // Capacitadores: sin puesto (solo nombre/cedula/firma)
        capacitadores: JSON.stringify(
          capacitadoresList.map((c) => ({
            id_local: c.id_local,
            nombre: c.nombre,
            cedula: c.cedula,
            firma: getBase64Only(c.firma),
          }))
        ),
        firma_responsable: firmaResponsableHash.trim(),
        imagenes: buildImagenesJson(),
      };

      const isConnected = await getConnectionStatus();

      const horaAccion = await getHoraAccion();
      if (!horaAccion) {
        Alert.alert('Error', 'No se pudo obtener la hora');
        setIsSubmitting(false);
        return;
      }

      // create
      if (!editingRecord || (!editingRecord.id && !editingRecord.id_local)) {
        if (isConnected) {
          const result = await createGeneralInductionRegister({
            requestData,
            refreshAccessToken,
            logout,
          });
          if (!result.status) throw new Error(result.message || 'No se pudo crear el registro');
          Alert.alert('Éxito', result.message || 'Registro creado correctamente');
          setTimeout(() => {
            setIsCreating(false);
            resetForm(horaAccion);
            fetchRecords();
          }, 2000);
        } else {
          const id_local = generateRandomId();
          const newCacheRecord: GeneralInductionRegisterRecord = {
            id: id_local,
            id_local,
            empresa_id: selectedEmpresaId,
            cliente_id: selectedClienteId,
            corpo_id: selectedSucursalId,
            division: selectedDivisionNode.nombre,
            fecha: requestData.fecha,
            temas_a_tratar: requestData.temas_a_tratar,
            colaboradores: requestData.colaboradores,
            capacitadores: requestData.capacitadores,
            firma_responsable: requestData.firma_responsable,
            created_at: new Date(horaAccion).toISOString(),
            created_by: String(employee?.id || ''),
            synced: false,
          };

          const actionsStr = await AsyncStorage.getItem('evaluations_actions');
          const actions = actionsStr ? JSON.parse(actionsStr) : [];
          actions.push({
            id: id_local,
            action: 'create',
            type: 'general_induction_register',
            payload: requestData,
            synced: false,
          });
          await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

          const cacheStr = await AsyncStorage.getItem('evaluations_cache');
          const cache = cacheStr ? JSON.parse(cacheStr) : [];
          cache.push({ ...newCacheRecord, type: 'general_induction_register' });
          await AsyncStorage.setItem('evaluations_cache', JSON.stringify(cache));

          Alert.alert('Éxito', 'Se guardó localmente y se sincronizará al recuperar conexión');
          setTimeout(() => {
            setIsCreating(false);
            resetForm(horaAccion);
            fetchRecords();
          }, 2000);
        }
        return;
      }

      // update
      const recordId = editingRecord.id || editingRecord.id_local;
      if (!recordId) return;

      if (isConnected) {
        try {
          const result = await updateGeneralInductionRegister({
            id: String(recordId),
            requestData: {
              division: requestData.division,
              fecha: requestData.fecha,
              temas_a_tratar: requestData.temas_a_tratar,
              colaboradores: requestData.colaboradores,
              capacitadores: requestData.capacitadores,
              firma_responsable: requestData.firma_responsable,
              ...(photosDirty ? { imagenes: requestData.imagenes } : {}),
            },
            refreshAccessToken,
            logout,
          });
          if (!result.status) throw new Error(result.message || 'No se pudo actualizar el registro');
          Alert.alert('Éxito', result.message || 'Registro actualizado correctamente');
          const horaAccion = await getHoraAccion();
          if (!horaAccion) {
            Alert.alert('Error', 'No se pudo obtener la hora');
            return;
          }
          setTimeout(() => {
            setIsCreating(false);
            resetForm(horaAccion);
            fetchRecords();
          }, 2000);
          return;
        } catch (e: any) {
          const msg = String(e?.message || e || '');
          console.warn('Error updating general induction register:', e);
          // fallback offline en caso de 5xx (ej: 503) o fallas de red
          if (!msg.includes('status: 5') && !msg.includes('Network') && !msg.includes('fetch')) {
            throw e;
          }
        }
      }
      // offline fallback (incluye caso server 503)
      {
        const actionsStr = await AsyncStorage.getItem('evaluations_actions');
        const actions = actionsStr ? JSON.parse(actionsStr) : [];
        const isLocal = String(editingRecord.id_local || '').startsWith('local-') && String(recordId).startsWith('local-');
        if (isLocal) {
          const idx = actions.findIndex(
            (a: any) => a.id === editingRecord.id_local && a.action === 'create' && a.type === 'general_induction_register'
          );
          if (idx !== -1) {
            actions[idx] = { ...actions[idx], payload: { ...(actions[idx].payload || {}), ...requestData }, synced: false };
          } else {
            actions.push({ id: recordId, action: 'update', type: 'general_induction_register', payload: requestData, synced: false });
          }
        } else {
          const filtered = actions.filter(
            (a: any) => !(a.id === recordId && a.action === 'update' && a.type === 'general_induction_register')
          );
          filtered.push({ id: recordId, action: 'update', type: 'general_induction_register', payload: requestData, synced: false });
          await AsyncStorage.setItem('evaluations_actions', JSON.stringify(filtered));
        }
        if (!isLocal) await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        const cache = cacheStr ? JSON.parse(cacheStr) : [];
        const updatedCache = (cache || []).map((item: any) => {
          if ((item.id === recordId || item.id_local === recordId) && item.type === 'general_induction_register') {
            return { ...item, ...requestData, id: item.id, id_local: item.id_local, synced: false };
          }
          return item;
        });
        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));

        Alert.alert('Éxito', 'El servidor no está disponible. Se guardó localmente y se sincronizará al recuperar conexión');
        const horaAccion = await getHoraAccion();
        if (!horaAccion) {
          Alert.alert('Error', 'No se pudo obtener la hora');
          return;
        }
        setTimeout(() => {
          setIsCreating(false);
          resetForm(horaAccion);
          fetchRecords();
        }, 2000);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo guardar el registro');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteHandler = async (record: GeneralInductionRegisterRecord) => {
    const recordId = record.id || record.id_local;
    if (!recordId) return;

    Alert.alert('Confirmar', '¿Deseas eliminar este registro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            const isConnected = await getConnectionStatus();
            const isLocal = String(record.id_local || '').startsWith('local-') && String(recordId).startsWith('local-');
            if (isConnected && !isLocal) {
              const result = await deleteGeneralInductionRegister({ id: String(recordId), refreshAccessToken, logout });
              if (!result.status) throw new Error(result.message || 'No se pudo eliminar el registro');
              Alert.alert('Éxito', 'Registro eliminado');
              fetchRecords();
              return;
            }

            // offline: remove cache and queue delete (or drop create)
            const actionsStr = await AsyncStorage.getItem('evaluations_actions');
            const actions = actionsStr ? JSON.parse(actionsStr) : [];
            let updatedActions = actions;
            if (isLocal) {
              updatedActions = actions.filter(
                (a: any) => !(a.id === record.id_local && a.action === 'create' && a.type === 'general_induction_register')
              );
            } else {
              updatedActions = actions.filter(
                (a: any) => !(a.id === recordId && a.action === 'delete' && a.type === 'general_induction_register')
              );
              updatedActions.push({ id: recordId, action: 'delete', type: 'general_induction_register', synced: false });
            }
            await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));

            const cacheStr = await AsyncStorage.getItem('evaluations_cache');
            const cache = cacheStr ? JSON.parse(cacheStr) : [];
            const updatedCache = (cache || []).filter(
              (i: any) => !((i.id === recordId || i.id_local === recordId) && i.type === 'general_induction_register')
            );
            await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));

            Alert.alert('Eliminado', isLocal ? 'Se eliminó el registro local' : 'Se eliminará al sincronizar');
            fetchRecords();
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'No se pudo eliminar');
          }
        },
      },
    ]);
  };

  const canShowMoreTemas = temasFlat.length > temasVisibleCount;

  const parseMetaFromTemas = (temasStr?: string | null) => {
    const temasObj = safeJsonParse<any>(temasStr, null);
    return temasObj?.meta || null;
  };

  // UI: collapsables tipo OpeningClosingPositionScreen
  const [expandedTemasById, setExpandedTemasById] = useState<Record<string, boolean>>({});
  const [expandedColaboradoresById, setExpandedColaboradoresById] = useState<Record<string, boolean>>({});
  const [expandedCapacitadoresById, setExpandedCapacitadoresById] = useState<Record<string, boolean>>({});
  const [expandedFirmaById, setExpandedFirmaById] = useState<Record<string, boolean>>({});
  const [expandedImagesById, setExpandedImagesById] = useState<Record<string, boolean>>({});

  const renderList = () => {
    if (isLoading) {
      return (
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Cargando registros...</ThemedText>
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
          <ThemedText style={styles.emptyText}>No hay registros de inducción general.</ThemedText>
        </ThemedView>
      );
    }

    return (
      <ThemedView style={styles.listContainer}>
        {records.map((r) => {
          const itemKey = String(r.id || r.id_local || '');
          const meta = parseMetaFromTemas(r.temas_a_tratar);
          const contratoNombre = meta?.contrato_nombre || 'N/A';
          const sucursalNombre = meta?.sucursal_nombre || 'N/A';
          const fechaTxt = r.fecha ? convertDateTimestampToLocalString(r.fecha, false) : 'N/A';

          const temasObj = safeJsonParse<any>(r.temas_a_tratar, null);
          const temasSelected = Array.isArray(temasObj?.selected) ? temasObj.selected : [];
          const temasLeafs = Array.isArray(temasObj?.leafs) ? temasObj.leafs : null;

          const colaboradores = safeJsonParse<any[]>(r.colaboradores, []);
          const capacitadores = safeJsonParse<any[]>(r.capacitadores, []);
          const images = Array.isArray((r as any).images) ? (r as any).images : [];

          const isTemasOpen = !!expandedTemasById[itemKey];
          const isColabsOpen = !!expandedColaboradoresById[itemKey];
          const isCapsOpen = !!expandedCapacitadoresById[itemKey];
          const isFirmaOpen = !!expandedFirmaById[itemKey];
          const isImagesOpen = !!expandedImagesById[itemKey];

          return (
            <ThemedView key={r.id || r.id_local} style={styles.listItem}>
              <ThemedView style={styles.listItemHeader}>
                <ThemedView style={styles.listItemContent}>
                  <ThemedText style={styles.listItemTitle}>{sucursalNombre}</ThemedText>
                  <ThemedText style={styles.listItemSubtitle}>Contrato: {contratoNombre}</ThemedText>
                  <ThemedText style={styles.listItemSubtitle}>División: {r.division || meta?.division_nombre || 'N/A'}</ThemedText>
                  <ThemedText style={styles.listItemSubtitle}>Fecha: {fechaTxt}</ThemedText>
                  {!r.synced && <ThemedText style={styles.unsyncedBadge}>Pendiente de sincronizar</ThemedText>}
                </ThemedView>
              </ThemedView>

              <ThemedView style={styles.listItemDetails}>
                <TouchableOpacity
                  style={styles.collapseButton}
                  onPress={() => setExpandedTemasById((prev) => ({ ...prev, [itemKey]: !prev[itemKey] }))}
                  activeOpacity={0.8}
                >
                  <ThemedText style={styles.collapseButtonText}>
                    {temasLeafs && temasLeafs.length > 0
                      ? `Temas (completo) (${temasLeafs.filter((l: any) => !!l?.checked).length}/${temasLeafs.length})`
                      : `Temas seleccionados (${temasSelected.length})`}
                  </ThemedText>
                  <Ionicons name={isTemasOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#007AFF" />
                </TouchableOpacity>
                {isTemasOpen && (
                  <ThemedView style={styles.collapsableContent}>
                    {temasLeafs && temasLeafs.length > 0 ? (
                      temasLeafs.map((t: any) => {
                        const checked = !!t?.checked;
                        return (
                          <ThemedView key={String(t?.id)} style={styles.fullTemaRow}>
                            <Ionicons
                              name={checked ? 'checkmark-circle' : 'close-circle'}
                              size={18}
                              color={checked ? '#34C759' : '#FF3B30'}
                            />
                            <ThemedText style={styles.detailLine}>{String(t?.text || '').trim() || '—'}</ThemedText>
                          </ThemedView>
                        );
                      })
                    ) : temasSelected.length > 0 ? (
                      temasSelected.map((t: any) => (
                        <ThemedText key={String(t?.id)} style={styles.detailLine}>
                          - {String(t?.text || '').trim() || '—'}
                        </ThemedText>
                      ))
                    ) : (
                      <ThemedText style={styles.detailLine}>—</ThemedText>
                    )}
                  </ThemedView>
                )}

                <TouchableOpacity
                  style={styles.collapseButton}
                  onPress={() => setExpandedColaboradoresById((prev) => ({ ...prev, [itemKey]: !prev[itemKey] }))}
                  activeOpacity={0.8}
                >
                  <ThemedText style={styles.collapseButtonText}>Colaboradores ({colaboradores.length})</ThemedText>
                  <Ionicons name={isColabsOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#007AFF" />
                </TouchableOpacity>
                {isColabsOpen && (
                  <ThemedView style={styles.collapsableContent}>
                    {colaboradores.length === 0 ? (
                      <ThemedText style={styles.detailLine}>—</ThemedText>
                    ) : (
                      colaboradores.map((c: any, idx: number) => {
                        const sigUri = formatSignatureForDisplay(c?.firma || null);
                        return (
                          <ThemedView key={String(c?.id_local || idx)} style={styles.personDetailCard}>
                            <ThemedText style={styles.personDetailTitle}>{String(c?.nombre || '').trim() || '—'}</ThemedText>
                            <ThemedText style={styles.detailLine}>Cédula: {String(c?.cedula || '').trim() || '—'}</ThemedText>
                            <ThemedText style={styles.detailLine}>Puesto: {String(c?.puesto_text || '').trim() || '—'}</ThemedText>
                            {sigUri ? (
                              <Image source={{ uri: sigUri }} style={styles.signaturePreview} resizeMode="contain" />
                            ) : (
                              <ThemedText style={styles.detailLine}>Firma: No</ThemedText>
                            )}
                          </ThemedView>
                        );
                      })
                    )}
                  </ThemedView>
                )}

                <TouchableOpacity
                  style={styles.collapseButton}
                  onPress={() => setExpandedCapacitadoresById((prev) => ({ ...prev, [itemKey]: !prev[itemKey] }))}
                  activeOpacity={0.8}
                >
                  <ThemedText style={styles.collapseButtonText}>Capacitadores ({capacitadores.length})</ThemedText>
                  <Ionicons name={isCapsOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#007AFF" />
                </TouchableOpacity>
                {isCapsOpen && (
                  <ThemedView style={styles.collapsableContent}>
                    {capacitadores.length === 0 ? (
                      <ThemedText style={styles.detailLine}>—</ThemedText>
                    ) : (
                      capacitadores.map((c: any, idx: number) => {
                        const sigUri = formatSignatureForDisplay(c?.firma || null);
                        return (
                          <ThemedView key={String(c?.id_local || idx)} style={styles.personDetailCard}>
                            <ThemedText style={styles.personDetailTitle}>{String(c?.nombre || '').trim() || '—'}</ThemedText>
                            <ThemedText style={styles.detailLine}>Cédula: {String(c?.cedula || '').trim() || '—'}</ThemedText>
                            {sigUri ? (
                              <Image source={{ uri: sigUri }} style={styles.signaturePreview} resizeMode="contain" />
                            ) : (
                              <ThemedText style={styles.detailLine}>Firma: No</ThemedText>
                            )}
                          </ThemedView>
                        );
                      })
                    )}
                  </ThemedView>
                )}

                <TouchableOpacity
                  style={styles.collapseButton}
                  onPress={() => setExpandedImagesById((prev) => ({ ...prev, [itemKey]: !prev[itemKey] }))}
                  activeOpacity={0.8}
                >
                  <ThemedText style={styles.collapseButtonText}>Imágenes ({images.length})</ThemedText>
                  <Ionicons name={isImagesOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#007AFF" />
                </TouchableOpacity>
                {isImagesOpen && (
                  <ThemedView style={styles.collapsableContent}>
                    {images.length === 0 ? (
                      <ThemedText style={styles.detailLine}>—</ThemedText>
                    ) : (
                      <ThemedView style={styles.listImagesRow}>
                        {images.map((img: any, idx: number) => {
                          const base64Uri = String(img?.base64 || '').trim();
                          const uri = base64Uri || appendTokenToUrl(String(img?.url || '').trim());
                          if (!uri) return null;
                          return (
                            <TouchableOpacity
                              key={`img-${itemKey}-${String(img?.id || idx)}`}
                              activeOpacity={0.85}
                              onPress={() => {
                                setSelectedImageUrl(uri);
                                setIsImagePreviewVisible(true);
                              }}
                            >
                              <Image source={{ uri }} style={styles.listImageThumb} />
                            </TouchableOpacity>
                          );
                        })}
                      </ThemedView>
                    )}
                  </ThemedView>
                )}

                <TouchableOpacity
                  style={styles.collapseButton}
                  onPress={() => setExpandedFirmaById((prev) => ({ ...prev, [itemKey]: !prev[itemKey] }))}
                  activeOpacity={0.8}
                >
                  <ThemedText style={styles.collapseButtonText}>Firma responsable</ThemedText>
                  <Ionicons name={isFirmaOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#007AFF" />
                </TouchableOpacity>
                {isFirmaOpen && (
                  <ThemedView style={styles.collapsableContent}>
                    {!r.firma_responsable ? (
                      <ThemedText style={styles.detailLine}>—</ThemedText>
                    ) : (() => {
                      const info = decodeFirmaHash(r.firma_responsable);
                      if (!info) return <ThemedText style={styles.detailLine}>QR sin información decodificable.</ThemedText>;
                      return (
                        <>
                          <ThemedText style={styles.detailLine}>Sesión: {info.sessionId}</ThemedText>
                          <ThemedText style={styles.detailLine}>Empleado: {info.empleadoId}</ThemedText>
                          <ThemedText style={styles.detailLine}>Lat/Lng: {info.latitud}, {info.longitud}</ThemedText>
                          <ThemedText style={styles.detailLine}>Hora: { convertDateTimestampToLocalString(new Date(Number(info.timestamp)).toISOString()) || 'N/A'}</ThemedText>
                        </>
                      );
                    })()}
                  </ThemedView>
                )}

                <ThemedView style={styles.actionButtons}>
                  <TouchableOpacity style={[styles.listItemButton, styles.editButton]} onPress={() => startEditing(r)} activeOpacity={0.85}>
                    <Ionicons name="pencil" size={18} color="#FFFFFF" />
                    <ThemedText style={styles.buttonText}>Editar</ThemedText>
                  </TouchableOpacity>
                  {!(r.id_local || String(r.id).startsWith('local-') || r.id === 0) && (
                    <TouchableOpacity
                      style={[styles.listItemButton, styles.changesButton]}
                      onPress={() => {
                        setCambiosTitle(`Cambios - Registro #${r.id}`);
                        fetchCambios('c_registro_induccion_general', Number(r.id));
                      }}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="list-outline" size={18} color="#FFFFFF" />
                      <ThemedText style={styles.buttonText}>Cambios</ThemedText>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={[styles.listItemButton, styles.deleteButton]} onPress={() => deleteHandler(r)} activeOpacity={0.85}>
                    <Ionicons name="trash" size={18} color="#FFFFFF" />
                    <ThemedText style={styles.buttonText}>Eliminar</ThemedText>
                  </TouchableOpacity>
                </ThemedView>
              </ThemedView>
            </ThemedView>
          );
        })}
      </ThemedView>
    );
  };

  const addPersona = (list: 'colab' | 'cap') => {
    const item: PersonaItem = { id_local: generateRandomId(), nombre: '', cedula: '', puesto_text: '', puesto_id: null, firma: null };
    if (list === 'colab') setColaboradoresList((prev) => [...prev, item]);
    else setCapacitadoresList((prev) => [...prev, item]);
    // expandir el nuevo item para edición rápida
    setTimeout(() => toggleExpandedPersona(list, item.id_local), 0);
  };

  const updatePersona = (list: 'colab' | 'cap', id_local: string, patch: Partial<PersonaItem>) => {
    const setter = list === 'colab' ? setColaboradoresList : setCapacitadoresList;
    setter((prev) => prev.map((p) => (p.id_local === id_local ? { ...p, ...patch } : p)));
  };

  const removePersona = (list: 'colab' | 'cap', id_local: string) => {
    const setter = list === 'colab' ? setColaboradoresList : setCapacitadoresList;
    setter((prev) => prev.filter((p) => p.id_local !== id_local));
  };

  const renderPersonaSection = (title: string, listKey: 'colab' | 'cap', items: PersonaItem[]) => {
    return (
      <ThemedView style={styles.sectionContainer}>
        <ThemedView style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
        </ThemedView>
        <ThemedView style={styles.sectionBody}>
          {items.map((p, idx) => {
            const expanded = isPersonaExpanded(listKey, p.id_local);
            const displayName = (p.nombre || '').trim() || `${title.slice(0, -1)} ${idx + 1}`;
            return (
              <ThemedView key={p.id_local} style={styles.expandItem}>
                <TouchableOpacity
                  style={styles.expandHeader}
                  onPress={() => toggleExpandedPersona(listKey, p.id_local)}
                  activeOpacity={0.85}
                >
                  <ThemedView style={styles.expandHeaderContent}>
                    <ThemedText style={styles.expandHeaderText}>{displayName}</ThemedText>
                    {!!p.cedula && <ThemedText style={styles.expandHeaderSubText}>Cédula: {p.cedula}</ThemedText>}
                    {listKey === 'colab' && !!p.puesto_text && (
                      <ThemedText style={styles.expandHeaderSubText}>Puesto: {p.puesto_text}</ThemedText>
                    )}
                  </ThemedView>
                  <ThemedView style={styles.expandHeaderActions}>
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        removePersona(listKey, p.id_local);
                      }}
                      style={styles.removeExpandButton}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="trash" size={20} color="#FF3B30" />
                    </TouchableOpacity>
                    <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={22} color="#000000" />
                  </ThemedView>
                </TouchableOpacity>

                {expanded && (
                  <ThemedView style={styles.expandContent}>
                    {listKey === 'colab' && (
                      <ThemedView style={styles.formGroup}>
                        <ThemedText style={styles.formLabel}>Autocompletar colaborador (online)</ThemedText>
                        <ThemedView style={styles.firmaButtonsRow}>
                          <TouchableOpacity
                            style={styles.firmaBlueButton}
                            onPress={() => handleScanColaboradorQR(p.id_local)}
                            activeOpacity={0.85}
                          >
                            <Ionicons name="scan-outline" size={18} color="#FFFFFF" />
                            <ThemedText style={styles.firmaBlueButtonText}>Escanear QR</ThemedText>
                          </TouchableOpacity>
                        </ThemedView>
                        <ThemedView style={styles.codeRow}>
                          <TextInput
                            style={[styles.formInput, styles.codeInput]}
                            value={colaboradorCodigoInput[p.id_local] || ''}
                            onChangeText={(t) =>
                              setColaboradorCodigoInput((prev) => ({ ...prev, [p.id_local]: t }))
                            }
                            placeholder="Código del empleado"
                            placeholderTextColor="#999"
                          />
                          <TouchableOpacity
                            style={styles.codeSearchButton}
                            onPress={async () => {
                              try {
                                const isConnected = await getConnectionStatus();
                                if (!isConnected) {
                                  Alert.alert('Sin conexión', 'Esta función requiere internet');
                                  return;
                                }
                                await fetchEmpleadoByCodigoForColaborador(
                                  p.id_local,
                                  colaboradorCodigoInput[p.id_local] || ''
                                );
                              } catch (e: any) {
                                Alert.alert('Error', e?.message || 'No se pudo buscar por código');
                              }
                            }}
                            activeOpacity={0.85}
                          >
                            <Ionicons name="search" size={18} color="#FFFFFF" />
                            <ThemedText style={styles.buttonText}>Buscar</ThemedText>
                          </TouchableOpacity>
                        </ThemedView>
                      </ThemedView>
                    )}

                    <ThemedView style={styles.formGroup}>
                      <ThemedText style={styles.formLabel}>Nombre</ThemedText>
                      <TextInput
                        style={styles.formInput}
                        value={p.nombre}
                        onChangeText={(t) => updatePersona(listKey, p.id_local, { nombre: t })}
                        placeholder="Nombre"
                        placeholderTextColor="#999"
                      />
                    </ThemedView>

                    <ThemedView style={styles.formGroup}>
                      <ThemedText style={styles.formLabel}>Cédula</ThemedText>
                      <TextInput
                        style={styles.formInput}
                        value={p.cedula}
                        onChangeText={(t) => updatePersona(listKey, p.id_local, { cedula: t })}
                        placeholder="Cédula"
                        placeholderTextColor="#999"
                      />
                    </ThemedView>

                    {listKey === 'colab' && (
                      <>
                        <ThemedView style={styles.formGroup}>
                          <ThemedText style={styles.formLabel}>Puesto</ThemedText>
                          <TextInput
                            style={styles.formInput}
                            value={p.puesto_text}
                            onChangeText={(t) => updatePersona(listKey, p.id_local, { puesto_text: t })}
                            placeholder="Puesto"
                            placeholderTextColor="#999"
                          />
                        </ThemedView>

                        <ThemedView style={styles.formGroup}>
                          <ThemedText style={styles.formLabel}>Seleccionar puesto (sucursal)</ThemedText>
                          <ThemedView style={styles.pickerWrapper}>
                            <Picker
                              selectedValue={p.puesto_id ?? 0}
                              onValueChange={(v) => {
                                const id = Number(v) || null;
                                const found = puestosForSelectedSucursal.find((pp) => pp.id === id);
                                updatePersona(listKey, p.id_local, {
                                  puesto_id: id,
                                  puesto_text: found ? found.nombre : p.puesto_text,
                                });
                              }}
                              enabled={selectedSucursalId !== null && puestosForSelectedSucursal.length > 0}
                              style={styles.picker}
                            >
                              <Picker.Item
                                label={selectedSucursalId ? 'Seleccione puesto...' : 'Seleccione sucursal primero'}
                                value={0}
                              />
                              {puestosForSelectedSucursal.map((pp) => (
                                <Picker.Item key={pp.id} label={pp.nombre} value={pp.id} />
                              ))}
                            </Picker>
                          </ThemedView>
                        </ThemedView>
                      </>
                    )}

                    <ThemedText style={styles.formSectionTitle}>Firma</ThemedText>
                    {!p.firma ? (
                      <TouchableOpacity
                        style={styles.signatureButton}
                        onPress={() => openSignatureFor(listKey, p.id_local)}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="create-outline" size={22} color="#007AFF" />
                        <ThemedText style={styles.signatureButtonText}>Toca para dibujar la firma</ThemedText>
                      </TouchableOpacity>
                    ) : (
                      <>
                        <TouchableOpacity
                          style={styles.signatureSaved}
                          onPress={() => openSignatureFor(listKey, p.id_local)}
                          activeOpacity={0.85}
                        >
                          <Ionicons name="checkmark-circle" size={22} color="#34C759" />
                          <ThemedText style={styles.signatureSavedText}>Firma registrada (toca para reemplazar)</ThemedText>
                        </TouchableOpacity>
                        <Image
                          source={{ uri: p.firma }}
                          style={styles.signaturePreview}
                          resizeMode="contain"
                        />
                      </>
                    )}
                  </ThemedView>
                )}
              </ThemedView>
            );
          })}

          <TouchableOpacity style={styles.addButton} onPress={() => addPersona(listKey)} activeOpacity={0.85}>
            <Ionicons name="add-circle" size={24} color="#4CAF50" />
            <ThemedText style={styles.addButtonText}>Agregar {title.slice(0, -1)}</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </ThemedView>
    );
  };

  const renderPhotosSection = () => (
    <ThemedView style={styles.sectionContainer}>
      <ThemedView style={styles.sectionHeader}>
        <ThemedText style={styles.sectionTitle}>Fotos (opcional)</ThemedText>
      </ThemedView>
      <ThemedView style={styles.sectionBody}>
        <TouchableOpacity style={styles.captureImageButton} onPress={openCamera}>
          <Ionicons name="camera" size={20} color="#007AFF" />
          <ThemedText style={styles.captureImageButtonText}>
            {images.length > 0 ? 'Agregar otra foto' : 'Capturar foto'}
          </ThemedText>
        </TouchableOpacity>

        {images.length === 0 ? (
          <ThemedText style={styles.hintText}>Agrega una o varias fotos.</ThemedText>
        ) : (
          <ThemedView style={styles.thumbRow}>
            {images.map((img, idx) => {
              const uri = img.base64 || img.url || '';
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
    </ThemedView>
  );

  return (
    <ThemedView style={styles.container}>
      <AppHeader onMenuPress={handleMenuPress} title="Registro inducción general" />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <ThemedView style={styles.contentContainer}>
          <ThemedView style={styles.titleContainer}>
            <ThemedView style={styles.mainHeaderRow}>
              <Ionicons name="school-outline" size={22} color="#007AFF" />
              <ThemedText style={styles.title}>Registro inducción general</ThemedText>
            </ThemedView>
            <ThemedText style={styles.subtitle}>Control y firmas por puesto</ThemedText>
          </ThemedView>
          <ThemedView style={styles.titleDivider} />

          {!hasCurrentMarca && (
            <ThemedView style={styles.warningBox}>
              <ThemedText style={styles.warningText}>No se encontró una marca activa para este usuario.</ThemedText>
            </ThemedView>
          )}

          {!isCreating ? (
            <>
          {!isLoading && !isStructureLoading && Array.isArray(structure) && structure.length > 0 && (
            <ThemedView style={styles.filtersContainer}>
              <ThemedView style={styles.filtersHeader}>
                <TouchableOpacity
                  style={styles.filterToggleButton}
                  onPress={() => setIsHierarchyFiltersExpanded((prev) => !prev)}
                  activeOpacity={0.85}
                >
                  <ThemedText style={styles.filtersTitle}>Filtros jerárquicos</ThemedText>
                  <Ionicons
                    name={isHierarchyFiltersExpanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color="#007AFF"
                  />
                </TouchableOpacity>
                {isHierarchyFiltersExpanded && (
                  <TouchableOpacity
                    style={styles.resetFiltersButton}
                    onPress={() => {
                      setFilterEmpresaId(null);
                      setFilterClienteId(null);
                      setFilterCorpoId(null);
                    }}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="refresh" size={16} color="#FF3B30" />
                    <ThemedText style={styles.resetFiltersText}>Reiniciar</ThemedText>
                  </TouchableOpacity>
                )}
              </ThemedView>
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

                  <ThemedView style={styles.filterGroup}>
                    <ThemedText style={styles.filterLabel}>Cliente:</ThemedText>
                    <View style={styles.pickerWrapper}>
                      <Picker
                        selectedValue={filterClienteId || ''}
                        onValueChange={(value) => {
                          setFilterClienteId(value && value !== '' ? Number(value) : null);
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
                </ThemedView>
              )}
            </ThemedView>
          )}

          {!!offlineMessage && !error && (
            <ThemedView style={styles.offlineBanner}>
              <Ionicons name="cloud-offline-outline" size={18} color="#8A6D00" />
              <ThemedText style={styles.offlineBannerText}>{offlineMessage}</ThemedText>
            </ThemedView>
          )}

          {!isLoading && !error && (
            <TouchableOpacity style={styles.createButton} onPress={startCreate} activeOpacity={0.85}>
              <Ionicons name="add" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          )}
          {renderList()}
            </>
          ) : (
            <ThemedView style={styles.formContainer}>
              <ThemedText style={styles.formTitle}>
                {editingRecord ? 'Editar registro' : 'Nuevo registro'}
              </ThemedText>

              {/* Fecha */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Fecha</ThemedText>
                <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)} activeOpacity={0.85}>
                  <ThemedText style={styles.dateButtonText}>{convertDateTimestampToLocalString(fecha.toISOString(), false)}</ThemedText>
                  <Ionicons name="calendar" size={20} color="#007AFF" />
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={fecha}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, selected) => {
                      setShowDatePicker(false);
                      if (selected) setFecha(selected);
                    }}
                  />
                )}
              </ThemedView>

              {/* Estructura (como OpeningClosingPositionScreen) */}
              <ThemedView style={styles.sectionContainer}>
                <ThemedView style={styles.sectionHeader}>
                  <ThemedText style={styles.sectionTitle}>Estructura</ThemedText>
                </ThemedView>

                {(isStructureLoading || isDivisionOptionsLoading) ? (
                  <ThemedView style={styles.loadingInline}>
                    <ActivityIndicator size="small" color="#007AFF" />
                    <ThemedText style={styles.loadingInlineText}>
                      {isStructureLoading ? 'Cargando estructura...' : 'Cargando divisiones...'}
                    </ThemedText>
                  </ThemedView>
                ) : (
                  <ThemedView style={styles.sectionBody}>
                    <ThemedView style={styles.formGroup}>
                      <ThemedText style={styles.formLabel}>Empresa</ThemedText>
                      <ThemedView style={styles.pickerWrapper}>
                        <Picker
                          selectedValue={selectedEmpresaId ?? 0}
                          onValueChange={(v) => handleEmpresaChange(Number(v) || null)}
                          enabled={!isStructureLoading && empresaOptions.length > 0}
                          style={styles.picker}
                        >
                          <Picker.Item label="Seleccione empresa..." value={0} />
                          {empresaOptions.map((e) => (
                            <Picker.Item key={e.id} label={e.nombre} value={e.id} />
                          ))}
                        </Picker>
                      </ThemedView>
                    </ThemedView>

                    <ThemedView style={styles.formGroup}>
                      <ThemedText style={styles.formLabel}>Cliente</ThemedText>
                      <ThemedView style={styles.pickerWrapper}>
                        <Picker
                          selectedValue={selectedClienteId ?? 0}
                          onValueChange={(v) => handleClienteChange(Number(v) || null)}
                          enabled={selectedEmpresaId !== null && clienteOptions.length > 0}
                          style={styles.picker}
                        >
                          <Picker.Item
                            label={selectedEmpresaId ? 'Seleccione cliente...' : 'Seleccione empresa primero'}
                            value={0}
                          />
                          {clienteOptions.map((c) => (
                            <Picker.Item key={c.id} label={c.nombre} value={c.id} />
                          ))}
                        </Picker>
                      </ThemedView>
                      {selectedEmpresaId !== null && clienteOptions.length === 0 && (
                        <ThemedText style={styles.hintText}>No hay clientes disponibles para esta empresa.</ThemedText>
                      )}
                    </ThemedView>

                    <ThemedView style={styles.formGroup}>
                      <ThemedText style={styles.formLabel}>División</ThemedText>
                      <ThemedView style={styles.pickerWrapper}>
                        <Picker
                          selectedValue={selectedDivisionId ?? 0}
                          onValueChange={(v) => {
                            const next = Number(v) || null;
                            setSelectedDivisionId(next);
                            setSelectedContratoId(null);
                            setSelectedSucursalId(null);
                          }}
                          enabled={selectedClienteId !== null && divisionOptions.length > 0}
                          style={styles.picker}
                        >
                          <Picker.Item
                            label={selectedClienteId ? 'Seleccione división...' : 'Seleccione cliente primero'}
                            value={0}
                          />
                          {divisionOptions.map((d) => (
                            <Picker.Item key={d.id} label={d.nombre} value={d.id} />
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
                          }}
                          enabled={selectedDivisionId !== null && contratoOptions.length > 0}
                          style={styles.picker}
                        >
                          <Picker.Item
                            label={selectedDivisionId ? 'Seleccione contrato...' : 'Seleccione cliente primero'}
                            value={0}
                          />
                          {contratoOptions.map((c) => (
                            <Picker.Item key={c.id} label={c.nombre} value={c.id} />
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
                          }}
                          enabled={selectedContratoId !== null && sucursalOptions.length > 0}
                          style={styles.picker}
                        >
                          <Picker.Item
                            label={selectedContratoId ? 'Seleccione sucursal...' : 'Seleccione contrato primero'}
                            value={0}
                          />
                          {sucursalOptions.map((s) => (
                            <Picker.Item key={s.id} label={s.nombre} value={s.id} />
                          ))}
                        </Picker>
                      </ThemedView>
                      {selectedContratoId !== null && sucursalOptions.length === 0 && (
                        <ThemedText style={styles.hintText}>No hay sucursales disponibles para este contrato.</ThemedText>
                      )}
                    </ThemedView>
                  </ThemedView>
                )}
              </ThemedView>

              {/* Temas a tratar (como sección) */}
              <ThemedView style={styles.sectionContainer}>
                <ThemedView style={styles.sectionHeader}>
                  <ThemedText style={styles.sectionTitle}>Temas a tratar</ThemedText>
                </ThemedView>
                <ThemedView style={styles.sectionBody}>
                  <ThemedText style={styles.sectionSubtitle}>Seleccionados: {selectedTemas.length}</ThemedText>
                  {temasFlat.length === 0 ? (
                    <ThemedText style={styles.hintText}>No hay temas definidos para esta división.</ThemedText>
                  ) : (
                    <>
                      {temasVisible.map((item) => {
                        const checked = item.isLeaf ? selectedTemaIdSet.has(item.id) : false;
                        return (
                          <ThemedView key={item.key} style={[styles.temaItemRow, { paddingLeft: 8 + item.level * 14 }]}>
                            <ThemedView style={styles.temaItemLine}>
                              {item.isLeaf ? (
                                <TouchableOpacity style={styles.checkboxContainer} onPress={() => toggleTemaLeaf(item.id)} activeOpacity={0.8}>
                                  <ThemedView style={styles.checkbox}>
                                    {checked ? <Ionicons name="checkmark" size={16} color="#FF9500" /> : null}
                                  </ThemedView>
                                </TouchableOpacity>
                              ) : (
                                <ThemedView style={styles.checkboxSpacer} />
                              )}
                              <ThemedText style={[styles.temaItemText, !item.isLeaf && styles.temaItemTextGroup]}>{item.text}</ThemedText>
                            </ThemedView>
                          </ThemedView>
                        );
                      })}

                      {canShowMoreTemas && (
                        <TouchableOpacity style={styles.addButton} onPress={() => setTemasVisibleCount((c) => c + 60)} activeOpacity={0.85}>
                          <Ionicons name="add-circle" size={24} color="#4CAF50" />
                          <ThemedText style={styles.addButtonText}>Mostrar más</ThemedText>
                        </TouchableOpacity>
                      )}

                      {temasVisibleCount > 60 && (
                        <TouchableOpacity style={[styles.addButton, styles.addButtonGray]} onPress={() => setTemasVisibleCount(60)} activeOpacity={0.85}>
                          <Ionicons name="remove-circle" size={24} color="#8E8E93" />
                          <ThemedText style={[styles.addButtonText, styles.addButtonTextGray]}>Mostrar menos</ThemedText>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </ThemedView>
              </ThemedView>

              {/* Participantes (listas expandibles) */}
              {renderPersonaSection('Colaboradores', 'colab', colaboradoresList)}
              {renderPersonaSection('Capacitadores', 'cap', capacitadoresList)}
              {renderPhotosSection()}

              {/* Firma responsable (QR) */}
              <ThemedView style={styles.sectionContainer}>
                <ThemedView style={styles.sectionHeader}>
                  <ThemedText style={styles.sectionTitle}>Firma responsable</ThemedText>
                </ThemedView>
                <ThemedView style={styles.sectionBody}>
                  <ThemedView style={styles.firmaButtonsRow}>
                    <TouchableOpacity
                      style={[styles.firmaBlueButton, isGeneratingFirmaResponsable && styles.signatureQRButtonDisabled]}
                      onPress={handleGenerateFirmaResponsable}
                      disabled={isGeneratingFirmaResponsable}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="qr-code-outline" size={18} color="#FFFFFF" />
                      <ThemedText style={styles.firmaBlueButtonText}>{isGeneratingFirmaResponsable ? 'Generando...' : 'Generar'}</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.firmaBlueButton} onPress={handleScanFirmaResponsable} activeOpacity={0.85}>
                      <Ionicons name="scan-outline" size={18} color="#FFFFFF" />
                      <ThemedText style={styles.firmaBlueButtonText}>Escanear QR</ThemedText>
                    </TouchableOpacity>
                  </ThemedView>

                  {!firmaResponsableHash ? (
                    <ThemedText style={styles.hintText}>Debes generar o escanear una firma.</ThemedText>
                  ) : (
                    <ThemedView style={styles.firmaInfoBox}>
                      <ThemedView style={styles.firmaInfoHeader}>
                        <ThemedText style={styles.firmaInfoTitle}>Firma registrada</ThemedText>
                        <TouchableOpacity onPress={() => setFirmaResponsableHash('')} style={styles.firmaTinyTrash} activeOpacity={0.85}>
                          <Ionicons name="trash" size={14} color="#FF3B30" />
                        </TouchableOpacity>
                      </ThemedView>
                      {(() => {
                        const info = decodeFirmaHash(firmaResponsableHash);
                        if (!info) return <ThemedText style={styles.hintText}>QR sin información decodificable.</ThemedText>;
                        return (
                          <>
                            <ThemedText style={styles.firmaInfoText}>Sesión: {info.sessionId}</ThemedText>
                            <ThemedText style={styles.firmaInfoText}>Empleado: {info.empleadoId}</ThemedText>
                            <ThemedText style={styles.firmaInfoText}>Lat/Lng: {info.latitud}, {info.longitud}</ThemedText>
                            <ThemedText style={styles.firmaInfoText}>Hora: { convertDateTimestampToLocalString(new Date(Number(info.timestamp)).toISOString()) || 'N/A'}</ThemedText>
                          </>
                        );
                      })()}
                    </ThemedView>
                  )}
                </ThemedView>
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
                  style={[styles.listItemButton, styles.saveButton, isSubmitting && styles.buttonDisabled]}
                  onPress={saveHandler}
                  activeOpacity={0.85}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                      <ThemedText style={styles.buttonText}>Guardar</ThemedText>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.listItemButton, styles.cancelButton]}
                  onPress={async () => {
                    setIsCreating(false);
                    const horaAccion = await getHoraAccion();
                    if (!horaAccion) {
                      Alert.alert('Error', 'No se pudo obtener la hora');
                      return;
                    }
                    resetForm(horaAccion);
                  }}
                  activeOpacity={0.85}
                  disabled={isSubmitting}
                >
                  <Ionicons name="close" size={20} color="#FFFFFF" />
                  <ThemedText style={styles.buttonText}>Cancelar</ThemedText>
                </TouchableOpacity>
              </ThemedView>
            </ThemedView>
          )}
        </ThemedView>
      </ScrollView>

      <AppFooter />

      {/* Modal firma */}
      <Modal
        visible={signatureModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={closeSignatureModal}
      >
        <ThemedView style={styles.modalOverlay}>
          <ThemedView style={styles.modalContainer}>
            <ThemedView style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>
                {signatureTarget?.list === 'colab' ? 'Firma colaborador' : 'Firma capacitador'}
              </ThemedText>
              <TouchableOpacity onPress={closeSignatureModal} activeOpacity={0.85}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </ThemedView>

            <View style={styles.modalSignatureContainer}>
              <SignatureScreen
                ref={signatureRef}
                onOK={handleSignatureRead}
                onEmpty={onSignatureEmpty}
                descriptionText="Dibuja la firma en el área blanca"
                clearText=""
                confirmText=""
                webStyle={signatureWebStyle}
                key={signatureKey}
              />
            </View>

            <ThemedView style={styles.modalActions}>
              <TouchableOpacity style={styles.modalClearButton} onPress={clearSignatureInModal} activeOpacity={0.85}>
                <Ionicons name="trash" size={20} color="#000000" />
                <ThemedText style={styles.modalClearButtonText}>Limpiar</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalAcceptButton} onPress={acceptSignature} activeOpacity={0.85}>
                <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                <ThemedText style={styles.modalAcceptButtonText}>Aceptar</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          </ThemedView>
        </ThemedView>
      </Modal>

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
                  const createdAtLabel = convertDateTimestampToLocalString(String(row?.created_at || ''));
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
                                const isFirmaResponsable = prop === 'firma_responsable';

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
                                        if (k === 'firma_responsable') {
                                          const info = decodeFirmaHash(typeof v === 'string' ? v : String(v ?? ''));
                                          return (
                                            <ThemedView key={`c-${row.id}-${idx}-${k}`} style={styles.changeDescriptionContainer}>
                                              <ThemedText style={styles.changeDescription}>
                                                <ThemedText style={{ fontWeight: '800' }}>{k}: </ThemedText>
                                                {info
                                                  ? `Sesión: ${info.sessionId || 'N/A'} - Empleado: ${info.empleadoId || 'N/A'} - Hora: ${ convertDateTimestampToLocalString(new Date(Number(info.timestamp)).toISOString()) || 'N/A'}`
                                                  : 'Firma (formato no decodificable)'}
                                              </ThemedText>
                                            </ThemedView>
                                          );
                                        }
                                        if (k === 'colaboradores' || k === 'capacitadores') {
                                          const arr = (() => {
                                            if (Array.isArray(v)) return v as any[];
                                            if (typeof v === 'string') {
                                              try {
                                                return JSON.parse(v) as any[];
                                              } catch {
                                                return [];
                                              }
                                            }
                                            return [];
                                          })();
                                          const label = k === 'colaboradores' ? 'Colaboradores' : 'Capacitadores';
                                          return (
                                            <ThemedView key={`c-${row.id}-${idx}-${k}`} style={styles.changeDescriptionContainer}>
                                              <ThemedText style={[styles.changeDescription, { fontWeight: '800' }]}>{label}:</ThemedText>
                                              {arr.length === 0 ? (
                                                <ThemedText style={styles.changeDescription}>—</ThemedText>
                                              ) : (
                                                arr.map((p: any, i: number) => (
                                                  <ThemedView key={`p-${k}-${i}`} style={styles.changeDescriptionContainer}>
                                                    <ThemedText style={styles.changeDescription}>
                                                      {i + 1}. {String(p?.nombre ?? '').trim() || '—'} (Cédula: {String(p?.cedula ?? '').trim() || '—'} - Puesto: {String(p?.puesto_text ?? '').trim() || '—'})
                                                    </ThemedText>
                                                    {p?.firma ? (
                                                      <Image
                                                        source={{ uri: formatSignatureForDisplay(p.firma) ?? '' }}
                                                        style={styles.cambioSignatureImage}
                                                        resizeMode="contain"
                                                      />
                                                    ) : (
                                                      <ThemedText style={styles.changeDescription}>Sin firma</ThemedText>
                                                    )}
                                                  </ThemedView>
                                                ))
                                              )}
                                            </ThemedView>
                                          );
                                        }
                                        return (
                                          <ThemedView key={`c-${row.id}-${idx}-${k}`} style={styles.changeDescriptionContainer}>
                                            <ThemedText style={styles.changeDescription}>
                                              <ThemedText style={{ fontWeight: '800' }}>{k}: </ThemedText>
                                              {formatChangeValue(k, v)}
                                            </ThemedText>
                                          </ThemedView>
                                        );
                                      })}
                                    </React.Fragment>
                                  );
                                }

                                if (prop === 'colaboradores' || prop === 'capacitadores') {
                                  const arr = (() => {
                                    if (Array.isArray(value)) return value as any[];
                                    if (typeof value === 'string') {
                                      try {
                                        return JSON.parse(value) as any[];
                                      } catch {
                                        return [];
                                      }
                                    }
                                    return [];
                                  })();
                                  const label = prop === 'colaboradores' ? 'Colaboradores' : 'Capacitadores';
                                  return (
                                    <ThemedView key={`c-${row.id}-${idx}`} style={styles.changeDescriptionContainer}>
                                      <ThemedText style={[styles.changeDescription, { fontWeight: '800' }]}>{label}:</ThemedText>
                                      {arr.length === 0 ? (
                                        <ThemedText style={styles.changeDescription}>—</ThemedText>
                                      ) : (
                                        arr.map((p: any, i: number) => (
                                          <ThemedView key={`p-${prop}-${i}`} style={styles.changeDescriptionContainer}>
                                            <ThemedText style={styles.changeDescription}>
                                              {i + 1}. {String(p?.nombre ?? '').trim() || '—'} (Cédula: {String(p?.cedula ?? '').trim() || '—'} - Puesto: {String(p?.puesto_text ?? '').trim() || '—'})
                                            </ThemedText>
                                            {p?.firma ? (
                                              <Image
                                                source={{ uri: formatSignatureForDisplay(p.firma) ?? '' }}
                                                style={styles.cambioSignatureImage}
                                                resizeMode="contain"
                                              />
                                            ) : (
                                              <ThemedText style={styles.changeDescription}>Sin firma</ThemedText>
                                            )}
                                          </ThemedView>
                                        ))
                                      )}
                                    </ThemedView>
                                  );
                                }

                                return (
                                  <ThemedView key={`c-${row.id}-${idx}`} style={styles.changeDescriptionContainer}>
                                    <ThemedText style={styles.changeDescription}>
                                      <ThemedText style={{ fontWeight: '800' }}>{prop}: </ThemedText>
                                      {isFirmaResponsable && typeof value === 'string' && value.trim()
                                        ? (() => {
                                            const info = decodeFirmaHash(value);
                                            return info
                                              ? `Sesión: ${info.sessionId || 'N/A'} - Empleado: ${info.empleadoId || 'N/A'} - Hora: ${ convertDateTimestampToLocalString(new Date(Number(info.timestamp)).toISOString()) || 'N/A'}`
                                              : 'Firma (formato no decodificable)';
                                          })()
                                        : !isFirmaResponsable
                                          ? formatChangeValue(prop, value)
                                          : 'N/A'}
                                    </ThemedText>
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

      {/* Modal: vista previa de imagen */}
      <Modal
        visible={isImagePreviewVisible}
        animationType="fade"
        transparent
        onRequestClose={() => {
          setIsImagePreviewVisible(false);
          setSelectedImageUrl(null);
        }}
      >
        <View style={styles.modalOverlayDark}>
          <TouchableOpacity
            style={styles.imagePreviewClose}
            onPress={() => {
              setIsImagePreviewVisible(false);
              setSelectedImageUrl(null);
            }}
            activeOpacity={0.85}
          >
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          {selectedImageUrl ? (
            <Image source={{ uri: selectedImageUrl }} style={styles.imagePreviewFull} resizeMode="contain" />
          ) : (
            <ThemedText style={styles.emptyText}>No se pudo cargar la imagen</ThemedText>
          )}
        </View>
      </Modal>

      {QRScannerComponent}

      <SlideMenu
        isVisible={isMenuVisible}
        onClose={handleMenuClose}
        onHomePress={handleHomePress}
        currentRoute="GeneralInductionRegister"
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollView: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { paddingBottom: 100 },
  contentContainer: { padding: 16 },

  // Header principal (como LlavesScreen)
  titleContainer: { marginBottom: 8, alignItems: 'center' },
  mainHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  title: { fontSize: 22, fontWeight: '800', color: '#000000', textAlign: 'center' },
  subtitle: { marginTop: 4, fontSize: 13, color: '#000', opacity: 0.6, textAlign: 'center' },
  titleDivider: { height: 1, backgroundColor: '#E5E5EA', marginBottom: 16 },

  warningBox: { padding: 12, borderRadius: 10, backgroundColor: '#FFF3CD', borderWidth: 1, borderColor: '#FFE69C', marginBottom: 12 },
  warningText: { color: '#664D03' },

  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 10,
    marginBottom: 16,
  },
  createButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  formContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  formTitle: { fontSize: 16, fontWeight: '800', color: '#000', marginBottom: 8 },

  // Secciones estilo OpeningClosingPositionScreen
  sectionContainer: { width: '100%', marginTop: 14, marginBottom: 14 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#000000', flex: 1 },
  sectionBody: { marginTop: 10, padding: 12, backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: '#EAEAEA' },
  sectionSubtitle: { fontSize: 12, color: '#666', marginBottom: 10, fontStyle: 'italic' },

  formGroup: { marginTop: 10 },
  formLabel: { fontSize: 13, fontWeight: '700', marginBottom: 6, color: '#333' },
  formInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#000',
    backgroundColor: '#FFFFFF',
    marginBottom: 10,
  },
  disabledField: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#F2F2F7',
    marginBottom: 10,
  },
  disabledFieldText: { color: '#000', opacity: 0.7, fontSize: 14, fontWeight: '700' },

  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    marginBottom: 10,
  },
  pickerWrapper: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, overflow: 'hidden', backgroundColor: '#FFFFFF', justifyContent: 'center' },
  picker: { height: 54, width: '100%', color: '#000', fontSize: 16 },
  pickerItem: { fontSize: 16, height: 54 },

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
  dateButtonText: { fontSize: 16, color: '#000000' },

  // temas tree
  temaRow: { marginBottom: 6 },
  temaRowLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  temaChildren: { marginTop: 6 },
  // temas (lista plana)
  temaItemRow: { marginBottom: 10 },
  temaItemLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkboxContainer: { justifyContent: 'center' },
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
  checkboxSpacer: { width: 24 },
  temaItemText: { color: '#000', flex: 1 },
  temaItemTextGroup: { fontWeight: '800' },

  emptyTextSmall: { color: '#000', opacity: 0.6 },
  smallHint: { color: '#000', opacity: 0.6, marginBottom: 8 },
  hintText: { marginTop: 6, fontSize: 12, color: '#666', fontStyle: 'italic' },

  // items expandibles (como inventario)
  expandItem: { marginBottom: 15, backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#E0E0E0', overflow: 'hidden' },
  expandHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: '#F5F5F5' },
  expandHeaderContent: { flex: 1, marginRight: 10 },
  expandHeaderText: { fontSize: 16, fontWeight: '600', color: '#000000' },
  expandHeaderSubText: { marginTop: 4, fontSize: 13, color: '#000', opacity: 0.7 },
  expandHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  removeExpandButton: { padding: 4 },
  expandContent: { padding: 15 },
  signaturePreview: { width: '100%', height: 140, backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#E0E0E0', marginTop: 10 },
  personDetailCard: { width: '100%', borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10, padding: 10, backgroundColor: '#FFFFFF', marginBottom: 12 },
  personDetailTitle: { fontSize: 14, fontWeight: '800', color: '#000000', marginBottom: 6 },

  formSectionTitle: { marginTop: 6, fontSize: 14, fontWeight: '800', color: '#007AFF', marginBottom: 6 },
  signatureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    marginBottom: 10,
  },
  signatureButtonText: { color: '#007AFF', fontWeight: '700' },
  signatureSaved: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  signatureSavedText: { color: '#000', opacity: 0.7 },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  codeInput: { flex: 1, marginBottom: 0 },
  codeSearchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },

  // acciones / agregar
  addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, backgroundColor: '#E8F5E9', borderRadius: 8, marginTop: 10, gap: 8 },
  addButtonText: { color: '#4CAF50', fontSize: 14, fontWeight: '600' },
  addButtonGray: { backgroundColor: '#F2F2F7' },
  addButtonTextGray: { color: '#8E8E93' },
  captureImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    marginBottom: 10,
  },
  captureImageButtonText: { color: '#007AFF', fontWeight: '700' },
  thumbRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  thumbWrapper: { position: 'relative' },
  thumb: { width: 90, height: 90, borderRadius: 8, borderWidth: 1, borderColor: '#E0E0E0', backgroundColor: '#F5F5F5' },
  thumbDelete: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // firma responsable
  signatureQRButtonDisabled: { opacity: 0.6 },
  firmaButtonsRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
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
  firmaBlueButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  firmaInfoBox: { marginTop: 10, borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10, padding: 12, backgroundColor: '#FFFFFF' },
  firmaInfoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  firmaInfoTitle: { fontSize: 14, fontWeight: '800', color: '#000000' },
  firmaTinyTrash: { padding: 4 },
  firmaInfoText: { fontSize: 13, color: '#000000', opacity: 0.8, marginBottom: 4 },

  // list
  listContainer: { marginTop: 10 },
  listItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    marginBottom: 12,
    overflow: 'hidden',
  },
  listItemHeader: { padding: 16 },
  listItemContent: {},
  listItemTitle: { fontSize: 16, fontWeight: '800', color: '#000' },
  listItemSubtitle: { marginTop: 4, fontSize: 13, color: '#000', opacity: 0.7 },
  unsyncedBadge: { marginTop: 8, fontSize: 12, fontWeight: '800', color: '#FF9500' },
  listItemDetails: { borderTopWidth: 1, borderTopColor: '#EEE', padding: 16 },
  // Filtros jerárquicos
  filtersContainer: {
    width: '100%',
    marginBottom: 20,
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
  resetFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  resetFiltersText: {
    fontSize: 12,
    color: '#FF3B30',
    fontWeight: '600',
  },
  filtersContent: {
    padding: 16,
    gap: 12,
    backgroundColor: '#F8F9FA',
  },
  filterGroup: {
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  // Collapsables en items (mismo patrón que OpeningClosingPositionScreen)
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
  detailLine: { marginBottom: 6, color: '#000' },
  fullTemaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  listImagesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  listImageThumb: {
    width: 84,
    height: 84,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },

  actionButtons: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 10 },
  listItemButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
  },
  editButton: { backgroundColor: '#007AFF' },
  changesButton: { backgroundColor: '#5856D6', flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 8, gap: 8 },
  deleteButton: { backgroundColor: '#FF3B30' },
  saveButton: { backgroundColor: '#007AFF' },
  cancelButton: { backgroundColor: '#8E8E93' },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
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
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  floatModalCardMovimientos: { backgroundColor: '#FFFFFF', borderRadius: 12, width: '100%', maxWidth: 500, maxHeight: '80%', borderWidth: 1, borderColor: '#E0E0E0', overflow: 'hidden' },
  floatModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  cambioCollapsableMain: { width: '100%', marginBottom: 10, backgroundColor: '#fff', borderRadius: 6, borderWidth: 1, borderColor: '#E0E0E0', overflow: 'hidden' },
  cambioCollapsableHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#F8F9FA' },
  cambioCollapsableTitle: { fontSize: 14, fontWeight: '600', color: '#007AFF', flex: 1 },
  cambioCollapsableContent: { padding: 12, gap: 8, backgroundColor: '#F8F9FA' },
  changeDescription: { fontSize: 14, lineHeight: 20, color: '#666', marginBottom: 8 },
  changeDescriptionContainer: { marginBottom: 8 },
  cambioSignatureImage: { marginTop: 6, height: 80, width: 160, backgroundColor: '#f0f0f0', borderRadius: 4 },
  filterGroupSearch: { marginBottom: 12 },

  smallButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
  addMiniButton: { backgroundColor: '#007AFF' },
  deleteMiniButton: { backgroundColor: '#FF3B30' },
  cancelMiniButton: { backgroundColor: '#8E8E93' },

  loadingContainer: { paddingVertical: 40, alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#000', opacity: 0.7 },
  loadingInline: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  loadingInlineText: { fontSize: 14, color: '#000' },

  // Modal firma (como OpeningClosingPositionScreen)
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
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  modalSignatureContainer: {
    height: 300,
    width: '100%',
  },
  cameraContainer: { flex: 1, backgroundColor: '#000000' },
  camera: { flex: 1 },
  cameraControls: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  cameraCancelButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraCaptureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraCaptureButtonInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFFFFF',
  },
  modalOverlayDark: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  imagePreviewFull: {
    width: '100%',
    height: '85%',
  },
  imagePreviewClose: {
    position: 'absolute',
    top: 45,
    right: 20,
    zIndex: 10,
    padding: 6,
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
  errorContainer: { padding: 14, borderRadius: 10, backgroundColor: '#FFEBEE', borderWidth: 1, borderColor: '#FFCDD2' },
  errorText: { color: '#B00020', fontWeight: '700' },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#FFF3CD',
    borderWidth: 1,
    borderColor: '#FFEBAA',
    marginBottom: 12,
  },
  offlineBannerText: { flex: 1, color: '#8A6D00', fontWeight: '700' },
  emptyContainer: { padding: 14, borderRadius: 10, backgroundColor: '#F2F2F7', borderWidth: 1, borderColor: '#E5E5EA' },
  emptyText: { color: '#000', opacity: 0.6 },

  // signature modal (legacy - mantenido por compatibilidad, no se usa)
  signatureModalContainer: { flex: 1, backgroundColor: '#FFFFFF', padding: 16 },
  signatureModalTitle: { fontSize: 16, fontWeight: '800', color: '#000', marginBottom: 10 },
  signatureModalButtons: { marginTop: 12 },
});


