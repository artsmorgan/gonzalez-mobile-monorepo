import { getFile } from '@/hooks/fileStorage';
import type { IncidentContributionFileInput, IncidentFileInput } from '@/hooks/incidentsTypes';

type ArchivoItem = (IncidentFileInput | IncidentContributionFileInput) & { local_file_name?: string };

function parseArchivosField(archivos: unknown): ArchivoItem[] {
  if (archivos == null) return [];
  if (Array.isArray(archivos)) return archivos as ArchivoItem[];
  if (typeof archivos === 'string' && archivos.trim() !== '') {
    try {
      const p = JSON.parse(archivos);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Rellena `file_base64` leyendo `Paths.document` cuando `local_file_name` está presente
 * (cola offline / sync) sin almacenar base64 en AsyncStorage.
 */
export async function hydrateIncidentArchivosInPayload<T extends { archivos?: unknown }>(payload: T): Promise<T> {
  if (payload == null || typeof payload !== 'object') return payload;
  const out: any = { ...payload };
  const arr = parseArchivosField(out.archivos);
  if (arr.length === 0) return payload;

  const next: ArchivoItem[] = await Promise.all(
    arr.map(async (f) => {
      const local = f?.local_file_name != null && String(f.local_file_name).trim() !== '' ? String(f.local_file_name) : '';
      if (!local) return f;
      const needData =
        f.file_base64 == null ||
        (typeof f.file_base64 === 'string' && f.file_base64.trim() === '');
      if (!needData) return f;
      try {
        const g = await getFile(local);
        return {
          ...f,
          file_base64: g.base64,
        };
      } catch {
        return f;
      }
    })
  );

  if (typeof out.archivos === 'string') {
    out.archivos = JSON.stringify(next);
  } else {
    out.archivos = next;
  }
  return out as T;
}

export function buildArchivosJsonForOfflineQueue(
  files: { type: string; extension: string; name: string; localFileName: string; mimeType?: string }[]
): string {
  const items = files.map(
    (f) =>
      ({
        type: f.type,
        extension: f.extension,
        original_name: f.name,
        file_base64: '',
        mimeType: f.mimeType,
        local_file_name: f.localFileName,
      }) as ArchivoItem
  );
  return JSON.stringify(items);
}
