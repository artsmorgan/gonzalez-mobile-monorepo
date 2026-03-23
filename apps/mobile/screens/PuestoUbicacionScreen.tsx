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

export default function PuestoUbicacionScreen() {
    const { employee, refreshAccessToken, logout } = useAuth();
    const [isMenuVisible, setIsMenuVisible] = useState(false);
    const navigation = useNavigation<PuestoUbicacionScreenNavigationProp>();

    // Estructura principal
    const [structure, setStructure] = useState<MainStructureTree>([]);
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

    // Estados de carga
    const [isUpdating, setIsUpdating] = useState(false);
    const [submitResponse, setSubmitResponse] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    // IDs de current_marca para inicialización
    const [marcaEmpresaId, setMarcaEmpresaId] = useState<number | null>(null);
    const [marcaClienteId, setMarcaClienteId] = useState<number | null>(null);
    const [marcaDivisionId, setMarcaDivisionId] = useState<number | null>(null);
    const [marcaContratoId, setMarcaContratoId] = useState<number | null>(null);
    const [marcaCorpoId, setMarcaCorpoId] = useState<number | null>(null);
    const [marcaPuestoId, setMarcaPuestoId] = useState<number | null>(null);

    const getConnectionStatus = async (): Promise<boolean> => {
        const networkState = await Network.getNetworkStateAsync();
        return networkState.isConnected && networkState.isInternetReachable ? true : false;
    };

    // Cargar estructura principal desde main-structure
    const fetchMainStructure = useCallback(async () => {
        try {
            setIsStructureLoading(true);
            /*
            const isConnected = await getConnectionStatus();

            if (isConnected) {
                const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
                if (!apiUrl) throw new Error('Server URL not configured');

                const token = await AsyncStorage.getItem('access_token');
                if (!token) {
                    const refreshed = await refreshAccessToken();
                    if (!refreshed) throw new Error('No valid authentication token');
                }

                const response = await authedFetch({
                    url: `${apiUrl}/api/main-structure`,
                    init: {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                            'ngrok-skip-browser-warning': '69420',
                        },
                    },
                    refreshAccessToken,
                    logout,
                });

                if (!response) throw new Error('No response from server');

                const data = await response.json();
                if (data.status && data.structure) {
                    setStructure(data.structure);
                    await AsyncStorage.setItem('main_structure_cache', JSON.stringify(data.structure));
                } else {
                    throw new Error(data.message || 'Error al cargar estructura');
                }
            } else {
                
            }
            */
            // Cargar desde cache
            const cacheStr = await AsyncStorage.getItem('main_structure_cache');
            if (cacheStr) {
                const cached = JSON.parse(cacheStr);
                setStructure(cached);
            } else {
                setStructure([]);
            }
        } catch (error) {
            console.error('Error fetching main structure:', error);
            setStructure([]);
            // Intentar cargar desde cache en caso de error
            try {
                const cacheStr = await AsyncStorage.getItem('main_structure_cache');
                if (cacheStr) {
                    const cached = JSON.parse(cacheStr);
                    setStructure(cached);
                } else {
                    setStructure([]);
                }
            } catch (cacheError) {
                console.error('Error loading from cache:', cacheError);
                setStructure([]);
            }
        } finally {
            setIsStructureLoading(false);
        }
    }, [refreshAccessToken, logout]);

    // Cargar contexto de marca actual
    const loadMarcaContext = useCallback(async () => {
        try {
            const currentMarca = await AsyncStorage.getItem('current_marca');
            if (currentMarca) {
                const marcaData = JSON.parse(currentMarca);
                setMarcaEmpresaId(marcaData.empresa_id || null);
                setMarcaClienteId(marcaData.cliente_id || null);
                setMarcaDivisionId(marcaData.roleDivision?.division?.id || null);
                setMarcaContratoId(marcaData.contrato_id || null);
                setMarcaCorpoId(marcaData.corpo_id || null);
                setMarcaPuestoId(marcaData.puesto_id || null);
            }
        } catch (error) {
            console.error('Error loading marca context:', error);
        }
    }, []);

    // Nodos computados para filtros jerárquicos
    const filterEmpresas = useMemo(() => (Array.isArray(structure) ? structure : []), [structure]);

    const filterClientes = useMemo(() => {
        const empresa = filterEmpresas.find((e: any) => e.id === filterEmpresaId);
        return empresa?.clientes || [];
    }, [filterEmpresas, filterEmpresaId]);

    const filterDivisiones = useMemo(() => {
        const cliente = filterClientes.find((c: any) => c.id === filterClienteId);
        return cliente?.division || [];
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

    // Inicializar filtros con current_marca
    useEffect(() => {
        if (!structure || structure.length === 0) return;
        if (marcaEmpresaId && !filterEmpresaId) setFilterEmpresaId(marcaEmpresaId);
        if (marcaClienteId && !filterClienteId) setFilterClienteId(marcaClienteId);
        if (marcaDivisionId && !filterDivisionId) setFilterDivisionId(marcaDivisionId);
        if (marcaContratoId && !filterContratoId) setFilterContratoId(marcaContratoId);
        if (marcaCorpoId && !filterCorpoId) setFilterCorpoId(marcaCorpoId);
        if (marcaPuestoId && !filterPuestoId) setFilterPuestoId(marcaPuestoId);
    }, [structure, marcaEmpresaId, marcaClienteId, marcaDivisionId, marcaContratoId, marcaCorpoId, marcaPuestoId]);

    // Cargar datos del puesto cuando se selecciona
    useEffect(() => {
        if (filterPuestoId && filterPuestos.length > 0) {
            const puesto = filterPuestos.find((p: any) => p.id === filterPuestoId);
            if (puesto) {
                setPuestoNombre(puesto.nombre || '');
                setPuestoData({
                    lat: puesto.ubicacion?.lat || null,
                    lng: puesto.ubicacion?.lng || null,
                });
            }
        } else {
            setPuestoData(null);
            setPuestoNombre('');
        }
    }, [filterPuestoId, filterPuestos]);

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

    // Actualizar ubicación del puesto
    const updatePuestoUbicacion = useCallback(async () => {
        if (!filterPuestoId) {
            Alert.alert('Error', 'Por favor selecciona un puesto');
            return;
        }

        if (!deviceLocation) {
            Alert.alert('Error', 'Por favor obtén la ubicación del dispositivo primero');
            return;
        }

        try {
            setIsUpdating(true);
            const isConnected = await getConnectionStatus();

            if (isConnected) {
                // Online: llamar directamente a la API
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
                        body: JSON.stringify({
                            latitud: deviceLocation.latitude,
                            longitud: deviceLocation.longitude,
                        }),
                    },
                    refreshAccessToken,
                    logout,
                });

                if (!response) throw new Error('No response from server');

                const data = await response.json();
                if (data.status) {
                    Alert.alert('Éxito', data.message || 'Ubicación del puesto actualizada correctamente');
                    // Actualizar datos locales
                    setPuestoData({
                        lat: String(deviceLocation.latitude),
                        lng: String(deviceLocation.longitude),
                    });
                    // Recargar estructura para obtener datos actualizados
                    await fetchMainStructure();
                } else {
                    Alert.alert('Error', data.message || 'Error al actualizar la ubicación');
                }
            } else {
                // Offline: guardar acción para sincronizar después
                const id_local = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];

                // Eliminar acciones anteriores para este puesto
                const filteredActions = actions.filter(
                    (a: any) => !(a.puesto_id === filterPuestoId && a.type === 'puesto_ubicacion')
                );

                // Agregar nueva acción
                filteredActions.push({
                    id: id_local,
                    puesto_id: filterPuestoId,
                    action: 'update',
                    type: 'puesto_ubicacion',
                    payload: {
                        latitud: deviceLocation.latitude,
                        longitud: deviceLocation.longitude,
                    },
                    synced: false,
                });

                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(filteredActions));

                // Actualizar cache local
                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                const cache = cacheStr ? JSON.parse(cacheStr) : [];
                const updatedCache = cache.filter((item: any) => !(item.puesto_id === filterPuestoId && item.type === 'puesto_ubicacion'));
                updatedCache.push({
                    id_local,
                    puesto_id: filterPuestoId,
                    type: 'puesto_ubicacion',
                    latitud: deviceLocation.latitude,
                    longitud: deviceLocation.longitude,
                    synced: false,
                });
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));

                // Actualizar UI localmente
                setPuestoData({
                    lat: String(deviceLocation.latitude),
                    lng: String(deviceLocation.longitude),
                });

                Alert.alert('Éxito', 'Ubicación guardada localmente. Se sincronizará cuando haya conexión.');
            }
        } catch (error: any) {
            console.error('Error updating puesto ubicacion:', error);
            Alert.alert('Error', error.message || 'No se pudo actualizar la ubicación del puesto');
        } finally {
            setIsUpdating(false);
        }
    }, [filterPuestoId, deviceLocation, fetchMainStructure, refreshAccessToken, logout]);

    // Sincronizar acciones offline cuando se restaura la conexión
    useEffect(() => {
        const handler = async () => {
            const actionsStr = await AsyncStorage.getItem('evaluations_actions');
            if (!actionsStr) return;

            const actions = JSON.parse(actionsStr);
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
                            }),
                        },
                        refreshAccessToken,
                        logout,
                    });

                    if (response) {
                        const data = await response.json();
                        if (data.status) {
                            // Marcar como sincronizado
                            const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.type === 'puesto_ubicacion'));
                            await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));

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
            await fetchMainStructure();
        };

        eventBus.on('connectionRestored', handler);
        return () => {
            eventBus.off('connectionRestored', handler);
        };
    }, [fetchMainStructure, refreshAccessToken, logout]);

    useFocusEffect(
        useCallback(() => {
            loadMarcaContext();
            fetchMainStructure();
        }, [loadMarcaContext, fetchMainStructure])
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
                                            setFilterEmpresaId(value);
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
                                                    setFilterClienteId(value);
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
                                                    setFilterDivisionId(value);
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
                                                    setFilterContratoId(value);
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
                                                    setFilterCorpoId(value);
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
                                                    setFilterPuestoId(value);
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
                                            <ThemedText style={styles.bitValue}>{puestoData.lat || 'No disponible'}</ThemedText>
                                        </ThemedText>
                                        <ThemedText style={styles.bitLine}>
                                            <ThemedText style={styles.bitLabel}>Longitud: </ThemedText>
                                            <ThemedText style={styles.bitValue}>{puestoData.lng || 'No disponible'}</ThemedText>
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

                            {/* Mensaje de respuesta */}
                            {submitResponse && (
                                <ThemedView style={[styles.responseContainer, submitResponse.type === 'success' ? styles.responseSuccess : styles.responseError]}>
                                    <ThemedText style={styles.responseText}>
                                        {submitResponse.type === 'success' ? '✓ ' : '✗ '}
                                        {submitResponse.message}
                                    </ThemedText>
                                </ThemedView>
                            )}

                            {/* Botón para actualizar */}
                            {filterPuestoId && deviceLocation && (
                                <ThemedView style={styles.formActions}>
                                    <TouchableOpacity
                                        style={[styles.formActionButton, styles.formActionSave, isUpdating && styles.buttonDisabled]}
                                        onPress={updatePuestoUbicacion}
                                        disabled={isUpdating}
                                    >
                                        {isUpdating ? (
                                            <ActivityIndicator size="small" color="#fff" />
                                        ) : (
                                            <>
                                                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                                                <ThemedText style={styles.formActionSaveText}>Actualizar Ubicación del Puesto</ThemedText>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </ThemedView>
                            )}
                        </>
                    )}
                </ThemedView>
            </ScrollView>
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
    formActionButton: { flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12, flex: 1, width: '100%' },
    formActionSave: { backgroundColor: '#34C759' },
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
});

