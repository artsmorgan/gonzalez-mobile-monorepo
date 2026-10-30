import React from 'react';
import { StyleProp, StyleSheet, TextStyle, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { useAudioRecording } from '@/hooks/useAudioRecording';

function formatElapsed(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

type Props = {
    /** Se llama con el `uri` local del audio grabado al detener la grabación. */
    onRecorded: (uri: string) => void | Promise<void>;
    /** `text`: botón con ícono + etiqueta (igual a los botones "Agregar audio" existentes). `icon`: solo ícono (para filas de íconos). */
    variant?: 'text' | 'icon';
    label?: string;
    disabled?: boolean;
    buttonStyle?: StyleProp<ViewStyle>;
    textStyle?: StyleProp<TextStyle>;
    iconColor?: string;
    iconSize?: number;
};

/**
 * Botón compartido para grabar audio desde la app (misma mecánica que `VoiceNotesScreen.tsx`).
 * Al pulsar inicia la grabación; mientras graba muestra el tiempo transcurrido y, al volver a
 * pulsar, detiene la grabación e invoca `onRecorded` con el `uri` local resultante — el llamador
 * lo pasa a su función existente de "adjuntar audio" (misma ruta que un archivo elegido desde la
 * librería, vía `saveFile`).
 */
export default function RecordAudioButton({
    onRecorded,
    variant = 'text',
    label = 'Grabar audio',
    disabled = false,
    buttonStyle,
    textStyle,
    iconColor = '#007AFF',
    iconSize = variant === 'icon' ? 20 : 18,
}: Props) {
    const { isRecording, durationMillis, startRecording, stopRecording } = useAudioRecording();

    const handlePress = async () => {
        if (disabled) return;
        if (isRecording) {
            const uri = await stopRecording();
            if (uri) {
                await onRecorded(uri);
            }
        } else {
            await startRecording();
        }
    };

    const activeColor = '#FF3B30';
    const color = isRecording ? activeColor : iconColor;

    if (variant === 'icon') {
        return (
            <TouchableOpacity
                style={[styles.iconButton, buttonStyle]}
                onPress={handlePress}
                disabled={disabled}
            >
                <Ionicons name={isRecording ? 'stop-circle' : 'mic-circle-outline'} size={iconSize} color={color} />
                {isRecording && (
                    <ThemedText style={[styles.iconElapsed, { color: activeColor }]}>
                        {formatElapsed(durationMillis)}
                    </ThemedText>
                )}
            </TouchableOpacity>
        );
    }

    return (
        <TouchableOpacity
            style={[styles.textButton, buttonStyle]}
            onPress={handlePress}
            disabled={disabled}
        >
            <Ionicons name={isRecording ? 'stop-circle' : 'mic-circle-outline'} size={iconSize} color={color} />
            <ThemedText style={[styles.textButtonText, { color }, textStyle]}>
                {isRecording ? `Grabando... ${formatElapsed(durationMillis)}` : label}
            </ThemedText>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    textButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    textButtonText: {
        fontSize: 14,
        fontWeight: '500',
    },
    iconButton: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconElapsed: {
        fontSize: 10,
        marginTop: 2,
    },
});
