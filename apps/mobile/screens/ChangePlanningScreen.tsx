import React, { useState, useCallback, useRef } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  View,
  Image,
  Modal,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
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
  createChangePlanning,
  updateChangePlanning,
  deleteChangePlanning,
  listChangePlanningByCorpo,
} from '@/hooks/evaluationFunctions';
import { eventBus } from '@/hooks/eventBus';

type ChangePlanningScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ChangePlanning'>;

interface ProcesoAfectado {
  nombre: string;
  afectado: boolean;
}

interface Actividad {
  actividad_desarrollar: string;
  procesos_afectados: ProcesoAfectado[];
  analisis_impacto: string;
  documentos_requeridos: string;
  recursos_necesarios: string;
  reasignacion_responsabilidades: string;
  responsables: string;
  fecha_limite: string;
  observaciones: string;
}

interface DatosCambio {
  nombre_cambio: string;
  proposito_cambio: string;
  consecuencias_positivas: string;
  consecuencias_adversas: string;
  acciones_mitigar: string;
  cambio_legislacion: boolean;
  cambio_producto_servicio: boolean;
  cambio_mapa_procesos: boolean;
  cambio_servicios_productos: boolean;
  cambio_politicas: boolean;
  cambio_otro: boolean;
  cambio_otro_descripcion: string;
  cambio_afecta_cliente: string;
  necesidad_control: string;
}

interface ChangePlanning {
  id: string;
  id_local: string;
  datos_cambio: string | null;
  actividades: string | null;
  aprobado_por: string | null;
  firma_representante: string | null;
  fecha_aprobacion: string | null;
  created_at: string;
  synced?: boolean;
}

interface EditingChangePlanning {
  id: string | null;
  id_local: string;
  datos_cambio: string;
  actividades: string;
  aprobado_por: string;
  firma_representante: string;
  fecha_aprobacion: string;
}

const PROCESOS_PREDETERMINADOS = [
  'Seguridad',
  'Aseo y Limpieza',
];

export default function ChangePlanningScreen() {
  const { employee, refreshAccessToken, logout } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<ChangePlanningScreenNavigationProp>();

  // Data states
  const [plannings, setPlannings] = useState<ChangePlanning[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasCurrentMarca, setHasCurrentMarca] = useState<boolean>(false);

  // Editing state
  const [isCreating, setIsCreating] = useState(false);
  const [editingPlanning, setEditingPlanning] = useState<EditingChangePlanning | null>(null);

  // Form fields - Datos del cambio
  const [datosCambio, setDatosCambio] = useState<DatosCambio>({
    nombre_cambio: '',
    proposito_cambio: '',
    consecuencias_positivas: '',
    consecuencias_adversas: '',
    acciones_mitigar: '',
    cambio_legislacion: false,
    cambio_producto_servicio: false,
    cambio_mapa_procesos: false,
    cambio_servicios_productos: false,
    cambio_politicas: false,
    cambio_otro: false,
    cambio_otro_descripcion: '',
    cambio_afecta_cliente: '',
    necesidad_control: '',
  });

  // Form fields - Actividades
  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [expandedActividadesIndices, setExpandedActividadesIndices] = useState<number[]>([]);
  const [showFechaActividadPicker, setShowFechaActividadPicker] = useState<{ index: number; visible: boolean }>({ index: -1, visible: false });
  const [fechaActividadDates, setFechaActividadDates] = useState<{ [key: number]: Date }>({});

  // Form fields - Aprobación
  const [aprobadoPor, setAprobadoPor] = useState('');
  const [firmaRepresentante, setFirmaRepresentante] = useState<string | null>(null);
  const [fechaAprobacion, setFechaAprobacion] = useState('');
  const [fechaAprobacionDate, setFechaAprobacionDate] = useState(new Date());
  const [showFechaAprobacionPicker, setShowFechaAprobacionPicker] = useState(false);

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

  const fetchPlannings = useCallback(async () => {
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
        const result = await listChangePlanningByCorpo({
          corpo_id: corpoId,
          refreshAccessToken,
          logout,
        });

        if (result.status && result.data) {
          setPlannings(result.data as ChangePlanning[]);
        } else {
          setPlannings([]);
        }
      } else {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const planningsCache = cache.filter((item: any) => item.type === 'change_planning');
          setPlannings(planningsCache);
        } else {
          setPlannings([]);
        }
      }
    } catch (err) {
      console.error('Error fetching plannings:', err);
      setError('Error al cargar las planificaciones de cambios del SGC');
      try {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const planningsCache = cache.filter((item: any) => item.type === 'change_planning');
          setPlannings(planningsCache);
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
      fetchPlannings();
      eventBus.on('connectionRestored', fetchPlannings);
      return () => {
        eventBus.off('connectionRestored', fetchPlannings);
      };
    }, [fetchPlannings])
  );

  const resetForm = () => {
    setDatosCambio({
      nombre_cambio: '',
      proposito_cambio: '',
      consecuencias_positivas: '',
      consecuencias_adversas: '',
      acciones_mitigar: '',
      cambio_legislacion: false,
      cambio_producto_servicio: false,
      cambio_mapa_procesos: false,
      cambio_servicios_productos: false,
      cambio_politicas: false,
      cambio_otro: false,
      cambio_otro_descripcion: '',
      cambio_afecta_cliente: '',
      necesidad_control: '',
    });
    setActividades([]);
    setExpandedActividadesIndices([]);
    setAprobadoPor('');
    setFirmaRepresentante(null);
    setFechaAprobacion('');
    setFechaAprobacionDate(new Date());
    setShowFechaAprobacionPicker(false);
    setShowFechaActividadPicker({ index: -1, visible: false });
    setFechaActividadDates({});
  };

  const startCreating = () => {
    setIsCreating(true);
    setEditingPlanning(null);
    resetForm();
  };

  const cancelCreating = () => {
    setIsCreating(false);
    resetForm();
  };

  const startEditing = (planning: ChangePlanning) => {
    setIsCreating(false);
    setEditingPlanning({
      id: planning.id,
      id_local: planning.id_local,
      datos_cambio: planning.datos_cambio || '',
      actividades: planning.actividades || '',
      aprobado_por: planning.aprobado_por || '',
      firma_representante: planning.firma_representante || '',
      fecha_aprobacion: planning.fecha_aprobacion || '',
    });

    if (planning.datos_cambio) {
      try {
        const parsed = JSON.parse(planning.datos_cambio);
        setDatosCambio(parsed);
      } catch {
        setDatosCambio({
          nombre_cambio: '',
          proposito_cambio: '',
          consecuencias_positivas: '',
          consecuencias_adversas: '',
          acciones_mitigar: '',
          cambio_legislacion: false,
          cambio_producto_servicio: false,
          cambio_mapa_procesos: false,
          cambio_servicios_productos: false,
          cambio_politicas: false,
          cambio_otro: false,
          cambio_otro_descripcion: '',
          cambio_afecta_cliente: '',
          necesidad_control: '',
        });
      }
    }

    if (planning.actividades) {
      try {
        const parsed = JSON.parse(planning.actividades);
        setActividades(parsed);
      } catch {
        setActividades([]);
      }
    } else {
      setActividades([]);
    }

    setAprobadoPor(planning.aprobado_por || '');
    setFirmaRepresentante(formatSignatureForDisplay(planning.firma_representante));
    setFechaAprobacion(planning.fecha_aprobacion || '');
    if (planning.fecha_aprobacion) {
      try {
        const date = new Date(planning.fecha_aprobacion);
        if (!isNaN(date.getTime())) {
          setFechaAprobacionDate(date);
        }
      } catch {
        // Si no se puede parsear, usar fecha actual
      }
    }

    // Cargar fechas de actividades
    if (planning.actividades) {
      try {
        const parsed = JSON.parse(planning.actividades);
        const fechas: { [key: number]: Date } = {};
        parsed.forEach((act: Actividad, idx: number) => {
          if (act.fecha_limite) {
            try {
              const date = new Date(act.fecha_limite);
              if (!isNaN(date.getTime())) {
                fechas[idx] = date;
              }
            } catch {
              // Si no se puede parsear, usar fecha actual
            }
          }
        });
        setFechaActividadDates(fechas);
      } catch {
        // Error al parsear
      }
    }
  };

  const cancelEditing = () => {
    setEditingPlanning(null);
    resetForm();
  };

  const addActividad = () => {
    const procesosIniciales: ProcesoAfectado[] = PROCESOS_PREDETERMINADOS.map(nombre => ({
      nombre,
      afectado: false,
    }));

    const newActividad: Actividad = {
      actividad_desarrollar: '',
      procesos_afectados: procesosIniciales,
      analisis_impacto: '',
      documentos_requeridos: '',
      recursos_necesarios: '',
      reasignacion_responsabilidades: '',
      responsables: '',
      fecha_limite: '',
      observaciones: '',
    };
    setActividades([...actividades, newActividad]);
  };

  const addProcesoPersonalizado = (actividadIndex: number) => {
    const updated = [...actividades];
    const nuevosProcesos = [...updated[actividadIndex].procesos_afectados];
    nuevosProcesos.push({
      nombre: '',
      afectado: false,
    });
    updated[actividadIndex] = { ...updated[actividadIndex], procesos_afectados: nuevosProcesos };
    setActividades(updated);
  };

  const removeProcesoPersonalizado = (actividadIndex: number, procesoIndex: number) => {
    const updated = [...actividades];
    const procesos = [...updated[actividadIndex].procesos_afectados];
    // Solo permitir eliminar procesos personalizados (no los predeterminados)
    if (procesoIndex >= PROCESOS_PREDETERMINADOS.length) {
      procesos.splice(procesoIndex, 1);
      updated[actividadIndex] = { ...updated[actividadIndex], procesos_afectados: procesos };
      setActividades(updated);
    }
  };

  const updateProcesoNombre = (actividadIndex: number, procesoIndex: number, nombre: string) => {
    const updated = [...actividades];
    const procesos = [...updated[actividadIndex].procesos_afectados];
    procesos[procesoIndex] = { ...procesos[procesoIndex], nombre };
    updated[actividadIndex] = { ...updated[actividadIndex], procesos_afectados: procesos };
    setActividades(updated);
  };

  const removeActividad = (index: number) => {
    const updated = [...actividades];
    updated.splice(index, 1);
    setActividades(updated);
    setExpandedActividadesIndices(expandedActividadesIndices.filter(i => i !== index).map(i => i > index ? i - 1 : i));
  };

  const updateActividad = (index: number, field: keyof Actividad, value: any) => {
    const updated = [...actividades];
    updated[index] = { ...updated[index], [field]: value };
    setActividades(updated);
  };

  const toggleProcesoAfectado = (actividadIndex: number, procesoIndex: number) => {
    const updated = [...actividades];
    const procesos = [...updated[actividadIndex].procesos_afectados];
    procesos[procesoIndex] = { ...procesos[procesoIndex], afectado: !procesos[procesoIndex].afectado };
    updated[actividadIndex] = { ...updated[actividadIndex], procesos_afectados: procesos };
    setActividades(updated);
  };

  const toggleActividadExpansion = (index: number) => {
    if (expandedActividadesIndices.includes(index)) {
      setExpandedActividadesIndices(expandedActividadesIndices.filter(i => i !== index));
    } else {
      setExpandedActividadesIndices([...expandedActividadesIndices, index]);
    }
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
      setFirmaRepresentante(formattedSignature);
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

  const savePlanningHandler = async () => {
    const currentMarca = await AsyncStorage.getItem('current_marca');
    if (!currentMarca) {
      Alert.alert('Error', 'No se encontró la marca actual');
      return;
    }

    const currentMarcaData = JSON.parse(currentMarca);

    Alert.alert('Confirmar', '¿Estás seguro de que deseas guardar esta planificación de cambios del SGC?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: async () => {
          try {
            const requestData = {
              marca_id: currentMarcaData.id,
              datos_cambio: JSON.stringify(datosCambio),
              actividades: JSON.stringify(actividades),
              aprobado_por: aprobadoPor.trim() || null,
              firma_representante: getBase64Only(firmaRepresentante),
              fecha_aprobacion: fechaAprobacion.trim() || null,
            };

            const isConnected = await getConnectionStatus();

            if (isConnected) {
              const result = await createChangePlanning({
                requestData,
                refreshAccessToken,
                logout,
              });

              if (result.status) {
                Alert.alert('Éxito', 'Planificación de cambios del SGC creada correctamente');
                setIsCreating(false);
                resetForm();
                fetchPlannings();
              } else {
                Alert.alert('Error', result.message || 'Error al crear la planificación de cambios del SGC');
              }
            } else {
              const localId = generateRandomId();

              const actionsStr = await AsyncStorage.getItem('evaluations_actions');
              const actions = actionsStr ? JSON.parse(actionsStr) : [];
              actions.push({
                id: localId,
                action: 'create',
                type: 'change_planning',
                payload: requestData,
                synced: false,
              });
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

              const cacheStr = await AsyncStorage.getItem('evaluations_cache');
              const cache = cacheStr ? JSON.parse(cacheStr) : [];

              const newPlanningCache: ChangePlanning = {
                id: '',
                id_local: localId,
                datos_cambio: JSON.stringify(datosCambio),
                actividades: JSON.stringify(actividades),
                aprobado_por: aprobadoPor.trim() || null,
                firma_representante: getBase64Only(firmaRepresentante),
                fecha_aprobacion: fechaAprobacion.trim() || null,
                created_at: new Date().toISOString(),
                synced: false,
              };

              cache.push({ ...newPlanningCache, type: 'change_planning' });
              await AsyncStorage.setItem('evaluations_cache', JSON.stringify(cache));

              Alert.alert('Modo Offline', 'Planificación de cambios del SGC registrada localmente. Se sincronizará cuando haya conexión.');
              setIsCreating(false);
              resetForm();
              fetchPlannings();
            }
          } catch (err) {
            console.error('Error saving planning:', err);
            Alert.alert('Error', 'No se pudo guardar la planificación de cambios del SGC');
          }
        },
      },
    ]);
  };

  const updatePlanningHandler = async () => {
    if (!editingPlanning) return;

    const planningId = editingPlanning.id || editingPlanning.id_local;
    if (!planningId) {
      Alert.alert('Error', 'ID de planificación no encontrado para actualizar');
      return;
    }

    Alert.alert('Confirmar', '¿Estás seguro de que deseas actualizar esta planificación de cambios del SGC?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: async () => {
          try {
            const requestData = {
              datos_cambio: JSON.stringify(datosCambio),
              actividades: JSON.stringify(actividades),
              aprobado_por: aprobadoPor.trim() || null,
              firma_representante: getBase64Only(firmaRepresentante),
              fecha_aprobacion: fechaAprobacion.trim() || null,
            };

            const isConnected = await getConnectionStatus();

            if (isConnected) {
              const result = await updateChangePlanning({
                id: planningId,
                requestData,
                refreshAccessToken,
                logout,
              });

              if (result.status) {
                Alert.alert('Éxito', 'Planificación de cambios del SGC actualizada correctamente');
                cancelEditing();
                fetchPlannings();
              } else {
                Alert.alert('Error', result.message || 'Error al actualizar la planificación de cambios del SGC');
              }
            } else {
              const actionsStr = await AsyncStorage.getItem('evaluations_actions');
              const actions = actionsStr ? JSON.parse(actionsStr) : [];
              actions.push({
                id: planningId,
                action: 'update',
                type: 'change_planning',
                payload: requestData,
                synced: false,
              });
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

              const cacheStr = await AsyncStorage.getItem('evaluations_cache');
              if (cacheStr) {
                const cache = JSON.parse(cacheStr);
                const updatedCache = cache.map((item: any) => {
                  if ((item.id === planningId || item.id_local === planningId) && item.type === 'change_planning') {
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

              Alert.alert('Actualizado offline', 'La planificación de cambios del SGC se actualizó localmente y se sincronizará cuando haya conexión');
              cancelEditing();
              fetchPlannings();
            }
          } catch (err) {
            console.error('Error updating planning:', err);
            Alert.alert('Error', 'Error al actualizar la planificación de cambios del SGC');
          }
        },
      },
    ]);
  };

  const deletePlanningHandler = async (planning: ChangePlanning) => {
    Alert.alert('Confirmar', '¿Estás seguro de que deseas eliminar esta planificación de cambios del SGC?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            const isConnected = await getConnectionStatus();
            const recordId = planning.id && !planning.id.startsWith('local_') ? planning.id : planning.id_local;

            if (isConnected && planning.id && !planning.id.startsWith('local_')) {
              const result = await deleteChangePlanning({
                id: recordId,
                refreshAccessToken,
                logout,
              });

              if (result.status) {
                Alert.alert('Éxito', 'Planificación de cambios del SGC eliminada correctamente');
                fetchPlannings();
              } else {
                Alert.alert('Error', result.message || 'Error al eliminar la planificación de cambios del SGC');
              }
            } else {
              const actionsStr = await AsyncStorage.getItem('evaluations_actions');
              const actions = actionsStr ? JSON.parse(actionsStr) : [];
              actions.push({
                id: recordId,
                action: 'delete',
                payload: {},
                type: 'change_planning',
                synced: false,
              });
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

              const cacheStr = await AsyncStorage.getItem('evaluations_cache');
              if (cacheStr) {
                const cache = JSON.parse(cacheStr);
                const updatedCache = cache.filter((item: any) => !((item.id === recordId || item.id_local === recordId) && item.type === 'change_planning'));
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
              }

              Alert.alert('Eliminado offline', 'La planificación de cambios del SGC se eliminó localmente y se sincronizará cuando haya conexión');
              fetchPlannings();
            }
          } catch (err) {
            console.error('Error deleting planning:', err);
            Alert.alert('Error', 'Error al eliminar la planificación de cambios del SGC');
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

  const renderPlanningList = () => {
    if (isLoading) {
      return (
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Cargando planificaciones de cambios del SGC...</ThemedText>
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

    if (plannings.length === 0) {
      return (
        <ThemedView style={styles.emptyContainer}>
          <ThemedText style={styles.emptyText}>No hay planificaciones de cambios del SGC registradas.</ThemedText>
        </ThemedView>
      );
    }

    return (
      <ThemedView style={styles.listContainer}>
        {plannings.map((planning) => (
          <ThemedView key={planning.id || planning.id_local} style={styles.listItem}>
            <ThemedView style={styles.listItemHeader}>
              <ThemedView style={styles.listItemContent}>
                <ThemedText style={styles.listItemTitle}>
                  Planificación de Cambios del SGC
                </ThemedText>
                {planning.aprobado_por && (
                  <ThemedText style={styles.listItemSubtitle}>
                    Aprobado por: {planning.aprobado_por}
                  </ThemedText>
                )}
                {!planning.synced && (
                  <ThemedText style={styles.offlineBadge}>Sin sincronizar</ThemedText>
                )}
              </ThemedView>
              <ThemedView style={styles.listItemActions}>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => startEditing(planning)}
                >
                  {getActionIcon('edit')}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deletePlanningHandler(planning)}
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

  const renderActividad = (actividad: Actividad, index: number) => {
    const isExpanded = expandedActividadesIndices.includes(index);
    
    return (
      <ThemedView key={index} style={styles.actividadItem}>
        <TouchableOpacity
          style={styles.actividadItemHeader}
          onPress={() => toggleActividadExpansion(index)}
        >
          <ThemedText style={styles.actividadItemTitle}>
            Actividad {index + 1} - {actividad.actividad_desarrollar || 'Sin actividad'}
          </ThemedText>
          <ThemedView style={styles.actividadItemHeaderActions}>
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color="#000000"
            />
            <TouchableOpacity
              onPress={() => removeActividad(index)}
              style={styles.removeActividadButton}
            >
              <Ionicons name="trash" size={18} color="#F44336" />
            </TouchableOpacity>
          </ThemedView>
        </TouchableOpacity>

        {isExpanded && (
          <ThemedView style={styles.actividadItemContent}>
            {/* Actividad a desarrollar */}
            <ThemedView style={styles.formSection}>
              <ThemedText style={styles.label}>Actividad a desarrollar</ThemedText>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={actividad.actividad_desarrollar}
                onChangeText={(text) => updateActividad(index, 'actividad_desarrollar', text)}
                placeholder="Ingrese la actividad a desarrollar"
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
              />
            </ThemedView>

            {/* Procesos que se ven afectados */}
            <ThemedView style={styles.formSection}>
              <ThemedText style={styles.label}>Procesos que se ven afectados</ThemedText>
              <ThemedView style={styles.procesosGrid}>
                {actividad.procesos_afectados.map((proceso, procesoIndex) => {
                  const isPredeterminado = procesoIndex < PROCESOS_PREDETERMINADOS.length;
                  return (
                    <ThemedView key={procesoIndex} style={styles.procesoItemContainer}>
                      {isPredeterminado ? (
                        <TouchableOpacity
                          style={styles.procesoCheckboxContainer}
                          onPress={() => toggleProcesoAfectado(index, procesoIndex)}
                        >
                          <View style={[styles.checkbox, proceso.afectado && styles.checkboxChecked]}>
                            {proceso.afectado && (
                              <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                            )}
                          </View>
                          <ThemedText style={styles.procesoLabel}>{proceso.nombre}</ThemedText>
                        </TouchableOpacity>
                      ) : (
                        <ThemedView style={styles.procesoPersonalizadoContainer}>
                          <ThemedView style={styles.procesoPersonalizadoInputRow}>
                            <TextInput
                              style={[styles.input, styles.procesoNombreInput]}
                              value={proceso.nombre}
                              onChangeText={(text) => updateProcesoNombre(index, procesoIndex, text)}
                              placeholder="Nombre del proceso"
                              placeholderTextColor="#999"
                            />
                            <TouchableOpacity
                              style={styles.procesoCheckboxContainer}
                              onPress={() => toggleProcesoAfectado(index, procesoIndex)}
                            >
                              <View style={[styles.checkbox, proceso.afectado && styles.checkboxChecked]}>
                                {proceso.afectado && (
                                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                                )}
                              </View>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.removeProcesoButton}
                              onPress={() => removeProcesoPersonalizado(index, procesoIndex)}
                            >
                              <Ionicons name="trash" size={18} color="#F44336" />
                            </TouchableOpacity>
                          </ThemedView>
                        </ThemedView>
                      )}
                    </ThemedView>
                  );
                })}
              </ThemedView>
              <TouchableOpacity
                style={styles.addProcesoButton}
                onPress={() => addProcesoPersonalizado(index)}
              >
                <Ionicons name="add" size={18} color="#007AFF" />
                <ThemedText style={styles.addProcesoButtonText}>Agregar Proceso Personalizado</ThemedText>
              </TouchableOpacity>
            </ThemedView>

            {/* Análisis de Impacto */}
            <ThemedView style={styles.formSection}>
              <ThemedText style={styles.label}>Análisis de Impacto al Sistema de Gestión</ThemedText>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={actividad.analisis_impacto}
                onChangeText={(text) => updateActividad(index, 'analisis_impacto', text)}
                placeholder="Ingrese el análisis de impacto"
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
              />
            </ThemedView>

            {/* Documentos requeridos */}
            <ThemedView style={styles.formSection}>
              <ThemedText style={styles.label}>Documento(s) requerido(s) (que se ven afectados)</ThemedText>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={actividad.documentos_requeridos}
                onChangeText={(text) => updateActividad(index, 'documentos_requeridos', text)}
                placeholder="Ingrese los documentos requeridos"
                placeholderTextColor="#999"
                multiline
                numberOfLines={3}
              />
            </ThemedView>

            {/* Recursos necesarios */}
            <ThemedView style={styles.formSection}>
              <ThemedText style={styles.label}>Recurso(s) necesario(s)</ThemedText>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={actividad.recursos_necesarios}
                onChangeText={(text) => updateActividad(index, 'recursos_necesarios', text)}
                placeholder="Ingrese los recursos necesarios"
                placeholderTextColor="#999"
                multiline
                numberOfLines={3}
              />
            </ThemedView>

            {/* Reasignación de responsabilidades */}
            <ThemedView style={styles.formSection}>
              <ThemedText style={styles.label}>
                Implica asignación o reasignación de responsabilidades y autoridades (descríbalas)
              </ThemedText>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={actividad.reasignacion_responsabilidades}
                onChangeText={(text) => updateActividad(index, 'reasignacion_responsabilidades', text)}
                placeholder="Describa las responsabilidades y autoridades"
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
              />
            </ThemedView>

            {/* Responsables */}
            <ThemedView style={styles.formSection}>
              <ThemedText style={styles.label}>Responsable(s)</ThemedText>
              <TextInput
                style={styles.input}
                value={actividad.responsables}
                onChangeText={(text) => updateActividad(index, 'responsables', text)}
                placeholder="Ingrese los responsables"
                placeholderTextColor="#999"
              />
            </ThemedView>

            {/* Fecha límite */}
            <ThemedView style={styles.formSection}>
              <ThemedText style={styles.label}>Fecha límite</ThemedText>
              <TouchableOpacity
                style={styles.dateInputButton}
                onPress={() => {
                  const currentDate = fechaActividadDates[index] || (actividad.fecha_limite ? new Date(actividad.fecha_limite) : new Date());
                  setFechaActividadDates({ ...fechaActividadDates, [index]: currentDate });
                  setShowFechaActividadPicker({ index, visible: true });
                }}
              >
                <TextInput
                  style={styles.input}
                  value={actividad.fecha_limite ? new Date(actividad.fecha_limite).toLocaleDateString('es-ES') : ''}
                  placeholder="Seleccione la fecha límite"
                  placeholderTextColor="#999"
                  editable={false}
                />
                <Ionicons name="calendar-outline" size={24} color="#007AFF" style={styles.dateIcon} />
              </TouchableOpacity>
              {showFechaActividadPicker.visible && showFechaActividadPicker.index === index && (
                <DateTimePicker
                  value={fechaActividadDates[index] || new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, selectedDate) => {
                    setShowFechaActividadPicker({ index: -1, visible: false });
                    if (selectedDate) {
                      setFechaActividadDates({ ...fechaActividadDates, [index]: selectedDate });
                      const formattedDate = selectedDate.toISOString();
                      updateActividad(index, 'fecha_limite', formattedDate);
                    }
                  }}
                />
              )}
            </ThemedView>

            {/* Observaciones */}
            <ThemedView style={styles.formSection}>
              <ThemedText style={styles.label}>Observaciones</ThemedText>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={actividad.observaciones}
                onChangeText={(text) => updateActividad(index, 'observaciones', text)}
                placeholder="Ingrese las observaciones"
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
    if (!isCreating && !editingPlanning) return null;

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
          {isCreating ? 'Nueva Planificación de Cambios del SGC' : 'Editar Planificación de Cambios del SGC'}
        </ThemedText>

        <ScrollView 
          style={styles.formScrollView} 
          contentContainerStyle={styles.formScrollViewContent}
          showsVerticalScrollIndicator={true}
          nestedScrollEnabled={true}
        >
          {/* Título */}
          <ThemedView style={styles.titleSection}>
            <ThemedText style={styles.mainTitle}>PLANIFICACIÓN DE CAMBIOS DEL SISTEMA DE GESTIÓN DE CALIDAD</ThemedText>
          </ThemedView>

          {/* Identificación del Cambio/Proyecto */}
          <ThemedView style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Identificación del Cambio/Proyecto y Consecuencias</ThemedText>
            
            {/* Nombre del Cambio/Proyecto */}
            <ThemedView style={styles.formSection}>
              <ThemedText style={styles.label}>Nombre del Cambio/Proyecto</ThemedText>
              <TextInput
                style={styles.input}
                value={datosCambio.nombre_cambio}
                onChangeText={(text) => setDatosCambio({ ...datosCambio, nombre_cambio: text })}
                placeholder="Ingrese el nombre del cambio/proyecto"
                placeholderTextColor="#999"
              />
            </ThemedView>

            {/* Propósito del Cambio/Proyecto */}
            <ThemedView style={styles.formSection}>
              <ThemedText style={styles.label}>Propósito del Cambio/Proyecto</ThemedText>
              <TextInput
                style={styles.input}
                value={datosCambio.proposito_cambio}
                onChangeText={(text) => setDatosCambio({ ...datosCambio, proposito_cambio: text })}
                placeholder="Ingrese el propósito del cambio/proyecto"
                placeholderTextColor="#999"
              />
            </ThemedView>

            {/* Consecuencias Positivas */}
            <ThemedView style={styles.formSection}>
              <ThemedText style={styles.label}>Consecuencias Potenciales Positivas</ThemedText>
              <ThemedText style={styles.subLabel}>Descripción:</ThemedText>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={datosCambio.consecuencias_positivas}
                onChangeText={(text) => setDatosCambio({ ...datosCambio, consecuencias_positivas: text })}
                placeholder="Describa las consecuencias positivas"
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
              />
            </ThemedView>

            {/* Consecuencias Adversas */}
            <ThemedView style={styles.formSection}>
              <ThemedText style={styles.label}>Consecuencias Potenciales Adversas</ThemedText>
              <ThemedText style={styles.subLabel}>Descripción:</ThemedText>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={datosCambio.consecuencias_adversas}
                onChangeText={(text) => setDatosCambio({ ...datosCambio, consecuencias_adversas: text })}
                placeholder="Describa las consecuencias adversas"
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
              />
            </ThemedView>

            {/* Acciones para mitigar */}
            <ThemedView style={styles.formSection}>
              <ThemedText style={styles.label}>Acciones para mitigar efecto adverso:</ThemedText>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={datosCambio.acciones_mitigar}
                onChangeText={(text) => setDatosCambio({ ...datosCambio, acciones_mitigar: text })}
                placeholder="Describa las acciones para mitigar"
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
              />
            </ThemedView>
          </ThemedView>

          {/* Origen del Cambio e Impacto al Cliente */}
          <ThemedView style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Origen del Cambio e Impacto al Cliente</ThemedText>
            
            {/* Cambio originado por */}
            <ThemedView style={styles.formSection}>
              <ThemedText style={styles.label}>Cambio originado por:</ThemedText>
              <ThemedView style={styles.checkboxContainer}>
                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setDatosCambio({ ...datosCambio, cambio_legislacion: !datosCambio.cambio_legislacion })}
                >
                  <View style={[styles.checkbox, datosCambio.cambio_legislacion && styles.checkboxChecked]}>
                    {datosCambio.cambio_legislacion && (
                      <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                    )}
                  </View>
                  <ThemedText style={styles.checkboxLabel}>Cambio en Legislación</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setDatosCambio({ ...datosCambio, cambio_producto_servicio: !datosCambio.cambio_producto_servicio })}
                >
                  <View style={[styles.checkbox, datosCambio.cambio_producto_servicio && styles.checkboxChecked]}>
                    {datosCambio.cambio_producto_servicio && (
                      <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                    )}
                  </View>
                  <ThemedText style={styles.checkboxLabel}>Nuevo Producto o servicio, o modificación de uno existente</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setDatosCambio({ ...datosCambio, cambio_mapa_procesos: !datosCambio.cambio_mapa_procesos })}
                >
                  <View style={[styles.checkbox, datosCambio.cambio_mapa_procesos && styles.checkboxChecked]}>
                    {datosCambio.cambio_mapa_procesos && (
                      <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                    )}
                  </View>
                  <ThemedText style={styles.checkboxLabel}>Mapa de procesos</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setDatosCambio({ ...datosCambio, cambio_servicios_productos: !datosCambio.cambio_servicios_productos })}
                >
                  <View style={[styles.checkbox, datosCambio.cambio_servicios_productos && styles.checkboxChecked]}>
                    {datosCambio.cambio_servicios_productos && (
                      <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                    )}
                  </View>
                  <ThemedText style={styles.checkboxLabel}>Servicios y/o productos</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setDatosCambio({ ...datosCambio, cambio_politicas: !datosCambio.cambio_politicas })}
                >
                  <View style={[styles.checkbox, datosCambio.cambio_politicas && styles.checkboxChecked]}>
                    {datosCambio.cambio_politicas && (
                      <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                    )}
                  </View>
                  <ThemedText style={styles.checkboxLabel}>Políticas</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setDatosCambio({ ...datosCambio, cambio_otro: !datosCambio.cambio_otro })}
                >
                  <View style={[styles.checkbox, datosCambio.cambio_otro && styles.checkboxChecked]}>
                    {datosCambio.cambio_otro && (
                      <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                    )}
                  </View>
                  <ThemedText style={styles.checkboxLabel}>Otro</ThemedText>
                </TouchableOpacity>
              </ThemedView>

              {datosCambio.cambio_otro && (
                <ThemedView style={styles.formSection}>
                  <ThemedText style={styles.subLabel}>Descripción:</ThemedText>
                  <TextInput
                    style={styles.input}
                    value={datosCambio.cambio_otro_descripcion}
                    onChangeText={(text) => setDatosCambio({ ...datosCambio, cambio_otro_descripcion: text })}
                    placeholder="Describa el otro origen del cambio"
                    placeholderTextColor="#999"
                  />
                </ThemedView>
              )}
            </ThemedView>

            {/* Cambio afecta al cliente */}
            <ThemedView style={styles.formSection}>
              <ThemedView style={styles.twoColumnContainer}>
                <ThemedView style={styles.column}>
                  <ThemedText style={styles.label}>Cambio afecta al cliente</ThemedText>
                  <ThemedView style={styles.radioContainer}>
                    <TouchableOpacity
                      style={styles.radioRow}
                      onPress={() => setDatosCambio({ ...datosCambio, cambio_afecta_cliente: 'SI' })}
                    >
                      <View style={[styles.radio, datosCambio.cambio_afecta_cliente === 'SI' && styles.radioSelected]}>
                        {datosCambio.cambio_afecta_cliente === 'SI' && (
                          <View style={styles.radioInner} />
                        )}
                      </View>
                      <ThemedText style={styles.radioLabel}>SI</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.radioRow}
                      onPress={() => setDatosCambio({ ...datosCambio, cambio_afecta_cliente: 'NO' })}
                    >
                      <View style={[styles.radio, datosCambio.cambio_afecta_cliente === 'NO' && styles.radioSelected]}>
                        {datosCambio.cambio_afecta_cliente === 'NO' && (
                          <View style={styles.radioInner} />
                        )}
                      </View>
                      <ThemedText style={styles.radioLabel}>NO</ThemedText>
                    </TouchableOpacity>
                  </ThemedView>
                  {datosCambio.cambio_afecta_cliente === 'SI' && (
                    <ThemedText style={styles.noteText}>
                      En caso de afectar al cliente se definirán acciones de comunicación
                    </ThemedText>
                  )}
                </ThemedView>
              </ThemedView>
            </ThemedView>

            {/* Necesidad de control */}
            <ThemedView style={styles.formSection}>
              <ThemedText style={styles.label}>
                Necesidad de control administrativo, operativo y de gastos de la compañía
              </ThemedText>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={datosCambio.necesidad_control}
                onChangeText={(text) => setDatosCambio({ ...datosCambio, necesidad_control: text })}
                placeholder="Describa la necesidad de control"
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
              />
            </ThemedView>
          </ThemedView>

          {/* Planificación Detallada de Actividades */}
          <ThemedView style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Planificación Detallada de Actividades y Análisis de Impacto</ThemedText>
            
            <ThemedView style={styles.actividadesHeader}>
              <ThemedText style={styles.actividadesTitle}>Actividades</ThemedText>
              <TouchableOpacity style={styles.addActividadButton} onPress={addActividad}>
                <Ionicons name="add" size={20} color="#FFFFFF" />
                <ThemedText style={styles.addActividadButtonText}>Agregar Actividad</ThemedText>
              </TouchableOpacity>
            </ThemedView>
            {actividades.map((actividad, index) => renderActividad(actividad, index))}
          </ThemedView>

          {/* Sección de Aprobación */}
          <ThemedView style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Aprobación</ThemedText>
            
            {/* Aprobado por */}
            <ThemedView style={styles.formSection}>
              <ThemedText style={styles.label}>Aprobado por:</ThemedText>
              <TextInput
                style={styles.input}
                value={aprobadoPor}
                onChangeText={setAprobadoPor}
                placeholder="Ingrese el nombre de quien aprueba"
                placeholderTextColor="#999"
              />
            </ThemedView>

            {/* Firma Representante de la Dirección */}
            <ThemedView style={styles.formSection}>
              <ThemedText style={styles.label}>Firma Representante de la Dirección:</ThemedText>
              {!firmaRepresentante ? (
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
                    source={{ uri: formatSignatureForDisplay(firmaRepresentante) || '' }}
                    style={styles.signaturePreview}
                  />
                  <TouchableOpacity
                    style={styles.clearSignatureButton}
                    onPress={() => setFirmaRepresentante(null)}
                  >
                    <Ionicons name="trash" size={16} color="#FF3B30" />
                    <ThemedText style={styles.clearSignatureButtonText}>Eliminar Firma</ThemedText>
                  </TouchableOpacity>
                </ThemedView>
              )}
            </ThemedView>

            {/* Fecha de aprobación */}
            <ThemedView style={styles.formSection}>
              <ThemedText style={styles.label}>Fecha de aprobación:</ThemedText>
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
              onPress={isCreating ? savePlanningHandler : updatePlanningHandler}
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
        title="Planificación de Cambios del SGC"
      />
      <SlideMenu
        isVisible={isMenuVisible}
        onClose={() => setIsMenuVisible(false)}
        navigation={navigation}
      />
      {isCreating || editingPlanning ? (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.formWrapper}>
          {renderForm()}
        </ScrollView>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {hasCurrentMarca && (
            <TouchableOpacity style={styles.addButton} onPress={startCreating}>
              <ThemedView style={styles.addButtonContent}>
                {getActionIcon('add')}
                <ThemedText style={styles.addButtonText}>Nueva Planificación</ThemedText>
              </ThemedView>
            </TouchableOpacity>
          )}
          {renderPlanningList()}
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 15,
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
  subLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 5,
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
  twoColumnContainer: {
    flexDirection: 'row',
    gap: 15,
  },
  column: {
    flex: 1,
  },
  checkboxContainer: {
    gap: 10,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
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
  checkboxChecked: {
    backgroundColor: '#007AFF',
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#000',
    flex: 1,
  },
  radioContainer: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 8,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  radio: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
  },
  radioSelected: {
    borderColor: '#007AFF',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#007AFF',
  },
  radioLabel: {
    fontSize: 16,
    color: '#000',
  },
  noteText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 5,
  },
  actividadesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  actividadesTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  addActividadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#007AFF',
    padding: 8,
    borderRadius: 6,
  },
  addActividadButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  actividadItem: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
  },
  actividadItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  actividadItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    flex: 1,
  },
  actividadItemHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  removeActividadButton: {
    padding: 4,
  },
  actividadItemContent: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#DDD',
  },
  procesosGrid: {
    gap: 10,
    marginTop: 10,
  },
  procesoItemContainer: {
    marginBottom: 10,
  },
  procesoCheckboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  procesoLabel: {
    fontSize: 14,
    color: '#000',
    flex: 1,
  },
  procesoPersonalizadoContainer: {
    marginTop: 5,
  },
  procesoPersonalizadoInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  procesoNombreInput: {
    flex: 1,
  },
  removeProcesoButton: {
    padding: 4,
  },
  addProcesoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    padding: 10,
    backgroundColor: '#E3F2FD',
    borderRadius: 6,
    marginTop: 10,
  },
  addProcesoButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
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

