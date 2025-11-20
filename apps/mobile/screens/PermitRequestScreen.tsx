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
  createPermitRequest,
  updatePermitRequest,
  deletePermitRequest,
  listPermitRequestByCorpo,
} from '@/hooks/evaluationFunctions';
import { eventBus } from '@/hooks/eventBus';

type PermitRequestScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'PermitRequest'>;

interface PermitRequest {
  id: string;
  id_local: string;
  persona_solicita: string | null;
  codigo: string | null;
  contrato: string | null;
  horario: string | null;
  fecha_solicitud: string | null;
  motivo_permiso: string | null;
  permiso_sustituido_por: string | null;
  codigo_sustituto: string | null;
  firma_gerente: string | null;
  firma_encargado_monitoreo: string | null;
  permiso_coordinado_por: string | null;
  created_at: string;
  synced?: boolean;
}

interface EditingPermitRequest {
  id: string | null;
  id_local: string;
  persona_solicita: string;
  codigo: string;
  contrato: string;
  horario: string;
  fecha_solicitud: string;
  motivo_permiso: string;
  permiso_sustituido_por: string;
  codigo_sustituto: string;
  firma_gerente: string;
  firma_encargado_monitoreo: string;
  permiso_coordinado_por: string;
}

export default function PermitRequestScreen() {
  const { employee, refreshAccessToken, logout } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<PermitRequestScreenNavigationProp>();

  // Data states
  const [permits, setPermits] = useState<PermitRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasCurrentMarca, setHasCurrentMarca] = useState<boolean>(false);

  // Editing state
  const [editingRecord, setEditingRecord] = useState<EditingPermitRequest | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form states
  const [personaSolicita, setPersonaSolicita] = useState('');
  const [codigo, setCodigo] = useState('');
  const [contrato, setContrato] = useState('');
  const [horario, setHorario] = useState('');
  const [fechaSolicitud, setFechaSolicitud] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [motivoPermiso, setMotivoPermiso] = useState('');
  const [permisoSustituidoPor, setPermisoSustituidoPor] = useState('');
  const [codigoSustituto, setCodigoSustituto] = useState('');
  const [firmaGerente, setFirmaGerente] = useState<string | null>(null);
  const [firmaEncargadoMonitoreo, setFirmaEncargadoMonitoreo] = useState<string | null>(null);
  const [permisoCoordinadoPor, setPermisoCoordinadoPor] = useState('');

  // Signature modal states
  const [isSignatureModalVisible, setIsSignatureModalVisible] = useState(false);
  const [currentSignatureType, setCurrentSignatureType] = useState<'gerente' | 'encargado' | null>(null);
  const signatureRef = useRef<any>(null);
  const [signatureKey, setSignatureKey] = useState(0);
  const [tempSignature, setTempSignature] = useState<string | null>(null);

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

  // Helper para extraer solo el base64 de las firmas (sin el prefijo data:)
  const getBase64Only = (signature: string | null): string | null => {
    if (!signature) return null;
    if (signature.startsWith('data:')) {
      const parts = signature.split(',');
      return parts.length > 1 ? parts[1] : signature;
    }
    return signature;
  };

  // Helper para formatear la firma para mostrar (agregar prefijo si no lo tiene)
  const formatSignatureForDisplay = (signature: string | null): string | null => {
    if (!signature) return null;
    if (signature.startsWith('data:')) {
      return signature;
    }
    return `data:image/png;base64,${signature}`;
  };

  const fetchPermits = useCallback(async () => {
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
        const result = await listPermitRequestByCorpo({
          corpo_id: corpoId,
          refreshAccessToken,
          logout,
        });

        if (result.status && result.data) {
          setPermits(result.data as PermitRequest[]);
        } else {
          setPermits([]);
        }
      } else {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const permitsCache = cache.filter((item: any) => item.type === 'permit_request');
          setPermits(permitsCache);
        } else {
          setPermits([]);
        }
      }
    } catch (err) {
      console.error('Error fetching permits:', err);
      setError('Error al cargar las solicitudes de permiso');
      try {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const permitsCache = cache.filter((item: any) => item.type === 'permit_request');
          setPermits(permitsCache);
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
      fetchPermits();
      eventBus.on('connectionRestored', fetchPermits);
      return () => {
        eventBus.off('connectionRestored', fetchPermits);
      };
    }, [fetchPermits])
  );

  const resetForm = () => {
    setPersonaSolicita('');
    setCodigo('');
    setContrato('');
    setHorario('');
    setFechaSolicitud(new Date());
    setMotivoPermiso('');
    setPermisoSustituidoPor('');
    setCodigoSustituto('');
    setFirmaGerente(null);
    setFirmaEncargadoMonitoreo(null);
    setPermisoCoordinadoPor('');
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

  const startEditing = (record: PermitRequest) => {
    setIsCreating(false);
    setEditingRecord({
      id: record.id,
      id_local: record.id_local,
      persona_solicita: record.persona_solicita || '',
      codigo: record.codigo || '',
      contrato: record.contrato || '',
      horario: record.horario || '',
      fecha_solicitud: record.fecha_solicitud || '',
      motivo_permiso: record.motivo_permiso || '',
      permiso_sustituido_por: record.permiso_sustituido_por || '',
      codigo_sustituto: record.codigo_sustituto || '',
      firma_gerente: record.firma_gerente || '',
      firma_encargado_monitoreo: record.firma_encargado_monitoreo || '',
      permiso_coordinado_por: record.permiso_coordinado_por || '',
    });

    setPersonaSolicita(record.persona_solicita || '');
    setCodigo(record.codigo || '');
    setContrato(record.contrato || '');
    setHorario(record.horario || '');
    if (record.fecha_solicitud) {
      const dateParts = record.fecha_solicitud.split('/');
      if (dateParts.length === 3) {
        setFechaSolicitud(new Date(parseInt(dateParts[2]), parseInt(dateParts[1]) - 1, parseInt(dateParts[0])));
      }
    }
    setMotivoPermiso(record.motivo_permiso || '');
    setPermisoSustituidoPor(record.permiso_sustituido_por || '');
    setCodigoSustituto(record.codigo_sustituto || '');
    // Asegurar formato correcto para las firmas
    setFirmaGerente(formatSignatureForDisplay(record.firma_gerente));
    setFirmaEncargadoMonitoreo(formatSignatureForDisplay(record.firma_encargado_monitoreo));
    
    setPermisoCoordinadoPor(record.permiso_coordinado_por || '');
  };

  const cancelEditing = () => {
    setEditingRecord(null);
    resetForm();
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setFechaSolicitud(selectedDate);
    }
  };

  const openSignatureModal = (type: 'gerente' | 'encargado') => {
    setCurrentSignatureType(type);
    setIsSignatureModalVisible(true);
    setTempSignature(null);
    setSignatureKey(prev => prev + 1);
  };

  const closeSignatureModal = () => {
    setIsSignatureModalVisible(false);
    setCurrentSignatureType(null);
    setTempSignature(null);
  };

  const clearSignatureInModal = () => {
    setTempSignature(null);
    setSignatureKey(prev => prev + 1);
    if (signatureRef.current) {
      signatureRef.current.clearSignature();
    }
  };

  const handleSignatureRead = (signature: string) => {
    if (signature && currentSignatureType) {
      // Asegurar que la firma tenga el formato correcto
      let formattedSignature = signature;
      if (!signature.startsWith('data:')) {
        // Si no tiene el prefijo, agregarlo
        formattedSignature = `data:image/png;base64,${signature}`;
      }
      
      if (currentSignatureType === 'gerente') {
        setFirmaGerente(formattedSignature);
      } else if (currentSignatureType === 'encargado') {
        setFirmaEncargadoMonitoreo(formattedSignature);
      }
      setIsSignatureModalVisible(false);
      setCurrentSignatureType(null);
      setTempSignature(null);
    } else {
      Alert.alert('Error', 'No se pudo obtener la firma. Por favor, intente nuevamente.');
    }
  };

  const handleSignature = (signature: string) => {
    setTempSignature(signature);
  };

  const acceptSignature = () => {
    if (signatureRef.current) {
      signatureRef.current.readSignature();
    } else if (tempSignature) {
      handleSignatureRead(tempSignature);
    } else {
      Alert.alert('Error', 'Debe dibujar una firma antes de aceptar');
    }
  };

  const savePermitHandler = async () => {
    const currentMarca = await AsyncStorage.getItem('current_marca');
    if (!currentMarca) {
      Alert.alert('Error', 'No se encontró la marca actual');
      return;
    }

    const currentMarcaData = JSON.parse(currentMarca);

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas guardar esta solicitud de permiso?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const requestData = {
                marca_id: currentMarcaData.id,
                persona_solicita: personaSolicita.trim() || null,
                codigo: codigo.trim() || null,
                contrato: contrato.trim() || null,
                horario: horario.trim() || null,
                fecha_solicitud: formatDate(fechaSolicitud) || null,
                motivo_permiso: motivoPermiso.trim() || null,
                permiso_sustituido_por: permisoSustituidoPor.trim() || null,
                codigo_sustituto: codigoSustituto.trim() || null,
                firma_gerente: getBase64Only(firmaGerente),
                firma_encargado_monitoreo: getBase64Only(firmaEncargadoMonitoreo),
                permiso_coordinado_por: permisoCoordinadoPor.trim() || null,
              };

              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await createPermitRequest({
                  requestData,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Solicitud de permiso guardada correctamente');
                  cancelCreating();
                  fetchPermits();
                } else {
                  Alert.alert('Error', result.message || 'Error al guardar la solicitud de permiso');
                }
              } else {
                const localId = generateRandomId();

                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: localId,
                  action: 'create',
                  type: 'permit_request',
                  payload: requestData,
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                const cache = cacheStr ? JSON.parse(cacheStr) : [];

                const newRecordCache: PermitRequest = {
                  id: '',
                  id_local: localId,
                  persona_solicita: personaSolicita.trim() || null,
                  codigo: codigo.trim() || null,
                  contrato: contrato.trim() || null,
                  horario: horario.trim() || null,
                  fecha_solicitud: formatDate(fechaSolicitud) || null,
                  motivo_permiso: motivoPermiso.trim() || null,
                  permiso_sustituido_por: permisoSustituidoPor.trim() || null,
                  codigo_sustituto: codigoSustituto.trim() || null,
                  firma_gerente: getBase64Only(firmaGerente),
                  firma_encargado_monitoreo: getBase64Only(firmaEncargadoMonitoreo),
                  permiso_coordinado_por: permisoCoordinadoPor.trim() || null,
                  created_at: new Date().toISOString(),
                  synced: false,
                };

                cache.push({ ...newRecordCache, type: 'permit_request' });
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(cache));

                Alert.alert('Modo Offline', 'Solicitud de permiso registrada localmente. Se sincronizará cuando haya conexión.');
                cancelCreating();
                fetchPermits();
              }
            } catch (err) {
              console.error('Error saving permit:', err);
              Alert.alert('Error', 'No se pudo guardar la solicitud de permiso');
            }
          },
        },
      ]
    );
  };

  const updatePermitHandler = async () => {
    if (!editingRecord) return;

    const recordId = editingRecord.id || editingRecord.id_local;
    if (!recordId) {
      Alert.alert('Error', 'ID de registro no encontrado para actualizar');
      return;
    }

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas actualizar esta solicitud de permiso?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const requestData = {
                persona_solicita: personaSolicita.trim() || null,
                codigo: codigo.trim() || null,
                contrato: contrato.trim() || null,
                horario: horario.trim() || null,
                fecha_solicitud: formatDate(fechaSolicitud) || null,
                motivo_permiso: motivoPermiso.trim() || null,
                permiso_sustituido_por: permisoSustituidoPor.trim() || null,
                codigo_sustituto: codigoSustituto.trim() || null,
                firma_gerente: getBase64Only(firmaGerente),
                firma_encargado_monitoreo: getBase64Only(firmaEncargadoMonitoreo),
                permiso_coordinado_por: permisoCoordinadoPor.trim() || null,
              };

              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await updatePermitRequest({
                  id: recordId,
                  requestData,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Solicitud de permiso actualizada correctamente');
                  cancelEditing();
                  fetchPermits();
                } else {
                  Alert.alert('Error', result.message || 'Error al actualizar la solicitud de permiso');
                }
              } else {
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: recordId,
                  action: 'update',
                  type: 'permit_request',
                  payload: requestData,
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                if (cacheStr) {
                  const cache = JSON.parse(cacheStr);
                  const updatedCache = cache.map((item: any) => {
                    if ((item.id === recordId || item.id_local === recordId) && item.type === 'permit_request') {
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

                Alert.alert('Modo Offline', 'Solicitud de permiso actualizada localmente. Se sincronizará cuando haya conexión.');
                cancelEditing();
                fetchPermits();
              }
            } catch (err) {
              console.error('Error updating permit:', err);
              Alert.alert('Error', 'No se pudo actualizar la solicitud de permiso');
            }
          },
        },
      ]
    );
  };

  const deletePermitHandler = async (record: PermitRequest) => {
    const recordId = record.id || record.id_local;
    if (!recordId) {
      Alert.alert('Error', 'ID de registro no encontrado para eliminar');
      return;
    }

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas eliminar esta solicitud de permiso?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await deletePermitRequest({
                  id: recordId,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Solicitud de permiso eliminada correctamente');
                  fetchPermits();
                } else {
                  Alert.alert('Error', result.message || 'Error al eliminar la solicitud de permiso');
                }
              } else {
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: recordId,
                  action: 'delete',
                  type: 'permit_request',
                  payload: {},
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                if (cacheStr) {
                  const cache = JSON.parse(cacheStr);
                  const updatedCache = cache.filter((item: any) => !((item.id === recordId || item.id_local === recordId) && item.type === 'permit_request'));
                  await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                }

                Alert.alert('Modo Offline', 'Solicitud de permiso marcada para eliminación localmente. Se sincronizará cuando haya conexión.');
                fetchPermits();
              }
            } catch (err) {
              console.error('Error deleting permit:', err);
              Alert.alert('Error', 'No se pudo eliminar la solicitud de permiso');
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
      case 'permit': return <Ionicons name="document-text" size={24} color='#000000' />;
      case 'add': return <Ionicons name="add" size={24} color='#FFFFFF' />;
      case 'cancel': return <Ionicons name="close" size={24} color='#FFFFFF' />;
      case 'confirm': return <Ionicons name="checkmark" size={24} color='#FFFFFF' />;
      case 'delete': return <Ionicons name="trash" size={24} color='#FFFFFF' />;
      case 'edit': return <Ionicons name="pencil" size={20} color="#FFFFFF" />;
      default: return <Ionicons name="document-text" size={24} color='#000000' />;
    }
  };

  const renderPermitList = () => {
    if (isLoading) {
      return (
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Cargando solicitudes de permiso...</ThemedText>
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

    if (permits.length === 0) {
      return (
        <ThemedView style={styles.emptyContainer}>
          <ThemedText style={styles.emptyText}>No hay solicitudes de permiso registradas.</ThemedText>
        </ThemedView>
      );
    }

    return (
      <ThemedView style={styles.listContainer}>
        {permits.map((record) => (
          <ThemedView key={record.id || record.id_local} style={styles.listItem}>
            <ThemedView style={styles.listItemHeader}>
              <ThemedView style={styles.listItemContent}>
                <ThemedText style={styles.listItemTitle}>
                  Solicitud de Permiso
                </ThemedText>
                <ThemedText style={styles.listItemSubtitle}>
                  Persona: {record.persona_solicita || 'N/A'} | Fecha: {record.fecha_solicitud || 'N/A'}
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
                  onPress={() => deletePermitHandler(record)}
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
      <AppHeader onMenuPress={handleMenuPress} title="Solicitud de Permiso" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <ThemedView style={styles.contentContainer}>
          <ThemedText type="title" style={styles.screenTitle}>
            {getActionIcon('permit')} Solicitud de Permiso
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
              {/* Persona que solicita el permiso */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Persona que solicita el permiso</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Persona que solicita el permiso"
                  placeholderTextColor="#999"
                  value={personaSolicita}
                  onChangeText={setPersonaSolicita}
                />
              </ThemedView>

              {/* Código */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Código</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Código"
                  placeholderTextColor="#999"
                  value={codigo}
                  onChangeText={setCodigo}
                />
              </ThemedView>

              {/* Contrato */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Contrato</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Contrato"
                  placeholderTextColor="#999"
                  value={contrato}
                  onChangeText={setContrato}
                />
              </ThemedView>

              {/* Horario */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Horario</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Horario"
                  placeholderTextColor="#999"
                  value={horario}
                  onChangeText={setHorario}
                />
              </ThemedView>

              {/* Fecha de solicitud del permiso */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Fecha de solicitud del permiso</ThemedText>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <ThemedText style={styles.dateButtonText}>
                    {formatDate(fechaSolicitud)}
                  </ThemedText>
                  <Ionicons name="calendar" size={20} color="#007AFF" />
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={fechaSolicitud}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleDateChange}
                  />
                )}
              </ThemedView>

              {/* Motivo del permiso */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Motivo del permiso</ThemedText>
                <TextInput
                  style={[styles.formInput, styles.textArea]}
                  placeholder="Motivo del permiso"
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  value={motivoPermiso}
                  onChangeText={setMotivoPermiso}
                />
              </ThemedView>

              {/* Permiso sustituido por */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Permiso sustituido por</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Permiso sustituido por"
                  placeholderTextColor="#999"
                  value={permisoSustituidoPor}
                  onChangeText={setPermisoSustituidoPor}
                />
              </ThemedView>

              {/* Código (sustituto) */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Código</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Código"
                  placeholderTextColor="#999"
                  value={codigoSustituto}
                  onChangeText={setCodigoSustituto}
                />
              </ThemedView>

              {/* Firma de gerente */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Firma de gerente</ThemedText>
                <TouchableOpacity
                  style={styles.signatureButton}
                  onPress={() => openSignatureModal('gerente')}
                >
                  {firmaGerente ? (
                    <ThemedView style={styles.signaturePreviewContainer}>
                      <Image
                        source={{
                          uri: formatSignatureForDisplay(firmaGerente) || ''
                        }}
                        style={styles.signaturePreview}
                      />
                    </ThemedView>
                  ) : (
                    <ThemedView style={styles.signaturePlaceholder}>
                      <Ionicons name="create-outline" size={24} color="#007AFF" />
                      <ThemedText style={styles.signaturePlaceholderText}>Toca para dibujar la firma</ThemedText>
                    </ThemedView>
                  )}
                </TouchableOpacity>
              </ThemedView>

              {/* Encargado de monitoreo */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Encargado de monitoreo</ThemedText>
                <TouchableOpacity
                  style={styles.signatureButton}
                  onPress={() => openSignatureModal('encargado')}
                >
                  {firmaEncargadoMonitoreo ? (
                    <ThemedView style={styles.signaturePreviewContainer}>
                      <Image
                        source={{
                          uri: formatSignatureForDisplay(firmaEncargadoMonitoreo) || ''
                        }}
                        style={styles.signaturePreview}
                      />
                    </ThemedView>
                  ) : (
                    <ThemedView style={styles.signaturePlaceholder}>
                      <Ionicons name="create-outline" size={24} color="#007AFF" />
                      <ThemedText style={styles.signaturePlaceholderText}>Toca para dibujar la firma</ThemedText>
                    </ThemedView>
                  )}
                </TouchableOpacity>
              </ThemedView>

              {/* Permiso coordinado por */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Permiso coordinado por</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Permiso coordinado por"
                  placeholderTextColor="#999"
                  value={permisoCoordinadoPor}
                  onChangeText={setPermisoCoordinadoPor}
                />
              </ThemedView>

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
                  onPress={editingRecord ? updatePermitHandler : savePermitHandler}
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
                <ThemedText style={styles.createButtonText}>Crear Nueva Solicitud de Permiso</ThemedText>
              </TouchableOpacity>
              {renderPermitList()}
            </ThemedView>
          )}
        </ThemedView>
      </ScrollView>

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
              <ThemedText style={styles.modalTitle}>
                {currentSignatureType === 'gerente' ? 'Firma de Gerente' : 'Encargado de Monitoreo'}
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
                onEnd={handleSignature}
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
        currentRoute="PermitRequest"
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
  textArea: {
    minHeight: 100,
    paddingTop: 12,
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
  signatureButton: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    minHeight: 150,
    backgroundColor: '#F9F9F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signaturePreviewContainer: {
    width: '100%',
    marginBottom: 10,
    padding: 10,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
  },
  signaturePreview: {
    width: '100%',
    height: 150,
    resizeMode: 'contain',
  },
  signaturePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  signaturePlaceholderText: {
    fontSize: 14,
    color: '#007AFF',
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

