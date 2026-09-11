import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Platform, View, Image, Dimensions, Linking, Modal } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import * as DocumentPicker from 'expo-document-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import getCurrentUserDigitalSignature from '../hooks/getCurrentUserDigitalSignature';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import SignatureScreen from 'react-native-signature-canvas';

import AppHeader from '../components/AppHeader';
import AppFooter from '../components/AppFooter';
import SlideMenu from '../components/SlideMenu';
import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import CambiosAppsModulesModal, { type CambiosAppsModulesRow } from '@/components/CambiosAppsModulesModal';
import { useAuth } from '../contexts/AuthContext';
import { downloadAuthedUrlToDevice } from '@/hooks/downloadReportFileToDevice';
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
import { isStoredPlanillasTokenValid } from '../hooks/planillasTokenStorage';
import PlanillasPasswordRevalidationModal from '../components/PlanillasPasswordRevalidationModal';
import authedFetch from '../hooks/authedFetch';
import getValidAccessTokenOrLogout from '../hooks/getValidAccessTokenOrLogout';
import { convertDateTimestampToLocalString } from '@/hooks/convertDateTimestampToLocalString';
import { loadMainStructureTreeMerged } from '@/hooks/bitacoraMainStructureCache';
import { writeMainStructureCacheString } from '@/hooks/mainStructureCacheStorage';
import {
    clearPuestoArticulosList,
    readPuestoArticulosList,
    writePuestoArticulosList,
} from '@/hooks/mantenimientoEquipoPuestoArticulosCache';
import {
    applyMantenimientoPatchToPuestoReporteStores,
    applyPatchToMantenimientosArray,
    syncPuestoArticulosFragmentFromReportesList,
} from '@/hooks/mantenimientoEquipoMainStructureSync';
import { saveFile, getFile, deleteFile, getLocalFileDisplayUri } from '@/hooks/fileStorage';
import type { StoredFileType } from '@/hooks/fileStorage';
import HierarchyPickerFields, { type HierarchyPickerValues } from '@/components/HierarchyPickerFields';
import {
    submitMantenimientoEquipoBulkArticulos,
    validateMantenimientoEquipoPuestosCodigos,
    type BulkPlantillaArticulo,
} from '@/hooks/mantenimientoEquipoBulkArticulos';
import { parseMantenimientoEquipoPlantillaLocal } from '@/hooks/mantenimientoEquipoPlantillaLocal';
import { prioritizePlanByArticuloNomencladorId } from '@/hooks/prioritizePlanByArticuloNomencladorId';
import { searchActaStructure, type StructureLite } from '@/hooks/reportesFunctions';

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
    /** Solo en caché: creado/actualizado desde Entrega/Actividades/Checklist (no es aún fila real en servidor) */
    evaluacion_mantenimiento_origen?: 'entrega_puestos' | 'activities' | 'checklist_supervision';
};

type ArticuloPuestoMantenimientoItem = {
    key: string;
    source: 'plan' | 'asignado';
    estructura_id: number;
    articulo_nomenclador_id: number | null;
    articulo_nombre: string;
    tipo: string; // "Plan de puesto" | "Asignado al puesto"
    marca?: string | null;
    modelo?: string | null;
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
        evaluacion_mantenimiento_origen?: 'entrega_puestos' | 'activities' | 'checklist_supervision';
    };
    /** OPERATIVO: puesto dueño de la fila cuando el listado abarca toda la sucursal (corpo). */
    puesto_id_context?: number;
    puesto_nombre_context?: string;
};

function isMantenimientoSoloEvaluacionCache(m: { evaluacion_mantenimiento_origen?: string } | null | undefined): boolean {
    const o = m?.evaluacion_mantenimiento_origen;
    return o === 'entrega_puestos' || o === 'activities' || o === 'checklist_supervision';
}

type RoleName = 'OPERATIVO' | 'SUPERVISOR' | 'ADMINISTRATIVO' | string | null;

function numOrNull(v: unknown): number | null {
    if (v === undefined || v === null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
}

/** Puestos bajo una sucursal (corpo) en el árbol main_structure. */
function findPuestosInCorpo(tree: any[], corpoId: number): { id: number; nombre?: string }[] {
    if (!corpoId || !Array.isArray(tree)) return [];
    for (const empresa of tree) {
        for (const cliente of empresa?.clientes || []) {
            for (const division of cliente?.division || []) {
                for (const contrato of division?.contratos || []) {
                    for (const sucursal of contrato?.sucursales || []) {
                        if (Number(sucursal?.id) === Number(corpoId)) {
                            const puestos = sucursal?.puestos || [];
                            return puestos
                                .filter((p: any) => p?.id != null)
                                .map((p: any) => ({
                                    id: Number(p.id),
                                    nombre: p.nombre != null ? String(p.nombre) : undefined,
                                }));
                        }
                    }
                }
            }
        }
    }
    return [];
}

function stripPuestoContextForStorage(
    row: ArticuloPuestoMantenimientoItem
): ArticuloPuestoMantenimientoItem {
    const { puesto_id_context: _c, puesto_nombre_context: _n, ...rest } = row as ArticuloPuestoMantenimientoItem & {
        puesto_id_context?: number;
        puesto_nombre_context?: string;
    };
    return rest as ArticuloPuestoMantenimientoItem;
}

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

/** Cola: eliminar adjunto de mantenimiento (sincroniza en App.tsx). */
export const ARTICULO_MANTENIMIENTO_DELETE_ARCHIVO_ACTIONS_KEY = 'articulo_mantenimiento_delete_archivo_actions';

// Componente para visualizar archivos del activo
function ActivoFilesViewer({
    activoId,
    files,
    accessToken,
    refreshAccessToken,
    logout,
    onRequestDeleteFile,
}: {
    activoId: number;
    files: ActivoFileRemote[];
    accessToken?: string | null;
    refreshAccessToken: () => Promise<boolean>;
    logout: () => Promise<unknown>;
    /** Si se pasa, muestra icono de eliminar (confirmación en el handler). */
    onRequestDeleteFile?: (file: ActivoFileRemote) => void;
}) {
    const [isExpanded, setIsExpanded] = useState(false);
    const list = Array.isArray(files) ? files : [];
    if (list.length === 0) return null;

    const imageFiles = list.filter(f => f.type === 'image');
    const audioFiles = list.filter(f => f.type === 'audio');
    const videoFiles = list.filter(f => f.type === 'video');
    const documentFiles = list.filter(f => f.type === 'document' || (!f.type && f.extension));

    const buildFileUrl = (file: ActivoFileRemote) => {
        const hasLocalId =
            file.id_local !== undefined && file.id_local !== null && String(file.id_local).trim() !== '';
        if (hasLocalId && file.base64) {
            const raw = String(file.base64).replace(/^data:[^;]+;base64,/, '');
            const mime =
                file.mimeType ||
                (file.type ? `${file.type}/${file.extension || 'octet-stream'}` : `application/${file.extension || 'octet-stream'}`);
            return `data:${mime};base64,${raw}`;
        }

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
                            {imageFiles.map((file) => (
                                <View key={String(file.id_local || file.id || file.name)} style={styles.activoRemoteFileWrap}>
                                    {onRequestDeleteFile && Number(file.id) > 0 ? (
                                        <TouchableOpacity
                                            style={styles.activoRemoteDeleteFab}
                                            onPress={() => onRequestDeleteFile(file)}
                                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                        >
                                            <Ionicons name="trash" size={18} color="#FF3B30" />
                                        </TouchableOpacity>
                                    ) : null}
                                    <ActivoImageViewer imageUrl={buildFileUrl(file)} />
                                </View>
                            ))}
                        </ThemedView>
                    )}

                    {audioFiles.length > 0 && (
                        <ThemedView style={styles.viewerSection}>
                            <ThemedText style={styles.viewerSectionTitle}>Audios</ThemedText>
                            {audioFiles.map((file) => (
                                <View key={String(file.id_local || file.id || file.name)} style={styles.activoRemoteFileWrap}>
                                    {onRequestDeleteFile && Number(file.id) > 0 ? (
                                        <TouchableOpacity
                                            style={styles.activoRemoteDeleteFab}
                                            onPress={() => onRequestDeleteFile(file)}
                                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                        >
                                            <Ionicons name="trash" size={18} color="#FF3B30" />
                                        </TouchableOpacity>
                                    ) : null}
                                    <ActivoAudioPlayer
                                        sourceUrl={buildFileUrl(file)}
                                        label={file.original_name || file.name}
                                    />
                                </View>
                            ))}
                        </ThemedView>
                    )}

                    {videoFiles.length > 0 && (
                        <ThemedView style={styles.viewerSection}>
                            <ThemedText style={styles.viewerSectionTitle}>Videos</ThemedText>
                            {videoFiles.map((file) => (
                                <View key={String(file.id_local || file.id || file.name)} style={styles.activoRemoteFileWrap}>
                                    {onRequestDeleteFile && Number(file.id) > 0 ? (
                                        <TouchableOpacity
                                            style={styles.activoRemoteDeleteFab}
                                            onPress={() => onRequestDeleteFile(file)}
                                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                        >
                                            <Ionicons name="trash" size={18} color="#FF3B30" />
                                        </TouchableOpacity>
                                    ) : null}
                                    <ActivoVideoPlayer sourceUrl={buildFileUrl(file)} />
                                </View>
                            ))}
                        </ThemedView>
                    )}

                    {documentFiles.length > 0 && (
                        <ThemedView style={styles.viewerSection}>
                            <ThemedText style={styles.viewerSectionTitle}>Documentos</ThemedText>
                            {documentFiles.map((file) => (
                                <View key={String(file.id_local || file.id || file.name)} style={styles.activoRemoteFileWrap}>
                                    {onRequestDeleteFile && Number(file.id) > 0 ? (
                                        <TouchableOpacity
                                            style={styles.activoRemoteDeleteFab}
                                            onPress={() => onRequestDeleteFile(file)}
                                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                        >
                                            <Ionicons name="trash" size={18} color="#FF3B30" />
                                        </TouchableOpacity>
                                    ) : null}
                                    <TouchableOpacity
                                        style={styles.documentRow}
                                        onPress={() => {
                                            void (async () => {
                                                try {
                                                    const url = buildFileUrl(file);
                                                    if (!url) {
                                                        Alert.alert('Error', 'URL inválida para descargar el archivo');
                                                        return;
                                                    }

                                                    const result = await downloadAuthedUrlToDevice({
                                                        url,
                                                        fallbackFileName: getFileDisplayName(file),
                                                        tempPrefix: 'activo_mantenimiento_file',
                                                        refreshAccessToken,
                                                        logout,
                                                    });

                                                    if (result.ok) {
                                                        Alert.alert('Descarga', `Archivo guardado: ${result.fileName}`);
                                                        return;
                                                    }
                                                    if (result.cancelled) {
                                                        return;
                                                    }
                                                    Alert.alert('Error', result.message || 'No se pudo descargar el archivo');
                                                } catch (error) {
                                                    const message =
                                                        error instanceof Error ? error.message : 'No se pudo descargar el archivo';
                                                    Alert.alert('Error', message);
                                                }
                                            })();
                                        }}
                                    >
                                        <Ionicons name="document-text-outline" size={20} color="#007AFF" />
                                        <ThemedText numberOfLines={1} style={styles.documentText}>
                                            {getFileDisplayName(file)}
                                        </ThemedText>
                                        <Ionicons name="download-outline" size={20} color="#007AFF" />
                                    </TouchableOpacity>
                                </View>
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
    /** Base64 crudo o data URL (legado). Preferir `localFileName` para no cargar memoria. */
    base64?: string;
    /** Archivo bajo el directorio de documentos (ver `fileStorage.saveFile`) */
    localFileName?: string;
    uri?: string;
    mimeType?: string;
}

function activoFileLocalToStorageType(t: ActivoFileLocal['type']): StoredFileType {
    if (t === 'document') return 'text';
    return t;
}

function localMantenimientoFileImageUri(f: ActivoFileLocal): string {
    if (f.localFileName) {
        const u = getLocalFileDisplayUri(f.localFileName);
        if (u) return u;
    }
    if (f.base64) {
        const ext = (f.extension || 'jpeg').replace(/^\./, '');
        return `data:${f.mimeType || `image/${ext}`};base64,${f.base64}`;
    }
    return '';
}

async function buildMantenimientoFilesJsonForApi(files: ActivoFileLocal[]): Promise<string | null> {
    if (files.length === 0) return null;
    const out: { type: string; original_name: string; extension: string; file_base64: string }[] = [];
    for (const f of files) {
        let raw = '';
        if (f.localFileName) {
            try {
                const g = await getFile(f.localFileName);
                raw = g.base64;
            } catch {
                raw = '';
            }
        } else if (f.base64) {
            raw = f.base64;
        }
        if (!raw) continue;
        if (raw.startsWith('data:')) {
            const i = raw.indexOf('base64,');
            if (i !== -1) raw = raw.slice(i + 7);
        }
        out.push({
            type: f.type,
            original_name: f.name,
            extension: f.extension,
            file_base64: raw,
        });
    }
    return out.length > 0 ? JSON.stringify(out) : null;
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

/** Adjunta pendiente de subir: visibles con `id_local` + `base64` (misma regla que `buildFileUrl` de la ficha). */
async function buildPendingRemotoArchivosForMantenimientoList(locals: ActivoFileLocal[]): Promise<ActivoFileRemote[]> {
    const out: ActivoFileRemote[] = [];
    for (const f of locals) {
        let b64 = '';
        if (f.localFileName) {
            try {
                const g = await getFile(f.localFileName);
                b64 = g.base64;
            } catch {
                b64 = '';
            }
        } else if (f.base64) {
            b64 = f.base64;
        }
        if (!b64) continue;
        if (b64.startsWith('data:')) {
            const i = b64.indexOf('base64,');
            if (i !== -1) b64 = b64.slice(i + 7);
        }
        out.push({
            id: 0,
            id_local: f.id,
            name: f.name,
            original_name: f.name,
            type: f.type,
            extension: f.extension,
            url: '',
            base64: b64,
            mimeType: f.mimeType,
        });
    }
    return out;
}

/**
 * Toda la UI del módulo Equipo (tarjetas de artículo + `activos` por artículo) debe basarse
 * en la fila con `ultimo_mantenimiento` y `mantenimientos[0]` alineados (criterio API: id desc).
 * Sin esto, el resumen y la sublista leen "desde" sitios distintos y el usuario debe salir y volver.
 */
function normalizeMantenimientoEquipoReporteItem(
    r: ArticuloPuestoMantenimientoItem
): ArticuloPuestoMantenimientoItem {
    const mants = Array.isArray(r.mantenimientos) ? [...r.mantenimientos] : [];
    mants.sort((a: any, b: any) => Number(b?.id) - Number(a?.id));
    const ult = mants[0] ?? (r.ultimo_mantenimiento as any) ?? null;
    return {
        ...r,
        mantenimientos: mants,
        ultimo_mantenimiento: ult,
        ultimo_registro_mantenimiento: ult,
    } as ArticuloPuestoMantenimientoItem;
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
    const [marcaEmpresaId, setMarcaEmpresaId] = useState<number | null>(null);
    const [marcaClienteId, setMarcaClienteId] = useState<number | null>(null);
    const [marcaDivisionId, setMarcaDivisionId] = useState<number | null>(null);
    const [marcaContratoId, setMarcaContratoId] = useState<number | null>(null);
    const [marcaCorpoId, setMarcaCorpoId] = useState<number | null>(null);
    const [roleName, setRoleName] = useState<RoleName>(null);
    const [marcaDivisionNombre, setMarcaDivisionNombre] = useState<string | null>(null);

    // Carga masiva de artículos (solo división Administrativos, requiere internet)
    const [isBulkArticulosModalVisible, setIsBulkArticulosModalVisible] = useState(false);
    const [bulkPlantillaArticulos, setBulkPlantillaArticulos] = useState<BulkPlantillaArticulo[]>([]);
    const [bulkIsPlantillaExpanded, setBulkIsPlantillaExpanded] = useState(true);
    const [isBulkDownloadingPlantilla, setIsBulkDownloadingPlantilla] = useState(false);
    const [isBulkValidatingPlantilla, setIsBulkValidatingPlantilla] = useState(false);
    const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);

    const planillasRevalidationModalShownRef = useRef(false);
    const [showPlanillasRevalidationModal, setShowPlanillasRevalidationModal] = useState(false);
    const pendingPlanillasBulkSubmitRef = useRef(false);
    const executeSubmitBulkArticulosRef = useRef<() => Promise<void>>(async () => {});

    // Alta unitaria de artículos (mismas condiciones y validación de token que la carga masiva)
    const [isUnitArticuloModalVisible, setIsUnitArticuloModalVisible] = useState(false);
    const [unitArticuloCatalog, setUnitArticuloCatalog] = useState<{ id: number; nombre: string }[]>([]);
    const [isUnitCatalogLoading, setIsUnitCatalogLoading] = useState(false);
    const [unitSelectedArticulo, setUnitSelectedArticulo] = useState<{ id: number; nombre: string } | null>(null);
    const [unitCantidad, setUnitCantidad] = useState('');
    const [unitSerie, setUnitSerie] = useState('');
    const [unitMarca, setUnitMarca] = useState('');
    const [unitModelo, setUnitModelo] = useState('');
    const [unitFechaEntrega, setUnitFechaEntrega] = useState(new Date());
    const [showUnitFechaEntregaPicker, setShowUnitFechaEntregaPicker] = useState(false);
    const [unitPuestoSearch, setUnitPuestoSearch] = useState('');
    const [unitPuestoResults, setUnitPuestoResults] = useState<StructureLite[]>([]);
    const [unitPuestos, setUnitPuestos] = useState<{ codigo: string; nombre: string }[]>([]);
    const [isUnitValidatingPuesto, setIsUnitValidatingPuesto] = useState(false);
    const [isUnitSubmitting, setIsUnitSubmitting] = useState(false);
    const pendingPlanillasUnitSubmitRef = useRef(false);
    const executeSubmitUnitArticuloRef = useRef<() => Promise<void>>(async () => {});

    const canBulkArticulosPuesto = marcaDivisionNombre === 'Administrativos';

    // Estructura principal (main_structure) para filtros jerárquicos (Empresa → ... → Puesto)
    const [structure, setStructure] = useState<any[]>([]);
    const structureRef = useRef<any[]>([]);
    const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
    const [filterEmpresaId, setFilterEmpresaId] = useState<number | null>(null);
    const [filterClienteId, setFilterClienteId] = useState<number | null>(null);
    const [filterDivisionId, setFilterDivisionId] = useState<number | null>(null);
    const [filterContratoId, setFilterContratoId] = useState<number | null>(null);
    const [filterCorpoId, setFilterCorpoId] = useState<number | null>(null);
    const [filterPuestoId, setFilterPuestoId] = useState<number | null>(null);
    const didInitFiltersFromMarca = useRef(false);
    const listFiltersSyncedFromMarcaOnceRef = useRef(false);
    const lastMarcaPuestoIdRef = useRef<number | null>(null);
    const isFetchingReportesRef = useRef(false);
    const pendingReportesRefetchRef = useRef(false);

    const activePuestoId = filterPuestoId ?? marcaPuestoId;

    const resolvePuestoIdForReporte = useCallback(
        (reporte?: ArticuloPuestoMantenimientoItem | null): number | null => {
            const fromRow = reporte?.puesto_id_context;
            if (fromRow != null && Number.isFinite(Number(fromRow)) && Number(fromRow) > 0) {
                return Number(fromRow);
            }
            const fromFilter = filterPuestoId ?? marcaPuestoId;
            return fromFilter != null && Number.isFinite(Number(fromFilter)) && Number(fromFilter) > 0
                ? Number(fromFilter)
                : null;
        },
        [filterPuestoId, marcaPuestoId]
    );

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
    /** Al editar no mostramos fotos ya subidas; conservamos aquí los nombres del servidor para el JSON si no hay foto nueva. */
    const originalMantArmasFotoNamesRef = useRef<{ antes: string | null; despues: string | null } | null>(null);

    // Modal firma (arma)
    const [isArmaSignatureModalVisible, setIsArmaSignatureModalVisible] = useState(false);
    const armaSignatureRef = useRef<any>(null);
    const [armaSignatureKey, setArmaSignatureKey] = useState(0);
    const [isReadingArmaSignature, setIsReadingArmaSignature] = useState(false);

    // Cámara reutilizable para cualquier foto del módulo (mismo criterio de un disparo por
    // apertura que ChecklistSupervisionScreen.tsx/PhysicalMinuteAgendaScreen.tsx): se guarda el
    // callback a invocar con la foto capturada, así un único modal sirve tanto para "Agregar
    // imagen" del activo como para las fotos Antes/Después de armas, sin duplicar la cámara.
    const [isActivoCameraVisible, setIsActivoCameraVisible] = useState(false);
    const [activoCameraPermission, requestActivoCameraPermission] = useCameraPermissions();
    const activoCameraRef = useRef<CameraView | null>(null);
    const pendingActivoCameraHandlerRef = useRef<((asset: { uri: string; name?: string; mimeType?: string }) => void) | null>(null);

    const openActivoCamera = async (onCaptured: (asset: { uri: string; name?: string; mimeType?: string }) => void) => {
        if (!activoCameraPermission?.granted) {
            const res = await requestActivoCameraPermission();
            if (!res.granted) {
                Alert.alert('Permiso denegado', 'Se necesita permiso para usar la cámara');
                return;
            }
        }
        pendingActivoCameraHandlerRef.current = onCaptured;
        setIsActivoCameraVisible(true);
    };

    const captureActivoPhoto = async () => {
        if (!activoCameraRef.current) return;
        try {
            const photo = await activoCameraRef.current.takePictureAsync({ quality: 0.7, skipProcessing: false });
            setIsActivoCameraVisible(false);
            if (!photo?.uri) {
                Alert.alert('Error', 'No se pudo capturar la foto');
                return;
            }
            const handler = pendingActivoCameraHandlerRef.current;
            pendingActivoCameraHandlerRef.current = null;
            handler?.({ uri: photo.uri, name: `foto_${Date.now()}.jpg`, mimeType: 'image/jpeg' });
        } catch (e: any) {
            setIsActivoCameraVisible(false);
            Alert.alert('Error', e?.message || 'No se pudo capturar la foto');
        }
    };

    // Submódulo: Movimiento de activos (CRUD dentro de modal)
    const { scanQR, QRScannerComponent } = useQRScanner();
    const [isMovModalVisible, setIsMovModalVisible] = useState(false);
    const [movActivo, setMovActivo] = useState<ArticuloPuestoMantenimientoItem | null>(null);
    const [movimientos, setMovimientos] = useState<MovimientoArticuloMantenimientoItem[]>([]);
    const [movIsCreating, setMovIsCreating] = useState(false);
    const [isHierarchyHintVisible, setIsHierarchyHintVisible] = useState(true);
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

    const [movFirmaEntrega, setMovFirmaEntrega] = useState<string>('');
    const [movFirmaRecibe, setMovFirmaRecibe] = useState<string>('');
    const [movFirmaResponsable, setMovFirmaResponsable] = useState('');
    const [isGeneratingMovFirma, setIsGeneratingMovFirma] = useState(false);
    const [isMovSubmitting, setIsMovSubmitting] = useState(false);
    const [deletingMovKey, setDeletingMovKey] = useState<string | null>(null);

    // Modal: ver cambios (auditoría)
    const [isCambiosModalVisible, setIsCambiosModalVisible] = useState(false);
    const [cambiosTitle, setCambiosTitle] = useState<string>('Cambios');
    const [cambiosItems, setCambiosItems] = useState<CambiosAppsModulesRow[]>([]);

    // Modal firma dibujada (entrega/recibe)
    const [isDrawSignatureModalVisible, setIsDrawSignatureModalVisible] = useState(false);
    const [drawSignatureTarget, setDrawSignatureTarget] = useState<'entrega' | 'recibe'>('entrega');
    const signatureRef = useRef<any>(null);
    const [signatureKey, setSignatureKey] = useState(0);
    const [isReadingSignature, setIsReadingSignature] = useState(false);

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

    /** Compartido por `pickArmaImageAsFile` (adjuntar) y la cámara, para no duplicar el guardado. */
    const buildArmaFileFromAsset = useCallback(
        async (baseName: string, asset: { uri: string; name?: string; mimeType?: string }) => {
            let extension = '';
            if (asset.name && asset.name.includes('.')) {
                extension = asset.name.split('.').pop() || '';
            } else if (asset.mimeType && asset.mimeType.includes('/')) {
                extension = asset.mimeType.split('/').pop() || '';
            }
            if (!extension) extension = 'jpg';
            const extNorm = extension.replace(/^\./, '') || 'jpg';

            const localId = `arma_file_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
            const fileName = `${baseName}.${extNorm}`;

            const localFileName = await saveFile({
                uri: asset.uri,
                originalName: baseName,
                extension: extNorm,
                type: 'image',
                prefix: 'mantenimiento_equipo',
            });

            const newFile: ActivoFileLocal = {
                id: localId,
                type: 'image',
                name: fileName,
                extension: extNorm,
                localFileName,
                uri: asset.uri,
                mimeType: asset.mimeType,
            };

            return newFile;
        },
        []
    );

    const pickArmaImageAsFile = useCallback(async (baseName: string) => {
        const result = await DocumentPicker.getDocumentAsync({
            type: 'image/*',
            multiple: false,
            copyToCacheDirectory: true,
        });

        if (result.canceled || !result.assets || result.assets.length === 0) return null;

        const asset = result.assets[0];
        return buildArmaFileFromAsset(baseName, { uri: asset.uri, name: asset.name, mimeType: asset.mimeType });
    }, [buildArmaFileFromAsset]);

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
        const uri = formatSignatureForDisplay(signature) || signature;
        setArmaFirma(uri);
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
            foto_antes_nombre: armaFotoAntesLocal
                ? armaFotoAntesName || null
                : originalMantArmasFotoNamesRef.current?.antes ?? null,
            foto_despues_nombre: armaFotoDespuesLocal
                ? armaFotoDespuesName || null
                : originalMantArmasFotoNamesRef.current?.despues ?? null,
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
        armaFotoAntesLocal,
        armaFotoDespuesLocal,
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

    /** Convierte base64 o data URI a URI válida para Image (sin saltos de línea ni espacios en el base64). */
    const formatSignatureForDisplay = (value?: string | null): string => {
        if (!value || typeof value !== 'string') return '';
        const trimmed = value.trim();
        if (!trimmed) return '';
        if (trimmed.startsWith('data:')) {
            const base64Match = trimmed.match(/^data:[^;]+;base64,(.+)$/s);
            if (base64Match) {
                const base64Clean = base64Match[1].replace(/\s+/g, '');
                return `data:image/png;base64,${base64Clean}`;
            }
            return trimmed;
        }
        const base64Clean = trimmed.replace(/\s+/g, '');
        return `data:image/png;base64,${base64Clean}`;
    };

    const getConnectionStatus = async (): Promise<boolean> => {
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
    }, [getConnectionStatus, refreshAccessToken, logout]);


    const loadMarcaContext = async () => {
        const currentMarcaStr = await AsyncStorage.getItem('current_marca');
        if (!currentMarcaStr) {
            setHasCurrentMarca(false);
            setMarcaPuestoId(null);
            setMarcaEmpresaId(null);
            setMarcaClienteId(null);
            setMarcaDivisionId(null);
            setMarcaContratoId(null);
            setMarcaCorpoId(null);
            setRoleName(null);
            setMarcaDivisionNombre(null);
            return null;
        }
        const current = JSON.parse(currentMarcaStr);
        if (!current?.id) {
            setHasCurrentMarca(false);
            setMarcaPuestoId(null);
            setMarcaEmpresaId(null);
            setMarcaClienteId(null);
            setMarcaDivisionId(null);
            setMarcaContratoId(null);
            setMarcaCorpoId(null);
            setRoleName(null);
            setMarcaDivisionNombre(null);
            return null;
        }
        setHasCurrentMarca(true);
        setMarcaId(current.id);

        const roleRaw =
            current?.roleDivision?.role?.nombre ??
            current?.role_division?.role?.nombre ??
            null;
        setRoleName(typeof roleRaw === 'string' ? (roleRaw as RoleName) : null);

        const divisionNombreRaw =
            current?.roleDivision?.division?.nombre ??
            current?.role_division?.division?.nombre ??
            null;
        setMarcaDivisionNombre(typeof divisionNombreRaw === 'string' ? divisionNombreRaw : null);

        const empresaIdRaw = current?.empresa?.id ?? current?.empresa_id;
        const clienteIdRaw = current?.cliente?.id ?? current?.cliente_id;
        const divisionIdRaw = current?.roleDivision?.division?.id ?? current?.division?.id ?? current?.division_id;
        const contratoIdRaw = current?.contrato?.id ?? current?.contrato_id;
        const corpoIdRaw = current?.corpo?.id ?? current?.corpo_id;
        const puestoIdRaw =
            current?.puesto?.id ??
            current?.puesto_id ??
            current?.plaza?.puesto?.id ??
            current?.roleDivision?.puesto_id ??
            current?.role_division?.puesto_id;

        setMarcaEmpresaId(empresaIdRaw !== undefined && empresaIdRaw !== null ? Number(empresaIdRaw) : null);
        setMarcaClienteId(clienteIdRaw !== undefined && clienteIdRaw !== null ? Number(clienteIdRaw) : null);
        setMarcaDivisionId(divisionIdRaw !== undefined && divisionIdRaw !== null ? Number(divisionIdRaw) : null);
        setMarcaContratoId(contratoIdRaw !== undefined && contratoIdRaw !== null ? Number(contratoIdRaw) : null);
        setMarcaCorpoId(corpoIdRaw !== undefined && corpoIdRaw !== null ? Number(corpoIdRaw) : null);
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
        if (structureRef.current.length > 0) {
            setStructure(structureRef.current);
            return;
        }
        try {
            const merged = await loadMainStructureTreeMerged();
            const next = Array.isArray(merged) && merged.length > 0 ? merged : [];
            structureRef.current = next;
            setStructure(next);
        } catch (e) {
            console.error('Error fetching main structure:', e);
        }
    }, []);

    const getMainStructureTree = useCallback(async (): Promise<any[] | null> => {
        if (structureRef.current.length > 0) return structureRef.current;
        if (Array.isArray(structure) && structure.length > 0) return structure;
        const merged = await loadMainStructureTreeMerged();
        const next = Array.isArray(merged) && merged.length > 0 ? merged : null;
        if (next) {
            structureRef.current = next;
            setStructure(next);
        }
        return next;
    }, [structure]);

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

    const applyFiltersFromMarcaHierarchy = useCallback(() => {
        const empresaId = marcaEmpresaId ?? null;
        const clienteId = marcaClienteId ?? null;
        const divisionId = marcaDivisionId ?? null;
        const contratoId = marcaContratoId ?? null;
        const corpoId = marcaCorpoId ?? null;
        const puestoId = marcaPuestoId ?? null;
        if (!empresaId && !clienteId && !divisionId && !contratoId && !corpoId && !puestoId) return;

        setFilterEmpresaId(empresaId);
        setFilterClienteId(clienteId);
        setFilterDivisionId(divisionId);
        setFilterContratoId(contratoId);
        setFilterCorpoId(corpoId);
        setFilterPuestoId(puestoId);
    }, [marcaEmpresaId, marcaClienteId, marcaDivisionId, marcaContratoId, marcaCorpoId, marcaPuestoId]);

    const handleFilterHierarchyChange = useCallback((v: HierarchyPickerValues) => {
        setFilterEmpresaId(v.empresaId);
        setFilterClienteId(v.clienteId);
        setFilterDivisionId(v.divisionId);
        setFilterContratoId(v.contratoId);
        setFilterCorpoId(v.sucursalId);
        setFilterPuestoId(v.puestoId ?? null);
        isFetchingReportesRef.current = false;
    }, []);

    const puestoNameById = useMemo(() => {
        const map = new Map<number, string>();
        for (const empresa of structure) {
            for (const cliente of empresa?.clientes ?? []) {
                for (const division of cliente?.division ?? []) {
                    for (const contrato of division?.contratos ?? []) {
                        for (const sucursal of contrato?.sucursales ?? []) {
                            for (const puesto of sucursal?.puestos ?? []) {
                                if (puesto?.id != null) map.set(Number(puesto.id), String(puesto.nombre ?? ''));
                            }
                        }
                    }
                }
            }
        }
        return map;
    }, [structure]);

    const resetBulkArticulosForm = useCallback(() => {
        setBulkPlantillaArticulos([]);
        setBulkIsPlantillaExpanded(true);
    }, []);

    const closeBulkArticulosModal = useCallback(() => {
        setIsBulkArticulosModalVisible(false);
        resetBulkArticulosForm();
    }, [resetBulkArticulosForm]);

    const removeBulkPlantillaArticulo = useCallback((index: number) => {
        setBulkPlantillaArticulos((prev) => prev.filter((_, i) => i !== index));
    }, []);

    const openBulkArticulosModal = useCallback(async () => {
        if (!(await getConnectionStatus())) {
            Alert.alert('Sin conexión', 'Esta función requiere conexión a internet.');
            return;
        }
        resetBulkArticulosForm();
        setIsBulkArticulosModalVisible(true);
    }, [getConnectionStatus, resetBulkArticulosForm]);

    const handleDownloadBulkPlantilla = useCallback(async () => {
        if (!(await getConnectionStatus())) {
            Alert.alert('Sin conexión', 'Esta función requiere conexión a internet.');
            return;
        }
        try {
            setIsBulkDownloadingPlantilla(true);
            const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
            if (!apiUrl) {
                throw new Error('Server URL not configured');
            }
            const resourceUrl = `${apiUrl.replace(/\/+$/, '')}/api/mantenimiento-equipo/plantilla/get-file?t=${Date.now()}`;
            const result = await downloadAuthedUrlToDevice({
                url: resourceUrl,
                fallbackFileName: 'plantilla_articulos_puesto.xlsx',
                tempPrefix: 'mantenimiento_plantilla',
                refreshAccessToken,
                logout,
            });

            if (result.ok) {
                Alert.alert('Descarga', `Archivo guardado: ${result.fileName}`);
                return;
            }
            if (result.cancelled) {
                return;
            }
            Alert.alert('Error', result.message || 'No se pudo descargar la plantilla.');
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'No se pudo descargar la plantilla.';
            Alert.alert('Error', msg);
        } finally {
            setIsBulkDownloadingPlantilla(false);
        }
    }, [getConnectionStatus, refreshAccessToken, logout]);

    const handleUploadBulkPlantilla = useCallback(async () => {
        if (!(await getConnectionStatus())) {
            Alert.alert('Sin conexión', 'La validación de códigos de puesto requiere conexión a internet.');
            return;
        }
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: [
                    'application/vnd.ms-excel',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                ],
                multiple: false,
                copyToCacheDirectory: true,
            });
            if (result.canceled || !result.assets?.[0]) return;
            const asset = result.assets[0];
            setIsBulkValidatingPlantilla(true);
            const validation = await parseMantenimientoEquipoPlantillaLocal(asset.uri);
            if (!validation.status) {
                const errText =
                    validation.errors?.length
                        ? validation.errors.slice(0, 8).join('\n')
                        : validation.message || 'La plantilla no es válida.';
                Alert.alert('Plantilla inválida', errText);
                return;
            }
            const rows = Array.isArray(validation.data) ? validation.data : [];
            if (rows.length === 0) {
                Alert.alert('Plantilla vacía', 'No se encontraron registros válidos en la plantilla.');
                return;
            }
            const codigos = Array.from(new Set(rows.map((r) => r.codigo_puesto)));
            const codigoValidation = await validateMantenimientoEquipoPuestosCodigos({
                codigos,
                refreshAccessToken,
                logout,
            });
            if (!codigoValidation.status) {
                const errText =
                    codigoValidation.errors?.length
                        ? codigoValidation.errors.slice(0, 8).join('\n')
                        : codigoValidation.message || 'Algunos códigos de puesto no son válidos.';
                Alert.alert('Códigos de puesto inválidos', errText);
                return;
            }
            const puestoNombreByCodigo = new Map(
                (codigoValidation.puestos ?? []).map((p) => [p.codigo, p.nombre]),
            );
            const enrichedRows = rows.map((row) => ({
                ...row,
                puesto_nombre: puestoNombreByCodigo.get(row.codigo_puesto) || row.codigo_puesto,
            }));
            setBulkPlantillaArticulos(enrichedRows);
            setBulkIsPlantillaExpanded(true);
            Alert.alert('Listo', validation.message || `${enrichedRows.length} registro(s) cargado(s).`);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'No se pudo validar la plantilla.';
            Alert.alert('Error', msg);
        } finally {
            setIsBulkValidatingPlantilla(false);
        }
    }, [getConnectionStatus, refreshAccessToken, logout]);

    const requestPlanillasRevalidationIfNeeded = useCallback(async (horaAccionMs: number): Promise<boolean> => {
        const tokenCheck = await isStoredPlanillasTokenValid(horaAccionMs);
        if (tokenCheck.valid) {
            planillasRevalidationModalShownRef.current = false;
            return true;
        }

        if (!planillasRevalidationModalShownRef.current) {
            planillasRevalidationModalShownRef.current = true;
            setShowPlanillasRevalidationModal(true);
        }

        return false;
    }, []);

    const handlePlanillasRevalidationSuccess = useCallback(() => {
        setShowPlanillasRevalidationModal(false);
        planillasRevalidationModalShownRef.current = false;
        if (pendingPlanillasBulkSubmitRef.current) {
            pendingPlanillasBulkSubmitRef.current = false;
            void executeSubmitBulkArticulosRef.current();
        }
        if (pendingPlanillasUnitSubmitRef.current) {
            pendingPlanillasUnitSubmitRef.current = false;
            void executeSubmitUnitArticuloRef.current();
        }
    }, []);

    const handlePlanillasRevalidationDismiss = useCallback(() => {
        planillasRevalidationModalShownRef.current = false;
        pendingPlanillasBulkSubmitRef.current = false;
        pendingPlanillasUnitSubmitRef.current = false;
        setShowPlanillasRevalidationModal(false);
    }, []);

    const executeSubmitBulkArticulos = useCallback(async () => {
        if (bulkPlantillaArticulos.length === 0) {
            Alert.alert('Validación', 'Sube una plantilla con al menos un artículo.');
            return;
        }

        let referenceMs: number;
        try {
            referenceMs = (await getHoraAccion()) || Date.now();
        } catch {
            referenceMs = Date.now();
        }

        const hasValidPlanillasToken = await requestPlanillasRevalidationIfNeeded(referenceMs);
        if (!hasValidPlanillasToken) {
            pendingPlanillasBulkSubmitRef.current = true;
            return;
        }

        const planillasTokenCheck = await isStoredPlanillasTokenValid(referenceMs);
        const planillasToken = planillasTokenCheck.token;

        try {
            setIsBulkSubmitting(true);
            const result = await submitMantenimientoEquipoBulkArticulos({
                articulos: bulkPlantillaArticulos,
                planillasToken,
                refreshAccessToken,
                logout,
            });
            if (!result.status) {
                const errText =
                    result.errors?.length
                        ? result.errors.slice(0, 8).join('\n')
                        : result.message || 'No se pudo completar la operación.';
                Alert.alert('Error', errText);
                return;
            }
            let msg = result.message || 'Operación completada.';
            if (result.skipped?.length) {
                msg += `\n\nOmitidos (${result.skipped.length}):\n${result.skipped.slice(0, 5).join('\n')}`;
            }
            Alert.alert('Listo', msg);
            closeBulkArticulosModal();
            await fetchReportes({ force: true });
        } catch (e: unknown) {
            const errMsg = e instanceof Error ? e.message : 'Error al actualizar.';
            Alert.alert('Error', errMsg);
        } finally {
            setIsBulkSubmitting(false);
        }
    }, [
        bulkPlantillaArticulos,
        closeBulkArticulosModal,
        requestPlanillasRevalidationIfNeeded,
        refreshAccessToken,
        logout,
    ]);

    executeSubmitBulkArticulosRef.current = executeSubmitBulkArticulos;

    const handleSubmitBulkArticulos = useCallback(async () => {
        if (!(await getConnectionStatus())) {
            Alert.alert(
              'Sin conexión',
              'La carga masiva de artículos requiere conexión a internet y no se puede encolar offline.'
            );
            return;
        }
        if (bulkPlantillaArticulos.length === 0) {
            Alert.alert('Validación', 'Sube una plantilla con al menos un artículo.');
            return;
        }
        const puestoCount = new Set(bulkPlantillaArticulos.map((a) => a.codigo_puesto)).size;
        Alert.alert(
            'Confirmar',
            `¿Vincular ${bulkPlantillaArticulos.length} artículo(s) a ${puestoCount} puesto(s)?`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Actualizar',
                    onPress: () => {
                        void executeSubmitBulkArticulos();
                    },
                },
            ],
        );
    }, [bulkPlantillaArticulos, getConnectionStatus, executeSubmitBulkArticulos]);

    // --- Alta unitaria de artículos (mismo endpoint que la carga masiva) ---

    const resetUnitArticuloForm = useCallback(() => {
        setUnitSelectedArticulo(null);
        setUnitCantidad('');
        setUnitSerie('');
        setUnitMarca('');
        setUnitModelo('');
        setUnitFechaEntrega(new Date());
        setUnitPuestoSearch('');
        setUnitPuestoResults([]);
        setUnitPuestos([]);
    }, []);

    const closeUnitArticuloModal = useCallback(() => {
        setIsUnitArticuloModalVisible(false);
        resetUnitArticuloForm();
    }, [resetUnitArticuloForm]);

    const loadUnitArticuloCatalog = useCallback(async () => {
        if (unitArticuloCatalog.length > 0) return;
        try {
            setIsUnitCatalogLoading(true);
            const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
            if (!apiUrl) throw new Error('Server URL not configured');
            const response = await authedFetch({
                url: `${apiUrl}/api/mantenimiento-equipo/articulos-catalogo`,
                init: { method: 'GET', headers: { 'Content-Type': 'application/json' } },
                refreshAccessToken,
                logout,
            });
            if (!response) return;
            const result = await response.json().catch(() => null);
            if (response.ok && result?.status && Array.isArray(result.data)) {
                setUnitArticuloCatalog(
                    result.data.map((a: any) => ({ id: Number(a.id), nombre: String(a.nombre ?? '') })),
                );
            } else {
                Alert.alert('Error', result?.message || 'No se pudo cargar el catálogo de artículos.');
            }
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'No se pudo cargar el catálogo de artículos.';
            Alert.alert('Error', msg);
        } finally {
            setIsUnitCatalogLoading(false);
        }
    }, [unitArticuloCatalog.length, refreshAccessToken, logout]);

    const openUnitArticuloModal = useCallback(async () => {
        if (!(await getConnectionStatus())) {
            Alert.alert('Sin conexión', 'Esta función requiere conexión a internet.');
            return;
        }
        resetUnitArticuloForm();
        setIsUnitArticuloModalVisible(true);
        void loadUnitArticuloCatalog();
    }, [getConnectionStatus, resetUnitArticuloForm, loadUnitArticuloCatalog]);

    // Mismo buscador de puesto (por nombre o código) que ReportesPuestoModal.tsx: búsqueda en
    // servidor vía `searchActaStructure`, en vez de validar un código escrito a mano.
    const runUnitPuestoSearch = useCallback(async () => {
        const q = unitPuestoSearch.trim();
        if (!q) {
            Alert.alert('Puesto', 'Escriba un nombre o código de puesto.');
            return;
        }
        if (!(await getConnectionStatus())) {
            Alert.alert('Sin conexión', 'La búsqueda de puestos requiere conexión a internet.');
            return;
        }
        try {
            setIsUnitValidatingPuesto(true);
            const res = await searchActaStructure({ entity: 'puesto', q, refreshAccessToken, logout });
            const data = res.status ? res.data ?? [] : [];
            setUnitPuestoResults(data);
            if (!data.length) Alert.alert('Puesto', 'Sin resultados.');
        } finally {
            setIsUnitValidatingPuesto(false);
        }
    }, [unitPuestoSearch, getConnectionStatus, refreshAccessToken, logout]);

    const selectUnitPuesto = useCallback((it: StructureLite) => {
        const codigo = it.codigo || String(it.id);
        setUnitPuestos((prev) =>
            prev.some((p) => p.codigo.toLowerCase() === codigo.toLowerCase())
                ? prev
                : [...prev, { codigo, nombre: it.nombre }],
        );
        setUnitPuestoSearch('');
        setUnitPuestoResults([]);
    }, []);

    const removeUnitPuesto = useCallback((index: number) => {
        setUnitPuestos((prev) => prev.filter((_, i) => i !== index));
    }, []);

    const formatUnitFechaEntregaForApi = (date: Date): string => {
        const dd = String(date.getDate()).padStart(2, '0');
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const yyyy = date.getFullYear();
        return `${dd}-${mm}-${yyyy} 00:00:00`;
    };

    const executeSubmitUnitArticulo = useCallback(async () => {
        if (!unitSelectedArticulo) {
            Alert.alert('Validación', 'Seleccione un artículo.');
            return;
        }
        const cantidadNum = Number(unitCantidad);
        if (!unitCantidad.trim() || !Number.isFinite(cantidadNum) || cantidadNum < 0) {
            Alert.alert('Validación', 'Ingrese una cantidad válida.');
            return;
        }
        if (!unitSerie.trim()) {
            Alert.alert('Validación', 'La serie es obligatoria.');
            return;
        }
        if (!unitMarca.trim()) {
            Alert.alert('Validación', 'La marca es obligatoria.');
            return;
        }
        if (unitPuestos.length === 0) {
            Alert.alert('Validación', 'Agregue al menos un código de puesto.');
            return;
        }

        let referenceMs: number;
        try {
            referenceMs = (await getHoraAccion()) || Date.now();
        } catch {
            referenceMs = Date.now();
        }

        const hasValidPlanillasToken = await requestPlanillasRevalidationIfNeeded(referenceMs);
        if (!hasValidPlanillasToken) {
            pendingPlanillasUnitSubmitRef.current = true;
            return;
        }

        const planillasTokenCheck = await isStoredPlanillasTokenValid(referenceMs);
        const planillasToken = planillasTokenCheck.token;

        const articulos: BulkPlantillaArticulo[] = unitPuestos.map((p) => ({
            codigo_puesto: p.codigo,
            puesto_nombre: p.nombre,
            numero_articulo: unitSelectedArticulo.id,
            cantidad: cantidadNum,
            serie: unitSerie.trim(),
            marca: unitMarca.trim(),
            modelo: unitModelo.trim() || null,
            fecha_entrega: formatUnitFechaEntregaForApi(unitFechaEntrega),
            articulo_nombre: unitSelectedArticulo.nombre,
        }));

        try {
            setIsUnitSubmitting(true);
            const result = await submitMantenimientoEquipoBulkArticulos({
                articulos,
                planillasToken,
                refreshAccessToken,
                logout,
            });
            if (!result.status) {
                const errText =
                    result.errors?.length
                        ? result.errors.slice(0, 8).join('\n')
                        : result.message || 'No se pudo completar la operación.';
                Alert.alert('Error', errText);
                return;
            }
            let msg = result.message || 'Operación completada.';
            if (result.skipped?.length) {
                msg += `\n\nOmitidos (${result.skipped.length}):\n${result.skipped.slice(0, 5).join('\n')}`;
            }
            Alert.alert('Listo', msg);
            closeUnitArticuloModal();
            await fetchReportes({ force: true });
        } catch (e: unknown) {
            const errMsg = e instanceof Error ? e.message : 'Error al actualizar.';
            Alert.alert('Error', errMsg);
        } finally {
            setIsUnitSubmitting(false);
        }
    }, [
        unitSelectedArticulo,
        unitCantidad,
        unitSerie,
        unitMarca,
        unitModelo,
        unitFechaEntrega,
        unitPuestos,
        closeUnitArticuloModal,
        requestPlanillasRevalidationIfNeeded,
        refreshAccessToken,
        logout,
    ]);

    executeSubmitUnitArticuloRef.current = executeSubmitUnitArticulo;

    const handleSubmitUnitArticulo = useCallback(async () => {
        if (!(await getConnectionStatus())) {
            Alert.alert(
                'Sin conexión',
                'El alta de artículos requiere conexión a internet y no se puede encolar offline.'
            );
            return;
        }
        Alert.alert(
            'Confirmar',
            `¿Vincular el artículo a ${unitPuestos.length} puesto(s)?`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Guardar',
                    onPress: () => {
                        void executeSubmitUnitArticulo();
                    },
                },
            ],
        );
    }, [unitPuestos, getConnectionStatus, executeSubmitUnitArticulo]);

    const resetFiltersToCurrentMarca = useCallback(() => {
        if (roleName === 'OPERATIVO') {
            void fetchReportes({ force: true });
            return;
        }
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
    }, [applyFiltersFromPuestoId, marcaPuestoId, roleName]);

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

    const fetchReportes = async (opts?: { force?: boolean }): Promise<ArticuloPuestoMantenimientoItem[] | null> => {
        if (isFetchingReportesRef.current) {
            if (opts?.force) {
                for (let i = 0; i < 400; i++) {
                    if (!isFetchingReportesRef.current) break;
                    await new Promise((r) => setTimeout(r, 25));
                }
            } else {
                pendingReportesRefetchRef.current = true;
                return null;
            }
        }

        let returnList: ArticuloPuestoMantenimientoItem[] | null = null;

        const normalizeMantenimiento = (m: any): ArticuloMantenimiento => ({
            ...m,
            id_local: m.id_local || '',
            archivos: Array.isArray(m.c_archivos_adjuntos_articulo_mantenimiento)
                ? m.c_archivos_adjuntos_articulo_mantenimiento.map(
                      (a: any): ActivoFileRemote => ({
                          id: Number(a.id) || 0,
                          name: a.name,
                          original_name: a.original_name,
                          type: a.type,
                          extension: a.extension,
                          url: a.url != null && String(a.url) !== '' ? String(a.url) : '',
                          base64: a.base64,
                          id_local: a.id_local,
                          mimeType: a.mimeType,
                      })
                  )
                : Array.isArray(m.archivos)
                  ? m.archivos
                  : [],
        });

        const finishMantenimientoEquipoList = (raw: ArticuloPuestoMantenimientoItem[]) => {
            const prioritized = prioritizePlanByArticuloNomencladorId(raw);
            const n = prioritized.map((x) => normalizeMantenimientoEquipoReporteItem(x));
            setReportes(n);
            return n;
        };

        const buildReportesListForSinglePuesto = async (
            puestoIdForQuery: number
        ): Promise<ArticuloPuestoMantenimientoItem[]> => {
            if (!puestoIdForQuery) return [];

            /** Sin red: `puesto_{id}_articulos` es la fuente (misma al guardar). */
            if (!(await getConnectionStatus())) {
                const fromPuesto = await readPuestoArticulosList(puestoIdForQuery);
                if (fromPuesto && fromPuesto.length > 0) {
                    return prioritizePlanByArticuloNomencladorId(
                        fromPuesto as ArticuloPuestoMantenimientoItem[],
                    );
                }
            }

            const isConnected = await getConnectionStatus();
            if (isConnected) {
                const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
                if (!apiUrl) {
                    throw new Error('Server URL not configured');
                }

                const url = `${apiUrl}/api/articulo-mantenimiento/puesto/${puestoIdForQuery}`;

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
                    return [];
                }

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                if (data.status && Array.isArray(data.data)) {
                    const list: ArticuloPuestoMantenimientoItem[] = prioritizePlanByArticuloNomencladorId(
                        data.data.map((it: any) => ({
                            ...it,
                            tipos_mantenimiento: Array.isArray(it.tipos_mantenimiento) ? it.tipos_mantenimiento : [],
                            mantenimientos: Array.isArray(it.mantenimientos) ? it.mantenimientos.map(normalizeMantenimiento) : [],
                            movimientos: Array.isArray(it.movimientos) ? it.movimientos : [],
                        })),
                    );
                    await writePuestoArticulosList(puestoIdForQuery, list);
                    void updateMainStructureCacheFromFetchedPuesto({
                        puestoId: puestoIdForQuery,
                        items: list,
                    });
                    return list;
                }
                const fromPuesto = await readPuestoArticulosList(puestoIdForQuery);
                return fromPuesto?.length
                    ? prioritizePlanByArticuloNomencladorId(fromPuesto as ArticuloPuestoMantenimientoItem[])
                    : [];
            }

            // Offline: mostrar artículos del puesto desde main_structure_cache
            const tree = await getMainStructureTree();
            if (tree && puestoIdForQuery) {
                const puestoNode: any = findPuestoNodeInTree(tree, puestoIdForQuery);
                const articulosRaw: any[] = Array.isArray(puestoNode?.articulos) ? puestoNode.articulos : [];
                const listFromStructure: ArticuloPuestoMantenimientoItem[] = prioritizePlanByArticuloNomencladorId(
                    articulosRaw.map((a: any) => {
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
                            modelo: a.modelo ?? null,
                            serie: a.serie ?? null,
                            tipos_mantenimiento: Array.isArray(a.tipos_mantenimiento) ? a.tipos_mantenimiento : [],
                            mantenimientos: mantenimientosOffline,
                            movimientos: Array.isArray(a.movimientos) ? a.movimientos : [],
                            ultimo_mantenimiento: ultimo,
                        };
                    }),
                );

                if (listFromStructure.length > 0) {
                    await writePuestoArticulosList(puestoIdForQuery, listFromStructure);
                    void syncPuestoArticulosFragmentFromReportesList(puestoIdForQuery, listFromStructure);
                    return listFromStructure;
                }
                const puestoList = await readPuestoArticulosList(puestoIdForQuery);
                return puestoList?.length
                    ? prioritizePlanByArticuloNomencladorId(puestoList as ArticuloPuestoMantenimientoItem[])
                    : [];
            }
            const puestoList = await readPuestoArticulosList(puestoIdForQuery);
            return puestoList?.length
                ? prioritizePlanByArticuloNomencladorId(puestoList as ArticuloPuestoMantenimientoItem[])
                : [];
        };

        try {
            isFetchingReportesRef.current = true;
            setIsLoading(true);
            setError(null);

            const current = await loadMarcaContext();
            const rn =
                current?.roleDivision?.role?.nombre ??
                current?.role_division?.role?.nombre ??
                roleName;
            const isOperativo = rn === 'OPERATIVO';

            if (isOperativo && !current?.id) {
                setHasCurrentMarca(false);
                setReportes([]);
                returnList = null;
                return returnList;
            }

            const marcaCorpoLive = numOrNull(current?.corpo?.id ?? current?.corpo_id);

            if (isOperativo) {
                if (!marcaCorpoLive) {
                    setError('No se encontró el ID de la sucursal (corpo) en la marca actual');
                    setReportes([]);
                    returnList = null;
                    return returnList;
                }
                const treeMerged = (await getMainStructureTree()) || structure;
                const puestoMetas = findPuestosInCorpo(Array.isArray(treeMerged) ? treeMerged : [], marcaCorpoLive);
                if (!puestoMetas.length) {
                    setError(
                        'No se encontraron puestos para la sucursal en la estructura. Actualice la jerarquía o vuelva a intentar.'
                    );
                    setReportes([]);
                    returnList = null;
                    return returnList;
                }
                const merged: ArticuloPuestoMantenimientoItem[] = [];
                let loadError: string | null = null;
                for (const pm of puestoMetas) {
                    try {
                        const chunk = await buildReportesListForSinglePuesto(pm.id);
                        for (const row of chunk) {
                            merged.push({
                                ...row,
                                puesto_id_context: pm.id,
                                puesto_nombre_context: pm.nombre,
                            });
                        }
                    } catch (err: any) {
                        loadError = err?.message || 'Error al cargar artículos de un puesto';
                        console.error('MantenimientoEquipo fetch puesto', pm.id, err);
                    }
                }
                if (merged.length > 0) {
                    returnList = finishMantenimientoEquipoList(merged);
                } else if (loadError) {
                    setError(loadError);
                    setReportes([]);
                    returnList = null;
                } else {
                    setReportes([]);
                    returnList = null;
                }
                return returnList;
            }

            const puestoIdForQuery = activePuestoId ?? marcaPuestoId ?? null;
            if (!puestoIdForQuery) {
                setError('Puesto no especificado');
                console.log('Nos caímos 2');
                setReportes([]);
                returnList = null;
                return returnList;
            }

            /** Sin red: `puesto_{id}_articulos` es la fuente (misma al guardar). */
            if (!(await getConnectionStatus())) {
                const fromPuesto = await readPuestoArticulosList(puestoIdForQuery);
                if (fromPuesto && fromPuesto.length > 0) {
                    console.log('Reportes offline desde puesto_*_articulos');
                    returnList = finishMantenimientoEquipoList(fromPuesto as ArticuloPuestoMantenimientoItem[]);
                    return returnList;
                }
            }

            const isConnected = await getConnectionStatus();
            if (isConnected) {
                const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
                if (!apiUrl) {
                    throw new Error('Server URL not configured');
                }

                const url = `${apiUrl}/api/articulo-mantenimiento/puesto/${puestoIdForQuery}`;

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
                    returnList = null;
                    return returnList;
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
                    console.log('Actualizamos reportes internet');
                    returnList = finishMantenimientoEquipoList(list);
                    await writePuestoArticulosList(puestoIdForQuery, returnList);
                    void updateMainStructureCacheFromFetchedPuesto({
                        puestoId: puestoIdForQuery,
                        items: returnList,
                    });
                } else {
                    setError(data.message || 'Error al cargar artículos');
                    const fromPuesto = await readPuestoArticulosList(puestoIdForQuery);
                    if (fromPuesto && fromPuesto.length > 0) {
                        returnList = finishMantenimientoEquipoList(fromPuesto as ArticuloPuestoMantenimientoItem[]);
                    } else {
                        console.log('Nos caímos 3');
                        setReportes([]);
                        returnList = null;
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
                            modelo: a.modelo ?? null,
                            serie: a.serie ?? null,
                            tipos_mantenimiento: Array.isArray(a.tipos_mantenimiento) ? a.tipos_mantenimiento : [],
                            mantenimientos: mantenimientosOffline,
                            movimientos: Array.isArray(a.movimientos) ? a.movimientos : [],
                            ultimo_mantenimiento: ultimo,
                        };
                    });

                    if (listFromStructure.length > 0) {
                        console.log('Actualizamos reportes offline');
                        returnList = finishMantenimientoEquipoList(listFromStructure);
                        await writePuestoArticulosList(puestoIdForQuery, returnList);
                        void syncPuestoArticulosFragmentFromReportesList(puestoIdForQuery, returnList);
                    } else {
                        const puestoList = await readPuestoArticulosList(puestoIdForQuery);
                        if (puestoList && puestoList.length > 0) {
                            console.log('Actualizamos reportes offline desde puesto_*_articulos (fallback)');
                            returnList = finishMantenimientoEquipoList(puestoList as ArticuloPuestoMantenimientoItem[]);
                        } else {
                            console.log('Nos caímos 4');
                            setReportes([]);
                            returnList = null;
                        }
                    }
                } else {
                    const puestoList = await readPuestoArticulosList(puestoIdForQuery);
                    if (puestoList && puestoList.length > 0) {
                        returnList = finishMantenimientoEquipoList(puestoList as ArticuloPuestoMantenimientoItem[]);
                    } else {
                        console.log('Nos caímos 5');
                        setReportes([]);
                        returnList = null;
                    }
                }
            }
            return returnList;
        } catch (e: any) {
            setError(e.message || 'Error al cargar artículos');
            console.log(e.message);
            const rn =
                (await AsyncStorage.getItem('current_marca').then((s) => {
                    try {
                        return s ? JSON.parse(s) : null;
                    } catch {
                        return null;
                    }
                })) ?? null;
            const isOperativoCatch =
                rn?.roleDivision?.role?.nombre === 'OPERATIVO' || rn?.role_division?.role?.nombre === 'OPERATIVO';
            if (isOperativoCatch && numOrNull(rn?.corpo?.id ?? rn?.corpo_id)) {
                const corpoE = numOrNull(rn?.corpo?.id ?? rn?.corpo_id)!;
                const treeE =
                    structureRef.current.length > 0
                        ? structureRef.current
                        : ((await loadMainStructureTreeMerged().catch(() => [])) as any[]);
                const metas = findPuestosInCorpo(Array.isArray(treeE) ? treeE : [], corpoE);
                const fallbackMerged: ArticuloPuestoMantenimientoItem[] = [];
                for (const pm of metas) {
                    const fromPuesto = await readPuestoArticulosList(pm.id);
                    if (fromPuesto?.length) {
                        for (const row of fromPuesto as ArticuloPuestoMantenimientoItem[]) {
                            fallbackMerged.push({
                                ...row,
                                puesto_id_context: pm.id,
                                puesto_nombre_context: pm.nombre,
                            });
                        }
                    }
                }
                if (fallbackMerged.length > 0) {
                    returnList = finishMantenimientoEquipoList(fallbackMerged);
                    return returnList;
                }
            }
            const puestoIdErr = activePuestoId ?? marcaPuestoId ?? null;
            if (puestoIdErr != null && Number.isFinite(Number(puestoIdErr)) && Number(puestoIdErr) > 0) {
                const fromPuesto = await readPuestoArticulosList(Number(puestoIdErr));
                if (fromPuesto && fromPuesto.length > 0) {
                    returnList = finishMantenimientoEquipoList(fromPuesto as ArticuloPuestoMantenimientoItem[]);
                } else {
                    console.log('Nos caímos 6');
                    setReportes([]);
                    returnList = null;
                }
            } else {
                setReportes([]);
                returnList = null;
            }
            return returnList;
        } finally {
            setIsLoading(false);
            isFetchingReportesRef.current = false;
            if (pendingReportesRefetchRef.current) {
                pendingReportesRefetchRef.current = false;
                void fetchReportes();
            }
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

            /** Sin red: la fuente correcta es `puesto_{id}_articulos` (no el árbol mergeado, suele ir atrasado). */
            const pidOff = resolvePuestoIdForReporte(item);
            if (pidOff != null && Number.isFinite(Number(pidOff)) && Number(pidOff) > 0 && item?.key) {
                const fromPuesto = await readPuestoArticulosList(Number(pidOff));
                const row = fromPuesto?.find((r) => r.key === item.key);
                if (row && Array.isArray(row.mantenimientos) && row.mantenimientos.length > 0) {
                    setActivos(row.mantenimientos);
                    return;
                }
            }

            // Offline: fallback main_structure_cache
            const pidStruct = resolvePuestoIdForReporte(item);
            if (pidStruct && item?.estructura_id) {
                const artNode = await getArticuloFromMainStructure({
                    puestoId: pidStruct,
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

    /**
     * Tras actualizar el mantenimiento, `puesto_{id}_articulos` ya refleja los cambios pero React
     * aún puede mostrar `reportes`/`activos` viejos. Sincroniza listado, artículo seleccionado
     * y listado de movimientos del artículo sin salir de la pantalla.
     */
    const applyPuestoStorageToMantenimientosUI = async (
        reporteKey: string | undefined,
        listOrNull?: ArticuloPuestoMantenimientoItem[] | null
    ) => {
        if (!reporteKey) return;
        const rowHint =
            listOrNull?.find((r) => r.key === reporteKey) ??
            reportes.find((r) => r.key === reporteKey) ??
            null;
        const pid = resolvePuestoIdForReporte(rowHint);
        if (pid == null || !Number.isFinite(Number(pid)) || Number(pid) <= 0) return;
        const raw =
            listOrNull && listOrNull.length > 0
                ? listOrNull
                : (await readPuestoArticulosList(Number(pid)));
        if (!raw?.length) return;
        const pl = prioritizePlanByArticuloNomencladorId(
            raw.map((x) => normalizeMantenimientoEquipoReporteItem(x as ArticuloPuestoMantenimientoItem)),
        );
        setReportes(pl);
        const row = pl.find((r) => r.key === reporteKey);
        if (!row) return;
        setSelectedReporte(row);
        const isConnected = await getConnectionStatus();
        if (isConnected) {
            setActivos(Array.isArray(row.mantenimientos) ? row.mantenimientos : []);
        } else {
            await fetchActivos(row);
        }
    };

    // Cargar contexto de marca al entrar (solo contexto). No debe disparar /api/main-structure en loop.
    useFocusEffect(
        useCallback(() => {
            void (async () => {
                const current = await loadMarcaContext();
                if (!listFiltersSyncedFromMarcaOnceRef.current) {
                    if (current?.id && roleName !== 'OPERATIVO') {
                        // Los filtros se aplican vía didInitFiltersFromMarca cuando marcaPuestoId esté listo
                    }
                    listFiltersSyncedFromMarcaOnceRef.current = true;
                }
            })();
        }, [roleName])
    );

    // Cargar estructura principal una sola vez al montar la pantalla
    useEffect(() => {
        if (didFetchMainStructureOnceRef.current) return;
        didFetchMainStructureOnceRef.current = true;
        fetchMainStructure();
    }, [fetchMainStructure]);

    // Inicializar filtros (Empresa → ... → Puesto) a partir del puesto de `current_marca`
    useEffect(() => {
        if (roleName === 'OPERATIVO') return;
        if (!marcaPuestoId) {
            if (!didInitFiltersFromMarca.current) {
                didInitFiltersFromMarca.current = true;
            }
            return;
        }
        if (!filterEmpresas.length) return;

        const prevMarcaPuestoId = lastMarcaPuestoIdRef.current;
        const shouldSyncToMarca =
            filterPuestoId === null || (prevMarcaPuestoId !== null && Number(filterPuestoId) === Number(prevMarcaPuestoId));

        if (!didInitFiltersFromMarca.current) {
            const path = findPathByPuestoId(filterEmpresas, marcaPuestoId);
            if (path) {
                applyFiltersFromPuestoId(marcaPuestoId);
            } else {
                applyFiltersFromMarcaHierarchy();
            }
            didInitFiltersFromMarca.current = true;
        } else if (prevMarcaPuestoId !== null && prevMarcaPuestoId !== marcaPuestoId && shouldSyncToMarca) {
            const path = findPathByPuestoId(filterEmpresas, marcaPuestoId);
            if (path) {
                applyFiltersFromPuestoId(marcaPuestoId);
            } else {
                applyFiltersFromMarcaHierarchy();
            }
        }

        lastMarcaPuestoIdRef.current = marcaPuestoId;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roleName, marcaPuestoId, filterEmpresas, applyFiltersFromPuestoId, applyFiltersFromMarcaHierarchy, findPathByPuestoId]);

    // Cargar artículos del puesto (plan + asignados) al entrar / cuando cambia la marca actual
    useEffect(() => {
        fetchReportes();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [marcaId, activePuestoId, roleName, marcaCorpoId]);

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
    }, [activePuestoId, marcaId, roleName, marcaCorpoId]);

    const handleVerActivos = async (reporte: ArticuloPuestoMantenimientoItem) => {
        let reporteToUse = reporte;
        const isConnected = await getConnectionStatus();
        const pidVer = resolvePuestoIdForReporte(reporte);
        if (!isConnected && pidVer && reporte?.estructura_id) {
            const artNode = await getArticuloFromMainStructure({
                puestoId: pidVer,
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
        if (isMantenimientoSoloEvaluacionCache(activo)) {
            Alert.alert(
                'No editable',
                'Este registro es solo informativo hasta actualizar la jerarquía. No puede editarse aquí.'
            );
            return;
        }
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
                originalMantArmasFotoNamesRef.current = {
                    antes: typeof parsed?.foto_antes_nombre === 'string' && parsed.foto_antes_nombre ? parsed.foto_antes_nombre : null,
                    despues: typeof parsed?.foto_despues_nombre === 'string' && parsed.foto_despues_nombre ? parsed.foto_despues_nombre : null,
                };
                setArmaFotoAntesName('');
                setArmaFotoDespuesName('');
                setArmaFotoAntesLocal(null);
                setArmaFotoDespuesLocal(null);
                setArmaArmeroNombre(typeof parsed?.armero_nombre === 'string' ? parsed.armero_nombre : '');
                setArmaFirma(typeof parsed?.firma === 'string' ? (formatSignatureForDisplay(parsed.firma) || parsed.firma) : '');
                setMantArmasForm(String(raw));
            } else {
                setEsArma(false);
                originalMantArmasFotoNamesRef.current = null;
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
            originalMantArmasFotoNamesRef.current = null;
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

        // Editar: no listar adjuntos ya subidos (solo los que el usuario añada ahora; borrar se hace en la lista de registros).
        setActivoFiles([]);
    };

    const resetForm = () => {
        void (async () => {
            for (const f of [...textFiles, ...imageFiles, ...audioFiles, ...videoFiles]) {
                if (f.localFileName) {
                    try {
                        await deleteFile(f.localFileName);
                    } catch {
                        /* idempotente */
                    }
                }
            }
            for (const f of [armaFotoAntesLocal, armaFotoDespuesLocal]) {
                if (f?.localFileName) {
                    try {
                        await deleteFile(f.localFileName);
                    } catch {
                        /* idempotente */
                    }
                }
            }
        })();
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
        setActivoFiles([]);
        originalMantArmasFotoNamesRef.current = null;
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

    /**
     * Procesa un asset ya elegido (por DocumentPicker o por la cámara) y lo agrega a la lista
     * correspondiente. Compartido por `handleAddFile` (adjuntar) y `captureActivoPhoto` (cámara)
     * para no duplicar el guardado/registro del archivo.
     */
    const addPickedAssetAsFile = async (
        type: ActivoFileLocal['type'],
        asset: { uri: string; name?: string; mimeType?: string }
    ) => {
        try {
            let extension = '';
            if (asset.name && asset.name.includes('.')) {
                extension = asset.name.split('.').pop() || '';
            } else if (asset.mimeType && asset.mimeType.includes('/')) {
                extension = asset.mimeType.split('/').pop() || '';
            }
            const extNorm = (extension || 'dat').replace(/^\./, '');

            const localId = `local_file_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

            const localFileName = await saveFile({
                uri: asset.uri,
                originalName: asset.name || 'file',
                extension: extNorm,
                type: activoFileLocalToStorageType(type),
                prefix: 'mantenimiento_equipo',
            });

            const newFile: ActivoFileLocal = {
                id: localId,
                type,
                name: asset.name || `archivo.${extNorm}`,
                extension: extNorm,
                localFileName,
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
            console.error('Error adding file:', error);
            Alert.alert('Error', 'No se pudo agregar el archivo. Intenta nuevamente.');
        }
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
            await addPickedAssetAsFile(type, { uri: asset.uri, name: asset.name, mimeType: asset.mimeType });
        } catch (error) {
            console.error('Error picking file:', error);
            Alert.alert('Error', 'No se pudo seleccionar el archivo. Intenta nuevamente.');
        }
    };

    const removeLocalFile = async (file: ActivoFileLocal) => {
        if (file.localFileName) {
            try {
                await deleteFile(file.localFileName);
            } catch {
                /* idempotente */
            }
        }
        const type = file.type;
        if (type === 'image') {
            setImageFiles((prev) => prev.filter((f) => f.id !== file.id));
        } else if (type === 'audio') {
            setAudioFiles((prev) => prev.filter((f) => f.id !== file.id));
        } else if (type === 'video') {
            setVideoFiles((prev) => prev.filter((f) => f.id !== file.id));
        } else {
            setTextFiles((prev) => prev.filter((f) => f.id !== file.id));
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
            return `data:${mime};base64,${String(file.base64).replace(/^data:[^;]+;base64,/, '')}`;
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

    /** Monolito `main_structure_cache`: mismo criterio que el API — parche en `mantenimientos` por id y `ultimo_*` = primer id desc. */
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

                const tree =
                    structureRef.current.length > 0
                        ? structureRef.current
                        : await loadMainStructureTreeMerged();
                if (!Array.isArray(tree) || tree.length === 0) return;

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

                                            const { mants, first, changed } = applyPatchToMantenimientosArray(
                                                art.mantenimientos,
                                                mantenimientoId,
                                                patch
                                            );
                                            if (!changed) continue;
                                            art.mantenimientos = mants;
                                            art.ultimo_mantenimiento = first;
                                            art.ultimo_registro_mantenimiento = first;
                                            updated = true;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                if (updated) {
                    //await writeMainStructureCacheString(JSON.stringify(tree));
                }
            } catch (e) {
                console.error('Error updating main_structure_cache (ultimo_mantenimiento):', e);
            }
        },
        []
    );

    // Cuando estamos online, y cargamos desde la BD: artículos del puesto + mantenimientos + movimientos,
    // sincronizamos esos datos dentro de `main_structure_cache` para que el modo offline sea consistente.
    const updateMainStructureCacheFromFetchedPuesto = useCallback(
        async (params: { puestoId: number | null; items: ArticuloPuestoMantenimientoItem[] }) => {
            const { puestoId, items } = params;
            try {
                if (!puestoId || !Array.isArray(items) || items.length === 0) return;

                const tree =
                    structureRef.current.length > 0
                        ? structureRef.current
                        : await loadMainStructureTreeMerged();
                if (!Array.isArray(tree) || tree.length === 0) {
                    await syncPuestoArticulosFragmentFromReportesList(puestoId, items);
                    return;
                }

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
                                        for (const item of items) {
                                            const expectedTipo = item.source === 'plan' ? 'Plan' : 'Asignado';
                                            const art = articulos.find(
                                                (a: any) =>
                                                    Number(a?.id) === Number(item.estructura_id) &&
                                                    String(a?.tipo) === expectedTipo
                                            );
                                            if (!art) continue;

                                            if (Array.isArray(item.tipos_mantenimiento)) {
                                                art.tipos_mantenimiento = item.tipos_mantenimiento;
                                            }
                                            if (Array.isArray(item.movimientos)) {
                                                art.movimientos = item.movimientos;
                                            }
                                            if (Array.isArray(item.mantenimientos)) {
                                                art.mantenimientos = item.mantenimientos;
                                                const first = item.mantenimientos[0] ?? null;
                                                if (first) {
                                                    art.ultimo_mantenimiento = first;
                                                    art.ultimo_registro_mantenimiento = first;
                                                }
                                            }

                                            // Campos base por si vinieron actualizados.
                                            // Nota: el endpoint `articulo-mantenimiento/puesto/[id]` envía `marca/serie = null`
                                            // para artículos `asignado` (para evitar duplicar lógica). No debemos pisar
                                            // los valores reales que ya vienen en `main_structure_cache`.
                                            if (item.articulo_nombre !== undefined) art.nombre = item.articulo_nombre;
                                            if (item.source === 'plan') {
                                                if (item.marca !== undefined && item.marca !== null) art.marca = item.marca;
                                                if (item.modelo !== undefined && item.modelo !== null) art.modelo = item.modelo;
                                                if (item.serie !== undefined && item.serie !== null) art.serie = item.serie;
                                            } else if (item.source === 'asignado') {
                                                if (item.marca !== undefined && item.marca !== null) art.marca = item.marca;
                                                if (item.modelo !== undefined && item.modelo !== null) art.modelo = item.modelo;
                                                if (item.serie !== undefined && item.serie !== null) art.serie = item.serie;
                                            }

                                            updated = true;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                if (updated) {
                    console.log('Actualizamos main_structure_cache');
                    //await writeMainStructureCacheString(JSON.stringify(tree));
                }
                await syncPuestoArticulosFragmentFromReportesList(puestoId, items);
            } catch (e) {
                console.error('Error updating main_structure_cache (fetched puesto):', e);
            }
        },
        []
    );

    const handleSaveInternal = async () => {
        if (!selectedActivo || isSubmitting) return;

        setSubmitResponse(null);

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

        // Fotos de armas (subidas como adjuntos estándar)
        if (esArma && armaFotoAntesLocal) {
            filesPayload.push(armaFotoAntesLocal);
        }
        if (esArma && armaFotoDespuesLocal) {
            filesPayload.push(armaFotoDespuesLocal);
        }

        // Solo se envían adjuntos nuevos (locales en esta sesión). No se reenvían los ya en servidor; tampoco se eliminan al guardar el formulario.
        const filesJson = await buildMantenimientoFilesJsonForApi(filesPayload);

        const requestData: any = {
            estado: selectedActivo.estado ?? 'Bueno',
            cantidad_necesaria: selectedActivo.cantidad_necesaria ?? 0,
            cantidad_real: selectedActivo.cantidad_real ?? 0,
            observaciones: selectedActivo.observaciones ?? '',
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
            files: filesJson,
        };

        // Regla "Marcar como resuelto":
        // - Si el registro ya tenía fecha_solucion, el checkbox debe verse marcado,
        //   pero NO enviamos marcar_como_resuelto=true para no sobre-escribir la fecha en el backend.
        if (marcarComoResuelto) {
            // Fecha solución desde getHoraAccion (tiempo servidor ajustado) y enviar a API
            const horaAccion = await getHoraAccion(); // ms epoch ajustado
            if (!horaAccion) {
                Alert.alert('Error', 'No se pudo obtener la hora');
                return;
            }
            let iso = '';
            try {
                iso = new Date(horaAccion).toISOString();
            } catch {
                iso = new Date(horaAccion).toISOString();
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
            'cantidad_necesaria',
            'cantidad_real',
            'observaciones',
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
                        const reporteKeyForRefresh = selectedReporte?.key;
                        const listPuestoId = resolvePuestoIdForReporte(selectedReporte);
                        if (
                            listPuestoId != null &&
                            Number.isFinite(Number(listPuestoId)) &&
                            Number(listPuestoId) > 0 &&
                            selectedReporte?.source
                        ) {
                            const nextList = await applyMantenimientoPatchToPuestoReporteStores({
                                puestoId: Number(listPuestoId),
                                source: selectedReporte.source,
                                estructuraId: selectedReporte.estructura_id,
                                mantenimientoId: selectedActivo.id,
                                patch: mainStructurePatch,
                            });
                            if (nextList && selectedReporte) {
                                const mergedRowMode = selectedReporte.puesto_id_context != null;
                                if (!mergedRowMode) {
                                    setReportes(nextList as ArticuloPuestoMantenimientoItem[]);
                                    const nr = nextList.find((r) => r.key === selectedReporte.key);
                                    if (nr) setSelectedReporte(nr as ArticuloPuestoMantenimientoItem);
                                } else {
                                    const updatedRow = nextList.find((x) => x.key === selectedReporte.key);
                                    if (updatedRow) {
                                        const normalized = normalizeMantenimientoEquipoReporteItem({
                                            ...updatedRow,
                                            puesto_id_context: selectedReporte.puesto_id_context,
                                            puesto_nombre_context: selectedReporte.puesto_nombre_context,
                                        } as ArticuloPuestoMantenimientoItem);
                                        setReportes((prev) =>
                                            prev.map((r) => (r.key === selectedReporte.key ? normalized : r))
                                        );
                                        setSelectedReporte(normalized);
                                    }
                                }
                            }
                        }
                        await updateMainStructureCacheIfSameUltimoMantenimiento({
                            puestoId: resolvePuestoIdForReporte(selectedReporte),
                            source: selectedReporte?.source ?? null,
                            estructuraId: selectedReporte?.estructura_id ?? null,
                            mantenimientoId: selectedActivo.id,
                            patch: mainStructurePatch,
                        });
                        const refreshedList = await fetchReportes({ force: true });
                        await applyPuestoStorageToMantenimientosUI(reporteKeyForRefresh, refreshedList);
                        setIsUpdating(false);
                        setSelectedActivo(null);
                        setShowActivos(true);
                        resetForm();
                        Alert.alert('Éxito', data.message || 'Mantenimiento actualizado correctamente');
                    } else {
                        Alert.alert('Error', data.message || 'No se pudo actualizar el mantenimiento');
                    }
                } else {
                    Alert.alert('Error', 'No se pudo actualizar el mantenimiento');
                }
            } catch (error: any) {
                Alert.alert('Error', error.message || 'No se pudo actualizar el mantenimiento');
            }
        } else {
            // Modo offline
            const localId = selectedActivo.id_local || generateRandomId();
            const esSoloEvaluacionLocal = isMantenimientoSoloEvaluacionCache(selectedActivo);

            // Registros válidos (existentes en servidor): encolar PUT para sincronizar luego
            if (Number.isFinite(Number(selectedActivo.id)) && Number(selectedActivo.id) > 0) {
                const horaAccion = await getHoraAccion();
                if (horaAccion) {
                    requestData.hora_accion = new Date(horaAccion).toISOString();
                }
                const actionsStr = await AsyncStorage.getItem('articulo_mantenimiento_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                const actionsArr: any[] = Array.isArray(actions) ? actions : [];
                const newAction = {
                    type: 'update' as const,
                    id: selectedActivo.id,
                    id_local: localId,
                    parentKey: selectedReporte?.key,
                    meta: {
                        puestoId: resolvePuestoIdForReporte(selectedReporte),
                        source: selectedReporte?.source ?? null,
                        estructuraId: selectedReporte?.estructura_id ?? null,
                    },
                    requestData,
                };
                const idx = actionsArr.findIndex(
                    (a: any) => a?.type === 'update' && Number(a?.id) === Number(selectedActivo.id)
                );
                if (idx !== -1) actionsArr[idx] = { ...actionsArr[idx], ...newAction };
                else actionsArr.push(newAction);
                await AsyncStorage.setItem('articulo_mantenimiento_actions', JSON.stringify(actionsArr));
            }

            // Actualizar cache (siempre, para reflejar el formulario)
            let updatedActivos = activos.map((a) =>
                a.id === selectedActivo.id ? { ...a, ...requestData, id_local: localId } : a
            );
            if (filesPayload.length > 0) {
                const pendArch = await buildPendingRemotoArchivosForMantenimientoList(filesPayload);
                updatedActivos = updatedActivos.map((a) => {
                    if (a.id !== selectedActivo.id) return a;
                    const prev = Array.isArray(a.archivos) ? a.archivos : [];
                    return { ...a, archivos: [...prev, ...pendArch] };
                });
            }
            setActivos(updatedActivos);
            // Actualizar el listado/caché para que el cambio sea visible sin conexión
            if (selectedReporte) {
                const nextReporte: ArticuloPuestoMantenimientoItem = normalizeMantenimientoEquipoReporteItem({
                    ...selectedReporte,
                    mantenimientos: updatedActivos,
                } as ArticuloPuestoMantenimientoItem);

                setSelectedReporte(nextReporte);
                setReportes((prev) => prev.map((r) => (r.key === nextReporte.key ? nextReporte : r)));

                const listPuestoId = resolvePuestoIdForReporte(selectedReporte);
                if (listPuestoId != null && Number.isFinite(Number(listPuestoId)) && Number(listPuestoId) > 0) {
                    const pidN = Number(listPuestoId);
                    const fromPuesto = await readPuestoArticulosList(pidN);
                    const baseArr: any[] =
                        Array.isArray(fromPuesto) && fromPuesto.length > 0
                            ? fromPuesto
                            : Array.isArray(reportes)
                              ? reportes
                                    .filter((r) =>
                                        r.puesto_id_context != null
                                            ? Number(r.puesto_id_context) === pidN
                                            : Number(pidN) === Number(activePuestoId ?? marcaPuestoId)
                                    )
                                    .map(stripPuestoContextForStorage)
                              : [];
                    const hasKey = baseArr.some((r) => r.key === nextReporte.key);
                    const nextCacheRaw = hasKey
                        ? baseArr.map((r) => (r.key === nextReporte.key ? nextReporte : r))
                        : [...baseArr, nextReporte];
                    const nextCache = nextCacheRaw.map(stripPuestoContextForStorage);
                    await writePuestoArticulosList(pidN, nextCache);
                    void syncPuestoArticulosFragmentFromReportesList(pidN, nextCache);
                }
            }

            await updateMainStructureCacheIfSameUltimoMantenimiento({
                puestoId: resolvePuestoIdForReporte(selectedReporte),
                source: selectedReporte?.source ?? null,
                estructuraId: selectedReporte?.estructura_id ?? null,
                mantenimientoId: selectedActivo.id,
                patch: mainStructurePatch,
            });

            const refreshedOffline = await fetchReportes({ force: true });
            const reporteKeyOffline = selectedReporte?.key;
            await applyPuestoStorageToMantenimientosUI(reporteKeyOffline, refreshedOffline);
            setIsUpdating(false);
            setSelectedActivo(null);
            setShowActivos(true);
            resetForm();
            Alert.alert(
                'Éxito',
                esSoloEvaluacionLocal
                    ? 'Cambios guardados solo en caché (registro local / esperando jerarquía).'
                    : 'Los cambios se sincronizarán cuando vuelva la conexión.'
            );
        }
    };

    const handleSave = async () => {
        if (!selectedActivo || isSubmitting) return;
        Alert.alert('Confirmar', '¿Deseas guardar los cambios del mantenimiento?', [
            { text: 'Cancelar', style: 'cancel' },
            {
                text: 'Aceptar',
                onPress: async () => {
                    setIsSubmitting(true);
                    try {
                        await handleSaveInternal();
                    } finally {
                        setIsSubmitting(false);
                    }
                },
            },
        ]);
    };

    const renderReporte = (reporte: ArticuloPuestoMantenimientoItem) => {
        const ultimo = reporte.ultimo_mantenimiento;
        const esperandoJerarquia = isMantenimientoSoloEvaluacionCache(ultimo as any);
        const cardKey = `rep-${reporte.puesto_id_context ?? 'x'}-${reporte.key}-${(ultimo as any)?.id ?? 'x'}-${
            (ultimo as any)?.estado ?? ''
        }-${String((ultimo as any)?.observaciones ?? '').length}-m${(reporte.mantenimientos || []).length}`;
        return (
            <ThemedView key={cardKey} style={styles.bitacoraCard}>
                <ThemedText style={styles.bitTitle}>
                    {reporte.articulo_nombre} ({reporte.tipo})
                </ThemedText>

                {reporte.puesto_nombre_context ? (
                    <ThemedText style={styles.bitLine}>
                        <ThemedText style={styles.bitLabel}>Puesto: </ThemedText>
                        <ThemedText style={styles.bitValue}>{reporte.puesto_nombre_context}</ThemedText>
                    </ThemedText>
                ) : null}

                {esperandoJerarquia ? (
                    <ThemedView style={styles.evaluacionJerarquiaBanner}>
                        <Ionicons name="cloud-offline-outline" size={20} color="#B45309" />
                        <ThemedText style={styles.evaluacionJerarquiaBannerText}>
                            Esperando actualización de jerarquía
                        </ThemedText>
                    </ThemedView>
                ) : null}

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

    const applyArchivoDeletedLocally = useCallback(
        async (params: {
            reporteKey: string;
            mantenimientoId: number;
            archivoId: number;
            file: ActivoFileRemote;
        }) => {
            const { reporteKey, mantenimientoId, archivoId, file } = params;
            const pid = activePuestoId;
            if ((file.original_name && file.original_name === armaFotoAntesName) || file.name === armaFotoAntesName) {
                setArmaFotoAntesName('');
            }
            if ((file.original_name && file.original_name === armaFotoDespuesName) || file.name === armaFotoDespuesName) {
                setArmaFotoDespuesName('');
            }
            setReportes((prev) => {
                const rowMatch = prev.find((r) => r.key === reporteKey);
                const pidResolved = rowMatch ? resolvePuestoIdForReporte(rowMatch) : pid;
                const next = prev.map((r) => {
                    if (r.key !== reporteKey) return r;
                    return {
                        ...r,
                        mantenimientos: (r.mantenimientos || []).map((m) => {
                            if (Number(m.id) !== Number(mantenimientoId)) return m;
                            const arch = (m.archivos || []).filter((a) => Number(a.id) !== Number(archivoId));
                            return { ...m, archivos: arch };
                        }),
                    };
                });
                if (pidResolved != null && Number.isFinite(pidResolved) && Number(pidResolved) > 0) {
                    const toStore = next
                        .filter((r) =>
                            r.puesto_id_context != null
                                ? Number(r.puesto_id_context) === Number(pidResolved)
                                : Number(pidResolved) === Number(activePuestoId ?? marcaPuestoId)
                        )
                        .map(stripPuestoContextForStorage);
                    queueMicrotask(() => {
                        void writePuestoArticulosList(pidResolved, toStore);
                        void syncPuestoArticulosFragmentFromReportesList(pidResolved, toStore);
                    });
                }
                return next;
            });
            setSelectedReporte((prev) => {
                if (!prev || prev.key !== reporteKey) return prev;
                return {
                    ...prev,
                    mantenimientos: (prev.mantenimientos || []).map((m) => {
                        if (Number(m.id) !== Number(mantenimientoId)) return m;
                        const arch = (m.archivos || []).filter((a) => Number(a.id) !== Number(archivoId));
                        return { ...m, archivos: arch };
                    }),
                };
            });
            setActivos((prev) =>
                prev.map((m) => {
                    if (Number(m.id) !== Number(mantenimientoId)) return m;
                    const arch = (m.archivos || []).filter((a) => Number(a.id) !== Number(archivoId));
                    return { ...m, archivos: arch };
                })
            );
            setSelectedActivo((prev) => {
                if (!prev || Number(prev.id) !== Number(mantenimientoId)) return prev;
                const arch = (prev.archivos || []).filter((a) => Number(a.id) !== Number(archivoId));
                return { ...prev, archivos: arch };
            });
            setActivoFiles((prev) => prev.filter((a) => Number(a.id) !== Number(archivoId)));
        },
        [activePuestoId, armaFotoAntesName, armaFotoDespuesName, marcaPuestoId, resolvePuestoIdForReporte]
    );

    const performDeleteArchivoAdjunto = useCallback(
        async (activo: ArticuloMantenimiento, file: ActivoFileRemote, reporte: ArticuloPuestoMantenimientoItem | null) => {
            if (!reporte?.key) {
                Alert.alert('Error', 'No se pudo identificar el artículo (reporte).');
                return;
            }
            if (!Number.isFinite(Number(file.id)) || Number(file.id) <= 0) {
                return;
            }
            if (!Number.isFinite(Number(activo.id)) || Number(activo.id) <= 0) {
                Alert.alert('Mantenimiento', 'Este registro aún no está en el servidor; no se pueden eliminar adjuntos remotos.');
                return;
            }
            const online = await getConnectionStatus();
            const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
            if (online && apiUrl) {
                const res = await authedFetch({
                    url: `${apiUrl}/api/articulo-mantenimiento/${activo.id}/archivos/${file.id}`,
                    init: { method: 'DELETE', headers: { 'Content-Type': 'application/json' } },
                    refreshAccessToken,
                    logout,
                });
                if (!res) {
                    return;
                }
                const data = await res.json().catch(() => ({}));
                if (!res.ok || !data?.status) {
                    Alert.alert('Error', data?.message || 'No se pudo eliminar el archivo');
                    return;
                }
            } else {
                const newEntry = {
                    id: `del-archivo-${file.id}-${Date.now()}`,
                    type: 'delete_archivo' as const,
                    activoMantenimientoId: Number(activo.id),
                    archivoId: Number(file.id),
                    puestoId: resolvePuestoIdForReporte(reporte),
                    reporteKey: reporte.key,
                    source: reporte.source,
                    estructuraId: reporte.estructura_id,
                };
                const qStr = await AsyncStorage.getItem(ARTICULO_MANTENIMIENTO_DELETE_ARCHIVO_ACTIONS_KEY);
                const q = qStr ? JSON.parse(qStr) : [];
                const list = Array.isArray(q) ? q : [];
                if (!list.some((x: any) => Number(x?.archivoId) === Number(file.id) && x?.type === 'delete_archivo')) {
                    list.push(newEntry);
                    await AsyncStorage.setItem(ARTICULO_MANTENIMIENTO_DELETE_ARCHIVO_ACTIONS_KEY, JSON.stringify(list));
                }
            }
            await applyArchivoDeletedLocally({
                reporteKey: reporte.key,
                mantenimientoId: Number(activo.id),
                archivoId: Number(file.id),
                file,
            });
            void fetchReportes();
        },
        [applyArchivoDeletedLocally, fetchReportes, getConnectionStatus, logout, refreshAccessToken, resolvePuestoIdForReporte]
    );

    const confirmDeleteArchivoAdjunto = useCallback(
        (activo: ArticuloMantenimiento, file: ActivoFileRemote, reporte: ArticuloPuestoMantenimientoItem | null) => {
            Alert.alert('Confirmar', '¿Eliminar este archivo? No se podrá deshacer.', [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Eliminar',
                    style: 'destructive',
                    onPress: () => {
                        void performDeleteArchivoAdjunto(activo, file, reporte);
                    },
                },
            ]);
        },
        [performDeleteArchivoAdjunto]
    );

    const renderActivo = (activo: ArticuloMantenimiento) => {
        const archivos = activo.archivos || [];
        const isSolucionado = activo.fecha_solucion !== null && activo.fecha_solucion !== undefined;
        const fechaFormateada = formatFechaSolucion(activo.fecha_solucion);
        const soloInformativo = isMantenimientoSoloEvaluacionCache(activo);

        const activoListKey = `ac-${activo.id}-${String(activo.id_local || '')}-${
            activo.estado || ''
        }-${String(activo.observaciones || '').length}-a${(activo.archivos || []).length}`;

        return (
            <ThemedView key={activoListKey} style={styles.bitacoraCard}>
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

                {soloInformativo ? (
                    <ThemedView style={styles.evaluacionInformativoBox}>
                        <ThemedText style={styles.evaluacionInformativoText}>
                            Este registro muestra el último estado designado del artículo y es meramente informativo, más no
                            corresponde a ningún registro de mantenimiento creado. Si desea ver los últimos registros
                            reales, actualice la jerarquía
                        </ThemedText>
                    </ThemedView>
                ) : null}

                {archivos.length > 0 && (
                    <ActivoFilesViewer
                        activoId={activo.id}
                        files={archivos}
                        accessToken={accessToken}
                        refreshAccessToken={refreshAccessToken}
                        logout={logout}
                        onRequestDeleteFile={
                            !soloInformativo && Number(activo.id) > 0 && selectedReporte
                                ? (f) => confirmDeleteArchivoAdjunto(activo, f, selectedReporte)
                                : undefined
                        }
                    />
                )}

                <ThemedView style={styles.listItemButtons}>
                    {!soloInformativo ? (
                    <TouchableOpacity
                        style={[styles.listItemButton, styles.editButtonActivo]}
                        onPress={() => handleActualizar(activo)}
                    >
                        <Ionicons name="pencil" size={18} color="#FFFFFF" />
                        <ThemedText style={styles.listItemButtonText}>Actualizar</ThemedText>
                    </TouchableOpacity>
                    ) : null}
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
        await AsyncStorage.setItem('movimientos_articulos_mantenimiento_actions', JSON.stringify(actions));
    };

    const removeMovActionsForLocalId = async (localId: string) => {
        const actionsStr = await AsyncStorage.getItem('movimientos_articulos_mantenimiento_actions');
        if (!actionsStr) return;
        const actions = JSON.parse(actionsStr) || [];
        const updated = actions.filter(
            (a: any) =>
                !(
                    (String(a.id) === String(localId) || String(a.id_local) === String(localId)) &&
                    (a.type === 'create' || a.type === 'update')
                )
        );
        await AsyncStorage.setItem('movimientos_articulos_mantenimiento_actions', JSON.stringify(updated));
    };

    const updateMovCreateActionForLocalId = async (localId: string, requestData: any) => {
        const actionsStr = await AsyncStorage.getItem('movimientos_articulos_mantenimiento_actions');
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
        await AsyncStorage.setItem('movimientos_articulos_mantenimiento_actions', JSON.stringify(updated));
        return updatedAny;
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
        // Firma de entrega y firma de recibe son opcionales; solo se requiere la firma responsable.
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
        /** Fila del artículo: misma estructura que `puesto_{id}_articulos` (sin caché por artículo). */
        const activoToUse = activo;
        const isConnected = await getConnectionStatus();
        setMovActivo(activoToUse);
        const current = await loadMarcaContext();
        if (!current?.id) {
            Alert.alert('Error', 'Marca no encontrada');
            return;
        }
        const pid = resolvePuestoIdForReporte(activoToUse);
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
                if (pid != null && Number.isFinite(Number(pid)) && Number(pid) > 0) {
                    setSelectedReporte((sr) => (sr && sr.key === activoToUse.key ? { ...sr, movimientos: list } : sr));
                    setReportes((prev) => {
                        const next = prev.map((r) =>
                            r.key === activoToUse.key ? { ...r, movimientos: list } : r
                        );
                        const toStore = next
                            .filter((r) =>
                                r.puesto_id_context != null
                                    ? Number(r.puesto_id_context) === Number(pid)
                                    : Number(pid) === Number(activePuestoId ?? marcaPuestoId)
                            )
                            .map(stripPuestoContextForStorage);
                        void (async () => {
                            try {
                                await writePuestoArticulosList(Number(pid), toStore);
                                await syncPuestoArticulosFragmentFromReportesList(Number(pid), toStore);
                            } catch (e) {
                                console.error('openMovimientosModal GET list → puesto_*_articulos:', e);
                            }
                        })();
                        return next;
                    });
                }
            } else {
                setMovimientos(Array.isArray(activoToUse.movimientos) ? activoToUse.movimientos : []);
            }
        } else {
            let fromPuesto: any[] | null = null;
            if (pid != null && Number.isFinite(Number(pid)) && Number(pid) > 0) {
                try {
                    const pl = await readPuestoArticulosList(Number(pid));
                    if (pl?.length) {
                        const row = pl.find((r) => r.key === activoToUse.key);
                        if (row && Array.isArray(row.movimientos)) fromPuesto = row.movimientos;
                    }
                } catch (e) {
                    console.error('openMovimientosModal offline read puesto list:', e);
                }
            }
            if (fromPuesto) {
                setMovimientos(fromPuesto.map((m: any) => ({ ...m, id_local: m.id_local || '' })));
            } else {
                setMovimientos(
                    Array.isArray(activoToUse.movimientos) ? activoToUse.movimientos : []
                );
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
        setMovimientos(nextMovs);
        setMovActivo((prev) => (prev ? { ...prev, movimientos: nextMovs } : prev));
        setReportes((prev) => {
            const nextReportes = prev.map((r) => (r.key === parent.key ? { ...r, movimientos: nextMovs } : r));
            const pid = resolvePuestoIdForReporte(parent);
            if (pid != null && Number.isFinite(Number(pid)) && Number(pid) > 0) {
                const toStore = nextReportes
                    .filter((r) =>
                        r.puesto_id_context != null
                            ? Number(r.puesto_id_context) === Number(pid)
                            : Number(pid) === Number(activePuestoId ?? marcaPuestoId)
                    )
                    .map(stripPuestoContextForStorage);
                void (async () => {
                    try {
                        await writePuestoArticulosList(Number(pid), toStore);
                        await syncPuestoArticulosFragmentFromReportesList(Number(pid), toStore);
                    } catch (e) {
                        console.error('persistMovimientosToActivosCache:', e);
                    }
                })();
            }
            return nextReportes;
        });
        setSelectedReporte((sr) => (sr && sr.key === parent.key ? { ...sr, movimientos: nextMovs } : sr));
    };

    const getMovItemKey = useCallback((m: MovimientoArticuloMantenimientoItem): string => {
        if (m.id_local) return `l:${m.id_local}`;
        return `i:${String(m.id)}`;
    }, []);

    const handleMovSaveInternal = async () => {
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
                    void fetchReportes();
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
                    id_local: localId,
                    parent,
                    puestoId: resolvePuestoIdForReporte(movActivo),
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
                void fetchReportes();
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
                        id_local: movEditing.id_local,
                        parent,
                        puestoId: resolvePuestoIdForReporte(movActivo),
                        parentKey: movActivo.key,
                        requestData: payload,
                    });
                }
            } else {
                await upsertMovAction({
                    type: 'update',
                    id: movEditing.id,
                    parent,
                    puestoId: resolvePuestoIdForReporte(movActivo),
                    parentKey: movActivo.key,
                    requestData: payload,
                });
            }

            Alert.alert('Guardado (offline)', 'Los cambios se sincronizarán cuando vuelva la conexión.');
            setMovIsCreating(false);
            setMovEditing(null);
        }
    };

    const handleMovSave = async () => {
        if (isMovSubmitting) return;
        const isEditingMov = !!movEditing;
        Alert.alert(
            'Confirmar',
            isEditingMov ? '¿Deseas actualizar este movimiento?' : '¿Deseas crear este movimiento?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Aceptar',
                    onPress: async () => {
                        setIsMovSubmitting(true);
                        try {
                            await handleMovSaveInternal();
                        } finally {
                            setIsMovSubmitting(false);
                        }
                    },
                },
            ]
        );
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
                    setDeletingMovKey(getMovItemKey(m));

                    try {
                        if (m.id_local || m.id === 0) {
                            const next = movimientos.filter((x) => x.id_local !== m.id_local);
                            await persistMovimientosToActivosCache(movActivo, next);
                            if (m.id_local) await removeMovActionsForLocalId(m.id_local);
                        } else {
                            const parent = { source: movActivo.source, estructuraId: movActivo.estructura_id };
                            if (isConnected && movActivo.estructura_id) {
                                const res = await deleteMovimientoArticuloMantenimiento({ parent, id: m.id, marcaId: current.id, refreshAccessToken, logout });
                                if (res.status) {
                                    Alert.alert('Éxito', 'Movimiento eliminado correctamente');
                                    void fetchReportes();
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
                                    puestoId: resolvePuestoIdForReporte(movActivo),
                                    parentKey: movActivo.key,
                                });
                                Alert.alert('Eliminado (offline)', 'La eliminación se sincronizará cuando vuelva la conexión.');
                            }
                        }
                    } finally {
                        setDeletingMovKey(null);
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
                        <Picker.Item label="Seleccionar..." value="" color="#000000" />
                        <Picker.Item label="Reemplazar" value="Reemplazar" color="#000000" />
                        <Picker.Item label="Rellenar" value="Rellenar" color="#000000" />
                        <Picker.Item label="Reparar en puesto" value="Reparar en puesto" color="#000000" />
                        <Picker.Item label="Reparar en taller" value="Reparar en taller" color="#000000" />
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
                        <Picker.Item label="Seleccionar..." value="" color="#000000" />
                        <Picker.Item label="Preventivo" value="Preventivo" color="#000000" />
                        <Picker.Item label="Correctivo" value="Correctivo" color="#000000" />
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
                                <Picker.Item label="Seleccionar..." value="" color="#000000" />
                                <Picker.Item label="Letal" value="Letal" color="#000000" />
                                <Picker.Item label="Menos Letal" value="Menos Letal" color="#000000" />
                            </Picker>
                        </View>

                        <ThemedText style={styles.label}>Mecanismo:</ThemedText>
                        <View style={styles.pickerContainer}>
                            <Picker
                                selectedValue={armaMecanismo}
                                onValueChange={(value) => setArmaMecanismo(value)}
                                style={styles.picker}
                            >
                                <Picker.Item label="Seleccionar..." value="" color="#000000" />
                                <Picker.Item label="Pistola" value="Pistola" color="#000000" />
                                <Picker.Item label="Revolver" value="Revolver" color="#000000" />
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
                                    if (armaFotoAntesLocal?.localFileName) {
                                        try {
                                            await deleteFile(armaFotoAntesLocal.localFileName);
                                        } catch {
                                            /* idempotente */
                                        }
                                    }
                                    const imgFile = await pickArmaImageAsFile('arma_foto_antes');
                                    if (imgFile) {
                                        setArmaFotoAntesLocal(imgFile);
                                        setArmaFotoAntesName(imgFile.name);
                                    }
                                }}
                            >
                                <Ionicons name="image-outline" size={18} color="#fff" />
                                <ThemedText style={styles.armasMediaButtonText}>{armaFotoAntesLocal ? 'Cambiar' : 'Subir'}</ThemedText>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.armasMediaButton}
                                onPress={() =>
                                    openActivoCamera(async (asset) => {
                                        if (armaFotoAntesLocal?.localFileName) {
                                            try {
                                                await deleteFile(armaFotoAntesLocal.localFileName);
                                            } catch {
                                                /* idempotente */
                                            }
                                        }
                                        const imgFile = await buildArmaFileFromAsset('arma_foto_antes', asset);
                                        setArmaFotoAntesLocal(imgFile);
                                        setArmaFotoAntesName(imgFile.name);
                                    })
                                }
                            >
                                <Ionicons name="camera-outline" size={18} color="#fff" />
                                <ThemedText style={styles.armasMediaButtonText}>Tomar foto</ThemedText>
                            </TouchableOpacity>
                            {armaFotoAntesLocal ? (
                                <>
                                    <Image
                                        source={{ uri: localMantenimientoFileImageUri(armaFotoAntesLocal) }}
                                        style={styles.armasThumb}
                                    />
                                    <TouchableOpacity
                                        style={styles.armasRemoveButton}
                                        onPress={async () => {
                                            if (armaFotoAntesLocal?.localFileName) {
                                                try {
                                                    await deleteFile(armaFotoAntesLocal.localFileName);
                                                } catch {
                                                    /* idempotente */
                                                }
                                            }
                                            setArmaFotoAntesLocal(null);
                                            setArmaFotoAntesName('');
                                        }}
                                    >
                                        <Ionicons name="trash" size={18} color="#FF3B30" />
                                    </TouchableOpacity>
                                </>
                            ) : null}
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
                                    if (armaFotoDespuesLocal?.localFileName) {
                                        try {
                                            await deleteFile(armaFotoDespuesLocal.localFileName);
                                        } catch {
                                            /* idempotente */
                                        }
                                    }
                                    const imgFile = await pickArmaImageAsFile('arma_foto_despues');
                                    if (imgFile) {
                                        setArmaFotoDespuesLocal(imgFile);
                                        setArmaFotoDespuesName(imgFile.name);
                                    }
                                }}
                            >
                                <Ionicons name="image-outline" size={18} color="#fff" />
                                <ThemedText style={styles.armasMediaButtonText}>{armaFotoDespuesLocal ? 'Cambiar' : 'Subir'}</ThemedText>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.armasMediaButton}
                                onPress={() =>
                                    openActivoCamera(async (asset) => {
                                        if (armaFotoDespuesLocal?.localFileName) {
                                            try {
                                                await deleteFile(armaFotoDespuesLocal.localFileName);
                                            } catch {
                                                /* idempotente */
                                            }
                                        }
                                        const imgFile = await buildArmaFileFromAsset('arma_foto_despues', asset);
                                        setArmaFotoDespuesLocal(imgFile);
                                        setArmaFotoDespuesName(imgFile.name);
                                    })
                                }
                            >
                                <Ionicons name="camera-outline" size={18} color="#fff" />
                                <ThemedText style={styles.armasMediaButtonText}>Tomar foto</ThemedText>
                            </TouchableOpacity>
                            {armaFotoDespuesLocal ? (
                                <>
                                    <Image
                                        source={{ uri: localMantenimientoFileImageUri(armaFotoDespuesLocal) }}
                                        style={styles.armasThumb}
                                    />
                                    <TouchableOpacity
                                        style={styles.armasRemoveButton}
                                        onPress={async () => {
                                            if (armaFotoDespuesLocal?.localFileName) {
                                                try {
                                                    await deleteFile(armaFotoDespuesLocal.localFileName);
                                                } catch {
                                                    /* idempotente */
                                                }
                                            }
                                            setArmaFotoDespuesLocal(null);
                                            setArmaFotoDespuesName('');
                                        }}
                                    >
                                        <Ionicons name="trash" size={18} color="#FF3B30" />
                                    </TouchableOpacity>
                                </>
                            ) : null}
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
                                <Image key={`arma-firma-${armaFirma.length}`} source={{ uri: armaFirma.startsWith('data:') ? armaFirma : formatSignatureForDisplay(armaFirma) || '' }} style={styles.armasSignatureImage} resizeMode="contain" />
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
                        <Picker.Item label="Seleccionar..." value="" color="#000000" />
                        {(selectedReporte?.tipos_mantenimiento || []).map((t) => (
                            <Picker.Item key={t.id} label={t.nombre} value={t.nombre} color="#000000" />
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
                        <Picker.Item label="Seleccionar..." value="" color="#000000" />
                        {categoriasMantenimiento.map((cat) => (
                            <Picker.Item key={cat.id} label={cat.nombre} value={cat.nombre} color="#000000" />
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
                                <Picker.Item label="Seleccionar..." value="" color="#000000" />
                                {(selectedReporte?.tipos_mantenimiento || []).map((t) => (
                                    <Picker.Item key={t.id} label={t.nombre} value={t.nombre} color="#000000" />
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
                            {activoFiles.filter(f => f.type === 'document').map((file) => (
                                <View key={file.id} style={styles.activoRemoteFileWrapRow}>
                                    {selectedActivo && selectedReporte && Number(file.id) > 0 ? (
                                        <TouchableOpacity
                                            style={styles.activoRemoteDeleteFab}
                                            onPress={() => confirmDeleteArchivoAdjunto(selectedActivo, file, selectedReporte)}
                                        >
                                            <Ionicons name="trash" size={16} color="#FF3B30" />
                                        </TouchableOpacity>
                                    ) : null}
                                    <ThemedView style={styles.fileRow}>
                                        <Ionicons name="document-text-outline" size={16} color="#007AFF" />
                                        <ThemedText numberOfLines={1} style={styles.fileName}>
                                            {file.original_name || file.name}
                                        </ThemedText>
                                        <TouchableOpacity
                                            onPress={() => {
                                                const url = buildFileUrl(selectedActivo?.id, file);
                                                if (url) Linking.openURL(url);
                                            }}
                                        >
                                            <Ionicons name="open-outline" size={16} color="#007AFF" />
                                        </TouchableOpacity>
                                    </ThemedView>
                                </View>
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
                                    <TouchableOpacity onPress={() => void removeLocalFile(file)}>
                                        <Ionicons name="trash" size={16} color="#FF3B30" />
                                    </TouchableOpacity>
                                </ThemedView>
                            ))}
                        </ThemedView>
                    )}
                </ThemedView>

                <ThemedView style={styles.formGroup}>
                    <ThemedText style={styles.formLabel}>Imágenes</ThemedText>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        <TouchableOpacity
                            style={styles.addFileButton}
                            onPress={() => handleAddFile('image')}
                        >
                            <Ionicons name="image-outline" size={18} color="#007AFF" />
                            <ThemedText style={styles.addFileButtonText}>Agregar imagen</ThemedText>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.addFileButton}
                            onPress={() => openActivoCamera((asset) => void addPickedAssetAsFile('image', asset))}
                        >
                            <Ionicons name="camera-outline" size={18} color="#007AFF" />
                            <ThemedText style={styles.addFileButtonText}>Tomar foto</ThemedText>
                        </TouchableOpacity>
                    </View>
                    {activoFiles.filter(f => f.type === 'image').length > 0 && (
                        <ThemedView style={styles.filesList}>
                            {activoFiles.filter(f => f.type === 'image').map((file) => (
                                <View key={file.id} style={styles.activoRemoteFileWrapRow}>
                                    {selectedActivo && selectedReporte && Number(file.id) > 0 ? (
                                        <TouchableOpacity
                                            style={styles.activoRemoteDeleteFab}
                                            onPress={() => confirmDeleteArchivoAdjunto(selectedActivo, file, selectedReporte)}
                                        >
                                            <Ionicons name="trash" size={16} color="#FF3B30" />
                                        </TouchableOpacity>
                                    ) : null}
                                    <ThemedView style={styles.fileRow}>
                                        <Image
                                            source={{ uri: buildFileUrl(selectedActivo?.id, file) }}
                                            style={styles.filePreviewImage}
                                            resizeMode="cover"
                                        />
                                        <ThemedText numberOfLines={1} style={styles.fileName}>
                                            {file.original_name || file.name}
                                        </ThemedText>
                                        <TouchableOpacity
                                            onPress={() => {
                                                const url = buildFileUrl(selectedActivo?.id, file);
                                                if (url) Linking.openURL(url);
                                            }}
                                        >
                                            <Ionicons name="open-outline" size={16} color="#007AFF" />
                                        </TouchableOpacity>
                                    </ThemedView>
                                </View>
                            ))}
                        </ThemedView>
                    )}
                    {imageFiles.length > 0 && (
                        <ThemedView style={styles.filesList}>
                            {imageFiles.map(file => (
                                <ThemedView key={file.id} style={styles.fileRow}>
                                    <Image
                                        source={{
                                            uri: localMantenimientoFileImageUri(file),
                                        }}
                                        style={styles.filePreviewImage}
                                        resizeMode="cover"
                                    />
                                    <ThemedText numberOfLines={1} style={styles.fileName}>
                                        {file.name}
                                    </ThemedText>
                                    <TouchableOpacity onPress={() => void removeLocalFile(file)}>
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
                            {activoFiles.filter(f => f.type === 'audio').map((file) => (
                                <View key={file.id} style={styles.activoRemoteFileWrapRow}>
                                    {selectedActivo && selectedReporte && Number(file.id) > 0 ? (
                                        <TouchableOpacity
                                            style={styles.activoRemoteDeleteFab}
                                            onPress={() => confirmDeleteArchivoAdjunto(selectedActivo, file, selectedReporte)}
                                        >
                                            <Ionicons name="trash" size={16} color="#FF3B30" />
                                        </TouchableOpacity>
                                    ) : null}
                                    <ThemedView style={styles.fileRow}>
                                        <Ionicons name="musical-notes-outline" size={16} color="#007AFF" />
                                        <ThemedText numberOfLines={1} style={styles.fileName}>
                                            {file.original_name || file.name}
                                        </ThemedText>
                                        <TouchableOpacity
                                            onPress={() => {
                                                const url = buildFileUrl(selectedActivo?.id, file);
                                                if (url) Linking.openURL(url);
                                            }}
                                        >
                                            <Ionicons name="open-outline" size={16} color="#007AFF" />
                                        </TouchableOpacity>
                                    </ThemedView>
                                </View>
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
                                    <TouchableOpacity onPress={() => void removeLocalFile(file)}>
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
                            {activoFiles.filter(f => f.type === 'video').map((file) => (
                                <View key={file.id} style={styles.activoRemoteFileWrapRow}>
                                    {selectedActivo && selectedReporte && Number(file.id) > 0 ? (
                                        <TouchableOpacity
                                            style={styles.activoRemoteDeleteFab}
                                            onPress={() => confirmDeleteArchivoAdjunto(selectedActivo, file, selectedReporte)}
                                        >
                                            <Ionicons name="trash" size={16} color="#FF3B30" />
                                        </TouchableOpacity>
                                    ) : null}
                                    <ThemedView style={styles.fileRow}>
                                        <Ionicons name="videocam-outline" size={16} color="#007AFF" />
                                        <ThemedText numberOfLines={1} style={styles.fileName}>
                                            {file.original_name || file.name}
                                        </ThemedText>
                                        <TouchableOpacity
                                            onPress={() => {
                                                const url = buildFileUrl(selectedActivo?.id, file);
                                                if (url) Linking.openURL(url);
                                            }}
                                        >
                                            <Ionicons name="open-outline" size={16} color="#007AFF" />
                                        </TouchableOpacity>
                                    </ThemedView>
                                </View>
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
                                    <TouchableOpacity onPress={() => void removeLocalFile(file)}>
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
                    <ThemedView style={styles.titleContainer}>
                        <ThemedText type="title" style={styles.title}>
                            <Ionicons name="construct" size={22} color="#000000" /> Equipo del puesto
                        </ThemedText>
                        <ThemedText style={styles.subtitle}>Gestiona el equipo del puesto</ThemedText>
                    </ThemedView>

                    {!hasCurrentMarca ? (
                        <ThemedView style={styles.emptyContainer}>
                            <ThemedText style={styles.errorText}>
                                No hay marca activa. Puede seleccionar la jerarquía manualmente en los filtros.
                            </ThemedText>
                        </ThemedView>
                    ) : null}

                    {/* Filtros jerárquicos (Empresa → ... → Puesto); OPERATIVO: datos por corpo de current_marca (sin selectores) */}
                    {!isUpdating &&
                        !showActivos &&
                        roleName != null &&
                        roleName !== 'OPERATIVO' && (
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
                                    <HierarchyPickerFields
                                        structure={structure}
                                        levels={['cliente', 'contrato', 'sucursal', 'puesto']}
                                        emptyPickerValue={0}
                                        values={{
                                            empresaId: filterEmpresaId,
                                            clienteId: filterClienteId,
                                            divisionId: filterDivisionId,
                                            contratoId: filterContratoId,
                                            sucursalId: filterCorpoId,
                                            puestoId: filterPuestoId,
                                        }}
                                        onChange={handleFilterHierarchyChange}
                                        labels={{ sucursal: 'Sucursal', puesto: 'Puesto' }}
                                        renderLabel={(text) => <ThemedText style={styles.filterLabel}>{text}:</ThemedText>}
                                        pickerStyle={styles.picker}
                                        fieldGroupStyle={styles.filterGroup}
                                    />
                                </ThemedView>
                            )}
                        </ThemedView>
                    )}

                    {canBulkArticulosPuesto && !isUpdating && !showActivos && (
                        <TouchableOpacity
                            style={styles.bulkArticulosOpenButton}
                            onPress={openBulkArticulosModal}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" />
                            <ThemedText style={styles.bulkArticulosOpenButtonText}>
                                Carga masiva de artículos
                            </ThemedText>
                        </TouchableOpacity>
                    )}

                    {canBulkArticulosPuesto && !isUpdating && !showActivos && (
                        <TouchableOpacity
                            style={[styles.bulkArticulosOpenButton, { backgroundColor: '#34C759', marginTop: 8 }]}
                            onPress={openUnitArticuloModal}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
                            <ThemedText style={styles.bulkArticulosOpenButtonText}>
                                Agregar equipo a puesto(s)
                            </ThemedText>
                        </TouchableOpacity>
                    )}

                    {/* Aviso jerarquía: debajo del filtro principal de la lista de artículos del puesto */}
                    {!isUpdating &&
                        !showActivos &&
                        hasCurrentMarca &&
                        !isLoading &&
                        isHierarchyHintVisible && (
                            <ThemedView style={[styles.hierarchyHintBox, styles.hierarchyHintBoxColumn, { marginHorizontal: 0 }]}>
                                <ThemedView style={styles.hierarchyHintTopRow}>
                                    <Ionicons name="information-circle-outline" size={22} color="#007AFF" style={{ marginRight: 10 }} />
                                    <ThemedView style={styles.hierarchyHintTextRow}>
                                        <ThemedText style={[styles.hierarchyHintText, { flex: 1 }]}>
                                            Algunos datos podrían estar desactualizados. Para mayor precisión, vaya a la sección de jerarquía y actualice la información.
                                        </ThemedText>
                                        <TouchableOpacity
                                            onPress={() => setIsHierarchyHintVisible(false)}
                                            style={styles.hierarchyHintClose}
                                            accessibilityLabel="Cerrar aviso"
                                        >
                                            <ThemedText style={styles.hierarchyHintCloseText}>Cerrar</ThemedText>
                                        </TouchableOpacity>
                                    </ThemedView>
                                </ThemedView>
                                <TouchableOpacity
                                    style={[styles.goEntregaButton, styles.hierarchyHintGoButton]}
                                    onPress={() => navigation.navigate('Jerarquia')}
                                    activeOpacity={0.85}
                                    accessibilityLabel="Abrir Jerarquía para actualizar"
                                >
                                    <Ionicons name="open-outline" size={16} color="#007AFF" />
                                    <ThemedText style={styles.goEntregaButtonText}>
                                        Actualiza los datos en Jerarquía
                                    </ThemedText>
                                </TouchableOpacity>
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

                                    <ThemedText style={styles.sectionTitle}>Firma entrega (opcional)</ThemedText>
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

                                    <ThemedText style={styles.sectionTitle}>Firma recibe (opcional)</ThemedText>
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
                                                            <ThemedText style={styles.firmaInfoValue}>Hora: { convertDateTimestampToLocalString( new Date(Number(info.timestamp)).toISOString()) || 'N/A'}</ThemedText>
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
                                        <TouchableOpacity style={[styles.formActionButton, styles.formActionCancel]} onPress={cancelMovCreating} disabled={isMovSubmitting}>
                                            <Ionicons name="close" size={18} color="#000" />
                                            <ThemedText style={styles.formActionCancelText}>Cancelar</ThemedText>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.formActionButton, styles.formActionSave, isMovSubmitting && styles.buttonDisabled]}
                                            onPress={handleMovSave}
                                            disabled={isMovSubmitting}
                                        >
                                            {isMovSubmitting ? (
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
                                                        <TouchableOpacity
                                                            style={[styles.listItemButton, styles.deleteButtonMov, deletingMovKey === getMovItemKey(m) && styles.buttonDisabled]}
                                                            onPress={() => handleMovDelete(m)}
                                                            disabled={!!deletingMovKey}
                                                        >
                                                            {deletingMovKey === getMovItemKey(m) ? (
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

                        <CambiosAppsModulesModal
                visible={isCambiosModalVisible}
                title={cambiosTitle}
                items={cambiosItems}
                onClose={closeCambiosModal}
            />


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

            {/* Cámara reutilizable (una foto por apertura, igual que ChecklistSupervisionScreen.tsx) */}
            <Modal
                visible={isActivoCameraVisible}
                animationType="slide"
                onRequestClose={() => setIsActivoCameraVisible(false)}
            >
                <ThemedView style={{ flex: 1, backgroundColor: '#000' }}>
                    {activoCameraPermission?.granted ? (
                        <CameraView ref={activoCameraRef} style={{ flex: 1 }} facing="back">
                            <TouchableOpacity
                                style={styles.cameraCloseButton}
                                onPress={() => setIsActivoCameraVisible(false)}
                            >
                                <Ionicons name="close" size={30} color="#FFFFFF" />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.cameraCaptureButton} onPress={captureActivoPhoto}>
                                <ThemedView style={styles.cameraCaptureButtonInner} />
                            </TouchableOpacity>
                        </CameraView>
                    ) : (
                        <ThemedView style={styles.cameraPermissionContainer}>
                            <ThemedText style={styles.cameraPermissionText}>Se requiere permiso de cámara</ThemedText>
                            <TouchableOpacity
                                style={styles.cameraPermissionBtn}
                                onPress={requestActivoCameraPermission}
                                activeOpacity={0.85}
                            >
                                <ThemedText style={styles.cameraPermissionBtnText}>Solicitar permiso</ThemedText>
                            </TouchableOpacity>
                        </ThemedView>
                    )}
                </ThemedView>
            </Modal>

            <Modal
                visible={isBulkArticulosModalVisible}
                transparent
                animationType="fade"
                onRequestClose={closeBulkArticulosModal}
            >
                <View style={styles.bulkModalOverlay}>
                    <ThemedView style={styles.bulkModalContainer}>
                        <ThemedText style={styles.modalTitle}>Carga masiva de artículos</ThemedText>
                        <ThemedText style={styles.bulkModalDisclaimer}>
                            Descargue la plantilla Excel, indique el código de cada puesto en la primera columna,
                            complétela y súbala para vincular artículos. En «Fecha de entrega» use solo la fecha
                            (DD-MM-YYYY); al cargar se asignará 00:00:00. La validación de códigos de puesto requiere
                            conexión a internet.
                        </ThemedText>
                        <ScrollView
                            style={styles.bulkModalScroll}
                            contentContainerStyle={styles.bulkModalScrollContent}
                            keyboardShouldPersistTaps="handled"
                        >
                            <ThemedView style={styles.bulkPlantillaActions}>
                                        <TouchableOpacity
                                            style={[styles.bulkPlantillaButton, isBulkDownloadingPlantilla && { opacity: 0.7 }]}
                                            onPress={handleDownloadBulkPlantilla}
                                            disabled={isBulkDownloadingPlantilla}
                                        >
                                            {isBulkDownloadingPlantilla ? (
                                                <ActivityIndicator size="small" color="#FFFFFF" />
                                            ) : (
                                                <Ionicons name="download-outline" size={18} color="#FFFFFF" />
                                            )}
                                            <ThemedText style={styles.bulkPlantillaButtonText}>Descargar plantilla</ThemedText>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.bulkPlantillaButtonSecondary, isBulkValidatingPlantilla && { opacity: 0.7 }]}
                                            onPress={handleUploadBulkPlantilla}
                                            disabled={isBulkValidatingPlantilla}
                                        >
                                            {isBulkValidatingPlantilla ? (
                                                <ActivityIndicator size="small" color="#007AFF" />
                                            ) : (
                                                <Ionicons name="document-attach-outline" size={18} color="#007AFF" />
                                            )}
                                            <ThemedText style={styles.bulkPlantillaButtonSecondaryText}>
                                                Subir plantilla
                                            </ThemedText>
                                        </TouchableOpacity>
                                    </ThemedView>

                                    {bulkPlantillaArticulos.length > 0 && (
                                        <ThemedView style={styles.selectedPuestosBox}>
                                            <TouchableOpacity
                                                style={styles.selectedPuestosHeader}
                                                onPress={() => setBulkIsPlantillaExpanded((p) => !p)}
                                            >
                                                <ThemedText style={styles.selectedPuestosHeaderText}>
                                                    Artículos de la plantilla ({bulkPlantillaArticulos.length})
                                                </ThemedText>
                                                <Ionicons
                                                    name={bulkIsPlantillaExpanded ? 'chevron-up' : 'chevron-down'}
                                                    size={18}
                                                    color="#007AFF"
                                                />
                                            </TouchableOpacity>
                                            {bulkIsPlantillaExpanded && (
                                                <ThemedView style={styles.bulkRemovableList}>
                                                    {bulkPlantillaArticulos.map((art, index) => (
                                                        <ThemedView
                                                            key={`${art.numero_articulo}-${index}`}
                                                            style={styles.bulkRemovableItem}
                                                        >
                                                            <ThemedView style={{ flex: 1 }}>
                                                                <ThemedText style={styles.bulkRemovableItemTitle}>
                                                                    Puesto: {art.codigo_puesto}
                                                                    {art.puesto_nombre && art.puesto_nombre !== art.codigo_puesto
                                                                        ? ` — ${art.puesto_nombre}`
                                                                        : ''}
                                                                </ThemedText>
                                                                <ThemedText style={styles.bulkRemovableItemTitle}>
                                                                    #{art.numero_articulo} — {art.articulo_nombre}
                                                                </ThemedText>
                                                                <ThemedText style={styles.bulkRemovableItemMeta}>
                                                                    Cant: {art.cantidad} | {art.marca} | {art.modelo || '—'} | {art.serie} |{' '}
                                                                    {art.fecha_entrega}
                                                                </ThemedText>
                                                            </ThemedView>
                                                            <TouchableOpacity
                                                                onPress={() => removeBulkPlantillaArticulo(index)}
                                                                accessibilityLabel="Quitar artículo"
                                                            >
                                                                <Ionicons name="close-circle" size={22} color="#FF3B30" />
                                                            </TouchableOpacity>
                                                        </ThemedView>
                                                    ))}
                                                </ThemedView>
                                            )}
                                        </ThemedView>
                                    )}
                        </ScrollView>

                        <ThemedView style={styles.bulkModalActions}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.modalCancelButton]}
                                onPress={closeBulkArticulosModal}
                            >
                                <ThemedText style={styles.modalCancelButtonText}>Cancelar</ThemedText>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.modalButton,
                                    styles.modalConfirmButton,
                                    isBulkSubmitting && { opacity: 0.7 },
                                ]}
                                onPress={handleSubmitBulkArticulos}
                                disabled={isBulkSubmitting}
                            >
                                {isBulkSubmitting ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <ThemedText style={styles.modalConfirmButtonText}>Actualizar</ThemedText>
                                )}
                            </TouchableOpacity>
                        </ThemedView>
                    </ThemedView>
                </View>
            </Modal>

            <Modal
                visible={isUnitArticuloModalVisible}
                transparent
                animationType="fade"
                presentationStyle="overFullScreen"
                onRequestClose={closeUnitArticuloModal}
            >
                <View style={styles.overlay}>
                    <ThemedView style={styles.floatModalCard}>
                        <ThemedView style={styles.floatModalHeader}>
                            <ThemedText style={styles.modalTitle}>Agregar equipo a puesto(s)</ThemedText>
                            <TouchableOpacity onPress={closeUnitArticuloModal}>
                                <Ionicons name="close" size={24} color="#333" />
                            </TouchableOpacity>
                        </ThemedView>
                        <ThemedText style={styles.signatureModalHint}>
                            Complete los datos del equipo e indique el código o nombre de 1 o más puestos a los que
                            se asignará. Se enviará al mismo proceso que la carga masiva de artículos.
                        </ThemedText>
                        <ScrollView
                            style={{ maxHeight: Dimensions.get('window').height * 0.55 }}
                            contentContainerStyle={{ padding: 12 }}
                            keyboardShouldPersistTaps="handled"
                        >
                            <ThemedText style={styles.label}>Puesto(s):</ThemedText>
                            <View style={styles.row}>
                                <TextInput
                                    style={[styles.input, { flex: 1 }]}
                                    value={unitPuestoSearch}
                                    onChangeText={setUnitPuestoSearch}
                                    placeholder="Buscar por nombre o código"
                                />
                                <TouchableOpacity
                                    style={styles.searchIconBtn}
                                    onPress={() => void runUnitPuestoSearch()}
                                    activeOpacity={0.85}
                                    disabled={isUnitValidatingPuesto}
                                >
                                    {isUnitValidatingPuesto ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <Ionicons name="search" size={22} color="#fff" />
                                    )}
                                </TouchableOpacity>
                            </View>
                            {unitPuestoResults.length > 0 && (
                                <ThemedView style={styles.resultList}>
                                    {unitPuestoResults.map((it) => (
                                        <TouchableOpacity
                                            key={`unit-puesto-result-${it.id}`}
                                            style={styles.resultItem}
                                            onPress={() => selectUnitPuesto(it)}
                                        >
                                            <ThemedText>
                                                {[it.codigo, it.nombre].filter(Boolean).join(' — ')}
                                            </ThemedText>
                                        </TouchableOpacity>
                                    ))}
                                </ThemedView>
                            )}
                            <ThemedView style={styles.assignedList}>
                                {unitPuestos.length === 0 ? (
                                    <ThemedText style={styles.helperText}>Ningún puesto seleccionado.</ThemedText>
                                ) : (
                                    unitPuestos.map((p, index) => (
                                        <ThemedView key={`${p.codigo}-${index}`} style={styles.assignedUserItem}>
                                            <ThemedText style={styles.assignedUserTitle}>
                                                {p.codigo}
                                                {p.nombre && p.nombre !== p.codigo ? ` — ${p.nombre}` : ''}
                                            </ThemedText>
                                            <TouchableOpacity
                                                style={styles.removeUserButton}
                                                onPress={() => removeUnitPuesto(index)}
                                                accessibilityLabel="Quitar puesto"
                                            >
                                                <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                                            </TouchableOpacity>
                                        </ThemedView>
                                    ))
                                )}
                            </ThemedView>

                            <ThemedText style={styles.label}>Artículo:</ThemedText>
                            <View style={styles.pickerContainer}>
                                <Picker
                                    selectedValue={unitSelectedArticulo ? String(unitSelectedArticulo.id) : ''}
                                    onValueChange={(value: string) => {
                                        if (value === '') {
                                            setUnitSelectedArticulo(null);
                                            return;
                                        }
                                        const found = unitArticuloCatalog.find((a) => a.id === Number(value));
                                        setUnitSelectedArticulo(found ?? null);
                                    }}
                                    style={styles.picker}
                                >
                                    <Picker.Item
                                        label={isUnitCatalogLoading ? 'Cargando catálogo...' : 'Seleccionar...'}
                                        value=""
                                        color="#000000"
                                    />
                                    {unitArticuloCatalog.map((a) => (
                                        <Picker.Item key={a.id} label={`#${a.id} — ${a.nombre}`} value={String(a.id)} color="#000000" />
                                    ))}
                                </Picker>
                            </View>

                            <ThemedText style={styles.label}>Cantidad:</ThemedText>
                            <TextInput
                                style={styles.input}
                                value={unitCantidad}
                                onChangeText={setUnitCantidad}
                                keyboardType="numeric"
                                placeholder="Cantidad"
                            />

                            <ThemedText style={styles.label}>Serie:</ThemedText>
                            <TextInput
                                style={styles.input}
                                value={unitSerie}
                                onChangeText={setUnitSerie}
                                placeholder="Serie"
                            />

                            <ThemedText style={styles.label}>Marca:</ThemedText>
                            <TextInput
                                style={styles.input}
                                value={unitMarca}
                                onChangeText={setUnitMarca}
                                placeholder="Marca"
                            />

                            <ThemedText style={styles.label}>Modelo (opcional):</ThemedText>
                            <TextInput
                                style={styles.input}
                                value={unitModelo}
                                onChangeText={setUnitModelo}
                                placeholder="Modelo"
                            />

                            <ThemedText style={styles.label}>Fecha de entrega:</ThemedText>
                            <TouchableOpacity
                                style={styles.dateButton}
                                onPress={() => setShowUnitFechaEntregaPicker(true)}
                            >
                                <ThemedText style={styles.dateButtonText}>
                                    {unitFechaEntrega.toLocaleDateString()}
                                </ThemedText>
                                <Ionicons name="calendar-outline" size={18} color="#007AFF" />
                            </TouchableOpacity>
                            {showUnitFechaEntregaPicker && (
                                <DateTimePicker
                                    value={unitFechaEntrega}
                                    mode="date"
                                    display="default"
                                    onChange={(_event, selectedDate) => {
                                        setShowUnitFechaEntregaPicker(false);
                                        if (selectedDate) setUnitFechaEntrega(selectedDate);
                                    }}
                                />
                            )}
                        </ScrollView>

                        <ThemedView style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.modalCancelButton]}
                                onPress={closeUnitArticuloModal}
                            >
                                <ThemedText style={styles.modalCancelButtonText}>Cancelar</ThemedText>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.modalButton,
                                    styles.modalConfirmButton,
                                    isUnitSubmitting && { opacity: 0.7 },
                                ]}
                                onPress={handleSubmitUnitArticulo}
                                disabled={isUnitSubmitting}
                            >
                                {isUnitSubmitting ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <ThemedText style={styles.modalConfirmButtonText}>Guardar</ThemedText>
                                )}
                            </TouchableOpacity>
                        </ThemedView>
                    </ThemedView>
                </View>
            </Modal>

            <AppFooter />
            <PlanillasPasswordRevalidationModal
                visible={showPlanillasRevalidationModal}
                refreshAccessToken={refreshAccessToken}
                logout={logout}
                onSuccess={handlePlanillasRevalidationSuccess}
                onDismiss={handlePlanillasRevalidationDismiss}
            />
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

    row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    searchIconBtn: {
        backgroundColor: '#007AFF',
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    resultList: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, overflow: 'hidden', marginTop: 4 },
    resultItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#E8E8E8', backgroundColor: '#FFFFFF' },
    assignedList: { marginTop: 8 },
    helperText: { fontSize: 13, color: '#666', lineHeight: 18 },
    assignedUserItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        paddingHorizontal: 10,
        marginTop: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        backgroundColor: '#FFFFFF',
    },
    assignedUserTitle: { fontSize: 14, color: '#000', flex: 1, paddingRight: 8 },
    removeUserButton: { padding: 4 },

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
    changeDescriptionContainer: { marginBottom: 8 },
    cambioSignatureImage: { marginTop: 6, height: 80, width: 160, backgroundColor: '#f0f0f0', borderRadius: 4 },

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
    activoRemoteFileWrap: {
        position: 'relative',
        alignSelf: 'center',
        width: '100%',
        marginBottom: 8,
    },
    activoRemoteFileWrapRow: {
        position: 'relative',
        width: '100%',
        marginBottom: 8,
    },
    activoRemoteDeleteFab: {
        position: 'absolute',
        top: 4,
        right: 4,
        zIndex: 10,
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderRadius: 14,
        padding: 6,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
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
    hierarchyHintBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E8F4FF',
        borderWidth: 1,
        borderColor: '#B8DAF8',
        borderRadius: 10,
        paddingVertical: 12,
        paddingHorizontal: 12,
        marginBottom: 16,
    },
    hierarchyHintBoxColumn: {
        flexDirection: 'column',
        alignItems: 'stretch',
    },
    hierarchyHintTopRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        width: '100%',
        backgroundColor: '#E8F4FF',
    },
    hierarchyHintTextRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        minWidth: 0,
        backgroundColor: '#E8F4FF',
    },
    hierarchyHintGoButton: {
        width: '100%',
        marginTop: 10,
        marginBottom: 0,
    },
    hierarchyHintText: {
        fontSize: 14,
        color: '#1a1a1a',
        lineHeight: 20,
        backgroundColor: '#E8F4FF',
    },
    hierarchyHintClose: {
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 8,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#007AFF',
        flexShrink: 0,
        alignSelf: 'flex-start',
    },
    hierarchyHintCloseText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#007AFF',
    },
    /** Misma apariencia que el acceso a Entrega de puestos en ActivitiesScreen */
    goEntregaButton: {
        borderWidth: 1,
        borderColor: '#007AFF',
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#F4F9FF',
        marginTop: 10,
        marginBottom: 4,
        alignSelf: 'stretch',
    },
    goEntregaButtonText: {
        color: '#007AFF',
        fontWeight: '700',
        fontSize: 12,
        flex: 1,
    },
    hierarchyHintActions: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        width: '100%',
        justifyContent: 'flex-end',
    },
    evaluacionJerarquiaBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#FEF3C7',
        borderWidth: 1,
        borderColor: '#F59E0B',
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 12,
        marginBottom: 10,
        marginTop: 4,
    },
    evaluacionJerarquiaBannerText: {
        flex: 1,
        fontSize: 14,
        fontWeight: '700',
        color: '#92400E',
    },
    evaluacionInformativoBox: {
        backgroundColor: '#F3F4F6',
        borderLeftWidth: 4,
        borderLeftColor: '#6B7280',
        padding: 12,
        borderRadius: 8,
        marginTop: 10,
        marginBottom: 8,
    },
    evaluacionInformativoText: {
        fontSize: 13,
        color: '#374151',
        lineHeight: 20,
    },

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

    bulkArticulosOpenButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 6,
        paddingVertical: 12,
        borderRadius: 8,
        backgroundColor: '#5856D6',
    },
    bulkArticulosOpenButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
    },
    bulkModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    bulkModalContainer: {
        width: '100%',
        maxWidth: 560,
        maxHeight: '90%',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        overflow: 'hidden',
    },
    bulkModalDisclaimer: {
        fontSize: 13,
        color: '#555555',
        marginBottom: 10,
        lineHeight: 20,
    },
    bulkModalScroll: {
        flexGrow: 0,
        maxHeight: 460,
        marginBottom: 8,
    },
    bulkModalScrollContent: {
        paddingBottom: 12,
    },
    bulkModalActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#E0E0E0',
    },
    modalButton: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalCancelButton: {
        backgroundColor: '#E0E0E0',
    },
    modalConfirmButton: {
        backgroundColor: '#007AFF',
    },
    modalCancelButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#333333',
    },
    modalConfirmButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    treeActionsRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 10,
        marginBottom: 6,
    },
    treeActionPrimary: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: '#007AFF',
    },
    treeActionPrimaryText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '800',
    },
    treeActionSecondary: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#007AFF',
        backgroundColor: '#FFFFFF',
    },
    treeActionSecondaryText: {
        color: '#007AFF',
        fontSize: 13,
        fontWeight: '800',
    },
    selectedPuestosBox: {
        marginTop: 10,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 10,
        padding: 10,
        backgroundColor: '#FFFFFF',
    },
    selectedPuestosHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 6,
    },
    selectedPuestosHeaderText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#007AFF',
    },
    bulkRemovableList: {
        gap: 8,
        marginTop: 6,
    },
    bulkRemovableItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E8E8E8',
        backgroundColor: '#FAFAFA',
    },
    bulkRemovableItemText: {
        flex: 1,
        fontSize: 13,
        color: '#333',
    },
    bulkRemovableItemTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#111',
    },
    bulkRemovableItemMeta: {
        fontSize: 11,
        color: '#666',
        marginTop: 2,
    },
    bulkPlantillaActions: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 14,
        marginBottom: 6,
    },
    bulkPlantillaButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 11,
        borderRadius: 8,
        backgroundColor: '#34C759',
    },
    bulkPlantillaButtonText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '700',
    },
    bulkPlantillaButtonSecondary: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 11,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#007AFF',
        backgroundColor: '#FFFFFF',
    },
    bulkPlantillaButtonSecondaryText: {
        color: '#007AFF',
        fontSize: 13,
        fontWeight: '700',
    },
    // Cámara (mismo estándar que ChecklistSupervisionScreen.tsx/PhysicalMinuteAgendaScreen.tsx)
    cameraCloseButton: {
        position: 'absolute',
        top: 50,
        left: 20,
        backgroundColor: 'rgba(255,255,255,0.3)',
        borderRadius: 20,
        padding: 6,
    },
    cameraCaptureButton: {
        position: 'absolute',
        bottom: 40,
        alignSelf: 'center',
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: 'rgba(255,255,255,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    cameraCaptureButtonInner: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#FFFFFF',
    },
    cameraPermissionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    cameraPermissionText: { fontSize: 16, color: '#FFFFFF', marginBottom: 20, textAlign: 'center' },
    cameraPermissionBtn: { backgroundColor: '#007AFF', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
    cameraPermissionBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});

