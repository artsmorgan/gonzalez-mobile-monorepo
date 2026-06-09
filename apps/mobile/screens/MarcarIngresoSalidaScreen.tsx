import AppHeader from '../components/AppHeader';
import AppFooter from '../components/AppFooter';
import SlideMenu from '../components/SlideMenu';
import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import { Collapsible } from '../components/Collapsible';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ActivityIndicator, Alert, StyleSheet, TouchableOpacity, ScrollView, Modal, TextInput, View } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import { format, toZonedTime } from 'date-fns-tz';
import * as Network from 'expo-network';
import { formatDateDMY } from '../utils/formatDate';
import saveMarca from '@/hooks/saveMarca';
import saveAbsentReason from '@/hooks/saveAbsentReason';
import updateNomenclator from '@/hooks/updateNomenclator';
import revertAttendanceLeaving from '@/hooks/revertAttendanceLeaving';
import {
  appendAttendanceAction,
  readAttendanceActions,
  removePendingSalidaActionsForMarca,
} from '@/hooks/attendanceActionsStorage';
import {
  computeChangeAvailable,
  evaluateLocalMarcaRules,
  validateMarcaLocation,
} from '@/hooks/attendanceLocalMarcaValidation';
import getHoraAccion from '@/hooks/getHoraAccion';
import resolveMarcaIngresoCoordinates from '@/hooks/resolveMarcaIngresoCoordinates';
import { eventBus } from '@/hooks/eventBus';
import authedFetch from '@/hooks/authedFetch';
import { deleteAllFiles } from '@/hooks/fileStorage';
import { mergeJobManualsCacheForPuesto } from '@/hooks/jobManualsCacheHelpers';
import { getIncidentsCache, mergeIncidentsCacheForCorpo, setIncidentsCache } from '@/hooks/incidentsStorage';
import { mergeLlavesCacheForCorpo } from '@/hooks/llavesCacheHelpers';
import { mergeLlaverosCacheForCorpo } from '@/hooks/llaverosCacheHelpers';
import {
  mergeNotesBase64FromCache,
  mergeNotesCacheForPuesto,
  parseNotesCache,
} from '@/hooks/notesCacheHelpers';
import { mergeCorporateVehiclesCorpoCacheForSucursal } from '@/hooks/corporateVehiclesCorpoCache';
import { getVehicleVisitasCorpoId, syncVehiclesVisitasCacheFromNetwork } from '@/hooks/vehiclesVisitasCacheHelpers';
import { syncVisitorsCacheFromNetwork } from '@/hooks/visitorsCacheHelpers';
import {
  MAIN_STRUCTURE_FRAG_ASYNC_PREFIX,
  MAIN_STRUCTURE_SWEEP_PRESERVE_ASYNC_KEYS,
  persistMainStructureFragments,
} from '@/hooks/mainStructureFragmentsStorage';
import { loadMainStructureTreeMerged } from '@/hooks/bitacoraMainStructureCache';
import { writeMainStructureCacheString } from '@/hooks/mainStructureCacheStorage';

type MarcarIngresoSalidaScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'MarcarIngresoSalida'>;

interface AttendanceSuccessResponse {
  estado: 'Ingresado' | 'No ingresado';
  is_late: boolean;
  current_time: string;
  change_available: boolean;
  next_time: string;
  marca: {
    id: number;
    hora_entrada_digitada: string | null;
    hora_salida_digitada: string | null;
    // Recibido desde el endpoint de asistencia (necesario para flujos que dependen del empleado fijo).
    empleadoFijo_id?: number | null;
    hora_inicio: string;
    hora_fin: string;
    fecha: string;
    tipo_turno: string;
    horas_duracion: number;
    roleDivision: {
      role: {
        id: number;
        nombre: string;
      };
      division: {
        id: number;
        nombre: string;
      };
    }
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
      ubicacion: {
        lat: number | null;
        lng: number | null;
      };
    };
    plaza: {
      id: number;
      nombre: string;
    };
    horario: {
      id: number;
      nombre: string;
    };
  };
}

interface AttendanceErrorResponse {
  status: false;
  message: string;
  absent?: boolean;
  should_response?: boolean;
  marca_id?: number;
  mark_blocked?: boolean;
  current_time?: number;
  marca?: AttendanceSuccessResponse['marca'];
}

type AttendanceResponse = AttendanceSuccessResponse | AttendanceErrorResponse;

/** Evalúa conexión a internet con el mismo criterio en toda esta pantalla. */
async function evaluateInternetConnection(): Promise<boolean> {
  //return false;
  const networkState = await Network.getNetworkStateAsync();

  return (
    networkState.isConnected === true &&
    networkState.isInternetReachable === true
  );
}

export default function MarcarIngresoSalidaScreen() {
  const { isAuthenticated, isLoading, employee, refreshAccessToken, logout } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [attendanceData, setAttendanceData] = useState<AttendanceSuccessResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isProcessingMark, setIsProcessingMark] = useState(false);
  const [processingType, setProcessingType] = useState<'entrada' | 'salida' | null>(null);
  const [revertMarcaId, setRevertMarcaId] = useState<number | null>(null);
  const [absentMarcaId, setAbsentMarcaId] = useState<number | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [exitReason, setExitReason] = useState('');
  const [showAbsentReasonForm, setShowAbsentReasonForm] = useState(false);
  const [shouldResponseAbsentReason, setShouldResponseAbsentReason] = useState(false);
  const [absentReason, setAbsentReason] = useState('');
  const [isSubmittingAbsentReason, setIsSubmittingAbsentReason] = useState(false);
  /** Bloqueo por validación local (ausencia, salida marcada, etc.). */
  const [markingBlocked, setMarkingBlocked] = useState(false);
  const [localCanMarkEntrada, setLocalCanMarkEntrada] = useState(true);
  const [localCanMarkSalida, setLocalCanMarkSalida] = useState(true);
  /** Aviso de ubicación para ingreso: mostrar botón Reintentar comprobación GPS. */
  const [showEntradaLocationRetry, setShowEntradaLocationRetry] = useState(false);
  const [isRefreshingEntradaLocation, setIsRefreshingEntradaLocation] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navigation = useNavigation<MarcarIngresoSalidaScreenNavigationProp>();
  const [horaAccion, setHoraAccion] = useState<number | null>(null);
  const [isMarksModalVisible, setIsMarksModalVisible] = useState(false);
  const [futureMarks, setFutureMarks] = useState<any[]>([]);
  const [isLoadingFutureMarks, setIsLoadingFutureMarks] = useState(false);
  const hasRequestedInitialFetchRef = useRef(false);
  /** Aviso informativo entrada (cerrable), mismo patrón que ChecklistSupervisionScreen. */
  const [isEntradaMarcaHintVisible, setIsEntradaMarcaHintVisible] = useState(true);
  /** Re-render del reloj cuando no hay `attendanceData` (hora local CR como respaldo). */
  const [clockTick, setClockTick] = useState(0);
  useEffect(() => {
    const handler = () => {
      fetchAttendanceStatus();
    };

    eventBus.on('connectionRestored', handler);
    return () => {
      eventBus.off('connectionRestored', handler);
    };
  }, []);

  useEffect(() => {
    // Redirect to login if not authenticated
    if (!isLoading && !isAuthenticated) {
      navigation.replace('Home');
    }
  }, [isAuthenticated, isLoading, navigation]);

  // Fetch inicial del estado de asistencia
  useEffect(() => {
    if (!isAuthenticated || !employee) {
      hasRequestedInitialFetchRef.current = false;
      return;
    }

    if (isProcessingMark) return;

    if (!hasRequestedInitialFetchRef.current) {
      hasRequestedInitialFetchRef.current = true;
      fetchAttendanceStatus();
    }
  }, [isAuthenticated, employee, isProcessingMark, isLoadingData, attendanceData]);

  // Polling cada 30 segundos:
  // - se detiene cuando inicia carga (isLoadingData=true)
  // - se reactiva cuando ya hay marca en pantalla (attendanceData disponible)
  useEffect(() => {
    if (isAuthenticated && employee && !isProcessingMark && !isLoadingData && !!attendanceData) {
      // Limpiar cualquier intervalo previo
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      // Intervalo cada 30 segundos
      intervalRef.current = setInterval(() => {
        fetchAttendanceStatus();
      }, 30000);

      // Cleanup
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }

    // Si se está procesando una marca, limpiar intervalo
    if ((isProcessingMark || isLoadingData || !attendanceData) && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [isAuthenticated, employee, isProcessingMark, isLoadingData, attendanceData]);

  useEffect(() => {
    if (attendanceData) return;
    const id = setInterval(() => setClockTick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, [attendanceData]);

  const applyLocalValidationState = (
    validation: ReturnType<typeof evaluateLocalMarcaRules>,
    marcaId: number | null
  ) => {
    setMarkingBlocked(validation.markingBlocked);
    if (validation.message) {
      setErrorMessage(validation.message);
    } else if (!validation.markingBlocked) {
      setErrorMessage(null);
    }

    if (validation.absent) {
      setAbsentMarcaId(marcaId);
      setShouldResponseAbsentReason(validation.should_response === true);
      setShowAbsentReasonForm(validation.should_response === true);
      setRevertMarcaId(null);
      setShowEntradaLocationRetry(false);
    } else {
      setAbsentMarcaId(null);
      if (!validation.should_response) {
        setShouldResponseAbsentReason(false);
        setShowAbsentReasonForm(false);
      }
      if (validation.revertMarcaId != null) {
        setRevertMarcaId(validation.revertMarcaId);
      } else if (!validation.markingBlocked) {
        setRevertMarcaId(null);
      }
    }

    if (validation.revertMarcaId != null && !validation.absent) {
      setRevertMarcaId(validation.revertMarcaId);
    }

    setLocalCanMarkEntrada(validation.canMarkEntrada);
    setLocalCanMarkSalida(validation.canMarkSalida);
  };

  const runLocalValidationForMarca = async (
    marca: Record<string, unknown>,
    nowMs: number,
    opts?: { validateLocationForEntrada?: boolean; lat?: number | null; lng?: number | null }
  ) => {
    const pendingActions = await readAttendanceActions();
    const mid = marca.id != null ? Number(marca.id) : NaN;
    const pendingAbsentReason =
      Number.isFinite(mid) &&
      mid > 0 &&
      pendingActions.some((a) => a.type === 'absent_reason' && Number(a.marcaId) === mid);

    return evaluateLocalMarcaRules(marca, nowMs, {
      pendingAbsentReason,
      lat: opts?.lat ?? null,
      lng: opts?.lng ?? null,
      validateLocationForEntrada: opts?.validateLocationForEntrada ?? false,
    });
  };

  /** Revalida reglas locales (incl. ausencia por hora de entrada) usando getHoraAccion. */
  const revalidateLocalMarcaOffline = useCallback(
    async (marca: Record<string, unknown>, marcaId: number | null) => {
      const nowMs = await getHoraAccion();
      setHoraAccion(nowMs);

      const marcaWithTime: Record<string, unknown> = { ...marca, current_time: nowMs };
      await setCurrentAttendanceData(marcaWithTime, nowMs);

      const validation = await runLocalValidationForMarca(marcaWithTime, nowMs, {
        validateLocationForEntrada: false,
      });
      applyLocalValidationState(validation, marcaId);

      const pendingActions = await readAttendanceActions();
      const mid = marcaId ?? NaN;
      const hasPendingAbsent =
        Number.isFinite(mid) &&
        pendingActions.some((a) => a.type === 'absent_reason' && Number(a.marcaId) === mid);
      if (hasPendingAbsent && validation.absent) {
        setShowAbsentReasonForm(false);
        setShouldResponseAbsentReason(false);
        setErrorMessage(
          (validation.message || '') +
            ' Motivo de ausencia guardado localmente; se sincronizará al conectar.'
        );
      }

      await AsyncStorage.setItem('current_marca', JSON.stringify(marcaWithTime));
      return { nowMs, validation };
    },
    []
  );

  /** Si la marca permite marcar ingreso (horario), exige GPS activo y radio de 50 m del puesto. */
  const refreshEntradaLocationEligibility = async (
    marca: Record<string, unknown>,
    nowMs: number,
    opts?: { silent?: boolean }
  ) => {
    const silent = opts?.silent !== false;
    const estado = marca.hora_entrada_digitada != null ? 'Ingresado' : 'No ingresado';
    if (estado !== 'No ingresado' || !computeChangeAvailable(marca, nowMs)) {
      setShowEntradaLocationRetry(false);
      return;
    }

    const timeValidation = await runLocalValidationForMarca(marca, nowMs, {
      validateLocationForEntrada: false,
    });

    if (
      timeValidation.absent ||
      timeValidation.markingBlocked ||
      !timeValidation.canMarkEntrada
    ) {
      setShowEntradaLocationRetry(false);
      return;
    }

    const coords = await resolveMarcaIngresoCoordinates({ silent });
    if (!coords.ok) {
      setLocalCanMarkEntrada(false);
      setErrorMessage(coords.message);
      setShowEntradaLocationRetry(true);
      return;
    }

    const loc = validateMarcaLocation(marca, coords.latitude, coords.longitude);
    if (!loc.ok) {
      setLocalCanMarkEntrada(false);
      setErrorMessage(loc.message);
      setShowEntradaLocationRetry(true);
      return;
    }

    setLocalCanMarkEntrada(true);
    setShowEntradaLocationRetry(false);
    if (!timeValidation.message) {
      setErrorMessage(null);
    }
  };

  const handleRetryEntradaLocationCheck = async () => {
    if (!attendanceData?.marca || isRefreshingEntradaLocation) return;
    setIsRefreshingEntradaLocation(true);
    try {
      const nowMs = await getHoraAccion();
      setHoraAccion(nowMs);
      await refreshEntradaLocationEligibility(
        attendanceData.marca as Record<string, unknown>,
        nowMs,
        { silent: false }
      );
    } finally {
      setIsRefreshingEntradaLocation(false);
    }
  };

  const resolveMarcaPayloadFromBlockedError = async (
    errorData: AttendanceErrorResponse,
    horaAccionValue: number
  ): Promise<Record<string, unknown> | null> => {
    if (errorData.marca && typeof errorData.marca === 'object') {
      const m = { ...errorData.marca } as Record<string, unknown>;
      m.current_time = errorData.current_time ?? horaAccionValue ?? Date.now();
      return m;
    }
    if (errorData.marca_id != null) {
      const cacheStr = await AsyncStorage.getItem('current_marca');
      const cachedMarca = cacheStr ? JSON.parse(cacheStr) : null;
      if (cachedMarca && Number(cachedMarca.id) === Number(errorData.marca_id)) {
        cachedMarca.current_time = errorData.current_time ?? horaAccionValue ?? Date.now();
        return cachedMarca;
      }
    }
    return null;
  };

  const presentBlockedMarcaFromError = async (
    errorData: AttendanceErrorResponse,
    horaAccionValue: number
  ): Promise<boolean> => {
    const marcaPayload = await resolveMarcaPayloadFromBlockedError(errorData, horaAccionValue);
    if (!marcaPayload) return false;

    const nowMs = Number(marcaPayload.current_time) || horaAccionValue || Date.now();
    await AsyncStorage.setItem('current_marca', JSON.stringify(marcaPayload));
    await setCurrentAttendanceData(marcaPayload, nowMs);

    const validation = await runLocalValidationForMarca(marcaPayload, nowMs, {
      validateLocationForEntrada: false,
    });
    applyLocalValidationState(
      validation,
      marcaPayload.id != null ? Number(marcaPayload.id) : null
    );

    if (errorData.absent === true) {
      setAbsentMarcaId(errorData.marca_id ?? (marcaPayload.id != null ? Number(marcaPayload.id) : null));
      setShouldResponseAbsentReason(errorData.should_response === true);
      setShowAbsentReasonForm(errorData.should_response === true);
    } else {
      setShouldResponseAbsentReason(false);
      if (errorData.absent === false && errorData.marca_id != null) {
        setRevertMarcaId(errorData.marca_id);
      }
    }

    if (errorData.mark_blocked || errorData.absent != null || errorData.marca_id != null) {
      setMarkingBlocked(true);
      setLocalCanMarkEntrada(false);
      setLocalCanMarkSalida(false);
    }

    setErrorMessage(errorData.message);
    return true;
  };

  // Sin internet: revalidar ausencia y hora de acción periódicamente en dispositivo.
  useEffect(() => {
    if (!isAuthenticated || !employee || !attendanceData?.marca || isProcessingMark || isLoadingData) {
      return;
    }

    let cancelled = false;

    const tick = async () => {
      if (cancelled || isProcessingMark || isLoadingData) return;
      const online = await evaluateInternetConnection();
      if (online) return;

      const marca = attendanceData.marca as Record<string, unknown>;
      await revalidateLocalMarcaOffline(
        marca,
        marca.id != null ? Number(marca.id) : null
      );
    };

    const id = setInterval(tick, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [
    isAuthenticated,
    employee,
    attendanceData?.marca?.id,
    isProcessingMark,
    isLoadingData,
    revalidateLocalMarcaOffline,
  ]);

  // Cuando se puede marcar ingreso: revalidar GPS y radio de 50 m (sin bloquear la descarga de la marca).
  useEffect(() => {
    if (!attendanceData?.marca || isProcessingMark || isLoadingData) return;
    if (attendanceData.estado !== 'No ingresado') return;

    let cancelled = false;

    const tick = async () => {
      if (cancelled || isProcessingMark || isLoadingData) return;
      const nowMs = await getHoraAccion();
      setHoraAccion(nowMs);
      await refreshEntradaLocationEligibility(
        attendanceData.marca as Record<string, unknown>,
        nowMs
      );
    };

    void tick();
    const id = setInterval(tick, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [
    attendanceData?.marca?.id,
    attendanceData?.estado,
    attendanceData?.change_available,
    isProcessingMark,
    isLoadingData,
  ]);

  const fetchAttendanceStatus = async () => {
    try {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      const horaAccionValue = await getHoraAccion();
      if (horaAccionValue) {
        setHoraAccion(horaAccionValue);
      }

      const online = await evaluateInternetConnection();

      if (!online) {
        if (!employee?.id) {
          setErrorMessage('No se encontró el empleado');
          return;
        }
        setIsLoadingData(true);
        setErrorMessage(null);

        const cache = await AsyncStorage.getItem('current_marca');
        if (!cache || cache.trim() === '') {
          setAttendanceData(null);
          setMarkingBlocked(false);
          setErrorMessage(
            'Sin conexión. No hay marca guardada en caché; conéctate o marca ingreso con red en este dispositivo.'
          );
          setIsLoadingData(false);
          return;
        }

        try {
          const marca_send = JSON.parse(cache);
          const { nowMs } = await revalidateLocalMarcaOffline(
            marca_send,
            marca_send.id != null ? Number(marca_send.id) : null
          );
          await refreshEntradaLocationEligibility(marca_send, nowMs);
        } catch (e) {
          console.error(e);
          setAttendanceData(null);
          setMarkingBlocked(false);
          setErrorMessage('Error al cargar la marca guardada.');
        } finally {
          setIsLoadingData(false);
        }
        return;
      }

      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) {
        throw new Error('Server URL not configured');
      }

      if (!employee?.id) {
        throw new Error('Employee ID not found');
      }

      setIsLoadingData(true);
      setErrorMessage(null);
      setAttendanceData(null);

      let marca_send = null;
      let result = null;
      let data = null;

      let shouldUpdateData = false;

      const response = await authedFetch({
        url: `${apiUrl}/api/attendance/user/${employee.id}`,
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

      data = await response.json();

      console.log('Response got from the server', data);

      result = data.status;

      console.log('Result', data.marca);

      if (result) {
        marca_send = data.marca;

        const server_time = await AsyncStorage.getItem('server_time');
        if (!server_time) {
          throw new Error('Server time not found');
        }
        const server_time_obj = JSON.parse(server_time);
        marca_send.current_time = parseInt(server_time_obj.server_time, 10);

        const cache = await AsyncStorage.getItem('current_marca');
        if (cache) {
          try {
            const marca_cache = JSON.parse(cache);
            if (marca_cache.id !== marca_send.id) {
              await AsyncStorage.removeItem('current_marca');
            }
          } catch {
            /* ignore */
          }
        }

        const current_marca_before = await AsyncStorage.getItem('current_marca');
        if (
          marca_send.hora_entrada_digitada != null &&
          marca_send.hora_salida_digitada == null &&
          (!current_marca_before || current_marca_before.trim() === '')
        ) {
          shouldUpdateData = true;
        }
        await AsyncStorage.setItem('current_marca', JSON.stringify(marca_send));
      }

      if (result) {
        setMarkingBlocked(false);
        setRevertMarcaId(null);
        await setCurrentAttendanceData(marca_send, horaAccionValue || Date.now());

        const validation = await runLocalValidationForMarca(marca_send, horaAccionValue || Date.now(), {
          validateLocationForEntrada: false,
        });
        applyLocalValidationState(validation, marca_send.id != null ? Number(marca_send.id) : null);
        await refreshEntradaLocationEligibility(
          marca_send as Record<string, unknown>,
          horaAccionValue || Date.now()
        );

        console.log("shouldUpdateData", shouldUpdateData);
        if (shouldUpdateData && marca_send) {
          // Mostrar el mismo loader y mensaje de espera que al marcar entrada manualmente
          setIsProcessingMark(true);
          setProcessingType('entrada');
          try {
            let horaAccion = marca_send.hora_entrada_digitada ? new Date(marca_send.hora_entrada_digitada).getTime() : await getHoraAccion() as number;
            await hydrateAfterEntrada(marca_send, horaAccion, false);
          } finally {
            setIsProcessingMark(false);
            setProcessingType(null);
          }
        }
      } else {
        const errorData = data as AttendanceErrorResponse;
        const presented = await presentBlockedMarcaFromError(
          errorData,
          horaAccionValue || Date.now()
        );
        if (!presented) {
          if (errorData.absent === false && errorData.marca_id != null) {
            setRevertMarcaId(errorData.marca_id);
            setMarkingBlocked(true);
            setLocalCanMarkEntrada(false);
            setLocalCanMarkSalida(false);
          }
          setShouldResponseAbsentReason(false);
          setErrorMessage(errorData.message);
        }
      }
    } catch (error) {
      console.error('Error fetching attendance status:', error);
      setErrorMessage('Error al cargar los datos. Por favor, intenta nuevamente.');
    } finally {
      setIsLoadingData(false);
    }
  };

  const setCurrentAttendanceData = async (data: any, horaAccionValue: number) => {
    const marca = data;

    const fecha = marca.fecha.split('-');
    fecha[2] = fecha[2].slice(0, 2);

    const estado = marca.hora_entrada_digitada != null ? "Ingresado" : "No ingresado";

    let next_time = toZonedTime(new Date(estado == "No ingresado" ? marca.hora_inicio : marca.hora_fin), "America/Costa_Rica");
    next_time.setFullYear(parseInt(fecha[0]), parseInt(fecha[1]) - 1, marca.hora_inicio > marca.hora_fin ? parseInt(fecha[2]) + 1 : parseInt(fecha[2]));

    let next_change_time = new Date(next_time.getTime());
    next_change_time.setFullYear(parseInt(fecha[0]), parseInt(fecha[1]) - 1, marca.hora_inicio > marca.hora_fin ? parseInt(fecha[2]) + 1 : parseInt(fecha[2]));
    next_change_time.setMinutes(next_change_time.getMinutes() - 15);

    let change_available = true;
    let is_late = false;

    const now = horaAccionValue;

    if (estado == "No ingresado") {
      if (now < next_change_time.getTime()) { // Si la fecha del parámetro es menor a la fecha de la marca menos 15 menos minutos
        change_available = false;
      }
    }

    if (now > next_time.getTime()) {
      is_late = true;
    }

    const attendance_save = {
      estado: estado,
      is_late: is_late,
      change_available: change_available,
      next_time: next_time.toISOString(),
      current_time: toZonedTime(new Date(data.current_time), "America/Costa_Rica").toISOString(),
      marca: marca,
    } as AttendanceSuccessResponse;
    setAttendanceData(attendance_save);
  }

  const handleToggleAttendance = () => {
    if (!attendanceData) return;

    if (
      attendanceData.estado === 'Ingresado' &&
      attendanceData.marca?.hora_salida_digitada != null
    ) {
      Alert.alert('Información', 'Ya has marcado la salida.');
      return;
    }

    const action = attendanceData.estado === 'No ingresado' ? 'ingresar' : 'salir';
    const actionText = attendanceData.estado === 'No ingresado' ? 'Ingresar' : 'Salir';
    const actionExtraText = attendanceData.estado === 'No ingresado' ? '' : ' Si lo haces, no podrás acceder a la mayoría de las opciones del menú.';

    Alert.alert(
      'Confirmar acción',
      `¿Estás seguro de que deseas ${action}?${actionExtraText}`,
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: actionText,
          style: attendanceData.estado === 'Ingresado' ? 'destructive' : 'default',
          onPress: () => executeToggleAttendance(),
        },
      ],
      { cancelable: true }
    );
  };

  const validateBeforeMarkAction = async (
    type: 'entrada' | 'salida'
  ): Promise<{ ok: true } | { ok: false; message: string }> => {
    if (!attendanceData?.marca) {
      return { ok: false, message: 'No se encontró la marca.' };
    }

    const nowMs = await getHoraAccion();
    setHoraAccion(nowMs);

    let lat: number | null = null;
    let lng: number | null = null;

    if (type === 'entrada') {
      const coords = await resolveMarcaIngresoCoordinates();
      if (!coords.ok) {
        return { ok: false, message: '' };
      }
      lat = coords.latitude;
      lng = coords.longitude;
    }

    const validation = await runLocalValidationForMarca(
      attendanceData.marca as Record<string, unknown>,
      nowMs,
      {
        lat,
        lng,
        validateLocationForEntrada: type === 'entrada',
      }
    );

    applyLocalValidationState(
      validation,
      attendanceData.marca.id != null ? Number(attendanceData.marca.id) : null
    );

    if (validation.absent) {
      return {
        ok: false,
        message: validation.message || 'No has marcado la entrada para este turno.',
      };
    }

    if (type === 'entrada' && !validation.canMarkEntrada) {
      return {
        ok: false,
        message: validation.message || 'No puedes marcar entrada en este momento.',
      };
    }
    if (type === 'salida' && !validation.canMarkSalida) {
      return {
        ok: false,
        message: validation.message || 'No puedes marcar salida en este momento.',
      };
    }
    return { ok: true };
  };

  const executeToggleAttendance = async () => {
    if (!attendanceData) return;

    if (attendanceData.marca?.hora_salida_digitada != null) {
      Alert.alert('Información', 'Ya has marcado la salida.');
      return;
    }

    setIsUpdating(true);

    try {
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) {
        throw new Error('Server URL not configured');
      }

      if (!employee?.id) {
        throw new Error('Employee ID not found');
      }

      let type = 'entrada';
      if (attendanceData.estado !== 'No ingresado') {
        type = 'salida';

        if (!horaAccion) {
          throw new Error('Hora de acción not found');
        }
        const now = horaAccion;

        const fecha = attendanceData.marca.fecha.split('-');
        fecha[2] = fecha[2].slice(0, 2);

        let next_time = toZonedTime(new Date(attendanceData.marca.hora_fin), "America/Costa_Rica");
        next_time.setFullYear(parseInt(fecha[0]), parseInt(fecha[1]) - 1, attendanceData.marca.hora_inicio > attendanceData.marca.hora_fin ? parseInt(fecha[2]) + 1 : parseInt(fecha[2]));

        if (now < (next_time.getTime() - 15 * 60 * 1000)) {
          setIsModalVisible(true);
          return;
        }
      }

      confirmAction(type, '', false);
    } catch (error) {
      console.error('Error updating attendance:', error);
      Alert.alert('Error', 'No se pudo actualizar el estado de asistencia. Por favor, intenta nuevamente.');
    } finally {
      setIsUpdating(false);
    }
  };

  const hydrateAfterEntrada = async (marca: any, horaAccionValue: number, shouldRefreshStatus: boolean) => {
    try {
      await cleanAsyncStorage();

      try {
        await deleteAllFiles();
      } catch (fileErr) {
        console.warn('Error borrando archivos locales (expo-file-system) al ingresar:', fileErr);
      }

      const updatedMarca = {
        ...marca,
        hora_entrada_digitada: new Date(horaAccionValue).toISOString(),
      };

      await AsyncStorage.setItem('current_marca', JSON.stringify(updatedMarca));

      await AsyncStorage.multiRemove(['visitors_cache', 'vehicles_cache']);

      const shouldUpdateMainStructure = await shouldUpdateMainStructureCache();
      if (shouldUpdateMainStructure) {
        await getMainStructure();
      } else if (await evaluateInternetConnection()) {
        const tree = await loadMainStructureTreeMerged();
        if (!Array.isArray(tree) || tree.length === 0) {
          await getMainStructure();
        }
      }

      setAttendanceData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          estado: 'Ingresado',
          marca: updatedMarca,
        } as AttendanceSuccessResponse;
      });

      if (shouldRefreshStatus) {
        await fetchAttendanceStatus();
      }

      Promise.all([
        getLunchTimeConfig(updatedMarca.id),
        getActivities(updatedMarca.id),
      ]);

      await updateNomenclator(updatedMarca, refreshAccessToken, logout);
    } catch (storageError) {
      console.error('Error hydrating entrada context:', storageError);
    }
  };

  const confirmAction = async (type: string, reason: string, isUpdate: boolean) => {
    // Desactivar el polling mientras se procesa la marca
    setIsProcessingMark(true);
    setProcessingType(type === 'salida' ? 'salida' : 'entrada');
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!attendanceData || !attendanceData.marca || !attendanceData.marca.id) {
      throw new Error('No se encontró la marca');
    }

    if (!horaAccion) {
      throw new Error('Hora de acción not found');
    }

    let data = null;
    const markType = type === 'salida' ? 'salida' : 'entrada';
    const preCheck = await validateBeforeMarkAction(markType);
    if (!preCheck.ok) {
      setIsProcessingMark(false);
      setProcessingType(null);
      if (preCheck.message?.trim()) {
        Alert.alert('No permitido', preCheck.message);
      }
      return;
    }

    if (await evaluateInternetConnection()) {
      data = await saveMarca({
        data_params: { type, reason, horaAccion: horaAccion },
        marcaId: attendanceData.marca.id,
        refreshAccessToken,
        logout,
      });
    } else {
      if (type === 'salida') {
        await appendAttendanceAction({
          type: 'salida',
          marcaId: attendanceData.marca.id,
          reason: reason ?? '',
          horaAccion: horaAccion as number,
        });
        const rawMarca = await AsyncStorage.getItem('current_marca');
        if (rawMarca) {
          try {
            const m = JSON.parse(rawMarca);
            if (Number(m.id) === Number(attendanceData.marca.id)) {
              m.hora_salida_digitada = new Date(horaAccion as number).toISOString();
              await AsyncStorage.setItem('current_marca', JSON.stringify(m));
            }
          } catch {
            /* ignore */
          }
        }
        data = { status: true, message: 'Salida registrada localmente. Se sincronizará al recuperar conexión.' };
      } else {
        data = { status: false, message: 'No hay conexión a internet. Por favor, intenta nuevamente.' };
      }
    }

    if (data.status) {
      setRevertMarcaId(null);
      try {
        if (type === 'entrada') {
          if (attendanceData) {
            let horaAccion = attendanceData.marca.hora_entrada_digitada ? new Date(attendanceData.marca.hora_entrada_digitada).getTime() : await getHoraAccion() as number;
            await hydrateAfterEntrada(attendanceData.marca, horaAccion, true);
          }
        } else {
          const raw = await AsyncStorage.getItem('current_marca');
          if (raw) {
            try {
              const m = JSON.parse(raw);
              if (Number(m.id) === Number(attendanceData.marca.id)) {
                m.hora_salida_digitada = new Date(horaAccion as number).toISOString();
                await AsyncStorage.setItem('current_marca', JSON.stringify(m));
              }
            } catch {
              /* ignore */
            }
          }
          await fetchAttendanceStatus();
        }
      } catch (storageError) {
        console.error('Error with storage or status refresh:', storageError);
      }

      Alert.alert(
        'Éxito',
        type === 'entrada'
          ? 'Ingreso registrado correctamente'
          : 'Salida registrada correctamente'
      );
    } else {
      // Si el backend devuelve una marca específica para revertir, guardamos su ID
      if (data && typeof data.marca_id === 'number') {
        setRevertMarcaId(data.marca_id);
      }

      Alert.alert(
        'Error',
        data.message
      );
    }

    // Reactivar el polling después de completar el proceso (éxito o error)
    setIsProcessingMark(false);
    setProcessingType(null);
  };

  const cleanAsyncStorage = async () => { 
    try {
      const exceptions = [
        'access_token',
        'employee_data',
        'refresh_token',
        'token_created_at',
        'remembered_cedula',
        'server_time',
        'main_structure_created_at',
        'categories_cache',
        'tipo_activos_cache',
        'incidents_classifications_cache',
        'document_types_cache',
        'executives_cache',
        'puestos_corpo_cache',
        'categoria_mantenimiento_cache',
        'tipo_quejas_cache',
        'tipo_clientes_quejas_cache'
      ];
      const keys = await AsyncStorage.getAllKeys();

      const keysToDelete = keys.filter((key) => {
        if (exceptions.includes(key)) return false;
        if (key.startsWith(MAIN_STRUCTURE_FRAG_ASYNC_PREFIX)) return false;
        if (MAIN_STRUCTURE_SWEEP_PRESERVE_ASYNC_KEYS.includes(key)) return false;
        return true;
      });

      await AsyncStorage.multiRemove(keysToDelete);
    } catch (error) {
      console.error("Error limpiando AsyncStorage", error);
    }
  }

  const getLunchTimeConfig = async (marcaId: number) => {
    await AsyncStorage.removeItem('lunch_time_config');
    await AsyncStorage.setItem('alert_lunch_time', 'false');
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    const response = await authedFetch({
      url: `${apiUrl}/api/lunch-time/${marcaId}`,
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
    console.log("getLunchTimeConfig");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} getLunchTimeConfig`);
    }
    const data = await response.json();

    if (data.status) {
      await AsyncStorage.setItem('lunch_time_config', JSON.stringify(data));
      await AsyncStorage.setItem('alert_lunch_time', 'true');
    }
}

const getActivities = async (marcaId: number) => {
    // Eliminar actions
    await AsyncStorage.removeItem('activities_actions');
    await AsyncStorage.removeItem('activities_cache');
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }
    const response = await authedFetch({
      url: `${apiUrl}/api/activities/marca/${marcaId}`,
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
      throw new Error(`HTTP error! status: ${response.status} getActivities`);
    }
    const data = await response.json();
    if (data.status) {
      await AsyncStorage.setItem('activities_cache', JSON.stringify(data.actividades));
    }
}

  const getMainStructure = async () => {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }
    const response = await authedFetch({
      url: `${apiUrl}/api/main-structure`,
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
      throw new Error(`HTTP error! status: ${response.status} getMainStructure`);
    }
    const data = await response.json();
    if (!data.status) return;

    if (data.fragments && typeof data.fragments === 'object' && !Array.isArray(data.fragments)) {
      await persistMainStructureFragments(data.fragments as Record<string, unknown>);
    } else {
      let rawStructure = data.structure;
      if (typeof rawStructure === 'string') {
        try {
          rawStructure = JSON.parse(rawStructure);
        } catch {
          rawStructure = null;
        }
      }
      if (Array.isArray(rawStructure)) {
        await persistMainStructureFragments({});
        await writeMainStructureCacheString(JSON.stringify(rawStructure));
      }
    }

    if (data.created_at !== undefined && data.created_at !== null) {
      await AsyncStorage.setItem('main_structure_created_at', String(data.created_at));
    }
  }

  const shouldUpdateMainStructureCache = async (): Promise<boolean> => {
    try {
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) return false;

      if (!(await evaluateInternetConnection())) return false;

      const response = await authedFetch({
        url: `${apiUrl}/api/main-structure/last?created_at=0`,
        init: {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        },
        refreshAccessToken,
        logout,
      });

      if (!response || !response.ok) return false;

      const data = await response.json();
      const lastCreatedAt = Number(data?.created_at ?? 0);
      if (!Number.isFinite(lastCreatedAt) || lastCreatedAt <= 0) return false;

      const localCreatedAtStr = await AsyncStorage.getItem('main_structure_created_at');
      const localCreatedAt = Number(localCreatedAtStr ?? 0);
      const normalizedLocal = Number.isFinite(localCreatedAt) ? localCreatedAt : 0;

      return lastCreatedAt !== normalizedLocal;
    } catch (error) {
      console.error('Error validating main structure cache update:', error);
      return false;
    }
  };

  const handleMenuPress = () => {
    setIsMenuVisible(true);
  };

  const handleMenuClose = () => {
    setIsMenuVisible(false);
  };

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'warning': return <Ionicons name="warning" size={17.5} color='#FFCC00' />;
      case 'retry': return <Ionicons name="refresh" size={20} color='#FFFFFF' />;
      case 'start': return <Ionicons name="enter-outline" size={35} color='#FFFFFF' />;
      case 'end': return <Ionicons name="exit-outline" size={35} color='#FFFFFF' />;
      case 'confirm': return <Ionicons name="checkmark" size={35} color='#FFFFFF' />;
      case 'cancel': return <Ionicons name="close" size={35} color='#FFFFFF' />;
      case 'marcar-ingreso-salida': return <Ionicons name="time" size={25} color='#000000' />;
      default: return <Ionicons name="close" size={35} color='#FFFFFF' />;
    }
  };

  const handleHomePress = () => {
    navigation.navigate('Home');
  };

  const patchCurrentMarcaHoraSalida = async (marcaId: number, horaSalidaIso: string | null) => {
    const raw = await AsyncStorage.getItem('current_marca');
    if (!raw) return;
    try {
      const m = JSON.parse(raw);
      if (Number(m.id) !== Number(marcaId)) return;
      m.hora_salida_digitada = horaSalidaIso;
      await AsyncStorage.setItem('current_marca', JSON.stringify(m));
    } catch {
      /* ignore */
    }
  };

  const performRevertLeaving = async (marcaId: number) => {
    try {
      const horaRev = await getHoraAccion();
      if (!horaRev) {
        Alert.alert('Error', 'No se pudo obtener la hora del servidor');
        return;
      }
      const online = await evaluateInternetConnection();

      if (online) {
        const data = await revertAttendanceLeaving({
          marcaId,
          horaAccion: horaRev,
          refreshAccessToken,
          logout,
        });
        if (data.status) {
          await removePendingSalidaActionsForMarca(marcaId);
          await patchCurrentMarcaHoraSalida(marcaId, null);
          Alert.alert('Éxito', 'La salida ha sido revertida correctamente.');
          setRevertMarcaId(null);
          await fetchAttendanceStatus();
        } else {
          Alert.alert('Error', data.message || 'No se pudo revertir la salida.');
        }
      } else {
        const removedSalida = await removePendingSalidaActionsForMarca(marcaId);
        if (removedSalida > 0) {
          await patchCurrentMarcaHoraSalida(marcaId, null);
          Alert.alert(
            'Modo offline',
            'Se canceló la salida pendiente de sincronización. No hace falta revertir en el servidor.'
          );
        } else {
          await appendAttendanceAction({
            type: 'revert_leaving',
            marcaId,
            horaAccion: horaRev,
          });
          await patchCurrentMarcaHoraSalida(marcaId, null);
          Alert.alert(
            'Modo offline',
            'Revertir salida guardado localmente. Se sincronizará cuando haya conexión.'
          );
        }
        setRevertMarcaId(null);
        await fetchAttendanceStatus();
      }
    } catch (error) {
      console.error('Error reverting leaving:', error);
      Alert.alert('Error', 'No se pudo revertir la salida. Por favor, intenta nuevamente.');
    }
  };

  const handleRevertLeaving = () => {
    const mid = revertMarcaId ?? attendanceData?.marca?.id ?? null;
    if (mid == null || !Number.isFinite(Number(mid)) || Number(mid) <= 0) return;

    Alert.alert(
      'Confirmar',
      '¿Deseas revertir la salida registrada?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Revertir salida',
          style: 'destructive',
          onPress: () => performRevertLeaving(Number(mid)),
        },
      ],
    );
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const handleModalConfirm = () => {
    if (exitReason.trim() === '') {
      Alert.alert('Error', 'Por favor, ingresa una razón para la salida temprana.');
      return;
    }

    setIsModalVisible(false);
    confirmAction('salida', exitReason.trim(), false);
    setExitReason('');
  };

  const handleModalCancel = () => {
    setIsModalVisible(false);
    setExitReason('');
  };

  const handleAbsentReasonSubmit = async () => {
    if (absentReason.trim() === '') {
      Alert.alert('Error', 'Por favor, ingresa un motivo válido.');
      return;
    }

    const ok = await submitAbsentReason(absentReason.trim());
    if (ok) {
      setShowAbsentReasonForm(false);
      setAbsentReason('');
    }
  };

  const handleAbsentReasonCancel = () => {
    setShowAbsentReasonForm(false);
    setShouldResponseAbsentReason(false);
    setAbsentReason('');
  };

  const submitAbsentReason = async (reason: string): Promise<boolean> => {
    console.log("submitAbsentReason", reason, absentMarcaId);
    if (!employee?.id || !absentMarcaId) {
      Alert.alert('Error', 'No se encontró el ID del empleado o la marca de ausencia.');
      return false;
    }

    try {
      setIsSubmittingAbsentReason(true);

      const horaA = await getHoraAccion();
      if (!horaA) {
        Alert.alert('Error', 'No se pudo obtener la hora del servidor');
        return false;
      }

      if (!(await evaluateInternetConnection())) {
        await appendAttendanceAction({
          type: 'absent_reason',
          marcaId: Number(absentMarcaId),
          reason,
          horaAccion: horaA,
        });
        Alert.alert(
          'Guardado localmente',
          'El motivo de ausencia se sincronizará al recuperar conexión.'
        );
        setShouldResponseAbsentReason(false);
        setShowAbsentReasonForm(false);
        setAbsentReason('');
        await fetchAttendanceStatus();
        return true;
      }

      const data = await saveAbsentReason({
        reason,
        marcaId: Number(absentMarcaId),
        horaAccion: horaA,
        refreshAccessToken,
        logout,
      });

      if (data.status) {
        Alert.alert('Éxito', 'Motivo de ausencia registrado correctamente');
        // Refresh the attendance status
        await fetchAttendanceStatus();
        setShouldResponseAbsentReason(false);
        return true;
      } else {
        throw new Error(data.message || 'Error al registrar el motivo de ausencia');
      }
    } catch (error) {
      console.error('Error submitting absent reason:', error);
      Alert.alert('Error', 'No se pudo registrar el motivo de ausencia. Por favor, intenta nuevamente.');
      return false;
    } finally {
      setIsSubmittingAbsentReason(false);
    }
  };

  const getNextTime = (nextTime: string) => {
    const dateSplit = nextTime.split('T');
    let hours = dateSplit[1].split('.')[0].split(':');
    let hoursReturn = hours[0] + ':' + hours[1];
    return hoursReturn;
  };

  /** HH:mm para la tarjeta "Hora actual" (siempre visible): servidor vía marca, `horaAccion`, o reloj local CR). */
  const getDisplayClockText = (): string => {
    void clockTick;
    if (attendanceData?.current_time) {
      try {
        return getNextTime(attendanceData.current_time);
      } catch {
        return '—';
      }
    }
    if (horaAccion != null && Number.isFinite(Number(horaAccion))) {
      try {
        return getNextTime(new Date(Number(horaAccion)).toISOString());
      } catch {
        /* continuar al fallback */
      }
    }
    try {
      return format(toZonedTime(new Date(), 'America/Costa_Rica'), 'HH:mm');
    } catch {
      return '—';
    }
  };

  const getDisability = () => {
    if (!attendanceData) return true;

    if (markingBlocked) return true;

    if (
      attendanceData.estado === 'Ingresado' &&
      attendanceData.marca?.hora_salida_digitada != null
    ) {
      return true;
    }

    if (attendanceData.estado === 'No ingresado') {
      if (!localCanMarkEntrada || !attendanceData.change_available) return true;
    }

    if (attendanceData.estado === 'Ingresado') {
      if (!localCanMarkSalida) return true;
      if (!attendanceData.change_available) return true;
    }

    return false;
  }

  const convertDateToLocal = (date: string) => {
    const dateSplit = date.split('T');
    return dateSplit[0] + ' a las ' + getNextTime(date);
  };

  const getLateTime = (attendanceData: AttendanceSuccessResponse, horaAccion: number | null) => {
    const fecha = attendanceData.marca.fecha.split('T')[0];
    const horaInicio = attendanceData.marca.hora_inicio.split('T')[1];
    const inicio = fecha + 'T' + horaInicio;
    if (!horaAccion) {
      return '--:--';
    }
    const ahora = new Date(horaAccion).toISOString();

    // Convertir a Date objects para comparar
    const inicioDate = new Date(inicio);
    const ahoraDate = new Date(ahora);

    // Validar si ahora es mayor que inicio
    if (ahoraDate > inicioDate) {
      // Calcular la diferencia en milisegundos
      const diferenciaMs = ahoraDate.getTime() - inicioDate.getTime();

      // Convertir a segundos, minutos y horas
      const segundos = Math.floor(diferenciaMs / 1000);
      const minutos = Math.floor(segundos / 60);
      const horas = Math.floor(minutos / 60);

      // Obtener los valores restantes
      const segundosRestantes = segundos % 60;
      const minutosRestantes = minutos % 60;

      // Construir el texto legible
      const partes: string[] = [];

      if (horas > 0) {
        partes.push(`${horas} ${horas === 1 ? 'hora' : 'horas'}`);
      }
      if (minutosRestantes > 0) {
        partes.push(`${minutosRestantes} ${minutosRestantes === 1 ? 'min' : 'mins'}`);
      }
      if (segundosRestantes > 0) {
        partes.push(`${segundosRestantes} ${segundosRestantes === 1 ? 'seg' : 'segs'}`);
      }

      // Si no hay diferencia significativa, mostrar solo segundos
      if (partes.length === 0) {
        return '0 segundos';
      }

      // Unir las partes con comas y "y" antes de la última
      if (partes.length === 1) {
        return partes[0];
      } else if (partes.length === 2) {
        return `${partes[0]} y ${partes[1]}`;
      } else {
        return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
      }
    }

    return '--:--';
  };

  const getCorporateVehicles = async (corpoId: number) => {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;

    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    if (!(await evaluateInternetConnection())) {
      return;
    }

    const response = await authedFetch({
      url: `${apiUrl}/api/corporate-vehicles/corpo/${corpoId}`,
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
    console.log("getCorporateVehicles");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} getCorporateVehicles`);
    }
    const data = await response.json();
    if (data.status && Array.isArray(data.data)) {
      await mergeCorporateVehiclesCorpoCacheForSucursal(corpoId, data.data);
    }
  }

  const handleOpenFutureMarksModal = async () => {
    if (!employee?.id) {
      Alert.alert('Error', 'No se encontró el ID del empleado.');
      return;
    }
    setIsMarksModalVisible(true);
    await fetchFutureMarks();
  };

  const fetchFutureMarks = async () => {
    if (!employee?.id) return;

    try {
      setIsLoadingFutureMarks(true);
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) {
        throw new Error('Server URL not configured');
      }

      const response = await authedFetch({
        url: `${apiUrl}/api/attendance/user/${employee.id}/next`,
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
      if (data.status && data.data) {
        setFutureMarks(data.data);
      } else {
        setFutureMarks([]);
        Alert.alert('Error', data.message || 'No se pudieron cargar las marcas futuras');
      }
    } catch (error: any) {
      console.error('Error fetching future marks:', error);
      Alert.alert('Error', error.message || 'No se pudieron cargar las marcas futuras');
      setFutureMarks([]);
    } finally {
      setIsLoadingFutureMarks(false);
    }
  };

  const renderFutureMarks = () => {
    try {
      // Agrupar marcas por día
      const groupedByDay: { [key: string]: any[] } = {};
      futureMarks.forEach((mark) => {
        try {
          let fecha: Date;
          if (mark.fecha instanceof Date) {
            fecha = mark.fecha;
          } else if (typeof mark.fecha === 'string') {
            fecha = new Date(mark.fecha);
          } else {
            console.warn('Fecha inválida:', mark.fecha);
            return;
          }

          if (isNaN(fecha.getTime())) {
            console.warn('Fecha inválida (NaN):', mark.fecha);
            return;
          }

          const dayKeyRaw = fecha.toISOString().split('T')[0];
          const dayKey = formatDateDMY(dayKeyRaw);
          if (!groupedByDay[dayKey]) {
            groupedByDay[dayKey] = [];
          }
          groupedByDay[dayKey].push(mark);
        } catch (err) {
          console.error('Error procesando marca:', err, mark);
        }
      });

      // Construir los próximos 30 días (incluyendo días sin marcas)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const next30Days = Array.from({ length: 30 }, (_, index) => {
        const d = new Date(today);
        d.setDate(d.getDate() + index);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const isoDate = `${year}-${month}-${day}`;
        const label = formatDateDMY(isoDate);
        return { key: isoDate, label };
      });

      const formatHora = (hora: any): string => {
        if (!hora) return '';
        try {
          if (hora instanceof Date) {
            return format(hora, 'HH:mm');
          }
          const horaStr = typeof hora === 'string' ? hora : String(hora);
          // Manejar formato HH:mm:ss o HH:mm
          const timeMatch = horaStr.match(/(\d{2}):(\d{2})(?::(\d{2}))?/);
          if (timeMatch) {
            const [, hours, minutes] = timeMatch;
            return `${hours}:${minutes}`;
          }
          return horaStr;
        } catch {
          return '';
        }
      };

      return next30Days.map(({ key, label }) => {
        const marksForDay = groupedByDay[label] || [];
        const dayMarks = marksForDay
          .slice()
          .sort((a, b) => {
            const getHoraTime = (hora: any) => {
              if (!hora) return 0;
              try {
                if (hora instanceof Date) {
                  return hora.getTime();
                }
                const horaStr = typeof hora === 'string' ? hora : String(hora);
                // Manejar formato HH:mm:ss o HH:mm
                const timeMatch = horaStr.match(/(\d{2}):(\d{2})(?::(\d{2}))?/);
                if (timeMatch) {
                  const [, hours, minutes] = timeMatch;
                  return parseInt(hours) * 60 + parseInt(minutes);
                }
                return 0;
              } catch {
                return 0;
              }
            };
            return getHoraTime(a.hora_inicio) - getHoraTime(b.hora_inicio);
          });

        return (
          <Collapsible key={key} title={label}>
            <ThemedView style={styles.marksDayContainer}>
              {dayMarks.length === 0 ? (
                <ThemedText style={styles.marksEmptyText}>
                  Estás libre este día
                </ThemedText>
              ) : (
                dayMarks.map((mark, index) => {
                  const horaInicioStr = formatHora(mark.hora_inicio);
                  const horaFinStr = formatHora(mark.hora_fin);

                  let tipoTurno = 'Desconocido';
                  if (mark.tipo_turno) {
                    switch (mark.tipo_turno) {
                      case 'D':
                        tipoTurno = 'Diurno';
                        break;
                      case 'N':
                        tipoTurno = 'Nocturno';
                        break;
                      case 'M':
                        tipoTurno = 'Mixto';
                        break;
                    }
                  }

                  return (
                    <ThemedView key={mark.id || index} style={styles.markItem}>
                      <ThemedView style={styles.markItemHeader}>
                        <Ionicons name="time-outline" size={18} color="#007AFF" />
                        <ThemedText style={styles.markItemTime}>
                          {horaInicioStr || 'Sin hora'}
                          {horaFinStr ? ` - ${horaFinStr}` : ''}
                        </ThemedText>
                      </ThemedView>
                      <ThemedView style={styles.markItemDetails}>
                      {mark.empresa && mark.empresa.nombre && (
                        <ThemedView style={styles.markItemRow}>
                          <ThemedText style={styles.markItemTitle}>
                            Empresa
                          </ThemedText>
                          <ThemedText style={styles.markItemValue}>
                            {mark.empresa.nombre}
                          </ThemedText>
                        </ThemedView>
                      )}
                      {mark.cliente && mark.cliente.nombre && (
                        <ThemedView style={styles.markItemRow}>
                          <ThemedText style={styles.markItemTitle}>
                            Cliente
                          </ThemedText>
                          <ThemedText style={styles.markItemValue}>
                            {mark.cliente.nombre}
                          </ThemedText>
                        </ThemedView>
                      )}
                      {mark.contrato && mark.contrato.nombre && (
                        <ThemedView style={styles.markItemRow}>
                          <ThemedText style={styles.markItemTitle}>
                            Contrato
                          </ThemedText>
                          <ThemedText style={styles.markItemValue}>
                            {mark.contrato.nombre}
                          </ThemedText>
                        </ThemedView>
                      )}
                      {mark.corpo && mark.corpo.nombre && (
                        <ThemedView style={styles.markItemRow}>
                          <ThemedText style={styles.markItemTitle}>
                            Corpo
                          </ThemedText>
                          <ThemedText style={styles.markItemValue}>
                            {mark.corpo.nombre}
                          </ThemedText>
                        </ThemedView>
                      )}
                      {mark.puesto && mark.puesto.nombre && (
                        <ThemedView style={styles.markItemRow}>
                          <ThemedText style={styles.markItemTitle}>
                            Puesto
                          </ThemedText>
                          <ThemedText style={styles.markItemValue}>
                            {mark.puesto.nombre}
                          </ThemedText>
                          {mark.puesto.tiene_relevo && (
                            <ThemedText style={styles.markItemValue}>
                              (Tiene relevo)
                            </ThemedText>
                          )}
                        </ThemedView>
                      )}
                      {mark.plaza && mark.plaza.nombre && (
                        <ThemedView style={styles.markItemRow}>
                          <ThemedText style={styles.markItemTitle}>
                            Plaza
                          </ThemedText>
                          <ThemedText style={styles.markItemValue}>
                            {mark.plaza.nombre}
                          </ThemedText>
                        </ThemedView>
                      )}
                      <ThemedView style={styles.markItemRow}>
                        <ThemedText style={styles.markItemTitle}>
                          Turno
                        </ThemedText>
                        <ThemedText style={styles.markItemValue}>
                          {tipoTurno}
                        </ThemedText>
                      </ThemedView>
                      </ThemedView>
                    </ThemedView>
                  );
                })
              )}
            </ThemedView>
          </Collapsible>
        );
      });
    } catch (error) {
      console.error('Error renderizando marcas:', error);
      return (
        <ThemedView style={styles.marksEmptyContainer}>
          <ThemedText style={styles.marksEmptyText}>
            Error al procesar las marcas. Por favor, intenta nuevamente.
          </ThemedText>
        </ThemedView>
      );
    }
  };

  const handleCreateTestMarca = () => {
    if (!employee?.id) {
      Alert.alert('Error', 'No se encontró el ID del empleado.');
      return;
    }

    Alert.alert(
      'Confirmar creación de marca de prueba',
      '¿Estás seguro de que deseas crear una marca de prueba? Esta acción es solo para desarrollo.',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Crear',
          style: 'default',
          onPress: () => executeCreateTestMarca(),
        },
      ],
      { cancelable: true }
    );
  };

  const executeCreateTestMarca = async () => {
    if (!employee?.id) {
      Alert.alert('Error', 'No se encontró el ID del empleado.');
      return;
    }

    try {
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) {
        throw new Error('Server URL not configured');
      }

      const response = await authedFetch({
        url: `${apiUrl}/api/attendance/${employee.id}/dev-create-marca`,
        init: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            dev: employee.id,
          }),
        },
        refreshAccessToken,
        logout,
      });
      if (!response) return;

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.status) {
        Alert.alert('Éxito', 'Marca de prueba creada correctamente');
        // Recargar la ventana
        await fetchAttendanceStatus();
      } else {
        throw new Error(data.message || 'Error al crear la marca de prueba');
      }
    } catch (error: any) {
      console.error('Error creating test marca:', error);
      Alert.alert('Error', error.message || 'No se pudo crear la marca de prueba. Por favor, intenta nuevamente.');
    }
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
      <AppHeader onMenuPress={handleMenuPress} title="Marcar Ingreso/Salida" />

      <ScrollView style={styles.scrollView}>
        <ThemedView style={styles.container}>
          {/* Module Title */}
          <ThemedView style={styles.titleContainer}>
            <ThemedText type="title" style={styles.title}>
              {getActionIcon('marcar-ingreso-salida')} Marcar Ingreso/Salida
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              Control de asistencia
            </ThemedText>
          </ThemedView>

          {isEntradaMarcaHintVisible ? (
            <ThemedView style={[styles.entradaMarcaHintBox, styles.entradaMarcaHintTopRow]}>
              <Ionicons name="information-circle-outline" size={22} color="#007AFF" style={{ marginRight: 10 }} />
              <ThemedView style={styles.entradaMarcaHintTextRow}>
                <ThemedText style={[styles.entradaMarcaHintText, { flex: 1 }]}>
                  Para poder marcar entrada, asegúrate de estar mínimo 15 minutos antes del inicio o durante tu turno
                </ThemedText>
                <TouchableOpacity
                  onPress={() => setIsEntradaMarcaHintVisible(false)}
                  style={styles.entradaMarcaHintClose}
                  accessibilityLabel="Cerrar aviso"
                >
                  <ThemedText style={styles.entradaMarcaHintCloseText}>Cerrar</ThemedText>
                </TouchableOpacity>
              </ThemedView>
            </ThemedView>
          ) : null}

          <ThemedView style={styles.testButtonContainer}>
            <TouchableOpacity
              style={styles.futureMarksButton}
              onPress={handleOpenFutureMarksModal}
            >
              <Ionicons name="calendar-outline" size={20} color="#FFFFFF" />
              <ThemedText style={styles.futureMarksButtonText}>
                Ver turnos futuros
              </ThemedText>
            </TouchableOpacity>
          </ThemedView>

          <ThemedView style={[styles.infoCard, { marginBottom: 16 }]}>
            <ThemedText style={styles.currentTimeTitle}>Hora actual</ThemedText>
            <ThemedText style={styles.currentTime}>{getDisplayClockText()}</ThemedText>
          </ThemedView>
          {/* Test Button - Always Visible */}
          
          {false && (
          <ThemedView style={styles.testButtonContainer}>
            <TouchableOpacity
              style={[
                styles.testButton
              ]}
              onPress={handleCreateTestMarca}
            >
              <ThemedText style={styles.testButtonText}>
                Crear marca (Solo pruebas)
              </ThemedText>
            </TouchableOpacity>
          </ThemedView>
          )}

          {/* Content Section */}
          {isProcessingMark ? (
            <ThemedView style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <ThemedText style={styles.loadingDataText}>
                {processingType === 'salida'
                  ? 'Procesando salida, por favor no cierre la ventana...'
                  : 'Procesando ingreso. Esto puede tardar unos segundos, por favor no cierre la ventana...'}
              </ThemedText>
            </ThemedView>
          ) : isLoadingData ? (
            <ThemedView style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <ThemedText style={styles.loadingDataText}>
                Cargando datos de asistencia...
              </ThemedText>
            </ThemedView>
          ) : isSubmittingAbsentReason ? (
            <ThemedView style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <ThemedText style={styles.loadingDataText}>
                Enviando motivo de ausencia, por favor no cierre la ventana...
              </ThemedText>
            </ThemedView>
          ) : attendanceData ? (
            <ThemedView style={styles.contentContainer}>
              {/* Work Information Card */}
              <ThemedView style={styles.infoCard}>
                <ThemedText style={styles.infoCardTitle}>Información Laboral</ThemedText>

                <ThemedView style={styles.infoRow}>
                  <ThemedText style={styles.infoLabel}>Fecha de la marca:</ThemedText>
                  <ThemedText style={styles.infoValue}>{formatDateDMY(attendanceData.marca.fecha)}</ThemedText>
                </ThemedView>

                <ThemedView style={styles.infoRow}>
                  <ThemedText style={styles.infoLabel}>Empresa:</ThemedText>
                  <ThemedText style={styles.infoValue}>{attendanceData.marca.empresa.nombre}</ThemedText>
                </ThemedView>

                <ThemedView style={styles.infoRow}>
                  <ThemedText style={styles.infoLabel}>Cliente:</ThemedText>
                  <ThemedText style={styles.infoValue}>{attendanceData.marca.cliente.nombre}</ThemedText>
                </ThemedView>

                <ThemedView style={styles.infoRow}>
                  <ThemedText style={styles.infoLabel}>División:</ThemedText>
                  <ThemedText style={styles.infoValue}>{attendanceData.marca.roleDivision.division.nombre}</ThemedText>
                </ThemedView>

                <ThemedView style={styles.infoRow}>
                  <ThemedText style={styles.infoLabel}>Rol:</ThemedText>
                  <ThemedText style={styles.infoValue}>{attendanceData.marca.roleDivision.role.nombre}</ThemedText>
                </ThemedView>

                <ThemedView style={styles.infoRow}>
                  <ThemedText style={styles.infoLabel}>Contrato:</ThemedText>
                  <ThemedText style={styles.infoValue}>{attendanceData.marca.contrato.nombre}</ThemedText>
                </ThemedView>

                <ThemedView style={styles.infoRow}>
                  <ThemedText style={styles.infoLabel}>Corpo:</ThemedText>
                  <ThemedText style={styles.infoValue}>{attendanceData.marca.corpo.nombre}</ThemedText>
                </ThemedView>

                <ThemedView style={styles.infoRow}>
                  <ThemedText style={styles.infoLabel}>Puesto:</ThemedText>
                  <ThemedText style={styles.infoValue}>{attendanceData.marca.puesto.nombre}</ThemedText>
                </ThemedView>

                <ThemedView style={styles.infoRow}>
                  <ThemedText style={styles.infoLabel}>Plaza:</ThemedText>
                  <ThemedText style={styles.infoValue}>{attendanceData.marca.plaza.nombre}</ThemedText>
                </ThemedView>

                <ThemedView style={styles.infoRow}>
                  <ThemedText style={styles.infoLabel}>Horario:</ThemedText>
                  <ThemedText style={styles.infoValue}>{attendanceData.marca.horario.nombre}</ThemedText>
                </ThemedView>
              </ThemedView>

              {/* Status Display */}
              <ThemedView style={styles.statusCard}>
                <ThemedView style={styles.nextTimeContainer}>
                  <ThemedText style={styles.statusLabel}>
                    Estado actual:
                  </ThemedText>
                  <ThemedView style={[
                    styles.statusBadge,
                    attendanceData.estado === 'Ingresado' ? styles.statusBadgeWorking : styles.statusBadgeOffline
                  ]}>
                    <ThemedText style={styles.statusText}>
                      {attendanceData.estado === 'Ingresado' ? 'Ingresado' : 'No ingresado'}
                    </ThemedText>
                  </ThemedView>
                  {attendanceData.estado === 'Ingresado' && attendanceData.marca.hora_entrada_digitada != null && (
                    <ThemedView style={styles.enterAtContainer}>
                      <ThemedText style={styles.enterAtLabel}>
                        Fecha y hora de ingreso:
                      </ThemedText>
                      <ThemedText style={styles.enterAtText}>
                        {convertDateToLocal(attendanceData.marca.hora_entrada_digitada)}
                      </ThemedText>
                    </ThemedView>
                  )}
                  {attendanceData.estado === 'Ingresado' &&
                    attendanceData.marca.hora_salida_digitada != null && (
                    <ThemedView style={styles.enterAtContainer}>
                      <ThemedText style={styles.enterAtLabel}>Fecha y hora de salida:</ThemedText>
                      <ThemedText style={styles.enterAtText}>
                        {convertDateToLocal(attendanceData.marca.hora_salida_digitada)}
                      </ThemedText>
                    </ThemedView>
                  )}
                </ThemedView>

                {/* Next Time */}
                <ThemedView style={[styles.nextTimeContainer, { marginTop: 10 }]}>
                  <ThemedText style={styles.nextTimeLabel}>{attendanceData.estado === 'Ingresado' ? 'Hora de salida:' : 'Hora de entrada:'}</ThemedText>
                  <ThemedText style={styles.nextTimeValue}>
                    {getNextTime(attendanceData.next_time)}
                  </ThemedText>
                </ThemedView>

                {/* Late Warning */}
                {attendanceData.marca.hora_inicio != null && attendanceData.is_late && (
                  <ThemedView style={styles.lateWarning}>
                    <ThemedText style={styles.lateWarningText}>
                      {getActionIcon('warning')} Tardía de {getLateTime(attendanceData, horaAccion)}
                    </ThemedText>
                  </ThemedView>
                )}
              </ThemedView>

              {(errorMessage || showAbsentReasonForm || revertMarcaId != null) && (
                <ThemedView style={styles.marcaWarningsSection}>
                  {showAbsentReasonForm && shouldResponseAbsentReason && (
                    <ThemedView style={styles.absentReasonContainer}>
                      <ThemedText style={styles.absentReasonTitle}>
                        Motivo de ausencia
                      </ThemedText>
                      <ThemedText style={styles.absentReasonSubtitle}>
                        Por favor, ingresa el motivo de tu ausencia:
                      </ThemedText>

                      <TextInput
                        style={styles.absentReasonInput}
                        value={absentReason}
                        onChangeText={setAbsentReason}
                        placeholder="Ej: Enfermedad, emergencia familiar, cita médica..."
                        placeholderTextColor="#999"
                        multiline={true}
                        numberOfLines={3}
                        textAlignVertical="top"
                        editable={!isSubmittingAbsentReason}
                      />

                      <ThemedView style={styles.absentReasonButtons}>
                        <TouchableOpacity
                          style={[styles.absentReasonButton, styles.absentReasonSubmitButton]}
                          onPress={handleAbsentReasonSubmit}
                          disabled={isSubmittingAbsentReason}
                        >
                          <ThemedText style={styles.absentReasonSubmitButtonText}>
                            {isSubmittingAbsentReason ? 'Enviando...' : getActionIcon('confirm')}
                          </ThemedText>
                        </TouchableOpacity>
                      </ThemedView>
                    </ThemedView>
                  )}

                  {errorMessage ? (
                    <ThemedView style={styles.entradaLocationErrorBlock}>
                      <ThemedText style={styles.errorText}>
                        {getActionIcon('warning')} {errorMessage}
                      </ThemedText>
                      {showEntradaLocationRetry &&
                        attendanceData.estado === 'No ingresado' && (
                          <TouchableOpacity
                            style={[
                              styles.entradaLocationRetryButton,
                              isRefreshingEntradaLocation && styles.actionButtonDisabled,
                            ]}
                            onPress={() => void handleRetryEntradaLocationCheck()}
                            disabled={isRefreshingEntradaLocation}
                            activeOpacity={0.85}
                          >
                            {isRefreshingEntradaLocation ? (
                              <ActivityIndicator size="small" color="#007AFF" />
                            ) : (
                              <>
                                <Ionicons name="refresh" size={18} color="#007AFF" />
                                <ThemedText style={styles.entradaLocationRetryButtonText}>
                                  Reintentar
                                </ThemedText>
                              </>
                            )}
                          </TouchableOpacity>
                        )}
                    </ThemedView>
                  ) : null}

                  {(revertMarcaId != null || attendanceData.marca.hora_salida_digitada != null) && (
                    <TouchableOpacity style={styles.revertButton} onPress={handleRevertLeaving}>
                      <ThemedText style={styles.revertButtonText}>Revertir salida</ThemedText>
                    </TouchableOpacity>
                  )}
                </ThemedView>
              )}

              {/* Action Button */}
              <ThemedView style={styles.actionContainer}>
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    attendanceData.estado === 'Ingresado' ? styles.endShiftButton : styles.startShiftButton,
                    (getDisability() || isUpdating) && styles.actionButtonDisabled
                  ]}
                  onPress={handleToggleAttendance}
                  disabled={getDisability() || isUpdating}
                >
                  {isUpdating ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <ThemedView style={[{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      backgroundColor: attendanceData.estado === 'No ingresado' ? '#34C759' : '#FF3B30',
                    }]}>
                      <ThemedText style={styles.actionButtonText}>
                        {attendanceData.estado === 'No ingresado' ? 'Marcar ingreso' : 'Marcar salida'}
                      </ThemedText>
                      <ThemedText style={styles.actionButtonText}>
                        {attendanceData.estado === 'No ingresado' ? getActionIcon('start') : getActionIcon('end')}
                      </ThemedText>
                    </ThemedView>
                  )}
                </TouchableOpacity>
              </ThemedView>
            </ThemedView>
          ) : errorMessage ? (
            <ThemedView style={styles.errorContainer}>
              <ThemedText style={styles.errorText}>{getActionIcon('warning')} {errorMessage}</ThemedText>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={fetchAttendanceStatus}
              >
                <ThemedText style={styles.retryButtonText}>{getActionIcon('retry')}</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          ) : null}
        </ThemedView>
      </ScrollView>

      <SlideMenu
        isVisible={isMenuVisible}
        onClose={handleMenuClose}
        onHomePress={handleHomePress}
        currentRoute="marcar-ingreso-salida"
      />

      {/* Modal for early exit reason */}
      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleModalCancel}
      >
        <ThemedView style={styles.modalOverlay}>
          <ThemedView style={styles.modalContainer}>
            <ThemedText style={styles.modalTitle}>
              Razón de salida anticipada
            </ThemedText>
            <ThemedText style={styles.modalSubtitle}>
              Por favor, ingresa la razón por la cual sales antes de tiempo:
            </ThemedText>

            <TextInput
              style={styles.modalInput}
              value={exitReason}
              onChangeText={setExitReason}
              placeholder="Ej: Cita médica, emergencia familiar..."
              placeholderTextColor="#999"
              multiline={true}
              numberOfLines={3}
              textAlignVertical="top"
            />

            <ThemedView style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={handleModalCancel}
              >
                <ThemedText style={styles.modalCancelButtonText}>
                  {getActionIcon('cancel')}
                </ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirmButton]}
                onPress={handleModalConfirm}
              >
                <ThemedText style={styles.modalConfirmButtonText}>
                  {getActionIcon('confirm')}
                </ThemedText>
              </TouchableOpacity>
            </ThemedView>
          </ThemedView>
        </ThemedView>
      </Modal>

      {/* Modal de marcas futuras */}
      <Modal
        visible={isMarksModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsMarksModalVisible(false)}
      >
        <View style={styles.marksModalOverlay}>
          <ThemedView style={styles.marksModalContainer}>
            <View style={styles.marksModalHeader}>
              <ThemedText style={styles.marksModalTitle}>
                Marcas Futuras (30 días)
              </ThemedText>
              <TouchableOpacity
                onPress={() => setIsMarksModalVisible(false)}
              >
                <Ionicons name="close" size={24} color="#666666" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.marksModalContent}
              contentContainerStyle={styles.marksModalContentContainer}
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={true}
            >
              {isLoadingFutureMarks ? (
                <ThemedView style={styles.marksLoadingContainer}>
                  <ActivityIndicator size="large" color="#007AFF" />
                  <ThemedText style={styles.marksLoadingText}>
                    Cargando marcas...
                  </ThemedText>
                </ThemedView>
              ) : futureMarks.length === 0 ? (
                <ThemedView style={styles.marksEmptyContainer}>
                  <ThemedText style={styles.marksEmptyText}>
                    No hay marcas programadas para los próximos 30 días
                  </ThemedText>
                </ThemedView>
              ) : renderFutureMarks()}
            </ScrollView>
          </ThemedView>
        </View>
      </Modal>

      <AppFooter />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fullContainer: {
    flex: 1,
  },
  currentTime: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    color: '#000000',
  },
  currentTimeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#007AFF',
  },
  entradaMarcaHintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F4FF',
    borderWidth: 1,
    borderColor: '#B8DAF8',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  entradaMarcaHintTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
    backgroundColor: '#E8F4FF',
  },
  entradaMarcaHintTextRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    minWidth: 0,
    backgroundColor: '#E8F4FF',
  },
  entradaMarcaHintText: {
    fontSize: 14,
    color: '#1a1a1a',
    lineHeight: 20,
    backgroundColor: '#E8F4FF',
  },
  entradaMarcaHintClose: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#E8F4FF',
    borderWidth: 1,
    borderColor: '#007AFF',
    flexShrink: 0,
    alignSelf: 'flex-start',
  },
  entradaMarcaHintCloseText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
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
  loadingDataText: {
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
  marcaWarningsSection: {
    width: '100%',
    marginTop: 16,
    marginBottom: 8,
    gap: 16,
    alignItems: 'center',
  },
  entradaLocationErrorBlock: {
    width: '100%',
    alignItems: 'center',
    gap: 12,
  },
  entradaLocationRetryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#E8F4FF',
    borderWidth: 1,
    borderColor: '#B8DAF8',
  },
  entradaLocationRetryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
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
  revertButton: {
    marginTop: 12,
    backgroundColor: '#FF3B30',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  revertButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  contentContainer: {
    flex: 1,
    gap: 30,
  },
  infoCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 20,
    gap: 12,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoCardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
    color: '#007AFF',
  },
  infoRow: {
    display: 'flex',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#F8F9FA',
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    flex: 1,
  },
  infoValue: {
    fontSize: 10,
    fontWeight: '500',
    color: '#333333',
    flex: 2,
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    gap: 5,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusContainer: {
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 10,
    borderRadius: 8,
  },
  statusLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666666',
  },
  statusBadge: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  enterAtBadge: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: '#FF9500',
  },
  statusBadgeWorking: {
    backgroundColor: '#34C759',
  },
  statusBadgeOffline: {
    backgroundColor: '#8E8E93',
  },
  statusText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  salidaMarcadaMensaje: {
    fontSize: 17,
    color: '#FF3B30',
    textAlign: 'center',
    width: '100%',
    marginBottom: 8,
  },
  enterAtLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  enterAtText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
    backgroundColor: '#FF9500',
  },
  nextTimeContainer: {
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#D1E6FF',
    padding: 10,
    borderRadius: 8,
  },
  enterAtContainer: {
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FF9500',
    padding: 10,
    borderRadius: 8,
    width: '100%',
  },
  nextTimeLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666666',
  },
  nextTimeValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
  },
  lateWarning: {
    backgroundColor: '#FF3B30',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 8,
  },
  lateWarningText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  actionContainer: {

  },
  actionButton: {
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 12,
    minWidth: 250,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  startShiftButton: {
    backgroundColor: '#34C759',
  },
  endShiftButton: {
    backgroundColor: '#FF3B30',
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  actionButtonTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#007AFF',
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 16,
    opacity: 0.7,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#333333',
  },
  modalSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#666666',
    lineHeight: 22,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#F8F9FA',
    marginBottom: 24,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: '#FAFAFA'
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: '#E0E0E0',
  },
  modalConfirmButton: {
    backgroundColor: '#FF3B30',
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  modalConfirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  absentReasonContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
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
  absentReasonTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#333333',
  },
  absentReasonSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    color: '#666666',
    lineHeight: 20,
  },
  absentReasonInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#F8F9FA',
    marginBottom: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  absentReasonButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: '#FAFAFA',
  },
  absentReasonButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  absentReasonCancelButton: {
    backgroundColor: '#E0E0E0',
  },
  absentReasonSubmitButton: {
    backgroundColor: '#FF3B30',
  },
  absentReasonCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  absentReasonSubmitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  testButtonContainer: {
    marginBottom: 20,
  },
  testButton: {
    backgroundColor: '#FF9500',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  testButtonDisabled: {
    opacity: 0.6,
  },
  testButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  futureMarksButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  futureMarksButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  marksModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  marksModalContainer: {
    width: '100%',
    maxWidth: 600,
    height: '90%',
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    flexDirection: 'column',
  },
  marksModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  marksModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 8,
  },
  marksModalContent: {
    flex: 1,
  },
  marksModalContentContainer: {
    padding: 16,
  },
  marksLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  marksLoadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666666',
  },
  marksEmptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  marksEmptyText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  marksDayContainer: {
    marginTop: 8,
    gap: 12,
  },
  markItem: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    padding: 12,
    marginBottom: 8,
  },
  markItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  markItemTime: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  markItemDetails: {
    marginTop: 8,
    gap: 6,
  },
  markItemRow: {
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingBottom: 4,
  },
  markItemTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#777777',
  },
  markItemValue: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333333',
    flex: 1,
    textAlign: 'left',
  },
  markItemPlaza: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
    marginTop: 4,
  },
  markItemPuesto: {
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
  },
  markItemHorario: {
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
  },
  markItemTurno: {
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
  },
});

