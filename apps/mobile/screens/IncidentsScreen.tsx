import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Linking, Modal, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View, Image } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import SignatureScreen from 'react-native-signature-canvas';
import * as Network from 'expo-network';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';

import AppHeader from '@/components/AppHeader';
import AppFooter from '@/components/AppFooter';
import SlideMenu from '@/components/SlideMenu';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import HierarchyPickerFields, { type HierarchyPickerValues } from '@/components/HierarchyPickerFields';
import { RootStackParamList } from '../App';
import { useAuth } from '@/contexts/AuthContext';
import authedFetch from '@/hooks/authedFetch';
import getHoraAccion from '@/hooks/getHoraAccion';
import { eventBus } from '@/hooks/eventBus';
import { convertDateTimestampToLocalString } from '@/hooks/convertDateTimestampToLocalString';

import type {
  CreateIncidentRequest,
  ExecutiveOption,
  Incident,
  IncidentClassificationOption,
  IncidentContribution,
  IncidentContributionFileInput,
  IncidentFileInput,
} from '@/hooks/incidentsTypes';
import { createIncident, createIncidentContribution, deleteIncident, deleteIncidentContribution, deleteIncidentContributionFile, deleteIncidentFile, listExecutives, listIncidentClassifications, listIncidentContributions, listIncidentsByCorpo, updateIncidentContribution } from '@/hooks/incidentsFunctions';
import { deleteFile, getLocalFileDisplayUri, saveFile, type StoredFileType } from '@/hooks/fileStorage';
import { loadMainStructureTreeMerged } from '@/hooks/bitacoraMainStructureCache';
import { findHierarchyByPuestoIn } from '@/hooks/llavesMainStructureHelpers';
import { filterIncidentsByCorpo, getCurrentMarcaId, getExecutivesCache, getIncidentsCache, getIncidentsClassificationsCache, INCIDENT_CONTRIBUTIONS_ACTIONS_KEY, mergeIncidentsCacheForCorpo, setExecutivesCache, setIncidentsCache, setIncidentsClassificationsCache } from '@/hooks/incidentsStorage';

type IncidentsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Incidents'>;

type InvolucradoForm = { codigo: string; nombre: string };

type ManualFileLocal = {
  id: string;
  type: 'image' | 'audio' | 'video' | 'document';
  name: string;
  extension: string;
  /** Vacío si el archivo está solo en disco vía `localFileName` */
  base64: string;
  /** Nombre en `Paths.document` (expo-file-system) */
  localFileName?: string;
  uri?: string;
  mimeType?: string;
};

const mapManualTypeToStored = (t: ManualFileLocal['type']): StoredFileType =>
  t === 'document' ? 'text' : t;

const APORTE_SIGNATURE_FILE_NAME = '__firma_aporte_tercero__.png';

const incidentRowKey = (i: Incident) => String(i.id_local || (i.id ?? ''));
const aporteRowKey = (a: IncidentContribution) => String(a.id_local || (a.id ?? ''));

type MainStructureSucursalNode = {
  id: number;
  nombre: string;
  puestos?: { id: number; nombre: string }[];
};
type MainStructureContratoNode = { id: number; nombre: string; sucursales: MainStructureSucursalNode[] };
type MainStructureDivisionNode = { id: number; nombre: string; contratos: MainStructureContratoNode[] };
type MainStructureClienteNode = { id: number; nombre: string; division: MainStructureDivisionNode[] };
type MainStructureEmpresaNode = { id: number; nombre: string; clientes: MainStructureClienteNode[] };
type MainStructureTree = MainStructureEmpresaNode[];

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

type EditingIncident = {
  id: number | null;
  id_local: string;
  estado: boolean;

  ejecutivo_id: number | null;
  fecha_incidente: string;
  fecha_reporte: string;
  nombre_responsable: string;
  clasificacion_id: number | null;
  descripcion: string;
  involucrados: InvolucradoForm[];
  libro_fecha: string;
  libro_numero: string;
  nombre_responsable_atencion: string;

  // Edit-only (pero visibles en edición)
  solucion: string;
  fecha_solucion: string;
  fecha_real_solucion: string;
  costo_asociado: string;
  consecutivo_informe: string;
  link_informe: string;
  owned: boolean;
};

const generateRandomId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 10; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
};

const isoDateOnly = (d: Date) => {
  // YYYY-MM-DDT00:00:00.000Z
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T00:00:00.000Z`;
};

const dateLabel = (iso: string) => {
  try {
    if (!iso) return '';
    return iso.split('T')[0];
  } catch {
    return iso;
  }
};

// Helpers para construir URLs de archivos
const buildIncidentFileUrl = (incidentId: number | undefined, file: any, accessToken?: string | null) => {
  // Si es registro offline (tiene id_local no vacío), usamos base64
  const hasLocalId = file.id_local !== undefined && file.id_local !== null && file.id_local !== '';
  if (hasLocalId && file.base64) {
    const mime = file.mimeType || (file.type ? `${file.type}/${file.extension || 'octet-stream'}` : `application/${file.extension || 'octet-stream'}`);
    return `data:${mime};base64,${file.base64}`;
  }

  // Para registros sincronizados, usar la API
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl || !incidentId) return '';
  const appendTokenToUrl = (url: string) => {
    if (!accessToken || accessToken.trim().length === 0) return url;
    if (/[?&]token=/.test(url)) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}token=${encodeURIComponent(accessToken)}`;
  };

  if (file.type === 'image') {
    return appendTokenToUrl(`${apiUrl}/api/incidents/${incidentId}/get-image/${encodeURIComponent(file.name)}`);
  }
  if (file.type === 'audio') {
    return appendTokenToUrl(`${apiUrl}/api/incidents/${incidentId}/get-audio/${encodeURIComponent(file.name)}`);
  }
  if (file.type === 'video') {
    return appendTokenToUrl(`${apiUrl}/api/incidents/${incidentId}/get-video/${encodeURIComponent(file.name)}`);
  }
  // document o cualquier otro tipo
  return appendTokenToUrl(`${apiUrl}/api/incidents/${incidentId}/get-file/${encodeURIComponent(file.name)}`);
};

const buildContributionFileUrl = (incidentId: number | undefined, contributionId: number | undefined, file: any, accessToken?: string | null) => {
  const hasLocalId = file.id_local !== undefined && file.id_local !== null && file.id_local !== '';
  if (hasLocalId && file.base64) {
    const mime = file.mimeType || (file.type ? `${file.type}/${file.extension || 'octet-stream'}` : `application/${file.extension || 'octet-stream'}`);
    return `data:${mime};base64,${file.base64}`;
  }

  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl || !incidentId || !contributionId) return '';
  const appendTokenToUrl = (url: string) => {
    if (!accessToken || accessToken.trim().length === 0) return url;
    if (/[?&]token=/.test(url)) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}token=${encodeURIComponent(accessToken)}`;
  };

  if (file.type === 'image') {
    return appendTokenToUrl(`${apiUrl}/api/incidents/${incidentId}/contributions/${contributionId}/get-image/${encodeURIComponent(file.name)}`);
  }
  if (file.type === 'audio') {
    return appendTokenToUrl(`${apiUrl}/api/incidents/${incidentId}/contributions/${contributionId}/get-audio/${encodeURIComponent(file.name)}`);
  }
  if (file.type === 'video') {
    return appendTokenToUrl(`${apiUrl}/api/incidents/${incidentId}/contributions/${contributionId}/get-video/${encodeURIComponent(file.name)}`);
  }
  return appendTokenToUrl(`${apiUrl}/api/incidents/${incidentId}/contributions/${contributionId}/get-file/${encodeURIComponent(file.name)}`);
};

const getFileDisplayName = (file: any) => {
  const candidate = (file.original_name ?? '').trim();
  return candidate.length > 0 ? candidate : file.name;
};

const normalizeRoleName = (role: string) => (role || '').toString().trim().toUpperCase();

const canModifyAporte = (rolAporte: string, aporteEmpleadoId: number, currentEmpleadoId: number, currentRole: string) => {
  const rol = normalizeRoleName(rolAporte);
  const myRole = normalizeRoleName(currentRole);
  const isAdmin = myRole === 'ADMINISTRATIVO' || myRole === 'ADMINISTRADOR';
  const isSupervisor = myRole === 'SUPERVISOR';
  const isOwner = aporteEmpleadoId === currentEmpleadoId;

  if (rol === 'OPERATIVO') return isOwner || isSupervisor || isAdmin;
  if (rol === 'SUPERVISOR') return isOwner || isAdmin;
  if (rol === 'ADMINISTRATIVO' || rol === 'ADMINISTRADOR') return isOwner;
  return isOwner;
};

export default function IncidentsScreen() {
  const navigation = useNavigation<IncidentsScreenNavigationProp>();
  const { employee, refreshAccessToken, logout, accessToken } = useAuth();

  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasCurrentMarca, setHasCurrentMarca] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [executives, setExecutives] = useState<ExecutiveOption[]>([]);
  const [classifications, setClassifications] = useState<IncidentClassificationOption[]>([]);
  const [currentRoleName, setCurrentRoleName] = useState<string>('');

  const [isCreating, setIsCreating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResponse, setSubmitResponse] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // Aportes (contribuciones)
  const [isSubmittingAporte, setIsSubmittingAporte] = useState(false);
  const [deletingIncidentKey, setDeletingIncidentKey] = useState<string | null>(null);
  const [deletingAporteKey, setDeletingAporteKey] = useState<string | null>(null);
  const [isAportesVisible, setIsAportesVisible] = useState(false);
  const [selectedIncidentForAportes, setSelectedIncidentForAportes] = useState<Incident | null>(null);
  const [isLoadingAportes, setIsLoadingAportes] = useState(false);
  const [aportes, setAportes] = useState<IncidentContribution[]>([]);
  const [aporteText, setAporteText] = useState('');
  const [aporteNombrePersonalizado, setAporteNombrePersonalizado] = useState('');
  const [aporteFirmaManual, setAporteFirmaManual] = useState<string | null>(null);
  const [editingAporte, setEditingAporte] = useState<IncidentContribution | null>(null);
  const [showAporteComposer, setShowAporteComposer] = useState(false);
  const [isAporteSignatureModalVisible, setIsAporteSignatureModalVisible] = useState(false);
  const [isReadingAporteSignature, setIsReadingAporteSignature] = useState(false);
  const [signatureAporteKey, setSignatureAporteKey] = useState(0);
  const signatureAporteRef = useRef<any>(null);

  const [aporteTextFiles, setAporteTextFiles] = useState<ManualFileLocal[]>([]);
  const [aporteImageFiles, setAporteImageFiles] = useState<ManualFileLocal[]>([]);
  const [aporteAudioFiles, setAporteAudioFiles] = useState<ManualFileLocal[]>([]);
  const [aporteVideoFiles, setAporteVideoFiles] = useState<ManualFileLocal[]>([]);

  const [newIncident, setNewIncident] = useState<EditingIncident>({
    id: null,
    id_local: '',
    estado: true,
    ejecutivo_id: null,
    fecha_incidente: '',
    fecha_reporte: '',
    nombre_responsable: '',
    clasificacion_id: null,
    descripcion: '',
    involucrados: [{ codigo: '', nombre: '' }],
    libro_fecha: '',
    libro_numero: '',
    nombre_responsable_atencion: '',
    solucion: '',
    fecha_solucion: '',
    fecha_real_solucion: '',
    costo_asociado: '',
    consecutivo_informe: '',
    link_informe: '',
    owned: false,
  });

  // Form refs (evita re-render y sigue el patrón de Vehicles)
  const ejecutivoRef = useRef<number | null>(null);
  const fechaIncidenteRef = useRef<string>('');
  const fechaReporteRef = useRef<string>('');
  const nombreResponsableRef = useRef<string>('');
  const clasificacionRef = useRef<number | null>(null);
  const descripcionRef = useRef<string>('');
  const nombreResponsableAtencionRef = useRef<string>('');

  // Local files (para crear / vista previa).
  const [textFiles, setTextFiles] = useState<ManualFileLocal[]>([]);
  const [imageFiles, setImageFiles] = useState<ManualFileLocal[]>([]);
  const [audioFiles, setAudioFiles] = useState<ManualFileLocal[]>([]);
  const [videoFiles, setVideoFiles] = useState<ManualFileLocal[]>([]);

  // Date pickers state
  const [showFechaIncidentePicker, setShowFechaIncidentePicker] = useState(false);
  const [showFechaReportePicker, setShowFechaReportePicker] = useState(false);
  const [showLibroFechaPicker, setShowLibroFechaPicker] = useState(false);
  const [showFilterFechaIncidentePicker, setShowFilterFechaIncidentePicker] = useState(false);
  const [showFilterFechaReportePicker, setShowFilterFechaReportePicker] = useState(false);

  const [pickerDateValue, setPickerDateValue] = useState(new Date());
  const [searchText, setSearchText] = useState('');
  const [filterFechaIncidente, setFilterFechaIncidente] = useState('');
  const [filterFechaReporte, setFilterFechaReporte] = useState('');
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  const [codigoInvolucradoBusqueda, setCodigoInvolucradoBusqueda] = useState('');

  const listFiltersSyncedFromMarcaOnceRef = useRef(false);
  const filterSucursalIdRef = useRef<number | null>(null);

  const [mainStructure, setMainStructure] = useState<MainStructureTree>([]);
  const [isStructureLoading, setIsStructureLoading] = useState(false);

  const [filterEmpresaId, setFilterEmpresaId] = useState<number | null>(null);
  const [filterClienteId, setFilterClienteId] = useState<number | null>(null);
  const [filterDivisionId, setFilterDivisionId] = useState<number | null>(null);
  const [filterContratoId, setFilterContratoId] = useState<number | null>(null);
  const [filterSucursalId, setFilterSucursalId] = useState<number | null>(null);

  const [formEmpresaId, setFormEmpresaId] = useState<number | null>(null);
  const [formClienteId, setFormClienteId] = useState<number | null>(null);
  const [formDivisionId, setFormDivisionId] = useState<number | null>(null);
  const [formContratoId, setFormContratoId] = useState<number | null>(null);
  const [formSucursalId, setFormSucursalId] = useState<number | null>(null);
  const [formPuestoId, setFormPuestoId] = useState<number | null>(null);

  const getConnectionStatus = async (): Promise<boolean> => {
    //return false;
    const networkState = await Network.getNetworkStateAsync();

    return (
      networkState.isConnected === true &&
      networkState.isInternetReachable === true
    );
  };

  useEffect(() => {
    filterSucursalIdRef.current = filterSucursalId;
  }, [filterSucursalId]);

  const syncMarcaFromStorage = useCallback(async (opts?: { applyFiltersFromMarca?: boolean }) => {
    const applyFiltersFromMarca = opts?.applyFiltersFromMarca !== false;
    const currentMarcaStr = await AsyncStorage.getItem('current_marca');
    if (!currentMarcaStr) {
      setHasCurrentMarca(false);
      if (applyFiltersFromMarca) {
        setFilterEmpresaId(null);
        setFilterClienteId(null);
        setFilterDivisionId(null);
        setFilterContratoId(null);
        filterSucursalIdRef.current = null;
        setFilterSucursalId(null);
      }
      return;
    }
    try {
      const current = JSON.parse(currentMarcaStr);
      if (!current) {
        setHasCurrentMarca(false);
        return;
      }
      setHasCurrentMarca(true);
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
        filterSucursalIdRef.current = fs;
        setFilterSucursalId(fs);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const resetListFiltersFromCurrentMarca = useCallback(async () => {
    try {
      const currentMarcaStr = await AsyncStorage.getItem('current_marca');
      if (!currentMarcaStr) return;
      const currentMarca = JSON.parse(currentMarcaStr);
      const divId = getDivisionIdFromMarcaJson(currentMarca);
      setFilterEmpresaId(currentMarca.empresa?.id != null ? Number(currentMarca.empresa.id) : null);
      setFilterClienteId(currentMarca.cliente?.id != null ? Number(currentMarca.cliente.id) : null);
      setFilterDivisionId(divId);
      setFilterContratoId(currentMarca.contrato?.id != null ? Number(currentMarca.contrato.id) : null);
      const fs = currentMarca.corpo?.id != null ? Number(currentMarca.corpo.id) : numOrNull(currentMarca.corpo_id);
      filterSucursalIdRef.current = fs;
      setFilterSucursalId(fs);
    } catch (e) {
      console.error('resetListFiltersFromCurrentMarca (Incidents):', e);
    }
  }, []);

  const fetchMainStructure = useCallback(async (): Promise<MainStructureTree> => {
    setIsStructureLoading(true);
    try {
      const parsed = await loadMainStructureTreeMerged();
      if (Array.isArray(parsed) && parsed.length > 0) {
        setMainStructure(parsed);
        return parsed;
      }
      setMainStructure([]);
      return [];
    } catch (e) {
      console.error('Error loading main structure (Incidents):', e);
      setMainStructure([]);
      return [];
    } finally {
      setIsStructureLoading(false);
    }
  }, []);

  const applyCurrentMarcaToFormHierarchy = useCallback(
    async (structureTree?: MainStructureTree) => {
    try {
      const currentMarcaStr = await AsyncStorage.getItem('current_marca');
      if (!currentMarcaStr) return;
      const marca = JSON.parse(currentMarcaStr);
      const rn = marca?.roleDivision?.role?.nombre ?? marca?.role_division?.role?.nombre ?? null;
      const tree = Array.isArray(structureTree) && structureTree.length > 0 ? structureTree : mainStructure;
      if (normalizeRoleName(String(rn || '')) === 'OPERATIVO') {
        const pId = numOrNull(marca.puesto?.id ?? marca.puesto_id);
        setFormPuestoId(pId);
        if (pId && tree.length > 0) {
          const h = findHierarchyByPuestoIn(tree, pId);
          if (h) {
            setFormEmpresaId(h.empresaId);
            setFormClienteId(h.clienteId);
            setFormDivisionId(h.divisionId);
            setFormContratoId(h.contratoId);
            setFormSucursalId(h.corpoId);
            return;
          }
        }
        setFormEmpresaId(null);
        setFormClienteId(null);
        setFormDivisionId(null);
        setFormContratoId(null);
        setFormSucursalId(null);
        return;
      }
      setFormEmpresaId(marca.empresa?.id != null ? Number(marca.empresa.id) : null);
      setFormClienteId(marca.cliente?.id != null ? Number(marca.cliente.id) : null);
      setFormDivisionId(getDivisionIdFromMarcaJson(marca));
      setFormContratoId(marca.contrato?.id != null ? Number(marca.contrato.id) : null);
      setFormSucursalId(marca.corpo?.id != null ? Number(marca.corpo.id) : numOrNull(marca.corpo_id));
      setFormPuestoId(numOrNull(marca.puesto?.id ?? marca.puesto_id));
    } catch (e) {
      console.error('applyCurrentMarcaToFormHierarchy (Incidents):', e);
    }
  },
  [mainStructure]
  );

  const handleFormEmpresaChange = (empresaId: number | null) => {
    setFormEmpresaId(empresaId);
    setFormClienteId(null);
    setFormDivisionId(null);
    setFormContratoId(null);
    setFormSucursalId(null);
    setFormPuestoId(null);
  };

  const handleFormClienteChange = (clienteId: number | null) => {
    setFormClienteId(clienteId);
    setFormDivisionId(null);
    setFormContratoId(null);
    setFormSucursalId(null);
    setFormPuestoId(null);
  };

  const handleFilterEmpresaChange = (empresaId: number | null) => {
    setFilterEmpresaId(empresaId);
    setFilterClienteId(null);
    setFilterDivisionId(null);
    setFilterContratoId(null);
    filterSucursalIdRef.current = null;
    setFilterSucursalId(null);
  };

  const handleFilterClienteChange = (clienteId: number | null) => {
    setFilterClienteId(clienteId);
    setFilterDivisionId(null);
    setFilterContratoId(null);
    filterSucursalIdRef.current = null;
    setFilterSucursalId(null);
  };

  const handleFilterHierarchyChange = (v: HierarchyPickerValues) => {
    setFilterEmpresaId(v.empresaId);
    setFilterClienteId(v.clienteId);
    setFilterDivisionId(v.divisionId);
    setFilterContratoId(v.contratoId);
    filterSucursalIdRef.current = v.sucursalId;
    setFilterSucursalId(v.sucursalId);
    if (v.sucursalId != null) {
      void fetchAll();
    }
  };

  const handleFormHierarchyChange = useCallback((v: HierarchyPickerValues) => {
    setFormEmpresaId(v.empresaId);
    setFormClienteId(v.clienteId);
    setFormDivisionId(v.divisionId);
    setFormContratoId(v.contratoId);
    setFormSucursalId(v.sucursalId);
    setFormPuestoId(v.puestoId ?? null);
  }, []);

  const clearFormHierarchy = () => {
    setFormEmpresaId(null);
    setFormClienteId(null);
    setFormDivisionId(null);
    setFormContratoId(null);
    setFormSucursalId(null);
    setFormPuestoId(null);
  };

  const getActiveListCorpoId = async (): Promise<number | null> => {
    const marcaStr = await AsyncStorage.getItem('current_marca');
    if (!marcaStr) return numOrNull(filterSucursalIdRef.current);
    try {
      const marca = JSON.parse(marcaStr);
      const rn = normalizeRoleName(String(marca?.roleDivision?.role?.nombre ?? marca?.role_division?.role?.nombre ?? ''));
      const marcaCorpoId = numOrNull(marca?.corpo?.id ?? marca?.corpo_id);
      if (rn === 'OPERATIVO') return marcaCorpoId;
      return numOrNull(filterSucursalIdRef.current);
    } catch {
      return numOrNull(filterSucursalIdRef.current);
    }
  };

  const resolveCorpoIdForSave = async (): Promise<number | null> => {
    if (normalizeRoleName(currentRoleName) !== 'OPERATIVO') {
      return numOrNull(formSucursalId);
    }
    const marcaStr = await AsyncStorage.getItem('current_marca');
    if (!marcaStr) return null;
    try {
      const marca = JSON.parse(marcaStr);
      return numOrNull(marca?.corpo?.id ?? marca?.corpo_id);
    } catch {
      return null;
    }
  };

  const resolveCreateHierarchyIds = (): {
    empresa_id: number;
    division_id: number;
    contrato_id: number;
    cliente_id: number;
    corpo_id: number;
    puesto_id: number;
  } | null => {
    const pid = formPuestoId;
    if (!pid || pid <= 0) return null;
    const h = findHierarchyByPuestoIn(mainStructure, pid);
    if (h) {
      return {
        empresa_id: h.empresaId,
        division_id: h.divisionId,
        contrato_id: h.contratoId,
        cliente_id: h.clienteId,
        corpo_id: h.corpoId,
        puesto_id: h.puestoId,
      };
    }
    if (
      formEmpresaId &&
      formClienteId &&
      formDivisionId &&
      formContratoId &&
      formSucursalId &&
      formPuestoId
    ) {
      return {
        empresa_id: formEmpresaId,
        division_id: formDivisionId,
        contrato_id: formContratoId,
        cliente_id: formClienteId,
        corpo_id: formSucursalId,
        puesto_id: formPuestoId,
      };
    }
    return null;
  };

  const loadFromCaches = async (listCorpoId: number | null) => {
    const [cachedIncidents, cachedClassifications, cachedExecutives] = await Promise.all([
      getIncidentsCache(),
      getIncidentsClassificationsCache(),
      getExecutivesCache(),
    ]);

    if (listCorpoId) {
      setIncidents(filterIncidentsByCorpo(cachedIncidents || [], listCorpoId));
    } else {
      setIncidents([]);
    }
    setClassifications(cachedClassifications || []);
    setExecutives(cachedExecutives || []);
  };

  const loadCurrentRoleFromMarca = async () => {
    try {
      const marcaStr = await AsyncStorage.getItem('current_marca');
      if (!marcaStr) {
        setCurrentRoleName('');
        return;
      }
      const marca = JSON.parse(marcaStr);
      const role = marca?.roleDivision?.role?.nombre || marca?.role_division?.role?.nombre || '';
      setCurrentRoleName(String(role || '').trim());
    } catch {
      setCurrentRoleName('');
    }
  };

  const fetchAll = async () => {
    try {
      setIsLoading(true);
      setError(null);
      await loadCurrentRoleFromMarca();

      let marca: any = null;
      let isOperativo = normalizeRoleName(currentRoleName) === 'OPERATIVO';
      let marcaCorpoId: number | null = null;
      const marcaStr = await AsyncStorage.getItem('current_marca');
      if (marcaStr) {
        try {
          marca = JSON.parse(marcaStr);
          if (marca) {
            setHasCurrentMarca(true);
            const rn = normalizeRoleName(String(marca?.roleDivision?.role?.nombre ?? marca?.role_division?.role?.nombre ?? ''));
            isOperativo = rn === 'OPERATIVO';
            marcaCorpoId = numOrNull(marca?.corpo?.id ?? marca?.corpo_id);
          } else {
            setHasCurrentMarca(false);
          }
        } catch {
          setHasCurrentMarca(false);
        }
      } else {
        setHasCurrentMarca(false);
      }
      const listCorpoId = isOperativo ? marcaCorpoId : numOrNull(filterSucursalIdRef.current);

      const isConnected = await getConnectionStatus();

      const syncAuxCaches = async () => {
        if (!isConnected) {
          const [cachedClassifications, cachedExecutives] = await Promise.all([
            getIncidentsClassificationsCache(),
            getExecutivesCache(),
          ]);
          setClassifications(cachedClassifications || []);
          setExecutives(cachedExecutives || []);
          return;
        }
        const [classificationsRes, executivesRes] = await Promise.all([
          listIncidentClassifications({ refreshAccessToken, logout }),
          listExecutives({ refreshAccessToken, logout }),
        ]);
        if (classificationsRes.status && classificationsRes.classifications) {
          setClassifications(classificationsRes.classifications);
          await setIncidentsClassificationsCache(classificationsRes.classifications);
        }
        if (executivesRes.status && executivesRes.executives) {
          setExecutives(executivesRes.executives);
          await setExecutivesCache(executivesRes.executives);
        }
      };

      if (!isConnected) {
        await syncAuxCaches();
        await loadFromCaches(listCorpoId);
        if (listCorpoId) {
          Alert.alert('Modo Offline', 'No hay conexión a internet. Mostrando datos guardados.');
        } else if (!isOperativo) {
          Alert.alert(
            'Modo Offline',
            'Seleccione sucursal (corpo) en el filtro para ver incidentes guardados en caché para esa ubicación.'
          );
        } else {
          Alert.alert('Modo Offline', 'No se encontró la sucursal en la marca actual.');
        }
        return;
      }

      await syncAuxCaches();

      if (!listCorpoId) {
        setIncidents([]);
        if (isOperativo) {
          setError('No se encontró la sucursal (corpo) en la marca actual.');
        }
        return;
      }

      const incidentsRes = await listIncidentsByCorpo({ corpoId: listCorpoId, refreshAccessToken, logout });

      if (incidentsRes.status && incidentsRes.incidents) {
        const prev = (await getIncidentsCache()) || [];
        const merged = mergeIncidentsCacheForCorpo(prev, incidentsRes.incidents, listCorpoId);
        await setIncidentsCache(merged);
        setIncidents(filterIncidentsByCorpo(merged, listCorpoId));
      } else if (!incidentsRes.status) {
        setError(incidentsRes.message || 'Error al cargar incidentes');
      }
    } catch (e: any) {
      console.error('Error fetching incidents:', e);
      setError('Error al cargar incidentes');
      const fallbackCorpo = await getActiveListCorpoId();
      await loadFromCaches(fallbackCorpo);
    } finally {
      setIsLoading(false);
    }
  };

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
        await fetchAll();
      })();
      const handler = () => {
        void fetchAll();
      };
      eventBus.on('connectionRestored', handler);
      return () => {
        cancelled = true;
        eventBus.off('connectionRestored', handler);
      };
    }, [fetchMainStructure, syncMarcaFromStorage, refreshAccessToken, logout])
  );

  const isOperativoUser = useMemo(() => normalizeRoleName(currentRoleName) === 'OPERATIVO', [currentRoleName]);

  const filterEmpresaOptions = useMemo(() => mainStructure ?? [], [mainStructure]);
  const filterClienteOptionsMemo = useMemo(() => {
    const empresa = mainStructure.find((e) => e.id === filterEmpresaId);
    return empresa?.clientes ?? [];
  }, [mainStructure, filterEmpresaId]);
  const filterDivisionOptionsMemo = useMemo(() => {
    const cliente = filterClienteOptionsMemo.find((c) => c.id === filterClienteId);
    return cliente?.division ?? [];
  }, [filterClienteOptionsMemo, filterClienteId]);
  const filterContratoOptionsMemo = useMemo(() => {
    const division = filterDivisionOptionsMemo.find((d) => d.id === filterDivisionId);
    return division?.contratos ?? [];
  }, [filterDivisionOptionsMemo, filterDivisionId]);
  const filterSucursalOptionsMemo = useMemo(() => {
    const contrato = filterContratoOptionsMemo.find((c) => c.id === filterContratoId);
    return contrato?.sucursales ?? [];
  }, [filterContratoOptionsMemo, filterContratoId]);

  const formEmpresaNode = useMemo(() => {
    if (formEmpresaId === null) return null;
    return mainStructure.find((e) => e.id === formEmpresaId) ?? null;
  }, [mainStructure, formEmpresaId]);
  const formClienteOptions = useMemo(() => {
    if (!formEmpresaNode) return [];
    return (formEmpresaNode.clientes || []).map((c) => ({ id: c.id, nombre: c.nombre }));
  }, [formEmpresaNode]);
  const formClienteNode = useMemo(() => {
    if (!formEmpresaNode || formClienteId === null) return null;
    return formEmpresaNode.clientes.find((c) => c.id === formClienteId) ?? null;
  }, [formEmpresaNode, formClienteId]);
  const formDivisionOptions = useMemo(() => {
    if (!formClienteNode) return [];
    return (formClienteNode.division || []).map((d) => ({ id: d.id, nombre: d.nombre }));
  }, [formClienteNode]);
  const formDivisionNode = useMemo(() => {
    if (!formClienteNode || formDivisionId === null) return null;
    return (formClienteNode.division || []).find((d) => d.id === formDivisionId) ?? null;
  }, [formClienteNode, formDivisionId]);
  const formContratoOptions = useMemo(() => {
    if (!formDivisionNode) return [];
    return (formDivisionNode.contratos || []).map((c) => ({ id: c.id, nombre: c.nombre }));
  }, [formDivisionNode]);
  const formContratoNode = useMemo(() => {
    if (!formDivisionNode || formContratoId === null) return null;
    return (formDivisionNode.contratos || []).find((c) => c.id === formContratoId) ?? null;
  }, [formDivisionNode, formContratoId]);
  const formSucursalOptions = useMemo(() => {
    if (!formContratoNode) return [];
    return (formContratoNode.sucursales || []).map((s) => ({ id: s.id, nombre: s.nombre }));
  }, [formContratoNode]);
  const formSucursalNode = useMemo(() => {
    if (!formContratoNode || formSucursalId === null) return null;
    return (formContratoNode.sucursales || []).find((s: any) => Number(s.id) === Number(formSucursalId)) ?? null;
  }, [formContratoNode, formSucursalId]);
  const formPuestoOptions = useMemo(() => {
    if (!formSucursalNode) return [];
    return (formSucursalNode.puestos || []).map((p: any) => ({ id: p.id, nombre: p.nombre }));
  }, [formSucursalNode]);

  const filteredIncidents = useMemo(() => {
    const s = searchText.trim().toLowerCase();
    return incidents.filter(i => {
      const ejecutivo = i.ejecutivo?.name || '';
      const clasif = i.clasificacion?.name || '';
      const matchesText = !s || (
        (i.descripcion || '').toLowerCase().includes(s) ||
        (i.nombre_responsable || '').toLowerCase().includes(s) ||
        (i.nombre_responsable_atencion || '').toLowerCase().includes(s) ||
        ejecutivo.toLowerCase().includes(s) ||
        clasif.toLowerCase().includes(s)
      );
      const incidentDate = convertDateTimestampToLocalString(new Date(i.fecha_incidente).toISOString() || '', false);
      const reportDate = convertDateTimestampToLocalString(new Date(i.fecha_reporte).toISOString() || '', false);
      const matchesFechaIncidente = !filterFechaIncidente || incidentDate === filterFechaIncidente;
      const matchesFechaReporte = !filterFechaReporte || reportDate === filterFechaReporte;
      return matchesText && matchesFechaIncidente && matchesFechaReporte;
    });
  }, [incidents, searchText, filterFechaIncidente, filterFechaReporte]);

  const handleMenuPress = () => setIsMenuVisible(true);
  const handleMenuClose = () => setIsMenuVisible(false);
  const handleHomePress = () => navigation.navigate('Home');

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'add': return <Ionicons name="add-sharp" size={20} color='#000000' />;
      case 'edit': return <Ionicons name="pencil" size={20} color='#FFFFFF' />;
      case 'delete': return <Ionicons name="trash" size={20} color='#FFFFFF' />;
      case 'incidents': return <Ionicons name="warning" size={25} color='#000000' />;
      case 'cancel': return <Ionicons name="close-sharp" size={20} color='#FFFFFF' />;
      case 'confirm': return <Ionicons name="checkmark-sharp" size={20} color='#FFFFFF' />;
      default: return <Ionicons name="close-sharp" size={20} color='#FFFFFF' />;
    }
  };

  const resetRefs = () => {
    ejecutivoRef.current = null;
    fechaIncidenteRef.current = '';
    fechaReporteRef.current = '';
    nombreResponsableRef.current = employee?.name || '';
    clasificacionRef.current = null;
    descripcionRef.current = '';
    nombreResponsableAtencionRef.current = '';
  };

  const startCreating = async () => {
    const horaAccion = await getHoraAccion();
    if (!horaAccion) {
      Alert.alert('Error', 'No se pudo obtener la hora');
      return;
    }
    const tree = await fetchMainStructure();
    await applyCurrentMarcaToFormHierarchy(tree);
    const today = isoDateOnly(new Date(horaAccion));
    setIsCreating(true);
    setTextFiles([]);
    setImageFiles([]);
    setAudioFiles([]);
    setVideoFiles([]);
    setNewIncident(prev => ({
      ...prev,
      id: null,
      id_local: '',
      estado: true,
      ejecutivo_id: null,
      fecha_incidente: today,
      fecha_reporte: today,
      nombre_responsable: employee?.name || '',
      clasificacion_id: null,
      descripcion: '',
      involucrados: [{ codigo: '', nombre: '' }],
      libro_fecha: today,
      libro_numero: '',
      nombre_responsable_atencion: '',
      solucion: '',
      fecha_solucion: '',
      fecha_real_solucion: '',
      costo_asociado: '',
      consecutivo_informe: '',
      link_informe: '',
      owned: false,
    }));
    resetRefs();
    fechaIncidenteRef.current = today;
    fechaReporteRef.current = today;
    nombreResponsableRef.current = employee?.name || '';
  };

  const cancelCreating = () => {
    setIsCreating(false);
    clearFormHierarchy();
    setTextFiles([]);
    setImageFiles([]);
    setAudioFiles([]);
    setVideoFiles([]);
  };

  const handleAddInvolucrado = () => {
    setNewIncident(prev => ({ ...prev, involucrados: [...prev.involucrados, { codigo: '', nombre: '' }] }));
  };

  const updateInvolucrado = (idx: number, field: 'codigo' | 'nombre', value: string) => {
    const update = (list: InvolucradoForm[]) => list.map((it, i) => (i === idx ? { ...it, [field]: value } : it));
    setNewIncident(prev => ({ ...prev, involucrados: update(prev.involucrados) }));
  };

  const removeInvolucrado = (idx: number) => {
    const update = (list: InvolucradoForm[]) => list.filter((_, i) => i !== idx);
    setNewIncident(prev => ({ ...prev, involucrados: update(prev.involucrados).length ? update(prev.involucrados) : [{ codigo: '', nombre: '' }] }));
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

  const handleSearchInvolucradoByCode = async () => {
    const codigo = codigoInvolucradoBusqueda.trim();
    if (!codigo) {
      Alert.alert('Aviso', 'Ingresa el código del empleado');
      return;
    }
    try {
      const empleado = await getEmpleadoByCodigo(codigo);
      const nombre = empleado?.nombre_completo || empleado?.nombre || '';
      const cod = codigo;
      const nuevo = { codigo: cod, nombre: nombre || cod || codigo };
      setNewIncident(prev => ({ ...prev, involucrados: [...prev.involucrados, nuevo] }));
      setCodigoInvolucradoBusqueda('');
    } catch (e: unknown) {
      Alert.alert('Error', (e as Error)?.message || 'No se pudo buscar el empleado por código');
    }
  };

  const handleAddFile = async (type: ManualFileLocal['type']) => {
    try {
      let pickerTypes: string | string[] | undefined;
      switch (type) {
        case 'image':
          pickerTypes = ['image/*']; break;
        case 'audio':
          pickerTypes = ['audio/*']; break;
        case 'video':
          pickerTypes = ['video/*']; break;
        case 'document':
        default:
          pickerTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain',
            'text/csv',
          ];
          break;
      }

      const result = await DocumentPicker.getDocumentAsync({
        type: pickerTypes,
        multiple: false,
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];

      let extension = '';
      if (asset.name && asset.name.includes('.')) extension = asset.name.split('.').pop() || '';
      else if (asset.mimeType && asset.mimeType.includes('/')) extension = asset.mimeType.split('/').pop() || '';
      const ext = extension || 'dat';

      const localFileName = await saveFile({
        uri: asset.uri,
        originalName: asset.name || `archivo.${ext}`,
        extension: ext,
        type: mapManualTypeToStored(type),
        prefix: 'incident',
      });

      const localId = `local_file_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const file: ManualFileLocal = {
        id: localId,
        type,
        name: asset.name || `archivo.${ext}`,
        extension: ext,
        base64: '',
        localFileName,
        uri: asset.uri,
        mimeType: asset.mimeType,
      };

      if (type === 'image') setImageFiles(prev => [...prev, file]);
      else if (type === 'audio') setAudioFiles(prev => [...prev, file]);
      else if (type === 'video') setVideoFiles(prev => [...prev, file]);
      else setTextFiles(prev => [...prev, file]);
    } catch (e) {
      console.error('Error picking file for incident:', e);
      Alert.alert('Error', 'No se pudo seleccionar el archivo. Intenta nuevamente.');
    }
  };

  const removeLocalFile = (type: ManualFileLocal['type'], id: string) => {
    const take = (prev: ManualFileLocal[]) => prev.find((f) => f.id === id);
    let toDel: ManualFileLocal | undefined;
    if (type === 'image') toDel = take(imageFiles);
    else if (type === 'audio') toDel = take(audioFiles);
    else if (type === 'video') toDel = take(videoFiles);
    else toDel = take(textFiles);
    if (toDel?.localFileName) {
      void deleteFile(toDel.localFileName);
    }
    if (type === 'image') setImageFiles((prev) => prev.filter((f) => f.id !== id));
    else if (type === 'audio') setAudioFiles((prev) => prev.filter((f) => f.id !== id));
    else if (type === 'video') setVideoFiles((prev) => prev.filter((f) => f.id !== id));
    else setTextFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const validateCreate = () => {
    if (!fechaIncidenteRef.current) return 'La fecha del incidente es obligatoria';
    if (!fechaReporteRef.current) return 'La fecha del reporte es obligatoria';
    if (!nombreResponsableRef.current.trim()) return 'El nombre de quien reporta es obligatorio';
    if (!clasificacionRef.current) return 'La clasificación es obligatoria';
    if (!descripcionRef.current.trim()) return 'La descripción es obligatoria';
    if (!nombreResponsableAtencionRef.current.trim()) return 'El nombre del responsable de atención es obligatorio';
    return null;
  };

  /** Incluye `local_file_name` o base64; `createIncident` hidrata `local_file_name` antes del POST. */
  const buildArchivosPayloadString = (): string => {
    const files = [...textFiles, ...imageFiles, ...audioFiles, ...videoFiles];
    const items: IncidentFileInput[] = files.map((f) =>
      f.localFileName
        ? {
            type: f.type,
            extension: f.extension,
            original_name: f.name,
            file_base64: '',
            mimeType: f.mimeType,
            local_file_name: f.localFileName,
          }
        : {
            type: f.type,
            extension: f.extension,
            original_name: f.name,
            file_base64: f.base64,
            mimeType: f.mimeType,
          }
    );
    return JSON.stringify(items);
  };

  const createLocalCacheIncident = async (
    localId: string,
    corpoId: number,
    hierarchy: {
      empresa_id: number;
      division_id: number;
      contrato_id: number;
      cliente_id: number;
      corpo_id: number;
      puesto_id: number;
    }
  ) => {
    const exec = executives.find(e => e.id === ejecutivoRef.current) || null;
    const clas = classifications.find(c => c.id === clasificacionRef.current) || null;
    const horaAccion = await getHoraAccion();

    const files = [...textFiles, ...imageFiles, ...audioFiles, ...videoFiles].map(f => ({
      id: Date.now() + Math.random(),
      id_local: f.id,
      name: f.name,
      original_name: f.name,
      type: f.type,
      extension: f.extension,
      base64: f.base64,
      local_file_name: f.localFileName,
      mimeType: f.mimeType,
    }));

    const libro = {
      numero: newIncident.libro_numero,
      fecha: newIncident.libro_fecha,
    };

    const incidentCache: Incident = {
      id: 0,
      corpo_id: corpoId,
      sucursal_id: corpoId,
      empresa_id: hierarchy.empresa_id,
      division_id: hierarchy.division_id,
      contrato_id: hierarchy.contrato_id,
      cliente_id: hierarchy.cliente_id,
      puesto_id: hierarchy.puesto_id,
      isActive: true,
      estado: true,
      ejecutivo: { id: ejecutivoRef.current || 0, name: exec?.nombre || '' },
      fecha_incidente: fechaIncidenteRef.current,
      fecha_reporte: fechaReporteRef.current,
      nombre_responsable: nombreResponsableRef.current,
      clasificacion: { id: clasificacionRef.current || 0, name: clas?.nombre || '' },
      descripcion: descripcionRef.current,
      involucrados: newIncident.involucrados.map(i => ({ codigo: i.codigo || '', nombre: i.nombre })),
      fecha_libro_novedades: libro,
      nombre_responsable_atencion: nombreResponsableAtencionRef.current,
      solucion: '',
      fecha_solucion: '',
      fecha_solucion_real: '',
      costo_asociado: '',
      consecutivo_informe: '',
      link_informe: '',
      files: files as any,
      id_local: localId,
      owned: true, // El usuario que crea el incidente puede editarlo
    };

    const cache = (await getIncidentsCache()) || [];
    await setIncidentsCache([...cache, incidentCache]);
    setIncidents(prev => filterIncidentsByCorpo([...prev, incidentCache], corpoId));
  };

  const handleCreate = async () => {
    const validation = validateCreate();
    if (validation) {
      setSubmitResponse({ type: 'error', message: validation });
      return;
    }

    setIsSubmitting(true);
    setSubmitResponse(null);

    try {
      const marcaId = await getCurrentMarcaId();
      if (!marcaId) {
        setSubmitResponse({ type: 'error', message: 'No se encontró la marca actual' });
        setIsSubmitting(false);
        return;
      }

      const hierarchy = resolveCreateHierarchyIds();
      if (!hierarchy) {
        setSubmitResponse({
          type: 'error',
          message: 'Seleccione puesto en la jerarquía (empresa → sucursal → puesto) o verifique la marca y la estructura en caché.',
        });
        setIsSubmitting(false);
        return;
      }
      const corpoResolved = hierarchy.corpo_id;

      const payload: CreateIncidentRequest = {
        marca_id: marcaId,
        empresa_id: hierarchy.empresa_id,
        division_id: hierarchy.division_id,
        contrato_id: hierarchy.contrato_id,
        cliente_id: hierarchy.cliente_id,
        corpo_id: corpoResolved,
        sucursal_id: corpoResolved,
        puesto_id: hierarchy.puesto_id,
        empleado_id: ejecutivoRef.current!,
        fecha_incidente: fechaIncidenteRef.current,
        fecha_reporte: fechaReporteRef.current,
        nombre_responsable: nombreResponsableRef.current,
        clasificacion_id: clasificacionRef.current!,
        descripcion: descripcionRef.current,
        involucrados: JSON.stringify(newIncident.involucrados.map(i => ({ codigo: i.codigo || '', nombre: i.nombre }))),
        fecha_libro_novedades: JSON.stringify({ numero: newIncident.libro_numero, fecha: newIncident.libro_fecha }),
        nombre_responsable_atencion: nombreResponsableAtencionRef.current,
        archivos: buildArchivosPayloadString(),
      };

      const isConnected = await getConnectionStatus();
      if (isConnected) {
        const res = await createIncident({ requestData: payload, refreshAccessToken, logout });
        if (res.status) {
          const newId = res.incidentId ?? res.id;
          if (newId && corpoResolved) {
            const exec = executives.find(e => e.id === ejecutivoRef.current) || null;
            const clas = classifications.find(c => c.id === clasificacionRef.current) || null;
            const filesForCache = [...textFiles, ...imageFiles, ...audioFiles, ...videoFiles].map(f => ({
              id: newId * 1000 + Math.floor(Math.random() * 9999),
              id_local: f.id,
              name: f.name,
              original_name: f.name,
              type: f.type,
              extension: f.extension,
              base64: f.base64,
              local_file_name: f.localFileName,
              mimeType: f.mimeType,
            }));
            const newInc: Incident = {
              id: newId,
              corpo_id: corpoResolved,
              sucursal_id: corpoResolved,
              empresa_id: hierarchy.empresa_id,
              division_id: hierarchy.division_id,
              contrato_id: hierarchy.contrato_id,
              cliente_id: hierarchy.cliente_id,
              puesto_id: hierarchy.puesto_id,
              isActive: true,
              estado: true,
              ejecutivo: { id: ejecutivoRef.current || 0, name: exec?.nombre || '' },
              fecha_incidente: fechaIncidenteRef.current,
              fecha_reporte: fechaReporteRef.current,
              nombre_responsable: nombreResponsableRef.current,
              clasificacion: { id: clasificacionRef.current || 0, name: clas?.nombre || '' },
              descripcion: descripcionRef.current,
              involucrados: newIncident.involucrados.map(i => ({ codigo: i.codigo || '', nombre: i.nombre })),
              fecha_libro_novedades: { numero: newIncident.libro_numero, fecha: newIncident.libro_fecha },
              nombre_responsable_atencion: nombreResponsableAtencionRef.current,
              solucion: '',
              fecha_solucion: '',
              fecha_solucion_real: '',
              costo_asociado: '',
              consecutivo_informe: '',
              link_informe: '',
              files: filesForCache as any,
              id_local: '',
              owned: true,
            };
            const prev = (await getIncidentsCache()) || [];
            const merged = mergeIncidentsCacheForCorpo(prev, [newInc], corpoResolved);
            await setIncidentsCache(merged);
          }
          setSubmitResponse({ type: 'success', message: res.message || 'Incidente creado correctamente' });
          setTimeout(async () => {
            for (const f of [...textFiles, ...imageFiles, ...audioFiles, ...videoFiles]) {
              if (f.localFileName) {
                try {
                  await deleteFile(f.localFileName);
                } catch {
                  /* ya subido a servidor; limpieza best-effort */
                }
              }
            }
            setIsCreating(false);
            clearFormHierarchy();
            setTextFiles([]); setImageFiles([]); setAudioFiles([]); setVideoFiles([]);
            await fetchAll();
          }, 2000);
        } else {
          setSubmitResponse({ type: 'error', message: res.message || 'No se pudo crear el incidente' });
        }
        return;
      }

      // Offline
      const corpoIdOff = corpoResolved;
      if (!corpoIdOff) {
        setSubmitResponse({ type: 'error', message: 'No se encontró la sucursal (corporación) para el registro.' });
        setIsSubmitting(false);
        return;
      }

      const localId = generateRandomId();
      const actionsStr = await AsyncStorage.getItem('incidents_actions');
      const actions = actionsStr ? JSON.parse(actionsStr) : [];
      actions.push({
        requestData: payload,
        marcaId,
        corpoId: corpoIdOff,
        id: localId,
        type: 'create',
      });
      await AsyncStorage.setItem('incidents_actions', JSON.stringify(actions));

      await createLocalCacheIncident(localId, corpoIdOff, hierarchy);

      setSubmitResponse({ type: 'success', message: 'Incidente registrado localmente. Se sincronizará cuando haya conexión.' });
      setTimeout(() => {
        setIsCreating(false);
        clearFormHierarchy();
        setTextFiles([]); setImageFiles([]); setAudioFiles([]); setVideoFiles([]);
      }, 2000);
    } catch (e) {
      console.error('Error creating incident:', e);
      setSubmitResponse({ type: 'error', message: 'No se pudo crear el incidente' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateWithConfirm = () => {
    if (isSubmitting) return;
    const validation = validateCreate();
    if (validation) {
      setSubmitResponse({ type: 'error', message: validation });
      return;
    }
    Alert.alert('Confirmar', '¿Estás seguro de que deseas crear este incidente?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Aceptar', onPress: () => void handleCreate() },
    ]);
  };

  const executeDeleteIncident = async (incident: Incident) => {
    setDeletingIncidentKey(incidentRowKey(incident));
    try {
      const isConnected = await getConnectionStatus();
      if (isConnected) {
        const res = await deleteIncident({ incidentId: incident.id, refreshAccessToken, logout });
        if (res.status) {
          Alert.alert('Éxito', res.message || 'Incidente eliminado');
          await fetchAll();
        } else {
          Alert.alert('Error', res.message || 'No se pudo eliminar');
        }
        return;
      }

      const actionsStr = await AsyncStorage.getItem('incidents_actions');
      const actions = actionsStr ? JSON.parse(actionsStr) : [];

      if (incident.id_local && incident.id_local !== '') {
        // Borrador: quitar el "create" (y cualquier "update" con el mismo id local), no encolar "delete".
        const filteredActions = actions.filter(
          (a: any) =>
            !(
              String(a.id) === String(incident.id_local) &&
              (a.type === 'create' || a.type === 'update')
            )
        );
        const contribStr = await AsyncStorage.getItem(INCIDENT_CONTRIBUTIONS_ACTIONS_KEY);
        if (contribStr) {
          try {
            const cList = JSON.parse(contribStr);
            if (Array.isArray(cList)) {
              const nextC = cList.filter(
                (c: any) => String(c?.incidentLocalKey) !== String(incident.id_local)
              );
              await AsyncStorage.setItem(INCIDENT_CONTRIBUTIONS_ACTIONS_KEY, JSON.stringify(nextC));
            }
          } catch {
            /* ignore */
          }
        }
        await AsyncStorage.setItem('incidents_actions', JSON.stringify(filteredActions));
        const cache = (await getIncidentsCache()) || [];
        const updated = cache.filter((i) => i.id_local !== incident.id_local);
        await setIncidentsCache(updated);
        const corpoDel = await getActiveListCorpoId();
        setIncidents(filterIncidentsByCorpo(updated, corpoDel));
      } else {
        const filteredPre = actions.filter(
          (a: any) =>
            !(a.type === 'delete_file' && a.incidentId === incident.id)
        );
        filteredPre.push({ id: incident.id, type: 'delete' });
        await AsyncStorage.setItem('incidents_actions', JSON.stringify(filteredPre));
        const cache = (await getIncidentsCache()) || [];
        const updated = cache.filter((i) => i.id !== incident.id);
        await setIncidentsCache(updated);
        const corpoDel2 = await getActiveListCorpoId();
        setIncidents(filterIncidentsByCorpo(updated, corpoDel2));
      }

      Alert.alert('Modo Offline', 'Incidente eliminado localmente. Se sincronizará cuando haya conexión.');
    } catch (e) {
      console.error('Error deleting incident:', e);
      Alert.alert('Error', 'No se pudo eliminar el incidente');
    } finally {
      setDeletingIncidentKey(null);
    }
  };

  const handleDelete = (incident: Incident) => {
    Alert.alert('Confirmar eliminación', '¿Estás seguro de que deseas eliminar este incidente?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => void executeDeleteIncident(incident),
      },
    ]);
  };

  const patchIncidentFilesInCache = async (incidentId: number, fileId: number) => {
    const cache = (await getIncidentsCache()) || [];
    const next = cache.map((row) => {
      if (row.id !== incidentId) return row;
      const files = Array.isArray(row.files) ? row.files.filter((f: any) => f.id !== fileId) : [];
      return { ...row, files };
    });
    await setIncidentsCache(next);
    const corpo = await getActiveListCorpoId();
    setIncidents(filterIncidentsByCorpo(next, corpo));
  };

  const executeDeleteIncidentFile = async (inc: Incident, file: any) => {
    // Incidente creado solo en caché (id 0 + id_local): quitar archivo de caché, de la cola y del disco
    if (inc.id === 0 && inc.id_local) {
      try {
        if (file?.local_file_name) {
          try {
            await deleteFile(String(file.local_file_name));
          } catch {
            /* */
          }
        }
        const cache = (await getIncidentsCache()) || [];
        const next = cache.map((row) => {
          if (String(row.id_local) !== String(inc.id_local)) return row;
          const files = Array.isArray(row.files)
            ? row.files.filter((f: any) => {
                if (file?.id_local && f?.id_local) return String(f.id_local) !== String(file.id_local);
                return true;
              })
            : [];
          return { ...row, files };
        });
        await setIncidentsCache(next);
        const actionsStr = await AsyncStorage.getItem('incidents_actions');
        const actions: any[] = actionsStr ? JSON.parse(actionsStr) : [];
        const ai = actions.findIndex(
          (a: any) => a.type === 'create' && String(a.id) === String(inc.id_local)
        );
        if (ai !== -1) {
          const rd = { ...actions[ai].requestData };
          let arch: any[] = [];
          try {
            arch = typeof rd.archivos === 'string' ? JSON.parse(rd.archivos) : rd.archivos || [];
          } catch {
            arch = [];
          }
          if (Array.isArray(arch)) {
            const filtered = arch.filter((x: any) => {
              if (file?.local_file_name && x.local_file_name === file.local_file_name) return false;
              if (x.original_name && file?.original_name && x.original_name === file.original_name && x.type === file.type) {
                return false;
              }
              return true;
            });
            rd.archivos = JSON.stringify(filtered);
            actions[ai] = { ...actions[ai], requestData: rd };
            await AsyncStorage.setItem('incidents_actions', JSON.stringify(actions));
          }
        }
        const corpoD = await getActiveListCorpoId();
        setIncidents(filterIncidentsByCorpo(next, corpoD));
      } catch (e) {
        console.error('delete draft incident file', e);
        Alert.alert('Error', 'No se pudo eliminar el archivo del borrador');
      }
      return;
    }

    const fid = Number(file?.id);
    if (!Number.isFinite(fid) || fid <= 0) return;
    if (!inc.id || inc.id <= 0) {
      Alert.alert('Aviso', 'Solo se pueden eliminar archivos de incidentes ya sincronizados.');
      return;
    }
    if (file?.id_local) {
      Alert.alert('Aviso', 'No se puede eliminar un archivo pendiente de subida de esta forma.');
      return;
    }
    try {
      const isConnected = await getConnectionStatus();
      if (isConnected) {
        const res = await deleteIncidentFile({ incidentId: inc.id, fileId: fid, refreshAccessToken, logout });
        if (res.status) {
          await patchIncidentFilesInCache(inc.id, fid);
        } else {
          Alert.alert('Error', res.message || 'No se pudo eliminar el archivo');
        }
        return;
      }
      const actionsStr = await AsyncStorage.getItem('incidents_actions');
      const actions = actionsStr ? JSON.parse(actionsStr) : [];
      actions.push({ type: 'delete_file', incidentId: inc.id, fileId: fid });
      await AsyncStorage.setItem('incidents_actions', JSON.stringify(actions));
      await patchIncidentFilesInCache(inc.id, fid);
      Alert.alert('Modo Offline', 'Eliminación de archivo encolada. Se sincronizará con conexión.');
    } catch (e) {
      console.error('delete incident file', e);
      Alert.alert('Error', 'No se pudo eliminar el archivo');
    }
  };

  const handleRequestDeleteIncidentFile = (inc: Incident, file: any) => {
    Alert.alert('Eliminar archivo', '¿Desea eliminar permanentemente este archivo?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => void executeDeleteIncidentFile(inc, file) },
    ]);
  };

  const readContributionActions = async (): Promise<any[]> => {
    const str = await AsyncStorage.getItem(INCIDENT_CONTRIBUTIONS_ACTIONS_KEY);
    if (!str) return [];
    try {
      const parsed = JSON.parse(str);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const writeContributionActions = async (actions: any[]) => {
    await AsyncStorage.setItem(INCIDENT_CONTRIBUTIONS_ACTIONS_KEY, JSON.stringify(actions));
  };

  const updateIncidentAportesInIncidentsCache = async (
    ref: { id?: number; id_local?: string },
    updater: (current: IncidentContribution[]) => IncidentContribution[]
  ) => {
    const cache = (await getIncidentsCache()) || [];
    const updatedCache = cache.map((inc) => {
      const matchById = ref.id != null && ref.id > 0 && inc.id === ref.id;
      const matchByLocal = ref.id_local && String(inc.id_local) === String(ref.id_local);
      if (matchById || matchByLocal) {
        const currentAportes = Array.isArray((inc as any).aportes) ? (inc as any).aportes : [];
        return { ...inc, aportes: updater(currentAportes) };
      }
      return inc;
    });
    await setIncidentsCache(updatedCache);

    const corpoAportes = await getActiveListCorpoId();
    setIncidents(filterIncidentsByCorpo(updatedCache, corpoAportes));
  };

  const getIncidentAportesFromCache = async (incidentId: number): Promise<IncidentContribution[]> => {
    const cache = (await getIncidentsCache()) || [];
    const found = cache.find((i) => i.id === incidentId);
    const aportesArr = Array.isArray((found as any)?.aportes) ? (found as any).aportes : [];
    return aportesArr;
  };

  const getIncidentAportesFromCacheForRow = async (inc: Incident): Promise<IncidentContribution[]> => {
    const cache = (await getIncidentsCache()) || [];
    const found =
      inc.id && inc.id > 0
        ? cache.find((i) => i.id === inc.id)
        : cache.find((i) => i.id_local && i.id_local === inc.id_local);
    const aportesArr = Array.isArray((found as any)?.aportes) ? (found as any).aportes : [];
    return aportesArr;
  };

  const fetchAportesForIncident = async (inc: Incident) => {
    try {
      setIsLoadingAportes(true);
      const isConnected = await getConnectionStatus();

      if (!isConnected || !inc.id || inc.id <= 0) {
        const offlineAportes = await getIncidentAportesFromCacheForRow(inc);
        setAportes(offlineAportes);
        return;
      }

      const res = await listIncidentContributions({ incidentId: inc.id, refreshAccessToken, logout });
      if (res.status && res.contributions) {
        // Requerimiento: al GET exitoso reescribir incidente.aportes en incidents_cache
        // pero manteniendo aportes locales pendientes (id_local != '')
        const currentFromCache = await getIncidentAportesFromCache(inc.id);
        const pendingLocal = currentFromCache.filter((a: any) => a?.id_local && a.id_local !== '');
        const merged = [...pendingLocal, ...res.contributions];

        setAportes(merged);
        await updateIncidentAportesInIncidentsCache({ id: inc.id, id_local: inc.id_local }, () => merged);
      } else {
        Alert.alert('Error', res.message || 'No se pudieron cargar los aportes');
      }
    } catch (e) {
      console.error('Error fetching aportes:', e);
    } finally {
      setIsLoadingAportes(false);
    }
  };

  const openAportesModal = async (incident: Incident) => {
    setSelectedIncidentForAportes(incident);
    setIsAportesVisible(true);
    setEditingAporte(null);
    setShowAporteComposer(false);
    setAporteText('');
    setAporteNombrePersonalizado('');
    setAporteFirmaManual(null);
    setAporteTextFiles([]);
    setAporteImageFiles([]);
    setAporteAudioFiles([]);
    setAporteVideoFiles([]);
    await loadCurrentRoleFromMarca();
    await fetchAportesForIncident(incident);
  };

  const closeAportesModal = () => {
    setIsAportesVisible(false);
    setSelectedIncidentForAportes(null);
    setEditingAporte(null);
    setShowAporteComposer(false);
    setAporteText('');
    setAporteNombrePersonalizado('');
    setAporteFirmaManual(null);
    setAporteTextFiles([]);
    setAporteImageFiles([]);
    setAporteAudioFiles([]);
    setAporteVideoFiles([]);
    setAportes([]);
    setIsAporteSignatureModalVisible(false);
    setIsReadingAporteSignature(false);
  };

  const handleAddAporteFile = async (type: ManualFileLocal['type']) => {
    try {
      let pickerTypes: string | string[] | undefined;
      switch (type) {
        case 'image':
          pickerTypes = ['image/*']; break;
        case 'audio':
          pickerTypes = ['audio/*']; break;
        case 'video':
          pickerTypes = ['video/*']; break;
        case 'document':
        default:
          pickerTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain',
            'text/csv',
          ];
          break;
      }

      const result = await DocumentPicker.getDocumentAsync({
        type: pickerTypes,
        multiple: false,
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];

      let extension = '';
      if (asset.name && asset.name.includes('.')) extension = asset.name.split('.').pop() || '';
      else if (asset.mimeType && asset.mimeType.includes('/')) extension = asset.mimeType.split('/').pop() || '';
      const ext = extension || 'dat';

      const localFileName = await saveFile({
        uri: asset.uri,
        originalName: asset.name || `archivo.${ext}`,
        extension: ext,
        type: mapManualTypeToStored(type),
        prefix: 'incident_aporte',
      });

      const localId = `local_aporte_file_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const file: ManualFileLocal = {
        id: localId,
        type,
        name: asset.name || `archivo.${ext}`,
        extension: ext,
        base64: '',
        localFileName,
        uri: asset.uri,
        mimeType: asset.mimeType,
      };

      if (type === 'image') setAporteImageFiles(prev => [...prev, file]);
      else if (type === 'audio') setAporteAudioFiles(prev => [...prev, file]);
      else if (type === 'video') setAporteVideoFiles(prev => [...prev, file]);
      else setAporteTextFiles(prev => [...prev, file]);
    } catch (e) {
      console.error('Error picking file for aporte:', e);
      Alert.alert('Error', 'No se pudo seleccionar el archivo. Intenta nuevamente.');
    }
  };

  const removeAporteLocalFile = (type: ManualFileLocal['type'], id: string) => {
    const take = (prev: ManualFileLocal[]) => prev.find((f) => f.id === id);
    let toDel: ManualFileLocal | undefined;
    if (type === 'image') toDel = take(aporteImageFiles);
    else if (type === 'audio') toDel = take(aporteAudioFiles);
    else if (type === 'video') toDel = take(aporteVideoFiles);
    else toDel = take(aporteTextFiles);
    if (toDel?.localFileName) {
      void deleteFile(toDel.localFileName);
    }
    if (type === 'image') setAporteImageFiles((prev) => prev.filter((f) => f.id !== id));
    else if (type === 'audio') setAporteAudioFiles((prev) => prev.filter((f) => f.id !== id));
    else if (type === 'video') setAporteVideoFiles((prev) => prev.filter((f) => f.id !== id));
    else setAporteTextFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const buildAporteArchivosPayload = (): IncidentContributionFileInput[] => {
    const all = [...aporteTextFiles, ...aporteImageFiles, ...aporteAudioFiles, ...aporteVideoFiles];
    return all.map((f) =>
      f.localFileName
        ? {
            type: f.type,
            extension: f.extension,
            original_name: f.name,
            file_base64: '',
            mimeType: f.mimeType,
            local_file_name: f.localFileName,
          }
        : {
            type: f.type,
            extension: f.extension,
            original_name: f.name,
            file_base64: f.base64,
            mimeType: f.mimeType,
          }
    ) as IncidentContributionFileInput[];
  };

  const buildAportePayloadWithSignature = (): IncidentContributionFileInput[] => {
    // La firma ya no se incluye como archivo, se envía directamente en firma_aporte_tercero
    return buildAporteArchivosPayload();
  };

  const getContributionSignatureUri = (incidentId: number, contribution: IncidentContribution): string | null => {
    // Leer desde firma_aporte_tercero en lugar de buscar archivo
    // La firma se guarda tal cual como viene del SignatureScreen (con prefijo data:image/png;base64,)
    // Igual que en DigitalSignatureScreen.tsx donde se guarda manualSignature directamente
    const firmaBase64 = (contribution as any).firma_aporte_tercero;
    if (firmaBase64 && typeof firmaBase64 === 'string' && firmaBase64.trim().length > 0) {
      return firmaBase64.trim();
    }
    return null;
  };

  const openAporteSignatureModal = () => {
    setIsReadingAporteSignature(false);
    setSignatureAporteKey((k) => k + 1);
    setIsAporteSignatureModalVisible(true);
  };

  const closeAporteSignatureModal = () => {
    setIsAporteSignatureModalVisible(false);
    setIsReadingAporteSignature(false);
  };

  const clearAporteSignatureInModal = () => {
    try {
      signatureAporteRef.current?.clearSignature?.();
    } catch {
      // ignore
    }
    setIsReadingAporteSignature(false);
    setSignatureAporteKey((k) => k + 1);
  };

  const acceptAporteSignature = () => {
    try {
      setIsReadingAporteSignature(true);
      signatureAporteRef.current?.readSignature?.();
    } catch {
      setIsReadingAporteSignature(false);
      Alert.alert('Error', 'No se pudo leer la firma. Intenta nuevamente.');
    }
  };

  const handleAporteSignatureRead = (signature: string) => {
    const sig = String(signature || '').trim();
    if (!sig || sig.length < 10) {
      Alert.alert('Error', 'No se detectó la firma. Intenta de nuevo.');
      setIsReadingAporteSignature(false);
      return;
    }
    // Guardar la firma tal como viene del SignatureScreen (ya incluye el prefijo data:image/png;base64,)
    setAporteFirmaManual(sig);
    setIsReadingAporteSignature(false);
    closeAporteSignatureModal();
  };

  const submitAporte = async () => {
    if (!selectedIncidentForAportes) return;
    if (!employee) return;

    const texto = (aporteText || '').trim();
    const nombreAporte = (aporteNombrePersonalizado || '').trim();
    if (texto.length === 0) {
      Alert.alert('Error', 'Debes escribir un aporte');
      return;
    }

    setIsSubmittingAporte(true);

    try {
      const horaAccion = await getHoraAccion();
      if (!horaAccion) {
        Alert.alert('Error', 'No se pudo obtener la hora');
        return;
      }
      const incidentId = selectedIncidentForAportes.id;
      const role = normalizeRoleName(currentRoleName);

      const isConnected = await getConnectionStatus();

      // EDIT aporte solo local: fusionar en el "create" pendiente (no duplicar ni encolar "update").
      if (editingAporte && editingAporte.id_local && editingAporte.id_local !== '') {
        const payloadFiles = buildAportePayloadWithSignature();
        const actions = await readContributionActions();
        const idx = actions.findIndex((x: any) => x.type === 'create' && x.id === editingAporte.id_local);
        if (idx !== -1) {
          const prev = actions[idx].requestData || {};
          actions[idx] = {
            ...actions[idx],
            requestData: {
              ...prev,
              aporte: texto,
              nombre_aporte: nombreAporte || null,
              firma_aporte_tercero: aporteFirmaManual || null,
              rol_aporte: prev.rol_aporte || role || 'OPERATIVO',
              archivos: JSON.stringify(payloadFiles),
            },
          };
          await writeContributionActions(actions);
        }

        const updated = aportes.map((ap) => {
          if (ap.id_local !== editingAporte.id_local) return ap;
          return {
            ...ap,
            aporte: texto,
            nombre_aporte: nombreAporte || null,
            firma_aporte_tercero: aporteFirmaManual ?? null,
            files: [...payloadFiles].map((f, fidx) => ({
              id: Date.now() + Math.random() + fidx,
              id_local: `lf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              name: f.original_name || 'archivo',
              original_name: f.original_name || 'archivo',
              type: f.type,
              extension: f.extension,
              base64: f.file_base64,
              mimeType: f.mimeType,
            })),
          } as any;
        });
        setAportes(updated);
        await updateIncidentAportesInIncidentsCache(
          { id: selectedIncidentForAportes.id, id_local: selectedIncidentForAportes.id_local },
          () => updated
        );

        setEditingAporte(null);
        setShowAporteComposer(false);
        setAporteText('');
        setAporteNombrePersonalizado('');
        setAporteFirmaManual(null);
        setAporteTextFiles([]);
        setAporteImageFiles([]);
        setAporteAudioFiles([]);
        setAporteVideoFiles([]);

        Alert.alert('Modo Offline', 'Aporte actualizado localmente. Se sincronizará cuando haya conexión.');
        setIsSubmittingAporte(false);
        return;
      }

      // EDIT aporte en servidor
      if (editingAporte && editingAporte.id && editingAporte.id_local === '') {
        const can = canModifyAporte(editingAporte.rol_aporte, editingAporte.empleado_id, parseInt(String(employee.id || '0'), 10), currentRoleName);
        if (!can) {
          Alert.alert('Sin permiso', 'No puedes editar este aporte');
          setIsSubmittingAporte(false);
          return;
        }

        if (isConnected) {
          // Usar la firma directamente tal como viene del SignatureScreen (con prefijo data:image/png;base64,)
          // Igual que en DigitalSignatureScreen.tsx donde se usa signature directamente
          const res = await updateIncidentContribution({
            incidentId,
            contributionId: editingAporte.id,
            requestData: {
              aporte: texto,
              nombre_aporte: nombreAporte || null,
              firma_aporte_tercero: aporteFirmaManual || null,
              archivos: buildAportePayloadWithSignature(),
            },
            refreshAccessToken,
            logout,
          });

          if (res.status) {
            setEditingAporte(null);
            setShowAporteComposer(false);
            setAporteText('');
            setAporteNombrePersonalizado('');
            setAporteFirmaManual(null);
            setAporteTextFiles([]);
            setAporteImageFiles([]);
            setAporteAudioFiles([]);
            setAporteVideoFiles([]);
            if (selectedIncidentForAportes) await fetchAportesForIncident(selectedIncidentForAportes);
          } else {
            Alert.alert('Error', res.message || 'No se pudo actualizar el aporte');
          }
          setIsSubmittingAporte(false);
          return;
        }

        // Offline update (solo texto / agrega archivos) -> queue
        // Usar la firma directamente tal como viene del SignatureScreen
        const actions = await readContributionActions();
        actions.push({
          type: 'update',
          incidentId,
          contributionId: editingAporte.id,
          requestData: {
            aporte: texto,
            nombre_aporte: nombreAporte || null,
            firma_aporte_tercero: aporteFirmaManual || null,
            archivos: JSON.stringify(buildAportePayloadWithSignature()),
          },
        });
        await writeContributionActions(actions);

        // update cache + ui
        const updated = aportes.map((a) => (a.id === editingAporte.id ? { ...a, aporte: texto, nombre_aporte: nombreAporte || null } : a));
        setAportes(updated);
        await updateIncidentAportesInIncidentsCache(
          { id: selectedIncidentForAportes.id, id_local: selectedIncidentForAportes.id_local },
          () => updated
        );

        setEditingAporte(null);
        setShowAporteComposer(false);
        setAporteText('');
        setAporteNombrePersonalizado('');
        setAporteFirmaManual(null);
        setAporteTextFiles([]);
        setAporteImageFiles([]);
        setAporteAudioFiles([]);
        setAporteVideoFiles([]);

        Alert.alert('Modo Offline', 'Aporte actualizado localmente. Se sincronizará cuando haya conexión.');
        setIsSubmittingAporte(false);
        return;
      }

      // CREATE
      if (isConnected) {
        // Usar la firma directamente tal como viene del SignatureScreen (con prefijo data:image/png;base64,)
        // Igual que en DigitalSignatureScreen.tsx donde se usa signature directamente
        const res = await createIncidentContribution({
          incidentId,
          requestData: {
            aporte: texto,
            nombre_aporte: nombreAporte || null,
            firma_aporte_tercero: aporteFirmaManual || null,
            rol_aporte: role || 'OPERATIVO',
            archivos: buildAportePayloadWithSignature(),
          },
          refreshAccessToken,
          logout,
        });

        if (res.status) {
          // Requerimiento: cerrar modal al crear aporte
          closeAportesModal();
        } else {
          Alert.alert('Error', res.message || 'No se pudo crear el aporte');
        }
        setIsSubmittingAporte(false);
        return;
      }

      // Offline create
      // Usar la firma directamente tal como viene del SignatureScreen (con prefijo data:image/png;base64,)
      const localId = generateRandomId();
      const payloadFiles = buildAportePayloadWithSignature();
      const newLocal: IncidentContribution = {
        id: 0,
        incidente_id: incidentId,
        empleado_id: parseInt(String(employee.id || '0'), 10),
        empleado_nombre: employee.name || '',
        nombre_aporte: nombreAporte || null,
        aporte: texto,
        rol_aporte: role || 'OPERATIVO',
        created_at: new Date(horaAccion).toISOString(),
        files: [...payloadFiles].map((f) => ({
          id: Date.now() + Math.random(),
          id_local: `lf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          name: f.original_name || 'archivo',
          original_name: f.original_name || 'archivo',
          type: f.type,
          extension: f.extension,
          base64: f.file_base64,
          mimeType: f.mimeType,
        })),
        id_local: localId,
        firma_aporte_tercero: aporteFirmaManual || null,
      } as any;

      const actions = await readContributionActions();
      actions.push({
        type: 'create',
        id: localId,
        incidentId: incidentId > 0 ? incidentId : 0,
        incidentLocalKey:
          !incidentId || incidentId <= 0
            ? String(selectedIncidentForAportes?.id_local || '')
            : undefined,
        requestData: {
          aporte: texto,
          nombre_aporte: nombreAporte || null,
          firma_aporte_tercero: aporteFirmaManual || null,
          rol_aporte: role || 'OPERATIVO',
          archivos: JSON.stringify(payloadFiles),
        },
      });
      await writeContributionActions(actions);

      const next = [newLocal, ...aportes];
      setAportes(next);
      await updateIncidentAportesInIncidentsCache(
        { id: selectedIncidentForAportes.id, id_local: selectedIncidentForAportes.id_local },
        (current) => [newLocal, ...(current || [])]
      );

      setAporteText('');
      setAporteNombrePersonalizado('');
      setAporteFirmaManual(null);
      setAporteTextFiles([]);
      setAporteImageFiles([]);
      setAporteAudioFiles([]);
      setAporteVideoFiles([]);

      Alert.alert('Modo Offline', 'Aporte registrado localmente. Se sincronizará cuando haya conexión.');
      // Requerimiento: cerrar modal al crear aporte (offline)
      closeAportesModal();
    } catch (error) {
      console.error('Error submitting aporte:', error);
      Alert.alert('Error', 'No se pudo procesar el aporte');
    } finally {
      setIsSubmittingAporte(false);
    }
  };

  const submitAporteWithConfirm = () => {
    if (!selectedIncidentForAportes || !employee) return;
    if (isSubmittingAporte) return;
    const texto = (aporteText || '').trim();
    if (texto.length === 0) {
      Alert.alert('Error', 'Debes escribir un aporte');
      return;
    }
    const isEdit = editingAporte != null;
    Alert.alert(
      'Confirmar',
      isEdit ? '¿Guardar los cambios de este aporte?' : '¿Registrar este aporte?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Aceptar', onPress: () => void submitAporte() },
      ]
    );
  };

  const startEditingAporte = async (a: IncidentContribution) => {
    setEditingAporte(a);
    setShowAporteComposer(true);
    setAporteText(a.aporte || '');
    setAporteNombrePersonalizado((a as any).nombre_aporte || '');
    // Leer firma desde firma_aporte_tercero
    const firmaUri = getContributionSignatureUri(selectedIncidentForAportes?.id || 0, a);
    setAporteFirmaManual(firmaUri);
    setAporteTextFiles([]);
    setAporteImageFiles([]);
    setAporteAudioFiles([]);
    setAporteVideoFiles([]);
  };

  const executeDeleteAporte = async (a: IncidentContribution) => {
    if (!selectedIncidentForAportes) return;
    if (!employee) return;
    const incidentId = selectedIncidentForAportes.id;
    const rowKey = aporteRowKey(a);
    setDeletingAporteKey(rowKey);
    try {
      const isConnected = await getConnectionStatus();
      if (isConnected && a.id && a.id_local === '') {
        const res = await deleteIncidentContribution({ incidentId, contributionId: a.id, refreshAccessToken, logout });
        if (res.status) {
          await fetchAportesForIncident(selectedIncidentForAportes);
        } else {
          Alert.alert('Error', res.message || 'No se pudo eliminar');
        }
        return;
      }

      const actions = await readContributionActions();
      if (a.id_local && a.id_local !== '') {
        // Aporte solo local: quitar el "create" pendiente (id === id_local), no encolar "delete".
        const filtered = actions.filter(
          (x: any) => !(x.type === 'create' && String(x.id) === String(a.id_local))
        );
        await writeContributionActions(filtered);
      } else {
        actions.push({ type: 'delete', incidentId, contributionId: a.id });
        await writeContributionActions(actions);
      }

      const next = aportes.filter((x) => (a.id_local ? x.id_local !== a.id_local : x.id !== a.id));
      setAportes(next);
      await updateIncidentAportesInIncidentsCache(
        { id: selectedIncidentForAportes.id, id_local: selectedIncidentForAportes.id_local },
        () => next
      );

      Alert.alert('Modo Offline', 'Aporte eliminado localmente. Se sincronizará cuando haya conexión.');
    } catch (e) {
      console.error('Error deleting aporte:', e);
      Alert.alert('Error', 'No se pudo eliminar el aporte');
    } finally {
      setDeletingAporteKey(null);
    }
  };

  const deleteAporte = (a: IncidentContribution) => {
    if (!selectedIncidentForAportes) return;
    if (!employee) return;

    const can = canModifyAporte(a.rol_aporte, a.empleado_id, parseInt(String(employee.id || '0'), 10), currentRoleName);
    if (!can) {
      Alert.alert('Sin permiso', 'No puedes eliminar este aporte');
      return;
    }

    Alert.alert('Confirmar', '¿Eliminar este aporte?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => void executeDeleteAporte(a),
      },
    ]);
  };

  const renderDatePicker = (visible: boolean, onClose: () => void, onPick: (iso: string) => void) => {
    if (!visible) return null;
    return (
      <View style={styles.inlinePickerContainer}>
        <DateTimePicker
          value={pickerDateValue}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, selected) => {
            if (Platform.OS === 'android') onClose();
            if (!selected) return;
            setPickerDateValue(selected);
            onPick(isoDateOnly(selected));
          }}
        />
      </View>
    );
  };

  const renderFilesSection = () => {
    return (
      <ThemedView style={styles.formGroup}>
        <ThemedText style={styles.formLabel}>Agregar archivos</ThemedText>

        <ThemedView style={styles.fileIconButtonsRow}>
          <TouchableOpacity style={styles.fileIconButton} onPress={() => handleAddFile('image')}>
            <Ionicons name="image-outline" size={20} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.fileIconButton} onPress={() => handleAddFile('audio')}>
            <Ionicons name="mic-outline" size={20} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.fileIconButton} onPress={() => handleAddFile('video')}>
            <Ionicons name="videocam-outline" size={20} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.fileIconButton} onPress={() => handleAddFile('document')}>
            <Ionicons name="document-text-outline" size={20} color="#007AFF" />
          </TouchableOpacity>
        </ThemedView>

        {(textFiles.length + imageFiles.length + audioFiles.length + videoFiles.length) > 0 && (
          <ThemedView style={styles.filesList}>
            {/* Images with thumbnails */}
            {imageFiles.map(file => (
              <ThemedView key={file.id} style={styles.fileRow}>
                <Image
                  source={{
                    uri:
                      (file.localFileName ? getLocalFileDisplayUri(file.localFileName) : '') ||
                      `data:image/${file.extension || 'jpeg'};base64,${file.base64}`,
                  }}
                  style={styles.filePreviewImage}
                  resizeMode="cover"
                />
                <ThemedText numberOfLines={1} style={styles.fileName}>{file.name}</ThemedText>
                <TouchableOpacity onPress={() => removeLocalFile('image', file.id)}>
                  <Ionicons name="trash" size={16} color="#FF3B30" />
                </TouchableOpacity>
              </ThemedView>
            ))}

            {/* Audio */}
            {audioFiles.map(file => (
              <ThemedView key={file.id} style={styles.fileRow}>
                <Ionicons name="musical-notes-outline" size={16} color="#007AFF" />
                <ThemedText numberOfLines={1} style={styles.fileName}>{file.name}</ThemedText>
                <TouchableOpacity onPress={() => removeLocalFile('audio', file.id)}>
                  <Ionicons name="trash" size={16} color="#FF3B30" />
                </TouchableOpacity>
              </ThemedView>
            ))}

            {/* Video */}
            {videoFiles.map(file => (
              <ThemedView key={file.id} style={styles.fileRow}>
                <Ionicons name="videocam-outline" size={16} color="#007AFF" />
                <ThemedText numberOfLines={1} style={styles.fileName}>{file.name}</ThemedText>
                <TouchableOpacity onPress={() => removeLocalFile('video', file.id)}>
                  <Ionicons name="trash" size={16} color="#FF3B30" />
                </TouchableOpacity>
              </ThemedView>
            ))}

            {/* Documents */}
            {textFiles.map(file => (
              <ThemedView key={file.id} style={styles.fileRow}>
                <Ionicons name="document-text-outline" size={16} color="#007AFF" />
                <ThemedText numberOfLines={1} style={styles.fileName}>{file.name}</ThemedText>
                <TouchableOpacity onPress={() => removeLocalFile('document', file.id)}>
                  <Ionicons name="trash" size={16} color="#FF3B30" />
                </TouchableOpacity>
              </ThemedView>
            ))}
          </ThemedView>
        )}
      </ThemedView>
    );
  };

  const renderAporteFilesSection = () => {
    return (
      <ThemedView style={styles.formGroup}>
        <ThemedText style={styles.formLabel}>Agregar archivos</ThemedText>

        <ThemedView style={styles.fileIconButtonsRow}>
          <TouchableOpacity style={styles.fileIconButton} onPress={() => handleAddAporteFile('image')}>
            <Ionicons name="image-outline" size={20} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.fileIconButton} onPress={() => handleAddAporteFile('audio')}>
            <Ionicons name="mic-outline" size={20} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.fileIconButton} onPress={() => handleAddAporteFile('video')}>
            <Ionicons name="videocam-outline" size={20} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.fileIconButton} onPress={() => handleAddAporteFile('document')}>
            <Ionicons name="document-text-outline" size={20} color="#007AFF" />
          </TouchableOpacity>
        </ThemedView>

        {(aporteTextFiles.length + aporteImageFiles.length + aporteAudioFiles.length + aporteVideoFiles.length) > 0 && (
          <ThemedView style={styles.filesList}>
            {aporteImageFiles.map(file => (
              <ThemedView key={file.id} style={styles.fileRow}>
                <Image
                  source={{
                    uri:
                      (file.localFileName ? getLocalFileDisplayUri(file.localFileName) : '') ||
                      `data:image/${file.extension || 'jpeg'};base64,${file.base64}`,
                  }}
                  style={styles.filePreviewImage}
                  resizeMode="cover"
                />
                <ThemedText numberOfLines={1} style={styles.fileName}>{file.name}</ThemedText>
                <TouchableOpacity onPress={() => removeAporteLocalFile('image', file.id)}>
                  <Ionicons name="trash" size={16} color="#FF3B30" />
                </TouchableOpacity>
              </ThemedView>
            ))}

            {aporteAudioFiles.map(file => (
              <ThemedView key={file.id} style={styles.fileRow}>
                <Ionicons name="musical-notes-outline" size={16} color="#007AFF" />
                <ThemedText numberOfLines={1} style={styles.fileName}>{file.name}</ThemedText>
                <TouchableOpacity onPress={() => removeAporteLocalFile('audio', file.id)}>
                  <Ionicons name="trash" size={16} color="#FF3B30" />
                </TouchableOpacity>
              </ThemedView>
            ))}

            {aporteVideoFiles.map(file => (
              <ThemedView key={file.id} style={styles.fileRow}>
                <Ionicons name="videocam-outline" size={16} color="#007AFF" />
                <ThemedText numberOfLines={1} style={styles.fileName}>{file.name}</ThemedText>
                <TouchableOpacity onPress={() => removeAporteLocalFile('video', file.id)}>
                  <Ionicons name="trash" size={16} color="#FF3B30" />
                </TouchableOpacity>
              </ThemedView>
            ))}

            {aporteTextFiles.map(file => (
              <ThemedView key={file.id} style={styles.fileRow}>
                <Ionicons name="document-text-outline" size={16} color="#007AFF" />
                <ThemedText numberOfLines={1} style={styles.fileName}>{file.name}</ThemedText>
                <TouchableOpacity onPress={() => removeAporteLocalFile('document', file.id)}>
                  <Ionicons name="trash" size={16} color="#FF3B30" />
                </TouchableOpacity>
              </ThemedView>
            ))}
          </ThemedView>
        )}
      </ThemedView>
    );
  };

  const renderIncidentForm = (incident: EditingIncident) => {
    const formKey = incident.id_local || String(incident.id ?? 'new');

    return (
      <ThemedView style={[styles.card, styles.formCard]}>
        <ThemedText style={styles.formTitle}>Nuevo Incidente</ThemedText>

        {!isOperativoUser ? (
          <ThemedView style={styles.formGroup}>
            <ThemedText style={styles.formLabel}>Ubicación del registro (empresa → sucursal / corpo)</ThemedText>
            {isStructureLoading ? (
              <ThemedView style={styles.inlineLoadingRow}>
                <ActivityIndicator size="small" color="#007AFF" />
                <ThemedText style={styles.inlineLoadingText}>Cargando estructura...</ThemedText>
              </ThemedView>
            ) : (mainStructure ?? []).length === 0 ? (
              <ThemedText style={styles.emptyText}>Sin estructura en caché.</ThemedText>
            ) : (
              <HierarchyPickerFields
                structure={mainStructure}
                levels={['cliente', 'contrato', 'sucursal', 'puesto']}
                emptyPickerValue={0}
                values={{
                  empresaId: formEmpresaId,
                  clienteId: formClienteId,
                  divisionId: formDivisionId,
                  contratoId: formContratoId,
                  sucursalId: formSucursalId,
                  puestoId: formPuestoId,
                }}
                onChange={handleFormHierarchyChange}
                labels={{
                  empresa: 'Empresa *',
                  cliente: 'Cliente *',
                  division: 'División *',
                  contrato: 'Contrato *',
                  sucursal: 'Sucursal (corpo) *',
                  puesto: 'Puesto *',
                }}
                renderLabel={(text) => <ThemedText style={styles.formLabel}>{text}</ThemedText>}
                pickerStyle={styles.picker}
                fieldGroupStyle={styles.formGroup}
              />
            )}
          </ThemedView>
        ) : null}

        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Fecha del incidente:</ThemedText>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={ async () => { const horaAccion = await getHoraAccion(); if (!horaAccion) { Alert.alert('Error', 'No se pudo obtener la hora'); return; } setPickerDateValue(new Date(horaAccion)); setShowFechaIncidentePicker(true); }}
          >
            <ThemedText style={styles.dateButtonText}>{convertDateTimestampToLocalString(new Date(incident.fecha_incidente).toISOString() || '', false) || 'Seleccionar fecha'}</ThemedText>
            <Ionicons name="calendar" size={18} color="#007AFF" />
          </TouchableOpacity>
          {renderDatePicker(showFechaIncidentePicker, () => setShowFechaIncidentePicker(false), (iso) => {
            fechaIncidenteRef.current = iso;
            setNewIncident(prev => ({ ...prev, fecha_incidente: iso }));
          })}
        </ThemedView>

        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Fecha del reporte:</ThemedText>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={ async () => { const horaAccion = await getHoraAccion(); if (!horaAccion) { Alert.alert('Error', 'No se pudo obtener la hora'); return; } setPickerDateValue(new Date(horaAccion)); setShowFechaReportePicker(true); }}
          >
            <ThemedText style={styles.dateButtonText}>{convertDateTimestampToLocalString(new Date(incident.fecha_reporte).toISOString() || '', false) || 'Seleccionar fecha'}</ThemedText>
            <Ionicons name="calendar" size={18} color="#007AFF" />
          </TouchableOpacity>
          {renderDatePicker(showFechaReportePicker, () => setShowFechaReportePicker(false), (iso) => {
            fechaReporteRef.current = iso;
            setNewIncident(prev => ({ ...prev, fecha_reporte: iso }));
          })}
        </ThemedView>

        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Nombre de quien reporta la incidencia:</ThemedText>
          <TextInput
            style={styles.formInput}
            defaultValue={incident.nombre_responsable}
            onChangeText={(t) => { nombreResponsableRef.current = t; }}
            placeholder="Nombre completo"
            placeholderTextColor="#999"
            key={`nr-create-${formKey}`}
          />
        </ThemedView>

        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Clasificación:</ThemedText>
          <ThemedView style={styles.pickerContainer}>
            <Picker
              selectedValue={incident.clasificacion_id ?? 0}
              onValueChange={(val) => {
                const id = Number(val) || null;
                clasificacionRef.current = id;
                setNewIncident(prev => ({ ...prev, clasificacion_id: id }));
              }}
              style={styles.picker}
            >
              <Picker.Item label="Seleccionar..." value={0} color="#000000" />
              {classifications.map(c => (
                <Picker.Item key={c.id} label={c.nombre} value={c.id} color="#000000" />
              ))}
            </Picker>
          </ThemedView>
        </ThemedView>

        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Descripción del incidente:</ThemedText>
          <TextInput
            style={[styles.formInput, styles.textArea]}
            defaultValue={incident.descripcion}
            onChangeText={(t) => { descripcionRef.current = t; }}
            placeholder="Describe el incidente..."
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            key={`desc-create-${formKey}`}
          />
        </ThemedView>

        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Involucrados:</ThemedText>
          <View style={styles.codeRow}>
            <TextInput
              style={styles.codeInput}
              value={codigoInvolucradoBusqueda}
              onChangeText={setCodigoInvolucradoBusqueda}
              placeholder="Buscar empleado por código"
              placeholderTextColor="#999"
            />
            <TouchableOpacity style={styles.codeActionButton} onPress={handleSearchInvolucradoByCode} activeOpacity={0.85}>
              <ThemedText style={styles.codeActionButtonText}>Buscar</ThemedText>
            </TouchableOpacity>
          </View>
          {newIncident.involucrados.map((inv, idx) => (
            <ThemedView key={`create-inv-${idx}`} style={styles.involucradoRow}>
              <TextInput
                style={[styles.formInput, styles.smallInput]}
                defaultValue={inv.codigo}
                onChangeText={(t) => updateInvolucrado(idx, 'codigo', t)}
                placeholder="Código (opcional)"
                placeholderTextColor="#999"
              />
              <TextInput
                style={[styles.formInput, styles.flexInput]}
                defaultValue={inv.nombre}
                onChangeText={(t) => updateInvolucrado(idx, 'nombre', t)}
                placeholder="Nombre completo"
                placeholderTextColor="#999"
              />
              <TouchableOpacity onPress={() => removeInvolucrado(idx)}>
                <Ionicons name="close-circle" size={20} color="#FF3B30" />
              </TouchableOpacity>
            </ThemedView>
          ))}
          <TouchableOpacity style={styles.addSmallButton} onPress={handleAddInvolucrado}>
            <Ionicons name="add" size={18} color="#007AFF" />
            <ThemedText style={styles.addSmallButtonText}>Agregar involucrado</ThemedText>
          </TouchableOpacity>
        </ThemedView>

        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Fecha de libro de novedades y número de folio:</ThemedText>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={ async () => { const horaAccion = await getHoraAccion(); if (!horaAccion) { Alert.alert('Error', 'No se pudo obtener la hora'); return; } setPickerDateValue(new Date(horaAccion)); setShowLibroFechaPicker(true); }}
          >
            <ThemedText style={styles.dateButtonText}>{convertDateTimestampToLocalString(new Date(incident.libro_fecha).toISOString() || '', false) || 'Seleccionar fecha'}</ThemedText>
            <Ionicons name="calendar" size={18} color="#007AFF" />
          </TouchableOpacity>
          {renderDatePicker(showLibroFechaPicker, () => setShowLibroFechaPicker(false), (iso) => {
            setNewIncident(prev => ({ ...prev, libro_fecha: iso }));
          })}
          <TextInput
            style={styles.formInput}
            defaultValue={incident.libro_numero}
            onChangeText={(t) => {
              setNewIncident(prev => ({ ...prev, libro_numero: t }));
            }}
            placeholder="Número de folio"
            placeholderTextColor="#999"
          />
        </ThemedView>

        {renderFilesSection()}

        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Nombre del responsable de atención:</ThemedText>
          <TextInput
            style={styles.formInput}
            defaultValue={incident.nombre_responsable_atencion}
            onChangeText={(t) => { nombreResponsableAtencionRef.current = t; }}
            placeholder="Nombre completo"
            placeholderTextColor="#999"
            key={`nra-create-${formKey}`}
          />
        </ThemedView>

        {submitResponse && (
          <ThemedView style={[styles.responseContainer, submitResponse.type === 'success' ? styles.responseSuccess : styles.responseError]}>
            <ThemedText style={styles.responseText}>
              {submitResponse.type === 'success' ? '✓ ' : '✗ '}
              {submitResponse.message}
            </ThemedText>
          </ThemedView>
        )}
        <ThemedView style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.confirmButton, isSubmitting && styles.buttonDisabled]}
            onPress={handleCreateWithConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <ThemedText style={styles.confirmButtonText}>{getActionIcon('confirm')}</ThemedText>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.cancelButton, isSubmitting && styles.buttonDisabled]}
            onPress={cancelCreating}
            disabled={isSubmitting}
          >
            <ThemedText style={styles.cancelButtonText}>{getActionIcon('cancel')}</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </ThemedView>
    );
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader onMenuPress={handleMenuPress} title="Incidentes" />
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Cargando incidentes...</ThemedText>
        </ThemedView>
        <AppFooter />
        <SlideMenu isVisible={isMenuVisible} onClose={handleMenuClose} onHomePress={handleHomePress} currentRoute="Incidents" />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <AppHeader onMenuPress={handleMenuPress} title="Incidentes" />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <ThemedView style={styles.contentContainer}>
          <ThemedView style={styles.titleContainer}>
            <ThemedText type="title" style={styles.title}>
              {getActionIcon('incidents')} Incidentes
            </ThemedText>
            <ThemedText style={styles.subtitle}>Gestiona incidentes (online/offline)</ThemedText>
          </ThemedView>

          {error && (
            <ThemedView style={styles.errorBox}>
              <ThemedText style={styles.errorText}>{error}</ThemedText>
            </ThemedView>
          )}

          {!hasCurrentMarca && (
            <ThemedView style={styles.noMarcaContainer}>
              <ThemedText style={styles.noMarcaMessage}>
                No hay marca activa. Puede seleccionar la jerarquía manualmente en los filtros.
              </ThemedText>
            </ThemedView>
          )}

          {!isCreating && (
            <ThemedView style={styles.filtersMain}>
              <TouchableOpacity
                style={styles.filtersHeader}
                onPress={() => {
                  const next = !isFiltersExpanded;
                  setIsFiltersExpanded(next);
                  if (!next) {
                    setShowFilterFechaIncidentePicker(false);
                    setShowFilterFechaReportePicker(false);
                  }
                }}
              >
                <ThemedText style={styles.filtersHeaderText}>Filtros</ThemedText>
                <Ionicons name={isFiltersExpanded ? 'chevron-up' : 'chevron-down'} size={18} color="#007AFF" />
              </TouchableOpacity>
              {isFiltersExpanded && (
                <ThemedView style={styles.filterContent}>
                  {!isOperativoUser ? (
                    <>
                      <ThemedText style={styles.filterLabel}>
                        Ubicación del listado (empresa → sucursal / corpo)
                      </ThemedText>
                      {isStructureLoading ? (
                        <ThemedView style={styles.inlineLoadingRow}>
                          <ActivityIndicator size="small" color="#007AFF" />
                          <ThemedText style={styles.inlineLoadingText}>Cargando estructura...</ThemedText>
                        </ThemedView>
                      ) : (mainStructure ?? []).length === 0 ? (
                        <ThemedText style={styles.emptyText}>Sin estructura en caché.</ThemedText>
                      ) : (
                        <HierarchyPickerFields
                          structure={mainStructure}
                          levels={['cliente', 'contrato', 'sucursal']}
                          emptyPickerValue={0}
                          values={{
                            empresaId: filterEmpresaId,
                            clienteId: filterClienteId,
                            divisionId: filterDivisionId,
                            contratoId: filterContratoId,
                            sucursalId: filterSucursalId,
                          }}
                          onChange={handleFilterHierarchyChange}
                          labels={{ sucursal: 'Sucursal (sincroniza listado)' }}
                          renderLabel={(text) => <ThemedText style={styles.filterLabel}>{text}</ThemedText>}
                          pickerStyle={styles.picker}
                          fieldGroupStyle={styles.formGroup}
                        />
                      )}
                    </>
                  ) : null}

                  <ThemedText style={styles.filterLabel}>Buscar (responsables, ejecutivo, clasificación, descripción):</ThemedText>
                  <TextInput
                    style={styles.searchInput}
                    value={searchText}
                    onChangeText={setSearchText}
                    placeholder="Buscar..."
                    placeholderTextColor="#999"
                  />
                  <ThemedText style={styles.filterLabel}>Fecha incidente:</ThemedText>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={ async () => { const horaAccion = await getHoraAccion(); if (!horaAccion) { Alert.alert('Error', 'No se pudo obtener la hora'); return; } setPickerDateValue(new Date(horaAccion)); setShowFilterFechaIncidentePicker(true); }}
                  >
                    <ThemedText style={styles.dateButtonText}>
                      {filterFechaIncidente || 'Todas'}
                    </ThemedText>
                    <Ionicons name="calendar" size={18} color="#007AFF" />
                  </TouchableOpacity>
                  {renderDatePicker(
                    showFilterFechaIncidentePicker,
                    () => setShowFilterFechaIncidentePicker(false),
                    (iso) => setFilterFechaIncidente(String(iso || '').split('T')[0])
                  )}

                  <ThemedText style={styles.filterLabel}>Fecha reporte:</ThemedText>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={ async () => { const horaAccion = await getHoraAccion(); if (!horaAccion) { Alert.alert('Error', 'No se pudo obtener la hora'); return; } setPickerDateValue(new Date(horaAccion)); setShowFilterFechaReportePicker(true); }}
                  >
                    <ThemedText style={styles.dateButtonText}>
                      {filterFechaReporte || 'Todas'}
                    </ThemedText>
                    <Ionicons name="calendar" size={18} color="#007AFF" />
                  </TouchableOpacity>
                  {renderDatePicker(
                    showFilterFechaReportePicker,
                    () => setShowFilterFechaReportePicker(false),
                    (iso) => setFilterFechaReporte(String(iso || '').split('T')[0])
                  )}

                  <TouchableOpacity
                    style={styles.clearFiltersButton}
                    onPress={() => {
                      setSearchText('');
                      setFilterFechaIncidente('');
                      setFilterFechaReporte('');
                    }}
                  >
                    <Ionicons name="refresh" size={16} color="#FFFFFF" />
                    <ThemedText style={styles.clearFiltersButtonText}>Limpiar filtros</ThemedText>
                  </TouchableOpacity>
                </ThemedView>
              )}
            </ThemedView>
          )}

          {!isCreating && (
            <TouchableOpacity style={styles.createButton} onPress={startCreating}>
              <ThemedText style={styles.createButtonText}>{getActionIcon('add')}</ThemedText>
            </TouchableOpacity>
          )}

          {isCreating && renderIncidentForm(newIncident)}

          {!isCreating && (
            <ThemedView style={styles.listContainer}>
              {filteredIncidents.length === 0 ? (
                <ThemedView style={styles.emptyContainer}>
                  <ThemedText style={styles.emptyText}>
                    {incidents.length === 0 ? 'No hay incidentes registrados aún' : 'No se encontraron incidentes con ese filtro'}
                  </ThemedText>
                </ThemedView>
              ) : (
                filteredIncidents.map((i) => (
                  <ThemedView key={incidentRowKey(i)} style={styles.card}>
                    <ThemedView style={styles.cardHeader}>
                      <ThemedText style={styles.cardTitle}>Incidente #{i.id_local ? `LOCAL-${i.id_local}` : i.id}</ThemedText>
                      <ThemedText style={styles.badge}>{i.estado ? 'Activo' : 'Inactivo'}</ThemedText>
                    </ThemedView>
                    <ThemedText style={styles.cardInfo}>Clasificación: {i.clasificacion?.name || '-'}</ThemedText>
                    <ThemedText style={styles.cardInfo}>Fecha incidente: {convertDateTimestampToLocalString(new Date(i.fecha_incidente).toISOString() || '', false)}</ThemedText>
                    <ThemedText style={styles.cardInfo}>Fecha reporte: {convertDateTimestampToLocalString(new Date(i.fecha_reporte).toISOString() || '', false)}</ThemedText>
                    <ThemedText style={styles.cardInfo}>Reporta: {i.nombre_responsable || '-'}</ThemedText>
                    <ThemedText style={styles.cardInfo}>Atención: {i.nombre_responsable_atencion || '-'}</ThemedText>
                    <ThemedText style={styles.cardInfo} numberOfLines={3}>Descripción: {i.descripcion || '-'}</ThemedText>

                    {Array.isArray(i.files) && i.files.length > 0 && (
                      <IncidentFilesViewer
                        incident={i}
                        accessToken={accessToken}
                        onRequestDeleteFile={
                          false && i.id > 0 && !i.id_local
                            ? (f) => handleRequestDeleteIncidentFile(i, f)
                            : undefined
                        }
                      />
                    )}

                    <ThemedView style={styles.buttonRow}>
                      <TouchableOpacity style={styles.aportesButton} onPress={() => openAportesModal(i)}>
                        <Ionicons name="chatbubble-ellipses" size={20} color="#FFFFFF" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => handleDelete(i)}
                        disabled={deletingIncidentKey === incidentRowKey(i)}
                      >
                        {deletingIncidentKey === incidentRowKey(i) ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <ThemedText style={styles.deleteButtonText}>{getActionIcon('delete')}</ThemedText>
                        )}
                      </TouchableOpacity>
                    </ThemedView>
                  </ThemedView>
                ))
              )}
            </ThemedView>
          )}
        </ThemedView>
      </ScrollView>

      {/* Modal Aportes */}
      <Modal
        visible={isAportesVisible && !!selectedIncidentForAportes}
        transparent={true}
        animationType="fade"
        onRequestClose={closeAportesModal}
      >
        <View style={styles.modalOverlay}>
          <ThemedView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>
                Aportes • Incidente #{selectedIncidentForAportes?.id_local ? `LOCAL-${selectedIncidentForAportes.id_local}` : selectedIncidentForAportes?.id}
              </ThemedText>
              <TouchableOpacity onPress={closeAportesModal}>
                <Ionicons name="close" size={24} color="#666666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={true}>
              {/* Botón para mostrar el formulario */}
              {!showAporteComposer && !editingAporte && (
                <TouchableOpacity
                  style={styles.showComposerButton}
                  onPress={() => setShowAporteComposer(true)}
                >
                  <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
                  <ThemedText style={styles.showComposerButtonText}>Nuevo aporte</ThemedText>
                </TouchableOpacity>
              )}

              {(showAporteComposer || !!editingAporte) && (
                <ThemedView style={styles.aporteComposer}>
                  <ThemedText style={styles.sectionTitle}>
                    {editingAporte ? 'Editar aporte' : 'Nuevo aporte'}
                  </ThemedText>
                  <TextInput
                    style={styles.formInput}
                    value={aporteNombrePersonalizado}
                    onChangeText={setAporteNombrePersonalizado}
                    placeholder="Nombre personalizado (opcional)"
                    placeholderTextColor="#999"
                  />
                  <TextInput
                    style={[styles.formInput, styles.textArea]}
                    value={aporteText}
                    onChangeText={setAporteText}
                    placeholder="Escribe tu aporte..."
                    placeholderTextColor="#999"
                    multiline
                    numberOfLines={3}
                  />

                  <ThemedView style={styles.formGroup}>
                    <ThemedText style={styles.formLabel}>Firma del aporte (opcional)</ThemedText>
                    {aporteFirmaManual ? (
                      <ThemedView style={styles.signaturePreviewContainer}>
                        <Image source={{ uri: aporteFirmaManual }} style={styles.signaturePreview} resizeMode="contain" />
                        <TouchableOpacity style={styles.removeSignatureButton} onPress={() => setAporteFirmaManual(null)}>
                          <Ionicons name="trash" size={18} color="#FFFFFF" />
                        </TouchableOpacity>
                      </ThemedView>
                    ) : null}
                    <TouchableOpacity style={styles.openSignatureButton} onPress={openAporteSignatureModal}>
                      <Ionicons name="create-outline" size={20} color="#000000" />
                      <ThemedText style={styles.openSignatureButtonText}>
                        {aporteFirmaManual ? 'Modificar firma' : 'Dibujar firma'}
                      </ThemedText>
                    </TouchableOpacity>
                  </ThemedView>

                  {renderAporteFilesSection()}

                  <ThemedView style={styles.buttonRow}>
                    <TouchableOpacity
                      style={[styles.confirmButton, isSubmittingAporte && styles.buttonDisabled]}
                      onPress={submitAporteWithConfirm}
                      disabled={isSubmittingAporte}
                    >
                      {isSubmittingAporte ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <ThemedText style={styles.confirmButtonText}>{getActionIcon('confirm')}</ThemedText>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => {
                        setEditingAporte(null);
                        setShowAporteComposer(false);
                        setAporteText('');
                        setAporteNombrePersonalizado('');
                        setAporteFirmaManual(null);
                        setAporteTextFiles([]);
                        setAporteImageFiles([]);
                        setAporteAudioFiles([]);
                        setAporteVideoFiles([]);
                      }}
                      disabled={isSubmittingAporte}
                    >
                      <ThemedText style={styles.cancelButtonText}>{getActionIcon('cancel')}</ThemedText>
                    </TouchableOpacity>
                  </ThemedView>
                </ThemedView>
              )}

              <ThemedView style={styles.separator} />

              {isLoadingAportes ? (
                <ThemedView style={{ paddingVertical: 20, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color="#007AFF" />
                  <ThemedText style={{ marginTop: 8, opacity: 0.7 }}>Cargando aportes...</ThemedText>
                </ThemedView>
              ) : aportes.length === 0 ? (
                <ThemedText style={styles.emptyText}>Aún no hay aportes.</ThemedText>
              ) : (
                aportes.map((a) => {
                  const myId = parseInt(String(employee?.id || '0'), 10);
                  const can = canModifyAporte(a.rol_aporte, a.empleado_id, myId, currentRoleName);
                  const isLocal = a.id_local && a.id_local !== '';

                  return (
                    <ThemedView key={a.id_local || String(a.id)} style={styles.aporteCard}>
                      <ThemedView style={styles.aporteHeaderRow}>
                        <ThemedText style={styles.aporteAuthor}>
                          {(() => {
                            const customName = String((a as any).nombre_aporte || '').trim();
                            if (customName) return `${customName}${isLocal ? ' • Pendiente' : ''}`;
                            return `${a.empleado_nombre || 'Empleado'} (${a.rol_aporte || '-'})${isLocal ? ' • Pendiente' : ''}`;
                          })()}
                        </ThemedText>
                        {can && (
                          <ThemedView style={{ flexDirection: 'row', gap: 10, backgroundColor: 'transparent' }}>
                            <TouchableOpacity
                              onPress={() => deleteAporte(a)}
                              disabled={deletingAporteKey === aporteRowKey(a)}
                            >
                              {deletingAporteKey === aporteRowKey(a) ? (
                                <ActivityIndicator size="small" color="#FF3B30" />
                              ) : (
                                <Ionicons name="trash" size={18} color="#FF3B30" />
                              )}
                            </TouchableOpacity>
                          </ThemedView>
                        )}
                      </ThemedView>
                      <ThemedText style={styles.aporteDate}>
                        {a.created_at ? convertDateTimestampToLocalString(String(a.created_at || '')) : ''}
                      </ThemedText>
                      <ThemedText style={styles.aporteText}>{a.aporte}</ThemedText>
                      {selectedIncidentForAportes && !!getContributionSignatureUri(selectedIncidentForAportes.id, a) && (
                        <ThemedView style={styles.signatureContributionContainer}>
                          <ThemedText style={styles.signatureContributionLabel}>Firma:</ThemedText>
                          <Image
                            source={{ uri: getContributionSignatureUri(selectedIncidentForAportes.id, a) as string }}
                            style={styles.signatureContributionImage}
                            resizeMode="contain"
                          />
                        </ThemedView>
                      )}

                      {selectedIncidentForAportes && (
                        <ContributionFilesViewer incidentId={selectedIncidentForAportes.id} contribution={a} accessToken={accessToken} />
                      )}
                    </ThemedView>
                  );
                })
              )}
            </ScrollView>
          </ThemedView>
        </View>
      </Modal>

      <Modal
        visible={isAporteSignatureModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeAporteSignatureModal}
      >
        <View style={styles.modalOverlay}>
          <ThemedView style={styles.signatureModalContainer}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Firma del aporte</ThemedText>
              <TouchableOpacity onPress={closeAporteSignatureModal}>
                <Ionicons name="close" size={24} color="#666666" />
              </TouchableOpacity>
            </View>
            <ThemedText style={styles.signatureModalHint}>Firma dentro del recuadro blanco.</ThemedText>
            <View style={styles.signaturePadBox}>
              <SignatureScreen
                ref={signatureAporteRef}
                onOK={handleAporteSignatureRead}
                onEmpty={() => {
                  setIsReadingAporteSignature(false);
                  Alert.alert('Error', 'No se detectó firma. Intenta de nuevo.');
                }}
                onEnd={() => setIsReadingAporteSignature(false)}
                autoClear={false}
                imageType="image/png"
                webStyle={`
                  .m-signature-pad--footer {display: none; margin: 0px;}
                  .m-signature-pad {box-shadow: none; border: none;}
                  body,html {height: 100%; margin: 0; padding: 0;}
                `}
                key={signatureAporteKey}
              />
            </View>
            <ThemedView style={styles.modalActions}>
              <TouchableOpacity style={styles.modalClearButton} onPress={clearAporteSignatureInModal}>
                <ThemedText style={styles.modalClearButtonText}>Limpiar</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalAcceptButton, isReadingAporteSignature && styles.modalButtonDisabled]}
                onPress={acceptAporteSignature}
                disabled={isReadingAporteSignature}
              >
                {isReadingAporteSignature ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <ThemedText style={styles.modalAcceptButtonText}>Aceptar</ThemedText>
                )}
              </TouchableOpacity>
            </ThemedView>
          </ThemedView>
        </View>
      </Modal>

      <AppFooter />
      <SlideMenu isVisible={isMenuVisible} onClose={handleMenuClose} onHomePress={handleHomePress} currentRoute="Incidents" />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { alignItems: 'center', padding: 20 },
  contentContainer: { width: '100%', maxWidth: 600 },

  titleContainer: {
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    width: '100%',
  },
  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, opacity: 0.7, textAlign: 'center' },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 16, fontSize: 16, opacity: 0.7 },

  noMarcaContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: 20 },
  noMarcaTitle: { fontSize: 24, fontWeight: 'bold', color: '#FF9500', textAlign: 'center' },
  noMarcaMessage: { fontSize: 16, color: '#666', textAlign: 'center', lineHeight: 24, maxWidth: 400 },
  goBackButton: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#007AFF', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, marginTop: 20 },
  goBackButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  errorBox: { backgroundColor: '#FFECEC', borderColor: '#FFB3B3', borderWidth: 1, padding: 12, borderRadius: 8, marginBottom: 16 },
  errorText: { color: '#B00020' },

  filtersMain: { width: '100%', marginBottom: 16, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#E0E0E0', overflow: 'hidden' },
  filtersHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
  },
  filtersHeaderText: { fontSize: 15, fontWeight: '700', color: '#007AFF' },
  filterContent: { padding: 16, gap: 10, backgroundColor: '#F8F9FA' },
  filterLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8, color: '#333' },
  searchInput: { width: '100%', padding: 12, borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, fontSize: 16, backgroundColor: '#F9F9F9', color: '#000000' },
  clearFiltersButton: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    borderRadius: 8,
  },
  clearFiltersButtonText: { color: '#FFFFFF', fontWeight: '600' },
  inlineLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  inlineLoadingText: { fontSize: 14, opacity: 0.75, color: '#333' },

  createButton: { backgroundColor: '#007AFF', padding: 16, borderRadius: 8, alignItems: 'center', marginBottom: 16 },
  createButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  listContainer: { width: '100%', gap: 16, marginBottom: 50 },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 16, opacity: 0.5, textAlign: 'center' },

  card: { width: '100%', borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, backgroundColor: '#fff', padding: 16, gap: 8, },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff' },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#007AFF' },
  badge: { fontSize: 12, fontWeight: '600', color: '#34C759', backgroundColor: '#F0F9F4', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  cardInfo: { fontSize: 14, color: '#666' },

  formCard: { marginBottom: 16 },
  formTitle: { fontSize: 20, fontWeight: 'bold', color: '#007AFF', marginBottom: 8, textAlign: 'center' },
  formGroup: { marginBottom: 16, backgroundColor: '#fff' },
  formLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8, color: '#333' },
  formInput: { width: '100%', padding: 12, borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, fontSize: 16, backgroundColor: '#F9F9F9', color: '#000000' },
  disabledInput: { opacity: 0.7 },
  textArea: { height: 100, textAlignVertical: 'top' },

  pickerContainer: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, backgroundColor: '#F9F9F9', overflow: 'hidden' },
  picker: { width: '100%', height: 50 },

  dateButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, backgroundColor: '#F9F9F9' },
  dateButtonText: { fontSize: 16, color: '#000000' },
  disabledButton: { opacity: 0.6 },
  inlinePickerContainer: { marginTop: 8, borderRadius: 8, backgroundColor: '#FFFFFF' },

  involucradoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, backgroundColor: '#fff' },
  smallInput: { width: 120 },
  flexInput: { flex: 1 },
  addSmallButton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  addSmallButtonText: { color: '#007AFF', fontWeight: '600' },

  codeRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 8 },
  codeInput: { flex: 1, borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, backgroundColor: '#fff', color: '#000' },
  codeActionButton: { backgroundColor: '#007AFF', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 11 },
  codeActionButtonText: { color: '#FFF', fontWeight: '700' },

  addFileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  addFileButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  fileIconButtonsRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 6 },
  fileIconButton: {
    width: 46,
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#007AFF',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filesList: {
    marginTop: 8,
    gap: 6,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fileName: {
    flex: 1,
    fontSize: 13,
    color: '#333333',
  },
  filePreviewImage: {
    width: 40,
    height: 40,
    borderRadius: 4,
    backgroundColor: '#F0F0F0',
  },

  separator: { height: 1, backgroundColor: '#E0E0E0', marginVertical: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 8, textAlign: 'center' },

  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 8, backgroundColor: '#fff' },
  aportesButton: { width: 48, backgroundColor: '#5856D6', padding: 12, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  editButton: { flex: 1, backgroundColor: '#007AFF', padding: 12, borderRadius: 6, alignItems: 'center' },
  editButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  deleteButton: { flex: 1, backgroundColor: '#FF3B30', padding: 12, borderRadius: 6, alignItems: 'center' },
  deleteButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  confirmButton: { flex: 1, backgroundColor: '#34C759', padding: 12, borderRadius: 6, alignItems: 'center' },
  confirmButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  cancelButton: { backgroundColor: '#8E8E93', padding: 12, borderRadius: 6, alignItems: 'center' },
  cancelButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
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

  // Aportes modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContainer: { width: '100%', maxWidth: 700, maxHeight: '90%', backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden' },
  modalHeader: { padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E0E0E0', backgroundColor: '#F8F9FA' },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#333', flex: 1, paddingRight: 10 },
  modalContent: { padding: 14, backgroundColor: '#fff' },
  aporteComposer: { backgroundColor: '#fff' },
  showComposerButton: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#007AFF', padding: 12, borderRadius: 10, marginBottom: 12, justifyContent: 'center' },
  showComposerButtonText: { color: '#FFFFFF', fontWeight: '700' },
  aporteCard: { marginBottom: 12, padding: 12, borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10, backgroundColor: '#fff' },
  aporteHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'transparent' },
  aporteAuthor: { fontSize: 14, fontWeight: '700', color: '#007AFF', flex: 1, paddingRight: 10 },
  aporteDate: { fontSize: 12, color: '#666', marginTop: 2, marginBottom: 8 },
  aporteText: { fontSize: 14, color: '#333', marginBottom: 8 },
  signatureContributionContainer: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    backgroundColor: '#F9F9F9',
  },
  signatureContributionLabel: { fontSize: 13, color: '#555', marginBottom: 6, fontWeight: '600' },
  signatureContributionImage: {
    width: '100%',
    height: 120,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
  },
  signaturePreviewContainer: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    height: 120,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    marginBottom: 8,
  },
  signaturePreview: { width: '100%', height: '100%' },
  removeSignatureButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  openSignatureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F9F9F9',
  },
  openSignatureButtonText: { fontSize: 14, color: '#333', fontWeight: '600' },
  signatureModalContainer: { width: '100%', maxWidth: 700, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden' },
  signatureModalHint: { paddingHorizontal: 16, paddingTop: 12, color: '#666', fontSize: 13 },
  signaturePadBox: {
    margin: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    height: 260,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 12,
    backgroundColor: '#fff',
  },
  modalClearButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#F4F4F4',
  },
  modalClearButtonText: { color: '#333', fontWeight: '600' },
  modalAcceptButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#007AFF',
  },
  modalAcceptButtonText: { color: '#FFFFFF', fontWeight: '700' },
  modalButtonDisabled: { opacity: 0.6 },

  // Files viewer styles
  fileBlockWrap: { position: 'relative' as const, marginBottom: 8 },
  fileTrashTopRight: { position: 'absolute' as const, top: 6, right: 6, zIndex: 4, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 6, padding: 6 },
  collapsableSection: { marginTop: 12, borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, backgroundColor: '#F9F9F9', overflow: 'hidden' },
  collapsableHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#F0F0F0' },
  collapsableHeaderText: { fontSize: 14, fontWeight: '600', color: '#007AFF' },
  collapsableContent: { padding: 12, backgroundColor: '#F9F9F9' },
  viewerSection: { marginBottom: 16, backgroundColor: '#F9F9F9' },
  viewerSectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12, color: '#333' },
  viewerImage: { width: '100%', height: 200, borderRadius: 8, marginBottom: 8, backgroundColor: '#F0F0F0' },
  documentRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, backgroundColor: '#fff', marginBottom: 8 },
  documentText: { flex: 1, fontSize: 14, color: '#333' },
  audioPlayerContainer: { marginBottom: 16, padding: 12, borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, backgroundColor: '#fff' },
  audioLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8, color: '#333' },
  audioPlayer: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  playButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center' },
  audioTime: { fontSize: 14, fontWeight: '500', color: '#007AFF', flex: 1 },
  resetAudioButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 8, borderRadius: 8, backgroundColor: '#007AFF' },
});

// Componente para visualizar archivos de un incidente
function IncidentFilesViewer({
  incident,
  accessToken,
  onRequestDeleteFile,
}: {
  incident: Incident;
  accessToken?: string | null;
  onRequestDeleteFile?: (file: any) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const files = Array.isArray(incident.files) ? incident.files : [];

  if (files.length === 0) return null;

  const imageFiles = files.filter(f => f.type === 'image');
  const audioFiles = files.filter(f => f.type === 'audio');
  const videoFiles = files.filter(f => f.type === 'video');
  const documentFiles = files.filter(f => f.type === 'document' || (!f.type && f.extension));

  return (
    <ThemedView style={styles.collapsableSection}>
      <TouchableOpacity
        style={styles.collapsableHeader}
        onPress={() => setIsExpanded(!isExpanded)}
      >
        <ThemedText style={styles.collapsableHeaderText}>
          Archivos ({files.length})
        </ThemedText>
        <Ionicons
          name={isExpanded ? "chevron-up" : "chevron-down"}
          size={20}
          color="#007AFF"
        />
      </TouchableOpacity>

      {isExpanded && (
        <ThemedView style={styles.collapsableContent}>
          {/* Imágenes */}
          {imageFiles.length > 0 && (
            <ThemedView style={styles.viewerSection}>
              <ThemedText style={styles.viewerSectionTitle}>Imágenes</ThemedText>
              {imageFiles.map((file) => (
                <ThemedView key={file.id} style={styles.fileBlockWrap}>
                  {onRequestDeleteFile && Number(file.id) > 0 && !file.id_local ? (
                    <TouchableOpacity style={styles.fileTrashTopRight} onPress={() => onRequestDeleteFile(file)}>
                      <Ionicons name="trash" size={18} color="#FF3B30" />
                    </TouchableOpacity>
                  ) : null}
                  <IncidentImageViewer imageUrl={buildIncidentFileUrl(incident.id, file, accessToken)} />
                </ThemedView>
              ))}
            </ThemedView>
          )}

          {/* Audio */}
          {audioFiles.length > 0 && (
            <ThemedView style={styles.viewerSection}>
              <ThemedText style={styles.viewerSectionTitle}>Audios</ThemedText>
              {audioFiles.map((file) => (
                <ThemedView key={file.id} style={styles.fileBlockWrap}>
                  {onRequestDeleteFile && Number(file.id) > 0 && !file.id_local ? (
                    <TouchableOpacity style={styles.fileTrashTopRight} onPress={() => onRequestDeleteFile(file)}>
                      <Ionicons name="trash" size={18} color="#FF3B30" />
                    </TouchableOpacity>
                  ) : null}
                  <IncidentAudioPlayer
                    sourceUrl={buildIncidentFileUrl(incident.id, file, accessToken)}
                    label={getFileDisplayName(file)}
                  />
                </ThemedView>
              ))}
            </ThemedView>
          )}

          {/* Video */}
          {videoFiles.length > 0 && (
            <ThemedView style={styles.viewerSection}>
              <ThemedText style={styles.viewerSectionTitle}>Videos</ThemedText>
              {videoFiles.map((file) => (
                <ThemedView key={file.id} style={styles.fileBlockWrap}>
                  {onRequestDeleteFile && Number(file.id) > 0 && !file.id_local ? (
                    <TouchableOpacity style={styles.fileTrashTopRight} onPress={() => onRequestDeleteFile(file)}>
                      <Ionicons name="trash" size={18} color="#FF3B30" />
                    </TouchableOpacity>
                  ) : null}
                  <IncidentVideoPlayer sourceUrl={buildIncidentFileUrl(incident.id, file, accessToken)} />
                </ThemedView>
              ))}
            </ThemedView>
          )}

          {/* Documentos */}
          {documentFiles.length > 0 && (
            <ThemedView style={styles.viewerSection}>
              <ThemedText style={styles.viewerSectionTitle}>Documentos</ThemedText>
              {documentFiles.map((file) => (
                <ThemedView key={file.id} style={styles.fileBlockWrap}>
                  {onRequestDeleteFile && Number(file.id) > 0 && !file.id_local ? (
                    <TouchableOpacity style={styles.fileTrashTopRight} onPress={() => onRequestDeleteFile(file)}>
                      <Ionicons name="trash" size={18} color="#FF3B30" />
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    style={styles.documentRow}
                    onPress={() => {
                      const url = buildIncidentFileUrl(incident.id, file, accessToken);
                      if (url) {
                        Linking.openURL(url);
                      } else {
                        Alert.alert('Error', 'URL inválida para descargar el archivo');
                      }
                    }}
                  >
                    <Ionicons name="document-text-outline" size={20} color="#007AFF" />
                    <ThemedText numberOfLines={1} style={styles.documentText}>
                      {getFileDisplayName(file)}
                    </ThemedText>
                    <Ionicons name="download-outline" size={20} color="#007AFF" />
                  </TouchableOpacity>
                </ThemedView>
              ))}
            </ThemedView>
          )}
        </ThemedView>
      )}
    </ThemedView>
  );
}

// Archivos de un aporte (contribución) en formato collapsable
function ContributionFilesViewer({ incidentId, contribution, accessToken }: { incidentId: number; contribution: IncidentContribution; accessToken?: string | null }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const files = (Array.isArray(contribution.files) ? contribution.files : []).filter((f: any) => {
    const originalName = String(f?.original_name || '').trim().toLowerCase();
    return originalName !== APORTE_SIGNATURE_FILE_NAME.toLowerCase();
  });

  if (files.length === 0) return null;

  const imageFiles = files.filter(f => f.type === 'image');
  const audioFiles = files.filter(f => f.type === 'audio');
  const videoFiles = files.filter(f => f.type === 'video');
  const documentFiles = files.filter(f => f.type === 'document' || (!f.type && f.extension));

  return (
    <ThemedView style={styles.collapsableSection}>
      <TouchableOpacity
        style={styles.collapsableHeader}
        onPress={() => setIsExpanded(!isExpanded)}
      >
        <ThemedText style={styles.collapsableHeaderText}>
          Archivos ({files.length})
        </ThemedText>
        <Ionicons
          name={isExpanded ? "chevron-up" : "chevron-down"}
          size={20}
          color="#007AFF"
        />
      </TouchableOpacity>

      {isExpanded && (
        <ThemedView style={styles.collapsableContent}>
          {imageFiles.length > 0 && (
            <ThemedView style={styles.viewerSection}>
              <ThemedText style={styles.viewerSectionTitle}>Imágenes</ThemedText>
              {imageFiles.map(file => (
                <IncidentImageViewer
                  key={file.id}
                  imageUrl={buildContributionFileUrl(incidentId, contribution.id, file, accessToken)}
                />
              ))}
            </ThemedView>
          )}

          {audioFiles.length > 0 && (
            <ThemedView style={styles.viewerSection}>
              <ThemedText style={styles.viewerSectionTitle}>Audios</ThemedText>
              {audioFiles.map(file => (
                <IncidentAudioPlayer
                  key={file.id}
                  sourceUrl={buildContributionFileUrl(incidentId, contribution.id, file, accessToken)}
                  label={getFileDisplayName(file)}
                />
              ))}
            </ThemedView>
          )}

          {videoFiles.length > 0 && (
            <ThemedView style={styles.viewerSection}>
              <ThemedText style={styles.viewerSectionTitle}>Videos</ThemedText>
              {videoFiles.map(file => (
                <IncidentVideoPlayer
                  key={file.id}
                  sourceUrl={buildContributionFileUrl(incidentId, contribution.id, file, accessToken)}
                />
              ))}
            </ThemedView>
          )}

          {documentFiles.length > 0 && (
            <ThemedView style={styles.viewerSection}>
              <ThemedText style={styles.viewerSectionTitle}>Documentos</ThemedText>
              {documentFiles.map(file => (
                <TouchableOpacity
                  key={file.id}
                  style={styles.documentRow}
                  onPress={() => {
                    const url = buildContributionFileUrl(incidentId, contribution.id, file, accessToken);
                    if (url) {
                      Linking.openURL(url);
                    } else {
                      Alert.alert('Error', 'URL inválida para descargar el archivo');
                    }
                  }}
                >
                  <Ionicons name="document-text-outline" size={20} color="#007AFF" />
                  <ThemedText numberOfLines={1} style={styles.documentText}>
                    {getFileDisplayName(file)}
                  </ThemedText>
                  <Ionicons name="download-outline" size={20} color="#007AFF" />
                </TouchableOpacity>
              ))}
            </ThemedView>
          )}
        </ThemedView>
      )}
    </ThemedView>
  );
}

// Image viewer que ajusta el contenedor basado en dimensiones
function IncidentImageViewer({ imageUrl }: { imageUrl: string }) {
  const [containerStyle, setContainerStyle] = useState<any>(styles.viewerImage);
  const maxContainerWidth = Dimensions.get('window').width - 64;

  const handleImageLoad = (event: any) => {
    const { width, height } = event.nativeEvent.source;
    if (width && height) {
      const aspectRatio = width / height;
      let containerWidth = maxContainerWidth;
      let containerHeight: number;

      if (height > width) {
        containerHeight = (maxContainerWidth / aspectRatio);
        if (containerHeight > 600) {
          containerHeight = 600;
          containerWidth = containerHeight * aspectRatio;
        }
      } else {
        containerWidth = Math.min(maxContainerWidth, width);
        containerHeight = containerWidth / aspectRatio;
        if (containerHeight < 180) {
          containerHeight = 180;
          containerWidth = containerHeight * aspectRatio;
        }
      }

      setContainerStyle({
        width: containerWidth,
        height: containerHeight,
        borderRadius: 8,
        marginBottom: 8,
        backgroundColor: '#F0F0F0',
        alignSelf: 'center',
      });
    }
  };

  return (
    <Image
      source={{ uri: imageUrl }}
      style={containerStyle}
      resizeMode="contain"
      onLoad={handleImageLoad}
    />
  );
}

// Audio player para incidentes
function IncidentAudioPlayer({ sourceUrl, label }: { sourceUrl: string; label?: string }) {
  const player = useAudioPlayer(sourceUrl);
  const status = useAudioPlayerStatus(player);
  const [isPlaying, setIsPlaying] = useState(false);

  const duration = status.duration ?? 0;
  const position = status.currentTime ?? 0;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const togglePlayPause = () => {
    if (!player) return;
    try {
      if (!isPlaying) {
        player.play();
        setIsPlaying(true);
      } else {
        player.pause();
        setIsPlaying(false);
      }
    } catch (error) {
      console.error('Error controlling audio player:', error);
    }
  };

  const resetAudio = () => {
    if (!player) return;
    try {
      player.seekTo(0);
      player.pause();
      setIsPlaying(false);
    } catch (error) {
      console.error('Error resetting audio player:', error);
    }
  };

  useEffect(() => {
    if (!status.playing && isPlaying && position >= duration && duration > 0) {
      setIsPlaying(false);
    }
  }, [status.playing, position, duration, isPlaying]);

  useEffect(() => {
    if (status.playing !== isPlaying) {
      setIsPlaying(status.playing);
    }
  }, [status.playing]);

  return (
    <ThemedView style={styles.audioPlayerContainer}>
      {label ? (
        <ThemedText style={styles.audioLabel}>{label}</ThemedText>
      ) : null}
      <ThemedView style={styles.audioPlayer}>
        <TouchableOpacity
          style={styles.playButton}
          onPress={togglePlayPause}
        >
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={24}
            color="#FFFFFF"
          />
        </TouchableOpacity>
        <ThemedText style={styles.audioTime}>
          {formatTime(position)} / {formatTime(duration)}
        </ThemedText>
        <TouchableOpacity
          style={styles.resetAudioButton}
          onPress={resetAudio}
        >
          <Ionicons
            name="refresh"
            size={20}
            color="#FFFFFF"
          />
        </TouchableOpacity>
      </ThemedView>
    </ThemedView>
  );
}

// Video player para incidentes
function IncidentVideoPlayer({ sourceUrl }: { sourceUrl: string }) {
  const player = useVideoPlayer(sourceUrl);
  const maxContainerWidth = Dimensions.get('window').width - 64;

  return (
    <View
      style={{
        marginBottom: 8,
        overflow: 'hidden',
        borderRadius: 8,
        backgroundColor: '#000000',
        width: maxContainerWidth,
        maxWidth: '100%',
        alignSelf: 'center',
        position: 'relative',
      }}
    >
      <VideoView
        player={player}
        style={{
          width: '100%',
          aspectRatio: 16 / 9,
          backgroundColor: '#000000',
        }}
        contentFit="contain"
        nativeControls={true}
        allowsFullscreen={true}
        allowsPictureInPicture={false}
      />
    </View>
  );
}


