import AsyncStorage from '@react-native-async-storage/async-storage';
import { attendanceActionRequiresPlanillasToken, readAttendanceActions } from './attendanceActionsStorage';
import { readHorarioMinutosActions } from './lunchTimeHorarioApi';
import { scrubStoredQueues } from './queueOwnership';

const EVALUATIONS_ACTIONS_KEY = 'evaluations_actions';
const CHECKLIST_SUPERVISION_ACTIONS_KEY = 'checklist_supervision_actions';

async function readChecklistSupervisionActions(): Promise<any[]> {
  const raw = await AsyncStorage.getItem(CHECKLIST_SUPERVISION_ACTIONS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function checklistSupervisionActionRequiresPlanillasToken(action: any): boolean {
  const type = String(action?.type ?? '');
  return type === 'create' || type === 'update';
}

/** Quita el token de Planillas de las colas guardadas (issue #170). */
export async function scrubPendingPlanillasTokens(): Promise<void> {
  await scrubStoredQueues({
    getAllKeys: () => AsyncStorage.getAllKeys(),
    getItem: (k) => AsyncStorage.getItem(k),
    setItem: (k, v) => AsyncStorage.setItem(k, v),
  });
}

async function readUnsyncedPuestoUbicacionActions(): Promise<any[]> {
  const raw = await AsyncStorage.getItem(EVALUATIONS_ACTIONS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((a) => a?.type === 'puesto_ubicacion' && a?.synced === false);
  } catch {
    return [];
  }
}

/** Hay cola pendiente que requiere token de Planillas válido al sincronizar. */
export async function pendingActionsRequirePlanillasToken(): Promise<boolean> {
  const attendanceActions = await readAttendanceActions();
  if (attendanceActions.some(attendanceActionRequiresPlanillasToken)) {
    return true;
  }

  const legacyMarca = await AsyncStorage.getItem('marca_cache');
  if (legacyMarca && legacyMarca.trim() !== '') {
    return true;
  }

  const puestoActions = await readUnsyncedPuestoUbicacionActions();
  if (puestoActions.length > 0) {
    return true;
  }

  const lunchActions = await readHorarioMinutosActions();
  if (lunchActions.length > 0) {
    return true;
  }

  const checklistActions = await readChecklistSupervisionActions();
  if (checklistActions.some(checklistSupervisionActionRequiresPlanillasToken)) {
    return true;
  }

  return false;
}

/**
 * Issue #170: ya NO se copia el token de Planillas dentro de las acciones encoladas (quedaba en claro en AsyncStorage). Cada envío toma el
 * token vigente del almacén seguro. Se conserva la función para no cambiar a los que la llaman: ahora solo limpia lo que hubiera quedado.
 */
export async function attachPlanillasTokenToAllPendingActions(planillasToken: string): Promise<void> {
  if (!String(planillasToken ?? '').trim()) return;
  await scrubPendingPlanillasTokens();
}
