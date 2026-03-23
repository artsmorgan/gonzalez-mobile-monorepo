import React, { useState, useCallback, useRef, useEffect } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, View, Image, Modal, Dimensions, Platform } from 'react-native';
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
import { createVisitor as createVisitorAPI, updateVisitor as updateVisitorAPI, deleteVisitor as deleteVisitorAPI } from '@/hooks/visitorsFunctions';
import { CameraView, useCameraPermissions } from 'expo-camera';
import getHoraAccion from '@/hooks/getHoraAccion';
import { eventBus } from '@/hooks/eventBus';
import authedFetch from '@/hooks/authedFetch';
import DateTimePicker from '@react-native-community/datetimepicker';

type VisitorsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Visitors'>;

interface Responsable {
  id: number;
  nombre: string;
}

interface TipoActivo {
  id: number;
  nombre: string;
}

interface ActivoDetalle {
  detalle: string;
  descripcion: string;
}

interface Activo {
  tipo: TipoActivo;
  nombre?: string;
  detalles: ActivoDetalle[];
  numero_id: string;
  numero_activo: string;
}

interface Visitor {
  id: number;
  nombre: string;
  cedula: string;
  hora_entrada: string;
  hora_salida: string | null;
  razon_visita: string;
  dep_pers_visita?: string | null;
  responsable: Responsable;
  es_funcionario: boolean;
  observaciones: string | null;
  tipo_accion: string | null;
  pers_autoriza_salida: string | null;
  foto_cedula: string | null;
  activos: Activo[];
  created_at?: string;
  updated_at: string;
  id_local: string;
}

interface EditingVisitor {
  id: number | null;
  id_local: string;
  nombre: string;
  cedula: string;
  hora_entrada_fecha: string;
  hora_entrada_h: string;
  hora_entrada_m: string;
  hora_salida_fecha: string;
  hora_salida_h: string;
  hora_salida_m: string;
  razon_visita: string;
  dep_pers_visita: string;
  es_funcionario: boolean;
  observaciones: string;
  tipo_accion: string;
  pers_autoriza_salida: string;
  foto_cedula: string | null;
  foto_cedula_nueva: string | null;
  activos: EditingActivo[];
}

interface EditingActivo {
  tipo_id: number | null;
  nombre: string;
  detalles: EditingDetalle[];
  numero_id: string;
  numero_activo: string;
}

interface EditingDetalle {
  detalle: string;
  descripcion: string;
}

export default function VisitorsScreen() {
  const { employee, refreshAccessToken, logout, accessToken } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<VisitorsScreenNavigationProp>();
  const appendTokenToUrl = (url: string) => {
    if (!url) return '';
    if (!accessToken || accessToken.trim().length === 0) return url;
    if (/[?&]token=/.test(url)) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}token=${encodeURIComponent(accessToken)}`;
  };

  const getVisitorCedulaImageUrl = (visitorId: number | string, fotoCedula: string | null): string | null => {
    if (!fotoCedula || typeof fotoCedula !== 'string' || fotoCedula.trim() === '') return null;
    if (fotoCedula.startsWith('data:')) return null;
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) return null;
    const id = typeof visitorId === 'string' ? parseInt(visitorId, 10) : visitorId;
    if (Number.isNaN(id) || id <= 0) return null;
    const encodedName = encodeURIComponent(fotoCedula.trim());
    return appendTokenToUrl(`${apiUrl}/api/uploads/visitors/${id}/cedula?name=${encodedName}`);
  };

  // Visitors state
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasCurrentMarca, setHasCurrentMarca] = useState<boolean>(false);

  // Editing state
  const [editingVisitor, setEditingVisitor] = useState<EditingVisitor | null>(null);

  // Creating state
  const [isCreating, setIsCreating] = useState(false);
  const [newVisitor, setNewVisitor] = useState<EditingVisitor>({
    id: null,
    id_local: '',
    nombre: '',
    cedula: '',
    hora_entrada_fecha: '',
    hora_entrada_h: '',
    hora_entrada_m: '',
    hora_salida_fecha: '',
    hora_salida_h: '',
    hora_salida_m: '',
    razon_visita: '',
    dep_pers_visita: '',
    es_funcionario: false,
    observaciones: '',
    tipo_accion: '',
    pers_autoriza_salida: '',
    foto_cedula: null,
    foto_cedula_nueva: null,
    activos: [],
  });

  // Form refs for text inputs (main fields only, activos/detalles remain in state due to dynamic arrays)
  const nombreRef = useRef('');
  const cedulaRef = useRef('');
  const horaEntradaFechaRef = useRef('');
  const horaEntradaHRef = useRef('');
  const horaEntradaMRef = useRef('');
  const horaSalidaFechaRef = useRef('');
  const horaSalidaHRef = useRef('');
  const horaSalidaMRef = useRef('');
  const razonVisitaRef = useRef('');
  const depPersVisitaRef = useRef('');
  const observacionesRef = useRef('');
  const persAutorizaSalidaRef = useRef('');

  // Filters state
  const [searchText, setSearchText] = useState('');
  const [selectedTipoVisitante, setSelectedTipoVisitante] = useState<string>('all');
  const [filterDesde, setFilterDesde] = useState('');
  const [filterHasta, setFilterHasta] = useState('');
  const [filterNombreActivo, setFilterNombreActivo] = useState('');
  const [filterSinHoraSalida, setFilterSinHoraSalida] = useState(false);
  const [filterSinActivos, setFilterSinActivos] = useState(false);
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);

  // Expanded details state
  const [expandedVisitorIds, setExpandedVisitorIds] = useState<number[]>([]);

  // Camera state
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [isEditingCamera, setIsEditingCamera] = useState(false);
  const [showVisitorDatePicker, setShowVisitorDatePicker] = useState(false);
  const [showVisitorTimePicker, setShowVisitorTimePicker] = useState(false);
  const [visitorPickerValue, setVisitorPickerValue] = useState(new Date());
  const [visitorPickerField, setVisitorPickerField] = useState<'entrada_fecha' | 'entrada_hora' | 'salida_fecha' | 'salida_hora' | null>(null);

  // Asset types cache
  const [tipoActivos, setTipoActivos] = useState<TipoActivo[]>([]);

  // Modal: ver cambios (auditoría)
  const [isCambiosModalVisible, setIsCambiosModalVisible] = useState(false);
  const [cambiosTitle, setCambiosTitle] = useState<string>('Cambios');
  const [cambiosItems, setCambiosItems] = useState<any[]>([]);
  const [expandedCambioId, setExpandedCambioId] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  useEffect(() => {
    const handler = () => {
      loadData();
    };

    eventBus.on('connectionRestored', handler);
    return () => {
      eventBus.off('connectionRestored', handler);
    };
  }, []);

  const loadData = async () => {
    try {
      // Ejecutar fetch de tipos de activos primero
      await fetchTipoActivos();
      // Luego fetch de visitantes
      await fetchVisitors();
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const getConnectionStatus = async () => {
    const networkState = await Network.getNetworkStateAsync();
    return networkState.isConnected && networkState.isInternetReachable;
  };

  const closeCambiosModal = () => {
    setIsCambiosModalVisible(false);
    setCambiosItems([]);
    setExpandedCambioId(null);
  };

  const formatCambioCreatedAt = (value: any) => {
    if (!value) return '';
    try {
      const d = new Date(String(value));
      if (isNaN(d.getTime())) return String(value);
      const day = d.getDate().toString().padStart(2, '0');
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const year = d.getFullYear();
      const hours = d.getHours().toString().padStart(2, '0');
      const minutes = d.getMinutes().toString().padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch {
      return String(value);
    }
  };

  const formatActivosForDisplay = (activos: any): string => {
    if (!activos) return '';
    try {
      // Si viene como string JSON, parsearlo
      const activosArray = typeof activos === 'string' ? JSON.parse(activos) : activos;
      if (!Array.isArray(activosArray)) return String(activos);

      if (activosArray.length === 0) return 'Sin activos';

      return activosArray.map((activo: any, idx: number) => {
        const partes: string[] = [];
        partes.push(`Activo ${idx + 1}`);
        if (activo.tipo?.nombre) partes.push(`Tipo: ${activo.tipo.nombre}`);
        if (activo.tipo_id && !activo.tipo?.nombre) partes.push(`Tipo ID: ${activo.tipo_id}`);
        if (activo.nombre) partes.push(`Nombre: ${activo.nombre}`);
        if (activo.numero_id) partes.push(`Nº identificador: ${activo.numero_id}`);
        if (activo.numero_activo) partes.push(`N° Activo: ${activo.numero_activo}`);

        if (activo.detalles && Array.isArray(activo.detalles) && activo.detalles.length > 0) {
          const detallesStr = activo.detalles
            .map((d: any) => `${d.detalle || ''}: ${d.descripcion || ''}`)
            .filter((s: string) => s.trim())
            .join('; ');
          if (detallesStr) partes.push(`Detalles: ${detallesStr}`);
        }

        return partes.join(' | ');
      }).join('\n');
    } catch {
      return String(activos);
    }
  };

  const formatCambioLabel = (prop: string): string => {
    if (prop === 'dep_pers_visita') return 'Persona/Departamento que visita';
    return prop;
  };

  const formatChangeValue = (prop: string, value: any): string => {
    if (prop === 'activos') {
      return formatActivosForDisplay(value);
    }
    if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
      try {
        return JSON.stringify(value, null, 2);
      } catch {
        return String(value);
      }
    }
    return String(value ?? '');
  };

  const fetchCambios = useCallback(async (tabla: string, registroId: number) => {
    const isConnected = await getConnectionStatus();
    if (!isConnected) {
      Alert.alert('Sin conexión', 'Esta función solo está disponible con conexión a internet.');
      return;
    }
    try {
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) throw new Error('Server URL not configured');
      const resp = await authedFetch({
        url: `${apiUrl}/api/cambios-apps-modules?tabla=${encodeURIComponent(tabla)}&registro_id=${registroId}`,
        init: {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        },
        refreshAccessToken,
        logout,
      });
      if (!resp) return;

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.status) {
        throw new Error(data.message || 'No se pudieron cargar los cambios');
      }
      setCambiosItems(Array.isArray(data.data) ? data.data : []);
      setIsCambiosModalVisible(true);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'No se pudieron cargar los cambios');
    }
  }, [refreshAccessToken, logout]);

  const fetchTipoActivos = async () => {
    try {
      // Verificar conectividad
      const isConnected = await getConnectionStatus();

      if (isConnected) {
        // Con internet: hacer fetch normal
        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) {
          throw new Error('Server URL not configured');
        }

        const response = await authedFetch({
          url: `${apiUrl}/api/visitors/categories`,
          init: {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          },
          refreshAccessToken,
          logout,
        });
        if (!response) return;

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.status) {
          setTipoActivos(data.categories || []);
          // Actualizar tipo_activos_cache
          await AsyncStorage.setItem('tipo_activos_cache', JSON.stringify(data.categories || []));
        }
      } else {
        // Sin internet: cargar desde cache
        const tipoActivosCache = await AsyncStorage.getItem('tipo_activos_cache');
        if (tipoActivosCache) {
          const cachedTipoActivos = JSON.parse(tipoActivosCache);
          setTipoActivos(cachedTipoActivos);
        } else {
          setTipoActivos([]);
        }
      }
    } catch (err) {
      console.error('Error fetching tipo activos:', err);
      // En caso de error, intentar cargar desde cache
      try {
        const tipoActivosCache = await AsyncStorage.getItem('tipo_activos_cache');
        if (tipoActivosCache) {
          const cachedTipoActivos = JSON.parse(tipoActivosCache);
          setTipoActivos(cachedTipoActivos);
        }
      } catch (cacheErr) {
        console.error('Error loading tipo activos from cache:', cacheErr);
      }
    }
  };

  const fetchVisitors = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Verificar si existe current_marca
      const currentMarca = await AsyncStorage.getItem('current_marca');
      if (!currentMarca) {
        setHasCurrentMarca(false);
        setIsLoading(false);
        return;
      }

      const currentMarcaData = JSON.parse(currentMarca);
      const marcaId = currentMarcaData.id;
      setHasCurrentMarca(true);

      // Verificar conectividad
      const isConnected = await getConnectionStatus();

      if (isConnected) {
        // Con internet: hacer fetch normal
        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) {
          throw new Error('Server URL not configured');
        }

        const response = await authedFetch({
          url: `${apiUrl}/api/visitors?m=${marcaId}`,
          init: {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          },
          refreshAccessToken,
          logout,
        });
        if (!response) return;

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.status && data.data) {
          setVisitors(data.data);
          // Actualizar visitors_cache
          await AsyncStorage.setItem('visitors_cache', JSON.stringify(data.data));
        } else {
          setError(data.message || 'Error al cargar las visitas');
          Alert.alert('Error', data.message || 'Error al cargar las visitas');
        }
      } else {
        // Sin internet: cargar desde cache
        const visitorsCache = await AsyncStorage.getItem('visitors_cache');
        if (visitorsCache) {
          const cachedVisitors = JSON.parse(visitorsCache);
          setVisitors(cachedVisitors);
          Alert.alert('Modo Offline', 'No hay conexión a internet. Mostrando datos guardados.');
        } else {
          setError('No hay datos guardados y no hay conexión a internet');
          Alert.alert('Sin conexión', 'No hay conexión a internet y no hay datos guardados previamente.');
          setVisitors([]);
        }
      }
    } catch (err) {
      console.error('Error fetching visitors:', err);
      // En caso de error, intentar cargar desde cache
      try {
        const visitorsCache = await AsyncStorage.getItem('visitors_cache');
        if (visitorsCache) {
          const cachedVisitors = JSON.parse(visitorsCache);
          setVisitors(cachedVisitors);
          Alert.alert('Modo Offline', 'Error de conexión. Mostrando datos guardados.');
        } else {
          setError('Error al cargar las visitas');
          Alert.alert('Error', 'No se pudieron cargar las visitas');
        }
      } catch (cacheErr) {
        setError('Error al cargar las visitas');
        Alert.alert('Error', 'No se pudieron cargar las visitas');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const normalizeDateToYMD = (value: string) => {
    const raw = String(value || '').trim().split('T')[0];
    if (!raw) return '';
    const ymd = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
    const dmy = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    return '';
  };

  const toDMY = (value: string) => {
    const ymd = normalizeDateToYMD(value);
    if (!ymd) return String(value || '');
    const [y, m, d] = ymd.split('-');
    return `${d}-${m}-${y}`;
  };

  const buildIsoFromDateAndTime = (dateInput: string, hh: string, mm: string) => {
    const ymd = normalizeDateToYMD(dateInput);
    if (!ymd) return '';
    const h = String(hh || '').padStart(2, '0');
    const m = String(mm || '').padStart(2, '0');
    if (!/^\d{2}$/.test(h) || !/^\d{2}$/.test(m)) return '';
    return `${ymd}T${h}:${m}:00.000Z`;
  };

  const dateOnlyFromIso = (value?: string | null) => {
    if (!value) return '';
    try {
      const onlyDate = String(value).split('T')[0];
      return normalizeDateToYMD(onlyDate);
    } catch {
      return '';
    }
  };

  const convertDate = (dateString: string) => {
    try {
      const ymd = dateOnlyFromIso(dateString);
      const timePart = String(dateString).split('T')[1]?.split('.')[0] || '';
      return `${toDMY(ymd)}${timePart ? ` ${timePart}` : ''}`.trim();
    } catch {
      return dateString;
    }
  };

  const parseHoraFromString = (horaString: string) => {
    try {
      const timePart = horaString.split('T')[1];
      const [hour, minute] = timePart.split(':');
      return { hour, minute };
    } catch (error) {
      return { hour: '', minute: '' };
    }
  };

  const parseFechaFromString = (dateString: string) => {
    try {
      const ymd = dateOnlyFromIso(dateString);
      return toDMY(ymd);
    } catch {
      return '';
    }
  };

  const parseTimeToDate = async (timeValue?: string) => {
    const horaAccion = await getHoraAccion();
    if (!horaAccion) {
      Alert.alert('Error', 'No se pudo obtener la hora');
      return;
    }
    const base = new Date(horaAccion);
    const raw = String(timeValue || '').trim();
    if (/^\d{2}:\d{2}$/.test(raw)) {
      const [hh, mm] = raw.split(':').map((v) => parseInt(v, 10));
      if (!Number.isNaN(hh) && !Number.isNaN(mm)) {
        base.setHours(hh);
        base.setMinutes(mm);
        base.setSeconds(0);
        base.setMilliseconds(0);
      }
    }
    return base;
  };

  const parseDateToDate = async (dateValue?: string) => {
    const horaAccion = await getHoraAccion();
    if (!horaAccion) {
      Alert.alert('Error', 'No se pudo obtener la hora');
      return;
    }
    const ymd = normalizeDateToYMD(String(dateValue || ''));
    const d = ymd ? new Date(`${ymd}T00:00:00`) : new Date(horaAccion);
    return Number.isNaN(d.getTime()) ? new Date(horaAccion) : d;
  };

  const openVisitorDatePicker = async (field: 'entrada_fecha' | 'salida_fecha', current?: string) => {
    setVisitorPickerField(field);
    const parseDate = await parseDateToDate(current);
    if (!parseDate) {
      Alert.alert('Error', 'No se pudo obtener la fecha');
      return;
    }
    setVisitorPickerValue(parseDate);
    setShowVisitorDatePicker(true);
  };

  const openVisitorTimePicker = async (field: 'entrada_hora' | 'salida_hora', current?: string) => {
    setVisitorPickerField(field);
    const parseTime = await parseTimeToDate(current);
    if (!parseTime) {
      Alert.alert('Error', 'No se pudo obtener la hora');
      return;
    }
    setVisitorPickerValue(parseTime);
    setShowVisitorTimePicker(true);
  };

  const startCreating = () => {
    setIsCreating(true);
    setShowVisitorDatePicker(false);
    setShowVisitorTimePicker(false);
    setVisitorPickerField(null);
    setNewVisitor({
      id: null,
      id_local: '',
      nombre: '',
      cedula: '',
      hora_entrada_fecha: '',
      hora_entrada_h: '',
      hora_entrada_m: '',
      hora_salida_fecha: '',
      hora_salida_h: '',
      hora_salida_m: '',
      razon_visita: '',
      dep_pers_visita: '',
      es_funcionario: false,
      observaciones: '',
      tipo_accion: '',
      pers_autoriza_salida: '',
      foto_cedula: null,
      foto_cedula_nueva: null,
      activos: [],
    });
    // Initialize refs
    nombreRef.current = '';
    cedulaRef.current = '';
    horaEntradaFechaRef.current = '';
    horaEntradaHRef.current = '';
    horaEntradaMRef.current = '';
    horaSalidaFechaRef.current = '';
    horaSalidaHRef.current = '';
    horaSalidaMRef.current = '';
    razonVisitaRef.current = '';
    depPersVisitaRef.current = '';
    observacionesRef.current = '';
    persAutorizaSalidaRef.current = '';
  };

  const cancelCreating = () => {
    setIsCreating(false);
    setShowVisitorDatePicker(false);
    setShowVisitorTimePicker(false);
    setVisitorPickerField(null);
    setNewVisitor({
      id: null,
      id_local: '',
      nombre: '',
      cedula: '',
      hora_entrada_fecha: '',
      hora_entrada_h: '',
      hora_entrada_m: '',
      hora_salida_fecha: '',
      hora_salida_h: '',
      hora_salida_m: '',
      razon_visita: '',
      dep_pers_visita: '',
      es_funcionario: false,
      observaciones: '',
      tipo_accion: '',
      pers_autoriza_salida: '',
      foto_cedula: null,
      foto_cedula_nueva: null,
      activos: [],
    });
  };

  const startEditing = async (visitor: Visitor) => {
    try {
      const horaEntrada = parseHoraFromString(visitor.hora_entrada);
      const horaSalida = visitor.hora_salida ? parseHoraFromString(visitor.hora_salida) : { hour: '', minute: '' };
      const fechaEntrada = parseFechaFromString(visitor.hora_entrada);
      const fechaSalida = visitor.hora_salida ? parseFechaFromString(visitor.hora_salida) : '';

      // Helper para mapear activos - evitar duplicación de código
      const mapActivos = (detalles: any) => {
        const detallesArray = Array.isArray(detalles) ? detalles : [];
        return detallesArray.map((det: any) => ({
          detalle: det.detalle || '',
          descripcion: det.descripcion || ''
        }));
      };

      // Función helper para crear el objeto visitor
      const createEditingVisitorObject = (fotoCedulaValue: string | null) => ({
        id: visitor.id,
        id_local: visitor.id_local,
        nombre: visitor.nombre,
        cedula: visitor.cedula,
        hora_entrada_fecha: fechaEntrada,
        hora_entrada_h: horaEntrada.hour,
        hora_entrada_m: horaEntrada.minute,
        hora_salida_fecha: fechaSalida,
        hora_salida_h: horaSalida.hour,
        hora_salida_m: horaSalida.minute,
        razon_visita: visitor.razon_visita,
        dep_pers_visita: visitor.dep_pers_visita || '',
        es_funcionario: visitor.es_funcionario,
        observaciones: visitor.observaciones || '',
        tipo_accion: visitor.tipo_accion || '',
        pers_autoriza_salida: visitor.pers_autoriza_salida || '',
        foto_cedula: fotoCedulaValue,
        foto_cedula_nueva: null,
        activos: visitor.activos.map(activo => ({
          tipo_id: activo.tipo.id,
          nombre: activo.nombre ?? '',
          detalles: mapActivos(activo.detalles),
          numero_id: activo.numero_id ?? '',
          numero_activo: activo.numero_activo ?? '',
        })),
      });

      // Procesar foto_cedula
      let fotoCedula = visitor.foto_cedula;
      let shouldFetchImage = fotoCedula && !fotoCedula.startsWith('data:image');

      if (shouldFetchImage) {
        // Fetch from server
        try {
          const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
          if (apiUrl) {
            const imageUrl = appendTokenToUrl(`${apiUrl}/api/uploads/visitors/${visitor.id}/cedula?name=${fotoCedula}`);
            const response = await fetch(imageUrl);

            if (!response.ok) {
              console.warn('No se pudo cargar la imagen desde el servidor');
              fotoCedula = null;
            } else {
              const blob = await response.blob();

              // Convertir blob a base64 usando Promise para evitar race conditions
              fotoCedula = await new Promise<string | null>((resolve) => {
                const reader = new FileReader();

                reader.onerror = () => {
                  console.error('Error al leer la imagen con FileReader');
                  resolve(null);
                };

                reader.onloadend = () => {
                  try {
                    const base64data = reader.result as string;
                    if (!base64data) {
                      console.warn('No se pudo convertir la imagen a base64');
                      resolve(null);
                    } else {
                      resolve(base64data);
                    }
                  } catch (error) {
                    console.error('Error al procesar base64:', error);
                    resolve(null);
                  }
                };

                reader.readAsDataURL(blob);
              });
            }
          }
        } catch (error) {
          console.error('Error fetching image:', error);
          fotoCedula = null;
        }
      }

      // Solo UN setEditingVisitor al final, después de procesar todo
      setEditingVisitor(createEditingVisitorObject(fotoCedula));

      // Initialize refs with visitor values
      nombreRef.current = visitor.nombre;
      cedulaRef.current = visitor.cedula;
      horaEntradaFechaRef.current = fechaEntrada;
      horaEntradaHRef.current = horaEntrada.hour;
      horaEntradaMRef.current = horaEntrada.minute;
      horaSalidaFechaRef.current = fechaSalida;
      horaSalidaHRef.current = horaSalida.hour;
      horaSalidaMRef.current = horaSalida.minute;
      razonVisitaRef.current = visitor.razon_visita;
      depPersVisitaRef.current = visitor.dep_pers_visita || '';
      observacionesRef.current = visitor.observaciones || '';
      persAutorizaSalidaRef.current = visitor.pers_autoriza_salida || '';
    } catch (error) {
      console.error('Error al iniciar edición:', error);
      Alert.alert('Error', 'No se pudo cargar los datos del visitante. Por favor intente nuevamente.');
    }
  };

  const cancelEditing = () => {
    setShowVisitorDatePicker(false);
    setShowVisitorTimePicker(false);
    setVisitorPickerField(null);
    setEditingVisitor(null);
  };

  const createVisitor = async () => {
    if (!nombreRef.current.trim()) {
      Alert.alert('Error', 'El nombre es requerido');
      return;
    }
    if (!cedulaRef.current.trim()) {
      Alert.alert('Error', 'La cédula es requerida');
      return;
    }
    if (!horaEntradaFechaRef.current.trim()) {
      Alert.alert('Error', 'La fecha de entrada es requerida');
      return;
    }
    if (!horaEntradaHRef.current || !horaEntradaMRef.current) {
      Alert.alert('Error', 'La hora de entrada es requerida');
      return;
    }
    if (!razonVisitaRef.current.trim()) {
      Alert.alert('Error', 'La razón de visita es requerida');
      return;
    }

    if (newVisitor.es_funcionario && !observacionesRef.current.trim()) {
      Alert.alert('Error', 'Las observaciones son requeridas para funcionarios');
      return;
    }

    if (newVisitor.es_funcionario && !newVisitor.tipo_accion.trim()) {
      Alert.alert('Error', 'El tipo de acción es requerido para funcionarios');
      return;
    }

    if (newVisitor.es_funcionario && !persAutorizaSalidaRef.current.trim()) {
      Alert.alert('Error', 'La persona que autoriza la salida es requerida para funcionarios');
      return;
    }

    // Validar activos
    for (const activo of newVisitor.activos) {
      if (!activo.tipo_id) {
        Alert.alert('Error', 'Todos los activos deben tener un tipo');
        return;
      }
      if (!activo.numero_id.trim()) {
        Alert.alert('Error', 'Todos los activos deben tener número de identificador');
        return;
      }
      if (newVisitor.es_funcionario && !activo.numero_activo.trim()) {
        Alert.alert('Error', 'Los activos de funcionarios deben tener número de activo');
        return;
      }
      for (const detalle of activo.detalles) {
        if (!detalle.detalle.trim() || !detalle.descripcion.trim()) {
          Alert.alert('Error', 'Todos los detalles deben tener detalle y descripción');
          return;
        }
      }
    }

    Alert.alert(
      'Confirmar registro',
      '¿Estás seguro de que deseas registrar este visitante?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const currentMarca = await AsyncStorage.getItem('current_marca');
              if (!currentMarca) {
                Alert.alert('Error', 'No hay marca registrada');
                return;
              }
              const currentMarcaData = JSON.parse(currentMarca);

              const converted_hora_entrada = buildIsoFromDateAndTime(
                horaEntradaFechaRef.current,
                horaEntradaHRef.current,
                horaEntradaMRef.current
              );
              const hasSalidaTime = !!(horaSalidaHRef.current && horaSalidaMRef.current);
              if (hasSalidaTime && !horaSalidaFechaRef.current.trim()) {
                Alert.alert('Error', 'Si indicas hora de salida, también debes indicar la fecha de salida');
                return;
              }
              const converted_hora_salida = hasSalidaTime
                ? buildIsoFromDateAndTime(horaSalidaFechaRef.current, horaSalidaHRef.current, horaSalidaMRef.current)
                : null;
              if (!converted_hora_entrada || (hasSalidaTime && !converted_hora_salida)) {
                Alert.alert('Error', 'Formato inválido en fecha u hora');
                return;
              }

              const requestBody = {
                marca_id: currentMarcaData.id,
                nombre: nombreRef.current,
                cedula: cedulaRef.current,
                hora_entrada: converted_hora_entrada,
                hora_salida: converted_hora_salida,
                razon_visita: razonVisitaRef.current,
                dep_pers_visita: depPersVisitaRef.current.trim() || null,
                es_funcionario: newVisitor.es_funcionario,
                observaciones: newVisitor.es_funcionario ? observacionesRef.current : null,
                tipo_accion: newVisitor.es_funcionario && newVisitor.tipo_accion ? newVisitor.tipo_accion : null,
                pers_autoriza_salida: newVisitor.es_funcionario && persAutorizaSalidaRef.current ? persAutorizaSalidaRef.current : null,
                foto_cedula: newVisitor.foto_cedula_nueva || newVisitor.foto_cedula,
                activos: newVisitor.activos.map(activo => ({
                  tipo_id: activo.tipo_id,
                  nombre: activo.nombre ?? '',
                  detalles: activo.detalles,
                  numero_id: activo.numero_id,
                  numero_activo: activo.numero_activo,
                })),
              };

              // Verificar conectividad
              const isConnected = await getConnectionStatus();

              if (isConnected) {
                // Con internet: hacer llamado API normal
                const data = await createVisitorAPI({
                  requestData: requestBody,
                  marcaId: currentMarcaData.id,
                  refreshAccessToken,
                  logout,
                });

                if (data.status) {
                  Alert.alert('Éxito', 'Visitante creado correctamente');
                  cancelCreating();
                  fetchVisitors();
                } else {
                  Alert.alert('Error', data.message || 'Error al crear visitante');
                }
              } else {
                // Sin internet: guardar en visitors_actions y visitors_cache
                const horaAccion = await getHoraAccion();
                const localId = Math.random().toString(36).substring(2, 12).toUpperCase();

                // Guardar en visitors_actions
                const actionsStr = await AsyncStorage.getItem('visitors_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];

                actions.push({
                  requestData: requestBody,
                  marcaId: currentMarcaData.id,
                  id: localId,
                  type: 'create',
                });

                console.log("Acción create guardada");

                await AsyncStorage.setItem('visitors_actions', JSON.stringify(actions));

                // Guardar en visitors_cache
                const cacheStr = await AsyncStorage.getItem('visitors_cache');
                const cache = cacheStr ? JSON.parse(cacheStr) : [];

                const newVisitorCache: Visitor = {
                  id: 0,
                  nombre: nombreRef.current,
                  cedula: cedulaRef.current,
                  hora_entrada: converted_hora_entrada.toString(),
                  hora_salida: converted_hora_salida ? converted_hora_salida.toString() : null,
                  razon_visita: razonVisitaRef.current,
                  dep_pers_visita: depPersVisitaRef.current.trim() || null,
                  responsable: {
                    id: parseInt(employee?.id || '0'),
                    nombre: employee?.name || 'Desconocido',
                  },
                  es_funcionario: newVisitor.es_funcionario,
                  observaciones: newVisitor.es_funcionario ? observacionesRef.current : null,
                  tipo_accion: newVisitor.es_funcionario && newVisitor.tipo_accion ? newVisitor.tipo_accion : null,
                  pers_autoriza_salida: newVisitor.es_funcionario && persAutorizaSalidaRef.current ? persAutorizaSalidaRef.current : null,
                  foto_cedula: newVisitor.foto_cedula_nueva || newVisitor.foto_cedula,
                  activos: newVisitor.activos.map(activo => ({
                    tipo: tipoActivos.find(t => t.id === activo.tipo_id) || { id: activo.tipo_id || 0, nombre: 'Desconocido' },
                    nombre: activo.nombre ?? '',
                    detalles: activo.detalles,
                    numero_id: activo.numero_id,
                    numero_activo: activo.numero_activo,
                  })),
                  updated_at: new Date(horaAccion).toISOString(),
                  id_local: localId,
                };

                cache.push(newVisitorCache);
                await AsyncStorage.setItem('visitors_cache', JSON.stringify(cache));

                Alert.alert('Modo Offline', 'Visitante registrado localmente. Se sincronizará cuando haya conexión.');
                cancelCreating();
                fetchVisitors();
              }
            } catch (err) {
              console.error('Error creating visitor:', err);
              Alert.alert('Error', 'No se pudo registrar el visitante');
            }
          },
        },
      ]
    )
  };

  const updateVisitor = async () => {
    if (!editingVisitor) return;

    if (!nombreRef.current.trim()) {
      Alert.alert('Error', 'El nombre es requerido');
      return;
    }
    if (!cedulaRef.current.trim()) {
      Alert.alert('Error', 'La cédula es requerida');
      return;
    }
    if (!horaEntradaFechaRef.current.trim()) {
      Alert.alert('Error', 'La fecha de entrada es requerida');
      return;
    }
    if (!horaEntradaHRef.current || !horaEntradaMRef.current) {
      Alert.alert('Error', 'La hora de entrada es requerida');
      return;
    }
    if (!razonVisitaRef.current.trim()) {
      Alert.alert('Error', 'La razón de visita es requerida');
      return;
    }

    if (editingVisitor.es_funcionario && !observacionesRef.current.trim()) {
      Alert.alert('Error', 'Las observaciones son requeridas para funcionarios');
      return;
    }

    if (editingVisitor.es_funcionario && !editingVisitor.tipo_accion.trim()) {
      Alert.alert('Error', 'El tipo de acción es requerido para funcionarios');
      return;
    }

    if (editingVisitor.es_funcionario && !persAutorizaSalidaRef.current.trim()) {
      Alert.alert('Error', 'La persona que autoriza la salida es requerida para funcionarios');
      return;
    }

    // Validar activos
    for (const activo of editingVisitor.activos) {
      if (!activo.tipo_id) {
        Alert.alert('Error', 'Todos los activos deben tener un tipo');
        return;
      }
      if (!activo.numero_id.trim()) {
        Alert.alert('Error', 'Todos los activos deben tener número de identificador');
        return;
      }
      if (editingVisitor.es_funcionario && !activo.numero_activo.trim()) {
        Alert.alert('Error', 'Los activos de funcionarios deben tener número de activo');
        return;
      }
      for (const detalle of activo.detalles) {
        if (!detalle.detalle.trim() || !detalle.descripcion.trim()) {
          Alert.alert('Error', 'Todos los detalles deben tener detalle y descripción');
          return;
        }
      }
    }

    Alert.alert(
      'Confirmar actualización',
      '¿Estás seguro de que deseas actualizar este visitante?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const currentMarca = await AsyncStorage.getItem('current_marca');
              if (!currentMarca) {
                Alert.alert('Error', 'No hay marca registrada');
                return;
              }

              const converted_hora_entrada = buildIsoFromDateAndTime(
                horaEntradaFechaRef.current,
                horaEntradaHRef.current,
                horaEntradaMRef.current
              );
              const hasSalidaTime = !!(horaSalidaHRef.current && horaSalidaMRef.current);
              if (hasSalidaTime && !horaSalidaFechaRef.current.trim()) {
                Alert.alert('Error', 'Si indicas hora de salida, también debes indicar la fecha de salida');
                return;
              }
              const converted_hora_salida = hasSalidaTime
                ? buildIsoFromDateAndTime(horaSalidaFechaRef.current, horaSalidaHRef.current, horaSalidaMRef.current)
                : null;
              if (!converted_hora_entrada || (hasSalidaTime && !converted_hora_salida)) {
                Alert.alert('Error', 'Formato inválido en fecha u hora');
                return;
              }

              const requestBody = {
                nombre: nombreRef.current,
                cedula: cedulaRef.current,
                hora_entrada: converted_hora_entrada,
                hora_salida: converted_hora_salida,
                razon_visita: razonVisitaRef.current,
                dep_pers_visita: depPersVisitaRef.current.trim() || null,
                es_funcionario: editingVisitor.es_funcionario,
                observaciones: editingVisitor.es_funcionario ? observacionesRef.current : null,
                tipo_accion: editingVisitor.es_funcionario && editingVisitor.tipo_accion ? editingVisitor.tipo_accion : null,
                pers_autoriza_salida: editingVisitor.es_funcionario && persAutorizaSalidaRef.current ? persAutorizaSalidaRef.current : null,
                foto_cedula: editingVisitor.foto_cedula_nueva || null,
                activos: editingVisitor.activos.map(activo => ({
                  tipo_id: activo.tipo_id,
                  nombre: activo.nombre ?? '',
                  detalles: activo.detalles,
                  numero_id: activo.numero_id,
                  numero_activo: activo.numero_activo,
                })),
              };

              // Verificar conectividad
              const isConnected = await getConnectionStatus();

              if (isConnected) {
                // Con internet: hacer llamado API normal
                const data = await updateVisitorAPI({
                  requestData: requestBody,
                  visitorId: editingVisitor.id!,
                  refreshAccessToken,
                  logout,
                });

                if (data.status) {
                  Alert.alert('Éxito', 'Visitante actualizado correctamente');
                  cancelEditing();
                  fetchVisitors();
                } else {
                  Alert.alert('Error', data.message || 'Error al actualizar visitante');
                }
              } else {
                // Sin internet: guardar en visitors_actions y actualizar visitors_cache
                const actionsStr = await AsyncStorage.getItem('visitors_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];

                // Si id_local !== '', buscar acción "create" y modificar su requestData
                if (editingVisitor.id_local !== '') {
                  const createActionIndex = actions.findIndex((a: any) => a.id === editingVisitor.id_local && a.type === 'create');

                  if (createActionIndex !== -1) {
                    // Modificar requestData de la acción create, ignorando foto_cedula si no hay nueva imagen
                    const updatedRequestData = {
                      ...actions[createActionIndex].requestData,
                      nombre: nombreRef.current,
                      cedula: cedulaRef.current,
                      hora_entrada: converted_hora_entrada,
                      hora_salida: converted_hora_salida,
                      razon_visita: razonVisitaRef.current,
                      dep_pers_visita: depPersVisitaRef.current.trim() || null,
                      es_funcionario: editingVisitor.es_funcionario,
                      observaciones: editingVisitor.es_funcionario ? observacionesRef.current : null,
                      tipo_accion: editingVisitor.es_funcionario && editingVisitor.tipo_accion ? editingVisitor.tipo_accion : null,
                      pers_autoriza_salida: editingVisitor.es_funcionario && persAutorizaSalidaRef.current ? persAutorizaSalidaRef.current : null,
                      activos: editingVisitor.activos.map(activo => ({
                        tipo_id: activo.tipo_id,
                        nombre: activo.nombre ?? '',
                        detalles: activo.detalles,
                        numero_id: activo.numero_id,
                        numero_activo: activo.numero_activo,
                      })),
                    };

                    // Solo actualizar foto_cedula si hay nueva imagen
                    if (editingVisitor.foto_cedula_nueva) {
                      updatedRequestData.foto_cedula = editingVisitor.foto_cedula_nueva;
                    }

                    actions[createActionIndex].requestData = updatedRequestData;
                    await AsyncStorage.setItem('visitors_actions', JSON.stringify(actions));
                  }
                } else {
                  // Si id_local === '', buscar acción "update" existente o crear nueva
                  const updateActionIndex = actions.findIndex((a: any) => a.id === editingVisitor.id && a.type === 'update');

                  if (updateActionIndex !== -1) {
                    // Modificar requestData de la acción update existente
                    const updatedRequestData = {
                      nombre: nombreRef.current,
                      cedula: cedulaRef.current,
                      hora_entrada: converted_hora_entrada,
                      hora_salida: converted_hora_salida,
                      razon_visita: razonVisitaRef.current,
                      dep_pers_visita: depPersVisitaRef.current.trim() || null,
                      es_funcionario: editingVisitor.es_funcionario,
                      observaciones: editingVisitor.es_funcionario ? observacionesRef.current : null,
                      tipo_accion: editingVisitor.es_funcionario && editingVisitor.tipo_accion ? editingVisitor.tipo_accion : null,
                      pers_autoriza_salida: editingVisitor.es_funcionario && persAutorizaSalidaRef.current ? persAutorizaSalidaRef.current : null,
                      foto_cedula: editingVisitor.foto_cedula_nueva || null,
                      activos: editingVisitor.activos.map(activo => ({
                        tipo_id: activo.tipo_id,
                        nombre: activo.nombre ?? '',
                        detalles: activo.detalles,
                        numero_id: activo.numero_id,
                        numero_activo: activo.numero_activo,
                      })),
                    };

                    actions[updateActionIndex].requestData = updatedRequestData;
                  } else {
                    // Crear nueva acción update
                    const newAction = {
                      requestData: requestBody,
                      id: editingVisitor.id!,
                      type: 'update',
                    };
                    actions.push(newAction);
                  }

                  console.log("Acción update guardada");

                  await AsyncStorage.setItem('visitors_actions', JSON.stringify(actions));
                }

                // Actualizar visitors_cache
                const cacheStr = await AsyncStorage.getItem('visitors_cache');
                const cache = cacheStr ? JSON.parse(cacheStr) : [];

                const visitorIndex = cache.findIndex((v: Visitor) =>
                  editingVisitor.id_local !== '' ? v.id_local === editingVisitor.id_local : v.id === editingVisitor.id
                );

                if (visitorIndex !== -1) {
                  cache[visitorIndex] = {
                    ...cache[visitorIndex],
                    nombre: nombreRef.current,
                    cedula: cedulaRef.current,
                    hora_entrada: converted_hora_entrada.toString(),
                    hora_salida: converted_hora_salida ? converted_hora_salida.toString() : null,
                    razon_visita: razonVisitaRef.current,
                    dep_pers_visita: depPersVisitaRef.current.trim() || null,
                    es_funcionario: editingVisitor.es_funcionario,
                    observaciones: editingVisitor.es_funcionario ? observacionesRef.current : null,
                    tipo_accion: editingVisitor.es_funcionario && editingVisitor.tipo_accion ? editingVisitor.tipo_accion : null,
                    pers_autoriza_salida: editingVisitor.es_funcionario && persAutorizaSalidaRef.current ? persAutorizaSalidaRef.current : null,
                    // Reemplazar foto_cedula con nueva imagen si se tomó una
                    foto_cedula: editingVisitor.foto_cedula_nueva || cache[visitorIndex].foto_cedula,
                    activos: editingVisitor.activos.map(activo => ({
                      tipo: tipoActivos.find(t => t.id === activo.tipo_id) || { id: activo.tipo_id || 0, nombre: 'Desconocido' },
                      nombre: activo.nombre ?? '',
                      detalles: activo.detalles,
                      numero_id: activo.numero_id,
                      numero_activo: activo.numero_activo,
                    })),
                  };
                  await AsyncStorage.setItem('visitors_cache', JSON.stringify(cache));
                }

                Alert.alert('Modo Offline', 'Visitante actualizado localmente. Se sincronizará cuando haya conexión.');
                cancelEditing();
                fetchVisitors();
              }
            } catch (err) {
              console.error('Error updating visitor:', err);
              Alert.alert('Error', 'No se pudo actualizar el visitante');
            }
          },
        },
      ]
    )
  };

  const deleteVisitor = async (visitor: Visitor) => {
    Alert.alert(
      'Confirmar eliminación',
      `¿Está seguro de eliminar el registro de ${visitor.nombre}?`,
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              // Verificar conectividad
              const isConnected = await getConnectionStatus();

              if (isConnected) {
                // Con internet: hacer llamado API normal
                const data = await deleteVisitorAPI({
                  visitorId: visitor.id,
                  refreshAccessToken,
                  logout,
                });

                if (data.status) {
                  Alert.alert('Éxito', 'Visitante eliminado correctamente');
                  fetchVisitors();
                } else {
                  Alert.alert('Error', data.message || 'Error al eliminar visitante');
                }
              } else {
                // Sin internet: guardar en visitors_actions y actualizar visitors_cache
                const actionsStr = await AsyncStorage.getItem('visitors_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];

                // Si id_local !== '', eliminar acciones relacionadas con este id_local
                if (visitor.id_local !== '') {
                  // Filtrar todas las acciones que tengan este id_local
                  const filteredActions = actions.filter((a: any) => a.id !== visitor.id_local);
                  await AsyncStorage.setItem('visitors_actions', JSON.stringify(filteredActions));
                } else {
                  // Si id_local === '', agregar acción delete
                  actions.push({
                    id: visitor.id,
                    type: 'delete',
                  });
                  await AsyncStorage.setItem('visitors_actions', JSON.stringify(actions));
                }

                // Eliminar de visitors_cache
                const cacheStr = await AsyncStorage.getItem('visitors_cache');
                const cache = cacheStr ? JSON.parse(cacheStr) : [];

                const filteredCache = cache.filter((v: Visitor) =>
                  visitor.id_local !== '' ? v.id_local !== visitor.id_local : v.id !== visitor.id
                );
                await AsyncStorage.setItem('visitors_cache', JSON.stringify(filteredCache));

                Alert.alert('Modo Offline', 'Visitante eliminado localmente. Se sincronizará cuando haya conexión.');
                fetchVisitors();
              }
            } catch (err) {
              console.error('Error deleting visitor:', err);
              Alert.alert('Error', 'No se pudo eliminar el visitante');
            }
          },
        },
      ]
    );
  };

  const resetAllFilters = () => {
    setSearchText('');
    setSelectedTipoVisitante('all');
    setFilterDesde('');
    setFilterHasta('');
    setFilterNombreActivo('');
    setFilterSinHoraSalida(false);
    setFilterSinActivos(false);
  };

  const toggleVisitorDetails = (visitorId: number) => {
    setExpandedVisitorIds(prev => {
      if (prev.includes(visitorId)) {
        return prev.filter(id => id !== visitorId);
      } else {
        return [...prev, visitorId];
      }
    });
  };

  const takePhoto = async (isEditing: boolean) => {
    try {
      if (!permission?.granted) {
        const result = await requestPermission();
        if (!result.granted) {
          Alert.alert('Permiso denegado', 'Se necesita permiso para usar la cámara');
          return;
        }
      }

      setIsEditingCamera(isEditing);
      setIsCameraVisible(true);
    } catch (error) {
      console.error('Error al abrir la cámara:', error);
      Alert.alert('Error', 'No se pudo abrir la cámara. Por favor intente nuevamente.');
    }
  };

  const capturePhoto = async () => {
    if (!cameraRef.current) {
      Alert.alert('Error', 'La cámara no está lista. Por favor intente nuevamente.');
      return;
    }

    try {
      // Capturar foto con opciones de calidad reducida para evitar problemas de memoria
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.7, // Reducir calidad para disminuir tamaño
        skipProcessing: false
      });

      if (!photo) {
        Alert.alert('Error', 'No se pudo capturar la foto. Por favor intente nuevamente.');
        setIsCameraVisible(false);
        return;
      }

      if (!photo.base64) {
        Alert.alert('Error', 'No se pudo procesar la imagen. Por favor intente nuevamente.');
        setIsCameraVisible(false);
        return;
      }

      try {
        // Validar que el base64 no esté vacío y tenga un tamaño razonable
        if (photo.base64.length === 0) {
          throw new Error('La imagen capturada está vacía');
        }

        // Verificar que el tamaño no sea excesivo (por ejemplo, más de 10MB en base64)
        const sizeInMB = (photo.base64.length * 3) / 4 / (1024 * 1024);
        console.log(`Tamaño de imagen: ${sizeInMB.toFixed(2)} MB`);

        if (sizeInMB > 10) {
          Alert.alert('Advertencia', 'La imagen es muy grande. Esto puede causar problemas de rendimiento.');
        }

        const base64Image = `data:image/jpeg;base64,${photo.base64}`;

        // Usar setTimeout para asegurar que el estado se actualice después de cerrar el modal
        setIsCameraVisible(false);

        setTimeout(() => {
          try {

            if (isEditingCamera && editingVisitor) {
              setEditingVisitor((prev) => {
                const updated = {
                  ...prev!,
                  foto_cedula: base64Image,
                  foto_cedula_nueva: base64Image,
                };
                console.log('Estado editingVisitor actualizado con foto');
                return updated;
              });
            } else {
              setNewVisitor((prev) => {
                const updated = {
                  ...prev,
                  foto_cedula: base64Image,
                  foto_cedula_nueva: base64Image,
                };
                console.log('Estado newVisitor actualizado con foto');
                return updated;
              });
            }
          } catch (stateError) {
            console.error('Error al actualizar estado con imagen:', stateError);
            Alert.alert('Error', 'No se pudo guardar la imagen. Por favor intente nuevamente.');
          }
        }, 100);

      } catch (conversionError) {
        console.error('Error al convertir imagen a base64:', conversionError);
        Alert.alert('Error', 'No se pudo procesar la imagen. Por favor intente nuevamente.');
        setIsCameraVisible(false);
      }
    } catch (captureError) {
      console.error('Error al capturar foto:', captureError);
      Alert.alert('Error', 'No se pudo capturar la foto. Por favor intente nuevamente.');
      setIsCameraVisible(false);
    }
  };

  const removePhoto = (isEditing: boolean) => {
    try {
      if (isEditing && editingVisitor) {
        setEditingVisitor((prev) => ({
          ...prev!,
          foto_cedula: null,
          foto_cedula_nueva: null,
        }));
      } else {
        setNewVisitor((prev) => ({
          ...prev,
          foto_cedula: null,
          foto_cedula_nueva: null,
        }));
      }
    } catch (error) {
      console.error('Error al eliminar foto:', error);
      Alert.alert('Error', 'No se pudo eliminar la foto. Por favor intente nuevamente.');
    }
  };

  const addActivo = (isEditing: boolean) => {
    const newActivo: EditingActivo = {
      tipo_id: null,
      nombre: '',
      detalles: [],
      numero_id: '',
      numero_activo: '',
    };

    if (isEditing && editingVisitor) {
      setEditingVisitor({
        ...editingVisitor,
        activos: [...editingVisitor.activos, newActivo],
      });
    } else {
      setNewVisitor({
        ...newVisitor,
        activos: [...newVisitor.activos, newActivo],
      });
    }
  };

  const removeActivo = (index: number, isEditing: boolean) => {
    if (isEditing && editingVisitor) {
      const newActivos = editingVisitor.activos.filter((_, i) => i !== index);
      setEditingVisitor({
        ...editingVisitor,
        activos: newActivos,
      });
    } else {
      const newActivos = newVisitor.activos.filter((_, i) => i !== index);
      setNewVisitor({
        ...newVisitor,
        activos: newActivos,
      });
    }
  };

  const updateActivo = (index: number, field: keyof EditingActivo, value: any, isEditing: boolean) => {
    if (isEditing && editingVisitor) {
      const newActivos = [...editingVisitor.activos];
      newActivos[index] = { ...newActivos[index], [field]: value };
      setEditingVisitor({
        ...editingVisitor,
        activos: newActivos,
      });
    } else {
      const newActivos = [...newVisitor.activos];
      newActivos[index] = { ...newActivos[index], [field]: value };
      setNewVisitor({
        ...newVisitor,
        activos: newActivos,
      });
    }
  };

  const addDetalle = (activoIndex: number, isEditing: boolean) => {
    const newDetalle: EditingDetalle = {
      detalle: '',
      descripcion: '',
    };

    if (isEditing && editingVisitor) {
      const newActivos = [...editingVisitor.activos];
      newActivos[activoIndex].detalles.push(newDetalle);
      setEditingVisitor({
        ...editingVisitor,
        activos: newActivos,
      });
    } else {
      const newActivos = [...newVisitor.activos];
      newActivos[activoIndex].detalles.push(newDetalle);
      setNewVisitor({
        ...newVisitor,
        activos: newActivos,
      });
    }
  };

  const removeDetalle = (activoIndex: number, detalleIndex: number, isEditing: boolean) => {
    if (isEditing && editingVisitor) {
      const newActivos = [...editingVisitor.activos];
      newActivos[activoIndex].detalles = newActivos[activoIndex].detalles.filter((_, i) => i !== detalleIndex);
      setEditingVisitor({
        ...editingVisitor,
        activos: newActivos,
      });
    } else {
      const newActivos = [...newVisitor.activos];
      newActivos[activoIndex].detalles = newActivos[activoIndex].detalles.filter((_, i) => i !== detalleIndex);
      setNewVisitor({
        ...newVisitor,
        activos: newActivos,
      });
    }
  };

  const updateDetalle = (activoIndex: number, detalleIndex: number, field: keyof EditingDetalle, value: string, isEditing: boolean) => {
    if (isEditing && editingVisitor) {
      const newActivos = [...editingVisitor.activos];
      newActivos[activoIndex].detalles[detalleIndex] = {
        ...newActivos[activoIndex].detalles[detalleIndex],
        [field]: value,
      };
      setEditingVisitor({
        ...editingVisitor,
        activos: newActivos,
      });
    } else {
      const newActivos = [...newVisitor.activos];
      newActivos[activoIndex].detalles[detalleIndex] = {
        ...newActivos[activoIndex].detalles[detalleIndex],
        [field]: value,
      };
      setNewVisitor({
        ...newVisitor,
        activos: newActivos,
      });
    }
  };

  // Filtrado de visitantes
  const filteredVisitors = visitors.filter(visitor => {
    const matchesSearch =
      visitor.nombre.toLowerCase().includes(searchText.toLowerCase()) ||
      visitor.cedula.toLowerCase().includes(searchText.toLowerCase()) ||
      visitor.razon_visita.toLowerCase().includes(searchText.toLowerCase()) ||
      (visitor.pers_autoriza_salida && visitor.pers_autoriza_salida.toLowerCase().includes(searchText.toLowerCase())) ||
      (visitor.observaciones && visitor.observaciones.toLowerCase().includes(searchText.toLowerCase()));

    const matchesTipoVisitante =
      selectedTipoVisitante === 'all' ||
      (selectedTipoVisitante === 'visitante' && !visitor.es_funcionario) ||
      (selectedTipoVisitante === 'funcionario' && visitor.es_funcionario);

    const nombreActivoTrim = (filterNombreActivo || '').trim().toLowerCase();
    const matchesNombreActivo = !nombreActivoTrim || (visitor.activos && visitor.activos.some((a: Activo) => {
      const nombreActivo = (a.nombre ?? '').trim().toLowerCase();
      const tipoNombre = (a.tipo?.nombre ?? '').trim().toLowerCase();
      return nombreActivo.includes(nombreActivoTrim) || tipoNombre.includes(nombreActivoTrim);
    }));

    const matchesSinHoraSalida = !filterSinHoraSalida || !visitor.hora_salida || String(visitor.hora_salida).trim() === '';

    const matchesSinActivos = !filterSinActivos || !visitor.activos || visitor.activos.length === 0;

    const desdeYmd = normalizeDateToYMD(filterDesde);
    const hastaYmd = normalizeDateToYMD(filterHasta);
    const entradaYmd = dateOnlyFromIso(visitor.hora_entrada);
    const salidaYmd = dateOnlyFromIso(visitor.hora_salida);
    const relevantDates = [entradaYmd, salidaYmd].filter((d) => !!d) as string[];
    const matchesDateRange = (!desdeYmd && !hastaYmd)
      ? true
      : relevantDates.some((d) =>
          (!desdeYmd || d >= desdeYmd) &&
          (!hastaYmd || d <= hastaYmd)
        );

    return matchesSearch && matchesTipoVisitante && matchesNombreActivo && matchesSinHoraSalida && matchesSinActivos && matchesDateRange;
  });

  const renderVisitorForm = (visitor: EditingVisitor, isEditing: boolean) => {
    const updateField = (field: keyof EditingVisitor, value: any) => {
      if (isEditing && editingVisitor) {
        setEditingVisitor({ ...editingVisitor, [field]: value });
      } else {
        setNewVisitor({ ...newVisitor, [field]: value });
      }
    };

    const entradaHoraValue =
      visitor.hora_entrada_h != null && visitor.hora_entrada_m != null &&
      String(visitor.hora_entrada_h).trim() !== '' && String(visitor.hora_entrada_m).trim() !== ''
        ? `${String(visitor.hora_entrada_h).padStart(2, '0')}:${String(visitor.hora_entrada_m).padStart(2, '0')}`
        : '';
    const salidaHoraValue =
      visitor.hora_salida_h != null && visitor.hora_salida_m != null &&
      String(visitor.hora_salida_h).trim() !== '' && String(visitor.hora_salida_m).trim() !== ''
        ? `${String(visitor.hora_salida_h).padStart(2, '0')}:${String(visitor.hora_salida_m).padStart(2, '0')}`
        : '';

    const applyDateField = (field: 'entrada_fecha' | 'salida_fecha', dmy: string) => {
      if (field === 'entrada_fecha') {
        updateField('hora_entrada_fecha', dmy);
        horaEntradaFechaRef.current = dmy;
        return;
      }
      updateField('hora_salida_fecha', dmy);
      horaSalidaFechaRef.current = dmy;
    };

    const applyTimeField = (field: 'entrada_hora' | 'salida_hora', hhmm: string) => {
      const [hh, mm] = hhmm.split(':');
      const h = (hh ?? '').trim();
      const m = (mm ?? '').trim();
      if (field === 'entrada_hora') {
        if (isEditing && editingVisitor) {
          setEditingVisitor({ ...editingVisitor, hora_entrada_h: h, hora_entrada_m: m });
        } else {
          setNewVisitor({ ...newVisitor, hora_entrada_h: h, hora_entrada_m: m });
        }
        horaEntradaHRef.current = h;
        horaEntradaMRef.current = m;
        return;
      }
      if (isEditing && editingVisitor) {
        setEditingVisitor({ ...editingVisitor, hora_salida_h: h, hora_salida_m: m });
      } else {
        setNewVisitor({ ...newVisitor, hora_salida_h: h, hora_salida_m: m });
      }
      horaSalidaHRef.current = h;
      horaSalidaMRef.current = m;
    };

    return (
      <ThemedView style={styles.formContainer}>
        <ThemedText style={styles.formTitle}>
          {isEditing ? 'Editar Visitante' : 'Nuevo Visitante'}
        </ThemedText>

        {/* Nombre */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.label}>Nombre *</ThemedText>
          <TextInput
            style={styles.input}
            defaultValue={visitor.nombre}
            onChangeText={(text) => { nombreRef.current = text; }}
            placeholder="Nombre del visitante"
            placeholderTextColor="#999"
            key={`nombre-${isEditing ? 'edit' : 'create'}-${isEditing ? visitor.id : 'new'}`}
          />
        </ThemedView>

        {/* Cédula */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.label}>Cédula *</ThemedText>
          <TextInput
            style={styles.input}
            defaultValue={visitor.cedula}
            onChangeText={(text) => { cedulaRef.current = text; }}
            placeholder="Número de cédula"
            placeholderTextColor="#999"
            keyboardType="numeric"
            key={`cedula-${isEditing ? 'edit' : 'create'}-${isEditing ? visitor.id : 'new'}`}
          />
        </ThemedView>

        {/* Entrada (fecha + hora) */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.label}>Fecha de Entrada *</ThemedText>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => openVisitorDatePicker('entrada_fecha', visitor.hora_entrada_fecha)}
            activeOpacity={0.85}
          >
            <ThemedText style={styles.dateButtonText}>
              {visitor.hora_entrada_fecha || 'Seleccionar fecha'}
            </ThemedText>
            <Ionicons name="calendar-outline" size={18} color="#007AFF" />
          </TouchableOpacity>

          <ThemedText style={[styles.label, { marginTop: 8 }]}>Hora de Entrada *</ThemedText>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => openVisitorTimePicker('entrada_hora', entradaHoraValue)}
            activeOpacity={0.85}
          >
            <ThemedText style={styles.dateButtonText}>
              {entradaHoraValue || 'Seleccionar hora'}
            </ThemedText>
            <Ionicons name="time-outline" size={18} color="#007AFF" />
          </TouchableOpacity>
        </ThemedView>

        {/* Salida (fecha + hora) */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.label}>Fecha de Salida (Opcional)</ThemedText>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => openVisitorDatePicker('salida_fecha', visitor.hora_salida_fecha)}
            activeOpacity={0.85}
          >
            <ThemedText style={styles.dateButtonText}>
              {visitor.hora_salida_fecha || 'Seleccionar fecha'}
            </ThemedText>
            <Ionicons name="calendar-outline" size={18} color="#007AFF" />
          </TouchableOpacity>

          <ThemedText style={[styles.label, { marginTop: 8 }]}>Hora de Salida (Opcional)</ThemedText>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => openVisitorTimePicker('salida_hora', salidaHoraValue)}
            activeOpacity={0.85}
          >
            <ThemedText style={styles.dateButtonText}>
              {salidaHoraValue || 'Seleccionar hora'}
            </ThemedText>
            <Ionicons name="time-outline" size={18} color="#007AFF" />
          </TouchableOpacity>
        </ThemedView>

        {showVisitorDatePicker ? (
          <DateTimePicker
            value={visitorPickerValue}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onChange={(_event, selected) => {
              if (Platform.OS === 'android') setShowVisitorDatePicker(false);
              const dt = selected;
              if (!dt || !visitorPickerField) return;
              const dmy = toDMY(normalizeDateToYMD(dt.toISOString()));
              if (visitorPickerField === 'entrada_fecha') applyDateField('entrada_fecha', dmy);
              if (visitorPickerField === 'salida_fecha') applyDateField('salida_fecha', dmy);
              setShowVisitorDatePicker(false);
              setVisitorPickerField(null);
            }}
          />
        ) : null}

        {showVisitorTimePicker ? (
          <DateTimePicker
            value={visitorPickerValue}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_event, selected) => {
              if (Platform.OS === 'android') setShowVisitorTimePicker(false);
              const dt = selected;
              if (!dt || !visitorPickerField) return;
              const hh = String(dt.getHours()).padStart(2, '0');
              const mm = String(dt.getMinutes()).padStart(2, '0');
              const hhmm = `${hh}:${mm}`;
              if (visitorPickerField === 'entrada_hora') applyTimeField('entrada_hora', hhmm);
              if (visitorPickerField === 'salida_hora') applyTimeField('salida_hora', hhmm);
              setShowVisitorTimePicker(false);
              setVisitorPickerField(null);
            }}
          />
        ) : null}

        {/* Razón de visita */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.label}>Razón de Visita *</ThemedText>
          <TextInput
            style={styles.input}
            defaultValue={visitor.razon_visita}
            onChangeText={(text) => { razonVisitaRef.current = text; }}
            placeholder="Razón de visita"
            placeholderTextColor="#999"
            key={`razon-visita-${isEditing ? 'edit' : 'create'}-${isEditing ? visitor.id : 'new'}`}
          />
        </ThemedView>

        {/* Persona/Departamento que visita (opcional) */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.label}>Persona/Departamento que visita (Opcional)</ThemedText>
          <TextInput
            style={styles.input}
            defaultValue={visitor.dep_pers_visita}
            onChangeText={(text) => { depPersVisitaRef.current = text; }}
            placeholder="Persona o departamento que visita"
            placeholderTextColor="#999"
            key={`dep-pers-visita-${isEditing ? 'edit' : 'create'}-${isEditing ? visitor.id : 'new'}`}
          />
        </ThemedView>

        {/* Tipo de visitante */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.label}>Tipo de Visitante</ThemedText>
          <ThemedView style={styles.radioContainer}>
            <TouchableOpacity
              style={styles.radioOption}
              onPress={() => updateField('es_funcionario', false)}
            >
              <View style={styles.radioCircle}>
                {!visitor.es_funcionario && <View style={styles.radioCircleSelected} />}
              </View>
              <ThemedText style={styles.radioLabel}>Visitante</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.radioOption}
              onPress={() => updateField('es_funcionario', true)}
            >
              <View style={styles.radioCircle}>
                {visitor.es_funcionario && <View style={styles.radioCircleSelected} />}
              </View>
              <ThemedText style={styles.radioLabel}>Funcionario</ThemedText>
            </TouchableOpacity>
          </ThemedView>
        </ThemedView>

        {/* Campos de funcionario */}
        {visitor.es_funcionario && (
          <>
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.label}>Observaciones *</ThemedText>
              <TextInput
                style={[styles.input, styles.textArea]}
                defaultValue={visitor.observaciones}
                onChangeText={(text) => { observacionesRef.current = text; }}
                placeholder="Observaciones"
                placeholderTextColor="#999"
                multiline
                numberOfLines={3}
                key={`observaciones-${isEditing ? 'edit' : 'create'}-${isEditing ? visitor.id : 'new'}`}
              />
            </ThemedView>

            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.label}>Tipo de Acción (Opcional)</ThemedText>
              <ThemedView style={styles.radioContainer}>
                <TouchableOpacity
                  style={styles.radioOption}
                  onPress={() => updateField('tipo_accion', 'Entrada')}
                >
                  <View style={styles.radioCircle}>
                    {visitor.tipo_accion === 'Entrada' && <View style={styles.radioCircleSelected} />}
                  </View>
                  <ThemedText style={styles.radioLabel}>Entrada</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.radioOption}
                  onPress={() => updateField('tipo_accion', 'Salida')}
                >
                  <View style={styles.radioCircle}>
                    {visitor.tipo_accion === 'Salida' && <View style={styles.radioCircleSelected} />}
                  </View>
                  <ThemedText style={styles.radioLabel}>Salida</ThemedText>
                </TouchableOpacity>
              </ThemedView>
            </ThemedView>

            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.label}>Persona que Autoriza Salida (Opcional)</ThemedText>
              <TextInput
                style={styles.input}
                defaultValue={visitor.pers_autoriza_salida}
                onChangeText={(text) => { persAutorizaSalidaRef.current = text; }}
                placeholder="Nombre de quien autoriza"
                placeholderTextColor="#999"
                key={`pers-autoriza-${isEditing ? 'edit' : 'create'}-${isEditing ? visitor.id : 'new'}`}
              />
            </ThemedView>
          </>
        )}

        {/* Activos de la visita */}
        <ThemedView style={styles.formGroup}>
          <ThemedView style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Activos de la Visita (Opcional)</ThemedText>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => addActivo(isEditing)}
            >
              <Ionicons name="add" size={24} color="#007AFF" />
            </TouchableOpacity>
          </ThemedView>

          {visitor.activos.map((activo, activoIndex) => (
            <ThemedView key={activoIndex} style={styles.activoContainer}>
              <ThemedView style={styles.activoHeader}>
                <ThemedText style={styles.activoTitle}>Activo {activoIndex + 1}</ThemedText>
                <TouchableOpacity onPress={() => removeActivo(activoIndex, isEditing)}>
                  <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                </TouchableOpacity>
              </ThemedView>

              {/* Tipo de activo */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.label}>Tipo de Activo *</ThemedText>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={activo.tipo_id}
                    onValueChange={(value) => updateActivo(activoIndex, 'tipo_id', value, isEditing)}
                    style={styles.picker}
                  >
                    <Picker.Item label="Seleccione un tipo" value={null} color="#000000" />
                    {tipoActivos.map((tipo) => (
                      <Picker.Item key={tipo.id} label={tipo.nombre} value={tipo.id} color="#000000" />
                    ))}
                  </Picker>
                </View>
              </ThemedView>

              {/* Nombre activo */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.label}>Nombre activo (Opcional)</ThemedText>
                <TextInput
                  style={styles.input}
                  value={activo.nombre}
                  onChangeText={(text) => updateActivo(activoIndex, 'nombre', text, isEditing)}
                  placeholder="Nombre del activo"
                  placeholderTextColor="#999"
                />
              </ThemedView>

              {/* Número de identificador */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.label}>Número de identificador *</ThemedText>
                <TextInput
                  style={styles.input}
                  value={activo.numero_id}
                  onChangeText={(text) => updateActivo(activoIndex, 'numero_id', text, isEditing)}
                  placeholder="Número de identificador"
                  placeholderTextColor="#999"
                />
              </ThemedView>

              {/* Número de activo (solo funcionarios) */}
              {visitor.es_funcionario && (
                <ThemedView style={styles.formGroup}>
                  <ThemedText style={styles.label}>Número de Activo *</ThemedText>
                  <TextInput
                    style={styles.input}
                    value={activo.numero_activo}
                    onChangeText={(text) => updateActivo(activoIndex, 'numero_activo', text, isEditing)}
                    placeholder="Número de activo"
                    placeholderTextColor="#999"
                  />
                </ThemedView>
              )}

              {/* Detalles */}
              <ThemedView style={styles.formGroup}>
                <ThemedView style={styles.sectionHeader}>
                  <ThemedText style={styles.label}>Detalles (Opcional)</ThemedText>
                  <TouchableOpacity
                    style={styles.addSmallButton}
                    onPress={() => addDetalle(activoIndex, isEditing)}
                  >
                    <Ionicons name="add" size={16} color="#007AFF" />
                    <ThemedText style={styles.addSmallButtonText}>Añadir</ThemedText>
                  </TouchableOpacity>
                </ThemedView>

                {activo.detalles.map((detalle, detalleIndex) => (
                  <ThemedView key={detalleIndex} style={styles.detalleContainer}>
                    <ThemedView style={styles.detalleHeader}>
                      <ThemedText style={styles.detalleTitle}>Detalle {detalleIndex + 1}</ThemedText>
                      <TouchableOpacity onPress={() => removeDetalle(activoIndex, detalleIndex, isEditing)}>
                        <Ionicons name="close-circle" size={18} color="#FF3B30" />
                      </TouchableOpacity>
                    </ThemedView>

                    <TextInput
                      style={[{ marginBottom: 10 }, styles.input]}
                      value={detalle.detalle}
                      onChangeText={(text) => updateDetalle(activoIndex, detalleIndex, 'detalle', text, isEditing)}
                      placeholder="Título del detalle"
                      placeholderTextColor="#999"
                    />

                    <TextInput
                      style={styles.input}
                      value={detalle.descripcion}
                      onChangeText={(text) => updateDetalle(activoIndex, detalleIndex, 'descripcion', text, isEditing)}
                      placeholder="Descripción del detalle"
                      placeholderTextColor="#999"
                    />
                  </ThemedView>
                ))}
              </ThemedView>
            </ThemedView>
          ))}
        </ThemedView>

        {/* Foto de cédula */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.label}>Foto de Cédula (Opcional)</ThemedText>
          {visitor.foto_cedula ? (
            <ThemedView style={styles.photoPreviewContainer}>
              <Image
                source={{ uri: visitor.foto_cedula }}
                style={styles.photoPreview}
                resizeMode="contain"
              />
              <TouchableOpacity
                style={styles.removePhotoButton}
                onPress={() => removePhoto(isEditing)}
              >
                <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </ThemedView>
          ) : (
            <TouchableOpacity
              style={styles.cameraButton}
              onPress={() => takePhoto(isEditing)}
            >
              <Ionicons name="camera" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </ThemedView>

        {/* Botones de acción */}
        <ThemedView style={styles.formActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.cancelButton]}
            onPress={() => isEditing ? cancelEditing() : cancelCreating()}
          >
            <ThemedText style={styles.cancelButtonText}> <Ionicons name="close" size={20} color="#FFFFFF" /> </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.saveButton]}
            onPress={() => isEditing ? updateVisitor() : createVisitor()}
          >
            <ThemedText style={styles.saveButtonText}>
              {isEditing ? <Ionicons name="save" size={20} color="#FFFFFF" /> : <Ionicons name="add" size={20} color="#FFFFFF" />}
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </ThemedView>
    );
  };

  const renderVisitorItem = (visitor: Visitor) => {
    const isExpanded = expandedVisitorIds.includes(visitor.id);
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;

    return (
      <ThemedView key={visitor.id} style={styles.visitorCard}>
        <ThemedView style={styles.visitorHeader}>
          <ThemedText style={styles.visitorName}>{visitor.nombre}</ThemedText>
        </ThemedView>

        {/* Información principal */}
        <ThemedView style={styles.visitorDetailMain}>
          <ThemedText style={styles.visitorLabelMain}>Cédula:</ThemedText>
          <ThemedText style={styles.visitorValueMain}>{visitor.cedula}</ThemedText>
        </ThemedView>

        <ThemedView style={styles.visitorDetailMain}>
          <ThemedText style={styles.visitorLabelMain}>Entrada:</ThemedText>
          <ThemedText style={styles.visitorValueMain}>{convertDate(visitor.hora_entrada)}</ThemedText>
        </ThemedView>

        {visitor.hora_salida && (
          <ThemedView style={styles.visitorDetailMain}>
            <ThemedText style={styles.visitorLabelMain}>Salida:</ThemedText>
            <ThemedText style={styles.visitorValueMain}>{convertDate(visitor.hora_salida)}</ThemedText>
          </ThemedView>
        )}

        <ThemedView style={styles.visitorDetailMain}>
          <ThemedText style={styles.visitorLabelMain}>Creado:</ThemedText>
          <ThemedText style={styles.visitorValueMain}>
            {visitor.created_at ? convertDate(visitor.created_at) : '—'}
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.visitorDetailMain}>
          <ThemedText style={styles.visitorLabelMain}>Razón:</ThemedText>
          <ThemedText style={styles.visitorValueMain}>{visitor.razon_visita}</ThemedText>
        </ThemedView>

        {visitor.dep_pers_visita && (
          <ThemedView style={styles.visitorDetailMain}>
            <ThemedText style={styles.visitorLabelMain}>Persona/Departamento que visita:</ThemedText>
            <ThemedText style={styles.visitorValueMain}>{visitor.dep_pers_visita}</ThemedText>
          </ThemedView>
        )}

        <ThemedView style={styles.visitorDetailMain}>
          <ThemedText style={styles.visitorLabelMain}>Responsable:</ThemedText>
          <ThemedText style={styles.visitorValueMain}>{visitor.responsable.nombre}</ThemedText>
        </ThemedView>

        <ThemedView style={styles.visitorDetailMain}>
          <ThemedText style={styles.visitorLabelMain}>Tipo:</ThemedText>
          <ThemedText style={styles.visitorValueMain}>
            {visitor.es_funcionario ? 'Funcionario' : 'Visitante'}
          </ThemedText>
        </ThemedView>

        {/* Botón para expandir/colapsar detalles */}
        <TouchableOpacity
          style={styles.toggleDetailsButton}
          onPress={() => toggleVisitorDetails(visitor.id)}
        >
          <ThemedText style={styles.toggleDetailsText}>
            {isExpanded ? 'Ocultar detalles' : 'Ver más detalles'}
          </ThemedText>
          <Ionicons
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={20}
            color="#007AFF"
          />
        </TouchableOpacity>

        {/* Sección collapsable con detalles adicionales */}
        {isExpanded && (
          <ThemedView style={styles.expandedDetails}>
            {visitor.observaciones && (
              <ThemedView style={styles.visitorDetail}>
                <ThemedText style={styles.visitorLabel}>Observaciones:</ThemedText>
                <ThemedText style={styles.visitorValue}>{visitor.observaciones}</ThemedText>
              </ThemedView>
            )}

            {visitor.tipo_accion && (
              <ThemedView style={styles.visitorDetail}>
                <ThemedText style={styles.visitorLabel}>Acción:</ThemedText>
                <ThemedText style={styles.visitorValue}>{visitor.tipo_accion}</ThemedText>
              </ThemedView>
            )}

            {visitor.pers_autoriza_salida && (
              <ThemedView style={styles.visitorDetail}>
                <ThemedText style={styles.visitorLabel}>Autoriza:</ThemedText>
                <ThemedText style={styles.visitorValue}>{visitor.pers_autoriza_salida}</ThemedText>
              </ThemedView>
            )}

            {/* Activos */}
            {visitor.activos.length > 0 && (
              <ThemedView style={styles.activosSection}>
                <ThemedText style={styles.sectionTitle}>Activos ({visitor.activos.length})</ThemedText>
                {visitor.activos.map((activo, index) => {
                  const detallesArray = Array.isArray(activo.detalles)
                    ? activo.detalles
                    : (typeof activo.detalles === 'string' ? JSON.parse(activo.detalles) : []);

                  return (
                    <ThemedView key={index} style={styles.activoCard}>
                      <ThemedView style={styles.visitorDetailMain}>
                        <ThemedText style={styles.visitorLabelMain}>Tipo:</ThemedText>
                        <ThemedText style={styles.visitorValueMain}>{activo.tipo.nombre}</ThemedText>
                      </ThemedView>

                      {activo.nombre ? (
                        <ThemedView style={styles.visitorDetailMain}>
                          <ThemedText style={styles.visitorLabelMain}>Nombre activo:</ThemedText>
                          <ThemedText style={styles.visitorValueMain}>{activo.nombre}</ThemedText>
                        </ThemedView>
                      ) : null}

                      {detallesArray.length > 0 && (
                        <ThemedView style={styles.detallesSection}>
                          <ThemedText style={styles.visitorLabelMain}>Detalles:</ThemedText>
                          {detallesArray.map((detalle: any, detalleIndex: number) => (
                            <ThemedView key={detalleIndex} style={styles.detalleItem}>
                              <ThemedText style={styles.detalleText}>
                                • {detalle.detalle}: {detalle.descripcion}
                              </ThemedText>
                            </ThemedView>
                          ))}
                        </ThemedView>
                      )}

                      <ThemedView style={styles.visitorDetailMain}>
                        <ThemedText style={styles.visitorLabelMain}>Número de identificador:</ThemedText>
                        <ThemedText style={styles.visitorValueMain}>{activo.numero_id}</ThemedText>
                      </ThemedView>

                      {activo.numero_activo && (
                        <ThemedView style={styles.visitorDetailMain}>
                          <ThemedText style={styles.visitorLabelMain}>Número de Activo:</ThemedText>
                          <ThemedText style={styles.visitorValueMain}>{activo.numero_activo}</ThemedText>
                        </ThemedView>
                      )}
                    </ThemedView>
                  );
                })}
              </ThemedView>
            )}

            {/* Foto de cédula */}
            {visitor.foto_cedula && (
              <ThemedView style={styles.fotoCedulaSection}>
                <ThemedText style={styles.sectionTitle}>Foto de Cédula</ThemedText>
                {visitor.foto_cedula.startsWith('data:image') ? (
                  <Image
                    source={{ uri: visitor.foto_cedula }}
                    style={styles.fotoCedulaImage}
                    resizeMode="contain"
                  />
                ) : (
                  (() => {
                    const cedulaUri = getVisitorCedulaImageUrl(visitor.id, visitor.foto_cedula);
                    return cedulaUri ? (
                      <Image
                        source={{ uri: cedulaUri }}
                        style={styles.fotoCedulaImage}
                        resizeMode="contain"
                      />
                    ) : null;
                  })()
                )}
              </ThemedView>
            )}
          </ThemedView>
        )}

        {/* Solo serán visibles si el dato responsable_id es igual al id del empleado actual */}
        {visitor.responsable.id === parseInt(employee?.id || '0') && (
          <ThemedView style={styles.buttonRow}>
            <TouchableOpacity style={styles.editButton} onPress={() => startEditing(visitor)}>
              <ThemedText style={styles.editButtonText}>
                <Ionicons name="pencil" size={20} color="#FFFFFF" />
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.changesButton}
              onPress={() => {
                if (visitor.id_local || visitor.id === 0) {
                  Alert.alert('Sin conexión', 'Este visitante es local/offline. Los cambios solo se pueden consultar en el servidor.');
                  return;
                }
                setCambiosTitle(`Cambios - Visitante #${visitor.id}`);
                fetchCambios('e_registro_personas', visitor.id);
              }}
            >
              <Ionicons name="list-outline" size={18} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteButton} onPress={() => deleteVisitor(visitor)}>
              <ThemedText style={styles.deleteButtonText}>
                <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
              </ThemedText>
            </TouchableOpacity>
          </ThemedView>
        )}
      </ThemedView>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <AppHeader onMenuPress={() => setIsMenuVisible(true)} title="Registro de Visitantes" />

      {isLoading ? (
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Cargando visitantes...</ThemedText>
        </ThemedView>
      ) : !hasCurrentMarca ? (
        <ThemedView style={styles.noMarcaContainer}>
          <Ionicons name="alert-circle-outline" size={80} color="#FF9500" />
          <ThemedText style={styles.noMarcaTitle}>No hay marca registrada</ThemedText>
          <ThemedText style={styles.noMarcaMessage}>
            Debes registrar una marca de ingreso antes de acceder al registro de visitantes.
          </ThemedText>
          <TouchableOpacity
            style={styles.goBackButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={20} color="#000000" />
            <ThemedText style={styles.goBackButtonText}>Volver</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
        >
          <ThemedView style={styles.contentContainer}>
            {/* Module Title */}
            <ThemedView style={styles.titleContainer}>
              <ThemedText type="title" style={styles.title}>
                Visitantes
              </ThemedText>
              <ThemedText style={styles.subtitle}>
                Gestiona el registro de visitantes
              </ThemedText>
            </ThemedView>

            {/* Filtros */}
            <ThemedView style={styles.filtersContainer}>
              <ThemedView style={styles.filtersHeader}>
                <TouchableOpacity
                  style={styles.filterToggleButton}
                  onPress={() => setIsFiltersExpanded(!isFiltersExpanded)}
                >
                  <ThemedText style={styles.filtersTitle}>
                    Filtros
                  </ThemedText>
                  <Ionicons
                    name={isFiltersExpanded ? "chevron-up" : "chevron-down"}
                    size={20}
                    color="#007AFF"
                  />
                </TouchableOpacity>

                {isFiltersExpanded ? (
                  <TouchableOpacity
                    style={styles.resetFiltersButton}
                    onPress={resetAllFilters}
                  >
                    <Ionicons name="refresh" size={16} color="#FF3B30" />
                    <ThemedText style={styles.resetFiltersText}>Reiniciar</ThemedText>
                  </TouchableOpacity>
                ) : null}
              </ThemedView>

              {/* Filter Content */}
              {isFiltersExpanded ? (
                <ThemedView style={styles.filtersContent}>
                  <ThemedView style={styles.filterGroupSearch}>
                    <ThemedText style={styles.filterLabel}>Buscar por nombre, cédula, razón, persona que autoriza u observaciones:</ThemedText>
                    <TextInput
                      style={styles.searchInput}
                      value={searchText}
                      onChangeText={setSearchText}
                      placeholder="Buscar..."
                      placeholderTextColor="#999"
                    />
                  </ThemedView>

                  <ThemedView style={styles.filterGroupSearch}>
                    <ThemedText style={styles.filterLabel}>Tipo de Visitante:</ThemedText>
                    <ThemedView style={styles.pickerContainer}>
                      <Picker
                        selectedValue={selectedTipoVisitante}
                        onValueChange={(value) => setSelectedTipoVisitante(value)}
                        style={styles.picker}
                      >
                        <Picker.Item label="Todos los tipos" value="all" color="#000000" />
                        <Picker.Item label="Visitante" value="visitante" color="#000000" />
                        <Picker.Item label="Funcionario" value="funcionario" color="#000000" />
                      </Picker>
                    </ThemedView>
                  </ThemedView>

                  <ThemedView style={styles.filterGroupSearch}>
                    <ThemedText style={styles.filterLabel}>Desde (DD-MM-YYYY):</ThemedText>
                    <TextInput
                      style={styles.searchInput}
                      value={filterDesde}
                      onChangeText={setFilterDesde}
                      placeholder="DD-MM-YYYY"
                      placeholderTextColor="#999"
                    />
                  </ThemedView>

                  <ThemedView style={styles.filterGroupSearch}>
                    <ThemedText style={styles.filterLabel}>Hasta (DD-MM-YYYY):</ThemedText>
                    <TextInput
                      style={styles.searchInput}
                      value={filterHasta}
                      onChangeText={setFilterHasta}
                      placeholder="DD-MM-YYYY"
                      placeholderTextColor="#999"
                    />
                  </ThemedView>

                  <ThemedView style={styles.filterGroupSearch}>
                    <ThemedText style={styles.filterLabel}>Filtrar por nombre de activo:</ThemedText>
                    <TextInput
                      style={styles.searchInput}
                      value={filterNombreActivo}
                      onChangeText={setFilterNombreActivo}
                      placeholder="Nombre del activo..."
                      placeholderTextColor="#999"
                    />
                  </ThemedView>

                  <ThemedView style={[styles.filterGroupSearch, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                    <ThemedText style={styles.filterLabel}>Solo sin hora de salida</ThemedText>
                    <TouchableOpacity
                      style={[styles.checkboxButton, filterSinHoraSalida && styles.checkboxButtonActive]}
                      onPress={() => setFilterSinHoraSalida(prev => !prev)}
                    >
                      <ThemedText style={[styles.checkboxButtonText, filterSinHoraSalida && { color: '#FFFFFF' }]}>{filterSinHoraSalida ? 'Sí' : 'No'}</ThemedText>
                    </TouchableOpacity>
                  </ThemedView>

                  <ThemedView style={[styles.filterGroupSearch, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                    <ThemedText style={styles.filterLabel}>Solo sin activos</ThemedText>
                    <TouchableOpacity
                      style={[styles.checkboxButton, filterSinActivos && styles.checkboxButtonActive]}
                      onPress={() => setFilterSinActivos(prev => !prev)}
                    >
                      <ThemedText style={[styles.checkboxButtonText, filterSinActivos && { color: '#FFFFFF' }]}>{filterSinActivos ? 'Sí' : 'No'}</ThemedText>
                    </TouchableOpacity>
                  </ThemedView>
                </ThemedView>
              ) : null}
            </ThemedView>

            {/* Botón crear */}
            {!isCreating && !editingVisitor ? (
              <TouchableOpacity
                style={styles.createButton}
                onPress={startCreating}
              >
                <Ionicons name="add" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            ) : null}

            {/* Formulario de creación */}
            {isCreating && renderVisitorForm(newVisitor, false)}

            {/* Formulario de edición */}
            {editingVisitor && renderVisitorForm(editingVisitor, true)}

            {/* Lista de visitantes */}
            {!isCreating && !editingVisitor ? (
              <ThemedView style={styles.visitorsList}>
                {filteredVisitors.length === 0 ? (
                  <ThemedView style={styles.emptyContainer}>
                    <Ionicons name="people-outline" size={60} color="#999" />
                    <ThemedText style={styles.emptyText}>No hay visitantes registrados</ThemedText>
                  </ThemedView>
                ) : (
                  filteredVisitors.map(visitor => renderVisitorItem(visitor))
                )}
              </ThemedView>
            ) : null}
          </ThemedView>
        </ScrollView>
      )}

      {/* Modal de cámara */}
      <Modal
        visible={isCameraVisible}
        animationType="slide"
        onRequestClose={() => setIsCameraVisible(false)}
      >
        <View style={styles.cameraContainer}>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing="back"
          />
          <View style={styles.cameraControls}>
            <TouchableOpacity
              style={styles.cameraCancelButton}
              onPress={() => setIsCameraVisible(false)}
            >
              <Ionicons name="close" size={30} color="#000000" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cameraCaptureButton}
              onPress={capturePhoto}
            >
              <View style={styles.cameraCaptureButtonInner} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: ver cambios */}
      <Modal
        visible={isCambiosModalVisible}
        animationType="fade"
        transparent
        presentationStyle="overFullScreen"
        onRequestClose={closeCambiosModal}
      >
        <View style={styles.overlay}>
          <ThemedView style={styles.floatModalCardMovimientos}>
            <ThemedView style={styles.floatModalHeader}>
              <ThemedText style={styles.modalTitle}>{cambiosTitle}</ThemedText>
              <TouchableOpacity onPress={closeCambiosModal}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </ThemedView>

            <ScrollView style={{ maxHeight: Dimensions.get('window').height * 0.75 }} contentContainerStyle={{ padding: 16 }}>
              {(!cambiosItems || cambiosItems.length === 0) ? (
                <ThemedView style={styles.emptyContainer}>
                  <ThemedText style={styles.emptyText}>No hay cambios registrados</ThemedText>
                </ThemedView>
              ) : (
                cambiosItems.map((row: any) => {
                  let parsed: any[] = [];
                  try {
                    parsed = row?.cambios ? JSON.parse(row.cambios) : [];
                  } catch {
                    parsed = [];
                  }
                  const createdAtLabel = formatCambioCreatedAt(row?.created_at);
                  const isOpen = expandedCambioId === row.id;

                  return (
                    <ThemedView key={`chg-${row.id}`} style={styles.cambioCollapsableMain}>
                      <TouchableOpacity
                        style={styles.cambioCollapsableHeader}
                        onPress={() => setExpandedCambioId((prev) => (prev === row.id ? null : row.id))}
                        activeOpacity={0.8}
                      >
                        <ThemedText style={styles.cambioCollapsableTitle}>
                          {createdAtLabel}
                        </ThemedText>
                        <Ionicons
                          name={isOpen ? "chevron-up" : "chevron-down"}
                          size={18}
                          color="#007AFF"
                        />
                      </TouchableOpacity>

                      {isOpen && (
                        <ThemedView style={styles.cambioCollapsableContent}>
                          <ThemedView style={styles.filterGroupSearch}>
                            <ThemedText style={styles.filterLabel}>Cambio realizado por:</ThemedText>
                            <ThemedText style={styles.changeDescription}>
                              {row.empleado_nombre || 'Desconocido'}
                              {row.empleado_cedula ? ` - Cédula: ${row.empleado_cedula}` : ''}
                            </ThemedText>
                          </ThemedView>

                          {(Array.isArray(parsed) ? parsed : []).length > 0 && (
                            <ThemedView style={styles.filterGroupSearch}>
                              <ThemedText style={styles.filterLabel}>Cambios:</ThemedText>
                              {(Array.isArray(parsed) ? parsed : []).map((c: any, idx: number) => {
                                const propName = String(c?.prop ?? '-');
                                const propLabel = formatCambioLabel(propName);
                                const value = formatChangeValue(propName, c?.after);

                                // Si el valor tiene múltiples líneas (como activos), dividirlo
                                const valueLines = value.split('\n');

                                return (
                                  <ThemedView key={`c-${row.id}-${idx}`} style={{ marginBottom: 8 }}>
                                    <ThemedText style={styles.changeDescription}>
                                      <ThemedText style={{ fontWeight: '800' }}>{propLabel}: </ThemedText>
                                      {valueLines.length > 1 ? (
                                        <ThemedView style={{ marginLeft: 8 }}>
                                          {valueLines.map((line: string, lineIdx: number) => (
                                            <ThemedText key={`line-${idx}-${lineIdx}`} style={styles.changeDescription}>
                                              {line}
                                            </ThemedText>
                                          ))}
                                        </ThemedView>
                                      ) : (
                                        valueLines[0]
                                      )}
                                    </ThemedText>
                                  </ThemedView>
                                );
                              })}
                            </ThemedView>
                          )}
                        </ThemedView>
                      )}
                    </ThemedView>
                  );
                })
              )}
            </ScrollView>
          </ThemedView>
        </View>
      </Modal>

      <AppFooter />
      <SlideMenu
        isVisible={isMenuVisible}
        onClose={() => setIsMenuVisible(false)}
        onHomePress={() => navigation.navigate('Home')}
        currentRoute="Visitors"
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
  titleContainer: {
    alignItems: 'center',
    marginBottom: 30,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    width: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    opacity: 0.7,
  },
  noMarcaContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 20,
  },
  noMarcaTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF9500',
    textAlign: 'center',
  },
  noMarcaMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 400,
  },
  goBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  goBackButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
  },
  filtersContainer: {
    width: '100%',
    marginBottom: 20,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  filtersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  filterToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#F8F9FA',
  },
  filtersTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  filtersContent: {
    padding: 16,
    gap: 10,
    backgroundColor: '#F8F9FA',
  },
  filterGroupSearch: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  checkboxButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    backgroundColor: 'transparent',
  },
  checkboxButtonActive: {
    backgroundColor: '#007AFF',
  },
  checkboxButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  searchInput: {
    width: '100%',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: '#F9F9F9',
    color: '#000000',
  },
  resetFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  resetFiltersText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF3B30',
  },
  createButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  formCard: {
    marginBottom: 20,
  },
  formContainer: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#fff',
    padding: 16,
    gap: 8,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    width: '100%',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: '#F9F9F9',
    color: '#000000',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  timeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
  },
  timeInput: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: '#F9F9F9',
    textAlign: 'center',
    color: '#000000',
  },
  timeInputHour: {
    width: '40%',
  },
  timeInputMinute: {
    width: '40%',
  },
  timeSeparator: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  radioContainer: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 5,
    backgroundColor: '#fff',
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#007AFF',
  },
  radioLabel: {
    fontSize: 16,
    color: '#333',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
    overflow: 'hidden',
  },
  picker: {
    width: '100%',
    height: 50,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  addSmallButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  addSmallButtonText: {
    color: '#007AFF',
    fontSize: 12,
    fontWeight: '600',
  },
  activoContainer: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#fff',
    padding: 16,
    gap: 8,
    marginBottom: 16,
  },
  activoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  activoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    backgroundColor: '#fff',
  },
  detalleContainer: {
    backgroundColor: '#f5f5f5',
    padding: 10,
    borderRadius: 6,
    marginBottom: 10,
  },
  detalleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: '#f5f5f5',
  },
  detalleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  cameraButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    padding: 20,
    borderRadius: 8,
    gap: 10,
  },
  cameraButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  photoPreviewContainer: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  photoPreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 10,
  },
  removePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF3B30',
    padding: 10,
    borderRadius: 8,
    gap: 8,
    width: 200,
  },
  removePhotoText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    backgroundColor: '#fff',
  },
  actionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#8E8E93',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#34C759',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  visitorsList: {
    width: '100%',
    gap: 16,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.5,
    textAlign: 'center',
  },
  visitorCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#fff',
    padding: 16,
    gap: 8,
  },
  visitorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  visitorName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    backgroundColor: '#fff',
  },
  editButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#FF3B30',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  visitorDetail: {
    flexDirection: 'row',
    marginBottom: 0,
    backgroundColor: '#F8F9FA',
  },
  visitorDetailMain: {
    flexDirection: 'row',
    marginBottom: 0,
    backgroundColor: '#fff',
  },
  visitorLabelMain: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 8,
    minWidth: 120,
    color: '#333',
    backgroundColor: '#fff',
  },
  visitorValueMain: {
    fontSize: 14,
    color: '#666',
    flex: 1,
    backgroundColor: '#fff',
  },
  visitorLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 8,
    minWidth: 120,
    color: '#333',
    backgroundColor: '#F8F9FA',
  },
  visitorValue: {
    fontSize: 14,
    color: '#666',
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  activoInfo: {
    marginLeft: 10,
    marginTop: 5,
  },
  activoInfoText: {
    fontSize: 14,
    color: '#666',
    backgroundColor: '#fff',
  },
  toggleDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    marginTop: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  toggleDetailsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  expandedDetails: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 6,
    gap: 12,
  },
  activosSection: {
    marginTop: 8,
    gap: 12,
    backgroundColor: '#F8F9FA',
  },
  activoCard: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    gap: 8,
  },
  detallesSection: {
    marginTop: 8,
    gap: 4,
    backgroundColor: '#fff',
  },
  detalleItem: {
    marginLeft: 8,
    marginTop: 4,
    backgroundColor: '#fff',
  },
  detalleText: {
    fontSize: 13,
    color: '#666',
  },
  fotoCedulaSection: {
    marginTop: 8,
    gap: 8,
    backgroundColor: '#F8F9FA',
  },
  fotoCedulaImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 12,
    backgroundColor: '#fff',
    marginBottom: 6,
  },
  dateButtonText: {
    color: '#000',
    fontWeight: '700',
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  cameraControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: 30,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  cameraCancelButton: {
    padding: 10,
  },
  cameraCaptureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#fff',
    padding: 5,
  },
  cameraCaptureButtonInner: {
    flex: 1,
    borderRadius: 30,
    backgroundColor: '#007AFF',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  floatModalCardMovimientos: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  floatModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  cambioCollapsableMain: {
    width: '100%',
    marginBottom: 10,
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  cambioCollapsableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F8F9FA',
  },
  cambioCollapsableTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    flex: 1,
  },
  cambioCollapsableContent: {
    padding: 12,
    gap: 8,
    backgroundColor: '#F8F9FA',
  },
  changeDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: '#666',
    marginBottom: 8,
  },
  changesButton: {
    backgroundColor: '#5856D6',
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
});

