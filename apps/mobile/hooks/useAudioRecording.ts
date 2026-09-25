import { useCallback, useRef } from 'react';
import { Alert, Linking } from 'react-native';
import {
    useAudioRecorder,
    useAudioRecorderState,
    RecordingPresets,
    requestRecordingPermissionsAsync,
} from 'expo-audio';

/**
 * Grabación de audio compartida (mismo mecanismo que `VoiceNotesScreen.tsx`, sin modificar ese
 * archivo): pide permiso, graba con `RecordingPresets.HIGH_QUALITY` y al detener devuelve el `uri`
 * local del archivo grabado, listo para pasar a `saveFile(...)` igual que un archivo elegido desde
 * la librería.
 */
export function useAudioRecording() {
    const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
    const recorderState = useAudioRecorderState(audioRecorder, 250);
    const startingRef = useRef(false);

    const startRecording = useCallback(async (): Promise<boolean> => {
        if (startingRef.current || recorderState.isRecording) return false;
        startingRef.current = true;
        try {
            const { granted, canAskAgain } = await requestRecordingPermissionsAsync();
            if (!granted) {
                if (canAskAgain) {
                    Alert.alert('Permiso requerido', 'Se necesita acceso al micrófono para grabar audio.');
                } else {
                    Alert.alert(
                        'Permiso requerido',
                        'El acceso al micrófono está bloqueado. Actívalo desde los ajustes del dispositivo.',
                        [
                            { text: 'Cancelar', style: 'cancel' },
                            { text: 'Abrir ajustes', onPress: () => { void Linking.openSettings(); } },
                        ]
                    );
                }
                return false;
            }

            await audioRecorder.prepareToRecordAsync();
            audioRecorder.record();
            return true;
        } catch (error) {
            console.error('Error starting audio recording:', error);
            Alert.alert('Error', 'No se pudo iniciar la grabación. Intenta nuevamente.');
            return false;
        } finally {
            startingRef.current = false;
        }
    }, [audioRecorder, recorderState.isRecording]);

    const stopRecording = useCallback(async (): Promise<string | null> => {
        try {
            if (!recorderState.isRecording) return null;
            await audioRecorder.stop();
            return audioRecorder.uri ?? null;
        } catch (error) {
            console.error('Error stopping audio recording:', error);
            Alert.alert('Error', 'No se pudo finalizar la grabación.');
            return null;
        }
    }, [audioRecorder, recorderState.isRecording]);

    const cancelRecording = useCallback(async (): Promise<void> => {
        try {
            if (recorderState.isRecording) {
                await audioRecorder.stop();
            }
        } catch {
            /* idempotente */
        }
    }, [audioRecorder, recorderState.isRecording]);

    return {
        isRecording: recorderState.isRecording,
        durationMillis: recorderState.durationMillis || 0,
        startRecording,
        stopRecording,
        cancelRecording,
    };
}
