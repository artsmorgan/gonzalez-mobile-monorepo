import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Linking,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Network from 'expo-network';
import * as DocumentPicker from 'expo-document-picker';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import Ionicons from '@expo/vector-icons/build/Ionicons';

import AppHeader from '@/components/AppHeader';
import AppFooter from '@/components/AppFooter';
import SlideMenu from '@/components/SlideMenu';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useAuth } from '@/contexts/AuthContext';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';
import { eventBus } from '@/hooks/eventBus';
import getHoraAccion from '@/hooks/getHoraAccion';
import authedFetch from '@/hooks/authedFetch';

type Nav = NativeStackNavigationProp<RootStackParamList, 'TrasladoPlazas'>;

type ArchivoAccionItem = {
    id: number;
    consecutivo: string | null;
    cliente: string | null;
    sucursal: string | null;
    puesto: string | null;
    tipo_accion: string | null;
    fecha_vence_subir_adjunto: string | Date | null;
    document: string | null;
    mobile_upload: boolean;
};

type ArchivoAccionUI = ArchivoAccionItem & {
    id_local?: string;
    synced?: boolean;
};

type LocalFile = {
    id: string;
    accion_id: number | string;
    type: 'image' | 'audio' | 'video' | 'document';
    name: string;
    extension: string;
    base64: string;
    mimeType?: string;
};

const getConnectionStatus = async (): Promise<boolean> => {
    try {
        const networkState = await Network.getNetworkStateAsync();
        return networkState.isConnected ?? false;
    } catch {
        return false;
    }
};

const guessMimeType = (file: { type?: string; extension?: string; mimeType?: string }) => {
    if (file.mimeType) return file.mimeType;
    const ext = String(file.extension || '').replace('.', '').toLowerCase();
    const t = String(file.type || '').toLowerCase();
    if (t === 'image') return `image/${ext || 'jpeg'}`;
    if (t === 'audio') return `audio/${ext || 'mpeg'}`;
    if (t === 'video') return `video/${ext || 'mp4'}`;
    if (t === 'document') {
        if (ext === 'pdf') return 'application/pdf';
        if (ext === 'csv') return 'text/csv';
        if (ext === 'txt') return 'text/plain';
        return `application/${ext || 'octet-stream'}`;
    }
    return 'application/octet-stream';
};

const getBase64Only = (value: string | null | undefined): string => {
    if (!value) return '';
    const s = String(value);
    if (s.startsWith('data:')) {
        const parts = s.split(',');
        return parts.length > 1 ? parts.slice(1).join(',') : '';
    }
    return s;
};

const buildFileUrl = (accionId: number | string, fileName: string, fileType: string, accessToken?: string | null): string => {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (apiUrl && typeof accionId === 'number' && accionId > 0) {
        const url = `${apiUrl}/api/traslado-plaza/${accionId}/get-file/${encodeURIComponent(fileName)}`;
        if (!accessToken || accessToken.trim().length === 0) return url;
        return `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(accessToken)}`;
    }
    return '';
};

export default function TrasladoPlazasScreen() {
    const formatDateDMY = (value: any) => {
        if (!value) return '';
        try {
            const d = new Date(String(value));
            if (isNaN(d.getTime())) return String(value);
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = String(d.getFullYear());
            return `${day}-${month}-${year}`;
        } catch {
            return String(value);
        }
    };
    const navigation = useNavigation<Nav>();
    const { employee, refreshAccessToken, logout, accessToken } = useAuth();

    const [isMenuVisible, setIsMenuVisible] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [records, setRecords] = useState<ArchivoAccionUI[]>([]);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [uploadingFile, setUploadingFile] = useState<string | null>(null);
    const [localFiles, setLocalFiles] = useState<LocalFile[]>([]);
    const [pendingFile, setPendingFile] = useState<{ accionId: number | string; file: LocalFile } | null>(null);

    const toggleExpanded = (key: string) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    const fetchArchivosAcciones = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            const empleadoId = employee?.id;
            if (!empleadoId) {
                setError('No se encontró el ID del empleado');
                setIsLoading(false);
                return;
            }

            const isConnected = await getConnectionStatus();

            if (isConnected) {
                const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
                if (!apiUrl) {
                    throw new Error('Server URL not configured');
                }

                const response = await authedFetch({
                    url: `${apiUrl}/api/traslado-plaza`,
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

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                if (data.status && data.acciones_return) {
                    const recordsWithUI: ArchivoAccionUI[] = data.acciones_return.map((item: ArchivoAccionItem) => ({
                        ...item,
                        synced: true,
                    }));
                    setRecords(recordsWithUI);
                    await AsyncStorage.setItem('archivos_acciones_cache', JSON.stringify(recordsWithUI));
                } else {
                    setError(data.message || 'Error al cargar archivos de acciones');
                }
            } else {
                // Modo offline: cargar desde cache
                const cacheStr = await AsyncStorage.getItem('archivos_acciones_cache');
                if (cacheStr) {
                    const cached = JSON.parse(cacheStr);
                    setRecords(cached);
                } else {
                    setError('No hay conexión a internet y no hay datos en caché');
                }
            }
        } catch (err: any) {
            console.error('Error fetching archivos de acciones:', err);
            setError(err.message || 'Error al cargar archivos de acciones');
        } finally {
            setIsLoading(false);
        }
    }, [refreshAccessToken, logout, employee]);

    useFocusEffect(
        useCallback(() => {
            fetchArchivosAcciones();
        }, [fetchArchivosAcciones])
    );

    useEffect(() => {
        const handler = () => {
            fetchArchivosAcciones();
        };
        eventBus.on('syncCompleted', handler);
        return () => {
            eventBus.off('syncCompleted', handler);
        };
    }, [fetchArchivosAcciones]);


    const handleAddFile = async (accionId: number | string, type: 'image' | 'audio' | 'video' | 'document') => {
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
            }

            const result = await DocumentPicker.getDocumentAsync({
                type: pickerTypes,
                multiple: false,
                copyToCacheDirectory: true,
            });

            if (result.canceled || !result.assets || result.assets.length === 0) return;

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
                    } else reject(new Error('No se pudo leer el archivo'));
                };
                reader.onerror = () => reject(reader.error ?? new Error('Error al leer el archivo'));
                reader.readAsDataURL(blob);
            });

            let extension = '';
            if (asset.name && asset.name.includes('.')) {
                extension = asset.name.split('.').pop() || '';
            } else if (asset.mimeType && asset.mimeType.includes('/')) {
                extension = asset.mimeType.split('/').pop() || '';
            }

            const localFileId = `local_file_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
            const localFile: LocalFile = {
                id: localFileId,
                accion_id: accionId,
                type,
                name: asset.name || `archivo.${extension || 'dat'}`,
                extension: extension || 'dat',
                base64,
                mimeType: asset.mimeType,
            };

            // Mostrar vista previa antes de subir
            setPendingFile({ accionId, file: localFile });
        } catch (e: any) {
            console.error('Error picking file:', e);
            Alert.alert('Error', 'No se pudo seleccionar el archivo.');
        }
    };

    const confirmUpload = async () => {
        if (!pendingFile) return;
        const { accionId, file } = pendingFile;
        setPendingFile(null);
        setLocalFiles((prev) => [...prev, file]);
        Alert.alert(
            'Confirmar subida',
            '¿Deseas subir este adjunto?',
            [
                { text: 'Cancelar', style: 'cancel', onPress: () => setLocalFiles((prev) => prev.filter((f) => f.id !== file.id)) },
                {
                    text: 'Subir',
                    onPress: async () => {
                        await uploadFile(accionId, file);
                    },
                },
            ],
        );
    };

    const cancelUpload = () => {
        setPendingFile(null);
    };

    const uploadFile = async (accionId: number | string, file: LocalFile) => {
        try {
            setUploadingFile(file.id);
            const isConnected = await getConnectionStatus();

            const requestData = {
                file_base64: file.base64,
                extension: file.extension,
                original_name: file.name,
                type: file.type,
                mimeType: file.mimeType,
            };

            if (isConnected && typeof accionId === 'number' && accionId > 0) {
                const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
                if (!apiUrl) {
                    throw new Error('Server URL not configured');
                }

                const response = await authedFetch({
                    url: `${apiUrl}/api/traslado-plaza/${accionId}/upload-file`,
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

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ message: 'Error desconocido' }));
                    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                if (data.status) {
                    Alert.alert('Éxito', 'Archivo subido correctamente');
                    setLocalFiles((prev) => prev.filter((f) => f.id !== file.id));
                    await fetchArchivosAcciones();
                } else {
                    throw new Error(data.message || 'Error al subir el archivo');
                }
            } else {
                // Modo offline: guardar en actions
                const actionsStr = await AsyncStorage.getItem('archivos_acciones_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                const actionId = `action_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
                actions.push({
                    id: actionId,
                    action: 'upload_file',
                    type: 'archivo_accion',
                    accion_id: accionId,
                    payload: requestData,
                    synced: false,
                });
                await AsyncStorage.setItem('archivos_acciones_actions', JSON.stringify(actions));

                // Actualizar cache local
                const cacheStr = await AsyncStorage.getItem('archivos_acciones_cache');
                const cache = cacheStr ? JSON.parse(cacheStr) : [];
                const updatedCache = cache.map((item: ArchivoAccionUI) => {
                    if (item.id === accionId || item.id === Number(accionId)) {
                        return {
                            ...item,
                            document: `pending_${file.id}_${file.name}`,
                            mobile_upload: true,
                            synced: false,
                        };
                    }
                    return item;
                });
                await AsyncStorage.setItem('archivos_acciones_cache', JSON.stringify(updatedCache));
                setRecords(updatedCache);

                // Mantener el archivo local para reconstrucción
                Alert.alert('Guardado (offline)', 'El archivo se subirá cuando vuelva la conexión.');
            }
        } catch (err: any) {
            console.error('Error uploading file:', err);
            Alert.alert('Error', err.message || 'No se pudo subir el archivo');
        } finally {
            setUploadingFile(null);
        }
    };

    const getFileUrl = (item: ArchivoAccionUI): string | null => {
        if (!item.document || String(item.document).startsWith('pending_')) return null;

        // Si hay un archivo local para esta acción
        const localFile = localFiles.find((f) => f.accion_id === item.id);
        if (localFile) {
            const mime = guessMimeType(localFile);
            return `data:${mime};base64,${localFile.base64}`;
        }

        // Si está sincronizado, usar la API
        if (item.synced && typeof item.id === 'number' && item.id > 0 && item.document) {
            const fileName = item.document;
            const extension = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() : '';
            const fileType = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension || '')
                ? 'image'
                : ['mp3', 'wav', 'm4a', 'aac'].includes(extension || '')
                    ? 'audio'
                    : ['mp4', 'mov', 'avi', 'mkv'].includes(extension || '')
                        ? 'video'
                        : 'document';
            return buildFileUrl(item.id, fileName, fileType, accessToken);
        }

        return null;
    };

    const renderFilePreview = (item: ArchivoAccionUI) => {
        const fileUrl = getFileUrl(item);
        if (!fileUrl) return null;

        const fileName = item.document || 'archivo';
        const fileId = item.document || '';
        const extension = fileId.includes('.') ? fileId.split('.').pop()?.toLowerCase() : '';
        const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension || '');
        const isAudio = ['mp3', 'wav', 'm4a', 'aac'].includes(extension || '');
        const isVideo = ['mp4', 'mov', 'avi', 'mkv'].includes(extension || '');

        if (isImage) {
            return (
                <Image
                    source={{ uri: fileUrl }}
                    style={styles.filePreviewImage}
                    resizeMode="contain"
                    onError={(e) => {
                        console.error('Error loading image:', e.nativeEvent.error);
                    }}
                />
            );
        }

        if (isAudio) {
            return (
                <ThemedView style={styles.mediaBlock}>
                    <ThemedText style={styles.mediaLabel}>Audio: {fileName}</ThemedText>
                    <AudioPlayer sourceUrl={fileUrl} />
                </ThemedView>
            );
        }

        if (isVideo) {
            return (
                <ThemedView style={styles.mediaBlock}>
                    <ThemedText style={styles.mediaLabel}>Video: {fileName}</ThemedText>
                    <VideoPlayer sourceUrl={fileUrl} />
                </ThemedView>
            );
        }

        return (
            <ThemedView style={styles.fileRow}>
                <Ionicons name="document-text-outline" size={24} color="#007AFF" />
                <ThemedText style={styles.fileName} numberOfLines={1}>{fileName}</ThemedText>
                <TouchableOpacity onPress={() => {
                    if (fileUrl.startsWith('data:')) {
                        // Para archivos locales, intentar abrir con Linking
                        Linking.openURL(fileUrl).catch((err) => {
                            console.error('Error opening file:', err);
                            Alert.alert('Error', 'No se pudo abrir el archivo');
                        });
                    } else {
                        Linking.openURL(fileUrl).catch((err) => {
                            console.error('Error opening file:', err);
                            Alert.alert('Error', 'No se pudo abrir el archivo');
                        });
                    }
                }}>
                    <Ionicons name="open-outline" size={20} color="#007AFF" />
                </TouchableOpacity>
            </ThemedView>
        );
    };

    const AudioPlayer = ({ sourceUrl }: { sourceUrl: string }) => {
        const player = useAudioPlayer(sourceUrl);
        const status = useAudioPlayerStatus(player);
        const [isPlaying, setIsPlaying] = useState(false);

        useEffect(() => {
            setIsPlaying(status.playing);
        }, [status.playing]);

        return (
            <ThemedView style={styles.audioPlayer}>
                <TouchableOpacity
                    onPress={() => {
                        if (isPlaying) {
                            player.pause();
                        } else {
                            player.play();
                        }
                    }}
                    style={styles.playButton}
                >
                    <Ionicons name={isPlaying ? 'pause' : 'play'} size={24} color="#007AFF" />
                </TouchableOpacity>
                <ThemedText style={styles.audioStatus}>
                    {isPlaying ? 'Reproduciendo...' : status.isLoaded ? 'Listo' : 'Cargando...'}
                </ThemedText>
            </ThemedView>
        );
    };

    const VideoPlayer = ({ sourceUrl }: { sourceUrl: string }) => {
        const player = useVideoPlayer(sourceUrl, (player) => {
            player.loop = false;
            player.muted = false;
        });

        return (
            <View style={styles.videoContainer}>
                <VideoView player={player} style={styles.videoPlayer} />
            </View>
        );
    };

    const renderList = () => {
        if (isLoading) {
            return (
                <ThemedView style={styles.centerContainer}>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <ThemedText style={styles.loadingText}>Cargando archivos de acciones...</ThemedText>
                </ThemedView>
            );
        }

        if (error) {
            return (
                <ThemedView style={styles.centerContainer}>
                    <Ionicons name="alert-circle-outline" size={48} color="#FF3B30" />
                    <ThemedText style={styles.errorText}>{error}</ThemedText>
                    <TouchableOpacity style={styles.retryButton} onPress={fetchArchivosAcciones}>
                        <ThemedText style={styles.retryButtonText}>Reintentar</ThemedText>
                    </TouchableOpacity>
                </ThemedView>
            );
        }

        if (records.length === 0) {
            return (
                <ThemedView style={styles.centerContainer}>
                    <Ionicons name="document-outline" size={48} color="#999" />
                    <ThemedText style={styles.emptyText}>No hay acciones pendientes de adjunto</ThemedText>
                </ThemedView>
            );
        }

        return (
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                <ThemedView style={styles.contentContainer}>
                    <ThemedView style={styles.titleContainer}>
                        <ThemedText type="title" style={styles.title}>
                            Archivos de acciones
                        </ThemedText>
                        <ThemedText style={styles.subtitle}>
                            Gestiona y sube adjuntos pendientes de acciones de personal.
                        </ThemedText>
                    </ThemedView>

                    <ThemedView style={styles.listContainer}>
                        {records.map((item, index) => {
                            const key = `accion-${item.id || index}`;
                            const isExpanded = expanded.has(key);
                            const isUploading = uploadingFile && localFiles.some((f) => f.accion_id === item.id);

                            return (
                                <ThemedView key={key} style={styles.card}>
                                    <ThemedText style={styles.cardTitle}>
                                        {item.consecutivo || `Acción #${item.id}`}
                                        {!item.synced && ' (offline)'}
                                    </ThemedText>

                                    <ThemedText style={styles.cardLine}>
                                        <ThemedText style={styles.cardLabel}>Cliente: </ThemedText>
                                        <ThemedText style={styles.cardValue}>{item.cliente || '-'}</ThemedText>
                                    </ThemedText>

                                    <ThemedText style={styles.cardLine}>
                                        <ThemedText style={styles.cardLabel}>Sucursal: </ThemedText>
                                        <ThemedText style={styles.cardValue}>{item.sucursal || '-'}</ThemedText>
                                    </ThemedText>

                                    <ThemedText style={styles.cardLine}>
                                        <ThemedText style={styles.cardLabel}>Puesto: </ThemedText>
                                        <ThemedText style={styles.cardValue}>{item.puesto || '-'}</ThemedText>
                                    </ThemedText>

                                    <ThemedText style={styles.cardLine}>
                                        <ThemedText style={styles.cardLabel}>Tipo de acción: </ThemedText>
                                        <ThemedText style={styles.cardValue}>{item.tipo_accion || '-'}</ThemedText>
                                    </ThemedText>

                                    <ThemedText style={styles.cardLine}>
                                        <ThemedText style={styles.cardLabel}>Fecha vence subir adjunto: </ThemedText>
                                        <ThemedText style={styles.cardValue}>
                                            {item.fecha_vence_subir_adjunto ? formatDateDMY(item.fecha_vence_subir_adjunto) : '-'}
                                        </ThemedText>
                                    </ThemedText>

                                    <TouchableOpacity
                                        style={styles.collapseButton}
                                        onPress={() => toggleExpanded(key)}
                                        activeOpacity={0.85}
                                    >
                                        <ThemedText style={styles.collapseButtonText}>
                                            {isExpanded ? 'Ocultar detalles' : 'Ver detalles'}
                                        </ThemedText>
                                        <Ionicons
                                            name={isExpanded ? 'chevron-up' : 'chevron-down'}
                                            size={18}
                                            color="#007AFF"
                                        />
                                    </TouchableOpacity>

                                    {isExpanded && (
                                        <ThemedView style={styles.collapsableContent}>
                                            <ThemedText style={styles.sectionTitle}>Archivo adjunto</ThemedText>
                                            {(item.document && !String(item.document).startsWith('pending_')) ? (
                                                <ThemedView style={styles.fileContainer}>
                                                    <ThemedText style={styles.fileNameLabel}>
                                                        Nombre: {item.document}
                                                    </ThemedText>
                                                    {renderFilePreview(item)}
                                                </ThemedView>
                                            ) : (
                                                <ThemedText style={styles.emptyText}>No hay archivo adjunto</ThemedText>
                                            )}

                                            {(!item.document || String(item.document).startsWith('pending_')) && (
                                                <ThemedView style={styles.fileButtonsContainer}>
                                                    {(() => {
                                                        const isUploadingThis = !!uploadingFile && localFiles.some((f) => f.accion_id === item.id && f.id === uploadingFile);
                                                        return (
                                                            <>
                                                                <TouchableOpacity
                                                                    style={[styles.addFileButton, isUploadingThis && styles.uploadButtonDisabled]}
                                                                    onPress={() => handleAddFile(item.id, 'document')}
                                                                    disabled={isUploadingThis}
                                                                >
                                                                    <Ionicons name="document-attach-outline" size={18} color="#007AFF" />
                                                                    <ThemedText style={styles.addFileButtonText}>Añadir archivo</ThemedText>
                                                                </TouchableOpacity>
                                                                {isUploadingThis && (
                                                                    <ThemedView style={styles.uploadingIndicator}>
                                                                        <ActivityIndicator size="small" color="#007AFF" />
                                                                        <ThemedText style={styles.uploadingText}>Subiendo...</ThemedText>
                                                                    </ThemedView>
                                                                )}
                                                            </>
                                                        );
                                                    })()}
                                                </ThemedView>
                                            )}
                                        </ThemedView>
                                    )}
                                </ThemedView>
                            );
                        })}
                    </ThemedView>
                </ThemedView>
            </ScrollView>
        );
    };

    const renderPendingFileModal = () => {
        if (!pendingFile) return null;

        const { file } = pendingFile;
        const mime = guessMimeType(file);
        const dataUri = `data:${mime};base64,${file.base64}`;
        const isImage = file.type === 'image';
        const isAudio = file.type === 'audio';
        const isVideo = file.type === 'video';

        return (
            <Modal
                visible={!!pendingFile}
                transparent={true}
                animationType="slide"
                onRequestClose={cancelUpload}
            >
                <ThemedView style={styles.modalOverlay}>
                    <ThemedView style={styles.modalContent}>
                        <ThemedText style={styles.modalTitle}>Vista previa del archivo</ThemedText>
                        <ThemedText style={styles.modalFileName}>Nombre: {file.name}</ThemedText>

                        {isImage && (
                            <Image
                                source={{ uri: dataUri }}
                                style={styles.modalPreviewImage}
                                resizeMode="contain"
                            />
                        )}

                        {isAudio && (
                            <ThemedView style={styles.modalMediaBlock}>
                                <ThemedText style={styles.modalMediaLabel}>Audio: {file.name}</ThemedText>
                                <AudioPlayer sourceUrl={dataUri} />
                            </ThemedView>
                        )}

                        {isVideo && (
                            <ThemedView style={styles.modalMediaBlock}>
                                <ThemedText style={styles.modalMediaLabel}>Video: {file.name}</ThemedText>
                                <VideoPlayer sourceUrl={dataUri} />
                            </ThemedView>
                        )}

                        {file.type === 'document' && (
                            <ThemedView style={styles.modalFileRow}>
                                <Ionicons name="document-text-outline" size={48} color="#007AFF" />
                                <ThemedText style={styles.modalDocumentName}>{file.name}</ThemedText>
                            </ThemedView>
                        )}

                        <ThemedView style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.modalButtonCancel]}
                                onPress={cancelUpload}
                            >
                                <ThemedText style={styles.modalButtonCancelText}>Cancelar</ThemedText>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.modalButtonConfirm]}
                                onPress={confirmUpload}
                            >
                                <ThemedText style={styles.modalButtonConfirmText}>Confirmar y subir</ThemedText>
                            </TouchableOpacity>
                        </ThemedView>
                    </ThemedView>
                </ThemedView>
            </Modal>
        );
    };

    return (
        <ThemedView style={styles.container}>
            <AppHeader title="Archivos de acciones" onMenuPress={() => setIsMenuVisible(true)} />
            <SlideMenu isVisible={isMenuVisible} onClose={() => setIsMenuVisible(false)} onHomePress={() => navigation.navigate('Home')} currentRoute="TrasladoPlazas" />
            {renderList()}
            {renderPendingFileModal()}
            <AppFooter />
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
        color: '#666',
    },
    errorText: {
        marginTop: 10,
        fontSize: 16,
        color: '#FF3B30',
        textAlign: 'center',
    },
    retryButton: {
        marginTop: 20,
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: '#007AFF',
        borderRadius: 8,
    },
    retryButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    emptyText: {
        marginTop: 10,
        fontSize: 16,
        color: '#999',
        textAlign: 'center',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        alignItems: 'center',
        padding: 20,
    },
    contentContainer: {
        width: '100%',
        maxWidth: 600,
    },
    titleContainer: {
        alignItems: 'center',
        marginBottom: 24,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
        width: '100%',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 6,
    },
    subtitle: {
        fontSize: 14,
        opacity: 0.7,
        textAlign: 'center',
    },
    listContainer: {
        width: '100%',
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 12,
        color: '#000',
    },
    cardLine: {
        marginBottom: 8,
        fontSize: 14,
    },
    cardLabel: {
        fontWeight: '600',
        color: '#666',
    },
    cardValue: {
        color: '#000',
    },
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
    collapseButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#007AFF',
    },
    collapsableContent: {
        marginTop: 8,
        padding: 10,
        borderRadius: 8,
        backgroundColor: '#F8F9FA',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 12,
        color: '#000',
    },
    fileContainer: {
        marginBottom: 16,
    },
    filePreviewImage: {
        width: '100%',
        height: 200,
        borderRadius: 8,
        marginBottom: 8,
    },
    fileRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#F8F9FA',
        borderRadius: 8,
        marginBottom: 8,
    },
    fileName: {
        flex: 1,
        marginLeft: 12,
        fontSize: 14,
        color: '#000',
    },
    mediaBlock: {
        padding: 12,
        backgroundColor: '#F8F9FA',
        borderRadius: 8,
        marginBottom: 8,
    },
    mediaLabel: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
        color: '#000',
    },
    audioPlayer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
    },
    playButton: {
        padding: 8,
        marginRight: 12,
    },
    audioStatus: {
        fontSize: 12,
        color: '#666',
    },
    videoContainer: {
        width: '100%',
        height: 200,
        borderRadius: 8,
        overflow: 'hidden',
        marginTop: 8,
    },
    videoPlayer: {
        width: '100%',
        height: '100%',
    },
    fileButtonsContainer: {
        marginTop: 12,
        gap: 8,
    },
    addFileButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        backgroundColor: '#F8F9FA',
    },
    addFileButtonText: {
        fontSize: 14,
        color: '#007AFF',
        fontWeight: '500',
    },
    uploadButtonDisabled: {
        opacity: 0.6,
    },
    uploadingIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 8,
        marginTop: 4,
    },
    uploadingText: {
        fontSize: 14,
        color: '#007AFF',
        fontWeight: '500',
    },
    fileNameLabel: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
        color: '#000',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 20,
        width: '100%',
        maxHeight: '80%',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 12,
        color: '#000',
    },
    modalFileName: {
        fontSize: 14,
        marginBottom: 16,
        color: '#666',
    },
    modalPreviewImage: {
        width: '100%',
        height: 300,
        borderRadius: 8,
        marginBottom: 16,
    },
    modalMediaBlock: {
        marginBottom: 16,
    },
    modalMediaLabel: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
        color: '#000',
    },
    modalFileRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        backgroundColor: '#F8F9FA',
        borderRadius: 8,
        marginBottom: 16,
    },
    modalDocumentName: {
        marginLeft: 12,
        fontSize: 14,
        color: '#000',
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 16,
    },
    modalButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalButtonCancel: {
        backgroundColor: '#E5E5E5',
    },
    modalButtonCancelText: {
        color: '#000',
        fontSize: 16,
        fontWeight: '600',
    },
    modalButtonConfirm: {
        backgroundColor: '#007AFF',
    },
    modalButtonConfirmText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
});

