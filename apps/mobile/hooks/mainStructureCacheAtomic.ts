/**
 * Caché de la jerarquía (`main_structure_cache` + fragmentos): validar antes de reemplazar y escribir sin perder la copia anterior
 * (issue #178, H08). Módulo PURO, sin Expo/React Native: el almacenamiento real se inyecta (`StructureKeyValueStore`, `StructureFileStore`),
 * de modo que se puede probar en Node con fallos inyectados. El adaptador real está en `mainStructureCacheStorage.ts`.
 *
 * Principios:
 *  1. Nada se escribe ni se borra hasta que la carga se validó.
 *  2. Lo nuevo se escribe COMPLETO antes de quitar lo viejo, y la bandera que decide de dónde se lee cambia al final.
 *     Si la app muere o algo falla en cualquier punto, el lector sigue encontrando la caché anterior completa.
 *  3. El límite entre AsyncStorage y archivo se mide en bytes UTF-8 (lo que ocupa en SQLite), no en caracteres.
 */

export const MAIN_STRUCTURE_MONOLITH_KEY = 'main_structure_cache' as const;
export const MAIN_STRUCTURE_FILE_FLAG_KEY = 'main_structure_cache_stored_in_file_v1' as const;
export const MAIN_STRUCTURE_FRAGMENT_REGISTRY_KEY = 'main_structure_fragment_storage_keys' as const;
export const MAIN_STRUCTURE_FRAG_PREFIX = 'main_structure_frag__' as const;

/** Por debajo de ~2 MB en SQLite (Android CursorWindow) se guarda en AsyncStorage; de ahí en adelante, en archivo. Medido en BYTES. */
export const MAIN_STRUCTURE_ASYNC_SAFE_MAX_BYTES = 1_200_000;

export class MainStructureCacheError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MainStructureCacheError';
  }
}

export interface StructureKeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  multiSet(pairs: [string, string][]): Promise<void>;
  multiRemove(keys: string[]): Promise<void>;
}

export interface StructureFileStore {
  /** Escribe el archivo TEMPORAL (sobrescribe uno previo). */
  writeTemp(content: string): Promise<void>;
  readTemp(): Promise<string | null>;
  readFinal(): Promise<string | null>;
  /** Reemplaza el archivo definitivo por el temporal; el temporal deja de existir. */
  promoteTemp(): Promise<void>;
  deleteTemp(): Promise<void>;
  deleteFinal(): Promise<void>;
}

/** Bytes que ocupa el texto en UTF-8 (sin `Buffer` ni `TextEncoder`, que no están en todos los entornos). */
export function utf8ByteLength(s: string): number {
  let bytes = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) bytes += 1;
    else if (c < 0x800) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length && s.charCodeAt(i + 1) >= 0xdc00 && s.charCodeAt(i + 1) <= 0xdfff) {
      bytes += 4;
      i += 1;
    } else bytes += 3; // incluye sustitutos sueltos, que UTF-8 codifica como U+FFFD
  }
  return bytes;
}

export type StructureValidation = { ok: true; tree: unknown[] } | { ok: false; reason: string };

/** Un árbol válido es texto JSON de un arreglo cuyos elementos son objetos (puede ser vacío: es la respuesta del servidor). */
export function validateMainStructureJson(raw: unknown): StructureValidation {
  if (typeof raw !== 'string' || raw.trim().length === 0) return { ok: false, reason: 'La jerarquía recibida está vacía o no es texto' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'La jerarquía recibida no es JSON válido' };
  }
  if (!Array.isArray(parsed)) return { ok: false, reason: 'La jerarquía recibida no es un arreglo' };
  if (!parsed.every((n) => n !== null && typeof n === 'object' && !Array.isArray(n))) {
    return { ok: false, reason: 'La jerarquía recibida tiene nodos que no son objetos' };
  }
  return { ok: true, tree: parsed };
}

/** Los fragmentos del servidor deben incluir `empresas` (arreglo); sin ella el árbol mergeado queda vacío. */
export function validateMainStructureFragments(fragments: unknown): { ok: true } | { ok: false; reason: string } {
  if (fragments === null || typeof fragments !== 'object' || Array.isArray(fragments)) {
    return { ok: false, reason: 'Los fragmentos de la jerarquía no son un objeto' };
  }
  if (!Array.isArray((fragments as Record<string, unknown>).empresas)) {
    return { ok: false, reason: 'Los fragmentos de la jerarquía no traen la lista de empresas' };
  }
  return { ok: true };
}

async function quietly(op: () => Promise<void>): Promise<void> {
  try {
    await op();
  } catch {
    /* limpieza de mejor esfuerzo: no debe tapar el resultado de la escritura */
  }
}

/**
 * Guarda el árbol (texto JSON) en AsyncStorage o en archivo según su tamaño en bytes. Lanza `MainStructureCacheError` si no es un árbol válido
 * y, ante cualquier fallo, deja la caché anterior intacta.
 */
export async function writeMainStructureCache(kv: StructureKeyValueStore, files: StructureFileStore, json: string): Promise<void> {
  const check = validateMainStructureJson(json);
  if (!check.ok) throw new MainStructureCacheError(check.reason);

  if (utf8ByteLength(json) >= MAIN_STRUCTURE_ASYNC_SAFE_MAX_BYTES) {
    try {
      await files.writeTemp(json);
      const back = await files.readTemp();
      if (back !== json) throw new MainStructureCacheError('El archivo temporal de la jerarquía no quedó completo');
    } catch (e) {
      await quietly(() => files.deleteTemp());
      throw e;
    }
    await files.promoteTemp();
    await kv.setItem(MAIN_STRUCTURE_FILE_FLAG_KEY, '1');
    await quietly(() => kv.removeItem(MAIN_STRUCTURE_MONOLITH_KEY));
    return;
  }

  // AsyncStorage: primero el dato, luego la bandera. Si falla el dato, la bandera sigue apuntando a la caché anterior.
  await kv.setItem(MAIN_STRUCTURE_MONOLITH_KEY, json);
  await kv.setItem(MAIN_STRUCTURE_FILE_FLAG_KEY, '0');
  await quietly(() => files.deleteFinal());
  await quietly(() => files.deleteTemp());
}

/** Lee la caché vigente. `null` si no hay o si lo guardado no sirve (un archivo cortado equivale a no tener caché). */
export async function readMainStructureCache(kv: StructureKeyValueStore, files: StructureFileStore): Promise<string | null> {
  const inFile = await kv.getItem(MAIN_STRUCTURE_FILE_FLAG_KEY);
  if (inFile === '1') {
    const candidates: (string | null)[] = [];
    try {
      candidates.push(await files.readFinal());
    } catch {
      candidates.push(null);
    }
    // Si el definitivo falta o está cortado, el temporal completo (de un reemplazo interrumpido) lo sustituye.
    try {
      candidates.push(await files.readTemp());
    } catch {
      candidates.push(null);
    }
    for (const c of candidates) {
      if (c != null && validateMainStructureJson(c).ok) return c;
    }
    return null;
  }

  try {
    return await kv.getItem(MAIN_STRUCTURE_MONOLITH_KEY);
  } catch (e: unknown) {
    const msg = String((e as Error)?.message ?? e);
    if (msg.includes('CursorWindow') || msg.includes('Row too big')) {
      await quietly(() => kv.removeItem(MAIN_STRUCTURE_MONOLITH_KEY));
      return null;
    }
    throw e;
  }
}

/**
 * Reemplaza los fragmentos de la jerarquía: valida, escribe TODOS los nuevos, registra las claves y solo entonces quita los que ya no existen
 * y el monolito legado (`clearLegacy`). Si falla la escritura, los fragmentos anteriores y el monolito siguen ahí.
 */
export async function persistMainStructureFragmentsSafely(
  kv: StructureKeyValueStore,
  fragments: Record<string, unknown>,
  clearLegacy: () => Promise<void>,
): Promise<void> {
  const check = validateMainStructureFragments(fragments);
  if (!check.ok) throw new MainStructureCacheError(check.reason);

  let previousKeys: string[] = [];
  const rawRegistry = await kv.getItem(MAIN_STRUCTURE_FRAGMENT_REGISTRY_KEY);
  if (rawRegistry) {
    try {
      const parsed = JSON.parse(rawRegistry);
      if (Array.isArray(parsed)) previousKeys = parsed.filter((k): k is string => typeof k === 'string');
    } catch {
      previousKeys = [];
    }
  }

  const storageKeys: string[] = [];
  const pairs: [string, string][] = [];
  for (const logical of Object.keys(fragments)) {
    const sk = `${MAIN_STRUCTURE_FRAG_PREFIX}${logical}`;
    storageKeys.push(sk);
    pairs.push([sk, JSON.stringify(fragments[logical])]);
  }

  await kv.multiSet(pairs);
  await kv.setItem(MAIN_STRUCTURE_FRAGMENT_REGISTRY_KEY, JSON.stringify(storageKeys));

  const stale = previousKeys.filter((k) => !storageKeys.includes(k));
  if (stale.length > 0) await quietly(() => kv.multiRemove(stale));
  await quietly(clearLegacy);
}
