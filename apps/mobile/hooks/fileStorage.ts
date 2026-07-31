import { File, Paths } from 'expo-file-system';
import { MAIN_STRUCTURE_CACHE_FILENAME } from './mainStructureCacheStorage';

/** Tipos soportados */
export type StoredFileType = 'image' | 'video' | 'audio' | 'text';

/** Genera UUID simple (sin dependencia externa) */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Archivo bajo el directorio de documentos de la app (misma API para leer/escribir/borrar). */
function fileInDocumentDir(fileName: string): File {
  return new File(Paths.document, fileName);
}

/**
 * Guardar archivo: copia bytes desde `uri` (fetch o `File.copy`) a `Paths.document`.
 */
export async function saveFile(params: {
  uri: string;
  originalName: string;
  extension: string;
  type: StoredFileType;
  prefix: string;
}): Promise<string> {
  console.log('Saving file...');
  const { uri, originalName, extension, prefix } = params;

  if (!uri) throw new Error('URI requerida');

  const uuid = generateUUID();
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const fileName = `${prefix}_${uuid}_${safeName}.${extension}`;
  const dest = fileInDocumentDir(fileName);

  try {
    const res = await fetch(uri);
    if (!res.ok) {
      throw new Error(`No se pudo leer el origen (${res.status})`);
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength === 0) {
      throw new Error('El archivo de origen está vacío');
    }
    dest.create({ overwrite: true });
    dest.write(new Uint8Array(buf));
  } catch {
    const source = new File(uri);
    source.copy(dest);
  }

  return fileName;
}

/** URI para mostrar en `<Image />` sin leer base64 (solo si el archivo existe). */
export function getLocalFileDisplayUri(fileName: string): string {
  const f = fileInDocumentDir(fileName);
  if (!f.exists) return '';
  return f.uri;
}

/**
 * Obtener archivo (base64 + uri canónica).
 */
export async function getFile(fileName: string): Promise<{
  uri: string;
  base64: string;
}> {
  console.log('Getting file...');
  const f = fileInDocumentDir(fileName);

  if (!f.exists) {
    throw new Error('Archivo no existe');
  }

  const base64 = await f.base64();

  return {
    uri: f.uri,
    base64,
  };
}

/**
 * Eliminar un archivo por nombre guardado.
 */
export async function deleteFile(fileName: string): Promise<void> {
  console.log('Deleting file...');
  const f = fileInDocumentDir(fileName);

  if (!f.exists) return;

  f.delete();
}

/**
 * Eliminar todos los archivos en la raíz de `Paths.document` (no borra subdirectorios recursivamente).
 */
export async function deleteAllFiles(preserveNames?: ReadonlySet<string>): Promise<void> {
  console.log('Deleting all files...');
  const entries = Paths.document.list();
  for (const entry of entries) {
    if (entry instanceof File) {
      if (entry.name === MAIN_STRUCTURE_CACHE_FILENAME) {
        continue;
      }
      if (preserveNames?.has(entry.name)) {
        continue;
      }
      try {
        if (entry.exists) {
          entry.delete();
        }
      } catch {
        /* idempotente */
      }
    }
  }
}
