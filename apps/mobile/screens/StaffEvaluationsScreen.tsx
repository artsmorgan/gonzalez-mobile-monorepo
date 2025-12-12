import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { createStaffEvaluation, deleteStaffEvaluation } from '@/hooks/staffEvaluationsFunctions';
import getHoraAccion from '@/hooks/getHoraAccion';

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
  firma_empleado: string;
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
  const { employee, refreshAccessToken, logout } = useAuth();
  const navigation = useNavigation<StaffEvaluationsNavigationProp>();
  const [isMenuVisible, setIsMenuVisible] = useState(false);

  // Marca / corpo
  const [isLoading, setIsLoading] = useState(true);
  const [hasMarca, setHasMarca] = useState<boolean>(false);
  const [marcaId, setMarcaId] = useState<number | null>(null);
  const [corpoId, setCorpoId] = useState<number | null>(null);

  // Datos remotos / cache
  const [evaluaciones, setEvaluaciones] = useState<StaffEvaluation[]>([]);
  const [empleados, setEmpleados] = useState<CorpoEmployee[]>([]);

  // Expand / detalles
  const [expandedEvaluations, setExpandedEvaluations] = useState<Set<string>>(new Set());
  const [expandedFirmas, setExpandedFirmas] = useState<Set<string>>(new Set());

  // Formulario de nueva evaluación
  const [isCreating, setIsCreating] = useState(false);
  const [formKey, setFormKey] = useState(0);
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
  const [firmaEmpleadoWarning, setFirmaEmpleadoWarning] = useState<string | null>(null);

  // QR
  const { scanQR, QRScannerComponent } = useQRScanner();

  // Camera para imágenes de preguntas
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraVisible, setCameraVisible] = useState(false);
  const cameraRef = useRef<any>(null);
  const [currentQuestionKey, setCurrentQuestionKey] = useState<string | null>(null);

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
        answear: '',
        image: null,
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
            answear: '',
            image: null,
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
        let token = await AsyncStorage.getItem('access_token');
        if (!token) {
          const refreshed = await refreshAccessToken();
          if (!refreshed) {
            throw new Error('No authentication token found');
          }
          token = await AsyncStorage.getItem('access_token');
        }

        // Evaluaciones
        const evalRes = await fetch(`${apiUrl}/api/evaluation/corpo/${currentMarca.corpo.id}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': '69420',
          },
        });

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

        // Empleados
        const empRes = await fetch(`${apiUrl}/api/empleados/corpo/${currentMarca.corpo.id}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': '69420',
          },
        });

        if (empRes.ok) {
          const empData = await empRes.json();
          if (empData.status && empData.empleados) {
            setEmpleados(empData.empleados as CorpoEmployee[]);
            await AsyncStorage.setItem('employees_corpo_cache', JSON.stringify(empData.empleados));
          } else {
            setEmpleados([]);
          }
        } else {
          setEmpleados([]);
        }
      } else {
        // Offline: cargar desde cache
        const evalCacheStr = await AsyncStorage.getItem('evaluations_staff_cache');
        if (evalCacheStr) {
          setEvaluaciones(JSON.parse(evalCacheStr));
        } else {
          setEvaluaciones([]);
        }

        const empCacheStr = await AsyncStorage.getItem('employees_corpo_cache');
        if (empCacheStr) {
          setEmpleados(JSON.parse(empCacheStr));
        } else {
          setEmpleados([]);
        }
      }
    } catch (error) {
      console.error('Error fetching staff evaluations:', error);
      try {
        const evalCacheStr = await AsyncStorage.getItem('evaluations_staff_cache');
        if (evalCacheStr) {
          setEvaluaciones(JSON.parse(evalCacheStr));
        }
        const empCacheStr = await AsyncStorage.getItem('employees_corpo_cache');
        if (empCacheStr) {
          setEmpleados(JSON.parse(empCacheStr));
        }
      } catch (cacheErr) {
        console.error('Error loading staff evaluations from cache:', cacheErr);
      }
    } finally {
      setIsLoading(false);
    }
  }, [refreshAccessToken]);

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
    setFirmaEmpleadoWarning(null);
    initializeSectionsForTipo('Seguridad');

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
    if (id) {
      const emp = empleados.find((e) => e.id === id);
      if (emp) {
        nombreColaboradorRef.current = emp.nombre || '';
        cedulaColaboradorRef.current = emp.cedula || '';
        fechaIngresoRef.current = emp.fecha_contratacion.split('T')[0];

        setNombreColaborador(nombreColaboradorRef.current);
        setCedulaColaborador(cedulaColaboradorRef.current);
        setFechaIngreso(fechaIngresoRef.current);
      }
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

      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        throw new Error('No authentication token found');
      }

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
        const response = await fetch(`${apiUrl}/api/empleados/${decodedEmpleadoId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': '69420',
          },
        });
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
          const token = await AsyncStorage.getItem('access_token');
          if (token) {
            const response = await fetch(`${apiUrl}/api/empleados/${empleadoId}`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': '69420',
              },
            });
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
              `La firma corresponde al empleado ID ${empleadoId}, pero el empleado seleccionado es ${
                empleadoSel?.nombre || 'otro'
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
      updateQuestionField(sIdx, qIdx, 'image', formattedBase64);

      // Calcular orientación a partir de las dimensiones de la foto
      if (photo.width && photo.height) {
        const orientation: 'horizontal' | 'vertical' =
          photo.width >= photo.height ? 'horizontal' : 'vertical';
        updateQuestionField(sIdx, qIdx, 'imageOrientation', orientation);
      }
    } catch (error) {
      console.error('Error capturing question image:', error);
      setCameraVisible(false);
      Alert.alert('Error', 'No se pudo capturar la imagen');
    }
  };

  const validateForm = (): boolean => {
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
    if (!firmaEmpleadoHash || !firmaEmpleado) {
      Alert.alert('Error', 'Debes registrar la firma del funcionario');
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
                firma_empleado: firmaEmpleadoHash!,
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
                  firma_empleado: firmaEmpleadoHash!,
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

  const renderCreateForm = () => {
    if (!isCreating) return null;

    return (
      <ThemedView style={styles.formCard}>
        <ThemedText style={styles.formTitle}>Nueva Evaluación de personal</ThemedText>

        {/* Empleados */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Empleado *</ThemedText>
          <ThemedView style={[
            styles.pickerContainer
          ]}>
            <Picker
              selectedValue={selectedEmpleadoId ?? undefined}
              onValueChange={(value) => onEmpleadoSelected(value ? Number(value) : null)}
              style={styles.picker}
              itemStyle={styles.pickerItem}
            >
              <Picker.Item 
                label="Seleccionar empleado..." 
                value={undefined}
                color={selectedEmpleadoId === null ? "#007AFF" : "#000000"}
              />
              {empleados.map((emp) => (
                <Picker.Item
                  key={emp.id}
                  label={`${emp.nombre} - ${emp.cedula}`}
                  value={emp.id}
                  color={selectedEmpleadoId === emp.id ? "#007AFF" : "#000000"}
                />
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
              {fechaIngreso || 'Seleccionar fecha'}
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
              {fechaEvaluacion || 'Seleccionar fecha'}
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
                        <Picker.Item label="Seleccionar opción..." value="" />
                        <Picker.Item label="No aplica" value="0" />
                        <Picker.Item label="No cumple" value="1" />
                        <Picker.Item label="Requiere mejorar" value="2" />
                        <Picker.Item label="Cumple" value="3" />
                        <Picker.Item label="Supera estándar" value="4" />
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
                          {q.image ? 'Cambiar imagen' : 'Tomar imagen (opcional)'}
                        </ThemedText>
                      </TouchableOpacity>
                      {q.image && (
                        <Image
                          source={{ uri: q.image }}
                          style={[
                            styles.questionImagePreview,
                            q.imageOrientation === 'vertical'
                              ? styles.questionImagePreviewVertical
                              : styles.questionImagePreviewHorizontal,
                          ]}
                          resizeMode="contain"
                        />
                      )}
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
          <ThemedText style={styles.formLabel}>Firma del funcionario *</ThemedText>
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
    const empSig = decodeSignature(ev.firma_empleado);

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
          <ThemedText style={styles.evalValue}>{ev.fecha_ingreso.split('T')[0]}</ThemedText>
        </ThemedText>
        <ThemedText style={styles.evalLine}>
          <ThemedText style={styles.evalLabel}>Fecha evaluación: </ThemedText>
          <ThemedText style={styles.evalValue}>{ev.fecha_evaluacion.split('T')[0]}</ThemedText>
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
                      {q.image && (
                        <Image
                          source={{
                            uri:
                              ev.id_local === '' && !q.image.startsWith('data:')
                                ? `${Constants.expoConfig?.extra?.API_SERVER}/api/evaluation/${ev.id}/get-image/${q.image}`
                                : q.image,
                          }}
                          style={[
                            styles.questionImagePreviewList,
                            q.imageOrientation === 'vertical'
                              ? styles.questionImagePreviewListVertical
                              : styles.questionImagePreviewListHorizontal,
                          ]}
                          resizeMode="contain"
                        />
                      )}
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
            {empSig ? (
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
                      <Picker.Item label="Todos los tipos" value="all" />
                      <Picker.Item label="Seguridad" value="Seguridad" />
                      <Picker.Item label="Aseo & limpieza" value="Aseo & limpieza" />
                      <Picker.Item label="Otros" value="Otros" />
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
                      {filterFechaEvaluacion || 'Seleccionar fecha'}
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
  warningText: {
    marginTop: 6,
    fontSize: 12,
    color: '#FF9500',
  },
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


