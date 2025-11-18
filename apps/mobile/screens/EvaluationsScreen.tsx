import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Alert, 
  ActivityIndicator, 
  TextInput,
  View,
  Platform,
  Modal,
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
import Ionicons from '@expo/vector-icons/build/Ionicons';
import { Picker } from '@react-native-picker/picker';
import * as Location from 'expo-location';
import { jwtDecode } from 'jwt-decode';
import getHoraAccion from '@/hooks/getHoraAccion';
import { useQRScanner } from '../hooks/useQRScanner';
import * as Network from 'expo-network';
import { eventBus } from '@/hooks/eventBus';
import { CameraView, useCameraPermissions } from 'expo-camera';

type EvaluationsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Evaluations'>;

// Component to fetch and display evaluation images
function EvaluationImageComponent({ evaluationId, imageProperty }: { evaluationId: number; imageProperty: string }) {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { refreshAccessToken, logout } = useAuth();

  useEffect(() => {
    const fetchImage = async () => {
      try {
        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) return;

        let token = await AsyncStorage.getItem('access_token');
        if (!token) {
          const refreshed = await refreshAccessToken();
          if (!refreshed) return;
          token = await AsyncStorage.getItem('access_token');
        }

        const response = await fetch(`${apiUrl}/api/evaluation/${evaluationId}/get-image/${encodeURIComponent(imageProperty)}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'ngrok-skip-browser-warning': '69420',
          },
        });

        if (response.status === 401 || response.status === 403) {
          const refreshed = await refreshAccessToken();
          if (refreshed) {
            return fetchImage();
          } else {
            await logout();
            return;
          }
        }

        if (response.ok) {
          const blob = await response.blob();
          const reader = new FileReader();
          reader.onloadend = () => {
            setImageUri(reader.result as string);
            setIsLoading(false);
          };
          reader.readAsDataURL(blob);
        } else {
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error fetching evaluation image:', error);
        setIsLoading(false);
      }
    };

    fetchImage();
  }, [evaluationId, imageProperty]);

  if (isLoading) {
    return (
      <ThemedView style={styles.imageLoadingContainer}>
        <ActivityIndicator size="small" color="#007AFF" />
      </ThemedView>
    );
  }

  if (!imageUri) {
    return null;
  }

  return (
    <Image
      source={{ uri: imageUri }}
      style={styles.evaluationImage}
      resizeMode="contain"
    />
  );
}

interface Empleado {
  id: number;
  nombre: string;
  cedula: string;
  fecha_contratacion?: string;
}

interface EmpleadoDetalle {
  nombre: string;
  primer_apellido: string;
  segundo_apellido: string;
}

interface Evaluador {
  id: number;
  nombre: string;
  cedula: string;
}

interface Evaluacion {
  id: number;
  id_local?: string;
  empleado: Empleado;
  evaluador: Evaluador;
  fecha_ingreso: string;
  fecha_evaluacion: string;
  evaluacion: string;
  comentarios: string;
  firma_evaluador: string;
  firma_empleado: string;
  tipo: string;
}

interface EvaluacionItem {
  nombre: string;
  puntuacion: number;
}

interface EvaluationQuestion {
  title: string;
  answear?: number | string;
  image?: string;
}

interface EvaluationSection {
  title: string;
  minimum_score?: number;
  questions: EvaluationQuestion[];
}

interface EvaluationInput {
  type: 'punctuation' | 'image' | 'text';
  length?: string;
  required?: boolean;
}

interface FirmaData {
  sessionId: string;
  empleadoId: string;
  latitud: string;
  longitud: string;
  timestamp: string;
  empleadoDetalle?: EmpleadoDetalle;
}

export default function EvaluationsScreen() {
  const { employee, refreshAccessToken, logout } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<EvaluationsScreenNavigationProp>();
  const { scanQR, QRScannerComponent } = useQRScanner();
  
  // Data states
  const [evaluaciones, setEvaluaciones] = useState<Evaluacion[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasCorpo, setHasCorpo] = useState<boolean>(false);
  const [corpoId, setCorpoId] = useState<number | null>(null);
  
  // Form states
  const [isCreating, setIsCreating] = useState(false);
  const [selectedEmpleado, setSelectedEmpleado] = useState<number | null>(null);
  const [fechaIngreso, setFechaIngreso] = useState('');
  const [fechaEvaluacion, setFechaEvaluacion] = useState('');
  const [showFechaIngresoPicker, setShowFechaIngresoPicker] = useState(false);
  const [showFechaEvaluacionPicker, setShowFechaEvaluacionPicker] = useState(false);
  
  // Form refs for text inputs
  const nombreColaboradorRef = useRef('');
  const cedulaColaboradorRef = useRef('');
  const comentariosRef = useRef('');
  const nombreEvaluadorRef = useRef('');
  
  // Evaluation type and structure
  const [selectedTipo, setSelectedTipo] = useState<'Seguridad' | 'Aseo & Limpieza' | 'Otros'>('Seguridad');
  const [evaluationStructure, setEvaluationStructure] = useState<EvaluationSection[]>([]);
  
  // Camera state
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<{ sectionIndex: number; questionIndex: number } | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);
  
  // Signature states
  const [firmaEvaluador, setFirmaEvaluador] = useState<FirmaData | null>(null);
  const [firmaEmpleado, setFirmaEmpleado] = useState<FirmaData | null>(null);
  const [isGeneratingFirmaEvaluador, setIsGeneratingFirmaEvaluador] = useState(false);
  const [empleadoMismatch, setEmpleadoMismatch] = useState(false);
  
  // Collapsable states
  const [expandedEvaluations, setExpandedEvaluations] = useState<Set<number | string>>(new Set());
  
  // Evaluation structure definitions
  const getEvaluationStructure = (tipo: 'Seguridad' | 'Aseo & Limpieza' | 'Otros'): EvaluationSection[] => {
    const commonQuestions = [
      { title: 'Cumplimiento de Tareas', inputs: [{ type: 'punctuation' as const, length: '10', required: true }, { type: 'image' as const, required: false }] },
      { title: tipo === 'Seguridad' ? 'Vigilancia del Área Asignada' : 'Limpieza del Área Asignada', inputs: [{ type: 'punctuation' as const, length: '10', required: true }, { type: 'image' as const, required: false }] },
      { title: 'Disponibilidad', inputs: [{ type: 'punctuation' as const, length: '10', required: true }, { type: 'image' as const, required: false }] },
      { title: 'Ausentismo', inputs: [{ type: 'punctuation' as const, length: '10', required: true }, { type: 'image' as const, required: false }] },
      { title: 'Incapacidades / Accidentes Laborales', inputs: [{ type: 'punctuation' as const, length: '10', required: true }, { type: 'image' as const, required: false }] },
      { title: 'Puntualidad / Llegadas Tardías', inputs: [{ type: 'punctuation' as const, length: '10', required: true }, { type: 'image' as const, required: false }] },
      { title: 'Actitud de Servicio', inputs: [{ type: 'punctuation' as const, length: '10', required: true }, { type: 'image' as const, required: false }] },
      { title: 'Quejas de Clientes', inputs: [{ type: 'punctuation' as const, length: '10', required: true }, { type: 'image' as const, required: false }] },
      { title: 'Relaciones con los compañeros y supervisores', inputs: [{ type: 'punctuation' as const, length: '10', required: true }, { type: 'image' as const, required: false }] },
      { title: 'Buena presentación personal', inputs: [{ type: 'punctuation' as const, length: '10', required: true }, { type: 'image' as const, required: false }] },
    ];

    if (tipo === 'Seguridad' || tipo === 'Aseo & Limpieza') {
      return [
        {
          title: 'Evaluación principal',
          minimum_score: 70,
          questions: commonQuestions.map(q => ({
            title: q.title,
            answear: undefined,
            image: undefined,
          })),
        },
      ];
    } else {
      // Otros
      return [
        {
          title: 'Objetivos generales 50%',
          minimum_score: 20,
          questions: Array(5).fill(null).map(() => ({
            title: '',
            answear: undefined,
            image: undefined,
          })),
        },
        {
          title: 'Competencias genéricas 10%',
          minimum_score: 12,
          questions: [
            { title: 'Responsabilidad', answear: undefined, image: undefined },
            { title: 'Compromiso', answear: undefined, image: undefined },
            { title: 'Espíritu de Servicio al cliente interno y externo', answear: undefined, image: undefined },
          ],
        },
        {
          title: 'Competencias específicas por área 10%',
          minimum_score: 20,
          questions: [
            { title: 'Capacidad de planificación y organización', answear: undefined, image: undefined },
            { title: 'Comunicación', answear: undefined, image: undefined },
            { title: 'Trabajo en equipo', answear: undefined, image: undefined },
            { title: 'Orientación de resultados', answear: undefined, image: undefined },
          ],
        },
        {
          title: 'Competencias gerenciales liderazgo (Aplica sólo para puestos de Supervisión, Jefaturas y Directores)  20%',
          minimum_score: 24,
          questions: [
            { title: 'Es confiable', answear: undefined, image: undefined },
            { title: 'Da sentido al futuro', answear: undefined, image: undefined },
            { title: 'Dirige y ejecuta el trabajo', answear: undefined, image: undefined },
            { title: 'Compromete el talento', answear: undefined, image: undefined },
            { title: 'Desarrolla el talento', answear: undefined, image: undefined },
            { title: 'Se desarrolla a sí mismo', answear: undefined, image: undefined },
          ],
        },
        {
          title: 'Formación valuable 10%',
          minimum_score: 20,
          questions: [
            { title: 'General (Políticas y Filosofía Corporativa )', answear: undefined, image: undefined },
            { title: 'Cursos específicos o según licitacion', answear: undefined, image: undefined },
            { title: 'Herramientas tecnológicas (Software o equipo que debe saber utilizar)', answear: undefined, image: undefined },
            { title: 'Procedimientos, manuales, formularios, guías de puestos ó Instructivos específicos que debe saber utilizar', answear: undefined, image: undefined },
            { title: 'Otra formación según funciones a ejecutar', answear: undefined, image: undefined },
          ],
        },
        {
          title: 'Retroalimentación',
          questions: [
            { title: 'Aspectos positivos del colaborador (Fortalezas)', answear: undefined, image: undefined },
            { title: 'Áreas o competencias por mejorar (Oportunidad de mejora)', answear: undefined, image: undefined },
            { title: 'Plan de acción (Recomendaciones)', answear: undefined, image: undefined },
            { title: 'Aspiraciones personales - ¿Cuáles son sus metas próximas a nivel profesional?', answear: undefined, image: undefined },
          ],
        },
        {
          title: 'Comentarios',
          questions: [
            { title: 'Colaborador', answear: undefined, image: undefined },
            { title: 'Jefatura', answear: undefined, image: undefined },
          ],
        },
      ];
    }
  };
  
  // Filters state
  const [filterNombreEmpleado, setFilterNombreEmpleado] = useState('');
  const [filterNombreEvaluador, setFilterNombreEvaluador] = useState('');
  const [filterCedulaEmpleado, setFilterCedulaEmpleado] = useState('');
  const [filterFechaIngreso, setFilterFechaIngreso] = useState('');
  const [filterFechaEvaluacion, setFilterFechaEvaluacion] = useState('');
  const [filterComentarios, setFilterComentarios] = useState('');
  const [filterTipo, setFilterTipo] = useState<'Seguridad' | 'Aseo & Limpieza' | 'Otros' | ''>('');
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  const [showFilterFechaIngresoPicker, setShowFilterFechaIngresoPicker] = useState(false);
  const [showFilterFechaEvaluacionPicker, setShowFilterFechaEvaluacionPicker] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  
  useEffect(() => {
    const handler = () => {
      fetchData();
    };

    eventBus.on('connectionRestored', handler);
    return () => {
      eventBus.off('connectionRestored', handler);
    };
  }, []);

  const getConnectionStatus = async (): Promise<boolean> => {
    const networkState = await Network.getNetworkStateAsync();
    return networkState.isConnected && networkState.isInternetReachable ? true : false;
  };

  const generateRandomId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 10; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const fetchData = async () => {
    try {
      setIsLoading(true);

      // Check current_marca and get corpo_id
      const currentMarca = await AsyncStorage.getItem('current_marca');
      if (!currentMarca) {
        setHasCorpo(false);
        setIsLoading(false);
        return;
      }

      const marcaData = JSON.parse(currentMarca);
      if (!marcaData.corpo || !marcaData.corpo.id) {
        setHasCorpo(false);
        setIsLoading(false);
        return;
      }

      const corpo_id = marcaData.corpo.id;
      setCorpoId(corpo_id);
      setHasCorpo(true);

      // Check connectivity
      const isConnected = await getConnectionStatus();

      if (isConnected) {
        // Online mode
        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) {
          throw new Error('Server URL not configured');
        }

        let token = await AsyncStorage.getItem('access_token');
        if (!token) {
          const refreshed = await refreshAccessToken();
          if (!refreshed) {
            throw new Error('No authentication token found');
          }
          token = await AsyncStorage.getItem('access_token');
        }

        // Fetch evaluaciones
        const evaluacionesResponse = await fetch(`${apiUrl}/api/evaluation/corpo/${corpo_id}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': '69420',
          },
        });

        if (evaluacionesResponse.status === 401 || evaluacionesResponse.status === 403) {
          const refreshed = await refreshAccessToken();
          if (refreshed) {
            return fetchData();
          } else {
            await logout();
            return;
          }
        }

        // Fetch empleados
        const empleadosResponse = await fetch(`${apiUrl}/api/empleados/corpo/${corpo_id}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': '69420',
          },
        });

        if (empleadosResponse.status === 401 || empleadosResponse.status === 403) {
          const refreshed = await refreshAccessToken();
          if (refreshed) {
            return fetchData();
          } else {
            await logout();
            return;
          }
        }

        const evaluacionesData = await evaluacionesResponse.json();
        const empleadosData = await empleadosResponse.json();
        

        if (evaluacionesData.status && evaluacionesData.evaluaciones) {
          // Process evaluaciones - decode firma data
          const processedEvaluaciones = await Promise.all(
            evaluacionesData.evaluaciones.map(async (ev: Evaluacion) => {
              try {
                const firmaEvaluadorData = await decodeFirma(ev.firma_evaluador);
                const firmaEmpleadoData = await decodeFirma(ev.firma_empleado);
                return {
                  ...ev,
                  evaluacion: ev.evaluacion,
                  tipo: ev.tipo || '', // Preserve tipo field
                  firmaEvaluadorData,
                  firmaEmpleadoData,
                };
              } catch (error) {
                console.error('Error processing evaluation:', error);
                return ev;
              }
            })
          );
          setEvaluaciones(processedEvaluaciones as any);
          // Update evaluations cache
          await AsyncStorage.setItem('evaluations_cache', JSON.stringify(processedEvaluaciones));
        }

        if (empleadosData.status && empleadosData.empleados) {
          setEmpleados(empleadosData.empleados);
          // Update employee evaluations cache
          await AsyncStorage.setItem('employees_corpo_cache', JSON.stringify(empleadosData.empleados));
        }
      } else {
        // Offline mode - load from cache
        const evaluationsCache = await AsyncStorage.getItem('evaluations_cache');
        const employeesCache = await AsyncStorage.getItem('employees_corpo_cache');

        if (evaluationsCache) {
          const cachedEvaluations = JSON.parse(evaluationsCache);
          setEvaluaciones(cachedEvaluations);
        } else {
          setEvaluaciones([]);
        }

        if (employeesCache) {
          const cachedEmployees = JSON.parse(employeesCache);
          setEmpleados(cachedEmployees);
        } else {
          setEmpleados([]);
        }

        if (!evaluationsCache && !employeesCache) {
          Alert.alert('Modo Offline', 'No hay conexión a internet y no hay datos guardados previamente.');
        } else {
          Alert.alert('Modo Offline', 'No hay conexión a internet. Mostrando datos guardados.');
        }
      }

    } catch (error) {
      console.error('Error fetching data:', error);
      // In case of error, try to load from cache
      try {
        const evaluationsCache = await AsyncStorage.getItem('evaluations_cache');
        const employeesCache = await AsyncStorage.getItem('employees_corpo_cache');

        if (evaluationsCache) {
          setEvaluaciones(JSON.parse(evaluationsCache));
        }
        if (employeesCache) {
          setEmpleados(JSON.parse(employeesCache));
        }

        Alert.alert('Modo Offline', 'Error de conexión. Mostrando datos guardados.');
      } catch (cacheErr) {
        Alert.alert('Error', 'No se pudieron cargar los datos');
      }
    } finally {
      setIsLoading(false);
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

  const fetchEmpleadoDetalle = async (empleadoId: number): Promise<EmpleadoDetalle | null> => {
    try {

        const connectionStatus = await getConnectionStatus();
        if (!connectionStatus) return null;

      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) return null;

      let token = await AsyncStorage.getItem('access_token');
      if (!token) return null;

      const response = await fetch(`${apiUrl}/api/empleados/${empleadoId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '69420',
        },
      });

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

  const generateFirmaEvaluador = async () => {
    if (!employee) {
      Alert.alert('Error', 'No se encontró la información del empleado');
      return;
    }

    setIsGeneratingFirmaEvaluador(true);

    try {
      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Error', 'Se necesita permiso de ubicación para generar la firma');
        setIsGeneratingFirmaEvaluador(false);
        return;
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      // Get session ID from token
      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        throw new Error('No authentication token found');
      }

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
        setFirmaEvaluador(firmaData);
        Alert.alert('Éxito', 'Firma del evaluador generada correctamente');
      }
    } catch (error) {
      console.error('Error generating firma evaluador:', error);
      Alert.alert('Error', 'No se pudo generar la firma del evaluador');
    } finally {
      setIsGeneratingFirmaEvaluador(false);
    }
  };

  const scanFirmaEmpleado = async () => {
    try {
      const qrData = await scanQR();
      if (!qrData) return;

      // Decode and validate
      const firmaData = await decodeFirma(qrData);
      if (!firmaData) {
        Alert.alert('Error', 'El código QR no tiene el formato correcto');
        return;
      }

      setFirmaEmpleado(firmaData);

      // Check if empleado matches selected empleado
      if (selectedEmpleado) {
        if (parseInt(firmaData.empleadoId) !== selectedEmpleado) {
          setEmpleadoMismatch(true);
          Alert.alert(
            'Advertencia',
            'El empleado de la firma no coincide con el empleado seleccionado',
            [{ text: 'Entendido' }]
          );
        } else {
          setEmpleadoMismatch(false);
        }
      }

      Alert.alert('Éxito', 'Firma del funcionario capturada correctamente');
    } catch (error) {
      console.error('Error scanning QR:', error);
      Alert.alert('Error', 'No se pudo leer el código QR');
    }
  };

  const startCreating = () => {
    setIsCreating(true);
    setSelectedEmpleado(null);
    nombreColaboradorRef.current = '';
    cedulaColaboradorRef.current = '';
    setFechaIngreso('');
    setFechaEvaluacion(new Date().toISOString().split('T')[0]);
    setSelectedTipo('Seguridad');
    const initialStructure = getEvaluationStructure('Seguridad');
    setEvaluationStructure(initialStructure);
    comentariosRef.current = '';
    nombreEvaluadorRef.current = employee?.name || '';
    setFirmaEvaluador(null);
    setFirmaEmpleado(null);
    setEmpleadoMismatch(false);
    setShowFechaIngresoPicker(false);
    setShowFechaEvaluacionPicker(false);
  };

  const cancelCreating = () => {
    setIsCreating(false);
  };

  const handleEmpleadoChange = (empleadoId: number) => {
    setSelectedEmpleado(empleadoId);
    
    const empleado = empleados.find(e => e.id === empleadoId);
    if (empleado) {
      nombreColaboradorRef.current = empleado.nombre;
      cedulaColaboradorRef.current = empleado.cedula;
      if (empleado.fecha_contratacion) {
        setFechaIngreso(empleado.fecha_contratacion.split('T')[0]);
      }
    }

    // Check empleado mismatch
    if (firmaEmpleado && parseInt(firmaEmpleado.empleadoId) !== empleadoId) {
      setEmpleadoMismatch(true);
    } else {
      setEmpleadoMismatch(false);
    }
  };

  const handleTipoChange = (tipo: 'Seguridad' | 'Aseo & Limpieza' | 'Otros') => {
    setSelectedTipo(tipo);
    const newStructure = getEvaluationStructure(tipo);
    setEvaluationStructure(newStructure);
  };

  const handleQuestionAnswerChange = (sectionIndex: number, questionIndex: number, value: number | string) => {
    const newStructure = [...evaluationStructure];
    if (newStructure[sectionIndex] && newStructure[sectionIndex].questions[questionIndex]) {
      newStructure[sectionIndex].questions[questionIndex].answear = value;
      setEvaluationStructure(newStructure);
    }
  };

  const handleQuestionTitleChange = (sectionIndex: number, questionIndex: number, value: string) => {
    const newStructure = [...evaluationStructure];
    if (newStructure[sectionIndex] && newStructure[sectionIndex].questions[questionIndex]) {
      newStructure[sectionIndex].questions[questionIndex].title = value;
      setEvaluationStructure(newStructure);
    }
  };

  // Calculate score for a section
  const calculateSectionScore = (section: EvaluationSection): number => {
    return section.questions.reduce((total, question) => {
      if (typeof question.answear === 'number') {
        return total + question.answear;
      }
      return total;
    }, 0);
  };

  // Calculate total score for all sections
  const calculateTotalScore = (structure: EvaluationSection[]): number => {
    return structure.reduce((total, section) => {
      return total + calculateSectionScore(section);
    }, 0);
  };

  // Extract percentage from section title (for "Otros" type)
  const extractSectionPercentage = (title: string): number | null => {
    const match = title.match(/(\d+)%/);
    return match ? parseInt(match[1], 10) : null;
  };

  // Check if section has punctuation questions (for "Otros" type)
  const hasPunctuationQuestions = (section: EvaluationSection, tipo: string): boolean => {
    if (tipo !== 'Otros') return false;
    return section.title === 'Objetivos generales 50%' || 
           section.title.startsWith('Competencias') || 
           section.title === 'Formación valuable 10%';
  };

  // Calculate percentage for a section (for "Otros" type)
  const calculateSectionPercentage = (section: EvaluationSection, tipo: string): number | null => {
    if (!hasPunctuationQuestions(section, tipo)) return null;
    
    const sectionPercentage = extractSectionPercentage(section.title);
    if (sectionPercentage === null) return null;

    const sumPoints = calculateSectionScore(section);
    const questionCount = section.questions.length;
    const maxPointsPerQuestion = 4;

    if (questionCount === 0) return 0;

    const percentage = (sectionPercentage * sumPoints) / (questionCount * maxPointsPerQuestion);
    return Math.round(percentage * 100) / 100; // Round to 2 decimal places
  };

  // Calculate total percentage for all sections (for "Otros" type)
  const calculateTotalPercentage = (structure: EvaluationSection[], tipo: string): number => {
    if (tipo !== 'Otros') return 0;
    
    return structure.reduce((total, section) => {
      const sectionPercentage = calculateSectionPercentage(section, tipo);
      return total + (sectionPercentage || 0);
    }, 0);
  };

  const openCamera = async (sectionIndex: number, questionIndex: number) => {
    if (!permission) {
      const permissionResult = await requestPermission();
      if (!permissionResult.granted) {
        Alert.alert('Error', 'Se necesita permiso de cámara para tomar fotos');
        return;
      }
    }
    setCameraTarget({ sectionIndex, questionIndex });
    setIsCameraVisible(true);
  };

  const takePicture = async () => {
    if (!cameraRef.current || !cameraTarget) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        base64: true,
      });

      if (photo?.base64) {
        const imageBase64 = `data:image/jpeg;base64,${photo.base64}`;
        const newStructure = [...evaluationStructure];
        if (newStructure[cameraTarget.sectionIndex] && newStructure[cameraTarget.sectionIndex].questions[cameraTarget.questionIndex]) {
          newStructure[cameraTarget.sectionIndex].questions[cameraTarget.questionIndex].image = imageBase64;
          setEvaluationStructure(newStructure);
        }
      }

      setIsCameraVisible(false);
      setCameraTarget(null);
    } catch (error) {
      console.error('Error taking picture:', error);
      Alert.alert('Error', 'No se pudo tomar la foto');
    }
  };

  // Convertir string YYYY-MM-DD a objeto Date sin problemas de zona horaria
  const stringToLocalDate = (dateString: string): Date => {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0); // 12:00 para evitar problemas de zona horaria
  };

  // Convertir Date a string YYYY-MM-DD sin problemas de zona horaria
  const dateToLocalString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Formatear fecha para mostrar
  const formatDateForDisplay = (dateString: string): string => {
    if (!dateString) return 'Seleccionar fecha';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  };

  const handleFechaIngresoChange = (event: any, selectedDate?: Date) => {
    setShowFechaIngresoPicker(false);
    if (selectedDate) {
      const dateString = dateToLocalString(selectedDate);
      setFechaIngreso(dateString);
    }
  };

  const handleFechaEvaluacionChange = (event: any, selectedDate?: Date) => {
    setShowFechaEvaluacionPicker(false);
    if (selectedDate) {
      const dateString = dateToLocalString(selectedDate);
      setFechaEvaluacion(dateString);
    }
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

  const createEvaluation = async () => {
    // Validations
    if (!corpoId) {
      Alert.alert('Error', 'No se encontró el ID del corpo');
      return;
    }

    if (!nombreColaboradorRef.current.trim()) {
      Alert.alert('Error', 'El nombre del colaborador es requerido');
      return;
    }

    if (!cedulaColaboradorRef.current.trim()) {
      Alert.alert('Error', 'La cédula del colaborador es requerida');
      return;
    }

    if (!fechaIngreso) {
      Alert.alert('Error', 'La fecha de ingreso es requerida');
      return;
    }

    if (!fechaEvaluacion) {
      Alert.alert('Error', 'La fecha de evaluación es requerida');
      return;
    }

    // Validate evaluation structure
    let hasValidationError = false;
    for (const section of evaluationStructure) {
      for (const question of section.questions) {
        // Check if title is required (for "Otros" type with text inputs)
        if (selectedTipo === 'Otros' && !question.title && section.title !== 'Retroalimentación' && section.title !== 'Comentarios') {
          hasValidationError = true;
          break;
        }
        // Check if answer is required (for punctuation inputs)
        const structure = getEvaluationStructure(selectedTipo);
        const sectionIndex = evaluationStructure.findIndex(s => s.title === section.title);
        if (sectionIndex >= 0 && structure[sectionIndex]) {
          const originalQuestion = structure[sectionIndex].questions.find(q => q.title === question.title || (!q.title && !question.title));
          // For now, we'll allow empty answers as some are optional
        }
      }
      if (hasValidationError) break;
    }

    if (!nombreEvaluadorRef.current.trim()) {
      Alert.alert('Error', 'El nombre del evaluador es requerido');
      return;
    }

    if (!firmaEvaluador) {
      Alert.alert('Error', 'Debes generar la firma del evaluador');
      return;
    }

    if (!firmaEmpleado) {
      Alert.alert('Error', 'Debes escanear la firma del funcionario');
      return;
    }

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas crear esta evaluación?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              // Get marca_id
              const currentMarca = await AsyncStorage.getItem('current_marca');
              if (!currentMarca) {
                Alert.alert('Error', 'No se encontró la marca actual');
                return;
              }
              const marcaData = JSON.parse(currentMarca);

              // Build evaluacion array from structure
              const evaluacionArray = evaluationStructure.map(section => ({
                title: section.title,
                minimum_score: section.minimum_score,
                questions: section.questions.map(q => ({
                  title: q.title,
                  answear: q.answear,
                  image: q.image,
                })),
              }));

              // Rebuild firma base64 strings
              const firmaEvaluadorBase64 = btoa(
                `${firmaEvaluador.sessionId}:${firmaEvaluador.empleadoId}:${firmaEvaluador.latitud}:${firmaEvaluador.longitud}:${firmaEvaluador.timestamp}`
              );
              const firmaEmpleadoBase64 = btoa(
                `${firmaEmpleado.sessionId}:${firmaEmpleado.empleadoId}:${firmaEmpleado.latitud}:${firmaEmpleado.longitud}:${firmaEmpleado.timestamp}`
              );

              const requestData = {
                marca_id: marcaData.id,
                nombre_colaborador: nombreColaboradorRef.current,
                cedula_colaborador: cedulaColaboradorRef.current,
                empleado_id: selectedEmpleado || parseInt(firmaEmpleado.empleadoId),
                evaluador_id: parseInt(employee?.id || '0'),
                fecha_ingreso: fechaIngreso,
                fecha_evaluacion: fechaEvaluacion,
                nombre_evaluador: nombreEvaluadorRef.current,
                tipo: selectedTipo,
                evaluacion: JSON.stringify(evaluacionArray),
                comentarios: comentariosRef.current,
                firma_evaluador: firmaEvaluadorBase64,
                firma_empleado: firmaEmpleadoBase64,
              };

              // Check connectivity
              const isConnected = await getConnectionStatus();

              if (isConnected) {
                // Online mode: call API
                const { createEvaluation: createEvaluationAPI } = await import('@/hooks/evaluationFunctions');
                const result = await createEvaluationAPI({
                  requestData,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', result.message || 'Evaluación creada correctamente');
                  setIsCreating(false);
                  await fetchData();
                } else {
                  Alert.alert('Error', result.message || 'Error al crear la evaluación');
                }
              } else {
                // Offline mode
                const localId = generateRandomId();
                const horaAccion = await getHoraAccion();

                // Create entry in evaluations_actions
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  requestData,
                  id: localId,
                  type: 'create',
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                // Create evaluation in cache
                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                const cache = cacheStr ? JSON.parse(cacheStr) : [];

                const newEvaluationCache = {
                  id: 0,
                  id_local: localId,
                  empleado: {
                    id: selectedEmpleado || parseInt(firmaEmpleado.empleadoId),
                    nombre: nombreColaboradorRef.current,
                    cedula: cedulaColaboradorRef.current,
                  },
                  evaluador: {
                    id: parseInt(employee?.id || '0'),
                    nombre: nombreEvaluadorRef.current,
                    cedula: '',
                  },
                  fecha_ingreso: fechaIngreso,
                  fecha_evaluacion: fechaEvaluacion,
                  tipo: selectedTipo, // Include tipo field
                  evaluacion: JSON.stringify(evaluacionArray),
                  comentarios: comentariosRef.current,
                  firma_evaluador: firmaEvaluadorBase64,
                  firma_empleado: firmaEmpleadoBase64,
                  firmaEvaluadorData: firmaEvaluador,
                  firmaEmpleadoData: firmaEmpleado,
                };

                cache.push(newEvaluationCache);
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(cache));

                Alert.alert('Modo Offline', 'Evaluación registrada localmente. Se sincronizará cuando haya conexión.');
                setIsCreating(false);
                await fetchData();
              }
            } catch (error) {
              console.error('Error creating evaluation:', error);
              Alert.alert('Error', 'No se pudo crear la evaluación');
            }
          },
        },
      ]
    );
  };

  const toggleEvaluationExpanded = (evaluationKey: number | string) => {
    setExpandedEvaluations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(evaluationKey)) {
        newSet.delete(evaluationKey);
      } else {
        newSet.add(evaluationKey);
      }
      return newSet;
    });
  };

  const resetAllFilters = () => {
    setFilterNombreEmpleado('');
    setFilterNombreEvaluador('');
    setFilterCedulaEmpleado('');
    setFilterFechaIngreso('');
    setFilterFechaEvaluacion('');
    setFilterComentarios('');
    setFilterTipo('');
  };

  const handleFilterFechaIngresoChange = (event: any, selectedDate?: Date) => {
    setShowFilterFechaIngresoPicker(false);
    if (selectedDate) {
      const dateString = dateToLocalString(selectedDate);
      setFilterFechaIngreso(dateString);
    }
  };

  const handleFilterFechaEvaluacionChange = (event: any, selectedDate?: Date) => {
    setShowFilterFechaEvaluacionPicker(false);
    if (selectedDate) {
      const dateString = dateToLocalString(selectedDate);
      setFilterFechaEvaluacion(dateString);
    }
  };

  // Filter evaluations
  const filteredEvaluaciones = evaluaciones.filter((evaluacion: any) => {
    const matchesNombreEmpleado = 
      !filterNombreEmpleado.trim() || 
      evaluacion.empleado?.nombre?.toLowerCase().includes(filterNombreEmpleado.toLowerCase());
    
    const matchesNombreEvaluador = 
      !filterNombreEvaluador.trim() || 
      evaluacion.evaluador?.nombre?.toLowerCase().includes(filterNombreEvaluador.toLowerCase());
    
    const matchesCedulaEmpleado = 
      !filterCedulaEmpleado.trim() || 
      evaluacion.empleado?.cedula?.toLowerCase().includes(filterCedulaEmpleado.toLowerCase());
    
    const matchesFechaIngreso = 
      !filterFechaIngreso.trim() || 
      evaluacion.fecha_ingreso?.split('T')[0] === filterFechaIngreso;
    
    const matchesFechaEvaluacion = 
      !filterFechaEvaluacion.trim() || 
      evaluacion.fecha_evaluacion?.split('T')[0] === filterFechaEvaluacion;
    
    const matchesComentarios = 
      !filterComentarios.trim() || 
      (evaluacion.comentarios && evaluacion.comentarios.toLowerCase().includes(filterComentarios.toLowerCase()));
    
    const matchesTipo = 
      !filterTipo || 
      evaluacion.tipo === filterTipo;
    
    return matchesNombreEmpleado && 
           matchesNombreEvaluador && 
           matchesCedulaEmpleado && 
           matchesFechaIngreso && 
           matchesFechaEvaluacion && 
           matchesComentarios &&
           matchesTipo;
  });

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'evaluations': return <Ionicons name="clipboard" size={25} color='#000000' />;
      case 'add': return <Ionicons name="add" size={24} color='#000000' />;
      case 'cancel': return <Ionicons name="close" size={24} color='#FFFFFF' />;
      case 'confirm': return <Ionicons name="checkmark" size={24} color='#FFFFFF' />;
      case 'qr': return <Ionicons name="qr-code" size={24} color='#000000' />;
      case 'signature': return <Ionicons name="create" size={24} color='#000000' />;
      default: return <Ionicons name="clipboard" size={25} color='#000000' />;
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

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader onMenuPress={handleMenuPress} title="Evaluaciones" />
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Cargando evaluaciones...</ThemedText>
        </ThemedView>
        <AppFooter />
      </ThemedView>
    );
  }

  if (!hasCorpo) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader onMenuPress={handleMenuPress} title="Evaluaciones" />
        <ThemedView style={styles.noCorpoContainer}>
          <Ionicons name="alert-circle-outline" size={80} color="#FF9500" />
          <ThemedText style={styles.noCorpoTitle}>No hay corpo registrado</ThemedText>
          <ThemedText style={styles.noCorpoMessage}>
            Debes tener una marca con corpo registrada para acceder a las evaluaciones.
          </ThemedText>
          <TouchableOpacity 
            style={styles.goBackButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={20} color="#000000" />
            <ThemedText style={styles.goBackButtonText}>Volver</ThemedText>
          </TouchableOpacity>
        </ThemedView>
        <AppFooter />
        <SlideMenu 
          isVisible={isMenuVisible} 
          onClose={handleMenuClose}
          onHomePress={handleHomePress}
          currentRoute="Evaluations"
        />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <AppHeader onMenuPress={handleMenuPress} title="Evaluaciones" />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <ThemedView style={styles.contentContainer}>
          {/* Module Title */}
          <ThemedView style={styles.titleContainer}>
            <ThemedText type="title" style={styles.title}>
              {getActionIcon('evaluations')} Evaluaciones
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              Gestiona las evaluaciones de desempeño
            </ThemedText>
          </ThemedView>

          {/* Filters */}
          {!isCreating && (
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
                  <ThemedView style={styles.filterGroup}>
                    <ThemedText style={styles.filterLabel}>Nombre del Empleado:</ThemedText>
                    <TextInput
                      style={styles.searchInput}
                      value={filterNombreEmpleado}
                      onChangeText={setFilterNombreEmpleado}
                      placeholder="Buscar por nombre..."
                      placeholderTextColor="#999"
                    />
                  </ThemedView>

                  <ThemedView style={styles.filterGroup}>
                    <ThemedText style={styles.filterLabel}>Nombre del Evaluador:</ThemedText>
                    <TextInput
                      style={styles.searchInput}
                      value={filterNombreEvaluador}
                      onChangeText={setFilterNombreEvaluador}
                      placeholder="Buscar por nombre..."
                      placeholderTextColor="#999"
                    />
                  </ThemedView>

                  <ThemedView style={styles.filterGroup}>
                    <ThemedText style={styles.filterLabel}>Cédula del Empleado:</ThemedText>
                    <TextInput
                      style={styles.searchInput}
                      value={filterCedulaEmpleado}
                      onChangeText={setFilterCedulaEmpleado}
                      placeholder="Buscar por cédula..."
                      placeholderTextColor="#999"
                    />
                  </ThemedView>

                  <ThemedView style={styles.filterGroup}>
                    <ThemedText style={styles.filterLabel}>Fecha de Ingreso:</ThemedText>
                    <TouchableOpacity
                      style={styles.dateButton}
                      onPress={() => setShowFilterFechaIngresoPicker(true)}
                    >
                      <ThemedText style={styles.dateButtonText}>
                        {formatDateForDisplay(filterFechaIngreso)}
                      </ThemedText>
                      <Ionicons name="calendar-outline" size={20} color="#007AFF" />
                    </TouchableOpacity>
                  </ThemedView>

                  <ThemedView style={styles.filterGroup}>
                    <ThemedText style={styles.filterLabel}>Fecha de Evaluación:</ThemedText>
                    <TouchableOpacity
                      style={styles.dateButton}
                      onPress={() => setShowFilterFechaEvaluacionPicker(true)}
                    >
                      <ThemedText style={styles.dateButtonText}>
                        {formatDateForDisplay(filterFechaEvaluacion)}
                      </ThemedText>
                      <Ionicons name="calendar-outline" size={20} color="#007AFF" />
                    </TouchableOpacity>
                  </ThemedView>

                  <ThemedView style={styles.filterGroup}>
                    <ThemedText style={styles.filterLabel}>Comentarios:</ThemedText>
                    <TextInput
                      style={styles.searchInput}
                      value={filterComentarios}
                      onChangeText={setFilterComentarios}
                      placeholder="Buscar en comentarios..."
                      placeholderTextColor="#999"
                    />
                  </ThemedView>

                  <ThemedView style={styles.filterGroup}>
                    <ThemedText style={styles.filterLabel}>Tipo:</ThemedText>
                    <ThemedView style={styles.pickerContainer}>
                      <Picker
                        selectedValue={filterTipo}
                        onValueChange={(value) => setFilterTipo(value)}
                        style={styles.picker}
                      >
                        <Picker.Item label="Todos" value="" />
                        <Picker.Item label="Seguridad" value="Seguridad" />
                        <Picker.Item label="Aseo & Limpieza" value="Aseo & Limpieza" />
                        <Picker.Item label="Otros" value="Otros" />
                      </Picker>
                    </ThemedView>
                  </ThemedView>
                </ThemedView>
              )}
            </ThemedView>
          )}

          {/* Create Button */}
          {!isCreating && (
            <TouchableOpacity style={styles.createButton} onPress={startCreating}>
              <ThemedText style={styles.createButtonText}>
                {getActionIcon('add')}
              </ThemedText>
            </TouchableOpacity>
          )}

          {/* Create Form */}
          {isCreating && (
            <ThemedView style={[styles.evaluationCard, styles.formCard]}>
              <ThemedText style={styles.formTitle}>Nueva Evaluación</ThemedText>

              {/* Empleado Select */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Empleado:</ThemedText>
                <ThemedView style={styles.pickerContainer}>
                  <Picker
                    selectedValue={selectedEmpleado}
                    onValueChange={(value) => value && handleEmpleadoChange(value)}
                    style={styles.picker}
                  >
                    <Picker.Item label="Seleccionar empleado (opcional)" value={null} />
                    {empleados.map(emp => (
                      <Picker.Item key={emp.id} label={`${emp.cedula} - ${emp.nombre}`} value={emp.id} />
                    ))}
                  </Picker>
                </ThemedView>
              </ThemedView>

              {/* Nombre Colaborador */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Nombre del Colaborador *:</ThemedText>
                <TextInput
                  style={styles.formInput}
                  defaultValue={nombreColaboradorRef.current}
                  onChangeText={(text) => { nombreColaboradorRef.current = text; }}
                  placeholder="Nombre completo"
                  placeholderTextColor="#999"
                  key={`nombre-${isCreating}`}
                />
              </ThemedView>

              {/* Cedula Colaborador */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Cédula del Colaborador *:</ThemedText>
                <TextInput
                  style={styles.formInput}
                  defaultValue={cedulaColaboradorRef.current}
                  onChangeText={(text) => { cedulaColaboradorRef.current = text; }}
                  placeholder="Cédula"
                  placeholderTextColor="#999"
                  key={`cedula-${isCreating}`}
                />
              </ThemedView>

              {/* Fecha Ingreso */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Fecha de Ingreso *:</ThemedText>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowFechaIngresoPicker(true)}
                >
                  <ThemedText style={styles.dateButtonText}>
                    {formatDateForDisplay(fechaIngreso)}
                  </ThemedText>
                  <Ionicons name="calendar-outline" size={20} color="#007AFF" />
                </TouchableOpacity>
              </ThemedView>

              {/* Fecha Evaluacion */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Fecha de Evaluación *:</ThemedText>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowFechaEvaluacionPicker(true)}
                >
                  <ThemedText style={styles.dateButtonText}>
                    {formatDateForDisplay(fechaEvaluacion)}
                  </ThemedText>
                  <Ionicons name="calendar-outline" size={20} color="#007AFF" />
                </TouchableOpacity>
              </ThemedView>

              {/* Tipo */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Tipo *:</ThemedText>
                <ThemedView style={styles.pickerContainer}>
                  <Picker
                    selectedValue={selectedTipo}
                    onValueChange={(value) => handleTipoChange(value)}
                    style={styles.picker}
                  >
                    <Picker.Item label="Seguridad" value="Seguridad" />
                    <Picker.Item label="Aseo & Limpieza" value="Aseo & Limpieza" />
                    <Picker.Item label="Otros" value="Otros" />
                  </Picker>
                </ThemedView>
              </ThemedView>

              {/* Evaluacion Section - Dynamic */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Evaluación *:</ThemedText>
                {evaluationStructure.map((section, sectionIndex) => (
                  <ThemedView key={sectionIndex} style={styles.evaluationSection}>
                    <ThemedView style={styles.sectionHeader}>
                      <ThemedText style={styles.sectionTitle}>{section.title}</ThemedText>
                      {section.minimum_score !== undefined && (
                        <ThemedView style={styles.scoreContainer}>
                          <ThemedText style={styles.scoreText}>
                            Puntaje: {calculateSectionScore(section)} / Mínimo: {section.minimum_score}
                          </ThemedText>
                          {calculateSectionScore(section) >= (section.minimum_score || 0) ? (
                            <Ionicons name="checkmark-circle" size={20} color="#34C759" />
                          ) : (
                            <Ionicons name="close-circle" size={20} color="#FF3B30" />
                          )}
                        </ThemedView>
                      )}
                      {selectedTipo === 'Otros' && hasPunctuationQuestions(section, selectedTipo) && (
                        <ThemedView style={styles.percentageContainer}>
                          <ThemedText style={styles.percentageText}>
                            Porcentaje: {calculateSectionPercentage(section, selectedTipo)?.toFixed(2) || '0.00'}%
                          </ThemedText>
                        </ThemedView>
                      )}
                    </ThemedView>
                    {section.questions.map((question, questionIndex) => {
                      const structure = getEvaluationStructure(selectedTipo);
                      // Get the original question structure based on the section and question index
                      let hasPunctuationInput = false;
                      let hasImageInput = false;
                      let hasTextInput = false;
                      let maxStars = 10;

                      if (selectedTipo === 'Seguridad' || selectedTipo === 'Aseo & Limpieza') {
                        // All questions have punctuation (10) and image inputs
                        hasPunctuationInput = true;
                        hasImageInput = true;
                        maxStars = 10;
                      } else {
                        // Otros - check based on section
                        if (section.title === 'Objetivos generales 50%' || section.title.startsWith('Competencias') || section.title === 'Formación valuable 10%') {
                          hasPunctuationInput = true;
                          hasImageInput = true;
                          maxStars = 4;
                        } else if (section.title === 'Retroalimentación' || section.title === 'Comentarios') {
                          hasTextInput = true;
                        }
                      }

                      // Solo las primeras 5 preguntas de "Objetivos generales 50%" deben tener input de título
                      const showTitleInput = selectedTipo === 'Otros' && section.title === 'Objetivos generales 50%' && questionIndex < 5;

                      return (
                        <ThemedView key={questionIndex} style={styles.questionItem}>
                          {/* Question Title */}
                          {showTitleInput ? (
                            <TextInput
                              style={styles.formInput}
                              placeholder="Título de la pregunta"
                              placeholderTextColor="#999"
                              value={question.title || ''}
                              onChangeText={(text) => handleQuestionTitleChange(sectionIndex, questionIndex, text)}
                            />
                          ) : (
                            <ThemedText style={styles.questionTitle}>{question.title}</ThemedText>
                          )}

                          {/* Punctuation Input */}
                          {hasPunctuationInput && (
                            <ThemedView style={styles.starsContainer}>
                              {[...Array(maxStars)].map((_, starIndex) => {
                                const currentValue = typeof question.answear === 'number' ? question.answear : 0;
                                return (
                                  <TouchableOpacity
                                    key={starIndex}
                                    onPress={() => handleQuestionAnswerChange(sectionIndex, questionIndex, starIndex + 1)}
                                  >
                                    <Ionicons
                                      name={starIndex < currentValue ? "star" : "star-outline"}
                                      size={20}
                                      color={starIndex < currentValue ? "#FFD700" : "#999"}
                                    />
                                  </TouchableOpacity>
                                );
                              })}
                              {typeof question.answear === 'number' && (
                                <ThemedText style={styles.starValue}>{question.answear}/{maxStars}</ThemedText>
                              )}
                            </ThemedView>
                          )}

                          {/* Text Input */}
                          {hasTextInput && (
                            <TextInput
                              style={[styles.formInput, styles.textArea]}
                              placeholder="Respuesta..."
                              placeholderTextColor="#999"
                              multiline
                              numberOfLines={3}
                              value={typeof question.answear === 'string' ? question.answear : ''}
                              onChangeText={(text) => handleQuestionAnswerChange(sectionIndex, questionIndex, text)}
                            />
                          )}

                          {/* Image Input */}
                          {hasImageInput && (
                            <ThemedView style={styles.imageInputContainer}>
                              {question.image ? (
                                <ThemedView style={styles.imagePreviewContainer}>
                                  <Image
                                    source={{ uri: question.image }}
                                    style={styles.questionImage}
                                    resizeMode="contain"
                                  />
                                  <TouchableOpacity
                                    style={styles.removeImageButton}
                                    onPress={() => {
                                      const newStructure = [...evaluationStructure];
                                      newStructure[sectionIndex].questions[questionIndex].image = undefined;
                                      setEvaluationStructure(newStructure);
                                    }}
                                  >
                                    <Ionicons name="close-circle" size={24} color="#FF3B30" />
                                  </TouchableOpacity>
                                </ThemedView>
                              ) : (
                                <TouchableOpacity
                                  style={styles.cameraButton}
                                  onPress={() => openCamera(sectionIndex, questionIndex)}
                                >
                                  <Ionicons name="camera-outline" size={24} color="#007AFF" />
                                  <ThemedText style={styles.cameraButtonText}>Tomar foto</ThemedText>
                                </TouchableOpacity>
                              )}
                            </ThemedView>
                          )}
                        </ThemedView>
                      );
                    })}
                  </ThemedView>
                ))}
                
                {/* Total Score Display */}
                <ThemedView style={styles.totalScoreContainer}>
                  <ThemedText style={styles.totalScoreLabel}>Puntaje Total:</ThemedText>
                  <ThemedText style={styles.totalScoreValue}>
                    {calculateTotalScore(evaluationStructure)}
                  </ThemedText>
                </ThemedView>
                
                {/* Total Percentage Display (for "Otros" type) */}
                {selectedTipo === 'Otros' && (
                  <ThemedView style={styles.totalPercentageContainer}>
                    <ThemedText style={styles.totalPercentageLabel}>Porcentaje Total:</ThemedText>
                    <ThemedText style={styles.totalPercentageValue}>
                      {calculateTotalPercentage(evaluationStructure, selectedTipo).toFixed(2)}%
                    </ThemedText>
                  </ThemedView>
                )}
              </ThemedView>

              {/* Comentarios */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Comentarios:</ThemedText>
                <TextInput
                  style={[styles.formInput, styles.textArea]}
                  defaultValue={comentariosRef.current}
                  onChangeText={(text) => { comentariosRef.current = text; }}
                  placeholder="Comentarios adicionales..."
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={4}
                  key={`comentarios-${isCreating}`}
                />
              </ThemedView>

              {/* Nombre Evaluador */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Nombre del Evaluador *:</ThemedText>
                <TextInput
                  style={styles.formInput}
                  defaultValue={nombreEvaluadorRef.current}
                  onChangeText={(text) => { nombreEvaluadorRef.current = text; }}
                  placeholder="Nombre completo"
                  placeholderTextColor="#999"
                  key={`evaluador-${isCreating}`}
                />
              </ThemedView>

              {/* Firma Evaluador */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Firma del Evaluador *:</ThemedText>
                {!firmaEvaluador ? (
                  <TouchableOpacity
                    style={styles.signatureButton}
                    onPress={generateFirmaEvaluador}
                    disabled={isGeneratingFirmaEvaluador}
                  >
                    {isGeneratingFirmaEvaluador ? (
                      <ActivityIndicator size="small" color="#007AFF" />
                    ) : (
                      <>
                        {getActionIcon('signature')}
                        <ThemedText style={styles.signatureButtonText}>Generar Firma</ThemedText>
                      </>
                    )}
                  </TouchableOpacity>
                ) : (
                  <ThemedView style={styles.firmaSection}>
                    <ThemedText style={styles.firmaSectionTitle}>Firma Evaluador:</ThemedText>
                    {firmaEvaluador.empleadoDetalle ? (
                      <ThemedText style={styles.firmaText}>
                        {firmaEvaluador.empleadoDetalle.nombre} {firmaEvaluador.empleadoDetalle.primer_apellido} {firmaEvaluador.empleadoDetalle.segundo_apellido}
                      </ThemedText>
                    ) : (
                      <ThemedText style={styles.firmaText}>
                        ID: {firmaEvaluador.empleadoId}
                      </ThemedText>
                    )}
                    <ThemedText style={styles.firmaText}>
                      Ubicación: {parseFloat(firmaEvaluador.latitud).toFixed(6)}, {parseFloat(firmaEvaluador.longitud).toFixed(6)}
                    </ThemedText>
                    <ThemedText style={styles.firmaText}>
                      Hora y fecha: {generateDateTime(firmaEvaluador.timestamp)}
                    </ThemedText>
                    <ThemedText style={styles.firmaText}>
                      Sesion: {firmaEvaluador.sessionId}
                    </ThemedText>
                  </ThemedView>
                )}
              </ThemedView>



{/* HAY QUE HACER LA MODIFICACIÓN PARA QUE EL SISTEMA CALCULE EL PUNTAJE TOTAL DE LA EVALUACIÓN EN PORCENTAJES PARA 'OTROS' */}




              {/* Firma Empleado */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Firma del Funcionario *:</ThemedText>
                {!firmaEmpleado ? (
                  <TouchableOpacity
                    style={styles.qrButton}
                    onPress={scanFirmaEmpleado}
                  >
                    {getActionIcon('qr')}
                    <ThemedText style={styles.qrButtonText}>Escanear QR</ThemedText>
                  </TouchableOpacity>
                ) : (
                  <ThemedView style={styles.firmaSection}>
                    <ThemedText style={styles.firmaSectionTitle}>Firma Empleado:</ThemedText>
                    {firmaEmpleado.empleadoDetalle ? (
                      <ThemedText style={styles.firmaText}>
                        {firmaEmpleado.empleadoDetalle.nombre} {firmaEmpleado.empleadoDetalle.primer_apellido} {firmaEmpleado.empleadoDetalle.segundo_apellido}
                      </ThemedText>
                    ) : (
                      <ThemedText style={styles.firmaText}>
                        ID: {firmaEmpleado.empleadoId}
                      </ThemedText>
                    )}
                    <ThemedText style={styles.firmaText}>
                      Ubicación: {parseFloat(firmaEmpleado.latitud).toFixed(6)}, {parseFloat(firmaEmpleado.longitud).toFixed(6)}
                    </ThemedText>
                    <ThemedText style={styles.firmaText}>
                      Hora y fecha: {generateDateTime(firmaEmpleado.timestamp)}
                    </ThemedText>
                    <ThemedText style={styles.firmaText}>
                      Sesion: {firmaEmpleado.sessionId}
                    </ThemedText>
                    {empleadoMismatch && (
                      <ThemedText style={styles.mismatchWarning}>
                        ⚠️ El empleado de la firma no coincide con el seleccionado
                      </ThemedText>
                    )}
                  </ThemedView>
                )}
              </ThemedView>

              {/* Form Buttons */}
              <ThemedView style={styles.formActions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.cancelButton]}
                  onPress={cancelCreating}
                >
                  <ThemedText style={styles.cancelButtonText}>
                    {getActionIcon('cancel')}
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.confirmButton]}
                  onPress={createEvaluation}
                >
                  <ThemedText style={styles.confirmButtonText}>
                    {getActionIcon('confirm')}
                  </ThemedText>
                </TouchableOpacity>
              </ThemedView>
            </ThemedView>
          )}

          {/* Evaluations List */}
          {!isCreating && (
            <ThemedView style={styles.evaluationsContainer}>
              {filteredEvaluaciones.length === 0 ? (
                <ThemedView style={styles.emptyContainer}>
                  <ThemedText style={styles.emptyText}>
                    {evaluaciones.length === 0 ? 'No hay evaluaciones registradas' : 'No se encontraron evaluaciones con los filtros aplicados'}
                  </ThemedText>
                </ThemedView>
              ) : (
                filteredEvaluaciones.map((evaluacion: any) => {
                  let evaluacionStructure: EvaluationSection[] = [];
                  try {
                    const parsed = JSON.parse(evaluacion.evaluacion);
                    // Check if it's the old format (array of items) or new format (array of sections)
                    if (Array.isArray(parsed) && parsed.length > 0) {
                      if (parsed[0].title && parsed[0].questions) {
                        // New format
                        evaluacionStructure = parsed;
                      } else if (parsed[0].nombre && parsed[0].puntuacion !== undefined) {
                        // Old format - convert to new format
                        evaluacionStructure = [{
                          title: 'Evaluación principal',
                          questions: parsed.map((item: EvaluacionItem) => ({
                            title: item.nombre,
                            answear: item.puntuacion,
                            image: undefined,
                          })),
                        }];
                      }
                    }
                  } catch (e) {
                    console.error('Error parsing evaluacion:', e);
                  }

                  const empFirmaFechaSplit = evaluacion.firmaEmpleadoData ? generateDateTime(evaluacion.firmaEmpleadoData.timestamp) : '';
                  const evalFirmaFechaSplit = evaluacion.firmaEvaluadorData ? generateDateTime(evaluacion.firmaEvaluadorData.timestamp) : '';
                  
                  const evaluationKey = evaluacion.id_local || evaluacion.id;
                  const isExpanded = expandedEvaluations.has(evaluationKey);
                  
                  return (
                    <ThemedView key={evaluationKey} style={styles.evaluationCard}>
                      <ThemedView style={styles.evaluationHeader}>
                        <ThemedText style={styles.evaluationTitle}>
                          {evaluacion.id_local ? `Evaluación (Offline)` : `Evaluación #${evaluacion.id}`}
                        </ThemedText>
                      </ThemedView>

                      <ThemedText style={styles.evaluationInfo}>
                        <ThemedText style={styles.evaluationLabel}>Empleado: </ThemedText>
                        {evaluacion.empleado.nombre} ({evaluacion.empleado.cedula})
                      </ThemedText>

                      <ThemedText style={styles.evaluationInfo}>
                        <ThemedText style={styles.evaluationLabel}>Evaluador: </ThemedText>
                        {evaluacion.evaluador.nombre} ({evaluacion.evaluador.cedula || 'N/A'})
                      </ThemedText>

                      <ThemedText style={styles.evaluationInfo}>
                        <ThemedText style={styles.evaluationLabel}>Tipo: </ThemedText>
                        {evaluacion.tipo}
                      </ThemedText>

                      <ThemedText style={styles.evaluationInfo}>
                        <ThemedText style={styles.evaluationLabel}>Fecha Ingreso: </ThemedText>
                        {evaluacion.fecha_ingreso.split('T')[0]}
                      </ThemedText>

                      <ThemedText style={styles.evaluationInfo}>
                        <ThemedText style={styles.evaluationLabel}>Fecha Evaluación: </ThemedText>
                        {evaluacion.fecha_evaluacion.split('T')[0]}
                      </ThemedText>

                      {/* Collapsable Button - Evaluación detallada */}
                      <TouchableOpacity
                        style={styles.collapseButton}
                        onPress={() => toggleEvaluationExpanded(evaluationKey)}
                      >
                        <ThemedText style={styles.collapseButtonText}>
                          {isExpanded ? 'Ocultar evaluación detallada' : 'Ver evaluación detallada'}
                        </ThemedText>
                        <Ionicons
                          name={isExpanded ? "chevron-up" : "chevron-down"}
                          size={20}
                          color="#007AFF"
                        />
                      </TouchableOpacity>

                      {/* Collapsable Content - Evaluación detallada */}
                      {isExpanded && (
                        <ThemedView style={styles.collapsableContent}>
                          {evaluacionStructure.map((section, sectionIndex) => (
                            <ThemedView key={sectionIndex} style={styles.evaluationSection}>
                              <ThemedView style={styles.sectionHeader}>
                                <ThemedText style={styles.sectionTitle}>{section.title}</ThemedText>
                                {section.minimum_score !== undefined && (
                                  <ThemedView style={styles.scoreContainer}>
                                    <ThemedText style={styles.scoreText}>
                                      Puntaje: {calculateSectionScore(section)} / Mínimo: {section.minimum_score}
                                    </ThemedText>
                                    {calculateSectionScore(section) >= (section.minimum_score || 0) ? (
                                      <Ionicons name="checkmark-circle" size={20} color="#34C759" />
                                    ) : (
                                      <Ionicons name="close-circle" size={20} color="#FF3B30" />
                                    )}
                                  </ThemedView>
                                )}
                                {evaluacion.tipo === 'Otros' && hasPunctuationQuestions(section, evaluacion.tipo) && (
                                  <ThemedView style={styles.percentageContainer}>
                                    <ThemedText style={styles.percentageText}>
                                      Porcentaje: {calculateSectionPercentage(section, evaluacion.tipo)?.toFixed(2) || '0.00'}%
                                    </ThemedText>
                                  </ThemedView>
                                )}
                              </ThemedView>
                              {section.questions.map((question, questionIndex) => (
                                <ThemedView key={questionIndex} style={styles.questionItem}>
                                  <ThemedText style={styles.questionTitle}>{question.title}</ThemedText>
                                  {typeof question.answear === 'number' && (
                                    <ThemedText style={styles.answerText}>Respuesta: {question.answear}</ThemedText>
                                  )}
                                  {typeof question.answear === 'string' && (
                                    <ThemedText style={styles.answerText}>{question.answear}</ThemedText>
                                  )}
                                  {question.image && (
                                    <ThemedView style={styles.imageContainer}>
                                      {evaluacion.id_local ? (
                                        // Offline - use base64 directly
                                        <Image
                                          source={{ uri: question.image }}
                                          style={styles.evaluationImage}
                                          resizeMode="contain"
                                        />
                                      ) : (
                                        // Online - fetch from API
                                        <EvaluationImageComponent
                                          evaluationId={evaluacion.id}
                                          imageProperty={question.image}
                                        />
                                      )}
                                    </ThemedView>
                                  )}
                                </ThemedView>
                              ))}
                            </ThemedView>
                          ))}

                          {/* Total Score Display */}
                          <ThemedView style={styles.totalScoreContainer}>
                            <ThemedText style={styles.totalScoreLabel}>Puntaje Total de la Evaluación:</ThemedText>
                            <ThemedText style={styles.totalScoreValue}>
                              {calculateTotalScore(evaluacionStructure)}
                            </ThemedText>
                          </ThemedView>

                          {/* Total Percentage Display (for "Otros" type) */}
                          {evaluacion.tipo === 'Otros' && (
                            <ThemedView style={styles.totalPercentageContainer}>
                              <ThemedText style={styles.totalPercentageLabel}>Porcentaje Total:</ThemedText>
                              <ThemedText style={styles.totalPercentageValue}>
                                {calculateTotalPercentage(evaluacionStructure, evaluacion.tipo).toFixed(2)}%
                              </ThemedText>
                            </ThemedView>
                          )}

                          {/* Comentarios */}
                          {evaluacion.comentarios && (
                            <ThemedView style={styles.comentariosContainer}>
                              <ThemedText style={styles.comentariosLabel}>Comentarios:</ThemedText>
                              <ThemedText style={styles.comentariosText}>{evaluacion.comentarios}</ThemedText>
                            </ThemedView>
                          )}

                          {/* Firmas - Collapsable */}
                          {(evaluacion.firmaEvaluadorData || evaluacion.firmaEmpleadoData) && (
                            <ThemedView style={styles.firmasSection}>
                              <TouchableOpacity
                                style={styles.collapseButton}
                                onPress={() => {
                                  const firmasKey = `firmas-${String(evaluationKey)}`;
                                  setExpandedEvaluations(prev => {
                                    const newSet = new Set(prev);
                                    if (newSet.has(firmasKey)) {
                                      newSet.delete(firmasKey);
                                    } else {
                                      newSet.add(firmasKey);
                                    }
                                    return newSet;
                                  });
                                }}
                              >
                                <ThemedText style={styles.collapseButtonText}>
                                  {expandedEvaluations.has(`firmas-${String(evaluationKey)}`) ? 'Ocultar firmas' : 'Ver firmas'}
                                </ThemedText>
                                <Ionicons
                                  name={expandedEvaluations.has(`firmas-${String(evaluationKey)}`) ? "chevron-up" : "chevron-down"}
                                  size={20}
                                  color="#007AFF"
                                />
                              </TouchableOpacity>
                              {expandedEvaluations.has(`firmas-${String(evaluationKey)}`) && (
                                <ThemedView style={styles.firmasContent}>
                                  {/* Firma Evaluador */}
                                  {evaluacion.firmaEvaluadorData && (
                                    <ThemedView style={styles.firmaSection}>
                                      <ThemedText style={styles.firmaSectionTitle}>Firma Evaluador:</ThemedText>
                                      {evaluacion.firmaEvaluadorData.empleadoDetalle && (
                                        <ThemedText style={styles.firmaText}>
                                          {evaluacion.firmaEvaluadorData.empleadoDetalle.nombre} {evaluacion.firmaEvaluadorData.empleadoDetalle.primer_apellido} {evaluacion.firmaEvaluadorData.empleadoDetalle.segundo_apellido}
                                        </ThemedText>
                                      ) || (
                                        <ThemedText style={styles.firmaText}>
                                          ID: {evaluacion.firmaEvaluadorData.empleadoId}
                                        </ThemedText>
                                      )}
                                      <ThemedText style={styles.firmaText}>
                                        Ubicación: {parseFloat(evaluacion.firmaEvaluadorData.latitud).toFixed(6)}, {parseFloat(evaluacion.firmaEvaluadorData.longitud).toFixed(6)}
                                      </ThemedText>
                                      <ThemedText style={styles.firmaText}>
                                        Hora y fecha: {evalFirmaFechaSplit}
                                      </ThemedText>
                                      <ThemedText style={styles.firmaText}>
                                        Sesion: {evaluacion.firmaEvaluadorData.sessionId}
                                      </ThemedText>
                                    </ThemedView>
                                  )}

                                  {/* Firma Empleado */}
                                  {evaluacion.firmaEmpleadoData && (
                                    <ThemedView style={styles.firmaSection}>
                                      <ThemedText style={styles.firmaSectionTitle}>Firma Empleado:</ThemedText>
                                      {evaluacion.firmaEmpleadoData.empleadoDetalle && (
                                        <ThemedText style={styles.firmaText}>
                                          {evaluacion.firmaEmpleadoData.empleadoDetalle.nombre} {evaluacion.firmaEmpleadoData.empleadoDetalle.primer_apellido} {evaluacion.firmaEmpleadoData.empleadoDetalle.segundo_apellido}
                                        </ThemedText>
                                      ) || (
                                        <ThemedText style={styles.firmaText}>
                                          ID: {evaluacion.firmaEmpleadoData.empleadoId}
                                        </ThemedText>
                                      )}
                                      <ThemedText style={styles.firmaText}>
                                        Ubicación: {parseFloat(evaluacion.firmaEmpleadoData.latitud).toFixed(6)}, {parseFloat(evaluacion.firmaEmpleadoData.longitud).toFixed(6)}
                                      </ThemedText>
                                      <ThemedText style={styles.firmaText}>
                                        Hora y fecha: {empFirmaFechaSplit}
                                      </ThemedText>
                                      <ThemedText style={styles.firmaText}>
                                        Sesion: {evaluacion.firmaEmpleadoData.sessionId}
                                      </ThemedText>
                                    </ThemedView>
                                  )}
                                </ThemedView>
                              )}
                            </ThemedView>
                          )}
                        </ThemedView>
                      )}
                    </ThemedView>
                  );
                })
              )}
            </ThemedView>
          )}
        </ThemedView>
      </ScrollView>

      {/* Date Pickers */}
      {showFechaIngresoPicker && (
        <DateTimePicker
          value={fechaIngreso ? stringToLocalDate(fechaIngreso) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleFechaIngresoChange}
        />
      )}

      {showFechaEvaluacionPicker && (
        <DateTimePicker
          value={fechaEvaluacion ? stringToLocalDate(fechaEvaluacion) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleFechaEvaluacionChange}
        />
      )}

      {/* Filter Date Pickers */}
      {showFilterFechaIngresoPicker && (
        <DateTimePicker
          value={filterFechaIngreso ? stringToLocalDate(filterFechaIngreso) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleFilterFechaIngresoChange}
        />
      )}

      {showFilterFechaEvaluacionPicker && (
        <DateTimePicker
          value={filterFechaEvaluacion ? stringToLocalDate(filterFechaEvaluacion) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleFilterFechaEvaluacionChange}
        />
      )}

      {/* Camera Modal */}
      <Modal
        visible={isCameraVisible}
        animationType="slide"
        onRequestClose={() => setIsCameraVisible(false)}
      >
        <ThemedView style={{ flex: 1, backgroundColor: '#000' }}>
          <CameraView
            ref={cameraRef}
            style={{ flex: 1 }}
            facing="back"
          />
          <TouchableOpacity
            style={styles.cameraCloseButton}
            onPress={() => setIsCameraVisible(false)}
          >
            <Ionicons name="close" size={30} color="#000000" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cameraCaptureButton}
            onPress={takePicture}
          >
            <ThemedView style={styles.cameraCaptureButtonInner} />
          </TouchableOpacity>
        </ThemedView>
      </Modal>

      <AppFooter />
      <SlideMenu 
        isVisible={isMenuVisible} 
        onClose={handleMenuClose}
        onHomePress={handleHomePress}
        currentRoute="Evaluations"
      />
      {QRScannerComponent}
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
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
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
  noCorpoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 20,
  },
  noCorpoTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF9500',
    textAlign: 'center',
  },
  noCorpoMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 400,
  },
  goBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  goBackButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
  evaluationsContainer: {
    width: '100%',
    gap: 16,
  },
  evaluationCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#fff',
    padding: 16,
    gap: 8,
    marginBottom: 16,
  },
  formCard: {
    marginBottom: 20,
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
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  formInput: {
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
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
    overflow: 'hidden',
  },
  picker: {
    width: '100%',
    height: 50,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#333',
  },
  evaluacionItem: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  evaluacionItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  starsContainer: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
  },
  signatureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
  },
  signatureButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  qrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#34C759',
    padding: 16,
    borderRadius: 8,
  },
  qrButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  firmaInfo: {
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    gap: 4,
  },
  firmaInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#34C759',
    marginBottom: 8,
  },
  firmaInfoText: {
    fontSize: 13,
    color: '#666',
  },
  mismatchWarning: {
    fontSize: 13,
    color: '#FF3B30',
    fontWeight: '600',
    marginTop: 8,
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    backgroundColor: '#fff',
  },
  actionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#8E8E93',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#34C759',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  evaluationHeader: {
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#fff',
  },
  evaluationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  evaluationInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  evaluationLabel: {
    fontWeight: '600',
    color: '#333',
  },
  evaluacionResultsContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  evaluacionResultsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  evaluacionResultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
    backgroundColor: '#f8f9fa',
  },
  evaluacionResultName: {
    fontSize: 13,
    color: '#666',
    flex: 1,
  },
  evaluacionResultScore: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007AFF',
  },
  comentariosContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  comentariosLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  comentariosText: {
    fontSize: 13,
    color: '#666',
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
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.5,
    textAlign: 'center',
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
  filtersContainer: {
    width: '100%',
    marginBottom: 20,
    backgroundColor: '#fff',
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
  filtersContent: {
    padding: 16,
    gap: 10,
    backgroundColor: '#F8F9FA',
  },
  filterGroup: {
    flex: 1,
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
  resetFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  resetFiltersText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF3B30',
  },
  radioGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleSelected: {
    borderColor: '#007AFF',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#007AFF',
  },
  radioLabel: {
    fontSize: 16,
    color: '#333',
  },
  evaluationSection: {
    marginBottom: 20,
    padding: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  sectionHeader: {
    marginBottom: 12,
    backgroundColor: '#F8F9FA',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 8,
    backgroundColor: '#F8F9FA',
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8F9FA',
  },
  scoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  totalScoreContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#4CAF50',
    alignItems: 'center',
  },
  totalScoreLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  totalScoreValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  percentageContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#E3F2FD',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  percentageText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976D2',
  },
  totalPercentageContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#2196F3',
    alignItems: 'center',
  },
  totalPercentageLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  totalPercentageValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1976D2',
  },
  minimumScore: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  questionItem: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  questionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  answerText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  starValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFD700',
    marginLeft: 8,
  },
  imageInputContainer: {
    marginTop: 8,
    backgroundColor: '#fff',
  },
  imagePreviewContainer: {
    position: 'relative',
    marginTop: 8,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
  },
  questionImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  cameraButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  cameraButtonText: {
    fontSize: 14,
    color: '#007AFF',
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
  },
  imageContainer: {
    marginTop: 8,
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
  },
  evaluationImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
  },
  imageLoadingContainer: {
    width: '100%',
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
  },
  firmasSection: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  firmasContent: {
    marginTop: 12,
    backgroundColor: '#F9F9F9',
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

