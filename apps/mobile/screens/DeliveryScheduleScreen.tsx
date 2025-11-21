import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
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
import Ionicons from '@expo/vector-icons/build/Ionicons';
import * as Network from 'expo-network';
import {
  createDeliverySchedule,
  updateDeliverySchedule,
  deleteDeliverySchedule,
  listDeliveryScheduleByCorpo,
} from '@/hooks/evaluationFunctions';
import { eventBus } from '@/hooks/eventBus';

type DeliveryScheduleScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'DeliverySchedule'>;

interface EquipoSolicitado {
  equipo_solicitado: string;
  medida: string;
  cantidad: string;
  puesto: string;
}

interface DeliverySchedule {
  id: string;
  id_local: string;
  contrato: string | null;
  region: string | null;
  puesto: string | null;
  fecha_apertura_entrega: string | null;
  responsable_apertura_entrega: string | null;
  equipos_solicitados: string | null; // JSON string of EquipoSolicitado[]
  created_at: string;
  synced?: boolean;
}

interface EditingDeliverySchedule {
  id: string | null;
  id_local: string;
  contrato: string;
  region: string;
  puesto: string;
  fecha_apertura_entrega: string;
  responsable_apertura_entrega: string;
  equipos_solicitados: EquipoSolicitado[];
}

export default function DeliveryScheduleScreen() {
  const { employee, refreshAccessToken, logout } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<DeliveryScheduleScreenNavigationProp>();

  // Data states
  const [schedules, setSchedules] = useState<DeliverySchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasCurrentMarca, setHasCurrentMarca] = useState<boolean>(false);

  // Editing state
  const [editingRecord, setEditingRecord] = useState<EditingDeliverySchedule | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form states
  const [contrato, setContrato] = useState('');
  const [region, setRegion] = useState('');
  const [puesto, setPuesto] = useState('');
  const [fechaAperturaEntrega, setFechaAperturaEntrega] = useState('');
  const [responsableAperturaEntrega, setResponsableAperturaEntrega] = useState('');
  const [equiposSolicitados, setEquiposSolicitados] = useState<EquipoSolicitado[]>([]);

  // Expanded states
  const [expandedEquipos, setExpandedEquipos] = useState<number[]>([]);

  // Date picker state
  const [showDatePicker, setShowDatePicker] = useState(false);

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

  const fetchSchedules = useCallback(async () => {
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
        const result = await listDeliveryScheduleByCorpo({
          corpo_id: corpoId,
          refreshAccessToken,
          logout,
        });

        if (result.status && result.data) {
          setSchedules(result.data as DeliverySchedule[]);
        } else {
          setSchedules([]);
        }
      } else {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const schedulesCache = cache.filter((item: any) => item.type === 'delivery_schedule');
          setSchedules(schedulesCache);
        } else {
          setSchedules([]);
        }
      }
    } catch (err) {
      console.error('Error fetching schedules:', err);
      setError('Error al cargar los cronogramas de entrega');
      try {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const schedulesCache = cache.filter((item: any) => item.type === 'delivery_schedule');
          setSchedules(schedulesCache);
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
      fetchSchedules();
      eventBus.on('connectionRestored', fetchSchedules);
      return () => {
        eventBus.off('connectionRestored', fetchSchedules);
      };
    }, [fetchSchedules])
  );

  const resetForm = () => {
    setContrato('');
    setRegion('');
    setPuesto('');
    setFechaAperturaEntrega('');
    setResponsableAperturaEntrega('');
    setEquiposSolicitados([]);
    setExpandedEquipos([]);
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

  const startEditing = (record: DeliverySchedule) => {
    setIsCreating(false);
    let equiposEdit: EquipoSolicitado[] = [];

    if (record.equipos_solicitados) {
      try {
        equiposEdit = JSON.parse(record.equipos_solicitados);
        if (!Array.isArray(equiposEdit)) equiposEdit = [];
      } catch (e) {
        equiposEdit = [];
      }
    }

    setEditingRecord({
      id: record.id,
      id_local: record.id_local,
      contrato: record.contrato || '',
      region: record.region || '',
      puesto: record.puesto || '',
      fecha_apertura_entrega: record.fecha_apertura_entrega || '',
      responsable_apertura_entrega: record.responsable_apertura_entrega || '',
      equipos_solicitados: equiposEdit,
    });

    setContrato(record.contrato || '');
    setRegion(record.region || '');
    setPuesto(record.puesto || '');
    setFechaAperturaEntrega(record.fecha_apertura_entrega || '');
    setResponsableAperturaEntrega(record.responsable_apertura_entrega || '');
    setEquiposSolicitados(equiposEdit);
    setExpandedEquipos(equiposEdit.map((_, i) => i));
  };

  const cancelEditing = () => {
    setEditingRecord(null);
    resetForm();
  };

  // Equipos functions
  const addEquipo = () => {
    setEquiposSolicitados([...equiposSolicitados, { equipo_solicitado: '', medida: '', cantidad: '', puesto: '' }]);
    setExpandedEquipos([...expandedEquipos, equiposSolicitados.length]);
  };

  const updateEquipo = (index: number, field: keyof EquipoSolicitado, value: string) => {
    const newEquipos = [...equiposSolicitados];
    newEquipos[index][field] = value;
    setEquiposSolicitados(newEquipos);
  };

  const removeEquipo = (index: number) => {
    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas eliminar este equipo?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            setEquiposSolicitados(equiposSolicitados.filter((_, i) => i !== index));
            setExpandedEquipos(expandedEquipos.filter(i => i !== index).map(i => i > index ? i - 1 : i));
          },
        },
      ]
    );
  };

  const toggleEquipoExpansion = (index: number) => {
    setExpandedEquipos(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setFechaAperturaEntrega(formatDate(selectedDate));
    }
  };

  const saveScheduleHandler = async () => {
    const currentMarca = await AsyncStorage.getItem('current_marca');
    if (!currentMarca) {
      Alert.alert('Error', 'No se encontró la marca actual');
      return;
    }

    const currentMarcaData = JSON.parse(currentMarca);

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas guardar este cronograma de entrega?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const requestData = {
                marca_id: currentMarcaData.id,
                contrato: contrato.trim() || null,
                region: region.trim() || null,
                puesto: puesto.trim() || null,
                fecha_apertura_entrega: fechaAperturaEntrega.trim() || null,
                responsable_apertura_entrega: responsableAperturaEntrega.trim() || null,
                equipos_solicitados: equiposSolicitados.length > 0 ? JSON.stringify(equiposSolicitados) : null,
              };

              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await createDeliverySchedule({
                  requestData,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Cronograma de entrega guardado correctamente');
                  cancelCreating();
                  fetchSchedules();
                } else {
                  Alert.alert('Error', result.message || 'Error al guardar el cronograma de entrega');
                }
              } else {
                const localId = generateRandomId();

                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: localId,
                  action: 'create',
                  type: 'delivery_schedule',
                  payload: requestData,
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                const cache = cacheStr ? JSON.parse(cacheStr) : [];

                const newRecordCache: DeliverySchedule = {
                  id: '',
                  id_local: localId,
                  contrato: contrato.trim() || null,
                  region: region.trim() || null,
                  puesto: puesto.trim() || null,
                  fecha_apertura_entrega: fechaAperturaEntrega.trim() || null,
                  responsable_apertura_entrega: responsableAperturaEntrega.trim() || null,
                  equipos_solicitados: equiposSolicitados.length > 0 ? JSON.stringify(equiposSolicitados) : null,
                  created_at: new Date().toISOString(),
                  synced: false,
                };

                cache.push({ ...newRecordCache, type: 'delivery_schedule' });
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(cache));

                Alert.alert('Modo Offline', 'Cronograma de entrega registrado localmente. Se sincronizará cuando haya conexión.');
                cancelCreating();
                fetchSchedules();
              }
            } catch (err) {
              console.error('Error saving schedule:', err);
              Alert.alert('Error', 'No se pudo guardar el cronograma de entrega');
            }
          },
        },
      ]
    );
  };

  const updateScheduleHandler = async () => {
    if (!editingRecord) return;

    const recordId = editingRecord.id || editingRecord.id_local;
    if (!recordId) {
      Alert.alert('Error', 'ID de registro no encontrado para actualizar');
      return;
    }

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas actualizar este cronograma de entrega?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const requestData = {
                contrato: contrato.trim() || null,
                region: region.trim() || null,
                puesto: puesto.trim() || null,
                fecha_apertura_entrega: fechaAperturaEntrega.trim() || null,
                responsable_apertura_entrega: responsableAperturaEntrega.trim() || null,
                equipos_solicitados: equiposSolicitados.length > 0 ? JSON.stringify(equiposSolicitados) : null,
              };

              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await updateDeliverySchedule({
                  id: recordId,
                  requestData,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Cronograma de entrega actualizado correctamente');
                  cancelEditing();
                  fetchSchedules();
                } else {
                  Alert.alert('Error', result.message || 'Error al actualizar el cronograma de entrega');
                }
              } else {
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: recordId,
                  action: 'update',
                  type: 'delivery_schedule',
                  payload: requestData,
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                if (cacheStr) {
                  const cache = JSON.parse(cacheStr);
                  const updatedCache = cache.map((item: any) => {
                    if ((item.id === recordId || item.id_local === recordId) && item.type === 'delivery_schedule') {
                      return {
                        ...item,
                        ...requestData,
                        equipos_solicitados: equiposSolicitados.length > 0 ? JSON.stringify(equiposSolicitados) : null,
                        synced: false,
                      };
                    }
                    return item;
                  });
                  await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                }

                Alert.alert('Modo Offline', 'Cronograma de entrega actualizado localmente. Se sincronizará cuando haya conexión.');
                cancelEditing();
                fetchSchedules();
              }
            } catch (err) {
              console.error('Error updating schedule:', err);
              Alert.alert('Error', 'No se pudo actualizar el cronograma de entrega');
            }
          },
        },
      ]
    );
  };

  const deleteScheduleHandler = async (record: DeliverySchedule) => {
    const recordId = record.id || record.id_local;
    if (!recordId) {
      Alert.alert('Error', 'ID de registro no encontrado para eliminar');
      return;
    }

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas eliminar este cronograma de entrega?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await deleteDeliverySchedule({
                  id: recordId,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Cronograma de entrega eliminado correctamente');
                  fetchSchedules();
                } else {
                  Alert.alert('Error', result.message || 'Error al eliminar el cronograma de entrega');
                }
              } else {
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: recordId,
                  action: 'delete',
                  type: 'delivery_schedule',
                  payload: {},
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                if (cacheStr) {
                  const cache = JSON.parse(cacheStr);
                  const updatedCache = cache.filter((item: any) => !(item.id === recordId || item.id_local === recordId));
                  await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                }

                Alert.alert('Modo Offline', 'Cronograma de entrega marcado para eliminación localmente. Se sincronizará cuando haya conexión.');
                fetchSchedules();
              }
            } catch (err) {
              console.error('Error deleting schedule:', err);
              Alert.alert('Error', 'No se pudo eliminar el cronograma de entrega');
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
      case 'schedule': return <Ionicons name="calendar" size={24} color='#000000' />;
      case 'add': return <Ionicons name="add" size={24} color='#FFFFFF' />;
      case 'cancel': return <Ionicons name="close" size={24} color='#FFFFFF' />;
      case 'confirm': return <Ionicons name="checkmark" size={24} color='#FFFFFF' />;
      case 'delete': return <Ionicons name="trash" size={24} color='#FFFFFF' />;
      case 'edit': return <Ionicons name="pencil" size={20} color="#FFFFFF" />;
      default: return <Ionicons name="calendar" size={24} color='#000000' />;
    }
  };

  const renderScheduleList = () => {
    if (isLoading) {
      return (
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Cargando cronogramas de entrega...</ThemedText>
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

    if (schedules.length === 0) {
      return (
        <ThemedView style={styles.emptyContainer}>
          <ThemedText style={styles.emptyText}>No hay cronogramas de entrega registrados.</ThemedText>
        </ThemedView>
      );
    }

    return (
      <ThemedView style={styles.listContainer}>
        {schedules.map((record) => {
          let equiposData: EquipoSolicitado[] = [];

          if (record.equipos_solicitados) {
            try {
              equiposData = JSON.parse(record.equipos_solicitados);
            } catch (e) {
              equiposData = [];
            }
          }

          return (
            <ThemedView key={record.id || record.id_local} style={styles.listItem}>
              <ThemedView style={styles.listItemHeader}>
                <ThemedView style={styles.listItemContent}>
                  <ThemedText style={styles.listItemTitle}>
                    {record.contrato || 'Sin contrato'}
                  </ThemedText>
                  <ThemedText style={styles.listItemSubtitle}>
                    Región: {record.region || 'N/A'} | Puesto: {record.puesto || 'N/A'}
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
                <ThemedText style={styles.detailText}>
                  <ThemedText style={styles.detailLabel}>Contrato: </ThemedText>
                  {record.contrato || 'No especificado'}
                </ThemedText>
                <ThemedText style={styles.detailText}>
                  <ThemedText style={styles.detailLabel}>Región: </ThemedText>
                  {record.region || 'No especificado'}
                </ThemedText>
                <ThemedText style={styles.detailText}>
                  <ThemedText style={styles.detailLabel}>Puesto: </ThemedText>
                  {record.puesto || 'No especificado'}
                </ThemedText>
                <ThemedText style={styles.detailText}>
                  <ThemedText style={styles.detailLabel}>Fecha de apertura o entrega: </ThemedText>
                  {record.fecha_apertura_entrega || 'No especificado'}
                </ThemedText>
                <ThemedText style={styles.detailText}>
                  <ThemedText style={styles.detailLabel}>Responsable de apertura o entrega: </ThemedText>
                  {record.responsable_apertura_entrega || 'No especificado'}
                </ThemedText>

                {equiposData.length > 0 && (
                  <ThemedView style={styles.detailSection}>
                    <ThemedText style={styles.detailSectionTitle}>Equipos Solicitados:</ThemedText>
                    {equiposData.map((item, index) => (
                      <ThemedView key={index} style={styles.detailItem}>
                        <ThemedText style={styles.detailText}>
                          • <ThemedText style={styles.detailLabel}>Equipo: </ThemedText>
                          {item.equipo_solicitado || 'N/A'}
                        </ThemedText>
                        <ThemedText style={styles.detailText}>
                          <ThemedText style={styles.detailLabel}>Medida: </ThemedText>
                          {item.medida || 'N/A'}
                        </ThemedText>
                        <ThemedText style={styles.detailText}>
                          <ThemedText style={styles.detailLabel}>Cantidad: </ThemedText>
                          {item.cantidad || 'N/A'}
                        </ThemedText>
                        <ThemedText style={styles.detailText}>
                          <ThemedText style={styles.detailLabel}>Puesto: </ThemedText>
                          {item.puesto || 'N/A'}
                        </ThemedText>
                      </ThemedView>
                    ))}
                  </ThemedView>
                )}

                <ThemedText style={styles.detailText}>
                  <ThemedText style={styles.detailLabel}>Fecha de registro: </ThemedText>
                  {new Date(record.created_at).toLocaleDateString('es-CR')}
                </ThemedText>

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
                    onPress={() => deleteScheduleHandler(record)}
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

  return (
    <ThemedView style={styles.container}>
      <AppHeader onMenuPress={handleMenuPress} title="Cronograma de Entrega" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <ThemedView style={styles.contentContainer}>
          <ThemedText type="title" style={styles.screenTitle}>
            {getActionIcon('schedule')} Cronograma de Entrega de Materiales y Equipos
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
              {/* Contrato */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Contrato</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Contrato"
                  placeholderTextColor="#999"
                  value={contrato}
                  onChangeText={setContrato}
                  color="#000000"
                />
              </ThemedView>

              {/* Región */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Región</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Región"
                  placeholderTextColor="#999"
                  value={region}
                  onChangeText={setRegion}
                  color="#000000"
                />
              </ThemedView>

              {/* Puesto */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Puesto</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Puesto"
                  placeholderTextColor="#999"
                  value={puesto}
                  onChangeText={setPuesto}
                  color="#000000"
                />
              </ThemedView>

              {/* Fecha de apertura o entrega */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Fecha de apertura o entrega</ThemedText>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <ThemedText style={styles.dateButtonText}>
                    {fechaAperturaEntrega || 'Seleccionar fecha'}
                  </ThemedText>
                  <Ionicons name="calendar" size={20} color="#007AFF" />
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={fechaAperturaEntrega ? new Date(fechaAperturaEntrega.split('/').reverse().join('-')) : new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleDateChange}
                  />
                )}
              </ThemedView>

              {/* Responsable de Apertura o Entrega */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Responsable de Apertura o Entrega</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Responsable de Apertura o Entrega"
                  placeholderTextColor="#999"
                  value={responsableAperturaEntrega}
                  onChangeText={setResponsableAperturaEntrega}
                  color="#000000"
                />
              </ThemedView>

              {/* Equipos Solicitados Section */}
              <ThemedView style={styles.sectionContainer}>
                <ThemedText style={styles.sectionTitle}>Equipos Solicitados</ThemedText>
                {equiposSolicitados.map((item, index) => {
                  const isExpanded = expandedEquipos.includes(index);
                  return (
                    <ThemedView key={index} style={styles.expandableItem}>
                      <TouchableOpacity
                        style={styles.expandableHeader}
                        onPress={() => toggleEquipoExpansion(index)}
                      >
                        <ThemedText style={styles.expandableHeaderText}>
                          Equipo {index + 1}
                        </ThemedText>
                        <Ionicons
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={20}
                          color="#000000"
                        />
                      </TouchableOpacity>

                      {isExpanded && (
                        <ThemedView style={styles.expandableContent}>
                          {/* Equipo solicitado */}
                          <ThemedView style={styles.formGroup}>
                            <ThemedText style={styles.formLabel}>Equipo solicitado</ThemedText>
                            <TextInput
                              style={styles.formInput}
                              placeholder="Equipo solicitado"
                              placeholderTextColor="#999"
                              value={item.equipo_solicitado}
                              onChangeText={(text) => updateEquipo(index, 'equipo_solicitado', text)}
                              color="#000000"
                            />
                          </ThemedView>

                          {/* Medida */}
                          <ThemedView style={styles.formGroup}>
                            <ThemedText style={styles.formLabel}>Medida</ThemedText>
                            <TextInput
                              style={styles.formInput}
                              placeholder="Medida"
                              placeholderTextColor="#999"
                              value={item.medida}
                              onChangeText={(text) => updateEquipo(index, 'medida', text)}
                              color="#000000"
                            />
                          </ThemedView>

                          {/* Cantidad */}
                          <ThemedView style={styles.formGroup}>
                            <ThemedText style={styles.formLabel}>Cantidad</ThemedText>
                            <TextInput
                              style={styles.formInput}
                              placeholder="Cantidad"
                              placeholderTextColor="#999"
                              value={item.cantidad}
                              onChangeText={(text) => updateEquipo(index, 'cantidad', text)}
                              keyboardType="numeric"
                              color="#000000"
                            />
                          </ThemedView>

                          {/* Puesto */}
                          <ThemedView style={styles.formGroup}>
                            <ThemedText style={styles.formLabel}>Puesto</ThemedText>
                            <TextInput
                              style={styles.formInput}
                              placeholder="Puesto"
                              placeholderTextColor="#999"
                              value={item.puesto}
                              onChangeText={(text) => updateEquipo(index, 'puesto', text)}
                              color="#000000"
                            />
                          </ThemedView>

                          <TouchableOpacity
                            style={styles.removeButton}
                            onPress={() => removeEquipo(index)}
                          >
                            <Ionicons name="trash" size={20} color="#FF3B30" />
                            <ThemedText style={styles.removeButtonText}>Eliminar</ThemedText>
                          </TouchableOpacity>
                        </ThemedView>
                      )}
                    </ThemedView>
                  );
                })}
                <TouchableOpacity style={styles.addButton} onPress={addEquipo}>
                  <Ionicons name="add-circle" size={20} color="#4CAF50" />
                  <ThemedText style={styles.addButtonText}>Agregar Equipo</ThemedText>
                </TouchableOpacity>
              </ThemedView>

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
                  onPress={editingRecord ? updateScheduleHandler : saveScheduleHandler}
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
                <ThemedText style={styles.createButtonText}>Crear Nuevo Cronograma de Entrega</ThemedText>
              </TouchableOpacity>
              {renderScheduleList()}
            </ThemedView>
          )}
        </ThemedView>
      </ScrollView>

      <AppFooter />
      <SlideMenu
        isVisible={isMenuVisible}
        onClose={handleMenuClose}
        onHomePress={handleHomePress}
        currentRoute="DeliverySchedule"
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
  sectionContainer: {
    marginTop: 20,
    marginBottom: 15,
    padding: 15,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#000000',
  },
  expandableItem: {
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  expandableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F0F0F0',
  },
  expandableHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  expandableContent: {
    padding: 12,
  },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    gap: 8,
    marginTop: 10,
  },
  removeButtonText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '600',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    gap: 8,
    marginTop: 8,
  },
  addButtonText: {
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
  detailText: {
    fontSize: 14,
    color: '#000000',
    marginBottom: 8,
  },
  detailLabel: {
    fontWeight: '600',
  },
  detailSection: {
    marginTop: 10,
    marginBottom: 10,
    padding: 10,
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
  },
  detailSectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000000',
  },
  detailItem: {
    marginBottom: 10,
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  listItemButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
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
    color: '#D32F2F',
    textAlign: 'center',
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 20,
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
    fontSize: 16,
  },
});

