import { getFile, deleteFile } from '@/hooks/fileStorage';

export type NoteImageMeta = {
  id?: number;
  name?: string;
  extension?: string;
  localFileName?: string;
  url?: string;
};

function extToMime(ext: string): string {
  const e = String(ext || 'jpg').replace(/^\./, '').toLowerCase();
  if (e === 'png') return 'png';
  if (e === 'webp') return 'webp';
  return 'jpeg';
}

export function stripNoteImagesForActionPayload(images: NoteImageMeta[] | undefined | null): NoteImageMeta[] {
  if (!Array.isArray(images)) return [];
  return images.map((img) => {
    const { ...rest } = img as any;
    return rest as NoteImageMeta;
  });
}

export async function buildNotesImagenesJsonForUpload(params: {
  meta: NoteImageMeta[];
}): Promise<string> {
  const { meta } = params;
  const out: { file_base64: string; extension: string; original_name?: string }[] = [];

  for (const m of meta) {
    if (!m?.localFileName || String(m.localFileName).trim() === '') continue;
    try {
      const { base64 } = await getFile(String(m.localFileName));
      const ext = String(m.extension || 'jpg').replace(/^\./, '').trim() || 'jpg';
      const mime = extToMime(ext);
      out.push({
        file_base64: `data:image/${mime};base64,${base64}`,
        extension: ext,
        original_name: m.name ? String(m.name) : undefined,
      });
    } catch {
      /* ignore missing file */
    }
  }

  return JSON.stringify(out);
}

export async function deleteNotesLocalFilesFromMeta(meta: NoteImageMeta[] | undefined | null): Promise<void> {
  if (!Array.isArray(meta)) return;
  for (const m of meta) {
    const fn = m?.localFileName != null ? String(m.localFileName).trim() : '';
    if (!fn) continue;
    try {
      await deleteFile(fn);
    } catch {
      /* idempotent */
    }
  }
}
