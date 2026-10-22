import React, { useState, useCallback, useRef } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
  View,
  Image,
} from 'react-native';
import SignatureScreen from "react-native-signature-canvas";
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
  createBusinessQualityObjectives,
  updateBusinessQualityObjectives,
  deleteBusinessQualityObjectives,
  listBusinessQualityObjectivesByCorpo,
} from '@/hooks/evaluationFunctions';
import { eventBus } from '@/hooks/eventBus';

type BusinessQualityObjectivesScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'BusinessQualityObjectives'>;

interface Meta {
  año: string;
  valor: string;
  checked: boolean;
}

interface ObjetivoAmbito {
  objetivo_general: string;
  indicador: string;
  formula: string;
  metas: Meta[];
  periodicidad_revision: string;
  relacion_politica_calidad: string;
}

interface AmbitosData {
  clientes: ObjetivoAmbito[];
  recurso_humano: ObjetivoAmbito[];
  procesos: ObjetivoAmbito[];
}

interface BusinessQualityObjectives {
  id: string;
  id_local: string;
  ambitos: string | null;
  nombre_aprobado: string | null;
  firma_aprobado: string | null;
  created_at: string;
  synced?: boolean;
}

interface EditingBusinessQualityObjectives {
  id: string | null;
  id_local: string;
  ambitos: string;
  nombre_aprobado: string;
  firma_aprobado: string;
}

export default function BusinessQualityObjectivesScreen() {
  const { employee, refreshAccessToken, logout } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<BusinessQualityObjectivesScreenNavigationProp>();

  // Data states
  const [objectives, setObjectives] = useState<BusinessQualityObjectives[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasCurrentMarca, setHasCurrentMarca] = useState<boolean>(false);

  // Editing state
  const [isCreating, setIsCreating] = useState(false);
  const [editingObjective, setEditingObjective] = useState<EditingBusinessQualityObjectives | null>(null);

  // Form fields - Ambitos
  const [ambitosData, setAmbitosData] = useState<AmbitosData>({
    clientes: [],
    recurso_humano: [],
    procesos: [],
  });

  // Approval fields
  const [nombreAprobado, setNombreAprobado] = useState('');
  const [firmaAprobado, setFirmaAprobado] = useState<string | null>(null);

  // Expandable states
  const [expandedClientesIndices, setExpandedClientesIndices] = useState<number[]>([]);
  const [expandedRecursoHumanoIndices, setExpandedRecursoHumanoIndices] = useState<number[]>([]);
  const [expandedProcesosIndices, setExpandedProcesosIndices] = useState<number[]>([]);

  // Signature modal states
  const [isSignatureModalVisible, setIsSignatureModalVisible] = useState(false);
  const [signatureKey, setSignatureKey] = useState(0);
  const signatureRef = useRef<any>(null);

  const getConnectionStatus = async (): Promise<boolean> => {
    try {
      const networkState = await Network.getNetworkStateAsync();
      return networkState.isConnected ?? false;
    } catch (error) {
      console.error('Error checking network:', error);
      return false;
    }
  };

  const formatSignatureForDisplay = (signature: string | null): string | null => {
    if (!signature) return null;
    if (signature.startsWith('data:')) return signature;
    return `data:image/png;base64,${signature}`;
  };

  const getBase64Only = (signature: string | null): string | null => {
    if (!signature) return null;
    if (signature.startsWith('data:image')) {
      return signature.split(',')[1] || signature;
    }
    return signature;
  };

  const generateRandomId = (): string => {
    return `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const fetchObjectives = useCallback(async () => {
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
        const result = await listBusinessQualityObjectivesByCorpo({
          corpo_id: corpoId,
          refreshAccessToken,
          logout,
        });

        if (result.status && result.data) {
          setObjectives(result.data as BusinessQualityObjectives[]);
        } else {
          setObjectives([]);
        }
      } else {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const objectivesCache = cache.filter((item: any) => item.type === 'business_quality_objectives');
          setObjectives(objectivesCache);
        } else {
          setObjectives([]);
        }
      }
    } catch (err) {
      console.error('Error fetching objectives:', err);
      setError('Error al cargar los objetivos empresariales de calidad');
      try {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const objectivesCache = cache.filter((item: any) => item.type === 'business_quality_objectives');
          setObjectives(objectivesCache);
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
      fetchObjectives();
      eventBus.on('connectionRestored', fetchObjectives);
      return () => {
        eventBus.off('connectionRestored', fetchObjectives);
      };
    }, [fetchObjectives])
  );

  const resetForm = () => {
    setAmbitosData({
      clientes: [],
      recurso_humano: [],
      procesos: [],
    });
    setNombreAprobado('');
    setFirmaAprobado(null);
    setExpandedClientesIndices([]);
    setExpandedRecursoHumanoIndices([]);
    setExpandedProcesosIndices([]);
  };

  const startCreating = () => {
    setIsCreating(true);
    setEditingObjective(null);
    resetForm();
  };

  const cancelCreating = () => {
    setIsCreating(false);
    resetForm();
  };

  const startEditing = (objective: BusinessQualityObjectives) => {
    setIsCreating(false);
    setEditingObjective({
      id: objective.id,
      id_local: objective.id_local,
      ambitos: objective.ambitos || '',
      nombre_aprobado: objective.nombre_aprobado || '',
      firma_aprobado: objective.firma_aprobado || '',
    });

    if (objective.ambitos) {
      try {
        const parsed = JSON.parse(objective.ambitos);
        setAmbitosData(parsed);
      } catch {
        setAmbitosData({
          clientes: [],
          recurso_humano: [],
          procesos: [],
        });
      }
    } else {
      setAmbitosData({
        clientes: [],
        recurso_humano: [],
        procesos: [],
      });
    }
    setNombreAprobado(objective.nombre_aprobado || '');
    setFirmaAprobado(formatSignatureForDisplay(objective.firma_aprobado));
  };

  const cancelEditing = () => {
    setEditingObjective(null);
    resetForm();
  };

  // Clientes functions
  const addCliente = () => {
    setAmbitosData({
      ...ambitosData,
      clientes: [
        ...ambitosData.clientes,
        {
          objetivo_general: '',
          indicador: '',
          formula: '',
          metas: [],
          periodicidad_revision: '',
          relacion_politica_calidad: '',
        },
      ],
    });
  };

  const removeCliente = (index: number) => {
    const updated = [...ambitosData.clientes];
    updated.splice(index, 1);
    setAmbitosData({ ...ambitosData, clientes: updated });
    setExpandedClientesIndices(expandedClientesIndices.filter(i => i !== index).map(i => i > index ? i - 1 : i));
  };

  const updateCliente = (index: number, field: keyof ObjetivoAmbito, value: any) => {
    const updated = [...ambitosData.clientes];
    updated[index] = { ...updated[index], [field]: value };
    setAmbitosData({ ...ambitosData, clientes: updated });
  };

  const toggleClienteExpansion = (index: number) => {
    if (expandedClientesIndices.includes(index)) {
      setExpandedClientesIndices(expandedClientesIndices.filter(i => i !== index));
    } else {
      setExpandedClientesIndices([...expandedClientesIndices, index]);
    }
  };

  // Recurso Humano functions
  const addRecursoHumano = () => {
    setAmbitosData({
      ...ambitosData,
      recurso_humano: [
        ...ambitosData.recurso_humano,
        {
          objetivo_general: '',
          indicador: '',
          formula: '',
          metas: [],
          periodicidad_revision: '',
          relacion_politica_calidad: '',
        },
      ],
    });
  };

  const removeRecursoHumano = (index: number) => {
    const updated = [...ambitosData.recurso_humano];
    updated.splice(index, 1);
    setAmbitosData({ ...ambitosData, recurso_humano: updated });
    setExpandedRecursoHumanoIndices(expandedRecursoHumanoIndices.filter(i => i !== index).map(i => i > index ? i - 1 : i));
  };

  const updateRecursoHumano = (index: number, field: keyof ObjetivoAmbito, value: any) => {
    const updated = [...ambitosData.recurso_humano];
    updated[index] = { ...updated[index], [field]: value };
    setAmbitosData({ ...ambitosData, recurso_humano: updated });
  };

  const toggleRecursoHumanoExpansion = (index: number) => {
    if (expandedRecursoHumanoIndices.includes(index)) {
      setExpandedRecursoHumanoIndices(expandedRecursoHumanoIndices.filter(i => i !== index));
    } else {
      setExpandedRecursoHumanoIndices([...expandedRecursoHumanoIndices, index]);
    }
  };

  // Procesos functions
  const addProceso = () => {
    setAmbitosData({
      ...ambitosData,
      procesos: [
        ...ambitosData.procesos,
        {
          objetivo_general: '',
          indicador: '',
          formula: '',
          metas: [],
          periodicidad_revision: '',
          relacion_politica_calidad: '',
        },
      ],
    });
  };

  const removeProceso = (index: number) => {
    const updated = [...ambitosData.procesos];
    updated.splice(index, 1);
    setAmbitosData({ ...ambitosData, procesos: updated });
    setExpandedProcesosIndices(expandedProcesosIndices.filter(i => i !== index).map(i => i > index ? i - 1 : i));
  };

  const updateProceso = (index: number, field: keyof ObjetivoAmbito, value: any) => {
    const updated = [...ambitosData.procesos];
    updated[index] = { ...updated[index], [field]: value };
    setAmbitosData({ ...ambitosData, procesos: updated });
  };

  const toggleProcesoExpansion = (index: number) => {
    if (expandedProcesosIndices.includes(index)) {
      setExpandedProcesosIndices(expandedProcesosIndices.filter(i => i !== index));
    } else {
      setExpandedProcesosIndices([...expandedProcesosIndices, index]);
    }
  };

  // Metas functions
  const addMeta = (ambitoType: 'clientes' | 'recurso_humano' | 'procesos', ambitoIndex: number) => {
    const updated = [...ambitosData[ambitoType]];
    updated[ambitoIndex] = {
      ...updated[ambitoIndex],
      metas: [
        ...updated[ambitoIndex].metas,
        { año: '', valor: '', checked: false },
      ],
    };
    setAmbitosData({ ...ambitosData, [ambitoType]: updated });
  };

  const removeMeta = (ambitoType: 'clientes' | 'recurso_humano' | 'procesos', ambitoIndex: number, metaIndex: number) => {
    const updated = [...ambitosData[ambitoType]];
    updated[ambitoIndex] = {
      ...updated[ambitoIndex],
      metas: updated[ambitoIndex].metas.filter((_, i) => i !== metaIndex),
    };
    setAmbitosData({ ...ambitosData, [ambitoType]: updated });
  };

  const updateMeta = (ambitoType: 'clientes' | 'recurso_humano' | 'procesos', ambitoIndex: number, metaIndex: number, field: keyof Meta, value: any) => {
    const updated = [...ambitosData[ambitoType]];
    const metas = [...updated[ambitoIndex].metas];
    metas[metaIndex] = { ...metas[metaIndex], [field]: value };
    updated[ambitoIndex] = { ...updated[ambitoIndex], metas };
    setAmbitosData({ ...ambitosData, [ambitoType]: updated });
  };

  const openSignatureModal = () => {
    setIsSignatureModalVisible(true);
    setSignatureKey(prev => prev + 1);
  };

  const closeSignatureModal = () => {
    setIsSignatureModalVisible(false);
  };

  const clearSignatureInModal = () => {
    setSignatureKey(prev => prev + 1);
    if (signatureRef.current) {
      signatureRef.current.clearSignature();
    }
  };

  const handleSignatureRead = (signature: string) => {
    if (signature) {
      let formattedSignature = signature;
      if (!signature.startsWith('data:')) {
        formattedSignature = `data:image/png;base64,${signature}`;
      }
      setFirmaAprobado(formattedSignature);
      setIsSignatureModalVisible(false);
    } else {
      Alert.alert('Error', 'No se pudo obtener la firma. Por favor, intente nuevamente.');
    }
  };

  const acceptSignature = () => {
    if (signatureRef.current) {
      signatureRef.current.readSignature();
    } else {
      Alert.alert('Error', 'Debe dibujar una firma antes de aceptar');
    }
  };

  const saveObjectiveHandler = async () => {
    const currentMarca = await AsyncStorage.getItem('current_marca');
    if (!currentMarca) {
      Alert.alert('Error', 'No se encontró la marca actual');
      return;
    }

    const currentMarcaData = JSON.parse(currentMarca);

    Alert.alert('Confirmar', '¿Estás seguro de que deseas guardar estos objetivos empresariales de calidad?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: async () => {
          try {
            const requestData = {
              marca_id: currentMarcaData.id,
              ambitos: JSON.stringify(ambitosData),
              nombre_aprobado: nombreAprobado.trim() || null,
              firma_aprobado: getBase64Only(firmaAprobado),
            };

            const isConnected = await getConnectionStatus();

            if (isConnected) {
              const result = await createBusinessQualityObjectives({
                requestData,
                refreshAccessToken,
                logout,
              });

              if (result.status) {
                Alert.alert('Éxito', 'Objetivos empresariales de calidad creados correctamente');
                setIsCreating(false);
                resetForm();
                fetchObjectives();
              } else {
                Alert.alert('Error', result.message || 'Error al crear los objetivos empresariales de calidad');
              }
            } else {
              const localId = generateRandomId();

              const actionsStr = await AsyncStorage.getItem('evaluations_actions');
              const actions = actionsStr ? JSON.parse(actionsStr) : [];
              actions.push({
                id: localId,
                action: 'create',
                type: 'business_quality_objectives',
                payload: requestData,
                synced: false,
              });
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

              const cacheStr = await AsyncStorage.getItem('evaluations_cache');
              const cache = cacheStr ? JSON.parse(cacheStr) : [];

              const newObjectiveCache: BusinessQualityObjectives = {
                id: '',
                id_local: localId,
                ambitos: JSON.stringify(ambitosData),
                nombre_aprobado: nombreAprobado.trim() || null,
                firma_aprobado: getBase64Only(firmaAprobado),
                created_at: new Date().toISOString(),
                synced: false,
              };

              cache.push({ ...newObjectiveCache, type: 'business_quality_objectives' });
              await AsyncStorage.setItem('evaluations_cache', JSON.stringify(cache));

              Alert.alert('Modo Offline', 'Objetivos empresariales de calidad registrados localmente. Se sincronizará cuando haya conexión.');
              setIsCreating(false);
              resetForm();
              fetchObjectives();
            }
          } catch (err) {
            console.error('Error saving objective:', err);
            Alert.alert('Error', 'No se pudo guardar los objetivos empresariales de calidad');
          }
        },
      },
    ]);
  };

  const updateObjectiveHandler = async () => {
    if (!editingObjective) return;

    const objectiveId = editingObjective.id || editingObjective.id_local;
    if (!objectiveId) {
      Alert.alert('Error', 'ID de objetivo no encontrado para actualizar');
      return;
    }

    Alert.alert('Confirmar', '¿Estás seguro de que deseas actualizar estos objetivos empresariales de calidad?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: async () => {
          try {
            const requestData = {
              ambitos: JSON.stringify(ambitosData),
              nombre_aprobado: nombreAprobado.trim() || null,
              firma_aprobado: getBase64Only(firmaAprobado),
            };

            const isConnected = await getConnectionStatus();

            if (isConnected) {
              const result = await updateBusinessQualityObjectives({
                id: objectiveId,
                requestData,
                refreshAccessToken,
                logout,
              });

              if (result.status) {
                Alert.alert('Éxito', 'Objetivos empresariales de calidad actualizados correctamente');
                cancelEditing();
                fetchObjectives();
              } else {
                Alert.alert('Error', result.message || 'Error al actualizar los objetivos empresariales de calidad');
              }
            } else {
              const actionsStr = await AsyncStorage.getItem('evaluations_actions');
              const actions = actionsStr ? JSON.parse(actionsStr) : [];
              actions.push({
                id: objectiveId,
                action: 'update',
                type: 'business_quality_objectives',
                payload: requestData,
                synced: false,
              });
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

              const cacheStr = await AsyncStorage.getItem('evaluations_cache');
              if (cacheStr) {
                const cache = JSON.parse(cacheStr);
                const updatedCache = cache.map((item: any) => {
                  if ((item.id === objectiveId || item.id_local === objectiveId) && item.type === 'business_quality_objectives') {
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

              Alert.alert('Actualizado offline', 'Los objetivos empresariales de calidad se actualizaron localmente y se sincronizarán cuando haya conexión');
              cancelEditing();
              fetchObjectives();
            }
          } catch (err) {
            console.error('Error updating objective:', err);
            Alert.alert('Error', 'Error al actualizar los objetivos empresariales de calidad');
          }
        },
      },
    ]);
  };

  const deleteObjectiveHandler = async (objective: BusinessQualityObjectives) => {
    Alert.alert('Confirmar', '¿Estás seguro de que deseas eliminar estos objetivos empresariales de calidad?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            const isConnected = await getConnectionStatus();
            const recordId = objective.id && !objective.id.startsWith('local_') ? objective.id : objective.id_local;

            if (isConnected && objective.id && !objective.id.startsWith('local_')) {
              const result = await deleteBusinessQualityObjectives({
                id: recordId,
                refreshAccessToken,
                logout,
              });

              if (result.status) {
                Alert.alert('Éxito', 'Objetivos empresariales de calidad eliminados correctamente');
                fetchObjectives();
              } else {
                Alert.alert('Error', result.message || 'Error al eliminar los objetivos empresariales de calidad');
              }
            } else {
              const actionsStr = await AsyncStorage.getItem('evaluations_actions');
              const actions = actionsStr ? JSON.parse(actionsStr) : [];
              actions.push({
                id: recordId,
                action: 'delete',
                payload: {},
                type: 'business_quality_objectives',
                synced: false,
              });
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

              const cacheStr = await AsyncStorage.getItem('evaluations_cache');
              if (cacheStr) {
                const cache = JSON.parse(cacheStr);
                const updatedCache = cache.filter((item: any) => !((item.id === recordId || item.id_local === recordId) && item.type === 'business_quality_objectives'));
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
              }

              Alert.alert('Eliminado offline', 'Los objetivos empresariales de calidad se eliminaron localmente y se sincronizarán cuando haya conexión');
              fetchObjectives();
            }
          } catch (err) {
            console.error('Error deleting objective:', err);
            Alert.alert('Error', 'Error al eliminar los objetivos empresariales de calidad');
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

  const renderObjectiveList = () => {
    if (isLoading) {
      return (
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Cargando objetivos empresariales de calidad...</ThemedText>
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

    if (objectives.length === 0) {
      return (
        <ThemedView style={styles.emptyContainer}>
          <ThemedText style={styles.emptyText}>No hay objetivos empresariales de calidad registrados.</ThemedText>
        </ThemedView>
      );
    }

    return (
      <ThemedView style={styles.listContainer}>
        {objectives.map((objective) => (
          <ThemedView key={objective.id || objective.id_local} style={styles.listItem}>
            <ThemedView style={styles.listItemHeader}>
              <ThemedView style={styles.listItemContent}>
                <ThemedText style={styles.listItemTitle}>
                  Objetivos Empresariales de Calidad
                </ThemedText>
                {objective.nombre_aprobado && (
                  <ThemedText style={styles.listItemSubtitle}>
                    Aprobado por: {objective.nombre_aprobado}
                  </ThemedText>
                )}
                {!objective.synced && (
                  <ThemedText style={styles.offlineBadge}>Sin sincronizar</ThemedText>
                )}
              </ThemedView>
              <ThemedView style={styles.listItemActions}>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => startEditing(objective)}
                >
                  {getActionIcon('edit')}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deleteObjectiveHandler(objective)}
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

  const renderAmbitoSection = (
    title: string,
    ambitoType: 'clientes' | 'recurso_humano' | 'procesos',
    items: ObjetivoAmbito[],
    expandedIndices: number[],
    onToggleExpansion: (index: number) => void,
    onAdd: () => void,
    onRemove: (index: number) => void
  ) => {
    return (
      <ThemedView style={styles.ambitoSection}>
        <ThemedView style={styles.ambitoHeader}>
          <ThemedText style={styles.ambitoTitle}>{title}</ThemedText>
          <TouchableOpacity style={styles.addAmbitoButton} onPress={onAdd}>
            <Ionicons name="add" size={20} color="#FFFFFF" />
            <ThemedText style={styles.addAmbitoButtonText}>Agregar</ThemedText>
          </TouchableOpacity>
        </ThemedView>

        {items.map((item, index) => {
          const isExpanded = expandedIndices.includes(index);
          return (
            <ThemedView key={index} style={styles.ambitoItem}>
              <TouchableOpacity
                style={styles.ambitoItemHeader}
                onPress={() => onToggleExpansion(index)}
              >
                <ThemedText style={styles.ambitoItemTitle}>
                  {title} {index + 1}
                </ThemedText>
                <ThemedView style={styles.ambitoItemHeaderActions}>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color="#000000"
                  />
                  <TouchableOpacity
                    onPress={() => onRemove(index)}
                    style={styles.removeAmbitoButton}
                  >
                    <Ionicons name="trash" size={18} color="#F44336" />
                  </TouchableOpacity>
                </ThemedView>
              </TouchableOpacity>

              {isExpanded && (
                <ThemedView style={styles.ambitoItemContent}>
                  {/* Objetivo General */}
                  <ThemedView style={styles.formSection}>
                    <ThemedText style={styles.label}>Objetivo General</ThemedText>
                    <TextInput
                      style={styles.input}
                      value={item.objetivo_general}
                      onChangeText={(text) => {
                        if (ambitoType === 'clientes') updateCliente(index, 'objetivo_general', text);
                        if (ambitoType === 'recurso_humano') updateRecursoHumano(index, 'objetivo_general', text);
                        if (ambitoType === 'procesos') updateProceso(index, 'objetivo_general', text);
                      }}
                      placeholder="Ingrese el objetivo general"
                      placeholderTextColor="#999"
                    />
                  </ThemedView>

                  {/* Indicador */}
                  <ThemedView style={styles.formSection}>
                    <ThemedText style={styles.label}>Indicador</ThemedText>
                    <TextInput
                      style={styles.input}
                      value={item.indicador}
                      onChangeText={(text) => {
                        if (ambitoType === 'clientes') updateCliente(index, 'indicador', text);
                        if (ambitoType === 'recurso_humano') updateRecursoHumano(index, 'indicador', text);
                        if (ambitoType === 'procesos') updateProceso(index, 'indicador', text);
                      }}
                      placeholder="Ingrese el indicador"
                      placeholderTextColor="#999"
                    />
                  </ThemedView>

                  {/* Fórmula */}
                  <ThemedView style={styles.formSection}>
                    <ThemedText style={styles.label}>Fórmula</ThemedText>
                    <TextInput
                      style={styles.input}
                      value={item.formula}
                      onChangeText={(text) => {
                        if (ambitoType === 'clientes') updateCliente(index, 'formula', text);
                        if (ambitoType === 'recurso_humano') updateRecursoHumano(index, 'formula', text);
                        if (ambitoType === 'procesos') updateProceso(index, 'formula', text);
                      }}
                      placeholder="Ingrese la fórmula"
                      placeholderTextColor="#999"
                    />
                  </ThemedView>

                  {/* Metas */}
                  <ThemedView style={styles.formSection}>
                    <ThemedText style={styles.label}>Metas</ThemedText>
                    {item.metas.map((meta, metaIndex) => (
                      <ThemedView key={metaIndex} style={styles.metaItem}>
                        <ThemedView style={styles.metaInputs}>
                          <TextInput
                            style={[styles.input, styles.metaAñoInput]}
                            value={meta.año}
                            onChangeText={(text) => updateMeta(ambitoType, index, metaIndex, 'año', text)}
                            placeholder="Año"
                            placeholderTextColor="#999"
                          />
                          <TextInput
                            style={[styles.input, styles.metaValorInput]}
                            value={meta.valor}
                            onChangeText={(text) => updateMeta(ambitoType, index, metaIndex, 'valor', text)}
                            placeholder="Valor"
                            placeholderTextColor="#999"
                          />
                          <TouchableOpacity
                            style={styles.checkbox}
                            onPress={() => updateMeta(ambitoType, index, metaIndex, 'checked', !meta.checked)}
                          >
                            {meta.checked && (
                              <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                            )}
                          </TouchableOpacity>
                        </ThemedView>
                        <TouchableOpacity
                          style={styles.removeMetaButton}
                          onPress={() => removeMeta(ambitoType, index, metaIndex)}
                        >
                          <Ionicons name="trash" size={16} color="#F44336" />
                        </TouchableOpacity>
                      </ThemedView>
                    ))}
                    <TouchableOpacity
                      style={styles.addMetaButton}
                      onPress={() => addMeta(ambitoType, index)}
                    >
                      <Ionicons name="add" size={18} color="#007AFF" />
                      <ThemedText style={styles.addMetaButtonText}>Agregar Meta</ThemedText>
                    </TouchableOpacity>
                  </ThemedView>

                  {/* Periodicidad de revisión */}
                  <ThemedView style={styles.formSection}>
                    <ThemedText style={styles.label}>Periodicidad de revisión</ThemedText>
                    <TextInput
                      style={styles.input}
                      value={item.periodicidad_revision}
                      onChangeText={(text) => {
                        if (ambitoType === 'clientes') updateCliente(index, 'periodicidad_revision', text);
                        if (ambitoType === 'recurso_humano') updateRecursoHumano(index, 'periodicidad_revision', text);
                        if (ambitoType === 'procesos') updateProceso(index, 'periodicidad_revision', text);
                      }}
                      placeholder="Ingrese la periodicidad de revisión"
                      placeholderTextColor="#999"
                    />
                  </ThemedView>

                  {/* Relación con la política de calidad */}
                  <ThemedView style={styles.formSection}>
                    <ThemedText style={styles.label}>Relación con la política de calidad</ThemedText>
                    <TextInput
                      style={styles.input}
                      value={item.relacion_politica_calidad}
                      onChangeText={(text) => {
                        if (ambitoType === 'clientes') updateCliente(index, 'relacion_politica_calidad', text);
                        if (ambitoType === 'recurso_humano') updateRecursoHumano(index, 'relacion_politica_calidad', text);
                        if (ambitoType === 'procesos') updateProceso(index, 'relacion_politica_calidad', text);
                      }}
                      placeholder="Ingrese la relación con la política de calidad"
                      placeholderTextColor="#999"
                    />
                  </ThemedView>
                </ThemedView>
              )}
            </ThemedView>
          );
        })}
      </ThemedView>
    );
  };

  const renderForm = () => {
    if (!isCreating && !editingObjective) return null;

    const signatureWebStyle = `
      .m-signature-pad {
        box-shadow: none;
        border: 2px solid #DDD;
        border-radius: 8px;
      }
      .m-signature-pad--body {
        border: none;
      }
      .m-signature-pad--body canvas {
        border-radius: 8px;
      }
    `;

    return (
      <ThemedView style={styles.formContainer}>
        <ThemedText style={styles.formTitle}>
          {isCreating ? 'Nuevos Objetivos Empresariales de Calidad' : 'Editar Objetivos Empresariales de Calidad'}
        </ThemedText>

        <ScrollView 
          style={styles.formScrollView} 
          contentContainerStyle={styles.formScrollViewContent}
          showsVerticalScrollIndicator={true}
          nestedScrollEnabled={true}
        >
          {/* Título */}
          <ThemedView style={styles.titleSection}>
            <ThemedText style={styles.mainTitle}>OBJETIVOS EMPRESARIALES DE CALIDAD</ThemedText>
          </ThemedView>

          {/* Ámbito: Clientes */}
          {renderAmbitoSection(
            'Clientes',
            'clientes',
            ambitosData.clientes,
            expandedClientesIndices,
            toggleClienteExpansion,
            addCliente,
            removeCliente
          )}

          {/* Ámbito: Recurso Humano */}
          {renderAmbitoSection(
            'Recurso Humano',
            'recurso_humano',
            ambitosData.recurso_humano,
            expandedRecursoHumanoIndices,
            toggleRecursoHumanoExpansion,
            addRecursoHumano,
            removeRecursoHumano
          )}

          {/* Ámbito: Procesos */}
          {renderAmbitoSection(
            'Procesos',
            'procesos',
            ambitosData.procesos,
            expandedProcesosIndices,
            toggleProcesoExpansion,
            addProceso,
            removeProceso
          )}

          {/* Sección de Aprobación */}
          <ThemedView style={styles.approvalSection}>
            <ThemedText style={styles.approvalTitle}>Aprobado por</ThemedText>
            
            {/* Nombre */}
            <ThemedView style={styles.formSection}>
              <ThemedText style={styles.label}>Nombre:</ThemedText>
              <TextInput
                style={styles.input}
                value={nombreAprobado}
                onChangeText={setNombreAprobado}
                placeholder="Ingrese el nombre de quien aprueba"
                placeholderTextColor="#999"
              />
            </ThemedView>

            {/* Firma */}
            <ThemedView style={styles.formSection}>
              <ThemedText style={styles.label}>Firma:</ThemedText>
              {!firmaAprobado ? (
                <TouchableOpacity
                  style={styles.signatureButton}
                  onPress={openSignatureModal}
                >
                  <Ionicons name="create-outline" size={24} color="#007AFF" />
                  <ThemedText style={styles.signatureButtonText}>Toca para dibujar la firma</ThemedText>
                </TouchableOpacity>
              ) : (
                <ThemedView style={styles.signaturePreviewContainer}>
                  <Image
                    source={{ uri: formatSignatureForDisplay(firmaAprobado) || '' }}
                    style={styles.signaturePreview}
                  />
                  <TouchableOpacity
                    style={styles.clearSignatureButton}
                    onPress={() => setFirmaAprobado(null)}
                  >
                    <Ionicons name="trash" size={16} color="#FF3B30" />
                    <ThemedText style={styles.clearSignatureButtonText}>Eliminar Firma</ThemedText>
                  </TouchableOpacity>
                </ThemedView>
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
              onPress={isCreating ? saveObjectiveHandler : updateObjectiveHandler}
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

  const signatureWebStyle = `
    .m-signature-pad {
      box-shadow: none;
      border: 2px solid #DDD;
      border-radius: 8px;
    }
    .m-signature-pad--body {
      border: none;
    }
    .m-signature-pad--body canvas {
      border-radius: 8px;
    }
  `;

  return (
    <ThemedView style={styles.container}>
      <AppHeader
        onMenuPress={() => setIsMenuVisible(true)}
        onHomePress={handleHomePress}
        title="Objetivos Empresariales de Calidad"
      />
      <SlideMenu
        isVisible={isMenuVisible}
        onClose={() => setIsMenuVisible(false)}
        navigation={navigation}
      />
      {isCreating || editingObjective ? (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.formWrapper}>
          {renderForm()}
        </ScrollView>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {hasCurrentMarca && (
            <TouchableOpacity style={styles.addButton} onPress={startCreating}>
              <ThemedView style={styles.addButtonContent}>
                {getActionIcon('add')}
                <ThemedText style={styles.addButtonText}>Nuevos Objetivos</ThemedText>
              </ThemedView>
            </TouchableOpacity>
          )}
          {renderObjectiveList()}
        </ScrollView>
      )}
      <AppFooter />

      {/* Signature Modal */}
      <Modal
        visible={isSignatureModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={closeSignatureModal}
      >
        <ThemedView style={styles.modalOverlay}>
          <ThemedView style={styles.modalContainer}>
            <ThemedView style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Dibujar Firma</ThemedText>
              <TouchableOpacity onPress={closeSignatureModal}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </ThemedView>
            
            <View style={styles.modalSignatureContainer}>
              <SignatureScreen
                ref={signatureRef}
                onOK={handleSignatureRead}
                descriptionText="Dibuja la firma en el área blanca"
                clearText=""
                confirmText=""
                webStyle={signatureWebStyle}
                key={signatureKey}
              />
            </View>
            
            <ThemedView style={styles.modalActions}>
              <TouchableOpacity style={styles.modalClearButton} onPress={clearSignatureInModal}>
                <Ionicons name="trash" size={20} color="#000000" />
                <ThemedText style={styles.modalClearButtonText}>Limpiar</ThemedText>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.modalAcceptButton} onPress={acceptSignature}>
                <Ionicons name="checkmark" size={20} color="#000000" />
                <ThemedText style={styles.modalAcceptButtonText}>Aceptar</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          </ThemedView>
        </ThemedView>
      </Modal>
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
  ambitoSection: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  ambitoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  ambitoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  addAmbitoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#007AFF',
    padding: 8,
    borderRadius: 6,
  },
  addAmbitoButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  ambitoItem: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
  },
  ambitoItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  ambitoItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  ambitoItemHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  removeAmbitoButton: {
    padding: 4,
  },
  ambitoItemContent: {
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
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  metaInputs: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  metaAñoInput: {
    flex: 1,
  },
  metaValorInput: {
    flex: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
  },
  removeMetaButton: {
    padding: 4,
  },
  addMetaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    padding: 10,
    backgroundColor: '#E3F2FD',
    borderRadius: 6,
    marginTop: 5,
  },
  addMetaButtonText: {
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
  signatureButton: {
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#F0F8FF',
  },
  signatureButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  signaturePreviewContainer: {
    alignItems: 'center',
  },
  signaturePreview: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD',
    marginBottom: 10,
  },
  clearSignatureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    padding: 8,
    backgroundColor: '#FFEBEE',
    borderRadius: 6,
  },
  clearSignatureButtonText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '600',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 20,
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  modalSignatureContainer: {
    height: 300,
    marginBottom: 15,
    borderRadius: 8,
    overflow: 'hidden',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 15,
  },
  modalClearButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 8,
  },
  modalClearButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },
  modalAcceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 8,
  },
  modalAcceptButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },
});

