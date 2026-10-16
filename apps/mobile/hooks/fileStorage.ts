import { File, Paths } from 'expo-file-system';
import { MAIN_STRUCTURE_CACHE_FILENAME } from './mainStructureCacheStorage';
import { isEmployeeProfilePhotoFileName } from './employeeProfilePhotoStorage';

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

/** `data:<mime>;base64,<payload>` -> payload puro (o `null` si `uri` no es un data URI). */
function extractBase64FromDataUri(uri: string): string | null {
  const match = /^data:[^;]*;base64,([\s\S]+)$/.exec(uri);
  return match ? match[1] : null;
}

/**
 * Guardar archivo: copia bytes desde `uri` (fetch o `File.copy`) a `Paths.document`.
 * Si `uri` es un data URI (`data:...;base64,...`), se escribe el base64 directamente — `fetch`/`File`
 * no soportan URIs `data:` en Android (`URI is not hierarchical`), así que ese camino nunca se intenta.
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

  const base64Payload = extractBase64FromDataUri(uri);
  if (base64Payload != null) {
    dest.create({ overwrite: true });
    dest.write(base64Payload, { encoding: 'base64' });
    return fileName;
  }

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

/**
 * Guardar un base64 puro (sin prefijo `data:...;base64,`) directamente como archivo — evita por
 * completo `fetch`/`File.copy`, que no soportan URIs `data:` en Android.
 */
export async function saveBase64File(params: {
  base64: string;
  extension: string;
  type: StoredFileType;
  prefix: string;
}): Promise<string> {
  const { base64, extension, prefix } = params;
  if (!base64) throw new Error('Base64 requerido');

  const payload = extractBase64FromDataUri(base64) ?? base64;
  const uuid = generateUUID();
  const fileName = `${prefix}_${uuid}.${extension}`;
  const dest = fileInDocumentDir(fileName);

  dest.create({ overwrite: true });
  dest.write(payload, { encoding: 'base64' });

  return fileName;
}

/** URI para mostrar en `<Image />` sin leer base64 (solo si el archivo existe). */
export function getLocalFileDisplayUri(fileName: string): string {
  const f = fileInDocumentDir(fileName);
  if (!f.exists) return '';
  return f.uri;
}

/**
 * Referencia local (nombre de archivo) o, por compatibilidad, un data URI ya guardado tal cual ->
 * URI mostrable en `<Image />`. Útil para firmas manuales guardadas en expo-files cuyo cache/actions
 * solo conserva el nombre de archivo.
 */
export function resolveStoredSignatureDisplayUri(value: string | null | undefined): string {
  if (!value) return '';
  if (value.startsWith('data:')) return value;
  return getLocalFileDisplayUri(value);
}

/**
 * Referencia local (o, por compatibilidad, un data URI ya en base64) -> data URI listo para enviar
 * al servidor. Usado al sincronizar una firma manual guardada como referencia a expo-files.
 */
export async function hydrateSignatureRef(ref: string | null | undefined): Promise<string | undefined> {
  if (!ref) return undefined;
  if (ref.startsWith('data:')) return ref;
  try {
    const g = await getFile(ref);
    return `data:image/png;base64,${g.base64}`;
  } catch {
    return undefined;
  }
}

/** Borra el archivo local de una firma manual ya usada (no hace nada si `ref` ya era un data URI). */
export async function deleteSignatureLocalRef(ref: string | null | undefined): Promise<void> {
  if (!ref || ref.startsWith('data:')) return;
  try {
    await deleteFile(ref);
  } catch {
    /* idempotente */
  }
}

/**
 * Convierte una firma recién dibujada/descargada (`value`) en una referencia local a expo-files.
 * `value` puede ser un data URI, base64 puro sin prefijo (algunos módulos lo envían así al backend),
 * o ya una referencia local existente (se detecta comprobando que el archivo exista, no solo por el
 * prefijo `data:`) — en ese caso se deja igual. Si `previousRef` era una referencia local distinta a
 * la resultante, se borra su archivo (evita huérfanos). Si `value` viene vacío, solo se limpia
 * `previousRef` y se devuelve `null`.
 */
export async function persistSignatureRef(params: {
  value: string | null | undefined;
  previousRef?: string | null;
  prefix: string;
}): Promise<string | null> {
  const { value, previousRef, prefix } = params;
  if (!value) {
    if (previousRef) await deleteSignatureLocalRef(previousRef);
    return null;
  }
  const isExistingLocalRef = !value.startsWith('data:') && !!getLocalFileDisplayUri(value);
  const nextRef = isExistingLocalRef ? value : await saveBase64File({ base64: value, extension: 'png', type: 'image', prefix });
  if (previousRef && previousRef !== nextRef) {
    await deleteSignatureLocalRef(previousRef);
  }
  return nextRef;
}

/**
 * Tras sincronizar una acción con éxito: si la respuesta del servidor incluyó un valor para este
 * campo de firma (la clave está presente, aunque sea `null`/vacío), se guarda como la referencia
 * local vigente en expo-files, reemplazando la anterior (`previousRef`) y borrando su archivo si
 * cambió — así la firma en expo-files siempre corresponde al elemento ya sincronizado en cache. Si
 * el servidor no devolvió esa clave (`undefined`, el endpoint no la incluye en su respuesta), se
 * conserva `previousRef` tal cual, sin tocar nada.
 */
export async function reconcileSignatureFieldAfterSync(
  serverValue: unknown,
  previousRef: string | null | undefined,
  prefix: string
): Promise<string | null | undefined> {
  if (serverValue === undefined) return previousRef;
  return persistSignatureRef({
    value: (serverValue as string | null) ?? null,
    previousRef: previousRef ?? null,
    prefix,
  });
}

/**
 * Convierte el campo `field` (data URI) de cada elemento de `list` en una referencia local a
 * expo-files, para listas descargadas del servidor que se van a cachear (evita guardar base64 en
 * AsyncStorage). Elementos sin ese campo, o ya con una referencia, se dejan igual.
 */
export async function localizeSignatureFieldInList<T extends Record<string, any>>(
  list: T[],
  field: keyof T,
  prefix: string
): Promise<T[]> {
  return Promise.all(
    list.map(async (item) => {
      const raw = item[field];
      if (typeof raw !== 'string' || !raw.startsWith('data:')) return item;
      try {
        const fileName = await saveBase64File({ base64: raw, extension: 'png', type: 'image', prefix });
        return { ...item, [field]: fileName };
      } catch (error) {
        console.error(`Error guardando firma descargada en expo-files (${String(field)}):`, error);
        return { ...item, [field]: null };
      }
    })
  );
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
      if (isEmployeeProfilePhotoFileName(entry.name)) {
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
