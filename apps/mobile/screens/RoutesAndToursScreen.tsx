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
import { createRouteAndTour, updateRouteAndTour, deleteRouteAndTour, listRoutesAndToursByCorpo } from '@/hooks/evaluationFunctions';
import { eventBus } from '@/hooks/eventBus';

type RoutesAndToursScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'RoutesAndTours'>;

interface RouteAndTour {
  id: string;
  id_local: string;
  sociedad: string | null;
  cliente: string | null;
  zona: string | null;
  cantidad_personal: string | null;
  gira_ruta: string | null;
  dia_entrega: string | null;
  estatus: string | null;
  cumplimiento_supervision: string | null;
  cumplimiento_entrega_insumos: string | null;
  persona_refuerzo: string | null;
  notas_cambios: string | null;
  estado: string | null;
  nombre_persona_refuerzo: string | null;
  created_at: string;
  synced?: boolean;
}

interface EditingRouteAndTour {
  id: string | null;
  id_local: string;
  sociedad: string;
  cliente: string;
  zona: string;
  cantidad_personal: string;
  gira_ruta: string;
  dia_entrega: string;
  estatus: string;
  cumplimiento_supervision: string;
  cumplimiento_entrega_insumos: string;
  persona_refuerzo: string;
  notas_cambios: string;
  estado: string;
  nombre_persona_refuerzo: string;
}

export default function RoutesAndToursScreen() {
  const { employee, refreshAccessToken, logout } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<RoutesAndToursScreenNavigationProp>();

  // Data states
  const [routesAndTours, setRoutesAndTours] = useState<RouteAndTour[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasCurrentMarca, setHasCurrentMarca] = useState<boolean>(false);

  // Editing state
  const [editingRecord, setEditingRecord] = useState<EditingRouteAndTour | null>(null);

  // Creating state
  const [isCreating, setIsCreating] = useState(false);
  const [newRecord, setNewRecord] = useState<EditingRouteAndTour>({
    id: null,
    id_local: '',
    sociedad: '',
    cliente: '',
    zona: '',
    cantidad_personal: '',
    gira_ruta: '',
    dia_entrega: '',
    estatus: '',
    cumplimiento_supervision: '',
    cumplimiento_entrega_insumos: '',
    persona_refuerzo: '',
    notas_cambios: '',
    estado: '',
    nombre_persona_refuerzo: '',
  });

  // Form states
  const [sociedad, setSociedad] = useState('');
  const [cliente, setCliente] = useState('');
  const [zona, setZona] = useState('');
  const [cantidadPersonal, setCantidadPersonal] = useState('');
  const [giraRuta, setGiraRuta] = useState('');
  const [diaEntrega, setDiaEntrega] = useState('');
  const [estatus, setEstatus] = useState('');
  const [cumplimientoSupervision, setCumplimientoSupervision] = useState('');
  const [cumplimientoEntregaInsumos, setCumplimientoEntregaInsumos] = useState('');
  const [personaRefuerzo, setPersonaRefuerzo] = useState('');
  const [notasCambios, setNotasCambios] = useState('');
  const [estado, setEstado] = useState('');
  const [nombrePersonaRefuerzo, setNombrePersonaRefuerzo] = useState('');

  // Date picker state
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Expanded details state
  const [expandedRecordIds, setExpandedRecordIds] = useState<string[]>([]);

  const getConnectionStatus = async (): Promise<boolean> => {
    const networkState = await Network.getNetworkStateAsync();
    return networkState.isConnected && networkState.isInternetReachable ? true : false;
  };

  const generateRandomId = (): string => {
    return `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  useFocusEffect(
    useCallback(() => {
      fetchRoutesAndTours();
    }, [])
  );

  useEffect(() => {
    const handler = () => {
      fetchRoutesAndTours();
    };

    eventBus.on('connectionRestored', handler);
    return () => {
      eventBus.off('connectionRestored', handler);
    };
  }, []);

  const fetchRoutesAndTours = async () => {
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
        const result = await listRoutesAndToursByCorpo({
          corpo_id: corpoId,
          refreshAccessToken,
          logout,
        });

        if (result.status && result.data) {
          setRoutesAndTours(result.data);
          // Actualizar cache
          await AsyncStorage.setItem('evaluations_cache', JSON.stringify(
            result.data.map((item: any) => ({
              ...item,
              type: 'routes_and_tours',
              synced: true,
            }))
          ));
        } else {
          setError(result.message || 'Error al cargar las rutas y giras');
        }
      } else {
        // Sin internet: cargar desde cache
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const routesAndToursCache = cache.filter((item: any) => item.type === 'routes_and_tours');
          setRoutesAndTours(routesAndToursCache);
        } else {
          setRoutesAndTours([]);
        }
      }
    } catch (err) {
      console.error('Error fetching routes and tours:', err);
      setError('Error al cargar las rutas y giras');
      try {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const routesAndToursCache = cache.filter((item: any) => item.type === 'routes_and_tours');
          setRoutesAndTours(routesAndToursCache);
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

  const startCreating = () => {
    setIsCreating(true);
    setNewRecord({
      id: null,
      id_local: '',
      sociedad: '',
      cliente: '',
      zona: '',
      cantidad_personal: '',
      gira_ruta: '',
      dia_entrega: '',
      estatus: '',
      cumplimiento_supervision: '',
      cumplimiento_entrega_insumos: '',
      persona_refuerzo: '',
      notas_cambios: '',
      estado: '',
      nombre_persona_refuerzo: '',
    });
    setSociedad('');
    setCliente('');
    setZona('');
    setCantidadPersonal('');
    setGiraRuta('');
    setDiaEntrega('');
    setEstatus('');
    setCumplimientoSupervision('');
    setCumplimientoEntregaInsumos('');
    setPersonaRefuerzo('');
    setNotasCambios('');
    setEstado('');
    setNombrePersonaRefuerzo('');
  };

  const cancelCreating = () => {
    setIsCreating(false);
    setNewRecord({
      id: null,
      id_local: '',
      sociedad: '',
      cliente: '',
      zona: '',
      cantidad_personal: '',
      gira_ruta: '',
      dia_entrega: '',
      estatus: '',
      cumplimiento_supervision: '',
      cumplimiento_entrega_insumos: '',
      persona_refuerzo: '',
      notas_cambios: '',
      estado: '',
      nombre_persona_refuerzo: '',
    });
  };

  const startEditing = (record: RouteAndTour) => {
    setEditingRecord({
      id: record.id,
      id_local: record.id_local,
      sociedad: record.sociedad || '',
      cliente: record.cliente || '',
      zona: record.zona || '',
      cantidad_personal: record.cantidad_personal || '',
      gira_ruta: record.gira_ruta || '',
      dia_entrega: record.dia_entrega || '',
      estatus: record.estatus || '',
      cumplimiento_supervision: record.cumplimiento_supervision || '',
      cumplimiento_entrega_insumos: record.cumplimiento_entrega_insumos || '',
      persona_refuerzo: record.persona_refuerzo || '',
      notas_cambios: record.notas_cambios || '',
      estado: record.estado || '',
      nombre_persona_refuerzo: record.nombre_persona_refuerzo || '',
    });
    setSociedad(record.sociedad || '');
    setCliente(record.cliente || '');
    setZona(record.zona || '');
    setCantidadPersonal(record.cantidad_personal || '');
    setGiraRuta(record.gira_ruta || '');
    setDiaEntrega(record.dia_entrega || '');
    setEstatus(record.estatus || '');
    setCumplimientoSupervision(record.cumplimiento_supervision || '');
    setCumplimientoEntregaInsumos(record.cumplimiento_entrega_insumos || '');
    setPersonaRefuerzo(record.persona_refuerzo || '');
    setNotasCambios(record.notas_cambios || '');
    setEstado(record.estado || '');
    setNombrePersonaRefuerzo(record.nombre_persona_refuerzo || '');
  };

  const cancelEditing = () => {
    setEditingRecord(null);
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setDiaEntrega(formatDate(selectedDate));
    }
  };

  const saveRouteAndTour = async () => {
    if (!sociedad.trim()) {
      Alert.alert('Error', 'La sociedad es requerida');
      return;
    }
    if (!cliente.trim()) {
      Alert.alert('Error', 'El cliente es requerido');
      return;
    }
    if (!zona.trim()) {
      Alert.alert('Error', 'La zona es requerida');
      return;
    }
    if (!cantidadPersonal.trim()) {
      Alert.alert('Error', 'La cantidad de personal es requerida');
      return;
    }
    if (!giraRuta.trim()) {
      Alert.alert('Error', 'La gira o ruta es requerida');
      return;
    }
    if (!diaEntrega.trim()) {
      Alert.alert('Error', 'El día de entrega es requerido');
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
      '¿Estás seguro de que deseas guardar esta ruta o gira?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const requestData = {
                marca_id: currentMarcaData.id,
                sociedad: sociedad.trim(),
                cliente: cliente.trim(),
                zona: zona.trim(),
                cantidad_personal: cantidadPersonal.trim(),
                gira_ruta: giraRuta.trim(),
                dia_entrega: diaEntrega.trim(),
                estatus: estatus.trim() || null,
                cumplimiento_supervision: cumplimientoSupervision.trim() || null,
                cumplimiento_entrega_insumos: cumplimientoEntregaInsumos.trim() || null,
                persona_refuerzo: personaRefuerzo.trim() || null,
                notas_cambios: notasCambios.trim() || null,
                estado: estado.trim() || null,
                nombre_persona_refuerzo: nombrePersonaRefuerzo.trim() || null,
              };

              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await createRouteAndTour({
                  requestData,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Ruta o gira guardada correctamente');
                  cancelCreating();
                  fetchRoutesAndTours();
                } else {
                  Alert.alert('Error', result.message || 'Error al guardar la ruta o gira');
                }
              } else {
                const localId = generateRandomId();

                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: localId,
                  action: 'create',
                  type: 'routes_and_tours',
                  payload: requestData,
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                const cache = cacheStr ? JSON.parse(cacheStr) : [];

                const newRecordCache: RouteAndTour = {
                  id: '',
                  id_local: localId,
                  sociedad: sociedad.trim(),
                  cliente: cliente.trim(),
                  zona: zona.trim(),
                  cantidad_personal: cantidadPersonal.trim(),
                  gira_ruta: giraRuta.trim(),
                  dia_entrega: diaEntrega.trim(),
                  estatus: estatus.trim() || null,
                  cumplimiento_supervision: cumplimientoSupervision.trim() || null,
                  cumplimiento_entrega_insumos: cumplimientoEntregaInsumos.trim() || null,
                  persona_refuerzo: personaRefuerzo.trim() || null,
                  notas_cambios: notasCambios.trim() || null,
                  estado: estado.trim() || null,
                  nombre_persona_refuerzo: nombrePersonaRefuerzo.trim() || null,
                  created_at: new Date().toISOString(),
                  synced: false,
                };

                cache.push({ ...newRecordCache, type: 'routes_and_tours' });
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(cache));

                Alert.alert('Modo Offline', 'Ruta o gira registrada localmente. Se sincronizará cuando haya conexión.');
                cancelCreating();
                fetchRoutesAndTours();
              }
            } catch (err) {
              console.error('Error saving route and tour:', err);
              Alert.alert('Error', 'No se pudo guardar la ruta o gira');
            }
          },
        },
      ]
    );
  };

  const updateRouteAndTourHandler = async () => {
    if (!editingRecord) return;

    if (!sociedad.trim()) {
      Alert.alert('Error', 'La sociedad es requerida');
      return;
    }
    if (!cliente.trim()) {
      Alert.alert('Error', 'El cliente es requerido');
      return;
    }
    if (!zona.trim()) {
      Alert.alert('Error', 'La zona es requerida');
      return;
    }
    if (!cantidadPersonal.trim()) {
      Alert.alert('Error', 'La cantidad de personal es requerida');
      return;
    }
    if (!giraRuta.trim()) {
      Alert.alert('Error', 'La gira o ruta es requerida');
      return;
    }
    if (!diaEntrega.trim()) {
      Alert.alert('Error', 'El día de entrega es requerido');
      return;
    }

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas actualizar esta ruta o gira?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const requestData = {
                sociedad: sociedad.trim(),
                cliente: cliente.trim(),
                zona: zona.trim(),
                cantidad_personal: cantidadPersonal.trim(),
                gira_ruta: giraRuta.trim(),
                dia_entrega: diaEntrega.trim(),
                estatus: estatus.trim() || null,
                cumplimiento_supervision: cumplimientoSupervision.trim() || null,
                cumplimiento_entrega_insumos: cumplimientoEntregaInsumos.trim() || null,
                persona_refuerzo: personaRefuerzo.trim() || null,
                notas_cambios: notasCambios.trim() || null,
                estado: estado.trim() || null,
                nombre_persona_refuerzo: nombrePersonaRefuerzo.trim() || null,
              };

              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await updateRouteAndTour({
                  id: editingRecord.id!,
                  requestData,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Ruta o gira actualizada correctamente');
                  cancelEditing();
                  fetchRoutesAndTours();
                } else {
                  Alert.alert('Error', result.message || 'Error al actualizar la ruta o gira');
                }
              } else {
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];

                if (editingRecord.id_local) {
                  const createActionIndex = actions.findIndex(
                    (a: any) => a.id === editingRecord.id_local && a.action === 'create' && a.type === 'routes_and_tours'
                  );
                  if (createActionIndex !== -1) {
                    actions[createActionIndex].payload = { ...actions[createActionIndex].payload, ...requestData };
                  } else {
                    actions.push({
                      id: editingRecord.id,
                      action: 'update',
                      type: 'routes_and_tours',
                      payload: requestData,
                      synced: false,
                    });
                  }
                } else {
                  actions.push({
                    id: editingRecord.id,
                    action: 'update',
                    type: 'routes_and_tours',
                    payload: requestData,
                    synced: false,
                  });
                }

                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                if (cacheStr) {
                  const cache = JSON.parse(cacheStr);
                  const updatedCache = cache.map((item: any) => {
                    if ((item.id === editingRecord.id || item.id_local === editingRecord.id_local) && item.type === 'routes_and_tours') {
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

                Alert.alert('Modo Offline', 'Ruta o gira actualizada localmente. Se sincronizará cuando haya conexión.');
                cancelEditing();
                fetchRoutesAndTours();
              }
            } catch (err) {
              console.error('Error updating route and tour:', err);
              Alert.alert('Error', 'No se pudo actualizar la ruta o gira');
            }
          },
        },
      ]
    );
  };

  const deleteRouteAndTourHandler = async (record: RouteAndTour) => {
    Alert.alert(
      'Confirmar eliminación',
      '¿Estás seguro de que deseas eliminar esta ruta o gira?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await deleteRouteAndTour({
                  id: record.id,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Ruta o gira eliminada correctamente');
                  fetchRoutesAndTours();
                } else {
                  Alert.alert('Error', result.message || 'Error al eliminar la ruta o gira');
                }
              } else {
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];

                actions.push({
                  id: record.id || record.id_local,
                  action: 'delete',
                  type: 'routes_and_tours',
                  payload: { id: record.id },
                  synced: false,
                });

                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                if (cacheStr) {
                  const cache = JSON.parse(cacheStr);
                  const updatedCache = cache.filter(
                    (item: any) => !(item.id === record.id || item.id_local === record.id_local) || item.type !== 'routes_and_tours'
                  );
                  await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                }

                Alert.alert('Modo Offline', 'Ruta o gira eliminada localmente. Se sincronizará cuando haya conexión.');
                fetchRoutesAndTours();
              }
            } catch (err) {
              console.error('Error deleting route and tour:', err);
              Alert.alert('Error', 'No se pudo eliminar la ruta o gira');
            }
          },
        },
      ]
    );
  };

  const toggleExpand = (id: string) => {
    setExpandedRecordIds(prev =>
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
    return (
      <ThemedView style={styles.formCard}>
        <ThemedText style={styles.formTitle}>
          {isEditing ? 'Editar Ruta o Gira' : 'Nueva Ruta o Gira'}
        </ThemedText>

        {/* Sociedad */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Sociedad *</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="Ej: Charmander"
            placeholderTextColor="#999"
            value={sociedad}
            onChangeText={setSociedad}
          />
        </ThemedView>

        {/* Cliente */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Cliente *</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="Ej: Ministerio de Agricultura y Ganaderia"
            placeholderTextColor="#999"
            value={cliente}
            onChangeText={setCliente}
          />
        </ThemedView>

        {/* Zona */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Zona *</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="Ej: POCOCI-GUAPILES"
            placeholderTextColor="#999"
            value={zona}
            onChangeText={setZona}
          />
        </ThemedView>

        {/* Cantidad Personal */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Cantidad Personal *</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="0"
            placeholderTextColor="#999"
            keyboardType="numeric"
            value={cantidadPersonal}
            onChangeText={setCantidadPersonal}
          />
        </ThemedView>

        {/* Gira o Ruta */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Gira o Ruta *</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="Ej: Limon"
            placeholderTextColor="#999"
            value={giraRuta}
            onChangeText={setGiraRuta}
          />
        </ThemedView>

        {/* Día Entrega */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Día Entrega *</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="Ej: 03 AL 07 DE NOVIEMBRE"
            placeholderTextColor="#999"
            value={diaEntrega}
            onChangeText={setDiaEntrega}
          />
        </ThemedView>

        {/* Estatus */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Estatus</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="Ej: PENDIENTE DE ENTREGA Y SUPERVISION"
            placeholderTextColor="#999"
            value={estatus}
            onChangeText={setEstatus}
          />
        </ThemedView>

        {/* Cumplimiento Supervisión */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Cumplimiento Supervisión</ThemedText>
          <ThemedView style={styles.pickerContainer}>
            <Picker
              selectedValue={cumplimientoSupervision}
              onValueChange={setCumplimientoSupervision}
              style={styles.picker}
            >
              <Picker.Item label="Seleccionar" value="" />
              <Picker.Item label="Realizado" value="Realizado" />
              <Picker.Item label="Pendiente" value="Pendiente" />
              <Picker.Item label="N/A" value="N/A" />
            </Picker>
          </ThemedView>
        </ThemedView>

        {/* Cumplimiento Entrega de Insumos */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Cumplimiento Entrega de Insumos</ThemedText>
          <ThemedView style={styles.pickerContainer}>
            <Picker
              selectedValue={cumplimientoEntregaInsumos}
              onValueChange={setCumplimientoEntregaInsumos}
              style={styles.picker}
            >
              <Picker.Item label="Seleccionar" value="" />
              <Picker.Item label="Realizado" value="Realizado" />
              <Picker.Item label="Pendiente" value="Pendiente" />
              <Picker.Item label="N/A" value="N/A" />
            </Picker>
          </ThemedView>
        </ThemedView>

        {/* Persona Refuerzo */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Persona Refuerzo</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="Nombre de la persona"
            placeholderTextColor="#999"
            value={personaRefuerzo}
            onChangeText={setPersonaRefuerzo}
          />
        </ThemedView>

        {/* Notas o Cambios */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Notas o Cambios</ThemedText>
          <TextInput
            style={[styles.formInput, styles.textArea]}
            placeholder="Notas o cambios adicionales"
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            value={notasCambios}
            onChangeText={setNotasCambios}
          />
        </ThemedView>

        {/* Estado */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Estado</ThemedText>
          <ThemedView style={styles.pickerContainer}>
            <Picker
              selectedValue={estado}
              onValueChange={setEstado}
              style={styles.picker}
            >
              <Picker.Item label="Seleccionar" value="" />
              <Picker.Item label="Pendiente de entrega y supervisión" value="Pendiente de entrega y supervisión" />
              <Picker.Item label="Entregado" value="Entregado" />
            </Picker>
          </ThemedView>
        </ThemedView>

        {/* Nombre Persona Refuerzo */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Nombre de Persona de Refuerzo</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="Nombre completo"
            placeholderTextColor="#999"
            value={nombrePersonaRefuerzo}
            onChangeText={setNombrePersonaRefuerzo}
          />
        </ThemedView>

        {/* Action Buttons */}
        <ThemedView style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.saveButton]}
            onPress={isEditing ? updateRouteAndTourHandler : saveRouteAndTour}
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
        <AppHeader onMenuPress={() => setIsMenuVisible(true)} title="Rutas y Giras" />
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
      <AppHeader onMenuPress={() => setIsMenuVisible(true)} title="Rutas y Giras" />
      
      <ScrollView style={styles.scrollView}>
        <ThemedView style={styles.contentContainer}>
          {/* Module Title */}
          <ThemedView style={styles.titleContainer}>
            <ThemedText type="title" style={styles.title}>
              RUTAS Y GIRAS
            </ThemedText>
          </ThemedView>

          {/* Create Button */}
          {!isCreating && !editingRecord && (
            <TouchableOpacity style={styles.createButton} onPress={startCreating}>
              <ThemedText style={styles.createButtonText}>
                {getActionIcon('add')} Nueva Ruta o Gira
              </ThemedText>
            </TouchableOpacity>
          )}

          {/* Form Section */}
          {isCreating && renderForm(false)}
          {editingRecord && renderForm(true)}

          {/* List Section */}
          {!isCreating && !editingRecord && (
            <>
              {isLoading ? (
                <ThemedView style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#007AFF" />
                  <ThemedText style={styles.loadingText}>Cargando rutas y giras...</ThemedText>
                </ThemedView>
              ) : error ? (
                <ThemedView style={styles.errorContainer}>
                  <ThemedText style={styles.errorText}>{error}</ThemedText>
                </ThemedView>
              ) : routesAndTours.length === 0 ? (
                <ThemedView style={styles.emptyContainer}>
                  <ThemedText style={styles.emptyText}>No hay rutas o giras registradas</ThemedText>
                </ThemedView>
              ) : (
                <ThemedView style={styles.listContainer}>
                  {routesAndTours.map((record) => (
                    <ThemedView key={record.id || record.id_local} style={styles.recordCard}>
                      <TouchableOpacity
                        style={styles.recordHeader}
                        onPress={() => toggleExpand(record.id || record.id_local)}
                      >
                        <ThemedView style={styles.recordHeaderLeft}>
                          <ThemedText style={styles.recordTitle}>
                            {record.gira_ruta || 'Sin ruta'}
                          </ThemedText>
                          <ThemedText style={styles.recordSubtitle}>
                            {record.cliente || 'Sin cliente'}
                          </ThemedText>
                        </ThemedView>
                        <ThemedView style={styles.recordHeaderRight}>
                          {record.id_local && !record.synced && (
                            <ThemedText style={styles.offlineBadge}>Offline</ThemedText>
                          )}
                          <Ionicons
                            name={expandedRecordIds.includes(record.id || record.id_local) ? 'chevron-up' : 'chevron-down'}
                            size={24}
                            color="#007AFF"
                          />
                        </ThemedView>
                      </TouchableOpacity>

                      {expandedRecordIds.includes(record.id || record.id_local) && (
                        <ThemedView style={styles.recordDetails}>
                          <ThemedView style={styles.detailRow}>
                            <ThemedText style={styles.detailLabel}>Sociedad:</ThemedText>
                            <ThemedText style={styles.detailValue}>{record.sociedad || 'N/A'}</ThemedText>
                          </ThemedView>
                          <ThemedView style={styles.detailRow}>
                            <ThemedText style={styles.detailLabel}>Cliente:</ThemedText>
                            <ThemedText style={styles.detailValue}>{record.cliente || 'N/A'}</ThemedText>
                          </ThemedView>
                          <ThemedView style={styles.detailRow}>
                            <ThemedText style={styles.detailLabel}>Zona:</ThemedText>
                            <ThemedText style={styles.detailValue}>{record.zona || 'N/A'}</ThemedText>
                          </ThemedView>
                          <ThemedView style={styles.detailRow}>
                            <ThemedText style={styles.detailLabel}>Cantidad Personal:</ThemedText>
                            <ThemedText style={styles.detailValue}>{record.cantidad_personal || '0'}</ThemedText>
                          </ThemedView>
                          <ThemedView style={styles.detailRow}>
                            <ThemedText style={styles.detailLabel}>Gira o Ruta:</ThemedText>
                            <ThemedText style={styles.detailValue}>{record.gira_ruta || 'N/A'}</ThemedText>
                          </ThemedView>
                          <ThemedView style={styles.detailRow}>
                            <ThemedText style={styles.detailLabel}>Día Entrega:</ThemedText>
                            <ThemedText style={styles.detailValue}>{record.dia_entrega || 'N/A'}</ThemedText>
                          </ThemedView>
                          {record.estatus && (
                            <ThemedView style={styles.detailRow}>
                              <ThemedText style={styles.detailLabel}>Estatus:</ThemedText>
                              <ThemedText style={styles.detailValue}>{record.estatus}</ThemedText>
                            </ThemedView>
                          )}
                          {record.cumplimiento_supervision && (
                            <ThemedView style={styles.detailRow}>
                              <ThemedText style={styles.detailLabel}>Cumplimiento Supervisión:</ThemedText>
                              <ThemedText style={styles.detailValue}>{record.cumplimiento_supervision}</ThemedText>
                            </ThemedView>
                          )}
                          {record.cumplimiento_entrega_insumos && (
                            <ThemedView style={styles.detailRow}>
                              <ThemedText style={styles.detailLabel}>Cumplimiento Entrega Insumos:</ThemedText>
                              <ThemedText style={styles.detailValue}>{record.cumplimiento_entrega_insumos}</ThemedText>
                            </ThemedView>
                          )}
                          {record.estado && (
                            <ThemedView style={styles.detailRow}>
                              <ThemedText style={styles.detailLabel}>Estado:</ThemedText>
                              <ThemedText style={styles.detailValue}>{record.estado}</ThemedText>
                            </ThemedView>
                          )}
                          {record.nombre_persona_refuerzo && (
                            <ThemedView style={styles.detailRow}>
                              <ThemedText style={styles.detailLabel}>Nombre Persona Refuerzo:</ThemedText>
                              <ThemedText style={styles.detailValue}>{record.nombre_persona_refuerzo}</ThemedText>
                            </ThemedView>
                          )}
                          {record.notas_cambios && (
                            <ThemedView style={styles.detailRow}>
                              <ThemedText style={styles.detailLabel}>Notas o Cambios:</ThemedText>
                              <ThemedText style={styles.detailValue}>{record.notas_cambios}</ThemedText>
                            </ThemedView>
                          )}

                          <ThemedView style={styles.actionButtonsRow}>
                            <TouchableOpacity
                              style={[styles.actionButtonSmall, styles.editButton]}
                              onPress={() => startEditing(record)}
                            >
                              <ThemedText style={styles.actionButtonSmallText}>
                                {getActionIcon('edit')} Editar
                              </ThemedText>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.actionButtonSmall, styles.deleteButtonSmall]}
                              onPress={() => deleteRouteAndTourHandler(record)}
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
    backgroundColor: '#161719',
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
  recordCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recordHeaderLeft: {
    flex: 1,
  },
  recordHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  recordSubtitle: {
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
  recordDetails: {
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

