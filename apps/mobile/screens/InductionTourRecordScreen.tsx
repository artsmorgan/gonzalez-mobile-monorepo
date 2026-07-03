import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
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
import CambiosAppsModulesModal, { type CambiosAppsModulesRow } from '@/components/CambiosAppsModulesModal';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import SignatureScreen from "react-native-signature-canvas";
import getCurrentUserDigitalSignature from '@/hooks/getCurrentUserDigitalSignature';
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
import Ionicons from '@expo/vector-icons/build/Ionicons';
import * as Network from 'expo-network';
import getHoraAccion from '@/hooks/getHoraAccion';
import authedFetch from '@/hooks/authedFetch';
import {
  createInductionTourRecord,
  updateInductionTourRecord,
  deleteInductionTourRecord,
  listInductionTourRecords,
} from '@/hooks/evaluationFunctions';
import { eventBus } from '@/hooks/eventBus';
import { useQRScanner } from '@/hooks/useQRScanner';
import { convertDateTimestampToLocalString } from '@/hooks/convertDateTimestampToLocalString';
import { loadMainStructureTreeMerged } from '@/hooks/bitacoraMainStructureCache';

type InductionTourRecordScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'InductionTourRecord'>;

interface TemaDesarrollado {
  tema: string;
  respuesta: string; // "SI", "NO", "NA"
  comentarios: string;
}

interface AspectoEspecifico {
  aspecto: string;
  respuesta: string; // "SI", "NO", "NA"
  comentarios: string;
}

interface Participante {
  nombre_completo: string;
  cedula: string;
  firma: string | null;
}

interface InductionTourRecord {
  id: number | string;
  id_local: string;
  fecha: string | null;
  /** Jerarquía persistida (API / caché) */
  empresa_id?: number | null;
  cliente_id?: number | null;
  division_id?: number | null;
  contrato_id?: number | null;
  corpo_id?: number | null;
  puesto_id?: number | null;
  plaza_id?: number | null;
  empleado_id?: number | null;
  division?: string | null;
  renglon_edificio: string | null;
  supervisor_cliente: string | null;
  supervisor_corporacion: string | null;
  temas_desarrollados: string | null;
  aspectos_especificos: string | null;
  participantes: string | null;
  firma_supervisor: string | null;
  firma_empleado?: string | null;
  firma_responsable?: string | null;
  created_at: string;
  synced?: boolean;
  /** Filtro de listados: ocultar inactivos (GET servidor ya filtra; caché antigua puede no tener el campo) */
  isActive?: boolean;
}

interface EditingInductionTourRecord {
  id: string | null;
  id_local: string;
  fecha: string;
  division: string;
  renglon_edificio: string;
  supervisor_cliente: string;
  supervisor_corporacion: string;
  temas_desarrollados: TemaDesarrollado[];
  aspectos_especificos: AspectoEspecifico[];
  participantes: Participante[];
  firma_supervisor: string;
  firma_responsable: string;
}

// Main structure types
type MainStructureEmpleado = {
  id: number;
  nombre?: string | null;
  primer_apellido?: string | null;
  segundo_apellido?: string | null;
  cedula: string;
  fecha_contratacion?: string | null;
};

type MainStructurePlaza = { id: number; nombre: string; empleados?: MainStructureEmpleado[] };
type MainStructurePuesto = { id: number; nombre: string; plazas?: MainStructurePlaza[] };
type MainStructureSucursal = { id: number; nombre: string; puestos?: MainStructurePuesto[] };
type MainStructureContrato = { id: number; nombre: string; sucursales?: MainStructureSucursal[] };
type MainStructureDivision = { id: number; nombre: string; contratos?: MainStructureContrato[] };
type MainStructureCliente = { id: number; nombre: string; division?: MainStructureDivision[] };
type MainStructureEmpresa = { id: number; nombre: string; clientes?: MainStructureCliente[] };

interface FirmaEmpleadoData {
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

const TEMAS_PREDEFINIDOS = [
  "Revisión de los documentos del expediente del aspirante.",
  "Prueba de cepillo.",
  "Presentación de los Supervisores",
  "Recorrido por las gradas y puertas de emergencia.",
  "Uso correcto del uniforme y presentación personal según el contrato, documento de apoyo (AYL-PO-001-Código de Vestimenta Aseo y Limpieza)",
  "Normativas de comportamiento en el lugar de trabajo así como las penalizaciones de no cumplirlo según Disciplina progresiva",
  "Uso de los ascensores en jornada normal y en caso de emergencia.",
  "Presentación de los diferentes tipos de químicos utilizados por la empresa.",
  "Indicaciones de los diferentes horarios a seguir y tiempos de alimentación, así como indicaciones de jornada laboral en fines de semana (si aplica). (AYL-F-002-Rol de trabajo mensual)",
  "Lectura de labores diarias, semanales, quincenales y mensuales: AYL-F-035-Guía de Funciones del puesto y AYL-F-028 Registro de Tareas",
  "Uso del rótulo preventivos, consecuencias de no usarlos.",
  "Rotación de áreas o piso.",
  "Uso del celular en horas laborales.",
  "Registros de Limpieza que deben ser utilizados",
  "Check list de entrega de áreas (si aplica)",
  "Comunicación de Procedimientos: - Desinfección de Mechas - Uso de Palo de Piso - Limpiezas terminales (si aplica) - Limpiezas tipos Salidas (Si aplica) - Traslado de pacientes contaminados (si aplica) - Derrames y procedimiento de levantamiento de biopeligrosos (si aplica)",
];

const ASPECTOS_PREDEFINIDOS = [
  "Introducción a los dispositivos de alarmas y emergencia del edificio.",
  "Uso de Equipo de Protección Personal: Guantes, mascarillas, Lentes, o el que aplique.",
];

function numOrNull(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Conserva otros tipos en `evaluations_cache` y otras sucursales; reescribe solo `induction_tour_record` del `corpoId` dado. */
function mergeEvaluationsCacheInductionTourForCorpo(
  fullCache: any[],
  freshFromServer: InductionTourRecord[],
  corpoId: number
): any[] {
  const cid = Number(corpoId);
  const arr = Array.isArray(fullCache) ? fullCache : [];

  const unsyncedPending = arr.filter(
    (item: any) =>
      item?.type === 'induction_tour_record' &&
      item.corpo_id != null &&
      item.corpo_id !== '' &&
      Number(item.corpo_id) === cid &&
      item.synced === false
  );

  const unsyncedIds = new Set(unsyncedPending.map((r: any) => String(r.id || r.id_local || '')));
  const filteredServer = (freshFromServer || [])
    .filter((r) => (r as any).isActive !== false)
    .filter((r) => !unsyncedIds.has(String(r.id || r.id_local || '')));

  const taggedServer = filteredServer.map((r) => ({
    ...r,
    type: 'induction_tour_record',
    corpo_id: (r as any).corpo_id != null ? Number((r as any).corpo_id) : cid,
    synced: true,
    isActive: (r as any).isActive !== false,
  }));

  const rest = arr.filter((item: any) => {
    if (item?.type !== 'induction_tour_record') return true;
    if (item.corpo_id == null || item.corpo_id === '') return true;
    if (Number(item.corpo_id) !== cid) return true;
    return false;
  });

  return [...rest, ...unsyncedPending, ...taggedServer];
}

function sortInductionTourRecordsDesc(items: InductionTourRecord[]): InductionTourRecord[] {
  return [...items].sort((a, b) => {
    const ta = new Date(String((a as any).created_at || 0)).getTime();
    const tb = new Date(String((b as any).created_at || 0)).getTime();
    return tb - ta;
  });
}

function getDivisionesFromCliente(cliente: any): MainStructureDivision[] {
  const a = Array.isArray(cliente?.division) ? cliente.division : [];
  const b = Array.isArray(cliente?.divisiones) ? cliente.divisiones : [];
  const byId = new Map<number, MainStructureDivision>();
  for (const d of [...a, ...b]) {
    const id = Number(d?.id);
    if (Number.isFinite(id) && !byId.has(id)) byId.set(id, d);
  }
  return Array.from(byId.values());
}

function getDivisionIdFromMarcaJson(marca: any): number | null {
  const raw =
    marca?.roleDivision?.division?.id ??
    marca?.role_division?.division?.id ??
    marca?.division?.id ??
    marca?.division_id;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Rastrea plaza_id y/o empleado_id hasta empresa en main_structure (route dynamic-prisma/main-structure). */
function findHierarchyByEmpleadoYPlaza(
  structureArr: MainStructureEmpresa[],
  empleadoId: number | null,
  plazaId: number | null
): {
  empresaId: number;
  clienteId: number;
  divisionId: number;
  contratoId: number;
  corpoId: number;
  puestoId: number;
  plazaId: number;
} | null {
  const eid = empleadoId != null && Number.isFinite(Number(empleadoId)) ? Number(empleadoId) : null;
  const pid = plazaId != null && Number.isFinite(Number(plazaId)) ? Number(plazaId) : null;
  if (eid == null && pid == null) return null;

  for (const empresa of structureArr || []) {
    for (const cliente of empresa?.clientes || []) {
      for (const division of getDivisionesFromCliente(cliente)) {
        for (const contrato of division.contratos || []) {
          for (const sucursal of contrato.sucursales || []) {
            for (const puesto of sucursal.puestos || []) {
              for (const plaza of puesto.plazas || []) {
                if (pid != null && Number(plaza.id) !== pid) continue;
                const empleados = Array.isArray(plaza.empleados) ? plaza.empleados : [];
                if (eid != null && !empleados.some((emp: any) => Number(emp?.id) === eid)) continue;
                return {
                  empresaId: Number(empresa.id),
                  clienteId: Number(cliente.id),
                  divisionId: Number(division.id),
                  contratoId: Number(contrato.id),
                  corpoId: Number(sucursal.id),
                  puestoId: Number(puesto.id),
                  plazaId: Number(plaza.id),
                };
              }
            }
          }
        }
      }
    }
  }
  return null;
}

/** Ruta en el árbol mergeado por puesto y sucursal (corpo); útil al editar si empleado/plaza no resuelven la ruta. */
function findHierarchyByPuestoYCorpo(
  structureArr: MainStructureEmpresa[],
  puestoId: number | null,
  corpoId: number | null
): {
  empresaId: number;
  clienteId: number;
  divisionId: number;
  contratoId: number;
  corpoId: number;
  puestoId: number;
} | null {
  const pid = puestoId != null && Number.isFinite(Number(puestoId)) ? Number(puestoId) : null;
  const sid = corpoId != null && Number.isFinite(Number(corpoId)) ? Number(corpoId) : null;
  if (pid == null || sid == null || pid <= 0 || sid <= 0) return null;
  for (const empresa of structureArr || []) {
    for (const cliente of empresa?.clientes || []) {
      for (const division of getDivisionesFromCliente(cliente)) {
        for (const contrato of division.contratos || []) {
          for (const sucursal of contrato.sucursales || []) {
            if (Number(sucursal.id) !== sid) continue;
            for (const puesto of sucursal.puestos || []) {
              if (Number(puesto.id) === pid) {
                return {
                  empresaId: Number(empresa.id),
                  clienteId: Number(cliente.id),
                  divisionId: Number(division.id),
                  contratoId: Number(contrato.id),
                  corpoId: Number(sucursal.id),
                  puestoId: pid,
                };
              }
            }
          }
        }
      }
    }
  }
  return null;
}

function inductionTourRowVisibleInList(item: any): boolean {
  if (item?.type !== 'induction_tour_record') return true;
  if (item?.synced === false) return true;
  return item?.isActive !== false;
}

export default function InductionTourRecordScreen() {
  const { employee, refreshAccessToken, logout } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<InductionTourRecordScreenNavigationProp>();
  const { scanQR, QRScannerComponent } = useQRScanner();

  // Data states
  const [records, setRecords] = useState<InductionTourRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal: ver cambios (auditoría)
  const [isCambiosModalVisible, setIsCambiosModalVisible] = useState(false);
  const [cambiosTitle, setCambiosTitle] = useState<string>('Cambios');
  const [cambiosItems, setCambiosItems] = useState<CambiosAppsModulesRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasCurrentMarca, setHasCurrentMarca] = useState<boolean>(false);

  // Main structure y filtros jerárquicos
  const [structure, setStructure] = useState<MainStructureEmpresa[]>([]);
  const [isStructureLoading, setIsStructureLoading] = useState(false);
  const [filterEmpresaId, setFilterEmpresaId] = useState<number | null>(null);
  const [filterClienteId, setFilterClienteId] = useState<number | null>(null);
  const [filterDivisionId, setFilterDivisionId] = useState<number | null>(null);
  const [filterContratoId, setFilterContratoId] = useState<number | null>(null);
  const [filterCorpoId, setFilterCorpoId] = useState<number | null>(null);
  const filterCorpoIdRef = useRef<number | null>(null);
  const [isHierarchyFiltersExpanded, setIsHierarchyFiltersExpanded] = useState(false);
  const hasFetchedStructureRef = useRef<boolean>(false);
  const listFiltersSyncedFromMarcaOnceRef = useRef(false);
  const [roleName, setRoleName] = useState<string | null>(null);
  const [deletingRecordKey, setDeletingRecordKey] = useState<string | null>(null);

  // Empleado selection states
  const [selectedEmpleadoId, setSelectedEmpleadoId] = useState<number | null>(null);
  const empleadoIdRef = useRef<number | null>(null);

  // Firma empleado states
  const [firmaEmpleado, setFirmaEmpleado] = useState<FirmaEmpleadoData | null>(null);
  const [firmaEmpleadoHash, setFirmaEmpleadoHash] = useState<string | null>(null);
  const [firmaEmpleadoManual, setFirmaEmpleadoManual] = useState<string | null>(null);
  const [firmaEmpleadoWarning, setFirmaEmpleadoWarning] = useState<string | null>(null);
  const [isFirmaEmpleadoManualModalVisible, setIsFirmaEmpleadoManualModalVisible] = useState(false);
  const [isReadingFirmaEmpleadoManual, setIsReadingFirmaEmpleadoManual] = useState(false);
  const signatureEmpleadoRef = useRef<any>(null);
  const [signatureEmpleadoKey, setSignatureEmpleadoKey] = useState(0);

  // IDs de current_marca para inicialización
  const [marcaEmpresaId, setMarcaEmpresaId] = useState<number | null>(null);
  const [marcaClienteId, setMarcaClienteId] = useState<number | null>(null);
  const [marcaContratoId, setMarcaContratoId] = useState<number | null>(null);
  const [marcaCorpoId, setMarcaCorpoId] = useState<number | null>(null);
  const [marcaPuestoId, setMarcaPuestoId] = useState<number | null>(null);

  // Editing state
  const [editingRecord, setEditingRecord] = useState<EditingInductionTourRecord | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResponse, setSubmitResponse] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [isLoadingStructure, setIsLoadingStructure] = useState(true);

  // Form states - Jerarquía
  const [formEmpresaId, setFormEmpresaId] = useState<number | null>(null);
  const [formClienteId, setFormClienteId] = useState<number | null>(null);
  const [formDivisionId, setFormDivisionId] = useState<number | null>(null);
  const [formContratoId, setFormContratoId] = useState<number | null>(null);
  const [formCorpoId, setFormCorpoId] = useState<number | null>(null);
  const [formPuestoId, setFormPuestoId] = useState<number | null>(null);
  const [formPlazaId, setFormPlazaId] = useState<number | null>(null);

  // Form states
  const [fecha, setFecha] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [division, setDivision] = useState<string>('Otros');
  const [renglonEdificio, setRenglonEdificio] = useState('');
  const [supervisorCliente, setSupervisorCliente] = useState('');
  const [supervisorCorporacion, setSupervisorCorporacion] = useState('');
  const [temasDesarrollados, setTemasDesarrollados] = useState<TemaDesarrollado[]>([]);
  const [aspectosEspecificos, setAspectosEspecificos] = useState<AspectoEspecifico[]>([]);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [firmaSupervisor, setFirmaSupervisor] = useState<string | null>(null);
  const [firmaResponsableHash, setFirmaResponsableHash] = useState<string>('');
  const [isGeneratingFirmaResponsable, setIsGeneratingFirmaResponsable] = useState(false);

  // Expanded states
  const [expandedTemaIndices, setExpandedTemaIndices] = useState<number[]>([]);
  const [expandedAspectoIndices, setExpandedAspectoIndices] = useState<number[]>([]);
  const [expandedParticipanteIndices, setExpandedParticipanteIndices] = useState<number[]>([]);
  const [expandedFirmaResponsableIds, setExpandedFirmaResponsableIds] = useState<string[]>([]);
  const [expandedTemasListIds, setExpandedTemasListIds] = useState<string[]>([]);
  const [expandedAspectosListIds, setExpandedAspectosListIds] = useState<string[]>([]);

  // Signature modal states
  const [isSignatureModalVisible, setIsSignatureModalVisible] = useState(false);
  const [currentSignatureType, setCurrentSignatureType] = useState<'supervisor' | { type: 'participante', index: number } | null>(null);
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

  const generateRandomId = (): string => {
    return `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const formatDate = (date: Date): string => {
    return convertDateTimestampToLocalString(date.toISOString(), false);
  };

  const formatDateForRequest = (date: Date): string => {
    // ISO date only for API stability
    return date.toISOString().split('T')[0];
  };

  const formatDateForDisplay = (value?: string | null): string => {
    if (!value) return 'N/A';
    const raw = String(value).split('T')[0];
    const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (ymd) return `${ymd[3]}-${ymd[2]}-${ymd[1]}`;
    const dmy = raw.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
    if (dmy) return `${dmy[1]}-${dmy[2]}-${dmy[3]}`;
    return raw;
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

  const handleGenerateFirmaResponsable = async () => {
    try {
      setIsGeneratingFirmaResponsable(true);
      if (!employee) {
        Alert.alert('Error', 'No se pudo obtener la información del empleado');
        return;
      }
      const hash = await getCurrentUserDigitalSignature(employee);
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

  // Funciones para manejo de empleado y firma del empleado
  const onEmpleadoSelected = (id: number | null) => {
    setSelectedEmpleadoId(id);
    empleadoIdRef.current = id;
    if (!id) {
      setFirmaEmpleadoWarning(null);
      return;
    }

    if (firmaEmpleado?.empleadoId && String(firmaEmpleado.empleadoId) !== String(id)) {
      const emp = formEmpleados.find((e: MainStructureEmpleado) => e.id === id);
      setFirmaEmpleadoWarning(
        `La firma corresponde al empleado ID ${firmaEmpleado.empleadoId}, pero el empleado seleccionado es ${emp?.nombre || 'otro'}.`
      );
    } else {
      setFirmaEmpleadoWarning(null);
    }
  };

  const handleScanFirmaEmpleado = async () => {
    try {
      const qrData = await scanQR();
      if (!qrData) return;

      try {
        const decoded = atob(qrData);
        const parts = decoded.split(':');
        if (parts.length !== 5) {
          Alert.alert('Error', 'El QR no tiene la estructura esperada');
          return;
        }
        const [sessionId, empleadoId, latitud, longitud, timestamp] = parts;

        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        let empleadoDetalle: FirmaEmpleadoData['empleadoDetalle'] = undefined;
        const isConnected = await getConnectionStatus();
        if (isConnected && apiUrl) {
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
          if (!response) return;

          if (response.ok) {
            const empleadoData = await response.json();
            empleadoDetalle = {
              nombre: empleadoData.nombre,
              primer_apellido: empleadoData.primer_apellido,
              segundo_apellido: empleadoData.segundo_apellido,
              cedula_empleado: empleadoData.cedula,
            };
          }
        }

        setFirmaEmpleado({
          sessionId,
          empleadoId,
          latitud,
          longitud,
          timestamp,
          empleadoDetalle,
        });
        setFirmaEmpleadoHash(qrData);

        if (selectedEmpleadoId) {
          if (String(selectedEmpleadoId) !== String(empleadoId)) {
            const empleadoSel = formEmpleados.find((e: MainStructureEmpleado) => e.id === selectedEmpleadoId);
            setFirmaEmpleadoWarning(
              `La firma corresponde al empleado ID ${empleadoId}, pero el empleado seleccionado es ${empleadoSel?.nombre || 'otro'}.`
            );
          } else {
            setFirmaEmpleadoWarning(null);
          }
        } else {
          setFirmaEmpleadoWarning(null);
        }
      } catch (err) {
        console.error('Error decoding employee signature QR:', err);
        Alert.alert('Error', 'El QR escaneado no es válido');
      }
    } catch (error) {
      console.error('Error scanning QR for employee signature:', error);
      Alert.alert('Error', 'No se pudo escanear la firma del empleado');
    }
  };

  const openFirmaEmpleadoManualModal = () => {
    setIsReadingFirmaEmpleadoManual(false);
    setSignatureEmpleadoKey((k) => k + 1);
    setIsFirmaEmpleadoManualModalVisible(true);
  };

  const closeFirmaEmpleadoManualModal = () => {
    setIsFirmaEmpleadoManualModalVisible(false);
    setIsReadingFirmaEmpleadoManual(false);
  };

  const clearFirmaEmpleadoManualInModal = () => {
    try {
      signatureEmpleadoRef.current?.clearSignature?.();
    } catch { }
    setIsReadingFirmaEmpleadoManual(false);
    setSignatureEmpleadoKey((k) => k + 1);
  };

  const acceptFirmaEmpleadoManual = () => {
    try {
      setIsReadingFirmaEmpleadoManual(true);
      signatureEmpleadoRef.current?.readSignature?.();
    } catch {
      setIsReadingFirmaEmpleadoManual(false);
      Alert.alert('Error', 'No se pudo leer la firma. Intenta nuevamente.');
    }
  };

  const handleFirmaEmpleadoManualRead = (signature: string) => {
    const sig = String(signature || '').trim();
    if (!sig || sig.length < 10) {
      Alert.alert('Error', 'No se detectó la firma. Intenta de nuevo.');
      setIsReadingFirmaEmpleadoManual(false);
      return;
    }

    // Guardar la firma tal como viene del SignatureScreen (ya incluye el prefijo data:image/png;base64,)
    setFirmaEmpleadoManual(sig);
    setIsReadingFirmaEmpleadoManual(false);
    closeFirmaEmpleadoManualModal();
  };

  const safeParseJsonArray = <T,>(value?: string | null): T[] => {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  };

  type MarcaContext = {
    current: Record<string, any> | null;
    roleName: string | null;
    isOperativo: boolean;
    marcaEmpresaId: number | null;
    marcaClienteId: number | null;
    marcaContratoId: number | null;
    marcaCorpoId: number | null;
    marcaPuestoId: number | null;
    /** Set when `syncListFilters` y no OPERATIVO; usar en el primer fetch si el estado aún no hizo flush. */
    syncedFilterCorpoId: number | null;
  };

  const loadMarcaContext = async (opts?: { syncListFilters?: boolean }): Promise<MarcaContext> => {
    const syncListFilters = opts?.syncListFilters === true;
    const empty: MarcaContext = {
      current: null,
      roleName: null,
      isOperativo: false,
      marcaEmpresaId: null,
      marcaClienteId: null,
      marcaContratoId: null,
      marcaCorpoId: null,
      marcaPuestoId: null,
      syncedFilterCorpoId: null,
    };
    const currentMarcaStr = await AsyncStorage.getItem('current_marca');
    if (!currentMarcaStr) {
      setHasCurrentMarca(false);
      setMarcaEmpresaId(null);
      setMarcaClienteId(null);
      setMarcaContratoId(null);
      setMarcaCorpoId(null);
      setMarcaPuestoId(null);
      setRoleName(null);
      return empty;
    }
    try {
      const current = JSON.parse(currentMarcaStr);
      if (!current) {
        setHasCurrentMarca(false);
        setRoleName(null);
        return empty;
      }
      setHasCurrentMarca(true);
      const empresaIdRaw = current?.empresa?.id ?? current?.empresa_id;
      const clienteIdRaw = current?.cliente?.id ?? current?.cliente_id;
      const contratoIdRaw = current?.contrato?.id ?? current?.contrato_id;
      const corpoIdRaw = current?.corpo?.id ?? current?.corpo_id;
      const puestoIdRaw = current?.puesto?.id ?? current?.puesto_id;
      const me = empresaIdRaw !== undefined && empresaIdRaw !== null ? Number(empresaIdRaw) : null;
      const mc = clienteIdRaw !== undefined && clienteIdRaw !== null ? Number(clienteIdRaw) : null;
      const mct = contratoIdRaw !== undefined && contratoIdRaw !== null ? Number(contratoIdRaw) : null;
      const mco = corpoIdRaw !== undefined && corpoIdRaw !== null ? Number(corpoIdRaw) : null;
      const mp = puestoIdRaw !== undefined && puestoIdRaw !== null ? Number(puestoIdRaw) : null;
      setMarcaEmpresaId(me);
      setMarcaClienteId(mc);
      setMarcaContratoId(mct);
      setMarcaCorpoId(mco);
      setMarcaPuestoId(mp);
      const rnRaw =
        current?.roleDivision?.role?.nombre ?? current?.role_division?.role?.nombre ?? null;
      const rn = typeof rnRaw === 'string' ? rnRaw : null;
      setRoleName(rn);
      const isOperativo = rn === 'OPERATIVO';

      let syncedFilterCorpoId: number | null = null;
      if (syncListFilters && !isOperativo && current?.id) {
        setFilterEmpresaId(numOrNull(current?.empresa?.id));
        setFilterClienteId(numOrNull(current?.cliente?.id));
        setFilterDivisionId(getDivisionIdFromMarcaJson(current));
        setFilterContratoId(numOrNull(current?.contrato?.id));
        syncedFilterCorpoId = numOrNull(current?.corpo?.id);
        setFilterCorpoId(syncedFilterCorpoId);
      }

      return {
        current,
        roleName: rn,
        isOperativo,
        marcaEmpresaId: me,
        marcaClienteId: mc,
        marcaContratoId: mct,
        marcaCorpoId: mco,
        marcaPuestoId: mp,
        syncedFilterCorpoId,
      };
    } catch {
      setHasCurrentMarca(false);
      setMarcaEmpresaId(null);
      setMarcaClienteId(null);
      setMarcaContratoId(null);
      setMarcaCorpoId(null);
      setMarcaPuestoId(null);
      setRoleName(null);
      return { ...empty, syncedFilterCorpoId: null };
    }
  };

  const fetchMainStructure = useCallback(async () => {
    setIsStructureLoading(true);
    setIsLoadingStructure(true);
    try {
      const merged = await loadMainStructureTreeMerged();
      if (Array.isArray(merged) && merged.length > 0) {
        setStructure(merged as MainStructureEmpresa[]);
        return;
      }
      const structureCacheStr = await AsyncStorage.getItem('main_structure_cache');
      if (structureCacheStr) {
        try {
          const parsed = JSON.parse(structureCacheStr);
          if (Array.isArray(parsed)) setStructure(parsed);
        } catch {
          setStructure([]);
        }
      } else {
        setStructure([]);
      }
    } catch (error) {
      console.error('Error fetching main structure (InductionTour):', error);
      const structureCacheStr = await AsyncStorage.getItem('main_structure_cache');
      if (structureCacheStr) {
        try {
          const parsed = JSON.parse(structureCacheStr);
          if (Array.isArray(parsed)) setStructure(parsed);
        } catch {
          setStructure([]);
        }
      } else {
        setStructure([]);
      }
    } finally {
      setIsStructureLoading(false);
      setIsLoadingStructure(false);
    }
  }, []);

  // Nodos computados para filtros jerárquicos
  const filterEmpresas = useMemo(() => (Array.isArray(structure) ? structure : []), [structure]);

  const filterClientes = useMemo(() => {
    const empresa = filterEmpresas.find((e: any) => e.id === filterEmpresaId);
    return empresa?.clientes || [];
  }, [filterEmpresas, filterEmpresaId]);

  const filterDivisiones = useMemo(() => {
    const cliente = filterClientes.find((c: any) => c.id === filterClienteId);
    if (!cliente) return [];
    return getDivisionesFromCliente(cliente);
  }, [filterClientes, filterClienteId]);

  const filterContratos = useMemo(() => {
    if (!filterClienteId) return [];
    const cliente = filterClientes.find((c: any) => c.id === filterClienteId);
    if (!cliente) return [];
    const divisiones = getDivisionesFromCliente(cliente);

    // Si hay división seleccionada, solo mostrar contratos de esa división
    if (filterDivisionId) {
      const division = divisiones.find((d: any) => d.id === filterDivisionId);
      return division?.contratos || [];
    }

    // Si no hay división seleccionada, recopilar todos los contratos de todas las divisiones del cliente
    const contratos: any[] = [];
    divisiones.forEach((division: any) => {
      division.contratos?.forEach((contrato: any) => {
        if (!contratos.find(c => c.id === contrato.id)) {
          contratos.push(contrato);
        }
      });
    });
    return contratos;
  }, [filterClientes, filterClienteId, filterDivisionId]);

  const filterSucursales = useMemo(() => {
    const contrato = filterContratos.find((c: any) => c.id === filterContratoId);
    return contrato?.sucursales || [];
  }, [filterContratos, filterContratoId]);

  useEffect(() => {
    filterCorpoIdRef.current = filterCorpoId;
  }, [filterCorpoId]);

  const applyFormDivisionSideEffects = useCallback((divisionId: number | null) => {
    if (divisionId === 4) setDivision('Seguridad');
    else if (divisionId === 5) setDivision('Aseo y limpieza');
    else setDivision('Otros');
    const temasPredefinidos: TemaDesarrollado[] = TEMAS_PREDEFINIDOS.map((tema) => ({
      tema,
      respuesta: '',
      comentarios: '',
    }));
    setTemasDesarrollados(temasPredefinidos);
    setExpandedTemaIndices(temasPredefinidos.map((_, i) => i));
    const aspectosPredefinidos: AspectoEspecifico[] = ASPECTOS_PREDEFINIDOS.map((aspecto) => ({
      aspecto,
      respuesta: '',
      comentarios: '',
    }));
    setAspectosEspecificos(aspectosPredefinidos);
    setExpandedAspectoIndices(aspectosPredefinidos.map((_, i) => i));
  }, []);

  // Nodos computados para jerarquía del formulario
  const formEmpresas = useMemo(() => (Array.isArray(structure) ? structure : []), [structure]);

  const formClientes = useMemo(() => {
    const empresa = formEmpresas.find((e: any) => e.id === formEmpresaId);
    return empresa?.clientes || [];
  }, [formEmpresas, formEmpresaId]);

  const formDivisiones = useMemo(() => {
    const cliente = formClientes.find((c: any) => c.id === formClienteId);
    return cliente ? getDivisionesFromCliente(cliente) : [];
  }, [formClientes, formClienteId]);

  const formContratos = useMemo(() => {
    if (!formClienteId) return [];
    const cliente = formClientes.find((c: any) => c.id === formClienteId);
    if (!cliente) return [];
    const divisiones = getDivisionesFromCliente(cliente);

    // Si hay división seleccionada, solo mostrar contratos de esa división
    if (formDivisionId) {
      const division = divisiones.find((d: any) => d.id === formDivisionId);
      return division?.contratos || [];
    }

    // Si no hay división seleccionada, recopilar todos los contratos de todas las divisiones del cliente
    const contratos: any[] = [];
    divisiones.forEach((division: any) => {
      division.contratos?.forEach((contrato: any) => {
        if (!contratos.find(c => c.id === contrato.id)) {
          contratos.push(contrato);
        }
      });
    });
    return contratos;
  }, [formClientes, formClienteId, formDivisionId]);

  const formSucursales = useMemo(() => {
    const contrato = formContratos.find((c: any) => c.id === formContratoId);
    return contrato?.sucursales || [];
  }, [formContratos, formContratoId]);

  const formPuestos = useMemo(() => {
    const sucursal = formSucursales.find((s: any) => s.id === formCorpoId);
    return sucursal?.puestos || [];
  }, [formSucursales, formCorpoId]);

  const formPlazas = useMemo(() => {
    const puesto = formPuestos.find((p: any) => p.id === formPuestoId);
    return puesto?.plazas || [];
  }, [formPuestos, formPuestoId]);

  const formEmpleados = useMemo(() => {
    const plaza = formPlazas.find((p: MainStructurePlaza) => p.id === formPlazaId);
    return plaza?.empleados || [];
  }, [formPlazas, formPlazaId]);

  const fetchRecords = useCallback(async (listOpts?: { corpoId?: number | null }) => {
    try {
      setIsLoading(true);
      setError(null);

      const ctx = await loadMarcaContext();
      const isOperativo = ctx.isOperativo;
      const corpoId =
        isOperativo
          ? ctx.marcaCorpoId
          : listOpts && Object.prototype.hasOwnProperty.call(listOpts, 'corpoId')
            ? listOpts.corpoId
            : numOrNull(filterCorpoIdRef.current) ?? filterCorpoId;

      // Solo listar cuando hay sucursal (corpo): OPERATIVO desde current_marca; resto desde filtro jerárquico al elegir "Sucursal".
      if (isOperativo) {
        if (!ctx.current || !corpoId) {
          setError('No se encontró marca activa o sucursal (corpo) en la sesión');
          setRecords([]);
          setIsLoading(false);
          return;
        }
      } else {
        if (!corpoId) {
          setError('Seleccione una sucursal en los filtros jerárquicos');
          setRecords([]);
          setIsLoading(false);
          return;
        }
      }

      const puestoIdForList = isOperativo ? ctx.marcaPuestoId ?? undefined : undefined;

      const isConnected = await getConnectionStatus();

      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
      const cache = cacheStr ? JSON.parse(cacheStr) : [];
      const rawLocal: InductionTourRecord[] = (cache || []).filter((item: any) => item.type === 'induction_tour_record');
      const localRecordsForCorpo = rawLocal.filter((r) => {
        const rc = (r as any).corpo_id;
        if (rc == null || rc === '') return false;
        if (Number(rc) !== Number(corpoId)) return false;
        return inductionTourRowVisibleInList(r);
      });

      const sliceForUi = (merged: any[]) =>
        sortInductionTourRecordsDesc(
          merged.filter(
            (item: any) =>
              item.type === 'induction_tour_record' &&
              item.corpo_id != null &&
              item.corpo_id !== '' &&
              Number(item.corpo_id) === Number(corpoId) &&
              inductionTourRowVisibleInList(item)
          ) as InductionTourRecord[]
        );

      if (isConnected) {
        // El API prioriza `puesto_id` sobre `corpo_id`; no enviamos empresa/cliente/contrato para forzar búsqueda por sucursal (y puesto si aplica).
        const result = await listInductionTourRecords({
          corpo_id: corpoId || undefined,
          puesto_id: puestoIdForList,
          refreshAccessToken,
          logout,
        });

        if (result.status && result.data) {
          const serverRecords = result.data as InductionTourRecord[];
          const merged = mergeEvaluationsCacheInductionTourForCorpo(cache, serverRecords, corpoId);
          await AsyncStorage.setItem('evaluations_cache', JSON.stringify(merged));
          setRecords(sliceForUi(merged));
        } else {
          const unsynced = localRecordsForCorpo.filter((r) => r.synced === false);
          setRecords(sortInductionTourRecordsDesc(unsynced));
        }
      } else {
        setRecords(sortInductionTourRecordsDesc(localRecordsForCorpo));
      }
    } catch (err) {
      console.error('Error fetching records:', err);
      setError('Error al cargar los registros de inducción y recorrido');
      try {
        const ctx = await loadMarcaContext();
        const corpoId = ctx.isOperativo ? ctx.marcaCorpoId : numOrNull(filterCorpoIdRef.current) ?? filterCorpoId;
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr && corpoId) {
          const cache = JSON.parse(cacheStr);
          const recordsCache = sortInductionTourRecordsDesc(
            (cache as any[])
              .filter((item: any) => item.type === 'induction_tour_record')
              .filter((item: any) => item.corpo_id != null && Number(item.corpo_id) === Number(corpoId))
              .filter((item: any) => inductionTourRowVisibleInList(item)) as InductionTourRecord[]
          );
          setRecords(recordsCache);
        }
      } catch (cacheErr) {
        console.error('Error loading from cache:', cacheErr);
      }
    } finally {
      setIsLoading(false);
    }
  }, [refreshAccessToken, logout, filterCorpoId, marcaCorpoId, marcaPuestoId]);

  const handleFilterHierarchyChange = useCallback((v: HierarchyPickerValues) => {
    setFilterEmpresaId(v.empresaId);
    setFilterClienteId(v.clienteId);
    setFilterDivisionId(v.divisionId);
    setFilterContratoId(v.contratoId);
    filterCorpoIdRef.current = v.sucursalId;
    setFilterCorpoId(v.sucursalId);
    if (v.sucursalId != null) {
      void fetchRecords({ corpoId: v.sucursalId });
    }
  }, [fetchRecords]);

  const handleFormHierarchyChange = useCallback(
    (v: HierarchyPickerValues) => {
      const divisionChanged = v.divisionId !== formDivisionId;
      const empresaOrClienteChanged = v.empresaId !== formEmpresaId || v.clienteId !== formClienteId;
      const plazaChanged = v.plazaId !== formPlazaId;

      setFormEmpresaId(v.empresaId);
      setFormClienteId(v.clienteId);
      setFormContratoId(v.contratoId);
      setFormCorpoId(v.sucursalId);
      setFormPuestoId(v.puestoId ?? null);

      if (empresaOrClienteChanged) {
        setDivision('Otros');
      }
      setFormDivisionId(v.divisionId);
      if (divisionChanged) {
        applyFormDivisionSideEffects(v.divisionId);
      }

      setFormPlazaId(v.plazaId ?? null);
      if (plazaChanged) {
        setSelectedEmpleadoId(null);
        empleadoIdRef.current = null;
        setFirmaEmpleado(null);
        setFirmaEmpleadoHash(null);
        setFirmaEmpleadoManual(null);
        setFirmaEmpleadoWarning(null);
      }
    },
    [formDivisionId, formEmpresaId, formClienteId, formPlazaId, applyFormDivisionSideEffects]
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        let fetchListOpts: { corpoId?: number | null } | undefined;
        if (!listFiltersSyncedFromMarcaOnceRef.current) {
          const marcaStr = await AsyncStorage.getItem('current_marca');
          const currentMarca = marcaStr ? JSON.parse(marcaStr) : null;
          const ctxFirst = await loadMarcaContext({ syncListFilters: !!(currentMarca?.id) });
          listFiltersSyncedFromMarcaOnceRef.current = true;
          if (!ctxFirst.isOperativo) fetchListOpts = { corpoId: ctxFirst.syncedFilterCorpoId };
        } else {
          await loadMarcaContext();
        }
        if (cancelled) return;
        if (!hasFetchedStructureRef.current) {
          await fetchMainStructure();
          hasFetchedStructureRef.current = true;
        }
        if (!cancelled) await fetchRecords(fetchListOpts);
      })();
      const onRestored = () => void fetchRecords();
      eventBus.on('connectionRestored', onRestored);
      return () => {
        cancelled = true;
        eventBus.off('connectionRestored', onRestored);
      };
    }, [fetchRecords, fetchMainStructure])
  );

  const resetForm = async () => {
    const horaAccion = await getHoraAccion();
    if (!horaAccion) {
      Alert.alert('Error', 'No se pudo obtener la hora');
      return;
    }
    setFecha(new Date(horaAccion));
    setDivision('Otros');
    setRenglonEdificio('');
    setSupervisorCliente('');
    setSupervisorCorporacion('');
    // Resetear jerarquía del formulario
    setFormEmpresaId(null);
    setFormClienteId(null);
    setFormDivisionId(null);
    setFormContratoId(null);
    setFormCorpoId(null);
    setFormPuestoId(null);
    setFormPlazaId(null);
    // Resetear empleado y firma
    setSelectedEmpleadoId(null);
    empleadoIdRef.current = null;
    setFirmaEmpleado(null);
    setFirmaEmpleadoHash(null);
    setFirmaEmpleadoManual(null);
    setFirmaEmpleadoWarning(null);
    // Cargar temas predefinidos
    const temasPredefinidos: TemaDesarrollado[] = TEMAS_PREDEFINIDOS.map(tema => ({
      tema: tema,
      respuesta: 'SI',
      comentarios: '',
    }));
    setTemasDesarrollados(temasPredefinidos);
    setExpandedTemaIndices(temasPredefinidos.map((_, i) => i));
    // Cargar aspectos predefinidos
    const aspectosPredefinidos: AspectoEspecifico[] = ASPECTOS_PREDEFINIDOS.map(aspecto => ({
      aspecto: aspecto,
      respuesta: 'SI',
      comentarios: '',
    }));
    setAspectosEspecificos(aspectosPredefinidos);
    setExpandedAspectoIndices(aspectosPredefinidos.map((_, i) => i));
    setParticipantes([]);
    setFirmaSupervisor(null);
    setFirmaResponsableHash('');
    setExpandedParticipanteIndices([]);
    setExpandedFirmaResponsableIds([]);
  };

  const applyCurrentMarcaToFormHierarchy = async () => {
    try {
      const str = await AsyncStorage.getItem('current_marca');
      if (!str) return;
      const marca = JSON.parse(str);
      setFormEmpresaId(numOrNull(marca.empresa?.id ?? marca.empresa_id));
      setFormClienteId(numOrNull(marca.cliente?.id ?? marca.cliente_id));
      setFormDivisionId(getDivisionIdFromMarcaJson(marca));
      setFormContratoId(numOrNull(marca.contrato?.id ?? marca.contrato_id));
      setFormCorpoId(numOrNull(marca.corpo?.id ?? marca.corpo_id));
      setFormPuestoId(numOrNull(marca.puesto?.id ?? marca.puesto_id));
      setFormPlazaId(numOrNull(marca.plaza?.id ?? marca.plaza_id));
      const empFromMarca = numOrNull(marca.empleado?.id ?? marca.empleado_id);
      if (empFromMarca != null) {
        setSelectedEmpleadoId(empFromMarca);
        empleadoIdRef.current = empFromMarca;
      }
    } catch (e) {
      console.error('applyCurrentMarcaToFormHierarchy (InductionTour):', e);
    }
  };

  const startCreating = async () => {
    setIsCreating(true);
    setEditingRecord(null);
    await resetForm();
    await applyCurrentMarcaToFormHierarchy();
  };

  const cancelCreating = async () => {
    setIsCreating(false);
    await resetForm();
  };

  const startEditing = (record: InductionTourRecord) => {
    setIsCreating(false);
    let temasArray: TemaDesarrollado[] = [];
    let aspectosArray: AspectoEspecifico[] = [];
    let participantesArray: Participante[] = [];

    if (record.temas_desarrollados) {
      try {
        temasArray = JSON.parse(record.temas_desarrollados);
        if (!Array.isArray(temasArray)) temasArray = [];
      } catch (e) {
        temasArray = [];
      }
    }

    if (record.aspectos_especificos) {
      try {
        aspectosArray = JSON.parse(record.aspectos_especificos);
        if (!Array.isArray(aspectosArray)) aspectosArray = [];
      } catch (e) {
        aspectosArray = [];
      }
    }

    if (record.participantes) {
      try {
        participantesArray = JSON.parse(record.participantes);
        if (!Array.isArray(participantesArray)) participantesArray = [];
      } catch (e) {
        participantesArray = [];
      }
    }

    const recordAny = record as any;
    const empresaIdRaw = recordAny.empresa_id != null ? Number(recordAny.empresa_id) : null;
    const clienteIdRaw = recordAny.cliente_id != null ? Number(recordAny.cliente_id) : null;
    const contratoIdRaw = recordAny.contrato_id != null ? Number(recordAny.contrato_id) : null;
    const corpoIdRaw = recordAny.corpo_id != null ? Number(recordAny.corpo_id) : null;
    const puestoIdRaw = recordAny.puesto_id != null ? Number(recordAny.puesto_id) : null;
    const plazaIdRaw = recordAny.plaza_id != null ? Number(recordAny.plaza_id) : null;
    const empleadoIdRaw = recordAny.empleado_id != null ? Number(recordAny.empleado_id) : null;

    const divisionName = record.division || 'Otros';
    const tree = Array.isArray(structure) ? structure : [];
    const path =
      tree.length && (empleadoIdRaw != null || plazaIdRaw != null)
        ? findHierarchyByEmpleadoYPlaza(tree, empleadoIdRaw, plazaIdRaw)
        : null;

    if (path) {
      setFormEmpresaId(path.empresaId);
      setFormClienteId(path.clienteId);
      setFormDivisionId(path.divisionId);
      setFormContratoId(path.contratoId);
      setFormCorpoId(path.corpoId);
      setFormPuestoId(path.puestoId);
      setFormPlazaId(path.plazaId);
    } else {
      const byPuesto =
        tree.length && puestoIdRaw != null && corpoIdRaw != null
          ? findHierarchyByPuestoYCorpo(tree, puestoIdRaw, corpoIdRaw)
          : null;
      if (byPuesto) {
        setFormEmpresaId(byPuesto.empresaId);
        setFormClienteId(byPuesto.clienteId);
        setFormDivisionId(byPuesto.divisionId);
        setFormContratoId(byPuesto.contratoId);
        setFormCorpoId(byPuesto.corpoId);
        setFormPuestoId(byPuesto.puestoId);
        setFormPlazaId(plazaIdRaw);
      } else {
        setFormEmpresaId(empresaIdRaw);
        setFormClienteId(clienteIdRaw);
        let divisionIdFound: number | null = null;
        if (empresaIdRaw != null && clienteIdRaw != null && contratoIdRaw != null) {
          const empresa = tree.find((e: any) => e.id === empresaIdRaw);
          const cliente = empresa?.clientes?.find((c: any) => c.id === clienteIdRaw);
          const divisiones = cliente ? getDivisionesFromCliente(cliente) : [];
          for (const div of divisiones) {
            const hasContrato = div.contratos?.some((c: any) => c.id === contratoIdRaw);
            if (hasContrato) {
              divisionIdFound = div.id;
              break;
            }
          }
        }
        setFormDivisionId(divisionIdFound);
        setFormContratoId(contratoIdRaw);
        setFormCorpoId(corpoIdRaw);
        setFormPuestoId(puestoIdRaw);
        setFormPlazaId(plazaIdRaw);
      }
    }
    setDivision(divisionName);

    setEditingRecord({
      id: record.id ? String(record.id) : null,
      id_local: record.id_local,
      fecha: record.fecha || '',
      division: divisionName,
      renglon_edificio: record.renglon_edificio || '',
      supervisor_cliente: record.supervisor_cliente || '',
      supervisor_corporacion: record.supervisor_corporacion || '',
      temas_desarrollados: temasArray,
      aspectos_especificos: aspectosArray,
      participantes: participantesArray,
      firma_supervisor: record.firma_supervisor || '',
      firma_responsable: record.firma_responsable || '',
    });

    setRenglonEdificio(record.renglon_edificio || '');
    setSupervisorCliente(record.supervisor_cliente || '');
    setSupervisorCorporacion(record.supervisor_corporacion || '');
    if (record.fecha) {
      const fechaStr = String(record.fecha);
      if (fechaStr.includes('/')) {
        const dateParts = fechaStr.split('/');
        if (dateParts.length === 3) {
          setFecha(new Date(parseInt(dateParts[2]), parseInt(dateParts[1]) - 1, parseInt(dateParts[0])));
        }
      } else {
        const d = new Date(fechaStr);
        if (!Number.isNaN(d.getTime())) setFecha(d);
      }
    }
    setTemasDesarrollados(temasArray);
    setAspectosEspecificos(aspectosArray);
    setParticipantes(participantesArray);
    setFirmaSupervisor(formatSignatureForDisplay(record.firma_supervisor));
    setFirmaResponsableHash(record.firma_responsable || '');

    // Cargar empleado_id y firma_empleado si existen
    if (recordAny.empleado_id) {
      const empId = Number(recordAny.empleado_id);
      setSelectedEmpleadoId(empId);
      empleadoIdRef.current = empId;
    } else {
      setSelectedEmpleadoId(null);
      empleadoIdRef.current = null;
    }

    // firma_empleado ahora contiene la firma manual dibujada (no el hash QR)
    if (recordAny.firma_empleado) {
      setFirmaEmpleadoManual(formatSignatureForDisplay(recordAny.firma_empleado));
    } else {
      setFirmaEmpleadoManual(null);
    }

    // Limpiar estados de QR ya que no se guarda
    setFirmaEmpleado(null);
    setFirmaEmpleadoHash(null);

    setFirmaEmpleadoWarning(null);
    setExpandedTemaIndices(temasArray.map((_, i) => i));
    setExpandedAspectoIndices(aspectosArray.map((_, i) => i));
    setExpandedParticipanteIndices(participantesArray.map((_, i) => i));
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
      setFecha(selectedDate);
    }
  };

  const addTema = () => {
    const newTema: TemaDesarrollado = {
      tema: '',
      respuesta: 'SI',
      comentarios: '',
    };
    setTemasDesarrollados([...temasDesarrollados, newTema]);
    setExpandedTemaIndices([...expandedTemaIndices, temasDesarrollados.length]);
  };

  const updateTema = (index: number, field: keyof TemaDesarrollado, value: string) => {
    const newTemas = [...temasDesarrollados];
    newTemas[index] = {
      ...newTemas[index],
      [field]: value,
    };
    setTemasDesarrollados(newTemas);
  };

  const removeTema = (index: number) => {
    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas eliminar este tema?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            setTemasDesarrollados(temasDesarrollados.filter((_, i) => i !== index));
            setExpandedTemaIndices(expandedTemaIndices.filter(i => i !== index).map(i => i > index ? i - 1 : i));
          },
        },
      ]
    );
  };

  const toggleTemaExpansion = (index: number) => {
    setExpandedTemaIndices(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const addAspecto = () => {
    const newAspecto: AspectoEspecifico = {
      aspecto: '',
      respuesta: 'SI',
      comentarios: '',
    };
    setAspectosEspecificos([...aspectosEspecificos, newAspecto]);
    setExpandedAspectoIndices([...expandedAspectoIndices, aspectosEspecificos.length]);
  };

  const updateAspecto = (index: number, field: keyof AspectoEspecifico, value: string) => {
    const newAspectos = [...aspectosEspecificos];
    newAspectos[index] = {
      ...newAspectos[index],
      [field]: value,
    };
    setAspectosEspecificos(newAspectos);
  };

  const removeAspecto = (index: number) => {
    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas eliminar este aspecto?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            setAspectosEspecificos(aspectosEspecificos.filter((_, i) => i !== index));
            setExpandedAspectoIndices(expandedAspectoIndices.filter(i => i !== index).map(i => i > index ? i - 1 : i));
          },
        },
      ]
    );
  };

  const toggleAspectoExpansion = (index: number) => {
    setExpandedAspectoIndices(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const addParticipante = () => {
    const newParticipante: Participante = {
      nombre_completo: '',
      cedula: '',
      firma: null,
    };
    setParticipantes([...participantes, newParticipante]);
    setExpandedParticipanteIndices([...expandedParticipanteIndices, participantes.length]);
  };

  const updateParticipante = (index: number, field: keyof Participante, value: string | null) => {
    const newParticipantes = [...participantes];
    newParticipantes[index] = {
      ...newParticipantes[index],
      [field]: value,
    };
    setParticipantes(newParticipantes);
  };

  const removeParticipante = (index: number) => {
    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas eliminar este participante?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            setParticipantes(participantes.filter((_, i) => i !== index));
            setExpandedParticipanteIndices(expandedParticipanteIndices.filter(i => i !== index).map(i => i > index ? i - 1 : i));
          },
        },
      ]
    );
  };

  const toggleParticipanteExpansion = (index: number) => {
    setExpandedParticipanteIndices(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const openSignatureModal = (type: 'supervisor' | { type: 'participante', index: number }) => {
    setCurrentSignatureType(type);
    setIsSignatureModalVisible(true);
    setSignatureKey(prev => prev + 1);
  };

  const closeSignatureModal = () => {
    setIsSignatureModalVisible(false);
    setCurrentSignatureType(null);
  };

  const clearSignatureInModal = () => {
    setSignatureKey(prev => prev + 1);
    if (signatureRef.current) {
      signatureRef.current.clearSignature();
    }
  };

  const handleSignatureRead = (signature: string) => {
    if (signature && currentSignatureType) {
      let formattedSignature = signature;
      if (!signature.startsWith('data:')) {
        formattedSignature = `data:image/png;base64,${signature}`;
      }

      if (currentSignatureType === 'supervisor') {
        setFirmaSupervisor(formattedSignature);
      } else if (currentSignatureType.type === 'participante') {
        updateParticipante(currentSignatureType.index, 'firma', formattedSignature);
      }
      setIsSignatureModalVisible(false);
      setCurrentSignatureType(null);
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

  const validateSaveCreate = async (): Promise<string | null> => {
    const currentMarca = await AsyncStorage.getItem('current_marca');
    if (!currentMarca) return 'No se encontró la marca actual';
    if (!formEmpresaId || !formClienteId || !formContratoId || !formCorpoId || !formPuestoId || !formPlazaId) {
      return 'Seleccione empresa, cliente, contrato, sucursal, puesto y plaza';
    }
    if (!formDivisionId) return 'División es obligatoria';
    if (!firmaResponsableHash || !firmaResponsableHash.trim()) return 'Firma responsable (QR/Generar) es obligatoria';
    if (!selectedEmpleadoId || !empleadoIdRef.current) return 'Empleado es obligatorio';
    return null;
  };

  const handleSaveCreate = () => {
    void (async () => {
      const err = await validateSaveCreate();
      if (err) {
        Alert.alert('Error', err);
        return;
      }
      Alert.alert('Confirmar', '¿Desea guardar el registro de inducción y recorrido?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Aceptar', onPress: () => void executeSaveCreate() },
      ]);
    })();
  };

  const executeSaveCreate = async () => {
    setIsSubmitting(true);
    setSubmitResponse(null);
    try {
      const err = await validateSaveCreate();
      if (err) {
        Alert.alert('Error', err);
        return;
      }
      const currentMarcaStr = await AsyncStorage.getItem('current_marca');
      const currentMarcaData = JSON.parse(currentMarcaStr!);

      const requestData = {
        marca_id: currentMarcaData.id,
        empresa_id: formEmpresaId,
        cliente_id: formClienteId,
        division_id: formDivisionId,
        contrato_id: formContratoId,
        corpo_id: formCorpoId,
        puesto_id: formPuestoId || null,
        plaza_id: formPlazaId,
        empleado_id: empleadoIdRef.current,
        fecha: formatDateForRequest(fecha) || null,
        division: division.trim(),
        renglon_edificio: renglonEdificio.trim() || null,
        supervisor_cliente: supervisorCliente.trim() || null,
        supervisor_corporacion: supervisorCorporacion.trim() || null,
        temas_desarrollados: temasDesarrollados.length > 0 ? JSON.stringify(temasDesarrollados) : null,
        aspectos_especificos: aspectosEspecificos.length > 0 ? JSON.stringify(aspectosEspecificos) : null,
        participantes:
          participantes.length > 0
            ? JSON.stringify(
                participantes.map((p) => ({
                  ...p,
                  firma: getBase64Only(p.firma),
                }))
              )
            : null,
        firma_supervisor: getBase64Only(firmaSupervisor),
        firma_empleado: firmaEmpleadoManual ? String(firmaEmpleadoManual).trim() : '',
        firma_responsable: firmaResponsableHash.trim(),
      };

      const isConnected = await getConnectionStatus();

      if (isConnected) {
        const result = await createInductionTourRecord({
          requestData,
          refreshAccessToken,
          logout,
        });

        if (result.status) {
          try {
            if (result.data && (result.data as any).corpo_id != null) {
              const d = result.data as any;
              const cid = Number(d.corpo_id);
              const cacheStr = await AsyncStorage.getItem('evaluations_cache');
              const cache = cacheStr ? JSON.parse(cacheStr) : [];
              const serverRow: InductionTourRecord = {
                ...d,
                id: d.id,
                id_local: '',
                type: 'induction_tour_record',
                synced: true,
                isActive: d.isActive !== false,
              } as any;
              const merged = mergeEvaluationsCacheInductionTourForCorpo(cache, [serverRow], cid);
              await AsyncStorage.setItem('evaluations_cache', JSON.stringify(merged));
            }
          } catch (e) {
            console.warn('InductionTour cache merge after create:', e);
          }
          Alert.alert('Éxito', result.message || 'Registro de inducción y recorrido guardado correctamente');
          setTimeout(() => {
            cancelCreating();
            fetchRecords();
          }, 2000);
        } else {
          Alert.alert('Error', result.message || 'Error al guardar el registro de inducción y recorrido');
        }
      } else {
        const localId = generateRandomId();

        const actionsStr = await AsyncStorage.getItem('evaluations_actions');
        const actions = actionsStr ? JSON.parse(actionsStr) : [];
        actions.push({
          id: localId,
          action: 'create',
          type: 'induction_tour_record',
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

        const newRecordCache: InductionTourRecord = {
          id: '',
          id_local: localId,
          fecha: formatDateForRequest(fecha) || null,
          division: division.trim(),
          renglon_edificio: renglonEdificio.trim() || null,
          supervisor_cliente: supervisorCliente.trim() || null,
          supervisor_corporacion: supervisorCorporacion.trim() || null,
          temas_desarrollados: temasDesarrollados.length > 0 ? JSON.stringify(temasDesarrollados) : null,
          aspectos_especificos: aspectosEspecificos.length > 0 ? JSON.stringify(aspectosEspecificos) : null,
          participantes:
            participantes.length > 0
              ? JSON.stringify(
                  participantes.map((p) => ({
                    ...p,
                    firma: getBase64Only(p.firma),
                  }))
                )
              : null,
          firma_supervisor: getBase64Only(firmaSupervisor),
          firma_responsable: firmaResponsableHash.trim(),
          created_at: new Date(horaAccion).toISOString(),
          synced: false,
        };
        (newRecordCache as any).empleado_id = empleadoIdRef.current;
        (newRecordCache as any).firma_empleado = firmaEmpleadoManual ? String(firmaEmpleadoManual).trim() : '';
        (newRecordCache as any).empresa_id = formEmpresaId;
        (newRecordCache as any).cliente_id = formClienteId;
        (newRecordCache as any).contrato_id = formContratoId;
        (newRecordCache as any).corpo_id = formCorpoId;
        (newRecordCache as any).puesto_id = formPuestoId;
        (newRecordCache as any).plaza_id = formPlazaId;
        (newRecordCache as any).isActive = true;

        cache.push({ ...newRecordCache, type: 'induction_tour_record' });
        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(cache));

        Alert.alert('Éxito', 'Registro de inducción y recorrido registrado localmente. Se sincronizará cuando haya conexión.');
        setTimeout(() => {
          cancelCreating();
          fetchRecords();
        }, 2000);
      }
    } catch (err) {
      console.error('Error saving record:', err);
      Alert.alert('Error', 'No se pudo guardar el registro de inducción y recorrido');
    } finally {
      setIsSubmitting(false);
    }
  };

  const validateSaveUpdate = (): string | null => {
    if (!editingRecord) return 'No hay registro en edición';
    const recordId = editingRecord.id || editingRecord.id_local;
    if (!recordId) return 'ID de registro no encontrado para actualizar';
    if (!formEmpresaId || !formClienteId || !formContratoId || !formCorpoId || !formPuestoId || !formPlazaId) {
      return 'Seleccione empresa, cliente, contrato, sucursal, puesto y plaza';
    }
    if (!formDivisionId) return 'División es obligatoria';
    if (!firmaResponsableHash || !firmaResponsableHash.trim()) return 'Firma responsable (QR/Generar) es obligatoria';
    if (!selectedEmpleadoId || !empleadoIdRef.current) return 'Empleado es obligatorio';
    return null;
  };

  const handleSaveUpdate = () => {
    const err = validateSaveUpdate();
    if (err) {
      Alert.alert('Error', err);
      return;
    }
    Alert.alert('Confirmar', '¿Desea actualizar el registro de inducción y recorrido?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Aceptar', onPress: () => void executeSaveUpdate() },
    ]);
  };

  const executeSaveUpdate = async () => {
    if (!editingRecord) return;
    const recordId = editingRecord.id || editingRecord.id_local;
    if (!recordId) return;

    setIsSubmitting(true);
    setSubmitResponse(null);
    try {
      const err = validateSaveUpdate();
      if (err) {
        Alert.alert('Error', err);
        return;
      }

      const requestData = {
        empresa_id: formEmpresaId,
        cliente_id: formClienteId,
        division_id: formDivisionId,
        contrato_id: formContratoId,
        corpo_id: formCorpoId,
        puesto_id: formPuestoId || null,
        plaza_id: formPlazaId,
        empleado_id: empleadoIdRef.current,
        fecha: formatDateForRequest(fecha) || null,
        division: division.trim(),
        renglon_edificio: renglonEdificio.trim() || null,
        supervisor_cliente: supervisorCliente.trim() || null,
        supervisor_corporacion: supervisorCorporacion.trim() || null,
        temas_desarrollados: temasDesarrollados.length > 0 ? JSON.stringify(temasDesarrollados) : null,
        aspectos_especificos: aspectosEspecificos.length > 0 ? JSON.stringify(aspectosEspecificos) : null,
        participantes:
          participantes.length > 0
            ? JSON.stringify(
                participantes.map((p) => ({
                  ...p,
                  firma: getBase64Only(p.firma),
                }))
              )
            : null,
        firma_supervisor: getBase64Only(firmaSupervisor),
        firma_empleado: firmaEmpleadoManual ? String(firmaEmpleadoManual).trim() : '',
        firma_responsable: firmaResponsableHash.trim(),
      };

      const isConnected = await getConnectionStatus();

      if (isConnected) {
        const result = await updateInductionTourRecord({
          id: recordId,
          requestData,
          refreshAccessToken,
          logout,
        });

        if (result.status) {
          try {
            if (result.data) {
              const d = result.data as any;
              const cacheStr = await AsyncStorage.getItem('evaluations_cache');
              if (cacheStr) {
                const cache = JSON.parse(cacheStr);
                const updated = cache.map((item: any) => {
                  if (item.type !== 'induction_tour_record') return item;
                  if (String(item.id) === String(recordId) || String(item.id_local) === String(recordId)) {
                    return {
                      ...item,
                      ...d,
                      id: d.id ?? item.id,
                      type: 'induction_tour_record',
                      synced: true,
                      isActive: d.isActive !== false,
                    };
                  }
                  return item;
                });
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updated));
              }
            }
          } catch (e) {
            console.warn('InductionTour cache after update:', e);
          }
          Alert.alert('Éxito', result.message || 'Registro de inducción y recorrido actualizado correctamente');
          setTimeout(() => {
            cancelEditing();
            fetchRecords();
          }, 2000);
        } else {
          Alert.alert('Error', result.message || 'Error al actualizar el registro de inducción y recorrido');
        }
      } else {
        const actionsStr = await AsyncStorage.getItem('evaluations_actions');
        let actions: any[] = actionsStr ? JSON.parse(actionsStr) : [];

        const isLocal = String(editingRecord.id_local || '').startsWith('local-') && String(recordId).startsWith('local-');
        if (isLocal) {
          const lid = String(editingRecord.id_local);
          actions = actions.filter(
            (a: any) =>
              !(
                a.type === 'induction_tour_record' &&
                a.action === 'update' &&
                String(a.id) === lid
              )
          );
          const idx = actions.findIndex(
            (a: any) => a.id === editingRecord.id_local && a.action === 'create' && a.type === 'induction_tour_record'
          );
          if (idx !== -1) {
            actions[idx] = {
              ...actions[idx],
              payload: { ...(actions[idx].payload || {}), ...requestData },
              synced: false,
            };
          } else {
            const currentMarcaStr = await AsyncStorage.getItem('current_marca');
            const currentMarcaData = currentMarcaStr ? JSON.parse(currentMarcaStr) : null;
            actions.push({
              id: recordId,
              action: 'create',
              type: 'induction_tour_record',
              payload: {
                marca_id: currentMarcaData?.id,
                ...requestData,
                id_local: recordId,
              },
              synced: false,
            });
          }
          await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));
        } else {
          const filtered = actions.filter(
            (a: any) => !(a.id === recordId && a.action === 'update' && a.type === 'induction_tour_record')
          );
          filtered.push({
            id: recordId,
            action: 'update',
            type: 'induction_tour_record',
            payload: requestData,
            synced: false,
          });
          await AsyncStorage.setItem('evaluations_actions', JSON.stringify(filtered));
        }

        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const updatedCache = cache.map((item: any) => {
            if ((item.id === recordId || item.id_local === recordId) && item.type === 'induction_tour_record') {
              return {
                ...item,
                ...requestData,
                synced: false,
              };
            }
            return item;
          });
          await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
        }

        Alert.alert('Éxito', 'Registro de inducción y recorrido actualizado localmente. Se sincronizará cuando haya conexión.');
        setTimeout(() => {
          cancelEditing();
          fetchRecords();
        }, 2000);
      }
    } catch (err) {
      console.error('Error updating record:', err);
      Alert.alert('Error', 'No se pudo actualizar el registro de inducción y recorrido');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteRecordHandler = (record: InductionTourRecord) => {
    const recordId = record.id || record.id_local;
    if (!recordId) {
      Alert.alert('Error', 'ID de registro no encontrado para eliminar');
      return;
    }
    const rowKey = String(record.id || record.id_local || '');
    Alert.alert('Confirmar', '¿Estás seguro de que deseas eliminar este registro de inducción y recorrido?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => void executeDeleteInductionRecord(record, String(recordId), rowKey),
      },
    ]);
  };

  const executeDeleteInductionRecord = async (
    record: InductionTourRecord,
    recordId: string,
    rowKey: string
  ) => {
    setDeletingRecordKey(rowKey);
    try {
      const isConnected = await getConnectionStatus();

      if (isConnected) {
        const result = await deleteInductionTourRecord({
          id: String(recordId),
          refreshAccessToken,
          logout,
        });

        if (result.status) {
          try {
            const cacheStr = await AsyncStorage.getItem('evaluations_cache');
            if (cacheStr) {
              const cache = JSON.parse(cacheStr);
              const updatedCache = cache.filter(
                (item: any) =>
                  !(
                    item.type === 'induction_tour_record' &&
                    (String(item.id) === String(recordId) || String(item.id_local) === String(recordId))
                  )
              );
              await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
            }
          } catch (e) {
            console.warn('InductionTour cache after delete:', e);
          }
          Alert.alert('Éxito', 'Registro de inducción y recorrido eliminado correctamente');
          await fetchRecords();
        } else {
          Alert.alert('Error', result.message || 'Error al eliminar el registro de inducción y recorrido');
        }
      } else {
        const actionsStr = await AsyncStorage.getItem('evaluations_actions');
        const actions = actionsStr ? JSON.parse(actionsStr) : [];

        const isLocal = String(record.id_local || '').startsWith('local-') && String(recordId).startsWith('local-');
        if (isLocal) {
          const filteredActions = actions.filter(
            (a: any) =>
              !(
                a.type === 'induction_tour_record' &&
                (a.action === 'create' || a.action === 'update') &&
                String(a.id) === String(record.id_local)
              )
          );
          await AsyncStorage.setItem('evaluations_actions', JSON.stringify(filteredActions));
        } else {
          const filtered = actions.filter((a: any) => !(a.id === recordId && a.action === 'delete' && a.type === 'induction_tour_record'));
          filtered.push({
            id: recordId,
            action: 'delete',
            type: 'induction_tour_record',
            payload: {},
            synced: false,
          });
          await AsyncStorage.setItem('evaluations_actions', JSON.stringify(filtered));
        }

        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const updatedCache = cache.filter(
            (item: any) => !((item.id === recordId || item.id_local === recordId) && item.type === 'induction_tour_record')
          );
          await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
        }

        Alert.alert(
          'Modo Offline',
          isLocal
            ? 'Se eliminó el registro local pendiente de sincronización.'
            : 'La eliminación se sincronizará cuando haya conexión.'
        );
        await fetchRecords();
      }
    } catch (err) {
      console.error('Error deleting record:', err);
      Alert.alert('Error', 'No se pudo eliminar el registro de inducción y recorrido');
    } finally {
      setDeletingRecordKey(null);
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
  };

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'record': return <Ionicons name="document-text" size={24} color='#000000' />;
      case 'add': return <Ionicons name="add" size={24} color='#FFFFFF' />;
      case 'cancel': return <Ionicons name="close" size={24} color='#FFFFFF' />;
      case 'confirm': return <Ionicons name="checkmark" size={24} color='#FFFFFF' />;
      case 'delete': return <Ionicons name="trash" size={24} color='#FFFFFF' />;
      case 'edit': return <Ionicons name="pencil" size={20} color="#FFFFFF" />;
      default: return <Ionicons name="document-text" size={24} color='#000000' />;
    }
  };

  const toggleFirmaResponsableExpand = (recordId: string) => {
    setExpandedFirmaResponsableIds((prev) => (prev.includes(recordId) ? prev.filter((id) => id !== recordId) : [...prev, recordId]));
  };

  const toggleTemasListExpand = (recordId: string) => {
    setExpandedTemasListIds((prev) => (prev.includes(recordId) ? prev.filter((id) => id !== recordId) : [...prev, recordId]));
  };

  const toggleAspectosListExpand = (recordId: string) => {
    setExpandedAspectosListIds((prev) => (prev.includes(recordId) ? prev.filter((id) => id !== recordId) : [...prev, recordId]));
  };

  const renderTemasDesarrolladosPreview = (record: InductionTourRecord) => {
    const temas = safeParseJsonArray<TemaDesarrollado>(record.temas_desarrollados);
    if (!temas.length) return null;

    const recordId = String(record.id || record.id_local || '');
    const expanded = expandedTemasListIds.includes(recordId);

    return (
      <ThemedView style={styles.resultsCollapsableCard}>
        <TouchableOpacity style={styles.resultsCollapsableHeader} onPress={() => toggleTemasListExpand(recordId)}>
          <ThemedText style={styles.resultsCollapsableHeaderText}>Temas desarrollados ({temas.length})</ThemedText>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color="#007AFF" />
        </TouchableOpacity>

        {expanded && (
          <ThemedView style={styles.resultsCollapsableBody}>
            {temas.map((t, idx) => (
              <ThemedView key={`${recordId}-tema-${idx}`} style={styles.resultItem}>
                <ThemedText style={styles.resultItemTitle}>{`Tema ${idx + 1}`}</ThemedText>
                <ThemedText style={styles.resultItemText}>{t.tema || 'N/A'}</ThemedText>
                <ThemedText style={styles.resultItemMeta}>Respuesta: {t.respuesta || 'N/A'}</ThemedText>
                {!!t.comentarios && <ThemedText style={styles.resultItemMeta}>Comentarios: {t.comentarios}</ThemedText>}
              </ThemedView>
            ))}
          </ThemedView>
        )}
      </ThemedView>
    );
  };

  const renderAspectosEspecificosPreview = (record: InductionTourRecord) => {
    const aspectos = safeParseJsonArray<AspectoEspecifico>(record.aspectos_especificos);
    if (!aspectos.length) return null;

    const recordId = String(record.id || record.id_local || '');
    const expanded = expandedAspectosListIds.includes(recordId);

    return (
      <ThemedView style={styles.resultsCollapsableCard}>
        <TouchableOpacity style={styles.resultsCollapsableHeader} onPress={() => toggleAspectosListExpand(recordId)}>
          <ThemedText style={styles.resultsCollapsableHeaderText}>Aspectos específicos ({aspectos.length})</ThemedText>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color="#007AFF" />
        </TouchableOpacity>

        {expanded && (
          <ThemedView style={styles.resultsCollapsableBody}>
            {aspectos.map((a, idx) => (
              <ThemedView key={`${recordId}-aspecto-${idx}`} style={styles.resultItem}>
                <ThemedText style={styles.resultItemTitle}>{`Aspecto ${idx + 1}`}</ThemedText>
                <ThemedText style={styles.resultItemText}>{a.aspecto || 'N/A'}</ThemedText>
                <ThemedText style={styles.resultItemMeta}>Respuesta: {a.respuesta || 'N/A'}</ThemedText>
                {!!a.comentarios && <ThemedText style={styles.resultItemMeta}>Comentarios: {a.comentarios}</ThemedText>}
              </ThemedView>
            ))}
          </ThemedView>
        )}
      </ThemedView>
    );
  };

  const renderFirmaResponsablePreview = (record: InductionTourRecord) => {
    const hash = record.firma_responsable || '';
    if (!hash) return null;

    const recordId = String(record.id || record.id_local || '');
    const expanded = expandedFirmaResponsableIds.includes(recordId);

    return (
      <ThemedView style={styles.signatureCollapsableCard}>
        <TouchableOpacity style={styles.signatureCollapsableHeader} onPress={() => toggleFirmaResponsableExpand(recordId)}>
          <ThemedText style={styles.signatureCollapsableHeaderText}>Firma responsable</ThemedText>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color="#007AFF" />
        </TouchableOpacity>

        {expanded && (
          <ThemedView style={styles.signatureCollapsableBody}>
            {(() => {
              const info = decodeFirmaHash(hash);
              if (!info) {
                return <ThemedText style={styles.signatureInfoValue}>Formato no decodificable</ThemedText>;
              }
              return (
                <>
                  <ThemedText style={styles.signatureInfoValue}>Sesión: {info.sessionId || 'N/A'}</ThemedText>
                  <ThemedText style={styles.signatureInfoValue}>Empleado: {info.empleadoId || 'N/A'}</ThemedText>
                  <ThemedText style={styles.signatureInfoValue}>Lat: {info.latitud || 'N/A'} | Long: {info.longitud || 'N/A'}</ThemedText>
                  <ThemedText style={styles.signatureInfoValue}>Hora: { convertDateTimestampToLocalString(new Date(Number(info.timestamp)).toISOString()) || 'N/A'}</ThemedText>
                </>
              );
            })()}
          </ThemedView>
        )}
      </ThemedView>
    );
  };

  // Función helper para obtener el nombre del empleado desde la estructura
  const getEmpleadoNombre = useCallback((empleadoId: number | string | null | undefined): string => {
    if (!empleadoId || !structure || structure.length === 0) return 'N/A';

    const empId = Number(empleadoId);
    if (Number.isNaN(empId)) return 'N/A';

    // Buscar el empleado en toda la estructura
    for (const empresa of structure) {
      for (const cliente of empresa.clientes || []) {
        for (const division of cliente.division || []) {
          for (const contrato of division.contratos || []) {
            for (const sucursal of contrato.sucursales || []) {
              for (const puesto of sucursal.puestos || []) {
                for (const plaza of puesto.plazas || []) {
                  const empleado = plaza.empleados?.find((emp: MainStructureEmpleado) => emp.id === empId);
                  if (empleado) {
                    const nombre = empleado.nombre || '';
                    const primerApellido = empleado.primer_apellido || '';
                    const segundoApellido = empleado.segundo_apellido || '';
                    const nombreCompleto = `${nombre} ${primerApellido} ${segundoApellido}`.trim();
                    return nombreCompleto || empleado.cedula || 'N/A';
                  }
                }
              }
            }
          }
        }
      }
    }
    return 'N/A';
  }, [structure]);

  const renderRecordList = () => {
    if (isLoading) {
      return (
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Cargando registros de inducción y recorrido...</ThemedText>
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
          <ThemedText style={styles.emptyText}>No hay registros de inducción y recorrido registrados.</ThemedText>
        </ThemedView>
      );
    }

    return (
      <ThemedView style={styles.listContainer}>
        {records.map((record) => {
          const itemKey = String(record.id || record.id_local || '');
          const recordAny = record as any;
          const empleadoId = recordAny.empleado_id;
          const empleadoNombre = getEmpleadoNombre(empleadoId);

          return (
            <ThemedView key={record.id || record.id_local} style={styles.listItem}>
              <ThemedView style={styles.listItemHeader}>
                <ThemedView style={styles.listItemContent}>
                  <ThemedText style={styles.listItemTitle}>
                    {empleadoNombre}
                  </ThemedText>
                  <ThemedText style={styles.listItemSubtitle}>
                    División: {record.division || 'N/A'}
                  </ThemedText>
                  <ThemedText style={styles.listItemSubtitle}>
                    Supervisor (Cliente): {record.supervisor_cliente || 'N/A'}
                  </ThemedText>
                  <ThemedText style={styles.listItemSubtitle}>
                    Supervisor (Corporación): {record.supervisor_corporacion || 'N/A'}
                  </ThemedText>
                  <ThemedText style={styles.listItemSubtitle}>
                    Fecha: {convertDateTimestampToLocalString(new Date((record as any).fecha).toISOString(), false)}
                  </ThemedText>
                </ThemedView>
                <ThemedView style={styles.listItemActions}>
                </ThemedView>
              </ThemedView>

              {renderFirmaResponsablePreview(record)}
              {renderTemasDesarrolladosPreview(record)}
              {renderAspectosEspecificosPreview(record)}

              <ThemedView style={styles.listItemDetails}>
                <ThemedView style={styles.listItemButtons}>
                  <TouchableOpacity
                    style={[styles.listItemButton, styles.editButton]}
                    onPress={() => startEditing(record)}
                  >
                    {getActionIcon('edit')}
                  </TouchableOpacity>
                  {!(record.id_local || String(record.id).startsWith('local-') || record.id === 0) && (
                    <TouchableOpacity
                      style={[styles.listItemButton, styles.changesButton]}
                      onPress={() => {
                        setCambiosTitle(`Cambios - Registro #${record.id}`);
                        fetchCambios('c_registro_induccion_recorrido', Number(record.id));
                      }}
                    >
                      <Ionicons name="list-outline" size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[
                      styles.listItemButton,
                      styles.deleteButton,
                      deletingRecordKey !== null && styles.buttonDisabled,
                    ]}
                    onPress={() => deleteRecordHandler(record)}
                    disabled={deletingRecordKey !== null}
                  >
                    {deletingRecordKey === itemKey ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      getActionIcon('delete')
                    )}
                  </TouchableOpacity>
                </ThemedView>
              </ThemedView>
            </ThemedView>
          );
        })}
      </ThemedView>
    );
  };

  const renderTema = (tema: TemaDesarrollado, index: number) => {
    const isExpanded = expandedTemaIndices.includes(index);

    return (
      <ThemedView key={index} style={styles.temaItem}>
        <TouchableOpacity
          style={styles.temaHeader}
          onPress={() => toggleTemaExpansion(index)}
        >
          <ThemedView style={styles.temaHeaderContent}>
            <ThemedText style={styles.temaHeaderText}>
              Tema {index + 1}
            </ThemedText>
          </ThemedView>
          <ThemedView style={styles.temaHeaderActions}>
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                removeTema(index);
              }}
              style={styles.removeTemaButton}
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
          <ThemedView style={styles.temaContent}>
            {/* Tema */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Tema</ThemedText>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                placeholder="Tema"
                placeholderTextColor="#999"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                value={tema.tema}
                onChangeText={(text) => updateTema(index, 'tema', text)}
              />
            </ThemedView>

            {/* Respuesta SI/NO/NA */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Respuesta</ThemedText>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={tema.respuesta}
                  onValueChange={(value) => updateTema(index, 'respuesta', value)}
                  style={styles.picker}
                >
                  <Picker.Item label="Seleccionar..." value="" color="#000000" />
                  <Picker.Item label="SI" value="SI" color="#000000" />
                  <Picker.Item label="NO" value="NO" color="#000000" />
                  <Picker.Item label="NA" value="NA" color="#000000" />
                </Picker>
              </View>
            </ThemedView>

            {/* Comentarios */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Comentarios</ThemedText>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                placeholder="Comentarios"
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                value={tema.comentarios}
                onChangeText={(text) => updateTema(index, 'comentarios', text)}
              />
            </ThemedView>
          </ThemedView>
        )}
      </ThemedView>
    );
  };

  const renderAspecto = (aspecto: AspectoEspecifico, index: number) => {
    const isExpanded = expandedAspectoIndices.includes(index);

    return (
      <ThemedView key={index} style={styles.aspectoItem}>
        <TouchableOpacity
          style={styles.aspectoHeader}
          onPress={() => toggleAspectoExpansion(index)}
        >
          <ThemedView style={styles.aspectoHeaderContent}>
            <ThemedText style={styles.aspectoHeaderText}>
              Aspecto {index + 1}
            </ThemedText>
          </ThemedView>
          <ThemedView style={styles.aspectoHeaderActions}>
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                removeAspecto(index);
              }}
              style={styles.removeAspectoButton}
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
          <ThemedView style={styles.aspectoContent}>
            {/* Aspecto */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Aspecto</ThemedText>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                placeholder="Aspecto"
                placeholderTextColor="#999"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                value={aspecto.aspecto}
                onChangeText={(text) => updateAspecto(index, 'aspecto', text)}
              />
            </ThemedView>

            {/* Respuesta SI/NO/NA */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Respuesta</ThemedText>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={aspecto.respuesta}
                  onValueChange={(value) => updateAspecto(index, 'respuesta', value)}
                  style={styles.picker}
                >
                  <Picker.Item label="Seleccionar..." value="" color="#000000" />
                  <Picker.Item label="SI" value="SI" color="#000000" />
                  <Picker.Item label="NO" value="NO" color="#000000" />
                  <Picker.Item label="NA" value="NA" color="#000000" />
                </Picker>
              </View>
            </ThemedView>

            {/* Comentarios */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Comentarios</ThemedText>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                placeholder="Comentarios"
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                value={aspecto.comentarios}
                onChangeText={(text) => updateAspecto(index, 'comentarios', text)}
              />
            </ThemedView>
          </ThemedView>
        )}
      </ThemedView>
    );
  };

  const renderParticipante = (participante: Participante, index: number) => {
    const isExpanded = expandedParticipanteIndices.includes(index);

    return (
      <ThemedView key={index} style={styles.participanteItem}>
        <TouchableOpacity
          style={styles.participanteHeader}
          onPress={() => toggleParticipanteExpansion(index)}
        >
          <ThemedView style={styles.participanteHeaderContent}>
            <ThemedText style={styles.participanteHeaderText}>
              Participante {index + 1}: {participante.nombre_completo || 'Sin nombre'}
            </ThemedText>
          </ThemedView>
          <ThemedView style={styles.participanteHeaderActions}>
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                removeParticipante(index);
              }}
              style={styles.removeParticipanteButton}
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
          <ThemedView style={styles.participanteContent}>
            {/* Nombre completo */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Nombre Completo</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder="Nombre Completo"
                placeholderTextColor="#999"
                value={participante.nombre_completo}
                onChangeText={(text) => updateParticipante(index, 'nombre_completo', text)}
              />
            </ThemedView>

            {/* Cédula */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Cédula</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder="Cédula"
                placeholderTextColor="#999"
                value={participante.cedula}
                onChangeText={(text) => updateParticipante(index, 'cedula', text)}
                keyboardType="numeric"
              />
            </ThemedView>

            {/* Firma */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Firma</ThemedText>
              {!participante.firma ? (
                <TouchableOpacity
                  style={styles.signatureButton}
                  onPress={() => openSignatureModal({ type: 'participante', index })}
                >
                  <Ionicons name="create-outline" size={24} color="#007AFF" />
                  <ThemedText style={styles.signatureButtonText}>Toca para dibujar la firma</ThemedText>
                </TouchableOpacity>
              ) : (
                <ThemedView style={styles.signaturePreviewContainer}>
                  <Image
                    source={{ uri: formatSignatureForDisplay(participante.firma) || '' }}
                    style={styles.signaturePreview}
                  />
                  <TouchableOpacity
                    style={styles.clearSignatureButton}
                    onPress={() => updateParticipante(index, 'firma', null)}
                  >
                    <Ionicons name="trash" size={16} color="#FF3B30" />
                    <ThemedText style={styles.clearSignatureButtonText}>Eliminar Firma</ThemedText>
                  </TouchableOpacity>
                </ThemedView>
              )}
            </ThemedView>
          </ThemedView>
        )}
      </ThemedView>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <AppHeader onMenuPress={handleMenuPress} title="Induc. y Recorr. Misc" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <ThemedView style={styles.contentContainer}>
          <ThemedView style={styles.titleContainer}>
            <ThemedText type="title" style={styles.title}>
              {getActionIcon('record')} Inducción y Recorrido (Misceláneo)
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              Gestiona los registros de inducción y recorrido
            </ThemedText>
          </ThemedView>

          {!hasCurrentMarca && (
            <ThemedView style={styles.noMarcaContainer}>
              <ThemedText style={styles.noMarcaTitle}>Marca no seleccionada</ThemedText>
              <ThemedText style={styles.noMarcaMessage}>
                No hay marca activa. Puede seleccionar la jerarquía manualmente en los filtros.
              </ThemedText>
            </ThemedView>
          )}

          {isCreating || editingRecord ? (
            <ThemedView style={styles.formContainer}>
              {/* Fecha */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Fecha</ThemedText>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <ThemedText style={styles.dateButtonText}>
                    {formatDate(fecha)}
                  </ThemedText>
                  <Ionicons name="calendar" size={20} color="#007AFF" />
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={fecha}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleDateChange}
                  />
                )}
              </ThemedView>

              {/* Jerarquía */}
              {isLoadingStructure ? (
                <ThemedView style={styles.formGroup}>
                  <ThemedView style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <ThemedText style={styles.loadingText}>Cargando empresas...</ThemedText>
                  </ThemedView>
                </ThemedView>
              ) : (
                <>
                  <HierarchyPickerFields
                    structure={structure}
                    levels={['cliente', 'contrato', 'sucursal', 'puesto', 'plaza']}
                    isLoading={isLoadingStructure}
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
                      puesto: 'Puesto',
                      plaza: 'Plaza *',
                    }}
                    renderLabel={(text) => <ThemedText style={styles.formLabel}>{text}</ThemedText>}
                    pickerStyle={styles.picker}
                    fieldGroupStyle={styles.formGroup}
                  />

                  {/* Empleado */}
                  <ThemedView style={styles.formGroup}>
                    <ThemedText style={styles.formLabel}>Empleado *</ThemedText>
                    <View style={styles.pickerContainer}>
                      <Picker
                        enabled={formPlazaId !== null}
                        selectedValue={selectedEmpleadoId ?? 0}
                        onValueChange={(value) => onEmpleadoSelected(value ? Number(value) : null)}
                        style={styles.picker}
                      >
                        <Picker.Item label={formPlazaId ? 'Seleccionar empleado...' : 'Seleccione plaza primero'} value={0} color="#000000" />
                        {formEmpleados.map((emp: MainStructureEmpleado) => (
                          <Picker.Item key={emp.id} label={`${emp.nombre || ''} ${emp.primer_apellido || ''} ${emp.segundo_apellido || ''} - ${emp.cedula}`} value={emp.id} color="#000000"   />
                        ))}
                      </Picker>
                    </View>
                  </ThemedView>

                  {/* Firma del empleado */}
                  <ThemedView style={styles.formGroup}>
                    <ThemedText style={styles.formLabel}>Firma del empleado (Opcional)</ThemedText>
                    {firmaEmpleadoManual ? (
                      <ThemedView style={styles.signaturePreviewContainer}>
                        <Image source={{ uri: firmaEmpleadoManual }} style={styles.signaturePreview} resizeMode="contain" />
                        <TouchableOpacity style={styles.removeSignatureButton} onPress={() => setFirmaEmpleadoManual(null)}>
                          <Ionicons name="trash" size={18} color="#FFFFFF" />
                        </TouchableOpacity>
                      </ThemedView>
                    ) : null}
                    <TouchableOpacity
                      style={[styles.openSignatureButton, formPlazaId === null && styles.disabledButton]}
                      onPress={openFirmaEmpleadoManualModal}
                      disabled={formPlazaId === null}
                    >
                      <Ionicons name="create-outline" size={20} color={formPlazaId === null ? "#999" : "#000000"} />
                      <ThemedText style={[styles.openSignatureButtonText, formPlazaId === null && styles.disabledText]}>
                        {firmaEmpleadoManual ? 'Modificar firma' : formPlazaId ? 'Dibujar firma' : 'Seleccione plaza primero'}
                      </ThemedText>
                    </TouchableOpacity>
                  </ThemedView>
                </>
              )}

              {/* Renglón o Edificio */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Renglón o Edificio</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Renglón o Edificio"
                  placeholderTextColor="#999"
                  value={renglonEdificio}
                  onChangeText={setRenglonEdificio}
                />
              </ThemedView>

              {/* Supervisor del cliente (si aplica) */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Supervisor del cliente (si aplica)</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Supervisor del cliente"
                  placeholderTextColor="#999"
                  value={supervisorCliente}
                  onChangeText={setSupervisorCliente}
                />
              </ThemedView>

              {/* Supervisor de Corporación */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Supervisor de Corporación</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Supervisor de Corporación"
                  placeholderTextColor="#999"
                  value={supervisorCorporacion}
                  onChangeText={setSupervisorCorporacion}
                />
              </ThemedView>

              {/* Temas desarrollados */}
              <ThemedView style={styles.sectionContainer}>
                <ThemedText style={styles.sectionTitle}>Temas desarrollados en el recorrido e inducción al empleado</ThemedText>
                {temasDesarrollados.map((tema, index) => renderTema(tema, index))}
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={addTema}
                >
                  <Ionicons name="add-circle" size={24} color="#4CAF50" />
                  <ThemedText style={styles.addButtonText}>Agregar Tema</ThemedText>
                </TouchableOpacity>
              </ThemedView>

              {/* Aspectos Específicos por Contrato */}
              <ThemedView style={styles.sectionContainer}>
                <ThemedText style={styles.sectionTitle}>Aspectos Específicos por Contrato</ThemedText>
                {aspectosEspecificos.map((aspecto, index) => renderAspecto(aspecto, index))}
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={addAspecto}
                >
                  <Ionicons name="add-circle" size={24} color="#4CAF50" />
                  <ThemedText style={styles.addButtonText}>Agregar Aspecto</ThemedText>
                </TouchableOpacity>
              </ThemedView>

              {/* Participantes */}
              <ThemedView style={styles.sectionContainer}>
                <ThemedText style={styles.sectionTitle}>Participantes</ThemedText>
                {participantes.map((participante, index) => renderParticipante(participante, index))}
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={addParticipante}
                >
                  <Ionicons name="add-circle" size={24} color="#4CAF50" />
                  <ThemedText style={styles.addButtonText}>Agregar Participante</ThemedText>
                </TouchableOpacity>
              </ThemedView>

              {/* Firma supervisor de aseo y limpieza */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Firma Supervisor de Aseo y Limpieza</ThemedText>
                {!firmaSupervisor ? (
                  <TouchableOpacity
                    style={styles.signatureButton}
                    onPress={() => openSignatureModal('supervisor')}
                  >
                    <Ionicons name="create-outline" size={24} color="#007AFF" />
                    <ThemedText style={styles.signatureButtonText}>Toca para dibujar la firma</ThemedText>
                  </TouchableOpacity>
                ) : (
                  <ThemedView style={styles.signaturePreviewContainer}>
                    <Image
                      source={{ uri: formatSignatureForDisplay(firmaSupervisor) || '' }}
                      style={styles.signaturePreview}
                    />
                    <TouchableOpacity
                      style={styles.clearSignatureButton}
                      onPress={() => setFirmaSupervisor(null)}
                    >
                      <Ionicons name="trash" size={16} color="#FF3B30" />
                      <ThemedText style={styles.clearSignatureButtonText}>Eliminar Firma</ThemedText>
                    </TouchableOpacity>
                  </ThemedView>
                )}
              </ThemedView>

              {/* Firma responsable (QR) */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Firma responsable (QR) *</ThemedText>
                {!firmaResponsableHash ? (
                  <ThemedView style={styles.signatureButtonsRow}>
                    <TouchableOpacity
                      style={[styles.signatureQRButton, isGeneratingFirmaResponsable && styles.signatureQRButtonDisabled]}
                      onPress={handleGenerateFirmaResponsable}
                      disabled={isGeneratingFirmaResponsable}
                    >
                      {isGeneratingFirmaResponsable ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons name="finger-print" size={22} color="#FFFFFF" />
                          <ThemedText style={styles.signatureQRButtonText}>Generar</ThemedText>
                        </>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.signatureQRButton} onPress={handleScanFirmaResponsable}>
                      <Ionicons name="qr-code" size={18} color="#FFFFFF" />
                      <ThemedText style={styles.signatureQRButtonText}>Escanear QR</ThemedText>
                    </TouchableOpacity>
                  </ThemedView>
                ) : (
                  <ThemedView style={styles.signatureInfoBox}>
                    <ThemedView style={{ flex: 1, paddingRight: 10 }}>
                      <ThemedText style={styles.signatureInfoTitle}>Información de la firma:</ThemedText>
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
                            <ThemedText style={styles.signatureInfoValue}>Hora: { convertDateTimestampToLocalString(new Date(Number(info.timestamp)).toISOString()) || 'N/A'}</ThemedText>
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
                  onPress={editingRecord ? cancelEditing : cancelCreating}
                  disabled={isSubmitting}
                >
                  {getActionIcon('cancel')}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.saveButton, isSubmitting && styles.buttonDisabled]}
                  onPress={editingRecord ? handleSaveUpdate : handleSaveCreate}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <ThemedView style={{ flexDirection: 'row', alignItems: 'center' }}>
                      {getActionIcon('confirm')}
                      <ThemedText style={{ color: '#FFFFFF', fontWeight: '600', marginLeft: 8 }}>Aceptar</ThemedText>
                    </ThemedView>
                  )}
                </TouchableOpacity>
              </ThemedView>
            </ThemedView>
          ) : (
            <ThemedView style={styles.listSection}>
              {roleName != null && roleName !== 'OPERATIVO' && (
              <ThemedView style={styles.filtersContainer}>
                  <ThemedView style={styles.filtersHeader}>
                    <TouchableOpacity
                      style={styles.filterToggleButton}
                      onPress={() => setIsHierarchyFiltersExpanded(!isHierarchyFiltersExpanded)}
                    >
                      <ThemedText style={styles.filtersTitle}>
                        Filtros jerárquicos
                      </ThemedText>
                      <Ionicons
                        name={isHierarchyFiltersExpanded ? "chevron-up" : "chevron-down"}
                        size={20}
                        color="#007AFF"
                      />
                    </TouchableOpacity>
                    {isHierarchyFiltersExpanded && (
                      <TouchableOpacity
                        style={styles.resetFiltersButton}
                        onPress={() => {
                          void (async () => {
                            const ctxR = await loadMarcaContext({ syncListFilters: true });
                            await fetchRecords(ctxR.isOperativo ? undefined : { corpoId: ctxR.syncedFilterCorpoId });
                          })();
                        }}
                      >
                        <Ionicons name="refresh" size={16} color="#FF3B30" />
                        <ThemedText style={styles.resetFiltersText}>Reiniciar</ThemedText>
                      </TouchableOpacity>
                    )}
                  </ThemedView>
                  {isHierarchyFiltersExpanded && (
                    <ThemedView style={styles.filtersContent}>
                      <HierarchyPickerFields
                        structure={structure}
                        levels={['cliente', 'contrato', 'sucursal']}
                        values={{
                          empresaId: filterEmpresaId,
                          clienteId: filterClienteId,
                          divisionId: filterDivisionId,
                          contratoId: filterContratoId,
                          sucursalId: filterCorpoId,
                        }}
                        onChange={handleFilterHierarchyChange}
                        renderLabel={(text) => <ThemedText style={styles.filterLabel}>{text}:</ThemedText>}
                        pickerStyle={styles.picker}
                        fieldGroupStyle={styles.filterGroup}
                      />
                    </ThemedView>
                  )}
                </ThemedView>
              )}

              {!isLoading && (
                <TouchableOpacity style={styles.createButton} onPress={startCreating}>
                  <ThemedText style={styles.createButtonText}>
                    <Ionicons name="add" size={20} color="#FFFFFF" />
                  </ThemedText>
                </TouchableOpacity>
              )}
              {renderRecordList()}
            </ThemedView>
          )}
        </ThemedView>
      </ScrollView>

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
                {currentSignatureType === 'supervisor' ? 'Firma Supervisor' : 'Firma Participante'}
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

      {/* Modal de firma manual del empleado */}
      <Modal
        visible={isFirmaEmpleadoManualModalVisible}
        animationType="fade"
        transparent
        onRequestClose={closeFirmaEmpleadoManualModal}
      >
        <View style={styles.modalOverlay}>
          <ThemedView style={styles.modalContainer}>
            <ThemedView style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Firma manual del empleado</ThemedText>
              <TouchableOpacity onPress={closeFirmaEmpleadoManualModal}>
                <Ionicons name="close" size={24} color="#000000" />
              </TouchableOpacity>
            </ThemedView>
            <View style={styles.modalSignatureContainer}>
              <SignatureScreen
                ref={signatureEmpleadoRef}
                onOK={handleFirmaEmpleadoManualRead}
                onEmpty={() => {
                  setIsReadingFirmaEmpleadoManual(false);
                  Alert.alert('Error', 'No se detectó la firma. Intenta de nuevo.');
                }}
                descriptionText=""
                clearText=""
                confirmText=""
                webStyle={`
                  .m-signature-pad--footer {display: none; margin: 0px;}
                  .m-signature-pad {box-shadow: none; border: none;}
                  body,html {width: 100%; height: 100%; background: #ffffff;}
                `}
                key={signatureEmpleadoKey}
              />
            </View>
            <ThemedView style={styles.modalActions}>
              <TouchableOpacity style={styles.modalClearButton} onPress={clearFirmaEmpleadoManualInModal}>
                <Ionicons name="trash" size={20} color="#000000" />
                <ThemedText style={styles.modalClearButtonText}>Limpiar</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalAcceptButton, isReadingFirmaEmpleadoManual && { opacity: 0.7 }]}
                onPress={acceptFirmaEmpleadoManual}
                disabled={isReadingFirmaEmpleadoManual}
              >
                {isReadingFirmaEmpleadoManual ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <ThemedText style={styles.modalAcceptButtonText}>Aceptar</ThemedText>
                )}
              </TouchableOpacity>
            </ThemedView>
          </ThemedView>
        </View>
      </Modal>

      {QRScannerComponent}

      <AppFooter />
      <SlideMenu
        isVisible={isMenuVisible}
        onClose={handleMenuClose}
        onHomePress={handleHomePress}
        currentRoute="InductionTourRecord"
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#ffffff',
  },
  contentContainer: {
    width: '100%',
    maxWidth: 600,
    backgroundColor: '#FFFFFF',
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
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
  },
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
  createButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
    justifyContent: 'center',
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  formContainer: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  formGroup: {
    marginBottom: 15,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 5,
    color: '#000000',
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000000',
    backgroundColor: '#F9F9F9',
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
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    color: '#000000',
  },
  sectionContainer: {
    marginTop: 20,
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 10,
  },
  temaItem: {
    marginBottom: 15,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  temaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#F5F5F5',
  },
  temaHeaderContent: {
    flex: 1,
    marginRight: 10,
    backgroundColor: '#F5F5F5',
  },
  temaHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  temaHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F5F5F5',
  },
  removeTemaButton: {
    padding: 4,
  },
  temaContent: {
    padding: 15,
  },
  aspectoItem: {
    marginBottom: 15,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  aspectoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#F5F5F5',
  },
  aspectoHeaderContent: {
    flex: 1,
    marginRight: 10,
    backgroundColor: '#F5F5F5',
  },
  aspectoHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  aspectoHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F5F5F5',
  },
  removeAspectoButton: {
    padding: 4,
  },
  aspectoContent: {
    padding: 15,
  },
  participanteItem: {
    marginBottom: 15,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  participanteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#F5F5F5',
  },
  participanteHeaderContent: {
    flex: 1,
    marginRight: 10,
  },
  participanteHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  participanteHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  removeParticipanteButton: {
    padding: 4,
  },
  participanteContent: {
    padding: 15,
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

  // Firma responsable (QR)
  signatureButtonsRow: { flexDirection: 'row', gap: 12 },
  signatureQRButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  signatureQRButtonDisabled: { opacity: 0.6 },
  signatureQRButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  signatureInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
  },
  signatureInfoTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8, color: '#333' },
  signatureInfoValue: { fontSize: 13, color: '#333', marginBottom: 4 },
  signatureButtonPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  signatureInfo: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  signatureInfoText: {
    fontSize: 13,
    color: '#333',
    marginBottom: 4,
  },
  signatureInfoDetail: {
    backgroundColor: '#E8F5E9',
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  signatureInfoDetailText: {
    fontSize: 13,
    color: '#2E7D32',
    fontWeight: '600',
  },
  openSignatureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    gap: 8,
  },
  openSignatureButtonText: {
    fontSize: 14,
    color: '#000000',
    fontWeight: '600',
  },
  removeSignatureButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: '#FF3B30',
    borderRadius: 20,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningText: {
    color: '#D32F2F',
    fontSize: 13,
    marginTop: 8,
    fontStyle: 'italic',
  },
  disabledButton: {
    opacity: 0.5,
  },
  disabledText: {
    color: '#999',
  },
  clearSignatureButtonTiny: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Collapsable firma responsable (lista)
  signatureCollapsableCard: {
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
    overflow: 'hidden',
  },
  signatureCollapsableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F0F0F0',
  },
  signatureCollapsableHeaderText: { fontSize: 14, fontWeight: '600', color: '#007AFF', flex: 1, paddingRight: 8 },
  signatureCollapsableBody: { padding: 12, backgroundColor: '#F9F9F9' },

  // Collapsables (lista): temas / aspectos
  resultsCollapsableCard: {
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
    overflow: 'hidden',
  },
  resultsCollapsableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F0F0F0',
  },
  resultsCollapsableHeaderText: { fontSize: 14, fontWeight: '600', color: '#007AFF', flex: 1, paddingRight: 8 },
  resultsCollapsableBody: { padding: 12, backgroundColor: '#F9F9F9', gap: 12 },
  resultItem: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAEAEA',
    gap: 6,
  },
  resultItemTitle: { fontSize: 14, fontWeight: '700', color: '#333' },
  resultItemText: { fontSize: 13, color: '#333' },
  resultItemMeta: { fontSize: 12, color: '#666' },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  cancelButton: {
    backgroundColor: '#CCCCCC',
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
  listSection: {
    width: '100%',
  },
  listContainer: {
    width: '100%',
    marginTop: 10,
  },
  listItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  listItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#ffffff',
  },
  listItemContent: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  listItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
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
  listItemDetails: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  listItemButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    backgroundColor: '#007AFF',
  },
  changesButton: { backgroundColor: '#5856D6', flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 8, gap: 8 },
  deleteButton: {
    backgroundColor: '#FF3B30',
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
  // Filtros jerárquicos (mismo diseño que VisitorsScreen)
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
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
  },
});

