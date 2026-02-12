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
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import SignatureScreen from "react-native-signature-canvas";
import * as Location from 'expo-location';
import { jwtDecode } from 'jwt-decode';
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
import * as Network from 'expo-network';
import getHoraAccion from '@/hooks/getHoraAccion';
import authedFetch from '@/hooks/authedFetch';
import {
  createInductionTourRecord,
  updateInductionTourRecord,
  deleteInductionTourRecord,
  listInductionTourRecordByCorpo,
  listInductionTourRecords,
} from '@/hooks/evaluationFunctions';
import { eventBus } from '@/hooks/eventBus';
import { useQRScanner } from '@/hooks/useQRScanner';

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
  division?: string | null;
  renglon_edificio: string | null;
  supervisor_cliente: string | null;
  supervisor_corporacion: string | null;
  temas_desarrollados: string | null;
  aspectos_especificos: string | null;
  participantes: string | null;
  firma_supervisor: string | null;
  firma_responsable?: string | null;
  created_at: string;
  synced?: boolean;
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
  const [cambiosItems, setCambiosItems] = useState<any[]>([]);
  const [expandedCambioId, setExpandedCambioId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasCurrentMarca, setHasCurrentMarca] = useState<boolean>(false);

  // Main structure y filtros jerárquicos
  const [structure, setStructure] = useState<any[]>([]);
  const [isStructureLoading, setIsStructureLoading] = useState(false);
  const [filterEmpresaId, setFilterEmpresaId] = useState<number | null>(null);
  const [filterClienteId, setFilterClienteId] = useState<number | null>(null);
  const [filterContratoId, setFilterContratoId] = useState<number | null>(null);
  const [filterCorpoId, setFilterCorpoId] = useState<number | null>(null);
  const [filterPuestoId, setFilterPuestoId] = useState<number | null>(null);
  const [filterPlazaId, setFilterPlazaId] = useState<number | null>(null);
  const [isHierarchyFiltersExpanded, setIsHierarchyFiltersExpanded] = useState(false);

  // IDs de current_marca para inicialización
  const [marcaEmpresaId, setMarcaEmpresaId] = useState<number | null>(null);
  const [marcaClienteId, setMarcaClienteId] = useState<number | null>(null);
  const [marcaContratoId, setMarcaContratoId] = useState<number | null>(null);
  const [marcaCorpoId, setMarcaCorpoId] = useState<number | null>(null);
  const [marcaPuestoId, setMarcaPuestoId] = useState<number | null>(null);
  const [marcaPlazaId, setMarcaPlazaId] = useState<number | null>(null);

  // Editing state
  const [editingRecord, setEditingRecord] = useState<EditingInductionTourRecord | null>(null);
  const [isCreating, setIsCreating] = useState(false);

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

  const formatTemasDesarrolladosForDisplay = (temasJson: string): string => {
    try {
      const temas: TemaDesarrollado[] = safeParseJsonArray<TemaDesarrollado>(temasJson);
      if (!Array.isArray(temas) || temas.length === 0) return 'No hay temas desarrollados.';
      return temas.map((t, idx) => {
        const tema = t?.tema || '-';
        const respuesta = t?.respuesta === 'SI' ? 'Sí' : t?.respuesta === 'NO' ? 'No' : t?.respuesta === 'NA' ? 'N/A' : '-';
        const comentarios = t?.comentarios || '-';
        return `${idx + 1}. ${tema}\n   Respuesta: ${respuesta}\n   Comentarios: ${comentarios}`;
      }).join('\n\n');
    } catch (e) {
      console.error('Error formatting temas desarrollados for display:', e);
      return 'Error al formatear temas desarrollados.';
    }
  };

  const formatAspectosEspecificosForDisplay = (aspectosJson: string): string => {
    try {
      const aspectos: AspectoEspecifico[] = safeParseJsonArray<AspectoEspecifico>(aspectosJson);
      if (!Array.isArray(aspectos) || aspectos.length === 0) return 'No hay aspectos específicos.';
      return aspectos.map((a, idx) => {
        const aspecto = a?.aspecto || '-';
        const respuesta = a?.respuesta === 'SI' ? 'Sí' : a?.respuesta === 'NO' ? 'No' : a?.respuesta === 'NA' ? 'N/A' : '-';
        const comentarios = a?.comentarios || '-';
        return `${idx + 1}. ${aspecto}\n   Respuesta: ${respuesta}\n   Comentarios: ${comentarios}`;
      }).join('\n\n');
    } catch (e) {
      console.error('Error formatting aspectos específicos for display:', e);
      return 'Error al formatear aspectos específicos.';
    }
  };

  const formatParticipantesForDisplay = (participantesJson: string): string => {
    try {
      const participantes: Participante[] = safeParseJsonArray<Participante>(participantesJson);
      if (!Array.isArray(participantes) || participantes.length === 0) return 'No hay participantes.';
      return participantes.map((p, idx) => {
        const nombre = p?.nombre_completo || '-';
        const cedula = p?.cedula || '-';
        const tieneFirma = p?.firma ? 'Sí' : 'No';
        return `${idx + 1}. ${nombre} (Cédula: ${cedula}, Firma: ${tieneFirma})`;
      }).join('\n');
    } catch (e) {
      console.error('Error formatting participantes for display:', e);
      return 'Error al formatear participantes.';
    }
  };

  const formatChangeValue = (prop: string, value: any): string => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';
    if (typeof value === 'object') {
      if (prop === 'temas_desarrollados') {
        return formatTemasDesarrolladosForDisplay(JSON.stringify(value));
      }
      if (prop === 'aspectos_especificos') {
        return formatAspectosEspecificosForDisplay(JSON.stringify(value));
      }
      if (prop === 'participantes') {
        return formatParticipantesForDisplay(JSON.stringify(value));
      }
      return JSON.stringify(value, null, 2);
    }
    if (typeof value === 'string') {
      if (value.trim().startsWith('{') || value.trim().startsWith('[')) {
        try {
          const parsed = JSON.parse(value);
          if (prop === 'temas_desarrollados') {
            return formatTemasDesarrolladosForDisplay(value);
          }
          if (prop === 'aspectos_especificos') {
            return formatAspectosEspecificosForDisplay(value);
          }
          if (prop === 'participantes') {
            return formatParticipantesForDisplay(value);
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
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
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

  const safeParseJsonArray = <T,>(value?: string | null): T[] => {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  };

  const loadMarcaContext = async () => {
    const currentMarcaStr = await AsyncStorage.getItem('current_marca');
    if (!currentMarcaStr) {
      setHasCurrentMarca(false);
      setMarcaEmpresaId(null);
      setMarcaClienteId(null);
      setMarcaContratoId(null);
      setMarcaCorpoId(null);
      setMarcaPuestoId(null);
      setMarcaPlazaId(null);
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
      const contratoIdRaw = current?.contrato?.id ?? current?.contrato_id;
      const corpoIdRaw = current?.corpo?.id ?? current?.corpo_id;
      const puestoIdRaw = current?.puesto?.id ?? current?.puesto_id;
      const plazaIdRaw = current?.plaza?.id ?? current?.plaza_id;
      setMarcaEmpresaId(empresaIdRaw !== undefined && empresaIdRaw !== null ? Number(empresaIdRaw) : null);
      setMarcaClienteId(clienteIdRaw !== undefined && clienteIdRaw !== null ? Number(clienteIdRaw) : null);
      setMarcaContratoId(contratoIdRaw !== undefined && contratoIdRaw !== null ? Number(contratoIdRaw) : null);
      setMarcaCorpoId(corpoIdRaw !== undefined && corpoIdRaw !== null ? Number(corpoIdRaw) : null);
      setMarcaPuestoId(puestoIdRaw !== undefined && puestoIdRaw !== null ? Number(puestoIdRaw) : null);
      setMarcaPlazaId(plazaIdRaw !== undefined && plazaIdRaw !== null ? Number(plazaIdRaw) : null);
      return current;
    } catch {
      setHasCurrentMarca(false);
      setMarcaEmpresaId(null);
      setMarcaClienteId(null);
      setMarcaContratoId(null);
      setMarcaCorpoId(null);
      setMarcaPuestoId(null);
      setMarcaPlazaId(null);
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
        } catch {
          // ignore
        }
      }
      const isConnected = await getConnectionStatus();
      if (!isConnected) {
        setIsStructureLoading(false);
        return;
      }
      // La estructura ya se guarda desde otras pantallas, aquí solo usamos cache
    } finally {
      setIsStructureLoading(false);
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
    const contrato = filterContratos.find((c: any) => c.id === filterContratoId);
    return contrato?.sucursales || [];
  }, [filterContratos, filterContratoId]);

  const filterPuestos = useMemo(() => {
    const sucursal = filterSucursales.find((s: any) => s.id === filterCorpoId);
    return sucursal?.puestos || [];
  }, [filterSucursales, filterCorpoId]);

  const filterPlazas = useMemo(() => {
    const puesto = filterPuestos.find((p: any) => p.id === filterPuestoId);
    return puesto?.plazas || [];
  }, [filterPuestos, filterPuestoId]);

  // Nodos computados para jerarquía del formulario
  const formEmpresas = useMemo(() => (Array.isArray(structure) ? structure : []), [structure]);

  const formClientes = useMemo(() => {
    const empresa = formEmpresas.find((e: any) => e.id === formEmpresaId);
    return empresa?.clientes || [];
  }, [formEmpresas, formEmpresaId]);

  const formDivisiones = useMemo(() => {
    const cliente = formClientes.find((c: any) => c.id === formClienteId);
    return cliente?.division || [];
  }, [formClientes, formClienteId]);

  const formContratos = useMemo(() => {
    if (!formClienteId) return [];
    const cliente = formClientes.find((c: any) => c.id === formClienteId);
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
  }, [formClientes, formClienteId]);

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

  const fetchRecords = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const current = await loadMarcaContext();
      if (!current && !filterCorpoId) {
        setHasCurrentMarca(false);
        setIsLoading(false);
        return;
      }

      // Usar filtros jerárquicos si están disponibles, sino usar current_marca
      const empresaId = filterEmpresaId ?? marcaEmpresaId ?? Number(current?.empresa?.id ?? current?.empresa_id ?? 0);
      const clienteId = filterClienteId ?? marcaClienteId ?? Number(current?.cliente?.id ?? current?.cliente_id ?? 0);
      const contratoId = filterContratoId ?? marcaContratoId ?? Number(current?.contrato?.id ?? current?.contrato_id ?? 0);
      const corpoId = filterCorpoId ?? marcaCorpoId ?? Number(current?.corpo?.id ?? current?.corpo_id ?? 0);
      const puestoId = filterPuestoId ?? marcaPuestoId ?? Number(current?.puesto?.id ?? current?.puesto_id ?? 0);
      const plazaId = filterPlazaId ?? marcaPlazaId ?? Number(current?.plaza?.id ?? current?.plaza_id ?? 0);

      if (!corpoId) {
        setError('No se encontró el ID del corpo');
        setIsLoading(false);
        return;
      }

      const isConnected = await getConnectionStatus();

      // cache local (siempre)
      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
      const cache = cacheStr ? JSON.parse(cacheStr) : [];
      const localRecords: InductionTourRecord[] = (cache || []).filter((item: any) => item.type === 'induction_tour_record');

      if (isConnected) {
        const result = await listInductionTourRecords({
          empresa_id: empresaId || undefined,
          cliente_id: clienteId || undefined,
          contrato_id: contratoId || undefined,
          corpo_id: corpoId || undefined,
          puesto_id: puestoId || undefined,
          plaza_id: plazaId || undefined,
          refreshAccessToken,
          logout,
        });

        if (result.status && result.data) {
          const serverRecords = result.data as InductionTourRecord[];
          const unsynced = (localRecords || []).filter((r) => r.synced === false);
          const unsyncedIds = new Set(unsynced.map((r) => String(r.id || r.id_local || '')));
          const filteredServer = (serverRecords || []).filter((r) => !unsyncedIds.has(String(r.id || r.id_local || '')));
          setRecords([...unsynced, ...filteredServer]);
        } else {
          const unsynced = (localRecords || []).filter((r) => r.synced === false);
          setRecords(unsynced);
        }
      } else {
        setRecords(localRecords || []);
      }
    } catch (err) {
      console.error('Error fetching records:', err);
      setError('Error al cargar los registros de inducción y recorrido');
      try {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const recordsCache = cache.filter((item: any) => item.type === 'induction_tour_record');
          setRecords(recordsCache);
        }
      } catch (cacheErr) {
        console.error('Error loading from cache:', cacheErr);
      }
    } finally {
      setIsLoading(false);
    }
  }, [refreshAccessToken, logout, filterEmpresaId, filterClienteId, filterContratoId, filterCorpoId, filterPuestoId, filterPlazaId, marcaEmpresaId, marcaClienteId, marcaContratoId, marcaCorpoId, marcaPuestoId, marcaPlazaId]);

  // Inicializar filtros jerárquicos con current_marca
  useEffect(() => {
    if (!structure || structure.length === 0) return;
    if (marcaEmpresaId && !filterEmpresaId) setFilterEmpresaId(marcaEmpresaId);
    if (marcaClienteId && !filterClienteId) setFilterClienteId(marcaClienteId);
    if (marcaContratoId && !filterContratoId) setFilterContratoId(marcaContratoId);
    if (marcaCorpoId && !filterCorpoId) setFilterCorpoId(marcaCorpoId);
    if (marcaPuestoId && !filterPuestoId) setFilterPuestoId(marcaPuestoId);
    if (marcaPlazaId && !filterPlazaId) setFilterPlazaId(marcaPlazaId);
  }, [structure, marcaEmpresaId, marcaClienteId, marcaContratoId, marcaCorpoId, marcaPuestoId, marcaPlazaId]);

  // Trigger fetch cuando cambien los filtros jerárquicos (excepto División)
  useEffect(() => {
    if (structure && structure.length > 0 && (filterEmpresaId || filterClienteId || filterContratoId || filterCorpoId || filterPuestoId || filterPlazaId)) {
      fetchRecords();
    }
  }, [filterEmpresaId, filterClienteId, filterContratoId, filterCorpoId, filterPuestoId, filterPlazaId]);

  useFocusEffect(
    useCallback(() => {
      loadMarcaContext();
      fetchMainStructure();
      fetchRecords();
      eventBus.on('connectionRestored', fetchRecords);
      return () => {
        eventBus.off('connectionRestored', fetchRecords);
      };
    }, [fetchRecords, fetchMainStructure])
  );

  const resetForm = () => {
    setFecha(new Date());
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
    // Cargar temas predefinidos
    const temasPredefinidos: TemaDesarrollado[] = TEMAS_PREDEFINIDOS.map(tema => ({
      tema: tema,
      respuesta: '',
      comentarios: '',
    }));
    setTemasDesarrollados(temasPredefinidos);
    setExpandedTemaIndices(temasPredefinidos.map((_, i) => i));
    // Cargar aspectos predefinidos
    const aspectosPredefinidos: AspectoEspecifico[] = ASPECTOS_PREDEFINIDOS.map(aspecto => ({
      aspecto: aspecto,
      respuesta: '',
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

  const startCreating = () => {
    setIsCreating(true);
    setEditingRecord(null);
    resetForm();
  };

  const cancelCreating = () => {
    setIsCreating(false);
    resetForm();
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

    setEditingRecord({
      id: record.id ? String(record.id) : null,
      id_local: record.id_local,
      fecha: record.fecha || '',
      division: record.division || 'Otros',
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
    // Cargar división - buscar el ID de división basado en el nombre
    const divisionName = record.division || 'Otros';
    setDivision(divisionName);
    // Mapear nombre de división al ID (4 = Seguridad, 5 = Aseo y limpieza)
    if (divisionName === 'Seguridad') {
      setFormDivisionId(4);
    } else if (divisionName === 'Aseo y limpieza') {
      setFormDivisionId(5);
    } else {
      setFormDivisionId(null);
    }
    setTemasDesarrollados(temasArray);
    setAspectosEspecificos(aspectosArray);
    setParticipantes(participantesArray);
    setFirmaSupervisor(formatSignatureForDisplay(record.firma_supervisor));
    setFirmaResponsableHash(record.firma_responsable || '');
    setExpandedTemaIndices(temasArray.map((_, i) => i));
    setExpandedAspectoIndices(aspectosArray.map((_, i) => i));
    setExpandedParticipanteIndices(participantesArray.map((_, i) => i));
  };

  const cancelEditing = () => {
    setEditingRecord(null);
    resetForm();
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
      respuesta: '',
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
      respuesta: '',
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

  const saveRecordHandler = async () => {
    const currentMarca = await AsyncStorage.getItem('current_marca');
    if (!currentMarca) {
      Alert.alert('Error', 'No se encontró la marca actual');
      return;
    }

    if (!formDivisionId) {
      Alert.alert('Error', 'División es obligatoria');
      return;
    }

    if (!firmaResponsableHash || !firmaResponsableHash.trim()) {
      Alert.alert('Error', 'Firma responsable (QR/Generar) es obligatoria');
      return;
    }

    const currentMarcaData = JSON.parse(currentMarca);

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas guardar este registro de inducción y recorrido?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const requestData = {
                marca_id: currentMarcaData.id,
                empresa_id: formEmpresaId,
                cliente_id: formClienteId,
                contrato_id: formContratoId,
                corpo_id: formCorpoId,
                puesto_id: formPuestoId || null,
                plaza_id: formPlazaId,
                fecha: formatDateForRequest(fecha) || null,
                division: division.trim(),
                renglon_edificio: renglonEdificio.trim() || null,
                supervisor_cliente: supervisorCliente.trim() || null,
                supervisor_corporacion: supervisorCorporacion.trim() || null,
                temas_desarrollados: temasDesarrollados.length > 0 ? JSON.stringify(temasDesarrollados) : null,
                aspectos_especificos: aspectosEspecificos.length > 0 ? JSON.stringify(aspectosEspecificos) : null,
                participantes: participantes.length > 0 ? JSON.stringify(participantes.map(p => ({
                  ...p,
                  firma: getBase64Only(p.firma),
                }))) : null,
                firma_supervisor: getBase64Only(firmaSupervisor),
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
                  Alert.alert('Éxito', 'Registro de inducción y recorrido guardado correctamente');
                  cancelCreating();
                  fetchRecords();
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
                  participantes: participantes.length > 0 ? JSON.stringify(participantes.map(p => ({
                    ...p,
                    firma: getBase64Only(p.firma),
                  }))) : null,
                  firma_supervisor: getBase64Only(firmaSupervisor),
                  firma_responsable: firmaResponsableHash.trim(),
                  created_at: new Date().toISOString(),
                  synced: false,
                };

                cache.push({ ...newRecordCache, type: 'induction_tour_record' });
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(cache));

                Alert.alert('Modo Offline', 'Registro de inducción y recorrido registrado localmente. Se sincronizará cuando haya conexión.');
                cancelCreating();
                fetchRecords();
              }
            } catch (err) {
              console.error('Error saving record:', err);
              Alert.alert('Error', 'No se pudo guardar el registro de inducción y recorrido');
            }
          },
        },
      ]
    );
  };

  const updateRecordHandler = async () => {
    if (!editingRecord) return;

    const recordId = editingRecord.id || editingRecord.id_local;
    if (!recordId) {
      Alert.alert('Error', 'ID de registro no encontrado para actualizar');
      return;
    }

    if (!formDivisionId) {
      Alert.alert('Error', 'División es obligatoria');
      return;
    }

    if (!firmaResponsableHash || !firmaResponsableHash.trim()) {
      Alert.alert('Error', 'Firma responsable (QR/Generar) es obligatoria');
      return;
    }

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas actualizar este registro de inducción y recorrido?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const requestData = {
                empresa_id: formEmpresaId,
                cliente_id: formClienteId,
                contrato_id: formContratoId,
                corpo_id: formCorpoId,
                puesto_id: formPuestoId || null,
                plaza_id: formPlazaId,
                fecha: formatDateForRequest(fecha) || null,
                division: division.trim(),
                renglon_edificio: renglonEdificio.trim() || null,
                supervisor_cliente: supervisorCliente.trim() || null,
                supervisor_corporacion: supervisorCorporacion.trim() || null,
                temas_desarrollados: temasDesarrollados.length > 0 ? JSON.stringify(temasDesarrollados) : null,
                aspectos_especificos: aspectosEspecificos.length > 0 ? JSON.stringify(aspectosEspecificos) : null,
                participantes: participantes.length > 0 ? JSON.stringify(participantes.map(p => ({
                  ...p,
                  firma: getBase64Only(p.firma),
                }))) : null,
                firma_supervisor: getBase64Only(firmaSupervisor),
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
                  Alert.alert('Éxito', 'Registro de inducción y recorrido actualizado correctamente');
                  cancelEditing();
                  fetchRecords();
                } else {
                  Alert.alert('Error', result.message || 'Error al actualizar el registro de inducción y recorrido');
                }
              } else {
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];

                const isLocal = String(editingRecord.id_local || '').startsWith('local-') && String(recordId).startsWith('local-');
                if (isLocal) {
                  // If it's a local (create pending) record, update the create action payload instead of adding an update
                  const idx = actions.findIndex((a: any) => a.id === editingRecord.id_local && a.action === 'create' && a.type === 'induction_tour_record');
                  if (idx !== -1) {
                    actions[idx] = {
                      ...actions[idx],
                      payload: { ...(actions[idx].payload || {}), ...requestData },
                      synced: false,
                    };
                    await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));
                  } else {
                    actions.push({
                      id: recordId,
                      action: 'update',
                      type: 'induction_tour_record',
                      payload: requestData,
                      synced: false,
                    });
                    await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));
                  }
                } else {
                  // Deduplicate updates for server records
                  const filtered = actions.filter((a: any) => !(a.id === recordId && a.action === 'update' && a.type === 'induction_tour_record'));
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

                Alert.alert('Modo Offline', 'Registro de inducción y recorrido actualizado localmente. Se sincronizará cuando haya conexión.');
                cancelEditing();
                fetchRecords();
              }
            } catch (err) {
              console.error('Error updating record:', err);
              Alert.alert('Error', 'No se pudo actualizar el registro de inducción y recorrido');
            }
          },
        },
      ]
    );
  };

  const deleteRecordHandler = async (record: InductionTourRecord) => {
    const recordId = record.id || record.id_local;
    if (!recordId) {
      Alert.alert('Error', 'ID de registro no encontrado para eliminar');
      return;
    }

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas eliminar este registro de inducción y recorrido?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await deleteInductionTourRecord({
                  id: String(recordId),
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Registro de inducción y recorrido eliminado correctamente');
                  fetchRecords();
                } else {
                  Alert.alert('Error', result.message || 'Error al eliminar el registro de inducción y recorrido');
                }
              } else {
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];

                const isLocal = String(record.id_local || '').startsWith('local-') && String(recordId).startsWith('local-');
                if (isLocal) {
                  // Remove pending create/update actions for local record instead of queuing a delete
                  const filteredActions = actions.filter((a: any) => !(a.id === record.id_local && a.type === 'induction_tour_record'));
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
                  const updatedCache = cache.filter((item: any) => !((item.id === recordId || item.id_local === recordId) && item.type === 'induction_tour_record'));
                  await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                }

                Alert.alert('Modo Offline', 'Registro de inducción y recorrido marcado para eliminación localmente. Se sincronizará cuando haya conexión.');
                fetchRecords();
              }
            } catch (err) {
              console.error('Error deleting record:', err);
              Alert.alert('Error', 'No se pudo eliminar el registro de inducción y recorrido');
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
                  <ThemedText style={styles.signatureInfoValue}>Hora: {info.timestamp || 'N/A'}</ThemedText>
                </>
              );
            })()}
          </ThemedView>
        )}
      </ThemedView>
    );
  };

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
        {records.map((record) => (
          <ThemedView key={record.id || record.id_local} style={styles.listItem}>
            <ThemedView style={styles.listItemHeader}>
              <ThemedView style={styles.listItemContent}>
                <ThemedText style={styles.listItemTitle}>
                  {record.renglon_edificio || 'N/A'}
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
                  Fecha: {formatDateForDisplay(record.fecha)}
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
                  style={[styles.listItemButton, styles.deleteButton]}
                  onPress={() => deleteRecordHandler(record)}
                >
                  {getActionIcon('delete')}
                </TouchableOpacity>
              </ThemedView>
            </ThemedView>
          </ThemedView>
        ))}
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
                  <Picker.Item label="Seleccionar..." value="" />
                  <Picker.Item label="SI" value="SI" />
                  <Picker.Item label="NO" value="NO" />
                  <Picker.Item label="NA" value="NA" />
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
                  <Picker.Item label="Seleccionar..." value="" />
                  <Picker.Item label="SI" value="SI" />
                  <Picker.Item label="NO" value="NO" />
                  <Picker.Item label="NA" value="NA" />
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
                No se encontró una marca seleccionada. Por favor, selecciona una marca desde el menú principal.
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
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Empresa *</ThemedText>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={formEmpresaId || ''}
                    onValueChange={(value) => {
                      setFormEmpresaId(value && value !== '' ? Number(value) : null);
                      setFormClienteId(null);
                      setFormDivisionId(null);
                      setFormContratoId(null);
                      setFormCorpoId(null);
                      setFormPuestoId(null);
                      setFormPlazaId(null);
                      setDivision('Otros');
                    }}
                    style={styles.picker}
                  >
                    <Picker.Item label="Seleccionar..." value="" />
                    {formEmpresas.map((e: any) => (
                      <Picker.Item key={e.id} label={e.nombre} value={e.id} />
                    ))}
                  </Picker>
                </View>
              </ThemedView>

              {formEmpresaId && (
                <ThemedView style={styles.formGroup}>
                  <ThemedText style={styles.formLabel}>Cliente *</ThemedText>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={formClienteId || ''}
                      onValueChange={(value) => {
                        setFormClienteId(value && value !== '' ? Number(value) : null);
                        setFormDivisionId(null);
                        setFormContratoId(null);
                        setFormCorpoId(null);
                        setFormPuestoId(null);
                        setFormPlazaId(null);
                        setDivision('Otros');
                      }}
                      style={styles.picker}
                    >
                      <Picker.Item label="Seleccionar..." value="" />
                      {formClientes.map((c: any) => (
                        <Picker.Item key={c.id} label={c.nombre} value={c.id} />
                      ))}
                    </Picker>
                  </View>
                </ThemedView>
              )}

              {formClienteId && (
                <ThemedView style={styles.formGroup}>
                  <ThemedText style={styles.formLabel}>División *</ThemedText>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={formDivisionId || ''}
                      onValueChange={(value) => {
                        const divisionId = value && value !== '' ? Number(value) : null;
                        setFormDivisionId(divisionId);
                        // Mapear ID de división al nombre
                        if (divisionId === 4) {
                          setDivision('Seguridad');
                        } else if (divisionId === 5) {
                          setDivision('Aseo y limpieza');
                        } else {
                          setDivision('Otros');
                        }
                        // Resetear temas y aspectos cuando cambia la división
                        const temasPredefinidos: TemaDesarrollado[] = TEMAS_PREDEFINIDOS.map(tema => ({
                          tema: tema,
                          respuesta: '',
                          comentarios: '',
                        }));
                        setTemasDesarrollados(temasPredefinidos);
                        setExpandedTemaIndices(temasPredefinidos.map((_, i) => i));
                        const aspectosPredefinidos: AspectoEspecifico[] = ASPECTOS_PREDEFINIDOS.map(aspecto => ({
                          aspecto: aspecto,
                          respuesta: '',
                          comentarios: '',
                        }));
                        setAspectosEspecificos(aspectosPredefinidos);
                        setExpandedAspectoIndices(aspectosPredefinidos.map((_, i) => i));
                      }}
                      style={styles.picker}
                    >
                      <Picker.Item label="Seleccionar..." value="" />
                      {formDivisiones.map((d: any) => (
                        <Picker.Item key={d.id} label={d.nombre} value={d.id} />
                      ))}
                    </Picker>
                  </View>
                </ThemedView>
              )}

              {formClienteId && (
                <ThemedView style={styles.formGroup}>
                  <ThemedText style={styles.formLabel}>Contrato *</ThemedText>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={formContratoId || ''}
                      onValueChange={(value) => {
                        setFormContratoId(value && value !== '' ? Number(value) : null);
                        setFormCorpoId(null);
                        setFormPuestoId(null);
                        setFormPlazaId(null);
                      }}
                      style={styles.picker}
                    >
                      <Picker.Item label="Seleccionar..." value="" />
                      {formContratos.map((c: any) => (
                        <Picker.Item key={c.id} label={c.nombre} value={c.id} />
                      ))}
                    </Picker>
                  </View>
                </ThemedView>
              )}

              {formContratoId && (
                <ThemedView style={styles.formGroup}>
                  <ThemedText style={styles.formLabel}>Sucursal *</ThemedText>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={formCorpoId || ''}
                      onValueChange={(value) => {
                        setFormCorpoId(value && value !== '' ? Number(value) : null);
                        setFormPuestoId(null);
                        setFormPlazaId(null);
                      }}
                      style={styles.picker}
                    >
                      <Picker.Item label="Seleccionar..." value="" />
                      {formSucursales.map((s: any) => (
                        <Picker.Item key={s.id} label={s.nombre} value={s.id} />
                      ))}
                    </Picker>
                  </View>
                </ThemedView>
              )}

              {formCorpoId && (
                <ThemedView style={styles.formGroup}>
                  <ThemedText style={styles.formLabel}>Puesto</ThemedText>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={formPuestoId || ''}
                      onValueChange={(value) => {
                        setFormPuestoId(value && value !== '' ? Number(value) : null);
                        setFormPlazaId(null);
                      }}
                      style={styles.picker}
                    >
                      <Picker.Item label="Seleccionar..." value="" />
                      {formPuestos.map((p: any) => (
                        <Picker.Item key={p.id} label={p.nombre} value={p.id} />
                      ))}
                    </Picker>
                  </View>
                </ThemedView>
              )}

              {formPuestoId && (
                <ThemedView style={styles.formGroup}>
                  <ThemedText style={styles.formLabel}>Plaza *</ThemedText>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={formPlazaId || ''}
                      onValueChange={(value) => {
                        setFormPlazaId(value && value !== '' ? Number(value) : null);
                      }}
                      style={styles.picker}
                    >
                      <Picker.Item label="Seleccionar..." value="" />
                      {formPlazas.map((p: any) => (
                        <Picker.Item key={p.id} label={p.nombre} value={p.id} />
                      ))}
                    </Picker>
                  </View>
                </ThemedView>
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
                            <ThemedText style={styles.signatureInfoValue}>Hora: {info.timestamp || 'N/A'}</ThemedText>
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

              <ThemedView style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.cancelButton]}
                  onPress={editingRecord ? cancelEditing : cancelCreating}
                >
                  {getActionIcon('cancel')}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.saveButton]}
                  onPress={editingRecord ? updateRecordHandler : saveRecordHandler}
                >
                  {getActionIcon('confirm')}
                </TouchableOpacity>
              </ThemedView>
            </ThemedView>
          ) : (
            <ThemedView style={styles.listSection}>
              {/* Filtros Jerárquicos */}
              {!isLoading && (
                <ThemedView style={styles.filtersContainer}>
                  <ThemedView style={styles.filtersHeader}>
                    <TouchableOpacity
                      style={styles.filterToggleButton}
                      onPress={() => setIsHierarchyFiltersExpanded(!isHierarchyFiltersExpanded)}
                    >
                      <ThemedText style={styles.filtersTitle}>
                        Filtros Jerárquicos
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
                          setFilterEmpresaId(null);
                          setFilterClienteId(null);
                          setFilterContratoId(null);
                          setFilterCorpoId(null);
                          setFilterPuestoId(null);
                          setFilterPlazaId(null);
                        }}
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
                              setFilterContratoId(null);
                              setFilterCorpoId(null);
                              setFilterPuestoId(null);
                              setFilterPlazaId(null);
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

                      {filterEmpresaId && (
                        <ThemedView style={styles.filterGroup}>
                          <ThemedText style={styles.filterLabel}>Cliente:</ThemedText>
                          <View style={styles.pickerWrapper}>
                            <Picker
                              selectedValue={filterClienteId || ''}
                              onValueChange={(value) => {
                                setFilterClienteId(value && value !== '' ? Number(value) : null);
                                setFilterContratoId(null);
                                setFilterCorpoId(null);
                                setFilterPuestoId(null);
                                setFilterPlazaId(null);
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
                      )}

                      {filterClienteId && (
                        <ThemedView style={styles.filterGroup}>
                          <ThemedText style={styles.filterLabel}>División:</ThemedText>
                          <View style={styles.pickerWrapper}>
                            <Picker
                              selectedValue={''}
                              enabled={false}
                              style={styles.picker}
                            >
                              <Picker.Item label="Seleccionar..." value="" />
                              {filterDivisiones.map((d: any) => (
                                <Picker.Item key={d.id} label={d.nombre} value={d.id} />
                              ))}
                            </Picker>
                          </View>
                        </ThemedView>
                      )}

                      {filterClienteId && (
                        <ThemedView style={styles.filterGroup}>
                          <ThemedText style={styles.filterLabel}>Contrato:</ThemedText>
                          <View style={styles.pickerWrapper}>
                            <Picker
                              selectedValue={filterContratoId || ''}
                              onValueChange={(value) => {
                                setFilterContratoId(value && value !== '' ? Number(value) : null);
                                setFilterCorpoId(null);
                                setFilterPuestoId(null);
                                setFilterPlazaId(null);
                              }}
                              style={styles.picker}
                            >
                              <Picker.Item label="Seleccionar..." value="" />
                              {filterContratos.map((c: any) => (
                                <Picker.Item key={c.id} label={c.nombre} value={c.id} />
                              ))}
                            </Picker>
                          </View>
                        </ThemedView>
                      )}

                      {filterContratoId && (
                        <ThemedView style={styles.filterGroup}>
                          <ThemedText style={styles.filterLabel}>Sucursal:</ThemedText>
                          <View style={styles.pickerWrapper}>
                            <Picker
                              selectedValue={filterCorpoId || ''}
                              onValueChange={(value) => {
                                setFilterCorpoId(value && value !== '' ? Number(value) : null);
                                setFilterPuestoId(null);
                                setFilterPlazaId(null);
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
                      )}

                      {filterCorpoId && (
                        <ThemedView style={styles.filterGroup}>
                          <ThemedText style={styles.filterLabel}>Puesto:</ThemedText>
                          <View style={styles.pickerWrapper}>
                            <Picker
                              selectedValue={filterPuestoId || ''}
                              onValueChange={(value) => {
                                setFilterPuestoId(value && value !== '' ? Number(value) : null);
                                setFilterPlazaId(null);
                              }}
                              style={styles.picker}
                            >
                              <Picker.Item label="Seleccionar..." value="" />
                              {filterPuestos.map((p: any) => (
                                <Picker.Item key={p.id} label={p.nombre} value={p.id} />
                              ))}
                            </Picker>
                          </View>
                        </ThemedView>
                      )}

                      {filterPuestoId && (
                        <ThemedView style={styles.filterGroup}>
                          <ThemedText style={styles.filterLabel}>Plaza:</ThemedText>
                          <View style={styles.pickerWrapper}>
                            <Picker
                              selectedValue={filterPlazaId || ''}
                              onValueChange={(value) => {
                                setFilterPlazaId(value && value !== '' ? Number(value) : null);
                              }}
                              style={styles.picker}
                            >
                              <Picker.Item label="Seleccionar..." value="" />
                              {filterPlazas.map((p: any) => (
                                <Picker.Item key={p.id} label={p.nombre} value={p.id} />
                              ))}
                            </Picker>
                          </View>
                        </ThemedView>
                      )}
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
  // Filtros jerárquicos
  filtersContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  filtersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  filterToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filtersTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
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
    gap: 12,
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

