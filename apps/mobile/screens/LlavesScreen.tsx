import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Platform, Modal, View, Image, Dimensions } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import DateTimePicker from '@react-native-community/datetimepicker';
import getCurrentUserDigitalSignature from '../hooks/getCurrentUserDigitalSignature';
import Ionicons from '@expo/vector-icons/Ionicons';
import SignatureScreen from 'react-native-signature-canvas';
import Constants from 'expo-constants';

import AppHeader from '../components/AppHeader';
import AppFooter from '../components/AppFooter';
import SlideMenu from '../components/SlideMenu';
import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import CambiosAppsModulesModal, { type CambiosAppsModulesRow } from '@/components/CambiosAppsModulesModal';
import { useAuth } from '../contexts/AuthContext';
import { eventBus } from '../hooks/eventBus';
import getHoraAccion from '../hooks/getHoraAccion';
import { useQRScanner } from '../hooks/useQRScanner';
import authedFetch from '../hooks/authedFetch';
import { createLlave, deleteLlave, listLlaves, LlaveItem, updateLlave } from '../hooks/llavesFunctions';
import {
  readMainStructureTree,
  writeMainStructureTree,
  findHierarchyByCorpoIn,
  getSucursalDataFromTree,
  getFirstPuestoIdFromSucursalInTree,
  findHierarchyByPuestoIn,
  persistCorpoLlavesInMainStructure,
  persistCorpoLlaverosInMainStructure,
  normalizeLlaveroLinksForStructure,
  enrichLlaveroLlavesLinks,
  upsertLlaveInCorpoTree,
  upsertLlaveroInCorpoTree,
  applyLlaveUpdatePayloadToTree,
  applyLlaveroUpdatePayloadToTree,
  removeLlaveFromCorpoTreeAndStripLlaveroLinks,
  removeLlaveroFromCorpoTree,
  moveLlaveBetweenCorposInTree,
  moveLlaveroBetweenCorposInTree,
  findCorpoAndLlaveRowInTree,
  findCorpoAndLlaveroRowInTree,
} from '../hooks/llavesMainStructureHelpers';
import { createMovimientoLlave, deleteMovimientoLlave, updateMovimientoLlave } from '../hooks/movimientosLlavesFunctions';
import { createLlavero, deleteLlavero, listLlaveros, LlaveroItem, updateLlavero } from '../hooks/llaverosFunctions';
import { createMovimientoLlavero, deleteMovimientoLlavero, updateMovimientoLlavero } from '../hooks/movimientosLlaverosFunctions';
import { convertDateTimestampToLocalString } from '@/hooks/convertDateTimestampToLocalString';
import { loadMainStructureTreeMerged } from '@/hooks/bitacoraMainStructureCache';
import HierarchyPickerFields, { type HierarchyPickerValues } from '@/components/HierarchyPickerFields';

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
  firma_entrega?: string | null;
  firma_recibe?: string | null;
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
  firma_entrega?: string | null;
  firma_recibe?: string | null;
  firma_responsable: string;
};

const llaveRowKey = (it: LlaveUI) => String(it.id_local || (it.id ?? ''));
const llaveroRowKey = (it: LlaveroUI) => String(it.id_local || (it.id ?? ''));
const movimientoLlaveRowKey = (m: MovimientoUI) => String(m.id_local || (m.id ?? ''));
const movimientoLlaveroRowKey = (m: MovimientoLlaveroUI) => String(m.id_local || (m.id ?? ''));

function resolveCorpoIdFromMarca(marca: any): number | null {
  const raw = marca?.corpo?.id ?? marca?.corpo_id;
  if (raw === undefined || raw === null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

type RoleName = 'OPERATIVO' | 'SUPERVISOR' | 'ADMINISTRATIVO' | string | null;

type MainStructureTree = any[];

function numOrNull(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function getDivisionIdFromMarcaJson(marca: any): number | null {
  const raw =
    marca?.roleDivision?.division?.id ??
    marca?.role_division?.division?.id ??
    marca?.division?.id ??
    marca?.division_id;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

type MarcaSnapshot = {
  current: Record<string, any> | null;
  roleName: string | null;
  isOperativo: boolean;
  marcaDivisionId: number | null;
  marcaCorpoId: number | null;
  marcaClienteId: number | null;
  marcaEmpresaId: number | null;
  filterEmpresaId: number | null;
  filterClienteId: number | null;
  filterDivisionId: number | null;
  filterContratoId: number | null;
  filterSucursalId: number | null;
};

function resolveListCorpoIdFromSnap(snap: MarcaSnapshot | null, filterSucursalId: number | null): number | null {
  if (snap?.isOperativo) return snap.marcaCorpoId;
  const fs = filterSucursalId ?? snap?.filterSucursalId ?? null;
  if (fs != null) return fs;
  return snap?.marcaCorpoId ?? null;
}

const normalizeLlavesList = (arr: any[]): LlaveUI[] =>
  (arr || [])
    .filter((it: any) => it == null || it.isActive !== false)
    .map((it: any) => ({
    ...it,
    id_local: it.id_local || '',
    movimientos: (it.movimientos || []).map((m: any) => ({ ...m, id_local: m.id_local || '' })),
  }));

const normalizeLlaverosList = (arr: any[]): LlaveroUI[] =>
  (arr || [])
    .filter((it: any) => it == null || it.isActive !== false)
    .map((it: any) => ({
    ...it,
    id_local: it.id_local || '',
    movimientos: (it.movimientos || []).map((m: any) => ({ ...m, id_local: m.id_local || '' })),
    llaves: (it.llaves || []).map((l: any) => ({ ...l })),
  }));

export default function LlavesScreen() {
  const navigation = useNavigation<any>();
  const { employee, refreshAccessToken, logout } = useAuth();
  /** AuthContext no memoiza refresh/logout: sin ref, cualquier useCallback que los liste cambia cada render y re-dispara effects (p. ej. bucle en el picker de llaves del formulario de llavero). */
  const authFetchRef = useRef({ refreshAccessToken, logout });
  authFetchRef.current = { refreshAccessToken, logout };
  const { scanQR, QRScannerComponent } = useQRScanner();

  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const handleMenuPress = () => setIsMenuVisible(true);
  const handleMenuClose = () => setIsMenuVisible(false);
  const handleHomePress = () => navigation.navigate('Home');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasCurrentMarca, setHasCurrentMarca] = useState(true);
  const [marcaId, setMarcaId] = useState<number | null>(null);

  const [roleName, setRoleName] = useState<RoleName>(null);
  const [marcaDivisionId, setMarcaDivisionId] = useState<number | null>(null);
  const [marcaCorpoId, setMarcaCorpoId] = useState<number | null>(null);
  const [marcaClienteId, setMarcaClienteId] = useState<number | null>(null);
  const [marcaEmpresaId, setMarcaEmpresaId] = useState<number | null>(null);

  const [filterEmpresaId, setFilterEmpresaId] = useState<number | null>(null);
  const [filterClienteId, setFilterClienteId] = useState<number | null>(null);
  const [filterDivisionId, setFilterDivisionId] = useState<number | null>(null);
  const [filterContratoId, setFilterContratoId] = useState<number | null>(null);
  const [filterSucursalId, setFilterSucursalId] = useState<number | null>(null);
  const listFiltersSyncedFromMarcaOnceRef = useRef(false);
  const filterSucursalIdRef = useRef<number | null>(null);

  const [structure, setStructure] = useState<MainStructureTree>([]);
  const [isStructureLoading, setIsStructureLoading] = useState(false);

  const [selectedEmpresaId, setSelectedEmpresaId] = useState<number | null>(null);
  const [selectedClienteId, setSelectedClienteId] = useState<number | null>(null);
  const [selectedDivisionId, setSelectedDivisionId] = useState<number | null>(null);
  const [selectedContratoId, setSelectedContratoId] = useState<number | null>(null);
  const [selectedSucursalId, setSelectedSucursalId] = useState<number | null>(null);
  /** Puesto (e_estructura_puesto) para creación/edición; requerido vía formulario o marca OPERATIVO. */
  const [selectedPuestoId, setSelectedPuestoId] = useState<number | null>(null);

  const [llaves, setLlaves] = useState<LlaveUI[]>([]);

  // Tab selector: Llaves / Llaveros
  const [activeTab, setActiveTab] = useState<'llaves' | 'llaveros'>('llaves');

  // Submódulo: Llaveros
  const [llaveros, setLlaveros] = useState<LlaveroUI[]>([]);
  const [isLlaveroCreating, setIsLlaveroCreating] = useState(false);
  const [llaveroEditing, setLlaveroEditing] = useState<LlaveroUI | null>(null);
  const [llaveroNombre, setLlaveroNombre] = useState('');
  const [llaveroNumero, setLlaveroNumero] = useState('');
  const [llaveroObservaciones, setLlaveroObservaciones] = useState('');
  const [llaveroFirmaResponsable, setLlaveroFirmaResponsable] = useState('');
  /** Selección de llaves para llavero: `s:<id servidor>` o `l:<id_local>` (llaves solo offline). */
  const [llaveroSelectedLlaveKeys, setLlaveroSelectedLlaveKeys] = useState<string[]>([]);
  const [isLlaveroLlavesExpanded, setIsLlaveroLlavesExpanded] = useState(false);
  const [llaveroPickerLlaves, setLlaveroPickerLlaves] = useState<LlaveUI[]>([]);
  const [llaveroPickerLoading, setLlaveroPickerLoading] = useState(false);
  const [isGeneratingLlaveroFirma, setIsGeneratingLlaveroFirma] = useState(false);
  const [llaveroFilterSearch, setLlaveroFilterSearch] = useState('');
  const [llaveroFilterFecha, setLlaveroFilterFecha] = useState('');
  const [showLlaveroFilterFechaPicker, setShowLlaveroFilterFechaPicker] = useState(false);

  // Submódulo: Movimiento de llaveros (CRUD dentro de modal)
  const [isLlaveroMovModalVisible, setIsLlaveroMovModalVisible] = useState(false);
  const [movLlavero, setMovLlavero] = useState<LlaveroUI | null>(null);
  const [llaveroMovimientos, setLlaveroMovimientos] = useState<MovimientoLlaveroUI[]>([]);
  const [llaveroMovIsCreating, setLlaveroMovIsCreating] = useState(false);
  const [llaveroMovEditing, setLlaveroMovEditing] = useState<MovimientoLlaveroUI | null>(null);
  const [isSavingLlaveroMov, setIsSavingLlaveroMov] = useState(false);
  const [deletingLlaveKey, setDeletingLlaveKey] = useState<string | null>(null);
  const [deletingLlaveroKey, setDeletingLlaveroKey] = useState<string | null>(null);
  const [deletingMovLlaveKey, setDeletingMovLlaveKey] = useState<string | null>(null);
  const [deletingMovLlaveroKey, setDeletingMovLlaveroKey] = useState<string | null>(null);
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
  const [isSavingMov, setIsSavingMov] = useState(false);

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
  const [cambiosItems, setCambiosItems] = useState<CambiosAppsModulesRow[]>([]);

  // UI: filtros (collapsable)
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  const [filterSearch, setFilterSearch] = useState('');
  const [filterFecha, setFilterFecha] = useState('');
  const [showFilterFechaPicker, setShowFilterFechaPicker] = useState(false);

  // UI: create/edit
  const [isCreating, setIsCreating] = useState(false);
  const [editing, setEditing] = useState<LlaveUI | null>(null);
  const [numeroLlave, setNumeroLlave] = useState('');
  const [lugarAbre, setLugarAbre] = useState('');
  const [cantidadCopias, setCantidadCopias] = useState<string>('1');
  const [observaciones, setObservaciones] = useState('');
  const [firmaResponsable, setFirmaResponsable] = useState('');

  const [isGeneratingFirma, setIsGeneratingFirma] = useState(false);
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

  const formatSignatureForDisplay = (value?: string | null): string => {
    if (!value) return '';
    return value.startsWith('data:') ? value : `data:image/png;base64,${value}`;
  };

  const dateToLocalString = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const formatYMDToDMY = (value?: string): string => {
    return convertDateTimestampToLocalString(value || '', false);
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
    // Ajuste por timezone para que la hora visual seleccionada
    // sea exactamente la misma que se guarda en HH:mm:ss.
    const adjusted = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return adjusted.toISOString().substring(11, 19);
  };

  const normalizeTimeValue = (value?: string): string => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    let t = raw.includes('T') ? raw.split('T')[1]?.split('.')[0] || '' : raw;
    if (t.length >= 8 && t[8] !== ':') t = t.slice(0, 8);
    const parts = t.split(':').map((p) => p.trim());
    if (parts.length >= 2) {
      const h = String(Math.min(23, parseInt(parts[0], 10) || 0)).padStart(2, '0');
      const m = String(Math.min(59, parseInt(parts[1], 10) || 0)).padStart(2, '0');
      const s = String(Math.min(59, parseInt(parts[2] ?? '0', 10) || 0)).padStart(2, '0');
      return `${h}:${m}:${s}`;
    }
    return t;
  };

  const timeStringToPickerDate = (value?: string): Date => {
    const normalized = normalizeTimeValue(value);
    if (!normalized) return new Date();
    const [h, m, s] = normalized.split(':');
    const date = new Date();
    date.setHours(Number(h) || 0, Number(m) || 0, Number(s) || 0, 0);
    return date;
  };

  const getConnectionStatus = async (): Promise<boolean> => {
    //return false;
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

  const syncMarcaFromStorage = useCallback(
    async (opts?: { applyFiltersFromMarca?: boolean }): Promise<MarcaSnapshot | null> => {
      const applyFiltersFromMarca = opts?.applyFiltersFromMarca !== false;
      const currentMarcaStr = await AsyncStorage.getItem('current_marca');
      if (!currentMarcaStr) {
        setHasCurrentMarca(false);
        setMarcaDivisionId(null);
        setMarcaCorpoId(null);
        setMarcaClienteId(null);
        setMarcaEmpresaId(null);
        setRoleName(null);
        if (applyFiltersFromMarca) {
          setFilterEmpresaId(null);
          setFilterClienteId(null);
          setFilterDivisionId(null);
          setFilterContratoId(null);
          setFilterSucursalId(null);
          filterSucursalIdRef.current = null;
        }
        return null;
      }
      try {
        const current = JSON.parse(currentMarcaStr);
        if (!current?.id) {
          setHasCurrentMarca(false);
          setMarcaId(null);
          setMarcaDivisionId(null);
          setMarcaCorpoId(null);
          setMarcaClienteId(null);
          setMarcaEmpresaId(null);
          setRoleName(null);
          return null;
        }
        setHasCurrentMarca(true);
        setMarcaId(current.id);
        const divIdRaw = current?.roleDivision?.division?.id ?? current?.division_id;
        const corpoIdRaw = current?.corpo?.id ?? current?.corpo_id;
        const clienteIdRaw = current?.cliente?.id ?? current?.cliente_id;
        const empresaIdRaw = current?.empresa?.id ?? current?.empresa_id;
        const divId = numOrNull(divIdRaw);
        const corpoId = numOrNull(corpoIdRaw);
        const clienteId = numOrNull(clienteIdRaw);
        const empresaId = numOrNull(empresaIdRaw);
        const role =
          current?.roleDivision?.role?.nombre ??
          current?.role_division?.role?.nombre ??
          null;
        const rn = typeof role === 'string' ? (role as RoleName) : null;

        setMarcaDivisionId(divId);
        setMarcaCorpoId(corpoId);
        setMarcaClienteId(clienteId);
        setMarcaEmpresaId(empresaId);
        setRoleName(rn);

        const divFromMarca = getDivisionIdFromMarcaJson(current);
        const fe = numOrNull(current?.empresa?.id);
        const fc = numOrNull(current?.cliente?.id);
        const fco = numOrNull(current?.contrato?.id);
        const fs = numOrNull(current?.corpo?.id ?? current?.corpo_id);
        if (applyFiltersFromMarca) {
          setFilterEmpresaId(fe);
          setFilterClienteId(fc);
          setFilterDivisionId(divFromMarca);
          setFilterContratoId(fco);
          setFilterSucursalId(fs);
          filterSucursalIdRef.current = fs;
        }

        return {
          current,
          roleName: rn,
          isOperativo: rn === 'OPERATIVO',
          marcaDivisionId: divId,
          marcaCorpoId: corpoId,
          marcaClienteId: clienteId,
          marcaEmpresaId: empresaId,
          filterEmpresaId: fe,
          filterClienteId: fc,
          filterDivisionId: divFromMarca,
          filterContratoId: fco,
          filterSucursalId: fs,
        };
      } catch {
        setHasCurrentMarca(false);
        return null;
      }
    },
    []
  );

  const fetchMainStructure = useCallback(async () => {
    setIsStructureLoading(true);
    try {
      const merged = await loadMainStructureTreeMerged();
      setStructure(Array.isArray(merged) ? merged : []);
    } catch (e) {
      console.error('Error loading main structure (Llaves):', e);
      setStructure([]);
    } finally {
      setIsStructureLoading(false);
    }
  }, []);

  const filterClienteOptionsMemo = useMemo(() => {
    const empresa = structure.find((e: any) => e.id === filterEmpresaId);
    return empresa?.clientes ?? [];
  }, [structure, filterEmpresaId]);
  const filterDivisionOptionsMemo = useMemo(() => {
    const cliente = filterClienteOptionsMemo.find((c: any) => c.id === filterClienteId);
    return cliente?.division ?? [];
  }, [filterClienteOptionsMemo, filterClienteId]);
  const filterContratoOptionsMemo = useMemo(() => {
    const division = filterDivisionOptionsMemo.find((d: any) => d.id === filterDivisionId);
    return division?.contratos ?? [];
  }, [filterDivisionOptionsMemo, filterDivisionId]);
  const filterSucursalOptionsMemo = useMemo(() => {
    const contrato = filterContratoOptionsMemo.find((c: any) => c.id === filterContratoId);
    return contrato?.sucursales ?? [];
  }, [filterContratoOptionsMemo, filterContratoId]);

  const selectedEmpresaNode = useMemo(() => {
    if (selectedEmpresaId === null) return null;
    return structure.find((e: any) => e.id === selectedEmpresaId) ?? null;
  }, [structure, selectedEmpresaId]);
  const selectedClienteNode = useMemo(() => {
    if (!selectedEmpresaNode || selectedClienteId === null) return null;
    return selectedEmpresaNode.clientes.find((c: any) => c.id === selectedClienteId) ?? null;
  }, [selectedEmpresaNode, selectedClienteId]);
  const selectedDivisionNode = useMemo(() => {
    if (!selectedClienteNode || selectedDivisionId === null) return null;
    return (selectedClienteNode.division || []).find((d: any) => d.id === selectedDivisionId) ?? null;
  }, [selectedClienteNode, selectedDivisionId]);
  const selectedContratoNode = useMemo(() => {
    if (!selectedDivisionNode || selectedContratoId === null) return null;
    return (selectedDivisionNode.contratos || []).find((c: any) => c.id === selectedContratoId) ?? null;
  }, [selectedDivisionNode, selectedContratoId]);
  const sucursalOptions = useMemo(() => {
    if (!selectedContratoNode) return [];
    return (selectedContratoNode.sucursales || []).map((s: any) => ({ id: s.id, nombre: s.nombre }));
  }, [selectedContratoNode]);
  const selectedSucursalNodeForForm = useMemo(() => {
    if (!selectedContratoNode || selectedSucursalId == null) return null;
    return (selectedContratoNode.sucursales || []).find((s: any) => Number(s.id) === Number(selectedSucursalId)) ?? null;
  }, [selectedContratoNode, selectedSucursalId]);
  const formPuestoOptions = useMemo(() => {
    if (!selectedSucursalNodeForForm) return [];
    return selectedSucursalNodeForForm.puestos || [];
  }, [selectedSucursalNodeForForm]);

  const formClienteOptions = useMemo(() => {
    if (!selectedEmpresaNode) return [];
    return selectedEmpresaNode.clientes || [];
  }, [selectedEmpresaNode]);
  const formDivisionOptions = useMemo(() => {
    if (!selectedClienteNode) return [];
    return selectedClienteNode.division || [];
  }, [selectedClienteNode]);
  const formContratoOptions = useMemo(() => {
    if (!selectedDivisionNode) return [];
    return selectedDivisionNode.contratos || [];
  }, [selectedDivisionNode]);

  const handleFilterEmpresaChange = (empresaId: number | null) => {
    setFilterEmpresaId(empresaId);
    setFilterClienteId(null);
    setFilterDivisionId(null);
    setFilterContratoId(null);
    setFilterSucursalId(null);
    filterSucursalIdRef.current = null;
  };
  const handleFilterClienteChange = (clienteId: number | null) => {
    setFilterClienteId(clienteId);
    setFilterDivisionId(null);
    setFilterContratoId(null);
    setFilterSucursalId(null);
    filterSucursalIdRef.current = null;
  };
  const handleFilterDivisionChange = (divisionId: number | null) => {
    setFilterDivisionId(divisionId);
    setFilterContratoId(null);
    setFilterSucursalId(null);
    filterSucursalIdRef.current = null;
  };
  const handleFilterContratoChange = (contratoId: number | null) => {
    setFilterContratoId(contratoId);
    setFilterSucursalId(null);
    filterSucursalIdRef.current = null;
  };

  const handleFormEmpresaChange = (empresaId: number | null) => {
    setSelectedEmpresaId(empresaId);
    setSelectedClienteId(null);
    setSelectedDivisionId(null);
    setSelectedContratoId(null);
    setSelectedSucursalId(null);
    setSelectedPuestoId(null);
  };
  const handleFormClienteChange = (clienteId: number | null) => {
    setSelectedClienteId(clienteId);
    setSelectedDivisionId(null);
    setSelectedContratoId(null);
    setSelectedSucursalId(null);
    setSelectedPuestoId(null);
  };
  const handleFormDivisionChange = (divisionId: number | null) => {
    setSelectedDivisionId(divisionId);
    setSelectedContratoId(null);
    setSelectedSucursalId(null);
    setSelectedPuestoId(null);
  };
  const handleFormContratoChange = (contratoId: number | null) => {
    setSelectedContratoId(contratoId);
    setSelectedSucursalId(null);
    setSelectedPuestoId(null);
  };
  const handleFormSucursalChange = (id: number | null) => {
    setSelectedSucursalId(id);
    setSelectedPuestoId(null);
  };


  const applyCurrentMarcaToFormHierarchy = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem('current_marca');
      if (!raw) return;
      const marca = JSON.parse(raw);
      if (!marca?.id) return;
      const rn = marca?.roleDivision?.role?.nombre ?? marca?.role_division?.role?.nombre ?? null;
      if (rn === 'OPERATIVO') return;
      setSelectedEmpresaId(marca.empresa?.id != null ? Number(marca.empresa.id) : null);
      setSelectedClienteId(marca.cliente?.id != null ? Number(marca.cliente.id) : null);
      setSelectedDivisionId(getDivisionIdFromMarcaJson(marca));
      setSelectedContratoId(marca.contrato?.id != null ? Number(marca.contrato.id) : null);
      setSelectedSucursalId(resolveCorpoIdFromMarca(marca));
      setSelectedPuestoId(marca.puesto?.id != null ? Number(marca.puesto.id) : null);
    } catch (e) {
      console.error('applyCurrentMarcaToFormHierarchy (Llaves):', e);
    }
  }, []);

  const persistLlavesListToMainStructure = async (corpoId: number, list: LlaveUI[]) => {
    if (!corpoId) return;
    const normalized = JSON.parse(JSON.stringify(list)).map((it: any) => ({
      ...it,
      sucursal_id: it?.sucursal_id ?? it?.corpo_id ?? corpoId,
    }));
    await persistCorpoLlavesInMainStructure(corpoId, normalized);
    setStructure(await readMainStructureTree());
  };

  const persistLlaverosListToMainStructure = async (corpoId: number, list: LlaveroUI[]) => {
    if (!corpoId) return;
    const normalized = normalizeLlaveroLinksForStructure(
      JSON.parse(JSON.stringify(list)).map((it: any) => ({
        ...it,
        sucursal_id: it?.sucursal_id ?? it?.corpo_id ?? corpoId,
      }))
    );
    await persistCorpoLlaverosInMainStructure(corpoId, normalized);
    setStructure(await readMainStructureTree());
  };

  const resolveActiveListCorpoId = async (): Promise<number | null> => {
    const snap = await syncMarcaFromStorage({ applyFiltersFromMarca: false });
    return resolveListCorpoIdFromSnap(snap, filterSucursalIdRef.current);
  };

  /** Jerarquía completa (empresa…puesto) para API, caché y acciones en cola. */
  const resolveHierarchyForRecord = async (): Promise<{
    cliente_id: number;
    corpo_id: number;
    puesto_id: number;
    empresa_id: number;
    division_id: number;
    contrato_id: number;
  } | null> => {
    const snap = await syncMarcaFromStorage({ applyFiltersFromMarca: false });
    const current = snap?.current ?? null;
    if (!current?.id) return null;
    const tree = await readMainStructureTree();
    if (snap?.isOperativo) {
      const cliente_id = Number(current?.cliente?.id ?? current?.cliente_id) || 0;
      const corpo_id = resolveCorpoIdFromMarca(current) || 0;
      const puesto_id = Number(current?.puesto?.id ?? current?.puesto_id) || 0;
      if (!corpo_id || !puesto_id) return null;
      const h = findHierarchyByPuestoIn(tree, puesto_id);
      if (h) {
        return {
          cliente_id,
          corpo_id,
          puesto_id,
          empresa_id: h.empresaId,
          division_id: h.divisionId,
          contrato_id: h.contratoId,
        };
      }
      return { cliente_id, corpo_id, puesto_id, empresa_id: 0, division_id: 0, contrato_id: 0 };
    }
    const corpo_id =
      selectedSucursalId ?? filterSucursalId ?? (resolveCorpoIdFromMarca(current) ?? 0);
    const cliente_id = selectedClienteId ?? (Number(current?.cliente?.id ?? current?.cliente_id) || 0);
    if (!corpo_id) return null;
    const puesto_id =
      (selectedPuestoId ??
        getFirstPuestoIdFromSucursalInTree(tree, corpo_id) ??
        Number(current?.puesto?.id ?? current?.puesto_id)) ||
      0;
    if (!puesto_id) return null;
    const h = findHierarchyByPuestoIn(tree, puesto_id);
    if (h) {
      return {
        cliente_id,
        corpo_id,
        puesto_id,
        empresa_id: h.empresaId,
        division_id: h.divisionId,
        contrato_id: h.contratoId,
      };
    }
    return { cliente_id, corpo_id, puesto_id, empresa_id: 0, division_id: 0, contrato_id: 0 };
  };

  const fetchLlaves = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const snap = await syncMarcaFromStorage({ applyFiltersFromMarca: false });
      const listCorpoId = resolveListCorpoIdFromSnap(snap, filterSucursalIdRef.current);
      if (!listCorpoId) {
        setError(
          snap?.isOperativo
            ? 'No se encontró sucursal (corpo) en la marca actual. Indique sucursal en la marca.'
            : 'Seleccione sucursal en el filtro para cargar llaves.'
        );
        setLlaves([]);
        setIsLoading(false);
        return;
      }

      const tree = await readMainStructureTree();
      const rawOff = getSucursalDataFromTree(tree, listCorpoId).llaves;
      const offlineList = normalizeLlavesList(rawOff);

      const isConnected = await getConnectionStatus();
      if (!isConnected) {
        setLlaves(offlineList);
        setIsLoading(false);
        return;
      }

        const { refreshAccessToken: rAuth, logout: lAuth } = authFetchRef.current;
        const res = await listLlaves({
        corpoId: listCorpoId,
          refreshAccessToken: rAuth,
          logout: lAuth,
        });

        if (res.status) {
        const serverList = normalizeLlavesList(res.data || []);
        setLlaves((prev) => {
          const localOnly = prev.filter((l) => l.id_local && Number(l.corpo_id) === Number(listCorpoId));
          const combined = [...localOnly, ...serverList];
          void persistCorpoLlavesInMainStructure(listCorpoId, JSON.parse(JSON.stringify(combined))).then(() => {
            void readMainStructureTree().then(setStructure);
          });
          return combined;
        });
        } else {
          setError(res.message || 'Error al cargar llaves');
        setLlaves(offlineList);
      }
    } catch (e: any) {
      setError(e.message || 'Error al cargar llaves');
      setLlaves([]);
    } finally {
      setIsLoading(false);
    }
  }, [syncMarcaFromStorage]);

  const mapLlaveroApiRow = (it: any) => ({
    ...it,
    id_local: it.id_local || '',
    movimientos: (it.movimientos || []).map((m: any) => ({ ...m, id_local: m.id_local || '' })),
    llaves: (it.llaves || []).map((l: any) => ({ ...l })),
  });

  const fetchLlaveros = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const snap = await syncMarcaFromStorage({ applyFiltersFromMarca: false });
      const listCorpoId = resolveListCorpoIdFromSnap(snap, filterSucursalIdRef.current);
      if (!listCorpoId) {
        setError(
          snap?.isOperativo
            ? 'No se encontró sucursal (corpo) en la marca actual. Indique sucursal en la marca.'
            : 'Seleccione sucursal en el filtro para cargar llaveros.'
        );
        setLlaveros([]);
        setIsLoading(false);
        return;
      }

      const tree0 = await readMainStructureTree();
      let rawOff = getSucursalDataFromTree(tree0, listCorpoId).llaves;
      let baseLlaves = normalizeLlavesList(rawOff);
      const rawLlaverosOff = getSucursalDataFromTree(tree0, listCorpoId).llaveros;
      const offlineLlaveros = enrichLlaveroLlavesLinks(
        normalizeLlaverosList(rawLlaverosOff).map(mapLlaveroApiRow),
        baseLlaves
      );

      const isConnected = await getConnectionStatus();
      if (!isConnected) {
        setLlaveros(offlineLlaveros);
        setIsLoading(false);
        return;
      }

        const { refreshAccessToken: rAuth, logout: lAuth } = authFetchRef.current;
        const res = await listLlaveros({
        corpoId: listCorpoId,
          refreshAccessToken: rAuth,
          logout: lAuth,
        });

        if (res.status) {
        const tree1 = await readMainStructureTree();
        rawOff = getSucursalDataFromTree(tree1, listCorpoId).llaves;
        baseLlaves = normalizeLlavesList(rawOff);

        setLlaveros((prev) => {
          const localOnly = prev.filter((l) => l.id_local && Number(l.corpo_id) === Number(listCorpoId));
          const serverList = normalizeLlaverosList(res.data || []).map(mapLlaveroApiRow);
          const combined = [...localOnly, ...serverList];
          const forStruct = normalizeLlaveroLinksForStructure(JSON.parse(JSON.stringify(combined)));
          void persistCorpoLlaverosInMainStructure(listCorpoId, forStruct).then(() => {
            void readMainStructureTree().then(setStructure);
          });
          return enrichLlaveroLlavesLinks(combined, baseLlaves);
        });
        } else {
          setError(res.message || 'Error al cargar llaveros');
        setLlaveros(offlineLlaveros);
      }
    } catch (e: any) {
      setError(e.message || 'Error al cargar llaveros');
      setLlaveros([]);
    } finally {
      setIsLoading(false);
    }
  }, [syncMarcaFromStorage]);

  const onListFilterSucursalSelected = (raw: number) => {
    const id = raw === 0 ? null : Number(raw);
    setFilterSucursalId(id);
    filterSucursalIdRef.current = id;
    if (id) {
      if (activeTab === 'llaves') void fetchLlaves();
      else void fetchLlaveros();
    }
  };

  const handleFilterHierarchyChange = useCallback(
    (v: HierarchyPickerValues) => {
      setFilterEmpresaId(v.empresaId);
      setFilterClienteId(v.clienteId);
      setFilterDivisionId(v.divisionId);
      setFilterContratoId(v.contratoId);
      filterSucursalIdRef.current = v.sucursalId;
      setFilterSucursalId(v.sucursalId);
      if (v.sucursalId != null) {
        if (activeTab === 'llaves') void fetchLlaves();
        else void fetchLlaveros();
      }
    },
    [activeTab, fetchLlaves, fetchLlaveros]
  );

  const handleFormHierarchyChange = useCallback((v: HierarchyPickerValues) => {
    setSelectedEmpresaId(v.empresaId);
    setSelectedClienteId(v.clienteId);
    setSelectedDivisionId(v.divisionId);
    setSelectedContratoId(v.contratoId);
    setSelectedSucursalId(v.sucursalId);
    setSelectedPuestoId(v.puestoId ?? null);
  }, []);

  useEffect(() => {
    filterSucursalIdRef.current = filterSucursalId;
  }, [filterSucursalId]);

  const prevActiveTabRef = useRef<'llaves' | 'llaveros' | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        await fetchMainStructure();
        if (!listFiltersSyncedFromMarcaOnceRef.current) {
          const marcaStr = await AsyncStorage.getItem('current_marca');
          const currentMarca = marcaStr ? JSON.parse(marcaStr) : null;
          if (currentMarca?.id) {
            await syncMarcaFromStorage({ applyFiltersFromMarca: true });
          }
          listFiltersSyncedFromMarcaOnceRef.current = true;
        }
        if (cancelled) return;
        if (activeTab === 'llaves') await fetchLlaves();
        else await fetchLlaveros();
        prevActiveTabRef.current = activeTab;
      })();
      return () => {
        cancelled = true;
      };
    }, [fetchMainStructure, syncMarcaFromStorage, activeTab, fetchLlaves, fetchLlaveros])
  );

  useEffect(() => {
    if (prevActiveTabRef.current === null) return;
    if (prevActiveTabRef.current === activeTab) return;
    prevActiveTabRef.current = activeTab;
    void (activeTab === 'llaves' ? fetchLlaves() : fetchLlaveros());
  }, [activeTab, fetchLlaves, fetchLlaveros]);

  useEffect(() => {
    const handler = () => {
      void (async () => {
        if (activeTab === 'llaves') await fetchLlaves();
        else await fetchLlaveros();
      })();
    };
    eventBus.on('connectionRestored', handler);
    return () => {
      eventBus.off('connectionRestored', handler);
    };
  }, [activeTab, fetchLlaves, fetchLlaveros]);

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
      // No pisar la lista mientras hay formulario de movimiento abierto (evita cierre “visual” o datos inconsistentes)
      if (!llaveroMovIsCreating && !llaveroMovEditing) {
        const raw = (found as any).movimientos;
        if (Array.isArray(raw)) {
          setLlaveroMovimientos(raw.map((m: any) => ({ ...m, id_local: m.id_local || '' })));
        }
      }
    }
  }, [llaveros, isLlaveroMovModalVisible, movLlavero?.id, movLlavero?.id_local, llaveroMovIsCreating, llaveroMovEditing]);

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
      if (!movIsCreating && !movEditing) {
        const raw = (found as any).movimientos;
        if (Array.isArray(raw)) {
          setMovimientos(raw.map((m: any) => ({ ...m, id_local: m.id_local || '' })));
    }
      }
    }
  }, [llaves, isMovModalVisible, movLlave?.id, movLlave?.id_local, movIsCreating, movEditing]);

  const resetForm = () => {
    setNumeroLlave('');
    setLugarAbre('');
    setCantidadCopias('1');
    setObservaciones('');
    setFirmaResponsable('');
  };

  const startCreating = () => {
    resetForm();
    setEditing(null);
    setIsCreating(true);
    void applyCurrentMarcaToFormHierarchy();
    void fetchMainStructure();
  };

  const startEditing = async (it: LlaveUI) => {
    setEditing(it);
    setIsCreating(true);
    setNumeroLlave(it.numero_llave || '');
    setLugarAbre(it.lugar_abre || '');
    setCantidadCopias(String(it.cantidad_copias ?? 1));
    setObservaciones(it.observaciones || '');
    setFirmaResponsable(it.firma_responsable || '');
    await fetchMainStructure();
    const tree = await readMainStructureTree();
    const snap = await syncMarcaFromStorage({ applyFiltersFromMarca: false });
    const rn = snap?.roleName;
    if (rn != null && rn !== 'OPERATIVO' && tree.length) {
      const byPuesto = it.puesto_id ? findHierarchyByPuestoIn(tree, Number(it.puesto_id)) : null;
      if (byPuesto) {
        setSelectedEmpresaId(byPuesto.empresaId);
        setSelectedClienteId(byPuesto.clienteId);
        setSelectedDivisionId(byPuesto.divisionId);
        setSelectedContratoId(byPuesto.contratoId);
        setSelectedSucursalId(byPuesto.corpoId);
        setSelectedPuestoId(byPuesto.puestoId);
      } else {
        const h = findHierarchyByCorpoIn(tree, Number(it.corpo_id));
        if (h) {
          setSelectedEmpresaId(h.empresaId);
          setSelectedClienteId(h.clienteId);
          setSelectedDivisionId(h.divisionId);
          setSelectedContratoId(h.contratoId);
          setSelectedSucursalId(h.corpoId);
          setSelectedPuestoId(it.puesto_id != null ? Number(it.puesto_id) : null);
        }
      }
    }
  };

  const cancelCreating = () => {
    setIsCreating(false);
    setEditing(null);
  };

  const handleGenerateFirmaResponsable = async () => {
    if (isGeneratingFirma) return;
    setIsGeneratingFirma(true);
    try {
      if (!employee) {
        Alert.alert('Error', 'No se pudo obtener la información del empleado');
        return;
      }
      const hash = await getCurrentUserDigitalSignature(employee);
      if (!hash) return;
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
    const h = await resolveHierarchyForRecord();
    if (!h?.corpo_id || !h.puesto_id) {
      throw new Error('Indique puesto y sucursal (jerarquía) o use una marca con puesto asignado.');
    }
    const empresa_id =
      h.empresa_id > 0 ? h.empresa_id : (numOrNull(selectedEmpresaId) ?? 0);
    const division_id =
      h.division_id > 0 ? h.division_id : (numOrNull(selectedDivisionId) ?? 0);
    const contrato_id =
      h.contrato_id > 0 ? h.contrato_id : (numOrNull(selectedContratoId) ?? 0);
    const cliente_id =
      h.cliente_id > 0 ? h.cliente_id : (numOrNull(selectedClienteId) ?? 0);
    if (!empresa_id || !division_id || !contrato_id) {
      throw new Error(
        'Complete la jerarquía (empresa, división, contrato) en los select o asegure que el árbol tenga la sucursal y el puesto.'
      );
    }
    if (!cliente_id) {
      throw new Error('Cliente (jerarquía) requerido: selección en el formulario o marca con cliente.');
    }
    return {
      marca_id: current.id,
      numero_llave: numeroLlave,
      lugar_abre: lugarAbre,
      cantidad_copias: parseInt(String(cantidadCopias), 10) || 0,
      observaciones: observaciones ?? '',
      firma_responsable: firmaResponsable,
      empresa_id,
      division_id,
      contrato_id,
      cliente_id,
      corpo_id: h.corpo_id,
      sucursal_id: h.corpo_id,
      puesto_id: h.puesto_id,
    };
  };

  const upsertAction = async (action: any) => {
    const actionsStr = await AsyncStorage.getItem('llaves_actions');
    let actions = actionsStr ? JSON.parse(actionsStr) : [];
    if (action.type === 'update') {
      actions = actions.filter((a: any) => !(a.type === 'update' && String(a.id) === String(action.id)));
    }
    if (action.type === 'create') {
      const idStr = String(action.id);
      actions = actions.filter(
        (a: any) =>
          !(
            (a.type === 'update' && String(a.id) === idStr) ||
            (a.type === 'create' && String(a.id) === idStr)
          )
      );
    }
    actions.push(action);
    await AsyncStorage.setItem('llaves_actions', JSON.stringify(actions));
  };

  const removeActionsForLocalId = async (localId: string) => {
    const actionsStr = await AsyncStorage.getItem('llaves_actions');
    if (!actionsStr) return;
    const actions = JSON.parse(actionsStr) || [];
    const updated = actions.filter(
      (a: any) =>
        !(
          (String(a.id) === String(localId) || String(a.id_local) === String(localId)) &&
          (a.type === 'create' || a.type === 'update')
        )
    );
    await AsyncStorage.setItem('llaves_actions', JSON.stringify(updated));
  };

  const updateCreateActionForLocalId = async (localId: string, requestData: any) => {
    const actionsStr = await AsyncStorage.getItem('llaves_actions');
    let actions = actionsStr ? JSON.parse(actionsStr) || [] : [];
    actions = actions.filter((a: any) => !(a.type === 'update' && String(a.id) === String(localId)));
    let updatedAny = false;
    const updated = actions.map((a: any) => {
      if (a.type === 'create' && String(a.id) === String(localId)) {
        updatedAny = true;
        return { ...a, requestData };
      }
      return a;
    });
      await AsyncStorage.setItem('llaves_actions', JSON.stringify(updated));
    return updatedAny;
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
    let actions = actionsStr ? JSON.parse(actionsStr) : [];
    if (action.type === 'update') {
      actions = actions.filter((a: any) => !(a.type === 'update' && String(a.id) === String(action.id)));
    }
    if (action.type === 'create') {
      const idStr = String(action.id);
      actions = actions.filter(
        (a: any) =>
          !(
            (a.type === 'update' && String(a.id) === idStr) ||
            (a.type === 'create' && String(a.id) === idStr)
          )
      );
    }
    actions.push(action);
    await AsyncStorage.setItem('movimientos_llaves_actions', JSON.stringify(actions));
  };

  const removeMovActionsForLocalId = async (localId: string) => {
    const actionsStr = await AsyncStorage.getItem('movimientos_llaves_actions');
    if (!actionsStr) return;
    const actions = JSON.parse(actionsStr) || [];
    const updated = actions.filter(
      (a: any) =>
        !(
          (String(a.id) === String(localId) || String(a.id_local) === String(localId)) &&
          (a.type === 'create' || a.type === 'update')
        )
    );
    await AsyncStorage.setItem('movimientos_llaves_actions', JSON.stringify(updated));
  };

  const updateMovCreateActionForLocalId = async (localId: string, requestData: any) => {
    const actionsStr = await AsyncStorage.getItem('movimientos_llaves_actions');
    let actions = actionsStr ? JSON.parse(actionsStr) || [] : [];
    actions = actions.filter((a: any) => !(a.type === 'update' && String(a.id) === String(localId)));
    let updatedAny = false;
    const updated = actions.map((a: any) => {
      if (a.type === 'create' && String(a.id) === String(localId)) {
        updatedAny = true;
        return { ...a, requestData };
      }
      return a;
    });
      await AsyncStorage.setItem('movimientos_llaves_actions', JSON.stringify(updated));
    return updatedAny;
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
      if (!employee) {
        Alert.alert('Error', 'No se pudo obtener la información del empleado');
        return;
      }
      const hash = await getCurrentUserDigitalSignature(employee);
      if (!hash) return;
      setMovFirmaResponsable(hash);
    } finally {
      setIsGeneratingMovFirma(false);
    }
  };

  const handleGenerateLlaveroFirmaResponsable = async () => {
    if (isGeneratingLlaveroFirma) return;
    setIsGeneratingLlaveroFirma(true);
    try {
      if (!employee) {
        Alert.alert('Error', 'No se pudo obtener la información del empleado');
        return;
      }
      const hash = await getCurrentUserDigitalSignature(employee);
      if (!hash) return;
      setLlaveroFirmaResponsable(hash);
    } finally {
      setIsGeneratingLlaveroFirma(false);
    }
  };

  const handleGenerateLlaveroMovFirmaResponsable = async () => {
    if (isGeneratingLlaveroMovFirma) return;
    setIsGeneratingLlaveroMovFirma(true);
    try {
      if (!employee) {
        Alert.alert('Error', 'No se pudo obtener la información del empleado');
        return;
      }
      const hash = await getCurrentUserDigitalSignature(employee);
      if (!hash) return;
      setLlaveroMovFirmaResponsable(hash);
    } finally {
      setIsGeneratingLlaveroMovFirma(false);
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

  const startMovCreating = async () => {
    const horaAccion = await getHoraAccion();
    if (!horaAccion) {
      Alert.alert('Error', 'No se pudo obtener la hora de acción');
      return;
    }
    resetMovForm();
    setMovIsCreating(true);
    setMovEditing(null);
    setMovFecha(dateToLocalString(new Date(horaAccion)));
    setMovHora(timeToHHMMSS(new Date(horaAccion)));
  };

  const startMovEditing = (m: MovimientoUI) => {
    setMovEditing(m);
    setMovIsCreating(true);
    setMovNombreRecibe(m.nombre_persona_recibe || '');
    setMovNombreEntrega(m.nombre_persona_entrega || '');
    setMovDepartamento(m.departamento || '');
    setMovTelefono(m.telefono || '');
    setMovFecha(m.fecha ? String(m.fecha).split('T')[0] : '');
    setMovHora(normalizeTimeValue(String(m.hora || '')));
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
    const resolvedCid = await resolveActiveListCorpoId();
    const cid = resolvedCid ?? numOrNull(llave.corpo_id) ?? 0;
    if (cid) await persistLlavesListToMainStructure(cid, nextLlaves);

    setMovimientos(nextMovs);
    setMovLlave((prev) => (prev ? { ...prev, movimientos: nextMovs } : prev));
  };

  const handleMovSave = async () => {
    if (isSavingMov) return;
    if (!employee) return;
    if (!movLlave) return;
    if (!validateMovForm()) return;

    setIsSavingMov(true);
    try {
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
            id_local: localId,
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
          const match =
            (movEditing.id_local && m.id_local === movEditing.id_local) ||
            (!movEditing.id_local && m.id === movEditing.id);
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
              id_local: movEditing.id_local,
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
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo guardar el movimiento');
    } finally {
      setIsSavingMov(false);
    }
  };

  const handleMovSaveWithConfirm = () => {
    if (isSavingMov) return;
    if (!employee || !movLlave) return;
    if (!validateMovForm()) return;
    const isEdit = movEditing != null;
    Alert.alert(
      'Confirmar',
      isEdit ? '¿Guardar los cambios de este movimiento?' : '¿Registrar este movimiento?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Aceptar', onPress: () => void handleMovSave() },
      ]
    );
  };

  const executeMovDelete = async (m: MovimientoUI) => {
    const current = await loadMarcaContext();
    if (!current?.id) return;
    if (!movLlave) return;

    setDeletingMovLlaveKey(movimientoLlaveRowKey(m));
    try {
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
    } finally {
      setDeletingMovLlaveKey(null);
    }
  };

  const handleMovDelete = (m: MovimientoUI) => {
    Alert.alert('Confirmar', '¿Deseas eliminar este movimiento?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => void executeMovDelete(m),
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

      const horaAccion = await getHoraAccion();
      if (!horaAccion) {
        Alert.alert('Error', 'No se pudo obtener la hora de acción');
        return;
      }

      // create
      if (!editing) {
        if (isConnected) {
          const res = await createLlave({ requestData: payload, refreshAccessToken, logout });
          if (res.status) {
            const sid = Number((res as any).id);
            const hR = await resolveHierarchyForRecord();
            if (hR?.corpo_id && Number.isFinite(sid) && sid > 0) {
              const row: LlaveUI = {
                id: sid,
                id_local: '',
                cliente_id: payload.cliente_id,
                corpo_id: payload.corpo_id,
                puesto_id: payload.puesto_id,
                empresa_id: payload.empresa_id,
                division_id: payload.division_id,
                contrato_id: payload.contrato_id,
                isActive: true,
                numero_llave: payload.numero_llave,
                lugar_abre: payload.lugar_abre,
                cantidad_copias: payload.cantidad_copias,
                observaciones: payload.observaciones,
                firma_responsable: payload.firma_responsable,
                created_by: Number(employee?.id) || 0,
                created_at: horaAccion ? new Date(horaAccion).toISOString() : new Date().toISOString(),
                movimientos: [],
              };
              const tree = await readMainStructureTree();
              const next = upsertLlaveInCorpoTree(tree, hR.corpo_id, row);
              await writeMainStructureTree(next);
              setStructure(next);
            }
            Alert.alert('Éxito', res.message || 'Llave creada correctamente');
            setIsCreating(false);
            await fetchLlaves();
          } else {
            Alert.alert('Error', res.message || 'No se pudo crear la llave');
          }
        } else {
          const hOff = await resolveHierarchyForRecord();
          if (!hOff?.corpo_id) {
            Alert.alert('Error', 'Defina sucursal y puesto en el formulario o en la marca para crear la llave offline.');
            return;
          }

          const localId = `local-${Date.now()}`;
          const nowIso = new Date(horaAccion).toISOString();
          const localItem: LlaveUI = {
            id: 0,
            id_local: localId,
            cliente_id: payload.cliente_id,
            corpo_id: payload.corpo_id,
            puesto_id: payload.puesto_id,
            empresa_id: payload.empresa_id,
            division_id: payload.division_id,
            contrato_id: payload.contrato_id,
            isActive: true,
            numero_llave: payload.numero_llave,
            lugar_abre: payload.lugar_abre,
            cantidad_copias: payload.cantidad_copias,
            observaciones: payload.observaciones,
            firma_responsable: payload.firma_responsable,
            created_by: Number(employee.id) || 0,
            created_at: nowIso,
          };

          const next = [localItem, ...llaves];
          setLlaves(next);
          await persistLlavesListToMainStructure(hOff.corpo_id, next);
          await upsertAction({
            type: 'create',
            id: localId,
            id_local: localId,
            corpo_id: hOff.corpo_id,
            requestData: payload,
          });

          Alert.alert('Éxito', 'La llave se sincronizará cuando vuelva la conexión.');
          setIsCreating(false);
        }
        return;
      }

      // update
      const isLocal = !!editing.id_local || editing.id === 0;
      if (isConnected && !isLocal) {
        const res = await updateLlave({ id: editing.id, requestData: payload, refreshAccessToken, logout });
        if (res.status) {
          try {
            const tree = await readMainStructureTree();
            const nextTree = applyLlaveUpdatePayloadToTree(tree, editing.id, payload);
            await writeMainStructureTree(nextTree);
            setStructure(nextTree);
          } catch (e) {
            console.warn('main_structure llave update:', e);
          }
          Alert.alert('Éxito', res.message || 'Llave actualizada correctamente');
          setIsCreating(false);
          setEditing(null);
          await fetchLlaves();
        } else {
          Alert.alert('Error', res.message || 'No se pudo actualizar la llave');
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
            numero_llave: payload.numero_llave,
            lugar_abre: payload.lugar_abre,
            cantidad_copias: payload.cantidad_copias,
            observaciones: payload.observaciones,
            firma_responsable: payload.firma_responsable,
            cliente_id: payload.cliente_id,
            corpo_id: payload.corpo_id,
            puesto_id: payload.puesto_id,
            empresa_id: payload.empresa_id,
            division_id: payload.division_id,
            contrato_id: payload.contrato_id,
          };
        });
        setLlaves(next);
        const oldCorpo = numOrNull(editing.corpo_id);
        const newCorpo = numOrNull(payload.corpo_id) ?? oldCorpo ?? 0;
        if (oldCorpo && newCorpo && oldCorpo !== newCorpo) {
          const row = next.find(
            (it) =>
              (editing.id_local && it.id_local === editing.id_local) ||
              (!editing.id_local && it.id === editing.id)
          );
          if (row) {
            const tree = await readMainStructureTree();
            const moved = moveLlaveBetweenCorposInTree(tree, oldCorpo, newCorpo, row);
            await writeMainStructureTree(moved);
            setStructure(moved);
          }
        } else if (newCorpo) {
          await persistLlavesListToMainStructure(newCorpo, next);
        }

        if (editing.id_local) {
          const updated = await updateCreateActionForLocalId(editing.id_local, payload);
          if (!updated) {
            await upsertAction({ type: 'create', id: editing.id_local, id_local: editing.id_local, requestData: payload });
          }
        } else {
          await upsertAction({ type: 'update', id: editing.id, requestData: payload });
        }

        Alert.alert('Éxito', 'Los cambios se sincronizarán cuando vuelva la conexión.');
        setIsCreating(false);
        setEditing(null);
      }
    } catch (error: any) {
      console.error('Error saving llave:', error);
      Alert.alert('Error', error?.message || 'Error al guardar la llave');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveWithConfirm = () => {
    if (isSubmitting) return;
    if (!employee) return;
    if (!validateForm()) return;
    const isEdit = editing != null;
    Alert.alert(
      'Confirmar',
      isEdit ? '¿Guardar los cambios de esta llave?' : '¿Registrar esta llave?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Aceptar', onPress: () => void handleSave() },
      ]
    );
  };

  // Funciones CRUD para Llaveros
  const validateLlaveroForm = () => {
    if (!llaveroNombre.trim()) {
      Alert.alert('Error', 'El nombre del llavero es obligatorio');
      return false;
    }
    if (!llaveroNumero.trim()) {
      Alert.alert('Error', 'El número del llavero es obligatorio');
      return false;
    }
    if (!llaveroFirmaResponsable) {
      Alert.alert('Error', 'Debes registrar la firma responsable');
      return false;
    }
    return true;
  };

  const parseLlaveSelectionKeysToRefs = (keys: string[]) => {
    const refs: { llave_id?: number; llave_id_local?: string }[] = [];
    for (const k of keys) {
      if (k.startsWith('l:')) refs.push({ llave_id_local: k.slice(2) });
      else if (k.startsWith('s:')) {
        const n = Number(k.slice(2));
        if (Number.isFinite(n) && n > 0) refs.push({ llave_id: n });
      }
    }
    return refs;
  };

  const llaveroLinkRowToSelectionKey = (l: any) => {
    if (l?.llave_id_local) return `l:${l.llave_id_local}`;
    if (l?.llave_id && l.llave_id > 0) return `s:${l.llave_id}`;
    return '';
  };

  const llaveToSelectionKey = (ll: LlaveUI) =>
    ll.id && ll.id > 0 ? `s:${ll.id}` : ll.id_local ? `l:${ll.id_local}` : '';

  const buildLlaveroPayload = async () => {
    const current = await loadMarcaContext();
    if (!current?.id) throw new Error('Marca no encontrada');
    const llaves_refs = parseLlaveSelectionKeysToRefs(llaveroSelectedLlaveKeys);
    const llaves = llaves_refs.map((r) => r.llave_id).filter((n): n is number => typeof n === 'number' && n > 0);
    const h = await resolveHierarchyForRecord();
    if (!h?.corpo_id || !h.puesto_id) {
      throw new Error('Indique puesto y sucursal (jerarquía) o use una marca con puesto asignado.');
    }
    const empresa_id =
      h.empresa_id > 0 ? h.empresa_id : (numOrNull(selectedEmpresaId) ?? 0);
    const division_id =
      h.division_id > 0 ? h.division_id : (numOrNull(selectedDivisionId) ?? 0);
    const contrato_id =
      h.contrato_id > 0 ? h.contrato_id : (numOrNull(selectedContratoId) ?? 0);
    const cliente_id =
      h.cliente_id > 0 ? h.cliente_id : (numOrNull(selectedClienteId) ?? 0);
    if (!empresa_id || !division_id || !contrato_id) {
      throw new Error(
        'Complete la jerarquía (empresa, división, contrato) en los select o asegure que el árbol tenga la sucursal y el puesto.'
      );
    }
    if (!cliente_id) {
      throw new Error('Cliente (jerarquía) requerido: selección en el formulario o marca con cliente.');
    }
    return {
      marca_id: current.id,
      nombre_llavero: llaveroNombre.trim(),
      numero_llavero: llaveroNumero.trim(),
      observaciones: llaveroObservaciones.trim(),
      firma_responsable: llaveroFirmaResponsable,
      llaves_refs,
      llaves,
      empresa_id,
      division_id,
      contrato_id,
      cliente_id,
      corpo_id: h.corpo_id,
      sucursal_id: h.corpo_id,
      puesto_id: h.puesto_id,
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

      const horaAccion = await getHoraAccion();
      if (!horaAccion) {
        Alert.alert('Error', 'No se pudo obtener la hora de acción');
        return;
      }

      // create
      if (!llaveroEditing) {
        if (isConnected) {
          const res = await createLlavero({ requestData: payload, refreshAccessToken, logout });
          if (res.status) {
            const sid = Number((res as any).id);
            const hE = await resolveHierarchyForRecord();
            if (hE?.corpo_id && Number.isFinite(sid) && sid > 0) {
              const tree0 = await readMainStructureTree();
              const baseLlaves = normalizeLlavesList(getSucursalDataFromTree(tree0, hE.corpo_id).llaves);
              const row: LlaveroUI = {
                id: sid,
                id_local: '',
                cliente_id: payload.cliente_id,
                corpo_id: payload.corpo_id,
                puesto_id: payload.puesto_id,
                empresa_id: payload.empresa_id,
                division_id: payload.division_id,
                contrato_id: payload.contrato_id,
                isActive: true,
                nombre_llavero: payload.nombre_llavero,
                numero_llavero: payload.numero_llavero,
                observaciones: payload.observaciones,
                firma_responsable: payload.firma_responsable,
                created_by: Number(employee?.id) || 0,
                created_at: horaAccion ? new Date(horaAccion).toISOString() : new Date().toISOString(),
                movimientos: [],
                llaves: (payload.llaves_refs || []).map((r: { llave_id?: number; llave_id_local?: string }) =>
                  r.llave_id_local
                    ? { id: 0, llave_id: 0, llave_id_local: r.llave_id_local, llavero_id: sid }
                    : { id: 0, llave_id: r.llave_id || 0, llavero_id: sid }
                ),
              };
              const enriched = enrichLlaveroLlavesLinks([row], baseLlaves)[0];
              const tree = await readMainStructureTree();
              const next = upsertLlaveroInCorpoTree(
                tree,
                hE.corpo_id,
                normalizeLlaveroLinksForStructure([enriched])[0]
              );
              await writeMainStructureTree(next);
              setStructure(next);
            }
            Alert.alert('Éxito', res.message || 'Llavero creado correctamente');
            setIsLlaveroCreating(false);
            await fetchLlaveros();
          } else {
            Alert.alert('Error', res.message || 'No se pudo crear el llavero');
          }
        } else {
          const localId = `local-llavero-${Date.now()}`;
          const nowIso = new Date(horaAccion).toISOString();
          const hOffL = await resolveHierarchyForRecord();
          if (!hOffL?.corpo_id) {
            Alert.alert('Error', 'Defina sucursal y puesto en el formulario o en la marca para crear el llavero offline.');
            return;
          }
          const localItem: LlaveroUI = {
            id: 0,
            id_local: localId,
            cliente_id: payload.cliente_id,
            corpo_id: payload.corpo_id,
            puesto_id: payload.puesto_id,
            empresa_id: payload.empresa_id,
            division_id: payload.division_id,
            contrato_id: payload.contrato_id,
            isActive: true,
            nombre_llavero: payload.nombre_llavero,
            numero_llavero: payload.numero_llavero,
            observaciones: payload.observaciones,
            firma_responsable: payload.firma_responsable,
            created_by: Number(employee.id) || 0,
            created_at: nowIso,
            llaves: (payload.llaves_refs || []).map((r: { llave_id?: number; llave_id_local?: string }) =>
              r.llave_id_local
                ? { id: 0, llave_id: 0, llave_id_local: r.llave_id_local, llavero_id: 0 }
                : { id: 0, llave_id: r.llave_id || 0, llavero_id: 0 }
            ),
          };

          const next = [localItem, ...llaveros];
          setLlaveros(next);
          await persistLlaverosListToMainStructure(hOffL.corpo_id, next);
          await upsertLlaveroAction({
            type: 'create',
            id: localId,
            id_local: localId,
            corpo_id: hOffL.corpo_id,
            requestData: payload,
          });

          Alert.alert('Éxito', 'El llavero se sincronizará cuando vuelva la conexión.');
          setIsLlaveroCreating(false);
        }
        return;
      }

      // update
      const isLocal = !!llaveroEditing.id_local || llaveroEditing.id === 0;
      if (isConnected && !isLocal) {
        const res = await updateLlavero({ id: llaveroEditing.id, requestData: payload, refreshAccessToken, logout });
        if (res.status) {
          try {
            const tree = await readMainStructureTree();
            const nextTree = applyLlaveroUpdatePayloadToTree(tree, llaveroEditing.id, payload, payload.llaves);
            await writeMainStructureTree(nextTree);
            setStructure(nextTree);
          } catch (e) {
            console.warn('main_structure llavero update:', e);
          }
          Alert.alert('Éxito', res.message || 'Llavero actualizado correctamente');
          setIsLlaveroCreating(false);
          setLlaveroEditing(null);
          await fetchLlaveros();
        } else {
          Alert.alert('Error', res.message || 'No se pudo actualizar el llavero');
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
            numero_llavero: payload.numero_llavero,
            observaciones: payload.observaciones,
            firma_responsable: payload.firma_responsable,
            cliente_id: payload.cliente_id,
            corpo_id: payload.corpo_id,
            puesto_id: payload.puesto_id,
            empresa_id: payload.empresa_id,
            division_id: payload.division_id,
            contrato_id: payload.contrato_id,
            llaves: (payload.llaves_refs || []).map((r: { llave_id?: number; llave_id_local?: string }) =>
              r.llave_id_local
                ? { id: 0, llave_id: 0, llave_id_local: r.llave_id_local, llavero_id: it.id || 0 }
                : { id: 0, llave_id: r.llave_id || 0, llavero_id: it.id || 0 }
            ),
          };
        });
        setLlaveros(next);
        const oldCorpo = numOrNull(llaveroEditing.corpo_id);
        const newCorpo = numOrNull(payload.corpo_id) ?? oldCorpo ?? 0;
        if (oldCorpo && newCorpo && oldCorpo !== newCorpo) {
          const row = next.find(
            (it) =>
              (llaveroEditing.id_local && it.id_local === llaveroEditing.id_local) ||
              (!llaveroEditing.id_local && it.id === llaveroEditing.id)
          );
          if (row) {
            const tree = await readMainStructureTree();
            const moved = moveLlaveroBetweenCorposInTree(tree, oldCorpo, newCorpo, normalizeLlaveroLinksForStructure([row])[0]);
            await writeMainStructureTree(moved);
            setStructure(moved);
          }
        } else if (newCorpo) {
          await persistLlaverosListToMainStructure(newCorpo, next);
        }

        if (llaveroEditing.id_local) {
          const updated = await updateLlaveroCreateActionForLocalId(llaveroEditing.id_local, payload);
          if (!updated) {
            await upsertLlaveroAction({
              type: 'create',
              id: llaveroEditing.id_local,
              id_local: llaveroEditing.id_local,
              corpo_id: newCorpo,
              requestData: payload,
            });
          }
        } else {
          await upsertLlaveroAction({ type: 'update', id: llaveroEditing.id, requestData: payload });
        }

        Alert.alert('Éxito', 'Los cambios se sincronizarán cuando vuelva la conexión.');
        setIsLlaveroCreating(false);
        setLlaveroEditing(null);
      }
    } catch (error: any) {
      console.error('Error saving llavero:', error);
      Alert.alert('Error', error?.message || 'Error al guardar el llavero');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLlaveroSaveWithConfirm = () => {
    if (isSubmitting) return;
    if (!employee) return;
    if (!validateLlaveroForm()) return;
    const isEdit = llaveroEditing != null;
    Alert.alert(
      'Confirmar',
      isEdit ? '¿Guardar los cambios de este llavero?' : '¿Registrar este llavero?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Aceptar', onPress: () => void handleLlaveroSave() },
      ]
    );
  };

  const executeLlaveroDelete = async (it: LlaveroUI) => {
    const current = await loadMarcaContext();
    if (!current?.id) return;
    setDeletingLlaveroKey(llaveroRowKey(it));
    try {
          const isConnected = await getConnectionStatus();

          if (it.id_local || it.id === 0) {
            const next = llaveros.filter((x) => x.id_local !== it.id_local);
            setLlaveros(next);
        const cid = numOrNull(it.corpo_id) ?? (await resolveActiveListCorpoId()) ?? 0;
        if (cid) {
          const tree = await readMainStructureTree();
          const rm = removeLlaveroFromCorpoTree(tree, cid, {
            id: it.id && it.id > 0 ? it.id : undefined,
            id_local: it.id_local || undefined,
          });
          await writeMainStructureTree(rm);
          setStructure(rm);
        }
            if (it.id_local) await removeLlaveroActionsForLocalId(it.id_local);
            return;
          }

          if (isConnected) {
            const res = await deleteLlavero({ id: it.id, marcaId: current.id, refreshAccessToken, logout });
            if (res.status) {
          try {
            const tree = await readMainStructureTree();
            const hit = findCorpoAndLlaveroRowInTree(tree, { id: it.id });
            if (hit) {
              const rm = removeLlaveroFromCorpoTree(tree, hit.corpoId, { id: it.id });
              await writeMainStructureTree(rm);
              setStructure(rm);
            }
          } catch (e) {
            console.warn('main_structure llavero delete:', e);
          }
              Alert.alert('Éxito', 'Llavero eliminado correctamente');
              await fetchLlaveros();
            } else {
              Alert.alert('Error', res.message || 'No se pudo eliminar el llavero');
            }
          } else {
            const next = llaveros.filter((x) => x.id !== it.id);
            setLlaveros(next);
        const cid = numOrNull(it.corpo_id) ?? (await resolveActiveListCorpoId()) ?? 0;
        if (cid) {
          const tree = await readMainStructureTree();
          const rm = removeLlaveroFromCorpoTree(tree, cid, { id: it.id });
          await writeMainStructureTree(rm);
          setStructure(rm);
        }
            await upsertLlaveroAction({ type: 'delete', id: it.id, marcaId: current.id });
            Alert.alert('Eliminado (offline)', 'La eliminación se sincronizará cuando vuelva la conexión.');
          }
    } finally {
      setDeletingLlaveroKey(null);
    }
  };

  const handleLlaveroDelete = (it: LlaveroUI) => {
    Alert.alert('Confirmar', '¿Deseas eliminar este llavero?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => void executeLlaveroDelete(it),
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

  const startLlaveroMovCreating = async () => {
    const horaAccion = await getHoraAccion();
    if (!horaAccion) {
      Alert.alert('Error', 'No se pudo obtener la hora de acción');
      return;
    }
    resetLlaveroMovForm();
    setLlaveroMovIsCreating(true);
    setLlaveroMovEditing(null);
    setLlaveroMovFecha(dateToLocalString(new Date(horaAccion)));
    setLlaveroMovHora(timeToHHMMSS(new Date(horaAccion)));
  };

  const startLlaveroMovEditing = (m: MovimientoLlaveroUI) => {
    setLlaveroMovEditing(m);
    setLlaveroMovIsCreating(true);
    setLlaveroMovNombreRecibe(m.nombre_persona_recibe || '');
    setLlaveroMovNombreEntrega(m.nombre_persona_entrega || '');
    setLlaveroMovDepartamento(m.departamento || '');
    setLlaveroMovTelefono(m.telefono || '');
    setLlaveroMovFecha(m.fecha ? String(m.fecha).split('T')[0] : '');
    setLlaveroMovHora(normalizeTimeValue(String(m.hora || '')));
    setLlaveroMovFirmaEntrega(m.firma_entrega || '');
    setLlaveroMovFirmaRecibe(m.firma_recibe || '');
    setLlaveroMovFirmaResponsable(m.firma_responsable || '');
  };

  const cancelLlaveroMovCreating = () => {
    setLlaveroMovIsCreating(false);
    setLlaveroMovEditing(null);
    resetLlaveroMovForm();
  };

  const syncLlaveroMovementsMirrorIntoLlavesCache = async (llaveroRef: LlaveroUI, nextMovs: MovimientoLlaveroUI[]) => {
    const links = (llaveroRef.llaves || []) as any[];
    if (!links.length) return;

    const nextLlaves = llaves.map((ll) => {
      const isLinked = links.some((l) => {
        if (l.llave_id_local) return l.llave_id_local === ll.id_local;
        return l.llave_id && l.llave_id === ll.id && ll.id > 0;
      });
      if (!isLinked || ll.cantidad_copias !== 1) return ll;

      let movs: any[] = Array.isArray(ll.movimientos) ? [...ll.movimientos] : [];
      const shadowLocals = new Set(
        nextMovs.map((m) => m.id_local).filter((x): x is string => !!x && String(x).startsWith('local-mov-llavero-'))
      );

      movs = movs.filter((m) => {
        if (!m.id_local || !String(m.id_local).startsWith('local-mov-llavero-')) return true;
        return shadowLocals.has(m.id_local);
      });

      for (const m of nextMovs) {
        if (!m.id_local || !String(m.id_local).startsWith('local-mov-llavero-')) continue;
        const shadow = {
          id: m.id || 0,
          id_local: m.id_local,
          llave_id: ll.id || 0,
          nombre_persona_recibe: m.nombre_persona_recibe,
          nombre_persona_entrega: m.nombre_persona_entrega,
          departamento: m.departamento,
          telefono: m.telefono,
          fecha: m.fecha,
          hora: m.hora,
          firma_entrega: m.firma_entrega,
          firma_recibe: m.firma_recibe,
          firma_responsable: m.firma_responsable,
        };
        const idx = movs.findIndex((x) => x.id_local === m.id_local);
        if (idx >= 0) movs[idx] = shadow;
        else movs = [shadow, ...movs];
      }

      return { ...ll, movimientos: movs };
    });

    setLlaves(nextLlaves);
    const cid = await resolveActiveListCorpoId();
    if (cid) await persistLlavesListToMainStructure(cid, nextLlaves);
  };

  const persistMovimientosToLlaverosCache = async (llavero: LlaveroUI, nextMovs: MovimientoLlaveroUI[]) => {
    const nextLlaveros = llaveros.map((it) => {
      const match = (llavero.id_local && it.id_local === llavero.id_local) || (!llavero.id_local && it.id === llavero.id);
      if (!match) return it;
      return { ...it, movimientos: nextMovs };
    });
    setLlaveros(nextLlaveros);
    const cidLlavero = numOrNull(llavero.corpo_id) ?? (await resolveActiveListCorpoId()) ?? 0;
    if (cidLlavero) await persistLlaverosListToMainStructure(cidLlavero, nextLlaveros);

    setLlaveroMovimientos(nextMovs);
    setMovLlavero((prev) => (prev ? { ...prev, movimientos: nextMovs } : prev));

    const updatedLlavero = nextLlaveros.find((it) =>
      (llavero.id_local && it.id_local === llavero.id_local) || (!llavero.id_local && it.id === llavero.id)
    );
    if (updatedLlavero) {
      await syncLlaveroMovementsMirrorIntoLlavesCache(updatedLlavero, nextMovs);
    }
  };

  const handleLlaveroMovSave = async () => {
    if (isSavingLlaveroMov) return;
    if (!employee) return;
    if (!movLlavero) return;
    if (!validateLlaveroMovForm()) return;

    setIsSavingLlaveroMov(true);
    try {
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
            id_local: localId,
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
            id_local: llaveroMovEditing.id_local,
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
    } finally {
      setIsSavingLlaveroMov(false);
    }
  };

  const handleLlaveroMovSaveWithConfirm = () => {
    if (isSavingLlaveroMov) return;
    if (!employee || !movLlavero) return;
    if (!validateLlaveroMovForm()) return;
    const isEdit = llaveroMovEditing != null;
    Alert.alert(
      'Confirmar',
      isEdit ? '¿Guardar los cambios de este movimiento?' : '¿Registrar este movimiento?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Aceptar', onPress: () => void handleLlaveroMovSave() },
      ]
    );
  };

  const executeLlaveroMovDelete = async (m: MovimientoLlaveroUI) => {
    if (!movLlavero) return;
    const current = await loadMarcaContext();
    if (!current?.id) return;

    setDeletingMovLlaveroKey(movimientoLlaveroRowKey(m));
    try {
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
    } finally {
      setDeletingMovLlaveroKey(null);
    }
  };

  const handleLlaveroMovDelete = (m: MovimientoLlaveroUI) => {
    Alert.alert('Confirmar', '¿Deseas eliminar este movimiento?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => void executeLlaveroMovDelete(m),
      },
    ]);
  };

  const executeLlaveDelete = async (it: LlaveUI) => {
    const current = await loadMarcaContext();
    if (!current?.id) return;

    setDeletingLlaveKey(llaveRowKey(it));
    try {
          const isConnected = await getConnectionStatus();

          if (it.id_local || it.id === 0) {
            const next = llaves.filter((x) => x.id_local !== it.id_local);
            setLlaves(next);
        const cid = numOrNull(it.corpo_id) ?? (await resolveActiveListCorpoId()) ?? 0;
        if (cid) {
          const tree = await readMainStructureTree();
          const rm = removeLlaveFromCorpoTreeAndStripLlaveroLinks(tree, cid, {
            id: it.id && it.id > 0 ? it.id : undefined,
            id_local: it.id_local || undefined,
          });
          await writeMainStructureTree(rm);
          setStructure(rm);
        }
            if (it.id_local) await removeActionsForLocalId(it.id_local);
            return;
          }

          if (isConnected) {
            const res = await deleteLlave({ id: it.id, marcaId: current.id, refreshAccessToken, logout });
            if (res.status) {
          try {
            const tree = await readMainStructureTree();
            const hit = findCorpoAndLlaveRowInTree(tree, { id: it.id });
            if (hit) {
              const rm = removeLlaveFromCorpoTreeAndStripLlaveroLinks(tree, hit.corpoId, { id: it.id });
              await writeMainStructureTree(rm);
              setStructure(rm);
            }
          } catch (e) {
            console.warn('main_structure llave delete:', e);
          }
              Alert.alert('Éxito', 'Llave eliminada correctamente');
              await fetchLlaves();
            } else {
              Alert.alert('Error', res.message || 'No se pudo eliminar la llave');
            }
          } else {
            const next = llaves.filter((x) => x.id !== it.id);
            setLlaves(next);
        const cid = numOrNull(it.corpo_id) ?? (await resolveActiveListCorpoId()) ?? 0;
        if (cid) {
          const tree = await readMainStructureTree();
          const rm = removeLlaveFromCorpoTreeAndStripLlaveroLinks(tree, cid, { id: it.id });
          await writeMainStructureTree(rm);
          setStructure(rm);
        }
            await upsertAction({ type: 'delete', id: it.id, marcaId: current.id });
            Alert.alert('Eliminado (offline)', 'La eliminación se sincronizará cuando vuelva la conexión.');
          }
    } finally {
      setDeletingLlaveKey(null);
    }
  };

  const handleDelete = (it: LlaveUI) => {
    Alert.alert('Confirmar', '¿Deseas eliminar esta llave?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => void executeLlaveDelete(it),
      },
    ]);
  };

  // Funciones para Llaveros (similar a Llaves)
  const resetLlaveroForm = () => {
    setLlaveroNombre('');
    setLlaveroNumero('');
    setLlaveroObservaciones('');
    setLlaveroFirmaResponsable('');
    setLlaveroSelectedLlaveKeys([]);
  };

  const startLlaveroCreating = () => {
    resetLlaveroForm();
    setLlaveroEditing(null);
    setIsLlaveroCreating(true);
    void (async () => {
      await applyCurrentMarcaToFormHierarchy();
      await fetchMainStructure();
    })();
  };

  const startLlaveroEditing = async (it: LlaveroUI) => {
    setLlaveroEditing(it);
    setIsLlaveroCreating(true);
    setLlaveroNombre(it.nombre_llavero || '');
    setLlaveroNumero(it.numero_llavero || '');
    setLlaveroObservaciones(it.observaciones || '');
    setLlaveroFirmaResponsable(it.firma_responsable || '');
    const keys = (it.llaves || []).map(llaveroLinkRowToSelectionKey).filter(Boolean) as string[];
    setLlaveroSelectedLlaveKeys(keys);
    await fetchMainStructure();
    const tree = await readMainStructureTree();
    const snap = await syncMarcaFromStorage({ applyFiltersFromMarca: false });
    const rn = snap?.roleName;
    if (rn != null && rn !== 'OPERATIVO' && tree.length) {
      const byPuesto = it.puesto_id ? findHierarchyByPuestoIn(tree, Number(it.puesto_id)) : null;
      if (byPuesto) {
        setSelectedEmpresaId(byPuesto.empresaId);
        setSelectedClienteId(byPuesto.clienteId);
        setSelectedDivisionId(byPuesto.divisionId);
        setSelectedContratoId(byPuesto.contratoId);
        setSelectedSucursalId(byPuesto.corpoId);
        setSelectedPuestoId(byPuesto.puestoId);
      } else {
        const h = findHierarchyByCorpoIn(tree, Number(it.corpo_id));
        if (h) {
          setSelectedEmpresaId(h.empresaId);
          setSelectedClienteId(h.clienteId);
          setSelectedDivisionId(h.divisionId);
          setSelectedContratoId(h.contratoId);
          setSelectedSucursalId(h.corpoId);
          setSelectedPuestoId(it.puesto_id != null ? Number(it.puesto_id) : null);
        }
      }
    }
  };

  const cancelLlaveroCreating = () => {
    setIsLlaveroCreating(false);
    setLlaveroEditing(null);
    setIsLlaveroLlavesExpanded(false);
    setLlaveroPickerLlaves([]);
    resetLlaveroForm();
  };

  const upsertLlaveroAction = async (action: any) => {
    const actionsStr = await AsyncStorage.getItem('llaveros_actions');
    const actions = actionsStr ? JSON.parse(actionsStr) : [];
    const idKey = action.id || `local-${Date.now()}`;
    let filtered = actions.filter((a: any) => !(a.id === idKey && a.type === action.type));
    if (action.type === 'create') {
      filtered = filtered.filter((a: any) => !(a.type === 'update' && String(a.id) === String(idKey)));
    }
    filtered.push({ ...action, id: idKey });
    await AsyncStorage.setItem('llaveros_actions', JSON.stringify(filtered));
  };

  const removeLlaveroActionsForLocalId = async (localId: string) => {
    const actionsStr = await AsyncStorage.getItem('llaveros_actions');
    if (!actionsStr) return;
    const actions = JSON.parse(actionsStr) || [];
    const updated = actions.filter(
      (a: any) =>
        !(
          (String(a.id) === String(localId) || String(a.id_local) === String(localId)) &&
          (a.type === 'create' || a.type === 'update')
        )
    );
    await AsyncStorage.setItem('llaveros_actions', JSON.stringify(updated));
  };

  const updateLlaveroCreateActionForLocalId = async (localId: string, requestData: any) => {
    const actionsStr = await AsyncStorage.getItem('llaveros_actions');
    let actions = actionsStr ? JSON.parse(actionsStr) || [] : [];
    actions = actions.filter((a: any) => !(a.type === 'update' && String(a.id) === String(localId)));
    let updatedAny = false;
    const updated = actions.map((a: any) => {
      if (a.type === 'create' && String(a.id) === String(localId)) {
        updatedAny = true;
        return { ...a, requestData };
      }
      return a;
    });
    await AsyncStorage.setItem('llaveros_actions', JSON.stringify(updated));
    return updatedAny;
  };

  const upsertLlaveroMovAction = async (action: any) => {
    const actionsStr = await AsyncStorage.getItem('movimientos_llaveros_actions');
    const actions = actionsStr ? JSON.parse(actionsStr) : [];
    const idKey = action.id || `local-${Date.now()}`;
    let filtered = actions.filter((a: any) => !(a.id === idKey && a.type === action.type));
    if (action.type === 'create') {
      filtered = filtered.filter((a: any) => !(a.type === 'update' && String(a.id) === String(idKey)));
    }
    filtered.push({ ...action, id: idKey });
    await AsyncStorage.setItem('movimientos_llaveros_actions', JSON.stringify(filtered));
  };

  const removeLlaveroMovActionsForLocalId = async (localId: string) => {
    const actionsStr = await AsyncStorage.getItem('movimientos_llaveros_actions');
    if (!actionsStr) return;
    const actions = JSON.parse(actionsStr) || [];
    const updated = actions.filter(
      (a: any) =>
        !(
          (String(a.id) === String(localId) || String(a.id_local) === String(localId)) &&
          (a.type === 'create' || a.type === 'update')
        )
    );
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
      const haystack = `${it.numero_llave ?? ''} ${it.cantidad_copias ?? ''} ${it.observaciones ?? ''}`.toLowerCase();
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

  /** Sucursal (corpo) del formulario de llavero: jerarquía elegida o sucursal de current_marca — no el filtro de lista. */
  const llaveroFormCorpoId = useMemo(() => {
    if (!isLlaveroCreating) return null;
    if (roleName === 'OPERATIVO') return marcaCorpoId;
    return selectedSucursalId ?? marcaCorpoId;
  }, [isLlaveroCreating, roleName, marcaCorpoId, selectedSucursalId]);

  /** Llaves de esa sucursal en main_structure; si hay red, se enriquece con API sin mutar el listado principal ni disparar re-renders en bucle. */
  const loadLlavesForLlaveroForm = useCallback(async (listCorpoId: number): Promise<LlaveUI[]> => {
    const tree0 = await readMainStructureTree();
    const fromTree = normalizeLlavesList(getSucursalDataFromTree(tree0, listCorpoId).llaves);
    const isConnected = await getConnectionStatus();
    if (!isConnected) return fromTree;
    try {
      const { refreshAccessToken: r, logout: l } = authFetchRef.current;
      const res = await listLlaves({ corpoId: listCorpoId, refreshAccessToken: r, logout: l });
      if (res.status && Array.isArray(res.data)) {
        const serverList = normalizeLlavesList(res.data);
        const serverIds = new Set(serverList.map((ll) => Number(ll.id)).filter((n) => Number.isFinite(n) && n > 0));
        const localOnly = fromTree.filter(
          (ll) => ll.id_local && (!ll.id || ll.id === 0 || !serverIds.has(Number(ll.id)))
        );
        return [...serverList, ...localOnly];
      }
    } catch (e) {
      console.error('loadLlavesForLlaveroForm:', e);
    }
    return fromTree;
  }, []);

    useEffect(() => {
    if (!isLlaveroLlavesExpanded || !llaveroFormCorpoId) {
      if (!isLlaveroLlavesExpanded) return;
      setLlaveroPickerLlaves([]);
      return;
    }
    let cancelled = false;
    const cid = Number(llaveroFormCorpoId);
    (async () => {
      setLlaveroPickerLoading(true);
      try {
        const list = await loadLlavesForLlaveroForm(cid);
        if (!cancelled) setLlaveroPickerLlaves(list);
      } catch (e) {
        console.error('llavero picker llaves:', e);
        if (!cancelled) setLlaveroPickerLlaves([]);
          } finally {
        if (!cancelled) setLlaveroPickerLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLlaveroLlavesExpanded, llaveroFormCorpoId, loadLlavesForLlaveroForm]);

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
          {it.numero_llave}
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
                        <ThemedText style={styles.firmaInfoValue}>Hora: { convertDateTimestampToLocalString(new Date(Number(info.timestamp)).toISOString()) || 'N/A'}</ThemedText>
                      </>
                    );
                  })()}
                </ThemedView>
              </ThemedView>
            )}
          </ThemedView>
        )}

        <ThemedView style={styles.listItemButtons}>
          <TouchableOpacity style={[styles.listItemButton, styles.editButton]} onPress={() => void startEditing(it)}>
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
          <TouchableOpacity
            style={[styles.listItemButton, styles.deleteButton]}
            onPress={() => handleDelete(it)}
            disabled={deletingLlaveKey === llaveRowKey(it)}
          >
            {deletingLlaveKey === llaveRowKey(it) ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
            <Ionicons name="trash" size={18} color="#FFFFFF" />
            <ThemedText style={styles.listItemButtonText}>Eliminar</ThemedText>
              </>
            )}
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
                <ThemedText style={styles.bitLabel}>Números de llaves y lugares que abren:</ThemedText>
                {(it.llaves || []).map((llaveRel: any, idx: number) => {
                  const lugarAbre = llaveRel.llave?.lugar_abre || 'N/A';
                  const numeroLlave = llaveRel.llave?.numero_llave || 'N/A';
                  return (
                    <ThemedText key={idx} style={[styles.bitValue, { marginTop: 4 }]}>
                      • {numeroLlave} - {lugarAbre}
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
                        <ThemedText style={styles.firmaInfoValue}>Hora: { convertDateTimestampToLocalString(new Date(Number(info.timestamp)).toISOString()) || 'N/A'}</ThemedText>
                      </>
                    );
                  })()}
                </ThemedView>
              </ThemedView>
            )}
          </ThemedView>
        )}

        <ThemedView style={styles.listItemButtons}>
          <TouchableOpacity style={[styles.listItemButton, styles.editButton]} onPress={() => void startLlaveroEditing(it)}>
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
          <TouchableOpacity
            style={[styles.listItemButton, styles.deleteButton]}
            onPress={() => handleLlaveroDelete(it)}
            disabled={deletingLlaveroKey === llaveroRowKey(it)}
          >
            {deletingLlaveroKey === llaveroRowKey(it) ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
            <Ionicons name="trash" size={18} color="#FFFFFF" />
            <ThemedText style={styles.listItemButtonText}>Eliminar</ThemedText>
              </>
            )}
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

              <ThemedView style={styles.titleContainer}>
            {activeTab === 'llaves' ? (
              <>
                <ThemedText type="title" style={styles.title}>
                  <Ionicons name="key" size={22} color="#000000" /> Llaves
                </ThemedText>
                <ThemedText style={styles.subtitle}>Gestiona el registro y control de llaves</ThemedText>
              </>
            ) : (
              <>
                <ThemedText type="title" style={styles.title}>
                  <Ionicons name="key-outline" size={22} color="#000000" /> Llaveros
                </ThemedText>
                <ThemedText style={styles.subtitle}>Gestiona el registro y control de llaveros</ThemedText>
              </>
            )}
              </ThemedView>

          {!hasCurrentMarca ? (
            <ThemedView style={styles.emptyContainer}>
              <ThemedText style={styles.errorText}>
                No hay marca activa. Puede seleccionar la jerarquía manualmente en los filtros.
              </ThemedText>
            </ThemedView>
          ) : null}

          {!isCreating && !isLlaveroCreating && !isLoading ? (
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
                  <TouchableOpacity
                    style={styles.resetFiltersButton}
                    onPress={() => (activeTab === 'llaves' ? resetAllFilters() : resetLlaveroFilters())}
                  >
                        <Ionicons name="refresh" size={16} color="#FF3B30" />
                        <ThemedText style={styles.resetFiltersText}>Reiniciar</ThemedText>
                      </TouchableOpacity>
                    )}
                  </ThemedView>

                  {isFiltersExpanded && (
                    <ThemedView style={styles.filterContent}>
                  {roleName != null && roleName !== 'OPERATIVO' ? (
                    <ThemedView style={{ gap: 8, marginBottom: 8 }}>
                      <ThemedText style={styles.sectionTitle}>Ubicación (Empresa → Sucursal)</ThemedText>
                      <HierarchyPickerFields
                        structure={structure}
                        levels={['cliente', 'contrato', 'sucursal']}
                        isLoading={isStructureLoading}
                        emptyPickerValue={0}
                        values={{
                          empresaId: filterEmpresaId,
                          clienteId: filterClienteId,
                          divisionId: filterDivisionId,
                          contratoId: filterContratoId,
                          sucursalId: filterSucursalId,
                        }}
                        onChange={handleFilterHierarchyChange}
                        labels={{ sucursal: 'Sucursal (Corpo)' }}
                        renderLabel={(text) => <ThemedText style={styles.filterLabel}>{text}</ThemedText>}
                        pickerStyle={styles.pickerShell}
                        fieldGroupStyle={styles.filterGroupSearch}
                      />
                    </ThemedView>
                  ) : null}

                  {activeTab === 'llaves' ? (
                    <>
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
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
                </ThemedView>
              )}
            </ThemedView>
          ) : null}

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

                  {roleName != null && roleName !== 'OPERATIVO' ? (
                    <ThemedView style={{ marginBottom: 12 }}>
                      <ThemedText style={styles.sectionTitle}>Ubicación del registro</ThemedText>
                      <HierarchyPickerFields
                        structure={structure}
                        levels={['cliente', 'contrato', 'sucursal', 'puesto']}
                        isLoading={isStructureLoading}
                        emptyPickerValue={0}
                        values={{
                          empresaId: selectedEmpresaId,
                          clienteId: selectedClienteId,
                          divisionId: selectedDivisionId,
                          contratoId: selectedContratoId,
                          sucursalId: selectedSucursalId,
                          puestoId: selectedPuestoId,
                        }}
                        onChange={handleFormHierarchyChange}
                        labels={{ sucursal: 'Sucursal (Corpo)', puesto: 'Puesto *' }}
                        renderLabel={(text) => <ThemedText style={styles.filterLabel}>{text}</ThemedText>}
                        pickerStyle={styles.pickerShell}
                        fieldGroupStyle={styles.filterGroupSearch}
                      />
                    </ThemedView>
                  ) : null}

                  <ThemedText style={styles.label}>Número de llave *</ThemedText>
                  <TextInput
                    style={styles.input}
                    placeholder="Ej: 1234567890"
                    placeholderTextColor="#999"
                    value={numeroLlave}
                    onChangeText={setNumeroLlave}
                  />

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
                              <ThemedText style={styles.firmaInfoValue}>Hora: { convertDateTimestampToLocalString(new Date(Number(info.timestamp)).toISOString()) || 'N/A'}</ThemedText>
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
                      onPress={handleSaveWithConfirm}
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

                  {roleName != null && roleName !== 'OPERATIVO' ? (
                    <ThemedView style={{ marginBottom: 12 }}>
                      <ThemedText style={styles.sectionTitle}>Ubicación del registro</ThemedText>
                      <HierarchyPickerFields
                        structure={structure}
                        levels={['cliente', 'contrato', 'sucursal', 'puesto']}
                        isLoading={isStructureLoading}
                        emptyPickerValue={0}
                        values={{
                          empresaId: selectedEmpresaId,
                          clienteId: selectedClienteId,
                          divisionId: selectedDivisionId,
                          contratoId: selectedContratoId,
                          sucursalId: selectedSucursalId,
                          puestoId: selectedPuestoId,
                        }}
                        onChange={handleFormHierarchyChange}
                        labels={{ sucursal: 'Sucursal (Corpo)', puesto: 'Puesto *' }}
                        renderLabel={(text) => <ThemedText style={styles.filterLabel}>{text}</ThemedText>}
                        pickerStyle={styles.pickerShell}
                        fieldGroupStyle={styles.filterGroupSearch}
                      />
                    </ThemedView>
                  ) : null}

                  <ThemedText style={styles.label}>Nombre del llavero *</ThemedText>
                  <TextInput
                    style={styles.input}
                    placeholder="Ej: Llavero principal, Llavero oficina..."
                    placeholderTextColor="#999"
                    value={llaveroNombre}
                    onChangeText={setLlaveroNombre}
                  />
                  
                  <ThemedText style={styles.label}>Número del llavero *</ThemedText>
                  <TextInput
                    style={styles.input}
                    placeholder="Ej: 1, 2, 3..."
                    placeholderTextColor="#999"
                    value={llaveroNumero}
                    onChangeText={setLlaveroNumero}
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
                      <ThemedText style={styles.label}>Llaves asociadas ({llaveroSelectedLlaveKeys.length})</ThemedText>
                      <Ionicons
                        name={isLlaveroLlavesExpanded ? 'chevron-up' : 'chevron-down'}
                        size={20}
                        color="#007AFF"
                      />
                    </TouchableOpacity>
                    {isLlaveroLlavesExpanded && (
                      <ThemedView style={styles.expandableContent}>
                        <ThemedView style={styles.llavesSelectorContainer}>
                          {!llaveroFormCorpoId ? (
                            <ThemedText style={styles.emptyText}>
                              Seleccione la sucursal en la jerarquía del formulario (o use la marca actual) para listar llaves.
                            </ThemedText>
                          ) : llaveroPickerLoading ? (
                            <ActivityIndicator size="small" color="#007AFF" />
                          ) : llaveroPickerLlaves.length === 0 ? (
                            <ThemedText style={styles.emptyText}>
                              No hay llaves para esta sucursal en main_structure.
                            </ThemedText>
                          ) : (
                            llaveroPickerLlaves.map((llave) => {
                              const selKey = llaveToSelectionKey(llave);
                              const isSelected = selKey ? llaveroSelectedLlaveKeys.includes(selKey) : false;
                              return (
                                <TouchableOpacity
                                  key={String(llave.id || llave.id_local)}
                                  style={[styles.llaveSelectorItem, isSelected && styles.llaveSelectorItemSelected]}
                                  onPress={() => {
                                    if (!selKey) return;
                                    setLlaveroSelectedLlaveKeys((prev) =>
                                      prev.includes(selKey) ? prev.filter((k) => k !== selKey) : [...prev, selKey]
                                    );
                                  }}
                                  disabled={!selKey}
                                >
                                  <Ionicons
                                    name={isSelected ? 'checkbox' : 'checkbox-outline'}
                                    size={20}
                                    color={isSelected ? '#007AFF' : '#999'}
                                  />
                                  <ThemedText
                                    style={[styles.llaveSelectorText, isSelected && styles.llaveSelectorTextSelected]}
                                  >
                                    {llave.numero_llave} ({llave.cantidad_copias} copias)
                                  </ThemedText>
                                </TouchableOpacity>
                              );
                            })
                          )}
                        </ThemedView>
                      </ThemedView>
                    )}
                  </ThemedView>

                  <ThemedText style={styles.sectionTitle}>Firma responsable *</ThemedText>
                  <ThemedView style={styles.signatureButtons}>
                    <TouchableOpacity
                      style={[styles.signatureButton, isGeneratingLlaveroFirma && styles.signatureButtonDisabled]}
                      onPress={handleGenerateLlaveroFirmaResponsable}
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
                              <ThemedText style={styles.firmaInfoValue}>Hora: { convertDateTimestampToLocalString(new Date(Number(info.timestamp)).toISOString()) || 'N/A'}</ThemedText>
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
                      onPress={handleLlaveroSaveWithConfirm}
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
          value={timeStringToPickerDate(llaveroMovHora)}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, date) => {
            setShowLlaveroMovHoraPicker(false);
            if (date) setLlaveroMovHora(timeToHHMMSS(date));
          }}
        />
      )}

      {/* Modal Movimientos de llaves */}
      <Modal
        visible={isMovModalVisible}
        animationType="fade"
        transparent
        presentationStyle="overFullScreen"
        statusBarTranslucent
        onRequestClose={closeMovimientosModal}
      >
        <View style={styles.overlay}>
          <ThemedView style={styles.floatModalCardMovimientos}>
          <ThemedView style={styles.floatModalHeader}>
            <ThemedText style={styles.modalTitle}>Movimiento de llaves</ThemedText>
            <TouchableOpacity onPress={closeMovimientosModal}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </ThemedView>

          <ScrollView style={styles.floatModalScroll} contentContainerStyle={styles.floatModalScrollContent} keyboardShouldPersistTaps="handled">
            <ThemedView style={styles.modalCard}>
              <ThemedText style={styles.modalCardTitle}>Llave:</ThemedText>
              <ThemedText style={styles.modalCardValue}>{movLlave?.numero_llave || '-'}</ThemedText>
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

                <ThemedText style={styles.sectionTitle}>Firma entrega (Opcional)</ThemedText>
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

                <ThemedText style={styles.sectionTitle}>Firma recibe (Opcional)</ThemedText>
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
                            <ThemedText style={styles.firmaInfoValue}>Hora: { convertDateTimestampToLocalString(new Date(Number(info.timestamp)).toISOString()) || 'N/A'}</ThemedText>
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
                  <TouchableOpacity
                    style={[styles.formActionButton, styles.formActionCancel]}
                    onPress={cancelMovCreating}
                    disabled={isSavingMov}
                  >
                    <Ionicons name="close" size={18} color="#000" />
                    <ThemedText style={styles.formActionCancelText}>Cancelar</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.formActionButton, styles.formActionSave, isSavingMov && styles.formActionButtonDisabled]}
                    onPress={handleMovSaveWithConfirm}
                    disabled={isSavingMov}
                  >
                    {isSavingMov ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
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
                                    <ThemedText style={styles.firmaInfoValue}>Hora: { convertDateTimestampToLocalString(new Date(Number(info.timestamp)).toISOString()) || 'N/A'}</ThemedText>
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
                          <TouchableOpacity
                            style={[styles.listItemButton, styles.deleteButton]}
                            onPress={() => handleMovDelete(m)}
                            disabled={deletingMovLlaveKey === movimientoLlaveRowKey(m)}
                          >
                            {deletingMovLlaveKey === movimientoLlaveRowKey(m) ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <>
                            <Ionicons name="trash" size={18} color="#FFFFFF" />
                            <ThemedText style={styles.listItemButtonText}>Eliminar</ThemedText>
                              </>
                            )}
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
              value={timeStringToPickerDate(movHora)}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, date) => {
                setShowMovHoraPicker(false);
                if (date) setMovHora(timeToHHMMSS(date));
              }}
            />
          )}
        </ThemedView>
        </View>
      </Modal>

      {/* Modal Movimientos de llaveros */}
      <Modal
        visible={isLlaveroMovModalVisible}
        animationType="fade"
        transparent
        presentationStyle="overFullScreen"
        statusBarTranslucent
        onRequestClose={closeLlaveroMovimientosModal}
      >
        <View style={styles.overlay}>
          <ThemedView style={styles.floatModalCardMovimientos}>
          <ThemedView style={styles.floatModalHeader}>
            <ThemedText style={styles.modalTitle}>Movimientos de llaveros</ThemedText>
            <TouchableOpacity onPress={closeLlaveroMovimientosModal}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </ThemedView>

          <ScrollView style={styles.floatModalScroll} contentContainerStyle={styles.floatModalScrollContent} keyboardShouldPersistTaps="handled">
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

                <ThemedText style={styles.sectionTitle}>Firma entrega (Opcional)</ThemedText>
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

                <ThemedText style={styles.sectionTitle}>Firma recibe (Opcional)</ThemedText>
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
                    onPress={handleGenerateLlaveroMovFirmaResponsable}
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
                            <ThemedText style={styles.firmaInfoValue}>Hora: { convertDateTimestampToLocalString(new Date(Number(info.timestamp)).toISOString()) || 'N/A'}</ThemedText>
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
                  <TouchableOpacity
                    style={[styles.formActionButton, styles.formActionCancel]}
                    onPress={cancelLlaveroMovCreating}
                    disabled={isSavingLlaveroMov}
                  >
                    <Ionicons name="close" size={18} color="#000" />
                    <ThemedText style={styles.formActionCancelText}>Cancelar</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.formActionButton, styles.formActionSave, isSavingLlaveroMov && styles.formActionButtonDisabled]}
                    onPress={handleLlaveroMovSaveWithConfirm}
                    disabled={isSavingLlaveroMov}
                  >
                    {isSavingLlaveroMov ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
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
                                    <ThemedText style={styles.firmaInfoValue}>Hora: { convertDateTimestampToLocalString(new Date(Number(info.timestamp)).toISOString()) || 'N/A'}</ThemedText>
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
                          <TouchableOpacity
                            style={[styles.listItemButton, styles.deleteButton]}
                            onPress={() => handleLlaveroMovDelete(m)}
                            disabled={deletingMovLlaveroKey === movimientoLlaveroRowKey(m)}
                          >
                            {deletingMovLlaveroKey === movimientoLlaveroRowKey(m) ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <>
                            <Ionicons name="trash" size={18} color="#FFFFFF" />
                            <ThemedText style={styles.listItemButtonText}>Eliminar</ThemedText>
                              </>
                            )}
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
          value={timeStringToPickerDate(llaveroMovHora)}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, date) => {
                setShowLlaveroMovHoraPicker(false);
                if (date) setLlaveroMovHora(timeToHHMMSS(date));
              }}
            />
          )}
        </ThemedView>
        </View>
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

      <CambiosAppsModulesModal
        visible={isCambiosModalVisible}
        title={cambiosTitle}
        items={cambiosItems}
        onClose={closeCambiosModal}
      />

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
  pickerShell: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
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
  formActionButtonDisabled: {
    opacity: 0.6,
  },
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
  floatModalCardMovimientos: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    width: '100%',
    maxWidth: 500,
    maxHeight: Dimensions.get('window').height * 0.9,
    flexShrink: 1,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  // Altura explícita: flex:1 en ScrollView dentro del card suele colapsar a 0 y el modal parece “vacío”
  floatModalScroll: { maxHeight: Dimensions.get('window').height * 0.76 },
  floatModalScrollContent: { padding: 16 },
  floatModalFilters: { marginBottom: 16 },
  formGroup: { marginTop: 10, marginBottom: 10 },
  cambioCollapsableMain: { width: '100%', marginBottom: 10, backgroundColor: '#fff', borderRadius: 6, borderWidth: 1, borderColor: '#E0E0E0', overflow: 'hidden' },
  cambioCollapsableHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#F8F9FA' },
  cambioCollapsableTitle: { fontSize: 14, fontWeight: '600', color: '#007AFF', flex: 1 },
  cambioCollapsableContent: { padding: 12, gap: 8, backgroundColor: '#F8F9FA' },
  changeDescription: { fontSize: 14, lineHeight: 20, color: '#666', marginBottom: 8 },
  changeDescriptionContainer: { marginBottom: 8 },
  cambioSignatureImage: { marginTop: 6, height: 80, width: 160, backgroundColor: '#f0f0f0', borderRadius: 4 },
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


