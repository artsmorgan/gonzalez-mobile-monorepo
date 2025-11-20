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
import Ionicons from '@expo/vector-icons/build/Ionicons';
import * as Network from 'expo-network';
import { createNonConformingProduct, updateNonConformingProduct, deleteNonConformingProduct, listNonConformingProductByCorpo } from '@/hooks/evaluationFunctions';
import { eventBus } from '@/hooks/eventBus';

type NonConformingProductScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'NonConformingProduct'>;

interface NonConformingProduct {
  id: string;
  id_local: string;
  cliente: string | null;
  numero_corpo: string | null;
  responsable_cuenta: string | null;
  macroactividad: string | null;
  actividad: string | null;
  tipo_servicio_no_conforme: string | null;
  tipo_registro: string | null;
  responsable_registro: string | null;
  acciones_seguir: string | null;
  responsable_corregir: string | null;
  responsable_aprobar: string | null;
  created_at: string;
  synced?: boolean;
}

interface EditingNonConformingProduct {
  id: string | null;
  id_local: string;
  cliente: string;
  numero_corpo: string;
  responsable_cuenta: string;
  macroactividad: string;
  actividad: string;
  tipo_servicio_no_conforme: string;
  tipo_registro: string;
  responsable_registro: string;
  acciones_seguir: string;
  responsable_corregir: string;
  responsable_aprobar: string;
}

export default function NonConformingProductScreen() {
  const { employee, refreshAccessToken, logout } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<NonConformingProductScreenNavigationProp>();

  // Data states
  const [nonConformingProducts, setNonConformingProducts] = useState<NonConformingProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasCurrentMarca, setHasCurrentMarca] = useState<boolean>(false);

  // Editing state
  const [editingRecord, setEditingRecord] = useState<EditingNonConformingProduct | null>(null);

  // Creating state
  const [isCreating, setIsCreating] = useState(false);

  // Form states
  const [cliente, setCliente] = useState('');
  const [numeroCorpo, setNumeroCorpo] = useState('');
  const [responsableCuenta, setResponsableCuenta] = useState('');
  const [macroactividad, setMacroactividad] = useState('');
  const [actividad, setActividad] = useState('');
  const [tipoServicioNoConforme, setTipoServicioNoConforme] = useState('');
  const [tipoRegistro, setTipoRegistro] = useState('');
  const [responsableRegistro, setResponsableRegistro] = useState('');
  const [accionesSeguir, setAccionesSeguir] = useState('');
  const [responsableCorregir, setResponsableCorregir] = useState('');
  const [responsableAprobar, setResponsableAprobar] = useState('');

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
      fetchNonConformingProducts();
    }, [])
  );

  useEffect(() => {
    const handler = () => {
      fetchNonConformingProducts();
    };

    eventBus.on('connectionRestored', handler);
    return () => {
      eventBus.off('connectionRestored', handler);
    };
  }, []);

  const fetchNonConformingProducts = async () => {
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
        const result = await listNonConformingProductByCorpo({
          corpo_id: corpoId,
          refreshAccessToken,
          logout,
        });

        if (result.status && result.data) {
          setNonConformingProducts(result.data as NonConformingProduct[]);
        } else {
          setNonConformingProducts([]);
        }
      } else {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const productsCache = cache.filter((item: any) => item.type === 'non_conforming_product');
          setNonConformingProducts(productsCache);
        } else {
          setNonConformingProducts([]);
        }
      }
    } catch (err) {
      console.error('Error fetching non-conforming products:', err);
      setError('Error al cargar los productos no conformes');
      try {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const productsCache = cache.filter((item: any) => item.type === 'non_conforming_product');
          setNonConformingProducts(productsCache);
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
    setCliente('');
    setNumeroCorpo('');
    setResponsableCuenta('');
    setMacroactividad('');
    setActividad('');
    setTipoServicioNoConforme('');
    setTipoRegistro('');
    setResponsableRegistro('');
    setAccionesSeguir('');
    setResponsableCorregir('');
    setResponsableAprobar('');
  };

  const cancelCreating = () => {
    setIsCreating(false);
  };

  const startEditing = (record: NonConformingProduct) => {
    setEditingRecord({
      id: record.id,
      id_local: record.id_local,
      cliente: record.cliente || '',
      numero_corpo: record.numero_corpo || '',
      responsable_cuenta: record.responsable_cuenta || '',
      macroactividad: record.macroactividad || '',
      actividad: record.actividad || '',
      tipo_servicio_no_conforme: record.tipo_servicio_no_conforme || '',
      tipo_registro: record.tipo_registro || '',
      responsable_registro: record.responsable_registro || '',
      acciones_seguir: record.acciones_seguir || '',
      responsable_corregir: record.responsable_corregir || '',
      responsable_aprobar: record.responsable_aprobar || '',
    });
    setCliente(record.cliente || '');
    setNumeroCorpo(record.numero_corpo || '');
    setResponsableCuenta(record.responsable_cuenta || '');
    setMacroactividad(record.macroactividad || '');
    setActividad(record.actividad || '');
    setTipoServicioNoConforme(record.tipo_servicio_no_conforme || '');
    setTipoRegistro(record.tipo_registro || '');
    setResponsableRegistro(record.responsable_registro || '');
    setAccionesSeguir(record.acciones_seguir || '');
    setResponsableCorregir(record.responsable_corregir || '');
    setResponsableAprobar(record.responsable_aprobar || '');
  };

  const cancelEditing = () => {
    setEditingRecord(null);
  };

  const saveNonConformingProduct = async () => {
    const currentMarca = await AsyncStorage.getItem('current_marca');
    if (!currentMarca) {
      Alert.alert('Error', 'No se encontró la marca actual');
      return;
    }

    const currentMarcaData = JSON.parse(currentMarca);

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas guardar este producto no conforme?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const requestData = {
                marca_id: currentMarcaData.id,
                cliente: cliente.trim() || null,
                numero_corpo: numeroCorpo.trim() || null,
                responsable_cuenta: responsableCuenta.trim() || null,
                macroactividad: macroactividad.trim() || null,
                actividad: actividad.trim() || null,
                tipo_servicio_no_conforme: tipoServicioNoConforme.trim() || null,
                tipo_registro: tipoRegistro.trim() || null,
                responsable_registro: responsableRegistro.trim() || null,
                acciones_seguir: accionesSeguir.trim() || null,
                responsable_corregir: responsableCorregir.trim() || null,
                responsable_aprobar: responsableAprobar.trim() || null,
              };

              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await createNonConformingProduct({
                  requestData,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Producto no conforme guardado correctamente');
                  cancelCreating();
                  fetchNonConformingProducts();
                } else {
                  Alert.alert('Error', result.message || 'Error al guardar el producto no conforme');
                }
              } else {
                const localId = generateRandomId();

                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: localId,
                  action: 'create',
                  type: 'non_conforming_product',
                  payload: requestData,
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                const cache = cacheStr ? JSON.parse(cacheStr) : [];

                const newRecordCache: NonConformingProduct = {
                  id: '',
                  id_local: localId,
                  cliente: cliente.trim() || null,
                  numero_corpo: numeroCorpo.trim() || null,
                  responsable_cuenta: responsableCuenta.trim() || null,
                  macroactividad: macroactividad.trim() || null,
                  actividad: actividad.trim() || null,
                  tipo_servicio_no_conforme: tipoServicioNoConforme.trim() || null,
                  tipo_registro: tipoRegistro.trim() || null,
                  responsable_registro: responsableRegistro.trim() || null,
                  acciones_seguir: accionesSeguir.trim() || null,
                  responsable_corregir: responsableCorregir.trim() || null,
                  responsable_aprobar: responsableAprobar.trim() || null,
                  created_at: new Date().toISOString(),
                  synced: false,
                };

                cache.push({ ...newRecordCache, type: 'non_conforming_product' });
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(cache));

                Alert.alert('Modo Offline', 'Producto no conforme registrado localmente. Se sincronizará cuando haya conexión.');
                cancelCreating();
                fetchNonConformingProducts();
              }
            } catch (err) {
              console.error('Error saving non-conforming product:', err);
              Alert.alert('Error', 'No se pudo guardar el producto no conforme');
            }
          },
        },
      ]
    );
  };

  const updateNonConformingProductHandler = async () => {
    if (!editingRecord) return;

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas actualizar este producto no conforme?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const requestData = {
                cliente: cliente.trim() || null,
                numero_corpo: numeroCorpo.trim() || null,
                responsable_cuenta: responsableCuenta.trim() || null,
                macroactividad: macroactividad.trim() || null,
                actividad: actividad.trim() || null,
                tipo_servicio_no_conforme: tipoServicioNoConforme.trim() || null,
                tipo_registro: tipoRegistro.trim() || null,
                responsable_registro: responsableRegistro.trim() || null,
                acciones_seguir: accionesSeguir.trim() || null,
                responsable_corregir: responsableCorregir.trim() || null,
                responsable_aprobar: responsableAprobar.trim() || null,
              };

              const isConnected = await getConnectionStatus();
              const recordId = editingRecord.id || editingRecord.id_local;

              if (isConnected && editingRecord.id && !editingRecord.id.startsWith('local-')) {
                const result = await updateNonConformingProduct({
                  id: editingRecord.id,
                  requestData,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Producto no conforme actualizado correctamente');
                  cancelEditing();
                  fetchNonConformingProducts();
                } else {
                  Alert.alert('Error', result.message || 'Error al actualizar el producto no conforme');
                }
              } else {
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: recordId,
                  action: 'update',
                  type: 'non_conforming_product',
                  payload: requestData,
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                if (cacheStr) {
                  const cache = JSON.parse(cacheStr);
                  const updatedCache = cache.map((item: any) => {
                    if ((item.id === recordId || item.id_local === recordId) && item.type === 'non_conforming_product') {
                      return {
                        ...item,
                        cliente: cliente.trim() || null,
                        numero_corpo: numeroCorpo.trim() || null,
                        responsable_cuenta: responsableCuenta.trim() || null,
                        macroactividad: macroactividad.trim() || null,
                        actividad: actividad.trim() || null,
                        tipo_servicio_no_conforme: tipoServicioNoConforme.trim() || null,
                        tipo_registro: tipoRegistro.trim() || null,
                        responsable_registro: responsableRegistro.trim() || null,
                        acciones_seguir: accionesSeguir.trim() || null,
                        responsable_corregir: responsableCorregir.trim() || null,
                        responsable_aprobar: responsableAprobar.trim() || null,
                      };
                    }
                    return item;
                  });
                  await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                }

                Alert.alert('Modo Offline', 'Producto no conforme actualizado localmente. Se sincronizará cuando haya conexión.');
                cancelEditing();
                fetchNonConformingProducts();
              }
            } catch (err) {
              console.error('Error updating non-conforming product:', err);
              Alert.alert('Error', 'No se pudo actualizar el producto no conforme');
            }
          },
        },
      ]
    );
  };

  const deleteNonConformingProductHandler = async (record: NonConformingProduct) => {
    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas eliminar este producto no conforme?',
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
                const result = await deleteNonConformingProduct({
                  id: record.id,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Producto no conforme eliminado correctamente');
                  fetchNonConformingProducts();
                } else {
                  Alert.alert('Error', result.message || 'Error al eliminar el producto no conforme');
                }
              } else {
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: recordId,
                  action: 'delete',
                  type: 'non_conforming_product',
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

                Alert.alert('Modo Offline', 'Producto no conforme eliminado localmente. Se sincronizará cuando haya conexión.');
                fetchNonConformingProducts();
              }
            } catch (err) {
              console.error('Error deleting non-conforming product:', err);
              Alert.alert('Error', 'No se pudo eliminar el producto no conforme');
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
    return (
      <ThemedView style={styles.formCard}>
        <ThemedText style={styles.formTitle}>
          {isEditing ? 'Editar Producto No Conforme' : 'Nuevo Producto No Conforme'}
        </ThemedText>

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

        {/* # de Corpo */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}># de Corpo</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="# de Corpo"
            placeholderTextColor="#999"
            value={numeroCorpo}
            onChangeText={setNumeroCorpo}
          />
        </ThemedView>

        {/* Responsable de la cuenta */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Responsable de la cuenta</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="Responsable de la cuenta"
            placeholderTextColor="#999"
            value={responsableCuenta}
            onChangeText={setResponsableCuenta}
          />
        </ThemedView>

        {/* Macroactividad */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Macroactividad</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="Macroactividad"
            placeholderTextColor="#999"
            value={macroactividad}
            onChangeText={setMacroactividad}
          />
        </ThemedView>

        {/* Actividad */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Actividad</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="Actividad"
            placeholderTextColor="#999"
            value={actividad}
            onChangeText={setActividad}
          />
        </ThemedView>

        {/* Tipo de Servicio no Conforme */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Tipo de Servicio no Conforme</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="Tipo de Servicio no Conforme"
            placeholderTextColor="#999"
            value={tipoServicioNoConforme}
            onChangeText={setTipoServicioNoConforme}
          />
        </ThemedView>

        {/* Tipo de registro */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Tipo de registro y Responsable de registro del PNC identificado</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="Tipo de registro"
            placeholderTextColor="#999"
            value={tipoRegistro}
            onChangeText={setTipoRegistro}
          />
        </ThemedView>

        {/* Responsable de registro */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Responsable de registro</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="Responsable de registro"
            placeholderTextColor="#999"
            value={responsableRegistro}
            onChangeText={setResponsableRegistro}
          />
        </ThemedView>

        {/* Acciones a seguir */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Acciones a seguir según las desviaciones encontradas</ThemedText>
          <TextInput
            style={[styles.formInput, styles.textArea]}
            placeholder="Indicar a quién debe comunicarse sobre el producto no conforme identificado así como las acciones específicas que se tomarán al respecto del PNC"
            placeholderTextColor="#999"
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            value={accionesSeguir}
            onChangeText={setAccionesSeguir}
          />
        </ThemedView>

        {/* Responsable de corregir */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Responsable de tomar acción para corregir los productos no conformes identificados</ThemedText>
          <TextInput
            style={[styles.formInput, styles.textArea]}
            placeholder="Responsable de tomar acción para corregir"
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            value={responsableCorregir}
            onChangeText={setResponsableCorregir}
          />
        </ThemedView>

        {/* Responsable de aprobar */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Responsable de aprobar la acción (Si ha reproceso)</ThemedText>
          <TextInput
            style={[styles.formInput, styles.textArea]}
            placeholder="Responsable de aprobar la acción"
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            value={responsableAprobar}
            onChangeText={setResponsableAprobar}
          />
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
            onPress={isEditing ? updateNonConformingProductHandler : saveNonConformingProduct}
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
          <ThemedText style={styles.loadingText}>Cargando productos no conformes...</ThemedText>
        </ThemedView>
      );
    }

    if (error && nonConformingProducts.length === 0) {
      return (
        <ThemedView style={styles.centerContainer}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        </ThemedView>
      );
    }

    if (nonConformingProducts.length === 0) {
      return (
        <ThemedView style={styles.centerContainer}>
          <ThemedText style={styles.emptyText}>No hay productos no conformes registrados</ThemedText>
        </ThemedView>
      );
    }

    return (
      <ThemedView style={styles.listContainer}>
        {nonConformingProducts.map((record) => {
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
                    {record.cliente || 'Sin cliente'}
                  </ThemedText>
                  <ThemedText style={styles.listItemSubtitle}>
                    {record.macroactividad || 'Sin macroactividad'} - {record.actividad || 'Sin actividad'}
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
                    <ThemedText style={styles.detailLabel}>Cliente: </ThemedText>
                    {record.cliente || 'No especificado'}
                  </ThemedText>
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}># de Corpo: </ThemedText>
                    {record.numero_corpo || 'No especificado'}
                  </ThemedText>
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Responsable de la cuenta: </ThemedText>
                    {record.responsable_cuenta || 'No especificado'}
                  </ThemedText>
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Macroactividad: </ThemedText>
                    {record.macroactividad || 'No especificado'}
                  </ThemedText>
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Actividad: </ThemedText>
                    {record.actividad || 'No especificado'}
                  </ThemedText>
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Tipo de Servicio no Conforme: </ThemedText>
                    {record.tipo_servicio_no_conforme || 'No especificado'}
                  </ThemedText>
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Tipo de registro: </ThemedText>
                    {record.tipo_registro || 'No especificado'}
                  </ThemedText>
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Responsable de registro: </ThemedText>
                    {record.responsable_registro || 'No especificado'}
                  </ThemedText>
                  {record.acciones_seguir && (
                    <ThemedText style={styles.detailText}>
                      <ThemedText style={styles.detailLabel}>Acciones a seguir: </ThemedText>
                      {record.acciones_seguir}
                    </ThemedText>
                  )}
                  {record.responsable_corregir && (
                    <ThemedText style={styles.detailText}>
                      <ThemedText style={styles.detailLabel}>Responsable de corregir: </ThemedText>
                      {record.responsable_corregir}
                    </ThemedText>
                  )}
                  {record.responsable_aprobar && (
                    <ThemedText style={styles.detailText}>
                      <ThemedText style={styles.detailLabel}>Responsable de aprobar: </ThemedText>
                      {record.responsable_aprobar}
                    </ThemedText>
                  )}
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
                      onPress={() => deleteNonConformingProductHandler(record)}
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
      <AppHeader onMenuPress={() => setIsMenuVisible(true)} title="Producto No Conforme y Matriz" />

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
                <ThemedText style={styles.createButtonText}>Nuevo Producto No Conforme</ThemedText>
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
        currentRoute="NonConformingProduct"
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

