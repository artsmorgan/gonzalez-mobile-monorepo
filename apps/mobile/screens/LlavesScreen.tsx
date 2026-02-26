import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Platform, Modal, View, Image, Dimensions } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import * as Location from 'expo-location';
import DateTimePicker from '@react-native-community/datetimepicker';
import { jwtDecode } from 'jwt-decode';
import Ionicons from '@expo/vector-icons/Ionicons';
import SignatureScreen from 'react-native-signature-canvas';
import Constants from 'expo-constants';

import AppHeader from '../components/AppHeader';
import AppFooter from '../components/AppFooter';
import SlideMenu from '../components/SlideMenu';
import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import { useAuth } from '../contexts/AuthContext';
import { eventBus } from '../hooks/eventBus';
import getHoraAccion from '../hooks/getHoraAccion';
import { useQRScanner } from '../hooks/useQRScanner';
import authedFetch from '../hooks/authedFetch';
import { createLlave, deleteLlave, listLlaves, LlaveItem, updateLlave } from '../hooks/llavesFunctions';
import { createMovimientoLlave, deleteMovimientoLlave, updateMovimientoLlave } from '../hooks/movimientosLlavesFunctions';
import { createLlavero, deleteLlavero, listLlaveros, LlaveroItem, updateLlavero } from '../hooks/llaverosFunctions';
import { createMovimientoLlavero, deleteMovimientoLlavero, updateMovimientoLlavero } from '../hooks/movimientosLlaverosFunctions';

type LlaveUI = LlaveItem & { id_local?: string };
type MovimientoUI = {
  id: number;
  id_local?: string;
  llave_id: number;
  llaveLocalId?: string;
  nombre_persona_recibe: string;
  nombre_persona_entrega: string;
  departamento: string;
  telefono: string;
  fecha: string;
  hora: string;
  firma_entrega: string;
  firma_recibe: string;
  firma_responsable: string;
};

type LlaveroUI = LlaveroItem & { id_local?: string };
type MovimientoLlaveroUI = {
  id: number;
  id_local?: string;
  llavero_id: number;
  llaveroLocalId?: string;
  nombre_persona_recibe: string;
  nombre_persona_entrega: string;
  departamento: string;
  telefono: string;
  fecha: string;
  hora: string;
  firma_entrega: string;
  firma_recibe: string;
  firma_responsable: string;
};

export default function LlavesScreen() {
  const navigation = useNavigation<any>();
  const { employee, refreshAccessToken, logout } = useAuth();
  const { scanQR, QRScannerComponent } = useQRScanner();

  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const handleMenuPress = () => setIsMenuVisible(true);
  const handleMenuClose = () => setIsMenuVisible(false);
  const handleHomePress = () => navigation.navigate('Home');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasCurrentMarca, setHasCurrentMarca] = useState(true);
  const [marcaId, setMarcaId] = useState<number | null>(null);

  const [llaves, setLlaves] = useState<LlaveUI[]>([]);

  // Tab selector: Llaves / Llaveros
  const [activeTab, setActiveTab] = useState<'llaves' | 'llaveros'>('llaves');

  // Submódulo: Llaveros
  const [llaveros, setLlaveros] = useState<LlaveroUI[]>([]);
  const [isLlaveroCreating, setIsLlaveroCreating] = useState(false);
  const [llaveroEditing, setLlaveroEditing] = useState<LlaveroUI | null>(null);
  const [llaveroNombre, setLlaveroNombre] = useState('');
  const [llaveroObservaciones, setLlaveroObservaciones] = useState('');
  const [llaveroFirmaResponsable, setLlaveroFirmaResponsable] = useState('');
  const [llaveroSelectedLlaves, setLlaveroSelectedLlaves] = useState<number[]>([]);
  const [isLlaveroLlavesExpanded, setIsLlaveroLlavesExpanded] = useState(false);
  const [isGeneratingLlaveroFirma, setIsGeneratingLlaveroFirma] = useState(false);
  const [llaveroFilterSearch, setLlaveroFilterSearch] = useState('');
  const [llaveroFilterFecha, setLlaveroFilterFecha] = useState('');
  const [showLlaveroFilterFechaPicker, setShowLlaveroFilterFechaPicker] = useState(false);
  const [isLlaveroFiltersExpanded, setIsLlaveroFiltersExpanded] = useState(false);

  // Submódulo: Movimiento de llaveros (CRUD dentro de modal)
  const [isLlaveroMovModalVisible, setIsLlaveroMovModalVisible] = useState(false);
  const [movLlavero, setMovLlavero] = useState<LlaveroUI | null>(null);
  const [llaveroMovimientos, setLlaveroMovimientos] = useState<MovimientoLlaveroUI[]>([]);
  const [llaveroMovIsCreating, setLlaveroMovIsCreating] = useState(false);
  const [llaveroMovEditing, setLlaveroMovEditing] = useState<MovimientoLlaveroUI | null>(null);
  const [llaveroMovFilterSearch, setLlaveroMovFilterSearch] = useState('');
  const [llaveroMovFilterFecha, setLlaveroMovFilterFecha] = useState('');
  const [showLlaveroMovFilterFechaPicker, setShowLlaveroMovFilterFechaPicker] = useState(false);
  const [isLlaveroMovFiltersExpanded, setIsLlaveroMovFiltersExpanded] = useState(false);
  const [llaveroMovNombreRecibe, setLlaveroMovNombreRecibe] = useState('');
  const [llaveroMovNombreEntrega, setLlaveroMovNombreEntrega] = useState('');
  const [llaveroMovDepartamento, setLlaveroMovDepartamento] = useState('');
  const [llaveroMovTelefono, setLlaveroMovTelefono] = useState('');
  const [llaveroMovFecha, setLlaveroMovFecha] = useState('');
  const [llaveroMovHora, setLlaveroMovHora] = useState('');
  const [showLlaveroMovFechaPicker, setShowLlaveroMovFechaPicker] = useState(false);
  const [showLlaveroMovHoraPicker, setShowLlaveroMovHoraPicker] = useState(false);
  const [llaveroMovFirmaEntrega, setLlaveroMovFirmaEntrega] = useState('');
  const [llaveroMovFirmaRecibe, setLlaveroMovFirmaRecibe] = useState('');
  const [llaveroMovFirmaResponsable, setLlaveroMovFirmaResponsable] = useState('');
  const [isGeneratingLlaveroMovFirma, setIsGeneratingLlaveroMovFirma] = useState(false);

  // Submódulo: Movimiento de llaves (CRUD dentro de modal)
  const [isMovModalVisible, setIsMovModalVisible] = useState(false);
  const [movLlave, setMovLlave] = useState<LlaveUI | null>(null);
  const [movimientos, setMovimientos] = useState<MovimientoUI[]>([]);
  const [movIsCreating, setMovIsCreating] = useState(false);
  const [movEditing, setMovEditing] = useState<MovimientoUI | null>(null);

  const [movFilterSearch, setMovFilterSearch] = useState('');
  const [movFilterFecha, setMovFilterFecha] = useState('');
  const [showMovFilterFechaPicker, setShowMovFilterFechaPicker] = useState(false);
  const [isMovFiltersExpanded, setIsMovFiltersExpanded] = useState(false);

  const [movNombreRecibe, setMovNombreRecibe] = useState('');
  const [movNombreEntrega, setMovNombreEntrega] = useState('');
  const [movDepartamento, setMovDepartamento] = useState('');
  const [movTelefono, setMovTelefono] = useState('');
  const [movFecha, setMovFecha] = useState('');
  const [movHora, setMovHora] = useState('');
  const [showMovFechaPicker, setShowMovFechaPicker] = useState(false);
  const [showMovHoraPicker, setShowMovHoraPicker] = useState(false);

  const [movFirmaEntrega, setMovFirmaEntrega] = useState('');
  const [movFirmaRecibe, setMovFirmaRecibe] = useState('');
  const [movFirmaResponsable, setMovFirmaResponsable] = useState('');
  const [isGeneratingMovFirma, setIsGeneratingMovFirma] = useState(false);

  // Modal firma dibujada (entrega/recibe)
  const [isDrawSignatureModalVisible, setIsDrawSignatureModalVisible] = useState(false);
  const [drawSignatureTarget, setDrawSignatureTarget] = useState<'entrega' | 'recibe'>('entrega');
  const signatureRef = useRef<any>(null);
  const [signatureKey, setSignatureKey] = useState(0);
  const [isReadingSignature, setIsReadingSignature] = useState(false);

  // Modal: ver cambios (auditoría)
  const [isCambiosModalVisible, setIsCambiosModalVisible] = useState(false);
  const [cambiosTitle, setCambiosTitle] = useState<string>('Cambios');
  const [cambiosItems, setCambiosItems] = useState<any[]>([]);
  const [expandedCambioId, setExpandedCambioId] = useState<number | null>(null);

  // UI: filtros (collapsable)
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  const [filterSearch, setFilterSearch] = useState('');
  const [filterFecha, setFilterFecha] = useState('');
  const [showFilterFechaPicker, setShowFilterFechaPicker] = useState(false);

  // UI: create/edit
  const [isCreating, setIsCreating] = useState(false);
  const [editing, setEditing] = useState<LlaveUI | null>(null);
  const [lugarAbre, setLugarAbre] = useState('');
  const [cantidadCopias, setCantidadCopias] = useState<string>('1');
  const [observaciones, setObservaciones] = useState('');
  const [firmaResponsable, setFirmaResponsable] = useState('');

  const [isGeneratingFirma, setIsGeneratingFirma] = useState(false);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResponse, setSubmitResponse] = useState<{ type: 'success' | 'error', message: string } | null>(null);

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

  const dateToLocalString = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const formatYMDToDMY = (value?: string): string => {
    const v = String(value || '').trim();
    if (!v) return '';
    const onlyDate = v.split('T')[0];
    const ymd = onlyDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (ymd) return `${ymd[3]}-${ymd[2]}-${ymd[1]}`;
    const dmy = onlyDate.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (dmy) return `${dmy[1]}-${dmy[2]}-${dmy[3]}`;
    return onlyDate;
  };

  const parseDateStringToDate = (value?: string): Date => {
    const v = String(value || '').trim();
    if (!v) return new Date();
    const onlyDate = v.split('T')[0];
    const ymd = onlyDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (ymd) return new Date(`${onlyDate}T00:00:00`);
    const dmy = onlyDate.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (dmy) return new Date(`${dmy[3]}-${dmy[2]}-${dmy[1]}T00:00:00`);
    const parsed = new Date(v);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  };

  const timeToHHMMSS = (d: Date): string => {
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  };

  const getConnectionStatus = async (): Promise<boolean> => {
    const state = await Network.getNetworkStateAsync();
    return !!(state.isConnected && state.isInternetReachable);
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

  const formatChangeValue = (prop: string, value: any): string => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
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

  const loadMarcaContext = async () => {
    const currentMarcaStr = await AsyncStorage.getItem('current_marca');
    if (!currentMarcaStr) {
      setHasCurrentMarca(false);
      return null;
    }
    const current = JSON.parse(currentMarcaStr);
    if (!current?.id) {
      setHasCurrentMarca(false);
      return null;
    }
    setHasCurrentMarca(true);
    setMarcaId(current.id);
    return current;
  };

  const fetchLlaves = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const current = await loadMarcaContext();
      if (!current) {
        setIsLoading(false);
        return;
      }

      const isConnected = await getConnectionStatus();
      if (isConnected) {
        const res = await listLlaves({
          marcaId: current.id,
          refreshAccessToken,
          logout,
        });
        if (res.status) {
          const list = (res.data || []).map((it: any) => ({
            ...it,
            id_local: it.id_local || '',
            movimientos: (it.movimientos || []).map((m: any) => ({ ...m, id_local: m.id_local || '' })),
          }));
          setLlaves(list);
          await AsyncStorage.setItem('llaves_cache', JSON.stringify(list));
        } else {
          setError(res.message || 'Error al cargar llaves');
          const cacheStr = await AsyncStorage.getItem('llaves_cache');
          if (cacheStr) setLlaves(JSON.parse(cacheStr));
        }
      } else {
        const cacheStr = await AsyncStorage.getItem('llaves_cache');
        if (cacheStr) setLlaves(JSON.parse(cacheStr));
      }
    } catch (e: any) {
      setError(e.message || 'Error al cargar llaves');
      const cacheStr = await AsyncStorage.getItem('llaves_cache');
      if (cacheStr) setLlaves(JSON.parse(cacheStr));
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLlaveros = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const current = await loadMarcaContext();
      if (!current) {
        setIsLoading(false);
        return;
      }

      const isConnected = await getConnectionStatus();
      if (isConnected) {
        const res = await listLlaveros({
          marcaId: current.id,
          refreshAccessToken,
          logout,
        });
        if (res.status) {
          const list = (res.data || []).map((it: any) => ({
            ...it,
            id_local: it.id_local || '',
            movimientos: (it.movimientos || []).map((m: any) => ({ ...m, id_local: m.id_local || '' })),
            llaves: (it.llaves || []).map((l: any) => ({ ...l })),
          }));
          setLlaveros(list);
          await AsyncStorage.setItem('llaveros_cache', JSON.stringify(list));
        } else {
          setError(res.message || 'Error al cargar llaveros');
          const cacheStr = await AsyncStorage.getItem('llaveros_cache');
          if (cacheStr) setLlaveros(JSON.parse(cacheStr));
        }
      } else {
        const cacheStr = await AsyncStorage.getItem('llaveros_cache');
        if (cacheStr) setLlaveros(JSON.parse(cacheStr));
      }
    } catch (e: any) {
      setError(e.message || 'Error al cargar llaveros');
      const cacheStr = await AsyncStorage.getItem('llaveros_cache');
      if (cacheStr) setLlaveros(JSON.parse(cacheStr));
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (activeTab === 'llaves') {
        fetchLlaves();
      } else {
        fetchLlaveros();
      }
    }, [activeTab])
  );

  useEffect(() => {
    const handler = () => {
      if (activeTab === 'llaves') {
        fetchLlaves();
      } else {
        fetchLlaveros();
      }
    };
    eventBus.on('connectionRestored', handler);
    return () => {
      eventBus.off('connectionRestored', handler);
    };
  }, [activeTab]);

  // Sincronizar movimientos de llaveros cuando cambie la lista principal
  useEffect(() => {
    if (!isLlaveroMovModalVisible || !movLlavero) return;
    const found = llaveros.find((it) => {
      if (movLlavero.id && movLlavero.id !== 0) return it.id === movLlavero.id;
      if (movLlavero.id_local) return it.id_local === movLlavero.id_local;
      return false;
    });
    if (found) {
      setMovLlavero(found);
      setLlaveroMovimientos((found as any).movimientos || []);
    }
  }, [llaveros, isLlaveroMovModalVisible, movLlavero?.id, movLlavero?.id_local]);

  // Si el modal de movimientos está abierto, mantenerlo sincronizado cuando cambie la lista principal (online/offline)
  useEffect(() => {
    if (!isMovModalVisible || !movLlave) return;
    const found = llaves.find((it) => {
      if (movLlave.id && movLlave.id !== 0) return it.id === movLlave.id;
      if (movLlave.id_local) return it.id_local === movLlave.id_local;
      return false;
    });
    if (found) {
      setMovLlave(found);
      setMovimientos((found as any).movimientos || []);
    }
  }, [llaves, isMovModalVisible, movLlave?.id, movLlave?.id_local]);

  const resetForm = () => {
    setLugarAbre('');
    setCantidadCopias('1');
    setObservaciones('');
    setFirmaResponsable('');
  };

  const startCreating = () => {
    resetForm();
    setEditing(null);
    setIsCreating(true);
  };

  const startEditing = (it: LlaveUI) => {
    setEditing(it);
    setIsCreating(true);
    setLugarAbre(it.lugar_abre || '');
    setCantidadCopias(String(it.cantidad_copias ?? 1));
    setObservaciones(it.observaciones || '');
    setFirmaResponsable(it.firma_responsable || '');
  };

  const cancelCreating = () => {
    setIsCreating(false);
    setEditing(null);
  };

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
    if (isGeneratingFirma) return;
    setIsGeneratingFirma(true);
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
      const horaAccion = await getHoraAccion();
      const hash = btoa(`${sessionId}:${employee.id}:${loc.coords.latitude}:${loc.coords.longitude}:${horaAccion}`);
      setFirmaResponsable(hash);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'No se pudo generar la firma');
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

  const validateForm = () => {
    if (!lugarAbre || lugarAbre.trim().length === 0) {
      Alert.alert('Error', 'Campo requerido: Lugar que abre');
      return false;
    }
    const n = parseInt(String(cantidadCopias), 10);
    if (isNaN(n) || n < 0) {
      Alert.alert('Error', 'Cantidad de copias inválida');
      return false;
    }
    if (!firmaResponsable) {
      Alert.alert('Error', 'Debes registrar la firma responsable');
      return false;
    }
    return true;
  };

  const buildPayload = async () => {
    const current = await loadMarcaContext();
    if (!current?.id) throw new Error('Marca no encontrada');
    return {
      marca_id: current.id,
      lugar_abre: lugarAbre,
      cantidad_copias: parseInt(String(cantidadCopias), 10) || 0,
      observaciones: observaciones ?? '',
      firma_responsable: firmaResponsable,
    };
  };

  const upsertAction = async (action: any) => {
    const actionsStr = await AsyncStorage.getItem('llaves_actions');
    const actions = actionsStr ? JSON.parse(actionsStr) : [];
    actions.push(action);
    await AsyncStorage.setItem('llaves_actions', JSON.stringify(actions));
  };

  const removeActionsForLocalId = async (localId: string) => {
    const actionsStr = await AsyncStorage.getItem('llaves_actions');
    if (!actionsStr) return;
    const actions = JSON.parse(actionsStr) || [];
    const updated = actions.filter((a: any) => a.id !== localId);
    await AsyncStorage.setItem('llaves_actions', JSON.stringify(updated));
  };

  const updateCreateActionForLocalId = async (localId: string, requestData: any) => {
    const actionsStr = await AsyncStorage.getItem('llaves_actions');
    if (!actionsStr) return false;
    const actions = JSON.parse(actionsStr) || [];
    let updatedAny = false;
    const updated = actions.map((a: any) => {
      if (a.type === 'create' && a.id === localId) {
        updatedAny = true;
        return { ...a, requestData };
      }
      return a;
    });
    if (updatedAny) {
      await AsyncStorage.setItem('llaves_actions', JSON.stringify(updated));
      return true;
    }
    return false;
  };

  // ============================
  // Movimiento de llaves (offline + CRUD en modal)
  // ============================
  const resetMovForm = () => {
    setMovNombreRecibe('');
    setMovNombreEntrega('');
    setMovDepartamento('');
    setMovTelefono('');
    setMovFecha('');
    setMovHora('');
    setMovFirmaEntrega('');
    setMovFirmaRecibe('');
    setMovFirmaResponsable('');
    setMovEditing(null);
  };

  const upsertMovAction = async (action: any) => {
    const actionsStr = await AsyncStorage.getItem('movimientos_llaves_actions');
    const actions = actionsStr ? JSON.parse(actionsStr) : [];
    actions.push(action);
    await AsyncStorage.setItem('movimientos_llaves_actions', JSON.stringify(actions));
  };

  const removeMovActionsForLocalId = async (localId: string) => {
    const actionsStr = await AsyncStorage.getItem('movimientos_llaves_actions');
    if (!actionsStr) return;
    const actions = JSON.parse(actionsStr) || [];
    const updated = actions.filter((a: any) => a.id !== localId);
    await AsyncStorage.setItem('movimientos_llaves_actions', JSON.stringify(updated));
  };

  const updateMovCreateActionForLocalId = async (localId: string, requestData: any) => {
    const actionsStr = await AsyncStorage.getItem('movimientos_llaves_actions');
    if (!actionsStr) return false;
    const actions = JSON.parse(actionsStr) || [];
    let updatedAny = false;
    const updated = actions.map((a: any) => {
      if (a.type === 'create' && a.id === localId) {
        updatedAny = true;
        return { ...a, requestData };
      }
      return a;
    });
    if (updatedAny) {
      await AsyncStorage.setItem('movimientos_llaves_actions', JSON.stringify(updated));
      return true;
    }
    return false;
  };

  const validateMovForm = () => {
    const required = [
      { label: 'Nombre persona que entrega', v: movNombreEntrega },
      { label: 'Nombre persona que recibe', v: movNombreRecibe },
      { label: 'Departamento', v: movDepartamento },
      { label: 'Teléfono', v: movTelefono },
      { label: 'Fecha', v: movFecha },
      { label: 'Hora', v: movHora },
    ];
    const missing = required.find((x) => !x.v || String(x.v).trim().length === 0);
    if (missing) {
      Alert.alert('Error', `Campo requerido: ${missing.label}`);
      return false;
    }
    if (!movFirmaEntrega) {
      Alert.alert('Error', 'Debes registrar la firma de entrega');
      return false;
    }
    if (!movFirmaRecibe) {
      Alert.alert('Error', 'Debes registrar la firma de recibe');
      return false;
    }
    if (!movFirmaResponsable) {
      Alert.alert('Error', 'Debes registrar la firma responsable');
      return false;
    }
    return true;
  };

  const buildMovPayload = async () => {
    const current = await loadMarcaContext();
    if (!current?.id) throw new Error('Marca no encontrada');
    return {
      marca_id: current.id,
      nombre_persona_recibe: movNombreRecibe,
      nombre_persona_entrega: movNombreEntrega,
      departamento: movDepartamento,
      telefono: movTelefono,
      fecha: movFecha,
      hora: movHora,
      firma_entrega: movFirmaEntrega,
      firma_recibe: movFirmaRecibe,
      firma_responsable: movFirmaResponsable,
    };
  };

  const handleGenerateMovFirmaResponsable = async () => {
    if (isGeneratingMovFirma) return;
    setIsGeneratingMovFirma(true);
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
      const horaAccion = await getHoraAccion();
      const hash = btoa(`${sessionId}:${employee.id}:${loc.coords.latitude}:${loc.coords.longitude}:${horaAccion}`);
      setMovFirmaResponsable(hash);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'No se pudo generar la firma');
    } finally {
      setIsGeneratingMovFirma(false);
    }
  };

  const handleScanMovFirmaResponsable = async () => {
    try {
      const qrData = await scanQR();
      if (!qrData) return;
      setMovFirmaResponsable(qrData);
    } catch {
      Alert.alert('Error', 'No se pudo escanear el QR');
    }
  };

  const openMovimientosModal = (it: LlaveUI) => {
    setMovLlave(it);
    const list = (it.movimientos || []).map((m: any) => ({ ...m, id_local: m.id_local || '' }));
    setMovimientos(list);
    setMovIsCreating(false);
    setMovEditing(null);
    resetMovForm();
    setMovFilterSearch('');
    setMovFilterFecha('');
    setIsMovModalVisible(true);
  };

  const closeMovimientosModal = () => {
    setIsMovModalVisible(false);
    setMovLlave(null);
    setMovimientos([]);
    setMovIsCreating(false);
    setMovEditing(null);
    resetMovForm();
    setIsMovFiltersExpanded(false);
  };

  const startMovCreating = () => {
    resetMovForm();
    setMovIsCreating(true);
    setMovEditing(null);
    setMovFecha(dateToLocalString(new Date()));
    setMovHora(timeToHHMMSS(new Date()));
  };

  const startMovEditing = (m: MovimientoUI) => {
    setMovEditing(m);
    setMovIsCreating(true);
    setMovNombreRecibe(m.nombre_persona_recibe || '');
    setMovNombreEntrega(m.nombre_persona_entrega || '');
    setMovDepartamento(m.departamento || '');
    setMovTelefono(m.telefono || '');
    setMovFecha(m.fecha ? String(m.fecha).split('T')[0] : '');
    const horaStr = String(m.hora || '');
    setMovHora(horaStr.includes('T') ? horaStr.split('T')[1]?.split('.')[0] || '' : horaStr);
    setMovFirmaEntrega(m.firma_entrega || '');
    setMovFirmaRecibe(m.firma_recibe || '');
    setMovFirmaResponsable(m.firma_responsable || '');
  };

  const cancelMovCreating = () => {
    setMovIsCreating(false);
    setMovEditing(null);
    resetMovForm();
  };

  const persistMovimientosToLlavesCache = async (llave: LlaveUI, nextMovs: MovimientoUI[]) => {
    const nextLlaves = llaves.map((it) => {
      const match = (llave.id_local && it.id_local === llave.id_local) || (!llave.id_local && it.id === llave.id);
      if (!match) return it;
      return { ...it, movimientos: nextMovs };
    });
    setLlaves(nextLlaves);
    await AsyncStorage.setItem('llaves_cache', JSON.stringify(nextLlaves));

    setMovimientos(nextMovs);
    setMovLlave((prev) => (prev ? { ...prev, movimientos: nextMovs } : prev));
  };

  const handleMovSave = async () => {
    if (!employee) return;
    if (!movLlave) return;
    if (!validateMovForm()) return;

    const payload = await buildMovPayload();
    const isConnected = await getConnectionStatus();

    // create
    if (!movEditing) {
      if (isConnected && movLlave.id && movLlave.id !== 0) {
        const res = await createMovimientoLlave({ llaveId: movLlave.id, requestData: payload, refreshAccessToken, logout });
        if (res.status) {
          Alert.alert('Éxito', 'Movimiento creado correctamente');
          setMovIsCreating(false);
          await fetchLlaves();
        } else {
          Alert.alert('Error', res.message || 'No se pudo crear el movimiento');
        }
      } else {
        const localId = `local-mov-${Date.now()}`;
        const localItem: MovimientoUI = {
          id: 0,
          id_local: localId,
          llave_id: movLlave.id || 0,
          llaveLocalId: movLlave.id_local || '',
          nombre_persona_recibe: payload.nombre_persona_recibe,
          nombre_persona_entrega: payload.nombre_persona_entrega,
          departamento: payload.departamento,
          telefono: payload.telefono,
          fecha: payload.fecha,
          hora: payload.hora,
          firma_entrega: payload.firma_entrega,
          firma_recibe: payload.firma_recibe,
          firma_responsable: payload.firma_responsable,
        };
        const next = [localItem, ...movimientos];
        await persistMovimientosToLlavesCache(movLlave, next);
        await upsertMovAction({
          type: 'create',
          id: localId,
          llaveId: movLlave.id || 0,
          llaveLocalId: movLlave.id_local || '',
          requestData: payload,
        });
        Alert.alert('Guardado (offline)', 'El movimiento se sincronizará cuando vuelva la conexión.');
        setMovIsCreating(false);
      }
      return;
    }

    // update
    const isLocalMov = !!movEditing.id_local || movEditing.id === 0;
    if (isConnected && !isLocalMov && movLlave.id && movLlave.id !== 0) {
      const res = await updateMovimientoLlave({
        llaveId: movLlave.id,
        id: movEditing.id,
        requestData: payload,
        refreshAccessToken,
        logout,
      });
      if (res.status) {
        Alert.alert('Éxito', 'Movimiento actualizado correctamente');
        setMovIsCreating(false);
        setMovEditing(null);
        await fetchLlaves();
      } else {
        Alert.alert('Error', res.message || 'No se pudo actualizar el movimiento');
      }
    } else {
      const next = movimientos.map((m) => {
        const match = (movEditing.id_local && m.id_local === movEditing.id_local) || (!movEditing.id_local && m.id === movEditing.id);
        if (!match) return m;
        return {
          ...m,
          nombre_persona_recibe: payload.nombre_persona_recibe,
          nombre_persona_entrega: payload.nombre_persona_entrega,
          departamento: payload.departamento,
          telefono: payload.telefono,
          fecha: payload.fecha,
          hora: payload.hora,
          firma_entrega: payload.firma_entrega,
          firma_recibe: payload.firma_recibe,
          firma_responsable: payload.firma_responsable,
        };
      });
      await persistMovimientosToLlavesCache(movLlave, next);

      if (movEditing.id_local) {
        const updated = await updateMovCreateActionForLocalId(movEditing.id_local, payload);
        if (!updated) {
          await upsertMovAction({
            type: 'create',
            id: movEditing.id_local,
            llaveId: movLlave.id || 0,
            llaveLocalId: movLlave.id_local || '',
            requestData: payload,
          });
        }
      } else {
        await upsertMovAction({
          type: 'update',
          id: movEditing.id,
          llaveId: movLlave.id || 0,
          llaveLocalId: movLlave.id_local || '',
          requestData: payload,
        });
      }

      Alert.alert('Guardado (offline)', 'Los cambios se sincronizarán cuando vuelva la conexión.');
      setMovIsCreating(false);
      setMovEditing(null);
    }
  };

  const handleMovDelete = async (m: MovimientoUI) => {
    const current = await loadMarcaContext();
    if (!current?.id) return;
    if (!movLlave) return;

    Alert.alert('Confirmar', '¿Deseas eliminar este movimiento?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          const isConnected = await getConnectionStatus();

          if (m.id_local || m.id === 0) {
            const next = movimientos.filter((x) => x.id_local !== m.id_local);
            await persistMovimientosToLlavesCache(movLlave, next);
            if (m.id_local) await removeMovActionsForLocalId(m.id_local);
            return;
          }

          if (isConnected && movLlave.id && movLlave.id !== 0) {
            const res = await deleteMovimientoLlave({
              llaveId: movLlave.id,
              id: m.id,
              marcaId: current.id,
              refreshAccessToken,
              logout,
            });
            if (res.status) {
              Alert.alert('Éxito', 'Movimiento eliminado correctamente');
              await fetchLlaves();
            } else {
              Alert.alert('Error', res.message || 'No se pudo eliminar el movimiento');
            }
          } else {
            const next = movimientos.filter((x) => x.id !== m.id);
            await persistMovimientosToLlavesCache(movLlave, next);
            await upsertMovAction({
              type: 'delete',
              id: m.id,
              llaveId: movLlave.id || 0,
              llaveLocalId: movLlave.id_local || '',
              marcaId: current.id,
            });
            Alert.alert('Eliminado (offline)', 'La eliminación se sincronizará cuando vuelva la conexión.');
          }
        },
      },
    ]);
  };

  const openDrawSignatureModal = (target: 'entrega' | 'recibe') => {
    setDrawSignatureTarget(target);
    setSignatureKey((k) => k + 1);
    setIsReadingSignature(false);
    setIsDrawSignatureModalVisible(true);
  };

  const closeDrawSignatureModal = () => {
    setIsDrawSignatureModalVisible(false);
    setIsReadingSignature(false);
  };

  const handleSignatureRead = (signature: string) => {
    const sig = String(signature || '').trim();
    if (!sig || sig.length < 10) {
      Alert.alert('Error', 'No se detectó la firma. Intenta de nuevo.');
      setIsReadingSignature(false);
      return;
    }

    // Determinar si estamos en movimientos de llaves o llaveros
    if (isMovModalVisible) {
      if (drawSignatureTarget === 'entrega') setMovFirmaEntrega(sig);
      else setMovFirmaRecibe(sig);
    } else if (isLlaveroMovModalVisible) {
      if (drawSignatureTarget === 'entrega') setLlaveroMovFirmaEntrega(sig);
      else setLlaveroMovFirmaRecibe(sig);
    }

    setIsReadingSignature(false);
    closeDrawSignatureModal();
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

  const handleSave = async () => {
    if (!employee) return;
    if (!validateForm()) return;

    setIsSubmitting(true);
    setSubmitResponse(null);

    try {
      const isConnected = await getConnectionStatus();
      const payload = await buildPayload();

      // create
      if (!editing) {
        if (isConnected) {
          const res = await createLlave({ requestData: payload, refreshAccessToken, logout });
          if (res.status) {
            setSubmitResponse({ type: 'success', message: res.message || 'Llave creada correctamente' });
            setIsCreating(false);
            await fetchLlaves();
          } else {
            setSubmitResponse({ type: 'error', message: res.message || 'No se pudo crear la llave' });
          }
        } else {
          const localId = `local-${Date.now()}`;
          const nowIso = new Date().toISOString();
          const localItem: LlaveUI = {
            id: 0,
            id_local: localId,
            cliente_id: 0,
            corpo_id: 0,
            puesto_id: 0,
            lugar_abre: payload.lugar_abre,
            cantidad_copias: payload.cantidad_copias,
            observaciones: payload.observaciones,
            firma_responsable: payload.firma_responsable,
            created_by: Number(employee.id) || 0,
            created_at: nowIso,
          };

          const next = [localItem, ...llaves];
          setLlaves(next);
          await AsyncStorage.setItem('llaves_cache', JSON.stringify(next));
          await upsertAction({ type: 'create', id: localId, requestData: payload });

          setSubmitResponse({ type: 'success', message: 'La llave se sincronizará cuando vuelva la conexión.' });
          setIsCreating(false);
        }
        return;
      }

      // update
      const isLocal = !!editing.id_local || editing.id === 0;
      if (isConnected && !isLocal) {
        const res = await updateLlave({ id: editing.id, requestData: payload, refreshAccessToken, logout });
        if (res.status) {
          setSubmitResponse({ type: 'success', message: res.message || 'Llave actualizada correctamente' });
          setIsCreating(false);
          setEditing(null);
          await fetchLlaves();
        } else {
          setSubmitResponse({ type: 'error', message: res.message || 'No se pudo actualizar la llave' });
        }
      } else {
        // offline update (o item aún no sincronizado)
        const next = llaves.map((it) => {
          const match =
            (editing.id_local && it.id_local === editing.id_local) ||
            (!editing.id_local && it.id === editing.id);
          if (!match) return it;
          return {
            ...it,
            lugar_abre: payload.lugar_abre,
            cantidad_copias: payload.cantidad_copias,
            observaciones: payload.observaciones,
            firma_responsable: payload.firma_responsable,
          };
        });
        setLlaves(next);
        await AsyncStorage.setItem('llaves_cache', JSON.stringify(next));

        if (editing.id_local) {
          const updated = await updateCreateActionForLocalId(editing.id_local, payload);
          if (!updated) {
            await upsertAction({ type: 'create', id: editing.id_local, requestData: payload });
          }
        } else {
          await upsertAction({ type: 'update', id: editing.id, requestData: payload });
        }

        setSubmitResponse({ type: 'success', message: 'Los cambios se sincronizarán cuando vuelva la conexión.' });
        setIsCreating(false);
        setEditing(null);
      }
    } catch (error) {
      console.error('Error saving llave:', error);
      setSubmitResponse({ type: 'error', message: 'Error al guardar la llave' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Funciones CRUD para Llaveros
  const validateLlaveroForm = () => {
    if (!llaveroNombre.trim()) {
      Alert.alert('Error', 'El nombre del llavero es obligatorio');
      return false;
    }
    if (!llaveroFirmaResponsable) {
      Alert.alert('Error', 'Debes registrar la firma responsable');
      return false;
    }
    return true;
  };

  const buildLlaveroPayload = async () => {
    const current = await loadMarcaContext();
    if (!current?.id) throw new Error('Marca no encontrada');
    return {
      marca_id: current.id,
      nombre_llavero: llaveroNombre.trim(),
      observaciones: llaveroObservaciones.trim(),
      firma_responsable: llaveroFirmaResponsable,
      llaves: llaveroSelectedLlaves,
    };
  };

  const handleLlaveroSave = async () => {
    if (!employee) return;
    if (!validateLlaveroForm()) return;

    setIsSubmitting(true);
    setSubmitResponse(null);

    try {
      const isConnected = await getConnectionStatus();
      const payload = await buildLlaveroPayload();

      // create
      if (!llaveroEditing) {
        if (isConnected) {
          const res = await createLlavero({ requestData: payload, refreshAccessToken, logout });
          if (res.status) {
            setSubmitResponse({ type: 'success', message: res.message || 'Llavero creado correctamente' });
            setIsLlaveroCreating(false);
            await fetchLlaveros();
          } else {
            setSubmitResponse({ type: 'error', message: res.message || 'No se pudo crear el llavero' });
          }
        } else {
          const localId = `local-llavero-${Date.now()}`;
          const nowIso = new Date().toISOString();
          const current = await loadMarcaContext();
          const localItem: LlaveroUI = {
            id: 0,
            id_local: localId,
            cliente_id: current?.cliente_id || 0,
            corpo_id: current?.corpo_id || 0,
            puesto_id: current?.puesto_id || 0,
            nombre_llavero: payload.nombre_llavero,
            observaciones: payload.observaciones,
            firma_responsable: payload.firma_responsable,
            created_by: Number(employee.id) || 0,
            created_at: nowIso,
            llaves: payload.llaves.map((llaveId: number) => ({ id: 0, llave_id: llaveId, llavero_id: 0 })),
          };

          const next = [localItem, ...llaveros];
          setLlaveros(next);
          await AsyncStorage.setItem('llaveros_cache', JSON.stringify(next));
          await upsertLlaveroAction({ type: 'create', id: localId, requestData: payload });

          setSubmitResponse({ type: 'success', message: 'El llavero se sincronizará cuando vuelva la conexión.' });
          setIsLlaveroCreating(false);
        }
        return;
      }

      // update
      const isLocal = !!llaveroEditing.id_local || llaveroEditing.id === 0;
      if (isConnected && !isLocal) {
        const res = await updateLlavero({ id: llaveroEditing.id, requestData: payload, refreshAccessToken, logout });
        if (res.status) {
          setSubmitResponse({ type: 'success', message: res.message || 'Llavero actualizado correctamente' });
          setIsLlaveroCreating(false);
          setLlaveroEditing(null);
          await fetchLlaveros();
        } else {
          setSubmitResponse({ type: 'error', message: res.message || 'No se pudo actualizar el llavero' });
        }
      } else {
        // offline update
        const next = llaveros.map((it) => {
          const match =
            (llaveroEditing.id_local && it.id_local === llaveroEditing.id_local) ||
            (!llaveroEditing.id_local && it.id === llaveroEditing.id);
          if (!match) return it;
          return {
            ...it,
            nombre_llavero: payload.nombre_llavero,
            observaciones: payload.observaciones,
            firma_responsable: payload.firma_responsable,
            llaves: payload.llaves.map((llaveId: number) => ({ id: 0, llave_id: llaveId, llavero_id: it.id || 0 })),
          };
        });
        setLlaveros(next);
        await AsyncStorage.setItem('llaveros_cache', JSON.stringify(next));

        if (llaveroEditing.id_local) {
          await upsertLlaveroAction({ type: 'create', id: llaveroEditing.id_local, requestData: payload });
        } else {
          await upsertLlaveroAction({ type: 'update', id: llaveroEditing.id, requestData: payload });
        }

        setSubmitResponse({ type: 'success', message: 'Los cambios se sincronizarán cuando vuelva la conexión.' });
        setIsLlaveroCreating(false);
        setLlaveroEditing(null);
      }
    } catch (error) {
      console.error('Error saving llavero:', error);
      setSubmitResponse({ type: 'error', message: 'Error al guardar el llavero' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLlaveroDelete = async (it: LlaveroUI) => {
    const current = await loadMarcaContext();
    if (!current?.id) return;

    Alert.alert('Confirmar', '¿Deseas eliminar este llavero?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          const isConnected = await getConnectionStatus();

          // local-only
          if (it.id_local || it.id === 0) {
            const next = llaveros.filter((x) => x.id_local !== it.id_local);
            setLlaveros(next);
            await AsyncStorage.setItem('llaveros_cache', JSON.stringify(next));
            if (it.id_local) await removeLlaveroActionsForLocalId(it.id_local);
            return;
          }

          if (isConnected) {
            const res = await deleteLlavero({ id: it.id, marcaId: current.id, refreshAccessToken, logout });
            if (res.status) {
              Alert.alert('Éxito', 'Llavero eliminado correctamente');
              await fetchLlaveros();
            } else {
              Alert.alert('Error', res.message || 'No se pudo eliminar el llavero');
            }
          } else {
            const next = llaveros.filter((x) => x.id !== it.id);
            setLlaveros(next);
            await AsyncStorage.setItem('llaveros_cache', JSON.stringify(next));
            await upsertLlaveroAction({ type: 'delete', id: it.id, marcaId: current.id });
            Alert.alert('Eliminado (offline)', 'La eliminación se sincronizará cuando vuelva la conexión.');
          }
        },
      },
    ]);
  };

  // Funciones de movimientos de llaveros (similar a movimientos de llaves)
  const resetLlaveroMovForm = () => {
    setLlaveroMovNombreRecibe('');
    setLlaveroMovNombreEntrega('');
    setLlaveroMovDepartamento('');
    setLlaveroMovTelefono('');
    setLlaveroMovFecha('');
    setLlaveroMovHora('');
    setLlaveroMovFirmaEntrega('');
    setLlaveroMovFirmaRecibe('');
    setLlaveroMovFirmaResponsable('');
    setLlaveroMovEditing(null);
  };

  const validateLlaveroMovForm = () => {
    const required = [
      { label: 'Nombre persona que entrega', v: llaveroMovNombreEntrega },
      { label: 'Nombre persona que recibe', v: llaveroMovNombreRecibe },
      { label: 'Departamento', v: llaveroMovDepartamento },
      { label: 'Teléfono', v: llaveroMovTelefono },
      { label: 'Fecha', v: llaveroMovFecha },
      { label: 'Hora', v: llaveroMovHora },
    ];
    const missing = required.find((x) => !x.v || String(x.v).trim().length === 0);
    if (missing) {
      Alert.alert('Error', `Campo requerido: ${missing.label}`);
      return false;
    }
    if (!llaveroMovFirmaEntrega) {
      Alert.alert('Error', 'Debes registrar la firma de entrega');
      return false;
    }
    if (!llaveroMovFirmaRecibe) {
      Alert.alert('Error', 'Debes registrar la firma de recibe');
      return false;
    }
    if (!llaveroMovFirmaResponsable) {
      Alert.alert('Error', 'Debes registrar la firma responsable');
      return false;
    }
    return true;
  };

  const buildLlaveroMovPayload = async () => {
    const current = await loadMarcaContext();
    if (!current?.id) throw new Error('Marca no encontrada');
    return {
      marca_id: current.id,
      nombre_persona_recibe: llaveroMovNombreRecibe,
      nombre_persona_entrega: llaveroMovNombreEntrega,
      departamento: llaveroMovDepartamento,
      telefono: llaveroMovTelefono,
      fecha: llaveroMovFecha,
      hora: llaveroMovHora,
      firma_entrega: llaveroMovFirmaEntrega,
      firma_recibe: llaveroMovFirmaRecibe,
      firma_responsable: llaveroMovFirmaResponsable,
    };
  };

  const openLlaveroMovimientosModal = (it: LlaveroUI) => {
    setMovLlavero(it);
    const list = (it.movimientos || []).map((m: any) => ({ ...m, id_local: m.id_local || '' }));
    setLlaveroMovimientos(list);
    setLlaveroMovIsCreating(false);
    setLlaveroMovEditing(null);
    resetLlaveroMovForm();
    setLlaveroMovFilterSearch('');
    setLlaveroMovFilterFecha('');
    setIsLlaveroMovModalVisible(true);
  };

  const closeLlaveroMovimientosModal = () => {
    setIsLlaveroMovModalVisible(false);
    setMovLlavero(null);
    setLlaveroMovimientos([]);
    setLlaveroMovIsCreating(false);
    setLlaveroMovEditing(null);
    resetLlaveroMovForm();
    setIsLlaveroMovFiltersExpanded(false);
  };

  const startLlaveroMovCreating = () => {
    resetLlaveroMovForm();
    setLlaveroMovIsCreating(true);
    setLlaveroMovEditing(null);
    setLlaveroMovFecha(dateToLocalString(new Date()));
    setLlaveroMovHora(timeToHHMMSS(new Date()));
  };

  const startLlaveroMovEditing = (m: MovimientoLlaveroUI) => {
    setLlaveroMovEditing(m);
    setLlaveroMovIsCreating(true);
    setLlaveroMovNombreRecibe(m.nombre_persona_recibe || '');
    setLlaveroMovNombreEntrega(m.nombre_persona_entrega || '');
    setLlaveroMovDepartamento(m.departamento || '');
    setLlaveroMovTelefono(m.telefono || '');
    setLlaveroMovFecha(m.fecha ? String(m.fecha).split('T')[0] : '');
    const horaStr = String(m.hora || '');
    setLlaveroMovHora(horaStr.includes('T') ? horaStr.split('T')[1]?.split('.')[0] || '' : horaStr);
    setLlaveroMovFirmaEntrega(m.firma_entrega || '');
    setLlaveroMovFirmaRecibe(m.firma_recibe || '');
    setLlaveroMovFirmaResponsable(m.firma_responsable || '');
  };

  const cancelLlaveroMovCreating = () => {
    setLlaveroMovIsCreating(false);
    setLlaveroMovEditing(null);
    resetLlaveroMovForm();
  };

  const persistMovimientosToLlaverosCache = async (llavero: LlaveroUI, nextMovs: MovimientoLlaveroUI[]) => {
    const nextLlaveros = llaveros.map((it) => {
      const match = (llavero.id_local && it.id_local === llavero.id_local) || (!llavero.id_local && it.id === llavero.id);
      if (!match) return it;
      return { ...it, movimientos: nextMovs };
    });
    setLlaveros(nextLlaveros);
    await AsyncStorage.setItem('llaveros_cache', JSON.stringify(nextLlaveros));

    setLlaveroMovimientos(nextMovs);
    setMovLlavero((prev) => (prev ? { ...prev, movimientos: nextMovs } : prev));
  };

  const handleLlaveroMovSave = async () => {
    if (!employee) return;
    if (!movLlavero) return;
    if (!validateLlaveroMovForm()) return;

    const payload = await buildLlaveroMovPayload();
    const isConnected = await getConnectionStatus();

    // create
    if (!llaveroMovEditing) {
      if (isConnected && movLlavero.id && movLlavero.id !== 0) {
        const res = await createMovimientoLlavero({ llaveroId: movLlavero.id, requestData: payload, refreshAccessToken, logout });
        if (res.status) {
          Alert.alert('Éxito', 'Movimiento creado correctamente');
          setLlaveroMovIsCreating(false);
          await fetchLlaveros();
        } else {
          Alert.alert('Error', res.message || 'No se pudo crear el movimiento');
        }
      } else {
        const localId = `local-mov-llavero-${Date.now()}`;
        const localItem: MovimientoLlaveroUI = {
          id: 0,
          id_local: localId,
          llavero_id: movLlavero.id || 0,
          llaveroLocalId: movLlavero.id_local || '',
          nombre_persona_recibe: payload.nombre_persona_recibe,
          nombre_persona_entrega: payload.nombre_persona_entrega,
          departamento: payload.departamento,
          telefono: payload.telefono,
          fecha: payload.fecha,
          hora: payload.hora,
          firma_entrega: payload.firma_entrega,
          firma_recibe: payload.firma_recibe,
          firma_responsable: payload.firma_responsable,
        };
        const next = [localItem, ...llaveroMovimientos];
        await persistMovimientosToLlaverosCache(movLlavero, next);
        await upsertLlaveroMovAction({
          type: 'create',
          id: localId,
          llaveroId: movLlavero.id || 0,
          llaveroLocalId: movLlavero.id_local || '',
          requestData: payload,
        });
        Alert.alert('Guardado (offline)', 'El movimiento se sincronizará cuando vuelva la conexión.');
        setLlaveroMovIsCreating(false);
      }
      return;
    }

    // update
    const isLocalMov = !!llaveroMovEditing.id_local || llaveroMovEditing.id === 0;
    if (isConnected && !isLocalMov && movLlavero.id && movLlavero.id !== 0) {
      const res = await updateMovimientoLlavero({
        llaveroId: movLlavero.id,
        id: llaveroMovEditing.id,
        requestData: payload,
        refreshAccessToken,
        logout,
      });
      if (res.status) {
        Alert.alert('Éxito', 'Movimiento actualizado correctamente');
        setLlaveroMovIsCreating(false);
        setLlaveroMovEditing(null);
        await fetchLlaveros();
      } else {
        Alert.alert('Error', res.message || 'No se pudo actualizar el movimiento');
      }
    } else {
      const next = llaveroMovimientos.map((m) => {
        const match = (llaveroMovEditing.id_local && m.id_local === llaveroMovEditing.id_local) || (!llaveroMovEditing.id_local && m.id === llaveroMovEditing.id);
        if (!match) return m;
        return {
          ...m,
          nombre_persona_recibe: payload.nombre_persona_recibe,
          nombre_persona_entrega: payload.nombre_persona_entrega,
          departamento: payload.departamento,
          telefono: payload.telefono,
          fecha: payload.fecha,
          hora: payload.hora,
          firma_entrega: payload.firma_entrega,
          firma_recibe: payload.firma_recibe,
          firma_responsable: payload.firma_responsable,
        };
      });
      await persistMovimientosToLlaverosCache(movLlavero, next);
      if (llaveroMovEditing.id_local) {
        await upsertLlaveroMovAction({
          type: 'create',
          id: llaveroMovEditing.id_local,
          llaveroId: movLlavero.id || 0,
          llaveroLocalId: movLlavero.id_local || '',
          requestData: payload,
        });
      } else {
        await upsertLlaveroMovAction({
          type: 'update',
          id: llaveroMovEditing.id,
          llaveroId: movLlavero.id || 0,
          requestData: payload,
        });
      }
      Alert.alert('Guardado (offline)', 'Los cambios se sincronizarán cuando vuelva la conexión.');
      setLlaveroMovIsCreating(false);
      setLlaveroMovEditing(null);
    }
  };

  const handleLlaveroMovDelete = async (m: MovimientoLlaveroUI) => {
    if (!movLlavero) return;
    const current = await loadMarcaContext();
    if (!current?.id) return;

    Alert.alert('Confirmar', '¿Deseas eliminar este movimiento?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          const isConnected = await getConnectionStatus();

          if (m.id_local || m.id === 0) {
            const next = llaveroMovimientos.filter((x) => x.id_local !== m.id_local);
            await persistMovimientosToLlaverosCache(movLlavero, next);
            if (m.id_local) await removeLlaveroMovActionsForLocalId(m.id_local);
            return;
          }

          if (isConnected && movLlavero.id && movLlavero.id !== 0) {
            const res = await deleteMovimientoLlavero({
              llaveroId: movLlavero.id,
              id: m.id,
              marcaId: current.id,
              refreshAccessToken,
              logout,
            });
            if (res.status) {
              Alert.alert('Éxito', 'Movimiento eliminado correctamente');
              await fetchLlaveros();
            } else {
              Alert.alert('Error', res.message || 'No se pudo eliminar el movimiento');
            }
          } else {
            const next = llaveroMovimientos.filter((x) => x.id !== m.id);
            await persistMovimientosToLlaverosCache(movLlavero, next);
            await upsertLlaveroMovAction({
              type: 'delete',
              id: m.id,
              llaveroId: movLlavero.id || 0,
              marcaId: current.id,
            });
            Alert.alert('Eliminado (offline)', 'La eliminación se sincronizará cuando vuelva la conexión.');
          }
        },
      },
    ]);
  };

  const handleDelete = async (it: LlaveUI) => {
    const current = await loadMarcaContext();
    if (!current?.id) return;

    Alert.alert('Confirmar', '¿Deseas eliminar esta llave?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          const isConnected = await getConnectionStatus();

          // local-only
          if (it.id_local || it.id === 0) {
            const next = llaves.filter((x) => x.id_local !== it.id_local);
            setLlaves(next);
            await AsyncStorage.setItem('llaves_cache', JSON.stringify(next));
            if (it.id_local) await removeActionsForLocalId(it.id_local);
            return;
          }

          if (isConnected) {
            const res = await deleteLlave({ id: it.id, marcaId: current.id, refreshAccessToken, logout });
            if (res.status) {
              Alert.alert('Éxito', 'Llave eliminada correctamente');
              await fetchLlaves();
            } else {
              Alert.alert('Error', res.message || 'No se pudo eliminar la llave');
            }
          } else {
            const next = llaves.filter((x) => x.id !== it.id);
            setLlaves(next);
            await AsyncStorage.setItem('llaves_cache', JSON.stringify(next));
            await upsertAction({ type: 'delete', id: it.id, marcaId: current.id });
            Alert.alert('Eliminado (offline)', 'La eliminación se sincronizará cuando vuelva la conexión.');
          }
        },
      },
    ]);
  };

  // Funciones para Llaveros (similar a Llaves)
  const resetLlaveroForm = () => {
    setLlaveroNombre('');
    setLlaveroObservaciones('');
    setLlaveroFirmaResponsable('');
    setLlaveroSelectedLlaves([]);
  };

  const startLlaveroCreating = () => {
    resetLlaveroForm();
    setLlaveroEditing(null);
    setIsLlaveroCreating(true);
  };

  const startLlaveroEditing = (it: LlaveroUI) => {
    setLlaveroEditing(it);
    setIsLlaveroCreating(true);
    setLlaveroNombre(it.nombre_llavero || '');
    setLlaveroObservaciones(it.observaciones || '');
    setLlaveroFirmaResponsable(it.firma_responsable || '');
    const selectedLlaves = (it.llaves || []).map((l: any) => l.llave_id).filter((id: number) => id && id > 0);
    setLlaveroSelectedLlaves(selectedLlaves);
  };

  const cancelLlaveroCreating = () => {
    setIsLlaveroCreating(false);
    setLlaveroEditing(null);
    resetLlaveroForm();
  };

  const upsertLlaveroAction = async (action: any) => {
    const actionsStr = await AsyncStorage.getItem('llaveros_actions');
    const actions = actionsStr ? JSON.parse(actionsStr) : [];
    const filtered = actions.filter((a: any) => !(a.id === action.id && a.type === action.type));
    filtered.push({ ...action, id: action.id || `local-${Date.now()}` });
    await AsyncStorage.setItem('llaveros_actions', JSON.stringify(filtered));
  };

  const removeLlaveroActionsForLocalId = async (localId: string) => {
    const actionsStr = await AsyncStorage.getItem('llaveros_actions');
    if (!actionsStr) return;
    const actions = JSON.parse(actionsStr) || [];
    const updated = actions.filter((a: any) => a.id !== localId);
    await AsyncStorage.setItem('llaveros_actions', JSON.stringify(updated));
  };

  const upsertLlaveroMovAction = async (action: any) => {
    const actionsStr = await AsyncStorage.getItem('movimientos_llaveros_actions');
    const actions = actionsStr ? JSON.parse(actionsStr) : [];
    const filtered = actions.filter((a: any) => !(a.id === action.id && a.type === action.type));
    filtered.push({ ...action, id: action.id || `local-${Date.now()}` });
    await AsyncStorage.setItem('movimientos_llaveros_actions', JSON.stringify(filtered));
  };

  const removeLlaveroMovActionsForLocalId = async (localId: string) => {
    const actionsStr = await AsyncStorage.getItem('movimientos_llaveros_actions');
    if (!actionsStr) return;
    const actions = JSON.parse(actionsStr) || [];
    const updated = actions.filter((a: any) => a.id !== localId);
    await AsyncStorage.setItem('movimientos_llaveros_actions', JSON.stringify(updated));
  };

  const resetAllFilters = () => {
    setFilterSearch('');
    setFilterFecha('');
  };

  const resetLlaveroFilters = () => {
    setLlaveroFilterSearch('');
    setLlaveroFilterFecha('');
  };

  const filteredLlaves = useMemo(() => {
    const q = filterSearch.trim().toLowerCase();
    return llaves.filter((it) => {
      if (filterFecha) {
        const d = it.created_at ? String(it.created_at).split('T')[0] : '';
        if (d !== filterFecha) return false;
      }
      if (!q) return true;
      const haystack = `${it.lugar_abre ?? ''} ${it.cantidad_copias ?? ''} ${it.observaciones ?? ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [llaves, filterSearch, filterFecha]);

  const filteredLlaveros = useMemo(() => {
    const q = llaveroFilterSearch.trim().toLowerCase();
    return llaveros.filter((it) => {
      if (llaveroFilterFecha) {
        const d = it.created_at ? String(it.created_at).split('T')[0] : '';
        if (d !== llaveroFilterFecha) return false;
      }
      if (!q) return true;
      const haystack = `${it.nombre_llavero ?? ''} ${it.observaciones ?? ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [llaveros, llaveroFilterSearch, llaveroFilterFecha]);

  // Obtener llaves disponibles para seleccionar (desde cache o API)
  const getAvailableLlaves = async (): Promise<LlaveUI[]> => {
    const isConnected = await getConnectionStatus();
    if (isConnected) {
      const current = await loadMarcaContext();
      if (current) {
        const res = await listLlaves({ marcaId: current.id, refreshAccessToken, logout });
        if (res.status && res.data) {
          return res.data.map((it: any) => ({ ...it, id_local: it.id_local || '' }));
        }
      }
    }
    const cacheStr = await AsyncStorage.getItem('llaves_cache');
    if (cacheStr) {
      return JSON.parse(cacheStr);
    }
    return [];
  };

  // Componente para seleccionar llaves en llavero
  const LlaveroLlavesSelector = ({ selectedLlaves, onSelectionChange, getAvailableLlaves, isExpanded }: {
    selectedLlaves: number[];
    onSelectionChange: (llaves: number[]) => void;
    getAvailableLlaves: () => Promise<LlaveUI[]>;
    isExpanded: boolean;
  }) => {
    const [availableLlaves, setAvailableLlaves] = useState<LlaveUI[]>([]);
    const [loadingLlaves, setLoadingLlaves] = useState(false);
    const hasLoadedRef = useRef(false);

    useEffect(() => {
      // Solo cargar llaves cuando la sección se expande por primera vez
      if (isExpanded && !hasLoadedRef.current) {
        const loadLlaves = async () => {
          setLoadingLlaves(true);
          try {
            const llaves = await getAvailableLlaves();
            setAvailableLlaves(llaves);
            hasLoadedRef.current = true;
          } catch (error) {
            console.error('Error loading llaves:', error);
          } finally {
            setLoadingLlaves(false);
          }
        };
        loadLlaves();
      }
    }, [isExpanded]);

    const toggleLlave = (llaveId: number) => {
      if (selectedLlaves.includes(llaveId)) {
        onSelectionChange(selectedLlaves.filter((id) => id !== llaveId));
      } else {
        onSelectionChange([...selectedLlaves, llaveId]);
      }
    };

    return (
      <ThemedView style={styles.llavesSelectorContainer}>
        {loadingLlaves ? (
          <ActivityIndicator size="small" color="#007AFF" />
        ) : availableLlaves.length === 0 ? (
          <ThemedText style={styles.emptyText}>No hay llaves disponibles</ThemedText>
        ) : (
          availableLlaves.map((llave) => {
            const isSelected = selectedLlaves.includes(llave.id);
            return (
              <TouchableOpacity
                key={llave.id || llave.id_local}
                style={[styles.llaveSelectorItem, isSelected && styles.llaveSelectorItemSelected]}
                onPress={() => toggleLlave(llave.id)}
              >
                <Ionicons
                  name={isSelected ? 'checkbox' : 'checkbox-outline'}
                  size={20}
                  color={isSelected ? '#007AFF' : '#999'}
                />
                <ThemedText style={[styles.llaveSelectorText, isSelected && styles.llaveSelectorTextSelected]}>
                  {llave.lugar_abre} ({llave.cantidad_copias} copias)
                </ThemedText>
              </TouchableOpacity>
            );
          })
        )}
      </ThemedView>
    );
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

  const renderItem = (it: LlaveUI, index: number) => {
    const key = it.id !== 0 ? `ll-${it.id}` : it.id_local ? `ll-${it.id_local}` : `ll-${index}`;
    const isExpanded = expanded.has(key);
    const fecha = it.created_at ? String(it.created_at).split('T')[0] : '';
    const firmaInfo = decodeFirmaHash(it.firma_responsable);

    return (
      <ThemedView key={key} style={styles.bitacoraCard}>
        <ThemedText style={styles.bitTitle}>
          {it.lugar_abre}
          {it.id_local ? ' (offline)' : ''}
        </ThemedText>

        <ThemedText style={styles.bitLine}>
          <ThemedText style={styles.bitLabel}>Copias: </ThemedText>
          <ThemedText style={styles.bitValue}>{String(it.cantidad_copias ?? '')}</ThemedText>
        </ThemedText>

        <ThemedText style={styles.bitLine}>
          <ThemedText style={styles.bitLabel}>Fecha: </ThemedText>
          <ThemedText style={styles.bitValue}>{formatYMDToDMY(fecha)}</ThemedText>
        </ThemedText>

        <TouchableOpacity style={styles.collapseButton} onPress={() => toggleExpanded(key)}>
          <ThemedText style={styles.collapseButtonText}>{isExpanded ? 'Ocultar detalles' : 'Ver detalles'}</ThemedText>
          <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color="#007AFF" />
        </TouchableOpacity>

        {isExpanded && (
          <ThemedView style={styles.collapsableContent}>
            <ThemedText style={styles.bitLine}>
              <ThemedText style={styles.bitLabel}>Observaciones: </ThemedText>
              <ThemedText style={styles.bitValue}>{it.observaciones || '-'}</ThemedText>
            </ThemedText>

            {/* Firma responsable (mismo modo que en el formulario, con datos expuestos) */}
            {!it.firma_responsable ? (
              <ThemedText style={styles.signatureHintMuted}>Aún no hay firma responsable.</ThemedText>
            ) : (
              <ThemedView style={[styles.firmaInfoBox, { marginTop: 10 }]}>
                <ThemedView style={{ flex: 1, paddingRight: 10 }}>
                  <ThemedText style={styles.firmaInfoTitle}>Información de la firma:</ThemedText>
                  {(() => {
                    const info = decodeFirmaHash(it.firma_responsable);
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
              </ThemedView>
            )}
          </ThemedView>
        )}

        <ThemedView style={styles.listItemButtons}>
          <TouchableOpacity style={[styles.listItemButton, styles.editButton]} onPress={() => startEditing(it)}>
            <Ionicons name="pencil" size={18} color="#FFFFFF" />
            <ThemedText style={styles.listItemButtonText}>Editar</ThemedText>
          </TouchableOpacity>
          {!(it.id_local || it.id === 0) && (
            <TouchableOpacity
              style={[styles.listItemButton, styles.changesButton]}
              onPress={() => {
                setCambiosTitle(`Cambios - Llave #${it.id}`);
                fetchCambios('e_llave', it.id);
              }}
            >
              <Ionicons name="list-outline" size={18} color="#FFFFFF" />
              <ThemedText style={styles.listItemButtonText}>Cambios</ThemedText>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.listItemButton, styles.deleteButton]} onPress={() => handleDelete(it)}>
            <Ionicons name="trash" size={18} color="#FFFFFF" />
            <ThemedText style={styles.listItemButtonText}>Eliminar</ThemedText>
          </TouchableOpacity>
        </ThemedView>
        <ThemedView style={styles.listItemButtons}>
          <TouchableOpacity style={[styles.listItemButton, styles.movementsButton]} onPress={() => openMovimientosModal(it)}>
            <Ionicons name="repeat" size={18} color="#FFFFFF" />
            <ThemedText style={styles.listItemButtonText}>Movimientos</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </ThemedView>
    );
  };

  // Renderizar llaveros
  const renderLlaveroItem = (it: LlaveroUI, index: number) => {
    const key = it.id !== 0 ? `llavero-${it.id}` : it.id_local ? `llavero-${it.id_local}` : `llavero-${index}`;
    const isExpanded = expanded.has(key);
    const fecha = it.created_at ? String(it.created_at).split('T')[0] : '';
    const firmaInfo = decodeFirmaHash(it.firma_responsable);

    return (
      <ThemedView key={key} style={styles.bitacoraCard}>
        <ThemedText style={styles.bitTitle}>
          {it.nombre_llavero}
          {it.id_local ? ' (offline)' : ''}
        </ThemedText>

        <ThemedText style={styles.bitLine}>
          <ThemedText style={styles.bitLabel}>Fecha: </ThemedText>
          <ThemedText style={styles.bitValue}>{formatYMDToDMY(fecha)}</ThemedText>
        </ThemedText>

        <TouchableOpacity style={styles.collapseButton} onPress={() => toggleExpanded(key)}>
          <ThemedText style={styles.collapseButtonText}>{isExpanded ? 'Ocultar detalles' : 'Ver detalles'}</ThemedText>
          <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color="#007AFF" />
        </TouchableOpacity>

        {isExpanded && (
          <ThemedView style={styles.collapsableContent}>
            <ThemedText style={styles.bitLine}>
              <ThemedText style={styles.bitLabel}>Observaciones: </ThemedText>
              <ThemedText style={styles.bitValue}>{it.observaciones || '-'}</ThemedText>
            </ThemedText>

            <ThemedText style={styles.bitLine}>
              <ThemedText style={styles.bitLabel}>Llaves asociadas: </ThemedText>
              <ThemedText style={styles.bitValue}>{(it.llaves || []).length} llave(s)</ThemedText>
            </ThemedText>
            {(it.llaves || []).length > 0 && (
              <ThemedView style={{ marginTop: 8 }}>
                <ThemedText style={styles.bitLabel}>Lugares que abren:</ThemedText>
                {(it.llaves || []).map((llaveRel: any, idx: number) => {
                  const lugarAbre = llaveRel.llave?.lugar_abre || 'N/A';
                  return (
                    <ThemedText key={idx} style={[styles.bitValue, { marginTop: 4 }]}>
                      • {lugarAbre}
                    </ThemedText>
                  );
                })}
              </ThemedView>
            )}

            {!it.firma_responsable ? (
              <ThemedText style={styles.signatureHintMuted}>Aún no hay firma responsable.</ThemedText>
            ) : (
              <ThemedView style={[styles.firmaInfoBox, { marginTop: 10 }]}>
                <ThemedView style={{ flex: 1, paddingRight: 10 }}>
                  <ThemedText style={styles.firmaInfoTitle}>Información de la firma:</ThemedText>
                  {(() => {
                    const info = decodeFirmaHash(it.firma_responsable);
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
              </ThemedView>
            )}
          </ThemedView>
        )}

        <ThemedView style={styles.listItemButtons}>
          <TouchableOpacity style={[styles.listItemButton, styles.editButton]} onPress={() => startLlaveroEditing(it)}>
            <Ionicons name="pencil" size={18} color="#FFFFFF" />
            <ThemedText style={styles.listItemButtonText}>Editar</ThemedText>
          </TouchableOpacity>
          {!(it.id_local || it.id === 0) && (
            <TouchableOpacity
              style={[styles.listItemButton, styles.changesButton]}
              onPress={() => {
                setCambiosTitle(`Cambios - Llavero #${it.id}`);
                fetchCambios('e_llavero', it.id);
              }}
            >
              <Ionicons name="list-outline" size={18} color="#FFFFFF" />
              <ThemedText style={styles.listItemButtonText}>Cambios</ThemedText>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.listItemButton, styles.deleteButton]} onPress={() => handleLlaveroDelete(it)}>
            <Ionicons name="trash" size={18} color="#FFFFFF" />
            <ThemedText style={styles.listItemButtonText}>Eliminar</ThemedText>
          </TouchableOpacity>
        </ThemedView>
        <ThemedView style={styles.listItemButtons}>
          <TouchableOpacity style={[styles.listItemButton, styles.movementsButton]} onPress={() => openLlaveroMovimientosModal(it)}>
            <Ionicons name="repeat" size={18} color="#FFFFFF" />
            <ThemedText style={styles.listItemButtonText}>Movimientos</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </ThemedView>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <AppHeader onMenuPress={handleMenuPress} title={activeTab === 'llaves' ? 'Llaves' : 'Llaveros'} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <ThemedView style={styles.content}>
          {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}

          {/* Tabs */}
          <ThemedView style={styles.tabsContainer}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'llaves' && styles.tabButtonActive]}
              onPress={() => setActiveTab('llaves')}
            >
              <Ionicons name="key" size={20} color={activeTab === 'llaves' ? '#FFFFFF' : '#007AFF'} />
              <ThemedText style={[styles.tabButtonText, activeTab === 'llaves' && styles.tabButtonTextActive]}>
                Llaves
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'llaveros' && styles.tabButtonActive]}
              onPress={() => setActiveTab('llaveros')}
            >
              <Ionicons name="key-outline" size={20} color={activeTab === 'llaveros' ? '#FFFFFF' : '#007AFF'} />
              <ThemedText style={[styles.tabButtonText, activeTab === 'llaveros' && styles.tabButtonTextActive]}>
                Llaveros
              </ThemedText>
            </TouchableOpacity>
          </ThemedView>

          {activeTab === 'llaves' && (
            <>
              <ThemedView style={styles.titleContainer}>
                <ThemedText type="title" style={styles.title}>
                  <Ionicons name="key" size={22} color="#000000" /> Llaves
                </ThemedText>
                <ThemedText style={styles.subtitle}>Gestiona el registro y control de llaves</ThemedText>
              </ThemedView>

              {/* Filtros (collapsable) */}
              {!isCreating && !isLoading && (
                <ThemedView style={styles.filtersMain}>
                  <ThemedView style={styles.filterHeader}>
                    <TouchableOpacity
                      style={styles.filterToggleButton}
                      onPress={() => setIsFiltersExpanded(!isFiltersExpanded)}
                    >
                      <ThemedText style={styles.filterToggleText}>Filtros</ThemedText>
                      <Ionicons
                        name={isFiltersExpanded ? 'chevron-up' : 'chevron-down'}
                        size={20}
                        color="#007AFF"
                      />
                    </TouchableOpacity>

                    {isFiltersExpanded && (
                      <TouchableOpacity style={styles.resetFiltersButton} onPress={resetAllFilters}>
                        <Ionicons name="refresh" size={16} color="#FF3B30" />
                        <ThemedText style={styles.resetFiltersText}>Reiniciar</ThemedText>
                      </TouchableOpacity>
                    )}
                  </ThemedView>

                  {isFiltersExpanded && (
                    <ThemedView style={styles.filterContent}>
                      <ThemedView style={styles.filterGroupSearch}>
                        <ThemedText style={styles.filterLabel}>Buscar (lugar/observaciones):</ThemedText>
                        <TextInput
                          style={styles.searchInput}
                          value={filterSearch}
                          onChangeText={setFilterSearch}
                          placeholder="Ej: Bodega / Portón / Observación"
                          placeholderTextColor="#999"
                        />
                      </ThemedView>

                      <ThemedView style={styles.filterGroupSearch}>
                        <ThemedText style={styles.filterLabel}>Fecha de registro:</ThemedText>
                        <TouchableOpacity
                          style={styles.dateButton}
                          onPress={() => setShowFilterFechaPicker(true)}
                        >
                          <ThemedText style={styles.dateButtonText}>
                            {filterFecha ? formatYMDToDMY(filterFecha) : 'Seleccionar fecha'}
                          </ThemedText>
                          <Ionicons name="calendar-outline" size={18} color="#007AFF" />
                        </TouchableOpacity>
                      </ThemedView>
                    </ThemedView>
                  )}
                </ThemedView>
              )}

              {!hasCurrentMarca ? (
                <ThemedView style={styles.emptyContainer}>
                  <ThemedText style={styles.errorText}>Debes tener una marca activa para usar este módulo.</ThemedText>
                </ThemedView>
              ) : null}

              {!isCreating && !isLoading && (
                <TouchableOpacity style={styles.createButton} onPress={startCreating}>
                  <ThemedText style={styles.createButtonText}>
                    <Ionicons name="add" size={20} color="#FFFFFF" /> Nuevo registro
                  </ThemedText>
                </TouchableOpacity>
              )}

              {isCreating && (
                <ThemedView style={styles.formCard}>
                  <ThemedText style={styles.formTitle}>{editing ? 'Editar registro' : 'Nuevo registro'}</ThemedText>

                  <ThemedText style={styles.label}>Lugar que abre *</ThemedText>
                  <TextInput
                    style={styles.input}
                    placeholder="Ej: Bodega, Oficina, Portón..."
                    placeholderTextColor="#999"
                    value={lugarAbre}
                    onChangeText={setLugarAbre}
                  />

                  <ThemedText style={styles.label}>Cantidad de copias *</ThemedText>
                  <TextInput
                    style={styles.input}
                    keyboardType="number-pad"
                    placeholder="1"
                    placeholderTextColor="#999"
                    value={cantidadCopias}
                    onChangeText={setCantidadCopias}
                  />

                  <ThemedText style={styles.label}>Observaciones</ThemedText>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    multiline
                    placeholder="Observaciones..."
                    placeholderTextColor="#999"
                    value={observaciones}
                    onChangeText={setObservaciones}
                  />

                  <ThemedText style={styles.sectionTitle}>Firma responsable *</ThemedText>
                  <ThemedView style={styles.signatureButtons}>
                    <TouchableOpacity
                      style={[styles.signatureButton, isGeneratingFirma && styles.signatureButtonDisabled]}
                      onPress={handleGenerateFirmaResponsable}
                      disabled={isGeneratingFirma}
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
                    <TouchableOpacity style={styles.signatureButton} onPress={handleScanFirmaResponsable}>
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
                      <TouchableOpacity style={styles.firmaClearButtonTiny} onPress={() => setFirmaResponsable('')}>
                        <Ionicons name="trash" size={18} color="#FFFFFF" />
                      </TouchableOpacity>
                    </ThemedView>
                  )}

                  {submitResponse && (
                    <ThemedView style={[styles.responseContainer, submitResponse.type === 'success' ? styles.responseSuccess : styles.responseError]}>
                      <ThemedText style={styles.responseText}>
                        {submitResponse.type === 'success' ? '✓ ' : '✗ '}
                        {submitResponse.message}
                      </ThemedText>
                    </ThemedView>
                  )}
                  <ThemedView style={styles.formActions}>
                    <TouchableOpacity style={[styles.formActionButton, styles.formActionCancel]} onPress={cancelCreating} disabled={isSubmitting}>
                      <Ionicons name="close" size={18} color="#000" />
                      <ThemedText style={styles.formActionCancelText}>Cancelar</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.formActionButton, styles.formActionSave, isSubmitting && styles.buttonDisabled]}
                      onPress={handleSave}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="save" size={18} color="#fff" />
                          <ThemedText style={styles.formActionSaveText}>Guardar</ThemedText>
                        </>
                      )}
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
                  ) : filteredLlaves.length === 0 ? (
                    <ThemedView style={styles.emptyContainer}>
                      <ThemedText style={styles.emptyText}>No hay registros</ThemedText>
                    </ThemedView>
                  ) : (
                    <ThemedView style={styles.listContainer}>
                      {filteredLlaves.map(renderItem)}
                    </ThemedView>
                  )}
                </>
              )}
            </>
          )}

          {activeTab === 'llaveros' && (
            <>
              <ThemedView style={styles.titleContainer}>
                <ThemedText type="title" style={styles.title}>
                  <Ionicons name="key-outline" size={22} color="#000000" /> Llaveros
                </ThemedText>
                <ThemedText style={styles.subtitle}>Gestiona el registro y control de llaveros</ThemedText>
              </ThemedView>

              {/* Filtros (collapsable) */}
              {!isLlaveroCreating && !isLoading && (
                <ThemedView style={styles.filtersMain}>
                  <ThemedView style={styles.filterHeader}>
                    <TouchableOpacity
                      style={styles.filterToggleButton}
                      onPress={() => setIsLlaveroFiltersExpanded(!isLlaveroFiltersExpanded)}
                    >
                      <ThemedText style={styles.filterToggleText}>Filtros</ThemedText>
                      <Ionicons
                        name={isLlaveroFiltersExpanded ? 'chevron-up' : 'chevron-down'}
                        size={20}
                        color="#007AFF"
                      />
                    </TouchableOpacity>

                    {isLlaveroFiltersExpanded && (
                      <TouchableOpacity style={styles.resetFiltersButton} onPress={resetLlaveroFilters}>
                        <Ionicons name="refresh" size={16} color="#FF3B30" />
                        <ThemedText style={styles.resetFiltersText}>Reiniciar</ThemedText>
                      </TouchableOpacity>
                    )}
                  </ThemedView>

                  {isLlaveroFiltersExpanded && (
                    <ThemedView style={styles.filterContent}>
                      <ThemedView style={styles.filterGroupSearch}>
                        <ThemedText style={styles.filterLabel}>Buscar (nombre/observaciones):</ThemedText>
                        <TextInput
                          style={styles.searchInput}
                          value={llaveroFilterSearch}
                          onChangeText={setLlaveroFilterSearch}
                          placeholder="Ej: Llavero principal / Observación"
                          placeholderTextColor="#999"
                        />
                      </ThemedView>

                      <ThemedView style={styles.filterGroupSearch}>
                        <ThemedText style={styles.filterLabel}>Fecha de registro:</ThemedText>
                        <TouchableOpacity
                          style={styles.dateButton}
                          onPress={() => setShowLlaveroFilterFechaPicker(true)}
                        >
                          <ThemedText style={styles.dateButtonText}>
                            {llaveroFilterFecha ? formatYMDToDMY(llaveroFilterFecha) : 'Seleccionar fecha'}
                          </ThemedText>
                          <Ionicons name="calendar-outline" size={18} color="#007AFF" />
                        </TouchableOpacity>
                      </ThemedView>
                    </ThemedView>
                  )}
                </ThemedView>
              )}

              {!hasCurrentMarca ? (
                <ThemedView style={styles.emptyContainer}>
                  <ThemedText style={styles.errorText}>Debes tener una marca activa para usar este módulo.</ThemedText>
                </ThemedView>
              ) : null}

              {!isLlaveroCreating && !isLoading && (
                <TouchableOpacity style={styles.createButton} onPress={startLlaveroCreating}>
                  <ThemedText style={styles.createButtonText}>
                    <Ionicons name="add" size={20} color="#FFFFFF" /> Nuevo registro
                  </ThemedText>
                </TouchableOpacity>
              )}

              {isLlaveroCreating && (
                <ThemedView style={styles.formCard}>
                  <ThemedText style={styles.formTitle}>{llaveroEditing ? 'Editar registro' : 'Nuevo registro'}</ThemedText>

                  <ThemedText style={styles.label}>Nombre del llavero *</ThemedText>
                  <TextInput
                    style={styles.input}
                    placeholder="Ej: Llavero principal, Llavero oficina..."
                    placeholderTextColor="#999"
                    value={llaveroNombre}
                    onChangeText={setLlaveroNombre}
                  />

                  <ThemedText style={styles.label}>Observaciones</ThemedText>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    multiline
                    placeholder="Observaciones..."
                    placeholderTextColor="#999"
                    value={llaveroObservaciones}
                    onChangeText={setLlaveroObservaciones}
                  />

                  {/* Lista expandible de llaves */}
                  <ThemedView style={styles.formGroup}>
                    <TouchableOpacity
                      style={styles.expandableHeader}
                      onPress={() => setIsLlaveroLlavesExpanded(!isLlaveroLlavesExpanded)}
                    >
                      <ThemedText style={styles.label}>Llaves asociadas ({llaveroSelectedLlaves.length})</ThemedText>
                      <Ionicons
                        name={isLlaveroLlavesExpanded ? 'chevron-up' : 'chevron-down'}
                        size={20}
                        color="#007AFF"
                      />
                    </TouchableOpacity>
                    {isLlaveroLlavesExpanded && (
                      <ThemedView style={styles.expandableContent}>
                        <LlaveroLlavesSelector
                          selectedLlaves={llaveroSelectedLlaves}
                          onSelectionChange={setLlaveroSelectedLlaves}
                          getAvailableLlaves={getAvailableLlaves}
                          isExpanded={isLlaveroLlavesExpanded}
                        />
                      </ThemedView>
                    )}
                  </ThemedView>

                  <ThemedText style={styles.sectionTitle}>Firma responsable *</ThemedText>
                  <ThemedView style={styles.signatureButtons}>
                    <TouchableOpacity
                      style={[styles.signatureButton, isGeneratingLlaveroFirma && styles.signatureButtonDisabled]}
                      onPress={async () => {
                        if (isGeneratingLlaveroFirma) return;
                        setIsGeneratingLlaveroFirma(true);
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
                          const horaAccion = await getHoraAccion();
                          const hash = btoa(`${sessionId}:${employee.id}:${loc.coords.latitude}:${loc.coords.longitude}:${horaAccion}`);
                          setLlaveroFirmaResponsable(hash);
                        } catch (e: any) {
                          Alert.alert('Error', e.message || 'No se pudo generar la firma');
                        } finally {
                          setIsGeneratingLlaveroFirma(false);
                        }
                      }}
                      disabled={isGeneratingLlaveroFirma}
                    >
                      {isGeneratingLlaveroFirma ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons name="finger-print" size={18} color="#FFFFFF" />
                          <ThemedText style={styles.signatureButtonText}>Generar</ThemedText>
                        </>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.signatureButton}
                      onPress={async () => {
                        try {
                          const qrData = await scanQR();
                          if (!qrData) return;
                          setLlaveroFirmaResponsable(qrData);
                        } catch {
                          Alert.alert('Error', 'No se pudo escanear el QR');
                        }
                      }}
                    >
                      <Ionicons name="qr-code" size={18} color="#FFFFFF" />
                      <ThemedText style={styles.signatureButtonText}>Escanear QR</ThemedText>
                    </TouchableOpacity>
                  </ThemedView>

                  {!llaveroFirmaResponsable ? (
                    <ThemedText style={styles.signatureHintMuted}>Aún no hay firma responsable.</ThemedText>
                  ) : (
                    <ThemedView style={styles.firmaInfoBox}>
                      <ThemedView style={{ flex: 1, paddingRight: 10 }}>
                        <ThemedText style={styles.firmaInfoTitle}>Información de la firma:</ThemedText>
                        {(() => {
                          const info = decodeFirmaHash(llaveroFirmaResponsable);
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
                      <TouchableOpacity style={styles.firmaClearButtonTiny} onPress={() => setLlaveroFirmaResponsable('')}>
                        <Ionicons name="trash" size={18} color="#FFFFFF" />
                      </TouchableOpacity>
                    </ThemedView>
                  )}

                  {submitResponse && (
                    <ThemedView style={[styles.responseContainer, submitResponse.type === 'success' ? styles.responseSuccess : styles.responseError]}>
                      <ThemedText style={styles.responseText}>
                        {submitResponse.type === 'success' ? '✓ ' : '✗ '}
                        {submitResponse.message}
                      </ThemedText>
                    </ThemedView>
                  )}
                  <ThemedView style={styles.formActions}>
                    <TouchableOpacity style={[styles.formActionButton, styles.formActionCancel]} onPress={cancelLlaveroCreating} disabled={isSubmitting}>
                      <Ionicons name="close" size={18} color="#000" />
                      <ThemedText style={styles.formActionCancelText}>Cancelar</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.formActionButton, styles.formActionSave, isSubmitting && styles.buttonDisabled]}
                      onPress={handleLlaveroSave}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="save" size={18} color="#fff" />
                          <ThemedText style={styles.formActionSaveText}>Guardar</ThemedText>
                        </>
                      )}
                    </TouchableOpacity>
                  </ThemedView>
                </ThemedView>
              )}

              {!isLlaveroCreating && (
                <>
                  {isLoading ? (
                    <ThemedView style={styles.loadingContainer}>
                      <ActivityIndicator size="large" color="#007AFF" />
                      <ThemedText style={styles.loadingText}>Cargando...</ThemedText>
                    </ThemedView>
                  ) : filteredLlaveros.length === 0 ? (
                    <ThemedView style={styles.emptyContainer}>
                      <ThemedText style={styles.emptyText}>No hay registros</ThemedText>
                    </ThemedView>
                  ) : (
                    <ThemedView style={styles.listContainer}>
                      {filteredLlaveros.map(renderLlaveroItem)}
                    </ThemedView>
                  )}
                </>
              )}
            </>
          )}
        </ThemedView>
      </ScrollView>

      {showFilterFechaPicker && (
        <DateTimePicker
          value={filterFecha ? parseDateStringToDate(filterFecha) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, date) => {
            setShowFilterFechaPicker(false);
            if (date) setFilterFecha(dateToLocalString(date));
          }}
        />
      )}

      {showLlaveroFilterFechaPicker && (
        <DateTimePicker
          value={llaveroFilterFecha ? parseDateStringToDate(llaveroFilterFecha) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, date) => {
            setShowLlaveroFilterFechaPicker(false);
            if (date) setLlaveroFilterFecha(dateToLocalString(date));
          }}
        />
      )}

      {showLlaveroMovFilterFechaPicker && (
        <DateTimePicker
          value={llaveroMovFilterFecha ? parseDateStringToDate(llaveroMovFilterFecha) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, date) => {
            setShowLlaveroMovFilterFechaPicker(false);
            if (date) setLlaveroMovFilterFecha(dateToLocalString(date));
          }}
        />
      )}

      {showLlaveroMovFechaPicker && (
        <DateTimePicker
          value={llaveroMovFecha ? parseDateStringToDate(llaveroMovFecha) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, date) => {
            setShowLlaveroMovFechaPicker(false);
            if (date) setLlaveroMovFecha(dateToLocalString(date));
          }}
        />
      )}

      {showLlaveroMovHoraPicker && (
        <DateTimePicker
          value={llaveroMovHora ? new Date(`1970-01-01T${llaveroMovHora}`) : new Date()}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, date) => {
            setShowLlaveroMovHoraPicker(false);
            if (date) setLlaveroMovHora(timeToHHMMSS(date));
          }}
        />
      )}

      {/* Modal Movimientos de llaves */}
      <Modal visible={isMovModalVisible} animationType="slide" transparent={false} onRequestClose={closeMovimientosModal}>
        <ThemedView style={styles.modalContainer}>
          <ThemedView style={styles.modalHeader}>
            <ThemedText style={styles.modalTitle}>Movimiento de llaves</ThemedText>
            <TouchableOpacity onPress={closeMovimientosModal}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </ThemedView>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
            <ThemedView style={styles.modalCard}>
              <ThemedText style={styles.modalCardTitle}>Llave:</ThemedText>
              <ThemedText style={styles.modalCardValue}>{movLlave?.lugar_abre || '-'}</ThemedText>
            </ThemedView>

            {/* Filtros movimientos (collapsable) */}
            <ThemedView style={styles.filtersMain}>
              <ThemedView style={styles.filterHeader}>
                <TouchableOpacity
                  style={styles.filterToggleButton}
                  onPress={() => setIsMovFiltersExpanded(!isMovFiltersExpanded)}
                >
                  <ThemedText style={styles.filterToggleText}>Filtros</ThemedText>
                  <Ionicons
                    name={isMovFiltersExpanded ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color="#007AFF"
                  />
                </TouchableOpacity>

                {isMovFiltersExpanded && (
                  <TouchableOpacity
                    style={styles.resetFiltersButton}
                    onPress={() => {
                      setMovFilterSearch('');
                      setMovFilterFecha('');
                    }}
                  >
                    <Ionicons name="refresh" size={16} color="#FF3B30" />
                    <ThemedText style={styles.resetFiltersText}>Reiniciar</ThemedText>
                  </TouchableOpacity>
                )}
              </ThemedView>

              {isMovFiltersExpanded && (
                <ThemedView style={styles.filterContent}>
                  <ThemedView style={styles.filterGroupSearch}>
                    <ThemedText style={styles.filterLabel}>Buscar (persona/depto):</ThemedText>
                    <TextInput
                      style={styles.searchInput}
                      value={movFilterSearch}
                      onChangeText={setMovFilterSearch}
                      placeholder="Ej: Juan / Seguridad / Bodega"
                      placeholderTextColor="#999"
                    />
                  </ThemedView>

                  <ThemedView style={styles.filterGroupSearch}>
                    <ThemedText style={styles.filterLabel}>Fecha:</ThemedText>
                    <TouchableOpacity style={styles.dateButton} onPress={() => setShowMovFilterFechaPicker(true)}>
                      <ThemedText style={styles.dateButtonText}>{movFilterFecha ? formatYMDToDMY(movFilterFecha) : 'Seleccionar fecha'}</ThemedText>
                      <Ionicons name="calendar-outline" size={18} color="#007AFF" />
                    </TouchableOpacity>
                  </ThemedView>
                </ThemedView>
              )}
            </ThemedView>

            {!movIsCreating && (
              <TouchableOpacity style={styles.createButton} onPress={startMovCreating}>
                <ThemedText style={styles.createButtonText}>
                  <Ionicons name="add" size={20} color="#FFFFFF" /> Nuevo movimiento
                </ThemedText>
              </TouchableOpacity>
            )}

            {movIsCreating && (
              <ThemedView style={styles.formCard}>
                <ThemedText style={styles.formTitle}>{movEditing ? 'Editar movimiento' : 'Nuevo movimiento'}</ThemedText>

                <ThemedText style={styles.label}>Nombre persona que entrega *</ThemedText>
                <TextInput style={styles.input} placeholder="Nombre" placeholderTextColor="#999" value={movNombreEntrega} onChangeText={setMovNombreEntrega} />

                <ThemedText style={styles.label}>Nombre persona que recibe *</ThemedText>
                <TextInput style={styles.input} placeholder="Nombre" placeholderTextColor="#999" value={movNombreRecibe} onChangeText={setMovNombreRecibe} />

                <ThemedText style={styles.label}>Departamento *</ThemedText>
                <TextInput style={styles.input} placeholder="Departamento" placeholderTextColor="#999" value={movDepartamento} onChangeText={setMovDepartamento} />

                <ThemedText style={styles.label}>Teléfono *</ThemedText>
                <TextInput style={styles.input} placeholder="Teléfono" placeholderTextColor="#999" value={movTelefono} onChangeText={setMovTelefono} keyboardType="phone-pad" />


                <ThemedText style={styles.label}>Fecha *</ThemedText>
                <TouchableOpacity style={styles.dateButton} onPress={() => setShowMovFechaPicker(true)}>
                  <ThemedText style={styles.dateButtonText}>{movFecha ? formatYMDToDMY(movFecha) : 'Seleccionar fecha'}</ThemedText>
                  <Ionicons name="calendar-outline" size={18} color="#007AFF" />
                </TouchableOpacity>

                <ThemedText style={styles.label}>Hora *</ThemedText>
                <TouchableOpacity style={styles.dateButton} onPress={() => setShowMovHoraPicker(true)}>
                  <ThemedText style={styles.dateButtonText}>{movHora || 'Seleccionar hora'}</ThemedText>
                  <Ionicons name="time-outline" size={18} color="#007AFF" />
                </TouchableOpacity>

                <ThemedText style={styles.sectionTitle}>Firma entrega *</ThemedText>
                {movFirmaEntrega ? (
                  <ThemedView style={styles.signaturePreviewContainer}>
                    <Image source={{ uri: movFirmaEntrega }} style={styles.signaturePreview} resizeMode="contain" />
                    <TouchableOpacity style={styles.removeSignatureButton} onPress={() => setMovFirmaEntrega('')}>
                      <Ionicons name="trash" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                  </ThemedView>
                ) : null}
                <TouchableOpacity style={styles.openSignatureButton} onPress={() => openDrawSignatureModal('entrega')}>
                  <Ionicons name="create-outline" size={20} color="#000000" />
                  <ThemedText style={styles.openSignatureButtonText}>{movFirmaEntrega ? 'Modificar firma' : 'Agregar firma'}</ThemedText>
                </TouchableOpacity>

                <ThemedText style={styles.sectionTitle}>Firma recibe *</ThemedText>
                {movFirmaRecibe ? (
                  <ThemedView style={styles.signaturePreviewContainer}>
                    <Image source={{ uri: movFirmaRecibe }} style={styles.signaturePreview} resizeMode="contain" />
                    <TouchableOpacity style={styles.removeSignatureButton} onPress={() => setMovFirmaRecibe('')}>
                      <Ionicons name="trash" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                  </ThemedView>
                ) : null}
                <TouchableOpacity style={styles.openSignatureButton} onPress={() => openDrawSignatureModal('recibe')}>
                  <Ionicons name="create-outline" size={20} color="#000000" />
                  <ThemedText style={styles.openSignatureButtonText}>{movFirmaRecibe ? 'Modificar firma' : 'Agregar firma'}</ThemedText>
                </TouchableOpacity>

                <ThemedText style={styles.sectionTitle}>Firma responsable *</ThemedText>
                <ThemedView style={styles.signatureButtons}>
                  <TouchableOpacity
                    style={[styles.signatureButton, isGeneratingMovFirma && styles.signatureButtonDisabled]}
                    onPress={handleGenerateMovFirmaResponsable}
                    disabled={isGeneratingMovFirma}
                  >
                    {isGeneratingMovFirma ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="finger-print" size={18} color="#FFFFFF" />
                        <ThemedText style={styles.signatureButtonText}>Generar</ThemedText>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.signatureButton} onPress={handleScanMovFirmaResponsable}>
                    <Ionicons name="qr-code" size={18} color="#FFFFFF" />
                    <ThemedText style={styles.signatureButtonText}>Escanear QR</ThemedText>
                  </TouchableOpacity>
                </ThemedView>

                {!movFirmaResponsable ? (
                  <ThemedText style={styles.signatureHintMuted}>Aún no hay firma responsable.</ThemedText>
                ) : (
                  <ThemedView style={styles.firmaInfoBox}>
                    <ThemedView style={{ flex: 1, paddingRight: 10 }}>
                      <ThemedText style={styles.firmaInfoTitle}>Información de la firma:</ThemedText>
                      {(() => {
                        const info = decodeFirmaHash(movFirmaResponsable);
                        if (!info) return <ThemedText style={styles.firmaInfoValue}>Formato no decodificable</ThemedText>;
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
                    <TouchableOpacity style={styles.firmaClearButtonTiny} onPress={() => setMovFirmaResponsable('')}>
                      <Ionicons name="trash" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                  </ThemedView>
                )}

                <ThemedView style={styles.formActions}>
                  <TouchableOpacity style={[styles.formActionButton, styles.formActionCancel]} onPress={cancelMovCreating}>
                    <Ionicons name="close" size={18} color="#000" />
                    <ThemedText style={styles.formActionCancelText}>Cancelar</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.formActionButton, styles.formActionSave]} onPress={handleMovSave}>
                    <Ionicons name="save" size={18} color="#fff" />
                    <ThemedText style={styles.formActionSaveText}>Guardar</ThemedText>
                  </TouchableOpacity>
                </ThemedView>
              </ThemedView>
            )}

            {/* Lista (oculta mientras se crea/edita para evitar confusión) */}
            {!movIsCreating && (
              <ThemedView style={{ marginTop: 12 }}>
                {(() => {
                  const q = movFilterSearch.trim().toLowerCase();
                  const filtered = movimientos.filter((m) => {
                    if (movFilterFecha) {
                      const d = m.fecha ? String(m.fecha).split('T')[0] : '';
                      if (d !== movFilterFecha) return false;
                    }
                    if (!q) return true;
                    const hay = `${m.nombre_persona_entrega ?? ''} ${m.nombre_persona_recibe ?? ''} ${m.departamento ?? ''}`.toLowerCase();
                    return hay.includes(q);
                  });

                  if (filtered.length === 0) {
                    return (
                      <ThemedView style={styles.emptyContainer}>
                        <ThemedText style={styles.emptyText}>No hay movimientos</ThemedText>
                      </ThemedView>
                    );
                  }

                  return filtered.map((m, idx) => {
                    const k = m.id !== 0 ? `mv-${m.id}` : m.id_local ? `mv-${m.id_local}` : `mv-${idx}`;
                    const fecha = m.fecha ? String(m.fecha).split('T')[0] : '';
                    const hora = String(m.hora || '').includes('T') ? String(m.hora).split('T')[1]?.split('.')[0] : String(m.hora || '');

                    return (
                      <ThemedView key={k} style={styles.bitacoraCard}>
                        <ThemedText style={styles.bitTitle}>
                          {m.nombre_persona_entrega} → {m.nombre_persona_recibe}
                          {m.id_local ? ' (offline)' : ''}
                        </ThemedText>

                        <ThemedText style={styles.bitLine}>
                          <ThemedText style={styles.bitLabel}>Depto: </ThemedText>
                          <ThemedText style={styles.bitValue}>{m.departamento}</ThemedText>
                        </ThemedText>
                        <ThemedText style={styles.bitLine}>
                          <ThemedText style={styles.bitLabel}>Fecha/Hora: </ThemedText>
                          <ThemedText style={styles.bitValue}>{formatYMDToDMY(fecha)} {hora}</ThemedText>
                        </ThemedText>

                        {/* Firma responsable visible con datos */}
                        {!m.firma_responsable ? (
                          <ThemedText style={styles.signatureHintMuted}>Aún no hay firma responsable.</ThemedText>
                        ) : (
                          <ThemedView style={[styles.firmaInfoBox, { marginTop: 10 }]}>
                            <ThemedView style={{ flex: 1, paddingRight: 10 }}>
                              <ThemedText style={styles.firmaInfoTitle}>Información de la firma:</ThemedText>
                              {(() => {
                                const info = decodeFirmaHash(m.firma_responsable);
                                if (!info) return <ThemedText style={styles.firmaInfoValue}>Formato no decodificable</ThemedText>;
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
                          </ThemedView>
                        )}

                        <ThemedView style={styles.listItemButtons}>
                          <TouchableOpacity style={[styles.listItemButton, styles.editButton]} onPress={() => startMovEditing(m)}>
                            <Ionicons name="pencil" size={18} color="#FFFFFF" />
                            <ThemedText style={styles.listItemButtonText}>Editar</ThemedText>
                          </TouchableOpacity>
                          {!(m.id_local || m.id === 0) && (
                            <TouchableOpacity
                              style={[styles.listItemButton, styles.changesButton]}
                              onPress={() => {
                                setCambiosTitle(`Cambios - Movimiento #${m.id}`);
                                fetchCambios('e_movimiento_llave', m.id);
                              }}
                            >
                              <Ionicons name="list-outline" size={18} color="#FFFFFF" />
                              <ThemedText style={styles.listItemButtonText}>Cambios</ThemedText>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity style={[styles.listItemButton, styles.deleteButton]} onPress={() => handleMovDelete(m)}>
                            <Ionicons name="trash" size={18} color="#FFFFFF" />
                            <ThemedText style={styles.listItemButtonText}>Eliminar</ThemedText>
                          </TouchableOpacity>
                        </ThemedView>
                      </ThemedView>
                    );
                  });
                })()}
              </ThemedView>
            )}
          </ScrollView>

          {showMovFilterFechaPicker && (
            <DateTimePicker
              value={movFilterFecha ? parseDateStringToDate(movFilterFecha) : new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, date) => {
                setShowMovFilterFechaPicker(false);
                if (date) setMovFilterFecha(dateToLocalString(date));
              }}
            />
          )}

          {showMovFechaPicker && (
            <DateTimePicker
              value={movFecha ? parseDateStringToDate(movFecha) : new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, date) => {
                setShowMovFechaPicker(false);
                if (date) setMovFecha(dateToLocalString(date));
              }}
            />
          )}

          {showMovHoraPicker && (
            <DateTimePicker
              value={movHora ? new Date(`1970-01-01T${movHora}`) : new Date()}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, date) => {
                setShowMovHoraPicker(false);
                if (date) setMovHora(timeToHHMMSS(date));
              }}
            />
          )}
        </ThemedView>
      </Modal>

      {/* Modal Movimientos de llaveros */}
      <Modal visible={isLlaveroMovModalVisible} animationType="slide" transparent={false} onRequestClose={closeLlaveroMovimientosModal}>
        <ThemedView style={styles.modalContainer}>
          <ThemedView style={styles.modalHeader}>
            <ThemedText style={styles.modalTitle}>Movimientos de llaveros</ThemedText>
            <TouchableOpacity onPress={closeLlaveroMovimientosModal}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </ThemedView>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
            <ThemedView style={styles.modalCard}>
              <ThemedText style={styles.modalCardTitle}>Llavero:</ThemedText>
              <ThemedText style={styles.modalCardValue}>{movLlavero?.nombre_llavero || '-'}</ThemedText>
            </ThemedView>

            {/* Filtros movimientos (collapsable) */}
            <ThemedView style={styles.filtersMain}>
              <ThemedView style={styles.filterHeader}>
                <TouchableOpacity
                  style={styles.filterToggleButton}
                  onPress={() => setIsLlaveroMovFiltersExpanded(!isLlaveroMovFiltersExpanded)}
                >
                  <ThemedText style={styles.filterToggleText}>Filtros</ThemedText>
                  <Ionicons
                    name={isLlaveroMovFiltersExpanded ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color="#007AFF"
                  />
                </TouchableOpacity>

                {isLlaveroMovFiltersExpanded && (
                  <TouchableOpacity
                    style={styles.resetFiltersButton}
                    onPress={() => {
                      setLlaveroMovFilterSearch('');
                      setLlaveroMovFilterFecha('');
                    }}
                  >
                    <Ionicons name="refresh" size={16} color="#FF3B30" />
                    <ThemedText style={styles.resetFiltersText}>Reiniciar</ThemedText>
                  </TouchableOpacity>
                )}
              </ThemedView>

              {isLlaveroMovFiltersExpanded && (
                <ThemedView style={styles.filterContent}>
                  <ThemedView style={styles.filterGroupSearch}>
                    <ThemedText style={styles.filterLabel}>Buscar (persona/depto):</ThemedText>
                    <TextInput
                      style={styles.searchInput}
                      value={llaveroMovFilterSearch}
                      onChangeText={setLlaveroMovFilterSearch}
                      placeholder="Ej: Juan / Seguridad / Bodega"
                      placeholderTextColor="#999"
                    />
                  </ThemedView>

                  <ThemedView style={styles.filterGroupSearch}>
                    <ThemedText style={styles.filterLabel}>Fecha:</ThemedText>
                    <TouchableOpacity style={styles.dateButton} onPress={() => setShowLlaveroMovFilterFechaPicker(true)}>
                      <ThemedText style={styles.dateButtonText}>{llaveroMovFilterFecha ? formatYMDToDMY(llaveroMovFilterFecha) : 'Seleccionar fecha'}</ThemedText>
                      <Ionicons name="calendar-outline" size={18} color="#007AFF" />
                    </TouchableOpacity>
                  </ThemedView>
                </ThemedView>
              )}
            </ThemedView>

            {!llaveroMovIsCreating && (
              <TouchableOpacity style={styles.createButton} onPress={startLlaveroMovCreating}>
                <ThemedText style={styles.createButtonText}>
                  <Ionicons name="add" size={20} color="#FFFFFF" /> Nuevo movimiento
                </ThemedText>
              </TouchableOpacity>
            )}

            {llaveroMovIsCreating && (
              <ThemedView style={styles.formCard}>
                <ThemedText style={styles.formTitle}>{llaveroMovEditing ? 'Editar movimiento' : 'Nuevo movimiento'}</ThemedText>

                <ThemedText style={styles.label}>Nombre persona que entrega *</ThemedText>
                <TextInput style={styles.input} placeholder="Nombre" placeholderTextColor="#999" value={llaveroMovNombreEntrega} onChangeText={setLlaveroMovNombreEntrega} />

                <ThemedText style={styles.label}>Nombre persona que recibe *</ThemedText>
                <TextInput style={styles.input} placeholder="Nombre" placeholderTextColor="#999" value={llaveroMovNombreRecibe} onChangeText={setLlaveroMovNombreRecibe} />

                <ThemedText style={styles.label}>Departamento *</ThemedText>
                <TextInput style={styles.input} placeholder="Departamento" placeholderTextColor="#999" value={llaveroMovDepartamento} onChangeText={setLlaveroMovDepartamento} />

                <ThemedText style={styles.label}>Teléfono *</ThemedText>
                <TextInput style={styles.input} placeholder="Teléfono" placeholderTextColor="#999" value={llaveroMovTelefono} onChangeText={setLlaveroMovTelefono} keyboardType="phone-pad" />


                <ThemedText style={styles.label}>Fecha *</ThemedText>
                <TouchableOpacity style={styles.dateButton} onPress={() => setShowLlaveroMovFechaPicker(true)}>
                  <ThemedText style={styles.dateButtonText}>{llaveroMovFecha ? formatYMDToDMY(llaveroMovFecha) : 'Seleccionar fecha'}</ThemedText>
                  <Ionicons name="calendar-outline" size={18} color="#007AFF" />
                </TouchableOpacity>

                <ThemedText style={styles.label}>Hora *</ThemedText>
                <TouchableOpacity style={styles.dateButton} onPress={() => setShowLlaveroMovHoraPicker(true)}>
                  <ThemedText style={styles.dateButtonText}>{llaveroMovHora || 'Seleccionar hora'}</ThemedText>
                  <Ionicons name="time-outline" size={18} color="#007AFF" />
                </TouchableOpacity>

                <ThemedText style={styles.sectionTitle}>Firma entrega *</ThemedText>
                {llaveroMovFirmaEntrega ? (
                  <ThemedView style={styles.signaturePreviewContainer}>
                    <Image source={{ uri: llaveroMovFirmaEntrega }} style={styles.signaturePreview} resizeMode="contain" />
                    <TouchableOpacity style={styles.removeSignatureButton} onPress={() => setLlaveroMovFirmaEntrega('')}>
                      <Ionicons name="trash" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                  </ThemedView>
                ) : null}
                <TouchableOpacity style={styles.openSignatureButton} onPress={() => openDrawSignatureModal('entrega')}>
                  <Ionicons name="create-outline" size={20} color="#000000" />
                  <ThemedText style={styles.openSignatureButtonText}>{llaveroMovFirmaEntrega ? 'Modificar firma' : 'Agregar firma'}</ThemedText>
                </TouchableOpacity>

                <ThemedText style={styles.sectionTitle}>Firma recibe *</ThemedText>
                {llaveroMovFirmaRecibe ? (
                  <ThemedView style={styles.signaturePreviewContainer}>
                    <Image source={{ uri: llaveroMovFirmaRecibe }} style={styles.signaturePreview} resizeMode="contain" />
                    <TouchableOpacity style={styles.removeSignatureButton} onPress={() => setLlaveroMovFirmaRecibe('')}>
                      <Ionicons name="trash" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                  </ThemedView>
                ) : null}
                <TouchableOpacity style={styles.openSignatureButton} onPress={() => openDrawSignatureModal('recibe')}>
                  <Ionicons name="create-outline" size={20} color="#000000" />
                  <ThemedText style={styles.openSignatureButtonText}>{llaveroMovFirmaRecibe ? 'Modificar firma' : 'Agregar firma'}</ThemedText>
                </TouchableOpacity>

                <ThemedText style={styles.sectionTitle}>Firma responsable *</ThemedText>
                <ThemedView style={styles.signatureButtons}>
                  <TouchableOpacity
                    style={[styles.signatureButton, isGeneratingLlaveroMovFirma && styles.signatureButtonDisabled]}
                    onPress={async () => {
                      if (isGeneratingLlaveroMovFirma) return;
                      setIsGeneratingLlaveroMovFirma(true);
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
                        const horaAccion = await getHoraAccion();
                        const hash = btoa(`${sessionId}:${employee.id}:${loc.coords.latitude}:${loc.coords.longitude}:${horaAccion}`);
                        setLlaveroMovFirmaResponsable(hash);
                      } catch (e: any) {
                        Alert.alert('Error', e.message || 'No se pudo generar la firma');
                      } finally {
                        setIsGeneratingLlaveroMovFirma(false);
                      }
                    }}
                    disabled={isGeneratingLlaveroMovFirma}
                  >
                    {isGeneratingLlaveroMovFirma ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="finger-print" size={18} color="#FFFFFF" />
                        <ThemedText style={styles.signatureButtonText}>Generar</ThemedText>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.signatureButton} onPress={async () => {
                    try {
                      const qrData = await scanQR();
                      if (!qrData) return;
                      setLlaveroMovFirmaResponsable(qrData);
                    } catch {
                      Alert.alert('Error', 'No se pudo escanear el QR');
                    }
                  }}>
                    <Ionicons name="qr-code" size={18} color="#FFFFFF" />
                    <ThemedText style={styles.signatureButtonText}>Escanear QR</ThemedText>
                  </TouchableOpacity>
                </ThemedView>

                {!llaveroMovFirmaResponsable ? (
                  <ThemedText style={styles.signatureHintMuted}>Aún no hay firma responsable.</ThemedText>
                ) : (
                  <ThemedView style={styles.firmaInfoBox}>
                    <ThemedView style={{ flex: 1, paddingRight: 10 }}>
                      <ThemedText style={styles.firmaInfoTitle}>Información de la firma:</ThemedText>
                      {(() => {
                        const info = decodeFirmaHash(llaveroMovFirmaResponsable);
                        if (!info) return <ThemedText style={styles.firmaInfoValue}>Formato no decodificable</ThemedText>;
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
                    <TouchableOpacity style={styles.firmaClearButtonTiny} onPress={() => setLlaveroMovFirmaResponsable('')}>
                      <Ionicons name="trash" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                  </ThemedView>
                )}

                <ThemedView style={styles.formActions}>
                  <TouchableOpacity style={[styles.formActionButton, styles.formActionCancel]} onPress={cancelLlaveroMovCreating}>
                    <Ionicons name="close" size={18} color="#000" />
                    <ThemedText style={styles.formActionCancelText}>Cancelar</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.formActionButton, styles.formActionSave]} onPress={handleLlaveroMovSave}>
                    <Ionicons name="save" size={18} color="#fff" />
                    <ThemedText style={styles.formActionSaveText}>Guardar</ThemedText>
                  </TouchableOpacity>
                </ThemedView>
              </ThemedView>
            )}

            {/* Lista (oculta mientras se crea/edita para evitar confusión) */}
            {!llaveroMovIsCreating && (
              <ThemedView style={{ marginTop: 12 }}>
                {(() => {
                  const q = llaveroMovFilterSearch.trim().toLowerCase();
                  const filtered = llaveroMovimientos.filter((m) => {
                    if (llaveroMovFilterFecha) {
                      const d = m.fecha ? String(m.fecha).split('T')[0] : '';
                      if (d !== llaveroMovFilterFecha) return false;
                    }
                    if (!q) return true;
                    const hay = `${m.nombre_persona_entrega ?? ''} ${m.nombre_persona_recibe ?? ''} ${m.departamento ?? ''}`.toLowerCase();
                    return hay.includes(q);
                  });

                  if (filtered.length === 0) {
                    return (
                      <ThemedView style={styles.emptyContainer}>
                        <ThemedText style={styles.emptyText}>No hay movimientos</ThemedText>
                      </ThemedView>
                    );
                  }

                  return filtered.map((m, idx) => {
                    const k = m.id !== 0 ? `mv-llavero-${m.id}` : m.id_local ? `mv-llavero-${m.id_local}` : `mv-llavero-${idx}`;
                    const fecha = m.fecha ? String(m.fecha).split('T')[0] : '';
                    const hora = String(m.hora || '').includes('T') ? String(m.hora).split('T')[1]?.split('.')[0] : String(m.hora || '');

                    return (
                      <ThemedView key={k} style={styles.bitacoraCard}>
                        <ThemedText style={styles.bitTitle}>
                          {m.nombre_persona_entrega} → {m.nombre_persona_recibe}
                          {m.id_local ? ' (offline)' : ''}
                        </ThemedText>

                        <ThemedText style={styles.bitLine}>
                          <ThemedText style={styles.bitLabel}>Depto: </ThemedText>
                          <ThemedText style={styles.bitValue}>{m.departamento}</ThemedText>
                        </ThemedText>
                        <ThemedText style={styles.bitLine}>
                          <ThemedText style={styles.bitLabel}>Fecha/Hora: </ThemedText>
                          <ThemedText style={styles.bitValue}>{formatYMDToDMY(fecha)} {hora}</ThemedText>
                        </ThemedText>

                        {/* Firma responsable visible con datos */}
                        {!m.firma_responsable ? (
                          <ThemedText style={styles.signatureHintMuted}>Aún no hay firma responsable.</ThemedText>
                        ) : (
                          <ThemedView style={[styles.firmaInfoBox, { marginTop: 10 }]}>
                            <ThemedView style={{ flex: 1, paddingRight: 10 }}>
                              <ThemedText style={styles.firmaInfoTitle}>Información de la firma:</ThemedText>
                              {(() => {
                                const info = decodeFirmaHash(m.firma_responsable);
                                if (!info) return <ThemedText style={styles.firmaInfoValue}>Formato no decodificable</ThemedText>;
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
                          </ThemedView>
                        )}

                        <ThemedView style={styles.listItemButtons}>
                          <TouchableOpacity style={[styles.listItemButton, styles.editButton]} onPress={() => startLlaveroMovEditing(m)}>
                            <Ionicons name="pencil" size={18} color="#FFFFFF" />
                            <ThemedText style={styles.listItemButtonText}>Editar</ThemedText>
                          </TouchableOpacity>
                          {!(m.id_local || m.id === 0) && (
                            <TouchableOpacity
                              style={[styles.listItemButton, styles.changesButton]}
                              onPress={() => {
                                setCambiosTitle(`Cambios - Movimiento #${m.id}`);
                                fetchCambios('e_movimiento_llavero', m.id);
                              }}
                            >
                              <Ionicons name="list-outline" size={18} color="#FFFFFF" />
                              <ThemedText style={styles.listItemButtonText}>Cambios</ThemedText>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity style={[styles.listItemButton, styles.deleteButton]} onPress={() => handleLlaveroMovDelete(m)}>
                            <Ionicons name="trash" size={18} color="#FFFFFF" />
                            <ThemedText style={styles.listItemButtonText}>Eliminar</ThemedText>
                          </TouchableOpacity>
                        </ThemedView>
                      </ThemedView>
                    );
                  });
                })()}
              </ThemedView>
            )}
          </ScrollView>

          {showLlaveroMovFilterFechaPicker && (
            <DateTimePicker
              value={llaveroMovFilterFecha ? parseDateStringToDate(llaveroMovFilterFecha) : new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, date) => {
                setShowLlaveroMovFilterFechaPicker(false);
                if (date) setLlaveroMovFilterFecha(dateToLocalString(date));
              }}
            />
          )}

          {showLlaveroMovFechaPicker && (
            <DateTimePicker
              value={llaveroMovFecha ? parseDateStringToDate(llaveroMovFecha) : new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, date) => {
                setShowLlaveroMovFechaPicker(false);
                if (date) setLlaveroMovFecha(dateToLocalString(date));
              }}
            />
          )}

          {showLlaveroMovHoraPicker && (
            <DateTimePicker
              value={llaveroMovHora ? new Date(`1970-01-01T${llaveroMovHora}`) : new Date()}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, date) => {
                setShowLlaveroMovHoraPicker(false);
                if (date) setLlaveroMovHora(timeToHHMMSS(date));
              }}
            />
          )}
        </ThemedView>
      </Modal>

      {/* Modal flotante para dibujar firma (entrega/recibe) */}
      <Modal
        visible={isDrawSignatureModalVisible}
        animationType="fade"
        transparent
        presentationStyle="overFullScreen"
        onRequestClose={closeDrawSignatureModal}
      >
        <View style={styles.overlay}>
          <ThemedView style={styles.floatModalCard}>
            <ThemedView style={styles.floatModalHeader}>
              <ThemedText style={styles.modalTitle}>
                Dibujar firma ({drawSignatureTarget === 'entrega' ? 'Entrega' : 'Recibe'})
              </ThemedText>
              <TouchableOpacity onPress={closeDrawSignatureModal}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </ThemedView>

            <ThemedText style={styles.signatureModalHint}>Firma dentro del recuadro blanco.</ThemedText>

            <View style={styles.signaturePadBox}>
              <SignatureScreen
                ref={signatureRef}
                onOK={handleSignatureRead}
                onEmpty={() => {
                  setIsReadingSignature(false);
                  Alert.alert('Error', 'No se detectó la firma. Intenta de nuevo.');
                }}
                descriptionText=""
                clearText=""
                confirmText=""
                webStyle={`
                  .m-signature-pad--footer {display: none; margin: 0px;}
                  .m-signature-pad {box-shadow: none; border: none;}
                  body,html {width: 100%; height: 100%; background: #ffffff;}
                `}
                key={signatureKey}
              />
            </View>

            <ThemedView style={styles.modalActions}>
              <TouchableOpacity style={styles.modalClearButton} onPress={clearSignatureInModal}>
                <Ionicons name="trash" size={20} color="#000000" />
                <ThemedText style={styles.modalClearButtonText}>Limpiar</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalAcceptButton, isReadingSignature && { opacity: 0.7 }]}
                onPress={acceptSignature}
                disabled={isReadingSignature}
              >
                {isReadingSignature ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <Ionicons name="checkmark" size={20} color="#000000" />
                )}
                <ThemedText style={styles.modalAcceptButtonText}>Aceptar</ThemedText>
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
                              {(Array.isArray(parsed) ? parsed : []).map((c: any, idx: number) => (
                                <ThemedText key={`c-${row.id}-${idx}`} style={styles.changeDescription}>
                                  <ThemedText style={{ fontWeight: '800' }}>{String(c?.prop ?? '-')}: </ThemedText>
                                  {formatChangeValue(c?.prop, c?.after)}
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
      <SlideMenu isVisible={isMenuVisible} onClose={handleMenuClose} onHomePress={handleHomePress} currentRoute="Llaves" />
      {QRScannerComponent}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  // Estructura/layout (idéntico patrón que BitacoraVehiculosDetenidosScreen)
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },
  content: { width: '100%', maxWidth: 800, alignSelf: 'center' },

  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    gap: 8,
  },
  tabButtonActive: {
    backgroundColor: '#007AFF',
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
  },

  // Expandable
  expandableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 6,
    marginTop: 10,
  },
  expandableContent: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 6,
    maxHeight: 300,
  },
  llavesSelectorContainer: {
    maxHeight: 250,
  },
  llaveSelectorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    gap: 8,
  },
  llaveSelectorItemSelected: {
    backgroundColor: '#E3F2FD',
    borderColor: '#007AFF',
  },
  llaveSelectorText: {
    fontSize: 14,
    color: '#333',
  },
  llaveSelectorTextSelected: {
    fontWeight: '600',
    color: '#007AFF',
  },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 16, fontSize: 16, opacity: 0.7 },
  errorText: { color: '#FF3B30', textAlign: 'center', marginBottom: 12 },

  titleContainer: {
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, opacity: 0.7, textAlign: 'center' },

  // Filtros (mismo patrón que Bitácora)
  filtersMain: {
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F0F0F0',
  },
  filterToggleButton: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterToggleText: { fontSize: 14, fontWeight: '600', color: '#007AFF' },
  resetFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#FFECEC',
  },
  resetFiltersText: { fontSize: 12, color: '#FF3B30', fontWeight: '600' },
  filterContent: { padding: 12, backgroundColor: '#F9F9F9', gap: 8 },
  filterGroupSearch: { marginBottom: 8, backgroundColor: '#F9F9F9' },
  filterLabel: { fontSize: 13, fontWeight: '600', marginBottom: 4, color: '#000' },
  searchInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    backgroundColor: '#FFFFFF',
    color: '#000000',
  },
  dateButton: {
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  dateButtonText: { color: '#000', fontWeight: '600' },

  createButton: { backgroundColor: '#007AFF', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginBottom: 16 },
  createButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },

  formCard: { marginTop: 12, backgroundColor: '#fff', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#E0E0E0' },
  formTitle: { fontSize: 18, fontWeight: '800', marginBottom: 10, color: '#000' },
  label: { fontSize: 13, fontWeight: '700', marginTop: 10, color: '#333' },
  input: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, backgroundColor: '#fff', color: '#000', marginBottom: 6 },
  textArea: { minHeight: 90, textAlignVertical: 'top' },

  sectionTitle: { marginTop: 14, fontSize: 15, fontWeight: '800', color: '#007AFF' },

  // Firma responsable (mismo patrón que Bitácora)
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

  formActions: { marginTop: 16, flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  formActionButton: { flex: 1, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12 },
  formActionCancel: { backgroundColor: '#EDEDED' },
  formActionCancelText: { color: '#000', fontWeight: '800' },
  formActionSave: { backgroundColor: '#007AFF' },
  formActionSaveText: { color: '#fff', fontWeight: '800' },
  buttonDisabled: {
    opacity: 0.6,
  },
  responseContainer: {
    padding: 12,
    borderRadius: 6,
    marginBottom: 12,
  },
  responseSuccess: {
    backgroundColor: '#D4EDDA',
    borderWidth: 1,
    borderColor: '#C3E6CB',
  },
  responseError: {
    backgroundColor: '#F8D7DA',
    borderWidth: 1,
    borderColor: '#F5C6CB',
  },
  responseText: {
    fontSize: 14,
    fontWeight: '600',
  },

  listContainer: {},
  emptyContainer: { padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 14, opacity: 0.6, textAlign: 'center', color: '#000' },

  // Cards + collapse (igual que Bitácora)
  bitacoraCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  bitTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10, color: '#000' },
  bitLine: { marginBottom: 6, color: '#000' },
  bitLabel: { fontWeight: '700', color: '#333' },
  bitValue: { color: '#000' },

  collapseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginTop: 8,
    backgroundColor: '#FAFAFA',
  },
  collapseButtonText: { fontSize: 13, fontWeight: '600', color: '#007AFF' },
  collapsableContent: { marginTop: 8, padding: 10, borderRadius: 8, backgroundColor: '#F8F9FA' },

  listItemButtons: { marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  listItemButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 8, gap: 8 },
  movementsButton: { backgroundColor: '#34C759' },
  editButton: { backgroundColor: '#007AFF' },
  changesButton: { backgroundColor: '#5856D6', flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 8, gap: 8 },
  deleteButton: { backgroundColor: '#FF3B30' },
  listItemButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },

  // Modal (estilo tipo bootstrap)
  modalContainer: { flex: 1, backgroundColor: '#FFFFFF' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#F8F9FA',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#000' },
  modalCard: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  modalCardTitle: { fontSize: 13, fontWeight: '800', color: '#333' },
  modalCardValue: { marginTop: 6, fontSize: 15, fontWeight: '800', color: '#000' },

  // Firma dibujada (preview + botón)
  signaturePreviewContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    marginTop: 10,
    marginBottom: 10,
    position: 'relative',
  },
  signaturePreview: { width: '100%', height: '100%' },
  removeSignatureButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  openSignatureButton: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingVertical: 12,
    backgroundColor: '#F8F9FA',
    gap: 10,
  },
  openSignatureButtonText: { fontWeight: '800', color: '#000' },

  modalSignatureContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E0E0E0',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    gap: 12,
    backgroundColor: '#FFFFFF',
  },
  modalClearButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#EDEDED',
    gap: 8,
  },
  modalClearButtonText: { fontWeight: '800', color: '#000' },
  modalAcceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#D7F5E5',
    gap: 8,
  },
  modalAcceptButtonText: { fontWeight: '800', color: '#000' },

  // Overlay modal flotante (bootstrap-like)
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  floatModalCard: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  floatModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#F8F9FA',
  },
  floatModalCardMovimientos: { backgroundColor: '#FFFFFF', borderRadius: 12, width: '100%', maxWidth: 500, maxHeight: '80%', borderWidth: 1, borderColor: '#E0E0E0', overflow: 'hidden' },
  floatModalScroll: { flex: 1 },
  floatModalScrollContent: { padding: 16 },
  floatModalFilters: { marginBottom: 16 },
  formGroup: { marginTop: 10, marginBottom: 10 },
  cambioCollapsableMain: { width: '100%', marginBottom: 10, backgroundColor: '#fff', borderRadius: 6, borderWidth: 1, borderColor: '#E0E0E0', overflow: 'hidden' },
  cambioCollapsableHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#F8F9FA' },
  cambioCollapsableTitle: { fontSize: 14, fontWeight: '600', color: '#007AFF', flex: 1 },
  cambioCollapsableContent: { padding: 12, gap: 8, backgroundColor: '#F8F9FA' },
  changeDescription: { fontSize: 14, lineHeight: 20, color: '#666', marginBottom: 8 },
  signatureModalHint: { paddingHorizontal: 16, paddingTop: 12, color: '#666', fontSize: 13 },
  signaturePadBox: {
    marginTop: 10,
    marginHorizontal: 16,
    height: 260,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    overflow: 'hidden',
  },
});


