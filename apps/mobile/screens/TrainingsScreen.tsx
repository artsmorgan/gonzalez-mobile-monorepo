import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Platform,
  Modal
} from 'react-native';
import DateTimePicker from "@react-native-community/datetimepicker";
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useAuth } from '@/contexts/AuthContext';
import AppHeader from '@/components/AppHeader';
import AppFooter from '@/components/AppFooter';
import SlideMenu from '@/components/SlideMenu';
import { useNavigation, useFocusEffect, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import { Picker } from '@react-native-picker/picker';
import { formatDateDMY } from '@/utils/formatDate';
import * as Location from 'expo-location';
import { jwtDecode } from 'jwt-decode';
import { useQRScanner } from '@/hooks/useQRScanner';
import * as Network from 'expo-network';
import { createTraining as createTrainingAPI, deleteTraining as deleteTrainingAPI } from '@/hooks/trainingFunctions';
import getHoraAccion from '@/hooks/getHoraAccion';
import { eventBus } from '@/hooks/eventBus';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'react-native';
import authedFetch from '@/hooks/authedFetch';
import getValidAccessTokenOrLogout from '@/hooks/getValidAccessTokenOrLogout';
import {
  getTrainingRecordCorpoId,
  mergeTrainingsCacheForCorpo,
} from '@/hooks/trainingsCacheHelpers';

type TrainingsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Trainings'>;
type TrainingsScreenRouteProp = RouteProp<RootStackParamList, 'Trainings'>;

interface Empresa {
  id: number;
  nombre: string;
}

interface Cliente {
  id: number;
  nombre: string;
}

interface Sucursal {
  id: number;
  nombre: string;
}

interface Puesto {
  id: number;
  nombre: string;
}

interface Empleado {
  id: number;
  nombre: string;
  cedula: string;
  fecha_contratacion: string;
}

interface EmpleadoList {
  nombre: string;
  cedula: string;
}

interface Responsable {
  nombre: string;
  cedula: string;
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
    cedula_empleado: string;
  };
}

interface Training {
  id: number;
  empresa: Empresa;
  cliente: Cliente;
  sucursal: Sucursal;
  titulo: string;
  descripcion: string;
  tipo: string;
  resultado: string | null;
  observaciones: string;
  responsable: Responsable;
  firma_responsable: string;
  nombre_firma: string;
  fecha: string;
  base64_file: string;
  empleados: Array<{
    id: number;
    nombre: string;
    cedula: string;
  }>;
  puestos: Array<{
    id: number;
    nombre: string;
  }>;
  id_local: string;
  /** Sucursal explícita en caché / offline (p. ej. al filtrar contra el corpo del filtro) */
  corpo_id?: number;
}

function stripQueuedTrainingDeletesForTrainingId(actions: any[], trainingId: number): any[] {
  const id = Number(trainingId);
  if (!Number.isFinite(id)) return actions;
  return actions.filter(
    (a: any) => !(a?.type === 'delete' && Number(a.trainingId) === id)
  );
}

function appendOfflineTrainingDelete(
  actions: any[],
  params: { queueId: string; trainingId: number; marcaId: number }
): any[] {
  const next = stripQueuedTrainingDeletesForTrainingId(actions, params.trainingId);
  next.push({
    type: 'delete',
    id: params.queueId,
    trainingId: params.trainingId,
    marcaId: params.marcaId,
  });
  return next;
}

interface DivisionNode {
  id: number;
  nombre: string;
  contratos?: ContratoNode[];
}
interface ContratoNode {
  id: number;
  nombre: string;
  sucursales?: SucursalNode[];
}
interface SucursalNode extends Sucursal {
  nro_sucursal?: string;
  /** Árbol main-structure: puesto → plazas → empleados */
  puestos?: Array<{
    id: number;
    nombre?: string;
    plazas?: Array<{
      id?: number;
      nombre?: string;
      empleados?: Array<{
        id?: number;
        nombre?: string;
        primer_apellido?: string;
        segundo_apellido?: string;
        cedula?: string;
        fecha_contratacion?: string | null;
      }>;
    }>;
  }>;
}
interface ClienteStructure {
  id: number;
  nombre: string;
  division?: DivisionNode[];
}
interface EmpresaStructure {
  id: number;
  nombre: string;
  codigo?: string;
  clientes?: ClienteStructure[];
}
type StructureTree = EmpresaStructure[];

type HierarchyPath = {
  empresaId: number | null;
  clienteId: number | null;
  divisionId: number | null;
  contratoId: number | null;
  sucursalId: number | null;
  puestoId: number | null;
};

const getMarcaDivisionIdFromCurrent = (current: any): number | null => {
  const raw =
    current?.roleDivision?.division?.id ??
    current?.role_division?.division?.id ??
    current?.division?.id ??
    current?.division_id;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const resolveDivisionIdInTree = (
  tree: StructureTree,
  empresaId: number | null,
  clienteId: number | null,
  divisionId: number | null
): number | null => {
  if (!Array.isArray(tree) || tree.length === 0 || divisionId == null) return divisionId;
  const empresa = tree.find((e) => Number(e?.id) === Number(empresaId));
  const clientes = Array.isArray(empresa?.clientes) ? empresa.clientes : [];
  const cliente = clientes.find((c) => Number(c?.id) === Number(clienteId));
  const divisiones = Array.isArray(cliente?.division) ? cliente.division : [];
  if (divisiones.some((d) => Number(d?.id) === Number(divisionId))) return divisionId;
  return null;
};

const findContratoIdForSucursalIn = (tree: StructureTree, sucursalId: number | null): number | null => {
  if (sucursalId == null) return null;
  for (const empresa of tree || []) {
    for (const cliente of empresa.clientes || []) {
      for (const division of cliente.division || []) {
        for (const contrato of division.contratos || []) {
          for (const sucursal of contrato.sucursales || []) {
            if (Number(sucursal.id) === Number(sucursalId)) {
              return contrato.id;
            }
          }
        }
      }
    }
  }
  return null;
};

/** Localiza la sucursal (corpo) en el árbol `main_structure_cache`, misma jerarquía que main-structure/route.ts */
const findSucursalNodeByIdInTree = (
  tree: StructureTree,
  sucursalId: number
): SucursalNode | null => {
  for (const empresa of tree || []) {
    for (const cliente of empresa.clientes || []) {
      for (const division of cliente.division || []) {
        for (const contrato of division.contratos || []) {
          for (const sucursal of contrato.sucursales || []) {
            if (Number(sucursal.id) === Number(sucursalId)) {
              return sucursal as SucursalNode;
            }
          }
        }
      }
    }
  }
  return null;
};

const extractPuestosUniqueFromSucursalNode = (sucursal: SucursalNode): Puesto[] => {
  const byId = new Map<number, Puesto>();
  for (const p of sucursal.puestos || []) {
    const id = Number(p?.id);
    if (!Number.isFinite(id) || byId.has(id)) continue;
    byId.set(id, { id, nombre: String(p?.nombre ?? '') });
  }
  return [...byId.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
};

const extractEmpleadosUniqueFromSucursalNode = (sucursal: SucursalNode): Empleado[] => {
  const byId = new Map<number, Empleado>();
  for (const puesto of sucursal.puestos || []) {
    for (const plaza of puesto.plazas || []) {
      for (const emp of plaza.empleados || []) {
        const id = Number(emp?.id);
        if (!Number.isFinite(id) || byId.has(id)) continue;
        const nombre = [emp?.nombre, emp?.primer_apellido, emp?.segundo_apellido]
          .filter((x) => x != null && String(x).trim() !== '')
          .map((x) => String(x).trim())
          .join(' ');
        byId.set(id, {
          id,
          nombre: nombre || String(emp?.nombre ?? ''),
          cedula: String(emp?.cedula ?? ''),
          fecha_contratacion:
            emp?.fecha_contratacion != null ? String(emp.fecha_contratacion) : '',
        });
      }
    }
  }
  return [...byId.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
};

/** Jerarquía desde `current_marca` almacenada como en MarcarIngresoSalidaScreen (empresa, cliente, contrato, corpo, roleDivision.division, puesto). */
const buildHierarchyFromCurrentMarca = (current: any, tree: StructureTree): HierarchyPath => {
  const empresaId = current?.empresa?.id != null ? Number(current.empresa.id) : null;
  const clienteId = current?.cliente?.id != null ? Number(current.cliente.id) : null;
  const divisionIdRaw = getMarcaDivisionIdFromCurrent(current);
  const divisionId = resolveDivisionIdInTree(tree, empresaId, clienteId, divisionIdRaw);
  const corpoId = current?.corpo?.id != null ? Number(current.corpo.id) : null;
  let contratoId = current?.contrato?.id != null ? Number(current.contrato.id) : null;
  if (contratoId == null && corpoId != null) {
    contratoId = findContratoIdForSucursalIn(tree, corpoId);
  }
  const puestoId = current?.puesto?.id != null ? Number(current.puesto.id) : null;
  return {
    empresaId,
    clienteId,
    divisionId,
    contratoId,
    sucursalId: corpoId,
    puestoId,
  };
};

/** Al usar caché: filtra por el corpo seleccionado en el filtro (usa `corpo_id` si existe, si no `sucursal.id`). */
function filterCachedTrainingsForSelectedCorpo(
  list: Training[],
  selectedCorpoId: number,
  matchCacheToFilterCorpo: boolean
): Training[] {
  if (!matchCacheToFilterCorpo) {
    return list.filter((t) => t.sucursal?.id === selectedCorpoId);
  }
  return list.filter((t) => getTrainingRecordCorpoId(t) === selectedCorpoId);
}

export default function TrainingsScreen() {
  const route = useRoute<TrainingsScreenRouteProp>();
  const matchCacheToFilterCorpo = route.params?.matchCacheToFilterCorpo ?? true;

  const { employee, refreshAccessToken, logout, accessToken } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<TrainingsScreenNavigationProp>();

  // Data states
  const [trainings, setTrainings] = useState<Training[]>([]);
  /** Carga inicial: verificar marca y estructura */
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  /** Carga de listado desde API (no oculta filtros) */
  const [isListLoading, setIsListLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Importante: "sin internet" NO cuenta como error (solo es un estado informativo)
  const [offlineMessage, setOfflineMessage] = useState<string | null>(null);
  const [hasMarca, setHasMarca] = useState<boolean>(false);
  const [marcaId, setMarcaId] = useState<number | null>(null);
  const [corpoId, setCorpoId] = useState<number | null>(null);
  const [roleName, setRoleName] = useState<string | null>(null);
  const [structure, setStructure] = useState<EmpresaStructure[]>([]);

  // Dropdowns data (corpo del formulario de creación)
  const [puestos, setPuestos] = useState<Puesto[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);

  // Form states
  const [isCreating, setIsCreating] = useState(false);
  const [isCreateSubmitting, setIsCreateSubmitting] = useState(false);
  const [formKey, setFormKey] = useState(0); // Key para forzar re-render de inputs
  const [fechaCapacitacion, setFechaCapacitacion] = useState('');
  const [showFechaCapacitacionPicker, setShowFechaCapacitacionPicker] = useState(false);
  const [firmaResponsable, setFirmaResponsable] = useState<FirmaData | null>(null);
  const [isGeneratingFirma, setIsGeneratingFirma] = useState(false);
  const [selectedTipo, setSelectedTipo] = useState<'Prescencial' | 'Virtual'>('Prescencial');
  const [selectedEmpleados, setSelectedEmpleados] = useState<Empleado[]>([]);
  const [codigoEmpleadoBusqueda, setCodigoEmpleadoBusqueda] = useState<string>('');
  const [selectedPuestos, setSelectedPuestos] = useState<Puesto[]>([]);
  const [trainingImageBase64, setTrainingImageBase64] = useState<string | null>(null);
  const [decodedFirmas, setDecodedFirmas] = useState<Map<number, FirmaData>>(new Map());

  // Form refs
  const tituloRef = useRef('');
  const descripcionRef = useRef('');
  const observacionesRef = useRef('');
  const nombreResponsableRef = useRef('');
  const cedulaResponsableRef = useRef('');

  // Form dropdowns
  const [selectedResultado, setSelectedResultado] = useState<string>('');

  // Location state
  const [location, setLocation] = useState<Location.LocationObject | null>(null);

  // Camera state
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);

  // QR Scanner
  const { scanQR, QRScannerComponent } = useQRScanner();

  // Expanded trainings state (usando string para mayor compatibilidad)
  const [expandedTrainings, setExpandedTrainings] = useState<Set<string>>(new Set());

  const [filterEmpresaId, setFilterEmpresaId] = useState<number | null>(null);
  const [filterClienteId, setFilterClienteId] = useState<number | null>(null);
  const [filterDivisionId, setFilterDivisionId] = useState<number | null>(null);
  const [filterContratoId, setFilterContratoId] = useState<number | null>(null);
  const [filterCorpoId, setFilterCorpoId] = useState<number | null>(null);

  const [formEmpresaId, setFormEmpresaId] = useState<number | null>(null);
  const [formClienteId, setFormClienteId] = useState<number | null>(null);
  const [formDivisionId, setFormDivisionId] = useState<number | null>(null);
  const [formContratoId, setFormContratoId] = useState<number | null>(null);
  const [formCorpoId, setFormCorpoId] = useState<number | null>(null);
  const isRestoringFormHierarchyRef = useRef(false);
  const pendingFormHierarchyRef = useRef<HierarchyPath | null>(null);
  const isApplyingFormHierarchyRef = useRef(false);

  const [deletingTrainingKey, setDeletingTrainingKey] = useState<string | null>(null);

  // Filter states (solo campos no cubiertos por la jerarquía de selects)
  const [filterEmpleado, setFilterEmpleado] = useState('');
  const [filterPuestoNombre, setFilterPuestoNombre] = useState('');
  const [filterResponsable, setFilterResponsable] = useState('');
  const [filterDescripcion, setFilterDescripcion] = useState('');
  const [filterResultado, setFilterResultado] = useState('');
  const [filterObservaciones, setFilterObservaciones] = useState('');
  const [filterFecha, setFilterFecha] = useState('');
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  const [showFilterFechaPicker, setShowFilterFechaPicker] = useState(false);

  const fetchMainStructure = useCallback(async (): Promise<EmpresaStructure[]> => {
    try {
      const cacheStr = await AsyncStorage.getItem('main_structure_cache');
      if (!cacheStr) {
        setStructure([]);
        return [];
      }
      const parsed = JSON.parse(cacheStr);
      const arr = Array.isArray(parsed) ? parsed : [];
      setStructure(arr);
      return arr;
    } catch {
      setStructure([]);
      return [];
    }
  }, []);

  const applyHierarchyToFilters = useCallback((current: any, tree: StructureTree) => {
    if (!current?.empresa?.id) return;
    const path = buildHierarchyFromCurrentMarca(current, tree);
    setFilterEmpresaId(path.empresaId);
    setFilterClienteId(path.clienteId);
    setFilterDivisionId(path.divisionId);
    setFilterContratoId(path.contratoId);
    setFilterCorpoId(path.sucursalId);
  }, []);

  const applyFormHierarchySequentialFromMarca = useCallback((path: HierarchyPath) => {
    pendingFormHierarchyRef.current = path;
    isApplyingFormHierarchyRef.current = true;
    isRestoringFormHierarchyRef.current = true;
    setFormEmpresaId(path.empresaId);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setIsBootstrapping(true);
        try {
          const currentMarca = await AsyncStorage.getItem('current_marca');
          if (!currentMarca) {
            if (!cancelled) {
              setHasMarca(false);
              setIsBootstrapping(false);
            }
            return;
          }
          const marcaData = JSON.parse(currentMarca);
          const marca_id = Number(marcaData?.id ?? 0) || null;
          const corpo_id = Number(marcaData?.corpo?.id ?? marcaData?.corpo_id ?? 0) || null;
          if (!cancelled) {
            setMarcaId(marca_id);
            setCorpoId(corpo_id);
            setRoleName(marcaData?.roleDivision?.role?.nombre ?? null);
            setHasMarca(true);
          }
          const tree = await fetchMainStructure();
          if (!cancelled) {
            applyHierarchyToFilters(marcaData, tree);
          }
        } catch {
          if (!cancelled) setHasMarca(false);
        } finally {
          if (!cancelled) setIsBootstrapping(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [fetchMainStructure, applyHierarchyToFilters])
  );

  const checkConnection = async (): Promise<boolean> => {
    //return false;
    const networkState = await Network.getNetworkStateAsync();
    return networkState.isConnected && networkState.isInternetReachable ? true : false;
  };

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

  const getEmpleadoByCodigo = async (codigo: string) => {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }
    const response = await authedFetch({
      url: `${apiUrl}/api/empleados/codigo/${encodeURIComponent(String(codigo).trim())}`,
      init: {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      refreshAccessToken,
      logout,
    });

    if (!response) {
      throw new Error('Sesión expirada');
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData?.message || 'No se pudo obtener el empleado por código');
    }

    const data = await response.json();
    if (!data?.status || !data?.data) {
      throw new Error(data?.message || 'Empleado no encontrado');
    }

    return data.data;
  };

  const hydratePuestosEmpleadosForCorpo = useCallback(async (corpoId: number) => {
    let tree: StructureTree = Array.isArray(structure) ? structure : [];
    if (tree.length === 0) {
      try {
        const raw = await AsyncStorage.getItem('main_structure_cache');
        if (raw) {
          const parsed = JSON.parse(raw);
          tree = Array.isArray(parsed) ? parsed : [];
        }
      } catch {
        tree = [];
      }
    }
    const sucursalNode = findSucursalNodeByIdInTree(tree, corpoId);
    if (!sucursalNode) {
      setPuestos([]);
      setEmpleados([]);
      return;
    }
    setPuestos(extractPuestosUniqueFromSucursalNode(sucursalNode));
    setEmpleados(extractEmpleadosUniqueFromSucursalNode(sucursalNode));
  }, [structure]);

  const listFetchGenRef = useRef(0);

  const fetchTrainingsForCorpo = useCallback(async () => {
    const marca_id = marcaId;
    const corpo_id = filterCorpoId != null ? Number(filterCorpoId) : null;
    if (!marca_id || corpo_id == null || !Number.isFinite(corpo_id) || corpo_id <= 0) {
      listFetchGenRef.current += 1;
      setIsListLoading(false);
      setTrainings([]);
      return;
    }
    const gen = ++listFetchGenRef.current;
    const isStale = () => gen !== listFetchGenRef.current;

    try {
      if (!isStale()) {
        setIsListLoading(true);
        setError(null);
        setOfflineMessage(null);
      }

      const hasConnection = await checkConnection();
      if (isStale()) return;

      if (hasConnection) {
        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) {
          throw new Error('Server URL not configured');
        }
        const response = await authedFetch({
          url: `${apiUrl}/api/training?m=${marca_id}&corpo_id=${corpo_id}`,
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
        if (isStale()) return;

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (isStale()) return;

        if (data.status && Array.isArray(data.capacitaciones)) {
          const trainingsWithDecodedFirmas = await Promise.all(
            data.capacitaciones.map(async (training: Training) => {
              if (training.firma_responsable && training.firma_responsable.trim() !== '') {
                try {
                  const decodedString = atob(training.firma_responsable);
                  const parts = decodedString.split(':');
                  if (parts.length === 5) {
                    const [sessionId, empleadoId, latitud, longitud, timestamp] = parts;

                    let empleadoDetalle = undefined;
                    try {
                      const empleadoResponse = await authedFetch({
                        url: `${apiUrl}/api/empleados/${empleadoId}`,
                        init: {
                          method: 'GET',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                        },
                        refreshAccessToken,
                        logout,
                      });
                      if (!empleadoResponse) return training;

                      if (empleadoResponse.ok) {
                        const empleadoData = await empleadoResponse.json();
                        empleadoDetalle = {
                          nombre: empleadoData.nombre,
                          primer_apellido: empleadoData.primer_apellido,
                          segundo_apellido: empleadoData.segundo_apellido,
                          cedula_empleado: empleadoData.cedula || '',
                        };
                      }
                    } catch (err) {
                      console.error('Error fetching empleado details:', err);
                    }

                    const firmaData: FirmaData = {
                      sessionId,
                      empleadoId,
                      latitud,
                      longitud,
                      timestamp,
                      empleadoDetalle,
                    };

                    setDecodedFirmas(prev => {
                      const newMap = new Map(prev);
                      newMap.set(training.id, firmaData);
                      return newMap;
                    });
                  }
                } catch (err) {
                  console.error('Error decoding firma:', err);
                }
              }
              return training;
            })
          );

          if (!isStale()) {
            const withCorpo = trainingsWithDecodedFirmas.map((t: Training) => ({
              ...t,
              corpo_id: t.corpo_id ?? t.sucursal?.id,
            }));
            let prevCache: Training[] = [];
            try {
              const prevStr = await AsyncStorage.getItem('trainings_cache');
              if (prevStr) {
                const parsed = JSON.parse(prevStr);
                prevCache = Array.isArray(parsed) ? parsed : [];
              }
            } catch {
              prevCache = [];
            }
            const mergedCache = mergeTrainingsCacheForCorpo(prevCache, withCorpo, corpo_id);
            await AsyncStorage.setItem('trainings_cache', JSON.stringify(mergedCache));
            const forDisplay = filterCachedTrainingsForSelectedCorpo(
              mergedCache,
              corpo_id,
              matchCacheToFilterCorpo
            );
            setTrainings(forDisplay);
          }
        } else {
          if (!isStale()) {
            let readCacheOk = false;
            try {
              const trainingsCache = await AsyncStorage.getItem('trainings_cache');
              if (trainingsCache) {
                const parsed = JSON.parse(trainingsCache);
                const cachedTrainings = Array.isArray(parsed) ? (parsed as Training[]) : [];
                readCacheOk = true;
                const filteredCache = filterCachedTrainingsForSelectedCorpo(
                  cachedTrainings,
                  corpo_id,
                  matchCacheToFilterCorpo
                );
                setTrainings(filteredCache);
                if (filteredCache.length > 0) {
                  setOfflineMessage(
                    'La respuesta del servidor no fue válida; se muestran capacitaciones en caché para la sucursal seleccionada.'
                  );
                } else {
                  setOfflineMessage(null);
                }
              }
            } catch {
              /* ignorar caché corrupta */
            }
            if (!readCacheOk) {
              setTrainings([]);
            }
            if (data?.message) setError(String(data.message));
          }
        }

        if (!isStale()) {
          await hydratePuestosEmpleadosForCorpo(corpo_id);
          setCorpoId(corpo_id);
        }
      } else {
        const trainingsCache = await AsyncStorage.getItem('trainings_cache');
        if (isStale()) return;
        if (trainingsCache) {
          const cachedTrainings = JSON.parse(trainingsCache) as Training[];
          const filteredCache = filterCachedTrainingsForSelectedCorpo(
            cachedTrainings,
            corpo_id,
            matchCacheToFilterCorpo
          );
          setTrainings(filteredCache);
          setOfflineMessage('Modo Offline: mostrando capacitaciones guardadas para la sucursal seleccionada.');
        } else {
          setTrainings([]);
          setOfflineMessage('Sin conexión: no hay capacitaciones guardadas para mostrar.');
        }

        await hydratePuestosEmpleadosForCorpo(corpo_id);
      }
    } catch (error) {
      if (isStale()) return;
      console.error('Error fetching trainings:', error);
      const trainingsCache = await AsyncStorage.getItem('trainings_cache');
      if (trainingsCache) {
        const cachedTrainings = JSON.parse(trainingsCache) as Training[];
        const filteredCache = filterCachedTrainingsForSelectedCorpo(
          cachedTrainings,
          corpo_id,
          matchCacheToFilterCorpo
        );
        setTrainings(filteredCache);
        setOfflineMessage('Modo Offline: mostrando capacitaciones guardadas debido a un error de conexión.');
      } else {
        setTrainings([]);
        if (isProbablyNetworkError(error)) {
          setOfflineMessage('Sin conexión: no hay capacitaciones guardadas para mostrar.');
        } else {
          setError('Error al cargar las capacitaciones');
        }
      }

      await hydratePuestosEmpleadosForCorpo(corpo_id);
    } finally {
      if (!isStale()) setIsListLoading(false);
    }
  }, [marcaId, filterCorpoId, refreshAccessToken, logout, matchCacheToFilterCorpo, hydratePuestosEmpleadosForCorpo]);

  const fetchTrainingsForCorpoRef = useRef<(() => Promise<void>) | null>(null);
  fetchTrainingsForCorpoRef.current = fetchTrainingsForCorpo;

  useEffect(() => {
    const cid = filterCorpoId != null ? Number(filterCorpoId) : null;
    if (!marcaId || cid == null || !Number.isFinite(cid) || cid <= 0) {
      listFetchGenRef.current += 1;
      setIsListLoading(false);
      setTrainings([]);
      return;
    }
    void fetchTrainingsForCorpoRef.current?.();
  }, [marcaId, filterCorpoId]);

  useEffect(() => {
    const handler = () => {
      if (filterCorpoId != null && marcaId != null) {
        void fetchTrainingsForCorpoRef.current?.();
      }
    };
    eventBus.on('connectionRestored', handler);
    return () => {
      eventBus.off('connectionRestored', handler);
    };
  }, [filterCorpoId, marcaId]);

  const dateToLocalString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDateForDisplay = (dateString: string): string => {
    if (!dateString) return 'Seleccionar fecha';
    const [year, month, day] = dateString.split('-');
    return `${day}-${month}-${year}`;
  };

  const filterStructureRoots = useMemo(() => (Array.isArray(structure) ? structure : []), [structure]);
  const filterClientes = useMemo(() => {
    const empresa = filterStructureRoots.find((e) => e.id === filterEmpresaId);
    return empresa?.clientes || [];
  }, [filterStructureRoots, filterEmpresaId]);
  const filterDivisiones = useMemo(() => {
    const cliente = filterClientes.find((c) => c.id === filterClienteId);
    return cliente?.division || [];
  }, [filterClientes, filterClienteId]);
  const filterContratos = useMemo(() => {
    const division = filterDivisiones.find((d) => d.id === filterDivisionId);
    return division?.contratos || [];
  }, [filterDivisiones, filterDivisionId]);
  const filterSucursales = useMemo(() => {
    const contrato = filterContratos.find((c) => c.id === filterContratoId);
    return contrato?.sucursales || [];
  }, [filterContratos, filterContratoId]);

  const formEmpresasList = useMemo(() => (Array.isArray(structure) ? structure : []), [structure]);
  const formClientesList = useMemo(() => {
    const e = formEmpresasList.find((x) => x.id === formEmpresaId);
    return e?.clientes || [];
  }, [formEmpresasList, formEmpresaId]);
  const formDivisionesList = useMemo(() => {
    const c = formClientesList.find((x) => x.id === formClienteId);
    return c?.division || [];
  }, [formClientesList, formClienteId]);
  const formContratosList = useMemo(() => {
    const d = formDivisionesList.find((x) => x.id === formDivisionId);
    return d?.contratos || [];
  }, [formDivisionesList, formDivisionId]);
  const formSucursalesList = useMemo(() => {
    const c = formContratosList.find((x) => x.id === formContratoId);
    return c?.sucursales || [];
  }, [formContratosList, formContratoId]);
  const formPuestosFromStructure = useMemo((): Puesto[] => {
    const s = formSucursalesList.find((x) => x.id === formCorpoId) as SucursalNode | undefined;
    if (!s) return [];
    return extractPuestosUniqueFromSucursalNode(s);
  }, [formSucursalesList, formCorpoId]);
  const puestosForFormPicker = useMemo(
    () => (puestos.length > 0 ? puestos : formPuestosFromStructure),
    [puestos, formPuestosFromStructure]
  );

  const normPicker = (v: unknown): number | null =>
    v != null && v !== '' ? Number(v) : null;

  useEffect(() => {
    const pending = pendingFormHierarchyRef.current;
    if (!pending || !isApplyingFormHierarchyRef.current || !isCreating) return;

    if ((pending.empresaId ?? null) !== (formEmpresaId ?? null)) {
      setFormEmpresaId(pending.empresaId ?? null);
      return;
    }
    if ((pending.clienteId ?? null) !== (formClienteId ?? null)) {
      setFormClienteId(pending.clienteId ?? null);
      return;
    }
    if ((pending.divisionId ?? null) !== (formDivisionId ?? null)) {
      setFormDivisionId(pending.divisionId ?? null);
      return;
    }
    if ((pending.contratoId ?? null) !== (formContratoId ?? null)) {
      setFormContratoId(pending.contratoId ?? null);
      return;
    }
    if ((pending.sucursalId ?? null) !== (formCorpoId ?? null)) {
      setFormCorpoId(pending.sucursalId ?? null);
      return;
    }

    pendingFormHierarchyRef.current = null;
    isApplyingFormHierarchyRef.current = false;
    isRestoringFormHierarchyRef.current = false;
  }, [isCreating, formEmpresaId, formClienteId, formDivisionId, formContratoId, formCorpoId]);

  useEffect(() => {
    if (isRestoringFormHierarchyRef.current) return;
    setFormClienteId(null);
    setFormDivisionId(null);
    setFormContratoId(null);
    setFormCorpoId(null);
  }, [formEmpresaId]);

  useEffect(() => {
    if (isRestoringFormHierarchyRef.current) return;
    setFormDivisionId(null);
    setFormContratoId(null);
    setFormCorpoId(null);
  }, [formClienteId]);

  useEffect(() => {
    if (isRestoringFormHierarchyRef.current) return;
    setFormContratoId(null);
    setFormCorpoId(null);
  }, [formDivisionId]);

  useEffect(() => {
    if (isRestoringFormHierarchyRef.current) return;
    setFormCorpoId(null);
  }, [formContratoId]);

  useEffect(() => {
    if (formCorpoId == null) {
      setPuestos([]);
      setEmpleados([]);
      return;
    }
    void hydratePuestosEmpleadosForCorpo(formCorpoId);
  }, [formCorpoId, hydratePuestosEmpleadosForCorpo]);

  const startCreating = async () => {
    const horaAccion = await getHoraAccion();
    if (!horaAccion) {
      Alert.alert('Error', 'No se pudo obtener la hora');
      return;
    }
    pendingFormHierarchyRef.current = null;
    isApplyingFormHierarchyRef.current = false;
    isRestoringFormHierarchyRef.current = false;
    setFormEmpresaId(null);
    setFormClienteId(null);
    setFormDivisionId(null);
    setFormContratoId(null);
    setFormCorpoId(null);
    setIsCreating(true);
    setFormKey(prev => prev + 1); // Incrementar key para forzar re-render
    tituloRef.current = '';
    descripcionRef.current = '';
    observacionesRef.current = '';
    nombreResponsableRef.current = employee?.name || '';
    cedulaResponsableRef.current = employee?.cedula || '';
    setFechaCapacitacion(new Date(horaAccion).toISOString().split('T')[0]);
    setSelectedTipo('Prescencial');
    setSelectedEmpleados([]);
    setSelectedPuestos([]);
    setSelectedResultado('');
    setFirmaResponsable(null);
    setTrainingImageBase64(null);
    setLocation(null);

    try {
      const currentMarcaStr = await AsyncStorage.getItem('current_marca');
      const tree = structure.length > 0 ? structure : await fetchMainStructure();
      if (currentMarcaStr) {
        const marcaObj = JSON.parse(currentMarcaStr);
        const path = buildHierarchyFromCurrentMarca(marcaObj, tree);
        applyFormHierarchySequentialFromMarca(path);
      }
    } catch (e) {
      console.error('Precarga jerarquía formulario:', e);
    }

    // Request location permissions
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Error', 'Se necesita permiso de ubicación para generar la firma');
          return;
        }
        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        setLocation(currentLocation);
      } catch (error) {
        console.error('Error getting location:', error);
      }
    })();
  };

  const cancelCreating = () => {
    pendingFormHierarchyRef.current = null;
    isApplyingFormHierarchyRef.current = false;
    isRestoringFormHierarchyRef.current = false;
    setIsCreating(false);
    resetForm();
  };

  const resetForm = () => {
    pendingFormHierarchyRef.current = null;
    isApplyingFormHierarchyRef.current = false;
    isRestoringFormHierarchyRef.current = false;
    setFormEmpresaId(null);
    setFormClienteId(null);
    setFormDivisionId(null);
    setFormContratoId(null);
    setFormCorpoId(null);
    setFormKey(prev => prev + 1); // Incrementar key para forzar re-render
    tituloRef.current = '';
    descripcionRef.current = '';
    observacionesRef.current = '';
    nombreResponsableRef.current = '';
    cedulaResponsableRef.current = '';
    setFechaCapacitacion('');
    setSelectedTipo('Prescencial');
    setSelectedEmpleados([]);
    setSelectedPuestos([]);
    setSelectedResultado('');
    setFirmaResponsable(null);
    setTrainingImageBase64(null);
    setLocation(null);
  };

  const removeEmpleado = (empleadoId: number) => {
    setSelectedEmpleados(selectedEmpleados.filter(e => e.id !== empleadoId));
  };

  const removePuesto = (puestoId: number) => {
    setSelectedPuestos(selectedPuestos.filter(p => p.id !== puestoId));
  };

  const openCamera = async () => {
    if (!permission) {
      const permissionResult = await requestPermission();
      if (!permissionResult.granted) {
        Alert.alert('Error', 'Se necesita permiso para acceder a la cámara');
        return;
      }
    }

    if (!permission?.granted) {
      const permissionResult = await requestPermission();
      if (!permissionResult.granted) {
        Alert.alert('Error', 'Se necesita permiso para acceder a la cámara');
        return;
      }
    }

    setIsCameraVisible(true);
  };

  const takePicture = async () => {
    if (!cameraRef.current) {
      Alert.alert('Error', 'Cámara no disponible');
      return;
    }

    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.7,
        skipProcessing: false
      });

      if (!photo) {
        Alert.alert('Error', 'No se pudo capturar la foto. Por favor intente nuevamente.');
        setIsCameraVisible(false);
        return;
      }

      if (!photo.base64) {
        Alert.alert('Error', 'No se pudo procesar la imagen. Por favor intente nuevamente.');
        setIsCameraVisible(false);
        return;
      }

      setIsCameraVisible(false);

      // Format base64 with data URI prefix
      const formattedBase64 = `data:image/jpeg;base64,${photo.base64!}`;

      setTimeout(() => {
        setTrainingImageBase64(formattedBase64);
      }, 100);
    } catch (error) {
      console.error('Error capturing image:', error);
      Alert.alert('Error', 'No se pudo capturar la imagen');
      setIsCameraVisible(false);
    }
  };


  const generateSignature = async () => {
    if (!employee) {
      Alert.alert('Error', 'No se pudo obtener la información del empleado');
      return;
    }

    if (!location) {
      Alert.alert('Error', 'No se pudo obtener la ubicación');
      return;
    }

    setIsGeneratingFirma(true);

    try {
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) {
        throw new Error('Server URL not configured');
      }
      const token = await getValidAccessTokenOrLogout({ refreshAccessToken, logout });
      if (!token) return;

      const decodedToken = jwtDecode(token);
      const sessionId = JSON.parse(JSON.stringify(decodedToken)).sessionId;

      const horaAccion = await getHoraAccion();
      if (!horaAccion) {
        throw new Error('Hora de acción not found');
      }

      // Encode base64
      const hash = btoa(sessionId + ":" + employee.id + ":" + location.coords.latitude + ":" + location.coords.longitude + ":" + horaAccion);

      // Decode to show info
      const decodedHash = atob(hash);
      const [decodedSessionId, decodedEmpleadoId, decodedLatitud, decodedLongitud, decodedTimestamp] = decodedHash.split(':');

      // Fetch empleado details
      const connectionStatus = await checkConnection();
      let empleadoDetalle = undefined;
      if (connectionStatus) {
        const empleadoResponse = await authedFetch({
          url: `${apiUrl}/api/empleados/${decodedEmpleadoId}`,
          init: {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          },
          refreshAccessToken,
          logout,
        });
        if (!empleadoResponse) return;

        if (empleadoResponse.ok) {
          const empleadoData = await empleadoResponse.json();
          empleadoDetalle = {
            nombre: empleadoData.nombre,
            primer_apellido: empleadoData.primer_apellido,
            segundo_apellido: empleadoData.segundo_apellido,
            cedula_empleado: empleadoData.cedula,
          };
        }
      }

      setFirmaResponsable({
        sessionId: decodedSessionId,
        empleadoId: decodedEmpleadoId,
        latitud: decodedLatitud,
        longitud: decodedLongitud,
        timestamp: decodedTimestamp,
        empleadoDetalle,
      });
    } catch (error) {
      console.error('Error generating signature:', error);
      Alert.alert('Error', 'No se pudo generar la firma digital');
    } finally {
      setIsGeneratingFirma(false);
    }
  };

  const handleScanQR = async () => {
    try {
      const qrData = await scanQR();
      if (!qrData) {
        return;
      }

      // Validar que sea base64 válido
      try {
        const decodedHash = atob(qrData);
        const parts = decodedHash.split(':');

        if (parts.length !== 5) {
          Alert.alert('Error', 'El QR no tiene la estructura esperada');
          return;
        }

        const [sessionId, empleadoId, latitud, longitud, timestamp] = parts;

        const connectionStatus = await checkConnection();

        let empleadoDetalle = undefined;
        if (connectionStatus) {
          // Fetch empleado details
          const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
          if (!apiUrl) {
            throw new Error('Server URL not configured');
          }
          const empleadoResponse = await authedFetch({
            url: `${apiUrl}/api/empleados/${empleadoId}`,
            init: {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
              },
            },
            refreshAccessToken,
            logout,
          });
          if (!empleadoResponse) return;

          if (empleadoResponse.ok) {
            const empleadoData = await empleadoResponse.json();
            empleadoDetalle = {
              nombre: empleadoData.nombre,
              primer_apellido: empleadoData.primer_apellido,
              segundo_apellido: empleadoData.segundo_apellido,
              cedula_empleado: empleadoData.cedula,
            };
          }
        }

        setFirmaResponsable({
          sessionId,
          empleadoId,
          latitud,
          longitud,
          timestamp,
          empleadoDetalle,
        });
      } catch (error) {
        Alert.alert('Error', 'El QR escaneado no es válido');
      }
    } catch (error) {
      console.error('Error scanning QR:', error);
      Alert.alert('Error', 'No se pudo escanear el código QR');
    }
  };

  const handleFechaCapacitacionChange = (event: any, selectedDate?: Date) => {
    setShowFechaCapacitacionPicker(Platform.OS === 'ios');
    if (selectedDate) {
      setFechaCapacitacion(dateToLocalString(selectedDate));
    }
  };

  const generateDateTime = (timestamp: string) => {
    const fecha = new Date(parseInt(timestamp)).toISOString();
    const fechaSplit = fecha.split('T');
    fechaSplit[1] = fechaSplit[1].split('.')[0];
    return fechaSplit[0] + ' ' + fechaSplit[1];
  };

  const toggleTrainingExpanded = (trainingKey: string) => {
    setExpandedTrainings(prev => {
      const newSet = new Set(prev);
      if (newSet.has(trainingKey)) {
        newSet.delete(trainingKey);
      } else {
        newSet.add(trainingKey);
      }
      return newSet;
    });
  };

  const resetAllFilters = useCallback(async () => {
    setFilterEmpleado('');
    setFilterPuestoNombre('');
    setFilterResponsable('');
    setFilterDescripcion('');
    setFilterResultado('');
    setFilterObservaciones('');
    setFilterFecha('');
    try {
      const raw = await AsyncStorage.getItem('current_marca');
      const tree = structure.length > 0 ? structure : await fetchMainStructure();
      if (raw) {
        applyHierarchyToFilters(JSON.parse(raw), tree);
      } else {
        setFilterEmpresaId(null);
        setFilterClienteId(null);
        setFilterDivisionId(null);
        setFilterContratoId(null);
        setFilterCorpoId(null);
      }
    } catch {
      setFilterEmpresaId(null);
      setFilterClienteId(null);
      setFilterDivisionId(null);
      setFilterContratoId(null);
      setFilterCorpoId(null);
    }
  }, [structure, fetchMainStructure, applyHierarchyToFilters]);

  const handleFilterFechaChange = (event: any, selectedDate?: Date) => {
    setShowFilterFechaPicker(Platform.OS === 'ios');
    if (selectedDate) {
      setFilterFecha(dateToLocalString(selectedDate));
    }
  };

  const filteredTrainings = trainings.filter((training) => {
    const matchesEmpresa = !filterEmpresaId || training.empresa.id === filterEmpresaId;
    const matchesCliente = !filterClienteId || training.cliente.id === filterClienteId;
    const matchesSucursal = !filterCorpoId || training.sucursal.id === filterCorpoId;

    const matchesEmpleado = !filterEmpleado ||
      training.empleados.some(e => e.nombre.toLowerCase().includes(filterEmpleado.toLowerCase()) || e.cedula.toLowerCase().includes(filterEmpleado.toLowerCase()));

    const puestoNeedle = filterPuestoNombre.trim().toLowerCase();
    const matchesPuesto =
      !puestoNeedle ||
      (training.puestos?.some((p) => p.nombre.toLowerCase().includes(puestoNeedle)) ?? false);

    const matchesResponsable = !filterResponsable ||
      training.responsable.nombre.toLowerCase().includes(filterResponsable.toLowerCase());

    const matchesDescripcion = !filterDescripcion ||
      training.descripcion.toLowerCase().includes(filterDescripcion.toLowerCase());

    const matchesResultado = !filterResultado ||
      (training.resultado && training.resultado.toLowerCase().includes(filterResultado.toLowerCase()));

    const matchesObservaciones = !filterObservaciones ||
      (training.observaciones && training.observaciones.toLowerCase().includes(filterObservaciones.toLowerCase()));

    const matchesFecha = !filterFecha ||
      (training.fecha && training.fecha.split('T')[0] === filterFecha);

    return matchesEmpresa && matchesCliente && matchesSucursal &&
      matchesEmpleado && matchesPuesto && matchesResponsable &&
      matchesDescripcion && matchesResultado && matchesObservaciones && matchesFecha;
  });

  const validateForm = (): boolean => {
    if (
      !formEmpresaId ||
      !formClienteId ||
      !formDivisionId ||
      !formContratoId ||
      !formCorpoId
    ) {
      Alert.alert('Error', 'Debes completar la jerarquía Empresa → Sucursal');
      return false;
    }
    if (selectedPuestos.length === 0) {
      Alert.alert('Error', 'Debes seleccionar al menos un puesto');
      return false;
    }
    if (!tituloRef.current.trim()) {
      Alert.alert('Error', 'El título de la capacitación es requerido');
      return false;
    }

    if (!descripcionRef.current.trim()) {
      Alert.alert('Error', 'La descripción de la capacitación es requerida');
      return false;
    }

    if (!fechaCapacitacion) {
      Alert.alert('Error', 'La fecha de la capacitación es requerida');
      return false;
    }

    if (!nombreResponsableRef.current.trim()) {
      Alert.alert('Error', 'El nombre del responsable es requerido');
      return false;
    }

    if (!cedulaResponsableRef.current.trim()) {
      Alert.alert('Error', 'La cédula del responsable es requerida');
      return false;
    }

    if (!firmaResponsable) {
      Alert.alert('Error', 'Debes generar o escanear la firma del responsable');
      return false;
    }

    return true;
  };

  const submitCreateTraining = async () => {
    if (!validateForm() || !firmaResponsable || !marcaId) return;
    setIsCreateSubmitting(true);
    try {
      const signatureHash = btoa(
        firmaResponsable.sessionId +
          ':' +
          firmaResponsable.empleadoId +
          ':' +
          firmaResponsable.latitud +
          ':' +
          firmaResponsable.longitud +
          ':' +
          firmaResponsable.timestamp
      );

      let imageBase64 = null;
      if (trainingImageBase64) {
        const base64Regex = /^data:(.+);base64,(.+)$/;
        if (base64Regex.test(trainingImageBase64)) {
          imageBase64 = trainingImageBase64;
        } else if (trainingImageBase64.startsWith('data:image')) {
          imageBase64 = trainingImageBase64;
        } else {
          imageBase64 = `data:image/jpeg;base64,${trainingImageBase64}`;
        }
      }

      const requestData = {
        marca_id: marcaId,
        empresa_id: formEmpresaId,
        cliente_id: formClienteId,
        corpo_id: formCorpoId,
        titulo: tituloRef.current,
        descripcion: descripcionRef.current,
        tipo: selectedTipo,
        resultado: selectedResultado || null,
        observaciones: observacionesRef.current.trim() !== '' ? observacionesRef.current.trim() : '-',
        nombre_responsable: nombreResponsableRef.current,
        cedula_responsable: cedulaResponsableRef.current,
        firma_responsable: signatureHash,
        file: imageBase64,
        fecha: fechaCapacitacion,
        empleados: selectedEmpleados.map((e) => e.id),
        puestos: selectedPuestos.map((p) => p.id),
      };

      const hasConnection = await checkConnection();

      if (hasConnection) {
        const result = await createTrainingAPI({
          requestData,
          marcaId,
          refreshAccessToken,
          logout,
        });

        if (result.status) {
          Alert.alert('Éxito', 'Capacitación creada correctamente');
          setIsCreating(false);
          resetForm();
          void fetchTrainingsForCorpoRef.current?.();
        } else {
          Alert.alert('Error', result.message || 'No se pudo crear la capacitación');
        }
      } else {
        const localId = Math.random().toString(36).substring(2, 12);
        const actionsStr = await AsyncStorage.getItem('trainings_actions');
        let actions: any[] = actionsStr ? JSON.parse(actionsStr) : [];
        if (!Array.isArray(actions)) actions = [];
        actions = actions.filter(
          (a: any) => !(a?.type === 'create' && String(a?.id) === String(localId))
        );
        actions.push({
          requestData,
          marcaId,
          id: localId,
          type: 'create',
        });
        await AsyncStorage.setItem('trainings_actions', JSON.stringify(actions));

        const cacheStr = await AsyncStorage.getItem('trainings_cache');
        const cache = cacheStr ? JSON.parse(cacheStr) : [];

        const empNode = formEmpresasList.find((e) => e.id === formEmpresaId);
        const cliNode = formClientesList.find((c) => c.id === formClienteId);
        const sucNode = formSucursalesList.find((s) => s.id === formCorpoId);

        const newTraining: Training = {
          id: 0,
          empresa: { id: formEmpresaId!, nombre: empNode?.nombre || '-' },
          cliente: { id: formClienteId!, nombre: cliNode?.nombre || '-' },
          sucursal: { id: formCorpoId!, nombre: sucNode?.nombre || '-' },
          titulo: tituloRef.current,
          descripcion: descripcionRef.current,
          tipo: selectedTipo,
          resultado: selectedResultado || null,
          observaciones: observacionesRef.current.trim() !== '' ? observacionesRef.current.trim() : '-',
          responsable: {
            nombre: nombreResponsableRef.current,
            cedula: cedulaResponsableRef.current,
          },
          fecha: fechaCapacitacion,
          firma_responsable: signatureHash,
          nombre_firma: firmaResponsable?.empleadoDetalle
            ? `${firmaResponsable.empleadoDetalle.nombre} ${firmaResponsable.empleadoDetalle.primer_apellido} ${firmaResponsable.empleadoDetalle.segundo_apellido}`
            : '-',
          base64_file: imageBase64 || '',
          empleados: selectedEmpleados.map((e) => ({ id: e.id, nombre: e.nombre, cedula: e.cedula })),
          puestos: selectedPuestos.map((p) => ({ id: p.id, nombre: p.nombre })),
          corpo_id: formCorpoId!,
          id_local: localId,
        };

        cache.push(newTraining);
        await AsyncStorage.setItem('trainings_cache', JSON.stringify(cache));
        Alert.alert('Modo Offline', 'Capacitación registrada localmente. Se sincronizará cuando haya conexión.');
        setIsCreating(false);
        resetForm();
        const corpo = formCorpoId;
        if (corpo != null && filterCorpoId === corpo) {
          setTrainings((prev) => [...prev, newTraining]);
        }
      }
    } catch (error) {
      console.error('Error creating training:', error);
      Alert.alert('Error', 'No se pudo crear la capacitación');
    } finally {
      setIsCreateSubmitting(false);
    }
  };

  const createTraining = () => {
    if (isCreateSubmitting) return;
    if (!validateForm()) return;
    if (!marcaId) {
      Alert.alert('Error', 'No se encontró la marca actual');
      return;
    }
    Alert.alert('Confirmar', '¿Estás seguro de que deseas crear esta capacitación?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Aceptar', onPress: () => void submitCreateTraining() },
    ]);
  };

  const confirmDeleteTraining = (training: Training, trainingKey: string) => {
    if (training.id === 0 && training.id_local) {
      Alert.alert('Eliminar', '¿Eliminar esta capacitación pendiente de sincronización?', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setDeletingTrainingKey(trainingKey);
            try {
              const actionsStr = await AsyncStorage.getItem('trainings_actions');
              const actions = actionsStr ? JSON.parse(actionsStr) : [];
              const list = Array.isArray(actions) ? actions : [];
              const next = list.filter(
                (a: any) =>
                  !(a?.type === 'create' && String(a?.id) === String(training.id_local))
              );
              await AsyncStorage.setItem('trainings_actions', JSON.stringify(next));
              const cacheStr = await AsyncStorage.getItem('trainings_cache');
              const cache = cacheStr ? JSON.parse(cacheStr) : [];
              const nextCache = cache.filter(
                (t: Training) => t.id_local !== training.id_local
              );
              await AsyncStorage.setItem('trainings_cache', JSON.stringify(nextCache));
              setTrainings((prev) => prev.filter((t) => t.id_local !== training.id_local));
              Alert.alert('Éxito', 'Capacitación eliminada correctamente.');
            } finally {
              setDeletingTrainingKey(null);
            }
          },
        },
      ]);
      return;
    }
    Alert.alert('Eliminar', '¿Eliminar esta capacitación? Esta acción no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          setDeletingTrainingKey(trainingKey);
          try {
            const hasConnection = await checkConnection();
            if (!hasConnection) {
              if (marcaId == null) {
                Alert.alert('Error', 'No se encontró la marca actual');
                return;
              }
              const actionId = Math.random().toString(36).substring(2, 12);
              const actionsStr = await AsyncStorage.getItem('trainings_actions');
              let actions: any[] = actionsStr ? JSON.parse(actionsStr) : [];
              if (!Array.isArray(actions)) actions = [];
              actions = appendOfflineTrainingDelete(actions, {
                queueId: actionId,
                trainingId: training.id,
                marcaId,
              });
              await AsyncStorage.setItem('trainings_actions', JSON.stringify(actions));
              const cacheStr = await AsyncStorage.getItem('trainings_cache');
              const cache = cacheStr ? JSON.parse(cacheStr) : [];
              const nextCache = cache.filter((t: Training) => t.id !== training.id);
              await AsyncStorage.setItem('trainings_cache', JSON.stringify(nextCache));
              setTrainings((prev) => prev.filter((t) => t.id !== training.id));
              Alert.alert(
                'Éxito',
                'Eliminación registrada. Se sincronizará con el servidor cuando haya conexión.'
              );
              return;
            }
            const result = await deleteTrainingAPI({
              trainingId: training.id,
              refreshAccessToken,
              logout,
            });
            if (result.status) {
              setTrainings((prev) => prev.filter((t) => t.id !== training.id));
              const cacheStr = await AsyncStorage.getItem('trainings_cache');
              if (cacheStr) {
                const cache = JSON.parse(cacheStr) as Training[];
                const nextCache = cache.filter((t) => t.id !== training.id);
                await AsyncStorage.setItem('trainings_cache', JSON.stringify(nextCache));
              }
              Alert.alert('Éxito', 'Capacitación eliminada correctamente.');
              void fetchTrainingsForCorpoRef.current?.();
            } else {
              Alert.alert('Error', (result as { message?: string }).message || 'No se pudo eliminar');
            }
          } finally {
            setDeletingTrainingKey(null);
          }
        },
      },
    ]);
  };

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'trainings': return <Ionicons name="school" size={25} color='#000000' />;
      case 'add': return <Ionicons name="add" size={24} color='#000000' />;
      case 'cancel': return <Ionicons name="close" size={24} color='#FFFFFF' />;
      case 'confirm': return <Ionicons name="checkmark" size={24} color='#FFFFFF' />;
      case 'signature': return <Ionicons name="finger-print" size={20} color='#000000' />;
      case 'qr': return <Ionicons name="qr-code" size={20} color='#000000' />;
      case 'clear': return <Ionicons name="trash" size={20} color='#000000' />;
      default: return <Ionicons name="school" size={25} color='#000000' />;
    }
  };

  const handleMenuPress = () => {
    setIsMenuVisible(true);
  };

  const handleMenuClose = () => {
    setIsMenuVisible(false);
  };

  const handleHomePress = () => {
    navigation.navigate('Home');
    setIsMenuVisible(false);
  };

  if (isBootstrapping) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader onMenuPress={handleMenuPress} title="Registro de Capacitaciones" />
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Cargando...</ThemedText>
        </ThemedView>
        <AppFooter />
        <SlideMenu
          isVisible={isMenuVisible}
          onClose={handleMenuClose}
          onHomePress={handleHomePress}
        />
      </ThemedView>
    );
  }

  if (!hasMarca) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader onMenuPress={handleMenuPress} title="Registro de Capacitaciones" />
        <ThemedView style={styles.loadingContainer}>
          <ThemedText style={styles.errorText}>No hay una marca registrada</ThemedText>
        </ThemedView>
        <AppFooter />
        <SlideMenu
          isVisible={isMenuVisible}
          onClose={handleMenuClose}
          onHomePress={handleHomePress}
        />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <AppHeader onMenuPress={handleMenuPress} title="Registro de Capacitaciones" />
      {!!error && (
        <ThemedView style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={18} color="#B00020" />
          <ThemedText style={styles.errorBannerText}>{error}</ThemedText>
        </ThemedView>
      )}
      {!!offlineMessage && !error && (
        <ThemedView style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={18} color="#8A6D00" />
          <ThemedText style={styles.offlineBannerText}>{offlineMessage}</ThemedText>
        </ThemedView>
      )}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Module Title */}
        <ThemedView style={styles.titleContainer}>
          <ThemedText type="title" style={styles.title}>
            {getActionIcon('trainings')} Capacitaciones
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            Gestiona el registro de capacitaciones
          </ThemedText>
        </ThemedView>

        {/* Filters */}
        {!isCreating && (
          <ThemedView style={styles.filtersContainer}>
            <ThemedView style={styles.filtersHeader}>
              <TouchableOpacity
                style={styles.filterToggleButton}
                onPress={() => setIsFiltersExpanded(!isFiltersExpanded)}
              >
                <ThemedText style={styles.filtersTitle}>
                  Filtros
                </ThemedText>
                <Ionicons
                  name={isFiltersExpanded ? "chevron-up" : "chevron-down"}
                  size={20}
                  color="#007AFF"
                />
              </TouchableOpacity>

              {isFiltersExpanded && (
                <TouchableOpacity
                  style={styles.resetFiltersButton}
                  onPress={resetAllFilters}
                >
                  <Ionicons name="refresh" size={16} color="#FF3B30" />
                  <ThemedText style={styles.resetFiltersText}>Reiniciar</ThemedText>
                </TouchableOpacity>
              )}
            </ThemedView>

            {/* Filter Content */}
            {isFiltersExpanded && (
              <ThemedView style={styles.filtersContent}>
                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.filterLabel}>Empresa:</ThemedText>
                  <ThemedView style={styles.pickerContainer}>
                    <Picker
                      selectedValue={filterEmpresaId ?? undefined}
                      onValueChange={(value) => {
                        const n = normPicker(value);
                        setFilterEmpresaId(n);
                        setFilterClienteId(null);
                        setFilterDivisionId(null);
                        setFilterContratoId(null);
                        setFilterCorpoId(null);
                      }}
                      style={styles.picker}
                    >
                      <Picker.Item label="Todas..." value={undefined} color="#000000" />
                      {filterStructureRoots.map((e) => (
                        <Picker.Item key={e.id} label={e.nombre} value={e.id} color="#000000" />
                      ))}
                    </Picker>
                  </ThemedView>
                </ThemedView>

                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.filterLabel}>Cliente:</ThemedText>
                  <ThemedView style={styles.pickerContainer}>
                    <Picker
                      selectedValue={filterClienteId ?? undefined}
                      onValueChange={(value) => {
                        const n = normPicker(value);
                        setFilterClienteId(n);
                        setFilterDivisionId(null);
                        setFilterContratoId(null);
                        setFilterCorpoId(null);
                      }}
                      enabled={!!filterEmpresaId}
                      style={styles.picker}
                    >
                      <Picker.Item label="Todos..." value={undefined} color="#000000" />
                      {filterClientes.map((c) => (
                        <Picker.Item key={c.id} label={c.nombre} value={c.id} color="#000000" />
                      ))}
                    </Picker>
                  </ThemedView>
                </ThemedView>

                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.filterLabel}>División:</ThemedText>
                  <ThemedView style={styles.pickerContainer}>
                    <Picker
                      selectedValue={filterDivisionId ?? undefined}
                      onValueChange={(value) => {
                        const n = normPicker(value);
                        setFilterDivisionId(n);
                        setFilterContratoId(null);
                        setFilterCorpoId(null);
                      }}
                      enabled={!!filterClienteId}
                      style={styles.picker}
                    >
                      <Picker.Item label="Todas..." value={undefined} color="#000000" />
                      {filterDivisiones.map((d) => (
                        <Picker.Item key={d.id} label={d.nombre} value={d.id} color="#000000" />
                      ))}
                    </Picker>
                  </ThemedView>
                </ThemedView>

                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.filterLabel}>Contrato:</ThemedText>
                  <ThemedView style={styles.pickerContainer}>
                    <Picker
                      selectedValue={filterContratoId ?? undefined}
                      onValueChange={(value) => {
                        const n = normPicker(value);
                        setFilterContratoId(n);
                        setFilterCorpoId(null);
                      }}
                      enabled={!!filterDivisionId}
                      style={styles.picker}
                    >
                      <Picker.Item label="Todos..." value={undefined} color="#000000" />
                      {filterContratos.map((c) => (
                        <Picker.Item key={c.id} label={c.nombre} value={c.id} color="#000000" />
                      ))}
                    </Picker>
                  </ThemedView>
                </ThemedView>

                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.filterLabel}>Sucursal:</ThemedText>
                  <ThemedView style={styles.pickerContainer}>
                    <Picker
                      selectedValue={filterCorpoId ?? undefined}
                      onValueChange={(value) => {
                        const n = normPicker(value);
                        setFilterCorpoId(n);
                      }}
                      enabled={!!filterContratoId}
                      style={styles.picker}
                    >
                      <Picker.Item label="Seleccionar sucursal..." value={undefined} color="#000000" />
                      {filterSucursales.map((s) => (
                        <Picker.Item key={s.id} label={s.nombre} value={s.id} color="#000000" />
                      ))}
                    </Picker>
                  </ThemedView>
                </ThemedView>

                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.filterLabel}>Empleado:</ThemedText>
                  <TextInput
                    style={styles.searchInput}
                    value={filterEmpleado}
                    onChangeText={setFilterEmpleado}
                    placeholder="Filtrar por empleado..."
                    placeholderTextColor="#999"
                  />
                </ThemedView>

                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.filterLabel}>Puesto:</ThemedText>
                  <TextInput
                    style={styles.searchInput}
                    value={filterPuestoNombre}
                    onChangeText={setFilterPuestoNombre}
                    placeholder="Filtrar por nombre de puesto..."
                    placeholderTextColor="#999"
                  />
                </ThemedView>

                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.filterLabel}>Responsable:</ThemedText>
                  <TextInput
                    style={styles.searchInput}
                    value={filterResponsable}
                    onChangeText={setFilterResponsable}
                    placeholder="Filtrar por responsable..."
                    placeholderTextColor="#999"
                  />
                </ThemedView>

                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.filterLabel}>Descripción:</ThemedText>
                  <TextInput
                    style={styles.searchInput}
                    value={filterDescripcion}
                    onChangeText={setFilterDescripcion}
                    placeholder="Filtrar por descripción..."
                    placeholderTextColor="#999"
                  />
                </ThemedView>

                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.filterLabel}>Resultado:</ThemedText>
                  <TextInput
                    style={styles.searchInput}
                    value={filterResultado}
                    onChangeText={setFilterResultado}
                    placeholder="Filtrar por resultado..."
                    placeholderTextColor="#999"
                  />
                </ThemedView>

                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.filterLabel}>Observaciones:</ThemedText>
                  <TextInput
                    style={styles.searchInput}
                    value={filterObservaciones}
                    onChangeText={setFilterObservaciones}
                    placeholder="Filtrar por observaciones..."
                    placeholderTextColor="#999"
                  />
                </ThemedView>

                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.filterLabel}>Fecha:</ThemedText>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowFilterFechaPicker(true)}
                  >
                    <ThemedText style={styles.dateButtonText}>
                      {filterFecha ? formatDateForDisplay(filterFecha) : 'Seleccionar fecha'}
                    </ThemedText>
                    <Ionicons name="calendar-outline" size={20} color="#007AFF" />
                  </TouchableOpacity>
                  {filterFecha && (
                    <TouchableOpacity
                      style={styles.clearDateButton}
                      onPress={() => setFilterFecha('')}
                    >
                      <Ionicons name="close-circle" size={20} color="#FF3B30" />
                      <ThemedText style={styles.clearDateText}>Limpiar fecha</ThemedText>
                    </TouchableOpacity>
                  )}
                </ThemedView>
              </ThemedView>
            )}
          </ThemedView>
        )}

        {/* Create Button */}
        {!isCreating && !error && (
          <TouchableOpacity
            style={styles.createButton}
            onPress={startCreating}
          >
            <ThemedText style={styles.createButtonText}>
              {getActionIcon('add')}
            </ThemedText>
          </TouchableOpacity>
        )}

        {/* Create Form */}
        {isCreating && (
          <ThemedView style={styles.formCard}>
            <ThemedText style={styles.formTitle}>Nueva Capacitación</ThemedText>

            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Empresa *:</ThemedText>
              <ThemedView style={styles.pickerContainer}>
                <Picker
                  selectedValue={formEmpresaId ?? undefined}
                  onValueChange={(v) => {
                    if (isRestoringFormHierarchyRef.current) return;
                    setFormEmpresaId(normPicker(v));
                  }}
                  style={styles.picker}
                >
                  <Picker.Item label="Seleccionar empresa..." value={undefined} color="#000000" />
                  {formEmpresasList.map((e) => (
                    <Picker.Item key={e.id} label={e.nombre} value={e.id} color="#000000" />
                  ))}
                </Picker>
              </ThemedView>
            </ThemedView>
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Cliente *:</ThemedText>
              <ThemedView style={styles.pickerContainer}>
                <Picker
                  selectedValue={formClienteId ?? undefined}
                  onValueChange={(v) => {
                    if (isRestoringFormHierarchyRef.current) return;
                    setFormClienteId(normPicker(v));
                  }}
                  enabled={!!formEmpresaId}
                  style={styles.picker}
                >
                  <Picker.Item label="Seleccionar cliente..." value={undefined} color="#000000" />
                  {formClientesList.map((c) => (
                    <Picker.Item key={c.id} label={c.nombre} value={c.id} color="#000000" />
                  ))}
                </Picker>
              </ThemedView>
            </ThemedView>
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>División *:</ThemedText>
              <ThemedView style={styles.pickerContainer}>
                <Picker
                  selectedValue={formDivisionId ?? undefined}
                  onValueChange={(v) => {
                    if (isRestoringFormHierarchyRef.current) return;
                    setFormDivisionId(normPicker(v));
                  }}
                  enabled={!!formClienteId}
                  style={styles.picker}
                >
                  <Picker.Item label="Seleccionar división..." value={undefined} color="#000000" />
                  {formDivisionesList.map((d) => (
                    <Picker.Item key={d.id} label={d.nombre} value={d.id} color="#000000" />
                  ))}
                </Picker>
              </ThemedView>
            </ThemedView>
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Contrato *:</ThemedText>
              <ThemedView style={styles.pickerContainer}>
                <Picker
                  selectedValue={formContratoId ?? undefined}
                  onValueChange={(v) => {
                    if (isRestoringFormHierarchyRef.current) return;
                    setFormContratoId(normPicker(v));
                  }}
                  enabled={!!formDivisionId}
                  style={styles.picker}
                >
                  <Picker.Item label="Seleccionar contrato..." value={undefined} color="#000000" />
                  {formContratosList.map((c) => (
                    <Picker.Item key={c.id} label={c.nombre} value={c.id} color="#000000" />
                  ))}
                </Picker>
              </ThemedView>
            </ThemedView>
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Sucursal *:</ThemedText>
              <ThemedView style={styles.pickerContainer}>
                <Picker
                  selectedValue={formCorpoId ?? undefined}
                  onValueChange={(v) => {
                    if (isRestoringFormHierarchyRef.current) return;
                    setFormCorpoId(normPicker(v));
                  }}
                  enabled={!!formContratoId}
                  style={styles.picker}
                >
                  <Picker.Item label="Seleccionar sucursal..." value={undefined} color="#000000" />
                  {formSucursalesList.map((s) => (
                    <Picker.Item key={s.id} label={s.nombre} value={s.id} color="#000000" />
                  ))}
                </Picker>
              </ThemedView>
            </ThemedView>

            {/* Título */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Título de la capacitación *:</ThemedText>
              <TextInput
                style={styles.formInput}
                defaultValue={tituloRef.current}
                onChangeText={(text) => { tituloRef.current = text; }}
                placeholder="Título"
                placeholderTextColor="#999"
                key={`titulo-${formKey}`}
              />
            </ThemedView>

            {/* Descripción */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Descripción de la capacitación *:</ThemedText>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                defaultValue={descripcionRef.current}
                onChangeText={(text) => { descripcionRef.current = text; }}
                placeholder="Descripción"
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
                key={`descripcion-${formKey}`}
              />
            </ThemedView>

            {/* Tipo de capacitación */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Tipo de capacitación *:</ThemedText>
              <ThemedView style={styles.radioGroup}>
                {['Prescencial', 'Virtual'].map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={styles.radioOption}
                    onPress={() => setSelectedTipo(option as 'Prescencial' | 'Virtual')}
                  >
                    <ThemedView style={[
                      styles.radioCircle,
                      selectedTipo === option && styles.radioCircleSelected
                    ]}>
                      {selectedTipo === option && <ThemedView style={styles.radioInner} />}
                    </ThemedView>
                    <ThemedText style={styles.radioLabel}>{option}</ThemedText>
                  </TouchableOpacity>
                ))}
              </ThemedView>
            </ThemedView>

            {/* Empleados en la capacitación */}
            <ThemedView style={[styles.formGroup]}>
              <ThemedText style={styles.formLabel}>Empleados en la capacitación:</ThemedText>
              <ThemedView style={[styles.inlineInputsRow, { marginBottom: 16 }]}>
                <TextInput
                  style={[styles.formInput, { flex: 1 }]}
                  value={codigoEmpleadoBusqueda}
                  onChangeText={setCodigoEmpleadoBusqueda}
                  placeholder="Código de empleado"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                />
                <TouchableOpacity
                  style={[styles.primaryButton, { marginLeft: 8 }]}
                  onPress={async () => {
                    const code = String(codigoEmpleadoBusqueda || '').trim();
                    if (!code) {
                      Alert.alert('Error', 'Debes ingresar un código');
                      return;
                    }
                    try {
                      const empleadoData = await getEmpleadoByCodigo(code);
                      const empleadoId = Number(empleadoData?.id || 0);
                      const nombreEmpleado = String(empleadoData?.nombre || '').trim();
                      const cedulaEmpleado = String(empleadoData?.cedula || '').trim();
                      if (!empleadoId || !nombreEmpleado) {
                        throw new Error('Empleado inválido');
                      }
                      // Evitar duplicados
                      if (!empleados.find(e => e.id === empleadoId)) {
                        const nuevoEmpleado: Empleado = {
                          id: empleadoId,
                          nombre: nombreEmpleado,
                          cedula: cedulaEmpleado,
                          fecha_contratacion: String(empleadoData?.fecha_contratacion || ''),
                        };
                        setEmpleados(prev => [...prev, nuevoEmpleado]);
                      }
                      if (!selectedEmpleados.find(e => e.id === empleadoId)) {
                        const empleadoSeleccionado: Empleado = {
                          id: empleadoId,
                          nombre: nombreEmpleado,
                          cedula: cedulaEmpleado,
                          fecha_contratacion: String(empleadoData?.fecha_contratacion || ''),
                        };
                        setSelectedEmpleados(prev => [...prev, empleadoSeleccionado]);
                      }
                      setCodigoEmpleadoBusqueda('');
                    } catch (e: any) {
                      Alert.alert('Error', e?.message || 'No se pudo buscar el empleado por código');
                    }
                  }}
                >
                  <ThemedText style={styles.primaryButtonText}>Buscar</ThemedText>
                </TouchableOpacity>
              </ThemedView>
              <ThemedView style={styles.pickerContainer}>
                <Picker
                  selectedValue={undefined}
                  onValueChange={(value) => {
                    if (value && !selectedEmpleados.find(e => e.id === value)) {
                      const empleado = empleados.find(e => e.id === value);
                      if (empleado) {
                        setSelectedEmpleados([...selectedEmpleados, empleado]);
                      }
                    }
                  }}
                  style={styles.picker}
                >
                  <Picker.Item label="Seleccionar empleado..." value={undefined} color="#000000" />
                  {empleados
                    .filter(e => !selectedEmpleados.find(se => se.id === e.id))
                    .map((empleado) => (
                      <Picker.Item
                        key={empleado.id}
                        label={`${empleado.nombre} - ${empleado.cedula}`}
                        value={empleado.id}
                        color="#000000"
                      />
                    ))}
                </Picker>
              </ThemedView>
              {selectedEmpleados.length > 0 && (
                <ThemedView style={styles.selectedList}>
                  {selectedEmpleados.map((empleado) => (
                    <ThemedView key={empleado.id} style={styles.selectedItem}>
                      <ThemedText style={styles.selectedItemText}>
                        {empleado.nombre} - {empleado.cedula}
                      </ThemedText>
                      <TouchableOpacity onPress={() => removeEmpleado(empleado.id)}>
                        <Ionicons name="close-circle" size={24} color="#FF3B30" />
                      </TouchableOpacity>
                    </ThemedView>
                  ))}
                </ThemedView>
              )}
            </ThemedView>

            {/* Puestos en la capacitación */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Puestos en la capacitación:</ThemedText>
              <ThemedView style={styles.pickerContainer}>
                <Picker
                  selectedValue={undefined}
                  onValueChange={(value) => {
                    if (value && !selectedPuestos.find((p) => p.id === value)) {
                      const puesto = puestosForFormPicker.find((p) => p.id === value);
                      if (puesto) {
                        setSelectedPuestos([...selectedPuestos, puesto]);
                      }
                    }
                  }}
                  style={styles.picker}
                >
                  <Picker.Item label="Seleccionar puesto..." value={undefined} color="#000000" />
                  {puestosForFormPicker
                    .filter((p) => !selectedPuestos.find((sp) => sp.id === p.id))
                    .map((puesto) => (
                      <Picker.Item
                        key={puesto.id}
                        label={puesto.nombre}
                        value={puesto.id}
                        color="#000000"
                      />
                    ))}
                </Picker>
              </ThemedView>
              {selectedPuestos.length > 0 && (
                <ThemedView style={styles.selectedList}>
                  {selectedPuestos.map((puesto) => (
                    <ThemedView key={puesto.id} style={styles.selectedItem}>
                      <ThemedText style={styles.selectedItemText}>{puesto.nombre}</ThemedText>
                      <TouchableOpacity onPress={() => removePuesto(puesto.id)}>
                        <Ionicons name="close-circle" size={24} color="#FF3B30" />
                      </TouchableOpacity>
                    </ThemedView>
                  ))}
                </ThemedView>
              )}
            </ThemedView>

            {/* Fecha */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Fecha de la capacitación *:</ThemedText>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowFechaCapacitacionPicker(true)}
              >
                <ThemedText style={styles.dateButtonText}>
                  {formatDateForDisplay(fechaCapacitacion)}
                </ThemedText>
                <Ionicons name="calendar-outline" size={20} color="#007AFF" />
              </TouchableOpacity>
            </ThemedView>

            {/* Resultado */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Resultado (opcional):</ThemedText>
              <ThemedView style={styles.radioGroup}>
                {['Bueno', 'Regular', 'Malo'].map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={styles.radioOption}
                    onPress={() => setSelectedResultado(selectedResultado === option ? '' : option)}
                  >
                    <ThemedView style={[
                      styles.radioCircle,
                      selectedResultado === option && styles.radioCircleSelected
                    ]}>
                      {selectedResultado === option && <ThemedView style={styles.radioInner} />}
                    </ThemedView>
                    <ThemedText style={styles.radioLabel}>{option}</ThemedText>
                  </TouchableOpacity>
                ))}
              </ThemedView>
            </ThemedView>

            {/* Adjuntar imagen */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Adjuntar imagen (opcional):</ThemedText>
              <TouchableOpacity
                style={styles.cameraButton}
                onPress={openCamera}
              >
                <Ionicons name="camera" size={20} color="#000000" />
                <ThemedText style={styles.cameraButtonText}>Tomar foto</ThemedText>
              </TouchableOpacity>
              {trainingImageBase64 && (
                <ThemedView style={styles.previewContainer}>
                  <ThemedText style={styles.previewTitle}>Imagen capturada:</ThemedText>
                  <Image
                    source={{ uri: trainingImageBase64 }}
                    style={styles.imagePreview}
                    resizeMode="contain"
                  />
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() => setTrainingImageBase64(null)}
                  >
                    <Ionicons name="trash" size={20} color="#000000" />
                    <ThemedText style={styles.removeImageText}>Eliminar imagen</ThemedText>
                  </TouchableOpacity>
                </ThemedView>
              )}
            </ThemedView>

            {/* Observaciones */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Observaciones:</ThemedText>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                defaultValue={observacionesRef.current}
                onChangeText={(text) => { observacionesRef.current = text; }}
                placeholder="Observaciones"
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
                key={`observaciones-${formKey}`}
              />
            </ThemedView>

            {/* Nombre Responsable */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Nombre del responsable de la capacitación:</ThemedText>
              <TextInput
                style={styles.formInput}
                defaultValue={nombreResponsableRef.current}
                onChangeText={(text) => { nombreResponsableRef.current = text; }}
                placeholder="Nombre del responsable"
                placeholderTextColor="#999"
                key={`nombre-responsable-${formKey}`}
              />
            </ThemedView>

            {/* Cédula Responsable */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Cédula del responsable de la capacitación:</ThemedText>
              <TextInput
                style={styles.formInput}
                defaultValue={cedulaResponsableRef.current}
                onChangeText={(text) => { cedulaResponsableRef.current = text; }}
                placeholder="Cédula del responsable"
                placeholderTextColor="#999"
                key={`cedula-responsable-${formKey}`}
              />
            </ThemedView>

            {/* Firma Responsable */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Firma del responsable *:</ThemedText>
              {!firmaResponsable ? (
                <ThemedView style={styles.signatureButtons}>
                  <TouchableOpacity
                    style={styles.signatureButton}
                    onPress={generateSignature}
                    disabled={isGeneratingFirma}
                  >
                    {isGeneratingFirma ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        {getActionIcon('signature')}
                        <ThemedText style={styles.signatureButtonText}>Generar</ThemedText>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.signatureButton}
                    onPress={handleScanQR}
                  >
                    {getActionIcon('qr')}
                    <ThemedText style={styles.signatureButtonText}>Escanear QR</ThemedText>
                  </TouchableOpacity>
                </ThemedView>
              ) : (
                <ThemedView style={styles.signatureInfo}>
                  <ThemedText style={styles.signatureInfoTitle}>Información de la firma:</ThemedText>
                  <ThemedText style={styles.signatureInfoText}>ID de sesión: {firmaResponsable.sessionId}</ThemedText>
                  <ThemedText style={styles.signatureInfoText}>ID del empleado: {firmaResponsable.empleadoId}</ThemedText>
                  {firmaResponsable.empleadoDetalle && (
                    <ThemedView style={styles.signatureInfoDetail}>
                      <ThemedText style={styles.signatureInfoDetailText}>
                        {firmaResponsable.empleadoDetalle.nombre} {firmaResponsable.empleadoDetalle.primer_apellido} {firmaResponsable.empleadoDetalle.segundo_apellido} ({firmaResponsable.empleadoDetalle.cedula_empleado})
                      </ThemedText>
                    </ThemedView>
                  )}
                  <ThemedText style={styles.signatureInfoText}>Latitud: {firmaResponsable.latitud}</ThemedText>
                  <ThemedText style={styles.signatureInfoText}>Longitud: {firmaResponsable.longitud}</ThemedText>
                  <ThemedText style={styles.signatureInfoText}>Hora actual: {generateDateTime(firmaResponsable.timestamp)}</ThemedText>
                  <TouchableOpacity
                    style={styles.clearSignatureButton}
                    onPress={() => setFirmaResponsable(null)}
                  >
                    <ThemedText style={styles.clearSignatureText}>{getActionIcon('clear')}</ThemedText>
                  </TouchableOpacity>
                </ThemedView>
              )}
            </ThemedView>

            {/* Form Actions */}
            <ThemedView style={styles.formActions}>
              <TouchableOpacity
                style={[styles.formButton, styles.cancelButton]}
                onPress={cancelCreating}
                disabled={isCreateSubmitting}
              >
                <ThemedText style={styles.formButtonText}>
                  {getActionIcon('cancel')}
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.formButton,
                  styles.confirmButton,
                  isCreateSubmitting && { opacity: 0.6 },
                ]}
                onPress={createTraining}
                disabled={isCreateSubmitting}
              >
                {isCreateSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <ThemedText style={styles.formButtonText}>
                    {getActionIcon('confirm')}
                  </ThemedText>
                )}
              </TouchableOpacity>
            </ThemedView>
          </ThemedView>
        )}

        {/* Trainings List */}
        {!isCreating && (
          <ThemedView style={styles.listContainer}>
            {isListLoading ? (
              <ThemedView style={styles.listLoadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <ThemedText style={styles.loadingText}>Cargando capacitaciones...</ThemedText>
              </ThemedView>
            ) : filteredTrainings.length === 0 ? (
              <ThemedText style={styles.emptyText}>
                {trainings.length === 0
                  ? 'No hay capacitaciones registradas'
                  : 'No hay capacitaciones que coincidan con los filtros'}
              </ThemedText>
            ) : (
              filteredTrainings.map((training, index) => {
                // Get decoded firma from Map
                const firmaData = decodedFirmas.get(training.id);

                // Crear una clave única para identificar el training
                const trainingKey = training.id !== 0 ? `training-${training.id}` : (training.id_local ? `training-${training.id_local}` : `training-${index}`);
                const isExpanded = expandedTrainings.has(trainingKey);

                return (
                  <ThemedView key={training.id !== 0 ? training.id : training.id_local || `training-${index}`} style={styles.trainingCard}>
                    {/* Datos visibles por defecto */}
                    <ThemedText style={styles.trainingDetail}>
                      <ThemedText style={styles.trainingLabel}>Título: </ThemedText>
                      <ThemedText style={styles.trainingValue}>{training.titulo}</ThemedText>
                    </ThemedText>
                    <ThemedText style={styles.trainingDetail}>
                      <ThemedText style={styles.trainingLabel}>Fecha: </ThemedText>
                      <ThemedText style={styles.trainingValue}>{formatDateDMY(training.fecha)}</ThemedText>
                    </ThemedText>

                    <ThemedText style={styles.trainingDetail}>
                      <ThemedText style={styles.trainingLabel}>Tipo: </ThemedText>
                      <ThemedText style={styles.trainingValue}>{training.tipo}</ThemedText>
                    </ThemedText>
                    {training.resultado && (
                      <ThemedText style={styles.trainingDetail}>
                        <ThemedText style={styles.trainingLabel}>Resultado: </ThemedText>
                        <ThemedText style={styles.trainingValue}>{training.resultado}</ThemedText>
                      </ThemedText>
                    )}

                    {/* Collapsable Button */}
                    <TouchableOpacity
                      style={styles.collapseButton}
                      onPress={() => toggleTrainingExpanded(trainingKey)}
                    >
                      <ThemedText style={styles.collapseButtonText}>
                        {isExpanded ? 'Ocultar detalles' : 'Ver detalles'}
                      </ThemedText>
                      <Ionicons
                        name={isExpanded ? "chevron-up" : "chevron-down"}
                        size={20}
                        color="#007AFF"
                      />
                    </TouchableOpacity>

                    {/* Collapsable Content */}
                    {isExpanded && (
                      <ThemedView style={styles.collapsableContent}>
                        <ThemedText style={styles.trainingDetail}>
                          <ThemedText style={styles.trainingLabel}>Empresa: </ThemedText>
                          <ThemedText style={styles.trainingValue}>{training.empresa.nombre}</ThemedText>
                        </ThemedText>
                        <ThemedText style={styles.trainingDetail}>
                          <ThemedText style={styles.trainingLabel}>Cliente: </ThemedText>
                          <ThemedText style={styles.trainingValue}>{training.cliente.nombre}</ThemedText>
                        </ThemedText>
                        <ThemedText style={styles.trainingDetail}>
                          <ThemedText style={styles.trainingLabel}>Sucursal: </ThemedText>
                          <ThemedText style={styles.trainingValue}>{training.sucursal.nombre}</ThemedText>
                        </ThemedText>
                        <ThemedText style={styles.trainingDetail}>
                          <ThemedText style={styles.trainingLabel}>Descripción: </ThemedText>
                          <ThemedText style={styles.trainingValue}>{training.descripcion}</ThemedText>
                        </ThemedText>
                        {training.resultado && (
                          <ThemedText style={styles.trainingDetail}>
                            <ThemedText style={styles.trainingLabel}>Resultado: </ThemedText>
                            <ThemedText style={styles.trainingValue}>{training.resultado}</ThemedText>
                          </ThemedText>
                        )}
                        <ThemedText style={styles.trainingDetail}>
                          <ThemedText style={styles.trainingLabel}>Observaciones: </ThemedText>
                          <ThemedText style={styles.trainingValue}>{training.observaciones}</ThemedText>
                        </ThemedText>
                        <ThemedText style={styles.trainingDetail}>
                          <ThemedText style={styles.trainingLabel}>Responsable: </ThemedText>
                          <ThemedText style={styles.trainingValue}>{training.responsable.nombre} ({training.responsable.cedula})</ThemedText>
                        </ThemedText>
                        {firmaData && (
                          <ThemedView style={styles.signatureInfo}>
                            <ThemedText style={styles.signatureInfoTitle}>Firma:</ThemedText>
                            <ThemedText style={styles.signatureInfoText}>ID de sesión: {firmaData.sessionId}</ThemedText>
                            <ThemedText style={styles.signatureInfoText}>ID del empleado: {firmaData.empleadoId}</ThemedText>
                            {firmaData.empleadoDetalle && (
                              <ThemedView style={styles.signatureInfoDetail}>
                                <ThemedText style={styles.signatureInfoDetailText}>
                                  {firmaData.empleadoDetalle.nombre} {firmaData.empleadoDetalle.primer_apellido} {firmaData.empleadoDetalle.segundo_apellido}
                                </ThemedText>
                              </ThemedView>
                            )}
                            <ThemedText style={styles.signatureInfoText}>Latitud: {firmaData.latitud}</ThemedText>
                            <ThemedText style={styles.signatureInfoText}>Longitud: {firmaData.longitud}</ThemedText>
                            <ThemedText style={styles.signatureInfoText}>Hora: {generateDateTime(firmaData.timestamp)}</ThemedText>
                            {training.nombre_firma && (
                              <ThemedText style={styles.signatureInfoText}>Nombre: {training.nombre_firma}</ThemedText>
                            )}
                          </ThemedView>
                        )}
                        <ThemedView style={styles.detailSection}>
                          <ThemedText style={styles.detailSectionTitle}>Empleados:</ThemedText>
                          {training.empleados.map((emp) => (
                            <ThemedText key={emp.id} style={styles.detailItem}>
                              {emp.nombre} - {emp.cedula}
                            </ThemedText>
                          ))}
                        </ThemedView>
                        <ThemedView style={styles.detailSection}>
                          <ThemedText style={styles.detailSectionTitle}>Puestos:</ThemedText>
                          {training.puestos.map((puesto) => (
                            <ThemedText key={puesto.id} style={styles.detailItem}>
                              {puesto.nombre}
                            </ThemedText>
                          ))}
                        </ThemedView>
                        <ThemedView style={styles.detailSection}>
                          <ThemedText style={styles.detailSectionTitle}>Imagen adjunta:</ThemedText>
                          {training.id_local === '' ? (
                            <TrainingImageComponent trainingId={training.id} />
                          ) : (
                            training.base64_file && training.base64_file.trim() !== '' ? (
                              (() => {
                                // Asegurar formato correcto: data:image/jpeg;base64,<base64_string>
                                const base64Regex = /^data:(.+);base64,(.+)$/;
                                let imageUri = training.base64_file;
                                if (!base64Regex.test(imageUri)) {
                                  // Si no tiene el formato correcto, agregarlo
                                  if (imageUri.startsWith('data:image')) {
                                    // Ya tiene data:image pero puede que no tenga el formato exacto
                                    imageUri = imageUri;
                                  } else {
                                    // Agregar el prefijo completo
                                    imageUri = `data:image/jpeg;base64,${imageUri}`;
                                  }
                                }
                                return (
                                  <Image
                                    source={{ uri: imageUri }}
                                    style={styles.trainingImage}
                                    onError={(error) => {
                                      console.error('Error loading image:', error);
                                    }}
                                  />
                                );
                              })()
                            ) : (
                              <ThemedText style={styles.noImageText}>No hay imagen adjunta</ThemedText>
                            )
                          )}
                        </ThemedView>
                      </ThemedView>
                    )}

                    <TouchableOpacity
                      style={[
                        styles.trainingDeleteButton,
                        deletingTrainingKey === trainingKey && styles.trainingDeleteButtonDisabled,
                      ]}
                      onPress={() => confirmDeleteTraining(training, trainingKey)}
                      disabled={deletingTrainingKey !== null}
                    >
                      {deletingTrainingKey === trainingKey ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
                          <ThemedText style={styles.trainingDeleteButtonText}>Eliminar</ThemedText>
                        </>
                      )}
                    </TouchableOpacity>
                  </ThemedView>
                );
              })
            )}
          </ThemedView>
        )}
      </ScrollView>

      {showFechaCapacitacionPicker && (
        <DateTimePicker
          value={fechaCapacitacion ? new Date(fechaCapacitacion) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleFechaCapacitacionChange}
        />
      )}

      {showFilterFechaPicker && (
        <DateTimePicker
          value={filterFecha ? new Date(filterFecha) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleFilterFechaChange}
        />
      )}

      <AppFooter />
      <SlideMenu
        isVisible={isMenuVisible}
        onClose={handleMenuClose}
        onHomePress={handleHomePress}
      />
      {QRScannerComponent}

      {/* Camera Modal */}
      <Modal
        visible={isCameraVisible}
        animationType="slide"
        onRequestClose={() => setIsCameraVisible(false)}
      >
        <ThemedView style={{ flex: 1, backgroundColor: '#000' }}>
          <CameraView
            ref={cameraRef}
            style={{ flex: 1 }}
            facing="back"
          >
            <TouchableOpacity
              style={styles.cameraCloseButton}
              onPress={() => setIsCameraVisible(false)}
            >
              <Ionicons name="close" size={30} color="#000000" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cameraCaptureButton}
              onPress={takePicture}
            >
              <ThemedView style={styles.cameraCaptureButtonInner} />
            </TouchableOpacity>
          </CameraView>
        </ThemedView>
      </Modal>
    </ThemedView>
  );
}

// Component to load training image from server
const TrainingImageComponent: React.FC<{ trainingId: number }> = ({ trainingId }) => {
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { refreshAccessToken, logout, accessToken } = useAuth();
  const appendTokenToUrl = (url: string) => {
    if (!url) return '';
    if (!accessToken || accessToken.trim().length === 0) return url;
    if (/[?&]token=/.test(url)) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}token=${encodeURIComponent(accessToken)}`;
  };

  useEffect(() => {
    const fetchImage = async () => {
      try {
        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) return;
        const response = await authedFetch({
          url: appendTokenToUrl(`${apiUrl}/api/training/${trainingId}/get-image`),
          init: {
            method: 'GET',
          },
          refreshAccessToken,
          logout,
        });
        if (!response) return;

        if (response.ok) {
          const blob = await response.blob();
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64data = reader.result as string;
            setImageBase64(base64data);
          };
          reader.readAsDataURL(blob);
        }
      } catch (error) {
        console.error('Error loading training image:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchImage();
  }, [trainingId]);

  if (isLoading) {
    return <ActivityIndicator size="small" color="#007AFF" />;
  }

  if (!imageBase64) {
    return <ThemedText style={styles.noImageText}>No hay imagen adjunta</ThemedText>;
  }

  return (
    <Image
      source={{ uri: imageBase64 }}
      style={styles.trainingImage}
      onError={(error) => {
        console.error('Error loading image:', error);
      }}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F5C2C7',
    backgroundColor: '#F8D7DA',
  },
  errorBannerText: {
    flex: 1,
    color: '#B00020',
    fontSize: 14,
    fontWeight: '600',
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFEBAA',
    backgroundColor: '#FFF3CD',
  },
  offlineBannerText: {
    flex: 1,
    color: '#8A6D00',
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
  },
  createButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#000000',
  },
  formGroup: {
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#000000',
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    color: '#000000',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  picker: {
    width: '100%',
    height: 50,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#000000',
  },
  radioGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#fff',
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
    marginBottom: 10,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#007AFF',
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  radioCircleSelected: {
    backgroundColor: '#fff',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#007AFF',
  },
  radioLabel: {
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
  signatureInfoDetailText: {
    fontSize: 12,
    color: '#000000',
  },
  signatureInfoDetail: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#BDE4FF',
    borderRadius: 8,
    marginBottom: 4,
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
  inlineInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 10,
    backgroundColor: '#fff',
  },
  formButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#FF3B30',
  },
  confirmButton: {
    backgroundColor: '#34C759',
  },
  formButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  listContainer: {
    width: '100%',
  },
  listLoadingContainer: {
    minHeight: 200,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
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
  filtersContainer: {
    width: '100%',
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
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
  filterGroup: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  searchInput: {
    width: '100%',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: '#F9F9F9',
    color: '#000000',
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
  clearDateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  clearDateText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF3B30',
  },
  trainingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  trainingDeleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#FF3B30',
    borderRadius: 8,
  },
  trainingDeleteButtonDisabled: {
    opacity: 0.65,
  },
  trainingDeleteButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  trainingTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#007AFF',
  },
  trainingDetail: {
    fontSize: 14,
    marginBottom: 8,
    color: '#000000',
  },
  trainingLabel: {
    fontWeight: '600',
    color: '#000000',
  },
  trainingValue: {
    fontSize: 12,
    color: '#000000',
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#999',
    marginTop: 40,
  },
  collapseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    marginTop: 8,
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  collapseButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  collapsableContent: {
    padding: 12,
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    marginTop: 8,
  },
  addButton: {
    backgroundColor: '#34C759',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  selectedList: {
    marginTop: 12,
    gap: 8,
    backgroundColor: '#fff',
  },
  selectedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  selectedItemText: {
    fontSize: 14,
    color: '#000000',
    flex: 1,
  },
  cameraButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  cameraButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  previewContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 12,
  },
  removeImageButton: {
    backgroundColor: '#FF3B30',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
  },
  removeImageText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  cameraCloseButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  cameraCaptureButton: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#fff',
  },
  cameraCaptureButtonInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
  },
  trainingImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginTop: 8,
  },
  noImageText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 8,
  },
  detailSection: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  detailSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000000',
  },
  detailItem: {
    fontSize: 14,
    color: '#000000',
    marginBottom: 4,
    paddingLeft: 8,
  },
});

