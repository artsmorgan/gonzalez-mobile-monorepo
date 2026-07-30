import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import SignatureScreen from 'react-native-signature-canvas';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import * as DocumentPicker from 'expo-document-picker';
import getCurrentUserDigitalSignature from '@/hooks/getCurrentUserDigitalSignature';
import Constants from 'expo-constants';

import AppHeader from '@/components/AppHeader';
import AppFooter from '@/components/AppFooter';
import SlideMenu from '@/components/SlideMenu';
import { Collapsible } from '@/components/Collapsible';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import CambiosAppsModulesModal, { type CambiosAppsModulesRow } from '@/components/CambiosAppsModulesModal';
import { useAuth } from '@/contexts/AuthContext';
import { useQRScanner } from '@/hooks/useQRScanner';
import authedFetch from '@/hooks/authedFetch';
import getHoraAccion from '@/hooks/getHoraAccion';
import type { MarcaDiaResumen, MutuoAcuerdo } from '@/hooks/mutuosAcuerdosTypes';
import {
  acceptMutuoAcuerdo,
  createMutuoAcuerdo,
  listMarcasParaMutuo,
  listMutuosAcuerdosMine,
  rejectMutuoAcuerdoEjecutivo,
  signMutuoAcuerdoEjecutivo,
} from '@/hooks/mutuosAcuerdosFunctions';
import { isStoredPlanillasTokenValid } from '@/hooks/planillasTokenStorage';
import PlanillasPasswordRevalidationModal from '@/components/PlanillasPasswordRevalidationModal';
import { convertDateTimestampToLocalString } from '@/hooks/convertDateTimestampToLocalString';
import { saveFile, getFile, deleteFile } from '@/hooks/fileStorage';
import type { RootStackParamList } from '../App';

type Nav = NativeStackNavigationProp<RootStackParamList, 'MutuosAcuerdos'>;
type SectionKey = 'ausente' | 'reemplaza';

type EmployeeSectionState = {
  fecha: Date;
  showDatePicker: boolean;
  codigo: string;
  employeeId: number | null;
  employeeNombre: string;
  employeeCedula: string;
  marcas: MarcaDiaResumen[];
  selectedMarcaId: number | null;
  loadingMarcas: boolean;
  message: string;
};

const emptySection = ( horaAccion: number ): EmployeeSectionState => ({
  fecha: new Date(horaAccion),
  showDatePicker: false,
  codigo: '',
  employeeId: null,
  employeeNombre: '',
  employeeCedula: '',
  marcas: [],
  selectedMarcaId: null,
  loadingMarcas: false,
  message: '',
});

const dateToYmd = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatDateDMY = (d: Date) => {
  const ymd = dateToYmd(d);
  const [y, m, day] = ymd.split('-');
  return `${day}-${m}-${y}`;
};

const formatTime = (raw?: string | null) => {
  if (!raw) return '—';
  const str = String(raw).trim();
  if (!str) return '—';
  if (str.includes('T')) {
    const afterT = str.split('T')[1] || '';
    return afterT.replace(/\.\d+Z?$/i, '').trim() || str;
  }
  return str.replace(/\.\d+Z?$/i, '').trim();
};

const formatDateFromIsoToDMY = (raw?: string | null) => {
  if (!raw) return '—';
  const ymd = String(raw).split('T')[0];
  const parsed = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!parsed) return ymd || '—';
  return `${parsed[3]}-${parsed[2]}-${parsed[1]}`;
};

const normalizeDateToYMD = (value: string): string => {
  const raw = String(value || '').trim().split('T')[0];
  if (!raw) return '';
  const ymd = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
  const dmy = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  return '';
};

const localDateFromYmd = (ymd: string): Date => {
  const normalized = normalizeDateToYMD(ymd);
  if (!normalized) return new Date();
  const [y, m, d] = normalized.split('-').map((x) => parseInt(x, 10));
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return new Date();
  return new Date(y, m - 1, d);
};

const estadoBucketMutuo = (r: MutuoAcuerdo): 'pendiente' | 'aprobado' | 'rechazado' => {
  const estado = String(r?.estado || '').trim().toLowerCase();
  if (!estado || estado === 'pendiente') return 'pendiente';
  if (estado === 'rechazado') return 'rechazado';
  if (estado === 'aprobado' || estado === 'completado') return 'aprobado';
  return 'pendiente';
};

/** Adjunto en documentos de la app (mismo patrón que acta de entrega). */
type AttachedDocument = {
  localFileName: string;
  extension: string;
  original_name: string;
  mimeType?: string;
  type: 'document';
};

const decodeFirmaHash = (hash?: string | null) => {
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

const getBase64Only = (signature: string | null | undefined): string => {
  if (!signature) return '';
  const s = String(signature);
  if (s.startsWith('data:')) {
    const parts = s.split(',');
    return parts.length >= 2 ? parts.slice(1).join(',') : '';
  }
  return s;
};

/** URI para mostrar firma guardada (base64 crudo o data URL). */
const signatureDataUri = (raw?: string | null): string | null => {
  if (!raw || !String(raw).trim()) return null;
  const s = String(raw).trim();
  if (s.startsWith('data:image/')) return s;
  return `data:image/png;base64,${s}`;
};

const signatureWebStyle = `
body, html { margin: 0; padding: 0; height: 100%; width: 100%; }
.m-signature-pad { position: absolute; top: 0; left: 0; right: 0; bottom: 0; margin: 0; padding: 0; box-shadow: none; border: none; background-color: #FFFFFF; }
.m-signature-pad--body { position: absolute; top: 0; left: 0; right: 0; bottom: 0; border: none; margin: 0; padding: 0; }
.m-signature-pad--body canvas { width: 100% !important; height: 100% !important; touch-action: none; }
.m-signature-pad--footer { display: none; }
`;

export default function MutuosAcuerdosScreen() {
  const navigation = useNavigation<Nav>();
  const { employee, refreshAccessToken, logout } = useAuth();
  const { scanQR, QRScannerComponent } = useQRScanner();

  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<MutuoAcuerdo[]>([]);

  const [isCreating, setIsCreating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  /** `${recordId}-ausente` | `${recordId}-reemplaza` mientras se envía la aceptación */
  const [acceptingMutuoKey, setAcceptingMutuoKey] = useState<string | null>(null);
  const [rejectingMutuoId, setRejectingMutuoId] = useState<number | null>(null);
  const [motivo, setMotivo] = useState('');
  const [firmaResponsable, setFirmaResponsable] = useState('');
  const [isGeneratingFirmaResponsable, setIsGeneratingFirmaResponsable] = useState(false);
  const [ausente, setAusente] = useState<EmployeeSectionState>(emptySection(new Date().getTime()));
  const [reemplaza, setReemplaza] = useState<EmployeeSectionState>(emptySection(new Date().getTime()));
  const [attachedDocument, setAttachedDocument] = useState<AttachedDocument | null>(null);

  const [isSigning, setIsSigning] = useState(false);
  const [signatureModalVisible, setSignatureModalVisible] = useState(false);
  const [signingRecordId, setSigningRecordId] = useState<number | null>(null);
  const [firmaEjecutivoDigital, setFirmaEjecutivoDigital] = useState('');
  const [firmaEjecutivoManual, setFirmaEjecutivoManual] = useState('');
  const [isGeneratingFirmaEjecutivoDigital, setIsGeneratingFirmaEjecutivoDigital] = useState(false);
  const [executiveDrawModalVisible, setExecutiveDrawModalVisible] = useState(false);
  const [isReadingSignature, setIsReadingSignature] = useState(false);
  const [signatureKey, setSignatureKey] = useState(0);
  const signatureRef = useRef<any>(null);

  const [participantSigModalVisible, setParticipantSigModalVisible] = useState(false);
  const [participantSigRecordId, setParticipantSigRecordId] = useState<number | null>(null);
  const [participantSigRole, setParticipantSigRole] = useState<'ausente' | 'reemplaza' | null>(null);
  const [participantIsReadingSig, setParticipantIsReadingSig] = useState(false);
  const [participantSignatureKey, setParticipantSignatureKey] = useState(0);
  const participantSignatureRef = useRef<any>(null);

  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  const [filterEstado, setFilterEstado] = useState<'all' | 'pendiente' | 'aprobado' | 'rechazado'>('all');
  const [filterNombreSolicitante, setFilterNombreSolicitante] = useState('');
  const [filterFechaAusente, setFilterFechaAusente] = useState<string | null>(null);
  const [filterFechaReemplaza, setFilterFechaReemplaza] = useState<string | null>(null);
  const [showFilterFechaAusentePicker, setShowFilterFechaAusentePicker] = useState(false);
  const [showFilterFechaReemplazaPicker, setShowFilterFechaReemplazaPicker] = useState(false);
  const [filterMotivo, setFilterMotivo] = useState('');

  const [isCambiosModalVisible, setIsCambiosModalVisible] = useState(false);
  const [cambiosTitle, setCambiosTitle] = useState('Cambios');
  const [cambiosItems, setCambiosItems] = useState<CambiosAppsModulesRow[]>([]);

  const [showPlanillasRevalidationModal, setShowPlanillasRevalidationModal] = useState(false);
  const planillasRevalidationModalShownRef = useRef(false);
  const pendingPlanillasActionRef = useRef<
    | { type: 'approve' }
    | { type: 'loadMarcas'; section: SectionKey; employeeId: number; fecha: Date }
    | null
  >(null);

  const getConnectionStatus = async (): Promise<boolean> => {
    const networkState = await Network.getNetworkStateAsync();

    return (
      networkState.isConnected === true &&
      networkState.isInternetReachable === true
    );
  };

  const closeCambiosModal = () => {
    setIsCambiosModalVisible(false);
    setCambiosItems([]);
  };

  const fetchCambios = useCallback(
    async (tabla: string, registroId: number) => {
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
        Alert.alert('Error', e?.message || 'No se pudieron cargar los cambios');
      }
    },
    [refreshAccessToken, logout],
  );

  const updateSection = (section: SectionKey, updater: (prev: EmployeeSectionState) => EmployeeSectionState) => {
    if (section === 'ausente') setAusente(updater);
    else setReemplaza(updater);
  };

  const fetchRecords = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const isConnected = await getConnectionStatus();
      if (!isConnected) {
        setError('Este módulo funciona exclusivamente con internet.');
        setRecords([]);
        return;
      }

      const res = await listMutuosAcuerdosMine({ refreshAccessToken, logout });
      if (!res.status) {
        setError(res.message || 'No se pudieron cargar los mutuos acuerdos');
        setRecords([]);
        return;
      }
      setRecords(Array.isArray(res.data) ? res.data : []);
    } catch (e: any) {
      setError(e?.message || 'Error al cargar mutuos acuerdos');
      setRecords([]);
    } finally {
      setIsLoading(false);
    }
  }, [refreshAccessToken, logout]);

  useFocusEffect(
    useCallback(() => {
      fetchRecords();
    }, [fetchRecords])
  );

  const resetMutuosFilters = useCallback(() => {
    setFilterEstado('all');
    setFilterNombreSolicitante('');
    setFilterFechaAusente(null);
    setFilterFechaReemplaza(null);
    setShowFilterFechaAusentePicker(false);
    setShowFilterFechaReemplazaPicker(false);
    setFilterMotivo('');
  }, []);

  const filteredRecords = useMemo(() => {
    const qNombre = String(filterNombreSolicitante || '').trim().toLowerCase();
    const qMotivo = String(filterMotivo || '').trim().toLowerCase();
    const fechaAusenteYmd = filterFechaAusente ? normalizeDateToYMD(filterFechaAusente) : '';
    const fechaReemplazaYmd = filterFechaReemplaza ? normalizeDateToYMD(filterFechaReemplaza) : '';

    return records.filter((r) => {
      if (r != null && (r as MutuoAcuerdo).isActive === false) return false;
      const estado = estadoBucketMutuo(r);
      const matchesEstado = filterEstado === 'all' || estado === filterEstado;

      const nombreAusente = String(r.empleado_ausente_nombre || '').trim().toLowerCase();
      const nombreReemplaza = String(r.empleado_reemplaza_nombre || '').trim().toLowerCase();
      const matchesNombre =
        !qNombre ||
        nombreAusente.includes(qNombre) ||
        nombreReemplaza.includes(qNombre) ||
        String(r.empleadoAusente_id || '').includes(qNombre) ||
        String(r.empleadoReemplaza_id || '').includes(qNombre);

      const matchesMotivo = !qMotivo || String(r.motivo || '').toLowerCase().includes(qMotivo);

      const recordFechaAusente = normalizeDateToYMD(String(r.marca_ausente?.fecha || ''));
      const recordFechaReemplaza = normalizeDateToYMD(String(r.marca_reemplaza?.fecha || ''));
      const matchesFechaAusente = !fechaAusenteYmd || recordFechaAusente === fechaAusenteYmd;
      const matchesFechaReemplaza = !fechaReemplazaYmd || recordFechaReemplaza === fechaReemplazaYmd;

      return matchesEstado && matchesNombre && matchesMotivo && matchesFechaAusente && matchesFechaReemplaza;
    });
  }, [records, filterEstado, filterNombreSolicitante, filterFechaAusente, filterFechaReemplaza, filterMotivo]);

  const getEmpleadoById = async (id: number) => {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');
    const response = await authedFetch({
      url: `${apiUrl}/api/empleados/${id}`,
      init: {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      },
      refreshAccessToken,
      logout,
    });
    if (!response) throw new Error('Sesión expirada');
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData?.message || 'No se pudo obtener el empleado por ID');
    }
    return await response.json();
  };

  const getEmpleadoByCodigo = async (codigo: string) => {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');
    const response = await authedFetch({
      url: `${apiUrl}/api/empleados/codigo/${encodeURIComponent(String(codigo).trim())}`,
      init: {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      },
      refreshAccessToken,
      logout,
    });
    if (!response) throw new Error('Sesión expirada');
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData?.message || 'No se pudo obtener el empleado por código');
    }
    const data = await response.json();
    if (!data?.status || !data?.data) throw new Error(data?.message || 'Empleado no encontrado');
    return data.data;
  };

  const loadMarcas = async (section: SectionKey, employeeId: number, fecha: Date) => {
    updateSection(section, (prev) => ({ ...prev, loadingMarcas: true, message: '', marcas: [], selectedMarcaId: null }));
    try {
      const referenceMs = (await getHoraAccion()) || Date.now();
      const hasValidPlanillasToken = await requestPlanillasRevalidationIfNeeded(referenceMs);
      if (!hasValidPlanillasToken) {
        pendingPlanillasActionRef.current = { type: 'loadMarcas', section, employeeId, fecha };
        updateSection(section, (prev) => ({
          ...prev,
          loadingMarcas: false,
          marcas: [],
          selectedMarcaId: null,
          message: 'Se requiere revalidar el token de Planillas para consultar turnos.',
        }));
        return;
      }
      const planillasTokenCheck = await isStoredPlanillasTokenValid(referenceMs);
      const planillasToken = planillasTokenCheck.token;

      const res = await listMarcasParaMutuo({
        empleado_id: employeeId,
        fecha: dateToYmd(fecha),
        planillasToken,
        refreshAccessToken,
        logout,
      });
      if (!res.status) {
        throw new Error(res.message || 'No se pudieron obtener las marcas');
      }
      updateSection(section, (prev) => ({
        ...prev,
        loadingMarcas: false,
        marcas: Array.isArray(res.data) ? res.data : [],
        selectedMarcaId: Array.isArray(res.data) && res.data.length > 0 ? res.data[0].id : null,
        message: Array.isArray(res.data) && res.data.length === 0 ? (res.message || 'El empleado está libre ese día') : '',
      }));
    } catch (e: any) {
      updateSection(section, (prev) => ({
        ...prev,
        loadingMarcas: false,
        marcas: [],
        selectedMarcaId: null,
        message: e?.message || 'No se pudieron obtener las marcas',
      }));
    }
  };

  const applyEmployeeToSection = async (section: SectionKey, empleadoData: any) => {
    const employeeId = Number(empleadoData?.id || 0);
    const nombre = [
      String(empleadoData?.nombre || '').trim(),
      String(empleadoData?.primer_apellido || '').trim(),
      String(empleadoData?.segundo_apellido || '').trim(),
    ]
      .filter(Boolean)
      .join(' ')
      .trim() || String(empleadoData?.nombre_completo || '').trim();
    const cedula = String(empleadoData?.cedula || '').trim();
    if (!employeeId || !nombre) throw new Error('Empleado inválido');

    console.log("empleadoData", empleadoData);

    updateSection(section, (prev) => ({
      ...prev,
      employeeId,
      employeeNombre: empleadoData?.nombre_completo || nombre,
      employeeCedula: cedula,
    }));
    const sectionState = section === 'ausente' ? ausente : reemplaza;
    await loadMarcas(section, employeeId, sectionState.fecha);
  };

  const handleSearchByCode = async (section: SectionKey) => {
    const sectionState = section === 'ausente' ? ausente : reemplaza;
    const code = String(sectionState.codigo || '').trim();
    if (!code) {
      Alert.alert('Error', 'Debes ingresar un código');
      return;
    }
    try {
      const empleado = await getEmpleadoByCodigo(code);
      await applyEmployeeToSection(section, empleado);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo buscar el empleado por código');
    }
  };

  const handleScanEmployeeQR = async (section: SectionKey) => {
    try {
      const qrData = await scanQR();
      if (!qrData) return;
      const decoded = decodeFirmaHash(qrData);
      if (!decoded?.empleadoId) {
        Alert.alert('Error', 'El QR no contiene un ID de empleado válido');
        return;
      }
      const empleado = await getEmpleadoById(Number(decoded.empleadoId));
      await applyEmployeeToSection(section, empleado);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo leer el QR');
    }
  };

  const handleSectionDateChange = async (section: SectionKey, date: Date) => {
    updateSection(section, (prev) => ({ ...prev, fecha: date, showDatePicker: false }));
    const sectionState = section === 'ausente' ? ausente : reemplaza;
    if (sectionState.employeeId) {
      await loadMarcas(section, sectionState.employeeId, date);
    }
  };

  const handleGenerateFirmaResponsable = async () => {
    if (isGeneratingFirmaResponsable) return;
    setIsGeneratingFirmaResponsable(true);
    try {
      if (!employee) {
        Alert.alert('Error', 'No se pudo obtener la información del empleado');
        return;
      }
      const hash = await getCurrentUserDigitalSignature(employee);
      if (!hash) return;
      setFirmaResponsable(hash);
    } finally {
      setIsGeneratingFirmaResponsable(false);
    }
  };

  const resetForm = async () => {
    const horaAccion = await getHoraAccion();
    if (!horaAccion) {
      Alert.alert('Error', 'No se pudo obtener la hora');
      return;
    }
    setMotivo('');
    setFirmaResponsable('');
    setAusente(emptySection(horaAccion));
    setReemplaza(emptySection(horaAccion));
    if (attachedDocument?.localFileName) {
      try {
        await deleteFile(attachedDocument.localFileName);
      } catch {
        /* idempotente */
      }
    }
    setAttachedDocument(null);
  };

  const startCreate = async () => {
    await resetForm();
    setIsCreating(true);
  };

  const runSaveConfirmed = async () => {
    if (!motivo.trim()) {
      Alert.alert('Error', 'El motivo es obligatorio');
      return;
    }
    if (!firmaResponsable.trim()) {
      Alert.alert('Error', 'La firma responsable es obligatoria');
      return;
    }
    if (!ausente.selectedMarcaId || !reemplaza.selectedMarcaId) {
      Alert.alert('Error', 'Debes seleccionar una marca para ausente y una para reemplaza');
      return;
    }

    const marcaAusenteSel = ausente.marcas.find((m) => m.id === ausente.selectedMarcaId);
    const eid = marcaAusenteSel?.empresa_id != null ? Number(marcaAusenteSel.empresa_id) : 0;
    const did = marcaAusenteSel?.division_id != null ? Number(marcaAusenteSel.division_id) : 0;
    const cid = marcaAusenteSel?.contrato_id != null ? Number(marcaAusenteSel.contrato_id) : 0;
    const pid = marcaAusenteSel?.puesto_id != null ? Number(marcaAusenteSel.puesto_id) : 0;
    if (!eid || !did || !cid || !pid) {
      Alert.alert(
        'Error',
        'La marca del primer turno no incluye jerarquía completa (empresa, división, contrato, puesto). Vuelva a cargar las marcas.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const horaAccion = await getHoraAccion();
      if (!horaAccion) {
        Alert.alert('Error', 'No se pudo obtener la hora de la acción');
        return;
      }

      let filePayload: Record<string, string> = {};
      if (attachedDocument?.localFileName) {
        try {
          const g = await getFile(attachedDocument.localFileName);
          filePayload = {
            file_base64: g.base64,
            extension: attachedDocument.extension,
            original_name: attachedDocument.original_name,
            mimeType: attachedDocument.mimeType || '',
            type: attachedDocument.type,
          };
        } catch (e: any) {
          Alert.alert('Error', e?.message || 'No se pudo leer el archivo adjunto');
          return;
        }
      }

      const response = await createMutuoAcuerdo({
        requestData: {
          marcaDiaAusente_id: ausente.selectedMarcaId,
          marcaDiaReemplaza_id: reemplaza.selectedMarcaId,
          motivo: motivo.trim(),
          hora_accion: horaAccion,
          firma_responsable: firmaResponsable.trim(),
          empresa_id: eid,
          division_id: did,
          contrato_id: cid,
          puesto_id: pid,
          ...(Object.keys(filePayload).length > 0 ? filePayload : {}),
        },
        refreshAccessToken,
        logout,
      });
      if (!response.status) {
        Alert.alert('Error', response.message || 'No se pudo crear el registro');
        return;
      }
      Alert.alert('Éxito', response.message || 'Mutuo acuerdo creado');
      setIsCreating(false);
      await resetForm();
      await fetchRecords();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo guardar');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSave = () => {
    if (isSubmitting) return;
    if (!motivo.trim()) {
      Alert.alert('Error', 'El motivo es obligatorio');
      return;
    }
    if (!firmaResponsable.trim()) {
      Alert.alert('Error', 'La firma responsable es obligatoria');
      return;
    }
    if (!ausente.selectedMarcaId || !reemplaza.selectedMarcaId) {
      Alert.alert('Error', 'Debes seleccionar una marca para ausente y una para reemplaza');
      return;
    }

    Alert.alert('Confirmar', '¿Desea registrar este mutuo acuerdo?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Aceptar', onPress: () => void runSaveConfirmed() },
    ]);
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/plain',
          'text/csv',
        ],
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      const extension =
        String(asset.name || '')
          .split('.')
          .pop()
          ?.toLowerCase()
          ?.trim() || 'dat';

      if (attachedDocument?.localFileName) {
        try {
          await deleteFile(attachedDocument.localFileName);
        } catch {
          /* idempotente */
        }
      }

      const localFileName = await saveFile({
        uri: asset.uri,
        originalName: asset.name || 'adjunto',
        extension,
        type: 'text',
        prefix: 'mutuo_acuerdo',
      });

      setAttachedDocument({
        localFileName,
        extension,
        original_name: asset.name || `archivo.${extension}`,
        mimeType: asset.mimeType || undefined,
        type: 'document',
      });
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo seleccionar el archivo');
    }
  };

  const runAcceptMutuo = async (recordId: number, role: 'ausente' | 'reemplaza', manualB64: string): Promise<boolean> => {
    const key = `${recordId}-${role}`;
    setAcceptingMutuoKey(key);
    try {
      const response = await acceptMutuoAcuerdo({
        id: recordId,
        role,
        firma_ausente_manual: role === 'ausente' ? manualB64 : undefined,
        firma_reemplaza_manual: role === 'reemplaza' ? manualB64 : undefined,
        refreshAccessToken,
        logout,
      });
      if (!response.status) {
        Alert.alert('Error', response.message || 'No se pudo registrar la aceptación');
        return false;
      }
      Alert.alert('Éxito', response.message || 'Aceptación registrada');
      await fetchRecords();
      return true;
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo registrar la aceptación');
      return false;
    } finally {
      setAcceptingMutuoKey(null);
    }
  };

  const openParticipantAcceptModal = (recordId: number, role: 'ausente' | 'reemplaza') => {
    if (acceptingMutuoKey || signatureModalVisible || participantSigModalVisible) return;
    setParticipantSigRecordId(recordId);
    setParticipantSigRole(role);
    setParticipantSignatureKey((k) => k + 1);
    setParticipantSigModalVisible(true);
  };

  const closeParticipantAcceptModal = () => {
    setParticipantSigModalVisible(false);
    setParticipantSigRecordId(null);
    setParticipantSigRole(null);
    setParticipantIsReadingSig(false);
    setParticipantSignatureKey((k) => k + 1);
  };

  const submitParticipantAcceptReadCanvas = () => {
    if (!participantSigRecordId || !participantSigRole) return;
    try {
      setParticipantIsReadingSig(true);
      participantSignatureRef.current?.readSignature?.();
    } catch {
      setParticipantIsReadingSig(false);
      Alert.alert('Error', 'No se pudo leer la firma manual');
    }
  };

  const submitParticipantAccept = () => {
    if (participantIsReadingSig || acceptingMutuoKey) return;
    const label = participantSigRole === 'ausente' ? 'primer turno' : 'segundo turno';
    Alert.alert('Confirmar', `¿Registrar la aceptación como usuario del ${label} con la firma dibujada?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Aceptar', onPress: () => void submitParticipantAcceptReadCanvas() },
    ]);
  };

  const onParticipantSignatureRead = async (signature: string) => {
    try {
      if (!participantSigRecordId || !participantSigRole) {
        Alert.alert('Error', 'Sesión de firma inválida');
        return;
      }
      const formatted = String(signature || '').startsWith('data:')
        ? String(signature)
        : `data:image/png;base64,${String(signature || '')}`;
      const b64 = getBase64Only(formatted);
      if (!b64 || b64.length < 80) {
        Alert.alert('Error', 'La firma manual está vacía o es demasiado corta');
        return;
      }
      const ok = await runAcceptMutuo(participantSigRecordId, participantSigRole, b64);
      if (ok) closeParticipantAcceptModal();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo registrar la aceptación');
    } finally {
      setParticipantIsReadingSig(false);
    }
  };

  const runRejectByExecutive = async (recordId: number) => {
    setRejectingMutuoId(recordId);
    try {
      const horaAccion = await getHoraAccion();
      if (!horaAccion) {
        Alert.alert('Error', 'No se pudo obtener la hora de la acción');
        return;
      }
      const response = await rejectMutuoAcuerdoEjecutivo({
        id: recordId,
        hora_accion: new Date(horaAccion).toISOString(),
        refreshAccessToken,
        logout,
      });
      if (!response.status) {
        Alert.alert('Error', response.message || 'No se pudo rechazar el mutuo acuerdo');
        return;
      }
      Alert.alert('Éxito', response.message || 'Mutuo acuerdo rechazado');
      await fetchRecords();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo rechazar el mutuo acuerdo');
    } finally {
      setRejectingMutuoId(null);
    }
  };

  const openSignatureModal = (recordId: number) => {
    if (participantSigModalVisible) return;
    setSigningRecordId(recordId);
    setFirmaEjecutivoDigital('');
    setFirmaEjecutivoManual('');
    setExecutiveDrawModalVisible(false);
    setSignatureKey((k) => k + 1);
    setSignatureModalVisible(true);
  };

  const closeSignatureModal = () => {
    setSignatureModalVisible(false);
    setExecutiveDrawModalVisible(false);
    setSigningRecordId(null);
    setFirmaEjecutivoDigital('');
    setFirmaEjecutivoManual('');
    setIsReadingSignature(false);
  };

  const openExecutiveDrawModal = () => {
    setSignatureKey((k) => k + 1);
    setIsReadingSignature(false);
    setExecutiveDrawModalVisible(true);
  };

  const closeExecutiveDrawModal = () => {
    setExecutiveDrawModalVisible(false);
    setIsReadingSignature(false);
  };

  const clearExecutiveDrawModal = () => {
    signatureRef.current?.clearSignature?.();
    setSignatureKey((k) => k + 1);
    setIsReadingSignature(false);
  };

  const handleGenerateFirmaEjecutivoDigital = async () => {
    if (isGeneratingFirmaEjecutivoDigital) return;
    setIsGeneratingFirmaEjecutivoDigital(true);
    try {
      if (!employee) {
        Alert.alert('Error', 'No se pudo obtener la información del empleado');
        return;
      }
      const hash = await getCurrentUserDigitalSignature(employee);
      if (!hash) return;
      setFirmaEjecutivoDigital(hash);
    } finally {
      setIsGeneratingFirmaEjecutivoDigital(false);
    }
  };

  const onExecutiveManualSignatureCaptured = (signature: string) => {
    const formatted = String(signature || '').includes('base64,')
      ? String(signature).split('base64,')[1]
      : String(signature || '');
    if (!formatted || formatted.length < 20) {
      setIsReadingSignature(false);
      Alert.alert('Error', 'La firma manual está vacía');
      return;
    }
    setFirmaEjecutivoManual(formatted);
    setIsReadingSignature(false);
    closeExecutiveDrawModal();
  };

  const runAcceptExecutiveDraw = () => {
    try {
      setIsReadingSignature(true);
      signatureRef.current?.readSignature?.();
    } catch {
      setIsReadingSignature(false);
      Alert.alert('Error', 'No se pudo leer la firma manual');
    }
  };

  const requestConfirmExecutiveDraw = () => {
    Alert.alert('Confirmar firma', '¿Deseas guardar esta firma manual?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Aceptar', onPress: () => runAcceptExecutiveDraw() },
    ]);
  };

  const submitSignature = () => {
    if (isSigning || isReadingSignature) return;
    if (!firmaEjecutivoDigital) {
      Alert.alert('Error', 'Primero debes generar la firma digital');
      return;
    }
    if (!firmaEjecutivoManual) {
      Alert.alert('Error', 'Debes dibujar la firma manual del ejecutivo');
      return;
    }
    Alert.alert('Confirmar', '¿Desea aprobar este mutuo acuerdo con las firmas indicadas?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Aceptar', onPress: () => void finalizeExecutiveApproval() },
    ]);
  };

  const requestPlanillasRevalidationIfNeeded = async (horaAccionMs: number): Promise<boolean> => {
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
  };

  const finalizeExecutiveApproval = async () => {
    try {
      if (!signingRecordId) {
        Alert.alert('Error', 'No hay registro seleccionado para firmar');
        return;
      }
      const manualFormatted = firmaEjecutivoManual.startsWith('data:')
        ? firmaEjecutivoManual
        : `data:image/png;base64,${firmaEjecutivoManual}`;
      if (!getBase64Only(manualFormatted)) {
        Alert.alert('Error', 'La firma manual está vacía');
        return;
      }
      const horaAccion = await getHoraAccion();
      if (!horaAccion) {
        Alert.alert('Error', 'No se pudo obtener la hora de la acción');
        return;
      }

      const referenceMs = Number(horaAccion) || Date.now();
      const hasValidPlanillasToken = await requestPlanillasRevalidationIfNeeded(referenceMs);
      if (!hasValidPlanillasToken) {
        pendingPlanillasActionRef.current = { type: 'approve' };
        return;
      }

      const planillasTokenCheck = await isStoredPlanillasTokenValid(referenceMs);
      const planillasToken = planillasTokenCheck.token;

      setIsSigning(true);
      const response = await signMutuoAcuerdoEjecutivo({
        id: signingRecordId,
        firma_ejecutivo_cuenta_manual: manualFormatted,
        firma_ejecutivo_cuenta_digital: firmaEjecutivoDigital,
        hora_accion: new Date(horaAccion).toISOString(),
        planillasToken,
        refreshAccessToken,
        logout,
      });
      if (!response.status) {
        Alert.alert('Error', response.message || 'No se pudieron guardar las firmas');
        return;
      }
      Alert.alert('Éxito', response.message || 'Firmas guardadas');
      closeSignatureModal();
      await fetchRecords();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudieron guardar las firmas');
    } finally {
      setIsSigning(false);
    }
  };

  const handlePlanillasRevalidationSuccess = () => {
    setShowPlanillasRevalidationModal(false);
    planillasRevalidationModalShownRef.current = false;
    const pending = pendingPlanillasActionRef.current;
    pendingPlanillasActionRef.current = null;
    if (pending?.type === 'approve') {
      void finalizeExecutiveApproval();
    } else if (pending?.type === 'loadMarcas') {
      void loadMarcas(pending.section, pending.employeeId, pending.fecha);
    }
  };

  const handlePlanillasRevalidationDismiss = () => {
    planillasRevalidationModalShownRef.current = false;
    pendingPlanillasActionRef.current = null;
    setShowPlanillasRevalidationModal(false);
  };

  const renderMarcaList = (section: SectionKey, sectionState: EmployeeSectionState) => {
    if (!sectionState.employeeId) return null;
    if (sectionState.loadingMarcas) {
      return (
        <View style={styles.inlineLoading}>
          <ActivityIndicator size="small" color="#007AFF" />
          <ThemedText style={styles.inlineLoadingText}>Buscando marcas...</ThemedText>
        </View>
      );
    }
    if (sectionState.marcas.length === 0) {
      return <ThemedText style={styles.freeDayText}>{sectionState.message || 'El empleado está libre ese día'}</ThemedText>;
    }
    return (
      <View style={styles.marcaList}>
        {sectionState.marcas.map((m) => {
          const selected = sectionState.selectedMarcaId === m.id;
          return (
            <TouchableOpacity
              key={`${section}-${m.id}`}
              style={[styles.marcaItem, selected && styles.marcaItemSelected]}
              onPress={() => updateSection(section, (prev) => ({ ...prev, selectedMarcaId: m.id }))}
              activeOpacity={0.85}
            >
              <ThemedText style={styles.marcaItemTitle}>
                {m.cliente || '—'} | {m.sucursal || '—'}
              </ThemedText>
              <ThemedText style={styles.marcaItemText}>Puesto: {m.puesto || '—'}</ThemedText>
              <ThemedText style={styles.marcaItemText}>
                Horario: {formatTime(m.hora_inicio)} - {formatTime(m.hora_fin)}
              </ThemedText>
              <ThemedText style={styles.marcaItemText}>Turno: {m.tipo_turno_texto}</ThemedText>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderEmployeeSection = (section: SectionKey, title: string, sectionState: EmployeeSectionState) => {
    return (
      <ThemedView style={styles.sectionCard}>
        <ThemedText style={styles.sectionTitle}>{title}</ThemedText>

        <ThemedText style={styles.label}>Fecha *</ThemedText>
        <TouchableOpacity
          style={styles.dateButton}
          onPress={() => updateSection(section, (prev) => ({ ...prev, showDatePicker: true }))}
          activeOpacity={0.85}
        >
          <ThemedText style={styles.dateButtonText}>{formatDateDMY(sectionState.fecha)}</ThemedText>
          <Ionicons name="calendar-outline" size={18} color="#007AFF" />
        </TouchableOpacity>
        {sectionState.showDatePicker && (
          <DateTimePicker
            value={sectionState.fecha}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_, d) => {
              if (!d) {
                updateSection(section, (prev) => ({ ...prev, showDatePicker: false }));
                return;
              }
              handleSectionDateChange(section, d);
            }}
          />
        )}

        <ThemedText style={styles.label}>Buscar empleado por código</ThemedText>
        <View style={styles.codeRow}>
          <TextInput
            style={styles.codeInput}
            value={sectionState.codigo}
            onChangeText={(t) => updateSection(section, (prev) => ({ ...prev, codigo: t }))}
            placeholder="Código del empleado"
            placeholderTextColor="#999"
          />
          <TouchableOpacity style={styles.codeActionButton} onPress={() => handleSearchByCode(section)} activeOpacity={0.85}>
            <ThemedText style={styles.codeActionButtonText}>Buscar</ThemedText>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.qrButton} onPress={() => handleScanEmployeeQR(section)} activeOpacity={0.85}>
          <Ionicons name="qr-code-outline" size={18} color="#007AFF" />
          <ThemedText style={styles.qrButtonText}>Escanear QR de firma digital</ThemedText>
        </TouchableOpacity>

        {sectionState.employeeId ? (
          <ThemedView style={styles.employeeInfoBox}>
            <ThemedText style={styles.employeeInfoText}>ID: {sectionState.employeeId}</ThemedText>
            <ThemedText style={styles.employeeInfoText}>Nombre: {sectionState.employeeNombre || '—'}</ThemedText>
            <ThemedText style={styles.employeeInfoText}>Cédula: {sectionState.employeeCedula || '—'}</ThemedText>
          </ThemedView>
        ) : null}

        <ThemedText style={styles.label}>Marcas del día *</ThemedText>
        {renderMarcaList(section, sectionState)}
      </ThemedView>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <AppHeader title="Mutuos acuerdos" onMenuPress={() => setIsMenuVisible(true)} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <ThemedView style={styles.content}>
          {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}

          <ThemedView style={styles.titleContainer}>
            <ThemedText type="title" style={styles.title}>
              <Ionicons name="document-text" size={22} color="#000000" /> Mutuos acuerdos
            </ThemedText>
            <ThemedText style={styles.subtitle}>Módulo exclusivamente online</ThemedText>
          </ThemedView>

          {isCreating && (
            <ThemedView style={styles.formCard}>
              <ThemedText style={styles.formTitle}>Nuevo registro</ThemedText>

              {renderEmployeeSection('ausente', 'Primer turno', ausente)}
              {renderEmployeeSection('reemplaza', 'Segundo turno', reemplaza)}

              <ThemedText style={styles.label}>Motivo *</ThemedText>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={motivo}
                onChangeText={setMotivo}
                placeholder="Motivo"
                placeholderTextColor="#999"
                multiline
              />

              <ThemedText style={styles.label}>Adjunto (opcional)</ThemedText>
              <TouchableOpacity style={styles.pickFileBtn} onPress={handlePickDocument} activeOpacity={0.85}>
                <Ionicons name="attach-outline" size={18} color="#007AFF" />
                <ThemedText style={styles.pickFileBtnText}>
                  {attachedDocument ? 'Cambiar archivo adjunto' : 'Adjuntar archivo'}
                </ThemedText>
              </TouchableOpacity>
              {attachedDocument ? (
                <ThemedView style={styles.fileSelectedBox}>
                  <ThemedText style={styles.fileSelectedText} numberOfLines={2}>
                    {attachedDocument.original_name}
                  </ThemedText>
                  <TouchableOpacity
                    onPress={async () => {
                      if (attachedDocument?.localFileName) {
                        try {
                          await deleteFile(attachedDocument.localFileName);
                        } catch {
                          /* idempotente */
                        }
                      }
                      setAttachedDocument(null);
                    }}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="close-circle" size={20} color="#CC3333" />
                  </TouchableOpacity>
                </ThemedView>
              ) : null}

              <ThemedText style={styles.label}>Firma responsable *</ThemedText>
              <TouchableOpacity
                style={[styles.signatureBlueButton, isGeneratingFirmaResponsable && styles.buttonDisabled]}
                onPress={handleGenerateFirmaResponsable}
                disabled={isGeneratingFirmaResponsable}
                activeOpacity={0.85}
              >
                {isGeneratingFirmaResponsable ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="finger-print" size={18} color="#FFFFFF" />
                )}
                <ThemedText style={styles.signatureBlueButtonText}>
                  {isGeneratingFirmaResponsable ? 'Generando...' : 'Generar firma digital'}
                </ThemedText>
              </TouchableOpacity>
              {!firmaResponsable ? (
                <ThemedText style={styles.signatureHintMuted}>Aún no hay firma responsable.</ThemedText>
              ) : (
                <ThemedView style={styles.firmaInfoBox}>
                  <ThemedView style={{ flex: 1, paddingRight: 10 }}>
                    <ThemedText style={styles.firmaInfoTitle}>Información de la firma:</ThemedText>
                    {(() => {
                      const info = decodeFirmaHash(firmaResponsable);
                      if (!info) {
                        return <ThemedText style={styles.firmaInfoValue}>Formato no decodificable</ThemedText>;
                      }
                      return (
                        <>
                          <ThemedText style={styles.firmaInfoValue}>Sesión: {info.sessionId || 'N/A'}</ThemedText>
                          <ThemedText style={styles.firmaInfoValue}>Empleado: {info.empleadoId || 'N/A'}</ThemedText>
                          <ThemedText style={styles.firmaInfoValue}>Lat: {info.latitud || 'N/A'} | Long: {info.longitud || 'N/A'}</ThemedText>
                          <ThemedText style={styles.firmaInfoValue}>
                            Hora: {convertDateTimestampToLocalString(new Date(Number(info.timestamp)).toISOString()) || 'N/A'}
                          </ThemedText>
                        </>
                      );
                    })()}
                  </ThemedView>
                  <TouchableOpacity style={styles.firmaClearButtonTiny} onPress={() => setFirmaResponsable('')} activeOpacity={0.85}>
                    <Ionicons name="trash" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </ThemedView>
              )}

              <ThemedView style={styles.formActions}>
                <TouchableOpacity
                  style={[styles.formActionBtn, styles.cancelBtn]}
                  onPress={() => {
                    setIsCreating(false);
                    resetForm();
                  }}
                  activeOpacity={0.85}
                  disabled={isSubmitting}
                >
                  <Ionicons name="close" size={18} color="#000" />
                  <ThemedText style={styles.cancelBtnText}>Cancelar</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.formActionBtn, styles.saveBtn, isSubmitting && styles.buttonDisabled]}
                  onPress={handleSave}
                  activeOpacity={0.85}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={18} color="#fff" />
                      <ThemedText style={styles.saveBtnText}>Aceptar</ThemedText>
                    </>
                  )}
                </TouchableOpacity>
              </ThemedView>
            </ThemedView>
          )}

          {!isCreating && (
            <>
              <ThemedView style={styles.filtersContainer}>
                <ThemedView style={styles.filtersHeader}>
                  <TouchableOpacity
                    style={styles.filterToggleButton}
                    onPress={() => setIsFiltersExpanded(!isFiltersExpanded)}
                    activeOpacity={0.85}
                  >
                    <ThemedText style={styles.filtersTitle}>Filtros</ThemedText>
                    <Ionicons
                      name={isFiltersExpanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color="#007AFF"
                    />
                  </TouchableOpacity>

                  {isFiltersExpanded ? (
                    <TouchableOpacity
                      style={styles.resetFiltersButton}
                      onPress={resetMutuosFilters}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="refresh" size={16} color="#FF3B30" />
                      <ThemedText style={styles.resetFiltersText}>Reiniciar</ThemedText>
                    </TouchableOpacity>
                  ) : null}
                </ThemedView>
                {isFiltersExpanded ? (
                  <ThemedView style={styles.filtersContent}>
                    <ThemedView style={styles.filterGroupSearch}>
                      <ThemedText style={styles.filterLabel}>Estado:</ThemedText>
                      <View style={styles.pickerWrapper}>
                        <Picker selectedValue={filterEstado} onValueChange={(v) => setFilterEstado(v)} style={styles.picker}>
                          <Picker.Item label="Todos" value="all" color="#000000" />
                          <Picker.Item label="Pendiente" value="pendiente" color="#000000" />
                          <Picker.Item label="Aprobado" value="aprobado" color="#000000" />
                          <Picker.Item label="Rechazado" value="rechazado" color="#000000" />
                        </Picker>
                      </View>
                    </ThemedView>

                    <ThemedView style={styles.filterGroupSearch}>
                      <ThemedText style={styles.filterLabel}>Nombre del solicitante (Primer o Segundo turno):</ThemedText>
                      <TextInput
                        style={styles.input}
                        value={filterNombreSolicitante}
                        onChangeText={setFilterNombreSolicitante}
                        placeholder="Buscar por nombre o ID..."
                        placeholderTextColor="#999"
                      />
                    </ThemedView>

                    <ThemedView style={styles.filterGroupSearch}>
                      <ThemedText style={styles.filterLabel}>Fecha primer turno:</ThemedText>
                      <TouchableOpacity
                        style={styles.dateButton}
                        onPress={() => setShowFilterFechaAusentePicker(true)}
                        activeOpacity={0.85}
                      >
                        <ThemedText style={styles.dateButtonText}>
                          {filterFechaAusente ? formatDateFromIsoToDMY(filterFechaAusente) : 'Seleccionar fecha'}
                        </ThemedText>
                        <Ionicons name="calendar-outline" size={18} color="#007AFF" />
                      </TouchableOpacity>
                      {filterFechaAusente ? (
                        <TouchableOpacity onPress={() => setFilterFechaAusente(null)} activeOpacity={0.85}>
                          <ThemedText style={styles.filterClearText}>Quitar filtro de fecha ausente</ThemedText>
                        </TouchableOpacity>
                      ) : null}
                      {showFilterFechaAusentePicker ? (
                        <DateTimePicker
                          value={filterFechaAusente ? localDateFromYmd(filterFechaAusente) : new Date()}
                          mode="date"
                          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                          onChange={(event: { type?: string }, d?: Date) => {
                            if (Platform.OS === 'android') {
                              setShowFilterFechaAusentePicker(false);
                              if (event?.type === 'dismissed') return;
                            } else {
                              setShowFilterFechaAusentePicker(false);
                            }
                            if (d) setFilterFechaAusente(dateToYmd(d));
                          }}
                        />
                      ) : null}
                    </ThemedView>

                    <ThemedView style={styles.filterGroupSearch}>
                      <ThemedText style={styles.filterLabel}>Fecha del segundo turno:</ThemedText>
                      <TouchableOpacity
                        style={styles.dateButton}
                        onPress={() => setShowFilterFechaReemplazaPicker(true)}
                        activeOpacity={0.85}
                      >
                        <ThemedText style={styles.dateButtonText}>
                          {filterFechaReemplaza ? formatDateFromIsoToDMY(filterFechaReemplaza) : 'Seleccionar fecha'}
                        </ThemedText>
                        <Ionicons name="calendar-outline" size={18} color="#007AFF" />
                      </TouchableOpacity>
                      {filterFechaReemplaza ? (
                        <TouchableOpacity onPress={() => setFilterFechaReemplaza(null)} activeOpacity={0.85}>
                          <ThemedText style={styles.filterClearText}>Quitar filtro de fecha del segundo turno</ThemedText>
                        </TouchableOpacity>
                      ) : null}
                      {showFilterFechaReemplazaPicker ? (
                        <DateTimePicker
                          value={filterFechaReemplaza ? localDateFromYmd(filterFechaReemplaza) : new Date()}
                          mode="date"
                          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                          onChange={(event: { type?: string }, d?: Date) => {
                            if (Platform.OS === 'android') {
                              setShowFilterFechaReemplazaPicker(false);
                              if (event?.type === 'dismissed') return;
                            } else {
                              setShowFilterFechaReemplazaPicker(false);
                            }
                            if (d) setFilterFechaReemplaza(dateToYmd(d));
                          }}
                        />
                      ) : null}
                    </ThemedView>

                    <ThemedView style={styles.filterGroupSearch}>
                      <ThemedText style={styles.filterLabel}>Motivo:</ThemedText>
                      <TextInput
                        style={styles.input}
                        value={filterMotivo}
                        onChangeText={setFilterMotivo}
                        placeholder="Filtrar por motivo..."
                        placeholderTextColor="#999"
                      />
                    </ThemedView>
                  </ThemedView>
                ) : null}
              </ThemedView>

              {!isLoading && (
                <TouchableOpacity style={styles.createButton} onPress={startCreate} activeOpacity={0.85}>
                  <ThemedText style={styles.createButtonText}>
                    <Ionicons name="add" size={20} color="#FFFFFF" /> Nuevo registro
                  </ThemedText>
                </TouchableOpacity>
              )}

              {isLoading ? (
                <ThemedView style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#007AFF" />
                  <ThemedText style={styles.loadingText}>Cargando...</ThemedText>
                </ThemedView>
              ) : records.length === 0 ? (
                <ThemedView style={styles.emptyContainer}>
                  <ThemedText style={styles.emptyText}>No hay registros</ThemedText>
                </ThemedView>
              ) : filteredRecords.length === 0 ? (
                <ThemedView style={styles.emptyContainer}>
                  <ThemedText style={styles.emptyText}>No hay resultados para los filtros seleccionados</ThemedText>
                </ThemedView>
              ) : (
                <ThemedView style={styles.listContainer}>
                  {filteredRecords.map((r) => (
                    <ThemedView key={`mutuo-${r.id}`} style={styles.card}>
                      <ThemedText style={styles.cardTitle}>{r.cliente_nombre || '-'} | {r.corpo_nombre || '-'}</ThemedText>
                      <ThemedText style={styles.cardLine}><ThemedText style={styles.cardLabel}>Ejecutivo: </ThemedText>{r.ejecutivo_nombre || r.ejecutivo_cuenta}</ThemedText>
                      <ThemedText style={styles.cardLine}><ThemedText style={styles.cardLabel}>Estado: </ThemedText>{String(r.estado || 'pendiente')}</ThemedText>
                      <ThemedText style={styles.cardLine}><ThemedText style={styles.cardLabel}>Motivo: </ThemedText>{r.motivo || '-'}</ThemedText>

                      <ThemedText style={styles.sectionTitle}>Empleado del primer turno</ThemedText>
                      <ThemedText style={styles.cardLine}>{r.empleado_ausente_nombre || `ID ${r.empleadoAusente_id}`}</ThemedText>
                      <ThemedText style={styles.cardLine}>Puesto: {r.marca_ausente?.puesto || r.puesto_ausente_nombre || '-'}</ThemedText>
                      <ThemedText style={styles.cardLine}>
                        Fecha/Horario: {formatDateFromIsoToDMY(r.marca_ausente?.fecha)} {formatTime(r.marca_ausente?.hora_inicio)} - {formatTime(r.marca_ausente?.hora_fin)} ({r.marca_ausente?.tipo_turno_texto || 'Sin definir'})
                      </ThemedText>
                      <ThemedText style={styles.cardLine}>Acepta: {r.ausente_acepta ? 'Sí' : 'No'}</ThemedText>
                      {r.ausente_acepta_at ? (
                        <ThemedText style={styles.cardLine}>
                          <ThemedText style={styles.cardLabel}>Aceptación: </ThemedText>
                          {formatDateFromIsoToDMY(r.ausente_acepta_at)} {formatTime(r.ausente_acepta_at)}
                        </ThemedText>
                      ) : null}
                      {signatureDataUri(r.firma_ausente_manual) ? (
                        <ThemedView style={styles.signaturePreviewBlock}>
                          <ThemedText style={styles.cardLabel}>Firma manual (Empleado del primer turno)</ThemedText>
                          <Image
                            source={{ uri: signatureDataUri(r.firma_ausente_manual) as string }}
                            style={styles.signaturePreviewImage}
                            resizeMode="contain"
                          />
                        </ThemedView>
                      ) : null}

                      <ThemedText style={styles.sectionTitle}>Empleado del segundo turno</ThemedText>
                      <ThemedText style={styles.cardLine}>{r.empleado_reemplaza_nombre || `ID ${r.empleadoReemplaza_id}`}</ThemedText>
                      <ThemedText style={styles.cardLine}>Puesto: {r.marca_reemplaza?.puesto || r.puesto_reemplaza_nombre || '-'}</ThemedText>
                      <ThemedText style={styles.cardLine}>
                        Fecha/Horario: {formatDateFromIsoToDMY(r.marca_reemplaza?.fecha)} {formatTime(r.marca_reemplaza?.hora_inicio)} - {formatTime(r.marca_reemplaza?.hora_fin)} ({r.marca_reemplaza?.tipo_turno_texto || 'Sin definir'})
                      </ThemedText>
                      <ThemedText style={styles.cardLine}>Acepta: {r.reemplaza_acepta ? 'Sí' : 'No'}</ThemedText>
                      {r.reemplaza_acepta_at ? (
                        <ThemedText style={styles.cardLine}>
                          <ThemedText style={styles.cardLabel}>Aceptación: </ThemedText>
                          {formatDateFromIsoToDMY(r.reemplaza_acepta_at)} {formatTime(r.reemplaza_acepta_at)}
                        </ThemedText>
                      ) : null}
                      {signatureDataUri(r.firma_reemplaza_manual) ? (
                        <ThemedView style={styles.signaturePreviewBlock}>
                          <ThemedText style={styles.cardLabel}>Firma manual (Empleado del segundo turno)</ThemedText>
                          <Image
                            source={{ uri: signatureDataUri(r.firma_reemplaza_manual) as string }}
                            style={styles.signaturePreviewImage}
                            resizeMode="contain"
                          />
                        </ThemedView>
                      ) : null}

                      <ThemedView style={styles.actionsRow}>
                        {r.can_accept_ausente ? (
                          <TouchableOpacity
                            style={[
                              styles.actionBtn,
                              styles.acceptBtn,
                              acceptingMutuoKey === `${r.id}-ausente` && styles.buttonDisabled,
                            ]}
                            onPress={() => openParticipantAcceptModal(r.id, 'ausente')}
                            activeOpacity={0.85}
                            disabled={acceptingMutuoKey !== null || participantSigModalVisible || signatureModalVisible}
                          >
                            {acceptingMutuoKey === `${r.id}-ausente` ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                            )}
                            <ThemedText style={styles.actionBtnText}>Aceptar (Primer turno)</ThemedText>
                          </TouchableOpacity>
                        ) : null}
                        {r.can_accept_reemplaza ? (
                          <TouchableOpacity
                            style={[
                              styles.actionBtn,
                              styles.acceptBtn,
                              acceptingMutuoKey === `${r.id}-reemplaza` && styles.buttonDisabled,
                            ]}
                            onPress={() => openParticipantAcceptModal(r.id, 'reemplaza')}
                            activeOpacity={0.85}
                            disabled={acceptingMutuoKey !== null || participantSigModalVisible || signatureModalVisible}
                          >
                            {acceptingMutuoKey === `${r.id}-reemplaza` ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                            )}
                            <ThemedText style={styles.actionBtnText}>Aceptar (Segundo turno)</ThemedText>
                          </TouchableOpacity>
                        ) : null}
                        {r.can_sign_ejecutivo ? (
                          <TouchableOpacity
                            style={[styles.actionBtn, styles.signBtn]}
                            onPress={() => openSignatureModal(r.id)}
                            activeOpacity={0.85}
                            disabled={acceptingMutuoKey !== null || participantSigModalVisible}
                          >
                            <Ionicons name="create-outline" size={18} color="#FFFFFF" />
                            <ThemedText style={styles.actionBtnText}>Aprobar</ThemedText>
                          </TouchableOpacity>
                        ) : null}
                        {r.can_reject_ejecutivo ? (
                          <TouchableOpacity
                            style={[
                              styles.actionBtn,
                              styles.rejectBtn,
                              rejectingMutuoId === r.id && styles.buttonDisabled,
                            ]}
                            onPress={() => {
                              if (rejectingMutuoId !== null) return;
                              Alert.alert(
                                'Confirmar rechazo',
                                'Este mutuo acuerdo será rechazado. ¿Desea continuar?',
                                [
                                  { text: 'Cancelar', style: 'cancel' },
                                  {
                                    text: 'Rechazar',
                                    style: 'destructive',
                                    onPress: () => void runRejectByExecutive(r.id),
                                  },
                                ],
                                { cancelable: true }
                              );
                            }}
                            activeOpacity={0.85}
                            disabled={rejectingMutuoId !== null || participantSigModalVisible}
                          >
                            {rejectingMutuoId === r.id ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <Ionicons name="close-circle-outline" size={18} color="#FFFFFF" />
                            )}
                            <ThemedText style={styles.actionBtnText}>Rechazar</ThemedText>
                          </TouchableOpacity>
                        ) : null}
                      </ThemedView>
                    </ThemedView>
                  ))}
                </ThemedView>
              )}
            </>
          )}
        </ThemedView>
      </ScrollView>

      <Modal
        visible={signatureModalVisible}
        animationType="fade"
        transparent
        onRequestClose={closeSignatureModal}
      >
        <View style={styles.overlay}>
          <ThemedView style={styles.floatCard}>
            <View style={styles.floatHeader}>
              <ThemedText style={styles.modalTitle}>Aprobar (Ejecutivo de cuenta)</ThemedText>
              <TouchableOpacity onPress={closeSignatureModal}>
                <Ionicons name="close" size={22} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 620 }} contentContainerStyle={{ padding: 12 }}>
              <Collapsible title="Firma digital ejecutivo">
                <ThemedView style={styles.modalDigitalRow}>
                  <TouchableOpacity
                    style={[styles.signatureBlueButton, isGeneratingFirmaEjecutivoDigital && styles.buttonDisabled]}
                    onPress={handleGenerateFirmaEjecutivoDigital}
                    disabled={isGeneratingFirmaEjecutivoDigital}
                    activeOpacity={0.85}
                  >
                    {isGeneratingFirmaEjecutivoDigital ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Ionicons name="finger-print" size={18} color="#FFFFFF" />
                    )}
                    <ThemedText style={styles.signatureBlueButtonText}>Generar firma digital</ThemedText>
                  </TouchableOpacity>
                  {!firmaEjecutivoDigital ? (
                    <ThemedText style={styles.signatureHintMuted}>Aún no hay firma digital ejecutivo.</ThemedText>
                  ) : (
                    <ThemedView style={styles.firmaInfoBox}>
                      <ThemedView style={{ flex: 1, paddingRight: 10 }}>
                        <ThemedText style={styles.firmaInfoTitle}>Información de la firma:</ThemedText>
                        {(() => {
                          const info = decodeFirmaHash(firmaEjecutivoDigital);
                          if (!info) {
                            return <ThemedText style={styles.firmaInfoValue}>Formato no decodificable</ThemedText>;
                          }
                          return (
                            <>
                              <ThemedText style={styles.firmaInfoValue}>Sesión: {info.sessionId || 'N/A'}</ThemedText>
                              <ThemedText style={styles.firmaInfoValue}>Empleado: {info.empleadoId || 'N/A'}</ThemedText>
                              <ThemedText style={styles.firmaInfoValue}>Lat: {info.latitud || 'N/A'} | Long: {info.longitud || 'N/A'}</ThemedText>
                              <ThemedText style={styles.firmaInfoValue}>
                                Hora: {convertDateTimestampToLocalString(new Date(Number(info.timestamp)).toISOString()) || 'N/A'}
                              </ThemedText>
                            </>
                          );
                        })()}
                      </ThemedView>
                      <TouchableOpacity style={styles.firmaClearButtonTiny} onPress={() => setFirmaEjecutivoDigital('')} activeOpacity={0.85}>
                        <Ionicons name="trash" size={18} color="#FFFFFF" />
                      </TouchableOpacity>
                    </ThemedView>
                  )}
                </ThemedView>
              </Collapsible>

              <Collapsible title="Firma manual ejecutivo">
                <ThemedView style={styles.modalDigitalRow}>
                  <TouchableOpacity
                    style={styles.signatureBlueButton}
                    onPress={openExecutiveDrawModal}
                    activeOpacity={0.85}
                    disabled={isSigning}
                  >
                    <Ionicons name="create-outline" size={18} color="#FFFFFF" />
                    <ThemedText style={styles.signatureBlueButtonText}>
                      {firmaEjecutivoManual ? 'Firma manual lista (editar)' : 'Dibujar firma manual'}
                    </ThemedText>
                  </TouchableOpacity>
                  {!firmaEjecutivoManual ? (
                    <ThemedText style={styles.signatureHintMuted}>Aún no hay firma manual del ejecutivo.</ThemedText>
                  ) : (
                    <ThemedView style={styles.signaturePreviewBlock}>
                      <ThemedText style={styles.label}>Vista previa de la firma manual</ThemedText>
                      <Image
                        source={{ uri: signatureDataUri(firmaEjecutivoManual) as string }}
                        style={styles.signaturePreviewImage}
                        resizeMode="contain"
                      />
                      <TouchableOpacity
                        style={styles.firmaClearManualButton}
                        onPress={() => setFirmaEjecutivoManual('')}
                        activeOpacity={0.85}
                        disabled={isSigning}
                      >
                        <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
                        <ThemedText style={styles.firmaClearManualButtonText}>Borrar firma manual</ThemedText>
                      </TouchableOpacity>
                    </ThemedView>
                  )}
                </ThemedView>
              </Collapsible>

              <ThemedView style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalAcceptBtn, isSigning && styles.buttonDisabled]}
                  onPress={submitSignature}
                  activeOpacity={0.85}
                  disabled={isSigning}
                >
                  {isSigning ? <ActivityIndicator size="small" color="#000" /> : <Ionicons name="checkmark" size={18} color="#000" />}
                  <ThemedText style={styles.modalAcceptBtnText}>Aprobar mutuo acuerdo</ThemedText>
                </TouchableOpacity>
              </ThemedView>
            </ScrollView>
          </ThemedView>
        </View>
      </Modal>

      <Modal
        visible={executiveDrawModalVisible}
        animationType="fade"
        transparent
        onRequestClose={closeExecutiveDrawModal}
      >
        <View style={styles.overlay}>
          <ThemedView style={styles.floatCard}>
            <View style={styles.floatHeader}>
              <ThemedText style={styles.modalTitle}>Firma manual ejecutivo</ThemedText>
              <TouchableOpacity onPress={closeExecutiveDrawModal} disabled={isReadingSignature}>
                <Ionicons name="close" size={22} color="#333" />
              </TouchableOpacity>
            </View>
            <ThemedText style={[styles.signatureHintMuted, { paddingHorizontal: 16, paddingTop: 10 }]}>
              Dibuje su firma en el recuadro y pulse Aceptar para guardarla en el formulario de aprobación.
            </ThemedText>
            <ThemedView style={styles.signatureContainer}>
              <SignatureScreen
                ref={signatureRef}
                onOK={onExecutiveManualSignatureCaptured}
                onEmpty={() => {
                  setIsReadingSignature(false);
                  Alert.alert('Error', 'La firma manual está vacía');
                }}
                onClear={() => {
                  setIsReadingSignature(false);
                }}
                descriptionText=""
                clearText="Limpiar"
                confirmText="Aceptar"
                webStyle={signatureWebStyle}
                key={signatureKey}
                autoClear={false}
                imageType="image/png"
              />
            </ThemedView>
            <ThemedView style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalClearBtn, isReadingSignature && styles.buttonDisabled]}
                onPress={clearExecutiveDrawModal}
                activeOpacity={0.85}
                disabled={isReadingSignature}
              >
                <Ionicons name="refresh" size={18} color="#000" />
                <ThemedText style={styles.modalClearBtnText}>Limpiar</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalAcceptBtn, isReadingSignature && styles.buttonDisabled]}
                onPress={requestConfirmExecutiveDraw}
                activeOpacity={0.85}
                disabled={isReadingSignature}
              >
                {isReadingSignature ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Ionicons name="checkmark" size={18} color="#000" />
                )}
                <ThemedText style={styles.modalAcceptBtnText}>Aceptar</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          </ThemedView>
        </View>
      </Modal>

      <Modal
        visible={participantSigModalVisible}
        animationType="fade"
        transparent
        onRequestClose={closeParticipantAcceptModal}
      >
        <View style={styles.overlay}>
          <ThemedView style={styles.floatCard}>
            <View style={styles.floatHeader}>
              <ThemedText style={styles.modalTitle}>
                {participantSigRole === 'reemplaza' ? 'Aceptar (Segundo turno)' : 'Aceptar (Primer turno)'}
              </ThemedText>
              <TouchableOpacity onPress={closeParticipantAcceptModal} disabled={!!acceptingMutuoKey}>
                <Ionicons name="close" size={22} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 620 }} contentContainerStyle={{ padding: 12 }}>
              <ThemedText style={styles.signatureHintMuted}>
                Dibuje su firma en el recuadro. Es obligatoria para registrar su aceptación del mutuo acuerdo.
              </ThemedText>
              <ThemedView style={styles.signatureContainer}>
                <SignatureScreen
                  ref={participantSignatureRef}
                  onOK={onParticipantSignatureRead}
                  onEmpty={() => {
                    setParticipantIsReadingSig(false);
                    Alert.alert('Error', 'La firma manual está vacía');
                  }}
                  onClear={() => {
                    setParticipantIsReadingSig(false);
                  }}
                  descriptionText=""
                  clearText="Limpiar"
                  confirmText="Aceptar"
                  webStyle={signatureWebStyle}
                  key={participantSignatureKey}
                />
              </ThemedView>

              <ThemedView style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalClearBtn, !!acceptingMutuoKey && styles.buttonDisabled]}
                  onPress={() => {
                    participantSignatureRef.current?.clearSignature?.();
                    setParticipantSignatureKey((k) => k + 1);
                  }}
                  activeOpacity={0.85}
                  disabled={!!acceptingMutuoKey}
                >
                  <Ionicons name="refresh" size={18} color="#000" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalAcceptBtn, (!!acceptingMutuoKey || participantIsReadingSig) && styles.buttonDisabled]}
                  onPress={submitParticipantAccept}
                  activeOpacity={0.85}
                  disabled={!!acceptingMutuoKey || participantIsReadingSig}
                >
                  {acceptingMutuoKey || participantIsReadingSig ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <Ionicons name="checkmark" size={18} color="#000" />
                  )}
                </TouchableOpacity>
              </ThemedView>
            </ScrollView>
          </ThemedView>
        </View>
      </Modal>

      <CambiosAppsModulesModal
        visible={isCambiosModalVisible}
        title={cambiosTitle}
        items={cambiosItems}
        onClose={closeCambiosModal}
      />

      <PlanillasPasswordRevalidationModal
        visible={showPlanillasRevalidationModal}
        refreshAccessToken={refreshAccessToken}
        logout={logout}
        onSuccess={handlePlanillasRevalidationSuccess}
        onDismiss={handlePlanillasRevalidationDismiss}
      />

      <AppFooter />
      <SlideMenu isVisible={isMenuVisible} onClose={() => setIsMenuVisible(false)} onHomePress={() => navigation.navigate('Home')} currentRoute="MutuosAcuerdos" />
      {QRScannerComponent}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },
  content: { width: '100%', maxWidth: 860, alignSelf: 'center' },

  titleContainer: { alignItems: 'center', marginBottom: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  title: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, opacity: 0.7, textAlign: 'center' },

  loadingContainer: { padding: 20, alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 14, color: '#000', opacity: 0.7 },
  errorText: { color: '#FF3B30', textAlign: 'center', marginBottom: 12 },
  emptyContainer: { padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 14, opacity: 0.6, textAlign: 'center', color: '#000' },

  createButton: { backgroundColor: '#007AFF', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginBottom: 16 },
  createButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  filtersContainer: {
    width: '100%',
    marginBottom: 16,
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
  filterClearText: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },

  formCard: { marginTop: 12, backgroundColor: '#fff', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#E0E0E0' },
  formTitle: { fontSize: 18, fontWeight: '800', marginBottom: 10, color: '#000' },
  hierarchyInfoBox: {
    marginBottom: 12,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#F5F7FA',
    borderWidth: 1,
    borderColor: '#E0E4EA',
  },
  hierarchyInfoTitle: { fontSize: 13, fontWeight: '700', color: '#333', marginBottom: 6 },
  hierarchyInfoLine: { fontSize: 12, color: '#555', lineHeight: 18 },
  sectionTitle: { marginTop: 14, marginBottom: 8, fontSize: 15, fontWeight: '800', color: '#007AFF' },
  label: { fontSize: 13, fontWeight: '700', marginTop: 10, color: '#333' },
  input: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, backgroundColor: '#fff', color: '#000', marginBottom: 6 },
  textArea: { minHeight: 90, textAlignVertical: 'top' as any },
  pickerWrapper: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, overflow: 'hidden', backgroundColor: '#FFFFFF', justifyContent: 'center' },
  picker: { height: 54, width: '100%', color: '#000' },

  sectionCard: { marginTop: 10, borderWidth: 1, borderColor: '#E7E7E7', borderRadius: 10, padding: 12, backgroundColor: '#FAFAFA' },
  dateButton: { marginBottom: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, backgroundColor: '#fff' },
  dateButtonText: { color: '#000', fontWeight: '700' },

  codeRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  codeInput: { flex: 1, borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, backgroundColor: '#fff', color: '#000' },
  codeActionButton: { backgroundColor: '#007AFF', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 11 },
  codeActionButtonText: { color: '#FFF', fontWeight: '700' },
  qrButton: { marginTop: 10, borderWidth: 1, borderColor: '#007AFF', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF' },
  qrButtonText: { color: '#007AFF', fontWeight: '700' },

  employeeInfoBox: { marginTop: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E0E0E0', backgroundColor: '#FFF', padding: 10 },
  employeeInfoText: { fontSize: 13, color: '#222', marginBottom: 3 },

  inlineLoading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  inlineLoadingText: { fontSize: 14, color: '#000', opacity: 0.7 },
  freeDayText: { marginTop: 8, color: '#666', fontStyle: 'italic' },
  marcaList: { marginTop: 10, gap: 8 },
  marcaItem: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, padding: 10, backgroundColor: '#FFF' },
  marcaItemSelected: { borderColor: '#007AFF', backgroundColor: '#EAF3FF' },
  marcaItemTitle: { fontWeight: '800', color: '#1E1E1E', marginBottom: 4 },
  marcaItemText: { fontSize: 13, color: '#444', marginBottom: 2 },
  pickFileBtn: { marginTop: 6, borderWidth: 1, borderColor: '#007AFF', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF' },
  pickFileBtnText: { color: '#007AFF', fontWeight: '700' },
  fileSelectedBox: { marginTop: 8, borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, backgroundColor: '#F8F8F8', paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  fileSelectedText: { color: '#222', fontSize: 13, flex: 1 },

  signatureBlueButton: { marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#007AFF', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 10, gap: 8 },
  signatureBlueButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  firmaOkText: { marginTop: 8, color: '#1B8F3A', fontWeight: '700' },
  signatureHintMuted: { marginTop: 6, color: '#999' },
  firmaInfoBox: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#F7F8FA',
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  firmaInfoTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8, color: '#333' },
  firmaInfoValue: { fontSize: 13, color: '#333', marginBottom: 4 },
  firmaClearButtonTiny: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
  },

  formActions: { marginTop: 16, flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  formActionBtn: { flex: 1, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12 },
  cancelBtn: { backgroundColor: '#EDEDED' },
  cancelBtnText: { color: '#000', fontWeight: '800' },
  saveBtn: { backgroundColor: '#007AFF' },
  saveBtnText: { color: '#fff', fontWeight: '800' },
  buttonDisabled: { opacity: 0.6 },

  listContainer: {},
  card: { backgroundColor: '#FFFFFF', borderRadius: 8, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  cardTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10, color: '#000' },
  cardLine: { marginBottom: 6, color: '#000' },
  cardLabel: { fontWeight: '700', color: '#333' },

  actionsRow: { marginTop: 12, flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  actionBtn: { minWidth: 150, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, gap: 8 },
  acceptBtn: { backgroundColor: '#34C759' },
  signBtn: { backgroundColor: '#5856D6' },
  rejectBtn: { backgroundColor: '#FF3B30' },
  changesBtn: { backgroundColor: '#007AFF' },
  actionBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  floatCard: {
    width: '100%',
    maxWidth: 860,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
  },
  floatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  modalDigitalRow: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 },
  signatureContainer: { height: 280, borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, overflow: 'hidden', marginTop: 8 },
  signaturePreviewBlock: { marginTop: 10, marginBottom: 4 },
  signaturePreviewImage: {
    width: '100%',
    height: 120,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    backgroundColor: '#FAFAFA',
  },
  firmaClearManualButton: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#FF3B30',
  },
  firmaClearManualButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, gap: 12, backgroundColor: '#FFFFFF' },
  modalClearBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10, backgroundColor: '#EDEDED', gap: 8 },
  modalClearBtnText: { fontWeight: '800', color: '#000' },
  modalAcceptBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10, backgroundColor: '#D7F5E5', gap: 8 },
  modalAcceptBtnText: { fontWeight: '800', color: '#000' },
});
