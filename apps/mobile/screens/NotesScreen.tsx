import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Modal, View, Platform, Image } from 'react-native';
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
import { createNote as createNoteAPI, updateNote as updateNoteAPI } from '@/hooks/notesFunctions';
import getHoraAccion from '@/hooks/getHoraAccion';
import { eventBus } from '@/hooks/eventBus';
import authedFetch from '@/hooks/authedFetch';
import SignatureScreen from 'react-native-signature-canvas';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useQRScanner } from '@/hooks/useQRScanner';
import * as Location from 'expo-location';
import { jwtDecode } from 'jwt-decode';

type NotesScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Notes'>;

interface CurrentMarca {
  id: number;
  hora_entrada_digitada: string | null;
  hora_salida_digitada: string | null;
  hora_inicio: string;
  hora_fin: string;
  fecha: string;
  tipo_turno: string;
  horas_duracion: number;
  roleDivision?: {
    role: {
      id: number;
      nombre: string;
    };
    division: {
      id: number;
      nombre: string;
    };
  };
  empresa: {
    id: number;
    nombre: string;
  };
  cliente: {
    id: number;
    nombre: string;
  };
  contrato: {
    id: number;
    nombre: string;
  };
  corpo: {
    id: number;
    nombre: string;
    ubicacion: {
      lat: number | null;
      lng: number | null;
    }
  };
  puesto: {
    id: number;
    nombre: string;
    tiene_relevo: boolean;
  };
  plaza: {
    id: number;
    nombre: string;
  };
  horario: {
    id: number;
    nombre: string;
  };
}

interface Note {
  id: number;
  puesto_id: number;
  titulo: string;
  description: string;
  division: string | null;
  categoria_id: number | null;
  relevancia: string | null;
  empleado: string;
  creador?: string;
  is_modified?: boolean;
  firma_responsable?: string;
  firma_manual_responsable?: string | null;
  images?: Array<{ id?: number; name?: string; base64?: string; extension?: string; url?: string }>;
  updated_at: string;
  id_local: string;
}

interface EditingNote {
  id: number | null;
  id_local: string;
  titulo: string;
  description: string;
  division: string | null;
  categoria_id: number | null;
  relevancia: 'Baja' | 'Media' | 'Alta';
}

type CambiosAppsModulesRow = {
  id: number;
  nombre_tabla: string;
  registro_id: number;
  cambios: string;
  created_at: string;
  created_by: number;
  empleado_nombre: string | null;
  empleado_cedula: string | null;
};

interface Puesto {
  id: number;
  nombre: string;
}

interface Category {
  id: number;
  nombre: string;
}

type MainStructurePuestoNode = { id: number; nombre: string };
type MainStructureSucursalNode = { id: number; nombre: string; puestos: MainStructurePuestoNode[] };
type MainStructureContratoNode = { id: number; nombre: string; sucursales: MainStructureSucursalNode[] };
type MainStructureDivisionNode = { id: number; nombre: string; contratos: MainStructureContratoNode[] };
type MainStructureClienteNode = { id: number; nombre: string; division: MainStructureDivisionNode[] };
type MainStructureEmpresaNode = { id: number; nombre: string; clientes: MainStructureClienteNode[] };
type MainStructureTree = MainStructureEmpresaNode[];

const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export default function NotesScreen() {
  const { employee, refreshAccessToken, logout, accessToken } = useAuth();
  const { scanQR, QRScannerComponent } = useQRScanner();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<NotesScreenNavigationProp>();

  // Notes state
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Importante: "sin internet" NO cuenta como error (solo es un estado informativo)
  const [offlineMessage, setOfflineMessage] = useState<string | null>(null);
  const [puesto, setPuesto] = useState<Puesto | null>(null);
  const [hasCurrentMarca, setHasCurrentMarca] = useState<boolean>(false);

  // Expanded notes state
  const [expandedNotes, setExpandedNotes] = useState<Set<number>>(new Set());

  // Current marca state
  const [currentMarca, setCurrentMarca] = useState<CurrentMarca | null>(null);

  // Editing state
  const [editingNote, setEditingNote] = useState<EditingNote | null>(null);

  // Creating state
  const [isCreating, setIsCreating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResponse, setSubmitResponse] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [newNote, setNewNote] = useState<EditingNote>({
    id: null,
    id_local: '',
    titulo: '',
    description: '',
    division: null,
    categoria_id: null,
    relevancia: 'Baja',
  });

  // Form refs for text inputs
  const tituloRef = useRef('');
  const descriptionRef = useRef('');

  // Filters state
  const [searchText, setSearchText] = useState('');
  const [selectedDivision, setSelectedDivision] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<number | string>('all');
  const [selectedRelevancia, setSelectedRelevancia] = useState<string>('all');
  const [empleadoFilter, setEmpleadoFilter] = useState('');
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);

  // Changes modal state
  const [isChangesModalVisible, setIsChangesModalVisible] = useState(false);
  const [cambiosItems, setCambiosItems] = useState<CambiosAppsModulesRow[]>([]);
  const [isLoadingCambios, setIsLoadingCambios] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
  const [expandedCambioId, setExpandedCambioId] = useState<number | null>(null);

  // Divisions from employee roles
  const [divisions, setDivisions] = useState<string[]>([]);

  // Categories state
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);

  // Puestos corpo state
  const [puestosCorpo, setPuestosCorpo] = useState<Puesto[]>([]);
  const [selectedPuestos, setSelectedPuestos] = useState<number[]>([]);
  const [isLoadingPuestos, setIsLoadingPuestos] = useState(false);

  // Firmas e imágenes
  const [firmaResponsableHash, setFirmaResponsableHash] = useState('');
  const [isGeneratingFirmaResponsable, setIsGeneratingFirmaResponsable] = useState(false);
  const [firmaManualResponsable, setFirmaManualResponsable] = useState<string | null>(null);
  const [signatureModalVisible, setSignatureModalVisible] = useState(false);
  const signatureRef = useRef<any>(null);
  const [signatureKey, setSignatureKey] = useState(0);
  const [images, setImages] = useState<Array<{ id?: number; name?: string; base64?: string; extension?: string; url?: string }>>([]);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const [isImagePreviewVisible, setIsImagePreviewVisible] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

  // Enviar notas al cliente
  const [mainStructure, setMainStructure] = useState<MainStructureTree>([]);
  const [isSendNotesModalVisible, setIsSendNotesModalVisible] = useState(false);
  const [sendEmpresaId, setSendEmpresaId] = useState<number | null>(null);
  const [sendClienteId, setSendClienteId] = useState<number | null>(null);
  const [sendDivisionId, setSendDivisionId] = useState<number | null>(null);
  const [sendContratoId, setSendContratoId] = useState<number | null>(null);
  const [sendSucursalId, setSendSucursalId] = useState<number | null>(null);
  const [sendPuestoId, setSendPuestoId] = useState<number | null>(null);
  const [sendEmail, setSendEmail] = useState('');
  const [sendNotesPreview, setSendNotesPreview] = useState<Note[]>([]);
  const [isLoadingSendPreview, setIsLoadingSendPreview] = useState(false);
  const [imageAccessToken, setImageAccessToken] = useState<string | null>(null);
  const [expandedSendPreviewIds, setExpandedSendPreviewIds] = useState<Set<number>>(new Set());


  useEffect(() => {
    if (employee?.roles) {
      const uniqueDivisions = Array.from(
        new Set(employee.roles.map(role => role.division.name))
      );
      setDivisions(uniqueDivisions);
    }
  }, [employee]);

  useEffect(() => {
    const loadImageToken = async () => {
      try {
        const token = accessToken || await AsyncStorage.getItem('access_token');
        setImageAccessToken(token || null);
      } catch {
        setImageAccessToken(accessToken || null);
      }
    };
    loadImageToken();
  }, [accessToken]);

  useFocusEffect(
    useCallback(() => {
      fetchNotes();
      fetchCategories();
      fetchPuestosCorpo();
      loadMainStructureCache();
    }, [])
  );

  useEffect(() => {
    const handler = () => {
      Promise.all([
        fetchNotes(),
        fetchCategories(),
        fetchPuestosCorpo(),
        loadMainStructureCache(),
      ]);
    };

    eventBus.on('connectionRestored', handler);
    return () => {
      eventBus.off('connectionRestored', handler);
    };
  }, []);

  // Función auxiliar para generar ID aleatorio
  const generateRandomId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 10; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  // Función para verificar conectividad
  const getConnectionStatus = async () => {
    const networkState = await Network.getNetworkStateAsync();
    if (!networkState.isConnected) return false;
    if (networkState.isInternetReachable === false) return false;
    return true;
  };

  const isProbablyNetworkError = (err: any) => {
    const msg = String(err?.message ?? err ?? '').toLowerCase();
    // RN / fetch típicamente: "Network request failed"
    return (
      msg.includes('network request failed') ||
      msg.includes('failed to fetch') ||
      msg.includes('networkerror') ||
      msg.includes('timeout') ||
      msg.includes('timed out')
    );
  };

  const appendTokenToUrl = (url?: string | null) => {
    const raw = String(url || '').trim();
    if (!raw) return '';
    const token = accessToken || imageAccessToken;
    if (!token) return raw;
    return `${raw}${raw.includes('?') ? '&' : '?'}token=${encodeURIComponent(String(token))}`;
  };

  const buildNoteImageApiUrl = (
    puestoId: number | null | undefined,
    noteId: number | null | undefined,
    imageName?: string | null
  ) => {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl || !puestoId || !noteId || !imageName) return '';
    return `${apiUrl}/api/puestos/${puestoId}/notas/${noteId}/get-image/${encodeURIComponent(String(imageName))}`;
  };

  const resolveNoteImageUri = (
    image: { base64?: string; url?: string; name?: string },
    noteId: number | null | undefined,
    puestoId: number | null | undefined
  ) => {
    if (image.base64) return image.base64;
    const builtUrl = buildNoteImageApiUrl(puestoId, noteId, image.name || null);
    if (builtUrl) return appendTokenToUrl(builtUrl);
    return appendTokenToUrl(image.url || '');
  };

  const mergeNotesBase64FromCache = (freshNotes: any[], cachedNotes: any[]) => {
    const cachedById = new Map<number, any>(
      (Array.isArray(cachedNotes) ? cachedNotes : [])
        .filter((n: any) => Number.isFinite(Number(n?.id)))
        .map((n: any) => [Number(n.id), n])
    );

    return (Array.isArray(freshNotes) ? freshNotes : []).map((note: any) => {
      const cached = cachedById.get(Number(note?.id));
      if (!cached) return note;

      const cachedImagesByName = new Map<string, any>(
        (Array.isArray(cached.images) ? cached.images : [])
          .filter((img: any) => img?.name)
          .map((img: any) => [String(img.name), img])
      );

      const mergedImages = (Array.isArray(note.images) ? note.images : []).map((img: any) => {
        const fromCache = img?.name ? cachedImagesByName.get(String(img.name)) : null;
        if (fromCache?.base64 && !img?.base64) {
          return { ...img, base64: fromCache.base64 };
        }
        return img;
      });

      return { ...note, images: mergedImages };
    });
  };

  const decodeFirmaHash = (hash?: string | null) => {
    if (!hash) return null;
    try {
      const decoded = atob(String(hash));
      const parts = decoded.split(':');
      if (parts.length !== 5) return null;
      const [sessionId, empleadoId, latitud, longitud, timestamp] = parts;
      return { sessionId, empleadoId, latitud, longitud, timestamp };
    } catch {
      return null;
    }
  };

  const generateFirmaHashForCurrentUser = async (): Promise<string | null> => {
    try {
      if (!employee) {
        Alert.alert('Error', 'No se pudo obtener la información del empleado');
        return null;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'Se necesita permiso de ubicación para generar la firma');
        return null;
      }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        Alert.alert('Error', 'No se pudo obtener el token de sesión');
        return null;
      }
      const decoded: any = jwtDecode(token);
      const sessionId = decoded.sessionId || 'unknown';
      const timestamp = await getHoraAccion();
      if (!timestamp) {
        Alert.alert('Error', 'No se pudo obtener la hora');
        return null;
      }
      const { latitude, longitude } = location.coords;
      return btoa(`${sessionId}:${String(employee.id)}:${latitude}:${longitude}:${timestamp}`);
    } catch (e) {
      console.error('Error generating firma_responsable:', e);
      return null;
    }
  };

  const handleGenerateFirmaResponsable = async () => {
    try {
      setIsGeneratingFirmaResponsable(true);
      const hash = await generateFirmaHashForCurrentUser();
      if (!hash) return;
      setFirmaResponsableHash(hash);
    } finally {
      setIsGeneratingFirmaResponsable(false);
    }
  };

  const handleScanFirmaResponsable = async () => {
    try {
      const qrData = await scanQR();
      if (!qrData) return;
      const decoded = decodeFirmaHash(qrData);
      if (!decoded) {
        Alert.alert('Error', 'El QR escaneado no tiene el formato correcto');
        return;
      }
      setFirmaResponsableHash(qrData);
    } catch (e) {
      console.error('Error scanning firma_responsable:', e);
      Alert.alert('Error', 'No se pudo escanear el código QR');
    }
  };

  const openManualSignatureModal = () => {
    setSignatureKey((prev) => prev + 1);
    setSignatureModalVisible(true);
  };

  const acceptManualSignature = () => {
    if (signatureRef.current?.readSignature) {
      signatureRef.current.readSignature();
      return;
    }
    Alert.alert('Error', 'Debe dibujar una firma antes de aceptar');
  };

  const handleManualSignatureRead = (signature: string) => {
    if (!signature) {
      Alert.alert('Error', 'No se pudo obtener la firma.');
      return;
    }
    const formatted = signature.startsWith('data:') ? signature : `data:image/png;base64,${signature}`;
    setFirmaManualResponsable(formatted);
    setSignatureModalVisible(false);
  };

  const onManualSignatureEmpty = () => Alert.alert('Error', 'La firma está vacía');

  const openCamera = async () => {
    try {
      if (!cameraPermission?.granted) {
        const result = await requestCameraPermission();
        if (!result.granted) {
          Alert.alert('Permiso denegado', 'Se necesita permiso para usar la cámara');
          return;
        }
      }
      setIsCameraVisible(true);
    } catch (e) {
      console.error('Error opening camera:', e);
      Alert.alert('Error', 'No se pudo abrir la cámara');
    }
  };

  const capturePhoto = async () => {
    if (!cameraRef.current) {
      Alert.alert('Error', 'La cámara no está lista');
      return;
    }
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.7,
        skipProcessing: false,
      });
      if (!photo?.base64) {
        Alert.alert('Error', 'No se pudo capturar la foto');
        setIsCameraVisible(false);
        return;
      }
      setIsCameraVisible(false);
      setImages((prev) => [...prev, { base64: `data:image/jpeg;base64,${photo.base64}`, extension: 'jpg' }]);
    } catch (e) {
      console.error('Error capturing photo:', e);
      Alert.alert('Error', 'No se pudo capturar la foto');
      setIsCameraVisible(false);
    }
  };

  const removeImage = (index: number) => {
    Alert.alert('Confirmar', '¿Eliminar esta foto?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => setImages((prev) => prev.filter((_, i) => i !== index)) },
    ]);
  };

  const buildImagenesJson = () =>
    JSON.stringify(
      images
        .filter((img) => Boolean(img.base64))
        .map((img, idx) => ({
          file_base64: img.base64 || '',
          extension: img.extension || 'jpg',
          original_name: img.name || `note-${Date.now()}-${idx + 1}.jpg`,
        }))
    );

  const formatDateDMY = (date: Date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear());
    return `${day}-${month}-${year}`;
  };

  const fetchCategories = async () => {
    try {
      setIsLoadingCategories(true);

      // Verificar conectividad
      const isConnected = await getConnectionStatus();

      if (isConnected) {
        // Con internet: hacer fetch normal
        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) {
          throw new Error('Server URL not configured');
        }
        const response = await authedFetch({
          url: `${apiUrl}/api/categories`,
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

        if (data.status) {
          setCategories(data.categories || []);
          // Actualizar categories_cache
          await AsyncStorage.setItem('categories_cache', JSON.stringify(data.categories || []));
        } else {
          console.error('Error loading categories:', data.message);
        }
      } else {
        // Sin internet: cargar desde cache
        const categoriesCache = await AsyncStorage.getItem('categories_cache');
        if (categoriesCache) {
          const cachedCategories = JSON.parse(categoriesCache);
          setCategories(cachedCategories);
        } else {
          setCategories([]);
        }
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
      // En caso de error, intentar cargar desde cache
      try {
        const categoriesCache = await AsyncStorage.getItem('categories_cache');
        if (categoriesCache) {
          const cachedCategories = JSON.parse(categoriesCache);
          setCategories(cachedCategories);
        }
      } catch (cacheErr) {
        console.error('Error loading categories from cache:', cacheErr);
      }
    } finally {
      setIsLoadingCategories(false);
    }
  };

  const fetchPuestosCorpo = async () => {
    try {
      setIsLoadingPuestos(true);

      // Verificar si existe current_marca
      const currentMarca = await AsyncStorage.getItem('current_marca');
      if (!currentMarca) {
        setPuestosCorpo([]);
        setIsLoadingPuestos(false);
        return;
      }

      const currentMarcaData = JSON.parse(currentMarca);
      if (!currentMarcaData?.corpo?.id) {
        setPuestosCorpo([]);
        setIsLoadingPuestos(false);
        return;
      }

      const corpoId = currentMarcaData.corpo.id;

      // Verificar conectividad
      const isConnected = await getConnectionStatus();

      if (isConnected) {
        // Con internet: hacer fetch normal
        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) {
          throw new Error('Server URL not configured');
        }
        const response = await authedFetch({
          url: `${apiUrl}/api/puestos/corpo/${corpoId}`,
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

        if (data.status && data.puestos) {
          setPuestosCorpo(data.puestos || []);
          // Actualizar puestos_corpo_cache
          await AsyncStorage.setItem(`puestos_corpo_cache_${corpoId}`, JSON.stringify(data.puestos || []));
        } else {
          console.error('Error loading puestos:', data.message);
        }
      } else {
        // Sin internet: cargar desde cache
        const puestosCache = await AsyncStorage.getItem(`puestos_corpo_cache_${corpoId}`);
        if (puestosCache) {
          const cachedPuestos = JSON.parse(puestosCache);
          setPuestosCorpo(cachedPuestos);
        } else {
          setPuestosCorpo([]);
        }
      }
    } catch (err) {
      console.error('Error fetching puestos corpo:', err);
      // En caso de error, intentar cargar desde cache
      try {
        const currentMarca = await AsyncStorage.getItem('current_marca');
        if (currentMarca) {
          const currentMarcaData = JSON.parse(currentMarca);
          const corpoId = currentMarcaData?.corpo?.id;
          if (corpoId) {
            const puestosCache = await AsyncStorage.getItem(`puestos_corpo_cache_${corpoId}`);
            if (puestosCache) {
              const cachedPuestos = JSON.parse(puestosCache);
              setPuestosCorpo(cachedPuestos);
            }
          }
        }
      } catch (cacheErr) {
        console.error('Error loading puestos from cache:', cacheErr);
      }
    } finally {
      setIsLoadingPuestos(false);
    }
  };

  const loadMainStructureCache = async () => {
    try {
      const cache = await AsyncStorage.getItem('main_structure_cache');
      const parsed = cache ? JSON.parse(cache) : [];
      setMainStructure(Array.isArray(parsed) ? parsed : []);
    } catch (error) {
      console.error('Error loading main_structure_cache:', error);
      setMainStructure([]);
    }
  };

  const fetchNotes = async () => {
    // Verificar si existe current_marca
    const currentMarca = await AsyncStorage.getItem('current_marca');
    if (!currentMarca) {
      setHasCurrentMarca(false);
      setIsLoading(false);
      return;
    }

    const currentMarcaData = JSON.parse(currentMarca);
    setCurrentMarca(currentMarcaData);
    setHasCurrentMarca(true);

    try {
      setIsLoading(true);
      setError(null);
      setOfflineMessage(null);

      // Verificar conectividad
      const isConnected = await getConnectionStatus();

      if (isConnected) {
        // Con internet: hacer fetch normal
        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) {
          throw new Error('Server URL not configured');
        }
        const response = await authedFetch({
          url: `${apiUrl}/api/puestos/${currentMarcaData.id}/notas`,
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

        if (data.status) {
          const notesCache = await AsyncStorage.getItem('notes_cache');
          const cachedData = notesCache ? JSON.parse(notesCache) : { notas: [] };
          const mergedNotes = mergeNotesBase64FromCache(data.notas || [], cachedData.notas || []);
          setNotes(mergedNotes);
          setPuesto(currentMarcaData.puesto || null);
          // Actualizar notes_cache
          await AsyncStorage.setItem('notes_cache', JSON.stringify({
            notas: mergedNotes,
            puesto: currentMarcaData.puesto || null
          }));
        } else {
          // Error real del servidor / lógica (sí cuenta como error)
          setError(data.message || 'Error al cargar las notas');
        }
      } else {
        // Sin internet: cargar desde cache
        const notesCache = await AsyncStorage.getItem('notes_cache');
        if (notesCache) {
          const cachedData = JSON.parse(notesCache);
          setNotes(cachedData.notas || []);
          setPuesto(currentMarcaData.puesto || null);
          setOfflineMessage('Modo Offline: no hay conexión a internet. Mostrando datos guardados.');
        } else {
          // Sin internet NO es error: permitir crear registros offline si aplica
          setOfflineMessage('Sin conexión: no hay datos guardados previamente. Puedes crear notas offline y se sincronizarán cuando haya conexión.');
          setNotes([]);
        }
      }
    } catch (err) {
      console.error('Error fetching notes:', err);
      // En caso de error, intentar cargar desde cache
      try {
        const notesCache = await AsyncStorage.getItem('notes_cache');
        if (notesCache) {
          const cachedData = JSON.parse(notesCache);
          setNotes(cachedData.notas || []);
          setPuesto(currentMarcaData.puesto || null);
          setOfflineMessage('Modo Offline: error de conexión. Mostrando datos guardados.');
        } else {
          if (isProbablyNetworkError(err)) {
            setOfflineMessage('Sin conexión: no hay datos guardados previamente. Puedes crear notas offline y se sincronizarán cuando haya conexión.');
            setNotes([]);
          } else {
            setError('Error al cargar las notas');
          }
        }
      } catch (cacheErr) {
        if (isProbablyNetworkError(err) || isProbablyNetworkError(cacheErr)) {
          setOfflineMessage('Sin conexión: no hay datos guardados previamente. Puedes crear notas offline y se sincronizarán cuando haya conexión.');
          setNotes([]);
        } else {
          setError('Error al cargar las notas');
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const fetchNotesByPuestoForSend = async (puestoId: number) => {
    try {
      setIsLoadingSendPreview(true);
      const isConnected = await getConnectionStatus();
      if (!isConnected) {
        Alert.alert('Sin conexión', 'Esta función solo está disponible con internet.');
        return;
      }
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) throw new Error('Server URL not configured');
      const response = await authedFetch({
        url: `${apiUrl}/api/puestos/notas/puesto/${puestoId}`,
        init: { method: 'GET', headers: { 'Content-Type': 'application/json' } },
        refreshAccessToken,
        logout,
      });
      if (!response) return;
      const data = await response.json();
      if (data.status) {
        setSendNotesPreview(Array.isArray(data.notas) ? data.notas : []);
      } else {
        Alert.alert('Error', data.message || 'No se pudieron cargar las notas del puesto');
      }
    } catch (e: any) {
      console.error('Error fetching notes by puesto:', e);
      Alert.alert('Error', e?.message || 'No se pudieron cargar las notas.');
    } finally {
      setIsLoadingSendPreview(false);
    }
  };

  const handleSendNotesToClient = async () => {
    try {
      const isConnected = await getConnectionStatus();
      if (!isConnected) {
        Alert.alert('Sin conexión', 'Esta función solo está disponible con internet.');
        return;
      }
      if (!sendPuestoId) {
        Alert.alert('Validación', 'Selecciona un puesto.');
        return;
      }
      if (!sendEmail.trim()) {
        Alert.alert('Validación', 'Ingresa un correo electrónico.');
        return;
      }

      Alert.alert('Confirmación', '¿Deseas enviar las notas al correo indicado?', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Enviar',
          onPress: async () => {
            try {
              const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
              if (!apiUrl) throw new Error('Server URL not configured');
              const response = await authedFetch({
                url: `${apiUrl}/api/puestos/notas/send-email`,
                init: {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ puesto_id: sendPuestoId, email: sendEmail.trim() }),
                },
                refreshAccessToken,
                logout,
              });
              if (!response) return;
              const data = await response.json();
              if (data.status) {
                Alert.alert('Éxito', data.message || 'Correo enviado correctamente');
                setIsSendNotesModalVisible(false);
              } else {
                Alert.alert('Error', data.message || 'No se pudo enviar el correo.');
              }
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'No se pudo enviar el correo.');
            }
          },
        },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo enviar el correo.');
    }
  };

  const createNote = async () => {

    const currentMarca = await AsyncStorage.getItem('current_marca');
    if (!currentMarca) {
      Alert.alert('Error', 'No se pudo cargar la marca');
      return;
    }
    const currentMarcaData = JSON.parse(currentMarca);
    if (!currentMarcaData) {
      Alert.alert('Error', 'No se pudo cargar la marca');
      return;
    }

    if (!tituloRef.current.trim()) {
      Alert.alert('Error', 'El título es obligatorio');
      return;
    }

    if (!descriptionRef.current.trim()) {
      Alert.alert('Error', 'La descripción es obligatoria');
      return;
    }

    if (!newNote.categoria_id) {
      Alert.alert('Error', 'Debe seleccionar una categoría');
      return;
    }

    if (!firmaResponsableHash.trim()) {
      Alert.alert('Error', 'Debe generar o escanear la firma responsable.');
      return;
    }

    Alert.alert(
      'Confirmar creación',
      '¿Estás seguro de que deseas crear esta nota?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Crear',
          onPress: async () => {
            setIsSubmitting(true);
            setSubmitResponse(null);
            try {
              // Determine puestos array based on role
              const isSupervisor = currentMarcaData?.roleDivision?.role?.nombre === 'SUPERVISOR';
              let puestosArray: number[] = [];

              if (isSupervisor) {
                // For supervisor: use selected puestos (convert to string)
                puestosArray = selectedPuestos.map(id => id);
              } else {
                // For non-supervisor: use only current puesto
                const currentPuestoId = currentMarcaData?.puesto?.id;
                if (currentPuestoId) {
                  puestosArray = [currentPuestoId];
                } else {
                  puestosArray = [0];
                }
              }

              const requestBody = {
                empleado_id: employee?.id,
                titulo: tituloRef.current,
                description: descriptionRef.current,
                division: newNote.division,
                categoria_id: newNote.categoria_id,
                relevancia: newNote.relevancia,
                puestos: JSON.stringify(puestosArray),
                firma_responsable: firmaResponsableHash.trim(),
                firma_manual_responsable: firmaManualResponsable,
                imagenes: buildImagenesJson(),
              };

              // Verificar conectividad
              const isConnected = await getConnectionStatus();

              if (isConnected) {
                // Con internet: llamar a la función API
                const data = await createNoteAPI({
                  requestData: requestBody,
                  marcaId: currentMarcaData.id,
                  puestoId: currentMarcaData.puesto.id,
                  refreshAccessToken,
                  logout,
                });

                if (data.status) {
                  Alert.alert('Éxito', data.message || 'Nota creada correctamente');
                  setIsCreating(false);
                  setNewNote({ id: null, id_local: '', titulo: '', description: '', division: null, categoria_id: null, relevancia: 'Baja' });
                  setSelectedPuestos([]);
                  setFirmaResponsableHash('');
                  setFirmaManualResponsable(null);
                  setImages([]);
                  fetchNotes();
                } else {
                  Alert.alert('Error', data.message || 'Error al crear la nota');
                }
              } else {
                // Sin internet: modo offline
                const localId = generateRandomId();
                const horaAccion = await getHoraAccion();

                // Crear entrada en notes_actions
                const actionsStr = await AsyncStorage.getItem('notes_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  requestData: requestBody,
                  marcaId: currentMarcaData.id,
                  puestoId: currentMarcaData.puesto.id,
                  id: localId,
                  type: 'create',
                });
                await AsyncStorage.setItem('notes_actions', JSON.stringify(actions));

                // Crear nota en cache
                const cacheStr = await AsyncStorage.getItem('notes_cache');
                const cache = cacheStr ? JSON.parse(cacheStr) : { notas: [], puesto: null };

                const newNoteCache = {
                  id: 0,
                  titulo: tituloRef.current,
                  description: descriptionRef.current,
                  division: newNote.division,
                  categoria_id: newNote.categoria_id,
                  relevancia: newNote.relevancia,
                  empleado: employee?.name || 'Desconocido',
                  creador: employee?.name || 'Desconocido',
                  is_modified: false,
                  firma_responsable: firmaResponsableHash.trim(),
                  firma_manual_responsable: firmaManualResponsable,
                  images: images,
                  updated_at: new Date(horaAccion).toISOString(),
                  id_local: localId,
                };

                cache.notas.push(newNoteCache);
                await AsyncStorage.setItem('notes_cache', JSON.stringify(cache));

                Alert.alert('Éxito', 'Nota creada localmente. Se sincronizará cuando haya conexión.');
                setIsCreating(false);
                setNewNote({ id: null, id_local: '', titulo: '', description: '', division: null, categoria_id: null, relevancia: 'Baja' });
                setSelectedPuestos([]);
                setFirmaResponsableHash('');
                setFirmaManualResponsable(null);
                setImages([]);
                fetchNotes();
              }
            } catch (err) {
              console.error('Error creating note:', err);
              Alert.alert('Error', 'No se pudo crear la nota');
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const updateNote = async (noteId: number) => {
    if (!editingNote) return;

    if (!tituloRef.current.trim()) {
      Alert.alert('Error', 'El título es obligatorio');
      return;
    }

    if (!descriptionRef.current.trim()) {
      Alert.alert('Error', 'La descripción es obligatoria');
      return;
    }

    Alert.alert(
      'Confirmar edición',
      '¿Estás seguro de que deseas guardar los cambios?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            setIsSubmitting(true);
            setSubmitResponse(null);
            try {
              const requestBody = {
                empleado_id: employee?.id,
                titulo: tituloRef.current,
                description: descriptionRef.current,
                division: editingNote.division,
                categoria_id: editingNote.categoria_id,
                relevancia: editingNote.relevancia,
                firma_responsable: firmaResponsableHash.trim(),
                firma_manual_responsable: firmaManualResponsable,
                imagenes: buildImagenesJson(),
              };

              // Verificar conectividad
              const isConnected = await getConnectionStatus();

              if (isConnected) {
                // Con internet: llamar a la función API
                const data = await updateNoteAPI({
                  requestData: requestBody,
                  noteId: noteId,
                  puestoId: currentMarca?.puesto?.id || 0,
                  marcaId: currentMarca?.id || 0,
                  refreshAccessToken,
                  logout,
                });

                if (data.status) {
                  Alert.alert('Éxito', data.message || 'Nota actualizada correctamente');
                  setEditingNote(null);
                  setFirmaResponsableHash('');
                  setFirmaManualResponsable(null);
                  setImages([]);
                  fetchNotes();
                } else {
                  Alert.alert('Error', data.message || 'Error al actualizar la nota');
                }
              } else {
                // Sin internet: modo offline
                const actionsStr = await AsyncStorage.getItem('notes_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];

                if (editingNote.id_local !== '') {
                  // Editar acción existente en notes_actions
                  const actionIndex = actions.findIndex((a: any) => a.id === editingNote.id_local);
                  if (actionIndex !== -1) {
                    actions[actionIndex].requestData = requestBody;
                    await AsyncStorage.setItem('notes_actions', JSON.stringify(actions));
                  }
                } else {
                  // Crear nueva acción de update en notes_actions
                  // Eliminar cualquier acción de update previa para este noteId
                  const filteredActions = actions.filter((a: any) => !(a.type === 'update' && a.id === noteId));
                  filteredActions.push({
                    requestData: requestBody,
                    puestoId: currentMarca?.puesto?.id || 0,
                    id: noteId,
                    type: 'update',
                  });
                  await AsyncStorage.setItem('notes_actions', JSON.stringify(filteredActions));
                }

                // Actualizar notes_cache
                const cacheStr = await AsyncStorage.getItem('notes_cache');
                const cache = cacheStr ? JSON.parse(cacheStr) : { notas: [], puesto: null };

                const noteIndex = cache.notas.findIndex((n: Note) =>
                  editingNote.id_local !== '' ? n.id_local === editingNote.id_local : n.id === noteId
                );

                if (noteIndex !== -1) {
                  cache.notas[noteIndex] = {
                    ...cache.notas[noteIndex],
                    titulo: tituloRef.current,
                    description: descriptionRef.current,
                    division: editingNote.division,
                    categoria_id: editingNote.categoria_id,
                    relevancia: editingNote.relevancia,
                    firma_responsable: firmaResponsableHash.trim(),
                    firma_manual_responsable: firmaManualResponsable,
                    is_modified: true,
                    images,
                  };
                  await AsyncStorage.setItem('notes_cache', JSON.stringify(cache));
                }

                Alert.alert('Éxito', 'Nota actualizada localmente. Se sincronizará cuando haya conexión.');
                setEditingNote(null);
                setFirmaResponsableHash('');
                setFirmaManualResponsable(null);
                setImages([]);
                fetchNotes();
              }
            } catch (err) {
              console.error('Error updating note:', err);
              Alert.alert('Error', 'No se pudo actualizar la nota');
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const deleteNote = async (noteId: number) => {
    Alert.alert(
      'Confirmar eliminación',
      '¿Estás seguro de que deseas eliminar esta nota?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
              if (!apiUrl) {
                throw new Error('Server URL not configured');
              }
              const response = await authedFetch({
                url: `${apiUrl}/api/empleados/${employee?.id}/notas/${noteId}`,
                init: {
                  method: 'DELETE',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                },
                refreshAccessToken,
                logout,
              });
              if (!response) return;

              const data = await response.json();

              if (data.status) {
                Alert.alert('Éxito', data.message || 'Nota eliminada correctamente');
                fetchNotes();
              } else {
                Alert.alert('Error', data.message || 'Error al eliminar la nota');
              }
            } catch (err) {
              console.error('Error deleting note:', err);
              Alert.alert('Error', 'No se pudo eliminar la nota');
            }
          },
        },
      ]
    );
  };

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'add': return <Ionicons name="add-sharp" size={20} color='#000000' />;
      case 'confirm': return <Ionicons name="checkmark-sharp" size={20} color='#FFFFFF' />;
      case 'cancel': return <Ionicons name="close-sharp" size={20} color='#FFFFFF' />;
      case 'edit': return <Ionicons name="pencil" size={20} color='#FFFFFF' />;
      case 'delete': return <Ionicons name="trash" size={20} color='#FFFFFF' />;
      case 'notes': return <Ionicons name="document" size={25} color='#000000' />;
      case 'changes': return <Ionicons name="document" size={25} color='#000000' />;
      default: return <Ionicons name="close-sharp" size={20} color='#FFFFFF' />;
    }
  };

  const toggleExpanded = (noteId: number) => {
    const newExpanded = new Set(expandedNotes);
    if (newExpanded.has(noteId)) {
      newExpanded.delete(noteId);
    } else {
      newExpanded.add(noteId);
    }
    setExpandedNotes(newExpanded);
  };

  const startEditing = (note: Note) => {
    setEditingNote({
      id: note.id,
      id_local: note.id_local,
      titulo: note.titulo,
      description: note.description,
      division: note.division,
      categoria_id: note.categoria_id,
      relevancia: (note.relevancia || 'Baja') as 'Baja' | 'Media' | 'Alta',
    });
    // Initialize refs with note values
    tituloRef.current = note.titulo;
    descriptionRef.current = note.description;
    setFirmaResponsableHash(note.firma_responsable || '');
    setFirmaManualResponsable(note.firma_manual_responsable || null);
    setImages(Array.isArray(note.images) ? note.images : []);
    // Ensure the note is expanded
    const newExpanded = new Set(expandedNotes);
    newExpanded.add(note.id);
    setExpandedNotes(newExpanded);
  };

  const cancelEditing = () => {
    setEditingNote(null);
  };

  const startCreating = async () => {
    setIsCreating(true);
    setNewNote({ id: null, id_local: '', titulo: '', description: '', division: divisions[0] || null, categoria_id: null, relevancia: 'Baja' });
    // Initialize refs
    tituloRef.current = '';
    descriptionRef.current = '';
    setFirmaResponsableHash('');
    setFirmaManualResponsable(null);
    setImages([]);

    // Initialize selected puestos based on role
    const currentMarca = await AsyncStorage.getItem('current_marca');
    if (currentMarca) {
      const currentMarcaData = JSON.parse(currentMarca);
      const isSupervisor = currentMarcaData?.roleDivision?.role?.nombre === 'SUPERVISOR';

      if (isSupervisor) {
        // For supervisor: start with current puesto selected
        const currentPuestoId = currentMarcaData?.puesto?.id;
        if (currentPuestoId) {
          setSelectedPuestos([currentPuestoId]);
        } else {
          setSelectedPuestos([]);
        }
      } else {
        // For non-supervisor: always use current puesto
        const currentPuestoId = currentMarcaData?.puesto?.id;
        if (currentPuestoId) {
          setSelectedPuestos([currentPuestoId]);
        } else {
          setSelectedPuestos([]);
        }
      }
    } else {
      setSelectedPuestos([]);
    }
  };

  const cancelCreating = () => {
    setIsCreating(false);
    setNewNote({ id: null, id_local: '', titulo: '', description: '', division: null, categoria_id: null, relevancia: 'Baja' });
    setSelectedPuestos([]);
    setFirmaResponsableHash('');
    setFirmaManualResponsable(null);
    setImages([]);
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);

      let hours = date.getUTCHours(); // <-- usa getUTCHours() para evitar ajustes de zona
      const minutes = date.getUTCMinutes();

      const ampm = hours >= 12 ? "pm" : "am";
      hours = hours % 12 || 12; // convierte 0 → 12 y 13–23 → 1–11

      const formatted = `${hours}:${minutes.toString().padStart(2, "0")} ${ampm}`;

      return `${date.getDate()} de ${monthNames[date.getMonth()]} de ${date.getFullYear()}, ${formatted}`;
    } catch (error) {
      return dateString;
    }
  };

  const getCategoryName = (categoryId: number | null) => {
    if (!categoryId) return null;
    const category = categories.find(cat => cat.id === categoryId);
    return category ? category.nombre : null;
  };


  const filteredNotes = notes.filter(note => {
    const matchesSearch =
      note.titulo.toLowerCase().includes(searchText.toLowerCase()) ||
      note.description.toLowerCase().includes(searchText.toLowerCase());

    const matchesDivision =
      selectedDivision === 'all' ||
      selectedDivision === 'none' && !note.division ||
      note.division === selectedDivision;

    const matchesDate = !selectedDate || (() => {
      const noteDate = new Date(note.updated_at);
      const filterDate = selectedDate;

      // Compare only date part (ignore time)
      const noteDateOnly = new Date(noteDate.getFullYear(), noteDate.getMonth(), noteDate.getDate());
      const filterDateOnly = new Date(filterDate.getFullYear(), filterDate.getMonth(), filterDate.getDate());

      return noteDateOnly.getTime() === filterDateOnly.getTime();
    })();

    const matchesCategory =
      selectedCategory === 'all' ||
      (selectedCategory === 'none' && !note.categoria_id) ||
      note.categoria_id === selectedCategory;

    const matchesRelevancia =
      selectedRelevancia === 'all' ||
      (selectedRelevancia === 'none' && !note.relevancia) ||
      note.relevancia === selectedRelevancia;

    const matchesEmpleado =
      !empleadoFilter ||
      note.empleado.toLowerCase().includes(empleadoFilter.toLowerCase());

    return matchesSearch && matchesDivision && matchesDate && matchesCategory && matchesRelevancia && matchesEmpleado;
  });

  const isAdministrativo = currentMarca?.roleDivision?.role?.nombre === 'ADMINISTRATIVO';
  const empresaOptions = mainStructure;
  const selectedEmpresa = empresaOptions.find((e) => e.id === sendEmpresaId) || null;
  const clienteOptions = selectedEmpresa?.clientes || [];
  const selectedCliente = clienteOptions.find((c) => c.id === sendClienteId) || null;
  const divisionOptions = selectedCliente?.division || [];
  const selectedDivisionNode = divisionOptions.find((d) => d.id === sendDivisionId) || null;
  const contratoOptions = selectedDivisionNode?.contratos || [];
  const selectedContrato = contratoOptions.find((c) => c.id === sendContratoId) || null;
  const sucursalOptions = selectedContrato?.sucursales || [];
  const selectedSucursal = sucursalOptions.find((s) => s.id === sendSucursalId) || null;
  const puestoOptions = selectedSucursal?.puestos || [];

  useEffect(() => {
    if (!sendPuestoId) {
      setSendNotesPreview([]);
      return;
    }
    fetchNotesByPuestoForSend(sendPuestoId);
  }, [sendPuestoId]);

  // Handle menu press from header
  const handleMenuPress = () => {
    setIsMenuVisible(true);
  };

  // Handle menu close
  const handleMenuClose = () => {
    setIsMenuVisible(false);
  };

  // Handle back navigation
  const handleBack = () => {
    navigation.goBack();
  };

  // Handle home navigation from slide menu
  const handleHomePress = () => {
    navigation.navigate('Home');
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setSelectedDate(selectedDate);
    }
  };

  const clearDateFilter = () => {
    setSelectedDate(null);
  };

  const resetAllFilters = () => {
    setSearchText('');
    setSelectedDivision('all');
    setSelectedDate(null);
    setSelectedCategory('all');
    setSelectedRelevancia('all');
    setEmpleadoFilter('');
  };

  const formatDateForDisplay = (date: Date) => {
    return formatDateDMY(date);
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
      return `${day}-${month}-${year} ${hours}:${minutes}`;
    } catch {
      return String(value);
    }
  };

  const fetchCambiosNota = async (noteId: number) => {
    try {
      setIsLoadingCambios(true);
      setCambiosItems([]);

      const isConnected = await getConnectionStatus();
      if (!isConnected) {
        Alert.alert('Sin conexión', 'Esta función solo está disponible con conexión a internet.');
        setIsLoadingCambios(false);
        return;
      }

      const currentMarca = await AsyncStorage.getItem('current_marca');
      if (!currentMarca) {
        throw new Error('Current marca not found');
      }
      const currentMarcaData = JSON.parse(currentMarca);
      if (!currentMarcaData) {
        throw new Error('Current marca data not found');
      }

      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) {
        throw new Error('Server URL not configured');
      }

      const response = await authedFetch({
        url: `${apiUrl}/api/cambios-apps-modules?tabla=${encodeURIComponent('c_puesto_notas')}&registro_id=${noteId}`,
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

      const data = await response.json().catch(() => ({}));
      if (data?.status && Array.isArray(data?.data)) {
        setCambiosItems(data.data);
      } else {
        setCambiosItems([]);
        if (data?.message) Alert.alert('Información', data.message);
      }
    } catch (err) {
      console.error('Error fetching changes:', err);
      Alert.alert('Error', 'No se pudieron cargar los cambios de la nota');
      setCambiosItems([]);
    } finally {
      setIsLoadingCambios(false);
    }
  };

  const openChangesModal = (noteId: number) => {
    setSelectedNoteId(noteId);
    setIsChangesModalVisible(true);
    setExpandedCambioId(null);
    fetchCambiosNota(noteId);
  };

  const closeChangesModal = () => {
    setIsChangesModalVisible(false);
    setSelectedNoteId(null);
    setCambiosItems([]);
    setExpandedCambioId(null);
  };

  const renderNoteItem = (note: Note) => {
    const isExpanded = expandedNotes.has(note.id);
    const isEditing = editingNote?.id === note.id;

    return (
      <ThemedView key={note.id} style={styles.noteCard}>
        {isEditing ? (
          // Edit mode
          <ThemedView style={styles.editContainer}>
            <ThemedView style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Título:</ThemedText>
              <TextInput
                style={styles.input}
                defaultValue={editingNote.titulo}
                onChangeText={(text) => { tituloRef.current = text; }}
                placeholder="Título de la nota"
                placeholderTextColor="#999"
                key={`titulo-edit-${editingNote.id}`}
              />
            </ThemedView>

            <ThemedView style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Descripción:</ThemedText>
              <TextInput
                style={[styles.input, styles.textArea]}
                defaultValue={editingNote.description}
                onChangeText={(text) => { descriptionRef.current = text; }}
                placeholder="Descripción de la nota"
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
                key={`description-edit-${editingNote.id}`}
              />
            </ThemedView>

            <ThemedView style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Categoría:</ThemedText>
              <ThemedView style={styles.pickerContainer}>
                <Picker
                  selectedValue={editingNote.categoria_id}
                  onValueChange={(value) => setEditingNote({ ...editingNote, categoria_id: value as number | null })}
                  style={styles.picker}
                >
                  <Picker.Item label="Sin categoría" value={null} />
                  {categories.map((category) => (
                    <Picker.Item key={category.id} label={category.nombre} value={category.id} />
                  ))}
                </Picker>
              </ThemedView>
            </ThemedView>

            <ThemedView style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Relevancia:</ThemedText>
              <ThemedView style={styles.pickerContainer}>
                <Picker
                  selectedValue={editingNote.relevancia}
                  onValueChange={(value) => setEditingNote({ ...editingNote, relevancia: value as 'Baja' | 'Media' | 'Alta' })}
                  style={styles.picker}
                >
                  <Picker.Item label="Baja" value="Baja" />
                  <Picker.Item label="Media" value="Media" />
                  <Picker.Item label="Alta" value="Alta" />
                </Picker>
              </ThemedView>
            </ThemedView>

            <ThemedView style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Firma responsable:</ThemedText>
              <ThemedView style={styles.firmaButtonsRow}>
                <TouchableOpacity
                  style={[styles.firmaBlueButton, isGeneratingFirmaResponsable && styles.buttonDisabled]}
                  onPress={handleGenerateFirmaResponsable}
                  disabled={isGeneratingFirmaResponsable}
                >
                  <Ionicons name="qr-code-outline" size={16} color="#FFFFFF" />
                  <ThemedText style={styles.firmaBlueButtonText}>
                    {isGeneratingFirmaResponsable ? 'Generando...' : 'Generar'}
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity style={styles.firmaBlueButton} onPress={handleScanFirmaResponsable}>
                  <Ionicons name="scan-outline" size={16} color="#FFFFFF" />
                  <ThemedText style={styles.firmaBlueButtonText}>Escanear QR</ThemedText>
                </TouchableOpacity>
              </ThemedView>
              {!firmaResponsableHash ? (
                <ThemedText style={styles.noteDate}>Debes generar o escanear una firma.</ThemedText>
              ) : (
                (() => {
                  const info = decodeFirmaHash(firmaResponsableHash);
                  if (!info) {
                    return <ThemedText style={styles.noteDate}>Firma digital registrada (no decodificable)</ThemedText>;
                  }
                  return (
                    <ThemedView>
                      <ThemedText style={styles.noteDate}>Sesión: {info.sessionId || 'N/A'}</ThemedText>
                      <ThemedText style={styles.noteDate}>Empleado: {info.empleadoId || 'N/A'}</ThemedText>
                      <ThemedText style={styles.noteDate}>
                        Lat: {info.latitud || 'N/A'} | Long: {info.longitud || 'N/A'}
                      </ThemedText>
                      <ThemedText style={styles.noteDate}>Hora: {info.timestamp || 'N/A'}</ThemedText>
                    </ThemedView>
                  );
                })()
              )}
            </ThemedView>

            <ThemedView style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Firma manual responsable (opcional):</ThemedText>
              <ThemedView style={styles.firmaButtonsRow}>
                <TouchableOpacity style={styles.firmaBlueButton} onPress={openManualSignatureModal}>
                  <Ionicons name="create-outline" size={16} color="#FFFFFF" />
                  <ThemedText style={styles.firmaBlueButtonText}>
                    {firmaManualResponsable ? 'Reemplazar firma' : 'Dibujar firma'}
                  </ThemedText>
                </TouchableOpacity>
                {!!firmaManualResponsable && (
                  <TouchableOpacity style={styles.cancelButton} onPress={() => setFirmaManualResponsable(null)}>
                    <ThemedText style={styles.cancelButtonText}>Quitar</ThemedText>
                  </TouchableOpacity>
                )}
              </ThemedView>
              {!!firmaManualResponsable && (
                <Image source={{ uri: firmaManualResponsable }} style={styles.signaturePreview} resizeMode="contain" />
              )}
            </ThemedView>

            <ThemedView style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Imágenes:</ThemedText>
              <TouchableOpacity style={styles.captureImageButton} onPress={openCamera}>
                <Ionicons name="camera" size={18} color="#007AFF" />
                <ThemedText style={styles.captureImageText}>Agregar foto</ThemedText>
              </TouchableOpacity>
              {images.length > 0 && (
                <ThemedView style={styles.imageRow}>
                  {images.map((img, idx) => {
                    const uri = resolveNoteImageUri(
                      img,
                      editingNote?.id || null,
                      currentMarca?.puesto?.id || null
                    );
                    if (!uri) return null;
                    return (
                      <TouchableOpacity
                        key={`edit-img-${idx}`}
                        onPress={() => {
                          setSelectedImageUrl(uri);
                          setIsImagePreviewVisible(true);
                        }}
                        onLongPress={() => removeImage(idx)}
                      >
                        <Image source={{ uri }} style={styles.noteImageThumb} />
                      </TouchableOpacity>
                    );
                  })}
                </ThemedView>
              )}
            </ThemedView>

            {submitResponse && (
              <ThemedView style={[styles.responseContainer, submitResponse.type === 'success' ? styles.responseSuccess : styles.responseError]}>
                <ThemedText style={styles.responseText}>
                  {submitResponse.type === 'success' ? '✓ ' : '✗ '}
                  {submitResponse.message}
                </ThemedText>
              </ThemedView>
            )}
            <ThemedView style={styles.buttonRow}>
              <TouchableOpacity 
                style={[styles.confirmButton, isSubmitting && styles.buttonDisabled]} 
                onPress={() => updateNote(note.id)}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <ThemedText style={styles.confirmButtonText}>{getActionIcon('confirm')}</ThemedText>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelButton} onPress={cancelEditing} disabled={isSubmitting}>
                <ThemedText style={styles.cancelButtonText}>{getActionIcon('cancel')}</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          </ThemedView>
        ) : (
          // View mode
          <>
            <TouchableOpacity
              style={styles.noteHeader}
              onPress={() => toggleExpanded(note.id)}
              activeOpacity={0.7}
            >
              <ThemedView style={styles.noteHeaderContent}>
                <ThemedText style={styles.noteTitle}>{note.titulo}</ThemedText>
                <ThemedView style={styles.noteMetadata}>
                  {getCategoryName(note.categoria_id) && (
                    <ThemedView style={styles.categoryBadge}>
                      <ThemedText style={styles.categoryText}>{getCategoryName(note.categoria_id)}</ThemedText>
                    </ThemedView>
                  )}
                  {note.relevancia && (
                    <ThemedView style={styles.changeRelevanciaBadge}>
                      <ThemedText style={styles.categoryText}>Relevancia: {note.relevancia}</ThemedText>
                    </ThemedView>
                  )}
                </ThemedView>
                <ThemedView style={styles.noteMetadata}>
                  <ThemedText style={styles.noteDate}>{formatDate(note.updated_at)}</ThemedText>
                </ThemedView>
              </ThemedView>
              <ThemedText style={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</ThemedText>
            </TouchableOpacity>

            {isExpanded && (
              <ThemedView style={styles.noteBody}>
                <ThemedText style={styles.noteDescription}>{note.description}</ThemedText>

                <ThemedView style={styles.signatureCollapsableCard}>
                  <ThemedView style={styles.signatureCollapsableHeader}>
                    <ThemedText style={styles.signatureCollapsableHeaderText}>
                      {note.is_modified ? 'Último cambio' : 'Creado por'}
                    </ThemedText>
                  </ThemedView>
                  <ThemedView style={styles.signatureCollapsableBody}>
                    <ThemedText style={styles.signatureInfoValue}>
                      {note.is_modified ? note.empleado : (note.creador || note.empleado)}
                    </ThemedText>
                  </ThemedView>
                </ThemedView>

                {!!note.firma_responsable && (
                  <ThemedView style={styles.lastChangeContainer}>
                    <ThemedText style={styles.lastChangeLabel}>Firma responsable:</ThemedText>
                    {(() => {
                      const info = decodeFirmaHash(note.firma_responsable);
                      if (!info) return <ThemedText style={styles.lastChangeEmployee}>No legible</ThemedText>;
                      return (
                        <ThemedView>
                          <ThemedText style={styles.noteDate}>Sesión: {info.sessionId}</ThemedText>
                          <ThemedText style={styles.noteDate}>Empleado: {info.empleadoId}</ThemedText>
                          <ThemedText style={styles.noteDate}>Lat/Lng: {info.latitud}, {info.longitud}</ThemedText>
                          <ThemedText style={styles.noteDate}>Hora: {info.timestamp}</ThemedText>
                        </ThemedView>
                      );
                    })()}
                  </ThemedView>
                )}

                {!!note.firma_manual_responsable && (
                  <ThemedView style={styles.lastChangeContainer}>
                    <ThemedText style={styles.lastChangeLabel}>Firma manual responsable:</ThemedText>
                    <Image source={{ uri: note.firma_manual_responsable }} style={styles.signaturePreview} resizeMode="contain" />
                  </ThemedView>
                )}

                {Array.isArray(note.images) && note.images.length > 0 && (
                  <ThemedView style={styles.imageRow}>
                    {note.images.map((img, idx) => {
                      const sourceUri = resolveNoteImageUri(
                        img,
                        note.id,
                        note.puesto_id || currentMarca?.puesto?.id || null
                      );
                      if (!sourceUri) return null;
                      return (
                        <TouchableOpacity
                          key={`${note.id}-img-${img.id || idx}`}
                          onPress={() => {
                            setSelectedImageUrl(sourceUri);
                            setIsImagePreviewVisible(true);
                          }}
                        >
                          <Image source={{ uri: sourceUri }} style={styles.noteImageThumb} />
                        </TouchableOpacity>
                      );
                    })}
                  </ThemedView>
                )}

                <ThemedView style={styles.buttonRow}>
                  <TouchableOpacity style={styles.editButton} onPress={() => startEditing(note)}>
                    <ThemedText style={styles.editButtonText}>{getActionIcon('edit')}</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.changesButton} onPress={() => openChangesModal(note.id)}>
                    <ThemedText style={styles.changesButtonText}>{getActionIcon('changes')}</ThemedText>
                  </TouchableOpacity>
                </ThemedView>
              </ThemedView>
            )}
          </>
        )}
      </ThemedView>
    );
  };

  const togglePuestoSelection = (puestoId: number) => {
    setSelectedPuestos(prev => {
      if (prev.includes(puestoId)) {
        return prev.filter(id => id !== puestoId);
      } else {
        return [...prev, puestoId];
      }
    });
  };

  const renderNewNoteForm = () => {
    if (!isCreating) return null;

    const isSupervisor = currentMarca?.roleDivision?.role?.nombre === 'SUPERVISOR';

    return (
      <ThemedView style={[styles.noteCard, styles.newNoteCard]}>
        <ThemedView style={styles.editContainer}>
          <ThemedText style={styles.newNoteTitle}>Nueva Nota</ThemedText>

          <ThemedView style={styles.inputGroup}>
            <ThemedText style={styles.inputLabel}>Título:</ThemedText>
            <TextInput
              style={styles.input}
              defaultValue={newNote.titulo}
              onChangeText={(text) => { tituloRef.current = text; }}
              placeholder="Título de la nota"
              placeholderTextColor="#999"
              key="titulo-create"
            />
          </ThemedView>

          <ThemedView style={styles.inputGroup}>
            <ThemedText style={styles.inputLabel}>Descripción:</ThemedText>
            <TextInput
              style={[styles.input, styles.textArea]}
              defaultValue={newNote.description}
              onChangeText={(text) => { descriptionRef.current = text; }}
              placeholder="Descripción de la nota"
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
              key="description-create"
            />
          </ThemedView>

          <ThemedView style={styles.inputGroup}>
            <ThemedText style={styles.inputLabel}>Categoría:</ThemedText>
            <ThemedView style={styles.pickerContainer}>
              <Picker
                selectedValue={newNote.categoria_id}
                onValueChange={(value) => setNewNote({ ...newNote, categoria_id: value as number | null })}
                style={styles.picker}
              >
                <Picker.Item label="Sin categoría" value={null} />
                {categories.map((category) => (
                  <Picker.Item key={category.id} label={category.nombre} value={category.id} />
                ))}
              </Picker>
            </ThemedView>
          </ThemedView>

          <ThemedView style={styles.inputGroup}>
            <ThemedText style={styles.inputLabel}>Relevancia:</ThemedText>
            <ThemedView style={styles.pickerContainer}>
              <Picker
                selectedValue={newNote.relevancia}
                onValueChange={(value) => setNewNote({ ...newNote, relevancia: value as 'Baja' | 'Media' | 'Alta' })}
                style={styles.picker}
              >
                <Picker.Item label="Baja" value="Baja" />
                <Picker.Item label="Media" value="Media" />
                <Picker.Item label="Alta" value="Alta" />
              </Picker>
            </ThemedView>
          </ThemedView>

          {!!firmaResponsableHash && (
            <ThemedView style={styles.signatureCollapsableCard}>
              <ThemedView style={styles.signatureCollapsableHeader}>
                <ThemedText style={styles.signatureCollapsableHeaderText}>Firma responsable (vista previa)</ThemedText>
              </ThemedView>
              <ThemedView style={styles.signatureCollapsableBody}>
                {(() => {
                  const info = decodeFirmaHash(firmaResponsableHash);
                  if (!info) {
                    return <ThemedText style={styles.signatureInfoValue}>Formato no decodificable</ThemedText>;
                  }
                  return (
                    <>
                      <ThemedText style={styles.signatureInfoValue}>Sesión: {info.sessionId || 'N/A'}</ThemedText>
                      <ThemedText style={styles.signatureInfoValue}>Empleado: {info.empleadoId || 'N/A'}</ThemedText>
                      <ThemedText style={styles.signatureInfoValue}>
                        Lat: {info.latitud || 'N/A'} | Long: {info.longitud || 'N/A'}
                      </ThemedText>
                      <ThemedText style={styles.signatureInfoValue}>Hora: {info.timestamp || 'N/A'}</ThemedText>
                    </>
                  );
                })()}
              </ThemedView>
            </ThemedView>
          )}

          <ThemedView style={styles.inputGroup}>
            <ThemedText style={styles.inputLabel}>Firma responsable:</ThemedText>
            <ThemedView style={styles.firmaButtonsRow}>
              <TouchableOpacity
                style={[styles.firmaBlueButton, isGeneratingFirmaResponsable && styles.buttonDisabled]}
                onPress={handleGenerateFirmaResponsable}
                disabled={isGeneratingFirmaResponsable}
              >
                <Ionicons name="qr-code-outline" size={16} color="#FFFFFF" />
                <ThemedText style={styles.firmaBlueButtonText}>
                  {isGeneratingFirmaResponsable ? 'Generando...' : 'Generar'}
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.firmaBlueButton} onPress={handleScanFirmaResponsable}>
                <Ionicons name="scan-outline" size={16} color="#FFFFFF" />
                <ThemedText style={styles.firmaBlueButtonText}>Escanear QR</ThemedText>
              </TouchableOpacity>
            </ThemedView>
              {!firmaResponsableHash ? (
                <ThemedText style={styles.noteDate}>Debes generar o escanear una firma.</ThemedText>
              ) : (
                (() => {
                  const info = decodeFirmaHash(firmaResponsableHash);
                  if (!info) {
                    return <ThemedText style={styles.noteDate}>Firma digital registrada (no decodificable)</ThemedText>;
                  }
                  return (
                    <ThemedView>
                      <ThemedText style={styles.noteDate}>Sesión: {info.sessionId || 'N/A'}</ThemedText>
                      <ThemedText style={styles.noteDate}>Empleado: {info.empleadoId || 'N/A'}</ThemedText>
                      <ThemedText style={styles.noteDate}>
                        Lat: {info.latitud || 'N/A'} | Long: {info.longitud || 'N/A'}
                      </ThemedText>
                      <ThemedText style={styles.noteDate}>Hora: {info.timestamp || 'N/A'}</ThemedText>
                    </ThemedView>
                  );
                })()
              )}
          </ThemedView>

          <ThemedView style={styles.inputGroup}>
            <ThemedText style={styles.inputLabel}>Firma manual responsable (opcional):</ThemedText>
            <ThemedView style={styles.firmaButtonsRow}>
              <TouchableOpacity style={styles.firmaBlueButton} onPress={openManualSignatureModal}>
                <Ionicons name="create-outline" size={16} color="#FFFFFF" />
                <ThemedText style={styles.firmaBlueButtonText}>
                  {firmaManualResponsable ? 'Reemplazar firma' : 'Dibujar firma'}
                </ThemedText>
              </TouchableOpacity>
              {!!firmaManualResponsable && (
                <TouchableOpacity style={styles.cancelButton} onPress={() => setFirmaManualResponsable(null)}>
                  <ThemedText style={styles.cancelButtonText}>Quitar</ThemedText>
                </TouchableOpacity>
              )}
            </ThemedView>
            {!!firmaManualResponsable && (
              <Image source={{ uri: firmaManualResponsable }} style={styles.signaturePreview} resizeMode="contain" />
            )}
          </ThemedView>

          <ThemedView style={styles.inputGroup}>
            <ThemedText style={styles.inputLabel}>Imágenes:</ThemedText>
            <TouchableOpacity style={styles.captureImageButton} onPress={openCamera}>
              <Ionicons name="camera" size={18} color="#007AFF" />
              <ThemedText style={styles.captureImageText}>Agregar foto</ThemedText>
            </TouchableOpacity>
            {images.length > 0 && (
              <ThemedView style={styles.imageRow}>
                {images.map((img, idx) => {
                  const uri = resolveNoteImageUri(
                    img,
                    null,
                    currentMarca?.puesto?.id || null
                  );
                  if (!uri) return null;
                  return (
                    <TouchableOpacity
                      key={`create-img-${idx}`}
                      onPress={() => {
                        setSelectedImageUrl(uri);
                        setIsImagePreviewVisible(true);
                      }}
                      onLongPress={() => removeImage(idx)}
                    >
                      <Image source={{ uri }} style={styles.noteImageThumb} />
                    </TouchableOpacity>
                  );
                })}
              </ThemedView>
            )}
          </ThemedView>

          {/* Puestos checkboxes - Solo para SUPERVISOR */}
          {isSupervisor && (
            <ThemedView style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Puestos:</ThemedText>
              {isLoadingPuestos ? (
                <ThemedView style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#007AFF" />
                  <ThemedText style={styles.loadingText}>Cargando puestos...</ThemedText>
                </ThemedView>
              ) : puestosCorpo.length > 0 ? (
                <ThemedView style={styles.puestosListContainer}>
                  {puestosCorpo.map((puesto, index) => {
                    const isChecked = selectedPuestos.includes(puesto.id);
                    const isLast = index === puestosCorpo.length - 1;
                    return (
                      <TouchableOpacity
                        key={puesto.id}
                        style={[
                          styles.puestoListItem,
                          isChecked && styles.puestoListItemSelected,
                          isLast && styles.puestoListItemLast,
                        ]}
                        onPress={() => togglePuestoSelection(puesto.id)}
                        activeOpacity={0.8}
                      >
                        <View style={[styles.puestoCheckbox, isChecked && styles.puestoCheckboxChecked]}>
                          {isChecked && <Ionicons name="checkmark" size={14} color="#fff" />}
                        </View>
                        <View style={styles.puestoInfo}>
                          <ThemedText style={styles.puestoCheckboxName}>{puesto.nombre}</ThemedText>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ThemedView>
              ) : (
                <ThemedText style={styles.emptyText}>No hay puestos disponibles</ThemedText>
              )}
            </ThemedView>
          )}

          {submitResponse && (
            <ThemedView style={[styles.responseContainer, submitResponse.type === 'success' ? styles.responseSuccess : styles.responseError]}>
              <ThemedText style={styles.responseText}>
                {submitResponse.type === 'success' ? '✓ ' : '✗ '}
                {submitResponse.message}
              </ThemedText>
            </ThemedView>
          )}
          <ThemedView style={styles.buttonRow}>
            <TouchableOpacity 
              style={[styles.confirmButton, isSubmitting && styles.buttonDisabled]} 
              onPress={createNote}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <ThemedText style={styles.confirmButtonText}>{getActionIcon('confirm')}</ThemedText>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={cancelCreating} disabled={isSubmitting}>
              <ThemedText style={styles.cancelButtonText}>{getActionIcon('cancel')}</ThemedText>
            </TouchableOpacity>
          </ThemedView>
        </ThemedView>
      </ThemedView>
    );
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader onMenuPress={handleMenuPress} title="Bitácora de novedades" />
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Cargando novedades...</ThemedText>
        </ThemedView>
        <AppFooter />
        <SlideMenu
          isVisible={isMenuVisible}
          onClose={handleMenuClose}
          onHomePress={handleHomePress}
          currentRoute="Notes"
        />
      </ThemedView>
    );
  }

  // Si no hay marca registrada, mostrar mensaje
  if (!hasCurrentMarca) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader onMenuPress={handleMenuPress} title="Bitácora de novedades" />
        <ThemedView style={styles.noMarcaContainer}>
          <Ionicons name="alert-circle-outline" size={80} color="#FF9500" />
          <ThemedText style={styles.noMarcaTitle}>No hay marca registrada</ThemedText>
          <ThemedText style={styles.noMarcaMessage}>
            Debes registrar una marca de ingreso antes de acceder a la bitácora de novedades.
          </ThemedText>
          <TouchableOpacity
            style={styles.goBackButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={20} color="#000000" />
            <ThemedText style={styles.goBackButtonText}>Volver</ThemedText>
          </TouchableOpacity>
        </ThemedView>
        <AppFooter />
        <SlideMenu
          isVisible={isMenuVisible}
          onClose={handleMenuClose}
          onHomePress={handleHomePress}
          currentRoute="Notes"
        />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <AppHeader onMenuPress={handleMenuPress} title="Bitácora de novedades" />
      {!!error && (
        <ThemedView style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={18} color="#B00020" />
          <ThemedText style={styles.errorBannerText}>{error}</ThemedText>
        </ThemedView>
      )}
      {!!offlineMessage && !error && (
        <ThemedView style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={18} color="#8A6D00" />
          <ThemedText style={styles.offlineBannerText}>{offlineMessage}</ThemedText>
        </ThemedView>
      )}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <ThemedView style={styles.contentContainer}>

          {/* Module Title */}
          <ThemedView style={styles.titleContainer}>
            <ThemedText type="title" style={styles.title}>
              {getActionIcon('notes')} Bitácora de novedades
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              Gestiona las notas del puesto
            </ThemedText>
          </ThemedView>

          {/* Puesto Info */}
          {puesto && (
            <ThemedView style={styles.puestoContainer}>
              <ThemedText style={styles.puestoLabel}>Puesto:</ThemedText>
              <ThemedText style={styles.puestoName}>{puesto.nombre}</ThemedText>
            </ThemedView>
          )}

          {/* Filters */}
          <ThemedView style={styles.filtersMain}>
            {/* Filter Header */}
            <ThemedView style={styles.filterHeader}>
              <TouchableOpacity
                style={styles.filterToggleButton}
                onPress={() => setIsFiltersExpanded(!isFiltersExpanded)}
              >
                <ThemedText style={styles.filterToggleText}>
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
              <ThemedView style={styles.filterContent}>
                <ThemedView style={styles.filterGroupSearch}>
                  <ThemedText style={styles.filterLabel}>Título o Descripción:</ThemedText>
                  <TextInput
                    style={styles.searchInput}
                    value={searchText}
                    onChangeText={setSearchText}
                    placeholder="Buscar por título o descripción..."
                    placeholderTextColor="#999"
                  />
                </ThemedView>

                {/* Date Filter */}
                <ThemedView style={styles.filterGroupSearch}>
                  <ThemedText style={styles.filterLabel}>Fecha:</ThemedText>
                  <ThemedView style={styles.dateFilterRow}>
                    <TouchableOpacity
                      style={styles.dateButton}
                      onPress={() => setShowDatePicker(true)}
                    >
                      <ThemedText style={styles.dateButtonText}>
                        {selectedDate ? formatDateForDisplay(selectedDate) : 'Seleccionar fecha'}
                      </ThemedText>
                      <Ionicons name="calendar-outline" size={20} color="#007AFF" />
                    </TouchableOpacity>

                    {selectedDate && (
                      <TouchableOpacity
                        style={styles.clearDateButton}
                        onPress={clearDateFilter}
                      >
                        <Ionicons name="close-circle" size={20} color="#FF3B30" />
                      </TouchableOpacity>
                    )}
                  </ThemedView>
                </ThemedView>

                {/* Category Filter */}
                <ThemedView style={styles.filterGroupSearch}>
                  <ThemedText style={styles.filterLabel}>Categoría:</ThemedText>
                  <ThemedView style={styles.pickerContainer}>
                    <Picker
                      selectedValue={selectedCategory}
                      onValueChange={(value) => setSelectedCategory(value)}
                      style={styles.picker}
                    >
                      <Picker.Item label="Todas las categorías" value="all" />
                      <Picker.Item label="Sin categoría" value="none" />
                      {categories.map((category) => (
                        <Picker.Item key={category.id} label={category.nombre} value={category.id} />
                      ))}
                    </Picker>
                  </ThemedView>
                </ThemedView>

                {/* Relevancia Filter */}
                <ThemedView style={styles.filterGroupSearch}>
                  <ThemedText style={styles.filterLabel}>Relevancia:</ThemedText>
                  <ThemedView style={styles.pickerContainer}>
                    <Picker
                      selectedValue={selectedRelevancia}
                      onValueChange={(value) => setSelectedRelevancia(value)}
                      style={styles.picker}
                    >
                      <Picker.Item label="Todas las relevancias" value="all" />
                      <Picker.Item label="Sin relevancia" value="none" />
                      <Picker.Item label="Baja" value="Baja" />
                      <Picker.Item label="Media" value="Media" />
                      <Picker.Item label="Alta" value="Alta" />
                    </Picker>
                  </ThemedView>
                </ThemedView>

                {/* Empleado Filter */}
                <ThemedView style={styles.filterGroupSearch}>
                  <ThemedText style={styles.filterLabel}>Último cambio por:</ThemedText>
                  <TextInput
                    style={styles.searchInput}
                    value={empleadoFilter}
                    onChangeText={setEmpleadoFilter}
                    placeholder="Buscar por empleado..."
                    placeholderTextColor="#999"
                  />
                </ThemedView>
              </ThemedView>
            )}
          </ThemedView>

          {/* Date Picker */}
          {showDatePicker && (
            <DateTimePicker
              value={selectedDate || new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChange}
            />
          )}

          {/* Create Button */}
          {!isCreating && !error && (
            <TouchableOpacity style={styles.createButton} onPress={startCreating}>
              <ThemedText style={styles.createButtonText}>{getActionIcon('add')}</ThemedText>
            </TouchableOpacity>
          )}

          {isAdministrativo && (
            <TouchableOpacity style={styles.sendClientButton} onPress={() => setIsSendNotesModalVisible(true)}>
              <Ionicons name="mail-outline" size={18} color="#FFFFFF" />
              <ThemedText style={styles.sendClientButtonText}>Enviar notas al cliente</ThemedText>
            </TouchableOpacity>
          )}

          {/* New Note Form */}
          {renderNewNoteForm()}

          {/* Notes List */}
          <ThemedView style={styles.notesContainer}>
            {filteredNotes.length === 0 ? (
              <ThemedView style={styles.emptyContainer}>
                <ThemedText style={styles.emptyText}>
                  {notes.length === 0
                    ? 'No hay notas creadas aún'
                    : 'No se encontraron notas con los filtros aplicados'}
                </ThemedText>
              </ThemedView>
            ) : (
              filteredNotes.map(note => renderNoteItem(note))
            )}
          </ThemedView>
        </ThemedView>
      </ScrollView>
      <AppFooter />
      <SlideMenu
        isVisible={isMenuVisible}
        onClose={handleMenuClose}
        onHomePress={handleHomePress}
        currentRoute="Notes"
      />

      {QRScannerComponent}

      <Modal
        visible={signatureModalVisible}
        animationType="fade"
        transparent
        presentationStyle="overFullScreen"
        onRequestClose={() => setSignatureModalVisible(false)}
      >
        <ThemedView style={styles.modalOverlay}>
          <ThemedView style={styles.floatModalCard}>
            <ThemedView style={styles.floatModalHeader}>
              <ThemedText style={styles.modalTitle}>Dibujar firma manual</ThemedText>
              <TouchableOpacity onPress={() => setSignatureModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </ThemedView>
            <ThemedText style={styles.signatureModalHint}>Firma dentro del recuadro blanco.</ThemedText>
            <View style={styles.signaturePadBox}>
              <SignatureScreen
                ref={signatureRef}
                onOK={handleManualSignatureRead}
                onEmpty={onManualSignatureEmpty}
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
              <TouchableOpacity style={styles.modalClearButton} onPress={() => setSignatureModalVisible(false)}>
                <ThemedText style={styles.modalClearButtonText}>Cancelar</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalAcceptButton} onPress={acceptManualSignature}>
                <Ionicons name="checkmark" size={20} color="#000000" />
                <ThemedText style={styles.modalAcceptButtonText}>Confirmar</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          </ThemedView>
        </ThemedView>
      </Modal>

      <Modal visible={isCameraVisible} animationType="slide" onRequestClose={() => setIsCameraVisible(false)}>
        <View style={styles.cameraContainer}>
          <CameraView ref={cameraRef} style={styles.camera} facing="back" />
          <View style={styles.cameraControls}>
            <TouchableOpacity style={styles.cameraCancelButton} onPress={() => setIsCameraVisible(false)}>
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.cameraCaptureButton} onPress={capturePhoto}>
              <View style={styles.cameraCaptureButtonInner} />
            </TouchableOpacity>
            <View style={styles.cameraCancelButton} />
          </View>
        </View>
      </Modal>

      <Modal visible={isImagePreviewVisible} transparent animationType="fade" onRequestClose={() => setIsImagePreviewVisible(false)}>
        <ThemedView style={styles.modalOverlay}>
          <TouchableOpacity style={styles.imagePreviewClose} onPress={() => setIsImagePreviewVisible(false)}>
            <Ionicons name="close-circle" size={34} color="#FFFFFF" />
          </TouchableOpacity>
          {selectedImageUrl ? <Image source={{ uri: selectedImageUrl }} style={styles.imagePreview} resizeMode="contain" /> : null}
        </ThemedView>
      </Modal>

      <Modal visible={isSendNotesModalVisible} transparent animationType="slide" onRequestClose={() => setIsSendNotesModalVisible(false)}>
        <ThemedView style={styles.modalOverlay}>
          <ThemedView style={styles.sendModalContainer}>
            <ThemedView style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Enviar notas al cliente</ThemedText>
              <TouchableOpacity onPress={() => setIsSendNotesModalVisible(false)} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </ThemedView>
            <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ gap: 10, paddingBottom: 12 }}>
              <ThemedView style={styles.inputGroup}>
                <ThemedText style={styles.inputLabel}>Empresa:</ThemedText>
                <ThemedView style={styles.pickerContainer}>
                  <Picker selectedValue={sendEmpresaId} onValueChange={(v) => { setSendEmpresaId(v); setSendClienteId(null); setSendDivisionId(null); setSendContratoId(null); setSendSucursalId(null); setSendPuestoId(null); }}>
                    <Picker.Item label="Seleccionar empresa" value={null} />
                    {empresaOptions.map((item) => <Picker.Item key={item.id} label={item.nombre} value={item.id} />)}
                  </Picker>
                </ThemedView>
              </ThemedView>

              <ThemedView style={styles.inputGroup}>
                <ThemedText style={styles.inputLabel}>Cliente:</ThemedText>
                <ThemedView style={styles.pickerContainer}>
                  <Picker selectedValue={sendClienteId} onValueChange={(v) => { setSendClienteId(v); setSendDivisionId(null); setSendContratoId(null); setSendSucursalId(null); setSendPuestoId(null); }} enabled={clienteOptions.length > 0}>
                    <Picker.Item label="Seleccionar cliente" value={null} />
                    {clienteOptions.map((item) => <Picker.Item key={item.id} label={item.nombre} value={item.id} />)}
                  </Picker>
                </ThemedView>
              </ThemedView>

              <ThemedView style={styles.inputGroup}>
                <ThemedText style={styles.inputLabel}>División:</ThemedText>
                <ThemedView style={styles.pickerContainer}>
                  <Picker selectedValue={sendDivisionId} onValueChange={(v) => { setSendDivisionId(v); setSendContratoId(null); setSendSucursalId(null); setSendPuestoId(null); }} enabled={divisionOptions.length > 0}>
                    <Picker.Item label="Seleccionar división" value={null} />
                    {divisionOptions.map((item) => <Picker.Item key={item.id} label={item.nombre} value={item.id} />)}
                  </Picker>
                </ThemedView>
              </ThemedView>

              <ThemedView style={styles.inputGroup}>
                <ThemedText style={styles.inputLabel}>Contrato:</ThemedText>
                <ThemedView style={styles.pickerContainer}>
                  <Picker selectedValue={sendContratoId} onValueChange={(v) => { setSendContratoId(v); setSendSucursalId(null); setSendPuestoId(null); }} enabled={contratoOptions.length > 0}>
                    <Picker.Item label="Seleccionar contrato" value={null} />
                    {contratoOptions.map((item) => <Picker.Item key={item.id} label={item.nombre} value={item.id} />)}
                  </Picker>
                </ThemedView>
              </ThemedView>

              <ThemedView style={styles.inputGroup}>
                <ThemedText style={styles.inputLabel}>Sucursal:</ThemedText>
                <ThemedView style={styles.pickerContainer}>
                  <Picker selectedValue={sendSucursalId} onValueChange={(v) => { setSendSucursalId(v); setSendPuestoId(null); }} enabled={sucursalOptions.length > 0}>
                    <Picker.Item label="Seleccionar sucursal" value={null} />
                    {sucursalOptions.map((item) => <Picker.Item key={item.id} label={item.nombre} value={item.id} />)}
                  </Picker>
                </ThemedView>
              </ThemedView>

              <ThemedView style={styles.inputGroup}>
                <ThemedText style={styles.inputLabel}>Puesto:</ThemedText>
                <ThemedView style={styles.pickerContainer}>
                  <Picker selectedValue={sendPuestoId} onValueChange={(v) => setSendPuestoId(v)} enabled={puestoOptions.length > 0}>
                    <Picker.Item label="Seleccionar puesto" value={null} />
                    {puestoOptions.map((item) => <Picker.Item key={item.id} label={item.nombre} value={item.id} />)}
                  </Picker>
                </ThemedView>
              </ThemedView>

              <ThemedView style={styles.inputGroup}>
                <ThemedText style={styles.inputLabel}>Correo electrónico:</ThemedText>
                <TextInput
                  style={styles.input}
                  value={sendEmail}
                  onChangeText={setSendEmail}
                  placeholder="cliente@correo.com"
                  placeholderTextColor="#999"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </ThemedView>

              {isLoadingSendPreview ? (
                <ActivityIndicator size="small" color="#007AFF" />
              ) : sendNotesPreview.length > 0 ? (
                <ThemedView style={{ gap: 10 }}>
                  {sendNotesPreview.map((note) => {
                    const isExpanded = expandedSendPreviewIds.has(note.id);
                    const toggleExpanded = () => {
                      setExpandedSendPreviewIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(note.id)) {
                          next.delete(note.id);
                        } else {
                          next.add(note.id);
                        }
                        return next;
                      });
                    };

                    return (
                      <ThemedView key={`send-note-${note.id}`} style={styles.sendPreviewCard}>
                        <TouchableOpacity
                          style={styles.sendPreviewHeader}
                          onPress={toggleExpanded}
                          activeOpacity={0.8}
                        >
                          <ThemedView style={{ flex: 1, gap: 4 }}>
                            <ThemedText style={styles.sendPreviewTitle}>{note.titulo}</ThemedText>
                            {note.relevancia && (
                              <ThemedText style={styles.sendPreviewMeta}>Relevancia: {note.relevancia}</ThemedText>
                            )}
                            <ThemedText style={styles.sendPreviewMeta}>
                              Último cambio por: {note.is_modified ? note.empleado : (note.creador || note.empleado)}
                            </ThemedText>
                          </ThemedView>
                          <Ionicons
                            name={isExpanded ? 'chevron-up' : 'chevron-down'}
                            size={18}
                            color="#007AFF"
                          />
                        </TouchableOpacity>

                        {isExpanded && (
                          <ThemedView style={styles.sendPreviewBody}>
                            <ThemedText style={styles.sendPreviewDescription}>{note.description}</ThemedText>
                            {Array.isArray(note.images) && note.images.length > 0 && (
                              <ThemedView style={styles.imageRow}>
                                {note.images.map((img, i) => {
                                  const uri = resolveNoteImageUri(
                                    img,
                                    note.id,
                                    note.puesto_id || sendPuestoId || null
                                  );
                                  if (!uri) return null;
                                  return (
                                    <Image
                                      key={`preview-${note.id}-${i}`}
                                      source={{ uri }}
                                      style={styles.noteImageThumb}
                                    />
                                  );
                                })}
                              </ThemedView>
                            )}
                          </ThemedView>
                        )}
                      </ThemedView>
                    );
                  })}
                </ThemedView>
              ) : (
                <ThemedText style={styles.noteDate}>
                  Selecciona un puesto para cargar sus notas e imágenes.
                </ThemedText>
              )}
            </ScrollView>
            <TouchableOpacity style={styles.sendClientButton} onPress={handleSendNotesToClient}>
              <Ionicons name="send-outline" size={18} color="#FFFFFF" />
              <ThemedText style={styles.sendClientButtonText}>Enviar</ThemedText>
            </TouchableOpacity>
          </ThemedView>
        </ThemedView>
      </Modal>

      {/* Changes Modal */}
      <Modal
        visible={isChangesModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={closeChangesModal}
      >
        <ThemedView style={styles.modalOverlay}>
          <ThemedView style={styles.changesModalContainer}>
            <ThemedView style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Bitácora de cambios</ThemedText>
              <TouchableOpacity onPress={closeChangesModal} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </ThemedView>

            {isLoadingCambios ? (
              <ThemedView style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <ThemedText style={styles.loadingText}>Cargando cambios...</ThemedText>
              </ThemedView>
            ) : cambiosItems.length === 0 ? (
              <ThemedView style={styles.emptyContainer}>
                <ThemedText style={styles.emptyText}>No hay cambios registrados para esta nota</ThemedText>
              </ThemedView>
            ) : (
              <ScrollView style={styles.changesList}>
                {cambiosItems.map((row) => {
                  let parsed: any[] = [];
                  try {
                    parsed = row?.cambios ? JSON.parse(row.cambios) : [];
                  } catch {
                    parsed = [];
                  }
                  const isOpen = expandedCambioId === row.id;

                  return (
                    <ThemedView key={`chg-${row.id}`} style={styles.cambioCollapsableMain}>
                      <TouchableOpacity
                        style={styles.cambioCollapsableHeader}
                        onPress={() => setExpandedCambioId((prev) => (prev === row.id ? null : row.id))}
                        activeOpacity={0.8}
                      >
                        <ThemedText style={styles.cambioCollapsableTitle}>
                          {formatCambioCreatedAt(row.created_at)}
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
                              {row.empleado_cedula ? ` (${row.empleado_cedula})` : ''}
                            </ThemedText>
                          </ThemedView>

                          {(Array.isArray(parsed) ? parsed : []).length > 0 && (
                            <ThemedView style={styles.filterGroupSearch}>
                              <ThemedText style={styles.filterLabel}>Cambios:</ThemedText>
                              {(Array.isArray(parsed) ? parsed : []).map((c: any, idx: number) => {
                                const prop = String(c?.prop ?? '-');
                                const value = c?.after;

                                if (prop === '__created__' && value && typeof value === 'object') {
                                  const created: any = value;
                                  return (
                                    <React.Fragment key={`c-${row.id}-${idx}-created`}>
                                      <ThemedView style={styles.changeDescriptionContainer}>
                                        <ThemedText style={styles.changeDescription}>
                                          <ThemedText style={{ fontWeight: '800' }}>Registro creado</ThemedText>
                                        </ThemedText>
                                      </ThemedView>
                                      {Object.entries(created).map(([k, v]) => {
                                        if (k === 'firma_responsable') {
                                          const info = decodeFirmaHash(typeof v === 'string' ? v : v != null ? String(v) : null);
                                          return (
                                            <ThemedView key={`c-${row.id}-${idx}-${k}`} style={styles.changeDescriptionContainer}>
                                              <ThemedText style={styles.changeDescription}>
                                                <ThemedText style={{ fontWeight: '800' }}>{k}: </ThemedText>
                                                {info
                                                  ? `Sesión: ${info.sessionId || 'N/A'} - Empleado: ${info.empleadoId || 'N/A'} - Hora: ${info.timestamp || 'N/A'}`
                                                  : 'Firma (formato no decodificable)'}
                                              </ThemedText>
                                            </ThemedView>
                                          );
                                        }
                                        if (k === 'firma_manual_responsable') {
                                          const uri = v ? String(v) : null;
                                          return (
                                            <ThemedView key={`c-${row.id}-${idx}-${k}`} style={styles.changeDescriptionContainer}>
                                              <ThemedText style={styles.changeDescription}>
                                                <ThemedText style={{ fontWeight: '800' }}>{k}: </ThemedText>
                                                {uri ? 'Firma manual registrada' : 'Sin firma manual'}
                                              </ThemedText>
                                              {uri ? (
                                                <Image source={{ uri }} style={styles.cambioSignatureImage} resizeMode="contain" />
                                              ) : null}
                                            </ThemedView>
                                          );
                                        }
                                        return (
                                          <ThemedView key={`c-${row.id}-${idx}-${k}`} style={styles.changeDescriptionContainer}>
                                            <ThemedText style={styles.changeDescription}>
                                              <ThemedText style={{ fontWeight: '800' }}>{k}: </ThemedText>
                                              {String(v ?? '')}
                                            </ThemedText>
                                          </ThemedView>
                                        );
                                      })}
                                    </React.Fragment>
                                  );
                                }

                                if (prop === 'firma_responsable') {
                                  const info = decodeFirmaHash(typeof value === 'string' ? value : value != null ? String(value) : null);
                                  return (
                                    <ThemedView key={`c-${row.id}-${idx}`} style={styles.changeDescriptionContainer}>
                                      <ThemedText style={styles.changeDescription}>
                                        <ThemedText style={{ fontWeight: '800' }}>{prop}: </ThemedText>
                                        {info
                                          ? `Sesión: ${info.sessionId || 'N/A'} - Empleado: ${info.empleadoId || 'N/A'} - Hora: ${info.timestamp || 'N/A'}`
                                          : 'Firma (formato no decodificable)'}
                                      </ThemedText>
                                    </ThemedView>
                                  );
                                }

                                if (prop === 'firma_manual_responsable') {
                                  const uri = value ? String(value) : null;
                                  return (
                                    <ThemedView key={`c-${row.id}-${idx}`} style={styles.changeDescriptionContainer}>
                                      <ThemedText style={styles.changeDescription}>
                                        <ThemedText style={{ fontWeight: '800' }}>{prop}: </ThemedText>
                                        {uri ? 'Firma manual registrada' : 'Sin firma manual'}
                                      </ThemedText>
                                      {uri ? (
                                        <Image source={{ uri }} style={styles.cambioSignatureImage} resizeMode="contain" />
                                      ) : null}
                                    </ThemedView>
                                  );
                                }

                                return (
                                  <ThemedView key={`c-${row.id}-${idx}`} style={styles.changeDescriptionContainer}>
                                    <ThemedText style={styles.changeDescription}>
                                      <ThemedText style={{ fontWeight: '800' }}>{prop}: </ThemedText>
                                      {String(value ?? '')}
                                    </ThemedText>
                                  </ThemedView>
                                );
                              })}
                            </ThemedView>
                          )}
                        </ThemedView>
                      )}
                    </ThemedView>
                  );
                })}
              </ScrollView>
            )}
          </ThemedView>
        </ThemedView>
      </Modal>
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
  backButton: {
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
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
  puestoContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  puestoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  puestoName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
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
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F5C2C7',
    backgroundColor: '#F8D7DA',
  },
  errorBannerText: {
    flex: 1,
    color: '#B00020',
    fontSize: 14,
    fontWeight: '600',
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFEBAA',
    backgroundColor: '#FFF3CD',
  },
  offlineBannerText: {
    flex: 1,
    color: '#8A6D00',
    fontSize: 14,
    fontWeight: '600',
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
  filtersContainer: {

  },
  filtersMain: {
    width: '100%',
    marginBottom: 20,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  filterHeader: {
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
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#F8F9FA',
  },
  filterToggleText: {
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
  filterContent: {
    padding: 16,
    gap: 10,
    backgroundColor: '#F8F9FA',
  },
  filterGroupSearch: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  filterGroupDivision: {
    width: '40%',
    backgroundColor: '#fff',
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  searchInput: {
    width: '100%',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: '#F9F9F9',
    color: '#000000',
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
  createButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  notesContainer: {
    width: '100%',
    gap: 16,
  },
  noteCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  newNoteCard: {
    marginBottom: 20,
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
  },
  noteHeaderContent: {
    flex: 1,
    gap: 8,
    backgroundColor: '#fff',
  },
  noteTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  noteMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
    backgroundColor: '#fff',
  },
  divisionBadge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  divisionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  categoryBadge: {
    backgroundColor: '#34C759',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  categoryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  noteDate: {
    fontSize: 12,
    opacity: 0.6,
    color: '#666',
  },
  expandIcon: {
    fontSize: 16,
    color: '#666',
    marginLeft: 12,
  },
  noteBody: {
    padding: 16,
    paddingTop: 0,
    gap: 16,
    backgroundColor: '#fff',
  },
  noteDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: '#666',
  },
  lastChangeContainer: {
    backgroundColor: '#FFF3E0',
    padding: 10,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#FF9500',
    marginTop: 8,
  },
  lastChangeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  lastChangeEmployee: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF9500',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    backgroundColor: '#fff',
  },
  editButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#FF3B30',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  editContainer: {
    padding: 16,
    gap: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  newNoteTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 8,
  },
  inputGroup: {
    gap: 8,
    backgroundColor: '#fff',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  input: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 6,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#000000',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  cancelButton: {
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
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.5,
    textAlign: 'center',
  },
  dateFilterContainer: {
    width: '100%',
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  dateFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
  },
  dateButton: {
    flex: 1,
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
    color: '#333',
  },
  clearDateButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#fff',
  },
  changesButton: {
    backgroundColor: '#FF9500',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  changesButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  floatModalCard: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  floatModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#F8F9FA',
  },
  changesModalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  changesList: {
    maxHeight: 400,
    margin: 10,
  },
  changeItem: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  cambioAccordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 4,
  },
  cambioAccordionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
    flex: 1,
  },
  changeHeader: {
    marginBottom: 8,
  },
  changeTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    backgroundColor: '#fff',
  },
  changeDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: '#666',
    marginBottom: 8,
  },
  changeDate: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1976D2',
    backgroundColor: '#E3F2FD',
  },
  changeMetadata: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: '#fff',
  },
  changeEmployee: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1976D2',
    backgroundColor: '#E3F2FD',
  },
  changeInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
    backgroundColor: '#fff',
  },
  changeCategoryContainer: {
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  changeCategoryBadge: {
    backgroundColor: '#34C759',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  changeCategoryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  changeRelevanciaBadge: {
    backgroundColor: '#FF9500',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  changeRelevanciaText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
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
  changeDescriptionContainer: {
    marginBottom: 4,
  },
  cambioSignatureImage: {
    width: '100%',
    height: 120,
    marginTop: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  changeInfoContainer: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 6,
    marginTop: 8,
    gap: 4,
  },
  puestosListContainer: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  puestoListItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#fff',
  },
  puestoListItemLast: {
    borderBottomWidth: 0,
  },
  puestoListItemSelected: {
    backgroundColor: '#E6F0FF',
  },
  puestoCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#BFD2F3',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 4,
    backgroundColor: '#fff',
  },
  puestoCheckboxChecked: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  puestoInfo: {
    flex: 1,
  },
  puestoCheckboxName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  firmaButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  firmaBlueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 6,
  },
  firmaBlueButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  signaturePreview: {
    width: '100%',
    height: 140,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  signaturePadBox: {
    marginTop: 10,
    marginHorizontal: 16,
    height: 260,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    overflow: 'hidden',
  },
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
  modalClearButtonText: {
    fontWeight: '800',
    color: '#000',
  },
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
  modalAcceptButtonText: {
    fontWeight: '800',
    color: '#000',
  },
  signatureCollapsableCard: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
    overflow: 'hidden',
  },
  signatureCollapsableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F0F0F0',
  },
  signatureCollapsableHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    flex: 1,
    paddingRight: 8,
  },
  signatureCollapsableBody: {
    padding: 12,
    backgroundColor: '#F9F9F9',
    gap: 2,
  },
  signatureInfoValue: {
    fontSize: 13,
    color: '#333',
  },
  captureImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#F4F8FF',
  },
  captureImageText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  imageRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  noteImageThumb: {
    width: 84,
    height: 84,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D6D6D6',
    backgroundColor: '#F3F3F3',
  },
  sendPreviewCard: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  sendPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F8F9FA',
  },
  sendPreviewTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  sendPreviewMeta: {
    fontSize: 12,
    color: '#6B7280',
  },
  sendPreviewBody: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: '#FFFFFF',
  },
  sendPreviewDescription: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
  signatureModalContainer: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingBottom: 12,
  },
  signatureModalHint: {
    paddingHorizontal: 16,
    paddingTop: 12,
    color: '#666',
    fontSize: 13,
  },
  cameraContainer: { flex: 1, backgroundColor: '#000000' },
  camera: { flex: 1 },
  cameraControls: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingBottom: 30,
  },
  cameraCancelButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  cameraCaptureButton: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraCaptureButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
  },
  imagePreview: {
    width: '96%',
    height: '80%',
  },
  imagePreviewClose: {
    position: 'absolute',
    top: 30,
    right: 20,
    zIndex: 10,
  },
  sendClientButton: {
    backgroundColor: '#0A84FF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  sendClientButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  sendModalContainer: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '86%',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
  },
});

