import { collectPreservedFileNames } from './cleanupGuard';
import { queueRaw } from './installQueueOwnership';
import { isQueueKey } from './evidenceQueue';
import { isOwnedSingletonKey } from './queueOwnership';

/**
 * Nombres de archivo local que NO se deben borrar porque una acción pendiente los necesita. Lee las colas SIN filtrar (`queueRaw`): incluye el
 * trabajo pendiente de TODOS los usuarios del equipo, también el de quien está desconectado (issue #176), y no depende de una lista fija de
 * colas. Solo la caducidad de 2 semanas (`queueRetention.ts`) puede quitar esos archivos.
 */
export async function collectPendingSyncLocalFileNames(): Promise<Set<string>> {
  const keys = (await queueRaw.getAllKeys()).filter((k) => isQueueKey(k) || isOwnedSingletonKey(k));
  const rows = keys.length ? await queueRaw.multiGet(keys) : [];
  return collectPreservedFileNames(rows.map(([, value]) => value));
}
