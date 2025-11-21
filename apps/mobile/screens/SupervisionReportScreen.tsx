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
  createSupervisionReport,
  updateSupervisionReport,
  deleteSupervisionReport,
  listSupervisionReportByCorpo,
} from '@/hooks/evaluationFunctions';
import { eventBus } from '@/hooks/eventBus';

type SupervisionReportScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'SupervisionReport'>;

interface LimpiezaGeneralItem {
  item: string;
  calificacion: string; // "1", "2", "3", "4", "5", "N/A"
  observaciones: string;
}

interface CuartoAseoItem {
  item: string;
  calificacion: string; // "1", "2", "3", "4", "5", "N/A"
  observaciones: string;
}

interface ServiciosSanitariosItem {
  item: string;
  calificacion: string; // "1", "2", "3", "4", "5", "N/A"
  observaciones: string;
}

interface UniformePresentacionItem {
  item: string;
  ok_no: string; // "OK", "NO"
  estado: string; // "Bueno", "Requiere cambio"
  observaciones: string;
}

interface EstadoEquiposItem {
  item: string;
  ok_no: string; // "OK", "NO"
  estado: string; // "Bueno", "Requiere cambio"
  observaciones: string;
}

interface CalificacionGeneralItem {
  calificacion: string; // "1", "2", "3", "4", "5"
  observaciones: string;
}

interface SupervisionReport {
  id: string;
  id_local: string;
  fecha: string | null;
  piso: string | null;
  area: string | null;
  aseador: string | null;
  supervisor: string | null;
  limpieza_general: string | null;
  cuarto_aseo: string | null;
  servicios_sanitarios: string | null;
  uniforme_presentacion: string | null;
  estado_equipos: string | null;
  calificacion_general: string | null;
  firma_aseador: string | null;
  firma_supervisor: string | null;
  created_at: string;
  synced?: boolean;
}

interface EditingSupervisionReport {
  id: string | null;
  id_local: string;
  fecha: string;
  piso: string;
  area: string;
  aseador: string;
  supervisor: string;
  limpieza_general: LimpiezaGeneralItem[];
  cuarto_aseo: CuartoAseoItem[];
  servicios_sanitarios: ServiciosSanitariosItem[];
  uniforme_presentacion: UniformePresentacionItem[];
  estado_equipos: EstadoEquiposItem[];
  calificacion_general: CalificacionGeneralItem[];
  firma_aseador: string;
  firma_supervisor: string;
}

const LIMPIEZA_GENERAL_PREDEFINIDOS = [
  "Basureros",
  "Mesas y Sillas",
  "Escritorios",
  "Teléfonos",
  "Computadoras",
  "Archivos y Estantes",
  "Vidrios",
  "Paredes",
  "Pisos",
  "Esquinas y Orillas",
  "Sillones",
  "Jefaturas",
  "Exteriores",
  "Ventiladores",
  "Extintores",
  "Pasa Manos",
  "Bibliotecas",
  "Credenzas",
  "Arturitos",
  "Aéreos",
  "Rotulos",
  "Puertas y Llavines",
  "Canaletas y Tomas",
  "Plantas y Macetas",
  "Partes Altas",
];

const CUARTO_ASEO_PREDEFINIDOS = [
  "Documentos ISO Completos",
  "Registros del Día Llenos",
  "Pilas Limpias",
  "Utiles de Limpieza Buen Estado",
  "Productos Etiquetados y Ordenados",
  "Almacenamiento de Comidas",
];

const SERVICIOS_SANITARIOS_PREDEFINIDOS = [
  "Orinales",
  "Sanitarios y Parte Trasera",
  "Lavamanos y Grifería",
  "Espejos",
  "Paredes y Puertas",
  "Duchas",
  "Partes Altas",
];

const UNIFORME_PRESENTACION_PREDEFINIDOS = [
  "Uniforme y Carnet",
  "Equipo De Protección Personal",
];

const ESTADO_EQUIPOS_PREDEFINIDOS = [
  "Cepillo",
  "Aspiradora",
  "Hidrolavadora",
];

export default function SupervisionReportScreen() {
  const { employee, refreshAccessToken, logout } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<SupervisionReportScreenNavigationProp>();

  // Data states
  const [reports, setReports] = useState<SupervisionReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasCurrentMarca, setHasCurrentMarca] = useState<boolean>(false);

  // Editing state
  const [editingReport, setEditingReport] = useState<EditingSupervisionReport | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form states
  const [fecha, setFecha] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [piso, setPiso] = useState('');
  const [area, setArea] = useState('');
  const [aseador, setAseador] = useState('');
  const [supervisor, setSupervisor] = useState('');
  const [limpiezaGeneral, setLimpiezaGeneral] = useState<LimpiezaGeneralItem[]>([]);
  const [cuartoAseo, setCuartoAseo] = useState<CuartoAseoItem[]>([]);
  const [serviciosSanitarios, setServiciosSanitarios] = useState<ServiciosSanitariosItem[]>([]);
  const [uniformePresentacion, setUniformePresentacion] = useState<UniformePresentacionItem[]>([]);
  const [estadoEquipos, setEstadoEquipos] = useState<EstadoEquiposItem[]>([]);
  const [calificacionGeneral, setCalificacionGeneral] = useState<CalificacionGeneralItem[]>([]);
  const [firmaAseador, setFirmaAseador] = useState<string | null>(null);
  const [firmaSupervisor, setFirmaSupervisor] = useState<string | null>(null);

  // Expanded states
  const [expandedLimpiezaIndices, setExpandedLimpiezaIndices] = useState<number[]>([]);
  const [expandedCuartoAseoIndices, setExpandedCuartoAseoIndices] = useState<number[]>([]);
  const [expandedServiciosIndices, setExpandedServiciosIndices] = useState<number[]>([]);
  const [expandedUniformeIndices, setExpandedUniformeIndices] = useState<number[]>([]);
  const [expandedEquiposIndices, setExpandedEquiposIndices] = useState<number[]>([]);
  const [expandedCalificacionIndices, setExpandedCalificacionIndices] = useState<number[]>([]);

  // Signature modal states
  const [isSignatureModalVisible, setIsSignatureModalVisible] = useState(false);
  const [currentSignatureType, setCurrentSignatureType] = useState<'aseador' | 'supervisor' | null>(null);
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

  const fetchReports = useCallback(async () => {
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
        const result = await listSupervisionReportByCorpo({
          corpo_id: corpoId,
          refreshAccessToken,
          logout,
        });

        if (result.status && result.data) {
          setReports(result.data as SupervisionReport[]);
        } else {
          setReports([]);
        }
      } else {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const reportsCache = cache.filter((item: any) => item.type === 'supervision_report');
          setReports(reportsCache);
        } else {
          setReports([]);
        }
      }
    } catch (err) {
      console.error('Error fetching reports:', err);
      setError('Error al cargar los informes de supervisión');
      try {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const reportsCache = cache.filter((item: any) => item.type === 'supervision_report');
          setReports(reportsCache);
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
      fetchReports();
      eventBus.on('connectionRestored', fetchReports);
      return () => {
        eventBus.off('connectionRestored', fetchReports);
      };
    }, [fetchReports])
  );

  const resetForm = () => {
    setFecha(new Date());
    setPiso('');
    setArea('');
    setAseador('');
    setSupervisor('');
    const limpiezaPredefinidos: LimpiezaGeneralItem[] = LIMPIEZA_GENERAL_PREDEFINIDOS.map(item => ({
      item: item,
      calificacion: '',
      observaciones: '',
    }));
    setLimpiezaGeneral(limpiezaPredefinidos);
    setExpandedLimpiezaIndices(limpiezaPredefinidos.map((_, i) => i));
    const cuartoPredefinidos: CuartoAseoItem[] = CUARTO_ASEO_PREDEFINIDOS.map(item => ({
      item: item,
      calificacion: '',
      observaciones: '',
    }));
    setCuartoAseo(cuartoPredefinidos);
    setExpandedCuartoAseoIndices(cuartoPredefinidos.map((_, i) => i));
    const serviciosPredefinidos: ServiciosSanitariosItem[] = SERVICIOS_SANITARIOS_PREDEFINIDOS.map(item => ({
      item: item,
      calificacion: '',
      observaciones: '',
    }));
    setServiciosSanitarios(serviciosPredefinidos);
    setExpandedServiciosIndices(serviciosPredefinidos.map((_, i) => i));
    const uniformePredefinidos: UniformePresentacionItem[] = UNIFORME_PRESENTACION_PREDEFINIDOS.map(item => ({
      item: item,
      ok_no: '',
      estado: '',
      observaciones: '',
    }));
    setUniformePresentacion(uniformePredefinidos);
    setExpandedUniformeIndices(uniformePredefinidos.map((_, i) => i));
    const equiposPredefinidos: EstadoEquiposItem[] = ESTADO_EQUIPOS_PREDEFINIDOS.map(item => ({
      item: item,
      ok_no: '',
      estado: '',
      observaciones: '',
    }));
    setEstadoEquipos(equiposPredefinidos);
    setExpandedEquiposIndices(equiposPredefinidos.map((_, i) => i));
    setCalificacionGeneral([{ calificacion: '', observaciones: '' }]);
    setExpandedCalificacionIndices([0]);
    setFirmaAseador(null);
    setFirmaSupervisor(null);
  };

  const startCreating = () => {
    setIsCreating(true);
    setEditingReport(null);
    resetForm();
  };

  const cancelCreating = () => {
    setIsCreating(false);
    resetForm();
  };

  const startEditing = (report: SupervisionReport) => {
    setIsCreating(false);
    let limpiezaArray: LimpiezaGeneralItem[] = [];
    let cuartoArray: CuartoAseoItem[] = [];
    let serviciosArray: ServiciosSanitariosItem[] = [];
    let uniformeArray: UniformePresentacionItem[] = [];
    let equiposArray: EstadoEquiposItem[] = [];
    let calificacionArray: CalificacionGeneralItem[] = [];

    if (report.limpieza_general) {
      try {
        limpiezaArray = JSON.parse(report.limpieza_general);
        if (!Array.isArray(limpiezaArray)) limpiezaArray = [];
      } catch (e) {
        limpiezaArray = [];
      }
    }

    if (report.cuarto_aseo) {
      try {
        cuartoArray = JSON.parse(report.cuarto_aseo);
        if (!Array.isArray(cuartoArray)) cuartoArray = [];
      } catch (e) {
        cuartoArray = [];
      }
    }

    if (report.servicios_sanitarios) {
      try {
        serviciosArray = JSON.parse(report.servicios_sanitarios);
        if (!Array.isArray(serviciosArray)) serviciosArray = [];
      } catch (e) {
        serviciosArray = [];
      }
    }

    if (report.uniforme_presentacion) {
      try {
        uniformeArray = JSON.parse(report.uniforme_presentacion);
        if (!Array.isArray(uniformeArray)) uniformeArray = [];
      } catch (e) {
        uniformeArray = [];
      }
    }

    if (report.estado_equipos) {
      try {
        equiposArray = JSON.parse(report.estado_equipos);
        if (!Array.isArray(equiposArray)) equiposArray = [];
      } catch (e) {
        equiposArray = [];
      }
    }

    if (report.calificacion_general) {
      try {
        calificacionArray = JSON.parse(report.calificacion_general);
        if (!Array.isArray(calificacionArray)) calificacionArray = [{ calificacion: '', observaciones: '' }];
      } catch (e) {
        calificacionArray = [{ calificacion: '', observaciones: '' }];
      }
    }

    setEditingReport({
      id: report.id,
      id_local: report.id_local,
      fecha: report.fecha || '',
      piso: report.piso || '',
      area: report.area || '',
      aseador: report.aseador || '',
      supervisor: report.supervisor || '',
      limpieza_general: limpiezaArray,
      cuarto_aseo: cuartoArray,
      servicios_sanitarios: serviciosArray,
      uniforme_presentacion: uniformeArray,
      estado_equipos: equiposArray,
      calificacion_general: calificacionArray,
      firma_aseador: report.firma_aseador || '',
      firma_supervisor: report.firma_supervisor || '',
    });

    setPiso(report.piso || '');
    setArea(report.area || '');
    setAseador(report.aseador || '');
    setSupervisor(report.supervisor || '');
    if (report.fecha) {
      const dateParts = report.fecha.split('/');
      if (dateParts.length === 3) {
        setFecha(new Date(parseInt(dateParts[2]), parseInt(dateParts[1]) - 1, parseInt(dateParts[0])));
      }
    }
    setLimpiezaGeneral(limpiezaArray);
    setCuartoAseo(cuartoArray);
    setServiciosSanitarios(serviciosArray);
    setUniformePresentacion(uniformeArray);
    setEstadoEquipos(equiposArray);
    setCalificacionGeneral(calificacionArray);
    setFirmaAseador(formatSignatureForDisplay(report.firma_aseador));
    setFirmaSupervisor(formatSignatureForDisplay(report.firma_supervisor));
    setExpandedLimpiezaIndices(limpiezaArray.map((_, i) => i));
    setExpandedCuartoAseoIndices(cuartoArray.map((_, i) => i));
    setExpandedServiciosIndices(serviciosArray.map((_, i) => i));
    setExpandedUniformeIndices(uniformeArray.map((_, i) => i));
    setExpandedEquiposIndices(equiposArray.map((_, i) => i));
    setExpandedCalificacionIndices(calificacionArray.map((_, i) => i));
  };

  const cancelEditing = () => {
    setEditingReport(null);
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

  // Limpieza General functions
  const addLimpiezaGeneral = () => {
    const newItem: LimpiezaGeneralItem = { item: '', calificacion: '', observaciones: '' };
    setLimpiezaGeneral([...limpiezaGeneral, newItem]);
    setExpandedLimpiezaIndices([...expandedLimpiezaIndices, limpiezaGeneral.length]);
  };

  const updateLimpiezaGeneral = (index: number, field: keyof LimpiezaGeneralItem, value: string) => {
    const newItems = [...limpiezaGeneral];
    newItems[index] = { ...newItems[index], [field]: value };
    setLimpiezaGeneral(newItems);
  };

  const removeLimpiezaGeneral = (index: number) => {
    Alert.alert('Confirmar', '¿Eliminar este item?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          setLimpiezaGeneral(limpiezaGeneral.filter((_, i) => i !== index));
          setExpandedLimpiezaIndices(expandedLimpiezaIndices.filter(i => i !== index).map(i => i > index ? i - 1 : i));
        },
      },
    ]);
  };

  const toggleLimpiezaExpansion = (index: number) => {
    setExpandedLimpiezaIndices(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  // Cuarto Aseo functions
  const addCuartoAseo = () => {
    const newItem: CuartoAseoItem = { item: '', calificacion: '', observaciones: '' };
    setCuartoAseo([...cuartoAseo, newItem]);
    setExpandedCuartoAseoIndices([...expandedCuartoAseoIndices, cuartoAseo.length]);
  };

  const updateCuartoAseo = (index: number, field: keyof CuartoAseoItem, value: string) => {
    const newItems = [...cuartoAseo];
    newItems[index] = { ...newItems[index], [field]: value };
    setCuartoAseo(newItems);
  };

  const removeCuartoAseo = (index: number) => {
    Alert.alert('Confirmar', '¿Eliminar este item?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          setCuartoAseo(cuartoAseo.filter((_, i) => i !== index));
          setExpandedCuartoAseoIndices(expandedCuartoAseoIndices.filter(i => i !== index).map(i => i > index ? i - 1 : i));
        },
      },
    ]);
  };

  const toggleCuartoAseoExpansion = (index: number) => {
    setExpandedCuartoAseoIndices(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  // Servicios Sanitarios functions
  const addServiciosSanitarios = () => {
    const newItem: ServiciosSanitariosItem = { item: '', calificacion: '', observaciones: '' };
    setServiciosSanitarios([...serviciosSanitarios, newItem]);
    setExpandedServiciosIndices([...expandedServiciosIndices, serviciosSanitarios.length]);
  };

  const updateServiciosSanitarios = (index: number, field: keyof ServiciosSanitariosItem, value: string) => {
    const newItems = [...serviciosSanitarios];
    newItems[index] = { ...newItems[index], [field]: value };
    setServiciosSanitarios(newItems);
  };

  const removeServiciosSanitarios = (index: number) => {
    Alert.alert('Confirmar', '¿Eliminar este item?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          setServiciosSanitarios(serviciosSanitarios.filter((_, i) => i !== index));
          setExpandedServiciosIndices(expandedServiciosIndices.filter(i => i !== index).map(i => i > index ? i - 1 : i));
        },
      },
    ]);
  };

  const toggleServiciosExpansion = (index: number) => {
    setExpandedServiciosIndices(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  // Uniforme Presentacion functions
  const addUniformePresentacion = () => {
    const newItem: UniformePresentacionItem = { item: '', ok_no: '', estado: '', observaciones: '' };
    setUniformePresentacion([...uniformePresentacion, newItem]);
    setExpandedUniformeIndices([...expandedUniformeIndices, uniformePresentacion.length]);
  };

  const updateUniformePresentacion = (index: number, field: keyof UniformePresentacionItem, value: string) => {
    const newItems = [...uniformePresentacion];
    newItems[index] = { ...newItems[index], [field]: value };
    setUniformePresentacion(newItems);
  };

  const removeUniformePresentacion = (index: number) => {
    Alert.alert('Confirmar', '¿Eliminar este item?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          setUniformePresentacion(uniformePresentacion.filter((_, i) => i !== index));
          setExpandedUniformeIndices(expandedUniformeIndices.filter(i => i !== index).map(i => i > index ? i - 1 : i));
        },
      },
    ]);
  };

  const toggleUniformeExpansion = (index: number) => {
    setExpandedUniformeIndices(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  // Estado Equipos functions
  const addEstadoEquipos = () => {
    const newItem: EstadoEquiposItem = { item: '', ok_no: '', estado: '', observaciones: '' };
    setEstadoEquipos([...estadoEquipos, newItem]);
    setExpandedEquiposIndices([...expandedEquiposIndices, estadoEquipos.length]);
  };

  const updateEstadoEquipos = (index: number, field: keyof EstadoEquiposItem, value: string) => {
    const newItems = [...estadoEquipos];
    newItems[index] = { ...newItems[index], [field]: value };
    setEstadoEquipos(newItems);
  };

  const removeEstadoEquipos = (index: number) => {
    Alert.alert('Confirmar', '¿Eliminar este item?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          setEstadoEquipos(estadoEquipos.filter((_, i) => i !== index));
          setExpandedEquiposIndices(expandedEquiposIndices.filter(i => i !== index).map(i => i > index ? i - 1 : i));
        },
      },
    ]);
  };

  const toggleEquiposExpansion = (index: number) => {
    setExpandedEquiposIndices(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  // Calificacion General functions
  const updateCalificacionGeneral = (index: number, field: keyof CalificacionGeneralItem, value: string) => {
    const newItems = [...calificacionGeneral];
    newItems[index] = { ...newItems[index], [field]: value };
    setCalificacionGeneral(newItems);
  };

  const toggleCalificacionExpansion = (index: number) => {
    setExpandedCalificacionIndices(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const openSignatureModal = (type: 'aseador' | 'supervisor') => {
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
      
      if (currentSignatureType === 'aseador') {
        setFirmaAseador(formattedSignature);
      } else if (currentSignatureType === 'supervisor') {
        setFirmaSupervisor(formattedSignature);
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

  const saveReportHandler = async () => {
    const currentMarca = await AsyncStorage.getItem('current_marca');
    if (!currentMarca) {
      Alert.alert('Error', 'No se encontró la marca actual');
      return;
    }

    const currentMarcaData = JSON.parse(currentMarca);

    Alert.alert('Confirmar', '¿Estás seguro de que deseas guardar este informe de supervisión?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: async () => {
          try {
            const requestData = {
              marca_id: currentMarcaData.id,
              fecha: formatDate(fecha) || null,
              piso: piso.trim() || null,
              area: area.trim() || null,
              aseador: aseador.trim() || null,
              supervisor: supervisor.trim() || null,
              limpieza_general: limpiezaGeneral.length > 0 ? JSON.stringify(limpiezaGeneral) : null,
              cuarto_aseo: cuartoAseo.length > 0 ? JSON.stringify(cuartoAseo) : null,
              servicios_sanitarios: serviciosSanitarios.length > 0 ? JSON.stringify(serviciosSanitarios) : null,
              uniforme_presentacion: uniformePresentacion.length > 0 ? JSON.stringify(uniformePresentacion) : null,
              estado_equipos: estadoEquipos.length > 0 ? JSON.stringify(estadoEquipos) : null,
              calificacion_general: calificacionGeneral.length > 0 ? JSON.stringify(calificacionGeneral) : null,
              firma_aseador: getBase64Only(firmaAseador),
              firma_supervisor: getBase64Only(firmaSupervisor),
            };

            const isConnected = await getConnectionStatus();

            if (isConnected) {
              const result = await createSupervisionReport({
                requestData,
                refreshAccessToken,
                logout,
              });

              if (result.status) {
                Alert.alert('Éxito', 'Informe de supervisión guardado correctamente');
                cancelCreating();
                fetchReports();
              } else {
                Alert.alert('Error', result.message || 'Error al guardar el informe de supervisión');
              }
            } else {
              const localId = generateRandomId();

              const actionsStr = await AsyncStorage.getItem('evaluations_actions');
              const actions = actionsStr ? JSON.parse(actionsStr) : [];
              actions.push({
                id: localId,
                action: 'create',
                type: 'supervision_report',
                payload: requestData,
                synced: false,
              });
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

              const cacheStr = await AsyncStorage.getItem('evaluations_cache');
              const cache = cacheStr ? JSON.parse(cacheStr) : [];

              const newReportCache: SupervisionReport = {
                id: '',
                id_local: localId,
                fecha: formatDate(fecha) || null,
                piso: piso.trim() || null,
                area: area.trim() || null,
                aseador: aseador.trim() || null,
                supervisor: supervisor.trim() || null,
                limpieza_general: limpiezaGeneral.length > 0 ? JSON.stringify(limpiezaGeneral) : null,
                cuarto_aseo: cuartoAseo.length > 0 ? JSON.stringify(cuartoAseo) : null,
                servicios_sanitarios: serviciosSanitarios.length > 0 ? JSON.stringify(serviciosSanitarios) : null,
                uniforme_presentacion: uniformePresentacion.length > 0 ? JSON.stringify(uniformePresentacion) : null,
                estado_equipos: estadoEquipos.length > 0 ? JSON.stringify(estadoEquipos) : null,
                calificacion_general: calificacionGeneral.length > 0 ? JSON.stringify(calificacionGeneral) : null,
                firma_aseador: getBase64Only(firmaAseador),
                firma_supervisor: getBase64Only(firmaSupervisor),
                created_at: new Date().toISOString(),
                synced: false,
              };

              cache.push({ ...newReportCache, type: 'supervision_report' });
              await AsyncStorage.setItem('evaluations_cache', JSON.stringify(cache));

              Alert.alert('Modo Offline', 'Informe de supervisión registrado localmente. Se sincronizará cuando haya conexión.');
              cancelCreating();
              fetchReports();
            }
          } catch (err) {
            console.error('Error saving report:', err);
            Alert.alert('Error', 'No se pudo guardar el informe de supervisión');
          }
        },
      },
    ]);
  };

  const updateReportHandler = async () => {
    if (!editingReport) return;

    const reportId = editingReport.id || editingReport.id_local;
    if (!reportId) {
      Alert.alert('Error', 'ID de informe no encontrado para actualizar');
      return;
    }

    Alert.alert('Confirmar', '¿Estás seguro de que deseas actualizar este informe de supervisión?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: async () => {
          try {
            const requestData = {
              fecha: formatDate(fecha) || null,
              piso: piso.trim() || null,
              area: area.trim() || null,
              aseador: aseador.trim() || null,
              supervisor: supervisor.trim() || null,
              limpieza_general: limpiezaGeneral.length > 0 ? JSON.stringify(limpiezaGeneral) : null,
              cuarto_aseo: cuartoAseo.length > 0 ? JSON.stringify(cuartoAseo) : null,
              servicios_sanitarios: serviciosSanitarios.length > 0 ? JSON.stringify(serviciosSanitarios) : null,
              uniforme_presentacion: uniformePresentacion.length > 0 ? JSON.stringify(uniformePresentacion) : null,
              estado_equipos: estadoEquipos.length > 0 ? JSON.stringify(estadoEquipos) : null,
              calificacion_general: calificacionGeneral.length > 0 ? JSON.stringify(calificacionGeneral) : null,
              firma_aseador: getBase64Only(firmaAseador),
              firma_supervisor: getBase64Only(firmaSupervisor),
            };

            const isConnected = await getConnectionStatus();

            if (isConnected) {
              const result = await updateSupervisionReport({
                id: reportId,
                requestData,
                refreshAccessToken,
                logout,
              });

              if (result.status) {
                Alert.alert('Éxito', 'Informe de supervisión actualizado correctamente');
                cancelEditing();
                fetchReports();
              } else {
                Alert.alert('Error', result.message || 'Error al actualizar el informe de supervisión');
              }
            } else {
              const actionsStr = await AsyncStorage.getItem('evaluations_actions');
              const actions = actionsStr ? JSON.parse(actionsStr) : [];
              actions.push({
                id: reportId,
                action: 'update',
                type: 'supervision_report',
                payload: requestData,
                synced: false,
              });
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

              const cacheStr = await AsyncStorage.getItem('evaluations_cache');
              if (cacheStr) {
                const cache = JSON.parse(cacheStr);
                const updatedCache = cache.map((item: any) => {
                  if ((item.id === reportId || item.id_local === reportId) && item.type === 'supervision_report') {
                    return { ...item, ...requestData, synced: false };
                  }
                  return item;
                });
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
              }

              Alert.alert('Modo Offline', 'Informe de supervisión actualizado localmente. Se sincronizará cuando haya conexión.');
              cancelEditing();
              fetchReports();
            }
          } catch (err) {
            console.error('Error updating report:', err);
            Alert.alert('Error', 'No se pudo actualizar el informe de supervisión');
          }
        },
      },
    ]);
  };

  const deleteReportHandler = async (report: SupervisionReport) => {
    const reportId = report.id || report.id_local;
    if (!reportId) {
      Alert.alert('Error', 'ID de informe no encontrado para eliminar');
      return;
    }

    Alert.alert('Confirmar', '¿Estás seguro de que deseas eliminar este informe de supervisión?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: async () => {
          try {
            const isConnected = await getConnectionStatus();

            if (isConnected) {
              const result = await deleteSupervisionReport({
                id: reportId,
                refreshAccessToken,
                logout,
              });

              if (result.status) {
                Alert.alert('Éxito', 'Informe de supervisión eliminado correctamente');
                fetchReports();
              } else {
                Alert.alert('Error', result.message || 'Error al eliminar el informe de supervisión');
              }
            } else {
              const actionsStr = await AsyncStorage.getItem('evaluations_actions');
              const actions = actionsStr ? JSON.parse(actionsStr) : [];
              actions.push({
                id: reportId,
                action: 'delete',
                type: 'supervision_report',
                payload: {},
                synced: false,
              });
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

              const cacheStr = await AsyncStorage.getItem('evaluations_cache');
              if (cacheStr) {
                const cache = JSON.parse(cacheStr);
                const updatedCache = cache.filter((item: any) => !((item.id === reportId || item.id_local === reportId) && item.type === 'supervision_report'));
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
              }

              Alert.alert('Modo Offline', 'Informe de supervisión marcado para eliminación localmente. Se sincronizará cuando haya conexión.');
              fetchReports();
            }
          } catch (err) {
            console.error('Error deleting report:', err);
            Alert.alert('Error', 'No se pudo eliminar el informe de supervisión');
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

  const renderReportList = () => {
    if (isLoading) {
      return (
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Cargando informes de supervisión...</ThemedText>
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

    if (reports.length === 0) {
      return (
        <ThemedView style={styles.emptyContainer}>
          <ThemedText style={styles.emptyText}>No hay informes de supervisión registrados.</ThemedText>
        </ThemedView>
      );
    }

    return (
      <ThemedView style={styles.listContainer}>
        {reports.map((report) => (
          <ThemedView key={report.id || report.id_local} style={styles.listItem}>
            <ThemedView style={styles.listItemHeader}>
              <ThemedView style={styles.listItemContent}>
                <ThemedText style={styles.listItemTitle}>Informe de Supervisión</ThemedText>
                <ThemedText style={styles.listItemSubtitle}>
                  Fecha: {report.fecha || 'N/A'} | Área: {report.area || 'N/A'} | Aseador: {report.aseador || 'N/A'}
                </ThemedText>
              </ThemedView>
              <ThemedView style={styles.listItemActions}>
                {!report.synced && (
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
                  onPress={() => startEditing(report)}
                >
                  {getActionIcon('edit')}
                  <ThemedText style={styles.listItemButtonText}>Editar</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.listItemButton, styles.deleteButton]}
                  onPress={() => deleteReportHandler(report)}
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

  const renderRadioButtons = (options: string[], selectedValue: string, onSelect: (value: string) => void) => {
    return (
      <ThemedView style={styles.radioGroup}>
        {options.map((option) => (
          <TouchableOpacity
            key={option}
            style={styles.radioOption}
            onPress={() => onSelect(option)}
          >
            <View style={[styles.radioCircle, selectedValue === option && styles.radioCircleSelected]}>
              {selectedValue === option && <View style={styles.radioInnerCircle} />}
            </View>
            <ThemedText style={[styles.radioLabel, selectedValue === option && styles.radioLabelSelected]}>
              {option}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </ThemedView>
    );
  };

  const renderLimpiezaGeneral = (item: LimpiezaGeneralItem, index: number) => {
    const isExpanded = expandedLimpiezaIndices.includes(index);
    return (
      <ThemedView key={index} style={styles.itemContainer}>
        <TouchableOpacity style={styles.itemHeader} onPress={() => toggleLimpiezaExpansion(index)}>
          <ThemedView style={styles.itemHeaderContent}>
            <ThemedText style={styles.itemHeaderText}>{item.item || `Item ${index + 1}`}</ThemedText>
          </ThemedView>
          <ThemedView style={styles.itemHeaderActions}>
            <TouchableOpacity onPress={(e) => { e.stopPropagation(); removeLimpiezaGeneral(index); }} style={styles.removeButton}>
              <Ionicons name="trash" size={20} color="#FF3B30" />
            </TouchableOpacity>
            <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={24} color="#000000" />
          </ThemedView>
        </TouchableOpacity>
        {isExpanded && (
          <ThemedView style={styles.itemContent}>
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Item</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder="Item"
                placeholderTextColor="#999"
                value={item.item}
                onChangeText={(text) => updateLimpiezaGeneral(index, 'item', text)}
              />
            </ThemedView>
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Calificación</ThemedText>
              {renderRadioButtons(['1', '2', '3', '4', '5', 'N/A'], item.calificacion, (value) => updateLimpiezaGeneral(index, 'calificacion', value))}
            </ThemedView>
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Observaciones</ThemedText>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                placeholder="Observaciones"
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                value={item.observaciones}
                onChangeText={(text) => updateLimpiezaGeneral(index, 'observaciones', text)}
              />
            </ThemedView>
          </ThemedView>
        )}
      </ThemedView>
    );
  };

  const renderCuartoAseo = (item: CuartoAseoItem, index: number) => {
    const isExpanded = expandedCuartoAseoIndices.includes(index);
    return (
      <ThemedView key={index} style={styles.itemContainer}>
        <TouchableOpacity style={styles.itemHeader} onPress={() => toggleCuartoAseoExpansion(index)}>
          <ThemedView style={styles.itemHeaderContent}>
            <ThemedText style={styles.itemHeaderText}>{item.item || `Item ${index + 1}`}</ThemedText>
          </ThemedView>
          <ThemedView style={styles.itemHeaderActions}>
            <TouchableOpacity onPress={(e) => { e.stopPropagation(); removeCuartoAseo(index); }} style={styles.removeButton}>
              <Ionicons name="trash" size={20} color="#FF3B30" />
            </TouchableOpacity>
            <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={24} color="#000000" />
          </ThemedView>
        </TouchableOpacity>
        {isExpanded && (
          <ThemedView style={styles.itemContent}>
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Item</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder="Item"
                placeholderTextColor="#999"
                value={item.item}
                onChangeText={(text) => updateCuartoAseo(index, 'item', text)}
              />
            </ThemedView>
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Calificación</ThemedText>
              {renderRadioButtons(['1', '2', '3', '4', '5', 'N/A'], item.calificacion, (value) => updateCuartoAseo(index, 'calificacion', value))}
            </ThemedView>
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Observaciones</ThemedText>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                placeholder="Observaciones"
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                value={item.observaciones}
                onChangeText={(text) => updateCuartoAseo(index, 'observaciones', text)}
              />
            </ThemedView>
          </ThemedView>
        )}
      </ThemedView>
    );
  };

  const renderServiciosSanitarios = (item: ServiciosSanitariosItem, index: number) => {
    const isExpanded = expandedServiciosIndices.includes(index);
    return (
      <ThemedView key={index} style={styles.itemContainer}>
        <TouchableOpacity style={styles.itemHeader} onPress={() => toggleServiciosExpansion(index)}>
          <ThemedView style={styles.itemHeaderContent}>
            <ThemedText style={styles.itemHeaderText}>{item.item || `Item ${index + 1}`}</ThemedText>
          </ThemedView>
          <ThemedView style={styles.itemHeaderActions}>
            <TouchableOpacity onPress={(e) => { e.stopPropagation(); removeServiciosSanitarios(index); }} style={styles.removeButton}>
              <Ionicons name="trash" size={20} color="#FF3B30" />
            </TouchableOpacity>
            <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={24} color="#000000" />
          </ThemedView>
        </TouchableOpacity>
        {isExpanded && (
          <ThemedView style={styles.itemContent}>
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Item</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder="Item"
                placeholderTextColor="#999"
                value={item.item}
                onChangeText={(text) => updateServiciosSanitarios(index, 'item', text)}
              />
            </ThemedView>
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Calificación</ThemedText>
              {renderRadioButtons(['1', '2', '3', '4', '5', 'N/A'], item.calificacion, (value) => updateServiciosSanitarios(index, 'calificacion', value))}
            </ThemedView>
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Observaciones</ThemedText>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                placeholder="Observaciones"
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                value={item.observaciones}
                onChangeText={(text) => updateServiciosSanitarios(index, 'observaciones', text)}
              />
            </ThemedView>
          </ThemedView>
        )}
      </ThemedView>
    );
  };

  const renderUniformePresentacion = (item: UniformePresentacionItem, index: number) => {
    const isExpanded = expandedUniformeIndices.includes(index);
    return (
      <ThemedView key={index} style={styles.itemContainer}>
        <TouchableOpacity style={styles.itemHeader} onPress={() => toggleUniformeExpansion(index)}>
          <ThemedView style={styles.itemHeaderContent}>
            <ThemedText style={styles.itemHeaderText}>{item.item || `Item ${index + 1}`}</ThemedText>
          </ThemedView>
          <ThemedView style={styles.itemHeaderActions}>
            <TouchableOpacity onPress={(e) => { e.stopPropagation(); removeUniformePresentacion(index); }} style={styles.removeButton}>
              <Ionicons name="trash" size={20} color="#FF3B30" />
            </TouchableOpacity>
            <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={24} color="#000000" />
          </ThemedView>
        </TouchableOpacity>
        {isExpanded && (
          <ThemedView style={styles.itemContent}>
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Item</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder="Item"
                placeholderTextColor="#999"
                value={item.item}
                onChangeText={(text) => updateUniformePresentacion(index, 'item', text)}
              />
            </ThemedView>
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>OK/NO</ThemedText>
              {renderRadioButtons(['OK', 'NO'], item.ok_no, (value) => updateUniformePresentacion(index, 'ok_no', value))}
            </ThemedView>
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Estado</ThemedText>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={item.estado}
                  onValueChange={(value) => updateUniformePresentacion(index, 'estado', value)}
                  style={styles.picker}
                >
                  <Picker.Item label="Seleccionar..." value="" />
                  <Picker.Item label="Bueno" value="Bueno" />
                  <Picker.Item label="Requiere cambio" value="Requiere cambio" />
                </Picker>
              </View>
            </ThemedView>
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Observaciones</ThemedText>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                placeholder="Observaciones"
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                value={item.observaciones}
                onChangeText={(text) => updateUniformePresentacion(index, 'observaciones', text)}
              />
            </ThemedView>
          </ThemedView>
        )}
      </ThemedView>
    );
  };

  const renderEstadoEquipos = (item: EstadoEquiposItem, index: number) => {
    const isExpanded = expandedEquiposIndices.includes(index);
    return (
      <ThemedView key={index} style={styles.itemContainer}>
        <TouchableOpacity style={styles.itemHeader} onPress={() => toggleEquiposExpansion(index)}>
          <ThemedView style={styles.itemHeaderContent}>
            <ThemedText style={styles.itemHeaderText}>{item.item || `Item ${index + 1}`}</ThemedText>
          </ThemedView>
          <ThemedView style={styles.itemHeaderActions}>
            <TouchableOpacity onPress={(e) => { e.stopPropagation(); removeEstadoEquipos(index); }} style={styles.removeButton}>
              <Ionicons name="trash" size={20} color="#FF3B30" />
            </TouchableOpacity>
            <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={24} color="#000000" />
          </ThemedView>
        </TouchableOpacity>
        {isExpanded && (
          <ThemedView style={styles.itemContent}>
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Item</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder="Item"
                placeholderTextColor="#999"
                value={item.item}
                onChangeText={(text) => updateEstadoEquipos(index, 'item', text)}
              />
            </ThemedView>
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>OK/NO</ThemedText>
              {renderRadioButtons(['OK', 'NO'], item.ok_no, (value) => updateEstadoEquipos(index, 'ok_no', value))}
            </ThemedView>
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Estado</ThemedText>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={item.estado}
                  onValueChange={(value) => updateEstadoEquipos(index, 'estado', value)}
                  style={styles.picker}
                >
                  <Picker.Item label="Seleccionar..." value="" />
                  <Picker.Item label="Bueno" value="Bueno" />
                  <Picker.Item label="Requiere cambio" value="Requiere cambio" />
                </Picker>
              </View>
            </ThemedView>
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Observaciones</ThemedText>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                placeholder="Observaciones"
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                value={item.observaciones}
                onChangeText={(text) => updateEstadoEquipos(index, 'observaciones', text)}
              />
            </ThemedView>
          </ThemedView>
        )}
      </ThemedView>
    );
  };

  const renderCalificacionGeneral = (item: CalificacionGeneralItem, index: number) => {
    const isExpanded = expandedCalificacionIndices.includes(index);
    return (
      <ThemedView key={index} style={styles.itemContainer}>
        <TouchableOpacity style={styles.itemHeader} onPress={() => toggleCalificacionExpansion(index)}>
          <ThemedView style={styles.itemHeaderContent}>
            <ThemedText style={styles.itemHeaderText}>Calificación General</ThemedText>
          </ThemedView>
          <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={24} color="#000000" />
        </TouchableOpacity>
        {isExpanded && (
          <ThemedView style={styles.itemContent}>
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Calificación</ThemedText>
              {renderRadioButtons(['1', '2', '3', '4', '5'], item.calificacion, (value) => updateCalificacionGeneral(index, 'calificacion', value))}
            </ThemedView>
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Observaciones</ThemedText>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                placeholder="Observaciones"
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                value={item.observaciones}
                onChangeText={(text) => updateCalificacionGeneral(index, 'observaciones', text)}
              />
            </ThemedView>
          </ThemedView>
        )}
      </ThemedView>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <AppHeader onMenuPress={handleMenuPress} title="Informe de Supervisión" />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <ThemedView style={styles.contentContainer}>
          <ThemedText type="title" style={styles.screenTitle}>
            {getActionIcon('record')} Informe de Supervisión
          </ThemedText>

          {!hasCurrentMarca && (
            <ThemedView style={styles.noMarcaContainer}>
              <ThemedText style={styles.noMarcaTitle}>Marca no seleccionada</ThemedText>
              <ThemedText style={styles.noMarcaMessage}>
                No se encontró una marca seleccionada. Por favor, selecciona una marca desde el menú principal.
              </ThemedText>
            </ThemedView>
          )}

          {isCreating || editingReport ? (
            <ThemedView style={styles.formContainer}>
              <ThemedView style={styles.formGroup}>
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

              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Piso</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Piso"
                  placeholderTextColor="#999"
                  value={piso}
                  onChangeText={setPiso}
                />
              </ThemedView>

              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Area</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Area"
                  placeholderTextColor="#999"
                  value={area}
                  onChangeText={setArea}
                />
              </ThemedView>

              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Aseador</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Aseador"
                  placeholderTextColor="#999"
                  value={aseador}
                  onChangeText={setAseador}
                />
              </ThemedView>

              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Supervisor</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Supervisor"
                  placeholderTextColor="#999"
                  value={supervisor}
                  onChangeText={setSupervisor}
                />
              </ThemedView>

              <ThemedView style={styles.sectionContainer}>
                <ThemedText style={styles.sectionTitle}>Limpieza general del área</ThemedText>
                {limpiezaGeneral.map((item, index) => renderLimpiezaGeneral(item, index))}
                <TouchableOpacity style={styles.addButton} onPress={addLimpiezaGeneral}>
                  <Ionicons name="add-circle" size={24} color="#4CAF50" />
                  <ThemedText style={styles.addButtonText}>Agregar Item</ThemedText>
                </TouchableOpacity>
              </ThemedView>

              <ThemedView style={styles.sectionContainer}>
                <ThemedText style={styles.sectionTitle}>Cuarto de aseo</ThemedText>
                {cuartoAseo.map((item, index) => renderCuartoAseo(item, index))}
                <TouchableOpacity style={styles.addButton} onPress={addCuartoAseo}>
                  <Ionicons name="add-circle" size={24} color="#4CAF50" />
                  <ThemedText style={styles.addButtonText}>Agregar Item</ThemedText>
                </TouchableOpacity>
              </ThemedView>

              <ThemedView style={styles.sectionContainer}>
                <ThemedText style={styles.sectionTitle}>Servicios sanitarios</ThemedText>
                {serviciosSanitarios.map((item, index) => renderServiciosSanitarios(item, index))}
                <TouchableOpacity style={styles.addButton} onPress={addServiciosSanitarios}>
                  <Ionicons name="add-circle" size={24} color="#4CAF50" />
                  <ThemedText style={styles.addButtonText}>Agregar Item</ThemedText>
                </TouchableOpacity>
              </ThemedView>

              <ThemedView style={styles.sectionContainer}>
                <ThemedText style={styles.sectionTitle}>Uniforme y presentación</ThemedText>
                {uniformePresentacion.map((item, index) => renderUniformePresentacion(item, index))}
                <TouchableOpacity style={styles.addButton} onPress={addUniformePresentacion}>
                  <Ionicons name="add-circle" size={24} color="#4CAF50" />
                  <ThemedText style={styles.addButtonText}>Agregar Item</ThemedText>
                </TouchableOpacity>
              </ThemedView>

              <ThemedView style={styles.sectionContainer}>
                <ThemedText style={styles.sectionTitle}>Estado de los equipos</ThemedText>
                {estadoEquipos.map((item, index) => renderEstadoEquipos(item, index))}
                <TouchableOpacity style={styles.addButton} onPress={addEstadoEquipos}>
                  <Ionicons name="add-circle" size={24} color="#4CAF50" />
                  <ThemedText style={styles.addButtonText}>Agregar Item</ThemedText>
                </TouchableOpacity>
              </ThemedView>

              <ThemedView style={styles.sectionContainer}>
                <ThemedText style={styles.sectionTitle}>Calificación general</ThemedText>
                {calificacionGeneral.map((item, index) => renderCalificacionGeneral(item, index))}
              </ThemedView>

              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Firma Aseador</ThemedText>
                {!firmaAseador ? (
                  <TouchableOpacity style={styles.signatureButton} onPress={() => openSignatureModal('aseador')}>
                    <Ionicons name="create-outline" size={24} color="#007AFF" />
                    <ThemedText style={styles.signatureButtonText}>Toca para dibujar la firma</ThemedText>
                  </TouchableOpacity>
                ) : (
                  <ThemedView style={styles.signaturePreviewContainer}>
                    <Image source={{ uri: formatSignatureForDisplay(firmaAseador) || '' }} style={styles.signaturePreview} />
                    <TouchableOpacity style={styles.clearSignatureButton} onPress={() => setFirmaAseador(null)}>
                      <Ionicons name="trash" size={16} color="#FF3B30" />
                      <ThemedText style={styles.clearSignatureButtonText}>Eliminar Firma</ThemedText>
                    </TouchableOpacity>
                  </ThemedView>
                )}
              </ThemedView>

              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Firma Supervisor</ThemedText>
                {!firmaSupervisor ? (
                  <TouchableOpacity style={styles.signatureButton} onPress={() => openSignatureModal('supervisor')}>
                    <Ionicons name="create-outline" size={24} color="#007AFF" />
                    <ThemedText style={styles.signatureButtonText}>Toca para dibujar la firma</ThemedText>
                  </TouchableOpacity>
                ) : (
                  <ThemedView style={styles.signaturePreviewContainer}>
                    <Image source={{ uri: formatSignatureForDisplay(firmaSupervisor) || '' }} style={styles.signaturePreview} />
                    <TouchableOpacity style={styles.clearSignatureButton} onPress={() => setFirmaSupervisor(null)}>
                      <Ionicons name="trash" size={16} color="#FF3B30" />
                      <ThemedText style={styles.clearSignatureButtonText}>Eliminar Firma</ThemedText>
                    </TouchableOpacity>
                  </ThemedView>
                )}
              </ThemedView>

              <ThemedView style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.cancelButton]}
                  onPress={editingReport ? cancelEditing : cancelCreating}
                >
                  {getActionIcon('cancel')}
                  <ThemedText style={styles.actionButtonText}>Cancelar</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.saveButton]}
                  onPress={editingReport ? updateReportHandler : saveReportHandler}
                >
                  {getActionIcon('confirm')}
                  <ThemedText style={styles.actionButtonText}>{editingReport ? 'Actualizar' : 'Guardar'}</ThemedText>
                </TouchableOpacity>
              </ThemedView>
            </ThemedView>
          ) : (
            <ThemedView style={styles.listSection}>
              <TouchableOpacity style={styles.createButton} onPress={startCreating}>
                <Ionicons name="add-circle" size={24} color="#FFFFFF" />
                <ThemedText style={styles.createButtonText}>Crear Nuevo Informe de Supervisión</ThemedText>
              </TouchableOpacity>
              {renderReportList()}
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
                {currentSignatureType === 'aseador' ? 'Firma Aseador' : 'Firma Supervisor'}
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
        currentRoute="SupervisionReport"
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
  itemContainer: {
    marginBottom: 15,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#F5F5F5',
  },
  itemHeaderContent: {
    flex: 1,
    marginRight: 10,
  },
  itemHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  itemHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  removeButton: {
    padding: 4,
  },
  itemContent: {
    padding: 15,
  },
  radioGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  radioCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#007AFF',
  },
  radioInnerCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
  },
  radioLabel: {
    fontSize: 16,
    color: '#000000',
  },
  radioLabelSelected: {
    fontWeight: '600',
    color: '#007AFF',
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

