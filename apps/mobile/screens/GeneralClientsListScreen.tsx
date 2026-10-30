import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
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
import {
  createGeneralClientsList,
  updateGeneralClientsList,
  deleteGeneralClientsList,
  listGeneralClientsListByCorpo,
} from '@/hooks/evaluationFunctions';
import { eventBus } from '@/hooks/eventBus';

type GeneralClientsListScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'GeneralClientsList'>;

interface GeneralClientsList {
  id: string;
  id_local: string;
  numero_cliente: string | null;
  fecha_inicio: string | null;
  fecha_finalizacion: string | null;
  extension_prorroga: string | null;
  nombre_cliente: string | null;
  area_sede: string | null;
  numero_corpo: string | null;
  numero_licitacion: string | null;
  cantidad_miscelaneos: string | null;
  tipo_requerimiento_insumos: string | null;
  tipo_requerimiento_utencilios: string | null;
  tipo_requerimiento_equipos: string | null;
  ubicacion: string | null;
  fecha_reunion_apertura: string | null;
  necesidades: string | null;
  gustos_preferencias: string | null;
  supervisor_asignado: string | null;
  condiciones_licitaciones: string | null;
  plan_trabajo: string | null;
  encuestas: string | null;
  created_at: string;
  synced?: boolean;
}

interface EditingGeneralClientsList {
  id: string | null;
  id_local: string;
  numero_cliente: string;
  fecha_inicio: string;
  fecha_finalizacion: string;
  extension_prorroga: string;
  nombre_cliente: string;
  area_sede: string;
  numero_corpo: string;
  numero_licitacion: string;
  cantidad_miscelaneos: string;
  tipo_requerimiento_insumos: string;
  tipo_requerimiento_utencilios: string;
  tipo_requerimiento_equipos: string;
  ubicacion: string;
  fecha_reunion_apertura: string;
  necesidades: string;
  gustos_preferencias: string;
  supervisor_asignado: string;
  condiciones_licitaciones: string;
  plan_trabajo: string;
  encuestas: string;
}

export default function GeneralClientsListScreen() {
  const { employee, refreshAccessToken, logout } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<GeneralClientsListScreenNavigationProp>();

  // Data states
  const [lists, setLists] = useState<GeneralClientsList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasCurrentMarca, setHasCurrentMarca] = useState<boolean>(false);

  // Editing state
  const [isCreating, setIsCreating] = useState(false);
  const [editingList, setEditingList] = useState<EditingGeneralClientsList | null>(null);

  // Form fields
  const [numeroCliente, setNumeroCliente] = useState('');
  const [fechaInicio, setFechaInicio] = useState(new Date());
  const [showFechaInicioPicker, setShowFechaInicioPicker] = useState(false);
  const [fechaFinalizacion, setFechaFinalizacion] = useState(new Date());
  const [showFechaFinalizacionPicker, setShowFechaFinalizacionPicker] = useState(false);
  const [extensionProrroga, setExtensionProrroga] = useState('');
  const [nombreCliente, setNombreCliente] = useState('');
  const [areaSede, setAreaSede] = useState('');
  const [numeroCorpo, setNumeroCorpo] = useState('');
  const [numeroLicitacion, setNumeroLicitacion] = useState('');
  const [cantidadMiscelaneos, setCantidadMiscelaneos] = useState('');
  const [tipoRequerimientoInsumos, setTipoRequerimientoInsumos] = useState('');
  const [tipoRequerimientoUtencilios, setTipoRequerimientoUtencilios] = useState('');
  const [tipoRequerimientoEquipos, setTipoRequerimientoEquipos] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [fechaReunionApertura, setFechaReunionApertura] = useState(new Date());
  const [showFechaReunionAperturaPicker, setShowFechaReunionAperturaPicker] = useState(false);
  const [necesidades, setNecesidades] = useState('');
  const [gustosPreferencias, setGustosPreferencias] = useState('');
  const [supervisorAsignado, setSupervisorAsignado] = useState('');
  const [condicionesLicitaciones, setCondicionesLicitaciones] = useState('');
  const [planTrabajo, setPlanTrabajo] = useState('');
  const [encuestas, setEncuestas] = useState('');

  const getConnectionStatus = async (): Promise<boolean> => {
    try {
      const networkState = await Network.getNetworkStateAsync();
      return networkState.isConnected ?? false;
    } catch (error) {
      console.error('Error checking network:', error);
      return false;
    }
  };

  const formatDate = (date: Date): string => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const fetchLists = useCallback(async () => {
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
        const result = await listGeneralClientsListByCorpo({
          corpo_id: corpoId,
          refreshAccessToken,
          logout,
        });

        if (result.status && result.data) {
          setLists(result.data as GeneralClientsList[]);
        } else {
          setLists([]);
        }
      } else {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const listsCache = cache.filter((item: any) => item.type === 'general_clients_list');
          setLists(listsCache);
        } else {
          setLists([]);
        }
      }
    } catch (err) {
      console.error('Error fetching lists:', err);
      setError('Error al cargar los listados generales de clientes');
      try {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const listsCache = cache.filter((item: any) => item.type === 'general_clients_list');
          setLists(listsCache);
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
      fetchLists();
      eventBus.on('connectionRestored', fetchLists);
      return () => {
        eventBus.off('connectionRestored', fetchLists);
      };
    }, [fetchLists])
  );

  const resetForm = () => {
    setNumeroCliente('');
    setFechaInicio(new Date());
    setFechaFinalizacion(new Date());
    setExtensionProrroga('');
    setNombreCliente('');
    setAreaSede('');
    setNumeroCorpo('');
    setNumeroLicitacion('');
    setCantidadMiscelaneos('');
    setTipoRequerimientoInsumos('');
    setTipoRequerimientoUtencilios('');
    setTipoRequerimientoEquipos('');
    setUbicacion('');
    setFechaReunionApertura(new Date());
    setNecesidades('');
    setGustosPreferencias('');
    setSupervisorAsignado('');
    setCondicionesLicitaciones('');
    setPlanTrabajo('');
    setEncuestas('');
  };

  const startCreating = () => {
    setIsCreating(true);
    setEditingList(null);
    resetForm();
  };

  const cancelCreating = () => {
    setIsCreating(false);
    resetForm();
  };

  const startEditing = (list: GeneralClientsList) => {
    setIsCreating(false);
    setEditingList({
      id: list.id,
      id_local: list.id_local,
      numero_cliente: list.numero_cliente || '',
      fecha_inicio: list.fecha_inicio || '',
      fecha_finalizacion: list.fecha_finalizacion || '',
      extension_prorroga: list.extension_prorroga || '',
      nombre_cliente: list.nombre_cliente || '',
      area_sede: list.area_sede || '',
      numero_corpo: list.numero_corpo || '',
      numero_licitacion: list.numero_licitacion || '',
      cantidad_miscelaneos: list.cantidad_miscelaneos || '',
      tipo_requerimiento_insumos: list.tipo_requerimiento_insumos || '',
      tipo_requerimiento_utencilios: list.tipo_requerimiento_utencilios || '',
      tipo_requerimiento_equipos: list.tipo_requerimiento_equipos || '',
      ubicacion: list.ubicacion || '',
      fecha_reunion_apertura: list.fecha_reunion_apertura || '',
      necesidades: list.necesidades || '',
      gustos_preferencias: list.gustos_preferencias || '',
      supervisor_asignado: list.supervisor_asignado || '',
      condiciones_licitaciones: list.condiciones_licitaciones || '',
      plan_trabajo: list.plan_trabajo || '',
      encuestas: list.encuestas || '',
    });

    setNumeroCliente(list.numero_cliente || '');
    if (list.fecha_inicio) {
      const dateParts = list.fecha_inicio.split('/');
      if (dateParts.length === 3) {
        setFechaInicio(new Date(parseInt(dateParts[2]), parseInt(dateParts[1]) - 1, parseInt(dateParts[0])));
      }
    }
    if (list.fecha_finalizacion) {
      const dateParts = list.fecha_finalizacion.split('/');
      if (dateParts.length === 3) {
        setFechaFinalizacion(new Date(parseInt(dateParts[2]), parseInt(dateParts[1]) - 1, parseInt(dateParts[0])));
      }
    }
    setExtensionProrroga(list.extension_prorroga || '');
    setNombreCliente(list.nombre_cliente || '');
    setAreaSede(list.area_sede || '');
    setNumeroCorpo(list.numero_corpo || '');
    setNumeroLicitacion(list.numero_licitacion || '');
    setCantidadMiscelaneos(list.cantidad_miscelaneos || '');
    setTipoRequerimientoInsumos(list.tipo_requerimiento_insumos || '');
    setTipoRequerimientoUtencilios(list.tipo_requerimiento_utencilios || '');
    setTipoRequerimientoEquipos(list.tipo_requerimiento_equipos || '');
    setUbicacion(list.ubicacion || '');
    if (list.fecha_reunion_apertura) {
      const dateParts = list.fecha_reunion_apertura.split('/');
      if (dateParts.length === 3) {
        setFechaReunionApertura(new Date(parseInt(dateParts[2]), parseInt(dateParts[1]) - 1, parseInt(dateParts[0])));
      }
    }
    setNecesidades(list.necesidades || '');
    setGustosPreferencias(list.gustos_preferencias || '');
    setSupervisorAsignado(list.supervisor_asignado || '');
    setCondicionesLicitaciones(list.condiciones_licitaciones || '');
    setPlanTrabajo(list.plan_trabajo || '');
    setEncuestas(list.encuestas || '');
  };

  const cancelEditing = () => {
    setEditingList(null);
    resetForm();
  };

  const handleDateChange = (event: any, selectedDate: Date | undefined, type: 'inicio' | 'finalizacion' | 'reunion') => {
    if (Platform.OS === 'android') {
      if (type === 'inicio') setShowFechaInicioPicker(false);
      if (type === 'finalizacion') setShowFechaFinalizacionPicker(false);
      if (type === 'reunion') setShowFechaReunionAperturaPicker(false);
    }
    if (selectedDate) {
      if (type === 'inicio') setFechaInicio(selectedDate);
      if (type === 'finalizacion') setFechaFinalizacion(selectedDate);
      if (type === 'reunion') setFechaReunionApertura(selectedDate);
    }
  };

  const saveListHandler = async () => {
    const currentMarca = await AsyncStorage.getItem('current_marca');
    if (!currentMarca) {
      Alert.alert('Error', 'No se encontró la marca actual');
      return;
    }

    const currentMarcaData = JSON.parse(currentMarca);

    Alert.alert('Confirmar', '¿Estás seguro de que deseas guardar este listado general de clientes?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: async () => {
          try {
            const requestData = {
              marca_id: currentMarcaData.id,
              numero_cliente: numeroCliente.trim() || null,
              fecha_inicio: formatDate(fechaInicio) || null,
              fecha_finalizacion: formatDate(fechaFinalizacion) || null,
              extension_prorroga: extensionProrroga.trim() || null,
              nombre_cliente: nombreCliente.trim() || null,
              area_sede: areaSede.trim() || null,
              numero_corpo: numeroCorpo.trim() || null,
              numero_licitacion: numeroLicitacion.trim() || null,
              cantidad_miscelaneos: cantidadMiscelaneos.trim() || null,
              tipo_requerimiento_insumos: tipoRequerimientoInsumos.trim() || null,
              tipo_requerimiento_utencilios: tipoRequerimientoUtencilios.trim() || null,
              tipo_requerimiento_equipos: tipoRequerimientoEquipos.trim() || null,
              ubicacion: ubicacion.trim() || null,
              fecha_reunion_apertura: formatDate(fechaReunionApertura) || null,
              necesidades: necesidades.trim() || null,
              gustos_preferencias: gustosPreferencias.trim() || null,
              supervisor_asignado: supervisorAsignado.trim() || null,
              condiciones_licitaciones: condicionesLicitaciones.trim() || null,
              plan_trabajo: planTrabajo.trim() || null,
              encuestas: encuestas.trim() || null,
            };

            const isConnected = await getConnectionStatus();

            if (isConnected) {
              const result = await createGeneralClientsList({
                requestData,
                refreshAccessToken,
                logout,
              });

              if (result.status) {
                Alert.alert('Éxito', 'Listado general de clientes creado correctamente');
                setIsCreating(false);
                resetForm();
                fetchLists();
              } else {
                Alert.alert('Error', result.message || 'Error al crear el listado general de clientes');
              }
            } else {
              const id_local = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
              const newList: GeneralClientsList = {
                id: id_local,
                id_local: id_local,
                numero_cliente: numeroCliente.trim() || null,
                fecha_inicio: formatDate(fechaInicio) || null,
                fecha_finalizacion: formatDate(fechaFinalizacion) || null,
                extension_prorroga: extensionProrroga.trim() || null,
                nombre_cliente: nombreCliente.trim() || null,
                area_sede: areaSede.trim() || null,
                numero_corpo: numeroCorpo.trim() || null,
                numero_licitacion: numeroLicitacion.trim() || null,
                cantidad_miscelaneos: cantidadMiscelaneos.trim() || null,
                tipo_requerimiento_insumos: tipoRequerimientoInsumos.trim() || null,
                tipo_requerimiento_utencilios: tipoRequerimientoUtencilios.trim() || null,
                tipo_requerimiento_equipos: tipoRequerimientoEquipos.trim() || null,
                ubicacion: ubicacion.trim() || null,
                fecha_reunion_apertura: formatDate(fechaReunionApertura) || null,
                necesidades: necesidades.trim() || null,
                gustos_preferencias: gustosPreferencias.trim() || null,
                supervisor_asignado: supervisorAsignado.trim() || null,
                condiciones_licitaciones: condicionesLicitaciones.trim() || null,
                plan_trabajo: planTrabajo.trim() || null,
                encuestas: encuestas.trim() || null,
                created_at: new Date().toISOString(),
                synced: false,
              };

              const cacheStr = await AsyncStorage.getItem('evaluations_cache');
              const cache = cacheStr ? JSON.parse(cacheStr) : [];
              cache.push({ ...newList, type: 'general_clients_list' });
              await AsyncStorage.setItem('evaluations_cache', JSON.stringify(cache));

              const actionsStr = await AsyncStorage.getItem('evaluations_actions');
              const actions = actionsStr ? JSON.parse(actionsStr) : [];
              actions.push({
                id: id_local,
                action: 'create',
                payload: requestData,
                type: 'general_clients_list',
                synced: false,
              });
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

              Alert.alert('Guardado offline', 'El listado general de clientes se guardó localmente y se sincronizará cuando haya conexión');
              setIsCreating(false);
              resetForm();
              fetchLists();
            }
          } catch (err) {
            console.error('Error saving list:', err);
            Alert.alert('Error', 'Error al guardar el listado general de clientes');
          }
        },
      },
    ]);
  };

  const updateListHandler = async () => {
    if (!editingList) return;

    Alert.alert('Confirmar', '¿Estás seguro de que deseas actualizar este listado general de clientes?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: async () => {
          try {
            const requestData = {
              numero_cliente: numeroCliente.trim() || null,
              fecha_inicio: formatDate(fechaInicio) || null,
              fecha_finalizacion: formatDate(fechaFinalizacion) || null,
              extension_prorroga: extensionProrroga.trim() || null,
              nombre_cliente: nombreCliente.trim() || null,
              area_sede: areaSede.trim() || null,
              numero_corpo: numeroCorpo.trim() || null,
              numero_licitacion: numeroLicitacion.trim() || null,
              cantidad_miscelaneos: cantidadMiscelaneos.trim() || null,
              tipo_requerimiento_insumos: tipoRequerimientoInsumos.trim() || null,
              tipo_requerimiento_utencilios: tipoRequerimientoUtencilios.trim() || null,
              tipo_requerimiento_equipos: tipoRequerimientoEquipos.trim() || null,
              ubicacion: ubicacion.trim() || null,
              fecha_reunion_apertura: formatDate(fechaReunionApertura) || null,
              necesidades: necesidades.trim() || null,
              gustos_preferencias: gustosPreferencias.trim() || null,
              supervisor_asignado: supervisorAsignado.trim() || null,
              condiciones_licitaciones: condicionesLicitaciones.trim() || null,
              plan_trabajo: planTrabajo.trim() || null,
              encuestas: encuestas.trim() || null,
            };

            const isConnected = await getConnectionStatus();
            const recordId = editingList.id || editingList.id_local;

            if (isConnected && editingList.id && !editingList.id.startsWith('local_')) {
              const result = await updateGeneralClientsList({
                id: recordId,
                requestData,
                refreshAccessToken,
                logout,
              });

              if (result.status) {
                Alert.alert('Éxito', 'Listado general de clientes actualizado correctamente');
                setEditingList(null);
                resetForm();
                fetchLists();
              } else {
                Alert.alert('Error', result.message || 'Error al actualizar el listado general de clientes');
              }
            } else {
              const actionsStr = await AsyncStorage.getItem('evaluations_actions');
              const actions = actionsStr ? JSON.parse(actionsStr) : [];
              actions.push({
                id: recordId,
                action: 'update',
                payload: requestData,
                type: 'general_clients_list',
                synced: false,
              });
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

              const cacheStr = await AsyncStorage.getItem('evaluations_cache');
              if (cacheStr) {
                const cache = JSON.parse(cacheStr);
                const updatedCache = cache.map((item: any) => {
                  if ((item.id === recordId || item.id_local === recordId) && item.type === 'general_clients_list') {
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

              Alert.alert('Actualizado offline', 'El listado general de clientes se actualizó localmente y se sincronizará cuando haya conexión');
              setEditingList(null);
              resetForm();
              fetchLists();
            }
          } catch (err) {
            console.error('Error updating list:', err);
            Alert.alert('Error', 'Error al actualizar el listado general de clientes');
          }
        },
      },
    ]);
  };

  const deleteListHandler = async (list: GeneralClientsList) => {
    Alert.alert('Confirmar', '¿Estás seguro de que deseas eliminar este listado general de clientes?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            const isConnected = await getConnectionStatus();
            const recordId = list.id && !list.id.startsWith('local_') ? list.id : list.id_local;

            if (isConnected && list.id && !list.id.startsWith('local_')) {
              const result = await deleteGeneralClientsList({
                id: recordId,
                refreshAccessToken,
                logout,
              });

              if (result.status) {
                Alert.alert('Éxito', 'Listado general de clientes eliminado correctamente');
                fetchLists();
              } else {
                Alert.alert('Error', result.message || 'Error al eliminar el listado general de clientes');
              }
            } else {
              const actionsStr = await AsyncStorage.getItem('evaluations_actions');
              const actions = actionsStr ? JSON.parse(actionsStr) : [];
              actions.push({
                id: recordId,
                action: 'delete',
                payload: {},
                type: 'general_clients_list',
                synced: false,
              });
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

              const cacheStr = await AsyncStorage.getItem('evaluations_cache');
              if (cacheStr) {
                const cache = JSON.parse(cacheStr);
                const updatedCache = cache.filter((item: any) => !((item.id === recordId || item.id_local === recordId) && item.type === 'general_clients_list'));
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
              }

              Alert.alert('Eliminado offline', 'El listado general de clientes se eliminó localmente y se sincronizará cuando haya conexión');
              fetchLists();
            }
          } catch (err) {
            console.error('Error deleting list:', err);
            Alert.alert('Error', 'Error al eliminar el listado general de clientes');
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

  const renderListList = () => {
    if (isLoading) {
      return (
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Cargando listados generales de clientes...</ThemedText>
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

    if (lists.length === 0) {
      return (
        <ThemedView style={styles.emptyContainer}>
          <ThemedText style={styles.emptyText}>No hay listados generales de clientes registrados.</ThemedText>
        </ThemedView>
      );
    }

    return (
      <ThemedView style={styles.listContainer}>
        {lists.map((list) => (
          <ThemedView key={list.id || list.id_local} style={styles.listItem}>
            <ThemedView style={styles.listItemHeader}>
              <ThemedView style={styles.listItemContent}>
                <ThemedText style={styles.listItemTitle}>
                  {list.nombre_cliente || `Listado #${list.numero_cliente || 'N/A'}`}
                </ThemedText>
                {list.numero_cliente && (
                  <ThemedText style={styles.listItemSubtitle}>
                    N° Cliente: {list.numero_cliente}
                  </ThemedText>
                )}
                {list.area_sede && (
                  <ThemedText style={styles.listItemSubtitle}>
                    Área/Sede: {list.area_sede}
                  </ThemedText>
                )}
                {!list.synced && (
                  <ThemedText style={styles.offlineBadge}>Sin sincronizar</ThemedText>
                )}
              </ThemedView>
              <ThemedView style={styles.listItemActions}>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => startEditing(list)}
                >
                  {getActionIcon('edit')}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deleteListHandler(list)}
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
    if (!isCreating && !editingList) return null;

    return (
      <ThemedView style={styles.formContainer}>
        <ThemedText style={styles.formTitle}>
          {isCreating ? 'Nuevo Listado General de Clientes' : 'Editar Listado General de Clientes'}
        </ThemedText>

        <ScrollView 
          style={styles.formScrollView} 
          contentContainerStyle={styles.formScrollViewContent}
          showsVerticalScrollIndicator={true}
          nestedScrollEnabled={true}
        >
          <ThemedView style={styles.formSection}>
            <ThemedText style={styles.label}>N° de Cliente</ThemedText>
            <TextInput
              style={styles.input}
              value={numeroCliente}
              onChangeText={setNumeroCliente}
              placeholder="Ingrese el número de cliente"
              placeholderTextColor="#999"
            />
          </ThemedView>

          <ThemedView style={styles.formSection}>
            <ThemedText style={styles.label}>Fecha de Inicio</ThemedText>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowFechaInicioPicker(true)}
            >
              <ThemedText style={styles.dateButtonText}>{formatDate(fechaInicio)}</ThemedText>
            </TouchableOpacity>
            {showFechaInicioPicker && (
              <DateTimePicker
                value={fechaInicio}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, date) => handleDateChange(event, date, 'inicio')}
              />
            )}
          </ThemedView>

          <ThemedView style={styles.formSection}>
            <ThemedText style={styles.label}>Fecha de Finalización</ThemedText>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowFechaFinalizacionPicker(true)}
            >
              <ThemedText style={styles.dateButtonText}>{formatDate(fechaFinalizacion)}</ThemedText>
            </TouchableOpacity>
            {showFechaFinalizacionPicker && (
              <DateTimePicker
                value={fechaFinalizacion}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, date) => handleDateChange(event, date, 'finalizacion')}
              />
            )}
          </ThemedView>

          <ThemedView style={styles.formSection}>
            <ThemedText style={styles.label}>Extensión o Prórroga de Contrato</ThemedText>
            <TextInput
              style={styles.input}
              value={extensionProrroga}
              onChangeText={setExtensionProrroga}
              placeholder="Ingrese la extensión o prórroga"
              placeholderTextColor="#999"
            />
          </ThemedView>

          <ThemedView style={styles.formSection}>
            <ThemedText style={styles.label}>Nombre de Cliente</ThemedText>
            <TextInput
              style={styles.input}
              value={nombreCliente}
              onChangeText={setNombreCliente}
              placeholder="Ingrese el nombre del cliente"
              placeholderTextColor="#999"
            />
          </ThemedView>

          <ThemedView style={styles.formSection}>
            <ThemedText style={styles.label}>Área o Sede</ThemedText>
            <TextInput
              style={styles.input}
              value={areaSede}
              onChangeText={setAreaSede}
              placeholder="Ingrese el área o sede"
              placeholderTextColor="#999"
            />
          </ThemedView>

          <ThemedView style={styles.formSection}>
            <ThemedText style={styles.label}>N° de Corpo</ThemedText>
            <TextInput
              style={styles.input}
              value={numeroCorpo}
              onChangeText={setNumeroCorpo}
              placeholder="Ingrese el número de corpo"
              placeholderTextColor="#999"
            />
          </ThemedView>

          <ThemedView style={styles.formSection}>
            <ThemedText style={styles.label}>N° de Licitación</ThemedText>
            <TextInput
              style={styles.input}
              value={numeroLicitacion}
              onChangeText={setNumeroLicitacion}
              placeholder="Ingrese el número de licitación"
              placeholderTextColor="#999"
            />
          </ThemedView>

          <ThemedView style={styles.formSection}>
            <ThemedText style={styles.label}>Cantidad de Misceláneos</ThemedText>
            <TextInput
              style={styles.input}
              value={cantidadMiscelaneos}
              onChangeText={setCantidadMiscelaneos}
              placeholder="Ingrese la cantidad de misceláneos"
              placeholderTextColor="#999"
              keyboardType="numeric"
            />
          </ThemedView>

          <ThemedView style={styles.formSection}>
            <ThemedText style={styles.sectionTitle}>Tipo de Requerimiento</ThemedText>
            <ThemedView style={styles.formSection}>
              <ThemedText style={styles.label}>Insumos</ThemedText>
              <TextInput
                style={styles.input}
                value={tipoRequerimientoInsumos}
                onChangeText={setTipoRequerimientoInsumos}
                placeholder="Ingrese los insumos"
                placeholderTextColor="#999"
              />
            </ThemedView>
            <ThemedView style={styles.formSection}>
              <ThemedText style={styles.label}>Utensilios</ThemedText>
              <TextInput
                style={styles.input}
                value={tipoRequerimientoUtencilios}
                onChangeText={setTipoRequerimientoUtencilios}
                placeholder="Ingrese los utensilios"
                placeholderTextColor="#999"
              />
            </ThemedView>
            <ThemedView style={styles.formSection}>
              <ThemedText style={styles.label}>Equipos</ThemedText>
              <TextInput
                style={styles.input}
                value={tipoRequerimientoEquipos}
                onChangeText={setTipoRequerimientoEquipos}
                placeholder="Ingrese los equipos"
                placeholderTextColor="#999"
              />
            </ThemedView>
          </ThemedView>

          <ThemedView style={styles.formSection}>
            <ThemedText style={styles.label}>Ubicación</ThemedText>
            <TextInput
              style={styles.input}
              value={ubicacion}
              onChangeText={setUbicacion}
              placeholder="Ingrese la ubicación"
              placeholderTextColor="#999"
            />
          </ThemedView>

          <ThemedView style={styles.formSection}>
            <ThemedText style={styles.label}>Fecha de Reunión de Apertura</ThemedText>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowFechaReunionAperturaPicker(true)}
            >
              <ThemedText style={styles.dateButtonText}>{formatDate(fechaReunionApertura)}</ThemedText>
            </TouchableOpacity>
            {showFechaReunionAperturaPicker && (
              <DateTimePicker
                value={fechaReunionApertura}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, date) => handleDateChange(event, date, 'reunion')}
              />
            )}
          </ThemedView>

          <ThemedView style={styles.formSection}>
            <ThemedText style={styles.label}>Necesidades</ThemedText>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={necesidades}
              onChangeText={setNecesidades}
              placeholder="Ingrese las necesidades"
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
            />
          </ThemedView>

          <ThemedView style={styles.formSection}>
            <ThemedText style={styles.label}>Gustos y Preferencias</ThemedText>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={gustosPreferencias}
              onChangeText={setGustosPreferencias}
              placeholder="Ingrese los gustos y preferencias"
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
            />
          </ThemedView>

          <ThemedView style={styles.formSection}>
            <ThemedText style={styles.label}>Supervisor Asignado</ThemedText>
            <TextInput
              style={styles.input}
              value={supervisorAsignado}
              onChangeText={setSupervisorAsignado}
              placeholder="Ingrese el supervisor asignado"
              placeholderTextColor="#999"
            />
          </ThemedView>

          <ThemedView style={styles.formSection}>
            <ThemedText style={styles.label}>Condiciones de Licitaciones</ThemedText>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={condicionesLicitaciones}
              onChangeText={setCondicionesLicitaciones}
              placeholder="Ingrese las condiciones de licitaciones"
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
            />
          </ThemedView>

          <ThemedView style={styles.formSection}>
            <ThemedText style={styles.label}>Plan de Trabajo</ThemedText>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={planTrabajo}
              onChangeText={setPlanTrabajo}
              placeholder="Ingrese el plan de trabajo"
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
            />
          </ThemedView>

          <ThemedView style={styles.formSection}>
            <ThemedText style={styles.label}>Encuestas</ThemedText>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={encuestas}
              onChangeText={setEncuestas}
              placeholder="Ingrese las encuestas"
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
            />
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
              onPress={isCreating ? saveListHandler : updateListHandler}
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
        title="Listado General de Clientes"
      />
      <SlideMenu
        isVisible={isMenuVisible}
        onClose={() => setIsMenuVisible(false)}
        navigation={navigation}
      />
      {isCreating || editingList ? (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.formWrapper}>
          {renderForm()}
        </ScrollView>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {hasCurrentMarca && (
            <TouchableOpacity style={styles.addButton} onPress={startCreating}>
              <ThemedView style={styles.addButtonContent}>
                {getActionIcon('add')}
                <ThemedText style={styles.addButtonText}>Nuevo Listado</ThemedText>
              </ThemedView>
            </TouchableOpacity>
          )}
          {renderListList()}
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
  formWrapper: {
    padding: 15,
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
  formSection: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 10,
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
  dateButton: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#FFF',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#000',
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

