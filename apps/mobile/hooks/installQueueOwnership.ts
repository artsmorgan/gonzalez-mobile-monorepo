/**
 * Conecta `queueOwnership.ts` con `AsyncStorage` (issues #176 y #170): propietario en cada acción de las colas `*_actions` y token de Planillas
 * fuera de ellas. Se importa en `index.js` DESPUÉS de `installSecureStorage` y ANTES de `installEvidenceQueue`, para que el sello de evidencia
 * vea la cola del usuario (sin acciones ajenas) y compare con lo que ese usuario guardó.
 *
 * `queueRaw` es el acceso SIN filtrar: el borrado remoto (`guardifyClient`) cuenta y borra el trabajo de todos los usuarios del equipo.
 * `runQueueRetention` aplica la caducidad de 2 semanas de las colas de un usuario que no se conecta (ver `queueRetention.ts`).
 */
import { apiServer } from '../utils/apiServer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import { createQueueLayer, scrubStoredQueues, type LayerStorage, type RawQueueAccess } from './queueOwnership';
import { runRetention } from './queueRetention';
import { isQueueKey } from './evidenceQueue';
import { eventBus } from './eventBus';
import {
  DENIED_STAMPS_KEY,
  QUEUE_PERMISSION_REJECTED_EVENT,
  markNotified,
  parseDeniedStamps,
  splitRejected,
  toNotify,
  type RejectedAction,
} from './permissionRejectedQueue';
import { isEmployeeProfilePhotoFileName } from './employeeProfilePhotoStorage';
import { MAIN_STRUCTURE_CACHE_FILENAME, MAIN_STRUCTURE_CACHE_TMP_FILENAME } from './mainStructureCacheStorage';

type Patched = LayerStorage & { __queueOwnership?: ReturnType<typeof createQueueLayer> };
const target = AsyncStorage as unknown as Patched;

/** Organización = servidor al que se conecta la app (pruebas y producción no mezclan su trabajo pendiente en un mismo equipo). */
function currentOrgId(): string | null {
  const url = String(apiServer() ?? '').trim();
  if (!url) return null;
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return url.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase() || null;
  }
}

function install(): ReturnType<typeof createQueueLayer> {
  if (target.__queueOwnership) return target.__queueOwnership;
  const originalGet = target.getItem.bind(target);
  const originalSet = target.setItem.bind(target);
  const layer = createQueueLayer(target, { getOrgId: currentOrgId });
  target.__queueOwnership = layer;
  // Migración al abrir: las colas guardadas por versiones anteriores todavía pueden traer el token de Planillas dentro de las acciones.
  void scrubStoredQueues({ getAllKeys: layer.raw.getAllKeys, getItem: originalGet, setItem: originalSet }).catch(() => undefined);
  return layer;
}

const layer = install();
export const queueRaw: RawQueueAccess = layer.raw;

/** Hora de reloj de Costa Rica (`getHoraAccion`); si no se puede obtener, la del equipo. Se importa al usarla para no alterar el orden de arranque. */
async function nowMs(): Promise<number> {
  try {
    const { default: getHoraAccion } = await import('./getHoraAccion');
    const t = Number(await getHoraAccion(false));
    if (Number.isFinite(t) && t > 0) return t;
  } catch {
    /* se usa el reloj del equipo */
  }
  return Date.now();
}

const isProtectedFile = (name: string): boolean =>
  name === MAIN_STRUCTURE_CACHE_FILENAME || name === MAIN_STRUCTURE_CACHE_TMP_FILENAME || isEmployeeProfilePhotoFileName(name);

const documentFiles = {
  async list(): Promise<string[]> {
    return Paths.document.list().filter((e) => e instanceof File).map((e) => String(e.name));
  },
  async remove(name: string): Promise<void> {
    const f = new File(Paths.document, name);
    if (f.exists) f.delete();
  },
};

let lastRunAt = 0;
const MIN_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Registra que el usuario con la sesión activa se conectó y elimina las acciones (y sus archivos de expo-files) de los usuarios que llevan más
 * de 2 semanas sin conectarse. Llamar en cada sincronización con conexión; limita su propia frecuencia. Nunca lanza.
 */
export async function runQueueRetention(force = false): Promise<void> {
  try {
    const t0 = Date.now();
    if (!force && t0 - lastRunAt < MIN_INTERVAL_MS) return;
    lastRunAt = t0;
    const owner = await layer.getOwner();
    if (!owner) return;
    const plan = await runRetention({
      store: layer.raw,
      files: documentFiles,
      now: await nowMs(),
      currentOwner: owner,
      mutateQueue: layer.mutateQueue,
      isProtectedFile,
    });
    if (plan.purgedActions > 0) {
      console.warn(`[colas] se eliminaron ${plan.purgedActions} acción(es) pendientes de ${plan.purgedOwners.length} usuario(s) sin conexión por más de 2 semanas`);
    }
  } catch (e) {
    console.warn('[colas] no se pudo aplicar la caducidad:', e);
  }
}

/**
 * Quita de las colas las acciones guardadas sin conexión que el servidor rechazó por falta de permiso (issue #211) y avisa UNA vez a la persona.
 * Se llama al empezar la sincronización, cuando ninguna cola se está recorriendo. Solo actúa sobre acciones con sello de evidencia que el `fetch`
 * global anotó como denegadas (ver `permissionRejectedQueue.ts`). Devuelve cuántas quitó. Nunca lanza.
 */
export async function purgePermissionRejectedActions(): Promise<number> {
  try {
    const denied = parseDeniedStamps(await layer.raw.getItem(DENIED_STAMPS_KEY));
    if (Object.keys(denied).length === 0) return 0;
    const keys = (await layer.raw.getAllKeys()).filter(isQueueKey);
    const rejected: RejectedAction[] = [];
    for (const key of keys) {
      await layer.mutateQueue(key, (current) => {
        const r = splitRejected(current, denied);
        rejected.push(...r.rejected);
        return r.json;
      });
    }
    if (rejected.length === 0) return 0;
    console.warn(`[colas] se quitaron ${rejected.length} acción(es) pendientes rechazadas por falta de permiso`);
    const pending = toNotify(rejected, denied);
    if (pending) {
      await layer.raw.setItem(DENIED_STAMPS_KEY, markNotified(denied, pending.stamps));
      eventBus.emit(QUEUE_PERMISSION_REJECTED_EVENT, pending.payload);
    }
    return rejected.length;
  } catch (e) {
    console.warn('[colas] no se pudieron revisar las acciones rechazadas por permiso:', e);
    return 0;
  }
}
