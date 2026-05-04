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
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import * as Location from 'expo-location';
import DateTimePicker from '@react-native-community/datetimepicker';
import Ionicons from '@expo/vector-icons/Ionicons';
import SignatureScreen from 'react-native-signature-canvas';
import { jwtDecode } from 'jwt-decode';
import { Picker } from '@react-native-picker/picker';

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
import {
  createDocumentoEntregado,
  deleteDocumentoEntregado,
  DocumentoEntregadoItem,
  getDocumentTypes,
  updateDocumentoEntregado,
} from '../hooks/documentosEntregadosFunctions';
import { listDocumentosEntregados } from '../hooks/documentosEntregadosFunctions';
import Constants from 'expo-constants';
import { convertDateTimestampToLocalString } from '@/hooks/convertDateTimestampToLocalString';
import { loadMainStructureTreeMerged } from '@/hooks/bitacoraMainStructureCache';
import {
  mergeDocumentosEntregadosCacheForCorpo,
  upsertDocumentoEntregadoInCache,
  buildDocumentoEntregadoCacheRowFromRequest,
  getDocEntregadoCorpoId,
} from '@/hooks/documentosEntregadosCacheHelpers';

type DocUI = DocumentoEntregadoItem & { id_local?: string };
type DocumentTypeUI = { id: number; nombre: string };

type RoleName = 'OPERATIVO' | 'SUPERVISOR' | 'ADMINISTRATIVO' | string | null;

type MainStructureSucursalNode = { id: number; nombre: string; puestos?: { id: number; nombre: string }[] };
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

function getClienteDivisionArray(cliente: MainStructureClienteNode | any): MainStructureDivisionNode[] {
  if (!cliente) return [];
  if (Array.isArray(cliente.division)) return cliente.division;
  if (Array.isArray((cliente as any).divisiones)) return (cliente as any).divisiones;
  return [];
}

function findDivisionIdForContratoInStructure(
  tree: MainStructureTree,
  empresaId: number | null,
  clienteId: number | null,
  contratoId: number | null,
): number | null {
  if (!contratoId || !Number.isFinite(Number(contratoId)) || Number(contratoId) <= 0) return null;
  if (!empresaId || !clienteId || !Array.isArray(tree)) return null;
  const empresa = tree.find((e: any) => Number(e.id) === Number(empresaId));
  const cliente = empresa?.clientes?.find((c: any) => Number(c.id) === Number(clienteId));
  const divisions = getClienteDivisionArray(cliente);
  for (const div of divisions) {
    const contratos: MainStructureContratoNode[] = Array.isArray(div?.contratos) ? div.contratos : [];
    if (contratos.some((ct: any) => Number(ct.id) === Number(contratoId))) {
      return Number(div.id);
    }
  }
  return null;
}

function resolveDivisionIdInStructure(
  tree: MainStructureTree,
  empresaId: number | null,
  clienteId: number | null,
  divisionId: number | null,
): number | null {
  if (divisionId == null || !Number.isFinite(Number(divisionId))) return null;
  if (!empresaId || !clienteId || !Array.isArray(tree)) return Number(divisionId);
  const empresa = tree.find((e: any) => Number(e.id) === Number(empresaId));
  const cliente = empresa?.clientes?.find((c: any) => Number(c.id) === Number(clienteId));
  const divisions = getClienteDivisionArray(cliente);
  const found = divisions.find((d: any) => Number(d.id) === Number(divisionId));
  return found ? Number(found.id) : Number(divisionId);
}

function resolveMarcaDivisionForTree(current: any, tree: MainStructureTree): number | null {
  const empresaId =
    current?.empresa?.id != null
      ? Number(current.empresa.id)
      : current?.empresa_id != null
        ? Number(current.empresa_id)
        : null;
  const clienteId =
    current?.cliente?.id != null
      ? Number(current.cliente.id)
      : current?.cliente_id != null
        ? Number(current.cliente_id)
        : null;
  const contratoId =
    current?.contrato?.id != null
      ? Number(current.contrato.id)
      : current?.contrato_id != null
        ? Number(current.contrato_id)
        : null;
  let divId = getDivisionIdFromMarcaJson(current);
  if (divId == null && empresaId && clienteId && contratoId && Array.isArray(tree) && tree.length > 0) {
    divId = findDivisionIdForContratoInStructure(tree, empresaId, clienteId, contratoId);
  }
  if (divId == null) return null;
  return resolveDivisionIdInStructure(tree, empresaId, clienteId, divId);
}

type HierarchyCorpoIds = {
  empresaId: number;
  clienteId: number;
  divisionId: number;
  contratoId: number;
  corpoId: number;
};

function findHierarchyByCorpoIn(structureArr: MainStructureTree, corpoId: number): HierarchyCorpoIds | null {
  const cid = Number(corpoId);
  for (const empresa of structureArr || []) {
    for (const cliente of empresa.clientes || []) {
      for (const division of getClienteDivisionArray(cliente)) {
        for (const contrato of division.contratos || []) {
          for (const sucursal of contrato.sucursales || []) {
            if (Number(sucursal.id) === cid) {
              return {
                empresaId: empresa.id,
                clienteId: cliente.id,
                divisionId: division.id,
                contratoId: contrato.id,
                corpoId: sucursal.id,
              };
            }
          }
        }
      }
    }
  }
  return null;
}

type FormHierarchyIds = {
  empresaId: number;
  clienteId: number;
  divisionId: number;
  contratoId: number;
  corpoId: number;
  puestoId: number;
};

function findHierarchyByPuestoIn(structureArr: any[], puestoId: number): FormHierarchyIds | null {
  const pid = Number(puestoId);
  for (const empresa of structureArr || []) {
    for (const cliente of empresa.clientes || []) {
      for (const division of getClienteDivisionArray(cliente)) {
        for (const contrato of division.contratos || []) {
          for (const sucursal of contrato.sucursales || []) {
            for (const puesto of sucursal.puestos || []) {
              if (Number(puesto?.id) === pid) {
                return {
                  empresaId: empresa.id,
                  clienteId: cliente.id,
                  divisionId: division.id,
                  contratoId: contrato.id,
                  corpoId: sucursal.id,
                  puestoId: puesto.id,
                };
              }
            }
          }
        }
      }
    }
  }
  return null;
}

type PuestoOpt = { id: number; nombre: string };

function mapPuestosDoc(raw: any[]): PuestoOpt[] {
  return (raw || []).map((p: any) => ({
    id: Number(p.id),
    nombre:
      p.nombre != null && String(p.nombre).trim() !== ''
        ? String(p.nombre)
        : p.codigo != null
          ? String(p.codigo)
          : `Puesto ${p.id}`,
  }));
}

/** @deprecated usar getDocEntregadoCorpoId */
function docRecordSucursalId(d: any): number {
  return getDocEntregadoCorpoId(d);
}

type MarcaSnapshot = {
  current: Record<string, any>;
  roleName: string | null;
  isOperativo: boolean;
  marcaDivisionId: number | null;
  marcaCorpoId: number | null;
  marcaClienteId: number | null;
  marcaEmpresaId: number | null;
  marcaPuestoId: number | null;
  filterEmpresaId: number | null;
  filterClienteId: number | null;
  filterDivisionId: number | null;
  filterContratoId: number | null;
  filterSucursalId: number | null;
};

export default function DocumentosEntregadosScreen() {
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

  const [puestosByCorpo, setPuestosByCorpo] = useState<Record<string, PuestoOpt[]>>({});
  const puestosByCorpoRef = useRef<Record<string, PuestoOpt[]>>({});
  const [selectedPuestoId, setSelectedPuestoId] = useState<number | null>(null);
  const [marcaPuestoId, setMarcaPuestoId] = useState<number | null>(null);

  const [structure, setStructure] = useState<MainStructureTree>([]);
  const [isStructureLoading, setIsStructureLoading] = useState(false);

  const [selectedEmpresaId, setSelectedEmpresaId] = useState<number | null>(null);
  const [selectedClienteId, setSelectedClienteId] = useState<number | null>(null);
  const [selectedDivisionId, setSelectedDivisionId] = useState<number | null>(null);
  const [selectedContratoId, setSelectedContratoId] = useState<number | null>(null);
  const [selectedSucursalId, setSelectedSucursalId] = useState<number | null>(null);

  const [docs, setDocs] = useState<DocUI[]>([]);

  // filtros (collapsable)
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  const [filterSearch, setFilterSearch] = useState('');
  const [filterFecha, setFilterFecha] = useState('');
  const [showFilterFechaPicker, setShowFilterFechaPicker] = useState(false);

  // tipos de documento (cache + offline)
  const [documentTypes, setDocumentTypes] = useState<DocumentTypeUI[]>([]);
  const [isDocTypeModalVisible, setIsDocTypeModalVisible] = useState(false);

  // create/edit (oculta lista al estar activo)
  const [isCreating, setIsCreating] = useState(false);
  const [editing, setEditing] = useState<DocUI | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingDocKey, setDeletingDocKey] = useState<string | number | null>(null);
  const [submitResponse, setSubmitResponse] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const [fecha, setFecha] = useState('');
  const [showFechaPicker, setShowFechaPicker] = useState(false);
  const [nombreEntrega, setNombreEntrega] = useState('');
  const [nombreRecibe, setNombreRecibe] = useState('');
  const [tipoDocumento, setTipoDocumento] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [firmaCliente, setFirmaCliente] = useState('');
  const [firmaResponsable, setFirmaResponsable] = useState('');
  const [isGeneratingFirma, setIsGeneratingFirma] = useState(false);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);

  // firma dibujada (modal flotante)
  const [isSignatureModalVisible, setIsSignatureModalVisible] = useState(false);
  const signatureRef = useRef<any>(null);
  const [signatureKey, setSignatureKey] = useState(0);
  const [isReadingSignature, setIsReadingSignature] = useState(false);

  // Modal: ver cambios (auditoría)
  const [isCambiosModalVisible, setIsCambiosModalVisible] = useState(false);
  const [cambiosTitle, setCambiosTitle] = useState<string>('Cambios');
  const [cambiosItems, setCambiosItems] = useState<any[]>([]);
  const [expandedCambioId, setExpandedCambioId] = useState<number | null>(null);

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

  const getConnectionStatus = async (): Promise<boolean> => {
    //return false;
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

  const syncMarcaFromStorage = useCallback(
    async (opts?: {
      applyFiltersFromMarca?: boolean;
      structureTree?: MainStructureTree | null;
    }): Promise<MarcaSnapshot | null> => {
      const applyFiltersFromMarca = opts?.applyFiltersFromMarca !== false;
      const structureTree = opts?.structureTree;
      const currentMarcaStr = await AsyncStorage.getItem('current_marca');
      if (!currentMarcaStr) {
        setHasCurrentMarca(false);
        setMarcaDivisionId(null);
        setMarcaCorpoId(null);
        setMarcaClienteId(null);
        setMarcaEmpresaId(null);
        setMarcaPuestoId(null);
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
        if (!current) {
          setHasCurrentMarca(false);
          return null;
        }
        setHasCurrentMarca(true);
        const divIdRaw = current?.roleDivision?.division?.id ?? current?.division_id;
        const corpoIdRaw = current?.corpo?.id ?? current?.corpo_id;
        const clienteIdRaw = current?.cliente?.id ?? current?.cliente_id;
        const empresaIdRaw = current?.empresa?.id ?? current?.empresa_id;
        const corpoId = numOrNull(corpoIdRaw);
        const clienteId = numOrNull(clienteIdRaw);
        const empresaId = numOrNull(empresaIdRaw);
        const puestoIdRaw = current?.puesto?.id ?? current?.puesto_id;
        const puestoM = numOrNull(puestoIdRaw);
        const role =
          current?.roleDivision?.role?.nombre ??
          current?.role_division?.role?.nombre ??
          null;
        const rn = typeof role === 'string' ? (role as RoleName) : null;

        const divFromMarca = getDivisionIdFromMarcaJson(current);
        const divResolved =
          structureTree && structureTree.length > 0
            ? resolveMarcaDivisionForTree(current, structureTree)
            : null;
        const effectiveDivisionId = divResolved ?? divFromMarca ?? numOrNull(divIdRaw);

        setMarcaDivisionId(effectiveDivisionId);
        setMarcaCorpoId(corpoId);
        setMarcaClienteId(clienteId);
        setMarcaEmpresaId(empresaId);
        setMarcaPuestoId(puestoM);
        setRoleName(rn);

        const fe = numOrNull(current?.empresa?.id);
        const fc = numOrNull(current?.cliente?.id);
        const fco = numOrNull(current?.contrato?.id);
        const fs = numOrNull(current?.corpo?.id);
        if (applyFiltersFromMarca) {
          setFilterEmpresaId(fe);
          setFilterClienteId(fc);
          setFilterDivisionId(effectiveDivisionId);
          setFilterContratoId(fco);
          setFilterSucursalId(fs);
          filterSucursalIdRef.current = fs;
        }

        return {
          current,
          roleName: rn,
          isOperativo: rn === 'OPERATIVO',
          marcaDivisionId: effectiveDivisionId,
          marcaCorpoId: corpoId,
          marcaClienteId: clienteId,
          marcaEmpresaId: empresaId,
          marcaPuestoId: puestoM,
          filterEmpresaId: fe,
          filterClienteId: fc,
          filterDivisionId: effectiveDivisionId,
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

  const resetListFiltersFromCurrentMarca = useCallback(async () => {
    try {
      const currentMarcaStr = await AsyncStorage.getItem('current_marca');
      if (!currentMarcaStr) return;
      const currentMarca = JSON.parse(currentMarcaStr);
      const loaded = await loadMainStructureTreeMerged().catch(() => []);
      const tree = Array.isArray(loaded) ? (loaded as MainStructureTree) : [];
      const divId =
        tree.length > 0
          ? resolveMarcaDivisionForTree(currentMarca, tree) ?? getDivisionIdFromMarcaJson(currentMarca)
          : getDivisionIdFromMarcaJson(currentMarca);
      setFilterEmpresaId(currentMarca.empresa?.id != null ? Number(currentMarca.empresa.id) : null);
      setFilterClienteId(currentMarca.cliente?.id != null ? Number(currentMarca.cliente.id) : null);
      setFilterDivisionId(divId);
      setFilterContratoId(currentMarca.contrato?.id != null ? Number(currentMarca.contrato.id) : null);
      const fs = currentMarca.corpo?.id != null ? Number(currentMarca.corpo.id) : null;
      setFilterSucursalId(fs);
      filterSucursalIdRef.current = fs;
    } catch (e) {
      console.error('resetListFiltersFromCurrentMarca (documentos entregados):', e);
    }
  }, []);

  const applyCurrentMarcaToCreateHierarchy = useCallback(async (treeFromCaller?: MainStructureTree) => {
    try {
      const currentMarcaStr = await AsyncStorage.getItem('current_marca');
      if (!currentMarcaStr) return;
      const marca = JSON.parse(currentMarcaStr);
      const rn = marca?.roleDivision?.role?.nombre ?? marca?.role_division?.role?.nombre ?? null;
      if (rn === 'OPERATIVO') {
        const pId = marca.puesto?.id != null ? Number(marca.puesto.id) : marca.puesto_id != null ? Number(marca.puesto_id) : null;
        if (pId && Number.isFinite(pId) && pId > 0) {
          setSelectedPuestoId(pId);
        }
        return;
      }

      let tree = treeFromCaller;
      if (!tree?.length) {
        const loaded = await loadMainStructureTreeMerged().catch(() => []);
        tree = Array.isArray(loaded) ? (loaded as MainStructureTree) : [];
        if (tree.length) setStructure(tree);
      }
      const divResolved =
        tree && tree.length > 0 ? resolveMarcaDivisionForTree(marca, tree) : null;

      setSelectedEmpresaId(marca.empresa?.id != null ? Number(marca.empresa.id) : null);
      setSelectedClienteId(marca.cliente?.id != null ? Number(marca.cliente.id) : null);
      setSelectedDivisionId(divResolved ?? getDivisionIdFromMarcaJson(marca));
      setSelectedContratoId(marca.contrato?.id != null ? Number(marca.contrato.id) : null);
      setSelectedSucursalId(marca.corpo?.id != null ? Number(marca.corpo.id) : null);
      const pId = marca.puesto?.id != null ? Number(marca.puesto.id) : marca.puesto_id != null ? Number(marca.puesto_id) : null;
      if (pId && Number.isFinite(pId) && pId > 0) {
        setSelectedPuestoId(pId);
      } else {
        setSelectedPuestoId(null);
      }
    } catch (e) {
      console.error('applyCurrentMarcaToCreateHierarchy (documentos entregados):', e);
    }
  }, []);

  const loadMainStructureCache = useCallback(async (): Promise<MainStructureTree> => {
    setIsStructureLoading(true);
    try {
      const tree = await loadMainStructureTreeMerged();
      const arr = Array.isArray(tree) ? (tree as MainStructureTree) : [];
      setStructure(arr);
      return arr;
    } catch (e) {
      console.error('Error loading main structure (documentos entregados):', e);
      setStructure([]);
      return [];
    } finally {
      setIsStructureLoading(false);
    }
  }, []);

  useEffect(() => {
    puestosByCorpoRef.current = puestosByCorpo;
  }, [puestosByCorpo]);

  const cacheKeyPuestosDoc = (corpoId: number) => `documentos_puestos_cache_${corpoId}`;

  const fetchPuestosForCorpoDoc = useCallback(
    async (corpoId: number, force: boolean = false): Promise<void> => {
      if (!Number.isFinite(corpoId) || corpoId <= 0) return;
      const key = String(corpoId);
      if (!force && Object.prototype.hasOwnProperty.call(puestosByCorpoRef.current, key)) return;
      const getConn = await Network.getNetworkStateAsync();
      const online = !!(getConn.isConnected && getConn.isInternetReachable);
      if (!online) {
        const raw = await AsyncStorage.getItem(cacheKeyPuestosDoc(corpoId));
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              setPuestosByCorpo((prev) => ({ ...prev, [key]: mapPuestosDoc(parsed) }));
            }
          } catch {
            /* ignore */
          }
        }
        return;
      }
      try {
        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) return;
        const res = await authedFetch({
          url: `${apiUrl}/api/puestos/corpo/${corpoId}`,
          init: { method: 'GET' },
          refreshAccessToken,
          logout,
        });
        if (!res || !res.ok) return;
        const data = await res.json();
        if (data?.status && Array.isArray(data.puestos)) {
          setPuestosByCorpo((prev) => ({ ...prev, [key]: mapPuestosDoc(data.puestos) }));
          await AsyncStorage.setItem(cacheKeyPuestosDoc(corpoId), JSON.stringify(data.puestos));
        }
      } catch (e) {
        console.error('fetchPuestosForCorpoDoc', e);
      }
    },
    [refreshAccessToken, logout]
  );

  useEffect(() => {
    const ids = new Set<number>();
    if (selectedSucursalId != null && selectedSucursalId > 0) ids.add(selectedSucursalId);
    if (marcaCorpoId != null && marcaCorpoId > 0) ids.add(marcaCorpoId);
    ids.forEach((id) => {
      void fetchPuestosForCorpoDoc(id, true);
    });
  }, [selectedSucursalId, marcaCorpoId, fetchPuestosForCorpoDoc]);

  const empresaOptions = useMemo(() => structure.map((e) => ({ id: e.id, nombre: e.nombre })), [structure]);

  const selectedEmpresaNode = useMemo(() => {
    if (selectedEmpresaId === null) return null;
    return structure.find((e) => Number(e.id) === Number(selectedEmpresaId)) ?? null;
  }, [structure, selectedEmpresaId]);

  const clienteOptions = useMemo(() => {
    if (!selectedEmpresaNode) return [];
    return (selectedEmpresaNode.clientes || []).map((c) => ({ id: c.id, nombre: c.nombre }));
  }, [selectedEmpresaNode]);

  const selectedClienteNode = useMemo(() => {
    if (!selectedEmpresaNode || selectedClienteId === null) return null;
    return selectedEmpresaNode.clientes.find((c) => Number(c.id) === Number(selectedClienteId)) ?? null;
  }, [selectedEmpresaNode, selectedClienteId]);

  const divisionOptions = useMemo(() => {
    if (!selectedClienteNode) return [];
    return getClienteDivisionArray(selectedClienteNode).map((d) => ({ id: d.id, nombre: d.nombre }));
  }, [selectedClienteNode]);

  const selectedDivisionNode = useMemo(() => {
    if (!selectedClienteNode || selectedDivisionId === null) return null;
    return (
      getClienteDivisionArray(selectedClienteNode).find((d) => Number(d.id) === Number(selectedDivisionId)) ?? null
    );
  }, [selectedClienteNode, selectedDivisionId]);

  const contratoOptions = useMemo(() => {
    if (!selectedDivisionNode) return [];
    return (selectedDivisionNode.contratos || []).map((c) => ({ id: c.id, nombre: c.nombre }));
  }, [selectedDivisionNode]);

  const selectedContratoNode = useMemo(() => {
    if (!selectedDivisionNode || selectedContratoId === null) return null;
    return (selectedDivisionNode.contratos || []).find((c) => Number(c.id) === Number(selectedContratoId)) ?? null;
  }, [selectedDivisionNode, selectedContratoId]);

  const sucursalOptions = useMemo(() => {
    if (!selectedContratoNode) return [];
    return (selectedContratoNode.sucursales || []).map((s) => ({ id: s.id, nombre: s.nombre }));
  }, [selectedContratoNode]);

  const selectedSucursalNode = useMemo(() => {
    if (!selectedContratoNode || selectedSucursalId == null) return null;
    return (selectedContratoNode.sucursales || []).find((s: any) => Number(s.id) === Number(selectedSucursalId)) ?? null;
  }, [selectedContratoNode, selectedSucursalId]);

  const formPuestoOptions = useMemo((): PuestoOpt[] => {
    if (selectedSucursalId == null) return [];
    const k = String(selectedSucursalId);
    if (Object.prototype.hasOwnProperty.call(puestosByCorpo, k)) {
      return puestosByCorpo[k]!;
    }
    return mapPuestosDoc((selectedSucursalNode as any)?.puestos || []);
  }, [selectedSucursalId, puestosByCorpo, selectedSucursalNode]);

  const operativoPuestoOptions = useMemo((): PuestoOpt[] => {
    if (marcaCorpoId == null) return [];
    const k = String(marcaCorpoId);
    if (Object.prototype.hasOwnProperty.call(puestosByCorpo, k)) {
      return puestosByCorpo[k]!;
    }
    for (const e of structure || []) {
      for (const c of e.clientes || []) {
        for (const d of getClienteDivisionArray(c)) {
          for (const co of d.contratos || []) {
            for (const s of co.sucursales || []) {
              if (Number(s.id) === Number(marcaCorpoId)) {
                return mapPuestosDoc(s.puestos || []);
              }
            }
          }
        }
      }
    }
    return [];
  }, [marcaCorpoId, puestosByCorpo, structure]);

  const handleEmpresaChange = (empresaId: number | null) => {
    setSelectedEmpresaId(empresaId);
    setSelectedClienteId(null);
    setSelectedDivisionId(null);
    setSelectedContratoId(null);
    setSelectedSucursalId(null);
    setSelectedPuestoId(null);
  };

  const handleClienteChange = (clienteId: number | null) => {
    setSelectedClienteId(clienteId);
    setSelectedDivisionId(null);
    setSelectedContratoId(null);
    setSelectedSucursalId(null);
    setSelectedPuestoId(null);
  };

  const filterEmpresaOptions = useMemo(() => structure ?? [], [structure]);
  const filterClienteOptionsMemo = useMemo(() => {
    const empresa = structure.find((e) => Number(e.id) === Number(filterEmpresaId));
    return empresa?.clientes ?? [];
  }, [structure, filterEmpresaId]);
  const filterDivisionOptionsMemo = useMemo(() => {
    const cliente = filterClienteOptionsMemo.find((c) => Number(c.id) === Number(filterClienteId));
    return getClienteDivisionArray(cliente);
  }, [filterClienteOptionsMemo, filterClienteId]);
  const filterContratoOptionsMemo = useMemo(() => {
    const division = filterDivisionOptionsMemo.find((d) => Number(d.id) === Number(filterDivisionId));
    return division?.contratos ?? [];
  }, [filterDivisionOptionsMemo, filterDivisionId]);
  const filterSucursalOptionsMemo = useMemo(() => {
    const contrato = filterContratoOptionsMemo.find((c) => Number(c.id) === Number(filterContratoId));
    return contrato?.sucursales ?? [];
  }, [filterContratoOptionsMemo, filterContratoId]);

  const fetchDocumentTypes = useCallback(async () => {
    const res = await getDocumentTypes({ refreshAccessToken, logout });
    if (res.status && Array.isArray(res.documentTypes)) {
      setDocumentTypes(res.documentTypes as any);
    } else {
      setDocumentTypes([]);
    }
  }, [refreshAccessToken, logout]);

  const runFetchDocs = useCallback(
    async (snap: MarcaSnapshot) => {
    try {
      setIsLoading(true);
      setError(null);

        const corpoId = snap.isOperativo ? snap.marcaCorpoId : (snap.filterSucursalId ?? snap.marcaCorpoId);

        if (!corpoId || corpoId <= 0) {
          setError(
            snap.isOperativo
              ? 'No se encontró el ID de la sucursal (corpo) en la marca actual'
              : 'Seleccione sucursal en el filtro o defina la sucursal en la marca actual'
          );
          setDocs([]);
        return;
      }

        const cacheStr = await AsyncStorage.getItem('documentos_entregados_cache');
        const allCache: DocUI[] = cacheStr ? JSON.parse(cacheStr) : [];
        const fullCache = Array.isArray(allCache) ? allCache : [];
        const sid = Number(corpoId);
        const localByCorpo = fullCache.filter((d: any) => getDocEntregadoCorpoId(d) === sid);

        const isConnected = await getConnectionStatus();
        if (!isConnected) {
          setDocs(
            localByCorpo.filter((d: any) => d == null || (d as any).isActive !== false)
          );
          return;
        }

        const res = await listDocumentosEntregados({
          corpoId,
          refreshAccessToken,
          logout,
        });

        if (!res.status) {
          setError(res.message || 'Error al cargar documentos entregados');
          setDocs(
            localByCorpo.filter((d: any) => d == null || (d as any).isActive !== false)
          );
          return;
        }

        const serverList = (res.data || []).map((it: any) => ({
          ...it,
          corpo_id: Number(it.corpo_id ?? it.sucursal_id ?? corpoId),
          id_local: it.id_local || '',
          isActive: it.isActive !== false,
        }));
        const merged = mergeDocumentosEntregadosCacheForCorpo(fullCache, serverList, sid);
        await AsyncStorage.setItem('documentos_entregados_cache', JSON.stringify(merged));
        setDocs(merged.filter((d: any) => getDocEntregadoCorpoId(d) === sid));
    } catch (e: any) {
      setError(e.message || 'Error al cargar documentos entregados');
    } finally {
      setIsLoading(false);
    }
    },
    [refreshAccessToken, logout]
  );

  const fetchRecords = useCallback(async () => {
    const tree = await loadMainStructureCache();
    const snap = await syncMarcaFromStorage({ applyFiltersFromMarca: false, structureTree: tree });
    if (!snap) return;
    await runFetchDocs({
      ...snap,
      filterSucursalId: filterSucursalIdRef.current,
    });
  }, [syncMarcaFromStorage, runFetchDocs, loadMainStructureCache]);

  useEffect(() => {
    filterSucursalIdRef.current = filterSucursalId;
  }, [filterSucursalId]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        if (!listFiltersSyncedFromMarcaOnceRef.current) {
          const tree = await loadMainStructureCache();
          if (cancelled) return;
          const snap = await syncMarcaFromStorage({
            applyFiltersFromMarca: true,
            structureTree: tree,
          });
          if (cancelled) return;
          listFiltersSyncedFromMarcaOnceRef.current = true;
          if (snap) await runFetchDocs(snap);
          else await fetchRecords();
        } else {
          await fetchRecords();
        }
      })();
      void fetchDocumentTypes();
      const handler = () => {
        void fetchRecords();
        void fetchDocumentTypes();
      };
      eventBus.on('connectionRestored', handler);
      return () => {
        cancelled = true;
        eventBus.off('connectionRestored', handler);
      };
    }, [
      syncMarcaFromStorage,
      runFetchDocs,
      fetchRecords,
      fetchDocumentTypes,
      loadMainStructureCache,
    ])
  );

  const resetForm = async () => {
    const horaAccion = await getHoraAccion();
    if (!horaAccion) {
      Alert.alert('Error', 'No se pudo obtener la hora de acción');
      return;
    }
    setFecha(dateToLocalString(new Date(horaAccion)));
    setNombreEntrega('');
    setNombreRecibe('');
    setTipoDocumento('');
    setDescripcion('');
    setFirmaCliente('');
    setFirmaResponsable('');
  };

  const startCreating = () => {
    resetForm();
    setEditing(null);
    setIsCreating(true);
    void (async () => {
      const tree = await loadMainStructureCache();
      await applyCurrentMarcaToCreateHierarchy(tree);
    })();
  };

  const startEditing = async (it: DocUI) => {
    const horaAccion = await getHoraAccion();
    if (!horaAccion) {
      Alert.alert('Error', 'No se pudo obtener la hora');
      return;
    }
    if (roleName != null && roleName !== 'OPERATIVO' && structure.length) {
      const pId = Number((it as any).puesto_id ?? 0);
      const hp = pId > 0 ? findHierarchyByPuestoIn(structure, pId) : null;
      if (hp) {
        setSelectedEmpresaId(hp.empresaId);
        setSelectedClienteId(hp.clienteId);
        setSelectedDivisionId(hp.divisionId);
        setSelectedContratoId(hp.contratoId);
        setSelectedSucursalId(hp.corpoId);
        setSelectedPuestoId(hp.puestoId);
      } else {
        const h = findHierarchyByCorpoIn(structure, Number(it.corpo_id));
        if (h) {
          setSelectedEmpresaId(h.empresaId);
          setSelectedClienteId(h.clienteId);
          setSelectedDivisionId(h.divisionId);
          setSelectedContratoId(h.contratoId);
          setSelectedSucursalId(h.corpoId);
        } else {
          const empresaFound =
            structure.find((e) => (e.clientes || []).some((c) => Number(c.id) === Number(it.cliente_id))) ?? null;
          if (empresaFound) setSelectedEmpresaId(empresaFound.id);
          setSelectedClienteId(it.cliente_id);
          setSelectedDivisionId(null);
          setSelectedContratoId(null);
          setSelectedSucursalId(null);
        }
        setSelectedPuestoId(pId > 0 ? pId : null);
      }
    } else if (roleName != null && roleName !== 'OPERATIVO') {
      const empresaFound =
        structure.find((e) => (e.clientes || []).some((c) => Number(c.id) === Number(it.cliente_id))) ?? null;
      if (empresaFound) setSelectedEmpresaId(empresaFound.id);
      setSelectedClienteId(it.cliente_id);
      setSelectedDivisionId(null);
      setSelectedContratoId(null);
      setSelectedSucursalId(null);
      setSelectedPuestoId(Number((it as any).puesto_id) > 0 ? Number((it as any).puesto_id) : null);
    }

    if (roleName === 'OPERATIVO') {
      const p = Number((it as any).puesto_id ?? 0);
      if (p > 0) setSelectedPuestoId(p);
    }

    setEditing(it);
    setIsCreating(true);
    setFecha(it.fecha ? String(it.fecha).split('T')[0] : dateToLocalString(new Date(horaAccion)));
    setNombreEntrega(it.nombre_oficial_entrega || '');
    setNombreRecibe(it.nombre_oficial_recibe || '');
    setTipoDocumento(it.tipo_documento || '');
    setDescripcion(it.descripcion || '');
    setFirmaCliente(it.firma_representante_cliente || '');
    setFirmaResponsable((it as any).firma_responsable || '');
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

  const cancelCreating = () => {
    setIsCreating(false);
    setEditing(null);
  };

  const validateForm = () => {
    if (!hasCurrentMarca) {
      Alert.alert('Error', 'Debes tener una marca activa para usar este módulo.');
      return false;
    }
    if (roleName == null) {
      Alert.alert('Error', 'Cargando contexto de marca...');
      return false;
    }
    if (roleName === 'OPERATIVO') {
      if (!marcaClienteId || !marcaCorpoId) {
        Alert.alert('Error', 'No se pudo determinar cliente o sucursal desde la marca actual');
        return false;
      }
    } else {
      if (!selectedEmpresaId || !selectedClienteId || !selectedSucursalId) {
        Alert.alert('Error', 'Empresa, Cliente y Sucursal son obligatorios');
        return false;
      }
      if (!selectedDivisionId) {
        Alert.alert('Error', 'División es obligatoria');
        return false;
      }
      if (!selectedContratoId) {
        Alert.alert('Error', 'Contrato es obligatorio');
        return false;
      }
      if (!selectedPuestoId) {
        Alert.alert('Error', 'Debe seleccionar un puesto');
        return false;
      }
    }
    if (roleName === 'OPERATIVO' && !selectedPuestoId && !marcaPuestoId) {
      Alert.alert('Error', 'Debe seleccionar un puesto');
      return false;
    }
    const required = [
      { label: 'Fecha', v: fecha },
      { label: 'Nombre oficial que entrega', v: nombreEntrega },
      { label: 'Nombre oficial que recibe', v: nombreRecibe },
      { label: 'Tipo de documento', v: tipoDocumento },
      { label: 'Descripción', v: descripcion },
    ];
    const missing = required.find((x) => !x.v || String(x.v).trim().length === 0);
    if (missing) {
      Alert.alert('Error', `Campo requerido: ${missing.label}`);
      return false;
    }
    if (!firmaResponsable) {
      Alert.alert('Error', 'Debes registrar la firma del responsable');
      return false;
    }
    return true;
  };

  const buildPayload = () => {
    const puestoPick = () => {
      if (roleName === 'OPERATIVO') {
        return Number(selectedPuestoId ?? marcaPuestoId ?? 0);
      }
      return Number(selectedPuestoId ?? 0);
    };
    const pid = puestoPick();
    if (!Number.isFinite(pid) || pid <= 0) {
      throw new Error('Debe seleccionar un puesto');
    }
    if (roleName === 'OPERATIVO') {
      const cid = Number(marcaClienteId ?? 0);
      const coid = Number(marcaCorpoId ?? 0);
      if (!cid || !coid) throw new Error('Cliente o sucursal no definidos en la marca');
    }
    const h = findHierarchyByPuestoIn(structure, pid);
    if (!h) {
      if (editing) {
        const ex = editing as any;
        if (ex && (ex.puesto_id || ex.corpo_id)) {
          return {
            cliente_id: Number(ex.cliente_id),
            corpo_id: Number(ex.corpo_id),
            empresa_id: Number(ex.empresa_id ?? 0),
            division_id: Number(ex.division_id ?? 0),
            contrato_id: Number(ex.contrato_id ?? 0),
            puesto_id: Number(ex.puesto_id ?? pid),
            fecha,
            nombre_oficial_entrega: nombreEntrega,
            nombre_oficial_recibe: nombreRecibe,
            tipo_documento: tipoDocumento,
            descripcion,
            firma_representante_cliente: firmaCliente,
            firma_responsable: firmaResponsable,
          };
        }
      }
      throw new Error(
        'No se pudo resolver el puesto en la jerarquía. Sincronice la estructura o compruebe la conexión.'
      );
    }

    return {
      cliente_id: h.clienteId,
      corpo_id: h.corpoId,
      empresa_id: h.empresaId,
      division_id: h.divisionId,
      contrato_id: h.contratoId,
      puesto_id: h.puestoId,
      fecha,
      nombre_oficial_entrega: nombreEntrega,
      nombre_oficial_recibe: nombreRecibe,
      tipo_documento: tipoDocumento,
      descripcion,
      firma_representante_cliente: firmaCliente,
      firma_responsable: firmaResponsable,
    };
  };

  const persistDocsBranchCache = async (corpoId: number, branchDocs: DocUI[]) => {
    const cacheStr = await AsyncStorage.getItem('documentos_entregados_cache');
    const allCache: DocUI[] = cacheStr ? JSON.parse(cacheStr) : [];
    const sid = Number(corpoId);
    const without = Array.isArray(allCache)
      ? allCache.filter((d: any) => docRecordSucursalId(d) !== sid)
      : [];
    const normalizedBranch = branchDocs.map((d: any) => ({
      ...d,
      corpo_id: Number(d.corpo_id ?? d.sucursal_id ?? sid),
    }));
    await AsyncStorage.setItem('documentos_entregados_cache', JSON.stringify([...without, ...normalizedBranch]));
  };

  // offline actions (igual patrón que otros módulos)
  const upsertAction = async (action: any) => {
    const actionsStr = await AsyncStorage.getItem('documentos_entregados_actions');
    const actions = actionsStr ? JSON.parse(actionsStr) : [];
    actions.push(action);
    await AsyncStorage.setItem('documentos_entregados_actions', JSON.stringify(actions));
  };

  const removeActionsForLocalId = async (localId: string) => {
    const actionsStr = await AsyncStorage.getItem('documentos_entregados_actions');
    if (!actionsStr) return;
    const actions = JSON.parse(actionsStr) || [];
    const updated = actions.filter(
      (a: any) =>
        !(String(a.id) === String(localId) && (a.type === 'create' || a.type === 'update'))
    );
    await AsyncStorage.setItem('documentos_entregados_actions', JSON.stringify(updated));
  };

  const updateCreateActionForLocalId = async (localId: string, requestData: any) => {
    const actionsStr = await AsyncStorage.getItem('documentos_entregados_actions');
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
      await AsyncStorage.setItem('documentos_entregados_actions', JSON.stringify(updated));
      return true;
    }
    return false;
  };

  const submitSave = async () => {
    if (!employee) return;
    if (!validateForm()) return;

    setIsSubmitting(true);
    setSubmitResponse(null);

    try {
      const payload = buildPayload();
      const isConnected = await getConnectionStatus();

      // create
      if (!editing) {
        if (isConnected) {
          const res = await createDocumentoEntregado({ requestData: payload, refreshAccessToken, logout });
          const newId = (res as any).id;
          if (res.status && newId != null && Number(newId) > 0) {
            try {
              const str = await AsyncStorage.getItem('documentos_entregados_cache');
              const list: any[] = str ? JSON.parse(str) : [];
              const row = buildDocumentoEntregadoCacheRowFromRequest(payload, Number(newId), '');
              const next = upsertDocumentoEntregadoInCache(list, row);
              await AsyncStorage.setItem('documentos_entregados_cache', JSON.stringify(next));
              setDocs(
                next.filter((d) => getDocEntregadoCorpoId(d) === Number(payload.corpo_id))
              );
            } catch (e) {
              console.error('cache doc entregado create:', e);
            }
            Alert.alert('Éxito', res.message || 'Documento entregado creado correctamente');
            setIsCreating(false);
            await fetchRecords();
          } else {
            Alert.alert('Error', res.message || 'No se pudo crear el documento');
          }
        } else {
          const localId = `local-doc-${Date.now()}`;
          const localItem: DocUI = {
            id: 0,
            id_local: localId,
            ...(payload as any),
            isActive: true,
          } as DocUI;
          const next = [localItem, ...docs];
          setDocs(next);
          await persistDocsBranchCache(payload.corpo_id, next);
          await upsertAction({ type: 'create', id: localId, requestData: payload });
          Alert.alert('Éxito', 'Se sincronizará cuando vuelva la conexión.');
          setIsCreating(false);
        }
        return;
      }

      // update
      const isLocal = !!editing.id_local || editing.id === 0;
      if (isConnected && !isLocal) {
        const res = await updateDocumentoEntregado({ id: editing.id, requestData: payload, refreshAccessToken, logout });
        if (res.status) {
          try {
            const str = await AsyncStorage.getItem('documentos_entregados_cache');
            const list: any[] = str ? JSON.parse(str) : [];
            const row = buildDocumentoEntregadoCacheRowFromRequest(payload, editing.id, '');
            const next = upsertDocumentoEntregadoInCache(list, row);
            await AsyncStorage.setItem('documentos_entregados_cache', JSON.stringify(next));
            setDocs(
              next.filter((d) => getDocEntregadoCorpoId(d) === Number(payload.corpo_id))
            );
          } catch (e) {
            console.error('cache doc entregado update:', e);
          }
          Alert.alert('Éxito', res.message || 'Documento entregado actualizado correctamente');
          setIsCreating(false);
          setEditing(null);
          await fetchRecords();
        } else {
          Alert.alert('Error', res.message || 'No se pudo actualizar el documento');
        }
      } else {
        const next = docs.map((it) => {
          const match =
            (editing.id_local && it.id_local === editing.id_local) || (!editing.id_local && it.id === editing.id);
          if (!match) return it;
          return {
            ...it,
            ...payload,
            id: it.id,
            id_local: it.id_local,
            isActive: (it as any).isActive !== false,
          };
        });
        setDocs(next);
        const branchCorpo = Number(payload.corpo_id);
        if (Number.isFinite(branchCorpo) && branchCorpo > 0) {
          await persistDocsBranchCache(branchCorpo, next);
        }

        if (editing.id_local) {
          const actionsStr = await AsyncStorage.getItem('documentos_entregados_actions');
          let docActions: any[] = actionsStr ? JSON.parse(actionsStr) : [];
          const lid = String(editing.id_local);
          docActions = docActions.filter((a: any) => !(a.type === 'update' && String(a.id) === lid));
          const ci = docActions.findIndex((a: any) => a.type === 'create' && a.id === editing.id_local);
          if (ci !== -1) {
            docActions[ci] = { ...docActions[ci], requestData: payload };
          } else {
            docActions.push({ type: 'create', id: editing.id_local, requestData: payload });
          }
          await AsyncStorage.setItem('documentos_entregados_actions', JSON.stringify(docActions));
        } else {
          await upsertAction({ type: 'update', id: editing.id, requestData: payload });
        }

        Alert.alert('Éxito', 'Los cambios se sincronizarán cuando vuelva la conexión.');
        setIsCreating(false);
        setEditing(null);
      }
    } catch (error) {
      console.error('Error saving documento:', error);
      Alert.alert('Error', 'Error al guardar el documento');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSave = () => {
    Alert.alert(
      'Confirmar',
      editing ? '¿Deseas actualizar este registro?' : '¿Deseas crear este registro?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aceptar',
          onPress: () => {
            submitSave();
          },
        },
      ]
    );
  };

  const handleDelete = async (it: DocUI) => {
    const cid = Number(it.cliente_id);
    const sid = Number(it.corpo_id);
    if (!Number.isFinite(cid) || cid <= 0 || !Number.isFinite(sid) || sid <= 0) {
      Alert.alert('Error', 'El registro no tiene cliente o sucursal válidos para eliminar.');
      return;
    }

    Alert.alert('Confirmar', '¿Deseas eliminar este registro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          const rowKey = it.id !== 0 ? `doc-${it.id}` : it.id_local ? `doc-${it.id_local}` : `doc-${it.id}`;
          setDeletingDocKey(rowKey);
          const isConnected = await getConnectionStatus();

          try {
          // local-only
          if (it.id_local || it.id === 0) {
            const next = docs.filter((x) => x.id_local !== it.id_local);
            setDocs(next);
              await persistDocsBranchCache(sid, next);
            if (it.id_local) await removeActionsForLocalId(it.id_local);
            return;
          }

          if (isConnected) {
              const res = await deleteDocumentoEntregado({
                id: it.id,
                corpoId: sid,
                clienteId: cid,
                refreshAccessToken,
                logout,
              });
            if (res.status) {
              Alert.alert('Éxito', 'Documento eliminado correctamente');
                await fetchRecords();
            } else {
              Alert.alert('Error', res.message || 'No se pudo eliminar el documento');
            }
          } else {
            const next = docs.filter((x) => x.id !== it.id);
            setDocs(next);
              await persistDocsBranchCache(sid, next);
              await upsertAction({ type: 'delete', id: it.id, corpoId: sid, clienteId: cid });
            Alert.alert('Eliminado (offline)', 'La eliminación se sincronizará cuando vuelva la conexión.');
            }
          } finally {
            setDeletingDocKey((prev) => (prev === rowKey ? null : prev));
          }
        },
      },
    ]);
  };

  const resetAllFilters = () => {
    setFilterSearch('');
    setFilterFecha('');
    void (async () => {
      await resetListFiltersFromCurrentMarca();
      await fetchRecords();
    })();
  };

  const filteredDocs = useMemo(() => {
    const q = filterSearch.trim().toLowerCase();
    return docs.filter((it) => {
      if (filterFecha) {
        const d = it.fecha ? String(it.fecha).split('T')[0] : '';
        if (d !== filterFecha) return false;
      }
      if (!q) return true;
      const haystack = `${it.tipo_documento ?? ''} ${it.nombre_oficial_entrega ?? ''} ${it.nombre_oficial_recibe ?? ''} ${it.descripcion ?? ''
        }`.toLowerCase();
      return haystack.includes(q);
    });
  }, [docs, filterSearch, filterFecha]);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpanded = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // firma: modal flotante con recuadro claro + readSignature()
  const openSignatureModal = () => {
    setIsReadingSignature(false);
    setSignatureKey((k) => k + 1);
    setIsSignatureModalVisible(true);
  };
  const closeSignatureModal = () => {
    setIsSignatureModalVisible(false);
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
  const handleSignatureRead = (signature: string) => {
    const sig = String(signature || '').trim();
    if (!sig || sig.length < 10) {
      Alert.alert('Error', 'No se detectó la firma. Intenta de nuevo.');
      setIsReadingSignature(false);
      return;
    }
    setFirmaCliente(sig);
    setIsReadingSignature(false);
    closeSignatureModal();
  };

  const renderItem = (it: DocUI, index: number) => {
    const key = it.id !== 0 ? `doc-${it.id}` : it.id_local ? `doc-${it.id_local}` : `doc-${index}`;
    const isExp = expanded.has(key);
    const d = it.fecha ? String(it.fecha).split('T')[0] : '';
    return (
      <ThemedView key={key} style={styles.card}>
        <ThemedText style={styles.cardTitle}>
          {it.tipo_documento || 'Documento'}
          {it.id_local ? ' (offline)' : ''}
        </ThemedText>

        <ThemedText style={styles.line}>
          <ThemedText style={styles.labelInline}>Fecha: </ThemedText>
          <ThemedText style={styles.valueInline}>{convertDateTimestampToLocalString(new Date(d).toISOString(), false)}</ThemedText>
        </ThemedText>
        <ThemedText style={styles.line}>
          <ThemedText style={styles.labelInline}>Entrega: </ThemedText>
          <ThemedText style={styles.valueInline}>{it.nombre_oficial_entrega}</ThemedText>
        </ThemedText>
        <ThemedText style={styles.line}>
          <ThemedText style={styles.labelInline}>Recibe: </ThemedText>
          <ThemedText style={styles.valueInline}>{it.nombre_oficial_recibe}</ThemedText>
        </ThemedText>

        <TouchableOpacity style={styles.collapseButton} onPress={() => toggleExpanded(key)}>
          <ThemedText style={styles.collapseButtonText}>{isExp ? 'Ocultar detalles' : 'Ver detalles'}</ThemedText>
          <Ionicons name={isExp ? 'chevron-up' : 'chevron-down'} size={20} color="#007AFF" />
        </TouchableOpacity>

        {isExp && (
          <ThemedView style={styles.collapseContent}>
            <ThemedText style={styles.line}>
              <ThemedText style={styles.labelInline}>Descripción: </ThemedText>
              <ThemedText style={styles.valueInline}>{it.descripcion || '-'}</ThemedText>
            </ThemedText>

            <ThemedText style={styles.sectionTitle}>Firma representante cliente</ThemedText>
            {it.firma_representante_cliente ? (
              <ThemedView style={styles.signaturePreviewContainer}>
                <Image source={{ uri: it.firma_representante_cliente }} style={styles.signaturePreview} resizeMode="contain" />
              </ThemedView>
            ) : (
              <ThemedText style={styles.signatureHintMuted}>Aún no hay firma.</ThemedText>
            )}

            <ThemedText style={styles.sectionTitle}>Firma responsable</ThemedText>
            {!(it as any).firma_responsable ? (
              <ThemedText style={styles.signatureHintMuted}>Aún no hay firma responsable.</ThemedText>
            ) : (
              <ThemedView style={[styles.firmaInfoBox, { marginTop: 10 }]}>
                <ThemedView style={{ flex: 1, paddingRight: 10 }}>
                  <ThemedText style={styles.firmaInfoTitle}>Información de la firma:</ThemedText>
                  {(() => {
                    const info = decodeFirmaHash((it as any).firma_responsable);
                    if (!info) {
                      return <ThemedText style={styles.firmaInfoValue}>Formato no decodificable</ThemedText>;
                    }
                    return (
                      <>
                        <ThemedText style={styles.firmaInfoValue}>Sesión: {info.sessionId || 'N/A'}</ThemedText>
                        <ThemedText style={styles.firmaInfoValue}>Empleado: {info.empleadoId || 'N/A'}</ThemedText>
                        <ThemedText style={styles.firmaInfoValue}>
                          Lat: {info.latitud || 'N/A'} | Long: {info.longitud || 'N/A'}
                        </ThemedText>
                        <ThemedText style={styles.firmaInfoValue}>Hora: {convertDateTimestampToLocalString(new Date(Number(info.timestamp)).toISOString()) || 'N/A'}</ThemedText>
                      </>
                    );
                  })()}
                </ThemedView>
              </ThemedView>
            )}
          </ThemedView>
        )}

        <ThemedView style={styles.rowButtons}>
          <TouchableOpacity style={[styles.rowButton, styles.editButton]} onPress={() => startEditing(it)}>
            <Ionicons name="pencil" size={18} color="#FFFFFF" />
            <ThemedText style={styles.rowButtonText}>Editar</ThemedText>
          </TouchableOpacity>
          {!(it.id_local || it.id === 0) && (
            <TouchableOpacity
              style={[styles.rowButton, styles.changesButton]}
              onPress={() => {
                setCambiosTitle(`Cambios - Documento #${it.id}`);
                fetchCambios('e_control_documento_entregado_cliente', it.id);
              }}
            >
              <Ionicons name="list-outline" size={18} color="#FFFFFF" />
              <ThemedText style={styles.rowButtonText}>Cambios</ThemedText>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.rowButton, styles.deleteButton, deletingDocKey === key && styles.buttonDisabled]}
            onPress={() => handleDelete(it)}
            disabled={deletingDocKey === key}
          >
            {deletingDocKey === key ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
            <Ionicons name="trash" size={18} color="#FFFFFF" />
            <ThemedText style={styles.rowButtonText}>Eliminar</ThemedText>
              </>
            )}
          </TouchableOpacity>
        </ThemedView>
      </ThemedView>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <AppHeader onMenuPress={handleMenuPress} title="Documentos entregados" />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <ThemedView style={styles.content}>
          <ThemedView style={styles.titleContainer}>
            <ThemedText type="title" style={styles.title}>
              <Ionicons name="file-tray-full" size={22} color="#000000" /> Documentos entregados
            </ThemedText>
            <ThemedText style={styles.subtitle}>Control de documentos entregados al cliente</ThemedText>
          </ThemedView>

          {!hasCurrentMarca ? (
            <ThemedView style={styles.emptyContainer}>
              <ThemedText style={styles.errorText}>Debes tener una marca activa para usar este módulo.</ThemedText>
            </ThemedView>
          ) : null}

          {/* Filtros */}
          {!isCreating && !isLoading && (
            <ThemedView style={styles.filtersMain}>
              <ThemedView style={styles.filterHeader}>
                <TouchableOpacity style={styles.filterToggleButton} onPress={() => setIsFiltersExpanded(!isFiltersExpanded)}>
                  <ThemedText style={styles.filterToggleText}>Filtros</ThemedText>
                  <Ionicons name={isFiltersExpanded ? 'chevron-up' : 'chevron-down'} size={20} color="#007AFF" />
                </TouchableOpacity>
                {isFiltersExpanded && (
                  <TouchableOpacity
                    style={styles.resetFiltersButton}
                    onPress={() => {
                      resetAllFilters();
                    }}
                  >
                    <Ionicons name="refresh" size={16} color="#FF3B30" />
                    <ThemedText style={styles.resetFiltersText}>Reiniciar</ThemedText>
                  </TouchableOpacity>
                )}
              </ThemedView>
              {isFiltersExpanded && (
                <ThemedView style={styles.filterContent}>
                  {roleName != null && roleName !== 'OPERATIVO' ? (
                    <>
                      {isStructureLoading ? (
                        <ThemedView style={styles.inlineLoading}>
                          <ActivityIndicator size="small" color="#007AFF" />
                          <ThemedText style={styles.inlineLoadingText}>Cargando estructura...</ThemedText>
                        </ThemedView>
                      ) : structure.length === 0 ? (
                        <ThemedText style={styles.emptyText}>Sin estructura en caché.</ThemedText>
                      ) : (
                        <>
                          <ThemedText style={styles.filterHierarchyTitle}>Jerarquía (lista)</ThemedText>
                          <ThemedView style={styles.filterGroup}>
                            <ThemedText style={styles.filterLabel}>Empresa</ThemedText>
                            <View style={styles.pickerWrapper}>
                              <Picker
                                selectedValue={filterEmpresaId ?? 0}
                                onValueChange={(v) => {
                                  const next = Number(v) || 0;
                                  setFilterEmpresaId(next === 0 ? null : next);
                                  setFilterClienteId(null);
                                  setFilterDivisionId(null);
                                  setFilterContratoId(null);
                                  setFilterSucursalId(null);
                                  filterSucursalIdRef.current = null;
                                }}
                                style={styles.picker}
                              >
                                <Picker.Item label="Seleccione empresa..." value={0} color="#000000" />
                                {filterEmpresaOptions.map((e) => (
                                  <Picker.Item key={e.id} label={e.nombre} value={e.id} color="#000000" />
                                ))}
                              </Picker>
                            </View>
                          </ThemedView>
                          <ThemedView style={styles.filterGroup}>
                            <ThemedText style={styles.filterLabel}>Cliente</ThemedText>
                            <View style={styles.pickerWrapper}>
                              <Picker
                                enabled={filterEmpresaId != null && filterClienteOptionsMemo.length > 0}
                                selectedValue={filterClienteId ?? 0}
                                onValueChange={(v) => {
                                  const next = Number(v) || 0;
                                  setFilterClienteId(next === 0 ? null : next);
                                  setFilterDivisionId(null);
                                  setFilterContratoId(null);
                                  setFilterSucursalId(null);
                                  filterSucursalIdRef.current = null;
                                }}
                                style={styles.picker}
                              >
                                <Picker.Item
                                  label={filterEmpresaId ? 'Seleccione cliente...' : 'Seleccione empresa primero'}
                                  value={0}
                                  color="#000000"
                                />
                                {filterClienteOptionsMemo.map((c) => (
                                  <Picker.Item key={c.id} label={c.nombre} value={c.id} color="#000000" />
                                ))}
                              </Picker>
                            </View>
                          </ThemedView>
                          <ThemedView style={styles.filterGroup}>
                            <ThemedText style={styles.filterLabel}>División</ThemedText>
                            <View style={styles.pickerWrapper}>
                              <Picker
                                enabled={filterClienteId != null && filterDivisionOptionsMemo.length > 0}
                                selectedValue={filterDivisionId ?? 0}
                                onValueChange={(v) => {
                                  const next = Number(v) || 0;
                                  setFilterDivisionId(next === 0 ? null : next);
                                  setFilterContratoId(null);
                                  setFilterSucursalId(null);
                                  filterSucursalIdRef.current = null;
                                }}
                                style={styles.picker}
                              >
                                <Picker.Item
                                  label={filterClienteId ? 'Seleccione división...' : 'Seleccione cliente primero'}
                                  value={0}
                                  color="#000000"
                                />
                                {filterDivisionOptionsMemo.map((d) => (
                                  <Picker.Item key={d.id} label={d.nombre} value={d.id} color="#000000" />
                                ))}
                              </Picker>
                            </View>
                          </ThemedView>
                          <ThemedView style={styles.filterGroup}>
                            <ThemedText style={styles.filterLabel}>Contrato</ThemedText>
                            <View style={styles.pickerWrapper}>
                              <Picker
                                enabled={filterDivisionId != null && filterContratoOptionsMemo.length > 0}
                                selectedValue={filterContratoId ?? 0}
                                onValueChange={(v) => {
                                  const next = Number(v) || 0;
                                  setFilterContratoId(next === 0 ? null : next);
                                  setFilterSucursalId(null);
                                  filterSucursalIdRef.current = null;
                                }}
                                style={styles.picker}
                              >
                                <Picker.Item
                                  label={filterDivisionId ? 'Seleccione contrato...' : 'Seleccione división primero'}
                                  value={0}
                                  color="#000000"
                                />
                                {filterContratoOptionsMemo.map((c) => (
                                  <Picker.Item key={c.id} label={c.nombre} value={c.id} color="#000000" />
                                ))}
                              </Picker>
                            </View>
                          </ThemedView>
                          <ThemedView style={styles.filterGroup}>
                            <ThemedText style={styles.filterLabel}>Sucursal (corpo)</ThemedText>
                            <View style={styles.pickerWrapper}>
                              <Picker
                                enabled={filterContratoId != null && filterSucursalOptionsMemo.length > 0}
                                selectedValue={filterSucursalId ?? 0}
                                onValueChange={(v) => {
                                  const next = Number(v) || 0;
                                  const nextSuc = next === 0 ? null : next;
                                  filterSucursalIdRef.current = nextSuc;
                                  setFilterSucursalId(nextSuc);
                                  void fetchRecords();
                                }}
                                style={styles.picker}
                              >
                                <Picker.Item
                                  label={filterContratoId ? 'Seleccione sucursal...' : 'Seleccione contrato primero'}
                                  value={0}
                                  color="#000000"
                                />
                                {filterSucursalOptionsMemo.map((s) => (
                                  <Picker.Item key={s.id} label={s.nombre} value={s.id} color="#000000" />
                                ))}
                              </Picker>
                            </View>
                          </ThemedView>
                        </>
                      )}
                    </>
                  ) : null}

                  <ThemedView style={styles.filterGroup}>
                    <ThemedText style={styles.filterLabel}>Buscar (tipo/nombres/desc):</ThemedText>
                    <TextInput
                      style={styles.searchInput}
                      value={filterSearch}
                      onChangeText={setFilterSearch}
                      placeholder="Ej: Contrato / Juan / Entrega..."
                      placeholderTextColor="#999"
                    />
                  </ThemedView>

                  <ThemedView style={styles.filterGroup}>
                    <ThemedText style={styles.filterLabel}>Fecha:</ThemedText>
                    <TouchableOpacity style={styles.dateButton} onPress={() => setShowFilterFechaPicker(true)}>
                      <ThemedText style={styles.dateButtonText}>{filterFecha ? convertDateTimestampToLocalString(new Date(filterFecha).toISOString(), false) : 'Seleccionar fecha'}</ThemedText>
                      <Ionicons name="calendar-outline" size={18} color="#007AFF" />
                    </TouchableOpacity>
                  </ThemedView>
                </ThemedView>
              )}
            </ThemedView>
          )}

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

              {isStructureLoading ? (
                <ThemedView style={styles.inlineLoading}>
                  <ActivityIndicator size="small" color="#007AFF" />
                  <ThemedText style={styles.inlineLoadingText}>Cargando estructura...</ThemedText>
                </ThemedView>
              ) : null}

              {roleName != null && roleName !== 'OPERATIVO' ? (
                <>
                  <ThemedText style={styles.sectionTitle}>Jerarquía (hasta sucursal)</ThemedText>

                  <ThemedText style={styles.label}>Empresa *</ThemedText>
                  <View style={styles.pickerWrapper}>
                    <Picker
                      selectedValue={selectedEmpresaId ?? 0}
                      onValueChange={(v) => handleEmpresaChange(Number(v) || null)}
                      enabled={!editing}
                      style={styles.picker}
                    >
                      <Picker.Item label="Seleccione empresa..." value={0} color="#000000" />
                      {empresaOptions.map((e) => (
                        <Picker.Item key={e.id} label={e.nombre} value={e.id} color="#000000" />
                      ))}
                    </Picker>
                  </View>

                  <ThemedText style={styles.label}>Cliente *</ThemedText>
                  <View style={styles.pickerWrapper}>
                    <Picker
                      selectedValue={selectedClienteId ?? 0}
                      onValueChange={(v) => handleClienteChange(Number(v) || null)}
                      enabled={!editing && selectedEmpresaId !== null && clienteOptions.length > 0}
                      style={styles.picker}
                    >
                      <Picker.Item
                        label={selectedEmpresaId ? 'Seleccione cliente...' : 'Seleccione empresa primero'}
                        value={0}
                        color="#000000"
                      />
                      {clienteOptions.map((c) => (
                        <Picker.Item key={c.id} label={c.nombre} value={c.id} color="#000000" />
                      ))}
                    </Picker>
                  </View>

                  <ThemedText style={styles.label}>División *</ThemedText>
                  <View style={styles.pickerWrapper}>
                    <Picker
                      selectedValue={selectedDivisionId ?? 0}
                      onValueChange={(v) => {
                        const next = Number(v) || null;
                        setSelectedDivisionId(next);
                        setSelectedContratoId(null);
                        setSelectedSucursalId(null);
                        setSelectedPuestoId(null);
                      }}
                      enabled={!editing && selectedClienteId !== null && divisionOptions.length > 0}
                      style={styles.picker}
                    >
                      <Picker.Item
                        label={selectedClienteId ? 'Seleccione división...' : 'Seleccione cliente primero'}
                        value={0}
                        color="#000000"
                      />
                      {divisionOptions.map((d) => (
                        <Picker.Item key={d.id} label={d.nombre} value={d.id} color="#000000" />
                      ))}
                    </Picker>
                  </View>

                  <ThemedText style={styles.label}>Contrato *</ThemedText>
                  <View style={styles.pickerWrapper}>
                    <Picker
                      selectedValue={selectedContratoId ?? 0}
                      onValueChange={(v) => {
                        const next = Number(v) || null;
                        setSelectedContratoId(next);
                        setSelectedSucursalId(null);
                        setSelectedPuestoId(null);
                      }}
                      enabled={!editing && selectedDivisionId !== null && contratoOptions.length > 0}
                      style={styles.picker}
                    >
                      <Picker.Item
                        label={selectedDivisionId ? 'Seleccione contrato...' : 'Seleccione división primero'}
                        value={0}
                        color="#000000"
                      />
                      {contratoOptions.map((c) => (
                        <Picker.Item key={c.id} label={c.nombre} value={c.id} color="#000000" />
                      ))}
                    </Picker>
                  </View>

                  <ThemedText style={styles.label}>Sucursal *</ThemedText>
                  <View style={styles.pickerWrapper}>
                    <Picker
                      selectedValue={selectedSucursalId ?? 0}
                      onValueChange={(v) => {
                        setSelectedSucursalId(Number(v) || null);
                        setSelectedPuestoId(null);
                      }}
                      enabled={!editing && selectedContratoId !== null && sucursalOptions.length > 0}
                      style={styles.picker}
                    >
                      <Picker.Item
                        label={selectedContratoId ? 'Seleccione sucursal...' : 'Seleccione contrato primero'}
                        value={0}
                        color="#000000"
                      />
                      {sucursalOptions.map((s) => (
                        <Picker.Item key={s.id} label={s.nombre} value={s.id} color="#000000" />
                      ))}
                    </Picker>
                  </View>

                  <ThemedText style={styles.label}>Puesto *</ThemedText>
                  <View style={styles.pickerWrapper}>
                    <Picker
                      selectedValue={selectedPuestoId ?? 0}
                      onValueChange={(v) => setSelectedPuestoId(Number(v) || null)}
                      enabled={!editing && selectedSucursalId !== null && formPuestoOptions.length > 0}
                      style={styles.picker}
                    >
                      <Picker.Item
                        label={selectedSucursalId ? 'Seleccione puesto...' : 'Seleccione sucursal primero'}
                        value={0}
                        color="#000000"
                      />
                      {formPuestoOptions.map((p) => (
                        <Picker.Item key={p.id} label={p.nombre} value={p.id} color="#000000" />
                      ))}
                    </Picker>
                  </View>
                </>
              ) : null}

              {roleName === 'OPERATIVO' ? (
                <ThemedView>
                  <ThemedText style={styles.sectionTitle}>Puesto (sucursal de la marca) *</ThemedText>
                  <ThemedText style={styles.label}>Puesto *</ThemedText>
                  <View style={styles.pickerWrapper}>
                    <Picker
                      selectedValue={selectedPuestoId ?? marcaPuestoId ?? 0}
                      onValueChange={(v) => setSelectedPuestoId(Number(v) || null)}
                      enabled={!editing && operativoPuestoOptions.length > 0}
                      style={styles.picker}
                    >
                      <Picker.Item
                        label={marcaCorpoId ? 'Seleccione puesto...' : 'Sin sucursal en la marca'}
                        value={0}
                        color="#000000"
                      />
                      {operativoPuestoOptions.map((p) => (
                        <Picker.Item key={p.id} label={p.nombre} value={p.id} color="#000000" />
                      ))}
                    </Picker>
                  </View>
                </ThemedView>
              ) : null}

              <ThemedText style={styles.label}>Fecha *</ThemedText>
              <TouchableOpacity style={styles.dateButton} onPress={() => setShowFechaPicker(true)}>
                <ThemedText style={styles.dateButtonText}>{fecha ? convertDateTimestampToLocalString(new Date(fecha).toISOString(), false) : 'Seleccionar fecha'}</ThemedText>
                <Ionicons name="calendar-outline" size={18} color="#007AFF" />
              </TouchableOpacity>

              <ThemedText style={styles.label}>Nombre oficial que entrega *</ThemedText>
              <TextInput style={styles.input} placeholder="Nombre" placeholderTextColor="#999" value={nombreEntrega} onChangeText={setNombreEntrega} />

              <ThemedText style={styles.label}>Nombre oficial que recibe *</ThemedText>
              <TextInput style={styles.input} placeholder="Nombre" placeholderTextColor="#999" value={nombreRecibe} onChangeText={setNombreRecibe} />

              <ThemedText style={styles.label}>Tipo de documento *</ThemedText>
              <View style={styles.selectButton}>
                <Picker
                  selectedValue={tipoDocumento}
                  onValueChange={(value) => setTipoDocumento(String(value || ''))}
                  style={styles.selectPicker}
                >
                  <Picker.Item label="Seleccionar tipo de documento" value="" color="#000000" />
                  {documentTypes.map((t) => (
                    <Picker.Item key={String(t.id)} label={t.nombre} value={t.nombre} color="#000000" />
                  ))}
                </Picker>
              </View>

              <ThemedText style={styles.label}>Descripción *</ThemedText>
              <TextInput
                style={[styles.input, styles.textArea]}
                multiline
                placeholder="Descripción..."
                placeholderTextColor="#999"
                value={descripcion}
                onChangeText={setDescripcion}
              />

              <ThemedText style={styles.sectionTitle}>Firma representante cliente (opcional)</ThemedText>
              {firmaCliente ? (
                <ThemedView style={styles.signaturePreviewContainer}>
                  <Image source={{ uri: firmaCliente }} style={styles.signaturePreview} resizeMode="contain" />
                  <TouchableOpacity style={styles.removeSignatureButton} onPress={() => setFirmaCliente('')}>
                    <Ionicons name="trash" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </ThemedView>
              ) : null}

              <TouchableOpacity style={styles.openSignatureButton} onPress={openSignatureModal}>
                <Ionicons name="create-outline" size={20} color="#000000" />
                <ThemedText style={styles.openSignatureButtonText}>{firmaCliente ? 'Modificar firma' : 'Agregar firma'}</ThemedText>
              </TouchableOpacity>

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
                          <ThemedText style={styles.firmaInfoValue}>
                            Lat: {info.latitud || 'N/A'} | Long: {info.longitud || 'N/A'}
                          </ThemedText>
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
                  onPress={handleSave}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="save" size={18} color="#fff" />
                      <ThemedText style={styles.formActionSaveText}>Aceptar</ThemedText>
                    </>
                  )}
                </TouchableOpacity>
              </ThemedView>
            </ThemedView>
          )}

          {/* Lista (oculta mientras se crea/edita) */}
          {!isCreating && (
            <>
              {isLoading ? (
                <ThemedView style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#007AFF" />
                  <ThemedText style={styles.loadingText}>Cargando...</ThemedText>
                </ThemedView>
              ) : filteredDocs.length === 0 ? (
                <ThemedView style={styles.emptyContainer}>
                  <ThemedText style={styles.emptyText}>No hay registros</ThemedText>
                </ThemedView>
              ) : (
                <ThemedView style={styles.listContainer}>{filteredDocs.map(renderItem)}</ThemedView>
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

      {showFechaPicker && (
        <DateTimePicker
          value={fecha ? parseDateStringToDate(fecha) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, date) => {
            setShowFechaPicker(false);
            if (date) setFecha(dateToLocalString(date));
          }}
        />
      )}

      {/* Modal select tipo_documento */}
      <Modal visible={isDocTypeModalVisible} transparent animationType="fade" onRequestClose={() => setIsDocTypeModalVisible(false)}>
        <View style={styles.overlay}>
          <ThemedView style={styles.floatModalCard}>
            <ThemedView style={styles.floatModalHeader}>
              <ThemedText style={styles.modalTitle}>Tipo de documento</ThemedText>
              <TouchableOpacity onPress={() => setIsDocTypeModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </ThemedView>
            <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ padding: 12 }}>
              {documentTypes.length === 0 ? (
                <ThemedText style={styles.signatureHintMuted}>No hay tipos disponibles (sin conexión y sin cache).</ThemedText>
              ) : (
                documentTypes.map((t) => (
                  <TouchableOpacity
                    key={String(t.id)}
                    style={[styles.optionRow, tipoDocumento === t.nombre && styles.optionRowSelected]}
                    onPress={() => {
                      setTipoDocumento(t.nombre);
                      setIsDocTypeModalVisible(false);
                    }}
                  >
                    <ThemedText style={styles.optionText}>{t.nombre}</ThemedText>
                    {tipoDocumento === t.nombre ? <Ionicons name="checkmark" size={18} color="#34C759" /> : null}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </ThemedView>
        </View>
      </Modal>

      {/* Modal flotante firma */}
      <Modal
        visible={isSignatureModalVisible}
        animationType="fade"
        transparent
        presentationStyle="overFullScreen"
        onRequestClose={closeSignatureModal}
      >
        <View style={styles.overlay}>
          <ThemedView style={styles.floatModalCard}>
            <ThemedView style={styles.floatModalHeader}>
              <ThemedText style={styles.modalTitle}>Dibujar firma</ThemedText>
              <TouchableOpacity onPress={closeSignatureModal}>
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
                {isReadingSignature ? <ActivityIndicator size="small" color="#000000" /> : <Ionicons name="checkmark" size={20} color="#000000" />}
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
                  const createdAtLabel = convertDateTimestampToLocalString(new Date(row?.created_at).toISOString()); 
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
                                const isFirmaCliente = prop === 'firma_representante_cliente';
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
                                        if (k === 'firma_representante_cliente') {
                                          return (
                                            <ThemedView key={`c-${row.id}-${idx}-${k}`} style={styles.changeDescriptionContainer}>
                                              <ThemedText style={styles.changeDescription}>
                                                <ThemedText style={{ fontWeight: '800' }}>{k}: </ThemedText>
                                              </ThemedText>
                                              {v ? (
                                                <Image source={{ uri: formatSignatureForDisplay(typeof v === 'string' ? v : String(v)) || '' }} style={styles.cambioSignatureImage} resizeMode="contain" />
                                              ) : (
                                                <ThemedText style={styles.changeDescription}>—</ThemedText>
                                              )}
                                            </ThemedView>
                                          );
                                        }
                                        if (k === 'firma_responsable') {
                                          const info = decodeFirmaHash(typeof v === 'string' ? v : v != null ? String(v) : null);
                                          return (
                                            <ThemedView key={`c-${row.id}-${idx}-${k}`} style={styles.changeDescriptionContainer}>
                                              <ThemedText style={styles.changeDescription}>
                                                <ThemedText style={{ fontWeight: '800' }}>{k}: </ThemedText>
                                                {info ? `Sesión: ${info.sessionId || 'N/A'} - Empleado: ${info.empleadoId || 'N/A'} - Hora: ${convertDateTimestampToLocalString(new Date(Number(info.timestamp)).toISOString()) || 'N/A'}` : 'Firma (formato no decodificable)'}
                                              </ThemedText>
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

                                return (
                                  <ThemedView key={`c-${row.id}-${idx}`} style={styles.changeDescriptionContainer}>
                                    <ThemedText style={styles.changeDescription}>
                                      <ThemedText style={{ fontWeight: '800' }}>{prop}: </ThemedText>
                                      {!isFirmaCliente && !isFirmaResponsable && formatChangeValue(prop, value)}
                                      {isFirmaResponsable && typeof value === 'string' && value.trim() && (() => {
                                        const info = decodeFirmaHash(value);
                                        return info ? `Sesión: ${info.sessionId || 'N/A'} - Empleado: ${info.empleadoId || 'N/A'} - Hora: ${ convertDateTimestampToLocalString(new Date(Number(info.timestamp)).toISOString()) || 'N/A'}` : 'Firma (formato no decodificable)';
                                      })()}
                                    </ThemedText>
                                    {isFirmaCliente && value && (
                                      <Image source={{ uri: formatSignatureForDisplay(value) || '' }} style={styles.cambioSignatureImage} resizeMode="contain" />
                                    )}
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
      <SlideMenu isVisible={isMenuVisible} onClose={handleMenuClose} onHomePress={handleHomePress} currentRoute="DocumentosEntregados" />
      {QRScannerComponent}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },
  content: { width: '100%', maxWidth: 800, alignSelf: 'center' },

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
  filterGroup: { marginBottom: 8, backgroundColor: '#F9F9F9' },
  filterHierarchyTitle: { fontSize: 14, fontWeight: '800', marginBottom: 8, color: '#007AFF' },
  filterLabel: { fontSize: 13, fontWeight: '600', marginBottom: 4, color: '#000' },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    marginBottom: 8,
  },
  picker: { width: '100%', color: '#000000' },
  inlineLoading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  inlineLoadingText: { fontSize: 13, color: '#666' },
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

  selectButton: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
    marginBottom: 12,
    minHeight: 50,
    overflow: 'hidden',
  },
  selectButtonText: { color: '#000', fontWeight: '600' },
  selectPicker: {
    width: '100%',
    height: 50,
    color: '#000000',
  },

  sectionTitle: { marginTop: 14, fontSize: 15, fontWeight: '800', color: '#007AFF' },

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

  card: {
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
  cardTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10, color: '#000' },
  line: { marginBottom: 6, color: '#000' },
  labelInline: { fontWeight: '700', color: '#333' },
  valueInline: { color: '#000' },

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
  collapseContent: { marginTop: 8, padding: 10, borderRadius: 8, backgroundColor: '#F8F9FA' },

  rowButtons: { marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rowButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 8, gap: 8 },
  editButton: { backgroundColor: '#007AFF' },
  changesButton: { backgroundColor: '#5856D6', flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 8, gap: 8 },
  deleteButton: { backgroundColor: '#FF3B30' },
  rowButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },

  // overlays
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
  floatModalCardMovimientos: { backgroundColor: '#FFFFFF', borderRadius: 12, width: '100%', maxWidth: 500, maxHeight: '80%', borderWidth: 1, borderColor: '#E0E0E0', overflow: 'hidden' },
  cambioCollapsableMain: { width: '100%', marginBottom: 10, backgroundColor: '#fff', borderRadius: 6, borderWidth: 1, borderColor: '#E0E0E0', overflow: 'hidden' },
  cambioCollapsableHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#F8F9FA' },
  cambioCollapsableTitle: { fontSize: 14, fontWeight: '600', color: '#007AFF', flex: 1 },
  cambioCollapsableContent: { padding: 12, gap: 8, backgroundColor: '#F8F9FA' },
  changeDescription: { fontSize: 14, lineHeight: 20, color: '#666', marginBottom: 8 },
  changeDescriptionContainer: { marginBottom: 8 },
  cambioSignatureImage: { marginTop: 6, height: 80, width: 160, backgroundColor: '#f0f0f0', borderRadius: 4 },
  filterGroupSearch: { marginBottom: 12 },
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
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#000' },
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
  signatureHintMuted: { marginTop: 6, color: '#999' },

  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
  optionRowSelected: {
    borderColor: '#34C759',
    backgroundColor: '#EAF9EF',
  },
  optionText: { fontWeight: '800', color: '#000' },

  // Firma responsable (mismo patrón que módulos anteriores)
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
});


