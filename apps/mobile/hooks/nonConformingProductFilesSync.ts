import { getFile, getLocalFileDisplayUri, deleteFile, type StoredFileType } from '@/hooks/fileStorage';

const PNC_STORAGE_PREFIX = 'non_conforming_product';

export type PncLocalFileLike = {
  id: string;
  type: 'image' | 'audio' | 'video' | 'document';
  name: string;
  extension: string;
  storedFileName?: string;
  uri?: string;
};

function mapPickerTypeToStoredFileType(t: PncLocalFileLike['type']): StoredFileType {
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

export const NON_CONFORMING_PRODUCT_FILE_STORAGE_PREFIX = PNC_STORAGE_PREFIX;

export function mapPncPickerTypeToStoredFileType(t: PncLocalFileLike['type']): StoredFileType {
  return mapPickerTypeToStoredFileType(t);
}

/** Lista serializable para `payload.archivos` (sin base64): rutas bajo documentos vía `stored_file_name`. */
export function buildArchivoStorageListFromPncLocalAttachments(
  imageFiles: PncLocalFileLike[],
  audioFiles: PncLocalFileLike[],
  videoFiles: PncLocalFileLike[],
  documentFiles: PncLocalFileLike[],
): Record<string, unknown>[] {
  const list: Record<string, unknown>[] = [];
  const push = (f: PncLocalFileLike) => {
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

export async function materializePncLocalFilesForOffline(
  imageFiles: PncLocalFileLike[],
  audioFiles: PncLocalFileLike[],
  videoFiles: PncLocalFileLike[],
  documentFiles: PncLocalFileLike[],
): Promise<Record<string, unknown>[]> {
  const base = buildArchivoStorageListFromPncLocalAttachments(imageFiles, audioFiles, videoFiles, documentFiles);
  return base.map((row) => {
    const sn = row.stored_file_name != null ? String(row.stored_file_name) : '';
    const uri = sn ? getLocalFileDisplayUri(sn) : '';
    return { ...row, local_file_uri: uri || undefined };
  });
}

export function parsePncArchivosFromPayload(archivos: unknown): Record<string, unknown>[] {
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

export function pncCacheFilesFromArchivoEntries(entries: Record<string, unknown>[]): Array<{
  id_local: string;
  name: string;
  original_name: string;
  type: string;
  extension: string;
  stored_file_name?: string;
  local_file_uri?: string;
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
      id_local: `local_file_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`,
      name: String(e.original_name || `adjunto_${i + 1}`),
      original_name: String(e.original_name || `adjunto_${i + 1}`),
      type: String(e.type || 'document'),
      extension: String(e.extension || 'dat'),
      stored_file_name: sn || undefined,
      local_file_uri: loc || undefined,
    };
  });
}

export async function resolvePncArchivosForApiRequest(archivos: Record<string, unknown>[]): Promise<{
  archivos: Array<{ type: string; extension: string; original_name?: string; file_base64: string; mimeType?: string }>;
  diskHydrationComplete: boolean;
}> {
  const out: Array<{ type: string; extension: string; original_name?: string; file_base64: string; mimeType?: string }> = [];

  for (const a of archivos) {
    const existingB64 = a.file_base64;
    if (typeof existingB64 === 'string' && existingB64.trim().length > 0) {
      out.push({
        type: String(a.type || 'document'),
        extension: String(a.extension || 'dat').replace(/^\./, ''),
        original_name: a.original_name != null ? String(a.original_name) : undefined,
        file_base64: existingB64.trim(),
        mimeType: a.mimeType != null ? String(a.mimeType) : undefined,
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
      const row: { type: string; extension: string; original_name?: string; file_base64: string; mimeType?: string } = {
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

export async function clearPncPendingFilesFromArchivoList(archivos: Record<string, unknown>[]): Promise<void> {
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

export async function buildNonConformingProductRequestDataForSync(params: {
  action: 'create' | 'update';
  actionId: string;
  payload: Record<string, any>;
}): Promise<{
  requestData: Record<string, any>;
  rawArchivos: Record<string, unknown>[];
  diskHydrationComplete: boolean;
}> {
  const { payload } = params;
  const rawArchivos = parsePncArchivosFromPayload(payload?.archivos);
  const resolved = await resolvePncArchivosForApiRequest(rawArchivos);
  return {
    requestData: {
      ...payload,
      archivos: resolved.archivos,
    },
    rawArchivos,
    diskHydrationComplete: resolved.diskHydrationComplete,
  };
}
