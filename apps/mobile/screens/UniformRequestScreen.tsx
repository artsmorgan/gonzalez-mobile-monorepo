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
import { createUniformRequest, updateUniformRequest, deleteUniformRequest, listUniformRequestsByCorpo } from '@/hooks/evaluationFunctions';
import { eventBus } from '@/hooks/eventBus';

type UniformRequestScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'UniformRequest'>;

interface UniformRequest {
  id: string;
  id_local: string;
  codigo: string | null;
  nombre_completo: string | null;
  cliente_area: string | null;
  ultima_fecha_uniformes: string | null;
  talla_scrub_naranja: string | null;
  talla_pantalon: string | null;
  talla_zapatos: string | null;
  estado: string | null;
  persona_designada_entrega: string | null;
  no_procede_hasta: string | null;
  estatus_designado_entrega: string | null;
  created_at: string;
  synced?: boolean;
}

interface EditingUniformRequest {
  id: string | null;
  id_local: string;
  codigo: string;
  nombre_completo: string;
  cliente_area: string;
  ultima_fecha_uniformes: string;
  talla_scrub_naranja: string;
  talla_pantalon: string;
  talla_zapatos: string;
  estado: string;
  persona_designada_entrega: string;
  no_procede_hasta: string;
  estatus_designado_entrega: string;
}

export default function UniformRequestScreen() {
  const { employee, refreshAccessToken, logout } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<UniformRequestScreenNavigationProp>();

  // Data states
  const [uniformRequests, setUniformRequests] = useState<UniformRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasCurrentMarca, setHasCurrentMarca] = useState<boolean>(false);

  // Editing state
  const [editingRequest, setEditingRequest] = useState<EditingUniformRequest | null>(null);

  // Creating state
  const [isCreating, setIsCreating] = useState(false);
  const [newRequest, setNewRequest] = useState<EditingUniformRequest>({
    id: null,
    id_local: '',
    codigo: '',
    nombre_completo: '',
    cliente_area: '',
    ultima_fecha_uniformes: '',
    talla_scrub_naranja: '',
    talla_pantalon: '',
    talla_zapatos: '',
    estado: '',
    persona_designada_entrega: '',
    no_procede_hasta: '',
    estatus_designado_entrega: '',
  });

  // Form states
  const [codigo, setCodigo] = useState('');
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [clienteArea, setClienteArea] = useState('');
  const [ultimaFechaUniformes, setUltimaFechaUniformes] = useState('');
  const [tallaScrubNaranja, setTallaScrubNaranja] = useState('');
  const [tallaPantalon, setTallaPantalon] = useState('');
  const [tallaZapatos, setTallaZapatos] = useState('');
  const [estado, setEstado] = useState('');
  const [personaDesignadaEntrega, setPersonaDesignadaEntrega] = useState('');
  const [noProcedeHasta, setNoProcedeHasta] = useState('');
  const [estatusDesignadoEntrega, setEstatusDesignadoEntrega] = useState('');

  // Date picker state
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Expanded details state
  const [expandedRequestIds, setExpandedRequestIds] = useState<string[]>([]);

  // Generate pantalon sizes (8 to 50, intervals of 2)
  const pantalonSizes = Array.from({ length: 22 }, (_, i) => (8 + i * 2).toString());
  
  // Generate zapatos sizes (35 to 47)
  const zapatosSizes = Array.from({ length: 13 }, (_, i) => (35 + i).toString());

  const getConnectionStatus = async (): Promise<boolean> => {
    const networkState = await Network.getNetworkStateAsync();
    return networkState.isConnected && networkState.isInternetReachable ? true : false;
  };

  const generateRandomId = (): string => {
    return `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  useFocusEffect(
    useCallback(() => {
      fetchUniformRequests();
    }, [])
  );

  useEffect(() => {
    const handler = () => {
      fetchUniformRequests();
    };

    eventBus.on('connectionRestored', handler);
    return () => {
      eventBus.off('connectionRestored', handler);
    };
  }, []);

  const fetchUniformRequests = async () => {
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
        const result = await listUniformRequestsByCorpo({
          corpo_id: corpoId,
          refreshAccessToken,
          logout,
        });

        if (result.status && result.data) {
          setUniformRequests(result.data);
          // Actualizar cache
          await AsyncStorage.setItem('evaluations_cache', JSON.stringify(
            result.data.map((item: any) => ({
              ...item,
              type: 'uniform_request',
              synced: true,
            }))
          ));
        } else {
          setError(result.message || 'Error al cargar las solicitudes');
        }
      } else {
        // Sin internet: cargar desde cache
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const uniformRequestsCache = cache.filter((item: any) => item.type === 'uniform_request');
          setUniformRequests(uniformRequestsCache);
        } else {
          setUniformRequests([]);
        }
      }
    } catch (err) {
      console.error('Error fetching uniform requests:', err);
      setError('Error al cargar las solicitudes');
      try {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const uniformRequestsCache = cache.filter((item: any) => item.type === 'uniform_request');
          setUniformRequests(uniformRequestsCache);
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
    setNewRequest({
      id: null,
      id_local: '',
      codigo: '',
      nombre_completo: '',
      cliente_area: '',
      ultima_fecha_uniformes: '',
      talla_scrub_naranja: '',
      talla_pantalon: '',
      talla_zapatos: '',
      estado: '',
      persona_designada_entrega: '',
      no_procede_hasta: '',
      estatus_designado_entrega: '',
    });
    setCodigo('');
    setNombreCompleto('');
    setClienteArea('');
    setUltimaFechaUniformes('');
    setTallaScrubNaranja('');
    setTallaPantalon('');
    setTallaZapatos('');
    setEstado('');
    setPersonaDesignadaEntrega('');
    setNoProcedeHasta('');
    setEstatusDesignadoEntrega('');
  };

  const cancelCreating = () => {
    setIsCreating(false);
    setNewRequest({
      id: null,
      id_local: '',
      codigo: '',
      nombre_completo: '',
      cliente_area: '',
      ultima_fecha_uniformes: '',
      talla_scrub_naranja: '',
      talla_pantalon: '',
      talla_zapatos: '',
      estado: '',
      persona_designada_entrega: '',
      no_procede_hasta: '',
      estatus_designado_entrega: '',
    });
  };

  const startEditing = (request: UniformRequest) => {
    setEditingRequest({
      id: request.id,
      id_local: request.id_local,
      codigo: request.codigo || '',
      nombre_completo: request.nombre_completo || '',
      cliente_area: request.cliente_area || '',
      ultima_fecha_uniformes: request.ultima_fecha_uniformes || '',
      talla_scrub_naranja: request.talla_scrub_naranja || '',
      talla_pantalon: request.talla_pantalon || '',
      talla_zapatos: request.talla_zapatos || '',
      estado: request.estado || '',
      persona_designada_entrega: request.persona_designada_entrega || '',
      no_procede_hasta: request.no_procede_hasta || '',
      estatus_designado_entrega: request.estatus_designado_entrega || '',
    });
    setCodigo(request.codigo || '');
    setNombreCompleto(request.nombre_completo || '');
    setClienteArea(request.cliente_area || '');
    setUltimaFechaUniformes(request.ultima_fecha_uniformes || '');
    setTallaScrubNaranja(request.talla_scrub_naranja || '');
    setTallaPantalon(request.talla_pantalon || '');
    setTallaZapatos(request.talla_zapatos || '');
    setEstado(request.estado || '');
    setPersonaDesignadaEntrega(request.persona_designada_entrega || '');
    setNoProcedeHasta(request.no_procede_hasta || '');
    setEstatusDesignadoEntrega(request.estatus_designado_entrega || '');
  };

  const cancelEditing = () => {
    setEditingRequest(null);
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setUltimaFechaUniformes(formatDate(selectedDate));
    }
  };

  const saveUniformRequest = async () => {
    if (!codigo.trim()) {
      Alert.alert('Error', 'El código es requerido');
      return;
    }
    if (!nombreCompleto.trim()) {
      Alert.alert('Error', 'El nombre completo es requerido');
      return;
    }
    if (!clienteArea.trim()) {
      Alert.alert('Error', 'El cliente y área es requerido');
      return;
    }
    if (!ultimaFechaUniformes.trim()) {
      Alert.alert('Error', 'La última fecha de uniformes es requerida');
      return;
    }
    if (!tallaScrubNaranja.trim()) {
      Alert.alert('Error', 'La talla del scrub naranja es requerida');
      return;
    }
    if (!tallaPantalon.trim()) {
      Alert.alert('Error', 'La talla del pantalón es requerida');
      return;
    }
    if (!tallaZapatos.trim()) {
      Alert.alert('Error', 'La talla de zapatos es requerida');
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
      '¿Estás seguro de que deseas guardar esta solicitud de uniforme?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const requestData = {
                marca_id: currentMarcaData.id,
                codigo: codigo.trim(),
                nombre_completo: nombreCompleto.trim(),
                cliente_area: clienteArea.trim(),
                ultima_fecha_uniformes: ultimaFechaUniformes.trim(),
                talla_scrub_naranja: tallaScrubNaranja.trim(),
                talla_pantalon: tallaPantalon.trim(),
                talla_zapatos: tallaZapatos.trim(),
                estado: estado.trim() || null,
                persona_designada_entrega: personaDesignadaEntrega.trim() || null,
                no_procede_hasta: noProcedeHasta.trim() || null,
                estatus_designado_entrega: estatusDesignadoEntrega.trim() || null,
              };

              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await createUniformRequest({
                  requestData,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Solicitud de uniforme guardada correctamente');
                  cancelCreating();
                  fetchUniformRequests();
                } else {
                  Alert.alert('Error', result.message || 'Error al guardar la solicitud de uniforme');
                }
              } else {
                const localId = generateRandomId();

                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: localId,
                  action: 'create',
                  type: 'uniform_request',
                  payload: requestData,
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                const cache = cacheStr ? JSON.parse(cacheStr) : [];

                const newRequestCache: UniformRequest = {
                  id: '',
                  id_local: localId,
                  codigo: codigo.trim(),
                  nombre_completo: nombreCompleto.trim(),
                  cliente_area: clienteArea.trim(),
                  ultima_fecha_uniformes: ultimaFechaUniformes.trim(),
                  talla_scrub_naranja: tallaScrubNaranja.trim(),
                  talla_pantalon: tallaPantalon.trim(),
                  talla_zapatos: tallaZapatos.trim(),
                  estado: estado.trim() || null,
                  persona_designada_entrega: personaDesignadaEntrega.trim() || null,
                  no_procede_hasta: noProcedeHasta.trim() || null,
                  estatus_designado_entrega: estatusDesignadoEntrega.trim() || null,
                  created_at: new Date().toISOString(),
                  synced: false,
                };

                cache.push({ ...newRequestCache, type: 'uniform_request' });
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(cache));

                Alert.alert('Modo Offline', 'Solicitud de uniforme registrada localmente. Se sincronizará cuando haya conexión.');
                cancelCreating();
                fetchUniformRequests();
              }
            } catch (err) {
              console.error('Error saving uniform request:', err);
              Alert.alert('Error', 'No se pudo guardar la solicitud de uniforme');
            }
          },
        },
      ]
    );
  };

  const updateUniformRequestHandler = async () => {
    if (!editingRequest) return;

    if (!codigo.trim()) {
      Alert.alert('Error', 'El código es requerido');
      return;
    }
    if (!nombreCompleto.trim()) {
      Alert.alert('Error', 'El nombre completo es requerido');
      return;
    }
    if (!clienteArea.trim()) {
      Alert.alert('Error', 'El cliente y área es requerido');
      return;
    }
    if (!ultimaFechaUniformes.trim()) {
      Alert.alert('Error', 'La última fecha de uniformes es requerida');
      return;
    }
    if (!tallaScrubNaranja.trim()) {
      Alert.alert('Error', 'La talla del scrub naranja es requerida');
      return;
    }
    if (!tallaPantalon.trim()) {
      Alert.alert('Error', 'La talla del pantalón es requerida');
      return;
    }
    if (!tallaZapatos.trim()) {
      Alert.alert('Error', 'La talla de zapatos es requerida');
      return;
    }

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas actualizar esta solicitud de uniforme?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const requestData = {
                codigo: codigo.trim(),
                nombre_completo: nombreCompleto.trim(),
                cliente_area: clienteArea.trim(),
                ultima_fecha_uniformes: ultimaFechaUniformes.trim(),
                talla_scrub_naranja: tallaScrubNaranja.trim(),
                talla_pantalon: tallaPantalon.trim(),
                talla_zapatos: tallaZapatos.trim(),
                estado: estado.trim() || null,
                persona_designada_entrega: personaDesignadaEntrega.trim() || null,
                no_procede_hasta: noProcedeHasta.trim() || null,
                estatus_designado_entrega: estatusDesignadoEntrega.trim() || null,
              };

              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await updateUniformRequest({
                  id: editingRequest.id!,
                  requestData,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Solicitud de uniforme actualizada correctamente');
                  cancelEditing();
                  fetchUniformRequests();
                } else {
                  Alert.alert('Error', result.message || 'Error al actualizar la solicitud de uniforme');
                }
              } else {
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];

                if (editingRequest.id_local) {
                  const createActionIndex = actions.findIndex(
                    (a: any) => a.id === editingRequest.id_local && a.action === 'create' && a.type === 'uniform_request'
                  );
                  if (createActionIndex !== -1) {
                    actions[createActionIndex].payload = { ...actions[createActionIndex].payload, ...requestData };
                  } else {
                    actions.push({
                      id: editingRequest.id,
                      action: 'update',
                      type: 'uniform_request',
                      payload: requestData,
                      synced: false,
                    });
                  }
                } else {
                  actions.push({
                    id: editingRequest.id,
                    action: 'update',
                    type: 'uniform_request',
                    payload: requestData,
                    synced: false,
                  });
                }

                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                if (cacheStr) {
                  const cache = JSON.parse(cacheStr);
                  const updatedCache = cache.map((item: any) => {
                    if ((item.id === editingRequest.id || item.id_local === editingRequest.id_local) && item.type === 'uniform_request') {
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

                Alert.alert('Modo Offline', 'Solicitud de uniforme actualizada localmente. Se sincronizará cuando haya conexión.');
                cancelEditing();
                fetchUniformRequests();
              }
            } catch (err) {
              console.error('Error updating uniform request:', err);
              Alert.alert('Error', 'No se pudo actualizar la solicitud de uniforme');
            }
          },
        },
      ]
    );
  };

  const deleteUniformRequestHandler = async (request: UniformRequest) => {
    Alert.alert(
      'Confirmar eliminación',
      '¿Estás seguro de que deseas eliminar esta solicitud de uniforme?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await deleteUniformRequest({
                  id: request.id,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Solicitud de uniforme eliminada correctamente');
                  fetchUniformRequests();
                } else {
                  Alert.alert('Error', result.message || 'Error al eliminar la solicitud de uniforme');
                }
              } else {
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];

                actions.push({
                  id: request.id || request.id_local,
                  action: 'delete',
                  type: 'uniform_request',
                  payload: { id: request.id },
                  synced: false,
                });

                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                if (cacheStr) {
                  const cache = JSON.parse(cacheStr);
                  const updatedCache = cache.filter(
                    (item: any) => !(item.id === request.id || item.id_local === request.id_local) || item.type !== 'uniform_request'
                  );
                  await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                }

                Alert.alert('Modo Offline', 'Solicitud de uniforme eliminada localmente. Se sincronizará cuando haya conexión.');
                fetchUniformRequests();
              }
            } catch (err) {
              console.error('Error deleting uniform request:', err);
              Alert.alert('Error', 'No se pudo eliminar la solicitud de uniforme');
            }
          },
        },
      ]
    );
  };

  const toggleExpand = (id: string) => {
    setExpandedRequestIds(prev =>
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
          {isEditing ? 'Editar Solicitud de Uniforme' : 'Nueva Solicitud de Uniforme'}
        </ThemedText>

        {/* Código */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Anote su Código (Ejemplo M5050) *</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="Ej: M5050"
            placeholderTextColor="#999"
            value={codigo}
            onChangeText={setCodigo}
          />
        </ThemedView>

        {/* Nombre Completo */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Nombre Completo (a como está en su cédula) *</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="Nombre completo"
            placeholderTextColor="#999"
            value={nombreCompleto}
            onChangeText={setNombreCompleto}
          />
        </ThemedView>

        {/* Cliente y Area */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Cliente y Area (Ejemplo: Ministerio de Hacienda 2x1, Llacuna, Mag Aserri) *</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="Cliente y área"
            placeholderTextColor="#999"
            value={clienteArea}
            onChangeText={setClienteArea}
          />
        </ThemedView>

        {/* Última Fecha Uniformes */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Anote la última fecha que recibió los últimos uniformes *</ThemedText>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowDatePicker(true)}
          >
            <ThemedText style={styles.dateButtonText}>
              {ultimaFechaUniformes || 'Seleccionar fecha'}
            </ThemedText>
            <Ionicons name="calendar" size={20} color="#007AFF" />
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={ultimaFechaUniformes ? new Date(ultimaFechaUniformes) : new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChange}
            />
          )}
        </ThemedView>

        {/* Talla Scrub Naranja */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Seleccione la talla del Scrub Naranja (Según la opción) *</ThemedText>
          <ThemedView style={styles.pickerContainer}>
            <Picker
              selectedValue={tallaScrubNaranja}
              onValueChange={setTallaScrubNaranja}
              style={styles.picker}
            >
              <Picker.Item label="Elige" value="" />
              <Picker.Item label="XS" value="XS" />
              <Picker.Item label="X" value="X" />
              <Picker.Item label="M" value="M" />
              <Picker.Item label="L" value="L" />
              <Picker.Item label="XL" value="XL" />
              <Picker.Item label="2XL" value="2XL" />
              <Picker.Item label="3XL" value="3XL" />
              <Picker.Item label="4XL" value="4XL" />
            </Picker>
          </ThemedView>
        </ThemedView>

        {/* Talla Pantalón */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Seleccione la talla del Pantalón (Según la opción) *</ThemedText>
          <ThemedView style={styles.pickerContainer}>
            <Picker
              selectedValue={tallaPantalon}
              onValueChange={setTallaPantalon}
              style={styles.picker}
            >
              <Picker.Item label="Elige" value="" />
              {pantalonSizes.map(size => (
                <Picker.Item key={size} label={size} value={size} />
              ))}
            </Picker>
          </ThemedView>
        </ThemedView>

        {/* Talla Zapatos */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Seleccione la talla de sus zapatos (Según la opción) *</ThemedText>
          <ThemedView style={styles.pickerContainer}>
            <Picker
              selectedValue={tallaZapatos}
              onValueChange={setTallaZapatos}
              style={styles.picker}
            >
              <Picker.Item label="Elige" value="" />
              {zapatosSizes.map(size => (
                <Picker.Item key={size} label={size} value={size} />
              ))}
            </Picker>
          </ThemedView>
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
              <Picker.Item label="Pendiente de entrega" value="Pendiente de entrega" />
              <Picker.Item label="Entregado" value="Entregado" />
              <Picker.Item label="Pedido a RRHH" value="Pedido a RRHH" />
              <Picker.Item label="No procede cambio" value="No procede cambio" />
            </Picker>
          </ThemedView>
        </ThemedView>

        {/* Persona Designada para la Entrega */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Persona Designada para la Entrega</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="Nombre de la persona"
            placeholderTextColor="#999"
            value={personaDesignadaEntrega}
            onChangeText={setPersonaDesignadaEntrega}
          />
        </ThemedView>

        {/* Si no procede hasta... */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Si no procede hasta...</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="Fecha o descripción"
            placeholderTextColor="#999"
            value={noProcedeHasta}
            onChangeText={setNoProcedeHasta}
          />
        </ThemedView>

        {/* Estatus Designado para Entrega */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Estatus Designado para Entrega</ThemedText>
          <ThemedView style={styles.pickerContainer}>
            <Picker
              selectedValue={estatusDesignadoEntrega}
              onValueChange={setEstatusDesignadoEntrega}
              style={styles.picker}
            >
              <Picker.Item label="Seleccionar" value="" />
              <Picker.Item label="Entrega en puesto" value="Entrega en puesto" />
              <Picker.Item label="Pendiente de entrega" value="Pendiente de entrega" />
              <Picker.Item label="Programado para gira" value="Programado para gira" />
              <Picker.Item label="No corresponde" value="No corresponde" />
              <Picker.Item label="Devolución por tallas" value="Devolución por tallas" />
            </Picker>
          </ThemedView>
        </ThemedView>

        {/* Action Buttons */}
        <ThemedView style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.saveButton]}
            onPress={isEditing ? updateUniformRequestHandler : saveUniformRequest}
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
        <AppHeader onMenuPress={() => setIsMenuVisible(true)} title="Solicitud Uniforme" />
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
      <AppHeader onMenuPress={() => setIsMenuVisible(true)} title="Solicitud Uniforme" />
      
      <ScrollView style={styles.scrollView}>
        <ThemedView style={styles.contentContainer}>
          {/* Module Title */}
          <ThemedView style={styles.titleContainer}>
            <ThemedText type="title" style={styles.title}>
              SOLICITUD UNIFORME
            </ThemedText>
          </ThemedView>

          {/* Create Button */}
          {!isCreating && !editingRequest && (
            <TouchableOpacity style={styles.createButton} onPress={startCreating}>
              <ThemedText style={styles.createButtonText}>
                {getActionIcon('add')} Nueva Solicitud
              </ThemedText>
            </TouchableOpacity>
          )}

          {/* Form Section */}
          {isCreating && renderForm(false)}
          {editingRequest && renderForm(true)}

          {/* List Section */}
          {!isCreating && !editingRequest && (
            <>
              {isLoading ? (
                <ThemedView style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#007AFF" />
                  <ThemedText style={styles.loadingText}>Cargando solicitudes...</ThemedText>
                </ThemedView>
              ) : error ? (
                <ThemedView style={styles.errorContainer}>
                  <ThemedText style={styles.errorText}>{error}</ThemedText>
                </ThemedView>
              ) : uniformRequests.length === 0 ? (
                <ThemedView style={styles.emptyContainer}>
                  <ThemedText style={styles.emptyText}>No hay solicitudes de uniforme registradas</ThemedText>
                </ThemedView>
              ) : (
                <ThemedView style={styles.listContainer}>
                  {uniformRequests.map((request) => (
                    <ThemedView key={request.id || request.id_local} style={styles.requestCard}>
                      <TouchableOpacity
                        style={styles.requestHeader}
                        onPress={() => toggleExpand(request.id || request.id_local)}
                      >
                        <ThemedView style={styles.requestHeaderLeft}>
                          <ThemedText style={styles.requestTitle}>
                            {request.codigo || 'Sin código'}
                          </ThemedText>
                          <ThemedText style={styles.requestSubtitle}>
                            {request.nombre_completo || 'Sin nombre'}
                          </ThemedText>
                        </ThemedView>
                        <ThemedView style={styles.requestHeaderRight}>
                          {request.id_local && !request.synced && (
                            <ThemedText style={styles.offlineBadge}>Offline</ThemedText>
                          )}
                          <Ionicons
                            name={expandedRequestIds.includes(request.id || request.id_local) ? 'chevron-up' : 'chevron-down'}
                            size={24}
                            color="#007AFF"
                          />
                        </ThemedView>
                      </TouchableOpacity>

                      {expandedRequestIds.includes(request.id || request.id_local) && (
                        <ThemedView style={styles.requestDetails}>
                          <ThemedView style={styles.detailRow}>
                            <ThemedText style={styles.detailLabel}>Código:</ThemedText>
                            <ThemedText style={styles.detailValue}>{request.codigo || 'N/A'}</ThemedText>
                          </ThemedView>
                          <ThemedView style={styles.detailRow}>
                            <ThemedText style={styles.detailLabel}>Nombre:</ThemedText>
                            <ThemedText style={styles.detailValue}>{request.nombre_completo || 'N/A'}</ThemedText>
                          </ThemedView>
                          <ThemedView style={styles.detailRow}>
                            <ThemedText style={styles.detailLabel}>Cliente y Área:</ThemedText>
                            <ThemedText style={styles.detailValue}>{request.cliente_area || 'N/A'}</ThemedText>
                          </ThemedView>
                          <ThemedView style={styles.detailRow}>
                            <ThemedText style={styles.detailLabel}>Última Fecha Uniformes:</ThemedText>
                            <ThemedText style={styles.detailValue}>{request.ultima_fecha_uniformes || 'N/A'}</ThemedText>
                          </ThemedView>
                          <ThemedView style={styles.detailRow}>
                            <ThemedText style={styles.detailLabel}>Talla Scrub Naranja:</ThemedText>
                            <ThemedText style={styles.detailValue}>{request.talla_scrub_naranja || 'N/A'}</ThemedText>
                          </ThemedView>
                          <ThemedView style={styles.detailRow}>
                            <ThemedText style={styles.detailLabel}>Talla Pantalón:</ThemedText>
                            <ThemedText style={styles.detailValue}>{request.talla_pantalon || 'N/A'}</ThemedText>
                          </ThemedView>
                          <ThemedView style={styles.detailRow}>
                            <ThemedText style={styles.detailLabel}>Talla Zapatos:</ThemedText>
                            <ThemedText style={styles.detailValue}>{request.talla_zapatos || 'N/A'}</ThemedText>
                          </ThemedView>
                          {request.estado && (
                            <ThemedView style={styles.detailRow}>
                              <ThemedText style={styles.detailLabel}>Estado:</ThemedText>
                              <ThemedText style={styles.detailValue}>{request.estado}</ThemedText>
                            </ThemedView>
                          )}
                          {request.persona_designada_entrega && (
                            <ThemedView style={styles.detailRow}>
                              <ThemedText style={styles.detailLabel}>Persona Designada:</ThemedText>
                              <ThemedText style={styles.detailValue}>{request.persona_designada_entrega}</ThemedText>
                            </ThemedView>
                          )}
                          {request.estatus_designado_entrega && (
                            <ThemedView style={styles.detailRow}>
                              <ThemedText style={styles.detailLabel}>Estatus Entrega:</ThemedText>
                              <ThemedText style={styles.detailValue}>{request.estatus_designado_entrega}</ThemedText>
                            </ThemedView>
                          )}

                          <ThemedView style={styles.actionButtonsRow}>
                            <TouchableOpacity
                              style={[styles.actionButtonSmall, styles.editButton]}
                              onPress={() => startEditing(request)}
                            >
                              <ThemedText style={styles.actionButtonSmallText}>
                                {getActionIcon('edit')} Editar
                              </ThemedText>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.actionButtonSmall, styles.deleteButtonSmall]}
                              onPress={() => deleteUniformRequestHandler(request)}
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
  requestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  requestHeaderLeft: {
    flex: 1,
  },
  requestHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  requestTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  requestSubtitle: {
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
  requestDetails: {
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

