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
import Ionicons from '@expo/vector-icons/Ionicons';
import SignatureScreen from 'react-native-signature-canvas';
import { CameraView, useCameraPermissions } from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import getCurrentUserDigitalSignature from '../hooks/getCurrentUserDigitalSignature';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';

import AppHeader from '../components/AppHeader';
import CambiosAppsModulesModal, { type CambiosAppsModulesRow } from '../components/CambiosAppsModulesModal';
import AppFooter from '../components/AppFooter';
import SlideMenu from '../components/SlideMenu';
import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import HierarchyPickerFields, { type HierarchyPickerValues } from '../components/HierarchyPickerFields';
import { useAuth } from '../contexts/AuthContext';
import { eventBus } from '../hooks/eventBus';
import getHoraAccion from '../hooks/getHoraAccion';
import { useQRScanner } from '../hooks/useQRScanner';
import authedFetch from '../hooks/authedFetch';
import {
  ApreciacionVulnerabilidadItem,
  createApreciacionVulnerabilidad,
  deleteApreciacionVulnerabilidadImage,
  deleteApreciacionVulnerabilidad,
  listApreciacionVulnerabilidad,
  MainStructureCliente,
  MainStructureContrato,
  MainStructureEmpresa,
  MainStructurePuesto,
  MainStructureSucursal,
  updateApreciacionVulnerabilidadFirmaSolicitante,
  updateApreciacionVulnerabilidad,
} from '../hooks/apreciacionVulnerabilidadFunctions';
import { loadMainStructureTreeMerged } from '@/hooks/bitacoraMainStructureCache';
import { getLocalFileDisplayUri, saveFile } from '@/hooks/fileStorage';
import { buildApreciacionImagenesJsonForUpload, deleteApreciacionLocalFilesFromMeta, stripApreciacionImagesForActionPayload } from '@/hooks/apreciacionVulnerabilidadFilesSync';
import Constants from 'expo-constants';
import { convertDateTimestampToLocalString } from '@/hooks/convertDateTimestampToLocalString';

/** Alcance del listado/caché: sucursal (corpo_id). */
type ApreciacionListCorpoScope = {
  filterCorpoId: number | null;
};

function makeApreciacionCorpoListMatcher(filterCorpoId: number | null): (it: any) => boolean {
  return (it: any) => {
    if (filterCorpoId == null) return true;
    return Number(it?.corpo_id) === Number(filterCorpoId);
  };
}

function apreciacionItemIsPendingLocal(it: any): boolean {
  if (it?.id_local != null && String(it.id_local).trim() !== '') return true;
  if (Number(it?.id) === 0) return true;
  return false;
}

function extractLocalImagesMetaFromBoletaJson(boletaJson?: string): Array<{ localFileName?: string }> {
  try {
    const parsed = JSON.parse(String(boletaJson || '[]'));
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((section: any) =>
      (Array.isArray(section?.items) ? section.items : [])
        .map((it: any) => ({ localFileName: it?.image?.localFileName ? String(it.image.localFileName) : undefined }))
        .filter((it: any) => !!it.localFileName)
    );
  } catch {
    return [];
  }
}

/**
 * Con respuesta online: solo reemplaza en caché filas del mismo corpo_id (y mantiene borradores locales
 * y registros de otras sucursales). Sin corpo en alcance (null), sustituye todo lo no local como antes.
 */
async function mergeApreciacionVulnerabilidadServerIntoCache(
  serverList: ApreciacionVulnerabilidadItem[],
  matchesScope: (it: any) => boolean
): Promise<ApreciacionVulnerabilidadItem[]> {
  let raw: any[] = [];
  try {
    const cacheStr = await AsyncStorage.getItem('apreciacion_vulnerabilidad_cache');
    const parsed = cacheStr ? JSON.parse(cacheStr) : [];
    raw = Array.isArray(parsed) ? parsed : [];
  } catch {
    raw = [];
  }

  const preserved = raw.filter((it: any) => !matchesScope(it) || apreciacionItemIsPendingLocal(it));

  const scopedServer = serverList
    .filter(matchesScope)
    .map((it: any) => ({ ...it, id_local: it.id_local || '' }));

  const merged = [...preserved, ...scopedServer] as ApreciacionVulnerabilidadItem[];
  await AsyncStorage.setItem('apreciacion_vulnerabilidad_cache', JSON.stringify(merged));
  return merged;
}

const APRECIACION_VULN_CACHE_KEY = 'apreciacion_vulnerabilidad_cache';

async function readApreciacionVulnerabilidadCacheFull(): Promise<any[]> {
  try {
    const cacheStr = await AsyncStorage.getItem(APRECIACION_VULN_CACHE_KEY);
    if (!cacheStr) return [];
    const parsed = JSON.parse(cacheStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeApreciacionVulnerabilidadCacheFull(rows: any[]): Promise<void> {
  await AsyncStorage.setItem(APRECIACION_VULN_CACHE_KEY, JSON.stringify(rows));
}

function sliceApreciacionItemsForCorpo(rows: any[], corpoId: number | null): any[] {
  if (corpoId == null || !Number.isFinite(Number(corpoId)) || Number(corpoId) <= 0) return [];
  const c = Number(corpoId);
  return rows.filter((it) => Number(it?.corpo_id) === c);
}

/** Sucursal para lista/merge: si `allowMarcaFallback` es false, no se usa `current_marca` (p. ej. reinicio de filtros). */
async function resolveApreciacionListCorpoId(
  filterCorpoId: number | null,
  allowMarcaFallback: boolean
): Promise<number | null> {
  if (filterCorpoId != null && Number.isFinite(Number(filterCorpoId))) {
    const n = Number(filterCorpoId);
    if (n > 0) return n;
  }
  if (!allowMarcaFallback) return null;
  try {
    const raw = await AsyncStorage.getItem('current_marca');
    if (!raw) return null;
    const c = JSON.parse(raw);
    const id = c?.corpo?.id;
    const n = Number(id);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

type VulnUI = ApreciacionVulnerabilidadItem & { id_local?: string };
type HierarchyPath = {
  empresaId: number | null;
  clienteId: number | null;
  divisionId: number | null;
  contratoId: number | null;
  corpoId: number | null;
  puestoId: number | null;
};

type HierarchyPickerOption = { id: number; label: string };

type BoletaItem = {
  id: string;
  label: string;
  answer: 'si' | 'no' | null;
  isOriginal: boolean;
  description?: string;
  image?: {
    id?: number;
    name?: string;
    url?: string;
    localFileName?: string;
    original_name?: string;
  } | null;
};

type VulnerabilityLevel = 'alta' | 'media' | 'baja';

type BoletaSection = {
  key: string;
  title: string;
  items: BoletaItem[];
  vulnerabilityLevel?: VulnerabilityLevel;
};

const PORCENTAJE_SECTION_KEY = 'porcentaje_vulnerabilidad';
const VULNERABILITY_LEVEL_OPTIONS: Array<{ value: VulnerabilityLevel; label: string }> = [
  { value: 'alta', label: 'Alta' },
  { value: 'media', label: 'Media' },
  { value: 'baja', label: 'Baja' },
];

const BOLETA_DEFAULTS: { key: string; title: string; items: string[] }[] = [
  {
    key: 'entorno',
    title: 'Entorno',
    items: [
      'Las instalaciones están ubicadas en zona industrial',
      'Las instalaciones están ubicadas en zona residencial',
      'Las instalaciones están ubicadas sobre una autopista',
      'Existen depósitos de materiales inflamables cerca de las instalaciones, precarios o zonas de delincuencia',
    ],
  },
  {
    key: 'transito_accesos',
    title: 'Tránsito y accesos',
    items: [
      'Las puertas permiten la fácil evacuación en caso de siniestros o desastres naturales',
      'Cuenta la organización con un armario que permite el almacenamiento general de llaves',
      'La zona de parqueo está organizada en zonas independientes o es una sola área',
      'Está delimitada la zona de tránsito para los vehículos de carga que ingresan a la empresa',
      'Hay un control definido de acceso a las instalaciones',
      'Existe un procedimiento que indique el manejo de llaves',
      'Está delimitada la zona para la flotilla, los vehículos del personal y los vehículos de uso discrecional',
      'Está delimitado el parqueo para visitantes y clientes',
    ],
  },
  {
    key: 'perimetro',
    title: 'Perímetro',
    items: [
      'Existen barreras que impiden el fácil acceso a personas o vehículos desde y hacia el exterior',
      'Están los muros construidos de forma compacta y resistente para prevenir o retardar una intrusión',
      'Está compuesta la cerca por malla de alambre número nueve con aperturas de dos pulgadas',
      'Tienen las mallas las mismas características y condiciones de altura que los muros',
      'El exterior al perímetro es de fácil control como prevención de lo que suceda en extramuros',
      'Hay posibilidad que el perímetro externo se utilice como zona de negocios ilícitos y observación',
      'Los sistemas externos de iluminación y alarmas funcionan perfectamente',
      'Se pueden cerrar algunos portones o puertas para evitar accesos innecesarios',
      'Se requieren casetas perimetrales dado que las instalaciones son extensas y los límites son alejados',
      'Hay reflectores con la suficiente capacidad para las áreas extensas',
      'Se tienen definidas las vías de aproximación a las puertas vehiculares y peatonales',
      'La altura de los muros es igual o superior a los 2.50 metros',
      'Tiene la cerca al menos tres filas de alambre de púas o de navaja en ángulos de 30 a 40 grados hacia afuera',
      'Es necesaria una barrera paralela a la malla principal para construir unas zanjas anchas y profundas',
      'Hay posibilidad que el perímetro externo se utilice como zona de estacionamiento informal',
      'El perímetro interno se encuentra libre de artefactos que no permiten el escalamiento',
      'Muros, cercas, mallas, alambre de navajas se encuentran en perfecto estado',
      'Se requiere protección armada en la línea física que fija la frontera entre la compañía y la comunidad',
      'Existe una excelente iluminación del perímetro y de las estructuras ubicadas en el sitio',
      'Existe un sistema de iluminación para áreas críticas',
    ],
  },
  {
    key: 'seguridad_electronica',
    title: 'Seguridad electrónica',
    items: [
      'Existe protección electrónica que complemente la labor que cumple el personal',
      'Existe en la organización un centro de monitoreo',
      'Se cuenta con las condiciones que permitan una fácil instalación de líneas telefónicas, radios, alarmas, etc.',
      'Existen las condiciones para la implementación de un centro de monitoreo',
    ],
  },
  {
    key: 'estructura_instalaciones_1',
    title: 'Estructura e instalaciones',
    items: [
      'Cuentan todas las estructuras con las condiciones apropiadas para realizar recorridos de vigilancia',
      'Están acondicionadas todas las estructuras con sistemas contra incendios',
      'Hay un plan preventivo estructurado de brigada que ayuden en un siniestro',
      'Existe una buena iluminación dentro de las estructuras que se encuentran ubicadas en el sitio',
    ],
  },
  {
    key: 'estructura_instalaciones_2',
    title: 'Estructura e instalaciones',
    items: ['La iluminación abarca todo el area a cuidar', 'La iluminación abarca toda el area perimetral', 'Existe planta electrica', 'Se cuenta con el mantenimiento debido'],
  },
  {
    key: 'porcentaje_vulnerabilidad',
    title: 'Porcentaje de vulnerabilidad',
    items: [],
  },
];

const makeDefaultBoleta = (): BoletaSection[] =>
  BOLETA_DEFAULTS.map((s) => ({
    key: s.key,
    title: s.title,
    items: s.items.map((label, idx) => ({
      id: `${s.key}-${idx}`,
      label,
      answer: null,
      isOriginal: true,
    })),
    ...(s.key === PORCENTAJE_SECTION_KEY ? { vulnerabilityLevel: 'baja' as VulnerabilityLevel } : {}),
  }));

const normalizeVulnerabilityLevel = (value: any): VulnerabilityLevel => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'alta') return 'alta';
  if (normalized === 'media') return 'media';
  return 'baja';
};

const getVulnerabilityLevelLabel = (value: any): string => {
  const normalized = normalizeVulnerabilityLevel(value);
  return VULNERABILITY_LEVEL_OPTIONS.find((o) => o.value === normalized)?.label || 'Baja';
};

const getMarcaRoleDivisionId = (current: any): number | null => {
  const raw = current?.roleDivision?.division?.id
    ?? current?.role_division?.division?.id
    ?? current?.division?.id
    ?? current?.division_id;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Rama `division` del merge (alias `divisiones` en algunos nodos). */
function getClienteDivisionArray(cliente: any): any[] {
  if (!cliente) return [];
  if (Array.isArray(cliente.division)) return cliente.division;
  if (Array.isArray(cliente.divisiones)) return cliente.divisiones;
  return [];
}

function findDivisionIdForContratoInStructure(
  tree: MainStructureEmpresa[],
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
    const contratos: any[] = Array.isArray(div?.contratos) ? div.contratos : [];
    if (contratos.some((ct: any) => Number(ct.id) === Number(contratoId))) {
      return Number(div.id);
    }
  }
  return null;
}

function resolveDivisionIdInStructure(
  tree: MainStructureEmpresa[],
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

/** División para filtros/formulario: marca + árbol mergeado (`loadMainStructureTreeMerged`). */
function resolveMarcaDivisionForTree(current: any, tree: MainStructureEmpresa[]): number | null {
  const empresaId = current?.empresa?.id != null ? Number(current.empresa.id) : null;
  const clienteId = current?.cliente?.id != null ? Number(current.cliente.id) : null;
  const contratoId = current?.contrato?.id != null ? Number(current.contrato.id) : null;
  let divId = getMarcaRoleDivisionId(current);
  if (divId == null && empresaId && clienteId && contratoId && Array.isArray(tree) && tree.length > 0) {
    divId = findDivisionIdForContratoInStructure(tree, empresaId, clienteId, contratoId);
  }
  if (divId == null) return null;
  return resolveDivisionIdInStructure(tree, empresaId, clienteId, divId);
}

function resolveByPuestoIdInTree(
  tree: MainStructureEmpresa[],
  targetPuestoId?: number | null,
): HierarchyPath | null {
  const pid = Number(targetPuestoId || 0);
  if (!pid) return null;
  for (const e of tree) {
    for (const c of e.clientes || []) {
      for (const d of getClienteDivisionArray(c)) {
        for (const co of d.contratos || []) {
          for (const s of co.sucursales || []) {
            const found = (s.puestos || []).find((p: MainStructurePuesto) => Number(p.id) === pid);
            if (!found) continue;
            return {
              empresaId: Number(e.id),
              clienteId: Number(c.id),
              divisionId: Number(d.id),
              contratoId: Number(co.id),
              corpoId: Number(s.id),
              puestoId: Number(found.id),
            };
          }
        }
      }
    }
  }
  return null;
}

const getLegacyVulnerabilityLevelFromItems = (items: any[]): VulnerabilityLevel => {
  const selected = (Array.isArray(items) ? items : []).find((item: any) => item?.answer === 'si');
  const selectedLabel = String(selected?.label || '').toLowerCase();
  if (selectedLabel.includes('alta')) return 'alta';
  if (selectedLabel.includes('media')) return 'media';
  if (selectedLabel.includes('baja')) return 'baja';
  return 'baja';
};

const normalizeBoletaSections = (value: any): BoletaSection[] => {
  const defaults = makeDefaultBoleta();
  const parsedSections = Array.isArray(value) ? value : [];

  const parsedMap = new Map(
    parsedSections.map((raw: any) => {
      const key = String(raw?.key || '');
      const title = String(raw?.title || '');
      const items: BoletaItem[] = (Array.isArray(raw?.items) ? raw.items : []).map((item: any, idx: number) => ({
        id: String(item?.id || `${key}-${idx}`),
        label: String(item?.label || ''),
        answer: item?.answer === 'si' || item?.answer === 'no' ? item.answer : null,
        isOriginal: item?.isOriginal !== false,
        description: typeof item?.description === 'string' ? item.description : '',
        image: item?.image
          ? {
            id: item.image?.id != null ? Number(item.image.id) : undefined,
            name: item.image?.name ? String(item.image.name) : undefined,
            url: item.image?.url ? String(item.image.url) : undefined,
            localFileName: item.image?.localFileName ? String(item.image.localFileName) : undefined,
            original_name: item.image?.original_name ? String(item.image.original_name) : undefined,
          }
          : null,
      }));
      const section: BoletaSection = { key, title, items };
      if (key === PORCENTAJE_SECTION_KEY) {
        section.vulnerabilityLevel = normalizeVulnerabilityLevel(
          raw?.vulnerabilityLevel ?? getLegacyVulnerabilityLevelFromItems(raw?.items || [])
        );
      }
      return [key, section] as const;
    })
  );

  const merged = defaults.map((defaultSection) => {
    const existing = parsedMap.get(defaultSection.key);
    if (!existing) return defaultSection;

    if (defaultSection.key === PORCENTAJE_SECTION_KEY) {
      return {
        ...defaultSection,
        ...existing,
        items: [],
        vulnerabilityLevel: normalizeVulnerabilityLevel(
          existing.vulnerabilityLevel ?? getLegacyVulnerabilityLevelFromItems(existing.items || [])
        ),
      };
    }

    return {
      ...defaultSection,
      ...existing,
      items: Array.isArray(existing.items) ? existing.items : defaultSection.items,
    };
  });

  const defaultKeys = new Set(defaults.map((s) => s.key));
  const extraSections = parsedSections
    .map((raw: any) => parsedMap.get(String(raw?.key || '')))
    .filter((s): s is BoletaSection => !!s && !defaultKeys.has(s.key));

  return [...merged, ...extraSections];
};

export default function ApreciacionVulnerabilidadScreen() {
  const navigation = useNavigation<any>();
  const { employee, refreshAccessToken, logout } = useAuth();
  const { scanQR, QRScannerComponent } = useQRScanner();

  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const handleMenuPress = () => setIsMenuVisible(true);
  const handleMenuClose = () => setIsMenuVisible(false);
  const handleHomePress = () => navigation.navigate('Home');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Importante: "sin internet" NO cuenta como error (solo es un estado informativo)
  const [offlineMessage, setOfflineMessage] = useState<string | null>(null);

  const isProbablyNetworkError = (err: any) => {
    const msg = String(err?.message ?? err ?? '').toLowerCase();
    return (
      msg.includes('network request failed') ||
      msg.includes('failed to fetch') ||
      msg.includes('networkerror') ||
      msg.includes('timeout') ||
      msg.includes('timed out')
    );
  };

  const formatDateDMY = (date: Date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear());
    return `${day}-${month}-${year}`;
  };

  const [items, setItems] = useState<VulnUI[]>([]);
  const [structure, setStructure] = useState<MainStructureEmpresa[]>([]);

  // filtros
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  const [filterSearch, setFilterSearch] = useState('');
  const [filterClienteId, setFilterClienteId] = useState<number | null>(null);
  const [filterCorpoId, setFilterCorpoId] = useState<number | null>(null);
  const [filterEmpresaId, setFilterEmpresaId] = useState<number | null>(null);
  const [filterDivisionId, setFilterDivisionId] = useState<number | null>(null);
  const [filterContratoId, setFilterContratoId] = useState<number | null>(null);

  // create/edit
  const [isCreating, setIsCreating] = useState(false);
  const [editing, setEditing] = useState<VulnUI | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [submitResponse, setSubmitResponse] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const [fecha, setFecha] = useState<Date>(new Date());
  const [showFechaPicker, setShowFechaPicker] = useState(false);
  const [enlace, setEnlace] = useState('');
  const [nombreSolicitante, setNombreSolicitante] = useState('');
  const [observaciones, setObservaciones] = useState('');

  // selects (tree)
  const [empresaId, setEmpresaId] = useState<number | null>(null);
  const [clienteId, setClienteId] = useState<number | null>(null);
  const [divisionId, setDivisionId] = useState<number | null>(null);
  const [contratoId, setContratoId] = useState<number | null>(null);
  const [corpoId, setCorpoId] = useState<number | null>(null);
  const [puestoId, setPuestoId] = useState<number | null>(null);

  // dynamic boleta + metricas
  const [boleta, setBoleta] = useState<BoletaSection[]>(makeDefaultBoleta());
  const [newOptionTextBySection, setNewOptionTextBySection] = useState<Record<string, string>>({});

  const [metricasExpanded, setMetricasExpanded] = useState(false);
  const [metricas, setMetricas] = useState<string[]>([]);
  const [newMetrica, setNewMetrica] = useState('');

  // firmas
  const [firmaSolicitante, setFirmaSolicitante] = useState('');
  const [firmaResponsable, setFirmaResponsable] = useState('');
  const [isGeneratingFirma, setIsGeneratingFirma] = useState(false);
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<{ sectionKey: string; itemId: string } | null>(null);
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const [isStructureLoading, setIsStructureLoading] = useState(false);

  // modal firma dibujada
  const [isSignatureModalVisible, setIsSignatureModalVisible] = useState(false);
  const signatureRef = useRef<any>(null);
  const [signatureKey, setSignatureKey] = useState(0);
  const [isReadingSignature, setIsReadingSignature] = useState(false);
  const [signatureModalListTarget, setSignatureModalListTarget] = useState<VulnUI | null>(null);
  const savingListSolicitanteFirmaRef = useRef(false);
  const [queryAccessToken, setQueryAccessToken] = useState('');

  // Modal: ver cambios (auditoría)
  const [isCambiosModalVisible, setIsCambiosModalVisible] = useState(false);
  const [cambiosTitle, setCambiosTitle] = useState<string>('Cambios');
  const [cambiosItems, setCambiosItems] = useState<CambiosAppsModulesRow[]>([]);

  const PICKER_NONE = 0;

  const getConnectionStatus = async (): Promise<boolean> => {
    //return false;
    const networkState = await Network.getNetworkStateAsync();

    return (
      networkState.isConnected === true &&
      networkState.isInternetReachable === true
    );
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

  const formatSignatureForDisplay = (value?: string | null) => {
    if (!value) return '';
    return value.startsWith('data:') ? value : `data:image/png;base64,${value}`;
  };

  const formatFirmaDateLabel = (timestamp: string | undefined): string => {
    if (!timestamp) return '';
    const ms = Number(timestamp);
    if (!Number.isFinite(ms)) return String(timestamp);
    const d = new Date(ms);
    const date = d.toISOString().split('T')[0];
    const time = d.toISOString().split('T')[1]?.split('.')[0] ?? '';
    return `${date} ${time}`;
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

  const openFirmaSolicitanteModal = () => {
    setSignatureModalListTarget(null);
    savingListSolicitanteFirmaRef.current = false;
    setIsReadingSignature(false);
    setSignatureKey((k) => k + 1);
    setIsSignatureModalVisible(true);
  };
  const openListFirmaSolicitanteModal = (row: VulnUI) => {
    setSignatureModalListTarget(row);
    savingListSolicitanteFirmaRef.current = false;
    setIsReadingSignature(false);
    setSignatureKey((k) => k + 1);
    setIsSignatureModalVisible(true);
  };
  const closeFirmaSolicitanteModal = () => {
    setIsSignatureModalVisible(false);
    setSignatureModalListTarget(null);
    savingListSolicitanteFirmaRef.current = false;
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
    if (signatureModalListTarget) {
      if (savingListSolicitanteFirmaRef.current) return;
      savingListSolicitanteFirmaRef.current = true;
      const target = signatureModalListTarget;
      void (async () => {
        try {
          const isConnected = await getConnectionStatus();
          const all = await readApreciacionVulnerabilidadCacheFull();
          let next = all.map((row: any) =>
            (Number(row.id) === Number(target.id) || String(row.id_local || '') === String(target.id_local || ''))
              ? { ...row, firma_solicitante: sig }
              : row
          );

          if (!apreciacionItemIsPendingLocal(target) && isConnected) {
            const result = await updateApreciacionVulnerabilidadFirmaSolicitante({
              id: Number(target.id),
              firma_solicitante: sig,
              refreshAccessToken,
              logout,
            });
            if (!result.status) {
              Alert.alert('Error', result.message || 'No se pudo guardar la firma del solicitante');
              return;
            }
            const sr = (result as any).data;
            next = all.map((row: any) =>
              Number(row.id) === Number(target.id)
                ? { ...row, ...(sr && typeof sr === 'object' ? sr : {}), firma_solicitante: sr?.firma_solicitante ?? sig }
                : row
            );
          } else {
            const actionsStr = await AsyncStorage.getItem('apreciacion_vulnerabilidad_actions');
            const actions = actionsStr ? JSON.parse(actionsStr) : [];
            if (target.id_local && apreciacionItemIsPendingLocal(target)) {
              const cidx = actions.findIndex((a: any) => a.type === 'create' && String(a.id) === String(target.id_local));
              if (cidx !== -1) {
                actions[cidx] = {
                  ...actions[cidx],
                  requestData: { ...actions[cidx].requestData, firma_solicitante: sig },
                };
              }
            } else if (Number(target.id) > 0) {
              const uidx = actions.findIndex((a: any) => a.type === 'update' && Number(a.id) === Number(target.id));
              if (uidx !== -1) {
                actions[uidx] = {
                  ...actions[uidx],
                  requestData: { ...actions[uidx].requestData, firma_solicitante: sig },
                };
              } else {
                const fidx = actions.findIndex((a: any) => a.type === 'update_solicitante_firma' && Number(a.id) === Number(target.id));
                const entry = {
                  type: 'update_solicitante_firma',
                  id: Number(target.id),
                  firma_solicitante: sig,
                };
                if (fidx !== -1) actions[fidx] = entry;
                else actions.push(entry);
              }
            }
            await AsyncStorage.setItem('apreciacion_vulnerabilidad_actions', JSON.stringify(actions));
          }
          await writeApreciacionVulnerabilidadCacheFull(next);
          setItems(sliceApreciacionItemsForCorpo(next, filterCorpoIdRef.current));
          closeFirmaSolicitanteModal();
        } finally {
          savingListSolicitanteFirmaRef.current = false;
          setIsReadingSignature(false);
        }
      })();
      return;
    }
    setFirmaSolicitante(sig);
    setIsReadingSignature(false);
    closeFirmaSolicitanteModal();
  };

  /**
   * Misma fuente que Activities / PhysicalMinuteAgenda: `loadMainStructureTreeMerged`.
   * Devuelve el árbol para precarga de filtros sin depender del estado asíncrono de React.
   */
  const loadMainStructureCache = useCallback(async (): Promise<MainStructureEmpresa[]> => {
    setIsStructureLoading(true);
    try {
      const parsed = await loadMainStructureTreeMerged();
      const empresas = Array.isArray(parsed) ? (parsed as MainStructureEmpresa[]) : [];
      setStructure(empresas);
      return empresas;
    } catch (e) {
      console.error('ApreciacionVulnerabilidad loadMainStructureCache:', e);
      setStructure([]);
      return [];
    } finally {
      setIsStructureLoading(false);
    }
  }, []);

  const refreshAccessTokenRef = useRef(refreshAccessToken);
  const logoutRef = useRef(logout);
  useEffect(() => {
    refreshAccessTokenRef.current = refreshAccessToken;
    logoutRef.current = logout;
  }, [refreshAccessToken, logout]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const t = await AsyncStorage.getItem('access_token');
        if (!mounted) return;
        setQueryAccessToken(t != null && String(t).trim() !== '' ? String(t).trim() : '');
      } catch {
        if (!mounted) return;
        setQueryAccessToken('');
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const appendTokenToUrl = useCallback((url: string): string => {
    if (!url) return '';
    const token = queryAccessToken.trim();
    if (!token) return url;
    if (/[?&]token=/.test(url)) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}token=${encodeURIComponent(token)}`;
  }, [queryAccessToken]);

  const filterCorpoIdRef = useRef(filterCorpoId);
  filterCorpoIdRef.current = filterCorpoId;

  const fetchItems = useCallback(async (scopeOverride?: ApreciacionListCorpoScope | null) => {
    const loadCacheToState = async (filterCorpoId: number | null, allowMarcaFallback: boolean) => {
      const mergeCorpoId = await resolveApreciacionListCorpoId(filterCorpoId, allowMarcaFallback);
      const all = await readApreciacionVulnerabilidadCacheFull();
      setItems(sliceApreciacionItemsForCorpo(all, mergeCorpoId));
    };

    try {
      setIsLoading(true);
      setError(null);
      setOfflineMessage(null);
      const isConnected = await getConnectionStatus();

      const usedExplicitScope = scopeOverride !== undefined && scopeOverride !== null;
      const filterFromPicker = usedExplicitScope ? scopeOverride!.filterCorpoId : filterCorpoIdRef.current;
      const allowMarcaFallback = !usedExplicitScope;

      const mergeCorpoId = await resolveApreciacionListCorpoId(filterFromPicker, allowMarcaFallback);
      const matchesScope = makeApreciacionCorpoListMatcher(mergeCorpoId);

      if (isConnected) {
        const res = await listApreciacionVulnerabilidad({
          refreshAccessToken: () => refreshAccessTokenRef.current(),
          logout: () => logoutRef.current(),
        });
        if (res.status) {
          const list = (res.data || [])
            .filter((it: any) => it?.isActive !== false)
            .map((it: any) => ({ ...it, id_local: it.id_local || '' }));
          const merged = await mergeApreciacionVulnerabilidadServerIntoCache(list, matchesScope);
          setItems(sliceApreciacionItemsForCorpo(merged, mergeCorpoId));
        } else {
          setError(res.message || 'Error al cargar registros');
          await loadCacheToState(filterFromPicker, allowMarcaFallback);
        }
      } else {
        await loadCacheToState(filterFromPicker, allowMarcaFallback);
        setOfflineMessage('Modo Offline: mostrando datos guardados.');
      }
    } catch (e: any) {
      if (isProbablyNetworkError(e)) {
        setOfflineMessage('Modo Offline: error de conexión. Mostrando datos guardados si existen.');
      } else {
        setError(e.message || 'Error al cargar registros');
      }
      const usedExplicitScopeErr = scopeOverride !== undefined && scopeOverride !== null;
      const filterErr = usedExplicitScopeErr ? scopeOverride!.filterCorpoId : filterCorpoIdRef.current;
      const allowMarcaErr = !usedExplicitScopeErr;
      await loadCacheToState(filterErr, allowMarcaErr);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchItemsRef = useRef(fetchItems);
  fetchItemsRef.current = fetchItems;

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const tree = await loadMainStructureCache();
        let marcaScope: ApreciacionListCorpoScope | null = null;
        const currentMarcaStr = await AsyncStorage.getItem('current_marca');
        if (currentMarcaStr) {
          try {
            const current = JSON.parse(currentMarcaStr);
            const empresaIdVal = current?.empresa?.id != null ? Number(current.empresa.id) : null;
            const clienteIdVal = current?.cliente?.id != null ? Number(current.cliente.id) : null;
            const divisionIdVal = resolveMarcaDivisionForTree(current, tree);
            const contratoIdVal = current?.contrato?.id != null ? Number(current.contrato.id) : null;
            const corpoIdVal = current?.corpo?.id != null ? Number(current.corpo.id) : null;
            setFilterEmpresaId(empresaIdVal);
            setFilterClienteId(clienteIdVal);
            setFilterDivisionId(divisionIdVal);
            setFilterContratoId(contratoIdVal);
            setFilterCorpoId(corpoIdVal);
            marcaScope = { filterCorpoId: corpoIdVal };
          } catch {
            /* ignore */
          }
        }
        if (!cancelled) await fetchItemsRef.current(marcaScope);
      })();
      return () => {
        cancelled = true;
      };
    }, [loadMainStructureCache]),
  );

  useEffect(() => {
    const handler = () => {
      void loadMainStructureCache();
      fetchItemsRef.current();
    };
    eventBus.on('connectionRestored', handler);
    return () => {
      eventBus.off('connectionRestored', handler);
    };
  }, [loadMainStructureCache]);

  // Cascada helpers (form): encadenar desde `structure` (mismo patrón que Activities / Acta).
  const empresas = useMemo(() => structure.map((e) => ({ id: e.id, label: e.nombre })), [structure]);
  const selectedEmpresa = useMemo(
    () => structure.find((e) => Number(e.id) === Number(empresaId)) || null,
    [structure, empresaId],
  );
  const clientes = useMemo(
    () =>
      (selectedEmpresa?.clientes || []).map((c: MainStructureCliente) => ({ id: c.id, label: c.nombre })),
    [selectedEmpresa],
  );
  const selectedCliente = useMemo(
    () =>
      (selectedEmpresa?.clientes || []).find((c: MainStructureCliente) => Number(c.id) === Number(clienteId)) ||
      null,
    [selectedEmpresa, clienteId],
  );
  const divisiones = useMemo(
    () => getClienteDivisionArray(selectedCliente).map((d) => ({ id: d.id, label: d.nombre })),
    [selectedCliente],
  );
  const selectedDivision = useMemo(
    () => getClienteDivisionArray(selectedCliente).find((d) => Number(d.id) === Number(divisionId)) || null,
    [selectedCliente, divisionId],
  );
  const contratos = useMemo(
    () =>
      (selectedDivision?.contratos || []).map((c: MainStructureContrato) => ({ id: c.id, label: c.nombre })),
    [selectedDivision],
  );
  const selectedContrato = useMemo(
    () =>
      (selectedDivision?.contratos || []).find((c: MainStructureContrato) => Number(c.id) === Number(contratoId)) ||
      null,
    [selectedDivision, contratoId],
  );
  const corpos = useMemo(
    () =>
      (selectedContrato?.sucursales || []).map((s: MainStructureSucursal) => ({ id: s.id, label: s.nombre })),
    [selectedContrato],
  );
  const selectedCorpo = useMemo(
    () =>
      (selectedContrato?.sucursales || []).find(
        (s: MainStructureSucursal) => Number(s.id) === Number(corpoId),
      ) || null,
    [selectedContrato, corpoId],
  );
  const puestos = useMemo(
    () =>
      (selectedCorpo?.puestos || []).map((p: MainStructurePuesto) => ({ id: p.id, label: p.nombre })),
    [selectedCorpo],
  );
  const selectedPuesto = useMemo(
    () =>
      (selectedCorpo?.puestos || []).find((p: MainStructurePuesto) => Number(p.id) === Number(puestoId)) || null,
    [selectedCorpo, puestoId],
  );

  // filtros: mismos niveles pero independientes
  const selectedFilterEmpresa = useMemo(
    () => structure.find((e) => Number(e.id) === Number(filterEmpresaId)) || null,
    [structure, filterEmpresaId],
  );
  const filterClientes = useMemo(
    () =>
      (selectedFilterEmpresa?.clientes || []).map((c: MainStructureCliente) => ({ id: c.id, label: c.nombre })),
    [selectedFilterEmpresa],
  );
  const selectedFilterCliente = useMemo(
    () =>
      (selectedFilterEmpresa?.clientes || []).find(
        (c: MainStructureCliente) => Number(c.id) === Number(filterClienteId),
      ) || null,
    [selectedFilterEmpresa, filterClienteId],
  );
  const filterDivisiones = useMemo(
    () => getClienteDivisionArray(selectedFilterCliente).map((d) => ({ id: d.id, label: d.nombre })),
    [selectedFilterCliente],
  );
  const selectedFilterDivision = useMemo(
    () =>
      getClienteDivisionArray(selectedFilterCliente).find((d) => Number(d.id) === Number(filterDivisionId)) ||
      null,
    [selectedFilterCliente, filterDivisionId],
  );
  const filterContratos = useMemo(
    () =>
      (selectedFilterDivision?.contratos || []).map((c: MainStructureContrato) => ({
        id: c.id,
        label: c.nombre,
      })),
    [selectedFilterDivision],
  );
  const selectedFilterContrato = useMemo(
    () =>
      (selectedFilterDivision?.contratos || []).find(
        (c: MainStructureContrato) => Number(c.id) === Number(filterContratoId),
      ) || null,
    [selectedFilterDivision, filterContratoId],
  );
  const filterCorpos = useMemo(
    () =>
      (selectedFilterContrato?.sucursales || []).map((s: MainStructureSucursal) => ({
        id: s.id,
        label: s.nombre,
      })),
    [selectedFilterContrato],
  );

  const resolveByClienteCorpoPuesto = useCallback(
    (cliente_id?: number | null, corpo_id?: number | null, puesto_id?: number | null) => {
      for (const e of structure) {
        for (const c of e.clientes || []) {
          if (cliente_id && Number(c.id) !== Number(cliente_id)) continue;
          for (const d of getClienteDivisionArray(c)) {
            for (const co of d.contratos || []) {
              for (const s of co.sucursales || []) {
                if (corpo_id && Number(s.id) !== Number(corpo_id)) continue;
                for (const p of s.puestos || []) {
                  if (puesto_id && Number(p.id) !== Number(puesto_id)) continue;
                  return {
                    empresaId: e.id,
                    empresa: e.nombre,
                    clienteId: c.id,
                    cliente: c.nombre,
                    divisionId: d.id,
                    division: d.nombre,
                    contratoId: co.id,
                    contrato: co.nombre,
                    corpoId: s.id,
                    corpo: s.nombre,
                    puestoId: p.id,
                    puesto: p.nombre,
                  };
                }
              }
            }
          }
        }
      }
      return null;
    },
    [structure],
  );

  const resolveByPuestoId = useCallback(
    (targetPuestoId?: number | null): HierarchyPath | null =>
      resolveByPuestoIdInTree(structure, targetPuestoId),
    [structure],
  );

  const applyFormHierarchy = useCallback((path: HierarchyPath | null) => {
    if (!path) return;
    setEmpresaId(path.empresaId);
    setClienteId(path.clienteId);
    setDivisionId(path.divisionId);
    setContratoId(path.contratoId);
    setCorpoId(path.corpoId);
    setPuestoId(path.puestoId);
  }, []);

  const handleFilterHierarchyChange = useCallback((v: HierarchyPickerValues) => {
    setFilterEmpresaId(v.empresaId);
    setFilterClienteId(v.clienteId);
    setFilterDivisionId(v.divisionId);
    setFilterContratoId(v.contratoId);
    setFilterCorpoId(v.sucursalId);
    fetchItemsRef.current({ filterCorpoId: v.sucursalId });
  }, []);

  const handleFormHierarchyChange = useCallback((v: HierarchyPickerValues) => {
    setEmpresaId(v.empresaId);
    setClienteId(v.clienteId);
    setDivisionId(v.divisionId);
    setContratoId(v.contratoId);
    setCorpoId(v.sucursalId);
    setPuestoId(v.puestoId ?? null);
  }, []);

  const resetForm = (horaAccion: number) => {
    setFecha(new Date(horaAccion));
    setEnlace('');
    setNombreSolicitante('');
    setObservaciones('');
    setEmpresaId(null);
    setClienteId(null);
    setDivisionId(null);
    setContratoId(null);
    setCorpoId(null);
    setPuestoId(null);
    setBoleta(makeDefaultBoleta());
    setNewOptionTextBySection({});
    setMetricas([]);
    setNewMetrica('');
    setFirmaSolicitante('');
    setFirmaResponsable('');
  };

  const startCreating = async () => {
    const horaAccion = await getHoraAccion();
    if (!horaAccion) {
      Alert.alert('Error', 'No se pudo obtener la hora de acción');
      return;
    }
    resetForm(horaAccion);
    setEditing(null);
    setIsCreating(true);
    const currentMarcaStr = await AsyncStorage.getItem('current_marca');
    if (currentMarcaStr) {
      const current = JSON.parse(currentMarcaStr);
      let tree: MainStructureEmpresa[] = structure;
      if (!Array.isArray(tree) || tree.length === 0) {
        const loaded = await loadMainStructureTreeMerged().catch(() => []);
        tree = Array.isArray(loaded) ? (loaded as MainStructureEmpresa[]) : [];
        if (tree.length > 0) setStructure(tree);
      }
      const marcaPuestoId = current?.puesto?.id != null ? Number(current.puesto.id) : null;
      const byPuesto = resolveByPuestoIdInTree(tree, marcaPuestoId);
      if (byPuesto) {
        applyFormHierarchy(byPuesto);
      } else {
        const divisionResolved = resolveMarcaDivisionForTree(current, tree);
        applyFormHierarchy({
          empresaId: current?.empresa?.id != null ? Number(current.empresa.id) : null,
          clienteId: current?.cliente?.id != null ? Number(current.cliente.id) : null,
          divisionId: divisionResolved ?? getMarcaRoleDivisionId(current),
          contratoId: current?.contrato?.id != null ? Number(current.contrato.id) : null,
          corpoId: current?.corpo?.id != null ? Number(current.corpo.id) : null,
          puestoId: marcaPuestoId,
        });
      }
    }
  };

  const startEditing = async (it: VulnUI) => {
    const horaAccion = await getHoraAccion();
    if (!horaAccion) {
      Alert.alert('Error', 'No se pudo obtener la hora de acción');
      return;
    }
    setEditing(it);
    setIsCreating(true);
    setFecha(it.fecha ? new Date(it.fecha) : new Date(horaAccion));
    setEnlace(it.enlace || '');
    setNombreSolicitante(it.nombre_solicitante || '');
    setObservaciones(it.observaciones || '');
    const pathByPuesto = resolveByPuestoId(it.puesto_id);
    if (pathByPuesto) {
      applyFormHierarchy(pathByPuesto);
    } else {
      const path = resolveByClienteCorpoPuesto(it.cliente_id, it.corpo_id, it.puesto_id);
      if (path) {
        applyFormHierarchy(path);
      } else {
        applyFormHierarchy({
          empresaId: null,
          clienteId: it.cliente_id || null,
          divisionId: null,
          contratoId: null,
          corpoId: it.corpo_id || null,
          puestoId: it.puesto_id || null,
        });
      }
    }

    try {
      const parsed = JSON.parse(it.boleta || '[]');
      if (Array.isArray(parsed)) setBoleta(normalizeBoletaSections(parsed));
      else setBoleta(makeDefaultBoleta());
    } catch {
      setBoleta(makeDefaultBoleta());
    }
    try {
      const parsedM = JSON.parse(it.metricas_vulnerablidad || '[]');
      if (Array.isArray(parsedM)) setMetricas(parsedM);
      else setMetricas([]);
    } catch {
      setMetricas([]);
    }
    setFirmaSolicitante(it.firma_solicitante || '');
    setFirmaResponsable(it.firma_responsable || '');
  };

  const cancelCreating = () => {
    setIsCreating(false);
    setEditing(null);
  };

  const upsertAction = async (action: any) => {
    const actionsStr = await AsyncStorage.getItem('apreciacion_vulnerabilidad_actions');
    const actions = actionsStr ? JSON.parse(actionsStr) : [];
    actions.push(action);
    await AsyncStorage.setItem('apreciacion_vulnerabilidad_actions', JSON.stringify(actions));
  };

  const removeActionsForLocalId = async (localId: string) => {
    const actionsStr = await AsyncStorage.getItem('apreciacion_vulnerabilidad_actions');
    if (!actionsStr) return;
    const actions = JSON.parse(actionsStr) || [];
    const updated = actions.filter(
      (a: any) =>
        !(String(a.id) === String(localId) && (a.type === 'create' || a.type === 'update'))
    );
    await AsyncStorage.setItem('apreciacion_vulnerabilidad_actions', JSON.stringify(updated));
  };

  const updateCreateActionForLocalId = async (localId: string, requestData: any) => {
    const actionsStr = await AsyncStorage.getItem('apreciacion_vulnerabilidad_actions');
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
      await AsyncStorage.setItem('apreciacion_vulnerabilidad_actions', JSON.stringify(updated));
      return true;
    }
    return false;
  };

  const validateForm = () => {
    if (!empresaId) return Alert.alert('Error', 'Debes seleccionar Empresa') as any;
    if (!clienteId) return Alert.alert('Error', 'Debes seleccionar Cliente') as any;
    if (!divisionId) return Alert.alert('Error', 'Debes seleccionar División') as any;
    if (!contratoId) return Alert.alert('Error', 'Debes seleccionar Contrato') as any;
    if (!corpoId) return Alert.alert('Error', 'Debes seleccionar Sucursal (Corpo)') as any;
    if (!puestoId) return Alert.alert('Error', 'Debes seleccionar Puesto') as any;
    if (!enlace.trim()) return Alert.alert('Error', 'Campo requerido: Enlace') as any;
    if (!nombreSolicitante.trim()) return Alert.alert('Error', 'Campo requerido: Nombre solicitante') as any;
    const vulnerabilidad = boleta.find((s) => s.key === PORCENTAJE_SECTION_KEY)?.vulnerabilityLevel;
    if (!vulnerabilidad) return Alert.alert('Error', 'Debes seleccionar el porcentaje de vulnerabilidad') as any;
    // firma_solicitante es opcional; solo se requiere la firma responsable.
    if (!firmaResponsable) return Alert.alert('Error', 'Debes registrar la firma del responsable') as any;
    return true;
  };

  const buildPayload = async () => {
    const boletaImagesMeta = boleta.flatMap((section) =>
      (section.items || [])
        .filter((it) => it?.image?.localFileName)
        .map((it) => ({
          localFileName: String(it.image?.localFileName || ''),
          uri: String(it.image?.url || ''),
          original_name: it.id,
        }))
    );
    return {
      empresa_id: empresaId!,
      cliente_id: clienteId!,
      division_id: divisionId!,
      contrato_id: contratoId!,
      corpo_id: corpoId!,
      puesto_id: puestoId!,
      fecha: fecha.toISOString(),
      enlace,
      nombre_solicitante: nombreSolicitante,
      boleta: JSON.stringify(boleta),
      metricas_vulnerablidad: JSON.stringify(metricas),
      observaciones,
      firma_solicitante: firmaSolicitante,
      firma_responsable: firmaResponsable,
      imagenes: await buildApreciacionImagenesJsonForUpload({
        meta: stripApreciacionImagesForActionPayload(boletaImagesMeta),
      }),
      apreciacion_images_meta: stripApreciacionImagesForActionPayload(boletaImagesMeta),
    };
  };

  const handleSave = async () => {
    if (!employee) return;
    if (!validateForm()) return;

    setIsSubmitting(true);
    setSubmitResponse(null);

    try {
      const payload = await buildPayload();
      const isConnected = await getConnectionStatus();

      if (!editing) {
        if (isConnected) {
          const res = await createApreciacionVulnerabilidad({ requestData: payload, refreshAccessToken, logout });
          if (res.status) {
            await deleteApreciacionLocalFilesFromMeta(payload.apreciacion_images_meta || []);
            const rawId = (res as any).id ?? (res as any).data?.id;
            const newId = Number(rawId);
            if (Number.isFinite(newId)) {
              const all = await readApreciacionVulnerabilidadCacheFull();
              const row: VulnUI = {
                id: newId,
                id_local: '',
                empresa_id: payload.empresa_id,
                cliente_id: payload.cliente_id,
                division_id: payload.division_id,
                contrato_id: payload.contrato_id,
                corpo_id: payload.corpo_id,
                puesto_id: payload.puesto_id,
                fecha: payload.fecha,
                enlace: payload.enlace,
                nombre_solicitante: payload.nombre_solicitante,
                boleta: payload.boleta,
                metricas_vulnerablidad: payload.metricas_vulnerablidad,
                observaciones: payload.observaciones,
                firma_solicitante: payload.firma_solicitante,
                firma_responsable: payload.firma_responsable,
              };
              const without = all.filter((x) => Number(x.id) !== newId);
              const mergedAll = [row, ...without];
              await writeApreciacionVulnerabilidadCacheFull(mergedAll);
              setItems(sliceApreciacionItemsForCorpo(mergedAll, filterCorpoIdRef.current));
            }
            Alert.alert('Éxito', res.message || 'Registro creado correctamente');
            setTimeout(async () => {
              setIsCreating(false);
              await fetchItemsRef.current();
            }, 2000);
          } else {
            Alert.alert('Error', res.message || 'No se pudo crear');
          }
        } else {
          const localId = `local-vuln-${Date.now()}`;
          const localItem: VulnUI = {
            id: 0,
            id_local: localId,
            empresa_id: payload.empresa_id,
            cliente_id: clienteId || 0,
            division_id: payload.division_id,
            contrato_id: payload.contrato_id,
            corpo_id: corpoId || 0,
            puesto_id: puestoId || 0,
            fecha: payload.fecha,
            enlace: payload.enlace,
            nombre_solicitante: payload.nombre_solicitante,
            boleta: payload.boleta,
            metricas_vulnerablidad: payload.metricas_vulnerablidad,
            observaciones: payload.observaciones,
            firma_solicitante: payload.firma_solicitante,
            firma_responsable: payload.firma_responsable,
          };
          const all = await readApreciacionVulnerabilidadCacheFull();
          const mergedAll = [localItem, ...all];
          await writeApreciacionVulnerabilidadCacheFull(mergedAll);
          setItems(sliceApreciacionItemsForCorpo(mergedAll, filterCorpoIdRef.current));
          await upsertAction({ type: 'create', id: localId, requestData: payload });
          Alert.alert('Éxito', 'Se sincronizará cuando vuelva la conexión.');
          setTimeout(async () => {
            setIsCreating(false);
            await fetchItemsRef.current();
          }, 2000);
        }
        return;
      }

      const isLocal = apreciacionItemIsPendingLocal(editing);
      if (isConnected && !isLocal) {
        const res = await updateApreciacionVulnerabilidad({ id: editing.id, requestData: payload, refreshAccessToken, logout });
        if (res.status) {
          await deleteApreciacionLocalFilesFromMeta(payload.apreciacion_images_meta || []);
          const all = await readApreciacionVulnerabilidadCacheFull();
          const updated = all.map((it) =>
            Number(it.id) === Number(editing.id) ? { ...it, ...payload, id: editing.id } : it
          );
          await writeApreciacionVulnerabilidadCacheFull(updated);
          setItems(sliceApreciacionItemsForCorpo(updated, filterCorpoIdRef.current));
          Alert.alert('Éxito', res.message || 'Registro actualizado correctamente');
          setTimeout(async () => {
            setIsCreating(false);
            setEditing(null);
            await fetchItemsRef.current();
          }, 2000);
        } else {
          Alert.alert('Error', res.message || 'No se pudo actualizar');
        }
      } else {
        const all = await readApreciacionVulnerabilidadCacheFull();
        const next = all.map((it) => {
          const match =
            (editing.id_local && it.id_local === editing.id_local) ||
            (!editing.id_local && Number(it.id) === Number(editing.id));
          if (!match) return it;
          return { ...it, ...payload };
        });
        await writeApreciacionVulnerabilidadCacheFull(next);
        setItems(sliceApreciacionItemsForCorpo(next, filterCorpoIdRef.current));

        if (editing.id_local) {
          const actionsStr = await AsyncStorage.getItem('apreciacion_vulnerabilidad_actions');
          let docActions: any[] = actionsStr ? JSON.parse(actionsStr) : [];
          docActions = docActions.filter(
            (a: any) => !(a.type === 'update' && String(a.id) === String(editing.id_local))
          );
          const ci = docActions.findIndex((a: any) => a.type === 'create' && a.id === editing.id_local);
          if (ci !== -1) {
            docActions[ci] = { ...docActions[ci], requestData: payload };
          } else {
            docActions.push({ type: 'create', id: editing.id_local, requestData: payload });
          }
          await AsyncStorage.setItem('apreciacion_vulnerabilidad_actions', JSON.stringify(docActions));
        } else {
          await upsertAction({ type: 'update', id: editing.id, requestData: payload });
        }

        Alert.alert('Éxito', 'Los cambios se sincronizarán cuando vuelva la conexión.');
        setTimeout(async () => {
          setIsCreating(false);
          setEditing(null);
          await fetchItemsRef.current();
        }, 2000);
      }
    } catch (error) {
      console.error('Error saving apreciacion vulnerabilidad:', error);
      Alert.alert('Error', 'Error al guardar el registro');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmSave = () => {
    if (isSubmitting) return;
    Alert.alert(
      'Confirmar',
      editing ? '¿Deseas actualizar este registro?' : '¿Deseas crear este registro?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Aceptar', onPress: handleSave },
      ],
      { cancelable: false }
    );
  };

  const handleDelete = async (it: VulnUI) => {
    Alert.alert('Confirmar', '¿Deseas eliminar este registro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          const currentId = String(it.id_local || it.id);
          setDeletingId(currentId);
          const isConnected = await getConnectionStatus();
          try {
            if (apreciacionItemIsPendingLocal(it)) {
              await deleteApreciacionLocalFilesFromMeta(extractLocalImagesMetaFromBoletaJson(it.boleta));
              const all = await readApreciacionVulnerabilidadCacheFull();
              const next = it.id_local
                ? all.filter((x) => x.id_local !== it.id_local)
                : all.filter(
                    (x) =>
                      !(
                        Number(x.id) === 0 &&
                        !x.id_local &&
                        Number(x.corpo_id) === Number(it.corpo_id) &&
                        String(x.fecha) === String(it.fecha) &&
                        String(x.enlace) === String(it.enlace)
                      )
                  );
              await writeApreciacionVulnerabilidadCacheFull(next);
              setItems(sliceApreciacionItemsForCorpo(next, filterCorpoIdRef.current));
              if (it.id_local) await removeActionsForLocalId(it.id_local);
              if (it.id && Number(it.id) > 0) {
                const actionsStr = await AsyncStorage.getItem('apreciacion_vulnerabilidad_actions');
                if (actionsStr) {
                  const actions = JSON.parse(actionsStr);
                  const filtered = (Array.isArray(actions) ? actions : []).filter(
                    (a: any) => !(a.type === 'update_solicitante_firma' && Number(a.id) === Number(it.id))
                  );
                  await AsyncStorage.setItem('apreciacion_vulnerabilidad_actions', JSON.stringify(filtered));
                }
              }
              await fetchItemsRef.current();
              return;
            }

            if (isConnected) {
              const res = await deleteApreciacionVulnerabilidad({ id: it.id, refreshAccessToken, logout });
              if (res.status) {
                await deleteApreciacionLocalFilesFromMeta(extractLocalImagesMetaFromBoletaJson(it.boleta));
                const all = await readApreciacionVulnerabilidadCacheFull();
                const next = all.filter((x) => Number(x.id) !== Number(it.id));
                await writeApreciacionVulnerabilidadCacheFull(next);
                setItems(sliceApreciacionItemsForCorpo(next, filterCorpoIdRef.current));
                await fetchItemsRef.current();
              } else Alert.alert('Error', res.message || 'No se pudo eliminar');
            } else {
              await deleteApreciacionLocalFilesFromMeta(extractLocalImagesMetaFromBoletaJson(it.boleta));
              const all = await readApreciacionVulnerabilidadCacheFull();
              const next = all.filter((x) => Number(x.id) !== Number(it.id));
              await writeApreciacionVulnerabilidadCacheFull(next);
              setItems(sliceApreciacionItemsForCorpo(next, filterCorpoIdRef.current));
              const actionsStr = await AsyncStorage.getItem('apreciacion_vulnerabilidad_actions');
              const actions = actionsStr ? JSON.parse(actionsStr) : [];
              const cleaned = (Array.isArray(actions) ? actions : []).filter(
                (a: any) => !(a.type === 'update_solicitante_firma' && Number(a.id) === Number(it.id))
              );
              await AsyncStorage.setItem('apreciacion_vulnerabilidad_actions', JSON.stringify(cleaned));
              await upsertAction({ type: 'delete', id: it.id });
              Alert.alert('Eliminado (offline)', 'Se sincronizará cuando vuelva la conexión.');
              await fetchItemsRef.current();
            }
          } finally {
            setDeletingId((prev) => (prev === currentId ? null : prev));
          }
        },
      },
    ]);
  };

  const removeImageFromSavedBoleta = async (
    row: VulnUI,
    sectionKey: string,
    itemId: string,
    imageId: number
  ) => {
    const isConnected = await getConnectionStatus();
    if (isConnected && !apreciacionItemIsPendingLocal(row)) {
      const res = await deleteApreciacionVulnerabilidadImage({
        boletaId: Number(row.id),
        imageId,
        refreshAccessToken,
        logout,
      });
      if (!res.status) {
        Alert.alert('Error', res.message || 'No se pudo eliminar la imagen');
        return;
      }
    } else if (!apreciacionItemIsPendingLocal(row)) {
      await upsertAction({ type: 'delete_file', id: Number(row.id), fileId: Number(imageId) });
    }

    const all = await readApreciacionVulnerabilidadCacheFull();
    const updated = all.map((it) => {
      if (Number(it.id) !== Number(row.id) && String(it.id_local || '') !== String(row.id_local || '')) return it;
      try {
        const parsed = JSON.parse(String(it.boleta || '[]'));
        if (!Array.isArray(parsed)) return it;
        const nextBoleta = parsed.map((s: any) => {
          if (String(s?.key) !== String(sectionKey)) return s;
          const items = Array.isArray(s?.items) ? s.items : [];
          return {
            ...s,
            items: items.map((q: any) => {
              if (String(q?.id) !== String(itemId)) return q;
              return { ...q, image: null };
            }),
          };
        });
        return { ...it, boleta: JSON.stringify(nextBoleta) };
      } catch {
        return it;
      }
    });
    await writeApreciacionVulnerabilidadCacheFull(updated);
    setItems(sliceApreciacionItemsForCorpo(updated, filterCorpoIdRef.current));
  };

  // UI boleta helpers
  const setAnswer = (sectionKey: string, itemId: string, answer: 'si' | 'no') => {
    setBoleta((prev) =>
      prev.map((s) =>
        s.key !== sectionKey
          ? s
          : {
            ...s,
            items: s.items.map((it) => (it.id === itemId ? { ...it, answer } : it)),
          }
      )
    );
  };

  const setAnswerDescription = (sectionKey: string, itemId: string, description: string) => {
    setBoleta((prev) =>
      prev.map((s) =>
        s.key !== sectionKey
          ? s
          : {
            ...s,
            items: s.items.map((it) => (it.id === itemId ? { ...it, description } : it)),
          }
      )
    );
  };

  const setAnswerImage = (sectionKey: string, itemId: string, image: BoletaItem['image']) => {
    setBoleta((prev) =>
      prev.map((s) =>
        s.key !== sectionKey
          ? s
          : {
            ...s,
            items: s.items.map((it) => (it.id === itemId ? { ...it, image } : it)),
          }
      )
    );
  };

  const openBoletaCamera = async (sectionKey: string, itemId: string) => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert('Permiso requerido', 'Debes permitir acceso a la cámara.');
        return;
      }
    }
    setCameraTarget({ sectionKey, itemId });
    setIsCameraVisible(true);
  };

  const takeBoletaPicture = async () => {
    if (!cameraRef.current || !cameraTarget) return;
    try {
      const photo: any = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        base64: false,
      });
      if (!photo?.uri) return;
      const localFileName = await saveFile({
        uri: photo.uri,
        originalName: `apreciacion-vuln-${Date.now()}`,
        extension: 'jpg',
        type: 'image',
        prefix: 'apreciacion_vuln',
      });
      setAnswerImage(cameraTarget.sectionKey, cameraTarget.itemId, {
        localFileName,
        url: photo.uri,
        original_name: `boleta-${cameraTarget.sectionKey}-${cameraTarget.itemId}`,
      });
      setIsCameraVisible(false);
      setCameraTarget(null);
    } catch (e) {
      console.error('Error capturando imagen de boleta:', e);
      Alert.alert('Error', 'No se pudo capturar la imagen');
    }
  };

  const setVulnerabilityLevel = (level: VulnerabilityLevel) => {
    setBoleta((prev) =>
      prev.map((s) =>
        s.key === PORCENTAJE_SECTION_KEY
          ? {
            ...s,
            vulnerabilityLevel: normalizeVulnerabilityLevel(level),
            items: [],
          }
          : s
      )
    );
  };

  const addCustomOption = (sectionKey: string) => {
    if (sectionKey === PORCENTAJE_SECTION_KEY) return;
    const text = (newOptionTextBySection[sectionKey] || '').trim();
    if (!text) return;
    setBoleta((prev) =>
      prev.map((s) => {
        if (s.key !== sectionKey) return s;
        const id = `${sectionKey}-custom-${Date.now()}`;
        return { ...s, items: [...s.items, { id, label: text, answer: null, isOriginal: false }] };
      })
    );
    setNewOptionTextBySection((p) => ({ ...p, [sectionKey]: '' }));
  };

  const removeCustomOption = (sectionKey: string, itemId: string) => {
    if (sectionKey === PORCENTAJE_SECTION_KEY) return;
    setBoleta((prev) =>
      prev.map((s) => {
        if (s.key !== sectionKey) return s;
        return { ...s, items: s.items.filter((it) => it.id !== itemId || it.isOriginal) };
      })
    );
  };

  // metricas helpers
  const addMetrica = () => {
    const t = newMetrica.trim();
    if (!t) return;
    setMetricas((prev) => [...prev, t]);
    setNewMetrica('');
  };
  const removeMetrica = (idx: number) => setMetricas((prev) => prev.filter((_, i) => i !== idx));

  const resetFilters = () => {
    setFilterSearch('');
    setFilterEmpresaId(null);
    setFilterClienteId(null);
    setFilterDivisionId(null);
    setFilterContratoId(null);
    setFilterCorpoId(null);
    fetchItemsRef.current({ filterCorpoId: null });
  };

  /** `items` ya está acotado por sucursal (fetchItems / caché). Aquí solo texto de búsqueda. */
  const filtered = useMemo(() => {
    const q = filterSearch.trim().toLowerCase();
    return items.filter((it) => {
      if (!q) return true;
      const hay = `${it.enlace || ''} ${it.nombre_solicitante || ''} ${it.observaciones || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, filterSearch]);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpanded = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const [boletaExpanded, setBoletaExpanded] = useState<Set<string>>(new Set());
  const toggleBoletaExpanded = (key: string) => {
    setBoletaExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const parseBoletaString = (value: string): BoletaSection[] | null => {
    try {
      const parsed = JSON.parse(String(value || ''));
      if (!Array.isArray(parsed)) return null;
      return normalizeBoletaSections(parsed);
    } catch {
      return null;
    }
  };

  const getBoletaStats = (sections: BoletaSection[] | null) => {
    if (!sections) return { si: 0, no: 0, none: 0, total: 0 };
    let si = 0;
    let no = 0;
    let none = 0;
    let total = 0;
    for (const s of sections) {
      if (s.key === PORCENTAJE_SECTION_KEY) continue;
      const items = Array.isArray((s as any).items) ? (s as any).items : [];
      for (const it of items) {
        total += 1;
        if (it?.answer === 'si') si += 1;
        else if (it?.answer === 'no') no += 1;
        else none += 1;
      }
    }
    return { si, no, none, total };
  };

  const formatDate = (iso: string) => {
    try {
      return String(iso).split('T')[0];
    } catch {
      return '';
    }
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

  const renderItem = (it: VulnUI, index: number) => {
    const key = it.id !== 0 ? `v-${it.id}` : it.id_local ? `v-${it.id_local}` : `v-${index}`;
    const isExp = expanded.has(key);
    const names = resolveByClienteCorpoPuesto(it.cliente_id, it.corpo_id, it.puesto_id);
    const boletaKey = `${key}-boleta`;
    const isBoletaExp = boletaExpanded.has(boletaKey);
    const parsedBoleta = parseBoletaString(it.boleta);
    const boletaStats = getBoletaStats(parsedBoleta);
    const vulnerabilidadSection = parsedBoleta?.find((s) => s.key === PORCENTAJE_SECTION_KEY) || null;
    const vulnerabilidadLabel = getVulnerabilityLevelLabel(
      vulnerabilidadSection?.vulnerabilityLevel ??
      getLegacyVulnerabilityLevelFromItems(vulnerabilidadSection?.items || [])
    );
    return (
      <ThemedView key={key} style={styles.card}>
        <ThemedText style={styles.cardTitle}>
          Apreciación de vulnerabilidad{it.id_local ? ' (offline)' : ''}
        </ThemedText>

        <ThemedText style={styles.line}>
          <ThemedText style={styles.labelInline}>Fecha: </ThemedText>
          <ThemedText style={styles.valueInline}>{convertDateTimestampToLocalString(new Date(it.fecha).toISOString(), false)}</ThemedText>
        </ThemedText>
        <ThemedText style={styles.line}>
          <ThemedText style={styles.labelInline}>Solicitante: </ThemedText>
          <ThemedText style={styles.valueInline}>{it.nombre_solicitante}</ThemedText>
        </ThemedText>
        <ThemedText style={styles.line}>
          <ThemedText style={styles.labelInline}>Cliente: </ThemedText>
          <ThemedText style={styles.valueInline}>{it.cliente_nombre || names?.cliente || '-'}</ThemedText>
        </ThemedText>
        <ThemedText style={styles.line}>
          <ThemedText style={styles.labelInline}>Corpo: </ThemedText>
          <ThemedText style={styles.valueInline}>{it.corpo_nombre || names?.corpo || '-'}</ThemedText>
        </ThemedText>
        <ThemedText style={styles.line}>
          <ThemedText style={styles.labelInline}>Puesto: </ThemedText>
          <ThemedText style={styles.valueInline}>{it.puesto_nombre || names?.puesto || '-'}</ThemedText>
        </ThemedText>
        <ThemedText style={styles.line}>
          <ThemedText style={styles.labelInline}>Porcentaje de vulnerabilidad: </ThemedText>
          <ThemedText style={styles.valueInline}>{vulnerabilidadLabel}</ThemedText>
        </ThemedText>

        <TouchableOpacity style={styles.collapseButton} onPress={() => toggleExpanded(key)}>
          <ThemedText style={styles.collapseButtonText}>{isExp ? 'Ocultar detalles' : 'Ver detalles'}</ThemedText>
          <Ionicons name={isExp ? 'chevron-up' : 'chevron-down'} size={20} color="#007AFF" />
        </TouchableOpacity>

        {isExp && (
          <ThemedView style={styles.collapseContent}>
            <ThemedText style={styles.line}>
              <ThemedText style={styles.labelInline}>Enlace: </ThemedText>
              <ThemedText style={styles.valueInline}>{it.enlace || '-'}</ThemedText>
            </ThemedText>
            {it.observaciones ? (
              <ThemedText style={styles.line}>
                <ThemedText style={styles.labelInline}>Observaciones: </ThemedText>
                <ThemedText style={styles.valueInline}>{it.observaciones}</ThemedText>
              </ThemedText>
            ) : null}

            <ThemedText style={styles.sectionTitle}>Firma responsable</ThemedText>
            {!it.firma_responsable ? (
              <ThemedText style={styles.signatureHintMuted}>Aún no hay firma responsable.</ThemedText>
            ) : (
              <ThemedView style={[styles.firmaInfoBox, { marginTop: 10 }]}>
                <ThemedView style={{ flex: 1, paddingRight: 10 }}>
                  <ThemedText style={styles.firmaInfoTitle}>Información de la firma:</ThemedText>
                  {(() => {
                    const info = decodeFirmaHash(it.firma_responsable);
                    if (!info) return <ThemedText style={styles.firmaInfoValue}>Formato no decodificable</ThemedText>;
                    return (
                      <>
                        <ThemedText style={styles.firmaInfoValue}>Sesión: {info.sessionId || 'N/A'}</ThemedText>
                        <ThemedText style={styles.firmaInfoValue}>Empleado: {info.empleadoId || 'N/A'}</ThemedText>
                        <ThemedText style={styles.firmaInfoValue}>
                          Lat: {info.latitud || 'N/A'} | Long: {info.longitud || 'N/A'}
                        </ThemedText>
                        <ThemedText style={styles.firmaInfoValue}>Hora: {info.timestamp || 'N/A'}</ThemedText>
                      </>
                    );
                  })()}
                </ThemedView>
              </ThemedView>
            )}

            <ThemedText style={styles.sectionTitle}>Firma solicitante</ThemedText>
            {it.firma_solicitante ? (
              <>
                <ThemedView style={styles.signaturePreviewContainer}>
                  <Image source={{ uri: it.firma_solicitante }} style={styles.signaturePreview} resizeMode="contain" />
                </ThemedView>
                {false && (
                  <TouchableOpacity style={styles.signatureActionButton} onPress={() => openListFirmaSolicitanteModal(it)}>
                    <Ionicons name="create-outline" size={16} color="#007AFF" />
                    <ThemedText style={styles.signatureActionButtonText}>Cambiar firma</ThemedText>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <>
                <ThemedText style={styles.signatureHintMuted}>Aún no hay firma solicitante.</ThemedText>
                <TouchableOpacity style={styles.signatureActionButton} onPress={() => openListFirmaSolicitanteModal(it)}>
                  <Ionicons name="add-circle-outline" size={16} color="#007AFF" />
                  <ThemedText style={styles.signatureActionButtonText}>Añadir firma solicitante</ThemedText>
                </TouchableOpacity>
              </>
            )}
          </ThemedView>
        )}

        {/* Resultados de la boleta (collapsable aparte, debajo de "Detalles") */}
        <TouchableOpacity style={styles.collapseButton} onPress={() => toggleBoletaExpanded(boletaKey)}>
          <ThemedText style={styles.collapseButtonText}>{isBoletaExp ? 'Ocultar resultados' : 'Ver resultados'}</ThemedText>
          <Ionicons name={isBoletaExp ? 'chevron-up' : 'chevron-down'} size={20} color="#007AFF" />
        </TouchableOpacity>

        {isBoletaExp && (
          <ThemedView style={styles.innerCollapseContent}>
            <ThemedText style={styles.innerCollapseSummary}>
              Sí: {boletaStats.si} | No: {boletaStats.no} | Sin: {boletaStats.none}
            </ThemedText>
            {!parsedBoleta ? (
              <ThemedText style={styles.signatureHintMuted}>No se pudo leer la boleta.</ThemedText>
            ) : (
              parsedBoleta.map((section) => (
                <ThemedView key={section.key || section.title} style={styles.boletaResultsSection}>
                  <ThemedText style={styles.boletaResultsTitle}>{section.title || 'Sección'}</ThemedText>
                  {section.key === PORCENTAJE_SECTION_KEY ? (
                    <ThemedView style={styles.boletaResultRow}>
                      <ThemedText style={styles.boletaResultLabel}>Nivel seleccionado</ThemedText>
                      <ThemedText style={styles.boletaResultValue}>{getVulnerabilityLevelLabel(section.vulnerabilityLevel)}</ThemedText>
                    </ThemedView>
                  ) : null}
                  {(section.items || []).map((q) => (
                    <ThemedView key={q.id} style={styles.boletaResultRow}>
                      <ThemedText style={styles.boletaResultLabel}>{q.label}</ThemedText>
                      <ThemedText style={styles.boletaResultValue}>
                        {q.answer === 'si' ? 'Sí' : q.answer === 'no' ? 'No' : 'Sin responder'}
                      </ThemedText>
                      {q.description ? (
                        <ThemedText style={styles.signatureHintMuted}>Descripción: {q.description}</ThemedText>
                      ) : null}
                      {(() => {
                        const serverImage = (Array.isArray(it.images) ? it.images : []).find(
                          (img: any) => String(img?.original_name || '') === String(q.id)
                        );
                        const apiBase = Constants.expoConfig?.extra?.API_SERVER;
                        const endpointGetImage =
                          apiBase && serverImage?.name
                            ? `${apiBase}/api/apreciacion-vulnerabilidad/${it.id}/get-image/${encodeURIComponent(String(serverImage.name))}`
                            : '';
                        const imageUri = endpointGetImage
                          ? appendTokenToUrl(endpointGetImage) // Fuerza endpoint get-image del módulo + token
                          : serverImage?.url
                            ? appendTokenToUrl(String(serverImage.url))
                          : q.image?.url
                            ? String(q.image.url)
                            : '';
                        if (!imageUri) return null;
                        return (
                        <ThemedView style={[styles.signaturePreviewContainer, { marginTop: 8 }]}>
                          <Image source={{ uri: imageUri }} style={styles.signaturePreview} resizeMode="cover" />
                          {false && (
                            <TouchableOpacity
                              style={styles.removeSignatureButton}
                              onPress={() => {
                                Alert.alert('Confirmar', '¿Deseas eliminar este archivo?', [
                                  { text: 'Cancelar', style: 'cancel' },
                                  {
                                    text: 'Eliminar',
                                    style: 'destructive',
                                    onPress: () => {
                                      const imageId = Number(serverImage?.id || q.image?.id || 0);
                                      if (!imageId) return;
                                      void removeImageFromSavedBoleta(it, section.key, q.id, imageId);
                                    },
                                  },
                                ]);
                              }}
                            >
                              <Ionicons name="trash" size={18} color="#FFFFFF" />
                            </TouchableOpacity>
                          )}
                        </ThemedView>
                        );
                      })()}
                    </ThemedView>
                  ))}
                </ThemedView>
              ))
            )}
          </ThemedView>
        )}

        <ThemedView style={styles.rowButtons}>
          {false && (
            <TouchableOpacity style={[styles.rowButton, styles.editButton]} onPress={() => startEditing(it)}>
              <Ionicons name="pencil" size={18} color="#FFFFFF" />
              <ThemedText style={styles.rowButtonText}>Editar</ThemedText>
            </TouchableOpacity>
          )}
          {!(it.id_local || it.id === 0) && (
            <TouchableOpacity
              style={[styles.rowButton, styles.changesButton]}
              onPress={() => {
                setCambiosTitle(`Cambios - Apreciación #${it.id}`);
                fetchCambios('c_boleta_apreciacion_vulnerabilidad', it.id);
              }}
            >
              <Ionicons name="list-outline" size={18} color="#FFFFFF" />
              <ThemedText style={styles.rowButtonText}>Cambios</ThemedText>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.rowButton, styles.deleteButton, deletingId === String(it.id_local || it.id) && styles.buttonDisabled]}
            onPress={() => handleDelete(it)}
            disabled={deletingId === String(it.id_local || it.id)}
          >
            {deletingId === String(it.id_local || it.id) ? (
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
      <AppHeader onMenuPress={handleMenuPress} title="Aprec. vulnerabilidad" />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <ThemedView style={styles.content}>
          {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}
          {offlineMessage && !error ? <ThemedText style={styles.offlineText}>{offlineMessage}</ThemedText> : null}

          <ThemedView style={styles.titleContainer}>
            <ThemedText type="title" style={styles.title}>
              <Ionicons name="shield-checkmark" size={22} color="#000000" /> Apreciación de vulnerabilidad
            </ThemedText>
            <ThemedText style={styles.subtitle}>Boleta de apreciación de vulnerabilidad</ThemedText>
          </ThemedView>

          {!isCreating && !isLoading && (
            <ThemedView style={styles.filtersMain}>
              <ThemedView style={styles.filterHeader}>
                <TouchableOpacity style={styles.filterToggleButton} onPress={() => setIsFiltersExpanded(!isFiltersExpanded)}>
                  <ThemedText style={styles.filterToggleText}>Filtros</ThemedText>
                  <Ionicons name={isFiltersExpanded ? 'chevron-up' : 'chevron-down'} size={20} color="#007AFF" />
                </TouchableOpacity>
                {isFiltersExpanded && (
                  <TouchableOpacity style={styles.resetFiltersButton} onPress={resetFilters}>
                    <Ionicons name="refresh" size={16} color="#FF3B30" />
                    <ThemedText style={styles.resetFiltersText}>Reiniciar</ThemedText>
                  </TouchableOpacity>
                )}
              </ThemedView>

              {isFiltersExpanded && (
                <ThemedView style={styles.filterContent}>
                  <ThemedView style={styles.filterGroup}>
                    <ThemedText style={styles.filterLabel}>Buscar (enlace/nombre/observaciones):</ThemedText>
                    <TextInput
                      style={styles.searchInput}
                      value={filterSearch}
                      onChangeText={setFilterSearch}
                      placeholder="Buscar..."
                      placeholderTextColor="#999"
                    />
                  </ThemedView>

                  <ThemedText style={styles.sectionTitle}>Estructura</ThemedText>
                  <ThemedText style={styles.subtitle}>
                    Seleccione sucursal (corpo) para listar registros. La jerarquía sirve para llegar a la sucursal.
                  </ThemedText>

                  {isStructureLoading ? (
                    <ThemedView style={styles.structureLoadingBox}>
                      <ActivityIndicator size="small" color="#007AFF" />
                      <ThemedText style={styles.structureLoadingText}>Cargando estructura...</ThemedText>
                    </ThemedView>
                  ) : null}

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
                      sucursalId: filterCorpoId,
                    }}
                    onChange={handleFilterHierarchyChange}
                    labels={{
                      sucursal: 'Sucursal (Corpo)',
                      selectSucursal: 'Seleccionar sucursal (corpo)',
                    }}
                    renderLabel={(text) => <ThemedText style={styles.label}>{text}</ThemedText>}
                    pickerWrapperStyle={styles.pickerWrapper}
                  />
                </ThemedView>
              )}
            </ThemedView>
          )}

          {!isCreating && !isLoading && !error && (
            <TouchableOpacity style={styles.createButton} onPress={startCreating}>
              <ThemedText style={styles.createButtonText}>
                <Ionicons name="add" size={20} color="#FFFFFF" /> Nuevo registro
              </ThemedText>
            </TouchableOpacity>
          )}

          {isCreating && (
            <ThemedView style={styles.formCard}>
              <ThemedText style={styles.formTitle}>{editing ? 'Editar registro' : 'Nuevo registro'}</ThemedText>

              <ThemedText style={styles.label}>Fecha *</ThemedText>
              <TouchableOpacity style={styles.dateButton} onPress={() => setShowFechaPicker(true)}>
                <ThemedText style={styles.dateButtonText}>{convertDateTimestampToLocalString(new Date(fecha).toISOString(), false)}</ThemedText>
                <Ionicons name="calendar-outline" size={18} color="#007AFF" />
              </TouchableOpacity>

              <ThemedText style={styles.sectionTitle}>Estructura *</ThemedText>

              {isStructureLoading ? (
                <ThemedView style={styles.structureLoadingBox}>
                  <ActivityIndicator size="small" color="#007AFF" />
                  <ThemedText style={styles.structureLoadingText}>Cargando estructura...</ThemedText>
                </ThemedView>
              ) : null}

              <HierarchyPickerFields
                structure={structure}
                levels={['cliente', 'contrato', 'sucursal', 'puesto']}
                isLoading={isStructureLoading}
                emptyPickerValue={0}
                values={{
                  empresaId,
                  clienteId,
                  divisionId,
                  contratoId,
                  sucursalId: corpoId,
                  puestoId,
                }}
                onChange={handleFormHierarchyChange}
                labels={{
                  sucursal: 'Sucursal (Corpo)',
                  selectSucursal: 'Seleccionar sucursal (corpo)',
                }}
                renderLabel={(text) => <ThemedText style={styles.label}>{text}</ThemedText>}
                pickerWrapperStyle={styles.pickerWrapper}
              />

              <ThemedText style={styles.label}>Enlace *</ThemedText>
              <TextInput style={styles.input} placeholder="Enlace" placeholderTextColor="#999" value={enlace} onChangeText={setEnlace} />

              <ThemedText style={styles.label}>Nombre solicitante *</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="Nombre solicitante"
                placeholderTextColor="#999"
                value={nombreSolicitante}
                onChangeText={setNombreSolicitante}
              />

              <ThemedText style={styles.sectionTitle}>Boleta *</ThemedText>
              {boleta.map((section) => (
                <ThemedView key={section.key} style={styles.boletaSection}>
                  <ThemedText style={styles.boletaSectionTitle}>{section.title}</ThemedText>
                  {section.key === PORCENTAJE_SECTION_KEY ? (
                    <>
                      <ThemedText style={styles.label}>Nivel</ThemedText>
                      <ThemedView style={styles.pickerWrapper}>
                        <Picker
                          selectedValue={section.vulnerabilityLevel || 'baja'}
                          onValueChange={(val) => setVulnerabilityLevel(normalizeVulnerabilityLevel(val))}
                        >
                          {VULNERABILITY_LEVEL_OPTIONS.map((option) => (
                            <Picker.Item key={option.value} label={option.label} value={option.value} color="#000000" />
                          ))}
                        </Picker>
                      </ThemedView>
                    </>
                  ) : (
                    <>
                      {section.items.map((bi) => (
                        <ThemedView key={bi.id} style={styles.boletaRow}>
                          <ThemedText style={styles.boletaLabel}>{bi.label}</ThemedText>
                          <ThemedView style={styles.boletaRowRight}>
                            <TouchableOpacity style={styles.radioOption} onPress={() => setAnswer(section.key, bi.id, 'si')}>
                              <Ionicons
                                name={bi.answer === 'si' ? 'radio-button-on' : 'radio-button-off'}
                                size={18}
                                color={bi.answer === 'si' ? '#007AFF' : '#777'}
                              />
                              <ThemedText style={[styles.radioOptionText, bi.answer === 'si' && styles.radioOptionTextSelected]}>Sí</ThemedText>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.radioOption} onPress={() => setAnswer(section.key, bi.id, 'no')}>
                              <Ionicons
                                name={bi.answer === 'no' ? 'radio-button-on' : 'radio-button-off'}
                                size={18}
                                color={bi.answer === 'no' ? '#007AFF' : '#777'}
                              />
                              <ThemedText style={[styles.radioOptionText, bi.answer === 'no' && styles.radioOptionTextSelected]}>No</ThemedText>
                            </TouchableOpacity>
                            {!bi.isOriginal ? (
                              <TouchableOpacity style={styles.trashTiny} onPress={() => removeCustomOption(section.key, bi.id)}>
                                <Ionicons name="trash" size={18} color="#FFFFFF" />
                              </TouchableOpacity>
                            ) : (
                              <View style={styles.trashTinyPlaceholder} />
                            )}
                          </ThemedView>
                          <ThemedView style={{ marginTop: 8 }}>
                            <TextInput
                              style={[styles.input, { marginBottom: 8 }]}
                              placeholder="Descripción opcional..."
                              placeholderTextColor="#999"
                              value={bi.description || ''}
                              onChangeText={(t) => setAnswerDescription(section.key, bi.id, t)}
                            />
                            <TouchableOpacity
                              style={[styles.openSignatureButton, { marginTop: 0 }]}
                              onPress={() => openBoletaCamera(section.key, bi.id)}
                            >
                              <Ionicons name="camera" size={18} color="#000000" />
                              <ThemedText style={styles.openSignatureButtonText}>
                                {bi.image?.localFileName || bi.image?.url ? 'Cambiar foto opcional' : 'Tomar foto opcional'}
                              </ThemedText>
                            </TouchableOpacity>
                            {bi.image?.localFileName || bi.image?.url ? (
                              <ThemedView style={[styles.signaturePreviewContainer, { marginTop: 8 }]}>
                                <Image
                                  source={{
                                    uri: bi.image?.localFileName
                                      ? getLocalFileDisplayUri(String(bi.image.localFileName))
                                      : String(bi.image?.url || ''),
                                  }}
                                  style={styles.signaturePreview}
                                  resizeMode="cover"
                                />
                                <TouchableOpacity
                                  style={styles.removeSignatureButton}
                                  onPress={() => setAnswerImage(section.key, bi.id, null)}
                                >
                                  <Ionicons name="trash" size={18} color="#FFFFFF" />
                                </TouchableOpacity>
                              </ThemedView>
                            ) : null}
                          </ThemedView>
                        </ThemedView>
                      ))}

                      <ThemedView style={styles.addOptionRow}>
                        <TextInput
                          style={[styles.input, { flex: 1, marginBottom: 0 }]}
                          placeholder="Agregar opción..."
                          placeholderTextColor="#999"
                          value={newOptionTextBySection[section.key] || ''}
                          onChangeText={(t) => setNewOptionTextBySection((p) => ({ ...p, [section.key]: t }))}
                        />
                        <TouchableOpacity style={styles.addTiny} onPress={() => addCustomOption(section.key)}>
                          <Ionicons name="add" size={18} color="#FFFFFF" />
                        </TouchableOpacity>
                      </ThemedView>
                    </>
                  )}
                </ThemedView>
              ))}

              <ThemedView style={styles.metricasBox}>
                <TouchableOpacity style={styles.metricasHeader} onPress={() => setMetricasExpanded((p) => !p)}>
                  <ThemedText style={styles.metricasTitle}>
                    Breve detalle de los elementos que influyen en el porcentaje de vulnerabilidad
                  </ThemedText>
                  <Ionicons name={metricasExpanded ? 'chevron-up' : 'chevron-down'} size={20} color="#007AFF" />
                </TouchableOpacity>
                {metricasExpanded && (
                  <ThemedView style={styles.metricasContent}>
                    {metricas.length === 0 ? <ThemedText style={styles.signatureHintMuted}>Sin métricas.</ThemedText> : null}
                    {metricas.map((m, idx) => (
                      <ThemedView key={`${idx}-${m}`} style={styles.metricaRow}>
                        <ThemedText style={styles.metricaText}>{m}</ThemedText>
                        <TouchableOpacity style={styles.trashTiny} onPress={() => removeMetrica(idx)}>
                          <Ionicons name="trash" size={18} color="#FFFFFF" />
                        </TouchableOpacity>
                      </ThemedView>
                    ))}
                    <ThemedView style={styles.addOptionRow}>
                      <TextInput
                        style={[styles.input, { flex: 1, marginBottom: 0 }]}
                        placeholder="Agregar detalle..."
                        placeholderTextColor="#999"
                        value={newMetrica}
                        onChangeText={setNewMetrica}
                      />
                      <TouchableOpacity style={styles.addTiny} onPress={addMetrica}>
                        <Ionicons name="add" size={18} color="#FFFFFF" />
                      </TouchableOpacity>
                    </ThemedView>
                  </ThemedView>
                )}
              </ThemedView>

              <ThemedText style={styles.label}>Observaciones</ThemedText>
              <TextInput
                style={[styles.input, styles.textArea]}
                multiline
                placeholder="Observaciones..."
                placeholderTextColor="#999"
                value={observaciones}
                onChangeText={setObservaciones}
              />

              <ThemedText style={styles.sectionTitle}>Firma solicitante (opcional)</ThemedText>
              {firmaSolicitante ? (
                <ThemedView style={styles.signaturePreviewContainer}>
                  <Image source={{ uri: firmaSolicitante }} style={styles.signaturePreview} resizeMode="contain" />
                  <TouchableOpacity style={styles.removeSignatureButton} onPress={() => setFirmaSolicitante('')}>
                    <Ionicons name="trash" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </ThemedView>
              ) : null}
              <TouchableOpacity style={styles.openSignatureButton} onPress={openFirmaSolicitanteModal}>
                <Ionicons name="create-outline" size={20} color="#000000" />
                <ThemedText style={styles.openSignatureButtonText}>{firmaSolicitante ? 'Modificar firma' : 'Agregar firma'}</ThemedText>
              </TouchableOpacity>

              {/* Firma del responsable (digital: generar o escanear QR) */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Firma del responsable *</ThemedText>
                {!firmaResponsable ? (
                  <ThemedView style={styles.signatureButtonsRow}>
                    <TouchableOpacity
                      style={[styles.signatureButtonPrimary, isGeneratingFirma && styles.signatureButtonPrimaryDisabled]}
                      onPress={handleGenerateFirmaResponsable}
                      disabled={isGeneratingFirma}
                    >
                      {isGeneratingFirma ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons name="finger-print" size={20} color="#FFFFFF" />
                          <ThemedText style={styles.signatureButtonPrimaryText}>Generar firma</ThemedText>
                        </>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.signatureButtonPrimary} onPress={handleScanFirmaResponsable}>
                      <Ionicons name="qr-code" size={20} color="#FFFFFF" />
                      <ThemedText style={styles.signatureButtonPrimaryText}>Escanear QR</ThemedText>
                    </TouchableOpacity>
                  </ThemedView>
                ) : (
                  <ThemedView style={styles.signatureInfo}>
                    <ThemedView style={{ flex: 1, paddingRight: 8 }}>
                      <ThemedText style={styles.signatureInfoTitle}>
                        Información de la firma del responsable
                      </ThemedText>
                      {(() => {
                        const info = decodeFirmaHash(firmaResponsable);
                        if (!info) return <ThemedText style={styles.signatureInfoText}>Formato no decodificable</ThemedText>;
                        return (
                          <>
                            <ThemedText style={styles.signatureInfoText}>ID de sesión: {info.sessionId}</ThemedText>
                            <ThemedText style={styles.signatureInfoText}>ID del empleado: {info.empleadoId}</ThemedText>
                            <ThemedText style={styles.signatureInfoText}>Latitud: {info.latitud}</ThemedText>
                            <ThemedText style={styles.signatureInfoText}>Longitud: {info.longitud}</ThemedText>
                            <ThemedText style={styles.signatureInfoText}>Fecha y hora: {formatFirmaDateLabel(info.timestamp)}</ThemedText>
                          </>
                        );
                      })()}
                    </ThemedView>
                    <TouchableOpacity style={styles.firmaClearButtonTiny} onPress={() => setFirmaResponsable('')}>
                      <Ionicons name="trash" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                  </ThemedView>
                )}
              </ThemedView>

              {submitResponse && (
                <ThemedView style={[styles.responseContainer, submitResponse.type === 'success' ? styles.responseSuccess : styles.responseError]}>
                  <ThemedText style={styles.responseText}>
                    {submitResponse.type === 'success' ? '✓ ' : '✗ '}
                    {submitResponse.message}
                  </ThemedText>
                </ThemedView>
              )}
              <ThemedView style={styles.formActions}>
                <TouchableOpacity
                  style={[styles.formActionButton, styles.formActionCancel]}
                  onPress={cancelCreating}
                  disabled={isSubmitting}
                >
                  <Ionicons name="close" size={18} color="#000" />
                  <ThemedText style={styles.formActionCancelText}>Cancelar</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.formActionButton, styles.formActionSave, isSubmitting && styles.buttonDisabled]}
                  onPress={handleConfirmSave}
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

          {!isCreating && (
            <>
              {isLoading ? (
                <ThemedView style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#007AFF" />
                  <ThemedText style={styles.loadingText}>Cargando...</ThemedText>
                </ThemedView>
              ) : filtered.length === 0 ? (
                <ThemedView style={styles.emptyContainer}>
                  <ThemedText style={styles.emptyText}>
                    {filterCorpoId == null
                      ? 'Seleccione una sucursal en los filtros para ver registros. Si hay marca actual con sucursal, se aplicará al entrar.'
                      : 'No hay registros para esta sucursal'}
                  </ThemedText>
                </ThemedView>
              ) : (
                <ThemedView style={styles.listContainer}>{filtered.map(renderItem)}</ThemedView>
              )}
            </>
          )}
        </ThemedView>
      </ScrollView>

      {showFechaPicker && (
        <DateTimePicker
          value={fecha}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, date) => {
            setShowFechaPicker(false);
            if (date) setFecha(date);
          }}
        />
      )}

      <Modal
        visible={isCameraVisible}
        animationType="slide"
        onRequestClose={() => {
          setIsCameraVisible(false);
          setCameraTarget(null);
        }}
      >
        <View style={styles.cameraContainer}>
          <CameraView ref={cameraRef} style={styles.camera} facing="back">
            <View style={styles.cameraTopBar}>
              <TouchableOpacity
                style={styles.cameraCancelButton}
                onPress={() => {
                  setIsCameraVisible(false);
                  setCameraTarget(null);
                }}
              >
                <Ionicons name="close" size={26} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <View style={styles.cameraBottomBar}>
              <TouchableOpacity style={styles.cameraCaptureButton} onPress={takeBoletaPicture}>
                <Ionicons name="camera" size={34} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </CameraView>
        </View>
      </Modal>

      {/* Modal firma solicitante */}
      <Modal visible={isSignatureModalVisible} animationType="fade" transparent presentationStyle="overFullScreen" onRequestClose={closeFirmaSolicitanteModal}>
        <View style={styles.overlay}>
          <ThemedView style={styles.floatModalCard}>
            <ThemedView style={styles.floatModalHeader}>
              <ThemedText style={styles.modalTitle}>Dibujar firma</ThemedText>
              <TouchableOpacity onPress={closeFirmaSolicitanteModal}>
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

      <CambiosAppsModulesModal
        visible={isCambiosModalVisible}
        title={cambiosTitle}
        items={cambiosItems}
        onClose={closeCambiosModal}
      />

      <AppFooter />
      <SlideMenu isVisible={isMenuVisible} onClose={handleMenuClose} onHomePress={handleHomePress} currentRoute="ApreciacionVulnerabilidad" />
      {QRScannerComponent}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  cameraContainer: { flex: 1, backgroundColor: '#000000' },
  camera: { flex: 1, justifyContent: 'space-between' },
  cameraTopBar: { paddingTop: 50, paddingHorizontal: 16, alignItems: 'flex-end' },
  cameraBottomBar: { paddingBottom: 40, alignItems: 'center' },
  cameraCancelButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  cameraCaptureButton: { width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },
  content: { width: '100%', maxWidth: 900, alignSelf: 'center' },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 16, fontSize: 16, opacity: 0.7 },
  errorText: { color: '#FF3B30', textAlign: 'center', marginBottom: 12 },
  offlineText: { color: '#8A6D00', textAlign: 'center', marginBottom: 12 },

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

  warningText: { color: '#FF3B30', marginTop: 6, fontWeight: '600' },
  structureLoadingBox: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  structureLoadingText: { color: '#333', fontWeight: '700' },

  createButton: { backgroundColor: '#007AFF', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginBottom: 16 },
  createButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },

  formCard: { marginTop: 12, backgroundColor: '#fff', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#E0E0E0' },
  formTitle: { fontSize: 18, fontWeight: '800', marginBottom: 10, color: '#000' },
  label: { fontSize: 13, fontWeight: '700', marginTop: 10, color: '#333' },
  input: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, backgroundColor: '#fff', color: '#000', marginBottom: 6 },
  textArea: { minHeight: 90, textAlignVertical: 'top' },

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

  selectButton: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  selectButtonText: { color: '#000', fontWeight: '600' },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    marginBottom: 6,
  },

  sectionTitle: { marginTop: 14, fontSize: 15, fontWeight: '800', color: '#007AFF' },

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

  innerCollapseSummary: { fontSize: 12, color: '#333', marginBottom: 8, fontWeight: '600' },
  innerCollapseContent: { marginTop: 8, padding: 10, borderRadius: 10, backgroundColor: '#F8F9FA', borderWidth: 1, borderColor: '#E0E0E0' },
  boletaResultsSection: { marginBottom: 12, backgroundColor: '#F8F9FA' },
  boletaResultsTitle: { fontSize: 14, fontWeight: '900', color: '#000', marginBottom: 8, backgroundColor: '#F8F9FA' },
  boletaResultRow: { marginBottom: 10, backgroundColor: '#F8F9FA' },
  boletaResultLabel: { color: '#000', fontWeight: '700', marginBottom: 4, backgroundColor: '#F8F9FA' },
  boletaResultValue: { color: '#007AFF', fontWeight: '900', backgroundColor: '#F8F9FA' },

  rowButtons: { marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rowButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 8, gap: 8 },
  editButton: { backgroundColor: '#007AFF' },
  changesButton: { backgroundColor: '#5856D6', flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 8, gap: 8 },
  deleteButton: { backgroundColor: '#FF3B30' },
  rowButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  floatModalCardMovimientos: { backgroundColor: '#FFFFFF', borderRadius: 12, width: '100%', maxWidth: 500, maxHeight: '80%', borderWidth: 1, borderColor: '#E0E0E0', overflow: 'hidden' },
  cambioCollapsableMain: { width: '100%', marginBottom: 10, backgroundColor: '#fff', borderRadius: 6, borderWidth: 1, borderColor: '#E0E0E0', overflow: 'hidden' },
  cambioCollapsableHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#F8F9FA' },
  cambioCollapsableTitle: { fontSize: 14, fontWeight: '600', color: '#007AFF', flex: 1 },
  cambioCollapsableContent: { padding: 12, gap: 8, backgroundColor: '#F8F9FA' },
  changeDescriptionContainer: { marginBottom: 8 },
  changeDescription: { fontSize: 14, lineHeight: 20, color: '#666' },
  cambioSignatureImage: {
    marginTop: 6,
    height: 80,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  filterGroupSearch: { marginBottom: 12 },

  // boleta
  boletaSection: { marginTop: 12, padding: 12, borderRadius: 10, backgroundColor: '#F8F9FA', borderWidth: 1, borderColor: '#E0E0E0' },
  boletaSectionTitle: { fontSize: 15, fontWeight: '900', color: '#000', backgroundColor: '#F8F9FA', marginBottom: 8 },
  boletaRow: { marginBottom: 10, backgroundColor: '#F8F9FA' },
  boletaLabel: { color: '#000', marginBottom: 6, fontWeight: '700', backgroundColor: '#F8F9FA' },
  boletaRowRight: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: '#F8F9FA' },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#F8F9FA',
  },
  radioOptionText: { fontWeight: '800', color: '#000' },
  radioOptionTextSelected: { color: '#007AFF' },
  trashTiny: { width: 34, height: 34, borderRadius: 8, backgroundColor: '#FF3B30', alignItems: 'center', justifyContent: 'center' },
  trashTinyPlaceholder: { width: 34, height: 34 },
  addOptionRow: { marginTop: 8, flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: '#F8F9FA' },
  addTiny: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#007AFF', alignItems: 'center', justifyContent: 'center' },

  // metricas
  metricasBox: { marginTop: 14, borderRadius: 10, borderWidth: 1, borderColor: '#E0E0E0', backgroundColor: '#FFFFFF', overflow: 'hidden' },
  metricasHeader: { padding: 12, backgroundColor: '#F0F0F0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  metricasTitle: { fontWeight: '900', color: '#000', flex: 1 },
  metricasContent: { padding: 12, backgroundColor: '#F9F9F9' },
  metricaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 },
  metricaText: { color: '#000', flex: 1, fontWeight: '700' },

  // firma solicitante preview
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
  signatureActionButton: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  signatureActionButtonText: {
    color: '#007AFF',
    fontSize: 13,
    fontWeight: '700',
  },

  // Firma responsable (alineado con StaffEvaluationsScreen)
  formGroup: { marginBottom: 16 },
  formLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8, color: '#333' },
  signatureButtonsRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  signatureButtonPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    gap: 8,
    flex: 1,
  },
  signatureButtonPrimaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  signatureButtonPrimaryDisabled: { opacity: 0.6 },

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

  signatureInfo: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  signatureInfoTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 4 },
  signatureInfoText: { fontSize: 12, marginBottom: 2 },

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

  // overlays / modals
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
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, gap: 12, backgroundColor: '#FFFFFF' },
  modalClearButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10, backgroundColor: '#EDEDED', gap: 8 },
  modalClearButtonText: { fontWeight: '800', color: '#000' },
  modalAcceptButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10, backgroundColor: '#D7F5E5', gap: 8 },
  modalAcceptButtonText: { fontWeight: '800', color: '#000' },
});


