import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Linking, Modal, ScrollView, StyleSheet, TextInput, TouchableOpacity, View, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Network from 'expo-network';
import * as Location from 'expo-location';
import * as DocumentPicker from 'expo-document-picker';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { useAuth } from '../contexts/AuthContext';
import { ThemedView } from '../components/ThemedView';
import { ThemedText } from '../components/ThemedText';
import AppHeader from '../components/AppHeader';
import AppFooter from '../components/AppFooter';
import SlideMenu from '../components/SlideMenu';
import { eventBus } from '../hooks/eventBus';
import { createJobManual, listJobManualsByMarca, deleteJobManual, signJobManual } from '../hooks/jobManualsFunctions';
import getHoraAccion from '../hooks/getHoraAccion';
import { useQRScanner } from '../hooks/useQRScanner';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import { jwtDecode } from 'jwt-decode';

type JobManualsNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

type RoleName = 'OPERATIVO' | 'SUPERVISOR' | 'ADMINISTRATIVO' | string | null;

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
    cedula_empleado: string;
  };
}

interface ManualFileLocal {
  id: string;
  type: 'image' | 'audio' | 'video' | 'document';
  name: string;
  extension: string;
  base64: string;
  uri?: string;
  mimeType?: string;
}

interface ManualFileRemote {
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

interface JobManualRemote {
  id: number;
  title: string;
  description: string;
  firma: string;
  puesto: {
    id: number;
    nombre: string;
  };
  created_by: string;
  created_at: string;
  files: ManualFileRemote[];
  visualizaciones: {
    id: number;
    empleado_id: number;
    manual_puesto_id: number;
    nombre_empleado: string;
    firma_empleado: string;
    created_at: string;
  }[];
  currentEmployeeSigned: boolean;
  id_local?: string;
  synced?: boolean;
}

export default function JobManualsScreen() {
  const { employee, refreshAccessToken, logout } = useAuth();
  const navigation = useNavigation<JobManualsNavigationProp>();
  const [isMenuVisible, setIsMenuVisible] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [hasMarca, setHasMarca] = useState(false);
  const [marcaId, setMarcaId] = useState<number | null>(null);
  const [roleName, setRoleName] = useState<RoleName>(null);
  const [puestoActualNombre, setPuestoActualNombre] = useState<string>('');

  const [isCreating, setIsCreating] = useState(false);
  const [isCreatingManual, setIsCreatingManual] = useState(false);
  const [isDeletingManual, setIsDeletingManual] = useState(false);
  const [manuals, setManuals] = useState<JobManualRemote[]>([]);
  const [isLoadingManuals, setIsLoadingManuals] = useState(false);
  const [selectedManual, setSelectedManual] = useState<JobManualRemote | null>(null);
  const [isViewerVisible, setIsViewerVisible] = useState(false);
  const [viewSignature, setViewSignature] = useState<string | null>(null);
  const [isSigningManual, setIsSigningManual] = useState(false);

  const tituloRef = useRef('');
  const descripcionRef = useRef('');

  const [availablePuestos, setAvailablePuestos] = useState<Puesto[]>([]);
  const [selectedPuestos, setSelectedPuestos] = useState<number[]>([]);

  const [textFiles, setTextFiles] = useState<ManualFileLocal[]>([]);
  const [imageFiles, setImageFiles] = useState<ManualFileLocal[]>([]);
  const [audioFiles, setAudioFiles] = useState<ManualFileLocal[]>([]);
  const [videoFiles, setVideoFiles] = useState<ManualFileLocal[]>([]);

  const [firmaResponsable, setFirmaResponsable] = useState<FirmaData | null>(null);
  const [isGeneratingFirma, setIsGeneratingFirma] = useState(false);

  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  const { scanQR, QRScannerComponent } = useQRScanner();

  // Helpers para construir URLs de archivos en el servidor (similar a IncidentsScreen)
  const getManualImageUrl = (manualId: number, fileName: string) => {
    console.log("Accediendo a la imagen: ", fileName);
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) return '';
    return `${apiUrl}/api/job-manuals/${manualId}/get-image/${encodeURIComponent(fileName)}`;
  };

  const getManualAudioUrl = (manualId: number, fileName: string) => {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) return '';
    return `${apiUrl}/api/job-manuals/${manualId}/get-audio/${encodeURIComponent(fileName)}`;
  };

  const getManualVideoUrl = (manualId: number, fileName: string) => {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) return '';
    return `${apiUrl}/api/job-manuals/${manualId}/get-video/${encodeURIComponent(fileName)}`;
  };

  const buildFileUrl = (manualId: number | undefined, file: ManualFileRemote) => {
    // Si es registro offline (tiene id_local no vacío), usamos base64
    const hasLocalId = file.id_local !== undefined && file.id_local !== null && file.id_local !== '';
    if (hasLocalId && file.base64) {
      const mime = file.mimeType || (file.type ? `${file.type}/${file.extension || 'octet-stream'}` : `application/${file.extension || 'octet-stream'}`);
      return `data:${mime};base64,${file.base64}`;
    }

    // Para registros sincronizados, preferir siempre la API
    if (manualId) {
      if (file.type === 'image') return getManualImageUrl(manualId, file.name);
      if (file.type === 'audio') return getManualAudioUrl(manualId, file.name);
      if (file.type === 'video') return getManualVideoUrl(manualId, file.name);
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (apiUrl) return `${apiUrl}/api/job-manuals/${manualId}/get-file/${encodeURIComponent(file.name)}`;
    }

    // Último recurso: URL ya provista
    if (file.url) return file.url;

    return '';
  };

  const getRemoteFileDisplayName = (file: ManualFileRemote) => {
    const candidate = (file.original_name ?? '').trim();
    return candidate.length > 0 ? candidate : file.name;
  };

  const getConnectionStatus = async (): Promise<boolean> => {
    try {
      const networkState = await Network.getNetworkStateAsync();
      return networkState.isConnected === true && networkState.isInternetReachable === true;
    } catch (error) {
      console.error('Error checking network:', error);
      return false;
    }
  };

  const fetchCurrentMarca = useCallback(async () => {
    try {
      setIsLoading(true);
      const currentMarcaStr = await AsyncStorage.getItem('current_marca');
      if (!currentMarcaStr) {
        setHasMarca(false);
        setIsLoading(false);
        return;
      }

      const currentMarca = JSON.parse(currentMarcaStr);
      setHasMarca(true);
      setMarcaId(currentMarca.id);
      setPuestoActualNombre(currentMarca.puesto?.nombre || '');
      const role = currentMarca.roleDivision?.role?.nombre || null;
      setRoleName(role);

      // Cargar puestos por corpo para selección en formulario (similar a NotesScreen)
      const corpoId = currentMarca.corpo?.id;
      if (corpoId) {
        await fetchPuestosCorpo(corpoId);
      }

      // Cargar manuales para visualización
      await fetchManuals(currentMarca.id);
    } catch (error) {
      console.error('Error fetching current marca for job manuals:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchPuestosCorpo = async (corpoId: number) => {
    try {
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) {
        throw new Error('Server URL not configured');
      }

      const isConnected = await getConnectionStatus();

      if (isConnected) {
        let token = await AsyncStorage.getItem('access_token');
        if (!token) {
          const refreshed = await refreshAccessToken();
          if (!refreshed) {
            throw new Error('No authentication token found');
          }
          token = await AsyncStorage.getItem('access_token');
        }

        const response = await fetch(`${apiUrl}/api/puestos/corpo/${corpoId}`, {
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
            return fetchPuestosCorpo(corpoId);
          } else {
            await logout();
            return;
          }
        }

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const puestosData: Puesto[] = data?.puestos || [];
        setAvailablePuestos(puestosData);
        await AsyncStorage.setItem(`puestos_corpo_cache_${corpoId}`, JSON.stringify(puestosData));
      } else {
        const puestosCache = await AsyncStorage.getItem(`puestos_corpo_cache_${corpoId}`);
        if (puestosCache) {
          const cachedPuestos = JSON.parse(puestosCache);
          setAvailablePuestos(cachedPuestos);
        } else {
          setAvailablePuestos([]);
        }
      }
    } catch (error) {
      console.error('Error fetching puestos corpo for job manuals:', error);
    }
  };

  const fetchManuals = async (marcaIdToUse: number) => {
    try {
      setIsLoadingManuals(true);
      const isConnected = await getConnectionStatus();

      if (isConnected) {
        const result = await listJobManualsByMarca({
          marcaId: marcaIdToUse,
          refreshAccessToken,
          logout,
        });

        if (result.status && result.manuals) {
          setManuals(result.manuals as JobManualRemote[]);
          await AsyncStorage.setItem('job_manuals_cache', JSON.stringify(result.manuals));
        } else {
          setManuals([]);
        }
      } else {
        const cacheStr = await AsyncStorage.getItem('job_manuals_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          setManuals(cache);
        } else {
          setManuals([]);
        }
      }
    } catch (error) {
      console.error('Error fetching job manuals:', error);
      try {
        const cacheStr = await AsyncStorage.getItem('job_manuals_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          setManuals(cache);
        }
      } catch (cacheErr) {
        console.error('Error loading job manuals from cache:', cacheErr);
      }
    } finally {
      setIsLoadingManuals(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchCurrentMarca();
      const handler = () => {
        if (marcaId) {
          fetchManuals(marcaId);
        } else {
          fetchCurrentMarca();
        }
      };
      eventBus.on('connectionRestored', handler);
      return () => {
        eventBus.off('connectionRestored', handler);
      };
    }, [fetchCurrentMarca, marcaId])
  );

  useEffect(() => {
    // La ubicación se solicitará cuando se inicie la creación de un nuevo manual
  }, []);

  const handleMenuPress = () => {
    setIsMenuVisible(true);
  };

  const handleMenuClose = () => {
    setIsMenuVisible(false);
  };

  const handleHomePress = () => {
    navigation.navigate('Home');
  };

  const startCreating = () => {
    setIsCreating(true);
    tituloRef.current = '';
    descripcionRef.current = '';
    setSelectedPuestos([]);
    setTextFiles([]);
    setImageFiles([]);
    setAudioFiles([]);
    setVideoFiles([]);
    setFirmaResponsable(null);
    setLocation(null);

    // Solicitar permisos de ubicación y obtener la posición actual (similar a TrainingsScreen)
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Permiso de ubicación',
            'Se necesita permiso de ubicación para generar la firma del responsable.'
          );
          return;
        }
        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        setLocation({
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        });
      } catch (error) {
        console.error('Error getting location for job manuals:', error);
      }
    })();
  };

  const cancelCreating = () => {
    setIsCreating(false);
    // Limpiar formulario
    tituloRef.current = '';
    descripcionRef.current = '';
    setSelectedPuestos([]);
    setTextFiles([]);
    setImageFiles([]);
    setAudioFiles([]);
    setVideoFiles([]);
    setFirmaResponsable(null);
  };

  const togglePuestoSelection = (puestoId: number) => {
    setSelectedPuestos(prev => {
      if (prev.includes(puestoId)) {
        return prev.filter(id => id !== puestoId);
      }
      return [...prev, puestoId];
    });
  };

  const handleAddFile = async (type: ManualFileLocal['type']) => {
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
      
      // Convertir blob a base64 de forma segura
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

      const newFile: ManualFileLocal = {
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
      console.error('Error picking file for job manual:', error);
      Alert.alert('Error', 'No se pudo seleccionar el archivo. Intenta nuevamente.');
    }
  };

  const removeLocalFile = (type: ManualFileLocal['type'], id: string) => {
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

  const generateSignature = async () => {
    if (!employee) {
      Alert.alert('Error', 'No se pudo obtener la información del empleado');
      return;
    }

    if (!location) {
      Alert.alert('Error', 'No se pudo obtener la ubicación para generar la firma del responsable');
      return;
    }

    setIsGeneratingFirma(true);

    try {
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) {
        throw new Error('Server URL not configured');
      }

      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const decodedToken: any = jwtDecode(token);
      const sessionId = decodedToken.sessionId;

      const horaAccion = await getHoraAccion();
      if (!horaAccion) {
        throw new Error('Hora de acción not found');
      }

      const hash = btoa(
        sessionId +
          ':' +
          employee.id +
          ':' +
          location.latitude +
          ':' +
          location.longitude +
          ':' +
          horaAccion
      );

      const decodedHash = atob(hash);
      const [decodedSessionId, decodedEmpleadoId, decodedLatitud, decodedLongitud, decodedTimestamp] =
        decodedHash.split(':');

      let empleadoDetalle = undefined;
      const isConnected = await getConnectionStatus();
      if (isConnected) {
        const response = await fetch(`${apiUrl}/api/empleados/${decodedEmpleadoId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': '69420',
          },
        });

        if (response.ok) {
          const empleadoData = await response.json();
          empleadoDetalle = {
            nombre: empleadoData.nombre,
            primer_apellido: empleadoData.primer_apellido,
            segundo_apellido: empleadoData.segundo_apellido,
            cedula_empleado: empleadoData.cedula,
          };
        }
      }

      setFirmaResponsable({
        sessionId: decodedSessionId,
        empleadoId: decodedEmpleadoId,
        latitud: decodedLatitud,
        longitud: decodedLongitud,
        timestamp: decodedTimestamp,
        empleadoDetalle,
      });
    } catch (error) {
      console.error('Error generating signature for job manual:', error);
      Alert.alert('Error', 'No se pudo generar la firma');
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

      try {
        const decodedHash = atob(qrData);
        const parts = decodedHash.split(':');

        if (parts.length !== 5) {
          Alert.alert('Error', 'El QR no tiene la estructura esperada');
          return;
        }

        const [sessionId, empleadoId, latitud, longitud, timestamp] = parts;

        const hasConnection = await getConnectionStatus();
        let empleadoDetalle: FirmaData['empleadoDetalle'] | undefined = undefined;

        if (hasConnection) {
          const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
          if (!apiUrl) {
            throw new Error('Server URL not configured');
          }

          const token = await AsyncStorage.getItem('access_token');
          if (!token) {
            throw new Error('No authentication token found');
          }

          const response = await fetch(`${apiUrl}/api/empleados/${empleadoId}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'ngrok-skip-browser-warning': '69420',
            },
          });

          if (response.ok) {
            const empleadoData = await response.json();
            empleadoDetalle = {
              nombre: empleadoData.nombre,
              primer_apellido: empleadoData.primer_apellido,
              segundo_apellido: empleadoData.segundo_apellido,
              cedula_empleado: empleadoData.cedula,
            };
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
        console.error('Error decoding QR for job manual:', error);
        Alert.alert('Error', 'El QR escaneado no es válido');
      }
    } catch (error) {
      console.error('Error scanning QR for job manual:', error);
      Alert.alert('Error', 'No se pudo escanear el código QR');
    }
  };

  const handleCreateManual = async () => {
    try {
      if (!marcaId) {
        Alert.alert('Error', 'No se encontró la marca actual');
        return;
      }

      if (!tituloRef.current.trim()) {
        Alert.alert('Error', 'El título es obligatorio');
        return;
      }

      if (!descripcionRef.current.trim()) {
        Alert.alert('Error', 'La descripción es obligatoria');
        return;
      }

      if (!firmaResponsable) {
        Alert.alert('Error', 'La firma del responsable es obligatoria');
        return;
      }

      const puestosArray = selectedPuestos.length > 0 ? selectedPuestos : [];
      const filesPayload: ManualFileLocal[] = [
        ...textFiles,
        ...imageFiles,
        ...audioFiles,
        ...videoFiles,
      ];

      const signatureString = `${firmaResponsable.sessionId}:${firmaResponsable.empleadoId}:${firmaResponsable.latitud}:${firmaResponsable.longitud}:${firmaResponsable.timestamp}`;
      const signatureHash = btoa(signatureString);

      const requestBody = {
        title: tituloRef.current,
        description: descripcionRef.current,
        firma_responsable: signatureHash,
        puestos: JSON.stringify(puestosArray),
        files: JSON.stringify(
          filesPayload.map(f => ({
            type: f.type,
            original_name: f.name, // nombre real para mostrar en app (en el server se sigue usando name generado para serving)
            extension: f.extension,
            file_base64: f.base64,
          }))
        ),
      };

      setIsCreatingManual(true);

      const isConnected = await getConnectionStatus();

      if (isConnected) {
        const result = await createJobManual({
          requestData: requestBody,
          marcaId,
          refreshAccessToken,
          logout,
        });

        if (result.status) {
          // Limpiar formulario
          tituloRef.current = '';
          descripcionRef.current = '';
          setSelectedPuestos([]);
          setTextFiles([]);
          setImageFiles([]);
          setAudioFiles([]);
          setVideoFiles([]);
          setFirmaResponsable(null);
          
          // Cerrar formulario
          setIsCreating(false);
          
          // Recargar lista de manuales
          if (marcaId) {
            await fetchManuals(marcaId);
          }
          
          Alert.alert('Éxito', result.message || 'Manual creado correctamente');
        } else {
          Alert.alert('Error', result.message || 'No se pudo crear el manual');
        }
      } else {
        const localId = `local_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const actionsStr = await AsyncStorage.getItem('job_manuals_actions');
        const actions = actionsStr ? JSON.parse(actionsStr) : [];
        actions.push({
          requestData: requestBody,
          marcaId,
          id: localId,
          type: 'create',
        });
        await AsyncStorage.setItem('job_manuals_actions', JSON.stringify(actions));

        // Cache local de manuales con archivos en base64
        const cacheStr = await AsyncStorage.getItem('job_manuals_cache');
        const cache = cacheStr ? JSON.parse(cacheStr) : [];
        const horaAccionUse = await getHoraAccion();
        cache.push({
          id: 0,
          id_local: localId,
          title: tituloRef.current,
          description: descripcionRef.current,
          puesto: { id: 0, nombre: puestoActualNombre },
          created_by: employee?.id ? String(employee.id) : '-',
          created_at: new Date(horaAccionUse).toISOString(),
          files: filesPayload.map(f => ({
            id: Date.now() + Math.random(),
            id_local: `file_${localId}_${Math.random().toString(36).slice(2, 8)}`,
            type: f.type,
            extension: f.extension,
            name: f.name || `archivo.${f.extension || 'dat'}`,
            original_name: f.name,
            base64: f.base64,
            mimeType: f.mimeType,
            url: '',
          })),
          visualizaciones: [],
          currentEmployeeSigned: false,
          synced: false,
        });
        await AsyncStorage.setItem('job_manuals_cache', JSON.stringify(cache));

        Alert.alert('Modo Offline', 'Manual registrado localmente. Se sincronizará cuando haya conexión.');
        
        // Limpiar formulario
        tituloRef.current = '';
        descripcionRef.current = '';
        setSelectedPuestos([]);
        setTextFiles([]);
        setImageFiles([]);
        setAudioFiles([]);
        setVideoFiles([]);
        setFirmaResponsable(null);
        
        // Cerrar formulario
        setIsCreating(false);
        
        // Recargar lista de manuales (desde cache)
        if (marcaId) {
          await fetchManuals(marcaId);
        }
      }
    } catch (error) {
      console.error('Error creating job manual:', error);
      Alert.alert('Error', 'No se pudo crear el manual');
    } finally {
      setIsCreatingManual(false);
    }
  };

  const formatDateLabel = (iso: string) => {
    if (!iso) return '';
    const date_complete = new Date(Number(iso)).toISOString().split('T');
    const date = date_complete[0];
    const time = date_complete[1].split('.')[0];
    return `${date} ${time}`;
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.fullContainer}>
        <AppHeader onMenuPress={handleMenuPress} title="Manuales de puesto" />
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Cargando...</ThemedText>
        </ThemedView>
        <AppFooter />
        <SlideMenu
          isVisible={isMenuVisible}
          onClose={handleMenuClose}
          onHomePress={handleHomePress}
          currentRoute="JobManuals"
        />
      </ThemedView>
    );
  }

  if (!hasMarca) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText style={styles.noMarcaTitle}>No se encontró la marca actual</ThemedText>
        <ThemedText style={styles.noMarcaMessage}>
          Este módulo requiere una marca activa para mostrar los manuales de puesto disponibles.
        </ThemedText>
      </ThemedView>
    );
  }

  const canCreate = roleName === 'SUPERVISOR' || roleName === 'ADMINISTRATIVO';

  return (
    <ThemedView style={styles.fullContainer}>
      <AppHeader onMenuPress={handleMenuPress} title="Manuales de puesto" />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <ThemedView style={styles.contentContainer}>
          <ThemedView style={styles.titleContainer}>
            <ThemedText type="title" style={styles.title}>
              Manuales de puesto
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              Consulta y registra manuales asociados a tu puesto.
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.puestoContainer}>
            <ThemedText style={styles.puestoLabel}>Puesto actual:</ThemedText>
            <ThemedText style={styles.puestoName}>{puestoActualNombre || 'No disponible'}</ThemedText>
          </ThemedView>

          {!isCreating && (
            <TouchableOpacity style={styles.createButton} onPress={startCreating}>
              <Ionicons name="add-circle" size={20} color="#FFFFFF" />
              <ThemedText style={styles.createButtonText}>Crear nuevo manual</ThemedText>
            </TouchableOpacity>
          )}

          {isCreating && (
            <ThemedView style={styles.formCard}>
              <ThemedText style={styles.formTitle}>Nuevo manual de puesto</ThemedText>

              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Título *</ThemedText>
                <TextInput
                  style={styles.formInput}
                  defaultValue={tituloRef.current}
                  onChangeText={(text) => {
                    tituloRef.current = text;
                  }}
                  placeholder="Título del manual"
                  placeholderTextColor="#999"
                />
              </ThemedView>

              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Descripción *</ThemedText>
                <TextInput
                  style={[styles.formInput, styles.textArea]}
                  defaultValue={descripcionRef.current}
                  onChangeText={(text) => {
                    descripcionRef.current = text;
                  }}
                  placeholder="Descripción del manual"
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={4}
                />
              </ThemedView>

              {/* Selección de puestos */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Puestos que recibirán el manual:</ThemedText>
                {availablePuestos.length === 0 ? (
                  <ThemedText style={styles.emptyText}>
                    No hay puestos disponibles para este corpo.
                  </ThemedText>
                ) : (
                  <ThemedView style={styles.puestosList}>
                    {availablePuestos.map((puesto) => {
                      const isSelected = selectedPuestos.includes(puesto.id);
                      return (
                        <TouchableOpacity
                          key={puesto.id}
                          style={[
                            styles.puestoItem,
                            isSelected && styles.puestoItemSelected,
                          ]}
                          onPress={() => togglePuestoSelection(puesto.id)}
                        >
                          <ThemedText
                            style={[
                              styles.puestoItemText,
                              isSelected && styles.puestoItemTextSelected,
                            ]}
                          >
                            {puesto.nombre}
                          </ThemedText>
                        </TouchableOpacity>
                      );
                    })}
                  </ThemedView>
                )}
              </ThemedView>

              {/* Archivos por tipo - placeholders */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Archivos de texto</ThemedText>
                <TouchableOpacity
                  style={styles.addFileButton}
                  onPress={() => handleAddFile('document')}
                >
                  <Ionicons name="document-text-outline" size={18} color="#007AFF" />
                  <ThemedText style={styles.addFileButtonText}>Añadir archivo de texto</ThemedText>
                </TouchableOpacity>
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
                  <ThemedText style={styles.addFileButtonText}>Añadir imagen</ThemedText>
                </TouchableOpacity>
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
                  <ThemedText style={styles.addFileButtonText}>Añadir audio</ThemedText>
                </TouchableOpacity>
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
                  <ThemedText style={styles.addFileButtonText}>Añadir video</ThemedText>
                </TouchableOpacity>
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

              {/* Firma responsable */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Firma del responsable *</ThemedText>
                {!firmaResponsable ? (
                  <ThemedView style={styles.signatureButtons}>
                    <TouchableOpacity
                      style={styles.signatureButton}
                      onPress={generateSignature}
                      disabled={isGeneratingFirma}
                    >
                      {isGeneratingFirma ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons name="finger-print" size={18} color="#FFFFFF" />
                          <ThemedText style={styles.signatureButtonText}>Generar</ThemedText>
                        </>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.signatureButton}
                      onPress={handleScanQR}
                    >
                      <Ionicons name="qr-code-outline" size={18} color="#FFFFFF" />
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
                          {firmaResponsable.empleadoDetalle.nombre}{' '}
                          {firmaResponsable.empleadoDetalle.primer_apellido}{' '}
                          {firmaResponsable.empleadoDetalle.segundo_apellido}{' '}
                          ({firmaResponsable.empleadoDetalle.cedula_empleado})
                        </ThemedText>
                      </ThemedView>
                    )}
                    <ThemedText style={styles.signatureInfoText}>Latitud: {firmaResponsable.latitud}</ThemedText>
                    <ThemedText style={styles.signatureInfoText}>Longitud: {firmaResponsable.longitud}</ThemedText>
                    <ThemedText style={styles.signatureInfoText}>Fecha y hora: {formatDateLabel(firmaResponsable.timestamp)}</ThemedText>
                    <TouchableOpacity
                      style={styles.clearSignatureButton}
                      onPress={() => setFirmaResponsable(null)}
                    >
                      <ThemedText style={styles.clearSignatureText}>Limpiar</ThemedText>
                    </TouchableOpacity>
                  </ThemedView>
                )}
              </ThemedView>

              {/* Acciones del formulario */}
              <ThemedView style={styles.formActions}>
                <TouchableOpacity
                  style={[styles.formButton, styles.cancelButton]}
                  onPress={cancelCreating}
                >
                  <ThemedText style={styles.formButtonText}>Cancelar</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.formButton, styles.confirmButton, isCreatingManual && styles.formButtonDisabled]}
                  onPress={handleCreateManual}
                  disabled={isCreatingManual}
                >
                  {isCreatingManual ? (
                    <>
                      <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                      <ThemedText style={styles.formButtonText}>Creando manual...</ThemedText>
                    </>
                  ) : (
                    <ThemedText style={styles.formButtonText}>Guardar</ThemedText>
                  )}
                </TouchableOpacity>
              </ThemedView>
            </ThemedView>
          )}

          {/* Lista de manuales para todos los roles */}
          <ThemedView style={styles.listContainer}>
            {isLoadingManuals ? (
              <ThemedView style={styles.loadingManualsContainer}>
                <ActivityIndicator size="small" color="#007AFF" />
                <ThemedText style={styles.loadingText}>Cargando manuales...</ThemedText>
              </ThemedView>
            ) : manuals.length === 0 ? (
              <ThemedText style={styles.emptyText}>
                No hay manuales de puesto registrados para este puesto.
              </ThemedText>
            ) : (
              manuals.map((manual) => (
                <TouchableOpacity
                  key={manual.id || manual.id_local || `manual-${manual.title}`}
                  style={styles.manualCard}
                  onPress={() => {
                    setSelectedManual(manual);
                    setViewSignature(null);
                    setIsSigningManual(false);
                    setIsViewerVisible(true);
                  }}
                >
                  <ThemedText style={styles.manualTitle}>{manual.title}</ThemedText>
                  <ThemedText numberOfLines={2} style={styles.manualDescription}>
                    {manual.description}
                  </ThemedText>
                  <ThemedView style={styles.manualMetaRow}>
                    <ThemedText style={styles.manualMetaText}>
                      {manual.puesto?.nombre || puestoActualNombre}
                    </ThemedText>
                    <ThemedText style={styles.manualMetaText}>
                      {manual.files?.length || 0} archivo(s)
                    </ThemedText>
                  </ThemedView>
                </TouchableOpacity>
              ))
            )}
          </ThemedView>
        </ThemedView>
      </ScrollView>

      <AppFooter />

      <SlideMenu
        isVisible={isMenuVisible}
        onClose={handleMenuClose}
        onHomePress={handleHomePress}
        currentRoute="JobManuals"
      />

      {/* QR Scanner (reutilizable) */}
      {QRScannerComponent}

      {/* Modal de visualización de manual con audio y video */}
      <Modal
        visible={isViewerVisible && !!selectedManual}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setIsViewerVisible(false);
          setSelectedManual(null);
            setViewSignature(null);
            setIsSigningManual(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <ThemedView style={styles.viewerModalContainer}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle} numberOfLines={2}>
                {selectedManual?.title || 'Manual de puesto'}
              </ThemedText>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {selectedManual &&
                  String(selectedManual.created_by ?? '') === String(employee?.id ?? '') && (
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => {
                        if (!selectedManual) return;
                        Alert.alert(
                          'Eliminar manual',
                          '¿Estás seguro de eliminar este manual?',
                          [
                            { text: 'Cancelar', style: 'cancel' },
                            {
                              text: 'Eliminar',
                              style: 'destructive',
                              onPress: async () => {
                                try {
                                  setIsDeletingManual(true);
                                  const isConnected = await getConnectionStatus();

                                  // Si es local sin sincronizar, solo limpiar cache y acciones
                                  if (!selectedManual.id || selectedManual.id === 0 || selectedManual.id_local) {
                                    const actionsStr = await AsyncStorage.getItem('job_manuals_actions');
                                    const actions = actionsStr ? JSON.parse(actionsStr) : [];
                                    const filtered = actions.filter((a: any) => !(a.id === selectedManual.id_local && a.type === 'create'));
                                    await AsyncStorage.setItem('job_manuals_actions', JSON.stringify(filtered));

                                    const cacheStr = await AsyncStorage.getItem('job_manuals_cache');
                                    if (cacheStr) {
                                      const cache = JSON.parse(cacheStr);
                                      const updatedCache = cache.filter((m: any) => m.id_local !== selectedManual.id_local);
                                      await AsyncStorage.setItem('job_manuals_cache', JSON.stringify(updatedCache));
                                    }

                                    Alert.alert('Modo Offline', 'Manual local eliminado.');
                                    setIsViewerVisible(false);
                                    setSelectedManual(null);
                                    setViewSignature(null);
                                    setIsSigningManual(false);
                                    if (marcaId) {
                                      await fetchManuals(marcaId);
                                    }
                                    return;
                                  }

                                  if (isConnected) {
                                    const result = await deleteJobManual({
                                      id: selectedManual.id,
                                      refreshAccessToken,
                                      logout,
                                    });
                                    if (!result.status) {
                                      Alert.alert('Error', result.message || 'No se pudo eliminar el manual');
                                    } else {
                                      Alert.alert('Éxito', result.message || 'Manual eliminado');
                                      setIsViewerVisible(false);
                                      setSelectedManual(null);
                                      setViewSignature(null);
                                      setIsSigningManual(false);
                                      if (marcaId) {
                                        await fetchManuals(marcaId);
                                      }
                                    }
                                  } else {
                                    // Agendar acción de borrado
                                    const actionsStr = await AsyncStorage.getItem('job_manuals_actions');
                                    const actions = actionsStr ? JSON.parse(actionsStr) : [];
                                    actions.push({
                                      id: selectedManual.id,
                                      type: 'delete',
                                      marcaId,
                                    });
                                    await AsyncStorage.setItem('job_manuals_actions', JSON.stringify(actions));

                                    // Remover de cache para que no aparezca
                                    const cacheStr = await AsyncStorage.getItem('job_manuals_cache');
                                    if (cacheStr) {
                                      const cache = JSON.parse(cacheStr);
                                      const updatedCache = cache.filter((m: any) => m.id !== selectedManual.id);
                                      await AsyncStorage.setItem('job_manuals_cache', JSON.stringify(updatedCache));
                                    }

                                    Alert.alert('Modo Offline', 'Manual marcado para eliminación cuando haya conexión.');
                                    setIsViewerVisible(false);
                                    setSelectedManual(null);
                                    setViewSignature(null);
                                    setIsSigningManual(false);
                                  }
                                } catch (error) {
                                  console.error('Error deleting manual:', error);
                                  Alert.alert('Error', 'No se pudo eliminar el manual');
                                } finally {
                                  setIsDeletingManual(false);
                                }
                              },
                            },
                          ]
                        );
                      }}
                      disabled={isDeletingManual}
                    >
                      {isDeletingManual ? (
                        <ActivityIndicator size="small" color="#FF3B30" />
                      ) : (
                        <Ionicons name="trash" size={22} color="#FF3B30" />
                      )}
                    </TouchableOpacity>
                  )}
                <TouchableOpacity
                  onPress={() => {
                    setIsViewerVisible(false);
                    setSelectedManual(null);
                  }}
                >
                  <Ionicons name="close" size={24} color="#666666" />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView 
              style={styles.modalContent}
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={true}
            >
              {selectedManual?.description ? (
                <ThemedText style={styles.viewerDescription}>
                  {selectedManual.description}
                </ThemedText>
              ) : null}

              {/* Firmas registradas (solo supervisores / administrativos) */}
              {(selectedManual?.visualizaciones?.length ?? 0) > 0 &&
                (roleName === 'SUPERVISOR' || roleName === 'ADMINISTRATIVO') && (
                  <ThemedView style={styles.viewerSection}>
                    <ThemedText style={styles.viewerSectionTitle}>Firmas registradas</ThemedText>
                    {selectedManual?.visualizaciones?.map(firma => (
                      <ThemedView key={firma.id} style={styles.signatureListRow}>
                        <Ionicons name="person-circle-outline" size={20} color="#007AFF" />
                        <ThemedText style={styles.signatureListName}>
                          {firma.nombre_empleado || 'Empleado'}
                        </ThemedText>
                        <ThemedText style={styles.signatureListDate}>
                          {firma.created_at ? new Date(firma.created_at).toLocaleString() : ''}
                        </ThemedText>
                      </ThemedView>
                    ))}
                  </ThemedView>
                )}

              {/* Imágenes */}
              {selectedManual?.files?.some(f => f.type === 'image') && selectedManual && (
                <ThemedView style={styles.viewerSection}>
                  <ThemedText style={styles.viewerSectionTitle}>Imágenes</ThemedText>
                  {selectedManual.files
                    .filter(f => f.type === 'image')
                    .map(file => (
                      <ManualImageViewer
                        key={file.id}
                        imageUrl={buildFileUrl(selectedManual.id, file)}
                      />
                    ))}
                </ThemedView>
              )}

              {/* Audio */}
              {selectedManual?.files?.some(f => f.type === 'audio') && selectedManual && (
                <ThemedView style={styles.viewerSection}>
                  <ThemedText style={styles.viewerSectionTitle}>Audios</ThemedText>
                  {selectedManual.files
                    .filter(f => f.type === 'audio')
                    .map(file => (
                      <ManualAudioPlayer
                        key={file.id}
                        sourceUrl={buildFileUrl(selectedManual.id, file)}
                        label={getRemoteFileDisplayName(file)}
                      />
                    ))}
                </ThemedView>
              )}

              {/* Video */}
              {selectedManual?.files?.some(f => f.type === 'video') && selectedManual && (
                <ThemedView style={styles.viewerSection}>
                  <ThemedText style={styles.viewerSectionTitle}>Videos</ThemedText>
                  {selectedManual.files
                    .filter(f => f.type === 'video')
                    .map(file => (
                      <ManualVideoPlayer
                        key={file.id}
                        sourceUrl={buildFileUrl(selectedManual.id, file)}
                      />
                    ))}
                </ThemedView>
              )}

              {/* Documentos / texto descargable */}
              {selectedManual?.files?.some(f => f.type === 'document') && (
                <ThemedView style={styles.viewerSection}>
                  <ThemedText style={styles.viewerSectionTitle}>Documentos</ThemedText>
                  {selectedManual.files
                    .filter(f => f.type === 'document')
                    .map(file => (
                      <TouchableOpacity
                        key={file.id}
                        style={styles.documentRow}
                        onPress={() => {
                          const url = buildFileUrl(selectedManual.id, file);
                          if (url) {
                            Linking.openURL(url);
                          } else {
                            Alert.alert('Error', 'URL inválida para descargar el archivo');
                          }
                        }}
                      >
                        <Ionicons name="document-text-outline" size={20} color="#007AFF" />
                        <ThemedText numberOfLines={1} style={styles.documentText}>
                          {getRemoteFileDisplayName(file)}
                        </ThemedText>
                      </TouchableOpacity>
                    ))}
                </ThemedView>
              )}

              {/* Firma de visualización - al final de la lista */}
              {selectedManual && !selectedManual.currentEmployeeSigned && (
                <ThemedView style={styles.viewerSection}>
                  <ThemedText style={styles.viewerSectionTitle}>Confirmar visualización</ThemedText>
                  {!viewSignature ? (
                    <TouchableOpacity
                      style={styles.signatureActionButton}
                      onPress={async () => {
                        const horaAccionUse = await getHoraAccion();
                        const timestamp = new Date(horaAccionUse).toISOString();
                        const hash = btoa(`${employee?.id || 'emp'}:${timestamp}`);
                        setViewSignature(hash);
                      }}
                    >
                      <Ionicons name="finger-print" size={18} color="#FFFFFF" />
                      <ThemedText style={styles.signatureActionText}>Generar firma</ThemedText>
                    </TouchableOpacity>
                  ) : (
                    <ThemedView style={styles.signatureRow}>
                      <ThemedText style={styles.signatureText}>Firma lista</ThemedText>
                      <TouchableOpacity
                        style={[styles.signatureActionButton, isSigningManual && styles.formButtonDisabled]}
                        onPress={async () => {
                          if (!selectedManual || !viewSignature) return;
                          const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
                          if (!apiUrl) {
                            Alert.alert('Error', 'URL del servidor no configurada');
                            return;
                          }
                          try {
                            setIsSigningManual(true);
                            // Si el manual no tiene ID de servidor, no se puede firmar
                            if (!selectedManual.id || selectedManual.id === 0) {
                              Alert.alert('Offline', 'Primero sincroniza el manual para poder firmarlo.');
                              return;
                            }

                            if (!marcaId) {
                              Alert.alert('Error', 'No se encontró la marca actual');
                              return;
                            }

                            const isConnected = await getConnectionStatus();

                            if (isConnected) {
                              const result = await signJobManual({
                                id: selectedManual.id,
                                firma: viewSignature,
                                refreshAccessToken,
                                logout,
                                marcaId,
                              });

                              if (!result.status) {
                                throw new Error(result.message || 'No se pudo firmar el manual');
                              }
                            } else {
                              // Guardar acción offline
                              const actionsStr = await AsyncStorage.getItem('job_manuals_actions');
                              const actions = actionsStr ? JSON.parse(actionsStr) : [];
                              actions.push({
                                id: selectedManual.id,
                                type: 'sign',
                                firma: viewSignature,
                                marcaId,
                              });
                              await AsyncStorage.setItem('job_manuals_actions', JSON.stringify(actions));
                            }

                            const horaAccionUse = await getHoraAccion();

                            // Actualizar estado local y cache
                            const newVisualizacion = {
                              id: Date.now(),
                              empleado_id: typeof employee?.id === 'number' ? employee.id : Number(employee?.id || 0),
                              manual_puesto_id: selectedManual.id,
                              nombre_empleado: employee?.name || 'Empleado',
                              firma_empleado: viewSignature,
                              created_at: new Date(horaAccionUse).toISOString(),
                            };

                            setSelectedManual(prev => {
                              if (!prev) return prev;
                              return {
                                ...prev,
                                currentEmployeeSigned: true,
                                visualizaciones: [...(prev.visualizaciones || []), newVisualizacion],
                              };
                            });

                            const cacheStr = await AsyncStorage.getItem('job_manuals_cache');
                            if (cacheStr) {
                              const cache = JSON.parse(cacheStr);
                              const updatedCache = cache.map((item: any) => {
                                if (item.id === selectedManual.id) {
                                  const visualizaciones = item.visualizaciones || [];
                                  return {
                                    ...item,
                                    currentEmployeeSigned: true,
                                    visualizaciones: [...visualizaciones, newVisualizacion],
                                  };
                                }
                                return item;
                              });
                              await AsyncStorage.setItem('job_manuals_cache', JSON.stringify(updatedCache));
                            }

                            Alert.alert('Éxito', isConnected ? 'Manual firmado correctamente' : 'Firma registrada en modo offline');
                          } catch (error) {
                            console.error('Error signing manual:', error);
                            Alert.alert('Error', 'No se pudo firmar el manual');
                          } finally {
                            setIsSigningManual(false);
                            setViewSignature(null);
                          }
                        }}
                        disabled={isSigningManual}
                      >
                        {isSigningManual ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                        )}
                        <ThemedText style={styles.signatureActionText}>
                          {isSigningManual ? 'Firmando...' : 'Confirmar visualización'}
                        </ThemedText>
                      </TouchableOpacity>
                    </ThemedView>
                  )}
                </ThemedView>
              )}
            </ScrollView>
          </ThemedView>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fullContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    opacity: 0.7,
  },
  noMarcaTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  noMarcaMessage: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
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
  puestoContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    width: '100%',
  },
  puestoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  puestoName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 20,
    gap: 8,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  formCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginBottom: 24,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    color: '#000000',
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: '#FFFFFF',
    color: '#000000',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  puestosList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  puestoItem: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  puestoItemSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  puestoItemText: {
    fontSize: 12,
    color: '#333',
  },
  puestoItemTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
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
  filesList: {
    marginTop: 8,
    gap: 6,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  signatureButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  signatureButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  signatureButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  signatureInfo: {
    backgroundColor: '#F0F4FF',
    borderRadius: 8,
    padding: 12,
    gap: 4,
  },
  signatureInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  signatureInfoText: {
    fontSize: 12,
    color: '#333',
  },
  signatureInfoDetail: {
    marginTop: 4,
  },
  signatureInfoDetailText: {
    fontSize: 12,
    fontWeight: '600',
  },
  clearSignatureButton: {
    marginTop: 8,
    alignSelf: 'flex-end',
  },
  clearSignatureText: {
    fontSize: 12,
    color: '#FF3B30',
    fontWeight: '600',
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8,
  },
  formButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  cancelButton: {
    backgroundColor: '#FF3B30',
  },
  formButtonDisabled: {
    opacity: 0.6,
  },
  confirmButton: {
    backgroundColor: '#34C759',
  },
  formButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    opacity: 0.6,
  },
  listContainer: {
    marginTop: 8,
    marginBottom: 24,
    gap: 12,
  },
  loadingManualsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  manualCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    padding: 12,
  },
  manualTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  manualDescription: {
    fontSize: 13,
    color: '#555555',
    marginBottom: 8,
  },
  manualMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  manualMetaText: {
    fontSize: 12,
    color: '#777777',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  viewerModalContainer: {
    width: '100%',
    maxWidth: 600,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 8,
  },
  modalContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  viewerDescription: {
    fontSize: 14,
    marginTop: 8,
    marginBottom: 12,
    color: '#333333',
  },
  viewerSection: {
    marginTop: 12,
    marginBottom: 8,
    overflow: 'hidden',
  },
  viewerSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
  },
  viewerImage: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#F0F0F0',
  },
  documentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  documentText: {
    flex: 1,
    fontSize: 13,
    color: '#007AFF',
  },
  signatureActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 6,
  },
  signatureActionText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  signatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
  },
  signatureText: {
    flex: 1,
    fontSize: 13,
    color: '#333333',
  },
  signatureListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  signatureListName: {
    flex: 1,
    fontSize: 13,
    color: '#333333',
  },
  signatureListDate: {
    fontSize: 12,
    color: '#777777',
  },
  deleteButton: {
    padding: 6,
  },
  audioPlayerContainer: {
    marginVertical: 12,
    backgroundColor: '#fff',
  },
  audioLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#000000',
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
    backgroundColor: '#007AFF',
  },
});

// Audio player for manuals (similar to VoiceNotesScreen)
function ManualAudioPlayer({ sourceUrl, label }: { sourceUrl: string; label?: string }) {
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
    // Sincronizar estado de reproducción con el estado del player
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
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={24}
            color="#007AFF"
          />
        </TouchableOpacity>
        <ThemedText style={styles.audioTime}>
          {formatTime(position)} / {formatTime(duration)}
        </ThemedText>
        <TouchableOpacity
          style={styles.resetAudioButton}
          onPress={resetAudio}
        >
          <Ionicons
            name="refresh"
            size={24}
            color="#FFFFFF"
          />
        </TouchableOpacity>
      </ThemedView>
    </ThemedView>
  );
}

// Image viewer that adjusts container based on image dimensions
function ManualImageViewer({ imageUrl }: { imageUrl: string }) {
  const [containerStyle, setContainerStyle] = useState<any>(styles.viewerImage);
  const maxContainerWidth = Dimensions.get('window').width - 64; // Ancho máximo del contenedor (pantalla - padding del modal)

  const handleImageLoad = (event: any) => {
    const { width, height } = event.nativeEvent.source;
    if (width && height) {
      const aspectRatio = width / height;
      let containerWidth = maxContainerWidth;
      let containerHeight: number;

      // Calcular dimensiones del contenedor basándose en las dimensiones reales de la imagen
      if (height > width) {
        // Imagen vertical: usar ancho completo disponible y calcular altura proporcional
        containerHeight = (maxContainerWidth / aspectRatio);
        // Limitar altura máxima
        if (containerHeight > 600) {
          containerHeight = 600;
          containerWidth = containerHeight * aspectRatio;
        }
      } else {
        // Imagen horizontal: ajustar ancho al tamaño real de la imagen (sin exceder el máximo)
        containerWidth = Math.min(maxContainerWidth, width);
        containerHeight = containerWidth / aspectRatio;
        // Si la altura calculada es muy pequeña, usar altura mínima y ajustar ancho
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
        alignSelf: 'center', // Centrar el contenedor
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

// Video player for manuals using expo-video (sin controles externos, solo VideoView con controles nativos)
function ManualVideoPlayer({ sourceUrl }: { sourceUrl: string }) {
  const player = useVideoPlayer(sourceUrl);
  const maxContainerWidth = Dimensions.get('window').width - 64; // Ancho máximo del contenedor (pantalla - padding del modal)

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


