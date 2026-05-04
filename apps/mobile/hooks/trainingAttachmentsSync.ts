import { getFile } from '@/hooks/fileStorage';

/** Metadato guardado en cola offline (sin base64 en JSON). */
export type TrainingFileQueueMeta = {
  id: string;
  localFileName: string;
  extension: string;
  originalName?: string;
};

function mimeForExtension(ext: string): string {
  const e = String(ext || 'jpg')
    .replace(/^\./, '')
    .toLowerCase();
  if (e === 'png' || e === 'gif' || e === 'webp') {
    return `image/${e === 'gif' ? 'gif' : e === 'webp' ? 'webp' : 'png'}`;
  }
  if (e === 'jpg' || e === 'jpeg') return 'image/jpeg';
  if (e === 'heic' || e === 'heif') return 'image/heic';
  if (e === 'pdf') return 'application/pdf';
  if (e === 'doc') return 'application/msword';
  if (e === 'docx') {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (e === 'xls') return 'application/vnd.ms-excel';
  if (e === 'xlsx') {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }
  if (e === 'ppt') return 'application/vnd.ms-powerpoint';
  if (e === 'pptx') {
    return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  }
  if (e === 'txt' || e === 'log') return 'text/plain';
  if (e === 'csv') return 'text/csv';
  if (e === 'html' || e === 'htm') return 'text/html';
  if (e === 'json') return 'application/json';
  if (e === 'rtf') return 'application/rtf';
  if (e === 'mp4' || e === 'm4v') return 'video/mp4';
  if (e === 'mov') return 'video/quicktime';
  if (e === 'webm') return 'video/webm';
  if (e === 'mkv') return 'video/x-matroska';
  if (e === 'mp3' || e === 'aac') return 'audio/mpeg';
  if (e === 'm4a') return 'audio/mp4';
  if (e === 'wav') return 'audio/wav';
  if (e === 'ogg' || e === 'oga') return 'audio/ogg';
  return 'application/octet-stream';
}

/**
 * Construye data URIs para POST /api/training a partir de archivos en almacenamiento local.
 */
export async function buildTrainingDataUrisFromFileMeta(
  list: TrainingFileQueueMeta[]
): Promise<string[]> {
  const { files } = await buildTrainingFilesAndMetaFromFileMeta(list);
  return files;
}

export type TrainingFileMetaForApi = { original_name?: string; extension: string };

/**
 * Misma longitud y orden: `files[i]` + `files_meta[i]` (para nombres/extensiones reales en el servidor).
 */
export async function buildTrainingFilesAndMetaFromFileMeta(
  list: TrainingFileQueueMeta[]
): Promise<{ files: string[]; files_meta: TrainingFileMetaForApi[] }> {
  const files: string[] = [];
  const files_meta: TrainingFileMetaForApi[] = [];
  for (const m of list) {
    if (!m.localFileName) continue;
    try {
      const g = await getFile(m.localFileName);
      const mime = mimeForExtension(m.extension);
      files.push(`data:${mime};base64,${g.base64}`);
      const ext = String(m.extension || '')
        .replace(/^\./, '')
        .toLowerCase();
      const on = m.originalName && String(m.originalName).trim() !== '' ? String(m.originalName).trim() : undefined;
      files_meta.push({
        original_name: on,
        extension: ext || 'bin',
      });
    } catch (e) {
      console.warn('training: no se leyó archivo local', m.localFileName, e);
    }
  }
  return { files, files_meta };
}

/**
 * Añade `files` (data URIs) a `requestData` si venía `filesMeta` (cola offline).
 */
export async function hydrateTrainingRequestDataForSync(requestData: any): Promise<any> {
  if (requestData == null || typeof requestData !== 'object') return requestData;
  const meta = requestData.filesMeta as TrainingFileQueueMeta[] | undefined;
  if (!Array.isArray(meta) || meta.length === 0) {
    const { filesMeta: _f, ...rest } = requestData;
    return rest;
  }
  const { files, files_meta } = await buildTrainingFilesAndMetaFromFileMeta(meta);
  const { filesMeta: _f, file: _oldFile, ...rest } = requestData;
  // No duplicar: el API prioriza `files[]`; `file` solo confundía al subir 2 veces el primero.
  return { ...rest, files, files_meta };
}

export function trainingFilesMetaForQueue(list: TrainingFileQueueMeta[]): TrainingFileQueueMeta[] {
  return list.map((x) => ({
    id: x.id,
    localFileName: x.localFileName,
    extension: x.extension,
    originalName: x.originalName,
  }));
}
