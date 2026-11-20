import Constants from 'expo-constants';
import authedFetch from '@/hooks/authedFetch';
import { getFile, deleteFile } from '@/hooks/fileStorage';

/** Metadato de imagen para cola offline / reconstrucción de `imagenes` al sincronizar (sin base64). */
export type ActaEntregaImageSyncMeta = {
  id_local?: string;
  localFileName?: string;
  extension?: string;
  id?: number;
  name?: string;
};

function extToMime(ext: string): string {
  const e = String(ext || 'jpg').replace(/^\./, '').toLowerCase();
  if (e === 'png') return 'png';
  return 'jpeg';
}

export function stripActaEntregaImagesForActionPayload<T extends { base64?: string; url?: string }>(
  images: T[] | undefined | null,
): ActaEntregaImageSyncMeta[] {
  if (!Array.isArray(images)) return [];
  return images.map((img) => {
    const { base64: _b, url: _u, ...rest } = img as any;
    return rest as ActaEntregaImageSyncMeta;
  });
}

/**
 * Descarga una imagen del servidor (get-image) como data URL para reenvío en PUT que reemplaza todas las fotos.
 */
export async function fetchActaEntregaImageDataUrl(
  actaId: number,
  imageName: string,
  deps: { refreshAccessToken: () => Promise<boolean>; logout: () => Promise<any> },
): Promise<string | null> {
  try {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl || !actaId || !imageName) return null;
    const url = `${apiUrl}/api/acta-entrega-productos/${actaId}/get-image/${encodeURIComponent(imageName)}?t=${Date.now()}`;

    const resp = await authedFetch({
      url,
      init: {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      },
      refreshAccessToken: deps.refreshAccessToken,
      logout: deps.logout,
    });
    if (!resp?.ok) return null;
    const blob = await resp.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onerror = () => resolve(null);
      reader.onloadend = () => resolve((reader.result as string) || null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Construye el JSON string `imagenes` para crear/actualizar acta (base64 en cada entrada).
 */
export async function buildActaEntregaImagenesJsonForUpload(params: {
  meta: ActaEntregaImageSyncMeta[];
  actaIdForExistingServerImages?: number | null;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
}): Promise<string> {
  const { meta, actaIdForExistingServerImages, refreshAccessToken, logout } = params;
  const out: { file_base64: string; extension: string; original_name?: string }[] = [];
  const actaId =
    actaIdForExistingServerImages != null &&
    Number.isFinite(Number(actaIdForExistingServerImages)) &&
    Number(actaIdForExistingServerImages) > 0
      ? Math.floor(Number(actaIdForExistingServerImages))
      : 0;

  for (const m of meta) {
    if (m?.localFileName && String(m.localFileName).trim() !== '') {
      try {
        const { base64 } = await getFile(String(m.localFileName));
        const ext = String(m.extension || 'jpg').replace(/^\./, '').trim() || 'jpg';
        const mime = extToMime(ext);
        const file_base64 = `data:image/${mime};base64,${base64}`;
        const row: { file_base64: string; extension: string; original_name?: string } = {
          file_base64,
          extension: ext,
        };
        if (m.name) row.original_name = String(m.name);
        out.push(row);
      } catch {
        /* omitir archivo ausente */
      }
      continue;
    }

    const hasServerMeta =
      m?.id != null &&
      Number.isFinite(Number(m.id)) &&
      Number(m.id) > 0 &&
      m.name != null &&
      String(m.name).trim() !== '';

    if (hasServerMeta && actaId > 0) {
      const dataUrl = await fetchActaEntregaImageDataUrl(actaId, String(m.name), { refreshAccessToken, logout });
      if (dataUrl) {
        const ext = String(m?.extension || 'jpg').replace(/^\./, '').trim() || 'jpg';
        out.push({
          file_base64: dataUrl,
          extension: ext,
          original_name: String(m.name),
        });
      }
    }
  }

  return JSON.stringify(out);
}

export async function deleteActaEntregaLocalFilesFromMeta(meta: ActaEntregaImageSyncMeta[] | undefined | null): Promise<void> {
  if (!Array.isArray(meta)) return;
  for (const m of meta) {
    const fn = m?.localFileName != null ? String(m.localFileName).trim() : '';
    if (!fn) continue;
    try {
      await deleteFile(fn);
    } catch {
      /* idempotente */
    }
  }
}
