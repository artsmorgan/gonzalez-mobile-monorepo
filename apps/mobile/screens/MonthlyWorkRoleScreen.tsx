import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  View,
} from 'react-native';
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
  createMonthlyWorkRole,
  updateMonthlyWorkRole,
  deleteMonthlyWorkRole,
  listMonthlyWorkRoleByCorpo,
} from '@/hooks/evaluationFunctions';
import { eventBus } from '@/hooks/eventBus';

type MonthlyWorkRoleScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'MonthlyWorkRole'>;

interface Empleado {
  area_pasillo_edificio: string;
  plaza: string;
  nombre: string;
  codigo: string;
  turno: string;
  horas_sem: string;
  dias: boolean[]; // Array de 31 elementos (días 1-31)
}

interface MonthlyWorkRole {
  id: string;
  id_local: string;
  mes_ano: string | null;
  cliente: string | null;
  empleados: string | null; // JSON string of Empleado[]
  created_at: string;
  synced?: boolean;
}

interface EditingMonthlyWorkRole {
  id: string | null;
  id_local: string;
  mes_ano: string;
  cliente: string;
  empleados: Empleado[];
}

const MESES_OPTIONS = [
  { label: 'Seleccionar mes', value: '' },
  { label: 'Enero', value: 'Enero' },
  { label: 'Febrero', value: 'Febrero' },
  { label: 'Marzo', value: 'Marzo' },
  { label: 'Abril', value: 'Abril' },
  { label: 'Mayo', value: 'Mayo' },
  { label: 'Junio', value: 'Junio' },
  { label: 'Julio', value: 'Julio' },
  { label: 'Agosto', value: 'Agosto' },
  { label: 'Septiembre', value: 'Septiembre' },
  { label: 'Octubre', value: 'Octubre' },
  { label: 'Noviembre', value: 'Noviembre' },
  { label: 'Diciembre', value: 'Diciembre' },
];

export default function MonthlyWorkRoleScreen() {
  const { employee, refreshAccessToken, logout } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<MonthlyWorkRoleScreenNavigationProp>();

  // Data states
  const [roles, setRoles] = useState<MonthlyWorkRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasCurrentMarca, setHasCurrentMarca] = useState<boolean>(false);

  // Editing state
  const [editingRecord, setEditingRecord] = useState<EditingMonthlyWorkRole | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form states
  const [mesAno, setMesAno] = useState('');
  const [cliente, setCliente] = useState('');
  const [empleados, setEmpleados] = useState<Empleado[]>([]);

  // Expanded states
  const [expandedEmpleadoIndices, setExpandedEmpleadoIndices] = useState<number[]>([]);

  const getConnectionStatus = async (): Promise<boolean> => {
    const networkState = await Network.getNetworkStateAsync();
    return networkState.isConnected && networkState.isInternetReachable ? true : false;
  };

  const generateRandomId = (): string => {
    return `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const fetchRoles = useCallback(async () => {
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
        const result = await listMonthlyWorkRoleByCorpo({
          corpo_id: corpoId,
          refreshAccessToken,
          logout,
        });

        if (result.status && result.data) {
          setRoles(result.data as MonthlyWorkRole[]);
        } else {
          setRoles([]);
        }
      } else {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const rolesCache = cache.filter((item: any) => item.type === 'monthly_work_role');
          setRoles(rolesCache);
        } else {
          setRoles([]);
        }
      }
    } catch (err) {
      console.error('Error fetching roles:', err);
      setError('Error al cargar los roles de trabajo mensual');
      try {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const rolesCache = cache.filter((item: any) => item.type === 'monthly_work_role');
          setRoles(rolesCache);
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
      fetchRoles();
      eventBus.on('connectionRestored', fetchRoles);
      return () => {
        eventBus.off('connectionRestored', fetchRoles);
      };
    }, [fetchRoles])
  );

  const resetForm = () => {
    setMesAno('');
    setCliente('');
    setEmpleados([]);
    setExpandedEmpleadoIndices([]);
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

  const startEditing = (record: MonthlyWorkRole) => {
    setIsCreating(false);
    let empleadosArray: Empleado[] = [];

    if (record.empleados) {
      try {
        empleadosArray = JSON.parse(record.empleados);
        if (!Array.isArray(empleadosArray)) empleadosArray = [];
        // Asegurar que cada empleado tenga el array de días
        empleadosArray = empleadosArray.map((emp: any) => ({
          ...emp,
          dias: Array.isArray(emp.dias) && emp.dias.length === 31 
            ? emp.dias 
            : new Array(31).fill(false),
        }));
      } catch (e) {
        empleadosArray = [];
      }
    }

    setEditingRecord({
      id: record.id,
      id_local: record.id_local,
      mes_ano: record.mes_ano || '',
      cliente: record.cliente || '',
      empleados: empleadosArray,
    });

    setMesAno(record.mes_ano || '');
    setCliente(record.cliente || '');
    setEmpleados(empleadosArray);
    setExpandedEmpleadoIndices(empleadosArray.map((_, i) => i));
  };

  const cancelEditing = () => {
    setEditingRecord(null);
    resetForm();
  };

  const addEmpleado = () => {
    const newEmpleado: Empleado = {
      area_pasillo_edificio: '',
      plaza: '',
      nombre: '',
      codigo: '',
      turno: '',
      horas_sem: '',
      dias: new Array(31).fill(false),
    };
    setEmpleados([...empleados, newEmpleado]);
    setExpandedEmpleadoIndices([...expandedEmpleadoIndices, empleados.length]);
  };

  const updateEmpleado = (index: number, field: keyof Empleado, value: string | boolean[]) => {
    const newEmpleados = [...empleados];
    newEmpleados[index] = {
      ...newEmpleados[index],
      [field]: value,
    };
    setEmpleados(newEmpleados);
  };

  const toggleDia = (empleadoIndex: number, diaIndex: number) => {
    const newEmpleados = [...empleados];
    const empleado = { ...newEmpleados[empleadoIndex] };
    const newDias = [...empleado.dias];
    newDias[diaIndex] = !newDias[diaIndex];
    empleado.dias = newDias;
    newEmpleados[empleadoIndex] = empleado;
    setEmpleados(newEmpleados);
  };

  const removeEmpleado = (index: number) => {
    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas eliminar este empleado?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            setEmpleados(empleados.filter((_, i) => i !== index));
            setExpandedEmpleadoIndices(expandedEmpleadoIndices.filter(i => i !== index).map(i => i > index ? i - 1 : i));
          },
        },
      ]
    );
  };

  const toggleEmpleadoExpansion = (index: number) => {
    setExpandedEmpleadoIndices(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const saveRoleHandler = async () => {
    const currentMarca = await AsyncStorage.getItem('current_marca');
    if (!currentMarca) {
      Alert.alert('Error', 'No se encontró la marca actual');
      return;
    }

    const currentMarcaData = JSON.parse(currentMarca);

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas guardar este rol de trabajo mensual?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const requestData = {
                marca_id: currentMarcaData.id,
                mes_ano: mesAno.trim() || null,
                cliente: cliente.trim() || null,
                empleados: empleados.length > 0 ? JSON.stringify(empleados) : null,
              };

              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await createMonthlyWorkRole({
                  requestData,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Rol de trabajo mensual guardado correctamente');
                  cancelCreating();
                  fetchRoles();
                } else {
                  Alert.alert('Error', result.message || 'Error al guardar el rol de trabajo mensual');
                }
              } else {
                const localId = generateRandomId();

                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: localId,
                  action: 'create',
                  type: 'monthly_work_role',
                  payload: requestData,
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                const cache = cacheStr ? JSON.parse(cacheStr) : [];

                const newRecordCache: MonthlyWorkRole = {
                  id: '',
                  id_local: localId,
                  mes_ano: mesAno.trim() || null,
                  cliente: cliente.trim() || null,
                  empleados: empleados.length > 0 ? JSON.stringify(empleados) : null,
                  created_at: new Date().toISOString(),
                  synced: false,
                };

                cache.push({ ...newRecordCache, type: 'monthly_work_role' });
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(cache));

                Alert.alert('Modo Offline', 'Rol de trabajo mensual registrado localmente. Se sincronizará cuando haya conexión.');
                cancelCreating();
                fetchRoles();
              }
            } catch (err) {
              console.error('Error saving role:', err);
              Alert.alert('Error', 'No se pudo guardar el rol de trabajo mensual');
            }
          },
        },
      ]
    );
  };

  const updateRoleHandler = async () => {
    if (!editingRecord) return;

    const recordId = editingRecord.id || editingRecord.id_local;
    if (!recordId) {
      Alert.alert('Error', 'ID de registro no encontrado para actualizar');
      return;
    }

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas actualizar este rol de trabajo mensual?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const requestData = {
                mes_ano: mesAno.trim() || null,
                cliente: cliente.trim() || null,
                empleados: empleados.length > 0 ? JSON.stringify(empleados) : null,
              };

              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await updateMonthlyWorkRole({
                  id: recordId,
                  requestData,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Rol de trabajo mensual actualizado correctamente');
                  cancelEditing();
                  fetchRoles();
                } else {
                  Alert.alert('Error', result.message || 'Error al actualizar el rol de trabajo mensual');
                }
              } else {
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: recordId,
                  action: 'update',
                  type: 'monthly_work_role',
                  payload: requestData,
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                if (cacheStr) {
                  const cache = JSON.parse(cacheStr);
                  const updatedCache = cache.map((item: any) => {
                    if ((item.id === recordId || item.id_local === recordId) && item.type === 'monthly_work_role') {
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

                Alert.alert('Modo Offline', 'Rol de trabajo mensual actualizado localmente. Se sincronizará cuando haya conexión.');
                cancelEditing();
                fetchRoles();
              }
            } catch (err) {
              console.error('Error updating role:', err);
              Alert.alert('Error', 'No se pudo actualizar el rol de trabajo mensual');
            }
          },
        },
      ]
    );
  };

  const deleteRoleHandler = async (record: MonthlyWorkRole) => {
    const recordId = record.id || record.id_local;
    if (!recordId) {
      Alert.alert('Error', 'ID de registro no encontrado para eliminar');
      return;
    }

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas eliminar este rol de trabajo mensual?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await deleteMonthlyWorkRole({
                  id: recordId,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Rol de trabajo mensual eliminado correctamente');
                  fetchRoles();
                } else {
                  Alert.alert('Error', result.message || 'Error al eliminar el rol de trabajo mensual');
                }
              } else {
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: recordId,
                  action: 'delete',
                  type: 'monthly_work_role',
                  payload: {},
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                if (cacheStr) {
                  const cache = JSON.parse(cacheStr);
                  const updatedCache = cache.filter((item: any) => !((item.id === recordId || item.id_local === recordId) && item.type === 'monthly_work_role'));
                  await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                }

                Alert.alert('Modo Offline', 'Rol de trabajo mensual marcado para eliminación localmente. Se sincronizará cuando haya conexión.');
                fetchRoles();
              }
            } catch (err) {
              console.error('Error deleting role:', err);
              Alert.alert('Error', 'No se pudo eliminar el rol de trabajo mensual');
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
      case 'role': return <Ionicons name="calendar" size={24} color='#000000' />;
      case 'add': return <Ionicons name="add" size={24} color='#FFFFFF' />;
      case 'cancel': return <Ionicons name="close" size={24} color='#FFFFFF' />;
      case 'confirm': return <Ionicons name="checkmark" size={24} color='#FFFFFF' />;
      case 'delete': return <Ionicons name="trash" size={24} color='#FFFFFF' />;
      case 'edit': return <Ionicons name="pencil" size={20} color="#FFFFFF" />;
      default: return <Ionicons name="calendar" size={24} color='#000000' />;
    }
  };

  const renderRoleList = () => {
    if (isLoading) {
      return (
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Cargando roles de trabajo mensual...</ThemedText>
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

    if (roles.length === 0) {
      return (
        <ThemedView style={styles.emptyContainer}>
          <ThemedText style={styles.emptyText}>No hay roles de trabajo mensual registrados.</ThemedText>
        </ThemedView>
      );
    }

    return (
      <ThemedView style={styles.listContainer}>
        {roles.map((record) => {
          let empleadosArray: Empleado[] = [];
          if (record.empleados) {
            try {
              empleadosArray = JSON.parse(record.empleados);
            } catch (e) {
              empleadosArray = [];
            }
          }

          return (
            <ThemedView key={record.id || record.id_local} style={styles.listItem}>
              <ThemedView style={styles.listItemHeader}>
                <ThemedView style={styles.listItemContent}>
                  <ThemedText style={styles.listItemTitle}>
                    Rol de Trabajo Mensual
                  </ThemedText>
                  <ThemedText style={styles.listItemSubtitle}>
                    Mes: {record.mes_ano || 'N/A'} | Cliente: {record.cliente || 'N/A'} | Empleados: {empleadosArray.length}
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
                    onPress={() => deleteRoleHandler(record)}
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

  const renderEmpleado = (empleado: Empleado, index: number) => {
    const isExpanded = expandedEmpleadoIndices.includes(index);

    return (
      <ThemedView key={index} style={styles.empleadoItem}>
        <TouchableOpacity
          style={styles.empleadoHeader}
          onPress={() => toggleEmpleadoExpansion(index)}
        >
          <ThemedView style={styles.empleadoHeaderContent}>
            <ThemedText style={styles.empleadoHeaderText}>
              Empleado {index + 1}: {empleado.nombre || 'Sin nombre'}
            </ThemedText>
          </ThemedView>
          <ThemedView style={styles.empleadoHeaderActions}>
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                removeEmpleado(index);
              }}
              style={styles.removeEmpleadoButton}
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
          <ThemedView style={styles.empleadoContent}>
            {/* Área, Pasillo, Edificio */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Área, Pasillo, Edificio</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder="Área, Pasillo, Edificio"
                placeholderTextColor="#999"
                value={empleado.area_pasillo_edificio}
                onChangeText={(text) => updateEmpleado(index, 'area_pasillo_edificio', text)}
              />
            </ThemedView>

            {/* Plaza */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Plaza</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder="Plaza"
                placeholderTextColor="#999"
                value={empleado.plaza}
                onChangeText={(text) => updateEmpleado(index, 'plaza', text)}
              />
            </ThemedView>

            {/* Nombre */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Nombre</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder="Nombre"
                placeholderTextColor="#999"
                value={empleado.nombre}
                onChangeText={(text) => updateEmpleado(index, 'nombre', text)}
              />
            </ThemedView>

            {/* Código */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Código</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder="Código"
                placeholderTextColor="#999"
                value={empleado.codigo}
                onChangeText={(text) => updateEmpleado(index, 'codigo', text)}
              />
            </ThemedView>

            {/* Turno */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Turno</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder="Turno"
                placeholderTextColor="#999"
                value={empleado.turno}
                onChangeText={(text) => updateEmpleado(index, 'turno', text)}
              />
            </ThemedView>

            {/* HORAS X SEM */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>HORAS X SEM</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder="HORAS X SEM"
                placeholderTextColor="#999"
                value={empleado.horas_sem}
                onChangeText={(text) => updateEmpleado(index, 'horas_sem', text)}
                keyboardType="numeric"
              />
            </ThemedView>

            {/* Días del mes (1-31) */}
            <ThemedView style={styles.diasContainer}>
              <ThemedText style={styles.diasTitle}>Días del Mes</ThemedText>
              <ThemedView style={styles.checkboxesContainer}>
                <ThemedView style={styles.checkboxesGrid}>
                  {empleado.dias.map((checked, dayIndex) => (
                    <TouchableOpacity
                      key={dayIndex}
                      style={styles.checkboxItem}
                      onPress={() => toggleDia(index, dayIndex)}
                    >
                      <View style={styles.checkbox}>
                        {checked && (
                          <Ionicons name="checkmark" size={16} color="#FF9500" />
                        )}
                      </View>
                      <ThemedText style={styles.checkboxLabel}>{dayIndex + 1}</ThemedText>
                    </TouchableOpacity>
                  ))}
                </ThemedView>
              </ThemedView>
            </ThemedView>
          </ThemedView>
        )}
      </ThemedView>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <AppHeader onMenuPress={handleMenuPress} title="Rol de Trabajo Mensual" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <ThemedView style={styles.contentContainer}>
          <ThemedText type="title" style={styles.screenTitle}>
            {getActionIcon('role')} Rol de Trabajo Mensual
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
              {/* Mes del año */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Mes del año</ThemedText>
                <ThemedView style={styles.pickerContainer}>
                  <Picker
                    selectedValue={mesAno}
                    onValueChange={(value) => setMesAno(value)}
                    style={styles.picker}
                  >
                    {MESES_OPTIONS.map((option) => (
                      <Picker.Item
                        key={option.value}
                        label={option.label}
                        value={option.value}
                      />
                    ))}
                  </Picker>
                </ThemedView>
              </ThemedView>

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

              {/* Lista de empleados */}
              {empleados.map((empleado, index) => renderEmpleado(empleado, index))}

              <TouchableOpacity
                style={styles.addEmpleadoButton}
                onPress={addEmpleado}
              >
                <Ionicons name="add-circle" size={24} color="#4CAF50" />
                <ThemedText style={styles.addEmpleadoButtonText}>Agregar Empleado</ThemedText>
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
                  onPress={editingRecord ? updateRoleHandler : saveRoleHandler}
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
                <ThemedText style={styles.createButtonText}>Crear Nuevo Rol de Trabajo Mensual</ThemedText>
              </TouchableOpacity>
              {renderRoleList()}
            </ThemedView>
          )}
        </ThemedView>
      </ScrollView>

      <AppFooter />
      <SlideMenu
        isVisible={isMenuVisible}
        onClose={handleMenuClose}
        onHomePress={handleHomePress}
        currentRoute="MonthlyWorkRole"
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
  empleadoItem: {
    marginBottom: 15,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  empleadoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#F5F5F5',
  },
  empleadoHeaderContent: {
    flex: 1,
    marginRight: 10,
  },
  empleadoHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  empleadoHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  removeEmpleadoButton: {
    padding: 4,
  },
  empleadoContent: {
    padding: 15,
  },
  diasContainer: {
    marginTop: 15,
    padding: 15,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
  },
  diasTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 15,
  },
  checkboxesContainer: {
    width: '100%',
  },
  checkboxesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  checkboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    width: '10%',
    minWidth: 45,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#FF9500',
    borderRadius: 4,
    marginRight: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#000000',
  },
  addEmpleadoButton: {
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
  addEmpleadoButtonText: {
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

