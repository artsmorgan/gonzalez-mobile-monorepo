import React, { useState, useCallback, useMemo } from 'react';
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
  createProcessIndicatorMatrix,
  updateProcessIndicatorMatrix,
  deleteProcessIndicatorMatrix,
  listProcessIndicatorMatrixByCorpo,
} from '@/hooks/evaluationFunctions';
import { eventBus } from '@/hooks/eventBus';

type ProcessIndicatorMatrixScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ProcessIndicatorMatrix'>;

interface Proceso {
  proceso: string;
  criterio_medicion: string;
  meta: string;
  indicador: string;
  periodicidad_calculo: string;
  responsable: string;
  mes_1: string; // Enero
  mes_2: string; // Febrero
  mes_3: string; // Marzo
  mes_4: string; // Abril
  mes_5: string; // Mayo
  mes_6: string; // Junio
  mes_7: string; // Julio
  mes_8: string; // Agosto
  mes_9: string; // Septiembre
  mes_10: string; // Octubre
  mes_11: string; // Noviembre
  mes_12: string; // Diciembre
}

interface ProcessIndicatorMatrix {
  id: string;
  id_local: string;
  procesos: string | null; // JSON string of Proceso[]
  created_at: string;
  synced?: boolean;
}

interface EditingProcessIndicatorMatrix {
  id: string | null;
  id_local: string;
  procesos: Proceso[];
}

const MESES = [
  { label: 'Enero', key: 'mes_1', index: 0 },
  { label: 'Febrero', key: 'mes_2', index: 1 },
  { label: 'Marzo', key: 'mes_3', index: 2 },
  { label: 'Abril', key: 'mes_4', index: 3 },
  { label: 'Mayo', key: 'mes_5', index: 4 },
  { label: 'Junio', key: 'mes_6', index: 5 },
  { label: 'Julio', key: 'mes_7', index: 6 },
  { label: 'Agosto', key: 'mes_8', index: 7 },
  { label: 'Septiembre', key: 'mes_9', index: 8 },
  { label: 'Octubre', key: 'mes_10', index: 9 },
  { label: 'Noviembre', key: 'mes_11', index: 10 },
  { label: 'Diciembre', key: 'mes_12', index: 11 },
];

const ESTANDAR_OPTIONS = [
  { label: 'Seleccionar', value: '' },
  { label: 'Cumple con el estándar', value: 'Cumple con el estándar' },
  { label: 'No cumple con el estándar', value: 'No cumple con el estándar' },
];

export default function ProcessIndicatorMatrixScreen() {
  const { employee, refreshAccessToken, logout } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<ProcessIndicatorMatrixScreenNavigationProp>();

  // Data states
  const [matrices, setMatrices] = useState<ProcessIndicatorMatrix[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasCurrentMarca, setHasCurrentMarca] = useState<boolean>(false);

  // Editing state
  const [editingRecord, setEditingRecord] = useState<EditingProcessIndicatorMatrix | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form states
  const [procesos, setProcesos] = useState<Proceso[]>([]);

  // Expanded states
  const [expandedProcesoIndices, setExpandedProcesoIndices] = useState<number[]>([]);

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
        const result = await listProcessIndicatorMatrixByCorpo({
          corpo_id: corpoId,
          refreshAccessToken,
          logout,
        });

        if (result.status && result.data) {
          setMatrices(result.data as ProcessIndicatorMatrix[]);
        } else {
          setMatrices([]);
        }
      } else {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const matricesCache = cache.filter((item: any) => item.type === 'process_indicator_matrix');
          setMatrices(matricesCache);
        } else {
          setMatrices([]);
        }
      }
    } catch (err) {
      console.error('Error fetching matrices:', err);
      setError('Error al cargar las matrices de indicador de procesos');
      try {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const matricesCache = cache.filter((item: any) => item.type === 'process_indicator_matrix');
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
    setProcesos([]);
    setExpandedProcesoIndices([]);
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

  const startEditing = (record: ProcessIndicatorMatrix) => {
    setIsCreating(false);
    let procesosArray: Proceso[] = [];

    if (record.procesos) {
      try {
        procesosArray = JSON.parse(record.procesos);
        if (!Array.isArray(procesosArray)) procesosArray = [];
      } catch (e) {
        procesosArray = [];
      }
    }

    setEditingRecord({
      id: record.id,
      id_local: record.id_local,
      procesos: procesosArray,
    });

    setProcesos(procesosArray);
    setExpandedProcesoIndices(procesosArray.map((_, i) => i));
  };

  const cancelEditing = () => {
    setEditingRecord(null);
    resetForm();
  };

  const addProceso = () => {
    const newProceso: Proceso = {
      proceso: '',
      criterio_medicion: '',
      meta: '',
      indicador: '',
      periodicidad_calculo: '',
      responsable: '',
      mes_1: '',
      mes_2: '',
      mes_3: '',
      mes_4: '',
      mes_5: '',
      mes_6: '',
      mes_7: '',
      mes_8: '',
      mes_9: '',
      mes_10: '',
      mes_11: '',
      mes_12: '',
    };
    setProcesos([...procesos, newProceso]);
    setExpandedProcesoIndices([...expandedProcesoIndices, procesos.length]);
  };

  const updateProceso = (index: number, field: keyof Proceso, value: string) => {
    const newProcesos = [...procesos];
    newProcesos[index] = {
      ...newProcesos[index],
      [field]: value,
    };
    setProcesos(newProcesos);
  };

  const removeProceso = (index: number) => {
    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas eliminar este proceso?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            setProcesos(procesos.filter((_, i) => i !== index));
            setExpandedProcesoIndices(expandedProcesoIndices.filter(i => i !== index).map(i => i > index ? i - 1 : i));
          },
        },
      ]
    );
  };

  const toggleProcesoExpansion = (index: number) => {
    setExpandedProcesoIndices(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  // Calcular estadísticas para la sección inferior
  const calcularEstadisticas = useMemo(() => {
    const stats = {
      procesosSatisfactorios: new Array(12).fill(0),
      totalProcesos: new Array(12).fill(0),
      resultadoMensual: new Array(12).fill(0),
    };

    procesos.forEach((proceso) => {
      MESES.forEach((mes, mesIndex) => {
        const valor = proceso[mes.key as keyof Proceso] as string;
        if (valor === 'Cumple con el estándar') {
          stats.procesosSatisfactorios[mesIndex]++;
          stats.totalProcesos[mesIndex]++;
        } else if (valor === 'No cumple con el estándar') {
          stats.totalProcesos[mesIndex]++;
        }
      });
    });

    // Calcular resultado mensual (porcentaje)
    stats.resultadoMensual = stats.procesosSatisfactorios.map((satisfactorios, index) => {
      const total = stats.totalProcesos[index];
      if (total === 0) return 0;
      return Math.round((satisfactorios / total) * 100);
    });

    // Calcular resultados finales
    const procesosSatisfactoriosFinal = stats.procesosSatisfactorios.reduce((a, b) => a + b, 0);
    const totalProcesosFinal = stats.totalProcesos.reduce((a, b) => a + b, 0);
    const resultadoMensualFinal = totalProcesosFinal > 0 
      ? Math.round((procesosSatisfactoriosFinal / totalProcesosFinal) * 100) 
      : 0;

    return {
      ...stats,
      procesosSatisfactoriosFinal,
      totalProcesosFinal,
      resultadoMensualFinal,
    };
  }, [procesos]);

  const saveMatrixHandler = async () => {
    const currentMarca = await AsyncStorage.getItem('current_marca');
    if (!currentMarca) {
      Alert.alert('Error', 'No se encontró la marca actual');
      return;
    }

    const currentMarcaData = JSON.parse(currentMarca);

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas guardar esta matriz de indicador de procesos?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const requestData = {
                marca_id: currentMarcaData.id,
                procesos: procesos.length > 0 ? JSON.stringify(procesos) : null,
              };

              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await createProcessIndicatorMatrix({
                  requestData,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Matriz de indicador de procesos guardada correctamente');
                  cancelCreating();
                  fetchMatrices();
                } else {
                  Alert.alert('Error', result.message || 'Error al guardar la matriz de indicador de procesos');
                }
              } else {
                const localId = generateRandomId();

                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: localId,
                  action: 'create',
                  type: 'process_indicator_matrix',
                  payload: requestData,
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                const cache = cacheStr ? JSON.parse(cacheStr) : [];

                const newRecordCache: ProcessIndicatorMatrix = {
                  id: '',
                  id_local: localId,
                  procesos: procesos.length > 0 ? JSON.stringify(procesos) : null,
                  created_at: new Date().toISOString(),
                  synced: false,
                };

                cache.push({ ...newRecordCache, type: 'process_indicator_matrix' });
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(cache));

                Alert.alert('Modo Offline', 'Matriz de indicador de procesos registrada localmente. Se sincronizará cuando haya conexión.');
                cancelCreating();
                fetchMatrices();
              }
            } catch (err) {
              console.error('Error saving matrix:', err);
              Alert.alert('Error', 'No se pudo guardar la matriz de indicador de procesos');
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
      '¿Estás seguro de que deseas actualizar esta matriz de indicador de procesos?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const requestData = {
                procesos: procesos.length > 0 ? JSON.stringify(procesos) : null,
              };

              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await updateProcessIndicatorMatrix({
                  id: recordId,
                  requestData,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Matriz de indicador de procesos actualizada correctamente');
                  cancelEditing();
                  fetchMatrices();
                } else {
                  Alert.alert('Error', result.message || 'Error al actualizar la matriz de indicador de procesos');
                }
              } else {
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: recordId,
                  action: 'update',
                  type: 'process_indicator_matrix',
                  payload: requestData,
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                if (cacheStr) {
                  const cache = JSON.parse(cacheStr);
                  const updatedCache = cache.map((item: any) => {
                    if ((item.id === recordId || item.id_local === recordId) && item.type === 'process_indicator_matrix') {
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

                Alert.alert('Modo Offline', 'Matriz de indicador de procesos actualizada localmente. Se sincronizará cuando haya conexión.');
                cancelEditing();
                fetchMatrices();
              }
            } catch (err) {
              console.error('Error updating matrix:', err);
              Alert.alert('Error', 'No se pudo actualizar la matriz de indicador de procesos');
            }
          },
        },
      ]
    );
  };

  const deleteMatrixHandler = async (record: ProcessIndicatorMatrix) => {
    const recordId = record.id || record.id_local;
    if (!recordId) {
      Alert.alert('Error', 'ID de registro no encontrado para eliminar');
      return;
    }

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas eliminar esta matriz de indicador de procesos?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await deleteProcessIndicatorMatrix({
                  id: recordId,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Matriz de indicador de procesos eliminada correctamente');
                  fetchMatrices();
                } else {
                  Alert.alert('Error', result.message || 'Error al eliminar la matriz de indicador de procesos');
                }
              } else {
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: recordId,
                  action: 'delete',
                  type: 'process_indicator_matrix',
                  payload: {},
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                if (cacheStr) {
                  const cache = JSON.parse(cacheStr);
                  const updatedCache = cache.filter((item: any) => !((item.id === recordId || item.id_local === recordId) && item.type === 'process_indicator_matrix'));
                  await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                }

                Alert.alert('Modo Offline', 'Matriz de indicador de procesos marcada para eliminación localmente. Se sincronizará cuando haya conexión.');
                fetchMatrices();
              }
            } catch (err) {
              console.error('Error deleting matrix:', err);
              Alert.alert('Error', 'No se pudo eliminar la matriz de indicador de procesos');
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
      case 'matrix': return <Ionicons name="stats-chart" size={24} color='#000000' />;
      case 'add': return <Ionicons name="add" size={24} color='#FFFFFF' />;
      case 'cancel': return <Ionicons name="close" size={24} color='#FFFFFF' />;
      case 'confirm': return <Ionicons name="checkmark" size={24} color='#FFFFFF' />;
      case 'delete': return <Ionicons name="trash" size={24} color='#FFFFFF' />;
      case 'edit': return <Ionicons name="pencil" size={20} color="#FFFFFF" />;
      default: return <Ionicons name="stats-chart" size={24} color='#000000' />;
    }
  };

  const renderMatrixList = () => {
    if (isLoading) {
      return (
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Cargando matrices de indicador de procesos...</ThemedText>
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
          <ThemedText style={styles.emptyText}>No hay matrices de indicador de procesos registradas.</ThemedText>
        </ThemedView>
      );
    }

    return (
      <ThemedView style={styles.listContainer}>
        {matrices.map((record) => {
          let procesosArray: Proceso[] = [];
          if (record.procesos) {
            try {
              procesosArray = JSON.parse(record.procesos);
            } catch (e) {
              procesosArray = [];
            }
          }

          return (
            <ThemedView key={record.id || record.id_local} style={styles.listItem}>
              <ThemedView style={styles.listItemHeader}>
                <ThemedView style={styles.listItemContent}>
                  <ThemedText style={styles.listItemTitle}>
                    Matriz de Indicador de Procesos
                  </ThemedText>
                  <ThemedText style={styles.listItemSubtitle}>
                    Procesos: {procesosArray.length} | Fecha: {new Date(record.created_at).toLocaleDateString('es-CR')}
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

  const renderProceso = (proceso: Proceso, index: number) => {
    const isExpanded = expandedProcesoIndices.includes(index);

    return (
      <ThemedView key={index} style={styles.procesoItem}>
        <TouchableOpacity
          style={styles.procesoHeader}
          onPress={() => toggleProcesoExpansion(index)}
        >
          <ThemedView style={styles.procesoHeaderContent}>
            <ThemedText style={styles.procesoHeaderText}>
              Proceso {index + 1}: {proceso.proceso || 'Sin nombre'}
            </ThemedText>
          </ThemedView>
          <ThemedView style={styles.procesoHeaderActions}>
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                removeProceso(index);
              }}
              style={styles.removeProcesoButton}
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
          <ThemedView style={styles.procesoContent}>
            {/* Proceso */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Proceso</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder="Proceso"
                placeholderTextColor="#999"
                value={proceso.proceso}
                onChangeText={(text) => updateProceso(index, 'proceso', text)}
              />
            </ThemedView>

            {/* Criterio de medición */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Criterio de medición</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder="Criterio de medición"
                placeholderTextColor="#999"
                value={proceso.criterio_medicion}
                onChangeText={(text) => updateProceso(index, 'criterio_medicion', text)}
              />
            </ThemedView>

            {/* Meta */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Meta</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder="Meta"
                placeholderTextColor="#999"
                value={proceso.meta}
                onChangeText={(text) => updateProceso(index, 'meta', text)}
              />
            </ThemedView>

            {/* Indicador */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Indicador</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder="Indicador"
                placeholderTextColor="#999"
                value={proceso.indicador}
                onChangeText={(text) => updateProceso(index, 'indicador', text)}
              />
            </ThemedView>

            {/* Periodicidad de cálculo */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Periodicidad de cálculo</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder="Periodicidad de cálculo"
                placeholderTextColor="#999"
                value={proceso.periodicidad_calculo}
                onChangeText={(text) => updateProceso(index, 'periodicidad_calculo', text)}
              />
            </ThemedView>

            {/* Responsable */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Responsable</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder="Responsable"
                placeholderTextColor="#999"
                value={proceso.responsable}
                onChangeText={(text) => updateProceso(index, 'responsable', text)}
              />
            </ThemedView>

            {/* Meses */}
            <ThemedView style={styles.mesesContainer}>
              <ThemedText style={styles.mesesTitle}>Meses del Año</ThemedText>
              <View style={styles.mesesGrid}>
                {MESES.map((mes) => (
                  <ThemedView key={mes.key} style={styles.mesItem}>
                    <ThemedText style={styles.mesLabel}>{mes.label}</ThemedText>
                    <ThemedView style={styles.pickerContainer}>
                      <Picker
                        selectedValue={proceso[mes.key as keyof Proceso] as string}
                        onValueChange={(value) => updateProceso(index, mes.key as keyof Proceso, value)}
                        style={styles.picker}
                      >
                        {ESTANDAR_OPTIONS.map((option) => (
                          <Picker.Item
                            key={option.value}
                            label={option.label}
                            value={option.value}
                          />
                        ))}
                      </Picker>
                    </ThemedView>
                  </ThemedView>
                ))}
              </View>
            </ThemedView>
          </ThemedView>
        )}
      </ThemedView>
    );
  };

  const renderEstadisticas = () => {
    if (procesos.length === 0) return null;

    return (
      <ThemedView style={styles.estadisticasContainer}>
        <ThemedText style={styles.estadisticasTitle}>Resumen de Resultados</ThemedText>
        
        {/* Procesos satisfactorios */}
        <ThemedView style={styles.estadisticaRow}>
          <ThemedText style={styles.estadisticaLabel}>Procesos satisfactorios</ThemedText>
          <View style={styles.estadisticaMeses}>
            {calcularEstadisticas.procesosSatisfactorios.map((valor, index) => (
              <ThemedView key={index} style={styles.estadisticaCelda}>
                <ThemedText style={styles.estadisticaMesLabel}>{MESES[index].label}</ThemedText>
                <ThemedText style={styles.estadisticaValor}>{valor}</ThemedText>
              </ThemedView>
            ))}
          </View>
          <View style={styles.estadisticaFinalRow}>
            <ThemedView style={[styles.estadisticaCeldaFinal, styles.estadisticaFinal]}>
              <ThemedText style={styles.estadisticaFinalLabel}>Resultado Final</ThemedText>
              <ThemedText style={styles.estadisticaValor}>{calcularEstadisticas.procesosSatisfactoriosFinal}</ThemedText>
            </ThemedView>
          </View>
        </ThemedView>

        {/* Total de procesos */}
        <ThemedView style={styles.estadisticaRow}>
          <ThemedText style={styles.estadisticaLabel}>Total de procesos</ThemedText>
          <View style={styles.estadisticaMeses}>
            {calcularEstadisticas.totalProcesos.map((valor, index) => (
              <ThemedView key={index} style={styles.estadisticaCelda}>
                <ThemedText style={styles.estadisticaMesLabel}>{MESES[index].label}</ThemedText>
                <ThemedText style={styles.estadisticaValor}>{valor}</ThemedText>
              </ThemedView>
            ))}
          </View>
          <View style={styles.estadisticaFinalRow}>
            <ThemedView style={[styles.estadisticaCeldaFinal, styles.estadisticaFinal]}>
              <ThemedText style={styles.estadisticaFinalLabel}>Resultado Final</ThemedText>
              <ThemedText style={styles.estadisticaValor}>{calcularEstadisticas.totalProcesosFinal}</ThemedText>
            </ThemedView>
          </View>
        </ThemedView>

        {/* Resultado mensual */}
        <ThemedView style={styles.estadisticaRow}>
          <ThemedText style={styles.estadisticaLabel}>Resultado mensual</ThemedText>
          <View style={styles.estadisticaMeses}>
            {calcularEstadisticas.resultadoMensual.map((valor, index) => (
              <ThemedView key={index} style={styles.estadisticaCelda}>
                <ThemedText style={styles.estadisticaMesLabel}>{MESES[index].label}</ThemedText>
                <ThemedText style={styles.estadisticaValor}>{valor}%</ThemedText>
              </ThemedView>
            ))}
          </View>
          <View style={styles.estadisticaFinalRow}>
            <ThemedView style={[styles.estadisticaCeldaFinal, styles.estadisticaFinal]}>
              <ThemedText style={styles.estadisticaFinalLabel}>Resultado Final</ThemedText>
              <ThemedText style={styles.estadisticaValor}>{calcularEstadisticas.resultadoMensualFinal}%</ThemedText>
            </ThemedView>
          </View>
        </ThemedView>
      </ThemedView>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <AppHeader onMenuPress={handleMenuPress} title="Matriz de Indicador de Procesos" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <ThemedView style={styles.contentContainer}>
          <ThemedText type="title" style={styles.screenTitle}>
            {getActionIcon('matrix')} Matriz de Indicador de Procesos
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
              {procesos.map((proceso, index) => renderProceso(proceso, index))}

              <TouchableOpacity
                style={styles.addProcesoButton}
                onPress={addProceso}
              >
                <Ionicons name="add-circle" size={24} color="#4CAF50" />
                <ThemedText style={styles.addProcesoButtonText}>Agregar Proceso</ThemedText>
              </TouchableOpacity>

              {renderEstadisticas()}

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
                <ThemedText style={styles.createButtonText}>Crear Nueva Matriz de Indicador de Procesos</ThemedText>
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
        currentRoute="ProcessIndicatorMatrix"
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
  procesoItem: {
    marginBottom: 15,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  procesoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#F5F5F5',
  },
  procesoHeaderContent: {
    flex: 1,
    marginRight: 10,
  },
  procesoHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  procesoHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  removeProcesoButton: {
    padding: 4,
  },
  procesoContent: {
    padding: 15,
  },
  mesesContainer: {
    marginTop: 15,
    padding: 15,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
  },
  mesesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 15,
  },
  mesesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
  },
  mesItem: {
    width: '48%',
    marginBottom: 15,
    flexShrink: 0,
  },
  mesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 5,
  },
  estadisticasContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1976D2',
  },
  estadisticasTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 15,
    textAlign: 'center',
  },
  estadisticaRow: {
    marginBottom: 15,
  },
  estadisticaLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  estadisticaMeses: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  estadisticaCelda: {
    width: '31%',
    minWidth: 80,
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  estadisticaMesLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
    textAlign: 'center',
  },
  estadisticaFinal: {
    backgroundColor: '#FFF9C4',
    borderColor: '#FBC02D',
    borderWidth: 2,
  },
  estadisticaFinalRow: {
    width: '100%',
    marginTop: 10,
  },
  estadisticaCeldaFinal: {
    width: '100%',
    padding: 12,
    backgroundColor: '#FFF9C4',
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#FBC02D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  estadisticaFinalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  estadisticaValor: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000000',
  },
  addProcesoButton: {
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
  addProcesoButtonText: {
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

