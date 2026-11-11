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
import { applyNomenclatorsFromAttendanceMarca } from '@/hooks/updateNomenclator';
import revertAttendanceLeaving from '@/hooks/revertAttendanceLeaving';
import {
  appendAttendanceAction,
  ATTENDANCE_ACTIONS_KEY,
  readAttendanceActions,
  removePendingSalidaActionsForMarca,
} from '@/hooks/attendanceActionsStorage';
import {
  buildMarcaNaiveMs,
  computeChangeAvailable,
  evaluateLocalMarcaRules,
  getMarcaPuestoCoords,
  hasMarcaPuestoCoordinates,
  isOutOfRangeLocationMessage,
  validateMarcaLocation,
} from '@/hooks/attendanceLocalMarcaValidation';
import PuestoLocationBlock from '../components/PuestoLocationBlock';
import {
  getMonitoringPreviousMinutesFromStorage,
  setMonitoringPreviousMinutesStorage,
} from '@/hooks/monitoringPreviousMinutesStorage';
import {
  getMonitoringPostMinutesFromStorage,
  setMonitoringPostMinutesStorage,
} from '@/hooks/monitoringPostMinutesStorage';
import {
  getTiempoGraciaMarcarSalidaFromStorage,
  setTiempoGraciaMarcarSalidaStorage,
} from '@/hooks/tiempoGraciaMarcarSalidaStorage';
import {
  getValidateGpsSalidaFromStorage,
  setValidateGpsSalidaStorage,
} from '@/hooks/validateGpsSalidaStorage';
import getHoraAccion from '@/hooks/getHoraAccion';
import { removeCurrentMarca, removeCurrentMarcaIfExpired } from '@/hooks/currentMarcaExpiry';
import { setHorasEliminarMarcaStorage } from '@/hooks/horasEliminarMarcaStorage';
import resolveMarcaIngresoCoordinates from '@/hooks/resolveMarcaIngresoCoordinates';
import {
  DEVICE_COORDS_POLL_SILENT,
  DEVICE_COORDS_USER_ACTION,
} from '@/hooks/resolveDeviceCoordinates';
import { eventBus } from '@/hooks/eventBus';
import { CURRENT_MARCA_UPDATED_EVENT } from '@/hooks/pushNotificationsService';
import authedFetch from '@/hooks/authedFetch';
import {
  isStoredPlanillasTokenValid,
  PLANILLAS_TOKEN_EXPIRES_AT_KEY,
  PLANILLAS_TOKEN_KEY,
  readStoredPlanillasToken,
} from '@/hooks/planillasTokenStorage';
import PlanillasPasswordRevalidationModal from '../components/PlanillasPasswordRevalidationModal';
import { deleteAllFiles } from '@/hooks/fileStorage';
import { isPendingWorkKey } from '@/hooks/cleanupGuard';
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
} from '@/hooks/mainStructureFragmentsStorage';
import { requestBackgroundMainStructureDownload } from '@/hooks/backgroundMainStructureDownload';
import { resetLunchTimeCompleted } from '@/hooks/lunchTimeMarcaHierarchy';
import {
  formatDateTimeLine,
  formatFechaDMY,
  isDiaLibreTurno,
  tieneHorarioCompleto,
  formatHoraRange,
  isShiftUpcoming,
  levelLabel,
  levelLabelCodeOnly,
  levelName,
  shiftInfoRows,
  tipoTurnoLabel,
  type NextShift,
} from '@/hooks/nextShiftCore';
import { getNextShiftFromStorage, NEXT_SHIFT_KEY, setNextShiftStorage } from '@/hooks/nextShiftStorage';

type MarcarIngresoSalidaScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'MarcarIngresoSalida'>;

interface AttendanceSuccessResponse {
  estado: 'Ingresado' | 'No ingresado';
  is_late: boolean;
  is_salida_anticipada?: boolean;
  current_time: string;
  change_available: boolean;
  next_time: string;
  monitoring_post_minutes?: number;
  /** Siguiente turno laboral (sin «L»); la app lo guarda en AsyncStorage (`next_shift`) para verlo sin conexión. */
  next_shift?: unknown;
  marca: {
    id: number;
    hora_entrada_digitada: string | null;
    hora_salida_digitada: string | null;
    hora_salida_anticipada?: string | null;
    /** Persistidos en `current_marca` para validación local (salida anticipada / tardía). */
    is_late?: boolean;
    is_salida_anticipada?: boolean;
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
        codigo?: string | null;
        nombre: string;
      };
      division: {
        id: number;
        codigo?: string | null;
        nombre: string;
      };
    }
    empresa: {
      id: number;
      codigo?: string | null;
      nombre: string;
    };
    cliente: {
      id: number;
      codigo?: string | null;
      nombre: string;
    };
    contrato: {
      id: number;
      codigo?: string | null;
      nombre: string;
    };
    corpo: {
      id: number;
      codigo?: string | null;
      nombre: string;
      ubicacion: {
        lat: number | null;
        lng: number | null;
      }
    };
    puesto: {
      id: number;
      codigo?: string | null;
      nombre: string;
      tiene_relevo: boolean;
      ubicacion: {
        lat: number | null;
        lng: number | null;
      };
    };
    plaza: {
      id: number;
      codigo?: string | null;
      nombre: string;
    };
    horario: {
      id: number;
      codigo?: string | null;
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
  monitoring_previous_minutes?: number;
  monitoring_post_minutes?: number;
  is_salida_anticipada?: boolean;
  /** El último turno terminó hace más de N horas: no hay turno actual (issue #159). */
  no_active_marca?: boolean;
  horas_eliminar_marca_tras_salida?: number;
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

function resolveMarcaIsSalidaAnticipada(marca: Record<string, unknown> | null | undefined): boolean {
  if (!marca) return false;
  if (typeof marca.is_salida_anticipada === 'boolean') return marca.is_salida_anticipada;
  return marca.hora_salida_anticipada != null;
}

function resolveMarcaIsLate(marca: Record<string, unknown> | null | undefined): boolean {
  if (!marca) return false;
  return marca.is_late === true;
}

/** Turno tipo "L" = día libre: no se permite marcar ingreso. */
function resolveMarcaIsDiaLibre(marca: Record<string, unknown> | null | undefined): boolean {
  if (!marca) return false;
  return String(marca.tipo_turno ?? '').trim().toUpperCase() === 'L';
}

const DIA_LIBRE_INGRESO_MESSAGE =
  'Esta marca corresponde a un día libre. No puedes marcar ingreso.';

const ESPERA_SIGUIENTE_TURNO_MESSAGE = 'Espera a tu siguiente turno; puedes consultarlo en la ventana de "Ver turnos futuros"';

function appendEsperaSiguienteTurnoIfNeeded(
  message: string | null | undefined,
  marca: Record<string, unknown> | null | undefined,
  isAbsent: boolean,
): string {
  const base = String(message ?? '').trim();
  if (!isAbsent || !resolveMarcaIsDiaLibre(marca)) return base;
  if (base.includes(ESPERA_SIGUIENTE_TURNO_MESSAGE)) return base;
  return ESPERA_SIGUIENTE_TURNO_MESSAGE; 
}

function buildMarcaInicioMs(marca: {
  fecha: string;
  hora_inicio: string;
}): number | null {
  try {
    const ms = buildMarcaNaiveMs(marca.fecha, marca.hora_inicio);
    return ms != null && Number.isFinite(ms) ? ms : null;
  } catch {
    return null;
  }
}

function buildMarcaFinMs(marca: {
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
}): number | null {
  try {
    const ms = buildMarcaNaiveMs(marca.fecha, marca.hora_fin, marca.hora_inicio > marca.hora_fin ? 1 : 0);
    return ms != null && Number.isFinite(ms) ? ms : null;
  } catch {
    return null;
  }
}

async function resolveIsLateFromLocalMarca(
  marca: Record<string, unknown> | null | undefined,
  attendanceIsLate?: boolean
): Promise<boolean> {
  if (attendanceIsLate === true) return true;
  if (resolveMarcaIsLate(marca)) return true;

  try {
    const raw = await AsyncStorage.getItem('current_marca');
    if (raw) {
      const stored = JSON.parse(raw) as Record<string, unknown>;
      if (
        marca?.id != null &&
        Number(stored.id) === Number(marca.id) &&
        resolveMarcaIsLate(stored)
      ) {
        return true;
      }
    }
  } catch {
    /* ignore */
  }

  return false;
}

/** Adjunta flags de asistencia a la marca (para persistir en `current_marca`). */
function attachMarcaAttendanceFlags(
  marca: Record<string, unknown>,
  flags: { is_late?: boolean; is_salida_anticipada?: boolean }
): Record<string, unknown> {
  const is_late =
    typeof flags.is_late === 'boolean' ? flags.is_late : resolveMarcaIsLate(marca);
  const is_salida_anticipada =
    typeof flags.is_salida_anticipada === 'boolean'
      ? flags.is_salida_anticipada
      : resolveMarcaIsSalidaAnticipada(marca);
  return {
    ...marca,
    is_late,
    is_salida_anticipada,
  };
}

async function persistCurrentMarcaWithFlags(
  marca: Record<string, unknown>,
  flags?: { is_late?: boolean; is_salida_anticipada?: boolean }
): Promise<Record<string, unknown>> {
  const withFlags = attachMarcaAttendanceFlags(marca, flags ?? {});
  await AsyncStorage.setItem('current_marca', JSON.stringify(withFlags));
  eventBus.emit(CURRENT_MARCA_UPDATED_EVENT, withFlags);
  return withFlags;
}

/** GPS activo obligatorio; caché solo si falla la lectura nueva. Alert de caché solo con DEVICE_COORDS_USER_ACTION. */
async function obtainEntradaCoordinates(opts?: { silent?: boolean }) {
  return resolveMarcaIngresoCoordinates({
    silent: opts?.silent ?? DEVICE_COORDS_POLL_SILENT.silent,
  });
}

/**
 * Versión corta del mensaje de `validateMarcaLocation` para cuando se muestra el botón del mapa:
 * se queda solo con la oración de la regla (sin el encabezado "Ubicación no válida" ni las
 * coordenadas numéricas), p. ej. "Debes estar dentro del radio de 50 metros del puesto para
 * marcar ingreso."
 */
function simplifyOutOfRangeMessage(message: string): string {
  const parts = message.split('\n\n');
  return parts.length >= 2 ? parts[1].trim() : message;
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
  /** Aviso de ubicación para ingreso/salida: mostrar botón Reintentar comprobación GPS. */
  const [showLocationRetry, setShowLocationRetry] = useState(false);
  const [isRefreshingLocation, setIsRefreshingLocation] = useState(false);
  /** Coordenadas para el mapa mostrado cuando el usuario está fuera del radio de 50 m del puesto. */
  const [outOfRangeMapCoords, setOutOfRangeMapCoords] = useState<{
    deviceLat: number;
    deviceLng: number;
    puestoLat: number;
    puestoLng: number;
  } | null>(null);
  /** El mapa de "fuera de rango" solo se abre cuando el usuario pulsa el botón, nunca automáticamente. */
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navigation = useNavigation<MarcarIngresoSalidaScreenNavigationProp>();
  const [horaAccion, setHoraAccion] = useState<number | null>(null);
  const [isMarksModalVisible, setIsMarksModalVisible] = useState(false);
  const [futureMarks, setFutureMarks] = useState<any[]>([]);
  const [isLoadingFutureMarks, setIsLoadingFutureMarks] = useState(false);
  const hasRequestedInitialFetchRef = useRef(false);
  const planillasRevalidationModalShownRef = useRef(false);
  const resumeAfterPlanillasRevalidationRef = useRef(false);
  const fetchAttendanceInFlightRef = useRef(false);
  const [showPlanillasRevalidationModal, setShowPlanillasRevalidationModal] = useState(false);
  /** Aviso informativo entrada (cerrable), mismo patrón que ChecklistSupervisionScreen. */
  const [isEntradaMarcaHintVisible, setIsEntradaMarcaHintVisible] = useState(true);
  const [monitoringPreviousMinutes, setMonitoringPreviousMinutes] = useState<number>(15);
  const [monitoringPostMinutes, setMonitoringPostMinutes] = useState<number>(0);
  const [tiempoGraciaMarcarSalida, setTiempoGraciaMarcarSalida] = useState<number>(15);
  const [validateGpsSalida, setValidateGpsSalida] = useState<boolean>(false);
  /** Re-render del reloj cuando no hay `attendanceData` (hora local CR como respaldo). */
  const [clockTick, setClockTick] = useState(0);
  const [nextShift, setNextShift] = useState<NextShift | null>(null);
  const [futureListRequested, setFutureListRequested] = useState(false);

  // Siguiente turno laboral guardado en el dispositivo: se lee sin conexión.
  useEffect(() => {
    let cancelled = false;
    if (!employee?.id) {
      setNextShift(null);
      return;
    }
    void getNextShiftFromStorage(employee.id).then((stored) => {
      if (!cancelled) setNextShift(stored);
    });
    return () => {
      cancelled = true;
    };
  }, [employee?.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [previousMinutes, postMinutes, graciaSalida, gpsSalida] = await Promise.all([
        getMonitoringPreviousMinutesFromStorage(),
        getMonitoringPostMinutesFromStorage(),
        getTiempoGraciaMarcarSalidaFromStorage(),
        getValidateGpsSalidaFromStorage(),
      ]);
      if (!cancelled) {
        setMonitoringPreviousMinutes(previousMinutes);
        setMonitoringPostMinutes(postMinutes);
        setTiempoGraciaMarcarSalida(graciaSalida);
        setValidateGpsSalida(gpsSalida);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistMonitoringMinutesFromResponse = async (
    payload: {
      monitoring_previous_minutes?: unknown;
      monitoring_post_minutes?: unknown;
      tiempo_gracia_marcar_salida?: unknown;
      validate_gps_salida?: unknown;
      horas_eliminar_marca_tras_salida?: unknown;
    } | null | undefined
  ) => {
    if (payload?.horas_eliminar_marca_tras_salida != null) {
      await setHorasEliminarMarcaStorage(payload.horas_eliminar_marca_tras_salida);
    }
    if (payload?.monitoring_previous_minutes != null) {
      const minutes = await setMonitoringPreviousMinutesStorage(payload.monitoring_previous_minutes);
      setMonitoringPreviousMinutes(minutes);
    }
    if (payload?.monitoring_post_minutes != null) {
      const minutes = await setMonitoringPostMinutesStorage(payload.monitoring_post_minutes);
      setMonitoringPostMinutes(minutes);
    }
    if (payload?.tiempo_gracia_marcar_salida != null) {
      const minutes = await setTiempoGraciaMarcarSalidaStorage(payload.tiempo_gracia_marcar_salida);
      setTiempoGraciaMarcarSalida(minutes);
    }
    if (payload?.validate_gps_salida != null) {
      const enabled = await setValidateGpsSalidaStorage(payload.validate_gps_salida);
      setValidateGpsSalida(enabled);
    }
  };
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
    marcaId: number | null,
    marca?: Record<string, unknown> | null,
  ) => {
    const marcaForRules = marca ?? (attendanceData?.marca as Record<string, unknown> | undefined) ?? null;
    const isLibreAbsent = Boolean(validation.absent) && resolveMarcaIsDiaLibre(marcaForRules);
    setMarkingBlocked(validation.markingBlocked);
    if (validation.message) {
      setErrorMessage(
        appendEsperaSiguienteTurnoIfNeeded(validation.message, marcaForRules, Boolean(validation.absent)),
      );
    } else if (!validation.markingBlocked) {
      setErrorMessage(null);
    }

    if (validation.absent) {
      setAbsentMarcaId(marcaId);
      // Día libre (L): no pedir motivo; el usuario solo espera el siguiente turno.
      setShouldResponseAbsentReason(!isLibreAbsent && validation.should_response === true);
      setShowAbsentReasonForm(!isLibreAbsent && validation.should_response === true);
      setRevertMarcaId(null);
      setShowLocationRetry(false);
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

  /** Actualiza (o limpia) las coordenadas del mapa de "fuera de rango" según el resultado de la validación de ubicación. */
  const updateOutOfRangeMapState = (
    message: string | null | undefined,
    marca: Record<string, unknown>,
    deviceLat: number | null | undefined,
    deviceLng: number | null | undefined,
  ) => {
    if (
      isOutOfRangeLocationMessage(message) &&
      deviceLat != null &&
      deviceLng != null &&
      Number.isFinite(deviceLat) &&
      Number.isFinite(deviceLng)
    ) {
      const puestoCoords = getMarcaPuestoCoords(marca);
      if (puestoCoords) {
        setOutOfRangeMapCoords({
          deviceLat,
          deviceLng,
          puestoLat: puestoCoords.lat,
          puestoLng: puestoCoords.lng,
        });
        return;
      }
    }
    setOutOfRangeMapCoords(null);
  };

  const runLocalValidationForMarca = async (
    marca: Record<string, unknown>,
    nowMs: number,
    opts?: {
      validateLocationForEntrada?: boolean;
      validateLocationForSalida?: boolean;
      lat?: number | null;
      lng?: number | null;
    }
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
      validateLocationForSalida: opts?.validateLocationForSalida ?? false,
      monitoringPreviousMinutes: await getMonitoringPreviousMinutesFromStorage(),
    });
  };

  /** Revalida reglas locales (incl. ausencia por hora de entrada) usando getHoraAccion. */
  const revalidateLocalMarcaOffline = useCallback(
    async (marca: Record<string, unknown>, marcaId: number | null) => {
      const nowMs = await getHoraAccion();
      setHoraAccion(nowMs);

      const marcaWithTime: Record<string, unknown> = { ...marca, current_time: nowMs };
      await setCurrentAttendanceData(marcaWithTime, nowMs, {
        is_late: resolveMarcaIsLate(marca),
        is_salida_anticipada: resolveMarcaIsSalidaAnticipada(marca),
      });

      const validation = await runLocalValidationForMarca(marcaWithTime, nowMs, {
        validateLocationForEntrada: false,
      });
      applyLocalValidationState(validation, marcaId, marca);

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

      return { nowMs, validation };
    },
    []
  );

  /** Si la marca permite marcar ingreso/salida (horario), exige GPS activo y radio de 50 m del puesto (si hay coords). */
  /** Sondeo ~30 s: silent. Reintentar / marcar: Alert si usa caché. */
  const refreshMarkLocationEligibility = async (
    marca: Record<string, unknown>,
    nowMs: number,
    opts?: { silent?: boolean },
  ) => {
    const silent = opts?.silent ?? DEVICE_COORDS_POLL_SILENT.silent;
    const estado = marca.hora_entrada_digitada != null ? 'Ingresado' : 'No ingresado';
    const monitoringMinutes = await getMonitoringPreviousMinutesFromStorage();

    if (estado === 'No ingresado') {
      if (!computeChangeAvailable(marca, nowMs, monitoringMinutes)) {
        setShowLocationRetry(false);
        setOutOfRangeMapCoords(null);
        return;
      }

      const timeValidation = await runLocalValidationForMarca(marca, nowMs, {
        validateLocationForEntrada: false,
        validateLocationForSalida: false,
      });

      if (
        timeValidation.absent ||
        timeValidation.markingBlocked ||
        !timeValidation.canMarkEntrada
      ) {
        setShowLocationRetry(false);
        setOutOfRangeMapCoords(null);
        return;
      }

      const coords = await obtainEntradaCoordinates({ silent });
      if (!coords.ok) {
        setLocalCanMarkEntrada(false);
        setErrorMessage(coords.message);
        setShowLocationRetry(true);
        setOutOfRangeMapCoords(null);
        return;
      }

      const loc = validateMarcaLocation(marca, coords.latitude, coords.longitude);
      if (!loc.ok) {
        setLocalCanMarkEntrada(false);
        setErrorMessage(loc.message);
        setShowLocationRetry(true);
        updateOutOfRangeMapState(loc.message, marca, coords.latitude, coords.longitude);
        return;
      }

      setLocalCanMarkEntrada(true);
      setShowLocationRetry(false);
      setOutOfRangeMapCoords(null);
      if (!timeValidation.message) {
        setErrorMessage(null);
      }
      return;
    }

    // Salida: geocerca solo si validate_gps_salida está activo y el puesto tiene coordenadas.
    if (marca.hora_salida_digitada != null) {
      setShowLocationRetry(false);
      setOutOfRangeMapCoords(null);
      return;
    }

    const gpsSalidaEnabled = await getValidateGpsSalidaFromStorage();
    if (!gpsSalidaEnabled || !hasMarcaPuestoCoordinates(marca)) {
      setShowLocationRetry(false);
      setLocalCanMarkSalida(true);
      setOutOfRangeMapCoords(null);
      return;
    }

    if (!computeChangeAvailable(marca, nowMs, monitoringMinutes)) {
      setShowLocationRetry(false);
      setOutOfRangeMapCoords(null);
      return;
    }

    const timeValidation = await runLocalValidationForMarca(marca, nowMs, {
      validateLocationForEntrada: false,
      validateLocationForSalida: false,
    });

    if (timeValidation.markingBlocked || !timeValidation.canMarkSalida) {
      setShowLocationRetry(false);
      setOutOfRangeMapCoords(null);
      return;
    }

    const coords = await obtainEntradaCoordinates({ silent });
    if (!coords.ok) {
      setLocalCanMarkSalida(false);
      setErrorMessage(coords.message);
      setShowLocationRetry(true);
      setOutOfRangeMapCoords(null);
      return;
    }

    const loc = validateMarcaLocation(marca, coords.latitude, coords.longitude);
    if (!loc.ok) {
      setLocalCanMarkSalida(false);
      setErrorMessage(loc.message);
      setShowLocationRetry(true);
      updateOutOfRangeMapState(loc.message, marca, coords.latitude, coords.longitude);
      return;
    }

    setLocalCanMarkSalida(true);
    setShowLocationRetry(false);
    setOutOfRangeMapCoords(null);
    if (!timeValidation.message) {
      setErrorMessage(null);
    }
  };

  const handleRetryLocationCheck = async () => {
    if (!attendanceData?.marca || isRefreshingLocation) return;
    setIsRefreshingLocation(true);
    try {
      const nowMs = await getHoraAccion();
      setHoraAccion(nowMs);
      await refreshMarkLocationEligibility(
        attendanceData.marca as Record<string, unknown>,
        nowMs,
        DEVICE_COORDS_USER_ACTION,
      );
    } finally {
      setIsRefreshingLocation(false);
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

    await persistMonitoringMinutesFromResponse(errorData);
    await applyNomenclatorsFromAttendanceMarca(marcaPayload);

    const nowMs = Number(marcaPayload.current_time) || horaAccionValue || Date.now();
    await setCurrentAttendanceData(marcaPayload, nowMs, {
      is_salida_anticipada:
        typeof errorData.is_salida_anticipada === 'boolean'
          ? errorData.is_salida_anticipada
          : resolveMarcaIsSalidaAnticipada(marcaPayload),
      is_late: resolveMarcaIsLate(marcaPayload),
    });

    const validation = await runLocalValidationForMarca(marcaPayload, nowMs, {
      validateLocationForEntrada: false,
    });
    applyLocalValidationState(
      validation,
      marcaPayload.id != null ? Number(marcaPayload.id) : null,
      marcaPayload,
    );

    if (errorData.absent === true) {
      setAbsentMarcaId(errorData.marca_id ?? (marcaPayload.id != null ? Number(marcaPayload.id) : null));
      const isLibreAbsent = resolveMarcaIsDiaLibre(marcaPayload);
      setShouldResponseAbsentReason(!isLibreAbsent && errorData.should_response === true);
      setShowAbsentReasonForm(!isLibreAbsent && errorData.should_response === true);
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

    setErrorMessage(
      appendEsperaSiguienteTurnoIfNeeded(
        errorData.message,
        marcaPayload,
        errorData.absent === true,
      ),
    );
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

  // Cuando se puede marcar ingreso o salida: revalidar GPS y radio de 50 m (sin bloquear la descarga de la marca).
  useEffect(() => {
    if (!attendanceData?.marca || isProcessingMark || isLoadingData) return;
    if (
      attendanceData.estado !== 'No ingresado' &&
      attendanceData.estado !== 'Ingresado'
    ) {
      return;
    }
    if (
      attendanceData.estado === 'Ingresado' &&
      attendanceData.marca?.hora_salida_digitada != null
    ) {
      return;
    }

    let cancelled = false;

    const tick = async () => {
      if (cancelled || isProcessingMark || isLoadingData) return;
      const nowMs = await getHoraAccion();
      setHoraAccion(nowMs);
      await refreshMarkLocationEligibility(
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
    attendanceData?.marca?.hora_salida_digitada,
    isProcessingMark,
    isLoadingData,
  ]);

  const requestPlanillasRevalidationIfNeeded = async (horaAccionMs: number): Promise<boolean> => {
    const tokenCheck = await isStoredPlanillasTokenValid(horaAccionMs);
    if (tokenCheck.valid) {
      planillasRevalidationModalShownRef.current = false;
      return true;
    }

    if (!planillasRevalidationModalShownRef.current) {
      planillasRevalidationModalShownRef.current = true;
      setShowPlanillasRevalidationModal(true);
    }

    return false;
  };

  const handlePlanillasRevalidationSuccess = () => {
    setShowPlanillasRevalidationModal(false);
    resumeAfterPlanillasRevalidationRef.current = true;
    void fetchAttendanceStatus();
  };

  const handlePlanillasRevalidationDismiss = () => {
    planillasRevalidationModalShownRef.current = false;
    resumeAfterPlanillasRevalidationRef.current = false;
    setShowPlanillasRevalidationModal(false);
    navigation.goBack();
  };

  const fetchAttendanceStatus = async () => {
    if (fetchAttendanceInFlightRef.current) {
      return;
    }

    fetchAttendanceInFlightRef.current = true;

    try {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      const horaAccionValue = await getHoraAccion();
      if (horaAccionValue) {
        setHoraAccion(horaAccionValue);
      }

      // Un turno que terminó hace más de N horas (nomenclador) deja de ser el turno actual: se elimina del almacenamiento antes de usarlo,
      // también sin conexión (con las horas guardadas la última vez).
      await removeCurrentMarcaIfExpired(horaAccionValue || undefined);

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
          await refreshMarkLocationEligibility(marca_send, nowMs);
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

      const referenceMs = horaAccionValue || Date.now();
      if (resumeAfterPlanillasRevalidationRef.current) {
        resumeAfterPlanillasRevalidationRef.current = false;
        planillasRevalidationModalShownRef.current = false;

        const tokenAfterRefresh = await isStoredPlanillasTokenValid(referenceMs);
        if (!tokenAfterRefresh.valid) {
          await requestPlanillasRevalidationIfNeeded(referenceMs);
          return;
        }
      } else {
        const hasValidPlanillasToken = await requestPlanillasRevalidationIfNeeded(referenceMs);
        if (!hasValidPlanillasToken) {
          return;
        }
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

      const planillasTokenCheck = await isStoredPlanillasTokenValid(referenceMs);
      const planillasToken = planillasTokenCheck.token;
      const attendanceUserUrl = `${apiUrl}/api/attendance/user/${employee.id}`;

      const response = await authedFetch({
        url: attendanceUserUrl,
        init: {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Planillas-Token': encodeURIComponent(planillasToken ?? ''),
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

      // Siguiente turno laboral: se guarda (o se limpia si ya no hay) para consultarlo sin conexión. Un servidor sin este dato no lo borra.
      if (data && Object.prototype.hasOwnProperty.call(data, 'next_shift')) {
        await setNextShiftStorage(data.next_shift, employee.id);
        setNextShift(await getNextShiftFromStorage(employee.id));
      }

      console.log('Response got from the server', data);

      result = data.status;

      console.log('Result', data.marca);

      if (result) {
        marca_send = data.marca;
        await persistMonitoringMinutesFromResponse(data);
        await applyNomenclatorsFromAttendanceMarca(marca_send);

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
        await persistCurrentMarcaWithFlags(marca_send, {
          is_late: data.is_late,
          is_salida_anticipada: data.is_salida_anticipada,
        });
      }

      if (result) {
        setMarkingBlocked(false);
        setRevertMarcaId(null);
        await setCurrentAttendanceData(marca_send, horaAccionValue || Date.now(), {
          is_late: data.is_late,
          is_salida_anticipada: data.is_salida_anticipada,
        });

        const validation = await runLocalValidationForMarca(marca_send, horaAccionValue || Date.now(), {
          validateLocationForEntrada: false,
          validateLocationForSalida: false,
        });
        applyLocalValidationState(
          validation,
          marca_send.id != null ? Number(marca_send.id) : null,
          marca_send as Record<string, unknown>,
        );
        await refreshMarkLocationEligibility(
          marca_send as Record<string, unknown>,
          horaAccionValue || Date.now()
        );

        console.log("shouldUpdateData", shouldUpdateData);
        if (shouldUpdateData && marca_send) {
          try {
            let horaAccion = marca_send.hora_entrada_digitada ? new Date(marca_send.hora_entrada_digitada).getTime() : await getHoraAccion() as number;
            await hydrateAfterEntrada(marca_send, horaAccion, false);
            Alert.alert('Éxito', 'Ingreso registrado correctamente');
            requestBackgroundMainStructureDownload({ refreshAccessToken, logout }, marca_send);
          } catch (hydrateError) {
            console.error('Error hydrating auto-ingreso:', hydrateError);
          }
        }
      } else if ((data as AttendanceErrorResponse)?.no_active_marca) {
        // El servidor indica que el último turno ya terminó hace más de N horas: no hay turno actual hasta que empiece el siguiente.
        const noActive = data as AttendanceErrorResponse;
        await persistMonitoringMinutesFromResponse(noActive);
        await removeCurrentMarca();
        setAttendanceData(null);
        setMarkingBlocked(false);
        setRevertMarcaId(null);
        setShouldResponseAbsentReason(false);
        setErrorMessage(noActive.message);
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
      fetchAttendanceInFlightRef.current = false;
    }
  };

  const setCurrentAttendanceData = async (
    data: any,
    horaAccionValue: number,
    serverFlags?: { is_late?: boolean; is_salida_anticipada?: boolean }
  ) => {
    const marca = data;
    const monitoringMinutes = await getMonitoringPreviousMinutesFromStorage();
    const postMinutes = await getMonitoringPostMinutesFromStorage();

    const fecha = marca.fecha.split('-');
    fecha[2] = fecha[2].slice(0, 2);

    const estado = marca.hora_entrada_digitada != null ? "Ingresado" : "No ingresado";

    // Inicio y fin del turno como hora de reloj de CR en UTC (mismo convenio que `getHoraAccion`), sin depender de la zona horaria
    // del dispositivo. Solo el FIN suma un día si el turno cruza la medianoche; el inicio siempre es el de la fecha de la marca.
    const crossesMidnight = marca.hora_inicio > marca.hora_fin;
    // Una marca sin hora de inicio o de fin se muestra igual (como el servidor): el inicio cae a las 00:00 del día de la marca y el fin a las 23:59:59.
    const inicioTurnoMs = buildMarcaNaiveMs(marca.fecha, marca.hora_inicio) ?? buildMarcaNaiveMs(marca.fecha, '1970-01-01T00:00:00.000Z') ?? NaN;
    const finTurnoMs = buildMarcaNaiveMs(marca.fecha, marca.hora_fin, crossesMidnight ? 1 : 0) ?? buildMarcaNaiveMs(marca.fecha, '1970-01-01T23:59:59.000Z') ?? NaN;

    const inicioTurno = new Date(inicioTurnoMs);
    const next_time = new Date(estado == "No ingresado" ? inicioTurnoMs : finTurnoMs);
    const next_change_time = new Date(next_time.getTime() - monitoringMinutes * 60 * 1000);

    let change_available = true;
    let is_late = resolveMarcaIsLate(marca);

    const now = horaAccionValue;

    if (estado == "No ingresado") {
      if (now < next_change_time.getTime()) {
        change_available = false;
      }
      // Solo recalcular is_late si aún no viene persistido/servidor.
      if (typeof serverFlags?.is_late !== 'boolean' && typeof marca.is_late !== 'boolean') {
        const lateThreshold = inicioTurno.getTime() + postMinutes * 60 * 1000;
        if (now > lateThreshold) {
          is_late = true;
        }
      }
    } else if (
      typeof serverFlags?.is_late !== 'boolean' &&
      typeof marca.is_late !== 'boolean' &&
      marca.hora_entrada_digitada
    ) {
      const lateThreshold = inicioTurno.getTime() + postMinutes * 60 * 1000;
      is_late = new Date(marca.hora_entrada_digitada).getTime() > lateThreshold;
    }

    if (typeof serverFlags?.is_late === 'boolean') {
      is_late = serverFlags.is_late;
    }
    // Sin hora de inicio o de fin no hay horario contra el cual medir: no hay tardía.
    if (!tieneHorarioCompleto(marca.hora_inicio, marca.hora_fin)) is_late = false;

    const is_salida_anticipada =
      typeof serverFlags?.is_salida_anticipada === 'boolean'
        ? serverFlags.is_salida_anticipada
        : resolveMarcaIsSalidaAnticipada(marca);

    const marcaWithFlags = await persistCurrentMarcaWithFlags(
      { ...marca, current_time: marca.current_time ?? data.current_time },
      { is_late, is_salida_anticipada }
    );

    const attendance_save = {
      estado: estado,
      is_late: is_late,
      is_salida_anticipada,
      change_available: change_available,
      next_time: next_time.toISOString(),
      current_time: toZonedTime(new Date(data.current_time), "America/Costa_Rica").toISOString(),
      monitoring_post_minutes: postMinutes,
      marca: marcaWithFlags as AttendanceSuccessResponse['marca'],
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

    if (
      attendanceData.estado === 'No ingresado' &&
      resolveMarcaIsDiaLibre(attendanceData.marca as Record<string, unknown>)
    ) {
      Alert.alert('Día libre', DIA_LIBRE_INGRESO_MESSAGE);
      return;
    }

    if (
      attendanceData.estado === 'No ingresado' &&
      resolveMarcaIsSalidaAnticipada(attendanceData.marca as Record<string, unknown>)
    ) {
      Alert.alert(
        'No permitido',
        'No puedes marcar ingreso porque esta marca tiene salida anticipada.'
      );
      return;
    }

    const action = attendanceData.estado === 'No ingresado' ? 'ingresar' : 'salir';
    const actionText = attendanceData.estado === 'No ingresado' ? 'Ingresar' : 'Salir';
    const actionExtraText = attendanceData.estado === 'No ingresado' ? '' : ' Si lo haces, habrán opciones del menú que no estarán disponibles.';

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
  ): Promise<
    | { ok: true; horaAccionMs: number; lat: number | null; lng: number | null }
    | { ok: false; message: string }
  > => {
    if (!attendanceData?.marca) {
      return { ok: false, message: 'No se encontró la marca.' };
    }

    if (type === 'entrada' && resolveMarcaIsDiaLibre(attendanceData.marca as Record<string, unknown>)) {
      return {
        ok: false,
        message: DIA_LIBRE_INGRESO_MESSAGE,
      };
    }

    if (type === 'entrada' && resolveMarcaIsSalidaAnticipada(attendanceData.marca as Record<string, unknown>)) {
      return {
        ok: false,
        message: 'No puedes marcar ingreso porque esta marca tiene salida anticipada. Si deseas revertirlo, contacta con la administración de tu puesto.',
      };
    }

    const nowMs = await getHoraAccion();
    setHoraAccion(nowMs);

    let lat: number | null = null;
    let lng: number | null = null;
    const marcaRecord = attendanceData.marca as Record<string, unknown>;

    if (type === 'entrada') {
      const coords = await obtainEntradaCoordinates(DEVICE_COORDS_USER_ACTION);
      if (!coords.ok) {
        return {
          ok: false,
          message: coords.message || 'No se pudo obtener la ubicación para marcar ingreso.',
        };
      }
      lat = coords.latitude;
      lng = coords.longitude;
    } else if (type === 'salida') {
      const gpsSalidaEnabled = await getValidateGpsSalidaFromStorage();
      if (gpsSalidaEnabled) {
        if (!(await evaluateInternetConnection())) {
          return {
            ok: false,
            message:
              'La validación GPS de salida está activa. Debes tener conexión a internet para marcar la salida.',
          };
        }
        if (hasMarcaPuestoCoordinates(marcaRecord)) {
          const coords = await obtainEntradaCoordinates(DEVICE_COORDS_USER_ACTION);
          if (!coords.ok) {
            return {
              ok: false,
              message: coords.message || 'No se pudo obtener la ubicación para marcar salida.',
            };
          }
          lat = coords.latitude;
          lng = coords.longitude;
        }
      }
    }

    const gpsSalidaEnabled =
      type === 'salida' ? await getValidateGpsSalidaFromStorage() : false;

    const validation = await runLocalValidationForMarca(
      marcaRecord,
      nowMs,
      {
        lat,
        lng,
        validateLocationForEntrada: type === 'entrada',
        validateLocationForSalida: type === 'salida' && gpsSalidaEnabled,
      }
    );

    applyLocalValidationState(
      validation,
      attendanceData.marca.id != null ? Number(attendanceData.marca.id) : null,
      attendanceData.marca as Record<string, unknown>,
    );
    updateOutOfRangeMapState(validation.message, marcaRecord, lat, lng);

    if (validation.absent) {
      return {
        ok: false,
        message: validation.message || 'No has marcado la entrada para este turno.',
      };
    }

    if (type === 'entrada' && !validation.canMarkEntrada) {
      if (lat != null && lng != null) {
        setShowLocationRetry(true);
      }
      return {
        ok: false,
        message: validation.message || 'No puedes marcar entrada en este momento.',
      };
    }
    if (type === 'salida' && !validation.canMarkSalida) {
      if (lat != null && lng != null) {
        setShowLocationRetry(true);
      }
      return {
        ok: false,
        message: validation.message || 'No puedes marcar salida en este momento.',
      };
    }

    if (type === 'salida') {
      const inicioMs = buildMarcaInicioMs(attendanceData.marca);
      if (inicioMs != null && nowMs < inicioMs) {
        return {
          ok: false,
          message:
            'Aún no llega la hora de entrada del turno. Solo puedes marcar salida después de esa hora.',
        };
      }
    }

    return { ok: true, horaAccionMs: nowMs, lat, lng };
  };

  const executeToggleAttendance = async () => {
    if (!attendanceData) return;

    if (attendanceData.marca?.hora_salida_digitada != null) {
      Alert.alert('Información', 'Ya has marcado la salida.');
      return;
    }

    if (
      attendanceData.estado === 'No ingresado' &&
      resolveMarcaIsDiaLibre(attendanceData.marca as Record<string, unknown>)
    ) {
      Alert.alert('Día libre', DIA_LIBRE_INGRESO_MESSAGE);
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

        const inicioMs = buildMarcaInicioMs(attendanceData.marca);
        if (inicioMs != null && now < inicioMs) {
          Alert.alert(
            'Salida no permitida',
            'Aún no llega la hora de entrada del turno. Solo puedes marcar salida después de esa hora.'
          );
          return;
        }

        // Geocerca local solo si validate_gps_salida está activo.
        const marcaRecord = attendanceData.marca as Record<string, unknown>;
        const gpsSalidaEnabled = await getValidateGpsSalidaFromStorage();
        if (gpsSalidaEnabled) {
          if (!(await evaluateInternetConnection())) {
            Alert.alert(
              'Conexión requerida',
              'La validación GPS de salida está activa. Debes tener conexión a internet para marcar la salida.'
            );
            return;
          }
          if (hasMarcaPuestoCoordinates(marcaRecord)) {
            const coords = await obtainEntradaCoordinates(DEVICE_COORDS_USER_ACTION);
            if (!coords.ok) {
              setLocalCanMarkSalida(false);
              setErrorMessage(coords.message);
              setShowLocationRetry(true);
              setOutOfRangeMapCoords(null);
              Alert.alert(
                'Ubicación requerida',
                coords.message || 'No se pudo obtener la ubicación para marcar salida.',
              );
              return;
            }
            const loc = validateMarcaLocation(marcaRecord, coords.latitude, coords.longitude);
            if (!loc.ok) {
              setLocalCanMarkSalida(false);
              setErrorMessage(loc.message);
              setShowLocationRetry(true);
              updateOutOfRangeMapState(loc.message, marcaRecord, coords.latitude, coords.longitude);
              Alert.alert('Ubicación no válida', loc.message);
              return;
            }
            setLocalCanMarkSalida(true);
            setShowLocationRetry(false);
            setOutOfRangeMapCoords(null);
          }
        }

        const next_time_ms = buildMarcaFinMs(attendanceData.marca);
        if (next_time_ms == null) {
          throw new Error('No se pudo calcular la hora de salida del turno');
        }

        // Validación local de salida anticipada vs normal (tiempo_gracia_marcar_salida).
        const graciaMinutes = await getTiempoGraciaMarcarSalidaFromStorage();
        const anticipadaThresholdMs = next_time_ms - graciaMinutes * 60 * 1000;
        if (now < anticipadaThresholdMs) {
          Alert.alert(
            'Salida anticipada',
            'Aún no llega la hora de salida. Si continúas, deberás indicar el motivo de la salida anticipada.',
            [
              { text: 'Cancelar', style: 'cancel' },
              {
                text: 'Continuar',
                onPress: () => setIsModalVisible(true),
              },
            ]
          );
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
      await resetLunchTimeCompleted();
      await cleanAsyncStorage();

      try {
        const { collectPendingSyncLocalFileNames } = await import('@/hooks/collectPendingSyncLocalFileNames');
        const preserveFiles = await collectPendingSyncLocalFileNames();
        await deleteAllFiles(preserveFiles);
      } catch (fileErr) {
        console.warn('Error borrando archivos locales (expo-file-system) al ingresar:', fileErr);
      }

      const postMinutes = await getMonitoringPostMinutesFromStorage();
      let isLate = resolveMarcaIsLate(marca);
      try {
        const inicioTurnoMs = marca.hora_inicio ? buildMarcaNaiveMs(marca.fecha, marca.hora_inicio) : null;
        if (inicioTurnoMs != null) {
          const lateThreshold = inicioTurnoMs + postMinutes * 60 * 1000;
          isLate = horaAccionValue > lateThreshold;
        }
      } catch {
        /* keep previous isLate */
      }

      const updatedMarca = await persistCurrentMarcaWithFlags(
        {
          ...marca,
          hora_entrada_digitada: new Date(horaAccionValue).toISOString(),
        },
        {
          is_late: isLate,
          is_salida_anticipada: resolveMarcaIsSalidaAnticipada(marca),
        }
      );

      await AsyncStorage.multiRemove(['visitors_cache', 'vehicles_cache']);

      setAttendanceData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          estado: 'Ingresado',
          is_late: isLate,
          is_salida_anticipada: resolveMarcaIsSalidaAnticipada(updatedMarca),
          marca: updatedMarca as AttendanceSuccessResponse['marca'],
        } as AttendanceSuccessResponse;
      });

      if (shouldRefreshStatus) {
        await fetchAttendanceStatus();
      }

      void Promise.all([
        getLunchTimeConfig(Number(updatedMarca.id)),
        getActivities(Number(updatedMarca.id)),
      ]);
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

    const actionHoraAccion = preCheck.horaAccionMs;
    const actionCords = { lat: preCheck.lat?.toString() || null, lng: preCheck.lng?.toString() || null };

      if (type === 'salida') {
        const gpsSalidaEnabled = await getValidateGpsSalidaFromStorage();
        if (gpsSalidaEnabled && !(await evaluateInternetConnection())) {
          setIsProcessingMark(false);
          setProcessingType(null);
          Alert.alert(
            'Conexión requerida',
            'La validación GPS de salida está activa. Debes tener conexión a internet para marcar la salida.'
          );
          return;
        }

        const finMs = buildMarcaFinMs(attendanceData.marca);
        const graciaMinutes = await getTiempoGraciaMarcarSalidaFromStorage();
        const isAnticipada =
          finMs != null && actionHoraAccion < finMs - graciaMinutes * 60 * 1000;

        if (await evaluateInternetConnection()) {
          const hasValidPlanillasToken = await requestPlanillasRevalidationIfNeeded(actionHoraAccion);
          if (!hasValidPlanillasToken) {
            setIsProcessingMark(false);
            setProcessingType(null);
            return;
          }

          data = await saveMarca({
            data_params: { type, reason, horaAccion: actionHoraAccion, cords: actionCords },
            marcaId: attendanceData.marca.id,
            refreshAccessToken,
            logout,
          });
        } else {
          await appendAttendanceAction({
            type: 'salida',
            marcaId: attendanceData.marca.id,
            reason: reason ?? '',
            horaAccion: actionHoraAccion,
          });
          const rawMarca = await AsyncStorage.getItem('current_marca');
          if (rawMarca) {
            try {
              const m = JSON.parse(rawMarca);
              if (Number(m.id) === Number(attendanceData.marca.id)) {
                m.hora_salida_digitada = new Date(actionHoraAccion).toISOString();
                if (isAnticipada) {
                  m.is_salida_anticipada = true;
                  m.hora_salida_anticipada = new Date(actionHoraAccion).toISOString();
                }
                await persistCurrentMarcaWithFlags(m, {
                  is_salida_anticipada: isAnticipada || resolveMarcaIsSalidaAnticipada(m),
                });
              }
            } catch {
              /* ignore */
            }
          }
          data = { status: true, message: 'Salida registrada localmente. Se sincronizará al recuperar conexión.' };
        }
      } else if (await evaluateInternetConnection()) {
        const hasValidPlanillasToken = await requestPlanillasRevalidationIfNeeded(actionHoraAccion);
        if (!hasValidPlanillasToken) {
          setIsProcessingMark(false);
          setProcessingType(null);
          return;
        }

        data = await saveMarca({
          data_params: { type, reason, horaAccion: actionHoraAccion, cords: actionCords },
          marcaId: attendanceData.marca.id,
          refreshAccessToken,
          logout,
        });
      } else {
        data = { status: false, message: 'No hay conexión a internet. Por favor, intenta nuevamente.' };
      }

    if (data.status) {
      setRevertMarcaId(null);
      let entradaMarca: any = null;
      try {
        if (type === 'entrada') {
          if (attendanceData) {
            await hydrateAfterEntrada(attendanceData.marca, actionHoraAccion, true);
            entradaMarca = attendanceData.marca;
          }
        } else {
          const raw = await AsyncStorage.getItem('current_marca');
          if (raw) {
            try {
              const m = JSON.parse(raw);
              if (Number(m.id) === Number(attendanceData.marca.id)) {
                m.hora_salida_digitada = new Date(actionHoraAccion).toISOString();
                await persistCurrentMarcaWithFlags(m);
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

      if (type === 'entrada' && entradaMarca) {
        requestBackgroundMainStructureDownload({ refreshAccessToken, logout }, entradaMarca);
      }
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
        PLANILLAS_TOKEN_KEY,
        PLANILLAS_TOKEN_EXPIRES_AT_KEY,
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
        'tipo_clientes_quejas_cache',
        'last_location',
        'monitoring_previous_minutes',
        'monitoring_post_minutes',
        'tiempo_gracia_marcar_salida',
        'validate_gps_salida',
        NEXT_SHIFT_KEY,
        ATTENDANCE_ACTIONS_KEY,
      ];
      const keys = await AsyncStorage.getAllKeys();

      const keysToDelete = keys.filter((key) => {
        if (exceptions.includes(key)) return false;
        if (isPendingWorkKey(key)) return false; // colas, firma pendiente y registros de caducidad (issue #176)
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

  const handleMenuPress = () => {
    setIsMenuVisible(true);
  };

  const handleMenuClose = () => {
    setIsMenuVisible(false);
  };

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'warning': return <Ionicons name="alert-circle-outline" size={18} color='#8A5300' />;
      case 'retry': return <Ionicons name="refresh" size={20} color='#FFFFFF' />;
      case 'start': return <Ionicons name="enter-outline" size={22} color='#FFFFFF' />;
      case 'end': return <Ionicons name="exit-outline" size={22} color='#FFFFFF' />;
      case 'confirm': return <Ionicons name="checkmark" size={22} color='#FFFFFF' />;
      case 'cancel': return <Ionicons name="close" size={22} color='#FFFFFF' />;
      case 'marcar-ingreso-salida': return <Ionicons name="time-outline" size={22} color='#000000' />;
      default: return <Ionicons name="close" size={22} color='#FFFFFF' />;
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
      await persistCurrentMarcaWithFlags(m);
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
        const hasValidPlanillasToken = await requestPlanillasRevalidationIfNeeded(horaRev);
        if (!hasValidPlanillasToken) {
          return;
        }

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

    const marca = attendanceData?.marca as Record<string, unknown> | undefined;
    const isAnticipada =
      resolveMarcaIsSalidaAnticipada(marca || {}) ||
      Boolean(attendanceData?.is_salida_anticipada);

    if (isAnticipada) {
      Alert.alert(
        'No se puede revertir',
        'Si desea revertir la salida anticipada, debe contactarse con administración de su puesto.'
      );
      return;
    }

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

  const handleModalConfirm = async () => {
    if (exitReason.trim() === '') {
      Alert.alert('Error', 'Por favor, ingresa una razón para la salida temprana.');
      return;
    }

    if (!attendanceData?.marca) {
      Alert.alert('Error', 'No se encontró la marca.');
      return;
    }

    const nowMs = (horaAccion as number) || (await getHoraAccion()) || Date.now();
    const inicioMs = buildMarcaInicioMs(attendanceData.marca);
    if (inicioMs != null && nowMs < inicioMs) {
      setIsModalVisible(false);
      setExitReason('');
      Alert.alert(
        'Salida no permitida',
        'Aún no llega la hora de entrada del turno. Solo puedes marcar salida después de esa hora.'
      );
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

  /** «DD-MM-AAAA HH:mm» del momento actual, en una sola línea: servidor vía marca, `horaAccion`, o reloj local CR. */
  const getDisplayDateTimeText = (): string => {
    void clockTick;
    if (attendanceData?.current_time) {
      try {
        return `${formatFechaDMY(attendanceData.current_time)} ${getNextTime(attendanceData.current_time)}`;
      } catch {
        return '—';
      }
    }
    if (horaAccion != null && Number.isFinite(Number(horaAccion))) {
      return formatDateTimeLine(Number(horaAccion));
    }
    try {
      return format(toZonedTime(new Date(), 'America/Costa_Rica'), 'dd-MM-yyyy HH:mm');
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
      if (resolveMarcaIsDiaLibre(attendanceData.marca as Record<string, unknown>)) return true;
      if (resolveMarcaIsSalidaAnticipada(attendanceData.marca as Record<string, unknown>)) return true;
      if (!localCanMarkEntrada || !attendanceData.change_available) return true;
    }

    if (attendanceData.estado === 'Ingresado') {
      if (!localCanMarkSalida) return true;
      if (!attendanceData.change_available) return true;
    }

    return false;
  }

  /** «DD-MM-AAAA HH:mm» a partir de un ISO guardado por el servidor. */
  const convertDateToLocal = (date: string) => {
    return `${formatFechaDMY(date)} ${getNextTime(date)}`;
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

  /** Abre «Turnos futuros»: muestra el turno laboral más próximo (guardado, sin conexión). La lista de 30 días solo se busca a petición. */
  const handleOpenFutureMarksModal = async () => {
    if (!employee?.id) {
      Alert.alert('Error', 'No se encontró el ID del empleado.');
      return;
    }
    setFutureListRequested(false);
    setFutureMarks([]);
    setIsMarksModalVisible(true);
    try {
      const [stored, nowMs] = await Promise.all([getNextShiftFromStorage(employee.id), getHoraAccion()]);
      setNextShift(stored);
      const ref = Number(nowMs);
      if (Number.isFinite(ref) && ref > 0) setHoraAccion(ref);
    } catch {
      /* se muestra lo que ya hay en pantalla */
    }
  };

  const handleCloseFutureMarksModal = () => {
    setIsMarksModalVisible(false);
    setFutureListRequested(false);
    setFutureMarks([]);
  };

  /** La búsqueda de los próximos 30 días consulta un día a la vez en el servidor: se pide confirmación antes de hacerla. */
  const handleRequestFutureList = () => {
    Alert.alert(
      'Buscar turnos',
      'Se buscarán los turnos de los próximos 30 días. Requiere conexión a internet y puede tardar unos segundos. ¿Deseas continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Buscar',
          onPress: () => {
            void (async () => {
              if (!(await evaluateInternetConnection())) {
                Alert.alert('Sin conexión', 'Necesitas conexión a internet para buscar los turnos de los próximos 30 días.');
                return;
              }
              setFutureListRequested(true);
              await fetchFutureMarks();
            })();
          },
        },
      ],
      { cancelable: true }
    );
  };

  const fetchFutureMarks = async () => {
    if (!employee?.id) return;

    try {
      setIsLoadingFutureMarks(true);
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) {
        throw new Error('Server URL not configured');
      }

      const referenceMs = (await getHoraAccion()) || Date.now();
      // La lista de próximos días se arma en el render con esta hora (getHoraAccion), no con el reloj del dispositivo.
      setHoraAccion(referenceMs);
      const hasValidPlanillasToken = await requestPlanillasRevalidationIfNeeded(referenceMs);
      if (!hasValidPlanillasToken) {
        setFutureMarks([]);
        return;
      }

      const planillasTokenCheck = await isStoredPlanillasTokenValid(referenceMs);
      const planillasToken = planillasTokenCheck.token;

      const response = await authedFetch({
        url: `${apiUrl}/api/attendance/user/${employee.id}/next`,
        init: {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Planillas-Token': encodeURIComponent(planillasToken ?? ''),
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
      if (data.status && Array.isArray(data.marcas)) {
        setFutureMarks(data.marcas);
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
      // «Hoy» sale de getHoraAccion (hora de CR en UTC, guardada en `horaAccion` al cargar las marcas), no del reloj del dispositivo.
      const referenceMs = Number(horaAccion);
      const refDate = new Date(Number.isFinite(referenceMs) ? referenceMs : NaN);
      const todayUtcMs = Number.isNaN(refDate.getTime())
        ? NaN
        : Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth(), refDate.getUTCDate());
      const next30Days = (Number.isNaN(todayUtcMs) ? [] : Array.from({ length: 30 }, (_, index) => index)).map((index) => {
        const isoDate = new Date(todayUtcMs + index * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
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
              {dayMarks.length === 0 || (dayMarks.length === 1 && isDiaLibreTurno(dayMarks[0].tipo_turno)) ? (
                <ThemedText style={styles.marksEmptyText}>
                  Tienes libre este día
                </ThemedText>
              ) : (
                dayMarks.map((mark, index) => {
                  const horaInicioStr = formatHora(mark.hora_inicio);
                  const horaFinStr = formatHora(mark.hora_fin);

                  const tipoTurno = tipoTurnoLabel(mark.tipo_turno);

                  return (
                    <ThemedView key={mark.id || index} style={styles.markItem}>
                      <ThemedView style={styles.markItemHeader}>
                        <Ionicons name="calendar-outline" size={18} color="#007AFF" />
                        <ThemedText style={styles.markItemTime}>{formatDateDMY(mark.fecha)}</ThemedText>
                      </ThemedView>
                      {tieneHorarioCompleto(mark.hora_inicio, mark.hora_fin) ? (
                        <ThemedView style={styles.markItemHeader}>
                          <Ionicons name="time-outline" size={18} color="#007AFF" />
                          <ThemedText style={styles.markItemTime}>{`${horaInicioStr} - ${horaFinStr}`}</ThemedText>
                        </ThemedView>
                      ) : null}
                      <ThemedView style={styles.markItemDetails}>
                      {shiftInfoRows(mark).map((row) => (
                        <ThemedView key={row.label} style={styles.markItemRow}>
                          <ThemedText style={styles.markItemTitle}>{row.label}</ThemedText>
                          <ThemedText style={styles.markItemValue}>
                            {row.label === 'Puesto' && mark.puesto?.tiene_relevo ? `${row.value} (Tiene relevo)` : row.value}
                          </ThemedText>
                        </ThemedView>
                      ))}
                      <ThemedView style={styles.markItemRow}>
                        <ThemedText style={styles.markItemTitle}>
                          Turno
                        </ThemedText>
                        <ThemedText style={styles.markItemValue}>
                          {tipoTurno}
                        </ThemedText>
                      </ThemedView>
                      </ThemedView>
                      <PuestoLocationBlock ubicacion={mark.puesto?.ubicacion} puestoNombre={mark.puesto?.nombre} />
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

  /** Siguiente turno laboral guardado, mientras su entrada (menos los minutos previos) no haya llegado. */
  const upcomingNextShift =
    nextShift && (horaAccion == null || isShiftUpcoming(nextShift, Number(horaAccion), monitoringPreviousMinutes)) ? nextShift : null;

  const marcaView = attendanceData?.marca;
  const isIngresado = attendanceData?.estado === 'Ingresado';
  /**
   * Fecha y hora programadas de la siguiente acción (entrada o salida). Si la marca no tiene hora de inicio o de fin no hay hora real que mostrar
   * (la que calcula el sistema es solo un respaldo): se muestra únicamente la fecha. Las horas marcadas por la persona sí se muestran completas.
   */
  const fechaYHoraProgramada =
    attendanceData?.next_time == null
      ? '—'
      : marcaView && !tieneHorarioCompleto(marcaView.hora_inicio, marcaView.hora_fin)
        ? formatFechaDMY(attendanceData.next_time)
        : `${formatFechaDMY(attendanceData.next_time)} ${getNextTime(attendanceData.next_time)}`;

  return (
    <ThemedView style={styles.fullContainer}>
      <AppHeader onMenuPress={handleMenuPress} title="Marcar Ingreso/Salida" />

      <ScrollView style={styles.scrollView}>
        <ThemedView style={styles.container}>
          {/* Título del módulo */}
          <ThemedView style={styles.titleContainer}>
            <ThemedText type="title" style={styles.title}>
              {getActionIcon('marcar-ingreso-salida')} Marcar Ingreso/Salida
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              Control de asistencia
            </ThemedText>
          </ThemedView>

          {/* 1. Aviso de los minutos previos para marcar la entrada */}
          {isEntradaMarcaHintVisible ? (
            <ThemedView style={[styles.messageBox, styles.messageBoxInfo]}>
              <Ionicons name="information-circle-outline" size={18} color="#4B5563" />
              <ThemedText style={[styles.messageText, styles.messageTextInfo]}>
                Para poder marcar entrada, asegúrate de estar mínimo {monitoringPreviousMinutes} minutos antes del inicio o durante tu turno
              </ThemedText>
              <TouchableOpacity
                onPress={() => setIsEntradaMarcaHintVisible(false)}
                style={styles.hintClose}
                accessibilityLabel="Cerrar aviso"
              >
                <Ionicons name="close" size={18} color="#4B5563" />
              </TouchableOpacity>
            </ThemedView>
          ) : null}

          {/* 2. Fecha y hora actual (mismo estilo que Empleado y Puesto) */}
          <ThemedView style={styles.identityCard}>
            <ThemedView style={[styles.identityRow, styles.identityRowLast]}>
              <ThemedText style={styles.identityLabel}>Fecha y hora actual</ThemedText>
              <ThemedText style={styles.identityValue}>{getDisplayDateTimeText()}</ThemedText>
            </ThemedView>
          </ThemedView>

          {/* 3 y 4. Empleado y puesto */}
          <ThemedView style={styles.identityCard}>
            <ThemedView style={styles.identityRow}>
              <ThemedText style={styles.identityLabel}>Empleado</ThemedText>
              <ThemedText style={styles.identityValue}>
                {levelLabel({ codigo: employee?.codigo, nombre: employee?.name })}
              </ThemedText>
            </ThemedView>
            {marcaView ? (
              <ThemedView style={[styles.identityRow, styles.identityRowLast]}>
                <ThemedText style={styles.identityLabel}>Puesto</ThemedText>
                <ThemedText style={styles.identityValue}>{levelLabel(marcaView.puesto)}</ThemedText>
              </ThemedView>
            ) : null}
          </ThemedView>

          {/* Contenido */}
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
          ) : attendanceData && marcaView ? (
            <ThemedView style={styles.contentContainer}>
              {/* 5. Información laboral (colapsable, cerrada por defecto) */}
              <Collapsible title="Información laboral" containerStyle={styles.collapsibleInContent}>
                <ThemedView style={styles.infoCard}>
                  <ThemedView style={styles.infoRow}>
                    <ThemedText style={styles.infoLabel}>Fecha de la marca</ThemedText>
                    <ThemedText style={styles.infoValue}>{formatDateDMY(marcaView.fecha)}</ThemedText>
                  </ThemedView>

                  {tieneHorarioCompleto(marcaView.hora_inicio, marcaView.hora_fin) ? (
                    <ThemedView style={styles.infoRow}>
                      <ThemedText style={styles.infoLabel}>Horario de la marca</ThemedText>
                      <ThemedView style={styles.infoTimeValue}>
                        <Ionicons name="time-outline" size={16} color="#007AFF" />
                        <ThemedText style={styles.infoValue}>{formatHoraRange(marcaView.hora_inicio, marcaView.hora_fin)}</ThemedText>
                      </ThemedView>
                    </ThemedView>
                  ) : null}

                  <ThemedView style={styles.infoRow}>
                    <ThemedText style={styles.infoLabel}>Empresa</ThemedText>
                    <ThemedText style={styles.infoValue}>{levelLabel(marcaView.empresa)}</ThemedText>
                  </ThemedView>

                  <ThemedView style={styles.infoRow}>
                    <ThemedText style={styles.infoLabel}>Cliente</ThemedText>
                    <ThemedText style={styles.infoValue}>{levelName(marcaView.cliente)}</ThemedText>
                  </ThemedView>

                  <ThemedView style={styles.infoRow}>
                    <ThemedText style={styles.infoLabel}>División</ThemedText>
                    <ThemedText style={styles.infoValue}>{levelLabelCodeOnly(marcaView.roleDivision.division)}</ThemedText>
                  </ThemedView>

                  <ThemedView style={styles.infoRow}>
                    <ThemedText style={styles.infoLabel}>Rol</ThemedText>
                    <ThemedText style={styles.infoValue}>{levelName(marcaView.roleDivision.role)}</ThemedText>
                  </ThemedView>

                  <ThemedView style={styles.infoRow}>
                    <ThemedText style={styles.infoLabel}>Contrato</ThemedText>
                    <ThemedText style={styles.infoValue}>{levelLabelCodeOnly(marcaView.contrato)}</ThemedText>
                  </ThemedView>

                  <ThemedView style={styles.infoRow}>
                    <ThemedText style={styles.infoLabel}>Corpo</ThemedText>
                    <ThemedText style={styles.infoValue}>{levelLabelCodeOnly(marcaView.corpo)}</ThemedText>
                  </ThemedView>

                  <ThemedView style={styles.infoRow}>
                    <ThemedText style={styles.infoLabel}>Puesto</ThemedText>
                    <ThemedText style={styles.infoValue}>{levelLabel(marcaView.puesto)}</ThemedText>
                  </ThemedView>

                  <ThemedView style={styles.infoRow}>
                    <ThemedText style={styles.infoLabel}>Plaza</ThemedText>
                    <ThemedText style={styles.infoValue}>{levelLabel(marcaView.plaza)}</ThemedText>
                  </ThemedView>

                  <ThemedView style={styles.infoRow}>
                    <ThemedText style={styles.infoLabel}>Horario</ThemedText>
                    <ThemedText style={styles.infoValue}>{levelName(marcaView.horario)}</ThemedText>
                  </ThemedView>

                  <ThemedView style={[styles.infoRow, styles.infoRowLast]}>
                    <ThemedText style={styles.infoLabel}>Tipo de turno</ThemedText>
                    <ThemedText style={styles.infoValue}>
                      {tipoTurnoLabel(marcaView.tipo_turno)}
                    </ThemedText>
                  </ThemedView>
                </ThemedView>
              </Collapsible>

              {/* 6. Estado y fechas y horas de entrada y de salida (mismo estilo que Empleado y Puesto) */}
              <ThemedView style={styles.identityCard}>
                <ThemedView style={styles.identityRow}>
                  <ThemedText style={styles.identityLabel}>Estado</ThemedText>
                  <ThemedText style={[styles.identityValue, isIngresado ? styles.statusTextWorking : styles.statusTextOffline]}>
                    {isIngresado ? 'Ingresado' : 'No ingresado'}
                  </ThemedText>
                </ThemedView>

                <ThemedView style={[styles.identityRow, !isIngresado && marcaView.hora_salida_digitada == null ? styles.identityRowLast : null]}>
                  <ThemedText style={styles.identityLabel}>Fecha y hora de entrada</ThemedText>
                  <ThemedText style={styles.identityValue}>
                    {isIngresado
                      ? marcaView.hora_entrada_digitada != null
                        ? convertDateToLocal(marcaView.hora_entrada_digitada)
                        : '—'
                      : fechaYHoraProgramada}
                  </ThemedText>
                </ThemedView>

                {isIngresado || marcaView.hora_salida_digitada != null ? (
                  <ThemedView style={[styles.identityRow, styles.identityRowLast]}>
                    <ThemedText style={styles.identityLabel}>Fecha y hora de salida</ThemedText>
                    <ThemedText style={styles.identityValue}>
                      {marcaView.hora_salida_digitada != null
                        ? convertDateToLocal(marcaView.hora_salida_digitada)
                        : fechaYHoraProgramada}
                    </ThemedText>
                  </ThemedView>
                ) : null}
              </ThemedView>

              {/* 7. Mensajes: avisos, errores y botones de funciones extra (debajo del estado) */}
              {(resolveMarcaIsLate(marcaView as Record<string, unknown>) || attendanceData.is_late) &&
                tieneHorarioCompleto(marcaView.hora_inicio, marcaView.hora_fin) &&
                marcaView.hora_entrada_digitada == null && (
                <ThemedView style={[styles.messageBox, styles.messageBoxError]}>
                  <Ionicons name="alert-circle-outline" size={18} color="#B42318" />
                  <ThemedText style={[styles.messageText, styles.messageTextError]}>
                    Tardía de {getLateTime(attendanceData, horaAccion)}
                  </ThemedText>
                </ThemedView>
              )}

              {resolveMarcaIsDiaLibre(marcaView as Record<string, unknown>) && (
                <ThemedView style={[styles.messageBox, styles.messageBoxWarning]}>
                  <Ionicons name="alert-circle-outline" size={18} color="#8A5300" />
                  <ThemedView style={styles.messageBody}>
                    <ThemedText style={[styles.messageText, styles.messageTextWarning]}>
                      Esta marca pertenece a un día libre.
                    </ThemedText>
                    {attendanceData.estado === 'No ingresado' && (
                      <ThemedText style={[styles.messageHint, styles.messageTextWarning]}>
                        {absentMarcaId != null
                          ? ESPERA_SIGUIENTE_TURNO_MESSAGE
                          : DIA_LIBRE_INGRESO_MESSAGE}
                      </ThemedText>
                    )}
                  </ThemedView>
                </ThemedView>
              )}

              {(resolveMarcaIsSalidaAnticipada(marcaView as Record<string, unknown>) ||
                attendanceData.is_salida_anticipada) &&
                marcaView.hora_salida_anticipada != null && (
                <ThemedView style={[styles.messageBox, styles.messageBoxWarning]}>
                  <Ionicons name="alert-circle-outline" size={18} color="#8A5300" />
                  <ThemedView style={styles.messageBody}>
                    <ThemedText style={[styles.messageText, styles.messageTextWarning]}>
                      Salida anticipada a las{' '}
                      {getNextTime(
                        typeof marcaView.hora_salida_anticipada === 'string' &&
                          marcaView.hora_salida_anticipada.includes('T')
                          ? marcaView.hora_salida_anticipada
                          : `1970-01-01T${String(marcaView.hora_salida_anticipada).slice(0, 8)}`
                      )}
                    </ThemedText>
                    {attendanceData.estado === 'No ingresado' && (
                      <ThemedText style={[styles.messageHint, styles.messageTextWarning]}>
                        Has marcado la salida de forma anticipada. Si deseas revertirlo, contacta con la administración de tu puesto.
                      </ThemedText>
                    )}
                  </ThemedView>
                </ThemedView>
              )}

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
                            {isSubmittingAbsentReason ? 'Enviando...' : 'Enviar motivo'}
                          </ThemedText>
                        </TouchableOpacity>
                      </ThemedView>
                    </ThemedView>
                  )}

                  {errorMessage ? (
                    <ThemedView style={styles.entradaLocationErrorBlock}>
                      <ThemedView style={[styles.messageBox, styles.messageBoxError]}>
                        <Ionicons name="alert-circle-outline" size={18} color="#B42318" />
                        <ThemedText style={[styles.messageText, styles.messageTextError]}>
                          {outOfRangeMapCoords ? simplifyOutOfRangeMessage(errorMessage) : errorMessage}
                        </ThemedText>
                      </ThemedView>
                      {showLocationRetry &&
                        (attendanceData.estado === 'No ingresado' ||
                          attendanceData.estado === 'Ingresado') && (
                        <TouchableOpacity
                          style={[
                            styles.secondaryButton,
                            styles.locationRetryButton,
                            isRefreshingLocation && styles.actionButtonDisabled,
                          ]}
                          onPress={() => void handleRetryLocationCheck()}
                          disabled={isRefreshingLocation}
                          activeOpacity={0.85}
                        >
                          {isRefreshingLocation ? (
                            <ActivityIndicator size="small" color="#007AFF" />
                          ) : (
                            <>
                              <Ionicons name="refresh" size={18} color="#007AFF" />
                              <ThemedText style={styles.secondaryButtonText}>Reintentar</ThemedText>
                            </>
                          )}
                        </TouchableOpacity>
                      )}
                    </ThemedView>
                  ) : null}

                  {(revertMarcaId != null || marcaView.hora_salida_digitada != null) && (
                    <TouchableOpacity style={styles.revertButton} onPress={handleRevertLeaving}>
                      <ThemedText style={styles.revertButtonText}>Revertir salida</ThemedText>
                    </TouchableOpacity>
                  )}
                </ThemedView>
              )}

              {/* 8. Botón de marcar entrada o salida */}
              <ThemedView style={styles.actionContainer}>
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    isIngresado ? styles.endShiftButton : styles.startShiftButton,
                    (getDisability() || isUpdating) && styles.actionButtonDisabled
                  ]}
                  onPress={handleToggleAttendance}
                  disabled={getDisability() || isUpdating}
                >
                  {isUpdating ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <ThemedView style={styles.actionButtonContent}>
                      <ThemedText style={styles.actionButtonText}>
                        {isIngresado ? 'Marcar salida' : 'Marcar ingreso'}
                      </ThemedText>
                      {isIngresado ? getActionIcon('end') : getActionIcon('start')}
                    </ThemedView>
                  )}
                </TouchableOpacity>
              </ThemedView>

              {/* 9. Ubicación del puesto (siempre disponible): mapa con la ubicación actual, coordenadas y Waze */}
              <PuestoLocationBlock ubicacion={marcaView.puesto?.ubicacion} puestoNombre={marcaView.puesto?.nombre} />
            </ThemedView>
          ) : errorMessage ? (
            <ThemedView style={styles.errorContainer}>
              <ThemedView style={[styles.messageBox, styles.messageBoxError]}>
                <Ionicons name="alert-circle-outline" size={18} color="#B42318" />
                <ThemedText style={[styles.messageText, styles.messageTextError]}>{errorMessage}</ThemedText>
              </ThemedView>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={fetchAttendanceStatus}
              >
                <Ionicons name="refresh" size={18} color="#FFFFFF" />
                <ThemedText style={styles.retryButtonText}>Reintentar</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          ) : null}

          {/* 9. Turnos futuros */}
          <TouchableOpacity
            style={styles.futureMarksButton}
            onPress={handleOpenFutureMarksModal}
            activeOpacity={0.85}
          >
            <Ionicons name="calendar-outline" size={18} color="#007AFF" />
            <ThemedText style={styles.futureMarksButtonText}>
              Ver turnos futuros
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </ScrollView>

      <SlideMenu
        isVisible={isMenuVisible}
        onClose={handleMenuClose}
        onHomePress={handleHomePress}
        currentRoute="marcar-ingreso-salida"
      />

      <PlanillasPasswordRevalidationModal
        visible={showPlanillasRevalidationModal}
        refreshAccessToken={refreshAccessToken}
        logout={logout}
        onSuccess={handlePlanillasRevalidationSuccess}
        onDismiss={handlePlanillasRevalidationDismiss}
      />

      {/* Modal de la razón de salida anticipada */}
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
                <ThemedText style={styles.modalCancelButtonText}>Cancelar</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirmButton]}
                onPress={handleModalConfirm}
              >
                <ThemedText style={styles.modalConfirmButtonText}>Confirmar</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          </ThemedView>
        </ThemedView>
      </Modal>

      {/* Modal de turnos futuros: primero el turno laboral más próximo; la lista de 30 días solo se busca a petición */}
      <Modal
        visible={isMarksModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseFutureMarksModal}
      >
        <View style={styles.marksModalOverlay}>
          <ThemedView style={styles.marksModalContainer}>
            <View style={styles.marksModalHeader}>
              <ThemedText style={styles.marksModalTitle}>
                Turnos futuros
              </ThemedText>
              <TouchableOpacity onPress={handleCloseFutureMarksModal} accessibilityLabel="Cerrar">
                <Ionicons name="close" size={22} color="#666666" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.marksModalContent}
              contentContainerStyle={styles.marksModalContentContainer}
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={true}
            >
              <ThemedText style={styles.marksSectionTitle}>Próximo turno</ThemedText>
              {upcomingNextShift ? (
                <ThemedView style={styles.markItem}>
                  <ThemedView style={styles.markItemHeader}>
                    <Ionicons name="calendar-outline" size={18} color="#007AFF" />
                    <ThemedText style={styles.markItemTime}>
                      {formatFechaDMY(upcomingNextShift.fecha)}
                    </ThemedText>
                  </ThemedView>
                  {tieneHorarioCompleto(upcomingNextShift.hora_inicio, upcomingNextShift.hora_fin) ? (
                    <ThemedView style={styles.markItemHeader}>
                      <Ionicons name="time-outline" size={18} color="#007AFF" />
                      <ThemedText style={styles.markItemTime}>
                        {formatHoraRange(upcomingNextShift.hora_inicio, upcomingNextShift.hora_fin)}
                      </ThemedText>
                    </ThemedView>
                  ) : null}
                  <ThemedView style={styles.markItemDetails}>
                    {shiftInfoRows(upcomingNextShift).map((row) => (
                      <ThemedView key={row.label} style={styles.markItemRow}>
                        <ThemedText style={styles.markItemTitle}>{row.label}</ThemedText>
                        <ThemedText style={styles.markItemValue}>{row.value}</ThemedText>
                      </ThemedView>
                    ))}
                    <ThemedView style={styles.markItemRow}>
                      <ThemedText style={styles.markItemTitle}>Turno</ThemedText>
                      <ThemedText style={styles.markItemValue}>{tipoTurnoLabel(upcomingNextShift.tipo_turno)}</ThemedText>
                    </ThemedView>
                  </ThemedView>
                  <PuestoLocationBlock ubicacion={upcomingNextShift.puesto?.ubicacion} puestoNombre={upcomingNextShift.puesto?.nombre} />
                </ThemedView>
              ) : (
                <ThemedView style={styles.marksEmptyContainer}>
                  <ThemedText style={styles.marksEmptyText}>
                    No hay un turno laboral próximo guardado. Se actualiza al consultar tu marca con conexión a internet.
                  </ThemedText>
                </ThemedView>
              )}

              <TouchableOpacity
                style={[styles.secondaryButton, styles.marksSearchButton, isLoadingFutureMarks && styles.actionButtonDisabled]}
                onPress={handleRequestFutureList}
                disabled={isLoadingFutureMarks}
                activeOpacity={0.85}
              >
                <Ionicons name="search-outline" size={18} color="#007AFF" />
                <ThemedText style={styles.secondaryButtonText}>
                  Buscar turnos de los próximos 30 días
                </ThemedText>
              </TouchableOpacity>

              {isLoadingFutureMarks ? (
                <ThemedView style={styles.marksLoadingContainer}>
                  <ActivityIndicator size="large" color="#007AFF" />
                  <ThemedText style={styles.marksLoadingText}>
                    Cargando turnos...
                  </ThemedText>
                </ThemedView>
              ) : futureListRequested ? (
                futureMarks.length === 0 ? (
                  <ThemedView style={styles.marksEmptyContainer}>
                    <ThemedText style={styles.marksEmptyText}>
                      No hay turnos programados para los próximos 30 días
                    </ThemedText>
                  </ThemedView>
                ) : (
                  <>
                    <ThemedText style={styles.marksSectionTitle}>Próximos 30 días</ThemedText>
                    {renderFutureMarks()}
                  </>
                )
              ) : null}
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
  scrollView: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 20,
    gap: 14,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 4,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    minHeight: 200,
  },
  loadingDataText: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 16,
    opacity: 0.7,
  },
  errorContainer: {
    width: '100%',
    gap: 12,
  },

  /* Aviso de minutos previos */
  hintClose: {
    padding: 2,
  },

  /* Fecha y hora, empleado y puesto */
  dateTimeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  dateTimeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  identityCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  identityRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  identityRowLast: {
    borderBottomWidth: 0,
  },
  identityLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#777777',
  },
  identityValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
    marginTop: 2,
  },

  contentContainer: {
    gap: 14,
  },
  /** El colapsable trae un margen inferior propio; aquí el espacio entre bloques ya lo da el `gap` del contenedor. */
  collapsibleInContent: {
    marginBottom: 0,
  },

  /* Información laboral (dentro del colapsable) */
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  infoRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  infoRowLast: {
    borderBottomWidth: 0,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#777777',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333',
    marginTop: 1,
  },
  infoTimeValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
  },

  /* Mensajes */
  messageBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  messageBoxError: {
    backgroundColor: '#FDECEA',
    borderColor: '#F5C2BE',
  },
  messageBoxInfo: {
    backgroundColor: '#F8F9FA',
    borderColor: '#E0E0E0',
  },
  messageBoxWarning: {
    backgroundColor: '#FFF4E5',
    borderColor: '#F5D9A8',
  },
  messageBody: {
    flex: 1,
    gap: 4,
    backgroundColor: 'transparent',
  },
  messageText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  messageHint: {
    fontSize: 13,
    lineHeight: 18,
  },
  messageTextError: {
    color: '#B42318',
  },
  messageTextInfo: {
    color: '#333333',
  },
  messageTextWarning: {
    color: '#8A5300',
  },
  marcaWarningsSection: {
    width: '100%',
    gap: 12,
  },
  entradaLocationErrorBlock: {
    width: '100%',
    gap: 10,
  },
  /** «Reintentar» de la ubicación: ocupa todo el ancho, igual que la caja del mensaje. */
  locationRetryButton: {
    width: '100%',
    paddingVertical: 12,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  retryButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  revertButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#B42318',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  revertButtonText: {
    color: '#B42318',
    fontSize: 14,
    fontWeight: '600',
  },

  /* Estado y horas */
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    gap: 10,
  },
  statusBadge: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  statusBadgeWorking: {
    backgroundColor: '#EAF5EC',
    borderColor: '#BFE0C6',
  },
  statusBadgeOffline: {
    backgroundColor: '#F1F2F4',
    borderColor: '#D5D8DD',
  },
  statusText: {
    fontSize: 16,
    fontWeight: '700',
  },
  statusTextWorking: {
    color: '#1E6B34',
  },
  statusTextOffline: {
    color: '#4B5563',
  },
  timeLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
  },
  timeLineText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333333',
  },

  /* Botón de marcar */
  actionContainer: {
    width: '100%',
  },
  actionButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'transparent',
  },
  startShiftButton: {
    backgroundColor: '#2E7D32',
  },
  endShiftButton: {
    backgroundColor: '#C0392B',
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  /* Turnos futuros */
  futureMarksButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  futureMarksButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },

  /* Modales */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
    color: '#333333',
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: 16,
    color: '#666666',
    lineHeight: 20,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#F8F9FA',
    marginBottom: 20,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    backgroundColor: 'transparent',
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  modalConfirmButton: {
    backgroundColor: '#007AFF',
  },
  modalCancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
  },
  modalConfirmButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  absentReasonContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 16,
  },
  absentReasonTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
    color: '#333333',
  },
  absentReasonSubtitle: {
    fontSize: 13,
    marginBottom: 12,
    color: '#666666',
    lineHeight: 19,
  },
  absentReasonInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#F8F9FA',
    marginBottom: 12,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  absentReasonButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    backgroundColor: 'transparent',
  },
  absentReasonButton: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    alignItems: 'center',
  },
  absentReasonSubmitButton: {
    backgroundColor: '#007AFF',
  },
  absentReasonSubmitButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  testButtonContainer: {
    marginBottom: 20,
  },
  testButton: {
    backgroundColor: '#8A5300',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  testButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  marksModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
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
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
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
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  marksModalContent: {
    flex: 1,
  },
  marksModalContentContainer: {
    padding: 16,
    gap: 12,
  },
  marksSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333333',
  },
  marksSearchButton: {
    alignSelf: 'stretch',
  },
  marksLoadingContainer: {
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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
    backgroundColor: '#FFFFFF',
  },
  markItemTime: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  markItemDetails: {
    marginTop: 8,
    gap: 6,
    backgroundColor: '#FFFFFF',
  },
  markItemRow: {
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingBottom: 4,
    backgroundColor: '#FFFFFF',
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
});
