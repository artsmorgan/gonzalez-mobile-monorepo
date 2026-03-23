import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  Image,
  Platform,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import AppHeader from '@/components/AppHeader';
import AppFooter from '@/components/AppFooter';
import { formatDateDMY } from '@/utils/formatDate';
import SlideMenu from '@/components/SlideMenu';
import { useAuth } from '@/contexts/AuthContext';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Network from 'expo-network';
import * as Location from 'expo-location';
import { jwtDecode } from 'jwt-decode';
import { Picker } from '@react-native-picker/picker';
import { useQRScanner } from '@/hooks/useQRScanner';
import DateTimePicker from '@react-native-community/datetimepicker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import SignatureScreen from 'react-native-signature-canvas';
import { createStaffEvaluation, deleteStaffEvaluation, updateStaffEvaluationSignature } from '@/hooks/staffEvaluationsFunctions';
import getHoraAccion from '@/hooks/getHoraAccion';
import authedFetch from '@/hooks/authedFetch';
import getValidAccessTokenOrLogout from '@/hooks/getValidAccessTokenOrLogout';

type StaffEvaluationsNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'StaffEvaluations'
>;

interface CurrentMarca {
  id: number;
  corpo?: {
    id: number;
    nombre: string;
  };
}

interface CorpoEmployee {
  id: number;
  nombre: string;
  cedula: string;
  fecha_contratacion: string;
}

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

interface EvaluationQuestion {
  title: string;
  answear: string;
  image: string | null;
  images?: string[]; // múltiples imágenes por objetivo
  editableTitle?: boolean;
  imageOrientation?: 'horizontal' | 'vertical';
}

interface EvaluationSection {
  title: string;
  minimum_score?: number | null;
  questions: EvaluationQuestion[];
}

interface StaffEvaluation {
  id: number;
  empleado: {
    id: number;
    nombre: string;
    cedula: string;
  };
  evaluador: {
    id: number;
    nombre: string;
    cedula: string;
  };
  fecha_ingreso: string;
  fecha_evaluacion: string;
  evaluacion: string | EvaluationSection[];
  comentarios: string;
  tipo: string;
  firma_evaluador: string;
  firma_empleado?: string | null;
  firma_empleado_manual?: string | null;
  id_local: string;
}

type EvaluationTipo = 'Seguridad' | 'Aseo & limpieza' | 'Otros';

const monthNames = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

export default function StaffEvaluationsScreen() {
  const { employee, refreshAccessToken, logout, accessToken } = useAuth();
  const navigation = useNavigation<StaffEvaluationsNavigationProp>();
  const appendTokenToUrl = (url: string) => {
    if (!url) return '';
    if (!accessToken || accessToken.trim().length === 0) return url;
    if (/[?&]token=/.test(url)) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}token=${encodeURIComponent(accessToken)}`;
  };
  const [isMenuVisible, setIsMenuVisible] = useState(false);

  // Marca / corpo
  const [isLoading, setIsLoading] = useState(true);
  const [hasMarca, setHasMarca] = useState<boolean>(false);
  const [marcaId, setMarcaId] = useState<number | null>(null);
  const [corpoId, setCorpoId] = useState<number | null>(null);

  // Datos remotos / cache
  const [evaluaciones, setEvaluaciones] = useState<StaffEvaluation[]>([]);
  const [structure, setStructure] = useState<MainStructureEmpresa[]>([]);
  const [isStructureLoading, setIsStructureLoading] = useState(false);

  // Expand / detalles
  const [expandedEvaluations, setExpandedEvaluations] = useState<Set<string>>(new Set());
  const [expandedFirmas, setExpandedFirmas] = useState<Set<string>>(new Set());

  // Formulario de nueva evaluación
  const [isCreating, setIsCreating] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<number | null>(null);
  const [selectedClienteId, setSelectedClienteId] = useState<number | null>(null);
  const [selectedDivisionId, setSelectedDivisionId] = useState<number | null>(null);
  const [selectedContratoId, setSelectedContratoId] = useState<number | null>(null);
  const [selectedCorpoId, setSelectedCorpoId] = useState<number | null>(null);
  const [selectedPuestoId, setSelectedPuestoId] = useState<number | null>(null);
  const [selectedPlazaId, setSelectedPlazaId] = useState<number | null>(null);
  const isRestoringHierarchyRef = useRef(false);
  const [selectedEmpleadoId, setSelectedEmpleadoId] = useState<number | null>(null);
  const [nombreColaborador, setNombreColaborador] = useState('');
  const [cedulaColaborador, setCedulaColaborador] = useState('');
  const [fechaIngreso, setFechaIngreso] = useState('');
  const [fechaEvaluacion, setFechaEvaluacion] = useState('');
  const [tipoEvaluacion, setTipoEvaluacion] = useState<EvaluationTipo>('Seguridad');
  const [comentariosGenerales, setComentariosGenerales] = useState('');
  const [nombreEvaluador, setNombreEvaluador] = useState('');
  // Refs para valores de formulario (similar a IncidentsScreen)
  const empleadoIdRef = useRef<number | null>(null);
  const nombreColaboradorRef = useRef<string>('');
  const cedulaColaboradorRef = useRef<string>('');
  const fechaIngresoRef = useRef<string>('');
  const fechaEvaluacionRef = useRef<string>('');
  const tipoEvaluacionRef = useRef<EvaluationTipo>('Seguridad');
  const comentariosGeneralesRef = useRef<string>('');
  const nombreEvaluadorRef = useRef<string>('');

  // Filtros
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  const [filterColaboradorNombre, setFilterColaboradorNombre] = useState('');
  const [filterColaboradorCedula, setFilterColaboradorCedula] = useState('');
  const [filterEvaluadorNombre, setFilterEvaluadorNombre] = useState('');
  const [filterEvaluadorCedula, setFilterEvaluadorCedula] = useState('');
  const [filterTipo, setFilterTipo] = useState<string>('all');
  const [filterFechaEvaluacion, setFilterFechaEvaluacion] = useState<string>('');
  const [showFilterFechaPicker, setShowFilterFechaPicker] = useState(false);

  // Evaluación dinámica (solo almacenamos respuestas; la estructura se infiere por tipo)
  const [evaluationSections, setEvaluationSections] = useState<EvaluationSection[]>([]);

  // Firma evaluador / funcionario
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [isGeneratingFirmaEval, setIsGeneratingFirmaEval] = useState(false);
  const [firmaEvaluador, setFirmaEvaluador] = useState<FirmaData | null>(null);
  const [firmaEvaluadorHash, setFirmaEvaluadorHash] = useState<string | null>(null);
  const [firmaEmpleado, setFirmaEmpleado] = useState<FirmaData | null>(null);
  const [firmaEmpleadoHash, setFirmaEmpleadoHash] = useState<string | null>(null);
  const [firmaEmpleadoManual, setFirmaEmpleadoManual] = useState<string | null>(null);
  const [firmaEmpleadoWarning, setFirmaEmpleadoWarning] = useState<string | null>(null);

  // QR
  const { scanQR, QRScannerComponent } = useQRScanner();

  // Camera para imágenes de preguntas
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraVisible, setCameraVisible] = useState(false);
  const cameraRef = useRef<any>(null);
  const [currentQuestionKey, setCurrentQuestionKey] = useState<string | null>(null);

  // Firma manual de empleado
  const [isFirmaManualModalVisible, setIsFirmaManualModalVisible] = useState(false);
  const signatureManualRef = useRef<any>(null);
  const [signatureManualKey, setSignatureManualKey] = useState(0);
  const [isReadingManualSignature, setIsReadingManualSignature] = useState(false);

  // Modal añadir firma (lista): digital o manual para un registro existente
  const [addSignatureModalVisible, setAddSignatureModalVisible] = useState(false);
  const [addSignatureEvaluation, setAddSignatureEvaluation] = useState<StaffEvaluation | null>(null);
  const [addSignatureType, setAddSignatureType] = useState<'firma_empleado' | 'firma_empleado_manual' | null>(null);
  const [addSignatureQRValue, setAddSignatureQRValue] = useState<string | null>(null);
  const addSignatureManualRef = useRef<any>(null);
  const [addSignatureManualKey, setAddSignatureManualKey] = useState(0);
  const [isAddSignatureSubmitting, setIsAddSignatureSubmitting] = useState(false);

  // Date pickers
  const [showFechaIngresoPicker, setShowFechaIngresoPicker] = useState(false);
  const [showFechaEvaluacionPicker, setShowFechaEvaluacionPicker] = useState(false);

  // Conectividad
  const checkConnection = async (): Promise<boolean> => {
    const state = await Network.getNetworkStateAsync();
    return !!(state.isConnected && state.isInternetReachable);
  };

  const handleMenuPress = () => setIsMenuVisible(true);
  const handleMenuClose = () => setIsMenuVisible(false);
  const handleHomePress = () => {
    navigation.navigate('Home');
    setIsMenuVisible(false);
  };

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'staff-evaluations':
        return <Ionicons name="clipboard" size={25} color="#000000" />;
      case 'add':
        return <Ionicons name="add" size={24} color="#ffffff" />;
      case 'confirm':
        return <Ionicons name="checkmark" size={24} color="#ffffff" />;
      case 'cancel':
        return <Ionicons name="close" size={24} color="#ffffff" />;
      case 'signature':
        return <Ionicons name="finger-print" size={20} color="#ffffff" />;
      case 'qr':
        return <Ionicons name="qr-code" size={20} color="#ffffff" />;
      case 'camera':
        return <Ionicons name="camera" size={18} color="#000000" />;
      default:
        return <Ionicons name="clipboard" size={25} color="#000000" />;
    }
  };

  const formatDateLabel = (iso: string) => {
    if (!iso) return '';
    const date_complete = new Date(Number(iso)).toISOString().split('T');
    console.log('date_complete', date_complete);
    const date = date_complete[0];
    const time = date_complete[1].split('.')[0];
    return `${date} ${time}`;
  };

  const dateToLocalString = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const formatEmpleadoNombre = (emp: MainStructureEmpleado): string => {
    const fullName = [emp.nombre, emp.primer_apellido, emp.segundo_apellido]
      .map((v) => String(v || '').trim())
      .filter((v) => v.length > 0)
      .join(' ')
      .trim();
    return fullName || `Empleado #${emp.id}`;
  };

  const empresaNode = useMemo(
    () => structure.find((e) => e.id === selectedEmpresaId) ?? null,
    [structure, selectedEmpresaId]
  );
  const clienteNodes = useMemo(() => empresaNode?.clientes ?? [], [empresaNode]);
  const clienteNode = useMemo(
    () => clienteNodes.find((c) => c.id === selectedClienteId) ?? null,
    [clienteNodes, selectedClienteId]
  );
  const divisionNodes = useMemo(() => clienteNode?.division ?? [], [clienteNode]);
  const divisionNode = useMemo(
    () => divisionNodes.find((d) => d.id === selectedDivisionId) ?? null,
    [divisionNodes, selectedDivisionId]
  );
  const contratoNodes = useMemo(() => divisionNode?.contratos ?? [], [divisionNode]);
  const contratoNode = useMemo(
    () => contratoNodes.find((c) => c.id === selectedContratoId) ?? null,
    [contratoNodes, selectedContratoId]
  );
  const sucursalNodes = useMemo(() => contratoNode?.sucursales ?? [], [contratoNode]);
  const sucursalNode = useMemo(
    () => sucursalNodes.find((s) => s.id === selectedCorpoId) ?? null,
    [sucursalNodes, selectedCorpoId]
  );
  const puestoNodes = useMemo(() => sucursalNode?.puestos ?? [], [sucursalNode]);
  const puestoNode = useMemo(
    () => puestoNodes.find((p) => p.id === selectedPuestoId) ?? null,
    [puestoNodes, selectedPuestoId]
  );
  const plazaNodes = useMemo(() => puestoNode?.plazas ?? [], [puestoNode]);
  const plazaNode = useMemo(
    () => plazaNodes.find((p) => p.id === selectedPlazaId) ?? null,
    [plazaNodes, selectedPlazaId]
  );

  const empleados: CorpoEmployee[] = useMemo(() => {
    return (plazaNode?.empleados ?? []).map((emp) => ({
      id: emp.id,
      nombre: formatEmpleadoNombre(emp),
      cedula: String(emp.cedula || ''),
      fecha_contratacion: String(emp.fecha_contratacion || ''),
    }));
  }, [plazaNode]);

  const initializeSectionsForTipo = (tipo: EvaluationTipo) => {
    tipoEvaluacionRef.current = tipo;

    if (tipo === 'Seguridad' || tipo === 'Aseo & limpieza') {
      const baseQuestionsTitles =
        tipo === 'Aseo & limpieza'
          ? [
            'Cumplimiento de Tareas',
            'Limpieza del Área Asignada',
            'Disponibilidad',
            'Ausentismo',
            'Incapacidades / Accidentes Laborales',
            'Puntualidad / Llegadas Tardías',
            'Actitud de Servicio',
            'Quejas de Clientes',
            'Relaciones con los compañeros y supervisores',
            'Buena presentación personal',
          ]
          : [
            'Cumplimiento de Tareas',
            'Vigilancia del Área Asignada',
            'Disponibilidad',
            'Ausentismo',
            'Incapacidades / Accidentes Laborales',
            'Puntualidad / Llegadas Tardías',
            'Actitud de Servicio',
            'Quejas de Clientes',
            'Relaciones con los compañeros y supervisores',
            'Buena presentación personal',
          ];

      const questions: EvaluationQuestion[] = baseQuestionsTitles.map((t) => ({
        title: t,
        answear: '10', // Por defecto todas las estrellas seleccionadas
        image: null,
        images: [],
        editableTitle: false,
      }));

      setEvaluationSections([
        {
          title: 'Evaluación principal',
          minimum_score: 70,
          questions,
        },
      ]);
    } else {
      // Tipo "Otros": construir estructura básica basada en el JSON proporcionado
      const makeEmptyQuestions = (count: number, editableTitle: boolean, fixedTitles?: string[]) => {
        const arr: EvaluationQuestion[] = [];
        for (let i = 0; i < count; i++) {
          arr.push({
            title: fixedTitles && fixedTitles[i] ? fixedTitles[i] : '',
            answear: '10', // Por defecto todas las estrellas seleccionadas
            image: null,
            images: [],
            editableTitle: editableTitle,
          });
        }
        return arr;
      };

      setEvaluationSections([
        {
          title: 'Objetivos generales 50%',
          minimum_score: null,
          questions: makeEmptyQuestions(5, true),
        },
        {
          title: 'Competencias genéricas 10%',
          minimum_score: null,
          questions: makeEmptyQuestions(3, false, [
            'Responsabilidad',
            'Compromiso',
            'Espíritu de Servicio al cliente interno y externo',
          ]),
        },
        {
          title: 'Competencias específicas por área 10%',
          minimum_score: null,
          questions: makeEmptyQuestions(4, false, [
            'Capacidad de planificación y organización',
            'Comunicación',
            'Trabajo en equipo',
            'Orientación de resultados',
          ]),
        },
        {
          title:
            'Competencias gerenciales liderazgo (Aplica sólo para puestos de Supervisión, Jefaturas y Directores)  20%',
          minimum_score: null,
          questions: makeEmptyQuestions(6, false, [
            'Es confiable',
            'Da sentido al futuro',
            'Dirige y ejecuta el trabajo',
            'Compromete el talento',
            'Desarrolla el talento',
            'Se desarrolla a sí mismo',
          ]),
        },
        {
          title: 'Formación valuable 10%',
          minimum_score: null,
          questions: makeEmptyQuestions(5, false, [
            'General (Políticas y Filosofía Corporativa )',
            'Cursos específicos o según licitacion',
            'Herramientas tecnológicas (Software o equipo que debe saber utilizar)',
            'Procedimientos, manuales, formularios, guías de puestos ó Instructivos específicos que debe saber utilizar',
            'Otra formación según funciones a ejecutar',
          ]),
        },
        {
          title: 'Retroalimentación',
          minimum_score: null,
          questions: makeEmptyQuestions(4, false, [
            'Aspectos positivos del colaborador (Fortalezas)',
            'Áreas o competencias por mejorar (Oportunidad de mejora)',
            'Plan de acción (Recomendaciones)',
            'Aspiraciones personales - ¿Cuáles son sus metas próximas a nivel profesional?',
          ]),
        },
        {
          title: 'Comentarios',
          minimum_score: null,
          questions: makeEmptyQuestions(2, false, ['Colaborador', 'Jefatura']),
        },
      ]);
    }
  };

  const resolveHierarchyByCurrentMarca = useCallback(
    (mainStructure: MainStructureEmpresa[], current: any) => {
      const marcaClienteId = current?.cliente?.id ?? current?.cliente_id ?? null;
      const marcaCorpoId = current?.corpo?.id ?? current?.corpo_id ?? null;
      const marcaPuestoId = current?.puesto?.id ?? current?.puesto_id ?? null;
      const marcaPlazaId = current?.plaza?.id ?? current?.plaza_id ?? null;

      for (const empresa of mainStructure) {
        for (const cliente of empresa.clientes ?? []) {
          if (marcaClienteId && Number(cliente.id) !== Number(marcaClienteId)) continue;
          for (const division of cliente.division ?? []) {
            for (const contrato of division.contratos ?? []) {
              for (const sucursal of contrato.sucursales ?? []) {
                if (marcaCorpoId && Number(sucursal.id) !== Number(marcaCorpoId)) continue;
                for (const puesto of sucursal.puestos ?? []) {
                  if (marcaPuestoId && Number(puesto.id) !== Number(marcaPuestoId)) continue;
                  const plazas = puesto.plazas ?? [];
                  const plaza =
                    plazas.find((p) => marcaPlazaId && Number(p.id) === Number(marcaPlazaId)) ??
                    plazas[0] ??
                    null;
                  return {
                    empresaId: empresa.id,
                    clienteId: cliente.id,
                    divisionId: division.id,
                    contratoId: contrato.id,
                    corpoId: sucursal.id,
                    puestoId: puesto.id,
                    plazaId: plaza?.id ?? null,
                  };
                }
              }
            }
          }
        }
      }
      return null;
    },
    []
  );

  const clearSelectedEmpleadoState = () => {
    setSelectedEmpleadoId(null);
    empleadoIdRef.current = null;
    nombreColaboradorRef.current = '';
    cedulaColaboradorRef.current = '';
    fechaIngresoRef.current = '';
    setNombreColaborador('');
    setCedulaColaborador('');
    setFechaIngreso('');
    setFirmaEmpleado(null);
    setFirmaEmpleadoHash(null);
    setFirmaEmpleadoWarning(null);
    setFirmaEmpleadoManual(null);
  };

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);

      const currentMarcaStr = await AsyncStorage.getItem('current_marca');
      if (!currentMarcaStr) {
        setHasMarca(false);
        setIsLoading(false);
        return;
      }

      const currentMarca: CurrentMarca = JSON.parse(currentMarcaStr);
      if (!currentMarca || !currentMarca.id || !currentMarca.corpo?.id) {
        setHasMarca(false);
        setIsLoading(false);
        return;
      }

      setHasMarca(true);
      setMarcaId(currentMarca.id);
      setCorpoId(currentMarca.corpo.id);

      const hasConnection = await checkConnection();
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) {
        throw new Error('Server URL not configured');
      }

      if (hasConnection) {
        setIsStructureLoading(true);
        /*
        const structureRes = await authedFetch({
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
        if (structureRes && structureRes.ok) {
          const structureData = await structureRes.json();
          if (structureData.status && Array.isArray(structureData.structure)) {
            setStructure(structureData.structure as MainStructureEmpresa[]);
            await AsyncStorage.setItem('main_structure_cache', JSON.stringify(structureData.structure));
          } else {
            setStructure([]);
          }
        } else {
          
        }
        */
        
        const structureCacheStr = await AsyncStorage.getItem('main_structure_cache');
        if (structureCacheStr) setStructure(JSON.parse(structureCacheStr));
        else setStructure([]);
        setIsStructureLoading(false);

        // Evaluaciones
        const evalRes = await authedFetch({
          url: `${apiUrl}/api/evaluation/corpo/${currentMarca.corpo.id}`,
          init: {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          },
          refreshAccessToken,
          logout,
        });
        if (!evalRes) return;

        if (!evalRes.ok) {
          throw new Error(`HTTP error! status: ${evalRes.status}`);
        }

        const evalData = await evalRes.json();
        if (evalData.status && evalData.evaluaciones) {
          setEvaluaciones(evalData.evaluaciones as StaffEvaluation[]);
          await AsyncStorage.setItem('evaluations_staff_cache', JSON.stringify(evalData.evaluaciones));
        } else {
          setEvaluaciones([]);
        }
      } else {
        // Offline: cargar desde cache
        const evalCacheStr = await AsyncStorage.getItem('evaluations_staff_cache');
        if (evalCacheStr) {
          setEvaluaciones(JSON.parse(evalCacheStr));
        } else {
          setEvaluaciones([]);
        }
        const structureCacheStr = await AsyncStorage.getItem('main_structure_cache');
        if (structureCacheStr) setStructure(JSON.parse(structureCacheStr));
        else setStructure([]);
      }
    } catch (error) {
      console.error('Error fetching staff evaluations:', error);
      try {
        const evalCacheStr = await AsyncStorage.getItem('evaluations_staff_cache');
        if (evalCacheStr) {
          setEvaluaciones(JSON.parse(evalCacheStr));
        }
        const structureCacheStr = await AsyncStorage.getItem('main_structure_cache');
        if (structureCacheStr) setStructure(JSON.parse(structureCacheStr));
      } catch (cacheErr) {
        console.error('Error loading staff evaluations from cache:', cacheErr);
      }
    } finally {
      setIsStructureLoading(false);
      setIsLoading(false);
    }
  }, [refreshAccessToken, logout]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  useEffect(() => {
    const handler = () => {
      fetchData();
    };
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { eventBus } = require('@/hooks/eventBus');
    eventBus.on('connectionRestored', handler);
    return () => {
      eventBus.off('connectionRestored', handler);
    };
  }, [fetchData]);

  useEffect(() => {
    if (isRestoringHierarchyRef.current) return;
    setSelectedClienteId(null);
    setSelectedDivisionId(null);
    setSelectedContratoId(null);
    setSelectedCorpoId(null);
    setSelectedPuestoId(null);
    setSelectedPlazaId(null);
    clearSelectedEmpleadoState();
  }, [selectedEmpresaId]);

  useEffect(() => {
    if (isRestoringHierarchyRef.current) return;
    setSelectedDivisionId(null);
    setSelectedContratoId(null);
    setSelectedCorpoId(null);
    setSelectedPuestoId(null);
    setSelectedPlazaId(null);
    clearSelectedEmpleadoState();
  }, [selectedClienteId]);

  useEffect(() => {
    if (isRestoringHierarchyRef.current) return;
    setSelectedContratoId(null);
    setSelectedCorpoId(null);
    setSelectedPuestoId(null);
    setSelectedPlazaId(null);
    clearSelectedEmpleadoState();
  }, [selectedDivisionId]);

  useEffect(() => {
    if (isRestoringHierarchyRef.current) return;
    setSelectedCorpoId(null);
    setSelectedPuestoId(null);
    setSelectedPlazaId(null);
    clearSelectedEmpleadoState();
  }, [selectedContratoId]);

  useEffect(() => {
    if (isRestoringHierarchyRef.current) return;
    setSelectedPuestoId(null);
    setSelectedPlazaId(null);
    clearSelectedEmpleadoState();
  }, [selectedCorpoId]);

  useEffect(() => {
    if (isRestoringHierarchyRef.current) return;
    setSelectedPlazaId(null);
    clearSelectedEmpleadoState();
  }, [selectedPuestoId]);

  useEffect(() => {
    if (isRestoringHierarchyRef.current) return;
    clearSelectedEmpleadoState();
  }, [selectedPlazaId]);

  // Cambio de tipo de evaluación
  const handleTipoChange = (tipo: EvaluationTipo) => {
    setTipoEvaluacion(tipo);
    tipoEvaluacionRef.current = tipo;
    initializeSectionsForTipo(tipo);
  };

  const startCreating = async () => {
    if (!marcaId || !corpoId) {
      Alert.alert('Error', 'No se encontró la marca actual.');
      return;
    }

    setIsCreating(true);
    setFormKey((prev) => prev + 1);

    const horaAccionUse = await getHoraAccion();

    // Reset refs
    empleadoIdRef.current = null;
    nombreColaboradorRef.current = '';
    cedulaColaboradorRef.current = '';
    fechaIngresoRef.current = '';
    fechaEvaluacionRef.current = dateToLocalString(new Date(horaAccionUse));
    tipoEvaluacionRef.current = 'Seguridad';
    comentariosGeneralesRef.current = '';
    nombreEvaluadorRef.current = employee?.name || '';

    // Reset state (UI)
    setSelectedEmpleadoId(null);
    setNombreColaborador(nombreColaboradorRef.current);
    setCedulaColaborador(cedulaColaboradorRef.current);
    setFechaIngreso(fechaIngresoRef.current);
    setFechaEvaluacion(fechaEvaluacionRef.current);
    setTipoEvaluacion(tipoEvaluacionRef.current);
    setComentariosGenerales(comentariosGeneralesRef.current);
    setNombreEvaluador(nombreEvaluadorRef.current);
    setFirmaEvaluador(null);
    setFirmaEmpleado(null);
    setFirmaEvaluadorHash(null);
    setFirmaEmpleadoHash(null);
    setFirmaEmpleadoManual(null);
    setFirmaEmpleadoWarning(null);
    initializeSectionsForTipo('Seguridad');

    const currentMarcaStr = await AsyncStorage.getItem('current_marca');
    if (currentMarcaStr) {
      try {
        const currentMarca = JSON.parse(currentMarcaStr);
        const resolved = resolveHierarchyByCurrentMarca(structure, currentMarca);
        isRestoringHierarchyRef.current = true;
        if (resolved) {
          setSelectedEmpresaId(resolved.empresaId);
          setSelectedClienteId(resolved.clienteId);
          setSelectedDivisionId(resolved.divisionId);
          setSelectedContratoId(resolved.contratoId);
          setSelectedCorpoId(resolved.corpoId);
          setSelectedPuestoId(resolved.puestoId);
          setSelectedPlazaId(resolved.plazaId);
        } else {
          setSelectedEmpresaId(null);
          setSelectedClienteId(null);
          setSelectedDivisionId(null);
          setSelectedContratoId(null);
          setSelectedCorpoId(currentMarca?.corpo?.id ?? currentMarca?.corpo_id ?? null);
          setSelectedPuestoId(currentMarca?.puesto?.id ?? currentMarca?.puesto_id ?? null);
          setSelectedPlazaId(currentMarca?.plaza?.id ?? currentMarca?.plaza_id ?? null);
        }
        setTimeout(() => {
          isRestoringHierarchyRef.current = false;
        }, 0);
      } catch {
        isRestoringHierarchyRef.current = false;
        setSelectedEmpresaId(null);
        setSelectedClienteId(null);
        setSelectedDivisionId(null);
        setSelectedContratoId(null);
        setSelectedCorpoId(null);
        setSelectedPuestoId(null);
        setSelectedPlazaId(null);
      }
    }

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permiso de ubicación',
          'Se necesita permiso de ubicación para generar la firma del evaluador.'
        );
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setLocation(loc);
    } catch (error) {
      console.error('Error getting location for staff evaluations:', error);
    }
  };

  const cancelCreating = () => {
    setIsCreating(false);
  };

  const onEmpleadoSelected = (id: number | null) => {
    setSelectedEmpleadoId(id);
    empleadoIdRef.current = id;
    if (!id) {
      nombreColaboradorRef.current = '';
      cedulaColaboradorRef.current = '';
      fechaIngresoRef.current = '';
      setNombreColaborador('');
      setCedulaColaborador('');
      setFechaIngreso('');
      setFirmaEmpleadoWarning(null);
      return;
    }

    const emp = empleados.find((e) => e.id === id);
    if (emp) {
      nombreColaboradorRef.current = emp.nombre || '';
      cedulaColaboradorRef.current = emp.cedula || '';
      fechaIngresoRef.current = String(emp.fecha_contratacion || '').split('T')[0];

      setNombreColaborador(nombreColaboradorRef.current);
      setCedulaColaborador(cedulaColaboradorRef.current);
      setFechaIngreso(fechaIngresoRef.current);
    }

    if (firmaEmpleado?.empleadoId && String(firmaEmpleado.empleadoId) !== String(id)) {
      setFirmaEmpleadoWarning(
        `La firma corresponde al empleado ID ${firmaEmpleado.empleadoId}, pero el empleado seleccionado es otro.`
      );
    } else {
      setFirmaEmpleadoWarning(null);
    }
  };

  const generateFirmaEvaluador = async () => {
    if (!employee) {
      Alert.alert('Error', 'No se pudo obtener la información del evaluador');
      return;
    }
    if (!location) {
      Alert.alert('Error', 'No se pudo obtener la ubicación para la firma del evaluador');
      return;
    }

    setIsGeneratingFirmaEval(true);

    try {
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) {
        throw new Error('Server URL not configured');
      }
      const token = await getValidAccessTokenOrLogout({ refreshAccessToken, logout });
      if (!token) return;

      const decodedToken: any = jwtDecode(token);
      const sessionId = decodedToken.sessionId;

      const horaAccion = await getHoraAccion();
      if (!horaAccion) {
        throw new Error('Hora de acción not found');
      }

      const hash = btoa(
        sessionId +
        ':' +
        employee.id +
        ':' +
        location.coords.latitude +
        ':' +
        location.coords.longitude +
        ':' +
        horaAccion
      );

      const decodedHash = atob(hash);
      const [decodedSessionId, decodedEmpleadoId, decodedLatitud, decodedLongitud, decodedTimestamp] =
        decodedHash.split(':');

      let empleadoDetalle: FirmaData['empleadoDetalle'] = undefined;
      const isConnected = await checkConnection();
      if (isConnected) {
        const response = await authedFetch({
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

      setFirmaEvaluador({
        sessionId: decodedSessionId,
        empleadoId: decodedEmpleadoId,
        latitud: decodedLatitud,
        longitud: decodedLongitud,
        timestamp: decodedTimestamp,
        empleadoDetalle,
      });
      setFirmaEvaluadorHash(hash);
    } catch (error) {
      console.error('Error generating evaluator signature:', error);
      Alert.alert('Error', 'No se pudo generar la firma del evaluador');
    } finally {
      setIsGeneratingFirmaEval(false);
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
        let empleadoDetalle: FirmaData['empleadoDetalle'] = undefined;
        const isConnected = await checkConnection();
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
            const empleadoSel = empleados.find((e) => e.id === selectedEmpleadoId);
            setFirmaEmpleadoWarning(
              `La firma corresponde al empleado ID ${empleadoId}, pero el empleado seleccionado es ${empleadoSel?.nombre || 'otro'
              }.`
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
      Alert.alert('Error', 'No se pudo escanear la firma del funcionario');
    }
  };

  const openFirmaEmpleadoManualModal = () => {
    setIsReadingManualSignature(false);
    setSignatureManualKey((k) => k + 1);
    setIsFirmaManualModalVisible(true);
  };

  const closeFirmaEmpleadoManualModal = () => {
    setIsFirmaManualModalVisible(false);
    setIsReadingManualSignature(false);
  };

  const clearManualSignatureInModal = () => {
    try {
      signatureManualRef.current?.clearSignature?.();
    } catch { }
    setIsReadingManualSignature(false);
    setSignatureManualKey((k) => k + 1);
  };

  const acceptManualSignature = () => {
    try {
      setIsReadingManualSignature(true);
      signatureManualRef.current?.readSignature?.();
    } catch {
      setIsReadingManualSignature(false);
      Alert.alert('Error', 'No se pudo leer la firma manual. Intenta nuevamente.');
    }
  };

  const handleManualSignatureRead = (signature: string) => {
    const sig = String(signature || '').trim();
    if (!sig || sig.length < 10) {
      Alert.alert('Error', 'No se detectó la firma. Intenta de nuevo.');
      setIsReadingManualSignature(false);
      return;
    }
    setFirmaEmpleadoManual(sig);
    setIsReadingManualSignature(false);
    closeFirmaEmpleadoManualModal();
  };

  const openAddSignatureModal = (type: 'firma_empleado' | 'firma_empleado_manual', ev: StaffEvaluation) => {
    setAddSignatureEvaluation(ev);
    setAddSignatureType(type);
    setAddSignatureQRValue(null);
    setAddSignatureManualKey((k) => k + 1);
    setAddSignatureModalVisible(true);
  };

  const closeAddSignatureModal = () => {
    setAddSignatureModalVisible(false);
    setAddSignatureEvaluation(null);
    setAddSignatureType(null);
    setAddSignatureQRValue(null);
  };

  const handleAddSignatureScanQR = async () => {
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
        setAddSignatureQRValue(qrData);
      } catch {
        Alert.alert('Error', 'El QR escaneado no es válido');
      }
    } catch (error) {
      console.error('Error scanning QR for add signature:', error);
      Alert.alert('Error', 'No se pudo escanear el código QR');
    }
  };

  const handleAddSignatureConfirmDigital = async () => {
    if (!addSignatureEvaluation || addSignatureType !== 'firma_empleado' || !addSignatureQRValue) {
      Alert.alert('Aviso', 'Escanea un código QR primero.');
      return;
    }
    if (addSignatureEvaluation.id === 0) {
      Alert.alert('Aviso', 'Esta evaluación aún no está sincronizada. No se puede añadir firma.');
      return;
    }
    Alert.alert(
      'Confirmar',
      '¿Guardar esta firma digital en el registro?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aceptar',
          onPress: async () => {
            setIsAddSignatureSubmitting(true);
            try {
              const result = await updateStaffEvaluationSignature({
                evaluationId: addSignatureEvaluation.id,
                field: 'firma_empleado',
                value: addSignatureQRValue,
                refreshAccessToken,
                logout,
              });
              if (result.status) {
                closeAddSignatureModal();
                fetchData();
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
    const ev = addSignatureEvaluation;
    const field = addSignatureType;
    if (!ev || field !== 'firma_empleado_manual' || ev.id === 0) return;
    Alert.alert(
      'Confirmar',
      '¿Guardar esta firma manual en el registro?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aceptar',
          onPress: async () => {
            setIsAddSignatureSubmitting(true);
            try {
              const result = await updateStaffEvaluationSignature({
                evaluationId: ev.id,
                field: 'firma_empleado_manual',
                value: sig,
                refreshAccessToken,
                logout,
              });
              if (result.status) {
                closeAddSignatureModal();
                fetchData();
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

  const updateQuestionField = (
    sectionIndex: number,
    questionIndex: number,
    field: 'title' | 'answear' | 'image' | 'imageOrientation',
    value: string | null
  ) => {
    setEvaluationSections((prev) => {
      const copy = prev.map((s) => ({
        ...s,
        questions: s.questions.map((q) => ({ ...q })),
      }));
      const section = copy[sectionIndex];
      if (!section) return prev;
      const question = section.questions[questionIndex];
      if (!question) return prev;
      (question as any)[field] = value;
      return copy;
    });
  };

  const appendQuestionImage = (
    sectionIndex: number,
    questionIndex: number,
    uri: string,
    orientation?: 'horizontal' | 'vertical'
  ) => {
    setEvaluationSections((prev) => {
      const copy = prev.map((s) => ({
        ...s,
        questions: s.questions.map((q) => ({ ...q })),
      }));
      const section = copy[sectionIndex];
      if (!section) return prev;
      const question = section.questions[questionIndex];
      if (!question) return prev;

      if (!Array.isArray(question.images)) {
        const initial: string[] = [];
        if (question.image) initial.push(question.image);
        question.images = initial;
      }
      question.images!.push(uri);

      // Mantener compatibilidad: la primera imagen también se refleja en `image`
      if (!question.image) {
        question.image = uri;
      }

      if (orientation && !question.imageOrientation) {
        question.imageOrientation = orientation;
      }

      return copy;
    });
  };

  const handleStarPress = (
    sectionIndex: number,
    questionIndex: number,
    value: number
  ) => {
    updateQuestionField(sectionIndex, questionIndex, 'answear', String(value));
  };

  const openCameraForQuestion = async (sectionIndex: number, questionIndex: number) => {
    if (!permission) {
      const perm = await requestPermission();
      if (!perm.granted) {
        Alert.alert('Permiso', 'Se necesita permiso para acceder a la cámara');
        return;
      }
    } else if (!permission.granted) {
      const perm = await requestPermission();
      if (!perm.granted) {
        Alert.alert('Permiso', 'Se necesita permiso para acceder a la cámara');
        return;
      }
    }

    setCurrentQuestionKey(`${sectionIndex}-${questionIndex}`);
    setCameraVisible(true);
  };

  const takePictureForQuestion = async () => {
    if (!cameraRef.current || !currentQuestionKey) {
      setCameraVisible(false);
      return;
    }
    try {
      const photo: any = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.7,
        skipProcessing: false,
      });
      setCameraVisible(false);
      if (!photo || !photo.base64) {
        Alert.alert('Error', 'No se pudo capturar la imagen');
        return;
      }
      const formattedBase64 = `data:image/jpeg;base64,${photo.base64}`;
      const [sectionIndexStr, questionIndexStr] = currentQuestionKey.split('-');
      const sIdx = parseInt(sectionIndexStr, 10);
      const qIdx = parseInt(questionIndexStr, 10);

      let orientation: 'horizontal' | 'vertical' | undefined;
      if (photo.width && photo.height) {
        orientation = photo.width >= photo.height ? 'horizontal' : 'vertical';
      }

      appendQuestionImage(sIdx, qIdx, formattedBase64, orientation);
    } catch (error) {
      console.error('Error capturing question image:', error);
      setCameraVisible(false);
      Alert.alert('Error', 'No se pudo capturar la imagen');
    }
  };

  const validateForm = (): boolean => {
    if (!selectedEmpresaId || !selectedClienteId || !selectedDivisionId || !selectedContratoId || !selectedCorpoId || !selectedPuestoId || !selectedPlazaId) {
      Alert.alert('Error', 'Debes completar la jerarquía hasta Plaza');
      return false;
    }
    if (!selectedEmpleadoId) {
      Alert.alert('Error', 'Debes seleccionar un empleado');
      return false;
    }
    if (!nombreColaboradorRef.current.trim()) {
      Alert.alert('Error', 'El nombre del colaborador es obligatorio');
      return false;
    }
    if (!cedulaColaboradorRef.current.trim()) {
      Alert.alert('Error', 'La cédula del colaborador es obligatoria');
      return false;
    }
    if (!fechaIngresoRef.current) {
      Alert.alert('Error', 'La fecha de ingreso es obligatoria');
      return false;
    }
    if (!fechaEvaluacionRef.current) {
      Alert.alert('Error', 'La fecha de evaluación es obligatoria');
      return false;
    }
    if (!firmaEvaluadorHash || !firmaEvaluador) {
      Alert.alert('Error', 'Debes generar la firma del evaluador');
      return false;
    }
    return true;
  };

  const computeMinimumScoreForOtrosSection = (section: EvaluationSection): number | null => {
    let counted = 0;
    section.questions.forEach((q) => {
      const num = parseFloat(q.answear || '0');
      if (num > 0) counted += 1;
    });
    if (counted === 0) return null;
    return counted * 4;
  };

  const buildEvaluationPayloadSections = (): EvaluationSection[] => {
    if (tipoEvaluacion === 'Otros') {
      return evaluationSections.map((section) => ({
        ...section,
        minimum_score: computeMinimumScoreForOtrosSection(section),
      }));
    }
    return evaluationSections;
  };

  const resetAllFilters = () => {
    setFilterColaboradorNombre('');
    setFilterColaboradorCedula('');
    setFilterEvaluadorNombre('');
    setFilterEvaluadorCedula('');
    setFilterTipo('all');
    setFilterFechaEvaluacion('');
  };

  const handleCreateEvaluation = async () => {
    if (!marcaId || !employee) {
      Alert.alert('Error', 'No se encontró información necesaria de la marca o del evaluador');
      return;
    }
    if (!validateForm()) return;

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas crear esta evaluación de personal?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const sectionsForPayload = buildEvaluationPayloadSections();

              const requestBody = {
                marca_id: marcaId,
                corpo_id: selectedCorpoId,
                puesto_id: selectedPuestoId,
                plaza_id: selectedPlazaId,
                nombre_colaborador: nombreColaboradorRef.current,
                cedula_colaborador: cedulaColaboradorRef.current,
                empleado_id: empleadoIdRef.current,
                evaluador_id: employee.id,
                fecha_ingreso: fechaIngresoRef.current,
                fecha_evaluacion: fechaEvaluacionRef.current,
                tipo: tipoEvaluacionRef.current,
                evaluacion: JSON.stringify(sectionsForPayload),
                comentarios: comentariosGeneralesRef.current.trim() || '-',
                firma_evaluador: firmaEvaluadorHash!,
                firma_empleado: firmaEmpleadoHash ?? null,
                firma_empleado_manual: firmaEmpleadoManual || null,
              };

              const hasConnection = await checkConnection();

              if (hasConnection) {
                const result = await createStaffEvaluation({
                  requestData: requestBody,
                  refreshAccessToken,
                  logout,
                });
                if (result.status) {
                  Alert.alert('Éxito', result.message || 'Evaluación creada correctamente');
                  setIsCreating(false);
                  fetchData();
                } else {
                  Alert.alert('Error', result.message || 'No se pudo crear la evaluación');
                }
              } else {
                const localId = Math.random().toString(36).substring(2, 12);
                const actionsStr = await AsyncStorage.getItem('evaluations_staff_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: localId,
                  type: 'create',
                  requestData: requestBody,
                });
                await AsyncStorage.setItem('evaluations_staff_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_staff_cache');
                const cache = cacheStr ? JSON.parse(cacheStr) : [];

                const evaluacionCache: StaffEvaluation = {
                  id: 0,
                  empleado: {
                    id: empleadoIdRef.current!,
                    nombre: nombreColaboradorRef.current,
                    cedula: cedulaColaboradorRef.current,
                  },
                  evaluador: {
                    id: Number(employee.id),
                    nombre: nombreEvaluadorRef.current || employee.name || '',
                    cedula: (employee as any).cedula || '',
                  },
                  fecha_ingreso: fechaIngresoRef.current,
                  fecha_evaluacion: fechaEvaluacionRef.current,
                  evaluacion: sectionsForPayload,
                  comentarios: comentariosGeneralesRef.current.trim() || '-',
                  tipo: tipoEvaluacionRef.current,
                  firma_evaluador: firmaEvaluadorHash!,
                  firma_empleado: firmaEmpleadoHash ?? null,
                  firma_empleado_manual: firmaEmpleadoManual || null,
                  id_local: localId,
                };

                cache.push(evaluacionCache);
                await AsyncStorage.setItem('evaluations_staff_cache', JSON.stringify(cache));

                Alert.alert(
                  'Modo offline',
                  'Evaluación registrada localmente. Se sincronizará cuando haya conexión.'
                );
                setIsCreating(false);
                setEvaluaciones(cache);
              }
            } catch (error) {
              console.error('Error creating staff evaluation:', error);
              Alert.alert('Error', 'No se pudo crear la evaluación');
            }
          },
        },
      ]
    );
  };

  const confirmDeleteEvaluation = async (ev: StaffEvaluation) => {
    try {
      // Evaluaciones solo locales (sin ID de servidor)
      if (!ev.id || ev.id === 0 || ev.id_local) {
        const localId = ev.id_local;

        setEvaluaciones((prev) =>
          prev.filter((item) =>
            localId ? item.id_local !== localId : item.id !== ev.id
          )
        );

        const cacheStr = await AsyncStorage.getItem('evaluations_staff_cache');
        if (cacheStr) {
          const cache: StaffEvaluation[] = JSON.parse(cacheStr);
          const filtered = cache.filter((item) =>
            localId ? item.id_local !== localId : item.id !== ev.id
          );
          await AsyncStorage.setItem('evaluations_staff_cache', JSON.stringify(filtered));
        }

        const actionsStr = await AsyncStorage.getItem('evaluations_staff_actions');
        if (actionsStr && localId) {
          const actions = JSON.parse(actionsStr);
          const filteredActions = actions.filter((a: any) => a.id !== localId);
          await AsyncStorage.setItem('evaluations_staff_actions', JSON.stringify(filteredActions));
        }

        Alert.alert('Éxito', 'Evaluación eliminada localmente.');
        return;
      }

      const hasConnection = await checkConnection();

      if (!hasConnection) {
        // Modo offline: encolar acción y actualizar cache
        const actionsStr = await AsyncStorage.getItem('evaluations_staff_actions');
        const actions = actionsStr ? JSON.parse(actionsStr) : [];

        // Agregar acción de delete para este id de evaluación
        actions.push({
          id: ev.id,
          type: 'delete',
        });
        await AsyncStorage.setItem('evaluations_staff_actions', JSON.stringify(actions));

        // Eliminar de cache local
        const cacheStr = await AsyncStorage.getItem('evaluations_staff_cache');
        const cache = cacheStr ? JSON.parse(cacheStr) : [];
        const filteredCache = cache.filter((item: StaffEvaluation) => item.id !== ev.id);
        await AsyncStorage.setItem('evaluations_staff_cache', JSON.stringify(filteredCache));

        // Eliminar de estado actual
        setEvaluaciones(filteredCache);

        Alert.alert(
          'Modo offline',
          'Evaluación eliminada localmente. Se sincronizará cuando haya conexión.'
        );
        return;
      }

      const result = await deleteStaffEvaluation({
        id: ev.id,
        refreshAccessToken,
        logout,
      });

      if (!result.status) {
        Alert.alert('Error', result.message || 'No se pudo eliminar la evaluación');
        return;
      }

      setEvaluaciones((prev) => prev.filter((item) => item.id !== ev.id));

      const cacheStr = await AsyncStorage.getItem('evaluations_staff_cache');
      if (cacheStr) {
        const cache: StaffEvaluation[] = JSON.parse(cacheStr);
        const filtered = cache.filter((item) => item.id !== ev.id);
        await AsyncStorage.setItem('evaluations_staff_cache', JSON.stringify(filtered));
      }

      Alert.alert('Éxito', result.message || 'Evaluación eliminada correctamente');
    } catch (error) {
      console.error('Error deleting evaluation:', error);
      Alert.alert('Error', 'Ocurrió un error al eliminar la evaluación');
    }
  };

  const handleDeleteEvaluation = (ev: StaffEvaluation) => {
    Alert.alert(
      'Eliminar evaluación',
      '¿Estás seguro de que deseas eliminar esta evaluación? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => confirmDeleteEvaluation(ev),
        },
      ]
    );
  };

  const filteredEvaluations = evaluaciones.filter((ev) => {
    const matchesColaboradorNombre =
      !filterColaboradorNombre ||
      ev.empleado.nombre.toLowerCase().includes(filterColaboradorNombre.toLowerCase());

    const matchesColaboradorCedula =
      !filterColaboradorCedula ||
      ev.empleado.cedula.toLowerCase().includes(filterColaboradorCedula.toLowerCase());

    const matchesEvaluadorNombre =
      !filterEvaluadorNombre ||
      ev.evaluador.nombre.toLowerCase().includes(filterEvaluadorNombre.toLowerCase());

    const matchesEvaluadorCedula =
      !filterEvaluadorCedula ||
      ev.evaluador.cedula.toLowerCase().includes(filterEvaluadorCedula.toLowerCase());

    const matchesTipo =
      filterTipo === 'all' ||
      (ev.tipo || '').toLowerCase().includes(filterTipo.toLowerCase());

    const matchesFecha =
      !filterFechaEvaluacion ||
      (ev.fecha_evaluacion && ev.fecha_evaluacion.split('T')[0] === filterFechaEvaluacion);

    return (
      matchesColaboradorNombre &&
      matchesColaboradorCedula &&
      matchesEvaluadorNombre &&
      matchesEvaluadorCedula &&
      matchesTipo &&
      matchesFecha
    );
  });

  const toggleEvaluationExpanded = (key: string) => {
    setExpandedEvaluations((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleFirmasExpanded = (key: string) => {
    setExpandedFirmas((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const parseEvaluacionField = (ev: StaffEvaluation): EvaluationSection[] => {
    let sections: EvaluationSection[] = [];

    if (Array.isArray(ev.evaluacion)) {
      sections = ev.evaluacion as EvaluationSection[];
    } else if (typeof ev.evaluacion === 'string' && ev.evaluacion.trim() !== '') {
      try {
        const parsed = JSON.parse(ev.evaluacion);
        if (Array.isArray(parsed)) {
          sections = parsed as EvaluationSection[];
        }
      } catch (e) {
        console.error('Error parsing evaluacion JSON:', e);
      }
    }

    // Establecer editableTitle correctamente: solo "Objetivos generales 50%" tiene preguntas editables
    return sections.map((section) => ({
      ...section,
      questions: section.questions.map((q) => ({
        ...q,
        editableTitle: section.title === 'Objetivos generales 50%',
      })),
    }));
  };

  const decodeSignature = (hash: string): FirmaData | null => {
    try {
      const decoded = atob(hash);
      const parts = decoded.split(':');
      if (parts.length !== 5) return null;
      const [sessionId, empleadoId, latitud, longitud, timestamp] = parts;
      return {
        sessionId,
        empleadoId,
        latitud,
        longitud,
        timestamp,
      };
    } catch (e) {
      console.error('Error decoding signature:', e);
      return null;
    }
  };

  const getQuestionImages = (q: EvaluationQuestion): string[] => {
    if (Array.isArray(q.images) && q.images.length > 0) return q.images;
    if (q.image) return [q.image];
    return [];
  };

  const renderCreateForm = () => {
    if (!isCreating) return null;

    return (
      <ThemedView style={styles.formCard}>
        <ThemedText style={styles.formTitle}>Nueva Evaluación de personal</ThemedText>

        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Estructura *</ThemedText>
          {isStructureLoading && (
            <ThemedView style={styles.inlineLoading}>
              <ActivityIndicator size="small" color="#007AFF" />
              <ThemedText style={styles.inlineLoadingText}>Cargando estructura...</ThemedText>
            </ThemedView>
          )}

          <ThemedText style={styles.formLabel}>Empresa</ThemedText>
          <ThemedView style={styles.pickerContainer}>
            <Picker
              selectedValue={selectedEmpresaId ?? 0}
              onValueChange={(value) => setSelectedEmpresaId(value ? Number(value) : null)}
              style={styles.picker}
            >
              <Picker.Item label="Seleccionar empresa..." value={0} color="#000000" />
              {structure.map((empresa) => (
                <Picker.Item key={empresa.id} label={empresa.nombre} value={empresa.id} color="#000000" />
              ))}
            </Picker>
          </ThemedView>

          <ThemedText style={styles.formLabel}>Cliente</ThemedText>
          <ThemedView style={styles.pickerContainer}>
            <Picker
              enabled={selectedEmpresaId !== null}
              selectedValue={selectedClienteId ?? 0}
              onValueChange={(value) => setSelectedClienteId(value ? Number(value) : null)}
              style={styles.picker}
            >
              <Picker.Item label="Seleccionar cliente..." value={0} color="#000000" />
              {clienteNodes.map((cliente) => (
                <Picker.Item key={cliente.id} label={cliente.nombre} value={cliente.id} color="#000000" />
              ))}
            </Picker>
          </ThemedView>

          <ThemedText style={styles.formLabel}>División</ThemedText>
          <ThemedView style={styles.pickerContainer}>
            <Picker
              enabled={selectedClienteId !== null}
              selectedValue={selectedDivisionId ?? 0}
              onValueChange={(value) => setSelectedDivisionId(value ? Number(value) : null)}
              style={styles.picker}
            >
              <Picker.Item label="Seleccionar división..." value={0} color="#000000" />
              {divisionNodes.map((division) => (
                <Picker.Item key={division.id} label={division.nombre} value={division.id} color="#000000" />
              ))}
            </Picker>
          </ThemedView>

          <ThemedText style={styles.formLabel}>Contrato</ThemedText>
          <ThemedView style={styles.pickerContainer}>
            <Picker
              enabled={selectedDivisionId !== null}
              selectedValue={selectedContratoId ?? 0}
              onValueChange={(value) => setSelectedContratoId(value ? Number(value) : null)}
              style={styles.picker}
            >
              <Picker.Item label="Seleccionar contrato..." value={0} color="#000000" />
              {contratoNodes.map((contrato) => (
                <Picker.Item key={contrato.id} label={contrato.nombre} value={contrato.id} color="#000000" />
              ))}
            </Picker>
          </ThemedView>

          <ThemedText style={styles.formLabel}>Sucursal (Corpo)</ThemedText>
          <ThemedView style={styles.pickerContainer}>
            <Picker
              enabled={selectedContratoId !== null}
              selectedValue={selectedCorpoId ?? 0}
              onValueChange={(value) => setSelectedCorpoId(value ? Number(value) : null)}
              style={styles.picker}
            >
              <Picker.Item label="Seleccionar sucursal..." value={0} color="#000000" />
              {sucursalNodes.map((sucursal) => (
                <Picker.Item key={sucursal.id} label={sucursal.nombre} value={sucursal.id} color="#000000" />
              ))}
            </Picker>
          </ThemedView>

          <ThemedText style={styles.formLabel}>Puesto</ThemedText>
          <ThemedView style={styles.pickerContainer}>
            <Picker
              enabled={selectedCorpoId !== null}
              selectedValue={selectedPuestoId ?? 0}
              onValueChange={(value) => setSelectedPuestoId(value ? Number(value) : null)}
              style={styles.picker}
            >
              <Picker.Item label="Seleccionar puesto..." value={0} color="#000000" />
              {puestoNodes.map((puesto) => (
                <Picker.Item key={puesto.id} label={puesto.nombre} value={puesto.id} color="#000000" />
              ))}
            </Picker>
          </ThemedView>

          <ThemedText style={styles.formLabel}>Plaza</ThemedText>
          <ThemedView style={styles.pickerContainer}>
            <Picker
              enabled={selectedPuestoId !== null}
              selectedValue={selectedPlazaId ?? 0}
              onValueChange={(value) => setSelectedPlazaId(value ? Number(value) : null)}
              style={styles.picker}
            >
              <Picker.Item label="Seleccionar plaza..." value={0} color="#000000" />
              {plazaNodes.map((plaza) => (
                <Picker.Item key={plaza.id} label={plaza.nombre} value={plaza.id} color="#000000" />
              ))}
            </Picker>
          </ThemedView>
        </ThemedView>

        {/* Empleado de la plaza */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Empleado *</ThemedText>
          <ThemedView style={styles.pickerContainer}>
            <Picker
              enabled={selectedPlazaId !== null}
              selectedValue={selectedEmpleadoId ?? 0}
              onValueChange={(value) => onEmpleadoSelected(value ? Number(value) : null)}
              style={styles.picker}
              itemStyle={styles.pickerItem}
            >
              <Picker.Item label={selectedPlazaId ? 'Seleccionar empleado...' : 'Seleccione plaza primero'} value={0} color="#000000" />
              {empleados.map((emp) => (
                <Picker.Item key={emp.id} label={`${emp.nombre} - ${emp.cedula}`} value={emp.id} color="#000000" />
              ))}
            </Picker>
          </ThemedView>
        </ThemedView>

        {/* Nombre colaborador */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Nombre del colaborador *</ThemedText>
          <TextInput
            style={styles.formInput}
            value={nombreColaborador}
            onChangeText={(text) => {
              nombreColaboradorRef.current = text;
              setNombreColaborador(text);
            }}
            placeholder="Nombre del colaborador"
            placeholderTextColor="#999"
          />
        </ThemedView>

        {/* Cédula colaborador */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Cédula del colaborador *</ThemedText>
          <TextInput
            style={styles.formInput}
            value={cedulaColaborador}
            onChangeText={(text) => {
              cedulaColaboradorRef.current = text;
              setCedulaColaborador(text);
            }}
            placeholder="Cédula del colaborador"
            placeholderTextColor="#999"
          />
        </ThemedView>

        {/* Fecha ingreso */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Fecha de ingreso *</ThemedText>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowFechaIngresoPicker(true)}
          >
            <ThemedText style={styles.dateButtonText}>
              {fechaIngreso ? formatDateDMY(fechaIngreso) : 'Seleccionar fecha'}
            </ThemedText>
            <Ionicons name="calendar-outline" size={20} color="#007AFF" />
          </TouchableOpacity>
        </ThemedView>

        {/* Fecha evaluación */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Fecha de evaluación *</ThemedText>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowFechaEvaluacionPicker(true)}
          >
            <ThemedText style={styles.dateButtonText}>
              {fechaEvaluacion ? formatDateDMY(fechaEvaluacion) : 'Seleccionar fecha'}
            </ThemedText>
            <Ionicons name="calendar-outline" size={20} color="#007AFF" />
          </TouchableOpacity>
        </ThemedView>

        {/* Tipo */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Tipo de evaluación *</ThemedText>
          <ThemedView style={styles.pickerContainer}>
            <Picker
              selectedValue={tipoEvaluacion}
              onValueChange={(value) => handleTipoChange(value as EvaluationTipo)}
              style={styles.picker}
              itemStyle={styles.pickerItem}
            >
              <Picker.Item
                label="Seleccionar tipo..."
                value=""
                enabled={false}
              />
              <Picker.Item
                label="Seguridad"
                value="Seguridad"
                color={tipoEvaluacion === 'Seguridad' ? "#007AFF" : "#000000"}
              />
              <Picker.Item
                label="Aseo & limpieza"
                value="Aseo & limpieza"
                color={tipoEvaluacion === 'Aseo & limpieza' ? "#007AFF" : "#000000"}
              />
              <Picker.Item
                label="Otros"
                value="Otros"
                color={tipoEvaluacion === 'Otros' ? "#007AFF" : "#000000"}
              />
            </Picker>
          </ThemedView>
        </ThemedView>

        {/* Evaluación dinámica */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Evaluación</ThemedText>
          {evaluationSections.map((section, sIndex) => (
            <ThemedView key={sIndex} style={styles.sectionCard}>
              <ThemedText style={styles.sectionTitle}>{section.title}</ThemedText>
              {section.questions.map((q, qIndex) => (
                <ThemedView key={qIndex} style={styles.questionCard}>
                  {q.editableTitle ? (
                    <TextInput
                      style={styles.questionTitleInput}
                      value={q.title}
                      onChangeText={(text) =>
                        updateQuestionField(sIndex, qIndex, 'title', text)
                      }
                      placeholder="Título de la pregunta"
                      placeholderTextColor="#999"
                    />
                  ) : (
                    <ThemedText style={styles.questionTitleList}>
                      {q.title || 'Sin título'}
                    </ThemedText>
                  )}

                  {(tipoEvaluacion === 'Seguridad' ||
                    tipoEvaluacion === 'Aseo & limpieza') ? (
                    <ThemedView style={styles.starsRow}>
                      {Array.from({ length: 10 }).map((_, i) => {
                        const starValue = i + 1;
                        const current =
                          parseInt(q.answear || '0', 10) > 0
                            ? parseInt(q.answear || '0', 10)
                            : 0;
                        const filled = starValue <= current;
                        return (
                          <TouchableOpacity
                            key={starValue}
                            onPress={() =>
                              handleStarPress(sIndex, qIndex, starValue)
                            }
                          >
                            <Ionicons
                              name={filled ? 'star' : 'star-outline'}
                              size={20}
                              color={filled ? '#FFD700' : '#C7C7CC'}
                              style={styles.starIcon}
                            />
                          </TouchableOpacity>
                        );
                      })}
                    </ThemedView>
                  ) : tipoEvaluacion === 'Otros' &&
                    (section.title.startsWith('Retroalimentación') ||
                      section.title === 'Comentarios') ? (
                    <TextInput
                      style={[styles.formInput, styles.textArea]}
                      value={q.answear}
                      onChangeText={(text) =>
                        updateQuestionField(sIndex, qIndex, 'answear', text)
                      }
                      placeholder="Respuesta"
                      placeholderTextColor="#999"
                      multiline
                    />
                  ) : tipoEvaluacion === 'Otros' ? (
                    <ThemedView style={styles.pickerContainer}>
                      <Picker
                        selectedValue={q.answear !== '' ? q.answear : ''}
                        onValueChange={(value) =>
                          updateQuestionField(sIndex, qIndex, 'answear', value as string)
                        }
                        style={styles.picker}
                      >
                        <Picker.Item label="Seleccionar opción..." value="" color="#000000" />
                        <Picker.Item label="No aplica" value="0" color="#000000" />
                        <Picker.Item label="No cumple" value="1" color="#000000" />
                        <Picker.Item label="Requiere mejorar" value="2" color="#000000" />
                        <Picker.Item label="Cumple" value="3" color="#000000" />
                        <Picker.Item label="Supera estándar" value="4" color="#000000" />
                      </Picker>
                    </ThemedView>
                  ) : (
                    <TextInput
                      style={styles.formInput}
                      value={q.answear}
                      onChangeText={(text) =>
                        updateQuestionField(sIndex, qIndex, 'answear', text)
                      }
                      placeholder="Puntaje / respuesta"
                      placeholderTextColor="#999"
                      keyboardType="numeric"
                    />
                  )}

                  {/* Imágenes solo cuando no es sección de Retroalimentación ni Comentarios en tipo "Otros" */}
                  {!(
                    tipoEvaluacion === 'Otros' &&
                    (section.title.startsWith('Retroalimentación') ||
                      section.title === 'Comentarios')
                  ) && (
                      <>
                        <TouchableOpacity
                          style={styles.cameraSmallButton}
                          onPress={() => openCameraForQuestion(sIndex, qIndex)}
                        >
                          {getActionIcon('camera')}
                          <ThemedText style={styles.cameraSmallButtonText}>
                            {getQuestionImages(q).length > 0
                              ? 'Agregar otra imagen'
                              : 'Tomar imagen (opcional)'}
                          </ThemedText>
                        </TouchableOpacity>
                        {getQuestionImages(q).length > 0 &&
                          getQuestionImages(q).map((uri, idx) => (
                            <Image
                              key={idx}
                              source={{ uri }}
                              style={[
                                styles.questionImagePreview,
                                q.imageOrientation === 'vertical'
                                  ? styles.questionImagePreviewVertical
                                  : styles.questionImagePreviewHorizontal,
                              ]}
                              resizeMode="contain"
                            />
                          ))}
                      </>
                    )}
                </ThemedView>
              ))}
            </ThemedView>
          ))}
        </ThemedView>

        {/* Comentarios generales */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Comentarios generales</ThemedText>
          <TextInput
            style={[styles.formInput, styles.textArea]}
            value={comentariosGenerales}
            onChangeText={(text) => {
              comentariosGeneralesRef.current = text;
              setComentariosGenerales(text);
            }}
            placeholder="Comentarios generales"
            placeholderTextColor="#999"
            multiline
          />
        </ThemedView>

        {/* Nombre evaluador */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Nombre del evaluador</ThemedText>
          <TextInput
            style={styles.formInput}
            value={nombreEvaluador}
            onChangeText={(text) => {
              nombreEvaluadorRef.current = text;
              setNombreEvaluador(text);
            }}
            placeholder="Nombre del evaluador"
            placeholderTextColor="#999"
          />
        </ThemedView>

        {/* Firma del evaluador */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Firma del evaluador *</ThemedText>
          {!firmaEvaluador ? (
            <TouchableOpacity
              style={styles.signatureButtonPrimary}
              onPress={generateFirmaEvaluador}
              disabled={isGeneratingFirmaEval}
            >
              {isGeneratingFirmaEval ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  {getActionIcon('signature')}
                  <ThemedText style={styles.signatureButtonText}>Generar firma</ThemedText>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <ThemedView style={styles.signatureInfo}>
              <ThemedText style={styles.signatureInfoTitle}>
                Información de la firma del evaluador
              </ThemedText>
              <ThemedText style={styles.signatureInfoText}>
                ID de sesión: {firmaEvaluador.sessionId}
              </ThemedText>
              <ThemedText style={styles.signatureInfoText}>
                ID del empleado: {firmaEvaluador.empleadoId}
              </ThemedText>
              {firmaEvaluador.empleadoDetalle && (
                <ThemedView style={styles.signatureInfoDetail}>
                  <ThemedText style={styles.signatureInfoDetailText}>
                    {firmaEvaluador.empleadoDetalle.nombre}{' '}
                    {firmaEvaluador.empleadoDetalle.primer_apellido}{' '}
                    {firmaEvaluador.empleadoDetalle.segundo_apellido} (
                    {firmaEvaluador.empleadoDetalle.cedula_empleado})
                  </ThemedText>
                </ThemedView>
              )}
              <ThemedText style={styles.signatureInfoText}>
                Latitud: {firmaEvaluador.latitud}
              </ThemedText>
              <ThemedText style={styles.signatureInfoText}>
                Longitud: {firmaEvaluador.longitud}
              </ThemedText>
              <ThemedText style={styles.signatureInfoText}>
                Fecha y hora: {formatDateLabel(firmaEvaluador.timestamp)}
              </ThemedText>
            </ThemedView>
          )}
        </ThemedView>

        {/* Firma del funcionario */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Firma del funcionario (Opcional)</ThemedText>
          {!firmaEmpleado ? (
            <TouchableOpacity
              style={styles.signatureButtonPrimary}
              onPress={handleScanFirmaEmpleado}
            >
              {getActionIcon('qr')}
              <ThemedText style={styles.signatureButtonText}>Escanear QR</ThemedText>
            </TouchableOpacity>
          ) : (
            <ThemedView style={styles.signatureInfo}>
              <ThemedText style={styles.signatureInfoTitle}>
                Información de la firma del funcionario
              </ThemedText>
              <ThemedText style={styles.signatureInfoText}>
                ID de sesión: {firmaEmpleado.sessionId}
              </ThemedText>
              <ThemedText style={styles.signatureInfoText}>
                ID del empleado: {firmaEmpleado.empleadoId}
              </ThemedText>
              {firmaEmpleado.empleadoDetalle && (
                <ThemedView style={styles.signatureInfoDetail}>
                  <ThemedText style={styles.signatureInfoDetailText}>
                    {firmaEmpleado.empleadoDetalle.nombre}{' '}
                    {firmaEmpleado.empleadoDetalle.primer_apellido}{' '}
                    {firmaEmpleado.empleadoDetalle.segundo_apellido} (
                    {firmaEmpleado.empleadoDetalle.cedula_empleado})
                  </ThemedText>
                </ThemedView>
              )}
              <ThemedText style={styles.signatureInfoText}>
                Latitud: {firmaEmpleado.latitud}
              </ThemedText>
              <ThemedText style={styles.signatureInfoText}>
                Longitud: {firmaEmpleado.longitud}
              </ThemedText>
              <ThemedText style={styles.signatureInfoText}>
                Fecha y hora: {formatDateLabel(firmaEmpleado.timestamp)}
              </ThemedText>
            </ThemedView>
          )}
          {firmaEmpleadoWarning && (
            <ThemedText style={styles.warningText}>{firmaEmpleadoWarning}</ThemedText>
          )}

          <ThemedText style={[styles.formLabel, { marginTop: 10 }]}>Firma manual del funcionario (Opcional)</ThemedText>
          {firmaEmpleadoManual ? (
            <ThemedView style={styles.signaturePreviewContainer}>
              <Image source={{ uri: firmaEmpleadoManual }} style={styles.signaturePreview} resizeMode="contain" />
              <TouchableOpacity style={styles.removeSignatureButton} onPress={() => setFirmaEmpleadoManual(null)}>
                <Ionicons name="trash" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </ThemedView>
          ) : null}
          <TouchableOpacity style={styles.openSignatureButton} onPress={openFirmaEmpleadoManualModal}>
            <Ionicons name="create-outline" size={20} color="#000000" />
            <ThemedText style={styles.openSignatureButtonText}>
              {firmaEmpleadoManual ? 'Modificar firma manual' : 'Dibujar firma manual'}
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>

        {/* Acciones */}
        <ThemedView style={styles.formActions}>
          <TouchableOpacity
            style={[styles.formButton, styles.cancelButton]}
            onPress={cancelCreating}
          >
            <ThemedText style={styles.formButtonText}>{getActionIcon('cancel')}</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.formButton, styles.confirmButton]}
            onPress={handleCreateEvaluation}
          >
            <ThemedText style={styles.formButtonText}>{getActionIcon('confirm')}</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </ThemedView>
    );
  };

  const renderEvaluationItem = (ev: StaffEvaluation, index: number) => {
    const key = ev.id !== 0 ? `eval-${ev.id}` : ev.id_local ? `eval-${ev.id_local}` : `eval-${index}`;
    const isExpanded = expandedEvaluations.has(key);
    const firmasExpanded = expandedFirmas.has(key);
    const sections = parseEvaluacionField(ev);
    const evalSig = decodeSignature(ev.firma_evaluador);
    const empSig = ev.firma_empleado ? decodeSignature(ev.firma_empleado) : null;

    return (
      <ThemedView key={key} style={styles.evaluationCard}>
        <ThemedText style={styles.evalTitle}>{ev.empleado.nombre}</ThemedText>
        <ThemedText style={styles.evalLine}>
          <ThemedText style={styles.evalLabel}>Cédula colaborador: </ThemedText>
          <ThemedText style={styles.evalValue}>{ev.empleado.cedula}</ThemedText>
        </ThemedText>
        <ThemedText style={styles.evalLine}>
          <ThemedText style={styles.evalLabel}>Evaluador: </ThemedText>
          <ThemedText style={styles.evalValue}>{ev.evaluador.nombre}</ThemedText>
        </ThemedText>
        <ThemedText style={styles.evalLine}>
          <ThemedText style={styles.evalLabel}>Cédula evaluador: </ThemedText>
          <ThemedText style={styles.evalValue}>{ev.evaluador.cedula}</ThemedText>
        </ThemedText>
        <ThemedText style={styles.evalLine}>
          <ThemedText style={styles.evalLabel}>Tipo: </ThemedText>
          <ThemedText style={styles.evalValue}>{ev.tipo}</ThemedText>
        </ThemedText>
        <ThemedText style={styles.evalLine}>
          <ThemedText style={styles.evalLabel}>Fecha ingreso: </ThemedText>
          <ThemedText style={styles.evalValue}>{formatDateDMY(ev.fecha_ingreso)}</ThemedText>
        </ThemedText>
        <ThemedText style={styles.evalLine}>
          <ThemedText style={styles.evalLabel}>Fecha evaluación: </ThemedText>
          <ThemedText style={styles.evalValue}>{formatDateDMY(ev.fecha_evaluacion)}</ThemedText>
        </ThemedText>

        {/* Evaluación detallada */}
        <TouchableOpacity
          style={styles.collapseButton}
          onPress={() => toggleEvaluationExpanded(key)}
        >
          <ThemedText style={styles.collapseButtonText}>
            {isExpanded ? 'Ocultar evaluación detallada' : 'Ver evaluación detallada'}
          </ThemedText>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color="#007AFF"
          />
        </TouchableOpacity>

        {isExpanded && (
          <ThemedView style={styles.collapsableContent}>
            {sections.length === 0 ? (
              <ThemedText style={styles.emptyText}>No hay detalles de evaluación</ThemedText>
            ) : (
              sections.map((section, sIndex) => (
                <ThemedView key={sIndex} style={styles.sectionCardList}>
                  <ThemedText style={styles.sectionTitle}>{section.title}</ThemedText>
                  {section.minimum_score != null && (
                    <ThemedText style={styles.evalLine}>
                      <ThemedText style={styles.evalLabel}>Puntaje mínimo: </ThemedText>
                      <ThemedText style={styles.evalValue}>
                        {section.minimum_score ?? '-'}
                      </ThemedText>
                    </ThemedText>
                  )}
                  {section.questions.map((q, qIndex) => (
                    <ThemedView key={qIndex} style={styles.questionRow}>
                      <ThemedText style={styles.questionTitleList}>{q.title}</ThemedText>
                      <ThemedText style={styles.evalLine}>
                        <ThemedText style={styles.evalLabel}>Respuesta: </ThemedText>
                        <ThemedText style={styles.evalValue}>{q.answear}</ThemedText>
                      </ThemedText>
                      {getQuestionImages(q).length > 0 &&
                        getQuestionImages(q).map((img, idx) => (
                          <Image
                            key={idx}
                            source={{
                              uri:
                                ev.id_local === '' && !img.startsWith('data:')
                                  ? appendTokenToUrl(
                                    `${Constants.expoConfig?.extra?.API_SERVER}/api/evaluation/${ev.id}/get-image/${img}`
                                  )
                                  : img,
                            }}
                            style={[
                              styles.questionImagePreviewList,
                              q.imageOrientation === 'vertical'
                                ? styles.questionImagePreviewListVertical
                                : styles.questionImagePreviewListHorizontal,
                            ]}
                            resizeMode="contain"
                          />
                        ))}
                    </ThemedView>
                  ))}
                </ThemedView>
              ))
            )}
            <ThemedText style={styles.evalLine}>
              <ThemedText style={styles.evalLabel}>Comentarios: </ThemedText>
              <ThemedText style={styles.evalValue}>{ev.comentarios}</ThemedText>
            </ThemedText>
          </ThemedView>
        )}

        {/* Firmas */}
        <TouchableOpacity
          style={styles.collapseButton}
          onPress={() => toggleFirmasExpanded(key)}
        >
          <ThemedText style={styles.collapseButtonText}>
            {firmasExpanded ? 'Ocultar firmas' : 'Ver firmas'}
          </ThemedText>
          <Ionicons
            name={firmasExpanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color="#007AFF"
          />
        </TouchableOpacity>

        {firmasExpanded && (
          <ThemedView style={styles.collapsableContent}>
            <ThemedText style={styles.signatureInfoTitle}>Firma del evaluador</ThemedText>
            {evalSig ? (
              <>
                <ThemedText style={styles.signatureInfoText}>
                  ID de sesión: {evalSig.sessionId}
                </ThemedText>
                <ThemedText style={styles.signatureInfoText}>
                  ID del empleado: {evalSig.empleadoId}
                </ThemedText>
                <ThemedText style={styles.signatureInfoText}>
                  Latitud: {evalSig.latitud}
                </ThemedText>
                <ThemedText style={styles.signatureInfoText}>
                  Longitud: {evalSig.longitud}
                </ThemedText>
              </>
            ) : (
              <ThemedText style={styles.emptyText}>No se pudo interpretar la firma</ThemedText>
            )}

            <ThemedText style={[styles.signatureInfoTitle, { marginTop: 12 }]}>
              Firma del funcionario
            </ThemedText>
            {ev.firma_empleado ? (
              empSig ? (
                <>
                  <ThemedText style={styles.signatureInfoText}>
                    ID de sesión: {empSig.sessionId}
                  </ThemedText>
                  <ThemedText style={styles.signatureInfoText}>
                    ID del empleado: {empSig.empleadoId}
                  </ThemedText>
                  <ThemedText style={styles.signatureInfoText}>
                    Latitud: {empSig.latitud}
                  </ThemedText>
                  <ThemedText style={styles.signatureInfoText}>
                    Longitud: {empSig.longitud}
                  </ThemedText>
                </>
              ) : (
                <ThemedText style={styles.emptyText}>No se pudo interpretar la firma</ThemedText>
              )
            ) : (
              <>
                <ThemedText style={styles.emptyText}>No hay firma del funcionario registrada</ThemedText>
                {ev.id > 0 && (
                  <TouchableOpacity
                    style={[styles.signatureButtonPrimary, { marginTop: 8 }]}
                    onPress={() => openAddSignatureModal('firma_empleado', ev)}
                  >
                    <Ionicons name="qr-code" size={20} color="#FFFFFF" />
                    <ThemedText style={styles.signatureButtonText}>Añadir firma digital</ThemedText>
                  </TouchableOpacity>
                )}
              </>
            )}

            <ThemedText style={[styles.signatureInfoTitle, { marginTop: 12 }]}>
              Firma manual del funcionario
            </ThemedText>
            {ev.firma_empleado_manual ? (
              <ThemedView style={styles.signaturePreviewContainer}>
                <Image source={{ uri: ev.firma_empleado_manual }} style={styles.signaturePreview} resizeMode="contain" />
              </ThemedView>
            ) : (
              <>
                <ThemedText style={styles.emptyText}>No hay firma manual registrada</ThemedText>
                {ev.id > 0 && (
                  <TouchableOpacity
                    style={[styles.signatureButtonPrimary, { marginTop: 8 }]}
                    onPress={() => openAddSignatureModal('firma_empleado_manual', ev)}
                  >
                    <Ionicons name="create-outline" size={20} color="#FFFFFF" />
                    <ThemedText style={styles.signatureButtonText}>Añadir firma manual</ThemedText>
                  </TouchableOpacity>
                )}
              </>
            )}
          </ThemedView>
        )}

        {employee && ev.evaluador.id === Number(employee.id) && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteEvaluation(ev)}
          >
            <Ionicons name="trash" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </ThemedView>
    );
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader
          onMenuPress={handleMenuPress}
          title="Evaluaciones de personal"
        />
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Cargando evaluaciones...</ThemedText>
        </ThemedView>
        <AppFooter />
        <SlideMenu
          isVisible={isMenuVisible}
          onClose={handleMenuClose}
          onHomePress={handleHomePress}
          currentRoute="StaffEvaluations"
        />
      </ThemedView>
    );
  }

  if (!hasMarca) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader
          onMenuPress={handleMenuPress}
          title="Evaluaciones de personal"
        />
        <ThemedView style={styles.loadingContainer}>
          <ThemedText style={styles.errorText}>
            No hay una marca registrada. Debes registrar una marca de ingreso antes de acceder a
            este módulo.
          </ThemedText>
        </ThemedView>
        <AppFooter />
        <SlideMenu
          isVisible={isMenuVisible}
          onClose={handleMenuClose}
          onHomePress={handleHomePress}
          currentRoute="StaffEvaluations"
        />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <AppHeader
        onMenuPress={handleMenuPress}
        title="Evaluaciones de personal"
      />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <ThemedView style={styles.contentContainer}>
          <ThemedView style={styles.titleContainer}>
            <ThemedText type="title" style={styles.title}>
              {getActionIcon('staff-evaluations')} Evaluaciones de personal
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              Gestiona las evaluaciones de colaboradores
            </ThemedText>
          </ThemedView>

          {/* Filtros */}
          <ThemedView style={styles.filtersMain}>
            <ThemedView style={styles.filterHeader}>
              <TouchableOpacity
                style={styles.filterToggleButton}
                onPress={() => setIsFiltersExpanded(!isFiltersExpanded)}
              >
                <ThemedText style={styles.filterToggleText}>Filtros</ThemedText>
                <Ionicons
                  name={isFiltersExpanded ? 'chevron-up' : 'chevron-down'}
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

            {isFiltersExpanded && (
              <ThemedView style={styles.filterContent}>
                <ThemedView style={styles.filterGroupSearch}>
                  <ThemedText style={styles.filterLabel}>Nombre del colaborador:</ThemedText>
                  <TextInput
                    style={styles.searchInput}
                    value={filterColaboradorNombre}
                    onChangeText={setFilterColaboradorNombre}
                    placeholder="Ej: Juan Pérez"
                    placeholderTextColor="#999"
                  />
                </ThemedView>

                <ThemedView style={styles.filterGroupSearch}>
                  <ThemedText style={styles.filterLabel}>Cédula del colaborador:</ThemedText>
                  <TextInput
                    style={styles.searchInput}
                    value={filterColaboradorCedula}
                    onChangeText={setFilterColaboradorCedula}
                    placeholder="Cédula"
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                  />
                </ThemedView>

                <ThemedView style={styles.filterGroupSearch}>
                  <ThemedText style={styles.filterLabel}>Nombre del evaluador:</ThemedText>
                  <TextInput
                    style={styles.searchInput}
                    value={filterEvaluadorNombre}
                    onChangeText={setFilterEvaluadorNombre}
                    placeholder="Nombre del evaluador"
                    placeholderTextColor="#999"
                  />
                </ThemedView>

                <ThemedView style={styles.filterGroupSearch}>
                  <ThemedText style={styles.filterLabel}>Cédula del evaluador:</ThemedText>
                  <TextInput
                    style={styles.searchInput}
                    value={filterEvaluadorCedula}
                    onChangeText={setFilterEvaluadorCedula}
                    placeholder="Cédula"
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                  />
                </ThemedView>

                <ThemedView style={styles.filterGroupSearch}>
                  <ThemedText style={styles.filterLabel}>Tipo de evaluación:</ThemedText>
                  <ThemedView style={styles.pickerContainer}>
                    <Picker
                      selectedValue={filterTipo}
                      onValueChange={(value) => setFilterTipo(value)}
                      style={styles.picker}
                    >
                      <Picker.Item label="Todos los tipos" value="all" color="#000000" />
                      <Picker.Item label="Seguridad" value="Seguridad" color="#000000" />
                      <Picker.Item label="Aseo & limpieza" value="Aseo & limpieza" color="#000000" />
                      <Picker.Item label="Otros" value="Otros" color="#000000" />
                    </Picker>
                  </ThemedView>
                </ThemedView>

                <ThemedView style={styles.filterGroupSearch}>
                  <ThemedText style={styles.filterLabel}>Fecha de evaluación:</ThemedText>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowFilterFechaPicker(true)}
                  >
                    <ThemedText style={styles.dateButtonText}>
                      {filterFechaEvaluacion ? formatDateDMY(filterFechaEvaluacion) : 'Seleccionar fecha'}
                    </ThemedText>
                    <Ionicons name="calendar-outline" size={20} color="#007AFF" />
                  </TouchableOpacity>
                </ThemedView>
              </ThemedView>
            )}
          </ThemedView>

          {!isCreating && (
            <TouchableOpacity style={styles.createButton} onPress={startCreating}>
              <ThemedText style={styles.createButtonText}>{getActionIcon('add')}</ThemedText>
            </TouchableOpacity>
          )}

          {renderCreateForm()}

          {!isCreating && (
            <ThemedView style={styles.listContainer}>
              {filteredEvaluations.length === 0 ? (
                <ThemedView style={styles.emptyContainer}>
                  <ThemedText style={styles.emptyText}>
                    No hay evaluaciones de personal registradas
                  </ThemedText>
                </ThemedView>
              ) : (
                filteredEvaluations.map((ev, index) => renderEvaluationItem(ev, index))
              )}
            </ThemedView>
          )}
        </ThemedView>
      </ScrollView>
      <AppFooter />
      <SlideMenu
        isVisible={isMenuVisible}
        onClose={handleMenuClose}
        onHomePress={handleHomePress}
        currentRoute="StaffEvaluations"
      />
      {QRScannerComponent}

      {/* Modal Añadir firma (digital o manual) en collapsable */}
      <Modal
        visible={addSignatureModalVisible}
        animationType="fade"
        transparent
        presentationStyle="overFullScreen"
        onRequestClose={closeAddSignatureModal}
      >
        <View style={styles.overlay}>
          <ThemedView style={styles.floatModalCard}>
            <ThemedView style={styles.floatModalHeader}>
              <ThemedText style={styles.modalTitle}>
                {addSignatureType === 'firma_empleado' ? 'Añadir firma digital' : 'Añadir firma manual'}
              </ThemedText>
              <TouchableOpacity onPress={closeAddSignatureModal}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </ThemedView>
            {addSignatureType === 'firma_empleado' && (
              <>
                <ThemedView style={{ padding: 16 }}>
                  <TouchableOpacity
                    style={[styles.signatureButtonPrimary, { marginBottom: 12 }]}
                    onPress={handleAddSignatureScanQR}
                  >
                    <Ionicons name="qr-code" size={20} color="#FFFFFF" />
                    <ThemedText style={styles.signatureButtonText}>Escanear código QR</ThemedText>
                  </TouchableOpacity>
                  {addSignatureQRValue && (() => {
                    const decoded = decodeSignature(addSignatureQRValue);
                    return decoded ? (
                      <ThemedView style={styles.signatureInfo}>
                        <ThemedText style={styles.signatureInfoTitle}>Firma escaneada</ThemedText>
                        <ThemedText style={styles.signatureInfoText}>Sesión: {decoded.sessionId}</ThemedText>
                        <ThemedText style={styles.signatureInfoText}>Empleado: {decoded.empleadoId}</ThemedText>
                        <ThemedText style={styles.signatureInfoText}>Hora: {formatDateLabel(decoded.timestamp)}</ThemedText>
                        <ThemedText style={styles.signatureInfoText}>Lat: {decoded.latitud} / Long: {decoded.longitud}</ThemedText>
                      </ThemedView>
                    ) : (
                      <ThemedText style={styles.emptyText}>No se pudo interpretar el QR</ThemedText>
                    );
                  })()}
                </ThemedView>
                <ThemedView style={styles.modalActions}>
                  <TouchableOpacity style={styles.modalClearButton} onPress={closeAddSignatureModal}>
                    <ThemedText style={styles.modalClearButtonText}>Cancelar</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalAcceptButton, (!addSignatureQRValue || isAddSignatureSubmitting) && { opacity: 0.6 }]}
                    onPress={handleAddSignatureConfirmDigital}
                    disabled={!addSignatureQRValue || isAddSignatureSubmitting}
                  >
                    {isAddSignatureSubmitting ? (
                      <ActivityIndicator size="small" color="#000000" />
                    ) : (
                      <Ionicons name="checkmark" size={20} color="#000000" />
                    )}
                    <ThemedText style={styles.modalAcceptButtonText}>Confirmar</ThemedText>
                  </TouchableOpacity>
                </ThemedView>
              </>
            )}
            {addSignatureType === 'firma_empleado_manual' && (
              <>
                <ThemedText style={styles.signatureModalHint}>Dibuje la firma dentro del recuadro.</ThemedText>
                <View style={styles.signaturePadBox}>
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
              </>
            )}
          </ThemedView>
        </View>
      </Modal>

      <Modal
        visible={isFirmaManualModalVisible}
        animationType="fade"
        transparent
        presentationStyle="overFullScreen"
        onRequestClose={closeFirmaEmpleadoManualModal}
      >
        <View style={styles.overlay}>
          <ThemedView style={styles.floatModalCard}>
            <ThemedView style={styles.floatModalHeader}>
              <ThemedText style={styles.modalTitle}>Dibujar firma manual</ThemedText>
              <TouchableOpacity onPress={closeFirmaEmpleadoManualModal}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </ThemedView>
            <ThemedText style={styles.signatureModalHint}>Firma dentro del recuadro blanco.</ThemedText>
            <View style={styles.signaturePadBox}>
              <SignatureScreen
                ref={signatureManualRef}
                onOK={handleManualSignatureRead}
                onEmpty={() => {
                  setIsReadingManualSignature(false);
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
                key={signatureManualKey}
              />
            </View>
            <ThemedView style={styles.modalActions}>
              <TouchableOpacity style={styles.modalClearButton} onPress={clearManualSignatureInModal}>
                <Ionicons name="trash" size={20} color="#000000" />
                <ThemedText style={styles.modalClearButtonText}>Limpiar</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalAcceptButton, isReadingManualSignature && { opacity: 0.7 }]}
                onPress={acceptManualSignature}
                disabled={isReadingManualSignature}
              >
                {isReadingManualSignature ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <Ionicons name="checkmark" size={20} color="#000000" />
                )}
                <ThemedText style={styles.modalAcceptButtonText}>Aceptar</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          </ThemedView>
        </View>
      </Modal>

      {/* Camera modal */}
      <Modal
        visible={cameraVisible}
        animationType="slide"
        onRequestClose={() => setCameraVisible(false)}
      >
        <ThemedView style={{ flex: 1, backgroundColor: '#000' }}>
          <CameraView
            ref={cameraRef}
            style={{ flex: 1 }}
            facing="back"
          >
            <TouchableOpacity
              style={styles.cameraCloseButton}
              onPress={() => setCameraVisible(false)}
            >
              <Ionicons name="close" size={30} color="#000000" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cameraCaptureButton}
              onPress={takePictureForQuestion}
            >
              <ThemedView style={styles.cameraCaptureButtonInner} />
            </TouchableOpacity>
          </CameraView>
        </ThemedView>
      </Modal>

      {showFilterFechaPicker && (
        <DateTimePicker
          value={filterFechaEvaluacion ? new Date(filterFechaEvaluacion) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, date) => {
            setShowFilterFechaPicker(false);
            if (date) {
              const iso = dateToLocalString(date);
              setFilterFechaEvaluacion(iso);
            }
          }}
        />
      )}

      {showFechaIngresoPicker && (
        <DateTimePicker
          value={fechaIngreso ? new Date(fechaIngreso) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, date) => {
            setShowFechaIngresoPicker(false);
            if (date) {
              const iso = dateToLocalString(date);
              fechaIngresoRef.current = iso;
              setFechaIngreso(iso);
            }
          }}
        />
      )}

      {showFechaEvaluacionPicker && (
        <DateTimePicker
          value={fechaEvaluacion ? new Date(fechaEvaluacion) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, date) => {
            setShowFechaEvaluacionPicker(false);
            if (date) {
              const iso = dateToLocalString(date);
              fechaEvaluacionRef.current = iso;
              setFechaEvaluacion(iso);
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
  scrollContent: {
    padding: 16,
  },
  contentContainer: {
    width: '100%',
    maxWidth: 700,
    alignSelf: 'center',
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
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
  },
  createButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 14,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    color: '#333',
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    backgroundColor: '#FFFFFF',
    color: '#000000',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    width: '100%',
    color: '#000000',
  },
  pickerItem: {
    fontSize: 16,
    color: '#000000',
  },
  inlineLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  inlineLoadingText: {
    fontSize: 12,
    color: '#000',
    opacity: 0.6,
  },
  selectedEmployeeContainer: {
    marginTop: 8,
    padding: 10,
    backgroundColor: '#E3F2FD',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  selectedEmployeeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  filtersMain: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
    overflow: 'hidden',
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F0F0F0',
  },
  filterToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  resetFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#FFECEC',
  },
  resetFiltersText: {
    fontSize: 12,
    color: '#FF3B30',
    fontWeight: '600',
  },
  filterContent: {
    padding: 12,
    backgroundColor: '#F9F9F9',
    gap: 8,
  },
  filterGroupSearch: {
    marginBottom: 8,
    backgroundColor: '#F9F9F9',
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
    color: '#000',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: '#FFFFFF',
    color: '#000',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#FFFFFF',
  },
  dateButtonText: {
    fontSize: 14,
    color: '#000000',
  },
  radioGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 8,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#007AFF',
    marginRight: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleSelected: {
    backgroundColor: '#FFFFFF',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#007AFF',
  },
  radioLabel: {
    fontSize: 14,
    color: '#000000',
  },
  sectionCard: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    backgroundColor: '#FAFAFA',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  questionCard: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 6,
    padding: 8,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  questionTitleInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 6,
    padding: 8,
    fontSize: 13,
    marginBottom: 6,
    backgroundColor: '#FFFFFF',
    color: '#000000',
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 4,
  },
  starIcon: {
    marginHorizontal: 2,
  },
  cameraSmallButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginTop: 6,
    backgroundColor: '#F5F5F5',
  },
  cameraSmallButtonText: {
    fontSize: 12,
    color: '#000000',
  },
  questionImagePreview: {
    marginTop: 8,
    width: '100%',
    borderRadius: 6,
  },
  questionImagePreviewHorizontal: {
    height: 160,
  },
  questionImagePreviewVertical: {
    height: 260,
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 16,
  },
  formButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  cancelButton: {
    backgroundColor: '#FF3B30',
  },
  confirmButton: {
    backgroundColor: '#34C759',
  },
  formButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 4,
  },
  listContainer: {},
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    opacity: 0.6,
    textAlign: 'center',
  },
  evaluationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 14,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  deleteButton: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FF3B30',
    width: '100%',
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  evalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#007AFF',
  },
  evalLine: {
    fontSize: 13,
    marginBottom: 2,
  },
  evalLabel: {
    fontWeight: '600',
    color: '#333',
  },
  evalValue: {
    fontSize: 12,
    color: '#000000',
  },
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
  collapseButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007AFF',
  },
  collapsableContent: {
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
  },
  sectionCardList: {
    marginBottom: 10,
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  questionRow: {
    marginTop: 4,
    paddingVertical: 4,
  },
  questionTitleList: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  questionImagePreviewList: {
    marginTop: 4,
    width: '100%',
    borderRadius: 6,
  },
  questionImagePreviewListHorizontal: {
    height: 160,
  },
  questionImagePreviewListVertical: {
    height: 260,
  },
  signatureButtonPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    gap: 8,
  },
  signatureButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  signatureInfo: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  signatureInfoTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  signatureInfoText: {
    fontSize: 12,
    marginBottom: 2,
  },
  signatureInfoDetail: {
    marginTop: 4,
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#E3F2FD',
  },
  signatureInfoDetailText: {
    fontSize: 12,
  },
  signaturePreviewContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    marginTop: 10,
    marginBottom: 10,
    position: 'relative',
  },
  signaturePreview: { width: '100%', height: '100%' },
  removeSignatureButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  openSignatureButton: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingVertical: 12,
    backgroundColor: '#F8F9FA',
    gap: 10,
  },
  openSignatureButtonText: { fontWeight: '800', color: '#000' },
  warningText: {
    marginTop: 6,
    fontSize: 12,
    color: '#FF9500',
  },
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
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#000' },
  signatureModalHint: { paddingHorizontal: 16, paddingTop: 12, color: '#666', fontSize: 13 },
  signaturePadBox: {
    marginTop: 10,
    marginHorizontal: 16,
    height: 260,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, gap: 12, backgroundColor: '#FFFFFF' },
  modalClearButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10, backgroundColor: '#EDEDED', gap: 8 },
  modalClearButtonText: { fontWeight: '800', color: '#000' },
  modalAcceptButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10, backgroundColor: '#D7F5E5', gap: 8 },
  modalAcceptButtonText: { fontWeight: '800', color: '#000' },
  cameraCloseButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
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
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
  },
});


