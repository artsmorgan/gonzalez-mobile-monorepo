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
import { Picker } from '@react-native-picker/picker';
import {
  createWorkRole,
  updateWorkRole,
  deleteWorkRole,
  listWorkRoleByCorpo,
} from '@/hooks/evaluationFunctions';
import { eventBus } from '@/hooks/eventBus';

type WorkRoleScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'WorkRole'>;

interface HorarioRegistro {
  dia_ingreso: string; // Día de la semana (Lunes, Martes, etc.)
  dia_salida: string; // Día de la semana (Lunes, Martes, etc.)
  hora_ingreso: string;
  hora_salida: string;
}

const DIAS_SEMANA_OPTIONS = [
  { label: 'Seleccionar día', value: '' },
  { label: 'Lunes', value: 'Lunes' },
  { label: 'Martes', value: 'Martes' },
  { label: 'Miércoles', value: 'Miércoles' },
  { label: 'Jueves', value: 'Jueves' },
  { label: 'Viernes', value: 'Viernes' },
  { label: 'Sábado', value: 'Sábado' },
  { label: 'Domingo', value: 'Domingo' },
];

interface WorkRole {
  id: string;
  id_local: string;
  area: string | null;
  metraje: string | null;
  horario: string | null;
  personal: string | null;
  horarios: string | null; // JSON string of HorarioRegistro[]
  created_at: string;
  synced?: boolean;
}

interface EditingWorkRole {
  id: string | null;
  id_local: string;
  area: string;
  metraje: string;
  horario: string;
  personal: string;
  horarios: HorarioRegistro[];
}

export default function WorkRoleScreen() {
  const { employee, refreshAccessToken, logout } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<WorkRoleScreenNavigationProp>();

  // Data states
  const [workRoles, setWorkRoles] = useState<WorkRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasCurrentMarca, setHasCurrentMarca] = useState<boolean>(false);

  // Editing state
  const [editingRecord, setEditingRecord] = useState<EditingWorkRole | null>(null);

  // Creating state
  const [isCreating, setIsCreating] = useState(false);

  // Form states
  const [area, setArea] = useState('');
  const [metraje, setMetraje] = useState('');
  const [horario, setHorario] = useState('');
  const [personal, setPersonal] = useState('');
  const [horarios, setHorarios] = useState<HorarioRegistro[]>([]);
  const [expandedHorarios, setExpandedHorarios] = useState<number[]>([]);

  // Time picker states
  const [showTimePickerHorario, setShowTimePickerHorario] = useState<{ index: number; field: 'hora_ingreso' | 'hora_salida' } | null>(null);

  const getConnectionStatus = async (): Promise<boolean> => {
    const networkState = await Network.getNetworkStateAsync();
    return networkState.isConnected && networkState.isInternetReachable ? true : false;
  };

  const generateRandomId = (): string => {
    return `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const formatTime = (date: Date): string => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const fetchWorkRoles = useCallback(async () => {
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
        const result = await listWorkRoleByCorpo({
          corpo_id: corpoId,
          refreshAccessToken,
          logout,
        });

        if (result.status && result.data) {
          setWorkRoles(result.data as WorkRole[]);
        } else {
          setWorkRoles([]);
        }
      } else {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const rolesCache = cache.filter((item: any) => item.type === 'work_role');
          setWorkRoles(rolesCache);
        } else {
          setWorkRoles([]);
        }
      }
    } catch (err) {
      console.error('Error fetching work roles:', err);
      setError('Error al cargar los roles de trabajo');
      try {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const rolesCache = cache.filter((item: any) => item.type === 'work_role');
          setWorkRoles(rolesCache);
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
      fetchWorkRoles();
      eventBus.on('connectionRestored', fetchWorkRoles);
      return () => {
        eventBus.off('connectionRestored', fetchWorkRoles);
      };
    }, [fetchWorkRoles])
  );

  const resetForm = () => {
    setArea('');
    setMetraje('');
    setHorario('');
    setPersonal('');
    setHorarios([]);
    setExpandedHorarios([]);
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

  const startEditing = (record: WorkRole) => {
    setIsCreating(false);
    let horariosEdit: HorarioRegistro[] = [];
    
    if (record.horarios) {
      try {
        horariosEdit = JSON.parse(record.horarios);
        if (!Array.isArray(horariosEdit)) {
          horariosEdit = [];
        }
      } catch (e) {
        console.error('Error parsing horarios:', e);
        horariosEdit = [];
      }
    }

    setEditingRecord({
      id: record.id,
      id_local: record.id_local,
      area: record.area || '',
      metraje: record.metraje || '',
      horario: record.horario || '',
      personal: record.personal || '',
      horarios: horariosEdit,
    });
    setArea(record.area || '');
    setMetraje(record.metraje || '');
    setHorario(record.horario || '');
    setPersonal(record.personal || '');
    setHorarios(horariosEdit);
    setExpandedHorarios(horariosEdit.map((_, index) => index));
  };

  const cancelEditing = () => {
    setEditingRecord(null);
    resetForm();
  };

  const addHorario = () => {
    const nuevoHorario: HorarioRegistro = {
      dia_ingreso: '',
      dia_salida: '',
      hora_ingreso: '',
      hora_salida: '',
    };
    setHorarios(prev => [...prev, nuevoHorario]);
    setExpandedHorarios(prev => [...prev, horarios.length]);
  };

  const updateHorario = (index: number, field: keyof HorarioRegistro, value: string) => {
    const nuevosHorarios = [...horarios];
    nuevosHorarios[index][field] = value;
    setHorarios(nuevosHorarios);
  };

  const removeHorario = (index: number) => {
    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas eliminar este horario?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            const nuevosHorarios = horarios.filter((_, i) => i !== index);
            setHorarios(nuevosHorarios);
            setExpandedHorarios(prev => prev.filter(i => i !== index).map(i => i > index ? i - 1 : i));
          },
        },
      ]
    );
  };

  const toggleHorarioExpansion = (index: number) => {
    setExpandedHorarios(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const handleTimeChangeHorario = (event: any, selectedTime?: Date) => {
    if (showTimePickerHorario && selectedTime) {
      const { index, field } = showTimePickerHorario;
      updateHorario(index, field, formatTime(selectedTime));
    }
    setShowTimePickerHorario(Platform.OS === 'ios' ? showTimePickerHorario : null);
  };

  const saveWorkRoleHandler = async () => {
    const currentMarca = await AsyncStorage.getItem('current_marca');
    if (!currentMarca) {
      Alert.alert('Error', 'No se encontró la marca actual');
      return;
    }

    const currentMarcaData = JSON.parse(currentMarca);

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas guardar este rol de trabajo?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const requestData = {
                marca_id: currentMarcaData.id,
                area: area.trim() || null,
                metraje: metraje.trim() || null,
                horario: horario.trim() || null,
                personal: personal.trim() || null,
                horarios: horarios.length > 0 ? JSON.stringify(horarios) : null,
              };

              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await createWorkRole({
                  requestData,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Rol de trabajo guardado correctamente');
                  cancelCreating();
                  fetchWorkRoles();
                } else {
                  Alert.alert('Error', result.message || 'Error al guardar el rol de trabajo');
                }
              } else {
                const localId = generateRandomId();

                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: localId,
                  action: 'create',
                  type: 'work_role',
                  payload: requestData,
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                const cache = cacheStr ? JSON.parse(cacheStr) : [];

                const newRecordCache: WorkRole = {
                  id: '',
                  id_local: localId,
                  area: area.trim() || null,
                  metraje: metraje.trim() || null,
                  horario: horario.trim() || null,
                  personal: personal.trim() || null,
                  horarios: horarios.length > 0 ? JSON.stringify(horarios) : null,
                  created_at: new Date().toISOString(),
                  synced: false,
                };

                cache.push({ ...newRecordCache, type: 'work_role' });
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(cache));

                Alert.alert('Modo Offline', 'Rol de trabajo registrado localmente. Se sincronizará cuando haya conexión.');
                cancelCreating();
                fetchWorkRoles();
              }
            } catch (err) {
              console.error('Error saving work role:', err);
              Alert.alert('Error', 'No se pudo guardar el rol de trabajo');
            }
          },
        },
      ]
    );
  };

  const updateWorkRoleHandler = async () => {
    if (!editingRecord) return;

    const recordId = editingRecord.id || editingRecord.id_local;
    if (!recordId) {
      Alert.alert('Error', 'ID de registro no encontrado para actualizar');
      return;
    }

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas actualizar este rol de trabajo?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const requestData = {
                area: area.trim() || null,
                metraje: metraje.trim() || null,
                horario: horario.trim() || null,
                personal: personal.trim() || null,
                horarios: horarios.length > 0 ? JSON.stringify(horarios) : null,
              };

              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await updateWorkRole({
                  id: recordId,
                  requestData,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Rol de trabajo actualizado correctamente');
                  cancelEditing();
                  fetchWorkRoles();
                } else {
                  Alert.alert('Error', result.message || 'Error al actualizar el rol de trabajo');
                }
              } else {
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: recordId,
                  action: 'update',
                  type: 'work_role',
                  payload: requestData,
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                if (cacheStr) {
                  const cache = JSON.parse(cacheStr);
                  const updatedCache = cache.map((item: any) => {
                    if ((item.id === recordId || item.id_local === recordId) && item.type === 'work_role') {
                      return {
                        ...item,
                        area: requestData.area,
                        metraje: requestData.metraje,
                        horario: requestData.horario,
                        personal: requestData.personal,
                        horarios: requestData.horarios,
                        synced: false,
                      };
                    }
                    return item;
                  });
                  await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                }

                Alert.alert('Modo Offline', 'Rol de trabajo actualizado localmente. Se sincronizará cuando haya conexión.');
                cancelEditing();
                fetchWorkRoles();
              }
            } catch (err) {
              console.error('Error updating work role:', err);
              Alert.alert('Error', 'No se pudo actualizar el rol de trabajo');
            }
          },
        },
      ]
    );
  };

  const deleteWorkRoleHandler = async (record: WorkRole) => {
    const recordId = record.id || record.id_local;
    if (!recordId) {
      Alert.alert('Error', 'ID de registro no encontrado para eliminar');
      return;
    }

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas eliminar este rol de trabajo?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await deleteWorkRole({
                  id: recordId,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Rol de trabajo eliminado correctamente');
                  fetchWorkRoles();
                } else {
                  Alert.alert('Error', result.message || 'Error al eliminar el rol de trabajo');
                }
              } else {
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: recordId,
                  action: 'delete',
                  type: 'work_role',
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

                Alert.alert('Modo Offline', 'Rol de trabajo marcado para eliminación localmente. Se sincronizará cuando haya conexión.');
                fetchWorkRoles();
              }
            } catch (err) {
              console.error('Error deleting work role:', err);
              Alert.alert('Error', 'No se pudo eliminar el rol de trabajo');
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
      case 'workrole': return <Ionicons name="calendar" size={24} color='#000000' />;
      case 'add': return <Ionicons name="add" size={24} color='#FFFFFF' />;
      case 'cancel': return <Ionicons name="close" size={24} color='#FFFFFF' />;
      case 'confirm': return <Ionicons name="checkmark" size={24} color='#FFFFFF' />;
      case 'delete': return <Ionicons name="trash" size={24} color='#FFFFFF' />;
      case 'edit': return <Ionicons name="pencil" size={20} color="#FFFFFF" />;
      default: return <Ionicons name="calendar" size={24} color='#000000' />;
    }
  };

  const renderWorkRoleList = () => {
    if (isLoading) {
      return (
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Cargando roles de trabajo...</ThemedText>
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

    if (workRoles.length === 0) {
      return (
        <ThemedView style={styles.emptyContainer}>
          <ThemedText style={styles.emptyText}>No hay roles de trabajo registrados.</ThemedText>
        </ThemedView>
      );
    }

    return (
      <ThemedView style={styles.listContainer}>
        {workRoles.map((record) => {
          let horariosData: HorarioRegistro[] = [];
          if (record.horarios) {
            try {
              horariosData = JSON.parse(record.horarios);
              if (!Array.isArray(horariosData)) {
                horariosData = [];
              }
            } catch (e) {
              horariosData = [];
            }
          }

          return (
            <ThemedView key={record.id || record.id_local} style={styles.listItem}>
              <ThemedView style={styles.listItemHeader}>
                <ThemedView style={styles.listItemContent}>
                  <ThemedText style={styles.listItemTitle}>
                    {record.area || 'Sin área'}
                  </ThemedText>
                  <ThemedText style={styles.listItemSubtitle}>
                    Metraje: {record.metraje || 'N/A'} | Personal: {record.personal || 'N/A'}
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
                  <ThemedText style={styles.detailLabel}>Área: </ThemedText>
                  {record.area || 'No especificado'}
                </ThemedText>
                <ThemedText style={styles.detailText}>
                  <ThemedText style={styles.detailLabel}>Metraje: </ThemedText>
                  {record.metraje || 'No especificado'}
                </ThemedText>
                <ThemedText style={styles.detailText}>
                  <ThemedText style={styles.detailLabel}>Horario: </ThemedText>
                  {record.horario || 'No especificado'}
                </ThemedText>
                <ThemedText style={styles.detailText}>
                  <ThemedText style={styles.detailLabel}>Personal: </ThemedText>
                  {record.personal || 'No especificado'}
                </ThemedText>

                {horariosData.length > 0 && (
                  <ThemedView style={styles.detailSection}>
                    <ThemedText style={styles.detailSectionTitle}>Horarios:</ThemedText>
                    {horariosData.map((horario, index) => (
                      <ThemedView key={index} style={styles.horarioItemDisplay}>
                        <ThemedText style={styles.detailText}>
                          • <ThemedText style={styles.detailLabel}>Día ingreso: </ThemedText>
                          {horario.dia_ingreso || 'N/A'}
                        </ThemedText>
                        <ThemedText style={styles.detailText}>
                          <ThemedText style={styles.detailLabel}>Día salida: </ThemedText>
                          {horario.dia_salida || 'N/A'}
                        </ThemedText>
                        <ThemedText style={styles.detailText}>
                          <ThemedText style={styles.detailLabel}>Hora ingreso: </ThemedText>
                          {horario.hora_ingreso || 'N/A'}
                        </ThemedText>
                        <ThemedText style={styles.detailText}>
                          <ThemedText style={styles.detailLabel}>Hora salida: </ThemedText>
                          {horario.hora_salida || 'N/A'}
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
                    onPress={() => deleteWorkRoleHandler(record)}
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
      <AppHeader onMenuPress={handleMenuPress} title="Rol de Trabajo" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <ThemedView style={styles.contentContainer}>
          <ThemedText type="title" style={styles.screenTitle}>
            {getActionIcon('workrole')} Rol de Trabajo
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
              {/* Área */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Área</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Área"
                  placeholderTextColor="#999"
                  value={area}
                  onChangeText={setArea}
                  color="#000000"
                />
              </ThemedView>

              {/* Metraje */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Metraje</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Metraje"
                  placeholderTextColor="#999"
                  value={metraje}
                  onChangeText={setMetraje}
                  keyboardType="numeric"
                  color="#000000"
                />
              </ThemedView>

              {/* Horario */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Horario</ThemedText>
                <TextInput
                  style={[styles.formInput, styles.textArea]}
                  placeholder="Horario"
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={2}
                  textAlignVertical="top"
                  value={horario}
                  onChangeText={setHorario}
                  color="#000000"
                />
              </ThemedView>

              {/* Personal */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Personal</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Personal"
                  placeholderTextColor="#999"
                  value={personal}
                  onChangeText={setPersonal}
                  keyboardType="numeric"
                  color="#000000"
                />
              </ThemedView>

              {/* Horarios */}
              <ThemedView style={styles.sectionContainer}>
                <ThemedText style={styles.sectionTitle}>Horarios</ThemedText>
                {horarios.map((horario, index) => {
                  const isExpanded = expandedHorarios.includes(index);
                  return (
                    <ThemedView key={index} style={styles.horarioItem}>
                      <TouchableOpacity
                        style={styles.horarioHeader}
                        onPress={() => toggleHorarioExpansion(index)}
                      >
                        <ThemedText style={styles.horarioHeaderText}>
                          Horario {index + 1}
                        </ThemedText>
                        <Ionicons
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={20}
                          color="#000000"
                        />
                      </TouchableOpacity>

                      {isExpanded && (
                        <ThemedView style={styles.horarioContent}>
                          {/* Día ingreso */}
                          <ThemedView style={styles.formGroup}>
                            <ThemedText style={styles.formLabel}>Día ingreso</ThemedText>
                            <ThemedView style={styles.pickerContainer}>
                              <Picker
                                selectedValue={horario.dia_ingreso}
                                onValueChange={(value: string) => updateHorario(index, 'dia_ingreso', value)}
                                style={styles.picker}
                              >
                                {DIAS_SEMANA_OPTIONS.map((option) => (
                                  <Picker.Item
                                    key={option.value}
                                    label={option.label}
                                    value={option.value}
                                  />
                                ))}
                              </Picker>
                            </ThemedView>
                          </ThemedView>

                          {/* Día salida */}
                          <ThemedView style={styles.formGroup}>
                            <ThemedText style={styles.formLabel}>Día salida</ThemedText>
                            <ThemedView style={styles.pickerContainer}>
                              <Picker
                                selectedValue={horario.dia_salida}
                                onValueChange={(value: string) => updateHorario(index, 'dia_salida', value)}
                                style={styles.picker}
                              >
                                {DIAS_SEMANA_OPTIONS.map((option) => (
                                  <Picker.Item
                                    key={option.value}
                                    label={option.label}
                                    value={option.value}
                                  />
                                ))}
                              </Picker>
                            </ThemedView>
                          </ThemedView>

                          {/* Hora ingreso */}
                          <ThemedView style={styles.formGroup}>
                            <ThemedText style={styles.formLabel}>Hora ingreso</ThemedText>
                            <TouchableOpacity
                              style={styles.dateButton}
                              onPress={() => setShowTimePickerHorario({ index, field: 'hora_ingreso' })}
                            >
                              <ThemedText style={styles.dateButtonText}>
                                {horario.hora_ingreso || 'Seleccionar hora'}
                              </ThemedText>
                              <Ionicons name="time-outline" size={20} color="#007AFF" />
                            </TouchableOpacity>
                            {showTimePickerHorario?.index === index && showTimePickerHorario?.field === 'hora_ingreso' && (
                              <DateTimePicker
                                value={horario.hora_ingreso ? new Date(`2000-01-01T${horario.hora_ingreso}:00`) : new Date()}
                                mode="time"
                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                onChange={handleTimeChangeHorario}
                              />
                            )}
                          </ThemedView>

                          {/* Hora salida */}
                          <ThemedView style={styles.formGroup}>
                            <ThemedText style={styles.formLabel}>Hora salida</ThemedText>
                            <TouchableOpacity
                              style={styles.dateButton}
                              onPress={() => setShowTimePickerHorario({ index, field: 'hora_salida' })}
                            >
                              <ThemedText style={styles.dateButtonText}>
                                {horario.hora_salida || 'Seleccionar hora'}
                              </ThemedText>
                              <Ionicons name="time-outline" size={20} color="#007AFF" />
                            </TouchableOpacity>
                            {showTimePickerHorario?.index === index && showTimePickerHorario?.field === 'hora_salida' && (
                              <DateTimePicker
                                value={horario.hora_salida ? new Date(`2000-01-01T${horario.hora_salida}:00`) : new Date()}
                                mode="time"
                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                onChange={handleTimeChangeHorario}
                              />
                            )}
                          </ThemedView>

                          <TouchableOpacity
                            style={styles.removeHorarioButton}
                            onPress={() => removeHorario(index)}
                          >
                            <Ionicons name="trash" size={20} color="#FF3B30" />
                            <ThemedText style={styles.removeHorarioButtonText}>Eliminar Horario</ThemedText>
                          </TouchableOpacity>
                        </ThemedView>
                      )}
                    </ThemedView>
                  );
                })}
                <TouchableOpacity style={styles.addButton} onPress={addHorario}>
                  <Ionicons name="add-circle" size={20} color="#4CAF50" />
                  <ThemedText style={styles.addButtonText}>Agregar Horario</ThemedText>
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
                  onPress={editingRecord ? updateWorkRoleHandler : saveWorkRoleHandler}
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
                <ThemedText style={styles.createButtonText}>Crear Nuevo Rol de Trabajo</ThemedText>
              </TouchableOpacity>
              {renderWorkRoleList()}
            </ThemedView>
          )}
        </ThemedView>
      </ScrollView>

      <AppFooter />
      <SlideMenu
        isVisible={isMenuVisible}
        onClose={handleMenuClose}
        onHomePress={handleHomePress}
        currentRoute="WorkRole"
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
  textArea: {
    minHeight: 60,
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
  horarioItem: {
    marginBottom: 10,
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  horarioHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#F5F5F5',
  },
  horarioHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000000',
  },
  horarioContent: {
    padding: 10,
  },
  removeHorarioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    gap: 8,
    marginTop: 10,
  },
  removeHorarioButtonText: {
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
  horarioItemDisplay: {
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

