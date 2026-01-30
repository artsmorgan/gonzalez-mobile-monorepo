import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Platform, View, Image, Dimensions, Linking, Modal } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import * as DocumentPicker from 'expo-document-picker';
import * as Location from 'expo-location';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import SignatureScreen from 'react-native-signature-canvas';
import { jwtDecode } from 'jwt-decode';

import AppHeader from '../components/AppHeader';
import AppFooter from '../components/AppFooter';
import SlideMenu from '../components/SlideMenu';
import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import { useAuth } from '../contexts/AuthContext';
import { eventBus } from '../hooks/eventBus';
import { useQRScanner } from '../hooks/useQRScanner';
import { createMovimientoActivoMantenimiento, deleteMovimientoActivoMantenimiento, listMovimientosActivoMantenimiento, MovimientoActivoMantenimientoItem, updateMovimientoActivoMantenimiento } from '../hooks/movimientosActivosMantenimientoFunctions';
import Constants from 'expo-constants';

type ReporteMantenimiento = {
    id: number;
    id_local?: string;
    cliente_id: number;
    corpo_id: number;
    puesto_id: number;
    division: string;
    fecha_reporte: string;
    created_by: number;
    solucionado: boolean;
    cliente?: { id: number; nombre: string };
    corpo?: { id: number; nombre: string };
    puesto?: { id: number; nombre: string; codigo?: string };
    activos?: ActivoMantenimiento[];
};

type ActivoMantenimiento = {
    id: number;
    id_local?: string;
    reporte_id: number;
    articulo_id: number;
    articulo_nombre?: string;
    estado: string;
    cantidad_necesaria: number;
    cantidad_real: number;
    observaciones: string;
    fecha_solucion?: string | null;
    accion?: string | null;
    fecha_inicio?: string | null;
    tipo?: string | null;
    marca?: string | null;
    modelo?: string | null;
    serie_placa?: string | null;
    categoria?: string | null;
    fecha_salida?: string | null;
    fecha_entrada?: string | null;
    kilometraje?: number | null;
    categoria_mantinimiento?: string | null;
    detalle?: string | null;
    numero_fc?: string | null;
    proveedor?: string | null;
    costo_mo?: number | null;
    costo_i?: number | null;
    iva?: number | null;
    costo_total?: number | null;
    fecha_fin?: string | null;
    reincidencia_treinta_dias?: boolean | null;
    archivos?: ActivoFileRemote[];
    movimientos?: MovimientoActivoMantenimientoItem[];
};

type CategoriaMantenimiento = {
    id: number;
    nombre: string;
};

// Función helper para obtener íconos de acciones
const getActionIcon = (action: string) => {
    switch (action) {
        case 'play':
            return <Ionicons name="play" size={24} color="#007AFF" />;
        case 'pause':
            return <Ionicons name="pause" size={24} color="#007AFF" />;
        case 'restart':
            return <Ionicons name="refresh" size={24} color="#FFFFFF" />;
        default:
            return null;
    }
};

// Componente para visualizar archivos del activo
function ActivoFilesViewer({ activoId, files }: { activoId: number; files: ActivoFileRemote[] }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const list = Array.isArray(files) ? files : [];
    if (list.length === 0) return null;

    const imageFiles = list.filter(f => f.type === 'image');
    const audioFiles = list.filter(f => f.type === 'audio');
    const videoFiles = list.filter(f => f.type === 'video');
    const documentFiles = list.filter(f => f.type === 'document' || (!f.type && f.extension));

    const buildFileUrl = (file: ActivoFileRemote) => {
        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) return '';

        if (file.type === 'image') {
            return `${apiUrl}/api/activo-mantenimiento/${activoId}/get-image/${encodeURIComponent(file.name)}`;
        }
        if (file.type === 'audio') {
            return `${apiUrl}/api/activo-mantenimiento/${activoId}/get-audio/${encodeURIComponent(file.name)}`;
        }
        if (file.type === 'video') {
            return `${apiUrl}/api/activo-mantenimiento/${activoId}/get-video/${encodeURIComponent(file.name)}`;
        }
        return `${apiUrl}/api/activo-mantenimiento/${activoId}/get-file/${encodeURIComponent(file.name)}`;
    };

    const getFileDisplayName = (file: ActivoFileRemote) => {
        return file.original_name || file.name;
    };

    return (
        <ThemedView style={styles.collapsableSection}>
            <TouchableOpacity
                style={styles.collapsableHeader}
                onPress={() => setIsExpanded(!isExpanded)}
            >
                <ThemedText style={styles.collapsableHeaderText}>
                    Archivos ({list.length})
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
                                <ActivoImageViewer
                                    key={file.id}
                                    imageUrl={buildFileUrl(file)}
                                />
                            ))}
                        </ThemedView>
                    )}

                    {audioFiles.length > 0 && (
                        <ThemedView style={styles.viewerSection}>
                            <ThemedText style={styles.viewerSectionTitle}>Audios</ThemedText>
                            {audioFiles.map(file => (
                                <ActivoAudioPlayer
                                    key={file.id}
                                    sourceUrl={buildFileUrl(file)}
                                    label={file.original_name || file.name}
                                />
                            ))}
                        </ThemedView>
                    )}

                    {videoFiles.length > 0 && (
                        <ThemedView style={styles.viewerSection}>
                            <ThemedText style={styles.viewerSectionTitle}>Videos</ThemedText>
                            {videoFiles.map(file => (
                                <ActivoVideoPlayer
                                    key={file.id}
                                    sourceUrl={buildFileUrl(file)}
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
                                        const url = buildFileUrl(file);
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

// Audio player para activos
function ActivoAudioPlayer({ sourceUrl, label }: { sourceUrl: string; label?: string }) {
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
                    {getActionIcon(isPlaying ? 'pause' : 'play')}
                </TouchableOpacity>
                <ThemedText style={styles.audioTime}>
                    {formatTime(position)} / {formatTime(duration)}
                </ThemedText>
                <TouchableOpacity
                    style={styles.resetAudioButton}
                    onPress={resetAudio}
                >
                    {getActionIcon('restart')}
                </TouchableOpacity>
            </ThemedView>
        </ThemedView>
    );
}

// Image viewer para activos
function ActivoImageViewer({ imageUrl }: { imageUrl: string }) {
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

// Video player para activos
function ActivoVideoPlayer({ sourceUrl }: { sourceUrl: string }) {
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
                allowsFullscreen={false}
                allowsPictureInPicture={false}
            />
        </View>
    );
}

interface ActivoFileLocal {
    id: string;
    type: 'image' | 'audio' | 'video' | 'document';
    name: string;
    extension: string;
    base64: string;
    uri?: string;
    mimeType?: string;
}

interface ActivoFileRemote {
    id: number;
    type: string;
    extension: string;
    name: string;
    original_name?: string;
    url: string;
    base64?: string;
    mimeType?: string;
    id_local?: string;
    synced?: boolean;
}

export default function MantenimientoEquipoScreen() {
    const navigation = useNavigation<any>();
    const { employee, refreshAccessToken, logout } = useAuth();

    const [isMenuVisible, setIsMenuVisible] = useState(false);
    const handleMenuPress = () => setIsMenuVisible(true);
    const handleMenuClose = () => setIsMenuVisible(false);
    const handleHomePress = () => navigation.navigate('Home');

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasCurrentMarca, setHasCurrentMarca] = useState(true);
    const [marcaId, setMarcaId] = useState<number | null>(null);

    // Estados para estructura jerárquica
    const [structure, setStructure] = useState<any[]>([]);
    const [isStructureLoading, setIsStructureLoading] = useState(false);

    // Estados para filtros
    const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
    const [filterEmpresaId, setFilterEmpresaId] = useState<number | null>(null);
    const [filterClienteId, setFilterClienteId] = useState<number | null>(null);
    const [filterDivisionId, setFilterDivisionId] = useState<number | null>(null);
    const [filterContratoId, setFilterContratoId] = useState<number | null>(null);
    const [filterCorpoId, setFilterCorpoId] = useState<number | null>(null);
    const [filterPuestoId, setFilterPuestoId] = useState<number | null>(null);

    // IDs de current_marca para inicialización
    const [marcaClienteId, setMarcaClienteId] = useState<number | null>(null);
    const [marcaCorpoId, setMarcaCorpoId] = useState<number | null>(null);
    const [marcaPuestoId, setMarcaPuestoId] = useState<number | null>(null);

    const [reportes, setReportes] = useState<ReporteMantenimiento[]>([]);
    const [selectedReporte, setSelectedReporte] = useState<ReporteMantenimiento | null>(null);
    const [activos, setActivos] = useState<ActivoMantenimiento[]>([]);
    const [showActivos, setShowActivos] = useState(false);
    const [selectedActivo, setSelectedActivo] = useState<ActivoMantenimiento | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);

    const [categoriasMantenimiento, setCategoriasMantenimiento] = useState<CategoriaMantenimiento[]>([]);

    // Archivos adjuntos
    const [textFiles, setTextFiles] = useState<ActivoFileLocal[]>([]);
    const [imageFiles, setImageFiles] = useState<ActivoFileLocal[]>([]);
    const [audioFiles, setAudioFiles] = useState<ActivoFileLocal[]>([]);
    const [videoFiles, setVideoFiles] = useState<ActivoFileLocal[]>([]);
    const [activoFiles, setActivoFiles] = useState<ActivoFileRemote[]>([]);

    // Formulario de actualización
    const [fechaSolucion, setFechaSolucion] = useState<Date | null>(null);
    const [showFechaSolucionPicker, setShowFechaSolucionPicker] = useState(false);
    const [accion, setAccion] = useState<string>('');
    const [fechaInicio, setFechaInicio] = useState<Date | null>(null);
    const [showFechaInicioPicker, setShowFechaInicioPicker] = useState(false);
    const [tipo, setTipo] = useState<string>('');
    const [marca, setMarca] = useState<string>('');
    const [modelo, setModelo] = useState<string>('');
    const [seriePlaca, setSeriePlaca] = useState<string>('');
    const [categoria, setCategoria] = useState<string>('');
    const [esVehiculo, setEsVehiculo] = useState<boolean>(false);
    const [kilometraje, setKilometraje] = useState<string>('');
    const [fechaSalida, setFechaSalida] = useState<Date | null>(null);
    const [showFechaSalidaPicker, setShowFechaSalidaPicker] = useState(false);
    const [fechaEntrada, setFechaEntrada] = useState<Date | null>(null);
    const [showFechaEntradaPicker, setShowFechaEntradaPicker] = useState(false);
    const [categoriaMantenimiento, setCategoriaMantenimiento] = useState<string>('');
    const [detalle, setDetalle] = useState<string>('');
    const [numeroFc, setNumeroFc] = useState<string>('');
    const [proveedor, setProveedor] = useState<string>('');
    const [costoMo, setCostoMo] = useState<string>('');
    const [costoI, setCostoI] = useState<string>('');
    const [iva, setIva] = useState<string>('');
    const [costoTotal, setCostoTotal] = useState<string>('');
    const [fechaFin, setFechaFin] = useState<Date | null>(null);
    const [showFechaFinPicker, setShowFechaFinPicker] = useState(false);
    const [reincidenciaTreintaDias, setReincidenciaTreintaDias] = useState<boolean>(false);
    const [marcarComoResuelto, setMarcarComoResuelto] = useState<boolean>(false);

    // Submódulo: Movimiento de activos (CRUD dentro de modal)
    const { scanQR, QRScannerComponent } = useQRScanner();
    const [isMovModalVisible, setIsMovModalVisible] = useState(false);
    const [movActivo, setMovActivo] = useState<ActivoMantenimiento | null>(null);
    const [movimientos, setMovimientos] = useState<MovimientoActivoMantenimientoItem[]>([]);
    const [movIsCreating, setMovIsCreating] = useState(false);
    const [movEditing, setMovEditing] = useState<MovimientoActivoMantenimientoItem | null>(null);

    const [movFilterSearch, setMovFilterSearch] = useState('');
    const [movFilterFecha, setMovFilterFecha] = useState('');
    const [showMovFilterFechaPicker, setShowMovFilterFechaPicker] = useState(false);
    const [isMovFiltersExpanded, setIsMovFiltersExpanded] = useState(false);

    const [movNombreRecibe, setMovNombreRecibe] = useState('');
    const [movNombreEntrega, setMovNombreEntrega] = useState('');
    const [movDepartamento, setMovDepartamento] = useState('');
    const [movTelefono, setMovTelefono] = useState('');
    const [movEntrega, setMovEntrega] = useState('');
    const [movRecibe, setMovRecibe] = useState('');
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
    const [location, setLocation] = useState<Location.LocationObject | null>(null);

    const dateToLocalString = (d: Date | null): string => {
        if (!d) return '';
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    const dateTimeToLocalString = (d: Date | string | null): string => {
        if (!d) return '';
        const date = typeof d === 'string' ? new Date(d) : d;
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hh = String(date.getHours()).padStart(2, '0');
        const mm = String(date.getMinutes()).padStart(2, '0');
        return `${y}-${m}-${day} ${hh}:${mm}`;
    };

    const timeToHHMMSS = (d: Date): string => {
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        const ss = String(d.getSeconds()).padStart(2, '0');
        return `${hh}:${mm}:${ss}`;
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

    const getConnectionStatus = async (): Promise<boolean> => {
        const state = await Network.getNetworkStateAsync();
        return !!(state.isConnected && state.isInternetReachable);
    };

    const loadMarcaContext = async () => {
        const currentMarcaStr = await AsyncStorage.getItem('current_marca');
        if (!currentMarcaStr) {
            setHasCurrentMarca(false);
            setMarcaClienteId(null);
            setMarcaCorpoId(null);
            setMarcaPuestoId(null);
            return null;
        }
        const current = JSON.parse(currentMarcaStr);
        if (!current?.id) {
            setHasCurrentMarca(false);
            setMarcaClienteId(null);
            setMarcaCorpoId(null);
            setMarcaPuestoId(null);
            return null;
        }
        setHasCurrentMarca(true);
        setMarcaId(current.id);

        // Obtener IDs de cliente, corpo y puesto de current_marca
        const clienteIdRaw = current?.cliente?.id ?? current?.cliente_id;
        const corpoIdRaw = current?.corpo?.id ?? current?.corpo_id;
        const puestoIdRaw = current?.puesto?.id ?? current?.puesto_id;

        setMarcaClienteId(clienteIdRaw !== undefined && clienteIdRaw !== null ? Number(clienteIdRaw) : null);
        setMarcaCorpoId(corpoIdRaw !== undefined && corpoIdRaw !== null ? Number(corpoIdRaw) : null);
        setMarcaPuestoId(puestoIdRaw !== undefined && puestoIdRaw !== null ? Number(puestoIdRaw) : null);

        return current;
    };

    const fetchMainStructure = useCallback(async () => {
        setIsStructureLoading(true);
        try {
            const cacheStr = await AsyncStorage.getItem('main_structure_cache');
            if (cacheStr) {
                try {
                    const parsed = JSON.parse(cacheStr);
                    if (Array.isArray(parsed)) setStructure(parsed);
                } catch {
                    // ignore
                }
            }

            const isConnected = await getConnectionStatus();
            if (!isConnected) return;

            const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
            if (!apiUrl) return;

            let token = await AsyncStorage.getItem('access_token');
            if (!token) {
                const refreshed = await refreshAccessToken();
                if (!refreshed) {
                    if (logout) await logout();
                    throw new Error('Sesión expirada');
                }
                token = await AsyncStorage.getItem('access_token');
            }

            const response = await fetch(`${apiUrl}/api/main-structure`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': '69420',
                },
            });

            if (response.status === 401) {
                const refreshed = await refreshAccessToken();
                if (refreshed) return fetchMainStructure();
                await logout();
                return;
            }

            if (response.status === 403) {
                if (logout) await logout();
                throw new Error('Acceso denegado');
            }

            if (response.ok) {
                const data = await response.json();
                if (data.status && Array.isArray(data.structure)) {
                    setStructure(data.structure);
                    await AsyncStorage.setItem('main_structure_cache', JSON.stringify(data.structure));
                }
            }
        } catch (error) {
            console.error('Error fetching main structure:', error);
        } finally {
            setIsStructureLoading(false);
        }
    }, [refreshAccessToken, logout]);

    // Nodos computados para estructura jerárquica de filtros
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

    const fetchCategoriasMantenimiento = async () => {
        try {
            const isConnected = await getConnectionStatus();
            if (isConnected) {
                const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
                if (!apiUrl) return;

                let token = await AsyncStorage.getItem('access_token');
                if (!token) {
                    const refreshed = await refreshAccessToken();
                    if (!refreshed) return;
                    token = await AsyncStorage.getItem('access_token');
                }

                const response = await fetch(`${apiUrl}/api/categoria-mantenimiento`, {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'ngrok-skip-browser-warning': '69420',
                    },
                });

                if (response.status === 401) {
                    const refreshed = await refreshAccessToken();
                    if (refreshed) {
                        return fetchCategoriasMantenimiento();
                    } else {
                        if (logout) await logout();
                        return;
                    }
                }

                if (response.ok) {
                    const data = await response.json();
                    if (data.status && data.categorias) {
                        setCategoriasMantenimiento(data.categorias);
                        await AsyncStorage.setItem('categoria_mantenimiento_cache', JSON.stringify(data.categorias));
                    }
                }
            } else {
                const cacheStr = await AsyncStorage.getItem('categoria_mantenimiento_cache');
                if (cacheStr) {
                    setCategoriasMantenimiento(JSON.parse(cacheStr));
                }
            }
        } catch (error) {
            console.error('Error fetching categorias mantenimiento:', error);
            const cacheStr = await AsyncStorage.getItem('categoria_mantenimiento_cache');
            if (cacheStr) {
                setCategoriasMantenimiento(JSON.parse(cacheStr));
            }
        }
    };

    const fetchReportes = async () => {
        try {
            setIsLoading(true);
            setError(null);

            const isConnected = await getConnectionStatus();
            if (isConnected) {
                const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
                if (!apiUrl) {
                    throw new Error('Server URL not configured');
                }

                let token = await AsyncStorage.getItem('access_token');
                if (!token) {
                    const refreshed = await refreshAccessToken();
                    if (!refreshed) {
                        setError('No se pudo autenticar');
                        setIsLoading(false);
                        if (logout) await logout();
                        return;
                    }
                    token = await AsyncStorage.getItem('access_token');
                }

                // Construir parámetros de filtro (jerarquía completa)
                const params = new URLSearchParams();
                if (filterEmpresaId) params.append('empresa_id', String(filterEmpresaId));
                if (filterClienteId) params.append('cliente_id', String(filterClienteId));
                if (filterDivisionId) params.append('division_id', String(filterDivisionId));
                if (filterContratoId) params.append('contrato_id', String(filterContratoId));
                if (filterCorpoId) params.append('corpo_id', String(filterCorpoId));
                if (filterPuestoId) params.append('puesto_id', String(filterPuestoId));

                const response = await fetch(`${apiUrl}/api/reporte-articulo-mantenimiento?${params.toString()}`, {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'ngrok-skip-browser-warning': '69420',
                    },
                });

                if (response.status === 401) {
                    const refreshed = await refreshAccessToken();
                    if (refreshed) {
                        return fetchReportes();
                    } else {
                        if (logout) await logout();
                        return;
                    }
                }

                if (response.status === 403) {
                    if (logout) await logout();
                    throw new Error('Acceso denegado');
                }

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                if (data.status && data.data) {
                    const list = (data.data || []).map((it: any) => ({
                        ...it,
                        id_local: it.id_local || '',
                        activos: (it.activos || []).map((a: any) => ({ ...a, id_local: a.id_local || '' })),
                    }));
                    setReportes(list);
                    await AsyncStorage.setItem('reporte_mantenimiento_cache', JSON.stringify(list));
                } else {
                    setError(data.message || 'Error al cargar reportes');
                    const cacheStr = await AsyncStorage.getItem('reporte_mantenimiento_cache');
                    if (cacheStr) setReportes(JSON.parse(cacheStr));
                }
            } else {
                const cacheStr = await AsyncStorage.getItem('reporte_mantenimiento_cache');
                if (cacheStr) setReportes(JSON.parse(cacheStr));
            }
        } catch (e: any) {
            setError(e.message || 'Error al cargar reportes');
            const cacheStr = await AsyncStorage.getItem('reporte_mantenimiento_cache');
            if (cacheStr) setReportes(JSON.parse(cacheStr));
        } finally {
            setIsLoading(false);
        }
    };

    const fetchActivos = async (reporteId: number) => {
        try {
            setIsLoading(true);
            const isConnected = await getConnectionStatus();
            if (isConnected) {
                const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
                if (!apiUrl) {
                    throw new Error('Server URL not configured');
                }

                let token = await AsyncStorage.getItem('access_token');
                if (!token) {
                    const refreshed = await refreshAccessToken();
                    if (!refreshed) return;
                    token = await AsyncStorage.getItem('access_token');
                }

                const response = await fetch(`${apiUrl}/api/reporte-articulo-mantenimiento/${reporteId}/activos`, {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'ngrok-skip-browser-warning': '69420',
                    },
                });

                if (response.status === 401) {
                    const refreshed = await refreshAccessToken();
                    if (refreshed) {
                        return fetchActivos(reporteId);
                    } else {
                        if (logout) await logout();
                        return;
                    }
                }

                if (response.ok) {
                    const data = await response.json();
                    if (data.status && data.data) {
                        const list = (data.data || []).map((it: any) => ({
                            ...it,
                            id_local: it.id_local || '',
                        }));
                        setActivos(list);
                        await AsyncStorage.setItem(`activos_mantenimiento_${reporteId}_cache`, JSON.stringify(list));
                    }
                }
            } else {
                const cacheStr = await AsyncStorage.getItem(`activos_mantenimiento_${reporteId}_cache`);
                if (cacheStr) {
                    setActivos(JSON.parse(cacheStr));
                } else if (selectedReporte?.activos) {
                    setActivos(selectedReporte.activos);
                }
            }
        } catch (e: any) {
            console.error('Error fetching activos:', e);
            const cacheStr = await AsyncStorage.getItem(`activos_mantenimiento_${reporteId}_cache`);
            if (cacheStr) {
                setActivos(JSON.parse(cacheStr));
            } else if (selectedReporte?.activos) {
                setActivos(selectedReporte.activos);
            }
        } finally {
            setIsLoading(false);
        }
    };

    // Inicializar filtros desde current_marca al cargar
    useFocusEffect(
        useCallback(() => {
            (async () => {
                const current = await loadMarcaContext();
                await fetchMainStructure();
                // Inicializar filtros con valores de current_marca después de cargar
                if (current) {
                    const clienteIdRaw = current?.cliente?.id ?? current?.cliente_id;
                    const corpoIdRaw = current?.corpo?.id ?? current?.corpo_id;
                    const puestoIdRaw = current?.puesto?.id ?? current?.puesto_id;

                    if (clienteIdRaw !== undefined && clienteIdRaw !== null) {
                        setFilterClienteId(Number(clienteIdRaw));
                    }
                    if (corpoIdRaw !== undefined && corpoIdRaw !== null) {
                        setFilterCorpoId(Number(corpoIdRaw));
                    }
                    if (puestoIdRaw !== undefined && puestoIdRaw !== null) {
                        setFilterPuestoId(Number(puestoIdRaw));
                    }
                }
            })();
        }, [])
    );

    // Recargar reportes cuando cambian los filtros de cualquier nivel de la jerarquía
    useEffect(() => {
        fetchReportes();
    }, [filterEmpresaId, filterClienteId, filterDivisionId, filterContratoId, filterCorpoId, filterPuestoId]);

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
            fetchCategoriasMantenimiento();
        }, [])
    );

    useEffect(() => {
        const handler = () => {
            fetchReportes();
            fetchCategoriasMantenimiento();
        };
        eventBus.on('connectionRestored', handler);
        return () => {
            eventBus.off('connectionRestored', handler);
        };
    }, []);

    const handleVerActivos = (reporte: ReporteMantenimiento) => {
        setSelectedReporte(reporte);
        setShowActivos(true);
        fetchActivos(reporte.id);
    };

    const handleVolverReportes = () => {
        setShowActivos(false);
        setSelectedReporte(null);
        setActivos([]);
        setSelectedActivo(null);
        setIsUpdating(false);
        resetForm();
    };

    const handleActualizar = (activo: ActivoMantenimiento) => {
        setSelectedActivo(activo);
        setIsUpdating(true);
        setShowActivos(false);

        // Cargar datos del activo en el formulario
        setFechaSolucion(activo.fecha_solucion ? new Date(activo.fecha_solucion) : null);
        setAccion(activo.accion || '');
        setFechaInicio(activo.fecha_inicio ? new Date(activo.fecha_inicio) : null);
        setTipo(activo.tipo || '');
        setMarca(activo.marca || '');
        setModelo(activo.modelo || '');
        setSeriePlaca(activo.serie_placa || '');
        setCategoria(activo.categoria || '');
        setEsVehiculo(!!activo.kilometraje);
        setKilometraje(activo.kilometraje ? String(activo.kilometraje) : '');
        setFechaSalida(activo.fecha_salida ? new Date(activo.fecha_salida) : null);
        setFechaEntrada(activo.fecha_entrada ? new Date(activo.fecha_entrada) : null);
        setCategoriaMantenimiento(activo.categoria_mantinimiento || '');
        setDetalle(activo.detalle || '');
        setNumeroFc(activo.numero_fc || '');
        setProveedor(activo.proveedor || '');
        setCostoMo(activo.costo_mo ? String(activo.costo_mo) : '');
        setCostoI(activo.costo_i ? String(activo.costo_i) : '');
        setIva(activo.iva ? String(activo.iva) : '');
        setCostoTotal(activo.costo_total ? String(activo.costo_total) : '');
        setFechaFin(activo.fecha_fin ? new Date(activo.fecha_fin) : null);
        setReincidenciaTreintaDias(activo.reincidencia_treinta_dias || false);
        setMarcarComoResuelto(false);

        // Cargar archivos existentes del activo
        if (activo.archivos && activo.archivos.length > 0) {
            setActivoFiles(activo.archivos);
        } else {
            setActivoFiles([]);
        }
    };

    const resetForm = () => {
        setFechaSolucion(null);
        setAccion('');
        setFechaInicio(null);
        setTipo('');
        setMarca('');
        setModelo('');
        setSeriePlaca('');
        setCategoria('');
        setEsVehiculo(false);
        setKilometraje('');
        setFechaSalida(null);
        setFechaEntrada(null);
        setCategoriaMantenimiento('');
        setDetalle('');
        setNumeroFc('');
        setProveedor('');
        setCostoMo('');
        setCostoI('');
        setIva('');
        setCostoTotal('');
        setFechaFin(null);
        setReincidenciaTreintaDias(false);
        setMarcarComoResuelto(false);
        setTextFiles([]);
        setImageFiles([]);
        setAudioFiles([]);
        setVideoFiles([]);
    };

    const cancelUpdating = () => {
        setIsUpdating(false);
        setSelectedActivo(null);
        setShowActivos(true);
        resetForm();
    };

    const generateRandomId = () => {
        return `local_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    };

    const handleAddFile = async (type: ActivoFileLocal['type']) => {
        try {
            let pickerTypes: string | string[] | undefined;

            switch (type) {
                case 'image':
                    pickerTypes = ['image/*'];
                    break;
                case 'audio':
                    pickerTypes = ['audio/*'];
                    break;
                case 'video':
                    pickerTypes = ['video/*'];
                    break;
                case 'document':
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
                default:
                    pickerTypes = [
                        'application/pdf',
                        'application/msword',
                        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                        'text/plain',
                    ];
                    break;
            }

            const result = await DocumentPicker.getDocumentAsync({
                type: pickerTypes,
                multiple: false,
                copyToCacheDirectory: true,
            });

            if (result.canceled || !result.assets || result.assets.length === 0) {
                return;
            }

            const asset = result.assets[0];
            const response = await fetch(asset.uri);
            const blob = await response.blob();

            // Convertir blob a base64
            const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const result = reader.result;
                    if (typeof result === 'string') {
                        const parts = result.split(',');
                        resolve(parts.length > 1 ? parts[1] : parts[0]);
                    } else {
                        reject(new Error('No se pudo leer el archivo seleccionado'));
                    }
                };
                reader.onerror = () => {
                    reject(reader.error ?? new Error('Error al leer el archivo seleccionado'));
                };
                reader.readAsDataURL(blob);
            });

            let extension = '';
            if (asset.name && asset.name.includes('.')) {
                extension = asset.name.split('.').pop() || '';
            } else if (asset.mimeType && asset.mimeType.includes('/')) {
                extension = asset.mimeType.split('/').pop() || '';
            }

            const localId = `local_file_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

            const newFile: ActivoFileLocal = {
                id: localId,
                type,
                name: asset.name || `archivo.${extension || 'dat'}`,
                extension: extension || 'dat',
                base64,
                uri: asset.uri,
                mimeType: asset.mimeType,
            };

            if (type === 'image') {
                setImageFiles(prev => [...prev, newFile]);
            } else if (type === 'audio') {
                setAudioFiles(prev => [...prev, newFile]);
            } else if (type === 'video') {
                setVideoFiles(prev => [...prev, newFile]);
            } else {
                setTextFiles(prev => [...prev, newFile]);
            }
        } catch (error) {
            console.error('Error picking file:', error);
            Alert.alert('Error', 'No se pudo seleccionar el archivo. Intenta nuevamente.');
        }
    };

    const removeLocalFile = (type: ActivoFileLocal['type'], id: string) => {
        if (type === 'image') {
            setImageFiles(prev => prev.filter(f => f.id !== id));
        } else if (type === 'audio') {
            setAudioFiles(prev => prev.filter(f => f.id !== id));
        } else if (type === 'video') {
            setVideoFiles(prev => prev.filter(f => f.id !== id));
        } else {
            setTextFiles(prev => prev.filter(f => f.id !== id));
        }
    };

    const getActivoImageUrl = (activoId: number, fileName: string) => {
        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) return '';
        return `${apiUrl}/api/activo-mantenimiento/${activoId}/get-image/${encodeURIComponent(fileName)}`;
    };

    const getActivoAudioUrl = (activoId: number, fileName: string) => {
        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) return '';
        return `${apiUrl}/api/activo-mantenimiento/${activoId}/get-audio/${encodeURIComponent(fileName)}`;
    };

    const getActivoVideoUrl = (activoId: number, fileName: string) => {
        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) return '';
        return `${apiUrl}/api/activo-mantenimiento/${activoId}/get-video/${encodeURIComponent(fileName)}`;
    };

    const buildFileUrl = (activoId: number | undefined, file: ActivoFileRemote) => {
        const hasLocalId = file.id_local !== undefined && file.id_local !== null && file.id_local !== '';
        if (hasLocalId && file.base64) {
            const mime = file.mimeType || (file.type ? `${file.type}/${file.extension || 'octet-stream'}` : `application/${file.extension || 'octet-stream'}`);
            return `data:${mime};base64,${file.base64}`;
        }

        if (activoId) {
            if (file.type === 'image') return getActivoImageUrl(activoId, file.name);
            if (file.type === 'audio') return getActivoAudioUrl(activoId, file.name);
            if (file.type === 'video') return getActivoVideoUrl(activoId, file.name);
            const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
            if (apiUrl) return `${apiUrl}/api/activo-mantenimiento/${activoId}/get-file/${encodeURIComponent(file.name)}`;
        }

        if (file.url) return file.url;
        return '';
    };

    const handleSave = async () => {
        if (!selectedActivo) return;

        const isConnected = await getConnectionStatus();
        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) {
            Alert.alert('Error', 'Server URL not configured');
            return;
        }

        const filesPayload: ActivoFileLocal[] = [
            ...textFiles,
            ...imageFiles,
            ...audioFiles,
            ...videoFiles,
        ];

        const requestData: any = {
            fecha_solucion: fechaSolucion ? fechaSolucion.toISOString() : null,
            accion: accion || null,
            fecha_inicio: fechaInicio ? fechaInicio.toISOString() : null,
            tipo: tipo || null,
            marca: marca || null,
            modelo: modelo || null,
            serie_placa: seriePlaca || null,
            categoria: categoria || null,
            kilometraje: esVehiculo && kilometraje ? parseInt(kilometraje) : null,
            fecha_salida: accion === 'Reparar en taller' && fechaSalida ? fechaSalida.toISOString() : null,
            fecha_entrada: accion === 'Reparar en taller' && fechaEntrada ? fechaEntrada.toISOString() : null,
            categoria_mantinimiento: categoriaMantenimiento || null,
            detalle: detalle || null,
            numero_fc: numeroFc || null,
            proveedor: proveedor || null,
            costo_mo: costoMo ? parseInt(costoMo) : null,
            costo_i: costoI ? parseInt(costoI) : null,
            iva: iva ? parseInt(iva) : null,
            costo_total: costoTotal ? parseInt(costoTotal) : null,
            fecha_fin: fechaFin ? fechaFin.toISOString() : null,
            reincidencia_treinta_dias: reincidenciaTreintaDias,
            marcar_como_resuelto: marcarComoResuelto,
            files: filesPayload.length > 0 ? JSON.stringify(
                filesPayload.map(f => ({
                    type: f.type,
                    original_name: f.name,
                    extension: f.extension,
                    file_base64: f.base64,
                }))
            ) : null,
        };

        if (isConnected) {
            try {
                let token = await AsyncStorage.getItem('access_token');
                if (!token) {
                    const refreshed = await refreshAccessToken();
                    if (!refreshed) {
                        Alert.alert('Error', 'No se pudo autenticar');
                        if (logout) await logout();
                        return;
                    }
                    token = await AsyncStorage.getItem('access_token');
                }

                const response = await fetch(`${apiUrl}/api/activo-mantenimiento/${selectedActivo.id}`, {
                    method: 'PUT',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'ngrok-skip-browser-warning': '69420',
                    },
                    body: JSON.stringify(requestData),
                });

                if (response.status === 401) {
                    const refreshed = await refreshAccessToken();
                    if (refreshed) {
                        return handleSave();
                    } else {
                        if (logout) await logout();
                        return;
                    }
                }

                if (response.ok) {
                    const data = await response.json();
                    if (data.status) {
                        Alert.alert('Éxito', 'Activo actualizado correctamente');
                        setIsUpdating(false);
                        setSelectedActivo(null);
                        setShowActivos(true);
                        resetForm();
                        if (selectedReporte) {
                            await fetchActivos(selectedReporte.id);
                        }
                        await fetchReportes();
                    } else {
                        Alert.alert('Error', data.message || 'No se pudo actualizar el activo');
                    }
                } else {
                    Alert.alert('Error', 'No se pudo actualizar el activo');
                }
            } catch (error: any) {
                Alert.alert('Error', error.message || 'No se pudo actualizar el activo');
            }
        } else {
            // Modo offline
            const localId = selectedActivo.id_local || generateRandomId();
            const actionsStr = await AsyncStorage.getItem('activo_mantenimiento_actions');
            const actions = actionsStr ? JSON.parse(actionsStr) : [];
            actions.push({
                type: 'update',
                id: selectedActivo.id,
                id_local: localId,
                reporteId: selectedReporte?.id,
                requestData,
            });
            await AsyncStorage.setItem('activo_mantenimiento_actions', JSON.stringify(actions));

            // Actualizar cache
            const updatedActivos = activos.map((a) =>
                a.id === selectedActivo.id ? { ...a, ...requestData, id_local: localId } : a
            );
            setActivos(updatedActivos);
            if (selectedReporte) {
                await AsyncStorage.setItem(`activos_mantenimiento_${selectedReporte.id}_cache`, JSON.stringify(updatedActivos));
            }

            Alert.alert('Guardado (offline)', 'Los cambios se sincronizarán cuando vuelva la conexión.');
            setIsUpdating(false);
            setSelectedActivo(null);
            setShowActivos(true);
            resetForm();
        }
    };

    const renderReporte = (reporte: ReporteMantenimiento) => {
        const fecha = reporte.fecha_reporte ? String(reporte.fecha_reporte).split('T')[0] : '';
        return (
            <ThemedView key={reporte.id} style={styles.bitacoraCard}>
                <ThemedText style={styles.bitTitle}>
                    Reporte #{reporte.id} - {reporte.division}
                    {reporte.id_local ? ' (offline)' : ''}
                </ThemedText>
                <ThemedText style={styles.bitLine}>
                    <ThemedText style={styles.bitLabel}>Cliente: </ThemedText>
                    <ThemedText style={styles.bitValue}>{reporte.cliente?.nombre || '-'}</ThemedText>
                </ThemedText>
                <ThemedText style={styles.bitLine}>
                    <ThemedText style={styles.bitLabel}>Sucursal: </ThemedText>
                    <ThemedText style={styles.bitValue}>{reporte.corpo?.nombre || '-'}</ThemedText>
                </ThemedText>
                <ThemedText style={styles.bitLine}>
                    <ThemedText style={styles.bitLabel}>Puesto: </ThemedText>
                    <ThemedText style={styles.bitValue}>{reporte.puesto?.nombre || '-'}</ThemedText>
                </ThemedText>
                <ThemedText style={styles.bitLine}>
                    <ThemedText style={styles.bitLabel}>Fecha: </ThemedText>
                    <ThemedText style={styles.bitValue}>{fecha}</ThemedText>
                </ThemedText>
                <ThemedText style={styles.bitLine}>
                    <ThemedText style={styles.bitLabel}>Estado: </ThemedText>
                    <ThemedText style={styles.bitValue}>{reporte.solucionado ? 'Solucionado' : 'Pendiente'}</ThemedText>
                </ThemedText>
                <TouchableOpacity
                    style={[styles.listItemButton, styles.viewButton]}
                    onPress={() => handleVerActivos(reporte)}
                >
                    <Ionicons name="eye" size={18} color="#FFFFFF" />
                    <ThemedText style={styles.listItemButtonText}>Ver activos</ThemedText>
                </TouchableOpacity>
            </ThemedView>
        );
    };

    const formatFechaSolucion = (fecha: string | null | undefined) => {
        if (!fecha) return null;
        try {
            const date = new Date(fecha);
            const day = date.getDate().toString().padStart(2, '0');
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const year = date.getFullYear();
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            return `${day}/${month}/${year} ${hours}:${minutes}`;
        } catch {
            return fecha;
        }
    };

    const renderActivo = (activo: ActivoMantenimiento) => {
        const archivos = activo.archivos || [];
        const isSolucionado = activo.fecha_solucion !== null && activo.fecha_solucion !== undefined;
        const fechaFormateada = formatFechaSolucion(activo.fecha_solucion);

        return (
            <ThemedView key={activo.id} style={styles.bitacoraCard}>
                <ThemedView style={styles.activoHeader}>
                    <ThemedText style={styles.bitTitle}>
                        {activo.articulo_nombre || 'Artículo desconocido'}
                        {activo.id_local ? ' (offline)' : ''}
                    </ThemedText>
                    <ThemedView style={[
                        styles.solucionBadge,
                        isSolucionado ? styles.solucionBadgeResuelto : styles.solucionBadgePendiente
                    ]}>
                        <ThemedText style={styles.solucionBadgeText}>
                            {isSolucionado ? `Solucionado el ${fechaFormateada}` : 'Sin solucionar'}
                        </ThemedText>
                    </ThemedView>
                </ThemedView>
                <ThemedText style={styles.bitLine}>
                    <ThemedText style={styles.bitLabel}>Estado: </ThemedText>
                    <ThemedText style={styles.bitValue}>{activo.estado}</ThemedText>
                </ThemedText>
                <ThemedText style={styles.bitLine}>
                    <ThemedText style={styles.bitLabel}>Cantidad necesaria: </ThemedText>
                    <ThemedText style={styles.bitValue}>{activo.cantidad_necesaria}</ThemedText>
                </ThemedText>
                <ThemedText style={styles.bitLine}>
                    <ThemedText style={styles.bitLabel}>Cantidad real: </ThemedText>
                    <ThemedText style={styles.bitValue}>{activo.cantidad_real}</ThemedText>
                </ThemedText>
                <ThemedText style={styles.bitLine}>
                    <ThemedText style={styles.bitLabel}>Observaciones: </ThemedText>
                    <ThemedText style={styles.bitValue}>{activo.observaciones || '-'}</ThemedText>
                </ThemedText>

                {archivos.length > 0 && (
                    <ActivoFilesViewer activoId={activo.id} files={archivos} />
                )}

                <ThemedView style={styles.listItemButtons}>
                    <TouchableOpacity
                        style={[styles.listItemButton, styles.editButtonActivo]}
                        onPress={() => handleActualizar(activo)}
                    >
                        <Ionicons name="pencil" size={18} color="#FFFFFF" />
                        <ThemedText style={styles.listItemButtonText}>Actualizar</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.listItemButton, styles.movementsButton]}
                        onPress={() => openMovimientosModal(activo)}
                    >
                        <Ionicons name="repeat" size={18} color="#FFFFFF" />
                        <ThemedText style={styles.listItemButtonText}>Movimientos</ThemedText>
                    </TouchableOpacity>
                </ThemedView>
            </ThemedView>
        );
    };

    // Movimiento de activos (offline + CRUD en modal)
    // ============================
    const resetMovForm = () => {
        setMovNombreRecibe('');
        setMovNombreEntrega('');
        setMovDepartamento('');
        setMovTelefono('');
        setMovEntrega('');
        setMovRecibe('');
        setMovFecha('');
        setMovHora('');
        setMovFirmaEntrega('');
        setMovFirmaRecibe('');
        setMovFirmaResponsable('');
        setMovEditing(null);
    };

    const upsertMovAction = async (action: any) => {
        const actionsStr = await AsyncStorage.getItem('movimientos_activos_mantenimiento_actions');
        const actions = actionsStr ? JSON.parse(actionsStr) : [];
        actions.push(action);
        await AsyncStorage.setItem('movimientos_activos_mantenimiento_actions', JSON.stringify(actions));
    };

    const removeMovActionsForLocalId = async (localId: string) => {
        const actionsStr = await AsyncStorage.getItem('movimientos_activos_mantenimiento_actions');
        if (!actionsStr) return;
        const actions = JSON.parse(actionsStr) || [];
        const updated = actions.filter((a: any) => a.id !== localId);
        await AsyncStorage.setItem('movimientos_activos_mantenimiento_actions', JSON.stringify(updated));
    };

    const updateMovCreateActionForLocalId = async (localId: string, requestData: any) => {
        const actionsStr = await AsyncStorage.getItem('movimientos_activos_mantenimiento_actions');
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
            await AsyncStorage.setItem('movimientos_activos_mantenimiento_actions', JSON.stringify(updated));
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
            { label: 'Entrega', v: movEntrega },
            { label: 'Recibe', v: movRecibe },
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
            entrega: movEntrega,
            recibe: movRecibe,
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
            const getHoraAccion = async () => {
                const now = new Date();
                return now.toISOString();
            };
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

    const openMovimientosModal = async (activo: ActivoMantenimiento) => {
        setMovActivo(activo);
        const current = await loadMarcaContext();
        if (!current?.id) {
            Alert.alert('Error', 'Marca no encontrada');
            return;
        }

        const isConnected = await getConnectionStatus();
        if (isConnected && activo.id && activo.id !== 0) {
            const res = await listMovimientosActivoMantenimiento({
                activoId: activo.id,
                marcaId: current.id,
                refreshAccessToken,
                logout,
            });
            if (res.status && res.data) {
                const list = res.data.map((m: any) => ({ ...m, id_local: m.id_local || '' }));
                setMovimientos(list);
            } else {
                setMovimientos([]);
            }
        } else {
            // Cargar desde cache si existe
            const cacheStr = await AsyncStorage.getItem(`movimientos_activo_${activo.id}_cache`);
            if (cacheStr) {
                const cached = JSON.parse(cacheStr);
                setMovimientos(cached.map((m: any) => ({ ...m, id_local: m.id_local || '' })));
            } else {
                setMovimientos([]);
            }
        }

        setMovIsCreating(false);
        setMovEditing(null);
        resetMovForm();
        setMovFilterSearch('');
        setMovFilterFecha('');
        setIsMovModalVisible(true);
    };

    const closeMovimientosModal = () => {
        setIsMovModalVisible(false);
        setMovActivo(null);
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

    const startMovEditing = (m: MovimientoActivoMantenimientoItem) => {
        setMovEditing(m);
        setMovIsCreating(true);
        setMovNombreRecibe(m.nombre_persona_recibe || '');
        setMovNombreEntrega(m.nombre_persona_entrega || '');
        setMovDepartamento(m.departamento || '');
        setMovTelefono(m.telefono || '');
        setMovEntrega(m.entrega || '');
        setMovRecibe(m.recibe || '');
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

    const persistMovimientosToActivosCache = async (activo: ActivoMantenimiento, nextMovs: MovimientoActivoMantenimientoItem[]) => {
        const nextActivos = activos.map((it) => {
            const match = (activo.id_local && it.id_local === activo.id_local) || (!activo.id_local && it.id === activo.id);
            if (!match) return it;
            return { ...it, movimientos: nextMovs };
        });
        setActivos(nextActivos);
        if (activo.id && activo.id !== 0) {
            await AsyncStorage.setItem(`movimientos_activo_${activo.id}_cache`, JSON.stringify(nextMovs));
        }

        setMovimientos(nextMovs);
        setMovActivo((prev) => (prev ? { ...prev, movimientos: nextMovs } : prev));
    };

    const handleMovSave = async () => {
        if (!employee) return;
        if (!movActivo) return;
        if (!validateMovForm()) return;

        const payload = await buildMovPayload();
        const isConnected = await getConnectionStatus();

        // create
        if (!movEditing) {
            if (isConnected && movActivo.id && movActivo.id !== 0) {
                const res = await createMovimientoActivoMantenimiento({ activoId: movActivo.id, requestData: payload, refreshAccessToken, logout });
                if (res.status) {
                    Alert.alert('Éxito', 'Movimiento creado correctamente');
                    setMovIsCreating(false);
                    await openMovimientosModal(movActivo);
                } else {
                    Alert.alert('Error', res.message || 'No se pudo crear el movimiento');
                }
            } else {
                const localId = `local-mov-${Date.now()}`;
                const localItem: MovimientoActivoMantenimientoItem = {
                    id: 0,
                    id_local: localId,
                    activo_mantenimiento_id: movActivo.id || 0,
                    nombre_persona_recibe: payload.nombre_persona_recibe,
                    nombre_persona_entrega: payload.nombre_persona_entrega,
                    departamento: payload.departamento,
                    telefono: payload.telefono,
                    entrega: payload.entrega,
                    recibe: payload.recibe,
                    fecha: payload.fecha,
                    hora: payload.hora,
                    firma_entrega: payload.firma_entrega,
                    firma_recibe: payload.firma_recibe,
                    firma_responsable: payload.firma_responsable,
                };
                const next = [localItem, ...movimientos];
                await persistMovimientosToActivosCache(movActivo, next);
                await upsertMovAction({
                    type: 'create',
                    id: localId,
                    activoId: movActivo.id || 0,
                    activoLocalId: movActivo.id_local || '',
                    reporteId: movActivo.reporte_id,
                    requestData: payload,
                });
                Alert.alert('Guardado (offline)', 'El movimiento se sincronizará cuando vuelva la conexión.');
                setMovIsCreating(false);
            }
            return;
        }

        // update
        const isLocalMov = !!movEditing.id_local || movEditing.id === 0;
        if (isConnected && !isLocalMov && movActivo.id && movActivo.id !== 0) {
            const res = await updateMovimientoActivoMantenimiento({
                activoId: movActivo.id,
                id: movEditing.id,
                requestData: payload,
                refreshAccessToken,
                logout,
            });
            if (res.status) {
                Alert.alert('Éxito', 'Movimiento actualizado correctamente');
                setMovIsCreating(false);
                setMovEditing(null);
                await openMovimientosModal(movActivo);
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
                    entrega: payload.entrega,
                    recibe: payload.recibe,
                    fecha: payload.fecha,
                    hora: payload.hora,
                    firma_entrega: payload.firma_entrega,
                    firma_recibe: payload.firma_recibe,
                    firma_responsable: payload.firma_responsable,
                };
            });
            await persistMovimientosToActivosCache(movActivo, next);

            if (movEditing.id_local) {
                const updated = await updateMovCreateActionForLocalId(movEditing.id_local, payload);
                if (!updated) {
                    await upsertMovAction({
                        type: 'create',
                        id: movEditing.id_local,
                        activoId: movActivo.id || 0,
                        activoLocalId: movActivo.id_local || '',
                        reporteId: movActivo.reporte_id,
                        requestData: payload,
                    });
                }
            } else {
                await upsertMovAction({
                    type: 'update',
                    id: movEditing.id,
                    activoId: movActivo.id || 0,
                    activoLocalId: movActivo.id_local || '',
                    reporteId: movActivo.reporte_id,
                    requestData: payload,
                });
            }

            Alert.alert('Guardado (offline)', 'Los cambios se sincronizarán cuando vuelva la conexión.');
            setMovIsCreating(false);
            setMovEditing(null);
        }
    };

    const handleMovDelete = async (m: MovimientoActivoMantenimientoItem) => {
        const current = await loadMarcaContext();
        if (!current?.id) return;
        if (!movActivo) return;

        Alert.alert('Confirmar', '¿Deseas eliminar este movimiento?', [
            { text: 'Cancelar', style: 'cancel' },
            {
                text: 'Eliminar',
                style: 'destructive',
                onPress: async () => {
                    const isConnected = await getConnectionStatus();

                    if (m.id_local || m.id === 0) {
                        const next = movimientos.filter((x) => x.id_local !== m.id_local);
                        await persistMovimientosToActivosCache(movActivo, next);
                        if (m.id_local) await removeMovActionsForLocalId(m.id_local);
                        return;
                    }

                    if (isConnected && movActivo.id && movActivo.id !== 0) {
                        const res = await deleteMovimientoActivoMantenimiento({
                            activoId: movActivo.id,
                            id: m.id,
                            marcaId: current.id,
                            refreshAccessToken,
                            logout,
                        });
                        if (res.status) {
                            Alert.alert('Éxito', 'Movimiento eliminado correctamente');
                            await openMovimientosModal(movActivo);
                        } else {
                            Alert.alert('Error', res.message || 'No se pudo eliminar el movimiento');
                        }
                    } else {
                        const next = movimientos.filter((x) => x.id !== m.id);
                        await persistMovimientosToActivosCache(movActivo, next);
                        await upsertMovAction({
                            type: 'delete',
                            id: m.id,
                            activoId: movActivo.id || 0,
                            activoLocalId: movActivo.id_local || '',
                            reporteId: movActivo.reporte_id,
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
        setIsReadingSignature(true);
        if (drawSignatureTarget === 'entrega') {
            setMovFirmaEntrega(signature);
        } else {
            setMovFirmaRecibe(signature);
        }
        setTimeout(() => {
            setIsReadingSignature(false);
            closeDrawSignatureModal();
        }, 300);
    };

    const clearSignatureInModal = () => {
        if (signatureRef.current) {
            signatureRef.current.clearSignature();
        }
    };

    const acceptSignature = () => {
        if (signatureRef.current) {
            signatureRef.current.readSignature();
        }
    };

    const renderForm = () => {
        const showFechaSalidaEntrada = accion === 'Reparar en taller';
        const showKilometraje = esVehiculo;

        return (
            <ThemedView style={styles.formCard}>
                <ThemedText style={styles.formTitle}>Actualizar activo</ThemedText>

                <ThemedText style={styles.label}>Artículo:</ThemedText>
                <TextInput
                    style={[styles.input, styles.inputReadOnly]}
                    value={selectedActivo?.articulo_nombre || ''}
                    editable={false}
                    placeholderTextColor="#999"
                />

                <ThemedView style={styles.checkboxContainer}>
                    <TouchableOpacity
                        style={[styles.checkbox, marcarComoResuelto ? styles.checkboxChecked : styles.checkboxUnchecked]}
                        onPress={() => setMarcarComoResuelto(!marcarComoResuelto)}
                        activeOpacity={0.8}
                    >
                        {marcarComoResuelto && (
                            <Ionicons name="checkmark" size={16} color="#fff" />
                        )}
                    </TouchableOpacity>
                    <ThemedText style={styles.checkboxLabel}>Marcar como resuelto</ThemedText>
                </ThemedView>


                <ThemedText style={styles.label}>Acción:</ThemedText>
                <View style={styles.pickerContainer}>
                    <Picker
                        selectedValue={accion}
                        onValueChange={(value) => setAccion(value)}
                        style={styles.picker}
                    >
                        <Picker.Item label="Seleccionar..." value="" />
                        <Picker.Item label="Reemplazar" value="Reemplazar" />
                        <Picker.Item label="Reparar en puesto" value="Reparar en puesto" />
                        <Picker.Item label="Reparar en taller" value="Reparar en taller" />
                    </Picker>
                </View>

                <ThemedText style={styles.label}>Fecha inicio:</ThemedText>
                <TouchableOpacity style={styles.dateButton} onPress={() => setShowFechaInicioPicker(true)}>
                    <ThemedText style={styles.dateButtonText}>
                        {fechaInicio ? dateToLocalString(fechaInicio) : 'Seleccionar fecha'}
                    </ThemedText>
                    <Ionicons name="calendar-outline" size={18} color="#007AFF" />
                </TouchableOpacity>

                <ThemedText style={styles.label}>Tipo:</ThemedText>
                <View style={styles.pickerContainer}>
                    <Picker
                        selectedValue={tipo}
                        onValueChange={(value) => setTipo(value)}
                        style={styles.picker}
                    >
                        <Picker.Item label="Seleccionar..." value="" />
                        <Picker.Item label="Preventivo" value="Preventivo" />
                        <Picker.Item label="Correctivo" value="Correctivo" />
                    </Picker>
                </View>

                <ThemedText style={styles.label}>Marca:</ThemedText>
                <TextInput
                    style={styles.input}
                    value={marca}
                    onChangeText={setMarca}
                    placeholder="Marca"
                    placeholderTextColor="#999"
                />

                <ThemedText style={styles.label}>Modelo:</ThemedText>
                <TextInput
                    style={styles.input}
                    value={modelo}
                    onChangeText={setModelo}
                    placeholder="Modelo"
                    placeholderTextColor="#999"
                />

                <ThemedText style={styles.label}>Serie/Placa:</ThemedText>
                <TextInput
                    style={styles.input}
                    value={seriePlaca}
                    onChangeText={setSeriePlaca}
                    placeholder="Serie/Placa"
                    placeholderTextColor="#999"
                />

                <ThemedText style={styles.label}>Categoría:</ThemedText>
                <TextInput
                    style={styles.input}
                    value={categoria}
                    onChangeText={setCategoria}
                    placeholder="Categoría"
                    placeholderTextColor="#999"
                />

                <ThemedView style={styles.checkboxContainer}>
                    <TouchableOpacity
                        style={[styles.checkbox, esVehiculo ? styles.checkboxChecked : styles.checkboxUnchecked]}
                        onPress={() => setEsVehiculo(!esVehiculo)}
                        activeOpacity={0.8}
                    >
                        {esVehiculo && (
                            <Ionicons name="checkmark" size={16} color="#fff" />
                        )}
                    </TouchableOpacity>
                    <ThemedText style={styles.checkboxLabel}>Es vehículo</ThemedText>
                </ThemedView>

                {showKilometraje && (
                    <>
                        <ThemedText style={styles.label}>Kilometraje:</ThemedText>
                        <TextInput
                            style={styles.input}
                            value={kilometraje}
                            onChangeText={setKilometraje}
                            placeholder="Kilometraje"
                            keyboardType="numeric"
                            placeholderTextColor="#999"
                        />
                    </>
                )}

                {showFechaSalidaEntrada && (
                    <>
                        <ThemedText style={styles.label}>Fecha salida:</ThemedText>
                        <TouchableOpacity style={styles.dateButton} onPress={() => setShowFechaSalidaPicker(true)}>
                            <ThemedText style={styles.dateButtonText}>
                                {fechaSalida ? dateToLocalString(fechaSalida) : 'Seleccionar fecha'}
                            </ThemedText>
                            <Ionicons name="calendar-outline" size={18} color="#007AFF" />
                        </TouchableOpacity>

                        <ThemedText style={styles.label}>Fecha entrada:</ThemedText>
                        <TouchableOpacity style={styles.dateButton} onPress={() => setShowFechaEntradaPicker(true)}>
                            <ThemedText style={styles.dateButtonText}>
                                {fechaEntrada ? dateToLocalString(fechaEntrada) : 'Seleccionar fecha'}
                            </ThemedText>
                            <Ionicons name="calendar-outline" size={18} color="#007AFF" />
                        </TouchableOpacity>
                    </>
                )}

                <ThemedText style={styles.label}>Categoría mantenimiento:</ThemedText>
                <View style={styles.pickerContainer}>
                    <Picker
                        selectedValue={categoriaMantenimiento}
                        onValueChange={(value) => setCategoriaMantenimiento(value)}
                        style={styles.picker}
                    >
                        <Picker.Item label="Seleccionar..." value="" />
                        {categoriasMantenimiento.map((cat) => (
                            <Picker.Item key={cat.id} label={cat.nombre} value={cat.nombre} />
                        ))}
                    </Picker>
                </View>

                <ThemedText style={styles.label}>Detalle:</ThemedText>
                <TextInput
                    style={[styles.input, styles.textArea]}
                    value={detalle}
                    onChangeText={setDetalle}
                    placeholder="Detalle"
                    multiline
                    numberOfLines={3}
                    placeholderTextColor="#999"
                />

                <ThemedText style={styles.label}>Número FC:</ThemedText>
                <TextInput
                    style={styles.input}
                    value={numeroFc}
                    onChangeText={setNumeroFc}
                    placeholder="Número FC"
                    placeholderTextColor="#999"
                />

                <ThemedText style={styles.label}>Proveedor:</ThemedText>
                <TextInput
                    style={styles.input}
                    value={proveedor}
                    onChangeText={setProveedor}
                    placeholder="Proveedor"
                    placeholderTextColor="#999"
                />

                <ThemedText style={styles.label}>Costo MO:</ThemedText>
                <TextInput
                    style={styles.input}
                    value={costoMo}
                    onChangeText={setCostoMo}
                    placeholder="Costo MO"
                    keyboardType="numeric"
                    placeholderTextColor="#999"
                />

                <ThemedText style={styles.label}>Costo I:</ThemedText>
                <TextInput
                    style={styles.input}
                    value={costoI}
                    onChangeText={setCostoI}
                    placeholder="Costo I"
                    keyboardType="numeric"
                    placeholderTextColor="#999"
                />

                <ThemedText style={styles.label}>IVA:</ThemedText>
                <TextInput
                    style={styles.input}
                    value={iva}
                    onChangeText={setIva}
                    placeholder="IVA"
                    keyboardType="numeric"
                    placeholderTextColor="#999"
                />

                <ThemedText style={styles.label}>Costo total:</ThemedText>
                <TextInput
                    style={styles.input}
                    value={costoTotal}
                    onChangeText={setCostoTotal}
                    placeholder="Costo total"
                    keyboardType="numeric"
                    placeholderTextColor="#999"
                />

                <ThemedText style={styles.label}>Fecha fin:</ThemedText>
                <TouchableOpacity style={styles.dateButton} onPress={() => setShowFechaFinPicker(true)}>
                    <ThemedText style={styles.dateButtonText}>
                        {fechaFin ? dateToLocalString(fechaFin) : 'Seleccionar fecha'}
                    </ThemedText>
                    <Ionicons name="calendar-outline" size={18} color="#007AFF" />
                </TouchableOpacity>

                <ThemedView style={styles.checkboxContainer}>
                    <TouchableOpacity
                        style={[styles.checkbox, reincidenciaTreintaDias ? styles.checkboxChecked : styles.checkboxUnchecked]}
                        onPress={() => setReincidenciaTreintaDias(!reincidenciaTreintaDias)}
                        activeOpacity={0.8}
                    >
                        {reincidenciaTreintaDias && (
                            <Ionicons name="checkmark" size={16} color="#fff" />
                        )}
                    </TouchableOpacity>
                    <ThemedText style={styles.checkboxLabel}>Reincidencia treinta días</ThemedText>
                </ThemedView>

                {/* Archivos adjuntos */}
                <ThemedView style={styles.formGroup}>
                    <ThemedText style={styles.formLabel}>Documentos</ThemedText>
                    <TouchableOpacity
                        style={styles.addFileButton}
                        onPress={() => handleAddFile('document')}
                    >
                        <Ionicons name="document-text-outline" size={18} color="#007AFF" />
                        <ThemedText style={styles.addFileButtonText}>Agregar documento</ThemedText>
                    </TouchableOpacity>
                    {activoFiles.filter(f => f.type === 'document').length > 0 && (
                        <ThemedView style={styles.filesList}>
                            {activoFiles.filter(f => f.type === 'document').map(file => (
                                <ThemedView key={file.id} style={styles.fileRow}>
                                    <Ionicons name="document-text-outline" size={16} color="#007AFF" />
                                    <ThemedText numberOfLines={1} style={styles.fileName}>
                                        {file.original_name || file.name}
                                    </ThemedText>
                                    <TouchableOpacity onPress={() => {
                                        const url = buildFileUrl(selectedActivo?.id, file);
                                        if (url) Linking.openURL(url);
                                    }}>
                                        <Ionicons name="open-outline" size={16} color="#007AFF" />
                                    </TouchableOpacity>
                                </ThemedView>
                            ))}
                        </ThemedView>
                    )}
                    {textFiles.length > 0 && (
                        <ThemedView style={styles.filesList}>
                            {textFiles.map(file => (
                                <ThemedView key={file.id} style={styles.fileRow}>
                                    <Ionicons name="document-text-outline" size={16} color="#007AFF" />
                                    <ThemedText numberOfLines={1} style={styles.fileName}>
                                        {file.name}
                                    </ThemedText>
                                    <TouchableOpacity onPress={() => removeLocalFile('document', file.id)}>
                                        <Ionicons name="trash" size={16} color="#FF3B30" />
                                    </TouchableOpacity>
                                </ThemedView>
                            ))}
                        </ThemedView>
                    )}
                </ThemedView>

                <ThemedView style={styles.formGroup}>
                    <ThemedText style={styles.formLabel}>Imágenes</ThemedText>
                    <TouchableOpacity
                        style={styles.addFileButton}
                        onPress={() => handleAddFile('image')}
                    >
                        <Ionicons name="image-outline" size={18} color="#007AFF" />
                        <ThemedText style={styles.addFileButtonText}>Agregar imagen</ThemedText>
                    </TouchableOpacity>
                    {activoFiles.filter(f => f.type === 'image').length > 0 && (
                        <ThemedView style={styles.filesList}>
                            {activoFiles.filter(f => f.type === 'image').map(file => (
                                <ThemedView key={file.id} style={styles.fileRow}>
                                    <Image
                                        source={{ uri: buildFileUrl(selectedActivo?.id, file) }}
                                        style={styles.filePreviewImage}
                                        resizeMode="cover"
                                    />
                                    <ThemedText numberOfLines={1} style={styles.fileName}>
                                        {file.original_name || file.name}
                                    </ThemedText>
                                    <TouchableOpacity onPress={() => {
                                        const url = buildFileUrl(selectedActivo?.id, file);
                                        if (url) Linking.openURL(url);
                                    }}>
                                        <Ionicons name="open-outline" size={16} color="#007AFF" />
                                    </TouchableOpacity>
                                </ThemedView>
                            ))}
                        </ThemedView>
                    )}
                    {imageFiles.length > 0 && (
                        <ThemedView style={styles.filesList}>
                            {imageFiles.map(file => (
                                <ThemedView key={file.id} style={styles.fileRow}>
                                    <Image
                                        source={{
                                            uri: `data:image/${file.extension || 'jpeg'};base64,${file.base64}`,
                                        }}
                                        style={styles.filePreviewImage}
                                        resizeMode="cover"
                                    />
                                    <ThemedText numberOfLines={1} style={styles.fileName}>
                                        {file.name}
                                    </ThemedText>
                                    <TouchableOpacity onPress={() => removeLocalFile('image', file.id)}>
                                        <Ionicons name="trash" size={16} color="#FF3B30" />
                                    </TouchableOpacity>
                                </ThemedView>
                            ))}
                        </ThemedView>
                    )}
                </ThemedView>

                <ThemedView style={styles.formGroup}>
                    <ThemedText style={styles.formLabel}>Audio</ThemedText>
                    <TouchableOpacity
                        style={styles.addFileButton}
                        onPress={() => handleAddFile('audio')}
                    >
                        <Ionicons name="mic-outline" size={18} color="#007AFF" />
                        <ThemedText style={styles.addFileButtonText}>Agregar audio</ThemedText>
                    </TouchableOpacity>
                    {activoFiles.filter(f => f.type === 'audio').length > 0 && (
                        <ThemedView style={styles.filesList}>
                            {activoFiles.filter(f => f.type === 'audio').map(file => (
                                <ThemedView key={file.id} style={styles.fileRow}>
                                    <Ionicons name="musical-notes-outline" size={16} color="#007AFF" />
                                    <ThemedText numberOfLines={1} style={styles.fileName}>
                                        {file.original_name || file.name}
                                    </ThemedText>
                                    <TouchableOpacity onPress={() => {
                                        const url = buildFileUrl(selectedActivo?.id, file);
                                        if (url) Linking.openURL(url);
                                    }}>
                                        <Ionicons name="open-outline" size={16} color="#007AFF" />
                                    </TouchableOpacity>
                                </ThemedView>
                            ))}
                        </ThemedView>
                    )}
                    {audioFiles.length > 0 && (
                        <ThemedView style={styles.filesList}>
                            {audioFiles.map(file => (
                                <ThemedView key={file.id} style={styles.fileRow}>
                                    <Ionicons name="musical-notes-outline" size={16} color="#007AFF" />
                                    <ThemedText numberOfLines={1} style={styles.fileName}>
                                        {file.name}
                                    </ThemedText>
                                    <TouchableOpacity onPress={() => removeLocalFile('audio', file.id)}>
                                        <Ionicons name="trash" size={16} color="#FF3B30" />
                                    </TouchableOpacity>
                                </ThemedView>
                            ))}
                        </ThemedView>
                    )}
                </ThemedView>

                <ThemedView style={styles.formGroup}>
                    <ThemedText style={styles.formLabel}>Video</ThemedText>
                    <TouchableOpacity
                        style={styles.addFileButton}
                        onPress={() => handleAddFile('video')}
                    >
                        <Ionicons name="videocam-outline" size={18} color="#007AFF" />
                        <ThemedText style={styles.addFileButtonText}>Agregar video</ThemedText>
                    </TouchableOpacity>
                    {activoFiles.filter(f => f.type === 'video').length > 0 && (
                        <ThemedView style={styles.filesList}>
                            {activoFiles.filter(f => f.type === 'video').map(file => (
                                <ThemedView key={file.id} style={styles.fileRow}>
                                    <Ionicons name="videocam-outline" size={16} color="#007AFF" />
                                    <ThemedText numberOfLines={1} style={styles.fileName}>
                                        {file.original_name || file.name}
                                    </ThemedText>
                                    <TouchableOpacity onPress={() => {
                                        const url = buildFileUrl(selectedActivo?.id, file);
                                        if (url) Linking.openURL(url);
                                    }}>
                                        <Ionicons name="open-outline" size={16} color="#007AFF" />
                                    </TouchableOpacity>
                                </ThemedView>
                            ))}
                        </ThemedView>
                    )}
                    {videoFiles.length > 0 && (
                        <ThemedView style={styles.filesList}>
                            {videoFiles.map(file => (
                                <ThemedView key={file.id} style={styles.fileRow}>
                                    <Ionicons name="videocam-outline" size={16} color="#007AFF" />
                                    <ThemedText numberOfLines={1} style={styles.fileName}>
                                        {file.name}
                                    </ThemedText>
                                    <TouchableOpacity onPress={() => removeLocalFile('video', file.id)}>
                                        <Ionicons name="trash" size={16} color="#FF3B30" />
                                    </TouchableOpacity>
                                </ThemedView>
                            ))}
                        </ThemedView>
                    )}
                </ThemedView>

                <ThemedView style={styles.formActions}>
                    <TouchableOpacity style={[styles.formActionButton, styles.formActionCancel]} onPress={cancelUpdating}>
                        <Ionicons name="close" size={18} color="#000" />
                        <ThemedText style={styles.formActionCancelText}>Cancelar</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.formActionButton, styles.formActionSave]} onPress={handleSave}>
                        <Ionicons name="save" size={18} color="#fff" />
                        <ThemedText style={styles.formActionSaveText}>Confirmar</ThemedText>
                    </TouchableOpacity>
                </ThemedView>
            </ThemedView>
        );
    };

    return (
        <ThemedView style={styles.container}>
            <AppHeader onMenuPress={handleMenuPress} title="Mantenimiento de equipo" />

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                <ThemedView style={styles.content}>
                    {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}

                    <ThemedView style={styles.titleContainer}>
                        <ThemedText type="title" style={styles.title}>
                            <Ionicons name="construct" size={22} color="#000000" /> Mantenimiento de equipo
                        </ThemedText>
                        <ThemedText style={styles.subtitle}>Gestiona el mantenimiento de equipos</ThemedText>
                    </ThemedView>

                    {!hasCurrentMarca ? (
                        <ThemedView style={styles.emptyContainer}>
                            <ThemedText style={styles.errorText}>Debes tener una marca activa para usar este módulo.</ThemedText>
                        </ThemedView>
                    ) : null}

                    {/* Filtros */}
                    {!isUpdating && !showActivos && (
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
                                        setFilterPuestoId(marcaPuestoId);
                                    }}>
                                        <Ionicons name="refresh" size={16} color="#FF3B30" />
                                        <ThemedText style={styles.resetFiltersText}>Reiniciar</ThemedText>
                                    </TouchableOpacity>
                                )}
                            </ThemedView>
                            {isFiltersExpanded && (
                                <ThemedView style={styles.filterContent}>
                                    {/* Árbol jerárquico para filtros */}
                                    <ThemedView style={styles.filterGroup}>
                                        <ThemedText style={styles.filterLabel}>Empresa:</ThemedText>
                                        <View style={styles.pickerContainer}>
                                            <Picker
                                                selectedValue={filterEmpresaId || ''}
                                                onValueChange={(value) => {
                                                    setFilterEmpresaId(value && value !== '' ? Number(value) : null);
                                                }}
                                                style={styles.picker}
                                            >
                                                <Picker.Item label="Seleccionar..." value="" />
                                                {filterEmpresas.map((e: any) => (
                                                    <Picker.Item key={e.id} label={e.nombre} value={e.id} />
                                                ))}
                                            </Picker>
                                        </View>
                                    </ThemedView>

                                    {filterEmpresaId && (
                                        <ThemedView style={styles.filterGroup}>
                                            <ThemedText style={styles.filterLabel}>Cliente:</ThemedText>
                                            <View style={styles.pickerContainer}>
                                                <Picker
                                                    selectedValue={filterClienteId || ''}
                                                    onValueChange={(value) => {
                                                        setFilterClienteId(value && value !== '' ? Number(value) : null);
                                                    }}
                                                    style={styles.picker}
                                                >
                                                    <Picker.Item label="Seleccionar..." value="" />
                                                    {filterClientes.map((c: any) => (
                                                        <Picker.Item key={c.id} label={c.nombre} value={c.id} />
                                                    ))}
                                                </Picker>
                                            </View>
                                        </ThemedView>
                                    )}

                                    {filterClienteId && (
                                        <ThemedView style={styles.filterGroup}>
                                            <ThemedText style={styles.filterLabel}>División:</ThemedText>
                                            <View style={styles.pickerContainer}>
                                                <Picker
                                                    selectedValue={filterDivisionId || ''}
                                                    onValueChange={(value) => {
                                                        setFilterDivisionId(value && value !== '' ? Number(value) : null);
                                                    }}
                                                    style={styles.picker}
                                                >
                                                    <Picker.Item label="Seleccionar..." value="" />
                                                    {filterDivisiones.map((d: any) => (
                                                        <Picker.Item key={d.id} label={d.nombre} value={d.id} />
                                                    ))}
                                                </Picker>
                                            </View>
                                        </ThemedView>
                                    )}

                                    {filterDivisionId && (
                                        <ThemedView style={styles.filterGroup}>
                                            <ThemedText style={styles.filterLabel}>Contrato:</ThemedText>
                                            <View style={styles.pickerContainer}>
                                                <Picker
                                                    selectedValue={filterContratoId || ''}
                                                    onValueChange={(value) => {
                                                        setFilterContratoId(value && value !== '' ? Number(value) : null);
                                                    }}
                                                    style={styles.picker}
                                                >
                                                    <Picker.Item label="Seleccionar..." value="" />
                                                    {filterContratos.map((c: any) => (
                                                        <Picker.Item key={c.id} label={c.nombre} value={c.id} />
                                                    ))}
                                                </Picker>
                                            </View>
                                        </ThemedView>
                                    )}

                                    {filterContratoId && (
                                        <ThemedView style={styles.filterGroup}>
                                            <ThemedText style={styles.filterLabel}>Sucursal:</ThemedText>
                                            <View style={styles.pickerContainer}>
                                                <Picker
                                                    selectedValue={filterCorpoId || ''}
                                                    onValueChange={(value) => {
                                                        setFilterCorpoId(value && value !== '' ? Number(value) : null);
                                                    }}
                                                    style={styles.picker}
                                                >
                                                    <Picker.Item label="Seleccionar..." value="" />
                                                    {filterSucursales.map((s: any) => (
                                                        <Picker.Item key={s.id} label={s.nombre} value={s.id} />
                                                    ))}
                                                </Picker>
                                            </View>
                                        </ThemedView>
                                    )}

                                    {filterCorpoId && (
                                        <ThemedView style={styles.filterGroup}>
                                            <ThemedText style={styles.filterLabel}>Puesto:</ThemedText>
                                            <View style={styles.pickerContainer}>
                                                <Picker
                                                    selectedValue={filterPuestoId || ''}
                                                    onValueChange={(value) => setFilterPuestoId(value && value !== '' ? Number(value) : null)}
                                                    style={styles.picker}
                                                >
                                                    <Picker.Item label="Seleccionar..." value="" />
                                                    {filterPuestos.map((p: any) => (
                                                        <Picker.Item key={p.id} label={p.nombre} value={p.id} />
                                                    ))}
                                                </Picker>
                                            </View>
                                        </ThemedView>
                                    )}
                                </ThemedView>
                            )}
                        </ThemedView>
                    )}

                    {isUpdating ? (
                        renderForm()
                    ) : showActivos ? (
                        <>
                            <TouchableOpacity style={styles.backButton} onPress={handleVolverReportes}>
                                <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
                                <ThemedText style={styles.backButtonText}>Volver a reportes</ThemedText>
                            </TouchableOpacity>
                            {isLoading ? (
                                <ThemedView style={styles.loadingContainer}>
                                    <ActivityIndicator size="large" color="#007AFF" />
                                    <ThemedText style={styles.loadingText}>Cargando...</ThemedText>
                                </ThemedView>
                            ) : activos.length === 0 ? (
                                <ThemedView style={styles.emptyContainer}>
                                    <ThemedText style={styles.emptyText}>No hay activos disponibles</ThemedText>
                                </ThemedView>
                            ) : (
                                <ThemedView style={styles.listContainer}>
                                    {activos.map(renderActivo)}
                                </ThemedView>
                            )}
                        </>
                    ) : (
                        <>
                            {isLoading ? (
                                <ThemedView style={styles.loadingContainer}>
                                    <ActivityIndicator size="large" color="#007AFF" />
                                    <ThemedText style={styles.loadingText}>Cargando...</ThemedText>
                                </ThemedView>
                            ) : reportes.length === 0 ? (
                                <ThemedView style={styles.emptyContainer}>
                                    <ThemedText style={styles.emptyText}>No hay reportes disponibles</ThemedText>
                                </ThemedView>
                            ) : (
                                <ThemedView style={styles.listContainer}>
                                    {reportes.map(renderReporte)}
                                </ThemedView>
                            )}
                        </>
                    )}
                </ThemedView>
            </ScrollView>

            {/* Date Pickers */}
            {showFechaSolucionPicker && (
                <DateTimePicker
                    value={fechaSolucion || new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, date) => {
                        setShowFechaSolucionPicker(false);
                        if (date) setFechaSolucion(date);
                    }}
                />
            )}

            {showFechaInicioPicker && (
                <DateTimePicker
                    value={fechaInicio || new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, date) => {
                        setShowFechaInicioPicker(false);
                        if (date) setFechaInicio(date);
                    }}
                />
            )}

            {showFechaSalidaPicker && (
                <DateTimePicker
                    value={fechaSalida || new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, date) => {
                        setShowFechaSalidaPicker(false);
                        if (date) setFechaSalida(date);
                    }}
                />
            )}

            {showFechaEntradaPicker && (
                <DateTimePicker
                    value={fechaEntrada || new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, date) => {
                        setShowFechaEntradaPicker(false);
                        if (date) setFechaEntrada(date);
                    }}
                />
            )}

            {showFechaFinPicker && (
                <DateTimePicker
                    value={fechaFin || new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, date) => {
                        setShowFechaFinPicker(false);
                        if (date) setFechaFin(date);
                    }}
                />
            )}

            {/* Modal Movimientos de activos */}
            <Modal visible={isMovModalVisible} animationType="fade" transparent={true} onRequestClose={closeMovimientosModal}>
                <View style={styles.overlay}>
                    <ThemedView style={styles.floatModalCardMovimientos}>
                        <ThemedView style={styles.floatModalHeader}>
                            <ThemedText style={styles.modalTitle}>Movimiento de activos</ThemedText>
                            <TouchableOpacity onPress={closeMovimientosModal}>
                                <Ionicons name="close" size={24} color="#333" />
                            </TouchableOpacity>
                        </ThemedView>

                        <ScrollView style={{ maxHeight: Dimensions.get('window').height * 0.8 }} contentContainerStyle={{ padding: 16 }}>
                            <ThemedView style={styles.modalCard}>
                                <ThemedText style={styles.modalCardTitle}>Activo:</ThemedText>
                                <ThemedText style={styles.modalCardValue}>{movActivo?.articulo_nombre || '-'}</ThemedText>
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
                                                <ThemedText style={styles.dateButtonText}>{movFilterFecha || 'Seleccionar fecha'}</ThemedText>
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

                                    <ThemedText style={styles.label}>Entrega *</ThemedText>
                                    <TextInput style={styles.input} placeholder="Entrega" placeholderTextColor="#999" value={movEntrega} onChangeText={setMovEntrega} />

                                    <ThemedText style={styles.label}>Recibe *</ThemedText>
                                    <TextInput style={styles.input} placeholder="Recibe" placeholderTextColor="#999" value={movRecibe} onChangeText={setMovRecibe} />

                                    <ThemedText style={styles.label}>Fecha *</ThemedText>
                                    <TouchableOpacity style={styles.dateButton} onPress={() => setShowMovFechaPicker(true)}>
                                        <ThemedText style={styles.dateButtonText}>{movFecha || 'Seleccionar fecha'}</ThemedText>
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

                            {/* Lista (oculta mientras se crea/edita) */}
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
                                                        <ThemedText style={styles.bitValue}>{fecha} {hora}</ThemedText>
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
                                                        <TouchableOpacity style={[styles.listItemButton, styles.editButtonMov]} onPress={() => startMovEditing(m)}>
                                                            <Ionicons name="pencil" size={18} color="#FFFFFF" />
                                                            <ThemedText style={styles.listItemButtonText}>Editar</ThemedText>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity style={[styles.listItemButton, styles.deleteButtonMov]} onPress={() => handleMovDelete(m)}>
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
                                value={movFilterFecha ? new Date(movFilterFecha) : new Date()}
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
                                value={movFecha ? new Date(movFecha) : new Date()}
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

            <AppFooter />
            <SlideMenu isVisible={isMenuVisible} onClose={handleMenuClose} onHomePress={handleHomePress} currentRoute="MantenimientoEquipo" />
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

    formCard: { marginTop: 12, backgroundColor: '#fff', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#E0E0E0' },
    formTitle: { fontSize: 18, fontWeight: '800', marginBottom: 10, color: '#000' },
    label: { fontSize: 13, fontWeight: '700', marginTop: 10, color: '#333' },
    input: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, backgroundColor: '#fff', color: '#000', marginBottom: 6 },
    inputReadOnly: { backgroundColor: '#F5F5F5', color: '#666' },
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

    pickerContainer: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 8,
        marginBottom: 6,
        backgroundColor: '#fff',
    },
    picker: { color: '#000' },

    checkboxContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        paddingVertical: 8,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 4,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxChecked: {
        backgroundColor: '#34C759',
        borderColor: '#34C759',
    },
    checkboxUnchecked: {
        backgroundColor: '#fff',
        borderColor: '#E0E0E0',
    },
    checkboxLabel: {
        fontSize: 14,
        color: '#000',
        marginLeft: 12,
        flex: 1,
    },

    formActions: { marginTop: 16, flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
    formActionButton: { flex: 1, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12 },
    formActionCancel: { backgroundColor: '#EDEDED' },
    formActionCancelText: { color: '#000', fontWeight: '800' },
    formActionSave: { backgroundColor: '#007AFF' },
    formActionSaveText: { color: '#fff', fontWeight: '800' },

    listContainer: {},
    emptyContainer: { padding: 24, alignItems: 'center' },
    emptyText: { fontSize: 14, opacity: 0.6, textAlign: 'center', color: '#000' },

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
    activoHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
        gap: 8,
    },
    bitTitle: { fontSize: 16, fontWeight: '800', flex: 1, color: '#000' },
    solucionBadge: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 6,
        alignSelf: 'flex-start',
    },
    solucionBadgeResuelto: {
        backgroundColor: '#34C759',
    },
    solucionBadgePendiente: {
        backgroundColor: '#FF9500',
    },
    solucionBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    bitLine: { marginBottom: 6, color: '#000' },
    bitLabel: { fontWeight: '700', color: '#333' },
    bitValue: { color: '#000' },

    listItemButtons: { marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
    listItemButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 8, gap: 8 },
    viewButton: { backgroundColor: '#34C759' },
    editButton: { backgroundColor: '#007AFF', marginTop: 10 },
    editButtonActivo: { backgroundColor: '#007AFF' },
    editButtonMov: { backgroundColor: '#007AFF' },
    movementsButton: { backgroundColor: '#34C759' },
    deleteButton: { backgroundColor: '#FF3B30' },
    deleteButtonMov: { backgroundColor: '#FF3B30' },
    listItemButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },

    backButton: {
        backgroundColor: '#007AFF',
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 16,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
    },
    backButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
    formGroup: {
        marginBottom: 16,
    },
    formLabel: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
        color: '#000',
    },
    addFileButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: '#F0F0F0',
        borderRadius: 8,
        marginTop: 8,
        gap: 8,
    },
    addFileButtonText: {
        color: '#007AFF',
        fontSize: 14,
        fontWeight: '500',
    },
    filesList: {
        marginTop: 12,
        gap: 8,
    },
    fileRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: '#F8F9FA',
        borderRadius: 8,
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
    collapsableSection: {
        marginTop: 12,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 8,
        backgroundColor: '#F9F9F9',
        overflow: 'hidden',
    },
    collapsableHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#F0F0F0',
    },
    collapsableHeaderText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#007AFF',
    },
    collapsableContent: {
        padding: 12,
        backgroundColor: '#F9F9F9',
    },
    viewerSection: {
        marginBottom: 16,
        backgroundColor: '#F9F9F9',
    },
    viewerSectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 12,
        color: '#333',
    },
    viewerImage: {
        width: '100%',
        height: 200,
        borderRadius: 8,
        marginBottom: 8,
        backgroundColor: '#F0F0F0',
    },
    documentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 8,
        backgroundColor: '#fff',
        marginBottom: 8,
    },
    documentText: {
        flex: 1,
        fontSize: 14,
        color: '#333',
    },
    audioPlayerContainer: {
        marginBottom: 16,
        padding: 12,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 8,
        backgroundColor: '#fff',
    },
    audioLabel: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
        color: '#333',
    },
    audioPlayer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#FFF',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#DDD',
    },
    playButton: {
        padding: 8,
    },
    audioTime: {
        fontSize: 14,
        fontWeight: '500',
        color: '#007AFF',
        flex: 1,
    },
    resetAudioButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 8,
        borderRadius: 8,
        gap: 4,
    },

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
    floatModalCardMovimientos: {
        width: '95%',
        maxWidth: 800,
        maxHeight: '90%',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 8,
    },
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
    filterGroup: { marginBottom: 12 },
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

    createButton: { backgroundColor: '#007AFF', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginBottom: 16 },
    createButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },

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
        padding: 20,
    },
    floatModalCard: {
        width: '100%',
        maxWidth: 600,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 8,
    },
    floatModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
        backgroundColor: '#F8F9FA',
    },
    signatureModalHint: {
        paddingHorizontal: 16,
        paddingTop: 12,
        fontSize: 13,
        color: '#666',
        textAlign: 'center',
    },
    signaturePadBox: {
        width: '100%',
        height: 300,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#E0E0E0',
    },
});

