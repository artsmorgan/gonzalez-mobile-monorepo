import { getPendingSyncActions } from './getPendingSyncActions';

const FILE_REF_KEYS = new Set([
  'localFileName',
  'file_local_file_name',
  'audio_local_file',
  'attachmentLocalFileName',
  'local_audio_file',
  'stored_file_name',
]);

function collectFromObject(obj: unknown, out: Set<string>): void {
  if (obj == null || typeof obj !== 'object') return;

  if (Array.isArray(obj)) {
    for (const item of obj) collectFromObject(item, out);
    return;
  }

  const record = obj as Record<string, unknown>;
  for (const [key, value] of Object.entries(record)) {
    if (FILE_REF_KEYS.has(key) && typeof value === 'string') {
      const name = value.trim();
      if (name) out.add(name);
    } else if (
      (key === 'notes_images_meta' ||
        key === 'imagenes_meta' ||
        key === 'acta_entrega_images_meta' ||
        key.endsWith('_images_meta')) &&
      Array.isArray(value)
    ) {
      for (const item of value) {
        if (item && typeof item === 'object') {
          const fn = (item as { localFileName?: string }).localFileName;
          if (typeof fn === 'string' && fn.trim()) out.add(fn.trim());
        }
      }
    } else if (typeof value === 'object') {
      collectFromObject(value, out);
    }
  }
}

/** Nombres de archivo local referenciados por colas offline pendientes (no borrar en entrada). */
export async function collectPendingSyncLocalFileNames(): Promise<Set<string>> {
  const out = new Set<string>();
  const pending = await getPendingSyncActions();
  for (const actions of Object.values(pending)) {
    for (const action of actions) {
      collectFromObject(action, out);
    }
  }
  return out;
}
