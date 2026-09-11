import { deleteFile, getFile } from '@/hooks/fileStorage';

export type ApreciacionVulnImageMeta = {
  id?: number;
  name?: string;
  original_name?: string;
  localFileName?: string;
  uri?: string;
  type?: string;
};

const extToMime = (ext?: string): string => {
  switch ((ext || '').toLowerCase()) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
};

export function stripApreciacionImagesForActionPayload(images: ApreciacionVulnImageMeta[]): ApreciacionVulnImageMeta[] {
  return (images || []).map((img) => ({
    id: img?.id,
    name: img?.name,
    original_name: img?.original_name,
    localFileName: img?.localFileName,
    uri: img?.uri,
    type: img?.type,
  }));
}

export async function buildApreciacionImagenesJsonForUpload(params: {
  meta: ApreciacionVulnImageMeta[];
}): Promise<string> {
  const out: Array<{ file_base64: string; extension: string; original_name?: string }> = [];
  for (const m of params.meta || []) {
    if (!m?.localFileName) continue;
    try {
      const f = await getFile(String(m.localFileName));
      const uri = String(m.uri || '');
      const ext = (uri.split('.').pop() || 'jpg').replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
      const mime = extToMime(ext);
      out.push({
        file_base64: `data:${mime};base64,${f.base64}`,
        extension: ext,
        original_name: m.original_name || m.name || 'apreciacion-vulnerabilidad-image',
      });
    } catch {
      // ignore missing local files
    }
  }
  return JSON.stringify(out);
}

export async function deleteApreciacionLocalFilesFromMeta(images: ApreciacionVulnImageMeta[]): Promise<void> {
  for (const img of images || []) {
    if (!img?.localFileName) continue;
    try {
      await deleteFile(img.localFileName);
    } catch {
      // ignore cleanup errors
    }
  }
}

