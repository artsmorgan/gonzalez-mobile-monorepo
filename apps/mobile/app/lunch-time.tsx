import AppHeader from '@/components/AppHeader';
import AppFooter from '@/components/AppFooter';
import SlideMenu from '@/components/SlideMenu';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useAuth } from '@/contexts/AuthContext';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import React, { useEffect, useState, useRef } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, TouchableOpacity, TextInput, Modal, AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Pausa {
  inicio: string;
  fin: string;
  razon: string;
}

interface Hora {
  pausas: Pausa[];
  inicio: string;
  fin: string;
  es_manual: boolean;
}

interface LunchTimeData {
  minutos: number;
  horas: Hora[];
}

interface PausaRegistro {
  inicio: Date;
  fin: Date;
  razon: string;
}

interface ManualPausa {
  inicio: string;
  fin: string;
  razon: string;
}

export default function LunchTimeScreen() {
  const { employee, refreshAccessToken } = useAuth();
  const router = useRouter();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [lunchTimeData, setLunchTimeData] = useState<LunchTimeData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Timer states
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerPaused, setTimerPaused] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [currentPauseStart, setCurrentPauseStart] = useState<Date | null>(null);
  const [pausas, setPausas] = useState<PausaRegistro[]>([]);
  const [pauseReason, setPauseReason] = useState('');
  const [lastTimestamp, setLastTimestamp] = useState<number>(0);
  const [remainingMilliseconds, setRemainingMilliseconds] = useState<number>(0);
  const timerInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Manual entry states
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualStartTime, setManualStartTime] = useState('');
  const [manualPausas, setManualPausas] = useState<ManualPausa[]>([]);
  const [manualPausaInicio, setManualPausaInicio] = useState('');
  const [manualPausaFin, setManualPausaFin] = useState('');
  const [manualPausaRazon, setManualPausaRazon] = useState('');
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  const isRestoringRef = useRef(false);
  const appStateListenerRef = useRef<any>(null);

  useEffect(() => {
    console.log('timerRunning', timerRunning);
    fetchLunchTimeData();
    
    // Check if there's a timer running in background and restore it
    checkAndRestoreTimer();
    
    // Create AppState listener once on mount
    console.log('📱 Creating AppState listener');
    const subscription = AppState.addEventListener("change", handleAppStateChange);
    appStateListenerRef.current = subscription;
    
    // Cleanup on unmount
    return () => {
      console.log('🧹 Component unmounting - cleaning all resources');
      
      // Save current state before unmounting if timer is running
      const currentTimerRunning = timerRunning;
      const currentTimerPaused = timerPaused;
      
      if (currentTimerRunning && !currentTimerPaused) {
        saveTimerStateOnNavigate();
      }
      
      // Clear AppState listener
      if (appStateListenerRef.current) {
        console.log('🧹 Removing AppState listener');
        appStateListenerRef.current.remove();
        appStateListenerRef.current = null;
      }
      
      // Clear timer interval (will be recreated when returning)
      if (timerInterval.current) {
        console.log('⏹️ Stopping timer interval');
        clearInterval(timerInterval.current);
        timerInterval.current = null;
      }
      
      // Reset restoration flag
      isRestoringRef.current = false;
      subscription.remove(); // ✅ Limpieza al desmontar el componente
    };
  }, []); // Empty dependency array - only run on mount/unmount

  // Timer effect - updates every second based on milliseconds
  useEffect(() => {
    // Clear any existing interval first
    if (timerInterval.current) {
      console.log('🔄 Clearing previous timer interval');
      clearInterval(timerInterval.current);
      timerInterval.current = null;
    }

    if (timerRunning && !timerPaused) {
      console.log('▶️ Starting timer interval');
      timerInterval.current = setInterval(() => {
        setRemainingMilliseconds((prevMs) => {
          const newMs = prevMs - 1000;
          
          if (newMs <= 0) {
            handleTimerComplete();
            setRemainingSeconds(0);
            return 0;
          }
          
          // Update seconds display
          const newSeconds = Math.floor(newMs / 1000);
          setRemainingSeconds(newSeconds);
          
          return newMs;
        });
      }, 1000);
    }

    // Cleanup function
    return () => {
      if (timerInterval.current) {
        console.log('🧹 Cleaning up timer interval');
        clearInterval(timerInterval.current);
        timerInterval.current = null;
      }
    };
  }, [timerRunning, timerPaused]);


  const fetchLunchTimeData = async () => {
    if (!employee) {
      setError('No se encontró información del empleado');
      setIsLoading(false);
      return;
    }

    try {
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) {
        throw new Error('Server URL not configured');
      }

      let token = await AsyncStorage.getItem('access_token');

      // Try to refresh token if we don't have one
      if (!token) {
        const refreshed = await refreshAccessToken();
        if (!refreshed) {
          throw new Error('No valid authentication token');
        }
        token = await AsyncStorage.getItem('access_token');
      }

      const response = await fetch(`${apiUrl}/api/lunch-time/${employee.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '69420'
        },
      });

      if (response.status === 401 || response.status === 403) {
        // Token might be expired, try to refresh
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          // Retry the request with the new token
          return fetchLunchTimeData();
        } else {
          throw new Error('Sesión expirada');
        }
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setLunchTimeData(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching lunch time data:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar los datos');
      Alert.alert('Error', 'No se pudieron cargar los datos de tiempo de alimentación');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMenuPress = () => {
    setIsMenuVisible(true);
  };

  const handleMenuClose = () => {
    setIsMenuVisible(false);
  };


  const handleHomePress = () => {
    router.navigate('/(tabs)');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate total pause duration in minutes
  const calculateTotalPauseDuration = (pausas: ManualPausa[]): number => {
    let totalMinutes = 0;
    for (const pausa of pausas) {
      const [inicioHour, inicioMin] = pausa.inicio.split(':').map(Number);
      const [finHour, finMin] = pausa.fin.split(':').map(Number);
      const inicioMinutos = inicioHour * 60 + inicioMin;
      const finMinutos = finHour * 60 + finMin;
      totalMinutes += finMinutos - inicioMinutos;
    }
    return totalMinutes;
  };

  // Handle AppState changes
  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    console.log("App state changed:", appState, "->", nextAppState);

    // Save timestamp when app goes to background
    if (appState === "active" && nextAppState.match(/inactive|background/)) {
      console.log("📱 App going to background, saving timestamp");
      if (timerRunning && !timerPaused) {
        await saveTimerStateOnBackground();
      }
    }

    // Restore and recalculate when app comes to foreground
    if (appState.match(/inactive|background/) && nextAppState === "active") {
      console.log("✅ App returned to foreground");
      
      // Prevent multiple simultaneous restorations
      if (isRestoringRef.current) {
        console.log('⚠️ Already restoring, skipping');
        return;
      }
      
      const shouldRestore = await AsyncStorage.getItem('timer_running');
      if (shouldRestore === 'true') {
        isRestoringRef.current = true;
        await restoreTimerFromBackground();
        isRestoringRef.current = false;
      }
    }

    setAppState(nextAppState);
  };

  // Timer functions - Save state when going to background
  const saveTimerStateOnBackground = async () => {
    try {
      const currentTimestamp = Date.now();
      
      const state = {
        running: timerRunning,
        paused: timerPaused,
        remainingSeconds,
        startTime: startTime?.toISOString(),
        currentPauseStart: currentPauseStart?.toISOString(),
        pausas: pausas.map(p => ({
          inicio: p.inicio.toISOString(),
          fin: p.fin.toISOString(),
          razon: p.razon
        })),
        lastTimestamp: currentTimestamp,
        remainingMilliseconds: remainingMilliseconds  // Use the actual milliseconds state
      };
      
      await AsyncStorage.setItem('timer_state', JSON.stringify(state));
      await AsyncStorage.setItem('timer_running', 'true');
      console.log('📱 Saved timer state on background:', { 
        timestamp: currentTimestamp, 
        remainingMs: remainingMilliseconds,
        remainingSeconds: Math.floor(remainingMilliseconds / 1000)
      });
    } catch (error) {
      console.error('Error saving timer state on background:', error);
    }
  };

  // Save state when navigating away from component
  const saveTimerStateOnNavigate = async () => {
    try {
      const currentTimestamp = Date.now();
      
      const state = {
        running: timerRunning,
        paused: timerPaused,
        remainingSeconds,
        startTime: startTime?.toISOString(),
        currentPauseStart: currentPauseStart?.toISOString(),
        pausas: pausas.map(p => ({
          inicio: p.inicio.toISOString(),
          fin: p.fin.toISOString(),
          razon: p.razon
        })),
        lastTimestamp: currentTimestamp,
        remainingMilliseconds: remainingMilliseconds
      };
      
      await AsyncStorage.setItem('timer_state', JSON.stringify(state));
      await AsyncStorage.setItem('timer_in_background', 'true');
      console.log('🚪 Saved timer state on navigate:', { 
        timestamp: currentTimestamp, 
        remainingMs: remainingMilliseconds,
        remainingSeconds: Math.floor(remainingMilliseconds / 1000)
      });
    } catch (error) {
      console.error('Error saving timer state on navigate:', error);
    }
  };

  // Check and restore timer when component mounts
  const checkAndRestoreTimer = async () => {
    try {
      const hasTimerInBackground = await AsyncStorage.getItem('timer_in_background');
      
      if (hasTimerInBackground === 'true') {
        console.log('🔄 Detected timer in background, restoring...');
        await restoreTimerFromNavigation();
        await AsyncStorage.removeItem('timer_in_background');
      } else {
        // Normal load on first mount
        await loadTimerState();
      }
    } catch (error) {
      console.error('Error checking timer in background:', error);
    }
  };

  const loadTimerState = async () => {
    try {
      const stateStr = await AsyncStorage.getItem('timer_state');
      if (stateStr) {
        const state = JSON.parse(stateStr);
        // Only load if timer was running and not from a background restoration
        const isFromBackground = await AsyncStorage.getItem('timer_running');
        if (state.running && isFromBackground !== 'true') {
          setTimerRunning(state.running);
          setTimerPaused(state.paused);
          setRemainingSeconds(state.remainingSeconds);
          setRemainingMilliseconds(state.remainingMilliseconds);
          setLastTimestamp(state.lastTimestamp);
          setStartTime(state.startTime ? new Date(state.startTime) : null);
          setCurrentPauseStart(state.currentPauseStart ? new Date(state.currentPauseStart) : null);
          setPausas(state.pausas.map((p: any) => ({
            inicio: new Date(p.inicio),
            fin: new Date(p.fin),
            razon: p.razon
          })));
          console.log('✅ Loaded timer state on app start');
        }
      }
    } catch (error) {
      console.error('Error loading timer state:', error);
    }
  };

  const restoreTimerFromBackground = async () => {
    try {
      const stateStr = await AsyncStorage.getItem('timer_state');
      if (!stateStr) {
        console.log('⚠️ No timer state found');
        await AsyncStorage.removeItem('timer_running');
        return;
      }

      const state = JSON.parse(stateStr);
      console.log('🔄 Restoring timer from background:', {
        lastTimestamp: state.lastTimestamp,
        remainingMs: state.remainingMilliseconds,
        remainingSec: state.remainingSeconds
      });

      // Calculate elapsed time
      const currentTimestamp = Date.now();
      const elapsedMs = currentTimestamp - state.lastTimestamp;
      const newRemainingMs = state.remainingMilliseconds - elapsedMs;

      console.log('📊 Timer calculation:', {
        currentTimestamp,
        lastTimestamp: state.lastTimestamp,
        elapsedMs,
        elapsedSeconds: Math.floor(elapsedMs / 1000),
        oldRemainingMs: state.remainingMilliseconds,
        newRemainingMs,
        newRemainingSeconds: Math.floor(newRemainingMs / 1000)
      });

      // Restore pausas
      const pausasRestored = state.pausas.map((p: any) => ({
        inicio: new Date(p.inicio),
        fin: new Date(p.fin),
        razon: p.razon
      }));

      const startTimeRestored = state.startTime ? new Date(state.startTime) : null;

      if (newRemainingMs <= 0) {
        // Timer finished while in background
        console.log('⏰ Timer finished in background');
        
        // Calculate exact end time
        const endTime = new Date(state.lastTimestamp + state.remainingMilliseconds);
        
        // IMPORTANT: Set timerRunning to false BEFORE setting remainingSeconds to 0
        // This prevents handleTimerComplete from executing
        setTimerRunning(false);
        setTimerPaused(false);
        
        // Set states for the POST request
        setStartTime(startTimeRestored);
        setPausas(pausasRestored);
        setRemainingSeconds(0);
        setRemainingMilliseconds(0);
        
        // Send the record
        if (startTimeRestored && employee) {
          await sendLunchTimeRecordWithEndTime(false, startTimeRestored, endTime, pausasRestored);
          Alert.alert('Tiempo completado', 'Tu tiempo de almuerzo ha finalizado mientras la aplicación estaba en segundo plano');
        }
        
        // Clear state
        await clearTimerState();
      } else {
        // Timer still running
        console.log('▶️ Timer still running, updating remaining time');
        const newRemainingSeconds = Math.floor(newRemainingMs / 1000);
        
        // First restore all the states
        setStartTime(startTimeRestored);
        setPausas(pausasRestored);
        setRemainingMilliseconds(newRemainingMs);
        setLastTimestamp(currentTimestamp);
        setTimerPaused(false);
        
        // Set remaining seconds
        setRemainingSeconds(newRemainingSeconds);
        
        // Finally start the timer
        setTimerRunning(true);
        
        // Clear the background flag
        await AsyncStorage.removeItem('timer_running');
        
        console.log('✅ Timer restored successfully with', newRemainingSeconds, 'seconds remaining');
      }
    } catch (error) {
      console.error('Error restoring timer from background:', error);
      await AsyncStorage.removeItem('timer_running');
    }
  };

  const restoreTimerFromNavigation = async () => {
    try {
      const stateStr = await AsyncStorage.getItem('timer_state');
      if (!stateStr) {
        console.log('⚠️ No timer state found');
        return;
      }

      const state = JSON.parse(stateStr);
      console.log('🔄 Restoring timer from navigation:', {
        lastTimestamp: state.lastTimestamp,
        remainingMs: state.remainingMilliseconds
      });

      // Calculate elapsed time
      const currentTimestamp = Date.now();
      const elapsedMs = currentTimestamp - state.lastTimestamp;
      const newRemainingMs = state.remainingMilliseconds - elapsedMs;

      console.log('📊 Timer calculation:', {
        elapsedMs,
        elapsedSeconds: Math.floor(elapsedMs / 1000),
        oldRemainingMs: state.remainingMilliseconds,
        newRemainingMs,
        newRemainingSeconds: Math.floor(newRemainingMs / 1000)
      });

      // Restore pausas
      const pausasRestored = state.pausas.map((p: any) => ({
        inicio: new Date(p.inicio),
        fin: new Date(p.fin),
        razon: p.razon
      }));

      const startTimeRestored = state.startTime ? new Date(state.startTime) : null;

      if (newRemainingMs <= 0) {
        // Timer finished while navigating
        console.log('⏰ Timer finished while in another screen');
        
        const endTime = new Date(state.lastTimestamp + state.remainingMilliseconds);
        
        setTimerRunning(false);
        setTimerPaused(false);
        setStartTime(startTimeRestored);
        setPausas(pausasRestored);
        setRemainingSeconds(0);
        setRemainingMilliseconds(0);
        
        if (startTimeRestored && employee) {
          await sendLunchTimeRecordWithEndTime(false, startTimeRestored, endTime, pausasRestored);
          Alert.alert('Tiempo completado', 'Tu tiempo de almuerzo ha finalizado');
        }
        
        await clearTimerState();
      } else {
        // Timer still running - restore and continue
        console.log('▶️ Restoring active timer');
        const newRemainingSeconds = Math.floor(newRemainingMs / 1000);
        
        setStartTime(startTimeRestored);
        setPausas(pausasRestored);
        setRemainingMilliseconds(newRemainingMs);
        setLastTimestamp(currentTimestamp);
        setTimerPaused(state.paused || false);
        setRemainingSeconds(newRemainingSeconds);
        setTimerRunning(true);
        
        console.log('✅ Timer restored and running with', newRemainingSeconds, 'seconds remaining');
      }
    } catch (error) {
      console.error('Error restoring timer from navigation:', error);
    }
  };

  const clearTimerState = async () => {
    try {
      await AsyncStorage.removeItem('timer_state');
      await AsyncStorage.removeItem('timer_running');
      await AsyncStorage.removeItem('timer_in_background');
      console.log('🗑️ Cleared timer state');
    } catch (error) {
      console.error('Error clearing timer state:', error);
    }
  };

  const handleStartTimer = () => {
    if (!lunchTimeData) return;
    
    const totalMilliseconds = lunchTimeData.minutos * 60 * 1000;
    const currentTimestamp = Date.now();
    
    setRemainingMilliseconds(totalMilliseconds);
    setRemainingSeconds(Math.floor(totalMilliseconds / 1000));
    setLastTimestamp(currentTimestamp);
    setStartTime(new Date());
    setTimerRunning(true);
    setTimerPaused(false);
    setPausas([]);
    
    console.log('▶️ Timer started:', {
      totalMs: totalMilliseconds,
      totalSeconds: Math.floor(totalMilliseconds / 1000),
      startTimestamp: currentTimestamp
    });
  };

  const handlePauseTimer = () => {
    setTimerPaused(true);
    setCurrentPauseStart(new Date());
  };

  const handleResumeTimer = () => {
    if (currentPauseStart) {
      const pauseEnd = new Date();
      const newPausa: PausaRegistro = {
        inicio: currentPauseStart,
        fin: pauseEnd,
        razon: pauseReason.trim() || 'Sin razón'
      };
      setPausas([...pausas, newPausa]);
      setPauseReason('');
      setCurrentPauseStart(null);
    }
    setTimerPaused(false);
  };

  const handleTimerComplete = async () => {
    // Only execute if timer is actually running
    // This prevents duplicate calls when timer finishes in background
    if (!timerRunning) {
      console.log('⚠️ handleTimerComplete called but timer not running, skipping');
      return;
    }
    
    console.log('⏰ Timer completed in foreground');
    setTimerRunning(false);
    setTimerPaused(false);
    
    if (startTime && employee) {
      const endTime = new Date();
      await sendLunchTimeRecord(false);
    }
    
    clearTimerState();
    Alert.alert('Tiempo completado', 'Tu tiempo de almuerzo ha finalizado');
  };

  const sendLunchTimeRecord = async (esManual: boolean, manualStart?: Date, manualEnd?: Date, manualPausasList?: PausaRegistro[]) => {
    try {
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) {
        throw new Error('Server URL not configured');
      }

      let token = await AsyncStorage.getItem('access_token');
      if (!token) {
        const refreshed = await refreshAccessToken();
        if (!refreshed) {
          throw new Error('No valid authentication token');
        }
        token = await AsyncStorage.getItem('access_token');
      }

      const inicio = esManual ? manualStart : startTime;
      const fin = esManual ? manualEnd : new Date();
      const pausasList = esManual ? manualPausasList : pausas;

      const response = await fetch(`${apiUrl}/api/lunch-time`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '69420'
        },
        body: JSON.stringify({
          empleadoId: employee?.id,
          inicio: inicio?.toISOString(),
          fin: fin?.toISOString(),
          pausas: JSON.stringify(pausasList?.map(p => ({
            inicio: p.inicio.toISOString(),
            fin: p.fin.toISOString(),
            razon: p.razon
          })) || []),
          es_manual: esManual
        })
      });

      if (response.status === 401 || response.status === 403) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          return sendLunchTimeRecord(esManual, manualStart, manualEnd, manualPausasList);
        } else {
          throw new Error('Sesión expirada');
        }
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      Alert.alert('Éxito', 'Registro de tiempo de almuerzo guardado correctamente');
      fetchLunchTimeData(); // Refresh data
    } catch (error) {
      console.error('Error sending lunch time record:', error);
      Alert.alert('Error', 'No se pudo guardar el registro de tiempo de almuerzo');
    }
  };

  const sendLunchTimeRecordWithEndTime = async (esManual: boolean, start: Date, end: Date, pausasList: PausaRegistro[]) => {
    try {
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) {
        throw new Error('Server URL not configured');
      }

      let token = await AsyncStorage.getItem('access_token');
      if (!token) {
        const refreshed = await refreshAccessToken();
        if (!refreshed) {
          throw new Error('No valid authentication token');
        }
        token = await AsyncStorage.getItem('access_token');
      }

      const response = await fetch(`${apiUrl}/api/lunch-time`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '69420'
        },
        body: JSON.stringify({
          empleadoId: employee?.id,
          inicio: start.toISOString(),
          fin: end.toISOString(),
          pausas: JSON.stringify(pausasList.map(p => ({
            inicio: p.inicio.toISOString(),
            fin: p.fin.toISOString(),
            razon: p.razon
          }))),
          es_manual: esManual
        })
      });

      if (response.status === 401 || response.status === 403) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          return sendLunchTimeRecordWithEndTime(esManual, start, end, pausasList);
        } else {
          throw new Error('Sesión expirada');
        }
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      Alert.alert('Éxito', 'Registro de tiempo de almuerzo guardado correctamente');
      fetchLunchTimeData(); // Refresh data
    } catch (error) {
      console.error('Error sending lunch time record:', error);
      Alert.alert('Error', 'No se pudo guardar el registro de tiempo de almuerzo');
    }
  };

  // Manual entry functions
  const handleOpenManualModal = () => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    setManualStartTime(`${hours}:${minutes}`);
    setManualPausas([]);
    setShowManualModal(true);
  };

  const handleAddManualPausa = () => {
    if (!manualPausaInicio || !manualPausaFin) {
      Alert.alert('Error', 'Debe ingresar hora de inicio y fin de la pausa');
      return;
    }

    if (!manualStartTime || !lunchTimeData) {
      Alert.alert('Error', 'Debe ingresar primero la hora de inicio del almuerzo');
      return;
    }

    // Parse times
    const today = new Date();
    const [inicioHour, inicioMin] = manualPausaInicio.split(':').map(Number);
    const [finHour, finMin] = manualPausaFin.split(':').map(Number);

    const pausaInicio = new Date(today.getFullYear(), today.getMonth(), today.getDate(), inicioHour, inicioMin);
    const pausaFin = new Date(today.getFullYear(), today.getMonth(), today.getDate(), finHour, finMin);

    if (pausaFin <= pausaInicio) {
      Alert.alert('Error', 'La hora de fin debe ser posterior a la hora de inicio');
      return;
    }

    // Calculate lunch start time
    const [lunchStartHour, lunchStartMin] = manualStartTime.split(':').map(Number);
    const lunchStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), lunchStartHour, lunchStartMin);

    // Check if pause start and end are after lunch start
    if (pausaInicio <= lunchStart) {
      Alert.alert(
        'Error', 
        `El inicio de la pausa debe ser después de ${lunchStart.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`
      );
      return;
    }

    if (pausaFin <= lunchStart) {
      Alert.alert(
        'Error', 
        `El fin de la pausa debe ser después de ${lunchStart.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`
      );
      return;
    }

    // Check for overlaps with existing pauses
    for (const pausa of manualPausas) {
      const [pInicioHour, pInicioMin] = pausa.inicio.split(':').map(Number);
      const [pFinHour, pFinMin] = pausa.fin.split(':').map(Number);
      const pInicio = new Date(today.getFullYear(), today.getMonth(), today.getDate(), pInicioHour, pInicioMin);
      const pFin = new Date(today.getFullYear(), today.getMonth(), today.getDate(), pFinHour, pFinMin);

      if ((pausaInicio >= pInicio && pausaInicio < pFin) ||
          (pausaFin > pInicio && pausaFin <= pFin) ||
          (pausaInicio <= pInicio && pausaFin >= pFin)) {
        Alert.alert('Error', 'Esta pausa se superpone con otra pausa existente');
        return;
      }
    }

    const newPausa: ManualPausa = {
      inicio: manualPausaInicio,
      fin: manualPausaFin,
      razon: manualPausaRazon.trim() || 'Sin razón'
    };

    setManualPausas([...manualPausas, newPausa]);
    setManualPausaInicio('');
    setManualPausaFin('');
    setManualPausaRazon('');
  };

  const handleRemoveManualPausa = (index: number) => {
    setManualPausas(manualPausas.filter((_, i) => i !== index));
  };

  const handleConfirmManualEntry = async () => {
    if (!manualStartTime || !lunchTimeData) {
      Alert.alert('Error', 'Debe ingresar la hora de inicio');
      return;
    }

    const today = new Date();
    const [startHour, startMin] = manualStartTime.split(':').map(Number);
    const manualStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), startHour, startMin);
    
    // Calculate total pause duration
    const totalPauseDuration = calculateTotalPauseDuration(manualPausas);
    
    // Calculate end time based on lunchTimeData.minutos plus pause duration
    const manualEnd = new Date(manualStart.getTime() + (lunchTimeData.minutos + totalPauseDuration) * 60000);

    // Convert manual pausas to PausaRegistro format
    const pausasRegistro: PausaRegistro[] = manualPausas.map(p => {
      const [iHour, iMin] = p.inicio.split(':').map(Number);
      const [fHour, fMin] = p.fin.split(':').map(Number);
      return {
        inicio: new Date(today.getFullYear(), today.getMonth(), today.getDate(), iHour, iMin),
        fin: new Date(today.getFullYear(), today.getMonth(), today.getDate(), fHour, fMin),
        razon: p.razon
      };
    });

    await sendLunchTimeRecord(true, manualStart, manualEnd, pausasRegistro);
    setShowManualModal(false);
  };

  return (
    <ThemedView style={styles.fullContainer}>
      <AppHeader onMenuPress={handleMenuPress} />
      
      <ScrollView style={styles.scrollView}>
        <ThemedView style={styles.container}>
          {/* Title Section */}
          <ThemedView style={styles.titleContainer}>
            <ThemedText type="title" style={styles.title}>
              ⏰ Tiempo de Almuerzo
            </ThemedText>
            {employee && (
              <ThemedText style={styles.subtitle}>
                {employee.name}
              </ThemedText>
            )}
          </ThemedView>

          {/* Loading State */}
          {isLoading && (
            <ThemedView style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <ThemedText style={styles.loadingText}>Cargando datos...</ThemedText>
            </ThemedView>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <ThemedView style={styles.errorContainer}>
              <ThemedText style={styles.errorText}>❌ {error}</ThemedText>
              <TouchableOpacity style={styles.retryButton} onPress={fetchLunchTimeData}>
                <ThemedText style={styles.retryButtonText}>Reintentar</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          )}

          {/* Data Display */}
          {lunchTimeData && !isLoading && (
            <>
              {/* Timer Section */}
              <ThemedView style={styles.timerSection}>
                <ThemedView style={styles.timerCard}>
                  {!timerRunning ? (
                    <>
                      <ThemedText style={styles.timerLabel}>
                        Tiempo disponible: {formatMinutes(lunchTimeData.minutos)}
                      </ThemedText>
                      <ThemedView style={styles.timerButtonRow}>
                        <TouchableOpacity
                          style={styles.startButton}
                          onPress={handleStartTimer}
                        >
                          <ThemedText style={styles.buttonTextWhite}>▶ Iniciar</ThemedText>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.manualButton}
                          onPress={handleOpenManualModal}
                        >
                          <ThemedText style={styles.buttonTextWhite}>✏️ Manual</ThemedText>
                        </TouchableOpacity>
                      </ThemedView>
                    </>
                  ) : (
                    <>
                      <ThemedText style={styles.timerDisplay}>
                        {formatTime(remainingSeconds)}
                      </ThemedText>
                      
                      {!timerPaused ? (
                        <TouchableOpacity
                          style={styles.pauseButton}
                          onPress={handlePauseTimer}
                        >
                          <ThemedText style={styles.buttonTextWhite}>⏸ Pausa</ThemedText>
                        </TouchableOpacity>
                      ) : (
                        <ThemedView style={styles.pauseControls}>
                          <ThemedText style={styles.pauseLabel}>En pausa</ThemedText>
                          <TextInput
                            style={styles.reasonInput}
                            placeholder="Razón de la pausa (opcional)"
                            placeholderTextColor="#999"
                            value={pauseReason}
                            onChangeText={setPauseReason}
                          />
                          <TouchableOpacity
                            style={styles.resumeButton}
                            onPress={handleResumeTimer}
                          >
                            <ThemedText style={styles.buttonTextWhite}>▶ Reanudar</ThemedText>
                          </TouchableOpacity>
                        </ThemedView>
                      )}

                      {/* Pausas List */}
                      {pausas.length > 0 && (
                        <ThemedView style={styles.pausasListSection}>
                          <ThemedText style={styles.pausasListTitle}>Pausas registradas:</ThemedText>
                          {pausas.map((pausa, index) => (
                            <ThemedView key={index} style={styles.pausaListItem}>
                              <ThemedText style={styles.pausaListText}>
                                {pausa.inicio.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} 
                                {' → '}
                                {pausa.fin.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                              </ThemedText>
                              <ThemedText style={styles.pausaListRazon}>{pausa.razon}</ThemedText>
                            </ThemedView>
                          ))}
                        </ThemedView>
                      )}
                    </>
                  )}
                </ThemedView>
              </ThemedView>

              {/* Hours List */}
              <ThemedView style={styles.section}>
                <ThemedText type="subtitle" style={styles.sectionTitle}>
                  Registro de Horas
                </ThemedText>
                
                {lunchTimeData.horas.length === 0 ? (
                  <ThemedView style={styles.emptyContainer}>
                    <ThemedText style={styles.emptyText}>
                      No hay registros de horas disponibles
                    </ThemedText>
                  </ThemedView>
                ) : (
                  lunchTimeData.horas.map((hora, index) => (
                    <ThemedView key={index} style={styles.horaCard}>
                      <ThemedView style={styles.horaHeader}>
                        <ThemedText style={styles.horaTitle}>
                          Registro #{index + 1}
                        </ThemedText>
                        {hora.es_manual && (
                          <ThemedView style={styles.manualBadge}>
                            <ThemedText style={styles.manualBadgeText}>Manual</ThemedText>
                          </ThemedView>
                        )}
                      </ThemedView>

                      <ThemedView style={styles.horaInfo}>
                        <ThemedView style={styles.infoRow}>
                          <ThemedText style={styles.infoLabel}>Inicio:</ThemedText>
                          <ThemedText style={styles.infoValue}>
                            {formatDate(hora.inicio)}
                          </ThemedText>
                        </ThemedView>
                        <ThemedView style={styles.infoRow}>
                          <ThemedText style={styles.infoLabel}>Fin:</ThemedText>
                          <ThemedText style={styles.infoValue}>
                            {formatDate(hora.fin)}
                          </ThemedText>
                        </ThemedView>
                      </ThemedView>

                      {/* Pausas */}
                      {hora.pausas.length > 0 && (
                        <ThemedView style={styles.pausasSection}>
                          <ThemedText style={styles.pausasTitle}>Pausas:</ThemedText>
                          {hora.pausas.map((pausa, pausaIndex) => (
                            <ThemedView key={pausaIndex} style={styles.pausaCard}>
                              <ThemedText style={styles.pausaRazon}>
                                {pausa.razon}
                              </ThemedText>
                              <ThemedView style={styles.pausaTime}>
                                <ThemedText style={styles.pausaTimeText}>
                                  {formatDate(pausa.inicio)}
                                </ThemedText>
                                <ThemedText style={styles.pausaTimeText}>→</ThemedText>
                                <ThemedText style={styles.pausaTimeText}>
                                  {formatDate(pausa.fin)}
                                </ThemedText>
                              </ThemedView>
                            </ThemedView>
                          ))}
                        </ThemedView>
                      )}
                    </ThemedView>
                  ))
                )}
              </ThemedView>
            </>
          )}
        </ThemedView>
      </ScrollView>

      <AppFooter />

      <SlideMenu
        isVisible={isMenuVisible}
        onClose={handleMenuClose}
        onHomePress={handleHomePress}
        currentRoute="lunch-time"
      />

      {/* Manual Entry Modal */}
      <Modal
        visible={showManualModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowManualModal(false)}
      >
        <ThemedView style={styles.modalOverlay}>
          <ThemedView style={styles.modalContainer}>
            <ScrollView>
              <ThemedText type="title" style={styles.modalTitle}>
                Registro Manual
              </ThemedText>

              {/* Date Display */}
              <ThemedText style={styles.modalLabel}>
                Fecha: {new Date().toLocaleDateString('es-ES')}
              </ThemedText>

              {/* Start Time Input */}
              <ThemedText style={styles.modalLabel}>Hora de inicio:</ThemedText>
              <TextInput
                style={styles.timeInput}
                value={manualStartTime}
                onChangeText={setManualStartTime}
                placeholder="HH:MM"
                placeholderTextColor="#999"
              />

              {/* End Time Display (calculated) */}
              {manualStartTime && lunchTimeData && (
                <ThemedText style={styles.modalInfo}>
                  Hora de fin (calculada): {(() => {
                    try {
                      const [hour, min] = manualStartTime.split(':').map(Number);
                      const start = new Date();
                      start.setHours(hour, min, 0, 0);
                      
                      // Calculate total pause duration
                      const totalPauseDuration = calculateTotalPauseDuration(manualPausas);
                      
                      // Add lunch time minutes plus pause duration
                      const end = new Date(start.getTime() + (lunchTimeData.minutos + totalPauseDuration) * 60000);
                      return end.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                    } catch {
                      return '--:--';
                    }
                  })()}
                </ThemedText>
              )}

              {/* Pausas Form */}
              <ThemedView style={styles.pausasFormSection}>
                <ThemedText type="subtitle" style={styles.pausasFormTitle}>
                  Agregar Pausas
                </ThemedText>

                <ThemedText style={styles.modalLabel}>Inicio de pausa:</ThemedText>
                <TextInput
                  style={styles.timeInput}
                  value={manualPausaInicio}
                  onChangeText={setManualPausaInicio}
                  placeholder="HH:MM"
                  placeholderTextColor="#999"
                />

                <ThemedText style={styles.modalLabel}>Fin de pausa:</ThemedText>
                <TextInput
                  style={styles.timeInput}
                  value={manualPausaFin}
                  onChangeText={setManualPausaFin}
                  placeholder="HH:MM"
                  placeholderTextColor="#999"
                />

                <ThemedText style={styles.modalLabel}>Razón:</ThemedText>
                <TextInput
                  style={styles.reasonInput}
                  value={manualPausaRazon}
                  onChangeText={setManualPausaRazon}
                  placeholder="Razón de la pausa (opcional)"
                  placeholderTextColor="#999"
                />

                <TouchableOpacity
                  style={styles.addPausaButton}
                  onPress={handleAddManualPausa}
                >
                  <ThemedText style={styles.buttonTextWhite}>+ Agregar Pausa</ThemedText>
                </TouchableOpacity>
              </ThemedView>

              {/* Manual Pausas List */}
              {manualPausas.length > 0 && (
                <ThemedView style={styles.manualPausasList}>
                  <ThemedText style={styles.pausasListTitle}>Pausas agregadas:</ThemedText>
                  {manualPausas.map((pausa, index) => (
                    <ThemedView key={index} style={styles.manualPausaItem}>
                      <ThemedView style={styles.manualPausaInfo}>
                        <ThemedText style={styles.pausaListText}>
                          {pausa.inicio} → {pausa.fin}
                        </ThemedText>
                        <ThemedText style={styles.pausaListRazon}>{pausa.razon}</ThemedText>
                      </ThemedView>
                      <TouchableOpacity
                        onPress={() => handleRemoveManualPausa(index)}
                        style={styles.removePausaButton}
                      >
                        <ThemedText style={styles.removePausaText}>✕</ThemedText>
                      </TouchableOpacity>
                    </ThemedView>
                  ))}
                </ThemedView>
              )}

              {/* Modal Buttons */}
              <ThemedView style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => setShowManualModal(false)}
                >
                  <ThemedText style={styles.buttonTextDark}>Cancelar</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalConfirmButton}
                  onPress={handleConfirmManualEntry}
                >
                  <ThemedText style={styles.buttonTextWhite}>Confirmar</ThemedText>
                </TouchableOpacity>
              </ThemedView>
            </ScrollView>
          </ThemedView>
        </ThemedView>
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
    padding: 20,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
    fontSize: 16,
    opacity: 0.7,
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    opacity: 0.7,
  },
  errorContainer: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    marginTop: 20,
  },
  errorText: {
    color: '#C62828',
    textAlign: 'center',
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#E3F2FD',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    opacity: 0.7,
  },
  totalMinutes: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    opacity: 0.6,
  },
  section: {
    marginTop: 10,
  },
  sectionTitle: {
    marginBottom: 16,
    fontSize: 20,
    fontWeight: 'bold',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    opacity: 0.5,
    textAlign: 'center',
  },
  horaCard: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    backgroundColor: '#FAFAFA',
  },
  horaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#FAFAFA',
  },
  horaTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  manualBadge: {
    backgroundColor: '#FFA726',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  manualBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  horaInfo: {
    gap: 1,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.7,
    color: '#000000'
  },
  infoValue: {
    fontSize: 14,
    color: '#000000'
  },
  pausasSection: {
    marginTop: 10,
    borderTopColor: '#E0E0E0',
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    padding: 8,
  },
  pausasTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#000000'
  },
  pausaCard: {
    backgroundColor: '#F57C00',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  pausaRazon: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  pausaTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F57C00',
  },
  pausaTimeText: {
    fontSize: 12,
    opacity: 0.7,
  },
  // Timer styles
  timerSection: {
    marginBottom: 20,
  },
  timerCard: {
    backgroundColor: '#E8F5E9',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  timerLabel: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
    color: '#7DBA7E',
  },
  timerButtonRow: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#E8F5E9'
  },
  startButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  manualButton: {
    backgroundColor: '#FF9800',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  pauseButton: {
    backgroundColor: '#FFC107',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
    minWidth: 150,
    alignItems: 'center',
  },
  resumeButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 12,
    alignItems: 'center',
  },
  timerDisplay: {
    fontSize: 56,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 8,
    textAlignVertical: 'center',
    height: 45,
  },
  pauseControls: {
    width: '100%',
    alignItems: 'center',
    marginTop: 16,
    backgroundColor: '#E8F5E9'
  },
  pauseLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F57C00',
    marginBottom: 12,
  },
  reasonInput: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#000000',
  },
  buttonTextWhite: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonTextDark: {
    color: '#333333',
    fontSize: 16,
    fontWeight: '600',
  },
  pausasListSection: {
    width: '100%',
    marginTop: 20,
    padding: 12,
    backgroundColor: '#FFF9C4',
    borderRadius: 8,
  },
  pausasListTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#F57C00',
  },
  pausaListItem: {
    padding: 8,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#FFA54F',
    backgroundColor: '#FFA54F',
    borderRadius: 8,
  },
  pausaListText: {
    fontSize: 14,
    fontWeight: '500',
    backgroundColor: '#F57C00',
  },
  pausaListRazon: {
    fontSize: 12,
    backgroundColor: '#F57C00',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    textAlign: 'center',
    marginBottom: 20,
    color: '#000000'
  },
  modalLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 6,
    color: '#333333',
  },
  modalInfo: {
    fontSize: 14,
    color: '#666666',
    marginTop: 8,
    marginBottom: 12,
  },
  timeInput: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000000',
  },
  pausasFormSection: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
  },
  pausasFormTitle: {
    marginBottom: 12,
    color: '#000000'
  },
  addPausaButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 12,
    alignItems: 'center',
  },
  manualPausasList: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
  },
  manualPausaItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#F57C00',
    borderRadius: 6,
  },
  manualPausaInfo: {
    flex: 1,
  },
  removePausaButton: {
    backgroundColor: '#F44336',
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  removePausaText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    gap: 12,
    backgroundColor: '#FAFAFA'
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#E0E0E0',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalConfirmButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
});
