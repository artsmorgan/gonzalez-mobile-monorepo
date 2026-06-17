import AsyncStorage from '@react-native-async-storage/async-storage';

export const LUNCH_TIMER_COMPLETING_KEY = 'lunch_timer_completing';

export type LunchTempState = {
  running: boolean;
  /** Milisegundos restantes al momento de guardar el estado. */
  remainingSeconds: number;
  /** Hora de referencia (`getHoraAccion`) al guardar o reanudar. */
  currentTimestamp: number;
  /** Fin programado del almuerzo en ms (epoch). */
  endTimeMs: number;
  startTime: string | Date | null;
  inactivities: unknown[];
  currentInactivityStart: string | Date | null;
  firma_empleado: string;
};

export function computeLunchEndTimeMs(tempState: {
  currentTimestamp: number;
  remainingSeconds: number;
  endTimeMs?: number;
}): number {
  const explicit = Number(tempState.endTimeMs);
  if (Number.isFinite(explicit) && explicit > 0) {
    return explicit;
  }
  return Number(tempState.currentTimestamp) + Number(tempState.remainingSeconds);
}

/** Segundos restantes según `horaAccion` actual y el estado persistido. */
export function computeRemainingSecondsFromTempState(
  tempState: {
    currentTimestamp: number;
    remainingSeconds: number;
    endTimeMs?: number;
    running?: boolean;
  },
  horaAccion: number
): number {
  if (!tempState.running) {
    return Math.max(0, Math.round(Number(tempState.remainingSeconds) / 1000));
  }
  const endMs = computeLunchEndTimeMs(tempState);
  return Math.max(0, Math.round((endMs - horaAccion) / 1000));
}

export function buildLunchTempState(params: {
  running: boolean;
  remainingMs: number;
  horaAccion: number;
  startTime: Date | null;
  inactivities: unknown[];
  currentInactivityStart: Date | null;
  firma_empleado: string;
}): LunchTempState {
  const endTimeMs = params.horaAccion + params.remainingMs;
  return {
    running: params.running,
    remainingSeconds: params.remainingMs,
    currentTimestamp: params.horaAccion,
    endTimeMs,
    startTime: params.startTime,
    inactivities: params.inactivities,
    currentInactivityStart: params.currentInactivityStart,
    firma_empleado: params.firma_empleado,
  };
}

export async function tryAcquireLunchTimerCompletionLock(): Promise<boolean> {
  const locked = await AsyncStorage.getItem(LUNCH_TIMER_COMPLETING_KEY);
  if (locked === '1') return false;
  await AsyncStorage.setItem(LUNCH_TIMER_COMPLETING_KEY, '1');
  return true;
}

export async function releaseLunchTimerCompletionLock(): Promise<void> {
  await AsyncStorage.removeItem(LUNCH_TIMER_COMPLETING_KEY);
}

function numOrNull(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function getDivisionIdFromMarcaJson(marca: any): number | null {
  const raw =
    marca?.roleDivision?.division?.id ??
    marca?.role_division?.division?.id ??
    marca?.division?.id ??
    marca?.division_id;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export type LunchTimeMarcaHierarchy = {
  empresa_id: number | null;
  cliente_id: number | null;
  division_id: number | null;
  contrato_id: number | null;
  corpo_id: number | null;
  puesto_id: number | null;
};

/** Extrae empresa → puesto desde el JSON de `current_marca` (misma convención que otras pantallas). */
export function extractLunchTimeHierarchyFromMarca(marca: any): LunchTimeMarcaHierarchy {
  return {
    empresa_id: numOrNull(marca?.empresa?.id ?? marca?.empresa_id),
    cliente_id: numOrNull(marca?.cliente?.id ?? marca?.cliente_id),
    division_id: getDivisionIdFromMarcaJson(marca),
    contrato_id: numOrNull(marca?.contrato?.id ?? marca?.contrato_id),
    corpo_id: numOrNull(marca?.corpo?.id ?? marca?.corpo_id),
    puesto_id: numOrNull(marca?.puesto?.id ?? marca?.puesto_id),
  };
}

export function extractMarcaIdFromMarca(marca: any): number | null {
  return numOrNull(marca?.id ?? marca?.marca_id);
}

/**
 * Añade al payload de POST `/api/lunch-time` los ids de jerarquía y `marca_id` leídos de `current_marca`.
 * Se invoca en `saveLunchTime` y antes de guardar/enviar desde la pantalla de almuerzo.
 */
export async function mergeCurrentMarcaHierarchyIntoLunchRequest(
  requestData: Record<string, any>
): Promise<void> {
  const raw = await AsyncStorage.getItem('current_marca');
  if (!raw) return;
  try {
    const marca = JSON.parse(raw);
    const marcaId = extractMarcaIdFromMarca(marca);
    if (marcaId != null) requestData.marca_id = marcaId;
    const h = extractLunchTimeHierarchyFromMarca(marca);
    if (h.empresa_id != null) requestData.empresa_id = h.empresa_id;
    if (h.cliente_id != null) requestData.cliente_id = h.cliente_id;
    if (h.division_id != null) requestData.division_id = h.division_id;
    if (h.contrato_id != null) requestData.contrato_id = h.contrato_id;
    if (h.corpo_id != null) requestData.corpo_id = h.corpo_id;
    if (h.puesto_id != null) requestData.puesto_id = h.puesto_id;
  } catch {
    /* ignore */
  }
}
