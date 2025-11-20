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
  createElectricBrushGuide,
  updateElectricBrushGuide,
  deleteElectricBrushGuide,
  listElectricBrushGuideByCorpo,
} from '@/hooks/evaluationFunctions';
import { eventBus } from '@/hooks/eventBus';

type ElectricBrushGuideScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ElectricBrushGuide'>;

interface ElectricBrushGuide {
  id: string;
  id_local: string;
  miscelaneo: string | null;
  capacitador: string | null;
  cedula: string | null;
  fecha: string | null;
  firma_miscelaneo: string | null;
  firma_capacitador: string | null;
  created_at: string;
  synced?: boolean;
}

interface EditingElectricBrushGuide {
  id: string | null;
  id_local: string;
  miscelaneo: string;
  capacitador: string;
  cedula: string;
  fecha: string;
  firma_miscelaneo: string;
  firma_capacitador: string;
}

const INSTRUCCIONES = [
  "Revisar el cepillo, si esta limpio y en buenas condiciones antes de utilizarlo.",
  "Revisar el flanyer, que la corona no este quebrada ni gastada para que el cepillo no brinque y evitar un daño al cepillo.",
  "Acostar el cepillo para colocarle el flanyer.",
  "Colocar la felpa o pad.",
  "Levantar el cepillo y soltar el cable. Colocar el cable fuera del trayecto del cepillo para evitar que este se enrrolle al encenderlo.",
  "Conectar el cepillo en el conector que se ha destinado para ese fin (verifique que el toma corrientes esté en buen estado), utilizar extensión electrica si no se logra abarcar el área con el cable normal del cepillo.",
  "Colocar los rótulos preventivos en el área a cepillar antes de encender la unidad.",
  "Quitar el seguro de ajuste y colocar el mastil de acuerdo a su estatura y nuevamente colocar el seguro de ajuste.",
  "Colocarse en posición, pie derecho adelante e izquierdo atrás (Si es zurdo seria al reves) para minimizar el impacto cuando se encienda el cepillo.",
  "Verificar que no haya personas transitando cerca de donde se encuentra para evitar un accidente.",
  "Nunca se debe conectar el cepillo sin haber realizado el procedimiento anteriormente indicado ya que es posible que un cepillo este directo y pueda ocasionar un accidente.",
  "Encender el cepillo para dar inicio a la limpieza de piso.",
  "Si al encender el cepillo detecta algún desperfecto con el mismo, deténgase inmediatamente y repórtelo a su jefatura. No continue utilizando el cepillo así para evitar generar un daño mayor al equipo.",
  "Nunca deje el cepillo en medio pasillo, ni con el cable obstaculizando el paso para evitar una posible caída de los transeuntes.",
  "Si un usuario debe pasar por el área donde está haciendo uso del cepillo, apáguelo y permita que este transife, esto para evitar un accidente.",
  "Al terminar de utilizar el cepillo se debe desconectar, subir el mastil, quitar el flanyer y la felpa (pad) retirarlo del área y llevarlo al espacio donde está asignado, realizar la limpieza del cable y del cabezal antes de guardarlo.",
  "Cualquier evento, accidente o daño al cepillo debe ser reportado a su jefatura inmediatamente.",
];

const TEXTO_INTRODUCTORIO = [
  "Entiendo que el procedimiento a continuación descrito es de cumplimiento obligatorio cada vez que vaya a utilizar el cepillo.",
  "La no realización de este procedimiento será sancionable de acuerdo con el artículo 81 inciso h) del Código de Trabajo.",
  "Todo accidente relacionado al no acatamiento de este procedimiento será amonestado y considerado como falta grave.",
];

export default function ElectricBrushGuideScreen() {
  const { employee, refreshAccessToken, logout } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<ElectricBrushGuideScreenNavigationProp>();

  // Data states
  const [guides, setGuides] = useState<ElectricBrushGuide[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasCurrentMarca, setHasCurrentMarca] = useState<boolean>(false);

  // Editing state
  const [editingGuide, setEditingGuide] = useState<EditingElectricBrushGuide | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form states
  const [miscelaneo, setMiscelaneo] = useState('');
  const [capacitador, setCapacitador] = useState('');
  const [cedula, setCedula] = useState('');
  const [fecha, setFecha] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [firmaMiscelaneo, setFirmaMiscelaneo] = useState<string | null>(null);
  const [firmaCapacitador, setFirmaCapacitador] = useState<string | null>(null);

  // Signature modal states
  const [isSignatureModalVisible, setIsSignatureModalVisible] = useState(false);
  const [currentSignatureType, setCurrentSignatureType] = useState<'miscelaneo' | 'capacitador' | null>(null);
  const signatureRef = useRef<any>(null);
  const [signatureKey, setSignatureKey] = useState(0);

  const signatureWebStyle = `
    body, html {
      margin: 0;
      padding: 0;
      height: 100%;
      width: 100%;
    }
    .m-signature-pad {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      margin: 0;
      padding: 0;
      box-shadow: none;
      border: none;
      background-color: #FFFFFF;
    }
    .m-signature-pad--body {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      border: none;
      margin: 0;
      padding: 0;
    }
    .m-signature-pad--body canvas {
      width: 100% !important;
      height: 100% !important;
      touch-action: none;
    }
    .m-signature-pad--footer {
      display: none;
    }
  `;

  const getConnectionStatus = async (): Promise<boolean> => {
    const networkState = await Network.getNetworkStateAsync();
    return networkState.isConnected && networkState.isInternetReachable ? true : false;
  };

  const generateRandomId = (): string => {
    return `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const formatDate = (date: Date): string => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const getBase64Only = (signature: string | null): string | null => {
    if (!signature) return null;
    if (signature.startsWith('data:')) {
      const parts = signature.split(',');
      return parts.length > 1 ? parts[1] : signature;
    }
    return signature;
  };

  const formatSignatureForDisplay = (signature: string | null): string | null => {
    if (!signature) return null;
    if (signature.startsWith('data:')) {
      return signature;
    }
    return `data:image/png;base64,${signature}`;
  };

  const fetchGuides = useCallback(async () => {
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
        const result = await listElectricBrushGuideByCorpo({
          corpo_id: corpoId,
          refreshAccessToken,
          logout,
        });

        if (result.status && result.data) {
          setGuides(result.data as ElectricBrushGuide[]);
        } else {
          setGuides([]);
        }
      } else {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const guidesCache = cache.filter((item: any) => item.type === 'electric_brush_guide');
          setGuides(guidesCache);
        } else {
          setGuides([]);
        }
      }
    } catch (err) {
      console.error('Error fetching guides:', err);
      setError('Error al cargar las guías de uso de cepillo eléctrico');
      try {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const guidesCache = cache.filter((item: any) => item.type === 'electric_brush_guide');
          setGuides(guidesCache);
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
      fetchGuides();
      eventBus.on('connectionRestored', fetchGuides);
      return () => {
        eventBus.off('connectionRestored', fetchGuides);
      };
    }, [fetchGuides])
  );

  const resetForm = () => {
    setMiscelaneo('');
    setCapacitador('');
    setCedula('');
    setFecha(new Date());
    setFirmaMiscelaneo(null);
    setFirmaCapacitador(null);
  };

  const startCreating = () => {
    setIsCreating(true);
    setEditingGuide(null);
    resetForm();
  };

  const cancelCreating = () => {
    setIsCreating(false);
    resetForm();
  };

  const startEditing = (guide: ElectricBrushGuide) => {
    setIsCreating(false);
    setEditingGuide({
      id: guide.id,
      id_local: guide.id_local,
      miscelaneo: guide.miscelaneo || '',
      capacitador: guide.capacitador || '',
      cedula: guide.cedula || '',
      fecha: guide.fecha || '',
      firma_miscelaneo: guide.firma_miscelaneo || '',
      firma_capacitador: guide.firma_capacitador || '',
    });

    setMiscelaneo(guide.miscelaneo || '');
    setCapacitador(guide.capacitador || '');
    setCedula(guide.cedula || '');
    if (guide.fecha) {
      const dateParts = guide.fecha.split('/');
      if (dateParts.length === 3) {
        setFecha(new Date(parseInt(dateParts[2]), parseInt(dateParts[1]) - 1, parseInt(dateParts[0])));
      }
    }
    setFirmaMiscelaneo(formatSignatureForDisplay(guide.firma_miscelaneo));
    setFirmaCapacitador(formatSignatureForDisplay(guide.firma_capacitador));
  };

  const cancelEditing = () => {
    setEditingGuide(null);
    resetForm();
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setFecha(selectedDate);
    }
  };

  const openSignatureModal = (type: 'miscelaneo' | 'capacitador') => {
    setCurrentSignatureType(type);
    setIsSignatureModalVisible(true);
    setSignatureKey(prev => prev + 1);
  };

  const closeSignatureModal = () => {
    setIsSignatureModalVisible(false);
    setCurrentSignatureType(null);
  };

  const clearSignatureInModal = () => {
    setSignatureKey(prev => prev + 1);
    if (signatureRef.current) {
      signatureRef.current.clearSignature();
    }
  };

  const handleSignatureRead = (signature: string) => {
    if (signature && currentSignatureType) {
      let formattedSignature = signature;
      if (!signature.startsWith('data:')) {
        formattedSignature = `data:image/png;base64,${signature}`;
      }
      
      if (currentSignatureType === 'miscelaneo') {
        setFirmaMiscelaneo(formattedSignature);
      } else if (currentSignatureType === 'capacitador') {
        setFirmaCapacitador(formattedSignature);
      }
      setIsSignatureModalVisible(false);
      setCurrentSignatureType(null);
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

  const saveGuideHandler = async () => {
    const currentMarca = await AsyncStorage.getItem('current_marca');
    if (!currentMarca) {
      Alert.alert('Error', 'No se encontró la marca actual');
      return;
    }

    const currentMarcaData = JSON.parse(currentMarca);

    Alert.alert('Confirmar', '¿Estás seguro de que deseas guardar esta guía de uso de cepillo eléctrico?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: async () => {
          try {
            const requestData = {
              marca_id: currentMarcaData.id,
              miscelaneo: miscelaneo.trim() || null,
              capacitador: capacitador.trim() || null,
              cedula: cedula.trim() || null,
              fecha: formatDate(fecha) || null,
              firma_miscelaneo: getBase64Only(firmaMiscelaneo),
              firma_capacitador: getBase64Only(firmaCapacitador),
            };

            const isConnected = await getConnectionStatus();

            if (isConnected) {
              const result = await createElectricBrushGuide({
                requestData,
                refreshAccessToken,
                logout,
              });

              if (result.status) {
                Alert.alert('Éxito', 'Guía de uso de cepillo eléctrico guardada correctamente');
                cancelCreating();
                fetchGuides();
              } else {
                Alert.alert('Error', result.message || 'Error al guardar la guía de uso de cepillo eléctrico');
              }
            } else {
              const localId = generateRandomId();

              const actionsStr = await AsyncStorage.getItem('evaluations_actions');
              const actions = actionsStr ? JSON.parse(actionsStr) : [];
              actions.push({
                id: localId,
                action: 'create',
                type: 'electric_brush_guide',
                payload: requestData,
                synced: false,
              });
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

              const cacheStr = await AsyncStorage.getItem('evaluations_cache');
              const cache = cacheStr ? JSON.parse(cacheStr) : [];

              const newGuideCache: ElectricBrushGuide = {
                id: '',
                id_local: localId,
                miscelaneo: miscelaneo.trim() || null,
                capacitador: capacitador.trim() || null,
                cedula: cedula.trim() || null,
                fecha: formatDate(fecha) || null,
                firma_miscelaneo: getBase64Only(firmaMiscelaneo),
                firma_capacitador: getBase64Only(firmaCapacitador),
                created_at: new Date().toISOString(),
                synced: false,
              };

              cache.push({ ...newGuideCache, type: 'electric_brush_guide' });
              await AsyncStorage.setItem('evaluations_cache', JSON.stringify(cache));

              Alert.alert('Modo Offline', 'Guía de uso de cepillo eléctrico registrada localmente. Se sincronizará cuando haya conexión.');
              cancelCreating();
              fetchGuides();
            }
          } catch (err) {
            console.error('Error saving guide:', err);
            Alert.alert('Error', 'No se pudo guardar la guía de uso de cepillo eléctrico');
          }
        },
      },
    ]);
  };

  const updateGuideHandler = async () => {
    if (!editingGuide) return;

    const guideId = editingGuide.id || editingGuide.id_local;
    if (!guideId) {
      Alert.alert('Error', 'ID de guía no encontrado para actualizar');
      return;
    }

    Alert.alert('Confirmar', '¿Estás seguro de que deseas actualizar esta guía de uso de cepillo eléctrico?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: async () => {
          try {
            const requestData = {
              miscelaneo: miscelaneo.trim() || null,
              capacitador: capacitador.trim() || null,
              cedula: cedula.trim() || null,
              fecha: formatDate(fecha) || null,
              firma_miscelaneo: getBase64Only(firmaMiscelaneo),
              firma_capacitador: getBase64Only(firmaCapacitador),
            };

            const isConnected = await getConnectionStatus();

            if (isConnected) {
              const result = await updateElectricBrushGuide({
                id: guideId,
                requestData,
                refreshAccessToken,
                logout,
              });

              if (result.status) {
                Alert.alert('Éxito', 'Guía de uso de cepillo eléctrico actualizada correctamente');
                cancelEditing();
                fetchGuides();
              } else {
                Alert.alert('Error', result.message || 'Error al actualizar la guía de uso de cepillo eléctrico');
              }
            } else {
              const actionsStr = await AsyncStorage.getItem('evaluations_actions');
              const actions = actionsStr ? JSON.parse(actionsStr) : [];
              actions.push({
                id: guideId,
                action: 'update',
                type: 'electric_brush_guide',
                payload: requestData,
                synced: false,
              });
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

              const cacheStr = await AsyncStorage.getItem('evaluations_cache');
              if (cacheStr) {
                const cache = JSON.parse(cacheStr);
                const updatedCache = cache.map((item: any) => {
                  if ((item.id === guideId || item.id_local === guideId) && item.type === 'electric_brush_guide') {
                    return { ...item, ...requestData, synced: false };
                  }
                  return item;
                });
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
              }

              Alert.alert('Modo Offline', 'Guía de uso de cepillo eléctrico actualizada localmente. Se sincronizará cuando haya conexión.');
              cancelEditing();
              fetchGuides();
            }
          } catch (err) {
            console.error('Error updating guide:', err);
            Alert.alert('Error', 'No se pudo actualizar la guía de uso de cepillo eléctrico');
          }
        },
      },
    ]);
  };

  const deleteGuideHandler = async (guide: ElectricBrushGuide) => {
    const guideId = guide.id || guide.id_local;
    if (!guideId) {
      Alert.alert('Error', 'ID de guía no encontrado para eliminar');
      return;
    }

    Alert.alert('Confirmar', '¿Estás seguro de que deseas eliminar esta guía de uso de cepillo eléctrico?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: async () => {
          try {
            const isConnected = await getConnectionStatus();

            if (isConnected) {
              const result = await deleteElectricBrushGuide({
                id: guideId,
                refreshAccessToken,
                logout,
              });

              if (result.status) {
                Alert.alert('Éxito', 'Guía de uso de cepillo eléctrico eliminada correctamente');
                fetchGuides();
              } else {
                Alert.alert('Error', result.message || 'Error al eliminar la guía de uso de cepillo eléctrico');
              }
            } else {
              const actionsStr = await AsyncStorage.getItem('evaluations_actions');
              const actions = actionsStr ? JSON.parse(actionsStr) : [];
              actions.push({
                id: guideId,
                action: 'delete',
                type: 'electric_brush_guide',
                payload: {},
                synced: false,
              });
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

              const cacheStr = await AsyncStorage.getItem('evaluations_cache');
              if (cacheStr) {
                const cache = JSON.parse(cacheStr);
                const updatedCache = cache.filter((item: any) => !((item.id === guideId || item.id_local === guideId) && item.type === 'electric_brush_guide'));
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
              }

              Alert.alert('Modo Offline', 'Guía de uso de cepillo eléctrico marcada para eliminación localmente. Se sincronizará cuando haya conexión.');
              fetchGuides();
            }
          } catch (err) {
            console.error('Error deleting guide:', err);
            Alert.alert('Error', 'No se pudo eliminar la guía de uso de cepillo eléctrico');
          }
        },
      },
    ]);
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
      case 'record': return <Ionicons name="document-text" size={24} color='#000000' />;
      case 'add': return <Ionicons name="add" size={24} color='#FFFFFF' />;
      case 'cancel': return <Ionicons name="close" size={24} color='#FFFFFF' />;
      case 'confirm': return <Ionicons name="checkmark" size={24} color='#FFFFFF' />;
      case 'delete': return <Ionicons name="trash" size={24} color='#FFFFFF' />;
      case 'edit': return <Ionicons name="pencil" size={20} color="#FFFFFF" />;
      default: return <Ionicons name="document-text" size={24} color='#000000' />;
    }
  };

  const renderGuideList = () => {
    if (isLoading) {
      return (
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Cargando guías de uso de cepillo eléctrico...</ThemedText>
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

    if (guides.length === 0) {
      return (
        <ThemedView style={styles.emptyContainer}>
          <ThemedText style={styles.emptyText}>No hay guías de uso de cepillo eléctrico registradas.</ThemedText>
        </ThemedView>
      );
    }

    return (
      <ThemedView style={styles.listContainer}>
        {guides.map((guide) => (
          <ThemedView key={guide.id || guide.id_local} style={styles.listItem}>
            <ThemedView style={styles.listItemHeader}>
              <ThemedView style={styles.listItemContent}>
                <ThemedText style={styles.listItemTitle}>Guía de Uso de Cepillo Eléctrico</ThemedText>
                <ThemedText style={styles.listItemSubtitle}>
                  Fecha: {guide.fecha || 'N/A'} | Misceláneo: {guide.miscelaneo || 'N/A'} | Capacitador: {guide.capacitador || 'N/A'}
                </ThemedText>
              </ThemedView>
              <ThemedView style={styles.listItemActions}>
                {!guide.synced && (
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
                  onPress={() => startEditing(guide)}
                >
                  {getActionIcon('edit')}
                  <ThemedText style={styles.listItemButtonText}>Editar</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.listItemButton, styles.deleteButton]}
                  onPress={() => deleteGuideHandler(guide)}
                >
                  {getActionIcon('delete')}
                  <ThemedText style={styles.listItemButtonText}>Eliminar</ThemedText>
                </TouchableOpacity>
              </ThemedView>
            </ThemedView>
          </ThemedView>
        ))}
      </ThemedView>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <AppHeader onMenuPress={handleMenuPress} title="Guía de Uso de Cepillo Eléctrico" />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <ThemedView style={styles.contentContainer}>
          <ThemedText type="title" style={styles.screenTitle}>
            {getActionIcon('record')} Guía de Uso de Cepillo Eléctrico
          </ThemedText>

          {!hasCurrentMarca && (
            <ThemedView style={styles.noMarcaContainer}>
              <ThemedText style={styles.noMarcaTitle}>Marca no seleccionada</ThemedText>
              <ThemedText style={styles.noMarcaMessage}>
                No se encontró una marca seleccionada. Por favor, selecciona una marca desde el menú principal.
              </ThemedText>
            </ThemedView>
          )}

          {isCreating || editingGuide ? (
            <ThemedView style={styles.formContainer}>
              {/* Header Section */}
              <ThemedView style={styles.headerSection}>
                <ThemedView style={styles.headerRow}>
                  <ThemedView style={styles.headerField}>
                    <ThemedText style={styles.formLabel}>Misceláneo</ThemedText>
                    <TextInput
                      style={styles.formInput}
                      placeholder="Misceláneo"
                      placeholderTextColor="#999"
                      value={miscelaneo}
                      onChangeText={setMiscelaneo}
                    />
                  </ThemedView>
                  <ThemedView style={styles.headerField}>
                    <ThemedText style={styles.formLabel}>Cédula</ThemedText>
                    <TextInput
                      style={styles.formInput}
                      placeholder="Cédula"
                      placeholderTextColor="#999"
                      value={cedula}
                      onChangeText={setCedula}
                      keyboardType="numeric"
                    />
                  </ThemedView>
                </ThemedView>
                <ThemedView style={styles.headerRow}>
                  <ThemedView style={styles.headerField}>
                    <ThemedText style={styles.formLabel}>Capacitador</ThemedText>
                    <TextInput
                      style={styles.formInput}
                      placeholder="Capacitador"
                      placeholderTextColor="#999"
                      value={capacitador}
                      onChangeText={setCapacitador}
                    />
                  </ThemedView>
                  <ThemedView style={styles.headerField}>
                    <ThemedText style={styles.formLabel}>Fecha</ThemedText>
                    <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
                      <ThemedText style={styles.dateButtonText}>{formatDate(fecha)}</ThemedText>
                      <Ionicons name="calendar" size={20} color="#007AFF" />
                    </TouchableOpacity>
                    {showDatePicker && (
                      <DateTimePicker
                        value={fecha}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={handleDateChange}
                      />
                    )}
                  </ThemedView>
                </ThemedView>
              </ThemedView>

              {/* Texto Introductorio */}
              <ThemedView style={styles.introSection}>
                {TEXTO_INTRODUCTORIO.map((texto, index) => (
                  <ThemedText key={index} style={styles.introText}>
                    {texto}
                  </ThemedText>
                ))}
              </ThemedView>

              {/* Título */}
              <ThemedView style={styles.titleSection}>
                <ThemedText style={styles.titleText}>
                  Lo que debo hacer para utilizar correctamente el cepillo electrico
                </ThemedText>
              </ThemedView>

              {/* Instrucciones */}
              <ThemedView style={styles.instructionsSection}>
                {INSTRUCCIONES.map((instruccion, index) => (
                  <ThemedView key={index} style={styles.instructionItem}>
                    <ThemedText style={styles.instructionNumber}>{index + 1}.</ThemedText>
                    <ThemedText style={styles.instructionText}>{instruccion}</ThemedText>
                  </ThemedView>
                ))}
              </ThemedView>

              {/* Firmas */}
              <ThemedView style={styles.signaturesSection}>
                <ThemedView style={styles.signatureRow}>
                  <ThemedView style={styles.signatureField}>
                    <ThemedText style={styles.formLabel}>Firma Misceláneo</ThemedText>
                    {!firmaMiscelaneo ? (
                      <TouchableOpacity
                        style={styles.signatureButton}
                        onPress={() => openSignatureModal('miscelaneo')}
                      >
                        <Ionicons name="create-outline" size={24} color="#007AFF" />
                        <ThemedText style={styles.signatureButtonText}>Toca para dibujar la firma</ThemedText>
                      </TouchableOpacity>
                    ) : (
                      <ThemedView style={styles.signaturePreviewContainer}>
                        <Image
                          source={{ uri: formatSignatureForDisplay(firmaMiscelaneo) || '' }}
                          style={styles.signaturePreview}
                        />
                        <TouchableOpacity
                          style={styles.clearSignatureButton}
                          onPress={() => setFirmaMiscelaneo(null)}
                        >
                          <Ionicons name="trash" size={16} color="#FF3B30" />
                          <ThemedText style={styles.clearSignatureButtonText}>Eliminar Firma</ThemedText>
                        </TouchableOpacity>
                      </ThemedView>
                    )}
                  </ThemedView>

                  <ThemedView style={styles.signatureField}>
                    <ThemedText style={styles.formLabel}>Firma Capacitador</ThemedText>
                    {!firmaCapacitador ? (
                      <TouchableOpacity
                        style={styles.signatureButton}
                        onPress={() => openSignatureModal('capacitador')}
                      >
                        <Ionicons name="create-outline" size={24} color="#007AFF" />
                        <ThemedText style={styles.signatureButtonText}>Toca para dibujar la firma</ThemedText>
                      </TouchableOpacity>
                    ) : (
                      <ThemedView style={styles.signaturePreviewContainer}>
                        <Image
                          source={{ uri: formatSignatureForDisplay(firmaCapacitador) || '' }}
                          style={styles.signaturePreview}
                        />
                        <TouchableOpacity
                          style={styles.clearSignatureButton}
                          onPress={() => setFirmaCapacitador(null)}
                        >
                          <Ionicons name="trash" size={16} color="#FF3B30" />
                          <ThemedText style={styles.clearSignatureButtonText}>Eliminar Firma</ThemedText>
                        </TouchableOpacity>
                      </ThemedView>
                    )}
                  </ThemedView>
                </ThemedView>
              </ThemedView>

              <ThemedView style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.cancelButton]}
                  onPress={editingGuide ? cancelEditing : cancelCreating}
                >
                  {getActionIcon('cancel')}
                  <ThemedText style={styles.actionButtonText}>Cancelar</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.saveButton]}
                  onPress={editingGuide ? updateGuideHandler : saveGuideHandler}
                >
                  {getActionIcon('confirm')}
                  <ThemedText style={styles.actionButtonText}>
                    {editingGuide ? 'Actualizar' : 'Guardar'}
                  </ThemedText>
                </TouchableOpacity>
              </ThemedView>
            </ThemedView>
          ) : (
            <ThemedView style={styles.listSection}>
              <TouchableOpacity style={styles.createButton} onPress={startCreating}>
                <Ionicons name="add-circle" size={24} color="#FFFFFF" />
                <ThemedText style={styles.createButtonText}>Crear Nueva Guía de Uso de Cepillo Eléctrico</ThemedText>
              </TouchableOpacity>
              {renderGuideList()}
            </ThemedView>
          )}
        </ThemedView>
      </ScrollView>

      <Modal
        visible={isSignatureModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={closeSignatureModal}
      >
        <ThemedView style={styles.modalOverlay}>
          <ThemedView style={styles.modalContainer}>
            <ThemedView style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>
                {currentSignatureType === 'miscelaneo' ? 'Firma Misceláneo' : 'Firma Capacitador'}
              </ThemedText>
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

      <AppFooter />
      <SlideMenu
        isVisible={isMenuVisible}
        onClose={handleMenuClose}
        onHomePress={handleHomePress}
        currentRoute="ElectricBrushGuide"
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
  headerSection: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
    gap: 15,
  },
  headerField: {
    flex: 1,
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
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#F9F9F9',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#000000',
  },
  introSection: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#FFF9E6',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FFC107',
  },
  introText: {
    fontSize: 14,
    color: '#000000',
    marginBottom: 10,
    lineHeight: 20,
  },
  titleSection: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
  },
  titleText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976D2',
    textAlign: 'center',
  },
  instructionsSection: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  instructionItem: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  instructionNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    marginRight: 8,
    minWidth: 30,
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    color: '#000000',
    lineHeight: 20,
  },
  signaturesSection: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  signatureRow: {
    flexDirection: 'column',
    gap: 15,
  },
  signatureField: {
    width: '100%',
  },
  signatureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2196F3',
    gap: 8,
    minHeight: 100,
  },
  signatureButtonText: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '600',
  },
  signaturePreviewContainer: {
    padding: 10,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  signaturePreview: {
    width: '100%',
    height: 150,
    resizeMode: 'contain',
    marginBottom: 10,
  },
  clearSignatureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    backgroundColor: '#FFEBEE',
    borderRadius: 6,
    gap: 6,
  },
  clearSignatureButtonText: {
    fontSize: 12,
    color: '#FF3B30',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 500,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  modalSignatureContainer: {
    height: 300,
    width: '100%',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 12,
  },
  modalClearButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    gap: 8,
  },
  modalClearButtonText: {
    fontSize: 16,
    color: '#000000',
    fontWeight: '600',
  },
  modalAcceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    gap: 8,
  },
  modalAcceptButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

