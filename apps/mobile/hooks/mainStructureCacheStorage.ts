import AsyncStorage from '@react-native-async-storage/async-storage';
import { File as ExpoFsFile, Paths } from 'expo-file-system';
import {
  MAIN_STRUCTURE_FILE_FLAG_KEY,
  MAIN_STRUCTURE_MONOLITH_KEY,
  readMainStructureCache,
  writeMainStructureCache,
  type StructureFileStore,
  type StructureKeyValueStore,
} from './mainStructureCacheAtomic';

export const MAIN_STRUCTURE_MONOLITH_ASYNC_KEY = MAIN_STRUCTURE_MONOLITH_KEY;
export const MAIN_STRUCTURE_FILE_FLAG_ASYNC_KEY = MAIN_STRUCTURE_FILE_FLAG_KEY;
/** Mismo nombre que en `structureCacheFile` — no borrar con `deleteAllFiles` (jerarquía). */
export const MAIN_STRUCTURE_CACHE_FILENAME = 'main_structure_cache.json' as const;
/** Archivo temporal de la escritura (issue #178): se escribe y verifica completo antes de reemplazar al definitivo. También se conserva en borrados masivos. */
export const MAIN_STRUCTURE_CACHE_TMP_FILENAME = 'main_structure_cache.json.tmp' as const;

const STORAGE_KEY = MAIN_STRUCTURE_MONOLITH_ASYNC_KEY;
const FILE_FLAG_KEY = MAIN_STRUCTURE_FILE_FLAG_ASYNC_KEY;

function structureCacheFile(): ExpoFsFile {
  return new ExpoFsFile(Paths.document, MAIN_STRUCTURE_CACHE_FILENAME);
}

function structureCacheTmpFile(): ExpoFsFile {
  return new ExpoFsFile(Paths.document, MAIN_STRUCTURE_CACHE_TMP_FILENAME);
}

async function readIfExists(f: ExpoFsFile): Promise<string | null> {
  try {
    return f.exists ? await f.text() : null;
  } catch {
    return null;
  }
}

/** AsyncStorage real para la lógica pura de `mainStructureCacheAtomic`. */
export const asyncStructureStore: StructureKeyValueStore = {
  getItem: (k) => AsyncStorage.getItem(k),
  setItem: (k, v) => AsyncStorage.setItem(k, v),
  removeItem: (k) => AsyncStorage.removeItem(k),
  multiSet: (pairs) => AsyncStorage.multiSet(pairs),
  multiRemove: (keys) => AsyncStorage.multiRemove(keys),
};

/**
 * Archivos reales. `expo-file-system` no documenta qué hace `move` sobre un destino existente, así que el definitivo se borra justo antes de
 * mover el temporal (ya verificado completo): si la app muere en ese instante, `readMainStructureCache` recupera el temporal.
 */
const fileStructureStore: StructureFileStore = {
  async writeTemp(content) {
    const f = structureCacheTmpFile();
    f.create({ overwrite: true });
    f.write(content, { encoding: 'utf8' });
  },
  readTemp: () => readIfExists(structureCacheTmpFile()),
  readFinal: () => readIfExists(structureCacheFile()),
  async promoteTemp() {
    const tmp = structureCacheTmpFile();
    const dest = structureCacheFile();
    if (dest.exists) dest.delete();
    tmp.move(dest);
    if (!dest.exists) throw new Error('No se pudo reemplazar el archivo de la jerarquía');
  },
  async deleteTemp() {
    const f = structureCacheTmpFile();
    if (f.exists) f.delete();
  },
  async deleteFinal() {
    const f = structureCacheFile();
    if (f.exists) f.delete();
  },
};

export async function readMainStructureCacheString(): Promise<string | null> {
  return readMainStructureCache(asyncStructureStore, fileStructureStore);
}

/** Elimina `main_structure_cache`, flag de archivo y el JSON en disco (cache monolítico legado). */
export async function clearMainStructureCacheLegacy(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  try {
    await AsyncStorage.removeItem(FILE_FLAG_KEY);
  } catch {
    /* ignore */
  }
  for (const file of [structureCacheFile(), structureCacheTmpFile()]) {
    try {
      if (file.exists) file.delete();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Guarda el árbol (texto JSON). Valida antes de tocar nada y escribe sin perder la caché anterior (issue #178): lanza
 * `MainStructureCacheError` si no es un árbol válido o si la escritura falla, dejando la caché vigente intacta.
 */
export async function writeMainStructureCacheString(json: string): Promise<void> {
  await writeMainStructureCache(asyncStructureStore, fileStructureStore, json);
}

/** Persiste el árbol mergeado en caché monolítica (AsyncStorage o archivo según tamaño). */
export async function writeMainStructureCacheTree(tree: unknown[]): Promise<void> {
  if (!Array.isArray(tree) || tree.length === 0) return;
  try {
    await writeMainStructureCacheString(JSON.stringify(tree));
  } catch {
    /* ignore */
  }
}
