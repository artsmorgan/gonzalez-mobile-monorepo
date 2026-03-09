import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  View,
  Platform,
  Image
} from 'react-native';
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
import { Picker } from '@react-native-picker/picker';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import * as Location from 'expo-location';
import SignatureScreen from "react-native-signature-canvas";
import { jwtDecode } from 'jwt-decode';
import getHoraAccion from '@/hooks/getHoraAccion';
import * as Network from 'expo-network';
import { createSurvey as createSurveyAPI, updateSurveySignature } from '@/hooks/surveysFunctions';
import { eventBus } from '@/hooks/eventBus';
import authedFetch from '@/hooks/authedFetch';
import getValidAccessTokenOrLogout from '@/hooks/getValidAccessTokenOrLogout';

type SatisfactionSurveysScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'SatisfactionSurveys'>;

interface Puesto {
  id: number;
  nombre: string;
}

interface Survey {
  id: number;
  id_local: string;
  persona_evaluada: string;
  empresa_evaluada: string;
  cedula_persona_evaluada: string;
  telefono_persona_evaluada: string;
  email_persona_evaluada: string;
  firma_persona_evaluada: string;
  empresa: {
    id: number;
    nombre: string;
  };
  sucursal: {
    id: number;
    nombre: string;
  };
  puesto: {
    id: number;
    nombre: string;
  };
  division: {
    id: number;
    nombre: string;
  };
  responsable_id: number;
  responsable: {
    nombre: string;
    cedula: string;
  };
  firma_responsable: string;
  nombre_firma: string;
  fecha: string;
  evaluaciones: string; // JSON string array
  observations: string;
}

interface Question {
  title: string;
  inputs: {
    type: 'punctuation' | 'radio' | 'text' | 'select';
    length?: string;
    options?: string[];
    required: boolean;
  };
}

interface Answer {
  question: string;
  value: string | number;
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

const QUESTIONS_SEGURIDAD: Question[] = [
  {
    title: "¿Cómo Califica el  trato del personal hacia el  publico y los funcionarios?",
    inputs: { type: "punctuation", length: "5", required: true }
  },
  {
    title: "¿Domina el personal los lineamientos del puesto de trabajo?",
    inputs: { type: "punctuation", length: "5", required: true }
  },
  {
    title: "¿El equipo de trabajo diario se encuentra en optimas condiciones?",
    inputs: { type: "punctuation", length: "5", required: true }
  },
  {
    title: "¿Cómo califica el servicio  recibido por el personal?",
    inputs: { type: "punctuation", length: "5", required: true }
  },
  {
    title: "¿Cómo califica el servicio de la supervision realizada por nuestro personal?",
    inputs: { type: "punctuation", length: "5", required: true }
  },
  {
    title: "¿Cómo califica la calidad del servicio en cuanto a nuestro trabajo?",
    inputs: { type: "punctuation", length: "5", required: true }
  },
  {
    title: "¿La empresa Cumple el servicio con lo estipulado en el contrato? ",
    inputs: { type: "punctuation", length: "5", required: true }
  },
  {
    title: "¿Son atendidas sus quejas en el plazo acordado con el personal que lo atiende?",
    inputs: { type: "punctuation", length: "5", required: true }
  },
  {
    title: "¿Cómo califica la comunicación  entre la compañia y usted como cliente?",
    inputs: { type: "punctuation", length: "5", required: true }
  },
  {
    title: "¿Cuál es su nivel de satisfacción global respecto al servicio que le brindamos?",
    inputs: { type: "punctuation", length: "5", required: true }
  },
  {
    title: "¿Conoce el procedimiento de atención de quejas de la compañía? Para el caso de seguridad el correo es gerenteseg@corporaciongonzalez.com",
    inputs: { type: "punctuation", length: "5", required: true }
  },
];

const QUESTIONS_ASEO: Question[] = [
  {
    title: "¿Cómo Califica el  trato del personal hacia el  publico y los funcionarios?",
    inputs: { type: "punctuation", length: "5", required: true }
  },
  {
    title: "¿Domina el personal los lineamientos del puesto de trabajo?",
    inputs: { type: "punctuation", length: "5", required: true }
  },
  {
    title: "¿El equipo de trabajo diario se encuentra en optimas condiciones?",
    inputs: { type: "punctuation", length: "5", required: true }
  },
  {
    title: "¿Cómo califica el servicio  recibido por el personal?",
    inputs: { type: "punctuation", length: "5", required: true }
  },
  {
    title: "¿Cómo califica el servicio de la supervision realizada por nuestro personal?",
    inputs: { type: "punctuation", length: "5", required: true }
  },
  {
    title: "¿Cómo califica la calidad del servicio en cuanto a nuestro trabajo?",
    inputs: { type: "punctuation", length: "5", required: true }
  },
  {
    title: "¿La empresa Cumple el servicio con lo estipulado en el contrato? ",
    inputs: { type: "punctuation", length: "5", required: true }
  },
  {
    title: "¿Son atendidas sus quejas en el plazo acordado con el personal que lo atiende?",
    inputs: { type: "punctuation", length: "5", required: true }
  },
  {
    title: "¿Cómo califica la comunicación  entre la compañia y usted como cliente?",
    inputs: { type: "punctuation", length: "5", required: true }
  },
  {
    title: "¿Cuál es su nivel de satisfacción global respecto al servicio que le brindamos?",
    inputs: { type: "punctuation", length: "5", required: true }
  },
  {
    title: "¿Conoce el procedimiento de atención de quejas de la compañía? Para el caso de Aseo el correo es gerenteaseo@corporaciongonzalez",
    inputs: { type: "punctuation", length: "5", required: true }
  },
];

// Función para obtener las preguntas según la división
const getQuestionsForDivision = (division: string): Question[] => {
  if (division === 'Seguridad') {
    return QUESTIONS_SEGURIDAD;
  } else if (division === 'Aseo & Limpieza') {
    return QUESTIONS_ASEO;
  }
  // Por defecto, retornar preguntas de Seguridad
  return QUESTIONS_SEGURIDAD;
};

export default function SatisfactionSurveysScreen() {
  const { employee, refreshAccessToken, logout } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<SatisfactionSurveysScreenNavigationProp>();

  // Data state
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [puestos, setPuestos] = useState<Puesto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasCurrentMarca, setHasCurrentMarca] = useState<boolean>(false);
  const [isCheckingMarca, setIsCheckingMarca] = useState<boolean>(true);

  // Estados para filtros jerárquicos
  const [structure, setStructure] = useState<any[]>([]);
  const [isStructureLoading, setIsStructureLoading] = useState(false);
  const [filterEmpresaId, setFilterEmpresaId] = useState<number | null>(null);
  const [filterClienteId, setFilterClienteId] = useState<number | null>(null);
  const [filterDivisionId, setFilterDivisionId] = useState<number | null>(null);
  const [filterContratoId, setFilterContratoId] = useState<number | null>(null);
  const [filterCorpoId, setFilterCorpoId] = useState<number | null>(null);
  const [filterPuestoId, setFilterPuestoId] = useState<number | null>(null);

  // IDs de current_marca para inicialización
  const [marcaClienteId, setMarcaClienteId] = useState<number | null>(null);
  const [marcaCorpoId, setMarcaCorpoId] = useState<number | null>(null);
  const [marcaPuestoId, setMarcaPuestoId] = useState<number | null>(null);
  const [marcaEmpresaId, setMarcaEmpresaId] = useState<number | null>(null);
  const [marcaDivisionId, setMarcaDivisionId] = useState<number | null>(null);
  const [isHierarchyFiltersExpanded, setIsHierarchyFiltersExpanded] = useState(false);

  // Estados para jerarquía seleccionada en el formulario
  const [formEmpresaId, setFormEmpresaId] = useState<number | null>(null);
  const [formClienteId, setFormClienteId] = useState<number | null>(null);
  const [formDivisionId, setFormDivisionId] = useState<number | null>(null);
  const [formContratoId, setFormContratoId] = useState<number | null>(null);
  const [formCorpoId, setFormCorpoId] = useState<number | null>(null);
  const [formPuestoId, setFormPuestoId] = useState<number | null>(null);

  // Form states
  const [isCreating, setIsCreating] = useState(false);

  // Form refs
  const empresaEvaluadaRef = useRef<string>('');
  const personaNombreRef = useRef<string>('');
  const personaCedulaRef = useRef<string>('');
  const personaTelefonoRef = useRef<string>('');
  const personaEmailRef = useRef<string>('');
  const puestoIdRef = useRef<number>(0);
  const fechaEncuestaRef = useRef<string>('');
  const divisionRef = useRef<string>('Seguridad');
  const observacionesRef = useRef<string>('');
  const responsableNombreRef = useRef<string>('');
  const responsableCedulaRef = useRef<string>('');

  // Controlled states
  const [selectedPuesto, setSelectedPuesto] = useState<number>(0);
  const [fechaEncuesta, setFechaEncuesta] = useState<Date>(new Date());
  const [showFechaEncuestaPicker, setShowFechaEncuestaPicker] = useState(false);
  const [selectedDivision, setSelectedDivision] = useState<string>('Seguridad');

  // Answers state and ref
  const [answers, setAnswers] = useState<{ [key: number]: string | number }>({});
  const answersRef = useRef<{ [key: number]: string | number }>({});

  // Signature states
  const [personSignature, setPersonSignature] = useState<string | null>(null);
  const personSignatureRef = useRef<string | null>(null);
  const [firmaResponsable, setFirmaResponsable] = useState<FirmaData | null>(null);
  const [isGeneratingFirmaResponsable, setIsGeneratingFirmaResponsable] = useState(false);
  const signatureRef = useRef<any>(null);
  const [signatureKey, setSignatureKey] = useState(0);
  const [isSignatureModalVisible, setIsSignatureModalVisible] = useState(false);
  const [tempSignature, setTempSignature] = useState<string | null>(null);

  // Form key for forcing re-render
  const [formKey, setFormKey] = useState(0);

  // Collapsable states
  const [expandedSurveys, setExpandedSurveys] = useState<Set<number>>(new Set());
  const [decodedFirmas, setDecodedFirmas] = useState<Map<number, { responsable: FirmaData | null; persona: string | null }>>(new Map());

  // Filters state
  const [filterFecha, setFilterFecha] = useState('');
  const [filterEmpresaEvaluada, setFilterEmpresaEvaluada] = useState('');
  const [filterSucursal, setFilterSucursal] = useState('');
  const [filterPuesto, setFilterPuesto] = useState('');
  const [filterDivision, setFilterDivision] = useState('');
  const [filterPersonaEvaluada, setFilterPersonaEvaluada] = useState('');
  const [filterCedulaPersonaEvaluada, setFilterCedulaPersonaEvaluada] = useState('');
  const [filterTelefonoPersonaEvaluada, setFilterTelefonoPersonaEvaluada] = useState('');
  const [filterEmailPersonaEvaluada, setFilterEmailPersonaEvaluada] = useState('');
  const [filterResponsableNombre, setFilterResponsableNombre] = useState('');
  const [filterResponsableCedula, setFilterResponsableCedula] = useState('');
  const [filterObservations, setFilterObservations] = useState('');
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  const [showFilterFechaPicker, setShowFilterFechaPicker] = useState(false);

  // Modal: añadir firma persona evaluada (en lista, cuando falta)
  const [addSignatureModalVisible, setAddSignatureModalVisible] = useState(false);
  const [addSignatureSurvey, setAddSignatureSurvey] = useState<Survey | null>(null);
  const addSignatureManualRef = useRef<any>(null);
  const [addSignatureManualKey, setAddSignatureManualKey] = useState(0);
  const [isAddSignatureSubmitting, setIsAddSignatureSubmitting] = useState(false);

  // Input refs
  const empresaEvaluadaInputRef = useRef<TextInput>(null);
  const personaNombreInputRef = useRef<TextInput>(null);
  const personaCedulaInputRef = useRef<TextInput>(null);
  const personaTelefonoInputRef = useRef<TextInput>(null);
  const personaEmailInputRef = useRef<TextInput>(null);
  const observacionesInputRef = useRef<TextInput>(null);
  const responsableNombreInputRef = useRef<TextInput>(null);
  const responsableCedulaInputRef = useRef<TextInput>(null);


  const getConnectionStatus = async (): Promise<boolean> => {
    const networkState = await Network.getNetworkStateAsync();
    return networkState.isConnected && networkState.isInternetReachable ? true : false;
  };

  const loadMarcaContext = async () => {
    setIsCheckingMarca(true);
    const currentMarcaStr = await AsyncStorage.getItem('current_marca');
    if (!currentMarcaStr) {
      setHasCurrentMarca(false);
      setMarcaClienteId(null);
      setMarcaCorpoId(null);
      setMarcaPuestoId(null);
      setIsCheckingMarca(false);
      return null;
    }
    try {
      const current = JSON.parse(currentMarcaStr);
      if (!current?.id) {
        setHasCurrentMarca(false);
        setMarcaClienteId(null);
        setMarcaCorpoId(null);
        setMarcaPuestoId(null);
        setIsCheckingMarca(false);
        return null;
      }
      setHasCurrentMarca(true);

      // Obtener IDs de empresa, cliente, corpo, puesto y división de current_marca
      const empresaIdRaw = current?.empresa?.id ?? current?.empresa_id;
      const clienteIdRaw = current?.cliente?.id ?? current?.cliente_id;
      const corpoIdRaw = current?.corpo?.id ?? current?.corpo_id;
      const puestoIdRaw = current?.puesto?.id ?? current?.puesto_id;
      const divisionIdRaw = current?.division?.id ?? current?.division_id;

      setMarcaEmpresaId(empresaIdRaw !== undefined && empresaIdRaw !== null ? Number(empresaIdRaw) : null);
      setMarcaClienteId(clienteIdRaw !== undefined && clienteIdRaw !== null ? Number(clienteIdRaw) : null);
      setMarcaCorpoId(corpoIdRaw !== undefined && corpoIdRaw !== null ? Number(corpoIdRaw) : null);
      setMarcaPuestoId(puestoIdRaw !== undefined && puestoIdRaw !== null ? Number(puestoIdRaw) : null);
      setMarcaDivisionId(divisionIdRaw !== undefined && divisionIdRaw !== null ? Number(divisionIdRaw) : null);

      // Inicializar también los valores del formulario
      setFormEmpresaId(empresaIdRaw !== undefined && empresaIdRaw !== null ? Number(empresaIdRaw) : null);
      setFormClienteId(clienteIdRaw !== undefined && clienteIdRaw !== null ? Number(clienteIdRaw) : null);
      setFormCorpoId(corpoIdRaw !== undefined && corpoIdRaw !== null ? Number(corpoIdRaw) : null);
      setFormPuestoId(puestoIdRaw !== undefined && puestoIdRaw !== null ? Number(puestoIdRaw) : null);
      setFormDivisionId(divisionIdRaw !== undefined && divisionIdRaw !== null ? Number(divisionIdRaw) : null);

      setIsCheckingMarca(false);
      return current;
    } catch {
      setHasCurrentMarca(false);
      setMarcaClienteId(null);
      setMarcaCorpoId(null);
      setMarcaPuestoId(null);
      setIsCheckingMarca(false);
      return null;
    }
  };

  // Refs para evitar recrear funciones y controlar carga
  const hasLoadedMainStructureRef = useRef(false);
  const hasLoadedInitialDataRef = useRef(false);
  const isInitialLoadRef = useRef(true);

  const fetchMainStructure = useCallback(async () => {
    // Solo cargar una vez
    if (hasLoadedMainStructureRef.current) return;

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
      else {
        setStructure([]);
      }
      /*
      const isConnected = await getConnectionStatus();
      if (!isConnected) {
        hasLoadedMainStructureRef.current = true;
        return;
      }

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
      if (!response) {
        hasLoadedMainStructureRef.current = true;
        return;
      }

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      const incoming = data?.structure;
      if (data?.status && Array.isArray(incoming)) {
        setStructure(incoming);
        await AsyncStorage.setItem('main_structure_cache', JSON.stringify(incoming));
      }
        */
      hasLoadedMainStructureRef.current = true;
    } catch (e) {
      console.error('Error fetching main structure for satisfaction surveys:', e);
      hasLoadedMainStructureRef.current = true;
    } finally {
      setIsStructureLoading(false);
    }
  }, [refreshAccessToken, logout]);

  // Nodos computados para estructura jerárquica de filtros
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

  const filterPuestos = useMemo(() => {
    const sucursal = filterSucursales.find((s: any) => s.id === filterCorpoId);
    return sucursal?.puestos || [];
  }, [filterSucursales, filterCorpoId]);

  // Nodos computados para estructura jerárquica del formulario
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
    const division = formDivisiones.find((d: any) => d.id === formDivisionId);
    return division?.contratos || [];
  }, [formDivisiones, formDivisionId]);

  const formSucursales = useMemo(() => {
    const contrato = formContratos.find((c: any) => c.id === formContratoId);
    return contrato?.sucursales || [];
  }, [formContratos, formContratoId]);

  const formPuestosList = useMemo(() => {
    const sucursal = formSucursales.find((s: any) => s.id === formCorpoId);
    return sucursal?.puestos || [];
  }, [formSucursales, formCorpoId]);

  const generateRandomId = (): string => {
    return `local_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  };

  // Ref para evitar cargar puestos múltiples veces para el mismo corpo
  const lastLoadedCorpoIdRef = useRef<number | null>(null);

  // Función separada para cargar puestos
  const fetchPuestosForCorpo = useCallback(async (corpoId: number, forceReload: boolean = false) => {
    // Solo cargar si es un corpo diferente o si se fuerza la recarga
    if (!forceReload && lastLoadedCorpoIdRef.current === corpoId) {
      return;
    }

    try {
      const isConnected = await getConnectionStatus();
      if (!isConnected) {
        // Cargar desde cache
        const puestosCache = await AsyncStorage.getItem('surveys_puestos_cache');
        if (puestosCache) {
          const cachedPuestos = JSON.parse(puestosCache);
          setPuestos(cachedPuestos);
        }
        lastLoadedCorpoIdRef.current = corpoId;
        return;
      }

      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) return;
      const puestosResponse = await authedFetch({
        url: `${apiUrl}/api/puestos/corpo/${corpoId}`,
        init: {
          method: 'GET',
        },
        refreshAccessToken,
        logout,
      });
      if (!puestosResponse) return;

      if (puestosResponse.ok) {
        const puestosData = await puestosResponse.json();
        if (puestosData.status && puestosData.puestos) {
          setPuestos(puestosData.puestos);
          await AsyncStorage.setItem('surveys_puestos_cache', JSON.stringify(puestosData.puestos));
          lastLoadedCorpoIdRef.current = corpoId;
        }
      }
    } catch (err) {
      console.error('Error fetching puestos for corpo:', err);
    }
  }, [refreshAccessToken, logout]);

  // Ref para controlar si ya se mostró el alert de modo offline
  const hasShownOfflineAlertRef = useRef(false);

  // Función separada para cargar encuestas (sin cargar puestos)
  const fetchSurveys = useCallback(async (showOfflineAlert: boolean = true) => {
    try {
      setIsLoading(true);

      const isConnected = await getConnectionStatus();

      if (isConnected) {
        // Con internet: hacer fetch normal
        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) {
          throw new Error('Server URL not configured');
        }

        // Construir parámetros de filtro (jerarquía completa)
        const params = new URLSearchParams();
        if (filterEmpresaId) params.append('empresa_id', String(filterEmpresaId));
        if (filterClienteId) params.append('cliente_id', String(filterClienteId));
        if (filterDivisionId) params.append('division_id', String(filterDivisionId));
        if (filterContratoId) params.append('contrato_id', String(filterContratoId));
        if (filterCorpoId) params.append('corpo_id', String(filterCorpoId));
        if (filterPuestoId) params.append('puesto_id', String(filterPuestoId));

        // Fetch surveys
        const surveysResponse = await authedFetch({
          url: `${apiUrl}/api/encuesta-nps?${params.toString()}`,
          init: {
            method: 'GET',
          },
          refreshAccessToken,
          logout,
        });
        if (!surveysResponse) return;

        const surveysData = await surveysResponse.json();

        if (surveysData.status && surveysData.encuestas) {
          // Agregar id_local vacío si no existe
          const surveysWithLocalId = surveysData.encuestas.map((survey: Survey) => ({
            ...survey,
            id_local: survey.id_local || '',
          }));
          setSurveys(surveysWithLocalId);
          // Actualizar surveys_cache
          await AsyncStorage.setItem('surveys_cache', JSON.stringify(surveysWithLocalId));
        } else {
          setSurveys([]);
        }
        // Resetear el flag cuando hay conexión
        hasShownOfflineAlertRef.current = false;
      } else {
        // Sin internet: cargar desde cache
        const surveysCache = await AsyncStorage.getItem('surveys_cache');
        if (surveysCache) {
          const cachedSurveys = JSON.parse(surveysCache);
          // Asegurar que todos tengan id_local
          const surveysWithLocalId = cachedSurveys.map((s: Survey) => ({
            ...s,
            id_local: s.id_local || '',
          }));
          setSurveys(surveysWithLocalId);
        } else {
          setSurveys([]);
        }

        // Solo mostrar alert en la carga inicial o cuando se restaura la conexión
        if (showOfflineAlert && !hasShownOfflineAlertRef.current) {
          Alert.alert('Modo Offline', 'No hay conexión a internet. Mostrando datos guardados.');
          hasShownOfflineAlertRef.current = true;
        }
      }

    } catch (err) {
      console.error('Error fetching surveys:', err);
      // En caso de error, intentar cargar desde cache
      try {
        const surveysCache = await AsyncStorage.getItem('surveys_cache');
        if (surveysCache) {
          const cachedSurveys = JSON.parse(surveysCache);
          const surveysWithLocalId = cachedSurveys.map((s: Survey) => ({
            ...s,
            id_local: s.id_local || '',
          }));
          setSurveys(surveysWithLocalId);
          if (showOfflineAlert && !hasShownOfflineAlertRef.current) {
            Alert.alert('Modo Offline', 'Error de conexión. Mostrando datos guardados.');
            hasShownOfflineAlertRef.current = true;
          }
        } else {
          if (showOfflineAlert) {
            Alert.alert('Error', 'No se pudieron cargar las encuestas');
          }
        }
      } catch (cacheErr) {
        if (showOfflineAlert) {
          Alert.alert('Error', 'No se pudieron cargar las encuestas');
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [filterEmpresaId, filterClienteId, filterDivisionId, filterContratoId, filterCorpoId, filterPuestoId, refreshAccessToken, logout]);

  // Función para cargar datos iniciales (main_structure y surveys_puestos)
  // Solo se ejecuta una vez al abrir la ventana
  const loadInitialData = useCallback(async () => {
    if (hasLoadedInitialDataRef.current) return;
    hasLoadedInitialDataRef.current = true;

    const current = await loadMarcaContext();
    await fetchMainStructure();

    // Inicializar filtros con valores de current_marca después de cargar
    if (current) {
      const clienteIdRaw = current?.cliente?.id ?? current?.cliente_id;
      const corpoIdRaw = current?.corpo?.id ?? current?.corpo_id;
      const puestoIdRaw = current?.puesto?.id ?? current?.puesto_id;

      if (clienteIdRaw !== undefined && clienteIdRaw !== null) {
        setFilterClienteId(Number(clienteIdRaw));
      }
      if (corpoIdRaw !== undefined && corpoIdRaw !== null) {
        setFilterCorpoId(Number(corpoIdRaw));
        // Cargar puestos para el corpo seleccionado
        await fetchPuestosForCorpo(Number(corpoIdRaw), true);
      }
      if (puestoIdRaw !== undefined && puestoIdRaw !== null) {
        setFilterPuestoId(Number(puestoIdRaw));
      }
    }
  }, [fetchMainStructure, fetchPuestosForCorpo]);

  // Cargar datos iniciales solo una vez al montar el componente
  useEffect(() => {
    let isMounted = true;
    isInitialLoadRef.current = true;
    (async () => {
      await loadInitialData();
      // Cargar encuestas después de cargar datos iniciales
      if (isMounted) {
        await fetchSurveys();
        isInitialLoadRef.current = false;
      }
    })();
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Solo se ejecuta una vez al montar

  // IMPORTANTE: Al actualizar los filtros solo se actualizan las encuestas
  // main_structure y puestos NO se recargan cuando cambian los filtros
  useEffect(() => {
    // Solo cargar si ya se cargó la estructura inicial y no es la carga inicial
    if (isInitialLoadRef.current) {
      return;
    }
    if (hasLoadedInitialDataRef.current && (structure.length > 0 || isStructureLoading === false)) {
      // Solo recargar encuestas cuando cambian los filtros
      // NO recargar main_structure ni puestos
      fetchSurveys(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterEmpresaId, filterClienteId, filterDivisionId, filterContratoId, filterCorpoId, filterPuestoId]);

  useEffect(() => {
    const handler = () => {
      // Resetear flag de alert cuando se restaura la conexión
      hasShownOfflineAlertRef.current = false;
      // Mostrar alert si es necesario
      fetchSurveys(true);
    };

    eventBus.on('connectionRestored', handler);
    return () => {
      eventBus.off('connectionRestored', handler);
    };
  }, [fetchSurveys]);

  // Función para rastrear el contrato de una sucursal
  const findContratoForSucursal = useCallback((sucursalId: number): number | null => {
    for (const empresa of structure) {
      for (const cliente of empresa.clientes || []) {
        for (const division of cliente.division || []) {
          for (const contrato of division.contratos || []) {
            for (const sucursal of contrato.sucursales || []) {
              if (sucursal.id === sucursalId) {
                return contrato.id;
              }
            }
          }
        }
      }
    }
    return null;
  }, [structure]);

  const fetchEmpleadoDetalle = async (empleadoId: number) => {
    try {
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) return null;
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
      if (!response) return null;

      if (!response.ok) return null;

      const data = await response.json();

      return {
        nombre: data.nombre || '',
        primer_apellido: data.primer_apellido || '',
        segundo_apellido: data.segundo_apellido || '',
      };
    } catch (error) {
      console.error('Error fetching empleado detalle:', error);
      return null;
    }
  };

  const decodeFirma = async (firmaBase64: string): Promise<FirmaData | null> => {
    try {
      const decoded = atob(firmaBase64);
      const parts = decoded.split(':');

      if (parts.length !== 5) {
        return null;
      }

      const firmaData: FirmaData = {
        sessionId: parts[0],
        empleadoId: parts[1],
        latitud: parts[2],
        longitud: parts[3],
        timestamp: parts[4],
      };

      // Fetch employee details
      const empleadoDetalle = await fetchEmpleadoDetalle(parseInt(parts[1]));
      if (empleadoDetalle) {
        firmaData.empleadoDetalle = empleadoDetalle;
      }

      return firmaData;
    } catch (error) {
      console.error('Error decoding firma:', error);
      return null;
    }
  };

  const generateResponsableSignature = async () => {
    if (!employee) {
      Alert.alert('Error', 'No se encontró la información del empleado');
      return;
    }

    setIsGeneratingFirmaResponsable(true);

    try {
      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Error', 'Se necesita permiso de ubicación para generar la firma');
        setIsGeneratingFirmaResponsable(false);
        return;
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      // Get session ID from token
      const token = await getValidAccessTokenOrLogout({ refreshAccessToken, logout });
      if (!token) return;

      const decodedToken = jwtDecode(token);
      const sessionId = JSON.parse(JSON.stringify(decodedToken)).sessionId;

      // Get timestamp
      const horaAccion = await getHoraAccion();
      if (!horaAccion) {
        throw new Error('No se pudo obtener la hora');
      }

      // Generate base64 signature
      const firmaString = `${sessionId}:${employee.id}:${location.coords.latitude}:${location.coords.longitude}:${horaAccion}`;
      const firmaBase64 = btoa(firmaString);

      // Decode and set firma data
      const firmaData = await decodeFirma(firmaBase64);
      if (firmaData) {
        setFirmaResponsable(firmaData);
        Alert.alert('Éxito', 'Firma del responsable generada correctamente');
      }
    } catch (error) {
      console.error('Error generating firma responsable:', error);
      Alert.alert('Error', 'No se pudo generar la firma del responsable');
    } finally {
      setIsGeneratingFirmaResponsable(false);
    }
  };

  const formatDateForDisplay = (dateString: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const dateToLocalString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const resetAllFilters = () => {
    setFilterFecha('');
    setFilterEmpresaEvaluada('');
    setFilterSucursal('');
    setFilterPuesto('');
    setFilterDivision('');
    setFilterPersonaEvaluada('');
    setFilterCedulaPersonaEvaluada('');
    setFilterTelefonoPersonaEvaluada('');
    setFilterEmailPersonaEvaluada('');
    setFilterResponsableNombre('');
    setFilterResponsableCedula('');
    setFilterObservations('');
  };

  const handleFilterFechaChange = (event: any, selectedDate?: Date) => {
    setShowFilterFechaPicker(false);
    if (selectedDate) {
      const dateString = dateToLocalString(selectedDate);
      setFilterFecha(dateString);
    }
  };

  // Filter surveys
  const filteredSurveys = surveys.filter((survey: Survey) => {
    const matchesFecha =
      !filterFecha.trim() ||
      survey.fecha?.split('T')[0] === filterFecha;

    const matchesEmpresaEvaluada =
      !filterEmpresaEvaluada.trim() ||
      survey.empresa_evaluada?.toLowerCase().includes(filterEmpresaEvaluada.toLowerCase());

    const matchesSucursal =
      !filterSucursal.trim() ||
      survey.sucursal?.nombre?.toLowerCase().includes(filterSucursal.toLowerCase());

    const matchesPuesto =
      !filterPuesto.trim() ||
      survey.puesto?.nombre?.toLowerCase().includes(filterPuesto.toLowerCase());

    const matchesDivision =
      !filterDivision.trim() ||
      survey.division?.nombre?.toLowerCase().includes(filterDivision.toLowerCase());

    const matchesPersonaEvaluada =
      !filterPersonaEvaluada.trim() ||
      survey.persona_evaluada?.toLowerCase().includes(filterPersonaEvaluada.toLowerCase());

    const matchesCedulaPersonaEvaluada =
      !filterCedulaPersonaEvaluada.trim() ||
      survey.cedula_persona_evaluada?.toLowerCase().includes(filterCedulaPersonaEvaluada.toLowerCase());

    const matchesTelefonoPersonaEvaluada =
      !filterTelefonoPersonaEvaluada.trim() ||
      survey.telefono_persona_evaluada?.toLowerCase().includes(filterTelefonoPersonaEvaluada.toLowerCase());

    const matchesEmailPersonaEvaluada =
      !filterEmailPersonaEvaluada.trim() ||
      survey.email_persona_evaluada?.toLowerCase().includes(filterEmailPersonaEvaluada.toLowerCase());

    const matchesResponsableNombre =
      !filterResponsableNombre.trim() ||
      survey.responsable?.nombre?.toLowerCase().includes(filterResponsableNombre.toLowerCase());

    const matchesResponsableCedula =
      !filterResponsableCedula.trim() ||
      survey.responsable?.cedula?.toLowerCase().includes(filterResponsableCedula.toLowerCase());

    const matchesObservations =
      !filterObservations.trim() ||
      (survey.observations && survey.observations.toLowerCase().includes(filterObservations.toLowerCase()));

    return matchesFecha &&
      matchesEmpresaEvaluada &&
      matchesSucursal &&
      matchesPuesto &&
      matchesDivision &&
      matchesPersonaEvaluada &&
      matchesCedulaPersonaEvaluada &&
      matchesTelefonoPersonaEvaluada &&
      matchesEmailPersonaEvaluada &&
      matchesResponsableNombre &&
      matchesResponsableCedula &&
      matchesObservations;
  });

  const formatDateToISO = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}T00:00:00.000Z`;
  };

  const startCreating = async () => {
    setIsCreating(true);
    setFormKey(prev => prev + 1);
    resetForm();

    // Inicializar jerarquía con valores de current_marca
    setFormEmpresaId(marcaEmpresaId);
    setFormClienteId(marcaClienteId);
    setFormDivisionId(marcaDivisionId);
    setFormCorpoId(marcaCorpoId);
    setFormPuestoId(marcaPuestoId);

    const horaAccion = await getHoraAccion();
    if (!horaAccion) {
      Alert.alert('Error', 'No se pudo obtener la hora');
      return;
    }

    // Si hay cliente seleccionado, llenar empresa_evaluado
    if (marcaClienteId) {
      // Buscar el cliente en la estructura
      for (const empresa of structure) {
        const cliente = empresa.clientes?.find((c: any) => c.id === marcaClienteId);
        if (cliente) {
          empresaEvaluadaRef.current = cliente.nombre;
          break;
        }
      }
    }

    // Si hay división seleccionada, determinar el formulario automáticamente
    if (marcaDivisionId) {
      // Buscar la división en la estructura
      for (const empresa of structure) {
        for (const cliente of empresa.clientes || []) {
          const division = cliente.division?.find((d: any) => d.id === marcaDivisionId);
          if (division) {
            const divisionName = division.nombre;
            // Establecer selectedDivision basado en el nombre
            if (divisionName === 'Seguridad' || divisionName.toLowerCase().includes('seguridad')) {
              setSelectedDivision('Seguridad');
              divisionRef.current = 'Seguridad';
            } else if (divisionName === 'Aseo & Limpieza' || divisionName === 'Aseo y limpieza' || divisionName.toLowerCase().includes('aseo') || divisionName.toLowerCase().includes('limpieza')) {
              setSelectedDivision('Aseo & Limpieza');
              divisionRef.current = 'Aseo & Limpieza';
            } else {
              setSelectedDivision('');
              divisionRef.current = '';
            }
            break;
          }
        }
        if (divisionRef.current) break;
      }
    } else {
      // Por defecto, establecer Seguridad
      setSelectedDivision('Seguridad');
      divisionRef.current = 'Seguridad';
    }

    // Set default values
    if (puestos.length > 0) {
      puestoIdRef.current = puestos[0].id;
      setSelectedPuesto(puestos[0].id);
    }

    const today = new Date(horaAccion);
    setFechaEncuesta(today);
    fechaEncuestaRef.current = formatDateToISO(today);

    // Set employee data
    if (employee) {
      responsableNombreRef.current = employee.name || '';
      responsableCedulaRef.current = employee.cedula || '';
    }

    // Generate signature
    generateResponsableSignature();

    // Si hay corpo seleccionado, cargar puestos
    if (marcaCorpoId) {
      fetchPuestosForCorpo(marcaCorpoId, true);
    }
  };

  const cancelCreating = () => {
    setIsCreating(false);
    resetForm();
  };

  const resetForm = () => {
    empresaEvaluadaRef.current = '';
    personaNombreRef.current = '';
    personaCedulaRef.current = '';
    personaTelefonoRef.current = '';
    personaEmailRef.current = '';
    puestoIdRef.current = 0;
    fechaEncuestaRef.current = '';
    divisionRef.current = 'Seguridad';
    observacionesRef.current = '';
    responsableNombreRef.current = '';
    responsableCedulaRef.current = '';
    setAnswers({});
    answersRef.current = {};
    setPersonSignature(null);
    personSignatureRef.current = null;
    setFirmaResponsable(null);
    setSignatureKey(prev => prev + 1);
    setIsSignatureModalVisible(false);
    setTempSignature(null);

    // Reset jerarquía del formulario
    setFormEmpresaId(null);
    setFormClienteId(null);
    setFormDivisionId(null);
    setFormContratoId(null);
    setFormCorpoId(null);
    setFormPuestoId(null);
    setSelectedPuesto(0);

    // Clear input refs
    if (empresaEvaluadaInputRef.current) empresaEvaluadaInputRef.current.clear();
    if (personaNombreInputRef.current) personaNombreInputRef.current.clear();
    if (personaCedulaInputRef.current) personaCedulaInputRef.current.clear();
    if (personaTelefonoInputRef.current) personaTelefonoInputRef.current.clear();
    if (personaEmailInputRef.current) personaEmailInputRef.current.clear();
    if (observacionesInputRef.current) observacionesInputRef.current.clear();
    if (responsableNombreInputRef.current) responsableNombreInputRef.current.clear();
    if (responsableCedulaInputRef.current) responsableCedulaInputRef.current.clear();
  };

  const createSurvey = async () => {
    // Validations
    if (!empresaEvaluadaRef.current.trim()) {
      Alert.alert('Error', 'Debe ingresar el nombre de la empresa evaluada');
      return;
    }

    if (!personaNombreRef.current.trim()) {
      Alert.alert('Error', 'Debe ingresar el nombre de la persona que llena la encuesta');
      return;
    }

    if (!personaCedulaRef.current.trim()) {
      Alert.alert('Error', 'Debe ingresar la cédula de la persona que llena la encuesta');
      return;
    }

    if (!personaTelefonoRef.current.trim()) {
      Alert.alert('Error', 'Debe ingresar el teléfono de la persona que llena la encuesta');
      return;
    }

    if (!personaEmailRef.current.trim()) {
      Alert.alert('Error', 'Debe ingresar el email de la persona que llena la encuesta');
      return;
    }

    if (!puestoIdRef.current || puestoIdRef.current === 0) {
      Alert.alert('Error', 'Debe seleccionar un puesto');
      return;
    }

    if (!fechaEncuestaRef.current) {
      Alert.alert('Error', 'Debe seleccionar la fecha de la encuesta');
      return;
    }

    // Validate all questions answered
    const currentQuestions = getQuestionsForDivision(selectedDivision);
    for (let i = 0; i < currentQuestions.length; i++) {
      const answer = answersRef.current[i] || answers[i];
      if (currentQuestions[i].inputs.required && !answer) {
        Alert.alert('Error', `Debe responder la pregunta ${i + 1}`);
        return;
      }
    }

    // firma_persona_evaluada es opcional

    if (!responsableNombreRef.current.trim()) {
      Alert.alert('Error', 'Debe ingresar el nombre del responsable');
      return;
    }

    if (!responsableCedulaRef.current.trim()) {
      Alert.alert('Error', 'Debe ingresar la cédula del responsable');
      return;
    }

    if (!firmaResponsable) {
      Alert.alert('Error', 'Debes generar la firma del responsable');
      return;
    }

    Alert.alert(
      'Confirmar creación',
      '¿Está seguro de que desea crear esta encuesta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const currentMarca = await AsyncStorage.getItem('current_marca');
              if (!currentMarca) {
                Alert.alert('Error', 'No se encontró la marca actual');
                return;
              }

              const currentMarcaData = JSON.parse(currentMarca);

              // Build evaluaciones array using ref first, then state
              const currentQuestions = getQuestionsForDivision(selectedDivision);
              const evaluaciones: Answer[] = currentQuestions.map((question, index) => ({
                question: question.title,
                value: answersRef.current[index] || answers[index] || ''
              }));

              // Signature is already in base64 format from SignatureScreen
              const personSignatureBase64 = personSignatureRef.current || personSignature || '';

              // Rebuild firma base64 string
              const firmaResponsableBase64 = btoa(
                `${firmaResponsable.sessionId}:${firmaResponsable.empleadoId}:${firmaResponsable.latitud}:${firmaResponsable.longitud}:${firmaResponsable.timestamp}`
              );

              // Obtener IDs SOLO de la jerarquía seleccionada en el formulario
              const empresaId = formEmpresaId;
              const clienteId = formClienteId;
              const corpoId = formCorpoId;
              const puestoId = formPuestoId;

              // Obtener division_id de la jerarquía seleccionada
              let divisionId = formDivisionId;

              // Si no hay divisionId pero hay una división seleccionada en la jerarquía, buscarla por nombre
              if (!divisionId && formClienteId) {
                // Buscar la división en la estructura basado en selectedDivision
                const divisionName = selectedDivision;
                if (divisionName === 'Seguridad' || divisionName === 'Aseo & Limpieza') {
                  // Buscar el ID de la división en la estructura
                  for (const empresa of structure) {
                    for (const cliente of empresa.clientes || []) {
                      if (cliente.id === formClienteId) {
                        const division = cliente.division?.find((d: any) => {
                          const dName = d.nombre;
                          if (divisionName === 'Seguridad') {
                            return dName === 'Seguridad' || dName.toLowerCase().includes('seguridad');
                          } else if (divisionName === 'Aseo & Limpieza') {
                            return dName === 'Aseo & Limpieza' || dName === 'Aseo y limpieza' || dName.toLowerCase().includes('aseo') || dName.toLowerCase().includes('limpieza');
                          }
                          return false;
                        });
                        if (division) {
                          divisionId = division.id;
                          break;
                        }
                      }
                    }
                    if (divisionId) break;
                  }
                }
              }

              // Si hay corpoId pero no contratoId, rastrear el contrato desde la estructura
              let contratoId = formContratoId;
              if (corpoId && !contratoId) {
                contratoId = findContratoForSucursal(corpoId);
              }

              // Validar que todos los IDs estén presentes (SOLO de la jerarquía del formulario)
              if (!empresaId || !clienteId || !divisionId || !corpoId || !puestoId) {
                Alert.alert('Error', 'Faltan datos de la jerarquía. Por favor, complete la selección de Empresa, Cliente, División, Sucursal y Puesto en el formulario.');
                return;
              }

              const requestBody = {
                marca_id: currentMarcaData.id,
                empresa_id: empresaId,
                cliente_id: clienteId,
                division_id: divisionId,
                corpo_id: corpoId,
                puesto_id: puestoId,
                fecha: fechaEncuestaRef.current,
                evaluaciones: JSON.stringify(evaluaciones),
                persona_evaluada: personaNombreRef.current,
                cedula_persona_evaluada: personaCedulaRef.current,
                telefono_persona_evaluada: personaTelefonoRef.current,
                email_persona_evaluada: personaEmailRef.current,
                nombre_responsable: responsableNombreRef.current,
                cedula_responsable: responsableCedulaRef.current,
                firma_responsable: firmaResponsableBase64,
                firma_persona_evaluada: personSignatureBase64,
                observaciones: observacionesRef.current.trim() || '-',
                empresa_evaluada: empresaEvaluadaRef.current,
                division: divisionRef.current
              };

              // Verificar conectividad
              const isConnected = await getConnectionStatus();

              if (isConnected) {
                // Con internet: llamar a la función API
                const data = await createSurveyAPI({
                  requestData: requestBody,
                  marcaId: currentMarcaData.id,
                  refreshAccessToken,
                  logout,
                });

                if (data.status) {
                  Alert.alert('Éxito', data.message || 'Encuesta creada correctamente');
                  setIsCreating(false);
                  resetForm();
                  await fetchSurveys(true);
                } else {
                  Alert.alert('Error', data.message || 'Error al crear la encuesta');
                }
              } else {
                // Sin internet: modo offline
                const localId = generateRandomId();
                const horaAccion = await getHoraAccion();

                // Crear entrada en surveys_actions
                const actionsStr = await AsyncStorage.getItem('surveys_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  requestData: requestBody,
                  marcaId: currentMarcaData.id,
                  id: localId,
                  type: 'create',
                });
                await AsyncStorage.setItem('surveys_actions', JSON.stringify(actions));

                // Obtener puesto seleccionado para el cache
                const selectedPuesto = puestos.find(p => p.id === puestoIdRef.current);

                // Crear encuesta en cache
                const cacheStr = await AsyncStorage.getItem('surveys_cache');
                const cache = cacheStr ? JSON.parse(cacheStr) : [];

                const newSurveyCache: Survey = {
                  id: 0,
                  id_local: localId,
                  persona_evaluada: personaNombreRef.current,
                  empresa_evaluada: empresaEvaluadaRef.current,
                  cedula_persona_evaluada: personaCedulaRef.current,
                  telefono_persona_evaluada: personaTelefonoRef.current,
                  email_persona_evaluada: personaEmailRef.current,
                  firma_persona_evaluada: personSignatureBase64,
                  empresa: {
                    id: currentMarcaData.empresa?.id || 0,
                    nombre: currentMarcaData.empresa?.nombre || '',
                  },
                  sucursal: {
                    id: currentMarcaData.sucursal?.id || 0,
                    nombre: currentMarcaData.sucursal?.nombre || '',
                  },
                  puesto: {
                    id: puestoIdRef.current,
                    nombre: selectedPuesto?.nombre || '',
                  },
                  division: {
                    id: divisionRef.current === 'Seguridad' ? 1 : 2,
                    nombre: divisionRef.current,
                  },
                  responsable_id: parseInt(employee?.id || '0'),
                  responsable: {
                    nombre: responsableNombreRef.current,
                    cedula: responsableCedulaRef.current,
                  },
                  firma_responsable: firmaResponsableBase64,
                  nombre_firma: '',
                  fecha: fechaEncuestaRef.current,
                  evaluaciones: JSON.stringify(evaluaciones),
                  observations: observacionesRef.current.trim() || '-',
                };

                cache.push(newSurveyCache);
                await AsyncStorage.setItem('surveys_cache', JSON.stringify(cache));

                Alert.alert('Modo Offline', 'Encuesta registrada localmente. Se sincronizará cuando haya conexión.');
                setIsCreating(false);
                resetForm();
                await fetchSurveys();
              }
            } catch (err) {
              console.error('Error creating survey:', err);
              Alert.alert('Error', 'No se pudo crear la encuesta');
            }
          }
        }
      ]
    );
  };

  const generateDateTime = (timestamp: string) => {
    const empFirmaFecha = new Date(parseInt(timestamp)).toISOString();
    const evalFirmaFecha = new Date(parseInt(timestamp)).toISOString();

    let empFirmaFechaSplit = empFirmaFecha.split('T');
    let evalFirmaFechaSplit = evalFirmaFecha.split('T');

    empFirmaFechaSplit[1] = empFirmaFechaSplit[1].split('.')[0];
    evalFirmaFechaSplit[1] = evalFirmaFechaSplit[1].split('.')[0];

    return empFirmaFechaSplit[0] + ' ' + empFirmaFechaSplit[1];
  };

  const handleSignature = (signature: string) => {
    // Guardar temporalmente cuando se dibuja en el modal
    setTempSignature(signature);
  };

  const openSignatureModal = () => {
    setIsSignatureModalVisible(true);
    setTempSignature(null); // Reset temporal signature
    setSignatureKey(prev => prev + 1); // Reset canvas
  };

  const closeSignatureModal = () => {
    setIsSignatureModalVisible(false);
    setTempSignature(null);
    setSignatureKey(prev => prev + 1); // Reset canvas
  };

  const clearSignatureInModal = () => {
    setTempSignature(null);
    setSignatureKey(prev => prev + 1); // Force re-render of canvas
    if (signatureRef.current) {
      signatureRef.current.clearSignature();
    }
  };

  const acceptSignature = () => {
    // Leer la firma actual del canvas
    if (signatureRef.current) {
      signatureRef.current.readSignature();
    } else if (tempSignature) {
      // Si ya tenemos una firma temporal, usarla
      setPersonSignature(tempSignature);
      personSignatureRef.current = tempSignature;
      setIsSignatureModalVisible(false);
    } else {
      Alert.alert('Error', 'Debe dibujar una firma antes de aceptar');
    }
  };

  const handleSignatureRead = (signature: string) => {
    // Esta función se llama cuando readSignature() completa
    if (signature) {
      setPersonSignature(signature);
      personSignatureRef.current = signature;
      setIsSignatureModalVisible(false);
      setTempSignature(null);
    } else {
      Alert.alert('Error', 'No se pudo obtener la firma. Por favor, intente nuevamente.');
    }
  };

  const removeSignature = () => {
    Alert.alert(
      'Confirmar',
      '¿Está seguro de que desea eliminar la firma?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            setPersonSignature(null);
            personSignatureRef.current = null;
          }
        }
      ]
    );
  };

  const openAddSignatureModal = (survey: Survey) => {
    setAddSignatureSurvey(survey);
    setAddSignatureManualKey((k) => k + 1);
    setAddSignatureModalVisible(true);
  };

  const closeAddSignatureModal = () => {
    setAddSignatureModalVisible(false);
    setAddSignatureSurvey(null);
  };

  const triggerAddSignatureManualRead = () => {
    try {
      addSignatureManualRef.current?.readSignature?.();
    } catch {
      Alert.alert('Error', 'No se pudo leer la firma. Dibuje primero en el recuadro.');
    }
  };

  const handleAddSignatureManualRead = (signature: string) => {
    const sig = String(signature || '').trim();
    if (!sig || sig.length < 10) {
      Alert.alert('Error', 'No se detectó la firma. Intenta de nuevo.');
      return;
    }
    const survey = addSignatureSurvey;
    if (!survey || survey.id === 0) return;
    Alert.alert(
      'Confirmar',
      '¿Guardar esta firma de la persona evaluada en el registro?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aceptar',
          onPress: async () => {
            setIsAddSignatureSubmitting(true);
            try {
              const result = await updateSurveySignature({
                surveyId: survey.id,
                field: 'firma_persona_evaluada',
                value: sig,
                refreshAccessToken,
                logout,
              });
              if (result.status) {
                const personaUri = sig.startsWith('data:') ? sig : `data:image/png;base64,${sig}`;
                setDecodedFirmas((prev) => {
                  const next = new Map(prev);
                  const existing = next.get(survey.id) || { responsable: null, persona: null };
                  next.set(survey.id, { ...existing, persona: personaUri });
                  return next;
                });
                closeAddSignatureModal();
                await fetchSurveys(true);
                Alert.alert('Éxito', result.message || 'Firma actualizada correctamente');
              } else {
                Alert.alert('Error', result.message || 'No se pudo actualizar la firma.');
              }
            } catch (e) {
              Alert.alert('Error', (e instanceof Error ? e.message : 'No se pudo actualizar la firma.'));
            } finally {
              setIsAddSignatureSubmitting(false);
            }
          },
        },
      ]
    );
  };

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
      height: 200px !important;
    }
    .m-signature-pad--footer {
      display: none;
    }
  `;

  // Inicializar respuestas con valor por defecto (5 estrellas) cuando se carga el formulario o cambia la división
  useEffect(() => {
    if (formDivisionId && (selectedDivision === 'Seguridad' || selectedDivision === 'Aseo & Limpieza') && isCreating) {
      const currentQuestions = getQuestionsForDivision(selectedDivision);
      setAnswers(prevAnswers => {
        const newAnswers = { ...prevAnswers };
        let hasChanges = false;

        currentQuestions.forEach((question, index) => {
          if (question.inputs.type === 'punctuation' && !prevAnswers[index]) {
            const maxStars = parseInt(question.inputs.length || '5');
            newAnswers[index] = maxStars;
            answersRef.current[index] = maxStars;
            hasChanges = true;
          }
        });

        return hasChanges ? newAnswers : prevAnswers;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formDivisionId, selectedDivision, isCreating]);

  const renderStarRating = (questionIndex: number, maxStars: number) => {
    // Si no hay valor, usar el máximo (todas las estrellas marcadas por defecto)
    const currentRating = answers[questionIndex] as number || maxStars;

    return (
      <ThemedView style={styles.starsContainer}>
        {[...Array(maxStars)].map((_, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => {
              const newAnswers = { ...answers };
              newAnswers[questionIndex] = index + 1;
              setAnswers(newAnswers);
              answersRef.current[questionIndex] = index + 1;
            }}
          >
            <Ionicons
              name={index < currentRating ? 'star' : 'star-outline'}
              size={32}
              color="#FFD700"
            />
          </TouchableOpacity>
        ))}
      </ThemedView>
    );
  };

  const renderQuestion = (question: Question, index: number) => {
    return (
      <ThemedView key={index} style={styles.questionContainer}>
        <ThemedText style={styles.questionTitle}>
          {index + 1}. {question.title}
        </ThemedText>

        {question.inputs.type === 'punctuation' && (
          renderStarRating(index, parseInt(question.inputs.length || '5'))
        )}

        {question.inputs.type === 'radio' && (
          <ThemedView style={styles.radioContainer}>
            {question.inputs.options?.map((option, optIndex) => (
              <TouchableOpacity
                key={optIndex}
                style={styles.radioOption}
                onPress={() => {
                  const newAnswers = { ...answers };
                  newAnswers[index] = option;
                  setAnswers(newAnswers);
                  answersRef.current[index] = option;
                }}
              >
                <Ionicons
                  name={answers[index] === option ? 'radio-button-on' : 'radio-button-off'}
                  size={24}
                  color="#007AFF"
                />
                <ThemedText style={styles.radioLabel}>{option}</ThemedText>
              </TouchableOpacity>
            ))}
          </ThemedView>
        )}

      </ThemedView>
    );
  };

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'files': return <Ionicons name="document-text" size={24} color='#000000' />;
      case 'add': return <Ionicons name="add" size={24} color='#000000' />;
      case 'cancel': return <Ionicons name="close" size={24} color='#FFFFFF' />;
      case 'confirm': return <Ionicons name="checkmark" size={24} color='#FFFFFF' />;
      case 'delete': return <Ionicons name="trash" size={24} color='#FFFFFF' />;
      default: return <Ionicons name="close" size={24} color='#FFFFFF' />;
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

  const toggleSurveyExpansion = async (surveyId: number, survey: Survey) => {
    const isExpanded = expandedSurveys.has(surveyId);

    if (isExpanded) {
      // Collapse
      const newExpanded = new Set(expandedSurveys);
      newExpanded.delete(surveyId);
      setExpandedSurveys(newExpanded);
    } else {
      // Expand - decode firmas if not already decoded
      const newExpanded = new Set(expandedSurveys);
      newExpanded.add(surveyId);
      setExpandedSurveys(newExpanded);

      // Decode firmas if not already decoded
      if (!decodedFirmas.has(surveyId)) {
        try {
          // Decode responsable firma
          let responsableFirma: FirmaData | null = null;
          if (survey.firma_responsable) {
            responsableFirma = await decodeFirma(survey.firma_responsable);
          }

          // Persona firma is already base64 image
          // Ensure it has the correct format for display
          let personaFirma: string | null = null;
          if (survey.firma_persona_evaluada) {
            const firma = survey.firma_persona_evaluada.trim();
            // If it already has data: prefix, use it as is
            // Otherwise, add the prefix
            personaFirma = firma.startsWith('data:')
              ? firma
              : `data:image/png;base64,${firma}`;
          }

          setDecodedFirmas(prev => {
            const newMap = new Map(prev);
            newMap.set(surveyId, { responsable: responsableFirma, persona: personaFirma });
            return newMap;
          });
        } catch (error) {
          console.error('Error decoding firmas:', error);
        }
      }
    }
  };

  const formatDateTime = (timestamp: string): string => {
    try {
      const date = new Date(parseInt(timestamp));
      return date.toLocaleString();
    } catch (error) {
      return timestamp;
    }
  };


  if (isLoading || isCheckingMarca) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader onMenuPress={handleMenuPress} title="Encuestas de Satisfacción" />
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>
            {isCheckingMarca ? 'Verificando marca...' : 'Cargando encuestas...'}
          </ThemedText>
        </ThemedView>
        <AppFooter />
        <SlideMenu isVisible={isMenuVisible} onClose={handleMenuClose} onHomePress={handleHomePress} />
      </ThemedView>
    );
  }

  if (!hasCurrentMarca) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader onMenuPress={handleMenuPress} title="Encuestas de Satisfacción" />
        <ThemedView style={styles.noMarcaContainer}>
          <ThemedText style={styles.noMarcaTitle}>Marca no seleccionada</ThemedText>
          <ThemedText style={styles.noMarcaMessage}>No se encontró una marca seleccionada. Por favor, selecciona una marca desde el menú principal.</ThemedText>
        </ThemedView>
        <AppFooter />
        <SlideMenu isVisible={isMenuVisible} onClose={handleMenuClose} onHomePress={handleHomePress} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <AppHeader onMenuPress={handleMenuPress} title="Encuestas de Satisfacción" />

      <ScrollView style={styles.scrollView}>
        <ThemedView style={styles.scrollContent}>
          <ThemedView style={styles.contentContainer}>
            <ThemedView style={styles.titleContainer}>
              <ThemedText style={styles.title}>{getActionIcon('files')} Encuestas de Satisfacción</ThemedText>
              <ThemedText style={styles.subtitle}>Gestión de encuestas NPS</ThemedText>
            </ThemedView>

            {!isCreating && (
              <>
                {/* Filters */}
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
                      {/* Filtros jerárquicos */}
                      <ThemedView style={styles.hierarchyFiltersContainer}>
                        <ThemedView style={styles.hierarchyFiltersHeader}>
                          <TouchableOpacity
                            style={styles.filterToggleButton}
                            onPress={() => setIsHierarchyFiltersExpanded(!isHierarchyFiltersExpanded)}
                          >
                            <ThemedText style={styles.filterToggleText}>Filtros jerárquicos</ThemedText>
                            <Ionicons
                              name={isHierarchyFiltersExpanded ? 'chevron-up' : 'chevron-down'}
                              size={20}
                              color="#007AFF"
                            />
                          </TouchableOpacity>
                          {isHierarchyFiltersExpanded && (
                            <TouchableOpacity style={styles.resetFiltersButton} onPress={() => {
                              setFilterEmpresaId(null);
                              setFilterClienteId(marcaClienteId);
                              setFilterDivisionId(null);
                              setFilterContratoId(null);
                              setFilterCorpoId(marcaCorpoId);
                              setFilterPuestoId(marcaPuestoId);
                            }}>
                              <Ionicons name="refresh" size={16} color="#FF3B30" />
                              <ThemedText style={styles.resetFiltersText}>Reiniciar</ThemedText>
                            </TouchableOpacity>
                          )}
                        </ThemedView>
                        {isHierarchyFiltersExpanded && (
                          <ThemedView style={styles.hierarchyFiltersContent}>
                            <ThemedView style={styles.filterGroup}>
                              <ThemedText style={styles.filterLabel}>Empresa:</ThemedText>
                              <View style={styles.pickerWrapper}>
                                <Picker
                                  selectedValue={filterEmpresaId || ''}
                                  onValueChange={(value) => setFilterEmpresaId(value && value !== '' ? Number(value) : null)}
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
                                    onValueChange={(value) => setFilterClienteId(value && value !== '' ? Number(value) : null)}
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
                                    selectedValue={filterDivisionId || ''}
                                    onValueChange={(value) => setFilterDivisionId(value && value !== '' ? Number(value) : null)}
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

                            {filterDivisionId && (
                              <ThemedView style={styles.filterGroup}>
                                <ThemedText style={styles.filterLabel}>Contrato:</ThemedText>
                                <View style={styles.pickerWrapper}>
                                  <Picker
                                    selectedValue={filterContratoId || ''}
                                    onValueChange={(value) => setFilterContratoId(value && value !== '' ? Number(value) : null)}
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
                                    onValueChange={(value) => setFilterCorpoId(value && value !== '' ? Number(value) : null)}
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
                                    onValueChange={(value) => setFilterPuestoId(value && value !== '' ? Number(value) : null)}
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
                          </ThemedView>
                        )}
                      </ThemedView>

                      <ThemedView style={styles.filterGroup}>
                        <ThemedText style={styles.filterLabel}>Fecha:</ThemedText>
                        <TouchableOpacity
                          style={styles.dateButton}
                          onPress={() => setShowFilterFechaPicker(true)}
                        >
                          <ThemedText style={styles.dateButtonText}>
                            {filterFecha ? formatDateForDisplay(filterFecha) : 'Seleccionar fecha'}
                          </ThemedText>
                          <Ionicons name="calendar-outline" size={20} color="#007AFF" />
                        </TouchableOpacity>
                      </ThemedView>

                      <ThemedView style={styles.filterGroup}>
                        <ThemedText style={styles.filterLabel}>Empresa evaluada:</ThemedText>
                        <TextInput
                          style={styles.searchInput}
                          value={filterEmpresaEvaluada}
                          onChangeText={setFilterEmpresaEvaluada}
                          placeholder="Buscar por empresa..."
                          placeholderTextColor="#999"
                        />
                      </ThemedView>

                      <ThemedView style={styles.filterGroup}>
                        <ThemedText style={styles.filterLabel}>Sucursal:</ThemedText>
                        <TextInput
                          style={styles.searchInput}
                          value={filterSucursal}
                          onChangeText={setFilterSucursal}
                          placeholder="Buscar por sucursal..."
                          placeholderTextColor="#999"
                        />
                      </ThemedView>

                      <ThemedView style={styles.filterGroup}>
                        <ThemedText style={styles.filterLabel}>Puesto:</ThemedText>
                        <TextInput
                          style={styles.searchInput}
                          value={filterPuesto}
                          onChangeText={setFilterPuesto}
                          placeholder="Buscar por puesto..."
                          placeholderTextColor="#999"
                        />
                      </ThemedView>

                      <ThemedView style={styles.filterGroup}>
                        <ThemedText style={styles.filterLabel}>División:</ThemedText>
                        <TextInput
                          style={styles.searchInput}
                          value={filterDivision}
                          onChangeText={setFilterDivision}
                          placeholder="Buscar por división..."
                          placeholderTextColor="#999"
                        />
                      </ThemedView>

                      <ThemedView style={styles.filterGroup}>
                        <ThemedText style={styles.filterLabel}>Persona evaluada:</ThemedText>
                        <TextInput
                          style={styles.searchInput}
                          value={filterPersonaEvaluada}
                          onChangeText={setFilterPersonaEvaluada}
                          placeholder="Buscar por nombre..."
                          placeholderTextColor="#999"
                        />
                      </ThemedView>

                      <ThemedView style={styles.filterGroup}>
                        <ThemedText style={styles.filterLabel}>Cédula persona evaluada:</ThemedText>
                        <TextInput
                          style={styles.searchInput}
                          value={filterCedulaPersonaEvaluada}
                          onChangeText={setFilterCedulaPersonaEvaluada}
                          placeholder="Buscar por cédula..."
                          placeholderTextColor="#999"
                        />
                      </ThemedView>

                      <ThemedView style={styles.filterGroup}>
                        <ThemedText style={styles.filterLabel}>Teléfono persona evaluada:</ThemedText>
                        <TextInput
                          style={styles.searchInput}
                          value={filterTelefonoPersonaEvaluada}
                          onChangeText={setFilterTelefonoPersonaEvaluada}
                          placeholder="Buscar por teléfono..."
                          placeholderTextColor="#999"
                        />
                      </ThemedView>

                      <ThemedView style={styles.filterGroup}>
                        <ThemedText style={styles.filterLabel}>Email persona evaluada:</ThemedText>
                        <TextInput
                          style={styles.searchInput}
                          value={filterEmailPersonaEvaluada}
                          onChangeText={setFilterEmailPersonaEvaluada}
                          placeholder="Buscar por email..."
                          placeholderTextColor="#999"
                        />
                      </ThemedView>

                      <ThemedView style={styles.filterGroup}>
                        <ThemedText style={styles.filterLabel}>Responsable - Nombre:</ThemedText>
                        <TextInput
                          style={styles.searchInput}
                          value={filterResponsableNombre}
                          onChangeText={setFilterResponsableNombre}
                          placeholder="Buscar por nombre..."
                          placeholderTextColor="#999"
                        />
                      </ThemedView>

                      <ThemedView style={styles.filterGroup}>
                        <ThemedText style={styles.filterLabel}>Responsable - Cédula:</ThemedText>
                        <TextInput
                          style={styles.searchInput}
                          value={filterResponsableCedula}
                          onChangeText={setFilterResponsableCedula}
                          placeholder="Buscar por cédula..."
                          placeholderTextColor="#999"
                        />
                      </ThemedView>

                      <ThemedView style={styles.filterGroup}>
                        <ThemedText style={styles.filterLabel}>Observaciones:</ThemedText>
                        <TextInput
                          style={styles.searchInput}
                          value={filterObservations}
                          onChangeText={setFilterObservations}
                          placeholder="Buscar en observaciones..."
                          placeholderTextColor="#999"
                        />
                      </ThemedView>
                    </ThemedView>
                  )}
                </ThemedView>

                <TouchableOpacity
                  style={styles.createButton}
                  onPress={startCreating}
                >
                  <ThemedText style={styles.createButtonText}>{getActionIcon('add')}</ThemedText>
                </TouchableOpacity>

                {filteredSurveys.length === 0 ? (
                  <ThemedView style={styles.emptyContainer}>
                    <ThemedText style={styles.emptyText}>
                      {surveys.length === 0 ? 'No hay encuestas registradas' : 'No se encontraron encuestas con los filtros aplicados'}
                    </ThemedText>
                  </ThemedView>
                ) : (
                  <ThemedView style={styles.surveysList}>
                    {filteredSurveys.map((survey) => {
                      const isExpanded = expandedSurveys.has(survey.id);
                      const firmasData = decodedFirmas.get(survey.id);

                      // Parse evaluaciones
                      let evaluacionesArray: Answer[] = [];
                      try {
                        evaluacionesArray = JSON.parse(survey.evaluaciones);
                      } catch (e) {
                        console.error('Error parsing evaluaciones:', e);
                      }

                      return (
                        <ThemedView key={survey.id} style={styles.surveyCard}>
                          <ThemedView style={styles.surveyHeader}>
                            <ThemedText style={styles.surveyTitle}>
                              {survey.empresa_evaluada}
                            </ThemedText>
                          </ThemedView>

                          {/* Basic info - always visible */}
                          <ThemedText style={styles.surveyInfo}>
                            <ThemedText style={styles.surveyLabel}>Fecha: </ThemedText>
                            {formatDateForDisplay(survey.fecha)}
                          </ThemedText>
                          <ThemedText style={styles.surveyInfo}>
                            <ThemedText style={styles.surveyLabel}>Empresa evaluada: </ThemedText>
                            {survey.empresa_evaluada}
                          </ThemedText>
                          <ThemedText style={styles.surveyInfo}>
                            <ThemedText style={styles.surveyLabel}>Sucursal: </ThemedText>
                            {survey.sucursal?.nombre || 'N/A'}
                          </ThemedText>
                          <ThemedText style={styles.surveyInfo}>
                            <ThemedText style={styles.surveyLabel}>Puesto: </ThemedText>
                            {survey.puesto?.nombre || 'N/A'}
                          </ThemedText>
                          <ThemedText style={styles.surveyInfo}>
                            <ThemedText style={styles.surveyLabel}>División: </ThemedText>
                            {survey.division?.nombre || 'N/A'}
                          </ThemedText>

                          {/* Collapsable Button */}
                          <TouchableOpacity
                            style={styles.collapseButton}
                            onPress={() => toggleSurveyExpansion(survey.id, survey)}
                          >
                            <ThemedText style={styles.collapseButtonText}>
                              {isExpanded ? 'Ocultar detalles' : 'Ver detalles'}
                            </ThemedText>
                            <Ionicons
                              name={isExpanded ? "chevron-up" : "chevron-down"}
                              size={20}
                              color="#007AFF"
                            />
                          </TouchableOpacity>

                          {/* Collapsable Content */}
                          {isExpanded && (
                            <ThemedView style={styles.collapsableContent}>
                              {/* Persona evaluada */}
                              <ThemedView style={styles.personaContainer}>
                                <ThemedText style={styles.personaTitle}>Persona evaluada:</ThemedText>
                                <ThemedText style={styles.personaText}>
                                  <ThemedText style={styles.personaLabel}>Nombre: </ThemedText>
                                  {survey.persona_evaluada}
                                </ThemedText>
                                <ThemedText style={styles.personaText}>
                                  <ThemedText style={styles.personaLabel}>Cédula: </ThemedText>
                                  {survey.cedula_persona_evaluada}
                                </ThemedText>
                                <ThemedText style={styles.personaText}>
                                  <ThemedText style={styles.personaLabel}>Teléfono: </ThemedText>
                                  {survey.telefono_persona_evaluada}
                                </ThemedText>
                                <ThemedText style={styles.personaText}>
                                  <ThemedText style={styles.personaLabel}>Email: </ThemedText>
                                  {survey.email_persona_evaluada}
                                </ThemedText>
                              </ThemedView>

                              {/* Firmas */}
                              {firmasData ? (
                                <>
                                  {/* Firma responsable */}
                                  {firmasData.responsable && (
                                    <ThemedView style={styles.firmaSection}>
                                      <ThemedText style={styles.firmaSectionTitle}>Firma del Responsable:</ThemedText>
                                      {firmasData.responsable.empleadoDetalle ? (
                                        <ThemedText style={styles.firmaText}>
                                          {firmasData.responsable.empleadoDetalle.nombre} {firmasData.responsable.empleadoDetalle.primer_apellido} {firmasData.responsable.empleadoDetalle.segundo_apellido}
                                        </ThemedText>
                                      ) : (
                                        <ThemedText style={styles.firmaText}>
                                          ID: {firmasData.responsable.empleadoId}
                                        </ThemedText>
                                      )}
                                      <ThemedText style={styles.firmaText}>
                                        Ubicación: {parseFloat(firmasData.responsable.latitud).toFixed(6)}, {parseFloat(firmasData.responsable.longitud).toFixed(6)}
                                      </ThemedText>
                                      <ThemedText style={styles.firmaText}>
                                        Hora y fecha: {generateDateTime(firmasData.responsable.timestamp)}
                                      </ThemedText>
                                      <ThemedText style={styles.firmaText}>
                                        Sesión: {firmasData.responsable.sessionId}
                                      </ThemedText>
                                    </ThemedView>
                                  )}

                                  {/* Firma persona evaluada */}
                                  {firmasData.persona ? (
                                    <ThemedView style={styles.firmaSection}>
                                      <ThemedText style={styles.firmaSectionTitle}>Firma de la Persona Evaluada:</ThemedText>
                                      <ThemedView style={styles.signatureImageContainer}>
                                        <Image
                                          source={{ uri: firmasData.persona }}
                                          style={styles.signatureImage}
                                          resizeMode="contain"
                                          onError={(error) => {
                                            console.error('Error loading signature image:', error);
                                          }}
                                        />
                                      </ThemedView>
                                    </ThemedView>
                                  ) : (
                                    <ThemedView style={styles.firmaSection}>
                                      <ThemedText style={styles.firmaSectionTitle}>Firma de la Persona Evaluada:</ThemedText>
                                      <ThemedText style={styles.emptyText}>No hay firma de la persona evaluada registrada</ThemedText>
                                      {survey.id > 0 && (
                                        <TouchableOpacity
                                          style={[styles.signatureButton, { marginTop: 8 }]}
                                          onPress={() => openAddSignatureModal(survey)}
                                        >
                                          <Ionicons name="create-outline" size={20} color="#FFFFFF" />
                                          <ThemedText style={styles.signatureButtonText}>Añadir firma persona evaluada</ThemedText>
                                        </TouchableOpacity>
                                      )}
                                    </ThemedView>
                                  )}
                                </>
                              ) : (
                                <ThemedText style={styles.loadingText}>Cargando firmas...</ThemedText>
                              )}

                              {/* Responsable */}
                              <ThemedView style={styles.responsableContainer}>
                                <ThemedText style={styles.responsableTitle}>Responsable:</ThemedText>
                                <ThemedText style={styles.responsableText}>
                                  <ThemedText style={styles.responsableLabel}>Nombre: </ThemedText>
                                  {survey.responsable?.nombre || 'N/A'}
                                </ThemedText>
                                <ThemedText style={styles.responsableText}>
                                  <ThemedText style={styles.responsableLabel}>Cédula: </ThemedText>
                                  {survey.responsable?.cedula || 'N/A'}
                                </ThemedText>
                              </ThemedView>

                              {/* Evaluaciones */}
                              {evaluacionesArray.length > 0 && (
                                <ThemedView style={styles.evaluacionesContainer}>
                                  <ThemedText style={styles.evaluacionesTitle}>Evaluaciones:</ThemedText>
                                  {evaluacionesArray.map((evaluacion, index) => (
                                    <ThemedView key={index} style={styles.evaluacionItem}>
                                      <ThemedText style={styles.evaluacionQuestion}>{evaluacion.question}</ThemedText>
                                      <ThemedText style={styles.evaluacionResult}>Respuesta: {evaluacion.value}</ThemedText>
                                    </ThemedView>
                                  ))}
                                </ThemedView>
                              )}

                              {/* Observaciones */}
                              {survey.observations && (
                                <ThemedView style={styles.observacionesContainer}>
                                  <ThemedText style={styles.observacionesLabel}>Observaciones:</ThemedText>
                                  <ThemedText style={styles.observacionesText}>{survey.observations}</ThemedText>
                                </ThemedView>
                              )}
                            </ThemedView>
                          )}
                        </ThemedView>
                      );
                    })}
                  </ThemedView>
                )}
              </>
            )}

            {isCreating && (
              <ThemedView style={styles.formCard}>
                <ThemedView style={styles.formContainer}>
                  <ThemedText style={styles.formTitle}>Nueva Encuesta</ThemedText>

                  {/* Jerarquía completa */}
                  <ThemedView style={styles.sectionContainer}>
                    <ThemedView style={styles.sectionHeader}>
                      <ThemedText style={styles.sectionTitle}>Jerarquía</ThemedText>
                    </ThemedView>

                    {/* Empresa */}
                    <ThemedView style={styles.formGroup}>
                      <ThemedText style={styles.label}>Empresa:</ThemedText>
                      <View style={styles.pickerWrapper}>
                        <Picker
                          selectedValue={formEmpresaId || ''}
                          onValueChange={(value) => {
                            setFormEmpresaId(value && value !== '' ? Number(value) : null);
                            setFormClienteId(null);
                            setFormDivisionId(null);
                            setFormContratoId(null);
                            setFormCorpoId(null);
                            setFormPuestoId(null);
                            empresaEvaluadaRef.current = '';
                            if (empresaEvaluadaInputRef.current) {
                              empresaEvaluadaInputRef.current.setNativeProps({ text: '' });
                            }
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

                    {/* Cliente */}
                    {formEmpresaId && (
                      <ThemedView style={styles.formGroup}>
                        <ThemedText style={styles.label}>Cliente:</ThemedText>
                        <View style={styles.pickerWrapper}>
                          <Picker
                            selectedValue={formClienteId || ''}
                            onValueChange={(value) => {
                              const clienteId = value && value !== '' ? Number(value) : null;
                              setFormClienteId(clienteId);
                              setFormDivisionId(null);
                              setFormContratoId(null);
                              setFormCorpoId(null);
                              setFormPuestoId(null);

                              // Llenar automáticamente empresa_evaluado con el nombre del cliente
                              if (clienteId) {
                                const cliente = formClientes.find((c: any) => c.id === clienteId);
                                if (cliente) {
                                  empresaEvaluadaRef.current = cliente.nombre;
                                  if (empresaEvaluadaInputRef.current) {
                                    empresaEvaluadaInputRef.current.setNativeProps({ text: cliente.nombre });
                                  }
                                }
                              } else {
                                empresaEvaluadaRef.current = '';
                                if (empresaEvaluadaInputRef.current) {
                                  empresaEvaluadaInputRef.current.setNativeProps({ text: '' });
                                }
                              }
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

                    {/* División */}
                    {formClienteId && (
                      <ThemedView style={styles.formGroup}>
                        <ThemedText style={styles.label}>División:</ThemedText>
                        <View style={styles.pickerWrapper}>
                          <Picker
                            selectedValue={formDivisionId || ''}
                            onValueChange={(value) => {
                              const divisionId = value && value !== '' ? Number(value) : null;
                              setFormDivisionId(divisionId);
                              setFormContratoId(null);
                              setFormCorpoId(null);
                              setFormPuestoId(null);

                              // Determinar el formulario basado en el nombre de la división
                              if (divisionId) {
                                const division = formDivisiones.find((d: any) => d.id === divisionId);
                                if (division) {
                                  const divisionName = division.nombre;
                                  // Establecer selectedDivision basado en el nombre
                                  if (divisionName === 'Seguridad' || divisionName.toLowerCase().includes('seguridad')) {
                                    setSelectedDivision('Seguridad');
                                    divisionRef.current = 'Seguridad';
                                  } else if (divisionName === 'Aseo & Limpieza' || divisionName === 'Aseo y limpieza' || divisionName.toLowerCase().includes('aseo') || divisionName.toLowerCase().includes('limpieza')) {
                                    setSelectedDivision('Aseo & Limpieza');
                                    divisionRef.current = 'Aseo & Limpieza';
                                  } else {
                                    // División no soportada
                                    setSelectedDivision('');
                                    divisionRef.current = '';
                                  }
                                  // Limpiar respuestas cuando cambia la división
                                  setAnswers({});
                                  answersRef.current = {};
                                  setFormKey(prev => prev + 1);
                                }
                              } else {
                                setSelectedDivision('Seguridad');
                                divisionRef.current = 'Seguridad';
                              }
                            }}
                            style={styles.picker}
                          >
                            <Picker.Item label="Seleccionar..." value="" />
                            {formDivisiones.map((d: any) => (
                              <Picker.Item key={d.id} label={d.nombre} value={d.id} />
                            ))}
                          </Picker>
                        </View>
                        {/* Advertencia si la división seleccionada no tiene formulario */}
                        {formDivisionId && selectedDivision !== 'Seguridad' && selectedDivision !== 'Aseo & Limpieza' && (
                          <ThemedView style={styles.warningBox}>
                            <Ionicons name="warning" size={20} color="#FF9500" />
                            <ThemedText style={styles.warningText}>
                              No existe un formulario para esta división. Solo están disponibles formularios para "Seguridad" y "Aseo & Limpieza".
                            </ThemedText>
                          </ThemedView>
                        )}
                      </ThemedView>
                    )}

                    {/* Contrato */}
                    {formDivisionId && (
                      <ThemedView style={styles.formGroup}>
                        <ThemedText style={styles.label}>Contrato:</ThemedText>
                        <View style={styles.pickerWrapper}>
                          <Picker
                            selectedValue={formContratoId || ''}
                            onValueChange={(value) => {
                              setFormContratoId(value && value !== '' ? Number(value) : null);
                              setFormCorpoId(null);
                              setFormPuestoId(null);
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

                    {/* Sucursal */}
                    {formContratoId && (
                      <ThemedView style={styles.formGroup}>
                        <ThemedText style={styles.label}>Sucursal:</ThemedText>
                        <View style={styles.pickerWrapper}>
                          <Picker
                            selectedValue={formCorpoId || ''}
                            onValueChange={(value) => {
                              setFormCorpoId(value && value !== '' ? Number(value) : null);
                              setFormPuestoId(null);
                              // Cargar puestos cuando se selecciona una sucursal
                              if (value && value !== '') {
                                fetchPuestosForCorpo(Number(value), true);
                              }
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

                    {/* Puesto */}
                    {formCorpoId && (
                      <ThemedView style={styles.formGroup}>
                        <ThemedText style={styles.label}>Puesto:</ThemedText>
                        <View style={styles.pickerWrapper}>
                          <Picker
                            selectedValue={formPuestoId || ''}
                            onValueChange={(value) => {
                              const puestoId = value && value !== '' ? Number(value) : null;
                              setFormPuestoId(puestoId);
                              puestoIdRef.current = puestoId || 0;
                            }}
                            style={styles.picker}
                          >
                            <Picker.Item label="Seleccionar..." value="" />
                            {formPuestosList.map((p: any) => (
                              <Picker.Item key={p.id} label={p.nombre} value={p.id} />
                            ))}
                          </Picker>
                        </View>
                      </ThemedView>
                    )}
                  </ThemedView>

                  {/* Empresa Evaluada */}
                  <ThemedView style={styles.formGroup}>
                    <ThemedText style={styles.label}>Nombre de la empresa evaluada:</ThemedText>
                    <TextInput
                      ref={empresaEvaluadaInputRef}
                      style={styles.input}
                      defaultValue={empresaEvaluadaRef.current}
                      onChangeText={(text) => { empresaEvaluadaRef.current = text; }}
                      placeholder="Nombre de la empresa"
                      placeholderTextColor="#999"
                      key={`empresa-${formKey}`}
                    />
                  </ThemedView>

                  {/* Persona que llena la encuesta */}
                  <ThemedView style={styles.sectionContainer}>
                    <ThemedView style={styles.sectionHeader}>
                      <ThemedText style={styles.sectionTitle}>Persona que llena la encuesta</ThemedText>
                    </ThemedView>

                    <ThemedView style={styles.formGroup}>
                      <ThemedText style={styles.label}>Nombre:</ThemedText>
                      <TextInput
                        ref={personaNombreInputRef}
                        style={styles.input}
                        defaultValue={personaNombreRef.current}
                        onChangeText={(text) => { personaNombreRef.current = text; }}
                        placeholder="Nombre completo"
                        placeholderTextColor="#999"
                        key={`persona-nombre-${formKey}`}
                      />
                    </ThemedView>

                    <ThemedView style={styles.formGroup}>
                      <ThemedText style={styles.label}>Cédula:</ThemedText>
                      <TextInput
                        ref={personaCedulaInputRef}
                        style={styles.input}
                        defaultValue={personaCedulaRef.current}
                        onChangeText={(text) => { personaCedulaRef.current = text; }}
                        placeholder="Cédula"
                        placeholderTextColor="#999"
                        keyboardType="numeric"
                        key={`persona-cedula-${formKey}`}
                      />
                    </ThemedView>

                    <ThemedView style={styles.formGroup}>
                      <ThemedText style={styles.label}>Teléfono:</ThemedText>
                      <TextInput
                        ref={personaTelefonoInputRef}
                        style={styles.input}
                        defaultValue={personaTelefonoRef.current}
                        onChangeText={(text) => { personaTelefonoRef.current = text; }}
                        placeholder="Teléfono"
                        placeholderTextColor="#999"
                        keyboardType="phone-pad"
                        key={`persona-telefono-${formKey}`}
                      />
                    </ThemedView>

                    <ThemedView style={styles.formGroup}>
                      <ThemedText style={styles.label}>Email:</ThemedText>
                      <TextInput
                        ref={personaEmailInputRef}
                        style={styles.input}
                        defaultValue={personaEmailRef.current}
                        onChangeText={(text) => { personaEmailRef.current = text; }}
                        placeholder="Email"
                        placeholderTextColor="#999"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        key={`persona-email-${formKey}`}
                      />
                    </ThemedView>
                  </ThemedView>

                  {/* Fecha */}
                  <ThemedView style={styles.formGroup}>
                    <ThemedText style={styles.label}>Fecha de la encuesta:</ThemedText>
                    <TouchableOpacity
                      style={styles.dateButton}
                      onPress={() => setShowFechaEncuestaPicker(true)}
                    >
                      <ThemedText style={styles.dateButtonText}>
                        {formatDateForDisplay(fechaEncuestaRef.current) || 'Seleccionar fecha'}
                      </ThemedText>
                    </TouchableOpacity>
                    {showFechaEncuestaPicker && (
                      <DateTimePicker
                        value={fechaEncuesta}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(event, selectedDate) => {
                          setShowFechaEncuestaPicker(Platform.OS === 'ios');
                          if (selectedDate) {
                            setFechaEncuesta(selectedDate);
                            fechaEncuestaRef.current = formatDateToISO(selectedDate);
                          }
                        }}
                      />
                    )}
                  </ThemedView>

                  {/* Questions - Solo mostrar si hay una división válida seleccionada */}
                  {formDivisionId && (selectedDivision === 'Seguridad' || selectedDivision === 'Aseo & Limpieza') && (
                    <ThemedView style={styles.sectionContainer}>
                      <ThemedView style={styles.sectionHeader}>
                        <ThemedText style={styles.sectionTitle}>Preguntas</ThemedText>
                      </ThemedView>
                      {getQuestionsForDivision(selectedDivision).map((question, index) => renderQuestion(question, index))}
                    </ThemedView>
                  )}

                  {/* Observaciones */}
                  <ThemedView style={styles.formGroup}>
                    <ThemedText style={styles.label}>
                      Agradecemos nos indique si existe algún punto de mejora para nuestro servicio:
                    </ThemedText>
                    <TextInput
                      ref={observacionesInputRef}
                      style={[styles.input, styles.textArea]}
                      defaultValue={observacionesRef.current}
                      onChangeText={(text) => { observacionesRef.current = text; }}
                      placeholder="Observaciones"
                      placeholderTextColor="#999"
                      multiline
                      numberOfLines={4}
                      key={`observaciones-${formKey}`}
                    />
                  </ThemedView>

                  {/* Firma persona evaluada (opcional) */}
                  <ThemedView style={styles.formGroup}>
                    <ThemedText style={styles.label}>Firma de la persona que realiza la encuesta (opcional):</ThemedText>

                    {personSignature ? (
                      <ThemedView style={styles.signaturePreviewContainer}>
                        <Image
                          source={{ uri: personSignature }}
                          style={styles.signaturePreview}
                          resizeMode="contain"
                        />
                        <TouchableOpacity style={styles.removeSignatureButton} onPress={removeSignature}>
                          {getActionIcon('delete')}
                        </TouchableOpacity>
                      </ThemedView>
                    ) : null}

                    <TouchableOpacity style={styles.openSignatureButton} onPress={openSignatureModal}>
                      <Ionicons name="create-outline" size={20} color="#000000" />
                      <ThemedText style={styles.openSignatureButtonText}>
                        {personSignature ? 'Modificar firma' : 'Agregar firma'}
                      </ThemedText>
                    </TouchableOpacity>
                  </ThemedView>

                  {/* Modal de firma */}
                  <Modal
                    visible={isSignatureModalVisible}
                    animationType="slide"
                    transparent={false}
                    onRequestClose={closeSignatureModal}
                  >
                    <ThemedView style={styles.modalContainer}>
                      <ThemedView style={styles.modalHeader}>
                        <ThemedText style={styles.modalTitle}>Dibujar Firma</ThemedText>
                        <TouchableOpacity onPress={closeSignatureModal}>
                          <Ionicons name="close" size={24} color="#333" />
                        </TouchableOpacity>
                      </ThemedView>

                      <View style={styles.modalSignatureContainer}>
                        <SignatureScreen
                          ref={signatureRef}
                          onOK={handleSignatureRead}
                          descriptionText="Dibuja tu firma en el área blanca"
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
                  </Modal>

                  {/* Responsable */}
                  <ThemedView style={styles.sectionContainer}>
                    <ThemedView style={styles.sectionHeader}>
                      <ThemedText style={styles.sectionTitle}>Responsable de la encuesta</ThemedText>
                    </ThemedView>

                    <ThemedView style={styles.formGroup}>
                      <ThemedText style={styles.label}>Nombre:</ThemedText>
                      <TextInput
                        ref={responsableNombreInputRef}
                        style={styles.input}
                        defaultValue={responsableNombreRef.current}
                        onChangeText={(text) => { responsableNombreRef.current = text; }}
                        placeholder="Nombre del responsable"
                        placeholderTextColor="#999"
                        key={`responsable-nombre-${formKey}`}
                      />
                    </ThemedView>

                    <ThemedView style={styles.formGroup}>
                      <ThemedText style={styles.label}>Cédula:</ThemedText>
                      <TextInput
                        ref={responsableCedulaInputRef}
                        style={styles.input}
                        defaultValue={responsableCedulaRef.current}
                        onChangeText={(text) => { responsableCedulaRef.current = text; }}
                        placeholder="Cédula del responsable"
                        placeholderTextColor="#999"
                        keyboardType="numeric"
                        key={`responsable-cedula-${formKey}`}
                      />
                    </ThemedView>

                    {/* Firma responsable (generada) */}
                    <ThemedView style={styles.formGroup}>
                      <ThemedText style={styles.label}>Firma del Responsable *:</ThemedText>
                      {!firmaResponsable ? (
                        <TouchableOpacity
                          style={styles.signatureButton}
                          onPress={generateResponsableSignature}
                          disabled={isGeneratingFirmaResponsable}
                        >
                          {isGeneratingFirmaResponsable ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <>
                              <Ionicons name="create" size={24} color='#000000' />
                              <ThemedText style={styles.signatureButtonText}>Generar Firma</ThemedText>
                            </>
                          )}
                        </TouchableOpacity>
                      ) : (
                        <ThemedView style={styles.signatureInfo}>
                          <ThemedText style={styles.signatureInfoTitle}>Información de la firma:</ThemedText>
                          <ThemedText style={styles.signatureInfoText}>
                            ID de sesión: {firmaResponsable.sessionId}
                          </ThemedText>
                          <ThemedText style={styles.signatureInfoText}>
                            ID del empleado: {firmaResponsable.empleadoId}
                          </ThemedText>
                          {firmaResponsable.empleadoDetalle && (
                            <ThemedText style={styles.signatureInfoText}>
                              Empleado: {firmaResponsable.empleadoDetalle.nombre} {firmaResponsable.empleadoDetalle.primer_apellido} {firmaResponsable.empleadoDetalle.segundo_apellido}
                            </ThemedText>
                          )}
                          <ThemedText style={styles.signatureInfoText}>
                            Latitud: {firmaResponsable.latitud}
                          </ThemedText>
                          <ThemedText style={styles.signatureInfoText}>
                            Longitud: {firmaResponsable.longitud}
                          </ThemedText>
                          <ThemedText style={styles.signatureInfoText}>
                            Timestamp: {generateDateTime(firmaResponsable.timestamp)}
                          </ThemedText>
                          <TouchableOpacity
                            style={styles.removeSignatureButton}
                            onPress={() => setFirmaResponsable(null)}
                          >
                            {getActionIcon('delete')}
                          </TouchableOpacity>
                        </ThemedView>
                      )}
                    </ThemedView>
                  </ThemedView>

                  {/* Action buttons */}
                  <ThemedView style={styles.formActions}>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={cancelCreating}
                    >
                      <ThemedText style={styles.cancelButtonText}>{getActionIcon('cancel')}</ThemedText>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.saveButton}
                      onPress={createSurvey}
                    >
                      <ThemedText style={styles.saveButtonText}>{getActionIcon('confirm')}</ThemedText>
                    </TouchableOpacity>
                  </ThemedView>
                </ThemedView>
              </ThemedView>
            )}
          </ThemedView>
        </ThemedView>
      </ScrollView>

      {/* Filter Date Picker */}
      {showFilterFechaPicker && (
        <DateTimePicker
          value={filterFecha ? new Date(filterFecha + 'T12:00:00') : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleFilterFechaChange}
        />
      )}

      {/* Modal Añadir firma persona evaluada (en lista, cuando falta) */}
      <Modal
        visible={addSignatureModalVisible}
        animationType="fade"
        transparent
        presentationStyle="overFullScreen"
        onRequestClose={closeAddSignatureModal}
      >
        <View style={styles.addSignatureOverlay}>
          <ThemedView style={styles.addSignatureModalCard}>
            <ThemedView style={styles.addSignatureModalHeader}>
              <ThemedText style={styles.modalTitle}>Añadir firma persona evaluada</ThemedText>
              <TouchableOpacity onPress={closeAddSignatureModal}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </ThemedView>
            <ThemedText style={styles.addSignatureModalHint}>Dibuje la firma dentro del recuadro.</ThemedText>
            <View style={styles.addSignaturePadBox}>
              <SignatureScreen
                ref={addSignatureManualRef}
                onOK={handleAddSignatureManualRead}
                onEmpty={() => {
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
                key={addSignatureManualKey}
              />
            </View>
            <ThemedView style={styles.modalActions}>
              <TouchableOpacity style={styles.modalClearButton} onPress={closeAddSignatureModal}>
                <ThemedText style={styles.modalClearButtonText}>Cancelar</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalAcceptButton, isAddSignatureSubmitting && { opacity: 0.6 }]}
                onPress={triggerAddSignatureManualRead}
                disabled={isAddSignatureSubmitting}
              >
                {isAddSignatureSubmitting ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <Ionicons name="checkmark" size={20} color="#000000" />
                )}
                <ThemedText style={styles.modalAcceptButtonText}>Confirmar</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          </ThemedView>
        </View>
      </Modal>

      <AppFooter />
      <SlideMenu isVisible={isMenuVisible} onClose={handleMenuClose} onHomePress={handleHomePress} />
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    opacity: 0.7,
  },
  noMarcaContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 20,
  },
  noMarcaTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF9500',
    textAlign: 'center',
  },
  noMarcaMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 400,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
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
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.5,
    textAlign: 'center',
  },
  surveysList: {
    width: '100%',
    gap: 16,
  },
  surveyCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#fff',
    padding: 16,
    gap: 8,
  },
  surveyHeader: {
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#fff',
  },
  surveyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  surveyInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  surveyLabel: {
    fontWeight: '600',
    color: '#333',
  },
  collapseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    marginTop: 8,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  collapseButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  collapsableContent: {
    padding: 12,
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
  },
  personaContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  personaTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  personaText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  personaLabel: {
    fontWeight: '600',
    color: '#333',
  },
  responsableContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  responsableTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  responsableText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  responsableLabel: {
    fontWeight: '600',
    color: '#333',
  },
  formCard: {
    marginBottom: 20,
  },
  formContainer: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#fff',
    padding: 16,
    gap: 8,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    width: '100%',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: '#F9F9F9',
    color: '#000000',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  sectionContainer: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#fff',
    padding: 16,
    gap: 8,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
    overflow: 'hidden',
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
  },
  picker: {
    width: '100%',
    height: 50,
    color: '#000',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFB74D',
    marginTop: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#E65100',
    lineHeight: 18,
  },
  hierarchyFiltersContainer: {
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
    overflow: 'hidden',
  },
  hierarchyFiltersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  filterToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  hierarchyFiltersContent: {
    padding: 12,
    gap: 8,
  },
  dateButton: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#F9F9F9',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#333',
  },
  filtersContainer: {
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  filtersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  filterToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
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
    padding: 6,
    borderRadius: 6,
  },
  resetFiltersText: {
    fontSize: 14,
    color: '#FF3B30',
    fontWeight: '600',
  },
  filtersContent: {
    padding: 16,
    gap: 8,
    backgroundColor: '#F8F9FA',
  },
  filterGroup: {
    marginBottom: 12,
    backgroundColor: '#F8F9FA',
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  searchInput: {
    width: '100%',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: '#F9F9F9',
    color: '#000000',
  },
  radioContainerDivision: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 5,
    backgroundColor: '#fff',
  },
  radioContainer: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 5,
    backgroundColor: '#F8F9FA',
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  radioLabel: {
    fontSize: 16,
    color: '#333',
  },
  questionContainer: {
    marginBottom: 20,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
  },
  questionTitle: {
    fontSize: 14,
    marginBottom: 12,
    fontWeight: '500',
    color: '#333',
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8f9fa',
  },
  signaturePreviewContainer: {
    marginBottom: 12,
    alignItems: 'center',
    backgroundColor: '#fff'
  },
  signaturePreview: {
    width: '100%',
    height: 200,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    marginBottom: 10,
  },
  openSignatureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  openSignatureButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  removeSignatureButton: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF3B30',
    padding: 10,
    borderRadius: 8,
    gap: 8,
    width: '100%',
  },
  removeSignatureText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#fff',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalSignatureContainer: {
    width: '100%',
    height: 200,
    margin: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    alignSelf: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    backgroundColor: '#fff',
  },
  modalClearButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF3B30',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  modalClearButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  modalAcceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#34C759',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  modalAcceptButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  signatureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    marginTop: 10,
  },
  signatureButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  signatureInfo: {
    padding: 15,
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
    marginTop: 10,
  },
  signatureInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  signatureInfoText: {
    fontSize: 14,
    marginBottom: 4,
    color: '#666',
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    backgroundColor: '#fff',
  },
  cancelButton: {
    backgroundColor: '#8E8E93',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    flex: 1,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#34C759',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  firmaSection: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#F0F9F4',
    borderRadius: 6,
  },
  firmaSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#34C759',
    marginBottom: 4,
  },
  firmaText: {
    fontSize: 12,
    color: '#666',
  },
  signatureImageContainer: {
    width: '100%',
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
    backgroundColor: '#F8F9FA',
  },
  signatureImage: {
    width: '100%',
    height: 200,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  addSignatureOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  addSignatureModalCard: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  addSignatureModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#F8F9FA',
  },
  addSignatureModalHint: {
    paddingHorizontal: 16,
    paddingTop: 12,
    color: '#666',
    fontSize: 13,
  },
  addSignaturePadBox: {
    marginTop: 10,
    marginHorizontal: 16,
    height: 260,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  evaluacionesContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  evaluacionesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  evaluacionItem: {
    marginBottom: 8,
    padding: 8,
    backgroundColor: '#fff',
    borderRadius: 6,
  },
  evaluacionQuestion: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  evaluacionResult: {
    fontSize: 12,
    color: '#666',
  },
  observacionesContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  observacionesLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  observacionesText: {
    fontSize: 13,
    color: '#666',
  },
});

