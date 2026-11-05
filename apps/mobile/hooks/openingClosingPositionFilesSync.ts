import { deleteFile, getFile } from './fileStorage';

export type OpeningClosingImageMeta = {
  id_local?: string;
  id?: number;
  name?: string;
  original_name?: string;
  localFileName?: string;
  uri?: string;
  extension?: string;
};

export function stripOpeningClosingImagesForActionPayload(images: OpeningClosingImageMeta[]): OpeningClosingImageMeta[] {
  return (images || []).map((img) => ({
    id_local: img.id_local,
    id: img.id,
    name: img.name,
    original_name: img.original_name,
    localFileName: img.localFileName,
    extension: img.extension,
  }));
}

export async function buildOpeningClosingImagenesJsonForUpload(params: {
  meta: OpeningClosingImageMeta[];
}): Promise<string | null> {
  const rows = Array.isArray(params.meta) ? params.meta : [];
  if (rows.length === 0) return null;
  const payload: Array<{ file_base64: string; extension: string; original_name: string }> = [];
  for (const row of rows) {
    const localName = String(row.localFileName || '').trim();
    if (!localName) continue;
    try {
      const file = await getFile(localName);
      const ext = String(row.extension || 'jpg').replace('.', '').toLowerCase() || 'jpg';
      payload.push({
        file_base64: file.base64,
        extension: ext,
        original_name: String(row.original_name || row.name || `imagen_${Date.now()}.${ext}`),
      });
    } catch {
      // omit unreadable files
    }
  }
  if (payload.length === 0) return null;
  return JSON.stringify(payload);
}

export async function deleteOpeningClosingLocalFilesFromMeta(images: OpeningClosingImageMeta[]): Promise<void> {
  const rows = Array.isArray(images) ? images : [];
  for (const row of rows) {
    const localName = String(row.localFileName || '').trim();
    if (!localName) continue;
    try {
      await deleteFile(localName);
    } catch {
      // ignore cleanup errors
    }
  }
}
