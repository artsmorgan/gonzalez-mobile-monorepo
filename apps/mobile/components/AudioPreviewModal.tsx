import React, { useEffect } from 'react';
import { Modal, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

function formatTime(seconds: number): string {
    if (!isFinite(seconds) || seconds < 0) seconds = 0;
    const total = Math.floor(seconds);
    const minutes = Math.floor(total / 60);
    const secs = total % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

type Props = {
    visible: boolean;
    onClose: () => void;
    /** `uri` local (`file://...`) o remota (http/https) del audio a reproducir. */
    sourceUri: string | null | undefined;
    label?: string;
};

/**
 * Ventana flotante compartida para previsualizar un audio (grabado o adjuntado desde la librería,
 * pendiente de guardar o ya subido): muestra duración total, tiempo de reproducción actual y
 * botones para pausar, reanudar y reiniciar.
 */
export default function AudioPreviewModal({ visible, onClose, sourceUri, label }: Props) {
    const player = useAudioPlayer(visible && sourceUri ? sourceUri : undefined);
    const status = useAudioPlayerStatus(player);

    useEffect(() => {
        if (visible && sourceUri) {
            player.seekTo(0);
            player.play();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible, sourceUri]);

    const handleClose = () => {
        try {
            player.pause();
        } catch {
            /* noop */
        }
        onClose();
    };

    const handlePause = () => {
        player.pause();
    };

    const handleResume = () => {
        player.play();
    };

    const handleRestart = () => {
        player.seekTo(0);
        player.play();
    };

    const duration = status.duration || 0;
    const position = status.currentTime || 0;
    const isPlaying = status.playing;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
            <ThemedView style={styles.overlay}>
                <ThemedView style={styles.card}>
                    <ThemedView style={styles.headerRow}>
                        <ThemedText style={styles.title} numberOfLines={1}>
                            {label || 'Vista previa de audio'}
                        </ThemedText>
                        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                            <Ionicons name="close" size={22} color="#666" />
                        </TouchableOpacity>
                    </ThemedView>

                    <ThemedText style={styles.timeText}>
                        {formatTime(position)} / {formatTime(duration)}
                    </ThemedText>

                    <ThemedView style={styles.controlsRow}>
                        <TouchableOpacity
                            style={[styles.controlButton, !isPlaying && styles.controlButtonDisabled]}
                            onPress={handlePause}
                            disabled={!isPlaying}
                        >
                            <Ionicons name="pause" size={22} color={isPlaying ? '#007AFF' : '#B0B0B0'} />
                            <ThemedText style={[styles.controlLabel, !isPlaying && styles.controlLabelDisabled]}>Pausar</ThemedText>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.controlButton, isPlaying && styles.controlButtonDisabled]}
                            onPress={handleResume}
                            disabled={isPlaying}
                        >
                            <Ionicons name="play" size={22} color={!isPlaying ? '#007AFF' : '#B0B0B0'} />
                            <ThemedText style={[styles.controlLabel, isPlaying && styles.controlLabelDisabled]}>Reanudar</ThemedText>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.controlButton} onPress={handleRestart}>
                            <Ionicons name="refresh" size={22} color="#007AFF" />
                            <ThemedText style={styles.controlLabel}>Reiniciar</ThemedText>
                        </TouchableOpacity>
                    </ThemedView>
                </ThemedView>
            </ThemedView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    card: {
        width: '100%',
        maxWidth: 360,
        borderRadius: 14,
        padding: 20,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
        flex: 1,
        marginRight: 8,
    },
    closeButton: {
        padding: 4,
    },
    timeText: {
        textAlign: 'center',
        fontSize: 15,
        marginBottom: 16,
        opacity: 0.8,
    },
    controlsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    controlButton: {
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 6,
    },
    controlButtonDisabled: {
        opacity: 0.5,
    },
    controlLabel: {
        fontSize: 12,
        color: '#007AFF',
    },
    controlLabelDisabled: {
        color: '#B0B0B0',
    },
});
