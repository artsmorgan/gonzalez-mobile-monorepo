import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFile, deleteFile } from './fileStorage';
import { createJobManual } from './jobManualsFunctions';

const JOB_MANUALS_ACTIONS = 'job_manuals_actions';
const JOB_MANUALS_CACHE = 'job_manuals_cache';

export async function hydrateJobManualCreateRequestData(requestData: any): Promise<any> {
  if (!requestData?.files) return requestData;
  let parsed: any[];
  try {
    parsed = typeof requestData.files === 'string' ? JSON.parse(requestData.files) : requestData.files;
  } catch {
    return requestData;
  }
  if (!Array.isArray(parsed)) return requestData;
  const out: any[] = [];
  for (const f of parsed) {
    if (f?.localFileName) {
      try {
        const g = await getFile(String(f.localFileName));
        out.push({
          type: f.type,
          extension: f.extension,
          original_name: f.original_name,
          file_base64: g.base64,
        });
      } catch {
        /* omitir adjunto */
      }
    } else if (f?.file_base64) {
      out.push(f);
    }
  }
  return { ...requestData, files: JSON.stringify(out) };
}

export async function hydrateJobManualSignFiles(filesStr: string | null | undefined): Promise<string | null> {
  if (filesStr == null || String(filesStr).trim() === '') return filesStr ?? null;
  let parsed: any[];
  try {
    parsed = JSON.parse(String(filesStr));
  } catch {
    return filesStr;
  }
  if (!Array.isArray(parsed)) return filesStr;
  const out: any[] = [];
  for (const f of parsed) {
    if (f?.localFileName) {
      try {
        const g = await getFile(String(f.localFileName));
        out.push({
          type: f.type,
          extension: f.extension,
          original_name: f.original_name,
          file_base64: g.base64,
          mimeType: f.mimeType,
        });
      } catch {
        /* omitir */
      }
    } else if (f?.file_base64) {
      out.push(f);
    }
  }
  return JSON.stringify(out);
}

export async function deleteJobManualLocalFileRefsFromJson(raw: unknown) {
  let parsed: any[];
  try {
    parsed = typeof raw === 'string' ? JSON.parse(raw) : Array.isArray(raw) ? raw : [];
  } catch {
    return;
  }
  if (!Array.isArray(parsed)) return;
  for (const f of parsed) {
    if (f?.localFileName) {
      try {
        await deleteFile(String(f.localFileName));
      } catch {
        /* idempotente */
      }
    }
  }
}

/**
 * Reasigna en la cola el id de servidor a acciones colgando del `id_local` de creación (sign, quiz, append puestos).
 */
function reassignQueuedActionsToServerId(
  actions: any[],
  createId: string,
  serverId: number
): any[] {
  return actions.map((a) => {
    if (a.type === 'sign' && a.manualLocalId != null && String(a.manualLocalId) === String(createId)) {
      return { ...a, id: serverId, manualLocalId: undefined };
    }
    if (a.type === 'quiz_result' && a.manualLocalId != null && String(a.manualLocalId) === String(createId)) {
      return { ...a, id: serverId, manualLocalId: undefined };
    }
    if (a.type === 'append_puestos' && a.pendingManualLocalId != null && String(a.pendingManualLocalId) === String(createId)) {
      return { ...a, manualId: serverId, pendingManualLocalId: undefined };
    }
    return a;
  });
}

/**
 * Tras crear el manual en el servidor: limpia archivos locales, quita el `create` de la cola,
 * reenlaza acciones que referían al id local, y actualiza caché.
 */
export async function applyJobManualCreateSuccess(params: {
  createId: string;
  serverId: number;
  requestData: any;
  result?: { manualIds?: number[] };
}): Promise<void> {
  const { createId, serverId, requestData, result } = params;
  await deleteJobManualLocalFileRefsFromJson(requestData?.files);

  const actionsStr = await AsyncStorage.getItem(JOB_MANUALS_ACTIONS);
  const list: any[] = actionsStr ? JSON.parse(actionsStr) : [];
  const withoutCreate = list.filter(
    (a) => !(a.type === 'create' && String(a.id) === String(createId))
  );
  const next = reassignQueuedActionsToServerId(withoutCreate, createId, serverId);
  if (next.length === 0) {
    await AsyncStorage.removeItem(JOB_MANUALS_ACTIONS);
  } else {
    await AsyncStorage.setItem(JOB_MANUALS_ACTIONS, JSON.stringify(next));
  }

  const cacheStr = await AsyncStorage.getItem(JOB_MANUALS_CACHE);
  if (cacheStr) {
    const cache = JSON.parse(cacheStr);
    const updatedCache = (Array.isArray(cache) ? cache : []).map((item: any) => {
      if (String(item.id_local) === String(createId)) {
        return {
          ...item,
          id: serverId > 0 ? serverId : result?.manualIds ? result.manualIds[0] : item.id,
          id_local: undefined,
          synced: true,
        };
      }
      return item;
    });
    await AsyncStorage.setItem(JOB_MANUALS_CACHE, JSON.stringify(updatedCache));
  }
}

type SyncUnsyncedParams = {
  idLocal: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<unknown>;
};

/**
 * Sincroniza ahora un manual creado offline (misma lógica que la cola en App).
 * Lanzar si no hay acción `create` o el servidor responde error.
 */
export async function syncUnsyncedJobManualByLocalId({
  idLocal,
  refreshAccessToken,
  logout,
}: SyncUnsyncedParams): Promise<{ serverId: number }> {
  const actionsStr = await AsyncStorage.getItem(JOB_MANUALS_ACTIONS);
  if (!actionsStr) {
    throw new Error('No hay acciones de sincronización del manual');
  }
  const actions: any[] = JSON.parse(actionsStr);
  if (!Array.isArray(actions)) {
    throw new Error('Cola de manuales inválida');
  }
  const idx = actions.findIndex((a) => a.type === 'create' && String(a.id) === String(idLocal));
  if (idx === -1) {
    throw new Error('No se encontró la creación pendiente de este manual en el dispositivo');
  }
  const action = actions[idx];
  const requestData = await hydrateJobManualCreateRequestData(action.requestData);
  const result = await createJobManual({
    requestData,
    marcaId: action.marcaId,
    refreshAccessToken,
    logout,
  });
  if (!result?.status) {
    throw new Error(result?.message || 'No se pudo sincronizar el manual');
  }
  const createId = String(action.id);
  const serverId = Number(result.id ?? result.manualIds?.[0] ?? 0) || 0;
  if (serverId <= 0) {
    throw new Error('El servidor no devolvió un id de manual válido');
  }
  await applyJobManualCreateSuccess({ createId, serverId, requestData: action.requestData, result });
  return { serverId };
}
