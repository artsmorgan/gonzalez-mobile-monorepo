import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  Alert, 
  ActivityIndicator, 
  Modal, 
  View, 
  Platform, 
  Image,
  Linking
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
import { Picker } from '@react-native-picker/picker';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import * as Network from 'expo-network';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAudioRecorder, useAudioRecorderState, useAudioPlayer, useAudioPlayerStatus, RecordingPresets, requestRecordingPermissionsAsync } from 'expo-audio';
import { createIncident as createIncidentAPI, updateIncident as updateIncidentAPI } from '@/hooks/incidentsFunctions';
import { eventBus } from '@/hooks/eventBus';
import getHoraAccion from '@/hooks/getHoraAccion';

type IncidentsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Incidents'>;

interface Executive {
  id: number;
  nombre: string;
}

interface Classification {
  id: number;
  nombre: string;
}

interface Involucrado {
  codigo: string;
  nombre: string;
}

interface Incident {
  id: number;
  estado: boolean;
  ejecutivo: {
    id: number;
    name: string;
  };
  fecha_incidente: string;
  fecha_reporte: string;
  nombre_responsable: string;
  clasificacion: {
    id: number;
    name: string;
  };
  descripcion: string;
  involucrados: string; // JSON string array of Involucrado
  fecha_libro_novedades: string; // JSON string with numero and fecha
  nombre_responsable_atencion: string;
  solucion: string;
  fecha_solucion: string;
  fecha_solucion_real: string;
  costo_asociado: string;
  consecutivo_informe: string;
  link_informe: string;
  id_local: string;
  base64_image: string;
  base64_audio: string;
}

interface LibroNovedades {
  numero: string;
  fecha: string;
}

// Componente para reproducir audio de incidentes con cleanup
function IncidentAudioPlayer({ audioUri }: { audioUri: string }) {
  const audioPlayer = useAudioPlayer(audioUri);
  const playerStatus = useAudioPlayerStatus(audioPlayer);

  // Cleanup al desmontar el componente
  useEffect(() => {
    return () => {
      try {
        // Verificar que el player existe y no fue liberado antes de intentar pausar
        if (audioPlayer && playerStatus.playing) {
          try {
            audioPlayer.pause();
          } catch (pauseError) {
            // Ignorar si el objeto ya fue liberado
            console.log('Audio player already released, skipping pause');
          }
        }
        // Liberar recursos si existe el método
        if (audioPlayer && typeof audioPlayer.remove === 'function') {
          try {
            audioPlayer.remove();
          } catch (removeError) {
            // Ignorar si ya fue removido
            console.log('Audio player already removed');
          }
        }
      } catch (error) {
        console.log('Error en cleanup de audio player:', error);
      }
    };
  }, [audioPlayer, playerStatus.playing]);

  const playPauseAudio = () => {
    try {
      if (!audioPlayer) return; // Verificar que existe
      
      if (playerStatus.playing) {
        audioPlayer.pause();
      } else {
        audioPlayer.play();
      }
    } catch (error) {
      // Verificar si es un error de objeto liberado
      const errorMsg = String(error);
      if (errorMsg.includes('already released') || errorMsg.includes('has been rejected')) {
        console.log('Audio player was released, cannot play/pause');
      } else {
        console.error('Error reproduciendo audio:', error);
      }
    }
  };

  const resetAudio = () => {
    try {
      if (!audioPlayer) return; // Verificar que existe
      
      audioPlayer.seekTo(0);
      audioPlayer.pause();
    } catch (error) {
      // Verificar si es un error de objeto liberado
      const errorMsg = String(error);
      if (errorMsg.includes('already released') || errorMsg.includes('has been rejected')) {
        console.log('Audio player was released, cannot reset');
      } else {
        console.error('Error reseteando audio:', error);
      }
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <ThemedView style={styles.audioPlayerContainer}>
      <ThemedView style={styles.audioControls}>
        <TouchableOpacity
          style={styles.playButton}
          onPress={playPauseAudio}
        >
          <Ionicons
            name={playerStatus.playing ? 'pause' : 'play'}
            size={20}
            color="#007AFF"
          />
        </TouchableOpacity>
        <ThemedText style={styles.audioDuration}>
          {formatTime(playerStatus.currentTime)} / {formatTime(playerStatus.duration)}
        </ThemedText>
        <TouchableOpacity
          style={styles.resetAudioButton}
          onPress={resetAudio}
        >
          <Ionicons name="refresh" size={20} color="#007AFF" />
        </TouchableOpacity>
      </ThemedView>
    </ThemedView>
  );
}

export default function IncidentsScreen() {
  const { employee, refreshAccessToken, logout } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<IncidentsScreenNavigationProp>();
  
  // Data state
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [executives, setExecutives] = useState<Executive[]>([]);
  const [classifications, setClassifications] = useState<Classification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasCurrentMarca, setHasCurrentMarca] = useState<boolean>(false);
  
  // Form states
  const [isCreating, setIsCreating] = useState(false);
  const [editingIncident, setEditingIncident] = useState<Incident | null>(null);
  
  // Form refs for creation/editing
  const ejecutivoIdRef = useRef<number>(0);
  const fechaIncidenteRef = useRef<string>('');
  const fechaReporteRef = useRef<string>('');
  const nombreResponsableRef = useRef<string>('');
  const clasificacionIdRef = useRef<number>(0);
  const descripcionRef = useRef<string>('');
  const involucradosRef = useRef<Involucrado[]>([]);
  const libroNovedadesRef = useRef<LibroNovedades>({ numero: '', fecha: '' });
  const nombreResponsableAtencionRef = useRef<string>('');
  
  // Edit-only refs
  const solucionRef = useRef<string>('');
  const fechaSolucionRef = useRef<string>('');
  const fechaSolucionRealRef = useRef<string>('');
  const costoAsociadoRef = useRef<string>('');
  const consecutivoInformeRef = useRef<string>('');
  const linkInformeRef = useRef<string>('');
  
  // Controlled states for pickers and dates
  const [selectedEjecutivo, setSelectedEjecutivo] = useState<number>(0);
  const [selectedClasificacion, setSelectedClasificacion] = useState<number>(0);
  const [fechaIncidente, setFechaIncidente] = useState<Date>(new Date());
  const [fechaReporte, setFechaReporte] = useState<Date>(new Date());
  const [fechaLibroNovedades, setFechaLibroNovedades] = useState<Date>(new Date());
  const [fechaSolucion, setFechaSolucion] = useState<Date>(new Date());
  const [fechaSolucionReal, setFechaSolucionReal] = useState<Date>(new Date());
  
  // Date picker visibility
  const [showFechaIncidentePicker, setShowFechaIncidentePicker] = useState(false);
  const [showFechaReportePicker, setShowFechaReportePicker] = useState(false);
  const [showFechaLibroPicker, setShowFechaLibroPicker] = useState(false);
  const [showFechaSolucionPicker, setShowFechaSolucionPicker] = useState(false);
  const [showFechaSolucionRealPicker, setShowFechaSolucionRealPicker] = useState(false);
  
  // Involucrados state
  const [involucrados, setInvolucrados] = useState<Involucrado[]>([{ codigo: '', nombre: '' }]);
  
  // Camera state
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [incidentImageBase64, setIncidentImageBase64] = useState<string | null>(null);
  
  // Audio recording states
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder, 1000); // Actualizar cada segundo
  const [recordedAudioUri, setRecordedAudioUri] = useState<string | null>(null);
  const audioPlayer = useAudioPlayer(recordedAudioUri || undefined);
  const playerStatus = useAudioPlayerStatus(audioPlayer); // Estado actualizado del reproductor
  const [recordedAudioBase64, setRecordedAudioBase64] = useState<string | null>(null);
  
  // Expanded incidents for audio/image
  const [expandedIncidents, setExpandedIncidents] = useState<Set<string>>(new Set());
  
  // Archivos adjuntos por incidente
  const [incidentImages, setIncidentImages] = useState<Map<string, string>>(new Map());
  const [incidentAudios, setIncidentAudios] = useState<Map<string, string>>(new Map());
  const [loadingImages, setLoadingImages] = useState<Set<string>>(new Set());
  const [loadingAudios, setLoadingAudios] = useState<Set<string>>(new Set());
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [audioErrors, setAudioErrors] = useState<Set<string>>(new Set());
  
  // Archivos adjuntos para el formulario de edición
  const [editingImage, setEditingImage] = useState<string | null>(null);
  const [editingAudio, setEditingAudio] = useState<string | null>(null);
  const [loadingEditingImage, setLoadingEditingImage] = useState(false);
  const [loadingEditingAudio, setLoadingEditingAudio] = useState(false);
  const [editingImageError, setEditingImageError] = useState(false);
  const [editingAudioError, setEditingAudioError] = useState(false);
  
  // Form key for forcing re-render
  const [formKey, setFormKey] = useState(0);
  
  // Estado para prevenir race conditions en cleanup
  const isCleaningUpRef = useRef(false);
  const isMountedRef = useRef(true);

  // Cleanup del audioRecorder y audioPlayer cuando se desmonta el componente
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      
      // Detener grabación si está activa
      if (audioRecorder && recorderState.isRecording) {
        audioRecorder.stop().catch(err => {
          const errorMsg = String(err);
          if (!errorMsg.includes('already released')) {
            console.log('Error deteniendo grabación en cleanup:', err);
          }
        });
      }
      
      // Pausar reproductor si está reproduciendo
      if (audioPlayer && playerStatus.playing) {
        try {
          audioPlayer.pause();
        } catch (err) {
          const errorMsg = String(err);
          if (!errorMsg.includes('already released') && !errorMsg.includes('has been rejected')) {
            console.log('Error pausando audio en cleanup:', err);
          }
        }
      }
    };
  }, [audioRecorder, audioPlayer, recorderState.isRecording, playerStatus.playing]);

  // El estado de grabación ahora se obtiene de recorderState
  // No necesitamos el useEffect porque useAudioRecorderState ya actualiza automáticamente

  const getConnectionStatus = async (): Promise<boolean> => {
    const networkState = await Network.getNetworkStateAsync();
    return networkState.isConnected && networkState.isInternetReachable ? true : false;
  };

  // Función helper para obtener una clave única del incidente
  const getIncidentUniqueKey = (incident: Incident): string => {
    if (incident.id_local && incident.id_local !== '') {
      return incident.id_local;
    }
    return `incident-${incident.id}`;
  };

  // Función para limpiar todas las referencias antes de recargar
  // Memoizada sin dependencias de estado para evitar re-creaciones constantes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cleanupBeforeReload = useCallback(async () => {
    // Prevenir race conditions usando ref en lugar de state
    if (isCleaningUpRef.current) {
      console.log('Cleanup already in progress, skipping...');
      return;
    }
    
    isCleaningUpRef.current = true;
    
    try {
      // Detener grabación si está activa (verificar el estado actual directamente)
      try {
        if (audioRecorder && recorderState.isRecording) {
          await audioRecorder.stop();
        }
      } catch (error) {
        console.log('Error deteniendo grabación:', error);
      }

      // Pausar reproductor principal si está reproduciendo
      try {
        if (audioPlayer && playerStatus.playing) {
          audioPlayer.pause();
        }
      } catch (error) {
        const errorMsg = String(error);
        // Solo loguear si no es un error de objeto ya liberado
        if (!errorMsg.includes('already released') && !errorMsg.includes('has been rejected')) {
          console.log('Error pausando audio:', error);
        }
      }

      // Cerrar modales y limpiar estados
      setIsCameraVisible(false);
      setIsCreating(false);
      setEditingIncident(null);

      // Limpiar estados de archivos adjuntos
      setExpandedIncidents(new Set());
      setIncidentImages(new Map());
      setIncidentAudios(new Map());
      setLoadingImages(new Set());
      setLoadingAudios(new Set());
      setImageErrors(new Set());
      setAudioErrors(new Set());
      
      // Limpiar archivos adjuntos del formulario de edición
      setEditingImage(null);
      setEditingAudio(null);
      setLoadingEditingImage(false);
      setLoadingEditingAudio(false);
      setEditingImageError(false);
      setEditingAudioError(false);

      // Esperar un poco para asegurar que todo se limpie
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error('Error en cleanupBeforeReload:', error);
    } finally {
      isCleaningUpRef.current = false;
    }
  }, []); // Sin dependencias para evitar re-creaciones

  const fetchIncidents = useCallback(async () => {
    try {
      setIsLoading(true);

      // Verificar si existe current_marca
      const currentMarca = await AsyncStorage.getItem('current_marca');
      if (!currentMarca) {
        setHasCurrentMarca(false);
        setIsLoading(false);
        return;
      }

      const currentMarcaData = JSON.parse(currentMarca);
      const marcaId = currentMarcaData.id;
      setHasCurrentMarca(true);

      // Verificar conectividad
      const isConnected = await getConnectionStatus();

      setIncidents([]);
      setClassifications([]);
      setExecutives([]);

      if (isConnected) {
        // Con internet: hacer fetch normal
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

        // Fetch incidents
        const incidentsResponse = await fetch(`${apiUrl}/api/incidents?m=${marcaId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': '69420',
          },
        });

        if (incidentsResponse.status === 401 || incidentsResponse.status === 403) {
          const refreshed = await refreshAccessToken();
          if (refreshed) {
            return fetchIncidents();
          } else {
            Alert.alert('Error', 'Sesión expirada. Por favor inicie sesión nuevamente.');
            await logout();
            return;
          }
        }

        if (!incidentsResponse.ok) {
          throw new Error(`HTTP error! status: ${incidentsResponse.status}`);
        }

        const incidentsData = await incidentsResponse.json();

        if (incidentsData.status && incidentsData.incidents) {
          
          setIncidents(incidentsData.incidents);
          // Actualizar incidents_cache preservando base64
          await AsyncStorage.setItem('incidents_cache', JSON.stringify(incidentsData.incidents));
        } else {
          setIncidents([]);
          if (incidentsData.message) {
            Alert.alert('Info', incidentsData.message);
          }
        }

        // Fetch classifications
        const classificationsResponse = await fetch(`${apiUrl}/api/incidents/classification`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': '69420',
          },
        });

        if (classificationsResponse.ok) {
          const classificationsData = await classificationsResponse.json();
          if (classificationsData.status && classificationsData.classifications) {
            setClassifications(classificationsData.classifications);
            await AsyncStorage.setItem('incidents_classifications_cache', JSON.stringify(classificationsData.classifications));
          }
        }

        // Fetch executives
        const executivesResponse = await fetch(`${apiUrl}/api/executives`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': '69420',
          },
        });

        if (executivesResponse.ok) {
          const executivesData = await executivesResponse.json();
          if (executivesData.status && executivesData.executives) {
            setExecutives(executivesData.executives);
            await AsyncStorage.setItem('executives_cache', JSON.stringify(executivesData.executives));
          }
        }
      } else {
        // Sin internet: cargar desde cache
        const incidentsCache = await AsyncStorage.getItem('incidents_cache');
        if (incidentsCache) {
          const cachedIncidents = JSON.parse(incidentsCache);
          // Añadir base64 vacío si no existe
          const incidentsWithBase64 = cachedIncidents.map((incident: Incident) => ({
            ...incident,
            base64_image: incident.base64_image || '',
            base64_audio: incident.base64_audio || '',
          }));
          setIncidents(incidentsWithBase64);
          Alert.alert('Modo Offline', 'No hay conexión a internet. Mostrando datos guardados.');
        } else {
          setIncidents([]);
          Alert.alert('Sin conexión', 'No hay conexión a internet y no hay datos guardados previamente.');
        }

        // Cargar classifications desde cache
        const classificationsCache = await AsyncStorage.getItem('incidents_classifications_cache');
        if (classificationsCache) {
          const cachedClassifications = JSON.parse(classificationsCache);
          setClassifications(cachedClassifications);
        }

        // Cargar executives desde cache
        const executivesCache = await AsyncStorage.getItem('executives_cache');
        if (executivesCache) {
          const cachedExecutives = JSON.parse(executivesCache);
          setExecutives(cachedExecutives);
        }
      }

    } catch (err) {
      console.error('Error fetching incidents:', err);
      // En caso de error, intentar cargar desde cache
      try {
        const incidentsCache = await AsyncStorage.getItem('incidents_cache');
        if (incidentsCache) {
          const cachedIncidents = JSON.parse(incidentsCache);
          const incidentsWithBase64 = cachedIncidents.map((incident: Incident) => ({
            ...incident,
            base64_image: incident.base64_image || '',
            base64_audio: incident.base64_audio || '',
          }));
          setIncidents(incidentsWithBase64);
          Alert.alert('Modo Offline', 'Error de conexión. Mostrando datos guardados.');
        } else {
          setIncidents([]);
          Alert.alert('Error', 'No se pudieron cargar los incidentes');
        }

        // Cargar classifications desde cache
        const classificationsCache = await AsyncStorage.getItem('incidents_classifications_cache');
        if (classificationsCache) {
          const cachedClassifications = JSON.parse(classificationsCache);
          setClassifications(cachedClassifications);
        }

        // Cargar executives desde cache
        const executivesCache = await AsyncStorage.getItem('executives_cache');
        if (executivesCache) {
          const cachedExecutives = JSON.parse(executivesCache);
          setExecutives(cachedExecutives);
        }
      } catch (cacheErr) {
        setIncidents([]);
        Alert.alert('Error', 'No se pudieron cargar los incidentes');
      }
    } finally {
      setIsLoading(false);
    }
  }, [refreshAccessToken, logout]);

  // Hooks para cargar datos al entrar a la pantalla y cuando se restaura la conexión
  useFocusEffect(
    useCallback(() => {
      // Solo cargar datos, no hacer cleanup aquí ya que puede causar ejecuciones múltiples
      fetchIncidents();
    }, [fetchIncidents])
  );

  useEffect(() => {
    const handler = async () => {
      // Cuando se restaura la conexión, hacer cleanup y recargar
      await cleanupBeforeReload();
      await fetchIncidents();
    };
    eventBus.on('connectionRestored', handler);
    return () => {
      eventBus.off('connectionRestored', handler);
    };
  }, [cleanupBeforeReload, fetchIncidents]);

  const openCamera = async () => {
    if (!permission) {
      const permissionResult = await requestPermission();
      if (!permissionResult.granted) {
        Alert.alert('Error', 'Se necesita permiso para acceder a la cámara');
        return;
      }
    }

    if (!permission?.granted) {
      const permissionResult = await requestPermission();
      if (!permissionResult.granted) {
        Alert.alert('Error', 'Se necesita permiso para acceder a la cámara');
        return;
      }
    }

    setIsCameraVisible(true);
  };

  const takePicture = async () => {
    if (!cameraRef.current) {
      Alert.alert('Error', 'Cámara no disponible');
      return;
    }

    try {
      const photo = await cameraRef.current.takePictureAsync({ 
        base64: true,
        quality: 0.7,
        skipProcessing: false
      });
      
      if (!photo || !photo.base64) {
        Alert.alert('Error', 'No se pudo capturar la foto');
        setIsCameraVisible(false);
        return;
      }

      setIsCameraVisible(false);
      
      const formattedBase64 = `data:image/jpeg;base64,${photo.base64}`;
      
      setTimeout(() => {
        setIncidentImageBase64(formattedBase64);
      }, 100);
    } catch (error) {
      console.error('Error capturing image:', error);
      Alert.alert('Error', 'No se pudo capturar la imagen');
      setIsCameraVisible(false);
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

  const playRecordedAudio = async () => {
    try {
      if (!recordedAudioUri || !audioPlayer) return;

      if (playerStatus.playing) {
        audioPlayer.pause();
      } else {
        audioPlayer.play();
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

  const resetRecordedAudio = async () => {
    try {
      if (!audioPlayer) return;
      
      audioPlayer.seekTo(0);
      audioPlayer.pause();
    } catch (error) {
      const errorMsg = String(error);
      if (!errorMsg.includes('already released') && !errorMsg.includes('has been rejected')) {
        console.error('Error resetting recorded audio:', error);
      }
    }
  };

  const restartRecording = () => {
    try {
      if (audioPlayer && playerStatus.playing) {
        audioPlayer.pause();
      }
    } catch (error) {
      // Ignorar errores de objetos ya liberados
    }
    setRecordedAudioUri(null);
    setRecordedAudioBase64(null);
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

  const formatDateToISO = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}T00:00:00.000Z`;
  };

  const startCreating = () => {
    setIsCreating(true);
    setFormKey(prev => prev + 1);
    resetForm();
    
    // Set default values
    if (executives.length > 0) {
      ejecutivoIdRef.current = executives[0].id;
      setSelectedEjecutivo(executives[0].id);
    }
    if (classifications.length > 0) {
      clasificacionIdRef.current = classifications[0].id;
      setSelectedClasificacion(classifications[0].id);
    }
    
    const today = new Date();
    setFechaIncidente(today);
    setFechaReporte(today);
    setFechaLibroNovedades(today);
    fechaIncidenteRef.current = formatDateToISO(today);
    fechaReporteRef.current = formatDateToISO(today);
    libroNovedadesRef.current.fecha = formatDateToISO(today);
    
    // Set employee name as default
    if (employee?.name) {
      nombreResponsableRef.current = employee.name;
    }
    
    setInvolucrados([{ codigo: '', nombre: '' }]);
    involucradosRef.current = [{ codigo: '', nombre: '' }];
  };

  const cancelCreating = () => {
    setIsCreating(false);
    resetForm();
    if (recorderState.isRecording) {
      stopRecording();
    }
  };

  const resetForm = () => {
    ejecutivoIdRef.current = 0;
    fechaIncidenteRef.current = '';
    fechaReporteRef.current = '';
    nombreResponsableRef.current = '';
    clasificacionIdRef.current = 0;
    descripcionRef.current = '';
    involucradosRef.current = [];
    libroNovedadesRef.current = { numero: '', fecha: '' };
    nombreResponsableAtencionRef.current = '';
    solucionRef.current = '';
    fechaSolucionRef.current = '';
    fechaSolucionRealRef.current = '';
    costoAsociadoRef.current = '';
    consecutivoInformeRef.current = '';
    linkInformeRef.current = '';
    setIncidentImageBase64(null);
    setRecordedAudioUri(null);
    setRecordedAudioBase64(null);
  };

  const addInvolucrado = () => {
    const newInvolucrados = [...involucrados, { codigo: '', nombre: '' }];
    setInvolucrados(newInvolucrados);
    involucradosRef.current = newInvolucrados;
  };

  const updateInvolucrado = (index: number, field: 'codigo' | 'nombre', value: string) => {
    const newInvolucrados = [...involucrados];
    newInvolucrados[index][field] = value;
    setInvolucrados(newInvolucrados);
    involucradosRef.current = newInvolucrados;
  };

  const removeInvolucrado = (index: number) => {
    if (involucrados.length > 1) {
      const newInvolucrados = involucrados.filter((_, i) => i !== index);
      setInvolucrados(newInvolucrados);
      involucradosRef.current = newInvolucrados;
    }
  };

  const createIncident = async () => {
    // Validations
    if (!ejecutivoIdRef.current || ejecutivoIdRef.current === 0) {
      Alert.alert('Error', 'Debe seleccionar un ejecutivo de cuenta');
      return;
    }

    if (!fechaIncidenteRef.current) {
      Alert.alert('Error', 'Debe seleccionar la fecha del incidente');
      return;
    }

    if (!fechaReporteRef.current) {
      Alert.alert('Error', 'Debe seleccionar la fecha del reporte');
      return;
    }

    if (!nombreResponsableRef.current.trim()) {
      Alert.alert('Error', 'Debe ingresar el nombre de quien reporta');
      return;
    }

    if (!clasificacionIdRef.current || clasificacionIdRef.current === 0) {
      Alert.alert('Error', 'Debe seleccionar una clasificación');
      return;
    }

    if (!descripcionRef.current.trim()) {
      Alert.alert('Error', 'Debe ingresar la descripción del incidente');
      return;
    }

    if (!libroNovedadesRef.current.numero.trim() || !libroNovedadesRef.current.fecha) {
      Alert.alert('Error', 'Debe completar la información del libro de novedades');
      return;
    }

    if (!nombreResponsableAtencionRef.current.trim()) {
      Alert.alert('Error', 'Debe ingresar el nombre del responsable de atención');
      return;
    }

    Alert.alert(
      'Confirmar creación',
      '¿Está seguro de que desea crear este incidente?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Crear',
          onPress: async () => {
            try {
              const currentMarca = await AsyncStorage.getItem('current_marca');
              if (!currentMarca) {
                Alert.alert('Error', 'No se encontró la marca actual');
                return;
              }

              const currentMarcaData = JSON.parse(currentMarca);

              const requestBody: any = {
                marca_id: currentMarcaData.id,
                ejecutivo_cuenta: ejecutivoIdRef.current,
                fecha_incidente: fechaIncidenteRef.current,
                fecha_reporte: fechaReporteRef.current,
                nombre_responsable: nombreResponsableRef.current,
                clasificacion_id: clasificacionIdRef.current,
                descripcion: descripcionRef.current,
                involucrados: JSON.stringify(involucradosRef.current),
                fecha_libro_novedades: JSON.stringify(libroNovedadesRef.current),
                nombre_responsable_atencion: nombreResponsableAtencionRef.current,
              };

              if (incidentImageBase64 && incidentImageBase64.trim() !== '') {
                requestBody.file_image = incidentImageBase64;
              }

              if (recordedAudioBase64 && recordedAudioBase64.trim() !== '') {
                requestBody.file_audio = recordedAudioBase64;
              }

              // Verificar conexión
              const hasConnection = await getConnectionStatus();

              if (hasConnection) {
                // Con internet: llamar API
                const data = await createIncidentAPI({
                  requestData: requestBody,
                  refreshAccessToken,
                  logout,
                });

                if (data.status) {
                  Alert.alert('Éxito', data.message || 'Incidente creado correctamente');
                  setIsCreating(false);
                  resetForm();
                  await fetchIncidents();
                } else {
                  Alert.alert('Error', data.message || 'Error al crear el incidente');
                }
              } else {
                // Sin internet: modo offline
                const localId = `local_${Date.now()}_${Math.random().toString(36).substring(7)}`;

                // Crear entrada en incidents_actions
                const actionsStr = await AsyncStorage.getItem('incidents_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  requestData: requestBody,
                  marcaId: currentMarcaData.id,
                  id: localId,
                  type: 'create',
                });
                await AsyncStorage.setItem('incidents_actions', JSON.stringify(actions));

                // Obtener ejecutivo y clasificación seleccionados
                const selectedEjecutivo = executives.find(e => e.id === ejecutivoIdRef.current);
                const selectedClasificacion = classifications.find(c => c.id === clasificacionIdRef.current);

                // Crear incidente en cache
                const cacheStr = await AsyncStorage.getItem('incidents_cache');
                const cache = cacheStr ? JSON.parse(cacheStr) : [];

                const newIncidentCache: Incident = {
                  id: 0,
                  estado: false,
                  ejecutivo: {
                    id: ejecutivoIdRef.current,
                    name: selectedEjecutivo?.nombre || '',
                  },
                  fecha_incidente: fechaIncidenteRef.current,
                  fecha_reporte: fechaReporteRef.current,
                  nombre_responsable: nombreResponsableRef.current,
                  clasificacion: {
                    id: clasificacionIdRef.current,
                    name: selectedClasificacion?.nombre || '',
                  },
                  descripcion: descripcionRef.current,
                  involucrados: JSON.stringify(involucradosRef.current),
                  fecha_libro_novedades: JSON.stringify(libroNovedadesRef.current),
                  nombre_responsable_atencion: nombreResponsableAtencionRef.current,
                  solucion: '',
                  fecha_solucion: '',
                  fecha_solucion_real: '',
                  costo_asociado: '',
                  consecutivo_informe: '',
                  link_informe: '',
                  id_local: localId,
                  base64_image: (incidentImageBase64 && incidentImageBase64.trim() !== '') ? incidentImageBase64 : '',
                  base64_audio: (recordedAudioBase64 && recordedAudioBase64.trim() !== '') ? recordedAudioBase64 : '',
                };

                cache.push(newIncidentCache);
                await AsyncStorage.setItem('incidents_cache', JSON.stringify(cache));

                Alert.alert('Modo Offline', 'Incidente registrado localmente. Se sincronizará cuando haya conexión.');
                setIsCreating(false);
                resetForm();
                await fetchIncidents();
              }
            } catch (err) {
              console.error('Error creating incident:', err);
              Alert.alert('Error', 'No se pudo crear el incidente');
            }
          },
        },
      ]
    );
  };

  const fetchEditingImage = async (incidentId: number) => {
    try {
      setLoadingEditingImage(true);
      setEditingImageError(false);

      // Buscar el incidente en el estado para verificar id_local y base64
      const incident = editingIncident;
      const hasConnection = await getConnectionStatus();

      // Si tiene id_local y no hay conexión, usar base64 del cache
      if (incident && incident.id_local !== '' && !hasConnection) {
        if (incident.base64_image && incident.base64_image.trim() !== '') {
          const formattedImage = incident.base64_image.startsWith('data:') 
            ? incident.base64_image 
            : `data:image/jpeg;base64,${incident.base64_image}`;
          setEditingImage(formattedImage);
          setLoadingEditingImage(false);
          return;
        } else {
          setEditingImageError(true);
          setLoadingEditingImage(false);
          return;
        }
      }

      // Si no hay conexión y no tiene id_local, no intentar obtener
      if (!hasConnection) {
        setEditingImageError(true);
        setLoadingEditingImage(false);
        return;
      }

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

      const response = await fetch(`${apiUrl}/api/incidents/${incidentId}/get-image`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': '69420',
        },
      });

      if (response.status === 401 || response.status === 403) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          return fetchEditingImage(incidentId);
        } else {
          throw new Error('Authentication failed');
        }
      }

      if (!response.ok) {
        if (response.status === 404) {
          setEditingImageError(true);
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        if (isMountedRef.current) {  // Verificar si el componente sigue montado
          const base64data = reader.result as string;
          setEditingImage(base64data);
        }
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error('Error fetching editing image:', error);
      if (isMountedRef.current) {
        setEditingImageError(true);
      }
    } finally {
      if (isMountedRef.current) {
        setLoadingEditingImage(false);
      }
    }
  };

  const fetchEditingAudio = async (incidentId: number) => {
    try {
      setLoadingEditingAudio(true);
      setEditingAudioError(false);

      // Buscar el incidente en el estado para verificar id_local y base64
      const incident = editingIncident;
      const hasConnection = await getConnectionStatus();

      // Si tiene id_local y no hay conexión, usar base64 del cache
      if (incident && incident.id_local !== '' && !hasConnection) {
        if (incident.base64_audio && incident.base64_audio.trim() !== '') {
          const formattedAudio = incident.base64_audio.startsWith('data:') 
            ? incident.base64_audio 
            : `data:audio/mp4;base64,${incident.base64_audio}`;
          setEditingAudio(formattedAudio);
          setLoadingEditingAudio(false);
          return;
        } else {
          setEditingAudioError(true);
          setLoadingEditingAudio(false);
          return;
        }
      }

      // Si no hay conexión y no tiene id_local, no intentar obtener
      if (!hasConnection) {
        setEditingAudioError(true);
        setLoadingEditingAudio(false);
        return;
      }

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

      const response = await fetch(`${apiUrl}/api/incidents/${incidentId}/get-audio`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': '69420',
        },
      });

      if (response.status === 401 || response.status === 403) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          return fetchEditingAudio(incidentId);
        } else {
          throw new Error('Authentication failed');
        }
      }

      if (!response.ok) {
        if (response.status === 404) {
          setEditingAudioError(true);
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        if (isMountedRef.current) {  // Verificar si el componente sigue montado
          const base64data = reader.result as string;
          setEditingAudio(base64data);
        }
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error('Error fetching editing audio:', error);
      if (isMountedRef.current) {
        setEditingAudioError(true);
      }
    } finally {
      if (isMountedRef.current) {
        setLoadingEditingAudio(false);
      }
    }
  };

  const startEditing = (incident: Incident) => {
    setEditingIncident(incident);
    setFormKey(prev => prev + 1);
    
    // Reset archivos adjuntos
    setEditingImage(null);
    setEditingAudio(null);
    setEditingImageError(false);
    setEditingAudioError(false);
    
    // Set refs with incident values
    ejecutivoIdRef.current = incident.ejecutivo.id;
    setSelectedEjecutivo(incident.ejecutivo.id);
    
    fechaIncidenteRef.current = incident.fecha_incidente;
    setFechaIncidente(new Date(incident.fecha_incidente));
    
    fechaReporteRef.current = incident.fecha_reporte;
    setFechaReporte(new Date(incident.fecha_reporte));
    
    nombreResponsableRef.current = incident.nombre_responsable;
    
    clasificacionIdRef.current = incident.clasificacion.id;
    setSelectedClasificacion(incident.clasificacion.id);
    
    descripcionRef.current = incident.descripcion;
    
    try {
      const parsedInvolucrados = JSON.parse(incident.involucrados);
      setInvolucrados(parsedInvolucrados);
      involucradosRef.current = parsedInvolucrados;
    } catch {
      setInvolucrados([{ codigo: '', nombre: '' }]);
      involucradosRef.current = [{ codigo: '', nombre: '' }];
    }
    
    try {
      const parsedLibro = JSON.parse(incident.fecha_libro_novedades);
      libroNovedadesRef.current = parsedLibro;
      setFechaLibroNovedades(new Date(parsedLibro.fecha));
    } catch {
      libroNovedadesRef.current = { numero: '', fecha: '' };
    }
    
    nombreResponsableAtencionRef.current = incident.nombre_responsable_atencion;
    
    solucionRef.current = incident.solucion || '';
    fechaSolucionRef.current = incident.fecha_solucion || '';
    if (incident.fecha_solucion) {
      setFechaSolucion(new Date(incident.fecha_solucion));
    }
    
    fechaSolucionRealRef.current = incident.fecha_solucion_real || '';
    if (incident.fecha_solucion_real) {
      setFechaSolucionReal(new Date(incident.fecha_solucion_real));
    }
    
    costoAsociadoRef.current = incident.costo_asociado || '';
    consecutivoInformeRef.current = incident.consecutivo_informe || '';
    linkInformeRef.current = incident.link_informe || '';
    
    setIncidentImageBase64(null);
    setRecordedAudioUri(null);
    setRecordedAudioBase64(null);
    
    // Cargar archivos adjuntos cuando se inicia la edición
    fetchEditingImage(incident.id);
    fetchEditingAudio(incident.id);
  };

  const cancelEditing = () => {
    setEditingIncident(null);
    setEditingImage(null);
    setEditingAudio(null);
    setEditingImageError(false);
    setEditingAudioError(false);
    resetForm();
  };

  const updateIncident = async (incidentId: number) => {
    // Validations for edit fields
    if (!solucionRef.current.trim()) {
      Alert.alert('Error', 'Debe ingresar la solución propuesta');
      return;
    }

    if (!fechaSolucionRef.current) {
      Alert.alert('Error', 'Debe seleccionar la fecha de solución propuesta');
      return;
    }

    if (!fechaSolucionRealRef.current) {
      Alert.alert('Error', 'Debe seleccionar la fecha real de solución');
      return;
    }

    Alert.alert(
      'Confirmar edición',
      '¿Está seguro de que desea guardar los cambios?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const requestBody = {
                solucion: solucionRef.current,
                fecha_solucion: fechaSolucionRef.current,
                fecha_real_solucion: fechaSolucionRealRef.current,
                costo_asociado: costoAsociadoRef.current,
                consecutivo_informe: consecutivoInformeRef.current,
                link_informe: linkInformeRef.current,
              };

              // Verificar conexión
              const hasConnection = await getConnectionStatus();

              if (hasConnection) {
                // Con internet: llamar API
                const data = await updateIncidentAPI({
                  requestData: requestBody,
                  incidentId,
                  refreshAccessToken,
                  logout,
                });

                if (data.status) {
                  Alert.alert('Éxito', data.message || 'Incidente actualizado correctamente');
                  setEditingIncident(null);
                  resetForm();
                  await fetchIncidents();
                } else {
                  Alert.alert('Error', data.message || 'Error al actualizar el incidente');
                }
              } else {
                // Sin internet: modo offline
                const incident = editingIncident;
                if (!incident) {
                  Alert.alert('Error', 'No se encontró el incidente a editar');
                  return;
                }

                const actionsStr = await AsyncStorage.getItem('incidents_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];

                if (incident.id_local !== '') {
                  // Editar acción existente en incidents_actions
                  const actionIndex = actions.findIndex((a: any) => a.id === incident.id_local);
                  if (actionIndex !== -1) {
                    // Actualizar requestData de la acción existente
                    actions[actionIndex].requestData = {
                      ...actions[actionIndex].requestData,
                      ...requestBody,
                    };
                    await AsyncStorage.setItem('incidents_actions', JSON.stringify(actions));
                  }
                } else {
                  // Crear nueva acción de update en incidents_actions
                  // Eliminar cualquier acción de update previa para este incidentId
                  const filteredActions = actions.filter((a: any) => !(a.type === 'update' && a.id === incidentId));
                  filteredActions.push({
                    requestData: requestBody,
                    id: incidentId,
                    type: 'update',
                  });
                  await AsyncStorage.setItem('incidents_actions', JSON.stringify(filteredActions));
                }

                // Actualizar incidents_cache
                const cacheStr = await AsyncStorage.getItem('incidents_cache');
                const cache = cacheStr ? JSON.parse(cacheStr) : [];
                
                const incidentIndex = cache.findIndex((inc: Incident) => 
                  incident.id_local !== '' ? inc.id_local === incident.id_local : inc.id === incidentId
                );

                if (incidentIndex !== -1) {
                  cache[incidentIndex] = {
                    ...cache[incidentIndex],
                    solucion: requestBody.solucion,
                    fecha_solucion: requestBody.fecha_solucion,
                    fecha_solucion_real: requestBody.fecha_real_solucion,
                    costo_asociado: requestBody.costo_asociado,
                    consecutivo_informe: requestBody.consecutivo_informe,
                    link_informe: requestBody.link_informe,
                  };
                  await AsyncStorage.setItem('incidents_cache', JSON.stringify(cache));
                }

                Alert.alert('Modo Offline', 'Incidente actualizado localmente. Se sincronizará cuando haya conexión.');
                setEditingIncident(null);
                resetForm();
                await fetchIncidents();
              }
            } catch (err) {
              console.error('Error updating incident:', err);
              Alert.alert('Error', 'No se pudo actualizar el incidente');
            }
          },
        },
      ]
    );
  };

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'add': return <Ionicons name="add-sharp" size={24} color='#FFFFFF' />;
      case 'edit': return <Ionicons name="pencil" size={20} color='#FFFFFF' />;
      case 'cancel': return <Ionicons name="close-sharp" size={20} color='#FFFFFF' />;
      case 'confirm': return <Ionicons name="checkmark-sharp" size={20} color='#FFFFFF' />;
      case 'camera': return <Ionicons name="camera" size={20} color="#007AFF" />;
      case 'microphone': return <Ionicons name="mic" size={20} color="#ffffff" />;
      case 'play': return <Ionicons name="play" size={20} color="#007AFF" />;
      case 'pause': return <Ionicons name="pause" size={20} color="#007AFF" />;
      case 'stop': return <Ionicons name="stop" size={20} color="#FF3B30" />;
      case 'restart': return <Ionicons name="refresh" size={20} color="#007AFF" />;
      case 'clear': return <Ionicons name="trash" size={20} color="#fff" />;
      case 'remove': return <Ionicons name="remove-circle" size={20} color="#FF3B30" />;
      default: return <Ionicons name="close-sharp" size={20} color='#FFFFFF' />;
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
  };

  const fetchIncidentImage = async (incidentId: number) => {
    // Buscar el incidente en el estado para obtener la clave única
    const incident = incidents.find(inc => 
      inc.id === incidentId || 
      (inc.id === 0 && inc.id_local && inc.id_local !== '' && inc.id_local === String(incidentId))
    );
    
    if (!incident) {
      console.warn('Incidente no encontrado para cargar imagen:', incidentId);
      return;
    }

    const uniqueKey = getIncidentUniqueKey(incident);

    // Si ya tenemos la imagen o está cargando, no hacer nada
    if (incidentImages.has(uniqueKey) || loadingImages.has(uniqueKey)) {
      return;
    }

    try {
      setLoadingImages(prev => {
        const newSet = new Set(prev);
        newSet.add(uniqueKey);
        return newSet;
      });
      setImageErrors(prev => {
        const newSet = new Set(prev);
        newSet.delete(uniqueKey);
        return newSet;
      });

      const hasConnection = await getConnectionStatus();

      // Si tiene id_local y no hay conexión, usar base64 del cache
      if (incident.id_local !== '' && !hasConnection) {
        if (incident.base64_image && incident.base64_image.trim() !== '') {
          const formattedImage = incident.base64_image.startsWith('data:') 
            ? incident.base64_image 
            : `data:image/jpeg;base64,${incident.base64_image}`;
          setIncidentImages(prev => {
            const newMap = new Map(prev);
            newMap.set(uniqueKey, formattedImage);
            return newMap;
          });
          setLoadingImages(prev => {
            const newSet = new Set(prev);
            newSet.delete(uniqueKey);
            return newSet;
          });
          return;
        } else {
          setImageErrors(prev => {
            const newSet = new Set(prev);
            newSet.add(uniqueKey);
            return newSet;
          });
          setLoadingImages(prev => {
            const newSet = new Set(prev);
            newSet.delete(uniqueKey);
            return newSet;
          });
          return;
        }
      }

      // Si no hay conexión y no tiene id_local, no intentar obtener
      if (!hasConnection) {
        setImageErrors(prev => {
          const newSet = new Set(prev);
          newSet.add(uniqueKey);
          return newSet;
        });
        setLoadingImages(prev => {
          const newSet = new Set(prev);
          newSet.delete(uniqueKey);
          return newSet;
        });
        return;
      }

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

      const response = await fetch(`${apiUrl}/api/incidents/${incidentId}/get-image`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': '69420',
        },
      });

      if (response.status === 401 || response.status === 403) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          return fetchIncidentImage(incidentId);
        } else {
          throw new Error('Authentication failed');
        }
      }

      if (!response.ok) {
        if (response.status === 404) {
          // No hay imagen, esto es normal
          setImageErrors(prev => {
            const newSet = new Set(prev);
            newSet.add(uniqueKey);
            return newSet;
          });
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Obtener el blob de la imagen
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;
        setIncidentImages(prev => {
          const newMap = new Map(prev);
          newMap.set(uniqueKey, base64data);
          return newMap;
        });
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error('Error fetching incident image:', error);
      setImageErrors(prev => {
        const newSet = new Set(prev);
        newSet.add(uniqueKey);
        return newSet;
      });
    } finally {
      setLoadingImages(prev => {
        const newSet = new Set(prev);
        newSet.delete(uniqueKey);
        return newSet;
      });
    }
  };

  const fetchIncidentAudio = async (incidentId: number) => {
    // Buscar el incidente en el estado para obtener la clave única
    const incident = incidents.find(inc => 
      inc.id === incidentId || 
      (inc.id === 0 && inc.id_local && inc.id_local !== '' && inc.id_local === String(incidentId))
    );
    
    if (!incident) {
      console.warn('Incidente no encontrado para cargar audio:', incidentId);
      return;
    }

    const uniqueKey = getIncidentUniqueKey(incident);

    // Si ya tenemos el audio o está cargando, no hacer nada
    if (incidentAudios.has(uniqueKey) || loadingAudios.has(uniqueKey)) {
      return;
    }

    try {
      setLoadingAudios(prev => {
        const newSet = new Set(prev);
        newSet.add(uniqueKey);
        return newSet;
      });
      setAudioErrors(prev => {
        const newSet = new Set(prev);
        newSet.delete(uniqueKey);
        return newSet;
      });

      const hasConnection = await getConnectionStatus();

      // Si tiene id_local y no hay conexión, usar base64 del cache
      if (incident.id_local !== '' && !hasConnection) {
        if (incident.base64_audio && incident.base64_audio.trim() !== '') {
          const formattedAudio = incident.base64_audio.startsWith('data:') 
            ? incident.base64_audio 
            : `data:audio/mp4;base64,${incident.base64_audio}`;
          setIncidentAudios(prev => {
            const newMap = new Map(prev);
            newMap.set(uniqueKey, formattedAudio);
            return newMap;
          });
          setLoadingAudios(prev => {
            const newSet = new Set(prev);
            newSet.delete(uniqueKey);
            return newSet;
          });
          return;
        } else {
          setAudioErrors(prev => {
            const newSet = new Set(prev);
            newSet.add(uniqueKey);
            return newSet;
          });
          setLoadingAudios(prev => {
            const newSet = new Set(prev);
            newSet.delete(uniqueKey);
            return newSet;
          });
          return;
        }
      }

      // Si no hay conexión y no tiene id_local, no intentar obtener
      if (!hasConnection) {
        setAudioErrors(prev => {
          const newSet = new Set(prev);
          newSet.add(uniqueKey);
          return newSet;
        });
        setLoadingAudios(prev => {
          const newSet = new Set(prev);
          newSet.delete(uniqueKey);
          return newSet;
        });
        return;
      }

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

      const response = await fetch(`${apiUrl}/api/incidents/${incidentId}/get-audio`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': '69420',
        },
      });

      if (response.status === 401 || response.status === 403) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          return fetchIncidentAudio(incidentId);
        } else {
          throw new Error('Authentication failed');
        }
      }

      if (!response.ok) {
        if (response.status === 404) {
          // No hay audio, esto es normal
          setAudioErrors(prev => {
            const newSet = new Set(prev);
            newSet.add(uniqueKey);
            return newSet;
          });
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Obtener el blob del audio
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;
        setIncidentAudios(prev => {
          const newMap = new Map(prev);
          newMap.set(uniqueKey, base64data);
          return newMap;
        });
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error('Error fetching incident audio:', error);
      setAudioErrors(prev => {
        const newSet = new Set(prev);
        newSet.add(uniqueKey);
        return newSet;
      });
    } finally {
      setLoadingAudios(prev => {
        const newSet = new Set(prev);
        newSet.delete(uniqueKey);
        return newSet;
      });
    }
  };

  const toggleIncidentExpansion = (incident: Incident) => {
    const uniqueKey = getIncidentUniqueKey(incident);
    
    setExpandedIncidents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(uniqueKey)) {
        newSet.delete(uniqueKey);
      } else {
        newSet.add(uniqueKey);
        // Cuando se expande, obtener los archivos adjuntos usando el incidente completo
        fetchIncidentImageByIncident(incident);
        fetchIncidentAudioByIncident(incident);
      }
      return newSet;
    });
  };

  const fetchIncidentImageByIncident = async (incident: Incident) => {
    const uniqueKey = getIncidentUniqueKey(incident);

    // Si ya tenemos la imagen o está cargando, no hacer nada
    if (incidentImages.has(uniqueKey) || loadingImages.has(uniqueKey)) {
      return;
    }

    try {
      setLoadingImages(prev => {
        const newSet = new Set(prev);
        newSet.add(uniqueKey);
        return newSet;
      });
      setImageErrors(prev => {
        const newSet = new Set(prev);
        newSet.delete(uniqueKey);
        return newSet;
      });

      const hasConnection = await getConnectionStatus();

      // Si tiene id_local y no hay conexión, usar base64 del cache
      if (incident.id_local !== '' && !hasConnection) {
        if (incident.base64_image && incident.base64_image.trim() !== '') {
          const formattedImage = incident.base64_image.startsWith('data:') 
            ? incident.base64_image 
            : `data:image/jpeg;base64,${incident.base64_image}`;
          setIncidentImages(prev => {
            const newMap = new Map(prev);
            newMap.set(uniqueKey, formattedImage);
            return newMap;
          });
          setLoadingImages(prev => {
            const newSet = new Set(prev);
            newSet.delete(uniqueKey);
            return newSet;
          });
          return;
        } else {
          setImageErrors(prev => {
            const newSet = new Set(prev);
            newSet.add(uniqueKey);
            return newSet;
          });
          setLoadingImages(prev => {
            const newSet = new Set(prev);
            newSet.delete(uniqueKey);
            return newSet;
          });
          return;
        }
      }

      // Si no hay conexión y no tiene id_local, no intentar obtener
      if (!hasConnection) {
        setImageErrors(prev => {
          const newSet = new Set(prev);
          newSet.add(uniqueKey);
          return newSet;
        });
        setLoadingImages(prev => {
          const newSet = new Set(prev);
          newSet.delete(uniqueKey);
          return newSet;
        });
        return;
      }

      // Solo intentar obtener desde el servidor si tiene id real (no offline)
      if (incident.id === 0) {
        setImageErrors(prev => {
          const newSet = new Set(prev);
          newSet.add(uniqueKey);
          return newSet;
        });
        setLoadingImages(prev => {
          const newSet = new Set(prev);
          newSet.delete(uniqueKey);
          return newSet;
        });
        return;
      }

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

      const response = await fetch(`${apiUrl}/api/incidents/${incident.id}/get-image`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': '69420',
        },
      });

      if (response.status === 401 || response.status === 403) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          return fetchIncidentImageByIncident(incident);
        } else {
          throw new Error('Authentication failed');
        }
      }

      if (!response.ok) {
        if (response.status === 404) {
          // No hay imagen, esto es normal
          setImageErrors(prev => {
            const newSet = new Set(prev);
            newSet.add(uniqueKey);
            return newSet;
          });
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Obtener el blob de la imagen
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;
        setIncidentImages(prev => {
          const newMap = new Map(prev);
          newMap.set(uniqueKey, base64data);
          return newMap;
        });
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error('Error fetching incident image:', error);
      setImageErrors(prev => {
        const newSet = new Set(prev);
        newSet.add(uniqueKey);
        return newSet;
      });
    } finally {
      setLoadingImages(prev => {
        const newSet = new Set(prev);
        newSet.delete(uniqueKey);
        return newSet;
      });
    }
  };

  const fetchIncidentAudioByIncident = async (incident: Incident) => {
    const uniqueKey = getIncidentUniqueKey(incident);

    // Si ya tenemos el audio o está cargando, no hacer nada
    if (incidentAudios.has(uniqueKey) || loadingAudios.has(uniqueKey)) {
      return;
    }

    try {
      setLoadingAudios(prev => {
        const newSet = new Set(prev);
        newSet.add(uniqueKey);
        return newSet;
      });
      setAudioErrors(prev => {
        const newSet = new Set(prev);
        newSet.delete(uniqueKey);
        return newSet;
      });

      const hasConnection = await getConnectionStatus();

      // Si tiene id_local y no hay conexión, usar base64 del cache
      if (incident.id_local !== '' && !hasConnection) {
        if (incident.base64_audio && incident.base64_audio.trim() !== '') {
          const formattedAudio = incident.base64_audio.startsWith('data:') 
            ? incident.base64_audio 
            : `data:audio/mp4;base64,${incident.base64_audio}`;
          setIncidentAudios(prev => {
            const newMap = new Map(prev);
            newMap.set(uniqueKey, formattedAudio);
            return newMap;
          });
          setLoadingAudios(prev => {
            const newSet = new Set(prev);
            newSet.delete(uniqueKey);
            return newSet;
          });
          return;
        } else {
          setAudioErrors(prev => {
            const newSet = new Set(prev);
            newSet.add(uniqueKey);
            return newSet;
          });
          setLoadingAudios(prev => {
            const newSet = new Set(prev);
            newSet.delete(uniqueKey);
            return newSet;
          });
          return;
        }
      }

      // Si no hay conexión y no tiene id_local, no intentar obtener
      if (!hasConnection) {
        setAudioErrors(prev => {
          const newSet = new Set(prev);
          newSet.add(uniqueKey);
          return newSet;
        });
        setLoadingAudios(prev => {
          const newSet = new Set(prev);
          newSet.delete(uniqueKey);
          return newSet;
        });
        return;
      }

      // Solo intentar obtener desde el servidor si tiene id real (no offline)
      if (incident.id === 0) {
        setAudioErrors(prev => {
          const newSet = new Set(prev);
          newSet.add(uniqueKey);
          return newSet;
        });
        setLoadingAudios(prev => {
          const newSet = new Set(prev);
          newSet.delete(uniqueKey);
          return newSet;
        });
        return;
      }

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

      const response = await fetch(`${apiUrl}/api/incidents/${incident.id}/get-audio`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': '69420',
        },
      });

      if (response.status === 401 || response.status === 403) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          return fetchIncidentAudioByIncident(incident);
        } else {
          throw new Error('Authentication failed');
        }
      }

      if (!response.ok) {
        if (response.status === 404) {
          // No hay audio, esto es normal
          setAudioErrors(prev => {
            const newSet = new Set(prev);
            newSet.add(uniqueKey);
            return newSet;
          });
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Obtener el blob del audio
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;
        setIncidentAudios(prev => {
          const newMap = new Map(prev);
          newMap.set(uniqueKey, base64data);
          return newMap;
        });
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error('Error fetching incident audio:', error);
      setAudioErrors(prev => {
        const newSet = new Set(prev);
        newSet.add(uniqueKey);
        return newSet;
      });
    } finally {
      setLoadingAudios(prev => {
        const newSet = new Set(prev);
        newSet.delete(uniqueKey);
        return newSet;
      });
    }
  };

  const renderIncidentForm = (isCreating: boolean) => {
    return (
      <ThemedView style={[styles.incidentCard, styles.formCard]}>
        <ThemedText style={styles.formTitle}>
          {isCreating ? 'Nuevo Incidente' : 'Editar Incidente'}
        </ThemedText>

        {/* Ejecutivo de cuenta */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Ejecutivo de cuenta:</ThemedText>
          <ThemedView style={[styles.pickerContainer, !isCreating && styles.disabledInput]}>
            <Picker
              selectedValue={selectedEjecutivo}
              enabled={isCreating}
              onValueChange={(value) => {
                ejecutivoIdRef.current = value;
                setSelectedEjecutivo(value);
                
                // Auto-fill nombre responsable atencion
                const selectedExec = executives.find(e => e.id === value);
                if (selectedExec) {
                  nombreResponsableAtencionRef.current = selectedExec.nombre;
                }
              }}
              style={styles.picker}
            >
              <Picker.Item label="Seleccione un ejecutivo" value={0} />
              {executives.map(exec => (
                <Picker.Item key={exec.id} label={exec.nombre} value={exec.id} />
              ))}
            </Picker>
          </ThemedView>
        </ThemedView>

        {/* Fecha del incidente */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Fecha del incidente:</ThemedText>
          <TouchableOpacity
            style={[styles.dateButton, !isCreating && styles.disabledInput]}
            onPress={() => isCreating && setShowFechaIncidentePicker(true)}
            disabled={!isCreating}
          >
            <ThemedText style={styles.dateButtonText}>
              {formatDateForDisplay(fechaIncidenteRef.current || fechaIncidente.toISOString())}
            </ThemedText>
            {isCreating && <Ionicons name="calendar-outline" size={20} color="#007AFF" />}
          </TouchableOpacity>
        </ThemedView>

        {/* Fecha del reporte */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Fecha del reporte:</ThemedText>
          <TouchableOpacity
            style={[styles.dateButton, !isCreating && styles.disabledInput]}
            onPress={() => isCreating && setShowFechaReportePicker(true)}
            disabled={!isCreating}
          >
            <ThemedText style={styles.dateButtonText}>
              {formatDateForDisplay(fechaReporteRef.current || fechaReporte.toISOString())}
            </ThemedText>
            {isCreating && <Ionicons name="calendar-outline" size={20} color="#007AFF" />}
          </TouchableOpacity>
        </ThemedView>

        {/* Nombre de quien reporta */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Nombre de quien reporta la incidencia:</ThemedText>
          <TextInput
            style={[styles.formInput, !isCreating && styles.disabledInput]}
            defaultValue={nombreResponsableRef.current}
            onChangeText={(text) => { nombreResponsableRef.current = text; }}
            placeholder="Nombre completo"
            placeholderTextColor="#999"
            editable={isCreating}
            key={`nombre-responsable-${formKey}`}
          />
        </ThemedView>

        {/* Clasificación */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Clasificación:</ThemedText>
          <ThemedView style={[styles.pickerContainer, !isCreating && styles.disabledInput]}>
            <Picker
              selectedValue={selectedClasificacion}
              enabled={isCreating}
              onValueChange={(value) => {
                clasificacionIdRef.current = value;
                setSelectedClasificacion(value);
              }}
              style={styles.picker}
            >
              <Picker.Item label="Seleccione una clasificación" value={0} />
              {classifications.map(clas => (
                <Picker.Item key={clas.id} label={clas.nombre} value={clas.id} />
              ))}
            </Picker>
          </ThemedView>
        </ThemedView>

        {/* Descripción */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Descripción del incidente:</ThemedText>
          <TextInput
            style={[styles.formInput, styles.textArea, !isCreating && styles.disabledInput]}
            defaultValue={descripcionRef.current}
            onChangeText={(text) => { descripcionRef.current = text; }}
            placeholder="Descripción detallada"
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            editable={isCreating}
            key={`descripcion-${formKey}`}
          />
        </ThemedView>

        {/* Involucrados */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Involucrados:</ThemedText>
          {involucrados.map((involucrado, index) => (
            <ThemedView key={`involucrado-${index}`} style={styles.involucradoRow}>
              <TextInput
                style={[styles.involucradoInput, !isCreating && styles.disabledInput]}
                defaultValue={involucrado.codigo}
                onChangeText={(text) => updateInvolucrado(index, 'codigo', text)}
                placeholder="Código (Opcional)"
                placeholderTextColor="#999"
                editable={isCreating}
              />
              <TextInput
                style={[styles.involucradoInput, !isCreating && styles.disabledInput]}
                defaultValue={involucrado.nombre}
                onChangeText={(text) => updateInvolucrado(index, 'nombre', text)}
                placeholder="Nombre completo"
                placeholderTextColor="#999"
                editable={isCreating}
              />
              {isCreating && involucrados.length > 1 && (
                <TouchableOpacity onPress={() => removeInvolucrado(index)}>
                  {getActionIcon('remove')}
                </TouchableOpacity>
              )}
            </ThemedView>
          ))}
          {isCreating && (
            <TouchableOpacity style={styles.addButton} onPress={addInvolucrado}>
              <Ionicons name="add-circle-outline" size={24} color="#007AFF" />
              <ThemedText style={styles.addButtonText}>Agregar involucrado</ThemedText>
            </TouchableOpacity>
          )}
        </ThemedView>

        {/* Libro de novedades */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Fecha de libro de novedades:</ThemedText>
          <TouchableOpacity
            style={[styles.dateButton, !isCreating && styles.disabledInput]}
            onPress={() => isCreating && setShowFechaLibroPicker(true)}
            disabled={!isCreating}
          >
            <ThemedText style={styles.dateButtonText}>
              {formatDateForDisplay(libroNovedadesRef.current.fecha || fechaLibroNovedades.toISOString())}
            </ThemedText>
            {isCreating && <Ionicons name="calendar-outline" size={20} color="#007AFF" />}
          </TouchableOpacity>
        </ThemedView>

        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Número de folio:</ThemedText>
          <TextInput
            style={[styles.formInput, !isCreating && styles.disabledInput]}
            defaultValue={libroNovedadesRef.current.numero}
            onChangeText={(text) => { libroNovedadesRef.current.numero = text; }}
            placeholder="Número de folio"
            placeholderTextColor="#999"
            editable={isCreating}
            key={`folio-${formKey}`}
          />
        </ThemedView>

        {/* Adjuntar imagen */}
        {isCreating && (
          <ThemedView style={styles.formGroup}>
            <ThemedText style={styles.formLabel}>Adjuntar imagen (opcional):</ThemedText>
            <TouchableOpacity
              style={styles.captureButton}
              onPress={openCamera}
            >
              {getActionIcon('camera')}
              <ThemedText style={styles.captureButtonText}>
                {incidentImageBase64 ? 'Cambiar imagen' : 'Capturar imagen'}
              </ThemedText>
            </TouchableOpacity>

            {incidentImageBase64 && (
              <ThemedView style={styles.previewContainer}>
                <ThemedText style={styles.previewTitle}>Imagen capturada:</ThemedText>
                <Image
                  source={{ uri: incidentImageBase64 }}
                  style={styles.imagePreview}
                  resizeMode="contain"
                />
              </ThemedView>
            )}
          </ThemedView>
        )}

        {/* Adjuntar audio */}
        {isCreating && (
          <ThemedView style={styles.formGroup}>
            <ThemedText style={styles.formLabel}>Adjuntar audio (opcional):</ThemedText>
            
             {!recordedAudioUri && (
               <ThemedView style={styles.recordingControls}>
                 {!recorderState.isRecording ? (
                   <TouchableOpacity
                     style={styles.recordButton}
                     onPress={startRecording}
                   >
                     {getActionIcon('microphone')}
                     <ThemedText style={styles.recordButtonText}>Iniciar Grabación</ThemedText>
                   </TouchableOpacity>
                 ) : (
                   <ThemedView style={styles.recordingActiveContainer}>
                     <TouchableOpacity
                       style={styles.stopButton}
                       onPress={stopRecording}
                     >
                       {getActionIcon('stop')}
                       <ThemedText style={styles.stopButtonText}>Detener Grabación</ThemedText>
                     </TouchableOpacity>
                     <ThemedText style={styles.recordingTime}>
                       {formatTime(Math.floor(recorderState.durationMillis / 1000))}
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
                    {getActionIcon(playerStatus.playing ? 'pause' : 'play')}
                  </TouchableOpacity>
                  <ThemedText style={styles.audioDuration}>
                    {formatTime(playerStatus.currentTime)} / {formatTime(playerStatus.duration)}
                  </ThemedText>
                  <TouchableOpacity
                    style={styles.resetAudioButton}
                    onPress={resetRecordedAudio}
                  >
                    {getActionIcon('restart')}
                  </TouchableOpacity>
                </ThemedView>
                <TouchableOpacity
                  style={styles.restartButton}
                  onPress={restartRecording}
                >
                  {getActionIcon('clear')}
                  <ThemedText style={styles.restartButtonText}>Eliminar audio</ThemedText>
                </TouchableOpacity>
              </ThemedView>
            )}
          </ThemedView>
        )}

        {/* Nombre del responsable de atención */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Nombre del responsable de atención:</ThemedText>
          <TextInput
            style={[styles.formInput, !isCreating && styles.disabledInput]}
            defaultValue={nombreResponsableAtencionRef.current}
            onChangeText={(text) => { nombreResponsableAtencionRef.current = text; }}
            placeholder="Nombre del responsable"
            placeholderTextColor="#999"
            editable={isCreating}
            key={`responsable-atencion-${formKey}`}
          />
        </ThemedView>

        {/* Archivos adjuntos - Solo lectura en edición */}
        {!isCreating && (
          <>
            <ThemedView style={styles.separator} />
            <ThemedText style={styles.sectionTitle}>Archivos Adjuntos</ThemedText>
            
            {/* Imagen */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Imagen adjunta:</ThemedText>
              {loadingEditingImage ? (
                <ThemedView style={styles.loadingAttachment}>
                  <ActivityIndicator size="small" color="#007AFF" />
                  <ThemedText style={styles.loadingText}>Cargando imagen...</ThemedText>
                </ThemedView>
              ) : editingImageError ? (
                <ThemedText style={styles.errorText}>No hay imagen disponible</ThemedText>
              ) : editingImage ? (
                <Image
                  source={{ uri: editingImage }}
                  style={styles.incidentImage}
                  resizeMode="contain"
                />
              ) : (
                <ThemedText style={styles.noAttachmentText}>No hay imagen adjunta</ThemedText>
              )}
            </ThemedView>

            {/* Audio */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Audio adjunto:</ThemedText>
              {loadingEditingAudio ? (
                <ThemedView style={styles.loadingAttachment}>
                  <ActivityIndicator size="small" color="#007AFF" />
                  <ThemedText style={styles.loadingText}>Cargando audio...</ThemedText>
                </ThemedView>
              ) : editingAudioError ? (
                <ThemedText style={styles.errorText}>No hay audio disponible</ThemedText>
              ) : editingAudio ? (
                <IncidentAudioPlayer audioUri={editingAudio} />
              ) : (
                <ThemedText style={styles.noAttachmentText}>No hay audio adjunto</ThemedText>
              )}
            </ThemedView>
          </>
        )}

        {/* Edit-only fields */}
        {!isCreating && (
          <>
            <ThemedView style={styles.separator} />
            <ThemedText style={styles.sectionTitle}>Información de Solución</ThemedText>

            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Solución Propuesta:</ThemedText>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                defaultValue={solucionRef.current}
                onChangeText={(text) => { solucionRef.current = text; }}
                placeholder="Descripción de la solución"
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
                key={`solucion-${formKey}`}
              />
            </ThemedView>

            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Fecha de la solución propuesta:</ThemedText>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowFechaSolucionPicker(true)}
              >
                <ThemedText style={styles.dateButtonText}>
                  {formatDateForDisplay(fechaSolucionRef.current || fechaSolucion.toISOString())}
                </ThemedText>
                <Ionicons name="calendar-outline" size={20} color="#007AFF" />
              </TouchableOpacity>
            </ThemedView>

            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Fecha real de la solución:</ThemedText>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowFechaSolucionRealPicker(true)}
              >
                <ThemedText style={styles.dateButtonText}>
                  {formatDateForDisplay(fechaSolucionRealRef.current || fechaSolucionReal.toISOString())}
                </ThemedText>
                <Ionicons name="calendar-outline" size={20} color="#007AFF" />
              </TouchableOpacity>
            </ThemedView>

            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Costo asociado del incidente:</ThemedText>
              <TextInput
                style={styles.formInput}
                defaultValue={costoAsociadoRef.current}
                onChangeText={(text) => { costoAsociadoRef.current = text; }}
                placeholder="Costo (opcional)"
                placeholderTextColor="#999"
                key={`costo-${formKey}`}
              />
            </ThemedView>

            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Consecutivo informe:</ThemedText>
              <TextInput
                style={styles.formInput}
                defaultValue={consecutivoInformeRef.current}
                onChangeText={(text) => { consecutivoInformeRef.current = text; }}
                placeholder="Consecutivo (opcional)"
                placeholderTextColor="#999"
                key={`consecutivo-${formKey}`}
              />
            </ThemedView>

            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Link informe:</ThemedText>
              <TextInput
                style={styles.formInput}
                defaultValue={linkInformeRef.current}
                onChangeText={(text) => { linkInformeRef.current = text; }}
                placeholder="URL del informe (opcional)"
                placeholderTextColor="#999"
                key={`link-${formKey}`}
              />
            </ThemedView>
          </>
        )}

        {/* Buttons */}
        <ThemedView style={styles.buttonRow}>
          <TouchableOpacity 
            style={styles.confirmButton} 
            onPress={isCreating ? createIncident : () => updateIncident(editingIncident!.id)}
          >
            <ThemedText style={styles.confirmButtonText}>
              {getActionIcon('confirm')}
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.cancelButton} 
            onPress={isCreating ? cancelCreating : cancelEditing}
          >
            <ThemedText style={styles.cancelButtonText}>
              {getActionIcon('cancel')}
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </ThemedView>
    );
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader onMenuPress={handleMenuPress} title="Incidentes" />
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Cargando incidentes...</ThemedText>
        </ThemedView>
        <AppFooter />
        <SlideMenu 
          isVisible={isMenuVisible} 
          onClose={handleMenuClose}
          onHomePress={handleHomePress}
          currentRoute="Incidents"
        />
      </ThemedView>
    );
  }

  if (!hasCurrentMarca) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader onMenuPress={handleMenuPress} title="Incidentes" />
        <ThemedView style={styles.noMarcaContainer}>
          <Ionicons name="alert-circle-outline" size={80} color="#FF9500" />
          <ThemedText style={styles.noMarcaTitle}>No hay marca registrada</ThemedText>
          <ThemedText style={styles.noMarcaMessage}>
            Debes registrar una marca de ingreso antes de acceder a incidentes.
          </ThemedText>
          <TouchableOpacity 
            style={styles.goBackButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={20} color="#fff" />
            <ThemedText style={styles.goBackButtonText}>Volver</ThemedText>
          </TouchableOpacity>
        </ThemedView>
        <AppFooter />
        <SlideMenu 
          isVisible={isMenuVisible} 
          onClose={handleMenuClose}
          onHomePress={handleHomePress}
          currentRoute="Incidents"
        />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <AppHeader onMenuPress={handleMenuPress} title="Incidentes" />
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <ThemedView style={styles.contentContainer}>
          {/* Module Title */}
          <ThemedView style={styles.titleContainer}>
            <ThemedText type="title" style={styles.title}>
              <Ionicons name="warning" size={28} color='#fff' /> Incidentes
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              Gestiona los incidentes
            </ThemedText>
          </ThemedView>

          {/* Create Button */}
          {!isCreating && !editingIncident && (
            <TouchableOpacity style={styles.createButton} onPress={startCreating}>
              <ThemedText style={styles.createButtonText}>{getActionIcon('add')}</ThemedText>
            </TouchableOpacity>
          )}

          {/* Create Form */}
          {isCreating && renderIncidentForm(true)}

          {/* Edit Form */}
          {editingIncident && renderIncidentForm(false)}

          {/* Incidents List */}
          {!isCreating && !editingIncident && (
            <ThemedView style={styles.incidentsContainer}>
              {incidents.length === 0 ? (
                <ThemedView style={styles.emptyContainer}>
                  <ThemedText style={styles.emptyText}>
                    No hay incidentes registrados aún
                  </ThemedText>
                </ThemedView>
              ) : (
                incidents.map(incident => (
                  <ThemedView key={incident.id_local && incident.id_local !== '' ? incident.id_local : `incident-${incident.id}`} style={styles.incidentCard}>
                    <ThemedView style={styles.incidentHeader}>
                      <ThemedText style={styles.incidentTitle}>
                        Incidente #{incident.id}
                      </ThemedText>
                      <ThemedView style={[
                        styles.statusBadge,
                        incident.estado ? styles.statusSolved : styles.statusPending
                      ]}>
                        <ThemedText style={styles.statusText}>
                          {incident.estado ? 'Solucionado' : 'Pendiente'}
                        </ThemedText>
                      </ThemedView>
                    </ThemedView>
                    
                    <ThemedText style={styles.incidentInfo}>
                      <ThemedText style={styles.incidentLabel}>Clasificación: </ThemedText>
                      {incident.clasificacion.name}
                    </ThemedText>
                    
                    <ThemedText style={styles.incidentInfo}>
                      <ThemedText style={styles.incidentLabel}>Descripción: </ThemedText>
                      {incident.descripcion}
                    </ThemedText>
                    
                    <ThemedText style={styles.incidentInfo}>
                      <ThemedText style={styles.incidentLabel}>Fecha incidente: </ThemedText>
                      {formatDateForDisplay(incident.fecha_incidente)}
                    </ThemedText>
                    
                    <ThemedText style={styles.incidentInfo}>
                      <ThemedText style={styles.incidentLabel}>Fecha reporte: </ThemedText>
                      {formatDateForDisplay(incident.fecha_reporte)}
                    </ThemedText>
                    
                    <ThemedText style={styles.incidentInfo}>
                      <ThemedText style={styles.incidentLabel}>Reportado por: </ThemedText>
                      {incident.nombre_responsable}
                    </ThemedText>

                    {/* Nombre responsable atención */}
                    <ThemedText style={styles.incidentInfo}>
                      <ThemedText style={styles.incidentLabel}>Responsable de atención: </ThemedText>
                      {incident.nombre_responsable_atencion || 'No especificado'}
                    </ThemedText>

                    {/* Botón para expandir/colapsar */}
                    <TouchableOpacity
                      style={styles.expandButton}
                      onPress={() => toggleIncidentExpansion(incident)}
                    >
                      <ThemedText style={styles.expandButtonText}>
                        {expandedIncidents.has(getIncidentUniqueKey(incident)) ? 'Ocultar detalles' : 'Ver más detalles'}
                      </ThemedText>
                      <Ionicons
                        name={expandedIncidents.has(getIncidentUniqueKey(incident)) ? 'chevron-up' : 'chevron-down'}
                        size={20}
                        color="#007AFF"
                      />
                    </TouchableOpacity>

                    {/* Sección colapsable con información adicional */}
                    {expandedIncidents.has(getIncidentUniqueKey(incident)) && (
                      <ThemedView style={styles.expandedSection}>
                        {/* Involucrados */}
                        <ThemedView style={styles.expandedItem}>
                          <ThemedText style={styles.expandedLabel}>Involucrados:</ThemedText>
                          {(() => {
                            try {
                              const involucrados = JSON.parse(incident.involucrados);
                              if (Array.isArray(involucrados) && involucrados.length > 0) {
                                return involucrados.map((inv: Involucrado, idx: number) => (
                                  <ThemedText key={idx} style={styles.expandedValue}>
                                    {inv.codigo ? `${inv.codigo} - ` : ''}{inv.nombre}
                                  </ThemedText>
                                ));
                              }
                              return <ThemedText style={styles.expandedValue}>No hay involucrados registrados</ThemedText>;
                            } catch {
                              return <ThemedText style={styles.expandedValue}>No hay involucrados registrados</ThemedText>;
                            }
                          })()}
                        </ThemedView>

                        {/* Fecha libro de novedades */}
                        <ThemedView style={styles.expandedItem}>
                          <ThemedText style={styles.expandedLabel}>Fecha de libro de novedades:</ThemedText>
                          {(() => {
                            try {
                              const libro = JSON.parse(incident.fecha_libro_novedades);
                              return (
                                <ThemedText style={styles.expandedValue}>
                                  {formatDateForDisplay(libro.fecha)} - Folio: {libro.numero}
                                </ThemedText>
                              );
                            } catch {
                              return <ThemedText style={styles.expandedValue}>No disponible</ThemedText>;
                            }
                          })()}
                        </ThemedView>

                        {/* Archivos adjuntos */}
                        <ThemedView style={styles.expandedItem}>
                          <ThemedText style={styles.expandedLabel}>Archivos adjuntos:</ThemedText>
                          
                          {/* Imagen */}
                          <ThemedView style={styles.attachmentSection}>
                            <ThemedText style={styles.attachmentLabel}>Imagen:</ThemedText>
                            {loadingImages.has(getIncidentUniqueKey(incident)) ? (
                              <ThemedView style={styles.loadingAttachment}>
                                <ActivityIndicator size="small" color="#007AFF" />
                                <ThemedText style={styles.loadingText}>Cargando imagen...</ThemedText>
                              </ThemedView>
                            ) : imageErrors.has(getIncidentUniqueKey(incident)) ? (
                              <ThemedText style={styles.errorText}>No hay imagen disponible</ThemedText>
                            ) : incidentImages.has(getIncidentUniqueKey(incident)) ? (
                              <Image
                                source={{ uri: incidentImages.get(getIncidentUniqueKey(incident))! }}
                                style={styles.incidentImage}
                                resizeMode="contain"
                              />
                            ) : (
                              <ThemedText style={styles.noAttachmentText}>No hay imagen adjunta</ThemedText>
                            )}
                          </ThemedView>

                          {/* Audio */}
                          <ThemedView style={styles.attachmentSection}>
                            <ThemedText style={styles.attachmentLabel}>Audio:</ThemedText>
                            {loadingAudios.has(getIncidentUniqueKey(incident)) ? (
                              <ThemedView style={styles.loadingAttachment}>
                                <ActivityIndicator size="small" color="#007AFF" />
                                <ThemedText style={styles.loadingText}>Cargando audio...</ThemedText>
                              </ThemedView>
                            ) : audioErrors.has(getIncidentUniqueKey(incident)) ? (
                              <ThemedText style={styles.errorText}>No hay audio disponible</ThemedText>
                            ) : incidentAudios.has(getIncidentUniqueKey(incident)) ? (
                              <IncidentAudioPlayer audioUri={incidentAudios.get(getIncidentUniqueKey(incident))!} />
                            ) : (
                              <ThemedText style={styles.noAttachmentText}>No hay audio adjunto</ThemedText>
                            )}
                          </ThemedView>
                        </ThemedView>
                      </ThemedView>
                    )}

                    {/* Campos de solución - Fuera del componente colapsable */}
                    {incident.solucion && incident.solucion.trim() !== '' && (
                      <ThemedText style={styles.incidentInfo}>
                        <ThemedText style={styles.incidentLabel}>Solución: </ThemedText>
                        {incident.solucion}
                      </ThemedText>
                    )}

                    {incident.fecha_solucion && incident.fecha_solucion.trim() !== '' && (
                      <ThemedText style={styles.incidentInfo}>
                        <ThemedText style={styles.incidentLabel}>Fecha de solución propuesta: </ThemedText>
                        {formatDateForDisplay(incident.fecha_solucion)}
                      </ThemedText>
                    )}

                    {incident.fecha_solucion_real && incident.fecha_solucion_real.trim() !== '' && (
                      <ThemedText style={styles.incidentInfo}>
                        <ThemedText style={styles.incidentLabel}>Fecha real de solución: </ThemedText>
                        {formatDateForDisplay(incident.fecha_solucion_real)}
                      </ThemedText>
                    )}

                    {incident.costo_asociado && incident.costo_asociado.trim() !== '' && (
                      <ThemedText style={styles.incidentInfo}>
                        <ThemedText style={styles.incidentLabel}>Costo asociado: </ThemedText>
                        {incident.costo_asociado}
                      </ThemedText>
                    )}

                    {incident.consecutivo_informe && incident.consecutivo_informe.trim() !== '' && (
                      <ThemedText style={styles.incidentInfo}>
                        <ThemedText style={styles.incidentLabel}>Consecutivo informe: </ThemedText>
                        {incident.consecutivo_informe}
                      </ThemedText>
                    )}

                    {incident.link_informe && incident.link_informe.trim() !== '' && (
                      <ThemedView style={{ marginBottom: 8 }}>
                        <ThemedText style={styles.incidentInfo}>
                          <ThemedText style={styles.incidentLabel}>Link informe: </ThemedText>
                        </ThemedText>
                        <TouchableOpacity
                          style={{ backgroundColor: '#fff' }}
                          onPress={async () => {
                            try {
                              const url = incident.link_informe.startsWith('http') 
                                ? incident.link_informe 
                                : `https://${incident.link_informe}`;
                              const canOpen = await Linking.canOpenURL(url);
                              if (canOpen) {
                                await Linking.openURL(url);
                              } else {
                                Alert.alert('Error', 'No se puede abrir este enlace');
                              }
                            } catch (error) {
                              Alert.alert('Error', 'No se pudo abrir el enlace');
                            }
                          }}
                        >
                          <ThemedText style={styles.linkText}>
                            {incident.link_informe}
                          </ThemedText>
                        </TouchableOpacity>
                      </ThemedView>
                    )}
                    
                    {!incident.estado && (
                      <ThemedView style={styles.buttonRow}>
                      <TouchableOpacity 
                        style={styles.editButton} 
                        onPress={() => startEditing(incident)}
                      >
                        <ThemedText style={styles.editButtonText}>
                          {getActionIcon('edit')} Editar
                        </ThemedText>
                      </TouchableOpacity>
                    </ThemedView>
                    )}
                  </ThemedView>
                ))
              )}
            </ThemedView>
          )}
        </ThemedView>
      </ScrollView>
      
      {/* Camera Modal */}
      <Modal
        visible={isCameraVisible}
        animationType="slide"
        onRequestClose={() => setIsCameraVisible(false)}
      >
        <ThemedView style={{ flex: 1, backgroundColor: '#000' }}>
          <CameraView
            ref={cameraRef}
            style={{ flex: 1 }}
            facing="back"
          >
            <TouchableOpacity
              style={styles.cameraCloseButton}
              onPress={() => setIsCameraVisible(false)}
            >
              <Ionicons name="close" size={30} color="#fff" />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.cameraCaptureButton}
              onPress={takePicture}
            >
              <ThemedView style={styles.cameraCaptureButtonInner} />
            </TouchableOpacity>
          </CameraView>
        </ThemedView>
      </Modal>

      {/* Date Pickers */}
      {showFechaIncidentePicker && (
        <DateTimePicker
          value={fechaIncidente}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => {
            setShowFechaIncidentePicker(Platform.OS === 'ios');
            if (selectedDate) {
              setFechaIncidente(selectedDate);
              fechaIncidenteRef.current = formatDateToISO(selectedDate);
            }
          }}
        />
      )}

      {showFechaReportePicker && (
        <DateTimePicker
          value={fechaReporte}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => {
            setShowFechaReportePicker(Platform.OS === 'ios');
            if (selectedDate) {
              setFechaReporte(selectedDate);
              fechaReporteRef.current = formatDateToISO(selectedDate);
            }
          }}
        />
      )}

      {showFechaLibroPicker && (
        <DateTimePicker
          value={fechaLibroNovedades}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => {
            setShowFechaLibroPicker(Platform.OS === 'ios');
            if (selectedDate) {
              setFechaLibroNovedades(selectedDate);
              libroNovedadesRef.current.fecha = formatDateToISO(selectedDate);
            }
          }}
        />
      )}

      {showFechaSolucionPicker && (
        <DateTimePicker
          value={fechaSolucion}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => {
            setShowFechaSolucionPicker(Platform.OS === 'ios');
            if (selectedDate) {
              setFechaSolucion(selectedDate);
              fechaSolucionRef.current = formatDateToISO(selectedDate);
            }
          }}
        />
      )}

      {showFechaSolucionRealPicker && (
        <DateTimePicker
          value={fechaSolucionReal}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => {
            setShowFechaSolucionRealPicker(Platform.OS === 'ios');
            if (selectedDate) {
              setFechaSolucionReal(selectedDate);
              fechaSolucionRealRef.current = formatDateToISO(selectedDate);
            }
          }}
        />
      )}
      
      <AppFooter />
      <SlideMenu 
        isVisible={isMenuVisible} 
        onClose={handleMenuClose}
        onHomePress={handleHomePress}
        currentRoute="Incidents"
      />
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
    marginBottom: 30,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    width: '100%',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    opacity: 0.7,
  },
  noMarcaContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 20,
  },
  noMarcaTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF9500',
    textAlign: 'center',
  },
  noMarcaMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 400,
  },
  goBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  goBackButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  createButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  incidentsContainer: {
    width: '100%',
    gap: 16,
  },
  incidentCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#fff',
    padding: 16,
    gap: 8,
  },
  incidentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  incidentTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusSolved: {
    backgroundColor: '#34C759', // Verde
  },
  statusPending: {
    backgroundColor: '#FF3B30', // Rojo
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  incidentInfo: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    backgroundColor: '#fff',
  },
  incidentLabel: {
    fontWeight: '600',
    color: '#000',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    backgroundColor: '#fff',
  },
  editButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.5,
    textAlign: 'center',
  },
  formCard: {
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  formInput: {
    width: '100%',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: '#F9F9F9',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  disabledInput: {
    backgroundColor: '#E8E8E8',
    opacity: 0.7,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
    overflow: 'hidden',
  },
  picker: {
    width: '100%',
    height: 50,
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
    color: '#000',
  },
  involucradoRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  involucradoInput: {
    flex: 1,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    fontSize: 14,
    backgroundColor: '#F9F9F9',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 8,
    backgroundColor: '#F0F8FF',
    marginTop: 8,
  },
  addButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  captureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F0F0F0',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  captureButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  previewContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  recordingControls: {
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  recordButton: {
    flexDirection: 'row',
    backgroundColor: '#FF3B30',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    gap: 8,
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
    flexDirection: 'row',
    backgroundColor: '#FF3B30',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    gap: 8,
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
  resetAudioButton: {
    padding: 8,
  },
  restartButton: {
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
  },
  separator: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 16,
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#34C759',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#8E8E93',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  cameraCloseButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  cameraCaptureButton: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#fff',
  },
  cameraCaptureButtonInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    marginTop: 12,
    backgroundColor: '#F0F8FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  expandButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  expandedSection: {
    marginTop: 12,
    padding: 16,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  expandedItem: {
    marginBottom: 16,
    backgroundColor: '#fafafa',
  },
  expandedLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  expandedValue: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  linkText: {
    color: '#007AFF',
    textDecorationLine: 'underline',
  },
  attachmentSection: {
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: '#fafafa',
  },
  attachmentLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  loadingAttachment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
    fontStyle: 'italic',
    padding: 8,
  },
  noAttachmentText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    padding: 8,
  },
  incidentImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginTop: 8,
    backgroundColor: '#F9F9F9',
  },
  audioPlayerContainer: {
    backgroundColor: '#F9F9F9',
    borderColor: '#E0E0E0',
  },
});