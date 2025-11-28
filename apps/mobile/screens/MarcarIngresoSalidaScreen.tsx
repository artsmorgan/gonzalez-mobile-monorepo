import AppHeader from '../components/AppHeader';
import AppFooter from '../components/AppFooter';
import SlideMenu from '../components/SlideMenu';
import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import { useAuth } from '../contexts/AuthContext';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import React, { useEffect, useState, useRef } from 'react';
import { ActivityIndicator, Alert, StyleSheet, TouchableOpacity, ScrollView, Modal, TextInput } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import { format, toZonedTime } from 'date-fns-tz';
import * as Network from 'expo-network';
import saveMarca from '@/hooks/saveMarca';
import saveAbsentReason from '@/hooks/saveAbsentReason';
import getHoraAccion from '@/hooks/getHoraAccion';
import { eventBus } from '@/hooks/eventBus';

type MarcarIngresoSalidaScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'MarcarIngresoSalida'>;

interface AttendanceSuccessResponse {
  estado: 'Ingresado' | 'No ingresado';
  is_late: boolean;
  current_time: string;
  change_available: boolean;
  next_time: string;
  marca: {
    id: number;
    hora_entrada_digitada: string | null;
    hora_salida_digitada: string | null;
    hora_inicio: string;
    hora_fin: string;
    fecha: string;
    tipo_turno: string;
    horas_duracion: number;
    roleDivision: {
      role:{
        id: number;
        nombre: string;
      };
      division: {
        id: number;
        nombre: string;
      };
    }
    empresa: {
      id: number;
      nombre: string;
    };
    cliente: {
      id: number;
      nombre: string;
    };
    contrato: {
      id: number;
      nombre: string;
    };
    corpo: {
      id: number;
      nombre: string;
      ubicacion: {
        lat: number | null;
        lng: number | null;
      }
    };
    puesto: {
      id: number;
      nombre: string;
    };
    plaza: {
      id: number;
      nombre: string;
    };
    horario: {
      id: number;
      nombre: string;
    };
  };
}

interface AttendanceErrorResponse {
  status: false;
  message: string;
  absent?: boolean; // Dato absent puede ser opcional
}

type AttendanceResponse = AttendanceSuccessResponse | AttendanceErrorResponse;

export default function MarcarIngresoSalidaScreen() {
  const { isAuthenticated, isLoading, employee, refreshAccessToken, logout } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [attendanceData, setAttendanceData] = useState<AttendanceSuccessResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [exitReason, setExitReason] = useState('');
  const [showAbsentReasonForm, setShowAbsentReasonForm] = useState(false);
  const [absentReason, setAbsentReason] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navigation = useNavigation<MarcarIngresoSalidaScreenNavigationProp>();
  
  useEffect(() => {
    const handler = () => {
      fetchAttendanceStatus();
    };

    eventBus.on('connectionRestored', handler);
    return () => {
      eventBus.off('connectionRestored', handler);
    };
  }, []);

  useEffect(() => {
    // Redirect to login if not authenticated
    if (!isLoading && !isAuthenticated) {
      navigation.replace('Home');
    }
  }, [isAuthenticated, isLoading, navigation]);

  // Fetch attendance status every 30 seconds
  useEffect(() => {
    if (isAuthenticated && employee) {
      // Fetch immediately
      fetchAttendanceStatus();

      // Set up interval for every 30 seconds
      intervalRef.current = setInterval(() => {
        fetchAttendanceStatus();
      }, 30000);

      // Cleanup interval on unmount
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [isAuthenticated, employee]);

  const fetchAttendanceStatus = async () => {
    try {
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) {
        throw new Error('Server URL not configured');
      }

      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      if (!employee?.id) {
        throw new Error('Employee ID not found');
      }

      setIsLoadingLocation(true);
      setLocationError(null);

      // Verificar y obtener ubicación GPS antes de hacer la llamada
      let currentLocation: Location.LocationObject | null = null;
      
      // Verificar permisos de ubicación
      const { status: permissionStatus } = await Location.requestForegroundPermissionsAsync();
      if (permissionStatus !== 'granted') {
        setLocationError('Permiso de ubicación denegado. Por favor, activa la ubicación en la configuración de tu dispositivo.');
        setIsLoadingLocation(false);
        return;
      }

      // Verificar que los servicios de ubicación estén habilitados
      const isLocationEnabled = await Location.hasServicesEnabledAsync();
      if (!isLocationEnabled) {
        setLocationError('Los servicios de ubicación están desactivados. Por favor, activa la ubicación en tu dispositivo.');
        setIsLoadingLocation(false);
        return;
      }

      // Obtener ubicación actual
      try {
        currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        // Actualizar el estado de ubicación para mantener consistencia
        setLocation(currentLocation);
      } catch (locationError) {
        console.error('Error obteniendo ubicación GPS:', locationError);
        setLocationError('Error al obtener la ubicación GPS. Por favor, verifica que los servicios de ubicación estén habilitados.');
        setIsLoadingLocation(false);
        return;
      }

      if (!currentLocation || !currentLocation.coords) {
        setLocationError('No se pudo obtener la ubicación GPS. Por favor, intenta nuevamente.');
        setIsLoadingLocation(false);
        return;
      }

      const lat = currentLocation.coords.latitude;
      const long = currentLocation.coords.longitude;

      setIsLoadingLocation(false);
      setLocationError(null);

      setIsLoadingData(true);
      setErrorMessage(null);
      setAttendanceData(null);

      const networkState = await Network.getNetworkStateAsync();
      let marca_send = null;
      let result = null;
      let data = null;



      if (networkState.isConnected && networkState.isInternetReachable) {

        const response = await fetch(`${apiUrl}/api/attendance/user/${employee.id}?lat=${lat}&long=${long}`, {
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
          return fetchAttendanceStatus();
        } else {
          // If refresh fails, logout the user
          await logout();
        }
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

        data = await response.json();

        result = data.status;
        if (result) {
          marca_send = data.marca;

          const server_time = await AsyncStorage.getItem('server_time');
          if (!server_time) {
            throw new Error('Server time not found');
          }

          marca_send.current_time = parseInt(server_time);
          
          const cache = await AsyncStorage.getItem('current_marca');
          if (cache) {
            const marca_cache = JSON.parse(cache);
            if (marca_cache.id !== marca_send.id) {
              await AsyncStorage.removeItem('current_marca');
            }
          }
        }
      }
      else{
        console.log('Sin conexión a internet');
        const cache = await AsyncStorage.getItem('current_marca');
        if (!cache) {
          result = false;
          marca_send = null;
          data = { status: false, message: 'No se encontraron datos de asistencia' };
        }
        else {
          result = true;
          marca_send = JSON.parse(cache);
          const server_time = await AsyncStorage.getItem('server_time');
          if (!server_time) {
            throw new Error('Server time not found');
          }
          marca_send.current_time = parseInt(server_time);
        }
      }

      if (marca_send && marca_send.corpo && marca_send.corpo.ubicacion && marca_send.corpo.ubicacion.lat && marca_send.corpo.ubicacion.lng) {
        const distance = getDistanceFromLatLonInMeters(lat, long, marca_send.corpo.ubicacion.lat, marca_send.corpo.ubicacion.lng);
        if (distance > 50) {
          result = false;
          marca_send = null;
          data = { status: false, message: 'Ubicación no válida' };
        }
      }

      if (result) {
        setCurrentAttendanceData(marca_send);
        } else {
        if (data && typeof data === 'object' && 'absent' in data && data.absent !== undefined && data.absent === true) {
            // Show absent reason form
            setShowAbsentReasonForm(true);
            setErrorMessage((data as AttendanceErrorResponse).message);
            return;
          }
          setErrorMessage((data as AttendanceErrorResponse).message);
        }
    } catch (error) {
      console.error('Error fetching attendance status:', error);
      setErrorMessage('Error al cargar los datos. Por favor, intenta nuevamente.');
    } finally {
      setIsLoadingData(false);
    }
  };

  const setCurrentAttendanceData = async (data: any) => {
    const marca = data;

    const fecha = marca.fecha.split('-');
    fecha[2] = fecha[2].slice(0, 2);

    const estado = marca.hora_entrada_digitada != null ? "Ingresado" : "No ingresado";
    
    let next_time = toZonedTime(new Date(estado == "No ingresado" ? marca.hora_inicio : marca.hora_fin), "America/Costa_Rica");
    next_time.setFullYear(parseInt(fecha[0]), parseInt(fecha[1]) - 1, marca.hora_inicio > marca.hora_fin ? parseInt(fecha[2]) + 1 : parseInt(fecha[2]));
    
    let next_change_time = new Date(next_time.getTime());
    next_change_time.setFullYear(parseInt(fecha[0]), parseInt(fecha[1]) - 1, marca.hora_inicio > marca.hora_fin ? parseInt(fecha[2]) + 1 : parseInt(fecha[2]));
    next_change_time.setMinutes(next_change_time.getMinutes() - 15);

    let change_available = true;
    let is_late = false;
    
    const horaAccion = await getHoraAccion();
    if (!horaAccion) {
      throw new Error('Hora de acción not found');
    }

    const now = horaAccion;

    if (estado == "No ingresado") {
      if (now < next_change_time.getTime()) { // Si la fecha del parámetro es menor a la fecha de la marca menos 15 menos minutos
          change_available = false;
      }
    }

    if (now > next_time.getTime()) {
        is_late = true;
    }

    const attendance_save = {
      estado: estado,
      is_late: is_late,
      change_available: change_available,
      next_time: next_time.toISOString(),
      current_time: toZonedTime(new Date(data.current_time), "America/Costa_Rica").toISOString(),
      marca: marca,
    } as AttendanceSuccessResponse;
    setAttendanceData(attendance_save);
  }

  const handleToggleAttendance = () => {
    if (!attendanceData) return;

    const action = attendanceData.estado === 'No ingresado' ? 'ingresar' : 'salir';
    const actionText = attendanceData.estado === 'No ingresado' ? 'Ingresar' : 'Salir';
    
    Alert.alert(
      'Confirmar acción',
      `¿Estás seguro de que deseas ${action}?`,
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: actionText,
          style: attendanceData.estado === 'Ingresado' ? 'destructive' : 'default',
          onPress: () => executeToggleAttendance(),
        },
      ],
      { cancelable: true }
    );
  };

  function getDistanceFromLatLonInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371000; // radio de la Tierra en metros
    const toRad = (value: number) => (value * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

  const executeToggleAttendance = async () => {
    if (!attendanceData) return;

    setIsUpdating(true);

    try {
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) {
        throw new Error('Server URL not configured');
      }

      if (!employee?.id) {
        throw new Error('Employee ID not found');
      }

      let type = 'entrada';
      if (attendanceData.estado !== 'No ingresado') {
        type = 'salida';

        const horaAccion = await getHoraAccion();
        if (!horaAccion) {
          throw new Error('Hora de acción not found');
        }
        const now = horaAccion;
        
        const fecha = attendanceData.marca.fecha.split('-');
        fecha[2] = fecha[2].slice(0, 2);
        
        let next_time = toZonedTime(new Date(attendanceData.marca.hora_fin), "America/Costa_Rica");
        next_time.setFullYear(parseInt(fecha[0]), parseInt(fecha[1]) - 1, attendanceData.marca.hora_inicio > attendanceData.marca.hora_fin ? parseInt(fecha[2]) + 1 : parseInt(fecha[2]));

        if (now < (next_time.getTime() - 15 * 60 * 1000)) {
          // Show modal for early exit reason
          setIsModalVisible(true);
          return;
        }
      }

      confirmAction(type);
    } catch (error) {
      console.error('Error updating attendance:', error);
      Alert.alert('Error', 'No se pudo actualizar el estado de asistencia. Por favor, intenta nuevamente.');
    } finally {
      setIsUpdating(false);
    }
  };

  const confirmAction = async (type: string, reason: string = '') => {
    
    if (!attendanceData || !attendanceData.marca || !attendanceData.marca.id) {
      throw new Error('No se encontró la marca');
    }
    
    const horaAccion = await getHoraAccion();
    if (!horaAccion) {
      throw new Error('Hora de acción not found');
    }

    const networkState = await Network.getNetworkStateAsync();

    let data = null;
    if (networkState.isConnected && networkState.isInternetReachable) {
      data = await saveMarca({ data_params: { type, reason, horaAccion: horaAccion }, marcaId: attendanceData.marca.id, refreshAccessToken, logout });
    }
    else {
      if (type === 'salida') {
        await AsyncStorage.setItem('marca_cache', JSON.stringify({ marcaId: attendanceData.marca.id, type, reason, horaAccion: horaAccion }));
        data = { status: true, message: 'Salida registrada correctamente' };
      }
      else {
        data = { status: false, message: 'No hay conexión a internet. Por favor, intenta nuevamente.' };
      }
    }

    if (data.status) {
      try {
        if (type === 'entrada') {
          if (attendanceData) {
            attendanceData.marca.hora_entrada_digitada = new Date(horaAccion).toISOString();
            await AsyncStorage.setItem('current_marca', JSON.stringify(attendanceData.marca));
            await Promise.all([
              getLunchTimeConfig(attendanceData.marca.id),
              getActivities(attendanceData.marca.id),
              getVehicles(attendanceData.marca.id),
              getVisitors(attendanceData.marca.id),
              getNotes(attendanceData.marca.id),
              getCategories(),
              getTipoActivo(),
              getEvaluations(attendanceData.marca.corpo.id),
              getEmployeesCorpo(attendanceData.marca.corpo.id),
              getIncidents(attendanceData.marca.id),
              getIncidentsClassifications(),
              getExecutives(),
              getSurveys(attendanceData.marca.id),
              getPuestosCorpo(attendanceData.marca.corpo.id),
              getTrainings(attendanceData.marca.id),
              getVoiceNotes(attendanceData.marca.id),
              getArticulos()
            ]);
          }
        }
        else {
          await AsyncStorage.removeItem('current_marca');
        }
      } catch (storageError) {
        console.error('Error with storage or status refresh:', storageError);
      }

      // Refresh the status after updating
      await fetchAttendanceStatus();

      Alert.alert(
        'Éxito',
        type === 'entrada' 
          ? 'Ingreso registrado correctamente' 
          : 'Salida registrada correctamente'
      );
    } else {
      Alert.alert(
        'Error',
        data.message
      );
    }
  };

  const getTrainings = async (marcaId: number) => {
    // Eliminar actions
    await AsyncStorage.removeItem('trainings_actions');
    await AsyncStorage.removeItem('trainings_cache');
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }
    const token = await AsyncStorage.getItem('access_token');
    if (!token) {
      throw new Error('No authentication token found');
    }
    const response = await fetch(`${apiUrl}/api/training?m=${marcaId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} getTrainings`);
    }
    const data = await response.json();
    if (data.status) {
      await AsyncStorage.setItem('trainings_cache', JSON.stringify(data.capacitaciones));
    }
  }

  const getVoiceNotes = async (marcaId: number) => {
    // Eliminar actions
    await AsyncStorage.removeItem('voice_notes_actions');
    await AsyncStorage.removeItem('voice_notes_cache');
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }
    const token = await AsyncStorage.getItem('access_token');
    if (!token) {
      throw new Error('No authentication token found');
    }
    const response = await fetch(`${apiUrl}/api/voice-notes?m=${marcaId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} getVoiceNotes`);
    }
    const data = await response.json();
    if (data.status) {
      await AsyncStorage.setItem('voice_notes_cache', JSON.stringify(data.voiceNotes));
    }
  }

  const getCategories = async () => {
    await AsyncStorage.removeItem('categories_cache');
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }
    const token = await AsyncStorage.getItem('access_token');
    if (!token) {
      throw new Error('No authentication token found');
    }
    const response = await fetch(`${apiUrl}/api/categories`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });
    console.log("getCategories");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} getCategories`);
    }
    const data = await response.json();
    if (data.status) {
      await AsyncStorage.setItem('categories_cache', JSON.stringify(data.categories));
    }
  }
  
  const getTipoActivo = async () => { 
    await AsyncStorage.removeItem('tipo_activos_cache');
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }
    const token = await AsyncStorage.getItem('access_token');
    if (!token) {
      throw new Error('No authentication token found');
  }
    const response = await fetch(`${apiUrl}/api/visitors/categories`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });
    console.log("getTipoActivo");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} getTipoActivo`);
    }
    const data = await response.json();
    if (data.status) {
      await AsyncStorage.setItem('tipo_activos_cache', JSON.stringify(data));
    }
  }

  const getNotes = async (marcaId: number) => {
    // Eliminar actions
    await AsyncStorage.removeItem('notes_actions');
    await AsyncStorage.removeItem('notes_cache');
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }
    const token = await AsyncStorage.getItem('access_token');
    if (!token) {
      throw new Error('No authentication token found');
    }
    
    const response = await fetch(`${apiUrl}/api/puestos/${marcaId}/notas`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });
    console.log("getNotes");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} getNotes`);
    }
    const data = await response.json();
    if (data.status) {
      await AsyncStorage.setItem('notes_cache', JSON.stringify(data));
    }
  }

  const getEvaluations = async (corpoId: number) => {
    console.log("corpoId", corpoId);
    // Eliminar actions
    await AsyncStorage.removeItem('evaluations_actions');
    await AsyncStorage.removeItem('evaluations_cache');
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }
    const token = await AsyncStorage.getItem('access_token');
    if (!token) {
      throw new Error('No authentication token found');
    }
    const response = await fetch(`${apiUrl}/api/evaluation/corpo/${corpoId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} getEvaluations`);
    }
    const data = await response.json();
    if (data.status) {
      await AsyncStorage.setItem('evaluations_cache', JSON.stringify(data.evaluaciones));
    }
  }

  const getEmployeesCorpo = async (corpoId: number) => {
    // Eliminar actions
    await AsyncStorage.removeItem('employees_corpo_actions');
    await AsyncStorage.removeItem('employees_corpo_cache');
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }
    const token = await AsyncStorage.getItem('access_token');
    if (!token) {
      throw new Error('No authentication token found');
    }
    const response = await fetch(`${apiUrl}/api/empleados/corpo/${corpoId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} getEmployeesCorpo`);
    }
    const data = await response.json();
    if (data.status) {
      await AsyncStorage.setItem('employees_corpo_cache', JSON.stringify(data.empleados));
    }
  }

  const getIncidents = async (marcaId: number) => {
    // Eliminar actions
    await AsyncStorage.removeItem('incidents_actions');
    await AsyncStorage.removeItem('incidents_cache');
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }
    const token = await AsyncStorage.getItem('access_token');
    if (!token) {
      throw new Error('No authentication token found');
  }
    const response = await fetch(`${apiUrl}/api/incidents?m=${marcaId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} getIncidents`);
    }
    const data = await response.json();
    if (data.status) {
      await AsyncStorage.setItem('incidents_cache', JSON.stringify(data.incidents));
    }
  }

  const getIncidentsClassifications = async () => {
    // Eliminar actions
    await AsyncStorage.removeItem('incidents_classifications_cache');
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }
    const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        throw new Error('No authentication token found');
    }
    const response = await fetch(`${apiUrl}/api/incidents/classification`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} getIncidentsClassifications`);
    }
    const data = await response.json();
    if (data.status) {
      await AsyncStorage.setItem('incidents_classifications_cache', JSON.stringify(data.classifications));
    }
  }

  const getExecutives = async () => {
    // Eliminar actions
    await AsyncStorage.removeItem('executives_actions');
    await AsyncStorage.removeItem('executives_cache');
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }
    const token = await AsyncStorage.getItem('access_token');
    if (!token) {
      throw new Error('No authentication token found');
    }
    const response = await fetch(`${apiUrl}/api/executives`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} getExecutives`);
    }
    const data = await response.json();
    if (data.status) {
      await AsyncStorage.setItem('executives_cache', JSON.stringify(data.executives));
    }
  }

  const getSurveys = async (marcaId: number) => {
    // Eliminar actions
    await AsyncStorage.removeItem('surveys_actions');
    await AsyncStorage.removeItem('surveys_cache');
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }
    const token = await AsyncStorage.getItem('access_token');
    if (!token) {
      throw new Error('No authentication token found');
    }
    const response = await fetch(`${apiUrl}/api/encuesta-nps?m=${marcaId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} getSurveys`);
    }
    const data = await response.json();
    if (data.status) {
      await AsyncStorage.setItem('surveys_cache', JSON.stringify(data.encuestas));
    }
  }

  const getPuestosCorpo = async (corpoId: number) => {
    // Eliminar actions
    await AsyncStorage.removeItem('puestos_corpo_actions');
    await AsyncStorage.removeItem('puestos_corpo_cache');
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }
    const token = await AsyncStorage.getItem('access_token');
    if (!token) {
      throw new Error('No authentication token found');
    }
    const response = await fetch(`${apiUrl}/api/puestos/corpo/${corpoId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} getPuestosCorpo`);
    }
    const data = await response.json();
    if (data.status) {
      await AsyncStorage.setItem('puestos_corpo_cache', JSON.stringify(data.puestos));
    }
  }
  
  const getArticulos = async () => {
    // Eliminar actions
    await AsyncStorage.removeItem('articulos_actions');
    await AsyncStorage.removeItem('articulos_cache');
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }
    const token = await AsyncStorage.getItem('access_token');
    if (!token) {
      throw new Error('No authentication token found');
    }
    const response = await fetch(`${apiUrl}/api/articulos`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} getArticulos`);
    }
    const data = await response.json();
    if (data.status) {
      await AsyncStorage.setItem('articulos_cache', JSON.stringify(data.articulos));
    }
  }

  const handleMenuPress = () => {
    setIsMenuVisible(true);
  };

  const handleMenuClose = () => {
    setIsMenuVisible(false);
  };

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'warning': return <Ionicons name="warning" size={17.5} color='#FFCC00' />;
      case 'retry': return <Ionicons name="refresh" size={20} color='#FFFFFF' />;
      case 'start': return <Ionicons name="enter-outline" size={35} color='#FFFFFF' />;
      case 'end': return <Ionicons name="exit-outline" size={35} color='#FFFFFF' />;
      case 'confirm': return <Ionicons name="checkmark" size={35} color='#FFFFFF' />;
      case 'cancel': return <Ionicons name="close" size={35} color='#FFFFFF' />;
      case 'marcar-ingreso-salida': return <Ionicons name="time" size={25} color='#000000' />;
      default: return <Ionicons name="close" size={35} color='#FFFFFF' />;
    }
  };

  const handleHomePress = () => {
    navigation.navigate('Home');
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const handleModalConfirm = () => {
    if (exitReason.trim() === '') {
      Alert.alert('Error', 'Por favor, ingresa una razón para la salida temprana.');
      return;
    }
    
    setIsModalVisible(false);
    confirmAction('salida', exitReason.trim());
    setExitReason('');
  };

  const handleModalCancel = () => {
    setIsModalVisible(false);
    setExitReason('');
  };

  const handleAbsentReasonSubmit = async () => {
    if (absentReason.trim() === '') {
      Alert.alert('Error', 'Por favor, ingresa un motivo válido.');
      return;
    }
    
    setShowAbsentReasonForm(false);
    await submitAbsentReason(absentReason.trim());
    setAbsentReason('');
  };

  const handleAbsentReasonCancel = () => {
    setShowAbsentReasonForm(false);
    setAbsentReason('');
  };

  const submitAbsentReason = async (reason: string) => {
    if (!employee?.id) {
      Alert.alert('Error', 'No se encontró el ID del empleado.');
      return;
    }

    try {
      if (!attendanceData || !attendanceData.marca || !attendanceData.marca.id) {
        throw new Error('No se encontró la marca');
      }

      const networkState = await Network.getNetworkStateAsync();

      let data = null;

      if (networkState.isConnected && networkState.isInternetReachable) {
        data = await saveAbsentReason({ reason, marcaId: attendanceData.marca.id, refreshAccessToken, logout });
      }
      else {
        await AsyncStorage.setItem('absent_reason_cache', JSON.stringify({ reason, marcaId: attendanceData.marca.id }));
        data = { status: true, message: 'Motivo de ausencia registrado correctamente' };
      }

      if (data.status) {
        Alert.alert('Éxito', 'Motivo de ausencia registrado correctamente');
        // Refresh the attendance status
        await fetchAttendanceStatus();
      } else {
        throw new Error(data.message || 'Error al registrar el motivo de ausencia');
      }
    } catch (error) {
      console.error('Error submitting absent reason:', error);
      Alert.alert('Error', 'No se pudo registrar el motivo de ausencia. Por favor, intenta nuevamente.');
    }
  };

  const getNextTime = (nextTime: string) => {
    const date = new Date(nextTime);

    let hours = date.getUTCHours(); // <-- usa getUTCHours() para evitar ajustes de zona
    const minutes = date.getUTCMinutes();

    const ampm = hours >= 12 ? "pm" : "am";
    hours = hours % 12 || 12; // convierte 0 → 12 y 13–23 → 1–11

    const formatted = `${hours}:${minutes.toString().padStart(2, "0")} ${ampm}`;
    return formatted;
  };

  const getDisability = () => {
    if (!attendanceData) return true;
    
    if (attendanceData.estado === 'Ingresado' && !attendanceData.change_available) return true;

    return false;
  }

  const getLunchTimeConfig = async (marcaId: number) => {
    await AsyncStorage.removeItem('lunch_time_config');
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }
    const token = await AsyncStorage.getItem('access_token');
    if (!token) {
      throw new Error('No authentication token found');
    }

    const response = await fetch(`${apiUrl}/api/lunch-time/${marcaId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });
    console.log("getLunchTimeConfig");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} getLunchTimeConfig`);
    }
    const data = await response.json();
    
    if (data.status) {
      await AsyncStorage.setItem('lunch_time_config', JSON.stringify(data));
    }
  }

  const getActivities = async (marcaId: number) => {  
    // Eliminar actions
    await AsyncStorage.removeItem('activities_actions');
    await AsyncStorage.removeItem('activities_cache');
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }
    const token = await AsyncStorage.getItem('access_token');
    if (!token) {
      throw new Error('No authentication token found');
  }
    const response = await fetch(`${apiUrl}/api/activities/marca/${marcaId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} getActivities`);
    }
    const data = await response.json();
    if (data.status) {
      await AsyncStorage.setItem('activities_cache', JSON.stringify(data.actividades));
    }
  }

  const getVehicles = async (marcaId: number) => {
    // Eliminar actions
    await AsyncStorage.removeItem('vehicles_actions');
    await AsyncStorage.removeItem('vehicles_cache');
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }
    const token = await AsyncStorage.getItem('access_token');
    if (!token) {
      throw new Error('No authentication token found');
    }

    const response = await fetch(`${apiUrl}/api/vehicles?m=${marcaId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });
    console.log("getVehicles");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} getVehicles`);
    }
    const data = await response.json();
    if (data.status) {
      await AsyncStorage.setItem('vehicles_cache', JSON.stringify(data));
    }
  }
  
  const getVisitors = async (marcaId: number) => {
    // Eliminar actions
    await AsyncStorage.removeItem('visitors_actions');
    await AsyncStorage.removeItem('visitors_cache');
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }
    const token = await AsyncStorage.getItem('access_token');
    if (!token) {
      throw new Error('No authentication token found');
    }

    const response = await fetch(`${apiUrl}/api/visitors?m=${marcaId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });
    console.log("getVisitors");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} getVisitors`);
    }
    const data = await response.json();
    if (data.status) {
      await AsyncStorage.setItem('visitors_cache', JSON.stringify(data.data));
    }
  }

  const handleCreateTestMarca = () => {
    if (!employee?.id) {
      Alert.alert('Error', 'No se encontró el ID del empleado.');
      return;
    }

    Alert.alert(
      'Confirmar creación de marca de prueba',
      '¿Estás seguro de que deseas crear una marca de prueba? Esta acción es solo para desarrollo.',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Crear',
          style: 'default',
          onPress: () => executeCreateTestMarca(),
        },
      ],
      { cancelable: true }
    );
  };

  const executeCreateTestMarca = async () => {
    if (!employee?.id) {
      Alert.alert('Error', 'No se encontró el ID del empleado.');
      return;
    }

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

      const response = await fetch(`${apiUrl}/api/attendance/${employee.id}/dev-create-marca`, {
        method: 'POST',
        body: JSON.stringify({
          dev: employee.id,
        }),
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '69420',
        },
      });

      if (response.status === 401 || response.status === 403) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          return executeCreateTestMarca();
        } else {
          await logout();
          return;
        }
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.status) {
        Alert.alert('Éxito', 'Marca de prueba creada correctamente');
        // Recargar la ventana
        await fetchAttendanceStatus();
      } else {
        throw new Error(data.message || 'Error al crear la marca de prueba');
      }
    } catch (error: any) {
      console.error('Error creating test marca:', error);
      Alert.alert('Error', error.message || 'No se pudo crear la marca de prueba. Por favor, intenta nuevamente.');
    }
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
        <ThemedText style={styles.loadingText}>Cargando...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.fullContainer}>
      <AppHeader onMenuPress={handleMenuPress} title="Marcar Ingreso/Salida" />
      
      <ScrollView style={styles.scrollView}>
        <ThemedView style={styles.container}>
          {/* Module Title */}
          <ThemedView style={styles.titleContainer}>
            <ThemedText type="title" style={styles.title}>
              {getActionIcon('marcar-ingreso-salida')} Marcar Ingreso/Salida
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              Control de asistencia
            </ThemedText>
          </ThemedView>
          {/* Test Button - Always Visible */}
          <ThemedView style={styles.testButtonContainer}>
            <TouchableOpacity
              style={[
                styles.testButton
              ]}
              onPress={handleCreateTestMarca}
            >
              <ThemedText style={styles.testButtonText}>
                Crear marca (Solo pruebas)
              </ThemedText>
            </TouchableOpacity>
          </ThemedView>

          {/* Content Section */}
          {isLoadingLocation ? (
            <ThemedView style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <ThemedText style={styles.loadingDataText}>
                Obteniendo ubicación...
              </ThemedText>
            </ThemedView>
          ) : locationError ? (
            <ThemedView style={styles.errorContainer}>
              <ThemedText style={styles.errorText}>{getActionIcon('warning')} {locationError}</ThemedText>
              <TouchableOpacity 
                style={styles.retryButton}
                onPress={async () => {
                  setLocationError(null);
                  setIsLoadingLocation(true);
                  try {
                    // Verificar permisos
                    const { status: permissionStatus } = await Location.requestForegroundPermissionsAsync();
                    if (permissionStatus !== 'granted') {
                      setLocationError('Permiso de ubicación denegado. Por favor, activa la ubicación en la configuración de tu dispositivo.');
                      setIsLoadingLocation(false);
                      return;
                    }

                    // Verificar que los servicios de ubicación estén habilitados
                    const isLocationEnabled = await Location.hasServicesEnabledAsync();
                    if (!isLocationEnabled) {
                      setLocationError('Los servicios de ubicación están desactivados. Por favor, activa la ubicación en tu dispositivo.');
                      setIsLoadingLocation(false);
                      return;
                    }

                    // Obtener ubicación
                    const loc = await Location.getCurrentPositionAsync({
                      accuracy: Location.Accuracy.High,
                    });
                    setLocation(loc);
                    setIsLoadingLocation(false);
                    
                    // Llamar a fetchAttendanceStatus para cargar los datos inmediatamente
                    await fetchAttendanceStatus();
                  } catch (err) {
                    console.error('Error obteniendo ubicación GPS:', err);
                    setLocationError('Error al obtener la ubicación GPS. Por favor, verifica que los servicios de ubicación estén habilitados.');
                    setIsLoadingLocation(false);
                  }
                }}
              >
                <ThemedText style={styles.retryButtonText}>{getActionIcon('retry')}</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          ) : isLoadingData ? (
            <ThemedView style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <ThemedText style={styles.loadingDataText}>
                Cargando datos de asistencia...
              </ThemedText>
            </ThemedView>
          ) : errorMessage ? (
            <ThemedView style={styles.errorContainer}>
              {/* Absent Reason Form */}
              {showAbsentReasonForm && (
                <ThemedView style={styles.absentReasonContainer}>
                  <ThemedText style={styles.absentReasonTitle}>
                    Motivo de ausencia
                  </ThemedText>
                  <ThemedText style={styles.absentReasonSubtitle}>
                    Por favor, ingresa el motivo de tu ausencia:
                  </ThemedText>
                  
                  <TextInput
                    style={styles.absentReasonInput}
                    value={absentReason}
                    onChangeText={setAbsentReason}
                    placeholder="Ej: Enfermedad, emergencia familiar, cita médica..."
                    placeholderTextColor="#999"
                    multiline={true}
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                  
                  <ThemedView style={styles.absentReasonButtons}>
                    
                    <TouchableOpacity
                      style={[styles.absentReasonButton, styles.absentReasonSubmitButton]}
                      onPress={handleAbsentReasonSubmit}
                    >
                      <ThemedText style={styles.absentReasonSubmitButtonText}>
                        {getActionIcon('confirm')}
                      </ThemedText>
                    </TouchableOpacity>
                  </ThemedView>
                </ThemedView>
              )}
              
              <ThemedText style={styles.errorText}>{getActionIcon('warning')} {errorMessage}</ThemedText>
              <TouchableOpacity 
                style={styles.retryButton}
                onPress={fetchAttendanceStatus}
              >
                <ThemedText style={styles.retryButtonText}>{getActionIcon('retry')}</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          ) : attendanceData ? (
            <ThemedView style={styles.contentContainer}>
              <ThemedText style={styles.currentTime}>{attendanceData ? getNextTime(attendanceData?.current_time) : ''}</ThemedText>
              {/* Work Information Card */}
              <ThemedView style={styles.infoCard}>
                <ThemedText style={styles.infoCardTitle}>Información Laboral</ThemedText>
                
                <ThemedView style={styles.infoRow}>
                  <ThemedText style={styles.infoLabel}>Empresa:</ThemedText>
                  <ThemedText style={styles.infoValue}>{attendanceData.marca.empresa.nombre}</ThemedText>
                </ThemedView>

                <ThemedView style={styles.infoRow}>
                  <ThemedText style={styles.infoLabel}>Cliente:</ThemedText>
                  <ThemedText style={styles.infoValue}>{attendanceData.marca.cliente.nombre}</ThemedText>
                </ThemedView>

                <ThemedView style={styles.infoRow}>
                  <ThemedText style={styles.infoLabel}>Contrato:</ThemedText>
                  <ThemedText style={styles.infoValue}>{attendanceData.marca.contrato.nombre}</ThemedText>
                </ThemedView>

                <ThemedView style={styles.infoRow}>
                  <ThemedText style={styles.infoLabel}>Corpo:</ThemedText>
                  <ThemedText style={styles.infoValue}>{attendanceData.marca.corpo.nombre}</ThemedText>
                </ThemedView>

                <ThemedView style={styles.infoRow}>
                  <ThemedText style={styles.infoLabel}>Puesto:</ThemedText>
                  <ThemedText style={styles.infoValue}>{attendanceData.marca.puesto.nombre}</ThemedText>
                </ThemedView>

                <ThemedView style={styles.infoRow}>
                  <ThemedText style={styles.infoLabel}>Plaza:</ThemedText>
                  <ThemedText style={styles.infoValue}>{attendanceData.marca.plaza.nombre}</ThemedText>
                </ThemedView>

                <ThemedView style={styles.infoRow}>
                  <ThemedText style={styles.infoLabel}>Horario:</ThemedText>
                  <ThemedText style={styles.infoValue}>{attendanceData.marca.horario.nombre}</ThemedText>
                </ThemedView>
              </ThemedView>

              {/* Status Display */}
              <ThemedView style={styles.statusCard}>
                <ThemedView style={styles.nextTimeContainer}>
                  <ThemedText style={styles.statusLabel}>
                    Estado actual:
                  </ThemedText>
                  <ThemedView style={[
                    styles.statusBadge,
                    attendanceData.estado === 'Ingresado' ? styles.statusBadgeWorking : styles.statusBadgeOffline
                  ]}>
                    <ThemedText style={styles.statusText}>
                      {attendanceData.estado === 'Ingresado' ? 'Ingresado' : 'No ingresado'}
                    </ThemedText>
                  </ThemedView>
                </ThemedView>

                {/* Next Time */}
                <ThemedView style={[styles.nextTimeContainer, { marginTop: 10 }]}>
                  <ThemedText style={styles.nextTimeLabel}>{attendanceData.estado === 'Ingresado' ? 'Hora de salida:' : 'Hora de entrada:'}</ThemedText>
                  <ThemedText style={styles.nextTimeValue}>
                    {getNextTime(attendanceData.next_time)}
                  </ThemedText>
                </ThemedView>

                {/* Late Warning */}
                {attendanceData.is_late && (
                  <ThemedView style={styles.lateWarning}>
                    <ThemedText style={styles.lateWarningText}>
                      {getActionIcon('warning')} Tienes una tardía
                    </ThemedText>
                  </ThemedView>
                )}
              </ThemedView>

              {/* Action Button */}
              <ThemedView style={styles.actionContainer}>
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    attendanceData.estado === 'Ingresado' ? styles.endShiftButton : styles.startShiftButton,
                    (getDisability() || isUpdating) && styles.actionButtonDisabled
                  ]}
                  onPress={handleToggleAttendance}
                  disabled={getDisability() || isUpdating}
                >
                  {isUpdating ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <ThemedText style={styles.actionButtonText}>
                      {attendanceData.estado === 'No ingresado' ? getActionIcon('start') : getActionIcon('end')}
                    </ThemedText>
                  )}
                </TouchableOpacity>
              </ThemedView>
            </ThemedView>
          ) : null}
        </ThemedView>
      </ScrollView>

      <SlideMenu 
        isVisible={isMenuVisible} 
        onClose={handleMenuClose}
        onHomePress={handleHomePress}
        currentRoute="marcar-ingreso-salida"
      />
      
      {/* Modal for early exit reason */}
      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleModalCancel}
      >
        <ThemedView style={styles.modalOverlay}>
          <ThemedView style={styles.modalContainer}>
            <ThemedText style={styles.modalTitle}>
              Razón de salida anticipada
            </ThemedText>
            <ThemedText style={styles.modalSubtitle}>
              Por favor, ingresa la razón por la cual sales antes de tiempo:
            </ThemedText>
            
            <TextInput
              style={styles.modalInput}
              value={exitReason}
              onChangeText={setExitReason}
              placeholder="Ej: Cita médica, emergencia familiar..."
              placeholderTextColor="#999"
              multiline={true}
              numberOfLines={3}
              textAlignVertical="top"
            />
            
            <ThemedView style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={handleModalCancel}
              >
                <ThemedText style={styles.modalCancelButtonText}>
                  {getActionIcon('cancel')}
                </ThemedText>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirmButton]}
                onPress={handleModalConfirm}
              >
                <ThemedText style={styles.modalConfirmButtonText}>
                  {getActionIcon('confirm')}
                </ThemedText>
              </TouchableOpacity>
            </ThemedView>
          </ThemedView>
        </ThemedView>
      </Modal>
      
      
      <AppFooter />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fullContainer: {
    flex: 1,
  },
  currentTime: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: '#F8F9FA',
    color: '#007AFF',
    padding: 10,
    borderRadius: 8,
  },
  scrollView: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 20,
  },
  backButton: {
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 30,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
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
    gap: 16,
    minHeight: 300,
  },
  loadingDataText: {
    fontSize: 16,
    opacity: 0.7,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 20,
    minHeight: 300,
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
    lineHeight: 24,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  contentContainer: {
    flex: 1,
    gap: 30,
  },
  infoCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 20,
    gap: 12,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoCardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
    color: '#007AFF',
  },
  infoRow: {
    display: 'flex',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#F8F9FA',
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    flex: 1,
  },
  infoValue: {
    fontSize: 10,
    fontWeight: '500',
    color: '#333333',
    flex: 2,
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    gap: 5,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusContainer: {
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 10,
    borderRadius: 8,
  },
  statusLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666666',
  },
  statusBadge: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
    minWidth: 200,
    alignItems: 'center',
  },
  statusBadgeWorking: {
    backgroundColor: '#34C759',
  },
  statusBadgeOffline: {
    backgroundColor: '#8E8E93',
  },
  statusText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  nextTimeContainer: {
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#D1E6FF',
    padding: 10,
    borderRadius: 8,
  },
  nextTimeLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666666',
  },
  nextTimeValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
  },
  lateWarning: {
    backgroundColor: '#FF3B30',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 8,
  },
  lateWarningText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  actionContainer: {
    
  },
  actionButton: {
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 12,
    minWidth: 250,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  startShiftButton: {
    backgroundColor: '#34C759',
  },
  endShiftButton: {
    backgroundColor: '#FF3B30',
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 16,
    opacity: 0.7,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#333333',
  },
  modalSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#666666',
    lineHeight: 22,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#F8F9FA',
    marginBottom: 24,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: '#FAFAFA'
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: '#E0E0E0',
  },
  modalConfirmButton: {
    backgroundColor: '#FF3B30',
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  modalConfirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  absentReasonContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  absentReasonTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#333333',
  },
  absentReasonSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    color: '#666666',
    lineHeight: 20,
  },
  absentReasonInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#F8F9FA',
    marginBottom: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  absentReasonButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: '#FAFAFA',
  },
  absentReasonButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  absentReasonCancelButton: {
    backgroundColor: '#E0E0E0',
  },
  absentReasonSubmitButton: {
    backgroundColor: '#FF3B30',
  },
  absentReasonCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  absentReasonSubmitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  testButtonContainer: {
    marginBottom: 20,
  },
  testButton: {
    backgroundColor: '#FF9500',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  testButtonDisabled: {
    opacity: 0.6,
  },
  testButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

