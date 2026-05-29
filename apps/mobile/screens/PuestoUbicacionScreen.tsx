import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    Platform,
    View,
    TextInput,
    Modal,
    KeyboardAvoidingView,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as Location from 'expo-location';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useAuth } from '@/contexts/AuthContext';
import AppHeader from '@/components/AppHeader';
import AppFooter from '@/components/AppFooter';
import SlideMenu from '@/components/SlideMenu';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import * as Network from 'expo-network';
import { eventBus } from '@/hooks/eventBus';
import authedFetch from '@/hooks/authedFetch';
import { mergeMainStructureFragments } from '@/hooks/mergeMainStructureFragments';
import { loadMainStructureTreeMerged } from '@/hooks/bitacoraMainStructureCache';
import {
    loadMainStructureFragmentsObjectAllowPartial,
    patchSucursalPuestosUbicacionInFragments,
    readPuestoUbicacionDispositivoMap,
    writePuestoUbicacionDispositivo,
} from '@/hooks/mainStructureFragmentsStorage';
import getHoraAccion from '@/hooks/getHoraAccion';

async function getHoraAccionSafeMs(): Promise<number> {
    try {
        const t = await getHoraAccion();
        return typeof t === 'number' && Number.isFinite(t) ? t : Date.now();
    } catch {
        return Date.now();
    }
}

type PuestoUbicacionScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'PuestoUbicacion'>;

type MainStructurePlazaNode = { id: number; nombre: string };
type MainStructurePuestoNode = {
    id: number;
    nombre: string;
    ubicacion?: { lat: string | null; lng: string | null };
    plazas: MainStructurePlazaNode[]
};
type MainStructureSucursalNode = { id: number; nombre: string; puestos: MainStructurePuestoNode[] };
type MainStructureContratoNode = { id: number; nombre: string; sucursales: MainStructureSucursalNode[] };
type MainStructureDivisionNode = { id: number; nombre: string; contratos: MainStructureContratoNode[] };
type MainStructureClienteNode = { id: number; nombre: string; division: MainStructureDivisionNode[] };
type MainStructureEmpresaNode = { id: number; nombre: string; clientes: MainStructureClienteNode[] };
type MainStructureTree = MainStructureEmpresaNode[];

type HierarchyIds = {
    empresaId: number;
    clienteId: number;
    divisionId: number;
    contratoId: number;
    corpoId: number;
    puestoId: number;
};

function numOrNull(v: unknown): number | null {
    if (v === undefined || v === null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

/** Lee coords del puesto desde `ubicacion` o campos planos (API / fragmentos / monolito). */
function readUbicacionFromPuesto(puesto: any): { lat: string | null; lng: string | null } {
    if (!puesto || typeof puesto !== 'object') return { lat: null, lng: null };
    const u = puesto.ubicacion;
    const latRaw =
        (u != null && typeof u === 'object'
            ? (u as any).lat ?? (u as any).latitud ?? (u as any).latitude
            : undefined) ?? puesto.coordenadas_gpslat;
    const lngRaw =
        (u != null && typeof u === 'object'
            ? (u as any).lng ?? (u as any).longitud ?? (u as any).longitude
            : undefined) ?? puesto.coordenadas_gpslng;
    const toStr = (v: unknown): string | null => {
        if (v === undefined || v === null) return null;
        const s = String(v).trim();
        return s.length > 0 ? s : null;
    };
    return { lat: toStr(latRaw), lng: toStr(lngRaw) };
}

function formatCoordForDisplay(v: string | null | undefined): string {
    if (v === undefined || v === null) return 'No disponible';
    const t = String(v).trim();
    return t.length > 0 ? t : 'No disponible';
}

/** Acepta coma o punto decimal; devuelve null si no es un número finito. */
function parseCoordText(s: string): number | null {
    const t = String(s).trim().replace(',', '.');
    if (t === '') return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
}

/**
 * Nombre y datos base del puesto desde fragmentos / árbol.
 * Las coords mostradas como "ubicación guardada" priorizan `dispositivoUbicacionMap` (GPS al confirmar).
 */
function getPuestoRecordForUbicacionDisplay(
    structure: MainStructureTree,
    fragments: Record<string, any> | null,
    corpoId: number | null,
    puestoId: number | null,
): any | null {
    if (corpoId == null || puestoId == null) return null;
    const pid = Number(puestoId);
    const cid = Number(corpoId);
    const k = `sucursal_${cid}_puestos`;
    if (fragments && Array.isArray(fragments[k])) {
        const hit = fragments[k].find((p: any) => Number(p?.id) === pid);
        if (hit) return hit;
    }
    for (const empresa of structure || []) {
        for (const cliente of empresa.clientes || []) {
            for (const division of getClienteDivisionArray(cliente)) {
                for (const contrato of division.contratos || []) {
                    for (const sucursal of contrato.sucursales || []) {
                        if (Number(sucursal.id) !== cid) continue;
                        for (const puesto of sucursal.puestos || []) {
                            if (Number(puesto.id) === pid) return puesto;
                        }
                    }
                }
            }
        }
    }
    return null;
}

/** Recorre la estructura mergeada desde fragmentos para completar empresa → puesto. */
function findHierarchyByPuestoIn(structureArr: MainStructureTree, puestoId: number): HierarchyIds | null {
    const pid = Number(puestoId);
    for (const empresa of structureArr || []) {
        for (const cliente of empresa.clientes || []) {
            for (const division of getClienteDivisionArray(cliente)) {
                for (const contrato of division.contratos || []) {
                    for (const sucursal of contrato.sucursales || []) {
                        for (const puesto of sucursal.puestos || []) {
                            if (Number(puesto.id) === pid) {
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

function getClienteDivisionArray(cliente: MainStructureClienteNode | any): MainStructureDivisionNode[] {
    if (!cliente) return [];
    if (Array.isArray(cliente.division)) return cliente.division;
    if (Array.isArray((cliente as any).divisiones)) return (cliente as any).divisiones;
    return [];
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

function findDivisionIdForContratoInStructure(
    tree: MainStructureTree,
    empresaId: number | null,
    clienteId: number | null,
    contratoId: number | null
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
    divisionId: number | null
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

/** IDs desde current_marca (anidado o plano, como MarcarIngresoSalida / NotesScreen) y refuerzo con el árbol en caché. */
function resolveMarcaIdsFromCurrentMarca(
    structure: MainStructureTree,
    current: Record<string, unknown> | null
): {
    empresaId: number | null;
    clienteId: number | null;
    divisionId: number | null;
    contratoId: number | null;
    corpoId: number | null;
    puestoId: number | null;
} {
    if (!current) {
        return {
            empresaId: null,
            clienteId: null,
            divisionId: null,
            contratoId: null,
            corpoId: null,
            puestoId: null,
        };
    }
    const c = current as Record<string, any>;
    let empresaId = numOrNull(c?.empresa?.id ?? c?.empresa_id);
    let clienteId = numOrNull(c?.cliente?.id ?? c?.cliente_id);
    let divisionId = resolveMarcaDivisionForTree(c, structure);
    let contratoId = numOrNull(c?.contrato?.id ?? c?.contrato_id);
    let corpoId = numOrNull(c?.corpo?.id ?? c?.corpo_id);
    let puestoId = numOrNull(
        c?.puesto?.id ??
        c?.puesto_id ??
        c?.plaza?.puesto?.id ??
        c?.plaza?.puesto_id ??
        c?.roleDivision?.puesto_id ??
        c?.role_division?.puesto_id
    );

    if (puestoId && Array.isArray(structure) && structure.length > 0) {
        const found = findHierarchyByPuestoIn(structure, puestoId);
        if (found) {
            empresaId = empresaId ?? found.empresaId;
            clienteId = clienteId ?? found.clienteId;
            divisionId = divisionId ?? resolveDivisionIdInStructure(structure, empresaId, clienteId, found.divisionId);
            contratoId = contratoId ?? found.contratoId;
            corpoId = corpoId ?? found.corpoId;
        }
    }

    return { empresaId, clienteId, divisionId, contratoId, corpoId, puestoId };
}

export default function PuestoUbicacionScreen() {
    const { refreshAccessToken, logout } = useAuth();
    const [isMenuVisible, setIsMenuVisible] = useState(false);
    const navigation = useNavigation<PuestoUbicacionScreenNavigationProp>();

    // Estructura principal (árbol mergeado para current_marca / búsqueda por puesto)
    const [structure, setStructure] = useState<MainStructureTree>([]);
    /** Fragmentos por clave servidor (`divisiones`, `empresa_X_clientes`, …); null = modo legado monolítico */
    const [mainFragments, setMainFragments] = useState<Record<string, any> | null>(null);
    const [isStructureLoading, setIsStructureLoading] = useState(false);

    // Filtros jerárquicos
    const [filterEmpresaId, setFilterEmpresaId] = useState<number | null>(null);
    const [filterClienteId, setFilterClienteId] = useState<number | null>(null);
    const [filterDivisionId, setFilterDivisionId] = useState<number | null>(null);
    const [filterContratoId, setFilterContratoId] = useState<number | null>(null);
    const [filterCorpoId, setFilterCorpoId] = useState<number | null>(null);
    const [filterPuestoId, setFilterPuestoId] = useState<number | null>(null);

    // Datos del puesto seleccionado
    const [puestoData, setPuestoData] = useState<{ lat: string | null; lng: string | null } | null>(null);
    const [puestoNombre, setPuestoNombre] = useState<string>('');

    // Ubicación del dispositivo
    const [deviceLocation, setDeviceLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [isGettingLocation, setIsGettingLocation] = useState(false);

    const [manualUbicacionModalVisible, setManualUbicacionModalVisible] = useState(false);
    const [manualLatText, setManualLatText] = useState('');
    const [manualLngText, setManualLngText] = useState('');

    // Estados de carga
    const [isUpdating, setIsUpdating] = useState(false);

    /** Snapshot de AsyncStorage current_marca; se combina con la estructura mergeada al aplicar filtros. */
    const currentMarcaRef = useRef<Record<string, unknown> | null>(null);
    /** Se incrementa en cada foco para volver a aplicar la jerarquía desde current_marca. */
    const [marcaHierarchyRevision, setMarcaHierarchyRevision] = useState(0);

    /** Coordenadas GPS guardadas al confirmar en el dispositivo (clave = id de puesto en string). */
    const [dispositivoUbicacionMap, setDispositivoUbicacionMap] = useState<
        Record<string, { lat: string; lng: string }>
    >({});

    const getConnectionStatus = async (): Promise<boolean> => {
        //return false;
        const networkState = await Network.getNetworkStateAsync();

        return (
            networkState.isConnected === true &&
            networkState.isInternetReachable === true
        );
    };

    const updatePuestoCoordsInMainStructureCache = useCallback(
        async (puestoId: number, lat: string | null, lng: string | null, sucursalIdHint?: number | null) => {
            await patchSucursalPuestosUbicacionInFragments(puestoId, lat, lng, sucursalIdHint);

            const fragments = await loadMainStructureFragmentsObjectAllowPartial();
            if (fragments && Object.keys(fragments).length > 0) {
                setMainFragments(fragments);
                const merged = mergeMainStructureFragments(fragments);
                if (Array.isArray(merged) && merged.length > 0) {
                    setStructure(merged);
                    return;
                }
            }

            const tree = await loadMainStructureTreeMerged();
            const arr = Array.isArray(tree) ? (tree as MainStructureTree) : [];
            if (arr.length > 0) {
                setStructure(arr);
            }

            const fr = await loadMainStructureFragmentsObjectAllowPartial();
            if (fr && Object.keys(fr).length > 0) {
                setMainFragments(fr);
            }
        },
        []
    );

    // Misma base que los pickers: fragmentos mergeados; fallback solo si no hay árbol mergeable.
    const loadMainStructureCache = useCallback(async (): Promise<MainStructureTree> => {
        try {
            setIsStructureLoading(true);
            setDispositivoUbicacionMap(await readPuestoUbicacionDispositivoMap());

            const fragments = await loadMainStructureFragmentsObjectAllowPartial();
            if (fragments && Object.keys(fragments).length > 0) {
                setMainFragments(fragments);
                const merged = mergeMainStructureFragments(fragments);
                if (Array.isArray(merged) && merged.length > 0) {
                    setStructure(merged);
                    return merged as MainStructureTree;
                }
                const tree = await loadMainStructureTreeMerged();
                const arr = Array.isArray(tree) ? (tree as MainStructureTree) : [];
                setStructure(arr);
                return arr;
            }
            setMainFragments(null);
            const tree = await loadMainStructureTreeMerged();
            const arr = Array.isArray(tree) ? (tree as MainStructureTree) : [];
            setStructure(arr);
            return arr;
        } catch (error) {
            console.error('Error fetching main structure:', error);
            setStructure([]);
            setMainFragments(null);
            return [];
        } finally {
            setIsStructureLoading(false);
        }
    }, []);

    // Cargar current_marca (misma forma que InductionTourRecordScreen / objeto marca de MarcarIngresoSalida)
    const loadMarcaContext = useCallback(async () => {
        try {
            const raw = await AsyncStorage.getItem('current_marca');
            if (!raw || raw.trim() === '') {
                currentMarcaRef.current = null;
                return;
            }
            currentMarcaRef.current = JSON.parse(raw) as Record<string, unknown>;
        } catch (error) {
            console.error('Error loading marca context:', error);
            currentMarcaRef.current = null;
        }
    }, []);

    // Nodos computados: con fragmentos, listas desde claves `divisiones`, `cliente_X_division_Y_contratos`, etc.
    const filterEmpresas = useMemo(() => {
        if (mainFragments && Array.isArray(mainFragments.empresas)) {
            return mainFragments.empresas;
        }
        return Array.isArray(structure) ? structure : [];
    }, [mainFragments, structure]);

    const filterClientes = useMemo(() => {
        const empresaFromTree = filterEmpresas.find((e: any) => Number(e.id) === Number(filterEmpresaId));
        const fallback = empresaFromTree?.clientes || [];
        if (mainFragments && filterEmpresaId != null) {
            const k = `empresa_${filterEmpresaId}_clientes`;
            return Array.isArray(mainFragments[k]) ? mainFragments[k] : fallback;
        }
        return fallback;
    }, [mainFragments, filterEmpresaId, filterEmpresas]);

    const filterDivisiones = useMemo(() => {
        if (!filterClienteId) return [];
        const clienteFromTree = filterClientes.find((c: any) => Number(c.id) === Number(filterClienteId));
        const fallback = getClienteDivisionArray(clienteFromTree);
        if (mainFragments && Array.isArray(mainFragments.divisiones)) {
            return mainFragments.divisiones.length > 0 ? mainFragments.divisiones : fallback;
        }
        return fallback;
    }, [mainFragments, filterClienteId, filterClientes]);

    const filterContratos = useMemo(() => {
        const divisionFromTree = filterDivisiones.find((d: any) => Number(d.id) === Number(filterDivisionId));
        const fallback = divisionFromTree?.contratos || [];
        if (
            mainFragments &&
            filterClienteId != null &&
            filterDivisionId != null
        ) {
            const k = `cliente_${filterClienteId}_division_${filterDivisionId}_contratos`;
            return Array.isArray(mainFragments[k]) ? mainFragments[k] : fallback;
        }
        return fallback;
    }, [mainFragments, filterClienteId, filterDivisionId, filterDivisiones]);

    const filterSucursales = useMemo(() => {
        const contratoFromTree = filterContratos.find((c: any) => Number(c.id) === Number(filterContratoId));
        const fallback = contratoFromTree?.sucursales || [];
        if (mainFragments && filterContratoId != null) {
            const k = `contrato_${filterContratoId}_sucursales`;
            return Array.isArray(mainFragments[k]) ? mainFragments[k] : fallback;
        }
        return fallback;
    }, [mainFragments, filterContratoId, filterContratos]);

    const filterPuestos = useMemo(() => {
        const sucursalFromTree = filterSucursales.find((s: any) => Number(s.id) === Number(filterCorpoId));
        const fallback = sucursalFromTree?.puestos || [];
        if (mainFragments && filterCorpoId != null) {
            const k = `sucursal_${filterCorpoId}_puestos`;
            const puestos = Array.isArray(mainFragments[k]) ? mainFragments[k] : fallback;
            return puestos;
        }
        return fallback;
    }, [mainFragments, filterCorpoId, filterSucursales]);

    // Al entrar a la pantalla: aplicar jerarquía desde current_marca (refuerzo con árbol mergeado si existe)
    useEffect(() => {
        if (!marcaHierarchyRevision) return;

        const ids = resolveMarcaIdsFromCurrentMarca(
            Array.isArray(structure) ? structure : [],
            currentMarcaRef.current
        );
        setFilterEmpresaId(ids.empresaId);
        setFilterClienteId(ids.clienteId);
        setFilterDivisionId(ids.divisionId);
        setFilterContratoId(ids.contratoId);
        setFilterCorpoId(ids.corpoId);
        setFilterPuestoId(ids.puestoId);
    }, [structure, marcaHierarchyRevision]);

    // Cargar datos del puesto cuando se selecciona (IDs numéricos: el Picker puede devolver string)
    useEffect(() => {
        const pid = numOrNull(filterPuestoId);
        const corpoNum = numOrNull(filterCorpoId);
        if (pid != null && corpoNum != null) {
            const fromDev = dispositivoUbicacionMap[String(pid)];
            const puesto = getPuestoRecordForUbicacionDisplay(structure, mainFragments, corpoNum, pid);
            if (puesto) {
                setPuestoNombre(String(puesto.nombre || ''));
                if (fromDev?.lat && fromDev?.lng) {
                    setPuestoData({ lat: fromDev.lat, lng: fromDev.lng });
                } else {
                    setPuestoData(readUbicacionFromPuesto(puesto));
                }
            } else if (fromDev?.lat && fromDev?.lng) {
                setPuestoNombre('');
                setPuestoData({ lat: fromDev.lat, lng: fromDev.lng });
            } else {
                setPuestoData(null);
                setPuestoNombre('');
            }
        } else {
            setPuestoData(null);
            setPuestoNombre('');
        }
    }, [filterPuestoId, filterCorpoId, structure, mainFragments, dispositivoUbicacionMap]);

    // Obtener ubicación del dispositivo
    const getDeviceLocation = useCallback(async (showError: boolean = true) => {
        try {
            setIsGettingLocation(true);
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                if (showError) {
                    Alert.alert('Permisos', 'Se necesitan permisos de ubicación para obtener las coordenadas del dispositivo.');
                }
                return;
            }

            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
            });

            setDeviceLocation({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
            });
        } catch (error) {
            console.error('Error getting location:', error);
            if (showError) {
                Alert.alert('Error', 'No se pudo obtener la ubicación del dispositivo.');
            }
        } finally {
            setIsGettingLocation(false);
        }
    }, []);

    // Obtener ubicación automáticamente cuando se selecciona un puesto
    useEffect(() => {
        if (filterPuestoId) {
            getDeviceLocation(false);
        }
    }, [filterPuestoId, getDeviceLocation]);

    // Actualizar ubicación cada 15 segundos cuando hay un puesto seleccionado
    useEffect(() => {
        if (!filterPuestoId) return;

        const interval = setInterval(() => {
            getDeviceLocation(false);
        }, 15000); // 15 segundos

        return () => clearInterval(interval);
    }, [filterPuestoId, getDeviceLocation]);

    /** PUT `/api/puestos/[id]/ubicacion`: coordenadas nuevas o `{ latitud: null, longitud: null }` para borrar en servidor y cachés locales. */
    const putPuestoUbicacion = useCallback(
        async (latitud: number | null, longitud: number | null): Promise<boolean> => {
            if (!filterPuestoId) {
                Alert.alert('Error', 'Por favor selecciona un puesto');
                return false;
            }

            const clearing = latitud === null && longitud === null;

            try {
                setIsUpdating(true);
                const horaAccion = await getHoraAccionSafeMs();
                const isConnected = await getConnectionStatus();

                if (isConnected) {
                    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
                    if (!apiUrl) throw new Error('Server URL not configured');

                    const response = await authedFetch({
                        url: `${apiUrl}/api/puestos/${filterPuestoId}/ubicacion`,
                        init: {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json',
                                'ngrok-skip-browser-warning': '69420',
                            },
                            body: JSON.stringify({ latitud, longitud, horaAccion }),
                        },
                        refreshAccessToken,
                        logout,
                    });

                    if (!response) throw new Error('No response from server');

                    const data = await response.json();
                    if (data.status) {
                        const latStr = clearing ? null : String(latitud);
                        const lngStr = clearing ? null : String(longitud);
                        await writePuestoUbicacionDispositivo(filterPuestoId, latStr, lngStr);
                        setDispositivoUbicacionMap(await readPuestoUbicacionDispositivoMap());
                        await updatePuestoCoordsInMainStructureCache(filterPuestoId, latStr, lngStr, filterCorpoId);
                        setPuestoData({ lat: latStr, lng: lngStr });
                        Alert.alert('Éxito', data.message || (clearing ? 'Ubicación eliminada' : 'Ubicación actualizada'));
                        return true;
                    }
                    Alert.alert('Error', data.message || 'Error al actualizar la ubicación');
                    return false;
                } else {
                    const id_local = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                    const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                    const actions = actionsStr ? JSON.parse(actionsStr) : [];
                    const puestoNum = Number(filterPuestoId);
                    const isSamePuestoAction = (a: any) =>
                        a?.type === 'puesto_ubicacion' && Number(a?.puesto_id) === puestoNum;

                    const filteredActions = actions.filter((a: any) => !isSamePuestoAction(a));

                    filteredActions.push({
                        id: id_local,
                        puesto_id: filterPuestoId,
                        sucursal_id: filterCorpoId ?? null,
                        action: 'update',
                        type: 'puesto_ubicacion',
                        payload: { latitud, longitud, horaAccion },
                        synced: false,
                    });

                    await AsyncStorage.setItem('evaluations_actions', JSON.stringify(filteredActions));

                    const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                    const cache = cacheStr ? JSON.parse(cacheStr) : [];
                    const updatedCache = cache.filter(
                        (item: any) => !(item.type === 'puesto_ubicacion' && Number(item?.puesto_id) === puestoNum),
                    );
                    updatedCache.push({
                        id_local,
                        puesto_id: filterPuestoId,
                        sucursal_id: filterCorpoId ?? null,
                        type: 'puesto_ubicacion',
                        latitud,
                        longitud,
                        horaAccion,
                        synced: false,
                    });
                    await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));

                    const latStr = clearing ? null : String(latitud);
                    const lngStr = clearing ? null : String(longitud);
                    await writePuestoUbicacionDispositivo(filterPuestoId, latStr, lngStr);
                    setDispositivoUbicacionMap(await readPuestoUbicacionDispositivoMap());
                    await updatePuestoCoordsInMainStructureCache(filterPuestoId, latStr, lngStr, filterCorpoId);
                    setPuestoData({ lat: latStr, lng: lngStr });

                    Alert.alert(
                        'Éxito',
                        clearing
                            ? 'Eliminación guardada localmente. Se sincronizará cuando haya conexión.'
                            : 'Ubicación guardada localmente. Se sincronizará cuando haya conexión.',
                    );
                    return true;
                }
            } catch (error: any) {
                console.error('Error updating puesto ubicacion:', error);
                Alert.alert('Error', error.message || 'No se pudo actualizar la ubicación del puesto');
                return false;
            } finally {
                setIsUpdating(false);
            }
        },
        [filterPuestoId, filterCorpoId, refreshAccessToken, logout, updatePuestoCoordsInMainStructureCache],
    );

    const updatePuestoUbicacion = useCallback(async () => {
        if (!filterPuestoId) {
            Alert.alert('Error', 'Por favor selecciona un puesto');
            return;
        }
        if (!deviceLocation) {
            Alert.alert('Error', 'Por favor obtén la ubicación del dispositivo primero');
            return;
        }
        await putPuestoUbicacion(deviceLocation.latitude, deviceLocation.longitude);
    }, [filterPuestoId, deviceLocation, putPuestoUbicacion]);

    const requestConfirmClearUbicacion = useCallback(() => {
        if (!filterPuestoId) {
            Alert.alert('Error', 'Por favor selecciona un puesto');
            return;
        }
        Alert.alert(
            'Eliminar ubicación',
            '¿Quitar las coordenadas GPS de este puesto en el servidor? Esta acción se puede deshacer volviendo a guardar una ubicación.',
            [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Eliminar', style: 'destructive', onPress: () => void putPuestoUbicacion(null, null) },
            ],
        );
    }, [filterPuestoId, putPuestoUbicacion]);

    const tieneUbicacionGuardada = useMemo(() => {
        if (!puestoData) return false;
        const a = String(puestoData.lat ?? '').trim();
        const b = String(puestoData.lng ?? '').trim();
        return a.length > 0 && b.length > 0;
    }, [puestoData]);

    const requestConfirmAndUpdateUbicacion = useCallback(() => {
        if (!filterPuestoId) {
            Alert.alert('Error', 'Por favor selecciona un puesto');
            return;
        }
        if (!deviceLocation) {
            Alert.alert('Error', 'Por favor obtén la ubicación del dispositivo primero');
            return;
        }

        Alert.alert(
            'Confirmar ubicación',
            '¿Deseas actualizar la ubicación del puesto con las coordenadas actuales del dispositivo?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Aceptar',
                    onPress: () => {
                        void updatePuestoUbicacion();
                    },
                },
            ]
        );
    }, [filterPuestoId, deviceLocation, updatePuestoUbicacion]);

    const openManualUbicacionModal = useCallback(() => {
        if (!filterPuestoId) {
            Alert.alert('Error', 'Por favor selecciona un puesto');
            return;
        }
        const latPref =
            (puestoData?.lat && String(puestoData.lat).trim()) ||
            (deviceLocation != null ? String(deviceLocation.latitude) : '');
        const lngPref =
            (puestoData?.lng && String(puestoData.lng).trim()) ||
            (deviceLocation != null ? String(deviceLocation.longitude) : '');
        setManualLatText(latPref);
        setManualLngText(lngPref);
        setManualUbicacionModalVisible(true);
    }, [filterPuestoId, puestoData, deviceLocation]);

    const closeManualUbicacionModal = useCallback(() => {
        setManualUbicacionModalVisible(false);
    }, []);

    const confirmManualUbicacion = useCallback(async () => {
        const lat = parseCoordText(manualLatText);
        const lng = parseCoordText(manualLngText);
        if (lat === null || lng === null) {
            Alert.alert('Error', 'Introduce latitud y longitud válidas.');
            return;
        }
        if (lat < -90 || lat > 90) {
            Alert.alert('Error', 'La latitud debe estar entre -90 y 90.');
            return;
        }
        if (lng < -180 || lng > 180) {
            Alert.alert('Error', 'La longitud debe estar entre -180 y 180.');
            return;
        }
        const ok = await putPuestoUbicacion(lat, lng);
        if (ok) setManualUbicacionModalVisible(false);
    }, [manualLatText, manualLngText, putPuestoUbicacion]);

    // Sincronizar acciones offline cuando se restaura la conexión
    useEffect(() => {
        const handler = async () => {
            const actionsStr = await AsyncStorage.getItem('evaluations_actions');
            if (!actionsStr) return;

            let actions = JSON.parse(actionsStr);
            const puestoUbicacionActions = actions.filter(
                (a: any) => a.type === 'puesto_ubicacion' && !a.synced
            );

            if (puestoUbicacionActions.length === 0) return;

            for (const action of puestoUbicacionActions) {
                try {
                    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
                    if (!apiUrl) continue;

                    const response = await authedFetch({
                        url: `${apiUrl}/api/puestos/${action.puesto_id}/ubicacion`,
                        init: {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json',
                                'ngrok-skip-browser-warning': '69420',
                            },
                            body: JSON.stringify({
                                latitud: action.payload.latitud,
                                longitud: action.payload.longitud,
                                horaAccion: action.payload?.horaAccion ?? action.horaAccion,
                            }),
                        },
                        refreshAccessToken,
                        logout,
                    });

                    if (response) {
                        const data = await response.json();
                        if (data.status) {
                            const rawLat = action?.payload?.latitud;
                            const rawLng = action?.payload?.longitud;
                            const clearingUbicacion = rawLat === null && rawLng === null;
                            const lat = clearingUbicacion ? null : String(rawLat ?? '');
                            const lng = clearingUbicacion ? null : String(rawLng ?? '');
                            if (!clearingUbicacion && (!lat || !lng)) {
                                continue;
                            }

                            await writePuestoUbicacionDispositivo(action.puesto_id, lat, lng);
                            setDispositivoUbicacionMap(await readPuestoUbicacionDispositivoMap());

                            await updatePuestoCoordsInMainStructureCache(
                                action.puesto_id,
                                lat,
                                lng,
                                action.sucursal_id ?? filterCorpoId ?? null,
                            );

                            if (Number(filterPuestoId) === Number(action.puesto_id)) {
                                setPuestoData({ lat, lng });
                            }

                            // Marcar como sincronizado
                            actions = actions.filter(
                                (a: any) => !(a.id === action.id && a.action === 'update' && a.type === 'puesto_ubicacion')
                            );
                            await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                            // Actualizar cache
                            const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                            if (cacheStr) {
                                const cache = JSON.parse(cacheStr);
                                const updatedCache = cache.map((item: any) => {
                                    if (item.id_local === action.id && item.type === 'puesto_ubicacion') {
                                        return { ...item, synced: true };
                                    }
                                    return item;
                                });
                                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error syncing puesto ubicacion action:', error);
                }
            }

            // Recargar estructura después de sincronizar
            await loadMainStructureCache();
        };

        eventBus.on('connectionRestored', handler);
        return () => {
            eventBus.off('connectionRestored', handler);
        };

    }, [loadMainStructureCache, filterCorpoId, refreshAccessToken, logout, updatePuestoCoordsInMainStructureCache, filterPuestoId]);

    useFocusEffect(
        useCallback(() => {
            let cancelled = false;
            (async () => {
                await loadMarcaContext();
                if (cancelled) return;
                await loadMainStructureCache();
                if (cancelled) return;
                setMarcaHierarchyRevision((r) => r + 1);
            })();
            return () => {
                cancelled = true;
            };
        }, [loadMarcaContext, loadMainStructureCache])
    );

    return (
        <ThemedView style={styles.container}>
            <AppHeader
                title="Ubicación del Puesto"
                onMenuPress={() => setIsMenuVisible(true)}
            />
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                <ThemedView style={styles.content}>
                    <ThemedView style={styles.titleContainer}>
                        <ThemedView style={styles.title}>
                            <Ionicons name="location" size={24} color="#000000" />
                            <ThemedText type="title" style={styles.titleText}>Ubicación del Puesto</ThemedText>
                        </ThemedView>
                        <ThemedText style={styles.subtitle}>Actualizar coordenadas GPS del puesto</ThemedText>
                    </ThemedView>

                    {isStructureLoading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color="#007AFF" />
                            <ThemedText style={styles.loadingText}>Cargando estructura...</ThemedText>
                        </View>
                    ) : (
                        <>

                            {/* Formulario principal */}
                            <ThemedView style={styles.formCard}>
                                <ThemedText style={styles.formTitle}>Seleccionar Puesto</ThemedText>

                                {/* Empresa */}
                                <ThemedText style={styles.label}>Empresa</ThemedText>
                                <View style={styles.pickerContainer}>
                                    <Picker
                                        selectedValue={filterEmpresaId}
                                        onValueChange={(value) => {
                                            setFilterEmpresaId(numOrNull(value));
                                            setFilterClienteId(null);
                                            setFilterDivisionId(null);
                                            setFilterContratoId(null);
                                            setFilterCorpoId(null);
                                            setFilterPuestoId(null);
                                        }}
                                        style={styles.picker}
                                    >
                                        <Picker.Item label="Seleccionar empresa..." value={null} color="#000000" />
                                        {filterEmpresas.map((empresa: any) => (
                                            <Picker.Item key={empresa.id} label={empresa.nombre} value={empresa.id} color="#000000" />
                                        ))}
                                    </Picker>
                                </View>

                                {/* Cliente */}
                                {filterEmpresaId && (
                                    <>
                                        <ThemedText style={styles.label}>Cliente</ThemedText>
                                        <View style={styles.pickerContainer}>
                                            <Picker
                                                selectedValue={filterClienteId}
                                                onValueChange={(value) => {
                                                    setFilterClienteId(numOrNull(value));
                                                    setFilterDivisionId(null);
                                                    setFilterContratoId(null);
                                                    setFilterCorpoId(null);
                                                    setFilterPuestoId(null);
                                                }}
                                                style={styles.picker}
                                            >
                                                <Picker.Item label="Seleccionar cliente..." value={null} color="#000000" />
                                                {filterClientes.map((cliente: any) => (
                                                    <Picker.Item key={cliente.id} label={cliente.nombre} value={cliente.id} color="#000000" />
                                                ))}
                                            </Picker>
                                        </View>
                                    </>
                                )}

                                {/* División */}
                                {filterClienteId && (
                                    <>
                                        <ThemedText style={styles.label}>División</ThemedText>
                                        <View style={styles.pickerContainer}>
                                            <Picker
                                                selectedValue={filterDivisionId}
                                                onValueChange={(value) => {
                                                    setFilterDivisionId(numOrNull(value));
                                                    setFilterContratoId(null);
                                                    setFilterCorpoId(null);
                                                    setFilterPuestoId(null);
                                                }}
                                                style={styles.picker}
                                            >
                                                <Picker.Item label="Seleccionar división..." value={null} color="#000000" />
                                                {filterDivisiones.map((division: any) => (
                                                    <Picker.Item key={division.id} label={division.nombre} value={division.id} color="#000000" />
                                                ))}
                                            </Picker>
                                        </View>
                                    </>
                                )}

                                {/* Contrato */}
                                {filterDivisionId && (
                                    <>
                                        <ThemedText style={styles.label}>Contrato</ThemedText>
                                        <View style={styles.pickerContainer}>
                                            <Picker
                                                selectedValue={filterContratoId}
                                                onValueChange={(value) => {
                                                    setFilterContratoId(numOrNull(value));
                                                    setFilterCorpoId(null);
                                                    setFilterPuestoId(null);
                                                }}
                                                style={styles.picker}
                                            >
                                                <Picker.Item label="Seleccionar contrato..." value={null} color="#000000" />
                                                {filterContratos.map((contrato: any) => (
                                                    <Picker.Item key={contrato.id} label={contrato.nombre} value={contrato.id} color="#000000" />
                                                ))}
                                            </Picker>
                                        </View>
                                    </>
                                )}

                                {/* Sucursal */}
                                {filterContratoId && (
                                    <>
                                        <ThemedText style={styles.label}>Sucursal</ThemedText>
                                        <View style={styles.pickerContainer}>
                                            <Picker
                                                selectedValue={filterCorpoId}
                                                onValueChange={(value) => {
                                                    setFilterCorpoId(numOrNull(value));
                                                    setFilterPuestoId(null);
                                                }}
                                                style={styles.picker}
                                            >
                                                <Picker.Item label="Seleccionar sucursal..." value={null} color="#000000" />
                                                {filterSucursales.map((sucursal: any) => (
                                                    <Picker.Item key={sucursal.id} label={sucursal.nombre} value={sucursal.id} color="#000000" />
                                                ))}
                                            </Picker>
                                        </View>
                                    </>
                                )}

                                {/* Puesto */}
                                {filterCorpoId && (
                                    <>
                                        <ThemedText style={styles.label}>Puesto</ThemedText>
                                        <View style={styles.pickerContainer}>
                                            <Picker
                                                selectedValue={filterPuestoId}
                                                onValueChange={(value) => {
                                                    setFilterPuestoId(numOrNull(value));
                                                }}
                                                style={styles.picker}
                                            >
                                                <Picker.Item label="Seleccionar puesto..." value={null} color="#000000" />
                                                {filterPuestos.map((puesto: any) => (
                                                    <Picker.Item key={puesto.id} label={puesto.nombre} value={puesto.id} color="#000000" />
                                                ))}
                                            </Picker>
                                        </View>
                                    </>
                                )}
                            </ThemedView>

                            {/* Datos del puesto seleccionado */}
                            {filterPuestoId && puestoData && (
                                <ThemedView style={styles.infoSection}>
                                    <ThemedText style={styles.sectionTitle}>Ubicación Actual del Puesto</ThemedText>
                                    <ThemedView style={styles.bitacoraCard}>
                                        <ThemedText style={styles.bitTitle}>{puestoNombre}</ThemedText>
                                        <ThemedText style={styles.bitLine}>
                                            <ThemedText style={styles.bitLabel}>Latitud: </ThemedText>
                                            <ThemedText style={styles.bitValue}>{formatCoordForDisplay(puestoData.lat)}</ThemedText>
                                        </ThemedText>
                                        <ThemedText style={styles.bitLine}>
                                            <ThemedText style={styles.bitLabel}>Longitud: </ThemedText>
                                            <ThemedText style={styles.bitValue}>{formatCoordForDisplay(puestoData.lng)}</ThemedText>
                                        </ThemedText>
                                    </ThemedView>
                                </ThemedView>
                            )}

                            {/* Ubicación del dispositivo */}
                            {filterPuestoId && (
                                <ThemedView style={styles.infoSection}>
                                    <ThemedText style={styles.sectionTitle}>Ubicación del Dispositivo</ThemedText>
                                    {isGettingLocation && (
                                        <ThemedView style={styles.bitacoraCard}>
                                            <ActivityIndicator size="small" color="#007AFF" />
                                            <ThemedText style={styles.bitValue}>Obteniendo ubicación...</ThemedText>
                                        </ThemedView>
                                    )}
                                    {deviceLocation && !isGettingLocation && (
                                        <ThemedView style={styles.bitacoraCard}>
                                            <ThemedText style={styles.bitTitle}>Coordenadas Actuales</ThemedText>
                                            <ThemedText style={styles.bitLine}>
                                                <ThemedText style={styles.bitLabel}>Latitud: </ThemedText>
                                                <ThemedText style={styles.bitValue}>{deviceLocation.latitude.toFixed(6)}</ThemedText>
                                            </ThemedText>
                                            <ThemedText style={styles.bitLine}>
                                                <ThemedText style={styles.bitLabel}>Longitud: </ThemedText>
                                                <ThemedText style={styles.bitValue}>{deviceLocation.longitude.toFixed(6)}</ThemedText>
                                            </ThemedText>
                                            <ThemedText style={[styles.bitValue, { fontSize: 12, marginTop: 8, color: '#666' }]}>
                                                Se actualiza automáticamente cada 15 segundos
                                            </ThemedText>
                                        </ThemedView>
                                    )}
                                    {!deviceLocation && !isGettingLocation && (
                                        <ThemedText style={styles.emptySectionText}>Esperando ubicación del dispositivo...</ThemedText>
                                    )}
                                </ThemedView>
                            )}

                            {/* Botones: manual (GPS del teléfono) y actualizar con ubicación del dispositivo */}
                            {filterPuestoId && (
                                <ThemedView style={styles.formActionsRow}>
                                    <TouchableOpacity
                                        style={[
                                            styles.formActionButtonHalf,
                                            styles.formActionSecondary,
                                            isUpdating && styles.buttonDisabled,
                                        ]}
                                        onPress={openManualUbicacionModal}
                                        disabled={isUpdating}
                                        activeOpacity={0.85}
                                    >
                                        <Ionicons name="create-outline" size={18} color="#007AFF" />
                                        <ThemedText style={styles.formActionSecondaryText}>Ubicación manual</ThemedText>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[
                                            styles.formActionButtonHalf,
                                            styles.formActionSave,
                                            (isUpdating || !deviceLocation) && styles.buttonDisabled,
                                        ]}
                                        onPress={requestConfirmAndUpdateUbicacion}
                                        disabled={isUpdating || !deviceLocation}
                                        activeOpacity={0.85}
                                    >
                                        {isUpdating ? (
                                            <ActivityIndicator size="small" color="#fff" />
                                        ) : (
                                            <>
                                                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                                                <ThemedText style={styles.formActionSaveText}>Confirmar</ThemedText>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </ThemedView>
                            )}
                            {filterPuestoId && tieneUbicacionGuardada && (
                                <ThemedView style={styles.formActions}>
                                    <TouchableOpacity
                                        style={[styles.formActionButton, styles.formActionDanger, isUpdating && styles.buttonDisabled]}
                                        onPress={requestConfirmClearUbicacion}
                                        disabled={isUpdating}
                                    >
                                        {isUpdating ? (
                                            <ActivityIndicator size="small" color="#fff" />
                                        ) : (
                                            <>
                                                <Ionicons name="trash-outline" size={18} color="#fff" />
                                                <ThemedText style={styles.formActionSaveText}>Eliminar ubicación</ThemedText>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </ThemedView>
                            )}
                        </>
                    )}
                </ThemedView>
            </ScrollView>

            <Modal
                transparent
                visible={manualUbicacionModalVisible}
                animationType="fade"
                onRequestClose={closeManualUbicacionModal}
            >
                <KeyboardAvoidingView
                    style={styles.modalKeyboardRoot}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    <ThemedView style={styles.modalBackdrop}>
                        <ThemedView style={styles.modalCard}>
                            <ThemedView style={styles.modalHeader}>
                                <ThemedText style={styles.modalTitle}>Ubicación manual</ThemedText>
                                <TouchableOpacity
                                    onPress={closeManualUbicacionModal}
                                    style={styles.modalCloseBtn}
                                    activeOpacity={0.85}
                                >
                                    <Ionicons name="close" size={22} color="#000" />
                                </TouchableOpacity>
                            </ThemedView>

                            <ScrollView
                                style={styles.modalBody}
                                contentContainerStyle={styles.modalBodyContent}
                                keyboardShouldPersistTaps="handled"
                            >
                                <ThemedText style={styles.modalHint}>
                                    Introduce latitud y longitud en grados decimales (ej. 14.6349, -90.5069).
                                </ThemedText>

                                <ThemedText style={styles.label}>Latitud</ThemedText>
                                <TextInput
                                    style={styles.modalInput}
                                    value={manualLatText}
                                    onChangeText={setManualLatText}
                                    placeholder="-90 a 90"
                                    placeholderTextColor="#999"
                                    keyboardType={
                                        Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'decimal-pad'
                                    }
                                    autoCorrect={false}
                                    autoCapitalize="none"
                                />

                                <ThemedText style={styles.label}>Longitud</ThemedText>
                                <TextInput
                                    style={styles.modalInput}
                                    value={manualLngText}
                                    onChangeText={setManualLngText}
                                    placeholder="-180 a 180"
                                    placeholderTextColor="#999"
                                    keyboardType={
                                        Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'decimal-pad'
                                    }
                                    autoCorrect={false}
                                    autoCapitalize="none"
                                />

                                <TouchableOpacity
                                    style={[styles.modalConfirmBtn, isUpdating && styles.buttonDisabled]}
                                    onPress={() => void confirmManualUbicacion()}
                                    disabled={isUpdating}
                                    activeOpacity={0.85}
                                >
                                    {isUpdating ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <>
                                            <Ionicons name="checkmark-done-outline" size={18} color="#fff" />
                                            <ThemedText style={styles.formActionSaveText}>Confirmar ubicación</ThemedText>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </ScrollView>
                        </ThemedView>
                    </ThemedView>
                </KeyboardAvoidingView>
            </Modal>

            <AppFooter />
            <SlideMenu
                isVisible={isMenuVisible}
                onClose={() => setIsMenuVisible(false)}
                onHomePress={() => navigation.navigate('Home')}
                currentRoute="PuestoUbicacion"
            />
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    // Estructura/layout (igual que EntregaPuestosScreen)
    container: { flex: 1 },
    scrollView: { flex: 1 },
    scrollContent: { padding: 16 },
    content: { width: '100%', maxWidth: 800, alignSelf: 'center' },

    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    loadingText: { marginTop: 16, fontSize: 16, opacity: 0.7 },

    titleContainer: {
        alignItems: 'center',
        marginBottom: 30,
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
        width: '100%',
    },
    title: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
        gap: 10,
    },
    titleText: {
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        opacity: 0.7,
        textAlign: 'center',
    },

    formCard: { marginTop: 12, backgroundColor: '#fff', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#E0E0E0' },
    formTitle: { fontSize: 18, fontWeight: '800', marginBottom: 10, color: '#000' },
    label: { fontSize: 13, fontWeight: '700', marginTop: 10, color: '#333' },
    pickerContainer: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 8,
        marginBottom: 6,
        backgroundColor: '#fff',
    },
    picker: {
        height: 50,
    },

    infoSection: {
        marginTop: 16,
        marginBottom: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    sectionTitle: { marginTop: 14, fontSize: 15, fontWeight: '800', color: '#007AFF', marginBottom: 10 },
    emptySectionText: {
        fontSize: 13,
        color: '#666666',
        marginTop: 4,
        marginBottom: 4,
    },

    // Cards (igual que EntregaPuestosScreen)
    bitacoraCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    bitTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10, color: '#000' },
    bitLine: { marginBottom: 6, color: '#000' },
    bitLabel: { fontWeight: '700', color: '#333' },
    bitValue: { color: '#000' },

    formActions: { marginTop: 16, flexDirection: 'row', gap: 10, justifyContent: 'flex-end', width: '100%' },
    formActionsRow: {
        marginTop: 16,
        flexDirection: 'row',
        gap: 10,
        alignItems: 'stretch',
        width: '100%',
        justifyContent: 'space-between',
    },
    formActionButton: { flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12, flex: 1, width: '100%' },
    formActionButtonHalf: {
        flex: 1,
        minWidth: 0,
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderRadius: 12,
    },
    formActionSecondary: {
        backgroundColor: '#FFFFFF',
        borderWidth: 2,
        borderColor: '#007AFF',
    },
    formActionSecondaryText: { color: '#007AFF', fontWeight: '800', fontSize: 13 },
    formActionSave: { backgroundColor: '#34C759' },
    formActionDanger: { backgroundColor: '#C62828' },
    formActionSaveText: { color: '#fff', fontWeight: '800' },
    buttonDisabled: {
        opacity: 0.6,
    },

    modalKeyboardRoot: { flex: 1 },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'center',
        padding: 16,
    },
    modalCard: {
        width: '100%',
        maxWidth: 520,
        alignSelf: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        overflow: 'hidden',
        maxHeight: '85%',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    modalTitle: { fontSize: 16, fontWeight: '900', color: '#000' },
    modalCloseBtn: { padding: 6, borderRadius: 18, backgroundColor: '#F2F2F2' },
    modalBody: { maxHeight: 420 },
    modalBodyContent: { padding: 14, paddingBottom: 20 },
    modalHint: { fontSize: 13, color: '#666', marginBottom: 12, lineHeight: 18 },
    modalInput: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: Platform.OS === 'ios' ? 12 : 10,
        fontSize: 16,
        color: '#000',
        marginBottom: 12,
        backgroundColor: '#FAFAFA',
    },
    modalConfirmBtn: {
        marginTop: 8,
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#34C759',
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
});

