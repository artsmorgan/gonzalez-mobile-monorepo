import React, { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
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
import { createCleanersControl, updateCleanersControl, deleteCleanersControl, listCleanersControlByCorpo } from '@/hooks/evaluationFunctions';
import { eventBus } from '@/hooks/eventBus';

// Import location data
const locationDataJson = require('@/assets/others/CR_ubicaciones.json');

type CleanersControlScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'CleanersControl'>;

interface CleanerControl {
  id: string;
  id_local: string;
  nombre_aseador: string | null;
  oficina_despacho: string | null;
  provincia: string | null;
  canton: string | null;
  distrito: string | null;
  direccion: string | null;
  metraje: string | null;
  horario: string | null;
  horas_dia: string | null;
  horas_semana: string | null;
  dias: string | null;
  cantidad_personal: string | null;
  detalle_supervision: string | null;
  fecha_inicio: string | null;
  lista_equipos_insumos: string | null;
  costo_mensual: string | null;
  costo_anual: string | null;
  codigo: string | null;
  plaza: string | null;
  observaciones: string | null;
  created_at: string;
  synced?: boolean;
}

interface EditingCleanerControl {
  id: string | null;
  id_local: string;
  nombre_aseador: string;
  oficina_despacho: string;
  provincia: string;
  canton: string;
  distrito: string;
  direccion: string;
  metraje: string;
  horario: string;
  horas_dia: string;
  horas_semana: string;
  dias: string;
  cantidad_personal: string;
  detalle_supervision: string;
  fecha_inicio: string;
  lista_equipos_insumos: string;
  costo_mensual: string;
  costo_anual: string;
  codigo: string;
  plaza: string;
  observaciones: string;
}

interface EquipoInsumo {
  cantidad: string;
  descripcion: string;
}

interface LocationData {
  provincias: {
    [key: string]: {
      nombre: string;
      cantones: {
        [key: string]: {
          nombre: string;
          distritos: {
            [key: string]: string;
          };
        };
      };
    };
  };
}

export default function CleanersControlScreen() {
  const { employee, refreshAccessToken, logout } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<CleanersControlScreenNavigationProp>();

  // Data states
  const [cleanerControls, setCleanerControls] = useState<CleanerControl[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasCurrentMarca, setHasCurrentMarca] = useState<boolean>(false);

  // Editing state
  const [editingRecord, setEditingRecord] = useState<EditingCleanerControl | null>(null);

  // Creating state
  const [isCreating, setIsCreating] = useState(false);

  // Location data
  const [locationData, setLocationData] = useState<LocationData | null>(locationDataJson as LocationData);
  const [provinces, setProvinces] = useState<Array<{ key: string; nombre: string }>>([]);
  const [cantons, setCantons] = useState<Array<{ key: string; nombre: string }>>([]);
  const [districts, setDistricts] = useState<Array<{ key: string; nombre: string }>>([]);

  // Form states
  const [nombreAseador, setNombreAseador] = useState('');
  const [oficinaDespacho, setOficinaDespacho] = useState('');
  const [provincia, setProvincia] = useState('');
  const [canton, setCanton] = useState('');
  const [distrito, setDistrito] = useState('');
  const [direccion, setDireccion] = useState('');
  const [metraje, setMetraje] = useState('');
  const [horario, setHorario] = useState('');
  const [horasDia, setHorasDia] = useState('');
  const [horasSemana, setHorasSemana] = useState('');
  const [dias, setDias] = useState('');
  const [cantidadPersonal, setCantidadPersonal] = useState('');
  const [detalleSupervision, setDetalleSupervision] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [listaEquiposInsumos, setListaEquiposInsumos] = useState<EquipoInsumo[]>([]);
  const [costoMensual, setCostoMensual] = useState('');
  const [costoAnual, setCostoAnual] = useState('');
  const [codigo, setCodigo] = useState('');
  const [plaza, setPlaza] = useState('');
  const [observaciones, setObservaciones] = useState('');

  // Date picker states
  const [showDatePickerInicio, setShowDatePickerInicio] = useState(false);

  // Expanded details state
  const [expandedRecordIds, setExpandedRecordIds] = useState<string[]>([]);

  // Load location data
  useEffect(() => {
    if (locationData) {
      // Initialize provinces list
      const provincesList = Object.keys(locationData.provincias).map(key => ({
        key,
        nombre: locationData.provincias[key].nombre,
      }));
      setProvinces(provincesList);
    }
  }, [locationData]);

  // Update cantons when province changes
  useEffect(() => {
    if (!locationData || !provincia) {
      setCantons([]);
      setDistricts([]);
      setCanton('');
      setDistrito('');
      return;
    }

    const selectedProvince = locationData.provincias[provincia];
    if (selectedProvince) {
      const cantonsList = Object.keys(selectedProvince.cantones).map(key => ({
        key,
        nombre: selectedProvince.cantones[key].nombre,
      }));
      setCantons(cantonsList);
      setDistricts([]);
      setCanton('');
      setDistrito('');
    }
  }, [provincia, locationData]);

  // Update districts when canton changes
  useEffect(() => {
    if (!locationData || !provincia || !canton) {
      setDistricts([]);
      setDistrito('');
      return;
    }

    const selectedProvince = locationData.provincias[provincia];
    if (selectedProvince && selectedProvince.cantones[canton]) {
      const selectedCanton = selectedProvince.cantones[canton];
      const districtsList = Object.keys(selectedCanton.distritos).map(key => ({
        key,
        nombre: selectedCanton.distritos[key],
      }));
      setDistricts(districtsList);
      setDistrito('');
    }
  }, [canton, provincia, locationData]);

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

  useFocusEffect(
    useCallback(() => {
      fetchCleanerControls();
    }, [])
  );

  useEffect(() => {
    const handler = () => {
      fetchCleanerControls();
    };

    eventBus.on('connectionRestored', handler);
    return () => {
      eventBus.off('connectionRestored', handler);
    };
  }, []);

  const fetchCleanerControls = async () => {
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
        const result = await listCleanersControlByCorpo({
          corpo_id: corpoId,
          refreshAccessToken,
          logout,
        });

        if (result.status && result.data) {
          setCleanerControls(result.data as CleanerControl[]);
        } else {
          setCleanerControls([]);
        }
      } else {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const cleanersCache = cache.filter((item: any) => item.type === 'cleaners_control');
          setCleanerControls(cleanersCache);
        } else {
          setCleanerControls([]);
        }
      }
    } catch (err) {
      console.error('Error fetching cleaner controls:', err);
      setError('Error al cargar los controles de aseadores');
      try {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const cleanersCache = cache.filter((item: any) => item.type === 'cleaners_control');
          setCleanerControls(cleanersCache);
        }
      } catch (cacheErr) {
        console.error('Error loading from cache:', cacheErr);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const startCreating = () => {
    setIsCreating(true);
    setNombreAseador('');
    setOficinaDespacho('');
    setProvincia('');
    setCanton('');
    setDistrito('');
    setDireccion('');
    setMetraje('');
    setHorario('');
    setHorasDia('');
    setHorasSemana('');
    setDias('');
    setCantidadPersonal('');
    setDetalleSupervision('');
    setFechaInicio('');
    setListaEquiposInsumos([]);
    setCostoMensual('');
    setCostoAnual('');
    setCodigo('');
    setPlaza('');
    setObservaciones('');
  };

  const cancelCreating = () => {
    setIsCreating(false);
  };

  const startEditing = (record: CleanerControl) => {
    // Parse lista_equipos_insumos from JSON string to array
    let equiposInsumosArray: EquipoInsumo[] = [];
    if (record.lista_equipos_insumos) {
      try {
        equiposInsumosArray = JSON.parse(record.lista_equipos_insumos);
      } catch (e) {
        console.error('Error parsing lista_equipos_insumos:', e);
        equiposInsumosArray = [];
      }
    }

    setEditingRecord({
      id: record.id,
      id_local: record.id_local,
      nombre_aseador: record.nombre_aseador || '',
      oficina_despacho: record.oficina_despacho || '',
      provincia: record.provincia || '',
      canton: record.canton || '',
      distrito: record.distrito || '',
      direccion: record.direccion || '',
      metraje: record.metraje || '',
      horario: record.horario || '',
      horas_dia: record.horas_dia || '',
      horas_semana: record.horas_semana || '',
      dias: record.dias || '',
      cantidad_personal: record.cantidad_personal || '',
      detalle_supervision: record.detalle_supervision || '',
      fecha_inicio: record.fecha_inicio || '',
      lista_equipos_insumos: record.lista_equipos_insumos || '',
      costo_mensual: record.costo_mensual || '',
      costo_anual: record.costo_anual || '',
      codigo: record.codigo || '',
      plaza: record.plaza || '',
      observaciones: record.observaciones || '',
    });
    setNombreAseador(record.nombre_aseador || '');
    setOficinaDespacho(record.oficina_despacho || '');
    setProvincia(record.provincia || '');
    setCanton(record.canton || '');
    setDistrito(record.distrito || '');
    setDireccion(record.direccion || '');
    setMetraje(record.metraje || '');
    setHorario(record.horario || '');
    setHorasDia(record.horas_dia || '');
    setHorasSemana(record.horas_semana || '');
    setDias(record.dias || '');
    setCantidadPersonal(record.cantidad_personal || '');
    setDetalleSupervision(record.detalle_supervision || '');
    setFechaInicio(record.fecha_inicio || '');
    setListaEquiposInsumos(equiposInsumosArray);
    setCostoMensual(record.costo_mensual || '');
    setCostoAnual(record.costo_anual || '');
    setCodigo(record.codigo || '');
    setPlaza(record.plaza || '');
    setObservaciones(record.observaciones || '');
  };

  const cancelEditing = () => {
    setEditingRecord(null);
  };

  const handleDateChangeInicio = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePickerInicio(false);
    }
    if (selectedDate) {
      setFechaInicio(formatDate(selectedDate));
    }
  };

  const saveCleanerControl = async () => {
    const currentMarca = await AsyncStorage.getItem('current_marca');
    if (!currentMarca) {
      Alert.alert('Error', 'No se encontró la marca actual');
      return;
    }

    const currentMarcaData = JSON.parse(currentMarca);

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas guardar este control de aseadores?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const requestData = {
                marca_id: currentMarcaData.id,
                nombre_aseador: nombreAseador.trim() || null,
                oficina_despacho: oficinaDespacho.trim() || null,
                provincia: provincia.trim() || null,
                canton: canton.trim() || null,
                distrito: distrito.trim() || null,
                direccion: direccion.trim() || null,
                metraje: metraje.trim() || null,
                horario: horario.trim() || null,
                horas_dia: horasDia.trim() || null,
                horas_semana: horasSemana.trim() || null,
                dias: dias.trim() || null,
                cantidad_personal: cantidadPersonal.trim() || null,
                detalle_supervision: detalleSupervision.trim() || null,
                fecha_inicio: fechaInicio.trim() || null,
                lista_equipos_insumos: listaEquiposInsumos.length > 0 ? JSON.stringify(listaEquiposInsumos) : null,
                costo_mensual: costoMensual.trim() || null,
                costo_anual: costoAnual.trim() || null,
                codigo: codigo.trim() || null,
                plaza: plaza.trim() || null,
                observaciones: observaciones.trim() || null,
              };

              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await createCleanersControl({
                  requestData,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Control de aseadores guardado correctamente');
                  cancelCreating();
                  fetchCleanerControls();
                } else {
                  Alert.alert('Error', result.message || 'Error al guardar el control de aseadores');
                }
              } else {
                const localId = generateRandomId();

                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: localId,
                  action: 'create',
                  type: 'cleaners_control',
                  payload: requestData,
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                const cache = cacheStr ? JSON.parse(cacheStr) : [];

                const newRecordCache: CleanerControl = {
                  id: '',
                  id_local: localId,
                  nombre_aseador: nombreAseador.trim() || null,
                  oficina_despacho: oficinaDespacho.trim() || null,
                  provincia: provincia.trim() || null,
                  canton: canton.trim() || null,
                  distrito: distrito.trim() || null,
                  direccion: direccion.trim() || null,
                  metraje: metraje.trim() || null,
                  horario: horario.trim() || null,
                  horas_dia: horasDia.trim() || null,
                  horas_semana: horasSemana.trim() || null,
                  dias: dias.trim() || null,
                  cantidad_personal: cantidadPersonal.trim() || null,
                  detalle_supervision: detalleSupervision.trim() || null,
                  fecha_inicio: fechaInicio.trim() || null,
                  lista_equipos_insumos: listaEquiposInsumos.length > 0 ? JSON.stringify(listaEquiposInsumos) : null,
                  costo_mensual: costoMensual.trim() || null,
                  costo_anual: costoAnual.trim() || null,
                  codigo: codigo.trim() || null,
                  plaza: plaza.trim() || null,
                  observaciones: observaciones.trim() || null,
                  created_at: new Date().toISOString(),
                  synced: false,
                };

                cache.push({ ...newRecordCache, type: 'cleaners_control' });
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(cache));

                Alert.alert('Modo Offline', 'Control de aseadores registrado localmente. Se sincronizará cuando haya conexión.');
                cancelCreating();
                fetchCleanerControls();
              }
            } catch (err) {
              console.error('Error saving cleaner control:', err);
              Alert.alert('Error', 'No se pudo guardar el control de aseadores');
            }
          },
        },
      ]
    );
  };

  const updateCleanerControlHandler = async () => {
    if (!editingRecord) return;

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas actualizar este control de aseadores?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const requestData = {
                nombre_aseador: nombreAseador.trim() || null,
                oficina_despacho: oficinaDespacho.trim() || null,
                provincia: provincia.trim() || null,
                canton: canton.trim() || null,
                distrito: distrito.trim() || null,
                direccion: direccion.trim() || null,
                metraje: metraje.trim() || null,
                horario: horario.trim() || null,
                horas_dia: horasDia.trim() || null,
                horas_semana: horasSemana.trim() || null,
                dias: dias.trim() || null,
                cantidad_personal: cantidadPersonal.trim() || null,
                detalle_supervision: detalleSupervision.trim() || null,
                fecha_inicio: fechaInicio.trim() || null,
                lista_equipos_insumos: listaEquiposInsumos.length > 0 ? JSON.stringify(listaEquiposInsumos) : null,
                costo_mensual: costoMensual.trim() || null,
                costo_anual: costoAnual.trim() || null,
                codigo: codigo.trim() || null,
                plaza: plaza.trim() || null,
                observaciones: observaciones.trim() || null,
              };

              const isConnected = await getConnectionStatus();
              const recordId = editingRecord.id || editingRecord.id_local;

              if (isConnected && editingRecord.id && !editingRecord.id.startsWith('local-')) {
                const result = await updateCleanersControl({
                  id: editingRecord.id,
                  requestData,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Control de aseadores actualizado correctamente');
                  cancelEditing();
                  fetchCleanerControls();
                } else {
                  Alert.alert('Error', result.message || 'Error al actualizar el control de aseadores');
                }
              } else {
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: recordId,
                  action: 'update',
                  type: 'cleaners_control',
                  payload: requestData,
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                if (cacheStr) {
                  const cache = JSON.parse(cacheStr);
                  const updatedCache = cache.map((item: any) => {
                    if ((item.id === recordId || item.id_local === recordId) && item.type === 'cleaners_control') {
                      return {
                        ...item,
                        nombre_aseador: nombreAseador.trim() || null,
                        oficina_despacho: oficinaDespacho.trim() || null,
                        provincia: provincia.trim() || null,
                        canton: canton.trim() || null,
                        distrito: distrito.trim() || null,
                        direccion: direccion.trim() || null,
                        metraje: metraje.trim() || null,
                        horario: horario.trim() || null,
                        horas_dia: horasDia.trim() || null,
                        horas_semana: horasSemana.trim() || null,
                        dias: dias.trim() || null,
                        cantidad_personal: cantidadPersonal.trim() || null,
                        detalle_supervision: detalleSupervision.trim() || null,
                        fecha_inicio: fechaInicio.trim() || null,
                        lista_equipos_insumos: listaEquiposInsumos.length > 0 ? JSON.stringify(listaEquiposInsumos) : null,
                        costo_mensual: costoMensual.trim() || null,
                        costo_anual: costoAnual.trim() || null,
                        codigo: codigo.trim() || null,
                        plaza: plaza.trim() || null,
                        observaciones: observaciones.trim() || null,
                      };
                    }
                    return item;
                  });
                  await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                }

                Alert.alert('Modo Offline', 'Control de aseadores actualizado localmente. Se sincronizará cuando haya conexión.');
                cancelEditing();
                fetchCleanerControls();
              }
            } catch (err) {
              console.error('Error updating cleaner control:', err);
              Alert.alert('Error', 'No se pudo actualizar el control de aseadores');
            }
          },
        },
      ]
    );
  };

  const deleteCleanerControlHandler = async (record: CleanerControl) => {
    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas eliminar este control de aseadores?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const isConnected = await getConnectionStatus();
              const recordId = record.id || record.id_local;

              if (isConnected && record.id && !record.id.startsWith('local-')) {
                const result = await deleteCleanersControl({
                  id: record.id,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Control de aseadores eliminado correctamente');
                  fetchCleanerControls();
                } else {
                  Alert.alert('Error', result.message || 'Error al eliminar el control de aseadores');
                }
              } else {
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: recordId,
                  action: 'delete',
                  type: 'cleaners_control',
                  payload: {},
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                if (cacheStr) {
                  const cache = JSON.parse(cacheStr);
                  const updatedCache = cache.filter((item: any) => !(item.id === recordId || item.id_local === recordId));
                  await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                }

                Alert.alert('Modo Offline', 'Control de aseadores eliminado localmente. Se sincronizará cuando haya conexión.');
                fetchCleanerControls();
              }
            } catch (err) {
              console.error('Error deleting cleaner control:', err);
              Alert.alert('Error', 'No se pudo eliminar el control de aseadores');
            }
          },
        },
      ]
    );
  };

  const toggleExpanded = (recordId: string) => {
    if (expandedRecordIds.includes(recordId)) {
      setExpandedRecordIds(expandedRecordIds.filter(id => id !== recordId));
    } else {
      setExpandedRecordIds([...expandedRecordIds, recordId]);
    }
  };

  const getProvinceName = (key: string): string => {
    if (!locationData || !key) return key;
    return locationData.provincias[key]?.nombre || key;
  };

  const getCantonName = (provinceKey: string, cantonKey: string): string => {
    if (!locationData || !provinceKey || !cantonKey) return cantonKey;
    return locationData.provincias[provinceKey]?.cantones[cantonKey]?.nombre || cantonKey;
  };

  const getDistrictName = (provinceKey: string, cantonKey: string, districtKey: string): string => {
    if (!locationData || !provinceKey || !cantonKey || !districtKey) return districtKey;
    return locationData.provincias[provinceKey]?.cantones[cantonKey]?.distritos[districtKey] || districtKey;
  };

  const renderForm = (isEditing: boolean = false) => {
    return (
      <ThemedView style={styles.formCard}>
        <ThemedText style={styles.formTitle}>
          {isEditing ? 'Editar Control de Aseadores' : 'Nuevo Control de Aseadores'}
        </ThemedText>

        {/* Nombre Aseador */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Nombre Aseador</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="Nombre del aseador"
            placeholderTextColor="#999"
            value={nombreAseador}
            onChangeText={setNombreAseador}
          />
        </ThemedView>

        {/* Oficina o Despacho */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Oficina o Despacho</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="Oficina o Despacho"
            placeholderTextColor="#999"
            value={oficinaDespacho}
            onChangeText={setOficinaDespacho}
          />
        </ThemedView>

        {/* Provincia */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Provincia</ThemedText>
          <ThemedView style={styles.pickerContainer}>
            <Picker
              selectedValue={provincia}
              onValueChange={(value: string) => setProvincia(value)}
              style={styles.picker}
            >
              <Picker.Item label="Seleccionar" value="" />
              {provinces.map((prov) => (
                <Picker.Item key={prov.key} label={prov.nombre} value={prov.key} />
              ))}
            </Picker>
          </ThemedView>
        </ThemedView>

        {/* Cantón */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Cantón</ThemedText>
          <ThemedView style={styles.pickerContainer}>
            <Picker
              selectedValue={canton}
              onValueChange={(value: string) => setCanton(value)}
              style={styles.picker}
              enabled={!!provincia}
            >
              <Picker.Item label={provincia ? "Seleccionar" : "Seleccione primero una provincia"} value="" />
              {cantons.map((cant) => (
                <Picker.Item key={cant.key} label={cant.nombre} value={cant.key} />
              ))}
            </Picker>
          </ThemedView>
        </ThemedView>

        {/* Distrito */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Distrito</ThemedText>
          <ThemedView style={styles.pickerContainer}>
            <Picker
              selectedValue={distrito}
              onValueChange={(value: string) => setDistrito(value)}
              style={styles.picker}
              enabled={!!canton}
            >
              <Picker.Item label={canton ? "Seleccionar" : "Seleccione primero un cantón"} value="" />
              {districts.map((dist) => (
                <Picker.Item key={dist.key} label={dist.nombre} value={dist.key} />
              ))}
            </Picker>
          </ThemedView>
        </ThemedView>

        {/* Dirección */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Dirección</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="Dirección"
            placeholderTextColor="#999"
            value={direccion}
            onChangeText={setDireccion}
          />
        </ThemedView>

        {/* Metraje */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Metraje</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="Metraje"
            placeholderTextColor="#999"
            value={metraje}
            onChangeText={setMetraje}
            keyboardType="numeric"
          />
        </ThemedView>

        {/* Horario */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Horario</ThemedText>
          <TextInput
            style={[styles.formInput, styles.textArea]}
            placeholder="Horario"
            placeholderTextColor="#999"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            value={horario}
            onChangeText={setHorario}
          />
        </ThemedView>

        {/* Horas/Día */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Horas/Día</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="Horas por día"
            placeholderTextColor="#999"
            value={horasDia}
            onChangeText={setHorasDia}
            keyboardType="numeric"
          />
        </ThemedView>

        {/* Horas/Semana */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Horas/Semana</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="Horas por semana"
            placeholderTextColor="#999"
            value={horasSemana}
            onChangeText={setHorasSemana}
            keyboardType="numeric"
          />
        </ThemedView>

        {/* Días */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Días</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="Días (ej: L-V)"
            placeholderTextColor="#999"
            value={dias}
            onChangeText={setDias}
          />
        </ThemedView>

        {/* Cantidad de personal */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Cantidad de personal</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="Cantidad de personal"
            placeholderTextColor="#999"
            value={cantidadPersonal}
            onChangeText={setCantidadPersonal}
            keyboardType="numeric"
          />
        </ThemedView>

        {/* Detalle de la Supervisión */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Detalle de la Supervisión para toda la Región</ThemedText>
          <TextInput
            style={[styles.formInput, styles.textArea]}
            placeholder="Detalle de la supervisión"
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            value={detalleSupervision}
            onChangeText={setDetalleSupervision}
          />
        </ThemedView>

        {/* Fecha de inicio */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Fecha de inicio (cotizar días feriados)</ThemedText>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowDatePickerInicio(true)}
          >
            <ThemedText style={styles.dateButtonText}>
              {fechaInicio || 'Seleccionar fecha'}
            </ThemedText>
            <Ionicons name="calendar" size={20} color="#007AFF" />
          </TouchableOpacity>
          {showDatePickerInicio && (
            <DateTimePicker
              value={fechaInicio ? new Date(fechaInicio.split('/').reverse().join('-')) : new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChangeInicio}
            />
          )}
        </ThemedView>

        {/* Lista de equipos e insumos */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Lista de equipos e insumos (mensuales)</ThemedText>
          {listaEquiposInsumos.map((item, index) => (
            <ThemedView key={index} style={styles.equipoInsumoItem}>
              <ThemedView style={styles.equipoInsumoRow}>
                <ThemedView style={styles.equipoInsumoInputContainer}>
                  <ThemedText style={styles.equipoInsumoLabel}>Cantidad</ThemedText>
                  <TextInput
                    style={[styles.formInput, styles.equipoInsumoInput]}
                    placeholder="Cantidad"
                    placeholderTextColor="#999"
                    value={item.cantidad}
                    onChangeText={(text) => {
                      const newList = [...listaEquiposInsumos];
                      newList[index].cantidad = text;
                      setListaEquiposInsumos(newList);
                    }}
                    keyboardType="numeric"
                  />
                </ThemedView>
                <ThemedView style={styles.equipoInsumoInputContainer}>
                  <ThemedText style={styles.equipoInsumoLabel}>Descripción</ThemedText>
                  <TextInput
                    style={[styles.formInput, styles.equipoInsumoInput]}
                    placeholder="Descripción"
                    placeholderTextColor="#999"
                    value={item.descripcion}
                    onChangeText={(text) => {
                      const newList = [...listaEquiposInsumos];
                      newList[index].descripcion = text;
                      setListaEquiposInsumos(newList);
                    }}
                  />
                </ThemedView>
                <TouchableOpacity
                  style={styles.removeEquipoInsumoButton}
                  onPress={() => {
                    const newList = listaEquiposInsumos.filter((_, i) => i !== index);
                    setListaEquiposInsumos(newList);
                  }}
                >
                  <Ionicons name="trash" size={20} color="#F44336" />
                </TouchableOpacity>
              </ThemedView>
            </ThemedView>
          ))}
          <TouchableOpacity
            style={styles.addEquipoInsumoButton}
            onPress={() => {
              setListaEquiposInsumos([...listaEquiposInsumos, { cantidad: '', descripcion: '' }]);
            }}
          >
            <Ionicons name="add-circle" size={20} color="#4CAF50" />
            <ThemedText style={styles.addEquipoInsumoButtonText}>Agregar Equipo/Insumo</ThemedText>
          </TouchableOpacity>
        </ThemedView>

        {/* Costo Mensual */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Costo Mensual</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="Costo mensual"
            placeholderTextColor="#999"
            value={costoMensual}
            onChangeText={setCostoMensual}
            keyboardType="decimal-pad"
          />
        </ThemedView>

        {/* Costo Anual */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Costo Anual</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="Costo anual"
            placeholderTextColor="#999"
            value={costoAnual}
            onChangeText={setCostoAnual}
            keyboardType="decimal-pad"
          />
        </ThemedView>

        {/* Código */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Código</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="Código"
            placeholderTextColor="#999"
            value={codigo}
            onChangeText={setCodigo}
          />
        </ThemedView>

        {/* Plaza */}
        <ThemedView style={styles.formGroup}>
          <ThemedText style={styles.formLabel}>Plaza</ThemedText>
          <TextInput
            style={styles.formInput}
            placeholder="Plaza"
            placeholderTextColor="#999"
            value={plaza}
            onChangeText={setPlaza}
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
            value={observaciones}
            onChangeText={setObservaciones}
          />
        </ThemedView>

        {/* Action Buttons */}
        <ThemedView style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.cancelButton]}
            onPress={isEditing ? cancelEditing : cancelCreating}
          >
            <ThemedText style={styles.actionButtonText}>Cancelar</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.saveButton]}
            onPress={isEditing ? updateCleanerControlHandler : saveCleanerControl}
          >
            <ThemedText style={styles.actionButtonText}>Guardar</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </ThemedView>
    );
  };

  const renderList = () => {
    if (isLoading) {
      return (
        <ThemedView style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#FF9500" />
          <ThemedText style={styles.loadingText}>Cargando controles de aseadores...</ThemedText>
        </ThemedView>
      );
    }

    if (error && cleanerControls.length === 0) {
      return (
        <ThemedView style={styles.centerContainer}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        </ThemedView>
      );
    }

    if (cleanerControls.length === 0) {
      return (
        <ThemedView style={styles.centerContainer}>
          <ThemedText style={styles.emptyText}>No hay controles de aseadores registrados</ThemedText>
        </ThemedView>
      );
    }

    return (
      <ThemedView style={styles.listContainer}>
        {cleanerControls.map((record) => {
          const recordId = record.id || record.id_local;
          const isExpanded = expandedRecordIds.includes(recordId);
          const isOffline = !record.synced || record.id_local;

          return (
            <ThemedView key={recordId} style={styles.listItem}>
              <TouchableOpacity
                style={styles.listItemHeader}
                onPress={() => toggleExpanded(recordId)}
              >
                <ThemedView style={styles.listItemHeaderContent}>
                  <ThemedText style={styles.listItemTitle}>
                    {record.nombre_aseador || record.oficina_despacho || 'Sin nombre'}
                  </ThemedText>
                  <ThemedText style={styles.listItemSubtitle}>
                    {getProvinceName(record.provincia || '')} - {getCantonName(record.provincia || '', record.canton || '')}
                  </ThemedText>
                </ThemedView>
                <ThemedView style={styles.listItemActions}>
                  {isOffline && (
                    <ThemedView style={styles.offlineBadge}>
                      <ThemedText style={styles.offlineBadgeText}>Offline</ThemedText>
                    </ThemedView>
                  )}
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={24}
                    color="#000000"
                  />
                </ThemedView>
              </TouchableOpacity>

              {isExpanded && (
                <ThemedView style={styles.listItemDetails}>
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Nombre Aseador: </ThemedText>
                    {record.nombre_aseador || 'No especificado'}
                  </ThemedText>
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Oficina o Despacho: </ThemedText>
                    {record.oficina_despacho || 'No especificado'}
                  </ThemedText>
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Provincia: </ThemedText>
                    {getProvinceName(record.provincia || '') || 'No especificado'}
                  </ThemedText>
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Cantón: </ThemedText>
                    {getCantonName(record.provincia || '', record.canton || '') || 'No especificado'}
                  </ThemedText>
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Distrito: </ThemedText>
                    {getDistrictName(record.provincia || '', record.canton || '', record.distrito || '') || 'No especificado'}
                  </ThemedText>
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Dirección: </ThemedText>
                    {record.direccion || 'No especificado'}
                  </ThemedText>
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Metraje: </ThemedText>
                    {record.metraje || 'No especificado'}
                  </ThemedText>
                  {record.horario && (
                    <ThemedText style={styles.detailText}>
                      <ThemedText style={styles.detailLabel}>Horario: </ThemedText>
                      {record.horario}
                    </ThemedText>
                  )}
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Horas/Día: </ThemedText>
                    {record.horas_dia || 'No especificado'}
                  </ThemedText>
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Horas/Semana: </ThemedText>
                    {record.horas_semana || 'No especificado'}
                  </ThemedText>
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Días: </ThemedText>
                    {record.dias || 'No especificado'}
                  </ThemedText>
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Cantidad de personal: </ThemedText>
                    {record.cantidad_personal || 'No especificado'}
                  </ThemedText>
                  {record.detalle_supervision && (
                    <ThemedText style={styles.detailText}>
                      <ThemedText style={styles.detailLabel}>Detalle de la Supervisión: </ThemedText>
                      {record.detalle_supervision}
                    </ThemedText>
                  )}
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Fecha de inicio: </ThemedText>
                    {record.fecha_inicio || 'No especificado'}
                  </ThemedText>
                  {record.lista_equipos_insumos && (() => {
                    try {
                      const equiposInsumos = JSON.parse(record.lista_equipos_insumos);
                      if (Array.isArray(equiposInsumos) && equiposInsumos.length > 0) {
                        return (
                          <ThemedView style={styles.equiposInsumosList}>
                            <ThemedText style={styles.detailLabel}>Lista de equipos e insumos: </ThemedText>
                            {equiposInsumos.map((item: EquipoInsumo, index: number) => (
                              <ThemedText key={index} style={styles.detailText}>
                                • {item.cantidad} - {item.descripcion}
                              </ThemedText>
                            ))}
                          </ThemedView>
                        );
                      }
                    } catch (e) {
                      // Fallback to plain text if parsing fails
                      return (
                        <ThemedText style={styles.detailText}>
                          <ThemedText style={styles.detailLabel}>Lista de equipos e insumos: </ThemedText>
                          {record.lista_equipos_insumos}
                        </ThemedText>
                      );
                    }
                    return null;
                  })()}
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Costo Mensual: </ThemedText>
                    {record.costo_mensual || 'No especificado'}
                  </ThemedText>
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Costo Anual: </ThemedText>
                    {record.costo_anual || 'No especificado'}
                  </ThemedText>
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Código: </ThemedText>
                    {record.codigo || 'No especificado'}
                  </ThemedText>
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Plaza: </ThemedText>
                    {record.plaza || 'No especificado'}
                  </ThemedText>
                  {record.observaciones && (
                    <ThemedText style={styles.detailText}>
                      <ThemedText style={styles.detailLabel}>Observaciones: </ThemedText>
                      {record.observaciones}
                    </ThemedText>
                  )}
                  <ThemedText style={styles.detailText}>
                    <ThemedText style={styles.detailLabel}>Fecha: </ThemedText>
                    {new Date(record.created_at).toLocaleDateString('es-CR')}
                  </ThemedText>

                  <ThemedView style={styles.listItemButtons}>
                    <TouchableOpacity
                      style={[styles.listItemButton, styles.editButton]}
                      onPress={() => startEditing(record)}
                    >
                      <Ionicons name="pencil" size={20} color="#FFFFFF" />
                      <ThemedText style={styles.listItemButtonText}>Editar</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.listItemButton, styles.deleteButton]}
                      onPress={() => deleteCleanerControlHandler(record)}
                    >
                      <Ionicons name="trash" size={20} color="#FFFFFF" />
                      <ThemedText style={styles.listItemButtonText}>Eliminar</ThemedText>
                    </TouchableOpacity>
                  </ThemedView>
                </ThemedView>
              )}
            </ThemedView>
          );
        })}
      </ThemedView>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <AppHeader onMenuPress={() => setIsMenuVisible(true)} title="Control de Aseadores" />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {!hasCurrentMarca && (
          <ThemedView style={styles.warningContainer}>
            <ThemedText style={styles.warningText}>
              No se encontró la marca actual. Por favor, marca tu entrada primero.
            </ThemedText>
          </ThemedView>
        )}

        {hasCurrentMarca && (
          <>
            {!isCreating && !editingRecord && (
              <TouchableOpacity style={styles.createButton} onPress={startCreating}>
                <Ionicons name="add-circle" size={24} color="#FFFFFF" />
                <ThemedText style={styles.createButtonText}>Nuevo Control</ThemedText>
              </TouchableOpacity>
            )}

            {isCreating && renderForm(false)}
            {editingRecord && renderForm(true)}
            {!isCreating && !editingRecord && renderList()}
          </>
        )}
      </ScrollView>

      <AppFooter />
      <SlideMenu
        isVisible={isMenuVisible}
        onClose={() => setIsMenuVisible(false)}
        onHomePress={() => navigation.navigate('Home')}
        currentRoute="CleanersControl"
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
    padding: 16,
  },
  warningContainer: {
    backgroundColor: '#FFE5E5',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  warningText: {
    color: '#D32F2F',
    fontSize: 14,
    textAlign: 'center',
  },
  createButton: {
    backgroundColor: '#FF9500',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#000000',
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#000000',
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000000',
    backgroundColor: '#FFFFFF',
  },
  textArea: {
    minHeight: 100,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    color: '#000000',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#000000',
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
  listContainer: {
    gap: 12,
  },
  listItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    overflow: 'hidden',
  },
  listItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  listItemHeaderContent: {
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
  detailText: {
    fontSize: 14,
    color: '#000000',
    marginBottom: 8,
  },
  detailLabel: {
    fontWeight: '600',
  },
  listItemButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
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
    backgroundColor: '#4CAF50',
  },
  deleteButton: {
    backgroundColor: '#F44336',
  },
  listItemButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: '#F44336',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  equipoInsumoItem: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  equipoInsumoRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  equipoInsumoInputContainer: {
    flex: 1,
  },
  equipoInsumoLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    color: '#000000',
  },
  equipoInsumoInput: {
    marginBottom: 0,
  },
  removeEquipoInsumoButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addEquipoInsumoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    gap: 8,
    marginTop: 8,
  },
  addEquipoInsumoButtonText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
  },
  equiposInsumosList: {
    marginTop: 4,
  },
});

