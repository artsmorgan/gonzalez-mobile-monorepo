import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Modal, View, Platform, Image } from 'react-native';
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
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Network from 'expo-network';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { createVehicle as createVehicleAPI, updateVehicle as updateVehicleAPI, deleteVehicle as deleteVehicleAPI } from '@/hooks/vehiclesFunctions';
import getHoraAccion from '@/hooks/getHoraAccion';
import { eventBus } from '@/hooks/eventBus';

type VehiclesScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Vehicles'>;

interface Responsable {
  id: number;
  nombre: string;
}

interface Vehicle {
  id: number;
  tipo: 'Particular' | 'Institucional';
  placa: string;
  nombre_propietario: string;
  cedula_propietario: string;
  hora_entrada: string;
  hora_salida: string | null;
  razon_visita: string;
  responsable: Responsable;
  created_at: string;
  id_local: string;
  base64_image: string;
}

interface VehiclesResponse {
  status: boolean;
  data?: Vehicle[];
  message?: string;
}

interface EditingVehicle {
  id: number | null;
  id_local: string;
  tipo: 'Particular' | 'Institucional';
  placa: string;
  nombre_propietario: string;
  cedula_propietario: string;
  hora_entrada_h: string;
  hora_entrada_m: string;
  hora_salida_h: string;
  hora_salida_m: string;
  razon_visita: string;
  base64_image?: string;
}

export default function VehiclesScreen() {
  const { employee, refreshAccessToken, logout } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<VehiclesScreenNavigationProp>();
  
  // Vehicles state
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasCurrentMarca, setHasCurrentMarca] = useState<boolean>(false);
  
  // Editing state
  const [editingVehicle, setEditingVehicle] = useState<EditingVehicle | null>(null);
  
  // Creating state
  const [isCreating, setIsCreating] = useState(false);
  const [newVehicle, setNewVehicle] = useState<EditingVehicle>({
    id: null,
    id_local: '',
    tipo: 'Particular',
    placa: '',
    nombre_propietario: '',
    cedula_propietario: '',
    hora_entrada_h: '',
    hora_entrada_m: '',
    hora_salida_h: '',
    hora_salida_m: '',
    razon_visita: '',
    base64_image: '',
  });

  // Camera state
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [vehicleImageBase64, setVehicleImageBase64] = useState<string | null>(null);
  const [isEditingImage, setIsEditingImage] = useState(false);
  const [editingVehicleServerImage, setEditingVehicleServerImage] = useState<string | null>(null);
  
  // Form refs for text inputs
  const tipoRef = useRef<'Particular' | 'Institucional'>('Particular');
  const placaRef = useRef('');
  const nombrePropietarioRef = useRef('');
  const cedulaPropietarioRef = useRef('');
  const horaEntradaHRef = useRef('');
  const horaEntradaMRef = useRef('');
  const horaSalidaHRef = useRef('');
  const horaSalidaMRef = useRef('');
  const razonVisitaRef = useRef('');
  
  const syncTimeFields = (
    entradaH: string,
    entradaM: string,
    salidaH: string,
    salidaM: string,
  ) => {
    horaEntradaHRef.current = entradaH || '';
    horaEntradaMRef.current = entradaM || '';
    horaSalidaHRef.current = salidaH || '';
    horaSalidaMRef.current = salidaM || '';
    setHoraEntradaDisplay(
      entradaH && entradaM ? `${entradaH.padStart(2, '0')}:${entradaM.padStart(2, '0')}` : ''
    );
    setHoraSalidaDisplay(
      salidaH && salidaM ? `${salidaH.padStart(2, '0')}:${salidaM.padStart(2, '0')}` : ''
    );
  };

  const buildDateFromParts = (hours: string, minutes: string) => {
    const baseDate = new Date();
    const h = parseInt(hours || '0', 10);
    const m = parseInt(minutes || '0', 10);
    baseDate.setHours(isNaN(h) ? 0 : h, isNaN(m) ? 0 : m, 0, 0);
    return baseDate;
  };

  const openHoraEntradaPicker = () => {
    const baseDate = buildDateFromParts(horaEntradaHRef.current, horaEntradaMRef.current);
    setHoraEntradaPickerValue(baseDate);
    setShowHoraEntradaPicker(true);
  };

  const handleHoraEntradaPickerChange = (event: any, selectedTime?: Date) => {
    if (Platform.OS === 'android') {
      setShowHoraEntradaPicker(false);
    }
    if (!selectedTime) return;
    setHoraEntradaPickerValue(selectedTime);
    const hours = selectedTime.getHours().toString().padStart(2, '0');
    const minutes = selectedTime.getMinutes().toString().padStart(2, '0');
    syncTimeFields(hours, minutes, horaSalidaHRef.current, horaSalidaMRef.current);
  };

  const openHoraSalidaPicker = () => {
    const baseDate = buildDateFromParts(horaSalidaHRef.current, horaSalidaMRef.current);
    setHoraSalidaPickerValue(baseDate);
    setShowHoraSalidaPicker(true);
  };

  const handleHoraSalidaPickerChange = (event: any, selectedTime?: Date) => {
    if (Platform.OS === 'android') {
      setShowHoraSalidaPicker(false);
    }
    if (!selectedTime) return;
    setHoraSalidaPickerValue(selectedTime);
    const hours = selectedTime.getHours().toString().padStart(2, '0');
    const minutes = selectedTime.getMinutes().toString().padStart(2, '0');
    syncTimeFields(horaEntradaHRef.current, horaEntradaMRef.current, hours, minutes);
  };

  const clearHoraSalida = () => {
    syncTimeFields(horaEntradaHRef.current, horaEntradaMRef.current, '', '');
    setHoraSalidaPickerValue(buildDateFromParts('', ''));
    setShowHoraSalidaPicker(false);
  };
  
  // Minimal state for Picker (needs controlled value)
  const [vehicleTipo, setVehicleTipo] = useState<'Particular' | 'Institucional'>('Particular');
  
  // Time picker state
  const [showHoraEntradaPicker, setShowHoraEntradaPicker] = useState(false);
  const [horaEntradaPickerValue, setHoraEntradaPickerValue] = useState(new Date());
  const [horaEntradaDisplay, setHoraEntradaDisplay] = useState('');
  const [showHoraSalidaPicker, setShowHoraSalidaPicker] = useState(false);
  const [horaSalidaPickerValue, setHoraSalidaPickerValue] = useState(new Date());
  const [horaSalidaDisplay, setHoraSalidaDisplay] = useState('');
  
  // Filters state
  const [searchText, setSearchText] = useState('');
  const [selectedTipo, setSelectedTipo] = useState<string>('all');
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchVehicles();
    }, [])
  );

  useEffect(() => {
    const handler = () => {
      fetchVehicles();
    };

    eventBus.on('connectionRestored', handler);
    return () => {
      eventBus.off('connectionRestored', handler);
    };
  }, []);

  // Función auxiliar para generar ID aleatorio
  const generateRandomId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 10; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const fetchVehicles = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Verificar si existe current_marca
      const currentMarca = await AsyncStorage.getItem('current_marca');
      if (!currentMarca) {
        setHasCurrentMarca(false);
        setIsLoading(false);
        return;
      }

      const currentMarcaData = JSON.parse(currentMarca);
      const marcaId = currentMarcaData.id;
      setHasCurrentMarca(true);

      // Verificar conectividad
      const isConnected = await getConnectionStatus();

      if (isConnected) {
        // Con internet: hacer fetch normal
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

        const response = await fetch(`${apiUrl}/api/vehicles?m=${marcaId}`, {
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
            return fetchVehicles();
          } else {
            Alert.alert('15', 'Sesión expirada. Por favor inicie sesión nuevamente.');
            await logout();
            return;
          }
        }

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data: VehiclesResponse = await response.json();

        if (data.status && data.data) {
          setVehicles(data.data);
          // Actualizar vehicles_cache preservando base64_image
          await AsyncStorage.setItem('vehicles_cache', JSON.stringify(data.data));
        } else {
          setError(data.message || 'Error al cargar los vehículos');
          Alert.alert('Error', data.message || 'Error al cargar los vehículos');
        }
      } else {
        // Sin internet: cargar desde cache
        const vehiclesCache = await AsyncStorage.getItem('vehicles_cache');
        if (vehiclesCache) {
          const cachedVehicles = JSON.parse(vehiclesCache);
          // Añadir base64_image vacío si no existe
          const vehiclesWithBase64 = cachedVehicles.map((v: Vehicle) => ({
            ...v,
            base64_image: v.base64_image || '',
          }));
          setVehicles(vehiclesWithBase64);
          Alert.alert('Modo Offline', 'No hay conexión a internet. Mostrando datos guardados.');
        } else {
          setError('No hay datos guardados y no hay conexión a internet');
          Alert.alert('Sin conexión', 'No hay conexión a internet y no hay datos guardados previamente.');
          setVehicles([]);
        }
      }
    } catch (err) {
      console.error('Error fetching vehicles:', err);
      // En caso de error, intentar cargar desde cache
      try {
        const vehiclesCache = await AsyncStorage.getItem('vehicles_cache');
        if (vehiclesCache) {
          const cachedVehicles = JSON.parse(vehiclesCache);
          // Añadir base64_image vacío si no existe
          const vehiclesWithBase64 = cachedVehicles.map((v: Vehicle) => ({
            ...v,
            base64_image: v.base64_image || '',
          }));
          setVehicles(vehiclesWithBase64);
          Alert.alert('Modo Offline', 'Error de conexión. Mostrando datos guardados.');
        } else {
          setError('Error al cargar los vehículos');
          Alert.alert('Error', 'No se pudieron cargar los vehículos');
        }
      } catch (cacheErr) {
        setError('Error al cargar los vehículos');
        Alert.alert('Error', 'No se pudieron cargar los vehículos');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getConnectionStatus = async (): Promise<boolean> => {
    const networkState = await Network.getNetworkStateAsync();
      return networkState.isConnected && networkState.isInternetReachable ? true : false;
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
        setVehicleImageBase64(formattedBase64);
      }, 100);
    } catch (error) {
      console.error('Error capturing image:', error);
      Alert.alert('Error', 'No se pudo capturar la imagen');
      setIsCameraVisible(false);
    }
  };

  const createVehicle = async () => {
    // Validaciones
    if (!placaRef.current.trim()) {
      Alert.alert('Error', 'La placa es obligatoria');
      return;
    }

    if (!nombrePropietarioRef.current.trim()) {
      Alert.alert('Error', 'El nombre del propietario es obligatorio');
      return;
    }

    if (!cedulaPropietarioRef.current.trim()) {
      Alert.alert('Error', 'La cédula del propietario es obligatoria');
      return;
    }

    if (!horaEntradaHRef.current || !horaEntradaMRef.current) {
      Alert.alert('Error', 'La hora de entrada es obligatoria');
      return;
    }

    if (!razonVisitaRef.current.trim()) {
      Alert.alert('Error', 'La razón de visita es obligatoria');
      return;
    }

    Alert.alert(
      'Confirmar creación',
      '¿Estás seguro de que deseas crear este registro de vehículo?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Crear',
          onPress: async () => {
            try {
              const currentMarca = await AsyncStorage.getItem('current_marca');
              if (!currentMarca) {
                Alert.alert('Error', 'No se encontró la marca actual');
                return;
              }

              const currentMarcaData = JSON.parse(currentMarca);

              // Construir hora_entrada y hora_salida
              const hora_entrada = `${horaEntradaHRef.current.padStart(2, '0')}:${horaEntradaMRef.current.padStart(2, '0')}`;
              const hora_salida = (horaSalidaHRef.current && horaSalidaMRef.current) 
                ? `${horaSalidaHRef.current.padStart(2, '0')}:${horaSalidaMRef.current.padStart(2, '0')}`
                : null;

              const { converted_hora_entrada, converted_hora_salida } = convert_date(currentMarcaData, hora_entrada, hora_salida);

              console.log("converted_hora_entrada", converted_hora_entrada);
              console.log("converted_hora_salida", converted_hora_salida);

              const requestBody: any = {
                marca_id: currentMarcaData.id,
                tipo: tipoRef.current,
                placa: placaRef.current,
                nombre: nombrePropietarioRef.current,
                cedula: cedulaPropietarioRef.current,
                hora_entrada: converted_hora_entrada,
                hora_salida: converted_hora_salida,
                razon_visita: razonVisitaRef.current,
              };

              // Add image if captured (already formatted as data:image/jpeg;base64,...)
              if (vehicleImageBase64 && vehicleImageBase64.trim() !== '') {
                requestBody.file = vehicleImageBase64;
              } else {
                requestBody.file = null;
              }

              // Verificar conectividad
              const isConnected = await getConnectionStatus();

              if (isConnected) {
                // Con internet: llamar a la función API
                const data = await createVehicleAPI({
                  requestData: requestBody,
                  marcaId: currentMarcaData.id,
                  refreshAccessToken,
                  logout,
                });

                if (data.status) {
                  Alert.alert('Éxito', data.message || 'Vehículo registrado correctamente');
                  setIsCreating(false);
                  setNewVehicle({
                    id: null,
                    id_local: '',
                    tipo: 'Particular',
                    placa: '',
                    nombre_propietario: '',
                    cedula_propietario: '',
                    hora_entrada_h: '',
                    hora_entrada_m: '',
                    hora_salida_h: '',
                    hora_salida_m: '',
                    razon_visita: '',
                    base64_image: '',
                  });
                  syncTimeFields('', '', '', '');
                  setHoraEntradaPickerValue(buildDateFromParts('', ''));
                  setHoraSalidaPickerValue(buildDateFromParts('', ''));
                  setShowHoraEntradaPicker(false);
                  setShowHoraSalidaPicker(false);
                  setVehicleImageBase64(null);
                  fetchVehicles();
                } else {
                  Alert.alert('Error', data.message || 'Error al registrar el vehículo');
                }
              } else {
                // Sin internet: modo offline
                const localId = generateRandomId();
                const horaAccion = await getHoraAccion();

                // Crear entrada en vehicles_actions
                const actionsStr = await AsyncStorage.getItem('vehicles_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  requestData: requestBody,
                  marcaId: currentMarcaData.id,
                  id: localId,
                  type: 'create',
                });
                await AsyncStorage.setItem('vehicles_actions', JSON.stringify(actions));

                // Crear vehículo en cache
                const cacheStr = await AsyncStorage.getItem('vehicles_cache');
                const cache = cacheStr ? JSON.parse(cacheStr) : [];
                
                const newVehicleCache = {
                  id: 0,
                  tipo: tipoRef.current,
                  placa: placaRef.current,
                  nombre_propietario: nombrePropietarioRef.current,
                  cedula_propietario: cedulaPropietarioRef.current,
                  hora_entrada: converted_hora_entrada.toString(),
                  hora_salida: converted_hora_salida ? converted_hora_salida.toString() : null,
                  razon_visita: razonVisitaRef.current,
                  responsable: {
                    id: parseInt(employee?.id || '0'),
                    nombre: employee?.name || 'Desconocido',
                  },
                  created_at: new Date(horaAccion).toISOString(),
                  id_local: localId,
                  base64_image: (vehicleImageBase64 && vehicleImageBase64.trim() !== '') ? vehicleImageBase64 : '',
                };

                cache.push(newVehicleCache);
                await AsyncStorage.setItem('vehicles_cache', JSON.stringify(cache));

                Alert.alert('Modo Offline', 'Vehículo registrado localmente. Se sincronizará cuando haya conexión.');
                setIsCreating(false);
                setNewVehicle({
                  id: null,
                  id_local: '',
                  tipo: 'Particular',
                  placa: '',
                  nombre_propietario: '',
                  cedula_propietario: '',
                  hora_entrada_h: '',
                  hora_entrada_m: '',
                  hora_salida_h: '',
                  hora_salida_m: '',
                  razon_visita: '',
                  base64_image: '',
                });
                syncTimeFields('', '', '', '');
                setHoraEntradaPickerValue(buildDateFromParts('', ''));
                setHoraSalidaPickerValue(buildDateFromParts('', ''));
                setShowHoraEntradaPicker(false);
                setShowHoraSalidaPicker(false);
                setVehicleImageBase64(null);
                fetchVehicles();
              }
            } catch (err) {
              console.error('Error creating vehicle:', err);
              Alert.alert('Error', 'No se pudo registrar el vehículo');
            }
          },
        },
      ]
    );
  };

  const convert_date = (currentMarca: any, hora_entrada: string, hora_salida: string | null) => {
    const fechaSplit = currentMarca.fecha.split("T")[0];
    const year = fechaSplit.split("-")[0];
    const month = fechaSplit.split("-")[1];
    const day = fechaSplit.split("-")[2];

    const horaInicioSplit = currentMarca.hora_inicio ? currentMarca.hora_inicio.split("T")[1].split(":") : null;

    const hora_entrada_raw = hora_entrada.split(":");

    let final_day_initial = day;
    if (horaInicioSplit && parseInt(horaInicioSplit[0]) > parseInt(hora_entrada_raw[0])) {
        final_day_initial = (parseInt(day) + 1).toString().padStart(2, "0");
    }

    let final_day_final = day;
    if (hora_salida) {
        const hora_salida_raw = hora_salida.split(":");
        if (horaInicioSplit && parseInt(horaInicioSplit[0]) > parseInt(hora_salida_raw[0])) {
            final_day_final = (parseInt(day) + 1).toString().padStart(2, "0");
        }
    }

    const hora_entrada_converted = year + "-" + month + "-" + final_day_initial + "T" + hora_entrada_raw[0] + ":" + hora_entrada_raw[1] + ":00.000Z";
    const hora_salida_converted = hora_salida ? year + "-" + month + "-" + final_day_final + "T" + hora_salida.split(":")[0] + ":" + hora_salida.split(":")[1] + ":00.000Z" : null;

    return { converted_hora_entrada: hora_entrada_converted, converted_hora_salida: hora_salida_converted };
  };

  const updateVehicle = async (vehicleId: number) => {
    if (!editingVehicle) return;

    // Validaciones
    if (!placaRef.current.trim()) {
      Alert.alert('Error', 'La placa es obligatoria');
      return;
    }

    if (!nombrePropietarioRef.current.trim()) {
      Alert.alert('Error', 'El nombre del propietario es obligatorio');
      return;
    }

    if (!cedulaPropietarioRef.current.trim()) {
      Alert.alert('Error', 'La cédula del propietario es obligatoria');
      return;
    }

    if (!horaEntradaHRef.current || !horaEntradaMRef.current) {
      Alert.alert('Error', 'La hora de entrada es obligatoria');
      return;
    }

    if (!razonVisitaRef.current.trim()) {
      Alert.alert('Error', 'La razón de visita es obligatoria');
      return;
    }

    Alert.alert(
      'Confirmar edición',
      '¿Estás seguro de que deseas guardar los cambios?',
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

              // Construir hora_entrada y hora_salida
              const hora_entrada = `${horaEntradaHRef.current.padStart(2, '0')}:${horaEntradaMRef.current.padStart(2, '0')}`;
              const hora_salida = (horaSalidaHRef.current && horaSalidaMRef.current) 
                ? `${horaSalidaHRef.current.padStart(2, '0')}:${horaSalidaMRef.current.padStart(2, '0')}`
                : null;

              const { converted_hora_entrada, converted_hora_salida } = convert_date(currentMarcaData, hora_entrada, hora_salida);

              const requestBody: any = {
                marca_id: currentMarcaData.id,
                tipo: tipoRef.current,
                placa: placaRef.current,
                nombre: nombrePropietarioRef.current,
                cedula: cedulaPropietarioRef.current,
                hora_entrada: converted_hora_entrada,
                hora_salida: converted_hora_salida,
                razon_visita: razonVisitaRef.current,
              };

              // Add image if captured (already formatted as data:image/jpeg;base64,...)
              if (vehicleImageBase64 && vehicleImageBase64.trim() !== '') {
                requestBody.file = vehicleImageBase64;
              } else {
                requestBody.file = null;
              }

              // Verificar conectividad
              const isConnected = await getConnectionStatus();

              if (isConnected) {
                // Con internet: llamar a la función API
                const data = await updateVehicleAPI({
                  requestData: requestBody,
                  vehicleId: vehicleId,
                  marcaId: currentMarcaData.id,
                  refreshAccessToken,
                  logout,
                });

                if (data.status) {
                  Alert.alert('Éxito', data.message || 'Vehículo actualizado correctamente');
                  setEditingVehicle(null);
                  setVehicleImageBase64(null);
                  setIsEditingImage(false);
                  setEditingVehicleServerImage(null);
                  // Wait a bit for server to process, then fetch vehicles
                  setTimeout(() => {
                  fetchVehicles();
                  }, 500);
                } else {
                  Alert.alert('Error', data.message || 'Error al actualizar el vehículo');
                }
              } else {
                // Sin internet: modo offline
                const actionsStr = await AsyncStorage.getItem('vehicles_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];

                if (editingVehicle.id_local !== '') {
                  // Editar acción existente en vehicles_actions
                  const actionIndex = actions.findIndex((a: any) => a.id === editingVehicle.id_local);
                  if (actionIndex !== -1) {
                    actions[actionIndex].requestData = requestBody;
                    await AsyncStorage.setItem('vehicles_actions', JSON.stringify(actions));
                  }
                } else {
                  // Crear nueva acción de update en vehicles_actions
                  // Eliminar cualquier acción de update previa para este vehicleId
                  const filteredActions = actions.filter((a: any) => !(a.type === 'update' && a.id === vehicleId));
                  filteredActions.push({
                    requestData: requestBody,
                    id: vehicleId,
                    type: 'update',
                  });
                  await AsyncStorage.setItem('vehicles_actions', JSON.stringify(filteredActions));
                }

                // Actualizar vehicles_cache
                const cacheStr = await AsyncStorage.getItem('vehicles_cache');
                const cache = cacheStr ? JSON.parse(cacheStr) : [];
                
                const vehicleIndex = cache.findIndex((v: Vehicle) => 
                  editingVehicle.id_local !== '' ? v.id_local === editingVehicle.id_local : v.id === vehicleId
                );

                if (vehicleIndex !== -1) {
                  // Determine base64_image: use new image if captured, otherwise keep existing
                  let updatedBase64Image = '';
                  if (vehicleImageBase64 && vehicleImageBase64.trim() !== '') {
                    // New image was captured, use it
                    updatedBase64Image = vehicleImageBase64;
                  } else if (cache[vehicleIndex].base64_image && cache[vehicleIndex].base64_image.trim() !== '') {
                    // No new image captured, preserve existing base64_image
                    updatedBase64Image = cache[vehicleIndex].base64_image;
                  }
                  
                  cache[vehicleIndex] = {
                    ...cache[vehicleIndex],
                    tipo: tipoRef.current,
                    placa: placaRef.current,
                    nombre_propietario: nombrePropietarioRef.current,
                    cedula_propietario: cedulaPropietarioRef.current,
                    hora_entrada: converted_hora_entrada.toString(),
                    hora_salida: converted_hora_salida ? converted_hora_salida.toString() : null,
                    razon_visita: razonVisitaRef.current,
                    base64_image: updatedBase64Image,
                  };
                  await AsyncStorage.setItem('vehicles_cache', JSON.stringify(cache));
                }

                Alert.alert('Modo Offline', 'Vehículo actualizado localmente. Se sincronizará cuando haya conexión.');
                setEditingVehicle(null);
                setVehicleImageBase64(null);
                setIsEditingImage(false);
                setEditingVehicleServerImage(null);
                // Wait a bit to ensure cache is written, then fetch vehicles
                setTimeout(() => {
                fetchVehicles();
                }, 100);
              }
            } catch (err) {
              console.error('Error updating vehicle:', err);
              Alert.alert('Error', 'No se pudo actualizar el vehículo');
            }
          },
        },
      ]
    );
  };

  const deleteVehicle = async (vehicleId: number, id_local: string) => {
    Alert.alert(
      'Confirmar eliminación',
      '¿Estás seguro de que deseas eliminar este registro de vehículo?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              // Verificar conectividad
              const isConnected = await getConnectionStatus();

              if (isConnected) {
                // Con internet: llamar a la función API
                const data = await deleteVehicleAPI({
                  vehicleId: vehicleId,
                  refreshAccessToken,
                  logout,
                });

                if (data.status) {
                  Alert.alert('Éxito', data.message || 'Vehículo eliminado correctamente');
                  fetchVehicles();
                } else {
                  Alert.alert('Error', data.message || 'Error al eliminar el vehículo');
                }
              } else {
                // Sin internet: modo offline
                const actionsStr = await AsyncStorage.getItem('vehicles_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];

                if (id_local !== '') {
                  // Eliminar acciones con este id_local
                  const filteredActions = actions.filter((a: any) => a.id !== id_local);
                  await AsyncStorage.setItem('vehicles_actions', JSON.stringify(filteredActions));
                } else {
                  // Agregar acción de delete
                  actions.push({
                    id: vehicleId,
                    type: 'delete',
                  });
                  await AsyncStorage.setItem('vehicles_actions', JSON.stringify(actions));
                }

                // Eliminar de vehicles_cache
                const cacheStr = await AsyncStorage.getItem('vehicles_cache');
                const cache = cacheStr ? JSON.parse(cacheStr) : [];
                
                const filteredCache = cache.filter((v: Vehicle) => 
                  id_local !== '' ? v.id_local !== id_local : v.id !== vehicleId
                );
                await AsyncStorage.setItem('vehicles_cache', JSON.stringify(filteredCache));

                Alert.alert('Modo Offline', 'Vehículo eliminado localmente. Se sincronizará cuando haya conexión.');
                fetchVehicles();
              }
            } catch (err) {
              console.error('Error deleting vehicle:', err);
              Alert.alert('Error', 'No se pudo eliminar el vehículo');
            }
          },
        },
      ]
    );
  };

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'add': return <Ionicons name="add-sharp" size={20} color='#000000' />;
      case 'edit': return <Ionicons name="pencil" size={20} color='#FFFFFF' />;
      case 'delete': return <Ionicons name="trash" size={20} color='#FFFFFF' />;
      case 'vehicles': return <Ionicons name="car" size={25} color='#000000' />;
      case 'cancel': return <Ionicons name="close-sharp" size={20} color='#FFFFFF' />;
      case 'confirm': return <Ionicons name="checkmark-sharp" size={20} color='#FFFFFF' />;
      default: return <Ionicons name="close-sharp" size={20} color='#FFFFFF' />;
    }
  };

  const renderVehicleForm = (vehicle: EditingVehicle, isCreating: boolean) => {
    return (
      <ThemedView style={[styles.vehicleCard, styles.formCard]}>
        <ThemedText style={styles.formTitle}>
          {isCreating ? 'Nuevo Vehículo' : 'Editar Vehículo'}
        </ThemedText>

        {/* Tipo */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Tipo:</ThemedText>
          <ThemedView style={styles.pickerContainer}>
            <Picker
              selectedValue={vehicleTipo}
              onValueChange={(value) => {
                const tipoValue = value as 'Particular' | 'Institucional';
                tipoRef.current = tipoValue;
                setVehicleTipo(tipoValue);
              }}
              style={styles.picker}
            >
              <Picker.Item label="Particular" value="Particular" />
              <Picker.Item label="Institucional" value="Institucional" />
            </Picker>
          </ThemedView>
        </ThemedView>

        {/* Placa */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Placa:</ThemedText>
          <TextInput
            style={styles.formInput}
            defaultValue={vehicle.placa}
            onChangeText={(text) => { placaRef.current = text; }}
            placeholder="Ej: ABC-123"
            placeholderTextColor="#999"
            key={`placa-${isCreating ? 'create' : vehicle.id}`}
          />
        </ThemedView>

        {/* Nombre Propietario */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Nombre del Propietario:</ThemedText>
          <TextInput
            style={styles.formInput}
            defaultValue={vehicle.nombre_propietario}
            onChangeText={(text) => { nombrePropietarioRef.current = text; }}
            placeholder="Nombre completo"
            placeholderTextColor="#999"
            key={`nombre-${isCreating ? 'create' : vehicle.id}`}
          />
        </ThemedView>

        {/* Cédula Propietario */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Cédula del Propietario:</ThemedText>
          <TextInput
            style={styles.formInput}
            defaultValue={vehicle.cedula_propietario}
            onChangeText={(text) => { cedulaPropietarioRef.current = text; }}
            placeholder="Ej: 1234567890"
            placeholderTextColor="#999"
            keyboardType="numeric"
            key={`cedula-${isCreating ? 'create' : vehicle.id}`}
          />
        </ThemedView>

        {/* Hora Entrada */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Hora de Entrada:</ThemedText>
          <TouchableOpacity style={styles.timePickerButton} onPress={openHoraEntradaPicker}>
            <ThemedText style={styles.timePickerButtonText}>
              {horaEntradaDisplay || 'Seleccionar hora'}
            </ThemedText>
            <Ionicons name="time-outline" size={20} color="#007AFF" />
          </TouchableOpacity>
          {showHoraEntradaPicker && (
            <View style={styles.inlinePickerContainer}>
              <DateTimePicker
                value={horaEntradaPickerValue}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleHoraEntradaPickerChange}
              />
            </View>
          )}
        </ThemedView>

        {/* Hora Salida */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Hora de Salida (opcional):</ThemedText>
          <View style={styles.timePickerRow}>
            <TouchableOpacity style={styles.timePickerButton} onPress={openHoraSalidaPicker}>
              <ThemedText style={styles.timePickerButtonText}>
                {horaSalidaDisplay || 'Seleccionar hora'}
              </ThemedText>
              <Ionicons name="time-outline" size={20} color="#007AFF" />
            </TouchableOpacity>
            {horaSalidaDisplay !== '' && (
              <TouchableOpacity style={styles.clearTimeButton} onPress={clearHoraSalida}>
                <Ionicons name="close-circle" size={18} color="#FF3B30" />
                <ThemedText style={styles.clearTimeText}>Limpiar</ThemedText>
              </TouchableOpacity>
            )}
          </View>
          {showHoraSalidaPicker && (
            <View style={styles.inlinePickerContainer}>
              <DateTimePicker
                value={horaSalidaPickerValue}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleHoraSalidaPickerChange}
              />
            </View>
          )}
        </ThemedView>

        {/* Razón Visita */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Razón de Visita:</ThemedText>
          <TextInput
            style={[styles.formInput, styles.textArea]}
            defaultValue={vehicle.razon_visita}
            onChangeText={(text) => { razonVisitaRef.current = text; }}
            placeholder="Describe la razón de la visita..."
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            key={`razon-${isCreating ? 'create' : vehicle.id}`}
          />
        </ThemedView>

        {/* Foto de la matrícula */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Foto de la matrícula (opcional):</ThemedText>
          <TouchableOpacity
            style={styles.captureImageButton}
            onPress={openCamera}
          >
            <Ionicons name="camera" size={20} color="#007AFF" />
            <ThemedText style={styles.captureImageButtonText}>
              {vehicleImageBase64 ? 'Cambiar imagen' : 'Capturar imagen'}
            </ThemedText>
          </TouchableOpacity>

          {/* Show captured image preview */}
          {vehicleImageBase64 && (
            <ThemedView style={styles.imagePreviewContainer}>
              <ThemedText style={styles.imagePreviewTitle}>Imagen capturada:</ThemedText>
              <Image
                source={{ uri: vehicleImageBase64.startsWith('data:') ? vehicleImageBase64 : `data:image/jpeg;base64,${vehicleImageBase64}` }}
                style={styles.imagePreview}
                resizeMode="contain"
              />
            </ThemedView>
          )}

          {/* Show existing image in edit mode */}
          {!isCreating && !vehicleImageBase64 && isEditingImage && (() => {
            // Priority: 
            // 1. If online and server image loaded: use server image
            // 2. Otherwise: use base64_image from cache
            // This ensures offline mode always shows base64_image
            const imageToShow = editingVehicleServerImage 
              ? editingVehicleServerImage 
              : (editingVehicle?.base64_image && editingVehicle.base64_image.trim() !== '')
                ? (editingVehicle.base64_image.startsWith('data:') 
                    ? editingVehicle.base64_image 
                    : `data:image/jpeg;base64,${editingVehicle.base64_image}`)
                : null;
            
            if (!imageToShow) return null;
            
            return (
              <ThemedView style={styles.imagePreviewContainer}>
                <ThemedText style={styles.imagePreviewTitle}>Imagen actual:</ThemedText>
                <Image
                  source={{ uri: imageToShow }}
                  style={styles.imagePreview}
                  resizeMode="contain"
                />
              </ThemedView>
            );
          })()}
        </ThemedView>

        {/* Buttons */}
        <ThemedView style={styles.buttonRow}>
          <TouchableOpacity 
            style={styles.confirmButton} 
            onPress={isCreating ? createVehicle : () => updateVehicle(vehicle.id!)}
          >
            <ThemedText style={styles.confirmButtonText}>
              {getActionIcon('confirm')}
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.cancelButton} 
            onPress={isCreating ? cancelCreating : cancelEditing}
          >
            <ThemedText style={styles.cancelButtonText}>
              {getActionIcon('cancel')}
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </ThemedView>
    );
  };

  const convertDate = (dateString: string) => {
    console.log("dateString", dateString);
    try {
      const dateSplit = dateString.split('T');
      return dateSplit[0] + ' ' + dateSplit[1].split('.')[0];
    } catch (error) {
      return dateString;
    }
  };

  // Handle menu press from header
  const handleMenuPress = () => {
    setIsMenuVisible(true);
  };

  // Handle menu close
  const handleMenuClose = () => {
    setIsMenuVisible(false);
  };

  // Handle home navigation from slide menu
  const handleHomePress = () => {
    navigation.navigate('Home');
  };

  const startEditing = async (vehicle: Vehicle) => {
    // Parse time from hora_entrada
    
    const entrada_split = vehicle.hora_entrada.split(':');
    const hours = entrada_split[0].split('T')[1];
    const minutes = entrada_split[1];

    let exitHours = '';
    let exitMinutes = '';
    if(vehicle.hora_salida) {
      const salida_split = vehicle.hora_salida.split(':');
      exitHours = salida_split[0].split('T')[1];
      exitMinutes = salida_split[1];
    }
    
    setEditingVehicle({
      id: vehicle.id,
      id_local: vehicle.id_local,
      tipo: vehicle.tipo,
      placa: vehicle.placa,
      nombre_propietario: vehicle.nombre_propietario,
      cedula_propietario: vehicle.cedula_propietario,
      hora_entrada_h: hours,
      hora_entrada_m: minutes,
      hora_salida_h: exitHours,
      hora_salida_m: exitMinutes,
      razon_visita: vehicle.razon_visita,
      base64_image: vehicle.base64_image || '',
    });
    syncTimeFields(hours, minutes, exitHours, exitMinutes);
    setHoraEntradaPickerValue(buildDateFromParts(hours, minutes));
    setHoraSalidaPickerValue(buildDateFromParts(exitHours, exitMinutes));
    setShowHoraEntradaPicker(false);
    setShowHoraSalidaPicker(false);
    
    // Initialize refs with vehicle values
    tipoRef.current = vehicle.tipo;
    setVehicleTipo(vehicle.tipo);
    placaRef.current = vehicle.placa;
    nombrePropietarioRef.current = vehicle.nombre_propietario;
    cedulaPropietarioRef.current = vehicle.cedula_propietario;
    horaEntradaHRef.current = hours;
    horaEntradaMRef.current = minutes;
    horaSalidaHRef.current = exitHours;
    horaSalidaMRef.current = exitMinutes;
    razonVisitaRef.current = vehicle.razon_visita;
    
    // Set image state
    setVehicleImageBase64(null);
    setIsEditingImage(true);
    setEditingVehicleServerImage(null);
    
    // Load image based on network status
    const isConnected = await getConnectionStatus();
    if (isConnected && vehicle.id) {
      // CON INTERNET: Cargar desde API
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (apiUrl) {
        try {
          let token = await AsyncStorage.getItem('access_token');
          if (!token) {
            const refreshed = await refreshAccessToken();
            if (!refreshed) {
              console.error('No authentication token found for vehicle image');
              return;
            }
            token = await AsyncStorage.getItem('access_token');
          }

          const imageUrl = `${apiUrl}/api/vehicles/${vehicle.id}/get-image?t=${Date.now()}`;
          const response = await fetch(imageUrl, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'ngrok-skip-browser-warning': '69420',
            },
          });
          
          if (response.ok) {
            const blob = await response.blob();
            
            // Convert blob to base64
            const base64Image = await new Promise<string | null>((resolve) => {
              const reader = new FileReader();
              
              reader.onerror = () => {
                console.error('Error al leer la imagen con FileReader');
                resolve(null);
              };
              
              reader.onloadend = () => {
                try {
                  const base64data = reader.result as string;
                  if (!base64data) {
                    console.warn('No se pudo convertir la imagen a base64');
                    resolve(null);
                  } else {
                    resolve(base64data);
                  }
                } catch (error) {
                  console.error('Error al procesar base64:', error);
                  resolve(null);
                }
              };
              
              reader.readAsDataURL(blob);
            });
            
            if (base64Image) {
              setEditingVehicleServerImage(base64Image);
            }
          } else {
            console.warn(`Failed to load vehicle image for edit: ${response.status} ${response.statusText}`);
            // If server image fails, fallback to base64_image if available
            if (vehicle.base64_image && vehicle.base64_image.trim() !== '') {
              setEditingVehicleServerImage(null); // Clear server image to use base64
            }
          }
        } catch (error) {
          console.error('Error fetching vehicle image for edit:', error);
          // If error, fallback to base64_image if available
          if (vehicle.base64_image && vehicle.base64_image.trim() !== '') {
            setEditingVehicleServerImage(null); // Clear server image to use base64
          }
        }
      }
    } else {
      // SIN INTERNET: No intentar cargar desde servidor, usar base64_image si existe
      // El base64_image ya está en editingVehicle.base64_image
    }
  };

  const cancelEditing = () => {
    setEditingVehicle(null);
    setVehicleImageBase64(null);
    setIsEditingImage(false);
    setEditingVehicleServerImage(null);
    setVehicleTipo('Particular');
    tipoRef.current = 'Particular';
  };

  const startCreating = () => {
    syncTimeFields('', '', '', '');
    setHoraEntradaPickerValue(buildDateFromParts('', ''));
    setHoraSalidaPickerValue(buildDateFromParts('', ''));
    setShowHoraEntradaPicker(false);
    setShowHoraSalidaPicker(false);
    setIsCreating(true);
    setNewVehicle({
      id: null,
      id_local: '',
      tipo: 'Particular',
      placa: '',
      nombre_propietario: '',
      cedula_propietario: '',
      hora_entrada_h: '',
      hora_entrada_m: '',
      hora_salida_h: '',
      hora_salida_m: '',
      razon_visita: '',
      base64_image: '',
    });
    // Initialize refs
    tipoRef.current = 'Particular';
    setVehicleTipo('Particular');
    placaRef.current = '';
    nombrePropietarioRef.current = '';
    cedulaPropietarioRef.current = '';
    horaEntradaHRef.current = '';
    horaEntradaMRef.current = '';
    horaSalidaHRef.current = '';
    horaSalidaMRef.current = '';
    razonVisitaRef.current = '';
    setVehicleImageBase64(null);
  };

  const cancelCreating = () => {
    setIsCreating(false);
    setNewVehicle({
      id: null,
      id_local: '',
      tipo: 'Particular',
      placa: '',
      nombre_propietario: '',
      cedula_propietario: '',
      hora_entrada_h: '',
      hora_entrada_m: '',
      hora_salida_h: '',
      hora_salida_m: '',
      razon_visita: '',
      base64_image: '',
    });
    setVehicleImageBase64(null);
    setVehicleTipo('Particular');
    tipoRef.current = 'Particular';
  };

  const resetAllFilters = () => {
    setSearchText('');
    setSelectedTipo('all');
  };

  const filteredVehicles = vehicles.filter(vehicle => {
    const matchesSearch = 
      vehicle.placa.toLowerCase().includes(searchText.toLowerCase()) ||
      vehicle.nombre_propietario.toLowerCase().includes(searchText.toLowerCase()) ||
      vehicle.cedula_propietario.toLowerCase().includes(searchText.toLowerCase()) ||
      vehicle.razon_visita.toLowerCase().includes(searchText.toLowerCase()) ||
      vehicle.responsable.nombre.toLowerCase().includes(searchText.toLowerCase());
    
    const matchesTipo = 
      selectedTipo === 'all' || vehicle.tipo === selectedTipo;
    
    return matchesSearch && matchesTipo;
  });

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader onMenuPress={handleMenuPress} title="Registro de vehículos" />
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Cargando vehículos...</ThemedText>
        </ThemedView>
        <AppFooter />
        <SlideMenu 
          isVisible={isMenuVisible} 
          onClose={handleMenuClose}
          onHomePress={handleHomePress}
          currentRoute="Vehicles"
        />
      </ThemedView>
    );
  }

  // Si no hay marca registrada, mostrar mensaje
  if (!hasCurrentMarca) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader onMenuPress={handleMenuPress} title="Registro de vehículos" />
        <ThemedView style={styles.noMarcaContainer}>
          <Ionicons name="alert-circle-outline" size={80} color="#FF9500" />
          <ThemedText style={styles.noMarcaTitle}>No hay marca registrada</ThemedText>
          <ThemedText style={styles.noMarcaMessage}>
            Debes registrar una marca de ingreso antes de acceder al registro de vehículos.
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
          currentRoute="Vehicles"
        />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <AppHeader onMenuPress={handleMenuPress} title="Registro de vehículos" />
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <ThemedView style={styles.contentContainer}>
          {/* Module Title */}
          <ThemedView style={styles.titleContainer}>
            <ThemedText type="title" style={styles.title}>
              {getActionIcon('vehicles')} Registro de vehículos
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              Gestiona el registro de vehículos
            </ThemedText>
          </ThemedView>

          {/* Filters */}
          <ThemedView style={styles.filtersMain}>
            <ThemedView style={styles.filterHeader}>
              <TouchableOpacity 
                style={styles.filterToggleButton}
                onPress={() => setIsFiltersExpanded(!isFiltersExpanded)}
              >
                <ThemedText style={styles.filterToggleText}>
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
              <ThemedView style={styles.filterContent}>
                <ThemedView style={styles.filterGroupSearch}>
                  <ThemedText style={styles.filterLabel}>Buscar por placa, propietario, cédula, razón o responsable:</ThemedText>
                  <TextInput
                    style={styles.searchInput}
                    value={searchText}
                    onChangeText={setSearchText}
                    placeholder="Buscar..."
                    placeholderTextColor="#999"
                  />
                </ThemedView>

                <ThemedView style={styles.filterGroupSearch}>
                  <ThemedText style={styles.filterLabel}>Tipo:</ThemedText>
                  <ThemedView style={styles.pickerContainer}>
                    <Picker
                      selectedValue={selectedTipo}
                      onValueChange={(value) => setSelectedTipo(value)}
                      style={styles.picker}
                    >
                      <Picker.Item label="Todos los tipos" value="all" />
                      <Picker.Item label="Particular" value="Particular" />
                      <Picker.Item label="Institucional" value="Institucional" />
                    </Picker>
                  </ThemedView>
                </ThemedView>
              </ThemedView>
            )}
          </ThemedView>

          {/* Create Button */}
          {!isCreating && !editingVehicle && (
            <TouchableOpacity style={styles.createButton} onPress={startCreating}>
              <ThemedText style={styles.createButtonText}>{getActionIcon('add')}</ThemedText>
            </TouchableOpacity>
          )}

          {/* Create Form */}
          {isCreating && renderVehicleForm(newVehicle, true)}

          {/* Edit Form */}
          {editingVehicle && renderVehicleForm(editingVehicle, false)}

          {/* Vehicles List */}
          {!isCreating && !editingVehicle && (
          <ThemedView style={styles.vehiclesContainer}>
            {filteredVehicles.length === 0 ? (
              <ThemedView style={styles.emptyContainer}>
                <ThemedText style={styles.emptyText}>
                  {vehicles.length === 0 
                    ? 'No hay vehículos registrados aún' 
                    : 'No se encontraron vehículos con los filtros aplicados'}
                </ThemedText>
              </ThemedView>
            ) : (
              filteredVehicles.map(vehicle => (
                <VehicleItemComponent
                  key={vehicle.id}
                  vehicle={vehicle}
                  onEdit={() => startEditing(vehicle)}
                  onDelete={() => deleteVehicle(vehicle.id, vehicle.id_local)}
                  getActionIcon={getActionIcon}
                  convertDate={convertDate}
                  getConnectionStatus={getConnectionStatus}
                />
              ))
            )}
          </ThemedView>
          )}
        </ThemedView>
      </ScrollView>
      
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
      
      <AppFooter />
      <SlideMenu 
        isVisible={isMenuVisible} 
        onClose={handleMenuClose}
        onHomePress={handleHomePress}
        currentRoute="Vehicles"
      />
    </ThemedView>
  );
}

// Vehicle Item Component for displaying image
interface VehicleItemComponentProps {
  vehicle: Vehicle;
  onEdit: () => void;
  onDelete: () => void;
  getActionIcon: (action: string) => React.ReactElement;
  convertDate: (dateString: string) => string;
  getConnectionStatus: () => Promise<boolean>;
}

const VehicleItemComponent: React.FC<VehicleItemComponentProps> = ({
  vehicle,
  onEdit,
  onDelete,
  getActionIcon,
  convertDate,
  getConnectionStatus,
}) => {
  const { employee, refreshAccessToken } = useAuth();
  const [imageBase64, setImageBase64] = React.useState<string | null>(null);
  const [isLoadingImage, setIsLoadingImage] = React.useState<boolean>(false);
  const [isImageExpanded, setIsImageExpanded] = React.useState<boolean>(false);
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;

  // Determinar si hay imagen disponible
  // Siempre mostrar la sección para permitir expandir y ver si hay imagen
  const hasImage = true;

  // Function to load image from server
  const loadImageFromServer = React.useCallback(async () => {
    if (!apiUrl || !vehicle.id) {
      console.warn('No API URL or vehicle ID available');
      return;
    }
    
    try {
      let token = await AsyncStorage.getItem('access_token');
      if (!token) {
        const refreshed = await refreshAccessToken();
        if (!refreshed) {
          console.warn('No authentication token found');
          return;
        }
        token = await AsyncStorage.getItem('access_token');
      }
      
      const response = await fetch(`${apiUrl}/api/vehicles/${vehicle.id}/get-image?t=${Date.now()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': '69420',
        },
      });
      
      if (response.ok) {
        const blob = await response.blob();
        
        // Convert blob to base64
        const base64Image = await new Promise<string | null>((resolve) => {
          const reader = new FileReader();
          
          reader.onerror = () => {
            console.error('Error al leer la imagen con FileReader');
            resolve(null);
          };
          
          reader.onloadend = () => {
            try {
              const base64data = reader.result as string;
              if (!base64data) {
                console.warn('No se pudo convertir la imagen a base64');
                resolve(null);
              } else {
                resolve(base64data);
              }
            } catch (error) {
              console.error('Error al procesar base64:', error);
              resolve(null);
            }
          };
          
          reader.readAsDataURL(blob);
        });
        
        if (base64Image) {
          setImageBase64(base64Image);
        }
      } else {
        console.warn(`Failed to load vehicle image: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error fetching vehicle image:', error);
    }
  }, [apiUrl, vehicle.id, refreshAccessToken]);

  // Single effect to handle image loading based on network state (same pattern as ActivitiesScreen)
  React.useEffect(() => {
    if (!isImageExpanded) {
      // Don't load if not expanded
      setImageBase64(null);
      setIsLoadingImage(false);
      return;
    }

    const checkConnectionAndLoadImage = async () => {
      setIsLoadingImage(true);
      
      // Check connection status first
      const connectionStatus = await getConnectionStatus();
      
      // Always load cached image first (base64_image from vehicle)
      if (vehicle.base64_image && vehicle.base64_image.trim() !== '') {
        const formattedImage = vehicle.base64_image.startsWith('data:') 
          ? vehicle.base64_image 
          : `data:image/jpeg;base64,${vehicle.base64_image}`;
        setImageBase64(formattedImage);
      } else {
        setImageBase64(null);
      }
      
      if (!connectionStatus) {
        // Offline: use cached image only, don't try to load from server
        setIsLoadingImage(false);
      } else {
        // Online: fetch image from server (will override cache if successful)
        await loadImageFromServer();
        setIsLoadingImage(false);
      }
    };
    
    checkConnectionAndLoadImage();
  }, [vehicle.id, vehicle.base64_image, isImageExpanded, getConnectionStatus, loadImageFromServer]);

  return (
    <ThemedView style={styles.vehicleCard}>
                  <ThemedView style={styles.vehicleHeader}>
                    <ThemedText style={styles.vehiclePlaca}>{vehicle.placa}</ThemedText>
                    <ThemedText style={styles.vehicleTipo}>{vehicle.tipo}</ThemedText>
                  </ThemedView>
                  <ThemedText style={styles.vehicleInfo}>Propietario: {vehicle.nombre_propietario}</ThemedText>
                  <ThemedText style={styles.vehicleInfo}>Cédula: {vehicle.cedula_propietario}</ThemedText>
                  <ThemedText style={styles.vehicleInfo}>Entrada: {convertDate(vehicle.hora_entrada)}</ThemedText>
                  {vehicle.hora_salida && (
                    <ThemedText style={styles.vehicleInfo}>Salida: {convertDate(vehicle.hora_salida)}</ThemedText>
                  )}
                  <ThemedText style={styles.vehicleInfo}>Razón: {vehicle.razon_visita}</ThemedText>
                  <ThemedText style={styles.vehicleInfo}>Responsable: {vehicle.responsable.nombre}</ThemedText>
                  
      {/* Collapsable image section */}
      {hasImage && (
        <ThemedView style={styles.collapsableSection}>
          <TouchableOpacity
            style={styles.collapsableHeader}
            onPress={() => setIsImageExpanded(!isImageExpanded)}
          >
            <ThemedText style={styles.collapsableHeaderText}>Foto de la matrícula</ThemedText>
            <Ionicons
              name={isImageExpanded ? "chevron-up" : "chevron-down"}
              size={20}
              color="#007AFF"
            />
                    </TouchableOpacity>
          
          {isImageExpanded && (
            <ThemedView style={styles.collapsableContent}>
              {isLoadingImage ? (
                <ThemedView style={styles.imageLoadingContainer}>
                  <ActivityIndicator size="small" color="#007AFF" />
                  <ThemedText style={styles.imageLoadingText}>Cargando imagen...</ThemedText>
                  </ThemedView>
              ) : imageBase64 ? (
                <ThemedView style={styles.imagePreviewContainer}>
                  <Image
                    source={{ uri: imageBase64 }}
                    style={styles.imagePreview}
                    resizeMode="contain"
                  />
                </ThemedView>
              ) : (
                <ThemedView style={styles.imageLoadingContainer}>
                  <ThemedText style={styles.imageLoadingText}>No hay imagen disponible</ThemedText>
                </ThemedView>
            )}
          </ThemedView>
          )}
        </ThemedView>
      )}
      
      {/* Solo serán visibles si el dato responsable_id es igual al id del empleado actual */}
      {vehicle.responsable.id === parseInt(employee?.id || '0') && (
      <ThemedView style={styles.buttonRow}>
        <TouchableOpacity style={styles.editButton} onPress={onEdit}>
          <ThemedText style={styles.editButtonText}>{getActionIcon('edit')}</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
          <ThemedText style={styles.deleteButtonText}>{getActionIcon('delete')}</ThemedText>
        </TouchableOpacity>
      </ThemedView>
      )}
    </ThemedView>
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
  filtersMain: {
    width: '100%',
    marginBottom: 20,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  filterHeader: {
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
  filterToggleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
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
  filterContent: {
    padding: 16,
    gap: 10,
    backgroundColor: '#F8F9FA',
  },
  filterGroupSearch: {
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
  createButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  vehiclesContainer: {
    width: '100%',
    gap: 16,
  },
  vehicleCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#fff',
    padding: 16,
    gap: 8,
  },
  vehicleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  vehiclePlaca: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  vehicleTipo: {
    fontSize: 12,
    fontWeight: '600',
    color: '#34C759',
    backgroundColor: '#F0F9F4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  vehicleInfo: {
    fontSize: 14,
    color: '#666',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    backgroundColor: '#fff',
  },
  editButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#FF3B30',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 14,
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
  timeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
  },
  timeInput: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: '#F9F9F9',
    textAlign: 'center',
    color: '#000000',
  },
  timeInputHour: {
    width: '40%',
  },
  timeInputMinute: {
    width: '40%',
  },
  timeSeparator: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  timePickerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
  },
  timePickerButtonText: {
    fontSize: 16,
    color: '#000000',
  },
  timePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  clearTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    marginLeft: 8,
  },
  clearTimeText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '600',
  },
  inlinePickerContainer: {
    marginTop: 8,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
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
  captureImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F0F0F0',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    marginTop: 8,
  },
  captureImageButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  imagePreviewContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  imagePreviewTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
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
  collapsableSection: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
    overflow: 'hidden',
    
  },
  collapsableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F0F0F0',
  },
  collapsableHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  collapsableContent: {
    padding: 12,
    backgroundColor: '#F9F9F9',
  },
  imageLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 20,
    backgroundColor: '#F9F9F9',
  },
  imageLoadingText: {
    fontSize: 14,
    color: '#666',
  },
});

