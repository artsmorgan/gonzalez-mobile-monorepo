/**
 * Reglas comunes para cualquier limpieza de caché (colas por usuario, issue #176): no se puede borrar trabajo pendiente de sincronizar de
 * NINGÚN usuario, tampoco el de quien está desconectado. Módulo PURO, sin Expo/React Native.
 *
 * Lo que protege:
 *  - las colas `*_actions` y las llaves únicas con propietario (p. ej. la firma manual pendiente);
 *  - los registros que gobiernan esa protección: la última conexión de cada usuario (si una limpieza lo borrara, el plazo de 2 semanas nunca
 *    se cumpliría) y los borrados seguros pendientes;
 *  - los archivos de expo-files que citan las acciones de CUALQUIER usuario.
 * Solo la caducidad de 2 semanas (`queueRetention.ts`) y el borrado remoto de Guardify (`guardifyWipe.ts`, que espera a que todo se sincronice
 * o venza su plazo) pueden quitar trabajo pendiente.
 */
import { isQueueKey } from './evidenceQueue';
import { isOwnedSingletonKey } from './queueOwnership';
import { LAST_SEEN_KEY, collectStrings, fileNamesOf } from './queueRetention';

const PRESERVED_KEYS: readonly string[] = [
  LAST_SEEN_KEY,
  'secure_pending_deletes',
  // Marca de salida pendiente de versiones anteriores: se migra a `attendance_actions` al abrir la app.
  'marca_cache',
];

/** ¿Esta llave guarda trabajo pendiente (o el registro que lo protege)? Ninguna limpieza debe borrarla. */
export function isPendingWorkKey(key: string): boolean {
  return isQueueKey(key) || isOwnedSingletonKey(key) || PRESERVED_KEYS.includes(key);
}

/** Llaves a borrar en una limpieza: las candidatas menos las protegidas y las excepciones propias de esa limpieza. */
export function filterKeysToDelete(keys: readonly string[], exceptions: readonly string[] = []): string[] {
  return keys.filter((k) => !exceptions.includes(k) && !isPendingWorkKey(k));
}

/**
 * Nombres de archivo que NO se deben borrar: todo texto de las colas de TODOS los usuarios (también las acciones sin propietario) y de las
 * llaves únicas, como nombre y como último segmento de una ruta. `rawValues` son los valores crudos (sin filtrar por usuario).
 * Es deliberadamente amplio: conservar de más cuesta un archivo; borrar de menos pierde una evidencia.
 */
export function collectPreservedFileNames(rawValues: ReadonlyArray<string | null | undefined>): Set<string> {
  const out = new Set<string>();
  for (const raw of rawValues) {
    if (typeof raw !== 'string') continue;
    const text = raw.trim();
    if (!text) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text; // valor heredado en texto plano (p. ej. el nombre de la firma)
    }
    const leaves = new Set<string>();
    collectStrings([parsed], leaves);
    for (const leaf of leaves) for (const n of fileNamesOf(leaf)) out.add(n);
  }
  return out;
}
