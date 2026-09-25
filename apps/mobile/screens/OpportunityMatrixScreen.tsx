import React, { useState, useCallback } from 'react';
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
  createOpportunityMatrix,
  updateOpportunityMatrix,
  deleteOpportunityMatrix,
  listOpportunityMatrixByCorpo,
} from '@/hooks/evaluationFunctions';
import { eventBus } from '@/hooks/eventBus';

type OpportunityMatrixScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'OpportunityMatrix'>;

interface Oportunidad {
  proceso: string;
  oportunidad: string;
  probabilidad: string;
  prob_calificacion: number;
  potencial_nuevos_negocios: string;
  valor_potencial_nuevos_negocios: number;
  beneficios_cliente: string;
  valor_beneficios_cliente: number;
  beneficio_interno: string;
  valor_beneficio_interno: number;
  aumento_rentabilidad: string;
  valor_aumento_rentabilidad: number;
  ben_calificacion: number;
  factor_oportunidad: number;
  plan_seguimiento: string;
  verificacion: string;
}

interface OpportunityMatrix {
  id: string;
  id_local: string;
  oportunidades: string | null; // JSON string of Oportunidad[]
  created_at: string;
  synced?: boolean;
}

interface EditingOpportunityMatrix {
  id: string | null;
  id_local: string;
  oportunidades: Oportunidad[];
}

const PROBABILIDAD_OPTIONS = [
  { label: 'Seleccionar probabilidad', value: '', valor: 0 },
  { label: 'Más de 2 años se implementa', value: 'Más de 2 años se implementa', valor: 1 },
  { label: 'Entre 1 y 2 años', value: 'Entre 1 y 2 años', valor: 2 },
  { label: '6 meses y un año se implementa', value: '6 meses y un año se implementa', valor: 3 },
  { label: '3 meses se implementa', value: '3 meses se implementa', valor: 4 },
  { label: '1 mes se implementa', value: '1 mes se implementa', valor: 5 },
];

const POTENCIAL_NEGOCIOS_OPTIONS = [
  { label: 'Seleccionar potencial', value: '', valor: 0 },
  { label: 'Nunca ha ocurrido', value: 'Nunca ha ocurrido', valor: 1 },
  { label: 'Nunca ha ocurrido en los pasados 10 años', value: 'Nunca ha ocurrido en los pasados 10 años', valor: 2 },
  { label: 'No ha ocurrido en los pasados 5 años', value: 'No ha ocurrido en los pasados 5 años', valor: 3 },
  { label: 'Ha ocurrido en los pasados 5 años', value: 'Ha ocurrido en los pasados 5 años', valor: 4 },
  { label: 'Ha ocurrido en el último año', value: 'Ha ocurrido en el último año', valor: 5 },
];

const BENEFICIOS_OPTIONS = [
  { label: 'Seleccionar beneficio', value: '', valor: 0 },
  { label: 'No hay/NA', value: 'No hay/NA', valor: 1 },
  { label: 'Menor', value: 'Menor', valor: 2 },
  { label: 'Moderado', value: 'Moderado', valor: 3 },
  { label: 'Alto', value: 'Alto', valor: 4 },
  { label: 'Muy alto', value: 'Muy alto', valor: 5 },
];

const calcularBenCalificacion = (suma: number): number => {
  if (suma >= 1 && suma <= 5) return 1;
  if (suma >= 6 && suma <= 10) return 2;
  if (suma >= 11 && suma <= 15) return 3;
  if (suma >= 16 && suma <= 20) return 4;
  if (suma >= 21 && suma <= 25) return 5;
  return 0;
};

const getBenCalificacionColor = (valor: number): string => {
  switch (valor) {
    case 1: return '#2196F3'; // Azul
    case 2: return '#4CAF50'; // Verde
    case 3: return '#FFC107'; // Amarillo
    case 4: return '#FF9800'; // Naranja
    case 5: return '#F44336'; // Rojo
    default: return '#9E9E9E'; // Gris
  }
};

const getFactorOportunidadColor = (factor: number): string => {
  if (factor >= 1 && factor <= 4) return '#F44336'; // Rojo
  if (factor >= 5 && factor <= 14) return '#FFC107'; // Amarillo
  if (factor >= 15 && factor <= 25) return '#4CAF50'; // Verde
  return '#9E9E9E'; // Gris
};

export default function OpportunityMatrixScreen() {
  const { employee, refreshAccessToken, logout } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<OpportunityMatrixScreenNavigationProp>();

  // Data states
  const [matrices, setMatrices] = useState<OpportunityMatrix[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasCurrentMarca, setHasCurrentMarca] = useState<boolean>(false);

  // Editing state
  const [editingRecord, setEditingRecord] = useState<EditingOpportunityMatrix | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form states
  const [oportunidades, setOportunidades] = useState<Oportunidad[]>([]);

  // Expanded states
  const [expandedOportunidadIndices, setExpandedOportunidadIndices] = useState<number[]>([]);

  const getConnectionStatus = async (): Promise<boolean> => {
    const networkState = await Network.getNetworkStateAsync();
    return networkState.isConnected && networkState.isInternetReachable ? true : false;
  };

  const generateRandomId = (): string => {
    return `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const fetchMatrices = useCallback(async () => {
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
        const result = await listOpportunityMatrixByCorpo({
          corpo_id: corpoId,
          refreshAccessToken,
          logout,
        });

        if (result.status && result.data) {
          setMatrices(result.data as OpportunityMatrix[]);
        } else {
          setMatrices([]);
        }
      } else {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const matricesCache = cache.filter((item: any) => item.type === 'opportunity_matrix');
          setMatrices(matricesCache);
        } else {
          setMatrices([]);
        }
      }
    } catch (err) {
      console.error('Error fetching matrices:', err);
      setError('Error al cargar las matrices de oportunidades');
      try {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const matricesCache = cache.filter((item: any) => item.type === 'opportunity_matrix');
          setMatrices(matricesCache);
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
      fetchMatrices();
      eventBus.on('connectionRestored', fetchMatrices);
      return () => {
        eventBus.off('connectionRestored', fetchMatrices);
      };
    }, [fetchMatrices])
  );

  const resetForm = () => {
    setOportunidades([]);
    setExpandedOportunidadIndices([]);
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

  const startEditing = (record: OpportunityMatrix) => {
    setIsCreating(false);
    let oportunidadesArray: Oportunidad[] = [];

    if (record.oportunidades) {
      try {
        oportunidadesArray = JSON.parse(record.oportunidades);
        if (!Array.isArray(oportunidadesArray)) oportunidadesArray = [];
      } catch (e) {
        oportunidadesArray = [];
      }
    }

    setEditingRecord({
      id: record.id,
      id_local: record.id_local,
      oportunidades: oportunidadesArray,
    });

    setOportunidades(oportunidadesArray);
    setExpandedOportunidadIndices(oportunidadesArray.map((_, i) => i));
  };

  const cancelEditing = () => {
    setEditingRecord(null);
    resetForm();
  };

  const addOportunidad = () => {
    const newOportunidad: Oportunidad = {
      proceso: '',
      oportunidad: '',
      probabilidad: '',
      prob_calificacion: 0,
      potencial_nuevos_negocios: '',
      valor_potencial_nuevos_negocios: 0,
      beneficios_cliente: '',
      valor_beneficios_cliente: 0,
      beneficio_interno: '',
      valor_beneficio_interno: 0,
      aumento_rentabilidad: '',
      valor_aumento_rentabilidad: 0,
      ben_calificacion: 0,
      factor_oportunidad: 0,
      plan_seguimiento: '',
      verificacion: '',
    };
    setOportunidades([...oportunidades, newOportunidad]);
    setExpandedOportunidadIndices([...expandedOportunidadIndices, oportunidades.length]);
  };

  const updateOportunidad = (index: number, field: keyof Oportunidad, value: string | number) => {
    const newOportunidades = [...oportunidades];
    const oportunidad = { ...newOportunidades[index] };
    
    if (field === 'probabilidad') {
      const probabilidadOption = PROBABILIDAD_OPTIONS.find(opt => opt.value === value);
      oportunidad.probabilidad = value as string;
      oportunidad.prob_calificacion = probabilidadOption?.valor || 0;
    } else if (field === 'potencial_nuevos_negocios') {
      const potencialOption = POTENCIAL_NEGOCIOS_OPTIONS.find(opt => opt.value === value);
      oportunidad.potencial_nuevos_negocios = value as string;
      oportunidad.valor_potencial_nuevos_negocios = potencialOption?.valor || 0;
    } else if (field === 'beneficios_cliente') {
      const beneficioOption = BENEFICIOS_OPTIONS.find(opt => opt.value === value);
      oportunidad.beneficios_cliente = value as string;
      oportunidad.valor_beneficios_cliente = beneficioOption?.valor || 0;
    } else if (field === 'beneficio_interno') {
      const beneficioOption = BENEFICIOS_OPTIONS.find(opt => opt.value === value);
      oportunidad.beneficio_interno = value as string;
      oportunidad.valor_beneficio_interno = beneficioOption?.valor || 0;
    } else if (field === 'aumento_rentabilidad') {
      const beneficioOption = BENEFICIOS_OPTIONS.find(opt => opt.value === value);
      oportunidad.aumento_rentabilidad = value as string;
      oportunidad.valor_aumento_rentabilidad = beneficioOption?.valor || 0;
    } else {
      (oportunidad as any)[field] = value;
    }

    // Calcular Ben. Calificación (suma de los 4 valores)
    const suma = oportunidad.valor_potencial_nuevos_negocios + 
                 oportunidad.valor_beneficios_cliente + 
                 oportunidad.valor_beneficio_interno + 
                 oportunidad.valor_aumento_rentabilidad;
    oportunidad.ben_calificacion = calcularBenCalificacion(suma);

    // Calcular Factor de la oportunidad (Prob x Ben)
    oportunidad.factor_oportunidad = oportunidad.prob_calificacion * oportunidad.ben_calificacion;

    newOportunidades[index] = oportunidad;
    setOportunidades(newOportunidades);
  };

  const removeOportunidad = (index: number) => {
    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas eliminar esta oportunidad?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            setOportunidades(oportunidades.filter((_, i) => i !== index));
            setExpandedOportunidadIndices(expandedOportunidadIndices.filter(i => i !== index).map(i => i > index ? i - 1 : i));
          },
        },
      ]
    );
  };

  const toggleOportunidadExpansion = (index: number) => {
    setExpandedOportunidadIndices(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const saveMatrixHandler = async () => {
    const currentMarca = await AsyncStorage.getItem('current_marca');
    if (!currentMarca) {
      Alert.alert('Error', 'No se encontró la marca actual');
      return;
    }

    const currentMarcaData = JSON.parse(currentMarca);

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas guardar esta matriz de oportunidades?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const requestData = {
                marca_id: currentMarcaData.id,
                oportunidades: oportunidades.length > 0 ? JSON.stringify(oportunidades) : null,
              };

              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await createOpportunityMatrix({
                  requestData,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Matriz de oportunidades guardada correctamente');
                  cancelCreating();
                  fetchMatrices();
                } else {
                  Alert.alert('Error', result.message || 'Error al guardar la matriz de oportunidades');
                }
              } else {
                const localId = generateRandomId();

                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: localId,
                  action: 'create',
                  type: 'opportunity_matrix',
                  payload: requestData,
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                const cache = cacheStr ? JSON.parse(cacheStr) : [];

                const newRecordCache: OpportunityMatrix = {
                  id: '',
                  id_local: localId,
                  oportunidades: oportunidades.length > 0 ? JSON.stringify(oportunidades) : null,
                  created_at: new Date().toISOString(),
                  synced: false,
                };

                cache.push({ ...newRecordCache, type: 'opportunity_matrix' });
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(cache));

                Alert.alert('Modo Offline', 'Matriz de oportunidades registrada localmente. Se sincronizará cuando haya conexión.');
                cancelCreating();
                fetchMatrices();
              }
            } catch (err) {
              console.error('Error saving matrix:', err);
              Alert.alert('Error', 'No se pudo guardar la matriz de oportunidades');
            }
          },
        },
      ]
    );
  };

  const updateMatrixHandler = async () => {
    if (!editingRecord) return;

    const recordId = editingRecord.id || editingRecord.id_local;
    if (!recordId) {
      Alert.alert('Error', 'ID de registro no encontrado para actualizar');
      return;
    }

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas actualizar esta matriz de oportunidades?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const requestData = {
                oportunidades: oportunidades.length > 0 ? JSON.stringify(oportunidades) : null,
              };

              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await updateOpportunityMatrix({
                  id: recordId,
                  requestData,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Matriz de oportunidades actualizada correctamente');
                  cancelEditing();
                  fetchMatrices();
                } else {
                  Alert.alert('Error', result.message || 'Error al actualizar la matriz de oportunidades');
                }
              } else {
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: recordId,
                  action: 'update',
                  type: 'opportunity_matrix',
                  payload: requestData,
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                if (cacheStr) {
                  const cache = JSON.parse(cacheStr);
                  const updatedCache = cache.map((item: any) => {
                    if ((item.id === recordId || item.id_local === recordId) && item.type === 'opportunity_matrix') {
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

                Alert.alert('Modo Offline', 'Matriz de oportunidades actualizada localmente. Se sincronizará cuando haya conexión.');
                cancelEditing();
                fetchMatrices();
              }
            } catch (err) {
              console.error('Error updating matrix:', err);
              Alert.alert('Error', 'No se pudo actualizar la matriz de oportunidades');
            }
          },
        },
      ]
    );
  };

  const deleteMatrixHandler = async (record: OpportunityMatrix) => {
    const recordId = record.id || record.id_local;
    if (!recordId) {
      Alert.alert('Error', 'ID de registro no encontrado para eliminar');
      return;
    }

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas eliminar esta matriz de oportunidades?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await deleteOpportunityMatrix({
                  id: recordId,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Matriz de oportunidades eliminada correctamente');
                  fetchMatrices();
                } else {
                  Alert.alert('Error', result.message || 'Error al eliminar la matriz de oportunidades');
                }
              } else {
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: recordId,
                  action: 'delete',
                  type: 'opportunity_matrix',
                  payload: {},
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                if (cacheStr) {
                  const cache = JSON.parse(cacheStr);
                  const updatedCache = cache.filter((item: any) => !((item.id === recordId || item.id_local === recordId) && item.type === 'opportunity_matrix'));
                  await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                }

                Alert.alert('Modo Offline', 'Matriz de oportunidades marcada para eliminación localmente. Se sincronizará cuando haya conexión.');
                fetchMatrices();
              }
            } catch (err) {
              console.error('Error deleting matrix:', err);
              Alert.alert('Error', 'No se pudo eliminar la matriz de oportunidades');
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
      case 'matrix': return <Ionicons name="trending-up" size={24} color='#000000' />;
      case 'add': return <Ionicons name="add" size={24} color='#FFFFFF' />;
      case 'cancel': return <Ionicons name="close" size={24} color='#FFFFFF' />;
      case 'confirm': return <Ionicons name="checkmark" size={24} color='#FFFFFF' />;
      case 'delete': return <Ionicons name="trash" size={24} color='#FFFFFF' />;
      case 'edit': return <Ionicons name="pencil" size={20} color="#FFFFFF" />;
      default: return <Ionicons name="trending-up" size={24} color='#000000' />;
    }
  };

  const renderMatrixList = () => {
    if (isLoading) {
      return (
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Cargando matrices de oportunidades...</ThemedText>
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

    if (matrices.length === 0) {
      return (
        <ThemedView style={styles.emptyContainer}>
          <ThemedText style={styles.emptyText}>No hay matrices de oportunidades registradas.</ThemedText>
        </ThemedView>
      );
    }

    return (
      <ThemedView style={styles.listContainer}>
        {matrices.map((record) => {
          let oportunidadesArray: Oportunidad[] = [];
          if (record.oportunidades) {
            try {
              oportunidadesArray = JSON.parse(record.oportunidades);
            } catch (e) {
              oportunidadesArray = [];
            }
          }

          return (
            <ThemedView key={record.id || record.id_local} style={styles.listItem}>
              <ThemedView style={styles.listItemHeader}>
                <ThemedView style={styles.listItemContent}>
                  <ThemedText style={styles.listItemTitle}>
                    Matriz de Oportunidades
                  </ThemedText>
                  <ThemedText style={styles.listItemSubtitle}>
                    Oportunidades: {oportunidadesArray.length} | Fecha: {new Date(record.created_at).toLocaleDateString('es-CR')}
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
                    onPress={() => deleteMatrixHandler(record)}
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

  const renderOportunidad = (oportunidad: Oportunidad, index: number) => {
    const isExpanded = expandedOportunidadIndices.includes(index);
    const benCalificacionColor = getBenCalificacionColor(oportunidad.ben_calificacion);
    const factorColor = getFactorOportunidadColor(oportunidad.factor_oportunidad);

    return (
      <ThemedView key={index} style={styles.oportunidadItem}>
        <TouchableOpacity
          style={styles.oportunidadHeader}
          onPress={() => toggleOportunidadExpansion(index)}
        >
          <ThemedView style={styles.oportunidadHeaderContent}>
            <ThemedText style={styles.oportunidadHeaderText}>
              Oportunidad {index + 1}: {oportunidad.oportunidad || 'Sin nombre'}
            </ThemedText>
            <ThemedView style={[styles.factorBadge, { backgroundColor: factorColor }]}>
              <ThemedText style={styles.factorBadgeText}>
                Factor: {oportunidad.factor_oportunidad > 0 ? oportunidad.factor_oportunidad : 'Sin definir'}
              </ThemedText>
            </ThemedView>
          </ThemedView>
          <ThemedView style={styles.oportunidadHeaderActions}>
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                removeOportunidad(index);
              }}
              style={styles.removeOportunidadButton}
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
          <ThemedView style={styles.oportunidadContent}>
            {/* Proceso */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Proceso</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder="Proceso"
                placeholderTextColor="#999"
                value={oportunidad.proceso}
                onChangeText={(text) => updateOportunidad(index, 'proceso', text)}
              />
            </ThemedView>

            {/* Oportunidad */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Oportunidad</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder="Oportunidad"
                placeholderTextColor="#999"
                value={oportunidad.oportunidad}
                onChangeText={(text) => updateOportunidad(index, 'oportunidad', text)}
              />
            </ThemedView>

            {/* Probabilidad */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Probabilidad (de lograr la oportunidad)</ThemedText>
              <ThemedView style={styles.pickerContainer}>
                <Picker
                  selectedValue={oportunidad.probabilidad}
                  onValueChange={(value) => updateOportunidad(index, 'probabilidad', value)}
                  style={styles.picker}
                >
                  {PROBABILIDAD_OPTIONS.map((option) => (
                    <Picker.Item
                      key={option.value}
                      label={option.label}
                      value={option.value}
                    />
                  ))}
                </Picker>
              </ThemedView>
            </ThemedView>

            {/* Prob. Calificación */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Prob. Calificación</ThemedText>
              <TextInput
                style={[styles.formInput, styles.readOnlyInput]}
                value={oportunidad.prob_calificacion.toString()}
                editable={false}
              />
            </ThemedView>

            {/* Potencial de nuevos negocios */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Potencial de nuevos negocios o expansión del actual</ThemedText>
              <ThemedView style={styles.pickerContainer}>
                <Picker
                  selectedValue={oportunidad.potencial_nuevos_negocios}
                  onValueChange={(value) => updateOportunidad(index, 'potencial_nuevos_negocios', value)}
                  style={styles.picker}
                >
                  {POTENCIAL_NEGOCIOS_OPTIONS.map((option) => (
                    <Picker.Item
                      key={option.value}
                      label={option.label}
                      value={option.value}
                    />
                  ))}
                </Picker>
              </ThemedView>
            </ThemedView>

            {/* Beneficios para el cliente */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Beneficios para el cliente</ThemedText>
              <ThemedView style={styles.pickerContainer}>
                <Picker
                  selectedValue={oportunidad.beneficios_cliente}
                  onValueChange={(value) => updateOportunidad(index, 'beneficios_cliente', value)}
                  style={styles.picker}
                >
                  {BENEFICIOS_OPTIONS.map((option) => (
                    <Picker.Item
                      key={option.value}
                      label={option.label}
                      value={option.value}
                    />
                  ))}
                </Picker>
              </ThemedView>
            </ThemedView>

            {/* Beneficio interno para la organización */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Beneficio interno para la organización</ThemedText>
              <ThemedView style={styles.pickerContainer}>
                <Picker
                  selectedValue={oportunidad.beneficio_interno}
                  onValueChange={(value) => updateOportunidad(index, 'beneficio_interno', value)}
                  style={styles.picker}
                >
                  {BENEFICIOS_OPTIONS.map((option) => (
                    <Picker.Item
                      key={option.value}
                      label={option.label}
                      value={option.value}
                    />
                  ))}
                </Picker>
              </ThemedView>
            </ThemedView>

            {/* Aumento de rentabilidad */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Aumento de rentabilidad</ThemedText>
              <ThemedView style={styles.pickerContainer}>
                <Picker
                  selectedValue={oportunidad.aumento_rentabilidad}
                  onValueChange={(value) => updateOportunidad(index, 'aumento_rentabilidad', value)}
                  style={styles.picker}
                >
                  {BENEFICIOS_OPTIONS.map((option) => (
                    <Picker.Item
                      key={option.value}
                      label={option.label}
                      value={option.value}
                    />
                  ))}
                </Picker>
              </ThemedView>
            </ThemedView>

            {/* Ben. Calificación */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Ben. Calificación</ThemedText>
              <ThemedView style={[styles.benCalificacionContainer, { backgroundColor: benCalificacionColor }]}>
                <ThemedText style={styles.benCalificacionText}>
                  {oportunidad.ben_calificacion > 0 ? oportunidad.ben_calificacion : 'Sin definir'}
                </ThemedText>
              </ThemedView>
            </ThemedView>

            {/* Factor de la oportunidad */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Factor de la oportunidad (Prob x Ben)</ThemedText>
              <ThemedView style={[styles.factorContainer, { backgroundColor: factorColor }]}>
                <ThemedText style={styles.factorText}>
                  {oportunidad.factor_oportunidad > 0 ? oportunidad.factor_oportunidad : 'Sin definir'}
                </ThemedText>
              </ThemedView>
            </ThemedView>

            {/* Plan de Seguimiento */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Plan de Seguimiento de Oportunidades</ThemedText>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                placeholder="Plan de Seguimiento de Oportunidades (Puede hacer referencia a un documento externo de planificación)"
                placeholderTextColor="#999"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                value={oportunidad.plan_seguimiento}
                onChangeText={(text) => updateOportunidad(index, 'plan_seguimiento', text)}
              />
            </ThemedView>

            {/* Verificación */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Verificación ¿Hay éxito post implementación?</ThemedText>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                placeholder="Verificación ¿Hay éxito post implementación?"
                placeholderTextColor="#999"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                value={oportunidad.verificacion}
                onChangeText={(text) => updateOportunidad(index, 'verificacion', text)}
              />
            </ThemedView>
          </ThemedView>
        )}
      </ThemedView>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <AppHeader onMenuPress={handleMenuPress} title="Matriz de Oportunidades" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <ThemedView style={styles.contentContainer}>
          <ThemedText type="title" style={styles.screenTitle}>
            {getActionIcon('matrix')} Matriz de Oportunidades
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
              {oportunidades.map((oportunidad, index) => renderOportunidad(oportunidad, index))}

              <TouchableOpacity
                style={styles.addOportunidadButton}
                onPress={addOportunidad}
              >
                <Ionicons name="add-circle" size={24} color="#4CAF50" />
                <ThemedText style={styles.addOportunidadButtonText}>Agregar Oportunidad</ThemedText>
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
                  onPress={editingRecord ? updateMatrixHandler : saveMatrixHandler}
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
                <ThemedText style={styles.createButtonText}>Crear Nueva Matriz de Oportunidades</ThemedText>
              </TouchableOpacity>
              {renderMatrixList()}
            </ThemedView>
          )}
        </ThemedView>
      </ScrollView>

      <AppFooter />
      <SlideMenu
        isVisible={isMenuVisible}
        onClose={handleMenuClose}
        onHomePress={handleHomePress}
        currentRoute="OpportunityMatrix"
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
  readOnlyInput: {
    backgroundColor: '#E0E0E0',
    color: '#666',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
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
  oportunidadItem: {
    marginBottom: 15,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  oportunidadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#F5F5F5',
  },
  oportunidadHeaderContent: {
    flex: 1,
    marginRight: 10,
  },
  oportunidadHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  factorBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  factorBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  oportunidadHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  removeOportunidadButton: {
    padding: 4,
  },
  oportunidadContent: {
    padding: 15,
  },
  benCalificacionContainer: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benCalificacionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  factorContainer: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  factorText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  addOportunidadButton: {
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
  addOportunidadButtonText: {
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

