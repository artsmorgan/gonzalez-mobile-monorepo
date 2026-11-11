import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  View,
  Platform,
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
import { Picker } from '@react-native-picker/picker';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import * as Network from 'expo-network';
import { createMileageControl, updateMileageControl, deleteMileageControl, listMileageControlsByCorpo } from '@/hooks/evaluationFunctions';
import { eventBus } from '@/hooks/eventBus';

type MileageControlScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'MileageControl'>;

interface TripRecord {
  chofer_en_ruta: string;
  fecha: string;
  kilometraje_salida: string;
  kilometraje_llegada: string;
  hora_salida: string;
  hora_llegada: string;
  total_kilometros: string;
  tiempo_viaje: string;
  motivo_visita: string;
}

interface MileageControl {
  id: string;
  id_local: string;
  chofer_id: string | null;
  chofer_nombre: string | null;
  total_km: string | null;
  ruta: string | null;
  prox_mant_km: string | null;
  km_para_mantenimiento: string | null;
  km_actual: string | null;
  estado: string | null;
  vehiculo_id: string | null;
  registros_viaje: TripRecord[];
  created_at: string;
  synced?: boolean;
}

interface EditingMileageControl {
  id: string | null;
  id_local: string;
  chofer_id: string;
  chofer_nombre: string;
  total_km: string;
  ruta: string;
  prox_mant_km: string;
  km_para_mantenimiento: string;
  km_actual: string;
  estado: string;
  vehiculo_id: string;
  tripRecords: TripRecord[];
}

export default function MileageControlScreen() {
  const { employee, refreshAccessToken, logout } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<MileageControlScreenNavigationProp>();

  // Data states
  const [mileageControls, setMileageControls] = useState<MileageControl[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasCurrentMarca, setHasCurrentMarca] = useState<boolean>(false);

  // Editing state
  const [editingControl, setEditingControl] = useState<EditingMileageControl | null>(null);

  // Creating state
  const [isCreating, setIsCreating] = useState(false);
  const [newControl, setNewControl] = useState<EditingMileageControl>({
    id: null,
    id_local: '',
    chofer_id: '',
    chofer_nombre: '',
    total_km: '',
    ruta: '',
    prox_mant_km: '',
    km_para_mantenimiento: '',
    km_actual: '',
    estado: 'Todo en orden',
    vehiculo_id: '',
    tripRecords: [],
  });

  // Form states
  const [choferId, setChoferId] = useState('');
  const [choferNombre, setChoferNombre] = useState('');
  const [totalKm, setTotalKm] = useState('');
  const [ruta, setRuta] = useState('');
  const [proxMantKm, setProxMantKm] = useState('');
  const [kmParaMantenimiento, setKmParaMantenimiento] = useState('');
  const [kmActual, setKmActual] = useState('');
  const [estado, setEstado] = useState('Todo en orden');
  const [vehiculoId, setVehiculoId] = useState('');

  // Date picker states
  const [showDatePickers, setShowDatePickers] = useState<{ [key: string]: boolean }>({});
  const [showTimePickers, setShowTimePickers] = useState<{ [key: string]: boolean }>({});

  // Expanded details state
  const [expandedControlIds, setExpandedControlIds] = useState<string[]>([]);

  const getConnectionStatus = async (): Promise<boolean> => {
    const networkState = await Network.getNetworkStateAsync();
    return networkState.isConnected && networkState.isInternetReachable ? true : false;
  };

  const generateRandomId = (): string => {
    return `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  useFocusEffect(
    useCallback(() => {
      fetchMileageControls();
    }, [])
  );

  useEffect(() => {
    const handler = () => {
      fetchMileageControls();
    };

    eventBus.on('connectionRestored', handler);
    return () => {
      eventBus.off('connectionRestored', handler);
    };
  }, []);

  const fetchMileageControls = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const currentMarca = await AsyncStorage.getItem('current_marca');
      if (!currentMarca) {
        setHasCurrentMarca(false);
        setIsLoading(false);
        return;
      }

      const currentMarcaData = JSON.parse(currentMarca);
      const corpoId = currentMarcaData.corpo?.id?.toString();
      if (!corpoId) {
        setError('No se encontró corpo_id en la marca');
        setIsLoading(false);
        return;
      }

      setHasCurrentMarca(true);

      const isConnected = await getConnectionStatus();

      if (isConnected) {
        const result = await listMileageControlsByCorpo({
          corpo_id: corpoId,
          refreshAccessToken,
          logout,
        });

        if (result.status && result.data) {
          setMileageControls(result.data);
          // Actualizar cache
          await AsyncStorage.setItem('evaluations_cache', JSON.stringify(
            result.data.map((item: any) => ({
              ...item,
              type: 'mileage_control',
              synced: true,
            }))
          ));
        } else {
          setError(result.message || 'Error al cargar los controles');
        }
      } else {
        // Sin internet: cargar desde cache
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const mileageControlsCache = cache.filter((item: any) => item.type === 'mileage_control');
          setMileageControls(mileageControlsCache);
        } else {
          setMileageControls([]);
        }
      }
    } catch (err) {
      console.error('Error fetching mileage controls:', err);
      setError('Error al cargar los controles');
      try {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const mileageControlsCache = cache.filter((item: any) => item.type === 'mileage_control');
          setMileageControls(mileageControlsCache);
        }
      } catch (cacheErr) {
        console.error('Error loading from cache:', cacheErr);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (date: Date): string => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${year}-${month}-${day}`;
  };

  const formatTime = (date: Date): string => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const calculateTotalKm = (salida: string, llegada: string): string => {
    const salidaNum = parseFloat(salida) || 0;
    const llegadaNum = parseFloat(llegada) || 0;
    if (llegadaNum >= salidaNum) {
      return (llegadaNum - salidaNum).toString();
    }
    return '0';
  };

  const calculateTravelTime = (horaSalida: Date, horaLlegada: Date): string => {
    const diffMs = horaLlegada.getTime() - horaSalida.getTime();
    if (diffMs < 0) return '0:00';
    const diffMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMins / 60);
    const minutes = diffMins % 60;
    return `${hours}:${minutes.toString().padStart(2, '0')}`;
  };

  const startCreating = () => {
    setIsCreating(true);
    setNewControl({
      id: null,
      id_local: '',
      chofer_id: '',
      chofer_nombre: '',
      total_km: '',
      ruta: '',
      prox_mant_km: '',
      km_para_mantenimiento: '',
      km_actual: '',
      estado: 'Todo en orden',
      vehiculo_id: '',
      tripRecords: [],
    });
    setChoferId('');
    setChoferNombre('');
    setTotalKm('');
    setRuta('');
    setProxMantKm('');
    setKmParaMantenimiento('');
    setKmActual('');
    setEstado('Todo en orden');
    setVehiculoId('');
  };

  const cancelCreating = () => {
    setIsCreating(false);
    setNewControl({
      id: null,
      id_local: '',
      chofer_id: '',
      chofer_nombre: '',
      total_km: '',
      ruta: '',
      prox_mant_km: '',
      km_para_mantenimiento: '',
      km_actual: '',
      estado: 'Todo en orden',
      vehiculo_id: '',
      tripRecords: [],
    });
  };

  const startEditing = (control: MileageControl) => {
    setEditingControl({
      id: control.id,
      id_local: control.id_local,
      chofer_id: control.chofer_id || '',
      chofer_nombre: control.chofer_nombre || '',
      total_km: control.total_km || '',
      ruta: control.ruta || '',
      prox_mant_km: control.prox_mant_km || '',
      km_para_mantenimiento: control.km_para_mantenimiento || '',
      km_actual: control.km_actual || '',
      estado: control.estado || 'Todo en orden',
      vehiculo_id: control.vehiculo_id || '',
      tripRecords: control.registros_viaje || [],
    });
    setChoferId(control.chofer_id || '');
    setChoferNombre(control.chofer_nombre || '');
    setTotalKm(control.total_km || '');
    setRuta(control.ruta || '');
    setProxMantKm(control.prox_mant_km || '');
    setKmParaMantenimiento(control.km_para_mantenimiento || '');
    setKmActual(control.km_actual || '');
    setEstado(control.estado || 'Todo en orden');
    setVehiculoId(control.vehiculo_id || '');
  };

  const cancelEditing = () => {
    setEditingControl(null);
  };

  const addTripRecord = (isEditing: boolean = false) => {
    const newRecord: TripRecord = {
      chofer_en_ruta: '',
      fecha: formatDate(new Date()),
      kilometraje_salida: '',
      kilometraje_llegada: '',
      hora_salida: formatTime(new Date()),
      hora_llegada: formatTime(new Date()),
      total_kilometros: '0',
      tiempo_viaje: '0:00',
      motivo_visita: '',
    };

    if (isEditing && editingControl) {
      setEditingControl({
        ...editingControl,
        tripRecords: [...editingControl.tripRecords, newRecord],
      });
    } else {
      setNewControl({
        ...newControl,
        tripRecords: [...newControl.tripRecords, newRecord],
      });
    }
  };

  const removeTripRecord = (index: number, isEditing: boolean = false) => {
    if (isEditing && editingControl) {
      setEditingControl({
        ...editingControl,
        tripRecords: editingControl.tripRecords.filter((_, i) => i !== index),
      });
    } else {
      setNewControl({
        ...newControl,
        tripRecords: newControl.tripRecords.filter((_, i) => i !== index),
      });
    }
  };

  const updateTripRecord = (index: number, field: keyof TripRecord, value: any, isEditing: boolean = false) => {
    const updateRecord = (records: TripRecord[]) => {
      return records.map((record, i) => {
        if (i === index) {
          const updated = { ...record, [field]: value };
          if (field === 'kilometraje_salida' || field === 'kilometraje_llegada') {
            updated.total_kilometros = calculateTotalKm(updated.kilometraje_salida, updated.kilometraje_llegada);
          }
          if (field === 'hora_salida' || field === 'hora_llegada') {
            const horaSalida = new Date(`2000-01-01T${updated.hora_salida}`);
            const horaLlegada = new Date(`2000-01-01T${updated.hora_llegada}`);
            updated.tiempo_viaje = calculateTravelTime(horaSalida, horaLlegada);
          }
          return updated;
        }
        return record;
      });
    };

    if (isEditing && editingControl) {
      setEditingControl({
        ...editingControl,
        tripRecords: updateRecord(editingControl.tripRecords),
      });
    } else {
      setNewControl({
        ...newControl,
        tripRecords: updateRecord(newControl.tripRecords),
      });
    }
  };

  const handleDateChange = (index: number, event: any, selectedDate?: Date, isEditing: boolean = false) => {
    if (Platform.OS === 'android') {
      setShowDatePickers({ ...showDatePickers, [`date-${index}`]: false });
    }
    if (selectedDate) {
      updateTripRecord(index, 'fecha', formatDate(selectedDate), isEditing);
    }
  };

  const handleTimeChange = (index: number, field: 'hora_salida' | 'hora_llegada', event: any, selectedTime?: Date, isEditing: boolean = false) => {
    if (Platform.OS === 'android') {
      setShowTimePickers({ ...showTimePickers, [`${field}-${index}`]: false });
    }
    if (selectedTime) {
      updateTripRecord(index, field, formatTime(selectedTime), isEditing);
    }
  };

  const saveMileageControl = async () => {
    if (!choferId.trim()) {
      Alert.alert('Error', 'El ID del chofer es requerido');
      return;
    }
    if (!choferNombre.trim()) {
      Alert.alert('Error', 'El nombre del chofer es requerido');
      return;
    }
    if (!vehiculoId.trim()) {
      Alert.alert('Error', 'La identificación del vehículo es requerida');
      return;
    }
    if (!kmActual.trim()) {
      Alert.alert('Error', 'El kilometraje actual es requerido');
      return;
    }

    const currentMarca = await AsyncStorage.getItem('current_marca');
    if (!currentMarca) {
      Alert.alert('Error', 'No se encontró la marca actual');
      return;
    }

    const currentMarcaData = JSON.parse(currentMarca);

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas guardar este control de kilometraje?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const requestData = {
                marca_id: currentMarcaData.id,
                chofer_id: choferId.trim(),
                chofer_nombre: choferNombre.trim(),
                total_km: totalKm.trim() || null,
                ruta: ruta.trim() || null,
                prox_mant_km: proxMantKm.trim() || null,
                km_para_mantenimiento: kmParaMantenimiento.trim() || null,
                km_actual: kmActual.trim(),
                estado: estado,
                vehiculo_id: vehiculoId.trim(),
                registros_viaje: newControl.tripRecords,
              };

              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await createMileageControl({
                  requestData,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Control de kilometraje guardado correctamente');
                  cancelCreating();
                  fetchMileageControls();
                } else {
                  Alert.alert('Error', result.message || 'Error al guardar el control de kilometraje');
                }
              } else {
                const localId = generateRandomId();

                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: localId,
                  action: 'create',
                  type: 'mileage_control',
                  payload: requestData,
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                const cache = cacheStr ? JSON.parse(cacheStr) : [];

                const newControlCache: MileageControl = {
                  id: '',
                  id_local: localId,
                  chofer_id: choferId.trim(),
                  chofer_nombre: choferNombre.trim(),
                  total_km: totalKm.trim() || null,
                  ruta: ruta.trim() || null,
                  prox_mant_km: proxMantKm.trim() || null,
                  km_para_mantenimiento: kmParaMantenimiento.trim() || null,
                  km_actual: kmActual.trim(),
                  estado: estado,
                  vehiculo_id: vehiculoId.trim(),
                  registros_viaje: newControl.tripRecords,
                  created_at: new Date().toISOString(),
                  synced: false,
                };

                cache.push({ ...newControlCache, type: 'mileage_control' });
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(cache));

                Alert.alert('Modo Offline', 'Control de kilometraje registrado localmente. Se sincronizará cuando haya conexión.');
                cancelCreating();
                fetchMileageControls();
              }
            } catch (err) {
              console.error('Error saving mileage control:', err);
              Alert.alert('Error', 'No se pudo guardar el control de kilometraje');
            }
          },
        },
      ]
    );
  };

  const updateMileageControlHandler = async () => {
    if (!editingControl) return;

    if (!choferId.trim()) {
      Alert.alert('Error', 'El ID del chofer es requerido');
      return;
    }
    if (!choferNombre.trim()) {
      Alert.alert('Error', 'El nombre del chofer es requerido');
      return;
    }
    if (!vehiculoId.trim()) {
      Alert.alert('Error', 'La identificación del vehículo es requerida');
      return;
    }
    if (!kmActual.trim()) {
      Alert.alert('Error', 'El kilometraje actual es requerido');
      return;
    }

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas actualizar este control de kilometraje?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const requestData = {
                chofer_id: choferId.trim(),
                chofer_nombre: choferNombre.trim(),
                total_km: totalKm.trim() || null,
                ruta: ruta.trim() || null,
                prox_mant_km: proxMantKm.trim() || null,
                km_para_mantenimiento: kmParaMantenimiento.trim() || null,
                km_actual: kmActual.trim(),
                estado: estado,
                vehiculo_id: vehiculoId.trim(),
                registros_viaje: editingControl.tripRecords,
              };

              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await updateMileageControl({
                  id: editingControl.id!,
                  requestData,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Control de kilometraje actualizado correctamente');
                  cancelEditing();
                  fetchMileageControls();
                } else {
                  Alert.alert('Error', result.message || 'Error al actualizar el control de kilometraje');
                }
              } else {
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];

                if (editingControl.id_local) {
                  const createActionIndex = actions.findIndex(
                    (a: any) => a.id === editingControl.id_local && a.action === 'create' && a.type === 'mileage_control'
                  );
                  if (createActionIndex !== -1) {
                    actions[createActionIndex].payload = { ...actions[createActionIndex].payload, ...requestData };
                  } else {
                    actions.push({
                      id: editingControl.id,
                      action: 'update',
                      type: 'mileage_control',
                      payload: requestData,
                      synced: false,
                    });
                  }
                } else {
                  actions.push({
                    id: editingControl.id,
                    action: 'update',
                    type: 'mileage_control',
                    payload: requestData,
                    synced: false,
                  });
                }

                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                if (cacheStr) {
                  const cache = JSON.parse(cacheStr);
                  const updatedCache = cache.map((item: any) => {
                    if ((item.id === editingControl.id || item.id_local === editingControl.id_local) && item.type === 'mileage_control') {
                      return {
                        ...item,
                        ...requestData,
                        registros_viaje: editingControl.tripRecords,
                        synced: false,
                      };
                    }
                    return item;
                  });
                  await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                }

                Alert.alert('Modo Offline', 'Control de kilometraje actualizado localmente. Se sincronizará cuando haya conexión.');
                cancelEditing();
                fetchMileageControls();
              }
            } catch (err) {
              console.error('Error updating mileage control:', err);
              Alert.alert('Error', 'No se pudo actualizar el control de kilometraje');
            }
          },
        },
      ]
    );
  };

  const deleteMileageControlHandler = async (control: MileageControl) => {
    Alert.alert(
      'Confirmar eliminación',
      '¿Estás seguro de que deseas eliminar este control de kilometraje?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await deleteMileageControl({
                  id: control.id,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Control de kilometraje eliminado correctamente');
                  fetchMileageControls();
                } else {
                  Alert.alert('Error', result.message || 'Error al eliminar el control de kilometraje');
                }
              } else {
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];

                actions.push({
                  id: control.id || control.id_local,
                  action: 'delete',
                  type: 'mileage_control',
                  payload: { id: control.id },
                  synced: false,
                });

                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                if (cacheStr) {
                  const cache = JSON.parse(cacheStr);
                  const updatedCache = cache.filter(
                    (item: any) => !(item.id === control.id || item.id_local === control.id_local) || item.type !== 'mileage_control'
                  );
                  await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                }

                Alert.alert('Modo Offline', 'Control de kilometraje eliminado localmente. Se sincronizará cuando haya conexión.');
                fetchMileageControls();
              }
            } catch (err) {
              console.error('Error deleting mileage control:', err);
              Alert.alert('Error', 'No se pudo eliminar el control de kilometraje');
            }
          },
        },
      ]
    );
  };

  const toggleExpand = (id: string) => {
    setExpandedControlIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'add': return <Ionicons name="add" size={24} color="#FFFFFF" />;
      case 'edit': return <Ionicons name="pencil" size={20} color="#FFFFFF" />;
      case 'delete': return <Ionicons name="trash" size={20} color="#FFFFFF" />;
      case 'save': return <Ionicons name="save" size={20} color="#FFFFFF" />;
      case 'cancel': return <Ionicons name="close" size={20} color="#FFFFFF" />;
      default: return null;
    }
  };

  const renderForm = (isEditing: boolean = false) => {
    const control = isEditing ? editingControl : newControl;
    if (!control) return null;

    return (
      <ThemedView style={styles.formCard}>
        <ThemedText style={styles.formTitle}>
          {isEditing ? 'Editar Control de Kilometraje' : 'Nuevo Control de Kilometraje'}
        </ThemedText>

        {/* Chofer Responsable */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Chofer Responsable:</ThemedText>
          <ThemedView style={styles.choferContainer}>
            <TextInput
              style={[styles.formInput, styles.choferIdInput]}
              placeholder="ID (Ej: C031)"
              placeholderTextColor="#999"
              value={choferId}
              onChangeText={setChoferId}
            />
            <ThemedText style={styles.choferSeparator}>|</ThemedText>
            <TextInput
              style={[styles.formInput, styles.choferNombreInput]}
              placeholder="Nombre completo"
              placeholderTextColor="#999"
              value={choferNombre}
              onChangeText={setChoferNombre}
            />
          </ThemedView>
        </ThemedView>

        {/* Total Km */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Total Km:</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="0"
            placeholderTextColor="#999"
            keyboardType="numeric"
            value={totalKm}
            onChangeText={setTotalKm}
          />
        </ThemedView>

        {/* Ruta */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Ruta:</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="Ej: ZONA SUR"
            placeholderTextColor="#999"
            value={ruta}
            onChangeText={setRuta}
          />
        </ThemedView>

        {/* Prox Mant Km */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Prox Mant Km:</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="0"
            placeholderTextColor="#999"
            keyboardType="numeric"
            value={proxMantKm}
            onChangeText={setProxMantKm}
          />
        </ThemedView>

        {/* KM para Mantenimiento */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>KM para Mantenimiento:</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="0"
            placeholderTextColor="#999"
            keyboardType="numeric"
            value={kmParaMantenimiento}
            onChangeText={setKmParaMantenimiento}
          />
        </ThemedView>

        {/* km Actual */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>km Actual:</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="0"
            placeholderTextColor="#999"
            keyboardType="numeric"
            value={kmActual}
            onChangeText={setKmActual}
          />
        </ThemedView>

        {/* Estado */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Estado:</ThemedText>
          <ThemedView style={styles.pickerContainer}>
            <Picker
              selectedValue={estado}
              onValueChange={setEstado}
              style={styles.picker}
            >
              <Picker.Item label="Todo en orden" value="Todo en orden" />
              <Picker.Item label="Requiere atención" value="Requiere atención" />
              <Picker.Item label="Mantenimiento próximo" value="Mantenimiento próximo" />
            </Picker>
          </ThemedView>
        </ThemedView>

        {/* Identificación del Vehículo */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Identificación del Vehículo:</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="Ej: CL 368587"
            placeholderTextColor="#999"
            value={vehiculoId}
            onChangeText={setVehiculoId}
          />
        </ThemedView>

        {/* Registros de Viaje */}
        <ThemedView style={styles.formGroup}>
          <ThemedView style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Registros de Viaje</ThemedText>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => addTripRecord(isEditing)}
            >
              <ThemedText style={styles.addButtonText}>{getActionIcon('add')}</ThemedText>
            </TouchableOpacity>
          </ThemedView>

          {control.tripRecords.map((record, index) => (
            <ThemedView key={index} style={styles.tripRecordCard}>
              <ThemedView style={styles.tripRecordHeader}>
                <ThemedText style={styles.tripRecordTitle}>Registro #{index + 1}</ThemedText>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => removeTripRecord(index, isEditing)}
                >
                  <ThemedText style={styles.deleteButtonText}>{getActionIcon('delete')}</ThemedText>
                </TouchableOpacity>
              </ThemedView>

              <ThemedView style={styles.tripField}>
                <ThemedText style={styles.tripLabel}>Chofer en Ruta:</ThemedText>
                <TextInput
                  style={styles.tripInput}
                  placeholder="Nombre del chofer"
                  placeholderTextColor="#999"
                  value={record.chofer_en_ruta}
                  onChangeText={(text) => updateTripRecord(index, 'chofer_en_ruta', text, isEditing)}
                />
              </ThemedView>

              <ThemedView style={styles.tripField}>
                <ThemedText style={styles.tripLabel}>Fecha:</ThemedText>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowDatePickers({ ...showDatePickers, [`date-${index}`]: true })}
                >
                  <ThemedText style={styles.dateButtonText}>{record.fecha}</ThemedText>
                  <Ionicons name="calendar" size={20} color="#007AFF" />
                </TouchableOpacity>
                {showDatePickers[`date-${index}`] && (
                  <DateTimePicker
                    value={new Date(record.fecha)}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, date) => handleDateChange(index, event, date, isEditing)}
                  />
                )}
              </ThemedView>

              <ThemedView style={styles.tripField}>
                <ThemedText style={styles.tripLabel}>Kilometraje de Salida:</ThemedText>
                <TextInput
                  style={styles.tripInput}
                  placeholder="0"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                  value={record.kilometraje_salida}
                  onChangeText={(text) => updateTripRecord(index, 'kilometraje_salida', text, isEditing)}
                />
              </ThemedView>

              <ThemedView style={styles.tripField}>
                <ThemedText style={styles.tripLabel}>Kilometraje de Llegada:</ThemedText>
                <TextInput
                  style={styles.tripInput}
                  placeholder="0"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                  value={record.kilometraje_llegada}
                  onChangeText={(text) => updateTripRecord(index, 'kilometraje_llegada', text, isEditing)}
                />
              </ThemedView>

              <ThemedView style={styles.tripField}>
                <ThemedText style={styles.tripLabel}>Hora de Salida:</ThemedText>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowTimePickers({ ...showTimePickers, [`hora_salida-${index}`]: true })}
                >
                  <ThemedText style={styles.dateButtonText}>{record.hora_salida}</ThemedText>
                  <Ionicons name="time" size={20} color="#007AFF" />
                </TouchableOpacity>
                {showTimePickers[`hora_salida-${index}`] && (
                  <DateTimePicker
                    value={new Date(`2000-01-01T${record.hora_salida}`)}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, time) => handleTimeChange(index, 'hora_salida', event, time, isEditing)}
                  />
                )}
              </ThemedView>

              <ThemedView style={styles.tripField}>
                <ThemedText style={styles.tripLabel}>Hora de Llegada:</ThemedText>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowTimePickers({ ...showTimePickers, [`hora_llegada-${index}`]: true })}
                >
                  <ThemedText style={styles.dateButtonText}>{record.hora_llegada}</ThemedText>
                  <Ionicons name="time" size={20} color="#007AFF" />
                </TouchableOpacity>
                {showTimePickers[`hora_llegada-${index}`] && (
                  <DateTimePicker
                    value={new Date(`2000-01-01T${record.hora_llegada}`)}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, time) => handleTimeChange(index, 'hora_llegada', event, time, isEditing)}
                  />
                )}
              </ThemedView>

              <ThemedView style={styles.tripField}>
                <ThemedText style={styles.tripLabel}>Total de Kilómetros:</ThemedText>
                <ThemedView style={styles.calculatedValue}>
                  <ThemedText style={styles.calculatedText}>{record.total_kilometros} km</ThemedText>
                </ThemedView>
              </ThemedView>

              <ThemedView style={styles.tripField}>
                <ThemedText style={styles.tripLabel}>Tiempo de Viaje:</ThemedText>
                <ThemedView style={styles.calculatedValue}>
                  <ThemedText style={styles.calculatedText}>{record.tiempo_viaje}</ThemedText>
                </ThemedView>
              </ThemedView>

              <ThemedView style={styles.tripField}>
                <ThemedText style={styles.tripLabel}>Motivo Visita:</ThemedText>
                <TextInput
                  style={[styles.tripInput, styles.textArea]}
                  placeholder="Descripción del motivo"
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  value={record.motivo_visita}
                  onChangeText={(text) => updateTripRecord(index, 'motivo_visita', text, isEditing)}
                />
              </ThemedView>
            </ThemedView>
          ))}
        </ThemedView>

        {/* Action Buttons */}
        <ThemedView style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.saveButton]}
            onPress={isEditing ? updateMileageControlHandler : saveMileageControl}
          >
            <ThemedText style={styles.actionButtonText}>
              {getActionIcon('save')} {isEditing ? 'Actualizar' : 'Guardar'}
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.cancelButton]}
            onPress={isEditing ? cancelEditing : cancelCreating}
          >
            <ThemedText style={styles.actionButtonText}>
              {getActionIcon('cancel')} Cancelar
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </ThemedView>
    );
  };

  if (!hasCurrentMarca) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader onMenuPress={() => setIsMenuVisible(true)} title="Control de Kilometraje" />
        <ThemedView style={styles.noMarcaContainer}>
          <ThemedText style={styles.noMarcaText}>
            No hay marca registrada. Por favor, registre una marca primero.
          </ThemedText>
        </ThemedView>
        <AppFooter />
        <SlideMenu
          isVisible={isMenuVisible}
          onClose={() => setIsMenuVisible(false)}
          onHomePress={() => navigation.navigate('Home')}
        />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <AppHeader onMenuPress={() => setIsMenuVisible(true)} title="Control de Kilometraje" />
      
      <ScrollView style={styles.scrollView}>
        <ThemedView style={styles.contentContainer}>
          {/* Module Title */}
          <ThemedView style={styles.titleContainer}>
            <ThemedText type="title" style={styles.title}>
              CONTROL DE KILOMETRAJE
            </ThemedText>
          </ThemedView>

          {/* Create Button */}
          {!isCreating && !editingControl && (
            <TouchableOpacity style={styles.createButton} onPress={startCreating}>
              <ThemedText style={styles.createButtonText}>
                {getActionIcon('add')} Nuevo Control
              </ThemedText>
            </TouchableOpacity>
          )}

          {/* Form Section */}
          {isCreating && renderForm(false)}
          {editingControl && renderForm(true)}

          {/* List Section */}
          {!isCreating && !editingControl && (
            <>
              {isLoading ? (
                <ThemedView style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#007AFF" />
                  <ThemedText style={styles.loadingText}>Cargando controles...</ThemedText>
                </ThemedView>
              ) : error ? (
                <ThemedView style={styles.errorContainer}>
                  <ThemedText style={styles.errorText}>{error}</ThemedText>
                </ThemedView>
              ) : mileageControls.length === 0 ? (
                <ThemedView style={styles.emptyContainer}>
                  <ThemedText style={styles.emptyText}>No hay controles de kilometraje registrados</ThemedText>
                </ThemedView>
              ) : (
                <ThemedView style={styles.listContainer}>
                  {mileageControls.map((control) => (
                    <ThemedView key={control.id || control.id_local} style={styles.controlCard}>
                      <TouchableOpacity
                        style={styles.controlHeader}
                        onPress={() => toggleExpand(control.id || control.id_local)}
                      >
                        <ThemedView style={styles.controlHeaderLeft}>
                          <ThemedText style={styles.controlTitle}>
                            {control.vehiculo_id || 'Sin identificación'}
                          </ThemedText>
                          <ThemedText style={styles.controlSubtitle}>
                            {control.chofer_nombre || 'Sin chofer'}
                          </ThemedText>
                        </ThemedView>
                        <ThemedView style={styles.controlHeaderRight}>
                          {control.id_local && !control.synced && (
                            <ThemedText style={styles.offlineBadge}>Offline</ThemedText>
                          )}
                          <Ionicons
                            name={expandedControlIds.includes(control.id || control.id_local) ? 'chevron-up' : 'chevron-down'}
                            size={24}
                            color="#007AFF"
                          />
                        </ThemedView>
                      </TouchableOpacity>

                      {expandedControlIds.includes(control.id || control.id_local) && (
                        <ThemedView style={styles.controlDetails}>
                          <ThemedView style={styles.detailRow}>
                            <ThemedText style={styles.detailLabel}>Chofer ID:</ThemedText>
                            <ThemedText style={styles.detailValue}>{control.chofer_id || 'N/A'}</ThemedText>
                          </ThemedView>
                          <ThemedView style={styles.detailRow}>
                            <ThemedText style={styles.detailLabel}>Total Km:</ThemedText>
                            <ThemedText style={styles.detailValue}>{control.total_km || '0'}</ThemedText>
                          </ThemedView>
                          <ThemedView style={styles.detailRow}>
                            <ThemedText style={styles.detailLabel}>Ruta:</ThemedText>
                            <ThemedText style={styles.detailValue}>{control.ruta || 'N/A'}</ThemedText>
                          </ThemedView>
                          <ThemedView style={styles.detailRow}>
                            <ThemedText style={styles.detailLabel}>Km Actual:</ThemedText>
                            <ThemedText style={styles.detailValue}>{control.km_actual || '0'}</ThemedText>
                          </ThemedView>
                          <ThemedView style={styles.detailRow}>
                            <ThemedText style={styles.detailLabel}>Estado:</ThemedText>
                            <ThemedText style={styles.detailValue}>{control.estado || 'N/A'}</ThemedText>
                          </ThemedView>
                          <ThemedView style={styles.detailRow}>
                            <ThemedText style={styles.detailLabel}>Registros de Viaje:</ThemedText>
                            <ThemedText style={styles.detailValue}>{control.registros_viaje?.length || 0}</ThemedText>
                          </ThemedView>

                          <ThemedView style={styles.actionButtonsRow}>
                            <TouchableOpacity
                              style={[styles.actionButtonSmall, styles.editButton]}
                              onPress={() => startEditing(control)}
                            >
                              <ThemedText style={styles.actionButtonSmallText}>
                                {getActionIcon('edit')} Editar
                              </ThemedText>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.actionButtonSmall, styles.deleteButtonSmall]}
                              onPress={() => deleteMileageControlHandler(control)}
                            >
                              <ThemedText style={styles.actionButtonSmallText}>
                                {getActionIcon('delete')} Eliminar
                              </ThemedText>
                            </TouchableOpacity>
                          </ThemedView>
                        </ThemedView>
                      )}
                    </ThemedView>
                  ))}
                </ThemedView>
              )}
            </>
          )}
        </ThemedView>
      </ScrollView>

      <AppFooter />
      <SlideMenu
        isVisible={isMenuVisible}
        onClose={() => setIsMenuVisible(false)}
        onHomePress={() => navigation.navigate('Home')}
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
  contentContainer: {
    padding: 20,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 30,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  noMarcaContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  noMarcaText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#FF9500',
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
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 20,
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
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
  choferContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  choferIdInput: {
    flex: 1,
  },
  choferSeparator: {
    fontSize: 18,
    color: '#666',
  },
  choferNombreInput: {
    flex: 3,
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  tripRecordCard: {
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  tripRecordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tripRecordTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  tripField: {
    marginBottom: 12,
  },
  tripLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    color: '#333',
  },
  tripInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    color: '#000000',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  dateButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  calculatedValue: {
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  calculatedText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    backgroundColor: '#34C759',
  },
  cancelButton: {
    backgroundColor: '#8E8E93',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    padding: 40,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  listContainer: {
    gap: 16,
  },
  controlCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  controlHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  controlHeaderLeft: {
    flex: 1,
  },
  controlHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  controlTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  controlSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  offlineBadge: {
    backgroundColor: '#FF9500',
    color: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 12,
    fontWeight: '600',
  },
  controlDetails: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  detailValue: {
    fontSize: 14,
    color: '#666',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  actionButtonSmall: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButton: {
    backgroundColor: '#007AFF',
  },
  deleteButtonSmall: {
    backgroundColor: '#FF3B30',
  },
  actionButtonSmallText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

