import AsyncStorage from '@react-native-async-storage/async-storage';
import { File as ExpoFsFile, Paths } from 'expo-file-system';

export const MAIN_STRUCTURE_MONOLITH_ASYNC_KEY = 'main_structure_cache' as const;
export const MAIN_STRUCTURE_FILE_FLAG_ASYNC_KEY = 'main_structure_cache_stored_in_file_v1' as const;
/** Mismo nombre que en `structureCacheFile` — no borrar con `deleteAllFiles` (jerarquía). */
export const MAIN_STRUCTURE_CACHE_FILENAME = 'main_structure_cache.json' as const;

const STORAGE_KEY = MAIN_STRUCTURE_MONOLITH_ASYNC_KEY;
/** Por debajo de ~2MB en SQLite (Android CursorWindow) guardamos en archivo. */
const ASYNC_SAFE_MAX_CHARS = 1_200_000;
const FILE_FLAG_KEY = MAIN_STRUCTURE_FILE_FLAG_ASYNC_KEY;

function structureCacheFile(): ExpoFsFile {
  return new ExpoFsFile(Paths.document, MAIN_STRUCTURE_CACHE_FILENAME);
}

export async function readMainStructureCacheString(): Promise<string | null> {
  const inFile = await AsyncStorage.getItem(FILE_FLAG_KEY);
  if (inFile === '1') {
    try {
      const f = structureCacheFile();
      if (f.exists) return await f.text();
    } catch {
      return null;
    }
    return null;
  }

  try {
    return await AsyncStorage.getItem(STORAGE_KEY);
  } catch (e: unknown) {
    const msg = String((e as Error)?.message ?? e);
    if (msg.includes('CursorWindow') || msg.includes('Row too big')) {
      try {
        await AsyncStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      return null;
    }
    throw e;
  }
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
  try {
    const f = structureCacheFile();
    if (f.exists) f.delete();
  } catch {
    /* ignore */
  }
}

export async function writeMainStructureCacheString(json: string): Promise<void> {
  if (json.length >= ASYNC_SAFE_MAX_CHARS) {
    const f = structureCacheFile();
    f.create({ overwrite: true });
    f.write(json, { encoding: 'utf8' });
    await AsyncStorage.setItem(FILE_FLAG_KEY, '1');
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return;
  }

  await AsyncStorage.setItem(FILE_FLAG_KEY, '0');
  await AsyncStorage.setItem(STORAGE_KEY, json);
  try {
    const f = structureCacheFile();
    if (f.exists) f.delete();
  } catch {
    /* ignore */
  }
}
