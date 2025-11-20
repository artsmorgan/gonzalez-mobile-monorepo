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
  createSpecialSituationsPlan,
  updateSpecialSituationsPlan,
  deleteSpecialSituationsPlan,
  listSpecialSituationsPlanByCorpo,
} from '@/hooks/evaluationFunctions';
import { eventBus } from '@/hooks/eventBus';

type SpecialSituationsPlanScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'SpecialSituationsPlan'>;

interface Situacion {
  situacion: string;
  accion_seguir: string;
  fecha_emergencia: string;
}

interface SpecialSituationsPlan {
  id: string;
  id_local: string;
  edificio: string | null;
  supervisor: string | null;
  situaciones: string | null; // JSON string of Situacion[]
  created_at: string;
  synced?: boolean;
}

interface EditingSpecialSituationsPlan {
  id: string | null;
  id_local: string;
  edificio: string;
  supervisor: string;
  situaciones: Situacion[];
}

export default function SpecialSituationsPlanScreen() {
  const { employee, refreshAccessToken, logout } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<SpecialSituationsPlanScreenNavigationProp>();

  // Data states
  const [plans, setPlans] = useState<SpecialSituationsPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasCurrentMarca, setHasCurrentMarca] = useState<boolean>(false);

  // Editing state
  const [editingRecord, setEditingRecord] = useState<EditingSpecialSituationsPlan | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form states
  const [edificio, setEdificio] = useState('');
  const [supervisor, setSupervisor] = useState('');
  const [situaciones, setSituaciones] = useState<Situacion[]>([]);

  // Expanded states
  const [expandedSituaciones, setExpandedSituaciones] = useState<number[]>([]);

  // Date picker states
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerIndex, setDatePickerIndex] = useState<number | null>(null);

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

  const fetchPlans = useCallback(async () => {
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
        const result = await listSpecialSituationsPlanByCorpo({
          corpo_id: corpoId,
          refreshAccessToken,
          logout,
        });

        if (result.status && result.data) {
          setPlans(result.data as SpecialSituationsPlan[]);
        } else {
          setPlans([]);
        }
      } else {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const plansCache = cache.filter((item: any) => item.type === 'special_situations_plan');
          setPlans(plansCache);
        } else {
          setPlans([]);
        }
      }
    } catch (err) {
      console.error('Error fetching plans:', err);
      setError('Error al cargar los planes para la atención de situaciones especiales');
      try {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const plansCache = cache.filter((item: any) => item.type === 'special_situations_plan');
          setPlans(plansCache);
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
      fetchPlans();
      eventBus.on('connectionRestored', fetchPlans);
      return () => {
        eventBus.off('connectionRestored', fetchPlans);
      };
    }, [fetchPlans])
  );

  const resetForm = () => {
    setEdificio('');
    setSupervisor('');
    setSituaciones([]);
    setExpandedSituaciones([]);
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

  const startEditing = (record: SpecialSituationsPlan) => {
    setIsCreating(false);
    let situacionesEdit: Situacion[] = [];

    if (record.situaciones) {
      try {
        situacionesEdit = JSON.parse(record.situaciones);
        if (!Array.isArray(situacionesEdit)) situacionesEdit = [];
      } catch (e) {
        situacionesEdit = [];
      }
    }

    setEditingRecord({
      id: record.id,
      id_local: record.id_local,
      edificio: record.edificio || '',
      supervisor: record.supervisor || '',
      situaciones: situacionesEdit,
    });

    setEdificio(record.edificio || '');
    setSupervisor(record.supervisor || '');
    setSituaciones(situacionesEdit);
    setExpandedSituaciones(situacionesEdit.map((_, i) => i));
  };

  const cancelEditing = () => {
    setEditingRecord(null);
    resetForm();
  };

  // Situaciones functions
  const addSituacion = () => {
    setSituaciones([...situaciones, { situacion: '', accion_seguir: '', fecha_emergencia: '' }]);
    setExpandedSituaciones([...expandedSituaciones, situaciones.length]);
  };

  const updateSituacion = (index: number, field: keyof Situacion, value: string) => {
    const newSituaciones = [...situaciones];
    newSituaciones[index][field] = value;
    setSituaciones(newSituaciones);
  };

  const removeSituacion = (index: number) => {
    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas eliminar esta situación?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            setSituaciones(situaciones.filter((_, i) => i !== index));
            setExpandedSituaciones(expandedSituaciones.filter(i => i !== index).map(i => i > index ? i - 1 : i));
          },
        },
      ]
    );
  };

  const toggleSituacionExpansion = (index: number) => {
    setExpandedSituaciones(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const handleDateChange = (event: any, selectedDate?: Date, index?: number) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate && index !== undefined) {
      updateSituacion(index, 'fecha_emergencia', formatDate(selectedDate));
    }
  };

  const savePlanHandler = async () => {
    const currentMarca = await AsyncStorage.getItem('current_marca');
    if (!currentMarca) {
      Alert.alert('Error', 'No se encontró la marca actual');
      return;
    }

    const currentMarcaData = JSON.parse(currentMarca);

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas guardar este plan para la atención de situaciones especiales?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const requestData = {
                marca_id: currentMarcaData.id,
                edificio: edificio.trim() || null,
                supervisor: supervisor.trim() || null,
                situaciones: situaciones.length > 0 ? JSON.stringify(situaciones) : null,
              };

              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await createSpecialSituationsPlan({
                  requestData,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Plan para la atención de situaciones especiales guardado correctamente');
                  cancelCreating();
                  fetchPlans();
                } else {
                  Alert.alert('Error', result.message || 'Error al guardar el plan para la atención de situaciones especiales');
                }
              } else {
                const localId = generateRandomId();

                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: localId,
                  action: 'create',
                  type: 'special_situations_plan',
                  payload: requestData,
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                const cache = cacheStr ? JSON.parse(cacheStr) : [];

                const newRecordCache: SpecialSituationsPlan = {
                  id: '',
                  id_local: localId,
                  edificio: edificio.trim() || null,
                  supervisor: supervisor.trim() || null,
                  situaciones: situaciones.length > 0 ? JSON.stringify(situaciones) : null,
                  created_at: new Date().toISOString(),
                  synced: false,
                };

                cache.push({ ...newRecordCache, type: 'special_situations_plan' });
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(cache));

                Alert.alert('Modo Offline', 'Plan para la atención de situaciones especiales registrado localmente. Se sincronizará cuando haya conexión.');
                cancelCreating();
                fetchPlans();
              }
            } catch (err) {
              console.error('Error saving plan:', err);
              Alert.alert('Error', 'No se pudo guardar el plan para la atención de situaciones especiales');
            }
          },
        },
      ]
    );
  };

  const updatePlanHandler = async () => {
    if (!editingRecord) return;

    const recordId = editingRecord.id || editingRecord.id_local;
    if (!recordId) {
      Alert.alert('Error', 'ID de registro no encontrado para actualizar');
      return;
    }

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas actualizar este plan para la atención de situaciones especiales?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const requestData = {
                edificio: edificio.trim() || null,
                supervisor: supervisor.trim() || null,
                situaciones: situaciones.length > 0 ? JSON.stringify(situaciones) : null,
              };

              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await updateSpecialSituationsPlan({
                  id: recordId,
                  requestData,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Plan para la atención de situaciones especiales actualizado correctamente');
                  cancelEditing();
                  fetchPlans();
                } else {
                  Alert.alert('Error', result.message || 'Error al actualizar el plan para la atención de situaciones especiales');
                }
              } else {
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: recordId,
                  action: 'update',
                  type: 'special_situations_plan',
                  payload: requestData,
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                if (cacheStr) {
                  const cache = JSON.parse(cacheStr);
                  const updatedCache = cache.map((item: any) => {
                    if ((item.id === recordId || item.id_local === recordId) && item.type === 'special_situations_plan') {
                      return {
                        ...item,
                        ...requestData,
                        situaciones: situaciones.length > 0 ? JSON.stringify(situaciones) : null,
                        synced: false,
                      };
                    }
                    return item;
                  });
                  await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                }

                Alert.alert('Modo Offline', 'Plan para la atención de situaciones especiales actualizado localmente. Se sincronizará cuando haya conexión.');
                cancelEditing();
                fetchPlans();
              }
            } catch (err) {
              console.error('Error updating plan:', err);
              Alert.alert('Error', 'No se pudo actualizar el plan para la atención de situaciones especiales');
            }
          },
        },
      ]
    );
  };

  const deletePlanHandler = async (record: SpecialSituationsPlan) => {
    const recordId = record.id || record.id_local;
    if (!recordId) {
      Alert.alert('Error', 'ID de registro no encontrado para eliminar');
      return;
    }

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas eliminar este plan para la atención de situaciones especiales?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await deleteSpecialSituationsPlan({
                  id: recordId,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Plan para la atención de situaciones especiales eliminado correctamente');
                  fetchPlans();
                } else {
                  Alert.alert('Error', result.message || 'Error al eliminar el plan para la atención de situaciones especiales');
                }
              } else {
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: recordId,
                  action: 'delete',
                  type: 'special_situations_plan',
                  payload: {},
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                if (cacheStr) {
                  const cache = JSON.parse(cacheStr);
                  const updatedCache = cache.filter((item: any) => !((item.id === recordId || item.id_local === recordId) && item.type === 'special_situations_plan'));
                  await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                }

                Alert.alert('Modo Offline', 'Plan para la atención de situaciones especiales marcado para eliminación localmente. Se sincronizará cuando haya conexión.');
                fetchPlans();
              }
            } catch (err) {
              console.error('Error deleting plan:', err);
              Alert.alert('Error', 'No se pudo eliminar el plan para la atención de situaciones especiales');
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
      case 'plan': return <Ionicons name="warning" size={24} color='#000000' />;
      case 'add': return <Ionicons name="add" size={24} color='#FFFFFF' />;
      case 'cancel': return <Ionicons name="close" size={24} color='#FFFFFF' />;
      case 'confirm': return <Ionicons name="checkmark" size={24} color='#FFFFFF' />;
      case 'delete': return <Ionicons name="trash" size={24} color='#FFFFFF' />;
      case 'edit': return <Ionicons name="pencil" size={20} color="#FFFFFF" />;
      default: return <Ionicons name="warning" size={24} color='#000000' />;
    }
  };

  const renderPlanList = () => {
    if (isLoading) {
      return (
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Cargando planes para la atención de situaciones especiales...</ThemedText>
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

    if (plans.length === 0) {
      return (
        <ThemedView style={styles.emptyContainer}>
          <ThemedText style={styles.emptyText}>No hay planes para la atención de situaciones especiales registrados.</ThemedText>
        </ThemedView>
      );
    }

    return (
      <ThemedView style={styles.listContainer}>
        {plans.map((record) => {
          let situacionesData: Situacion[] = [];

          if (record.situaciones) {
            try {
              situacionesData = JSON.parse(record.situaciones);
            } catch (e) {
              situacionesData = [];
            }
          }

          return (
            <ThemedView key={record.id || record.id_local} style={styles.listItem}>
              <ThemedView style={styles.listItemHeader}>
                <ThemedView style={styles.listItemContent}>
                  <ThemedText style={styles.listItemTitle}>
                    {record.edificio || 'Sin edificio'}
                  </ThemedText>
                  <ThemedText style={styles.listItemSubtitle}>
                    Supervisor: {record.supervisor || 'N/A'}
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
                  <ThemedText style={styles.detailLabel}>Edificio: </ThemedText>
                  {record.edificio || 'No especificado'}
                </ThemedText>
                <ThemedText style={styles.detailText}>
                  <ThemedText style={styles.detailLabel}>Supervisor: </ThemedText>
                  {record.supervisor || 'No especificado'}
                </ThemedText>

                {situacionesData.length > 0 && (
                  <ThemedView style={styles.detailSection}>
                    <ThemedText style={styles.detailSectionTitle}>Situaciones:</ThemedText>
                    {situacionesData.map((item, index) => (
                      <ThemedView key={index} style={styles.detailItem}>
                        <ThemedText style={styles.detailText}>
                          • <ThemedText style={styles.detailLabel}>Situación: </ThemedText>
                          {item.situacion || 'N/A'}
                        </ThemedText>
                        <ThemedText style={styles.detailText}>
                          <ThemedText style={styles.detailLabel}>Acción a seguir: </ThemedText>
                          {item.accion_seguir || 'N/A'}
                        </ThemedText>
                        <ThemedText style={styles.detailText}>
                          <ThemedText style={styles.detailLabel}>Fecha de la emergencia: </ThemedText>
                          {item.fecha_emergencia || 'N/A'}
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
                    onPress={() => deletePlanHandler(record)}
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
      <AppHeader onMenuPress={handleMenuPress} title="Plan para la Atención de Situaciones Especiales" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <ThemedView style={styles.contentContainer}>
          <ThemedText type="title" style={styles.screenTitle}>
            {getActionIcon('plan')} Plan para la Atención de Situaciones Especiales
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
              {/* Edificio */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Edificio</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Edificio"
                  placeholderTextColor="#999"
                  value={edificio}
                  onChangeText={setEdificio}
                />
              </ThemedView>

              {/* Supervisor */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Supervisor</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Supervisor"
                  placeholderTextColor="#999"
                  value={supervisor}
                  onChangeText={setSupervisor}
                />
              </ThemedView>

              {/* Situaciones Section */}
              <ThemedView style={styles.sectionContainer}>
                <ThemedText style={styles.sectionTitle}>Situaciones</ThemedText>
                {situaciones.map((item, index) => {
                  const isExpanded = expandedSituaciones.includes(index);
                  return (
                    <ThemedView key={index} style={styles.expandableItem}>
                      <TouchableOpacity
                        style={styles.expandableHeader}
                        onPress={() => toggleSituacionExpansion(index)}
                      >
                        <ThemedText style={styles.expandableHeaderText}>
                          Situación {index + 1}
                        </ThemedText>
                        <ThemedView style={styles.expandableHeaderActions}>
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation();
                              removeSituacion(index);
                            }}
                            style={styles.removeButton}
                          >
                            <Ionicons name="trash" size={20} color="#FF3B30" />
                          </TouchableOpacity>
                          <Ionicons
                            name={isExpanded ? 'chevron-up' : 'chevron-down'}
                            size={20}
                            color="#000000"
                          />
                        </ThemedView>
                      </TouchableOpacity>

                      {isExpanded && (
                        <ThemedView style={styles.expandableContent}>
                          {/* Situación */}
                          <ThemedView style={styles.formGroup}>
                            <ThemedText style={styles.formLabel}>Situación</ThemedText>
                            <TextInput
                              style={styles.formInput}
                              placeholder="Situación"
                              placeholderTextColor="#999"
                              value={item.situacion}
                              onChangeText={(text) => updateSituacion(index, 'situacion', text)}
                            />
                          </ThemedView>

                          {/* Acción a seguir */}
                          <ThemedView style={styles.formGroup}>
                            <ThemedText style={styles.formLabel}>Acción a seguir</ThemedText>
                            <TextInput
                              style={[styles.formInput, styles.textArea]}
                              placeholder="Acción a seguir"
                              placeholderTextColor="#999"
                              multiline
                              numberOfLines={4}
                              textAlignVertical="top"
                              value={item.accion_seguir}
                              onChangeText={(text) => updateSituacion(index, 'accion_seguir', text)}
                            />
                          </ThemedView>

                          {/* Fecha de la emergencia */}
                          <ThemedView style={styles.formGroup}>
                            <ThemedText style={styles.formLabel}>Fecha de la emergencia</ThemedText>
                            <TouchableOpacity
                              style={styles.dateButton}
                              onPress={() => {
                                setDatePickerIndex(index);
                                setShowDatePicker(true);
                              }}
                            >
                              <ThemedText style={styles.dateButtonText}>
                                {item.fecha_emergencia || 'Seleccionar fecha'}
                              </ThemedText>
                              <Ionicons name="calendar" size={20} color="#007AFF" />
                            </TouchableOpacity>
                            {showDatePicker && datePickerIndex === index && (
                              <DateTimePicker
                                value={item.fecha_emergencia ? new Date(item.fecha_emergencia.split('/').reverse().join('-')) : new Date()}
                                mode="date"
                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                onChange={(event, date) => handleDateChange(event, date, index)}
                              />
                            )}
                          </ThemedView>
                        </ThemedView>
                      )}
                    </ThemedView>
                  );
                })}

                <TouchableOpacity
                  style={styles.addButton}
                  onPress={addSituacion}
                >
                  <Ionicons name="add-circle" size={24} color="#4CAF50" />
                  <ThemedText style={styles.addButtonText}>Agregar Situación</ThemedText>
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
                  onPress={editingRecord ? updatePlanHandler : savePlanHandler}
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
                <ThemedText style={styles.createButtonText}>Crear Nuevo Plan</ThemedText>
              </TouchableOpacity>
              {renderPlanList()}
            </ThemedView>
          )}
        </ThemedView>
      </ScrollView>

      <AppFooter />
      <SlideMenu
        isVisible={isMenuVisible}
        onClose={handleMenuClose}
        onHomePress={handleHomePress}
        currentRoute="SpecialSituationsPlan"
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
    minHeight: 100,
    textAlignVertical: 'top',
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
    marginBottom: 15,
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
    padding: 15,
    backgroundColor: '#F5F5F5',
  },
  expandableHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  expandableHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  removeButton: {
    padding: 4,
  },
  expandableContent: {
    padding: 15,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    marginTop: 10,
    gap: 8,
  },
  addButtonText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
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
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
  },
  detailSectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8,
  },
  detailItem: {
    marginBottom: 10,
    paddingBottom: 10,
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

