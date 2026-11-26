import authedFetch from '@/hooks/authedFetch';
import { File, Paths } from 'expo-file-system';
import {
  deleteFile,
  getFile,
  getLocalFileDisplayUri,
  saveFile,
  type StoredFileType,
} from '@/hooks/fileStorage';

const COMPLAINTS_MASTER_STORAGE_PREFIX = 'complaints_master';

function dlTempName(extension: string): string {
  const ext = String(extension || 'dat').replace(/^\./, '');
  const u = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return `${COMPLAINTS_MASTER_STORAGE_PREFIX}_dl_tmp_${u}.${ext}`;
}

export type ComplaintsLocalFileLike = {
  id: string;
  type: 'image' | 'audio' | 'video' | 'document';
  name: string;
  extension: string;
  storedFileName?: string;
  uri?: string;
};

function mapPickerTypeToStoredFileType(t: ComplaintsLocalFileLike['type']): StoredFileType {
  if (t === 'document') return 'text';
  return t;
}

function mimeDataPrefixForArchivo(type: string, extension: string): string {
  const ext = String(extension || '')
    .replace(/^\./, '')
    .toLowerCase();
  if (type === 'image') {
    if (ext === 'png') return 'data:image/png;base64,';
    if (ext === 'webp') return 'data:image/webp;base64,';
    return 'data:image/jpeg;base64,';
  }
  if (type === 'video') {
    if (ext === 'webm') return 'data:video/webm;base64,';
    if (ext === 'mov') return 'data:video/quicktime;base64,';
    return 'data:video/mp4;base64,';
  }
  if (type === 'audio') {
    if (ext === 'wav') return 'data:audio/wav;base64,';
    if (ext === 'm4a' || ext === 'mp4') return 'data:audio/mp4;base64,';
    return 'data:audio/mpeg;base64,';
  }
  if (ext === 'pdf') return 'data:application/pdf;base64,';
  if (ext === 'txt' || ext === 'csv') return 'data:text/plain;base64,';
  return 'data:application/octet-stream;base64,';
}

/**
 * Lista serializable para `payload.archivos` (sin base64): rutas bajo `Paths.document` vía `stored_file_name`.
 */
export function buildArchivoStorageListFromLocalAttachments(
  imageFiles: ComplaintsLocalFileLike[],
  audioFiles: ComplaintsLocalFileLike[],
  videoFiles: ComplaintsLocalFileLike[],
  documentFiles: ComplaintsLocalFileLike[],
): Record<string, unknown>[] {
  const list: Record<string, unknown>[] = [];
  const push = (f: ComplaintsLocalFileLike) => {
    const name = f.storedFileName != null && String(f.storedFileName).trim() !== '' ? String(f.storedFileName).trim() : '';
    if (!name) return;
    list.push({
      type: f.type,
      extension: String(f.extension || 'dat').replace(/^\./, ''),
      original_name: f.name,
      stored_file_name: name,
    });
  };
  imageFiles.forEach(push);
  audioFiles.forEach(push);
  videoFiles.forEach(push);
  documentFiles.forEach(push);
  return list;
}

/** Incluye `local_file_uri` para reconstruir vista previa en caché offline. */
export async function materializeComplaintLocalFilesForOffline(
  imageFiles: ComplaintsLocalFileLike[],
  audioFiles: ComplaintsLocalFileLike[],
  videoFiles: ComplaintsLocalFileLike[],
  documentFiles: ComplaintsLocalFileLike[],
): Promise<Record<string, unknown>[]> {
  const base = buildArchivoStorageListFromLocalAttachments(imageFiles, audioFiles, videoFiles, documentFiles);
  return base.map((row) => {
    const sn = row.stored_file_name != null ? String(row.stored_file_name) : '';
    const uri = sn ? getLocalFileDisplayUri(sn) : '';
    return { ...row, local_file_uri: uri || undefined };
  });
}

export function parseComplaintsMasterArchivosFromPayload(archivos: unknown): Record<string, unknown>[] {
  if (archivos == null) return [];
  if (Array.isArray(archivos)) return archivos as Record<string, unknown>[];
  if (typeof archivos === 'string') {
    try {
      const p = JSON.parse(archivos);
      return Array.isArray(p) ? (p as Record<string, unknown>[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Normaliza filas `files` devueltas por el servidor para caché local.
 */
export function normalizeServerFilesForComplaintCache(files: unknown): any[] {
  if (!Array.isArray(files)) return [];
  return files.map((f: any) => ({
    id: f.id,
    name: f.name,
    original_name: f.original_name ?? f.name,
    type: f.type,
    extension: f.extension,
  }));
}

/** Metadatos para filas en caché de quejas pendientes (offline). */
export function complaintCacheFilesFromArchivoEntries(entries: Record<string, unknown>[]): Array<{
  id: number;
  name: string;
  original_name: string;
  type: string;
  extension: string;
  local_uri?: string;
  stored_file_name?: string;
}> {
  return entries.map((e, i) => {
    const sn = e.stored_file_name != null ? String(e.stored_file_name).trim() : '';
    const loc =
      e.local_file_uri != null && String(e.local_file_uri).trim() !== ''
        ? String(e.local_file_uri).trim()
        : sn
          ? getLocalFileDisplayUri(sn)
          : '';
    return {
      id: -(i + 1),
      name: String(e.original_name || `adjunto_${i + 1}`),
      original_name: String(e.original_name || `adjunto_${i + 1}`),
      type: String(e.type || 'document'),
      extension: String(e.extension || 'dat'),
      local_uri: loc || undefined,
      stored_file_name: sn || undefined,
    };
  });
}

export async function resolveComplaintsMasterArchivosForApiRequest(archivos: Record<string, unknown>[]): Promise<{
  archivos: Array<{ type: string; extension: string; original_name?: string; file_base64: string }>;
  diskHydrationComplete: boolean;
}> {
  const out: Array<{ type: string; extension: string; original_name?: string; file_base64: string }> = [];

  for (const a of archivos) {
    const existingB64 = a.file_base64;
    if (typeof existingB64 === 'string' && existingB64.trim().length > 0) {
      out.push({
        type: String(a.type || 'document'),
        extension: String(a.extension || 'dat').replace(/^\./, ''),
        original_name: a.original_name != null ? String(a.original_name) : undefined,
        file_base64: existingB64.trim(),
      });
      continue;
    }

    const stored = a.stored_file_name != null ? String(a.stored_file_name).trim() : '';
    if (!stored) {
      return { archivos: [], diskHydrationComplete: false };
    }

    try {
      const { base64 } = await getFile(stored);
      const ext = String(a.extension || 'dat').replace(/^\./, '');
      const t = String(a.type || 'document');
      const prefix = mimeDataPrefixForArchivo(t, ext);
      const row: { type: string; extension: string; original_name?: string; file_base64: string } = {
        type: t,
        extension: ext,
        file_base64: `${prefix}${base64}`,
      };
      if (a.original_name != null && String(a.original_name).trim() !== '') {
        row.original_name = String(a.original_name);
      }
      out.push(row);
    } catch {
      return { archivos: [], diskHydrationComplete: false };
    }
  }

  return { archivos: out, diskHydrationComplete: true };
}

/**
 * Borra en disco los `stored_file_name` indicados. Llamar **solo** tras creación/actualización exitosa
 * desde la cola `evaluations_actions` en `App.tsx`, o al descartar una acción pendiente (borrador eliminado).
 * No llamar tras guardar online desde la pantalla: los archivos siguen sirviendo para relectura/edición.
 */
export async function clearComplaintsMasterPendingFilesFromArchivoList(
  archivos: Record<string, unknown>[],
): Promise<void> {
  for (const a of archivos) {
    const sn = a.stored_file_name != null ? String(a.stored_file_name).trim() : '';
    if (sn) {
      try {
        await deleteFile(sn);
      } catch {
        /* idempotente */
      }
    }
  }
}

export function documentBasenameFromUri(uri: string): string | null {
  const s = String(uri || '').trim();
  if (!s) return null;
  const path = s.replace(/^file:\/\//, '');
  const base = path.split(/[/\\]/).pop();
  return base && base.length > 0 ? base : null;
}

/** Borra por nombre bajo documentos si el prefijo es de quejas (adjuntos legacy por URI). */
export async function deleteComplaintsMasterLocalFileUri(uri: string): Promise<void> {
  const name = documentBasenameFromUri(uri);
  if (!name || !name.startsWith(`${COMPLAINTS_MASTER_STORAGE_PREFIX}_`)) return;
  try {
    await deleteFile(name);
  } catch {
    /* noop */
  }
}

export async function downloadComplaintsMasterServerFileToLocal(params: {
  url: string;
  fileType: 'image' | 'audio' | 'video' | 'document';
  suggestedName: string;
  extension: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}): Promise<{ storedFileName: string; uri: string } | null> {
  const { url, fileType, suggestedName, extension, refreshAccessToken, logout } = params;
  if (!url) return null;

  const resp = await authedFetch({
    url,
    init: { method: 'GET', headers: { Accept: '*/*' } },
    refreshAccessToken,
    logout,
  });

  if (!resp?.ok) return null;

  const buf = new Uint8Array(await resp.arrayBuffer());
  if (buf.byteLength === 0) return null;

  const ext = String(extension || 'dat').replace(/^\./, '');
  const stem = suggestedName.includes('.') ? suggestedName.slice(0, suggestedName.lastIndexOf('.')) : suggestedName;
  const storedType = mapPickerTypeToStoredFileType(fileType);

  const tmpName = dlTempName(ext);
  const tmp = new File(Paths.document, tmpName);
  try {
    tmp.create({ overwrite: true });
    tmp.write(buf);

    const storedFileName = await saveFile({
      uri: tmp.uri,
      originalName: stem.trim() || 'adjunto',
      extension: ext,
      type: storedType,
      prefix: COMPLAINTS_MASTER_STORAGE_PREFIX,
    });
    const uriOut = getLocalFileDisplayUri(storedFileName);
    return { storedFileName, uri: uriOut };
  } catch {
    return null;
  } finally {
    try {
      if (tmp.exists) tmp.delete();
    } catch {
      /* noop */
    }
  }
}

export async function buildComplaintsMasterRequestDataForSync(params: {
  action: 'create' | 'update';
  actionId: string;
  payload: Record<string, any>;
}): Promise<{
  requestData: Record<string, any>;
  rawArchivos: Record<string, unknown>[];
  diskHydrationComplete: boolean;
}> {
  const { payload } = params;
  const rawArchivos = parseComplaintsMasterArchivosFromPayload(payload?.archivos);
  const resolved = await resolveComplaintsMasterArchivosForApiRequest(rawArchivos);
  return {
    requestData: {
      ...payload,
      archivos: resolved.archivos,
    },
    rawArchivos,
    diskHydrationComplete: resolved.diskHydrationComplete,
  };
}
