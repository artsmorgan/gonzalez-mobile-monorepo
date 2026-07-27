import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  attachPlanillasTokenToPlanillasAttendanceActions,
  attendanceActionRequiresPlanillasToken,
  readAttendanceActions,
} from './attendanceActionsStorage';
import {
  LUNCH_TIME_HORARIO_ACTIONS_KEY,
  readHorarioMinutosActions,
} from './lunchTimeHorarioApi';

const EVALUATIONS_ACTIONS_KEY = 'evaluations_actions';

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

  return false;
}

/** Actualiza el token en todas las colas offline que lo usan al sincronizar. */
export async function attachPlanillasTokenToAllPendingActions(planillasToken: string): Promise<void> {
  const token = String(planillasToken ?? '').trim();
  if (!token) return;

  await attachPlanillasTokenToPlanillasAttendanceActions(token);

  const evalRaw = await AsyncStorage.getItem(EVALUATIONS_ACTIONS_KEY);
  if (evalRaw) {
    try {
      const actions = JSON.parse(evalRaw);
      if (Array.isArray(actions)) {
        let changed = false;
        const next = actions.map((a: any) => {
          if (a?.type !== 'puesto_ubicacion' || a?.synced !== false) return a;
          if (a.planillasToken === token) return a;
          changed = true;
          return { ...a, planillasToken: token };
        });
        if (changed) {
          await AsyncStorage.setItem(EVALUATIONS_ACTIONS_KEY, JSON.stringify(next));
        }
      }
    } catch {
      /* ignore */
    }
  }

  const lunchActions = await readHorarioMinutosActions();
  if (lunchActions.length > 0) {
    const next = lunchActions.map((a) =>
      a.planillasToken === token ? a : { ...a, planillasToken: token },
    );
    await AsyncStorage.setItem(LUNCH_TIME_HORARIO_ACTIONS_KEY, JSON.stringify(next));
  }
}
