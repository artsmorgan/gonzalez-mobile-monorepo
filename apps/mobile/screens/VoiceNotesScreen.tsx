import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Alert, 
  ActivityIndicator,
  TextInput,
  View,
  Platform,
} from 'react-native';
import DateTimePicker from "@react-native-community/datetimepicker";
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
import * as Location from 'expo-location';
import { jwtDecode } from 'jwt-decode';
import { useQRScanner } from '@/hooks/useQRScanner';
import { useAudioRecorder, useAudioRecorderState, useAudioPlayer, useAudioPlayerStatus, RecordingPresets, requestRecordingPermissionsAsync } from 'expo-audio';
import getHoraAccion from '@/hooks/getHoraAccion';
import * as Network from 'expo-network';
import { createVoiceNote as createVoiceNoteAPI, deleteVoiceNote as deleteVoiceNoteAPI } from '@/hooks/voiceNotesFunctions';
import { eventBus } from '@/hooks/eventBus';

type VoiceNotesScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'VoiceNotes'>;

interface Empresa {
  id: number;
  nombre: string;
}

interface Cliente {
  id: number;
  nombre: string;
}

interface Corpo {
  id: number;
  nombre: string;
}

interface Puesto {
  id: number;
  nombre: string;
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
  };
}

interface VoiceNote {
  id: number;
  empresa: Empresa;
  cliente: Cliente;
  corpo: Corpo;
  puesto: Puesto | null;
  titulo: string;
  descripcion: string;
  transcripcion: string | null;
  firma_responsable: string;
  nombre_creator: string;
  id_local: string;
  file_base64: string;
  created_at: string;
  created_by: number;
  nombre_firma: string;
}

// Componente para reproducir audio de notas de voz con cleanup
function VoiceNoteAudioPlayer({ audioUri, isPlaying, onStatusUpdate }: { audioUri: string; isPlaying: boolean; onStatusUpdate?: (duration: number, position: number, playing: boolean) => void }) {
  const audioPlayer = useAudioPlayer(audioUri);
  const playerStatus = useAudioPlayerStatus(audioPlayer);

  // Controlar play/pause basado en isPlaying
  useEffect(() => {
    if (!audioPlayer) return;
    
    try {
      if (isPlaying && !playerStatus.playing) {
        audioPlayer.play();
      } else if (!isPlaying && playerStatus.playing) {
        audioPlayer.pause();
      }
    } catch (error) {
      const errorMsg = String(error);
      if (!errorMsg.includes('already released') && !errorMsg.includes('has been rejected')) {
        console.error('Error controlling audio playback:', error);
      }
    }
  }, [isPlaying, audioPlayer, playerStatus.playing]);

  // Cleanup al desmontar el componente
  useEffect(() => {
    return () => {
      try {
        if (audioPlayer && playerStatus.playing) {
          try {
            audioPlayer.pause();
          } catch (pauseError) {
            console.log('Audio player already released, skipping pause');
          }
        }
        if (audioPlayer && typeof audioPlayer.remove === 'function') {
          try {
            audioPlayer.remove();
          } catch (removeError) {
            console.log('Audio player already removed');
          }
        }
      } catch (error) {
        // Ignorar errores de objetos ya liberados
        console.log('Error during audio cleanup:', error);
      }
    };
  }, [audioPlayer, playerStatus.playing]);

  // Notificar cambios de estado
  useEffect(() => {
    if (onStatusUpdate && playerStatus.duration !== undefined && playerStatus.currentTime !== undefined) {
      onStatusUpdate(
        playerStatus.duration / 1000,
        playerStatus.currentTime / 1000,
        playerStatus.playing || false
      );
    }
  }, [playerStatus.duration, playerStatus.currentTime, playerStatus.playing, onStatusUpdate]);

  return null; // Este componente no renderiza nada, solo maneja el audio
}

export default function VoiceNotesScreen() {
  const { employee, refreshAccessToken, logout } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<VoiceNotesScreenNavigationProp>();
  
  // Data states
  const [voiceNotes, setVoiceNotes] = useState<VoiceNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMarca, setHasMarca] = useState<boolean>(false);
  const [marcaId, setMarcaId] = useState<number | null>(null);
  const [corpoId, setCorpoId] = useState<number | null>(null);
  
  // Form states
  const [isCreating, setIsCreating] = useState(false);
  const [setPuesto, setSetPuesto] = useState<boolean>(false);
  const [puestoActualNombre, setPuestoActualNombre] = useState<string>('');
  const [firmaResponsable, setFirmaResponsable] = useState<FirmaData | null>(null);
  const [isGeneratingFirma, setIsGeneratingFirma] = useState(false);
  
  // Form refs
  const tituloRef = useRef('');
  const descripcionRef = useRef('');
  const [formKey, setFormKey] = useState(0); // Key para forzar re-render de inputs
  
  // Audio recording states
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder, 1000); // Actualizar cada segundo
  const [recordedAudioUri, setRecordedAudioUri] = useState<string | null>(null);
  const recordedAudioPlayer = useAudioPlayer(recordedAudioUri || undefined);
  const recordedPlayerStatus = useAudioPlayerStatus(recordedAudioPlayer);
  const [recordedAudioBase64, setRecordedAudioBase64] = useState<string | null>(null);
  
  // Location state
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  
  // QR Scanner
  const { scanQR, QRScannerComponent } = useQRScanner();
  
  // Helper function to get unique identifier for voice notes
  // Use id_local for offline notes (id: 0), otherwise use id
  const getUniqueKey = (voiceNote: VoiceNote): string => {
    return voiceNote.id_local && voiceNote.id_local !== '' 
      ? `local-${voiceNote.id_local}` 
      : `server-${voiceNote.id}`;
  };
  
  // Expanded voice notes state
  const [expandedVoiceNotes, setExpandedVoiceNotes] = useState<Set<string>>(new Set());
  
  // Audio players for list items - using Maps to store audio URIs
  const [audioUris, setAudioUris] = useState<Map<string, string>>(new Map());
  const [audioDurations, setAudioDurations] = useState<Map<string, number>>(new Map());

  // Filter states
  const [filterEmpresa, setFilterEmpresa] = useState('');
  const [filterCliente, setFilterCliente] = useState('');
  const [filterSucursal, setFilterSucursal] = useState('');
  const [filterPuesto, setFilterPuesto] = useState('');
  const [filterTitulo, setFilterTitulo] = useState('');
  const [filterDescripcion, setFilterDescripcion] = useState('');
  const [filterTranscripcion, setFilterTranscripcion] = useState('');
  const [filterCreatedAt, setFilterCreatedAt] = useState('');
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  const [showFilterCreatedAtPicker, setShowFilterCreatedAtPicker] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  useEffect(() => {
    const handler = () => {
      fetchData();
    };
    eventBus.on('connectionRestored', handler);
    return () => {
      eventBus.off('connectionRestored', handler);
    };
  }, []);

  // El estado de grabación ahora se obtiene de recorderState
  // No necesitamos el useEffect porque useAudioRecorderState ya actualiza automáticamente

  const checkConnection = async () => {
    const networkState = await Network.getNetworkStateAsync();
    return networkState.isConnected && networkState.isInternetReachable ? true : false;
  };

  const fetchData = async () => {
    try {
      setIsLoading(true);
      
      const marcaStr = await AsyncStorage.getItem('current_marca');
      if (!marcaStr) {
        setHasMarca(false);
        setIsLoading(false);
        return;
      }

      const marca = JSON.parse(marcaStr);
      setHasMarca(true);
      setMarcaId(marca.id);
      setCorpoId(marca.corpo?.id || null);
      setPuestoActualNombre(marca.puesto?.nombre || '');

      // Check connection
      const hasConnection = await checkConnection();

      if (hasConnection) {
        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) {
          throw new Error('Server URL not configured');
        }

        let token = await AsyncStorage.getItem('access_token');
        if (!token) {
          const refreshed = await refreshAccessToken();
          if (!refreshed) {
            throw new Error('No authentication token found');
          }
          token = await AsyncStorage.getItem('access_token');
        }

        // Fetch voice notes
        const response = await fetch(`${apiUrl}/api/voice-notes?m=${marca.id}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': '69420',
          },
        });

        if (response.status === 401 || response.status === 403) {
          const refreshed = await refreshAccessToken();
          if (refreshed) {
            return fetchData();
          } else {
            await logout();
            return;
          }
        }

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.status && data.voiceNotes) {
          setVoiceNotes(data.voiceNotes);
          // Actualizar voice_notes_cache
          await AsyncStorage.setItem('voice_notes_cache', JSON.stringify(data.voiceNotes));
        } else {
          setVoiceNotes([]);
          if (data.message) {
            Alert.alert('Info', data.message);
          }
        }
      } else {
        // Sin internet: cargar desde cache
        const voiceNotesCache = await AsyncStorage.getItem('voice_notes_cache');
        if (voiceNotesCache) {
          const cachedVoiceNotes = JSON.parse(voiceNotesCache);
          setVoiceNotes(cachedVoiceNotes);
          Alert.alert('Modo Offline', 'No hay conexión a internet. Mostrando datos guardados.');
        } else {
          setVoiceNotes([]);
          Alert.alert('Modo Offline', 'No hay conexión a internet y no hay datos guardados.');
        }
      }

    } catch (error) {
      console.error('Error fetching data:', error);
      // En caso de error, intentar cargar desde cache
      try {
        const voiceNotesCache = await AsyncStorage.getItem('voice_notes_cache');
        if (voiceNotesCache) {
          const cachedVoiceNotes = JSON.parse(voiceNotesCache);
          setVoiceNotes(cachedVoiceNotes);
          Alert.alert('Modo Offline', 'Error de conexión. Mostrando datos guardados.');
        } else {
          setVoiceNotes([]);
          Alert.alert('Error', 'No se pudieron cargar las notas de voz');
        }
      } catch (cacheError) {
        console.error('Error loading cache:', cacheError);
        setVoiceNotes([]);
        Alert.alert('Error', 'No se pudieron cargar las notas de voz');
      }
    } finally {
      setIsLoading(false);
    }
  };


  const generateDateTime = (time: string) => {
    let fechaSplit = time.split('T');
    fechaSplit[1] = fechaSplit[1].split('.')[0];
    return fechaSplit[0] + ' ' + fechaSplit[1];
  };

  const startCreating = async () => {
    try {
      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Error', 'Se necesitan permisos de ubicación');
        return;
      }

      // Request audio permissions
      const { granted, canAskAgain } = await requestRecordingPermissionsAsync();
      if (!granted) {
        if (canAskAgain) {
          Alert.alert('Permisos requeridos', 'Se necesitan permisos de audio para grabar');
        } else {
          Alert.alert('Permisos denegados', 'Por favor habilita los permisos de audio en la configuración de tu dispositivo');
        }
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      setLocation(loc);

      setIsCreating(true);
      setFormKey(prev => prev + 1); // Incrementar key para forzar re-render
      resetForm();
    } catch (error) {
      console.error('Error starting creation:', error);
      Alert.alert('Error', 'No se pudo iniciar la creación');
    }
  };

  const cancelCreating = () => {
    setIsCreating(false);
    resetForm();
    stopRecordedAudioPlayback();
    if (recorderState.isRecording) {
      stopRecording();
    }
  };

  const resetForm = () => {
    tituloRef.current = '';
    descripcionRef.current = '';
    setSetPuesto(false);
    setFirmaResponsable(null);
    setRecordedAudioUri(null);
    setRecordedAudioBase64(null);
    stopRecordedAudioPlayback();
    // Stop recording if active
    if (recorderState.isRecording) {
      audioRecorder.stop();
    }
  };

  const generateSignature = async () => {
    try {
      setIsGeneratingFirma(true);

      if (!employee?.id) {
        Alert.alert('Error', 'No se pudo obtener el ID del empleado');
        return;
      }

      if (!location) {
        Alert.alert('Error', 'No se pudo obtener la ubicación');
        return;
      }

      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        Alert.alert('Error', 'No se pudo obtener el token de sesión');
        return;
      }

      const decoded: any = jwtDecode(token);
      const sessionId = decoded.sessionId || 'unknown';

      const timestamp = await getHoraAccion();
      if (!timestamp) {
        Alert.alert('Error', 'No se pudo obtener la hora');
        return;
      }
      const { latitude, longitude } = location.coords;
      const decodedEmpleadoId = employee.id.toString();
      const decodedLatitud = latitude.toString();
      const decodedLongitud = longitude.toString();
      const decodedTimestamp = timestamp.toString();

      const signatureString = `${sessionId}:${decodedEmpleadoId}:${decodedLatitud}:${decodedLongitud}:${decodedTimestamp}`;
      const signatureHash = btoa(signatureString);

      // Fetch employee details
      let empleadoDetalle = undefined;
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (apiUrl) {
        try {
          const empleadoResponse = await fetch(`${apiUrl}/api/empleados/${decodedEmpleadoId}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'ngrok-skip-browser-warning': '69420',
            },
          });

          if (empleadoResponse.ok) {
            const empleadoData = await empleadoResponse.json();
            empleadoDetalle = {
              nombre: empleadoData.nombre,
              primer_apellido: empleadoData.primer_apellido,
              segundo_apellido: empleadoData.segundo_apellido,
            };
          }
        } catch (err) {
          console.error('Error fetching empleado details:', err);
        }
      }

      setFirmaResponsable({
        sessionId,
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

      // Validate QR structure
      const decodedData = atob(qrData);
      const parts = decodedData.split(':');
      
      if (parts.length !== 5) {
        Alert.alert('Error', 'El QR escaneado no tiene el formato correcto');
        return;
      }

      const [sessionId, empleadoId, latitud, longitud, timestamp] = parts;

      // Fetch employee details
      let empleadoDetalle = undefined;
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      const token = await AsyncStorage.getItem('access_token');
      
      if (apiUrl && token) {
        try {
          const empleadoResponse = await fetch(`${apiUrl}/api/empleados/${empleadoId}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'ngrok-skip-browser-warning': '69420',
            },
          });

          if (empleadoResponse.ok) {
            const empleadoData = await empleadoResponse.json();
            empleadoDetalle = {
              nombre: empleadoData.nombre,
              primer_apellido: empleadoData.primer_apellido,
              segundo_apellido: empleadoData.segundo_apellido,
            };
          }
        } catch (err) {
          console.error('Error fetching empleado details:', err);
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
      console.error('Error scanning QR:', error);
      Alert.alert('Error', 'No se pudo escanear el código QR');
    }
  };

  const startRecording = async () => {
    try {
      // Solicitar permisos de grabación
      const { granted, canAskAgain } = await requestRecordingPermissionsAsync();
      
      if (!granted) {
        if (canAskAgain) {
          Alert.alert('Permisos requeridos', 'Se necesitan permisos de audio para grabar');
        } else {
          Alert.alert('Permisos denegados', 'Por favor habilita los permisos de audio en la configuración de tu dispositivo');
        }
        return;
      }
      
      // Preparar el grabador
      await audioRecorder.prepareToRecordAsync();
      
      // Iniciar grabación (no es async)
      audioRecorder.record();
    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert('Error', 'No se pudo iniciar la grabación: ' + (error as Error).message);
    }
  };

  const stopRecording = async () => {
    try {
      if (!recorderState.isRecording) return;

      await audioRecorder.stop();
      
      const uri = audioRecorder.uri;
      if (!uri) {
        Alert.alert('Error', 'No se pudo obtener el URI del audio');
        return;
      }
      
      setRecordedAudioUri(uri);

      // Convert to base64
      const base64 = await fetch(uri)
        .then(res => res.blob())
        .then(blob => {
          return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64data = reader.result as string;
              resolve(base64data.split(',')[1]);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        });

      setRecordedAudioBase64(base64);
    } catch (error) {
      console.error('Error stopping recording:', error);
      Alert.alert('Error', 'No se pudo detener la grabación');
    }
  };

  const restartRecording = () => {
    try {
      if (recordedAudioPlayer && recordedPlayerStatus.playing) {
        recordedAudioPlayer.pause();
      }
    } catch (error) {
      // Ignorar errores de objetos ya liberados
    }
    setRecordedAudioUri(null);
    setRecordedAudioBase64(null);
  };

  const resetRecordedAudio = async () => {
    try {
      if (!recordedAudioPlayer) return;
      
      recordedAudioPlayer.seekTo(0);
      recordedAudioPlayer.pause();
    } catch (error) {
      const errorMsg = String(error);
      if (!errorMsg.includes('already released') && !errorMsg.includes('has been rejected')) {
        console.error('Error resetting recorded audio:', error);
      }
    }
  };

  const playRecordedAudio = async () => {
    try {
      if (!recordedAudioUri || !recordedAudioPlayer) return;

      if (recordedPlayerStatus.playing) {
        recordedAudioPlayer.pause();
      } else {
        recordedAudioPlayer.play();
      }
    } catch (error) {
      const errorMsg = String(error);
      if (errorMsg.includes('already released') || errorMsg.includes('has been rejected')) {
        console.log('Audio player was released');
      } else {
        console.error('Error playing audio:', error);
        Alert.alert('Error', 'No se pudo reproducir el audio');
      }
    }
  };

  const stopRecordedAudioPlayback = async () => {
    try {
      if (recordedAudioPlayer && recordedPlayerStatus.playing) {
        recordedAudioPlayer.pause();
      }
    } catch (error) {
      // Ignorar errores de objetos ya liberados
      const errorMsg = String(error);
      if (!errorMsg.includes('already released') && !errorMsg.includes('has been rejected')) {
        console.error('Error stopping audio playback:', error);
      }
    }
  };

  const validateForm = (): boolean => {
    if (!tituloRef.current.trim()) {
      Alert.alert('Error', 'El título es requerido');
      return false;
    }

    if (!descripcionRef.current.trim()) {
      Alert.alert('Error', 'La descripción es requerida');
      return false;
    }

    if (!recordedAudioBase64) {
      Alert.alert('Error', 'Debe grabar un audio');
      return false;
    }

    if (!firmaResponsable) {
      Alert.alert('Error', 'La firma del responsable es requerida');
      return false;
    }

    return true;
  };

  const createVoiceNote = async () => {
    try {
      if (!validateForm()) return;

      Alert.alert(
        'Confirmar',
        '¿Está seguro de que desea crear esta nota de voz?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Aceptar',
            onPress: async () => {
              try {
                // Re-encode signature
                const signatureString = `${firmaResponsable!.sessionId}:${firmaResponsable!.empleadoId}:${firmaResponsable!.latitud}:${firmaResponsable!.longitud}:${firmaResponsable!.timestamp}`;
                const signatureHash = btoa(signatureString);

                const horaAccion = await getHoraAccion();

                const requestData = {
                  marca_id: marcaId,
                  titulo: tituloRef.current,
                  descripcion: descripcionRef.current,
                  setPuesto: setPuesto,
                  firma_responsable: signatureHash,
                  file_base64: recordedAudioBase64,
                  created_at: horaAccion,
                };

                // Check internet connection
                const hasConnection = await checkConnection();

                if (hasConnection) {
                  // Con internet: llamar API
                  const result = await createVoiceNoteAPI({
                    requestData,
                    marcaId: marcaId!,
                    refreshAccessToken,
                    logout,
                  });

                  if (result.status) {
                    Alert.alert('Éxito', 'Nota de voz creada correctamente');
                    setIsCreating(false);
                    resetForm();
                    fetchData();
                  } else {
                    Alert.alert('Error', result.message || 'No se pudo crear la nota de voz');
                  }
                } else {
                  // Sin internet: modo offline
                  const localId = `local_${Date.now()}_${Math.random().toString(36).substring(7)}`;

                  // Crear entrada en voice_notes_actions
                  const actionsStr = await AsyncStorage.getItem('voice_notes_actions');
                  const actions = actionsStr ? JSON.parse(actionsStr) : [];
                  actions.push({
                    requestData,
                    marcaId,
                    id: localId,
                    type: 'create',
                  });
                  await AsyncStorage.setItem('voice_notes_actions', JSON.stringify(actions));

                  // Crear nota de voz en cache
                  const cacheStr = await AsyncStorage.getItem('voice_notes_cache');
                  const cache = cacheStr ? JSON.parse(cacheStr) : [];

                  const currentMarcaStr = await AsyncStorage.getItem('current_marca');
                  if (!currentMarcaStr) throw new Error('No current_marca');

                  const currentMarca = JSON.parse(currentMarcaStr);

                  const newVoiceNoteCache: VoiceNote = {
                    id: 0,
                    empresa: currentMarca.empresa,
                    cliente: currentMarca.cliente,
                    corpo: currentMarca.corpo,
                    puesto: setPuesto ? currentMarca.puesto : null,
                    titulo: tituloRef.current,
                    descripcion: descripcionRef.current,
                    transcripcion: null,
                    firma_responsable: signatureHash,
                    nombre_creator: employee?.name || '-',
                    id_local: localId,
                    file_base64: recordedAudioBase64!,
                    created_at: new Date(horaAccion).toISOString(),
                    created_by: (employee?.id || 0) as number,
                    nombre_firma: firmaResponsable?.empleadoDetalle
                      ? `${firmaResponsable?.empleadoDetalle.nombre} ${firmaResponsable?.empleadoDetalle.primer_apellido} ${firmaResponsable?.empleadoDetalle.segundo_apellido}`
                      : '-',
                  };

                  cache.push(newVoiceNoteCache);
                  await AsyncStorage.setItem('voice_notes_cache', JSON.stringify(cache));

                  Alert.alert('Modo Offline', 'Nota de voz registrada localmente. Se sincronizará cuando haya conexión.');
                  setIsCreating(false);
                  resetForm();
                  fetchData();
                }
              } catch (error) {
                console.error('Error creating voice note:', error);
                Alert.alert('Error', 'No se pudo crear la nota de voz');
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error in createVoiceNote:', error);
      Alert.alert('Error', 'Ocurrió un error al crear la nota de voz');
    }
  };

  const deleteVoiceNote = async (voiceNote: VoiceNote) => {
    Alert.alert(
      'Confirmar',
      '¿Está seguro de que desea eliminar esta nota de voz?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const voiceNoteId = voiceNote.id;
              const id_local = voiceNote.id_local;
              const key = getUniqueKey(voiceNote);

              // Clean up audio states before deletion
              setAudioUris(prev => {
                const newMap = new Map(prev);
                newMap.delete(key);
                return newMap;
              });
              setPlayingStates(prev => {
                const newMap = new Map(prev);
                newMap.delete(key);
                return newMap;
              });
              setAudioDurations(prev => {
                const newMap = new Map(prev);
                newMap.delete(key);
                return newMap;
              });
              setAudioPositions(prev => {
                const newMap = new Map(prev);
                newMap.delete(key);
                return newMap;
              });
              setExpandedVoiceNotes(prev => {
                const newSet = new Set(prev);
                newSet.delete(key);
                return newSet;
              });

              // Check internet connection
              const hasConnection = await checkConnection();

              if (hasConnection) {
                // Con internet: llamar API
                const result = await deleteVoiceNoteAPI({
                  voiceNoteId,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Nota de voz eliminada correctamente');
                  fetchData();
                } else {
                  Alert.alert('Error', result.message || 'No se pudo eliminar la nota de voz');
                }
              } else {
                // Sin internet: modo offline
                const actionsStr = await AsyncStorage.getItem('voice_notes_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];

                if (id_local !== '') {
                  // Eliminar acciones con este id_local
                  const filteredActions = actions.filter((a: any) => a.id !== id_local);
                  await AsyncStorage.setItem('voice_notes_actions', JSON.stringify(filteredActions));
                } else {
                  // Agregar acción de delete
                  actions.push({
                    id: voiceNoteId,
                    type: 'delete',
                  });
                  await AsyncStorage.setItem('voice_notes_actions', JSON.stringify(actions));
                }

                // Eliminar de voice_notes_cache
                const cacheStr = await AsyncStorage.getItem('voice_notes_cache');
                const cache = cacheStr ? JSON.parse(cacheStr) : [];

                const filteredCache = cache.filter((v: VoiceNote) =>
                  id_local !== '' ? v.id_local !== id_local : v.id !== voiceNoteId
                );
                await AsyncStorage.setItem('voice_notes_cache', JSON.stringify(filteredCache));

                Alert.alert('Modo Offline', 'Nota de voz eliminada localmente. Se sincronizará cuando haya conexión.');
                fetchData();
              }
            } catch (error) {
              console.error('Error deleting voice note:', error);
              Alert.alert('Error', 'No se pudo eliminar la nota de voz');
            }
          },
        },
      ]
    );
  };

  const toggleVoiceNoteExpanded = (voiceNote: VoiceNote) => {
    const key = getUniqueKey(voiceNote);
    setExpandedVoiceNotes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
        // Load audio URI when expanding for the first time
        if (!audioUris.has(key)) {
          loadVoiceNoteAudio(voiceNote);
        }
      }
      return newSet;
    });
  };

  const loadVoiceNoteAudio = async (voiceNote: VoiceNote) => {
    try {
      const key = getUniqueKey(voiceNote);

      // Check if it's offline (id_local !== "")
      if (voiceNote.id_local !== '') {
        // Offline audio: use file_base64
        if (!voiceNote.file_base64) {
          Alert.alert('Error', 'No se puede reproducir el audio offline sin datos guardados.');
          return;
        }

        // Store URI for base64 audio
        const audioUri = `data:audio/m4a;base64,${voiceNote.file_base64}`;
        setAudioUris(prev => {
          const newMap = new Map(prev);
          newMap.set(key, audioUri);
          return newMap;
        });
      } else {
        // Online audio: use API URL
        const hasConnection = await checkConnection();
        if (!hasConnection) {
          Alert.alert('Error', 'No se puede reproducir el audio sin conexión a internet.');
          return;
        }

        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) {
          throw new Error('Server URL not configured');
        }

        // Use API URL directly as audio source
        const audioUri = `${apiUrl}/api/voice-notes/${voiceNote.id}/get-note`;
        setAudioUris(prev => {
          const newMap = new Map(prev);
          newMap.set(key, audioUri);
          return newMap;
        });
      }
    } catch (error) {
      console.error('Error loading voice note audio:', error);
      Alert.alert('Error', 'No se pudo cargar el audio');
    }
  };

  // Estados para controlar los reproductores de la lista
  const [playingStates, setPlayingStates] = useState<Map<string, boolean>>(new Map());
  const [audioPositions, setAudioPositions] = useState<Map<string, number>>(new Map());

  const playVoiceNoteAudio = (voiceNote: VoiceNote) => {
    const key = getUniqueKey(voiceNote);
    const audioUri = audioUris.get(key);
    
    if (!audioUri) {
      Alert.alert('Error', 'El audio no está cargado. Por favor, expanda el componente de Audio primero.');
      return;
    }

    // El control se hace a través del componente VoiceNoteAudioPlayer
    // Solo alternamos el estado de reproducción
    setPlayingStates(prev => {
      const newMap = new Map(prev);
      const isCurrentlyPlaying = newMap.get(key) || false;
      newMap.set(key, !isCurrentlyPlaying);
      return newMap;
    });
  };

  const resetVoiceNoteAudio = (voiceNote: VoiceNote) => {
    const key = getUniqueKey(voiceNote);
    setAudioPositions(prev => {
      const newMap = new Map(prev);
      newMap.set(key, 0);
      return newMap;
    });
    setPlayingStates(prev => {
      const newMap = new Map(prev);
      newMap.set(key, false);
      return newMap;
    });
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDateForDisplay = (dateString: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const resetAllFilters = () => {
    setFilterEmpresa('');
    setFilterCliente('');
    setFilterSucursal('');
    setFilterPuesto('');
    setFilterTitulo('');
    setFilterDescripcion('');
    setFilterTranscripcion('');
    setFilterCreatedAt('');
  };

  // Filtered voice notes
  const filteredVoiceNotes = voiceNotes.filter(voiceNote => {
    const matchesEmpresa = !filterEmpresa || 
      (voiceNote.empresa?.nombre && voiceNote.empresa.nombre.toLowerCase().includes(filterEmpresa.toLowerCase()));
    
    const matchesCliente = !filterCliente || 
      (voiceNote.cliente?.nombre && voiceNote.cliente.nombre.toLowerCase().includes(filterCliente.toLowerCase()));
    
    const matchesSucursal = !filterSucursal || 
      (voiceNote.corpo?.nombre && voiceNote.corpo.nombre.toLowerCase().includes(filterSucursal.toLowerCase()));
    
    const matchesPuesto = !filterPuesto || 
      (voiceNote.puesto?.nombre && voiceNote.puesto.nombre.toLowerCase().includes(filterPuesto.toLowerCase()));
    
    const matchesTitulo = !filterTitulo || 
      (voiceNote.titulo && voiceNote.titulo.toLowerCase().includes(filterTitulo.toLowerCase()));
    
    const matchesDescripcion = !filterDescripcion || 
      (voiceNote.descripcion && voiceNote.descripcion.toLowerCase().includes(filterDescripcion.toLowerCase()));
    
    const matchesTranscripcion = !filterTranscripcion || 
      (voiceNote.transcripcion && voiceNote.transcripcion.toLowerCase().includes(filterTranscripcion.toLowerCase()));
    
    const matchesCreatedAt = !filterCreatedAt || 
      (voiceNote.created_at && voiceNote.created_at.split('T')[0] === filterCreatedAt);
    
    return matchesEmpresa && matchesCliente && matchesSucursal && 
           matchesPuesto && matchesTitulo && matchesDescripcion && 
           matchesTranscripcion && matchesCreatedAt;
  });

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'add':
        return <Ionicons name="add" size={24} color="#FFF" />;
      case 'delete':
        return <Ionicons name="trash-outline" size={20} color="#FFF" />;
      case 'qr':
        return <Ionicons name="qr-code" size={20} color="#FFF" />;
      case 'clear':
        return <Ionicons name="trash" size={20} color="#fff" />;
      case 'play':
        return <Ionicons name="play" size={24} color="#007AFF" />;
      case 'pause':
        return <Ionicons name="pause" size={24} color="#007AFF" />;
      case 'microphone':
        return <Ionicons name="mic" size={24} color="#ffffff" />;
      case 'stop':
        return <Ionicons name="stop" size={24} color="#FF3B30" />;
      case 'restart':
        return <Ionicons name="refresh" size={24} color="#007AFF" />;
      case 'confirm':
        return <Ionicons name="checkmark" size={24} color="#FFF" />;
      case 'cancel':
        return <Ionicons name="close" size={24} color="#FFF" />;
      case 'signature':
        return <Ionicons name="finger-print" size={24} color="#FFF" />;
      default:
        return null;

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

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader onMenuPress={handleMenuPress} title="Notas de Voz" />
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Cargando...</ThemedText>
        </ThemedView>
        <AppFooter />
        <SlideMenu 
          isVisible={isMenuVisible} 
          onClose={handleMenuClose}
          onHomePress={handleHomePress}
          currentRoute="VoiceNotes"
        />
      </ThemedView>
    );
  }

  if (!hasMarca) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader onMenuPress={handleMenuPress} title="Notas de Voz" />
        <ThemedView style={styles.emptyContainer}>
          <ThemedText style={styles.emptyText}>No hay una marca registrada</ThemedText>
        </ThemedView>
        <AppFooter />
        <SlideMenu 
          isVisible={isMenuVisible} 
          onClose={handleMenuClose}
          onHomePress={handleHomePress}
          currentRoute="VoiceNotes"
        />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <AppHeader onMenuPress={handleMenuPress} title="Notas de Voz" />
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollViewContent}>
        {/* Title Section */}
        <ThemedView style={styles.titleContainer}>
          <ThemedText type="title" style={styles.title}>
            {getActionIcon('microphone')} Notas de Voz
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            Gestiona las notas de voz
          </ThemedText>
        </ThemedView>

        {/* Filtros */}
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
                  <TextInput
                    style={styles.filterInput}
                    value={filterEmpresa}
                    onChangeText={setFilterEmpresa}
                    placeholder="Filtrar por empresa..."
                    placeholderTextColor="#999"
                  />
                </ThemedView>

                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.filterLabel}>Cliente:</ThemedText>
                  <TextInput
                    style={styles.filterInput}
                    value={filterCliente}
                    onChangeText={setFilterCliente}
                    placeholder="Filtrar por cliente..."
                    placeholderTextColor="#999"
                  />
                </ThemedView>

                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.filterLabel}>Sucursal:</ThemedText>
                  <TextInput
                    style={styles.filterInput}
                    value={filterSucursal}
                    onChangeText={setFilterSucursal}
                    placeholder="Filtrar por sucursal..."
                    placeholderTextColor="#999"
                  />
                </ThemedView>

                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.filterLabel}>Puesto:</ThemedText>
                  <TextInput
                    style={styles.filterInput}
                    value={filterPuesto}
                    onChangeText={setFilterPuesto}
                    placeholder="Filtrar por puesto..."
                    placeholderTextColor="#999"
                  />
                </ThemedView>

                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.filterLabel}>Título:</ThemedText>
                  <TextInput
                    style={styles.filterInput}
                    value={filterTitulo}
                    onChangeText={setFilterTitulo}
                    placeholder="Filtrar por título..."
                    placeholderTextColor="#999"
                  />
                </ThemedView>

                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.filterLabel}>Descripción:</ThemedText>
                  <TextInput
                    style={styles.filterInput}
                    value={filterDescripcion}
                    onChangeText={setFilterDescripcion}
                    placeholder="Filtrar por descripción..."
                    placeholderTextColor="#999"
                  />
                </ThemedView>

                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.filterLabel}>Transcripción:</ThemedText>
                  <TextInput
                    style={styles.filterInput}
                    value={filterTranscripcion}
                    onChangeText={setFilterTranscripcion}
                    placeholder="Filtrar por transcripción..."
                    placeholderTextColor="#999"
                  />
                </ThemedView>

                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.filterLabel}>Fecha de creación:</ThemedText>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowFilterCreatedAtPicker(true)}
                  >
                    <ThemedText style={styles.dateButtonText}>
                      {filterCreatedAt ? formatDateForDisplay(filterCreatedAt) : 'Seleccionar fecha'}
                    </ThemedText>
                    <Ionicons name="calendar-outline" size={20} color="#007AFF" />
                  </TouchableOpacity>
                  {filterCreatedAt && (
                    <TouchableOpacity
                      style={styles.clearDateButton}
                      onPress={() => setFilterCreatedAt('')}
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
        {!isCreating && (
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
          <ThemedView style={styles.formContainer}>
            <ThemedText style={styles.formTitle}>Nueva Nota de Voz</ThemedText>

            {/* Título */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.label}>Título *</ThemedText>
              <TextInput
                key={`titulo-${formKey}`}
                style={styles.input}
                placeholder="Ingrese el título"
                placeholderTextColor="#999"
                defaultValue={tituloRef.current}
                onChangeText={(text) => { tituloRef.current = text; }}
              />
            </ThemedView>

            {/* Descripción */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.label}>Descripción *</ThemedText>
              <TextInput
                key={`descripcion-${formKey}`}
                style={[styles.input, styles.textArea]}
                placeholder="Ingrese la descripción"
                placeholderTextColor="#999"
                defaultValue={descripcionRef.current}
                onChangeText={(text) => { descripcionRef.current = text; }}
                multiline
                numberOfLines={4}
              />
            </ThemedView>

            {/* Asignar al puesto actual */}
            <ThemedView style={styles.formGroup}>
              <ThemedView style={styles.checkboxContainer}>
                <TouchableOpacity
                  style={[
                    styles.checkbox,
                    setPuesto ? styles.checkboxChecked : styles.checkboxUnchecked
                  ]}
                  onPress={() => setSetPuesto(!setPuesto)}
                >
                  {setPuesto && (
                    <Ionicons name="checkmark" size={16} color="#FFF" />
                  )}
                </TouchableOpacity>
                <ThemedText style={styles.checkboxLabel}>Asignar al puesto actual</ThemedText>
              </ThemedView>
              {puestoActualNombre ? (
                <ThemedView style={styles.puestoActualContainer}>
                    <ThemedText style={styles.puestoActualText}>{puestoActualNombre}</ThemedText>
                </ThemedView>
              ) : null}
            </ThemedView>

            {/* Audio Recording */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.label}>Grabación de Audio *</ThemedText>
              
              {!recordedAudioUri && (
                <ThemedView style={styles.recordingControls}>
                  {!recorderState.isRecording ? (
                    <TouchableOpacity
                      style={styles.recordButton}
                      onPress={startRecording}
                    >
                      <ThemedText style={styles.recordButtonText}>
                        {getActionIcon('microphone')} Iniciar Grabación
                      </ThemedText>
                    </TouchableOpacity>
                  ) : (
                    <ThemedView style={styles.recordingActiveContainer}>
                      <TouchableOpacity
                        style={styles.stopButton}
                        onPress={stopRecording}
                      >
                        <ThemedText style={styles.stopButtonText}>
                          {getActionIcon('stop')} Detener Grabación
                        </ThemedText>
                      </TouchableOpacity>
                      <ThemedText style={styles.recordingTime}>
                        {formatTime((recorderState.durationMillis || 0) / 1000)}
                      </ThemedText>
                    </ThemedView>
                  )}
                </ThemedView>
              )}

              {recordedAudioUri && (
                <ThemedView style={styles.audioPreview}>
                  <ThemedText style={styles.audioPreviewLabel}>Audio grabado:</ThemedText>
                  <ThemedView style={styles.audioControls}>
                    <TouchableOpacity
                      style={styles.playButton}
                      onPress={playRecordedAudio}
                    >
                      {getActionIcon(recordedPlayerStatus.playing ? 'pause' : 'play')}
                    </TouchableOpacity>
                    <ThemedText style={styles.audioDuration}>
                      {formatTime((recordedPlayerStatus.currentTime || 0) / 1000)} / {formatTime((recordedPlayerStatus.duration || 0) / 1000)}
                    </ThemedText>
                    <TouchableOpacity
                      style={styles.resetRecordedButton}
                      onPress={resetRecordedAudio}
                    >
                      {getActionIcon('restart')}
                    </TouchableOpacity>
                  </ThemedView>
                  <ThemedView style={styles.recordedAudioActions}>
                    <TouchableOpacity
                      style={styles.restartButton}
                      onPress={restartRecording}
                    >
                      {getActionIcon('clear')}
                    </TouchableOpacity>
                  </ThemedView>
                </ThemedView>
              )}
            </ThemedView>

            {/* Firma del responsable */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.label}>Firma del Responsable *</ThemedText>
              
              {!firmaResponsable ? (
                <ThemedView style={styles.signatureButtons}>
                  <TouchableOpacity
                    style={[styles.signatureButton, isGeneratingFirma && styles.signatureButtonDisabled]}
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
                        {firmaResponsable.empleadoDetalle.nombre} {firmaResponsable.empleadoDetalle.primer_apellido} {firmaResponsable.empleadoDetalle.segundo_apellido}
                      </ThemedText>
                    </ThemedView>
                  )}
                  <ThemedText style={styles.signatureInfoText}>Latitud: {firmaResponsable.latitud}</ThemedText>
                  <ThemedText style={styles.signatureInfoText}>Longitud: {firmaResponsable.longitud}</ThemedText>
                  <ThemedText style={styles.signatureInfoText}>Hora actual: {generateDateTime(new Date(parseInt(firmaResponsable.timestamp)).toISOString())}</ThemedText>
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
                style={styles.cancelButton}
                onPress={cancelCreating}
              >
                <ThemedText style={styles.cancelButtonText}>{getActionIcon('cancel')}</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitButton}
                onPress={createVoiceNote}
              >
                <ThemedText style={styles.submitButtonText}>{getActionIcon('confirm')}</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          </ThemedView>
        )}

        {/* Voice Notes List */}
        {!isCreating && filteredVoiceNotes.length > 0 && (
          <ThemedView style={styles.listContainer}>
            {filteredVoiceNotes.map((voiceNote, index) => {
              // Create unique key for each voice note (handles offline notes with id: 0)
              const voiceNoteKey = voiceNote.id !== 0 ? `voicenote-${voiceNote.id}` : (voiceNote.id_local || `voicenote-${index}`);
              const key = getUniqueKey(voiceNote);
              
              const isExpanded = expandedVoiceNotes.has(key);
              const isPlaying = playingStates.get(key) || false;
              const duration = audioDurations.get(key) || 0;
              const position = audioPositions.get(key) || 0;
              
              // Decode firma
              let firmaData = null;
              try {
                const decodedHash = atob(voiceNote.firma_responsable);
                const [sessionId, empleadoId, latitud, longitud, timestamp] = decodedHash.split(':');
                firmaData = {
                  sessionId,
                  empleadoId,
                  latitud,
                  longitud,
                  timestamp,
                };
              } catch (error) {
                console.error('Error decoding signature:', error);
              }

              return (
                <ThemedView key={voiceNoteKey} style={styles.voiceNoteCard}>
                  <ThemedView style={styles.voiceNoteHeader}>
                    <ThemedText style={styles.voiceNoteTitle}>{voiceNote.titulo}</ThemedText>
                    {voiceNote.created_by === (employee?.id || 0) && (
                        <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => deleteVoiceNote(voiceNote)}
                        >
                        <ThemedText style={styles.deleteButtonText}>
                            {getActionIcon('clear')}
                        </ThemedText>
                        </TouchableOpacity>
                    )}
                  </ThemedView>

                  <ThemedText style={styles.voiceNoteDetail}>
                    <ThemedText style={styles.voiceNoteLabel}>Empresa: </ThemedText>
                    {voiceNote.empresa.nombre}
                  </ThemedText>

                  <ThemedText style={styles.voiceNoteDetail}>
                    <ThemedText style={styles.voiceNoteLabel}>Cliente: </ThemedText>
                    {voiceNote.cliente.nombre}
                  </ThemedText>

                  <ThemedText style={styles.voiceNoteDetail}>
                    <ThemedText style={styles.voiceNoteLabel}>Corpo: </ThemedText>
                    {voiceNote.corpo.nombre}
                  </ThemedText>

                  {voiceNote.puesto && (
                    <ThemedText style={styles.voiceNoteDetail}>
                      <ThemedText style={styles.voiceNoteLabel}>Puesto: </ThemedText>
                      {voiceNote.puesto.nombre}
                    </ThemedText>
                  )}

                  <ThemedText style={styles.voiceNoteDetail}>
                    <ThemedText style={styles.voiceNoteLabel}>Descripción: </ThemedText>
                    {voiceNote.descripcion}
                  </ThemedText>

                  <ThemedText style={styles.voiceNoteDetail}>
                    <ThemedText style={styles.voiceNoteLabel}>Creado por: </ThemedText>
                    {voiceNote.nombre_creator}
                  </ThemedText>

                  <ThemedText style={styles.voiceNoteDetail}>
                    <ThemedText style={styles.voiceNoteLabel}>Creado el: </ThemedText>
                    {generateDateTime(voiceNote.created_at)}
                  </ThemedText>

                  {/* Firma */}
                  {firmaData && (
                    <ThemedView style={styles.signatureInfo}>
                      <ThemedText style={styles.signatureInfoTitle}>Firma:</ThemedText>
                      <ThemedText style={styles.signatureInfoText}>ID de sesión: {firmaData.sessionId}</ThemedText>
                      <ThemedText style={styles.signatureInfoText}>ID del empleado: {firmaData.empleadoId}</ThemedText>
                      <ThemedText style={styles.signatureInfoText}>Latitud: {firmaData.latitud}</ThemedText>
                      <ThemedText style={styles.signatureInfoText}>Longitud: {firmaData.longitud}</ThemedText>
                      <ThemedText style={styles.signatureInfoText}>Hora: {generateDateTime(new Date(parseInt(firmaData.timestamp)).toISOString())}</ThemedText>
                    </ThemedView>
                  )}

                  {/* Collapsable Button - Audio */}
                  <TouchableOpacity
                    style={styles.collapseButton}
                    onPress={() => toggleVoiceNoteExpanded(voiceNote)}
                  >
                    <ThemedText style={styles.collapseButtonText}>
                      {isExpanded ? 'Ocultar Audio' : 'Ver Audio'}
                    </ThemedText>
                    <Ionicons
                      name={isExpanded ? "chevron-up" : "chevron-down"}
                      size={20}
                      color="#007AFF"
                    />
                  </TouchableOpacity>

                  {/* Collapsable Content - Audio and Transcription */}
                  {isExpanded && (
                    <ThemedView style={styles.collapsableContent}>
                      {/* Audio Player */}
                      {audioUris.has(key) && (
                        <>
                          <VoiceNoteAudioPlayer
                            audioUri={audioUris.get(key)!}
                            isPlaying={isPlaying}
                            onStatusUpdate={(dur, pos, playing) => {
                              setAudioDurations(prev => {
                                const newMap = new Map(prev);
                                newMap.set(key, dur);
                                return newMap;
                              });
                              setAudioPositions(prev => {
                                const newMap = new Map(prev);
                                newMap.set(key, pos);
                                return newMap;
                              });
                              setPlayingStates(prev => {
                                const newMap = new Map(prev);
                                newMap.set(key, playing);
                                return newMap;
                              });
                            }}
                          />
                          <ThemedView style={styles.audioPlayerContainer}>
                            <ThemedView style={styles.audioPlayer}>
                              <TouchableOpacity
                                style={styles.playButton}
                                onPress={() => {
                                  const audioUri = audioUris.get(key);
                                  if (audioUri) {
                                    // Toggle play/pause through state
                                    playVoiceNoteAudio(voiceNote);
                                  }
                                }}
                              >
                                {getActionIcon(isPlaying ? 'pause' : 'play')}
                              </TouchableOpacity>
                              <ThemedText style={styles.audioTime}>
                                {formatTime(position)} / {formatTime(duration)}
                              </ThemedText>
                              <TouchableOpacity
                                style={styles.resetAudioButton}
                                onPress={() => resetVoiceNoteAudio(voiceNote)}
                              >
                                {getActionIcon('restart')}
                              </TouchableOpacity>
                            </ThemedView>
                          </ThemedView>
                        </>
                      )}

                      {/* Transcription */}
                      {voiceNote.transcripcion && (
                        <>
                          <ThemedText style={styles.transcriptionTitle}>Transcripción:</ThemedText>
                          <ThemedText style={styles.transcriptionText}>{voiceNote.transcripcion}</ThemedText>
                        </>
                      )}
                    </ThemedView>
                  )}
                </ThemedView>
              );
            })}
          </ThemedView>
        )}

        {!isCreating && filteredVoiceNotes.length === 0 && voiceNotes.length > 0 && (
          <ThemedView style={styles.emptyContainer}>
            <ThemedText style={styles.emptyText}>No se encontraron notas de voz con los filtros aplicados</ThemedText>
          </ThemedView>
        )}

        {!isCreating && voiceNotes.length === 0 && (
          <ThemedView style={styles.emptyContainer}>
            <ThemedText style={styles.emptyText}>No hay notas de voz registradas</ThemedText>
          </ThemedView>
        )}
      </ScrollView>

      <AppFooter />
      <SlideMenu 
        isVisible={isMenuVisible} 
        onClose={handleMenuClose}
        onHomePress={handleHomePress}
        currentRoute="VoiceNotes"
      />
      {QRScannerComponent}

      {showFilterCreatedAtPicker && (
        <DateTimePicker
          value={filterCreatedAt ? new Date(filterCreatedAt) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => {
            setShowFilterCreatedAtPicker(Platform.OS === 'ios');
            if (selectedDate) {
              const year = selectedDate.getFullYear();
              const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
              const day = String(selectedDate.getDate()).padStart(2, '0');
              setFilterCreatedAt(`${year}-${month}-${day}`);
            }
          }}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
  titleContainer: {
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  createButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  createButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  formContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#007AFF',
  },
  formGroup: {
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#000000',
  },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  checkboxContainer: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
    backgroundColor: '#fff',
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
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
  },
  puestoActualText: {
    fontSize: 14,
    color: '#666',
  },
  puestoActualContainer: {
    marginTop: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DDD',
  },
  recordingControls: {
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  recordButton: {
    backgroundColor: '#FF3B30',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  recordButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  recordingActiveContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
  },
  stopButton: {
    backgroundColor: '#FF3B30',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
  },
  stopButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  recordingTime: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF3B30',
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  audioPreview: {
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  audioPreviewLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#000000',
  },
  audioControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  playButton: {
    padding: 8,
  },
  audioDuration: {
    fontSize: 16,
    fontWeight: '500',
    color: '#007AFF',
    flex: 1,
  },
  recordedAudioActions: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-start',
    backgroundColor: '#fff',
  },
  resetRecordedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderRadius: 8,
    gap: 4,
  },
  resetRecordedButtonText: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: '600',
  },
  restartButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    backgroundColor: '#FF9500',
    borderRadius: 8,
    gap: 8,
  },
  restartButtonText: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: '600',
    marginLeft: 4,
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
  signatureButtonDisabled: {
    backgroundColor: '#999',
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
  signatureInfoDetail: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#BDE4FF',
    borderRadius: 8,
    marginBottom: 4,
  },
  signatureInfoDetailText: {
    fontSize: 12,
    color: '#000000',
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
  formActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    backgroundColor: '#fff',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#999',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#34C759',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  listContainer: {
    gap: 16,
  },
  voiceNoteCard: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#fff',
  },
  voiceNoteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  voiceNoteTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    color: '#007AFF',
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
    padding: 8,
    borderRadius: 8,
  },
  deleteButtonText: {
    color: '#FFF',
  },
  voiceNoteDetail: {
    fontSize: 14,
    marginBottom: 8,
    color: '#666',
  },
  voiceNoteLabel: {
    fontWeight: '600',
    color: '#000000',
  },
  audioPlayerContainer: {
    marginVertical: 12,
    backgroundColor: '#fff',
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
  resetAudioButtonText: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: '600',
  },
  collapseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#E8F4FF',
    borderRadius: 8,
    marginTop: 8,
    gap: 8,
  },
  collapseButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  collapsableContent: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  transcriptionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000000',
  },
  transcriptionText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#666',
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
  },
  filtersTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
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
  filtersContent: {
    padding: 16,
    gap: 16,
    backgroundColor: '#fff',
  },
  filterGroup: {
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  filterInput: {
    width: '100%',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: '#F9F9F9',
    color: '#000000',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#000000',
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
});

