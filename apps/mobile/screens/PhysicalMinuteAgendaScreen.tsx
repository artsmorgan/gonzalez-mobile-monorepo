import React, { useState, useCallback, useEffect, useRef } from 'react';
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
import { createPhysicalMinuteAgenda, updatePhysicalMinuteAgenda, deletePhysicalMinuteAgenda, listPhysicalMinuteAgendaByCorpo } from '@/hooks/evaluationFunctions';
import { eventBus } from '@/hooks/eventBus';

type PhysicalMinuteAgendaScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'PhysicalMinuteAgenda'>;

interface PhysicalMinuteAgenda {
  id: string;
  id_local: string;
  fecha: string | null;
  puesto: string | null;
  hora_inicio: string | null;
  hora_fin: string | null;
  elaborado_por: string | null;
  minuta_numero: string | null;
  presentes: string | null;
  observaciones: string | null;
  temas_tratados: string | null;
  notas: string | null;
  created_at: string;
  synced?: boolean;
}

interface Presente {
  nombre: string;
  cargo: string;
  firma: string;
}

interface TemaTratado {
  asunto: string;
  comentario: string;
  acuerdo: string;
}

interface EditingPhysicalMinuteAgenda {
  id: string | null;
  id_local: string;
  fecha: string;
  puesto: string;
  hora_inicio: string;
  hora_fin: string;
  elaborado_por: string;
  minuta_numero: string;
  presentes: string;
  observaciones: string;
  temas_tratados: string;
  notas: string;
}

export default function PhysicalMinuteAgendaScreen() {
  const { employee, refreshAccessToken, logout } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<PhysicalMinuteAgendaScreenNavigationProp>();

  // Data states
  const [agendas, setAgendas] = useState<PhysicalMinuteAgenda[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasCurrentMarca, setHasCurrentMarca] = useState<boolean>(false);

  // Editing state
  const [editingRecord, setEditingRecord] = useState<EditingPhysicalMinuteAgenda | null>(null);

  // Creating state
  const [isCreating, setIsCreating] = useState(false);

  // Form states
  const [fecha, setFecha] = useState('');
  const [puesto, setPuesto] = useState('');
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFin, setHoraFin] = useState('');
  const [elaboradoPor, setElaboradoPor] = useState('');
  const [minutaNumero, setMinutaNumero] = useState('');
  const [presentes, setPresentes] = useState<Presente[]>([]);
  const [observaciones, setObservaciones] = useState('');
  const [temasTratados, setTemasTratados] = useState<TemaTratado[]>([]);
  const [notas, setNotas] = useState('');

  // Date/Time picker states
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePickerInicio, setShowTimePickerInicio] = useState(false);
  const [showTimePickerFin, setShowTimePickerFin] = useState(false);

  // Signature modal states
  const [isSignatureModalVisible, setIsSignatureModalVisible] = useState(false);
  const [currentPresenteIndex, setCurrentPresenteIndex] = useState<number | null>(null);
  const signatureRef = useRef<any>(null);
  const [signatureKey, setSignatureKey] = useState(0);
  const [tempSignature, setTempSignature] = useState<string | null>(null);

  // Expanded details state
  const [expandedRecordIds, setExpandedRecordIds] = useState<string[]>([]);

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

  const formatTime = (date: Date): string => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  useFocusEffect(
    useCallback(() => {
      fetchAgendas();
    }, [])
  );

  useEffect(() => {
    const handler = () => {
      fetchAgendas();
    };

    eventBus.on('connectionRestored', handler);
    return () => {
      eventBus.off('connectionRestored', handler);
    };
  }, []);


  const fetchAgendas = async () => {
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
        const result = await listPhysicalMinuteAgendaByCorpo({
          corpo_id: corpoId,
          refreshAccessToken,
          logout,
        });

        if (result.status && result.data) {
          setAgendas(result.data as PhysicalMinuteAgenda[]);
        } else {
          setAgendas([]);
        }
      } else {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const agendasCache = cache.filter((item: any) => item.type === 'physical_minute_agenda');
          setAgendas(agendasCache);
        } else {
          setAgendas([]);
        }
      }
    } catch (err) {
      console.error('Error fetching agendas:', err);
      setError('Error al cargar las agendas minuta física');
      try {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const agendasCache = cache.filter((item: any) => item.type === 'physical_minute_agenda');
          setAgendas(agendasCache);
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
    setFecha('');
    setPuesto('');
    setHoraInicio('');
    setHoraFin('');
    setElaboradoPor('');
    setMinutaNumero('');
    setPresentes([]);
    setObservaciones('');
    setTemasTratados([]);
    setNotas('');
  };

  const cancelCreating = () => {
    setIsCreating(false);
  };

  const startEditing = (record: PhysicalMinuteAgenda) => {
    // Parse presentes and temas_tratados from JSON string to arrays
    let presentesArray: Presente[] = [];
    if (record.presentes) {
      try {
        presentesArray = JSON.parse(record.presentes);
      } catch (e) {
        console.error('Error parsing presentes:', e);
        presentesArray = [];
      }
    }

    let temasTratadosArray: TemaTratado[] = [];
    if (record.temas_tratados) {
      try {
        temasTratadosArray = JSON.parse(record.temas_tratados);
      } catch (e) {
        console.error('Error parsing temas_tratados:', e);
        temasTratadosArray = [];
      }
    }

    setEditingRecord({
      id: record.id,
      id_local: record.id_local,
      fecha: record.fecha || '',
      puesto: record.puesto || '',
      hora_inicio: record.hora_inicio || '',
      hora_fin: record.hora_fin || '',
      elaborado_por: record.elaborado_por || '',
      minuta_numero: record.minuta_numero || '',
      presentes: record.presentes || '',
      observaciones: record.observaciones || '',
      temas_tratados: record.temas_tratados || '',
      notas: record.notas || '',
    });
    setFecha(record.fecha || '');
    setPuesto(record.puesto || '');
    setHoraInicio(record.hora_inicio || '');
    setHoraFin(record.hora_fin || '');
    setElaboradoPor(record.elaborado_por || '');
    setMinutaNumero(record.minuta_numero || '');
    setPresentes(presentesArray);
    setObservaciones(record.observaciones || '');
    setTemasTratados(temasTratadosArray);
    setNotas(record.notas || '');
  };

  const cancelEditing = () => {
    setEditingRecord(null);
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setFecha(formatDate(selectedDate));
    }
  };

  const handleTimeChangeInicio = (event: any, selectedTime?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePickerInicio(false);
    }
    if (selectedTime) {
      setHoraInicio(formatTime(selectedTime));
    }
  };

  const handleTimeChangeFin = (event: any, selectedTime?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePickerFin(false);
    }
    if (selectedTime) {
      setHoraFin(formatTime(selectedTime));
    }
  };

  const openSignatureModal = (index: number) => {
    setCurrentPresenteIndex(index);
    setIsSignatureModalVisible(true);
    setTempSignature(null);
    setSignatureKey(prev => prev + 1);
  };

  const closeSignatureModal = () => {
    setIsSignatureModalVisible(false);
    setCurrentPresenteIndex(null);
    setTempSignature(null);
    setSignatureKey(prev => prev + 1);
  };

  const clearSignatureInModal = () => {
    setTempSignature(null);
    setSignatureKey(prev => prev + 1);
    if (signatureRef.current) {
      signatureRef.current.clearSignature();
    }
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

  const handleSignatureRead = (signature: string) => {
    if (signature && currentPresenteIndex !== null) {
      const newPresentes = [...presentes];
      newPresentes[currentPresenteIndex].firma = signature;
      setPresentes(newPresentes);
      setIsSignatureModalVisible(false);
      setCurrentPresenteIndex(null);
      setTempSignature(null);
    } else {
      Alert.alert('Error', 'No se pudo obtener la firma. Por favor, intente nuevamente.');
    }
  };

  const handleSignature = (signature: string) => {
    setTempSignature(signature);
  };

  const saveAgenda = async () => {
    const currentMarca = await AsyncStorage.getItem('current_marca');
    if (!currentMarca) {
      Alert.alert('Error', 'No se encontró la marca actual');
      return;
    }

    const currentMarcaData = JSON.parse(currentMarca);

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas guardar esta agenda minuta física?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const requestData = {
                marca_id: currentMarcaData.id,
                fecha: fecha.trim() || null,
                puesto: puesto.trim() || null,
                hora_inicio: horaInicio.trim() || null,
                hora_fin: horaFin.trim() || null,
                elaborado_por: elaboradoPor.trim() || null,
                minuta_numero: minutaNumero.trim() || null,
                presentes: presentes.length > 0 ? JSON.stringify(presentes) : null,
                observaciones: observaciones.trim() || null,
                temas_tratados: temasTratados.length > 0 ? JSON.stringify(temasTratados) : null,
                notas: notas.trim() || null,
              };

              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await createPhysicalMinuteAgenda({
                  requestData,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Agenda minuta física guardada correctamente');
                  cancelCreating();
                  fetchAgendas();
                } else {
                  Alert.alert('Error', result.message || 'Error al guardar la agenda minuta física');
                }
              } else {
                const localId = generateRandomId();

                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: localId,
                  action: 'create',
                  type: 'physical_minute_agenda',
                  payload: requestData,
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                const cache = cacheStr ? JSON.parse(cacheStr) : [];

                const newRecordCache: PhysicalMinuteAgenda = {
                  id: '',
                  id_local: localId,
                  fecha: fecha.trim() || null,
                  puesto: puesto.trim() || null,
                  hora_inicio: horaInicio.trim() || null,
                  hora_fin: horaFin.trim() || null,
                  elaborado_por: elaboradoPor.trim() || null,
                  minuta_numero: minutaNumero.trim() || null,
                  presentes: presentes.length > 0 ? JSON.stringify(presentes) : null,
                  observaciones: observaciones.trim() || null,
                  temas_tratados: temasTratados.length > 0 ? JSON.stringify(temasTratados) : null,
                  notas: notas.trim() || null,
                  created_at: new Date().toISOString(),
                  synced: false,
                };

                cache.push({ ...newRecordCache, type: 'physical_minute_agenda' });
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(cache));

                Alert.alert('Modo Offline', 'Agenda minuta física registrada localmente. Se sincronizará cuando haya conexión.');
                cancelCreating();
                fetchAgendas();
              }
            } catch (err) {
              console.error('Error saving agenda:', err);
              Alert.alert('Error', 'No se pudo guardar la agenda minuta física');
            }
          },
        },
      ]
    );
  };

  const updateAgendaHandler = async () => {
    if (!editingRecord) return;

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas actualizar esta agenda minuta física?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const requestData = {
                fecha: fecha.trim() || null,
                puesto: puesto.trim() || null,
                hora_inicio: horaInicio.trim() || null,
                hora_fin: horaFin.trim() || null,
                elaborado_por: elaboradoPor.trim() || null,
                minuta_numero: minutaNumero.trim() || null,
                presentes: presentes.length > 0 ? JSON.stringify(presentes) : null,
                observaciones: observaciones.trim() || null,
                temas_tratados: temasTratados.length > 0 ? JSON.stringify(temasTratados) : null,
                notas: notas.trim() || null,
              };

              const isConnected = await getConnectionStatus();
              const recordId = editingRecord.id || editingRecord.id_local;

              if (isConnected && editingRecord.id && !editingRecord.id.startsWith('local-')) {
                const result = await updatePhysicalMinuteAgenda({
                  id: editingRecord.id,
                  requestData,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Agenda minuta física actualizada correctamente');
                  cancelEditing();
                  fetchAgendas();
                } else {
                  Alert.alert('Error', result.message || 'Error al actualizar la agenda minuta física');
                }
              } else {
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: recordId,
                  action: 'update',
                  type: 'physical_minute_agenda',
                  payload: requestData,
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                if (cacheStr) {
                  const cache = JSON.parse(cacheStr);
                  const updatedCache = cache.map((item: any) => {
                    if ((item.id === recordId || item.id_local === recordId) && item.type === 'physical_minute_agenda') {
                      return {
                        ...item,
                        fecha: fecha.trim() || null,
                        puesto: puesto.trim() || null,
                        hora_inicio: horaInicio.trim() || null,
                        hora_fin: horaFin.trim() || null,
                        elaborado_por: elaboradoPor.trim() || null,
                        minuta_numero: minutaNumero.trim() || null,
                        presentes: presentes.length > 0 ? JSON.stringify(presentes) : null,
                        observaciones: observaciones.trim() || null,
                        temas_tratados: temasTratados.length > 0 ? JSON.stringify(temasTratados) : null,
                        notas: notas.trim() || null,
                      };
                    }
                    return item;
                  });
                  await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                }

                Alert.alert('Modo Offline', 'Agenda minuta física actualizada localmente. Se sincronizará cuando haya conexión.');
                cancelEditing();
                fetchAgendas();
              }
            } catch (err) {
              console.error('Error updating agenda:', err);
              Alert.alert('Error', 'No se pudo actualizar la agenda minuta física');
            }
          },
        },
      ]
    );
  };

  const deleteAgendaHandler = async (record: PhysicalMinuteAgenda) => {
    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas eliminar esta agenda minuta física?',
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
                const result = await deletePhysicalMinuteAgenda({
                  id: record.id,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Agenda minuta física eliminada correctamente');
                  fetchAgendas();
                } else {
                  Alert.alert('Error', result.message || 'Error al eliminar la agenda minuta física');
                }
              } else {
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: recordId,
                  action: 'delete',
                  type: 'physical_minute_agenda',
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

                Alert.alert('Modo Offline', 'Agenda minuta física eliminada localmente. Se sincronizará cuando haya conexión.');
                fetchAgendas();
              }
            } catch (err) {
              console.error('Error deleting agenda:', err);
              Alert.alert('Error', 'No se pudo eliminar la agenda minuta física');
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
          {isEditing ? 'Editar Agenda Minuta Física' : 'Nueva Agenda Minuta Física'}
        </ThemedText>

        {/* Fecha */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Fecha</ThemedText>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowDatePicker(true)}
          >
            <ThemedText style={styles.dateButtonText}>
              {fecha || 'Seleccionar fecha'}
            </ThemedText>
            <Ionicons name="calendar" size={20} color="#007AFF" />
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={fecha ? new Date(fecha.split('/').reverse().join('-')) : new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChange}
            />
          )}
        </ThemedView>

        {/* Puesto */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Puesto</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="Puesto"
            placeholderTextColor="#999"
            value={puesto}
            onChangeText={setPuesto}
          />
        </ThemedView>

        {/* Hora inicio */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Hora inicio</ThemedText>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowTimePickerInicio(true)}
          >
            <ThemedText style={styles.dateButtonText}>
              {horaInicio || 'Seleccionar hora'}
            </ThemedText>
            <Ionicons name="time" size={20} color="#007AFF" />
          </TouchableOpacity>
          {showTimePickerInicio && (
            <DateTimePicker
              value={horaInicio ? new Date(`2000-01-01T${horaInicio}:00`) : new Date()}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleTimeChangeInicio}
            />
          )}
        </ThemedView>

        {/* Hora Fin */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Hora Fin</ThemedText>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowTimePickerFin(true)}
          >
            <ThemedText style={styles.dateButtonText}>
              {horaFin || 'Seleccionar hora'}
            </ThemedText>
            <Ionicons name="time" size={20} color="#007AFF" />
          </TouchableOpacity>
          {showTimePickerFin && (
            <DateTimePicker
              value={horaFin ? new Date(`2000-01-01T${horaFin}:00`) : new Date()}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleTimeChangeFin}
            />
          )}
        </ThemedView>

        {/* Elaborado por */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Elaborado por</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="Elaborado por"
            placeholderTextColor="#999"
            value={elaboradoPor}
            onChangeText={setElaboradoPor}
          />
        </ThemedView>

        {/* Minuta N° */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Minuta N°</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="Minuta N°"
            placeholderTextColor="#999"
            value={minutaNumero}
            onChangeText={setMinutaNumero}
          />
        </ThemedView>

        {/* Presentes */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Presentes</ThemedText>
          {presentes.map((presente, index) => (
            <ThemedView key={index} style={styles.presenteItem}>
              <ThemedView style={styles.presenteRow}>
                <ThemedView style={styles.presenteInputContainer}>
                  <ThemedText style={styles.presenteLabel}>Nombre</ThemedText>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Nombre"
                    placeholderTextColor="#999"
                    value={presente.nombre}
                    onChangeText={(text) => {
                      const newPresentes = [...presentes];
                      newPresentes[index].nombre = text;
                      setPresentes(newPresentes);
                    }}
                  />
                </ThemedView>
                <ThemedView style={styles.presenteInputContainer}>
                  <ThemedText style={styles.presenteLabel}>Cargo que desempeña</ThemedText>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Cargo"
                    placeholderTextColor="#999"
                    value={presente.cargo}
                    onChangeText={(text) => {
                      const newPresentes = [...presentes];
                      newPresentes[index].cargo = text;
                      setPresentes(newPresentes);
                    }}
                  />
                </ThemedView>
                <TouchableOpacity
                  style={styles.removePresenteButton}
                  onPress={() => {
                    const newPresentes = presentes.filter((_, i) => i !== index);
                    setPresentes(newPresentes);
                  }}
                >
                  <Ionicons name="trash" size={20} color="#F44336" />
                </TouchableOpacity>
              </ThemedView>
              {presente.firma && (
                <ThemedView style={styles.signaturePreviewContainer}>
                  <Image
                    source={{ 
                      uri: presente.firma.startsWith('data:') 
                        ? presente.firma 
                        : `data:image/png;base64,${presente.firma}` 
                    }}
                    style={styles.signaturePreview}
                  />
                </ThemedView>
              )}
              <TouchableOpacity
                style={styles.signatureButton}
                onPress={() => openSignatureModal(index)}
              >
                <Ionicons name="create" size={20} color="#007AFF" />
                <ThemedText style={styles.signatureButtonText}>
                  {presente.firma ? 'Cambiar Firma' : 'Agregar Firma'}
                </ThemedText>
              </TouchableOpacity>
            </ThemedView>
          ))}
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              setPresentes([...presentes, { nombre: '', cargo: '', firma: '' }]);
            }}
          >
            <Ionicons name="add-circle" size={20} color="#4CAF50" />
            <ThemedText style={styles.addButtonText}>Agregar Presente</ThemedText>
          </TouchableOpacity>
        </ThemedView>

        {/* Observaciones */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Observaciones</ThemedText>
          <TextInput
            style={[styles.formInput, styles.textArea]}
            placeholder="Observaciones"
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            value={observaciones}
            onChangeText={setObservaciones}
          />
        </ThemedView>

        {/* Temas Tratados */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Temas Tratados</ThemedText>
          {temasTratados.map((tema, index) => (
            <ThemedView key={index} style={styles.temaItem}>
              <ThemedView style={styles.temaRow}>
                <ThemedView style={styles.temaInputContainer}>
                  <ThemedText style={styles.temaLabel}>Asunto</ThemedText>
                  <TextInput
                    style={[styles.formInput, styles.textArea]}
                    placeholder="Asunto"
                    placeholderTextColor="#999"
                    multiline
                    numberOfLines={2}
                    textAlignVertical="top"
                    value={tema.asunto}
                    onChangeText={(text) => {
                      const newTemas = [...temasTratados];
                      newTemas[index].asunto = text;
                      setTemasTratados(newTemas);
                    }}
                  />
                </ThemedView>
                <TouchableOpacity
                  style={styles.removeTemaButton}
                  onPress={() => {
                    const newTemas = temasTratados.filter((_, i) => i !== index);
                    setTemasTratados(newTemas);
                  }}
                >
                  <Ionicons name="trash" size={20} color="#F44336" />
                </TouchableOpacity>
              </ThemedView>
              <ThemedView style={styles.temaInputContainer}>
                <ThemedText style={styles.temaLabel}>Comentario</ThemedText>
                <TextInput
                  style={[styles.formInput, styles.textArea]}
                  placeholder="Comentario"
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={2}
                  textAlignVertical="top"
                  value={tema.comentario}
                  onChangeText={(text) => {
                    const newTemas = [...temasTratados];
                    newTemas[index].comentario = text;
                    setTemasTratados(newTemas);
                  }}
                />
              </ThemedView>
              <ThemedView style={styles.temaInputContainer}>
                <ThemedText style={styles.temaLabel}>Acuerdo</ThemedText>
                <TextInput
                  style={[styles.formInput, styles.textArea]}
                  placeholder="Acuerdo"
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={2}
                  textAlignVertical="top"
                  value={tema.acuerdo}
                  onChangeText={(text) => {
                    const newTemas = [...temasTratados];
                    newTemas[index].acuerdo = text;
                    setTemasTratados(newTemas);
                  }}
                />
              </ThemedView>
            </ThemedView>
          ))}
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              setTemasTratados([...temasTratados, { asunto: '', comentario: '', acuerdo: '' }]);
            }}
          >
            <Ionicons name="add-circle" size={20} color="#4CAF50" />
            <ThemedText style={styles.addButtonText}>Agregar Tema Tratado</ThemedText>
          </TouchableOpacity>
        </ThemedView>

        {/* Notas */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Notas</ThemedText>
          <TextInput
            style={[styles.formInput, styles.textArea]}
            placeholder="Notas"
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            value={notas}
            onChangeText={setNotas}
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
            onPress={isEditing ? updateAgendaHandler : saveAgenda}
          >
            <ThemedText style={styles.actionButtonText}>Guardar</ThemedText>
          </TouchableOpacity>
        </ThemedView>

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
  };

  const renderList = () => {
    if (isLoading) {
      return (
        <ThemedView style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#FF9500" />
          <ThemedText style={styles.loadingText}>Cargando agendas minuta física...</ThemedText>
        </ThemedView>
      );
    }

    if (error && agendas.length === 0) {
      return (
        <ThemedView style={styles.centerContainer}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        </ThemedView>
      );
    }

    if (agendas.length === 0) {
      return (
        <ThemedView style={styles.centerContainer}>
          <ThemedText style={styles.emptyText}>No hay agendas minuta física registradas</ThemedText>
        </ThemedView>
      );
    }

    return (
      <ThemedView style={styles.listContainer}>
        {agendas.map((record) => {
          const recordId = record.id || record.id_local;
          const isExpanded = expandedRecordIds.includes(recordId);
          const isOffline = !record.synced || record.id_local;

          let presentesArray: Presente[] = [];
          if (record.presentes) {
            try {
              presentesArray = JSON.parse(record.presentes);
            } catch (e) {
              presentesArray = [];
            }
          }

          let temasTratadosArray: TemaTratado[] = [];
          if (record.temas_tratados) {
            try {
              temasTratadosArray = JSON.parse(record.temas_tratados);
            } catch (e) {
              temasTratadosArray = [];
            }
          }

          return (
            <ThemedView key={recordId} style={styles.listItem}>
              <TouchableOpacity
                style={styles.listItemHeader}
                onPress={() => toggleExpanded(recordId)}
              >
                <ThemedView style={styles.listItemHeaderContent}>
                  <ThemedText style={styles.listItemTitle}>
                    {record.puesto || 'Sin puesto'} - {record.fecha || 'Sin fecha'}
                  </ThemedText>
                  <ThemedText style={styles.listItemSubtitle}>
                    Minuta N°: {record.minuta_numero || 'N/A'}
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
                    <ThemedText style={styles.detailLabel}>Fecha: </ThemedText>
                    {record.fecha || 'No especificado'}
                  </ThemedText>
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Puesto: </ThemedText>
                    {record.puesto || 'No especificado'}
                  </ThemedText>
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Hora inicio: </ThemedText>
                    {record.hora_inicio || 'No especificado'}
                  </ThemedText>
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Hora Fin: </ThemedText>
                    {record.hora_fin || 'No especificado'}
                  </ThemedText>
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Elaborado por: </ThemedText>
                    {record.elaborado_por || 'No especificado'}
                  </ThemedText>
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Minuta N°: </ThemedText>
                    {record.minuta_numero || 'No especificado'}
                  </ThemedText>

                  {presentesArray.length > 0 && (
                    <ThemedView style={styles.sectionContainer}>
                      <ThemedText style={styles.sectionTitle}>Presentes:</ThemedText>
                      {presentesArray.map((presente, index) => (
                        <ThemedView key={index} style={styles.presenteDetailItem}>
                          <ThemedText style={styles.detailText}>
                            <ThemedText style={styles.detailLabel}>Nombre: </ThemedText>
                            {presente.nombre || 'N/A'}
                          </ThemedText>
                          <ThemedText style={styles.detailText}>
                            <ThemedText style={styles.detailLabel}>Cargo: </ThemedText>
                            {presente.cargo || 'N/A'}
                          </ThemedText>
                          {presente.firma && (
                            <ThemedView style={styles.signaturePreviewContainer}>
                              <Image
                                source={{ 
                                  uri: presente.firma.startsWith('data:') 
                                    ? presente.firma 
                                    : `data:image/png;base64,${presente.firma}` 
                                }}
                                style={styles.signaturePreview}
                              />
                            </ThemedView>
                          )}
                        </ThemedView>
                      ))}
                    </ThemedView>
                  )}

                  {record.observaciones && (
                    <ThemedText style={styles.detailText}>
                      <ThemedText style={styles.detailLabel}>Observaciones: </ThemedText>
                      {record.observaciones}
                    </ThemedText>
                  )}

                  {temasTratadosArray.length > 0 && (
                    <ThemedView style={styles.sectionContainer}>
                      <ThemedText style={styles.sectionTitle}>Temas Tratados:</ThemedText>
                      {temasTratadosArray.map((tema, index) => (
                        <ThemedView key={index} style={styles.temaDetailItem}>
                          <ThemedText style={styles.detailText}>
                            <ThemedText style={styles.detailLabel}>Asunto: </ThemedText>
                            {tema.asunto || 'N/A'}
                          </ThemedText>
                          <ThemedText style={styles.detailText}>
                            <ThemedText style={styles.detailLabel}>Comentario: </ThemedText>
                            {tema.comentario || 'N/A'}
                          </ThemedText>
                          <ThemedText style={styles.detailText}>
                            <ThemedText style={styles.detailLabel}>Acuerdo: </ThemedText>
                            {tema.acuerdo || 'N/A'}
                          </ThemedText>
                        </ThemedView>
                      ))}
                    </ThemedView>
                  )}

                  {record.notas && (
                    <ThemedText style={styles.detailText}>
                      <ThemedText style={styles.detailLabel}>Notas: </ThemedText>
                      {record.notas}
                    </ThemedText>
                  )}

                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Fecha de creación: </ThemedText>
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
                      onPress={() => deleteAgendaHandler(record)}
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
      <AppHeader onMenuPress={() => setIsMenuVisible(true)} title="Agenda Minuta Física" />

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
                <ThemedText style={styles.createButtonText}>Nueva Agenda</ThemedText>
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
        currentRoute="PhysicalMinuteAgenda"
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
  presenteItem: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  presenteRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 8,
  },
  presenteInputContainer: {
    flex: 1,
  },
  presenteLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    color: '#000000',
  },
  removePresenteButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signatureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    gap: 8,
    marginTop: 8,
  },
  signatureButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  signaturePreviewContainer: {
    width: '100%',
    marginBottom: 8,
    padding: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  signaturePreview: {
    width: '100%',
    height: 100,
    borderRadius: 4,
    resizeMode: 'contain',
  },
  temaItem: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  temaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  temaInputContainer: {
    flex: 1,
    marginBottom: 8,
  },
  temaLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    color: '#000000',
  },
  removeTemaButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    gap: 8,
    marginTop: 8,
  },
  addButtonText: {
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
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#DDD',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  modalSignatureContainer: {
    width: '100%',
    height: 200,
    marginHorizontal: 20,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    alignSelf: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#DDD',
    gap: 12,
  },
  modalClearButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#FFE5E5',
    borderRadius: 8,
    gap: 8,
  },
  modalClearButtonText: {
    color: '#F44336',
    fontSize: 16,
    fontWeight: '600',
  },
  modalAcceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    gap: 8,
  },
  modalAcceptButtonText: {
    color: '#4CAF50',
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
  sectionContainer: {
    marginTop: 12,
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8,
  },
  presenteDetailItem: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  temaDetailItem: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
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

