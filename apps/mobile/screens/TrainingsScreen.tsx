import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Alert, 
  ActivityIndicator, 
  TextInput,
  Platform,
  Modal
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
import { useQRScanner } from '@/hooks/useQRScanner';
import * as Network from 'expo-network';
import { createTraining as createTrainingAPI } from '@/hooks/trainingFunctions';
import getHoraAccion from '@/hooks/getHoraAccion';
import { eventBus } from '@/hooks/eventBus';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'react-native';

type TrainingsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Trainings'>;

interface Empresa {
  id: number;
  nombre: string;
}

interface Cliente {
  id: number;
  nombre: string;
}

interface Sucursal {
  id: number;
  nombre: string;
}

interface Puesto {
  id: number;
  nombre: string;
}

interface Empleado {
  id: number;
  nombre: string;
  cedula: string;
  fecha_contratacion: string;
}

interface EmpleadoList {
  nombre: string;
  cedula: string;
}

interface Responsable {
  nombre: string;
  cedula: string;
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

interface Training {
  id: number;
  empresa: Empresa;
  cliente: Cliente;
  sucursal: Sucursal;
  titulo: string;
  descripcion: string;
  tipo: string;
  resultado: string | null;
  observaciones: string;
  responsable: Responsable;
  firma_responsable: string;
  nombre_firma: string;
  fecha: string;
  base64_file: string;
  empleados: Array<{
    id: number;
    nombre: string;
    cedula: string;
  }>;
  puestos: Array<{
    id: number;
    nombre: string;
  }>;
  id_local: string;
}

export default function TrainingsScreen() {
  const { employee, refreshAccessToken, logout } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<TrainingsScreenNavigationProp>();
  
  // Data states
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMarca, setHasMarca] = useState<boolean>(false);
  const [marcaId, setMarcaId] = useState<number | null>(null);
  const [corpoId, setCorpoId] = useState<number | null>(null);
  const [roleName, setRoleName] = useState<string | null>(null);
  // Dropdowns data
  const [puestos, setPuestos] = useState<Puesto[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  
  // Form states
  const [isCreating, setIsCreating] = useState(false);
  const [formKey, setFormKey] = useState(0); // Key para forzar re-render de inputs
  const [fechaCapacitacion, setFechaCapacitacion] = useState('');
  const [showFechaCapacitacionPicker, setShowFechaCapacitacionPicker] = useState(false);
  const [firmaResponsable, setFirmaResponsable] = useState<FirmaData | null>(null);
  const [isGeneratingFirma, setIsGeneratingFirma] = useState(false);
  const [selectedTipo, setSelectedTipo] = useState<'Prescencial' | 'Virtual'>('Prescencial');
  const [selectedEmpleados, setSelectedEmpleados] = useState<Empleado[]>([]);
  const [selectedPuestos, setSelectedPuestos] = useState<Puesto[]>([]);
  const [trainingImageBase64, setTrainingImageBase64] = useState<string | null>(null);
  const [decodedFirmas, setDecodedFirmas] = useState<Map<number, FirmaData>>(new Map());
  
  // Form refs
  const tituloRef = useRef('');
  const descripcionRef = useRef('');
  const observacionesRef = useRef('');
  const nombreResponsableRef = useRef('');
  const cedulaResponsableRef = useRef('');
  
  // Form dropdowns
  const [selectedResultado, setSelectedResultado] = useState<string>('');
  
  // Location state
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  
  // Camera state
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);
  
  // QR Scanner
  const { scanQR, QRScannerComponent } = useQRScanner();

  // Expanded trainings state (usando string para mayor compatibilidad)
  const [expandedTrainings, setExpandedTrainings] = useState<Set<string>>(new Set());

  // Filter states
  const [filterEmpresa, setFilterEmpresa] = useState('');
  const [filterCliente, setFilterCliente] = useState('');
  const [filterSucursal, setFilterSucursal] = useState('');
  const [filterPuesto, setFilterPuesto] = useState('');
  const [filterEmpleado, setFilterEmpleado] = useState('');
  const [filterResponsable, setFilterResponsable] = useState('');
  const [filterDescripcion, setFilterDescripcion] = useState('');
  const [filterResultado, setFilterResultado] = useState('');
  const [filterObservaciones, setFilterObservaciones] = useState('');
  const [filterFecha, setFilterFecha] = useState('');
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  const [showFilterFechaPicker, setShowFilterFechaPicker] = useState(false);

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

  const checkConnection = async (): Promise<boolean> => {
    const networkState = await Network.getNetworkStateAsync();
    return networkState.isConnected && networkState.isInternetReachable ? true : false;
    //return false;
  };

  const fetchData = async () => {
    try {
      setIsLoading(true);

      // Check current_marca
      const currentMarca = await AsyncStorage.getItem('current_marca');
      if (!currentMarca) {
        setHasMarca(false);
        setIsLoading(false);
        return;
      }

      const marcaData = JSON.parse(currentMarca);
      const marca_id = marcaData.id;
      const corpo_id = marcaData.corpo.id;
      setMarcaId(marca_id);
      setCorpoId(corpo_id);
      setRoleName(marcaData.roleDivision.role.nombre);
      setHasMarca(true);

      // Check internet connection
      const hasConnection = await checkConnection();

      if (hasConnection) {
        // Fetch trainings from API
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

        const response = await fetch(`${apiUrl}/api/training?m=${marca_id}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': '69420',
          },
        });

        if (response.status === 401 || response.status === 403) {
          const refreshed = await refreshAccessToken();
          if (refreshed) {
            return fetchData();
          } else {
            await logout();
            return;
          }
        }

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.status && data.capacitaciones) {
          // Parsear firmas y obtener detalles de empleados
          const trainingsWithDecodedFirmas = await Promise.all(
            data.capacitaciones.map(async (training: Training) => {
              if (training.firma_responsable && training.firma_responsable.trim() !== '') {
                try {
                  const decodedString = atob(training.firma_responsable);
                  const parts = decodedString.split(':');
                  if (parts.length === 5) {
                    const [sessionId, empleadoId, latitud, longitud, timestamp] = parts;
                    
                    // Obtener detalles del empleado
                    let empleadoDetalle = undefined;
                    try {
                      const empleadoResponse = await fetch(`${apiUrl}/api/empleados/${empleadoId}`, {
                        method: 'GET',
                        headers: {
                          'Authorization': `Bearer ${token}`,
                          'Content-Type': 'application/json',
                          'ngrok-skip-browser-warning': '69420',
                        },
                      });
                      
                      if (empleadoResponse.ok) {
                        const empleadoData = await empleadoResponse.json();
                        empleadoDetalle = {
                          nombre: empleadoData.nombre,
                          primer_apellido: empleadoData.primer_apellido,
                          segundo_apellido: empleadoData.segundo_apellido,
                          cedula_empleado: empleadoData.cedula || '',
                        };
                      }
                    } catch (err) {
                      console.error('Error fetching empleado details:', err);
                    }
                    
                    const firmaData: FirmaData = {
                      sessionId,
                      empleadoId,
                      latitud,
                      longitud,
                      timestamp,
                      empleadoDetalle,
                    };
                    
                    // Guardar en el Map
                    setDecodedFirmas(prev => {
                      const newMap = new Map(prev);
                      newMap.set(training.id, firmaData);
                      return newMap;
                    });
                  }
                } catch (err) {
                  console.error('Error decoding firma:', err);
                }
              }
              return training;
            })
          );
          
          setTrainings(trainingsWithDecodedFirmas);
          // Actualizar trainings_cache
          await AsyncStorage.setItem('trainings_cache', JSON.stringify(trainingsWithDecodedFirmas));
        } else {
          setTrainings([]);
        }

        // Fetch puestos and empleados
        await Promise.all([
          fetchPuestos(corpo_id),
          fetchEmpleados(corpo_id),
        ]);
      } else {
        // Sin conexión, usar cache
        console.log('Sin conexión, usando cache de capacitaciones');
        const trainingsCache = await AsyncStorage.getItem('trainings_cache');
        if (trainingsCache) {
          const cachedTrainings = JSON.parse(trainingsCache);
          setTrainings(cachedTrainings);
        } else {
          setTrainings([]);
        }

        // Cargar puestos y empleados desde cache
        const puestosCache = await AsyncStorage.getItem('puestos_corpo_cache');
        if (puestosCache) {
          const cachedPuestos = JSON.parse(puestosCache);
          setPuestos(cachedPuestos);
        } else {
          setPuestos([]);
        }

        const empleadosCache = await AsyncStorage.getItem('employees_corpo_cache');
        if (empleadosCache) {
          const cachedEmpleados = JSON.parse(empleadosCache);
          setEmpleados(cachedEmpleados);
        } else {
          setEmpleados([]);
        }
      }
    } catch (error) {
      console.error('Error fetching trainings:', error);
      // Intentar cargar desde cache en caso de error
      const trainingsCache = await AsyncStorage.getItem('trainings_cache');
      if (trainingsCache) {
        const cachedTrainings = JSON.parse(trainingsCache);
        setTrainings(cachedTrainings);
      } else {
        setTrainings([]);
      }

      const puestosCache = await AsyncStorage.getItem('puestos_corpo_cache');
      if (puestosCache) {
        const cachedPuestos = JSON.parse(puestosCache);
        setPuestos(cachedPuestos);
      } else {
        setPuestos([]);
      }

      const empleadosCache = await AsyncStorage.getItem('employees_corpo_cache');
      if (empleadosCache) {
        const cachedEmpleados = JSON.parse(empleadosCache);
        setEmpleados(cachedEmpleados);
      } else {
        setEmpleados([]);
      }
    } finally {
      setIsLoading(false);
    }
  };


  const fetchPuestos = async (corpo_id: number) => {
    try {
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

      const response = await fetch(`${apiUrl}/api/puestos/corpo/${corpo_id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '69420',
        },
      });

      if (response.status === 401 || response.status === 403) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          return fetchPuestos(corpo_id);
        } else {
          await logout();
          return;
        }
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.status && data.puestos) {
        setPuestos(data.puestos);
        // Actualizar puestos_corpo_cache
        await AsyncStorage.setItem('puestos_corpo_cache', JSON.stringify(data.puestos));
      } else {
        setPuestos([]);
      }
    } catch (error) {
      console.error('Error fetching puestos:', error);
      setPuestos([]);
    }
  };

  const fetchEmpleados = async (corpo_id: number) => {
    try {
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

      const response = await fetch(`${apiUrl}/api/empleados/corpo/${corpo_id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '69420',
        },
      });

      if (response.status === 401 || response.status === 403) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          return fetchEmpleados(corpo_id);
        } else {
          await logout();
          return;
        }
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.status && data.empleados) {
        setEmpleados(data.empleados);
        // Actualizar employees_corpo_cache
        await AsyncStorage.setItem('employees_corpo_cache', JSON.stringify(data.empleados));
      } else {
        setEmpleados([]);
      }
    } catch (error) {
      console.error('Error fetching empleados:', error);
      setEmpleados([]);
    }
  };

  const dateToLocalString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDateForDisplay = (dateString: string): string => {
    if (!dateString) return 'Seleccionar fecha';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  };

  const startCreating = () => {
    setIsCreating(true);
    setFormKey(prev => prev + 1); // Incrementar key para forzar re-render
    tituloRef.current = '';
    descripcionRef.current = '';
    observacionesRef.current = '';
    nombreResponsableRef.current = employee?.name || '';
    cedulaResponsableRef.current = employee?.cedula || '';
    setFechaCapacitacion(new Date().toISOString().split('T')[0]);
    setSelectedTipo('Prescencial');
    setSelectedEmpleados([]);
    setSelectedPuestos([]);
    setSelectedResultado('');
    setFirmaResponsable(null);
    setTrainingImageBase64(null);
    setLocation(null);
    
    // Request location permissions
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Error', 'Se necesita permiso de ubicación para generar la firma');
          return;
        }
        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        setLocation(currentLocation);
      } catch (error) {
        console.error('Error getting location:', error);
      }
    })();
  };

  const cancelCreating = () => {
    setIsCreating(false);
    resetForm();
  };

  const resetForm = () => {
    setFormKey(prev => prev + 1); // Incrementar key para forzar re-render
    tituloRef.current = '';
    descripcionRef.current = '';
    observacionesRef.current = '';
    nombreResponsableRef.current = '';
    cedulaResponsableRef.current = '';
    setFechaCapacitacion('');
    setSelectedTipo('Prescencial');
    setSelectedEmpleados([]);
    setSelectedPuestos([]);
    setSelectedResultado('');
    setFirmaResponsable(null);
    setTrainingImageBase64(null);
    setLocation(null);
  };

  const removeEmpleado = (empleadoId: number) => {
    setSelectedEmpleados(selectedEmpleados.filter(e => e.id !== empleadoId));
  };

  const removePuesto = (puestoId: number) => {
    setSelectedPuestos(selectedPuestos.filter(p => p.id !== puestoId));
  };

  const openCamera = async () => {
    if (!permission) {
      const permissionResult = await requestPermission();
      if (!permissionResult.granted) {
        Alert.alert('Error', 'Se necesita permiso para acceder a la cámara');
        return;
      }
    }

    if (!permission?.granted) {
      const permissionResult = await requestPermission();
      if (!permissionResult.granted) {
        Alert.alert('Error', 'Se necesita permiso para acceder a la cámara');
        return;
      }
    }

    setIsCameraVisible(true);
  };

  const takePicture = async () => {
    if (!cameraRef.current) {
      Alert.alert('Error', 'Cámara no disponible');
      return;
    }

    try {
      const photo = await cameraRef.current.takePictureAsync({ 
        base64: true,
        quality: 0.7,
        skipProcessing: false
      });
      
      if (!photo) {
        Alert.alert('Error', 'No se pudo capturar la foto. Por favor intente nuevamente.');
        setIsCameraVisible(false);
        return;
      }

      if (!photo.base64) {
        Alert.alert('Error', 'No se pudo procesar la imagen. Por favor intente nuevamente.');
        setIsCameraVisible(false);
        return;
      }

      setIsCameraVisible(false);
      
      // Format base64 with data URI prefix
      const formattedBase64 = `data:image/jpeg;base64,${photo.base64!}`;
      
      setTimeout(() => {
        setTrainingImageBase64(formattedBase64);
      }, 100);
    } catch (error) {
      console.error('Error capturing image:', error);
      Alert.alert('Error', 'No se pudo capturar la imagen');
      setIsCameraVisible(false);
    }
  };


  const generateSignature = async () => {
    if (!employee) {
      Alert.alert('Error', 'No se pudo obtener la información del empleado');
      return;
    }

    if (!location) {
      Alert.alert('Error', 'No se pudo obtener la ubicación');
      return;
    }

    setIsGeneratingFirma(true);

    try {
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) {
        throw new Error('Server URL not configured');
      }

      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      const decodedToken = jwtDecode(token);
      const sessionId = JSON.parse(JSON.stringify(decodedToken)).sessionId;

      const horaAccion = await getHoraAccion();
      if (!horaAccion) {
        throw new Error('Hora de acción not found');
      }
      
      // Encode base64
      const hash = btoa(sessionId + ":" + employee.id + ":" + location.coords.latitude + ":" + location.coords.longitude + ":" + horaAccion);

      // Decode to show info
      const decodedHash = atob(hash);
      const [decodedSessionId, decodedEmpleadoId, decodedLatitud, decodedLongitud, decodedTimestamp] = decodedHash.split(':');

      // Fetch empleado details
      const connectionStatus = await checkConnection();
      let empleadoDetalle = undefined;
      if (connectionStatus) {
        const empleadoResponse = await fetch(`${apiUrl}/api/empleados/${decodedEmpleadoId}`, {
            method: 'GET',
            headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': '69420',
            },
        });

        if (empleadoResponse.ok) {
            const empleadoData = await empleadoResponse.json();
            empleadoDetalle = {
                nombre: empleadoData.nombre,
                primer_apellido: empleadoData.primer_apellido,
                segundo_apellido: empleadoData.segundo_apellido,
                cedula_empleado: empleadoData.cedula,
            };
        }
      }

      setFirmaResponsable({
        sessionId: decodedSessionId,
        empleadoId: decodedEmpleadoId,
        latitud: decodedLatitud,
        longitud: decodedLongitud,
        timestamp: decodedTimestamp,
        empleadoDetalle,
      });
    } catch (error) {
      console.error('Error generating signature:', error);
      Alert.alert('Error', 'No se pudo generar la firma digital');
    } finally {
      setIsGeneratingFirma(false);
    }
  };

  const handleScanQR = async () => {
    try {
      const qrData = await scanQR();
      if (!qrData) {
        return;
      }

      // Validar que sea base64 válido
      try {
        const decodedHash = atob(qrData);
        const parts = decodedHash.split(':');
        
        if (parts.length !== 5) {
          Alert.alert('Error', 'El QR no tiene la estructura esperada');
          return;
        }

        const [sessionId, empleadoId, latitud, longitud, timestamp] = parts;

        const connectionStatus = await checkConnection();

        let empleadoDetalle = undefined;
        if (connectionStatus) {
            // Fetch empleado details
            const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
            if (!apiUrl) {
            throw new Error('Server URL not configured');
            }

            const token = await AsyncStorage.getItem('access_token');
            if (!token) {
            throw new Error('No authentication token found');
            }

            const empleadoResponse = await fetch(`${apiUrl}/api/empleados/${empleadoId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': '69420',
            },
            });

            if (empleadoResponse.ok) {
                const empleadoData = await empleadoResponse.json();
                empleadoDetalle = {
                    nombre: empleadoData.nombre,
                    primer_apellido: empleadoData.primer_apellido,
                    segundo_apellido: empleadoData.segundo_apellido,
                    cedula_empleado: empleadoData.cedula,
                };
            }
        }

        setFirmaResponsable({
          sessionId,
          empleadoId,
          latitud,
          longitud,
          timestamp,
          empleadoDetalle,
        });
      } catch (error) {
        Alert.alert('Error', 'El QR escaneado no es válido');
      }
    } catch (error) {
      console.error('Error scanning QR:', error);
      Alert.alert('Error', 'No se pudo escanear el código QR');
    }
  };

  const handleFechaCapacitacionChange = (event: any, selectedDate?: Date) => {
    setShowFechaCapacitacionPicker(Platform.OS === 'ios');
    if (selectedDate) {
      setFechaCapacitacion(dateToLocalString(selectedDate));
    }
  };

  const generateDateTime = (timestamp: string) => {
    const fecha = new Date(parseInt(timestamp)).toISOString();
    const fechaSplit = fecha.split('T');
    fechaSplit[1] = fechaSplit[1].split('.')[0];
    return fechaSplit[0] + ' ' + fechaSplit[1];
  };

  const toggleTrainingExpanded = (trainingKey: string) => {
    setExpandedTrainings(prev => {
      const newSet = new Set(prev);
      if (newSet.has(trainingKey)) {
        newSet.delete(trainingKey);
      } else {
        newSet.add(trainingKey);
      }
      return newSet;
    });
  };

  const resetAllFilters = () => {
    setFilterEmpresa('');
    setFilterCliente('');
    setFilterSucursal('');
    setFilterPuesto('');
    setFilterEmpleado('');
    setFilterResponsable('');
    setFilterDescripcion('');
    setFilterResultado('');
    setFilterObservaciones('');
    setFilterFecha('');
  };

  const handleFilterFechaChange = (event: any, selectedDate?: Date) => {
    setShowFilterFechaPicker(Platform.OS === 'ios');
    if (selectedDate) {
      setFilterFecha(dateToLocalString(selectedDate));
    }
  };

  // Filter trainings
  const filteredTrainings = trainings.filter(training => {
    const matchesEmpresa = !filterEmpresa || 
      training.empresa.nombre.toLowerCase().includes(filterEmpresa.toLowerCase());
    
    const matchesCliente = !filterCliente || 
      training.cliente.nombre.toLowerCase().includes(filterCliente.toLowerCase());
    
    const matchesSucursal = !filterSucursal || 
      training.sucursal.nombre.toLowerCase().includes(filterSucursal.toLowerCase());
    
    const matchesPuesto = !filterPuesto || 
      training.puestos.some(p => p.nombre.toLowerCase().includes(filterPuesto.toLowerCase()));
    
    const matchesEmpleado = !filterEmpleado || 
      training.empleados.some(e => e.nombre.toLowerCase().includes(filterEmpleado.toLowerCase()) || e.cedula.toLowerCase().includes(filterEmpleado.toLowerCase()));
    
    const matchesResponsable = !filterResponsable || 
      training.responsable.nombre.toLowerCase().includes(filterResponsable.toLowerCase());
    
    const matchesDescripcion = !filterDescripcion || 
      training.descripcion.toLowerCase().includes(filterDescripcion.toLowerCase());
    
    const matchesResultado = !filterResultado || 
      (training.resultado && training.resultado.toLowerCase().includes(filterResultado.toLowerCase()));
    
    const matchesObservaciones = !filterObservaciones || 
      (training.observaciones && training.observaciones.toLowerCase().includes(filterObservaciones.toLowerCase()));
    
    const matchesFecha = !filterFecha || 
      (training.fecha && training.fecha.split('T')[0] === filterFecha);
    
    return matchesEmpresa && matchesCliente && matchesSucursal && 
           matchesPuesto && matchesEmpleado && matchesResponsable && 
           matchesDescripcion && matchesResultado && matchesObservaciones && matchesFecha;
  });

  const validateForm = (): boolean => {
    if (!tituloRef.current.trim()) {
      Alert.alert('Error', 'El título de la capacitación es requerido');
      return false;
    }

    if (!descripcionRef.current.trim()) {
      Alert.alert('Error', 'La descripción de la capacitación es requerida');
      return false;
    }

    if (!fechaCapacitacion) {
      Alert.alert('Error', 'La fecha de la capacitación es requerida');
      return false;
    }

    if (!nombreResponsableRef.current.trim()) {
      Alert.alert('Error', 'El nombre del responsable es requerido');
      return false;
    }

    if (!cedulaResponsableRef.current.trim()) {
      Alert.alert('Error', 'La cédula del responsable es requerida');
      return false;
    }

    if (!firmaResponsable) {
      Alert.alert('Error', 'Debes generar o escanear la firma del responsable');
      return false;
    }

    return true;
  };

  const createTraining = async () => {
    if (!validateForm()) {
      return;
    }

    if (!marcaId) {
      Alert.alert('Error', 'No se encontró la marca actual');
      return;
    }

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas crear esta capacitación?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              // Re-encode signature
              const signatureHash = btoa(
                firmaResponsable!.sessionId + ":" +
                firmaResponsable!.empleadoId + ":" +
                firmaResponsable!.latitud + ":" +
                firmaResponsable!.longitud + ":" +
                firmaResponsable!.timestamp
              );

              // Preparar imagen (asegurar formato correcto: data:image/jpeg;base64,<base64_string>)
              let imageBase64 = null;
              if (trainingImageBase64) {
                // Verificar si ya tiene el formato correcto
                const base64Regex = /^data:(.+);base64,(.+)$/;
                if (base64Regex.test(trainingImageBase64)) {
                  imageBase64 = trainingImageBase64;
                } else if (trainingImageBase64.startsWith('data:image')) {
                  // Ya tiene data:image pero puede que no tenga el formato exacto
                  imageBase64 = trainingImageBase64;
                } else {
                  // Agregar el prefijo si no lo tiene
                  imageBase64 = `data:image/jpeg;base64,${trainingImageBase64}`;
                }
              }

              const requestData = {
                marca_id: marcaId,
                titulo: tituloRef.current,
                descripcion: descripcionRef.current,
                tipo: selectedTipo,
                resultado: selectedResultado || null,
                observaciones: observacionesRef.current.trim() !== "" ? observacionesRef.current.trim() : "-",
                nombre_responsable: nombreResponsableRef.current,
                cedula_responsable: cedulaResponsableRef.current,
                firma_responsable: signatureHash,
                file: imageBase64,
                fecha: fechaCapacitacion,
                empleados: selectedEmpleados.map(e => e.id),
                puestos: selectedPuestos.map(p => p.id),
              };

              // Check internet connection
              const hasConnection = await checkConnection();

              if (hasConnection) {
                // Con conexión, enviar a la API
                const result = await createTrainingAPI({
                  requestData,
                  marcaId,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Capacitación creada correctamente');
                  setIsCreating(false);
                  resetForm();
                  fetchData();
                } else {
                  Alert.alert('Error', result.message || 'No se pudo crear la capacitación');
                }
              } else {
                // Sin conexión, guardar en cache y actions
                const localId = Math.random().toString(36).substring(2, 12);

                // Crear entrada en trainings_actions
                const actionsStr = await AsyncStorage.getItem('trainings_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  requestData,
                  marcaId,
                  id: localId,
                  type: 'create',
                });
                await AsyncStorage.setItem('trainings_actions', JSON.stringify(actions));

                // Crear capacitación en cache
                const cacheStr = await AsyncStorage.getItem('trainings_cache');
                const cache = cacheStr ? JSON.parse(cacheStr) : [];
                
                const horaAccion = await getHoraAccion();
                
                const currentMarca = await AsyncStorage.getItem('current_marca');
                if (!currentMarca) {
                  Alert.alert('Error', 'No se encontró la marca actual');
                  return;
                }
                const currentMarcaObj = JSON.parse(currentMarca);

                const newTraining: Training = {
                  id: 0,
                  empresa: { id: currentMarcaObj.empresa.id, nombre: currentMarcaObj.empresa.nombre || '-' },
                  cliente: { id: currentMarcaObj.cliente.id, nombre: currentMarcaObj.cliente.nombre || '-' },
                  sucursal: { id: currentMarcaObj.sucursal?.id || currentMarcaObj.corpo.id, nombre: currentMarcaObj.sucursal?.nombre || currentMarcaObj.corpo.nombre || '-' },
                  titulo: tituloRef.current,
                  descripcion: descripcionRef.current,
                  tipo: selectedTipo,
                  resultado: selectedResultado || null,
                  observaciones: observacionesRef.current.trim() !== "" ? observacionesRef.current.trim() : "-",
                  responsable: {
                    nombre: nombreResponsableRef.current,
                    cedula: cedulaResponsableRef.current,
                  },
                  fecha: fechaCapacitacion,
                  firma_responsable: signatureHash,
                  nombre_firma: firmaResponsable?.empleadoDetalle ? 
                    `${firmaResponsable.empleadoDetalle.nombre} ${firmaResponsable.empleadoDetalle.primer_apellido} ${firmaResponsable.empleadoDetalle.segundo_apellido}` : 
                    '-',
                  base64_file: imageBase64 || '',
                  empleados: selectedEmpleados.map(e => ({ id: e.id, nombre: e.nombre, cedula: e.cedula })),
                  puestos: selectedPuestos.map(p => ({ id: p.id, nombre: p.nombre })),
                  id_local: localId,
                };

                cache.push(newTraining);
                await AsyncStorage.setItem('trainings_cache', JSON.stringify(cache));

                Alert.alert('Modo Offline', 'Capacitación registrada localmente. Se sincronizará cuando haya conexión.');
                setIsCreating(false);
                resetForm();
                
                // Actualizar la lista con el cache actualizado
                setTrainings(cache);
              }
            } catch (error) {
              console.error('Error creating training:', error);
              Alert.alert('Error', 'No se pudo crear la capacitación');
            }
          },
        },
      ]
    );
  };

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'trainings': return <Ionicons name="school" size={25} color='#000000' />;
      case 'add': return <Ionicons name="add" size={24} color='#000000' />;
      case 'cancel': return <Ionicons name="close" size={24} color='#FFFFFF' />;
      case 'confirm': return <Ionicons name="checkmark" size={24} color='#FFFFFF' />;
      case 'signature': return <Ionicons name="finger-print" size={20} color='#000000' />;
      case 'qr': return <Ionicons name="qr-code" size={20} color='#000000' />;
      case 'clear': return <Ionicons name="trash" size={20} color='#000000' />;
      default: return <Ionicons name="school" size={25} color='#000000' />;
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
    setIsMenuVisible(false);
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader onMenuPress={handleMenuPress} title="Registro de Capacitaciones" />
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Cargando capacitaciones...</ThemedText>
        </ThemedView>
        <AppFooter />
        <SlideMenu
          isVisible={isMenuVisible}
          onClose={handleMenuClose}
          onHomePress={handleHomePress}
        />
      </ThemedView>
    );
  }

  if (!hasMarca) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader onMenuPress={handleMenuPress} title="Registro de Capacitaciones" />
        <ThemedView style={styles.loadingContainer}>
          <ThemedText style={styles.errorText}>No hay una marca registrada</ThemedText>
        </ThemedView>
        <AppFooter />
        <SlideMenu
          isVisible={isMenuVisible}
          onClose={handleMenuClose}
          onHomePress={handleHomePress}
        />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <AppHeader onMenuPress={handleMenuPress} title="Registro de Capacitaciones" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Module Title */}
        <ThemedView style={styles.titleContainer}>
          <ThemedText type="title" style={styles.title}>
            {getActionIcon('trainings')} Capacitaciones
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            Gestiona el registro de capacitaciones
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
                  <ThemedText style={styles.filterLabel}>Empresa:</ThemedText>
                  <TextInput
                    style={styles.searchInput}
                    value={filterEmpresa}
                    onChangeText={setFilterEmpresa}
                    placeholder="Filtrar por empresa..."
                    placeholderTextColor="#999"
                  />
                </ThemedView>

                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.filterLabel}>Cliente:</ThemedText>
                  <TextInput
                    style={styles.searchInput}
                    value={filterCliente}
                    onChangeText={setFilterCliente}
                    placeholder="Filtrar por cliente..."
                    placeholderTextColor="#999"
                  />
                </ThemedView>

                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.filterLabel}>Sucursal:</ThemedText>
                  <TextInput
                    style={styles.searchInput}
                    value={filterSucursal}
                    onChangeText={setFilterSucursal}
                    placeholder="Filtrar por sucursal..."
                    placeholderTextColor="#999"
                  />
                </ThemedView>

                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.filterLabel}>Puesto:</ThemedText>
                  <TextInput
                    style={styles.searchInput}
                    value={filterPuesto}
                    onChangeText={setFilterPuesto}
                    placeholder="Filtrar por puesto..."
                    placeholderTextColor="#999"
                  />
                </ThemedView>

                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.filterLabel}>Empleado:</ThemedText>
                  <TextInput
                    style={styles.searchInput}
                    value={filterEmpleado}
                    onChangeText={setFilterEmpleado}
                    placeholder="Filtrar por empleado..."
                    placeholderTextColor="#999"
                  />
                </ThemedView>

                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.filterLabel}>Responsable:</ThemedText>
                  <TextInput
                    style={styles.searchInput}
                    value={filterResponsable}
                    onChangeText={setFilterResponsable}
                    placeholder="Filtrar por responsable..."
                    placeholderTextColor="#999"
                  />
                </ThemedView>

                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.filterLabel}>Descripción:</ThemedText>
                  <TextInput
                    style={styles.searchInput}
                    value={filterDescripcion}
                    onChangeText={setFilterDescripcion}
                    placeholder="Filtrar por descripción..."
                    placeholderTextColor="#999"
                  />
                </ThemedView>

                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.filterLabel}>Resultado:</ThemedText>
                  <TextInput
                    style={styles.searchInput}
                    value={filterResultado}
                    onChangeText={setFilterResultado}
                    placeholder="Filtrar por resultado..."
                    placeholderTextColor="#999"
                  />
                </ThemedView>

                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.filterLabel}>Observaciones:</ThemedText>
                  <TextInput
                    style={styles.searchInput}
                    value={filterObservaciones}
                    onChangeText={setFilterObservaciones}
                    placeholder="Filtrar por observaciones..."
                    placeholderTextColor="#999"
                  />
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
                  {filterFecha && (
                    <TouchableOpacity
                      style={styles.clearDateButton}
                      onPress={() => setFilterFecha('')}
                    >
                      <Ionicons name="close-circle" size={20} color="#FF3B30" />
                      <ThemedText style={styles.clearDateText}>Limpiar fecha</ThemedText>
                    </TouchableOpacity>
                  )}
                </ThemedView>
              </ThemedView>
            )}
          </ThemedView>
        )}

        {/* Create Button */}
        {!isCreating && (
          <TouchableOpacity
            style={styles.createButton}
            onPress={startCreating}
          >
            <ThemedText style={styles.createButtonText}>
              {getActionIcon('add')}
            </ThemedText>
          </TouchableOpacity>
        )}

        {/* Create Form */}
        {isCreating && (
          <ThemedView style={styles.formCard}>
            <ThemedText style={styles.formTitle}>Nueva Capacitación</ThemedText>

            {/* Título */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Título de la capacitación *:</ThemedText>
              <TextInput
                style={styles.formInput}
                defaultValue={tituloRef.current}
                onChangeText={(text) => { tituloRef.current = text; }}
                placeholder="Título"
                placeholderTextColor="#999"
                key={`titulo-${formKey}`}
              />
            </ThemedView>

            {/* Descripción */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Descripción de la capacitación *:</ThemedText>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                defaultValue={descripcionRef.current}
                onChangeText={(text) => { descripcionRef.current = text; }}
                placeholder="Descripción"
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
                key={`descripcion-${formKey}`}
              />
            </ThemedView>

            {/* Tipo de capacitación */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Tipo de capacitación *:</ThemedText>
              <ThemedView style={styles.radioGroup}>
                {['Prescencial', 'Virtual'].map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={styles.radioOption}
                    onPress={() => setSelectedTipo(option as 'Prescencial' | 'Virtual')}
                  >
                    <ThemedView style={[
                      styles.radioCircle,
                      selectedTipo === option && styles.radioCircleSelected
                    ]}>
                      {selectedTipo === option && <ThemedView style={styles.radioInner} />}
                    </ThemedView>
                    <ThemedText style={styles.radioLabel}>{option}</ThemedText>
                  </TouchableOpacity>
                ))}
              </ThemedView>
            </ThemedView>

            {/* Empleados en la capacitación */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Empleados en la capacitación:</ThemedText>
              <ThemedView style={styles.pickerContainer}>
                <Picker
                  selectedValue={undefined}
                  onValueChange={(value) => {
                    if (value && !selectedEmpleados.find(e => e.id === value)) {
                      const empleado = empleados.find(e => e.id === value);
                      if (empleado) {
                        setSelectedEmpleados([...selectedEmpleados, empleado]);
                      }
                    }
                  }}
                  style={styles.picker}
                >
                  <Picker.Item label="Seleccionar empleado..." value={undefined} />
                  {empleados
                    .filter(e => !selectedEmpleados.find(se => se.id === e.id))
                    .map((empleado) => (
                      <Picker.Item 
                        key={empleado.id} 
                        label={`${empleado.nombre} - ${empleado.cedula}`} 
                        value={empleado.id} 
                      />
                    ))}
                </Picker>
              </ThemedView>
              {selectedEmpleados.length > 0 && (
                <ThemedView style={styles.selectedList}>
                  {selectedEmpleados.map((empleado) => (
                    <ThemedView key={empleado.id} style={styles.selectedItem}>
                      <ThemedText style={styles.selectedItemText}>
                        {empleado.nombre} - {empleado.cedula}
                      </ThemedText>
                      <TouchableOpacity onPress={() => removeEmpleado(empleado.id)}>
                        <Ionicons name="close-circle" size={24} color="#FF3B30" />
                      </TouchableOpacity>
                    </ThemedView>
                  ))}
                </ThemedView>
              )}
            </ThemedView>

            {/* Puestos en la capacitación */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Puestos en la capacitación:</ThemedText>
              <ThemedView style={styles.pickerContainer}>
                <Picker
                  selectedValue={undefined}
                  onValueChange={(value) => {
                    if (value && !selectedPuestos.find(p => p.id === value)) {
                      const puesto = puestos.find(p => p.id === value);
                      if (puesto) {
                        setSelectedPuestos([...selectedPuestos, puesto]);
                      }
                    }
                  }}
                  style={styles.picker}
                >
                  <Picker.Item label="Seleccionar puesto..." value={undefined} />
                  {puestos
                    .filter(p => !selectedPuestos.find(sp => sp.id === p.id))
                    .map((puesto) => (
                      <Picker.Item 
                        key={puesto.id} 
                        label={puesto.nombre} 
                        value={puesto.id} 
                      />
                    ))}
                </Picker>
              </ThemedView>
              {selectedPuestos.length > 0 && (
                <ThemedView style={styles.selectedList}>
                  {selectedPuestos.map((puesto) => (
                    <ThemedView key={puesto.id} style={styles.selectedItem}>
                      <ThemedText style={styles.selectedItemText}>{puesto.nombre}</ThemedText>
                      <TouchableOpacity onPress={() => removePuesto(puesto.id)}>
                        <Ionicons name="close-circle" size={24} color="#FF3B30" />
                      </TouchableOpacity>
                    </ThemedView>
                  ))}
                </ThemedView>
              )}
            </ThemedView>

            {/* Fecha */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Fecha de la capacitación *:</ThemedText>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowFechaCapacitacionPicker(true)}
              >
                <ThemedText style={styles.dateButtonText}>
                  {formatDateForDisplay(fechaCapacitacion)}
                </ThemedText>
                <Ionicons name="calendar-outline" size={20} color="#007AFF" />
              </TouchableOpacity>
            </ThemedView>

            {/* Resultado */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Resultado (opcional):</ThemedText>
              <ThemedView style={styles.radioGroup}>
                {['Bueno', 'Regular', 'Malo'].map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={styles.radioOption}
                    onPress={() => setSelectedResultado(selectedResultado === option ? '' : option)}
                  >
                    <ThemedView style={[
                      styles.radioCircle,
                      selectedResultado === option && styles.radioCircleSelected
                    ]}>
                      {selectedResultado === option && <ThemedView style={styles.radioInner} />}
                    </ThemedView>
                    <ThemedText style={styles.radioLabel}>{option}</ThemedText>
                  </TouchableOpacity>
                ))}
              </ThemedView>
            </ThemedView>

            {/* Adjuntar imagen */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Adjuntar imagen (opcional):</ThemedText>
              <TouchableOpacity
                style={styles.cameraButton}
                onPress={openCamera}
              >
                <Ionicons name="camera" size={20} color="#000000" />
                <ThemedText style={styles.cameraButtonText}>Tomar foto</ThemedText>
              </TouchableOpacity>
              {trainingImageBase64 && (
                <ThemedView style={styles.previewContainer}>
                  <ThemedText style={styles.previewTitle}>Imagen capturada:</ThemedText>
                  <Image
                    source={{ uri: trainingImageBase64 }}
                    style={styles.imagePreview}
                    resizeMode="contain"
                  />
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() => setTrainingImageBase64(null)}
                  >
                    <Ionicons name="trash" size={20} color="#000000" />
                    <ThemedText style={styles.removeImageText}>Eliminar imagen</ThemedText>
                  </TouchableOpacity>
                </ThemedView>
              )}
            </ThemedView>

            {/* Observaciones */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Observaciones:</ThemedText>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                defaultValue={observacionesRef.current}
                onChangeText={(text) => { observacionesRef.current = text; }}
                placeholder="Observaciones"
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
                key={`observaciones-${formKey}`}
              />
            </ThemedView>

            {/* Nombre Responsable */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Nombre del responsable de la capacitación:</ThemedText>
              <TextInput
                style={styles.formInput}
                defaultValue={nombreResponsableRef.current}
                onChangeText={(text) => { nombreResponsableRef.current = text; }}
                placeholder="Nombre del responsable"
                placeholderTextColor="#999"
                key={`nombre-responsable-${formKey}`}
              />
            </ThemedView>

            {/* Cédula Responsable */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Cédula del responsable de la capacitación:</ThemedText>
              <TextInput
                style={styles.formInput}
                defaultValue={cedulaResponsableRef.current}
                onChangeText={(text) => { cedulaResponsableRef.current = text; }}
                placeholder="Cédula del responsable"
                placeholderTextColor="#999"
                key={`cedula-responsable-${formKey}`}
              />
            </ThemedView>

            {/* Firma Responsable */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Firma del responsable *:</ThemedText>
              {!firmaResponsable ? (
                <ThemedView style={styles.signatureButtons}>
                  <TouchableOpacity
                    style={styles.signatureButton}
                    onPress={generateSignature}
                    disabled={isGeneratingFirma}
                  >
                    {isGeneratingFirma ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        {getActionIcon('signature')}
                        <ThemedText style={styles.signatureButtonText}>Generar</ThemedText>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.signatureButton}
                    onPress={handleScanQR}
                  >
                    {getActionIcon('qr')}
                    <ThemedText style={styles.signatureButtonText}>Escanear QR</ThemedText>
                  </TouchableOpacity>
                </ThemedView>
              ) : (
                <ThemedView style={styles.signatureInfo}>
                  <ThemedText style={styles.signatureInfoTitle}>Información de la firma:</ThemedText>
                  <ThemedText style={styles.signatureInfoText}>ID de sesión: {firmaResponsable.sessionId}</ThemedText>
                  <ThemedText style={styles.signatureInfoText}>ID del empleado: {firmaResponsable.empleadoId}</ThemedText>
                  {firmaResponsable.empleadoDetalle && (
                    <ThemedView style={styles.signatureInfoDetail}>
                      <ThemedText style={styles.signatureInfoDetailText}>
                        {firmaResponsable.empleadoDetalle.nombre} {firmaResponsable.empleadoDetalle.primer_apellido} {firmaResponsable.empleadoDetalle.segundo_apellido} ({firmaResponsable.empleadoDetalle.cedula_empleado})
                      </ThemedText>
                    </ThemedView>
                  )}
                  <ThemedText style={styles.signatureInfoText}>Latitud: {firmaResponsable.latitud}</ThemedText>
                  <ThemedText style={styles.signatureInfoText}>Longitud: {firmaResponsable.longitud}</ThemedText>
                  <ThemedText style={styles.signatureInfoText}>Hora actual: {generateDateTime(firmaResponsable.timestamp)}</ThemedText>
                  <TouchableOpacity
                    style={styles.clearSignatureButton}
                    onPress={() => setFirmaResponsable(null)}
                  >
                    <ThemedText style={styles.clearSignatureText}>{getActionIcon('clear')}</ThemedText>
                  </TouchableOpacity>
                </ThemedView>
              )}
            </ThemedView>

            {/* Form Actions */}
            <ThemedView style={styles.formActions}>
              <TouchableOpacity
                style={[styles.formButton, styles.cancelButton]}
                onPress={cancelCreating}
              >
                <ThemedText style={styles.formButtonText}>
                  {getActionIcon('cancel')}
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.formButton, styles.confirmButton]}
                onPress={createTraining}
              >
                <ThemedText style={styles.formButtonText}>
                  {getActionIcon('confirm')}
                </ThemedText>
              </TouchableOpacity>
            </ThemedView>
          </ThemedView>
        )}

        {/* Trainings List */}
        {!isCreating && (
          <ThemedView style={styles.listContainer}>
            {filteredTrainings.length === 0 ? (
              <ThemedText style={styles.emptyText}>
                {trainings.length === 0 
                  ? 'No hay capacitaciones registradas' 
                  : 'No hay capacitaciones que coincidan con los filtros'}
              </ThemedText>
            ) : (
              filteredTrainings.map((training, index) => {
                // Get decoded firma from Map
                const firmaData = decodedFirmas.get(training.id);

                // Crear una clave única para identificar el training
                const trainingKey = training.id !== 0 ? `training-${training.id}` : (training.id_local ? `training-${training.id_local}` : `training-${index}`);
                const isExpanded = expandedTrainings.has(trainingKey);

                return (
                  <ThemedView key={training.id !== 0 ? training.id : training.id_local || `training-${index}`} style={styles.trainingCard}>
                    {/* Datos visibles por defecto */}
                    <ThemedText style={styles.trainingDetail}>
                        <ThemedText style={styles.trainingLabel}>Título: </ThemedText>
                        <ThemedText style={styles.trainingValue}>{training.titulo}</ThemedText>
                    </ThemedText>
                    <ThemedText style={styles.trainingDetail}>
                        <ThemedText style={styles.trainingLabel}>Fecha: </ThemedText>
                        <ThemedText style={styles.trainingValue}>{training.fecha.split('T')[0]}</ThemedText>
                    </ThemedText> 

                    <ThemedText style={styles.trainingDetail}>
                      <ThemedText style={styles.trainingLabel}>Tipo: </ThemedText>
                      <ThemedText style={styles.trainingValue}>{training.tipo}</ThemedText>
                    </ThemedText>
                    {training.resultado && (
                      <ThemedText style={styles.trainingDetail}>
                        <ThemedText style={styles.trainingLabel}>Resultado: </ThemedText>
                        <ThemedText style={styles.trainingValue}>{training.resultado}</ThemedText>
                      </ThemedText>
                    )}

                    {/* Collapsable Button */}
                    <TouchableOpacity
                      style={styles.collapseButton}
                      onPress={() => toggleTrainingExpanded(trainingKey)}
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
                                            <ThemedText style={styles.trainingDetail}>
                      <ThemedText style={styles.trainingLabel}>Empresa: </ThemedText>
                      <ThemedText style={styles.trainingValue}>{training.empresa.nombre}</ThemedText>
                    </ThemedText>
                    <ThemedText style={styles.trainingDetail}>
                      <ThemedText style={styles.trainingLabel}>Cliente: </ThemedText>
                      <ThemedText style={styles.trainingValue}>{training.cliente.nombre}</ThemedText>
                    </ThemedText>
                    <ThemedText style={styles.trainingDetail}>
                      <ThemedText style={styles.trainingLabel}>Sucursal: </ThemedText>
                      <ThemedText style={styles.trainingValue}>{training.sucursal.nombre}</ThemedText>
                    </ThemedText>
                        <ThemedText style={styles.trainingDetail}>
                          <ThemedText style={styles.trainingLabel}>Descripción: </ThemedText>
                          <ThemedText style={styles.trainingValue}>{training.descripcion}</ThemedText>
                        </ThemedText>
                        {training.resultado && (
                          <ThemedText style={styles.trainingDetail}>
                            <ThemedText style={styles.trainingLabel}>Resultado: </ThemedText>
                            <ThemedText style={styles.trainingValue}>{training.resultado}</ThemedText>
                          </ThemedText>
                        )}
                        <ThemedText style={styles.trainingDetail}>
                          <ThemedText style={styles.trainingLabel}>Observaciones: </ThemedText>
                          <ThemedText style={styles.trainingValue}>{training.observaciones}</ThemedText>
                        </ThemedText>
                        <ThemedText style={styles.trainingDetail}>
                          <ThemedText style={styles.trainingLabel}>Responsable: </ThemedText>
                          <ThemedText style={styles.trainingValue}>{training.responsable.nombre} ({training.responsable.cedula})</ThemedText>
                        </ThemedText>
                        {firmaData && (
                          <ThemedView style={styles.signatureInfo}>
                            <ThemedText style={styles.signatureInfoTitle}>Firma:</ThemedText>
                            <ThemedText style={styles.signatureInfoText}>ID de sesión: {firmaData.sessionId}</ThemedText>
                            <ThemedText style={styles.signatureInfoText}>ID del empleado: {firmaData.empleadoId}</ThemedText>
                            {firmaData.empleadoDetalle && (
                              <ThemedView style={styles.signatureInfoDetail}>
                                <ThemedText style={styles.signatureInfoDetailText}>
                                  {firmaData.empleadoDetalle.nombre} {firmaData.empleadoDetalle.primer_apellido} {firmaData.empleadoDetalle.segundo_apellido}
                                </ThemedText>
                              </ThemedView>
                            )}
                            <ThemedText style={styles.signatureInfoText}>Latitud: {firmaData.latitud}</ThemedText>
                            <ThemedText style={styles.signatureInfoText}>Longitud: {firmaData.longitud}</ThemedText>
                            <ThemedText style={styles.signatureInfoText}>Hora: {generateDateTime(firmaData.timestamp)}</ThemedText>
                            {training.nombre_firma && (
                              <ThemedText style={styles.signatureInfoText}>Nombre: {training.nombre_firma}</ThemedText>
                            )}
                          </ThemedView>
                        )}
                        <ThemedView style={styles.detailSection}>
                          <ThemedText style={styles.detailSectionTitle}>Empleados:</ThemedText>
                          {training.empleados.map((emp) => (
                            <ThemedText key={emp.id} style={styles.detailItem}>
                              {emp.nombre} - {emp.cedula}
                            </ThemedText>
                          ))}
                        </ThemedView>
                        <ThemedView style={styles.detailSection}>
                          <ThemedText style={styles.detailSectionTitle}>Puestos:</ThemedText>
                          {training.puestos.map((puesto) => (
                            <ThemedText key={puesto.id} style={styles.detailItem}>
                              {puesto.nombre}
                            </ThemedText>
                          ))}
                        </ThemedView>
                        <ThemedView style={styles.detailSection}>
                          <ThemedText style={styles.detailSectionTitle}>Imagen adjunta:</ThemedText>
                          {training.id_local === '' ? (
                            <TrainingImageComponent trainingId={training.id} />
                          ) : (
                            training.base64_file && training.base64_file.trim() !== '' ? (
                              (() => {
                                // Asegurar formato correcto: data:image/jpeg;base64,<base64_string>
                                const base64Regex = /^data:(.+);base64,(.+)$/;
                                let imageUri = training.base64_file;
                                if (!base64Regex.test(imageUri)) {
                                  // Si no tiene el formato correcto, agregarlo
                                  if (imageUri.startsWith('data:image')) {
                                    // Ya tiene data:image pero puede que no tenga el formato exacto
                                    imageUri = imageUri;
                                  } else {
                                    // Agregar el prefijo completo
                                    imageUri = `data:image/jpeg;base64,${imageUri}`;
                                  }
                                }
                                return (
                                  <Image
                                    source={{ uri: imageUri }}
                                    style={styles.trainingImage}
                                    onError={(error) => {
                                      console.error('Error loading image:', error);
                                    }}
                                  />
                                );
                              })()
                            ) : (
                              <ThemedText style={styles.noImageText}>No hay imagen adjunta</ThemedText>
                            )
                          )}
                        </ThemedView>
                      </ThemedView>
                    )}
                  </ThemedView>
                );
              })
            )}
          </ThemedView>
        )}
      </ScrollView>

      {showFechaCapacitacionPicker && (
        <DateTimePicker
          value={fechaCapacitacion ? new Date(fechaCapacitacion) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleFechaCapacitacionChange}
        />
      )}

      {showFilterFechaPicker && (
        <DateTimePicker
          value={filterFecha ? new Date(filterFecha) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleFilterFechaChange}
        />
      )}

      <AppFooter />
      <SlideMenu
        isVisible={isMenuVisible}
        onClose={handleMenuClose}
        onHomePress={handleHomePress}
      />
      {QRScannerComponent}
      
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
          >
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
          </CameraView>
        </ThemedView>
      </Modal>
    </ThemedView>
  );
}

// Component to load training image from server
const TrainingImageComponent: React.FC<{ trainingId: number }> = ({ trainingId }) => {
  const [imageBase64, setImageBase64] = useState<string | null>(null);
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

        const response = await fetch(`${apiUrl}/api/training/${trainingId}/get-image`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'ngrok-skip-browser-warning': '69420',
          },
        });

        if (response.ok) {
          const blob = await response.blob();
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64data = reader.result as string;
            setImageBase64(base64data);
          };
          reader.readAsDataURL(blob);
        }
      } catch (error) {
        console.error('Error loading training image:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchImage();
  }, [trainingId]);

  if (isLoading) {
    return <ActivityIndicator size="small" color="#007AFF" />;
  }

  if (!imageBase64) {
    return <ThemedText style={styles.noImageText}>No hay imagen adjunta</ThemedText>;
  }

  return (
    <Image
      source={{ uri: imageBase64 }}
      style={styles.trainingImage}
      onError={(error) => {
        console.error('Error loading image:', error);
      }}
    />
  );
};

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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
  },
  createButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
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
    marginBottom: 20,
    color: '#000000',
  },
  formGroup: {
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#000000',
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    color: '#000000',
  },
  textArea: {
    minHeight: 100,
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
    width: '100%',
    height: 50,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#000000',
  },
  radioGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#fff',
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
    marginBottom: 10,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#007AFF',
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  radioCircleSelected: {
    backgroundColor: '#fff',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#007AFF',
  },
  radioLabel: {
    fontSize: 16,
    color: '#000000',
  },
  signatureButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    backgroundColor: '#fff',
  },
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
  signatureButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  signatureInfo: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  signatureInfoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000000',
  },
  signatureInfoText: {
    fontSize: 14,
    marginBottom: 4,
    color: '#000000',
  },
  signatureInfoDetailText: {
    fontSize: 12,
    color: '#000000',
  },
  signatureInfoDetail: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#BDE4FF',
    borderRadius: 8,
    marginBottom: 4,
  },
  clearSignatureButton: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#FF3B30',
    borderRadius: 6,
    alignItems: 'center',
    width: '100%',
  },
  clearSignatureText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 10,
    backgroundColor: '#fff',
  },
  formButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
    marginLeft: 8,
  },
  listContainer: {
    
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
  filtersContainer: {
    width: '100%',
    marginBottom: 16,
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
  clearDateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  clearDateText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF3B30',
  },
  trainingCard: {
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
  trainingTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#007AFF',
  },
  trainingDetail: {
    fontSize: 14,
    marginBottom: 8,
    color: '#000000',
  },
  trainingLabel: {
    fontWeight: '600',
    color: '#000000',
  },
  trainingValue: {
    fontSize: 12,
    color: '#000000',
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#999',
    marginTop: 40,
  },
  collapseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    marginTop: 8,
    backgroundColor: '#FAFAFA',
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
    marginTop: 8,
  },
  addButton: {
    backgroundColor: '#34C759',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  selectedList: {
    marginTop: 12,
    gap: 8,
    backgroundColor: '#fff',
  },
  selectedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  selectedItemText: {
    fontSize: 14,
    color: '#000000',
    flex: 1,
  },
  cameraButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  cameraButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  previewContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 12,
  },
  removeImageButton: {
    backgroundColor: '#FF3B30',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
  },
  removeImageText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
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
  trainingImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginTop: 8,
  },
  noImageText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 8,
  },
  detailSection: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  detailSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000000',
  },
  detailItem: {
    fontSize: 14,
    color: '#000000',
    marginBottom: 4,
    paddingLeft: 8,
  },
});

