import React, { useState, useCallback } from 'react';
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
  };
}

interface Colaborador {
  nombre_colaborador: string;
  cedula: string;
  firma_comentario: string; // base64 del QR
  firma_comentario_info: QRInfo | null; // Información decodificada del QR
  entrada: string;
  salida: string;
  nombre_sustituto: string;
  cedula_sustituto: string;
  firma_sustituto: string; // base64 del QR
  firma_sustituto_info: QRInfo | null; // Información decodificada del QR
  checked: boolean;
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
  created_at: string;
  synced?: boolean;
}

interface EditingAttendanceControl {
  id: string | null;
  id_local: string;
  cliente: string;
  fecha: string;
  turno: string;
  area_piso: string;
  total_presentes: string;
  fijos: string;
  colaboradores: Colaborador[];
}

const TURNO_OPTIONS = [
  { label: 'Seleccionar turno', value: '' },
  { label: 'DIURNO', value: 'DIURNO' },
  { label: 'MIXTO', value: 'MIXTO' },
  { label: 'NOCTURNO', value: 'NOCTURNO' },
];

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

  // Editing state
  const [editingRecord, setEditingRecord] = useState<EditingAttendanceControl | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form states
  const [cliente, setCliente] = useState('');
  const [fecha, setFecha] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [turno, setTurno] = useState('');
  const [areaPiso, setAreaPiso] = useState('');
  const [totalPresentes, setTotalPresentes] = useState('');
  const [fijos, setFijos] = useState('');
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);

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
          setControls(result.data as AttendanceControl[]);
        } else {
          setControls([]);
        }
      } else {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const controlsCache = cache.filter((item: any) => item.type === 'attendance_control');
          setControls(controlsCache);
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
    setCliente('');
    setFecha(new Date());
    setTurno('');
    setAreaPiso('');
    setTotalPresentes('');
    setFijos('');
    setColaboradores([]);
    setExpandedColaboradorIndices([]);
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
            nombre_colaborador: colab.nombre_colaborador || '',
            cedula: colab.cedula || '',
            firma_comentario: colab.firma_comentario || '',
            firma_comentario_info: null,
            entrada: colab.entrada || '',
            salida: colab.salida || '',
            nombre_sustituto: colab.nombre_sustituto || '',
            cedula_sustituto: colab.cedula_sustituto || '',
            firma_sustituto: colab.firma_sustituto || '',
            firma_sustituto_info: null,
            checked: colab.checked || false,
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
      cliente: record.cliente || '',
      fecha: record.fecha || '',
      turno: record.turno || '',
      area_piso: record.area_piso || '',
      total_presentes: record.total_presentes || '',
      fijos: record.fijos || '',
      colaboradores: colaboradoresArray,
    });

    setCliente(record.cliente || '');
    if (record.fecha) {
      const dateParts = record.fecha.split('/');
      if (dateParts.length === 3) {
        setFecha(new Date(parseInt(dateParts[2]), parseInt(dateParts[1]) - 1, parseInt(dateParts[0])));
      }
    }
    setTurno(record.turno || '');
    setAreaPiso(record.area_piso || '');
    setTotalPresentes(record.total_presentes || '');
    setFijos(record.fijos || '');
    setColaboradores(colaboradoresArray);
    setExpandedColaboradorIndices(colaboradoresArray.map((_, i) => i));
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
      nombre_colaborador: '',
      cedula: '',
      firma_comentario: '',
      firma_comentario_info: null,
      entrada: '',
      salida: '',
      nombre_sustituto: '',
      cedula_sustituto: '',
      firma_sustituto: '',
      firma_sustituto_info: null,
      checked: false,
    };
    setColaboradores([...colaboradores, newColaborador]);
    setExpandedColaboradorIndices([...expandedColaboradorIndices, colaboradores.length]);
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
                nombre_colaborador: colab.nombre_colaborador,
                cedula: colab.cedula,
                firma_comentario: colab.firma_comentario,
                entrada: colab.entrada,
                salida: colab.salida,
                nombre_sustituto: colab.nombre_sustituto,
                cedula_sustituto: colab.cedula_sustituto,
                firma_sustituto: colab.firma_sustituto,
                checked: colab.checked,
              }));

              const requestData = {
                marca_id: currentMarcaData.id,
                cliente: cliente.trim() || null,
                fecha: formatDate(fecha) || null,
                turno: turno.trim() || null,
                area_piso: areaPiso.trim() || null,
                total_presentes: totalPresentes.trim() || null,
                fijos: fijos.trim() || null,
                colaboradores: colaboradoresToSave.length > 0 ? JSON.stringify(colaboradoresToSave) : null,
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
                  cliente: cliente.trim() || null,
                  fecha: formatDate(fecha) || null,
                  turno: turno.trim() || null,
                  area_piso: areaPiso.trim() || null,
                  total_presentes: totalPresentes.trim() || null,
                  fijos: fijos.trim() || null,
                  colaboradores: colaboradoresToSave.length > 0 ? JSON.stringify(colaboradoresToSave) : null,
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
                nombre_colaborador: colab.nombre_colaborador,
                cedula: colab.cedula,
                firma_comentario: colab.firma_comentario,
                entrada: colab.entrada,
                salida: colab.salida,
                nombre_sustituto: colab.nombre_sustituto,
                cedula_sustituto: colab.cedula_sustituto,
                firma_sustituto: colab.firma_sustituto,
                checked: colab.checked,
              }));

              const requestData = {
                cliente: cliente.trim() || null,
                fecha: formatDate(fecha) || null,
                turno: turno.trim() || null,
                area_piso: areaPiso.trim() || null,
                total_presentes: totalPresentes.trim() || null,
                fijos: fijos.trim() || null,
                colaboradores: colaboradoresToSave.length > 0 ? JSON.stringify(colaboradoresToSave) : null,
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
                    Control de Asistencia
                  </ThemedText>
                  <ThemedText style={styles.listItemSubtitle}>
                    Cliente: {record.cliente || 'N/A'} | Fecha: {record.fecha || 'N/A'} | Colaboradores: {colaboradoresArray.length}
                  </ThemedText>
                </ThemedView>
                <ThemedView style={styles.listItemActions}>
                  {!record.synced && (
                    <ThemedView style={styles.offlineBadge}>
                      <ThemedText style={styles.offlineBadgeText}>Offline</ThemedText>
                    </ThemedView>
                  )}
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
              Colaborador {index + 1}: {colaborador.nombre_colaborador || 'Sin nombre'}
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
            {/* Nombre colaborador */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Nombre colaborador</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder="Nombre colaborador"
                placeholderTextColor="#999"
                value={colaborador.nombre_colaborador}
                onChangeText={(text) => updateColaborador(index, 'nombre_colaborador', text)}
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
                onChangeText={(text) => updateColaborador(index, 'cedula', text)}
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
                          Empleado: {colaborador.firma_comentario_info.empleadoDetalle.nombre} {colaborador.firma_comentario_info.empleadoDetalle.primer_apellido} {colaborador.firma_comentario_info.empleadoDetalle.segundo_apellido}
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
              <TextInput
                style={styles.formInput}
                placeholder="HH:MM"
                placeholderTextColor="#999"
                value={colaborador.entrada}
                onChangeText={(text) => updateColaborador(index, 'entrada', text)}
              />
            </ThemedView>

            {/* Salida */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Salida</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder="HH:MM"
                placeholderTextColor="#999"
                value={colaborador.salida}
                onChangeText={(text) => updateColaborador(index, 'salida', text)}
              />
            </ThemedView>

            {/* Nombre Sustituto */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Nombre Sustituto</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder="Nombre Sustituto"
                placeholderTextColor="#999"
                value={colaborador.nombre_sustituto}
                onChangeText={(text) => updateColaborador(index, 'nombre_sustituto', text)}
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
                onChangeText={(text) => updateColaborador(index, 'cedula_sustituto', text)}
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
                          Empleado: {colaborador.firma_sustituto_info.empleadoDetalle.nombre} {colaborador.firma_sustituto_info.empleadoDetalle.primer_apellido} {colaborador.firma_sustituto_info.empleadoDetalle.segundo_apellido}
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

            {/* Checkbox ✓ */}
            <ThemedView style={styles.formGroup}>
              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => updateColaborador(index, 'checked', !colaborador.checked)}
              >
                <View style={styles.checkbox}>
                  {colaborador.checked && (
                    <Ionicons name="checkmark" size={20} color="#FF9500" />
                  )}
                </View>
                <ThemedText style={styles.checkboxLabel}>✓</ThemedText>
              </TouchableOpacity>
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
          <ThemedText type="title" style={styles.screenTitle}>
            {getActionIcon('attendance')} Control de Asistencia
          </ThemedText>

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
              {/* Cliente */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Cliente</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Cliente"
                  placeholderTextColor="#999"
                  value={cliente}
                  onChangeText={setCliente}
                />
              </ThemedView>

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
                <ThemedView style={styles.turnoContainer}>
                  {TURNO_OPTIONS.slice(1).map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[styles.turnoOption, turno === option.value && styles.turnoOptionSelected]}
                      onPress={() => setTurno(option.value)}
                    >
                      <View style={styles.turnoCheckbox}>
                        {turno === option.value && (
                          <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                        )}
                      </View>
                      <ThemedText style={[styles.turnoOptionText, turno === option.value && styles.turnoOptionTextSelected]}>
                        {option.label}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
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

              <TouchableOpacity
                style={styles.addColaboradorButton}
                onPress={addColaborador}
              >
                <Ionicons name="add-circle" size={24} color="#4CAF50" />
                <ThemedText style={styles.addColaboradorButtonText}>Agregar Colaborador</ThemedText>
              </TouchableOpacity>

              <ThemedView style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.cancelButton]}
                  onPress={editingRecord ? cancelEditing : cancelCreating}
                >
                  {getActionIcon('cancel')}
                  <ThemedText style={styles.actionButtonText}>Cancelar</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.saveButton]}
                  onPress={editingRecord ? updateControlHandler : saveControlHandler}
                >
                  {getActionIcon('confirm')}
                  <ThemedText style={styles.actionButtonText}>
                    {editingRecord ? 'Actualizar' : 'Guardar'}
                  </ThemedText>
                </TouchableOpacity>
              </ThemedView>
            </ThemedView>
          ) : (
            <ThemedView style={styles.listSection}>
              <TouchableOpacity style={styles.createButton} onPress={startCreating}>
                <Ionicons name="add-circle" size={24} color="#FFFFFF" />
                <ThemedText style={styles.createButtonText}>Crear Nuevo Control de Asistencia</ThemedText>
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
    backgroundColor: '#161719',
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
  screenTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#000000',
    textAlign: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
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
    padding: 15,
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
  turnoContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  turnoOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#F9F9F9',
    gap: 8,
  },
  turnoOptionSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  turnoCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  turnoOptionText: {
    fontSize: 14,
    color: '#000000',
  },
  turnoOptionTextSelected: {
    color: '#FFFFFF',
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
  },
  colaboradorHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#FF9500',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#000000',
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
    backgroundColor: '#FF9500',
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
    backgroundColor: '#F0F0F0',
  },
  listItemContent: {
    flex: 1,
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

