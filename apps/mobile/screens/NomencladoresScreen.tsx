import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Picker } from '@react-native-picker/picker';
import * as Network from 'expo-network';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import AppHeader from '@/components/AppHeader';
import AppFooter from '@/components/AppFooter';
import SlideMenu from '@/components/SlideMenu';
import { useAuth } from '@/contexts/AuthContext';
import authedFetch from '@/hooks/authedFetch';
import getHoraAccion from '@/hooks/getHoraAccion';
import { isStoredPlanillasTokenValid } from '@/hooks/planillasTokenStorage';
import PlanillasPasswordRevalidationModal from '@/components/PlanillasPasswordRevalidationModal';
import {
  EmpleadoLite,
  formatEmpleadoNombre,
  searchEmployeesReportes,
} from '@/hooks/reportesFunctions';
import {
  getMobileVariableInputHint,
  isBooleanVariableType,
  isJsonVariableType,
  validateMobileVariableValue,
} from '@/utils/validateMobileVariable';
import { RootStackParamList } from '../App';

type NomencladoresScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Nomencladores'>;

type NomenclatorFormKind =
  | 'nombre'
  | 'ejecutivo-coordinador'
  | 'empleado-ejecutivo'
  | 'mobile-variable'
  | 'tipo-mantenimiento-articulo';

type NomenclatorRow = {
  id: number;
  nombre: string;
  ejecutivo_cuenta_id?: number;
  coordinador_id?: number;
  empleado_id?: number;
  empleado_codigo?: string;
  empleado_nombre?: string;
  ejecutivo_nombre?: string;
  variable_name?: string;
  slug?: string;
  variable_value?: string;
  variable_type?: string;
  articulo_id?: number;
  articulo_nombre?: string;
};

type SelectOption = { id: number; nombre: string };

type NomenclatorType = {
  slug: string;
  label: string;
  description: string;
  formKind: NomenclatorFormKind;
};

const EJECUTIVO_COORDINADOR_SLUG = 'coordinadores-ejecutivos';
const EMPLEADO_EJECUTIVO_SLUG = 'empleados-ejecutivos';
const MOBILE_VARIABLES_SLUG = 'variables-sistema';
const TIPO_MANTENIMIENTO_ARTICULO_SLUG = 'tipos-mantenimiento-articulos';

/** AsyncStorage keys used by other modules for nomenclador slugs edited here. */
const NOMENCLATOR_SLUG_TO_CACHE_KEY: Record<string, string> = {
  'categorias-mantenimiento': 'categoria_mantenimiento_cache',
  'tipos-producto-no-conforme': 'tipos_producto_no_conforme_cache',
  'tipo-documento': 'document_types_cache',
  'clasificacion-incidentes': 'incidents_classifications_cache',
  'categorias-novedades': 'categories_cache',
  'tipo-activo-visitas': 'tipo_activos_cache',
  'tipo-quejas-clientes': 'tipo_clientes_quejas_cache',
  'tipo-quejas': 'tipo_quejas_cache',
};

async function syncNomenclatorDependentCache(slug: string, rows: unknown[]): Promise<void> {
  const cacheKey = NOMENCLATOR_SLUG_TO_CACHE_KEY[slug];
  if (!cacheKey || !Array.isArray(rows)) return;
  await AsyncStorage.setItem(cacheKey, JSON.stringify(rows));
}

function normalizeBoolForPicker(value: string): string {
  const lower = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'si', 'sí'].includes(lower)) return 'true';
  if (['false', '0', 'no'].includes(lower)) return 'false';
  return 'true';
}

function getVariableKeyboardType(variableType: string): 'default' | 'number-pad' | 'decimal-pad' {
  const type = String(variableType ?? '').trim().toLowerCase();
  if (type === 'int' || type === 'integer') return 'number-pad';
  if (['float', 'decimal', 'double', 'number'].includes(type)) return 'decimal-pad';
  return 'default';
}

const NOMENCLATOR_TYPES: NomenclatorType[] = [
  {
    slug: 'categorias-mantenimiento',
    label: 'Categorías de mantenimiento',
    description: 'Utilizado en el módulo de Equipo del puesto.',
    formKind: 'nombre',
  },
  {
    slug: TIPO_MANTENIMIENTO_ARTICULO_SLUG,
    label: 'Tipo de mantenimiento de artículos',
    description:
      'Especifíca el tipo de mantenimiento que recibirá el artículo en cuestión en el módulo de equipo del puesto.',
    formKind: 'tipo-mantenimiento-articulo',
  },
  {
    slug: 'tipos-producto-no-conforme',
    label: 'Tipos de producto no conforme',
    description: 'Utilizado en el módulo de Producto no conforme.',
    formKind: 'nombre',
  },
  {
    slug: 'tipo-documento',
    label: 'Tipo de documento',
    description: 'Utilizado en el módulo de Documentos entregados.',
    formKind: 'nombre',
  },
  {
    slug: 'clasificacion-incidentes',
    label: 'Clasificación de incidentes',
    description: 'Utilizado en el módulo de Incidentes.',
    formKind: 'nombre',
  },
  {
    slug: 'categorias-novedades',
    label: 'Categorías de novedades',
    description: 'Utilizado en el módulo de Bitácora de Novedades.',
    formKind: 'nombre',
  },
  {
    slug: 'tipo-activo-visitas',
    label: 'Tipo de activos de visitas',
    description: 'Utilizado en el módulo de Registro de personas.',
    formKind: 'nombre',
  },
  {
    slug: 'tipo-quejas-clientes',
    label: 'Tipo de quejas de clientes',
    description: 'Utilizado en el módulo de Maestro de Quejas y reclamos.',
    formKind: 'nombre',
  },
  {
    slug: 'tipo-quejas',
    label: 'Tipo de quejas',
    description: 'Utilizado en el módulo de Maestro de Quejas y reclamos.',
    formKind: 'nombre',
  },
  {
    slug: EJECUTIVO_COORDINADOR_SLUG,
    label: 'Coordinadores ejecutivos',
    description:
      'Vincula un ejecutivo de cuenta con un coordinador, reflejado en acciones y cambios de guardia por mutuos acuerdos, solicitudes de permiso y ausencias en monitoreo.',
    formKind: 'ejecutivo-coordinador',
  },
  {
    slug: EMPLEADO_EJECUTIVO_SLUG,
    label: 'Empleados ejecutivos',
    description:
      'Vincula un ejecutivo de cuenta con un empleado para que reciba notificaciones, solicitudes de permiso, mutuos acuerdos y resolución de incidentes.',
    formKind: 'empleado-ejecutivo',
  },
  {
    slug: MOBILE_VARIABLES_SLUG,
    label: 'Variables del sistema',
    description: 'Administra las variables de configuración utilizadas en la aplicación.',
    formKind: 'mobile-variable',
  },
];

function parseRecordsFromResponse(rows: any[]): NomenclatorRow[] {
  return rows
    .map((x: any) => ({
      id: Number(x?.id),
      nombre: String(x?.nombre ?? '').trim(),
      ejecutivo_cuenta_id: x?.ejecutivo_cuenta_id != null ? Number(x.ejecutivo_cuenta_id) : undefined,
      coordinador_id: x?.coordinador_id != null ? Number(x.coordinador_id) : undefined,
      empleado_id: x?.empleado_id != null ? Number(x.empleado_id) : undefined,
      empleado_codigo: x?.empleado_codigo != null ? String(x.empleado_codigo) : undefined,
      empleado_nombre: x?.empleado_nombre != null ? String(x.empleado_nombre) : undefined,
      ejecutivo_nombre: x?.ejecutivo_nombre != null ? String(x.ejecutivo_nombre) : undefined,
      variable_name: x?.variable_name != null ? String(x.variable_name) : undefined,
      slug: x?.slug != null ? String(x.slug) : undefined,
      variable_value: x?.variable_value != null ? String(x.variable_value) : undefined,
      variable_type: x?.variable_type != null ? String(x.variable_type) : undefined,
      articulo_id: x?.articulo_id != null ? Number(x.articulo_id) : undefined,
      articulo_nombre: x?.articulo_nombre != null ? String(x.articulo_nombre) : undefined,
    }))
    .filter((x) => Number.isFinite(x.id) && x.id > 0 && x.nombre !== '');
}

export default function NomencladoresScreen() {
  const navigation = useNavigation<NomencladoresScreenNavigationProp>();
  const { refreshAccessToken, logout } = useAuth();

  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean | null>(null);

  const [selectedType, setSelectedType] = useState<NomenclatorType | null>(null);
  const [listModalVisible, setListModalVisible] = useState(false);
  const [records, setRecords] = useState<NomenclatorRow[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formNombre, setFormNombre] = useState('');
  const [formEjecutivoId, setFormEjecutivoId] = useState<string>('');
  const [formCoordinadorId, setFormCoordinadorId] = useState<string>('');
  const [ejecutivoOptions, setEjecutivoOptions] = useState<SelectOption[]>([]);
  const [coordinadorOptions, setCoordinadorOptions] = useState<SelectOption[]>([]);
  const [formEmpleadoSearch, setFormEmpleadoSearch] = useState('');
  const [formEmpleadoResults, setFormEmpleadoResults] = useState<EmpleadoLite[]>([]);
  const [selectedEmpleado, setSelectedEmpleado] = useState<EmpleadoLite | null>(null);
  const [employeeSearchLoading, setEmployeeSearchLoading] = useState(false);
  const [formVariableName, setFormVariableName] = useState('');
  const [formVariableSlug, setFormVariableSlug] = useState('');
  const [formVariableType, setFormVariableType] = useState('');
  const [formVariableValue, setFormVariableValue] = useState('');
  const [articuloOptions, setArticuloOptions] = useState<SelectOption[]>([]);
  const [filterArticuloId, setFilterArticuloId] = useState('0');
  const [formArticuloId, setFormArticuloId] = useState('');

  const planillasRevalidationModalShownRef = useRef(false);
  const [showPlanillasRevalidationModal, setShowPlanillasRevalidationModal] = useState(false);
  const pendingPlanillasActionRef = useRef<
    { type: 'save' } | { type: 'delete'; row: NomenclatorRow } | null
  >(null);

  const requestPlanillasRevalidationIfNeeded = useCallback(async (horaAccionMs: number): Promise<boolean> => {
    const tokenCheck = await isStoredPlanillasTokenValid(horaAccionMs);
    if (tokenCheck.valid) {
      planillasRevalidationModalShownRef.current = false;
      return true;
    }

    if (!planillasRevalidationModalShownRef.current) {
      planillasRevalidationModalShownRef.current = true;
      setShowPlanillasRevalidationModal(true);
    }

    return false;
  }, []);

  const handlePlanillasRevalidationSuccess = useCallback(() => {
    setShowPlanillasRevalidationModal(false);
    planillasRevalidationModalShownRef.current = false;
    const pending = pendingPlanillasActionRef.current;
    pendingPlanillasActionRef.current = null;
    if (pending?.type === 'save') {
      void executeSaveRecordRef.current();
    } else if (pending?.type === 'delete') {
      void executeDeleteRecordRef.current(pending.row);
    }
  }, []);

  const handlePlanillasRevalidationDismiss = useCallback(() => {
    planillasRevalidationModalShownRef.current = false;
    pendingPlanillasActionRef.current = null;
    setShowPlanillasRevalidationModal(false);
  }, []);

  const executeSaveRecordRef = useRef<() => Promise<void>>(async () => {});
  const executeDeleteRecordRef = useRef<(row: NomenclatorRow) => Promise<void>>(async () => {});

  const refreshOnlineStatus = useCallback(async () => {
    const networkState = await Network.getNetworkStateAsync();
    const ok = networkState.isConnected === true && networkState.isInternetReachable === true;
    setIsOnline(ok);
    return ok;
  }, []);

  useEffect(() => {
    void refreshOnlineStatus();
  }, [refreshOnlineStatus]);

  const getApiUrl = () => {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');
    return apiUrl;
  };

  const fetchCompositeOptions = useCallback(async () => {
    setLoadingOptions(true);
    try {
      const apiUrl = getApiUrl();
      const response = await authedFetch({
        url: `${apiUrl}/api/nomenclators/${EJECUTIVO_COORDINADOR_SLUG}/options`,
        init: { method: 'GET', headers: { 'Content-Type': 'application/json' } },
        refreshAccessToken,
        logout,
      });
      if (!response) return;

      const data = await response.json();
      if (!response.ok || !data?.status) {
        throw new Error(data?.message || `HTTP error! status: ${response.status}`);
      }

      const ejecutivos = Array.isArray(data.ejecutivos) ? data.ejecutivos : [];
      const coordinadores = Array.isArray(data.coordinadores) ? data.coordinadores : [];

      setEjecutivoOptions(
        ejecutivos
          .map((x: any) => ({ id: Number(x?.id), nombre: String(x?.nombre ?? '').trim() }))
          .filter((x: SelectOption) => Number.isFinite(x.id) && x.id > 0 && x.nombre !== ''),
      );
      setCoordinadorOptions(
        coordinadores
          .map((x: any) => ({ id: Number(x?.id), nombre: String(x?.nombre ?? '').trim() }))
          .filter((x: SelectOption) => Number.isFinite(x.id) && x.id > 0 && x.nombre !== ''),
      );
    } catch (error) {
      console.error('Error fetching composite options:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'No se pudieron cargar las opciones');
      setEjecutivoOptions([]);
      setCoordinadorOptions([]);
    } finally {
      setLoadingOptions(false);
    }
  }, [refreshAccessToken, logout]);

  const fetchEmpleadoEjecutivoOptions = useCallback(async () => {
    setLoadingOptions(true);
    try {
      const apiUrl = getApiUrl();
      const response = await authedFetch({
        url: `${apiUrl}/api/nomenclators/${EMPLEADO_EJECUTIVO_SLUG}/options`,
        init: { method: 'GET', headers: { 'Content-Type': 'application/json' } },
        refreshAccessToken,
        logout,
      });
      if (!response) return;

      const data = await response.json();
      if (!response.ok || !data?.status) {
        throw new Error(data?.message || `HTTP error! status: ${response.status}`);
      }

      const ejecutivos = Array.isArray(data.ejecutivos) ? data.ejecutivos : [];
      setEjecutivoOptions(
        ejecutivos
          .map((x: any) => ({ id: Number(x?.id), nombre: String(x?.nombre ?? '').trim() }))
          .filter((x: SelectOption) => Number.isFinite(x.id) && x.id > 0 && x.nombre !== ''),
      );
      setCoordinadorOptions([]);
    } catch (error) {
      console.error('Error fetching empleado ejecutivo options:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'No se pudieron cargar las opciones');
      setEjecutivoOptions([]);
    } finally {
      setLoadingOptions(false);
    }
  }, [refreshAccessToken, logout]);

  const fetchTipoMantenimientoArticuloOptions = useCallback(async () => {
    setLoadingOptions(true);
    try {
      const apiUrl = getApiUrl();
      const response = await authedFetch({
        url: `${apiUrl}/api/nomenclators/${TIPO_MANTENIMIENTO_ARTICULO_SLUG}/options`,
        init: { method: 'GET', headers: { 'Content-Type': 'application/json' } },
        refreshAccessToken,
        logout,
      });
      if (!response) return;

      const data = await response.json();
      if (!response.ok || !data?.status) {
        throw new Error(data?.message || `HTTP error! status: ${response.status}`);
      }

      const articulos = Array.isArray(data.articulos) ? data.articulos : [];
      setArticuloOptions(
        articulos
          .map((x: any) => ({ id: Number(x?.id), nombre: String(x?.nombre ?? '').trim() }))
          .filter((x: SelectOption) => Number.isFinite(x.id) && x.id > 0 && x.nombre !== ''),
      );
    } catch (error) {
      console.error('Error fetching tipo mantenimiento articulo options:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'No se pudieron cargar las opciones');
      setArticuloOptions([]);
    } finally {
      setLoadingOptions(false);
    }
  }, [refreshAccessToken, logout]);

  const fetchRecords = useCallback(
    async (type: NomenclatorType, articuloFilterId?: string) => {
      const online = await refreshOnlineStatus();
      if (!online) {
        Alert.alert('Sin conexión', 'Esta pantalla requiere conexión a internet.');
        return;
      }

      setLoadingRecords(true);
      try {
        const apiUrl = getApiUrl();
        let url = `${apiUrl}/api/nomenclators/${type.slug}`;
        if (type.formKind === 'tipo-mantenimiento-articulo') {
          const filterId = Number(articuloFilterId ?? filterArticuloId);
          if (Number.isFinite(filterId) && filterId > 0) {
            url += `?articulo_id=${filterId}`;
          }
        }
        const response = await authedFetch({
          url,
          init: { method: 'GET', headers: { 'Content-Type': 'application/json' } },
          refreshAccessToken,
          logout,
        });
        if (!response) return;

        const data = await response.json();
        if (!response.ok || !data?.status) {
          throw new Error(data?.message || `HTTP error! status: ${response.status}`);
        }

        const rows = Array.isArray(data.data) ? data.data : [];
        setRecords(parseRecordsFromResponse(rows));
        await syncNomenclatorDependentCache(type.slug, rows);
      } catch (error) {
        console.error('Error fetching nomenclators:', error);
        Alert.alert('Error', error instanceof Error ? error.message : 'No se pudieron cargar los registros');
        setRecords([]);
      } finally {
        setLoadingRecords(false);
      }
    },
    [refreshAccessToken, logout, refreshOnlineStatus, filterArticuloId],
  );

  const resetFormState = () => {
    setShowForm(false);
    setEditingId(null);
    setFormNombre('');
    setFormEjecutivoId('');
    setFormCoordinadorId('');
    setFormEmpleadoSearch('');
    setFormEmpleadoResults([]);
    setSelectedEmpleado(null);
    setEmployeeSearchLoading(false);
    setFormVariableName('');
    setFormVariableSlug('');
    setFormVariableType('');
    setFormVariableValue('');
    setFormArticuloId('');
  };

  const openTypeModal = async (type: NomenclatorType) => {
    const online = await refreshOnlineStatus();
    if (!online) {
      Alert.alert('Sin conexión', 'Esta pantalla requiere conexión a internet.');
      return;
    }

    setSelectedType(type);
    resetFormState();
    setFilterArticuloId('0');
    setListModalVisible(true);

    if (type.formKind === 'ejecutivo-coordinador') {
      await fetchCompositeOptions();
    }
    if (type.formKind === 'empleado-ejecutivo') {
      await fetchEmpleadoEjecutivoOptions();
    }
    if (type.formKind === 'tipo-mantenimiento-articulo') {
      await fetchTipoMantenimientoArticuloOptions();
    }

    await fetchRecords(type, '0');
  };

  const closeListModal = () => {
    setListModalVisible(false);
    setSelectedType(null);
    setRecords([]);
    resetFormState();
    setEjecutivoOptions([]);
    setCoordinadorOptions([]);
    setFormEmpleadoSearch('');
    setFormEmpleadoResults([]);
    setSelectedEmpleado(null);
    setArticuloOptions([]);
    setFilterArticuloId('0');
  };

  const openCreateForm = () => {
    setEditingId(null);
    setFormNombre('');
    setFormEjecutivoId(ejecutivoOptions[0] ? String(ejecutivoOptions[0].id) : '');
    setFormCoordinadorId(coordinadorOptions[0] ? String(coordinadorOptions[0].id) : '');
    setFormEmpleadoSearch('');
    setFormEmpleadoResults([]);
    setSelectedEmpleado(null);
    const defaultArticuloId =
      filterArticuloId !== '0'
        ? filterArticuloId
        : articuloOptions[0]
          ? String(articuloOptions[0].id)
          : '';
    setFormArticuloId(defaultArticuloId);
    setShowForm(true);
  };

  const openEditForm = (row: NomenclatorRow) => {
    setEditingId(row.id);
    if (selectedType?.formKind === 'ejecutivo-coordinador') {
      setFormEjecutivoId(row.ejecutivo_cuenta_id != null ? String(row.ejecutivo_cuenta_id) : '');
      setFormCoordinadorId(row.coordinador_id != null ? String(row.coordinador_id) : '');
    } else if (selectedType?.formKind === 'empleado-ejecutivo') {
      setFormEjecutivoId(row.ejecutivo_cuenta_id != null ? String(row.ejecutivo_cuenta_id) : '');
      setFormEmpleadoSearch('');
      setFormEmpleadoResults([]);
      setSelectedEmpleado({
        id: row.empleado_id ?? row.id,
        codigo: row.empleado_codigo ?? '',
        nombre: row.empleado_nombre ?? null,
        primer_apellido: null,
        segundo_apellido: null,
      });
    } else if (selectedType?.formKind === 'mobile-variable') {
      const variableType = row.variable_type ?? '';
      const variableValue = row.variable_value ?? '';
      setFormVariableName(row.variable_name ?? row.nombre);
      setFormVariableSlug(row.slug ?? '');
      setFormVariableType(variableType);
      setFormVariableValue(
        isBooleanVariableType(variableType)
          ? normalizeBoolForPicker(variableValue)
          : variableValue,
      );
    } else if (selectedType?.formKind === 'tipo-mantenimiento-articulo') {
      setFormArticuloId(row.articulo_id != null ? String(row.articulo_id) : '');
      setFormNombre(row.nombre);
    } else {
      setFormNombre(row.nombre);
    }
    setShowForm(true);
  };

  const runSearchEmpleado = async () => {
    if (!formEmpleadoSearch.trim()) {
      Alert.alert('Buscar', 'Escriba código o nombre del empleado.');
      return;
    }

    setEmployeeSearchLoading(true);
    try {
      const res = await searchEmployeesReportes({
        q: formEmpleadoSearch.trim(),
        refreshAccessToken,
        logout,
      });
      if (!res.status) {
        Alert.alert('Error', res.message || 'No se pudo buscar empleados');
        return;
      }
      setFormEmpleadoResults(res.data || []);
    } finally {
      setEmployeeSearchLoading(false);
    }
  };

  const pickEmpleado = (empleado: EmpleadoLite) => {
    setSelectedEmpleado(empleado);
    setFormEmpleadoResults([]);
    setFormEmpleadoSearch('');
  };

  const clearSelectedEmpleado = () => {
    setSelectedEmpleado(null);
    setFormEmpleadoSearch('');
    setFormEmpleadoResults([]);
  };

  const cancelForm = () => {
    resetFormState();
  };

  const saveRecord = async () => {
    if (!selectedType) return;

    const online = await refreshOnlineStatus();
    if (!online) {
      Alert.alert('Sin conexión', 'Esta pantalla requiere conexión a internet.');
      return;
    }

    if (selectedType.formKind === 'empleado-ejecutivo') {
      let referenceMs: number;
      try {
        referenceMs = (await getHoraAccion()) || Date.now();
      } catch {
        referenceMs = Date.now();
      }

      const hasValidPlanillasToken = await requestPlanillasRevalidationIfNeeded(referenceMs);
      if (!hasValidPlanillasToken) {
        pendingPlanillasActionRef.current = { type: 'save' };
        return;
      }
    }

    await executeSaveRecordRef.current();
  };

  const executeSaveRecord = async () => {
    if (!selectedType) return;

    let body: Record<string, unknown>;

    if (selectedType.formKind === 'ejecutivo-coordinador') {
      const ejecutivo_cuenta_id = Number(formEjecutivoId);
      const coordinador_id = Number(formCoordinadorId);
      if (!Number.isFinite(ejecutivo_cuenta_id) || ejecutivo_cuenta_id <= 0) {
        Alert.alert('Validación', 'Debe seleccionar un ejecutivo de cuenta.');
        return;
      }
      if (!Number.isFinite(coordinador_id) || coordinador_id <= 0) {
        Alert.alert('Validación', 'Debe seleccionar un coordinador.');
        return;
      }
      body = { ejecutivo_cuenta_id, coordinador_id };
    } else if (selectedType.formKind === 'empleado-ejecutivo') {
      const ejecutivo_cuenta_id = Number(formEjecutivoId);
      if (!Number.isFinite(ejecutivo_cuenta_id) || ejecutivo_cuenta_id <= 0) {
        Alert.alert('Validación', 'Debe seleccionar un ejecutivo de cuenta.');
        return;
      }
      if (!editingId && !selectedEmpleado) {
        Alert.alert('Validación', 'Debe buscar y seleccionar un empleado.');
        return;
      }
      body = editingId
        ? { ejecutivo_cuenta_id }
        : { empleado_id: selectedEmpleado!.id, ejecutivo_cuenta_id };
    } else if (selectedType.formKind === 'mobile-variable') {
      if (!editingId) {
        Alert.alert('Validación', 'Solo se pueden editar variables existentes.');
        return;
      }
      const validation = validateMobileVariableValue(formVariableType, formVariableValue);
      if (!validation.valid) {
        Alert.alert('Validación', validation.message);
        return;
      }
      body = { variable_value: validation.normalizedValue };
    } else if (selectedType.formKind === 'tipo-mantenimiento-articulo') {
      const articulo_id = Number(formArticuloId);
      const nombre = formNombre.trim();
      if (!Number.isFinite(articulo_id) || articulo_id <= 0) {
        Alert.alert('Validación', 'Debe seleccionar un artículo.');
        return;
      }
      if (!nombre) {
        Alert.alert('Validación', 'El nombre es obligatorio.');
        return;
      }
      body = { articulo_id, nombre };
    } else {
      const nombre = formNombre.trim();
      if (!nombre) {
        Alert.alert('Validación', 'El nombre es obligatorio.');
        return;
      }
      body = { nombre };
    }

    setSaving(true);
    try {
      const apiUrl = getApiUrl();
      const isEdit = editingId != null && editingId > 0;
      const url = isEdit
        ? `${apiUrl}/api/nomenclators/${selectedType.slug}/${editingId}`
        : `${apiUrl}/api/nomenclators/${selectedType.slug}`;

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (selectedType.formKind === 'empleado-ejecutivo') {
        let referenceMs: number;
        try {
          referenceMs = (await getHoraAccion()) || Date.now();
        } catch {
          referenceMs = Date.now();
        }
        const planillasTokenCheck = await isStoredPlanillasTokenValid(referenceMs);
        headers['Planillas-Token'] = encodeURIComponent(planillasTokenCheck.token ?? '');
      }

      const response = await authedFetch({
        url,
        init: {
          method: isEdit ? 'PUT' : 'POST',
          headers,
          body: JSON.stringify(body),
        },
        refreshAccessToken,
        logout,
      });
      if (!response) return;

      const data = await response.json();
      if (!response.ok || !data?.status) {
        const message = String(data?.message ?? '').trim() || 'No se pudo guardar el registro';
        Alert.alert(
          response.status === 409 || response.status === 400 ? 'Advertencia' : 'Error',
          message,
        );
        return;
      }

      Alert.alert('Éxito', data?.message || (isEdit ? 'Registro actualizado' : 'Registro creado'));
      cancelForm();
      await fetchRecords(selectedType);
    } catch {
      Alert.alert('Error', 'No se pudo guardar el registro');
    } finally {
      setSaving(false);
    }
  };

  executeSaveRecordRef.current = executeSaveRecord;

  const confirmDelete = (row: NomenclatorRow) => {
    if (!selectedType) return;

    Alert.alert(
      'Eliminar registro',
      `¿Desea eliminar "${row.nombre}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => void deleteRecord(row),
        },
      ],
      { cancelable: true },
    );
  };

  const deleteRecord = async (row: NomenclatorRow) => {
    if (!selectedType) return;

    const online = await refreshOnlineStatus();
    if (!online) {
      Alert.alert('Sin conexión', 'Esta pantalla requiere conexión a internet.');
      return;
    }

    if (selectedType.formKind === 'empleado-ejecutivo') {
      let referenceMs: number;
      try {
        referenceMs = (await getHoraAccion()) || Date.now();
      } catch {
        referenceMs = Date.now();
      }

      const hasValidPlanillasToken = await requestPlanillasRevalidationIfNeeded(referenceMs);
      if (!hasValidPlanillasToken) {
        pendingPlanillasActionRef.current = { type: 'delete', row };
        return;
      }
    }

    await executeDeleteRecordRef.current(row);
  };

  const executeDeleteRecord = async (row: NomenclatorRow) => {
    if (!selectedType) return;

    setSaving(true);
    try {
      const apiUrl = getApiUrl();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (selectedType.formKind === 'empleado-ejecutivo') {
        let referenceMs: number;
        try {
          referenceMs = (await getHoraAccion()) || Date.now();
        } catch {
          referenceMs = Date.now();
        }
        const planillasTokenCheck = await isStoredPlanillasTokenValid(referenceMs);
        headers['Planillas-Token'] = encodeURIComponent(planillasTokenCheck.token ?? '');
      }

      const response = await authedFetch({
        url: `${apiUrl}/api/nomenclators/${selectedType.slug}/${row.id}`,
        init: { method: 'DELETE', headers },
        refreshAccessToken,
        logout,
      });
      if (!response) return;

      const data = await response.json();
      if (!response.ok || !data?.status) {
        const message = String(data?.message ?? '').trim() || 'No se pudo eliminar el registro';
        Alert.alert(
          response.status === 409 || response.status === 400 ? 'Advertencia' : 'Error',
          message,
        );
        return;
      }

      Alert.alert('Éxito', data?.message || 'Registro eliminado');
      await fetchRecords(selectedType);
    } catch {
      Alert.alert('Error', 'No se pudo eliminar el registro');
    } finally {
      setSaving(false);
    }
  };

  executeDeleteRecordRef.current = executeDeleteRecord;

  const handleMenuPress = () => setIsMenuVisible(true);
  const handleMenuClose = () => setIsMenuVisible(false);
  const handleHomePress = () => {
    navigation.navigate('Home');
    setIsMenuVisible(false);
  };

  const isCompositeForm = selectedType?.formKind === 'ejecutivo-coordinador';
  const isEmpleadoEjecutivoForm = selectedType?.formKind === 'empleado-ejecutivo';
  const isMobileVariableForm = selectedType?.formKind === 'mobile-variable';
  const isTipoMantenimientoArticuloForm = selectedType?.formKind === 'tipo-mantenimiento-articulo';
  const isEditOnlyForm = isMobileVariableForm;
  const isOptionsForm = isCompositeForm || isEmpleadoEjecutivoForm || isTipoMantenimientoArticuloForm;

  const handleFilterArticuloChange = (value: string) => {
    setFilterArticuloId(value);
    if (selectedType?.formKind === 'tipo-mantenimiento-articulo') {
      void fetchRecords(selectedType, value);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <AppHeader title="Nomencladores" onMenuPress={handleMenuPress} />

      {isOnline === false ? (
        <ThemedView style={styles.banner}>
          <ThemedText style={styles.bannerTxt}>
            Sin conexión a internet. Esta pantalla no está disponible.
          </ThemedText>
        </ThemedView>
      ) : null}

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ThemedView style={styles.titleContainer}>
          <ThemedText type="title" style={styles.title}>
            <Ionicons name="albums" size={22} color="#000000" /> Nomencladores
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            Administra los catálogos de referencia del sistema. Requiere conexión a internet.
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.listContainer}>
          {NOMENCLATOR_TYPES.map((type) => (
            <TouchableOpacity
              key={type.slug}
              style={[styles.typeButton, isOnline === false && styles.typeButtonDisabled]}
              onPress={() => void openTypeModal(type)}
              disabled={isOnline === false}
              activeOpacity={0.85}
            >
              <View style={styles.typeButtonContent}>
                <ThemedText style={styles.typeButtonText}>{type.label}</ThemedText>
                <ThemedText style={styles.typeButtonDescription}>{type.description}</ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#007AFF" />
            </TouchableOpacity>
          ))}
        </ThemedView>
      </ScrollView>

      <AppFooter />

      <PlanillasPasswordRevalidationModal
        visible={showPlanillasRevalidationModal}
        refreshAccessToken={refreshAccessToken}
        logout={logout}
        onSuccess={handlePlanillasRevalidationSuccess}
        onDismiss={handlePlanillasRevalidationDismiss}
      />

      <SlideMenu
        isVisible={isMenuVisible}
        onClose={handleMenuClose}
        onHomePress={handleHomePress}
        currentRoute="Nomencladores"
      />

      <Modal
        visible={listModalVisible}
        animationType="fade"
        transparent
        presentationStyle="overFullScreen"
        onRequestClose={closeListModal}
      >
        <View style={styles.overlay}>
          <ThemedView style={styles.floatModalCard}>
            <ThemedView style={styles.floatModalHeader}>
              <ThemedText style={styles.modalTitle}>{selectedType?.label ?? 'Nomenclador'}</ThemedText>
              <TouchableOpacity onPress={closeListModal} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </ThemedView>

            <ScrollView
              style={styles.floatModalScroll}
              contentContainerStyle={styles.floatModalScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {!showForm && !isEditOnlyForm ? (
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={openCreateForm}
                  activeOpacity={0.85}
                  disabled={
                    (isCompositeForm && (loadingOptions || (!ejecutivoOptions.length && !coordinadorOptions.length))) ||
                    (isEmpleadoEjecutivoForm && loadingOptions && !ejecutivoOptions.length) ||
                    (isTipoMantenimientoArticuloForm && (loadingOptions || !articuloOptions.length))
                  }
                >
                  <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
                  <ThemedText style={styles.primaryBtnText}>Nuevo registro</ThemedText>
                </TouchableOpacity>
              ) : showForm ? (
                <ThemedView style={styles.formCard}>
                  <ThemedText style={styles.formTitle}>
                    {isMobileVariableForm ? 'Editar variable' : editingId ? 'Editar registro' : 'Nuevo registro'}
                  </ThemedText>

                  {isCompositeForm ? (
                    loadingOptions ? (
                      <ThemedView style={styles.loadingBox}>
                        <ActivityIndicator size="small" color="#007AFF" />
                        <ThemedText style={styles.loadingText}>Cargando opciones...</ThemedText>
                      </ThemedView>
                    ) : (
                      <>
                        <ThemedText style={styles.label}>Ejecutivo de cuenta</ThemedText>
                        <View style={styles.pickerWrapper}>
                          <Picker
                            selectedValue={formEjecutivoId}
                            onValueChange={(v) => setFormEjecutivoId(String(v))}
                            style={styles.picker}
                          >
                            {ejecutivoOptions.length === 0 ? (
                              <Picker.Item label="Sin opciones disponibles" value="" color="#000000" />
                            ) : (
                              ejecutivoOptions.map((opt) => (
                                <Picker.Item key={`ej-${opt.id}`} label={opt.nombre} value={String(opt.id)} color="#000000" />
                              ))
                            )}
                          </Picker>
                        </View>

                        <ThemedText style={styles.label}>Coordinador</ThemedText>
                        <View style={styles.pickerWrapper}>
                          <Picker
                            selectedValue={formCoordinadorId}
                            onValueChange={(v) => setFormCoordinadorId(String(v))}
                            style={styles.picker}
                          >
                            {coordinadorOptions.length === 0 ? (
                              <Picker.Item label="Sin opciones disponibles" value="" color="#000000" />
                            ) : (
                              coordinadorOptions.map((opt) => (
                                <Picker.Item key={`co-${opt.id}`} label={opt.nombre} value={String(opt.id)} color="#000000" />
                              ))
                            )}
                          </Picker>
                        </View>
                      </>
                    )
                  ) : isEmpleadoEjecutivoForm ? (
                    loadingOptions ? (
                      <ThemedView style={styles.loadingBox}>
                        <ActivityIndicator size="small" color="#007AFF" />
                        <ThemedText style={styles.loadingText}>Cargando opciones...</ThemedText>
                      </ThemedView>
                    ) : (
                      <>
                        <ThemedText style={styles.label}>Empleado</ThemedText>
                        {editingId && selectedEmpleado ? (
                          <ThemedView style={styles.selectedEmpleadoBox}>
                            <ThemedText style={styles.selectedEmpleadoText}>
                              {selectedEmpleado.codigo} — {formatEmpleadoNombre(selectedEmpleado)}
                            </ThemedText>
                          </ThemedView>
                        ) : (
                          <>
                            <View style={styles.row}>
                              <TextInput
                                style={[styles.input, styles.inputFlex]}
                                value={formEmpleadoSearch}
                                onChangeText={setFormEmpleadoSearch}
                                placeholder="Código o nombre del empleado"
                                placeholderTextColor="#999"
                                onSubmitEditing={() => void runSearchEmpleado()}
                              />
                              <TouchableOpacity
                                style={styles.searchIconBtn}
                                onPress={() => void runSearchEmpleado()}
                                activeOpacity={0.85}
                                disabled={employeeSearchLoading}
                              >
                                {employeeSearchLoading ? (
                                  <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                  <Ionicons name="search" size={22} color="#fff" />
                                )}
                              </TouchableOpacity>
                            </View>
                            {formEmpleadoResults.length ? (
                              <ThemedView style={styles.resultList}>
                                {formEmpleadoResults.map((e) => (
                                  <TouchableOpacity
                                    key={e.id}
                                    style={styles.resultItem}
                                    onPress={() => pickEmpleado(e)}
                                  >
                                    <ThemedText>
                                      {e.codigo} — {formatEmpleadoNombre(e)}
                                    </ThemedText>
                                  </TouchableOpacity>
                                ))}
                              </ThemedView>
                            ) : null}
                            {selectedEmpleado ? (
                              <ThemedView style={styles.selectedEmpleadoBox}>
                                <ThemedText style={styles.selectedEmpleadoText}>
                                  {selectedEmpleado.codigo} — {formatEmpleadoNombre(selectedEmpleado)}
                                </ThemedText>
                                <TouchableOpacity onPress={clearSelectedEmpleado} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                  <Ionicons name="close-circle" size={20} color="#FF3B30" />
                                </TouchableOpacity>
                              </ThemedView>
                            ) : null}
                          </>
                        )}

                        <ThemedText style={styles.label}>Ejecutivo de cuenta</ThemedText>
                        <View style={styles.pickerWrapper}>
                          <Picker
                            selectedValue={formEjecutivoId}
                            onValueChange={(v) => setFormEjecutivoId(String(v))}
                            style={styles.picker}
                          >
                            {ejecutivoOptions.length === 0 ? (
                              <Picker.Item label="Sin opciones disponibles" value="" color="#000000" />
                            ) : (
                              ejecutivoOptions.map((opt) => (
                                <Picker.Item key={`eej-${opt.id}`} label={opt.nombre} value={String(opt.id)} color="#000000" />
                              ))
                            )}
                          </Picker>
                        </View>
                      </>
                    )
                  ) : isTipoMantenimientoArticuloForm ? (
                    loadingOptions ? (
                      <ThemedView style={styles.loadingBox}>
                        <ActivityIndicator size="small" color="#007AFF" />
                        <ThemedText style={styles.loadingText}>Cargando opciones...</ThemedText>
                      </ThemedView>
                    ) : (
                      <>
                        <ThemedText style={styles.label}>Artículo</ThemedText>
                        <View style={styles.pickerWrapper}>
                          <Picker
                            selectedValue={formArticuloId}
                            onValueChange={(v) => setFormArticuloId(String(v))}
                            style={styles.picker}
                          >
                            {articuloOptions.length === 0 ? (
                              <Picker.Item label="Sin opciones disponibles" value="" color="#000000" />
                            ) : (
                              articuloOptions.map((opt) => (
                                <Picker.Item
                                  key={`art-${opt.id}`}
                                  label={opt.nombre}
                                  value={String(opt.id)}
                                  color="#000000"
                                />
                              ))
                            )}
                          </Picker>
                        </View>

                        <ThemedText style={styles.label}>Nombre</ThemedText>
                        <TextInput
                          style={styles.input}
                          value={formNombre}
                          onChangeText={setFormNombre}
                          placeholder="Nombre del tipo de mantenimiento"
                          placeholderTextColor="#999"
                        />
                      </>
                    )
                  ) : isMobileVariableForm ? (
                    <>
                      <ThemedText style={styles.label}>Variable</ThemedText>
                      <ThemedView style={styles.readOnlyBox}>
                        <ThemedText style={styles.readOnlyText}>{formVariableName}</ThemedText>
                      </ThemedView>

                      {formVariableSlug ? (
                        <>
                          <ThemedText style={styles.label}>Slug</ThemedText>
                          <ThemedView style={styles.readOnlyBox}>
                            <ThemedText style={styles.readOnlyText}>{formVariableSlug}</ThemedText>
                          </ThemedView>
                        </>
                      ) : null}

                      <ThemedText style={styles.label}>Tipo</ThemedText>
                      <ThemedView style={styles.readOnlyBox}>
                        <ThemedText style={styles.readOnlyText}>{formVariableType}</ThemedText>
                      </ThemedView>

                      <ThemedText style={styles.label}>
                        Valor ({getMobileVariableInputHint(formVariableType)})
                      </ThemedText>
                      {isBooleanVariableType(formVariableType) ? (
                        <View style={styles.pickerWrapper}>
                          <Picker
                            selectedValue={formVariableValue}
                            onValueChange={(v) => setFormVariableValue(String(v))}
                            style={styles.picker}
                          >
                            <Picker.Item label="Verdadero (true)" value="true" color="#000000" />
                            <Picker.Item label="Falso (false)" value="false" color="#000000" />
                          </Picker>
                        </View>
                      ) : (
                        <TextInput
                          style={[styles.input, isJsonVariableType(formVariableType) && styles.textArea]}
                          value={formVariableValue}
                          onChangeText={setFormVariableValue}
                          placeholder={getMobileVariableInputHint(formVariableType)}
                          placeholderTextColor="#999"
                          keyboardType={getVariableKeyboardType(formVariableType)}
                          multiline={isJsonVariableType(formVariableType)}
                          textAlignVertical={isJsonVariableType(formVariableType) ? 'top' : 'auto'}
                          autoCapitalize="none"
                          autoCorrect={false}
                        />
                      )}
                    </>
                  ) : (
                    <>
                      <ThemedText style={styles.label}>Nombre</ThemedText>
                      <TextInput
                        style={styles.input}
                        value={formNombre}
                        onChangeText={setFormNombre}
                        placeholder="Nombre del registro"
                        placeholderTextColor="#999"
                      />
                    </>
                  )}

                  <View style={styles.formActions}>
                    <TouchableOpacity style={styles.secondaryBtn} onPress={cancelForm} disabled={saving}>
                      <ThemedText style={styles.secondaryBtnText}>Cancelar</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.primaryBtn, styles.primaryBtnInline, saving && { opacity: 0.7 }]}
                      onPress={() => void saveRecord()}
                      disabled={saving || (isOptionsForm && loadingOptions)}
                    >
                      {saving ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons name="save-outline" size={18} color="#FFFFFF" />
                          <ThemedText style={styles.primaryBtnText}>Guardar</ThemedText>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </ThemedView>
              ) : null}

              {!showForm && isTipoMantenimientoArticuloForm ? (
                <>
                  <ThemedText style={styles.label}>Filtrar por artículo</ThemedText>
                  <View style={styles.pickerWrapper}>
                    <Picker
                      selectedValue={filterArticuloId}
                      onValueChange={(v) => handleFilterArticuloChange(String(v))}
                      style={styles.picker}
                      enabled={!loadingRecords && !loadingOptions}
                    >
                      <Picker.Item label="Todos los artículos" value="0" color="#000000" />
                      {articuloOptions.map((opt) => (
                        <Picker.Item
                          key={`filter-art-${opt.id}`}
                          label={opt.nombre}
                          value={String(opt.id)}
                          color="#000000"
                        />
                      ))}
                    </Picker>
                  </View>
                </>
              ) : null}

              {loadingRecords ? (
                <ThemedView style={styles.loadingBox}>
                  <ActivityIndicator size="large" color="#007AFF" />
                  <ThemedText style={styles.loadingText}>Cargando registros...</ThemedText>
                </ThemedView>
              ) : records.length === 0 ? (
                <ThemedView style={styles.emptyBox}>
                  <ThemedText style={styles.emptyText}>No hay registros en este nomenclador.</ThemedText>
                </ThemedView>
              ) : (
                records.map((row) => (
                  <ThemedView key={row.id} style={styles.recordRow}>
                    <View style={styles.recordInfo}>
                      <ThemedText style={styles.recordName}>
                        {isEditOnlyForm ? row.slug : row.nombre}
                      </ThemedText>
                      {isEditOnlyForm && row.variable_type ? (
                        <ThemedText style={styles.recordMeta}>
                          {row.variable_type} · {row.variable_value ?? ''}
                        </ThemedText>
                      ) : null}
                      {isTipoMantenimientoArticuloForm && row.articulo_nombre ? (
                        <ThemedText style={styles.recordMeta}>Artículo: {row.articulo_nombre}</ThemedText>
                      ) : null}
                    </View>
                    <View style={styles.recordActions}>
                      <TouchableOpacity
                        style={styles.iconBtn}
                        onPress={() => openEditForm(row)}
                        disabled={saving}
                      >
                        <Ionicons name="create-outline" size={20} color="#007AFF" />
                      </TouchableOpacity>
                      {!isEditOnlyForm ? (
                        <TouchableOpacity
                          style={styles.iconBtn}
                          onPress={() => confirmDelete(row)}
                          disabled={saving}
                        >
                          <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </ThemedView>
                ))
              )}
            </ScrollView>
          </ThemedView>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, flexGrow: 1 },
  banner: {
    backgroundColor: '#FFECEC',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#FFD6D6',
  },
  bannerTxt: { color: '#C00', textAlign: 'center', fontWeight: '600' },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    width: '100%',
  },
  title: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#555', textAlign: 'center' },
  listContainer: { gap: 10 },
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 10,
  },
  typeButtonDisabled: { opacity: 0.5 },
  typeButtonContent: { flex: 1, paddingRight: 4, gap: 4 },
  typeButtonText: { fontSize: 15, fontWeight: '600', color: '#000' },
  typeButtonDescription: { fontSize: 12, lineHeight: 17, color: '#666' },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  floatModalCard: {
    width: '100%',
    maxWidth: 820,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
    maxHeight: '92%',
  },
  floatModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#F8F9FA',
  },
  modalTitle: { fontSize: 16, fontWeight: '900', color: '#000', flex: 1, paddingRight: 8 },
  floatModalScroll: { maxHeight: Dimensions.get('window').height * 0.76 },
  floatModalScrollContent: { padding: 14, paddingBottom: 24 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 12,
    marginBottom: 14,
  },
  primaryBtnInline: { flex: 1, marginBottom: 0 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  secondaryBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#D0D0D0',
    backgroundColor: '#F8F8F8',
  },
  secondaryBtnText: { color: '#333', fontSize: 14, fontWeight: '700' },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 14,
  },
  formTitle: { fontSize: 15, fontWeight: '900', color: '#007AFF', marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '700', color: '#333', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#D0D0D0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#000',
    backgroundColor: '#FFFFFF',
    marginBottom: 10,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#D0D0D0',
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  picker: { color: '#000' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  inputFlex: { flex: 1, marginBottom: 0 },
  searchIconBtn: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultList: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, overflow: 'hidden', marginBottom: 10 },
  resultItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#E8E8E8', backgroundColor: '#FFFFFF' },
  selectedEmpleadoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderWidth: 1,
    borderColor: '#C8E1FF',
    backgroundColor: '#EEF6FF',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  selectedEmpleadoText: { flex: 1, fontSize: 14, color: '#000' },
  readOnlyBox: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  readOnlyText: { fontSize: 14, color: '#333' },
  textArea: { minHeight: 100, textAlignVertical: 'top' as const },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    backgroundColor: '#FAFAFA',
  },
  recordInfo: { flex: 1, paddingRight: 8 },
  recordName: { fontSize: 14, color: '#000' },
  recordMeta: { fontSize: 12, color: '#666', marginTop: 2 },
  recordActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtn: { padding: 6 },
  loadingBox: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  loadingText: { color: '#666', fontSize: 14 },
  emptyBox: { alignItems: 'center', paddingVertical: 20 },
  emptyText: { color: '#666', fontSize: 14, textAlign: 'center' },
});
