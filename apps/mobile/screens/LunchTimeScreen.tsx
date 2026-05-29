import AppHeader from '../components/AppHeader';
import AppFooter from '../components/AppFooter';
import SlideMenu from '../components/SlideMenu';
import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import { useAuth } from '../contexts/AuthContext';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ActivityIndicator, Alert, StyleSheet, TouchableOpacity, View, ScrollView, AppState, TextInput, Modal, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import saveLunchTime from '../hooks/saveLunchTime';
import { toZonedTime } from 'date-fns-tz';
import * as Network from 'expo-network';
import getHoraAccion from '../hooks/getHoraAccion';
import getCurrentUserDigitalSignature from '../hooks/getCurrentUserDigitalSignature';
import { eventBus } from '@/hooks/eventBus';

type LunchTimeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'LunchTime'>;

interface LunchTimeConfig {
  status: boolean;
  minutos: number;
  marcaDiaId: string;
}

function isValidLunchMinutes(minutos: unknown): boolean {
  const n = Number(minutos);
  return Number.isFinite(n) && n > 0;
}

interface InactivityData {
  startTime: Date;
  endTime: Date;
  reason: string;
}

interface ManualInactivityData {
  startHour: string;
  startMinute: string;
  endHour: string;
  endMinute: string;
  reason: string;
}

export default function LunchTimeScreen() {
  const { isAuthenticated, isLoading, employee, refreshAccessToken, logout } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [endTimeMode, setEndTimeMode] = useState('current');
  const [appState, setAppState] = useState(AppState.currentState);
  const [timerConfig, setTimerConfig] = useState<LunchTimeConfig | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsManualMinutes, setNeedsManualMinutes] = useState(false);
  const [manualMinutesInput, setManualMinutesInput] = useState('');
  const [inactivityReason, setInactivityReason] = useState('');
  const [inactivities, setInactivities] = useState<InactivityData[]>([]);
  const [currentInactivityStart, setCurrentInactivityStart] = useState<Date | null>(null);
  const [isManualModalVisible, setIsManualModalVisible] = useState(false);
  const [manualStartHour, setManualStartHour] = useState('');
  const [manualStartMinute, setManualStartMinute] = useState('');
  const [manualInactivities, setManualInactivities] = useState<ManualInactivityData[]>([]);
  // Time picker state for manual start
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [startTimePickerValue, setStartTimePickerValue] = useState(new Date());
  // Time picker state for pauses (one at a time)
  const [activeInactivityPicker, setActiveInactivityPicker] = useState<null | { index: number; type: 'start' | 'end' }>(null);
  const [inactivityPickerValue, setInactivityPickerValue] = useState(new Date());
  const [firmaEmpleado, setFirmaEmpleado] = useState('');
  const [isGeneratingFirmaEmpleado, setIsGeneratingFirmaEmpleado] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navigation = useNavigation<LunchTimeScreenNavigationProp>();

  // Mantén referencias actualizadas de los valores que cambian
  const timerActiveRef = useRef(isTimerActive);
  const timeRemainingRef = useRef(timeRemaining);
  const startTimeRef = useRef(startTime);
  const endTimeRef = useRef(endTime);
  const endTimeModeRef = useRef(endTimeMode);
  const inactivitiesRef = useRef(inactivities);
  const currentInactivityStartRef = useRef(currentInactivityStart);
  const firmaEmpleadoRef = useRef(firmaEmpleado);

  useFocusEffect(
    useCallback(() => {
      return () => {
        saveCurrentState();
      };
    }, [])
  );

  // Cuando cambian, actualiza las referencias
  useEffect(() => {
    timerActiveRef.current = isTimerActive;
  }, [isTimerActive]);

  useEffect(() => {
    timeRemainingRef.current = timeRemaining;
  }, [timeRemaining]);

  useEffect(() => {
    startTimeRef.current = startTime;
  }, [startTime]);

  useEffect(() => {
    endTimeRef.current = endTime;
  }, [endTime]);

  useEffect(() => {
    endTimeModeRef.current = endTimeMode;
  }, [endTimeMode]);

  useEffect(() => {
    inactivitiesRef.current = inactivities;
  }, [inactivities]);

  useEffect(() => {
    currentInactivityStartRef.current = currentInactivityStart;
  }, [currentInactivityStart]);

  useEffect(() => {
    firmaEmpleadoRef.current = firmaEmpleado;
  }, [firmaEmpleado]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigation.replace('Home');
    }
  }, [isAuthenticated, isLoading, navigation]);

  // Fetch timer configuration on component mount
  useEffect(() => {
    if (employee) {
      fetchTimerConfig();
    }
  }, [employee]);

  const getUpdatedHoraAccion = async () => {
    const horaAccion = await getHoraAccion();
    return horaAccion;
  }

  // Timer effect
  useEffect(() => {
    if (isTimerActive && timeRemaining > 0) {
      intervalRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            handleTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isTimerActive, timeRemaining]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async nextAppState => {
      setAppState(nextAppState);

      if (nextAppState === 'background') {
        await saveCurrentState();
      }

      if (nextAppState === 'active') {
        await restoreCurrentState()
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const saveCurrentState = async () => {
    // Segundos restantes del temporizador
    const remainingSeconds = timeRemainingRef.current * 1000; // En milisegundos
    const horaAccion = await getUpdatedHoraAccion();
    const current_state = {
      running: timerActiveRef.current,
      remainingSeconds: remainingSeconds, // En milisegundos
      currentTimestamp: horaAccion, // En milisegundos
      startTime: startTimeRef.current,
      inactivities: inactivitiesRef.current,
      currentInactivityStart: currentInactivityStartRef.current,
      firma_empleado: firmaEmpleadoRef.current,
    }

    await AsyncStorage.setItem('temp_state', JSON.stringify(current_state));

    setEndTimeMode('calculated');
    setEndTime(new Date(current_state.currentTimestamp + current_state.remainingSeconds));

    console.log('✅ Saved current state');
  }

  const restoreCurrentState = async () => {
    console.log('Restoring current state...');
    const temp_state = await AsyncStorage.getItem('temp_state');

    if (temp_state) {
      try {
        const temp_state_obj = JSON.parse(temp_state);

        // Restore inactivities
        if (temp_state_obj.inactivities) {
          setInactivities(temp_state_obj.inactivities.map((inactivity: any) => ({
            ...inactivity,
            startTime: new Date(inactivity.startTime),
            endTime: new Date(inactivity.endTime)
          })));
        }
        setFirmaEmpleado(temp_state_obj.firma_empleado || '');

        console.log('temp_state_obj', temp_state_obj);

        if (temp_state_obj.running) {
          setIsTimerActive(true);
          const horaAccion = await getUpdatedHoraAccion();
          const remaining_time = (temp_state_obj.remainingSeconds / 1000) - ((horaAccion - temp_state_obj.currentTimestamp) / 1000);
          setStartTime(temp_state_obj.startTime ? new Date(temp_state_obj.startTime) : null);
          setCurrentInactivityStart(temp_state_obj.currentInactivityStart ? new Date(temp_state_obj.currentInactivityStart) : null);
          if (remaining_time <= 0) {
            console.log('remaining_time <= 0 - Ejecutando handleTimerComplete');
            setIsTimerActive(false);
            setTimeRemaining(0);
            // Ejecutar la lógica de guardado cuando el tiempo se agotó mientras la app estaba minimizada
            await handleTimerComplete();
          } else {
            setEndTimeMode('current');
            setTimeRemaining(parseInt(remaining_time.toFixed(0)));
          }
        }
        else {
          setIsTimerActive(false);
          setTimeRemaining(parseInt((temp_state_obj.remainingSeconds / 1000).toFixed(0)));
          setStartTime(temp_state_obj.startTime ? new Date(temp_state_obj.startTime) : null);
          setEndTimeMode('current');
          setEndTime(null);
          setCurrentInactivityStart(temp_state_obj.currentInactivityStart ? new Date(temp_state_obj.currentInactivityStart) : null);
        }
      } catch (error) {
        console.error('Error parsing temp_state:', error);
      }
      await AsyncStorage.removeItem('temp_state');
    }
    console.log('✅ Restored current state');
  }

  const handleTimerComplete = async () => {
    setIsTimerActive(false);
    console.log('endTimeMode', endTimeModeRef.current);
    await AsyncStorage.setItem('alert_lunch_time', 'false');
    let endTimeUse = null;
    if (endTimeModeRef.current == 'current') {
      const horaAccion = await getUpdatedHoraAccion();
      endTimeUse = horaAccion;
    }
    else {
      endTimeUse = endTimeRef.current;
    }

    const requestData = {
      empleadoId: employee?.id,
      inicio: startTimeRef.current,
      fin: endTimeUse,
      pausas: JSON.stringify(inactivitiesRef.current),
      es_manual: false,
      firma_empleado: firmaEmpleadoRef.current || '',
    };

    console.log('requestData', requestData);

    await sendLunchTimeRecord(requestData);
  }

  const getConnectionStatus = async (): Promise<boolean> => {
    const networkState = await Network.getNetworkStateAsync();

    return (
      networkState.isConnected === true &&
      networkState.isInternetReachable === true
    );
  };

  const stopAllTimers = async () => {
    setIsTimerActive(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setTimeRemaining(0);
    setStartTime(null);
    setEndTime(null);
    setInactivities([]);
    setCurrentInactivityStart(null);
    setInactivityReason('');
    setFirmaEmpleado('');
    setEndTimeMode('current');
    try {
      await AsyncStorage.removeItem('temp_state');
    } catch {
      // ignore
    }
  };

  const applyTimerConfig = async (
    minutos: number,
    marcaDiaId: string,
    configObj: Record<string, unknown>
  ) => {
    const updatedConfigObj = {
      ...configObj,
      minutos,
      status: true,
    };
    await AsyncStorage.setItem('lunch_time_config', JSON.stringify(updatedConfigObj));

    const config: LunchTimeConfig = {
      minutos,
      status: true,
      marcaDiaId,
    };
    setTimerConfig(config);
    setTimeRemaining(minutos * 60);
    setNeedsManualMinutes(false);
    setManualMinutesInput('');
  };

  const handleAcceptManualMinutes = async () => {
    const parsed = parseInt(manualMinutesInput.trim(), 10);
    if (!isValidLunchMinutes(parsed)) {
      Alert.alert('Error', 'Ingrese una cantidad válida de minutos (mayor a 0).');
      return;
    }

    Alert.alert(
      'Confirmar minutos de almuerzo',
      `¿Desea establecer ${parsed} minutos de almuerzo?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const current_marca = await AsyncStorage.getItem('current_marca');
              if (!current_marca) {
                Alert.alert('Error', 'No se encontró la marca actual.');
                return;
              }
              const current_marca_obj = JSON.parse(current_marca);
              if (!current_marca_obj.id) {
                Alert.alert('Error', 'No se encontró el identificador de la marca actual.');
                return;
              }

              const stored = await AsyncStorage.getItem('lunch_time_config');
              let configObj: Record<string, unknown> = { status: true };
              if (stored) {
                try {
                  configObj = JSON.parse(stored);
                } catch {
                  configObj = { status: true };
                }
              }

              await applyTimerConfig(parsed, String(current_marca_obj.id), configObj);
            } catch (err) {
              console.error('Error saving manual lunch minutes:', err);
              Alert.alert('Error', 'No se pudo guardar la configuración de minutos.');
            }
          },
        },
      ]
    );
  };

  const generateRandomId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 10; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const sendLunchTimeRecord = async (requestData: any) => {
    // Verificar conectividad
    const isConnected = await getConnectionStatus();

    if (isConnected) {
      // Con internet: llamar a la función API
      const responseData = await saveLunchTime({
        requestData,
        employeeId: employee?.id,
        refreshAccessToken,
        logout
      });

      if (!responseData.status) {
        Alert.alert('Error', responseData.message);
        return;
      }

      const msg = requestData.es_manual ? 'Registro de tiempo de almuerzo guardado correctamente' : 'Tu descanso ha terminado. ¡Es hora de volver al trabajo!';

      Alert.alert(
        '🎉 ¡Tiempo de Almuerzo Completado!',
        msg,
        [
          {
            text: 'OK',
            onPress: async () => {
              // Reset timer after alert is dismissed
              if (timerConfig) {
                handleReset();
              }
            },
          },
        ]
      );
    } else {
      // Sin internet: modo offline
      const localId = generateRandomId();

      // Crear entrada en lunchtime_actions
      const actionsStr = await AsyncStorage.getItem('lunchtime_actions');
      const actions = actionsStr ? JSON.parse(actionsStr) : [];
      actions.push({
        requestData: requestData,
        id: localId,
        type: 'create',
      });
      await AsyncStorage.setItem('lunchtime_actions', JSON.stringify(actions));

      const msg = requestData.es_manual ? 'Registro de tiempo de almuerzo guardado localmente. Se sincronizará cuando haya conexión.' : 'Tu descanso ha terminado. El registro se sincronizará cuando haya conexión.';

      Alert.alert(
        'Modo Offline',
        msg,
        [
          {
            text: 'OK',
            onPress: async () => {
              // Reset timer after alert is dismissed
              if (timerConfig) {
                handleReset();
              }
            },
          },
        ]
      );
    }
  }

  const fetchTimerConfig = async () => {

    if (!employee) return;

    setIsLoadingConfig(true);
    setError(null);

    try {
      const current_marca = await AsyncStorage.getItem('current_marca');
      if (!current_marca) {
        throw new Error('No current marca found');
      }

      const current_marca_obj = JSON.parse(current_marca);
      if (!current_marca_obj.id) {
        throw new Error('No current marca id found');
      }

      let lunch_time_config_obj: Record<string, unknown> | null = null;
      const lunch_time_config = await AsyncStorage.getItem('lunch_time_config');
      if (lunch_time_config) {
        try {
          lunch_time_config_obj = JSON.parse(lunch_time_config);
        } catch {
          lunch_time_config_obj = null;
        }
      }

      const hasAnyConfig =
        lunch_time_config_obj != null && typeof lunch_time_config_obj === 'object';

      if (!hasAnyConfig || !lunch_time_config_obj) {
        await stopAllTimers();
        setTimerConfig(null);
        setNeedsManualMinutes(true);
        return;
      }

      const resolvedConfig = lunch_time_config_obj;

      if (!isValidLunchMinutes(resolvedConfig.minutos)) {
        await stopAllTimers();
        setTimerConfig(null);
        setNeedsManualMinutes(true);
        return;
      }

      const config: LunchTimeConfig = {
        minutos: Number(resolvedConfig.minutos),
        status: resolvedConfig.status !== false,
        marcaDiaId: String(current_marca_obj.id),
      };

      setTimerConfig(config);
      setTimeRemaining(config.minutos * 60);
      setNeedsManualMinutes(false);

      await restoreCurrentState();
    } catch (error) {
      console.error('Error fetching timer config:', error);
      setError('Error al cargar la configuración del temporizador');
    } finally {
      setIsLoadingConfig(false);
    }
  };

  const handleStart = async () => {
    if (timerConfig && timeRemaining > 0) {
      // Firma + ubicación solo al iniciar el contador por primera vez en esta sesión
      // (no al reanudar tras pausa ni al restaurar estado guardado).
      const isFirstStartOfSession =
        !firmaEmpleadoRef.current?.trim() && startTimeRef.current == null;

      if (isFirstStartOfSession) {
        if (isGeneratingFirmaEmpleado) return;
        setIsGeneratingFirmaEmpleado(true);
        try {
          const generatedFirma = await getCurrentUserDigitalSignature(employee);
          if (!generatedFirma) {
            return;
          }
          setFirmaEmpleado(generatedFirma);
        } finally {
          setIsGeneratingFirmaEmpleado(false);
        }
      }
      const horaAccion = await getUpdatedHoraAccion();
      if (startTimeRef.current == null) {
        setStartTime(new Date(horaAccion));
      }
      setIsTimerActive(true);
      setEndTimeMode('current');
      setEndTime(null);

      // Si había una inactividad en curso, guardarla
      if (currentInactivityStart) {
        const newInactivity: InactivityData = {
          startTime: currentInactivityStart,
          endTime: new Date(horaAccion),
          reason: inactivityReason.trim() || 'Sin razón determinada'
        };
        setInactivities(prev => [...prev, newInactivity]);
        setCurrentInactivityStart(null);
        setInactivityReason('');
      }
    }
  };

  const handleStop = async () => {
    setIsTimerActive(false);
    // Iniciar tracking de inactividad
    const horaAccion = await getUpdatedHoraAccion();
    setCurrentInactivityStart(new Date(horaAccion));
  };

  const handleReset = async () => {
    setIsTimerActive(false);
    setStartTime(null);
    setEndTime(null);
    setInactivities([]);
    setCurrentInactivityStart(null);
    setInactivityReason('');
    setFirmaEmpleado('');
    if (timerConfig) {
      setTimeRemaining(timerConfig.minutos * 60);
    }

    await AsyncStorage.removeItem('temp_state');
    setEndTimeMode('current');
    setEndTime(null);
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
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

  const handleBack = () => {
    navigation.goBack();
  };


  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'confirm': return <Ionicons name="checkmark" size={35} color='#FFFFFF' />;
      case 'lunch-time': return <Ionicons name="hourglass" size={25} color='#000000' />;
      case 'start': return <Ionicons name="caret-forward" size={35} color='#FFFFFF' />;
      case 'start-internal': return <Ionicons name="caret-forward" size={25} color='#000000' />;
      case 'stop': return <Ionicons name="pause" size={35} color='#FFFFFF' />;
      case 'stop-internal': return <Ionicons name="pause" size={25} color='#000000' />;
      case 'reset': return <Ionicons name="refresh" size={35} color='#FFFFFF' />;
      case 'manual': return <Ionicons name="create-outline" size={20} color='#000000' />;
      case 'add': return <Ionicons name="add" size={20} color='#000000' />;
      case 'remove': return <Ionicons name="trash" size={20} color='#FF3B30' />;
      default: return <Ionicons name="close" size={35} color='#FFFFFF' />;
    }
  };

  const renderInactivityTime = (inactivity: InactivityData) => {
    const initial_time = inactivity.startTime.toISOString().split('T')[1].split('.')[0];
    const final_time = inactivity.endTime.toISOString().split('T')[1].split('.')[0];
    return `${initial_time} - ${final_time}`;
  };

  const validateTimeConflicts = (startTime: Date, inactivities: InactivityData[], availableMinutes: number): string[] => {
    const errors: string[] = [];

    // Validar que las inactividades no empiecen antes del tiempo de inicio
    inactivities.forEach((inactivity, index) => {
      if (inactivity.startTime < startTime) {
        errors.push(`La pausa #${index + 1} no puede empezar antes del tiempo de inicio del almuerzo`);
      }

      // Validar que la hora de inicio no sea mayor a la hora de fin
      if (inactivity.startTime >= inactivity.endTime) {
        errors.push(`La pausa #${index + 1} no puede tener una hora de inicio mayor o igual a la hora de fin`);
      }
    });

    // Validar conflictos entre inactividades
    for (let i = 0; i < inactivities.length; i++) {
      for (let j = i + 1; j < inactivities.length; j++) {
        const inactivity1 = inactivities[i];
        const inactivity2 = inactivities[j];

        // Verificar si hay solapamiento
        if ((inactivity1.startTime < inactivity2.endTime && inactivity1.endTime > inactivity2.startTime)) {
          errors.push(`Las pausas #${i + 1} y #${j + 1} tienen horarios que se solapan`);
        }
      }
    }

    // Validar que el tiempo efectivo de almuerzo no exceda los minutos disponibles
    if (inactivities.length > 0) {
      // Ordenar las pausas por hora de inicio
      const sortedInactivities = [...inactivities].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

      // Calcular el tiempo entre el inicio del almuerzo y la primera pausa
      const timeToFirstPause = (sortedInactivities[0].startTime.getTime() - startTime.getTime()) / (1000 * 60);

      // Calcular el tiempo entre pausas consecutivas (de fin de una pausa al inicio de la siguiente)
      let timeBetweenPauses = 0;
      for (let i = 0; i < sortedInactivities.length - 1; i++) {
        const timeBetween = (sortedInactivities[i + 1].startTime.getTime() - sortedInactivities[i].endTime.getTime()) / (1000 * 60);
        timeBetweenPauses += timeBetween;
      }

      // Calcular el tiempo total efectivo de almuerzo (sin contar las pausas)
      const totalEffectiveLunchTime = timeToFirstPause + timeBetweenPauses;

      // Verificar que el tiempo efectivo no exceda los minutos disponibles
      if (totalEffectiveLunchTime > availableMinutes) {
        errors.push(`El tiempo efectivo de almuerzo (${totalEffectiveLunchTime.toFixed(1)} minutos) excede los ${availableMinutes} minutos disponibles`);
      }

      // Verificar que el tiempo entre el inicio y la primera pausa no sea negativo
      if (timeToFirstPause < 0) {
        errors.push(`La primera pausa no puede empezar antes del tiempo de inicio del almuerzo`);
      }
    }

    return errors;
  };

  const calculateEndTime = (startTime: Date, inactivities: InactivityData[]): Date => {
    const totalInactivityMinutes = inactivities.reduce((total, inactivity) => {
      const diffMs = inactivity.endTime.getTime() - inactivity.startTime.getTime();
      return total + (diffMs / (1000 * 60)); // Convertir a minutos
    }, 0);

    // Agregar 30 minutos de almuerzo + tiempo de inactividades
    const lunchMinutes = timerConfig?.minutos || 30;
    const totalMinutes = lunchMinutes + totalInactivityMinutes;

    return new Date(startTime.getTime() + (totalMinutes * 60 * 1000));
  };

  const handleManualLunchTime = () => {
    setIsManualModalVisible(true);
    setManualStartHour('');
    setManualStartMinute('');
    setManualInactivities([]);
    setShowStartTimePicker(false);
    setActiveInactivityPicker(null);
  };

  const handleStartTimePickerChange = (event: any, selectedTime?: Date) => {
    if (Platform.OS === 'android') {
      setShowStartTimePicker(false);
    }
    if (selectedTime) {
      setStartTimePickerValue(selectedTime);
      const hours = selectedTime.getHours().toString().padStart(2, '0');
      const minutes = selectedTime.getMinutes().toString().padStart(2, '0');
      setManualStartHour(hours);
      setManualStartMinute(minutes);
    }
  };

  const openStartTimePicker = async () => {
    const horaAccion = await getHoraAccion();
    if (!horaAccion) {
      Alert.alert('Error', 'No se pudo obtener la hora');
      return;
    }
    const baseDate = new Date(horaAccion);
    if (manualStartHour && manualStartMinute) {
      baseDate.setHours(parseInt(manualStartHour, 10), parseInt(manualStartMinute, 10), 0, 0);
    }
    setStartTimePickerValue(baseDate);
    setShowStartTimePicker(true);
  };

  const openInactivityPicker = async (index: number, type: 'start' | 'end') => {
    const horaAccion = await getHoraAccion();
    if (!horaAccion) {
      Alert.alert('Error', 'No se pudo obtener la hora');
      return;
    }
    const baseDate = new Date(horaAccion);
    const inactivity = manualInactivities[index];

    if (type === 'start') {
      if (inactivity.startHour && inactivity.startMinute) {
        baseDate.setHours(parseInt(inactivity.startHour, 10), parseInt(inactivity.startMinute, 10), 0, 0);
      }
    } else {
      if (inactivity.endHour && inactivity.endMinute) {
        baseDate.setHours(parseInt(inactivity.endHour, 10), parseInt(inactivity.endMinute, 10), 0, 0);
      }
    }

    setInactivityPickerValue(baseDate);
    setActiveInactivityPicker({ index, type });
  };

  const handleInactivityTimePickerChange = (event: any, selectedTime?: Date) => {
    if (Platform.OS === 'android') {
      setActiveInactivityPicker(null);
    }
    if (!selectedTime || !activeInactivityPicker) {
      return;
    }

    setInactivityPickerValue(selectedTime);
    const hours = selectedTime.getHours().toString().padStart(2, '0');
    const minutes = selectedTime.getMinutes().toString().padStart(2, '0');

    if (activeInactivityPicker.type === 'start') {
      handleManualInactivityChange(activeInactivityPicker.index, 'startHour', hours);
      handleManualInactivityChange(activeInactivityPicker.index, 'startMinute', minutes);
    } else {
      handleManualInactivityChange(activeInactivityPicker.index, 'endHour', hours);
      handleManualInactivityChange(activeInactivityPicker.index, 'endMinute', minutes);
    }
  };

  const handleAddManualInactivity = () => {
    const newInactivity: ManualInactivityData = {
      startHour: '',
      startMinute: '',
      endHour: '',
      endMinute: '',
      reason: ''
    };
    setManualInactivities(prev => [...prev, newInactivity]);
  };

  const handleRemoveManualInactivity = (index: number) => {
    setManualInactivities(prev => prev.filter((_, i) => i !== index));
  };

  const validateNumberInput = (value: string, max: number): string => {
    // Solo permitir números
    const numericValue = value.replace(/[^0-9]/g, '');

    // Limitar a 2 dígitos
    const limitedValue = numericValue.slice(0, 2);

    // Verificar que no exceda el máximo
    const numValue = parseInt(limitedValue, 10);
    if (!isNaN(numValue) && numValue > max) {
      return max.toString();
    }

    return limitedValue;
  };

  const handleManualInactivityChange = (index: number, field: keyof ManualInactivityData, value: string) => {
    setManualInactivities(prev => prev.map((inactivity, i) => {
      if (i === index) {
        if (field === 'startHour' || field === 'endHour') {
          return { ...inactivity, [field]: validateNumberInput(value, 23) };
        } else if (field === 'startMinute' || field === 'endMinute') {
          return { ...inactivity, [field]: validateNumberInput(value, 59) };
        }
        return { ...inactivity, [field]: value };
      }
      return inactivity;
    }));
  };

  const handleManualSubmit = async () => {
    // Validar hora de inicio
    if (!manualStartHour || !manualStartMinute) {
      Alert.alert('Error', 'Por favor ingresa la hora de inicio del almuerzo');
      return;
    }

    if (!timerConfig) {
      Alert.alert('Error', 'No se pudo obtener la configuración del temporizador');
      return;
    }

    const errors: string[] = [];

    const current_marca = await AsyncStorage.getItem('current_marca');
    if (!current_marca) {
      Alert.alert('Error', 'No se pudo obtener la marca actual');
      return;
    }
    const current_marca_parsed = JSON.parse(current_marca);
    if (!current_marca_parsed) {
      Alert.alert('Error', 'No se pudo obtener la marca actual');
      return;
    }

    // Validar que las pausas tengan todos los campos llenos
    manualInactivities.forEach((inactivity, index) => {
      if (!inactivity.startHour || !inactivity.startMinute || !inactivity.endHour || !inactivity.endMinute) {
        errors.push(`La pausa #${index + 1} tiene campos vacíos`);
      }
    });

    if (errors.length > 0) {
      Alert.alert('Error de validación', errors.join('\n'));
      return;
    }

    const dateArray = current_marca_parsed.fecha.split('T')[0].split('-');
    const year = dateArray[0];
    const month = dateArray[1];
    const day = dateArray[2];

    const init_time_array = current_marca_parsed.hora_inicio.split('T')[1].split(':');
    const marca_init_hours = init_time_array[0];
    const marca_init_minutes = init_time_array[1];

    const end_time_array = current_marca_parsed.hora_fin.split('T')[1].split(':');
    const marca_end_hours = end_time_array[0];
    const marca_end_minutes = end_time_array[1];

    let end_day = day;
    if (parseInt(marca_end_hours, 10) > parseInt(marca_init_hours, 10)) {
      end_day = (parseInt(day, 10) + 1).toString().padStart(2, '0');
    }

    const marca_end_time = new Date(`${year}-${month}-${end_day}T${marca_end_hours}:${marca_end_minutes}:00.000Z`);

    // Crear fecha de hoy con la hora especificada
    const startHours = manualStartHour;
    const startMinutes = manualStartMinute;

    let final_day = day;
    if (parseInt(marca_init_hours, 10) > parseInt(startHours, 10)) {
      final_day = (parseInt(day, 10) + 1).toString().padStart(2, '0');
    }

    const startTime = new Date(`${year}-${month}-${final_day}T${startHours}:${startMinutes}:00.000Z`);

    const initial_string = `${year}-${month}-${final_day} ${startHours}:${startMinutes}:00`;

    console.log('manualInactivities', manualInactivities);

    const inactivitiesWithToday: InactivityData[] = [];
    for (const inactivity of manualInactivities) {

      let startDay = final_day;
      if (parseInt(startHours, 10) > parseInt(inactivity.startHour, 10)) {
        startDay = (parseInt(final_day, 10) + 1).toString().padStart(2, '0');
      }

      let endDay = final_day;
      if (parseInt(startHours, 10) > parseInt(inactivity.endHour, 10)) {
        endDay = (parseInt(final_day, 10) + 1).toString().padStart(2, '0');
      }

      const activityStartTime = new Date(`${year}-${month}-${startDay}T${inactivity.startHour}:${inactivity.startMinute}:00.000Z`);
      const activityEndTime = new Date(`${year}-${month}-${endDay}T${inactivity.endHour}:${inactivity.endMinute}:00.000Z`);
      inactivitiesWithToday.push({
        startTime: activityStartTime,
        endTime: activityEndTime,
        reason: inactivity.reason || 'Sin razón determinada'
      });
    }

    const validationErrors = validateTimeConflicts(startTime, inactivitiesWithToday, timerConfig.minutos);

    const endTime = calculateEndTime(startTime, inactivitiesWithToday);
    const endTime_split = endTime.toISOString().split('T');
    const endTime_string = `${endTime_split[0]} ${endTime_split[1].split('.')[0]}`;

    if (endTime > marca_end_time) {
      validationErrors.push('El tiempo de fin del almuerzo no puede ser mayor a la hora de fin de la marca actual');
    }

    if (validationErrors.length > 0) {
      Alert.alert('Error de validación', validationErrors.join('\n'));
      return;
    }

    Alert.alert(
      'Confirmar Registro Manual',
      `¿Estás seguro de que deseas registrar este tiempo de almuerzo?\n\nInicio: ${initial_string}\nFin: ${endTime_string}\nPausas: ${inactivitiesWithToday.length}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            let firmaToUse = firmaEmpleadoRef.current || '';
            if (!firmaToUse) {
              const generatedFirma = await getCurrentUserDigitalSignature(employee);
              if (!generatedFirma) {
                return;
              }
              setFirmaEmpleado(generatedFirma);
              firmaToUse = generatedFirma;
            }
            const requestData = {
              empleadoId: employee?.id,
              inicio: startTime,
              fin: endTime,
              pausas: JSON.stringify(inactivitiesWithToday),
              es_manual: true,
              firma_empleado: firmaToUse
            };

            try {
              await sendLunchTimeRecord(requestData);
              setIsManualModalVisible(false);
            } catch (error) {
              Alert.alert('Error', 'No se pudo registrar el tiempo de almuerzo');
            }
          }
        }
      ]
    );
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
        <ThemedText style={styles.loadingText}>Cargando...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.fullContainer}>
      <AppHeader onMenuPress={handleMenuPress} title="Tiempo de Almuerzo" />

      <ScrollView style={styles.scrollView}>
        <ThemedView style={styles.container}>

          {/* Module Title */}
          <ThemedView style={styles.titleContainer}>
            <ThemedText type="title" style={styles.title}>
              {getActionIcon('lunch-time')} Tiempo de Almuerzo
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              Temporizador de descanso
            </ThemedText>
          </ThemedView>

          {/* Timer Section */}
          {isLoadingConfig ? (
            <ThemedView style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <ThemedText style={styles.loadingText}>
                Cargando configuración...
              </ThemedText>
            </ThemedView>
          ) : error ? (
            <ThemedView style={styles.errorContainer}>
              <ThemedText style={styles.errorText}>⚠️ {error}</ThemedText>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={fetchTimerConfig}
              >
                <ThemedText style={styles.retryButtonText}>Reintentar</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          ) : needsManualMinutes ? (
            <ThemedView style={[styles.timerContainer, styles.manualMinutesContainer]}>
              <ThemedText style={styles.containerTitle}>
                Configurar minutos de almuerzo
              </ThemedText>
              <ThemedText style={styles.manualMinutesHint}>
                No se encontró una duración válida de almuerzo. Ingrese la cantidad de minutos para continuar.
              </ThemedText>
              <ThemedView style={styles.manualMinutesForm}>
                <TextInput
                  style={styles.manualMinutesInput}
                  value={manualMinutesInput}
                  onChangeText={setManualMinutesInput}
                  placeholder="Ej: 30"
                  placeholderTextColor="#999"
                  keyboardType="number-pad"
                  maxLength={3}
                />
                <TouchableOpacity
                  style={styles.manualMinutesButton}
                  onPress={handleAcceptManualMinutes}
                >
                  <ThemedText style={styles.manualMinutesButtonText}>Aceptar</ThemedText>
                </TouchableOpacity>
              </ThemedView>
            </ThemedView>
          ) : timerConfig ? (
            <ThemedView style={styles.timerContainer}>
              {/* Container Title */}
              <ThemedText style={styles.containerTitle}>
                Inicia tu tiempo de almuerzo y añade pausas
              </ThemedText>

              {/* Timer Display */}
              <ThemedView style={styles.timerDisplay}>
                <ThemedView style={styles.timerDisplayContent}>
                  <ThemedText style={styles.timerText}>
                    {formatTime(timeRemaining)}
                  </ThemedText>
                </ThemedView>
                {/* Timer Status */}
                <ThemedView style={styles.statusContainer}>
                  {isTimerActive ? getActionIcon('start-internal') : getActionIcon('stop-internal')}
                </ThemedView>
              </ThemedView>

              {/* Inactivities List */}
              {inactivities.length > 0 && (
                <ThemedView style={styles.inactivitiesContainer}>
                  <ThemedText style={styles.inactivitiesTitle}>
                    Pausas Registradas
                  </ThemedText>
                  {inactivities.map((inactivity, index) => (
                    <ThemedView key={index} style={styles.inactivityItem}>
                      <ThemedText style={styles.inactivityTime}>
                        {renderInactivityTime(inactivity)}
                      </ThemedText>
                      <ThemedText style={styles.inactivityReason}>
                        {inactivity.reason}
                      </ThemedText>
                    </ThemedView>
                  ))}
                </ThemedView>
              )}

              {/* Inactivity Reason Input */}
              {!isTimerActive && currentInactivityStart && (
                <ThemedView style={styles.reasonInputContainer}>
                  <ThemedText style={styles.reasonInputLabel}>
                    Razón de la pausa:
                  </ThemedText>
                  <TextInput
                    style={styles.reasonInput}
                    value={inactivityReason}
                    onChangeText={setInactivityReason}
                    placeholder="Describe la razón de la pausa..."
                    placeholderTextColor="#999"
                    multiline
                    numberOfLines={3}
                  />
                </ThemedView>
              )}

              {/* Control Buttons */}
              <ThemedView style={styles.controlsContainer}>
                <View style={styles.buttonRow}>
                  {!isTimerActive ? (
                    <TouchableOpacity
                      style={styles.startButton}
                      onPress={handleStart}
                      disabled={timeRemaining === 0 || isGeneratingFirmaEmpleado}
                    >
                      {isGeneratingFirmaEmpleado ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        getActionIcon('start')
                      )}
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.stopButton}
                      onPress={handleStop}
                    >
                      {getActionIcon('stop')}
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={styles.resetButton}
                    onPress={handleReset}
                  >
                    {getActionIcon('reset')}
                  </TouchableOpacity>
                </View>

                {/* Manual Registration Button - Only visible when timer is stopped */}
                {!isTimerActive && (
                  <TouchableOpacity
                    style={styles.manualButton}
                    onPress={handleManualLunchTime}
                  >
                    <ThemedText style={styles.manualButtonText}>
                      Registro Manual
                    </ThemedText>
                  </TouchableOpacity>
                )}
              </ThemedView>

            </ThemedView>
          ) : null}
        </ThemedView>
      </ScrollView>

      <AppFooter />

      <SlideMenu
        isVisible={isMenuVisible}
        onClose={handleMenuClose}
        onHomePress={handleHomePress}
        currentRoute="lunch-time"
      />

      {/* Manual Registration Modal */}
      <Modal
        visible={isManualModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsManualModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setIsManualModalVisible(false)}
          />
          <View style={styles.modalContainerWrapper}>
            <ThemedView style={styles.modalContainer}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <ThemedText style={styles.modalTitle}>Registro Manual de Almuerzo</ThemedText>
                <TouchableOpacity onPress={() => setIsManualModalVisible(false)}>
                  <ThemedText style={styles.closeButton}>✕</ThemedText>
                </TouchableOpacity>
              </View>

              {/* Modal Content */}
              <ScrollView style={styles.modalContent}>
                {/* Start Time Input */}
                <ThemedView style={styles.inputGroup}>
                  <ThemedText style={[styles.inputLabel, { color: '#000000' }]}>Hora de Inicio del Almuerzo:</ThemedText>
                  <TouchableOpacity style={styles.timePickerButton} onPress={() => openStartTimePicker()}>
                    <ThemedText style={styles.timePickerButtonText}>
                      {manualStartHour && manualStartMinute ? `${manualStartHour}:${manualStartMinute}` : 'Seleccionar hora'}
                    </ThemedText>
                    <Ionicons name="time-outline" size={20} color="#007AFF" />
                  </TouchableOpacity>
                  {showStartTimePicker && (
                    <View style={styles.inlinePickerContainer}>
                      <DateTimePicker
                        value={startTimePickerValue}
                        mode="time"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={handleStartTimePickerChange}
                      />
                    </View>
                  )}
                </ThemedView>

                {/* Inactivities Section */}
                <ThemedView style={styles.inactivitiesSection}>
                  <View style={styles.sectionHeader}>
                    <ThemedText style={[styles.sectionTitle, { color: '#000000' }]}>Agrega las pausas:</ThemedText>
                    <TouchableOpacity
                      style={styles.addButton}
                      onPress={handleAddManualInactivity}
                    >
                      <ThemedText style={styles.addButtonText}>
                        {getActionIcon('add')}
                      </ThemedText>
                    </TouchableOpacity>
                  </View>

                  {manualInactivities.map((inactivity, index) => (
                    <ThemedView key={index} style={styles.inactivityFormItem}>
                      <View style={styles.inactivityHeader}>
                        <ThemedText style={styles.inactivityNumber}>Pausa #{index + 1}</ThemedText>
                        <TouchableOpacity
                          onPress={() => handleRemoveManualInactivity(index)}
                          style={styles.removeButton}
                        >
                          {getActionIcon('remove')}
                        </TouchableOpacity>
                      </View>

                      {/* Horas en una sola fila */}
                      <View style={styles.pauseTimesRow}>
                        {/* Hora de Inicio */}
                        <ThemedView style={styles.pauseTimeSection}>
                          <ThemedView style={styles.pauseTimeHoursSection}>
                            <ThemedText style={styles.pauseTimeLabel}>Inicio:</ThemedText>
                            <TouchableOpacity
                              style={styles.timePickerButtonSmall}
                              onPress={() => openInactivityPicker(index, 'start')}
                            >
                              <ThemedText style={styles.timePickerButtonTextSmall}>
                                {inactivity.startHour && inactivity.startMinute
                                  ? `${inactivity.startHour}:${inactivity.startMinute}`
                                  : 'Seleccione'}
                              </ThemedText>
                              <Ionicons name="time-outline" size={16} color="#007AFF" />
                            </TouchableOpacity>
                          </ThemedView>

                          {/* Hora de Fin */}
                          <ThemedView style={styles.pauseTimeHoursSection}>
                            <ThemedText style={styles.pauseTimeLabel}>Fin:</ThemedText>
                            <TouchableOpacity
                              style={styles.timePickerButtonSmall}
                              onPress={() => openInactivityPicker(index, 'end')}
                            >
                              <ThemedText style={styles.timePickerButtonTextSmall}>
                                {inactivity.endHour && inactivity.endMinute
                                  ? `${inactivity.endHour}:${inactivity.endMinute}`
                                  : 'Seleccione'}
                              </ThemedText>
                              <Ionicons name="time-outline" size={16} color="#007AFF" />
                            </TouchableOpacity>
                          </ThemedView>
                        </ThemedView>
                      </View>
                      {activeInactivityPicker && activeInactivityPicker.index === index && (
                        <View style={styles.inlinePickerContainer}>
                          <DateTimePicker
                            value={inactivityPickerValue}
                            mode="time"
                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                            onChange={handleInactivityTimePickerChange}
                          />
                        </View>
                      )}

                      <ThemedView style={styles.reasonInputGroup}>
                        <ThemedText style={styles.reasonLabel}>Razón:</ThemedText>
                        <TextInput
                          style={styles.reasonInputSmall}
                          value={inactivity.reason}
                          onChangeText={(value) => handleManualInactivityChange(index, 'reason', value)}
                          placeholder="Describe la razón de la pausa..."
                          placeholderTextColor="#999"
                          multiline
                          numberOfLines={2}
                        />
                      </ThemedView>
                    </ThemedView>
                  ))}
                </ThemedView>

                {/* Submit Button */}
                <TouchableOpacity
                  style={styles.submitButton}
                  onPress={handleManualSubmit}
                >
                  <ThemedText style={styles.submitButtonText}>
                    {getActionIcon('confirm')}
                  </ThemedText>
                </TouchableOpacity>
              </ScrollView>
            </ThemedView>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fullContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 20,
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
    gap: 16,
    minHeight: 300,
  },
  loadingText: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 20,
    minHeight: 300,
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
    lineHeight: 24,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  timerContainer: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#fff',
    overflow: 'hidden',
    padding: 16,
    marginBottom: 20,
    gap: 20,
  },
  containerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 8,
  },
  timerDisplay: {
    backgroundColor: '#007AFF', // Azul
    borderRadius: 20,
    padding: 10,
    width: '100%'
  },
  timerDisplayContent: {
    backgroundColor: '#64B5F6',
    borderRadius: 20,
    paddingHorizontal: 40,
    width: '100%'
  },
  timerText: {
    fontSize: 50,
    lineHeight: 50,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    fontFamily: 'monospace',
    margin: 15,
  },
  statusContainer: {
    backgroundColor: '#007AFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    color: '#000000', // Darkgray color
  },
  infoContainer: {
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.8,
    color: '#000000', // Darkgray color
  },
  controlsContainer: {
    width: '100%',
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: '#34C759',
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  stopButton: {
    backgroundColor: '#FF9500',
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  stopButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  buttonRow: {
    display: 'flex',
    flexDirection: 'row',
    gap: 15,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetButton: {
    backgroundColor: '#FF3B30',
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  manualButton: {
    backgroundColor: '#FF9500',
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderRadius: 10,
    marginTop: 15,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  manualButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  inactivitiesContainer: {
    width: '100%',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
  },
  inactivitiesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
    color: '#333',
  },
  inactivityItem: {
    backgroundColor: '#D1E6FF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  inactivityIndex: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FF9500',
    marginBottom: 4,
  },
  inactivityTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  inactivityReason: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
  },
  reasonInputContainer: {
    width: '100%',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
  },
  reasonInputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#000000',
  },
  reasonInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#000000',
    textAlignVertical: 'top',
    minHeight: 80,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 15,
  },
  modalContainerWrapper: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    zIndex: 1,
  },
  modalContainer: {
    width: '100%',
    maxHeight: '90%',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#666666',
  },
  modalContent: {
    flexGrow: 1,
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#FFFFFF',
  },
  timeInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#000000',
  },
  inputHint: {
    fontSize: 12,
    color: '#FFFFFF',
    marginTop: 4,
    fontStyle: 'italic',
  },
  inactivitiesSection: {

  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  addButton: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    padding: 10,
  },
  inactivityFormItem: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  inactivityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  inactivityNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  removeButton: {
    padding: 4,
  },
  timeInputsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
    backgroundColor: '#F8F9FA',
    padding: 10,
    borderRadius: 8,
  },
  timeInputsRowSmall: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
    backgroundColor: '#D1E6FF', // Light blue
  },
  timeInputGroup: {
    backgroundColor: '#F8F9FA',
    flex: 1,
  },
  timeInputColumn: {
    flex: 1,
    alignItems: 'center',
  },
  timeSeparator: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 25,
    marginHorizontal: 5,
    color: '#000',
  },
  timeSeparatorSmall: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 30,
    marginHorizontal: 3,
    color: '#000',
  },
  timeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  pauseTimesRow: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 10,
  },
  pauseTimeHoursSection: {
    flex: 1,
    backgroundColor: '#D1E6FF', // Light blue
    padding: 5,
    borderRadius: 8,
  },
  pauseTimeSection: {
    display: 'flex',
    flexDirection: 'row',
    flex: 1,
    backgroundColor: '#D1E6FF', // Light blue
    padding: 5,
    borderRadius: 8,
  },
  pauseTimeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
    textAlign: 'center',
  },
  timeInputSmall: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 6,
    padding: 8,
    fontSize: 12,
    color: '#000000',
  },
  reasonInputGroup: {
    backgroundColor: '#F8F9FA',
    marginTop: 5,
  },
  reasonLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  reasonInputSmall: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 6,
    padding: 8,
    fontSize: 12,
    color: '#000000',
    textAlignVertical: 'top',
    minHeight: 50,
  },
  submitButton: {
    backgroundColor: '#34C759',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 40,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  manualMinutesContainer: {
    gap: 8,
  },
  manualMinutesHint: {
    fontSize: 14,
    textAlign: 'center',
    color: '#666666',
    lineHeight: 20,
  },
  manualMinutesForm: {
    width: '100%',
    gap: 12,
  },
  manualMinutesInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 18,
    color: '#000000',
    textAlign: 'center',
  },
  manualMinutesButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  manualMinutesButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  pausasTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 8,
  },
  timePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  timePickerButtonText: {
    fontSize: 16,
    color: '#000000',
    fontWeight: '500',
  },
  timePickerButtonSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 6,
    padding: 8,
    marginTop: 6,
  },
  timePickerButtonTextSmall: {
    fontSize: 14,
    color: '#000000',
    fontWeight: '500',
  },
  inlinePickerContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    marginTop: 10,
    padding: 10,
  },
});
