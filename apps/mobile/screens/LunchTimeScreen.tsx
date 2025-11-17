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
import { ActivityIndicator, Alert, StyleSheet, TouchableOpacity, View, ScrollView, AppState, TextInput, Modal } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import saveLunchTime from '../hooks/saveLunchTime';
import { toZonedTime } from 'date-fns-tz';
import * as Network from 'expo-network';

type LunchTimeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'LunchTime'>;

interface LunchTimeConfig {
  status: boolean;
  minutos: number;
  marcaDiaId: string;
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
  const [inactivityReason, setInactivityReason] = useState('');
  const [inactivities, setInactivities] = useState<InactivityData[]>([]);
  const [currentInactivityStart, setCurrentInactivityStart] = useState<Date | null>(null);
  const [isManualModalVisible, setIsManualModalVisible] = useState(false);
  const [manualStartHour, setManualStartHour] = useState('');
  const [manualStartMinute, setManualStartMinute] = useState('');
  const [manualInactivities, setManualInactivities] = useState<ManualInactivityData[]>([]);
  
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
        await restoreCurrentState();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const saveCurrentState = async () => {
    // Segundos restantes del temporizador
    const remainingSeconds = timeRemainingRef.current * 1000; // En milisegundos

    const current_state = {
      running: timerActiveRef.current,
      remainingSeconds: remainingSeconds, // En milisegundos
      currentTimestamp: new Date().getTime(), // En milisegundos
      startTime: startTimeRef.current,
      inactivities: inactivitiesRef.current,
      currentInactivityStart: currentInactivityStartRef.current,
    }

    await AsyncStorage.setItem('temp_state', JSON.stringify(current_state));

    setEndTimeMode('calculated');
    setEndTime(new Date(current_state.currentTimestamp + current_state.remainingSeconds));

    console.log('✅ Saved current state');
  }

  const restoreCurrentState = async () => {
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
        
        if (temp_state_obj.running) {
          setIsTimerActive(true);
          const remaining_time = (temp_state_obj.remainingSeconds / 1000) - ((new Date().getTime() - temp_state_obj.currentTimestamp) / 1000);
          setStartTime(temp_state_obj.startTime ? new Date(temp_state_obj.startTime) : null);
          setCurrentInactivityStart(temp_state_obj.currentInactivityStart ? new Date(temp_state_obj.currentInactivityStart) : null);
          if (remaining_time <= 0) {
            setIsTimerActive(false);
            setTimeRemaining(0);
          } else {
            setEndTimeMode('current');
            setTimeRemaining(parseInt(remaining_time.toFixed(0)));
          }
        }
        else{
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
    }
    console.log('✅ Restored current state');
  }

  const handleTimerComplete = async () => {
    setIsTimerActive(false);
    console.log('endTimeMode', endTimeModeRef.current);
    let endTimeUse = null;
    if (endTimeModeRef.current == 'current') {
      endTimeUse = new Date();
    }
    else{ 
      endTimeUse = endTimeRef.current;
    }

    const requestData = {
      empleadoId: employee?.id,
      inicio: startTimeRef.current,
      fin: endTimeUse,
      pausas: JSON.stringify(inactivitiesRef.current),
      es_manual: false
    };

    console.log('requestData', requestData);

    await sendLunchTimeRecord(requestData);
  }

  const sendLunchTimeRecord = async (requestData: any) => {

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

      const networkState = await Network.getNetworkStateAsync();  

      let lunch_time_config_obj = null;
      if (networkState.isConnected && networkState.isInternetReachable) {
        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) {
          throw new Error('Server URL not configured');
        }
        const token = await AsyncStorage.getItem('access_token');
        if (!token) {
          throw new Error('No authentication token found');
        }
        const response = await fetch(`${apiUrl}/api/lunch-time/${current_marca_obj.id}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': '69420',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (!data.status) {
          throw new Error('No lunch time config status found');
        }
        lunch_time_config_obj = data;
      }
      else { 
        const lunch_time_config = await AsyncStorage.getItem('lunch_time_config');
        if (!lunch_time_config) {
          throw new Error('No lunch time config found');
        }
        lunch_time_config_obj = JSON.parse(lunch_time_config);
        if (!lunch_time_config_obj.status) {
          throw new Error('No lunch time config status found');
        }
      }

      const config = {
        minutos: lunch_time_config_obj.minutos,
        status: lunch_time_config_obj.status,
        marcaDiaId: current_marca_obj.id,
      };

      setTimerConfig(config);
      setTimeRemaining(config.minutos * 60); // Convert minutes to seconds

      await restoreCurrentState();
    } catch (error) {
      console.error('Error fetching timer config:', error);
      setError('Error al cargar la configuración del temporizador');
    } finally {
      setIsLoadingConfig(false);
    }
  };

  const handleStart = () => {
    if (timerConfig && timeRemaining > 0) {
      if (startTimeRef.current == null) {
        setStartTime(new Date());
      }
      setIsTimerActive(true);
      setEndTimeMode('current');
      setEndTime(null);
      
      // Si había una inactividad en curso, guardarla
      if (currentInactivityStart) {
        const newInactivity: InactivityData = {
          startTime: currentInactivityStart,
          endTime: new Date(),
          reason: inactivityReason.trim() || 'Sin razón determinada'
        };
        setInactivities(prev => [...prev, newInactivity]);
        setCurrentInactivityStart(null);
        setInactivityReason('');
      }
    }
  };

  const handleStop = () => {
    setIsTimerActive(false);
    // Iniciar tracking de inactividad
    setCurrentInactivityStart(new Date());
  };

  const handleReset = async () => {
    setIsTimerActive(false);
    setStartTime(null);
    setEndTime(null);
    setInactivities([]);
    setCurrentInactivityStart(null);
    setInactivityReason('');
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
    case 'lunch-time': return <Ionicons name="hourglass" size={25} color='#FFFFFF' />;
    case 'start': return <Ionicons name="caret-forward" size={35} color='#FFFFFF' />;
    case 'start-internal': return <Ionicons name="caret-forward" size={25} color='#FFFFFF' />;
    case 'stop': return <Ionicons name="pause" size={35} color='#FFFFFF' />;
    case 'stop-internal': return <Ionicons name="pause" size={25} color='#FFFFFF' />;
    case 'reset': return <Ionicons name="refresh" size={35} color='#FFFFFF' />;
    case 'manual': return <Ionicons name="create-outline" size={20} color='#FFFFFF' />;
    case 'add': return <Ionicons name="add" size={20} color='#FFFFFF' />;
    case 'remove': return <Ionicons name="trash" size={20} color='#FF3B30' />;
    default: return <Ionicons name="close" size={35} color='#FFFFFF' />;
  }
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
          const requestData = {
            empleadoId: employee?.id,
            inicio: startTime,
            fin: endTime,
            pausas: JSON.stringify(inactivitiesWithToday),
            es_manual: true
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
          ) : timerConfig ? (
            <ThemedView style={styles.timerContainer}>
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
                        {inactivity.startTime.toLocaleTimeString('es-ES', { hour12: false, hour: '2-digit', minute: '2-digit' })} - {inactivity.endTime.toLocaleTimeString('es-ES', { hour12: false, hour: '2-digit', minute: '2-digit' })}
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
                      disabled={timeRemaining === 0}
                    >
                        {getActionIcon('start')}
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
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsManualModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
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
                <ThemedText style={styles.inputLabel}>Hora de Inicio del Almuerzo:</ThemedText>
                <View style={styles.timeInputsRow}>
                  <View style={styles.timeInputColumn}>
                    <ThemedText style={styles.timeLabel}>Hora:</ThemedText>
                    <TextInput
                      style={styles.timeInputSmall}
                      value={manualStartHour}
                      onChangeText={(value) => setManualStartHour(validateNumberInput(value, 23))}
                      placeholder="00"
                      placeholderTextColor="#999"
                      keyboardType="numeric"
                      maxLength={2}
                    />
                  </View>
                  <ThemedText style={styles.timeSeparator}>:</ThemedText>
                  <View style={styles.timeInputColumn}>
                    <ThemedText style={styles.timeLabel}>Minutos:</ThemedText>
                    <TextInput
                      style={styles.timeInputSmall}
                      value={manualStartMinute}
                      onChangeText={(value) => setManualStartMinute(validateNumberInput(value, 59))}
                      placeholder="00"
                      placeholderTextColor="#999"
                      keyboardType="numeric"
                      maxLength={2}
                    />
                  </View>
                </View>
              </ThemedView>

              {/* Inactivities Section */}
              <ThemedView style={styles.inactivitiesSection}>
                <View style={styles.sectionHeader}>
                  <ThemedText style={styles.sectionTitle}>Pausas agregadas:</ThemedText>
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
                        <ThemedText style={styles.pauseTimeLabel}>Inicio:</ThemedText>
                        <View style={styles.timeInputsRowSmall}>
                          <View style={styles.timeInputColumn}>
                            <ThemedText style={styles.timeLabel}>H:</ThemedText>
                            <TextInput
                              style={styles.timeInputSmall}
                              value={inactivity.startHour}
                              onChangeText={(value) => handleManualInactivityChange(index, 'startHour', value)}
                              placeholder="00"
                              placeholderTextColor="#999"
                              keyboardType="numeric"
                              maxLength={2}
                            />
                          </View>
                          <ThemedText style={styles.timeSeparatorSmall}>:</ThemedText>
                          <View style={styles.timeInputColumn}>
                            <ThemedText style={styles.timeLabel}>M:</ThemedText>
                            <TextInput
                              style={styles.timeInputSmall}
                              value={inactivity.startMinute}
                              onChangeText={(value) => handleManualInactivityChange(index, 'startMinute', value)}
                              placeholder="00"
                              placeholderTextColor="#999"
                              keyboardType="numeric"
                              maxLength={2}
                            />
                          </View>
                        </View>
                      </ThemedView>

                      {/* Hora de Fin */}
                      <ThemedView style={styles.pauseTimeSection}>
                        <ThemedText style={styles.pauseTimeLabel}>Fin:</ThemedText>
                        <View style={styles.timeInputsRowSmall}>
                          <View style={styles.timeInputColumn}>
                            <ThemedText style={styles.timeLabel}>H:</ThemedText>
                            <TextInput
                              style={styles.timeInputSmall}
                              value={inactivity.endHour}
                              onChangeText={(value) => handleManualInactivityChange(index, 'endHour', value)}
                              placeholder="00"
                              placeholderTextColor="#999"
                              keyboardType="numeric"
                              maxLength={2}
                            />
                          </View>
                          <ThemedText style={styles.timeSeparatorSmall}>:</ThemedText>
                          <View style={styles.timeInputColumn}>
                            <ThemedText style={styles.timeLabel}>M:</ThemedText>
                            <TextInput
                              style={styles.timeInputSmall}
                              value={inactivity.endMinute}
                              onChangeText={(value) => handleManualInactivityChange(index, 'endMinute', value)}
                              placeholder="00"
                              placeholderTextColor="#999"
                              keyboardType="numeric"
                              maxLength={2}
                            />
                          </View>
                        </View>
                      </ThemedView>
                    </View>

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
    alignItems: 'center',
    gap: 20,
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
    color: '#333',
    textAlignVertical: 'top',
    minHeight: 80,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    height: '80%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
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
    flex: 1,
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
    color: '#333',
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
  pauseTimeSection: {
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
    color: '#333',
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
    color: '#333',
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
});
