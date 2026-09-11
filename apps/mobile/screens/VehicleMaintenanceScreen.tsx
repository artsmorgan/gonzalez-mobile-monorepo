import React, { useState, useCallback, useEffect } from 'react';
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
import Ionicons from '@expo/vector-icons/build/Ionicons';
import * as Network from 'expo-network';
import { createVehicleMaintenance, updateVehicleMaintenance, deleteVehicleMaintenance, listVehicleMaintenanceByCorpo } from '@/hooks/evaluationFunctions';
import { eventBus } from '@/hooks/eventBus';

type VehicleMaintenanceScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'VehicleMaintenance'>;

interface MaintenanceSection {
  kilometraje: string;
  fecha_realizacion: string;
  responsable: string;
  km_real: string;
  operaciones: string[];
}

interface VehicleMaintenance {
  id: string;
  id_local: string;
  nombre_vehiculo: string | null;
  matricula_vehiculo: string | null;
  mantenimientos: MaintenanceSection[] | null;
  created_at: string;
  synced?: boolean;
}

interface EditingVehicleMaintenance {
  id: string | null;
  id_local: string;
  nombre_vehiculo: string;
  matricula_vehiculo: string;
  mantenimientos: MaintenanceSection[];
}

const MAINTENANCE_OPERATIONS = [
  'Cambio de aciete de motor',
  'Cambio de filtro de aceite',
  'Limpiar Filtro de aire',
  'Cambiar filtro de Aire',
  'Balanceo de las ruedas (fuera del vehiculo, cuatro ruedas)',
  'Alineamiento de direccion',
  'Ajuste freno de mano',
  'Inspeccion y Rotacion de llantas',
  'Engrase general',
  'Revisar y drenar sedimentador filtro diesel',
  'Inspeccion aceites transimsion, diferencial, transfer',
  'Limpieza Respiradores Transmisión, transfer y diferencial',
  'Limpieza y Ajuste frenos delanteros',
  'Limpieza y Ajuste frenos traseros',
  'Cambio liquido de frenos',
  'Ajuste resoque de suspension',
  'Cambio de aceite de diferencial (cuando Aplica)',
  'Cambio de aceite de trasfer (cuando Aplica)',
  'Limpieza de inyectores diesel por recirculacion',
  'Cambiar filtro de combustible',
  'Cambio Hules de escobillas (1 cambio anual)',
];

const KILOMETRAJE_SECTIONS = Array.from({ length: 40 }, (_, i) => (i + 1) * 5).map(km => `${km} KM`);

export default function VehicleMaintenanceScreen() {
  const { employee, refreshAccessToken, logout } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<VehicleMaintenanceScreenNavigationProp>();

  // Data states
  const [maintenanceRecords, setMaintenanceRecords] = useState<VehicleMaintenance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasCurrentMarca, setHasCurrentMarca] = useState<boolean>(false);

  // Editing state
  const [editingRecord, setEditingRecord] = useState<EditingVehicleMaintenance | null>(null);

  // Creating state
  const [isCreating, setIsCreating] = useState(false);

  // Form states
  const [nombreVehiculo, setNombreVehiculo] = useState('');
  const [matriculaVehiculo, setMatriculaVehiculo] = useState('');
  const [maintenanceSections, setMaintenanceSections] = useState<MaintenanceSection[]>(() => 
    KILOMETRAJE_SECTIONS.map(km => ({
      kilometraje: km,
      fecha_realizacion: '',
      responsable: '',
      km_real: '',
      operaciones: [],
    }))
  );

  // Date picker states
  const [showDatePickers, setShowDatePickers] = useState<{ [key: string]: boolean }>({});
  
  // Expanded sections state
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [expandedRecordIds, setExpandedRecordIds] = useState<string[]>([]);

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
    return `${year}-${month}-${day}`;
  };

  useFocusEffect(
    useCallback(() => {
      fetchMaintenanceRecords();
    }, [])
  );

  useEffect(() => {
    const handler = () => {
      fetchMaintenanceRecords();
    };

    eventBus.on('connectionRestored', handler);
    return () => {
      eventBus.off('connectionRestored', handler);
    };
  }, []);

  const fetchMaintenanceRecords = async () => {
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
        const result = await listVehicleMaintenanceByCorpo({
          corpo_id: corpoId,
          refreshAccessToken,
          logout,
        });

        if (result.status && result.data) {
          setMaintenanceRecords(result.data as VehicleMaintenance[]);
        } else {
          setMaintenanceRecords([]);
        }
      } else {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const maintenanceCache = cache.filter((item: any) => item.type === 'vehicle_maintenance');
          setMaintenanceRecords(maintenanceCache);
        } else {
          setMaintenanceRecords([]);
        }
      }
    } catch (err) {
      console.error('Error fetching maintenance records:', err);
      setError('Error al cargar las planificaciones');
      try {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const maintenanceCache = cache.filter((item: any) => item.type === 'vehicle_maintenance');
          setMaintenanceRecords(maintenanceCache);
        }
      } catch (cacheErr) {
        console.error('Error loading from cache:', cacheErr);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const startCreating = () => {
    setIsCreating(true);
    setNombreVehiculo('');
    setMatriculaVehiculo('');
    setMaintenanceSections(
      KILOMETRAJE_SECTIONS.map(km => ({
        kilometraje: km,
        fecha_realizacion: '',
        responsable: '',
        km_real: '',
        operaciones: [],
      }))
    );
  };

  const cancelCreating = () => {
    setIsCreating(false);
  };

  const startEditing = (record: VehicleMaintenance) => {
    setEditingRecord({
      id: record.id,
      id_local: record.id_local,
      nombre_vehiculo: record.nombre_vehiculo || '',
      matricula_vehiculo: record.matricula_vehiculo || '',
      mantenimientos: record.mantenimientos || [],
    });
    setNombreVehiculo(record.nombre_vehiculo || '');
    setMatriculaVehiculo(record.matricula_vehiculo || '');
    setMaintenanceSections(
      record.mantenimientos && record.mantenimientos.length > 0
        ? record.mantenimientos
        : KILOMETRAJE_SECTIONS.map(km => ({
            kilometraje: km,
            fecha_realizacion: '',
            responsable: '',
            km_real: '',
            operaciones: [],
          }))
    );
  };

  const cancelEditing = () => {
    setEditingRecord(null);
  };

  const updateMaintenanceSection = (index: number, field: keyof MaintenanceSection, value: any) => {
    const updated = [...maintenanceSections];
    if (field === 'operaciones') {
      updated[index] = { ...updated[index], operaciones: value };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setMaintenanceSections(updated);
  };

  const toggleOperation = (sectionIndex: number, operation: string) => {
    const section = maintenanceSections[sectionIndex];
    const operations = section.operaciones || [];
    const updatedOperations = operations.includes(operation)
      ? operations.filter(op => op !== operation)
      : [...operations, operation];
    updateMaintenanceSection(sectionIndex, 'operaciones', updatedOperations);
  };

  const handleDateChange = (sectionIndex: number, event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePickers({ ...showDatePickers, [`date-${sectionIndex}`]: false });
    }
    if (selectedDate) {
      updateMaintenanceSection(sectionIndex, 'fecha_realizacion', formatDate(selectedDate));
    }
  };

  const toggleSection = (kilometraje: string) => {
    if (expandedSections.includes(kilometraje)) {
      setExpandedSections(expandedSections.filter(km => km !== kilometraje));
    } else {
      setExpandedSections([...expandedSections, kilometraje]);
    }
  };

  const saveMaintenanceRecord = async () => {
    if (!nombreVehiculo.trim()) {
      Alert.alert('Error', 'El nombre del vehículo es requerido');
      return;
    }
    if (!matriculaVehiculo.trim()) {
      Alert.alert('Error', 'La matrícula del vehículo es requerida');
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
      '¿Estás seguro de que deseas guardar esta planificación de mantenimiento?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const requestData = {
                marca_id: currentMarcaData.id,
                nombre_vehiculo: nombreVehiculo.trim(),
                matricula_vehiculo: matriculaVehiculo.trim(),
                mantenimientos: maintenanceSections,
              };

              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await createVehicleMaintenance({
                  requestData,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Planificación de mantenimiento guardada correctamente');
                  cancelCreating();
                  fetchMaintenanceRecords();
                } else {
                  Alert.alert('Error', result.message || 'Error al guardar la planificación de mantenimiento');
                }
              } else {
                const localId = generateRandomId();

                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: localId,
                  action: 'create',
                  type: 'vehicle_maintenance',
                  payload: requestData,
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                const cache = cacheStr ? JSON.parse(cacheStr) : [];

                const newRecordCache: VehicleMaintenance = {
                  id: '',
                  id_local: localId,
                  nombre_vehiculo: nombreVehiculo.trim(),
                  matricula_vehiculo: matriculaVehiculo.trim(),
                  mantenimientos: maintenanceSections,
                  created_at: new Date().toISOString(),
                  synced: false,
                };

                cache.push({ ...newRecordCache, type: 'vehicle_maintenance' });
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(cache));

                Alert.alert('Modo Offline', 'Planificación de mantenimiento registrada localmente. Se sincronizará cuando haya conexión.');
                cancelCreating();
                fetchMaintenanceRecords();
              }
            } catch (err) {
              console.error('Error saving maintenance record:', err);
              Alert.alert('Error', 'No se pudo guardar la planificación de mantenimiento');
            }
          },
        },
      ]
    );
  };

  const updateMaintenanceRecordHandler = async () => {
    if (!editingRecord) return;

    if (!nombreVehiculo.trim()) {
      Alert.alert('Error', 'El nombre del vehículo es requerido');
      return;
    }
    if (!matriculaVehiculo.trim()) {
      Alert.alert('Error', 'La matrícula del vehículo es requerida');
      return;
    }

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas actualizar esta planificación de mantenimiento?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const requestData = {
                nombre_vehiculo: nombreVehiculo.trim(),
                matricula_vehiculo: matriculaVehiculo.trim(),
                mantenimientos: maintenanceSections,
              };

              const isConnected = await getConnectionStatus();
              const recordId = editingRecord.id || editingRecord.id_local;

              if (isConnected && editingRecord.id && !editingRecord.id.startsWith('local-')) {
                const result = await updateVehicleMaintenance({
                  id: editingRecord.id,
                  requestData,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Planificación de mantenimiento actualizada correctamente');
                  cancelEditing();
                  fetchMaintenanceRecords();
                } else {
                  Alert.alert('Error', result.message || 'Error al actualizar la planificación de mantenimiento');
                }
              } else {
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: recordId,
                  action: 'update',
                  type: 'vehicle_maintenance',
                  payload: requestData,
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                if (cacheStr) {
                  const cache = JSON.parse(cacheStr);
                  const updatedCache = cache.map((item: any) => {
                    if ((item.id === recordId || item.id_local === recordId) && item.type === 'vehicle_maintenance') {
                      return {
                        ...item,
                        nombre_vehiculo: nombreVehiculo.trim(),
                        matricula_vehiculo: matriculaVehiculo.trim(),
                        mantenimientos: maintenanceSections,
                      };
                    }
                    return item;
                  });
                  await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                }

                Alert.alert('Modo Offline', 'Planificación de mantenimiento actualizada localmente. Se sincronizará cuando haya conexión.');
                cancelEditing();
                fetchMaintenanceRecords();
              }
            } catch (err) {
              console.error('Error updating maintenance record:', err);
              Alert.alert('Error', 'No se pudo actualizar la planificación de mantenimiento');
            }
          },
        },
      ]
    );
  };

  const deleteMaintenanceRecord = async (record: VehicleMaintenance) => {
    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas eliminar esta planificación de mantenimiento?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const isConnected = await getConnectionStatus();
              const recordId = record.id || record.id_local;

              if (isConnected && record.id && !record.id.startsWith('local-')) {
                const result = await deleteVehicleMaintenance({
                  id: record.id,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Planificación de mantenimiento eliminada correctamente');
                  fetchMaintenanceRecords();
                } else {
                  Alert.alert('Error', result.message || 'Error al eliminar la planificación de mantenimiento');
                }
              } else {
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: recordId,
                  action: 'delete',
                  type: 'vehicle_maintenance',
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

                Alert.alert('Modo Offline', 'Planificación de mantenimiento eliminada localmente. Se sincronizará cuando haya conexión.');
                fetchMaintenanceRecords();
              }
            } catch (err) {
              console.error('Error deleting maintenance record:', err);
              Alert.alert('Error', 'No se pudo eliminar la planificación de mantenimiento');
            }
          },
        },
      ]
    );
  };

  const toggleExpanded = (recordId: string) => {
    if (expandedRecordIds.includes(recordId)) {
      setExpandedRecordIds(expandedRecordIds.filter(id => id !== recordId));
    } else {
      setExpandedRecordIds([...expandedRecordIds, recordId]);
    }
  };

  const renderMaintenanceSection = (section: MaintenanceSection, index: number) => {
    const isExpanded = expandedSections.includes(section.kilometraje);
    const sectionDate = section.fecha_realizacion ? new Date(section.fecha_realizacion) : new Date();

    return (
      <ThemedView key={section.kilometraje} style={styles.sectionContainer}>
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => toggleSection(section.kilometraje)}
        >
          <ThemedText style={styles.sectionTitle}>{section.kilometraje}</ThemedText>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={24}
            color="#000000"
          />
        </TouchableOpacity>

        {isExpanded && (
          <ThemedView style={styles.sectionContent}>
            {/* Fecha de realización */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Fecha de realización</ThemedText>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowDatePickers({ ...showDatePickers, [`date-${index}`]: true })}
              >
                <ThemedText style={styles.dateButtonText}>
                  {section.fecha_realizacion || 'Seleccionar fecha'}
                </ThemedText>
                <Ionicons name="calendar" size={20} color="#007AFF" />
              </TouchableOpacity>
              {showDatePickers[`date-${index}`] && (
                <DateTimePicker
                  value={sectionDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, date) => handleDateChange(index, event, date)}
                />
              )}
            </ThemedView>

            {/* Responsable */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Responsable</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder="Nombre del responsable"
                placeholderTextColor="#999"
                value={section.responsable}
                onChangeText={(text) => updateMaintenanceSection(index, 'responsable', text)}
              />
            </ThemedView>

            {/* KM real */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>KM real</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder="Kilometraje real"
                placeholderTextColor="#999"
                keyboardType="numeric"
                value={section.km_real}
                onChangeText={(text) => updateMaintenanceSection(index, 'km_real', text)}
              />
            </ThemedView>

            {/* Operaciones de mantenimiento */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Operaciones de mantenimiento</ThemedText>
              {MAINTENANCE_OPERATIONS.map((operation) => (
                <TouchableOpacity
                  key={operation}
                  style={styles.checkboxContainer}
                  onPress={() => toggleOperation(index, operation)}
                >
                  <View style={styles.checkbox}>
                    {section.operaciones.includes(operation) && (
                      <Ionicons name="checkmark" size={20} color="#FF9500" />
                    )}
                  </View>
                  <ThemedText style={styles.checkboxLabel}>{operation}</ThemedText>
                </TouchableOpacity>
              ))}
            </ThemedView>
          </ThemedView>
        )}
      </ThemedView>
    );
  };

  const renderForm = (isEditing: boolean = false) => {
    return (
      <ThemedView style={styles.formCard}>
        <ThemedText style={styles.formTitle}>
          {isEditing ? 'Editar Planificación de Mantenimiento' : 'Nueva Planificación de Mantenimiento'}
        </ThemedText>

        {/* Nombre del Vehículo */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Nombre del vehículo *</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="Nombre del vehículo"
            placeholderTextColor="#999"
            value={nombreVehiculo}
            onChangeText={setNombreVehiculo}
          />
        </ThemedView>

        {/* Matrícula del Vehículo */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Matrícula del vehículo *</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="Matrícula del vehículo"
            placeholderTextColor="#999"
            value={matriculaVehiculo}
            onChangeText={setMatriculaVehiculo}
          />
        </ThemedView>

        {/* Secciones de mantenimiento */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Descripcion/Operaciones/Repuestos/Insumos (incluidos)</ThemedText>
          {maintenanceSections.map((section, index) => renderMaintenanceSection(section, index))}
        </ThemedView>

        {/* Action Buttons */}
        <ThemedView style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.cancelButton]}
            onPress={isEditing ? cancelEditing : cancelCreating}
          >
            <ThemedText style={styles.actionButtonText}>Cancelar</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.saveButton]}
            onPress={isEditing ? updateMaintenanceRecordHandler : saveMaintenanceRecord}
          >
            <ThemedText style={styles.actionButtonText}>Guardar</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </ThemedView>
    );
  };

  const renderList = () => {
    if (isLoading) {
      return (
        <ThemedView style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#FF9500" />
          <ThemedText style={styles.loadingText}>Cargando planificaciones...</ThemedText>
        </ThemedView>
      );
    }

    if (error && maintenanceRecords.length === 0) {
      return (
        <ThemedView style={styles.centerContainer}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        </ThemedView>
      );
    }

    if (maintenanceRecords.length === 0) {
      return (
        <ThemedView style={styles.centerContainer}>
          <ThemedText style={styles.emptyText}>No hay planificaciones de mantenimiento registradas</ThemedText>
        </ThemedView>
      );
    }

    return (
      <ThemedView style={styles.listContainer}>
        {maintenanceRecords.map((record) => {
          const recordId = record.id || record.id_local;
          const isExpanded = expandedRecordIds.includes(recordId);
          const isOffline = !record.synced || record.id_local;

          return (
            <ThemedView key={recordId} style={styles.listItem}>
              <TouchableOpacity
                style={styles.listItemHeader}
                onPress={() => toggleExpanded(recordId)}
              >
                <ThemedView style={styles.listItemHeaderContent}>
                  <ThemedText style={styles.listItemTitle}>
                    {record.nombre_vehiculo || 'Sin nombre'}
                  </ThemedText>
                  <ThemedText style={styles.listItemSubtitle}>
                    {record.matricula_vehiculo || 'Sin matrícula'}
                  </ThemedText>
                </ThemedView>
                <ThemedView style={styles.listItemActions}>
                  {isOffline && (
                    <ThemedView style={styles.offlineBadge}>
                      <ThemedText style={styles.offlineBadgeText}>Offline</ThemedText>
                    </ThemedView>
                  )}
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={24}
                    color="#000000"
                  />
                </ThemedView>
              </TouchableOpacity>

              {isExpanded && (
                <ThemedView style={styles.listItemDetails}>
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Fecha: </ThemedText>
                    {new Date(record.created_at).toLocaleDateString('es-CR')}
                  </ThemedText>
                  {record.mantenimientos && record.mantenimientos.length > 0 && (
                    <ThemedView style={styles.maintenanceSectionsList}>
                      <ThemedText style={styles.detailLabel}>Secciones de mantenimiento:</ThemedText>
                      {record.mantenimientos.map((section, idx) => (
                        <ThemedView key={idx} style={styles.maintenanceSectionItem}>
                          <ThemedText style={styles.detailText}>
                            <ThemedText style={styles.detailLabel}>{section.kilometraje}: </ThemedText>
                            {section.fecha_realizacion && `Fecha: ${section.fecha_realizacion} | `}
                            {section.responsable && `Responsable: ${section.responsable} | `}
                            {section.km_real && `KM real: ${section.km_real}`}
                            {section.operaciones.length > 0 && ` | Operaciones: ${section.operaciones.length}`}
                          </ThemedText>
                        </ThemedView>
                      ))}
                    </ThemedView>
                  )}

                  <ThemedView style={styles.listItemButtons}>
                    <TouchableOpacity
                      style={[styles.listItemButton, styles.editButton]}
                      onPress={() => startEditing(record)}
                    >
                      <Ionicons name="pencil" size={20} color="#FFFFFF" />
                      <ThemedText style={styles.listItemButtonText}>Editar</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.listItemButton, styles.deleteButton]}
                      onPress={() => deleteMaintenanceRecord(record)}
                    >
                      <Ionicons name="trash" size={20} color="#FFFFFF" />
                      <ThemedText style={styles.listItemButtonText}>Eliminar</ThemedText>
                    </TouchableOpacity>
                  </ThemedView>
                </ThemedView>
              )}
            </ThemedView>
          );
        })}
      </ThemedView>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <AppHeader onMenuPress={() => setIsMenuVisible(true)} title="Planificación y Control de Mantenimiento" />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {!hasCurrentMarca && (
          <ThemedView style={styles.warningContainer}>
            <ThemedText style={styles.warningText}>
              No se encontró la marca actual. Por favor, marca tu entrada primero.
            </ThemedText>
          </ThemedView>
        )}

        {hasCurrentMarca && (
          <>
            {!isCreating && !editingRecord && (
              <TouchableOpacity style={styles.createButton} onPress={startCreating}>
                <Ionicons name="add-circle" size={24} color="#FFFFFF" />
                <ThemedText style={styles.createButtonText}>Nueva Planificación</ThemedText>
              </TouchableOpacity>
            )}

            {isCreating && renderForm(false)}
            {editingRecord && renderForm(true)}
            {!isCreating && !editingRecord && renderList()}
          </>
        )}
      </ScrollView>

      <AppFooter />
      <SlideMenu
        isVisible={isMenuVisible}
        onClose={() => setIsMenuVisible(false)}
        onHomePress={() => navigation.navigate('Home')}
        currentRoute="VehicleMaintenance"
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
    padding: 16,
  },
  warningContainer: {
    backgroundColor: '#FFE5E5',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  warningText: {
    color: '#D32F2F',
    fontSize: 14,
    textAlign: 'center',
  },
  createButton: {
    backgroundColor: '#FF9500',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
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
    padding: 16,
    marginBottom: 16,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#000000',
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#000000',
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000000',
    backgroundColor: '#FFFFFF',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#000000',
  },
  sectionContainer: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F5F5F5',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  sectionContent: {
    padding: 12,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#FF9500',
    borderRadius: 4,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#000000',
    flex: 1,
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
  listContainer: {
    gap: 12,
  },
  listItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    overflow: 'hidden',
  },
  listItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  listItemHeaderContent: {
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
  maintenanceSectionsList: {
    marginTop: 8,
  },
  maintenanceSectionItem: {
    marginBottom: 8,
    paddingLeft: 16,
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
    backgroundColor: '#4CAF50',
  },
  deleteButton: {
    backgroundColor: '#F44336',
  },
  listItemButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: '#F44336',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});

