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
  createQualityPolicy,
  updateQualityPolicy,
  deleteQualityPolicy,
  listQualityPolicyByCorpo,
} from '@/hooks/evaluationFunctions';
import { eventBus } from '@/hooks/eventBus';

type QualityPolicyScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'QualityPolicy'>;

interface QualityPolicy {
  id: string;
  id_local: string;
  politica_contenido: string | null;
  nombre_aprobado: string | null;
  firma_aprobado: string | null;
  created_at: string;
  synced?: boolean;
}

interface EditingQualityPolicy {
  id: string | null;
  id_local: string;
  politica_contenido: string;
  nombre_aprobado: string;
  firma_aprobado: string;
}

export default function QualityPolicyScreen() {
  const { employee, refreshAccessToken, logout } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<QualityPolicyScreenNavigationProp>();

  // Data states
  const [policies, setPolicies] = useState<QualityPolicy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasCurrentMarca, setHasCurrentMarca] = useState<boolean>(false);

  // Editing state
  const [isCreating, setIsCreating] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<EditingQualityPolicy | null>(null);

  // Form fields
  const [politicaContenido, setPoliticaContenido] = useState('');
  const [nombreAprobado, setNombreAprobado] = useState('');
  const [firmaAprobado, setFirmaAprobado] = useState<string | null>(null);

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

  const fetchPolicies = useCallback(async () => {
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
        const result = await listQualityPolicyByCorpo({
          corpo_id: corpoId,
          refreshAccessToken,
          logout,
        });

        if (result.status && result.data) {
          setPolicies(result.data as QualityPolicy[]);
        } else {
          setPolicies([]);
        }
      } else {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const policiesCache = cache.filter((item: any) => item.type === 'quality_policy');
          setPolicies(policiesCache);
        } else {
          setPolicies([]);
        }
      }
    } catch (err) {
      console.error('Error fetching policies:', err);
      setError('Error al cargar las políticas de calidad');
      try {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const policiesCache = cache.filter((item: any) => item.type === 'quality_policy');
          setPolicies(policiesCache);
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
      fetchPolicies();
      eventBus.on('connectionRestored', fetchPolicies);
      return () => {
        eventBus.off('connectionRestored', fetchPolicies);
      };
    }, [fetchPolicies])
  );

  const resetForm = () => {
    setPoliticaContenido('');
    setNombreAprobado('');
    setFirmaAprobado(null);
  };

  const startCreating = () => {
    setIsCreating(true);
    setEditingPolicy(null);
    resetForm();
  };

  const cancelCreating = () => {
    setIsCreating(false);
    resetForm();
  };

  const startEditing = (policy: QualityPolicy) => {
    setIsCreating(false);
    setEditingPolicy({
      id: policy.id,
      id_local: policy.id_local,
      politica_contenido: policy.politica_contenido || '',
      nombre_aprobado: policy.nombre_aprobado || '',
      firma_aprobado: policy.firma_aprobado || '',
    });

    setPoliticaContenido(policy.politica_contenido || '');
    setNombreAprobado(policy.nombre_aprobado || '');
    setFirmaAprobado(formatSignatureForDisplay(policy.firma_aprobado));
  };

  const cancelEditing = () => {
    setEditingPolicy(null);
    resetForm();
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

  const savePolicyHandler = async () => {
    const currentMarca = await AsyncStorage.getItem('current_marca');
    if (!currentMarca) {
      Alert.alert('Error', 'No se encontró la marca actual');
      return;
    }

    const currentMarcaData = JSON.parse(currentMarca);

    Alert.alert('Confirmar', '¿Estás seguro de que deseas guardar esta política de calidad?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: async () => {
          try {
            const requestData = {
              marca_id: currentMarcaData.id,
              politica_contenido: politicaContenido.trim() || null,
              nombre_aprobado: nombreAprobado.trim() || null,
              firma_aprobado: getBase64Only(firmaAprobado),
            };

            const isConnected = await getConnectionStatus();

            if (isConnected) {
              const result = await createQualityPolicy({
                requestData,
                refreshAccessToken,
                logout,
              });

              if (result.status) {
                Alert.alert('Éxito', 'Política de calidad creada correctamente');
                setIsCreating(false);
                resetForm();
                fetchPolicies();
              } else {
                Alert.alert('Error', result.message || 'Error al crear la política de calidad');
              }
            } else {
              const localId = generateRandomId();

              const actionsStr = await AsyncStorage.getItem('evaluations_actions');
              const actions = actionsStr ? JSON.parse(actionsStr) : [];
              actions.push({
                id: localId,
                action: 'create',
                type: 'quality_policy',
                payload: requestData,
                synced: false,
              });
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

              const cacheStr = await AsyncStorage.getItem('evaluations_cache');
              const cache = cacheStr ? JSON.parse(cacheStr) : [];

              const newPolicyCache: QualityPolicy = {
                id: '',
                id_local: localId,
                politica_contenido: politicaContenido.trim() || null,
                nombre_aprobado: nombreAprobado.trim() || null,
                firma_aprobado: getBase64Only(firmaAprobado),
                created_at: new Date().toISOString(),
                synced: false,
              };

              cache.push({ ...newPolicyCache, type: 'quality_policy' });
              await AsyncStorage.setItem('evaluations_cache', JSON.stringify(cache));

              Alert.alert('Modo Offline', 'Política de calidad registrada localmente. Se sincronizará cuando haya conexión.');
              setIsCreating(false);
              resetForm();
              fetchPolicies();
            }
          } catch (err) {
            console.error('Error saving policy:', err);
            Alert.alert('Error', 'No se pudo guardar la política de calidad');
          }
        },
      },
    ]);
  };

  const updatePolicyHandler = async () => {
    if (!editingPolicy) return;

    const policyId = editingPolicy.id || editingPolicy.id_local;
    if (!policyId) {
      Alert.alert('Error', 'ID de política no encontrado para actualizar');
      return;
    }

    Alert.alert('Confirmar', '¿Estás seguro de que deseas actualizar esta política de calidad?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: async () => {
          try {
            const requestData = {
              politica_contenido: politicaContenido.trim() || null,
              nombre_aprobado: nombreAprobado.trim() || null,
              firma_aprobado: getBase64Only(firmaAprobado),
            };

            const isConnected = await getConnectionStatus();

            if (isConnected) {
              const result = await updateQualityPolicy({
                id: policyId,
                requestData,
                refreshAccessToken,
                logout,
              });

              if (result.status) {
                Alert.alert('Éxito', 'Política de calidad actualizada correctamente');
                cancelEditing();
                fetchPolicies();
              } else {
                Alert.alert('Error', result.message || 'Error al actualizar la política de calidad');
              }
            } else {
              const actionsStr = await AsyncStorage.getItem('evaluations_actions');
              const actions = actionsStr ? JSON.parse(actionsStr) : [];
              actions.push({
                id: policyId,
                action: 'update',
                type: 'quality_policy',
                payload: requestData,
                synced: false,
              });
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

              const cacheStr = await AsyncStorage.getItem('evaluations_cache');
              if (cacheStr) {
                const cache = JSON.parse(cacheStr);
                const updatedCache = cache.map((item: any) => {
                  if ((item.id === policyId || item.id_local === policyId) && item.type === 'quality_policy') {
                    return { ...item, ...requestData, synced: false };
                  }
                  return item;
                });
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
              }

              Alert.alert('Actualizado offline', 'La política de calidad se actualizó localmente y se sincronizará cuando haya conexión');
              cancelEditing();
              fetchPolicies();
            }
          } catch (err) {
            console.error('Error updating policy:', err);
            Alert.alert('Error', 'Error al actualizar la política de calidad');
          }
        },
      },
    ]);
  };

  const deletePolicyHandler = async (policy: QualityPolicy) => {
    Alert.alert('Confirmar', '¿Estás seguro de que deseas eliminar esta política de calidad?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            const isConnected = await getConnectionStatus();
            const recordId = policy.id && !policy.id.startsWith('local_') ? policy.id : policy.id_local;

            if (isConnected && policy.id && !policy.id.startsWith('local_')) {
              const result = await deleteQualityPolicy({
                id: recordId,
                refreshAccessToken,
                logout,
              });

              if (result.status) {
                Alert.alert('Éxito', 'Política de calidad eliminada correctamente');
                fetchPolicies();
              } else {
                Alert.alert('Error', result.message || 'Error al eliminar la política de calidad');
              }
            } else {
              const actionsStr = await AsyncStorage.getItem('evaluations_actions');
              const actions = actionsStr ? JSON.parse(actionsStr) : [];
              actions.push({
                id: recordId,
                action: 'delete',
                payload: {},
                type: 'quality_policy',
                synced: false,
              });
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

              const cacheStr = await AsyncStorage.getItem('evaluations_cache');
              if (cacheStr) {
                const cache = JSON.parse(cacheStr);
                const updatedCache = cache.filter((item: any) => !((item.id === recordId || item.id_local === recordId) && item.type === 'quality_policy'));
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
              }

              Alert.alert('Eliminado offline', 'La política de calidad se eliminó localmente y se sincronizará cuando haya conexión');
              fetchPolicies();
            }
          } catch (err) {
            console.error('Error deleting policy:', err);
            Alert.alert('Error', 'Error al eliminar la política de calidad');
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

  const renderPolicyList = () => {
    if (isLoading) {
      return (
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Cargando políticas de calidad...</ThemedText>
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

    if (policies.length === 0) {
      return (
        <ThemedView style={styles.emptyContainer}>
          <ThemedText style={styles.emptyText}>No hay políticas de calidad registradas.</ThemedText>
        </ThemedView>
      );
    }

    return (
      <ThemedView style={styles.listContainer}>
        {policies.map((policy) => (
          <ThemedView key={policy.id || policy.id_local} style={styles.listItem}>
            <ThemedView style={styles.listItemHeader}>
              <ThemedView style={styles.listItemContent}>
                <ThemedText style={styles.listItemTitle}>
                  Política de Calidad
                </ThemedText>
                {policy.nombre_aprobado && (
                  <ThemedText style={styles.listItemSubtitle}>
                    Aprobado por: {policy.nombre_aprobado}
                  </ThemedText>
                )}
                {policy.politica_contenido && (
                  <ThemedText style={styles.listItemSubtitle} numberOfLines={2}>
                    {policy.politica_contenido.substring(0, 100)}...
                  </ThemedText>
                )}
                {!policy.synced && (
                  <ThemedText style={styles.offlineBadge}>Sin sincronizar</ThemedText>
                )}
              </ThemedView>
              <ThemedView style={styles.listItemActions}>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => startEditing(policy)}
                >
                  {getActionIcon('edit')}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deletePolicyHandler(policy)}
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

  const renderForm = () => {
    if (!isCreating && !editingPolicy) return null;

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
          {isCreating ? 'Nueva Política de Calidad' : 'Editar Política de Calidad'}
        </ThemedText>

        <ScrollView 
          style={styles.formScrollView} 
          contentContainerStyle={styles.formScrollViewContent}
          showsVerticalScrollIndicator={true}
          nestedScrollEnabled={true}
        >
          {/* Título POLÍTICA DE CALIDAD */}
          <ThemedView style={styles.titleSection}>
            <ThemedText style={styles.mainTitle}>POLÍTICA DE CALIDAD</ThemedText>
          </ThemedView>

          {/* Contenido de la Política */}
          <ThemedView style={styles.formSection}>
            <ThemedText style={styles.label}>Contenido de la Política</ThemedText>
            <TextInput
              style={[styles.input, styles.textAreaLarge]}
              value={politicaContenido}
              onChangeText={setPoliticaContenido}
              placeholder="Ingrese el contenido de la política de calidad"
              placeholderTextColor="#999"
              multiline
              numberOfLines={15}
              textAlignVertical="top"
            />
          </ThemedView>

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
              onPress={isCreating ? savePolicyHandler : updatePolicyHandler}
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
        title="Política de Calidad"
      />
      <SlideMenu
        isVisible={isMenuVisible}
        onClose={() => setIsMenuVisible(false)}
        navigation={navigation}
      />
      {isCreating || editingPolicy ? (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.formWrapper}>
          {renderForm()}
        </ScrollView>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {hasCurrentMarca && (
            <TouchableOpacity style={styles.addButton} onPress={startCreating}>
              <ThemedView style={styles.addButtonContent}>
                {getActionIcon('add')}
                <ThemedText style={styles.addButtonText}>Nueva Política</ThemedText>
              </ThemedView>
            </TouchableOpacity>
          )}
          {renderPolicyList()}
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
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    alignItems: 'center',
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    textTransform: 'uppercase',
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
  textAreaLarge: {
    minHeight: 300,
    textAlignVertical: 'top',
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

