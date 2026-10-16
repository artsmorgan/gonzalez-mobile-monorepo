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
  createStakeholderAnalysisMatrix,
  updateStakeholderAnalysisMatrix,
  deleteStakeholderAnalysisMatrix,
  listStakeholderAnalysisMatrixByCorpo,
} from '@/hooks/evaluationFunctions';
import { eventBus } from '@/hooks/eventBus';

type StakeholderAnalysisMatrixScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'StakeholderAnalysisMatrix'>;

interface ParteInteresada {
  tipo: 'INTERNA' | 'EXTERNA';
  numero: string;
  tipo_parte_interesada: string;
  descripcion: string;
  responsable: string;
  tipo_interes: string;
  expectativas_requisitos: string;
  capacidad_afectar: string;
  influencia_sgc: string;
  comportamiento_sgc: string;
  indice_pertinencia: number;
  estrategia_seguir: string;
  como_aplicara_estrategia: string;
  periodicidad: string;
  responsable_hacerlo: string;
}

interface StakeholderAnalysisMatrix {
  id: string;
  id_local: string;
  partes_interesadas: string | null;
  created_at: string;
  synced?: boolean;
}

interface EditingStakeholderAnalysisMatrix {
  id: string | null;
  id_local: string;
  partes_interesadas: string;
}

const CAPACIDAD_AFECTAR_OPTIONS = [
  { label: 'Seleccionar', value: '' },
  { label: 'Alta (4)', value: '4' },
  { label: 'Moderada (3)', value: '3' },
  { label: 'Regular (2)', value: '2' },
  { label: 'Ninguna (1)', value: '1' },
];

const INFLUENCIA_SGC_OPTIONS = [
  { label: 'Seleccionar', value: '' },
  { label: 'Alta (4)', value: '4' },
  { label: 'Moderada (3)', value: '3' },
  { label: 'Regular (2)', value: '2' },
  { label: 'Ninguna (1)', value: '1' },
];

const COMPORTAMIENTO_SGC_OPTIONS = [
  { label: 'Seleccionar', value: '' },
  { label: 'Alta (4)', value: '4' },
  { label: 'Moderada (3)', value: '3' },
  { label: 'Regular (2)', value: '2' },
  { label: 'Ninguna (1)', value: '1' },
];

const TIPO_INTERES_OPTIONS = [
  { label: 'Seleccionar', value: '' },
  { label: 'Político', value: 'Político' },
  { label: 'Social', value: 'Social' },
  { label: 'Laboral', value: 'Laboral' },
  { label: 'Económico', value: 'Económico' },
  { label: 'Ambiental', value: 'Ambiental' },
  { label: 'Legal', value: 'Legal' },
];

const calculateIndicePertinencia = (capacidad: string, influencia: string, comportamiento: string): number => {
  const cap = parseInt(capacidad) || 0;
  const inf = parseInt(influencia) || 0;
  const comp = parseInt(comportamiento) || 0;
  return cap * inf * comp;
};

const calculateEstrategia = (indice: number): string => {
  if (indice >= 48 && indice <= 64) {
    return 'Gestionar de cerca';
  } else if (indice >= 21 && indice <= 47) {
    return 'Mantener satisfecha';
  } else if (indice >= 4 && indice <= 20) {
    return 'Informar';
  } else if (indice < 4) {
    return 'Monitorear';
  }
  return '';
};

export default function StakeholderAnalysisMatrixScreen() {
  const { employee, refreshAccessToken, logout } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<StakeholderAnalysisMatrixScreenNavigationProp>();

  // Data states
  const [matrices, setMatrices] = useState<StakeholderAnalysisMatrix[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasCurrentMarca, setHasCurrentMarca] = useState<boolean>(false);

  // Editing state
  const [isCreating, setIsCreating] = useState(false);
  const [editingMatrix, setEditingMatrix] = useState<EditingStakeholderAnalysisMatrix | null>(null);

  // Form fields
  const [partesInteresadas, setPartesInteresadas] = useState<ParteInteresada[]>([]);
  const [expandedIndices, setExpandedIndices] = useState<number[]>([]);

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

  const fetchMatrices = useCallback(async () => {
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
        const result = await listStakeholderAnalysisMatrixByCorpo({
          corpo_id: corpoId,
          refreshAccessToken,
          logout,
        });

        if (result.status && result.data) {
          setMatrices(result.data as StakeholderAnalysisMatrix[]);
        } else {
          setMatrices([]);
        }
      } else {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const matricesCache = cache.filter((item: any) => item.type === 'stakeholder_analysis_matrix');
          setMatrices(matricesCache);
        } else {
          setMatrices([]);
        }
      }
    } catch (err) {
      console.error('Error fetching matrices:', err);
      setError('Error al cargar las matrices de análisis de partes interesadas');
      try {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const matricesCache = cache.filter((item: any) => item.type === 'stakeholder_analysis_matrix');
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
    setPartesInteresadas([]);
    setExpandedIndices([]);
  };

  const startCreating = () => {
    setIsCreating(true);
    setEditingMatrix(null);
    resetForm();
  };

  const cancelCreating = () => {
    setIsCreating(false);
    resetForm();
  };

  const startEditing = (matrix: StakeholderAnalysisMatrix) => {
    setIsCreating(false);
    setEditingMatrix({
      id: matrix.id,
      id_local: matrix.id_local,
      partes_interesadas: matrix.partes_interesadas || '',
    });

    if (matrix.partes_interesadas) {
      try {
        const parsed = JSON.parse(matrix.partes_interesadas);
        setPartesInteresadas(parsed);
      } catch {
        setPartesInteresadas([]);
      }
    } else {
      setPartesInteresadas([]);
    }
  };

  const cancelEditing = () => {
    setEditingMatrix(null);
    resetForm();
  };

  const addParteInteresada = (tipo: 'INTERNA' | 'EXTERNA') => {
    const newParte: ParteInteresada = {
      tipo,
      numero: '',
      tipo_parte_interesada: '',
      descripcion: '',
      responsable: '',
      tipo_interes: '',
      expectativas_requisitos: '',
      capacidad_afectar: '',
      influencia_sgc: '',
      comportamiento_sgc: '',
      indice_pertinencia: 0,
      estrategia_seguir: '',
      como_aplicara_estrategia: '',
      periodicidad: '',
      responsable_hacerlo: '',
    };
    setPartesInteresadas([...partesInteresadas, newParte]);
  };

  const removeParteInteresada = (index: number) => {
    const updated = [...partesInteresadas];
    updated.splice(index, 1);
    setPartesInteresadas(updated);
    setExpandedIndices(expandedIndices.filter(i => i !== index).map(i => i > index ? i - 1 : i));
  };

  const updateParteInteresada = (index: number, field: keyof ParteInteresada, value: any) => {
    const updated = [...partesInteresadas];
    updated[index] = { ...updated[index], [field]: value };
    
    // Recalcular índice de pertinencia y estrategia si cambian los valores relevantes
    if (field === 'capacidad_afectar' || field === 'influencia_sgc' || field === 'comportamiento_sgc') {
      const indice = calculateIndicePertinencia(
        field === 'capacidad_afectar' ? value : updated[index].capacidad_afectar,
        field === 'influencia_sgc' ? value : updated[index].influencia_sgc,
        field === 'comportamiento_sgc' ? value : updated[index].comportamiento_sgc
      );
      updated[index].indice_pertinencia = indice;
      updated[index].estrategia_seguir = calculateEstrategia(indice);
    }
    
    setPartesInteresadas(updated);
  };

  const toggleExpansion = (index: number) => {
    if (expandedIndices.includes(index)) {
      setExpandedIndices(expandedIndices.filter(i => i !== index));
    } else {
      setExpandedIndices([...expandedIndices, index]);
    }
  };

  const saveMatrixHandler = async () => {
    const currentMarca = await AsyncStorage.getItem('current_marca');
    if (!currentMarca) {
      Alert.alert('Error', 'No se encontró la marca actual');
      return;
    }

    const currentMarcaData = JSON.parse(currentMarca);

    Alert.alert('Confirmar', '¿Estás seguro de que deseas guardar esta matriz de análisis de partes interesadas?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: async () => {
          try {
            const requestData = {
              marca_id: currentMarcaData.id,
              partes_interesadas: JSON.stringify(partesInteresadas),
            };

            const isConnected = await getConnectionStatus();

            if (isConnected) {
              const result = await createStakeholderAnalysisMatrix({
                requestData,
                refreshAccessToken,
                logout,
              });

              if (result.status) {
                Alert.alert('Éxito', 'Matriz de análisis de partes interesadas creada correctamente');
                setIsCreating(false);
                resetForm();
                fetchMatrices();
              } else {
                Alert.alert('Error', result.message || 'Error al crear la matriz de análisis de partes interesadas');
              }
            } else {
              const localId = generateRandomId();

              const actionsStr = await AsyncStorage.getItem('evaluations_actions');
              const actions = actionsStr ? JSON.parse(actionsStr) : [];
              actions.push({
                id: localId,
                action: 'create',
                type: 'stakeholder_analysis_matrix',
                payload: requestData,
                synced: false,
              });
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

              const cacheStr = await AsyncStorage.getItem('evaluations_cache');
              const cache = cacheStr ? JSON.parse(cacheStr) : [];

              const newMatrixCache: StakeholderAnalysisMatrix = {
                id: '',
                id_local: localId,
                partes_interesadas: JSON.stringify(partesInteresadas),
                created_at: new Date().toISOString(),
                synced: false,
              };

              cache.push({ ...newMatrixCache, type: 'stakeholder_analysis_matrix' });
              await AsyncStorage.setItem('evaluations_cache', JSON.stringify(cache));

              Alert.alert('Modo Offline', 'Matriz de análisis de partes interesadas registrada localmente. Se sincronizará cuando haya conexión.');
              setIsCreating(false);
              resetForm();
              fetchMatrices();
            }
          } catch (err) {
            console.error('Error saving matrix:', err);
            Alert.alert('Error', 'No se pudo guardar la matriz de análisis de partes interesadas');
          }
        },
      },
    ]);
  };

  const updateMatrixHandler = async () => {
    if (!editingMatrix) return;

    const matrixId = editingMatrix.id || editingMatrix.id_local;
    if (!matrixId) {
      Alert.alert('Error', 'ID de matriz no encontrado para actualizar');
      return;
    }

    Alert.alert('Confirmar', '¿Estás seguro de que deseas actualizar esta matriz de análisis de partes interesadas?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: async () => {
          try {
            const requestData = {
              partes_interesadas: JSON.stringify(partesInteresadas),
            };

            const isConnected = await getConnectionStatus();

            if (isConnected) {
              const result = await updateStakeholderAnalysisMatrix({
                id: matrixId,
                requestData,
                refreshAccessToken,
                logout,
              });

              if (result.status) {
                Alert.alert('Éxito', 'Matriz de análisis de partes interesadas actualizada correctamente');
                cancelEditing();
                fetchMatrices();
              } else {
                Alert.alert('Error', result.message || 'Error al actualizar la matriz de análisis de partes interesadas');
              }
            } else {
              const actionsStr = await AsyncStorage.getItem('evaluations_actions');
              const actions = actionsStr ? JSON.parse(actionsStr) : [];
              actions.push({
                id: matrixId,
                action: 'update',
                type: 'stakeholder_analysis_matrix',
                payload: requestData,
                synced: false,
              });
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

              const cacheStr = await AsyncStorage.getItem('evaluations_cache');
              if (cacheStr) {
                const cache = JSON.parse(cacheStr);
                const updatedCache = cache.map((item: any) => {
                  if ((item.id === matrixId || item.id_local === matrixId) && item.type === 'stakeholder_analysis_matrix') {
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

              Alert.alert('Actualizado offline', 'La matriz de análisis de partes interesadas se actualizó localmente y se sincronizará cuando haya conexión');
              cancelEditing();
              fetchMatrices();
            }
          } catch (err) {
            console.error('Error updating matrix:', err);
            Alert.alert('Error', 'Error al actualizar la matriz de análisis de partes interesadas');
          }
        },
      },
    ]);
  };

  const deleteMatrixHandler = async (matrix: StakeholderAnalysisMatrix) => {
    Alert.alert('Confirmar', '¿Estás seguro de que deseas eliminar esta matriz de análisis de partes interesadas?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            const isConnected = await getConnectionStatus();
            const recordId = matrix.id && !matrix.id.startsWith('local_') ? matrix.id : matrix.id_local;

            if (isConnected && matrix.id && !matrix.id.startsWith('local_')) {
              const result = await deleteStakeholderAnalysisMatrix({
                id: recordId,
                refreshAccessToken,
                logout,
              });

              if (result.status) {
                Alert.alert('Éxito', 'Matriz de análisis de partes interesadas eliminada correctamente');
                fetchMatrices();
              } else {
                Alert.alert('Error', result.message || 'Error al eliminar la matriz de análisis de partes interesadas');
              }
            } else {
              const actionsStr = await AsyncStorage.getItem('evaluations_actions');
              const actions = actionsStr ? JSON.parse(actionsStr) : [];
              actions.push({
                id: recordId,
                action: 'delete',
                payload: {},
                type: 'stakeholder_analysis_matrix',
                synced: false,
              });
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

              const cacheStr = await AsyncStorage.getItem('evaluations_cache');
              if (cacheStr) {
                const cache = JSON.parse(cacheStr);
                const updatedCache = cache.filter((item: any) => !((item.id === recordId || item.id_local === recordId) && item.type === 'stakeholder_analysis_matrix'));
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
              }

              Alert.alert('Eliminado offline', 'La matriz de análisis de partes interesadas se eliminó localmente y se sincronizará cuando haya conexión');
              fetchMatrices();
            }
          } catch (err) {
            console.error('Error deleting matrix:', err);
            Alert.alert('Error', 'Error al eliminar la matriz de análisis de partes interesadas');
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

  const renderMatrixList = () => {
    if (isLoading) {
      return (
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Cargando matrices de análisis...</ThemedText>
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
          <ThemedText style={styles.emptyText}>No hay matrices de análisis de partes interesadas registradas.</ThemedText>
        </ThemedView>
      );
    }

    return (
      <ThemedView style={styles.listContainer}>
        {matrices.map((matrix) => (
          <ThemedView key={matrix.id || matrix.id_local} style={styles.listItem}>
            <ThemedView style={styles.listItemHeader}>
              <ThemedView style={styles.listItemContent}>
                <ThemedText style={styles.listItemTitle}>
                  Matriz de Análisis de Partes Interesadas
                </ThemedText>
                {!matrix.synced && (
                  <ThemedText style={styles.offlineBadge}>Sin sincronizar</ThemedText>
                )}
              </ThemedView>
              <ThemedView style={styles.listItemActions}>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => startEditing(matrix)}
                >
                  {getActionIcon('edit')}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deleteMatrixHandler(matrix)}
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

  const partesInternas = useMemo(() => partesInteresadas.filter(p => p.tipo === 'INTERNA'), [partesInteresadas]);
  const partesExternas = useMemo(() => partesInteresadas.filter(p => p.tipo === 'EXTERNA'), [partesInteresadas]);

  const renderParteInteresada = (parte: ParteInteresada, index: number, globalIndex: number) => {
    const isExpanded = expandedIndices.includes(globalIndex);
    
    return (
      <ThemedView key={globalIndex} style={styles.parteItem}>
        <TouchableOpacity
          style={styles.parteItemHeader}
          onPress={() => toggleExpansion(globalIndex)}
        >
          <ThemedText style={styles.parteItemTitle}>
            {parte.tipo} - {parte.descripcion || `Parte ${globalIndex + 1}`}
          </ThemedText>
          <ThemedView style={styles.parteItemHeaderActions}>
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color="#000000"
            />
            <TouchableOpacity
              onPress={() => removeParteInteresada(globalIndex)}
              style={styles.removeParteButton}
            >
              <Ionicons name="trash" size={18} color="#F44336" />
            </TouchableOpacity>
          </ThemedView>
        </TouchableOpacity>

        {isExpanded && (
          <ThemedView style={styles.parteItemContent}>
            {/* Número */}
            <ThemedView style={styles.formSection}>
              <ThemedText style={styles.label}>#</ThemedText>
              <TextInput
                style={styles.input}
                value={parte.numero}
                onChangeText={(text) => updateParteInteresada(globalIndex, 'numero', text)}
                placeholder="Número"
                placeholderTextColor="#999"
                keyboardType="numeric"
              />
            </ThemedView>

            {/* Tipo de parte interesada */}
            <ThemedView style={styles.formSection}>
              <ThemedText style={styles.label}>Tipo de Parte Interesada</ThemedText>
              <TextInput
                style={styles.input}
                value={parte.tipo_parte_interesada}
                onChangeText={(text) => updateParteInteresada(globalIndex, 'tipo_parte_interesada', text)}
                placeholder="Ingrese el tipo de parte interesada"
                placeholderTextColor="#999"
              />
            </ThemedView>

            {/* Descripción */}
            <ThemedView style={styles.formSection}>
              <ThemedText style={styles.label}>Descripción de Parte Interesada</ThemedText>
              <TextInput
                style={styles.input}
                value={parte.descripcion}
                onChangeText={(text) => updateParteInteresada(globalIndex, 'descripcion', text)}
                placeholder="Ingrese la descripción"
                placeholderTextColor="#999"
              />
            </ThemedView>

            {/* Responsable */}
            <ThemedView style={styles.formSection}>
              <ThemedText style={styles.label}>Responsable</ThemedText>
              <TextInput
                style={styles.input}
                value={parte.responsable}
                onChangeText={(text) => updateParteInteresada(globalIndex, 'responsable', text)}
                placeholder="Ingrese el responsable"
                placeholderTextColor="#999"
              />
            </ThemedView>

            {/* Tipo de interés */}
            <ThemedView style={styles.formSection}>
              <ThemedText style={styles.label}>Tipo de Interés</ThemedText>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={parte.tipo_interes}
                  onValueChange={(value) => updateParteInteresada(globalIndex, 'tipo_interes', value)}
                  style={styles.picker}
                >
                  {TIPO_INTERES_OPTIONS.map((option) => (
                    <Picker.Item key={option.value} label={option.label} value={option.value} />
                  ))}
                </Picker>
              </View>
            </ThemedView>

            {/* Expectativas/Requisitos */}
            <ThemedView style={styles.formSection}>
              <ThemedText style={styles.label}>Expectativas / Requisitos</ThemedText>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={parte.expectativas_requisitos}
                onChangeText={(text) => updateParteInteresada(globalIndex, 'expectativas_requisitos', text)}
                placeholder="Qué busca la parte interesada del Sistema"
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
              />
            </ThemedView>

            {/* Capacidad de afectar */}
            <ThemedView style={styles.formSection}>
              <ThemedText style={styles.label}>Capacidad de afectar al SGC (tiene poder para hacerlo)</ThemedText>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={parte.capacidad_afectar}
                  onValueChange={(value) => updateParteInteresada(globalIndex, 'capacidad_afectar', value)}
                  style={styles.picker}
                >
                  {CAPACIDAD_AFECTAR_OPTIONS.map((option) => (
                    <Picker.Item key={option.value} label={option.label} value={option.value} />
                  ))}
                </Picker>
              </View>
            </ThemedView>

            {/* Influencia en el SGC */}
            <ThemedView style={styles.formSection}>
              <ThemedText style={styles.label}>Influencia en el SGC (puede influenciar a los que tienen poder)</ThemedText>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={parte.influencia_sgc}
                  onValueChange={(value) => updateParteInteresada(globalIndex, 'influencia_sgc', value)}
                  style={styles.picker}
                >
                  {INFLUENCIA_SGC_OPTIONS.map((option) => (
                    <Picker.Item key={option.value} label={option.label} value={option.value} />
                  ))}
                </Picker>
              </View>
            </ThemedView>

            {/* Comportamiento hacia el SGC */}
            <ThemedView style={styles.formSection}>
              <ThemedText style={styles.label}>Comportamiento hacia el SGC - empresa</ThemedText>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={parte.comportamiento_sgc}
                  onValueChange={(value) => updateParteInteresada(globalIndex, 'comportamiento_sgc', value)}
                  style={styles.picker}
                >
                  {COMPORTAMIENTO_SGC_OPTIONS.map((option) => (
                    <Picker.Item key={option.value} label={option.label} value={option.value} />
                  ))}
                </Picker>
              </View>
            </ThemedView>

            {/* Índice de pertinencia (calculado) */}
            <ThemedView style={styles.formSection}>
              <ThemedText style={styles.label}>Índice de Pertinencia (A*B*C)</ThemedText>
              <ThemedView style={styles.calculatedValue}>
                <ThemedText style={styles.calculatedValueText}>{parte.indice_pertinencia}</ThemedText>
              </ThemedView>
            </ThemedView>

            {/* Estrategia a seguir (calculada) */}
            <ThemedView style={styles.formSection}>
              <ThemedText style={styles.label}>Estrategia a seguir</ThemedText>
              <ThemedView style={[styles.calculatedValue, styles.strategyValue]}>
                <ThemedText style={styles.strategyValueText}>{parte.estrategia_seguir || 'N/A'}</ThemedText>
              </ThemedView>
            </ThemedView>

            {/* ¿Cómo aplicará la estrategia? */}
            <ThemedView style={styles.formSection}>
              <ThemedText style={styles.label}>¿Cómo aplicará la estrategia? Definir instrumento y su contenido</ThemedText>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={parte.como_aplicara_estrategia}
                onChangeText={(text) => updateParteInteresada(globalIndex, 'como_aplicara_estrategia', text)}
                placeholder="Reuniones, encuestas, reportes, informes, focus group, información en Web u otros medios, etc."
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
              />
            </ThemedView>

            {/* Periodicidad */}
            <ThemedView style={styles.formSection}>
              <ThemedText style={styles.label}>Periodicidad</ThemedText>
              <TextInput
                style={styles.input}
                value={parte.periodicidad}
                onChangeText={(text) => updateParteInteresada(globalIndex, 'periodicidad', text)}
                placeholder="Ingrese la periodicidad"
                placeholderTextColor="#999"
              />
            </ThemedView>

            {/* Responsable de hacerlo */}
            <ThemedView style={styles.formSection}>
              <ThemedText style={styles.label}>Responsable de hacerlo</ThemedText>
              <TextInput
                style={styles.input}
                value={parte.responsable_hacerlo}
                onChangeText={(text) => updateParteInteresada(globalIndex, 'responsable_hacerlo', text)}
                placeholder="Ingrese el responsable"
                placeholderTextColor="#999"
              />
            </ThemedView>
          </ThemedView>
        )}
      </ThemedView>
    );
  };

  const renderForm = () => {
    if (!isCreating && !editingMatrix) return null;

    return (
      <ThemedView style={styles.formContainer}>
        <ThemedText style={styles.formTitle}>
          {isCreating ? 'Nueva Matriz de Análisis de Partes Interesadas' : 'Editar Matriz de Análisis de Partes Interesadas'}
        </ThemedText>

        <ScrollView 
          style={styles.formScrollView} 
          contentContainerStyle={styles.formScrollViewContent}
          showsVerticalScrollIndicator={true}
          nestedScrollEnabled={true}
        >
          {/* Título */}
          <ThemedView style={styles.titleSection}>
            <ThemedText style={styles.mainTitle}>MATRIZ DE ANÁLISIS DE PARTES INTERESADAS Y MECANISMOS DE ATENCIÓN</ThemedText>
          </ThemedView>

          {/* Sección INTERNAS */}
          <ThemedView style={styles.tipoSection}>
            <ThemedView style={styles.tipoHeader}>
              <ThemedText style={styles.tipoTitle}>INTERNAS</ThemedText>
              <TouchableOpacity style={styles.addTipoButton} onPress={() => addParteInteresada('INTERNA')}>
                <Ionicons name="add" size={20} color="#FFFFFF" />
                <ThemedText style={styles.addTipoButtonText}>Agregar</ThemedText>
              </TouchableOpacity>
            </ThemedView>
            {partesInternas.map((parte, index) => {
              const globalIndex = partesInteresadas.indexOf(parte);
              return renderParteInteresada(parte, index, globalIndex);
            })}
          </ThemedView>

          {/* Sección EXTERNAS */}
          <ThemedView style={styles.tipoSection}>
            <ThemedView style={styles.tipoHeader}>
              <ThemedText style={styles.tipoTitle}>EXTERNAS</ThemedText>
              <TouchableOpacity style={styles.addTipoButton} onPress={() => addParteInteresada('EXTERNA')}>
                <Ionicons name="add" size={20} color="#FFFFFF" />
                <ThemedText style={styles.addTipoButtonText}>Agregar</ThemedText>
              </TouchableOpacity>
            </ThemedView>
            {partesExternas.map((parte, index) => {
              const globalIndex = partesInteresadas.indexOf(parte);
              return renderParteInteresada(parte, index, globalIndex);
            })}
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
              onPress={isCreating ? saveMatrixHandler : updateMatrixHandler}
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
        title="Matriz de Análisis de Partes Interesadas"
      />
      <SlideMenu
        isVisible={isMenuVisible}
        onClose={() => setIsMenuVisible(false)}
        navigation={navigation}
      />
      {isCreating || editingMatrix ? (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.formWrapper}>
          {renderForm()}
        </ScrollView>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {hasCurrentMarca && (
            <TouchableOpacity style={styles.addButton} onPress={startCreating}>
              <ThemedView style={styles.addButtonContent}>
                {getActionIcon('add')}
                <ThemedText style={styles.addButtonText}>Nueva Matriz</ThemedText>
              </ThemedView>
            </TouchableOpacity>
          )}
          {renderMatrixList()}
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    textTransform: 'uppercase',
    textAlign: 'center',
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
  parteItem: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
  },
  parteItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  parteItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    flex: 1,
  },
  parteItemHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  removeParteButton: {
    padding: 4,
  },
  parteItemContent: {
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
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    backgroundColor: '#FFF',
    overflow: 'hidden',
  },
  picker: {
    height: Platform.OS === 'ios' ? 200 : 50,
  },
  calculatedValue: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#F5F5F5',
    minHeight: 50,
    justifyContent: 'center',
  },
  calculatedValueText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
  },
  strategyValue: {
    backgroundColor: '#E8F5E9',
  },
  strategyValueText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
    textAlign: 'center',
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

