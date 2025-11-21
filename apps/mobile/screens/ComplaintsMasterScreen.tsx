import React, { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  View,
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
import { Picker } from '@react-native-picker/picker';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import * as Network from 'expo-network';
import { createComplaintsMaster, updateComplaintsMaster, deleteComplaintsMaster, listComplaintsMasterByCorpo } from '@/hooks/evaluationFunctions';
import { eventBus } from '@/hooks/eventBus';

type ComplaintsMasterScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ComplaintsMaster'>;

interface Complaint {
  id: string;
  id_local: string;
  sociedad: string | null;
  nombre_realiza_queja: string | null;
  cliente: string | null;
  empresa_presenta_queja: string | null;
  persona_presenta_queja: string | null;
  medio_recepcion_queja: string | null;
  tipo_queja: string | null;
  ubicacion: string | null;
  nivel_queja: string | null;
  fecha_queja: string | null;
  motivo_queja: string | null;
  descripcion_queja: string | null;
  fecha_inicio: string | null;
  fecha_revision: string | null;
  resolucion_queja: string | null;
  mes_queja: string | null;
  ano_queja: string | null;
  estado: string | null;
  accion_correctiva_preventiva: string | null;
  anexo_evidencia: string | null;
  created_at: string;
  synced?: boolean;
}

interface EditingComplaint {
  id: string | null;
  id_local: string;
  sociedad: string;
  nombre_realiza_queja: string;
  cliente: string;
  empresa_presenta_queja: string;
  persona_presenta_queja: string;
  medio_recepcion_queja: string;
  tipo_queja: string;
  ubicacion: string;
  nivel_queja: string;
  fecha_queja: string;
  motivo_queja: string;
  descripcion_queja: string;
  fecha_inicio: string;
  fecha_revision: string;
  resolucion_queja: string;
  mes_queja: string;
  ano_queja: string;
  estado: string;
  accion_correctiva_preventiva: string;
  anexo_evidencia: string;
}

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const YEARS = Array.from({ length: 10 }, (_, i) => (new Date().getFullYear() - 5 + i).toString());

export default function ComplaintsMasterScreen() {
  const { employee, refreshAccessToken, logout } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<ComplaintsMasterScreenNavigationProp>();

  // Data states
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasCurrentMarca, setHasCurrentMarca] = useState<boolean>(false);

  // Editing state
  const [editingRecord, setEditingRecord] = useState<EditingComplaint | null>(null);

  // Creating state
  const [isCreating, setIsCreating] = useState(false);

  // Form states
  const [sociedad, setSociedad] = useState('');
  const [nombreRealizaQueja, setNombreRealizaQueja] = useState('');
  const [cliente, setCliente] = useState('');
  const [empresaPresentaQueja, setEmpresaPresentaQueja] = useState('');
  const [personaPresentaQueja, setPersonaPresentaQueja] = useState('');
  const [medioRecepcionQueja, setMedioRecepcionQueja] = useState('');
  const [tipoQueja, setTipoQueja] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [nivelQueja, setNivelQueja] = useState('');
  const [fechaQueja, setFechaQueja] = useState('');
  const [motivoQueja, setMotivoQueja] = useState('');
  const [descripcionQueja, setDescripcionQueja] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaRevision, setFechaRevision] = useState('');
  const [resolucionQueja, setResolucionQueja] = useState('');
  const [mesQueja, setMesQueja] = useState('');
  const [anoQueja, setAnoQueja] = useState('');
  const [estado, setEstado] = useState('');
  const [accionCorrectivaPreventiva, setAccionCorrectivaPreventiva] = useState('');
  const [anexoEvidencia, setAnexoEvidencia] = useState('');

  // Date picker states
  const [showDatePickerQueja, setShowDatePickerQueja] = useState(false);
  const [showDatePickerInicio, setShowDatePickerInicio] = useState(false);
  const [showDatePickerRevision, setShowDatePickerRevision] = useState(false);

  // Expanded details state
  const [expandedRecordIds, setExpandedRecordIds] = useState<string[]>([]);

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

  useFocusEffect(
    useCallback(() => {
      fetchComplaints();
    }, [])
  );

  useEffect(() => {
    const handler = () => {
      fetchComplaints();
    };

    eventBus.on('connectionRestored', handler);
    return () => {
      eventBus.off('connectionRestored', handler);
    };
  }, []);

  const fetchComplaints = async () => {
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
        const result = await listComplaintsMasterByCorpo({
          corpo_id: corpoId,
          refreshAccessToken,
          logout,
        });

        if (result.status && result.data) {
          setComplaints(result.data as Complaint[]);
        } else {
          setComplaints([]);
        }
      } else {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const complaintsCache = cache.filter((item: any) => item.type === 'complaints_master');
          setComplaints(complaintsCache);
        } else {
          setComplaints([]);
        }
      }
    } catch (err) {
      console.error('Error fetching complaints:', err);
      setError('Error al cargar las quejas');
      try {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const complaintsCache = cache.filter((item: any) => item.type === 'complaints_master');
          setComplaints(complaintsCache);
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
    setSociedad('');
    setNombreRealizaQueja('');
    setCliente('');
    setEmpresaPresentaQueja('');
    setPersonaPresentaQueja('');
    setMedioRecepcionQueja('');
    setTipoQueja('');
    setUbicacion('');
    setNivelQueja('');
    setFechaQueja('');
    setMotivoQueja('');
    setDescripcionQueja('');
    setFechaInicio('');
    setFechaRevision('');
    setResolucionQueja('');
    setMesQueja('');
    setAnoQueja('');
    setEstado('');
    setAccionCorrectivaPreventiva('');
    setAnexoEvidencia('');
  };

  const cancelCreating = () => {
    setIsCreating(false);
  };

  const startEditing = (record: Complaint) => {
    setEditingRecord({
      id: record.id,
      id_local: record.id_local,
      sociedad: record.sociedad || '',
      nombre_realiza_queja: record.nombre_realiza_queja || '',
      cliente: record.cliente || '',
      empresa_presenta_queja: record.empresa_presenta_queja || '',
      persona_presenta_queja: record.persona_presenta_queja || '',
      medio_recepcion_queja: record.medio_recepcion_queja || '',
      tipo_queja: record.tipo_queja || '',
      ubicacion: record.ubicacion || '',
      nivel_queja: record.nivel_queja || '',
      fecha_queja: record.fecha_queja || '',
      motivo_queja: record.motivo_queja || '',
      descripcion_queja: record.descripcion_queja || '',
      fecha_inicio: record.fecha_inicio || '',
      fecha_revision: record.fecha_revision || '',
      resolucion_queja: record.resolucion_queja || '',
      mes_queja: record.mes_queja || '',
      ano_queja: record.ano_queja || '',
      estado: record.estado || '',
      accion_correctiva_preventiva: record.accion_correctiva_preventiva || '',
      anexo_evidencia: record.anexo_evidencia || '',
    });
    setSociedad(record.sociedad || '');
    setNombreRealizaQueja(record.nombre_realiza_queja || '');
    setCliente(record.cliente || '');
    setEmpresaPresentaQueja(record.empresa_presenta_queja || '');
    setPersonaPresentaQueja(record.persona_presenta_queja || '');
    setMedioRecepcionQueja(record.medio_recepcion_queja || '');
    setTipoQueja(record.tipo_queja || '');
    setUbicacion(record.ubicacion || '');
    setNivelQueja(record.nivel_queja || '');
    setFechaQueja(record.fecha_queja || '');
    setMotivoQueja(record.motivo_queja || '');
    setDescripcionQueja(record.descripcion_queja || '');
    setFechaInicio(record.fecha_inicio || '');
    setFechaRevision(record.fecha_revision || '');
    setResolucionQueja(record.resolucion_queja || '');
    setMesQueja(record.mes_queja || '');
    setAnoQueja(record.ano_queja || '');
    setEstado(record.estado || '');
    setAccionCorrectivaPreventiva(record.accion_correctiva_preventiva || '');
    setAnexoEvidencia(record.anexo_evidencia || '');
  };

  const cancelEditing = () => {
    setEditingRecord(null);
  };

  const handleDateChangeQueja = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePickerQueja(false);
    }
    if (selectedDate) {
      setFechaQueja(formatDate(selectedDate));
    }
  };

  const handleDateChangeInicio = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePickerInicio(false);
    }
    if (selectedDate) {
      setFechaInicio(formatDate(selectedDate));
    }
  };

  const handleDateChangeRevision = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePickerRevision(false);
    }
    if (selectedDate) {
      setFechaRevision(formatDate(selectedDate));
    }
  };

  const saveComplaint = async () => {
    const currentMarca = await AsyncStorage.getItem('current_marca');
    if (!currentMarca) {
      Alert.alert('Error', 'No se encontró la marca actual');
      return;
    }

    const currentMarcaData = JSON.parse(currentMarca);

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas guardar esta queja?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const requestData = {
                marca_id: currentMarcaData.id,
                sociedad: sociedad.trim() || null,
                nombre_realiza_queja: nombreRealizaQueja.trim() || null,
                cliente: cliente.trim() || null,
                empresa_presenta_queja: empresaPresentaQueja.trim() || null,
                persona_presenta_queja: personaPresentaQueja.trim() || null,
                medio_recepcion_queja: medioRecepcionQueja.trim() || null,
                tipo_queja: tipoQueja.trim() || null,
                ubicacion: ubicacion.trim() || null,
                nivel_queja: nivelQueja.trim() || null,
                fecha_queja: fechaQueja.trim() || null,
                motivo_queja: motivoQueja.trim() || null,
                descripcion_queja: descripcionQueja.trim() || null,
                fecha_inicio: fechaInicio.trim() || null,
                fecha_revision: fechaRevision.trim() || null,
                resolucion_queja: resolucionQueja.trim() || null,
                mes_queja: mesQueja.trim() || null,
                ano_queja: anoQueja.trim() || null,
                estado: estado.trim() || null,
                accion_correctiva_preventiva: accionCorrectivaPreventiva.trim() || null,
                anexo_evidencia: anexoEvidencia.trim() || null,
              };

              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await createComplaintsMaster({
                  requestData,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Queja guardada correctamente');
                  cancelCreating();
                  fetchComplaints();
                } else {
                  Alert.alert('Error', result.message || 'Error al guardar la queja');
                }
              } else {
                const localId = generateRandomId();

                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: localId,
                  action: 'create',
                  type: 'complaints_master',
                  payload: requestData,
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                const cache = cacheStr ? JSON.parse(cacheStr) : [];

                const newRecordCache: Complaint = {
                  id: '',
                  id_local: localId,
                  sociedad: sociedad.trim() || null,
                  nombre_realiza_queja: nombreRealizaQueja.trim() || null,
                  cliente: cliente.trim() || null,
                  empresa_presenta_queja: empresaPresentaQueja.trim() || null,
                  persona_presenta_queja: personaPresentaQueja.trim() || null,
                  medio_recepcion_queja: medioRecepcionQueja.trim() || null,
                  tipo_queja: tipoQueja.trim() || null,
                  ubicacion: ubicacion.trim() || null,
                  nivel_queja: nivelQueja.trim() || null,
                  fecha_queja: fechaQueja.trim() || null,
                  motivo_queja: motivoQueja.trim() || null,
                  descripcion_queja: descripcionQueja.trim() || null,
                  fecha_inicio: fechaInicio.trim() || null,
                  fecha_revision: fechaRevision.trim() || null,
                  resolucion_queja: resolucionQueja.trim() || null,
                  mes_queja: mesQueja.trim() || null,
                  ano_queja: anoQueja.trim() || null,
                  estado: estado.trim() || null,
                  accion_correctiva_preventiva: accionCorrectivaPreventiva.trim() || null,
                  anexo_evidencia: anexoEvidencia.trim() || null,
                  created_at: new Date().toISOString(),
                  synced: false,
                };

                cache.push({ ...newRecordCache, type: 'complaints_master' });
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(cache));

                Alert.alert('Modo Offline', 'Queja registrada localmente. Se sincronizará cuando haya conexión.');
                cancelCreating();
                fetchComplaints();
              }
            } catch (err) {
              console.error('Error saving complaint:', err);
              Alert.alert('Error', 'No se pudo guardar la queja');
            }
          },
        },
      ]
    );
  };

  const updateComplaintHandler = async () => {
    if (!editingRecord) return;

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas actualizar esta queja?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const requestData = {
                sociedad: sociedad.trim() || null,
                nombre_realiza_queja: nombreRealizaQueja.trim() || null,
                cliente: cliente.trim() || null,
                empresa_presenta_queja: empresaPresentaQueja.trim() || null,
                persona_presenta_queja: personaPresentaQueja.trim() || null,
                medio_recepcion_queja: medioRecepcionQueja.trim() || null,
                tipo_queja: tipoQueja.trim() || null,
                ubicacion: ubicacion.trim() || null,
                nivel_queja: nivelQueja.trim() || null,
                fecha_queja: fechaQueja.trim() || null,
                motivo_queja: motivoQueja.trim() || null,
                descripcion_queja: descripcionQueja.trim() || null,
                fecha_inicio: fechaInicio.trim() || null,
                fecha_revision: fechaRevision.trim() || null,
                resolucion_queja: resolucionQueja.trim() || null,
                mes_queja: mesQueja.trim() || null,
                ano_queja: anoQueja.trim() || null,
                estado: estado.trim() || null,
                accion_correctiva_preventiva: accionCorrectivaPreventiva.trim() || null,
                anexo_evidencia: anexoEvidencia.trim() || null,
              };

              const isConnected = await getConnectionStatus();
              const recordId = editingRecord.id || editingRecord.id_local;

              if (isConnected && editingRecord.id && !editingRecord.id.startsWith('local-')) {
                const result = await updateComplaintsMaster({
                  id: editingRecord.id,
                  requestData,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Queja actualizada correctamente');
                  cancelEditing();
                  fetchComplaints();
                } else {
                  Alert.alert('Error', result.message || 'Error al actualizar la queja');
                }
              } else {
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: recordId,
                  action: 'update',
                  type: 'complaints_master',
                  payload: requestData,
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                if (cacheStr) {
                  const cache = JSON.parse(cacheStr);
                  const updatedCache = cache.map((item: any) => {
                    if ((item.id === recordId || item.id_local === recordId) && item.type === 'complaints_master') {
                      return {
                        ...item,
                        sociedad: sociedad.trim() || null,
                        nombre_realiza_queja: nombreRealizaQueja.trim() || null,
                        cliente: cliente.trim() || null,
                        empresa_presenta_queja: empresaPresentaQueja.trim() || null,
                        persona_presenta_queja: personaPresentaQueja.trim() || null,
                        medio_recepcion_queja: medioRecepcionQueja.trim() || null,
                        tipo_queja: tipoQueja.trim() || null,
                        ubicacion: ubicacion.trim() || null,
                        nivel_queja: nivelQueja.trim() || null,
                        fecha_queja: fechaQueja.trim() || null,
                        motivo_queja: motivoQueja.trim() || null,
                        descripcion_queja: descripcionQueja.trim() || null,
                        fecha_inicio: fechaInicio.trim() || null,
                        fecha_revision: fechaRevision.trim() || null,
                        resolucion_queja: resolucionQueja.trim() || null,
                        mes_queja: mesQueja.trim() || null,
                        ano_queja: anoQueja.trim() || null,
                        estado: estado.trim() || null,
                        accion_correctiva_preventiva: accionCorrectivaPreventiva.trim() || null,
                        anexo_evidencia: anexoEvidencia.trim() || null,
                      };
                    }
                    return item;
                  });
                  await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                }

                Alert.alert('Modo Offline', 'Queja actualizada localmente. Se sincronizará cuando haya conexión.');
                cancelEditing();
                fetchComplaints();
              }
            } catch (err) {
              console.error('Error updating complaint:', err);
              Alert.alert('Error', 'No se pudo actualizar la queja');
            }
          },
        },
      ]
    );
  };

  const deleteComplaintHandler = async (record: Complaint) => {
    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas eliminar esta queja?',
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
                const result = await deleteComplaintsMaster({
                  id: record.id,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Queja eliminada correctamente');
                  fetchComplaints();
                } else {
                  Alert.alert('Error', result.message || 'Error al eliminar la queja');
                }
              } else {
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: recordId,
                  action: 'delete',
                  type: 'complaints_master',
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

                Alert.alert('Modo Offline', 'Queja eliminada localmente. Se sincronizará cuando haya conexión.');
                fetchComplaints();
              }
            } catch (err) {
              console.error('Error deleting complaint:', err);
              Alert.alert('Error', 'No se pudo eliminar la queja');
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
          {isEditing ? 'Editar Queja' : 'Nueva Queja'}
        </ThemedText>

        {/* Sociedad */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Sociedad</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="Sociedad"
            placeholderTextColor="#999"
            value={sociedad}
            onChangeText={setSociedad}
          />
        </ThemedView>

        {/* Nombre de quien realiza la queja */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Nombre de quien realiza la queja</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="Nombre completo"
            placeholderTextColor="#999"
            value={nombreRealizaQueja}
            onChangeText={setNombreRealizaQueja}
          />
        </ThemedView>

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

        {/* Empresa que presenta queja */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Empresa que presenta queja</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="Empresa que presenta queja"
            placeholderTextColor="#999"
            value={empresaPresentaQueja}
            onChangeText={setEmpresaPresentaQueja}
          />
        </ThemedView>

        {/* Persona que presenta queja */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Persona que presenta queja</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="Persona que presenta queja"
            placeholderTextColor="#999"
            value={personaPresentaQueja}
            onChangeText={setPersonaPresentaQueja}
          />
        </ThemedView>

        {/* Medio Recepcion Queja */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Medio Recepcion Queja</ThemedText>
          <ThemedView style={styles.pickerContainer}>
            <Picker
              selectedValue={medioRecepcionQueja}
              onValueChange={setMedioRecepcionQueja}
              style={styles.picker}
            >
              <Picker.Item label="Seleccionar" value="" />
              <Picker.Item label="Correo" value="Correo" />
              <Picker.Item label="Teléfono" value="Telefono" />
              <Picker.Item label="Presencial" value="Presencial" />
              <Picker.Item label="Otro" value="Otro" />
            </Picker>
          </ThemedView>
        </ThemedView>

        {/* Tipo de queja */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Tipo de queja</ThemedText>
          <ThemedView style={styles.pickerContainer}>
            <Picker
              selectedValue={tipoQueja}
              onValueChange={setTipoQueja}
              style={styles.picker}
            >
              <Picker.Item label="Seleccionar" value="" />
              <Picker.Item label="Público" value="Publico" />
              <Picker.Item label="Privado" value="Privado" />
              <Picker.Item label="Interno" value="Interno" />
            </Picker>
          </ThemedView>
        </ThemedView>

        {/* Ubicacion */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Ubicacion</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="Ubicación"
            placeholderTextColor="#999"
            value={ubicacion}
            onChangeText={setUbicacion}
          />
        </ThemedView>

        {/* Nivel Queja */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Nivel Queja</ThemedText>
          <ThemedView style={styles.pickerContainer}>
            <Picker
              selectedValue={nivelQueja}
              onValueChange={setNivelQueja}
              style={styles.picker}
            >
              <Picker.Item label="Seleccionar" value="" />
              <Picker.Item label="Leve" value="Leve" />
              <Picker.Item label="Moderada" value="Moderada" />
              <Picker.Item label="Grave" value="Grave" />
            </Picker>
          </ThemedView>
        </ThemedView>

        {/* Fecha de queja */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Fecha de queja</ThemedText>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowDatePickerQueja(true)}
          >
            <ThemedText style={styles.dateButtonText}>
              {fechaQueja || 'Seleccionar fecha'}
            </ThemedText>
            <Ionicons name="calendar" size={20} color="#007AFF" />
          </TouchableOpacity>
          {showDatePickerQueja && (
            <DateTimePicker
              value={fechaQueja ? new Date(fechaQueja.split('/').reverse().join('-')) : new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChangeQueja}
            />
          )}
        </ThemedView>

        {/* Motivo de la queja */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Motivo de la queja</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="Motivo de la queja"
            placeholderTextColor="#999"
            value={motivoQueja}
            onChangeText={setMotivoQueja}
          />
        </ThemedView>

        {/* Descripcion de la queja */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Descripcion de la queja</ThemedText>
          <TextInput
            style={[styles.formInput, styles.textArea]}
            placeholder="Descripción detallada de la queja"
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            value={descripcionQueja}
            onChangeText={setDescripcionQueja}
          />
        </ThemedView>

        {/* Fecha de inicio */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Fecha de inicio</ThemedText>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowDatePickerInicio(true)}
          >
            <ThemedText style={styles.dateButtonText}>
              {fechaInicio || 'Seleccionar fecha'}
            </ThemedText>
            <Ionicons name="calendar" size={20} color="#007AFF" />
          </TouchableOpacity>
          {showDatePickerInicio && (
            <DateTimePicker
              value={fechaInicio ? new Date(fechaInicio.split('/').reverse().join('-')) : new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChangeInicio}
            />
          )}
        </ThemedView>

        {/* Fecha de revision */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Fecha de revision</ThemedText>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowDatePickerRevision(true)}
          >
            <ThemedText style={styles.dateButtonText}>
              {fechaRevision || 'Seleccionar fecha'}
            </ThemedText>
            <Ionicons name="calendar" size={20} color="#007AFF" />
          </TouchableOpacity>
          {showDatePickerRevision && (
            <DateTimePicker
              value={fechaRevision ? new Date(fechaRevision.split('/').reverse().join('-')) : new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChangeRevision}
            />
          )}
        </ThemedView>

        {/* Resolucion de la queja */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Resolucion de la queja</ThemedText>
          <TextInput
            style={[styles.formInput, styles.textArea]}
            placeholder="Resolución de la queja"
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            value={resolucionQueja}
            onChangeText={setResolucionQueja}
          />
        </ThemedView>

        {/* Mes de la Queja */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Mes de la Queja</ThemedText>
          <ThemedView style={styles.pickerContainer}>
            <Picker
              selectedValue={mesQueja}
              onValueChange={setMesQueja}
              style={styles.picker}
            >
              <Picker.Item label="Seleccionar" value="" />
              {MONTHS.map((month) => (
                <Picker.Item key={month} label={month} value={month} />
              ))}
            </Picker>
          </ThemedView>
        </ThemedView>

        {/* Año de la Queja */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Año de la Queja</ThemedText>
          <ThemedView style={styles.pickerContainer}>
            <Picker
              selectedValue={anoQueja}
              onValueChange={setAnoQueja}
              style={styles.picker}
            >
              <Picker.Item label="Seleccionar" value="" />
              {YEARS.map((year) => (
                <Picker.Item key={year} label={year} value={year} />
              ))}
            </Picker>
          </ThemedView>
        </ThemedView>

        {/* Estado */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Estado</ThemedText>
          <ThemedView style={styles.pickerContainer}>
            <Picker
              selectedValue={estado}
              onValueChange={setEstado}
              style={styles.picker}
            >
              <Picker.Item label="Seleccionar" value="" />
              <Picker.Item label="Pendiente" value="Pendiente" />
              <Picker.Item label="En proceso" value="En proceso" />
              <Picker.Item label="Cumplio" value="Cumplio" />
              <Picker.Item label="No cumplio" value="No cumplio" />
            </Picker>
          </ThemedView>
        </ThemedView>

        {/* Accion correctiva/preventiva */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Accion correctiva/preventiva (codigo de accion correctiva relacionado)</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="Código de acción correctiva"
            placeholderTextColor="#999"
            value={accionCorrectivaPreventiva}
            onChangeText={setAccionCorrectivaPreventiva}
          />
        </ThemedView>

        {/* Anexo de Adjuntar Evidencia */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Anexo de Adjuntar Evidencia</ThemedText>
          <TextInput
            style={[styles.formInput, styles.textArea]}
            placeholder="Aqui se adjuntan pdf, word, correos"
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            value={anexoEvidencia}
            onChangeText={setAnexoEvidencia}
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
            onPress={isEditing ? updateComplaintHandler : saveComplaint}
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
          <ThemedText style={styles.loadingText}>Cargando quejas...</ThemedText>
        </ThemedView>
      );
    }

    if (error && complaints.length === 0) {
      return (
        <ThemedView style={styles.centerContainer}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        </ThemedView>
      );
    }

    if (complaints.length === 0) {
      return (
        <ThemedView style={styles.centerContainer}>
          <ThemedText style={styles.emptyText}>No hay quejas registradas</ThemedText>
        </ThemedView>
      );
    }

    return (
      <ThemedView style={styles.listContainer}>
        {complaints.map((record) => {
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
                    {record.nombre_realiza_queja || 'Sin nombre'}
                  </ThemedText>
                  <ThemedText style={styles.listItemSubtitle}>
                    {record.cliente || 'Sin cliente'} - {record.tipo_queja || 'Sin tipo'}
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
                    <ThemedText style={styles.detailLabel}>Sociedad: </ThemedText>
                    {record.sociedad || 'No especificado'}
                  </ThemedText>
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Cliente: </ThemedText>
                    {record.cliente || 'No especificado'}
                  </ThemedText>
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Empresa que presenta queja: </ThemedText>
                    {record.empresa_presenta_queja || 'No especificado'}
                  </ThemedText>
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Persona que presenta queja: </ThemedText>
                    {record.persona_presenta_queja || 'No especificado'}
                  </ThemedText>
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Medio Recepcion Queja: </ThemedText>
                    {record.medio_recepcion_queja || 'No especificado'}
                  </ThemedText>
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Tipo de queja: </ThemedText>
                    {record.tipo_queja || 'No especificado'}
                  </ThemedText>
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Ubicacion: </ThemedText>
                    {record.ubicacion || 'No especificado'}
                  </ThemedText>
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Nivel Queja: </ThemedText>
                    {record.nivel_queja || 'No especificado'}
                  </ThemedText>
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Fecha de queja: </ThemedText>
                    {record.fecha_queja || 'No especificado'}
                  </ThemedText>
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Motivo de la queja: </ThemedText>
                    {record.motivo_queja || 'No especificado'}
                  </ThemedText>
                  {record.descripcion_queja && (
                    <ThemedText style={styles.detailText}>
                      <ThemedText style={styles.detailLabel}>Descripcion de la queja: </ThemedText>
                      {record.descripcion_queja}
                    </ThemedText>
                  )}
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Fecha de inicio: </ThemedText>
                    {record.fecha_inicio || 'No especificado'}
                  </ThemedText>
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Fecha de revision: </ThemedText>
                    {record.fecha_revision || 'No especificado'}
                  </ThemedText>
                  {record.resolucion_queja && (
                    <ThemedText style={styles.detailText}>
                      <ThemedText style={styles.detailLabel}>Resolucion de la queja: </ThemedText>
                      {record.resolucion_queja}
                    </ThemedText>
                  )}
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Mes de la Queja: </ThemedText>
                    {record.mes_queja || 'No especificado'}
                  </ThemedText>
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Año de la Queja: </ThemedText>
                    {record.ano_queja || 'No especificado'}
                  </ThemedText>
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Estado: </ThemedText>
                    {record.estado || 'No especificado'}
                  </ThemedText>
                  {record.accion_correctiva_preventiva && (
                    <ThemedText style={styles.detailText}>
                      <ThemedText style={styles.detailLabel}>Accion correctiva/preventiva: </ThemedText>
                      {record.accion_correctiva_preventiva}
                    </ThemedText>
                  )}
                  {record.anexo_evidencia && (
                    <ThemedText style={styles.detailText}>
                      <ThemedText style={styles.detailLabel}>Anexo de Evidencia: </ThemedText>
                      {record.anexo_evidencia}
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
                      onPress={() => deleteComplaintHandler(record)}
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
      <AppHeader onMenuPress={() => setIsMenuVisible(true)} title="Maestro de Quejas" />

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
                <ThemedText style={styles.createButtonText}>Nueva Queja</ThemedText>
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
        currentRoute="ComplaintsMaster"
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
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    color: '#000000',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#000000',
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

