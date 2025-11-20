import React, { useState, useCallback, useRef } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
  View,
  Image,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import SignatureScreen from "react-native-signature-canvas";
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
import * as Network from 'expo-network';
import {
  createOpeningClosingPosition,
  updateOpeningClosingPosition,
  deleteOpeningClosingPosition,
  listOpeningClosingPositionByCorpo,
} from '@/hooks/evaluationFunctions';
import { eventBus } from '@/hooks/eventBus';

type OpeningClosingPositionScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'OpeningClosingPosition'>;

interface Actividad {
  ok_na: boolean;
  actividad: string;
  observaciones: string;
  representante_cliente: string;
  representante_empresa_saliente: string;
}

interface InventarioItem {
  activos_equipos: string;
  tipo: string;
  numero_activo: string;
  numero_serie: string;
  marca: string;
  modelo: string;
  descripcion: string;
}

interface OpeningClosingPosition {
  id: string;
  id_local: string;
  cliente: string | null;
  numero_corpo: string | null;
  numero_puesto: string | null;
  fecha_realizado: string | null;
  nombre_corpo: string | null;
  nombre_puesto: string | null;
  tipo: string | null;
  actividades: string | null;
  inventario: string | null;
  fotos: string | null;
  otras_observaciones: string | null;
  nombre_representante_cliente: string | null;
  firma_cliente: string | null;
  created_at: string;
  synced?: boolean;
}

interface EditingOpeningClosingPosition {
  id: string | null;
  id_local: string;
  cliente: string;
  numero_corpo: string;
  numero_puesto: string;
  fecha_realizado: string;
  nombre_corpo: string;
  nombre_puesto: string;
  tipo: string[];
  actividades: Actividad[];
  inventario: InventarioItem[];
  fotos: string[];
  otras_observaciones: string;
  nombre_representante_cliente: string;
  firma_cliente: string;
}

const ACTIVIDADES_PREDEFINIDAS = [
  "Presentese al lugar y presente al misceláneo que va a prestar el servicio.",
  "Verifique ubicación de: -Oficina de Aseo (si aplica) -Cuartos de aseo -Comedor (lugar para toma de tiempos de alimentación trabajador)",
  "Realice una revisión de las condiciones: -Fuentes de electricidad (para uso de cepillo, aspiradoras, etc) -Mobiliario",
  "Realice un recorrido del puesto.",
  "Entrega/Retiro de equipos e insumos.",
  "Entrega/Retiro de Papelería: -AYL-F-002-Rol de Trabajo Mensual -AYL-F-013-Control de asistencia -AYL-M-001-Manual de Puestos Aseo y Limpieza -AYL-F-035-Guia de Funciones del puesto -AYL-F-028 Registro de Tareas de Limpieza -AYL-PO-001-Código de Vestimenta Aseo y Limpieza -AYL-F-018-Estándar de Dilución de Químicos -AYL-F-009-Solicitud de Permiso",
];

export default function OpeningClosingPositionScreen() {
  const { employee, refreshAccessToken, logout } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<OpeningClosingPositionScreenNavigationProp>();

  // Data states
  const [positions, setPositions] = useState<OpeningClosingPosition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasCurrentMarca, setHasCurrentMarca] = useState<boolean>(false);

  // Editing state
  const [editingRecord, setEditingRecord] = useState<EditingOpeningClosingPosition | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form states
  const [cliente, setCliente] = useState('');
  const [numeroCorpo, setNumeroCorpo] = useState('');
  const [numeroPuesto, setNumeroPuesto] = useState('');
  const [fechaRealizado, setFechaRealizado] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [nombreCorpo, setNombreCorpo] = useState('');
  const [nombrePuesto, setNombrePuesto] = useState('');
  const [tipo, setTipo] = useState<string[]>([]);
  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [inventario, setInventario] = useState<InventarioItem[]>([]);
  const [fotos, setFotos] = useState<string[]>([]);
  const [otrasObservaciones, setOtrasObservaciones] = useState('');
  const [nombreRepresentanteCliente, setNombreRepresentanteCliente] = useState('');
  const [firmaCliente, setFirmaCliente] = useState<string | null>(null);

  // Expanded states
  const [expandedActividadIndices, setExpandedActividadIndices] = useState<number[]>([]);
  const [expandedInventarioIndices, setExpandedInventarioIndices] = useState<number[]>([]);

  // Camera states
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);

  // Signature modal states
  const [isSignatureModalVisible, setIsSignatureModalVisible] = useState(false);
  const signatureRef = useRef<any>(null);
  const [signatureKey, setSignatureKey] = useState(0);

  const signatureWebStyle = `
    body, html {
      margin: 0;
      padding: 0;
      height: 100%;
      width: 100%;
    }
    .m-signature-pad {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      margin: 0;
      padding: 0;
      box-shadow: none;
      border: none;
      background-color: #FFFFFF;
    }
    .m-signature-pad--body {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      border: none;
      margin: 0;
      padding: 0;
    }
    .m-signature-pad--body canvas {
      width: 100% !important;
      height: 100% !important;
      touch-action: none;
    }
    .m-signature-pad--footer {
      display: none;
    }
  `;

  const getConnectionStatus = async (): Promise<boolean> => {
    const networkState = await Network.getNetworkStateAsync();
    return networkState.isConnected && networkState.isInternetReachable ? true : false;
  };

  const generateRandomId = (): string => {
    return `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const formatDate = (date: Date): string => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Helper para extraer solo el base64 de las firmas
  const getBase64Only = (signature: string | null): string | null => {
    if (!signature) return null;
    if (signature.startsWith('data:')) {
      const parts = signature.split(',');
      return parts.length > 1 ? parts[1] : signature;
    }
    return signature;
  };

  // Helper para formatear la firma para mostrar
  const formatSignatureForDisplay = (signature: string | null): string | null => {
    if (!signature) return null;
    if (signature.startsWith('data:')) {
      return signature;
    }
    return `data:image/png;base64,${signature}`;
  };

  const fetchPositions = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const currentMarca = await AsyncStorage.getItem('current_marca');
      if (!currentMarca) {
        setHasCurrentMarca(false);
        setIsLoading(false);
        return;
      }

      setHasCurrentMarca(true);
      const currentMarcaData = JSON.parse(currentMarca);
      const corpoId = currentMarcaData.corpo?.id?.toString();

      if (!corpoId) {
        setError('No se encontró el ID del corpo');
        setIsLoading(false);
        return;
      }

      const isConnected = await getConnectionStatus();

      if (isConnected) {
        const result = await listOpeningClosingPositionByCorpo({
          corpo_id: corpoId,
          refreshAccessToken,
          logout,
        });

        if (result.status && result.data) {
          setPositions(result.data as OpeningClosingPosition[]);
        } else {
          setPositions([]);
        }
      } else {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const positionsCache = cache.filter((item: any) => item.type === 'opening_closing_position');
          setPositions(positionsCache);
        } else {
          setPositions([]);
        }
      }
    } catch (err) {
      console.error('Error fetching positions:', err);
      setError('Error al cargar las aperturas-cierres de puesto');
      try {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const positionsCache = cache.filter((item: any) => item.type === 'opening_closing_position');
          setPositions(positionsCache);
        }
      } catch (cacheErr) {
        console.error('Error loading from cache:', cacheErr);
      }
    } finally {
      setIsLoading(false);
    }
  }, [refreshAccessToken, logout]);

  useFocusEffect(
    useCallback(() => {
      fetchPositions();
      eventBus.on('connectionRestored', fetchPositions);
      return () => {
        eventBus.off('connectionRestored', fetchPositions);
      };
    }, [fetchPositions])
  );

  const resetForm = () => {
    setCliente('');
    setNumeroCorpo('');
    setNumeroPuesto('');
    setFechaRealizado(new Date());
    setNombreCorpo('');
    setNombrePuesto('');
    setTipo([]);
    // Cargar actividades predefinidas por defecto
    const actividadesPredefinidas: Actividad[] = ACTIVIDADES_PREDEFINIDAS.map(actividad => ({
      ok_na: false,
      actividad: actividad,
      observaciones: '',
      representante_cliente: '',
      representante_empresa_saliente: '',
    }));
    setActividades(actividadesPredefinidas);
    setExpandedActividadIndices(actividadesPredefinidas.map((_, i) => i));
    setInventario([]);
    setFotos([]);
    setOtrasObservaciones('');
    setNombreRepresentanteCliente('');
    setFirmaCliente(null);
    setExpandedInventarioIndices([]);
  };

  const startCreating = () => {
    setIsCreating(true);
    setEditingRecord(null);
    resetForm();
  };

  const cancelCreating = () => {
    setIsCreating(false);
    resetForm();
  };

  const startEditing = (record: OpeningClosingPosition) => {
    setIsCreating(false);
    let actividadesArray: Actividad[] = [];
    let inventarioArray: InventarioItem[] = [];
    let fotosArray: string[] = [];

    if (record.actividades) {
      try {
        actividadesArray = JSON.parse(record.actividades);
        if (!Array.isArray(actividadesArray)) actividadesArray = [];
      } catch (e) {
        actividadesArray = [];
      }
    }

    if (record.inventario) {
      try {
        inventarioArray = JSON.parse(record.inventario);
        if (!Array.isArray(inventarioArray)) inventarioArray = [];
      } catch (e) {
        inventarioArray = [];
      }
    }

    if (record.fotos) {
      try {
        fotosArray = JSON.parse(record.fotos);
        if (!Array.isArray(fotosArray)) fotosArray = [];
      } catch (e) {
        fotosArray = [];
      }
    }

    let tipoArray: string[] = [];
    if (record.tipo) {
      tipoArray = record.tipo.split(',').filter(t => t.trim() !== '');
    }

    setEditingRecord({
      id: record.id,
      id_local: record.id_local,
      cliente: record.cliente || '',
      numero_corpo: record.numero_corpo || '',
      numero_puesto: record.numero_puesto || '',
      fecha_realizado: record.fecha_realizado || '',
      nombre_corpo: record.nombre_corpo || '',
      nombre_puesto: record.nombre_puesto || '',
      tipo: tipoArray,
      actividades: actividadesArray,
      inventario: inventarioArray,
      fotos: fotosArray,
      otras_observaciones: record.otras_observaciones || '',
      nombre_representante_cliente: record.nombre_representante_cliente || '',
      firma_cliente: record.firma_cliente || '',
    });

    setCliente(record.cliente || '');
    setNumeroCorpo(record.numero_corpo || '');
    setNumeroPuesto(record.numero_puesto || '');
    if (record.fecha_realizado) {
      const dateParts = record.fecha_realizado.split('/');
      if (dateParts.length === 3) {
        setFechaRealizado(new Date(parseInt(dateParts[2]), parseInt(dateParts[1]) - 1, parseInt(dateParts[0])));
      }
    }
    setNombreCorpo(record.nombre_corpo || '');
    setNombrePuesto(record.nombre_puesto || '');
    setTipo(tipoArray);
    setActividades(actividadesArray);
    setInventario(inventarioArray);
    setFotos(fotosArray);
    setOtrasObservaciones(record.otras_observaciones || '');
    setNombreRepresentanteCliente(record.nombre_representante_cliente || '');
    setFirmaCliente(formatSignatureForDisplay(record.firma_cliente));
    setExpandedActividadIndices(actividadesArray.map((_, i) => i));
    setExpandedInventarioIndices(inventarioArray.map((_, i) => i));
  };

  const cancelEditing = () => {
    setEditingRecord(null);
    resetForm();
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setFechaRealizado(selectedDate);
    }
  };

  const toggleTipo = (tipoValue: string) => {
    setTipo(prev => 
      prev.includes(tipoValue) 
        ? prev.filter(t => t !== tipoValue)
        : [...prev, tipoValue]
    );
  };

  const addActividad = () => {
    const newActividad: Actividad = {
      ok_na: false,
      actividad: '',
      observaciones: '',
      representante_cliente: '',
      representante_empresa_saliente: '',
    };
    setActividades([...actividades, newActividad]);
    setExpandedActividadIndices([...expandedActividadIndices, actividades.length]);
  };

  const updateActividad = (index: number, field: keyof Actividad, value: string | boolean) => {
    const newActividades = [...actividades];
    newActividades[index] = {
      ...newActividades[index],
      [field]: value,
    };
    setActividades(newActividades);
  };

  const removeActividad = (index: number) => {
    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas eliminar esta actividad?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            setActividades(actividades.filter((_, i) => i !== index));
            setExpandedActividadIndices(expandedActividadIndices.filter(i => i !== index).map(i => i > index ? i - 1 : i));
          },
        },
      ]
    );
  };

  const toggleActividadExpansion = (index: number) => {
    setExpandedActividadIndices(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const addInventario = () => {
    const newInventario: InventarioItem = {
      activos_equipos: '',
      tipo: '',
      numero_activo: '',
      numero_serie: '',
      marca: '',
      modelo: '',
      descripcion: '',
    };
    setInventario([...inventario, newInventario]);
    setExpandedInventarioIndices([...expandedInventarioIndices, inventario.length]);
  };

  const updateInventario = (index: number, field: keyof InventarioItem, value: string) => {
    const newInventario = [...inventario];
    newInventario[index] = {
      ...newInventario[index],
      [field]: value,
    };
    setInventario(newInventario);
  };

  const removeInventario = (index: number) => {
    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas eliminar este item del inventario?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            setInventario(inventario.filter((_, i) => i !== index));
            setExpandedInventarioIndices(expandedInventarioIndices.filter(i => i !== index).map(i => i > index ? i - 1 : i));
          },
        },
      ]
    );
  };

  const toggleInventarioExpansion = (index: number) => {
    setExpandedInventarioIndices(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const openCamera = async () => {
    try {
      if (!permission?.granted) {
        const result = await requestPermission();
        if (!result.granted) {
          Alert.alert('Permiso denegado', 'Se necesita permiso para usar la cámara');
          return;
        }
      }
      setIsCameraVisible(true);
    } catch (error) {
      console.error('Error al abrir la cámara:', error);
      Alert.alert('Error', 'No se pudo abrir la cámara. Por favor intente nuevamente.');
    }
  };

  const capturePhoto = async () => {
    if (!cameraRef.current) {
      Alert.alert('Error', 'La cámara no está lista. Por favor intente nuevamente.');
      return;
    }

    try {
      const photo = await cameraRef.current.takePictureAsync({ 
        base64: true,
        quality: 0.7,
        skipProcessing: false
      });
      
      if (!photo || !photo.base64) {
        Alert.alert('Error', 'No se pudo capturar la foto. Por favor intente nuevamente.');
        setIsCameraVisible(false);
        return;
      }

      const base64Image = `data:image/jpeg;base64,${photo.base64}`;
      setIsCameraVisible(false);
      
      setTimeout(() => {
        setFotos([...fotos, base64Image]);
      }, 100);
    } catch (error) {
      console.error('Error al capturar foto:', error);
      Alert.alert('Error', 'No se pudo capturar la foto. Por favor intente nuevamente.');
      setIsCameraVisible(false);
    }
  };

  const removePhoto = (index: number) => {
    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas eliminar esta foto?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            setFotos(fotos.filter((_, i) => i !== index));
          },
        },
      ]
    );
  };

  const openSignatureModal = () => {
    setIsSignatureModalVisible(true);
    setSignatureKey(prev => prev + 1);
  };

  const closeSignatureModal = () => {
    setIsSignatureModalVisible(false);
  };

  const clearSignatureInModal = () => {
    setSignatureKey(prev => prev + 1);
    if (signatureRef.current) {
      signatureRef.current.clearSignature();
    }
  };

  const handleSignatureRead = (signature: string) => {
    if (signature) {
      let formattedSignature = signature;
      if (!signature.startsWith('data:')) {
        formattedSignature = `data:image/png;base64,${signature}`;
      }
      setFirmaCliente(formattedSignature);
      setIsSignatureModalVisible(false);
    } else {
      Alert.alert('Error', 'No se pudo obtener la firma. Por favor, intente nuevamente.');
    }
  };

  const acceptSignature = () => {
    if (signatureRef.current) {
      signatureRef.current.readSignature();
    } else {
      Alert.alert('Error', 'Debe dibujar una firma antes de aceptar');
    }
  };

  const savePositionHandler = async () => {
    const currentMarca = await AsyncStorage.getItem('current_marca');
    if (!currentMarca) {
      Alert.alert('Error', 'No se encontró la marca actual');
      return;
    }

    const currentMarcaData = JSON.parse(currentMarca);

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas guardar esta apertura-cierre de puesto?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              // Preparar fotos para guardar (solo base64 sin prefijo)
              const fotosToSave = fotos.map(foto => {
                if (foto.startsWith('data:')) {
                  const parts = foto.split(',');
                  return parts.length > 1 ? parts[1] : foto;
                }
                return foto;
              });

              const requestData = {
                marca_id: currentMarcaData.id,
                cliente: cliente.trim() || null,
                numero_corpo: numeroCorpo.trim() || null,
                numero_puesto: numeroPuesto.trim() || null,
                fecha_realizado: formatDate(fechaRealizado) || null,
                nombre_corpo: nombreCorpo.trim() || null,
                nombre_puesto: nombrePuesto.trim() || null,
                tipo: tipo.length > 0 ? tipo.join(',') : null,
                actividades: actividades.length > 0 ? JSON.stringify(actividades) : null,
                inventario: inventario.length > 0 ? JSON.stringify(inventario) : null,
                fotos: fotosToSave.length > 0 ? JSON.stringify(fotosToSave) : null,
                otras_observaciones: otrasObservaciones.trim() || null,
                nombre_representante_cliente: nombreRepresentanteCliente.trim() || null,
                firma_cliente: getBase64Only(firmaCliente),
              };

              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await createOpeningClosingPosition({
                  requestData,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Apertura-Cierre de Puesto guardado correctamente');
                  cancelCreating();
                  fetchPositions();
                } else {
                  Alert.alert('Error', result.message || 'Error al guardar la apertura-cierre de puesto');
                }
              } else {
                const localId = generateRandomId();

                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: localId,
                  action: 'create',
                  type: 'opening_closing_position',
                  payload: requestData,
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                const cache = cacheStr ? JSON.parse(cacheStr) : [];

                const newRecordCache: OpeningClosingPosition = {
                  id: '',
                  id_local: localId,
                  cliente: cliente.trim() || null,
                  numero_corpo: numeroCorpo.trim() || null,
                  numero_puesto: numeroPuesto.trim() || null,
                  fecha_realizado: formatDate(fechaRealizado) || null,
                  nombre_corpo: nombreCorpo.trim() || null,
                  nombre_puesto: nombrePuesto.trim() || null,
                  tipo: tipo.length > 0 ? tipo.join(',') : null,
                  actividades: actividades.length > 0 ? JSON.stringify(actividades) : null,
                  inventario: inventario.length > 0 ? JSON.stringify(inventario) : null,
                  fotos: fotosToSave.length > 0 ? JSON.stringify(fotosToSave) : null,
                  otras_observaciones: otrasObservaciones.trim() || null,
                  nombre_representante_cliente: nombreRepresentanteCliente.trim() || null,
                  firma_cliente: getBase64Only(firmaCliente),
                  created_at: new Date().toISOString(),
                  synced: false,
                };

                cache.push({ ...newRecordCache, type: 'opening_closing_position' });
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(cache));

                Alert.alert('Modo Offline', 'Apertura-Cierre de Puesto registrado localmente. Se sincronizará cuando haya conexión.');
                cancelCreating();
                fetchPositions();
              }
            } catch (err) {
              console.error('Error saving position:', err);
              Alert.alert('Error', 'No se pudo guardar la apertura-cierre de puesto');
            }
          },
        },
      ]
    );
  };

  const updatePositionHandler = async () => {
    if (!editingRecord) return;

    const recordId = editingRecord.id || editingRecord.id_local;
    if (!recordId) {
      Alert.alert('Error', 'ID de registro no encontrado para actualizar');
      return;
    }

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas actualizar esta apertura-cierre de puesto?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              // Preparar fotos para guardar (solo base64 sin prefijo)
              const fotosToSave = fotos.map(foto => {
                if (foto.startsWith('data:')) {
                  const parts = foto.split(',');
                  return parts.length > 1 ? parts[1] : foto;
                }
                return foto;
              });

              const requestData = {
                cliente: cliente.trim() || null,
                numero_corpo: numeroCorpo.trim() || null,
                numero_puesto: numeroPuesto.trim() || null,
                fecha_realizado: formatDate(fechaRealizado) || null,
                nombre_corpo: nombreCorpo.trim() || null,
                nombre_puesto: nombrePuesto.trim() || null,
                tipo: tipo.length > 0 ? tipo.join(',') : null,
                actividades: actividades.length > 0 ? JSON.stringify(actividades) : null,
                inventario: inventario.length > 0 ? JSON.stringify(inventario) : null,
                fotos: fotosToSave.length > 0 ? JSON.stringify(fotosToSave) : null,
                otras_observaciones: otrasObservaciones.trim() || null,
                nombre_representante_cliente: nombreRepresentanteCliente.trim() || null,
                firma_cliente: getBase64Only(firmaCliente),
              };

              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await updateOpeningClosingPosition({
                  id: recordId,
                  requestData,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Apertura-Cierre de Puesto actualizado correctamente');
                  cancelEditing();
                  fetchPositions();
                } else {
                  Alert.alert('Error', result.message || 'Error al actualizar la apertura-cierre de puesto');
                }
              } else {
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: recordId,
                  action: 'update',
                  type: 'opening_closing_position',
                  payload: requestData,
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                if (cacheStr) {
                  const cache = JSON.parse(cacheStr);
                  const updatedCache = cache.map((item: any) => {
                    if ((item.id === recordId || item.id_local === recordId) && item.type === 'opening_closing_position') {
                      return {
                        ...item,
                        ...requestData,
                        synced: false,
                      };
                    }
                    return item;
                  });
                  await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                }

                Alert.alert('Modo Offline', 'Apertura-Cierre de Puesto actualizado localmente. Se sincronizará cuando haya conexión.');
                cancelEditing();
                fetchPositions();
              }
            } catch (err) {
              console.error('Error updating position:', err);
              Alert.alert('Error', 'No se pudo actualizar la apertura-cierre de puesto');
            }
          },
        },
      ]
    );
  };

  const deletePositionHandler = async (record: OpeningClosingPosition) => {
    const recordId = record.id || record.id_local;
    if (!recordId) {
      Alert.alert('Error', 'ID de registro no encontrado para eliminar');
      return;
    }

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas eliminar esta apertura-cierre de puesto?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await deleteOpeningClosingPosition({
                  id: recordId,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Apertura-Cierre de Puesto eliminado correctamente');
                  fetchPositions();
                } else {
                  Alert.alert('Error', result.message || 'Error al eliminar la apertura-cierre de puesto');
                }
              } else {
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: recordId,
                  action: 'delete',
                  type: 'opening_closing_position',
                  payload: {},
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                if (cacheStr) {
                  const cache = JSON.parse(cacheStr);
                  const updatedCache = cache.filter((item: any) => !((item.id === recordId || item.id_local === recordId) && item.type === 'opening_closing_position'));
                  await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                }

                Alert.alert('Modo Offline', 'Apertura-Cierre de Puesto marcado para eliminación localmente. Se sincronizará cuando haya conexión.');
                fetchPositions();
              }
            } catch (err) {
              console.error('Error deleting position:', err);
              Alert.alert('Error', 'No se pudo eliminar la apertura-cierre de puesto');
            }
          },
        },
      ]
    );
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

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'position': return <Ionicons name="business" size={24} color='#000000' />;
      case 'add': return <Ionicons name="add" size={24} color='#FFFFFF' />;
      case 'cancel': return <Ionicons name="close" size={24} color='#FFFFFF' />;
      case 'confirm': return <Ionicons name="checkmark" size={24} color='#FFFFFF' />;
      case 'delete': return <Ionicons name="trash" size={24} color='#FFFFFF' />;
      case 'edit': return <Ionicons name="pencil" size={20} color="#FFFFFF" />;
      default: return <Ionicons name="business" size={24} color='#000000' />;
    }
  };

  const renderPositionList = () => {
    if (isLoading) {
      return (
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Cargando aperturas-cierres de puesto...</ThemedText>
        </ThemedView>
      );
    }

    if (error) {
      return (
        <ThemedView style={styles.errorContainer}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        </ThemedView>
      );
    }

    if (positions.length === 0) {
      return (
        <ThemedView style={styles.emptyContainer}>
          <ThemedText style={styles.emptyText}>No hay aperturas-cierres de puesto registrados.</ThemedText>
        </ThemedView>
      );
    }

    return (
      <ThemedView style={styles.listContainer}>
        {positions.map((record) => {
          let actividadesArray: Actividad[] = [];
          let inventarioArray: InventarioItem[] = [];
          if (record.actividades) {
            try {
              actividadesArray = JSON.parse(record.actividades);
            } catch (e) {
              actividadesArray = [];
            }
          }
          if (record.inventario) {
            try {
              inventarioArray = JSON.parse(record.inventario);
            } catch (e) {
              inventarioArray = [];
            }
          }

          return (
            <ThemedView key={record.id || record.id_local} style={styles.listItem}>
              <ThemedView style={styles.listItemHeader}>
                <ThemedView style={styles.listItemContent}>
                  <ThemedText style={styles.listItemTitle}>
                    Apertura-Cierre de Puesto
                  </ThemedText>
                  <ThemedText style={styles.listItemSubtitle}>
                    Cliente: {record.cliente || 'N/A'} | Fecha: {record.fecha_realizado || 'N/A'} | Tipo: {record.tipo || 'N/A'}
                  </ThemedText>
                </ThemedView>
                <ThemedView style={styles.listItemActions}>
                  {!record.synced && (
                    <ThemedView style={styles.offlineBadge}>
                      <ThemedText style={styles.offlineBadgeText}>Offline</ThemedText>
                    </ThemedView>
                  )}
                </ThemedView>
              </ThemedView>

              <ThemedView style={styles.listItemDetails}>
                <ThemedView style={styles.listItemButtons}>
                  <TouchableOpacity
                    style={[styles.listItemButton, styles.editButton]}
                    onPress={() => startEditing(record)}
                  >
                    {getActionIcon('edit')}
                    <ThemedText style={styles.listItemButtonText}>Editar</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.listItemButton, styles.deleteButton]}
                    onPress={() => deletePositionHandler(record)}
                  >
                    {getActionIcon('delete')}
                    <ThemedText style={styles.listItemButtonText}>Eliminar</ThemedText>
                  </TouchableOpacity>
                </ThemedView>
              </ThemedView>
            </ThemedView>
          );
        })}
      </ThemedView>
    );
  };

  const renderActividad = (actividad: Actividad, index: number) => {
    const isExpanded = expandedActividadIndices.includes(index);

    return (
      <ThemedView key={index} style={styles.actividadItem}>
        <TouchableOpacity
          style={styles.actividadHeader}
          onPress={() => toggleActividadExpansion(index)}
        >
          <ThemedView style={styles.actividadHeaderContent}>
            <ThemedText style={styles.actividadHeaderText}>
              Actividad {index + 1}
            </ThemedText>
          </ThemedView>
          <ThemedView style={styles.actividadHeaderActions}>
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                removeActividad(index);
              }}
              style={styles.removeActividadButton}
            >
              <Ionicons name="trash" size={20} color="#FF3B30" />
            </TouchableOpacity>
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={24}
              color="#000000"
            />
          </ThemedView>
        </TouchableOpacity>

        {isExpanded && (
          <ThemedView style={styles.actividadContent}>
            {/* OK o NA checkbox */}
            <ThemedView style={styles.formGroup}>
              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => updateActividad(index, 'ok_na', !actividad.ok_na)}
              >
                <View style={styles.checkbox}>
                  {actividad.ok_na && (
                    <Ionicons name="checkmark" size={20} color="#FF9500" />
                  )}
                </View>
                <ThemedText style={styles.checkboxLabel}>OK o NA</ThemedText>
              </TouchableOpacity>
            </ThemedView>

            {/* Actividad */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Actividad</ThemedText>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                placeholder="Actividad"
                placeholderTextColor="#999"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                value={actividad.actividad}
                onChangeText={(text) => updateActividad(index, 'actividad', text)}
              />
            </ThemedView>

            {/* Observaciones */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Observaciones</ThemedText>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                placeholder="Observaciones"
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                value={actividad.observaciones}
                onChangeText={(text) => updateActividad(index, 'observaciones', text)}
              />
            </ThemedView>

            {/* Representante del cliente */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Representante del cliente</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder="Representante del cliente"
                placeholderTextColor="#999"
                value={actividad.representante_cliente}
                onChangeText={(text) => updateActividad(index, 'representante_cliente', text)}
              />
            </ThemedView>

            {/* Representante de empresa saliente */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Representante de empresa saliente</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder="Representante de empresa saliente"
                placeholderTextColor="#999"
                value={actividad.representante_empresa_saliente}
                onChangeText={(text) => updateActividad(index, 'representante_empresa_saliente', text)}
              />
            </ThemedView>
          </ThemedView>
        )}
      </ThemedView>
    );
  };

  const renderInventario = (item: InventarioItem, index: number) => {
    const isExpanded = expandedInventarioIndices.includes(index);

    return (
      <ThemedView key={index} style={styles.inventarioItem}>
        <TouchableOpacity
          style={styles.inventarioHeader}
          onPress={() => toggleInventarioExpansion(index)}
        >
          <ThemedView style={styles.inventarioHeaderContent}>
            <ThemedText style={styles.inventarioHeaderText}>
              Item {index + 1}: {item.activos_equipos || 'Sin nombre'}
            </ThemedText>
          </ThemedView>
          <ThemedView style={styles.inventarioHeaderActions}>
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                removeInventario(index);
              }}
              style={styles.removeInventarioButton}
            >
              <Ionicons name="trash" size={20} color="#FF3B30" />
            </TouchableOpacity>
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={24}
              color="#000000"
            />
          </ThemedView>
        </TouchableOpacity>

        {isExpanded && (
          <ThemedView style={styles.inventarioContent}>
            {/* Activos o equipos */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Activos o equipos</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder="Activos o equipos"
                placeholderTextColor="#999"
                value={item.activos_equipos}
                onChangeText={(text) => updateInventario(index, 'activos_equipos', text)}
              />
            </ThemedView>

            {/* Tipo */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Tipo</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder="Tipo"
                placeholderTextColor="#999"
                value={item.tipo}
                onChangeText={(text) => updateInventario(index, 'tipo', text)}
              />
            </ThemedView>

            {/* # de Activo */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}># de Activo</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder="# de Activo"
                placeholderTextColor="#999"
                value={item.numero_activo}
                onChangeText={(text) => updateInventario(index, 'numero_activo', text)}
              />
            </ThemedView>

            {/* Número de Serie */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Número de Serie</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder="Número de Serie"
                placeholderTextColor="#999"
                value={item.numero_serie}
                onChangeText={(text) => updateInventario(index, 'numero_serie', text)}
              />
            </ThemedView>

            {/* Marca */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Marca</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder="Marca"
                placeholderTextColor="#999"
                value={item.marca}
                onChangeText={(text) => updateInventario(index, 'marca', text)}
              />
            </ThemedView>

            {/* Modelo */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Modelo</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder="Modelo"
                placeholderTextColor="#999"
                value={item.modelo}
                onChangeText={(text) => updateInventario(index, 'modelo', text)}
              />
            </ThemedView>

            {/* Descripción */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Descripción</ThemedText>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                placeholder="Descripción"
                placeholderTextColor="#999"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                value={item.descripcion}
                onChangeText={(text) => updateInventario(index, 'descripcion', text)}
              />
            </ThemedView>
          </ThemedView>
        )}
      </ThemedView>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <AppHeader onMenuPress={handleMenuPress} title="Apertura-Cierre de Puesto" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <ThemedView style={styles.contentContainer}>
          <ThemedText type="title" style={styles.screenTitle}>
            {getActionIcon('position')} Apertura-Cierre de Puesto
          </ThemedText>

          {!hasCurrentMarca && (
            <ThemedView style={styles.noMarcaContainer}>
              <ThemedText style={styles.noMarcaTitle}>Marca no seleccionada</ThemedText>
              <ThemedText style={styles.noMarcaMessage}>
                No se encontró una marca seleccionada. Por favor, selecciona una marca desde el menú principal.
              </ThemedText>
            </ThemedView>
          )}

          {isCreating || editingRecord ? (
            <ThemedView style={styles.formContainer}>
              {/* Cliente */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Cliente</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Cliente"
                  placeholderTextColor="#999"
                  value={cliente}
                  onChangeText={setCliente}
                />
              </ThemedView>

              {/* Número de Corpo */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Número de Corpo</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Número de Corpo"
                  placeholderTextColor="#999"
                  value={numeroCorpo}
                  onChangeText={setNumeroCorpo}
                  keyboardType="numeric"
                />
              </ThemedView>

              {/* Número de Puesto */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Número de Puesto</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Número de Puesto"
                  placeholderTextColor="#999"
                  value={numeroPuesto}
                  onChangeText={setNumeroPuesto}
                  keyboardType="numeric"
                />
              </ThemedView>

              {/* Fecha en que se realizó */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Fecha en que se realizó</ThemedText>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <ThemedText style={styles.dateButtonText}>
                    {formatDate(fechaRealizado)}
                  </ThemedText>
                  <Ionicons name="calendar" size={20} color="#007AFF" />
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={fechaRealizado}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleDateChange}
                  />
                )}
              </ThemedView>

              {/* Nombre del Corpo */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Nombre del Corpo</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Nombre del Corpo"
                  placeholderTextColor="#999"
                  value={nombreCorpo}
                  onChangeText={setNombreCorpo}
                />
              </ThemedView>

              {/* Nombre del Puesto */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Nombre del Puesto</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Nombre del Puesto"
                  placeholderTextColor="#999"
                  value={nombrePuesto}
                  onChangeText={setNombrePuesto}
                />
              </ThemedView>

              {/* Tipo */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Tipo</ThemedText>
                <ThemedView style={styles.tipoContainer}>
                  <TouchableOpacity
                    style={[styles.tipoOption, tipo.includes('Apertura') && styles.tipoOptionSelected]}
                    onPress={() => toggleTipo('Apertura')}
                  >
                    <View style={styles.tipoCheckbox}>
                      {tipo.includes('Apertura') && (
                        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                      )}
                    </View>
                    <ThemedText style={[styles.tipoOptionText, tipo.includes('Apertura') && styles.tipoOptionTextSelected]}>
                      Apertura
                    </ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.tipoOption, tipo.includes('Cierre') && styles.tipoOptionSelected]}
                    onPress={() => toggleTipo('Cierre')}
                  >
                    <View style={styles.tipoCheckbox}>
                      {tipo.includes('Cierre') && (
                        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                      )}
                    </View>
                    <ThemedText style={[styles.tipoOptionText, tipo.includes('Cierre') && styles.tipoOptionTextSelected]}>
                      Cierre
                    </ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.tipoOption, tipo.includes('Inventario') && styles.tipoOptionSelected]}
                    onPress={() => toggleTipo('Inventario')}
                  >
                    <View style={styles.tipoCheckbox}>
                      {tipo.includes('Inventario') && (
                        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                      )}
                    </View>
                    <ThemedText style={[styles.tipoOptionText, tipo.includes('Inventario') && styles.tipoOptionTextSelected]}>
                      Inventario
                    </ThemedText>
                  </TouchableOpacity>
                </ThemedView>
              </ThemedView>

              {/* Lista de actividades */}
              <ThemedView style={styles.sectionContainer}>
                <ThemedText style={styles.sectionTitle}>Actividades</ThemedText>
                {actividades.map((actividad, index) => renderActividad(actividad, index))}
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={addActividad}
                >
                  <Ionicons name="add-circle" size={24} color="#4CAF50" />
                  <ThemedText style={styles.addButtonText}>Agregar Actividad</ThemedText>
                </TouchableOpacity>
              </ThemedView>

              {/* Lista de inventario */}
              <ThemedView style={styles.sectionContainer}>
                <ThemedText style={styles.sectionTitle}>Inventario de activos y/o Equipos</ThemedText>
                {inventario.map((item, index) => renderInventario(item, index))}
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={addInventario}
                >
                  <Ionicons name="add-circle" size={24} color="#4CAF50" />
                  <ThemedText style={styles.addButtonText}>Agregar Item de Inventario</ThemedText>
                </TouchableOpacity>
              </ThemedView>

              {/* Fotos */}
              <ThemedView style={styles.sectionContainer}>
                <ThemedText style={styles.sectionTitle}>Fotografías</ThemedText>
                <ThemedText style={styles.sectionSubtitle}>
                  Tome fotografías de las instalaciones estado de recibido/entrega
                </ThemedText>
                <TouchableOpacity
                  style={styles.cameraButton}
                  onPress={openCamera}
                >
                  <Ionicons name="camera" size={24} color="#FFFFFF" />
                  <ThemedText style={styles.cameraButtonText}>Tomar Foto</ThemedText>
                </TouchableOpacity>
                {fotos.length > 0 && (
                  <ThemedView style={styles.photosContainer}>
                    {fotos.map((foto, index) => (
                      <ThemedView key={index} style={styles.photoItem}>
                        <Image
                          source={{ uri: foto }}
                          style={styles.photoPreview}
                          resizeMode="contain"
                        />
                        <TouchableOpacity
                          style={styles.removePhotoButton}
                          onPress={() => removePhoto(index)}
                        >
                          <Ionicons name="trash" size={20} color="#FF3B30" />
                        </TouchableOpacity>
                      </ThemedView>
                    ))}
                  </ThemedView>
                )}
              </ThemedView>

              {/* Otras Observaciones */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Otras Observaciones</ThemedText>
                <TextInput
                  style={[styles.formInput, styles.textArea]}
                  placeholder="Otras Observaciones"
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                  value={otrasObservaciones}
                  onChangeText={setOtrasObservaciones}
                />
              </ThemedView>

              {/* Nombre representante del cliente */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Nombre representante del cliente</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Nombre representante del cliente"
                  placeholderTextColor="#999"
                  value={nombreRepresentanteCliente}
                  onChangeText={setNombreRepresentanteCliente}
                />
              </ThemedView>

              {/* Firma del cliente */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Firma Cliente</ThemedText>
                {!firmaCliente ? (
                  <TouchableOpacity
                    style={styles.signatureButton}
                    onPress={openSignatureModal}
                  >
                    <Ionicons name="create-outline" size={24} color="#007AFF" />
                    <ThemedText style={styles.signatureButtonText}>Toca para dibujar la firma</ThemedText>
                  </TouchableOpacity>
                ) : (
                  <ThemedView style={styles.signaturePreviewContainer}>
                    <Image
                      source={{ uri: formatSignatureForDisplay(firmaCliente) || '' }}
                      style={styles.signaturePreview}
                    />
                    <TouchableOpacity
                      style={styles.clearSignatureButton}
                      onPress={() => setFirmaCliente(null)}
                    >
                      <Ionicons name="trash" size={16} color="#FF3B30" />
                      <ThemedText style={styles.clearSignatureButtonText}>Eliminar Firma</ThemedText>
                    </TouchableOpacity>
                  </ThemedView>
                )}
              </ThemedView>

              <ThemedView style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.cancelButton]}
                  onPress={editingRecord ? cancelEditing : cancelCreating}
                >
                  {getActionIcon('cancel')}
                  <ThemedText style={styles.actionButtonText}>Cancelar</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.saveButton]}
                  onPress={editingRecord ? updatePositionHandler : savePositionHandler}
                >
                  {getActionIcon('confirm')}
                  <ThemedText style={styles.actionButtonText}>
                    {editingRecord ? 'Actualizar' : 'Guardar'}
                  </ThemedText>
                </TouchableOpacity>
              </ThemedView>
            </ThemedView>
          ) : (
            <ThemedView style={styles.listSection}>
              <TouchableOpacity style={styles.createButton} onPress={startCreating}>
                <Ionicons name="add-circle" size={24} color="#FFFFFF" />
                <ThemedText style={styles.createButtonText}>Crear Nueva Apertura-Cierre de Puesto</ThemedText>
              </TouchableOpacity>
              {renderPositionList()}
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
        <View style={styles.cameraContainer}>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing="back"
          />
          <View style={styles.cameraControls}>
            <TouchableOpacity
              style={styles.cameraCancelButton}
              onPress={() => setIsCameraVisible(false)}
            >
              <Ionicons name="close" size={30} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cameraCaptureButton}
              onPress={capturePhoto}
            >
              <View style={styles.cameraCaptureButtonInner} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Signature Modal */}
      <Modal
        visible={isSignatureModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={closeSignatureModal}
      >
        <ThemedView style={styles.modalOverlay}>
          <ThemedView style={styles.modalContainer}>
            <ThemedView style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Firma del Cliente</ThemedText>
              <TouchableOpacity onPress={closeSignatureModal}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </ThemedView>
            
            <View style={styles.modalSignatureContainer}>
              <SignatureScreen
                ref={signatureRef}
                onOK={handleSignatureRead}
                descriptionText="Dibuja la firma en el área blanca"
                clearText=""
                confirmText=""
                webStyle={signatureWebStyle}
                key={signatureKey}
              />
            </View>
            
            <ThemedView style={styles.modalActions}>
              <TouchableOpacity style={styles.modalClearButton} onPress={clearSignatureInModal}>
                <Ionicons name="trash" size={20} color="#000000" />
                <ThemedText style={styles.modalClearButtonText}>Limpiar</ThemedText>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.modalAcceptButton} onPress={acceptSignature}>
                <Ionicons name="checkmark" size={20} color="#000000" />
                <ThemedText style={styles.modalAcceptButtonText}>Aceptar</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          </ThemedView>
        </ThemedView>
      </Modal>

      <AppFooter />
      <SlideMenu
        isVisible={isMenuVisible}
        onClose={handleMenuClose}
        onHomePress={handleHomePress}
        currentRoute="OpeningClosingPosition"
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#161719',
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
  screenTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#000000',
    textAlign: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  noMarcaContainer: {
    padding: 20,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EF5350',
    alignItems: 'center',
    marginBottom: 20,
  },
  noMarcaTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#D32F2F',
    marginBottom: 10,
  },
  noMarcaMessage: {
    fontSize: 14,
    color: '#D32F2F',
    textAlign: 'center',
  },
  createButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  formContainer: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  formGroup: {
    marginBottom: 15,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 5,
    color: '#000000',
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000000',
    backgroundColor: '#F9F9F9',
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#F9F9F9',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#000000',
  },
  tipoContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tipoOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#F9F9F9',
    gap: 8,
  },
  tipoOptionSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  tipoCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  tipoOptionText: {
    fontSize: 14,
    color: '#000000',
  },
  tipoOptionTextSelected: {
    color: '#FFFFFF',
  },
  sectionContainer: {
    marginTop: 20,
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 10,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 10,
    fontStyle: 'italic',
  },
  actividadItem: {
    marginBottom: 15,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  actividadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#F5F5F5',
  },
  actividadHeaderContent: {
    flex: 1,
    marginRight: 10,
  },
  actividadHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  actividadHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  removeActividadButton: {
    padding: 4,
  },
  actividadContent: {
    padding: 15,
  },
  inventarioItem: {
    marginBottom: 15,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  inventarioHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#F5F5F5',
  },
  inventarioHeaderContent: {
    flex: 1,
    marginRight: 10,
  },
  inventarioHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  inventarioHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  removeInventarioButton: {
    padding: 4,
  },
  inventarioContent: {
    padding: 15,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#FF9500',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#000000',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    marginTop: 10,
    gap: 8,
  },
  addButtonText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
  },
  cameraButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    gap: 10,
    marginBottom: 15,
  },
  cameraButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  photosContainer: {
    marginTop: 10,
  },
  photoItem: {
    width: '100%',
    position: 'relative',
    marginBottom: 15,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  photoPreview: {
    width: '100%',
    height: 300,
    borderRadius: 8,
  },
  removePhotoButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 15,
    padding: 5,
  },
  signatureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2196F3',
    gap: 8,
    minHeight: 100,
  },
  signatureButtonText: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '600',
  },
  signaturePreviewContainer: {
    padding: 10,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  signaturePreview: {
    width: '100%',
    height: 150,
    resizeMode: 'contain',
    marginBottom: 10,
  },
  clearSignatureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    backgroundColor: '#FFEBEE',
    borderRadius: 6,
    gap: 6,
  },
  clearSignatureButtonText: {
    fontSize: 12,
    color: '#FF3B30',
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  cancelButton: {
    backgroundColor: '#CCCCCC',
  },
  saveButton: {
    backgroundColor: '#FF9500',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  listSection: {
    width: '100%',
  },
  listContainer: {
    width: '100%',
    marginTop: 10,
  },
  listItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  listItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#F0F0F0',
  },
  listItemContent: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  listItemSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  listItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  offlineBadge: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  offlineBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  listItemDetails: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  listItemButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  listItemButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  editButton: {
    backgroundColor: '#007AFF',
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
  },
  listItemButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#000000',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    marginTop: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#D32F2F',
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  cameraControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  cameraCancelButton: {
    padding: 10,
  },
  cameraCaptureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#fff',
    padding: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraCaptureButtonInner: {
    flex: 1,
    borderRadius: 30,
    backgroundColor: '#007AFF',
    width: '100%',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 500,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  modalSignatureContainer: {
    height: 300,
    width: '100%',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 12,
  },
  modalClearButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    gap: 8,
  },
  modalClearButtonText: {
    fontSize: 16,
    color: '#000000',
    fontWeight: '600',
  },
  modalAcceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    gap: 8,
  },
  modalAcceptButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

