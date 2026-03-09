import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import SignatureScreen from 'react-native-signature-canvas';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import * as Location from 'expo-location';
import * as DocumentPicker from 'expo-document-picker';
import { jwtDecode } from 'jwt-decode';
import Constants from 'expo-constants';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import AppHeader from '@/components/AppHeader';
import AppFooter from '@/components/AppFooter';
import SlideMenu from '@/components/SlideMenu';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useAuth } from '@/contexts/AuthContext';
import authedFetch from '@/hooks/authedFetch';
import { useQRScanner } from '@/hooks/useQRScanner';
import getHoraAccion from '@/hooks/getHoraAccion';
import { RootStackParamList } from '../App';

type Nav = NativeStackNavigationProp<RootStackParamList, 'PermitRequest'>;
type PermitType = 'Con goce' | 'Sin goce';

type Turno = {
  id: number;
  cliente: string | null;
  sucursal: string | null;
  puesto: string | null;
  hora_inicio: string | null;
  hora_fin: string | null;
  tipo_turno: string | null;
  horas_duracion: string | null;
  reemplazo_id?: number | null;
  reemplazo_nombre?: string | null;
};

type PermitRecord = {
  id: number;
  empleado_id: number;
  tipo: string;
  fecha_inicio: string;
  fecha_fin: string;
  ejecutivo_cuenta: number;
  comentarios?: string | null;
  file_name?: string | null;
  reemplazo_obligatorio?: number | null;
  turnos: Turno[];
  firma_ejecutivo_cuenta_digital?: string | null;
  firma_ejecutivo_cuenta_manual?: string | null;
  created_at: string;
  empleado_nombre?: string | null;
  reemplazo_obligatorio_nombre?: string | null;
  is_own_record?: boolean;
  can_complete_by_executive?: boolean;
  is_executive_for_record?: boolean;
};

type PlazaOption = {
  id: number;
  nombre_plaza: string;
  nombre_puesto: string | null;
  nombre_sucursal: string | null;
  nombre_cliente: string | null;
};

type AttachedDocument = {
  base64: string;
  extension: string;
  original_name: string;
  mimeType?: string;
  type: string;
};

const SIGNATURE_WEB_STYLE = `
.m-signature-pad--footer { display: none; margin: 0; }
.m-signature-pad { box-shadow: none; border: none; }
body,html { width: 100%; height: 100%; background: #ffffff; }
`;

const formatDateYMD = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatDateDMY = (value?: string | null) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
};

const decodeFirmaHash = (hash?: string | null): { sessionId: string; empleadoId: string; latitud: string; longitud: string; timestamp: string } | null => {
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

/** Construye la URL de get-file con token (mismo patrón que ComplaintsMasterScreen buildComplaintFileUrl). */
const buildPermitRequestFileUrl = (
  recordId: number,
  fileName: string,
  accessToken?: string | null
): string => {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) return '';
  if (!recordId || !fileName || !String(fileName).trim()) return '';
  const appendToken = (url: string) => {
    if (!accessToken || accessToken.trim().length === 0) return url;
    if (/[?&]token=/.test(url)) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}token=${encodeURIComponent(accessToken)}`;
  };
  return appendToken(
    `${apiUrl}/api/permit-request/${recordId}/get-file/${encodeURIComponent(String(fileName).trim())}`
  );
};

export default function PermitRequestScreenV2() {
  const navigation = useNavigation<Nav>();
  const { employee, refreshAccessToken, logout, accessToken } = useAuth();
  const { scanQR, QRScannerComponent } = useQRScanner();

  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [records, setRecords] = useState<PermitRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [isCreating, setIsCreating] = useState(false);
  const [plazas, setPlazas] = useState<PlazaOption[]>([]);
  const [selectedPlazaId, setSelectedPlazaId] = useState<number | null>(null);
  const [isLoadingPlazas, setIsLoadingPlazas] = useState(false);
  const [tipo, setTipo] = useState<PermitType | ''>('');
  const [fechaInicio, setFechaInicio] = useState(new Date());
  const [fechaFin, setFechaFin] = useState(new Date());
  const [showDateInicio, setShowDateInicio] = useState(false);
  const [showDateFin, setShowDateFin] = useState(false);
  const [comentarios, setComentarios] = useState('');
  const [turnosPreview, setTurnosPreview] = useState<Turno[]>([]);
  const [turnosMessage, setTurnosMessage] = useState('');
  const [attachedDocument, setAttachedDocument] = useState<AttachedDocument | null>(null);
  const [firmaResponsable, setFirmaResponsable] = useState('');
  const [isGeneratingFirma, setIsGeneratingFirma] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<PermitRecord | null>(null);
  const [turnosComplete, setTurnosComplete] = useState<Turno[]>([]);
  const [reemplazoObligatorio, setReemplazoObligatorio] = useState<number | null>(null);
  const [reemplazoObligatorioCode, setReemplazoObligatorioCode] = useState('');
  const [byTurnoCode, setByTurnoCode] = useState<Record<number, string>>({});
  const [firmaEjecutivoDigital, setFirmaEjecutivoDigital] = useState('');
  const [firmaEjecutivoManual, setFirmaEjecutivoManual] = useState('');
  const [isGeneratingFirmaEjecutivo, setIsGeneratingFirmaEjecutivo] = useState(false);
  const [isSavingComplete, setIsSavingComplete] = useState(false);

  const [isDrawModalVisible, setIsDrawModalVisible] = useState(false);
  const [isReadingSignature, setIsReadingSignature] = useState(false);
  const [signatureKey, setSignatureKey] = useState(0);
  const signatureRef = useRef<any>(null);

  const getConnectionStatus = async () => {
    const n = await Network.getNetworkStateAsync();
    return Boolean(n.isConnected && n.isInternetReachable);
  };

  const generateFirmaHashForCurrentUser = async (): Promise<string | null> => {
    try {
      if (!employee?.id) return null;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'Se requiere ubicación para generar firma digital');
        return null;
      }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const token = await AsyncStorage.getItem('access_token');
      if (!token) return null;
      const decoded: any = jwtDecode(token);
      const sessionId = decoded?.sessionId || 'unknown';
      const timestamp = await getHoraAccion();
      if (!timestamp) return null;
      return btoa(`${sessionId}:${employee.id}:${location.coords.latitude}:${location.coords.longitude}:${timestamp}`);
    } catch {
      return null;
    }
  };

  const getEmpleadoByCodigo = async (codigo: string) => {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');
    const response = await authedFetch({
      url: `${apiUrl}/api/empleados/codigo/${encodeURIComponent(String(codigo).trim())}`,
      init: { method: 'GET', headers: { 'Content-Type': 'application/json' } },
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

  const getEmpleadoById = async (id: number) => {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');
    const response = await authedFetch({
      url: `${apiUrl}/api/empleados/${id}`,
      init: { method: 'GET', headers: { 'Content-Type': 'application/json' } },
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

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const online = await getConnectionStatus();
      setIsOnline(online);
      if (!online) {
        setError('Este módulo funciona únicamente con internet.');
        setRecords([]);
        return;
      }
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) throw new Error('Server URL not configured');
      const resp = await authedFetch({
        url: `${apiUrl}/api/permit-request`,
        init: { method: 'GET', headers: { 'Content-Type': 'application/json' } },
        refreshAccessToken,
        logout,
      });
      if (!resp) throw new Error('Sesión expirada');
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.status) throw new Error(json?.message || 'No se pudieron cargar las solicitudes');
      setRecords(Array.isArray(json.data) ? json.data : []);
    } catch (e: any) {
      setError(e?.message || 'Error al cargar solicitudes');
      setRecords([]);
    } finally {
      setIsLoading(false);
    }
  }, [refreshAccessToken, logout]);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll])
  );

  const fetchPlazas = useCallback(async () => {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) return;
    setIsLoadingPlazas(true);
    try {
      const resp = await authedFetch({
        url: `${apiUrl}/api/permit-request/plazas`,
        init: { method: 'GET', headers: { 'Content-Type': 'application/json' } },
        refreshAccessToken,
        logout,
      });
      if (!resp) throw new Error('Sesión expirada');
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.status) throw new Error(json?.message || 'No se pudieron cargar las plazas');
      const data = Array.isArray(json.data) ? json.data : [];
      const mapped = data.map((p: any) => ({
        id: Number(p.id),
        nombre_plaza: String(p.nombre_plaza ?? '').trim() || 'Plaza',
        nombre_puesto: p.nombre_puesto != null ? String(p.nombre_puesto).trim() : null,
        nombre_sucursal: p.nombre_sucursal != null ? String(p.nombre_sucursal).trim() : null,
        nombre_cliente: p.nombre_cliente != null ? String(p.nombre_cliente).trim() : null,
      }));
      setPlazas(mapped);
      if (mapped.length === 0) {
        setSelectedPlazaId(null);
        Alert.alert(
          'Sin plazas',
          'No se encontraron plazas asignadas a tu usuario. No puedes crear una solicitud de permiso sin una plaza válida.'
        );
      } else {
        setSelectedPlazaId(Number(mapped[0]?.id) || null);
      }
    } catch (e: any) {
      setPlazas([]);
      setSelectedPlazaId(null);
      Alert.alert('Error', e?.message || 'No se pudieron cargar las plazas');
    } finally {
      setIsLoadingPlazas(false);
    }
  }, [refreshAccessToken, logout]);

  const fetchTurnosPreview = async () => {
    if (!selectedPlazaId) {
      setTurnosMessage('Selecciona primero una plaza');
      return;
    }
    try {
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) throw new Error('Server URL not configured');
      const fi = formatDateYMD(fechaInicio);
      const ff = formatDateYMD(fechaFin);
      const resp = await authedFetch({
        url: `${apiUrl}/api/permit-request/turnos?fecha_inicio=${encodeURIComponent(fi)}&fecha_fin=${encodeURIComponent(ff)}&plaza_id=${encodeURIComponent(String(selectedPlazaId))}`,
        init: { method: 'GET', headers: { 'Content-Type': 'application/json' } },
        refreshAccessToken,
        logout,
      });
      if (!resp) throw new Error('Sesión expirada');
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.status) throw new Error(json?.message || 'No se pudieron obtener los turnos');
      const rows = Array.isArray(json.data) ? json.data : [];
      setTurnosPreview(rows);
      setTurnosMessage(rows.length ? '' : 'El usuario está libre en ese rango de fechas para esta plaza.');
    } catch (e: any) {
      setTurnosPreview([]);
      setTurnosMessage(e?.message || 'No se pudieron obtener los turnos');
    }
  };

  const handleGenerateFirmaResponsable = async () => {
    if (isGeneratingFirma) return;
    setIsGeneratingFirma(true);
    try {
      const hash = await generateFirmaHashForCurrentUser();
      if (!hash) {
        Alert.alert('Error', 'No se pudo generar la firma digital');
        return;
      }
      setFirmaResponsable(hash);
    } finally {
      setIsGeneratingFirma(false);
    }
  };

  const handleScanFirmaResponsable = async () => {
    try {
      const qrData = await scanQR();
      if (!qrData) return;
      setFirmaResponsable(qrData);
    } catch {
      Alert.alert('Error', 'No se pudo escanear el QR');
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const file = result.assets[0];
      const fileResponse = await fetch(file.uri);
      const blob = await fileResponse.blob();
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const raw = reader.result;
          if (typeof raw !== 'string') return reject(new Error('No se pudo leer archivo'));
          const parts = raw.split(',');
          resolve(parts.length > 1 ? parts[1] : parts[0]);
        };
        reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer archivo'));
        reader.readAsDataURL(blob);
      });
      const extension = String(file.name || '').split('.').pop()?.toLowerCase() || 'dat';
      setAttachedDocument({
        base64,
        extension,
        original_name: file.name || `archivo.${extension}`,
        mimeType: file.mimeType || undefined,
        type: 'file',
      });
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo adjuntar archivo');
    }
  };

  const resetCreateForm = async () => {
    const horaAccion = await getHoraAccion();
    if (!horaAccion) {
      Alert.alert('Error', 'No se pudo obtener la hora');
      return;
    }
    setSelectedPlazaId(null);
    setTipo('');
    setFechaInicio(new Date(horaAccion));
    setFechaFin(new Date(horaAccion));
    setComentarios('');
    setTurnosPreview([]);
    setTurnosMessage('');
    setAttachedDocument(null);
    setFirmaResponsable('');
  };

  const onPlazaChange = (plazaId: number | null) => {
    setSelectedPlazaId(plazaId);
    setTurnosPreview([]);
    setTurnosMessage(plazaId ? 'Cambiaste de plaza. Vuelve a buscar turnos.' : 'Selecciona una plaza y busca turnos.');
  };

  const handleCreate = async () => {
    if (!isOnline) return Alert.alert('Sin conexión', 'Este módulo funciona únicamente con internet');
    if (!selectedPlazaId) return Alert.alert('Error', 'Debes seleccionar una plaza');
    if (!tipo) return Alert.alert('Error', 'Debes seleccionar tipo de solicitud');
    if (!firmaResponsable) return Alert.alert('Error', 'Debes generar la firma responsable');
    if (!turnosPreview.length) return Alert.alert('Error', 'Debes consultar un rango con turnos disponibles');

    setIsSubmitting(true);
    try {
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) throw new Error('Server URL not configured');
      const payload: any = {
        plaza_id: selectedPlazaId,
        tipo,
        fecha_inicio: formatDateYMD(fechaInicio),
        fecha_fin: formatDateYMD(fechaFin),
        comentarios: comentarios.trim() || undefined,
        firma_responsable: firmaResponsable,
      };
      if (attachedDocument) {
        payload.file_base64 = attachedDocument.base64;
        payload.extension = attachedDocument.extension;
        payload.original_name = attachedDocument.original_name;
        payload.mimeType = attachedDocument.mimeType;
        payload.type = attachedDocument.type;
      }
      const resp = await authedFetch({
        url: `${apiUrl}/api/permit-request`,
        init: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
        refreshAccessToken,
        logout,
      });
      if (!resp) throw new Error('Sesión expirada');
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.status) throw new Error(json?.message || 'No se pudo crear');
      Alert.alert('Éxito', 'Solicitud creada correctamente');
      setIsCreating(false);
      resetCreateForm();
      fetchAll();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo crear la solicitud');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openCompleteModal = (record: PermitRecord) => {
    const rows = Array.isArray(record.turnos) ? record.turnos : [];
    setSelectedRecord(record);
    setTurnosComplete(rows);
    setByTurnoCode({});
    setReemplazoObligatorio(record.reemplazo_obligatorio || null);
    setReemplazoObligatorioCode('');
    setFirmaEjecutivoDigital('');
    setFirmaEjecutivoManual('');
    setSignatureKey((v) => v + 1);
    setIsCompleteModalOpen(true);
  };

  const handleGenerateFirmaEjecutivo = async () => {
    if (isGeneratingFirmaEjecutivo) return;
    setIsGeneratingFirmaEjecutivo(true);
    try {
      const hash = await generateFirmaHashForCurrentUser();
      if (!hash) {
        Alert.alert('Error', 'No se pudo generar firma digital');
        return;
      }
      setFirmaEjecutivoDigital(hash);
    } finally {
      setIsGeneratingFirmaEjecutivo(false);
    }
  };

  const handleScanFirmaEjecutivo = async () => {
    try {
      const qrData = await scanQR();
      if (!qrData) return;
      setFirmaEjecutivoDigital(qrData);
    } catch {
      Alert.alert('Error', 'No se pudo escanear el QR');
    }
  };

  const assignReemplazoGlobalById = async (empId: number) => {
    const emp = await getEmpleadoById(empId);
    const nombre = [emp.nombre, emp.primer_apellido, emp.segundo_apellido].filter(Boolean).join(' ').trim();
    setReemplazoObligatorio(emp.id);
    setTurnosComplete((prev) => prev.map((t) => ({ ...t, reemplazo_id: emp.id, reemplazo_nombre: nombre || null })));
  };

  const handleAssignGlobalByCode = async () => {
    try {
      if (!reemplazoObligatorioCode.trim()) return Alert.alert('Error', 'Ingresa un código');
      const emp = await getEmpleadoByCodigo(reemplazoObligatorioCode.trim());
      await assignReemplazoGlobalById(Number(emp.id));
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo asignar reemplazo global');
    }
  };

  const handleAssignGlobalByQR = async () => {
    try {
      const qrData = await scanQR();
      if (!qrData) return;
      const decoded = atob(qrData).split(':');
      if (decoded.length < 2) return Alert.alert('Error', 'QR inválido');
      const empleadoId = Number(decoded[1]);
      if (!empleadoId) return Alert.alert('Error', 'QR inválido');
      await assignReemplazoGlobalById(empleadoId);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo leer QR');
    }
  };

  const assignTurnoById = async (turnoId: number, empId: number) => {
    const emp = await getEmpleadoById(empId);
    const nombre = [emp.nombre, emp.primer_apellido, emp.segundo_apellido].filter(Boolean).join(' ').trim();
    setTurnosComplete((prev) =>
      prev.map((t) => (t.id === turnoId ? { ...t, reemplazo_id: emp.id, reemplazo_nombre: nombre || null } : t))
    );
  };

  const handleAssignTurnoByCode = async (turnoId: number) => {
    try {
      const code = String(byTurnoCode[turnoId] || '').trim();
      if (!code) return Alert.alert('Error', 'Ingresa un código');
      const emp = await getEmpleadoByCodigo(code);
      await assignTurnoById(turnoId, Number(emp.id));
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo asignar reemplazo del turno');
    }
  };

  const handleAssignTurnoByQR = async (turnoId: number) => {
    try {
      const qrData = await scanQR();
      if (!qrData) return;
      const decoded = atob(qrData).split(':');
      if (decoded.length < 2) return Alert.alert('Error', 'QR inválido');
      const empleadoId = Number(decoded[1]);
      if (!empleadoId) return Alert.alert('Error', 'QR inválido');
      await assignTurnoById(turnoId, empleadoId);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo leer QR');
    }
  };

  const handleRemoveReemplazoFromTurno = (turnoId: number) => {
    setTurnosComplete((prev) =>
      prev.map((t) => (t.id === turnoId ? { ...t, reemplazo_id: null, reemplazo_nombre: null } : t))
    );
    setByTurnoCode((prev) => {
      const next = { ...prev };
      delete next[turnoId];
      return next;
    });
  };

  const openDrawModal = () => {
    setIsDrawModalVisible(true);
    setSignatureKey((v) => v + 1);
    setIsReadingSignature(false);
  };

  const clearSignatureInModal = () => {
    if (signatureRef.current?.clearSignature) signatureRef.current.clearSignature();
  };

  const onManualSignatureRead = (signature: string) => {
    const formatted = String(signature || '').includes('base64,')
      ? String(signature).split('base64,')[1]
      : String(signature || '');
    if (!formatted || formatted.length < 20) {
      setIsReadingSignature(false);
      Alert.alert('Error', 'Firma manual inválida');
      return;
    }
    setFirmaEjecutivoManual(formatted);
    setIsReadingSignature(false);
    setIsDrawModalVisible(false);
  };

  const acceptSignature = () => {
    if (!signatureRef.current?.readSignature) return;
    setIsReadingSignature(true);
    signatureRef.current.readSignature();
  };

  const saveCompletion = async () => {
    if (!selectedRecord) return;
    if (!firmaEjecutivoDigital) return Alert.alert('Error', 'Debes generar firma digital del ejecutivo');
    if (!firmaEjecutivoManual) return Alert.alert('Error', 'Debes generar firma manual del ejecutivo');

    setIsSavingComplete(true);
    try {
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) throw new Error('Server URL not configured');
      const resp = await authedFetch({
        url: `${apiUrl}/api/permit-request/${selectedRecord.id}`,
        init: {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reemplazo_obligatorio: reemplazoObligatorio,
            turnos: turnosComplete.map((t) => ({ id: t.id, reemplazo_id: t.reemplazo_id ?? null })),
            firma_ejecutivo_cuenta_digital: firmaEjecutivoDigital,
            firma_ejecutivo_cuenta_manual: firmaEjecutivoManual,
          }),
        },
        refreshAccessToken,
        logout,
      });
      if (!resp) throw new Error('Sesión expirada');
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.status) throw new Error(json?.message || 'No se pudo completar la solicitud');
      Alert.alert('Éxito', 'Solicitud completada correctamente');
      setIsCompleteModalOpen(false);
      setSelectedRecord(null);
      fetchAll();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo completar');
    } finally {
      setIsSavingComplete(false);
    }
  };

  const downloadAttachment = async (record: PermitRecord) => {
    try {
      if (!record.file_name) return;
      // Token del contexto o AsyncStorage (mismo criterio que ComplaintsMasterScreen)
      const token = accessToken?.trim() || (await AsyncStorage.getItem('access_token'))?.trim() || '';
      const url = buildPermitRequestFileUrl(record.id, record.file_name, token);
      if (!url) {
        Alert.alert('Error', 'No se pudo generar el enlace. Verifica tu sesión o la configuración del servidor.');
        return;
      }
      await Linking.openURL(url);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo acceder al archivo');
    }
  };

  const listRecords = useMemo(() => records, [records]);

  return (
    <ThemedView style={styles.container}>
      <AppHeader title="Solicitud de permiso" onMenuPress={() => setIsMenuVisible(true)} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <ThemedView style={styles.content}>
          {!!error && <ThemedText style={styles.errorText}>{error}</ThemedText>}

          <ThemedView style={styles.titleContainer}>
            <ThemedText type="title" style={styles.title}>
              <Ionicons name="document-text" size={22} color="#000000" /> Solicitud de permiso
            </ThemedText>
            <ThemedText style={styles.subtitle}>Módulo exclusivamente online</ThemedText>
          </ThemedView>

          {!isOnline && (
            <ThemedView style={styles.errorBox}>
              <ThemedText style={styles.errorText}>Este módulo funciona únicamente con internet.</ThemedText>
            </ThemedView>
          )}

          {!isCreating && !isLoading && (
            <TouchableOpacity
              style={[styles.createButton, !isOnline && styles.disabledButton]}
              disabled={!isOnline}
              onPress={() => {
                resetCreateForm();
                setIsCreating(true);
                fetchPlazas();
              }}
              activeOpacity={0.85}
            >
              <ThemedText style={styles.createButtonText}>
                <Ionicons name="add" size={20} color="#FFFFFF" /> Nueva solicitud
              </ThemedText>
            </TouchableOpacity>
          )}

          {!isCreating && (
            <>
              {isLoading ? (
                <ThemedView style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#007AFF" />
                  <ThemedText style={styles.loadingText}>Cargando...</ThemedText>
                </ThemedView>
              ) : !listRecords.length ? (
                <ThemedView style={styles.emptyContainer}>
                  <ThemedText style={styles.emptyText}>No hay solicitudes registradas</ThemedText>
                </ThemedView>
              ) : (
                <ThemedView style={styles.listContainer}>
                  {listRecords.map((r) => (
                    <ThemedView key={r.id} style={styles.card}>
                      <ThemedText style={styles.cardTitle}>Solicitud #{r.id}</ThemedText>
                      <ThemedText style={styles.cardLine}>
                        <ThemedText style={styles.cardLabel}>Tipo: </ThemedText>{r.tipo}
                      </ThemedText>
                      <ThemedText style={styles.cardLine}>
                        <ThemedText style={styles.cardLabel}>Inicio: </ThemedText>{formatDateDMY(r.fecha_inicio)}
                      </ThemedText>
                      <ThemedText style={styles.cardLine}>
                        <ThemedText style={styles.cardLabel}>Fin: </ThemedText>{formatDateDMY(r.fecha_fin)}
                      </ThemedText>
                      <ThemedText style={styles.cardLine}>
                        <ThemedText style={styles.cardLabel}>Turnos: </ThemedText>{Array.isArray(r.turnos) ? r.turnos.length : 0}
                      </ThemedText>
                      {!!r.file_name && (
                        <ThemedText style={styles.cardLine}>
                          <ThemedText style={styles.cardLabel}>Archivo: </ThemedText>{r.file_name}
                        </ThemedText>
                      )}

                      <ThemedView style={styles.actionsRow}>
                        {Boolean(r.can_complete_by_executive) && (
                          <TouchableOpacity
                            style={[styles.actionBtn, styles.completeBtn]}
                            onPress={() => openCompleteModal(r)}
                            activeOpacity={0.85}
                          >
                            <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                            <ThemedText style={styles.actionBtnText}>Completar</ThemedText>
                          </TouchableOpacity>
                        )}
                        {Boolean(r.file_name) && Boolean(r.is_executive_for_record) && (
                          <TouchableOpacity
                            style={[styles.actionBtn, styles.downloadBtn]}
                            onPress={() => downloadAttachment(r)}
                            activeOpacity={0.85}
                          >
                            <Ionicons name="download-outline" size={18} color="#FFFFFF" />
                            <ThemedText style={styles.actionBtnText}>Descargar archivo</ThemedText>
                          </TouchableOpacity>
                        )}
                      </ThemedView>
                    </ThemedView>
                  ))}
                </ThemedView>
              )}
            </>
          )}

          {isCreating && (
            <ThemedView style={styles.formCard}>
              <ThemedText style={styles.label}>Tipo de solicitud *</ThemedText>
              <View style={styles.pickerWrap}>
                <Picker selectedValue={tipo} onValueChange={(v) => setTipo(v as PermitType | '')}>
                  <Picker.Item label="Seleccionar" value="" />
                  <Picker.Item label="Con goce" value="Con goce" />
                  <Picker.Item label="Sin goce" value="Sin goce" />
                </Picker>
              </View>
              <ThemedText style={styles.label}>Plaza *</ThemedText>
              {isLoadingPlazas ? (
                <ThemedView style={{ paddingVertical: 12 }}>
                  <ActivityIndicator size="small" color="#007AFF" />
                  <ThemedText style={styles.signatureHintMuted}>Cargando plazas...</ThemedText>
                </ThemedView>
              ) : (
                <View style={styles.plazasList}>
                  {plazas.map((p) => (
                    <TouchableOpacity
                      key={p.id}
                      style={[
                        styles.plazaCard,
                        selectedPlazaId === p.id && styles.plazaCardSelected,
                      ]}
                      onPress={() => onPlazaChange(selectedPlazaId === p.id ? null : p.id)}
                      activeOpacity={0.85}
                    >
                      <ThemedText style={styles.plazaCardTitle}>{p.nombre_plaza}</ThemedText>
                      <ThemedText style={styles.cardLine}>
                        <ThemedText style={styles.cardLabel}>Puesto: </ThemedText>
                        {p.nombre_puesto ?? '-'}
                      </ThemedText>
                      <ThemedText style={styles.cardLine}>
                        <ThemedText style={styles.cardLabel}>Sucursal: </ThemedText>
                        {p.nombre_sucursal ?? '-'}
                      </ThemedText>
                      <ThemedText style={styles.cardLine}>
                        <ThemedText style={styles.cardLabel}>Cliente: </ThemedText>
                        {p.nombre_cliente ?? '-'}
                      </ThemedText>
                      {selectedPlazaId === p.id && (
                        <ThemedView style={styles.plazaCardBadge}>
                          <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                          <ThemedText style={styles.plazaCardBadgeText}>Seleccionada</ThemedText>
                        </ThemedView>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}


              <ThemedText style={styles.label}>Fecha inicio *</ThemedText>
              <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDateInicio(true)}>
                <ThemedText>{formatDateDMY(fechaInicio.toISOString())}</ThemedText>
              </TouchableOpacity>
              {showDateInicio && (
                <DateTimePicker
                  value={fechaInicio}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_, d) => {
                    setShowDateInicio(false);
                    if (d) setFechaInicio(d);
                  }}
                />
              )}

              <ThemedText style={styles.label}>Fecha fin *</ThemedText>
              <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDateFin(true)}>
                <ThemedText>{formatDateDMY(fechaFin.toISOString())}</ThemedText>
              </TouchableOpacity>
              {showDateFin && (
                <DateTimePicker
                  value={fechaFin}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_, d) => {
                    setShowDateFin(false);
                    if (d) setFechaFin(d);
                  }}
                />
              )}

              <TouchableOpacity style={styles.secondaryAction} onPress={fetchTurnosPreview}>
                <ThemedText style={styles.secondaryActionText}>Buscar turnos</ThemedText>
              </TouchableOpacity>
              {!!turnosMessage && <ThemedText style={styles.warningText}>{turnosMessage}</ThemedText>}

              {!!turnosPreview.length && (
                <View style={styles.turnosBox}>
                  {turnosPreview.map((t) => (
                    <View key={t.id} style={styles.turnoRow}>
                      <ThemedText style={styles.turnoText}>#{t.id} | {t.cliente || '-'} | {t.sucursal || '-'} | {t.puesto || '-'}</ThemedText>
                      <ThemedText style={styles.turnoText}>{t.hora_inicio || '-'} - {t.hora_fin || '-'} | {t.tipo_turno || '-'}</ThemedText>
                    </View>
                  ))}
                </View>
              )}

              <ThemedText style={styles.label}>Comentarios</ThemedText>
              <TextInput
                style={styles.textArea}
                multiline
                numberOfLines={4}
                value={comentarios}
                onChangeText={setComentarios}
                placeholder="Opcional"
                placeholderTextColor="#999"
              />

              <TouchableOpacity style={styles.secondaryAction} onPress={handlePickDocument}>
                <ThemedText style={styles.secondaryActionText}>Adjuntar archivo (opcional)</ThemedText>
              </TouchableOpacity>
              {!!attachedDocument?.original_name && (
                <ThemedText style={styles.fileText}>Archivo: {attachedDocument.original_name}</ThemedText>
              )}

              <ThemedText style={styles.sectionTitle}>Firma responsable *</ThemedText>
              <ThemedView style={styles.signatureButtons}>
                <TouchableOpacity
                  style={[styles.signatureButton, isGeneratingFirma && styles.signatureButtonDisabled]}
                  onPress={handleGenerateFirmaResponsable}
                  disabled={isGeneratingFirma}
                  activeOpacity={0.85}
                >
                  {isGeneratingFirma ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="finger-print" size={18} color="#FFFFFF" />
                      <ThemedText style={styles.signatureButtonText}>Generar</ThemedText>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={styles.signatureButton} onPress={handleScanFirmaResponsable} activeOpacity={0.85}>
                  <Ionicons name="qr-code" size={18} color="#FFFFFF" />
                  <ThemedText style={styles.signatureButtonText}>Escanear QR</ThemedText>
                </TouchableOpacity>
              </ThemedView>

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
                          <ThemedText style={styles.firmaInfoValue}>Hora: {info.timestamp || 'N/A'}</ThemedText>
                        </>
                      );
                    })()}
                  </ThemedView>
                  <TouchableOpacity style={styles.firmaClearButtonTiny} onPress={() => setFirmaResponsable('')} activeOpacity={0.85}>
                    <Ionicons name="trash" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </ThemedView>
              )}

              <View style={styles.rowButtons}>
                <TouchableOpacity style={[styles.secondaryButton, { backgroundColor: '#8E8E93' }]} onPress={() => setIsCreating(false)}>
                  <ThemedText style={styles.secondaryButtonText}>Cancelar</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.secondaryButton, { backgroundColor: '#007AFF' }]} onPress={handleCreate} disabled={isSubmitting}>
                  {isSubmitting ? <ActivityIndicator size="small" color="#fff" /> : <ThemedText style={styles.secondaryButtonText}>Guardar</ThemedText>}
                </TouchableOpacity>
              </View>
            </ThemedView>
          )}
        </ThemedView>
      </ScrollView>

      <Modal visible={isCompleteModalOpen} transparent animationType="fade" onRequestClose={() => setIsCompleteModalOpen(false)}>
        <View style={styles.overlay}>
          <ThemedView style={styles.floatCard}>
            <View style={styles.floatHeader}>
              <ThemedText style={styles.modalTitle}>Completar solicitud #{selectedRecord?.id}</ThemedText>
              <TouchableOpacity onPress={() => setIsCompleteModalOpen(false)}>
                <Ionicons name="close" size={22} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 560 }} contentContainerStyle={{ padding: 12 }}>
              <ThemedText style={styles.label}>Asignar reemplazo a todos</ThemedText>
              <View style={styles.inlineRow}>
                <TextInput
                  style={styles.codeInput}
                  placeholder="Código empleado"
                  placeholderTextColor="#999"
                  value={reemplazoObligatorioCode}
                  onChangeText={setReemplazoObligatorioCode}
                />
                <TouchableOpacity style={styles.inlineButton} onPress={handleAssignGlobalByCode}>
                  <ThemedText style={styles.inlineButtonText}>Buscar</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity style={styles.inlineButton} onPress={handleAssignGlobalByQR}>
                  <Ionicons name="qr-code" size={18} color="#fff" />
                </TouchableOpacity>
              </View>

              {turnosComplete.map((t) => (
                <View key={t.id} style={styles.turnoCard}>
                  <ThemedText style={styles.turnoText}>
                    Turno: #{t.id} | Cliente: {t.cliente || '-'} | Sucursal: {t.sucursal || '-'} | Puesto: {t.puesto || '-'}
                  </ThemedText>
                  <ThemedText style={styles.turnoText}>
                    Inicio: {t.hora_inicio || '-'} | Fin: {t.hora_fin || '-'} | Tipo: {t.tipo_turno || '-'} | Duración: {t.horas_duracion ?? '-'} h
                  </ThemedText>
                  <ThemedText style={styles.turnoText}>
                    Reemplazo:{' '}
                    <ThemedText style={[styles.turnoText, t.reemplazo_nombre ? styles.reemplazoAsignado : undefined]}>
                      {t.reemplazo_nombre || '-'}
                    </ThemedText>
                  </ThemedText>
                  {t.reemplazo_nombre ? (
                    <TouchableOpacity style={styles.removeReemplazoButton} onPress={() => handleRemoveReemplazoFromTurno(t.id)} activeOpacity={0.85}>
                      <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
                      <ThemedText style={styles.removeReemplazoButtonText}>Eliminar reemplazo</ThemedText>
                    </TouchableOpacity>
                  ) : (
                    <>
                      <ThemedText style={styles.labelSmall}>Asignar reemplazo</ThemedText>
                      <View style={styles.inlineRow}>
                        <TextInput
                          style={styles.codeInput}
                          placeholder="Código"
                          placeholderTextColor="#999"
                          value={byTurnoCode[t.id] || ''}
                          onChangeText={(txt) => setByTurnoCode((prev) => ({ ...prev, [t.id]: txt }))}
                        />
                        <TouchableOpacity style={styles.inlineButton} onPress={() => handleAssignTurnoByCode(t.id)}>
                          <ThemedText style={styles.inlineButtonText}>Buscar</ThemedText>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.inlineButton} onPress={() => handleAssignTurnoByQR(t.id)}>
                          <Ionicons name="qr-code" size={18} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </View>
              ))}

              <ThemedText style={styles.sectionTitle}>Firma digital ejecutivo *</ThemedText>
              <ThemedView style={styles.signatureButtons}>
                <TouchableOpacity
                  style={[styles.signatureButton, isGeneratingFirmaEjecutivo && styles.signatureButtonDisabled]}
                  onPress={handleGenerateFirmaEjecutivo}
                  disabled={isGeneratingFirmaEjecutivo}
                  activeOpacity={0.85}
                >
                  {isGeneratingFirmaEjecutivo ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="finger-print" size={18} color="#FFFFFF" />
                      <ThemedText style={styles.signatureButtonText}>Generar</ThemedText>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={styles.signatureButton} onPress={handleScanFirmaEjecutivo} activeOpacity={0.85}>
                  <Ionicons name="qr-code" size={18} color="#FFFFFF" />
                  <ThemedText style={styles.signatureButtonText}>Escanear QR</ThemedText>
                </TouchableOpacity>
              </ThemedView>

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
                          <ThemedText style={styles.firmaInfoValue}>Hora: {info.timestamp || 'N/A'}</ThemedText>
                        </>
                      );
                    })()}
                  </ThemedView>
                  <TouchableOpacity style={styles.firmaClearButtonTiny} onPress={() => setFirmaEjecutivoDigital('')} activeOpacity={0.85}>
                    <Ionicons name="trash" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </ThemedView>
              )}

              <TouchableOpacity style={styles.secondaryAction} onPress={openDrawModal}>
                <ThemedText style={styles.secondaryActionText}>
                  {firmaEjecutivoManual ? 'Firma manual lista (editar)' : 'Dibujar firma manual ejecutivo'}
                </ThemedText>
              </TouchableOpacity>

              {firmaEjecutivoManual ? (
                <View style={styles.firmaManualPreviewWrap}>
                  <ThemedText style={styles.labelSmall}>Vista previa de la firma manual</ThemedText>
                  <Image
                    source={{ uri: `data:image/png;base64,${firmaEjecutivoManual}` }}
                    style={styles.firmaManualPreviewImage}
                    resizeMode="contain"
                  />
                  <TouchableOpacity style={styles.removeReemplazoButton} onPress={() => setFirmaEjecutivoManual('')} activeOpacity={0.85}>
                    <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
                    <ThemedText style={styles.removeReemplazoButtonText}>Borrar firma manual</ThemedText>
                  </TouchableOpacity>
                </View>
              ) : null}

              <View style={styles.rowButtons}>
                <TouchableOpacity style={[styles.secondaryButton, { backgroundColor: '#8E8E93' }]} onPress={() => setIsCompleteModalOpen(false)}>
                  <ThemedText style={styles.secondaryButtonText}>Cancelar</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.secondaryButton, { backgroundColor: '#007AFF' }]} onPress={saveCompletion} disabled={isSavingComplete}>
                  {isSavingComplete ? <ActivityIndicator size="small" color="#fff" /> : <ThemedText style={styles.secondaryButtonText}>Guardar</ThemedText>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </ThemedView>
        </View>
      </Modal>

      <Modal visible={isDrawModalVisible} transparent animationType="fade" onRequestClose={() => setIsDrawModalVisible(false)}>
        <View style={styles.overlay}>
          <ThemedView style={styles.floatCard}>
            <View style={styles.floatHeader}>
              <ThemedText style={styles.modalTitle}>Firma manual ejecutivo</ThemedText>
              <TouchableOpacity onPress={() => setIsDrawModalVisible(false)}>
                <Ionicons name="close" size={22} color="#333" />
              </TouchableOpacity>
            </View>
            <View style={{ height: 280, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#E0E0E0' }}>
              <SignatureScreen
                ref={signatureRef}
                key={signatureKey}
                onOK={onManualSignatureRead}
                onEmpty={() => {
                  setIsReadingSignature(false);
                  Alert.alert('Error', 'La firma manual está vacía');
                }}
                autoClear={false}
                webStyle={SIGNATURE_WEB_STYLE}
                imageType="image/png"
              />
            </View>
            <View style={styles.rowButtonsModal}>
              <TouchableOpacity style={[styles.secondaryButton, { backgroundColor: '#8E8E93' }]} onPress={clearSignatureInModal}>
                <ThemedText style={styles.secondaryButtonText}>Limpiar</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.secondaryButton, { backgroundColor: '#007AFF' }]} onPress={acceptSignature} disabled={isReadingSignature}>
                {isReadingSignature ? <ActivityIndicator size="small" color="#fff" /> : <ThemedText style={styles.secondaryButtonText}>Guardar</ThemedText>}
              </TouchableOpacity>
            </View>
          </ThemedView>
        </View>
      </Modal>

      <AppFooter />
      <SlideMenu
        isVisible={isMenuVisible}
        onClose={() => setIsMenuVisible(false)}
        onHomePress={() => navigation.navigate('Home')}
        currentRoute="PermitRequest"
      />
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

  errorBox: { backgroundColor: '#FCE8E6', borderRadius: 8, padding: 12, marginBottom: 12 },
  errorText: { color: '#FF3B30', textAlign: 'center', marginBottom: 12, fontWeight: '700' },

  loadingContainer: { padding: 20, alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 14, color: '#000', opacity: 0.7 },
  emptyContainer: { padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 14, opacity: 0.6, textAlign: 'center', color: '#000' },

  createButton: { backgroundColor: '#007AFF', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginBottom: 16 },
  createButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  disabledButton: { opacity: 0.6 },

  listContainer: {},
  card: { backgroundColor: '#FFFFFF', borderRadius: 8, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  cardTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10, color: '#000' },
  cardLine: { marginBottom: 6, color: '#000' },
  cardLabel: { fontWeight: '700', color: '#333' },

  actionsRow: { marginTop: 12, flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  actionBtn: { minWidth: 150, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, gap: 8 },
  completeBtn: { backgroundColor: '#007AFF' },
  downloadBtn: { backgroundColor: '#34C759' },
  actionBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  rowButtons: { flexDirection: 'row', gap: 8, marginTop: 8 },
  secondaryButton: { flex: 1, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  secondaryButtonText: { color: '#fff', fontWeight: '700' },
  formCard: { marginTop: 12, backgroundColor: '#fff', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#E0E0E0', gap: 8 },
  sectionTitle: { marginTop: 14, fontSize: 15, fontWeight: '800', color: '#007AFF' },

  signatureButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, backgroundColor: '#fff', marginTop: 8 },
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
  signatureButtonDisabled: { backgroundColor: '#999' },
  signatureButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', marginLeft: 8 },
  signatureHintMuted: { marginTop: 6, color: '#999' },

  firmaInfoBox: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
  },
  firmaInfoTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8, color: '#333' },
  firmaInfoValue: { fontSize: 13, color: '#333', marginBottom: 4 },
  firmaClearButtonTiny: { width: 38, height: 38, borderRadius: 8, backgroundColor: '#FF3B30', alignItems: 'center', justifyContent: 'center' },

  label: { fontWeight: '700', fontSize: 13 },
  labelSmall: { fontWeight: '700', fontSize: 12, marginTop: 6 },
  pickerWrap: { borderWidth: 1, borderColor: '#DDD', borderRadius: 8, overflow: 'hidden' },
  dateBtn: { borderWidth: 1, borderColor: '#DDD', borderRadius: 8, padding: 12, backgroundColor: '#F7F7F7' },
  secondaryAction: { backgroundColor: '#0A84FF', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  secondaryActionText: { color: '#fff', fontWeight: '700' },
  warningText: { color: '#C62828', fontWeight: '700' },
  turnosBox: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, overflow: 'hidden' },
  turnoRow: { padding: 8, borderBottomWidth: 1, borderBottomColor: '#F0F0F0', backgroundColor: '#FAFAFA' },
  turnoText: { fontSize: 12 },
  reemplazoAsignado: { color: '#228B22', fontWeight: '600' },
  removeReemplazoButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#FF3B30', borderRadius: 8, alignSelf: 'flex-start', marginTop: 4 },
  removeReemplazoButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  firmaManualPreviewWrap: { marginTop: 12, padding: 10, borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, backgroundColor: '#FAFAFA' },
  firmaManualPreviewImage: { width: '100%', height: 140, marginTop: 6 },
  textArea: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    minHeight: 88,
    padding: 10,
    color: '#000',
    textAlignVertical: 'top',
  },
  fileText: { fontSize: 12, color: '#333' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  floatCard: { width: '100%', maxWidth: 820, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden' },
  floatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: { fontSize: 16, fontWeight: '800' },
  inlineRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 4, marginBottom: 8 },
  codeInput: { flex: 1, borderWidth: 1, borderColor: '#DDD', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: '#000' },
  inlineButton: { backgroundColor: '#007AFF', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, alignItems: 'center', justifyContent: 'center' },
  inlineButtonText: { color: '#fff', fontWeight: '700' },
  turnoCard: { borderWidth: 1, borderColor: '#E7E7E7', borderRadius: 8, padding: 8, marginBottom: 8, backgroundColor: '#FAFAFA' },
  plazasList: { gap: 10, marginTop: 6 },
  plazaCard: {
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#FAFAFA',
    position: 'relative',
  },
  plazaCardSelected: { borderColor: '#007AFF', backgroundColor: '#F0F7FF' },
  plazaCardTitle: { fontSize: 15, fontWeight: '800', marginBottom: 8, color: '#000' },
  plazaCardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#007AFF',
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  plazaCardBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  rowButtonsModal: { flexDirection: 'row', gap: 8, padding: 12 },
});
