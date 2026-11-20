import React, { useState, useCallback } from 'react';
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
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
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
  createImprovementActionsControl,
  updateImprovementActionsControl,
  deleteImprovementActionsControl,
  listImprovementActionsControlByCorpo,
} from '@/hooks/evaluationFunctions';
import { eventBus } from '@/hooks/eventBus';

type ImprovementActionsControlScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ImprovementActionsControl'>;

interface ImprovementActionsControl {
  id: string;
  id_local: string;
  numero_accion: string | null;
  causa_origen: string | null;
  fecha_deteccion_incidencia: string | null;
  mes_deteccion: string | null;
  tipo_accion: string | null;
  proceso_relacionado: string | null;
  encargado_proceso: string | null;
  origen_accion: string | null;
  fecha_elaboracion_plan: string | null;
  tiempo_plan_vs_deteccion: string | null;
  plan_elaborado_a_tiempo: string | null;
  detalle_nc_opr_dm: string | null;
  analisis_causas: string | null;
  accion_inmediata: string | null;
  accion_mejora: string | null;
  fecha_aprobacion: string | null;
  responsable_ejecucion: string | null;
  fecha_programada_ejecucion: string | null;
  fecha_real_ejecucion: string | null;
  mes_ejecucion: string | null;
  modif_fecha_ejecucion_motivo: string | null;
  aplica_seguimiento: string | null;
  seguimiento_meses: string | null;
  evidencias: string | null;
  estado_accion: string | null;
  a_tiempo: string | null;
  no_conformidades_similares: string | null;
  reincidencia: string | null;
  actualiza_matriz_riesgos: string | null;
  efectividad: string | null;
  no_efectiva: string | null;
  cambiar_al_8d: string | null;
  cerrada: string | null;
  dueño_proceso: string | null;
  created_at: string;
  synced?: boolean;
}

interface EditingImprovementActionsControl {
  id: string | null;
  id_local: string;
  numero_accion: string;
  causa_origen: string;
  fecha_deteccion_incidencia: string;
  mes_deteccion: string;
  tipo_accion: string;
  proceso_relacionado: string;
  encargado_proceso: string;
  origen_accion: string;
  fecha_elaboracion_plan: string;
  tiempo_plan_vs_deteccion: string;
  plan_elaborado_a_tiempo: string;
  detalle_nc_opr_dm: string;
  analisis_causas: string;
  accion_inmediata: string;
  accion_mejora: string;
  fecha_aprobacion: string;
  responsable_ejecucion: string;
  fecha_programada_ejecucion: string;
  fecha_real_ejecucion: string;
  mes_ejecucion: string;
  modif_fecha_ejecucion_motivo: string;
  aplica_seguimiento: string;
  seguimiento_meses: string;
  evidencias: string;
  estado_accion: string;
  a_tiempo: string;
  no_conformidades_similares: string;
  reincidencia: string;
  actualiza_matriz_riesgos: string;
  efectividad: string;
  no_efectiva: string;
  cambiar_al_8d: string;
  cerrada: string;
  dueño_proceso: string;
}

interface ProcesoRelacionado {
  proceso: string;
}

const TIPO_ACCION_OPTIONS = [
  { label: 'Seleccionar tipo', value: '' },
  { label: 'Corrección', value: 'Corrección' },
  { label: 'Correctiva', value: 'Correctiva' },
  { label: 'Mejora Continua', value: 'Mejora Continua' },
];

const PROCESO_RELACIONADO_OPTIONS = [
  'AUD',
  'AYL',
  'COM',
  'ESC',
  'FCO',
  'GAM',
  'GCO',
  'GDO',
  'LOG',
  'MEC',
  'MEN',
  'MEQ',
  'MIN',
  'MIT',
  'PCG',
  'PNC',
  'PRV',
  'RGO',
  'RRHH',
  'SEG',
  'SMP',
  'OTRO',
];

const ORIGEN_ACCION_OPTIONS = [
  { label: 'Seleccionar origen', value: '' },
  { label: 'Auditorías de Calidad', value: 'Auditorías de Calidad' },
  { label: 'Quejas o reclamos', value: 'Quejas o reclamos' },
  { label: 'Ideas de colaboradores', value: 'Ideas de colaboradores' },
  { label: 'Revisión por la dirección', value: 'Revisión por la dirección' },
  { label: 'Encuesta de Clientes', value: 'Encuesta de Clientes' },
  { label: 'Control de Producto No Conforme', value: 'Control de Producto No Conforme' },
  { label: 'Resultados de Indicadores', value: 'Resultados de Indicadores' },
  { label: 'Encuesta de Clima Laboral', value: 'Encuesta de Clima Laboral' },
];

const CLASIF_NC_OPTIONS = [
  { label: 'Seleccionar clasificación', value: '' },
  { label: 'NC (NO CONFORMIDAD)', value: 'NC' },
  { label: 'OBS (OBSERVACION)', value: 'OBS' },
  { label: 'CO (CORRECCION)', value: 'CO' },
  { label: 'OM (OPORTUNIDAD DE MEJORA)', value: 'OM' },
];

const MESES = [
  { label: 'NOV', value: 'NOV' },
  { label: 'DIC', value: 'DIC' },
  { label: 'ENE', value: 'ENE' },
  { label: 'FEB', value: 'FEB' },
  { label: 'MAR', value: 'MAR' },
  { label: 'ABR', value: 'ABR' },
  { label: 'MAY', value: 'MAY' },
  { label: 'JUN', value: 'JUN' },
  { label: 'JUL', value: 'JUL' },
  { label: 'AGO', value: 'AGO' },
  { label: 'SET', value: 'SET' },
  { label: 'OCT', value: 'OCT' },
];

export default function ImprovementActionsControlScreen() {
  const { employee, refreshAccessToken, logout } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<ImprovementActionsControlScreenNavigationProp>();

  // Data states
  const [controls, setControls] = useState<ImprovementActionsControl[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasCurrentMarca, setHasCurrentMarca] = useState<boolean>(false);

  // Editing state
  const [isCreating, setIsCreating] = useState(false);
  const [editingControl, setEditingControl] = useState<EditingImprovementActionsControl | null>(null);

  // Form fields
  const [numeroAccion, setNumeroAccion] = useState('');
  const [causaOrigen, setCausaOrigen] = useState('');
  const [fechaDeteccion, setFechaDeteccion] = useState(new Date());
  const [showFechaDeteccionPicker, setShowFechaDeteccionPicker] = useState(false);
  const [mesDeteccion, setMesDeteccion] = useState('');
  const [tipoAccion, setTipoAccion] = useState('');
  const [procesoRelacionado, setProcesoRelacionado] = useState<ProcesoRelacionado[]>([]);
  const [encargadoProceso, setEncargadoProceso] = useState('');
  const [origenAccion, setOrigenAccion] = useState('');
  const [fechaElaboracionPlan, setFechaElaboracionPlan] = useState(new Date());
  const [showFechaElaboracionPlanPicker, setShowFechaElaboracionPlanPicker] = useState(false);
  const [tiempoPlanVsDeteccion, setTiempoPlanVsDeteccion] = useState('');
  const [planElaboradoATiempo, setPlanElaboradoATiempo] = useState('');
  const [detalleNcOprDm, setDetalleNcOprDm] = useState('');
  const [analisisCausas, setAnalisisCausas] = useState('');
  const [accionInmediata, setAccionInmediata] = useState('');
  const [accionMejora, setAccionMejora] = useState('');
  const [fechaAprobacion, setFechaAprobacion] = useState(new Date());
  const [showFechaAprobacionPicker, setShowFechaAprobacionPicker] = useState(false);
  const [responsableEjecucion, setResponsableEjecucion] = useState('');
  const [fechaProgramadaEjecucion, setFechaProgramadaEjecucion] = useState(new Date());
  const [showFechaProgramadaEjecucionPicker, setShowFechaProgramadaEjecucionPicker] = useState(false);
  const [fechaRealEjecucion, setFechaRealEjecucion] = useState(new Date());
  const [showFechaRealEjecucionPicker, setShowFechaRealEjecucionPicker] = useState(false);
  const [mesEjecucion, setMesEjecucion] = useState('');
  const [modifFechaEjecucionMotivo, setModifFechaEjecucionMotivo] = useState('');
  const [aplicaSeguimiento, setAplicaSeguimiento] = useState('');
  const [seguimientoMeses, setSeguimientoMeses] = useState<string[]>([]);
  const [evidencias, setEvidencias] = useState('');
  const [estadoAccion, setEstadoAccion] = useState('');
  const [aTiempo, setATiempo] = useState('');
  const [noConformidadesSimilares, setNoConformidadesSimilares] = useState('');
  const [reincidencia, setReincidencia] = useState('');
  const [actualizaMatrizRiesgos, setActualizaMatrizRiesgos] = useState('');
  const [efectividad, setEfectividad] = useState('');
  const [noEfectiva, setNoEfectiva] = useState('');
  const [cambiarAl8d, setCambiarAl8d] = useState('');
  const [cerrada, setCerrada] = useState('');
  const [dueñoProceso, setDueñoProceso] = useState('');

  // Expandable states
  const [expandedProcesoIndices, setExpandedProcesoIndices] = useState<number[]>([]);
  const [showAddProcesoModal, setShowAddProcesoModal] = useState(false);
  const [newProcesoValue, setNewProcesoValue] = useState('');

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

  const getMonthName = (date: Date): string => {
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];
    return months[date.getMonth()];
  };

  const fetchControls = useCallback(async () => {
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
        const result = await listImprovementActionsControlByCorpo({
          corpo_id: corpoId,
          refreshAccessToken,
          logout,
        });

        if (result.status && result.data) {
          setControls(result.data as ImprovementActionsControl[]);
        } else {
          setControls([]);
        }
      } else {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const controlsCache = cache.filter((item: any) => item.type === 'improvement_actions_control');
          setControls(controlsCache);
        } else {
          setControls([]);
        }
      }
    } catch (err) {
      console.error('Error fetching controls:', err);
      setError('Error al cargar los controles de acciones de mejora');
      try {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const controlsCache = cache.filter((item: any) => item.type === 'improvement_actions_control');
          setControls(controlsCache);
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
      fetchControls();
      eventBus.on('connectionRestored', fetchControls);
      return () => {
        eventBus.off('connectionRestored', fetchControls);
      };
    }, [fetchControls])
  );

  const resetForm = () => {
    setNumeroAccion('');
    setCausaOrigen('');
    setFechaDeteccion(new Date());
    setMesDeteccion('');
    setTipoAccion('');
    setProcesoRelacionado([]);
    setEncargadoProceso('');
    setOrigenAccion('');
    setFechaElaboracionPlan(new Date());
    setTiempoPlanVsDeteccion('');
    setPlanElaboradoATiempo('');
    setDetalleNcOprDm('');
    setAnalisisCausas('');
    setAccionInmediata('');
    setAccionMejora('');
    setFechaAprobacion(new Date());
    setResponsableEjecucion('');
    setFechaProgramadaEjecucion(new Date());
    setFechaRealEjecucion(new Date());
    setMesEjecucion('');
    setModifFechaEjecucionMotivo('');
    setAplicaSeguimiento('');
    setSeguimientoMeses([]);
    setEvidencias('');
    setEstadoAccion('');
    setATiempo('');
    setNoConformidadesSimilares('');
    setReincidencia('');
    setActualizaMatrizRiesgos('');
    setEfectividad('');
    setNoEfectiva('');
    setCambiarAl8d('');
    setCerrada('');
    setDueñoProceso('');
  };

  const startCreating = () => {
    setIsCreating(true);
    setEditingControl(null);
    resetForm();
  };

  const cancelCreating = () => {
    setIsCreating(false);
    resetForm();
  };

  const startEditing = (control: ImprovementActionsControl) => {
    setIsCreating(false);
    setEditingControl({
      id: control.id,
      id_local: control.id_local,
      numero_accion: control.numero_accion || '',
      causa_origen: control.causa_origen || '',
      fecha_deteccion_incidencia: control.fecha_deteccion_incidencia || '',
      mes_deteccion: control.mes_deteccion || '',
      tipo_accion: control.tipo_accion || '',
      proceso_relacionado: control.proceso_relacionado || '',
      encargado_proceso: control.encargado_proceso || '',
      origen_accion: control.origen_accion || '',
      fecha_elaboracion_plan: control.fecha_elaboracion_plan || '',
      tiempo_plan_vs_deteccion: control.tiempo_plan_vs_deteccion || '',
      plan_elaborado_a_tiempo: control.plan_elaborado_a_tiempo || '',
      detalle_nc_opr_dm: control.detalle_nc_opr_dm || '',
      analisis_causas: control.analisis_causas || '',
      accion_inmediata: control.accion_inmediata || '',
      accion_mejora: control.accion_mejora || '',
      fecha_aprobacion: control.fecha_aprobacion || '',
      responsable_ejecucion: control.responsable_ejecucion || '',
      fecha_programada_ejecucion: control.fecha_programada_ejecucion || '',
      fecha_real_ejecucion: control.fecha_real_ejecucion || '',
      mes_ejecucion: control.mes_ejecucion || '',
      modif_fecha_ejecucion_motivo: control.modif_fecha_ejecucion_motivo || '',
      aplica_seguimiento: control.aplica_seguimiento || '',
      seguimiento_meses: control.seguimiento_meses || '',
      evidencias: control.evidencias || '',
      estado_accion: control.estado_accion || '',
      a_tiempo: control.a_tiempo || '',
      no_conformidades_similares: control.no_conformidades_similares || '',
      reincidencia: control.reincidencia || '',
      actualiza_matriz_riesgos: control.actualiza_matriz_riesgos || '',
      efectividad: control.efectividad || '',
      no_efectiva: control.no_efectiva || '',
      cambiar_al_8d: control.cambiar_al_8d || '',
      cerrada: control.cerrada || '',
      dueño_proceso: control.dueño_proceso || '',
    });

    setNumeroAccion(control.numero_accion || '');
    setCausaOrigen(control.causa_origen || '');
    if (control.fecha_deteccion_incidencia) {
      const dateParts = control.fecha_deteccion_incidencia.split('/');
      if (dateParts.length === 3) {
        setFechaDeteccion(new Date(parseInt(dateParts[2]), parseInt(dateParts[1]) - 1, parseInt(dateParts[0])));
        setMesDeteccion(getMonthName(new Date(parseInt(dateParts[2]), parseInt(dateParts[1]) - 1, parseInt(dateParts[0]))));
      }
    }
    setTipoAccion(control.tipo_accion || '');
    if (control.proceso_relacionado) {
      try {
        const procesos = JSON.parse(control.proceso_relacionado);
        setProcesoRelacionado(Array.isArray(procesos) ? procesos : []);
      } catch {
        setProcesoRelacionado([]);
      }
    } else {
      setProcesoRelacionado([]);
    }
    setEncargadoProceso(control.encargado_proceso || '');
    setOrigenAccion(control.origen_accion || '');
    if (control.fecha_elaboracion_plan) {
      const dateParts = control.fecha_elaboracion_plan.split('/');
      if (dateParts.length === 3) {
        setFechaElaboracionPlan(new Date(parseInt(dateParts[2]), parseInt(dateParts[1]) - 1, parseInt(dateParts[0])));
      }
    }
    setTiempoPlanVsDeteccion(control.tiempo_plan_vs_deteccion || '');
    setPlanElaboradoATiempo(control.plan_elaborado_a_tiempo || '');
    setDetalleNcOprDm(control.detalle_nc_opr_dm || '');
    setAnalisisCausas(control.analisis_causas || '');
    setAccionInmediata(control.accion_inmediata || '');
    setAccionMejora(control.accion_mejora || '');
    if (control.fecha_aprobacion) {
      const dateParts = control.fecha_aprobacion.split('/');
      if (dateParts.length === 3) {
        setFechaAprobacion(new Date(parseInt(dateParts[2]), parseInt(dateParts[1]) - 1, parseInt(dateParts[0])));
      }
    }
    setResponsableEjecucion(control.responsable_ejecucion || '');
    if (control.fecha_programada_ejecucion) {
      const dateParts = control.fecha_programada_ejecucion.split('/');
      if (dateParts.length === 3) {
        setFechaProgramadaEjecucion(new Date(parseInt(dateParts[2]), parseInt(dateParts[1]) - 1, parseInt(dateParts[0])));
      }
    }
    if (control.fecha_real_ejecucion) {
      const dateParts = control.fecha_real_ejecucion.split('/');
      if (dateParts.length === 3) {
        setFechaRealEjecucion(new Date(parseInt(dateParts[2]), parseInt(dateParts[1]) - 1, parseInt(dateParts[0])));
        setMesEjecucion(getMonthName(new Date(parseInt(dateParts[2]), parseInt(dateParts[1]) - 1, parseInt(dateParts[0]))));
      }
    }
    setModifFechaEjecucionMotivo(control.modif_fecha_ejecucion_motivo || '');
    setAplicaSeguimiento(control.aplica_seguimiento || '');
    if (control.seguimiento_meses) {
      try {
        const meses = JSON.parse(control.seguimiento_meses);
        setSeguimientoMeses(Array.isArray(meses) ? meses : []);
      } catch {
        setSeguimientoMeses([]);
      }
    } else {
      setSeguimientoMeses([]);
    }
    setEvidencias(control.evidencias || '');
    setEstadoAccion(control.estado_accion || '');
    setATiempo(control.a_tiempo || '');
    setNoConformidadesSimilares(control.no_conformidades_similares || '');
    setReincidencia(control.reincidencia || '');
    setActualizaMatrizRiesgos(control.actualiza_matriz_riesgos || '');
    setEfectividad(control.efectividad || '');
    setNoEfectiva(control.no_efectiva || '');
    setCambiarAl8d(control.cambiar_al_8d || '');
    setCerrada(control.cerrada || '');
    setDueñoProceso(control.dueño_proceso || '');
  };

  const cancelEditing = () => {
    setEditingControl(null);
    resetForm();
  };

  const handleDateChange = (event: any, selectedDate: Date | undefined, type: string) => {
    if (Platform.OS === 'android') {
      if (type === 'deteccion') setShowFechaDeteccionPicker(false);
      if (type === 'elaboracion') setShowFechaElaboracionPlanPicker(false);
      if (type === 'aprobacion') setShowFechaAprobacionPicker(false);
      if (type === 'programada') setShowFechaProgramadaEjecucionPicker(false);
      if (type === 'real') setShowFechaRealEjecucionPicker(false);
    }
    if (selectedDate) {
      if (type === 'deteccion') {
        setFechaDeteccion(selectedDate);
        setMesDeteccion(getMonthName(selectedDate));
      }
      if (type === 'elaboracion') setFechaElaboracionPlan(selectedDate);
      if (type === 'aprobacion') setFechaAprobacion(selectedDate);
      if (type === 'programada') setFechaProgramadaEjecucion(selectedDate);
      if (type === 'real') {
        setFechaRealEjecucion(selectedDate);
        setMesEjecucion(getMonthName(selectedDate));
      }
    }
  };

  const toggleProcesoExpansion = (index: number) => {
    if (expandedProcesoIndices.includes(index)) {
      setExpandedProcesoIndices(expandedProcesoIndices.filter(i => i !== index));
    } else {
      setExpandedProcesoIndices([...expandedProcesoIndices, index]);
    }
  };

  const addProceso = () => {
    if (newProcesoValue.trim()) {
      setProcesoRelacionado([...procesoRelacionado, { proceso: newProcesoValue.trim() }]);
      setNewProcesoValue('');
      setShowAddProcesoModal(false);
    }
  };

  const removeProceso = (index: number) => {
    setProcesoRelacionado(procesoRelacionado.filter((_, i) => i !== index));
  };

  const updateProceso = (index: number, value: string) => {
    const updated = [...procesoRelacionado];
    updated[index].proceso = value;
    setProcesoRelacionado(updated);
  };

  const toggleSeguimientoMes = (mes: string) => {
    if (seguimientoMeses.includes(mes)) {
      setSeguimientoMeses(seguimientoMeses.filter(m => m !== mes));
    } else {
      setSeguimientoMeses([...seguimientoMeses, mes]);
    }
  };

  const saveControlHandler = async () => {
    const currentMarca = await AsyncStorage.getItem('current_marca');
    if (!currentMarca) {
      Alert.alert('Error', 'No se encontró la marca actual');
      return;
    }

    const currentMarcaData = JSON.parse(currentMarca);

    Alert.alert('Confirmar', '¿Estás seguro de que deseas guardar este control de acciones de mejora?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: async () => {
          try {
            const requestData = {
              marca_id: currentMarcaData.id,
              numero_accion: numeroAccion.trim() || null,
              causa_origen: causaOrigen.trim() || null,
              fecha_deteccion_incidencia: formatDate(fechaDeteccion) || null,
              mes_deteccion: mesDeteccion || null,
              tipo_accion: tipoAccion || null,
              proceso_relacionado: procesoRelacionado.length > 0 ? JSON.stringify(procesoRelacionado) : null,
              encargado_proceso: encargadoProceso.trim() || null,
              origen_accion: origenAccion || null,
              fecha_elaboracion_plan: formatDate(fechaElaboracionPlan) || null,
              tiempo_plan_vs_deteccion: tiempoPlanVsDeteccion.trim() || null,
              plan_elaborado_a_tiempo: planElaboradoATiempo || null,
              detalle_nc_opr_dm: detalleNcOprDm.trim() || null,
              analisis_causas: analisisCausas.trim() || null,
              accion_inmediata: accionInmediata.trim() || null,
              accion_mejora: accionMejora.trim() || null,
              fecha_aprobacion: formatDate(fechaAprobacion) || null,
              responsable_ejecucion: responsableEjecucion.trim() || null,
              fecha_programada_ejecucion: formatDate(fechaProgramadaEjecucion) || null,
              fecha_real_ejecucion: formatDate(fechaRealEjecucion) || null,
              mes_ejecucion: mesEjecucion || null,
              modif_fecha_ejecucion_motivo: modifFechaEjecucionMotivo.trim() || null,
              aplica_seguimiento: aplicaSeguimiento || null,
              seguimiento_meses: seguimientoMeses.length > 0 ? JSON.stringify(seguimientoMeses) : null,
              evidencias: evidencias.trim() || null,
              estado_accion: estadoAccion || null,
              a_tiempo: aTiempo || null,
              no_conformidades_similares: noConformidadesSimilares || null,
              reincidencia: reincidencia || null,
              actualiza_matriz_riesgos: actualizaMatrizRiesgos || null,
              efectividad: efectividad || null,
              no_efectiva: noEfectiva || null,
              cambiar_al_8d: cambiarAl8d || null,
              cerrada: cerrada || null,
              dueño_proceso: dueñoProceso.trim() || null,
            };

            const isConnected = await getConnectionStatus();

            if (isConnected) {
              const result = await createImprovementActionsControl({
                requestData,
                refreshAccessToken,
                logout,
              });

              if (result.status) {
                Alert.alert('Éxito', 'Control de acciones de mejora creado correctamente');
                setIsCreating(false);
                resetForm();
                fetchControls();
              } else {
                Alert.alert('Error', result.message || 'Error al crear el control de acciones de mejora');
              }
            } else {
              const id_local = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
              const newControl: ImprovementActionsControl = {
                id: id_local,
                id_local: id_local,
                numero_accion: numeroAccion.trim() || null,
                causa_origen: causaOrigen.trim() || null,
                fecha_deteccion_incidencia: formatDate(fechaDeteccion) || null,
                mes_deteccion: mesDeteccion || null,
                tipo_accion: tipoAccion || null,
                proceso_relacionado: procesoRelacionado.length > 0 ? JSON.stringify(procesoRelacionado) : null,
                encargado_proceso: encargadoProceso.trim() || null,
                origen_accion: origenAccion || null,
                fecha_elaboracion_plan: formatDate(fechaElaboracionPlan) || null,
                tiempo_plan_vs_deteccion: tiempoPlanVsDeteccion.trim() || null,
                plan_elaborado_a_tiempo: planElaboradoATiempo || null,
                detalle_nc_opr_dm: detalleNcOprDm.trim() || null,
                analisis_causas: analisisCausas.trim() || null,
                accion_inmediata: accionInmediata.trim() || null,
                accion_mejora: accionMejora.trim() || null,
                fecha_aprobacion: formatDate(fechaAprobacion) || null,
                responsable_ejecucion: responsableEjecucion.trim() || null,
                fecha_programada_ejecucion: formatDate(fechaProgramadaEjecucion) || null,
                fecha_real_ejecucion: formatDate(fechaRealEjecucion) || null,
                mes_ejecucion: mesEjecucion || null,
                modif_fecha_ejecucion_motivo: modifFechaEjecucionMotivo.trim() || null,
                aplica_seguimiento: aplicaSeguimiento || null,
                seguimiento_meses: seguimientoMeses.length > 0 ? JSON.stringify(seguimientoMeses) : null,
                evidencias: evidencias.trim() || null,
                estado_accion: estadoAccion || null,
                a_tiempo: aTiempo || null,
                no_conformidades_similares: noConformidadesSimilares || null,
                reincidencia: reincidencia || null,
                actualiza_matriz_riesgos: actualizaMatrizRiesgos || null,
                efectividad: efectividad || null,
                no_efectiva: noEfectiva || null,
                cambiar_al_8d: cambiarAl8d || null,
                cerrada: cerrada || null,
                dueño_proceso: dueñoProceso.trim() || null,
                created_at: new Date().toISOString(),
                synced: false,
              };

              const cacheStr = await AsyncStorage.getItem('evaluations_cache');
              const cache = cacheStr ? JSON.parse(cacheStr) : [];
              cache.push({ ...newControl, type: 'improvement_actions_control' });
              await AsyncStorage.setItem('evaluations_cache', JSON.stringify(cache));

              const actionsStr = await AsyncStorage.getItem('evaluations_actions');
              const actions = actionsStr ? JSON.parse(actionsStr) : [];
              actions.push({
                id: id_local,
                action: 'create',
                payload: requestData,
                type: 'improvement_actions_control',
                synced: false,
              });
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

              Alert.alert('Guardado offline', 'El control de acciones de mejora se guardó localmente y se sincronizará cuando haya conexión');
              setIsCreating(false);
              resetForm();
              fetchControls();
            }
          } catch (err) {
            console.error('Error saving control:', err);
            Alert.alert('Error', 'Error al guardar el control de acciones de mejora');
          }
        },
      },
    ]);
  };

  const updateControlHandler = async () => {
    if (!editingControl) return;

    Alert.alert('Confirmar', '¿Estás seguro de que deseas actualizar este control de acciones de mejora?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: async () => {
          try {
            const requestData = {
              numero_accion: numeroAccion.trim() || null,
              causa_origen: causaOrigen.trim() || null,
              fecha_deteccion_incidencia: formatDate(fechaDeteccion) || null,
              mes_deteccion: mesDeteccion || null,
              tipo_accion: tipoAccion || null,
              proceso_relacionado: procesoRelacionado.length > 0 ? JSON.stringify(procesoRelacionado) : null,
              encargado_proceso: encargadoProceso.trim() || null,
              origen_accion: origenAccion || null,
              fecha_elaboracion_plan: formatDate(fechaElaboracionPlan) || null,
              tiempo_plan_vs_deteccion: tiempoPlanVsDeteccion.trim() || null,
              plan_elaborado_a_tiempo: planElaboradoATiempo || null,
              detalle_nc_opr_dm: detalleNcOprDm.trim() || null,
              analisis_causas: analisisCausas.trim() || null,
              accion_inmediata: accionInmediata.trim() || null,
              accion_mejora: accionMejora.trim() || null,
              fecha_aprobacion: formatDate(fechaAprobacion) || null,
              responsable_ejecucion: responsableEjecucion.trim() || null,
              fecha_programada_ejecucion: formatDate(fechaProgramadaEjecucion) || null,
              fecha_real_ejecucion: formatDate(fechaRealEjecucion) || null,
              mes_ejecucion: mesEjecucion || null,
              modif_fecha_ejecucion_motivo: modifFechaEjecucionMotivo.trim() || null,
              aplica_seguimiento: aplicaSeguimiento || null,
              seguimiento_meses: seguimientoMeses.length > 0 ? JSON.stringify(seguimientoMeses) : null,
              evidencias: evidencias.trim() || null,
              estado_accion: estadoAccion || null,
              a_tiempo: aTiempo || null,
              no_conformidades_similares: noConformidadesSimilares || null,
              reincidencia: reincidencia || null,
              actualiza_matriz_riesgos: actualizaMatrizRiesgos || null,
              efectividad: efectividad || null,
              no_efectiva: noEfectiva || null,
              cambiar_al_8d: cambiarAl8d || null,
              cerrada: cerrada || null,
              dueño_proceso: dueñoProceso.trim() || null,
            };

            const isConnected = await getConnectionStatus();
            const recordId = editingControl.id || editingControl.id_local;

            if (isConnected && editingControl.id && !editingControl.id.startsWith('local_')) {
              const result = await updateImprovementActionsControl({
                id: recordId,
                requestData,
                refreshAccessToken,
                logout,
              });

              if (result.status) {
                Alert.alert('Éxito', 'Control de acciones de mejora actualizado correctamente');
                setEditingControl(null);
                resetForm();
                fetchControls();
              } else {
                Alert.alert('Error', result.message || 'Error al actualizar el control de acciones de mejora');
              }
            } else {
              const actionsStr = await AsyncStorage.getItem('evaluations_actions');
              const actions = actionsStr ? JSON.parse(actionsStr) : [];
              actions.push({
                id: recordId,
                action: 'update',
                payload: requestData,
                type: 'improvement_actions_control',
                synced: false,
              });
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

              const cacheStr = await AsyncStorage.getItem('evaluations_cache');
              if (cacheStr) {
                const cache = JSON.parse(cacheStr);
                const updatedCache = cache.map((item: any) => {
                  if ((item.id === recordId || item.id_local === recordId) && item.type === 'improvement_actions_control') {
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

              Alert.alert('Actualizado offline', 'El control de acciones de mejora se actualizó localmente y se sincronizará cuando haya conexión');
              setEditingControl(null);
              resetForm();
              fetchControls();
            }
          } catch (err) {
            console.error('Error updating control:', err);
            Alert.alert('Error', 'Error al actualizar el control de acciones de mejora');
          }
        },
      },
    ]);
  };

  const deleteControlHandler = async (control: ImprovementActionsControl) => {
    Alert.alert('Confirmar', '¿Estás seguro de que deseas eliminar este control de acciones de mejora?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            const isConnected = await getConnectionStatus();
            const recordId = control.id && !control.id.startsWith('local_') ? control.id : control.id_local;

            if (isConnected && control.id && !control.id.startsWith('local_')) {
              const result = await deleteImprovementActionsControl({
                id: recordId,
                refreshAccessToken,
                logout,
              });

              if (result.status) {
                Alert.alert('Éxito', 'Control de acciones de mejora eliminado correctamente');
                fetchControls();
              } else {
                Alert.alert('Error', result.message || 'Error al eliminar el control de acciones de mejora');
              }
            } else {
              const actionsStr = await AsyncStorage.getItem('evaluations_actions');
              const actions = actionsStr ? JSON.parse(actionsStr) : [];
              actions.push({
                id: recordId,
                action: 'delete',
                payload: {},
                type: 'improvement_actions_control',
                synced: false,
              });
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

              const cacheStr = await AsyncStorage.getItem('evaluations_cache');
              if (cacheStr) {
                const cache = JSON.parse(cacheStr);
                const updatedCache = cache.filter((item: any) => !((item.id === recordId || item.id_local === recordId) && item.type === 'improvement_actions_control'));
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
              }

              Alert.alert('Eliminado offline', 'El control de acciones de mejora se eliminó localmente y se sincronizará cuando haya conexión');
              fetchControls();
            }
          } catch (err) {
            console.error('Error deleting control:', err);
            Alert.alert('Error', 'Error al eliminar el control de acciones de mejora');
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

  const renderControlList = () => {
    if (isLoading) {
      return (
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Cargando controles de acciones de mejora...</ThemedText>
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

    if (controls.length === 0) {
      return (
        <ThemedView style={styles.emptyContainer}>
          <ThemedText style={styles.emptyText}>No hay controles de acciones de mejora registrados.</ThemedText>
        </ThemedView>
      );
    }

    return (
      <ThemedView style={styles.listContainer}>
        {controls.map((control) => (
          <ThemedView key={control.id || control.id_local} style={styles.listItem}>
            <ThemedView style={styles.listItemHeader}>
              <ThemedView style={styles.listItemContent}>
                <ThemedText style={styles.listItemTitle}>
                  Acción #{control.numero_accion || 'N/A'}
                </ThemedText>
                {control.tipo_accion && (
                  <ThemedText style={styles.listItemSubtitle}>
                    Tipo: {control.tipo_accion}
                  </ThemedText>
                )}
                {control.estado_accion && (
                  <ThemedText style={styles.listItemSubtitle}>
                    Estado: {control.estado_accion}
                  </ThemedText>
                )}
                {!control.synced && (
                  <ThemedText style={styles.offlineBadge}>Sin sincronizar</ThemedText>
                )}
              </ThemedView>
              <ThemedView style={styles.listItemActions}>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => startEditing(control)}
                >
                  {getActionIcon('edit')}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deleteControlHandler(control)}
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
    if (!isCreating && !editingControl) return null;

    return (
      <ThemedView style={styles.formContainer}>
        <ThemedText style={styles.formTitle}>
          {isCreating ? 'Nuevo Control de Acciones de Mejora' : 'Editar Control de Acciones de Mejora'}
        </ThemedText>

        <ScrollView 
          style={styles.formScrollView} 
          contentContainerStyle={styles.formScrollViewContent}
          showsVerticalScrollIndicator={true}
          nestedScrollEnabled={true}
        >
          {/* Dueño de Proceso */}
          <ThemedView style={styles.formSection}>
            <ThemedText style={styles.label}>Dueño de Proceso</ThemedText>
            <TextInput
              style={styles.input}
              value={dueñoProceso}
              onChangeText={setDueñoProceso}
              placeholder="Ingrese el dueño del proceso"
              placeholderTextColor="#999"
            />
          </ThemedView>

          {/* N° de la Acción */}
          <ThemedView style={styles.formSection}>
            <ThemedText style={styles.label}>N° de la Acción</ThemedText>
            <TextInput
              style={styles.input}
              value={numeroAccion}
              onChangeText={setNumeroAccion}
              placeholder="Ingrese el número de acción"
              placeholderTextColor="#999"
            />
          </ThemedView>

          {/* Causa origen */}
          <ThemedView style={styles.formSection}>
            <ThemedText style={styles.label}>Causa origen</ThemedText>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={causaOrigen}
              onChangeText={setCausaOrigen}
              placeholder="Ingrese la causa origen"
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
            />
          </ThemedView>

          {/* Fecha Detección INCIDENCIA */}
          <ThemedView style={styles.formSection}>
            <ThemedText style={styles.label}>Fecha Detección INCIDENCIA</ThemedText>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowFechaDeteccionPicker(true)}
            >
              <ThemedText style={styles.dateButtonText}>{formatDate(fechaDeteccion)}</ThemedText>
            </TouchableOpacity>
            {showFechaDeteccionPicker && (
              <DateTimePicker
                value={fechaDeteccion}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, date) => handleDateChange(event, date, 'deteccion')}
              />
            )}
          </ThemedView>

          {/* Mes Detección */}
          <ThemedView style={styles.formSection}>
            <ThemedText style={styles.label}>Mes Detección</ThemedText>
            <TextInput
              style={styles.input}
              value={mesDeteccion}
              editable={false}
              placeholder="Se calcula automáticamente"
              placeholderTextColor="#999"
            />
          </ThemedView>

          {/* Tipo de Acción */}
          <ThemedView style={styles.formSection}>
            <ThemedText style={styles.label}>Tipo de Acción</ThemedText>
            <ThemedView style={styles.pickerContainer}>
              <Picker
                selectedValue={tipoAccion}
                onValueChange={setTipoAccion}
                style={styles.picker}
              >
                {TIPO_ACCION_OPTIONS.map((option) => (
                  <Picker.Item key={option.value} label={option.label} value={option.value} />
                ))}
              </Picker>
            </ThemedView>
          </ThemedView>

          {/* Proceso relacionado - Lista expandible */}
          <ThemedView style={styles.formSection}>
            <ThemedText style={styles.sectionTitle}>Proceso relacionado</ThemedText>
            {procesoRelacionado.map((proceso, index) => {
              const isExpanded = expandedProcesoIndices.includes(index);
              return (
                <ThemedView key={index} style={styles.expandableItem}>
                  <TouchableOpacity
                    style={styles.expandableHeader}
                    onPress={() => toggleProcesoExpansion(index)}
                  >
                    <ThemedText style={styles.expandableHeaderText}>
                      Proceso {index + 1}
                    </ThemedText>
                    <ThemedView style={styles.expandableHeaderActions}>
                      <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={20}
                        color="#000000"
                      />
                      <TouchableOpacity
                        onPress={() => removeProceso(index)}
                        style={styles.removeButton}
                      >
                        <Ionicons name="trash" size={18} color="#F44336" />
                      </TouchableOpacity>
                    </ThemedView>
                  </TouchableOpacity>
                  {isExpanded && (
                    <ThemedView style={styles.expandableContent}>
                      <ThemedView style={styles.formSection}>
                        <ThemedText style={styles.label}>Proceso</ThemedText>
                        <ThemedView style={styles.pickerContainer}>
                          <Picker
                            selectedValue={proceso.proceso}
                            onValueChange={(value) => updateProceso(index, value)}
                            style={styles.picker}
                          >
                            <Picker.Item label="Seleccionar proceso" value="" />
                            {PROCESO_RELACIONADO_OPTIONS.map((option) => (
                              <Picker.Item key={option} label={option} value={option} />
                            ))}
                          </Picker>
                        </ThemedView>
                      </ThemedView>
                    </ThemedView>
                  )}
                </ThemedView>
              );
            })}
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowAddProcesoModal(true)}
            >
              <Ionicons name="add" size={20} color="#FFFFFF" />
              <ThemedText style={styles.addButtonText}>Agregar Proceso</ThemedText>
            </TouchableOpacity>
          </ThemedView>

          {/* Encargado del proceso */}
          <ThemedView style={styles.formSection}>
            <ThemedText style={styles.label}>Encargado del proceso</ThemedText>
            <TextInput
              style={styles.input}
              value={encargadoProceso}
              onChangeText={setEncargadoProceso}
              placeholder="Ingrese el encargado del proceso"
              placeholderTextColor="#999"
            />
          </ThemedView>

          {/* Origen de la Acción */}
          <ThemedView style={styles.formSection}>
            <ThemedText style={styles.label}>Origen de la Acción</ThemedText>
            <ThemedView style={styles.pickerContainer}>
              <Picker
                selectedValue={origenAccion}
                onValueChange={setOrigenAccion}
                style={styles.picker}
              >
                {ORIGEN_ACCION_OPTIONS.map((option) => (
                  <Picker.Item key={option.value} label={option.label} value={option.value} />
                ))}
              </Picker>
            </ThemedView>
          </ThemedView>

          {/* Fecha Elaboración Plan Acción */}
          <ThemedView style={styles.formSection}>
            <ThemedText style={styles.label}>Fecha Elaboración Plan Acción</ThemedText>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowFechaElaboracionPlanPicker(true)}
            >
              <ThemedText style={styles.dateButtonText}>{formatDate(fechaElaboracionPlan)}</ThemedText>
            </TouchableOpacity>
            {showFechaElaboracionPlanPicker && (
              <DateTimePicker
                value={fechaElaboracionPlan}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, date) => handleDateChange(event, date, 'elaboracion')}
              />
            )}
          </ThemedView>

          {/* Tiempo Plan Acción vs Detección */}
          <ThemedView style={styles.formSection}>
            <ThemedText style={styles.label}>Tiempo Plan Acción vs Detección</ThemedText>
            <TextInput
              style={styles.input}
              value={tiempoPlanVsDeteccion}
              onChangeText={setTiempoPlanVsDeteccion}
              placeholder="Ingrese el tiempo"
              placeholderTextColor="#999"
              keyboardType="numeric"
            />
          </ThemedView>

          {/* Plan Elaborado A tiempo / Atrasado */}
          <ThemedView style={styles.formSection}>
            <ThemedText style={styles.label}>Plan Elaborado A tiempo / Atrasado</ThemedText>
            <ThemedView style={styles.pickerContainer}>
              <Picker
                selectedValue={planElaboradoATiempo}
                onValueChange={setPlanElaboradoATiempo}
                style={styles.picker}
              >
                <Picker.Item label="Seleccionar" value="" />
                <Picker.Item label="A tiempo" value="A tiempo" />
                <Picker.Item label="Atrasado" value="Atrasado" />
              </Picker>
            </ThemedView>
          </ThemedView>

          {/* Clasif NC/OBS/CO/OM */}
          <ThemedView style={styles.formSection}>
            <ThemedText style={styles.label}>Clasif NC/OBS/CO/OM</ThemedText>
            <ThemedView style={styles.pickerContainer}>
              <Picker
                selectedValue={detalleNcOprDm}
                onValueChange={setDetalleNcOprDm}
                style={styles.picker}
              >
                {CLASIF_NC_OPTIONS.map((option) => (
                  <Picker.Item key={option.value} label={option.label} value={option.value} />
                ))}
              </Picker>
            </ThemedView>
          </ThemedView>

          {/* Análisis de Causas */}
          <ThemedView style={styles.formSection}>
            <ThemedText style={styles.label}>Análisis de Causas</ThemedText>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={analisisCausas}
              onChangeText={setAnalisisCausas}
              placeholder="Ingrese el análisis de causas"
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
            />
          </ThemedView>

          {/* Acción Inmediata */}
          <ThemedView style={styles.formSection}>
            <ThemedText style={styles.label}>Acción Inmediata</ThemedText>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={accionInmediata}
              onChangeText={setAccionInmediata}
              placeholder="Ingrese la acción inmediata"
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
            />
          </ThemedView>

          {/* Acción de Mejora */}
          <ThemedView style={styles.formSection}>
            <ThemedText style={styles.label}>Acción de Mejora</ThemedText>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={accionMejora}
              onChangeText={setAccionMejora}
              placeholder="Ingrese la acción de mejora"
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
            />
          </ThemedView>

          {/* Fecha de Aprobación */}
          <ThemedView style={styles.formSection}>
            <ThemedText style={styles.label}>Fecha de Aprobación</ThemedText>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowFechaAprobacionPicker(true)}
            >
              <ThemedText style={styles.dateButtonText}>{formatDate(fechaAprobacion)}</ThemedText>
            </TouchableOpacity>
            {showFechaAprobacionPicker && (
              <DateTimePicker
                value={fechaAprobacion}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, date) => handleDateChange(event, date, 'aprobacion')}
              />
            )}
          </ThemedView>

          {/* Responsable de la Ejecución */}
          <ThemedView style={styles.formSection}>
            <ThemedText style={styles.label}>Responsable de la Ejecución</ThemedText>
            <TextInput
              style={styles.input}
              value={responsableEjecucion}
              onChangeText={setResponsableEjecucion}
              placeholder="Ingrese el responsable de la ejecución"
              placeholderTextColor="#999"
            />
          </ThemedView>

          {/* Fecha Programada de ejecución */}
          <ThemedView style={styles.formSection}>
            <ThemedText style={styles.label}>Fecha Programada de ejecución</ThemedText>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowFechaProgramadaEjecucionPicker(true)}
            >
              <ThemedText style={styles.dateButtonText}>{formatDate(fechaProgramadaEjecucion)}</ThemedText>
            </TouchableOpacity>
            {showFechaProgramadaEjecucionPicker && (
              <DateTimePicker
                value={fechaProgramadaEjecucion}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, date) => handleDateChange(event, date, 'programada')}
              />
            )}
          </ThemedView>

          {/* Fecha Real de Ejecución */}
          <ThemedView style={styles.formSection}>
            <ThemedText style={styles.label}>Fecha Real de Ejecución</ThemedText>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowFechaRealEjecucionPicker(true)}
            >
              <ThemedText style={styles.dateButtonText}>{formatDate(fechaRealEjecucion)}</ThemedText>
            </TouchableOpacity>
            {showFechaRealEjecucionPicker && (
              <DateTimePicker
                value={fechaRealEjecucion}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, date) => handleDateChange(event, date, 'real')}
              />
            )}
          </ThemedView>

          {/* Mes Ejecución */}
          <ThemedView style={styles.formSection}>
            <ThemedText style={styles.label}>Mes Ejecución</ThemedText>
            <TextInput
              style={styles.input}
              value={mesEjecucion}
              editable={false}
              placeholder="Se calcula automáticamente"
              placeholderTextColor="#999"
            />
          </ThemedView>

          {/* Modif. Fecha Ejecución / Motivo */}
          <ThemedView style={styles.formSection}>
            <ThemedText style={styles.label}>Modif. Fecha Ejecución / Motivo</ThemedText>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={modifFechaEjecucionMotivo}
              onChangeText={setModifFechaEjecucionMotivo}
              placeholder="Ingrese el motivo de modificación"
              placeholderTextColor="#999"
              multiline
              numberOfLines={3}
            />
          </ThemedView>

          {/* Aplica Seguimiento */}
          <ThemedView style={styles.formSection}>
            <ThemedText style={styles.label}>Aplica Seguimiento</ThemedText>
            <ThemedView style={styles.pickerContainer}>
              <Picker
                selectedValue={aplicaSeguimiento}
                onValueChange={setAplicaSeguimiento}
                style={styles.picker}
              >
                <Picker.Item label="Seleccionar" value="" />
                <Picker.Item label="Sí" value="Sí" />
                <Picker.Item label="No" value="No" />
              </Picker>
            </ThemedView>
          </ThemedView>

          {/* Seguimiento Meses */}
          {aplicaSeguimiento === 'Sí' && (
            <ThemedView style={styles.formSection}>
              <ThemedText style={styles.label}>Seguimiento Meses</ThemedText>
              <ThemedView style={styles.checkboxContainer}>
                {MESES.map((mes) => (
                  <TouchableOpacity
                    key={mes.value}
                    style={styles.checkboxItem}
                    onPress={() => toggleSeguimientoMes(mes.value)}
                  >
                    <ThemedView style={[
                      styles.checkbox,
                      seguimientoMeses.includes(mes.value) && styles.checkboxChecked
                    ]}>
                      {seguimientoMeses.includes(mes.value) && (
                        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                      )}
                    </ThemedView>
                    <ThemedText style={styles.checkboxLabel}>{mes.label}</ThemedText>
                  </TouchableOpacity>
                ))}
              </ThemedView>
            </ThemedView>
          )}

          {/* Evidencias */}
          <ThemedView style={styles.formSection}>
            <ThemedText style={styles.label}>Evidencias</ThemedText>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={evidencias}
              onChangeText={setEvidencias}
              placeholder="Ingrese las evidencias"
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
            />
          </ThemedView>

          {/* Estado de la Acción */}
          <ThemedView style={styles.formSection}>
            <ThemedText style={styles.label}>Estado de la Acción</ThemedText>
            <ThemedView style={styles.pickerContainer}>
              <Picker
                selectedValue={estadoAccion}
                onValueChange={setEstadoAccion}
                style={styles.picker}
              >
                <Picker.Item label="Seleccionar estado" value="" />
                <Picker.Item label="Abierta" value="Abierta" />
                <Picker.Item label="En Proceso" value="En Proceso" />
                <Picker.Item label="Cerrada" value="Cerrada" />
              </Picker>
            </ThemedView>
          </ThemedView>

          {/* A tiempo? */}
          <ThemedView style={styles.formSection}>
            <ThemedText style={styles.label}>A tiempo?</ThemedText>
            <ThemedView style={styles.pickerContainer}>
              <Picker
                selectedValue={aTiempo}
                onValueChange={setATiempo}
                style={styles.picker}
              >
                <Picker.Item label="Seleccionar" value="" />
                <Picker.Item label="Sí" value="Sí" />
                <Picker.Item label="No" value="No" />
              </Picker>
            </ThemedView>
          </ThemedView>

          {/* No Conformidades Similares? */}
          <ThemedView style={styles.formSection}>
            <ThemedText style={styles.label}>No Conformidades Similares?</ThemedText>
            <ThemedView style={styles.pickerContainer}>
              <Picker
                selectedValue={noConformidadesSimilares}
                onValueChange={setNoConformidadesSimilares}
                style={styles.picker}
              >
                <Picker.Item label="Seleccionar" value="" />
                <Picker.Item label="Sí" value="Sí" />
                <Picker.Item label="No" value="No" />
              </Picker>
            </ThemedView>
          </ThemedView>

          {/* Reincidencia? */}
          <ThemedView style={styles.formSection}>
            <ThemedText style={styles.label}>Reincidencia?</ThemedText>
            <ThemedView style={styles.pickerContainer}>
              <Picker
                selectedValue={reincidencia}
                onValueChange={setReincidencia}
                style={styles.picker}
              >
                <Picker.Item label="Seleccionar" value="" />
                <Picker.Item label="Sí" value="Sí" />
                <Picker.Item label="No" value="No" />
              </Picker>
            </ThemedView>
          </ThemedView>

          {/* Actualiza Matriz de Riesgos / Oportunidades */}
          <ThemedView style={styles.formSection}>
            <ThemedText style={styles.label}>Actualiza Matriz de Riesgos / Oportunidades</ThemedText>
            <ThemedView style={styles.pickerContainer}>
              <Picker
                selectedValue={actualizaMatrizRiesgos}
                onValueChange={setActualizaMatrizRiesgos}
                style={styles.picker}
              >
                <Picker.Item label="Seleccionar" value="" />
                <Picker.Item label="Sí" value="Sí" />
                <Picker.Item label="No" value="No" />
              </Picker>
            </ThemedView>
          </ThemedView>

          {/* Efectividad? */}
          <ThemedView style={styles.formSection}>
            <ThemedText style={styles.label}>Efectividad?</ThemedText>
            <ThemedView style={styles.pickerContainer}>
              <Picker
                selectedValue={efectividad}
                onValueChange={setEfectividad}
                style={styles.picker}
              >
                <Picker.Item label="Seleccionar" value="" />
                <Picker.Item label="Sí" value="Sí" />
                <Picker.Item label="No" value="No" />
              </Picker>
            </ThemedView>
          </ThemedView>

          {/* No efectiva? */}
          <ThemedView style={styles.formSection}>
            <ThemedText style={styles.label}>No efectiva?</ThemedText>
            <ThemedView style={styles.pickerContainer}>
              <Picker
                selectedValue={noEfectiva}
                onValueChange={setNoEfectiva}
                style={styles.picker}
              >
                <Picker.Item label="Seleccionar" value="" />
                <Picker.Item label="Sí" value="Sí" />
                <Picker.Item label="No" value="No" />
              </Picker>
            </ThemedView>
          </ThemedView>

          {/* Cambiar al 8D? */}
          <ThemedView style={styles.formSection}>
            <ThemedText style={styles.label}>Cambiar al 8D?</ThemedText>
            <ThemedView style={styles.pickerContainer}>
              <Picker
                selectedValue={cambiarAl8d}
                onValueChange={setCambiarAl8d}
                style={styles.picker}
              >
                <Picker.Item label="Seleccionar" value="" />
                <Picker.Item label="Sí" value="Sí" />
                <Picker.Item label="No" value="No" />
              </Picker>
            </ThemedView>
          </ThemedView>

          {/* Cerrada? */}
          <ThemedView style={styles.formSection}>
            <ThemedText style={styles.label}>Cerrada?</ThemedText>
            <ThemedView style={styles.pickerContainer}>
              <Picker
                selectedValue={cerrada}
                onValueChange={setCerrada}
                style={styles.picker}
              >
                <Picker.Item label="Seleccionar" value="" />
                <Picker.Item label="Sí" value="Sí" />
                <Picker.Item label="No" value="No" />
              </Picker>
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
              onPress={isCreating ? saveControlHandler : updateControlHandler}
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
        title="Control de Acciones de Mejora"
      />
      <SlideMenu
        isVisible={isMenuVisible}
        onClose={() => setIsMenuVisible(false)}
        navigation={navigation}
      />
      {isCreating || editingControl ? (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.formWrapper}>
          {renderForm()}
        </ScrollView>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {hasCurrentMarca && (
            <TouchableOpacity style={styles.addButton} onPress={startCreating}>
              <ThemedView style={styles.addButtonContent}>
                {getActionIcon('add')}
                <ThemedText style={styles.addButtonText}>Nuevo Control</ThemedText>
              </ThemedView>
            </TouchableOpacity>
          )}
          {renderControlList()}
        </ScrollView>
      )}
      <AppFooter />
      
      {/* Modal para agregar proceso */}
      <Modal
        visible={showAddProcesoModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddProcesoModal(false)}
      >
        <ThemedView style={styles.modalOverlay}>
          <ThemedView style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>Agregar Proceso</ThemedText>
            <ThemedView style={styles.pickerContainer}>
              <Picker
                selectedValue={newProcesoValue}
                onValueChange={setNewProcesoValue}
                style={styles.picker}
              >
                <Picker.Item label="Seleccionar proceso" value="" />
                {PROCESO_RELACIONADO_OPTIONS.map((option) => (
                  <Picker.Item key={option} label={option} value={option} />
                ))}
              </Picker>
            </ThemedView>
            <ThemedView style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowAddProcesoModal(false);
                  setNewProcesoValue('');
                }}
              >
                <ThemedText style={styles.modalCancelButtonText}>Cancelar</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={addProceso}
              >
                <ThemedText style={styles.modalConfirmButtonText}>Agregar</ThemedText>
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
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    backgroundColor: '#FFF',
    marginBottom: 10,
  },
  picker: {
    height: 50,
    color: '#000',
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
  expandableItem: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: '#F9F9F9',
  },
  expandableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  expandableHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  expandableHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  removeButton: {
    padding: 4,
  },
  expandableContent: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#DDD',
  },
  checkboxContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  checkboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    minWidth: '30%',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 4,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
  },
  checkboxChecked: {
    backgroundColor: '#007AFF',
  },
  checkboxLabel: {
    fontSize: 14,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 15,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#9E9E9E',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalConfirmButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalConfirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

