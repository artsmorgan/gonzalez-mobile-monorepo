import React, { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
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
import { useQRScanner } from '@/hooks/useQRScanner';
import { Picker } from '@react-native-picker/picker';
import * as Location from 'expo-location';
import { jwtDecode } from 'jwt-decode';
import getHoraAccion from '@/hooks/getHoraAccion';
import {
  createAttendanceControl,
  updateAttendanceControl,
  deleteAttendanceControl,
  listAttendanceControlByCorpo,
} from '@/hooks/evaluationFunctions';
import { eventBus } from '@/hooks/eventBus';

type AttendanceControlScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'AttendanceControl'>;

interface QRInfo {
  sessionId: string;
  empleadoId: string;
  latitud: string;
  longitud: string;
  timestamp: string;
  empleadoDetalle?: {
    nombre: string;
    primer_apellido: string;
    segundo_apellido: string;
    cedula_empleado?: string;
  };
}

interface Colaborador {
  empleado_id: number | null;
  nombre_colaborador: string;
  cedula: string;
  firma_comentario: string; // base64 del QR
  firma_comentario_info: QRInfo | null; // Información decodificada del QR
  entrada: string;
  salida: string;
  sustituto_id: number | null;
  nombre_sustituto: string;
  cedula_sustituto: string;
  firma_sustituto: string; // base64 del QR
  firma_sustituto_info: QRInfo | null; // Información decodificada del QR
}

interface AttendanceControl {
  id: string;
  id_local: string;
  cliente: string | null;
  fecha: string | null;
  turno: string | null;
  area_piso: string | null;
  total_presentes: string | null;
  fijos: string | null;
  colaboradores: string | null;
  firma_responsable?: string | null;
  created_at: string;
  synced?: boolean;
}

interface EditingAttendanceControl {
  id: string | null;
  id_local: string;
  fecha: string;
  turno: string;
  area_piso: string;
  total_presentes: string;
  fijos: string;
  colaboradores: Colaborador[];
  firma_responsable: string;
}

const TURNO_OPTIONS = [
  { label: 'Seleccionar turno', value: '' },
  { label: 'Diurno', value: 'DIURNO' },
  { label: 'Mixto', value: 'MIXTO' },
  { label: 'Nocturno', value: 'NOCTURNO' },
];

type EmpleadoOption = { id: number; nombre: string; cedula: string };

const EMPLEADOS_CORPO_CACHE_KEY = (corpoId: string) => `empleados_corpo_cache_${corpoId}`;

export default function AttendanceControlScreen() {
  const { employee, refreshAccessToken, logout } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<AttendanceControlScreenNavigationProp>();
  const { scanQR, QRScannerComponent } = useQRScanner();

  // Data states
  const [controls, setControls] = useState<AttendanceControl[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasCurrentMarca, setHasCurrentMarca] = useState<boolean>(false);
  const [marcaClienteName, setMarcaClienteName] = useState<string>('');
  const [marcaCorpoName, setMarcaCorpoName] = useState<string>('');
  const [corpoIdStr, setCorpoIdStr] = useState<string>('');
  const [empleadosOptions, setEmpleadosOptions] = useState<EmpleadoOption[]>([]);

  // Firma responsable (similar a TrainingsScreen)
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [isGeneratingFirmaResponsable, setIsGeneratingFirmaResponsable] = useState(false);
  const [firmaResponsable, setFirmaResponsable] = useState<QRInfo | null>(null);
  const [firmaResponsableHash, setFirmaResponsableHash] = useState<string>('');

  // Editing state
  const [editingRecord, setEditingRecord] = useState<EditingAttendanceControl | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form states
  const [fecha, setFecha] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [turno, setTurno] = useState('');
  const [areaPiso, setAreaPiso] = useState('');
  const [totalPresentes, setTotalPresentes] = useState('');
  const [fijos, setFijos] = useState('');
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);

  // Time pickers for colaboradores
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerValue, setTimePickerValue] = useState<Date>(new Date());
  const [timePickerTarget, setTimePickerTarget] = useState<{ index: number; field: 'entrada' | 'salida' } | null>(null);

  // Expanded states
  const [expandedColaboradorIndices, setExpandedColaboradorIndices] = useState<number[]>([]);

  // QR scanning state
  const [currentQRType, setCurrentQRType] = useState<{ index: number; type: 'firma_comentario' | 'firma_sustituto' } | null>(null);

  const getConnectionStatus = async (): Promise<boolean> => {
    const networkState = await Network.getNetworkStateAsync();
    return networkState.isConnected && networkState.isInternetReachable ? true : false;
  };

  const generateRandomId = (): string => {
    return `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const formatDate = (date: Date): string => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatTime = (date: Date): string => {
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  const parseTimeToDate = (time: string): Date => {
    const now = new Date();
    const parts = String(time || '').split(':');
    if (parts.length === 2) {
      const hh = parseInt(parts[0], 10);
      const mm = parseInt(parts[1], 10);
      if (!Number.isNaN(hh) && !Number.isNaN(mm)) {
        now.setHours(hh, mm, 0, 0);
        return now;
      }
    }
    now.setHours(0, 0, 0, 0);
    return now;
  };

  const normalizeControl = (raw: any): AttendanceControl => {
    const clienteName = raw?.cliente ?? raw?.nombre_cliente ?? null;
    return {
      ...raw,
      cliente: clienteName,
      total_presentes: raw?.total_presentes !== null && raw?.total_presentes !== undefined ? String(raw.total_presentes) : null,
      fijos: raw?.fijos !== null && raw?.fijos !== undefined ? String(raw.fijos) : null,
    } as AttendanceControl;
  };

  const parseFechaToDate = (value: any): Date => {
    if (!value) return new Date();
    if (typeof value === 'string' && value.includes('/')) {
      const parts = value.split('/');
      if (parts.length === 3) {
        const dd = parseInt(parts[0], 10);
        const mm = parseInt(parts[1], 10);
        const yyyy = parseInt(parts[2], 10);
        if (!Number.isNaN(dd) && !Number.isNaN(mm) && !Number.isNaN(yyyy)) {
          return new Date(yyyy, mm - 1, dd);
        }
      }
    }
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  };

  const fetchControls = useCallback(async () => {
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
      const corpoId = currentMarcaData.corpo?.id?.toString();
      setCorpoIdStr(corpoId || '');
      setMarcaClienteName(currentMarcaData?.cliente?.nombre || '');
      setMarcaCorpoName(currentMarcaData?.corpo?.nombre || '');

      if (!corpoId) {
        setError('No se encontró el ID del corpo');
        setIsLoading(false);
        return;
      }

      const isConnected = await getConnectionStatus();

      if (isConnected) {
        const result = await listAttendanceControlByCorpo({
          corpo_id: corpoId,
          refreshAccessToken,
          logout,
        });

        if (result.status && result.data) {
          const normalized = Array.isArray(result.data) ? (result.data as any[]).map(normalizeControl) : [];
          setControls(normalized);
        } else {
          setControls([]);
        }
      } else {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const controlsCache = cache.filter((item: any) => item.type === 'attendance_control');
          const normalized = Array.isArray(controlsCache) ? controlsCache.map(normalizeControl) : [];
          setControls(normalized);
        } else {
          setControls([]);
        }
      }
    } catch (err) {
      console.error('Error fetching controls:', err);
      setError('Error al cargar los controles de asistencia');
      try {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const controlsCache = cache.filter((item: any) => item.type === 'attendance_control');
          setControls(controlsCache);
        }
      } catch (cacheErr) {
        console.error('Error loading from cache:', cacheErr);
      }
    } finally {
      setIsLoading(false);
    }
  }, [refreshAccessToken, logout]);

  const fetchEmpleadosByCorpo = useCallback(async (corpoId: string) => {
    if (!corpoId) return;
    try {
      const hasConnection = await getConnectionStatus();
      const cacheKey = EMPLEADOS_CORPO_CACHE_KEY(corpoId);

      if (!hasConnection) {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) setEmpleadosOptions(parsed);
        }
        return;
      }

      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) return;

      let token = await AsyncStorage.getItem('access_token');
      if (!token) {
        const refreshed = await refreshAccessToken();
        if (!refreshed) return;
        token = await AsyncStorage.getItem('access_token');
      }
      if (!token) return;

      const resp = await fetch(`${apiUrl}/api/empleados/corpo/${corpoId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '69420',
        },
      });

      const data = await resp.json().catch(() => null);
      if (resp.ok && data?.status && Array.isArray(data.empleados)) {
        const mapped: EmpleadoOption[] = data.empleados.map((e: any) => ({
          id: Number(e.id),
          nombre: String(e.nombre || ''),
          cedula: String(e.cedula || ''),
        }));
        setEmpleadosOptions(mapped);
        await AsyncStorage.setItem(cacheKey, JSON.stringify(mapped));
      }
    } catch (e) {
      console.error('Error fetching empleados by corpo:', e);
    }
  }, [refreshAccessToken]);

  useEffect(() => {
    if (corpoIdStr) {
      fetchEmpleadosByCorpo(corpoIdStr);
    }
  }, [corpoIdStr, fetchEmpleadosByCorpo]);

  useFocusEffect(
    useCallback(() => {
      fetchControls();
      eventBus.on('connectionRestored', fetchControls);
      return () => {
        eventBus.off('connectionRestored', fetchControls);
      };
    }, [fetchControls])
  );

  const resetForm = () => {
    setFecha(new Date());
    setTurno('');
    setAreaPiso('');
    setTotalPresentes('');
    setFijos('');
    setColaboradores([]);
    setExpandedColaboradorIndices([]);
    setFirmaResponsable(null);
    setFirmaResponsableHash('');
  };

  const startCreating = () => {
    setIsCreating(true);
    setEditingRecord(null);
    resetForm();

    // Request location permissions (firma)
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Error', 'Se necesita permiso de ubicación para generar la firma');
          return;
        }
        const currentLocation = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
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

  const startEditing = async (record: AttendanceControl) => {
    setIsCreating(false);
    let colaboradoresArray: Colaborador[] = [];

    if (record.colaboradores) {
      try {
        colaboradoresArray = JSON.parse(record.colaboradores);
        if (!Array.isArray(colaboradoresArray)) colaboradoresArray = [];
        
        // Decodificar los QR guardados para mostrar la información
        colaboradoresArray = await Promise.all(colaboradoresArray.map(async (colab: any) => {
          const decoded: Colaborador = {
            empleado_id: typeof colab.empleado_id === 'number' ? colab.empleado_id : null,
            nombre_colaborador: colab.nombre_colaborador || '',
            cedula: colab.cedula || '',
            firma_comentario: colab.firma_comentario || '',
            firma_comentario_info: null,
            entrada: colab.entrada || '',
            salida: colab.salida || '',
            sustituto_id: typeof colab.sustituto_id === 'number' ? colab.sustituto_id : null,
            nombre_sustituto: colab.nombre_sustituto || '',
            cedula_sustituto: colab.cedula_sustituto || '',
            firma_sustituto: colab.firma_sustituto || '',
            firma_sustituto_info: null,
          };

          // Decodificar firma_comentario si existe
          if (colab.firma_comentario) {
            try {
              const decodedData = atob(colab.firma_comentario);
              const parts = decodedData.split(':');
              if (parts.length === 5) {
                const [sessionId, empleadoId, latitud, longitud, timestamp] = parts;
                let empleadoDetalle = undefined;
                const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
                const token = await AsyncStorage.getItem('access_token');
                
                if (apiUrl && token) {
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
                      };
                    }
                  } catch (err) {
                    console.error('Error fetching empleado details:', err);
                  }
                }

                decoded.firma_comentario_info = {
                  sessionId,
                  empleadoId,
                  latitud,
                  longitud,
                  timestamp,
                  empleadoDetalle,
                };
              }
            } catch (e) {
              console.error('Error decoding firma_comentario:', e);
            }
          }

          // Decodificar firma_sustituto si existe
          if (colab.firma_sustituto) {
            try {
              const decodedData = atob(colab.firma_sustituto);
              const parts = decodedData.split(':');
              if (parts.length === 5) {
                const [sessionId, empleadoId, latitud, longitud, timestamp] = parts;
                let empleadoDetalle = undefined;
                const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
                const token = await AsyncStorage.getItem('access_token');
                
                if (apiUrl && token) {
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
                      };
                    }
                  } catch (err) {
                    console.error('Error fetching empleado details:', err);
                  }
                }

                decoded.firma_sustituto_info = {
                  sessionId,
                  empleadoId,
                  latitud,
                  longitud,
                  timestamp,
                  empleadoDetalle,
                };
              }
            } catch (e) {
              console.error('Error decoding firma_sustituto:', e);
            }
          }

          return decoded;
        }));
      } catch (e) {
        colaboradoresArray = [];
      }
    }

    setEditingRecord({
      id: record.id,
      id_local: record.id_local,
      fecha: record.fecha || '',
      turno: record.turno || '',
      area_piso: record.area_piso || '',
      total_presentes: record.total_presentes !== null && record.total_presentes !== undefined ? String(record.total_presentes) : '',
      fijos: record.fijos !== null && record.fijos !== undefined ? String(record.fijos) : '',
      colaboradores: colaboradoresArray,
      firma_responsable: record.firma_responsable || '',
    });

    setFecha(parseFechaToDate(record.fecha));
    setTurno(record.turno || '');
    setAreaPiso(record.area_piso || '');
    setTotalPresentes(record.total_presentes !== null && record.total_presentes !== undefined ? String(record.total_presentes) : '');
    setFijos(record.fijos !== null && record.fijos !== undefined ? String(record.fijos) : '');
    setColaboradores(colaboradoresArray);
    setExpandedColaboradorIndices(colaboradoresArray.map((_, i) => i));

    // Cargar firma responsable si existe
    if (record.firma_responsable) {
      try {
        const decodedData = atob(String(record.firma_responsable));
        const parts = decodedData.split(':');
        if (parts.length === 5) {
          const [sessionId, empleadoId, latitud, longitud, timestamp] = parts;
          setFirmaResponsableHash(String(record.firma_responsable));
          setFirmaResponsable({
            sessionId,
            empleadoId,
            latitud,
            longitud,
            timestamp,
            empleadoDetalle: undefined,
          });
        } else {
          setFirmaResponsableHash('');
          setFirmaResponsable(null);
        }
      } catch {
        setFirmaResponsableHash('');
        setFirmaResponsable(null);
      }
    } else {
      setFirmaResponsableHash('');
      setFirmaResponsable(null);
    }

    // Ensure location for firma on edit
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const currentLocation = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setLocation(currentLocation);
      } catch (error) {
        console.error('Error getting location:', error);
      }
    })();
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

  const addColaborador = () => {
    const newColaborador: Colaborador = {
      empleado_id: null,
      nombre_colaborador: '',
      cedula: '',
      firma_comentario: '',
      firma_comentario_info: null,
      entrada: '',
      salida: '',
      sustituto_id: null,
      nombre_sustituto: '',
      cedula_sustituto: '',
      firma_sustituto: '',
      firma_sustituto_info: null,
    };
    setColaboradores([...colaboradores, newColaborador]);
    setExpandedColaboradorIndices([...expandedColaboradorIndices, colaboradores.length]);
  };

  const openTimePicker = (index: number, field: 'entrada' | 'salida') => {
    setTimePickerTarget({ index, field });
    const current = colaboradores[index]?.[field] || '';
    setTimePickerValue(parseTimeToDate(current));
    setShowTimePicker(true);
  };

  const handleTimeChange = (_event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    if (!selectedDate || !timePickerTarget) return;

    const { index, field } = timePickerTarget;
    updateColaborador(index, field, formatTime(selectedDate));
    setTimePickerValue(selectedDate);
  };

  const updateColaborador = (index: number, field: keyof Colaborador, value: string | boolean) => {
    const newColaboradores = [...colaboradores];
    newColaboradores[index] = {
      ...newColaboradores[index],
      [field]: value,
    };
    setColaboradores(newColaboradores);
  };

  const removeColaborador = (index: number) => {
    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas eliminar este colaborador?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            setColaboradores(colaboradores.filter((_, i) => i !== index));
            setExpandedColaboradorIndices(expandedColaboradorIndices.filter(i => i !== index).map(i => i > index ? i - 1 : i));
          },
        },
      ]
    );
  };

  const toggleColaboradorExpansion = (index: number) => {
    setExpandedColaboradorIndices(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const handleScanQR = async (index: number, type: 'firma_comentario' | 'firma_sustituto') => {
    try {
      setCurrentQRType({ index, type });
      const qrData = await scanQR();
      
      if (!qrData) {
        setCurrentQRType(null);
        return;
      }

      // Decodificar el QR para obtener la información
      let qrInfo: QRInfo | null = null;
      try {
        const decodedData = atob(qrData);
        const parts = decodedData.split(':');
        
        if (parts.length === 5) {
          const [sessionId, empleadoId, latitud, longitud, timestamp] = parts;

          // Intentar obtener detalles del empleado
          let empleadoDetalle = undefined;
          const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
          const token = await AsyncStorage.getItem('access_token');
          
          if (apiUrl && token) {
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
                };
              }
            } catch (err) {
              console.error('Error fetching empleado details:', err);
            }
          }

          qrInfo = {
            sessionId,
            empleadoId,
            latitud,
            longitud,
            timestamp,
            empleadoDetalle,
          };
        }
      } catch (decodeError) {
        console.error('Error decoding QR:', decodeError);
        Alert.alert('Error', 'El QR escaneado no tiene el formato correcto');
        setCurrentQRType(null);
        return;
      }

      // Guardar el QR en base64 y la información decodificada
      const newColaboradores = [...colaboradores];
      const infoField = type === 'firma_comentario' ? 'firma_comentario_info' : 'firma_sustituto_info';
      newColaboradores[index] = {
        ...newColaboradores[index],
        [type]: qrData, // El QR en base64
        [infoField]: qrInfo, // La información decodificada
      };
      setColaboradores(newColaboradores);
      setCurrentQRType(null);
    } catch (error) {
      console.error('Error scanning QR:', error);
      Alert.alert('Error', 'No se pudo escanear el código QR');
      setCurrentQRType(null);
    }
  };

  const generateSignatureResponsable = async () => {
    try {
      if (!employee) {
        Alert.alert('Error', 'No se pudo obtener la información del empleado');
        return;
      }

      if (!location) {
        Alert.alert('Error', 'No se pudo obtener la ubicación');
        return;
      }

      setIsGeneratingFirmaResponsable(true);

      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) throw new Error('Server URL not configured');

      const token = await AsyncStorage.getItem('access_token');
      if (!token) throw new Error('No authentication token found');

      const decodedToken = jwtDecode(token);
      const sessionId = JSON.parse(JSON.stringify(decodedToken)).sessionId;

      const horaAccion = await getHoraAccion();
      if (!horaAccion) throw new Error('Hora de acción not found');

      const hash = btoa(sessionId + ':' + employee.id + ':' + location.coords.latitude + ':' + location.coords.longitude + ':' + horaAccion);
      setFirmaResponsableHash(hash);

      const decodedHash = atob(hash);
      const [decodedSessionId, decodedEmpleadoId, decodedLatitud, decodedLongitud, decodedTimestamp] = decodedHash.split(':');

      // Fetch empleado details si hay internet
      const connectionStatus = await getConnectionStatus();
      let empleadoDetalle = undefined;
      if (connectionStatus) {
        try {
          const empleadoResponse = await fetch(`${apiUrl}/api/empleados/${decodedEmpleadoId}`, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
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
        } catch (e) {
          console.error('Error fetching empleado details for firma responsable:', e);
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
    } catch (e) {
      console.error('Error generating firma responsable:', e);
      Alert.alert('Error', 'No se pudo generar la firma digital');
    } finally {
      setIsGeneratingFirmaResponsable(false);
    }
  };

  const handleScanQRResponsable = async () => {
    try {
      const qrData = await scanQR();
      if (!qrData) return;

      const decodedHash = atob(qrData);
      const parts = decodedHash.split(':');
      if (parts.length !== 5) {
        Alert.alert('Error', 'El QR no tiene la estructura esperada');
        return;
      }

      const [sessionId, empleadoId, latitud, longitud, timestamp] = parts;
      setFirmaResponsableHash(qrData);

      const connectionStatus = await getConnectionStatus();
      let empleadoDetalle = undefined;
      if (connectionStatus) {
        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) throw new Error('Server URL not configured');

        const token = await AsyncStorage.getItem('access_token');
        if (!token) throw new Error('No authentication token found');

        const empleadoResponse = await fetch(`${apiUrl}/api/empleados/${empleadoId}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
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
      console.error('Error scanning QR responsable:', error);
      Alert.alert('Error', 'No se pudo escanear el código QR');
    }
  };

  const saveControlHandler = async () => {
    const currentMarca = await AsyncStorage.getItem('current_marca');
    if (!currentMarca) {
      Alert.alert('Error', 'No se encontró la marca actual');
      return;
    }

    const currentMarcaData = JSON.parse(currentMarca);

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas guardar este control de asistencia?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              // Preparar colaboradores para guardar (sin la información decodificada)
              const colaboradoresToSave = colaboradores.map((colab) => ({
                empleado_id: colab.empleado_id,
                nombre_colaborador: colab.nombre_colaborador,
                cedula: colab.cedula,
                firma_comentario: colab.firma_comentario,
                entrada: colab.entrada,
                salida: colab.salida,
                sustituto_id: colab.sustituto_id,
                nombre_sustituto: colab.nombre_sustituto,
                cedula_sustituto: colab.cedula_sustituto,
                firma_sustituto: colab.firma_sustituto,
              }));

              if (!firmaResponsableHash) {
                Alert.alert('Error', 'Debes generar la firma del responsable antes de guardar');
                return;
              }

              const requestData = {
                marca_id: currentMarcaData.id,
                cliente: (currentMarcaData?.cliente?.nombre || '').trim() || null,
                fecha: formatDate(fecha) || null,
                turno: turno.trim() || null,
                area_piso: areaPiso.trim() || null,
                total_presentes: totalPresentes.trim() || null,
                fijos: fijos.trim() || null,
                colaboradores: colaboradoresToSave.length > 0 ? JSON.stringify(colaboradoresToSave) : null,
                firma_responsable: firmaResponsableHash,
              };

              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await createAttendanceControl({
                  requestData,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Control de asistencia guardado correctamente');
                  cancelCreating();
                  fetchControls();
                } else {
                  Alert.alert('Error', result.message || 'Error al guardar el control de asistencia');
                }
              } else {
                const localId = generateRandomId();

                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: localId,
                  action: 'create',
                  type: 'attendance_control',
                  payload: requestData,
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                const cache = cacheStr ? JSON.parse(cacheStr) : [];

                const newRecordCache: AttendanceControl = {
                  id: '',
                  id_local: localId,
                  cliente: (currentMarcaData?.cliente?.nombre || '').trim() || null,
                  fecha: formatDate(fecha) || null,
                  turno: turno.trim() || null,
                  area_piso: areaPiso.trim() || null,
                  total_presentes: totalPresentes.trim() || null,
                  fijos: fijos.trim() || null,
                  colaboradores: colaboradoresToSave.length > 0 ? JSON.stringify(colaboradoresToSave) : null,
                  firma_responsable: firmaResponsableHash,
                  created_at: new Date().toISOString(),
                  synced: false,
                };

                cache.push({ ...newRecordCache, type: 'attendance_control' });
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(cache));

                Alert.alert('Modo Offline', 'Control de asistencia registrado localmente. Se sincronizará cuando haya conexión.');
                cancelCreating();
                fetchControls();
              }
            } catch (err) {
              console.error('Error saving control:', err);
              Alert.alert('Error', 'No se pudo guardar el control de asistencia');
            }
          },
        },
      ]
    );
  };

  const updateControlHandler = async () => {
    if (!editingRecord) return;

    const recordId = editingRecord.id || editingRecord.id_local;
    if (!recordId) {
      Alert.alert('Error', 'ID de registro no encontrado para actualizar');
      return;
    }

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas actualizar este control de asistencia?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              // Preparar colaboradores para guardar (sin la información decodificada)
              const colaboradoresToSave = colaboradores.map((colab) => ({
                empleado_id: colab.empleado_id,
                nombre_colaborador: colab.nombre_colaborador,
                cedula: colab.cedula,
                firma_comentario: colab.firma_comentario,
                entrada: colab.entrada,
                salida: colab.salida,
                sustituto_id: colab.sustituto_id,
                nombre_sustituto: colab.nombre_sustituto,
                cedula_sustituto: colab.cedula_sustituto,
                firma_sustituto: colab.firma_sustituto,
              }));

              if (!firmaResponsableHash) {
                Alert.alert('Error', 'Debes generar la firma del responsable antes de actualizar');
                return;
              }

              const requestData = {
                // Cliente ahora es de lectura (current_marca)
                cliente: marcaClienteName.trim() || null,
                fecha: formatDate(fecha) || null,
                turno: turno.trim() || null,
                area_piso: areaPiso.trim() || null,
                total_presentes: totalPresentes.trim() || null,
                fijos: fijos.trim() || null,
                colaboradores: colaboradoresToSave.length > 0 ? JSON.stringify(colaboradoresToSave) : null,
                firma_responsable: firmaResponsableHash,
              };

              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await updateAttendanceControl({
                  id: recordId,
                  requestData,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Control de asistencia actualizado correctamente');
                  cancelEditing();
                  fetchControls();
                } else {
                  Alert.alert('Error', result.message || 'Error al actualizar el control de asistencia');
                }
              } else {
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: recordId,
                  action: 'update',
                  type: 'attendance_control',
                  payload: requestData,
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                if (cacheStr) {
                  const cache = JSON.parse(cacheStr);
                  const updatedCache = cache.map((item: any) => {
                    if ((item.id === recordId || item.id_local === recordId) && item.type === 'attendance_control') {
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

                Alert.alert('Modo Offline', 'Control de asistencia actualizado localmente. Se sincronizará cuando haya conexión.');
                cancelEditing();
                fetchControls();
              }
            } catch (err) {
              console.error('Error updating control:', err);
              Alert.alert('Error', 'No se pudo actualizar el control de asistencia');
            }
          },
        },
      ]
    );
  };

  const deleteControlHandler = async (record: AttendanceControl) => {
    const recordId = record.id || record.id_local;
    if (!recordId) {
      Alert.alert('Error', 'ID de registro no encontrado para eliminar');
      return;
    }

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas eliminar este control de asistencia?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await deleteAttendanceControl({
                  id: recordId,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Control de asistencia eliminado correctamente');
                  fetchControls();
                } else {
                  Alert.alert('Error', result.message || 'Error al eliminar el control de asistencia');
                }
              } else {
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: recordId,
                  action: 'delete',
                  type: 'attendance_control',
                  payload: {},
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                if (cacheStr) {
                  const cache = JSON.parse(cacheStr);
                  const updatedCache = cache.filter((item: any) => !((item.id === recordId || item.id_local === recordId) && item.type === 'attendance_control'));
                  await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                }

                Alert.alert('Modo Offline', 'Control de asistencia marcado para eliminación localmente. Se sincronizará cuando haya conexión.');
                fetchControls();
              }
            } catch (err) {
              console.error('Error deleting control:', err);
              Alert.alert('Error', 'No se pudo eliminar el control de asistencia');
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
      case 'attendance': return <Ionicons name="people" size={24} color='#000000' />;
      case 'add': return <Ionicons name="add" size={24} color='#FFFFFF' />;
      case 'cancel': return <Ionicons name="close" size={24} color='#FFFFFF' />;
      case 'confirm': return <Ionicons name="checkmark" size={24} color='#FFFFFF' />;
      case 'delete': return <Ionicons name="trash" size={24} color='#FFFFFF' />;
      case 'edit': return <Ionicons name="pencil" size={20} color="#FFFFFF" />;
      case 'qr': return <Ionicons name="qr-code" size={20} color="#007AFF" />;
      case 'qr-responsable': return <Ionicons name="qr-code" size={20} color="#FFFFFF" />;
      case 'signature': return <Ionicons name="finger-print" size={24} color="#FFFFFF" />;
      default: return <Ionicons name="people" size={24} color='#000000' />;
    }
  };

  const renderControlList = () => {
    if (isLoading) {
      return (
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Cargando controles de asistencia...</ThemedText>
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

    if (controls.length === 0) {
      return (
        <ThemedView style={styles.emptyContainer}>
          <ThemedText style={styles.emptyText}>No hay controles de asistencia registrados.</ThemedText>
        </ThemedView>
      );
    }

    return (
      <ThemedView style={styles.listContainer}>
        {controls.map((record) => {
          let colaboradoresArray: Colaborador[] = [];
          if (record.colaboradores) {
            try {
              colaboradoresArray = JSON.parse(record.colaboradores);
            } catch (e) {
              colaboradoresArray = [];
            }
          }

          return (
            <ThemedView key={record.id || record.id_local} style={styles.listItem}>
              <ThemedView style={styles.listItemHeader}>
                <ThemedView style={styles.listItemContent}>
                  <ThemedText style={styles.listItemTitle}>
                    {record.fecha ? record.fecha.split('T')[0] : 'N/A'}
                  </ThemedText>
                  <ThemedText style={styles.listItemSubtitle}>
                    Cliente: {record.cliente || 'N/A'}
                  </ThemedText>
                  <ThemedText style={styles.listItemSubtitle}>
                    Área / Piso: {record.area_piso || 'N/A'}
                  </ThemedText>
                  <ThemedText style={styles.listItemSubtitle}>
                    Tipo de turno: {record.turno || 'N/A'}
                  </ThemedText>
                  <ThemedText style={styles.listItemSubtitle}>
                    Total Presentes: {record.total_presentes || 'N/A'}
                  </ThemedText>
                  <ThemedText style={styles.listItemSubtitle}>
                    Fijos: {record.fijos || 'N/A'}
                  </ThemedText>
                </ThemedView>
              </ThemedView>

              <ThemedView style={styles.listItemDetails}>
                <ThemedView style={styles.listItemButtons}>
                  <TouchableOpacity
                    style={[styles.listItemButton, styles.editButton]}
                    onPress={() => startEditing(record)}
                  >
                    {getActionIcon('edit')}
                    <ThemedText style={styles.listItemButtonText}>Editar</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.listItemButton, styles.deleteButton]}
                    onPress={() => deleteControlHandler(record)}
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

  const renderColaborador = (colaborador: Colaborador, index: number) => {
    const isExpanded = expandedColaboradorIndices.includes(index);

    return (
      <ThemedView key={index} style={styles.colaboradorItem}>
        <TouchableOpacity
          style={styles.colaboradorHeader}
          onPress={() => toggleColaboradorExpansion(index)}
        >
          <ThemedView style={styles.colaboradorHeaderContent}>
            <ThemedText style={styles.colaboradorHeaderText}>
              {colaborador.nombre_colaborador || 'Sin nombre'}
            </ThemedText>
          </ThemedView>
          <ThemedView style={styles.colaboradorHeaderActions}>
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                removeColaborador(index);
              }}
              style={styles.removeColaboradorButton}
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
          <ThemedView style={styles.colaboradorContent}>
            {/* Selector colaborador */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Colaborador</ThemedText>
              <ThemedView style={styles.pickerWrapper}>
                <Picker
                  selectedValue={colaborador.empleado_id ?? ''}
                  onValueChange={(value) => {
                    const idNum = value ? parseInt(String(value), 10) : null;
                    const emp = empleadosOptions.find((e) => e.id === idNum);
                    const newColaboradores = [...colaboradores];
                    newColaboradores[index] = {
                      ...newColaboradores[index],
                      empleado_id: idNum,
                      nombre_colaborador: emp?.nombre || '',
                      cedula: emp?.cedula || '',
                    };
                    setColaboradores(newColaboradores);
                  }}
                >
                  <Picker.Item label="Seleccionar colaborador" value="" />
                  {empleadosOptions.map((e) => (
                    <Picker.Item key={e.id} label={e.nombre} value={e.id} />
                  ))}
                </Picker>
              </ThemedView>
            </ThemedView>

            {/* Nombre colaborador */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Nombre colaborador</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder="Nombre colaborador"
                placeholderTextColor="#999"
                value={colaborador.nombre_colaborador}
                editable={false}
              />
            </ThemedView>

            {/* Cédula */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Cédula</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder="Cédula"
                placeholderTextColor="#999"
                value={colaborador.cedula}
                editable={false}
                keyboardType="numeric"
              />
            </ThemedView>

            {/* Firma/comentario */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Firma</ThemedText>
              {!colaborador.firma_comentario ? (
                <TouchableOpacity
                  style={styles.qrButton}
                  onPress={() => handleScanQR(index, 'firma_comentario')}
                >
                  {getActionIcon('qr')}
                  <ThemedText style={styles.qrButtonText}>Escanear QR</ThemedText>
                </TouchableOpacity>
              ) : (
                <ThemedView style={styles.qrInfoContainer}>
                  <ThemedText style={styles.qrInfoTitle}>Información del QR escaneado:</ThemedText>
                  {colaborador.firma_comentario_info && (
                    <>
                      <ThemedText style={styles.qrInfoText}>ID de sesión: {colaborador.firma_comentario_info.sessionId}</ThemedText>
                      <ThemedText style={styles.qrInfoText}>ID del empleado: {colaborador.firma_comentario_info.empleadoId}</ThemedText>
                      {colaborador.firma_comentario_info.empleadoDetalle && (
                        <ThemedText style={styles.qrInfoText}>
                          Empleado: {colaborador.firma_comentario_info.empleadoDetalle.nombre} {colaborador.firma_comentario_info.empleadoDetalle.primer_apellido} {colaborador.firma_comentario_info.empleadoDetalle.segundo_apellido}{colaborador.firma_comentario_info.empleadoDetalle.cedula_empleado ? ` (${colaborador.firma_comentario_info.empleadoDetalle.cedula_empleado})` : ''}
                        </ThemedText>
                      )}
                      <ThemedText style={styles.qrInfoText}>Latitud: {colaborador.firma_comentario_info.latitud}</ThemedText>
                      <ThemedText style={styles.qrInfoText}>Longitud: {colaborador.firma_comentario_info.longitud}</ThemedText>
                      <ThemedText style={styles.qrInfoText}>Timestamp: {new Date(parseInt(colaborador.firma_comentario_info.timestamp)).toLocaleString()}</ThemedText>
                    </>
                  )}
                  <TouchableOpacity
                    style={styles.clearQRButton}
                    onPress={() => {
                      const newColaboradores = [...colaboradores];
                      newColaboradores[index] = {
                        ...newColaboradores[index],
                        firma_comentario: '',
                        firma_comentario_info: null,
                      };
                      setColaboradores(newColaboradores);
                    }}
                  >
                    <Ionicons name="trash" size={16} color="#FF3B30" />
                    <ThemedText style={styles.clearQRButtonText}>Eliminar QR</ThemedText>
                  </TouchableOpacity>
                </ThemedView>
              )}
            </ThemedView>

            {/* Entrada */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Entrada</ThemedText>
              <TouchableOpacity style={styles.dateButton} onPress={() => openTimePicker(index, 'entrada')}>
                <ThemedText style={styles.dateButtonText}>{colaborador.entrada || 'Seleccionar hora'}</ThemedText>
                <Ionicons name="time" size={20} color="#007AFF" />
              </TouchableOpacity>
            </ThemedView>

            {/* Salida */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Salida</ThemedText>
              <TouchableOpacity style={styles.dateButton} onPress={() => openTimePicker(index, 'salida')}>
                <ThemedText style={styles.dateButtonText}>{colaborador.salida || 'Seleccionar hora'}</ThemedText>
                <Ionicons name="time" size={20} color="#007AFF" />
              </TouchableOpacity>
            </ThemedView>

            {/* Selector sustituto */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Sustituto</ThemedText>
              <ThemedView style={styles.pickerWrapper}>
                <Picker
                  selectedValue={colaborador.sustituto_id ?? ''}
                  onValueChange={(value) => {
                    const idNum = value ? parseInt(String(value), 10) : null;
                    const emp = empleadosOptions.find((e) => e.id === idNum);
                    const newColaboradores = [...colaboradores];
                    newColaboradores[index] = {
                      ...newColaboradores[index],
                      sustituto_id: idNum,
                      nombre_sustituto: emp?.nombre || '',
                      cedula_sustituto: emp?.cedula || '',
                    };
                    setColaboradores(newColaboradores);
                  }}
                >
                  <Picker.Item label="Seleccionar sustituto" value="" />
                  {empleadosOptions.map((e) => (
                    <Picker.Item key={e.id} label={e.nombre} value={e.id} />
                  ))}
                </Picker>
              </ThemedView>
            </ThemedView>

            {/* Nombre Sustituto */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Nombre Sustituto</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder="Nombre Sustituto"
                placeholderTextColor="#999"
                value={colaborador.nombre_sustituto}
                editable={false}
              />
            </ThemedView>

            {/* Cédula Sustituto */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Cédula Sustituto</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder="Cédula Sustituto"
                placeholderTextColor="#999"
                value={colaborador.cedula_sustituto}
                editable={false}
                keyboardType="numeric"
              />
            </ThemedView>

            {/* Firma Sustituto */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Firma Sustituto</ThemedText>
              {!colaborador.firma_sustituto ? (
                <TouchableOpacity
                  style={styles.qrButton}
                  onPress={() => handleScanQR(index, 'firma_sustituto')}
                >
                  {getActionIcon('qr')}
                  <ThemedText style={styles.qrButtonText}>Escanear QR</ThemedText>
                </TouchableOpacity>
              ) : (
                <ThemedView style={styles.qrInfoContainer}>
                  <ThemedText style={styles.qrInfoTitle}>Información del QR escaneado:</ThemedText>
                  {colaborador.firma_sustituto_info && (
                    <>
                      <ThemedText style={styles.qrInfoText}>ID de sesión: {colaborador.firma_sustituto_info.sessionId}</ThemedText>
                      <ThemedText style={styles.qrInfoText}>ID del empleado: {colaborador.firma_sustituto_info.empleadoId}</ThemedText>
                      {colaborador.firma_sustituto_info.empleadoDetalle && (
                        <ThemedText style={styles.qrInfoText}>
                          Empleado: {colaborador.firma_sustituto_info.empleadoDetalle.nombre} {colaborador.firma_sustituto_info.empleadoDetalle.primer_apellido} {colaborador.firma_sustituto_info.empleadoDetalle.segundo_apellido}{colaborador.firma_sustituto_info.empleadoDetalle.cedula_empleado ? ` (${colaborador.firma_sustituto_info.empleadoDetalle.cedula_empleado})` : ''}
                        </ThemedText>
                      )}
                      <ThemedText style={styles.qrInfoText}>Latitud: {colaborador.firma_sustituto_info.latitud}</ThemedText>
                      <ThemedText style={styles.qrInfoText}>Longitud: {colaborador.firma_sustituto_info.longitud}</ThemedText>
                      <ThemedText style={styles.qrInfoText}>Timestamp: {new Date(parseInt(colaborador.firma_sustituto_info.timestamp)).toLocaleString()}</ThemedText>
                    </>
                  )}
                  <TouchableOpacity
                    style={styles.clearQRButton}
                    onPress={() => {
                      const newColaboradores = [...colaboradores];
                      newColaboradores[index] = {
                        ...newColaboradores[index],
                        firma_sustituto: '',
                        firma_sustituto_info: null,
                      };
                      setColaboradores(newColaboradores);
                    }}
                  >
                    <Ionicons name="trash" size={16} color="#FF3B30" />
                    <ThemedText style={styles.clearQRButtonText}>Eliminar QR</ThemedText>
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
      <AppHeader onMenuPress={handleMenuPress} title="Control de Asistencia" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <ThemedView style={styles.contentContainer}>
          <ThemedView style={styles.titleContainer}>
            <ThemedText style={styles.title}>
              Control de Asistencia
            </ThemedText>
            {hasCurrentMarca && (
              <ThemedText style={styles.subtitle}>
                Controla la asistencia de los colaboradores
              </ThemedText>
            )}
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
              {/* Cliente (read-only desde current_marca) */}

              {false && (
                <>
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Cliente</ThemedText>
                <ThemedView style={styles.readonlyBox}>
                  <ThemedText style={styles.readonlyText}>{marcaClienteName || 'N/A'}</ThemedText>
                </ThemedView>
              </ThemedView>

              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Sucursal</ThemedText>
                <ThemedView style={styles.readonlyBox}>
                  <ThemedText style={styles.readonlyText}>{marcaCorpoName || 'N/A'}</ThemedText>
                </ThemedView>
              </ThemedView>
              </>
              )}

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

              {/* Turno */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Turno</ThemedText>
                <ThemedView style={styles.pickerWrapper}>
                  <Picker selectedValue={turno} onValueChange={(val) => setTurno(String(val))}>
                    {TURNO_OPTIONS.map((o) => (
                      <Picker.Item key={o.value} label={o.label} value={o.value} />
                    ))}
                  </Picker>
                </ThemedView>
              </ThemedView>

              {/* Area/Piso */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Area/Piso</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Area/Piso"
                  placeholderTextColor="#999"
                  value={areaPiso}
                  onChangeText={setAreaPiso}
                />
              </ThemedView>

              {/* Total presentes */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Total presentes</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Total presentes"
                  placeholderTextColor="#999"
                  value={totalPresentes}
                  onChangeText={setTotalPresentes}
                  keyboardType="numeric"
                />
              </ThemedView>

              {/* Fijos */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Fijos</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Fijos"
                  placeholderTextColor="#999"
                  value={fijos}
                  onChangeText={setFijos}
                  keyboardType="numeric"
                />
              </ThemedView>

              {/* Lista de colaboradores */}
              {colaboradores.map((colaborador, index) => renderColaborador(colaborador, index))}

              {/* Time picker global para colaboradores */}
              {showTimePicker && (
                <DateTimePicker
                  value={timePickerValue}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleTimeChange}
                />
              )}

              <TouchableOpacity
                style={styles.addColaboradorButton}
                onPress={addColaborador}
              >
                <Ionicons name="add-circle" size={24} color="#4CAF50" />
                <ThemedText style={styles.addColaboradorButtonText}>Agregar Colaborador</ThemedText>
              </TouchableOpacity>

              {/* Firma responsable (generada) */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Firma responsable</ThemedText>

                {!firmaResponsableHash ? (
                  <ThemedView style={styles.signatureButtons}>
                    <TouchableOpacity
                      style={[styles.signatureButton, isGeneratingFirmaResponsable && styles.signatureButtonDisabled]}
                      onPress={generateSignatureResponsable}
                      disabled={isGeneratingFirmaResponsable}
                    >
                      {isGeneratingFirmaResponsable ? (
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
                      onPress={handleScanQRResponsable}
                    >
                      {getActionIcon('qr-responsable')}
                      <ThemedText style={styles.signatureButtonText}>Escanear QR</ThemedText>
                    </TouchableOpacity>
                  </ThemedView>
                ) : (
                  <ThemedView style={styles.qrInfoContainer}>
                    <ThemedText style={styles.qrInfoTitle}>Información del QR:</ThemedText>
                    {firmaResponsable && (
                      <>
                        <ThemedText style={styles.qrInfoText}>ID de sesión: {firmaResponsable.sessionId}</ThemedText>
                        <ThemedText style={styles.qrInfoText}>ID del empleado: {firmaResponsable.empleadoId}</ThemedText>
                        {firmaResponsable.empleadoDetalle && (
                          <ThemedText style={styles.qrInfoText}>
                            Empleado: {firmaResponsable.empleadoDetalle.nombre} {firmaResponsable.empleadoDetalle.primer_apellido} {firmaResponsable.empleadoDetalle.segundo_apellido}
                            {firmaResponsable.empleadoDetalle.cedula_empleado ? ` (${firmaResponsable.empleadoDetalle.cedula_empleado})` : ''}
                          </ThemedText>
                        )}
                        <ThemedText style={styles.qrInfoText}>Latitud: {firmaResponsable.latitud}</ThemedText>
                        <ThemedText style={styles.qrInfoText}>Longitud: {firmaResponsable.longitud}</ThemedText>
                        <ThemedText style={styles.qrInfoText}>Timestamp: {new Date(parseInt(firmaResponsable.timestamp)).toLocaleString()}</ThemedText>
                      </>
                    )}

                    <TouchableOpacity
                      style={styles.clearQRButton}
                      onPress={() => {
                        setFirmaResponsableHash('');
                        setFirmaResponsable(null);
                      }}
                    >
                      <Ionicons name="trash" size={16} color="#FF3B30" />
                      <ThemedText style={styles.clearQRButtonText}>Eliminar firma</ThemedText>
                    </TouchableOpacity>
                  </ThemedView>
                )}
              </ThemedView>

              <ThemedView style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={editingRecord ? cancelEditing : cancelCreating}
                >
                  <ThemedText style={styles.cancelButtonText}>
                    {getActionIcon('cancel')}
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.confirmButton}
                  onPress={editingRecord ? updateControlHandler : saveControlHandler}
                >
                  <ThemedText style={styles.confirmButtonText}>
                    {getActionIcon('confirm')}
                  </ThemedText>
                </TouchableOpacity>
              </ThemedView>
            </ThemedView>
          ) : (
            <ThemedView style={styles.listSection}>
                <ThemedView style={styles.readonlyBox}>
                  <ThemedView style={styles.compactInfoRow}>
                    <ThemedView style={styles.compactInfoItem}>
                      <ThemedText style={styles.compactInfoLabel}>Cliente</ThemedText>
                      <ThemedText style={styles.readonlyText}>{marcaClienteName || 'N/A'}</ThemedText>
                    </ThemedView>
                    <ThemedView style={styles.compactInfoItem}>
                      <ThemedText style={styles.compactInfoLabel}>Sucursal</ThemedText>
                      <ThemedText style={styles.readonlyText}>{marcaCorpoName || 'N/A'}</ThemedText>
                    </ThemedView>
                  </ThemedView>
                </ThemedView>
              <TouchableOpacity style={styles.createButton} onPress={startCreating}>
                <Ionicons name="add" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              {renderControlList()}
            </ThemedView>
          )}
        </ThemedView>
      </ScrollView>

      {QRScannerComponent}

      <AppFooter />
      <SlideMenu
        isVisible={isMenuVisible}
        onClose={handleMenuClose}
        onHomePress={handleHomePress}
        currentRoute="AttendanceControl"
      />
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
    color: '#000000',
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
    color: '#000000',
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
  createButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  formContainer: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    padding: 16,
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
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F9F9F9',
  },
  readonlyBox: {
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 8,
    padding: 14,
    backgroundColor: '#E3F2FD',
    marginBottom: 15,
  },
  readonlyText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007AFF',
    textAlign: 'left',
  },
  compactInfoRow: {
    flexDirection: 'column',
    gap: 8,
    backgroundColor: '#E3F2FD',
  },
  compactInfoItem: {
    width: '100%',
    backgroundColor: '#E3F2FD',
  },
  compactInfoLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 3,
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
  signatureButtonDisabled: {
    backgroundColor: '#999',
  },
  signatureButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  colaboradorItem: {
    marginBottom: 15,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  colaboradorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#F5F5F5',
  },
  colaboradorHeaderContent: {
    flex: 1,
    marginRight: 10,
  },
  colaboradorHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    backgroundColor: '#F5F5F5',
  },
  colaboradorHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F5F5F5',
  },
  removeColaboradorButton: {
    padding: 4,
  },
  colaboradorContent: {
    padding: 15,
  },
  qrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2196F3',
    gap: 8,
  },
  qrButtonText: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '600',
  },
  qrInfoContainer: {
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  qrInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  qrInfoText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  clearQRButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    padding: 8,
    backgroundColor: '#FFEBEE',
    borderRadius: 6,
    gap: 6,
  },
  clearQRButtonText: {
    fontSize: 12,
    color: '#FF3B30',
    fontWeight: '600',
  },
  addColaboradorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    marginTop: 10,
    marginBottom: 20,
    gap: 8,
  },
  addColaboradorButtonText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#34C759',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#8E8E93',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  listSection: {
    width: '100%',
  },
  listContainer: {
    width: '100%',
    gap: 16,
  },
  listItem: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#fff',
    padding: 16,
    gap: 8,
  },
  listItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  listItemContent: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
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
    paddingTop: 8,
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
});

