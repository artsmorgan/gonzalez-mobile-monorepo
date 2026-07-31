import AsyncStorage from '@react-native-async-storage/async-storage';

export const ATTENDANCE_ACTIONS_KEY = 'attendance_actions';

export type AttendancePendingAction =
  | {
      id: string;
      type: 'salida';
      marcaId: number;
      reason: string;
      horaAccion: number;
      planillasToken?: string;
    }
  | {
      id: string;
      type: 'absent_reason';
      marcaId: number;
      reason: string;
      horaAccion: number;
    }
  | {
      id: string;
      type: 'revert_leaving';
      marcaId: number;
      horaAccion: number;
      planillasToken?: string;
    };

export type AttendanceActionInput =
  | {
      type: 'salida';
      marcaId: number;
      reason: string;
      horaAccion: number;
      planillasToken?: string;
      id?: string;
    }
  | {
      type: 'absent_reason';
      marcaId: number;
      reason: string;
      horaAccion: number;
      id?: string;
    }
  | {
      type: 'revert_leaving';
      marcaId: number;
      horaAccion: number;
      planillasToken?: string;
      id?: string;
    };

type AttendanceSyncResponse = {
  status?: boolean;
  message?: string;
  already_synced?: boolean;
};

/** Respuesta aplicada o idempotente (cola puede desencolarse). */
export function isAttendanceSyncResponseApplied(data: AttendanceSyncResponse): boolean {
  if (data.status === true || data.already_synced === true) return true;
  const msg = String(data.message ?? '').toLowerCase();
  return (
    msg.includes('ya has marcado la salida') ||
    msg.includes('ya has marcado la entrada')
  );
}

let storageLock: Promise<void> = Promise.resolve();

async function withAttendanceActionsLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = storageLock.then(fn, fn);
  storageLock = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function newActionId(): string {
  return `att_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function readAttendanceActions(): Promise<AttendancePendingAction[]> {
  try {
    const raw = await AsyncStorage.getItem(ATTENDANCE_ACTIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function writeAttendanceActions(actions: AttendancePendingAction[]): Promise<void> {
  return withAttendanceActionsLock(async () => {
    if (actions.length === 0) {
      await AsyncStorage.removeItem(ATTENDANCE_ACTIONS_KEY);
    } else {
      await AsyncStorage.setItem(ATTENDANCE_ACTIONS_KEY, JSON.stringify(actions));
    }
  });
}

export async function appendAttendanceAction(action: AttendanceActionInput): Promise<AttendancePendingAction> {
  return withAttendanceActionsLock(async () => {
    const list = await readAttendanceActions();
    const full = { ...action, id: action.id ?? newActionId() } as AttendancePendingAction;
    list.push(full);
    if (list.length === 0) {
      await AsyncStorage.removeItem(ATTENDANCE_ACTIONS_KEY);
    } else {
      await AsyncStorage.setItem(ATTENDANCE_ACTIONS_KEY, JSON.stringify(list));
    }
    return full;
  });
}

export async function removeAttendanceActionById(actionId: string): Promise<void> {
  return withAttendanceActionsLock(async () => {
    const list = await readAttendanceActions();
    const next = list.filter((a) => String(a.id) !== String(actionId));
    if (next.length === 0) {
      await AsyncStorage.removeItem(ATTENDANCE_ACTIONS_KEY);
    } else {
      await AsyncStorage.setItem(ATTENDANCE_ACTIONS_KEY, JSON.stringify(next));
    }
  });
}

/** Quita acciones pendientes de tipo `salida` para esa marca. Devuelve cuántas se eliminaron. */
export async function removePendingSalidaActionsForMarca(marcaId: number): Promise<number> {
  return withAttendanceActionsLock(async () => {
    const list = await readAttendanceActions();
    const mid = Number(marcaId);
    if (!Number.isFinite(mid) || mid <= 0) return 0;
    const next = list.filter((a) => !(a.type === 'salida' && Number(a.marcaId) === mid));
    const removed = list.length - next.length;
    if (next.length === 0) {
      await AsyncStorage.removeItem(ATTENDANCE_ACTIONS_KEY);
    } else {
      await AsyncStorage.setItem(ATTENDANCE_ACTIONS_KEY, JSON.stringify(next));
    }
    return removed;
  });
}

export function attendanceActionRequiresPlanillasToken(
  action: AttendancePendingAction
): action is Extract<AttendancePendingAction, { type: 'salida' } | { type: 'revert_leaving' }> {
  return action.type === 'salida' || action.type === 'revert_leaving';
}

/** Cola actual o migración legacy `marca_cache` → salida pendiente. */
export async function pendingAttendanceActionsRequirePlanillasToken(): Promise<boolean> {
  const actions = await readAttendanceActions();
  if (actions.some(attendanceActionRequiresPlanillasToken)) {
    return true;
  }

  const legacyMarca = await AsyncStorage.getItem('marca_cache');
  return Boolean(legacyMarca && legacyMarca.trim() !== '');
}

export async function attachPlanillasTokenToPlanillasAttendanceActions(
  planillasToken: string
): Promise<void> {
  const token = String(planillasToken ?? '').trim();
  if (!token) return;

  return withAttendanceActionsLock(async () => {
    const actions = await readAttendanceActions();
    let changed = false;

    const next: AttendancePendingAction[] = [];
    for (const action of actions) {
      if (!attendanceActionRequiresPlanillasToken(action)) {
        next.push(action);
        continue;
      }
      if (String(action.planillasToken ?? '').trim() === token) {
        next.push(action);
        continue;
      }
      changed = true;
      next.push({ ...action, planillasToken: token });
    }

    if (changed) {
      if (next.length === 0) {
        await AsyncStorage.removeItem(ATTENDANCE_ACTIONS_KEY);
      } else {
        await AsyncStorage.setItem(ATTENDANCE_ACTIONS_KEY, JSON.stringify(next));
      }
    }
  });
}
