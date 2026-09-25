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
import { Picker } from '@react-native-picker/picker';
import {
  createContractBasicData,
  updateContractBasicData,
  deleteContractBasicData,
  listContractBasicDataByCorpo,
} from '@/hooks/evaluationFunctions';
import { eventBus } from '@/hooks/eventBus';

type ContractBasicDataScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ContractBasicData'>;

interface PersonalItem {
  descripcion: string;
  cantidad: string;
  observaciones: string;
}

interface RolHorario {
  dia_inicio: string;
  dia_fin: string;
  hora_inicio: string;
  hora_fin: string;
}

interface DesgloseSalario {
  salario_base: string;
  horas_extras_diurnas: string;
  horas_extras_mixtas: string;
  horas_extras_nocturnas: string;
  total: string;
  montos_adicionales_coordinacion: string;
  montos_adicionales_combustible: string;
  montos_adicionales_alquileres: string;
}

interface UniformeItem {
  descripcion: string;
  cantidad: string;
}

interface ArmaItem {
  descripcion: string;
  cantidad: string;
}

interface ContractBasicData {
  id: string;
  id_local: string;
  fecha_inicio_contrato: string | null;
  cliente_contrato: string | null;
  ejecutivo_gerente_asistente: string | null;
  personal: string | null; // JSON string of PersonalItem[]
  lugar_servicio: string | null;
  roles_horarios: string | null; // JSON string of RolHorario[]
  desglose_salarios: string | null; // JSON string of DesgloseSalario[]
  tipo_uniforme: string | null; // JSON string of UniformeItem[]
  tipo_arma: string | null; // JSON string of ArmaItem[]
  capacitaciones: string | null;
  otros_datos: string | null;
  created_at: string;
  synced?: boolean;
}

interface EditingContractBasicData {
  id: string | null;
  id_local: string;
  fecha_inicio_contrato: string;
  cliente_contrato: string;
  ejecutivo_gerente_asistente: string;
  personal: PersonalItem[];
  lugar_servicio: string;
  roles_horarios: RolHorario[];
  desglose_salarios: DesgloseSalario[];
  tipo_uniforme: UniformeItem[];
  tipo_arma: ArmaItem[];
  capacitaciones: string;
  otros_datos: string;
}

const PERSONAL_DESCRIPTION_OPTIONS = [
  { label: 'Seleccionar descripción', value: '' },
  { label: 'Oficiales', value: 'Oficiales' },
  { label: 'Asistentes de Operaciones SEG', value: 'Asistentes de Operaciones SEG' },
  { label: 'Supervisores SEG', value: 'Supervisores SEG' },
  { label: 'Ejecutivos de Cuenta', value: 'Ejecutivos de Cuenta' },
  { label: 'Miscelaneos', value: 'Miscelaneos' },
  { label: 'Asistentes de Operaciones AYL', value: 'Asistentes de Operaciones AYL' },
  { label: 'Supervisor Interno', value: 'Supervisor Interno' },
  { label: 'Supervisor Externo', value: 'Supervisor Externo' },
];

const DIAS_SEMANA_OPTIONS = [
  { label: 'Seleccionar día', value: '' },
  { label: 'Lunes', value: 'Lunes' },
  { label: 'Martes', value: 'Martes' },
  { label: 'Miércoles', value: 'Miércoles' },
  { label: 'Jueves', value: 'Jueves' },
  { label: 'Viernes', value: 'Viernes' },
  { label: 'Sábado', value: 'Sábado' },
  { label: 'Domingo', value: 'Domingo' },
];

export default function ContractBasicDataScreen() {
  const { employee, refreshAccessToken, logout } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<ContractBasicDataScreenNavigationProp>();

  // Data states
  const [contracts, setContracts] = useState<ContractBasicData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasCurrentMarca, setHasCurrentMarca] = useState<boolean>(false);

  // Editing state
  const [editingRecord, setEditingRecord] = useState<EditingContractBasicData | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form states
  const [fechaInicioContrato, setFechaInicioContrato] = useState('');
  const [clienteContrato, setClienteContrato] = useState('');
  const [ejecutivoGerenteAsistente, setEjecutivoGerenteAsistente] = useState('');
  const [personal, setPersonal] = useState<PersonalItem[]>([]);
  const [lugarServicio, setLugarServicio] = useState('');
  const [rolesHorarios, setRolesHorarios] = useState<RolHorario[]>([]);
  const [desgloseSalarios, setDesgloseSalarios] = useState<DesgloseSalario[]>([]);
  const [tipoUniforme, setTipoUniforme] = useState<UniformeItem[]>([]);
  const [tipoArma, setTipoArma] = useState<ArmaItem[]>([]);
  const [capacitaciones, setCapacitaciones] = useState('');
  const [otrosDatos, setOtrosDatos] = useState('');

  // Expanded states
  const [expandedPersonal, setExpandedPersonal] = useState<number[]>([]);
  const [expandedRolesHorarios, setExpandedRolesHorarios] = useState<number[]>([]);
  const [expandedDesgloseSalarios, setExpandedDesgloseSalarios] = useState<number[]>([]);
  const [expandedTipoUniforme, setExpandedTipoUniforme] = useState<number[]>([]);
  const [expandedTipoArma, setExpandedTipoArma] = useState<number[]>([]);

  // Date/Time picker states
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePickerRoles, setShowTimePickerRoles] = useState<{ index: number; field: 'hora_inicio' | 'hora_fin' } | null>(null);

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

  const fetchContracts = useCallback(async () => {
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
        const result = await listContractBasicDataByCorpo({
          corpo_id: corpoId,
          refreshAccessToken,
          logout,
        });

        if (result.status && result.data) {
          setContracts(result.data as ContractBasicData[]);
        } else {
          setContracts([]);
        }
      } else {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const contractsCache = cache.filter((item: any) => item.type === 'contract_basic_data');
          setContracts(contractsCache);
        } else {
          setContracts([]);
        }
      }
    } catch (err) {
      console.error('Error fetching contracts:', err);
      setError('Error al cargar los datos básicos de contrato');
      try {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const contractsCache = cache.filter((item: any) => item.type === 'contract_basic_data');
          setContracts(contractsCache);
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
      fetchContracts();
      eventBus.on('connectionRestored', fetchContracts);
      return () => {
        eventBus.off('connectionRestored', fetchContracts);
      };
    }, [fetchContracts])
  );

  const resetForm = () => {
    setFechaInicioContrato('');
    setClienteContrato('');
    setEjecutivoGerenteAsistente('');
    setPersonal([]);
    setLugarServicio('');
    setRolesHorarios([]);
    setDesgloseSalarios([]);
    setTipoUniforme([]);
    setTipoArma([]);
    setCapacitaciones('');
    setOtrosDatos('');
    setExpandedPersonal([]);
    setExpandedRolesHorarios([]);
    setExpandedDesgloseSalarios([]);
    setExpandedTipoUniforme([]);
    setExpandedTipoArma([]);
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

  const startEditing = (record: ContractBasicData) => {
    setIsCreating(false);
    let personalEdit: PersonalItem[] = [];
    let rolesHorariosEdit: RolHorario[] = [];
    let desgloseSalariosEdit: DesgloseSalario[] = [];
    let tipoUniformeEdit: UniformeItem[] = [];
    let tipoArmaEdit: ArmaItem[] = [];

    if (record.personal) {
      try {
        personalEdit = JSON.parse(record.personal);
        if (!Array.isArray(personalEdit)) personalEdit = [];
      } catch (e) {
        personalEdit = [];
      }
    }

    if (record.roles_horarios) {
      try {
        rolesHorariosEdit = JSON.parse(record.roles_horarios);
        if (!Array.isArray(rolesHorariosEdit)) rolesHorariosEdit = [];
      } catch (e) {
        rolesHorariosEdit = [];
      }
    }

    if (record.desglose_salarios) {
      try {
        desgloseSalariosEdit = JSON.parse(record.desglose_salarios);
        if (!Array.isArray(desgloseSalariosEdit)) desgloseSalariosEdit = [];
      } catch (e) {
        desgloseSalariosEdit = [];
      }
    }

    if (record.tipo_uniforme) {
      try {
        tipoUniformeEdit = JSON.parse(record.tipo_uniforme);
        if (!Array.isArray(tipoUniformeEdit)) tipoUniformeEdit = [];
      } catch (e) {
        tipoUniformeEdit = [];
      }
    }

    if (record.tipo_arma) {
      try {
        tipoArmaEdit = JSON.parse(record.tipo_arma);
        if (!Array.isArray(tipoArmaEdit)) tipoArmaEdit = [];
      } catch (e) {
        tipoArmaEdit = [];
      }
    }

    setEditingRecord({
      id: record.id,
      id_local: record.id_local,
      fecha_inicio_contrato: record.fecha_inicio_contrato || '',
      cliente_contrato: record.cliente_contrato || '',
      ejecutivo_gerente_asistente: record.ejecutivo_gerente_asistente || '',
      personal: personalEdit,
      lugar_servicio: record.lugar_servicio || '',
      roles_horarios: rolesHorariosEdit,
      desglose_salarios: desgloseSalariosEdit,
      tipo_uniforme: tipoUniformeEdit,
      tipo_arma: tipoArmaEdit,
      capacitaciones: record.capacitaciones || '',
      otros_datos: record.otros_datos || '',
    });

    setFechaInicioContrato(record.fecha_inicio_contrato || '');
    setClienteContrato(record.cliente_contrato || '');
    setEjecutivoGerenteAsistente(record.ejecutivo_gerente_asistente || '');
    setPersonal(personalEdit);
    setLugarServicio(record.lugar_servicio || '');
    setRolesHorarios(rolesHorariosEdit);
    setDesgloseSalarios(desgloseSalariosEdit);
    setTipoUniforme(tipoUniformeEdit);
    setTipoArma(tipoArmaEdit);
    setCapacitaciones(record.capacitaciones || '');
    setOtrosDatos(record.otros_datos || '');
    setExpandedPersonal(personalEdit.map((_, i) => i));
    setExpandedRolesHorarios(rolesHorariosEdit.map((_, i) => i));
    setExpandedDesgloseSalarios(desgloseSalariosEdit.map((_, i) => i));
    setExpandedTipoUniforme(tipoUniformeEdit.map((_, i) => i));
    setExpandedTipoArma(tipoArmaEdit.map((_, i) => i));
  };

  const cancelEditing = () => {
    setEditingRecord(null);
    resetForm();
  };

  // Personal functions
  const addPersonal = () => {
    setPersonal([...personal, { descripcion: '', cantidad: '', observaciones: '' }]);
    setExpandedPersonal([...expandedPersonal, personal.length]);
  };

  const updatePersonal = (index: number, field: keyof PersonalItem, value: string) => {
    const newPersonal = [...personal];
    newPersonal[index][field] = value;
    setPersonal(newPersonal);
  };

  const removePersonal = (index: number) => {
    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas eliminar este personal?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            setPersonal(personal.filter((_, i) => i !== index));
            setExpandedPersonal(expandedPersonal.filter(i => i !== index).map(i => i > index ? i - 1 : i));
          },
        },
      ]
    );
  };

  const togglePersonalExpansion = (index: number) => {
    setExpandedPersonal(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  // Roles y Horarios functions
  const addRolHorario = () => {
    setRolesHorarios([...rolesHorarios, { dia_inicio: '', dia_fin: '', hora_inicio: '', hora_fin: '' }]);
    setExpandedRolesHorarios([...expandedRolesHorarios, rolesHorarios.length]);
  };

  const updateRolHorario = (index: number, field: keyof RolHorario, value: string) => {
    const newRoles = [...rolesHorarios];
    newRoles[index][field] = value;
    setRolesHorarios(newRoles);
  };

  const removeRolHorario = (index: number) => {
    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas eliminar este rol y horario?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            setRolesHorarios(rolesHorarios.filter((_, i) => i !== index));
            setExpandedRolesHorarios(expandedRolesHorarios.filter(i => i !== index).map(i => i > index ? i - 1 : i));
          },
        },
      ]
    );
  };

  const toggleRolHorarioExpansion = (index: number) => {
    setExpandedRolesHorarios(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const handleTimeChangeRoles = (event: any, selectedTime?: Date) => {
    if (showTimePickerRoles && selectedTime) {
      const { index, field } = showTimePickerRoles;
      updateRolHorario(index, field, formatTime(selectedTime));
    }
    setShowTimePickerRoles(Platform.OS === 'ios' ? showTimePickerRoles : null);
  };

  // Desglose Salarios functions
  const addDesgloseSalario = () => {
    setDesgloseSalarios([...desgloseSalarios, {
      salario_base: '',
      horas_extras_diurnas: '',
      horas_extras_mixtas: '',
      horas_extras_nocturnas: '',
      total: '',
      montos_adicionales_coordinacion: '',
      montos_adicionales_combustible: '',
      montos_adicionales_alquileres: '',
    }]);
    setExpandedDesgloseSalarios([...expandedDesgloseSalarios, desgloseSalarios.length]);
  };

  const updateDesgloseSalario = (index: number, field: keyof DesgloseSalario, value: string) => {
    const newDesglose = [...desgloseSalarios];
    newDesglose[index][field] = value;
    setDesgloseSalarios(newDesglose);
  };

  const removeDesgloseSalario = (index: number) => {
    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas eliminar este desglose de salario?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            setDesgloseSalarios(desgloseSalarios.filter((_, i) => i !== index));
            setExpandedDesgloseSalarios(expandedDesgloseSalarios.filter(i => i !== index).map(i => i > index ? i - 1 : i));
          },
        },
      ]
    );
  };

  const toggleDesgloseSalarioExpansion = (index: number) => {
    setExpandedDesgloseSalarios(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  // Tipo Uniforme functions
  const addTipoUniforme = () => {
    setTipoUniforme([...tipoUniforme, { descripcion: '', cantidad: '' }]);
    setExpandedTipoUniforme([...expandedTipoUniforme, tipoUniforme.length]);
  };

  const updateTipoUniforme = (index: number, field: keyof UniformeItem, value: string) => {
    const newUniforme = [...tipoUniforme];
    newUniforme[index][field] = value;
    setTipoUniforme(newUniforme);
  };

  const removeTipoUniforme = (index: number) => {
    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas eliminar este uniforme?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            setTipoUniforme(tipoUniforme.filter((_, i) => i !== index));
            setExpandedTipoUniforme(expandedTipoUniforme.filter(i => i !== index).map(i => i > index ? i - 1 : i));
          },
        },
      ]
    );
  };

  const toggleTipoUniformeExpansion = (index: number) => {
    setExpandedTipoUniforme(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  // Tipo Arma functions
  const addTipoArma = () => {
    setTipoArma([...tipoArma, { descripcion: '', cantidad: '' }]);
    setExpandedTipoArma([...expandedTipoArma, tipoArma.length]);
  };

  const updateTipoArma = (index: number, field: keyof ArmaItem, value: string) => {
    const newArma = [...tipoArma];
    newArma[index][field] = value;
    setTipoArma(newArma);
  };

  const removeTipoArma = (index: number) => {
    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas eliminar este arma?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            setTipoArma(tipoArma.filter((_, i) => i !== index));
            setExpandedTipoArma(expandedTipoArma.filter(i => i !== index).map(i => i > index ? i - 1 : i));
          },
        },
      ]
    );
  };

  const toggleTipoArmaExpansion = (index: number) => {
    setExpandedTipoArma(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setFechaInicioContrato(formatDate(selectedDate));
    }
  };

  const saveContractHandler = async () => {
    const currentMarca = await AsyncStorage.getItem('current_marca');
    if (!currentMarca) {
      Alert.alert('Error', 'No se encontró la marca actual');
      return;
    }

    const currentMarcaData = JSON.parse(currentMarca);

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas guardar estos datos básicos de contrato?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const requestData = {
                marca_id: currentMarcaData.id,
                fecha_inicio_contrato: fechaInicioContrato.trim() || null,
                cliente_contrato: clienteContrato.trim() || null,
                ejecutivo_gerente_asistente: ejecutivoGerenteAsistente.trim() || null,
                personal: personal.length > 0 ? JSON.stringify(personal) : null,
                lugar_servicio: lugarServicio.trim() || null,
                roles_horarios: rolesHorarios.length > 0 ? JSON.stringify(rolesHorarios) : null,
                desglose_salarios: desgloseSalarios.length > 0 ? JSON.stringify(desgloseSalarios) : null,
                tipo_uniforme: tipoUniforme.length > 0 ? JSON.stringify(tipoUniforme) : null,
                tipo_arma: tipoArma.length > 0 ? JSON.stringify(tipoArma) : null,
                capacitaciones: capacitaciones.trim() || null,
                otros_datos: otrosDatos.trim() || null,
              };

              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await createContractBasicData({
                  requestData,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Datos básicos de contrato guardados correctamente');
                  cancelCreating();
                  fetchContracts();
                } else {
                  Alert.alert('Error', result.message || 'Error al guardar los datos básicos de contrato');
                }
              } else {
                const localId = generateRandomId();

                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: localId,
                  action: 'create',
                  type: 'contract_basic_data',
                  payload: requestData,
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                const cache = cacheStr ? JSON.parse(cacheStr) : [];

                const newRecordCache: ContractBasicData = {
                  id: '',
                  id_local: localId,
                  fecha_inicio_contrato: fechaInicioContrato.trim() || null,
                  cliente_contrato: clienteContrato.trim() || null,
                  ejecutivo_gerente_asistente: ejecutivoGerenteAsistente.trim() || null,
                  personal: personal.length > 0 ? JSON.stringify(personal) : null,
                  lugar_servicio: lugarServicio.trim() || null,
                  roles_horarios: rolesHorarios.length > 0 ? JSON.stringify(rolesHorarios) : null,
                  desglose_salarios: desgloseSalarios.length > 0 ? JSON.stringify(desgloseSalarios) : null,
                  tipo_uniforme: tipoUniforme.length > 0 ? JSON.stringify(tipoUniforme) : null,
                  tipo_arma: tipoArma.length > 0 ? JSON.stringify(tipoArma) : null,
                  capacitaciones: capacitaciones.trim() || null,
                  otros_datos: otrosDatos.trim() || null,
                  created_at: new Date().toISOString(),
                  synced: false,
                };

                cache.push({ ...newRecordCache, type: 'contract_basic_data' });
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(cache));

                Alert.alert('Modo Offline', 'Datos básicos de contrato registrados localmente. Se sincronizará cuando haya conexión.');
                cancelCreating();
                fetchContracts();
              }
            } catch (err) {
              console.error('Error saving contract:', err);
              Alert.alert('Error', 'No se pudo guardar los datos básicos de contrato');
            }
          },
        },
      ]
    );
  };

  const updateContractHandler = async () => {
    if (!editingRecord) return;

    const recordId = editingRecord.id || editingRecord.id_local;
    if (!recordId) {
      Alert.alert('Error', 'ID de registro no encontrado para actualizar');
      return;
    }

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas actualizar estos datos básicos de contrato?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const requestData = {
                fecha_inicio_contrato: fechaInicioContrato.trim() || null,
                cliente_contrato: clienteContrato.trim() || null,
                ejecutivo_gerente_asistente: ejecutivoGerenteAsistente.trim() || null,
                personal: personal.length > 0 ? JSON.stringify(personal) : null,
                lugar_servicio: lugarServicio.trim() || null,
                roles_horarios: rolesHorarios.length > 0 ? JSON.stringify(rolesHorarios) : null,
                desglose_salarios: desgloseSalarios.length > 0 ? JSON.stringify(desgloseSalarios) : null,
                tipo_uniforme: tipoUniforme.length > 0 ? JSON.stringify(tipoUniforme) : null,
                tipo_arma: tipoArma.length > 0 ? JSON.stringify(tipoArma) : null,
                capacitaciones: capacitaciones.trim() || null,
                otros_datos: otrosDatos.trim() || null,
              };

              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await updateContractBasicData({
                  id: recordId,
                  requestData,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Datos básicos de contrato actualizados correctamente');
                  cancelEditing();
                  fetchContracts();
                } else {
                  Alert.alert('Error', result.message || 'Error al actualizar los datos básicos de contrato');
                }
              } else {
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: recordId,
                  action: 'update',
                  type: 'contract_basic_data',
                  payload: requestData,
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                if (cacheStr) {
                  const cache = JSON.parse(cacheStr);
                  const updatedCache = cache.map((item: any) => {
                    if ((item.id === recordId || item.id_local === recordId) && item.type === 'contract_basic_data') {
                      return {
                        ...item,
                        fecha_inicio_contrato: requestData.fecha_inicio_contrato,
                        cliente_contrato: requestData.cliente_contrato,
                        ejecutivo_gerente_asistente: requestData.ejecutivo_gerente_asistente,
                        personal: requestData.personal,
                        lugar_servicio: requestData.lugar_servicio,
                        roles_horarios: requestData.roles_horarios,
                        desglose_salarios: requestData.desglose_salarios,
                        tipo_uniforme: requestData.tipo_uniforme,
                        tipo_arma: requestData.tipo_arma,
                        capacitaciones: requestData.capacitaciones,
                        otros_datos: requestData.otros_datos,
                        synced: false,
                      };
                    }
                    return item;
                  });
                  await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                }

                Alert.alert('Modo Offline', 'Datos básicos de contrato actualizados localmente. Se sincronizará cuando haya conexión.');
                cancelEditing();
                fetchContracts();
              }
            } catch (err) {
              console.error('Error updating contract:', err);
              Alert.alert('Error', 'No se pudo actualizar los datos básicos de contrato');
            }
          },
        },
      ]
    );
  };

  const deleteContractHandler = async (record: ContractBasicData) => {
    const recordId = record.id || record.id_local;
    if (!recordId) {
      Alert.alert('Error', 'ID de registro no encontrado para eliminar');
      return;
    }

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas eliminar estos datos básicos de contrato?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await deleteContractBasicData({
                  id: recordId,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Datos básicos de contrato eliminados correctamente');
                  fetchContracts();
                } else {
                  Alert.alert('Error', result.message || 'Error al eliminar los datos básicos de contrato');
                }
              } else {
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: recordId,
                  action: 'delete',
                  type: 'contract_basic_data',
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

                Alert.alert('Modo Offline', 'Datos básicos de contrato marcados para eliminación localmente. Se sincronizará cuando haya conexión.');
                fetchContracts();
              }
            } catch (err) {
              console.error('Error deleting contract:', err);
              Alert.alert('Error', 'No se pudo eliminar los datos básicos de contrato');
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
      case 'contract': return <Ionicons name="document-text" size={24} color='#000000' />;
      case 'add': return <Ionicons name="add" size={24} color='#FFFFFF' />;
      case 'cancel': return <Ionicons name="close" size={24} color='#FFFFFF' />;
      case 'confirm': return <Ionicons name="checkmark" size={24} color='#FFFFFF' />;
      case 'delete': return <Ionicons name="trash" size={24} color='#FFFFFF' />;
      case 'edit': return <Ionicons name="pencil" size={20} color="#FFFFFF" />;
      default: return <Ionicons name="document-text" size={24} color='#000000' />;
    }
  };

  const renderContractList = () => {
    if (isLoading) {
      return (
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Cargando datos básicos de contrato...</ThemedText>
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

    if (contracts.length === 0) {
      return (
        <ThemedView style={styles.emptyContainer}>
          <ThemedText style={styles.emptyText}>No hay datos básicos de contrato registrados.</ThemedText>
        </ThemedView>
      );
    }

    return (
      <ThemedView style={styles.listContainer}>
        {contracts.map((record) => {
          let personalData: PersonalItem[] = [];
          let rolesHorariosData: RolHorario[] = [];
          let desgloseSalariosData: DesgloseSalario[] = [];
          let tipoUniformeData: UniformeItem[] = [];
          let tipoArmaData: ArmaItem[] = [];

          if (record.personal) {
            try {
              personalData = JSON.parse(record.personal);
            } catch (e) {
              personalData = [];
            }
          }

          if (record.roles_horarios) {
            try {
              rolesHorariosData = JSON.parse(record.roles_horarios);
            } catch (e) {
              rolesHorariosData = [];
            }
          }

          if (record.desglose_salarios) {
            try {
              desgloseSalariosData = JSON.parse(record.desglose_salarios);
            } catch (e) {
              desgloseSalariosData = [];
            }
          }

          if (record.tipo_uniforme) {
            try {
              tipoUniformeData = JSON.parse(record.tipo_uniforme);
            } catch (e) {
              tipoUniformeData = [];
            }
          }

          if (record.tipo_arma) {
            try {
              tipoArmaData = JSON.parse(record.tipo_arma);
            } catch (e) {
              tipoArmaData = [];
            }
          }

          return (
            <ThemedView key={record.id || record.id_local} style={styles.listItem}>
              <ThemedView style={styles.listItemHeader}>
                <ThemedView style={styles.listItemContent}>
                  <ThemedText style={styles.listItemTitle}>
                    {record.cliente_contrato || 'Sin cliente/contrato'}
                  </ThemedText>
                  <ThemedText style={styles.listItemSubtitle}>
                    Fecha inicio: {record.fecha_inicio_contrato || 'N/A'}
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
                  <ThemedText style={styles.detailLabel}>Fecha inicio contrato: </ThemedText>
                  {record.fecha_inicio_contrato || 'No especificado'}
                </ThemedText>
                <ThemedText style={styles.detailText}>
                  <ThemedText style={styles.detailLabel}>Cliente/Contrato: </ThemedText>
                  {record.cliente_contrato || 'No especificado'}
                </ThemedText>
                <ThemedText style={styles.detailText}>
                  <ThemedText style={styles.detailLabel}>Ejecutivo/Gerente/Asistente: </ThemedText>
                  {record.ejecutivo_gerente_asistente || 'No especificado'}
                </ThemedText>
                <ThemedText style={styles.detailText}>
                  <ThemedText style={styles.detailLabel}>Lugar servicio: </ThemedText>
                  {record.lugar_servicio || 'No especificado'}
                </ThemedText>
                <ThemedText style={styles.detailText}>
                  <ThemedText style={styles.detailLabel}>Capacitaciones: </ThemedText>
                  {record.capacitaciones || 'No especificado'}
                </ThemedText>
                <ThemedText style={styles.detailText}>
                  <ThemedText style={styles.detailLabel}>Otros datos: </ThemedText>
                  {record.otros_datos || 'No especificado'}
                </ThemedText>

                {personalData.length > 0 && (
                  <ThemedView style={styles.detailSection}>
                    <ThemedText style={styles.detailSectionTitle}>Personal:</ThemedText>
                    {personalData.map((item, index) => (
                      <ThemedView key={index} style={styles.detailItem}>
                        <ThemedText style={styles.detailText}>
                          • <ThemedText style={styles.detailLabel}>Descripción: </ThemedText>
                          {item.descripcion || 'N/A'}
                        </ThemedText>
                        <ThemedText style={styles.detailText}>
                          <ThemedText style={styles.detailLabel}>Cantidad: </ThemedText>
                          {item.cantidad || 'N/A'}
                        </ThemedText>
                        <ThemedText style={styles.detailText}>
                          <ThemedText style={styles.detailLabel}>Observaciones: </ThemedText>
                          {item.observaciones || 'N/A'}
                        </ThemedText>
                      </ThemedView>
                    ))}
                  </ThemedView>
                )}

                {rolesHorariosData.length > 0 && (
                  <ThemedView style={styles.detailSection}>
                    <ThemedText style={styles.detailSectionTitle}>Roles y Horarios:</ThemedText>
                    {rolesHorariosData.map((item, index) => (
                      <ThemedView key={index} style={styles.detailItem}>
                        <ThemedText style={styles.detailText}>
                          • <ThemedText style={styles.detailLabel}>Día inicio: </ThemedText>
                          {item.dia_inicio || 'N/A'}
                        </ThemedText>
                        <ThemedText style={styles.detailText}>
                          <ThemedText style={styles.detailLabel}>Día fin: </ThemedText>
                          {item.dia_fin || 'N/A'}
                        </ThemedText>
                        <ThemedText style={styles.detailText}>
                          <ThemedText style={styles.detailLabel}>Hora inicio: </ThemedText>
                          {item.hora_inicio || 'N/A'}
                        </ThemedText>
                        <ThemedText style={styles.detailText}>
                          <ThemedText style={styles.detailLabel}>Hora fin: </ThemedText>
                          {item.hora_fin || 'N/A'}
                        </ThemedText>
                      </ThemedView>
                    ))}
                  </ThemedView>
                )}

                {desgloseSalariosData.length > 0 && (
                  <ThemedView style={styles.detailSection}>
                    <ThemedText style={styles.detailSectionTitle}>Desglose Salarios:</ThemedText>
                    {desgloseSalariosData.map((item, index) => (
                      <ThemedView key={index} style={styles.detailItem}>
                        <ThemedText style={styles.detailText}>
                          • Salario {index + 1}:
                        </ThemedText>
                        <ThemedText style={styles.detailText}>
                          <ThemedText style={styles.detailLabel}>Salario Base: </ThemedText>
                          {item.salario_base || 'N/A'}
                        </ThemedText>
                        <ThemedText style={styles.detailText}>
                          <ThemedText style={styles.detailLabel}>Horas extras diurnas: </ThemedText>
                          {item.horas_extras_diurnas || 'N/A'}
                        </ThemedText>
                        <ThemedText style={styles.detailText}>
                          <ThemedText style={styles.detailLabel}>Horas extras mixtas: </ThemedText>
                          {item.horas_extras_mixtas || 'N/A'}
                        </ThemedText>
                        <ThemedText style={styles.detailText}>
                          <ThemedText style={styles.detailLabel}>Horas extras nocturnas: </ThemedText>
                          {item.horas_extras_nocturnas || 'N/A'}
                        </ThemedText>
                        <ThemedText style={styles.detailText}>
                          <ThemedText style={styles.detailLabel}>Total: </ThemedText>
                          {item.total || 'N/A'}
                        </ThemedText>
                        <ThemedText style={styles.detailText}>
                          <ThemedText style={styles.detailLabel}>Montos adicionales coordinación: </ThemedText>
                          {item.montos_adicionales_coordinacion || 'N/A'}
                        </ThemedText>
                        <ThemedText style={styles.detailText}>
                          <ThemedText style={styles.detailLabel}>Montos adicionales combustible: </ThemedText>
                          {item.montos_adicionales_combustible || 'N/A'}
                        </ThemedText>
                        <ThemedText style={styles.detailText}>
                          <ThemedText style={styles.detailLabel}>Montos adicionales alquileres: </ThemedText>
                          {item.montos_adicionales_alquileres || 'N/A'}
                        </ThemedText>
                      </ThemedView>
                    ))}
                  </ThemedView>
                )}

                {tipoUniformeData.length > 0 && (
                  <ThemedView style={styles.detailSection}>
                    <ThemedText style={styles.detailSectionTitle}>Tipo de Uniforme:</ThemedText>
                    {tipoUniformeData.map((item, index) => (
                      <ThemedView key={index} style={styles.detailItem}>
                        <ThemedText style={styles.detailText}>
                          • <ThemedText style={styles.detailLabel}>Descripción: </ThemedText>
                          {item.descripcion || 'N/A'}
                        </ThemedText>
                        <ThemedText style={styles.detailText}>
                          <ThemedText style={styles.detailLabel}>Cantidad: </ThemedText>
                          {item.cantidad || 'N/A'}
                        </ThemedText>
                      </ThemedView>
                    ))}
                  </ThemedView>
                )}

                {tipoArmaData.length > 0 && (
                  <ThemedView style={styles.detailSection}>
                    <ThemedText style={styles.detailSectionTitle}>Tipo de Arma:</ThemedText>
                    {tipoArmaData.map((item, index) => (
                      <ThemedView key={index} style={styles.detailItem}>
                        <ThemedText style={styles.detailText}>
                          • <ThemedText style={styles.detailLabel}>Descripción: </ThemedText>
                          {item.descripcion || 'N/A'}
                        </ThemedText>
                        <ThemedText style={styles.detailText}>
                          <ThemedText style={styles.detailLabel}>Cantidad: </ThemedText>
                          {item.cantidad || 'N/A'}
                        </ThemedText>
                      </ThemedView>
                    ))}
                  </ThemedView>
                )}

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
                    onPress={() => deleteContractHandler(record)}
                  >
                    {getActionIcon('delete')}
                    <ThemedText style={styles.listItemButtonText}>Eliminar</ThemedText>
                  </TouchableOpacity>
                </ThemedView>
              </ThemedView>
            </ThemedView>
          );
        })}
      </ThemedView>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <AppHeader onMenuPress={handleMenuPress} title="Datos Básicos de Contrato" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <ThemedView style={styles.contentContainer}>
          <ThemedText type="title" style={styles.screenTitle}>
            {getActionIcon('contract')} Datos Básicos de Contrato
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
              {/* Fecha de inicio del contrato */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Fecha de inicio del contrato</ThemedText>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <ThemedText style={styles.dateButtonText}>
                    {fechaInicioContrato || 'Seleccionar fecha'}
                  </ThemedText>
                  <Ionicons name="calendar" size={20} color="#007AFF" />
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={fechaInicioContrato ? new Date(fechaInicioContrato.split('/').reverse().join('-')) : new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleDateChange}
                  />
                )}
              </ThemedView>

              {/* Cliente/Contrato */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Cliente/Contrato</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Cliente/Contrato"
                  placeholderTextColor="#999"
                  value={clienteContrato}
                  onChangeText={setClienteContrato}
                  color="#000000"
                />
              </ThemedView>

              {/* Ejecutivo de Cuenta / Gerente AyL / Asistente gerencia AyL */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Ejecutivo de Cuenta / Gerente AyL / Asistente gerencia AyL</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Ejecutivo/Gerente/Asistente"
                  placeholderTextColor="#999"
                  value={ejecutivoGerenteAsistente}
                  onChangeText={setEjecutivoGerenteAsistente}
                  color="#000000"
                />
              </ThemedView>

              {/* Personal Section */}
              <ThemedView style={styles.sectionContainer}>
                <ThemedText style={styles.sectionTitle}>Personal</ThemedText>
                {personal.map((item, index) => {
                  const isExpanded = expandedPersonal.includes(index);
                  return (
                    <ThemedView key={index} style={styles.expandableItem}>
                      <TouchableOpacity
                        style={styles.expandableHeader}
                        onPress={() => togglePersonalExpansion(index)}
                      >
                        <ThemedText style={styles.expandableHeaderText}>
                          Personal {index + 1}
                        </ThemedText>
                        <Ionicons
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={20}
                          color="#000000"
                        />
                      </TouchableOpacity>

                      {isExpanded && (
                        <ThemedView style={styles.expandableContent}>
                          {/* Descripción */}
                          <ThemedView style={styles.formGroup}>
                            <ThemedText style={styles.formLabel}>Descripción</ThemedText>
                            <ThemedView style={styles.pickerContainer}>
                              <Picker
                                selectedValue={item.descripcion}
                                onValueChange={(value: string) => updatePersonal(index, 'descripcion', value)}
                                style={styles.picker}
                              >
                                {PERSONAL_DESCRIPTION_OPTIONS.map((option) => (
                                  <Picker.Item
                                    key={option.value}
                                    label={option.label}
                                    value={option.value}
                                  />
                                ))}
                              </Picker>
                            </ThemedView>
                          </ThemedView>

                          {/* Cantidad */}
                          <ThemedView style={styles.formGroup}>
                            <ThemedText style={styles.formLabel}>Cantidad de personal a contratar</ThemedText>
                            <TextInput
                              style={styles.formInput}
                              placeholder="Cantidad"
                              placeholderTextColor="#999"
                              value={item.cantidad}
                              onChangeText={(text) => updatePersonal(index, 'cantidad', text)}
                              keyboardType="numeric"
                              color="#000000"
                            />
                          </ThemedView>

                          {/* Observaciones */}
                          <ThemedView style={styles.formGroup}>
                            <ThemedText style={styles.formLabel}>Observaciones</ThemedText>
                            <TextInput
                              style={[styles.formInput, styles.textArea]}
                              placeholder="Observaciones"
                              placeholderTextColor="#999"
                              multiline
                              numberOfLines={2}
                              textAlignVertical="top"
                              value={item.observaciones}
                              onChangeText={(text) => updatePersonal(index, 'observaciones', text)}
                              color="#000000"
                            />
                          </ThemedView>

                          <TouchableOpacity
                            style={styles.removeButton}
                            onPress={() => removePersonal(index)}
                          >
                            <Ionicons name="trash" size={20} color="#FF3B30" />
                            <ThemedText style={styles.removeButtonText}>Eliminar</ThemedText>
                          </TouchableOpacity>
                        </ThemedView>
                      )}
                    </ThemedView>
                  );
                })}
                <TouchableOpacity style={styles.addButton} onPress={addPersonal}>
                  <Ionicons name="add-circle" size={20} color="#4CAF50" />
                  <ThemedText style={styles.addButtonText}>Agregar Personal</ThemedText>
                </TouchableOpacity>
              </ThemedView>

              {/* Lugar donde se brindará el servicio */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Lugar donde se brindará el servicio</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Lugar donde se brindará el servicio"
                  placeholderTextColor="#999"
                  value={lugarServicio}
                  onChangeText={setLugarServicio}
                  color="#000000"
                />
              </ThemedView>

              {/* Roles y Horarios Section */}
              <ThemedView style={styles.sectionContainer}>
                <ThemedText style={styles.sectionTitle}>Roles y Horarios</ThemedText>
                {rolesHorarios.map((item, index) => {
                  const isExpanded = expandedRolesHorarios.includes(index);
                  return (
                    <ThemedView key={index} style={styles.expandableItem}>
                      <TouchableOpacity
                        style={styles.expandableHeader}
                        onPress={() => toggleRolHorarioExpansion(index)}
                      >
                        <ThemedText style={styles.expandableHeaderText}>
                          Rol y Horario {index + 1}
                        </ThemedText>
                        <Ionicons
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={20}
                          color="#000000"
                        />
                      </TouchableOpacity>

                      {isExpanded && (
                        <ThemedView style={styles.expandableContent}>
                          {/* Día inicio */}
                          <ThemedView style={styles.formGroup}>
                            <ThemedText style={styles.formLabel}>Día inicio</ThemedText>
                            <ThemedView style={styles.pickerContainer}>
                              <Picker
                                selectedValue={item.dia_inicio}
                                onValueChange={(value: string) => updateRolHorario(index, 'dia_inicio', value)}
                                style={styles.picker}
                              >
                                {DIAS_SEMANA_OPTIONS.map((option) => (
                                  <Picker.Item
                                    key={option.value}
                                    label={option.label}
                                    value={option.value}
                                  />
                                ))}
                              </Picker>
                            </ThemedView>
                          </ThemedView>

                          {/* Día fin */}
                          <ThemedView style={styles.formGroup}>
                            <ThemedText style={styles.formLabel}>Día fin</ThemedText>
                            <ThemedView style={styles.pickerContainer}>
                              <Picker
                                selectedValue={item.dia_fin}
                                onValueChange={(value: string) => updateRolHorario(index, 'dia_fin', value)}
                                style={styles.picker}
                              >
                                {DIAS_SEMANA_OPTIONS.map((option) => (
                                  <Picker.Item
                                    key={option.value}
                                    label={option.label}
                                    value={option.value}
                                  />
                                ))}
                              </Picker>
                            </ThemedView>
                          </ThemedView>

                          {/* Hora inicio */}
                          <ThemedView style={styles.formGroup}>
                            <ThemedText style={styles.formLabel}>Hora inicio</ThemedText>
                            <TouchableOpacity
                              style={styles.dateButton}
                              onPress={() => setShowTimePickerRoles({ index, field: 'hora_inicio' })}
                            >
                              <ThemedText style={styles.dateButtonText}>
                                {item.hora_inicio || 'Seleccionar hora'}
                              </ThemedText>
                              <Ionicons name="time-outline" size={20} color="#007AFF" />
                            </TouchableOpacity>
                            {showTimePickerRoles?.index === index && showTimePickerRoles?.field === 'hora_inicio' && (
                              <DateTimePicker
                                value={item.hora_inicio ? new Date(`2000-01-01T${item.hora_inicio}:00`) : new Date()}
                                mode="time"
                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                onChange={handleTimeChangeRoles}
                              />
                            )}
                          </ThemedView>

                          {/* Hora fin */}
                          <ThemedView style={styles.formGroup}>
                            <ThemedText style={styles.formLabel}>Hora fin</ThemedText>
                            <TouchableOpacity
                              style={styles.dateButton}
                              onPress={() => setShowTimePickerRoles({ index, field: 'hora_fin' })}
                            >
                              <ThemedText style={styles.dateButtonText}>
                                {item.hora_fin || 'Seleccionar hora'}
                              </ThemedText>
                              <Ionicons name="time-outline" size={20} color="#007AFF" />
                            </TouchableOpacity>
                            {showTimePickerRoles?.index === index && showTimePickerRoles?.field === 'hora_fin' && (
                              <DateTimePicker
                                value={item.hora_fin ? new Date(`2000-01-01T${item.hora_fin}:00`) : new Date()}
                                mode="time"
                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                onChange={handleTimeChangeRoles}
                              />
                            )}
                          </ThemedView>

                          <TouchableOpacity
                            style={styles.removeButton}
                            onPress={() => removeRolHorario(index)}
                          >
                            <Ionicons name="trash" size={20} color="#FF3B30" />
                            <ThemedText style={styles.removeButtonText}>Eliminar</ThemedText>
                          </TouchableOpacity>
                        </ThemedView>
                      )}
                    </ThemedView>
                  );
                })}
                <TouchableOpacity style={styles.addButton} onPress={addRolHorario}>
                  <Ionicons name="add-circle" size={20} color="#4CAF50" />
                  <ThemedText style={styles.addButtonText}>Agregar Rol y Horario</ThemedText>
                </TouchableOpacity>
              </ThemedView>

              {/* Desglose Salarios Section */}
              <ThemedView style={styles.sectionContainer}>
                <ThemedText style={styles.sectionTitle}>Desglose de Salarios</ThemedText>
                {desgloseSalarios.map((item, index) => {
                  const isExpanded = expandedDesgloseSalarios.includes(index);
                  return (
                    <ThemedView key={index} style={styles.expandableItem}>
                      <TouchableOpacity
                        style={styles.expandableHeader}
                        onPress={() => toggleDesgloseSalarioExpansion(index)}
                      >
                        <ThemedText style={styles.expandableHeaderText}>
                          Salario {index + 1}
                        </ThemedText>
                        <Ionicons
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={20}
                          color="#000000"
                        />
                      </TouchableOpacity>

                      {isExpanded && (
                        <ThemedView style={styles.expandableContent}>
                          {/* Salario Base */}
                          <ThemedView style={styles.formGroup}>
                            <ThemedText style={styles.formLabel}>Salario Base</ThemedText>
                            <TextInput
                              style={styles.formInput}
                              placeholder="Salario Base"
                              placeholderTextColor="#999"
                              value={item.salario_base}
                              onChangeText={(text) => updateDesgloseSalario(index, 'salario_base', text)}
                              keyboardType="numeric"
                              color="#000000"
                            />
                          </ThemedView>

                          {/* Horas extras diurnas */}
                          <ThemedView style={styles.formGroup}>
                            <ThemedText style={styles.formLabel}>Horas extras diurnas</ThemedText>
                            <TextInput
                              style={styles.formInput}
                              placeholder="Horas extras diurnas"
                              placeholderTextColor="#999"
                              value={item.horas_extras_diurnas}
                              onChangeText={(text) => updateDesgloseSalario(index, 'horas_extras_diurnas', text)}
                              keyboardType="numeric"
                              color="#000000"
                            />
                          </ThemedView>

                          {/* Horas extras mixtas */}
                          <ThemedView style={styles.formGroup}>
                            <ThemedText style={styles.formLabel}>Horas extras mixtas</ThemedText>
                            <TextInput
                              style={styles.formInput}
                              placeholder="Horas extras mixtas"
                              placeholderTextColor="#999"
                              value={item.horas_extras_mixtas}
                              onChangeText={(text) => updateDesgloseSalario(index, 'horas_extras_mixtas', text)}
                              keyboardType="numeric"
                              color="#000000"
                            />
                          </ThemedView>

                          {/* Horas extras nocturnas */}
                          <ThemedView style={styles.formGroup}>
                            <ThemedText style={styles.formLabel}>Horas extras nocturnas</ThemedText>
                            <TextInput
                              style={styles.formInput}
                              placeholder="Horas extras nocturnas"
                              placeholderTextColor="#999"
                              value={item.horas_extras_nocturnas}
                              onChangeText={(text) => updateDesgloseSalario(index, 'horas_extras_nocturnas', text)}
                              keyboardType="numeric"
                              color="#000000"
                            />
                          </ThemedView>

                          {/* Total */}
                          <ThemedView style={styles.formGroup}>
                            <ThemedText style={styles.formLabel}>Total</ThemedText>
                            <TextInput
                              style={styles.formInput}
                              placeholder="Total"
                              placeholderTextColor="#999"
                              value={item.total}
                              onChangeText={(text) => updateDesgloseSalario(index, 'total', text)}
                              keyboardType="numeric"
                              color="#000000"
                            />
                          </ThemedView>

                          {/* Montos adicionales coordinación */}
                          <ThemedView style={styles.formGroup}>
                            <ThemedText style={styles.formLabel}>Montos adicionales coordinación</ThemedText>
                            <TextInput
                              style={styles.formInput}
                              placeholder="Montos adicionales coordinación"
                              placeholderTextColor="#999"
                              value={item.montos_adicionales_coordinacion}
                              onChangeText={(text) => updateDesgloseSalario(index, 'montos_adicionales_coordinacion', text)}
                              keyboardType="numeric"
                              color="#000000"
                            />
                          </ThemedView>

                          {/* Montos adicionales combustible */}
                          <ThemedView style={styles.formGroup}>
                            <ThemedText style={styles.formLabel}>Montos adicionales combustible</ThemedText>
                            <TextInput
                              style={styles.formInput}
                              placeholder="Montos adicionales combustible"
                              placeholderTextColor="#999"
                              value={item.montos_adicionales_combustible}
                              onChangeText={(text) => updateDesgloseSalario(index, 'montos_adicionales_combustible', text)}
                              keyboardType="numeric"
                              color="#000000"
                            />
                          </ThemedView>

                          {/* Montos adicionales alquileres */}
                          <ThemedView style={styles.formGroup}>
                            <ThemedText style={styles.formLabel}>Montos adicionales alquileres</ThemedText>
                            <TextInput
                              style={styles.formInput}
                              placeholder="Montos adicionales alquileres"
                              placeholderTextColor="#999"
                              value={item.montos_adicionales_alquileres}
                              onChangeText={(text) => updateDesgloseSalario(index, 'montos_adicionales_alquileres', text)}
                              keyboardType="numeric"
                              color="#000000"
                            />
                          </ThemedView>

                          <TouchableOpacity
                            style={styles.removeButton}
                            onPress={() => removeDesgloseSalario(index)}
                          >
                            <Ionicons name="trash" size={20} color="#FF3B30" />
                            <ThemedText style={styles.removeButtonText}>Eliminar</ThemedText>
                          </TouchableOpacity>
                        </ThemedView>
                      )}
                    </ThemedView>
                  );
                })}
                <TouchableOpacity style={styles.addButton} onPress={addDesgloseSalario}>
                  <Ionicons name="add-circle" size={20} color="#4CAF50" />
                  <ThemedText style={styles.addButtonText}>Agregar Desglose de Salario</ThemedText>
                </TouchableOpacity>
              </ThemedView>

              {/* Tipo de Uniforme Section */}
              <ThemedView style={styles.sectionContainer}>
                <ThemedText style={styles.sectionTitle}>Tipo de Uniforme</ThemedText>
                {tipoUniforme.map((item, index) => {
                  const isExpanded = expandedTipoUniforme.includes(index);
                  return (
                    <ThemedView key={index} style={styles.expandableItem}>
                      <TouchableOpacity
                        style={styles.expandableHeader}
                        onPress={() => toggleTipoUniformeExpansion(index)}
                      >
                        <ThemedText style={styles.expandableHeaderText}>
                          Uniforme {index + 1}
                        </ThemedText>
                        <Ionicons
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={20}
                          color="#000000"
                        />
                      </TouchableOpacity>

                      {isExpanded && (
                        <ThemedView style={styles.expandableContent}>
                          {/* Descripción */}
                          <ThemedView style={styles.formGroup}>
                            <ThemedText style={styles.formLabel}>Descripción</ThemedText>
                            <TextInput
                              style={styles.formInput}
                              placeholder="Descripción"
                              placeholderTextColor="#999"
                              value={item.descripcion}
                              onChangeText={(text) => updateTipoUniforme(index, 'descripcion', text)}
                              color="#000000"
                            />
                          </ThemedView>

                          {/* Cantidad */}
                          <ThemedView style={styles.formGroup}>
                            <ThemedText style={styles.formLabel}>Cantidad</ThemedText>
                            <TextInput
                              style={styles.formInput}
                              placeholder="Cantidad"
                              placeholderTextColor="#999"
                              value={item.cantidad}
                              onChangeText={(text) => updateTipoUniforme(index, 'cantidad', text)}
                              keyboardType="numeric"
                              color="#000000"
                            />
                          </ThemedView>

                          <TouchableOpacity
                            style={styles.removeButton}
                            onPress={() => removeTipoUniforme(index)}
                          >
                            <Ionicons name="trash" size={20} color="#FF3B30" />
                            <ThemedText style={styles.removeButtonText}>Eliminar</ThemedText>
                          </TouchableOpacity>
                        </ThemedView>
                      )}
                    </ThemedView>
                  );
                })}
                <TouchableOpacity style={styles.addButton} onPress={addTipoUniforme}>
                  <Ionicons name="add-circle" size={20} color="#4CAF50" />
                  <ThemedText style={styles.addButtonText}>Agregar Uniforme</ThemedText>
                </TouchableOpacity>
              </ThemedView>

              {/* Tipo de Arma Section */}
              <ThemedView style={styles.sectionContainer}>
                <ThemedText style={styles.sectionTitle}>Tipo de Arma</ThemedText>
                {tipoArma.map((item, index) => {
                  const isExpanded = expandedTipoArma.includes(index);
                  return (
                    <ThemedView key={index} style={styles.expandableItem}>
                      <TouchableOpacity
                        style={styles.expandableHeader}
                        onPress={() => toggleTipoArmaExpansion(index)}
                      >
                        <ThemedText style={styles.expandableHeaderText}>
                          Arma {index + 1}
                        </ThemedText>
                        <Ionicons
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={20}
                          color="#000000"
                        />
                      </TouchableOpacity>

                      {isExpanded && (
                        <ThemedView style={styles.expandableContent}>
                          {/* Descripción */}
                          <ThemedView style={styles.formGroup}>
                            <ThemedText style={styles.formLabel}>Descripción</ThemedText>
                            <TextInput
                              style={styles.formInput}
                              placeholder="Descripción"
                              placeholderTextColor="#999"
                              value={item.descripcion}
                              onChangeText={(text) => updateTipoArma(index, 'descripcion', text)}
                              color="#000000"
                            />
                          </ThemedView>

                          {/* Cantidad */}
                          <ThemedView style={styles.formGroup}>
                            <ThemedText style={styles.formLabel}>Cantidad</ThemedText>
                            <TextInput
                              style={styles.formInput}
                              placeholder="Cantidad"
                              placeholderTextColor="#999"
                              value={item.cantidad}
                              onChangeText={(text) => updateTipoArma(index, 'cantidad', text)}
                              keyboardType="numeric"
                              color="#000000"
                            />
                          </ThemedView>

                          <TouchableOpacity
                            style={styles.removeButton}
                            onPress={() => removeTipoArma(index)}
                          >
                            <Ionicons name="trash" size={20} color="#FF3B30" />
                            <ThemedText style={styles.removeButtonText}>Eliminar</ThemedText>
                          </TouchableOpacity>
                        </ThemedView>
                      )}
                    </ThemedView>
                  );
                })}
                <TouchableOpacity style={styles.addButton} onPress={addTipoArma}>
                  <Ionicons name="add-circle" size={20} color="#4CAF50" />
                  <ThemedText style={styles.addButtonText}>Agregar Arma</ThemedText>
                </TouchableOpacity>
              </ThemedView>

              {/* Capacitaciones especificas del ingreso */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Capacitaciones especificas del ingreso</ThemedText>
                <TextInput
                  style={[styles.formInput, styles.textArea]}
                  placeholder="Capacitaciones especificas del ingreso"
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  value={capacitaciones}
                  onChangeText={setCapacitaciones}
                  color="#000000"
                />
              </ThemedView>

              {/* Cualquier otro dato que considere necesario */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Cualquier otro dato que considere necesario</ThemedText>
                <TextInput
                  style={[styles.formInput, styles.textArea]}
                  placeholder="Cualquier otro dato que considere necesario"
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  value={otrosDatos}
                  onChangeText={setOtrosDatos}
                  color="#000000"
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
                  onPress={editingRecord ? updateContractHandler : saveContractHandler}
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
                <ThemedText style={styles.createButtonText}>Crear Nuevos Datos Básicos de Contrato</ThemedText>
              </TouchableOpacity>
              {renderContractList()}
            </ThemedView>
          )}
        </ThemedView>
      </ScrollView>

      <AppFooter />
      <SlideMenu
        isVisible={isMenuVisible}
        onClose={handleMenuClose}
        onHomePress={handleHomePress}
        currentRoute="ContractBasicData"
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
    minHeight: 80,
    textAlignVertical: 'top',
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
  sectionContainer: {
    marginTop: 20,
    marginBottom: 15,
    padding: 15,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#000000',
  },
  expandableItem: {
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  expandableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F0F0F0',
  },
  expandableHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  expandableContent: {
    padding: 12,
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
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    gap: 8,
    marginTop: 10,
  },
  removeButtonText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '600',
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
  detailSection: {
    marginTop: 10,
    marginBottom: 10,
    padding: 10,
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
  },
  detailSectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000000',
  },
  detailItem: {
    marginBottom: 10,
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
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
    color: '#D32F2F',
    textAlign: 'center',
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 20,
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
    fontSize: 16,
  },
});

