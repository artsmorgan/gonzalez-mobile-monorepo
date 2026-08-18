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

export async function attachPlanillasTokenToChecklistSupervisionActions(
  planillasToken: string,
): Promise<void> {
  const token = String(planillasToken ?? '').trim();
  if (!token) return;

  const actions = await readChecklistSupervisionActions();
  if (actions.length === 0) return;

  let changed = false;
  const next = actions.map((action: any) => {
    if (!checklistSupervisionActionRequiresPlanillasToken(action)) return action;
    const current = String(action.planillasToken ?? action.requestData?.planillasToken ?? '').trim();
    const nextRequestData =
      action.requestData && typeof action.requestData === 'object'
        ? { ...action.requestData, planillasToken: token }
        : action.requestData;
    if (current === token && String(action.requestData?.planillasToken ?? '').trim() === token) {
      return action;
    }
    changed = true;
    return { ...action, planillasToken: token, requestData: nextRequestData };
  });

  if (changed) {
    await AsyncStorage.setItem(CHECKLIST_SUPERVISION_ACTIONS_KEY, JSON.stringify(next));
  }
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

/** Actualiza el token en todas las colas offline que lo usan al sincronizar. */
export async function attachPlanillasTokenToAllPendingActions(planillasToken: string): Promise<void> {
  const token = String(planillasToken ?? '').trim();
  if (!token) return;

  await attachPlanillasTokenToPlanillasAttendanceActions(token);

  await attachPlanillasTokenToChecklistSupervisionActions(token);

  const evalRaw = await AsyncStorage.getItem(EVALUATIONS_ACTIONS_KEY);
  if (evalRaw) {
    try {
      const actions = JSON.parse(evalRaw);
      if (Array.isArray(actions)) {
        let changed = false;
        const next = actions.map((a: any) => {
          if (a?.type !== 'puesto_ubicacion' || a?.synced !== false) return a;
          if (String(a.planillasToken ?? '').trim() === token) return a;
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
    let changed = false;
    const next = lunchActions.map((a) => {
      if (String(a.planillasToken ?? '').trim() === token) return a;
      changed = true;
      return { ...a, planillasToken: token };
    });
    if (changed) {
      await AsyncStorage.setItem(LUNCH_TIME_HORARIO_ACTIONS_KEY, JSON.stringify(next));
    }
  }
}
