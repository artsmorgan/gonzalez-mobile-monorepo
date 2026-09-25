import React, { useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
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
  createCommunicationPlan,
  updateCommunicationPlan,
  deleteCommunicationPlan,
  listCommunicationPlanByCorpo,
} from '@/hooks/evaluationFunctions';
import { eventBus } from '@/hooks/eventBus';

type CommunicationPlanScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'CommunicationPlan'>;

interface FechaComunicacion {
  mes: string;
  dia: string;
  informacion: string;
}

interface Comunicacion {
  tipo: 'INTERNA' | 'EXTERNA';
  asunto_comunicar: string;
  publico: string;
  medios_instrumentos: string;
  comunicador: string;
  evidencia: string;
  registros: string;
  fechas: FechaComunicacion[];
}

interface CommunicationPlan {
  id: string;
  id_local: string;
  comunicaciones: string | null;
  responsable_aprobacion: string | null;
  puesto_aprobacion: string | null;
  fecha_aprobacion: string | null;
  created_at: string;
  synced?: boolean;
}

interface EditingCommunicationPlan {
  id: string | null;
  id_local: string;
  comunicaciones: string;
  responsable_aprobacion: string;
  puesto_aprobacion: string;
  fecha_aprobacion: string;
}

const MESES = [
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

const DIAS = Array.from({ length: 31 }, (_, i) => ({
  label: `${i + 1}`,
  value: `${i + 1}`,
}));

export default function CommunicationPlanScreen() {
  const { employee, refreshAccessToken, logout } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<CommunicationPlanScreenNavigationProp>();

  // Data states
  const [plans, setPlans] = useState<CommunicationPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasCurrentMarca, setHasCurrentMarca] = useState<boolean>(false);

  // Editing state
  const [isCreating, setIsCreating] = useState(false);
  const [editingPlan, setEditingPlan] = useState<EditingCommunicationPlan | null>(null);

  // Form fields
  const [comunicaciones, setComunicaciones] = useState<Comunicacion[]>([]);
  const [expandedIndices, setExpandedIndices] = useState<number[]>([]);
  const [responsableAprobacion, setResponsableAprobacion] = useState('');
  const [puestoAprobacion, setPuestoAprobacion] = useState('');
  const [fechaAprobacion, setFechaAprobacion] = useState('');
  const [fechaAprobacionDate, setFechaAprobacionDate] = useState(new Date());
  const [showFechaAprobacionPicker, setShowFechaAprobacionPicker] = useState(false);

  const getConnectionStatus = async (): Promise<boolean> => {
    try {
      const networkState = await Network.getNetworkStateAsync();
      return networkState.isConnected ?? false;
    } catch (error) {
      console.error('Error checking network:', error);
      return false;
    }
  };

  const generateRandomId = (): string => {
    return `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const fetchPlans = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const currentMarca = await AsyncStorage.getItem('current_marca');
      if (!currentMarca) {
        setError('No se encontró la marca actual');
        setIsLoading(false);
        setHasCurrentMarca(false);
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
        const result = await listCommunicationPlanByCorpo({
          corpo_id: corpoId,
          refreshAccessToken,
          logout,
        });

        if (result.status && result.data) {
          setPlans(result.data as CommunicationPlan[]);
        } else {
          setPlans([]);
        }
      } else {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const plansCache = cache.filter((item: any) => item.type === 'communication_plan');
          setPlans(plansCache);
        } else {
          setPlans([]);
        }
      }
    } catch (err) {
      console.error('Error fetching plans:', err);
      setError('Error al cargar los planes de comunicación');
      try {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const plansCache = cache.filter((item: any) => item.type === 'communication_plan');
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
    setComunicaciones([]);
    setExpandedIndices([]);
    setResponsableAprobacion('');
    setPuestoAprobacion('');
    setFechaAprobacion('');
    setFechaAprobacionDate(new Date());
    setShowFechaAprobacionPicker(false);
  };

  const handleFechaAprobacionChange = (event: any, selectedDate?: Date) => {
    setShowFechaAprobacionPicker(Platform.OS === 'ios');
    if (selectedDate) {
      setFechaAprobacionDate(selectedDate);
      const formattedDate = selectedDate.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      setFechaAprobacion(formattedDate);
    }
  };

  const startCreating = () => {
    setIsCreating(true);
    setEditingPlan(null);
    resetForm();
  };

  const cancelCreating = () => {
    setIsCreating(false);
    resetForm();
  };

  const startEditing = (plan: CommunicationPlan) => {
    setIsCreating(false);
    setEditingPlan({
      id: plan.id,
      id_local: plan.id_local,
      comunicaciones: plan.comunicaciones || '',
      responsable_aprobacion: plan.responsable_aprobacion || '',
      puesto_aprobacion: plan.puesto_aprobacion || '',
      fecha_aprobacion: plan.fecha_aprobacion || '',
    });

    if (plan.comunicaciones) {
      try {
        const parsed = JSON.parse(plan.comunicaciones);
        setComunicaciones(parsed);
      } catch {
        setComunicaciones([]);
      }
    } else {
      setComunicaciones([]);
    }
    setResponsableAprobacion(plan.responsable_aprobacion || '');
    setPuestoAprobacion(plan.puesto_aprobacion || '');
    setFechaAprobacion(plan.fecha_aprobacion || '');
    if (plan.fecha_aprobacion) {
      try {
        const date = new Date(plan.fecha_aprobacion);
        if (!isNaN(date.getTime())) {
          setFechaAprobacionDate(date);
        }
      } catch {
        // Si no se puede parsear, usar fecha actual
      }
    }
  };

  const cancelEditing = () => {
    setEditingPlan(null);
    resetForm();
  };

  const addComunicacion = (tipo: 'INTERNA' | 'EXTERNA') => {
    const newComunicacion: Comunicacion = {
      tipo,
      asunto_comunicar: '',
      publico: '',
      medios_instrumentos: '',
      comunicador: '',
      evidencia: '',
      registros: '',
      fechas: [],
    };
    setComunicaciones([...comunicaciones, newComunicacion]);
  };

  const removeComunicacion = (index: number) => {
    const updated = [...comunicaciones];
    updated.splice(index, 1);
    setComunicaciones(updated);
    setExpandedIndices(expandedIndices.filter(i => i !== index).map(i => i > index ? i - 1 : i));
  };

  const updateComunicacion = (index: number, field: keyof Comunicacion, value: any) => {
    const updated = [...comunicaciones];
    updated[index] = { ...updated[index], [field]: value };
    setComunicaciones(updated);
  };

  const toggleExpansion = (index: number) => {
    if (expandedIndices.includes(index)) {
      setExpandedIndices(expandedIndices.filter(i => i !== index));
    } else {
      setExpandedIndices([...expandedIndices, index]);
    }
  };

  const addFecha = (comunicacionIndex: number) => {
    const updated = [...comunicaciones];
    updated[comunicacionIndex] = {
      ...updated[comunicacionIndex],
      fechas: [
        ...updated[comunicacionIndex].fechas,
        { mes: '', dia: '', informacion: '' },
      ],
    };
    setComunicaciones(updated);
  };

  const removeFecha = (comunicacionIndex: number, fechaIndex: number) => {
    const updated = [...comunicaciones];
    updated[comunicacionIndex] = {
      ...updated[comunicacionIndex],
      fechas: updated[comunicacionIndex].fechas.filter((_, i) => i !== fechaIndex),
    };
    setComunicaciones(updated);
  };

  const updateFecha = (comunicacionIndex: number, fechaIndex: number, field: keyof FechaComunicacion, value: string) => {
    const updated = [...comunicaciones];
    const fechas = [...updated[comunicacionIndex].fechas];
    fechas[fechaIndex] = { ...fechas[fechaIndex], [field]: value };
    updated[comunicacionIndex] = { ...updated[comunicacionIndex], fechas };
    setComunicaciones(updated);
  };

  const savePlanHandler = async () => {
    const currentMarca = await AsyncStorage.getItem('current_marca');
    if (!currentMarca) {
      Alert.alert('Error', 'No se encontró la marca actual');
      return;
    }

    const currentMarcaData = JSON.parse(currentMarca);

    Alert.alert('Confirmar', '¿Estás seguro de que deseas guardar este plan de comunicación?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: async () => {
          try {
            const requestData = {
              marca_id: currentMarcaData.id,
              comunicaciones: JSON.stringify(comunicaciones),
              responsable_aprobacion: responsableAprobacion.trim() || null,
              puesto_aprobacion: puestoAprobacion.trim() || null,
              fecha_aprobacion: fechaAprobacion.trim() || null,
            };

            const isConnected = await getConnectionStatus();

            if (isConnected) {
              const result = await createCommunicationPlan({
                requestData,
                refreshAccessToken,
                logout,
              });

              if (result.status) {
                Alert.alert('Éxito', 'Plan de comunicación creado correctamente');
                setIsCreating(false);
                resetForm();
                fetchPlans();
              } else {
                Alert.alert('Error', result.message || 'Error al crear el plan de comunicación');
              }
            } else {
              const localId = generateRandomId();

              const actionsStr = await AsyncStorage.getItem('evaluations_actions');
              const actions = actionsStr ? JSON.parse(actionsStr) : [];
              actions.push({
                id: localId,
                action: 'create',
                type: 'communication_plan',
                payload: requestData,
                synced: false,
              });
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

              const cacheStr = await AsyncStorage.getItem('evaluations_cache');
              const cache = cacheStr ? JSON.parse(cacheStr) : [];

              const newPlanCache: CommunicationPlan = {
                id: '',
                id_local: localId,
                comunicaciones: JSON.stringify(comunicaciones),
                responsable_aprobacion: responsableAprobacion.trim() || null,
                puesto_aprobacion: puestoAprobacion.trim() || null,
                fecha_aprobacion: fechaAprobacion.trim() || null,
                created_at: new Date().toISOString(),
                synced: false,
              };

              cache.push({ ...newPlanCache, type: 'communication_plan' });
              await AsyncStorage.setItem('evaluations_cache', JSON.stringify(cache));

              Alert.alert('Modo Offline', 'Plan de comunicación registrado localmente. Se sincronizará cuando haya conexión.');
              setIsCreating(false);
              resetForm();
              fetchPlans();
            }
          } catch (err) {
            console.error('Error saving plan:', err);
            Alert.alert('Error', 'No se pudo guardar el plan de comunicación');
          }
        },
      },
    ]);
  };

  const updatePlanHandler = async () => {
    if (!editingPlan) return;

    const planId = editingPlan.id || editingPlan.id_local;
    if (!planId) {
      Alert.alert('Error', 'ID de plan no encontrado para actualizar');
      return;
    }

    Alert.alert('Confirmar', '¿Estás seguro de que deseas actualizar este plan de comunicación?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: async () => {
          try {
            const requestData = {
              comunicaciones: JSON.stringify(comunicaciones),
              responsable_aprobacion: responsableAprobacion.trim() || null,
              puesto_aprobacion: puestoAprobacion.trim() || null,
              fecha_aprobacion: fechaAprobacion.trim() || null,
            };

            const isConnected = await getConnectionStatus();

            if (isConnected) {
              const result = await updateCommunicationPlan({
                id: planId,
                requestData,
                refreshAccessToken,
                logout,
              });

              if (result.status) {
                Alert.alert('Éxito', 'Plan de comunicación actualizado correctamente');
                cancelEditing();
                fetchPlans();
              } else {
                Alert.alert('Error', result.message || 'Error al actualizar el plan de comunicación');
              }
            } else {
              const actionsStr = await AsyncStorage.getItem('evaluations_actions');
              const actions = actionsStr ? JSON.parse(actionsStr) : [];
              actions.push({
                id: planId,
                action: 'update',
                type: 'communication_plan',
                payload: requestData,
                synced: false,
              });
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

              const cacheStr = await AsyncStorage.getItem('evaluations_cache');
              if (cacheStr) {
                const cache = JSON.parse(cacheStr);
                const updatedCache = cache.map((item: any) => {
                  if ((item.id === planId || item.id_local === planId) && item.type === 'communication_plan') {
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

              Alert.alert('Actualizado offline', 'El plan de comunicación se actualizó localmente y se sincronizará cuando haya conexión');
              cancelEditing();
              fetchPlans();
            }
          } catch (err) {
            console.error('Error updating plan:', err);
            Alert.alert('Error', 'Error al actualizar el plan de comunicación');
          }
        },
      },
    ]);
  };

  const deletePlanHandler = async (plan: CommunicationPlan) => {
    Alert.alert('Confirmar', '¿Estás seguro de que deseas eliminar este plan de comunicación?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            const isConnected = await getConnectionStatus();
            const recordId = plan.id && !plan.id.startsWith('local_') ? plan.id : plan.id_local;

            if (isConnected && plan.id && !plan.id.startsWith('local_')) {
              const result = await deleteCommunicationPlan({
                id: recordId,
                refreshAccessToken,
                logout,
              });

              if (result.status) {
                Alert.alert('Éxito', 'Plan de comunicación eliminado correctamente');
                fetchPlans();
              } else {
                Alert.alert('Error', result.message || 'Error al eliminar el plan de comunicación');
              }
            } else {
              const actionsStr = await AsyncStorage.getItem('evaluations_actions');
              const actions = actionsStr ? JSON.parse(actionsStr) : [];
              actions.push({
                id: recordId,
                action: 'delete',
                payload: {},
                type: 'communication_plan',
                synced: false,
              });
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

              const cacheStr = await AsyncStorage.getItem('evaluations_cache');
              if (cacheStr) {
                const cache = JSON.parse(cacheStr);
                const updatedCache = cache.filter((item: any) => !((item.id === recordId || item.id_local === recordId) && item.type === 'communication_plan'));
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
              }

              Alert.alert('Eliminado offline', 'El plan de comunicación se eliminó localmente y se sincronizará cuando haya conexión');
              fetchPlans();
            }
          } catch (err) {
            console.error('Error deleting plan:', err);
            Alert.alert('Error', 'Error al eliminar el plan de comunicación');
          }
        },
      },
    ]);
  };

  const handleHomePress = () => {
    navigation.navigate('Home');
  };

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'record': return <Ionicons name="document-text" size={24} color='#000000' />;
      case 'add': return <Ionicons name="add" size={24} color='#FFFFFF' />;
      case 'cancel': return <Ionicons name="close" size={24} color='#FFFFFF' />;
      case 'confirm': return <Ionicons name="checkmark" size={24} color='#FFFFFF' />;
      case 'delete': return <Ionicons name="trash" size={24} color='#FFFFFF' />;
      case 'edit': return <Ionicons name="pencil" size={20} color="#FFFFFF" />;
      default: return <Ionicons name="document-text" size={24} color='#000000' />;
    }
  };

  const renderPlanList = () => {
    if (isLoading) {
      return (
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Cargando planes de comunicación...</ThemedText>
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
          <ThemedText style={styles.emptyText}>No hay planes de comunicación registrados.</ThemedText>
        </ThemedView>
      );
    }

    return (
      <ThemedView style={styles.listContainer}>
        {plans.map((plan) => (
          <ThemedView key={plan.id || plan.id_local} style={styles.listItem}>
            <ThemedView style={styles.listItemHeader}>
              <ThemedView style={styles.listItemContent}>
                <ThemedText style={styles.listItemTitle}>
                  Plan de Comunicación
                </ThemedText>
                {plan.responsable_aprobacion && (
                  <ThemedText style={styles.listItemSubtitle}>
                    Responsable: {plan.responsable_aprobacion}
                  </ThemedText>
                )}
                {!plan.synced && (
                  <ThemedText style={styles.offlineBadge}>Sin sincronizar</ThemedText>
                )}
              </ThemedView>
              <ThemedView style={styles.listItemActions}>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => startEditing(plan)}
                >
                  {getActionIcon('edit')}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deletePlanHandler(plan)}
                >
                  {getActionIcon('delete')}
                </TouchableOpacity>
              </ThemedView>
            </ThemedView>
          </ThemedView>
        ))}
      </ThemedView>
    );
  };

  const comunicacionesInternas = useMemo(() => comunicaciones.filter(c => c.tipo === 'INTERNA'), [comunicaciones]);
  const comunicacionesExternas = useMemo(() => comunicaciones.filter(c => c.tipo === 'EXTERNA'), [comunicaciones]);

  const renderComunicacion = (comunicacion: Comunicacion, index: number, globalIndex: number) => {
    const isExpanded = expandedIndices.includes(globalIndex);
    
    return (
      <ThemedView key={globalIndex} style={styles.comunicacionItem}>
        <TouchableOpacity
          style={styles.comunicacionItemHeader}
          onPress={() => toggleExpansion(globalIndex)}
        >
          <ThemedText style={styles.comunicacionItemTitle}>
            {comunicacion.tipo} - {comunicacion.asunto_comunicar || `Comunicación ${globalIndex + 1}`}
          </ThemedText>
          <ThemedView style={styles.comunicacionItemHeaderActions}>
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color="#000000"
            />
            <TouchableOpacity
              onPress={() => removeComunicacion(globalIndex)}
              style={styles.removeComunicacionButton}
            >
              <Ionicons name="trash" size={18} color="#F44336" />
            </TouchableOpacity>
          </ThemedView>
        </TouchableOpacity>

        {isExpanded && (
          <ThemedView style={styles.comunicacionItemContent}>
            {/* Asunto a comunicar */}
            <ThemedView style={styles.formSection}>
              <ThemedText style={styles.label}>a) ¿Qué comunicar?</ThemedText>
              <TextInput
                style={styles.input}
                value={comunicacion.asunto_comunicar}
                onChangeText={(text) => updateComunicacion(globalIndex, 'asunto_comunicar', text)}
                placeholder="Ingrese el asunto a comunicar"
                placeholderTextColor="#999"
              />
            </ThemedView>

            {/* Público */}
            <ThemedView style={styles.formSection}>
              <ThemedText style={styles.label}>c) ¿A quién comunicar?</ThemedText>
              <TextInput
                style={styles.input}
                value={comunicacion.publico}
                onChangeText={(text) => updateComunicacion(globalIndex, 'publico', text)}
                placeholder="Ingrese el público objetivo"
                placeholderTextColor="#999"
              />
            </ThemedView>

            {/* Medios/Instrumentos */}
            <ThemedView style={styles.formSection}>
              <ThemedText style={styles.label}>d) ¿Cómo comunicar?</ThemedText>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={comunicacion.medios_instrumentos}
                onChangeText={(text) => updateComunicacion(globalIndex, 'medios_instrumentos', text)}
                placeholder="Medios/Instrumentos (reuniones, encuestas, reportes, etc.)"
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
              />
            </ThemedView>

            {/* Comunicador */}
            <ThemedView style={styles.formSection}>
              <ThemedText style={styles.label}>e) ¿Quién comunica?</ThemedText>
              <TextInput
                style={styles.input}
                value={comunicacion.comunicador}
                onChangeText={(text) => updateComunicacion(globalIndex, 'comunicador', text)}
                placeholder="Ingrese el comunicador"
                placeholderTextColor="#999"
              />
            </ThemedView>

            {/* Evidencia */}
            <ThemedView style={styles.formSection}>
              <ThemedText style={styles.label}>Evidencia</ThemedText>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={comunicacion.evidencia}
                onChangeText={(text) => updateComunicacion(globalIndex, 'evidencia', text)}
                placeholder="Ingrese la evidencia"
                placeholderTextColor="#999"
                multiline
                numberOfLines={3}
              />
            </ThemedView>

            {/* Registros */}
            <ThemedView style={styles.formSection}>
              <ThemedText style={styles.label}>Registros (Dirección Intranet / Física)</ThemedText>
              <TextInput
                style={styles.input}
                value={comunicacion.registros}
                onChangeText={(text) => updateComunicacion(globalIndex, 'registros', text)}
                placeholder="Ingrese la dirección de los registros"
                placeholderTextColor="#999"
              />
            </ThemedView>

            {/* Período, circunstancia o fecha */}
            <ThemedView style={styles.formSection}>
              <ThemedText style={styles.label}>b) ¿Cuándo comunicar?</ThemedText>
              {comunicacion.fechas.map((fecha, fechaIndex) => (
                <ThemedView key={fechaIndex} style={styles.fechaItem}>
                  <ThemedView style={styles.fechaContainer}>
                    <ThemedView style={styles.fechaInputsRow}>
                      <View style={styles.pickerContainer}>
                        <Picker
                          selectedValue={fecha.mes}
                          onValueChange={(value) => updateFecha(globalIndex, fechaIndex, 'mes', value)}
                          style={styles.picker}
                        >
                          {MESES.map((mes) => (
                            <Picker.Item key={mes.value} label={mes.label} value={mes.value} />
                          ))}
                        </Picker>
                      </View>
                      <View style={styles.pickerContainer}>
                        <Picker
                          selectedValue={fecha.dia}
                          onValueChange={(value) => updateFecha(globalIndex, fechaIndex, 'dia', value)}
                          style={styles.picker}
                        >
                          <Picker.Item label="Seleccionar día" value="" />
                          {DIAS.map((dia) => (
                            <Picker.Item key={dia.value} label={dia.label} value={dia.value} />
                          ))}
                        </Picker>
                      </View>
                      <TouchableOpacity
                        style={styles.removeFechaButton}
                        onPress={() => removeFecha(globalIndex, fechaIndex)}
                      >
                        <Ionicons name="trash" size={18} color="#F44336" />
                      </TouchableOpacity>
                    </ThemedView>
                    <TextInput
                      style={[styles.input, styles.fechaInfoInput]}
                      value={fecha.informacion}
                      onChangeText={(text) => updateFecha(globalIndex, fechaIndex, 'informacion', text)}
                      placeholder="Información adicional"
                      placeholderTextColor="#999"
                    />
                  </ThemedView>
                </ThemedView>
              ))}
              <TouchableOpacity
                style={styles.addFechaButton}
                onPress={() => addFecha(globalIndex)}
              >
                <Ionicons name="add" size={18} color="#007AFF" />
                <ThemedText style={styles.addFechaButtonText}>Agregar Fecha</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          </ThemedView>
        )}
      </ThemedView>
    );
  };

  const renderForm = () => {
    if (!isCreating && !editingPlan) return null;

    return (
      <ThemedView style={styles.formContainer}>
        <ThemedText style={styles.formTitle}>
          {isCreating ? 'Nuevo Plan de Comunicación' : 'Editar Plan de Comunicación'}
        </ThemedText>

        <ScrollView 
          style={styles.formScrollView} 
          contentContainerStyle={styles.formScrollViewContent}
          showsVerticalScrollIndicator={true}
          nestedScrollEnabled={true}
        >
          {/* Título */}
          <ThemedView style={styles.titleSection}>
            <ThemedText style={styles.mainTitle}>PLAN DE COMUNICACIÓN</ThemedText>
          </ThemedView>

          {/* Sección INTERNA */}
          <ThemedView style={styles.tipoSection}>
            <ThemedView style={styles.tipoHeader}>
              <ThemedText style={styles.tipoTitle}>INTERNA</ThemedText>
              <TouchableOpacity style={styles.addTipoButton} onPress={() => addComunicacion('INTERNA')}>
                <Ionicons name="add" size={20} color="#FFFFFF" />
                <ThemedText style={styles.addTipoButtonText}>Agregar</ThemedText>
              </TouchableOpacity>
            </ThemedView>
            {comunicacionesInternas.map((comunicacion, index) => {
              const globalIndex = comunicaciones.indexOf(comunicacion);
              return renderComunicacion(comunicacion, index, globalIndex);
            })}
          </ThemedView>

          {/* Sección EXTERNA */}
          <ThemedView style={styles.tipoSection}>
            <ThemedView style={styles.tipoHeader}>
              <ThemedText style={styles.tipoTitle}>EXTERNA</ThemedText>
              <TouchableOpacity style={styles.addTipoButton} onPress={() => addComunicacion('EXTERNA')}>
                <Ionicons name="add" size={20} color="#FFFFFF" />
                <ThemedText style={styles.addTipoButtonText}>Agregar</ThemedText>
              </TouchableOpacity>
            </ThemedView>
            {comunicacionesExternas.map((comunicacion, index) => {
              const globalIndex = comunicaciones.indexOf(comunicacion);
              return renderComunicacion(comunicacion, index, globalIndex);
            })}
          </ThemedView>

          {/* Sección de Aprobación */}
          <ThemedView style={styles.approvalSection}>
            <ThemedText style={styles.approvalTitle}>Responsable de aprobación</ThemedText>
            
            {/* Responsable */}
            <ThemedView style={styles.formSection}>
              <ThemedText style={styles.label}>Responsable de aprobación:</ThemedText>
              <TextInput
                style={styles.input}
                value={responsableAprobacion}
                onChangeText={setResponsableAprobacion}
                placeholder="Ingrese el responsable de aprobación"
                placeholderTextColor="#999"
              />
            </ThemedView>

            {/* Puesto */}
            <ThemedView style={styles.formSection}>
              <ThemedText style={styles.label}>Puesto:</ThemedText>
              <TextInput
                style={styles.input}
                value={puestoAprobacion}
                onChangeText={setPuestoAprobacion}
                placeholder="Ingrese el puesto"
                placeholderTextColor="#999"
              />
            </ThemedView>

            {/* Fecha */}
            <ThemedView style={styles.formSection}>
              <ThemedText style={styles.label}>Fecha:</ThemedText>
              <TouchableOpacity
                style={styles.dateInputButton}
                onPress={() => setShowFechaAprobacionPicker(true)}
              >
                <TextInput
                  style={styles.input}
                  value={fechaAprobacion}
                  placeholder="Seleccione la fecha de aprobación"
                  placeholderTextColor="#999"
                  editable={false}
                />
                <Ionicons name="calendar-outline" size={24} color="#007AFF" style={styles.dateIcon} />
              </TouchableOpacity>
              {showFechaAprobacionPicker && (
                <DateTimePicker
                  value={fechaAprobacionDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleFechaAprobacionChange}
                />
              )}
            </ThemedView>
          </ThemedView>

          <ThemedView style={styles.formActions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={isCreating ? cancelCreating : cancelEditing}
            >
              <ThemedText style={styles.cancelButtonText}>Cancelar</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={isCreating ? savePlanHandler : updatePlanHandler}
            >
              <ThemedText style={styles.saveButtonText}>
                {isCreating ? 'Guardar' : 'Actualizar'}
              </ThemedText>
            </TouchableOpacity>
          </ThemedView>
        </ScrollView>
      </ThemedView>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <AppHeader
        onMenuPress={() => setIsMenuVisible(true)}
        onHomePress={handleHomePress}
        title="Plan de Comunicación"
      />
      <SlideMenu
        isVisible={isMenuVisible}
        onClose={() => setIsMenuVisible(false)}
        navigation={navigation}
      />
      {isCreating || editingPlan ? (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.formWrapper}>
          {renderForm()}
        </ScrollView>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {hasCurrentMarca && (
            <TouchableOpacity style={styles.addButton} onPress={startCreating}>
              <ThemedView style={styles.addButtonContent}>
                {getActionIcon('add')}
                <ThemedText style={styles.addButtonText}>Nuevo Plan</ThemedText>
              </ThemedView>
            </TouchableOpacity>
          )}
          {renderPlanList()}
        </ScrollView>
      )}
      <AppFooter />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  formWrapper: {
    padding: 15,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    padding: 20,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    margin: 15,
  },
  errorText: {
    color: '#C62828',
    fontSize: 16,
    textAlign: 'center',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  addButton: {
    backgroundColor: '#007AFF',
    margin: 15,
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  listContainer: {
    padding: 15,
  },
  listItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  listItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  listItemContent: {
    flex: 1,
    marginRight: 10,
  },
  listItemTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 5,
  },
  listItemSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 3,
  },
  offlineBadge: {
    fontSize: 12,
    color: '#FF9800',
    fontWeight: 'bold',
    marginTop: 5,
  },
  listItemActions: {
    flexDirection: 'row',
    gap: 10,
  },
  editButton: {
    backgroundColor: '#4CAF50',
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    backgroundColor: '#F44336',
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formContainer: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 20,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 20,
    textAlign: 'center',
  },
  formScrollView: {
    flexGrow: 1,
  },
  formScrollViewContent: {
    paddingBottom: 20,
  },
  titleSection: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    alignItems: 'center',
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    textTransform: 'uppercase',
  },
  tipoSection: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  tipoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  tipoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  addTipoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#007AFF',
    padding: 8,
    borderRadius: 6,
  },
  addTipoButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  comunicacionItem: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
  },
  comunicacionItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  comunicacionItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    flex: 1,
  },
  comunicacionItemHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  removeComunicacionButton: {
    padding: 4,
  },
  comunicacionItemContent: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#DDD',
  },
  formSection: {
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000',
    backgroundColor: '#FFF',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  fechaItem: {
    marginBottom: 10,
  },
  fechaContainer: {
    flex: 1,
  },
  fechaInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  pickerContainer: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    backgroundColor: '#FFF',
    overflow: 'hidden',
  },
  picker: {
    height: Platform.OS === 'ios' ? 200 : 50,
  },
  fechaInfoInput: {
    width: '100%',
  },
  removeFechaButton: {
    padding: 4,
  },
  dateInputButton: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  dateIcon: {
    position: 'absolute',
    right: 12,
  },
  addFechaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    padding: 10,
    backgroundColor: '#E3F2FD',
    borderRadius: 6,
    marginTop: 5,
  },
  addFechaButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  approvalSection: {
    marginTop: 20,
    marginBottom: 15,
    padding: 15,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  approvalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 15,
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 15,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#9E9E9E',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

