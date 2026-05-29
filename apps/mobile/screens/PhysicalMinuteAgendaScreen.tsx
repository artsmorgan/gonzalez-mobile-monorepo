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
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import SignatureScreen from 'react-native-signature-canvas';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import getCurrentUserDigitalSignature from '@/hooks/getCurrentUserDigitalSignature';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { formatDateDMY } from '@/utils/formatDate';
import AppHeader from '@/components/AppHeader';
import AppFooter from '@/components/AppFooter';
import SlideMenu from '@/components/SlideMenu';
import { useAuth } from '@/contexts/AuthContext';
import Constants from 'expo-constants';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { RootStackParamList } from '../App';
import { eventBus } from '@/hooks/eventBus';
import getHoraAccion from '@/hooks/getHoraAccion';
import { useQRScanner } from '@/hooks/useQRScanner';
import { createAgendaMinuta, deleteAgendaMinuta, listAgendaMinutaByCorpo, updateAgendaMinuta } from '@/hooks/evaluationFunctions';
import {
  filterAgendaFromEvaluationsCacheByCorpo,
  mergeEvaluationsCacheAgendaMinutaForCorpo,
} from '@/hooks/agendaMinutaCacheHelpers';
import authedFetch from '@/hooks/authedFetch';
import { convertDateTimestampToLocalString } from '@/hooks/convertDateTimestampToLocalString';
import { loadMainStructureTreeMerged } from '@/hooks/bitacoraMainStructureCache';

type PhysicalMinuteAgendaScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'PhysicalMinuteAgenda'>;

type StructureEmpresa = { id: number; codigo?: string; nombre: string; clientes?: any[] };
type StructureDivision = { id: number; nombre: string; contratos?: any[] };
type StructureCliente = { id: number; nombre: string; division?: StructureDivision[] };
type StructureContrato = { id: number; nombre: string; sucursales?: any[] };
type StructureSucursal = { id: number; nombre: string; nro_sucursal?: string | number; puestos?: any[] };
type StructurePuesto = { id: number; nombre: string; codigo?: string | number };
type StructureTree = StructureEmpresa[];

type AgendaMinutaRecord = {
  id: number | string;
  id_local: string;
  cliente_id: number;
  corpo_id: number;
  puesto_id: number;
  numero: number;
  titulo: string;
  fecha: string | Date;
  hora_inicio: string | Date;
  hora_fin: string | Date;
  autor: string;
  participantes: string;
  acuerdos: string;
  temas_a_tratar?: string;
  observaciones: string;
  firma_responsable: string;
  estado?: boolean;
  created_at: string;
  synced?: boolean;
  cliente_nombre?: string | null;
  corpo_nombre?: string | null;
  puesto_nombre?: string | null;
};

type ParticipanteItem = { id_local: string; nombre: string; puesto: string; firma: string | null };
type AcuerdoItem = { id_local: string; texto: string; responsable: string; fecha_limite: string };
type TemaItem = { id_local: string; tema: string };

type AcuerdosPayload = {
  items: AcuerdoItem[];
  meta?: {
    empresa_id?: number | null;
    cliente_id?: number | null;
    division_id?: number | null;
    division_nombre?: string | null;
    contrato_id?: number | null;
    contrato_nombre?: string | null;
    sucursal_id?: number | null;
    sucursal_nombre?: string | null;
    puesto_id?: number | null;
    puesto_nombre?: string | null;
  };
};

const generateRandomId = (): string => `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const AGENDA_EVAL_TYPES = new Set(['agenda_minuta', 'physical_minute_agenda']);

function isAgendaEvalAction(a: any): boolean {
  return !!(a && AGENDA_EVAL_TYPES.has(a.type));
}

/** True si el registro ya tiene id de servidor (> 0). Borradores locales usan id '' / no numérico. */
function hasAgendaMinutaServerId(r: { id?: number | string | null } | null | undefined): boolean {
  if (!r) return false;
  const n = Number(r.id);
  return Number.isFinite(n) && n > 0;
}

function getNonEmptyLocalKey(value: any): string | null {
  const s = String(value ?? '').trim();
  return s.length > 0 ? s : null;
}

async function mergeOrPushAgendaMinutaCreateEvaluationsActions(localId: string, payload: any) {
  const actionsStr = await AsyncStorage.getItem('evaluations_actions');
  let actions: any[] = actionsStr ? JSON.parse(actionsStr) : [];
  if (!Array.isArray(actions)) actions = [];
  actions = actions.filter(
    (a: any) =>
      !(
        isAgendaEvalAction(a) &&
        a.action === 'update' &&
        (String(a.id) === String(localId) || String(a.id_local) === String(localId))
      )
  );
  const idx = actions.findIndex(
    (a: any) => isAgendaEvalAction(a) && a.action === 'create' && String(a.id) === String(localId)
  );
  if (idx !== -1) {
    const prev = actions[idx].payload || {};
    actions[idx] = {
      ...actions[idx],
      id_local: localId,
      type: 'agenda_minuta',
      payload: { ...prev, ...payload },
      synced: false,
    };
  } else {
    actions.push({
      id: localId,
      id_local: localId,
      action: 'create',
      type: 'agenda_minuta',
      payload,
      synced: false,
    });
  }
  await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));
}

const getConnectionStatus = async (): Promise<boolean> => {
  //return false;
    const networkState = await Network.getNetworkStateAsync();

    return (
      networkState.isConnected === true &&
      networkState.isInternetReachable === true
    );
};

const formatParticipantesForDisplay = (participantesJson: string): string => {
  try {
    const participantes: any[] = JSON.parse(participantesJson || '[]');
    if (!Array.isArray(participantes) || participantes.length === 0) return 'No hay participantes.';
    return participantes.map((p, idx) => {
      const nombre = p?.nombre || '-';
      const puesto = p?.puesto || p?.cedula || '-';
      const tieneFirma = p?.firma ? 'Sí' : 'No';
      return `${idx + 1}. ${nombre} (Puesto: ${puesto}, Firma: ${tieneFirma})`;
    }).join('\n');
  } catch (e) {
    console.error('Error formatting participantes for display:', e);
    return 'Error al formatear participantes.';
  }
};

const formatAcuerdosForDisplay = (acuerdosJson: string): string => {
  try {
    const acuerdos: any[] = JSON.parse(acuerdosJson || '[]');
    if (!Array.isArray(acuerdos) || acuerdos.length === 0) return 'No hay acuerdos.';
    return acuerdos.map((a, idx) => {
      const texto = a?.texto || '-';
      const responsable = String(a?.responsable || '').trim() || '-';
      const fechaLimite = String(a?.fecha_limite || '').trim() || '-';
      return `${idx + 1}. ${texto} (Responsable: ${responsable}, Fecha límite: ${fechaLimite})`;
    }).join('\n');
  } catch (e) {
    console.error('Error formatting acuerdos for display:', e);
    return 'Error al formatear acuerdos.';
  }
};

const formatTemasForDisplay = (temasJson: string): string => {
  try {
    const temas: string[] = JSON.parse(temasJson || '[]');
    if (!Array.isArray(temas) || temas.length === 0) return 'No hay temas.';
    return temas.map((t, idx) => {
      const tema = String(t || '').trim() || '-';
      return `${idx + 1}. ${tema}`;
    }).join('\n');
  } catch (e) {
    console.error('Error formatting temas for display:', e);
    return 'Error al formatear temas.';
  }
};

const formatDateISO = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateDisplay = (date: Date): string => {
  const iso = formatDateISO(date);
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
};

const formatTimeHHmm = (date: Date): string => {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
};

/** Parse "HH:mm" to Date (local) so picker and display match saved time. */
const parseTimeHHmm = (s: string | null | undefined): Date => {
  if (!s || typeof s !== 'string') return new Date(1970, 0, 1, 0, 0, 0, 0);
  const m = s.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return new Date(1970, 0, 1, 0, 0, 0, 0);
  const hh = Math.min(23, Math.max(0, Number(m[1])));
  const mm = Math.min(59, Math.max(0, Number(m[2])));
  return new Date(1970, 0, 1, hh, mm, 0, 0);
};

const normalizeDateYmd = (value: any): string | null => {
  if (!value) return null;
  if (typeof value === 'string') {
    const s = value.trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    const dmy = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  }
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const normalizeTimeToHHmm = (value: any): string | null => {
  if (!value) return null;
  if (typeof value === 'string') {
    const s = value.trim();
    const hhmm = s.match(/^(\d{1,2}):(\d{2})$/);
    if (hhmm) return `${String(Number(hhmm[1])).padStart(2, '0')}:${hhmm[2]}`;
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return formatTimeHHmm(d);
    return null;
  }
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return formatTimeHHmm(d);
};

const safeJsonParse = <T,>(value: any, fallback: T): T => {
  try {
    if (!value) return fallback;
    if (typeof value === 'string') return JSON.parse(value) as T;
    return value as T;
  } catch {
    return fallback;
  }
};

const parseAcuerdosPayload = (value: any): { items: AcuerdoItem[]; meta: AcuerdosPayload['meta'] | null } => {
  const parsed = safeJsonParse<any>(value, null);
  if (!parsed) return { items: [], meta: null };
  if (Array.isArray(parsed)) return { items: parsed as AcuerdoItem[], meta: null };
  if (typeof parsed === 'object' && Array.isArray(parsed.items)) {
    return { items: parsed.items as AcuerdoItem[], meta: (parsed.meta || null) as any };
  }
  return { items: [], meta: null };
};

const formatSignatureForDisplay = (signature: string | null): string | null => {
  if (!signature) return null;
  if (signature.startsWith('data:')) return signature;
  return `data:image/png;base64,${signature}`;
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

const getMarcaRoleDivisionId = (current: any): number | null => {
  const raw = current?.roleDivision?.division?.id
    ?? current?.role_division?.division?.id
    ?? current?.division?.id
    ?? current?.division_id;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const getArray = <T = any,>(...candidates: any[]): T[] => {
  for (const c of candidates) {
    if (Array.isArray(c)) return c as T[];
  }
  return [];
};

const toValidId = (value: any): number | null => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const resolveDivisionIdInStructure = (
  tree: StructureTree,
  empresaId: number | null,
  clienteId: number | null,
  divisionId: number | null
): number | null => {
  if (!Array.isArray(tree) || tree.length === 0 || divisionId == null) return divisionId;
  const empresa = tree.find((e: any) => Number(e?.id) === Number(empresaId));
  const clientes = Array.isArray(empresa?.clientes) ? empresa.clientes : [];
  const cliente = clientes.find((c: any) => Number(c?.id) === Number(clienteId));
  const divisiones = getArray(cliente?.division, (cliente as any)?.divisiones);
  if (divisiones.some((d: any) => Number(d?.id) === Number(divisionId))) return divisionId;
  return null;
};

const resolveHierarchyByPuestoId = (tree: StructureTree, puestoId: number | null) => {
  if (!Array.isArray(tree) || tree.length === 0 || puestoId == null) return null;
  for (const empresa of tree as any[]) {
    for (const cliente of empresa?.clientes || []) {
      for (const division of getArray(cliente?.division, cliente?.divisiones)) {
        for (const contrato of division?.contratos || []) {
          for (const sucursal of contrato?.sucursales || []) {
            const puestos = Array.isArray(sucursal?.puestos) ? sucursal.puestos : [];
            if (puestos.some((p: any) => Number(p?.id) === Number(puestoId))) {
              return {
                empresaId: Number(empresa?.id),
                clienteId: Number(cliente?.id),
                divisionId: Number(division?.id),
                contratoId: Number(contrato?.id),
                sucursalId: Number(sucursal?.id),
                puestoId: Number(puestoId),
              };
            }
          }
        }
      }
    }
  }
  return null;
};

export default function PhysicalMinuteAgendaScreen() {
  const { employee, refreshAccessToken, logout } = useAuth();
  const navigation = useNavigation<PhysicalMinuteAgendaScreenNavigationProp>();
  const [isMenuVisible, setIsMenuVisible] = useState(false);

  const { scanQR, QRScannerComponent } = useQRScanner();

  // list
  const [records, setRecords] = useState<AgendaMinutaRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasCurrentMarca, setHasCurrentMarca] = useState<boolean>(false);

  // Estados para filtros
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  const [filterEmpresaId, setFilterEmpresaId] = useState<number | null>(null);
  const [filterClienteId, setFilterClienteId] = useState<number | null>(null);
  const [filterDivisionId, setFilterDivisionId] = useState<number | null>(null);
  const [filterContratoId, setFilterContratoId] = useState<number | null>(null);
  const [filterCorpoId, setFilterCorpoId] = useState<number | null>(null);
  const [filterPuestoId, setFilterPuestoId] = useState<number | null>(null);
  const [filterFecha, setFilterFecha] = useState('');
  const [filterHoraInicio, setFilterHoraInicio] = useState('');
  const [filterHoraFin, setFilterHoraFin] = useState('');

  // IDs de current_marca para inicialización
  const [marcaEmpresaId, setMarcaEmpresaId] = useState<number | null>(null);
  const [marcaClienteId, setMarcaClienteId] = useState<number | null>(null);
  const [marcaDivisionId, setMarcaDivisionId] = useState<number | null>(null);
  const [marcaContratoId, setMarcaContratoId] = useState<number | null>(null);
  const [marcaCorpoId, setMarcaCorpoId] = useState<number | null>(null);
  const [marcaPuestoId, setMarcaPuestoId] = useState<number | null>(null);
  const [roleName, setRoleName] = useState<string | null>(null);

  // structure
  const [structure, setStructure] = useState<any[]>([]);
  const [isStructureLoading, setIsStructureLoading] = useState(false);
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<number | null>(null);
  const [selectedClienteId, setSelectedClienteId] = useState<number | null>(null);
  const [selectedDivisionId, setSelectedDivisionId] = useState<number | null>(null);
  const [selectedContratoId, setSelectedContratoId] = useState<number | null>(null);
  const [selectedSucursalId, setSelectedSucursalId] = useState<number | null>(null);
  const [selectedPuestoId, setSelectedPuestoId] = useState<number | null>(null);
  const isRestoringHierarchyRef = useRef(false);
  const pendingCreateHierarchyRef = useRef<{
    empresaId: number | null;
    clienteId: number | null;
    divisionId: number | null;
    contratoId: number | null;
    sucursalId: number | null;
    puestoId: number | null;
  } | null>(null);
  const isApplyingCreateHierarchyRef = useRef(false);
  const pendingEditHierarchyRef = useRef<{
    empresaId: number | null;
    clienteId: number | null;
    divisionId: number | null;
    contratoId: number | null;
    sucursalId: number | null;
    puestoId: number | null;
  } | null>(null);
  const isApplyingEditHierarchyRef = useRef(false);

  // create/edit mode
  const [isCreating, setIsCreating] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AgendaMinutaRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);
  const [submitResponse, setSubmitResponse] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // form
  const [numero, setNumero] = useState('');
  const [titulo, setTitulo] = useState('');
  const [fecha, setFecha] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [horaInicio, setHoraInicio] = useState<Date>(new Date());
  const [horaFin, setHoraFin] = useState<Date>(new Date());
  const [showTimePickerInicio, setShowTimePickerInicio] = useState(false);
  const [showTimePickerFin, setShowTimePickerFin] = useState(false);
  const [showAcuerdoDatePickerForId, setShowAcuerdoDatePickerForId] = useState<string | null>(null);
  const [autor, setAutor] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [estado, setEstado] = useState(false);

  const [participantes, setParticipantes] = useState<ParticipanteItem[]>([]);
  const [acuerdos, setAcuerdos] = useState<AcuerdoItem[]>([]);
  const [temasATratar, setTemasATratar] = useState<TemaItem[]>([]);

  // participantes signature modal
  const [isSignatureModalVisible, setIsSignatureModalVisible] = useState(false);
  const [currentParticipanteId, setCurrentParticipanteId] = useState<string | null>(null);
  const signatureRef = useRef<any>(null);
  const [signatureKey, setSignatureKey] = useState(0);
  const [tempSignature, setTempSignature] = useState<string | null>(null);

  // firma responsable (QR)
  const [firmaResponsable, setFirmaResponsable] = useState<string>('');
  const [isGeneratingFirma, setIsGeneratingFirma] = useState(false);

  // UI collapsables in list items
  const [expandedParticipantesById, setExpandedParticipantesById] = useState<Record<string, boolean>>({});
  const [codigoParticipante, setCodigoParticipante] = useState<string>('');
  const [expandedAcuerdosById, setExpandedAcuerdosById] = useState<Record<string, boolean>>({});
  const [expandedTemasById, setExpandedTemasById] = useState<Record<string, boolean>>({});
  const [expandedFirmaById, setExpandedFirmaById] = useState<Record<string, boolean>>({});

  // Modal: ver cambios (auditoría)
  const [isCambiosModalVisible, setIsCambiosModalVisible] = useState(false);
  const [cambiosTitle, setCambiosTitle] = useState<string>('Cambios');
  const [cambiosItems, setCambiosItems] = useState<any[]>([]);
  const [expandedCambioId, setExpandedCambioId] = useState<number | null>(null);

  const signatureWebStyle = `
    body, html {
      margin: 0;
      padding: 0;
      height: 100%;
      width: 100%;
    }
    .m-signature-pad {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      margin: 0;
      padding: 0;
      box-shadow: none;
      border: none;
      background-color: #FFFFFF;
    }
    .m-signature-pad--body {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      border: none;
      margin: 0;
      padding: 0;
    }
    .m-signature-pad--body canvas {
      width: 100% !important;
      height: 100% !important;
      touch-action: none;
    }
    .m-signature-pad--footer {
      display: none;
    }
  `;

  const loadMarcaContext = async () => {
    const currentMarcaStr = await AsyncStorage.getItem('current_marca');
    if (!currentMarcaStr) {
      setHasCurrentMarca(false);
      setMarcaEmpresaId(null);
      setMarcaClienteId(null);
      setMarcaDivisionId(null);
      setMarcaContratoId(null);
      setMarcaCorpoId(null);
      setMarcaPuestoId(null);
      setRoleName(null);
      return null;
    }
    try {
      const current = JSON.parse(currentMarcaStr);
      if (!current?.id) {
        setHasCurrentMarca(false);
        setMarcaEmpresaId(null);
        setMarcaClienteId(null);
        setMarcaDivisionId(null);
        setMarcaContratoId(null);
        setMarcaCorpoId(null);
        setMarcaPuestoId(null);
        setRoleName(null);
        return null;
      }
      setHasCurrentMarca(true);

      const rnRaw =
        current?.roleDivision?.role?.nombre ?? current?.role_division?.role?.nombre ?? null;
      setRoleName(typeof rnRaw === 'string' ? rnRaw : null);

      // Obtener IDs jerárquicos de current_marca (incluye roleDivision.division.id)
      const empresaIdRaw = current?.empresa?.id ?? current?.empresa_id;
      const clienteIdRaw = current?.cliente?.id ?? current?.cliente_id;
      const contratoIdRaw = current?.contrato?.id ?? current?.contrato_id;
      const corpoIdRaw = current?.corpo?.id ?? current?.corpo_id;
      const puestoIdRaw = current?.puesto?.id ?? current?.puesto_id;
      const divisionIdRaw = getMarcaRoleDivisionId(current);

      setMarcaEmpresaId(empresaIdRaw !== undefined && empresaIdRaw !== null ? toValidId(empresaIdRaw) : null);
      setMarcaClienteId(clienteIdRaw !== undefined && clienteIdRaw !== null ? toValidId(clienteIdRaw) : null);
      setMarcaDivisionId(divisionIdRaw !== undefined && divisionIdRaw !== null ? toValidId(divisionIdRaw) : null);
      setMarcaContratoId(contratoIdRaw !== undefined && contratoIdRaw !== null ? toValidId(contratoIdRaw) : null);
      setMarcaCorpoId(corpoIdRaw !== undefined && corpoIdRaw !== null ? toValidId(corpoIdRaw) : null);
      setMarcaPuestoId(puestoIdRaw !== undefined && puestoIdRaw !== null ? toValidId(puestoIdRaw) : null);

      return current;
    } catch {
      setHasCurrentMarca(false);
      setMarcaEmpresaId(null);
      setMarcaClienteId(null);
      setMarcaDivisionId(null);
      setMarcaContratoId(null);
      setMarcaCorpoId(null);
      setMarcaPuestoId(null);
      setRoleName(null);
      return null;
    }
  };

  const fetchMainStructure = useCallback(async (): Promise<StructureTree> => {
    setIsStructureLoading(true);
    try {
      const mergedTree = await loadMainStructureTreeMerged();
      if (Array.isArray(mergedTree)) {
        setStructure(mergedTree as StructureTree);
        return mergedTree as StructureTree;
      }
      setStructure([]);
      return [];
      /*
      const isConnected = await getConnectionStatus();
      if (!isConnected) return;

      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) throw new Error('Server URL not configured');
      const response = await authedFetch({
        url: `${apiUrl}/api/main-structure`,
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

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      const incoming = data?.structure;
      if (data?.status && Array.isArray(incoming)) {
        setStructure(incoming);
        await AsyncStorage.setItem('main_structure_cache', JSON.stringify(incoming));
      }
      */
    } catch (e) {
      console.error('Error fetching main structure for agenda-minuta:', e);
      return [];
    } finally {
      setIsStructureLoading(false);
    }
  }, []);

  const applyHierarchyFiltersFromMarca = useCallback((current: any, tree: StructureTree) => {
    if (!current) return;
    const empresaIdRaw = current?.empresa?.id ?? current?.empresa_id;
    const clienteIdRaw = current?.cliente?.id ?? current?.cliente_id;
    const contratoIdRaw = current?.contrato?.id ?? current?.contrato_id;
    const corpoIdRaw = current?.corpo?.id ?? current?.corpo_id;
    const puestoIdRaw = current?.puesto?.id ?? current?.puesto_id;
    const divisionIdRaw = getMarcaRoleDivisionId(current);

    const empresaId = empresaIdRaw !== undefined && empresaIdRaw !== null ? toValidId(empresaIdRaw) : null;
    const clienteId = clienteIdRaw !== undefined && clienteIdRaw !== null ? toValidId(clienteIdRaw) : null;
    const contratoId = contratoIdRaw !== undefined && contratoIdRaw !== null ? toValidId(contratoIdRaw) : null;
    const corpoId = corpoIdRaw !== undefined && corpoIdRaw !== null ? toValidId(corpoIdRaw) : null;
    const puestoId = puestoIdRaw !== undefined && puestoIdRaw !== null ? toValidId(puestoIdRaw) : null;
    const divisionId = resolveDivisionIdInStructure(tree, empresaId, clienteId, divisionIdRaw);

    // Importante: setear de padre a hijo para no disparar limpiezas en cascada.
    setFilterEmpresaId(empresaId);
    setFilterClienteId(clienteId);
    setFilterDivisionId(divisionId);
    setFilterContratoId(contratoId);
    setFilterCorpoId(corpoId);
    // "Puesto" es solo un filtro visual; inicia vacío para mostrar todos los registros del corpo.
    setFilterPuestoId(null);
  }, []);

  const applyHierarchyFormFromMarca = useCallback((current: any, tree: StructureTree) => {
    if (!current) return;
    const empresaIdRaw = current?.empresa?.id ?? current?.empresa_id;
    const clienteIdRaw = current?.cliente?.id ?? current?.cliente_id;
    const contratoIdRaw = current?.contrato?.id ?? current?.contrato_id;
    const corpoIdRaw = current?.corpo?.id ?? current?.corpo_id;
    const puestoIdRaw = current?.puesto?.id ?? current?.puesto_id;
    const divisionIdRaw = getMarcaRoleDivisionId(current);

    const empresaId = empresaIdRaw !== undefined && empresaIdRaw !== null ? toValidId(empresaIdRaw) : null;
    const clienteId = clienteIdRaw !== undefined && clienteIdRaw !== null ? toValidId(clienteIdRaw) : null;
    const contratoId = contratoIdRaw !== undefined && contratoIdRaw !== null ? toValidId(contratoIdRaw) : null;
    const corpoId = corpoIdRaw !== undefined && corpoIdRaw !== null ? toValidId(corpoIdRaw) : null;
    const puestoId = puestoIdRaw !== undefined && puestoIdRaw !== null ? toValidId(puestoIdRaw) : null;
    const divisionId = resolveDivisionIdInStructure(tree, empresaId, clienteId, divisionIdRaw);

    pendingCreateHierarchyRef.current = {
      empresaId,
      clienteId,
      divisionId,
      contratoId,
      sucursalId: corpoId,
      puestoId,
    };
    isApplyingCreateHierarchyRef.current = true;
    isRestoringHierarchyRef.current = true;
    setSelectedEmpresaId(empresaId);
  }, []);

  useEffect(() => {
    const pending = pendingCreateHierarchyRef.current;
    if (!pending || !isApplyingCreateHierarchyRef.current) return;
    if (!isCreating || !!editingRecord) return;

    if ((pending.empresaId ?? null) !== (selectedEmpresaId ?? null)) {
      setSelectedEmpresaId(pending.empresaId ?? null);
      return;
    }
    if ((pending.clienteId ?? null) !== (selectedClienteId ?? null)) {
      setSelectedClienteId(pending.clienteId ?? null);
      return;
    }
    if ((pending.divisionId ?? null) !== (selectedDivisionId ?? null)) {
      setSelectedDivisionId(pending.divisionId ?? null);
      return;
    }
    if ((pending.contratoId ?? null) !== (selectedContratoId ?? null)) {
      setSelectedContratoId(pending.contratoId ?? null);
      return;
    }
    if ((pending.sucursalId ?? null) !== (selectedSucursalId ?? null)) {
      setSelectedSucursalId(pending.sucursalId ?? null);
      return;
    }
    if ((pending.puestoId ?? null) !== (selectedPuestoId ?? null)) {
      setSelectedPuestoId(pending.puestoId ?? null);
      return;
    }

    pendingCreateHierarchyRef.current = null;
    isApplyingCreateHierarchyRef.current = false;
    isRestoringHierarchyRef.current = false;
  }, [
    isCreating,
    editingRecord,
    selectedEmpresaId,
    selectedClienteId,
    selectedDivisionId,
    selectedContratoId,
    selectedSucursalId,
    selectedPuestoId,
  ]);

  useEffect(() => {
    const pending = pendingEditHierarchyRef.current;
    if (!pending || !isApplyingEditHierarchyRef.current) return;
    if (!isCreating || !editingRecord) return;

    if ((pending.empresaId ?? null) !== (selectedEmpresaId ?? null)) {
      setSelectedEmpresaId(pending.empresaId ?? null);
      return;
    }
    if ((pending.clienteId ?? null) !== (selectedClienteId ?? null)) {
      setSelectedClienteId(pending.clienteId ?? null);
      return;
    }
    if ((pending.divisionId ?? null) !== (selectedDivisionId ?? null)) {
      setSelectedDivisionId(pending.divisionId ?? null);
      return;
    }
    if ((pending.contratoId ?? null) !== (selectedContratoId ?? null)) {
      setSelectedContratoId(pending.contratoId ?? null);
      return;
    }
    if ((pending.sucursalId ?? null) !== (selectedSucursalId ?? null)) {
      setSelectedSucursalId(pending.sucursalId ?? null);
      return;
    }
    if ((pending.puestoId ?? null) !== (selectedPuestoId ?? null)) {
      setSelectedPuestoId(pending.puestoId ?? null);
      return;
    }

    pendingEditHierarchyRef.current = null;
    isApplyingEditHierarchyRef.current = false;
    isRestoringHierarchyRef.current = false;
  }, [
    isCreating,
    editingRecord,
    selectedEmpresaId,
    selectedClienteId,
    selectedDivisionId,
    selectedContratoId,
    selectedSucursalId,
    selectedPuestoId,
  ]);

  // Nodos computados para estructura jerárquica de filtros
  const filterEmpresas = useMemo(() => (Array.isArray(structure) ? structure : []), [structure]);

  const filterClientes = useMemo(() => {
    const empresa = filterEmpresas.find((e: any) => e.id === filterEmpresaId);
    return empresa?.clientes || [];
  }, [filterEmpresas, filterEmpresaId]);

  const filterDivisiones = useMemo(() => {
    const cliente = filterClientes.find((c: any) => c.id === filterClienteId);
    return getArray(cliente?.division, cliente?.divisiones);
  }, [filterClientes, filterClienteId]);

  const filterContratos = useMemo(() => {
    const division = filterDivisiones.find((d: any) => d.id === filterDivisionId);
    return division?.contratos || [];
  }, [filterDivisiones, filterDivisionId]);

  const filterSucursales = useMemo(() => {
    const contrato = filterContratos.find((c: any) => c.id === filterContratoId);
    return contrato?.sucursales || [];
  }, [filterContratos, filterContratoId]);

  const filterPuestos = useMemo(() => {
    const sucursal = filterSucursales.find((s: any) => s.id === filterCorpoId);
    return sucursal?.puestos || [];
  }, [filterSucursales, filterCorpoId]);

  const visualFilterPuestos = useMemo(() => {
    if (Array.isArray(filterPuestos) && filterPuestos.length > 0) return filterPuestos;
    const map = new Map<number, { id: number; nombre: string }>();
    for (const r of records || []) {
      const pid = Number((r as any)?.puesto_id);
      if (!Number.isFinite(pid) || pid <= 0) continue;
      const label = String((r as any)?.puesto_nombre || `Puesto ${pid}`).trim();
      if (!map.has(pid)) map.set(pid, { id: pid, nombre: label });
    }
    return Array.from(map.values());
  }, [filterPuestos, records]);

  const hasValidVisualPuestoSelected = useMemo(() => {
    if (!Number.isFinite(Number(filterPuestoId)) || Number(filterPuestoId) <= 0) return false;
    return visualFilterPuestos.some((p: any) => Number(p?.id) === Number(filterPuestoId));
  }, [filterPuestoId, visualFilterPuestos]);

  useEffect(() => {
    if (filterPuestoId == null) return;
    if (!hasValidVisualPuestoSelected) setFilterPuestoId(null);
  }, [filterPuestoId, hasValidVisualPuestoSelected]);

  const selectedEmpresaNode = useMemo<StructureEmpresa | null>(() => {
    if (selectedEmpresaId === null) return null;
    return (structure.find((e: any) => e.id === selectedEmpresaId) as StructureEmpresa) ?? null;
  }, [structure, selectedEmpresaId]);

  const clienteNodes = useMemo<StructureCliente[]>(() => {
    return (selectedEmpresaNode?.clientes ?? []) as StructureCliente[];
  }, [selectedEmpresaNode]);

  const selectedClienteNode = useMemo<StructureCliente | null>(() => {
    if (selectedClienteId === null) return null;
    return (clienteNodes.find((c: any) => c.id === selectedClienteId) as StructureCliente) ?? null;
  }, [clienteNodes, selectedClienteId]);

  const divisionNodes = useMemo<StructureDivision[]>(() => {
    return getArray(selectedClienteNode?.division, (selectedClienteNode as any)?.divisiones) as StructureDivision[];
  }, [selectedClienteNode]);

  const selectedDivisionNode = useMemo<StructureDivision | null>(() => {
    if (selectedDivisionId === null) return null;
    return (divisionNodes.find((d: any) => d.id === selectedDivisionId) as StructureDivision) ?? null;
  }, [divisionNodes, selectedDivisionId]);

  const contratoNodes = useMemo<StructureContrato[]>(() => {
    return (selectedDivisionNode?.contratos ?? []) as StructureContrato[];
  }, [selectedDivisionNode]);

  const selectedContratoNode = useMemo<StructureContrato | null>(() => {
    if (selectedContratoId === null) return null;
    return (contratoNodes.find((c: any) => c.id === selectedContratoId) as StructureContrato) ?? null;
  }, [contratoNodes, selectedContratoId]);

  const sucursalNodes = useMemo<StructureSucursal[]>(() => {
    return (selectedContratoNode?.sucursales ?? []) as StructureSucursal[];
  }, [selectedContratoNode]);

  const selectedSucursalNode = useMemo<StructureSucursal | null>(() => {
    if (selectedSucursalId === null) return null;
    return (sucursalNodes.find((s: any) => s.id === selectedSucursalId) as StructureSucursal) ?? null;
  }, [sucursalNodes, selectedSucursalId]);

  const puestoNodes = useMemo<StructurePuesto[]>(() => {
    return (selectedSucursalNode?.puestos ?? []) as StructurePuesto[];
  }, [selectedSucursalNode]);

  // cascade clear
  useEffect(() => {
    if (isRestoringHierarchyRef.current) return;
    setSelectedClienteId(null);
    setSelectedDivisionId(null);
    setSelectedContratoId(null);
    setSelectedSucursalId(null);
    setSelectedPuestoId(null);
  }, [selectedEmpresaId]);

  useEffect(() => {
    if (isRestoringHierarchyRef.current) return;
    setSelectedDivisionId(null);
    setSelectedContratoId(null);
    setSelectedSucursalId(null);
    setSelectedPuestoId(null);
  }, [selectedClienteId]);

  useEffect(() => {
    if (isRestoringHierarchyRef.current) return;
    setSelectedContratoId(null);
    setSelectedSucursalId(null);
    setSelectedPuestoId(null);
  }, [selectedDivisionId]);

  useEffect(() => {
    if (isRestoringHierarchyRef.current) return;
    setSelectedSucursalId(null);
    setSelectedPuestoId(null);
  }, [selectedContratoId]);

  useEffect(() => {
    if (isRestoringHierarchyRef.current) return;
    setSelectedPuestoId(null);
  }, [selectedSucursalId]);

  const empresaOptions = useMemo(() => {
    return structure.map((e: any) => ({
      id: e.id as number,
      label: `${e.codigo ? `${e.codigo} - ` : ''}${e.nombre}`,
    }));
  }, [structure]);

  const clienteOptions = useMemo(() => {
    return clienteNodes.map((c: any) => ({ id: c.id as number, label: c.nombre as string }));
  }, [clienteNodes]);

  const divisionOptions = useMemo(() => {
    return divisionNodes.map((d: any) => ({ id: d.id as number, label: d.nombre as string }));
  }, [divisionNodes]);

  const contratoOptions = useMemo(() => {
    return contratoNodes.map((c: any) => ({ id: c.id as number, label: c.nombre as string }));
  }, [contratoNodes]);

  const sucursalOptions = useMemo(() => {
    return sucursalNodes.map((s: any) => ({
      id: s.id as number,
      label: `${s.nro_sucursal ? `${s.nro_sucursal} - ` : ''}${s.nombre}`,
    }));
  }, [sucursalNodes]);

  const puestoOptions = useMemo(() => {
    return puestoNodes.map((p: any) => ({
      id: p.id as number,
      label: `${p.codigo ? `${p.codigo} - ` : ''}${p.nombre}`,
    }));
  }, [puestoNodes]);

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
      if (prop === 'participantes') {
        return formatParticipantesForDisplay(JSON.stringify(value));
      }
      if (prop === 'acuerdos') {
        return formatAcuerdosForDisplay(JSON.stringify(value));
      }
      if (prop === 'temas_a_tratar') {
        return formatTemasForDisplay(JSON.stringify(value));
      }
      return JSON.stringify(value, null, 2);
    }
    if (typeof value === 'string') {
      // Si parece ser JSON, intentar parsearlo
      if (value.trim().startsWith('{') || value.trim().startsWith('[')) {
        try {
          const parsed = JSON.parse(value);
          if (prop === 'participantes') {
            return formatParticipantesForDisplay(value);
          }
          if (prop === 'acuerdos') {
            return formatAcuerdosForDisplay(value);
          }
          if (prop === 'temas_a_tratar') {
            return formatTemasForDisplay(value);
          }
          return JSON.stringify(parsed, null, 2);
        } catch {
          // No es JSON válido, retornar como string
        }
      }
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

  const resetForm = (horaAccion: number) => {
    setSelectedEmpresaId(null);
    setSelectedClienteId(null);
    setSelectedDivisionId(null);
    setSelectedContratoId(null);
    setSelectedSucursalId(null);
    setSelectedPuestoId(null);
    setNumero('');
    setTitulo('');
    setFecha(new Date(horaAccion));
    setHoraInicio(new Date(horaAccion));
    setHoraFin(new Date(horaAccion));
    setAutor('');
    setObservaciones('');
    setEstado(false);
    setParticipantes([]);
    setAcuerdos([]);
    setTemasATratar([]);
    setFirmaResponsable('');
  };

  const startCreate = async () => {
    const horaAccion = await getHoraAccion();
    if (!horaAccion) {
      Alert.alert('Error', 'No se pudo obtener la hora de acción');
      return;
    }
    setEditingRecord(null);
    setIsCreating(true);
    resetForm(horaAccion);
    const current = await loadMarcaContext();
    if (!current) return;
    const tree = structure.length ? (structure as StructureTree) : await fetchMainStructure();
    applyHierarchyFormFromMarca(current, tree);
  };

  const cancelCreateOrEdit = () => {
    pendingCreateHierarchyRef.current = null;
    isApplyingCreateHierarchyRef.current = false;
    pendingEditHierarchyRef.current = null;
    isApplyingEditHierarchyRef.current = false;
    isRestoringHierarchyRef.current = false;
    setIsCreating(false);
    setEditingRecord(null);
  };

  const startEditing = async (r: AgendaMinutaRecord) => {
    const horaAccion = await getHoraAccion();
    if (!horaAccion) {
      Alert.alert('Error', 'No se pudo obtener la hora de acción');
      return;
    }
    pendingCreateHierarchyRef.current = null;
    isApplyingCreateHierarchyRef.current = false;
    pendingEditHierarchyRef.current = null;
    isApplyingEditHierarchyRef.current = false;
    setIsCreating(true);
    setEditingRecord(r);

    const { meta } = parseAcuerdosPayload(r.acuerdos);
    const puestoIdFromRecord = Number(meta?.puesto_id ?? r.puesto_id ?? 0) || null;
    const tree = structure.length ? (structure as StructureTree) : await fetchMainStructure();
    const pathByPuesto = resolveHierarchyByPuestoId(tree, puestoIdFromRecord);
    pendingEditHierarchyRef.current = {
      empresaId: (pathByPuesto?.empresaId ?? meta?.empresa_id ?? null) as any,
      clienteId: (pathByPuesto?.clienteId ?? meta?.cliente_id ?? r.cliente_id ?? null) as any,
      divisionId: (pathByPuesto?.divisionId ?? meta?.division_id ?? null) as any,
      contratoId: (pathByPuesto?.contratoId ?? meta?.contrato_id ?? null) as any,
      sucursalId: (pathByPuesto?.sucursalId ?? meta?.sucursal_id ?? r.corpo_id ?? null) as any,
      puestoId: (pathByPuesto?.puestoId ?? meta?.puesto_id ?? r.puesto_id ?? null) as any,
    };
    isApplyingEditHierarchyRef.current = true;
    isRestoringHierarchyRef.current = true;
    setSelectedEmpresaId(pendingEditHierarchyRef.current.empresaId);

    setNumero(String(r.numero ?? ''));
    setTitulo(String(r.titulo ?? ''));
    setAutor(String(r.autor ?? ''));
    setObservaciones(String(r.observaciones ?? ''));
    setEstado(Boolean((r as any).estado));

    const fechaParsed = r.fecha instanceof Date ? r.fecha : new Date(String(r.fecha));
    setFecha(Number.isNaN(fechaParsed.getTime()) ? new Date(horaAccion) : fechaParsed);

    const horaInicioVal = typeof r.hora_inicio === 'string' && /^\d{1,2}:\d{2}$/.test(r.hora_inicio) ? r.hora_inicio : (r.hora_inicio instanceof Date ? formatTimeHHmm(r.hora_inicio) : (r.hora_inicio ? formatTimeHHmm(new Date(String(r.hora_inicio))) : '00:00'));
    const horaFinVal = typeof r.hora_fin === 'string' && /^\d{1,2}:\d{2}$/.test(r.hora_fin) ? r.hora_fin : (r.hora_fin instanceof Date ? formatTimeHHmm(r.hora_fin) : (r.hora_fin ? formatTimeHHmm(new Date(String(r.hora_fin))) : '00:00'));
    setHoraInicio(parseTimeHHmm(horaInicioVal));
    setHoraFin(parseTimeHHmm(horaFinVal));

    const parsedParticipantes = safeJsonParse<ParticipanteItem[]>(r.participantes, []);
    const parsedAcuerdos = parseAcuerdosPayload(r.acuerdos).items;
    const parsedTemas = safeJsonParse<string[]>((r as any).temas_a_tratar, []);
    setParticipantes(
      parsedParticipantes.map((p) => ({
        id_local: p.id_local || generateRandomId(),
        nombre: p.nombre || '',
        puesto: (p as any).puesto || (p as any).cedula || '',
        firma: p.firma ?? null,
      }))
    );
    setAcuerdos(
      (parsedAcuerdos || []).map((a) => ({
        id_local: a.id_local || generateRandomId(),
        texto: a.texto || '',
        responsable: (a as any).responsable || '',
        fecha_limite: (a as any).fecha_limite || '',
      }))
    );
    setTemasATratar(
      (parsedTemas || []).map((tema: string) => ({
        id_local: generateRandomId(),
        tema: tema || '',
      }))
    );
    setFirmaResponsable(r.firma_responsable || '');
  };

  const handleGenerateFirmaResponsable = async () => {
    if (isGeneratingFirma) return;
    setIsGeneratingFirma(true);
    try {
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
      const decoded = decodeFirmaHash(qrData);
      if (!decoded) {
        Alert.alert('Error', 'El QR escaneado no tiene el formato correcto');
        return;
      }
      setFirmaResponsable(qrData);
    } catch {
      Alert.alert('Error', 'No se pudo escanear el QR');
    }
  };

  const openParticipanteSignature = (id_local: string) => {
    setCurrentParticipanteId(id_local);
    setIsSignatureModalVisible(true);
    setTempSignature(null);
    setSignatureKey((p) => p + 1);
  };

  const closeSignatureModal = () => {
    setIsSignatureModalVisible(false);
    setCurrentParticipanteId(null);
    setTempSignature(null);
    setSignatureKey((p) => p + 1);
  };

  const clearSignatureInModal = () => {
    setTempSignature(null);
    setSignatureKey((p) => p + 1);
    if (signatureRef.current) signatureRef.current.clearSignature();
  };

  const handleSignature = (sig: string) => {
    setTempSignature(sig);
  };

  const handleSignatureRead = (sig: string) => {
    if (!sig || !currentParticipanteId) {
      Alert.alert('Error', 'No se pudo obtener la firma. Intente nuevamente.');
      return;
    }
    setParticipantes((prev) =>
      prev.map((p) => (p.id_local === currentParticipanteId ? { ...p, firma: sig } : p))
    );
    closeSignatureModal();
  };

  const acceptSignature = () => {
    if (signatureRef.current) signatureRef.current.readSignature();
    else if (tempSignature) handleSignatureRead(tempSignature);
    else Alert.alert('Error', 'Debe dibujar una firma antes de aceptar');
  };

  const addParticipante = () => {
    setParticipantes((prev) => [...prev, { id_local: generateRandomId(), nombre: '', puesto: '', firma: null }]);
  };

  const removeParticipante = (id_local: string) => {
    setParticipantes((prev) => prev.filter((p) => p.id_local !== id_local));
  };

  const updateParticipante = (id_local: string, patch: Partial<ParticipanteItem>) => {
    setParticipantes((prev) => prev.map((p) => (p.id_local === id_local ? { ...p, ...patch } : p)));
  };

  const addAcuerdo = () => {
    setAcuerdos((prev) => [...prev, { id_local: generateRandomId(), texto: '', responsable: '', fecha_limite: '' }]);
  };

  const removeAcuerdo = (id_local: string) => {
    setAcuerdos((prev) => prev.filter((a) => a.id_local !== id_local));
  };

  const updateAcuerdo = (id_local: string, patch: Partial<AcuerdoItem>) => {
    setAcuerdos((prev) => prev.map((a) => (a.id_local === id_local ? { ...a, ...patch } : a)));
  };

  const addTema = () => {
    setTemasATratar((prev) => [...prev, { id_local: generateRandomId(), tema: '' }]);
  };

  const removeTema = (id_local: string) => {
    setTemasATratar((prev) => prev.filter((t) => t.id_local !== id_local));
  };

  const updateTema = (id_local: string, patch: Partial<TemaItem>) => {
    setTemasATratar((prev) => prev.map((t) => (t.id_local === id_local ? { ...t, ...patch } : t)));
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

  const handleSearchParticipanteByCode = async () => {
    const code = String(codigoParticipante || '').trim();
    if (!code) {
      Alert.alert('Error', 'Debes ingresar un código de participante');
      return;
    }
    try {
      const empleado = await getEmpleadoByCodigo(code);
      const nombre = String(empleado?.nombre_completo || empleado?.nombre || '').trim();
      const puesto = String(empleado?.puesto_nombre || empleado?.puesto || empleado?.cargo || '').trim();
      setParticipantes((prev) => [
        ...prev,
        {
          id_local: generateRandomId(),
          nombre,
          puesto,
          firma: null,
        },
      ]);
      setCodigoParticipante('');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo buscar el empleado por código');
    }
  };

  const fetchRecords = useCallback(async () => {
    let searchCorpoIdNum: number | null = null;
    try {
      setIsLoading(true);
      setError(null);

      let currentMarca: any = null;
      try {
        const raw = await AsyncStorage.getItem('current_marca');
        if (raw) currentMarca = JSON.parse(raw);
      } catch {
        currentMarca = null;
      }
      const rn =
        currentMarca?.roleDivision?.role?.nombre ??
        currentMarca?.role_division?.role?.nombre ??
        null;
      const isOperativoUser = rn === 'OPERATIVO';

      if (isOperativoUser && currentMarca) {
        const c = Number(currentMarca?.corpo?.id ?? currentMarca?.corpo_id);
        searchCorpoIdNum = Number.isFinite(c) && c > 0 ? c : null;
      } else {
        const c = Number(filterCorpoId);
        searchCorpoIdNum = Number.isFinite(c) && c > 0 ? c : null;
      }

      const parseEvaluationsCacheArray = async (): Promise<any[]> => {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (!cacheStr) return [];
        try {
          const p = JSON.parse(cacheStr);
          return Array.isArray(p) ? p : [];
        } catch {
          return [];
        }
      };

      if (searchCorpoIdNum == null) {
        setRecords([]);
        return;
      }

      const isConnected = await getConnectionStatus();
      if (isConnected) {
        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) {
          throw new Error('Server URL not configured');
        }

        const data = await listAgendaMinutaByCorpo({
          corpo_id: String(searchCorpoIdNum),
          refreshAccessToken,
          logout,
        });
        const fullCache = await parseEvaluationsCacheArray();

        if (data.status && Array.isArray(data.data)) {
          const merged = mergeEvaluationsCacheAgendaMinutaForCorpo(fullCache, data.data, searchCorpoIdNum);
          await AsyncStorage.setItem('evaluations_cache', JSON.stringify(merged));
          const forList = filterAgendaFromEvaluationsCacheByCorpo(merged, searchCorpoIdNum);
          setRecords(forList as AgendaMinutaRecord[]);
        } else {
          const forList = filterAgendaFromEvaluationsCacheByCorpo(fullCache, searchCorpoIdNum);
          setRecords(forList as AgendaMinutaRecord[]);
        }
      } else {
        const fullCache = await parseEvaluationsCacheArray();
        const forList = filterAgendaFromEvaluationsCacheByCorpo(fullCache, searchCorpoIdNum);
        setRecords(forList as AgendaMinutaRecord[]);
      }
    } catch (err) {
      console.error('Error fetching agenda minuta:', err);
      setError('Error al cargar la agenda minuta');
      try {
        let currentMarcaCatch: any = null;
        try {
          const raw = await AsyncStorage.getItem('current_marca');
          if (raw) currentMarcaCatch = JSON.parse(raw);
        } catch {
          currentMarcaCatch = null;
        }
        const rnCatch =
          currentMarcaCatch?.roleDivision?.role?.nombre ??
          currentMarcaCatch?.role_division?.role?.nombre ??
          null;
        const isOperativoCatch = rnCatch === 'OPERATIVO';
        let corpoCatch: number | null = searchCorpoIdNum;
        if (corpoCatch == null) {
          if (isOperativoCatch && currentMarcaCatch) {
            const c = Number(currentMarcaCatch?.corpo?.id ?? currentMarcaCatch?.corpo_id);
            corpoCatch = Number.isFinite(c) && c > 0 ? c : null;
          } else {
            const c = Number(filterCorpoId);
            corpoCatch = Number.isFinite(c) && c > 0 ? c : null;
          }
        }

        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        let fullCache: any[] = [];
        if (cacheStr) {
          try {
            const p = JSON.parse(cacheStr);
            if (Array.isArray(p)) fullCache = p;
          } catch {
            /* ignore */
          }
        }
        const forList = filterAgendaFromEvaluationsCacheByCorpo(fullCache, corpoCatch);
        setRecords(forList as AgendaMinutaRecord[]);
      } catch {
        // ignore
      }
    } finally {
      setIsLoading(false);
    }
  }, [filterEmpresaId, filterClienteId, filterDivisionId, filterContratoId, filterCorpoId, refreshAccessToken, logout]);

  // Inicializar filtros desde current_marca al cargar
  useFocusEffect(
    useCallback(() => {
      (async () => {
        const current = await loadMarcaContext();
        const tree = await fetchMainStructure();
        const rn =
          current?.roleDivision?.role?.nombre ?? current?.role_division?.role?.nombre ?? null;
        if (current && rn !== 'OPERATIVO') {
          applyHierarchyFiltersFromMarca(current, tree);
        }
      })();
    }, [applyHierarchyFiltersFromMarca, fetchMainStructure])
  );

  // Recargar registros al definir/actualizar corpo (operativo usa current_marca.corpo)
  useEffect(() => {
    fetchRecords();
  }, [filterEmpresaId, filterClienteId, filterDivisionId, filterContratoId, filterCorpoId]);

  // Limpiar filtros dependientes cuando cambia un nivel superior
  useEffect(() => {
    if (!filterEmpresaId) {
      setFilterClienteId(null);
      setFilterDivisionId(null);
      setFilterContratoId(null);
      setFilterCorpoId(null);
      setFilterPuestoId(null);
    }
  }, [filterEmpresaId]);

  useEffect(() => {
    if (!filterClienteId) {
      setFilterDivisionId(null);
      setFilterContratoId(null);
      setFilterCorpoId(null);
      setFilterPuestoId(null);
    }
  }, [filterClienteId]);

  useEffect(() => {
    if (!filterDivisionId) {
      setFilterContratoId(null);
      setFilterCorpoId(null);
      setFilterPuestoId(null);
    }
  }, [filterDivisionId]);

  useEffect(() => {
    if (!filterContratoId) {
      setFilterCorpoId(null);
      setFilterPuestoId(null);
    }
  }, [filterContratoId]);

  useEffect(() => {
    if (!filterCorpoId) {
      setFilterPuestoId(null);
    }
  }, [filterCorpoId]);

  useFocusEffect(
    useCallback(() => {
      eventBus.on('connectionRestored', fetchRecords);
      return () => {
        eventBus.off('connectionRestored', fetchRecords);
      };
    }, [fetchRecords])
  );

  const buildRequestPayload = () => {
    if (!selectedClienteId || !selectedDivisionId || !selectedContratoId || !selectedSucursalId || !selectedPuestoId) {
      throw new Error('Debe completar la jerarquía hasta Puesto');
    }
    const numeroNum = parseInt(numero.trim(), 10);
    if (Number.isNaN(numeroNum) || numeroNum <= 0) throw new Error('El número debe ser válido');
    if (!titulo.trim()) throw new Error('El título es requerido');
    if (!autor.trim()) throw new Error('El autor es requerido');
    if (!firmaResponsable.trim()) throw new Error('La firma responsable es requerida');

    const sucursalNombre = selectedSucursalNode
      ? `${selectedSucursalNode.nro_sucursal ? `${selectedSucursalNode.nro_sucursal} - ` : ''}${selectedSucursalNode.nombre}`
      : null;
    const puestoNode = puestoNodes.find((p: any) => p.id === selectedPuestoId) ?? null;
    const puestoNombre = puestoNode
      ? `${puestoNode.codigo ? `${puestoNode.codigo} - ` : ''}${puestoNode.nombre}`
      : null;

    const acuerdosPayload: AcuerdosPayload = {
      items: acuerdos,
      meta: {
        empresa_id: selectedEmpresaId,
        cliente_id: selectedClienteId,
        division_id: selectedDivisionId,
        division_nombre: selectedDivisionNode?.nombre ?? null,
        contrato_id: selectedContratoId,
        contrato_nombre: selectedContratoNode?.nombre ?? null,
        sucursal_id: selectedSucursalId,
        sucursal_nombre: sucursalNombre,
        puesto_id: selectedPuestoId,
        puesto_nombre: puestoNombre,
      },
    };

    const temasArray = temasATratar.map((t) => t.tema.trim()).filter((t) => t.length > 0);

    return {
      empresa_id: selectedEmpresaId,
      cliente_id: selectedClienteId,
      division_id: selectedDivisionId,
      contrato_id: selectedContratoId,
      corpo_id: selectedSucursalId,
      puesto_id: selectedPuestoId,
      numero: numeroNum,
      titulo: titulo.trim(),
      fecha: formatDateISO(fecha),
      hora_inicio: formatTimeHHmm(horaInicio),
      hora_fin: formatTimeHHmm(horaFin),
      autor: autor.trim(),
      participantes: JSON.stringify(participantes),
      acuerdos: JSON.stringify(acuerdosPayload),
      temas_a_tratar: JSON.stringify(temasArray),
      observaciones: observaciones.trim() || ' ',
      firma_responsable: firmaResponsable,
      estado,
      cliente_nombre: selectedClienteNode?.nombre ?? null,
      corpo_nombre: sucursalNombre,
      puesto_nombre: puestoNombre,
    };
  };

  const submitCreateOrEdit = async () => {
    setIsSubmitting(true);
    setSubmitResponse(null);

    try {
      const payload = buildRequestPayload();
      const isConnected = await getConnectionStatus();

      if (editingRecord && hasAgendaMinutaServerId(editingRecord)) {
        if (isConnected) {
          const res = await updateAgendaMinuta({
            id: editingRecord.id,
            requestData: payload,
            refreshAccessToken,
            logout,
          });
          if (res.status) {
            const cacheStr = await AsyncStorage.getItem('evaluations_cache');
            const cache = cacheStr ? JSON.parse(cacheStr) : [];
            const editLocalKey = getNonEmptyLocalKey(editingRecord.id_local);
            const updatedCache = cache.map((it: any) => {
              const sameServerId =
                Number(it?.id) > 0 && Number(editingRecord.id) > 0 && Number(it.id) === Number(editingRecord.id);
              const sameLocalKey =
                editLocalKey != null && getNonEmptyLocalKey(it?.id_local) === editLocalKey;
              if (
                (sameServerId || sameLocalKey) &&
                (it.type === 'agenda_minuta' || it.type === 'physical_minute_agenda')
              ) {
                return {
                  ...it,
                  ...payload,
                  id: Number(editingRecord.id),
                  id_local: editLocalKey || '',
                  synced: true,
                  type: 'agenda_minuta',
                  isActive: true,
                };
              }
              return it;
            });
            await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
            Alert.alert('Éxito', res.message || 'Agenda minuta actualizada correctamente');
            setTimeout(() => {
              cancelCreateOrEdit();
              fetchRecords();
            }, 2000);
            return;
          }

          const msg = String(res.message || '');
          if (!msg.includes('503')) {
            Alert.alert('Error', res.message || 'No se pudo actualizar');
            setIsSubmitting(false);
            return;
          }
        }

        const queueKey = String(editingRecord.id_local || `srv-upd-${editingRecord.id}`);
        const actionsStr = await AsyncStorage.getItem('evaluations_actions');
        let actions: any[] = actionsStr ? JSON.parse(actionsStr) : [];
        if (!Array.isArray(actions)) actions = [];
        actions = actions.filter(
          (a: any) =>
            !(
              isAgendaEvalAction(a) &&
              a.action === 'update' &&
              String(a.id) === String(queueKey)
            )
        );
        actions.push({
          id: queueKey,
          action: 'update',
          type: 'agenda_minuta',
          payload,
          synced: false,
          remote_id: editingRecord.id,
        });
        await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        const cache = cacheStr ? JSON.parse(cacheStr) : [];
        const editLocalKey = getNonEmptyLocalKey(editingRecord.id_local);
        const updatedCache = cache.map((it: any) => {
          const sameServerId =
            Number(it?.id) > 0 && Number(editingRecord.id) > 0 && Number(it.id) === Number(editingRecord.id);
          const sameQueueKey = getNonEmptyLocalKey(it?.id_local) === getNonEmptyLocalKey(queueKey);
          const sameEditLocalKey =
            editLocalKey != null && getNonEmptyLocalKey(it?.id_local) === editLocalKey;
          if (
            (sameServerId || sameQueueKey || sameEditLocalKey) &&
            (it.type === 'agenda_minuta' || it.type === 'physical_minute_agenda')
          ) {
            return {
              ...it,
              ...payload,
              id_local: queueKey,
              synced: false,
              type: 'agenda_minuta',
            };
          }
          return it;
        });
        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
        Alert.alert('Éxito', 'Actualizado offline. Se sincronizará cuando haya conexión.');
        setTimeout(() => {
          cancelCreateOrEdit();
          fetchRecords();
        }, 2000);
        return;
      }

      if (editingRecord && !hasAgendaMinutaServerId(editingRecord)) {
        if (isConnected) {
          const res = await createAgendaMinuta({ requestData: payload, refreshAccessToken, logout });
          if (res.status) {
            const cacheStrDraft = await AsyncStorage.getItem('evaluations_cache');
            const cacheDraft = cacheStrDraft ? JSON.parse(cacheStrDraft) : [];
            const createdId = Number(res?.data?.id);
            const updatedCacheDraft = cacheDraft.map((it: any) => {
              if (
                String(it.id_local) === String(editingRecord.id_local) &&
                (it.type === 'agenda_minuta' || it.type === 'physical_minute_agenda')
              ) {
                return {
                  ...it,
                  ...payload,
                  id: Number.isFinite(createdId) && createdId > 0 ? createdId : it.id,
                  synced: true,
                  type: 'agenda_minuta',
                  isActive: true,
                };
              }
              return it;
            });
            await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCacheDraft));
            Alert.alert('Éxito', res.message || 'Agenda minuta guardada correctamente');
            setTimeout(() => {
              cancelCreateOrEdit();
              fetchRecords();
            }, 2000);
          } else {
            Alert.alert('Error', res.message || 'No se pudo guardar');
          }
          return;
        }

        const draftLocalId = editingRecord.id_local;
        if (!draftLocalId) {
          Alert.alert('Error', 'Registro local sin id_local');
          return;
        }
        await mergeOrPushAgendaMinutaCreateEvaluationsActions(draftLocalId, payload);

        const cacheStrDraft = await AsyncStorage.getItem('evaluations_cache');
        const cacheDraft = cacheStrDraft ? JSON.parse(cacheStrDraft) : [];
        const updatedCacheDraft = cacheDraft.map((it: any) => {
          if (it.id_local === draftLocalId && (it.type === 'agenda_minuta' || it.type === 'physical_minute_agenda')) {
            return {
              ...it,
              ...payload,
              id_local: draftLocalId,
              synced: false,
              type: 'agenda_minuta',
            };
          }
          return it;
        });
        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCacheDraft));
        Alert.alert('Éxito', 'Agenda minuta actualizada localmente. Se sincronizará cuando haya conexión.');
        setTimeout(() => {
          cancelCreateOrEdit();
          fetchRecords();
        }, 2000);
        return;
      }

      // create
      if (isConnected) {
        const res = await createAgendaMinuta({ requestData: payload, refreshAccessToken, logout });
        if (res.status) {
          const cacheStrOnline = await AsyncStorage.getItem('evaluations_cache');
          const cacheOnline = cacheStrOnline ? JSON.parse(cacheStrOnline) : [];
          const horaAccionOnline = await getHoraAccion();
          const createdId = Number(res?.data?.id);
          const newCacheRecordOnline: AgendaMinutaRecord = {
            id: Number.isFinite(createdId) && createdId > 0 ? createdId : '',
            id_local: '',
            cliente_id: payload.cliente_id,
            corpo_id: payload.corpo_id,
            puesto_id: payload.puesto_id,
            numero: payload.numero,
            titulo: payload.titulo,
            fecha: payload.fecha,
            hora_inicio: payload.hora_inicio,
            hora_fin: payload.hora_fin,
            autor: payload.autor,
            participantes: payload.participantes,
            acuerdos: payload.acuerdos,
            temas_a_tratar: payload.temas_a_tratar,
            observaciones: payload.observaciones,
            firma_responsable: payload.firma_responsable,
            created_at: new Date(horaAccionOnline).toISOString(),
            synced: true,
            cliente_nombre: payload.cliente_nombre ?? null,
            corpo_nombre: payload.corpo_nombre ?? null,
            puesto_nombre: payload.puesto_nombre ?? null,
          };
          cacheOnline.push({ ...newCacheRecordOnline, type: 'agenda_minuta', isActive: true });
          await AsyncStorage.setItem('evaluations_cache', JSON.stringify(cacheOnline));
          Alert.alert('Éxito', res.message || 'Agenda minuta guardada correctamente');
          setTimeout(() => {
            cancelCreateOrEdit();
            fetchRecords();
          }, 2000);
        } else {
          Alert.alert('Error', res.message || 'No se pudo guardar');
        }
        return;
      }

      const localId = generateRandomId();
      await mergeOrPushAgendaMinutaCreateEvaluationsActions(localId, payload);

      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
      const cache = cacheStr ? JSON.parse(cacheStr) : [];

      const horaAccion = await getHoraAccion();
      if (!horaAccion) {
        Alert.alert('Error', 'No se pudo obtener la hora de acción');
        return;
      }

      const newCacheRecord: AgendaMinutaRecord = {
        id: '',
        id_local: localId,
        cliente_id: payload.cliente_id,
        corpo_id: payload.corpo_id,
        puesto_id: payload.puesto_id,
        numero: payload.numero,
        titulo: payload.titulo,
        fecha: payload.fecha,
        hora_inicio: payload.hora_inicio,
        hora_fin: payload.hora_fin,
        autor: payload.autor,
        participantes: payload.participantes,
        acuerdos: payload.acuerdos,
        temas_a_tratar: payload.temas_a_tratar,
        observaciones: payload.observaciones,
        firma_responsable: payload.firma_responsable,
        created_at: new Date(horaAccion).toISOString(),
        synced: false,
        cliente_nombre: payload.cliente_nombre ?? null,
        corpo_nombre: payload.corpo_nombre ?? null,
        puesto_nombre: payload.puesto_nombre ?? null,
      };
      cache.push({ ...newCacheRecord, type: 'agenda_minuta', isActive: true });
      await AsyncStorage.setItem('evaluations_cache', JSON.stringify(cache));
      Alert.alert('Éxito', 'Agenda minuta registrada localmente. Se sincronizará cuando haya conexión.');
      setTimeout(() => {
        cancelCreateOrEdit();
        fetchRecords();
      }, 2000);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo guardar');
    } finally {
      setIsSubmitting(false);
    }
  };

  const saveHandler = () => {
    if (isSubmitting) return;
    const title = editingRecord ? 'Confirmar actualización' : 'Confirmar creación';
    const message = editingRecord
      ? '¿Deseas actualizar esta agenda minuta?'
      : '¿Deseas crear esta agenda minuta?';
    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Aceptar', onPress: submitCreateOrEdit },
    ]);
  };

  const deleteHandler = async (r: AgendaMinutaRecord) => {
    Alert.alert('Confirmar', '¿Eliminar agenda minuta?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            const itemId = String(r.id || r.id_local || '');
            setDeletingRecordId(itemId);
            const isConnected = await getConnectionStatus();
            if (isConnected && hasAgendaMinutaServerId(r)) {
              const res = await deleteAgendaMinuta({ id: r.id, refreshAccessToken, logout });
              if (res.status) {
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                let actions: any[] = actionsStr ? JSON.parse(actionsStr) : [];
                if (!Array.isArray(actions)) actions = [];
                const rid = String(r.id);
                const rowLocalKey = getNonEmptyLocalKey(r.id_local);
                actions = actions.filter(
                  (a: any) =>
                    !(
                      isAgendaEvalAction(a) &&
                      (
                        String(a.id) === rid ||
                        String(a.remote_id) === rid ||
                        (rowLocalKey != null && getNonEmptyLocalKey(a.id_local) === rowLocalKey)
                      )
                    )
                );
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                const cache = cacheStr ? JSON.parse(cacheStr) : [];
                const rowLocalKeyForCache = getNonEmptyLocalKey(r.id_local);
                const updatedCache = cache.filter(
                  (it: any) =>
                    !(
                      (it.type === 'agenda_minuta' || it.type === 'physical_minute_agenda') &&
                      (
                        String(it.id) === rid ||
                        (rowLocalKeyForCache != null && getNonEmptyLocalKey(it.id_local) === rowLocalKeyForCache)
                      )
                    )
                );
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                Alert.alert('Éxito', 'Eliminado');
                fetchRecords();
                return;
              }
            }

            const actionsStr = await AsyncStorage.getItem('evaluations_actions');
            let actions: any[] = actionsStr ? JSON.parse(actionsStr) : [];
            if (!Array.isArray(actions)) actions = [];

            if (!hasAgendaMinutaServerId(r) && r.id_local) {
              actions = actions.filter(
                (a: any) =>
                  !(
                    isAgendaEvalAction(a) &&
                    (a.action === 'create' || a.action === 'update') &&
                    (String(a.id) === String(r.id_local) || String(a.id_local) === String(r.id_local))
                  )
              );
            } else if (hasAgendaMinutaServerId(r)) {
              const rid = String(r.id);
              actions = actions.filter(
                (a: any) =>
                  !(
                    isAgendaEvalAction(a) &&
                    a.action === 'update' &&
                    (String(a.id) === rid || String(a.remote_id) === rid || Number(a.remote_id) === Number(r.id))
                  )
              );
              actions = actions.filter(
                (a: any) =>
                  !(isAgendaEvalAction(a) && a.action === 'delete' && (String(a.id) === rid || String(a.remote_id) === rid))
              );
              actions.push({
                id: rid,
                action: 'delete',
                type: 'agenda_minuta',
                payload: { id: r.id },
                remote_id: r.id,
                synced: false,
              });
            }

            await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

            const cacheStr = await AsyncStorage.getItem('evaluations_cache');
            const cache = cacheStr ? JSON.parse(cacheStr) : [];
            const rowLocalKey = getNonEmptyLocalKey(r.id_local);
            const updatedCache = cache.filter(
              (it: any) =>
                !(
                  (it.type === 'agenda_minuta' || it.type === 'physical_minute_agenda') &&
                  (
                    (rowLocalKey != null && getNonEmptyLocalKey(it.id_local) === rowLocalKey) ||
                    (Number(it.id) > 0 && Number(r.id) > 0 && Number(it.id) === Number(r.id))
                  )
                )
            );
            await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
            Alert.alert('Modo Offline', 'Eliminado offline. Se sincronizará cuando haya conexión.');
            fetchRecords();
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'No se pudo eliminar');
          } finally {
            const itemId = String(r.id || r.id_local || '');
            setDeletingRecordId((prev) => (prev === itemId ? null : prev));
          }
        },
      },
    ]);
  };

  const renderList = () => {
    const recordsToShow = (records || []).filter((r: any) => {
      if (hasValidVisualPuestoSelected && Number(r?.puesto_id) !== Number(filterPuestoId)) return false;
      const ymd = normalizeDateYmd(r?.fecha);
      if (filterFecha.trim()) {
        const wantDate = normalizeDateYmd(filterFecha.trim());
        if (!wantDate || ymd !== wantDate) return false;
      }
      const hi = normalizeTimeToHHmm(r?.hora_inicio);
      if (filterHoraInicio.trim()) {
        const wantHi = normalizeTimeToHHmm(filterHoraInicio.trim());
        if (!wantHi || hi !== wantHi) return false;
      }
      const hf = normalizeTimeToHHmm(r?.hora_fin);
      if (filterHoraFin.trim()) {
        const wantHf = normalizeTimeToHHmm(filterHoraFin.trim());
        if (!wantHf || hf !== wantHf) return false;
      }
      return true;
    });

    if (isLoading) {
      return (
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Cargando agendas...</ThemedText>
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

    if (recordsToShow.length === 0) {
      return (
        <ThemedView style={styles.emptyContainer}>
          <ThemedText style={styles.emptyText}>No hay agendas minuta.</ThemedText>
        </ThemedView>
      );
    }

    return (
      <ThemedView style={styles.listContainer}>
        {recordsToShow.map((r) => {
          const itemKey = String(r.id || r.id_local || '');
          const participantesArr = safeJsonParse<any[]>(r.participantes, []);
          const { items: acuerdosArr, meta: acuerdosMeta } = parseAcuerdosPayload(r.acuerdos);
          const temasArr = safeJsonParse<string[]>((r as any).temas_a_tratar, []);
          const fechaTxt = formatDateDMY(r.fecha, '—');
          const isParticipantesOpen = !!expandedParticipantesById[itemKey];
          const isAcuerdosOpen = !!expandedAcuerdosById[itemKey];
          const isTemasOpen = !!expandedTemasById[itemKey];
          const isFirmaOpen = !!expandedFirmaById[itemKey];

          return (
            <ThemedView key={itemKey} style={styles.listItem}>
              <ThemedView style={styles.listItemHeader}>
                <ThemedView style={styles.listItemContent}>
                  <ThemedText style={styles.listItemTitle}>{r.titulo || 'Agenda minuta'}</ThemedText>
                  <ThemedText style={styles.listItemSubtitle}># {r.numero}</ThemedText>
                  {!!acuerdosMeta?.division_nombre && <ThemedText style={styles.listItemSubtitle}>División: {acuerdosMeta.division_nombre}</ThemedText>}
                  {!!acuerdosMeta?.contrato_nombre && <ThemedText style={styles.listItemSubtitle}>Contrato: {acuerdosMeta.contrato_nombre}</ThemedText>}
                  <ThemedText style={styles.listItemSubtitle}>Sucursal: {r.corpo_nombre || acuerdosMeta?.sucursal_nombre || String(r.corpo_id)}</ThemedText>
                  <ThemedText style={styles.listItemSubtitle}>Puesto: {r.puesto_nombre || acuerdosMeta?.puesto_nombre || String(r.puesto_id)}</ThemedText>
                  <ThemedText style={styles.listItemSubtitle}>Fecha: {fechaTxt}</ThemedText>
                  <ThemedText style={styles.listItemSubtitle}>Estado: {r.estado ? 'Completado' : 'Pendiente'}</ThemedText>
                  <ThemedText style={styles.listItemSubtitle}>
                    Hora: {typeof r.hora_inicio === 'string' && /^\d{1,2}:\d{2}$/.test(r.hora_inicio) ? r.hora_inicio : (r.hora_inicio ? formatTimeHHmm(r.hora_inicio instanceof Date ? r.hora_inicio : new Date(String(r.hora_inicio))) : '—')}
                    {' – '}
                    {typeof r.hora_fin === 'string' && /^\d{1,2}:\d{2}$/.test(r.hora_fin) ? r.hora_fin : (r.hora_fin ? formatTimeHHmm(r.hora_fin instanceof Date ? r.hora_fin : new Date(String(r.hora_fin))) : '—')}
                  </ThemedText>
                </ThemedView>
              </ThemedView>

              <ThemedView style={styles.listItemDetails}>
                <TouchableOpacity
                  style={styles.collapseButton}
                  onPress={() => setExpandedParticipantesById((prev) => ({ ...prev, [itemKey]: !prev[itemKey] }))}
                  activeOpacity={0.8}
                >
                  <ThemedText style={styles.collapseButtonText}>Participantes ({participantesArr.length})</ThemedText>
                  <Ionicons name={isParticipantesOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#007AFF" />
                </TouchableOpacity>
                {isParticipantesOpen && (
                  <ThemedView style={styles.collapsableContent}>
                    {participantesArr.length === 0 ? (
                      <ThemedText style={styles.detailLine}>—</ThemedText>
                    ) : (
                      participantesArr.map((p: any, idx: number) => {
                        const sigUri = formatSignatureForDisplay(p?.firma || null);
                        const puestoTxt = String(p?.puesto || p?.cedula || '').trim() || '—';
                        return (
                          <ThemedView key={String(p?.id_local || idx)} style={styles.personDetailCard}>
                            <ThemedText style={styles.personDetailTitle}>{String(p?.nombre || '').trim() || '—'}</ThemedText>
                            <ThemedText style={styles.detailLine}>Puesto: {puestoTxt}</ThemedText>
                            {sigUri ? (
                              <Image source={{ uri: sigUri }} style={styles.signaturePreview} resizeMode="contain" />
                            ) : (
                              <ThemedText style={styles.detailLine}>Firma: No</ThemedText>
                            )}
                          </ThemedView>
                        );
                      })
                    )}
                  </ThemedView>
                )}

                <TouchableOpacity
                  style={styles.collapseButton}
                  onPress={() => setExpandedAcuerdosById((prev) => ({ ...prev, [itemKey]: !prev[itemKey] }))}
                  activeOpacity={0.8}
                >
                  <ThemedText style={styles.collapseButtonText}>Acuerdos ({acuerdosArr.length})</ThemedText>
                  <Ionicons name={isAcuerdosOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#007AFF" />
                </TouchableOpacity>
                {isAcuerdosOpen && (
                  <ThemedView style={styles.collapsableContent}>
                    {acuerdosArr.length === 0 ? (
                      <ThemedText style={styles.detailLine}>—</ThemedText>
                    ) : (
                      acuerdosArr.map((a: any, idx: number) => (
                        <ThemedView key={String(a?.id_local || idx)} style={styles.changeDescriptionContainer}>
                          <ThemedText style={styles.detailLine}>- {String(a?.texto || '').trim() || '—'}</ThemedText>
                          <ThemedText style={styles.detailLine}>Responsable: {String(a?.responsable || '').trim() || '—'}</ThemedText>
                          <ThemedText style={styles.detailLine}>Fecha límite: {String(a?.fecha_limite || '').trim() || '—'}</ThemedText>
                        </ThemedView>
                      ))
                    )}
                  </ThemedView>
                )}

                <TouchableOpacity
                  style={styles.collapseButton}
                  onPress={() => setExpandedTemasById((prev) => ({ ...prev, [itemKey]: !prev[itemKey] }))}
                  activeOpacity={0.8}
                >
                  <ThemedText style={styles.collapseButtonText}>Temas a tratar ({temasArr.length})</ThemedText>
                  <Ionicons name={isTemasOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#007AFF" />
                </TouchableOpacity>
                {isTemasOpen && (
                  <ThemedView style={styles.collapsableContent}>
                    {temasArr.length === 0 ? (
                      <ThemedText style={styles.detailLine}>—</ThemedText>
                    ) : (
                      temasArr.map((tema: string, idx: number) => (
                        <ThemedText key={idx} style={styles.detailLine}>
                          - {String(tema || '').trim() || '—'}
                        </ThemedText>
                      ))
                    )}
                  </ThemedView>
                )}

                <TouchableOpacity
                  style={styles.collapseButton}
                  onPress={() => setExpandedFirmaById((prev) => ({ ...prev, [itemKey]: !prev[itemKey] }))}
                  activeOpacity={0.8}
                >
                  <ThemedText style={styles.collapseButtonText}>Firma responsable</ThemedText>
                  <Ionicons name={isFirmaOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#007AFF" />
                </TouchableOpacity>
                {isFirmaOpen && (
                  <ThemedView style={styles.collapsableContent}>
                    {!r.firma_responsable ? (
                      <ThemedText style={styles.detailLine}>—</ThemedText>
                    ) : (() => {
                      const info = decodeFirmaHash(r.firma_responsable);
                      if (!info) return <ThemedText style={styles.detailLine}>QR sin información decodificable.</ThemedText>;
                      return (
                        <>
                          <ThemedText style={styles.detailLine}>Sesión: {info.sessionId}</ThemedText>
                          <ThemedText style={styles.detailLine}>Empleado: {info.empleadoId}</ThemedText>
                          <ThemedText style={styles.detailLine}>
                            Lat/Lng: {info.latitud}, {info.longitud}
                          </ThemedText>
                          <ThemedText style={styles.detailLine}>Hora: { convertDateTimestampToLocalString(new Date(Number(info.timestamp)).toISOString())}</ThemedText>
                        </>
                      );
                    })()}
                  </ThemedView>
                )}

                <ThemedView style={styles.actionButtons}>
                  <TouchableOpacity style={[styles.listItemButton, styles.editButton]} onPress={() => startEditing(r)} activeOpacity={0.85}>
                    <Ionicons name="pencil" size={18} color="#FFFFFF" />
                    <ThemedText style={styles.buttonText}>Editar</ThemedText>
                  </TouchableOpacity>
                  {!(r.id_local || r.id === 0 || typeof r.id === 'string') && (
                    <TouchableOpacity
                      style={[styles.listItemButton, styles.changesButton]}
                      onPress={() => {
                        setCambiosTitle(`Cambios - Agenda #${r.id}`);
                        fetchCambios('c_agenda_minuta', Number(r.id));
                      }}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="list-outline" size={18} color="#FFFFFF" />
                      <ThemedText style={styles.buttonText}>Cambios</ThemedText>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.listItemButton, styles.deleteButton, deletingRecordId === itemKey && styles.disabledButton]}
                    onPress={() => deleteHandler(r)}
                    activeOpacity={0.85}
                    disabled={deletingRecordId === itemKey}
                  >
                    {deletingRecordId === itemKey ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="trash" size={18} color="#FFFFFF" />
                        <ThemedText style={styles.buttonText}>Eliminar</ThemedText>
                      </>
                    )}
                  </TouchableOpacity>
                </ThemedView>
              </ThemedView>
            </ThemedView>
          );
        })}
      </ThemedView>
    );
  };

  const renderForm = () => {
    return (
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <ThemedView style={styles.content}>
          <ThemedView style={styles.formCard}>
            <ThemedText style={styles.formTitle}>{editingRecord ? 'Editar agenda' : 'Nueva agenda'}</ThemedText>

            {!!isStructureLoading && (
              <ThemedView style={styles.inlineLoading}>
                <ActivityIndicator size="small" color="#007AFF" />
                <ThemedText style={styles.inlineLoadingText}>Cargando estructura...</ThemedText>
              </ThemedView>
            )}

            <ThemedText style={styles.formSectionTitle}>Jerarquía</ThemedText>

            {roleName == null ? (
              <ThemedText style={[styles.label, { opacity: 0.7 }]}>Cargando contexto de marca...</ThemedText>
            ) : roleName === 'OPERATIVO' ? (
              <ThemedText style={[styles.label, { opacity: 0.75, marginBottom: 8 }]}>
                La ubicación (empresa, cliente, división, contrato, sucursal y puesto) se define desde tu marca actual.
              </ThemedText>
            ) : (
              <>
                <ThemedText style={styles.label}>Empresa</ThemedText>
                <View style={styles.pickerWrapper}>
                  <Picker selectedValue={selectedEmpresaId ?? 0} onValueChange={(v) => setSelectedEmpresaId(Number(v) || null)} style={styles.picker}>
                    <Picker.Item label="Seleccione empresa" value={0} color="#000000" />
                    {empresaOptions.map((o) => (
                      <Picker.Item key={o.id} label={o.label} value={o.id} color="#000000" />
                    ))}
                  </Picker>
                </View>

                <ThemedText style={styles.label}>Cliente</ThemedText>
                <View style={styles.pickerWrapper}>
                  <Picker
                    selectedValue={selectedClienteId ?? 0}
                    enabled={selectedEmpresaId !== null && clienteOptions.length > 0}
                    onValueChange={(v) => setSelectedClienteId(Number(v) || null)}
                    style={styles.picker}
                  >
                    <Picker.Item label={selectedEmpresaId === null ? 'Seleccione empresa primero' : 'Seleccione cliente'} value={0} color="#000000" />
                    {clienteOptions.map((o) => (
                      <Picker.Item key={o.id} label={o.label} value={o.id} color="#000000" />
                    ))}
                  </Picker>
                </View>

                <ThemedText style={styles.label}>División</ThemedText>
                <View style={styles.pickerWrapper}>
                  <Picker
                    selectedValue={selectedDivisionId ?? 0}
                    enabled={selectedClienteId !== null && divisionOptions.length > 0}
                    onValueChange={(v) => setSelectedDivisionId(Number(v) || null)}
                    style={styles.picker}
                  >
                    <Picker.Item label={selectedClienteId === null ? 'Seleccione cliente primero' : 'Seleccione división'} value={0} color="#000000" />
                    {divisionOptions.map((o) => (
                      <Picker.Item key={o.id} label={o.label} value={o.id} color="#000000" />
                    ))}
                  </Picker>
                </View>

                <ThemedText style={styles.label}>Contrato</ThemedText>
                <View style={styles.pickerWrapper}>
                  <Picker
                    selectedValue={selectedContratoId ?? 0}
                    enabled={selectedDivisionId !== null && contratoOptions.length > 0}
                    onValueChange={(v) => setSelectedContratoId(Number(v) || null)}
                    style={styles.picker}
                  >
                    <Picker.Item label={selectedDivisionId === null ? 'Seleccione división primero' : 'Seleccione contrato'} value={0} color="#000000" />
                    {contratoOptions.map((o) => (
                      <Picker.Item key={o.id} label={o.label} value={o.id} color="#000000" />
                    ))}
                  </Picker>
                </View>

                <ThemedText style={styles.label}>Sucursal</ThemedText>
                <View style={styles.pickerWrapper}>
                  <Picker
                    selectedValue={selectedSucursalId ?? 0}
                    enabled={selectedContratoId !== null && sucursalOptions.length > 0}
                    onValueChange={(v) => setSelectedSucursalId(Number(v) || null)}
                    style={styles.picker}
                  >
                    <Picker.Item label={selectedContratoId === null ? 'Seleccione contrato primero' : 'Seleccione sucursal'} value={0} color="#000000" />
                    {sucursalOptions.map((o) => (
                      <Picker.Item key={o.id} label={o.label} value={o.id} color="#000000" />
                    ))}
                  </Picker>
                </View>

                <ThemedText style={styles.label}>Puesto</ThemedText>
                <View style={styles.pickerWrapper}>
                  <Picker
                    selectedValue={selectedPuestoId ?? 0}
                    enabled={selectedSucursalId !== null && puestoOptions.length > 0}
                    onValueChange={(v) => setSelectedPuestoId(Number(v) || null)}
                    style={styles.picker}
                  >
                    <Picker.Item label={selectedSucursalId === null ? 'Seleccione sucursal primero' : 'Seleccione puesto'} value={0} color="#000000" />
                    {puestoOptions.map((o) => (
                      <Picker.Item key={o.id} label={o.label} value={o.id} color="#000000" />
                    ))}
                  </Picker>
                </View>
              </>
            )}

            <ThemedText style={styles.formSectionTitle}>Datos</ThemedText>

            <ThemedText style={styles.label}>Número</ThemedText>
            <TextInput style={styles.input} value={numero} onChangeText={setNumero} keyboardType="number-pad" placeholder="Ej: 1" />

            <ThemedText style={styles.label}>Título</ThemedText>
            <TextInput style={styles.input} value={titulo} onChangeText={setTitulo} placeholder="Título" />

            <ThemedText style={styles.label}>Fecha</ThemedText>
            <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)} activeOpacity={0.85}>
              <ThemedText style={styles.dateButtonText}>{convertDateTimestampToLocalString(fecha.toISOString(), false)}</ThemedText>
              <Ionicons name="calendar" size={18} color="#007AFF" />
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={fecha}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_, d) => {
                  if (Platform.OS === 'android') setShowDatePicker(false);
                  if (d) setFecha(d);
                }}
              />
            )}

            <ThemedText style={styles.label}>Hora inicio</ThemedText>
            <TouchableOpacity style={styles.dateButton} onPress={() => setShowTimePickerInicio(true)} activeOpacity={0.85}>
              <ThemedText style={styles.dateButtonText}>{formatTimeHHmm(horaInicio)}</ThemedText>
              <Ionicons name="time" size={18} color="#007AFF" />
            </TouchableOpacity>
            {showTimePickerInicio && (
              <DateTimePicker
                value={horaInicio}
                mode="time"
                is24Hour
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_, d) => {
                  if (Platform.OS === 'android') setShowTimePickerInicio(false);
                  if (d) setHoraInicio(d);
                }}
              />
            )}

            <ThemedText style={styles.label}>Hora fin</ThemedText>
            <TouchableOpacity style={styles.dateButton} onPress={() => setShowTimePickerFin(true)} activeOpacity={0.85}>
              <ThemedText style={styles.dateButtonText}>{formatTimeHHmm(horaFin)}</ThemedText>
              <Ionicons name="time" size={18} color="#007AFF" />
            </TouchableOpacity>
            {showTimePickerFin && (
              <DateTimePicker
                value={horaFin}
                mode="time"
                is24Hour
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_, d) => {
                  if (Platform.OS === 'android') setShowTimePickerFin(false);
                  if (d) setHoraFin(d);
                }}
              />
            )}

            <ThemedText style={styles.label}>Autor</ThemedText>
            <TextInput style={styles.input} value={autor} onChangeText={setAutor} placeholder="Autor" />

            <ThemedText style={styles.label}>Estado</ThemedText>
            <TouchableOpacity
              style={styles.checkboxRow}
              activeOpacity={0.8}
              onPress={() => setEstado((prev) => !prev)}
            >
              <Ionicons
                name={estado ? 'checkbox' : 'square-outline'}
                size={20}
                color={estado ? '#007AFF' : '#8E8E93'}
              />
              <ThemedText style={styles.checkboxLabel}>Completado</ThemedText>
            </TouchableOpacity>

            <ThemedText style={styles.label}>Observaciones</ThemedText>
            <TextInput style={[styles.input, styles.textArea]} value={observaciones} onChangeText={setObservaciones} placeholder="Observaciones" multiline />

          <ThemedText style={styles.formSectionTitle}>Participantes</ThemedText>
          <ThemedText style={styles.label}>Buscar participante por código</ThemedText>
          <ThemedView style={styles.codeRow}>
            <TextInput
              style={styles.codeInput}
              value={codigoParticipante}
              onChangeText={setCodigoParticipante}
              placeholder="Código del empleado"
              placeholderTextColor="#999"
            />
            <TouchableOpacity style={styles.codeActionButton} onPress={handleSearchParticipanteByCode} activeOpacity={0.85}>
              <ThemedText style={styles.codeActionButtonText}>Buscar</ThemedText>
            </TouchableOpacity>
          </ThemedView>
            {participantes.length === 0 ? <ThemedText style={styles.emptyTextSmall}>—</ThemedText> : null}
            {participantes.map((p, idx) => {
              const sigUri = formatSignatureForDisplay(p.firma);
              const displayName = p.nombre.trim() || `Participante ${idx + 1}`;
              return (
                <ThemedView key={p.id_local} style={styles.expandItem}>
                  <ThemedView style={styles.expandHeader}>
                    <ThemedView style={styles.expandHeaderContent}>
                      <ThemedText style={styles.expandHeaderText}>{displayName}</ThemedText>
                      {!!p.puesto && <ThemedText style={styles.expandHeaderSubText}>Puesto: {p.puesto}</ThemedText>}
                    </ThemedView>
                    <ThemedView style={styles.expandHeaderActions}>
                      <TouchableOpacity onPress={() => removeParticipante(p.id_local)} style={styles.removeExpandButton} activeOpacity={0.85}>
                        <Ionicons name="trash" size={20} color="#FF3B30" />
                      </TouchableOpacity>
                    </ThemedView>
                  </ThemedView>

                  <ThemedView style={styles.expandContent}>
                    <ThemedText style={styles.label}>Nombre</ThemedText>
                    <TextInput style={styles.input} value={p.nombre} onChangeText={(t) => updateParticipante(p.id_local, { nombre: t })} placeholder="Nombre" />

                    <ThemedText style={styles.label}>Puesto</ThemedText>
                    <TextInput style={styles.input} value={p.puesto} onChangeText={(t) => updateParticipante(p.id_local, { puesto: t })} placeholder="Puesto" />

                    <ThemedText style={styles.formSectionTitle}>Firma</ThemedText>
                    <TouchableOpacity style={styles.signatureButton} onPress={() => openParticipanteSignature(p.id_local)} activeOpacity={0.85}>
                      <Ionicons name="create-outline" size={18} color="#007AFF" />
                      <ThemedText style={styles.signatureButtonText}>{p.firma ? 'Editar firma' : 'Agregar firma'}</ThemedText>
                    </TouchableOpacity>
                    {sigUri ? <Image source={{ uri: sigUri }} style={styles.signaturePreview} resizeMode="contain" /> : null}
                  </ThemedView>
                </ThemedView>
              );
            })}
            <TouchableOpacity style={styles.addButton} onPress={addParticipante} activeOpacity={0.85}>
              <Ionicons name="add-circle" size={20} color="#4CAF50" />
              <ThemedText style={styles.addButtonText}>Agregar participante</ThemedText>
            </TouchableOpacity>

            <ThemedText style={styles.formSectionTitle}>Acuerdos</ThemedText>
            {acuerdos.length === 0 ? <ThemedText style={styles.emptyTextSmall}>—</ThemedText> : null}
            {acuerdos.map((a, idx) => {
              const title = `Acuerdo ${idx + 1}`;
              return (
                <ThemedView key={a.id_local} style={styles.expandItem}>
                  <ThemedView style={styles.expandHeader}>
                    <ThemedView style={styles.expandHeaderContent}>
                      <ThemedText style={styles.expandHeaderText}>{title}</ThemedText>
                    </ThemedView>
                    <ThemedView style={styles.expandHeaderActions}>
                      <TouchableOpacity onPress={() => removeAcuerdo(a.id_local)} style={styles.removeExpandButton} activeOpacity={0.85}>
                        <Ionicons name="trash" size={20} color="#FF3B30" />
                      </TouchableOpacity>
                    </ThemedView>
                  </ThemedView>
                  <ThemedView style={styles.expandContent}>
                    <ThemedText style={styles.label}>Detalle</ThemedText>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      value={a.texto}
                      onChangeText={(t) => updateAcuerdo(a.id_local, { texto: t })}
                      placeholder="Escriba el acuerdo"
                      multiline
                    />
                    <ThemedText style={styles.label}>Responsable</ThemedText>
                    <TextInput
                      style={styles.input}
                      value={a.responsable}
                      onChangeText={(t) => updateAcuerdo(a.id_local, { responsable: t })}
                      placeholder="Responsable"
                    />
                    <ThemedText style={styles.label}>Fecha límite</ThemedText>
                    <TouchableOpacity
                      style={styles.dateButton}
                      onPress={() => setShowAcuerdoDatePickerForId(a.id_local)}
                      activeOpacity={0.85}
                    >
                      <ThemedText style={styles.dateButtonText}>{a.fecha_limite || 'Seleccione fecha'}</ThemedText>
                      <Ionicons name="calendar" size={18} color="#007AFF" />
                    </TouchableOpacity>
                    {showAcuerdoDatePickerForId === a.id_local && (
                      <DateTimePicker
                        value={a.fecha_limite ? new Date(`${a.fecha_limite}T00:00:00`) : new Date()}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(_, d) => {
                          if (Platform.OS === 'android') setShowAcuerdoDatePickerForId(null);
                          if (d) updateAcuerdo(a.id_local, { fecha_limite: formatDateISO(d) });
                        }}
                      />
                    )}
                  </ThemedView>
                </ThemedView>
              );
            })}
            <TouchableOpacity style={styles.addButton} onPress={addAcuerdo} activeOpacity={0.85}>
              <Ionicons name="add-circle" size={20} color="#4CAF50" />
              <ThemedText style={styles.addButtonText}>Agregar acuerdo</ThemedText>
            </TouchableOpacity>

            <ThemedText style={styles.formSectionTitle}>Temas a tratar</ThemedText>
            {temasATratar.length === 0 ? <ThemedText style={styles.emptyTextSmall}>—</ThemedText> : null}
            {temasATratar.map((t, idx) => {
              const title = `Tema ${idx + 1}`;
              return (
                <ThemedView key={t.id_local} style={styles.expandItem}>
                  <ThemedView style={styles.expandHeader}>
                    <ThemedView style={styles.expandHeaderContent}>
                      <ThemedText style={styles.expandHeaderText}>{title}</ThemedText>
                    </ThemedView>
                    <ThemedView style={styles.expandHeaderActions}>
                      <TouchableOpacity onPress={() => removeTema(t.id_local)} style={styles.removeExpandButton} activeOpacity={0.85}>
                        <Ionicons name="trash" size={20} color="#FF3B30" />
                      </TouchableOpacity>
                    </ThemedView>
                  </ThemedView>
                  <ThemedView style={styles.expandContent}>
                    <ThemedText style={styles.label}>Tema</ThemedText>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      value={t.tema}
                      onChangeText={(text) => updateTema(t.id_local, { tema: text })}
                      placeholder="Escriba el tema"
                      multiline
                    />
                  </ThemedView>
                </ThemedView>
              );
            })}
            <TouchableOpacity style={styles.addButton} onPress={addTema} activeOpacity={0.85}>
              <Ionicons name="add-circle" size={20} color="#4CAF50" />
              <ThemedText style={styles.addButtonText}>Agregar tema</ThemedText>
            </TouchableOpacity>

            <ThemedText style={styles.formSectionTitle}>Firma responsable *</ThemedText>
            <ThemedText style={styles.smallHint}>Debe generar una firma (GPS + sesión) o escanear un QR.</ThemedText>
            <ThemedView style={styles.firmaButtonsRow}>
              <TouchableOpacity
                style={[styles.firmaBlueButton, isGeneratingFirma ? styles.signatureQRButtonDisabled : null]}
                onPress={handleGenerateFirmaResponsable}
                activeOpacity={0.85}
                disabled={isGeneratingFirma}
              >
                <Ionicons name="finger-print" size={18} color="#FFFFFF" />
                <ThemedText style={styles.firmaBlueButtonText}>{isGeneratingFirma ? 'Generando...' : 'Generar'}</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.firmaBlueButton} onPress={handleScanFirmaResponsable} activeOpacity={0.85}>
                <Ionicons name="qr-code" size={18} color="#FFFFFF" />
                <ThemedText style={styles.firmaBlueButtonText}>Escanear</ThemedText>
              </TouchableOpacity>
            </ThemedView>

            {firmaResponsable ? (
              <ThemedView style={styles.firmaInfoBox}>
                <ThemedView style={styles.firmaInfoHeader}>
                  <ThemedText style={styles.firmaInfoTitle}>Información de la firma:</ThemedText>
                  <TouchableOpacity onPress={() => setFirmaResponsable('')} style={styles.firmaTinyTrash} activeOpacity={0.85}>
                    <Ionicons name="trash" size={18} color="#FF3B30" />
                  </TouchableOpacity>
                </ThemedView>
                {(() => {
                  const info = decodeFirmaHash(firmaResponsable);
                  if (!info) return <ThemedText style={styles.firmaInfoText}>Formato no decodificable</ThemedText>;
                  return (
                    <>
                      <ThemedText style={styles.firmaInfoText}>Sesión: {info.sessionId}</ThemedText>
                      <ThemedText style={styles.firmaInfoText}>Empleado: {info.empleadoId}</ThemedText>
                      <ThemedText style={styles.firmaInfoText}>
                        Lat: {info.latitud} | Long: {info.longitud}
                      </ThemedText>
                      <ThemedText style={styles.firmaInfoText}>Hora: { convertDateTimestampToLocalString(new Date(Number(info.timestamp)).toISOString())}</ThemedText>
                    </>
                  );
                })()}
              </ThemedView>
            ) : (
              <ThemedText style={styles.emptyTextSmall}>Aún no hay firma responsable.</ThemedText>
            )}

            <ThemedView style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.listItemButton, styles.saveButton, isSubmitting && styles.disabledButton]}
                onPress={saveHandler}
                activeOpacity={0.85}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="save" size={18} color="#FFFFFF" />
                    <ThemedText style={styles.buttonText}>Aceptar</ThemedText>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.listItemButton, styles.cancelButton]}
                onPress={cancelCreateOrEdit}
                activeOpacity={0.85}
                disabled={isSubmitting}
              >
                <Ionicons name="close" size={18} color="#FFFFFF" />
                <ThemedText style={styles.buttonText}>Cancelar</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          </ThemedView>
        </ThemedView>
      </ScrollView>
    );
  };

  return (
    <ThemedView style={styles.screen}>
      <AppHeader title="Agenda minuta" onMenuPress={() => setIsMenuVisible(true)} />
      <SlideMenu isVisible={isMenuVisible} onClose={() => setIsMenuVisible(false)} currentRoute="PhysicalMinuteAgenda" onHomePress={() => navigation.navigate('Home')} />

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
                  const createdAtLabel = convertDateTimestampToLocalString(row?.created_at);
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
                                const prop = String(c?.prop ?? '-');
                                const value = c?.after;
                                const isFirmaResponsable = prop === 'firma_responsable';

                                if (prop === '__created__' && value && typeof value === 'object') {
                                  const created: any = value;
                                  return (
                                    <React.Fragment key={`c-${row.id}-${idx}-created`}>
                                      <ThemedView style={styles.changeDescriptionContainer}>
                                        <ThemedText style={styles.changeDescription}>
                                          <ThemedText style={{ fontWeight: '800' }}>Registro creado</ThemedText>
                                        </ThemedText>
                                      </ThemedView>
                                      {Object.entries(created).map(([k, v]) => {
                                        if (k === 'firma_responsable') {
                                          const info = decodeFirmaHash(typeof v === 'string' ? v : v != null ? String(v) : null);
                                          return (
                                            <ThemedView key={`c-${row.id}-${idx}-${k}`} style={styles.changeDescriptionContainer}>
                                              <ThemedText style={styles.changeDescription}>
                                                <ThemedText style={{ fontWeight: '800' }}>{k}: </ThemedText>
                                                {info ? `Sesión: ${info.sessionId || 'N/A'} - Empleado: ${info.empleadoId || 'N/A'} - Hora: ${ convertDateTimestampToLocalString(new Date(Number(info.timestamp)).toISOString()) || 'N/A'}` : 'Firma (formato no decodificable)'}
                                              </ThemedText>
                                            </ThemedView>
                                          );
                                        }
                                        if (k === 'participantes') {
                                          const arr = (() => {
                                            if (Array.isArray(v)) return v;
                                            if (typeof v === 'string') {
                                              try { return JSON.parse(v) as any[]; } catch { return []; }
                                            }
                                            return [];
                                          })();
                                          return (
                                            <ThemedView key={`c-${row.id}-${idx}-${k}`} style={styles.changeDescriptionContainer}>
                                              <ThemedText style={[styles.changeDescription, { fontWeight: '800' }]}>{k}:</ThemedText>
                                              {arr.length === 0 ? (
                                                <ThemedText style={styles.changeDescription}>—</ThemedText>
                                              ) : (
                                                arr.map((p: any, i: number) => (
                                                  <ThemedView key={`p-${i}`} style={styles.changeDescriptionContainer}>
                                                    <ThemedText style={styles.changeDescription}>
                                                      {i + 1}. {String(p?.nombre ?? '').trim() || '—'} (Puesto: {String(p?.puesto ?? p?.cedula ?? '').trim() || '—'})
                                                    </ThemedText>
                                                    {p?.firma ? (
                                                      <Image source={{ uri: formatSignatureForDisplay(p.firma) ?? '' }} style={styles.cambioSignatureImage} resizeMode="contain" />
                                                    ) : (
                                                      <ThemedText style={styles.changeDescription}>Sin firma</ThemedText>
                                                    )}
                                                  </ThemedView>
                                                ))
                                              )}
                                            </ThemedView>
                                          );
                                        }
                                        return (
                                          <ThemedView key={`c-${row.id}-${idx}-${k}`} style={styles.changeDescriptionContainer}>
                                            <ThemedText style={styles.changeDescription}>
                                              <ThemedText style={{ fontWeight: '800' }}>{k}: </ThemedText>
                                              {formatChangeValue(k, v)}
                                            </ThemedText>
                                          </ThemedView>
                                        );
                                      })}
                                    </React.Fragment>
                                  );
                                }
                                if (prop === 'participantes') {
                                  const arr = (() => {
                                    if (Array.isArray(value)) return value;
                                    if (typeof value === 'string') {
                                      try { return JSON.parse(value) as any[]; } catch { return []; }
                                    }
                                    return [];
                                  })();
                                  return (
                                    <ThemedView key={`c-${row.id}-${idx}`} style={styles.changeDescriptionContainer}>
                                      <ThemedText style={[styles.changeDescription, { fontWeight: '800' }]}>{prop}:</ThemedText>
                                      {arr.length === 0 ? (
                                        <ThemedText style={styles.changeDescription}>—</ThemedText>
                                      ) : (
                                        arr.map((p: any, i: number) => (
                                          <ThemedView key={`p-${i}`} style={styles.changeDescriptionContainer}>
                                            <ThemedText style={styles.changeDescription}>
                                              {i + 1}. {String(p?.nombre ?? '').trim() || '—'} (Puesto: {String(p?.puesto ?? p?.cedula ?? '').trim() || '—'})
                                            </ThemedText>
                                            {p?.firma ? (
                                              <Image source={{ uri: formatSignatureForDisplay(p.firma) ?? '' }} style={styles.cambioSignatureImage} resizeMode="contain" />
                                            ) : (
                                              <ThemedText style={styles.changeDescription}>Sin firma</ThemedText>
                                            )}
                                          </ThemedView>
                                        ))
                                      )}
                                    </ThemedView>
                                  );
                                }
                                return (
                                  <ThemedView key={`c-${row.id}-${idx}`} style={styles.changeDescriptionContainer}>
                                    <ThemedText style={styles.changeDescription}>
                                      <ThemedText style={{ fontWeight: '800' }}>{prop}: </ThemedText>
                                      {isFirmaResponsable && typeof value === 'string' && value.trim()
                                        ? (() => {
                                            const info = decodeFirmaHash(value);
                                            return info ? `Sesión: ${info.sessionId || 'N/A'} - Empleado: ${info.empleadoId || 'N/A'} - Hora: ${ convertDateTimestampToLocalString(new Date(Number(info.timestamp)).toISOString()) || 'N/A'}` : 'Firma (formato no decodificable)';
                                          })()
                                        : !isFirmaResponsable ? formatChangeValue(prop, value) : 'N/A'}
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

      {!hasCurrentMarca ? (
        <ThemedView style={styles.noMarcaContainer}>
          <ThemedText style={styles.noMarcaText}>Debe seleccionar una marca para continuar.</ThemedText>
        </ThemedView>
      ) : isCreating ? (
        renderForm()
      ) : (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <ThemedView style={styles.content}>
            <ThemedView style={styles.titleContainer}>
              <ThemedText type="title" style={styles.title}>
                Agenda minuta
              </ThemedText>
              <ThemedText style={styles.subtitle}>Registra y consulta agendas de minuta por puesto</ThemedText>
            </ThemedView>

      {/* Filtros siempre visibles; jerarquía solo para no operativos */}
      {roleName != null && (
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
                    <TouchableOpacity style={styles.resetFiltersButton} onPress={() => {
                      setFilterEmpresaId(null);
                      setFilterClienteId(marcaClienteId);
                      setFilterDivisionId(null);
                      setFilterContratoId(null);
                      setFilterCorpoId(marcaCorpoId);
                      setFilterPuestoId(null);
                      setFilterFecha('');
                      setFilterHoraInicio('');
                      setFilterHoraFin('');
                    }}>
                      <Ionicons name="refresh" size={16} color="#FF3B30" />
                      <ThemedText style={styles.resetFiltersText}>Reiniciar</ThemedText>
                    </TouchableOpacity>
                  )}
                </ThemedView>
                {isFiltersExpanded && (
                  <ThemedView style={styles.filterContent}>
                    {roleName !== 'OPERATIVO' && (
                      <>
                    {/* Árbol jerárquico para filtros */}
                    <ThemedView style={styles.filterGroup}>
                      <ThemedText style={styles.filterLabel}>Empresa:</ThemedText>
                      <View style={styles.pickerWrapper}>
                        <Picker
                          selectedValue={filterEmpresaId ?? 0}
                          onValueChange={(value) => {
                            setFilterEmpresaId(Number(value) || null);
                          }}
                          style={styles.picker}
                        >
                          <Picker.Item label="Seleccionar..." value={0} color="#000000" />
                          {filterEmpresas.map((e: any) => (
                            <Picker.Item key={e.id} label={e.nombre} value={e.id} color="#000000" />
                          ))}
                        </Picker>
                      </View>
                    </ThemedView>

                    {filterEmpresaId && (
                      <ThemedView style={styles.filterGroup}>
                        <ThemedText style={styles.filterLabel}>Cliente:</ThemedText>
                        <View style={styles.pickerWrapper}>
                          <Picker
                            selectedValue={filterClienteId ?? 0}
                            onValueChange={(value) => {
                              setFilterClienteId(Number(value) || null);
                            }}
                            style={styles.picker}
                          >
                            <Picker.Item label="Seleccionar..." value={0} color="#000000" />
                            {filterClientes.map((c: any) => (
                              <Picker.Item key={c.id} label={c.nombre} value={c.id} color="#000000" />
                            ))}
                          </Picker>
                        </View>
                      </ThemedView>
                    )}

                    {filterClienteId && (
                      <ThemedView style={styles.filterGroup}>
                        <ThemedText style={styles.filterLabel}>División:</ThemedText>
                        <View style={styles.pickerWrapper}>
                          <Picker
                            selectedValue={filterDivisionId ?? 0}
                            onValueChange={(value) => {
                              setFilterDivisionId(Number(value) || null);
                            }}
                            style={styles.picker}
                          >
                            <Picker.Item label="Seleccionar..." value={0} color="#000000" />
                            {filterDivisiones.map((d: any) => (
                              <Picker.Item key={d.id} label={d.nombre} value={d.id} color="#000000" />
                            ))}
                          </Picker>
                        </View>
                      </ThemedView>
                    )}

                    {filterDivisionId && (
                      <ThemedView style={styles.filterGroup}>
                        <ThemedText style={styles.filterLabel}>Contrato:</ThemedText>
                        <View style={styles.pickerWrapper}>
                          <Picker
                            selectedValue={filterContratoId ?? 0}
                            onValueChange={(value) => {
                              setFilterContratoId(Number(value) || null);
                            }}
                            style={styles.picker}
                          >
                            <Picker.Item label="Seleccionar..." value={0} color="#000000" />
                            {filterContratos.map((c: any) => (
                              <Picker.Item key={c.id} label={c.nombre} value={c.id} color="#000000" />
                            ))}
                          </Picker>
                        </View>
                      </ThemedView>
                    )}

                    {filterContratoId && (
                      <ThemedView style={styles.filterGroup}>
                        <ThemedText style={styles.filterLabel}>Sucursal:</ThemedText>
                        <View style={styles.pickerWrapper}>
                          <Picker
                            selectedValue={filterCorpoId ?? 0}
                            onValueChange={(value) => {
                              setFilterCorpoId(Number(value) || null);
                            }}
                            style={styles.picker}
                          >
                            <Picker.Item label="Seleccionar..." value={0} color="#000000" />
                            {filterSucursales.map((s: any) => (
                              <Picker.Item key={s.id} label={s.nombre} value={s.id} color="#000000" />
                            ))}
                          </Picker>
                        </View>
                      </ThemedView>
                    )}

                      </>
                    )}

                    <ThemedView style={styles.filterGroup}>
                      <ThemedText style={styles.filterLabel}>Puesto (solo visual):</ThemedText>
                      <View style={styles.pickerWrapper}>
                        <Picker
                          selectedValue={filterPuestoId ?? 0}
                          onValueChange={(value) => setFilterPuestoId(Number(value) || null)}
                          style={styles.picker}
                        >
                          <Picker.Item label="Todos" value={0} color="#000000" />
                          {visualFilterPuestos.map((p: any) => (
                            <Picker.Item key={p.id} label={p.nombre} value={p.id} color="#000000" />
                          ))}
                        </Picker>
                      </View>
                    </ThemedView>

                    <ThemedView style={styles.filterGroup}>
                      <ThemedText style={styles.filterLabel}>Fecha (YYYY-MM-DD)</ThemedText>
                      <TextInput
                        style={styles.input}
                        value={filterFecha}
                        onChangeText={setFilterFecha}
                        placeholder="2026-04-29"
                        placeholderTextColor="#999"
                      />
                    </ThemedView>

                    <ThemedView style={styles.filterGroup}>
                      <ThemedText style={styles.filterLabel}>Hora inicio (HH:mm)</ThemedText>
                      <TextInput
                        style={styles.input}
                        value={filterHoraInicio}
                        onChangeText={setFilterHoraInicio}
                        placeholder="08:00"
                        placeholderTextColor="#999"
                      />
                    </ThemedView>

                    <ThemedView style={styles.filterGroup}>
                      <ThemedText style={styles.filterLabel}>Hora fin (HH:mm)</ThemedText>
                      <TextInput
                        style={styles.input}
                        value={filterHoraFin}
                        onChangeText={setFilterHoraFin}
                        placeholder="17:00"
                        placeholderTextColor="#999"
                      />
                    </ThemedView>
                  </ThemedView>
                )}
              </ThemedView>
            )}

            {!isLoading && (
              <TouchableOpacity style={styles.createButton} onPress={startCreate} activeOpacity={0.85}>
                <ThemedText style={styles.createButtonText}>
                  <Ionicons name="add" size={18} color="#FFFFFF" />
                </ThemedText>
              </TouchableOpacity>
            )}

            {renderList()}
          </ThemedView>
        </ScrollView>
      )}

      {/* Signature modal */}
      <Modal visible={isSignatureModalVisible} transparent animationType="fade" onRequestClose={closeSignatureModal}>
        <View style={styles.signatureModalOverlay}>
          <View style={styles.signatureModalContainer}>
            <View style={styles.signatureModalHeader}>
              <ThemedText style={styles.signatureModalTitle}>Firma</ThemedText>
              <TouchableOpacity onPress={closeSignatureModal} activeOpacity={0.85}>
                <Ionicons name="close" size={22} color="#000000" />
              </TouchableOpacity>
            </View>
            <View style={styles.signatureCanvasWrapper}>
              <SignatureScreen
                key={signatureKey}
                ref={signatureRef}
                onOK={handleSignatureRead}
                webStyle={signatureWebStyle}
                autoClear={false}
                backgroundColor="#FFFFFF"
              />
            </View>
            <View style={styles.signatureModalButtons}>
              <TouchableOpacity style={[styles.signatureModalButton, styles.signatureClearButton]} onPress={clearSignatureInModal} activeOpacity={0.85}>
                <ThemedText style={styles.signatureModalButtonText}>Limpiar</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.signatureModalButton, styles.signatureAcceptButton]} onPress={acceptSignature} activeOpacity={0.85}>
                <ThemedText style={[styles.signatureModalButtonText, styles.signatureAcceptButtonText]}>Aceptar</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {QRScannerComponent}
      <AppFooter />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  // Estructura visual tipo LlavesScreen
  screen: { flex: 1, backgroundColor: '#F2F2F7' },
  container: { flex: 1 },
  scrollView: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { padding: 16, paddingBottom: 30, backgroundColor: '#FFFFFF' },
  content: { width: '100%', maxWidth: 800, alignSelf: 'center', backgroundColor: '#FFFFFF' },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, opacity: 0.7, textAlign: 'center' },

  createButton: { backgroundColor: '#007AFF', padding: 14, borderRadius: 10, alignItems: 'center', marginBottom: 12 },
  createButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },

  // Filtros
  filtersMain: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
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
  filterGroup: { marginBottom: 12 },
  filterLabel: { fontSize: 13, fontWeight: '600', marginBottom: 4, color: '#000' },

  noMarcaContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  noMarcaText: { color: '#000', opacity: 0.7, fontSize: 14 },

  // Form (como ComplaintsMasterScreen)
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
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 8,
    textAlign: 'center',
  },

  sectionContainer: { marginBottom: 16, backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#E5E5EA', overflow: 'hidden' },
  sectionHeader: { padding: 14, backgroundColor: '#F5F5F5', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#000000' },
  sectionBody: { padding: 14 },
  inlineLoading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inlineLoadingText: { fontSize: 12, color: '#000', opacity: 0.6 },

  label: { marginTop: 10, marginBottom: 6, fontSize: 13, fontWeight: '700', color: '#000000' },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#FFFFFF',
    color: '#000',
  },
  textArea: { minHeight: 90, textAlignVertical: 'top' as any },

  pickerWrapper: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10, overflow: 'hidden', backgroundColor: '#FFFFFF', justifyContent: 'center' },
  picker: { height: 54, width: '100%', color: '#000', fontSize: 16 },

  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#F9F9F9',
  },
  dateButtonText: { fontSize: 16, color: '#000000' },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
  },
  checkboxLabel: { color: '#000000', fontSize: 14, fontWeight: '600' },

  emptyTextSmall: { color: '#000', opacity: 0.6 },
  smallHint: { color: '#000', opacity: 0.6, marginBottom: 8 },
  formSectionTitle: { marginTop: 6, fontSize: 14, fontWeight: '800', color: '#007AFF', marginBottom: 6 },

  // expandables
  expandItem: { marginBottom: 14, backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: '#E0E0E0', overflow: 'hidden' },
  expandHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, backgroundColor: '#F5F5F5' },
  expandHeaderContent: { flex: 1, marginRight: 10 },
  expandHeaderText: { fontSize: 15, fontWeight: '700', color: '#000000' },
  expandHeaderSubText: { marginTop: 4, fontSize: 13, color: '#000', opacity: 0.7 },
  expandHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  removeExpandButton: { padding: 4 },
  expandContent: { padding: 14 },

  signatureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    marginBottom: 10,
  },
  signatureButtonText: { color: '#007AFF', fontWeight: '700' },
  signaturePreview: { width: '100%', height: 140, backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#E0E0E0', marginTop: 10 },
  codeRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 8, marginBottom: 8 },
  codeInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#fff',
    color: '#000',
  },
  codeActionButton: { backgroundColor: '#007AFF', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 11 },
  codeActionButtonText: { color: '#FFF', fontWeight: '700' },

  // agreements/participants list display
  personDetailCard: { width: '100%', borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10, padding: 10, backgroundColor: '#FFFFFF', marginBottom: 12 },
  personDetailTitle: { fontSize: 14, fontWeight: '800', color: '#000000', marginBottom: 6 },

  // add button
  addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, backgroundColor: '#E8F5E9', borderRadius: 10, marginTop: 10, gap: 8 },
  addButtonText: { color: '#4CAF50', fontSize: 14, fontWeight: '700' },

  // firma responsable
  signatureQRButtonDisabled: { opacity: 0.6 },
  firmaButtonsRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  firmaBlueButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 10,
    gap: 8,
  },
  firmaBlueButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  firmaInfoBox: { marginTop: 10, borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10, padding: 12, backgroundColor: '#FFFFFF' },
  firmaInfoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  firmaInfoTitle: { fontSize: 14, fontWeight: '800', color: '#000000' },
  firmaTinyTrash: { padding: 4 },
  firmaInfoText: { fontSize: 13, color: '#000000', opacity: 0.8, marginBottom: 4 },

  // list
  listContainer: { marginTop: 10 },
  listItem: { backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#E5E5EA', marginBottom: 12, overflow: 'hidden' },
  listItemHeader: { padding: 16 },
  listItemContent: {},
  listItemTitle: { fontSize: 16, fontWeight: '800', color: '#000' },
  listItemSubtitle: { marginTop: 4, fontSize: 13, color: '#000', opacity: 0.7 },
  unsyncedBadge: { marginTop: 8, fontSize: 12, fontWeight: '800', color: '#FF9500' },
  listItemDetails: { borderTopWidth: 1, borderTopColor: '#EEE', padding: 16 },

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
  collapseButtonText: { fontSize: 13, fontWeight: '700', color: '#007AFF' },
  collapsableContent: { marginTop: 8, padding: 10, borderRadius: 8, backgroundColor: '#F8F9FA' },
  detailLine: { marginBottom: 6, color: '#000' },

  actionButtons: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 10 },
  listItemButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 10 },
  editButton: { backgroundColor: '#007AFF' },
  changesButton: { backgroundColor: '#5856D6', flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 10 },
  deleteButton: { backgroundColor: '#FF3B30' },
  saveButton: { backgroundColor: '#007AFF' },
  cancelButton: { backgroundColor: '#8E8E93' },
  disabledButton: { opacity: 0.65 },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
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
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  floatModalCardMovimientos: { backgroundColor: '#FFFFFF', borderRadius: 12, width: '100%', maxWidth: 500, maxHeight: '80%', borderWidth: 1, borderColor: '#E0E0E0', overflow: 'hidden' },
  floatModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#000' },
  cambioCollapsableMain: { width: '100%', marginBottom: 10, backgroundColor: '#fff', borderRadius: 6, borderWidth: 1, borderColor: '#E0E0E0', overflow: 'hidden' },
  cambioCollapsableHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#F8F9FA' },
  cambioCollapsableTitle: { fontSize: 14, fontWeight: '600', color: '#007AFF', flex: 1 },
  cambioCollapsableContent: { padding: 12, gap: 8, backgroundColor: '#F8F9FA' },
  changeDescription: { fontSize: 14, lineHeight: 20, color: '#666', marginBottom: 8 },
  changeDescriptionContainer: { marginBottom: 8 },
  cambioSignatureImage: { marginTop: 6, height: 80, width: 160, backgroundColor: '#f0f0f0', borderRadius: 4 },
  filterGroupSearch: { marginBottom: 12 },

  // loading/empty/error
  loadingContainer: { padding: 20, alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 14, color: '#000', opacity: 0.7 },
  errorContainer: { padding: 20, alignItems: 'center' },
  errorText: { color: '#FF3B30', textAlign: 'center' },
  emptyContainer: { padding: 20, alignItems: 'center' },
  emptyText: { color: '#000', opacity: 0.7 },

  // signature modal
  signatureModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  signatureModalContainer: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 14, overflow: 'hidden' },
  signatureModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#F5F5F5' },
  signatureModalTitle: { fontSize: 16, fontWeight: '800', color: '#000' },
  signatureCanvasWrapper: { height: 260, backgroundColor: '#FFFFFF' },
  signatureModalButtons: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, padding: 12 },
  signatureModalButton: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  signatureClearButton: { backgroundColor: '#F2F2F7' },
  signatureAcceptButton: { backgroundColor: '#007AFF' },
  signatureModalButtonText: { fontSize: 14, fontWeight: '800', color: '#000' },
  signatureAcceptButtonText: { color: '#FFFFFF' },
});


