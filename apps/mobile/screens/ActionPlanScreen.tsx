import React, { useState, useCallback, useEffect } from 'react';
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
import { Picker } from '@react-native-picker/picker';
import {
  createActionPlan,
  updateActionPlan,
  deleteActionPlan,
  listActionPlanByCorpo,
} from '@/hooks/evaluationFunctions';
import { eventBus } from '@/hooks/eventBus';

type ActionPlanScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ActionPlan'>;

interface Tarea {
  responsable: string;
  tarea: string;
  fecha_entrega: string;
  status: string;
}

interface ActionPlan {
  id: string;
  id_local: string;
  nombre_lugar: string | null;
  fecha_inicio_operaciones: string | null;
  tareas: string | null; // JSON string of Tarea[]
  created_at: string;
  synced?: boolean;
}

interface EditingActionPlan {
  id: string | null;
  id_local: string;
  nombre_lugar: string;
  fecha_inicio_operaciones: string;
  tareas: Tarea[];
}

const RESPONSABLE_OPTIONS = [
  { label: 'Seleccionar responsable', value: '' },
  { label: 'GG - Gerente General', value: 'GG' },
  { label: 'GOAL - Gerente Operativo Aseo y Limpieza', value: 'GOAL' },
  { label: 'AYL - Cualquiera en el departamento de AYL designado por el GOAL', value: 'AYL' },
  { label: 'SEAL - Supervisor Externo Aseo y Limpieza', value: 'SEAL' },
  { label: 'AOAL - Asistente Operaciones Aseo y Limpieza', value: 'AOAL' },
  { label: 'PRV - Proveeduria', value: 'PRV' },
  { label: 'RRHH - Recursos Humanos', value: 'RRHH' },
];

const STATUS_OPTIONS = [
  { label: 'Seleccionar status', value: '' },
  { label: 'Entregado', value: 'Entregado' },
  { label: 'Pendiente', value: 'Pendiente' },
];

export default function ActionPlanScreen() {
  const { employee, refreshAccessToken, logout } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<ActionPlanScreenNavigationProp>();

  // Data states
  const [actionPlans, setActionPlans] = useState<ActionPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasCurrentMarca, setHasCurrentMarca] = useState<boolean>(false);

  // Editing state
  const [editingRecord, setEditingRecord] = useState<EditingActionPlan | null>(null);

  // Creating state
  const [isCreating, setIsCreating] = useState(false);

  // Form states
  const [nombreLugar, setNombreLugar] = useState('');
  const [fechaInicioOperaciones, setFechaInicioOperaciones] = useState('');
  const [tareas, setTareas] = useState<Tarea[]>([]);

  // Date picker states
  const [showDatePickerInicio, setShowDatePickerInicio] = useState(false);
  const [showDatePickerTarea, setShowDatePickerTarea] = useState<number | null>(null);
  const [expandedTareaIndices, setExpandedTareaIndices] = useState<number[]>([]);

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

  const handleDateChangeInicio = (event: any, selectedDate?: Date) => {
    setShowDatePickerInicio(Platform.OS === 'ios');
    if (selectedDate) {
      setFechaInicioOperaciones(formatDate(selectedDate));
    }
  };

  const fetchActionPlans = useCallback(async () => {
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
        const result = await listActionPlanByCorpo({
          corpo_id: corpoId,
          refreshAccessToken,
          logout,
        });

        if (result.status && result.data) {
          // Parse JSON strings back to arrays for display
          const parsedPlans = result.data.map((plan: any) => ({
            ...plan,
            tareas: plan.tareas ? JSON.parse(plan.tareas) : [],
          }));
          setActionPlans(parsedPlans as ActionPlan[]);
        } else {
          setActionPlans([]);
        }
      } else {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const plansCache = cache.filter((item: any) => item.type === 'action_plan');
          // Parse JSON strings back to arrays for display
          const parsedPlans = plansCache.map((plan: any) => ({
            ...plan,
            tareas: plan.tareas ? JSON.parse(plan.tareas) : [],
          }));
          setActionPlans(parsedPlans);
        } else {
          setActionPlans([]);
        }
      }
    } catch (err) {
      console.error('Error fetching action plans:', err);
      setError('Error al cargar los planes de acción');
      try {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const plansCache = cache.filter((item: any) => item.type === 'action_plan');
          const parsedPlans = plansCache.map((plan: any) => ({
            ...plan,
            tareas: plan.tareas ? JSON.parse(plan.tareas) : [],
          }));
          setActionPlans(parsedPlans);
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
      fetchActionPlans();
      eventBus.on('connectionRestored', fetchActionPlans);
      return () => {
        eventBus.off('connectionRestored', fetchActionPlans);
      };
    }, [fetchActionPlans])
  );

  const resetForm = () => {
    setNombreLugar('');
    setFechaInicioOperaciones('');
    setTareas([]);
    setExpandedTareaIndices([]);
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

  const startEditing = (record: ActionPlan) => {
    setIsCreating(false);
    const tareasArray = record.tareas ? JSON.parse(record.tareas) : [];
    setEditingRecord({
      id: record.id,
      id_local: record.id_local,
      nombre_lugar: record.nombre_lugar || '',
      fecha_inicio_operaciones: record.fecha_inicio_operaciones || '',
      tareas: tareasArray,
    });
    setNombreLugar(record.nombre_lugar || '');
    setFechaInicioOperaciones(record.fecha_inicio_operaciones || '');
    setTareas(tareasArray);
    setExpandedTareaIndices(tareasArray.map((_: any, index: number) => index));
  };

  const cancelEditing = () => {
    setEditingRecord(null);
    resetForm();
  };

  const saveActionPlanHandler = async () => {
    const currentMarca = await AsyncStorage.getItem('current_marca');
    if (!currentMarca) {
      Alert.alert('Error', 'No se encontró la marca actual');
      return;
    }

    const currentMarcaData = JSON.parse(currentMarca);

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas guardar este plan de acción?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const requestData = {
                marca_id: currentMarcaData.id,
                nombre_lugar: nombreLugar.trim() || null,
                fecha_inicio_operaciones: fechaInicioOperaciones.trim() || null,
                tareas: tareas.length > 0 ? JSON.stringify(tareas) : null,
              };

              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await createActionPlan({
                  requestData,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Plan de acción guardado correctamente');
                  cancelCreating();
                  fetchActionPlans();
                } else {
                  Alert.alert('Error', result.message || 'Error al guardar el plan de acción');
                }
              } else {
                const localId = generateRandomId();

                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: localId,
                  action: 'create',
                  type: 'action_plan',
                  payload: requestData,
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                const cache = cacheStr ? JSON.parse(cacheStr) : [];

                const newRecordCache: ActionPlan = {
                  id: '',
                  id_local: localId,
                  nombre_lugar: nombreLugar.trim() || null,
                  fecha_inicio_operaciones: fechaInicioOperaciones.trim() || null,
                  tareas: tareas.length > 0 ? JSON.stringify(tareas) : null,
                  created_at: new Date().toISOString(),
                  synced: false,
                };

                cache.push({ ...newRecordCache, type: 'action_plan' });
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(cache));

                Alert.alert('Modo Offline', 'Plan de acción registrado localmente. Se sincronizará cuando haya conexión.');
                cancelCreating();
                fetchActionPlans();
              }
            } catch (err) {
              console.error('Error saving action plan:', err);
              Alert.alert('Error', 'No se pudo guardar el plan de acción');
            }
          },
        },
      ]
    );
  };

  const updateActionPlanHandler = async () => {
    if (!editingRecord) return;

    const recordId = editingRecord.id || editingRecord.id_local;
    if (!recordId) {
      Alert.alert('Error', 'ID de registro no encontrado para actualizar');
      return;
    }

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas actualizar este plan de acción?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const requestData = {
                nombre_lugar: nombreLugar.trim() || null,
                fecha_inicio_operaciones: fechaInicioOperaciones.trim() || null,
                tareas: tareas.length > 0 ? JSON.stringify(tareas) : null,
              };

              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await updateActionPlan({
                  id: recordId,
                  requestData,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Plan de acción actualizado correctamente');
                  cancelEditing();
                  fetchActionPlans();
                } else {
                  Alert.alert('Error', result.message || 'Error al actualizar el plan de acción');
                }
              } else {
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: recordId,
                  action: 'update',
                  type: 'action_plan',
                  payload: requestData,
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                if (cacheStr) {
                  const cache = JSON.parse(cacheStr);
                  const updatedCache = cache.map((item: any) => {
                    if ((item.id === recordId || item.id_local === recordId) && item.type === 'action_plan') {
                      return {
                        ...item,
                        ...requestData,
                        tareas: tareas.length > 0 ? JSON.stringify(tareas) : null,
                        synced: false,
                      };
                    }
                    return item;
                  });
                  await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                }

                Alert.alert('Modo Offline', 'Plan de acción actualizado localmente. Se sincronizará cuando haya conexión.');
                cancelEditing();
                fetchActionPlans();
              }
            } catch (err) {
              console.error('Error updating action plan:', err);
              Alert.alert('Error', 'No se pudo actualizar el plan de acción');
            }
          },
        },
      ]
    );
  };

  const deleteActionPlanHandler = async (record: ActionPlan) => {
    const recordId = record.id || record.id_local;
    if (!recordId) {
      Alert.alert('Error', 'ID de registro no encontrado para eliminar');
      return;
    }

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas eliminar este plan de acción?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await deleteActionPlan({
                  id: recordId,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Plan de acción eliminado correctamente');
                  fetchActionPlans();
                } else {
                  Alert.alert('Error', result.message || 'Error al eliminar el plan de acción');
                }
              } else {
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: recordId,
                  action: 'delete',
                  type: 'action_plan',
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

                Alert.alert('Modo Offline', 'Plan de acción marcado para eliminación localmente. Se sincronizará cuando haya conexión.');
                fetchActionPlans();
              }
            } catch (err) {
              console.error('Error deleting action plan:', err);
              Alert.alert('Error', 'No se pudo eliminar el plan de acción');
            }
          },
        },
      ]
    );
  };

  const addTarea = () => {
    setTareas([...tareas, { responsable: '', tarea: '', fecha_entrega: '', status: '' }]);
    setExpandedTareaIndices([...expandedTareaIndices, tareas.length]);
  };

  const updateTarea = (index: number, field: keyof Tarea, value: string) => {
    const newTareas = [...tareas];
    newTareas[index][field] = value;
    setTareas(newTareas);
  };

  const removeTarea = (index: number) => {
    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas eliminar esta tarea?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            const newTareas = tareas.filter((_, i) => i !== index);
            setTareas(newTareas);
            setExpandedTareaIndices(expandedTareaIndices.filter(i => i !== index).map(i => i > index ? i - 1 : i));
          },
        },
      ]
    );
  };

  const toggleTareaExpansion = (index: number) => {
    setExpandedTareaIndices(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const handleDateChangeTarea = (index: number, event: any, selectedDate?: Date) => {
    setShowDatePickerTarea(Platform.OS === 'ios' ? index : null);
    if (selectedDate) {
      updateTarea(index, 'fecha_entrega', formatDate(selectedDate));
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

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'actionplan': return <Ionicons name="clipboard" size={24} color='#000000' />;
      case 'add': return <Ionicons name="add" size={24} color='#FFFFFF' />;
      case 'cancel': return <Ionicons name="close" size={24} color='#FFFFFF' />;
      case 'confirm': return <Ionicons name="checkmark" size={24} color='#FFFFFF' />;
      case 'delete': return <Ionicons name="trash" size={24} color='#FFFFFF' />;
      case 'edit': return <Ionicons name="pencil" size={20} color="#FFFFFF" />;
      default: return <Ionicons name="clipboard" size={24} color='#000000' />;
    }
  };

  const renderActionPlanList = () => {
    if (isLoading) {
      return (
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Cargando planes de acción...</ThemedText>
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

    if (actionPlans.length === 0) {
      return (
        <ThemedView style={styles.emptyContainer}>
          <ThemedText style={styles.emptyText}>No hay planes de acción registrados.</ThemedText>
        </ThemedView>
      );
    }

    return (
      <ThemedView style={styles.listContainer}>
        {actionPlans.map((record) => {
          const tareasArray = record.tareas ? JSON.parse(record.tareas) : [];
          return (
            <ThemedView key={record.id || record.id_local} style={styles.listItem}>
              <ThemedView style={styles.listItemHeader}>
                <ThemedView style={styles.listItemContent}>
                  <ThemedText style={styles.listItemTitle}>
                    {record.nombre_lugar || 'Sin nombre'}
                  </ThemedText>
                  <ThemedText style={styles.listItemSubtitle}>
                    Fecha inicio: {record.fecha_inicio_operaciones || 'No especificado'}
                  </ThemedText>
                  <ThemedText style={styles.listItemSubtitle}>
                    Tareas: {tareasArray.length}
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
                  <ThemedText style={styles.detailLabel}>Nombre del lugar: </ThemedText>
                  {record.nombre_lugar || 'No especificado'}
                </ThemedText>
                <ThemedText style={styles.detailText}>
                  <ThemedText style={styles.detailLabel}>Fecha inicio operaciones: </ThemedText>
                  {record.fecha_inicio_operaciones || 'No especificado'}
                </ThemedText>

                {tareasArray.length > 0 && (
                  <ThemedView style={styles.detailSection}>
                    <ThemedText style={styles.detailSectionTitle}>Tareas:</ThemedText>
                    {tareasArray.map((tarea: Tarea, index: number) => (
                      <ThemedView key={index} style={styles.tareaItemDisplay}>
                        <ThemedText style={styles.detailText}>
                          • <ThemedText style={styles.detailLabel}>Responsable: </ThemedText>
                          {tarea.responsable || 'N/A'}
                        </ThemedText>
                        <ThemedText style={styles.detailText}>
                          <ThemedText style={styles.detailLabel}>Tarea: </ThemedText>
                          {tarea.tarea || 'N/A'}
                        </ThemedText>
                        <ThemedText style={styles.detailText}>
                          <ThemedText style={styles.detailLabel}>Fecha entrega: </ThemedText>
                          {tarea.fecha_entrega || 'N/A'}
                        </ThemedText>
                        <ThemedText style={styles.detailText}>
                          <ThemedText style={styles.detailLabel}>Status: </ThemedText>
                          {tarea.status || 'N/A'}
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
                    onPress={() => deleteActionPlanHandler(record)}
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
      <AppHeader onMenuPress={handleMenuPress} title="Plan de Acción" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <ThemedView style={styles.contentContainer}>
          <ThemedText type="title" style={styles.screenTitle}>
            {getActionIcon('actionplan')} Plan de Acción
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
              {/* Nombre del lugar */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Nombre del lugar</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Nombre del lugar"
                  placeholderTextColor="#999"
                  value={nombreLugar}
                  onChangeText={setNombreLugar}
                  color="#000000"
                />
              </ThemedView>

              {/* Fecha de inicio de operaciones */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Fecha de inicio de operaciones</ThemedText>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowDatePickerInicio(true)}
                >
                  <ThemedText style={styles.dateButtonText}>
                    {fechaInicioOperaciones || 'Seleccionar fecha'}
                  </ThemedText>
                  <Ionicons name="calendar" size={20} color="#007AFF" />
                </TouchableOpacity>
                {showDatePickerInicio && (
                  <DateTimePicker
                    value={fechaInicioOperaciones ? new Date(fechaInicioOperaciones.split('/').reverse().join('-')) : new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleDateChangeInicio}
                  />
                )}
              </ThemedView>

              {/* Tareas Section */}
              <ThemedView style={styles.sectionContainer}>
                <ThemedText style={styles.sectionTitle}>Tareas</ThemedText>
                {tareas.map((tarea, index) => {
                  const isExpanded = expandedTareaIndices.includes(index);
                  return (
                    <ThemedView key={index} style={styles.tareaItem}>
                      <TouchableOpacity
                        style={styles.tareaHeader}
                        onPress={() => toggleTareaExpansion(index)}
                      >
                        <ThemedText style={styles.tareaHeaderText}>
                          Tarea {index + 1}
                        </ThemedText>
                        <Ionicons
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={20}
                          color="#000000"
                        />
                      </TouchableOpacity>

                      {isExpanded && (
                        <ThemedView style={styles.tareaContent}>
                          {/* Responsable */}
                          <ThemedView style={styles.formGroup}>
                            <ThemedText style={styles.formLabel}>Responsable</ThemedText>
                            <ThemedView style={styles.pickerContainer}>
                              <Picker
                                selectedValue={tarea.responsable}
                                onValueChange={(value: string) => updateTarea(index, 'responsable', value)}
                                style={styles.picker}
                              >
                                {RESPONSABLE_OPTIONS.map((option) => (
                                  <Picker.Item
                                    key={option.value}
                                    label={option.label}
                                    value={option.value}
                                  />
                                ))}
                              </Picker>
                            </ThemedView>
                          </ThemedView>

                          {/* Tarea */}
                          <ThemedView style={styles.formGroup}>
                            <ThemedText style={styles.formLabel}>Tarea</ThemedText>
                            <TextInput
                              style={[styles.formInput, styles.textArea]}
                              placeholder="Descripción de la tarea"
                              placeholderTextColor="#999"
                              multiline
                              numberOfLines={3}
                              textAlignVertical="top"
                              value={tarea.tarea}
                              onChangeText={(text) => updateTarea(index, 'tarea', text)}
                              color="#000000"
                            />
                          </ThemedView>

                          {/* Fecha de entrega */}
                          <ThemedView style={styles.formGroup}>
                            <ThemedText style={styles.formLabel}>Fecha de entrega</ThemedText>
                            <TouchableOpacity
                              style={styles.dateButton}
                              onPress={() => setShowDatePickerTarea(index)}
                            >
                              <ThemedText style={styles.dateButtonText}>
                                {tarea.fecha_entrega || 'Seleccionar fecha'}
                              </ThemedText>
                              <Ionicons name="calendar" size={20} color="#007AFF" />
                            </TouchableOpacity>
                            {showDatePickerTarea === index && (
                              <DateTimePicker
                                value={tarea.fecha_entrega ? new Date(tarea.fecha_entrega.split('/').reverse().join('-')) : new Date()}
                                mode="date"
                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                onChange={(event, date) => handleDateChangeTarea(index, event, date)}
                              />
                            )}
                          </ThemedView>

                          {/* Status */}
                          <ThemedView style={styles.formGroup}>
                            <ThemedText style={styles.formLabel}>Status</ThemedText>
                            <ThemedView style={styles.pickerContainer}>
                              <Picker
                                selectedValue={tarea.status}
                                onValueChange={(value: string) => updateTarea(index, 'status', value)}
                                style={styles.picker}
                              >
                                {STATUS_OPTIONS.map((option) => (
                                  <Picker.Item
                                    key={option.value}
                                    label={option.label}
                                    value={option.value}
                                  />
                                ))}
                              </Picker>
                            </ThemedView>
                          </ThemedView>

                          <TouchableOpacity
                            style={styles.removeTareaButton}
                            onPress={() => removeTarea(index)}
                          >
                            <Ionicons name="trash" size={20} color="#FF3B30" />
                            <ThemedText style={styles.removeTareaButtonText}>Eliminar Tarea</ThemedText>
                          </TouchableOpacity>
                        </ThemedView>
                      )}
                    </ThemedView>
                  );
                })}
                <TouchableOpacity style={styles.addButton} onPress={addTarea}>
                  <Ionicons name="add-circle" size={20} color="#4CAF50" />
                  <ThemedText style={styles.addButtonText}>Agregar Tarea</ThemedText>
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
                  onPress={editingRecord ? updateActionPlanHandler : saveActionPlanHandler}
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
                <ThemedText style={styles.createButtonText}>Crear Nuevo Plan de Acción</ThemedText>
              </TouchableOpacity>
              {renderActionPlanList()}
            </ThemedView>
          )}
        </ThemedView>
      </ScrollView>

      <AppFooter />
      <SlideMenu
        isVisible={isMenuVisible}
        onClose={handleMenuClose}
        onHomePress={handleHomePress}
        currentRoute="ActionPlan"
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
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
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
  tareaItem: {
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  tareaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F0F0F0',
  },
  tareaHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  tareaContent: {
    padding: 12,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    color: '#000000',
  },
  removeTareaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    gap: 8,
    marginTop: 10,
  },
  removeTareaButtonText: {
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
  tareaItemDisplay: {
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

