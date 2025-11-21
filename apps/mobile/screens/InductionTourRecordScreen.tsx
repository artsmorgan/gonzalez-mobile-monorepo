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
import { Picker } from '@react-native-picker/picker';
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
  createInductionTourRecord,
  updateInductionTourRecord,
  deleteInductionTourRecord,
  listInductionTourRecordByCorpo,
} from '@/hooks/evaluationFunctions';
import { eventBus } from '@/hooks/eventBus';

type InductionTourRecordScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'InductionTourRecord'>;

interface TemaDesarrollado {
  tema: string;
  respuesta: string; // "SI", "NO", "NA"
  comentarios: string;
}

interface AspectoEspecifico {
  aspecto: string;
  respuesta: string; // "SI", "NO", "NA"
  comentarios: string;
}

interface Participante {
  nombre_completo: string;
  cedula: string;
  firma: string | null;
}

interface InductionTourRecord {
  id: string;
  id_local: string;
  fecha: string | null;
  renglon_edificio: string | null;
  supervisor_cliente: string | null;
  supervisor_corporacion: string | null;
  temas_desarrollados: string | null;
  aspectos_especificos: string | null;
  participantes: string | null;
  firma_supervisor: string | null;
  created_at: string;
  synced?: boolean;
}

interface EditingInductionTourRecord {
  id: string | null;
  id_local: string;
  fecha: string;
  renglon_edificio: string;
  supervisor_cliente: string;
  supervisor_corporacion: string;
  temas_desarrollados: TemaDesarrollado[];
  aspectos_especificos: AspectoEspecifico[];
  participantes: Participante[];
  firma_supervisor: string;
}

const TEMAS_PREDEFINIDOS = [
  "Revisión de los documentos del expediente del aspirante.",
  "Prueba de cepillo.",
  "Presentación de los Supervisores",
  "Recorrido por las gradas y puertas de emergencia.",
  "Uso correcto del uniforme y presentación personal según el contrato, documento de apoyo (AYL-PO-001-Código de Vestimenta Aseo y Limpieza)",
  "Normativas de comportamiento en el lugar de trabajo así como las penalizaciones de no cumplirlo según Disciplina progresiva",
  "Uso de los ascensores en jornada normal y en caso de emergencia.",
  "Presentación de los diferentes tipos de químicos utilizados por la empresa.",
  "Indicaciones de los diferentes horarios a seguir y tiempos de alimentación, así como indicaciones de jornada laboral en fines de semana (si aplica). (AYL-F-002-Rol de trabajo mensual)",
  "Lectura de labores diarias, semanales, quincenales y mensuales: AYL-F-035-Guía de Funciones del puesto y AYL-F-028 Registro de Tareas",
  "Uso del rótulo preventivos, consecuencias de no usarlos.",
  "Rotación de áreas o piso.",
  "Uso del celular en horas laborales.",
  "Registros de Limpieza que deben ser utilizados",
  "Check list de entrega de áreas (si aplica)",
  "Comunicación de Procedimientos: - Desinfección de Mechas - Uso de Palo de Piso - Limpiezas terminales (si aplica) - Limpiezas tipos Salidas (Si aplica) - Traslado de pacientes contaminados (si aplica) - Derrames y procedimiento de levantamiento de biopeligrosos (si aplica)",
];

const ASPECTOS_PREDEFINIDOS = [
  "Introducción a los dispositivos de alarmas y emergencia del edificio.",
  "Uso de Equipo de Protección Personal: Guantes, mascarillas, Lentes, o el que aplique.",
];

export default function InductionTourRecordScreen() {
  const { employee, refreshAccessToken, logout } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<InductionTourRecordScreenNavigationProp>();

  // Data states
  const [records, setRecords] = useState<InductionTourRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasCurrentMarca, setHasCurrentMarca] = useState<boolean>(false);

  // Editing state
  const [editingRecord, setEditingRecord] = useState<EditingInductionTourRecord | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form states
  const [fecha, setFecha] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [renglonEdificio, setRenglonEdificio] = useState('');
  const [supervisorCliente, setSupervisorCliente] = useState('');
  const [supervisorCorporacion, setSupervisorCorporacion] = useState('');
  const [temasDesarrollados, setTemasDesarrollados] = useState<TemaDesarrollado[]>([]);
  const [aspectosEspecificos, setAspectosEspecificos] = useState<AspectoEspecifico[]>([]);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [firmaSupervisor, setFirmaSupervisor] = useState<string | null>(null);

  // Expanded states
  const [expandedTemaIndices, setExpandedTemaIndices] = useState<number[]>([]);
  const [expandedAspectoIndices, setExpandedAspectoIndices] = useState<number[]>([]);
  const [expandedParticipanteIndices, setExpandedParticipanteIndices] = useState<number[]>([]);

  // Signature modal states
  const [isSignatureModalVisible, setIsSignatureModalVisible] = useState(false);
  const [currentSignatureType, setCurrentSignatureType] = useState<'supervisor' | { type: 'participante', index: number } | null>(null);
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

  // Helper para extraer solo el base64 de las firmas
  const getBase64Only = (signature: string | null): string | null => {
    if (!signature) return null;
    if (signature.startsWith('data:')) {
      const parts = signature.split(',');
      return parts.length > 1 ? parts[1] : signature;
    }
    return signature;
  };

  // Helper para formatear la firma para mostrar
  const formatSignatureForDisplay = (signature: string | null): string | null => {
    if (!signature) return null;
    if (signature.startsWith('data:')) {
      return signature;
    }
    return `data:image/png;base64,${signature}`;
  };

  const fetchRecords = useCallback(async () => {
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
        const result = await listInductionTourRecordByCorpo({
          corpo_id: corpoId,
          refreshAccessToken,
          logout,
        });

        if (result.status && result.data) {
          setRecords(result.data as InductionTourRecord[]);
        } else {
          setRecords([]);
        }
      } else {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const recordsCache = cache.filter((item: any) => item.type === 'induction_tour_record');
          setRecords(recordsCache);
        } else {
          setRecords([]);
        }
      }
    } catch (err) {
      console.error('Error fetching records:', err);
      setError('Error al cargar los registros de inducción y recorrido');
      try {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const recordsCache = cache.filter((item: any) => item.type === 'induction_tour_record');
          setRecords(recordsCache);
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
      fetchRecords();
      eventBus.on('connectionRestored', fetchRecords);
      return () => {
        eventBus.off('connectionRestored', fetchRecords);
      };
    }, [fetchRecords])
  );

  const resetForm = () => {
    setFecha(new Date());
    setRenglonEdificio('');
    setSupervisorCliente('');
    setSupervisorCorporacion('');
    // Cargar temas predefinidos
    const temasPredefinidos: TemaDesarrollado[] = TEMAS_PREDEFINIDOS.map(tema => ({
      tema: tema,
      respuesta: '',
      comentarios: '',
    }));
    setTemasDesarrollados(temasPredefinidos);
    setExpandedTemaIndices(temasPredefinidos.map((_, i) => i));
    // Cargar aspectos predefinidos
    const aspectosPredefinidos: AspectoEspecifico[] = ASPECTOS_PREDEFINIDOS.map(aspecto => ({
      aspecto: aspecto,
      respuesta: '',
      comentarios: '',
    }));
    setAspectosEspecificos(aspectosPredefinidos);
    setExpandedAspectoIndices(aspectosPredefinidos.map((_, i) => i));
    setParticipantes([]);
    setFirmaSupervisor(null);
    setExpandedParticipanteIndices([]);
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

  const startEditing = (record: InductionTourRecord) => {
    setIsCreating(false);
    let temasArray: TemaDesarrollado[] = [];
    let aspectosArray: AspectoEspecifico[] = [];
    let participantesArray: Participante[] = [];

    if (record.temas_desarrollados) {
      try {
        temasArray = JSON.parse(record.temas_desarrollados);
        if (!Array.isArray(temasArray)) temasArray = [];
      } catch (e) {
        temasArray = [];
      }
    }

    if (record.aspectos_especificos) {
      try {
        aspectosArray = JSON.parse(record.aspectos_especificos);
        if (!Array.isArray(aspectosArray)) aspectosArray = [];
      } catch (e) {
        aspectosArray = [];
      }
    }

    if (record.participantes) {
      try {
        participantesArray = JSON.parse(record.participantes);
        if (!Array.isArray(participantesArray)) participantesArray = [];
      } catch (e) {
        participantesArray = [];
      }
    }

    setEditingRecord({
      id: record.id,
      id_local: record.id_local,
      fecha: record.fecha || '',
      renglon_edificio: record.renglon_edificio || '',
      supervisor_cliente: record.supervisor_cliente || '',
      supervisor_corporacion: record.supervisor_corporacion || '',
      temas_desarrollados: temasArray,
      aspectos_especificos: aspectosArray,
      participantes: participantesArray,
      firma_supervisor: record.firma_supervisor || '',
    });

    setRenglonEdificio(record.renglon_edificio || '');
    setSupervisorCliente(record.supervisor_cliente || '');
    setSupervisorCorporacion(record.supervisor_corporacion || '');
    if (record.fecha) {
      const dateParts = record.fecha.split('/');
      if (dateParts.length === 3) {
        setFecha(new Date(parseInt(dateParts[2]), parseInt(dateParts[1]) - 1, parseInt(dateParts[0])));
      }
    }
    setTemasDesarrollados(temasArray);
    setAspectosEspecificos(aspectosArray);
    setParticipantes(participantesArray);
    setFirmaSupervisor(formatSignatureForDisplay(record.firma_supervisor));
    setExpandedTemaIndices(temasArray.map((_, i) => i));
    setExpandedAspectoIndices(aspectosArray.map((_, i) => i));
    setExpandedParticipanteIndices(participantesArray.map((_, i) => i));
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
      setFecha(selectedDate);
    }
  };

  const addTema = () => {
    const newTema: TemaDesarrollado = {
      tema: '',
      respuesta: '',
      comentarios: '',
    };
    setTemasDesarrollados([...temasDesarrollados, newTema]);
    setExpandedTemaIndices([...expandedTemaIndices, temasDesarrollados.length]);
  };

  const updateTema = (index: number, field: keyof TemaDesarrollado, value: string) => {
    const newTemas = [...temasDesarrollados];
    newTemas[index] = {
      ...newTemas[index],
      [field]: value,
    };
    setTemasDesarrollados(newTemas);
  };

  const removeTema = (index: number) => {
    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas eliminar este tema?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            setTemasDesarrollados(temasDesarrollados.filter((_, i) => i !== index));
            setExpandedTemaIndices(expandedTemaIndices.filter(i => i !== index).map(i => i > index ? i - 1 : i));
          },
        },
      ]
    );
  };

  const toggleTemaExpansion = (index: number) => {
    setExpandedTemaIndices(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const addAspecto = () => {
    const newAspecto: AspectoEspecifico = {
      aspecto: '',
      respuesta: '',
      comentarios: '',
    };
    setAspectosEspecificos([...aspectosEspecificos, newAspecto]);
    setExpandedAspectoIndices([...expandedAspectoIndices, aspectosEspecificos.length]);
  };

  const updateAspecto = (index: number, field: keyof AspectoEspecifico, value: string) => {
    const newAspectos = [...aspectosEspecificos];
    newAspectos[index] = {
      ...newAspectos[index],
      [field]: value,
    };
    setAspectosEspecificos(newAspectos);
  };

  const removeAspecto = (index: number) => {
    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas eliminar este aspecto?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            setAspectosEspecificos(aspectosEspecificos.filter((_, i) => i !== index));
            setExpandedAspectoIndices(expandedAspectoIndices.filter(i => i !== index).map(i => i > index ? i - 1 : i));
          },
        },
      ]
    );
  };

  const toggleAspectoExpansion = (index: number) => {
    setExpandedAspectoIndices(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const addParticipante = () => {
    const newParticipante: Participante = {
      nombre_completo: '',
      cedula: '',
      firma: null,
    };
    setParticipantes([...participantes, newParticipante]);
    setExpandedParticipanteIndices([...expandedParticipanteIndices, participantes.length]);
  };

  const updateParticipante = (index: number, field: keyof Participante, value: string | null) => {
    const newParticipantes = [...participantes];
    newParticipantes[index] = {
      ...newParticipantes[index],
      [field]: value,
    };
    setParticipantes(newParticipantes);
  };

  const removeParticipante = (index: number) => {
    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas eliminar este participante?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            setParticipantes(participantes.filter((_, i) => i !== index));
            setExpandedParticipanteIndices(expandedParticipanteIndices.filter(i => i !== index).map(i => i > index ? i - 1 : i));
          },
        },
      ]
    );
  };

  const toggleParticipanteExpansion = (index: number) => {
    setExpandedParticipanteIndices(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const openSignatureModal = (type: 'supervisor' | { type: 'participante', index: number }) => {
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
      
      if (currentSignatureType === 'supervisor') {
        setFirmaSupervisor(formattedSignature);
      } else if (currentSignatureType.type === 'participante') {
        updateParticipante(currentSignatureType.index, 'firma', formattedSignature);
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

  const saveRecordHandler = async () => {
    const currentMarca = await AsyncStorage.getItem('current_marca');
    if (!currentMarca) {
      Alert.alert('Error', 'No se encontró la marca actual');
      return;
    }

    const currentMarcaData = JSON.parse(currentMarca);

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas guardar este registro de inducción y recorrido?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const requestData = {
                marca_id: currentMarcaData.id,
                fecha: formatDate(fecha) || null,
                renglon_edificio: renglonEdificio.trim() || null,
                supervisor_cliente: supervisorCliente.trim() || null,
                supervisor_corporacion: supervisorCorporacion.trim() || null,
                temas_desarrollados: temasDesarrollados.length > 0 ? JSON.stringify(temasDesarrollados) : null,
                aspectos_especificos: aspectosEspecificos.length > 0 ? JSON.stringify(aspectosEspecificos) : null,
                participantes: participantes.length > 0 ? JSON.stringify(participantes.map(p => ({
                  ...p,
                  firma: getBase64Only(p.firma),
                }))) : null,
                firma_supervisor: getBase64Only(firmaSupervisor),
              };

              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await createInductionTourRecord({
                  requestData,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Registro de inducción y recorrido guardado correctamente');
                  cancelCreating();
                  fetchRecords();
                } else {
                  Alert.alert('Error', result.message || 'Error al guardar el registro de inducción y recorrido');
                }
              } else {
                const localId = generateRandomId();

                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: localId,
                  action: 'create',
                  type: 'induction_tour_record',
                  payload: requestData,
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                const cache = cacheStr ? JSON.parse(cacheStr) : [];

                const newRecordCache: InductionTourRecord = {
                  id: '',
                  id_local: localId,
                  fecha: formatDate(fecha) || null,
                  renglon_edificio: renglonEdificio.trim() || null,
                  supervisor_cliente: supervisorCliente.trim() || null,
                  supervisor_corporacion: supervisorCorporacion.trim() || null,
                  temas_desarrollados: temasDesarrollados.length > 0 ? JSON.stringify(temasDesarrollados) : null,
                  aspectos_especificos: aspectosEspecificos.length > 0 ? JSON.stringify(aspectosEspecificos) : null,
                  participantes: participantes.length > 0 ? JSON.stringify(participantes.map(p => ({
                    ...p,
                    firma: getBase64Only(p.firma),
                  }))) : null,
                  firma_supervisor: getBase64Only(firmaSupervisor),
                  created_at: new Date().toISOString(),
                  synced: false,
                };

                cache.push({ ...newRecordCache, type: 'induction_tour_record' });
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(cache));

                Alert.alert('Modo Offline', 'Registro de inducción y recorrido registrado localmente. Se sincronizará cuando haya conexión.');
                cancelCreating();
                fetchRecords();
              }
            } catch (err) {
              console.error('Error saving record:', err);
              Alert.alert('Error', 'No se pudo guardar el registro de inducción y recorrido');
            }
          },
        },
      ]
    );
  };

  const updateRecordHandler = async () => {
    if (!editingRecord) return;

    const recordId = editingRecord.id || editingRecord.id_local;
    if (!recordId) {
      Alert.alert('Error', 'ID de registro no encontrado para actualizar');
      return;
    }

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas actualizar este registro de inducción y recorrido?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const requestData = {
                fecha: formatDate(fecha) || null,
                renglon_edificio: renglonEdificio.trim() || null,
                supervisor_cliente: supervisorCliente.trim() || null,
                supervisor_corporacion: supervisorCorporacion.trim() || null,
                temas_desarrollados: temasDesarrollados.length > 0 ? JSON.stringify(temasDesarrollados) : null,
                aspectos_especificos: aspectosEspecificos.length > 0 ? JSON.stringify(aspectosEspecificos) : null,
                participantes: participantes.length > 0 ? JSON.stringify(participantes.map(p => ({
                  ...p,
                  firma: getBase64Only(p.firma),
                }))) : null,
                firma_supervisor: getBase64Only(firmaSupervisor),
              };

              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await updateInductionTourRecord({
                  id: recordId,
                  requestData,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Registro de inducción y recorrido actualizado correctamente');
                  cancelEditing();
                  fetchRecords();
                } else {
                  Alert.alert('Error', result.message || 'Error al actualizar el registro de inducción y recorrido');
                }
              } else {
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: recordId,
                  action: 'update',
                  type: 'induction_tour_record',
                  payload: requestData,
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                if (cacheStr) {
                  const cache = JSON.parse(cacheStr);
                  const updatedCache = cache.map((item: any) => {
                    if ((item.id === recordId || item.id_local === recordId) && item.type === 'induction_tour_record') {
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

                Alert.alert('Modo Offline', 'Registro de inducción y recorrido actualizado localmente. Se sincronizará cuando haya conexión.');
                cancelEditing();
                fetchRecords();
              }
            } catch (err) {
              console.error('Error updating record:', err);
              Alert.alert('Error', 'No se pudo actualizar el registro de inducción y recorrido');
            }
          },
        },
      ]
    );
  };

  const deleteRecordHandler = async (record: InductionTourRecord) => {
    const recordId = record.id || record.id_local;
    if (!recordId) {
      Alert.alert('Error', 'ID de registro no encontrado para eliminar');
      return;
    }

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas eliminar este registro de inducción y recorrido?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await deleteInductionTourRecord({
                  id: recordId,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Registro de inducción y recorrido eliminado correctamente');
                  fetchRecords();
                } else {
                  Alert.alert('Error', result.message || 'Error al eliminar el registro de inducción y recorrido');
                }
              } else {
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: recordId,
                  action: 'delete',
                  type: 'induction_tour_record',
                  payload: {},
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                if (cacheStr) {
                  const cache = JSON.parse(cacheStr);
                  const updatedCache = cache.filter((item: any) => !((item.id === recordId || item.id_local === recordId) && item.type === 'induction_tour_record'));
                  await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                }

                Alert.alert('Modo Offline', 'Registro de inducción y recorrido marcado para eliminación localmente. Se sincronizará cuando haya conexión.');
                fetchRecords();
              }
            } catch (err) {
              console.error('Error deleting record:', err);
              Alert.alert('Error', 'No se pudo eliminar el registro de inducción y recorrido');
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
      case 'record': return <Ionicons name="document-text" size={24} color='#000000' />;
      case 'add': return <Ionicons name="add" size={24} color='#FFFFFF' />;
      case 'cancel': return <Ionicons name="close" size={24} color='#FFFFFF' />;
      case 'confirm': return <Ionicons name="checkmark" size={24} color='#FFFFFF' />;
      case 'delete': return <Ionicons name="trash" size={24} color='#FFFFFF' />;
      case 'edit': return <Ionicons name="pencil" size={20} color="#FFFFFF" />;
      default: return <Ionicons name="document-text" size={24} color='#000000' />;
    }
  };

  const renderRecordList = () => {
    if (isLoading) {
      return (
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Cargando registros de inducción y recorrido...</ThemedText>
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

    if (records.length === 0) {
      return (
        <ThemedView style={styles.emptyContainer}>
          <ThemedText style={styles.emptyText}>No hay registros de inducción y recorrido registrados.</ThemedText>
        </ThemedView>
      );
    }

    return (
      <ThemedView style={styles.listContainer}>
        {records.map((record) => (
          <ThemedView key={record.id || record.id_local} style={styles.listItem}>
            <ThemedView style={styles.listItemHeader}>
              <ThemedView style={styles.listItemContent}>
                <ThemedText style={styles.listItemTitle}>
                  Registro de Inducción y Recorrido
                </ThemedText>
                <ThemedText style={styles.listItemSubtitle}>
                  Fecha: {record.fecha || 'N/A'} | Renglón/Edificio: {record.renglon_edificio || 'N/A'}
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
                  onPress={() => deleteRecordHandler(record)}
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

  const renderTema = (tema: TemaDesarrollado, index: number) => {
    const isExpanded = expandedTemaIndices.includes(index);

    return (
      <ThemedView key={index} style={styles.temaItem}>
        <TouchableOpacity
          style={styles.temaHeader}
          onPress={() => toggleTemaExpansion(index)}
        >
          <ThemedView style={styles.temaHeaderContent}>
            <ThemedText style={styles.temaHeaderText}>
              Tema {index + 1}
            </ThemedText>
          </ThemedView>
          <ThemedView style={styles.temaHeaderActions}>
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                removeTema(index);
              }}
              style={styles.removeTemaButton}
            >
              <Ionicons name="trash" size={20} color="#FF3B30" />
            </TouchableOpacity>
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={24}
              color="#000000"
            />
          </ThemedView>
        </TouchableOpacity>

        {isExpanded && (
          <ThemedView style={styles.temaContent}>
            {/* Tema */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Tema</ThemedText>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                placeholder="Tema"
                placeholderTextColor="#999"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                value={tema.tema}
                onChangeText={(text) => updateTema(index, 'tema', text)}
              />
            </ThemedView>

            {/* Respuesta SI/NO/NA */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Respuesta</ThemedText>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={tema.respuesta}
                  onValueChange={(value) => updateTema(index, 'respuesta', value)}
                  style={styles.picker}
                >
                  <Picker.Item label="Seleccionar..." value="" />
                  <Picker.Item label="SI" value="SI" />
                  <Picker.Item label="NO" value="NO" />
                  <Picker.Item label="NA" value="NA" />
                </Picker>
              </View>
            </ThemedView>

            {/* Comentarios */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Comentarios</ThemedText>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                placeholder="Comentarios"
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                value={tema.comentarios}
                onChangeText={(text) => updateTema(index, 'comentarios', text)}
              />
            </ThemedView>
          </ThemedView>
        )}
      </ThemedView>
    );
  };

  const renderAspecto = (aspecto: AspectoEspecifico, index: number) => {
    const isExpanded = expandedAspectoIndices.includes(index);

    return (
      <ThemedView key={index} style={styles.aspectoItem}>
        <TouchableOpacity
          style={styles.aspectoHeader}
          onPress={() => toggleAspectoExpansion(index)}
        >
          <ThemedView style={styles.aspectoHeaderContent}>
            <ThemedText style={styles.aspectoHeaderText}>
              Aspecto {index + 1}
            </ThemedText>
          </ThemedView>
          <ThemedView style={styles.aspectoHeaderActions}>
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                removeAspecto(index);
              }}
              style={styles.removeAspectoButton}
            >
              <Ionicons name="trash" size={20} color="#FF3B30" />
            </TouchableOpacity>
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={24}
              color="#000000"
            />
          </ThemedView>
        </TouchableOpacity>

        {isExpanded && (
          <ThemedView style={styles.aspectoContent}>
            {/* Aspecto */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Aspecto</ThemedText>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                placeholder="Aspecto"
                placeholderTextColor="#999"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                value={aspecto.aspecto}
                onChangeText={(text) => updateAspecto(index, 'aspecto', text)}
              />
            </ThemedView>

            {/* Respuesta SI/NO/NA */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Respuesta</ThemedText>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={aspecto.respuesta}
                  onValueChange={(value) => updateAspecto(index, 'respuesta', value)}
                  style={styles.picker}
                >
                  <Picker.Item label="Seleccionar..." value="" />
                  <Picker.Item label="SI" value="SI" />
                  <Picker.Item label="NO" value="NO" />
                  <Picker.Item label="NA" value="NA" />
                </Picker>
              </View>
            </ThemedView>

            {/* Comentarios */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Comentarios</ThemedText>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                placeholder="Comentarios"
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                value={aspecto.comentarios}
                onChangeText={(text) => updateAspecto(index, 'comentarios', text)}
              />
            </ThemedView>
          </ThemedView>
        )}
      </ThemedView>
    );
  };

  const renderParticipante = (participante: Participante, index: number) => {
    const isExpanded = expandedParticipanteIndices.includes(index);

    return (
      <ThemedView key={index} style={styles.participanteItem}>
        <TouchableOpacity
          style={styles.participanteHeader}
          onPress={() => toggleParticipanteExpansion(index)}
        >
          <ThemedView style={styles.participanteHeaderContent}>
            <ThemedText style={styles.participanteHeaderText}>
              Participante {index + 1}: {participante.nombre_completo || 'Sin nombre'}
            </ThemedText>
          </ThemedView>
          <ThemedView style={styles.participanteHeaderActions}>
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                removeParticipante(index);
              }}
              style={styles.removeParticipanteButton}
            >
              <Ionicons name="trash" size={20} color="#FF3B30" />
            </TouchableOpacity>
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={24}
              color="#000000"
            />
          </ThemedView>
        </TouchableOpacity>

        {isExpanded && (
          <ThemedView style={styles.participanteContent}>
            {/* Nombre completo */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Nombre Completo</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder="Nombre Completo"
                placeholderTextColor="#999"
                value={participante.nombre_completo}
                onChangeText={(text) => updateParticipante(index, 'nombre_completo', text)}
              />
            </ThemedView>

            {/* Cédula */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Cédula</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder="Cédula"
                placeholderTextColor="#999"
                value={participante.cedula}
                onChangeText={(text) => updateParticipante(index, 'cedula', text)}
                keyboardType="numeric"
              />
            </ThemedView>

            {/* Firma */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Firma</ThemedText>
              {!participante.firma ? (
                <TouchableOpacity
                  style={styles.signatureButton}
                  onPress={() => openSignatureModal({ type: 'participante', index })}
                >
                  <Ionicons name="create-outline" size={24} color="#007AFF" />
                  <ThemedText style={styles.signatureButtonText}>Toca para dibujar la firma</ThemedText>
                </TouchableOpacity>
              ) : (
                <ThemedView style={styles.signaturePreviewContainer}>
                  <Image
                    source={{ uri: formatSignatureForDisplay(participante.firma) || '' }}
                    style={styles.signaturePreview}
                  />
                  <TouchableOpacity
                    style={styles.clearSignatureButton}
                    onPress={() => updateParticipante(index, 'firma', null)}
                  >
                    <Ionicons name="trash" size={16} color="#FF3B30" />
                    <ThemedText style={styles.clearSignatureButtonText}>Eliminar Firma</ThemedText>
                  </TouchableOpacity>
                </ThemedView>
              )}
            </ThemedView>
          </ThemedView>
        )}
      </ThemedView>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <AppHeader onMenuPress={handleMenuPress} title="Registro de Inducción y Recorrido" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <ThemedView style={styles.contentContainer}>
          <ThemedText type="title" style={styles.screenTitle}>
            {getActionIcon('record')} Registro de Inducción y Recorrido
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
              {/* Fecha */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Fecha</ThemedText>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <ThemedText style={styles.dateButtonText}>
                    {formatDate(fecha)}
                  </ThemedText>
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

              {/* Renglón o Edificio */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Renglón o Edificio</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Renglón o Edificio"
                  placeholderTextColor="#999"
                  value={renglonEdificio}
                  onChangeText={setRenglonEdificio}
                />
              </ThemedView>

              {/* Supervisor del cliente (si aplica) */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Supervisor del cliente (si aplica)</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Supervisor del cliente"
                  placeholderTextColor="#999"
                  value={supervisorCliente}
                  onChangeText={setSupervisorCliente}
                />
              </ThemedView>

              {/* Supervisor de Corporación */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Supervisor de Corporación</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Supervisor de Corporación"
                  placeholderTextColor="#999"
                  value={supervisorCorporacion}
                  onChangeText={setSupervisorCorporacion}
                />
              </ThemedView>

              {/* Temas desarrollados */}
              <ThemedView style={styles.sectionContainer}>
                <ThemedText style={styles.sectionTitle}>Temas desarrollados en el recorrido e inducción al empleado</ThemedText>
                {temasDesarrollados.map((tema, index) => renderTema(tema, index))}
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={addTema}
                >
                  <Ionicons name="add-circle" size={24} color="#4CAF50" />
                  <ThemedText style={styles.addButtonText}>Agregar Tema</ThemedText>
                </TouchableOpacity>
              </ThemedView>

              {/* Aspectos Específicos por Contrato */}
              <ThemedView style={styles.sectionContainer}>
                <ThemedText style={styles.sectionTitle}>Aspectos Específicos por Contrato</ThemedText>
                {aspectosEspecificos.map((aspecto, index) => renderAspecto(aspecto, index))}
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={addAspecto}
                >
                  <Ionicons name="add-circle" size={24} color="#4CAF50" />
                  <ThemedText style={styles.addButtonText}>Agregar Aspecto</ThemedText>
                </TouchableOpacity>
              </ThemedView>

              {/* Participantes */}
              <ThemedView style={styles.sectionContainer}>
                <ThemedText style={styles.sectionTitle}>Participantes</ThemedText>
                {participantes.map((participante, index) => renderParticipante(participante, index))}
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={addParticipante}
                >
                  <Ionicons name="add-circle" size={24} color="#4CAF50" />
                  <ThemedText style={styles.addButtonText}>Agregar Participante</ThemedText>
                </TouchableOpacity>
              </ThemedView>

              {/* Firma supervisor de aseo y limpieza */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Firma Supervisor de Aseo y Limpieza</ThemedText>
                {!firmaSupervisor ? (
                  <TouchableOpacity
                    style={styles.signatureButton}
                    onPress={() => openSignatureModal('supervisor')}
                  >
                    <Ionicons name="create-outline" size={24} color="#007AFF" />
                    <ThemedText style={styles.signatureButtonText}>Toca para dibujar la firma</ThemedText>
                  </TouchableOpacity>
                ) : (
                  <ThemedView style={styles.signaturePreviewContainer}>
                    <Image
                      source={{ uri: formatSignatureForDisplay(firmaSupervisor) || '' }}
                      style={styles.signaturePreview}
                    />
                    <TouchableOpacity
                      style={styles.clearSignatureButton}
                      onPress={() => setFirmaSupervisor(null)}
                    >
                      <Ionicons name="trash" size={16} color="#FF3B30" />
                      <ThemedText style={styles.clearSignatureButtonText}>Eliminar Firma</ThemedText>
                    </TouchableOpacity>
                  </ThemedView>
                )}
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
                  onPress={editingRecord ? updateRecordHandler : saveRecordHandler}
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
                <ThemedText style={styles.createButtonText}>Crear Nuevo Registro de Inducción y Recorrido</ThemedText>
              </TouchableOpacity>
              {renderRecordList()}
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
                {currentSignatureType === 'supervisor' ? 'Firma Supervisor' : 'Firma Participante'}
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
        currentRoute="InductionTourRecord"
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
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    color: '#000000',
  },
  sectionContainer: {
    marginTop: 20,
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 10,
  },
  temaItem: {
    marginBottom: 15,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  temaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#F5F5F5',
  },
  temaHeaderContent: {
    flex: 1,
    marginRight: 10,
  },
  temaHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  temaHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  removeTemaButton: {
    padding: 4,
  },
  temaContent: {
    padding: 15,
  },
  aspectoItem: {
    marginBottom: 15,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  aspectoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#F5F5F5',
  },
  aspectoHeaderContent: {
    flex: 1,
    marginRight: 10,
  },
  aspectoHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  aspectoHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  removeAspectoButton: {
    padding: 4,
  },
  aspectoContent: {
    padding: 15,
  },
  participanteItem: {
    marginBottom: 15,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  participanteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#F5F5F5',
  },
  participanteHeaderContent: {
    flex: 1,
    marginRight: 10,
  },
  participanteHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  participanteHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  removeParticipanteButton: {
    padding: 4,
  },
  participanteContent: {
    padding: 15,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    marginTop: 10,
    gap: 8,
  },
  addButtonText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
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

