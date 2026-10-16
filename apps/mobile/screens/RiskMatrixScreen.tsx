import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  View,
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
import Ionicons from '@expo/vector-icons/build/Ionicons';
import * as Network from 'expo-network';
import { Picker } from '@react-native-picker/picker';
import {
  createRiskMatrix,
  updateRiskMatrix,
  deleteRiskMatrix,
  listRiskMatrixByCorpo,
} from '@/hooks/evaluationFunctions';
import { eventBus } from '@/hooks/eventBus';

type RiskMatrixScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'RiskMatrix'>;

interface ControlActual {
  control: string;
}

interface ControlAdicional {
  control_adicional_sugerido: string;
  frecuencia: string;
  responsable: string;
  fecha_implementacion: string;
  requerimientos_recursos: string;
  evidencia: string;
  eficaz: string;
  comentario: string;
}

interface Riesgo {
  proceso: string;
  riesgo: string;
  causas: string;
  probabilidad: string;
  valor_probabilidad: number;
  impacto: string;
  valor_impacto: number;
  nivel_riesgo: number;
  acciones_riesgo: string;
  controles_actuales: ControlActual[];
  controles_adicionales: ControlAdicional[];
}

interface RiskMatrix {
  id: string;
  id_local: string;
  riesgos: string | null; // JSON string of Riesgo[]
  created_at: string;
  synced?: boolean;
}

interface EditingRiskMatrix {
  id: string | null;
  id_local: string;
  riesgos: Riesgo[];
}

const PROBABILIDAD_OPTIONS = [
  { label: 'Seleccionar probabilidad', value: '', valor: 0 },
  { label: 'Certeza, muy probable', value: 'Certeza, muy probable', valor: 5 },
  { label: 'Probable, periódico', value: 'Probable, periódico', valor: 4 },
  { label: 'Posible, ocasional', value: 'Posible, ocasional', valor: 3 },
  { label: 'Improbable, muy poco', value: 'Improbable, muy poco', valor: 2 },
  { label: 'Raro, impredecible', value: 'Raro, impredecible', valor: 1 },
];

const IMPACTO_OPTIONS = [
  { label: 'Seleccionar impacto', value: '', valor: 0 },
  { label: 'Crítico, catastrófico', value: 'Crítico, catastrófico', valor: 5 },
  { label: 'Serio o mayor', value: 'Serio o mayor', valor: 4 },
  { label: 'Moderado', value: 'Moderado', valor: 3 },
  { label: 'Menor', value: 'Menor', valor: 2 },
  { label: 'Mínimo', value: 'Mínimo', valor: 1 },
];

const ACCIONES_RIESGO_OPTIONS = [
  { label: 'Seleccionar acción', value: '' },
  { label: 'Evitar', value: 'Evitar' },
  { label: 'Asumir', value: 'Asumir' },
  { label: 'Eliminar', value: 'Eliminar' },
  { label: 'Mitigar', value: 'Mitigar' },
  { label: 'Compartir', value: 'Compartir' },
  { label: 'Mantener', value: 'Mantener' },
];

const EFICAZ_OPTIONS = [
  { label: 'Seleccionar', value: '' },
  { label: 'Sí', value: 'Sí' },
  { label: 'No', value: 'No' },
];

const getNivelRiesgoColor = (nivel: number): string => {
  if (nivel >= 1 && nivel <= 4) return '#4CAF50'; // Verde - Bajo
  if (nivel >= 5 && nivel <= 14) return '#FFC107'; // Amarillo - Medio
  if (nivel >= 15 && nivel <= 25) return '#F44336'; // Rojo - Alto
  return '#9E9E9E'; // Gris - Sin definir
};

const getNivelRiesgoTexto = (nivel: number): string => {
  if (nivel >= 1 && nivel <= 4) return 'Bajo';
  if (nivel >= 5 && nivel <= 14) return 'Medio';
  if (nivel >= 15 && nivel <= 25) return 'Alto';
  return 'Sin definir';
};

export default function RiskMatrixScreen() {
  const { employee, refreshAccessToken, logout } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<RiskMatrixScreenNavigationProp>();

  // Data states
  const [matrices, setMatrices] = useState<RiskMatrix[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasCurrentMarca, setHasCurrentMarca] = useState<boolean>(false);

  // Editing state
  const [editingRecord, setEditingRecord] = useState<EditingRiskMatrix | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form states
  const [riesgos, setRiesgos] = useState<Riesgo[]>([]);

  // Expanded states
  const [expandedRiesgoIndices, setExpandedRiesgoIndices] = useState<number[]>([]);
  const [expandedControlIndices, setExpandedControlIndices] = useState<{ [riesgoIndex: number]: number[] }>({});
  const [expandedControlAdicionalIndices, setExpandedControlAdicionalIndices] = useState<{ [riesgoIndex: number]: number[] }>({});

  // Date picker states
  const [showDatePicker, setShowDatePicker] = useState<{ riesgoIndex: number; controlIndex: number } | null>(null);

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

  const fetchMatrices = useCallback(async () => {
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
        const result = await listRiskMatrixByCorpo({
          corpo_id: corpoId,
          refreshAccessToken,
          logout,
        });

        if (result.status && result.data) {
          setMatrices(result.data as RiskMatrix[]);
        } else {
          setMatrices([]);
        }
      } else {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const matricesCache = cache.filter((item: any) => item.type === 'risk_matrix');
          setMatrices(matricesCache);
        } else {
          setMatrices([]);
        }
      }
    } catch (err) {
      console.error('Error fetching matrices:', err);
      setError('Error al cargar las matrices de riesgos');
      try {
        const cacheStr = await AsyncStorage.getItem('evaluations_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const matricesCache = cache.filter((item: any) => item.type === 'risk_matrix');
          setMatrices(matricesCache);
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
      fetchMatrices();
      eventBus.on('connectionRestored', fetchMatrices);
      return () => {
        eventBus.off('connectionRestored', fetchMatrices);
      };
    }, [fetchMatrices])
  );

  const resetForm = () => {
    setRiesgos([]);
    setExpandedRiesgoIndices([]);
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

  const startEditing = (record: RiskMatrix) => {
    setIsCreating(false);
    let riesgosArray: Riesgo[] = [];

    if (record.riesgos) {
      try {
        const parsed = JSON.parse(record.riesgos);
        if (Array.isArray(parsed)) {
          // Migrar datos antiguos a nuevo formato
          riesgosArray = parsed.map((r: any) => {
            let controles: ControlActual[] = [];
            let controlesAdicionales: ControlAdicional[] = [];
            
            // Migrar controles actuales
            if (r.controles_actuales && Array.isArray(r.controles_actuales)) {
              controles = r.controles_actuales.map((c: any) => {
                if (c.control !== undefined) {
                  return { control: c.control || '' };
                } else if (c.acciones_abordar_riesgos || c.acciones_con_riesgo) {
                  return { control: `${c.acciones_abordar_riesgos || ''} ${c.acciones_con_riesgo || ''}`.trim() };
                }
                return { control: '' };
              });
            } else if (r.acciones_abordar_riesgos || r.acciones_con_riesgo) {
              const controlText = `${r.acciones_abordar_riesgos || ''} ${r.acciones_con_riesgo || ''}`.trim();
              if (controlText) {
                controles = [{ control: controlText }];
              }
            }
            
            // Migrar controles adicionales
            if (r.controles_adicionales && Array.isArray(r.controles_adicionales)) {
              controlesAdicionales = r.controles_adicionales;
            } else if (r.control_adicional_sugerido || r.frecuencia || r.responsable || r.fecha_implementacion || r.requerimientos_recursos || r.evidencia || r.eficaz || r.comentario) {
              // Formato antiguo con campos directos en el riesgo
              controlesAdicionales = [{
                control_adicional_sugerido: r.control_adicional_sugerido || '',
                frecuencia: r.frecuencia || '',
                responsable: r.responsable || '',
                fecha_implementacion: r.fecha_implementacion || '',
                requerimientos_recursos: r.requerimientos_recursos || '',
                evidencia: r.evidencia || '',
                eficaz: r.eficaz || '',
                comentario: r.comentario || '',
              }];
            }
            
            return {
              ...r,
              controles_actuales: controles,
              controles_adicionales: controlesAdicionales,
            };
          });
        } else {
          riesgosArray = [];
        }
      } catch (e) {
        riesgosArray = [];
      }
    }

    setEditingRecord({
      id: record.id,
      id_local: record.id_local,
      riesgos: riesgosArray,
    });

    setRiesgos(riesgosArray);
    setExpandedRiesgoIndices(riesgosArray.map((_, i) => i));
  };

  const cancelEditing = () => {
    setEditingRecord(null);
    resetForm();
  };

  const addRiesgo = () => {
    const newRiesgo: Riesgo = {
      proceso: '',
      riesgo: '',
      causas: '',
      probabilidad: '',
      valor_probabilidad: 0,
      impacto: '',
      valor_impacto: 0,
      nivel_riesgo: 0,
      acciones_riesgo: '',
      controles_actuales: [],
      controles_adicionales: [],
    };
    setRiesgos([...riesgos, newRiesgo]);
    setExpandedRiesgoIndices([...expandedRiesgoIndices, riesgos.length]);
  };

  const updateRiesgo = (index: number, field: keyof Riesgo, value: string | number) => {
    const newRiesgos = [...riesgos];
    const riesgo = { ...newRiesgos[index] };
    
    if (field === 'probabilidad') {
      const probabilidadOption = PROBABILIDAD_OPTIONS.find(opt => opt.value === value);
      riesgo.probabilidad = value as string;
      riesgo.valor_probabilidad = probabilidadOption?.valor || 0;
    } else if (field === 'impacto') {
      const impactoOption = IMPACTO_OPTIONS.find(opt => opt.value === value);
      riesgo.impacto = value as string;
      riesgo.valor_impacto = impactoOption?.valor || 0;
    } else {
      (riesgo as any)[field] = value;
    }

    // Calcular nivel de riesgo
    riesgo.nivel_riesgo = riesgo.valor_probabilidad * riesgo.valor_impacto;

    newRiesgos[index] = riesgo;
    setRiesgos(newRiesgos);
  };

  const removeRiesgo = (index: number) => {
    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas eliminar este riesgo?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            setRiesgos(riesgos.filter((_, i) => i !== index));
            setExpandedRiesgoIndices(expandedRiesgoIndices.filter(i => i !== index).map(i => i > index ? i - 1 : i));
            const newExpandedControls: { [riesgoIndex: number]: number[] } = {};
            Object.keys(expandedControlIndices).forEach(key => {
              const riesgoIdx = parseInt(key);
              if (riesgoIdx !== index) {
                newExpandedControls[riesgoIdx > index ? riesgoIdx - 1 : riesgoIdx] = expandedControlIndices[riesgoIdx];
              }
            });
            setExpandedControlIndices(newExpandedControls);
          },
        },
      ]
    );
  };

  const addControlActual = (riesgoIndex: number) => {
    const newRiesgos = [...riesgos];
    const riesgo = { ...newRiesgos[riesgoIndex] };
    riesgo.controles_actuales = [...(riesgo.controles_actuales || []), {
      control: '',
    }];
    newRiesgos[riesgoIndex] = riesgo;
    setRiesgos(newRiesgos);
    
    const currentExpanded = expandedControlIndices[riesgoIndex] || [];
    setExpandedControlIndices({
      ...expandedControlIndices,
      [riesgoIndex]: [...currentExpanded, (riesgo.controles_actuales.length - 1)],
    });
  };

  const updateControlActual = (riesgoIndex: number, controlIndex: number, value: string) => {
    const newRiesgos = [...riesgos];
    const riesgo = { ...newRiesgos[riesgoIndex] };
    const controles = [...(riesgo.controles_actuales || [])];
    controles[controlIndex] = {
      control: value,
    };
    riesgo.controles_actuales = controles;
    newRiesgos[riesgoIndex] = riesgo;
    setRiesgos(newRiesgos);
  };

  const removeControlActual = (riesgoIndex: number, controlIndex: number) => {
    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas eliminar este control actual?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            const newRiesgos = [...riesgos];
            const riesgo = { ...newRiesgos[riesgoIndex] };
            riesgo.controles_actuales = (riesgo.controles_actuales || []).filter((_, i) => i !== controlIndex);
            newRiesgos[riesgoIndex] = riesgo;
            setRiesgos(newRiesgos);
            
            const currentExpanded = expandedControlIndices[riesgoIndex] || [];
            setExpandedControlIndices({
              ...expandedControlIndices,
              [riesgoIndex]: currentExpanded.filter(i => i !== controlIndex).map(i => i > controlIndex ? i - 1 : i),
            });
          },
        },
      ]
    );
  };

  const toggleControlExpansion = (riesgoIndex: number, controlIndex: number) => {
    const currentExpanded = expandedControlIndices[riesgoIndex] || [];
    setExpandedControlIndices({
      ...expandedControlIndices,
      [riesgoIndex]: currentExpanded.includes(controlIndex)
        ? currentExpanded.filter(i => i !== controlIndex)
        : [...currentExpanded, controlIndex],
    });
  };

  const addControlAdicional = (riesgoIndex: number) => {
    const newRiesgos = [...riesgos];
    const riesgo = { ...newRiesgos[riesgoIndex] };
    riesgo.controles_adicionales = [...(riesgo.controles_adicionales || []), {
      control_adicional_sugerido: '',
      frecuencia: '',
      responsable: '',
      fecha_implementacion: '',
      requerimientos_recursos: '',
      evidencia: '',
      eficaz: '',
      comentario: '',
    }];
    newRiesgos[riesgoIndex] = riesgo;
    setRiesgos(newRiesgos);
    
    const currentExpanded = expandedControlAdicionalIndices[riesgoIndex] || [];
    setExpandedControlAdicionalIndices({
      ...expandedControlAdicionalIndices,
      [riesgoIndex]: [...currentExpanded, (riesgo.controles_adicionales.length - 1)],
    });
  };

  const updateControlAdicional = (riesgoIndex: number, controlIndex: number, field: keyof ControlAdicional, value: string) => {
    const newRiesgos = [...riesgos];
    const riesgo = { ...newRiesgos[riesgoIndex] };
    const controles = [...(riesgo.controles_adicionales || [])];
    controles[controlIndex] = {
      ...controles[controlIndex],
      [field]: value,
    };
    riesgo.controles_adicionales = controles;
    newRiesgos[riesgoIndex] = riesgo;
    setRiesgos(newRiesgos);
  };

  const removeControlAdicional = (riesgoIndex: number, controlIndex: number) => {
    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas eliminar este control adicional?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            const newRiesgos = [...riesgos];
            const riesgo = { ...newRiesgos[riesgoIndex] };
            riesgo.controles_adicionales = (riesgo.controles_adicionales || []).filter((_, i) => i !== controlIndex);
            newRiesgos[riesgoIndex] = riesgo;
            setRiesgos(newRiesgos);
            
            const currentExpanded = expandedControlAdicionalIndices[riesgoIndex] || [];
            setExpandedControlAdicionalIndices({
              ...expandedControlAdicionalIndices,
              [riesgoIndex]: currentExpanded.filter(i => i !== controlIndex).map(i => i > controlIndex ? i - 1 : i),
            });
          },
        },
      ]
    );
  };

  const toggleControlAdicionalExpansion = (riesgoIndex: number, controlIndex: number) => {
    const currentExpanded = expandedControlAdicionalIndices[riesgoIndex] || [];
    setExpandedControlAdicionalIndices({
      ...expandedControlAdicionalIndices,
      [riesgoIndex]: currentExpanded.includes(controlIndex)
        ? currentExpanded.filter(i => i !== controlIndex)
        : [...currentExpanded, controlIndex],
    });
  };

  const toggleRiesgoExpansion = (index: number) => {
    setExpandedRiesgoIndices(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const handleDateChange = (riesgoIndex: number, controlIndex: number, event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios' ? { riesgoIndex, controlIndex } : null);
    if (selectedDate) {
      updateControlAdicional(riesgoIndex, controlIndex, 'fecha_implementacion', formatDate(selectedDate));
    }
  };

  const saveMatrixHandler = async () => {
    const currentMarca = await AsyncStorage.getItem('current_marca');
    if (!currentMarca) {
      Alert.alert('Error', 'No se encontró la marca actual');
      return;
    }

    const currentMarcaData = JSON.parse(currentMarca);

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas guardar esta matriz de riesgos?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const requestData = {
                marca_id: currentMarcaData.id,
                riesgos: riesgos.length > 0 ? JSON.stringify(riesgos) : null,
              };

              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await createRiskMatrix({
                  requestData,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Matriz de riesgos guardada correctamente');
                  cancelCreating();
                  fetchMatrices();
                } else {
                  Alert.alert('Error', result.message || 'Error al guardar la matriz de riesgos');
                }
              } else {
                const localId = generateRandomId();

                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: localId,
                  action: 'create',
                  type: 'risk_matrix',
                  payload: requestData,
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                const cache = cacheStr ? JSON.parse(cacheStr) : [];

                const newRecordCache: RiskMatrix = {
                  id: '',
                  id_local: localId,
                  riesgos: riesgos.length > 0 ? JSON.stringify(riesgos) : null,
                  created_at: new Date().toISOString(),
                  synced: false,
                };

                cache.push({ ...newRecordCache, type: 'risk_matrix' });
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(cache));

                Alert.alert('Modo Offline', 'Matriz de riesgos registrada localmente. Se sincronizará cuando haya conexión.');
                cancelCreating();
                fetchMatrices();
              }
            } catch (err) {
              console.error('Error saving matrix:', err);
              Alert.alert('Error', 'No se pudo guardar la matriz de riesgos');
            }
          },
        },
      ]
    );
  };

  const updateMatrixHandler = async () => {
    if (!editingRecord) return;

    const recordId = editingRecord.id || editingRecord.id_local;
    if (!recordId) {
      Alert.alert('Error', 'ID de registro no encontrado para actualizar');
      return;
    }

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas actualizar esta matriz de riesgos?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const requestData = {
                riesgos: riesgos.length > 0 ? JSON.stringify(riesgos) : null,
              };

              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await updateRiskMatrix({
                  id: recordId,
                  requestData,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Matriz de riesgos actualizada correctamente');
                  cancelEditing();
                  fetchMatrices();
                } else {
                  Alert.alert('Error', result.message || 'Error al actualizar la matriz de riesgos');
                }
              } else {
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: recordId,
                  action: 'update',
                  type: 'risk_matrix',
                  payload: requestData,
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                if (cacheStr) {
                  const cache = JSON.parse(cacheStr);
                  const updatedCache = cache.map((item: any) => {
                    if ((item.id === recordId || item.id_local === recordId) && item.type === 'risk_matrix') {
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

                Alert.alert('Modo Offline', 'Matriz de riesgos actualizada localmente. Se sincronizará cuando haya conexión.');
                cancelEditing();
                fetchMatrices();
              }
            } catch (err) {
              console.error('Error updating matrix:', err);
              Alert.alert('Error', 'No se pudo actualizar la matriz de riesgos');
            }
          },
        },
      ]
    );
  };

  const deleteMatrixHandler = async (record: RiskMatrix) => {
    const recordId = record.id || record.id_local;
    if (!recordId) {
      Alert.alert('Error', 'ID de registro no encontrado para eliminar');
      return;
    }

    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas eliminar esta matriz de riesgos?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const isConnected = await getConnectionStatus();

              if (isConnected) {
                const result = await deleteRiskMatrix({
                  id: recordId,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  Alert.alert('Éxito', 'Matriz de riesgos eliminada correctamente');
                  fetchMatrices();
                } else {
                  Alert.alert('Error', result.message || 'Error al eliminar la matriz de riesgos');
                }
              } else {
                const actionsStr = await AsyncStorage.getItem('evaluations_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  id: recordId,
                  action: 'delete',
                  type: 'risk_matrix',
                  payload: {},
                  synced: false,
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                if (cacheStr) {
                  const cache = JSON.parse(cacheStr);
                  const updatedCache = cache.filter((item: any) => !((item.id === recordId || item.id_local === recordId) && item.type === 'risk_matrix'));
                  await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                }

                Alert.alert('Modo Offline', 'Matriz de riesgos marcada para eliminación localmente. Se sincronizará cuando haya conexión.');
                fetchMatrices();
              }
            } catch (err) {
              console.error('Error deleting matrix:', err);
              Alert.alert('Error', 'No se pudo eliminar la matriz de riesgos');
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
      case 'matrix': return <Ionicons name="shield" size={24} color='#000000' />;
      case 'add': return <Ionicons name="add" size={24} color='#FFFFFF' />;
      case 'cancel': return <Ionicons name="close" size={24} color='#FFFFFF' />;
      case 'confirm': return <Ionicons name="checkmark" size={24} color='#FFFFFF' />;
      case 'delete': return <Ionicons name="trash" size={24} color='#FFFFFF' />;
      case 'edit': return <Ionicons name="pencil" size={20} color="#FFFFFF" />;
      default: return <Ionicons name="shield" size={24} color='#000000' />;
    }
  };

  const renderMatrixList = () => {
    if (isLoading) {
      return (
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Cargando matrices de riesgos...</ThemedText>
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

    if (matrices.length === 0) {
      return (
        <ThemedView style={styles.emptyContainer}>
          <ThemedText style={styles.emptyText}>No hay matrices de riesgos registradas.</ThemedText>
        </ThemedView>
      );
    }

    return (
      <ThemedView style={styles.listContainer}>
        {matrices.map((record) => {
          let riesgosArray: Riesgo[] = [];
          if (record.riesgos) {
            try {
              riesgosArray = JSON.parse(record.riesgos);
            } catch (e) {
              riesgosArray = [];
            }
          }

          return (
            <ThemedView key={record.id || record.id_local} style={styles.listItem}>
              <ThemedView style={styles.listItemHeader}>
                <ThemedView style={styles.listItemContent}>
                  <ThemedText style={styles.listItemTitle}>
                    Matriz de Riesgos
                  </ThemedText>
                  <ThemedText style={styles.listItemSubtitle}>
                    Riesgos: {riesgosArray.length} | Fecha: {new Date(record.created_at).toLocaleDateString('es-CR')}
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
                    onPress={() => deleteMatrixHandler(record)}
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

  const renderRiesgo = (riesgo: Riesgo, index: number) => {
    const isExpanded = expandedRiesgoIndices.includes(index);
    const nivelRiesgoColor = getNivelRiesgoColor(riesgo.nivel_riesgo);
    const nivelRiesgoTexto = getNivelRiesgoTexto(riesgo.nivel_riesgo);

    return (
      <ThemedView key={index} style={styles.riesgoItem}>
        <TouchableOpacity
          style={styles.riesgoHeader}
          onPress={() => toggleRiesgoExpansion(index)}
        >
          <ThemedView style={styles.riesgoHeaderContent}>
            <ThemedText style={styles.riesgoHeaderText}>
              Riesgo {index + 1}: {riesgo.riesgo || 'Sin nombre'}
            </ThemedText>
            <ThemedView style={[styles.nivelRiesgoBadge, { backgroundColor: nivelRiesgoColor }]}>
              <ThemedText style={styles.nivelRiesgoBadgeText}>
                {riesgo.nivel_riesgo > 0 ? `${riesgo.nivel_riesgo} - ${nivelRiesgoTexto}` : 'Sin definir'}
              </ThemedText>
            </ThemedView>
          </ThemedView>
          <ThemedView style={styles.riesgoHeaderActions}>
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                removeRiesgo(index);
              }}
              style={styles.removeRiesgoButton}
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
          <ThemedView style={styles.riesgoContent}>
            {/* Sección: Identificación y valoración */}
            <ThemedView style={styles.seccionIdentificacion}>
              <ThemedText style={styles.seccionTitle}>Identificación y valoración</ThemedText>

              {/* Proceso */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Proceso</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Proceso"
                  placeholderTextColor="#999"
                  value={riesgo.proceso}
                  onChangeText={(text) => updateRiesgo(index, 'proceso', text)}
                />
              </ThemedView>

              {/* Riesgo */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Riesgo</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Riesgo"
                  placeholderTextColor="#999"
                  value={riesgo.riesgo}
                  onChangeText={(text) => updateRiesgo(index, 'riesgo', text)}
                />
              </ThemedView>

              {/* Causas */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Causas</ThemedText>
                <TextInput
                  style={[styles.formInput, styles.textArea]}
                  placeholder="Causas"
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  value={riesgo.causas}
                  onChangeText={(text) => updateRiesgo(index, 'causas', text)}
                />
              </ThemedView>

              {/* Probabilidad */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Probabilidad</ThemedText>
                <ThemedView style={styles.pickerContainer}>
                  <Picker
                    selectedValue={riesgo.probabilidad}
                    onValueChange={(value) => updateRiesgo(index, 'probabilidad', value)}
                    style={styles.picker}
                  >
                    {PROBABILIDAD_OPTIONS.map((option) => (
                      <Picker.Item
                        key={option.value}
                        label={option.label}
                        value={option.value}
                      />
                    ))}
                  </Picker>
                </ThemedView>
              </ThemedView>

              {/* Valor Probabilidad */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Valor Probabilidad</ThemedText>
                <TextInput
                  style={[styles.formInput, styles.readOnlyInput]}
                  value={riesgo.valor_probabilidad.toString()}
                  editable={false}
                />
              </ThemedView>

              {/* Impacto */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Impacto</ThemedText>
                <ThemedView style={styles.pickerContainer}>
                  <Picker
                    selectedValue={riesgo.impacto}
                    onValueChange={(value) => updateRiesgo(index, 'impacto', value)}
                    style={styles.picker}
                  >
                    {IMPACTO_OPTIONS.map((option) => (
                      <Picker.Item
                        key={option.value}
                        label={option.label}
                        value={option.value}
                      />
                    ))}
                  </Picker>
                </ThemedView>
              </ThemedView>

              {/* Valor Impacto */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Valor Impacto</ThemedText>
                <TextInput
                  style={[styles.formInput, styles.readOnlyInput]}
                  value={riesgo.valor_impacto.toString()}
                  editable={false}
                />
              </ThemedView>

              {/* Nivel de Riesgo */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Nivel de Riesgo</ThemedText>
                <ThemedView style={[styles.nivelRiesgoContainer, { backgroundColor: nivelRiesgoColor }]}>
                  <ThemedText style={styles.nivelRiesgoText}>
                    {riesgo.nivel_riesgo > 0 ? `${riesgo.nivel_riesgo} - ${nivelRiesgoTexto}` : 'Sin definir'}
                  </ThemedText>
                </ThemedView>
              </ThemedView>

              {/* Acciones del riesgo */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Acciones del riesgo</ThemedText>
                <ThemedView style={styles.pickerContainer}>
                  <Picker
                    selectedValue={riesgo.acciones_riesgo}
                    onValueChange={(value) => updateRiesgo(index, 'acciones_riesgo', value)}
                    style={styles.picker}
                  >
                    {ACCIONES_RIESGO_OPTIONS.map((option) => (
                      <Picker.Item
                        key={option.value}
                        label={option.label}
                        value={option.value}
                      />
                    ))}
                  </Picker>
                </ThemedView>
              </ThemedView>
            </ThemedView>

            {/* Sección: Acciones para abordar riesgos */}
            <ThemedView style={styles.seccionAcciones}>
              <ThemedText style={styles.seccionTitle}>Acciones para abordar riesgos</ThemedText>

              {/* Controles actuales */}
              <ThemedView style={styles.subseccion}>
                <ThemedText style={styles.subseccionTitle}>Controles actuales</ThemedText>

                {(riesgo.controles_actuales || []).map((control, controlIndex) => {
                  const isControlExpanded = (expandedControlIndices[index] || []).includes(controlIndex);
                  return (
                    <ThemedView key={controlIndex} style={styles.controlItem}>
                      <TouchableOpacity
                        style={styles.controlHeader}
                        onPress={() => toggleControlExpansion(index, controlIndex)}
                      >
                        <ThemedText style={styles.controlHeaderText}>
                          Control {controlIndex + 1}
                        </ThemedText>
                        <ThemedView style={styles.controlHeaderActions}>
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation();
                              removeControlActual(index, controlIndex);
                            }}
                            style={styles.removeControlButton}
                          >
                            <Ionicons name="trash" size={18} color="#FF3B30" />
                          </TouchableOpacity>
                          <Ionicons
                            name={isControlExpanded ? 'chevron-up' : 'chevron-down'}
                            size={20}
                            color="#000000"
                          />
                        </ThemedView>
                      </TouchableOpacity>

                      {isControlExpanded && (
                        <ThemedView style={styles.controlContent}>
                          <ThemedView style={styles.formGroup}>
                            <ThemedText style={styles.formLabel}>Control</ThemedText>
                            <TextInput
                              style={[styles.formInput, styles.textArea]}
                              placeholder="Ingrese el control"
                              placeholderTextColor="#999"
                              multiline
                              numberOfLines={3}
                              textAlignVertical="top"
                              value={control.control}
                              onChangeText={(text) => updateControlActual(index, controlIndex, text)}
                            />
                          </ThemedView>
                        </ThemedView>
                      )}
                    </ThemedView>
                  );
                })}

                <TouchableOpacity
                  style={styles.addControlButton}
                  onPress={() => addControlActual(index)}
                >
                  <Ionicons name="add-circle" size={20} color="#1976D2" />
                  <ThemedText style={styles.addControlButtonText}>Agregar Control</ThemedText>
                </TouchableOpacity>
              </ThemedView>

              {/* Controles adicionales */}
              <ThemedView style={styles.subseccion}>
                <ThemedText style={styles.subseccionTitle}>Controles adicionales a los actuales</ThemedText>

                {(riesgo.controles_adicionales || []).map((controlAdicional, controlAdicionalIndex) => {
                  const isControlAdicionalExpanded = (expandedControlAdicionalIndices[index] || []).includes(controlAdicionalIndex);
                  return (
                    <ThemedView key={controlAdicionalIndex} style={styles.controlItem}>
                      <TouchableOpacity
                        style={styles.controlHeader}
                        onPress={() => toggleControlAdicionalExpansion(index, controlAdicionalIndex)}
                      >
                        <ThemedText style={styles.controlHeaderText}>
                          Control Adicional {controlAdicionalIndex + 1}
                        </ThemedText>
                        <ThemedView style={styles.controlHeaderActions}>
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation();
                              removeControlAdicional(index, controlAdicionalIndex);
                            }}
                            style={styles.removeControlButton}
                          >
                            <Ionicons name="trash" size={18} color="#FF3B30" />
                          </TouchableOpacity>
                          <Ionicons
                            name={isControlAdicionalExpanded ? 'chevron-up' : 'chevron-down'}
                            size={20}
                            color="#000000"
                          />
                        </ThemedView>
                      </TouchableOpacity>

                      {isControlAdicionalExpanded && (
                        <ThemedView style={styles.controlContent}>
                          {/* Control adicional sugerido */}
                          <ThemedView style={styles.formGroup}>
                            <ThemedText style={styles.formLabel}>Control adicional sugerido</ThemedText>
                            <TextInput
                              style={[styles.formInput, styles.textArea]}
                              placeholder="Control adicional sugerido"
                              placeholderTextColor="#999"
                              multiline
                              numberOfLines={3}
                              textAlignVertical="top"
                              value={controlAdicional.control_adicional_sugerido}
                              onChangeText={(text) => updateControlAdicional(index, controlAdicionalIndex, 'control_adicional_sugerido', text)}
                            />
                          </ThemedView>

                          {/* Frecuencia */}
                          <ThemedView style={styles.formGroup}>
                            <ThemedText style={styles.formLabel}>Frecuencia</ThemedText>
                            <TextInput
                              style={styles.formInput}
                              placeholder="Frecuencia"
                              placeholderTextColor="#999"
                              value={controlAdicional.frecuencia}
                              onChangeText={(text) => updateControlAdicional(index, controlAdicionalIndex, 'frecuencia', text)}
                            />
                          </ThemedView>

                          {/* Responsable */}
                          <ThemedView style={styles.formGroup}>
                            <ThemedText style={styles.formLabel}>Responsable</ThemedText>
                            <TextInput
                              style={styles.formInput}
                              placeholder="Responsable"
                              placeholderTextColor="#999"
                              value={controlAdicional.responsable}
                              onChangeText={(text) => updateControlAdicional(index, controlAdicionalIndex, 'responsable', text)}
                            />
                          </ThemedView>

                          {/* Fecha de implementación */}
                          <ThemedView style={styles.formGroup}>
                            <ThemedText style={styles.formLabel}>Fecha de implementación</ThemedText>
                            <TouchableOpacity
                              style={styles.dateButton}
                              onPress={() => setShowDatePicker({ riesgoIndex: index, controlIndex: controlAdicionalIndex })}
                            >
                              <ThemedText style={styles.dateButtonText}>
                                {controlAdicional.fecha_implementacion || 'Seleccionar fecha'}
                              </ThemedText>
                              <Ionicons name="calendar" size={20} color="#007AFF" />
                            </TouchableOpacity>
                            {showDatePicker?.riesgoIndex === index && showDatePicker?.controlIndex === controlAdicionalIndex && (
                              <DateTimePicker
                                value={controlAdicional.fecha_implementacion ? (() => {
                                  try {
                                    const [day, month, year] = controlAdicional.fecha_implementacion.split('/');
                                    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                                  } catch {
                                    return new Date();
                                  }
                                })() : new Date()}
                                mode="date"
                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                onChange={(event, date) => handleDateChange(index, controlAdicionalIndex, event, date)}
                              />
                            )}
                          </ThemedView>

                          {/* Requerimientos (recursos) */}
                          <ThemedView style={styles.formGroup}>
                            <ThemedText style={styles.formLabel}>Requerimientos (recursos)</ThemedText>
                            <TextInput
                              style={[styles.formInput, styles.textArea]}
                              placeholder="Requerimientos (recursos)"
                              placeholderTextColor="#999"
                              multiline
                              numberOfLines={3}
                              textAlignVertical="top"
                              value={controlAdicional.requerimientos_recursos}
                              onChangeText={(text) => updateControlAdicional(index, controlAdicionalIndex, 'requerimientos_recursos', text)}
                            />
                          </ThemedView>

                          {/* Evidencia */}
                          <ThemedView style={styles.formGroup}>
                            <ThemedText style={styles.formLabel}>Evidencia</ThemedText>
                            <TextInput
                              style={[styles.formInput, styles.textArea]}
                              placeholder="Evidencia"
                              placeholderTextColor="#999"
                              multiline
                              numberOfLines={3}
                              textAlignVertical="top"
                              value={controlAdicional.evidencia}
                              onChangeText={(text) => updateControlAdicional(index, controlAdicionalIndex, 'evidencia', text)}
                            />
                          </ThemedView>

                          {/* Eficaz? */}
                          <ThemedView style={styles.formGroup}>
                            <ThemedText style={styles.formLabel}>Eficaz?</ThemedText>
                            <ThemedView style={styles.pickerContainer}>
                              <Picker
                                selectedValue={controlAdicional.eficaz}
                                onValueChange={(value) => updateControlAdicional(index, controlAdicionalIndex, 'eficaz', value)}
                                style={styles.picker}
                              >
                                {EFICAZ_OPTIONS.map((option) => (
                                  <Picker.Item
                                    key={option.value}
                                    label={option.label}
                                    value={option.value}
                                  />
                                ))}
                              </Picker>
                            </ThemedView>
                          </ThemedView>

                          {/* Comentario */}
                          <ThemedView style={styles.formGroup}>
                            <ThemedText style={styles.formLabel}>Comentario</ThemedText>
                            <TextInput
                              style={[styles.formInput, styles.textArea]}
                              placeholder="Comentario"
                              placeholderTextColor="#999"
                              multiline
                              numberOfLines={3}
                              textAlignVertical="top"
                              value={controlAdicional.comentario}
                              onChangeText={(text) => updateControlAdicional(index, controlAdicionalIndex, 'comentario', text)}
                            />
                          </ThemedView>
                        </ThemedView>
                      )}
                    </ThemedView>
                  );
                })}

                <TouchableOpacity
                  style={styles.addControlButton}
                  onPress={() => addControlAdicional(index)}
                >
                  <Ionicons name="add-circle" size={20} color="#1976D2" />
                  <ThemedText style={styles.addControlButtonText}>Agregar Control Adicional</ThemedText>
                </TouchableOpacity>
              </ThemedView>
            </ThemedView>
          </ThemedView>
        )}
      </ThemedView>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <AppHeader onMenuPress={handleMenuPress} title="Matriz de Riesgos" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <ThemedView style={styles.contentContainer}>
          <ThemedText type="title" style={styles.screenTitle}>
            {getActionIcon('matrix')} Matriz de Riesgos
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
              {riesgos.map((riesgo, index) => renderRiesgo(riesgo, index))}

              <TouchableOpacity
                style={styles.addRiesgoButton}
                onPress={addRiesgo}
              >
                <Ionicons name="add-circle" size={24} color="#4CAF50" />
                <ThemedText style={styles.addRiesgoButtonText}>Agregar Riesgo</ThemedText>
              </TouchableOpacity>

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
                  onPress={editingRecord ? updateMatrixHandler : saveMatrixHandler}
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
                <ThemedText style={styles.createButtonText}>Crear Nueva Matriz de Riesgos</ThemedText>
              </TouchableOpacity>
              {renderMatrixList()}
            </ThemedView>
          )}
        </ThemedView>
      </ScrollView>

      <AppFooter />
      <SlideMenu
        isVisible={isMenuVisible}
        onClose={handleMenuClose}
        onHomePress={handleHomePress}
        currentRoute="RiskMatrix"
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
  readOnlyInput: {
    backgroundColor: '#E0E0E0',
    color: '#666',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    color: '#000000',
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
  riesgoItem: {
    marginBottom: 15,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  riesgoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#F5F5F5',
  },
  riesgoHeaderContent: {
    flex: 1,
    marginRight: 10,
  },
  riesgoHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  nivelRiesgoBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  nivelRiesgoBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  riesgoHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  removeRiesgoButton: {
    padding: 4,
  },
  riesgoContent: {
    padding: 15,
  },
  seccionIdentificacion: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#D32F2F',
  },
  seccionAcciones: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#1976D2',
  },
  seccionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 15,
  },
  subseccion: {
    marginTop: 15,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  subseccionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 15,
  },
  nivelRiesgoContainer: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nivelRiesgoText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  addRiesgoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    marginTop: 10,
    marginBottom: 20,
    gap: 8,
  },
  addRiesgoButtonText: {
    color: '#4CAF50',
    fontSize: 14,
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
  addControlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#E3F2FD',
    borderRadius: 6,
    marginTop: 10,
    gap: 6,
  },
  addControlButtonText: {
    color: '#1976D2',
    fontSize: 12,
    fontWeight: '600',
  },
  controlItem: {
    marginBottom: 10,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  controlHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FAFAFA',
  },
  controlHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  controlHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  removeControlButton: {
    padding: 4,
  },
  controlContent: {
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
});

