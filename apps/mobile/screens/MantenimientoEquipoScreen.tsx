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
import {
    createMovimientoArticuloMantenimiento,
    deleteMovimientoArticuloMantenimiento,
    listMovimientosArticuloMantenimiento,
    MovimientoArticuloMantenimientoItem,
    updateMovimientoArticuloMantenimiento,
} from '../hooks/movimientosArticulosMantenimientoFunctions';
import Constants from 'expo-constants';
import getHoraAccion from '../hooks/getHoraAccion';
import authedFetch from '../hooks/authedFetch';
import getValidAccessTokenOrLogout from '../hooks/getValidAccessTokenOrLogout';

type TipoMantenimientoArticulo = { id: number; nombre: string };

type ArticuloMantenimiento = {
    id: number;
    id_local?: string;
    articulo_plan_id?: number | null;
    articulo_asignado_id?: number | null;
    estado: string;
    cantidad_necesaria: number;
    cantidad_real: number;
    observaciones: string;
    fecha_solucion?: string | null;
    accion?: string | null;
    fecha_inicio?: string | null;
    numero_boleta_proveeduria?: string | null;
    tipo?: string | null;
    marca?: string | null;
    modelo?: string | null;
    serie_placa?: string | null;
    marca_nuevo?: string | null;
    modelo_nuevo?: string | null;
    serie_placa_nuevo?: string | null;
    categoria?: string | null;
    tipo_mantenimiento_art?: string | null;
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
    tipo_mant_art_reincid?: string | null;
    mant_armas_form?: string | null;
    archivos?: ActivoFileRemote[];
};

type ArticuloPuestoMantenimientoItem = {
    key: string;
    source: 'plan' | 'asignado';
    estructura_id: number;
    articulo_nomenclador_id: number | null;
    articulo_nombre: string;
    tipo: string; // "Plan de puesto" | "Asignado al puesto"
    marca?: string | null;
    serie?: string | null;
    tipos_mantenimiento: TipoMantenimientoArticulo[];
    mantenimientos: ArticuloMantenimiento[];
    movimientos: MovimientoArticuloMantenimientoItem[];
    ultimo_mantenimiento: null | {
        id: number;
        estado: string;
        cantidad_necesaria: number;
        cantidad_real: number;
        observaciones: string;
    };
};

type CategoriaMantenimiento = {
    id: number;
    nombre: string;
};

type ArmaChecklistItem = { key: string; label: string; level?: number };

// Basado en el formato de la imagen (Mantenimiento Preventivo)
const ARMAS_PREVENTIVO_ITEMS: ArmaChecklistItem[] = [
    { key: 'remocion_corrosion', label: 'Remoción de Corrosión' },
    { key: 'limpieza_suciedad', label: 'Limpieza de Suciedad' },
    { key: 'revision_funcionamiento', label: 'Revisión de Funcionamiento' },
    { key: 'revision_func_disparador', label: 'Disparador (Revolver y Pistola)', level: 1 },
    { key: 'revision_func_corredera', label: 'Corredera (Pistola)', level: 1 },
    { key: 'revision_estetica_externa', label: 'Revisión de Estética Externa' },
    { key: 'revision_est_empunadura', label: 'Empuñadura', level: 1 },
    { key: 'revision_est_tornillos', label: 'Tornillos', level: 1 },
    { key: 'revision_est_mira_adelante', label: 'Mira Adelante', level: 1 },
    { key: 'revision_est_mira_atras', label: 'Mira Atrás', level: 1 },
    { key: 'revision_est_pasadores', label: 'Pasadores', level: 1 },
    { key: 'revision_est_seguro', label: 'Seguro', level: 1 },
    { key: 'lubricacion', label: 'Lubricación' },
    { key: 'lubricacion_percutor_extractor_pistola', label: 'Percutor y Extractor (Pistola)', level: 1 },
    { key: 'lubricacion_percutor_union_cilindro_revolver', label: 'Percutor y Unión con Cilindro (Revolver)', level: 1 },
    { key: 'lubricacion_cilindro_revolver', label: 'Lubricación Cilindro (Revolver)', level: 1 },
];

// Basado en el formato de la imagen (Mantenimiento Correctivo)
const ARMAS_CORRECTIVO_ITEMS: ArmaChecklistItem[] = [
    { key: 'desmontaje_completo_parte_mecanica', label: 'Desmontaje completo Parte Mecánica' },
    { key: 'disparador', label: 'Disparador' },
    { key: 'percutor', label: 'Percutor' },
    { key: 'conjuntos_internos_disparador', label: 'Conjuntos Internos del Disparador' },
    { key: 'pasadores', label: 'Pasadores' },
    { key: 'resortes', label: 'Resortes' },
    { key: 'conjuntos_empunadura', label: 'Conjuntos de la Empuñadura' },
    { key: 'pistola', label: 'Pistola' },
    { key: 'sistema_gas', label: 'Sistema de Gas' },
    { key: 'externo', label: 'Externo' },
    { key: 'mira', label: 'Mira' },
];

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
function ActivoFilesViewer({ activoId, files, accessToken }: { activoId: number; files: ActivoFileRemote[]; accessToken?: string | null }) {
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
        const appendTokenToUrl = (url: string) => {
            if (!accessToken || accessToken.trim().length === 0) return url;
            if (/[?&]token=/.test(url)) return url;
            const sep = url.includes('?') ? '&' : '?';
            return `${url}${sep}token=${encodeURIComponent(accessToken)}`;
        };

        if (file.type === 'image') {
            return appendTokenToUrl(`${apiUrl}/api/articulo-mantenimiento/${activoId}/get-image/${encodeURIComponent(file.name)}`);
        }
        if (file.type === 'audio') {
            return appendTokenToUrl(`${apiUrl}/api/articulo-mantenimiento/${activoId}/get-audio/${encodeURIComponent(file.name)}`);
        }
        if (file.type === 'video') {
            return appendTokenToUrl(`${apiUrl}/api/articulo-mantenimiento/${activoId}/get-video/${encodeURIComponent(file.name)}`);
        }
        return appendTokenToUrl(`${apiUrl}/api/articulo-mantenimiento/${activoId}/get-file/${encodeURIComponent(file.name)}`);
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
    const { employee, refreshAccessToken, logout, accessToken } = useAuth();
    const appendTokenToUrl = (url: string) => {
        if (!url) return '';
        if (!accessToken || accessToken.trim().length === 0) return url;
        if (/[?&]token=/.test(url)) return url;
        const sep = url.includes('?') ? '&' : '?';
        return `${url}${sep}token=${encodeURIComponent(accessToken)}`;
    };

    const [isMenuVisible, setIsMenuVisible] = useState(false);
    const handleMenuPress = () => setIsMenuVisible(true);
    const handleMenuClose = () => setIsMenuVisible(false);
    const handleHomePress = () => navigation.navigate('Home');

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasCurrentMarca, setHasCurrentMarca] = useState(true);
    const [marcaId, setMarcaId] = useState<number | null>(null);

    // IDs de current_marca para inicialización
    const [marcaPuestoId, setMarcaPuestoId] = useState<number | null>(null);

    // Estructura principal (main_structure) para filtros jerárquicos (Empresa → ... → Puesto)
    const [structure, setStructure] = useState<any[]>([]);
    const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
    const [filterEmpresaId, setFilterEmpresaId] = useState<number | null>(null);
    const [filterClienteId, setFilterClienteId] = useState<number | null>(null);
    const [filterDivisionId, setFilterDivisionId] = useState<number | null>(null);
    const [filterContratoId, setFilterContratoId] = useState<number | null>(null);
    const [filterCorpoId, setFilterCorpoId] = useState<number | null>(null);
    const [filterPuestoId, setFilterPuestoId] = useState<number | null>(null);
    const didInitFiltersFromMarca = useRef(false);
    const lastMarcaPuestoIdRef = useRef<number | null>(null);
    const isFetchingReportesRef = useRef(false);

    const activePuestoId = filterPuestoId ?? marcaPuestoId;


    // Nota: este módulo ahora lista artículos del puesto (Plan + Asignado) y sus mantenimientos
    const [reportes, setReportes] = useState<ArticuloPuestoMantenimientoItem[]>([]);
    const [selectedReporte, setSelectedReporte] = useState<ArticuloPuestoMantenimientoItem | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitResponse, setSubmitResponse] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const [activos, setActivos] = useState<ArticuloMantenimiento[]>([]);
    const [showActivos, setShowActivos] = useState(false);
    const [selectedActivo, setSelectedActivo] = useState<ArticuloMantenimiento | null>(null);
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
    const [numeroBoletaProveeduria, setNumeroBoletaProveeduria] = useState<string>('');
    const [tipo, setTipo] = useState<string>('');
    const [marca, setMarca] = useState<string>('');
    const [modelo, setModelo] = useState<string>('');
    const [seriePlaca, setSeriePlaca] = useState<string>('');
    const [marcaNuevo, setMarcaNuevo] = useState<string>('');
    const [modeloNuevo, setModeloNuevo] = useState<string>('');
    const [seriePlacaNuevo, setSeriePlacaNuevo] = useState<string>('');
    const [categoria, setCategoria] = useState<string>('');
    const [tipoMantenimientoArticulo, setTipoMantenimientoArticulo] = useState<string>('');
    const [tipoMantenimientoReincidencia, setTipoMantenimientoReincidencia] = useState<string>('');
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

    // Formulario especial: armas (se guarda como string en mant_armas_form)
    const [esArma, setEsArma] = useState<boolean>(false);
    const [armaTipoArma, setArmaTipoArma] = useState<'Letal' | 'Menos Letal' | ''>('');
    const [armaMecanismo, setArmaMecanismo] = useState<'Pistola' | 'Revolver' | ''>('');
    const [armaMarca, setArmaMarca] = useState<string>('');
    const [armaModelo, setArmaModelo] = useState<string>('');
    const [armaSerie, setArmaSerie] = useState<string>('');
    const [armaCalibre, setArmaCalibre] = useState<string>('');
    const [armaCargadorAdicional, setArmaCargadorAdicional] = useState<boolean>(false);
    const [armaCargadorCantidad, setArmaCargadorCantidad] = useState<string>('');
    const [armaCapacidadBalas, setArmaCapacidadBalas] = useState<string>('');
    const [armaPreventivoChecks, setArmaPreventivoChecks] = useState<Record<string, boolean>>({});
    const [armaCorrectivoChecks, setArmaCorrectivoChecks] = useState<Record<string, boolean>>({});
    // Fotos de armas: se guardan como adjuntos (igual que el resto de imágenes), no dentro del JSON
    const [armaFotoAntesName, setArmaFotoAntesName] = useState<string>('');
    const [armaFotoDespuesName, setArmaFotoDespuesName] = useState<string>('');
    const [armaFotoAntesLocal, setArmaFotoAntesLocal] = useState<ActivoFileLocal | null>(null);
    const [armaFotoDespuesLocal, setArmaFotoDespuesLocal] = useState<ActivoFileLocal | null>(null);
    const [armaDiagnostico, setArmaDiagnostico] = useState<string>('');
    const [armaArmeroNombre, setArmaArmeroNombre] = useState<string>('');
    const [armaFirma, setArmaFirma] = useState<string>('');
    const [mantArmasForm, setMantArmasForm] = useState<string>('');

    // Modal firma (arma)
    const [isArmaSignatureModalVisible, setIsArmaSignatureModalVisible] = useState(false);
    const armaSignatureRef = useRef<any>(null);
    const [armaSignatureKey, setArmaSignatureKey] = useState(0);
    const [isReadingArmaSignature, setIsReadingArmaSignature] = useState(false);

    // Submódulo: Movimiento de activos (CRUD dentro de modal)
    const { scanQR, QRScannerComponent } = useQRScanner();
    const [isMovModalVisible, setIsMovModalVisible] = useState(false);
    const [movActivo, setMovActivo] = useState<ArticuloPuestoMantenimientoItem | null>(null);
    const [movimientos, setMovimientos] = useState<MovimientoArticuloMantenimientoItem[]>([]);
    const [movIsCreating, setMovIsCreating] = useState(false);
    const [movEditing, setMovEditing] = useState<MovimientoArticuloMantenimientoItem | null>(null);

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

    // Modal: ver cambios (auditoría)
    const [isCambiosModalVisible, setIsCambiosModalVisible] = useState(false);
    const [cambiosTitle, setCambiosTitle] = useState<string>('Cambios');
    const [cambiosItems, setCambiosItems] = useState<any[]>([]);
    const [expandedCambioId, setExpandedCambioId] = useState<number | null>(null);

    // Modal firma dibujada (entrega/recibe)
    const [isDrawSignatureModalVisible, setIsDrawSignatureModalVisible] = useState(false);
    const [drawSignatureTarget, setDrawSignatureTarget] = useState<'entrega' | 'recibe'>('entrega');
    const signatureRef = useRef<any>(null);
    const [signatureKey, setSignatureKey] = useState(0);
    const [isReadingSignature, setIsReadingSignature] = useState(false);
    const [location, setLocation] = useState<Location.LocationObject | null>(null);

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

    const estadoIsBueno = useCallback((value?: string | null) => {
        const v = String(value ?? '').trim().toLowerCase();
        return v === 'bueno';
    }, []);

    const toggleChecklistItem = useCallback((prev: Record<string, boolean>, key: string) => {
        return { ...prev, [key]: !prev[key] };
    }, []);

    const pickImageAsBase64 = useCallback(async () => {
        const res = await DocumentPicker.getDocumentAsync({
            type: 'image/*',
            copyToCacheDirectory: true,
            multiple: false,
        });
        if (res.canceled) return null;
        const asset = res.assets?.[0];
        if (!asset?.uri) return null;

        const blob = await fetch(asset.uri).then(r => r.blob());
        const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result;
                if (typeof result !== 'string') return reject(new Error('No se pudo leer la imagen'));
                // result = "data:mime;base64,XXXX"
                const idx = result.indexOf('base64,');
                if (idx === -1) return reject(new Error('Formato base64 inválido'));
                resolve(result.substring(idx + 'base64,'.length));
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });

        return { mime: blob.type || 'image/jpeg', base64 };
    }, []);

    const pickArmaImageAsFile = useCallback(async (baseName: string) => {
        const result = await DocumentPicker.getDocumentAsync({
            type: 'image/*',
            multiple: false,
            copyToCacheDirectory: true,
        });

        if (result.canceled || !result.assets || result.assets.length === 0) return null;

        const asset = result.assets[0];
        const response = await fetch(asset.uri);
        const blob = await response.blob();

        const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const r = reader.result;
                if (typeof r === 'string') {
                    const parts = r.split(',');
                    resolve(parts.length > 1 ? parts[1] : parts[0]);
                } else {
                    reject(new Error('No se pudo leer la imagen seleccionada'));
                }
            };
            reader.onerror = () => reject(reader.error ?? new Error('Error al leer la imagen seleccionada'));
            reader.readAsDataURL(blob);
        });

        let extension = '';
        if (asset.name && asset.name.includes('.')) {
            extension = asset.name.split('.').pop() || '';
        } else if (blob.type && blob.type.includes('/')) {
            extension = blob.type.split('/').pop() || '';
        }
        if (!extension) extension = 'jpg';

        const localId = `arma_file_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        const fileName = `${baseName}.${extension}`;

        const newFile: ActivoFileLocal = {
            id: localId,
            type: 'image',
            name: fileName,
            extension,
            base64,
            uri: asset.uri,
            mimeType: blob.type || asset.mimeType,
        };

        return newFile;
    }, []);

    const openArmaSignatureModal = useCallback(() => {
        setArmaSignatureKey(k => k + 1);
        setIsReadingArmaSignature(false);
        setIsArmaSignatureModalVisible(true);
    }, []);

    const closeArmaSignatureModal = useCallback(() => {
        setIsArmaSignatureModalVisible(false);
        setIsReadingArmaSignature(false);
    }, []);

    const clearArmaSignatureInModal = useCallback(() => {
        if (armaSignatureRef.current) {
            armaSignatureRef.current.clearSignature();
        }
    }, []);

    const acceptArmaSignature = useCallback(() => {
        if (armaSignatureRef.current) {
            armaSignatureRef.current.readSignature();
        }
    }, []);

    const handleArmaSignatureRead = useCallback((signature: string) => {
        setIsReadingArmaSignature(true);
        setArmaFirma(signature);
        setTimeout(() => {
            setIsReadingArmaSignature(false);
            closeArmaSignatureModal();
        }, 300);
    }, [closeArmaSignatureModal]);

    useEffect(() => {
        if (!esArma) {
            setMantArmasForm('');
            return;
        }
        const formObj = {
            version: 1,
            caracteristicas: {
                tipo_arma: armaTipoArma || null,
                mecanismo: armaMecanismo || null,
                marca: armaMarca || null,
                modelo: armaModelo || null,
                serie: armaSerie || null,
                calibre: armaCalibre || null,
                cargador_adicional: armaCargadorAdicional,
                cargador_cantidad: armaCargadorCantidad || null,
                capacidad_balas: armaCapacidadBalas || null,
            },
            mantenimiento: {
                tipo: tipo || null,
                preventivo: armaPreventivoChecks,
                correctivo: armaCorrectivoChecks,
            },
            diagnostico: armaDiagnostico || null,
            foto_antes_nombre: armaFotoAntesName || null,
            foto_despues_nombre: armaFotoDespuesName || null,
            armero_nombre: armaArmeroNombre || null,
            firma: armaFirma || null,
        };
        setMantArmasForm(JSON.stringify(formObj));
    }, [
        armaCalibre,
        armaCapacidadBalas,
        armaCargadorAdicional,
        armaCargadorCantidad,
        armaCorrectivoChecks,
        armaDiagnostico,
        armaFirma,
        armaFotoAntesName,
        armaFotoDespuesName,
        armaMarca,
        armaMecanismo,
        armaModelo,
        armaArmeroNombre,
        armaPreventivoChecks,
        armaSerie,
        armaTipoArma,
        esArma,
        tipo,
    ]);

    const dateToLocalString = (d: Date | null): string => {
        if (!d) return '';
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

    const formatDateForDisplay = (value: Date | string | null): string => {
        if (!value) return '';
        if (value instanceof Date) {
            return formatYMDToDMY(dateToLocalString(value));
        }
        return formatYMDToDMY(value);
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

    const dateTimeToLocalString = (d: Date | string | null): string => {
        if (!d) return '';
        const date = typeof d === 'string' ? new Date(d) : d;
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hh = String(date.getHours()).padStart(2, '0');
        const mm = String(date.getMinutes()).padStart(2, '0');
        return `${day}-${m}-${y} ${hh}:${mm}`;
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

    const getConnectionStatus = useCallback(async (): Promise<boolean> => {
        const state = await Network.getNetworkStateAsync();
        // `isInternetReachable` puede venir null/undefined aunque haya internet.
        // Solo consideramos offline cuando explícitamente es false.
        if (!state.isConnected) return false;
        if (state.isInternetReachable === false) return false;
        return true;
    }, []);

    const closeCambiosModal = () => {
        setIsCambiosModalVisible(false);
        setCambiosItems([]);
        setExpandedCambioId(null);
    };

    const formatCambioCreatedAt = (value: any) => {
        if (!value) return '';
        try {
            const d = new Date(String(value));
            if (isNaN(d.getTime())) return String(value);
            const day = d.getDate().toString().padStart(2, '0');
            const month = (d.getMonth() + 1).toString().padStart(2, '0');
            const year = d.getFullYear();
            const hours = d.getHours().toString().padStart(2, '0');
            const minutes = d.getMinutes().toString().padStart(2, '0');
            return `${day}/${month}/${year} ${hours}:${minutes}`;
        } catch {
            return String(value);
        }
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
    }, [getConnectionStatus, refreshAccessToken, logout]);


    const loadMarcaContext = async () => {
        const currentMarcaStr = await AsyncStorage.getItem('current_marca');
        if (!currentMarcaStr) {
            setHasCurrentMarca(false);
            setMarcaPuestoId(null);
            return null;
        }
        const current = JSON.parse(currentMarcaStr);
        if (!current?.id) {
            setHasCurrentMarca(false);
            setMarcaPuestoId(null);
            return null;
        }
        setHasCurrentMarca(true);
        setMarcaId(current.id);

        const puestoIdRaw = current?.puesto?.id ?? current?.puesto_id;

        setMarcaPuestoId(puestoIdRaw !== undefined && puestoIdRaw !== null ? Number(puestoIdRaw) : null);

        return current;
    };

    const findPathByPuestoId = useCallback((tree: any[], targetPuestoId: number) => {
        for (const empresa of tree) {
            for (const cliente of empresa?.clientes || []) {
                for (const division of cliente?.division || []) {
                    for (const contrato of division?.contratos || []) {
                        for (const sucursal of contrato?.sucursales || []) {
                            const puesto = (sucursal?.puestos || []).find((p: any) => Number(p.id) === Number(targetPuestoId));
                            if (puesto) {
                                return {
                                    empresaId: Number(empresa.id),
                                    clienteId: Number(cliente.id),
                                    divisionId: Number(division.id),
                                    contratoId: Number(contrato.id),
                                    sucursalId: Number(sucursal.id),
                                    puestoId: Number(puesto.id),
                                };
                            }
                        }
                    }
                }
            }
        }
        return null;
    }, []);

    const fetchMainStructure = useCallback(async () => {
        try {
            const cacheStr = await AsyncStorage.getItem('main_structure_cache');
            if (cacheStr) {
                const parsed = JSON.parse(cacheStr);
                if (Array.isArray(parsed)) setStructure(parsed);
            }

            const isConnected = await getConnectionStatus();
            if (!isConnected) return;

            const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
            if (!apiUrl) return;

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

            if (response.ok) {
                const data = await response.json();
                if (data.status && Array.isArray(data.structure)) {
                    setStructure(data.structure);
                    await AsyncStorage.setItem('main_structure_cache', JSON.stringify(data.structure));
                }
            }
        } catch (e) {
            console.error('Error fetching main structure:', e);
        }
    }, [getConnectionStatus, refreshAccessToken, logout]);

    const applyFiltersFromPuestoId = useCallback((puestoIdToApply: number | null) => {
        if (!puestoIdToApply) return;
        const path = findPathByPuestoId(filterEmpresas, puestoIdToApply);
        if (!path) return;
        setFilterEmpresaId(path.empresaId);
        setFilterClienteId(path.clienteId);
        setFilterDivisionId(path.divisionId);
        setFilterContratoId(path.contratoId);
        setFilterCorpoId(path.sucursalId);
        setFilterPuestoId(path.puestoId);
    }, [filterEmpresas, findPathByPuestoId]);

    const resetFiltersToCurrentMarca = useCallback(() => {
        // Reinicia el árbol al puesto de current_marca (si existe)
        setFilterEmpresaId(null);
        setFilterClienteId(null);
        setFilterDivisionId(null);
        setFilterContratoId(null);
        setFilterCorpoId(null);
        setFilterPuestoId(null);
        if (marcaPuestoId) {
            // Se aplica en el siguiente tick cuando los nodos estén listos
            setTimeout(() => applyFiltersFromPuestoId(marcaPuestoId), 0);
        }
    }, [applyFiltersFromPuestoId, marcaPuestoId]);

    const didFetchMainStructureOnceRef = useRef(false);

    const fetchCategoriasMantenimiento = async () => {
        try {
            const isConnected = await getConnectionStatus();
            if (isConnected) {
                const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
                if (!apiUrl) return;

                const response = await authedFetch({
                    url: `${apiUrl}/api/categoria-mantenimiento`,
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

    const getMainStructureTree = useCallback(async (): Promise<any[] | null> => {
        if (Array.isArray(structure) && structure.length > 0) return structure;
        const cacheStr = await AsyncStorage.getItem('main_structure_cache');
        if (!cacheStr) return null;
        try {
            const parsed = JSON.parse(cacheStr);
            return Array.isArray(parsed) ? parsed : null;
        } catch {
            return null;
        }
    }, [structure]);

    const findPuestoNodeInTree = useCallback((tree: any[], targetPuestoId: number) => {
        for (const empresa of tree) {
            for (const cliente of empresa?.clientes || []) {
                for (const division of cliente?.division || []) {
                    for (const contrato of division?.contratos || []) {
                        for (const sucursal of contrato?.sucursales || []) {
                            const puesto = (sucursal?.puestos || []).find((p: any) => Number(p.id) === Number(targetPuestoId));
                            if (puesto) return puesto;
                        }
                    }
                }
            }
        }
        return null;
    }, []);

    const normalizeArticuloSource = useCallback((tipoRaw: any): 'plan' | 'asignado' => {
        const tipo = String(tipoRaw || '').toLowerCase();
        if (tipo.includes('asignado')) return 'asignado';
        return 'plan';
    }, []);

    const getArticuloFromMainStructure = useCallback(async (opts: { puestoId: number; source: 'plan' | 'asignado'; estructuraId: number }) => {
        const tree = await getMainStructureTree();
        if (!tree) return null;
        const puestoNode: any = findPuestoNodeInTree(tree, opts.puestoId);
        const articulosRaw: any[] = Array.isArray(puestoNode?.articulos) ? puestoNode.articulos : [];
        return articulosRaw.find((a: any) => {
            const source = normalizeArticuloSource(a?.tipo);
            return Number(a?.id) === Number(opts.estructuraId) && source === opts.source;
        }) ?? null;
    }, [findPuestoNodeInTree, getMainStructureTree, normalizeArticuloSource]);

    const fetchReportes = async () => {
        // Evitar llamadas múltiples simultáneas
        if (isFetchingReportesRef.current) {
            return;
        }

        try {
            isFetchingReportesRef.current = true;
            setIsLoading(true);
            setError(null);

            const current = await loadMarcaContext();
            const currentMarcaId = current?.id ?? marcaId;
            if (!currentMarcaId) {
                setHasCurrentMarca(false);
                setReportes([]);
                setIsLoading(false);
                isFetchingReportesRef.current = false;
                return;
            }

            const puestoIdForQuery = activePuestoId ?? marcaPuestoId ?? null;
            if (!puestoIdForQuery) {
                setError('Puesto no especificado');
                setReportes([]);
                setIsLoading(false);
                isFetchingReportesRef.current = false;
                return;
            }
            const cacheKey = `mantenimiento_equipo_${String(puestoIdForQuery ?? 'current')}_cache`;

            const normalizeMantenimiento = (m: any): ArticuloMantenimiento => ({
                ...m,
                id_local: m.id_local || '',
                archivos: Array.isArray(m.c_archivos_adjuntos_articulo_mantenimiento)
                    ? m.c_archivos_adjuntos_articulo_mantenimiento.map((a: any) => ({
                        id: a.id,
                        name: a.name,
                        original_name: a.original_name,
                        type: a.type,
                        extension: a.extension,
                    }))
                    : Array.isArray(m.archivos)
                        ? m.archivos
                        : [],
            });

            const isConnected = await getConnectionStatus();
            if (isConnected) {
                const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
                if (!apiUrl) {
                    throw new Error('Server URL not configured');
                }

                const url = `${apiUrl}/api/articulo-mantenimiento/puesto/${puestoIdForQuery}`;

                console.log('url: ', url);

                const response = await authedFetch({
                    url,
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
                    setIsLoading(false);
                    isFetchingReportesRef.current = false;
                    return;
                }

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                if (data.status && Array.isArray(data.data)) {
                    const list: ArticuloPuestoMantenimientoItem[] = data.data.map((it: any) => ({
                        ...it,
                        tipos_mantenimiento: Array.isArray(it.tipos_mantenimiento) ? it.tipos_mantenimiento : [],
                        mantenimientos: Array.isArray(it.mantenimientos) ? it.mantenimientos.map(normalizeMantenimiento) : [],
                        movimientos: Array.isArray(it.movimientos) ? it.movimientos : [],
                    }));
                    setReportes(list);
                    await AsyncStorage.setItem(cacheKey, JSON.stringify(list));
                } else {
                    setError(data.message || 'Error al cargar artículos');
                    const cacheStr = await AsyncStorage.getItem(cacheKey);
                    if (cacheStr) {
                        setReportes(JSON.parse(cacheStr));
                    } else {
                        setReportes([]);
                    }
                }
            } else {
                // Offline: mostrar artículos del puesto desde main_structure_cache
                const tree = await getMainStructureTree();
                if (tree && puestoIdForQuery) {
                    const puestoNode: any = findPuestoNodeInTree(tree, puestoIdForQuery);
                    const articulosRaw: any[] = Array.isArray(puestoNode?.articulos) ? puestoNode.articulos : [];
                    const listFromStructure: ArticuloPuestoMantenimientoItem[] = articulosRaw.map((a: any) => {
                        const source = normalizeArticuloSource(a?.tipo);
                        const estructuraId = Number(a.id);
                        const ultimo = a.ultimo_mantenimiento ?? a.ultimo_registro_mantenimiento ?? null;
                        const mantenimientosOffline = Array.isArray(a.mantenimientos)
                            ? a.mantenimientos.map(normalizeMantenimiento)
                            : ultimo
                                ? [normalizeMantenimiento(ultimo)]
                                : [];
                        return {
                            key: `${source}-${estructuraId}`,
                            source,
                            estructura_id: estructuraId,
                            articulo_nomenclador_id: Number.isFinite(Number(a?.articulo_nomenclador_id))
                                ? Number(a.articulo_nomenclador_id)
                                : null,
                            articulo_nombre: a.nombre ?? 'Desconocido',
                            tipo: source === 'plan' ? 'Plan de puesto' : 'Asignado al puesto',
                            marca: a.marca ?? null,
                            serie: a.serie ?? null,
                            tipos_mantenimiento: Array.isArray(a.tipos_mantenimiento) ? a.tipos_mantenimiento : [],
                            mantenimientos: mantenimientosOffline,
                            movimientos: Array.isArray(a.movimientos) ? a.movimientos : [],
                            ultimo_mantenimiento: ultimo,
                        };
                    });

                    if (listFromStructure.length > 0) {
                        setReportes(listFromStructure);
                        await AsyncStorage.setItem(cacheKey, JSON.stringify(listFromStructure));
                    } else {
                        // Fallback: cache propio del módulo si no hay estructura disponible
                        const cacheStr = await AsyncStorage.getItem(cacheKey);
                        if (cacheStr) {
                            setReportes(JSON.parse(cacheStr));
                        } else {
                            setReportes([]);
                        }
                    }
                } else {
                    // Fallback: cache propio del módulo si no hay estructura disponible
                    const cacheStr = await AsyncStorage.getItem(cacheKey);
                    if (cacheStr) {
                        setReportes(JSON.parse(cacheStr));
                    } else {
                        setReportes([]);
                    }
                }
            }
        } catch (e: any) {
            setError(e.message || 'Error al cargar artículos');
            const puestoIdForQuery = activePuestoId ?? null;
            const cacheKey = `mantenimiento_equipo_${String(puestoIdForQuery ?? 'current')}_cache`;
            const cacheStr = await AsyncStorage.getItem(cacheKey);
            if (cacheStr) {
                setReportes(JSON.parse(cacheStr));
            } else {
                setReportes([]);
            }
        } finally {
            setIsLoading(false);
            isFetchingReportesRef.current = false;
        }
    };

    // Ahora los "activos" son los últimos registros de `c_articulo_mantenimiento` del artículo seleccionado
    // Online vienen en el payload (últimos 8). Offline: se toman desde `main_structure_cache` (último mantenimiento o lista si existe).
    const fetchActivos = async (item: ArticuloPuestoMantenimientoItem) => {
        try {
            setIsLoading(true);
            const isConnected = await getConnectionStatus();
            if (isConnected) {
                const list = Array.isArray(item.mantenimientos) ? item.mantenimientos : [];
                setActivos(list);
                return;
            }

            // Offline: preferir main_structure_cache
            if (activePuestoId && item?.estructura_id) {
                const artNode = await getArticuloFromMainStructure({
                    puestoId: activePuestoId,
                    source: item.source,
                    estructuraId: item.estructura_id,
                });
                const ultimoMainStructure = artNode?.ultimo_mantenimiento ?? artNode?.ultimo_registro_mantenimiento ?? null;
                const mantenimientosOffline = Array.isArray(artNode?.mantenimientos)
                    ? artNode.mantenimientos.map((m: any) => ({ ...m, id_local: m.id_local || '', archivos: Array.isArray(m.archivos) ? m.archivos : [] }))
                    : ultimoMainStructure
                        ? [{ ...ultimoMainStructure, id_local: '', archivos: [] }]
                        : [];

                if (mantenimientosOffline.length > 0) {
                    setActivos(mantenimientosOffline as any);
                    return;
                }
            }

            // Fallback: lo que ya tenga el item
            if (Array.isArray(item.mantenimientos) && item.mantenimientos.length > 0) {
                setActivos(item.mantenimientos);
            } else if ((item as any).ultimo_mantenimiento) {
                setActivos([{ ...(item as any).ultimo_mantenimiento, id_local: '', archivos: [] }] as any);
            } else {
                setActivos([]);
            }
        } finally {
            setIsLoading(false);
        }
    };

    // Cargar contexto de marca al entrar (solo contexto). No debe disparar /api/main-structure en loop.
    useFocusEffect(
        useCallback(() => {
            (async () => {
                await loadMarcaContext();
            })();
        }, [])
    );

    // Cargar estructura principal una sola vez al montar la pantalla
    useEffect(() => {
        if (didFetchMainStructureOnceRef.current) return;
        didFetchMainStructureOnceRef.current = true;
        fetchMainStructure();
    }, [fetchMainStructure]);

    // Inicializar filtros (Empresa → ... → Puesto) a partir del puesto de `current_marca`
    useEffect(() => {
        if (!marcaPuestoId) return;
        if (!filterEmpresas.length) return;

        const prevMarcaPuestoId = lastMarcaPuestoIdRef.current;
        const shouldSyncToMarca =
            filterPuestoId === null || (prevMarcaPuestoId !== null && Number(filterPuestoId) === Number(prevMarcaPuestoId));

        if (!didInitFiltersFromMarca.current) {
            applyFiltersFromPuestoId(marcaPuestoId);
            didInitFiltersFromMarca.current = true;
        } else if (prevMarcaPuestoId !== null && prevMarcaPuestoId !== marcaPuestoId && shouldSyncToMarca) {
            applyFiltersFromPuestoId(marcaPuestoId);
        }

        lastMarcaPuestoIdRef.current = marcaPuestoId;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [marcaPuestoId, filterEmpresas, applyFiltersFromPuestoId]);

    // Cargar artículos del puesto (plan + asignados) al entrar / cuando cambia la marca actual
    useEffect(() => {
        if (!hasCurrentMarca) return;
        fetchReportes();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [marcaId, activePuestoId, hasCurrentMarca]);

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
        // Re-registrar para que use el puesto activo actual
    }, [activePuestoId, marcaId, hasCurrentMarca]);

    const handleVerActivos = async (reporte: ArticuloPuestoMantenimientoItem) => {
        let reporteToUse = reporte;
        const isConnected = await getConnectionStatus();
        if (!isConnected && activePuestoId && reporte?.estructura_id) {
            const artNode = await getArticuloFromMainStructure({
                puestoId: activePuestoId,
                source: reporte.source,
                estructuraId: reporte.estructura_id,
            });
            if (artNode) {
                reporteToUse = {
                    ...reporte,
                    articulo_nomenclador_id: Number.isFinite(Number(artNode?.articulo_nomenclador_id))
                        ? Number(artNode.articulo_nomenclador_id)
                        : reporte.articulo_nomenclador_id,
                    tipos_mantenimiento: Array.isArray(artNode?.tipos_mantenimiento)
                        ? artNode.tipos_mantenimiento
                        : (reporte.tipos_mantenimiento || []),
                    movimientos: Array.isArray(artNode?.movimientos)
                        ? artNode.movimientos
                        : (reporte.movimientos || []),
                };
            }
        }
        setSelectedReporte(reporteToUse);
        setShowActivos(true);
        fetchActivos(reporteToUse);
    };

    const handleVolverReportes = () => {
        setShowActivos(false);
        setSelectedReporte(null);
        setActivos([]);
        setSelectedActivo(null);
        setIsUpdating(false);
        resetForm();
    };

    const handleActualizar = (activo: ArticuloMantenimiento) => {
        setSelectedActivo(activo);
        setIsUpdating(true);
        setShowActivos(false);

        // Cargar datos del activo en el formulario
        setFechaSolucion(activo.fecha_solucion ? new Date(activo.fecha_solucion) : null);
        setAccion(activo.accion || '');
        setFechaInicio(activo.fecha_inicio ? new Date(activo.fecha_inicio) : null);
        setNumeroBoletaProveeduria(activo.numero_boleta_proveeduria || '');
        setTipo(activo.tipo || '');
        setMarca(activo.marca || '');
        setModelo(activo.modelo || '');
        setSeriePlaca(activo.serie_placa || '');
        setMarcaNuevo(activo.marca_nuevo || '');
        setModeloNuevo(activo.modelo_nuevo || '');
        setSeriePlacaNuevo(activo.serie_placa_nuevo || '');
        setCategoria(activo.categoria || '');
        setTipoMantenimientoArticulo(activo.tipo_mantenimiento_art || '');
        setTipoMantenimientoReincidencia(activo.tipo_mant_art_reincid || '');
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
        setMarcarComoResuelto(activo.fecha_solucion !== null && activo.fecha_solucion !== undefined);

        // Formulario de armas (si existe)
        try {
            const raw = activo.mant_armas_form;
            if (raw && String(raw).trim().length > 0) {
                const parsed = JSON.parse(String(raw));
                setEsArma(true);
                const caracteristicas = parsed?.caracteristicas ?? {};
                const mantenimiento = parsed?.mantenimiento ?? parsed ?? {};
                setArmaTipoArma((caracteristicas?.tipo_arma as any) || '');
                setArmaMecanismo((caracteristicas?.mecanismo as any) || '');
                setArmaMarca(typeof caracteristicas?.marca === 'string' ? caracteristicas.marca : '');
                setArmaModelo(typeof caracteristicas?.modelo === 'string' ? caracteristicas.modelo : '');
                setArmaSerie(typeof caracteristicas?.serie === 'string' ? caracteristicas.serie : '');
                setArmaCalibre(typeof caracteristicas?.calibre === 'string' ? caracteristicas.calibre : '');
                setArmaCargadorAdicional(!!caracteristicas?.cargador_adicional);
                setArmaCargadorCantidad(typeof caracteristicas?.cargador_cantidad === 'string' ? caracteristicas.cargador_cantidad : '');
                setArmaCapacidadBalas(typeof caracteristicas?.capacidad_balas === 'string' ? caracteristicas.capacidad_balas : '');
                setArmaPreventivoChecks(mantenimiento?.preventivo && typeof mantenimiento.preventivo === 'object' ? mantenimiento.preventivo : {});
                setArmaCorrectivoChecks(mantenimiento?.correctivo && typeof mantenimiento.correctivo === 'object' ? mantenimiento.correctivo : {});
                setArmaDiagnostico(typeof parsed?.diagnostico === 'string' ? parsed.diagnostico : '');
                setArmaFotoAntesName(typeof parsed?.foto_antes_nombre === 'string' ? parsed.foto_antes_nombre : '');
                setArmaFotoDespuesName(typeof parsed?.foto_despues_nombre === 'string' ? parsed.foto_despues_nombre : '');
                setArmaFotoAntesLocal(null);
                setArmaFotoDespuesLocal(null);
                setArmaArmeroNombre(typeof parsed?.armero_nombre === 'string' ? parsed.armero_nombre : '');
                setArmaFirma(typeof parsed?.firma === 'string' ? parsed.firma : '');
                setMantArmasForm(String(raw));
            } else {
                setEsArma(false);
                setArmaTipoArma('');
                setArmaMecanismo('');
                setArmaMarca('');
                setArmaModelo('');
                setArmaSerie('');
                setArmaCalibre('');
                setArmaCargadorAdicional(false);
                setArmaCargadorCantidad('');
                setArmaCapacidadBalas('');
                setArmaPreventivoChecks({});
                setArmaCorrectivoChecks({});
                setArmaDiagnostico('');
                setArmaFotoAntesName('');
                setArmaFotoDespuesName('');
                setArmaFotoAntesLocal(null);
                setArmaFotoDespuesLocal(null);
                setArmaArmeroNombre('');
                setArmaFirma('');
                setMantArmasForm('');
            }
        } catch {
            setEsArma(false);
            setArmaTipoArma('');
            setArmaMecanismo('');
            setArmaMarca('');
            setArmaModelo('');
            setArmaSerie('');
            setArmaCalibre('');
            setArmaCargadorAdicional(false);
            setArmaCargadorCantidad('');
            setArmaCapacidadBalas('');
            setArmaPreventivoChecks({});
            setArmaCorrectivoChecks({});
            setArmaDiagnostico('');
            setArmaFotoAntesName('');
            setArmaFotoDespuesName('');
            setArmaFotoAntesLocal(null);
            setArmaFotoDespuesLocal(null);
            setArmaArmeroNombre('');
            setArmaFirma('');
            setMantArmasForm('');
        }

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
        setNumeroBoletaProveeduria('');
        setTipo('');
        setMarca('');
        setModelo('');
        setSeriePlaca('');
        setMarcaNuevo('');
        setModeloNuevo('');
        setSeriePlacaNuevo('');
        setCategoria('');
        setTipoMantenimientoArticulo('');
        setTipoMantenimientoReincidencia('');
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
        setEsArma(false);
        setArmaTipoArma('');
        setArmaMecanismo('');
        setArmaMarca('');
        setArmaModelo('');
        setArmaSerie('');
        setArmaCalibre('');
        setArmaCargadorAdicional(false);
        setArmaCargadorCantidad('');
        setArmaCapacidadBalas('');
        setArmaPreventivoChecks({});
        setArmaCorrectivoChecks({});
        setArmaFotoAntesName('');
        setArmaFotoDespuesName('');
        setArmaFotoAntesLocal(null);
        setArmaFotoDespuesLocal(null);
        setArmaDiagnostico('');
        setArmaArmeroNombre('');
        setArmaFirma('');
        setMantArmasForm('');
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
        return appendTokenToUrl(`${apiUrl}/api/articulo-mantenimiento/${activoId}/get-image/${encodeURIComponent(fileName)}`);
    };

    const getActivoAudioUrl = (activoId: number, fileName: string) => {
        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) return '';
        return appendTokenToUrl(`${apiUrl}/api/articulo-mantenimiento/${activoId}/get-audio/${encodeURIComponent(fileName)}`);
    };

    const getActivoVideoUrl = (activoId: number, fileName: string) => {
        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) return '';
        return appendTokenToUrl(`${apiUrl}/api/articulo-mantenimiento/${activoId}/get-video/${encodeURIComponent(fileName)}`);
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
            if (apiUrl) return appendTokenToUrl(`${apiUrl}/api/articulo-mantenimiento/${activoId}/get-file/${encodeURIComponent(file.name)}`);
        }

        if (file.url) return appendTokenToUrl(file.url);
        return '';
    };

    const updateMainStructureCacheIfSameUltimoMantenimiento = useCallback(
        async (params: {
            puestoId: number | null;
            source: 'plan' | 'asignado' | null;
            estructuraId: number | null;
            mantenimientoId: number | null;
            patch: Record<string, any>;
        }) => {
            try {
                const { puestoId, source, estructuraId, mantenimientoId, patch } = params;
                if (!puestoId || !source || !estructuraId || !mantenimientoId) return;

                const cacheStr = await AsyncStorage.getItem('main_structure_cache');
                if (!cacheStr) return;

                const tree = JSON.parse(cacheStr);
                if (!Array.isArray(tree)) return;

                const expectedTipo = source === 'plan' ? 'Plan' : 'Asignado';
                let updated = false;

                for (const empresa of tree) {
                    const clientes = empresa?.clientes || [];
                    for (const cliente of clientes) {
                        const divisiones = cliente?.division || [];
                        for (const division of divisiones) {
                            const contratos = division?.contratos || [];
                            for (const contrato of contratos) {
                                const sucursales = contrato?.sucursales || [];
                                for (const sucursal of sucursales) {
                                    const puestos = sucursal?.puestos || [];
                                    for (const puesto of puestos) {
                                        if (Number(puesto?.id) !== Number(puestoId)) continue;
                                        const articulos = Array.isArray(puesto?.articulos) ? puesto.articulos : [];
                                        for (const art of articulos) {
                                            if (Number(art?.id) !== Number(estructuraId)) continue;
                                            if (String(art?.tipo) !== expectedTipo) continue;

                                            const ultimo = art?.ultimo_mantenimiento;
                                            if (!ultimo || Number(ultimo?.id) !== Number(mantenimientoId)) continue;

                                            art.ultimo_mantenimiento = { ...ultimo, ...patch, id: mantenimientoId };
                                            updated = true;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                if (updated) {
                    await AsyncStorage.setItem('main_structure_cache', JSON.stringify(tree));
                }
            } catch (e) {
                console.error('Error updating main_structure_cache (ultimo_mantenimiento):', e);
            }
        },
        []
    );

    const handleSave = async () => {
        if (!selectedActivo) return;

        setIsSubmitting(true);
        setSubmitResponse(null);

        const isConnected = await getConnectionStatus();
        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) {
            setSubmitResponse({ type: 'error', message: 'Server URL not configured' });
            setIsSubmitting(false);
            return;
        }

        const filesPayload: ActivoFileLocal[] = [
            ...textFiles,
            ...imageFiles,
            ...audioFiles,
            ...videoFiles,
        ];

        // Fotos de armas (subidas como adjuntos estándar)
        if (esArma && armaFotoAntesLocal) {
            filesPayload.push(armaFotoAntesLocal);
        }
        if (esArma && armaFotoDespuesLocal) {
            filesPayload.push(armaFotoDespuesLocal);
        }

        const requestData: any = {
            accion: accion || null,
            fecha_inicio: fechaInicio ? fechaInicio.toISOString() : null,
            numero_boleta_proveeduria: numeroBoletaProveeduria || null,
            tipo: tipo || null,
            marca: marca || null,
            modelo: modelo || null,
            serie_placa: seriePlaca || null,
            marca_nuevo: accion === 'Reemplazar' ? (marcaNuevo || null) : null,
            modelo_nuevo: accion === 'Reemplazar' ? (modeloNuevo || null) : null,
            serie_placa_nuevo: accion === 'Reemplazar' ? (seriePlacaNuevo || null) : null,
            categoria: categoria || null,
            tipo_mantenimiento_art: tipoMantenimientoArticulo || null,
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
            tipo_mant_art_reincid: reincidenciaTreintaDias ? (tipoMantenimientoReincidencia || null) : null,
            mant_armas_form: esArma ? (mantArmasForm || null) : null,
            files: filesPayload.length > 0 ? JSON.stringify(
                filesPayload.map(f => ({
                    type: f.type,
                    original_name: f.name,
                    extension: f.extension,
                    file_base64: f.base64,
                }))
            ) : null,
        };

        // Regla "Marcar como resuelto":
        // - Si el registro ya tenía fecha_solucion, el checkbox debe verse marcado,
        //   pero NO enviamos marcar_como_resuelto=true para no sobre-escribir la fecha en el backend.
        if (marcarComoResuelto) {
            // Fecha solución desde getHoraAccion (tiempo servidor ajustado) y enviar a API
            let iso = '';
            try {
                const horaAccion = await getHoraAccion(); // ms epoch ajustado
                iso = new Date(Number(horaAccion)).toISOString();
            } catch {
                iso = new Date().toISOString();
            }

            requestData.marcar_como_resuelto = true;
            requestData.fecha_solucion = iso;

            // Cuando se marca como resuelto, actualizar estado a "Bueno" y cantidad_real = cantidad_necesaria
            requestData.estado = 'Bueno';
            requestData.cantidad_real = selectedActivo.cantidad_necesaria;
        } else {
            // Si se desmarca, permitir limpiar fecha_solucion
            requestData.fecha_solucion = null;
        }

        // Patch permitido para actualizar main_structure_cache (solo si el ultimo_mantenimiento coincide)
        const allowedKeys = new Set([
            'estado',
            'cantidad_real',
            'fecha_solucion',
            'accion',
            'fecha_inicio',
            'numero_boleta_proveeduria',
            'tipo',
            'marca',
            'modelo',
            'serie_placa',
            'marca_nuevo',
            'modelo_nuevo',
            'serie_placa_nuevo',
            'categoria',
            'tipo_mantenimiento_art',
            'fecha_salida',
            'fecha_entrada',
            'kilometraje',
            'mant_armas_form',
            'categoria_mantinimiento',
            'detalle',
            'numero_fc',
            'proveedor',
            'costo_mo',
            'costo_i',
            'iva',
            'costo_total',
            'fecha_fin',
            'reincidencia_treinta_dias',
            'tipo_mant_art_reincid',
        ]);
        const mainStructurePatch: Record<string, any> = {};
        for (const k of Array.from(allowedKeys)) {
            if (Object.prototype.hasOwnProperty.call(requestData, k)) {
                mainStructurePatch[k] = requestData[k];
            }
        }

        if (isConnected) {
            try {
                const response = await authedFetch({
                    url: `${apiUrl}/api/articulo-mantenimiento/${selectedActivo.id}`,
                    init: {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(requestData),
                    },
                    refreshAccessToken,
                    logout,
                });
                if (!response) return;

                if (response.ok) {
                    const data = await response.json();
                    if (data.status) {
                        await updateMainStructureCacheIfSameUltimoMantenimiento({
                            puestoId: activePuestoId,
                            source: selectedReporte?.source ?? null,
                            estructuraId: selectedReporte?.estructura_id ?? null,
                            mantenimientoId: selectedActivo.id,
                            patch: mainStructurePatch,
                        });
                        setSubmitResponse({ type: 'success', message: data.message || 'Mantenimiento actualizado correctamente' });
                        setTimeout(async () => {
                            setIsUpdating(false);
                            setSelectedActivo(null);
                            setShowActivos(true);
                            resetForm();
                            if (selectedReporte) {
                                await fetchActivos(selectedReporte);
                            }
                            await fetchReportes();
                        }, 2000);
                    } else {
                        setSubmitResponse({ type: 'error', message: data.message || 'No se pudo actualizar el mantenimiento' });
                    }
                } else {
                    setSubmitResponse({ type: 'error', message: 'No se pudo actualizar el mantenimiento' });
                }
            } catch (error: any) {
                setSubmitResponse({ type: 'error', message: error.message || 'No se pudo actualizar el mantenimiento' });
            } finally {
                setIsSubmitting(false);
            }
        } else {
            // Modo offline
            const localId = selectedActivo.id_local || generateRandomId();
            const actionsStr = await AsyncStorage.getItem('articulo_mantenimiento_actions');
            const actions = actionsStr ? JSON.parse(actionsStr) : [];
            actions.push({
                type: 'update',
                id: selectedActivo.id,
                id_local: localId,
                parentKey: selectedReporte?.key,
                // Metadatos para trazabilidad/sincronización (IDs del artículo/puesto)
                meta: {
                    puestoId: activePuestoId,
                    source: selectedReporte?.source ?? null,
                    estructuraId: selectedReporte?.estructura_id ?? null,
                },
                requestData,
            });
            await AsyncStorage.setItem('articulo_mantenimiento_actions', JSON.stringify(actions));

            // Actualizar cache
            const updatedActivos = activos.map((a) =>
                a.id === selectedActivo.id ? { ...a, ...requestData, id_local: localId } : a
            );
            setActivos(updatedActivos);
            // Actualizar el listado/caché para que el cambio sea visible sin conexión
            if (selectedReporte) {
                const nextMantenimientos = updatedActivos;
                const first = nextMantenimientos[0] ?? null;

                const nextReporte: ArticuloPuestoMantenimientoItem = {
                    ...selectedReporte,
                    mantenimientos: nextMantenimientos,
                    ultimo_mantenimiento: first
                        ? {
                            id: first.id,
                            estado: first.estado,
                            cantidad_necesaria: first.cantidad_necesaria,
                            cantidad_real: first.cantidad_real,
                            observaciones: first.observaciones,
                        }
                        : null,
                };

                setSelectedReporte(nextReporte);
                setReportes((prev) => prev.map((r) => (r.key === nextReporte.key ? nextReporte : r)));

                const cacheKey = `mantenimiento_equipo_${String(activePuestoId ?? 'current')}_cache`;
                const cacheStr = await AsyncStorage.getItem(cacheKey);
                const base = cacheStr ? JSON.parse(cacheStr) : reportes;
                const baseArr: any[] = Array.isArray(base) ? base : [];
                const nextCache = baseArr.map((r) => (r.key === nextReporte.key ? nextReporte : r));
                await AsyncStorage.setItem(cacheKey, JSON.stringify(nextCache));
            }

            await updateMainStructureCacheIfSameUltimoMantenimiento({
                puestoId: activePuestoId,
                source: selectedReporte?.source ?? null,
                estructuraId: selectedReporte?.estructura_id ?? null,
                mantenimientoId: selectedActivo.id,
                patch: mainStructurePatch,
            });

            setSubmitResponse({ type: 'success', message: 'Los cambios se sincronizarán cuando vuelva la conexión.' });
            setTimeout(async () => {
                setIsUpdating(false);
                setSelectedActivo(null);
                setShowActivos(true);
                resetForm();
                if (selectedReporte) {
                    await fetchActivos(selectedReporte);
                }
                await fetchReportes();
            }, 2000);
        }
        setIsSubmitting(false);
    };

    const renderReporte = (reporte: ArticuloPuestoMantenimientoItem) => {
        const ultimo = reporte.ultimo_mantenimiento;
        return (
            <ThemedView key={reporte.key} style={styles.bitacoraCard}>
                <ThemedText style={styles.bitTitle}>
                    {reporte.articulo_nombre} ({reporte.tipo})
                </ThemedText>

                <ThemedText style={styles.bitLine}>
                    <ThemedText style={styles.bitLabel}>Estado: </ThemedText>
                    <ThemedText
                        style={[
                            styles.bitValue,
                            estadoIsBueno(ultimo?.estado) ? styles.estadoBueno : styles.estadoMalo,
                        ]}
                    >
                        {ultimo?.estado ?? '-'}
                    </ThemedText>
                </ThemedText>
                <ThemedText style={styles.bitLine}>
                    <ThemedText style={styles.bitLabel}>Cantidad necesaria: </ThemedText>
                    <ThemedText style={styles.bitValue}>{ultimo?.cantidad_necesaria ?? '-'}</ThemedText>
                </ThemedText>
                <ThemedText style={styles.bitLine}>
                    <ThemedText style={styles.bitLabel}>Cantidad real: </ThemedText>
                    <ThemedText style={styles.bitValue}>{ultimo?.cantidad_real ?? '-'}</ThemedText>
                </ThemedText>
                <ThemedText style={styles.bitLine}>
                    <ThemedText style={styles.bitLabel}>Observaciones: </ThemedText>
                    <ThemedText style={styles.bitValue}>{ultimo?.observaciones ?? '-'}</ThemedText>
                </ThemedText>

                <ThemedView style={styles.listItemButtons}>
                    <TouchableOpacity
                        style={[styles.listItemButton, styles.viewButton]}
                        onPress={() => handleVerActivos(reporte)}
                    >
                        <Ionicons name="list" size={18} color="#FFFFFF" />
                        <ThemedText style={styles.listItemButtonText}>Mantenimientos</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.listItemButton, styles.movementsButton]}
                        onPress={() => openMovimientosModal(reporte)}
                    >
                        <Ionicons name="repeat" size={18} color="#FFFFFF" />
                        <ThemedText style={styles.listItemButtonText}>Movimientos</ThemedText>
                    </TouchableOpacity>
                </ThemedView>
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

    const renderActivo = (activo: ArticuloMantenimiento) => {
        const archivos = activo.archivos || [];
        const isSolucionado = activo.fecha_solucion !== null && activo.fecha_solucion !== undefined;
        const fechaFormateada = formatFechaSolucion(activo.fecha_solucion);

        return (
            <ThemedView key={activo.id} style={styles.bitacoraCard}>
                <ThemedView style={styles.activoHeader}>
                    <ThemedText style={styles.bitTitle}>
                        {selectedReporte?.articulo_nombre || 'Artículo'} - Mantenimiento #{activo.id}
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
                    <ThemedText
                        style={[
                            styles.bitValue,
                            estadoIsBueno(activo.estado) ? styles.estadoBueno : styles.estadoMalo,
                        ]}
                    >
                        {activo.estado}
                    </ThemedText>
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
                    <ActivoFilesViewer activoId={activo.id} files={archivos} accessToken={accessToken} />
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
                        style={[styles.listItemButton, styles.changesButton]}
                        onPress={() => {
                            setCambiosTitle(`Cambios - Mantenimiento #${activo.id}`);
                            fetchCambios('c_articulo_mantenimiento', activo.id);
                        }}
                    >
                        <Ionicons name="list-outline" size={18} color="#FFFFFF" />
                        <ThemedText style={styles.listItemButtonText}>Cambios</ThemedText>
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
        const actionsStr = await AsyncStorage.getItem('movimientos_articulos_mantenimiento_actions');
        const actions = actionsStr ? JSON.parse(actionsStr) : [];
        actions.push(action);
        await AsyncStorage.setItem('movimientos_articulos_mantenimiento_actions', JSON.stringify(actions));
    };

    const removeMovActionsForLocalId = async (localId: string) => {
        const actionsStr = await AsyncStorage.getItem('movimientos_articulos_mantenimiento_actions');
        if (!actionsStr) return;
        const actions = JSON.parse(actionsStr) || [];
        const updated = actions.filter((a: any) => a.id !== localId);
        await AsyncStorage.setItem('movimientos_articulos_mantenimiento_actions', JSON.stringify(updated));
    };

    const updateMovCreateActionForLocalId = async (localId: string, requestData: any) => {
        const actionsStr = await AsyncStorage.getItem('movimientos_articulos_mantenimiento_actions');
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
            await AsyncStorage.setItem('movimientos_articulos_mantenimiento_actions', JSON.stringify(updated));
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
            const token = await getValidAccessTokenOrLogout({ refreshAccessToken, logout });
            if (!token) return;
            const decodedToken: any = jwtDecode(token);
            const sessionId = decodedToken.sessionId;
            const horaAccion = String((await getHoraAccion()) ?? new Date().toISOString());
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

    const openMovimientosModal = async (activo: ArticuloPuestoMantenimientoItem) => {
        let activoToUse = activo;
        const isConnected = await getConnectionStatus();
        if (!isConnected && activePuestoId && activo?.estructura_id) {
            const artNode = await getArticuloFromMainStructure({
                puestoId: activePuestoId,
                source: activo.source,
                estructuraId: activo.estructura_id,
            });
            if (artNode) {
                activoToUse = {
                    ...activo,
                    movimientos: Array.isArray(artNode?.movimientos)
                        ? artNode.movimientos
                        : (activo.movimientos || []),
                    tipos_mantenimiento: Array.isArray(artNode?.tipos_mantenimiento)
                        ? artNode.tipos_mantenimiento
                        : (activo.tipos_mantenimiento || []),
                };
            }
        }
        setMovActivo(activoToUse);
        const current = await loadMarcaContext();
        if (!current?.id) {
            Alert.alert('Error', 'Marca no encontrada');
            return;
        }

        const cacheKey = `movimientos_articulo_${activoToUse.key}_cache`;
        if (isConnected && activoToUse.estructura_id) {
            const res = await listMovimientosArticuloMantenimiento({
                parent: { source: activoToUse.source, estructuraId: activoToUse.estructura_id },
                marcaId: current.id,
                refreshAccessToken,
                logout,
            });
            if (res.status && res.data) {
                const list = res.data.map((m: any) => ({ ...m, id_local: m.id_local || '' }));
                setMovimientos(list);
                await AsyncStorage.setItem(cacheKey, JSON.stringify(list));
            } else {
                setMovimientos(Array.isArray(activoToUse.movimientos) ? activoToUse.movimientos : []);
            }
        } else {
            // Offline: preferir main_structure_cache (fuente de verdad), luego cache local
            if (activePuestoId && activoToUse?.estructura_id) {
                const artNode = await getArticuloFromMainStructure({
                    puestoId: activePuestoId,
                    source: activoToUse.source,
                    estructuraId: activoToUse.estructura_id,
                });
                if (Array.isArray(artNode?.movimientos)) {
                    setMovimientos(artNode.movimientos.map((m: any) => ({ ...m, id_local: m.id_local || '' })));
                } else {
                    const cacheStr = await AsyncStorage.getItem(cacheKey);
                    if (cacheStr) {
                        const cached = JSON.parse(cacheStr);
                        setMovimientos(cached.map((m: any) => ({ ...m, id_local: m.id_local || '' })));
                    } else {
                        setMovimientos(Array.isArray(activoToUse.movimientos) ? activoToUse.movimientos : []);
                    }
                }
            } else {
                const cacheStr = await AsyncStorage.getItem(cacheKey);
                if (cacheStr) {
                    const cached = JSON.parse(cacheStr);
                    setMovimientos(cached.map((m: any) => ({ ...m, id_local: m.id_local || '' })));
                } else {
                    setMovimientos(Array.isArray(activoToUse.movimientos) ? activoToUse.movimientos : []);
                }
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

    const startMovEditing = (m: MovimientoArticuloMantenimientoItem) => {
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

    const persistMovimientosToActivosCache = async (
        parent: ArticuloPuestoMantenimientoItem,
        nextMovs: MovimientoArticuloMantenimientoItem[]
    ) => {
        const cacheKey = `movimientos_articulo_${parent.key}_cache`;
        await AsyncStorage.setItem(cacheKey, JSON.stringify(nextMovs));
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
            const parent = { source: movActivo.source, estructuraId: movActivo.estructura_id };
            if (isConnected && movActivo.estructura_id) {
                const res = await createMovimientoArticuloMantenimiento({ parent, requestData: payload, refreshAccessToken, logout });
                if (res.status) {
                    Alert.alert('Éxito', 'Movimiento creado correctamente');
                    setMovIsCreating(false);
                    await openMovimientosModal(movActivo);
                } else {
                    Alert.alert('Error', res.message || 'No se pudo crear el movimiento');
                }
            } else {
                const localId = `local-mov-${Date.now()}`;
                const localItem: MovimientoArticuloMantenimientoItem = {
                    id: 0,
                    id_local: localId,
                    articulo_plan_id: movActivo.source === 'plan' ? movActivo.estructura_id : null,
                    articulo_asignado_id: movActivo.source === 'asignado' ? movActivo.estructura_id : null,
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
                    parent,
                    puestoId: activePuestoId,
                    parentKey: movActivo.key,
                    requestData: payload,
                });
                Alert.alert('Guardado (offline)', 'El movimiento se sincronizará cuando vuelva la conexión.');
                setMovIsCreating(false);
            }
            return;
        }

        // update
        const isLocalMov = !!movEditing.id_local || movEditing.id === 0;
        const parent = { source: movActivo.source, estructuraId: movActivo.estructura_id };
        if (isConnected && !isLocalMov && movActivo.estructura_id) {
            const res = await updateMovimientoArticuloMantenimiento({ parent, id: movEditing.id, requestData: payload, refreshAccessToken, logout });
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
                        parent,
                        puestoId: activePuestoId,
                        parentKey: movActivo.key,
                        requestData: payload,
                    });
                }
            } else {
                await upsertMovAction({
                    type: 'update',
                    id: movEditing.id,
                    parent,
                    puestoId: activePuestoId,
                    parentKey: movActivo.key,
                    requestData: payload,
                });
            }

            Alert.alert('Guardado (offline)', 'Los cambios se sincronizarán cuando vuelva la conexión.');
            setMovIsCreating(false);
            setMovEditing(null);
        }
    };

    const handleMovDelete = async (m: MovimientoArticuloMantenimientoItem) => {
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

                    const parent = { source: movActivo.source, estructuraId: movActivo.estructura_id };
                    if (isConnected && movActivo.estructura_id) {
                        const res = await deleteMovimientoArticuloMantenimiento({ parent, id: m.id, marcaId: current.id, refreshAccessToken, logout });
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
                            parent,
                            marcaId: current.id,
                            puestoId: activePuestoId,
                            parentKey: movActivo.key,
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
        const showReemplazarFields = accion === 'Reemplazar';

        return (
            <ThemedView style={styles.formCard}>
                <ThemedText style={styles.formTitle}>Actualizar mantenimiento</ThemedText>

                <ThemedText style={styles.label}>Artículo:</ThemedText>
                <TextInput
                    style={[styles.input, styles.inputReadOnly]}
                    value={selectedReporte?.articulo_nombre || ''}
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
                        <Picker.Item label="Rellenar" value="Rellenar" />
                        <Picker.Item label="Reparar en puesto" value="Reparar en puesto" />
                        <Picker.Item label="Reparar en taller" value="Reparar en taller" />
                    </Picker>
                </View>

                <ThemedText style={styles.label}>Fecha inicio:</ThemedText>
                <TouchableOpacity style={styles.dateButton} onPress={() => setShowFechaInicioPicker(true)}>
                    <ThemedText style={styles.dateButtonText}>
                        {fechaInicio ? formatDateForDisplay(fechaInicio) : 'Seleccionar fecha'}
                    </ThemedText>
                    <Ionicons name="calendar-outline" size={18} color="#007AFF" />
                </TouchableOpacity>

                <ThemedText style={styles.label}>Número de boleta de proveduría:</ThemedText>
                <TextInput
                    style={styles.input}
                    value={numeroBoletaProveeduria}
                    onChangeText={setNumeroBoletaProveeduria}
                    placeholder="Número de boleta de proveduría"
                    placeholderTextColor="#999"
                />

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

                <ThemedView style={styles.checkboxContainer}>
                    <TouchableOpacity
                        style={[styles.checkbox, esArma ? styles.checkboxChecked : styles.checkboxUnchecked]}
                        onPress={() => {
                            if (esArma) {
                                setEsArma(false);
                                setArmaTipoArma('');
                                setArmaMecanismo('');
                                setArmaMarca('');
                                setArmaModelo('');
                                setArmaSerie('');
                                setArmaCalibre('');
                                setArmaCargadorAdicional(false);
                                setArmaCargadorCantidad('');
                                setArmaCapacidadBalas('');
                                setArmaPreventivoChecks({});
                                setArmaCorrectivoChecks({});
                                setArmaFotoAntesName('');
                                setArmaFotoDespuesName('');
                                setArmaFotoAntesLocal(null);
                                setArmaFotoDespuesLocal(null);
                                setArmaDiagnostico('');
                                setArmaArmeroNombre('');
                                setArmaFirma('');
                                setMantArmasForm('');
                            } else {
                                setEsArma(true);
                            }
                        }}
                        activeOpacity={0.8}
                    >
                        {esArma && <Ionicons name="checkmark" size={16} color="#fff" />}
                    </TouchableOpacity>
                    <ThemedText style={styles.checkboxLabel}>Es arma</ThemedText>
                </ThemedView>

                {esArma && (
                    <ThemedView style={styles.armasBox}>
                        <ThemedText style={styles.armasTitle}>Características</ThemedText>

                        <ThemedText style={styles.label}>Tipo de Arma:</ThemedText>
                        <View style={styles.pickerContainer}>
                            <Picker
                                selectedValue={armaTipoArma}
                                onValueChange={(value) => setArmaTipoArma(value)}
                                style={styles.picker}
                            >
                                <Picker.Item label="Seleccionar..." value="" />
                                <Picker.Item label="Letal" value="Letal" />
                                <Picker.Item label="Menos Letal" value="Menos Letal" />
                            </Picker>
                        </View>

                        <ThemedText style={styles.label}>Mecanismo:</ThemedText>
                        <View style={styles.pickerContainer}>
                            <Picker
                                selectedValue={armaMecanismo}
                                onValueChange={(value) => setArmaMecanismo(value)}
                                style={styles.picker}
                            >
                                <Picker.Item label="Seleccionar..." value="" />
                                <Picker.Item label="Pistola" value="Pistola" />
                                <Picker.Item label="Revolver" value="Revolver" />
                            </Picker>
                        </View>

                        <ThemedView style={styles.armasRow}>
                            <ThemedText style={styles.armasFieldLabel}>Marca:</ThemedText>
                            <TextInput style={styles.armasInlineInput} value={armaMarca} onChangeText={setArmaMarca} placeholder="Marca" placeholderTextColor="#999" />
                        </ThemedView>
                        <ThemedView style={styles.armasRow}>
                            <ThemedText style={styles.armasFieldLabel}>Modelo:</ThemedText>
                            <TextInput style={styles.armasInlineInput} value={armaModelo} onChangeText={setArmaModelo} placeholder="Modelo" placeholderTextColor="#999" />
                        </ThemedView>
                        <ThemedView style={styles.armasRow}>
                            <ThemedText style={styles.armasFieldLabel}>Serie:</ThemedText>
                            <TextInput style={styles.armasInlineInput} value={armaSerie} onChangeText={setArmaSerie} placeholder="Serie" placeholderTextColor="#999" />
                        </ThemedView>
                        <ThemedView style={styles.armasRow}>
                            <ThemedText style={styles.armasFieldLabel}>Calibre:</ThemedText>
                            <TextInput style={styles.armasInlineInput} value={armaCalibre} onChangeText={setArmaCalibre} placeholder="Calibre" placeholderTextColor="#999" />
                        </ThemedView>
                        <ThemedView style={styles.armasRow}>
                            <ThemedText style={styles.armasFieldLabel}>Cargador Adicional:</ThemedText>
                            <ThemedView style={styles.armasInlineRow}>
                                <TouchableOpacity
                                    style={[styles.armasMiniCheckbox, armaCargadorAdicional ? styles.armasMiniCheckboxChecked : styles.armasMiniCheckboxUnchecked]}
                                    onPress={() => setArmaCargadorAdicional((v) => !v)}
                                >
                                    {armaCargadorAdicional ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
                                </TouchableOpacity>
                                <ThemedText style={styles.armasInlineMuted}>Cantidad:</ThemedText>
                                <TextInput
                                    style={[styles.armasInlineInput, { flex: 1, marginBottom: 0 }]}
                                    value={armaCargadorCantidad}
                                    onChangeText={setArmaCargadorCantidad}
                                    placeholder="0"
                                    keyboardType="numeric"
                                    placeholderTextColor="#999"
                                    editable={armaCargadorAdicional}
                                />
                            </ThemedView>
                        </ThemedView>
                        <ThemedView style={styles.armasRow}>
                            <ThemedText style={styles.armasFieldLabel}>Capacidad Balas:</ThemedText>
                            <TextInput
                                style={styles.armasInlineInput}
                                value={armaCapacidadBalas}
                                onChangeText={setArmaCapacidadBalas}
                                placeholder="Capacidad"
                                keyboardType="numeric"
                                placeholderTextColor="#999"
                            />
                        </ThemedView>

                        <ThemedText style={styles.armasSectionTitle}>Foto Antes:</ThemedText>
                        <ThemedView style={styles.armasMediaRow}>
                            <TouchableOpacity
                                style={styles.armasMediaButton}
                                onPress={async () => {
                                    const imgFile = await pickArmaImageAsFile('arma_foto_antes');
                                    if (imgFile) {
                                        setArmaFotoAntesLocal(imgFile);
                                        setArmaFotoAntesName(imgFile.name);
                                    }
                                }}
                            >
                                <Ionicons name="camera" size={18} color="#fff" />
                                <ThemedText style={styles.armasMediaButtonText}>{(armaFotoAntesLocal || armaFotoAntesName) ? 'Cambiar' : 'Subir'}</ThemedText>
                            </TouchableOpacity>
                            {armaFotoAntesLocal ? (
                                <>
                                    <Image
                                        source={{ uri: `data:${armaFotoAntesLocal.mimeType || 'image/jpeg'};base64,${armaFotoAntesLocal.base64}` }}
                                        style={styles.armasThumb}
                                    />
                                    <TouchableOpacity
                                        style={styles.armasRemoveButton}
                                        onPress={() => {
                                            setArmaFotoAntesLocal(null);
                                            setArmaFotoAntesName('');
                                        }}
                                    >
                                        <Ionicons name="trash" size={18} color="#FF3B30" />
                                    </TouchableOpacity>
                                </>
                            ) : (armaFotoAntesName && selectedActivo?.archivos?.length ? (() => {
                                const remote = (selectedActivo.archivos || []).find((f) => f.original_name === armaFotoAntesName || f.name === armaFotoAntesName);
                                if (!remote) return null;
                                const uri = buildFileUrl(selectedActivo?.id, remote);
                                if (!uri) return null;
                                return (
                                    <>
                                        <Image source={{ uri }} style={styles.armasThumb} />
                                        <TouchableOpacity
                                            style={styles.armasRemoveButton}
                                            onPress={() => {
                                                // No borramos del servidor aquí; solo removemos del formulario y se reemplaza al guardar
                                                setArmaFotoAntesName('');
                                                setArmaFotoAntesLocal(null);
                                            }}
                                        >
                                            <Ionicons name="trash" size={18} color="#FF3B30" />
                                        </TouchableOpacity>
                                    </>
                                );
                            })() : null)}
                        </ThemedView>

                        {tipo === 'Preventivo' ? (
                            <>
                                <ThemedText style={styles.armasSectionTitle}>Mantenimiento Preventivo</ThemedText>
                                <ThemedView style={styles.armasChecklist}>
                                    {ARMAS_PREVENTIVO_ITEMS.map((it) => {
                                        const checked = !!armaPreventivoChecks[it.key];
                                        const padLeft = (it.level ?? 0) * 18;
                                        return (
                                            <TouchableOpacity
                                                key={it.key}
                                                style={[styles.armasChecklistRow, { paddingLeft: padLeft }]}
                                                onPress={() => setArmaPreventivoChecks((prev) => toggleChecklistItem(prev, it.key))}
                                                activeOpacity={0.8}
                                            >
                                                <View style={[styles.armasMiniCheckbox, checked ? styles.armasMiniCheckboxChecked : styles.armasMiniCheckboxUnchecked]}>
                                                    {checked ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
                                                </View>
                                                <ThemedText style={[styles.armasChecklistText, (it.level ?? 0) === 0 && { fontWeight: '800' }]}>{it.label}</ThemedText>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ThemedView>
                            </>
                        ) : tipo === 'Correctivo' ? (
                            <>
                                <ThemedText style={styles.armasSectionTitle}>Mantenimiento Correctivo</ThemedText>
                                <ThemedView style={styles.armasChecklist}>
                                    {ARMAS_CORRECTIVO_ITEMS.map((it) => {
                                        const checked = !!armaCorrectivoChecks[it.key];
                                        const padLeft = (it.level ?? 0) * 18;
                                        return (
                                            <TouchableOpacity
                                                key={it.key}
                                                style={[styles.armasChecklistRow, { paddingLeft: padLeft }]}
                                                onPress={() => setArmaCorrectivoChecks((prev) => toggleChecklistItem(prev, it.key))}
                                                activeOpacity={0.8}
                                            >
                                                <View style={[styles.armasMiniCheckbox, checked ? styles.armasMiniCheckboxChecked : styles.armasMiniCheckboxUnchecked]}>
                                                    {checked ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
                                                </View>
                                                <ThemedText style={[styles.armasChecklistText, (it.level ?? 0) === 0 && { fontWeight: '800' }]}>{it.label}</ThemedText>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ThemedView>
                            </>
                        ) : (
                            <ThemedText style={styles.armasHintMuted}>
                                Selecciona “Preventivo” o “Correctivo” para mostrar el formulario.
                            </ThemedText>
                        )}

                        <ThemedText style={styles.armasSectionTitle}>Diagnóstico:</ThemedText>
                        <TextInput
                            style={[styles.armasTextArea]}
                            value={armaDiagnostico}
                            onChangeText={setArmaDiagnostico}
                            placeholder="Diagnóstico"
                            placeholderTextColor="#999"
                            multiline
                        />

                        <ThemedText style={styles.armasSectionTitle}>Foto Después:</ThemedText>
                        <ThemedView style={styles.armasMediaRow}>
                            <TouchableOpacity
                                style={styles.armasMediaButton}
                                onPress={async () => {
                                    const imgFile = await pickArmaImageAsFile('arma_foto_despues');
                                    if (imgFile) {
                                        setArmaFotoDespuesLocal(imgFile);
                                        setArmaFotoDespuesName(imgFile.name);
                                    }
                                }}
                            >
                                <Ionicons name="camera" size={18} color="#fff" />
                                <ThemedText style={styles.armasMediaButtonText}>{(armaFotoDespuesLocal || armaFotoDespuesName) ? 'Cambiar' : 'Subir'}</ThemedText>
                            </TouchableOpacity>
                            {armaFotoDespuesLocal ? (
                                <>
                                    <Image
                                        source={{ uri: `data:${armaFotoDespuesLocal.mimeType || 'image/jpeg'};base64,${armaFotoDespuesLocal.base64}` }}
                                        style={styles.armasThumb}
                                    />
                                    <TouchableOpacity
                                        style={styles.armasRemoveButton}
                                        onPress={() => {
                                            setArmaFotoDespuesLocal(null);
                                            setArmaFotoDespuesName('');
                                        }}
                                    >
                                        <Ionicons name="trash" size={18} color="#FF3B30" />
                                    </TouchableOpacity>
                                </>
                            ) : (armaFotoDespuesName && selectedActivo?.archivos?.length ? (() => {
                                const remote = (selectedActivo.archivos || []).find((f) => f.original_name === armaFotoDespuesName || f.name === armaFotoDespuesName);
                                if (!remote) return null;
                                const uri = buildFileUrl(selectedActivo?.id, remote);
                                if (!uri) return null;
                                return (
                                    <>
                                        <Image source={{ uri }} style={styles.armasThumb} />
                                        <TouchableOpacity
                                            style={styles.armasRemoveButton}
                                            onPress={() => {
                                                setArmaFotoDespuesName('');
                                                setArmaFotoDespuesLocal(null);
                                            }}
                                        >
                                            <Ionicons name="trash" size={18} color="#FF3B30" />
                                        </TouchableOpacity>
                                    </>
                                );
                            })() : null)}
                        </ThemedView>

                        <ThemedText style={styles.armasSectionTitle}>Armero</ThemedText>
                        <ThemedText style={styles.armasFieldLabel}>Nombre Completo:</ThemedText>
                        <TextInput
                            style={styles.armasInlineInput}
                            value={armaArmeroNombre}
                            onChangeText={setArmaArmeroNombre}
                            placeholder="Nombre completo"
                            placeholderTextColor="#999"
                        />

                        <ThemedText style={styles.armasSectionTitle}>Firma:</ThemedText>
                        <TouchableOpacity style={styles.armasSignatureBox} onPress={openArmaSignatureModal} activeOpacity={0.85}>
                            {armaFirma ? (
                                <Image source={{ uri: armaFirma }} style={styles.armasSignatureImage} resizeMode="contain" />
                            ) : (
                                <ThemedText style={styles.armasSignatureHint}>Toca aquí para firmar</ThemedText>
                            )}
                        </TouchableOpacity>
                        {armaFirma ? (
                            <TouchableOpacity style={styles.armasClearSignature} onPress={() => setArmaFirma('')}>
                                <Ionicons name="trash" size={18} color="#FF3B30" />
                                <ThemedText style={styles.armasClearSignatureText}>Eliminar firma</ThemedText>
                            </TouchableOpacity>
                        ) : null}
                    </ThemedView>
                )}

                <ThemedText style={styles.label}>Tipo mantenimiento artículo:</ThemedText>
                <View style={styles.pickerContainer}>
                    <Picker
                        selectedValue={tipoMantenimientoArticulo}
                        onValueChange={(value) => setTipoMantenimientoArticulo(value)}
                        style={styles.picker}
                    >
                        <Picker.Item label="Seleccionar..." value="" />
                        {(selectedReporte?.tipos_mantenimiento || []).map((t) => (
                            <Picker.Item key={t.id} label={t.nombre} value={t.nombre} />
                        ))}
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

                {showReemplazarFields && (
                    <>
                        <ThemedText style={styles.label}>Marca (Nuevo):</ThemedText>
                        <TextInput
                            style={styles.input}
                            value={marcaNuevo}
                            onChangeText={setMarcaNuevo}
                            placeholder="Marca (Nuevo)"
                            placeholderTextColor="#999"
                        />

                        <ThemedText style={styles.label}>Modelo (Nuevo):</ThemedText>
                        <TextInput
                            style={styles.input}
                            value={modeloNuevo}
                            onChangeText={setModeloNuevo}
                            placeholder="Modelo (Nuevo)"
                            placeholderTextColor="#999"
                        />

                        <ThemedText style={styles.label}>Serie/Placa (Nuevo):</ThemedText>
                        <TextInput
                            style={styles.input}
                            value={seriePlacaNuevo}
                            onChangeText={setSeriePlacaNuevo}
                            placeholder="Serie/Placa (Nuevo)"
                            placeholderTextColor="#999"
                        />
                    </>
                )}

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
                                {fechaSalida ? formatDateForDisplay(fechaSalida) : 'Seleccionar fecha'}
                            </ThemedText>
                            <Ionicons name="calendar-outline" size={18} color="#007AFF" />
                        </TouchableOpacity>

                        <ThemedText style={styles.label}>Fecha entrada:</ThemedText>
                        <TouchableOpacity style={styles.dateButton} onPress={() => setShowFechaEntradaPicker(true)}>
                            <ThemedText style={styles.dateButtonText}>
                                {fechaEntrada ? formatDateForDisplay(fechaEntrada) : 'Seleccionar fecha'}
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
                        {fechaFin ? formatDateForDisplay(fechaFin) : 'Seleccionar fecha'}
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

                {reincidenciaTreintaDias && (
                    <>
                        <ThemedText style={styles.label}>Tipo mantenimiento reincidencia:</ThemedText>
                        <View style={styles.pickerContainer}>
                            <Picker
                                selectedValue={tipoMantenimientoReincidencia}
                                onValueChange={(value) => setTipoMantenimientoReincidencia(value)}
                                style={styles.picker}
                            >
                                <Picker.Item label="Seleccionar..." value="" />
                                {(selectedReporte?.tipos_mantenimiento || []).map((t) => (
                                    <Picker.Item key={t.id} label={t.nombre} value={t.nombre} />
                                ))}
                            </Picker>
                        </View>
                    </>
                )}

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
                    {submitResponse && (
                        <ThemedView style={[styles.responseContainer, submitResponse.type === 'success' ? styles.responseSuccess : styles.responseError]}>
                            <ThemedText style={styles.responseText}>
                                {submitResponse.type === 'success' ? '✓ ' : '✗ '}
                                {submitResponse.message}
                            </ThemedText>
                        </ThemedView>
                    )}
                    <TouchableOpacity style={[styles.formActionButton, styles.formActionCancel]} onPress={cancelUpdating} disabled={isSubmitting}>
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
                                <ThemedText style={styles.formActionSaveText}>Confirmar</ThemedText>
                            </>
                        )}
                    </TouchableOpacity>
                </ThemedView>
            </ThemedView>
        );
    };

    return (
        <ThemedView style={styles.container}>
            <AppHeader onMenuPress={handleMenuPress} title="Equipo del puesto" />

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                <ThemedView style={styles.content}>
                    {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}

                    <ThemedView style={styles.titleContainer}>
                        <ThemedText type="title" style={styles.title}>
                            <Ionicons name="construct" size={22} color="#000000" /> Equipo del puesto
                        </ThemedText>
                        <ThemedText style={styles.subtitle}>Gestiona el equipo del puesto</ThemedText>
                    </ThemedView>

                    {!hasCurrentMarca ? (
                        <ThemedView style={styles.emptyContainer}>
                            <ThemedText style={styles.errorText}>Debes tener una marca activa para usar este módulo.</ThemedText>
                        </ThemedView>
                    ) : null}

                    {/* Filtros jerárquicos (Empresa → ... → Puesto) */}
                    {!isUpdating && !showActivos && hasCurrentMarca && !isLoading && (
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
                                    <TouchableOpacity style={styles.resetFiltersButton} onPress={resetFiltersToCurrentMarca}>
                                        <Ionicons name="refresh" size={16} color="#FF3B30" />
                                        <ThemedText style={styles.resetFiltersText}>Reiniciar</ThemedText>
                                    </TouchableOpacity>
                                )}
                            </ThemedView>

                            {isFiltersExpanded && (
                                <ThemedView style={styles.filterContent}>
                                    <ThemedView style={styles.filterGroup}>
                                        <ThemedText style={styles.filterLabel}>Empresa:</ThemedText>
                                        <View style={styles.pickerContainer}>
                                            <Picker
                                                selectedValue={filterEmpresaId || ''}
                                                onValueChange={(value) => {
                                                    setFilterEmpresaId(value && value !== '' ? Number(value) : null);
                                                    setFilterClienteId(null);
                                                    setFilterDivisionId(null);
                                                    setFilterContratoId(null);
                                                    setFilterCorpoId(null);
                                                    setFilterPuestoId(null);
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
                                                        setFilterDivisionId(null);
                                                        setFilterContratoId(null);
                                                        setFilterCorpoId(null);
                                                        setFilterPuestoId(null);
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
                                                        setFilterContratoId(null);
                                                        setFilterCorpoId(null);
                                                        setFilterPuestoId(null);
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
                                                        setFilterCorpoId(null);
                                                        setFilterPuestoId(null);
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
                                                        setFilterPuestoId(null);
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
                                                    onValueChange={(value) => {
                                                        const newPuestoId = value && value !== '' ? Number(value) : null;
                                                        setFilterPuestoId(newPuestoId);
                                                        // Resetear el ref para permitir nueva búsqueda cuando cambia el puesto
                                                        // El useEffect se disparará automáticamente cuando activePuestoId cambie
                                                        isFetchingReportesRef.current = false;
                                                    }}
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
                                <ThemedText style={styles.backButtonText}>Volver a artículos</ThemedText>
                            </TouchableOpacity>
                            {isLoading ? (
                                <ThemedView style={styles.loadingContainer}>
                                    <ActivityIndicator size="large" color="#007AFF" />
                                    <ThemedText style={styles.loadingText}>Cargando...</ThemedText>
                                </ThemedView>
                            ) : activos.length === 0 ? (
                                <ThemedView style={styles.emptyContainer}>
                                    <ThemedText style={styles.emptyText}>No hay registros de mantenimiento</ThemedText>
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
                                    <ThemedText style={styles.emptyText}>No hay artículos disponibles para este puesto</ThemedText>
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

                                    <ThemedText style={styles.label}>Entrega *</ThemedText>
                                    <TextInput style={styles.input} placeholder="Entrega" placeholderTextColor="#999" value={movEntrega} onChangeText={setMovEntrega} />

                                    <ThemedText style={styles.label}>Recibe *</ThemedText>
                                    <TextInput style={styles.input} placeholder="Recibe" placeholderTextColor="#999" value={movRecibe} onChangeText={setMovRecibe} />

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
                                                        <TouchableOpacity style={[styles.listItemButton, styles.editButtonMov]} onPress={() => startMovEditing(m)}>
                                                            <Ionicons name="pencil" size={18} color="#FFFFFF" />
                                                            <ThemedText style={styles.listItemButtonText}>Editar</ThemedText>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity style={[styles.listItemButton, styles.deleteButtonMov]} onPress={() => handleMovDelete(m)}>
                                                            <Ionicons name="trash" size={18} color="#FFFFFF" />
                                                            <ThemedText style={styles.listItemButtonText}>Eliminar</ThemedText>
                                                        </TouchableOpacity>
                                                    </ThemedView>

                                                    <ThemedView style={styles.listItemButtons}>
                                                        <TouchableOpacity
                                                            style={[styles.listItemButton, styles.changesButton]}
                                                            onPress={() => {
                                                                if (m.id_local || m.id === 0) {
                                                                    Alert.alert('Sin conexión', 'Este movimiento es local/offline. Los cambios solo se pueden consultar en el servidor.');
                                                                    return;
                                                                }
                                                                setCambiosTitle(`Cambios - Movimiento #${m.id}`);
                                                                fetchCambios('c_movimientos_articulo_mantenimiento', m.id);
                                                            }}
                                                        >
                                                            <Ionicons name="list-outline" size={18} color="#FFFFFF" />
                                                            <ThemedText style={styles.listItemButtonText}>Cambios</ThemedText>
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
                                                                    {String(c?.after ?? '')}
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

            {/* Modal flotante para dibujar firma (arma) */}
            <Modal
                visible={isArmaSignatureModalVisible}
                animationType="fade"
                transparent
                presentationStyle="overFullScreen"
                onRequestClose={closeArmaSignatureModal}
            >
                <View style={styles.overlay}>
                    <ThemedView style={styles.floatModalCard}>
                        <ThemedView style={styles.floatModalHeader}>
                            <ThemedText style={styles.modalTitle}>Dibujar firma (Arma)</ThemedText>
                            <TouchableOpacity onPress={closeArmaSignatureModal}>
                                <Ionicons name="close" size={24} color="#333" />
                            </TouchableOpacity>
                        </ThemedView>

                        <ThemedText style={styles.signatureModalHint}>Firma dentro del recuadro blanco.</ThemedText>

                        <View style={styles.signaturePadBox}>
                            <SignatureScreen
                                ref={armaSignatureRef}
                                onOK={handleArmaSignatureRead}
                                onEmpty={() => {
                                    setIsReadingArmaSignature(false);
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
                                key={armaSignatureKey}
                            />
                        </View>

                        <ThemedView style={styles.modalActions}>
                            <TouchableOpacity style={styles.modalClearButton} onPress={clearArmaSignatureInModal}>
                                <Ionicons name="trash" size={20} color="#000000" />
                                <ThemedText style={styles.modalClearButtonText}>Limpiar</ThemedText>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.modalAcceptButton, isReadingArmaSignature && { opacity: 0.7 }]}
                                onPress={acceptArmaSignature}
                                disabled={isReadingArmaSignature}
                            >
                                {isReadingArmaSignature ? (
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

    // Formulario de armas
    armasBox: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 10,
        padding: 12,
        backgroundColor: '#F8FAFC',
        marginBottom: 10,
    },
    armasTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 10 },
    armasSectionTitle: { marginTop: 10, marginBottom: 6, fontSize: 14, fontWeight: '800', color: '#0F172A' },
    armasRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8, backgroundColor: '#F8FAFC' },
    armasFieldLabel: { width: 140, fontSize: 13, fontWeight: '700', color: '#0F172A' },
    armasInlineInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 10,
        backgroundColor: '#fff',
        color: '#000',
        marginBottom: 0,
    },
    armasInlineRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
    armasInlineMuted: { color: '#64748B', fontWeight: '700' },
    armasOptionsRow: { flex: 1, flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
    armasOption: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#CBD5E1',
        backgroundColor: '#FFFFFF',
    },
    armasOptionSelected: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
    armasOptionText: { fontWeight: '800', color: '#0F172A' },
    armasOptionTextSelected: { color: '#FFFFFF' },
    armasChecklist: { gap: 8, marginBottom: 12, backgroundColor: '#F8FAFC' },
    armasChecklistRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
    armasChecklistText: { flex: 1, color: '#0F172A', fontWeight: '600' },
    armasMiniCheckbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
    armasMiniCheckboxChecked: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
    armasMiniCheckboxUnchecked: { backgroundColor: '#FFFFFF', borderColor: '#CBD5E1' },
    armasHintMuted: { color: '#64748B', marginBottom: 12 },
    armasTextArea: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 10,
        backgroundColor: '#FFFFFF',
        color: '#000',
        minHeight: 90,
        textAlignVertical: 'top',
    },
    armasMediaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8, marginTop: 6, backgroundColor: '#F8FAFC' },
    armasMediaButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#007AFF',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    armasMediaButtonText: { color: '#FFFFFF', fontWeight: '700' },
    armasThumb: { width: 64, height: 64, borderRadius: 8, backgroundColor: '#E5E7EB' },
    armasRemoveButton: {
        width: 36,
        height: 36,
        borderRadius: 8,
        backgroundColor: '#FFECEC',
        alignItems: 'center',
        justifyContent: 'center',
    },
    armasSignatureBox: {
        height: 110,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        marginTop: 6,
    },
    armasSignatureImage: { width: '100%', height: '100%' },
    armasSignatureHint: { color: '#64748B', fontWeight: '700' },
    armasClearSignature: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
    armasClearSignatureText: { color: '#FF3B30', fontWeight: '700' },

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
    estadoBueno: { color: '#16A34A', fontWeight: '800' },
    estadoMalo: { color: '#DC2626', fontWeight: '800' },

    cambioAccordionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
        gap: 12,
    },
    cambioAccordionTitle: { fontSize: 14, fontWeight: '800', color: '#000' },
    cambioCollapsableMain: {
        width: '100%',
        marginBottom: 10,
        backgroundColor: '#fff',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        overflow: 'hidden',
    },
    cambioCollapsableHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: '#F8F9FA',
    },
    cambioCollapsableTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#007AFF',
        flex: 1,
    },
    cambioCollapsableContent: {
        padding: 12,
        gap: 8,
        backgroundColor: '#F8F9FA',
    },
    changeDescription: {
        fontSize: 14,
        lineHeight: 20,
        color: '#666',
        marginBottom: 8,
    },

    listItemButtons: { marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
    listItemButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 8, gap: 8 },
    viewButton: { backgroundColor: '#34C759' },
    editButton: { backgroundColor: '#007AFF', marginTop: 10 },
    editButtonActivo: { backgroundColor: '#007AFF' },
    editButtonMov: { backgroundColor: '#007AFF' },
    changesButton: { backgroundColor: '#5856D6' },
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

