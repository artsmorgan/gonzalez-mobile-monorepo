import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Linking, Modal, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View, Image } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import * as Network from 'expo-network';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';

import AppHeader from '@/components/AppHeader';
import AppFooter from '@/components/AppFooter';
import SlideMenu from '@/components/SlideMenu';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { RootStackParamList } from '../App';
import { useAuth } from '@/contexts/AuthContext';
import getHoraAccion from '@/hooks/getHoraAccion';
import { eventBus } from '@/hooks/eventBus';

import type { ExecutiveOption, Incident, IncidentClassificationOption, IncidentContribution, IncidentContributionFileInput, IncidentFileInput } from '@/hooks/incidentsTypes';
import { createIncident, createIncidentContribution, deleteIncident, deleteIncidentContribution, deleteIncidentContributionFile, listExecutives, listIncidentClassifications, listIncidentContributions, listIncidentsByMarca, updateIncident, updateIncidentContribution } from '@/hooks/incidentsFunctions';
import { getCurrentMarcaId, getExecutivesCache, getIncidentsCache, getIncidentsClassificationsCache, INCIDENT_CONTRIBUTIONS_ACTIONS_KEY, setExecutivesCache, setIncidentsCache, setIncidentsClassificationsCache } from '@/hooks/incidentsStorage';

type IncidentsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Incidents'>;

type InvolucradoForm = { codigo: string; nombre: string };

type ManualFileLocal = {
  id: string;
  type: 'image' | 'audio' | 'video' | 'document';
  name: string;
  extension: string;
  base64: string; // base64 puro
  uri?: string;
  mimeType?: string;
};

type EditingIncident = {
  id: number | null;
  id_local: string;
  estado: boolean;

  ejecutivo_id: number | null;
  fecha_incidente: string;
  fecha_reporte: string;
  nombre_responsable: string;
  clasificacion_id: number | null;
  descripcion: string;
  involucrados: InvolucradoForm[];
  libro_fecha: string;
  libro_numero: string;
  nombre_responsable_atencion: string;

  // Edit-only (pero visibles en edición)
  solucion: string;
  fecha_solucion: string;
  fecha_real_solucion: string;
  costo_asociado: string;
  consecutivo_informe: string;
  link_informe: string;
  owned: boolean;
};

const generateRandomId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 10; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
};

const isoDateOnly = (d: Date) => {
  // YYYY-MM-DDT00:00:00.000Z
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T00:00:00.000Z`;
};

const dateLabel = (iso: string) => {
  try {
    if (!iso) return '';
    return iso.split('T')[0];
  } catch {
    return iso;
  }
};

// Helpers para construir URLs de archivos
const buildIncidentFileUrl = (incidentId: number | undefined, file: any) => {
  // Si es registro offline (tiene id_local no vacío), usamos base64
  const hasLocalId = file.id_local !== undefined && file.id_local !== null && file.id_local !== '';
  if (hasLocalId && file.base64) {
    const mime = file.mimeType || (file.type ? `${file.type}/${file.extension || 'octet-stream'}` : `application/${file.extension || 'octet-stream'}`);
    return `data:${mime};base64,${file.base64}`;
  }

  // Para registros sincronizados, usar la API
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl || !incidentId) return '';

  if (file.type === 'image') {
    return `${apiUrl}/api/incidents/${incidentId}/get-image/${encodeURIComponent(file.name)}`;
  }
  if (file.type === 'audio') {
    return `${apiUrl}/api/incidents/${incidentId}/get-audio/${encodeURIComponent(file.name)}`;
  }
  if (file.type === 'video') {
    return `${apiUrl}/api/incidents/${incidentId}/get-video/${encodeURIComponent(file.name)}`;
  }
  // document o cualquier otro tipo
  return `${apiUrl}/api/incidents/${incidentId}/get-file/${encodeURIComponent(file.name)}`;
};

const buildContributionFileUrl = (incidentId: number | undefined, contributionId: number | undefined, file: any) => {
  const hasLocalId = file.id_local !== undefined && file.id_local !== null && file.id_local !== '';
  if (hasLocalId && file.base64) {
    const mime = file.mimeType || (file.type ? `${file.type}/${file.extension || 'octet-stream'}` : `application/${file.extension || 'octet-stream'}`);
    return `data:${mime};base64,${file.base64}`;
  }

  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl || !incidentId || !contributionId) return '';

  if (file.type === 'image') {
    return `${apiUrl}/api/incidents/${incidentId}/contributions/${contributionId}/get-image/${encodeURIComponent(file.name)}`;
  }
  if (file.type === 'audio') {
    return `${apiUrl}/api/incidents/${incidentId}/contributions/${contributionId}/get-audio/${encodeURIComponent(file.name)}`;
  }
  if (file.type === 'video') {
    return `${apiUrl}/api/incidents/${incidentId}/contributions/${contributionId}/get-video/${encodeURIComponent(file.name)}`;
  }
  return `${apiUrl}/api/incidents/${incidentId}/contributions/${contributionId}/get-file/${encodeURIComponent(file.name)}`;
};

const getFileDisplayName = (file: any) => {
  const candidate = (file.original_name ?? '').trim();
  return candidate.length > 0 ? candidate : file.name;
};

const normalizeRoleName = (role: string) => (role || '').toString().trim().toUpperCase();

const canModifyAporte = (rolAporte: string, aporteEmpleadoId: number, currentEmpleadoId: number, currentRole: string) => {
  const rol = normalizeRoleName(rolAporte);
  const myRole = normalizeRoleName(currentRole);
  const isAdmin = myRole === 'ADMINISTRATIVO' || myRole === 'ADMINISTRADOR';
  const isSupervisor = myRole === 'SUPERVISOR';
  const isOwner = aporteEmpleadoId === currentEmpleadoId;

  if (rol === 'OPERATIVO') return isOwner || isSupervisor || isAdmin;
  if (rol === 'SUPERVISOR') return isOwner || isAdmin;
  if (rol === 'ADMINISTRATIVO' || rol === 'ADMINISTRADOR') return isOwner;
  return isOwner;
};

export default function IncidentsScreen() {
  const navigation = useNavigation<IncidentsScreenNavigationProp>();
  const { employee, refreshAccessToken, logout } = useAuth();

  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasCurrentMarca, setHasCurrentMarca] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [executives, setExecutives] = useState<ExecutiveOption[]>([]);
  const [classifications, setClassifications] = useState<IncidentClassificationOption[]>([]);
  const [currentRoleName, setCurrentRoleName] = useState<string>('');

  const [isCreating, setIsCreating] = useState(false);
  const [editingIncident, setEditingIncident] = useState<EditingIncident | null>(null);

  // Aportes (contribuciones)
  const [isAportesVisible, setIsAportesVisible] = useState(false);
  const [selectedIncidentForAportes, setSelectedIncidentForAportes] = useState<Incident | null>(null);
  const [isLoadingAportes, setIsLoadingAportes] = useState(false);
  const [aportes, setAportes] = useState<IncidentContribution[]>([]);
  const [aporteText, setAporteText] = useState('');
  const [editingAporte, setEditingAporte] = useState<IncidentContribution | null>(null);
  const [showAporteComposer, setShowAporteComposer] = useState(false);

  const [aporteTextFiles, setAporteTextFiles] = useState<ManualFileLocal[]>([]);
  const [aporteImageFiles, setAporteImageFiles] = useState<ManualFileLocal[]>([]);
  const [aporteAudioFiles, setAporteAudioFiles] = useState<ManualFileLocal[]>([]);
  const [aporteVideoFiles, setAporteVideoFiles] = useState<ManualFileLocal[]>([]);

  const [newIncident, setNewIncident] = useState<EditingIncident>({
    id: null,
    id_local: '',
    estado: true,
    ejecutivo_id: null,
    fecha_incidente: '',
    fecha_reporte: '',
    nombre_responsable: '',
    clasificacion_id: null,
    descripcion: '',
    involucrados: [{ codigo: '', nombre: '' }],
    libro_fecha: '',
    libro_numero: '',
    nombre_responsable_atencion: '',
    solucion: '',
    fecha_solucion: '',
    fecha_real_solucion: '',
    costo_asociado: '',
    consecutivo_informe: '',
    link_informe: '',
    owned: false,
  });

  // Form refs (evita re-render y sigue el patrón de Vehicles)
  const ejecutivoRef = useRef<number | null>(null);
  const fechaIncidenteRef = useRef<string>('');
  const fechaReporteRef = useRef<string>('');
  const nombreResponsableRef = useRef<string>('');
  const clasificacionRef = useRef<number | null>(null);
  const descripcionRef = useRef<string>('');
  const nombreResponsableAtencionRef = useRef<string>('');

  const solucionRef = useRef<string>('');
  const fechaSolucionRef = useRef<string>('');
  const fechaRealSolucionRef = useRef<string>('');
  const costoAsociadoRef = useRef<string>('');
  const consecutivoInformeRef = useRef<string>('');
  const linkInformeRef = useRef<string>('');

  // Local files (para crear/preview). En edición solo mostramos los existentes (server) por ahora.
  const [textFiles, setTextFiles] = useState<ManualFileLocal[]>([]);
  const [imageFiles, setImageFiles] = useState<ManualFileLocal[]>([]);
  const [audioFiles, setAudioFiles] = useState<ManualFileLocal[]>([]);
  const [videoFiles, setVideoFiles] = useState<ManualFileLocal[]>([]);

  // Date pickers state
  const [showFechaIncidentePicker, setShowFechaIncidentePicker] = useState(false);
  const [showFechaReportePicker, setShowFechaReportePicker] = useState(false);
  const [showLibroFechaPicker, setShowLibroFechaPicker] = useState(false);
  const [showFechaSolucionPicker, setShowFechaSolucionPicker] = useState(false);
  const [showFechaRealSolucionPicker, setShowFechaRealSolucionPicker] = useState(false);

  const [pickerDateValue, setPickerDateValue] = useState(new Date());
  const [searchText, setSearchText] = useState('');

  const getConnectionStatus = async (): Promise<boolean> => {
    const networkState = await Network.getNetworkStateAsync();
    return networkState.isConnected && networkState.isInternetReachable ? true : false;
  };

  const loadFromCaches = async () => {
    const [cachedIncidents, cachedClassifications, cachedExecutives] = await Promise.all([
      getIncidentsCache(),
      getIncidentsClassificationsCache(),
      getExecutivesCache(),
    ]);

    setIncidents(cachedIncidents || []);
    setClassifications(cachedClassifications || []);
    setExecutives(cachedExecutives || []);
  };

  const loadCurrentRoleFromMarca = async () => {
    try {
      const marcaStr = await AsyncStorage.getItem('current_marca');
      if (!marcaStr) {
        setCurrentRoleName('');
        return;
      }
      const marca = JSON.parse(marcaStr);
      const role = marca?.roleDivision?.role?.nombre || '';
      setCurrentRoleName(String(role || '').trim());
    } catch {
      setCurrentRoleName('');
    }
  };

  const fetchAll = async () => {
    try {
      setIsLoading(true);
      setError(null);
      await loadCurrentRoleFromMarca();

      const marcaId = await getCurrentMarcaId();
      if (!marcaId) {
        setHasCurrentMarca(false);
        setIsLoading(false);
        return;
      }
      setHasCurrentMarca(true);

      const isConnected = await getConnectionStatus();
      if (!isConnected) {
        await loadFromCaches();
        Alert.alert('Modo Offline', 'No hay conexión a internet. Mostrando datos guardados.');
        return;
      }

      const [incidentsRes, classificationsRes, executivesRes] = await Promise.all([
        listIncidentsByMarca({ marcaId, refreshAccessToken, logout }),
        listIncidentClassifications({ refreshAccessToken, logout }),
        listExecutives({ refreshAccessToken, logout }),
      ]);

      if (incidentsRes.status && incidentsRes.incidents) {
        setIncidents(incidentsRes.incidents);
        await setIncidentsCache(incidentsRes.incidents);
      } else if (!incidentsRes.status) {
        setError(incidentsRes.message || 'Error al cargar incidentes');
      }

      if (classificationsRes.status && classificationsRes.classifications) {
        setClassifications(classificationsRes.classifications);
        await setIncidentsClassificationsCache(classificationsRes.classifications);
      }

      if (executivesRes.status && executivesRes.executives) {
        setExecutives(executivesRes.executives);
        await setExecutivesCache(executivesRes.executives);
      }
    } catch (e: any) {
      console.error('Error fetching incidents:', e);
      setError('Error al cargar incidentes');
      await loadFromCaches();
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [])
  );

  useEffect(() => {
    const handler = () => fetchAll();
    eventBus.on('connectionRestored', handler);
    return () => {
      eventBus.off('connectionRestored', handler);
      return;
    };
  }, []);

  const filteredIncidents = useMemo(() => {
    const s = searchText.trim().toLowerCase();
    if (!s) return incidents;
    return incidents.filter(i => {
      const ejecutivo = i.ejecutivo?.name || '';
      const clasif = i.clasificacion?.name || '';
      return (
        (i.descripcion || '').toLowerCase().includes(s) ||
        (i.nombre_responsable || '').toLowerCase().includes(s) ||
        (i.nombre_responsable_atencion || '').toLowerCase().includes(s) ||
        ejecutivo.toLowerCase().includes(s) ||
        clasif.toLowerCase().includes(s)
      );
    });
  }, [incidents, searchText]);

  const handleMenuPress = () => setIsMenuVisible(true);
  const handleMenuClose = () => setIsMenuVisible(false);
  const handleHomePress = () => navigation.navigate('Home');

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'add': return <Ionicons name="add-sharp" size={20} color='#000000' />;
      case 'edit': return <Ionicons name="pencil" size={20} color='#FFFFFF' />;
      case 'delete': return <Ionicons name="trash" size={20} color='#FFFFFF' />;
      case 'incidents': return <Ionicons name="warning" size={25} color='#000000' />;
      case 'cancel': return <Ionicons name="close-sharp" size={20} color='#FFFFFF' />;
      case 'confirm': return <Ionicons name="checkmark-sharp" size={20} color='#FFFFFF' />;
      default: return <Ionicons name="close-sharp" size={20} color='#FFFFFF' />;
    }
  };

  const resetRefs = (mode: 'create' | 'edit', incident?: EditingIncident) => {
    if (mode === 'create') {
      ejecutivoRef.current = null;
      fechaIncidenteRef.current = '';
      fechaReporteRef.current = '';
      nombreResponsableRef.current = employee?.name || '';
      clasificacionRef.current = null;
      descripcionRef.current = '';
      nombreResponsableAtencionRef.current = '';

      solucionRef.current = '';
      fechaSolucionRef.current = '';
      fechaRealSolucionRef.current = '';
      costoAsociadoRef.current = '';
      consecutivoInformeRef.current = '';
      linkInformeRef.current = '';
    } else if (incident) {
      ejecutivoRef.current = incident.ejecutivo_id;
      fechaIncidenteRef.current = incident.fecha_incidente;
      fechaReporteRef.current = incident.fecha_reporte;
      nombreResponsableRef.current = incident.nombre_responsable;
      clasificacionRef.current = incident.clasificacion_id;
      descripcionRef.current = incident.descripcion;
      nombreResponsableAtencionRef.current = incident.nombre_responsable_atencion;

      solucionRef.current = incident.solucion;
      fechaSolucionRef.current = incident.fecha_solucion;
      fechaRealSolucionRef.current = incident.fecha_real_solucion;
      costoAsociadoRef.current = incident.costo_asociado;
      consecutivoInformeRef.current = incident.consecutivo_informe;
      linkInformeRef.current = incident.link_informe;
    }
  };

  const startCreating = () => {
    const today = isoDateOnly(new Date());
    setIsCreating(true);
    setEditingIncident(null);
    setTextFiles([]);
    setImageFiles([]);
    setAudioFiles([]);
    setVideoFiles([]);
    setNewIncident(prev => ({
      ...prev,
      id: null,
      id_local: '',
      estado: true,
      ejecutivo_id: null,
      fecha_incidente: today,
      fecha_reporte: today,
      nombre_responsable: employee?.name || '',
      clasificacion_id: null,
      descripcion: '',
      involucrados: [{ codigo: '', nombre: '' }],
      libro_fecha: today,
      libro_numero: '',
      nombre_responsable_atencion: '',
      solucion: '',
      fecha_solucion: '',
      fecha_real_solucion: '',
      costo_asociado: '',
      consecutivo_informe: '',
      link_informe: '',
      owned: false,
    }));
    resetRefs('create');
    fechaIncidenteRef.current = today;
    fechaReporteRef.current = today;
    nombreResponsableRef.current = employee?.name || '';
  };

  const cancelCreating = () => {
    setIsCreating(false);
    setTextFiles([]);
    setImageFiles([]);
    setAudioFiles([]);
    setVideoFiles([]);
  };

  const startEditing = (incident: Incident) => {
    setIsCreating(false);
    setTextFiles([]);
    setImageFiles([]);
    setAudioFiles([]);
    setVideoFiles([]);

    const libro = incident.fecha_libro_novedades || { numero: '', fecha: '' };

    const edit: EditingIncident = {
      id: incident.id,
      id_local: incident.id_local || '',
      estado: incident.estado,
      ejecutivo_id: incident.ejecutivo?.id || null,
      fecha_incidente: incident.fecha_incidente || '',
      fecha_reporte: incident.fecha_reporte || '',
      nombre_responsable: incident.nombre_responsable || '',
      clasificacion_id: incident.clasificacion?.id || null,
      descripcion: incident.descripcion || '',
      involucrados: Array.isArray(incident.involucrados)
        ? incident.involucrados.map(i => ({ codigo: i.codigo || '', nombre: i.nombre || '' }))
        : [{ codigo: '', nombre: '' }],
      libro_fecha: libro.fecha || '',
      libro_numero: libro.numero || '',
      nombre_responsable_atencion: incident.nombre_responsable_atencion || '',
      solucion: incident.solucion || '',
      fecha_solucion: incident.fecha_solucion || '',
      fecha_real_solucion: incident.fecha_solucion_real || '',
      costo_asociado: incident.costo_asociado || '',
      consecutivo_informe: incident.consecutivo_informe || '',
      link_informe: incident.link_informe || '',
      owned: incident.owned,
    };

    setEditingIncident(edit);
    resetRefs('edit', edit);
  };

  const cancelEditing = () => setEditingIncident(null);

  const handleAddInvolucrado = () => {
    if (isCreating) {
      setNewIncident(prev => ({ ...prev, involucrados: [...prev.involucrados, { codigo: '', nombre: '' }] }));
    } else if (editingIncident) {
      setEditingIncident(prev => prev ? ({ ...prev, involucrados: [...prev.involucrados, { codigo: '', nombre: '' }] }) : prev);
    }
  };

  const updateInvolucrado = (idx: number, field: 'codigo' | 'nombre', value: string) => {
    const update = (list: InvolucradoForm[]) => list.map((it, i) => (i === idx ? { ...it, [field]: value } : it));
    if (isCreating) setNewIncident(prev => ({ ...prev, involucrados: update(prev.involucrados) }));
    else if (editingIncident) setEditingIncident(prev => (prev ? { ...prev, involucrados: update(prev.involucrados) } : prev));
  };

  const removeInvolucrado = (idx: number) => {
    const update = (list: InvolucradoForm[]) => list.filter((_, i) => i !== idx);
    if (isCreating) setNewIncident(prev => ({ ...prev, involucrados: update(prev.involucrados).length ? update(prev.involucrados) : [{ codigo: '', nombre: '' }] }));
    else if (editingIncident) setEditingIncident(prev => (prev ? { ...prev, involucrados: update(prev.involucrados).length ? update(prev.involucrados) : [{ codigo: '', nombre: '' }] } : prev));
  };

  const handleAddFile = async (type: ManualFileLocal['type']) => {
    try {
      let pickerTypes: string | string[] | undefined;
      switch (type) {
        case 'image':
          pickerTypes = ['image/*']; break;
        case 'audio':
          pickerTypes = ['audio/*']; break;
        case 'video':
          pickerTypes = ['video/*']; break;
        case 'document':
        default:
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
          const res = reader.result;
          if (typeof res === 'string') {
            const parts = res.split(',');
            resolve(parts.length > 1 ? parts[1] : parts[0]);
          } else {
            reject(new Error('No se pudo leer el archivo seleccionado'));
          }
        };
        reader.onerror = () => reject(reader.error ?? new Error('Error al leer el archivo seleccionado'));
        reader.readAsDataURL(blob);
      });

      let extension = '';
      if (asset.name && asset.name.includes('.')) extension = asset.name.split('.').pop() || '';
      else if (asset.mimeType && asset.mimeType.includes('/')) extension = asset.mimeType.split('/').pop() || '';

      const localId = `local_file_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const file: ManualFileLocal = {
        id: localId,
        type,
        name: asset.name || `archivo.${extension || 'dat'}`,
        extension: extension || 'dat',
        base64,
        uri: asset.uri,
        mimeType: asset.mimeType,
      };

      if (type === 'image') setImageFiles(prev => [...prev, file]);
      else if (type === 'audio') setAudioFiles(prev => [...prev, file]);
      else if (type === 'video') setVideoFiles(prev => [...prev, file]);
      else setTextFiles(prev => [...prev, file]);
    } catch (e) {
      console.error('Error picking file for incident:', e);
      Alert.alert('Error', 'No se pudo seleccionar el archivo. Intenta nuevamente.');
    }
  };

  const removeLocalFile = (type: ManualFileLocal['type'], id: string) => {
    if (type === 'image') setImageFiles(prev => prev.filter(f => f.id !== id));
    else if (type === 'audio') setAudioFiles(prev => prev.filter(f => f.id !== id));
    else if (type === 'video') setVideoFiles(prev => prev.filter(f => f.id !== id));
    else setTextFiles(prev => prev.filter(f => f.id !== id));
  };

  const validateCreate = () => {
    if (!ejecutivoRef.current) return 'El ejecutivo de cuenta es obligatorio';
    if (!fechaIncidenteRef.current) return 'La fecha del incidente es obligatoria';
    if (!fechaReporteRef.current) return 'La fecha del reporte es obligatoria';
    if (!nombreResponsableRef.current.trim()) return 'El nombre de quien reporta es obligatorio';
    if (!clasificacionRef.current) return 'La clasificación es obligatoria';
    if (!descripcionRef.current.trim()) return 'La descripción es obligatoria';
    if (!nombreResponsableAtencionRef.current.trim()) return 'El nombre del responsable de atención es obligatorio';
    return null;
  };

  const buildArchivosPayload = (): IncidentFileInput[] => {
    const files = [...textFiles, ...imageFiles, ...audioFiles, ...videoFiles];
    return files.map(f => ({
      type: f.type,
      extension: f.extension,
      original_name: f.name,
      file_base64: f.base64,
      mimeType: f.mimeType,
    }));
  };

  const createLocalCacheIncident = async (marcaId: number, localId: string) => {
    const exec = executives.find(e => e.id === ejecutivoRef.current) || null;
    const clas = classifications.find(c => c.id === clasificacionRef.current) || null;
    const horaAccion = await getHoraAccion();

    const files = [...textFiles, ...imageFiles, ...audioFiles, ...videoFiles].map(f => ({
      id: Date.now() + Math.random(),
      id_local: f.id,
      name: f.name,
      original_name: f.name,
      type: f.type,
      extension: f.extension,
      base64: f.base64,
      mimeType: f.mimeType,
    }));

    const libro = {
      numero: isCreating ? newIncident.libro_numero : (editingIncident?.libro_numero || ''),
      fecha: isCreating ? newIncident.libro_fecha : (editingIncident?.libro_fecha || ''),
    };

    const incidentCache: Incident = {
      id: 0,
      estado: true,
      ejecutivo: { id: ejecutivoRef.current || 0, name: exec?.nombre || '' },
      fecha_incidente: fechaIncidenteRef.current,
      fecha_reporte: fechaReporteRef.current,
      nombre_responsable: nombreResponsableRef.current,
      clasificacion: { id: clasificacionRef.current || 0, name: clas?.nombre || '' },
      descripcion: descripcionRef.current,
      involucrados: (isCreating ? newIncident.involucrados : (editingIncident?.involucrados || [])).map(i => ({ codigo: i.codigo || '', nombre: i.nombre })),
      fecha_libro_novedades: libro,
      nombre_responsable_atencion: nombreResponsableAtencionRef.current,
      solucion: '',
      fecha_solucion: '',
      fecha_solucion_real: '',
      costo_asociado: '',
      consecutivo_informe: '',
      link_informe: '',
      files: files as any,
      id_local: localId,
      owned: true, // El usuario que crea el incidente puede editarlo
    };

    const cache = (await getIncidentsCache()) || [];
    await setIncidentsCache([...cache, incidentCache]);
    setIncidents(prev => [...prev, incidentCache]);
  };

  const handleCreate = async () => {
    const validation = validateCreate();
    if (validation) {
      Alert.alert('Error', validation);
      return;
    }

    Alert.alert('Confirmar creación', '¿Estás seguro de que deseas crear este incidente?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Crear',
        onPress: async () => {
          try {
            const marcaId = await getCurrentMarcaId();
            if (!marcaId) {
              Alert.alert('Error', 'No se encontró la marca actual');
              return;
            }

            const payload = {
              marca_id: marcaId,
              empleado_id: ejecutivoRef.current!,
              fecha_incidente: fechaIncidenteRef.current,
              fecha_reporte: fechaReporteRef.current,
              nombre_responsable: nombreResponsableRef.current,
              clasificacion_id: clasificacionRef.current!,
              descripcion: descripcionRef.current,
              involucrados: JSON.stringify(newIncident.involucrados.map(i => ({ codigo: i.codigo || '', nombre: i.nombre }))),
              fecha_libro_novedades: JSON.stringify({ numero: newIncident.libro_numero, fecha: newIncident.libro_fecha }),
              nombre_responsable_atencion: nombreResponsableAtencionRef.current,
              archivos: JSON.stringify(buildArchivosPayload()),
            };

            const isConnected = await getConnectionStatus();
            if (isConnected) {
              const res = await createIncident({ requestData: payload, refreshAccessToken, logout });
              if (res.status) {
                Alert.alert('Éxito', res.message || 'Incidente creado correctamente');
                setIsCreating(false);
                setTextFiles([]); setImageFiles([]); setAudioFiles([]); setVideoFiles([]);
                await fetchAll();
              } else {
                Alert.alert('Error', res.message || 'No se pudo crear el incidente');
              }
              return;
            }

            // Offline
            const localId = generateRandomId();
            const actionsStr = await AsyncStorage.getItem('incidents_actions');
            const actions = actionsStr ? JSON.parse(actionsStr) : [];
            actions.push({
              requestData: payload,
              marcaId,
              id: localId,
              type: 'create',
            });
            await AsyncStorage.setItem('incidents_actions', JSON.stringify(actions));

            await createLocalCacheIncident(marcaId, localId);

            Alert.alert('Modo Offline', 'Incidente registrado localmente. Se sincronizará cuando haya conexión.');
            setIsCreating(false);
            setTextFiles([]); setImageFiles([]); setAudioFiles([]); setVideoFiles([]);
          } catch (e) {
            console.error('Error creating incident:', e);
            Alert.alert('Error', 'No se pudo crear el incidente');
          }
        },
      },
    ]);
  };

  const handleUpdate = async (incidentId: number) => {
    if (!editingIncident) return;

    const marcaId = await getCurrentMarcaId();
    if (!marcaId) {
      Alert.alert('Error', 'No se encontró la marca actual');
      return;
    }

    if (!solucionRef.current.trim() &&
      !fechaSolucionRef.current &&
      !fechaRealSolucionRef.current &&
      !costoAsociadoRef.current.trim() &&
      !consecutivoInformeRef.current.trim() &&
      !linkInformeRef.current.trim()
    ) {
      Alert.alert('Error', 'Debes completar al menos un campo de la sección de solución/informe.');
      return;
    }

    Alert.alert('Confirmar edición', '¿Estás seguro de que deseas guardar los cambios?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: async () => {
          try {
            const body = {
              marca_id: marcaId,
              solucion: solucionRef.current,
              fecha_solucion: fechaSolucionRef.current || '',
              fecha_real_solucion: fechaRealSolucionRef.current || '',
              costo_asociado: costoAsociadoRef.current,
              consecutivo_informe: consecutivoInformeRef.current,
              link_informe: linkInformeRef.current,
            };

            const isConnected = await getConnectionStatus();
            if (isConnected) {
              const res = await updateIncident({ requestData: body, incidentId, refreshAccessToken, logout });
              if (res.status) {
                Alert.alert('Éxito', res.message || 'Incidente actualizado');
                setEditingIncident(null);
                await fetchAll();
              } else {
                Alert.alert('Error', res.message || 'No se pudo actualizar');
              }
              return;
            }

            // Offline
            const actionsStr = await AsyncStorage.getItem('incidents_actions');
            const actions = actionsStr ? JSON.parse(actionsStr) : [];

            if (editingIncident.id_local && editingIncident.id_local !== '') {
              // si aún no está sincronizado, actualizamos el payload de la acción create
              const actionIndex = actions.findIndex((a: any) => a.id === editingIncident.id_local && a.type === 'create');
              if (actionIndex !== -1) {
                // No enviamos estos campos en create (según requerimiento), así que solo guardamos en cache local
                // para que se vean en UI; al sincronizar create se enviará sin ellos.
              }
            } else {
              const filtered = actions.filter((a: any) => !(a.type === 'update' && a.id === incidentId));
              filtered.push({ requestData: body, id: incidentId, type: 'update' });
              await AsyncStorage.setItem('incidents_actions', JSON.stringify(filtered));
            }

            // actualizar cache local (para reflejar UI offline)
            const cache = (await getIncidentsCache()) || [];
            const updated = cache.map(i => {
              if (i.id === incidentId) {
                return {
                  ...i,
                  solucion: body.solucion,
                  fecha_solucion: body.fecha_solucion,
                  fecha_solucion_real: body.fecha_real_solucion,
                  costo_asociado: body.costo_asociado,
                  consecutivo_informe: body.consecutivo_informe,
                  link_informe: body.link_informe,
                };
              }
              return i;
            });
            await setIncidentsCache(updated);
            setIncidents(updated);

            Alert.alert('Modo Offline', 'Incidente actualizado localmente. Se sincronizará cuando haya conexión.');
            setEditingIncident(null);
          } catch (e) {
            console.error('Error updating incident:', e);
            Alert.alert('Error', 'No se pudo actualizar el incidente');
          }
        },
      },
    ]);
  };

  const handleDelete = async (incident: Incident) => {
    Alert.alert('Confirmar eliminación', '¿Estás seguro de que deseas eliminar este incidente?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            const isConnected = await getConnectionStatus();
            if (isConnected) {
              const res = await deleteIncident({ incidentId: incident.id, refreshAccessToken, logout });
              if (res.status) {
                Alert.alert('Éxito', res.message || 'Incidente eliminado');
                await fetchAll();
              } else {
                Alert.alert('Error', res.message || 'No se pudo eliminar');
              }
              return;
            }

            const actionsStr = await AsyncStorage.getItem('incidents_actions');
            const actions = actionsStr ? JSON.parse(actionsStr) : [];

            if (incident.id_local && incident.id_local !== '') {
              // si era local, borramos su acción create y removemos del cache
              const filteredActions = actions.filter((a: any) => a.id !== incident.id_local);
              await AsyncStorage.setItem('incidents_actions', JSON.stringify(filteredActions));
              const cache = (await getIncidentsCache()) || [];
              const updated = cache.filter(i => i.id_local !== incident.id_local);
              await setIncidentsCache(updated);
              setIncidents(updated);
            } else {
              actions.push({ id: incident.id, type: 'delete' });
              await AsyncStorage.setItem('incidents_actions', JSON.stringify(actions));
              const cache = (await getIncidentsCache()) || [];
              const updated = cache.filter(i => i.id !== incident.id);
              await setIncidentsCache(updated);
              setIncidents(updated);
            }

            Alert.alert('Modo Offline', 'Incidente eliminado localmente. Se sincronizará cuando haya conexión.');
          } catch (e) {
            console.error('Error deleting incident:', e);
            Alert.alert('Error', 'No se pudo eliminar el incidente');
          }
        },
      },
    ]);
  };

  const readContributionActions = async (): Promise<any[]> => {
    const str = await AsyncStorage.getItem(INCIDENT_CONTRIBUTIONS_ACTIONS_KEY);
    if (!str) return [];
    try {
      const parsed = JSON.parse(str);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const writeContributionActions = async (actions: any[]) => {
    await AsyncStorage.setItem(INCIDENT_CONTRIBUTIONS_ACTIONS_KEY, JSON.stringify(actions));
  };

  const updateIncidentAportesInIncidentsCache = async (incidentId: number, updater: (current: IncidentContribution[]) => IncidentContribution[]) => {
    const cache = (await getIncidentsCache()) || [];
    const updatedCache = cache.map((inc) => {
      if (inc.id === incidentId) {
        const currentAportes = Array.isArray((inc as any).aportes) ? (inc as any).aportes : [];
        return { ...inc, aportes: updater(currentAportes) };
      }
      return inc;
    });
    await setIncidentsCache(updatedCache);

    // Mantener estado en memoria sincronizado para offline inmediato
    setIncidents(updatedCache);
  };

  const getIncidentAportesFromCache = async (incidentId: number): Promise<IncidentContribution[]> => {
    const cache = (await getIncidentsCache()) || [];
    const found = cache.find((i) => i.id === incidentId);
    const aportesArr = Array.isArray((found as any)?.aportes) ? (found as any).aportes : [];
    return aportesArr;
  };

  const fetchAportesForIncident = async (incidentId: number) => {
    try {
      setIsLoadingAportes(true);
      const isConnected = await getConnectionStatus();

      if (!isConnected) {
        // Requerimiento: offline lee aportes desde incidents_cache -> incidente.aportes
        const offlineAportes = await getIncidentAportesFromCache(incidentId);
        setAportes(offlineAportes);
        return;
      }

      const res = await listIncidentContributions({ incidentId, refreshAccessToken, logout });
      if (res.status && res.contributions) {
        // Requerimiento: al GET exitoso reescribir incidente.aportes en incidents_cache
        // pero manteniendo aportes locales pendientes (id_local != '')
        const currentFromCache = await getIncidentAportesFromCache(incidentId);
        const pendingLocal = currentFromCache.filter((a: any) => a?.id_local && a.id_local !== '');
        const merged = [...pendingLocal, ...res.contributions];

        setAportes(merged);
        await updateIncidentAportesInIncidentsCache(incidentId, () => merged);
      } else {
        Alert.alert('Error', res.message || 'No se pudieron cargar los aportes');
      }
    } catch (e) {
      console.error('Error fetching aportes:', e);
    } finally {
      setIsLoadingAportes(false);
    }
  };

  const openAportesModal = async (incident: Incident) => {
    setSelectedIncidentForAportes(incident);
    setIsAportesVisible(true);
    setEditingAporte(null);
    setShowAporteComposer(false);
    setAporteText('');
    setAporteTextFiles([]);
    setAporteImageFiles([]);
    setAporteAudioFiles([]);
    setAporteVideoFiles([]);
    await loadCurrentRoleFromMarca();
    if (incident?.id) {
      await fetchAportesForIncident(incident.id);
    }
  };

  const closeAportesModal = () => {
    setIsAportesVisible(false);
    setSelectedIncidentForAportes(null);
    setEditingAporte(null);
    setShowAporteComposer(false);
    setAporteText('');
    setAporteTextFiles([]);
    setAporteImageFiles([]);
    setAporteAudioFiles([]);
    setAporteVideoFiles([]);
    setAportes([]);
  };

  const handleAddAporteFile = async (type: ManualFileLocal['type']) => {
    try {
      let pickerTypes: string | string[] | undefined;
      switch (type) {
        case 'image':
          pickerTypes = ['image/*']; break;
        case 'audio':
          pickerTypes = ['audio/*']; break;
        case 'video':
          pickerTypes = ['video/*']; break;
        case 'document':
        default:
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
          const res = reader.result;
          if (typeof res === 'string') {
            const parts = res.split(',');
            resolve(parts.length > 1 ? parts[1] : parts[0]);
          } else {
            reject(new Error('No se pudo leer el archivo seleccionado'));
          }
        };
        reader.onerror = () => reject(reader.error ?? new Error('Error al leer el archivo seleccionado'));
        reader.readAsDataURL(blob);
      });

      let extension = '';
      if (asset.name && asset.name.includes('.')) extension = asset.name.split('.').pop() || '';
      else if (asset.mimeType && asset.mimeType.includes('/')) extension = asset.mimeType.split('/').pop() || '';

      const localId = `local_aporte_file_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const file: ManualFileLocal = {
        id: localId,
        type,
        name: asset.name || `archivo.${extension || 'dat'}`,
        extension: extension || 'dat',
        base64,
        uri: asset.uri,
        mimeType: asset.mimeType,
      };

      if (type === 'image') setAporteImageFiles(prev => [...prev, file]);
      else if (type === 'audio') setAporteAudioFiles(prev => [...prev, file]);
      else if (type === 'video') setAporteVideoFiles(prev => [...prev, file]);
      else setAporteTextFiles(prev => [...prev, file]);
    } catch (e) {
      console.error('Error picking file for aporte:', e);
      Alert.alert('Error', 'No se pudo seleccionar el archivo. Intenta nuevamente.');
    }
  };

  const removeAporteLocalFile = (type: ManualFileLocal['type'], id: string) => {
    if (type === 'image') setAporteImageFiles(prev => prev.filter(f => f.id !== id));
    else if (type === 'audio') setAporteAudioFiles(prev => prev.filter(f => f.id !== id));
    else if (type === 'video') setAporteVideoFiles(prev => prev.filter(f => f.id !== id));
    else setAporteTextFiles(prev => prev.filter(f => f.id !== id));
  };

  const buildAporteArchivosPayload = (): IncidentContributionFileInput[] => {
    const all = [...aporteTextFiles, ...aporteImageFiles, ...aporteAudioFiles, ...aporteVideoFiles];
    return all.map((f) => ({
      type: f.type,
      extension: f.extension,
      original_name: f.name,
      file_base64: f.base64,
      mimeType: f.mimeType,
    }));
  };

  const submitAporte = async () => {
    if (!selectedIncidentForAportes) return;
    if (!employee) return;

    const texto = (aporteText || '').trim();
    if (texto.length === 0) {
      Alert.alert('Error', 'Debes escribir un aporte');
      return;
    }

    const incidentId = selectedIncidentForAportes.id;
    const role = normalizeRoleName(currentRoleName);

    const isConnected = await getConnectionStatus();

    // EDIT
    if (editingAporte && editingAporte.id && editingAporte.id_local === '') {
      const can = canModifyAporte(editingAporte.rol_aporte, editingAporte.empleado_id, parseInt(String(employee.id || '0'), 10), currentRoleName);
      if (!can) {
        Alert.alert('Sin permiso', 'No puedes editar este aporte');
        return;
      }

      if (isConnected) {
        const res = await updateIncidentContribution({
          incidentId,
          contributionId: editingAporte.id,
          requestData: {
            aporte: texto,
            archivos: buildAporteArchivosPayload(),
          },
          refreshAccessToken,
          logout,
        });

        if (res.status) {
          setEditingAporte(null);
          setShowAporteComposer(false);
          setAporteText('');
          setAporteTextFiles([]);
          setAporteImageFiles([]);
          setAporteAudioFiles([]);
          setAporteVideoFiles([]);
          await fetchAportesForIncident(incidentId);
        } else {
          Alert.alert('Error', res.message || 'No se pudo actualizar el aporte');
        }
        return;
      }

      // Offline update (solo texto / agrega archivos) -> queue
      const actions = await readContributionActions();
      actions.push({
        type: 'update',
        incidentId,
        contributionId: editingAporte.id,
        requestData: { aporte: texto, archivos: JSON.stringify(buildAporteArchivosPayload()) },
      });
      await writeContributionActions(actions);

      // update cache + ui
      const updated = aportes.map((a) => (a.id === editingAporte.id ? { ...a, aporte: texto } : a));
      setAportes(updated);
      await updateIncidentAportesInIncidentsCache(incidentId, () => updated);

      setEditingAporte(null);
      setShowAporteComposer(false);
      setAporteText('');
      setAporteTextFiles([]);
      setAporteImageFiles([]);
      setAporteAudioFiles([]);
      setAporteVideoFiles([]);

      Alert.alert('Modo Offline', 'Aporte actualizado localmente. Se sincronizará cuando haya conexión.');
      return;
    }

    // CREATE
    if (isConnected) {
      const res = await createIncidentContribution({
        incidentId,
        requestData: {
          aporte: texto,
          rol_aporte: role || 'OPERATIVO',
          archivos: buildAporteArchivosPayload(),
        },
        refreshAccessToken,
        logout,
      });

      if (res.status) {
        // Requerimiento: cerrar modal al crear aporte
        closeAportesModal();
      } else {
        Alert.alert('Error', res.message || 'No se pudo crear el aporte');
      }
      return;
    }

    // Offline create
    const localId = generateRandomId();
    const newLocal: IncidentContribution = {
      id: 0,
      incidente_id: incidentId,
      empleado_id: parseInt(String(employee.id || '0'), 10),
      empleado_nombre: employee.name || '',
      aporte: texto,
      rol_aporte: role || 'OPERATIVO',
      created_at: new Date().toISOString(),
      files: [...buildAporteArchivosPayload()].map((f) => ({
        id: Date.now() + Math.random(),
        id_local: `lf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: f.original_name || 'archivo',
        original_name: f.original_name || 'archivo',
        type: f.type,
        extension: f.extension,
        base64: f.file_base64,
        mimeType: f.mimeType,
      })),
      id_local: localId,
    };

    const actions = await readContributionActions();
    actions.push({
      type: 'create',
      id: localId,
      incidentId,
      requestData: {
        aporte: texto,
        rol_aporte: role || 'OPERATIVO',
        archivos: JSON.stringify(buildAporteArchivosPayload()),
      },
    });
    await writeContributionActions(actions);

    const next = [newLocal, ...aportes];
    setAportes(next);
    await updateIncidentAportesInIncidentsCache(incidentId, (current) => [newLocal, ...(current || [])]);

    setAporteText('');
    setAporteTextFiles([]);
    setAporteImageFiles([]);
    setAporteAudioFiles([]);
    setAporteVideoFiles([]);

    Alert.alert('Modo Offline', 'Aporte registrado localmente. Se sincronizará cuando haya conexión.');
    // Requerimiento: cerrar modal al crear aporte (offline)
    closeAportesModal();
  };

  const startEditingAporte = async (a: IncidentContribution) => {
    setEditingAporte(a);
    setShowAporteComposer(true);
    setAporteText(a.aporte || '');
    setAporteTextFiles([]);
    setAporteImageFiles([]);
    setAporteAudioFiles([]);
    setAporteVideoFiles([]);
  };

  const deleteAporte = async (a: IncidentContribution) => {
    if (!selectedIncidentForAportes) return;
    if (!employee) return;
    const incidentId = selectedIncidentForAportes.id;

    const can = canModifyAporte(a.rol_aporte, a.empleado_id, parseInt(String(employee.id || '0'), 10), currentRoleName);
    if (!can) {
      Alert.alert('Sin permiso', 'No puedes eliminar este aporte');
      return;
    }

    Alert.alert('Confirmar', '¿Eliminar este aporte?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          const isConnected = await getConnectionStatus();
          if (isConnected && a.id && a.id_local === '') {
            const res = await deleteIncidentContribution({ incidentId, contributionId: a.id, refreshAccessToken, logout });
            if (res.status) {
              await fetchAportesForIncident(incidentId);
            } else {
              Alert.alert('Error', res.message || 'No se pudo eliminar');
            }
            return;
          }

          // offline
          const actions = await readContributionActions();
          if (a.id_local && a.id_local !== '') {
            // remove pending create
            const filtered = actions.filter((x: any) => x.id !== a.id_local);
            await writeContributionActions(filtered);
          } else {
            actions.push({ type: 'delete', incidentId, contributionId: a.id });
            await writeContributionActions(actions);
          }

          const next = aportes.filter((x) => (a.id_local ? x.id_local !== a.id_local : x.id !== a.id));
          setAportes(next);
          await updateIncidentAportesInIncidentsCache(incidentId, () => next);

          Alert.alert('Modo Offline', 'Aporte eliminado localmente. Se sincronizará cuando haya conexión.');
        },
      },
    ]);
  };

  const renderDatePicker = (visible: boolean, onClose: () => void, onPick: (iso: string) => void) => {
    if (!visible) return null;
    return (
      <View style={styles.inlinePickerContainer}>
        <DateTimePicker
          value={pickerDateValue}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, selected) => {
            if (Platform.OS === 'android') onClose();
            if (!selected) return;
            setPickerDateValue(selected);
            onPick(isoDateOnly(selected));
          }}
        />
      </View>
    );
  };

  const renderFilesSection = () => {
    return (
      <ThemedView style={styles.formGroup}>
        <ThemedText style={styles.formLabel}>Agregar archivos</ThemedText>

        <ThemedView style={styles.fileIconButtonsRow}>
          <TouchableOpacity style={styles.fileIconButton} onPress={() => handleAddFile('image')}>
            <Ionicons name="image-outline" size={20} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.fileIconButton} onPress={() => handleAddFile('audio')}>
            <Ionicons name="mic-outline" size={20} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.fileIconButton} onPress={() => handleAddFile('video')}>
            <Ionicons name="videocam-outline" size={20} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.fileIconButton} onPress={() => handleAddFile('document')}>
            <Ionicons name="document-text-outline" size={20} color="#007AFF" />
          </TouchableOpacity>
        </ThemedView>

        {(textFiles.length + imageFiles.length + audioFiles.length + videoFiles.length) > 0 && (
          <ThemedView style={styles.filesList}>
            {/* Images with thumbnails */}
            {imageFiles.map(file => (
              <ThemedView key={file.id} style={styles.fileRow}>
                <Image
                  source={{ uri: `data:image/${file.extension || 'jpeg'};base64,${file.base64}` }}
                  style={styles.filePreviewImage}
                  resizeMode="cover"
                />
                <ThemedText numberOfLines={1} style={styles.fileName}>{file.name}</ThemedText>
                <TouchableOpacity onPress={() => removeLocalFile('image', file.id)}>
                  <Ionicons name="trash" size={16} color="#FF3B30" />
                </TouchableOpacity>
              </ThemedView>
            ))}

            {/* Audio */}
            {audioFiles.map(file => (
              <ThemedView key={file.id} style={styles.fileRow}>
                <Ionicons name="musical-notes-outline" size={16} color="#007AFF" />
                <ThemedText numberOfLines={1} style={styles.fileName}>{file.name}</ThemedText>
                <TouchableOpacity onPress={() => removeLocalFile('audio', file.id)}>
                  <Ionicons name="trash" size={16} color="#FF3B30" />
                </TouchableOpacity>
              </ThemedView>
            ))}

            {/* Video */}
            {videoFiles.map(file => (
              <ThemedView key={file.id} style={styles.fileRow}>
                <Ionicons name="videocam-outline" size={16} color="#007AFF" />
                <ThemedText numberOfLines={1} style={styles.fileName}>{file.name}</ThemedText>
                <TouchableOpacity onPress={() => removeLocalFile('video', file.id)}>
                  <Ionicons name="trash" size={16} color="#FF3B30" />
                </TouchableOpacity>
              </ThemedView>
            ))}

            {/* Documents */}
            {textFiles.map(file => (
              <ThemedView key={file.id} style={styles.fileRow}>
                <Ionicons name="document-text-outline" size={16} color="#007AFF" />
                <ThemedText numberOfLines={1} style={styles.fileName}>{file.name}</ThemedText>
                <TouchableOpacity onPress={() => removeLocalFile('document', file.id)}>
                  <Ionicons name="trash" size={16} color="#FF3B30" />
                </TouchableOpacity>
              </ThemedView>
            ))}
          </ThemedView>
        )}
      </ThemedView>
    );
  };

  const renderAporteFilesSection = () => {
    return (
      <ThemedView style={styles.formGroup}>
        <ThemedText style={styles.formLabel}>Agregar archivos</ThemedText>

        <ThemedView style={styles.fileIconButtonsRow}>
          <TouchableOpacity style={styles.fileIconButton} onPress={() => handleAddAporteFile('image')}>
            <Ionicons name="image-outline" size={20} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.fileIconButton} onPress={() => handleAddAporteFile('audio')}>
            <Ionicons name="mic-outline" size={20} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.fileIconButton} onPress={() => handleAddAporteFile('video')}>
            <Ionicons name="videocam-outline" size={20} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.fileIconButton} onPress={() => handleAddAporteFile('document')}>
            <Ionicons name="document-text-outline" size={20} color="#007AFF" />
          </TouchableOpacity>
        </ThemedView>

        {(aporteTextFiles.length + aporteImageFiles.length + aporteAudioFiles.length + aporteVideoFiles.length) > 0 && (
          <ThemedView style={styles.filesList}>
            {aporteImageFiles.map(file => (
              <ThemedView key={file.id} style={styles.fileRow}>
                <Image
                  source={{ uri: `data:image/${file.extension || 'jpeg'};base64,${file.base64}` }}
                  style={styles.filePreviewImage}
                  resizeMode="cover"
                />
                <ThemedText numberOfLines={1} style={styles.fileName}>{file.name}</ThemedText>
                <TouchableOpacity onPress={() => removeAporteLocalFile('image', file.id)}>
                  <Ionicons name="trash" size={16} color="#FF3B30" />
                </TouchableOpacity>
              </ThemedView>
            ))}

            {aporteAudioFiles.map(file => (
              <ThemedView key={file.id} style={styles.fileRow}>
                <Ionicons name="musical-notes-outline" size={16} color="#007AFF" />
                <ThemedText numberOfLines={1} style={styles.fileName}>{file.name}</ThemedText>
                <TouchableOpacity onPress={() => removeAporteLocalFile('audio', file.id)}>
                  <Ionicons name="trash" size={16} color="#FF3B30" />
                </TouchableOpacity>
              </ThemedView>
            ))}

            {aporteVideoFiles.map(file => (
              <ThemedView key={file.id} style={styles.fileRow}>
                <Ionicons name="videocam-outline" size={16} color="#007AFF" />
                <ThemedText numberOfLines={1} style={styles.fileName}>{file.name}</ThemedText>
                <TouchableOpacity onPress={() => removeAporteLocalFile('video', file.id)}>
                  <Ionicons name="trash" size={16} color="#FF3B30" />
                </TouchableOpacity>
              </ThemedView>
            ))}

            {aporteTextFiles.map(file => (
              <ThemedView key={file.id} style={styles.fileRow}>
                <Ionicons name="document-text-outline" size={16} color="#007AFF" />
                <ThemedText numberOfLines={1} style={styles.fileName}>{file.name}</ThemedText>
                <TouchableOpacity onPress={() => removeAporteLocalFile('document', file.id)}>
                  <Ionicons name="trash" size={16} color="#FF3B30" />
                </TouchableOpacity>
              </ThemedView>
            ))}
          </ThemedView>
        )}
      </ThemedView>
    );
  };

  const renderIncidentForm = (incident: EditingIncident, mode: 'create' | 'edit') => {
    const isEdit = mode === 'edit';
    const readOnly = isEdit; // campos de creación quedan bloqueados en edición

    return (
      <ThemedView style={[styles.card, styles.formCard]}>
        <ThemedText style={styles.formTitle}>{isEdit ? 'Editar Incidente' : 'Nuevo Incidente'}</ThemedText>

        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Ejecutivo de cuenta:</ThemedText>
          <ThemedView style={styles.pickerContainer}>
            <Picker
              enabled={!readOnly}
              selectedValue={incident.ejecutivo_id ?? 0}
              onValueChange={(val) => {
                const id = Number(val) || null;
                ejecutivoRef.current = id;
                if (isCreating) setNewIncident(prev => ({ ...prev, ejecutivo_id: id }));
                if (editingIncident) setEditingIncident(prev => prev ? ({ ...prev, ejecutivo_id: id }) : prev);

                // Autofill responsable atención con el nombre del ejecutivo seleccionado (requerimiento)
                const exec = executives.find(e => e.id === id);
                if (exec?.nombre) {
                  nombreResponsableAtencionRef.current = exec.nombre;
                }
              }}
              style={styles.picker}
            >
              <Picker.Item label="Seleccionar..." value={0} />
              {executives.map(e => (
                <Picker.Item key={e.id} label={e.nombre} value={e.id} />
              ))}
            </Picker>
          </ThemedView>
        </ThemedView>

        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Fecha del incidente:</ThemedText>
          <TouchableOpacity
            disabled={readOnly}
            style={[styles.dateButton, readOnly && styles.disabledButton]}
            onPress={() => { setPickerDateValue(new Date()); setShowFechaIncidentePicker(true); }}
          >
            <ThemedText style={styles.dateButtonText}>{dateLabel(incident.fecha_incidente) || 'Seleccionar fecha'}</ThemedText>
            <Ionicons name="calendar" size={18} color="#007AFF" />
          </TouchableOpacity>
          {renderDatePicker(showFechaIncidentePicker, () => setShowFechaIncidentePicker(false), (iso) => {
            fechaIncidenteRef.current = iso;
            if (isCreating) setNewIncident(prev => ({ ...prev, fecha_incidente: iso }));
            if (editingIncident) setEditingIncident(prev => prev ? ({ ...prev, fecha_incidente: iso }) : prev);
          })}
        </ThemedView>

        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Fecha del reporte:</ThemedText>
          <TouchableOpacity
            disabled={readOnly}
            style={[styles.dateButton, readOnly && styles.disabledButton]}
            onPress={() => { setPickerDateValue(new Date()); setShowFechaReportePicker(true); }}
          >
            <ThemedText style={styles.dateButtonText}>{dateLabel(incident.fecha_reporte) || 'Seleccionar fecha'}</ThemedText>
            <Ionicons name="calendar" size={18} color="#007AFF" />
          </TouchableOpacity>
          {renderDatePicker(showFechaReportePicker, () => setShowFechaReportePicker(false), (iso) => {
            fechaReporteRef.current = iso;
            if (isCreating) setNewIncident(prev => ({ ...prev, fecha_reporte: iso }));
            if (editingIncident) setEditingIncident(prev => prev ? ({ ...prev, fecha_reporte: iso }) : prev);
          })}
        </ThemedView>

        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Nombre de quien reporta la incidencia:</ThemedText>
          <TextInput
            style={[styles.formInput, readOnly && styles.disabledInput]}
            editable={!readOnly}
            defaultValue={incident.nombre_responsable}
            onChangeText={(t) => { nombreResponsableRef.current = t; }}
            placeholder="Nombre completo"
            placeholderTextColor="#999"
            key={`nr-${mode}-${incident.id_local || incident.id}`}
          />
        </ThemedView>

        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Clasificación:</ThemedText>
          <ThemedView style={styles.pickerContainer}>
            <Picker
              enabled={!readOnly}
              selectedValue={incident.clasificacion_id ?? 0}
              onValueChange={(val) => {
                const id = Number(val) || null;
                clasificacionRef.current = id;
                if (isCreating) setNewIncident(prev => ({ ...prev, clasificacion_id: id }));
                if (editingIncident) setEditingIncident(prev => prev ? ({ ...prev, clasificacion_id: id }) : prev);
              }}
              style={styles.picker}
            >
              <Picker.Item label="Seleccionar..." value={0} />
              {classifications.map(c => (
                <Picker.Item key={c.id} label={c.nombre} value={c.id} />
              ))}
            </Picker>
          </ThemedView>
        </ThemedView>

        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Descripción del incidente:</ThemedText>
          <TextInput
            style={[styles.formInput, styles.textArea, readOnly && styles.disabledInput]}
            editable={!readOnly}
            defaultValue={incident.descripcion}
            onChangeText={(t) => { descripcionRef.current = t; }}
            placeholder="Describe el incidente..."
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            key={`desc-${mode}-${incident.id_local || incident.id}`}
          />
        </ThemedView>

        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Involucrados:</ThemedText>
          {(isCreating ? newIncident.involucrados : (editingIncident?.involucrados || [])).map((inv, idx) => (
            <ThemedView key={`${mode}-inv-${idx}`} style={styles.involucradoRow}>
              <TextInput
                style={[styles.formInput, styles.smallInput, readOnly && styles.disabledInput]}
                editable={!readOnly}
                defaultValue={inv.codigo}
                onChangeText={(t) => updateInvolucrado(idx, 'codigo', t)}
                placeholder="Código (opcional)"
                placeholderTextColor="#999"
              />
              <TextInput
                style={[styles.formInput, styles.flexInput, readOnly && styles.disabledInput]}
                editable={!readOnly}
                defaultValue={inv.nombre}
                onChangeText={(t) => updateInvolucrado(idx, 'nombre', t)}
                placeholder="Nombre completo"
                placeholderTextColor="#999"
              />
              {!readOnly && (
                <TouchableOpacity onPress={() => removeInvolucrado(idx)}>
                  <Ionicons name="close-circle" size={20} color="#FF3B30" />
                </TouchableOpacity>
              )}
            </ThemedView>
          ))}
          {!readOnly && (
            <TouchableOpacity style={styles.addSmallButton} onPress={handleAddInvolucrado}>
              <Ionicons name="add" size={18} color="#007AFF" />
              <ThemedText style={styles.addSmallButtonText}>Agregar involucrado</ThemedText>
            </TouchableOpacity>
          )}
        </ThemedView>

        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Fecha de libro de novedades y número de folio:</ThemedText>
          <TouchableOpacity
            disabled={readOnly}
            style={[styles.dateButton, readOnly && styles.disabledButton]}
            onPress={() => { setPickerDateValue(new Date()); setShowLibroFechaPicker(true); }}
          >
            <ThemedText style={styles.dateButtonText}>{dateLabel(incident.libro_fecha) || 'Seleccionar fecha'}</ThemedText>
            <Ionicons name="calendar" size={18} color="#007AFF" />
          </TouchableOpacity>
          {renderDatePicker(showLibroFechaPicker, () => setShowLibroFechaPicker(false), (iso) => {
            if (isCreating) setNewIncident(prev => ({ ...prev, libro_fecha: iso }));
            if (editingIncident) setEditingIncident(prev => prev ? ({ ...prev, libro_fecha: iso }) : prev);
          })}
          <TextInput
            style={[styles.formInput, readOnly && styles.disabledInput]}
            editable={!readOnly}
            defaultValue={incident.libro_numero}
            onChangeText={(t) => {
              if (isCreating) setNewIncident(prev => ({ ...prev, libro_numero: t }));
              if (editingIncident) setEditingIncident(prev => prev ? ({ ...prev, libro_numero: t }) : prev);
            }}
            placeholder="Número de folio"
            placeholderTextColor="#999"
          />
        </ThemedView>

        {!isEdit && renderFilesSection()}

        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Nombre del responsable de atención:</ThemedText>
          <TextInput
            style={[styles.formInput, readOnly && styles.disabledInput]}
            editable={!readOnly}
            defaultValue={incident.nombre_responsable_atencion}
            onChangeText={(t) => { nombreResponsableAtencionRef.current = t; }}
            placeholder="Nombre completo"
            placeholderTextColor="#999"
            key={`nra-${mode}-${incident.id_local || incident.id}`}
          />
        </ThemedView>

        {/* Edit-only fields */}
        {isEdit && (
          <>
            <ThemedView style={styles.separator} />
            <ThemedText style={styles.sectionTitle}>Solución / Informe</ThemedText>

            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Solución Propuesta:</ThemedText>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                defaultValue={incident.solucion}
                onChangeText={(t) => { solucionRef.current = t; }}
                placeholder="Describe la solución..."
                placeholderTextColor="#999"
                multiline
                numberOfLines={3}
                key={`sol-${incident.id}`}
              />
            </ThemedView>

            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Fecha de la solución propuesta:</ThemedText>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => { setPickerDateValue(new Date()); setShowFechaSolucionPicker(true); }}
              >
                <ThemedText style={styles.dateButtonText}>{dateLabel(incident.fecha_solucion) || 'Seleccionar fecha'}</ThemedText>
                <Ionicons name="calendar" size={18} color="#007AFF" />
              </TouchableOpacity>
              {renderDatePicker(showFechaSolucionPicker, () => setShowFechaSolucionPicker(false), (iso) => {
                fechaSolucionRef.current = iso;
                setEditingIncident(prev => prev ? ({ ...prev, fecha_solucion: iso }) : prev);
              })}
            </ThemedView>

            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Fecha real de la solución:</ThemedText>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => { setPickerDateValue(new Date()); setShowFechaRealSolucionPicker(true); }}
              >
                <ThemedText style={styles.dateButtonText}>{dateLabel(incident.fecha_real_solucion) || 'Seleccionar fecha'}</ThemedText>
                <Ionicons name="calendar" size={18} color="#007AFF" />
              </TouchableOpacity>
              {renderDatePicker(showFechaRealSolucionPicker, () => setShowFechaRealSolucionPicker(false), (iso) => {
                fechaRealSolucionRef.current = iso;
                setEditingIncident(prev => prev ? ({ ...prev, fecha_real_solucion: iso }) : prev);
              })}
            </ThemedView>

            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Costo asociado del incidente:</ThemedText>
              <TextInput
                style={styles.formInput}
                defaultValue={incident.costo_asociado}
                onChangeText={(t) => { costoAsociadoRef.current = t; }}
                placeholder="Costo"
                placeholderTextColor="#999"
                key={`cost-${incident.id}`}
              />
            </ThemedView>

            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Consecutivo informe:</ThemedText>
              <TextInput
                style={styles.formInput}
                defaultValue={incident.consecutivo_informe}
                onChangeText={(t) => { consecutivoInformeRef.current = t; }}
                placeholder="Consecutivo"
                placeholderTextColor="#999"
                key={`consec-${incident.id}`}
              />
            </ThemedView>

            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Link informe:</ThemedText>
              <TextInput
                style={styles.formInput}
                defaultValue={incident.link_informe}
                onChangeText={(t) => { linkInformeRef.current = t; }}
                placeholder="Link"
                placeholderTextColor="#999"
                key={`link-${incident.id}`}
              />
            </ThemedView>
          </>
        )}

        <ThemedView style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={isEdit ? () => handleUpdate(incident.id!) : handleCreate}
          >
            <ThemedText style={styles.confirmButtonText}>{getActionIcon('confirm')}</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={isEdit ? cancelEditing : cancelCreating}
          >
            <ThemedText style={styles.cancelButtonText}>{getActionIcon('cancel')}</ThemedText>
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
        <SlideMenu isVisible={isMenuVisible} onClose={handleMenuClose} onHomePress={handleHomePress} currentRoute="Incidents" />
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
            Debes registrar una marca de ingreso antes de acceder a Incidentes.
          </ThemedText>
          <TouchableOpacity style={styles.goBackButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color="#000000" />
            <ThemedText style={styles.goBackButtonText}>Volver</ThemedText>
          </TouchableOpacity>
        </ThemedView>
        <AppFooter />
        <SlideMenu isVisible={isMenuVisible} onClose={handleMenuClose} onHomePress={handleHomePress} currentRoute="Incidents" />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <AppHeader onMenuPress={handleMenuPress} title="Incidentes" />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <ThemedView style={styles.contentContainer}>
          <ThemedView style={styles.titleContainer}>
            <ThemedText type="title" style={styles.title}>
              {getActionIcon('incidents')} Incidentes
            </ThemedText>
            <ThemedText style={styles.subtitle}>Gestiona incidentes (online/offline)</ThemedText>
          </ThemedView>

          {error && (
            <ThemedView style={styles.errorBox}>
              <ThemedText style={styles.errorText}>{error}</ThemedText>
            </ThemedView>
          )}

          {!isCreating && !editingIncident && (
            <ThemedView style={styles.filtersMain}>
              <ThemedView style={styles.filterContent}>
                <ThemedText style={styles.filterLabel}>Buscar (responsables, ejecutivo, clasificación, descripción):</ThemedText>
                <TextInput
                  style={styles.searchInput}
                  value={searchText}
                  onChangeText={setSearchText}
                  placeholder="Buscar..."
                  placeholderTextColor="#999"
                />
              </ThemedView>
            </ThemedView>
          )}

          {!isCreating && !editingIncident && (
            <TouchableOpacity style={styles.createButton} onPress={startCreating}>
              <ThemedText style={styles.createButtonText}>{getActionIcon('add')}</ThemedText>
            </TouchableOpacity>
          )}

          {isCreating && renderIncidentForm(newIncident, 'create')}
          {editingIncident && renderIncidentForm(editingIncident, 'edit')}

          {!isCreating && !editingIncident && (
            <ThemedView style={styles.listContainer}>
              {filteredIncidents.length === 0 ? (
                <ThemedView style={styles.emptyContainer}>
                  <ThemedText style={styles.emptyText}>
                    {incidents.length === 0 ? 'No hay incidentes registrados aún' : 'No se encontraron incidentes con ese filtro'}
                  </ThemedText>
                </ThemedView>
              ) : (
                filteredIncidents.map((i) => (
                  <ThemedView key={i.id_local || String(i.id)} style={styles.card}>
                    <ThemedView style={styles.cardHeader}>
                      <ThemedText style={styles.cardTitle}>Incidente #{i.id_local ? `LOCAL-${i.id_local}` : i.id}</ThemedText>
                      <ThemedText style={styles.badge}>{i.estado ? 'Activo' : 'Inactivo'}</ThemedText>
                    </ThemedView>
                    <ThemedText style={styles.cardInfo}>Ejecutivo: {i.ejecutivo?.name || '-'}</ThemedText>
                    <ThemedText style={styles.cardInfo}>Clasificación: {i.clasificacion?.name || '-'}</ThemedText>
                    <ThemedText style={styles.cardInfo}>Fecha incidente: {dateLabel(i.fecha_incidente)}</ThemedText>
                    <ThemedText style={styles.cardInfo}>Fecha reporte: {dateLabel(i.fecha_reporte)}</ThemedText>
                    <ThemedText style={styles.cardInfo}>Reporta: {i.nombre_responsable || '-'}</ThemedText>
                    <ThemedText style={styles.cardInfo}>Atención: {i.nombre_responsable_atencion || '-'}</ThemedText>
                    <ThemedText style={styles.cardInfo} numberOfLines={3}>Descripción: {i.descripcion || '-'}</ThemedText>

                    {Array.isArray(i.files) && i.files.length > 0 && (
                      <IncidentFilesViewer incident={i} />
                    )}

                    <ThemedView style={styles.buttonRow}>
                      <TouchableOpacity style={styles.aportesButton} onPress={() => openAportesModal(i)}>
                        <Ionicons name="chatbubble-ellipses" size={20} color="#FFFFFF" />
                      </TouchableOpacity>
                      {i.owned && (
                      <TouchableOpacity style={styles.editButton} onPress={() => startEditing(i)}>
                        <ThemedText style={styles.editButtonText}>{getActionIcon('edit')}</ThemedText>
                      </TouchableOpacity>
                      )}
                      <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(i)}>
                        <ThemedText style={styles.deleteButtonText}>{getActionIcon('delete')}</ThemedText>
                      </TouchableOpacity>
                    </ThemedView>
                  </ThemedView>
                ))
              )}
            </ThemedView>
          )}
        </ThemedView>
      </ScrollView>

      {/* Modal Aportes */}
      <Modal
        visible={isAportesVisible && !!selectedIncidentForAportes}
        transparent={true}
        animationType="fade"
        onRequestClose={closeAportesModal}
      >
        <View style={styles.modalOverlay}>
          <ThemedView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>
                Aportes • Incidente #{selectedIncidentForAportes?.id_local ? `LOCAL-${selectedIncidentForAportes.id_local}` : selectedIncidentForAportes?.id}
              </ThemedText>
              <TouchableOpacity onPress={closeAportesModal}>
                <Ionicons name="close" size={24} color="#666666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={true}>
              {/* Botón para mostrar el formulario */}
              {!showAporteComposer && !editingAporte && (
                <TouchableOpacity
                  style={styles.showComposerButton}
                  onPress={() => setShowAporteComposer(true)}
                >
                  <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
                  <ThemedText style={styles.showComposerButtonText}>Nuevo aporte</ThemedText>
                </TouchableOpacity>
              )}

              {(showAporteComposer || !!editingAporte) && (
                <ThemedView style={styles.aporteComposer}>
                  <ThemedText style={styles.sectionTitle}>
                    {editingAporte ? 'Editar aporte' : 'Nuevo aporte'}
                  </ThemedText>
                  <TextInput
                    style={[styles.formInput, styles.textArea]}
                    value={aporteText}
                    onChangeText={setAporteText}
                    placeholder="Escribe tu aporte..."
                    placeholderTextColor="#999"
                    multiline
                    numberOfLines={3}
                  />

                  {renderAporteFilesSection()}

                  <ThemedView style={styles.buttonRow}>
                    <TouchableOpacity style={styles.confirmButton} onPress={submitAporte}>
                      <ThemedText style={styles.confirmButtonText}>{getActionIcon('confirm')}</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => {
                        setEditingAporte(null);
                        setShowAporteComposer(false);
                        setAporteText('');
                        setAporteTextFiles([]);
                        setAporteImageFiles([]);
                        setAporteAudioFiles([]);
                        setAporteVideoFiles([]);
                      }}
                    >
                      <ThemedText style={styles.cancelButtonText}>{getActionIcon('cancel')}</ThemedText>
                    </TouchableOpacity>
                  </ThemedView>
                </ThemedView>
              )}

              <ThemedView style={styles.separator} />

              {isLoadingAportes ? (
                <ThemedView style={{ paddingVertical: 20, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color="#007AFF" />
                  <ThemedText style={{ marginTop: 8, opacity: 0.7 }}>Cargando aportes...</ThemedText>
                </ThemedView>
              ) : aportes.length === 0 ? (
                <ThemedText style={styles.emptyText}>Aún no hay aportes.</ThemedText>
              ) : (
                aportes.map((a) => {
                  const myId = parseInt(String(employee?.id || '0'), 10);
                  const can = canModifyAporte(a.rol_aporte, a.empleado_id, myId, currentRoleName);
                  const isLocal = a.id_local && a.id_local !== '';

                  return (
                    <ThemedView key={a.id_local || String(a.id)} style={styles.aporteCard}>
                      <ThemedView style={styles.aporteHeaderRow}>
                        <ThemedText style={styles.aporteAuthor}>
                          {a.empleado_nombre || 'Empleado'} ({a.rol_aporte || '-'}){isLocal ? ' • Pendiente' : ''}
                        </ThemedText>
                        {can && (
                          <ThemedView style={{ flexDirection: 'row', gap: 10, backgroundColor: 'transparent' }}>
                            {!isLocal && (
                              <TouchableOpacity onPress={() => startEditingAporte(a)}>
                                <Ionicons name="pencil" size={18} color="#007AFF" />
                              </TouchableOpacity>
                            )}
                            <TouchableOpacity onPress={() => deleteAporte(a)}>
                              <Ionicons name="trash" size={18} color="#FF3B30" />
                            </TouchableOpacity>
                          </ThemedView>
                        )}
                      </ThemedView>
                      <ThemedText style={styles.aporteDate}>
                        {a.created_at ? new Date(a.created_at).toLocaleString() : ''}
                      </ThemedText>
                      <ThemedText style={styles.aporteText}>{a.aporte}</ThemedText>

                      {!!selectedIncidentForAportes?.id && (
                        <ContributionFilesViewer incidentId={selectedIncidentForAportes.id} contribution={a} />
                      )}
                    </ThemedView>
                  );
                })
              )}
            </ScrollView>
          </ThemedView>
        </View>
      </Modal>

      <AppFooter />
      <SlideMenu isVisible={isMenuVisible} onClose={handleMenuClose} onHomePress={handleHomePress} currentRoute="Incidents" />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { alignItems: 'center', padding: 20 },
  contentContainer: { width: '100%', maxWidth: 600 },

  titleContainer: {
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    width: '100%',
  },
  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, opacity: 0.7, textAlign: 'center' },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 16, fontSize: 16, opacity: 0.7 },

  noMarcaContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: 20 },
  noMarcaTitle: { fontSize: 24, fontWeight: 'bold', color: '#FF9500', textAlign: 'center' },
  noMarcaMessage: { fontSize: 16, color: '#666', textAlign: 'center', lineHeight: 24, maxWidth: 400 },
  goBackButton: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#007AFF', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, marginTop: 20 },
  goBackButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  errorBox: { backgroundColor: '#FFECEC', borderColor: '#FFB3B3', borderWidth: 1, padding: 12, borderRadius: 8, marginBottom: 16 },
  errorText: { color: '#B00020' },

  filtersMain: { width: '100%', marginBottom: 16, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#E0E0E0', overflow: 'hidden' },
  filterContent: { padding: 16, gap: 10, backgroundColor: '#F8F9FA' },
  filterLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8, color: '#333' },
  searchInput: { width: '100%', padding: 12, borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, fontSize: 16, backgroundColor: '#F9F9F9', color: '#000000' },

  createButton: { backgroundColor: '#007AFF', padding: 16, borderRadius: 8, alignItems: 'center', marginBottom: 16 },
  createButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  listContainer: { width: '100%', gap: 16, marginBottom: 50 },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 16, opacity: 0.5, textAlign: 'center' },

  card: { width: '100%', borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, backgroundColor: '#fff', padding: 16, gap: 8, },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff' },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#007AFF' },
  badge: { fontSize: 12, fontWeight: '600', color: '#34C759', backgroundColor: '#F0F9F4', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  cardInfo: { fontSize: 14, color: '#666' },

  formCard: { marginBottom: 16 },
  formTitle: { fontSize: 20, fontWeight: 'bold', color: '#007AFF', marginBottom: 8, textAlign: 'center' },
  formGroup: { marginBottom: 16, backgroundColor: '#fff' },
  formLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8, color: '#333' },
  formInput: { width: '100%', padding: 12, borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, fontSize: 16, backgroundColor: '#F9F9F9', color: '#000000' },
  disabledInput: { opacity: 0.7 },
  textArea: { height: 100, textAlignVertical: 'top' },

  pickerContainer: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, backgroundColor: '#F9F9F9', overflow: 'hidden' },
  picker: { width: '100%', height: 50 },

  dateButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, backgroundColor: '#F9F9F9' },
  dateButtonText: { fontSize: 16, color: '#000000' },
  disabledButton: { opacity: 0.6 },
  inlinePickerContainer: { marginTop: 8, borderRadius: 8, backgroundColor: '#FFFFFF' },

  involucradoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, backgroundColor: '#fff' },
  smallInput: { width: 120 },
  flexInput: { flex: 1 },
  addSmallButton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  addSmallButtonText: { color: '#007AFF', fontWeight: '600' },

  addFileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  addFileButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  fileIconButtonsRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 6 },
  fileIconButton: {
    width: 46,
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#007AFF',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
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

  separator: { height: 1, backgroundColor: '#E0E0E0', marginVertical: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 8, textAlign: 'center' },

  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 8, backgroundColor: '#fff' },
  aportesButton: { width: 48, backgroundColor: '#5856D6', padding: 12, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  editButton: { flex: 1, backgroundColor: '#007AFF', padding: 12, borderRadius: 6, alignItems: 'center' },
  editButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  deleteButton: { flex: 1, backgroundColor: '#FF3B30', padding: 12, borderRadius: 6, alignItems: 'center' },
  deleteButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  confirmButton: { flex: 1, backgroundColor: '#34C759', padding: 12, borderRadius: 6, alignItems: 'center' },
  confirmButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  cancelButton: { backgroundColor: '#8E8E93', padding: 12, borderRadius: 6, alignItems: 'center' },
  cancelButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  // Aportes modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContainer: { width: '100%', maxWidth: 700, maxHeight: '90%', backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden' },
  modalHeader: { padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E0E0E0', backgroundColor: '#F8F9FA' },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#333', flex: 1, paddingRight: 10 },
  modalContent: { padding: 14, backgroundColor: '#fff' },
  aporteComposer: { backgroundColor: '#fff' },
  showComposerButton: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#007AFF', padding: 12, borderRadius: 10, marginBottom: 12, justifyContent: 'center' },
  showComposerButtonText: { color: '#FFFFFF', fontWeight: '700' },
  aporteCard: { marginBottom: 12, padding: 12, borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10, backgroundColor: '#fff' },
  aporteHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'transparent' },
  aporteAuthor: { fontSize: 14, fontWeight: '700', color: '#007AFF', flex: 1, paddingRight: 10 },
  aporteDate: { fontSize: 12, color: '#666', marginTop: 2, marginBottom: 8 },
  aporteText: { fontSize: 14, color: '#333', marginBottom: 8 },

  // Files viewer styles
  collapsableSection: { marginTop: 12, borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, backgroundColor: '#F9F9F9', overflow: 'hidden' },
  collapsableHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#F0F0F0' },
  collapsableHeaderText: { fontSize: 14, fontWeight: '600', color: '#007AFF' },
  collapsableContent: { padding: 12, backgroundColor: '#F9F9F9' },
  viewerSection: { marginBottom: 16, backgroundColor: '#F9F9F9' },
  viewerSectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12, color: '#333' },
  viewerImage: { width: '100%', height: 200, borderRadius: 8, marginBottom: 8, backgroundColor: '#F0F0F0' },
  documentRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, backgroundColor: '#fff', marginBottom: 8 },
  documentText: { flex: 1, fontSize: 14, color: '#333' },
  audioPlayerContainer: { marginBottom: 16, padding: 12, borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, backgroundColor: '#fff' },
  audioLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8, color: '#333' },
  audioPlayer: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  playButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center' },
  audioTime: { fontSize: 14, fontWeight: '500', color: '#007AFF', flex: 1 },
  resetAudioButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 8, borderRadius: 8, backgroundColor: '#007AFF' },
});

// Componente para visualizar archivos de un incidente
function IncidentFilesViewer({ incident }: { incident: Incident }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const files = Array.isArray(incident.files) ? incident.files : [];

  if (files.length === 0) return null;

  const imageFiles = files.filter(f => f.type === 'image');
  const audioFiles = files.filter(f => f.type === 'audio');
  const videoFiles = files.filter(f => f.type === 'video');
  const documentFiles = files.filter(f => f.type === 'document' || (!f.type && f.extension));

  return (
    <ThemedView style={styles.collapsableSection}>
      <TouchableOpacity
        style={styles.collapsableHeader}
        onPress={() => setIsExpanded(!isExpanded)}
      >
        <ThemedText style={styles.collapsableHeaderText}>
          Archivos ({files.length})
        </ThemedText>
        <Ionicons
          name={isExpanded ? "chevron-up" : "chevron-down"}
          size={20}
          color="#007AFF"
        />
      </TouchableOpacity>

      {isExpanded && (
        <ThemedView style={styles.collapsableContent}>
          {/* Imágenes */}
          {imageFiles.length > 0 && (
            <ThemedView style={styles.viewerSection}>
              <ThemedText style={styles.viewerSectionTitle}>Imágenes</ThemedText>
              {imageFiles.map(file => (
                <IncidentImageViewer
                  key={file.id}
                  imageUrl={buildIncidentFileUrl(incident.id, file)}
                />
              ))}
            </ThemedView>
          )}

          {/* Audio */}
          {audioFiles.length > 0 && (
            <ThemedView style={styles.viewerSection}>
              <ThemedText style={styles.viewerSectionTitle}>Audios</ThemedText>
              {audioFiles.map(file => (
                <IncidentAudioPlayer
                  key={file.id}
                  sourceUrl={buildIncidentFileUrl(incident.id, file)}
                  label={getFileDisplayName(file)}
                />
              ))}
            </ThemedView>
          )}

          {/* Video */}
          {videoFiles.length > 0 && (
            <ThemedView style={styles.viewerSection}>
              <ThemedText style={styles.viewerSectionTitle}>Videos</ThemedText>
              {videoFiles.map(file => (
                <IncidentVideoPlayer
                  key={file.id}
                  sourceUrl={buildIncidentFileUrl(incident.id, file)}
                />
              ))}
            </ThemedView>
          )}

          {/* Documentos */}
          {documentFiles.length > 0 && (
            <ThemedView style={styles.viewerSection}>
              <ThemedText style={styles.viewerSectionTitle}>Documentos</ThemedText>
              {documentFiles.map(file => (
                <TouchableOpacity
                  key={file.id}
                  style={styles.documentRow}
                  onPress={() => {
                    const url = buildIncidentFileUrl(incident.id, file);
                    if (url) {
                      Linking.openURL(url);
                    } else {
                      Alert.alert('Error', 'URL inválida para descargar el archivo');
                    }
                  }}
                >
                  <Ionicons name="document-text-outline" size={20} color="#007AFF" />
                  <ThemedText numberOfLines={1} style={styles.documentText}>
                    {getFileDisplayName(file)}
                  </ThemedText>
                  <Ionicons name="download-outline" size={20} color="#007AFF" />
                </TouchableOpacity>
              ))}
            </ThemedView>
          )}
        </ThemedView>
      )}
    </ThemedView>
  );
}

// Archivos de un aporte (contribución) en formato collapsable
function ContributionFilesViewer({ incidentId, contribution }: { incidentId: number; contribution: IncidentContribution }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const files = Array.isArray(contribution.files) ? contribution.files : [];

  if (files.length === 0) return null;

  const imageFiles = files.filter(f => f.type === 'image');
  const audioFiles = files.filter(f => f.type === 'audio');
  const videoFiles = files.filter(f => f.type === 'video');
  const documentFiles = files.filter(f => f.type === 'document' || (!f.type && f.extension));

  return (
    <ThemedView style={styles.collapsableSection}>
      <TouchableOpacity
        style={styles.collapsableHeader}
        onPress={() => setIsExpanded(!isExpanded)}
      >
        <ThemedText style={styles.collapsableHeaderText}>
          Archivos ({files.length})
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
              {imageFiles.map(file => (
                <IncidentImageViewer
                  key={file.id}
                  imageUrl={buildContributionFileUrl(incidentId, contribution.id, file)}
                />
              ))}
            </ThemedView>
          )}

          {audioFiles.length > 0 && (
            <ThemedView style={styles.viewerSection}>
              <ThemedText style={styles.viewerSectionTitle}>Audios</ThemedText>
              {audioFiles.map(file => (
                <IncidentAudioPlayer
                  key={file.id}
                  sourceUrl={buildContributionFileUrl(incidentId, contribution.id, file)}
                  label={getFileDisplayName(file)}
                />
              ))}
            </ThemedView>
          )}

          {videoFiles.length > 0 && (
            <ThemedView style={styles.viewerSection}>
              <ThemedText style={styles.viewerSectionTitle}>Videos</ThemedText>
              {videoFiles.map(file => (
                <IncidentVideoPlayer
                  key={file.id}
                  sourceUrl={buildContributionFileUrl(incidentId, contribution.id, file)}
                />
              ))}
            </ThemedView>
          )}

          {documentFiles.length > 0 && (
            <ThemedView style={styles.viewerSection}>
              <ThemedText style={styles.viewerSectionTitle}>Documentos</ThemedText>
              {documentFiles.map(file => (
                <TouchableOpacity
                  key={file.id}
                  style={styles.documentRow}
                  onPress={() => {
                    const url = buildContributionFileUrl(incidentId, contribution.id, file);
                    if (url) {
                      Linking.openURL(url);
                    } else {
                      Alert.alert('Error', 'URL inválida para descargar el archivo');
                    }
                  }}
                >
                  <Ionicons name="document-text-outline" size={20} color="#007AFF" />
                  <ThemedText numberOfLines={1} style={styles.documentText}>
                    {getFileDisplayName(file)}
                  </ThemedText>
                  <Ionicons name="download-outline" size={20} color="#007AFF" />
                </TouchableOpacity>
              ))}
            </ThemedView>
          )}
        </ThemedView>
      )}
    </ThemedView>
  );
}

// Image viewer que ajusta el contenedor basado en dimensiones
function IncidentImageViewer({ imageUrl }: { imageUrl: string }) {
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

// Audio player para incidentes
function IncidentAudioPlayer({ sourceUrl, label }: { sourceUrl: string; label?: string }) {
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
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={24}
            color="#FFFFFF"
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
            size={20}
            color="#FFFFFF"
          />
        </TouchableOpacity>
      </ThemedView>
    </ThemedView>
  );
}

// Video player para incidentes
function IncidentVideoPlayer({ sourceUrl }: { sourceUrl: string }) {
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
        allowsFullscreen={true}
        allowsPictureInPicture={false}
      />
    </View>
  );
}


