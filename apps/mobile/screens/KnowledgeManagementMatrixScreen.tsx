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
import {
  createKnowledgeManagementMatrix,
  updateKnowledgeManagementMatrix,
  deleteKnowledgeManagementMatrix,
  listKnowledgeManagementMatrixByCorpo,
} from '@/hooks/evaluationFunctions';
import { eventBus } from '@/hooks/eventBus';

type KnowledgeManagementMatrixScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'KnowledgeManagementMatrix'>;

interface RegistroConocimiento {
  proceso: string;
  conocimiento_organizacional: string;
  responsable_conocimiento: string;
  herramienta_gestion: string;
  forma_transmitir: string;
  forma_actualizar: string;
}

interface KnowledgeManagementMatrix {
  id: string;
  id_local: string;
  registros: string | null;
  created_at: string;
  synced?: boolean;
}

interface EditingKnowledgeManagementMatrix {
  id: string | null;
  id_local: string;
  registros: string;
}

export default function KnowledgeManagementMatrixScreen() {
  const { employee, refreshAccessToken, logout } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<KnowledgeManagementMatrixScreenNavigationProp>();

  // Data states
  const [matrices, setMatrices] = useState<KnowledgeManagementMatrix[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasCurrentMarca, setHasCurrentMarca] = useState<boolean>(false);

  // Editing state
  const [isCreating, setIsCreating] = useState(false);
  const [editingMatrix, setEditingMatrix] = useState<EditingKnowledgeManagementMatrix | null>(null);

  // Form fields
  const [registros, setRegistros] = useState<RegistroConocimiento[]>([]);
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
        const result = await listKnowledgeManagementMatrixByCorpo({
          corpo_id: corpoId,
          refreshAccessToken,
          logout,
        });

        if (result.status && result.data) {
          setMatrices(result.data as KnowledgeManagementMatrix[]);
        } else {
          setMatrices([]);
        }
      } else {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const matricesCache = cache.filter((item: any) => item.type === 'knowledge_management_matrix');
          setMatrices(matricesCache);
        } else {
          setMatrices([]);
        }
      }
    } catch (err) {
      console.error('Error fetching matrices:', err);
      setError('Error al cargar las matrices de gestión del conocimiento');
      try {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const matricesCache = cache.filter((item: any) => item.type === 'knowledge_management_matrix');
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
    setRegistros([]);
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

  const startEditing = (matrix: KnowledgeManagementMatrix) => {
    setIsCreating(false);
    setEditingMatrix({
      id: matrix.id,
      id_local: matrix.id_local,
      registros: matrix.registros || '',
    });

    if (matrix.registros) {
      try {
        const parsed = JSON.parse(matrix.registros);
        setRegistros(parsed);
      } catch {
        setRegistros([]);
      }
    } else {
      setRegistros([]);
    }
  };

  const cancelEditing = () => {
    setEditingMatrix(null);
    resetForm();
  };

  const addRegistro = () => {
    const newRegistro: RegistroConocimiento = {
      proceso: '',
      conocimiento_organizacional: '',
      responsable_conocimiento: '',
      herramienta_gestion: '',
      forma_transmitir: '',
      forma_actualizar: '',
    };
    setRegistros([...registros, newRegistro]);
  };

  const removeRegistro = (index: number) => {
    const updated = [...registros];
    updated.splice(index, 1);
    setRegistros(updated);
    setExpandedIndices(expandedIndices.filter(i => i !== index).map(i => i > index ? i - 1 : i));
  };

  const updateRegistro = (index: number, field: keyof RegistroConocimiento, value: string) => {
    const updated = [...registros];
    updated[index] = { ...updated[index], [field]: value };
    setRegistros(updated);
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

    Alert.alert('Confirmar', '¿Estás seguro de que deseas guardar esta matriz de gestión del conocimiento?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: async () => {
          try {
            const requestData = {
              marca_id: currentMarcaData.id,
              registros: JSON.stringify(registros),
            };

            const isConnected = await getConnectionStatus();

            if (isConnected) {
              const result = await createKnowledgeManagementMatrix({
                requestData,
                refreshAccessToken,
                logout,
              });

              if (result.status) {
                Alert.alert('Éxito', 'Matriz de gestión del conocimiento creada correctamente');
                setIsCreating(false);
                resetForm();
                fetchMatrices();
              } else {
                Alert.alert('Error', result.message || 'Error al crear la matriz de gestión del conocimiento');
              }
            } else {
              const localId = generateRandomId();

              const actionsStr = await AsyncStorage.getItem('evaluations_actions');
              const actions = actionsStr ? JSON.parse(actionsStr) : [];
              actions.push({
                id: localId,
                action: 'create',
                type: 'knowledge_management_matrix',
                payload: requestData,
                synced: false,
              });
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

              const cacheStr = await AsyncStorage.getItem('evaluations_cache');
              const cache = cacheStr ? JSON.parse(cacheStr) : [];

              const newMatrixCache: KnowledgeManagementMatrix = {
                id: '',
                id_local: localId,
                registros: JSON.stringify(registros),
                created_at: new Date().toISOString(),
                synced: false,
              };

              cache.push({ ...newMatrixCache, type: 'knowledge_management_matrix' });
              await AsyncStorage.setItem('evaluations_cache', JSON.stringify(cache));

              Alert.alert('Modo Offline', 'Matriz de gestión del conocimiento registrada localmente. Se sincronizará cuando haya conexión.');
              setIsCreating(false);
              resetForm();
              fetchMatrices();
            }
          } catch (err) {
            console.error('Error saving matrix:', err);
            Alert.alert('Error', 'No se pudo guardar la matriz de gestión del conocimiento');
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

    Alert.alert('Confirmar', '¿Estás seguro de que deseas actualizar esta matriz de gestión del conocimiento?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: async () => {
          try {
            const requestData = {
              registros: JSON.stringify(registros),
            };

            const isConnected = await getConnectionStatus();

            if (isConnected) {
              const result = await updateKnowledgeManagementMatrix({
                id: matrixId,
                requestData,
                refreshAccessToken,
                logout,
              });

              if (result.status) {
                Alert.alert('Éxito', 'Matriz de gestión del conocimiento actualizada correctamente');
                cancelEditing();
                fetchMatrices();
              } else {
                Alert.alert('Error', result.message || 'Error al actualizar la matriz de gestión del conocimiento');
              }
            } else {
              const actionsStr = await AsyncStorage.getItem('evaluations_actions');
              const actions = actionsStr ? JSON.parse(actionsStr) : [];
              actions.push({
                id: matrixId,
                action: 'update',
                type: 'knowledge_management_matrix',
                payload: requestData,
                synced: false,
              });
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

              const cacheStr = await AsyncStorage.getItem('evaluations_cache');
              if (cacheStr) {
                const cache = JSON.parse(cacheStr);
                const updatedCache = cache.map((item: any) => {
                  if ((item.id === matrixId || item.id_local === matrixId) && item.type === 'knowledge_management_matrix') {
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

              Alert.alert('Actualizado offline', 'La matriz de gestión del conocimiento se actualizó localmente y se sincronizará cuando haya conexión');
              cancelEditing();
              fetchMatrices();
            }
          } catch (err) {
            console.error('Error updating matrix:', err);
            Alert.alert('Error', 'Error al actualizar la matriz de gestión del conocimiento');
          }
        },
      },
    ]);
  };

  const deleteMatrixHandler = async (matrix: KnowledgeManagementMatrix) => {
    Alert.alert('Confirmar', '¿Estás seguro de que deseas eliminar esta matriz de gestión del conocimiento?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            const isConnected = await getConnectionStatus();
            const recordId = matrix.id && !matrix.id.startsWith('local_') ? matrix.id : matrix.id_local;

            if (isConnected && matrix.id && !matrix.id.startsWith('local_')) {
              const result = await deleteKnowledgeManagementMatrix({
                id: recordId,
                refreshAccessToken,
                logout,
              });

              if (result.status) {
                Alert.alert('Éxito', 'Matriz de gestión del conocimiento eliminada correctamente');
                fetchMatrices();
              } else {
                Alert.alert('Error', result.message || 'Error al eliminar la matriz de gestión del conocimiento');
              }
            } else {
              const actionsStr = await AsyncStorage.getItem('evaluations_actions');
              const actions = actionsStr ? JSON.parse(actionsStr) : [];
              actions.push({
                id: recordId,
                action: 'delete',
                payload: {},
                type: 'knowledge_management_matrix',
                synced: false,
              });
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

              const cacheStr = await AsyncStorage.getItem('evaluations_cache');
              if (cacheStr) {
                const cache = JSON.parse(cacheStr);
                const updatedCache = cache.filter((item: any) => !((item.id === recordId || item.id_local === recordId) && item.type === 'knowledge_management_matrix'));
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
              }

              Alert.alert('Eliminado offline', 'La matriz de gestión del conocimiento se eliminó localmente y se sincronizará cuando haya conexión');
              fetchMatrices();
            }
          } catch (err) {
            console.error('Error deleting matrix:', err);
            Alert.alert('Error', 'Error al eliminar la matriz de gestión del conocimiento');
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
          <ThemedText style={styles.loadingText}>Cargando matrices de gestión del conocimiento...</ThemedText>
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
          <ThemedText style={styles.emptyText}>No hay matrices de gestión del conocimiento registradas.</ThemedText>
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
                  Matriz de Gestión del Conocimiento
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

  const renderRegistro = (registro: RegistroConocimiento, index: number) => {
    const isExpanded = expandedIndices.includes(index);
    
    return (
      <ThemedView key={index} style={styles.registroItem}>
        <TouchableOpacity
          style={styles.registroItemHeader}
          onPress={() => toggleExpansion(index)}
        >
          <ThemedText style={styles.registroItemTitle}>
            Registro {index + 1} - {registro.proceso || 'Sin proceso'}
          </ThemedText>
          <ThemedView style={styles.registroItemHeaderActions}>
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color="#000000"
            />
            <TouchableOpacity
              onPress={() => removeRegistro(index)}
              style={styles.removeRegistroButton}
            >
              <Ionicons name="trash" size={18} color="#F44336" />
            </TouchableOpacity>
          </ThemedView>
        </TouchableOpacity>

        {isExpanded && (
          <ThemedView style={styles.registroItemContent}>
            {/* Proceso */}
            <ThemedView style={styles.formSection}>
              <ThemedText style={styles.label}>Nombre del proceso</ThemedText>
              <TextInput
                style={styles.input}
                value={registro.proceso}
                onChangeText={(text) => updateRegistro(index, 'proceso', text)}
                placeholder="Ingrese el nombre del proceso"
                placeholderTextColor="#999"
              />
            </ThemedView>

            {/* Conocimiento organizacional */}
            <ThemedView style={styles.formSection}>
              <ThemedText style={styles.label}>
                Identifique todos los conocimientos necesarios para la operación de sus procesos y para lograr la conformidad de los productos y servicios
              </ThemedText>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={registro.conocimiento_organizacional}
                onChangeText={(text) => updateRegistro(index, 'conocimiento_organizacional', text)}
                placeholder="Conocimiento organizacional"
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
              />
            </ThemedView>

            {/* Responsable del conocimiento */}
            <ThemedView style={styles.formSection}>
              <ThemedText style={styles.label}>
                Mencione quien será el responsable de Gestionar este conocimiento
              </ThemedText>
              <TextInput
                style={styles.input}
                value={registro.responsable_conocimiento}
                onChangeText={(text) => updateRegistro(index, 'responsable_conocimiento', text)}
                placeholder="Responsable del conocimiento"
                placeholderTextColor="#999"
              />
            </ThemedView>

            {/* Herramienta para gestionar */}
            <ThemedView style={styles.formSection}>
              <ThemedText style={styles.label}>
                Describa cómo se recopilará la información de este Conocimiento identificado
              </ThemedText>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={registro.herramienta_gestion}
                onChangeText={(text) => updateRegistro(index, 'herramienta_gestion', text)}
                placeholder="Herramienta para gestionar el conocimiento organizacional (Mantenerse y ponerse a disposición)"
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
              />
            </ThemedView>

            {/* Forma de transmitir */}
            <ThemedView style={styles.formSection}>
              <ThemedText style={styles.label}>
                Como se transmitirá este conocimiento a los demás? ejemplos: - Sesiones con el equipo - Capacitación - Lecciones aprendidas - Back up del puesto - Publicación en la página web - Archivo con tips del proceso
              </ThemedText>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={registro.forma_transmitir}
                onChangeText={(text) => updateRegistro(index, 'forma_transmitir', text)}
                placeholder="Forma de transmitir el conocimiento"
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
              />
            </ThemedView>

            {/* Forma de actualizar */}
            <ThemedView style={styles.formSection}>
              <ThemedText style={styles.label}>
                Cómo se actualizará este conocimiento
              </ThemedText>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={registro.forma_actualizar}
                onChangeText={(text) => updateRegistro(index, 'forma_actualizar', text)}
                placeholder="Forma de actualizarlo"
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
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
          {isCreating ? 'Nueva Matriz de Gestión del Conocimiento' : 'Editar Matriz de Gestión del Conocimiento'}
        </ThemedText>

        <ScrollView 
          style={styles.formScrollView} 
          contentContainerStyle={styles.formScrollViewContent}
          showsVerticalScrollIndicator={true}
          nestedScrollEnabled={true}
        >
          {/* Título */}
          <ThemedView style={styles.titleSection}>
            <ThemedText style={styles.mainTitle}>MATRIZ DE GESTIÓN DEL CONOCIMIENTO</ThemedText>
          </ThemedView>

          {/* Lista de registros */}
          <ThemedView style={styles.registrosSection}>
            <ThemedView style={styles.registrosHeader}>
              <ThemedText style={styles.registrosTitle}>Registros</ThemedText>
              <TouchableOpacity style={styles.addRegistroButton} onPress={addRegistro}>
                <Ionicons name="add" size={20} color="#FFFFFF" />
                <ThemedText style={styles.addRegistroButtonText}>Agregar Registro</ThemedText>
              </TouchableOpacity>
            </ThemedView>
            {registros.map((registro, index) => renderRegistro(registro, index))}
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
        title="Matriz de Gestión del Conocimiento"
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  registrosSection: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  registrosHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  registrosTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  addRegistroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#007AFF',
    padding: 8,
    borderRadius: 6,
  },
  addRegistroButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  registroItem: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
  },
  registroItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  registroItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    flex: 1,
  },
  registroItemHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  removeRegistroButton: {
    padding: 4,
  },
  registroItemContent: {
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

