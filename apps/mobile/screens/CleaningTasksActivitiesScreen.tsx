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
import { Picker } from '@react-native-picker/picker';
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
  createCleaningTasksActivities,
  updateCleaningTasksActivities,
  deleteCleaningTasksActivities,
  listCleaningTasksActivitiesByCorpo,
} from '@/hooks/evaluationFunctions';
import { eventBus } from '@/hooks/eventBus';

type CleaningTasksActivitiesScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'CleaningTasksActivities'>;

interface Actividad {
  nombre: string;
  checkboxes: boolean[]; // Array de 31 elementos (días 1-31)
}

interface SeccionData {
  actividades: { [nombre: string]: boolean[] }; // Mapa de nombre -> checkboxes
  actividadActual: string | null; // Nombre de la actividad actualmente visible
}

interface CleaningTasksActivities {
  id: string;
  id_local: string;
  miscelaneo: string | null;
  area_piso: string | null;
  turno_inicio: string | null;
  turno_fin: string | null;
  mes: string | null;
  supervisor: string | null;
  sucursal: string | null;
  area: string | null;
  cliente: string | null;
  actividades_ejecucion_diaria: string | null;
  actividades_ejecucion_semanal: string | null;
  actividades_quincenales: string | null;
  actividades_mensual: string | null;
  actividades_bimensual: string | null;
  actividades_trimestral: string | null;
  actividades_cuatrimestral: string | null;
  actividades_semestral: string | null;
  actividades_anual: string | null;
  otras_actividades: string | null;
  programa_eventos_especiales: string | null;
  firma_miscelaneo: string | null;
  firma_supervisor: string | null;
  created_at: string;
  synced?: boolean;
}

interface EditingCleaningTasksActivities {
  id: string | null;
  id_local: string;
  miscelaneo: string;
  area_piso: string;
  turno_inicio: string;
  turno_fin: string;
  mes: string;
  supervisor: string;
  sucursal: string;
  area: string;
  cliente: string;
  actividades_ejecucion_diaria: Actividad[];
  actividades_ejecucion_semanal: Actividad[];
  actividades_quincenales: Actividad[];
  actividades_mensual: Actividad[];
  actividades_bimensual: Actividad[];
  actividades_trimestral: Actividad[];
  actividades_cuatrimestral: Actividad[];
  actividades_semestral: Actividad[];
  actividades_anual: Actividad[];
  otras_actividades: Actividad[];
  programa_eventos_especiales: Actividad[];
  firma_miscelaneo: string;
  firma_supervisor: string;
}

const SECCIONES = [
  { key: 'actividades_ejecucion_diaria', label: 'Actividades De Ejecucion Diaria' },
  { key: 'actividades_ejecucion_semanal', label: 'Actividades De Ejecucion Semanal' },
  { key: 'actividades_quincenales', label: 'Actividades Quincenales' },
  { key: 'actividades_mensual', label: 'Actividades Mensual' },
  { key: 'actividades_bimensual', label: 'Actividades Bimensual' },
  { key: 'actividades_trimestral', label: 'Actividades Trimestral' },
  { key: 'actividades_cuatrimestral', label: 'Actividades Cuatrimestral' },
  { key: 'actividades_semestral', label: 'Actividades Semestral' },
  { key: 'actividades_anual', label: 'Actividades Anual' },
  { key: 'otras_actividades', label: 'Otras Actividades' },
  { key: 'programa_eventos_especiales', label: 'Programa de eventos especiales' },
];

const OPCIONES_PREDEFINIDAS: { [key: string]: string[] } = {
  actividades_ejecucion_diaria: [
    'Barrer/aspirar, trapear pisos y superficies para retirar agua, polvo y suciedad',
    'Vaporizar y limpiar sanitarios, lavamanos, pilas, paredes, espejos y azulejos',
    'Desinfectar manijas y picaportes de puertas',
    'Colocar papel higiénico, toallas de papel y jabón de manos en dispensadores en los baños',
    'Limpiar y desinfectar pisos, puertas, botes de basura en todos los cubículos, áreas administrativas, consultorios, baños, lavamanos, salas de reuniones, pasillos, áreas comunes, áreas de comida, entre otros, utilizando diversos implementos de limpieza (escobas, recogedores, trapeadores, fregadores, cepillos, aspiradoras industriales, vaporizadores, escaleras, señalización, etc.)',
    'Desempolvar y limpiar escritorios y mesas utilizando desinfectante y pulidor de superficies',
    'Limpiar/lavar escaleras y desinfectar pasamanos en cada área de trabajo',
    'Recoger y disponer la basura de áreas de comida, baños, pasillos, áreas comunes, perímetro del edificio y áreas de estacionamiento de vehículos, trasladándola a una zona de recolección designada',
    'Recoger y trasladar material reciclable de áreas de comida, oficinas, áreas comunes, etc., a un área de reciclaje designada',
    'Cambiar bolsas plásticas en baños y áreas de comida; cambios de bolsas de oficina según se requiera',
    'Mantener equipos de limpieza en condiciones óptimas',
  ],
  actividades_ejecucion_semanal: [
    'Limpiar muebles de oficina, cocinas, vestíbulos, bodegas y otras áreas comunes, incluyendo persianas, cortinas de comedor y ventiladores',
    'Limpiar/vaporizar paredes y puertas internas y externas, columnas, ventanas (ambos lados) y rejas (exterior e interior)',
    'Lavar y desinfectar techos de edificios contratados, cumpliendo con procedimientos de seguridad, capacitación y equipos',
    'Retirar manchas de pisos y bordes de paredes, y retirar cera u otros residuos adheridos de los pisos',
    'Lavar y desinfectar cualquier área según lo requiera la administración',
    'Lavar el área de recolección de basura y receptáculos semanalmente, manteniéndolos libres de olores, incluyendo limpieza de pisos con detergente y limpieza germicida/bactericida según el Manual de Desinfección del Área de Gestión Ambiental de la CCSS. Cualquier duda sobre gestión de residuos debe coordinarse con la Comisión Local de Gestión Ambiental',
  ],
  actividades_quincenales: [],
  actividades_mensual: [],
  actividades_bimensual: [],
  actividades_trimestral: [
    'Lavar y aspirar alfombras utilizando máquinas especializadas para limpieza profunda',
    'Limpieza especial de techos y lámparas',
  ],
  actividades_cuatrimestral: [
    'Lavar cortinas y persianas según un cronograma establecido',
    'Lavar y limpiar letreros exteriores y sus marcos, asegurándose de no desteñir o destruir el acrílico',
    'Lavar techos, ceniceros, rejas, malla perimetral, aceras internas y externas, bordillos, canaletas internas y externas, y bajantes utilizando suministros y máquinas apropiadas. Se debe presentar un cronograma al gerente del contrato para autorización. Las canaletas y bajantes deben estar limpias y libres de escombros para evacuar adecuadamente el agua de lluvia. El contratista debe tener cuidado de no dañar techos o canaletas para prevenir filtraciones y será responsable de cualquier daño causado',
  ],
  actividades_semestral: [],
  actividades_anual: [],
  otras_actividades: [
    'Lavado de áreas de Cirugía Menor, Inyectables, Cirugía Séptica, Curaciones, camas y camillas, coordinado con el Jefe de Servicio',
    'Reportar fallas de equipos o implementos al coordinador asignado',
    'Entregar llaves y/o dispositivos de seguridad al finalizar las horas contratadas en el espacio administrativo designado',
    'Entregar cualquier artículo, bien o documento encontrado en áreas de trabajo a la administración',
    'Recolección de Residuos: Los residuos comunes de diversas áreas deben recogerse diariamente',
    'Los residuos infeccioso-contagiosos deben recogerse al menos dos veces al día y transportarse a un depósito temporal con las precauciones necesarias para prevenir la contaminación',
    'La recolección en áreas de atención directa al paciente sigue las normas básicas de saneamiento ambiental',
    'Los residuos cortopunzantes se colocan en contenedores específicos',
    'Los residuos infecciosos utilizan bolsas rojas específicas de diferentes tamaños, colocadas donde se maneja dicho material, luego se autoclavan (si se adquiere el equipo, el personal contratado lo realizará según las Normas de Tratamiento de Residuos)',
    'Las bolsas pequeñas se colocan en botes de basura y se retiran cuando están dos tercios llenas, se atan y se depositan en bolsas rojas grandes para disposición final',
    'No se deben dejar residuos en el piso si se rompe una bolsa',
    'Las bolsas rojas deben retirarse al menos dos veces al día, incluso si no están dos tercios llenas',
    'El material reciclable debe almacenarse en un lugar seco para su posterior recolección',
  ],
  programa_eventos_especiales: [
    'El contratista debe presentar un plan para atención inmediata a situaciones como derrames de tuberías, limpieza por reubicación de mobiliario, remodelación de oficinas, limpieza especial de techos, retiro de residuos de alfombras, pulido y recuperación de pisos, y otros eventos que afecten la limpieza de las instalaciones',
  ],
};

const MESES = [
  { label: 'Seleccionar mes', value: '' },
  { label: 'Enero', value: 'Enero' },
  { label: 'Febrero', value: 'Febrero' },
  { label: 'Marzo', value: 'Marzo' },
  { label: 'Abril', value: 'Abril' },
  { label: 'Mayo', value: 'Mayo' },
  { label: 'Junio', value: 'Junio' },
  { label: 'Julio', value: 'Julio' },
  { label: 'Agosto', value: 'Agosto' },
  { label: 'Septiembre', value: 'Septiembre' },
  { label: 'Octubre', value: 'Octubre' },
  { label: 'Noviembre', value: 'Noviembre' },
  { label: 'Diciembre', value: 'Diciembre' },
];

export default function CleaningTasksActivitiesScreen() {
  const { employee, refreshAccessToken, logout } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<CleaningTasksActivitiesScreenNavigationProp>();

  // Data states
  const [records, setRecords] = useState<CleaningTasksActivities[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasCurrentMarca, setHasCurrentMarca] = useState<boolean>(false);

  // Editing state
  const [editingRecord, setEditingRecord] = useState<EditingCleaningTasksActivities | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form states
  const [miscelaneo, setMiscelaneo] = useState('');
  const [areaPiso, setAreaPiso] = useState('');
  const [turnoInicio, setTurnoInicio] = useState('');
  const [turnoFin, setTurnoFin] = useState('');
  const [mes, setMes] = useState('');
  const [supervisor, setSupervisor] = useState('');
  const [sucursal, setSucursal] = useState('');
  const [area, setArea] = useState('');
  const [cliente, setCliente] = useState('');
  const [secciones, setSecciones] = useState<{ [key: string]: SeccionData }>(() => {
    const initial: { [key: string]: SeccionData } = {};
    SECCIONES.forEach(sec => {
      initial[sec.key] = {
        actividades: {},
        actividadActual: null,
      };
    });
    return initial;
  });
  const [firmaMiscelaneo, setFirmaMiscelaneo] = useState<string>('');
  const [firmaSupervisor, setFirmaSupervisor] = useState<string>('');

  // Expanded states
  const [expandedSecciones, setExpandedSecciones] = useState<{ [key: string]: boolean }>(() => {
    const initial: { [key: string]: boolean } = {};
    SECCIONES.forEach(sec => {
      initial[sec.key] = false;
    });
    return initial;
  });

  // Time picker states
  const [showTimePickerInicio, setShowTimePickerInicio] = useState(false);
  const [showTimePickerFin, setShowTimePickerFin] = useState(false);

  // Signature modal states
  const [isSignatureModalVisible, setIsSignatureModalVisible] = useState(false);
  const [currentSignatureType, setCurrentSignatureType] = useState<'miscelaneo' | 'supervisor' | null>(null);
  const signatureRef = useRef<any>(null);
  const [signatureKey, setSignatureKey] = useState(0);
  const [tempSignature, setTempSignature] = useState<string | null>(null);

  // Add option modal states
  const [isAddOptionModalVisible, setIsAddOptionModalVisible] = useState(false);
  const [currentSeccionForNewOption, setCurrentSeccionForNewOption] = useState<string | null>(null);
  const [newOptionText, setNewOptionText] = useState('');

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

  const formatTime = (date: Date): string => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const parseActividades = (jsonString: string | null): { [nombre: string]: boolean[] } => {
    if (!jsonString) return {};
    try {
      const parsed = JSON.parse(jsonString);
      if (!Array.isArray(parsed)) return {};
      const actividadesMap: { [nombre: string]: boolean[] } = {};
      parsed.forEach((act: any) => {
        if (act.nombre) {
          actividadesMap[act.nombre] = Array.isArray(act.checkboxes) && act.checkboxes.length === 31 
            ? act.checkboxes 
            : new Array(31).fill(false);
        }
      });
      return actividadesMap;
    } catch (e) {
      return {};
    }
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
        const result = await listCleaningTasksActivitiesByCorpo({
          corpo_id: corpoId,
          refreshAccessToken,
          logout,
        });

        if (result.status && result.data) {
          setRecords(result.data as CleaningTasksActivities[]);
        } else {
          setRecords([]);
        }
      } else {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const recordsCache = cache.filter((item: any) => item.type === 'cleaning_tasks_activities');
          setRecords(recordsCache);
        } else {
          setRecords([]);
        }
      }
    } catch (err) {
      console.error('Error fetching records:', err);
      setError('Error al cargar los registros de tareas o actividades de limpieza');
      try {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const recordsCache = cache.filter((item: any) => item.type === 'cleaning_tasks_activities');
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
    setMiscelaneo('');
    setAreaPiso('');
    setTurnoInicio('');
    setTurnoFin('');
    setMes('');
    setSupervisor('');
    setSucursal('');
    setArea('');
    setCliente('');
    const initial: { [key: string]: SeccionData } = {};
    SECCIONES.forEach(sec => {
      initial[sec.key] = {
        actividades: {},
        actividadActual: null,
      };
    });
    setSecciones(initial);
    setFirmaMiscelaneo('');
    setFirmaSupervisor('');
    const expandedInitial: { [key: string]: boolean } = {};
    SECCIONES.forEach(sec => {
      expandedInitial[sec.key] = false;
    });
    setExpandedSecciones(expandedInitial);
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

  const startEditing = (record: CleaningTasksActivities) => {
    setIsCreating(false);
    const parsedSecciones: { [key: string]: Actividad[] } = {};
    SECCIONES.forEach(sec => {
      parsedSecciones[sec.key] = parseActividades(record[sec.key as keyof CleaningTasksActivities] as string | null);
    });

    setEditingRecord({
      id: record.id,
      id_local: record.id_local,
      miscelaneo: record.miscelaneo || '',
      area_piso: record.area_piso || '',
      turno_inicio: record.turno_inicio || '',
      turno_fin: record.turno_fin || '',
      mes: record.mes || '',
      supervisor: record.supervisor || '',
      sucursal: record.sucursal || '',
      area: record.area || '',
      cliente: record.cliente || '',
      actividades_ejecucion_diaria: parsedSecciones.actividades_ejecucion_diaria,
      actividades_ejecucion_semanal: parsedSecciones.actividades_ejecucion_semanal,
      actividades_quincenales: parsedSecciones.actividades_quincenales,
      actividades_mensual: parsedSecciones.actividades_mensual,
      actividades_bimensual: parsedSecciones.actividades_bimensual,
      actividades_trimestral: parsedSecciones.actividades_trimestral,
      actividades_cuatrimestral: parsedSecciones.actividades_cuatrimestral,
      actividades_semestral: parsedSecciones.actividades_semestral,
      actividades_anual: parsedSecciones.actividades_anual,
      otras_actividades: parsedSecciones.otras_actividades,
      programa_eventos_especiales: parsedSecciones.programa_eventos_especiales,
      firma_miscelaneo: record.firma_miscelaneo || '',
      firma_supervisor: record.firma_supervisor || '',
    });

    setMiscelaneo(record.miscelaneo || '');
    setAreaPiso(record.area_piso || '');
    setTurnoInicio(record.turno_inicio || '');
    setTurnoFin(record.turno_fin || '');
    setMes(record.mes || '');
    setSupervisor(record.supervisor || '');
    setSucursal(record.sucursal || '');
    setArea(record.area || '');
    setCliente(record.cliente || '');
    setSecciones(parsedSecciones);
    setFirmaMiscelaneo(record.firma_miscelaneo || '');
    setFirmaSupervisor(record.firma_supervisor || '');
  };

  const cancelEditing = () => {
    setEditingRecord(null);
    resetForm();
  };

  const handleTimeChangeInicio = (event: any, selectedTime?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePickerInicio(false);
    }
    if (selectedTime) {
      setTurnoInicio(formatTime(selectedTime));
    }
  };

  const handleTimeChangeFin = (event: any, selectedTime?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePickerFin(false);
    }
    if (selectedTime) {
      setTurnoFin(formatTime(selectedTime));
    }
  };

  const toggleSeccion = (seccionKey: string) => {
    setExpandedSecciones(prev => ({
      ...prev,
      [seccionKey]: !prev[seccionKey],
    }));
  };

  const openAddOptionModal = (seccionKey: string) => {
    setCurrentSeccionForNewOption(seccionKey);
    setNewOptionText('');
    setIsAddOptionModalVisible(true);
  };

  const closeAddOptionModal = () => {
    setIsAddOptionModalVisible(false);
    setCurrentSeccionForNewOption(null);
    setNewOptionText('');
  };

  const confirmAddOption = () => {
    if (!currentSeccionForNewOption || !newOptionText.trim()) {
      Alert.alert('Error', 'Por favor ingresa un nombre para la actividad');
      return;
    }

    const nombreActividad = newOptionText.trim();
    setSecciones(prev => {
      const seccion = prev[currentSeccionForNewOption];
      const newActividades = { ...seccion.actividades };
      // Si la actividad no existe, crearla
      if (!newActividades[nombreActividad]) {
        newActividades[nombreActividad] = new Array(31).fill(false);
      }
      // Establecer como actividad actual
      return {
        ...prev,
        [currentSeccionForNewOption]: {
          actividades: newActividades,
          actividadActual: nombreActividad,
        },
      };
    });
    closeAddOptionModal();
  };

  const handleSelectActividad = (seccionKey: string, selectedValue: string) => {
    if (!selectedValue || selectedValue === '') {
      // Si se selecciona la opción vacía, limpiar la actividad actual
      setSecciones(prev => ({
        ...prev,
        [seccionKey]: {
          ...prev[seccionKey],
          actividadActual: null,
        },
      }));
      return;
    }

    setSecciones(prev => {
      const seccion = prev[seccionKey];
      // Si la actividad no existe, crearla con checkboxes vacíos
      if (!seccion.actividades[selectedValue]) {
        seccion.actividades[selectedValue] = new Array(31).fill(false);
      }
      // Cambiar la actividad actual
      return {
        ...prev,
        [seccionKey]: {
          ...seccion,
          actividadActual: selectedValue,
        },
      };
    });
  };

  const getOpcionesDisponibles = (seccionKey: string): string[] => {
    return OPCIONES_PREDEFINIDAS[seccionKey] || [];
  };

  const getTodasLasOpciones = (seccionKey: string): string[] => {
    const predefinidas = getOpcionesDisponibles(seccionKey);
    const agregadas = Object.keys(secciones[seccionKey].actividades);
    const todas = [...predefinidas, ...agregadas];
    return Array.from(new Set(todas)); // Eliminar duplicados
  };


  const toggleCheckbox = (seccionKey: string, dayIndex: number) => {
    setSecciones(prev => {
      const seccion = prev[seccionKey];
      if (!seccion.actividadActual) return prev;

      const newSecciones = { ...prev };
      const newActividades = { ...seccion.actividades };
      const newCheckboxes = [...newActividades[seccion.actividadActual]];
      newCheckboxes[dayIndex] = !newCheckboxes[dayIndex];
      newActividades[seccion.actividadActual] = newCheckboxes;

      newSecciones[seccionKey] = {
        ...seccion,
        actividades: newActividades,
      };
      return newSecciones;
    });
  };

  const removeActividad = (seccionKey: string) => {
    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas eliminar esta actividad?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            setSecciones(prev => {
              const seccion = prev[seccionKey];
              if (!seccion.actividadActual) return prev;

              const newActividades = { ...seccion.actividades };
              delete newActividades[seccion.actividadActual];

              return {
                ...prev,
                [seccionKey]: {
                  actividades: newActividades,
                  actividadActual: null,
                },
              };
            });
          },
        },
      ]
    );
  };

  const openSignatureModal = (type: 'miscelaneo' | 'supervisor') => {
    setCurrentSignatureType(type);
    setIsSignatureModalVisible(true);
    setTempSignature(null);
    setSignatureKey(prev => prev + 1);
  };

  const closeSignatureModal = () => {
    setIsSignatureModalVisible(false);
    setCurrentSignatureType(null);
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
    if (signature && currentSignatureType) {
      if (currentSignatureType === 'miscelaneo') {
        setFirmaMiscelaneo(signature);
      } else {
        setFirmaSupervisor(signature);
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

  const saveRecordHandler = async () => {
    const currentMarca = await AsyncStorage.getItem('current_marca');
    if (!currentMarca) {
      Alert.alert('Error', 'No se encontró la marca actual');
      return;
    }

    const currentMarcaData = JSON.parse(currentMarca);

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas guardar este registro de tareas o actividades de limpieza?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              // Convertir secciones a formato array para guardar
              const convertirSeccionAArray = (seccionData: SeccionData): Actividad[] => {
                return Object.keys(seccionData.actividades).map(nombre => ({
                  nombre,
                  checkboxes: seccionData.actividades[nombre],
                }));
              };

              const requestData = {
                marca_id: currentMarcaData.id,
                miscelaneo: miscelaneo.trim() || null,
                area_piso: areaPiso.trim() || null,
                turno_inicio: turnoInicio.trim() || null,
                turno_fin: turnoFin.trim() || null,
                mes: mes || null,
                supervisor: supervisor.trim() || null,
                sucursal: sucursal.trim() || null,
                area: area.trim() || null,
                cliente: cliente.trim() || null,
                actividades_ejecucion_diaria: Object.keys(secciones.actividades_ejecucion_diaria.actividades).length > 0 ? JSON.stringify(convertirSeccionAArray(secciones.actividades_ejecucion_diaria)) : null,
                actividades_ejecucion_semanal: Object.keys(secciones.actividades_ejecucion_semanal.actividades).length > 0 ? JSON.stringify(convertirSeccionAArray(secciones.actividades_ejecucion_semanal)) : null,
                actividades_quincenales: Object.keys(secciones.actividades_quincenales.actividades).length > 0 ? JSON.stringify(convertirSeccionAArray(secciones.actividades_quincenales)) : null,
                actividades_mensual: Object.keys(secciones.actividades_mensual.actividades).length > 0 ? JSON.stringify(convertirSeccionAArray(secciones.actividades_mensual)) : null,
                actividades_bimensual: Object.keys(secciones.actividades_bimensual.actividades).length > 0 ? JSON.stringify(convertirSeccionAArray(secciones.actividades_bimensual)) : null,
                actividades_trimestral: Object.keys(secciones.actividades_trimestral.actividades).length > 0 ? JSON.stringify(convertirSeccionAArray(secciones.actividades_trimestral)) : null,
                actividades_cuatrimestral: Object.keys(secciones.actividades_cuatrimestral.actividades).length > 0 ? JSON.stringify(convertirSeccionAArray(secciones.actividades_cuatrimestral)) : null,
                actividades_semestral: Object.keys(secciones.actividades_semestral.actividades).length > 0 ? JSON.stringify(convertirSeccionAArray(secciones.actividades_semestral)) : null,
                actividades_anual: Object.keys(secciones.actividades_anual.actividades).length > 0 ? JSON.stringify(convertirSeccionAArray(secciones.actividades_anual)) : null,
                otras_actividades: Object.keys(secciones.otras_actividades.actividades).length > 0 ? JSON.stringify(convertirSeccionAArray(secciones.otras_actividades)) : null,
                programa_eventos_especiales: Object.keys(secciones.programa_eventos_especiales.actividades).length > 0 ? JSON.stringify(convertirSeccionAArray(secciones.programa_eventos_especiales)) : null,
                firma_miscelaneo: firmaMiscelaneo || null,
                firma_supervisor: firmaSupervisor || null,
              };

              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await createCleaningTasksActivities({
                  requestData,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Registro de tareas o actividades de limpieza guardado correctamente');
                  cancelCreating();
                  fetchRecords();
                } else {
                  Alert.alert('Error', result.message || 'Error al guardar el registro de tareas o actividades de limpieza');
                }
              } else {
                const localId = generateRandomId();

                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: localId,
                  action: 'create',
                  type: 'cleaning_tasks_activities',
                  payload: requestData,
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                const cache = cacheStr ? JSON.parse(cacheStr) : [];

                // Convertir secciones a formato array para guardar
                const convertirSeccionAArray = (seccionData: SeccionData): Actividad[] => {
                  return Object.keys(seccionData.actividades).map(nombre => ({
                    nombre,
                    checkboxes: seccionData.actividades[nombre],
                  }));
                };

                const newRecordCache: CleaningTasksActivities = {
                  id: '',
                  id_local: localId,
                  miscelaneo: miscelaneo.trim() || null,
                  area_piso: areaPiso.trim() || null,
                  turno_inicio: turnoInicio.trim() || null,
                  turno_fin: turnoFin.trim() || null,
                  mes: mes || null,
                  supervisor: supervisor.trim() || null,
                  sucursal: sucursal.trim() || null,
                  area: area.trim() || null,
                  cliente: cliente.trim() || null,
                  actividades_ejecucion_diaria: Object.keys(secciones.actividades_ejecucion_diaria.actividades).length > 0 ? JSON.stringify(convertirSeccionAArray(secciones.actividades_ejecucion_diaria)) : null,
                  actividades_ejecucion_semanal: Object.keys(secciones.actividades_ejecucion_semanal.actividades).length > 0 ? JSON.stringify(convertirSeccionAArray(secciones.actividades_ejecucion_semanal)) : null,
                  actividades_quincenales: Object.keys(secciones.actividades_quincenales.actividades).length > 0 ? JSON.stringify(convertirSeccionAArray(secciones.actividades_quincenales)) : null,
                  actividades_mensual: Object.keys(secciones.actividades_mensual.actividades).length > 0 ? JSON.stringify(convertirSeccionAArray(secciones.actividades_mensual)) : null,
                  actividades_bimensual: Object.keys(secciones.actividades_bimensual.actividades).length > 0 ? JSON.stringify(convertirSeccionAArray(secciones.actividades_bimensual)) : null,
                  actividades_trimestral: Object.keys(secciones.actividades_trimestral.actividades).length > 0 ? JSON.stringify(convertirSeccionAArray(secciones.actividades_trimestral)) : null,
                  actividades_cuatrimestral: Object.keys(secciones.actividades_cuatrimestral.actividades).length > 0 ? JSON.stringify(convertirSeccionAArray(secciones.actividades_cuatrimestral)) : null,
                  actividades_semestral: Object.keys(secciones.actividades_semestral.actividades).length > 0 ? JSON.stringify(convertirSeccionAArray(secciones.actividades_semestral)) : null,
                  actividades_anual: Object.keys(secciones.actividades_anual.actividades).length > 0 ? JSON.stringify(convertirSeccionAArray(secciones.actividades_anual)) : null,
                  otras_actividades: Object.keys(secciones.otras_actividades.actividades).length > 0 ? JSON.stringify(convertirSeccionAArray(secciones.otras_actividades)) : null,
                  programa_eventos_especiales: Object.keys(secciones.programa_eventos_especiales.actividades).length > 0 ? JSON.stringify(convertirSeccionAArray(secciones.programa_eventos_especiales)) : null,
                  firma_miscelaneo: firmaMiscelaneo || null,
                  firma_supervisor: firmaSupervisor || null,
                  created_at: new Date().toISOString(),
                  synced: false,
                };

                cache.push({ ...newRecordCache, type: 'cleaning_tasks_activities' });
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(cache));

                Alert.alert('Modo Offline', 'Registro de tareas o actividades de limpieza registrado localmente. Se sincronizará cuando haya conexión.');
                cancelCreating();
                fetchRecords();
              }
            } catch (err) {
              console.error('Error saving record:', err);
              Alert.alert('Error', 'No se pudo guardar el registro de tareas o actividades de limpieza');
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
      '¿Estás seguro de que deseas actualizar este registro de tareas o actividades de limpieza?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              // Convertir secciones a formato array para guardar
              const convertirSeccionAArray = (seccionData: SeccionData): Actividad[] => {
                return Object.keys(seccionData.actividades).map(nombre => ({
                  nombre,
                  checkboxes: seccionData.actividades[nombre],
                }));
              };

              const requestData = {
                miscelaneo: miscelaneo.trim() || null,
                area_piso: areaPiso.trim() || null,
                turno_inicio: turnoInicio.trim() || null,
                turno_fin: turnoFin.trim() || null,
                mes: mes || null,
                supervisor: supervisor.trim() || null,
                sucursal: sucursal.trim() || null,
                area: area.trim() || null,
                cliente: cliente.trim() || null,
                actividades_ejecucion_diaria: Object.keys(secciones.actividades_ejecucion_diaria.actividades).length > 0 ? JSON.stringify(convertirSeccionAArray(secciones.actividades_ejecucion_diaria)) : null,
                actividades_ejecucion_semanal: Object.keys(secciones.actividades_ejecucion_semanal.actividades).length > 0 ? JSON.stringify(convertirSeccionAArray(secciones.actividades_ejecucion_semanal)) : null,
                actividades_quincenales: Object.keys(secciones.actividades_quincenales.actividades).length > 0 ? JSON.stringify(convertirSeccionAArray(secciones.actividades_quincenales)) : null,
                actividades_mensual: Object.keys(secciones.actividades_mensual.actividades).length > 0 ? JSON.stringify(convertirSeccionAArray(secciones.actividades_mensual)) : null,
                actividades_bimensual: Object.keys(secciones.actividades_bimensual.actividades).length > 0 ? JSON.stringify(convertirSeccionAArray(secciones.actividades_bimensual)) : null,
                actividades_trimestral: Object.keys(secciones.actividades_trimestral.actividades).length > 0 ? JSON.stringify(convertirSeccionAArray(secciones.actividades_trimestral)) : null,
                actividades_cuatrimestral: Object.keys(secciones.actividades_cuatrimestral.actividades).length > 0 ? JSON.stringify(convertirSeccionAArray(secciones.actividades_cuatrimestral)) : null,
                actividades_semestral: Object.keys(secciones.actividades_semestral.actividades).length > 0 ? JSON.stringify(convertirSeccionAArray(secciones.actividades_semestral)) : null,
                actividades_anual: Object.keys(secciones.actividades_anual.actividades).length > 0 ? JSON.stringify(convertirSeccionAArray(secciones.actividades_anual)) : null,
                otras_actividades: Object.keys(secciones.otras_actividades.actividades).length > 0 ? JSON.stringify(convertirSeccionAArray(secciones.otras_actividades)) : null,
                programa_eventos_especiales: Object.keys(secciones.programa_eventos_especiales.actividades).length > 0 ? JSON.stringify(convertirSeccionAArray(secciones.programa_eventos_especiales)) : null,
                firma_miscelaneo: firmaMiscelaneo || null,
                firma_supervisor: firmaSupervisor || null,
              };

              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await updateCleaningTasksActivities({
                  id: recordId,
                  requestData,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Registro de tareas o actividades de limpieza actualizado correctamente');
                  cancelEditing();
                  fetchRecords();
                } else {
                  Alert.alert('Error', result.message || 'Error al actualizar el registro de tareas o actividades de limpieza');
                }
              } else {
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: recordId,
                  action: 'update',
                  type: 'cleaning_tasks_activities',
                  payload: requestData,
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                if (cacheStr) {
                  const cache = JSON.parse(cacheStr);
                  const updatedCache = cache.map((item: any) => {
                    if ((item.id === recordId || item.id_local === recordId) && item.type === 'cleaning_tasks_activities') {
                      // Convertir secciones a formato array para guardar
                      const convertirSeccionAArray = (seccionData: SeccionData): Actividad[] => {
                        return Object.keys(seccionData.actividades).map(nombre => ({
                          nombre,
                          checkboxes: seccionData.actividades[nombre],
                        }));
                      };

                      return {
                        ...item,
                        ...requestData,
                        actividades_ejecucion_diaria: Object.keys(secciones.actividades_ejecucion_diaria.actividades).length > 0 ? JSON.stringify(convertirSeccionAArray(secciones.actividades_ejecucion_diaria)) : null,
                        actividades_ejecucion_semanal: Object.keys(secciones.actividades_ejecucion_semanal.actividades).length > 0 ? JSON.stringify(convertirSeccionAArray(secciones.actividades_ejecucion_semanal)) : null,
                        actividades_quincenales: Object.keys(secciones.actividades_quincenales.actividades).length > 0 ? JSON.stringify(convertirSeccionAArray(secciones.actividades_quincenales)) : null,
                        actividades_mensual: Object.keys(secciones.actividades_mensual.actividades).length > 0 ? JSON.stringify(convertirSeccionAArray(secciones.actividades_mensual)) : null,
                        actividades_bimensual: Object.keys(secciones.actividades_bimensual.actividades).length > 0 ? JSON.stringify(convertirSeccionAArray(secciones.actividades_bimensual)) : null,
                        actividades_trimestral: Object.keys(secciones.actividades_trimestral.actividades).length > 0 ? JSON.stringify(convertirSeccionAArray(secciones.actividades_trimestral)) : null,
                        actividades_cuatrimestral: Object.keys(secciones.actividades_cuatrimestral.actividades).length > 0 ? JSON.stringify(convertirSeccionAArray(secciones.actividades_cuatrimestral)) : null,
                        actividades_semestral: Object.keys(secciones.actividades_semestral.actividades).length > 0 ? JSON.stringify(convertirSeccionAArray(secciones.actividades_semestral)) : null,
                        actividades_anual: Object.keys(secciones.actividades_anual.actividades).length > 0 ? JSON.stringify(convertirSeccionAArray(secciones.actividades_anual)) : null,
                        otras_actividades: Object.keys(secciones.otras_actividades.actividades).length > 0 ? JSON.stringify(convertirSeccionAArray(secciones.otras_actividades)) : null,
                        programa_eventos_especiales: Object.keys(secciones.programa_eventos_especiales.actividades).length > 0 ? JSON.stringify(convertirSeccionAArray(secciones.programa_eventos_especiales)) : null,
                        synced: false,
                      };
                    }
                    return item;
                  });
                  await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                }

                Alert.alert('Modo Offline', 'Registro de tareas o actividades de limpieza actualizado localmente. Se sincronizará cuando haya conexión.');
                cancelEditing();
                fetchRecords();
              }
            } catch (err) {
              console.error('Error updating record:', err);
              Alert.alert('Error', 'No se pudo actualizar el registro de tareas o actividades de limpieza');
            }
          },
        },
      ]
    );
  };

  const deleteRecordHandler = async (record: CleaningTasksActivities) => {
    const recordId = record.id || record.id_local;
    if (!recordId) {
      Alert.alert('Error', 'ID de registro no encontrado para eliminar');
      return;
    }

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas eliminar este registro de tareas o actividades de limpieza?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await deleteCleaningTasksActivities({
                  id: recordId,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Registro de tareas o actividades de limpieza eliminado correctamente');
                  fetchRecords();
                } else {
                  Alert.alert('Error', result.message || 'Error al eliminar el registro de tareas o actividades de limpieza');
                }
              } else {
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: recordId,
                  action: 'delete',
                  type: 'cleaning_tasks_activities',
                  payload: {},
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                if (cacheStr) {
                  const cache = JSON.parse(cacheStr);
                  const updatedCache = cache.filter((item: any) => !((item.id === recordId || item.id_local === recordId) && item.type === 'cleaning_tasks_activities'));
                  await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                }

                Alert.alert('Modo Offline', 'Registro de tareas o actividades de limpieza marcado para eliminación localmente. Se sincronizará cuando haya conexión.');
                fetchRecords();
              }
            } catch (err) {
              console.error('Error deleting record:', err);
              Alert.alert('Error', 'No se pudo eliminar el registro de tareas o actividades de limpieza');
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
      case 'record': return <Ionicons name="clipboard" size={24} color='#000000' />;
      case 'add': return <Ionicons name="add" size={24} color='#FFFFFF' />;
      case 'cancel': return <Ionicons name="close" size={24} color='#FFFFFF' />;
      case 'confirm': return <Ionicons name="checkmark" size={24} color='#FFFFFF' />;
      case 'delete': return <Ionicons name="trash" size={24} color='#FFFFFF' />;
      case 'edit': return <Ionicons name="pencil" size={20} color="#FFFFFF" />;
      default: return <Ionicons name="clipboard" size={24} color='#000000' />;
    }
  };

  const renderRecordList = () => {
    if (isLoading) {
      return (
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Cargando registros de tareas o actividades de limpieza...</ThemedText>
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
          <ThemedText style={styles.emptyText}>No hay registros de tareas o actividades de limpieza registrados.</ThemedText>
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
                  {record.miscelaneo || 'Sin misceláneo'}
                </ThemedText>
                <ThemedText style={styles.listItemSubtitle}>
                  Mes: {record.mes || 'N/A'} | Supervisor: {record.supervisor || 'N/A'}
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
              <ThemedText style={styles.detailText}>
                <ThemedText style={styles.detailLabel}>Misceláneo: </ThemedText>
                {record.miscelaneo || 'No especificado'}
              </ThemedText>
              <ThemedText style={styles.detailText}>
                <ThemedText style={styles.detailLabel}>Área/Piso: </ThemedText>
                {record.area_piso || 'No especificado'}
              </ThemedText>
              <ThemedText style={styles.detailText}>
                <ThemedText style={styles.detailLabel}>Turno: </ThemedText>
                {record.turno_inicio || 'N/A'} - {record.turno_fin || 'N/A'}
              </ThemedText>
              <ThemedText style={styles.detailText}>
                <ThemedText style={styles.detailLabel}>Mes: </ThemedText>
                {record.mes || 'No especificado'}
              </ThemedText>
              <ThemedText style={styles.detailText}>
                <ThemedText style={styles.detailLabel}>Supervisor: </ThemedText>
                {record.supervisor || 'No especificado'}
              </ThemedText>
              <ThemedText style={styles.detailText}>
                <ThemedText style={styles.detailLabel}>Fecha de registro: </ThemedText>
                {new Date(record.created_at).toLocaleDateString('es-CR')}
              </ThemedText>

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

  const renderSeccion = (seccion: typeof SECCIONES[0]) => {
    const seccionData = secciones[seccion.key];
    const isExpanded = expandedSecciones[seccion.key];
    const todasLasOpciones = getTodasLasOpciones(seccion.key);
    const actividadActual = seccionData.actividadActual;
    const checkboxesActuales = actividadActual ? seccionData.actividades[actividadActual] : null;

    return (
      <ThemedView key={seccion.key} style={styles.seccionContainer}>
        <TouchableOpacity
          style={styles.seccionHeader}
          onPress={() => toggleSeccion(seccion.key)}
        >
          <ThemedText style={styles.seccionHeaderText}>{seccion.label}</ThemedText>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={24}
            color="#FFFFFF"
          />
        </TouchableOpacity>

        {isExpanded && (
          <ThemedView style={styles.seccionContent}>
            {/* Select para seleccionar/cambiar actividad */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Seleccionar Actividad</ThemedText>
              <ThemedView style={styles.pickerContainer}>
                <Picker
                  selectedValue={actividadActual || ''}
                  onValueChange={(value) => handleSelectActividad(seccion.key, value)}
                  style={styles.picker}
                >
                  <Picker.Item label="Seleccionar actividad" value="" />
                  {todasLasOpciones.map((opcion, i) => (
                    <Picker.Item key={i} label={opcion} value={opcion} />
                  ))}
                </Picker>
              </ThemedView>
            </ThemedView>

            {/* Botón para agregar nueva opción personalizada */}
            <TouchableOpacity
              style={styles.addNewOptionButton}
              onPress={() => openAddOptionModal(seccion.key)}
            >
              <Ionicons name="create" size={24} color="#1976D2" />
              <ThemedText style={styles.addNewOptionButtonText}>Agregar Nueva Opción Personalizada</ThemedText>
            </TouchableOpacity>

            {/* Mostrar actividad actual con sus checkboxes */}
            {actividadActual && checkboxesActuales && (
              <ThemedView style={styles.actividadItem}>
                <ThemedView style={styles.actividadHeader}>
                  <ThemedText style={styles.actividadNombre}>{actividadActual}</ThemedText>
                  <TouchableOpacity
                    style={styles.removeActividadButton}
                    onPress={() => removeActividad(seccion.key)}
                  >
                    <Ionicons name="trash" size={20} color="#FF3B30" />
                  </TouchableOpacity>
                </ThemedView>

                <ThemedView style={styles.checkboxesContainer}>
                  <ThemedView style={styles.checkboxesGrid}>
                    {checkboxesActuales.map((checked, dayIndex) => (
                      <TouchableOpacity
                        key={dayIndex}
                        style={styles.checkboxItem}
                        onPress={() => toggleCheckbox(seccion.key, dayIndex)}
                      >
                        <View style={styles.checkbox}>
                          {checked && (
                            <Ionicons name="checkmark" size={16} color="#FF9500" />
                          )}
                        </View>
                        <ThemedText style={styles.checkboxLabel}>{dayIndex + 1}</ThemedText>
                      </TouchableOpacity>
                    ))}
                  </ThemedView>
                </ThemedView>
              </ThemedView>
            )}
          </ThemedView>
        )}
      </ThemedView>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <AppHeader onMenuPress={handleMenuPress} title="Registro de Tareas o Actividades de Limpieza" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <ThemedView style={styles.contentContainer}>
          <ThemedText type="title" style={styles.screenTitle}>
            {getActionIcon('record')} Registro de Tareas o Actividades de Limpieza
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
              {/* Misceláneo */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Misceláneo</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Misceláneo"
                  placeholderTextColor="#999"
                  value={miscelaneo}
                  onChangeText={setMiscelaneo}
                />
              </ThemedView>

              {/* Area/Piso */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Area/Piso</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Area/Piso"
                  placeholderTextColor="#999"
                  value={areaPiso}
                  onChangeText={setAreaPiso}
                />
              </ThemedView>

              {/* Turno Inicio */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Turno Inicio</ThemedText>
                <TouchableOpacity
                  style={styles.timeButton}
                  onPress={() => setShowTimePickerInicio(true)}
                >
                  <ThemedText style={styles.timeButtonText}>
                    {turnoInicio || 'Seleccionar hora'}
                  </ThemedText>
                  <Ionicons name="time" size={20} color="#007AFF" />
                </TouchableOpacity>
                {showTimePickerInicio && (
                  <DateTimePicker
                    value={turnoInicio ? new Date(`2000-01-01T${turnoInicio}:00`) : new Date()}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleTimeChangeInicio}
                  />
                )}
              </ThemedView>

              {/* Turno Fin */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Turno Fin</ThemedText>
                <TouchableOpacity
                  style={styles.timeButton}
                  onPress={() => setShowTimePickerFin(true)}
                >
                  <ThemedText style={styles.timeButtonText}>
                    {turnoFin || 'Seleccionar hora'}
                  </ThemedText>
                  <Ionicons name="time" size={20} color="#007AFF" />
                </TouchableOpacity>
                {showTimePickerFin && (
                  <DateTimePicker
                    value={turnoFin ? new Date(`2000-01-01T${turnoFin}:00`) : new Date()}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleTimeChangeFin}
                  />
                )}
              </ThemedView>

              {/* Mes */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Mes</ThemedText>
                <ThemedView style={styles.pickerContainer}>
                  <Picker
                    selectedValue={mes}
                    onValueChange={setMes}
                    style={styles.picker}
                  >
                    {MESES.map((mesOption) => (
                      <Picker.Item
                        key={mesOption.value}
                        label={mesOption.label}
                        value={mesOption.value}
                      />
                    ))}
                  </Picker>
                </ThemedView>
              </ThemedView>

              {/* Supervisor */}
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

              {/* Sucursal */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Sucursal</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Sucursal"
                  placeholderTextColor="#999"
                  value={sucursal}
                  onChangeText={setSucursal}
                />
              </ThemedView>

              {/* Área */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Área</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Área"
                  placeholderTextColor="#999"
                  value={area}
                  onChangeText={setArea}
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

              {/* Secciones */}
              {SECCIONES.map(seccion => renderSeccion(seccion))}

              {/* Firma del misceláneo */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Firma del misceláneo</ThemedText>
                {firmaMiscelaneo && (
                  <ThemedView style={styles.signaturePreviewContainer}>
                    <Image
                      source={{
                        uri: firmaMiscelaneo.startsWith('data:')
                          ? firmaMiscelaneo
                          : `data:image/png;base64,${firmaMiscelaneo}`
                      }}
                      style={styles.signaturePreview}
                    />
                  </ThemedView>
                )}
                <TouchableOpacity
                  style={styles.signatureButton}
                  onPress={() => openSignatureModal('miscelaneo')}
                >
                  <Ionicons name="create" size={20} color="#007AFF" />
                  <ThemedText style={styles.signatureButtonText}>
                    {firmaMiscelaneo ? 'Cambiar Firma' : 'Agregar Firma'}
                  </ThemedText>
                </TouchableOpacity>
              </ThemedView>

              {/* Firma del supervisor */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Firma del supervisor</ThemedText>
                {firmaSupervisor && (
                  <ThemedView style={styles.signaturePreviewContainer}>
                    <Image
                      source={{
                        uri: firmaSupervisor.startsWith('data:')
                          ? firmaSupervisor
                          : `data:image/png;base64,${firmaSupervisor}`
                      }}
                      style={styles.signaturePreview}
                    />
                  </ThemedView>
                )}
                <TouchableOpacity
                  style={styles.signatureButton}
                  onPress={() => openSignatureModal('supervisor')}
                >
                  <Ionicons name="create" size={20} color="#007AFF" />
                  <ThemedText style={styles.signatureButtonText}>
                    {firmaSupervisor ? 'Cambiar Firma' : 'Agregar Firma'}
                  </ThemedText>
                </TouchableOpacity>
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
                <ThemedText style={styles.createButtonText}>Crear Nuevo Registro</ThemedText>
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

      {/* Add Option Modal */}
      <Modal
        visible={isAddOptionModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={closeAddOptionModal}
      >
        <ThemedView style={styles.modalOverlay}>
          <ThemedView style={styles.modalContainer}>
            <ThemedView style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Agregar Nueva Actividad</ThemedText>
              <TouchableOpacity onPress={closeAddOptionModal}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </ThemedView>

            <ThemedView style={styles.modalContent}>
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Nombre de la actividad</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Ingresa el nombre de la actividad"
                  placeholderTextColor="#999"
                  value={newOptionText}
                  onChangeText={setNewOptionText}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </ThemedView>
            </ThemedView>

            <ThemedView style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={closeAddOptionModal}
              >
                <ThemedText style={styles.modalCancelButtonText}>Cancelar</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirmButton]}
                onPress={confirmAddOption}
              >
                <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                <ThemedText style={styles.modalConfirmButtonText}>Confirmar</ThemedText>
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
        currentRoute="CleaningTasksActivities"
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
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#F9F9F9',
  },
  timeButtonText: {
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
  seccionContainer: {
    marginTop: 15,
    marginBottom: 15,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  seccionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#1976D2',
  },
  seccionHeaderText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  seccionContent: {
    padding: 15,
    backgroundColor: '#FFFFFF',
  },
  actividadItem: {
    marginBottom: 15,
    padding: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  actividadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  removeActividadButton: {
    padding: 4,
  },
  checkboxesContainer: {
    marginTop: 10,
  },
  checkboxesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  checkboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '12%',
    marginBottom: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#FF9500',
    borderRadius: 4,
    marginRight: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxLabel: {
    fontSize: 12,
    color: '#000000',
  },
  addNewOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    marginBottom: 15,
    gap: 8,
  },
  addNewOptionButtonText: {
    color: '#1976D2',
    fontSize: 14,
    fontWeight: '600',
  },
  actividadNombre: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
    marginRight: 10,
  },
  signatureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    marginTop: 10,
    gap: 8,
  },
  signatureButtonText: {
    color: '#1976D2',
    fontSize: 14,
    fontWeight: '600',
  },
  signaturePreviewContainer: {
    marginBottom: 10,
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
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  modalSignatureContainer: {
    width: '100%',
    height: 300,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalClearButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    gap: 8,
  },
  modalClearButtonText: {
    color: '#D32F2F',
    fontSize: 14,
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
    fontSize: 14,
    fontWeight: '600',
  },
  modalContent: {
    marginBottom: 20,
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  modalCancelButton: {
    backgroundColor: '#FFEBEE',
  },
  modalCancelButtonText: {
    color: '#D32F2F',
    fontSize: 14,
    fontWeight: '600',
  },
  modalConfirmButton: {
    backgroundColor: '#4CAF50',
  },
  modalConfirmButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

