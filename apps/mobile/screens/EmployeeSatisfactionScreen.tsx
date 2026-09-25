import React, { useState, useCallback, useEffect } from 'react';
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
import { Picker } from '@react-native-picker/picker';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import * as Network from 'expo-network';
import { createEmployeeSatisfaction, updateEmployeeSatisfaction, deleteEmployeeSatisfaction, listEmployeeSatisfactionByCorpo } from '@/hooks/evaluationFunctions';
import { eventBus } from '@/hooks/eventBus';

type EmployeeSatisfactionScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'EmployeeSatisfaction'>;

interface EmployeeSatisfaction {
  id: string;
  id_local: string;
  nombre_empleado: string | null;
  cliente_sede: string | null;
  tiempo_laborado: string | null;
  recibe_uniformes_tiempo: string | null;
  llevo_induccion: string | null;
  calificacion_induccion: string | null;
  recibe_visitas_supervision: string | null;
  recibe_atencion_oficina: string | null;
  problemas_pago_resueltos: string | null;
  equipo_proteccion: string | null;
  que_mejorar: string | null;
  considera_empresa_debe_mejorar: string | null;
  conoce_reportar_accidente: string | null;
  le_gustaria_capacitado: string | null;
  created_at: string;
  synced?: boolean;
}

interface EditingEmployeeSatisfaction {
  id: string | null;
  id_local: string;
  nombre_empleado: string;
  cliente_sede: string;
  tiempo_laborado: string;
  recibe_uniformes_tiempo: string;
  llevo_induccion: string;
  calificacion_induccion: string;
  recibe_visitas_supervision: string;
  recibe_atencion_oficina: string;
  problemas_pago_resueltos: string;
  equipo_proteccion: string;
  que_mejorar: string;
  considera_empresa_debe_mejorar: string;
  conoce_reportar_accidente: string;
  le_gustaria_capacitado: string;
}

export default function EmployeeSatisfactionScreen() {
  const { employee, refreshAccessToken, logout } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<EmployeeSatisfactionScreenNavigationProp>();

  // Data states
  const [satisfactionRecords, setSatisfactionRecords] = useState<EmployeeSatisfaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasCurrentMarca, setHasCurrentMarca] = useState<boolean>(false);

  // Editing state
  const [editingRecord, setEditingRecord] = useState<EditingEmployeeSatisfaction | null>(null);

  // Creating state
  const [isCreating, setIsCreating] = useState(false);
  const [newRecord, setNewRecord] = useState<EditingEmployeeSatisfaction>({
    id: null,
    id_local: '',
    nombre_empleado: '',
    cliente_sede: '',
    tiempo_laborado: '',
    recibe_uniformes_tiempo: '',
    llevo_induccion: '',
    calificacion_induccion: '',
    recibe_visitas_supervision: '',
    recibe_atencion_oficina: '',
    problemas_pago_resueltos: '',
    equipo_proteccion: '',
    que_mejorar: '',
    considera_empresa_debe_mejorar: '',
    conoce_reportar_accidente: '',
    le_gustaria_capacitado: '',
  });

  // Form states
  const [nombreEmpleado, setNombreEmpleado] = useState('');
  const [clienteSede, setClienteSede] = useState('');
  const [tiempoLaborado, setTiempoLaborado] = useState('');
  const [recibeUniformesTiempo, setRecibeUniformesTiempo] = useState('');
  const [llevoInduccion, setLlevoInduccion] = useState('');
  const [calificacionInduccion, setCalificacionInduccion] = useState('');
  const [recibeVisitasSupervision, setRecibeVisitasSupervision] = useState('');
  const [recibeAtencionOficina, setRecibeAtencionOficina] = useState('');
  const [problemasPagoResueltos, setProblemasPagoResueltos] = useState('');
  const [equipoProteccion, setEquipoProteccion] = useState('');
  const [queMejorar, setQueMejorar] = useState('');
  const [consideraEmpresaDebeMejorar, setConsideraEmpresaDebeMejorar] = useState<string[]>([]);
  const [conoceReportarAccidente, setConoceReportarAccidente] = useState('');
  const [leGustariaCapacitado, setLeGustariaCapacitado] = useState('');

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
      fetchSatisfactionRecords();
    }, [])
  );

  useEffect(() => {
    const handler = () => {
      fetchSatisfactionRecords();
    };

    eventBus.on('connectionRestored', handler);
    return () => {
      eventBus.off('connectionRestored', handler);
    };
  }, []);

  const fetchSatisfactionRecords = async () => {
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
        const result = await listEmployeeSatisfactionByCorpo({
          corpo_id: corpoId,
          refreshAccessToken,
          logout,
        });

        if (result.status && result.data) {
          setSatisfactionRecords(result.data as EmployeeSatisfaction[]);
        } else {
          setSatisfactionRecords([]);
        }
      } else {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const satisfactionCache = cache.filter((item: any) => item.type === 'employee_satisfaction');
          setSatisfactionRecords(satisfactionCache);
        } else {
          setSatisfactionRecords([]);
        }
      }
    } catch (err) {
      console.error('Error fetching satisfaction records:', err);
      setError('Error al cargar las encuestas');
      try {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const satisfactionCache = cache.filter((item: any) => item.type === 'employee_satisfaction');
          setSatisfactionRecords(satisfactionCache);
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
    setNewRecord({
      id: null,
      id_local: '',
      nombre_empleado: '',
      cliente_sede: '',
      tiempo_laborado: '',
      recibe_uniformes_tiempo: '',
      llevo_induccion: '',
      calificacion_induccion: '',
      recibe_visitas_supervision: '',
      recibe_atencion_oficina: '',
      problemas_pago_resueltos: '',
      equipo_proteccion: '',
      que_mejorar: '',
      considera_empresa_debe_mejorar: '',
      conoce_reportar_accidente: '',
      le_gustaria_capacitado: '',
    });
    setNombreEmpleado('');
    setClienteSede('');
    setTiempoLaborado('');
    setRecibeUniformesTiempo('');
    setLlevoInduccion('');
    setCalificacionInduccion('');
    setRecibeVisitasSupervision('');
    setRecibeAtencionOficina('');
    setProblemasPagoResueltos('');
    setEquipoProteccion('');
    setQueMejorar('');
    setConsideraEmpresaDebeMejorar([]);
    setConoceReportarAccidente('');
    setLeGustariaCapacitado('');
  };

  const cancelCreating = () => {
    setIsCreating(false);
    setNewRecord({
      id: null,
      id_local: '',
      nombre_empleado: '',
      cliente_sede: '',
      tiempo_laborado: '',
      recibe_uniformes_tiempo: '',
      llevo_induccion: '',
      calificacion_induccion: '',
      recibe_visitas_supervision: '',
      recibe_atencion_oficina: '',
      problemas_pago_resueltos: '',
      equipo_proteccion: '',
      que_mejorar: '',
      considera_empresa_debe_mejorar: '',
      conoce_reportar_accidente: '',
      le_gustaria_capacitado: '',
    });
  };

  const startEditing = (record: EmployeeSatisfaction) => {
    setEditingRecord({
      id: record.id,
      id_local: record.id_local,
      nombre_empleado: record.nombre_empleado || '',
      cliente_sede: record.cliente_sede || '',
      tiempo_laborado: record.tiempo_laborado || '',
      recibe_uniformes_tiempo: record.recibe_uniformes_tiempo || '',
      llevo_induccion: record.llevo_induccion || '',
      calificacion_induccion: record.calificacion_induccion || '',
      recibe_visitas_supervision: record.recibe_visitas_supervision || '',
      recibe_atencion_oficina: record.recibe_atencion_oficina || '',
      problemas_pago_resueltos: record.problemas_pago_resueltos || '',
      equipo_proteccion: record.equipo_proteccion || '',
      que_mejorar: record.que_mejorar || '',
      considera_empresa_debe_mejorar: record.considera_empresa_debe_mejorar || '',
      conoce_reportar_accidente: record.conoce_reportar_accidente || '',
      le_gustaria_capacitado: record.le_gustaria_capacitado || '',
    });
    setNombreEmpleado(record.nombre_empleado || '');
    setClienteSede(record.cliente_sede || '');
    setTiempoLaborado(record.tiempo_laborado || '');
    setRecibeUniformesTiempo(record.recibe_uniformes_tiempo || '');
    setLlevoInduccion(record.llevo_induccion || '');
    setCalificacionInduccion(record.calificacion_induccion || '');
    setRecibeVisitasSupervision(record.recibe_visitas_supervision || '');
    setRecibeAtencionOficina(record.recibe_atencion_oficina || '');
    setProblemasPagoResueltos(record.problemas_pago_resueltos || '');
    setEquipoProteccion(record.equipo_proteccion || '');
    setQueMejorar(record.que_mejorar || '');
    setConsideraEmpresaDebeMejorar(
      record.considera_empresa_debe_mejorar 
        ? record.considera_empresa_debe_mejorar.split(',').filter(s => s.trim())
        : []
    );
    setConoceReportarAccidente(record.conoce_reportar_accidente || '');
    setLeGustariaCapacitado(record.le_gustaria_capacitado || '');
  };

  const cancelEditing = () => {
    setEditingRecord(null);
  };

  const toggleCheckbox = (value: string) => {
    if (consideraEmpresaDebeMejorar.includes(value)) {
      setConsideraEmpresaDebeMejorar(consideraEmpresaDebeMejorar.filter(v => v !== value));
    } else {
      setConsideraEmpresaDebeMejorar([...consideraEmpresaDebeMejorar, value]);
    }
  };

  const saveSatisfactionRecord = async () => {
    if (!nombreEmpleado.trim()) {
      Alert.alert('Error', 'El nombre del empleado es requerido');
      return;
    }
    if (!clienteSede.trim()) {
      Alert.alert('Error', 'El cliente y sede es requerido');
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
      '¿Estás seguro de que deseas guardar esta encuesta de satisfacción?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const requestData = {
                marca_id: currentMarcaData.id,
                nombre_empleado: nombreEmpleado.trim(),
                cliente_sede: clienteSede.trim(),
                tiempo_laborado: tiempoLaborado.trim() || null,
                recibe_uniformes_tiempo: recibeUniformesTiempo.trim() || null,
                llevo_induccion: llevoInduccion.trim() || null,
                calificacion_induccion: calificacionInduccion.trim() || null,
                recibe_visitas_supervision: recibeVisitasSupervision.trim() || null,
                recibe_atencion_oficina: recibeAtencionOficina.trim() || null,
                problemas_pago_resueltos: problemasPagoResueltos.trim() || null,
                equipo_proteccion: equipoProteccion.trim() || null,
                que_mejorar: queMejorar.trim() || null,
                considera_empresa_debe_mejorar: consideraEmpresaDebeMejorar.length > 0 
                  ? consideraEmpresaDebeMejorar.join(',') 
                  : null,
                conoce_reportar_accidente: conoceReportarAccidente.trim() || null,
                le_gustaria_capacitado: leGustariaCapacitado.trim() || null,
              };

              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await createEmployeeSatisfaction({
                  requestData,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Encuesta de satisfacción guardada correctamente');
                  cancelCreating();
                  fetchSatisfactionRecords();
                } else {
                  Alert.alert('Error', result.message || 'Error al guardar la encuesta de satisfacción');
                }
              } else {
                const localId = generateRandomId();

                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: localId,
                  action: 'create',
                  type: 'employee_satisfaction',
                  payload: requestData,
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                const cache = cacheStr ? JSON.parse(cacheStr) : [];

                const newRecordCache: EmployeeSatisfaction = {
                  id: '',
                  id_local: localId,
                  nombre_empleado: nombreEmpleado.trim(),
                  cliente_sede: clienteSede.trim(),
                  tiempo_laborado: tiempoLaborado.trim() || null,
                  recibe_uniformes_tiempo: recibeUniformesTiempo.trim() || null,
                  llevo_induccion: llevoInduccion.trim() || null,
                  calificacion_induccion: calificacionInduccion.trim() || null,
                  recibe_visitas_supervision: recibeVisitasSupervision.trim() || null,
                  recibe_atencion_oficina: recibeAtencionOficina.trim() || null,
                  problemas_pago_resueltos: problemasPagoResueltos.trim() || null,
                  equipo_proteccion: equipoProteccion.trim() || null,
                  que_mejorar: queMejorar.trim() || null,
                  considera_empresa_debe_mejorar: consideraEmpresaDebeMejorar.length > 0 
                    ? consideraEmpresaDebeMejorar.join(',') 
                    : null,
                  conoce_reportar_accidente: conoceReportarAccidente.trim() || null,
                  le_gustaria_capacitado: leGustariaCapacitado.trim() || null,
                  created_at: new Date().toISOString(),
                  synced: false,
                };

                cache.push({ ...newRecordCache, type: 'employee_satisfaction' });
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(cache));

                Alert.alert('Modo Offline', 'Encuesta de satisfacción registrada localmente. Se sincronizará cuando haya conexión.');
                cancelCreating();
                fetchSatisfactionRecords();
              }
            } catch (err) {
              console.error('Error saving satisfaction record:', err);
              Alert.alert('Error', 'No se pudo guardar la encuesta de satisfacción');
            }
          },
        },
      ]
    );
  };

  const updateSatisfactionRecordHandler = async () => {
    if (!editingRecord) return;

    if (!nombreEmpleado.trim()) {
      Alert.alert('Error', 'El nombre del empleado es requerido');
      return;
    }
    if (!clienteSede.trim()) {
      Alert.alert('Error', 'El cliente y sede es requerido');
      return;
    }

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas actualizar esta encuesta de satisfacción?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const requestData = {
                nombre_empleado: nombreEmpleado.trim(),
                cliente_sede: clienteSede.trim(),
                tiempo_laborado: tiempoLaborado.trim() || null,
                recibe_uniformes_tiempo: recibeUniformesTiempo.trim() || null,
                llevo_induccion: llevoInduccion.trim() || null,
                calificacion_induccion: calificacionInduccion.trim() || null,
                recibe_visitas_supervision: recibeVisitasSupervision.trim() || null,
                recibe_atencion_oficina: recibeAtencionOficina.trim() || null,
                problemas_pago_resueltos: problemasPagoResueltos.trim() || null,
                equipo_proteccion: equipoProteccion.trim() || null,
                que_mejorar: queMejorar.trim() || null,
                considera_empresa_debe_mejorar: consideraEmpresaDebeMejorar.length > 0 
                  ? consideraEmpresaDebeMejorar.join(',') 
                  : null,
                conoce_reportar_accidente: conoceReportarAccidente.trim() || null,
                le_gustaria_capacitado: leGustariaCapacitado.trim() || null,
              };

              const isConnected = await getConnectionStatus();
              const recordId = editingRecord.id || editingRecord.id_local;

              if (isConnected && editingRecord.id && !editingRecord.id.startsWith('local-')) {
                const result = await updateEmployeeSatisfaction({
                  id: editingRecord.id,
                  requestData,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Encuesta de satisfacción actualizada correctamente');
                  cancelEditing();
                  fetchSatisfactionRecords();
                } else {
                  Alert.alert('Error', result.message || 'Error al actualizar la encuesta de satisfacción');
                }
              } else {
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: recordId,
                  action: 'update',
                  type: 'employee_satisfaction',
                  payload: requestData,
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                if (cacheStr) {
                  const cache = JSON.parse(cacheStr);
                  const updatedCache = cache.map((item: any) => {
                    if ((item.id === recordId || item.id_local === recordId) && item.type === 'employee_satisfaction') {
                      return {
                        ...item,
                        nombre_empleado: nombreEmpleado.trim(),
                        cliente_sede: clienteSede.trim(),
                        tiempo_laborado: tiempoLaborado.trim() || null,
                        recibe_uniformes_tiempo: recibeUniformesTiempo.trim() || null,
                        llevo_induccion: llevoInduccion.trim() || null,
                        calificacion_induccion: calificacionInduccion.trim() || null,
                        recibe_visitas_supervision: recibeVisitasSupervision.trim() || null,
                        recibe_atencion_oficina: recibeAtencionOficina.trim() || null,
                        problemas_pago_resueltos: problemasPagoResueltos.trim() || null,
                        equipo_proteccion: equipoProteccion.trim() || null,
                        que_mejorar: queMejorar.trim() || null,
                        considera_empresa_debe_mejorar: consideraEmpresaDebeMejorar.length > 0 
                          ? consideraEmpresaDebeMejorar.join(',') 
                          : null,
                        conoce_reportar_accidente: conoceReportarAccidente.trim() || null,
                        le_gustaria_capacitado: leGustariaCapacitado.trim() || null,
                      };
                    }
                    return item;
                  });
                  await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                }

                Alert.alert('Modo Offline', 'Encuesta de satisfacción actualizada localmente. Se sincronizará cuando haya conexión.');
                cancelEditing();
                fetchSatisfactionRecords();
              }
            } catch (err) {
              console.error('Error updating satisfaction record:', err);
              Alert.alert('Error', 'No se pudo actualizar la encuesta de satisfacción');
            }
          },
        },
      ]
    );
  };

  const deleteSatisfactionRecord = async (record: EmployeeSatisfaction) => {
    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas eliminar esta encuesta de satisfacción?',
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
                const result = await deleteEmployeeSatisfaction({
                  id: record.id,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Encuesta de satisfacción eliminada correctamente');
                  fetchSatisfactionRecords();
                } else {
                  Alert.alert('Error', result.message || 'Error al eliminar la encuesta de satisfacción');
                }
              } else {
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: recordId,
                  action: 'delete',
                  type: 'employee_satisfaction',
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

                Alert.alert('Modo Offline', 'Encuesta de satisfacción eliminada localmente. Se sincronizará cuando haya conexión.');
                fetchSatisfactionRecords();
              }
            } catch (err) {
              console.error('Error deleting satisfaction record:', err);
              Alert.alert('Error', 'No se pudo eliminar la encuesta de satisfacción');
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

  const renderForm = (isEditing: boolean = false) => {
    const improvementOptions = [
      'Comunicación',
      'Supervisión',
      'Respuestas de Pagos',
      'Trato al personal',
      'Entrega de Uniformes',
      'Mejora de Clima Organizacional en los Puestos',
      'Reuniones con el personal'
    ];

    return (
      <ThemedView style={styles.formCard}>
        <ThemedText style={styles.formTitle}>
          {isEditing ? 'Editar Encuesta de Satisfacción' : 'Nueva Encuesta de Satisfacción'}
        </ThemedText>

        {/* Nombre del Empleado */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Nombre del Empleado *</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="Nombre completo del empleado"
            placeholderTextColor="#999"
            value={nombreEmpleado}
            onChangeText={setNombreEmpleado}
          />
        </ThemedView>

        {/* Cliente y Sede */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>En que Cliente y sede labora actualmente *</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="Ejemplo: Mag Carrillo, Mag Bagaces, Hospital William Allen"
            placeholderTextColor="#999"
            value={clienteSede}
            onChangeText={setClienteSede}
          />
        </ThemedView>

        {/* Tiempo Laborado */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Tiempo laborado en la empresa *</ThemedText>
          <ThemedView style={styles.pickerContainer}>
            <Picker
              selectedValue={tiempoLaborado}
              onValueChange={setTiempoLaborado}
              style={styles.picker}
            >
              <Picker.Item label="Seleccionar" value="" />
              <Picker.Item label="De 1 mes pero menor a 1 año" value="De 1 mes pero menor a 1 año" />
              <Picker.Item label="De 1 año pero menor a 2" value="De 1 año pero menor a 2" />
              <Picker.Item label="Mas de 2 año" value="Mas de 2 año" />
            </Picker>
          </ThemedView>
        </ThemedView>

        {/* Recibe Uniformes a Tiempo */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Recibe a tiempo sus Uniformes *</ThemedText>
          <ThemedView style={styles.pickerContainer}>
            <Picker
              selectedValue={recibeUniformesTiempo}
              onValueChange={setRecibeUniformesTiempo}
              style={styles.picker}
            >
              <Picker.Item label="Seleccionar" value="" />
              <Picker.Item label="Nunca" value="Nunca" />
              <Picker.Item label="Casi Nunca" value="Casi Nunca" />
              <Picker.Item label="Aveces" value="Aveces" />
              <Picker.Item label="Siempre" value="Siempre" />
            </Picker>
          </ThemedView>
        </ThemedView>

        {/* Llevó Inducción */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Al ingresar a la empresa llevo la induccion del puesto *</ThemedText>
          <ThemedView style={styles.pickerContainer}>
            <Picker
              selectedValue={llevoInduccion}
              onValueChange={setLlevoInduccion}
              style={styles.picker}
            >
              <Picker.Item label="Seleccionar" value="" />
              <Picker.Item label="NO" value="NO" />
              <Picker.Item label="SI" value="SI" />
            </Picker>
          </ThemedView>
        </ThemedView>

        {/* Calificación de Inducción */}
        {llevoInduccion === 'SI' && (
          <ThemedView style={styles.formGroup}>
            <ThemedText style={styles.formLabel}>La induccion del puesto como la califica *</ThemedText>
            <ThemedView style={styles.pickerContainer}>
              <Picker
                selectedValue={calificacionInduccion}
                onValueChange={setCalificacionInduccion}
                style={styles.picker}
              >
                <Picker.Item label="Seleccionar" value="" />
                <Picker.Item label="Excelente" value="Excelente" />
                <Picker.Item label="Buena" value="Buena" />
                <Picker.Item label="Regular" value="Regular" />
                <Picker.Item label="Mala" value="Mala" />
                <Picker.Item label="Debe Mejorar" value="Debe Mejorar" />
              </Picker>
            </ThemedView>
          </ThemedView>
        )}

        {/* Recibe Visitas de Supervisión */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Recibe visitas de Supervision en su Puesto *</ThemedText>
          <ThemedView style={styles.pickerContainer}>
            <Picker
              selectedValue={recibeVisitasSupervision}
              onValueChange={setRecibeVisitasSupervision}
              style={styles.picker}
            >
              <Picker.Item label="Seleccionar" value="" />
              <Picker.Item label="Nunca" value="Nunca" />
              <Picker.Item label="Casi Nunca" value="Casi Nunca" />
              <Picker.Item label="Aveces" value="Aveces" />
              <Picker.Item label="Siempre" value="Siempre" />
            </Picker>
          </ThemedView>
        </ThemedView>

        {/* Recibe Atención de Oficina */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Recibe atencion por parte de la oficina *</ThemedText>
          <ThemedView style={styles.pickerContainer}>
            <Picker
              selectedValue={recibeAtencionOficina}
              onValueChange={setRecibeAtencionOficina}
              style={styles.picker}
            >
              <Picker.Item label="Seleccionar" value="" />
              <Picker.Item label="Nunca" value="Nunca" />
              <Picker.Item label="Casi Nunca" value="Casi Nunca" />
              <Picker.Item label="Aveces" value="Aveces" />
              <Picker.Item label="Siempre" value="Siempre" />
            </Picker>
          </ThemedView>
        </ThemedView>

        {/* Problemas de Pago Resueltos */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Sus problemas de pago son resueltos con rapidez *</ThemedText>
          <ThemedView style={styles.pickerContainer}>
            <Picker
              selectedValue={problemasPagoResueltos}
              onValueChange={setProblemasPagoResueltos}
              style={styles.picker}
            >
              <Picker.Item label="Seleccionar" value="" />
              <Picker.Item label="Nunca" value="Nunca" />
              <Picker.Item label="Casi Nunca" value="Casi Nunca" />
              <Picker.Item label="Siempre" value="Siempre" />
            </Picker>
          </ThemedView>
        </ThemedView>

        {/* Equipo de Protección */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Se le brinda el equipo de proteccion necesaria para sus labores *</ThemedText>
          <ThemedView style={styles.pickerContainer}>
            <Picker
              selectedValue={equipoProteccion}
              onValueChange={setEquipoProteccion}
              style={styles.picker}
            >
              <Picker.Item label="Seleccionar" value="" />
              <Picker.Item label="Nunca" value="Nunca" />
              <Picker.Item label="Casi Nunca" value="Casi Nunca" />
              <Picker.Item label="Siempre" value="Siempre" />
            </Picker>
          </ThemedView>
        </ThemedView>

        {/* Qué Mejorar */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Que considera usted que se deba mejorar en funcion a la parte de la respuesta deseada</ThemedText>
          <TextInput
            style={[styles.formInput, styles.textArea]}
            placeholder="Tu respuesta"
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            value={queMejorar}
            onChangeText={setQueMejorar}
          />
        </ThemedView>

        {/* Considera que la Empresa Debe Mejorar */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Considera usted que la empresa deba mejorar en algunas de las siguientes opciones</ThemedText>
          {improvementOptions.map((option) => (
            <TouchableOpacity
              key={option}
              style={styles.checkboxContainer}
              onPress={() => toggleCheckbox(option)}
            >
              <View style={styles.checkbox}>
                {consideraEmpresaDebeMejorar.includes(option) && (
                  <Ionicons name="checkmark" size={20} color="#FF9500" />
                )}
              </View>
              <ThemedText style={styles.checkboxLabel}>{option}</ThemedText>
            </TouchableOpacity>
          ))}
        </ThemedView>

        {/* Conoce Reportar Accidente */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Conoce usted como reportar un accidente *</ThemedText>
          <ThemedView style={styles.pickerContainer}>
            <Picker
              selectedValue={conoceReportarAccidente}
              onValueChange={setConoceReportarAccidente}
              style={styles.picker}
            >
              <Picker.Item label="Seleccionar" value="" />
              <Picker.Item label="No" value="No" />
              <Picker.Item label="Si" value="Si" />
            </Picker>
          </ThemedView>
        </ThemedView>

        {/* Le Gustaría Ser Capacitado */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Le gustaria ser capacitado en la forma de reportar accidentes *</ThemedText>
          <ThemedView style={styles.pickerContainer}>
            <Picker
              selectedValue={leGustariaCapacitado}
              onValueChange={setLeGustariaCapacitado}
              style={styles.picker}
            >
              <Picker.Item label="Seleccionar" value="" />
              <Picker.Item label="No" value="No" />
              <Picker.Item label="Si" value="Si" />
            </Picker>
          </ThemedView>
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
            onPress={isEditing ? updateSatisfactionRecordHandler : saveSatisfactionRecord}
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
          <ThemedText style={styles.loadingText}>Cargando encuestas...</ThemedText>
        </ThemedView>
      );
    }

    if (error && satisfactionRecords.length === 0) {
      return (
        <ThemedView style={styles.centerContainer}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        </ThemedView>
      );
    }

    if (satisfactionRecords.length === 0) {
      return (
        <ThemedView style={styles.centerContainer}>
          <ThemedText style={styles.emptyText}>No hay encuestas de satisfacción registradas</ThemedText>
        </ThemedView>
      );
    }

    return (
      <ThemedView style={styles.listContainer}>
        {satisfactionRecords.map((record) => {
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
                    {record.nombre_empleado || 'Sin nombre'}
                  </ThemedText>
                  <ThemedText style={styles.listItemSubtitle}>
                    {record.cliente_sede || 'Sin cliente/sede'}
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
                    <ThemedText style={styles.detailLabel}>Tiempo laborado: </ThemedText>
                    {record.tiempo_laborado || 'No especificado'}
                  </ThemedText>
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Recibe uniformes a tiempo: </ThemedText>
                    {record.recibe_uniformes_tiempo || 'No especificado'}
                  </ThemedText>
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Llevó inducción: </ThemedText>
                    {record.llevo_induccion || 'No especificado'}
                  </ThemedText>
                  {record.calificacion_induccion && (
                    <ThemedText style={styles.detailText}>
                      <ThemedText style={styles.detailLabel}>Calificación inducción: </ThemedText>
                      {record.calificacion_induccion}
                    </ThemedText>
                  )}
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Recibe visitas supervisión: </ThemedText>
                    {record.recibe_visitas_supervision || 'No especificado'}
                  </ThemedText>
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Recibe atención oficina: </ThemedText>
                    {record.recibe_atencion_oficina || 'No especificado'}
                  </ThemedText>
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Problemas pago resueltos: </ThemedText>
                    {record.problemas_pago_resueltos || 'No especificado'}
                  </ThemedText>
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Equipo protección: </ThemedText>
                    {record.equipo_proteccion || 'No especificado'}
                  </ThemedText>
                  {record.que_mejorar && (
                    <ThemedText style={styles.detailText}>
                      <ThemedText style={styles.detailLabel}>Qué mejorar: </ThemedText>
                      {record.que_mejorar}
                    </ThemedText>
                  )}
                  {record.considera_empresa_debe_mejorar && (
                    <ThemedText style={styles.detailText}>
                      <ThemedText style={styles.detailLabel}>Considera empresa debe mejorar: </ThemedText>
                      {record.considera_empresa_debe_mejorar}
                    </ThemedText>
                  )}
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Conoce reportar accidente: </ThemedText>
                    {record.conoce_reportar_accidente || 'No especificado'}
                  </ThemedText>
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Le gustaría capacitado: </ThemedText>
                    {record.le_gustaria_capacitado || 'No especificado'}
                  </ThemedText>
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Fecha: </ThemedText>
                    {new Date(record.created_at).toLocaleDateString('es-CR')}
                  </ThemedText>

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
                      onPress={() => deleteSatisfactionRecord(record)}
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
      <AppHeader onMenuPress={() => setIsMenuVisible(true)} title="Satisfacción del Personal" />

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
                <ThemedText style={styles.createButtonText}>Nueva Encuesta</ThemedText>
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
        currentRoute="EmployeeSatisfaction"
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
  textArea: {
    minHeight: 100,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    color: '#000000',
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

