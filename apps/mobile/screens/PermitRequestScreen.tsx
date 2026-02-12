import React, { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  Dimensions,
  Modal,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { formatDateDMY } from '@/utils/formatDate';
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
import * as Location from 'expo-location';
import { jwtDecode } from 'jwt-decode';
import { useQRScanner } from '@/hooks/useQRScanner';
import {
  createPermitRequest,
  updatePermitRequest,
  deletePermitRequest,
  listPermitRequestByCorpo,
} from '@/hooks/evaluationFunctions';
import { eventBus } from '@/hooks/eventBus';
import getHoraAccion from '@/hooks/getHoraAccion';
import authedFetch from '@/hooks/authedFetch';

type PermitRequestScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'PermitRequest'>;

interface PermitRequest {
  id: string | number;
  id_local: string;
  division?: string | null;
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
  firma_responsables: string | null;
  created_at: string;
  synced?: boolean;
}

interface EditingPermitRequest {
  id: string | number | null;
  id_local: string;
  division: string;
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
  firma_responsables: string;
}

interface FirmaData {
  sessionId: string;
  empleadoId: string;
  latitud: string;
  longitud: string;
  timestamp: string;
  empleadoDetalle?: {
    nombre: string;
    primer_apellido: string;
    segundo_apellido: string;
    cedula_empleado?: string;
  };
}

type CorpoEmpleado = {
  id: number;
  nombre: string;
  cedula: string;
  codigo: string;
  fecha_contratacion: string;
};

export default function PermitRequestScreen() {
  const { employee, refreshAccessToken, logout } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<PermitRequestScreenNavigationProp>();
  const { scanQR, QRScannerComponent } = useQRScanner();

  // Data states
  const [permits, setPermits] = useState<PermitRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasCurrentMarca, setHasCurrentMarca] = useState<boolean>(false);

  // Modal: ver cambios (auditoría)
  const [isCambiosModalVisible, setIsCambiosModalVisible] = useState(false);
  const [cambiosTitle, setCambiosTitle] = useState<string>('Cambios');
  const [cambiosItems, setCambiosItems] = useState<any[]>([]);
  const [expandedCambioId, setExpandedCambioId] = useState<number | null>(null);

  // Editing state
  const [editingRecord, setEditingRecord] = useState<EditingPermitRequest | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form states
  const [division, setDivision] = useState<'Seguridad' | 'Aseo y limpieza' | 'Otros' | ''>('');
  const [personaSolicita, setPersonaSolicita] = useState('');
  const [codigo, setCodigo] = useState('');
  const [contrato, setContrato] = useState('');
  const [horario, setHorario] = useState('');
  const [fechaSolicitud, setFechaSolicitud] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [motivoPermiso, setMotivoPermiso] = useState('');
  const [permisoSustituidoPor, setPermisoSustituidoPor] = useState('');
  const [codigoSustituto, setCodigoSustituto] = useState('');
  const [permisoCoordinadoPor, setPermisoCoordinadoPor] = useState('');

  // Dropdown empleados corpo
  const [empleadosCorpo, setEmpleadosCorpo] = useState<CorpoEmpleado[]>([]);
  const [selectedEmpleadoId, setSelectedEmpleadoId] = useState<string>('');
  const [selectedSustitutoId, setSelectedSustitutoId] = useState<string>('');

  // Firmas (hash base64) + info decodificada (si aplica)
  const [firmaGerenteHash, setFirmaGerenteHash] = useState<string>('');
  const [firmaEncargadoHash, setFirmaEncargadoHash] = useState<string>('');
  const [firmaResponsablesHash, setFirmaResponsablesHash] = useState<string>('');
  const [firmaGerenteInfo, setFirmaGerenteInfo] = useState<FirmaData | null>(null);
  const [firmaEncargadoInfo, setFirmaEncargadoInfo] = useState<FirmaData | null>(null);
  const [firmaResponsablesInfo, setFirmaResponsablesInfo] = useState<FirmaData | null>(null);
  const [isGeneratingFirmaGerente, setIsGeneratingFirmaGerente] = useState(false);
  const [isGeneratingFirmaEncargado, setIsGeneratingFirmaEncargado] = useState(false);
  const [isGeneratingFirmaResponsables, setIsGeneratingFirmaResponsables] = useState(false);

  const getConnectionStatus = async (): Promise<boolean> => {
    const networkState = await Network.getNetworkStateAsync();
    return networkState.isConnected && networkState.isInternetReachable ? true : false;
  };

  const closeCambiosModal = () => {
    setIsCambiosModalVisible(false);
    setCambiosItems([]);
    setExpandedCambioId(null);
  };

  const formatCambioCreatedAt = (value: any) => {
    if (!value) return '-';
    try {
      const date = new Date(value);
      return date.toLocaleString('es-CR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
    } catch {
      return String(value);
    }
  };

  const formatChangeValue = (value: any): string => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    if (typeof value === 'string') {
      if (value.trim().startsWith('{') || value.trim().startsWith('[')) {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) {
            return parsed.map((item, idx) => {
              if (typeof item === 'object' && item !== null) {
                return `Item ${idx + 1}: ${JSON.stringify(item, null, 2)}`;
              }
              return String(item);
            }).join('\n');
          }
          if (typeof parsed === 'object') {
            return JSON.stringify(parsed, null, 2);
          }
        } catch {
          // Not valid JSON, return as string
        }
      }
      return value;
    }
    return String(value);
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
          headers: { 'Content-Type': 'application/json' },
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

  const generateRandomId = (): string => {
    return `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDateForDisplay = (date: Date): string => {
    const [year, month, day] = formatDate(date).split('-');
    return `${day}-${month}-${year}`;
  };

  const parseDateStringToDate = (value: string): Date | null => {
    const s = String(value || '').trim();
    if (!s) return null;

    // dd/mm/yyyy
    if (s.includes('/')) {
      const parts = s.split('/');
      if (parts.length === 3) {
        const [dd, mm, yyyy] = parts;
        const d = new Date(parseInt(yyyy, 10), parseInt(mm, 10) - 1, parseInt(dd, 10));
        return isNaN(d.getTime()) ? null : d;
      }
    }

    // ISO
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  };

  const decodeFirmaHash = (hash: string): FirmaData | null => {
    try {
      if (!hash || String(hash).trim().length === 0) return null;
      const decoded = atob(String(hash));
      const parts = decoded.split(':');
      if (parts.length !== 5) return null;
      const [sessionId, empleadoId, latitud, longitud, timestamp] = parts;
      return { sessionId, empleadoId, latitud, longitud, timestamp };
    } catch {
      return null;
    }
  };

  const fetchEmpleadoDetalleIfPossible = async (empleadoId: string): Promise<FirmaData['empleadoDetalle'] | undefined> => {
    try {
      const isConnected = await getConnectionStatus();
      if (!isConnected) return undefined;

      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) return undefined;
      const resp = await authedFetch({
        url: `${apiUrl}/api/empleados/${empleadoId}`,
        init: {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        },
        refreshAccessToken,
        logout,
      });
      if (!resp) return undefined;
      if (!resp.ok) return undefined;
      const data = await resp.json().catch(() => ({}));
      return {
        nombre: data.nombre,
        primer_apellido: data.primer_apellido,
        segundo_apellido: data.segundo_apellido,
        cedula_empleado: data.cedula,
      };
    } catch {
      return undefined;
    }
  };

  const generateFirmaHashForCurrentUser = async (): Promise<{ hash: string; info: FirmaData } | null> => {
    if (!employee?.id) {
      Alert.alert('Error', 'No se pudo obtener la información del empleado');
      return null;
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permisos requeridos', 'Se necesita acceso a la ubicación para generar la firma');
      return null;
    }

    const location = await Location.getCurrentPositionAsync({});
    const token = await AsyncStorage.getItem('access_token');
    if (!token) {
      Alert.alert('Error', 'No se pudo obtener el token de sesión');
      return null;
    }

    const decoded: any = jwtDecode(token);
    const sessionId = decoded.sessionId || 'unknown';

    const timestamp = await getHoraAccion();
    if (!timestamp) {
      Alert.alert('Error', 'No se pudo obtener la hora');
      return null;
    }

    const { latitude, longitude } = location.coords;
    const empleadoId = String(employee.id);

    const signatureString = `${sessionId}:${empleadoId}:${latitude}:${longitude}:${timestamp}`;
    const hash = btoa(signatureString);

    const info: FirmaData = {
      sessionId: String(sessionId),
      empleadoId,
      latitud: String(latitude),
      longitud: String(longitude),
      timestamp: String(timestamp),
    };

    const detalle = await fetchEmpleadoDetalleIfPossible(empleadoId);
    if (detalle) info.empleadoDetalle = detalle;

    return { hash, info };
  };

  const handleGenerateFirma = async (type: 'gerente' | 'encargado' | 'responsables') => {
    try {
      if (type === 'gerente') setIsGeneratingFirmaGerente(true);
      if (type === 'encargado') setIsGeneratingFirmaEncargado(true);
      if (type === 'responsables') setIsGeneratingFirmaResponsables(true);

      const result = await generateFirmaHashForCurrentUser();
      if (!result) return;

      if (type === 'gerente') {
        setFirmaGerenteHash(result.hash);
        setFirmaGerenteInfo(result.info);
      } else if (type === 'encargado') {
        setFirmaEncargadoHash(result.hash);
        setFirmaEncargadoInfo(result.info);
      } else {
        setFirmaResponsablesHash(result.hash);
        setFirmaResponsablesInfo(result.info);
      }
    } catch (e) {
      console.error('Error generating signature:', e);
      Alert.alert('Error', 'No se pudo generar la firma digital');
    } finally {
      if (type === 'gerente') setIsGeneratingFirmaGerente(false);
      if (type === 'encargado') setIsGeneratingFirmaEncargado(false);
      if (type === 'responsables') setIsGeneratingFirmaResponsables(false);
    }
  };

  const handleScanFirma = async (type: 'gerente' | 'encargado' | 'responsables') => {
    try {
      const qrData = await scanQR();
      if (!qrData) return;

      const decoded = decodeFirmaHash(qrData);
      if (!decoded) {
        Alert.alert('Error', 'El QR escaneado no tiene el formato correcto');
        return;
      }

      const detalle = await fetchEmpleadoDetalleIfPossible(decoded.empleadoId);
      const decodedWithDetalle: FirmaData = detalle ? { ...decoded, empleadoDetalle: detalle } : decoded;

      if (type === 'gerente') {
        setFirmaGerenteHash(qrData);
        setFirmaGerenteInfo(decodedWithDetalle);
      } else if (type === 'encargado') {
        setFirmaEncargadoHash(qrData);
        setFirmaEncargadoInfo(decodedWithDetalle);
      } else {
        setFirmaResponsablesHash(qrData);
        setFirmaResponsablesInfo(decodedWithDetalle);
      }
    } catch (e) {
      console.error('Error scanning QR:', e);
      Alert.alert('Error', 'No se pudo escanear el código QR');
    }
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

      // empleados corpo (cacheable)
      try {
        const cacheKey = `empleados_corpo_${corpoId}_cache`;
        if (isConnected) {
          const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
          if (apiUrl) {
            const resp = await authedFetch({
              url: `${apiUrl}/api/empleados/corpo/${corpoId}`,
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

            if (resp.ok) {
              const json = await resp.json().catch(() => ({}));
              const empleados: CorpoEmpleado[] = Array.isArray(json.empleados) ? json.empleados : [];
              setEmpleadosCorpo(empleados);
              await AsyncStorage.setItem(cacheKey, JSON.stringify(empleados));
            }
          }
        } else {
          const cached = await AsyncStorage.getItem(cacheKey);
          if (cached) {
            const empleados = JSON.parse(cached);
            setEmpleadosCorpo(Array.isArray(empleados) ? empleados : []);
          }
        }
      } catch (e) {
        // no bloquear pantalla por dropdown
        console.warn('Error loading empleados corpo:', e);
      }

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

  // Actualizar selectedSustitutoId cuando se carguen los empleados y estemos en modo edición
  useEffect(() => {
    if (editingRecord && empleadosCorpo.length > 0 && permisoSustituidoPor) {
      const sustitutoMatch = empleadosCorpo.find(emp =>
        emp.nombre === permisoSustituidoPor ||
        (emp.codigo && emp.codigo === codigoSustituto)
      );
      if (sustitutoMatch && selectedSustitutoId !== String(sustitutoMatch.id)) {
        setSelectedSustitutoId(String(sustitutoMatch.id));
      }
    }
  }, [empleadosCorpo, editingRecord, permisoSustituidoPor, codigoSustituto, selectedSustitutoId]);

  const resetForm = () => {
    setDivision('');
    setPersonaSolicita('');
    setCodigo('');
    setContrato('');
    setHorario('');
    setFechaSolicitud(new Date());
    setMotivoPermiso('');
    setPermisoSustituidoPor('');
    setCodigoSustituto('');
    setPermisoCoordinadoPor('');
    setSelectedEmpleadoId('');
    setSelectedSustitutoId('');
    setFirmaGerenteHash('');
    setFirmaEncargadoHash('');
    setFirmaResponsablesHash('');
    setFirmaGerenteInfo(null);
    setFirmaEncargadoInfo(null);
    setFirmaResponsablesInfo(null);
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
      division: (record.division as any) || '',
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
      firma_responsables: record.firma_responsables || '',
    });

    setDivision((record.division as any) || '');
    setPersonaSolicita(record.persona_solicita || '');
    setCodigo(record.codigo || '');
    setContrato(record.contrato || '');
    setHorario(record.horario || '');
    if (record.fecha_solicitud) {
      const parsed = parseDateStringToDate(record.fecha_solicitud);
      if (parsed) setFechaSolicitud(parsed);
    }
    setMotivoPermiso(record.motivo_permiso || '');
    setPermisoSustituidoPor(record.permiso_sustituido_por || '');
    setCodigoSustituto(record.codigo_sustituto || '');

    // Intentar encontrar el sustituto en la lista de empleados
    if (record.permiso_sustituido_por && empleadosCorpo.length > 0) {
      const sustitutoMatch = empleadosCorpo.find(emp =>
        emp.nombre === record.permiso_sustituido_por ||
        (emp.codigo && emp.codigo === record.codigo_sustituto)
      );
      if (sustitutoMatch) {
        setSelectedSustitutoId(String(sustitutoMatch.id));
      } else {
        setSelectedSustitutoId('');
      }
    } else {
      setSelectedSustitutoId('');
    }

    // Firmas existentes (pueden venir en formato antiguo; si no se puede decodificar, igual conservamos el string)
    const gerenteHash = record.firma_gerente || '';
    const encargadoHash = record.firma_encargado_monitoreo || '';
    const responsablesHash = record.firma_responsables || '';
    setFirmaGerenteHash(gerenteHash);
    setFirmaEncargadoHash(encargadoHash);
    setFirmaResponsablesHash(responsablesHash);
    setFirmaGerenteInfo(decodeFirmaHash(gerenteHash));
    setFirmaEncargadoInfo(decodeFirmaHash(encargadoHash));
    setFirmaResponsablesInfo(decodeFirmaHash(responsablesHash));

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

  const savePermitHandler = async () => {
    const currentMarca = await AsyncStorage.getItem('current_marca');
    if (!currentMarca) {
      Alert.alert('Error', 'No se encontró la marca actual');
      return;
    }

    const currentMarcaData = JSON.parse(currentMarca);

    // Validaciones (modelo requiere campos no nulos)
    if (!division) return Alert.alert('Error', 'La división es obligatoria');
    if (!personaSolicita.trim()) return Alert.alert('Error', 'Persona que solicita es obligatoria');
    if (!codigo.trim()) return Alert.alert('Error', 'Código es obligatorio');
    if (!contrato.trim()) return Alert.alert('Error', 'Contrato es obligatorio');
    if (!horario.trim()) return Alert.alert('Error', 'Horario es obligatorio');
    if (!motivoPermiso.trim()) return Alert.alert('Error', 'Motivo del permiso es obligatorio');
    if (!permisoSustituidoPor.trim()) return Alert.alert('Error', 'Permiso sustituido por es obligatorio');
    if (!codigoSustituto.trim()) return Alert.alert('Error', 'Código sustituto es obligatorio');
    if (!permisoCoordinadoPor.trim()) return Alert.alert('Error', 'Permiso coordinado por es obligatorio');
    if (!firmaGerenteHash.trim()) return Alert.alert('Error', 'La firma de gerente es obligatoria');
    if (!firmaEncargadoHash.trim()) return Alert.alert('Error', 'La firma del encargado de monitoreo es obligatoria');
    if (!firmaResponsablesHash.trim()) return Alert.alert('Error', 'La firma de responsables es obligatoria');

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
                division: division,
                persona_solicita: personaSolicita.trim(),
                codigo: codigo.trim(),
                contrato: contrato.trim(),
                horario: horario.trim(),
                fecha_solicitud: formatDate(fechaSolicitud),
                motivo_permiso: motivoPermiso.trim(),
                permiso_sustituido_por: permisoSustituidoPor.trim(),
                codigo_sustituto: codigoSustituto.trim(),
                firma_gerente: firmaGerenteHash.trim(),
                firma_encargado_monitoreo: firmaEncargadoHash.trim(),
                permiso_coordinado_por: permisoCoordinadoPor.trim(),
                firma_responsables: firmaResponsablesHash.trim(),
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
                  division: division,
                  persona_solicita: personaSolicita.trim(),
                  codigo: codigo.trim(),
                  contrato: contrato.trim(),
                  horario: horario.trim(),
                  fecha_solicitud: formatDate(fechaSolicitud),
                  motivo_permiso: motivoPermiso.trim(),
                  permiso_sustituido_por: permisoSustituidoPor.trim(),
                  codigo_sustituto: codigoSustituto.trim(),
                  firma_gerente: firmaGerenteHash.trim(),
                  firma_encargado_monitoreo: firmaEncargadoHash.trim(),
                  permiso_coordinado_por: permisoCoordinadoPor.trim(),
                  firma_responsables: firmaResponsablesHash.trim(),
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

    // Validaciones (mantener modelo consistente)
    if (!division) return Alert.alert('Error', 'La división es obligatoria');
    if (!personaSolicita.trim()) return Alert.alert('Error', 'Persona que solicita es obligatoria');
    if (!codigo.trim()) return Alert.alert('Error', 'Código es obligatorio');
    if (!contrato.trim()) return Alert.alert('Error', 'Contrato es obligatorio');
    if (!horario.trim()) return Alert.alert('Error', 'Horario es obligatorio');
    if (!motivoPermiso.trim()) return Alert.alert('Error', 'Motivo del permiso es obligatorio');
    if (!permisoSustituidoPor.trim()) return Alert.alert('Error', 'Permiso sustituido por es obligatorio');
    if (!codigoSustituto.trim()) return Alert.alert('Error', 'Código sustituto es obligatorio');
    if (!permisoCoordinadoPor.trim()) return Alert.alert('Error', 'Permiso coordinado por es obligatorio');
    if (!firmaGerenteHash.trim()) return Alert.alert('Error', 'La firma de gerente es obligatoria');
    if (!firmaEncargadoHash.trim()) return Alert.alert('Error', 'La firma del encargado de monitoreo es obligatoria');
    if (!firmaResponsablesHash.trim()) return Alert.alert('Error', 'La firma de responsables es obligatoria');

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
                division: division,
                persona_solicita: personaSolicita.trim(),
                codigo: codigo.trim(),
                contrato: contrato.trim(),
                horario: horario.trim(),
                fecha_solicitud: formatDate(fechaSolicitud),
                motivo_permiso: motivoPermiso.trim(),
                permiso_sustituido_por: permisoSustituidoPor.trim(),
                codigo_sustituto: codigoSustituto.trim(),
                firma_gerente: firmaGerenteHash.trim(),
                firma_encargado_monitoreo: firmaEncargadoHash.trim(),
                permiso_coordinado_por: permisoCoordinadoPor.trim(),
                firma_responsables: firmaResponsablesHash.trim(),
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
                  {record.persona_solicita || 'N/A'}
                </ThemedText>
                <ThemedText style={styles.listItemSubtitle}>
                  Divisón: {record.division ? `${record.division}` : ''}
                </ThemedText>
                <ThemedText style={styles.listItemSubtitle}>
                  Fecha: {formatDateDMY(record.fecha_solicitud)}
                </ThemedText>
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
                {!(record.id_local || String(record.id).startsWith('local-') || String(record.id) === '0') && (
                  <TouchableOpacity
                    style={[styles.listItemButton, styles.changesButton]}
                    onPress={() => {
                      setCambiosTitle(`Cambios - Solicitud #${record.id}`);
                      fetchCambios('c_solicitud_permiso', Number(record.id));
                    }}
                  >
                    <Ionicons name="list-outline" size={20} color="#FFFFFF" />
                    <ThemedText style={styles.listItemButtonText}>Cambios</ThemedText>
                  </TouchableOpacity>
                )}
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
        showsVerticalScrollIndicator={true}
      >
        <ThemedView style={styles.contentContainer}>
          <ThemedView style={styles.titleContainer}>
            <ThemedText type="title" style={styles.title}>
              {getActionIcon('permit')} Solicitud de Permiso
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              Gestiona las solicitudes de permiso
            </ThemedText>
          </ThemedView>

          {!hasCurrentMarca && (
            <ThemedView style={styles.noMarcaContainer}>
              <ThemedText style={styles.noMarcaTitle}>Marca no seleccionada</ThemedText>
              <ThemedText style={styles.noMarcaMessage}>
                No se encontró una marca seleccionada. Por favor, selecciona una marca desde el menú principal.
              </ThemedText>
            </ThemedView>
          )}

          {isCreating || editingRecord ? (
            <ThemedView style={styles.formCard}>
              {/* División */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>División *</ThemedText>
                <ThemedView style={styles.pickerContainer}>
                  <Picker
                    selectedValue={division}
                    onValueChange={(val) => setDivision(val as 'Seguridad' | 'Aseo y limpieza' | 'Otros' | '')}
                    style={styles.picker}
                  >
                    <Picker.Item label="Seleccionar" value="" />
                    <Picker.Item label="Seguridad" value="Seguridad" />
                    <Picker.Item label="Aseo y limpieza" value="Aseo y limpieza" />
                    <Picker.Item label="Otros" value="Otros" />
                  </Picker>
                </ThemedView>
              </ThemedView>

              {/* Colaborador (dropdown) */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Colaborador</ThemedText>
                <ThemedView style={styles.pickerContainer}>
                  <Picker
                    selectedValue={selectedEmpleadoId}
                    onValueChange={(val) => {
                      const v = String(val || '');
                      setSelectedEmpleadoId(v);
                      const emp = empleadosCorpo.find(e => String(e.id) === v);
                      if (emp) {
                        setPersonaSolicita(emp.nombre || '');
                        setCodigo(emp.codigo || '');
                      }
                    }}
                    style={styles.picker}
                  >
                    <Picker.Item label="Seleccionar" value="" />
                    {empleadosCorpo.map(emp => (
                      <Picker.Item
                        key={emp.id}
                        label={`${emp.nombre}${emp.codigo ? ` (${emp.codigo})` : ''}`}
                        value={String(emp.id)}
                      />
                    ))}
                  </Picker>
                </ThemedView>
              </ThemedView>

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
                    {formatDateForDisplay(fechaSolicitud)}
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

              {/* Sustituto (dropdown) */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Sustituto</ThemedText>
                <ThemedView style={styles.pickerContainer}>
                  <Picker
                    selectedValue={selectedSustitutoId}
                    onValueChange={(val) => {
                      const v = String(val || '');
                      setSelectedSustitutoId(v);
                      const emp = empleadosCorpo.find(e => String(e.id) === v);
                      if (emp) {
                        setPermisoSustituidoPor(emp.nombre || '');
                        setCodigoSustituto(emp.codigo || '');
                      }
                    }}
                    style={styles.picker}
                  >
                    <Picker.Item label="Seleccionar" value="" />
                    {empleadosCorpo.map(emp => (
                      <Picker.Item
                        key={emp.id}
                        label={`${emp.nombre}${emp.codigo ? ` (${emp.codigo})` : ''}`}
                        value={String(emp.id)}
                      />
                    ))}
                  </Picker>
                </ThemedView>
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
                <ThemedText style={styles.formLabel}>Firma de gerente *</ThemedText>
                {!firmaGerenteHash ? (
                  <ThemedView style={styles.signatureButtons}>
                    <TouchableOpacity
                      style={[styles.signatureButton, isGeneratingFirmaGerente && styles.signatureButtonDisabled]}
                      onPress={() => handleGenerateFirma('gerente')}
                      disabled={isGeneratingFirmaGerente}
                    >
                      {isGeneratingFirmaGerente ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons name="finger-print" size={24} color="#FFFFFF" />
                          <ThemedText style={styles.signatureButtonText}>Generar</ThemedText>
                        </>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.signatureButton}
                      onPress={() => handleScanFirma('gerente')}
                    >
                      <Ionicons name="qr-code" size={20} color="#FFFFFF" />
                      <ThemedText style={styles.signatureButtonText}>Escanear QR</ThemedText>
                    </TouchableOpacity>
                  </ThemedView>
                ) : (
                  <ThemedView style={styles.signatureInfo}>
                    <ThemedText style={styles.signatureInfoTitle}>Información de la firma:</ThemedText>
                    <ThemedText style={styles.signatureInfoText}>ID de sesión: {firmaGerenteInfo?.sessionId || 'N/A'}</ThemedText>
                    <ThemedText style={styles.signatureInfoText}>ID del empleado: {firmaGerenteInfo?.empleadoId || 'N/A'}</ThemedText>
                    {firmaGerenteInfo?.empleadoDetalle && (
                      <ThemedView style={styles.signatureInfoDetail}>
                        <ThemedText style={styles.signatureInfoDetailText}>
                          {firmaGerenteInfo.empleadoDetalle.nombre} {firmaGerenteInfo.empleadoDetalle.primer_apellido} {firmaGerenteInfo.empleadoDetalle.segundo_apellido}
                        </ThemedText>
                      </ThemedView>
                    )}
                    <ThemedText style={styles.signatureInfoText}>Latitud: {firmaGerenteInfo?.latitud || 'N/A'}</ThemedText>
                    <ThemedText style={styles.signatureInfoText}>Longitud: {firmaGerenteInfo?.longitud || 'N/A'}</ThemedText>
                    <TouchableOpacity
                      style={styles.clearSignatureButton}
                      onPress={() => {
                        setFirmaGerenteHash('');
                        setFirmaGerenteInfo(null);
                      }}
                    >
                      <ThemedText style={styles.clearSignatureText}>
                        <Ionicons name="trash" size={18} color="#FFFFFF" />
                      </ThemedText>
                    </TouchableOpacity>
                  </ThemedView>
                )}
              </ThemedView>

              {/* Encargado de monitoreo */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Firma encargado de monitoreo *</ThemedText>
                {!firmaEncargadoHash ? (
                  <ThemedView style={styles.signatureButtons}>
                    <TouchableOpacity
                      style={[styles.signatureButton, isGeneratingFirmaEncargado && styles.signatureButtonDisabled]}
                      onPress={() => handleGenerateFirma('encargado')}
                      disabled={isGeneratingFirmaEncargado}
                    >
                      {isGeneratingFirmaEncargado ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons name="finger-print" size={24} color="#FFFFFF" />
                          <ThemedText style={styles.signatureButtonText}>Generar</ThemedText>
                        </>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.signatureButton}
                      onPress={() => handleScanFirma('encargado')}
                    >
                      <Ionicons name="qr-code" size={20} color="#FFFFFF" />
                      <ThemedText style={styles.signatureButtonText}>Escanear QR</ThemedText>
                    </TouchableOpacity>
                  </ThemedView>
                ) : (
                  <ThemedView style={styles.signatureInfo}>
                    <ThemedText style={styles.signatureInfoTitle}>Información de la firma:</ThemedText>
                    <ThemedText style={styles.signatureInfoText}>ID de sesión: {firmaEncargadoInfo?.sessionId || 'N/A'}</ThemedText>
                    <ThemedText style={styles.signatureInfoText}>ID del empleado: {firmaEncargadoInfo?.empleadoId || 'N/A'}</ThemedText>
                    {firmaEncargadoInfo?.empleadoDetalle && (
                      <ThemedView style={styles.signatureInfoDetail}>
                        <ThemedText style={styles.signatureInfoDetailText}>
                          {firmaEncargadoInfo.empleadoDetalle.nombre} {firmaEncargadoInfo.empleadoDetalle.primer_apellido} {firmaEncargadoInfo.empleadoDetalle.segundo_apellido}
                        </ThemedText>
                      </ThemedView>
                    )}
                    <ThemedText style={styles.signatureInfoText}>Latitud: {firmaEncargadoInfo?.latitud || 'N/A'}</ThemedText>
                    <ThemedText style={styles.signatureInfoText}>Longitud: {firmaEncargadoInfo?.longitud || 'N/A'}</ThemedText>
                    <TouchableOpacity
                      style={styles.clearSignatureButton}
                      onPress={() => {
                        setFirmaEncargadoHash('');
                        setFirmaEncargadoInfo(null);
                      }}
                    >
                      <ThemedText style={styles.clearSignatureText}>
                        <Ionicons name="trash" size={18} color="#FFFFFF" />
                      </ThemedText>
                    </TouchableOpacity>
                  </ThemedView>
                )}
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

              {/* Firma responsables */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Firma responsables *</ThemedText>
                {!firmaResponsablesHash ? (
                  <ThemedView style={styles.signatureButtons}>
                    <TouchableOpacity
                      style={[styles.signatureButton, isGeneratingFirmaResponsables && styles.signatureButtonDisabled]}
                      onPress={() => handleGenerateFirma('responsables')}
                      disabled={isGeneratingFirmaResponsables}
                    >
                      {isGeneratingFirmaResponsables ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons name="finger-print" size={24} color="#FFFFFF" />
                          <ThemedText style={styles.signatureButtonText}>Generar</ThemedText>
                        </>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.signatureButton}
                      onPress={() => handleScanFirma('responsables')}
                    >
                      <Ionicons name="qr-code" size={20} color="#FFFFFF" />
                      <ThemedText style={styles.signatureButtonText}>Escanear QR</ThemedText>
                    </TouchableOpacity>
                  </ThemedView>
                ) : (
                  <ThemedView style={styles.signatureInfo}>
                    <ThemedText style={styles.signatureInfoTitle}>Información de la firma:</ThemedText>
                    <ThemedText style={styles.signatureInfoText}>ID de sesión: {firmaResponsablesInfo?.sessionId || 'N/A'}</ThemedText>
                    <ThemedText style={styles.signatureInfoText}>ID del empleado: {firmaResponsablesInfo?.empleadoId || 'N/A'}</ThemedText>
                    {firmaResponsablesInfo?.empleadoDetalle && (
                      <ThemedView style={styles.signatureInfoDetail}>
                        <ThemedText style={styles.signatureInfoDetailText}>
                          {firmaResponsablesInfo.empleadoDetalle.nombre} {firmaResponsablesInfo.empleadoDetalle.primer_apellido} {firmaResponsablesInfo.empleadoDetalle.segundo_apellido}
                        </ThemedText>
                      </ThemedView>
                    )}
                    <ThemedText style={styles.signatureInfoText}>Latitud: {firmaResponsablesInfo?.latitud || 'N/A'}</ThemedText>
                    <ThemedText style={styles.signatureInfoText}>Longitud: {firmaResponsablesInfo?.longitud || 'N/A'}</ThemedText>
                    <TouchableOpacity
                      style={styles.clearSignatureButton}
                      onPress={() => {
                        setFirmaResponsablesHash('');
                        setFirmaResponsablesInfo(null);
                      }}
                    >
                      <ThemedText style={styles.clearSignatureText}>
                        <Ionicons name="trash" size={18} color="#FFFFFF" />
                      </ThemedText>
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
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.saveButton]}
                  onPress={editingRecord ? updatePermitHandler : savePermitHandler}
                >
                  {getActionIcon('confirm')}
                </TouchableOpacity>
              </ThemedView>
            </ThemedView>
          ) : (
            <ThemedView style={styles.listSection}>
              {!isLoading && (
                <TouchableOpacity style={styles.createButton} onPress={startCreating}>
                  <Ionicons name="add" size={24} color="#FFFFFF" />
                  <ThemedText style={styles.createButtonText}>Nueva Solicitud</ThemedText>
                </TouchableOpacity>
              )}
              {renderPermitList()}
            </ThemedView>
          )}
        </ThemedView>
      </ScrollView>

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
                              {(Array.isArray(parsed) ? parsed : []).map((c: any, idx: number) => (
                                <ThemedText key={`c-${row.id}-${idx}`} style={styles.changeDescription}>
                                  <ThemedText style={{ fontWeight: '800' }}>{String(c?.prop ?? '-')}: </ThemedText>
                                  {formatChangeValue(c?.after)}
                                </ThemedText>
                              ))}
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
        onClose={handleMenuClose}
        onHomePress={handleHomePress}
        currentRoute="PermitRequest"
      />
      {QRScannerComponent}
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
  formCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#fff',
    padding: 16,
    gap: 8,
    marginBottom: 20,
  },
  formGroup: {
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  formInput: {
    width: '100%',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: '#F9F9F9',
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
    width: '100%',
    height: 50,
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
  signatureButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    backgroundColor: '#fff',
  },
  signatureButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minWidth: '45%',
  },
  signatureButtonDisabled: {
    backgroundColor: '#999',
  },
  signatureButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  signatureInfo: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  signatureInfoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000000',
  },
  signatureInfoText: {
    fontSize: 14,
    marginBottom: 4,
    color: '#000000',
  },
  signatureInfoDetail: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#BDE4FF',
    borderRadius: 8,
    marginBottom: 4,
  },
  signatureInfoDetailText: {
    fontSize: 12,
    color: '#000000',
  },
  clearSignatureButton: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#FF3B30',
    borderRadius: 6,
    alignItems: 'center',
    width: '100%',
  },
  clearSignatureText: {
    color: '#FFFFFF',
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
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#8E8E93',
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  listSection: {
    width: '100%',
  },
  listContainer: {
    width: '100%',
    gap: 16,
  },
  listItem: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#fff',
    padding: 16,
    gap: 8,
    marginBottom: 16,
    overflow: 'hidden',
  },
  listItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  listItemContent: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
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
    borderTopWidth: 1,
    borderTopColor: '#EEE',
    paddingTop: 12,
    marginTop: 8,
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
    borderRadius: 6,
    gap: 8,
  },
  editButton: {
    backgroundColor: '#007AFF',
  },
  changesButton: { backgroundColor: '#5856D6', flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 8, gap: 8 },
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
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  floatModalCardMovimientos: { backgroundColor: '#FFFFFF', borderRadius: 12, width: '100%', maxWidth: 500, maxHeight: '80%', borderWidth: 1, borderColor: '#E0E0E0', overflow: 'hidden' },
  floatModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#000' },
  cambioCollapsableMain: { width: '100%', marginBottom: 10, backgroundColor: '#fff', borderRadius: 6, borderWidth: 1, borderColor: '#E0E0E0', overflow: 'hidden' },
  cambioCollapsableHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#F8F9FA' },
  cambioCollapsableTitle: { fontSize: 14, fontWeight: '600', color: '#007AFF', flex: 1 },
  cambioCollapsableContent: { padding: 12, gap: 8, backgroundColor: '#F8F9FA' },
  changeDescription: { fontSize: 14, lineHeight: 20, color: '#666', marginBottom: 8 },
  filterGroupSearch: { marginBottom: 12 },
  filterLabel: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 4 },
});

