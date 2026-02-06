import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Dimensions,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import SignatureScreen from 'react-native-signature-canvas';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import * as Location from 'expo-location';
import { jwtDecode } from 'jwt-decode';
import Constants from 'expo-constants';

import AppHeader from '@/components/AppHeader';
import AppFooter from '@/components/AppFooter';
import SlideMenu from '@/components/SlideMenu';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useAuth } from '@/contexts/AuthContext';
import { eventBus } from '@/hooks/eventBus';
import getHoraAccion from '@/hooks/getHoraAccion';
import { useQRScanner } from '@/hooks/useQRScanner';

import type { ExecutiveOption } from '@/hooks/incidentsTypes';
import { listExecutives } from '@/hooks/incidentsFunctions';
import { getExecutivesCache, setExecutivesCache } from '@/hooks/incidentsStorage';

import type { MutuoAcuerdo } from '@/hooks/mutuosAcuerdosTypes';
import { createMutuoAcuerdo, deleteMutuoAcuerdo, listMutuosAcuerdosByCorpo, signMutuoAcuerdoEjecutivo, updateMutuoAcuerdo } from '@/hooks/mutuosAcuerdosFunctions';
import { getMutuosAcuerdosCache, MUTUOS_ACUERDOS_ACTIONS_KEY, setMutuosAcuerdosCache } from '@/hooks/mutuosAcuerdosStorage';

import type { RootStackParamList } from '../App';

type Nav = NativeStackNavigationProp<RootStackParamList, 'MutuosAcuerdos'>;

type OficialInfoForm = {
  codigo: string;
  nombre: string;
  firma: string | null; // data url
  rol_normal: string;
  rol_cambio: string;
};

const TURNOS = ['Mañana', 'tarde', 'noche'] as const;

const safeJsonParse = <T,>(value: any, fallback: T): T => {
  try {
    if (!value) return fallback;
    if (typeof value === 'string') return JSON.parse(value) as T;
    return value as T;
  } catch {
    return fallback;
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

const formatSignatureForDisplay = (signature: string | null | undefined): string | null => {
  if (!signature) return null;
  const s = String(signature);
  if (s.startsWith('data:')) return s;
  return `data:image/png;base64,${s}`;
};

const dateToLocalString = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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

export default function MutuosAcuerdosScreen() {
  const navigation = useNavigation<Nav>();
  const { employee, refreshAccessToken, logout } = useAuth();
  const { scanQR, QRScannerComponent } = useQRScanner();

  const [isMenuVisible, setIsMenuVisible] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasCurrentMarca, setHasCurrentMarca] = useState(true);
  const [records, setRecords] = useState<MutuoAcuerdo[]>([]);

  // Modal: ver cambios (auditoría)
  const [isCambiosModalVisible, setIsCambiosModalVisible] = useState(false);
  const [cambiosTitle, setCambiosTitle] = useState<string>('Cambios');
  const [cambiosItems, setCambiosItems] = useState<any[]>([]);
  const [expandedCambioId, setExpandedCambioId] = useState<number | null>(null);

  // estructura
  const [marcaDivisionId, setMarcaDivisionId] = useState<number | null>(null);
  const [marcaCorpoId, setMarcaCorpoId] = useState<number | null>(null);
  const [marcaClienteId, setMarcaClienteId] = useState<number | null>(null);

  // ejecutivos
  const [executives, setExecutives] = useState<ExecutiveOption[]>([]);
  const [selectedEjecutivoCuenta, setSelectedEjecutivoCuenta] = useState<number | null>(null);

  // form
  const [isCreating, setIsCreating] = useState(false);
  const [editing, setEditing] = useState<{ id: number; id_local?: string } | null>(null);

  const [fecha, setFecha] = useState<Date>(new Date());
  const [showFechaPicker, setShowFechaPicker] = useState(false);
  const [turno, setTurno] = useState<(typeof TURNOS)[number] | ''>('');
  const [motivo, setMotivo] = useState('');

  const [oficialInteresado, setOficialInteresado] = useState<OficialInfoForm>({
    codigo: '',
    nombre: '',
    firma: null,
    rol_normal: '',
    rol_cambio: '',
  });
  const [oficialColaborador, setOficialColaborador] = useState<OficialInfoForm>({
    codigo: '',
    nombre: '',
    firma: null,
    rol_normal: '',
    rol_cambio: '',
  });

  // Sincronización cruzada de roles (sin recursividad)
  const isSyncingRolesRef = useRef(false);
  const updateInteresadoRolNormal = (v: string) => {
    if (isSyncingRolesRef.current) {
      setOficialInteresado((p) => ({ ...p, rol_normal: v }));
      return;
    }
    isSyncingRolesRef.current = true;
    setOficialInteresado((p) => ({ ...p, rol_normal: v }));
    setOficialColaborador((p) => ({ ...p, rol_cambio: v }));
    setTimeout(() => {
      isSyncingRolesRef.current = false;
    }, 0);
  };
  const updateInteresadoRolCambio = (v: string) => {
    if (isSyncingRolesRef.current) {
      setOficialInteresado((p) => ({ ...p, rol_cambio: v }));
      return;
    }
    isSyncingRolesRef.current = true;
    setOficialInteresado((p) => ({ ...p, rol_cambio: v }));
    setOficialColaborador((p) => ({ ...p, rol_normal: v }));
    setTimeout(() => {
      isSyncingRolesRef.current = false;
    }, 0);
  };
  const updateColaboradorRolNormal = (v: string) => {
    if (isSyncingRolesRef.current) {
      setOficialColaborador((p) => ({ ...p, rol_normal: v }));
      return;
    }
    isSyncingRolesRef.current = true;
    setOficialColaborador((p) => ({ ...p, rol_normal: v }));
    setOficialInteresado((p) => ({ ...p, rol_cambio: v }));
    setTimeout(() => {
      isSyncingRolesRef.current = false;
    }, 0);
  };
  const updateColaboradorRolCambio = (v: string) => {
    if (isSyncingRolesRef.current) {
      setOficialColaborador((p) => ({ ...p, rol_cambio: v }));
      return;
    }
    isSyncingRolesRef.current = true;
    setOficialColaborador((p) => ({ ...p, rol_cambio: v }));
    setOficialInteresado((p) => ({ ...p, rol_normal: v }));
    setTimeout(() => {
      isSyncingRolesRef.current = false;
    }, 0);
  };

  // firma responsable (QR)
  const [firmaResponsable, setFirmaResponsable] = useState('');
  const [isGeneratingFirmaResponsable, setIsGeneratingFirmaResponsable] = useState(false);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);

  // modal firmas dibujadas (interesado/colaborador/ejecutivo)
  const [signatureModalVisible, setSignatureModalVisible] = useState(false);
  const signatureRef = useRef<any>(null);
  const [signatureKey, setSignatureKey] = useState(0);
  const [signatureTarget, setSignatureTarget] = useState<'interesado' | 'colaborador' | 'ejecutivo' | null>(null);
  const [signingRecordKey, setSigningRecordKey] = useState<{ id: number; id_local?: string } | null>(null);
  const [isReadingSignature, setIsReadingSignature] = useState(false);

  const signatureWebStyle = `
    .m-signature-pad { box-shadow: none; border: none; }
    .m-signature-pad--body { border: 1px solid #E0E0E0; background: #FFFFFF; }
    .m-signature-pad--footer { display: none; margin: 0px; }
    body,html { width: 100%; height: 100%; }
    canvas { background: #FFFFFF; }
  `;

  const getConnectionStatus = async (): Promise<boolean> => {
    try {
      const state = await Network.getNetworkStateAsync();
      return !!(state.isConnected && state.isInternetReachable);
    } catch {
      return false;
    }
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

  const formatOficialInfoForDisplay = (oficialInfo: any): string => {
    if (!oficialInfo) return '';
    try {
      // Si viene como string JSON, parsearlo
      const info = typeof oficialInfo === 'string' ? JSON.parse(oficialInfo) : oficialInfo;

      // Puede ser un array [codigo, nombre, firma, rol_normal, rol_cambio] o un objeto
      if (Array.isArray(info)) {
        const partes: string[] = [];
        if (info[0]) partes.push(`Código: ${info[0]}`);
        if (info[1]) partes.push(`Nombre: ${info[1]}`);
        if (info[3]) partes.push(`Rol normal: ${info[3]}`);
        if (info[4]) partes.push(`Rol cambio: ${info[4]}`);
        return partes.length > 0 ? partes.join(' | ') : 'Sin información';
      }

      // Si es un objeto
      if (typeof info === 'object' && info !== null) {
        const partes: string[] = [];
        if (info.codigo) partes.push(`Código: ${info.codigo}`);
        if (info.nombre) partes.push(`Nombre: ${info.nombre}`);
        if (info.rol_normal) partes.push(`Rol normal: ${info.rol_normal}`);
        if (info.rol_cambio) partes.push(`Rol cambio: ${info.rol_cambio}`);
        return partes.length > 0 ? partes.join(' | ') : 'Sin información';
      }

      return String(oficialInfo);
    } catch {
      return String(oficialInfo);
    }
  };

  const formatChangeValue = (prop: string, value: any): string => {
    if (prop === 'informacion_oficial_interesado' || prop === 'informacion_oficial_colaborador') {
      return formatOficialInfoForDisplay(value);
    }
    if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
      try {
        if (Array.isArray(value)) {
          return JSON.stringify(value, null, 2);
        }
        const keys = Object.keys(value);
        if (keys.length > 0 && keys.length <= 5) {
          return keys.map(k => `${k}: ${value[k]}`).join(', ');
        }
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

      let token = await AsyncStorage.getItem('access_token');
      if (!token) {
        const refreshed = await refreshAccessToken();
        if (!refreshed) {
          if (logout) await logout();
          return;
        }
        token = await AsyncStorage.getItem('access_token');
      }
      if (!token) return;

      const doRequest = async (tk: string) =>
        fetch(`${apiUrl}/api/cambios-apps-modules?tabla=${encodeURIComponent(tabla)}&registro_id=${registroId}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${tk}`,
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': '69420',
          },
        });

      let resp = await doRequest(token);
      if (resp.status === 401) {
        const refreshed = await refreshAccessToken();
        if (!refreshed) {
          if (logout) await logout();
          return;
        }
        const nextToken = await AsyncStorage.getItem('access_token');
        if (!nextToken) return;
        resp = await doRequest(nextToken);
      }

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

  const loadMarcaContext = async () => {
    const currentMarcaStr = await AsyncStorage.getItem('current_marca');
    if (!currentMarcaStr) {
      setHasCurrentMarca(false);
      setMarcaDivisionId(null);
      setMarcaCorpoId(null);
      setMarcaClienteId(null);
      return null;
    }
    try {
      const current = JSON.parse(currentMarcaStr);
      if (!current) {
        setHasCurrentMarca(false);
        setMarcaDivisionId(null);
        setMarcaCorpoId(null);
        setMarcaClienteId(null);
        return null;
      }
      setHasCurrentMarca(true);
      const divIdRaw = current?.roleDivision?.division?.id;
      const corpoIdRaw = current?.corpo?.id ?? current?.corpo_id;
      const clienteIdRaw = current?.cliente?.id ?? current?.cliente_id;
      setMarcaDivisionId(divIdRaw !== undefined && divIdRaw !== null ? Number(divIdRaw) : null);
      setMarcaCorpoId(corpoIdRaw !== undefined && corpoIdRaw !== null ? Number(corpoIdRaw) : null);
      setMarcaClienteId(clienteIdRaw !== undefined && clienteIdRaw !== null ? Number(clienteIdRaw) : null);
      return current;
    } catch {
      setHasCurrentMarca(false);
      setMarcaDivisionId(null);
      setMarcaCorpoId(null);
      setMarcaClienteId(null);
      return null;
    }
  };


  const fetchExecutives = useCallback(async () => {
    try {
      const cached = await getExecutivesCache();
      if (cached) setExecutives(cached);

      const isConnected = await getConnectionStatus();
      if (!isConnected) return;

      const res = await listExecutives({ refreshAccessToken, logout });
      if (res.status && Array.isArray((res as any).executives)) {
        setExecutives((res as any).executives);
        await setExecutivesCache((res as any).executives);
      }
    } catch (e) {
      console.error('Error fetching executives:', e);
    }
  }, [refreshAccessToken, logout]);

  const fetchRecords = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const current = await loadMarcaContext();
      if (!current) {
        setIsLoading(false);
        return;
      }

      await fetchExecutives();

      const corpoIdRaw = current?.corpo?.id ?? current?.corpo_id;
      const corpoId = corpoIdRaw !== undefined && corpoIdRaw !== null ? Number(corpoIdRaw) : null;

      if (!corpoId) {
        setError('No se encontró el ID de la sucursal (corpo) en la marca actual');
        setIsLoading(false);
        return;
      }

      const corpoIdStr = String(corpoId);

      const localCache = (await getMutuosAcuerdosCache()) || [];
      // Filtrar cache local por corpo_id
      const filteredLocalCache = localCache.filter((r: any) => {
        const rCorpoId = Number(r?.corpo_id) || 0;
        return rCorpoId === corpoId;
      });
      const localOnly = filteredLocalCache.filter((r: any) => (r?.id === 0 || String(r?.id_local || '').startsWith('local-')));

      const isConnected = await getConnectionStatus();
      if (isConnected) {
        const res = await listMutuosAcuerdosByCorpo({ corpo_id: corpoIdStr, refreshAccessToken, logout });
        if (res.status) {
          const serverItems = Array.isArray(res.data) ? res.data : [];
          // Filtrar items del servidor por corpo_id (por si acaso)
          const filteredServerItems = serverItems.filter((r: any) => {
            const rCorpoId = Number(r?.corpo_id) || 0;
            return rCorpoId === corpoId;
          });
          const merged: MutuoAcuerdo[] = [
            ...localOnly.map((r: any) => ({ ...r, synced: false })),
            ...filteredServerItems.map((r: any) => ({ ...r, synced: true })),
          ];
          setRecords(merged);
          await setMutuosAcuerdosCache(merged);
        } else {
          setRecords(filteredLocalCache);
        }
      } else {
        setRecords(filteredLocalCache);
      }
    } catch (e: any) {
      console.error('Error fetching mutuos acuerdos:', e);
      setError(e?.message || 'Error al cargar mutuos acuerdos');
      const localCache = (await getMutuosAcuerdosCache()) || [];
      const current = await loadMarcaContext();
      const corpoIdRaw = current?.corpo?.id ?? current?.corpo_id;
      const corpoId = corpoIdRaw !== undefined && corpoIdRaw !== null ? Number(corpoIdRaw) : null;
      if (corpoId) {
        const filteredLocalCache = localCache.filter((r: any) => {
          const rCorpoId = Number(r?.corpo_id) || 0;
          return rCorpoId === corpoId;
        });
        setRecords(filteredLocalCache);
      } else {
        setRecords(localCache);
      }
    } finally {
      setIsLoading(false);
    }
  }, [fetchExecutives, refreshAccessToken, logout]);

  useFocusEffect(
    useCallback(() => {
      fetchRecords();
      const handler = () => fetchRecords();
      eventBus.on('connectionRestored', handler);
      return () => {
        eventBus.off('connectionRestored', handler);
      };
    }, [fetchRecords])
  );


  // ===== firma responsable =====
  const requestLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return null;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLocation(loc);
      return loc;
    } catch {
      return null;
    }
  };

  const handleGenerateFirmaResponsable = async () => {
    if (isGeneratingFirmaResponsable) return;
    setIsGeneratingFirmaResponsable(true);
    try {
      const loc = location ?? (await requestLocation());
      if (!loc || !employee) {
        Alert.alert('Error', 'No se pudo obtener ubicación o usuario');
        return;
      }
      const token = await AsyncStorage.getItem('access_token');
      if (!token) throw new Error('No authentication token found');
      const decodedToken: any = jwtDecode(token);
      const sessionId = decodedToken.sessionId;
      const timestamp = await getHoraAccion();
      const hash = btoa(`${sessionId}:${employee.id}:${loc.coords.latitude}:${loc.coords.longitude}:${timestamp}`);
      setFirmaResponsable(hash);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo generar la firma');
    } finally {
      setIsGeneratingFirmaResponsable(false);
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

  // ===== acciones offline =====
  const upsertAction = async (action: any) => {
    const actionsStr = await AsyncStorage.getItem(MUTUOS_ACUERDOS_ACTIONS_KEY);
    const actions = actionsStr ? JSON.parse(actionsStr) : [];
    actions.push(action);
    await AsyncStorage.setItem(MUTUOS_ACUERDOS_ACTIONS_KEY, JSON.stringify(actions));
  };

  const updateCreateActionForLocalId = async (localId: string, requestData: any) => {
    const actionsStr = await AsyncStorage.getItem(MUTUOS_ACUERDOS_ACTIONS_KEY);
    if (!actionsStr) return false;
    const actions = JSON.parse(actionsStr) || [];
    let updatedAny = false;
    const next = actions.map((a: any) => {
      if (a.type === 'create' && a.id === localId) {
        updatedAny = true;
        return { ...a, requestData };
      }
      return a;
    });
    if (updatedAny) {
      await AsyncStorage.setItem(MUTUOS_ACUERDOS_ACTIONS_KEY, JSON.stringify(next));
      return true;
    }
    return false;
  };

  const removeActionsForLocalId = async (localId: string) => {
    const actionsStr = await AsyncStorage.getItem(MUTUOS_ACUERDOS_ACTIONS_KEY);
    if (!actionsStr) return;
    const actions = JSON.parse(actionsStr) || [];
    const updated = actions.filter((a: any) => a.id !== localId);
    await AsyncStorage.setItem(MUTUOS_ACUERDOS_ACTIONS_KEY, JSON.stringify(updated));
  };

  // ===== modal firma =====
  const openSignatureModal = (target: 'interesado' | 'colaborador' | 'ejecutivo', record?: { id: number; id_local?: string }) => {
    setSignatureTarget(target);
    setSigningRecordKey(record ?? null);
    setIsReadingSignature(false);
    setSignatureKey((k) => k + 1);
    setSignatureModalVisible(true);
  };

  const closeSignatureModal = () => {
    setSignatureModalVisible(false);
    setSignatureTarget(null);
    setSigningRecordKey(null);
    setIsReadingSignature(false);
  };

  const clearSignatureInModal = () => {
    try {
      signatureRef.current?.clearSignature?.();
    } catch { }
    setIsReadingSignature(false);
    setSignatureKey((k) => k + 1);
  };

  const acceptSignature = () => {
    try {
      setIsReadingSignature(true);
      signatureRef.current?.readSignature?.();
    } catch {
      setIsReadingSignature(false);
      Alert.alert('Error', 'No se pudo leer la firma. Intenta nuevamente.');
    }
  };

  const handleSignatureRead = async (signature: string) => {
    const sig = String(signature || '').trim();
    if (!sig || sig.length < 10 || !signatureTarget) {
      Alert.alert('Error', 'No se detectó la firma. Intenta de nuevo.');
      setIsReadingSignature(false);
      return;
    }

    const formatted = sig.startsWith('data:') ? sig : `data:image/png;base64,${sig}`;

    if (signatureTarget === 'interesado') {
      setOficialInteresado((p) => ({ ...p, firma: formatted }));
      setIsReadingSignature(false);
      closeSignatureModal();
      return;
    }

    if (signatureTarget === 'colaborador') {
      setOficialColaborador((p) => ({ ...p, firma: formatted }));
      setIsReadingSignature(false);
      closeSignatureModal();
      return;
    }

    // ejecutivo: persistir en registro (online/offline)
    const targetRecord = signingRecordKey;
    if (!targetRecord) {
      setIsReadingSignature(false);
      closeSignatureModal();
      return;
    }

    try {
      const base64Only = getBase64Only(formatted);
      const isConnected = await getConnectionStatus();

      // Local record: actualizar cache + create action
      if (targetRecord.id === 0 || (targetRecord.id_local && String(targetRecord.id_local).startsWith('local-'))) {
        const cache = (await getMutuosAcuerdosCache()) || [];
        const updatedCache = cache.map((r: any) => {
          const match =
            (targetRecord.id_local && r.id_local === targetRecord.id_local) ||
            (!targetRecord.id_local && r.id === targetRecord.id);
          if (!match) return r;
          return { ...r, firma_ejecutivo_cuenta: base64Only, synced: false };
        });
        await setMutuosAcuerdosCache(updatedCache);
        setRecords(updatedCache);

        if (targetRecord.id_local) {
          const local = updatedCache.find((r: any) => r.id_local === targetRecord.id_local);
          const requestData = local
            ? {
              cliente_id: local.cliente_id,
              corpo_id: local.corpo_id,
              ejecutivo_cuenta: local.ejecutivo_cuenta,
              fecha: local.fecha,
              turno: local.turno,
              informacion_oficial_interesado: local.informacion_oficial_interesado,
              informacion_oficial_colaborador: local.informacion_oficial_colaborador,
              motivo: local.motivo,
              firma_responsable: local.firma_responsable,
              firma_ejecutivo_cuenta: base64Only,
            }
            : null;
          if (requestData) await updateCreateActionForLocalId(targetRecord.id_local, requestData);
        }
      } else if (isConnected) {
        const res = await signMutuoAcuerdoEjecutivo({
          id: targetRecord.id,
          firma_ejecutivo_cuenta: base64Only,
          refreshAccessToken,
          logout,
        });
        if (res.status) {
          Alert.alert('Éxito', 'Firma del ejecutivo guardada correctamente');
          await fetchRecords();
        } else {
          Alert.alert('Error', res.message || 'No se pudo guardar la firma');
        }
      } else {
        // offline: queue
        const cache = (await getMutuosAcuerdosCache()) || [];
        const updatedCache = cache.map((r: any) => (r.id === targetRecord.id ? { ...r, firma_ejecutivo_cuenta: base64Only, synced: false } : r));
        await setMutuosAcuerdosCache(updatedCache);
        setRecords(updatedCache);
        await upsertAction({ type: 'sign', id: targetRecord.id, firma_ejecutivo_cuenta: base64Only });
        Alert.alert('Guardado (offline)', 'La firma se sincronizará cuando vuelva la conexión.');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo guardar la firma');
    } finally {
      setIsReadingSignature(false);
      closeSignatureModal();
    }
  };

  const resetForm = () => {
    setSelectedEjecutivoCuenta(null);
    setFecha(new Date());
    setTurno('');
    setMotivo('');
    setOficialInteresado({ codigo: '', nombre: '', firma: null, rol_normal: '', rol_cambio: '' });
    setOficialColaborador({ codigo: '', nombre: '', firma: null, rol_normal: '', rol_cambio: '' });
    setFirmaResponsable('');
  };

  const startCreate = () => {
    setEditing(null);
    setIsCreating(true);
    resetForm();
  };

  const startEditing = (r: MutuoAcuerdo) => {
    setIsCreating(true);
    setEditing({ id: r.id, id_local: r.id_local });

    setSelectedEjecutivoCuenta(r.ejecutivo_cuenta || null);
    setFecha(r.fecha ? new Date(String(r.fecha)) : new Date());
    setTurno((r.turno as any) || '');
    setMotivo(r.motivo || '');

    const interesadoArr = safeJsonParse<string[]>(r.informacion_oficial_interesado, []);
    const colaboradorArr = safeJsonParse<string[]>(r.informacion_oficial_colaborador, []);
    setOficialInteresado({
      codigo: String(interesadoArr[0] || ''),
      nombre: String(interesadoArr[1] || ''),
      firma: formatSignatureForDisplay(interesadoArr[2] || null),
      rol_normal: String(interesadoArr[3] || ''),
      rol_cambio: String(interesadoArr[4] || ''),
    });
    setOficialColaborador({
      codigo: String(colaboradorArr[0] || ''),
      nombre: String(colaboradorArr[1] || ''),
      firma: formatSignatureForDisplay(colaboradorArr[2] || null),
      rol_normal: String(colaboradorArr[3] || ''),
      rol_cambio: String(colaboradorArr[4] || ''),
    });

    setFirmaResponsable(r.firma_responsable || '');
  };

  const cancelCreateOrEdit = () => {
    setIsCreating(false);
    setEditing(null);
    resetForm();
  };

  const validateForm = () => {
    if (!marcaClienteId || !marcaCorpoId) return 'No se encontró la información de cliente o sucursal en la marca actual';
    if (!marcaDivisionId) return 'No se pudo determinar la división (marca actual)';
    if (!selectedEjecutivoCuenta) return 'El ejecutivo de cuenta es obligatorio';
    if (!turno) return 'El turno es obligatorio';
    if (!motivo.trim()) return 'El motivo es obligatorio';
    if (!firmaResponsable.trim()) return 'La firma responsable es obligatoria';

    const requiredOficial = (label: string, o: OficialInfoForm) => {
      if (!o.codigo.trim()) return `Código requerido (${label})`;
      if (!o.nombre.trim()) return `Nombre requerido (${label})`;
      if (!o.firma) return `Firma requerida (${label})`;
      if (!o.rol_normal.trim()) return `Rol normal requerido (${label})`;
      if (!o.rol_cambio.trim()) return `Rol cambio requerido (${label})`;
      return null;
    };
    const e1 = requiredOficial('Oficial interesado', oficialInteresado);
    if (e1) return e1;
    const e2 = requiredOficial('Oficial colaborador', oficialColaborador);
    if (e2) return e2;

    return null;
  };

  const buildRequestData = () => {
    const interesadoArr = [
      oficialInteresado.codigo.trim(),
      oficialInteresado.nombre.trim(),
      getBase64Only(oficialInteresado.firma),
      oficialInteresado.rol_normal.trim(),
      oficialInteresado.rol_cambio.trim(),
    ];
    const colaboradorArr = [
      oficialColaborador.codigo.trim(),
      oficialColaborador.nombre.trim(),
      getBase64Only(oficialColaborador.firma),
      oficialColaborador.rol_normal.trim(),
      oficialColaborador.rol_cambio.trim(),
    ];
    return {
      cliente_id: marcaClienteId,
      corpo_id: marcaCorpoId,
      ejecutivo_cuenta: selectedEjecutivoCuenta,
      fecha: dateToLocalString(fecha),
      turno: turno,
      informacion_oficial_interesado: JSON.stringify(interesadoArr),
      informacion_oficial_colaborador: JSON.stringify(colaboradorArr),
      motivo: motivo.trim(),
      firma_responsable: firmaResponsable.trim(),
      // en creación va vacío, y se llenará luego con el modal si owned=true
      firma_ejecutivo_cuenta: '',
    };
  };

  const handleSave = async () => {
    if (!employee) return;
    const validationError = validateForm();
    if (validationError) {
      Alert.alert('Error', validationError);
      return;
    }

    const requestData = buildRequestData();
    const isConnected = await getConnectionStatus();

    // CREATE
    if (!editing) {
      if (isConnected) {
        const res = await createMutuoAcuerdo({ requestData, refreshAccessToken, logout });
        if (res.status) {
          Alert.alert('Éxito', 'Registro creado correctamente');
          cancelCreateOrEdit();
          await fetchRecords();
        } else {
          Alert.alert('Error', res.message || 'No se pudo crear el registro');
        }
        return;
      }

      const localId = `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const nowIso = new Date().toISOString();
      const exec = executives.find((e) => e.id === selectedEjecutivoCuenta) || null;
      const current = await loadMarcaContext();
      const clienteNombre = current?.cliente?.nombre ?? null;
      const corpoNombre = current?.corpo?.nombre ?? null;

      const localItem: MutuoAcuerdo = {
        id: 0,
        id_local: localId,
        cliente_id: requestData.cliente_id ?? 0,
        corpo_id: requestData.corpo_id ?? 0,
        ejecutivo_cuenta: requestData.ejecutivo_cuenta ?? 0,
        fecha: requestData.fecha,
        turno: requestData.turno,
        informacion_oficial_interesado: requestData.informacion_oficial_interesado,
        informacion_oficial_colaborador: requestData.informacion_oficial_colaborador,
        motivo: requestData.motivo,
        firma_ejecutivo_cuenta: '',
        firma_responsable: requestData.firma_responsable,
        created_at: nowIso,
        created_by: Number(employee.id) || 0,
        cliente_nombre: clienteNombre,
        corpo_nombre: corpoNombre,
        ejecutivo_nombre: (exec as any)?.nombre || null,
        owned: false,
        synced: false,
      };

      const next = [localItem, ...records];
      setRecords(next);
      await setMutuosAcuerdosCache(next);
      await upsertAction({ type: 'create', id: localId, requestData });
      Alert.alert('Guardado (offline)', 'El registro se sincronizará cuando vuelva la conexión.');
      cancelCreateOrEdit();
      return;
    }

    // UPDATE
    const isLocal = editing.id === 0 || (editing.id_local && String(editing.id_local).startsWith('local-'));
    if (isConnected && !isLocal) {
      const res = await updateMutuoAcuerdo({ id: editing.id, requestData: { ...requestData, firma_ejecutivo_cuenta: undefined }, refreshAccessToken, logout });
      if (res.status) {
        Alert.alert('Éxito', 'Registro actualizado correctamente');
        cancelCreateOrEdit();
        await fetchRecords();
      } else {
        // fallback offline
        const cache = (await getMutuosAcuerdosCache()) || [];
        const updatedCache = cache.map((r: any) => (r.id === editing.id ? { ...r, ...requestData, synced: false } : r));
        await setMutuosAcuerdosCache(updatedCache);
        setRecords(updatedCache);
        await upsertAction({ type: 'update', id: editing.id, requestData });
        Alert.alert('Actualizado (offline)', 'El servidor no está disponible. Se sincronizará al recuperar conexión.');
        cancelCreateOrEdit();
      }
      return;
    }

    // offline update (incluye local)
    {
      const cache = (await getMutuosAcuerdosCache()) || [];
      const updatedCache = cache.map((r: any) => {
        const match =
          (editing.id_local && r.id_local === editing.id_local) ||
          (!editing.id_local && r.id === editing.id);
        if (!match) return r;
        return { ...r, ...requestData, synced: false };
      });
      await setMutuosAcuerdosCache(updatedCache);
      setRecords(updatedCache);

      if (editing.id_local) {
        const updated = await updateCreateActionForLocalId(editing.id_local, {
          ...requestData,
          firma_ejecutivo_cuenta: (updatedCache.find((r: any) => r.id_local === editing.id_local) as any)?.firma_ejecutivo_cuenta || '',
        });
        if (!updated) await upsertAction({ type: 'create', id: editing.id_local, requestData });
      } else {
        await upsertAction({ type: 'update', id: editing.id, requestData });
      }

      Alert.alert('Guardado (offline)', 'Los cambios se sincronizarán cuando vuelva la conexión.');
      cancelCreateOrEdit();
    }
  };

  const handleDelete = async (r: MutuoAcuerdo) => {
    Alert.alert('Confirmar', '¿Deseas eliminar este registro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            const isConnected = await getConnectionStatus();
            const isLocal = r.id === 0 || (r.id_local && String(r.id_local).startsWith('local-'));

            if (isLocal) {
              const cache = (await getMutuosAcuerdosCache()) || [];
              const updatedCache = cache.filter((x: any) => x.id_local !== r.id_local);
              await setMutuosAcuerdosCache(updatedCache);
              setRecords(updatedCache);
              if (r.id_local) await removeActionsForLocalId(r.id_local);
              return;
            }

            if (isConnected) {
              const res = await deleteMutuoAcuerdo({ id: r.id, refreshAccessToken, logout });
              if (res.status) {
                Alert.alert('Éxito', 'Registro eliminado');
                await fetchRecords();
                return;
              }
            }

            // offline delete
            const cache = (await getMutuosAcuerdosCache()) || [];
            const updatedCache = cache.filter((x: any) => x.id !== r.id);
            await setMutuosAcuerdosCache(updatedCache);
            setRecords(updatedCache);
            await upsertAction({ type: 'delete', id: r.id });
            Alert.alert('Eliminado (offline)', 'Se sincronizará cuando vuelva la conexión.');
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'No se pudo eliminar');
          }
        },
      },
    ]);
  };

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpanded = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Collapsable interno: firma del ejecutivo por registro
  const [expandedFirmaEjecutivoByKey, setExpandedFirmaEjecutivoByKey] = useState<Record<string, boolean>>({});

  const renderRecord = (r: MutuoAcuerdo, idx: number) => {
    const key = r.id !== 0 ? `ma-${r.id}` : r.id_local ? `ma-${r.id_local}` : `ma-${idx}`;
    const isExpanded = expanded.has(key);
    const fechaTxt = r.fecha ? String(r.fecha).split('T')[0] : '';
    const firmaInfo = decodeFirmaHash(r.firma_responsable);
    const firmaEjecutivoUri = formatSignatureForDisplay(r.firma_ejecutivo_cuenta);

    const interesado = safeJsonParse<string[]>(r.informacion_oficial_interesado, []);
    const colaborador = safeJsonParse<string[]>(r.informacion_oficial_colaborador, []);
    const interesadoSig = formatSignatureForDisplay(interesado[2] || null);
    const colaboradorSig = formatSignatureForDisplay(colaborador[2] || null);

    return (
      <ThemedView key={key} style={styles.card}>
        <ThemedText style={styles.cardTitle}>
          {r.corpo_nombre || `Sucursal ${r.corpo_id}`}
          {r.id_local ? ' (offline)' : ''}
        </ThemedText>

        <ThemedText style={styles.cardLine}>
          <ThemedText style={styles.cardLabel}>Fecha/Turno: </ThemedText>
          <ThemedText style={styles.cardValue}>{fechaTxt} - {r.turno || '-'}</ThemedText>
        </ThemedText>
        <ThemedText style={styles.cardLine}>
          <ThemedText style={styles.cardLabel}>Ejecutivo: </ThemedText>
          <ThemedText style={styles.cardValue}>{r.ejecutivo_nombre || String(r.ejecutivo_cuenta || '-')}</ThemedText>
        </ThemedText>

        <TouchableOpacity style={styles.collapseButton} onPress={() => toggleExpanded(key)} activeOpacity={0.85}>
          <ThemedText style={styles.collapseButtonText}>{isExpanded ? 'Ocultar detalles' : 'Ver detalles'}</ThemedText>
          <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color="#007AFF" />
        </TouchableOpacity>

        {isExpanded && (
          <ThemedView style={styles.collapseContent}>
            <ThemedText style={styles.sectionTitle}>Motivo</ThemedText>
            <ThemedText style={styles.detailText}>{r.motivo || '—'}</ThemedText>

            <ThemedText style={styles.sectionTitle}>Oficial interesado</ThemedText>
            <ThemedText style={styles.detailText}>Código: {interesado[0] || '—'}</ThemedText>
            <ThemedText style={styles.detailText}>Nombre: {interesado[1] || '—'}</ThemedText>
            <ThemedText style={styles.detailText}>Rol normal: {interesado[3] || '—'}</ThemedText>
            <ThemedText style={styles.detailText}>Rol cambio: {interesado[4] || '—'}</ThemedText>
            {interesadoSig ? <Image source={{ uri: interesadoSig }} style={styles.signaturePreview} resizeMode="contain" /> : null}

            <ThemedText style={styles.sectionTitle}>Oficial colaborador</ThemedText>
            <ThemedText style={styles.detailText}>Código: {colaborador[0] || '—'}</ThemedText>
            <ThemedText style={styles.detailText}>Nombre: {colaborador[1] || '—'}</ThemedText>
            <ThemedText style={styles.detailText}>Rol normal: {colaborador[3] || '—'}</ThemedText>
            <ThemedText style={styles.detailText}>Rol cambio: {colaborador[4] || '—'}</ThemedText>
            {colaboradorSig ? <Image source={{ uri: colaboradorSig }} style={styles.signaturePreview} resizeMode="contain" /> : null}

            <ThemedText style={styles.sectionTitle}>Firma responsable (QR)</ThemedText>
            {!r.firma_responsable ? (
              <ThemedText style={styles.muted}>—</ThemedText>
            ) : !firmaInfo ? (
              <ThemedText style={styles.muted}>Formato no decodificable</ThemedText>
            ) : (
              <>
                <ThemedText style={styles.detailText}>Sesión: {firmaInfo.sessionId}</ThemedText>
                <ThemedText style={styles.detailText}>Empleado: {firmaInfo.empleadoId}</ThemedText>
                <ThemedText style={styles.detailText}>Lat/Lng: {firmaInfo.latitud}, {firmaInfo.longitud}</ThemedText>
                <ThemedText style={styles.detailText}>Hora: {firmaInfo.timestamp}</ThemedText>
              </>
            )}

            <ThemedText style={styles.sectionTitle}>Firma ejecutivo de cuenta</ThemedText>
            {!firmaEjecutivoUri ? (
              <ThemedText style={styles.muted}>Pendiente</ThemedText>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.innerCollapseButton}
                  onPress={() => setExpandedFirmaEjecutivoByKey((prev) => ({ ...prev, [key]: !prev[key] }))}
                  activeOpacity={0.85}
                >
                  <ThemedText style={styles.innerCollapseButtonText}>
                    {expandedFirmaEjecutivoByKey[key] ? 'Ocultar firma' : 'Ver firma'}
                  </ThemedText>
                  <Ionicons name={expandedFirmaEjecutivoByKey[key] ? 'chevron-up' : 'chevron-down'} size={18} color="#007AFF" />
                </TouchableOpacity>
                {expandedFirmaEjecutivoByKey[key] && (
                  <ThemedView style={styles.innerCollapseContent}>
                    <Image source={{ uri: firmaEjecutivoUri }} style={styles.signaturePreview} resizeMode="contain" />
                  </ThemedView>
                )}
              </>
            )}
          </ThemedView>
        )}

        <ThemedView style={styles.actionsRow}>
          <TouchableOpacity style={[styles.actionBtn, styles.editBtn]} onPress={() => startEditing(r)} activeOpacity={0.85}>
            <Ionicons name="pencil" size={18} color="#FFFFFF" />
            <ThemedText style={styles.actionBtnText}>Editar</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.changesBtn]}
            onPress={() => {
              if (r.id_local || r.id === 0) {
                Alert.alert('Sin conexión', 'Este registro es local/offline. Los cambios solo se pueden consultar en el servidor.');
                return;
              }
              setCambiosTitle(`Cambios - Mutuo Acuerdo #${r.id}`);
              fetchCambios('e_mutuos_acuerdos', r.id);
            }}
            activeOpacity={0.85}
          >
            <Ionicons name="list-outline" size={18} color="#FFFFFF" />
            <ThemedText style={styles.actionBtnText}>Cambios</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={() => handleDelete(r)} activeOpacity={0.85}>
            <Ionicons name="trash" size={18} color="#FFFFFF" />
            <ThemedText style={styles.actionBtnText}>Eliminar</ThemedText>
          </TouchableOpacity>
        </ThemedView>

        {true && (
          <ThemedView style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.signBtn]}
              onPress={() => openSignatureModal('ejecutivo', { id: r.id, id_local: r.id_local })}
              activeOpacity={0.85}
            >
              <Ionicons name="create-outline" size={18} color="#FFFFFF" />
              <ThemedText style={styles.actionBtnText}>{r.firma_ejecutivo_cuenta ? 'Re-firmar ejecutivo' : 'Firmar como ejecutivo'}</ThemedText>
            </TouchableOpacity>
          </ThemedView>
        )}
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
            <ThemedText style={styles.subtitle}>Registro con firmas (offline + sync)</ThemedText>
          </ThemedView>

          {!hasCurrentMarca ? (
            <ThemedView style={styles.emptyContainer}>
              <ThemedText style={styles.errorText}>Debes tener una marca activa para usar este módulo.</ThemedText>
            </ThemedView>
          ) : null}

          {!isCreating && (
            <TouchableOpacity style={styles.createButton} onPress={startCreate} activeOpacity={0.85}>
              <ThemedText style={styles.createButtonText}>
                <Ionicons name="add" size={20} color="#FFFFFF" /> Nuevo registro
              </ThemedText>
            </TouchableOpacity>
          )}

          {isCreating && (
            <ThemedView style={styles.formCard}>
              <ThemedText style={styles.formTitle}>{editing ? 'Editar registro' : 'Nuevo registro'}</ThemedText>

              <ThemedText style={styles.sectionTitle}>Datos</ThemedText>

              <ThemedText style={styles.label}>Ejecutivo de cuenta *</ThemedText>
              <ThemedView style={styles.pickerWrapper}>
                <Picker
                  selectedValue={selectedEjecutivoCuenta ?? 0}
                  onValueChange={(v) => setSelectedEjecutivoCuenta(Number(v) || null)}
                  style={styles.picker}
                >
                  <Picker.Item label="Seleccione ejecutivo..." value={0} />
                  {executives.map((e: any) => (
                    <Picker.Item key={e.id} label={e.nombre} value={e.id} />
                  ))}
                </Picker>
              </ThemedView>

              <ThemedText style={styles.label}>Fecha *</ThemedText>
              <TouchableOpacity style={styles.dateButton} onPress={() => setShowFechaPicker(true)} activeOpacity={0.85}>
                <ThemedText style={styles.dateButtonText}>{dateToLocalString(fecha)}</ThemedText>
                <Ionicons name="calendar-outline" size={18} color="#007AFF" />
              </TouchableOpacity>
              {showFechaPicker && (
                <DateTimePicker
                  value={fecha}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_, d) => {
                    setShowFechaPicker(false);
                    if (d) setFecha(d);
                  }}
                />
              )}

              <ThemedText style={styles.label}>Turno *</ThemedText>
              <ThemedView style={styles.pickerWrapper}>
                <Picker selectedValue={turno} onValueChange={(v) => setTurno(String(v) as any)} style={styles.picker}>
                  <Picker.Item label="Seleccione turno..." value="" />
                  {TURNOS.map((t) => (
                    <Picker.Item key={t} label={t} value={t} />
                  ))}
                </Picker>
              </ThemedView>

              <ThemedText style={styles.sectionTitle}>Información oficial interesado</ThemedText>
              <ThemedText style={styles.label}>Código *</ThemedText>
              <TextInput style={styles.input} value={oficialInteresado.codigo} onChangeText={(t) => setOficialInteresado((p) => ({ ...p, codigo: t }))} placeholder="Código" placeholderTextColor="#999" />
              <ThemedText style={styles.label}>Nombre *</ThemedText>
              <TextInput style={styles.input} value={oficialInteresado.nombre} onChangeText={(t) => setOficialInteresado((p) => ({ ...p, nombre: t }))} placeholder="Nombre" placeholderTextColor="#999" />
              <ThemedText style={styles.label}>Firma *</ThemedText>
              {oficialInteresado.firma ? <Image source={{ uri: oficialInteresado.firma }} style={styles.signaturePreview} resizeMode="contain" /> : null}
              <TouchableOpacity style={styles.signatureButton} onPress={() => openSignatureModal('interesado')} activeOpacity={0.85}>
                <Ionicons name="create-outline" size={18} color="#007AFF" />
                <ThemedText style={styles.signatureButtonText}>{oficialInteresado.firma ? 'Editar firma' : 'Agregar firma'}</ThemedText>
              </TouchableOpacity>
              <ThemedText style={styles.label}>Rol normal *</ThemedText>
              <TextInput style={styles.input} value={oficialInteresado.rol_normal} onChangeText={updateInteresadoRolNormal} placeholder="Rol normal" placeholderTextColor="#999" />
              <ThemedText style={styles.label}>Rol cambio *</ThemedText>
              <TextInput style={styles.input} value={oficialInteresado.rol_cambio} onChangeText={updateInteresadoRolCambio} placeholder="Rol cambio" placeholderTextColor="#999" />

              <ThemedText style={styles.sectionTitle}>Información oficial colaborador</ThemedText>
              <ThemedText style={styles.label}>Código *</ThemedText>
              <TextInput style={styles.input} value={oficialColaborador.codigo} onChangeText={(t) => setOficialColaborador((p) => ({ ...p, codigo: t }))} placeholder="Código" placeholderTextColor="#999" />
              <ThemedText style={styles.label}>Nombre *</ThemedText>
              <TextInput style={styles.input} value={oficialColaborador.nombre} onChangeText={(t) => setOficialColaborador((p) => ({ ...p, nombre: t }))} placeholder="Nombre" placeholderTextColor="#999" />
              <ThemedText style={styles.label}>Firma *</ThemedText>
              {oficialColaborador.firma ? <Image source={{ uri: oficialColaborador.firma }} style={styles.signaturePreview} resizeMode="contain" /> : null}
              <TouchableOpacity style={styles.signatureButton} onPress={() => openSignatureModal('colaborador')} activeOpacity={0.85}>
                <Ionicons name="create-outline" size={18} color="#007AFF" />
                <ThemedText style={styles.signatureButtonText}>{oficialColaborador.firma ? 'Editar firma' : 'Agregar firma'}</ThemedText>
              </TouchableOpacity>
              <ThemedText style={styles.label}>Rol normal *</ThemedText>
              <TextInput style={styles.input} value={oficialColaborador.rol_normal} onChangeText={updateColaboradorRolNormal} placeholder="Rol normal" placeholderTextColor="#999" />
              <ThemedText style={styles.label}>Rol cambio *</ThemedText>
              <TextInput style={styles.input} value={oficialColaborador.rol_cambio} onChangeText={updateColaboradorRolCambio} placeholder="Rol cambio" placeholderTextColor="#999" />

              <ThemedText style={styles.sectionTitle}>Motivo *</ThemedText>
              <TextInput style={[styles.input, styles.textArea]} value={motivo} onChangeText={setMotivo} placeholder="Motivo" placeholderTextColor="#999" multiline />

              <ThemedText style={styles.sectionTitle}>Firma responsable *</ThemedText>
              <ThemedView style={styles.signatureButtonsRow}>
                <TouchableOpacity style={[styles.signatureBlueButton, isGeneratingFirmaResponsable && styles.signatureDisabled]} onPress={handleGenerateFirmaResponsable} disabled={isGeneratingFirmaResponsable} activeOpacity={0.85}>
                  {isGeneratingFirmaResponsable ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="finger-print" size={18} color="#FFFFFF" />}
                  <ThemedText style={styles.signatureBlueButtonText}>{isGeneratingFirmaResponsable ? 'Generando...' : 'Generar'}</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity style={styles.signatureBlueButton} onPress={handleScanFirmaResponsable} activeOpacity={0.85}>
                  <Ionicons name="qr-code" size={18} color="#FFFFFF" />
                  <ThemedText style={styles.signatureBlueButtonText}>Escanear QR</ThemedText>
                </TouchableOpacity>
              </ThemedView>

              {firmaResponsable ? (
                <ThemedView style={styles.firmaInfoBox}>
                  <ThemedView style={styles.firmaInfoHeader}>
                    <ThemedText style={styles.firmaInfoTitle}>Firma registrada</ThemedText>
                    <TouchableOpacity onPress={() => setFirmaResponsable('')} style={styles.firmaTinyTrash} activeOpacity={0.85}>
                      <Ionicons name="trash" size={16} color="#FF3B30" />
                    </TouchableOpacity>
                  </ThemedView>
                  {(() => {
                    const info = decodeFirmaHash(firmaResponsable);
                    if (!info) return <ThemedText style={styles.muted}>QR sin información decodificable.</ThemedText>;
                    return (
                      <>
                        <ThemedText style={styles.firmaInfoText}>Sesión: {info.sessionId}</ThemedText>
                        <ThemedText style={styles.firmaInfoText}>Empleado: {info.empleadoId}</ThemedText>
                        <ThemedText style={styles.firmaInfoText}>Lat/Lng: {info.latitud}, {info.longitud}</ThemedText>
                        <ThemedText style={styles.firmaInfoText}>Hora: {info.timestamp}</ThemedText>
                      </>
                    );
                  })()}
                </ThemedView>
              ) : (
                <ThemedText style={styles.muted}>Aún no hay firma responsable.</ThemedText>
              )}

              <ThemedView style={styles.formActions}>
                <TouchableOpacity style={[styles.formActionBtn, styles.cancelBtn]} onPress={cancelCreateOrEdit} activeOpacity={0.85}>
                  <Ionicons name="close" size={18} color="#000" />
                  <ThemedText style={styles.cancelBtnText}>Cancelar</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.formActionBtn, styles.saveBtn]} onPress={handleSave} activeOpacity={0.85}>
                  <Ionicons name="save" size={18} color="#fff" />
                  <ThemedText style={styles.saveBtnText}>Guardar</ThemedText>
                </TouchableOpacity>
              </ThemedView>
            </ThemedView>
          )}

          {!isCreating && (
            <>
              {isLoading ? (
                <ThemedView style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#007AFF" />
                  <ThemedText style={styles.loadingText}>Cargando...</ThemedText>
                </ThemedView>
              ) : records.length === 0 ? (
                <ThemedView style={styles.emptyContainer}>
                  <ThemedText style={styles.emptyText}>No hay registros</ThemedText>
                </ThemedView>
              ) : (
                <ThemedView style={styles.listContainer}>
                  {records.map(renderRecord)}
                </ThemedView>
              )}
            </>
          )}
        </ThemedView>
      </ScrollView>

      {/* Modal firma (bootstrap-like) */}
      <Modal
        visible={signatureModalVisible}
        animationType="fade"
        transparent
        presentationStyle="overFullScreen"
        onRequestClose={closeSignatureModal}
      >
        <View style={styles.overlay}>
          <ThemedView style={styles.modalCard}>
            <ThemedView style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>
                {signatureTarget === 'interesado'
                  ? 'Firma oficial interesado'
                  : signatureTarget === 'colaborador'
                    ? 'Firma oficial colaborador'
                    : 'Firma ejecutivo de cuenta'}
              </ThemedText>
              <TouchableOpacity onPress={closeSignatureModal} activeOpacity={0.85}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </ThemedView>

            <ThemedText style={styles.modalHint}>Firma dentro del recuadro blanco.</ThemedText>

            <View style={styles.signaturePadBox}>
              <SignatureScreen
                ref={signatureRef}
                onOK={handleSignatureRead}
                onEmpty={() => {
                  setIsReadingSignature(false);
                  Alert.alert('Error', 'La firma está vacía');
                }}
                descriptionText=""
                clearText=""
                confirmText=""
                webStyle={signatureWebStyle}
                key={signatureKey}
              />
            </View>

            <ThemedView style={styles.modalActions}>
              <TouchableOpacity style={styles.modalClearBtn} onPress={clearSignatureInModal} activeOpacity={0.85}>
                <Ionicons name="trash" size={20} color="#000000" />
                <ThemedText style={styles.modalClearBtnText}>Limpiar</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalAcceptBtn, isReadingSignature && { opacity: 0.7 }]}
                onPress={acceptSignature}
                disabled={isReadingSignature}
                activeOpacity={0.85}
              >
                {isReadingSignature ? <ActivityIndicator size="small" color="#000000" /> : <Ionicons name="checkmark" size={20} color="#000000" />}
                <ThemedText style={styles.modalAcceptBtnText}>Aceptar</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          </ThemedView>
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
                                const value = formatChangeValue(propName, c?.after);

                                return (
                                  <ThemedText key={`c-${row.id}-${idx}`} style={styles.changeDescription}>
                                    <ThemedText style={{ fontWeight: '800' }}>{propName}: </ThemedText>
                                    {value}
                                  </ThemedText>
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
      <SlideMenu isVisible={isMenuVisible} onClose={() => setIsMenuVisible(false)} onHomePress={() => navigation.navigate('Home')} currentRoute="MutuosAcuerdos" />
      {QRScannerComponent}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },
  content: { width: '100%', maxWidth: 800, alignSelf: 'center' },

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

  formCard: { marginTop: 12, backgroundColor: '#fff', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#E0E0E0' },
  formTitle: { fontSize: 18, fontWeight: '800', marginBottom: 10, color: '#000' },
  label: { fontSize: 13, fontWeight: '700', marginTop: 10, color: '#333' },
  input: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, backgroundColor: '#fff', color: '#000', marginBottom: 6 },
  textArea: { minHeight: 90, textAlignVertical: 'top' as any },
  pickerWrapper: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, overflow: 'hidden', backgroundColor: '#FFFFFF', justifyContent: 'center' },
  picker: { height: 54, width: '100%', color: '#000' },
  dateButton: { marginBottom: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, backgroundColor: '#fff' },
  dateButtonText: { color: '#000', fontWeight: '700' },

  sectionTitle: { marginTop: 14, fontSize: 15, fontWeight: '800', color: '#007AFF' },
  muted: { marginTop: 6, color: '#999' },

  signatureButton: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#007AFF', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 12, backgroundColor: '#FFFFFF', marginBottom: 10 },
  signatureButtonText: { color: '#007AFF', fontWeight: '700' },
  signaturePreview: { width: '100%', height: 140, backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#E0E0E0', marginTop: 10, marginBottom: 10 },

  signatureButtonsRow: { flexDirection: 'row', gap: 10, marginTop: 10, flexWrap: 'wrap' },
  signatureBlueButton: { flex: 1, minWidth: '45%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#007AFF', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 10, gap: 8 },
  signatureBlueButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  signatureDisabled: { opacity: 0.6 },

  firmaInfoBox: { marginTop: 10, borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10, padding: 12, backgroundColor: '#FFFFFF' },
  firmaInfoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  firmaInfoTitle: { fontSize: 14, fontWeight: '800', color: '#000000' },
  firmaTinyTrash: { padding: 4 },
  firmaInfoText: { fontSize: 13, color: '#000000', opacity: 0.8, marginBottom: 4 },

  formActions: { marginTop: 16, flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  formActionBtn: { flex: 1, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12 },
  cancelBtn: { backgroundColor: '#EDEDED' },
  cancelBtnText: { color: '#000', fontWeight: '800' },
  saveBtn: { backgroundColor: '#007AFF' },
  saveBtnText: { color: '#fff', fontWeight: '800' },

  listContainer: {},
  card: { backgroundColor: '#FFFFFF', borderRadius: 8, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  cardTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10, color: '#000' },
  cardLine: { marginBottom: 6, color: '#000' },
  cardLabel: { fontWeight: '700', color: '#333' },
  cardValue: { color: '#000' },
  collapseButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E0E0E0', marginTop: 8, backgroundColor: '#FAFAFA' },
  collapseButtonText: { fontSize: 13, fontWeight: '700', color: '#007AFF' },
  collapseContent: { marginTop: 8, padding: 10, borderRadius: 8, backgroundColor: '#F8F9FA' },
  detailText: { marginBottom: 6, color: '#000' },

  // Collapsable interno (firma ejecutivo)
  innerCollapseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginTop: 8,
    backgroundColor: '#FFFFFF',
  },
  innerCollapseButtonText: { fontSize: 13, fontWeight: '700', color: '#007AFF' },
  innerCollapseContent: { marginTop: 8, padding: 10, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0E0E0' },

  actionsRow: { marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 8, gap: 8 },
  editBtn: { backgroundColor: '#007AFF' },
  deleteBtn: { backgroundColor: '#FF3B30' },
  signBtn: { backgroundColor: '#34C759' },
  actionBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  inlineLoading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  inlineLoadingText: { fontSize: 14, color: '#000', opacity: 0.7 },

  // modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modalCard: { width: '100%', maxWidth: 520, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0E0E0', overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E0E0E0', backgroundColor: '#F8F9FA' },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#000' },
  modalHint: { paddingHorizontal: 16, paddingTop: 12, color: '#666', fontSize: 13 },
  signaturePadBox: { marginTop: 10, marginHorizontal: 16, height: 260, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#E0E0E0', borderRadius: 12, overflow: 'hidden' },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, gap: 12, backgroundColor: '#FFFFFF' },
  modalClearBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10, backgroundColor: '#EDEDED', gap: 8 },
  modalClearBtnText: { fontWeight: '800', color: '#000' },
  modalAcceptBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10, backgroundColor: '#D7F5E5', gap: 8 },
  modalAcceptBtnText: { fontWeight: '800', color: '#000' },
  changesBtn: { backgroundColor: '#5856D6', flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 8, gap: 8 },
  floatModalCardMovimientos: { backgroundColor: '#FFFFFF', borderRadius: 12, width: '100%', maxWidth: 500, maxHeight: '80%', borderWidth: 1, borderColor: '#E0E0E0', overflow: 'hidden' },
  floatModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  cambioCollapsableMain: { width: '100%', marginBottom: 10, backgroundColor: '#fff', borderRadius: 6, borderWidth: 1, borderColor: '#E0E0E0', overflow: 'hidden' },
  cambioCollapsableHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#F8F9FA' },
  cambioCollapsableTitle: { fontSize: 14, fontWeight: '600', color: '#007AFF', flex: 1 },
  cambioCollapsableContent: { padding: 12, gap: 8, backgroundColor: '#F8F9FA' },
  changeDescription: { fontSize: 14, lineHeight: 20, color: '#666', marginBottom: 8 },
  filterGroupSearch: { marginBottom: 12 },
  filterLabel: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 4 },
});


