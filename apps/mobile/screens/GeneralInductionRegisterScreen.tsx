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
} from 'react-native';
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
import { useAuth } from '@/contexts/AuthContext';
import { eventBus } from '@/hooks/eventBus';
import getHoraAccion from '@/hooks/getHoraAccion';
import { useQRScanner } from '@/hooks/useQRScanner';
import {
  createGeneralInductionRegister,
  deleteGeneralInductionRegister,
  listGeneralInductionRegisterByCorpo,
  updateGeneralInductionRegister,
} from '@/hooks/evaluationFunctions';
import { RootStackParamList } from '../App';

type GeneralInductionRegisterScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'GeneralInductionRegister'
>;

type MainStructurePlazaNode = { id: number; nombre: string };
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
  const { employee, refreshAccessToken, logout } = useAuth();
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
  const [hasCurrentMarca, setHasCurrentMarca] = useState(true);
  const [records, setRecords] = useState<GeneralInductionRegisterRecord[]>([]);

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

  const [fecha, setFecha] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Temas seleccionados: array de objetos {id, text} (se guarda en DB como string JSON)
  const [selectedTemas, setSelectedTemas] = useState<TemaSelectedItem[]>([]);
  const [temasVisibleCount, setTemasVisibleCount] = useState(60);
  const [colaboradoresList, setColaboradoresList] = useState<PersonaItem[]>([]);
  const [capacitadoresList, setCapacitadoresList] = useState<PersonaItem[]>([]);
  const [expandedColaboradores, setExpandedColaboradores] = useState<string[]>([]);
  const [expandedCapacitadores, setExpandedCapacitadores] = useState<string[]>([]);

  const [firmaResponsableHash, setFirmaResponsableHash] = useState('');
  const [isGeneratingFirmaResponsable, setIsGeneratingFirmaResponsable] = useState(false);

  const [signatureModalVisible, setSignatureModalVisible] = useState(false);
  const [signatureTarget, setSignatureTarget] = useState<{ list: 'colab' | 'cap'; id_local: string } | null>(null);
  const signatureRef = useRef<any>(null);
  const [signatureKey, setSignatureKey] = useState(0);

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
      if (!apiUrl) throw new Error('Server URL not configured');

      let token = await AsyncStorage.getItem('access_token');
      if (!token) {
        const refreshed = await refreshAccessToken();
        if (!refreshed) {
          if (logout) await logout();
          throw new Error('Sesión expirada');
        }
        token = await AsyncStorage.getItem('access_token');
      }

      const response = await fetch(`${apiUrl}/api/main-structure`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '69420',
        },
      });

      if (response.status === 401 || response.status === 403) {
        // Evitar recursividad infinita: reintentar UNA vez con token refrescado
        const refreshed = await refreshAccessToken();
        if (!refreshed) {
          await logout();
          return;
        }
        let token2 = await AsyncStorage.getItem('access_token');
        if (!token2) {
          const refreshed = await refreshAccessToken();
          if (!refreshed) {
            if (logout) await logout();
            throw new Error('Sesión expirada');
          }
          token2 = await AsyncStorage.getItem('access_token');
        }
        const retry = await fetch(`${apiUrl}/api/main-structure`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token2}`,
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': '69420',
          },
        });
        if (retry.status === 401 || retry.status === 403) {
          await logout();
          return;
        }
        if (!retry.ok) throw new Error(`HTTP error! status: ${retry.status}`);
        const data2 = await retry.json();
        const incoming2 = data2?.structure;
        if (data2?.status && Array.isArray(incoming2)) {
          setStructure(incoming2);
          await AsyncStorage.setItem('main_structure_cache', JSON.stringify(incoming2));
        }
        return;
      }

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      const incoming = data?.structure;
      if (data?.status && Array.isArray(incoming)) {
        setStructure(incoming);
        await AsyncStorage.setItem('main_structure_cache', JSON.stringify(incoming));
      }
    } catch (e) {
      console.error('Error fetching main structure for general induction register:', e);
    } finally {
      setIsStructureLoading(false);
    }
  }, [refreshAccessToken, logout]);

  const fetchRecords = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const currentMarcaStr = await AsyncStorage.getItem('current_marca');
      if (!currentMarcaStr) {
        setHasCurrentMarca(false);
        setIsLoading(false);
        return;
      }

      console.log('currentMarcaStr', currentMarcaStr);

      setHasCurrentMarca(true);
      const currentMarca = JSON.parse(currentMarcaStr);
      const corpoIdStr = currentMarca?.corpo?.id?.toString?.() || currentMarca?.corpo_id?.toString?.();
      const divIdRaw = currentMarca?.roleDivision?.division?.id;
      console.log('divIdRaw', divIdRaw);
      setMarcaDivisionId(divIdRaw !== undefined && divIdRaw !== null ? Number(divIdRaw) : null);

      await fetchMainStructure();

      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
      const cache = cacheStr ? JSON.parse(cacheStr) : [];
      const local = (cache || []).filter((i: any) => i.type === 'general_induction_register');

      const isConnected = await getConnectionStatus();
      if (!corpoIdStr) {
        setRecords(local);
        return;
      }

      if (isConnected) {
        const result = await listGeneralInductionRegisterByCorpo({
          corpo_id: corpoIdStr,
          refreshAccessToken,
          logout,
        });

        const serverRecords = (result.status && Array.isArray(result.data) ? (result.data as any[]) : []).map((r) => ({
          ...r,
          synced: true,
        }));
        const merged = [...local, ...serverRecords];
        setRecords(merged);
      } else {
        setRecords(local);
      }
    } catch (e) {
      console.error('Error fetching general induction register records:', e);
      setError('Error al cargar los registros de inducción general');
      try {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        const cache = cacheStr ? JSON.parse(cacheStr) : [];
        const local = (cache || []).filter((i: any) => i.type === 'general_induction_register');
        setRecords(local);
      } catch {
        // ignore
      }
    } finally {
      setIsLoading(false);
    }
  }, [fetchMainStructure, refreshAccessToken, logout]);

  useFocusEffect(
    useCallback(() => {
      fetchRecords();
      eventBus.on('connectionRestored', fetchRecords);
      return () => {
        eventBus.off('connectionRestored', fetchRecords);
      };
    }, [fetchRecords])
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

  const temasData = useMemo(() => {
    if (selectedDivisionId === 5) return TEMAS_DATA_AYL;
    if (selectedDivisionId === 4) return TEMAS_DATA_SEG;
    return TEMAS_DATA_EMPTY;
  }, [selectedDivisionId]);
  const temasFlat = temasData.flat;
  const temasLeafTextById = temasData.leafTextById;
  const temasVisible = useMemo(() => temasFlat.slice(0, temasVisibleCount), [temasFlat, temasVisibleCount]);
  const selectedTemaIdSet = useMemo(() => new Set(selectedTemas.map((t) => t.id)), [selectedTemas]);

  useEffect(() => {
    // Reiniciar cantidad visible cuando cambie la división (formulario dinámico)
    setTemasVisibleCount(60);
    if (!editingRecord) setSelectedTemas([]);
  }, [selectedDivisionId]);

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

  // 2) Luego auto-seleccionar la división dependiendo de la marca
  useEffect(() => {
    if (editingRecord) return;
    if (isStructureLoading || isDivisionOptionsLoading) return;
    if (!selectedClienteId || !marcaDivisionId) {
      setSelectedDivisionId(null);
      return;
    }
    const marcaDivId = Number(marcaDivisionId);
    const found = divisionOptions.find((d) => Number(d.id) === marcaDivId) ?? null;
    const nextId = found ? Number(found.id) : null;
    setSelectedDivisionId((prev) => (prev === nextId ? prev : nextId));
  }, [selectedClienteId, marcaDivisionId, editingRecord, isStructureLoading, isDivisionOptionsLoading, divisionOptions]);

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

  const resetForm = () => {
    setFecha(new Date());
    setSelectedTemas([]);
    setColaboradoresList([]);
    setCapacitadoresList([]);
    setFirmaResponsableHash('');
    setEditingRecord(null);
  };

  const startCreate = () => {
    resetForm();
    setIsCreating(true);
  };

  const startEditing = (record: GeneralInductionRegisterRecord) => {
    try {
      setIsCreating(true);
      setEditingRecord({ id: record.id ? String(record.id) : null, id_local: record.id_local || '' });

      setFecha(record.fecha ? new Date(record.fecha) : new Date());

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

  const saveHandler = async () => {
    try {
      if (!selectedEmpresaId || !selectedClienteId || !selectedSucursalId) {
        Alert.alert('Error', 'Empresa, Cliente y Sucursal son obligatorios');
        return;
      }
      if (!selectedDivisionId || !selectedDivisionNode) {
        Alert.alert('Error', 'No se pudo determinar la división (marca actual)');
        return;
      }
      if (!firmaResponsableHash.trim()) {
        Alert.alert('Error', 'Firma responsable (QR/Generar) es obligatoria');
        return;
      }

      const temasPayload = buildTemasPayload();
      if (!Array.isArray(temasPayload.selected) || temasPayload.selected.length === 0) {
        Alert.alert('Error', 'Debe seleccionar al menos 1 tema (checkbox)');
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
      };

      const isConnected = await getConnectionStatus();

      // create
      if (!editingRecord || (!editingRecord.id && !editingRecord.id_local)) {
        if (isConnected) {
          const result = await createGeneralInductionRegister({
            requestData,
            refreshAccessToken,
            logout,
          });
          if (!result.status) throw new Error(result.message || 'No se pudo crear el registro');
          Alert.alert('Éxito', 'Registro creado correctamente');
          setIsCreating(false);
          resetForm();
          fetchRecords();
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
            created_at: new Date().toISOString(),
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

          setIsCreating(false);
          resetForm();
          fetchRecords();
          Alert.alert('Guardado offline', 'Se guardó localmente y se sincronizará al recuperar conexión');
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
            },
            refreshAccessToken,
            logout,
          });
          if (!result.status) throw new Error(result.message || 'No se pudo actualizar el registro');
          Alert.alert('Éxito', 'Registro actualizado correctamente');
          setIsCreating(false);
          resetForm();
          fetchRecords();
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

        setIsCreating(false);
        resetForm();
        fetchRecords();
        Alert.alert('Actualizado offline', 'El servidor no está disponible. Se guardó localmente y se sincronizará al recuperar conexión');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo guardar el registro');
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
          const fechaTxt = r.fecha ? String(r.fecha).split('T')[0] : 'N/A';

          const temasObj = safeJsonParse<any>(r.temas_a_tratar, null);
          const temasSelected = Array.isArray(temasObj?.selected) ? temasObj.selected : [];
          const temasLeafs = Array.isArray(temasObj?.leafs) ? temasObj.leafs : null;

          const colaboradores = safeJsonParse<any[]>(r.colaboradores, []);
          const capacitadores = safeJsonParse<any[]>(r.capacitadores, []);

          const isTemasOpen = !!expandedTemasById[itemKey];
          const isColabsOpen = !!expandedColaboradoresById[itemKey];
          const isCapsOpen = !!expandedCapacitadoresById[itemKey];
          const isFirmaOpen = !!expandedFirmaById[itemKey];

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
                          <ThemedText style={styles.detailLine}>Hora: {info.timestamp}</ThemedText>
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
              <TouchableOpacity style={styles.createButton} onPress={startCreate} activeOpacity={0.85}>
                <Ionicons name="add" size={24} color="#FFFFFF" />
              </TouchableOpacity>
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
                  <ThemedText style={styles.dateButtonText}>{fecha.toISOString().split('T')[0]}</ThemedText>
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
                      <ThemedText style={styles.formLabel}>División (automática)</ThemedText>
                      <ThemedView style={styles.pickerWrapper}>
                        <Picker selectedValue={selectedDivisionId ?? 0} onValueChange={() => { }} enabled={false} style={styles.picker}>
                          <Picker.Item
                            label={
                              selectedClienteId
                                ? (selectedDivisionId ? (divisionOptions.find((d) => d.id === selectedDivisionId)?.nombre || 'División') : 'No disponible para su marca')
                                : 'Seleccione cliente primero'
                            }
                            value={0}
                          />
                        </Picker>
                      </ThemedView>
                      {selectedClienteId && !selectedDivisionId && (
                        <ThemedText style={styles.hintText}>La división de su marca no existe para el cliente seleccionado.</ThemedText>
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
                            <ThemedText style={styles.firmaInfoText}>Hora: {info.timestamp}</ThemedText>
                          </>
                        );
                      })()}
                    </ThemedView>
                  )}
                </ThemedView>
              </ThemedView>

              <ThemedView style={styles.actionButtons}>
                <TouchableOpacity style={[styles.listItemButton, styles.saveButton]} onPress={saveHandler} activeOpacity={0.85}>
                  <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                  <ThemedText style={styles.buttonText}>Guardar</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.listItemButton, styles.cancelButton]}
                  onPress={() => {
                    setIsCreating(false);
                    resetForm();
                  }}
                  activeOpacity={0.85}
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

  // acciones / agregar
  addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, backgroundColor: '#E8F5E9', borderRadius: 8, marginTop: 10, gap: 8 },
  addButtonText: { color: '#4CAF50', fontSize: 14, fontWeight: '600' },
  addButtonGray: { backgroundColor: '#F2F2F7' },
  addButtonTextGray: { color: '#8E8E93' },

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
  deleteButton: { backgroundColor: '#FF3B30' },
  saveButton: { backgroundColor: '#007AFF' },
  cancelButton: { backgroundColor: '#8E8E93' },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

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
  emptyContainer: { padding: 14, borderRadius: 10, backgroundColor: '#F2F2F7', borderWidth: 1, borderColor: '#E5E5EA' },
  emptyText: { color: '#000', opacity: 0.6 },

  // signature modal (legacy - mantenido por compatibilidad, no se usa)
  signatureModalContainer: { flex: 1, backgroundColor: '#FFFFFF', padding: 16 },
  signatureModalTitle: { fontSize: 16, fontWeight: '800', color: '#000', marginBottom: 10 },
  signatureModalButtons: { marginTop: 12 },
});


