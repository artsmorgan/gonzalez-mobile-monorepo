import { deleteFile, getLocalFileDisplayUri, saveFile, type StoredFileType } from '@/hooks/fileStorage';

export const BITACORA_REV_UPLOAD_PLACE_PREFIX = '__BITACORA_REV_FILE__:';
export const BITACORA_REV_UPLOAD_PLACE_SUFFIX = '__';
export const BITACORA_REV_FILE_PREFIX = 'bitacora_rev_';
export const BITACORA_REV_LOCAL_REF_PREFIX = 'bitacora_rev_local:';

export type BitacoraRevisionEntry = {
  key: string;
  label?: string;
  value?: string;
  kind?: string;
  observation?: string;
  images?: string[];
  [k: string]: unknown;
};

export type BitacoraRevFileSlot = {
  index: number;
  fileName: string;
  uri: string;
  name: string;
  type: string;
};

export function bitacoraRevMakeLocalImageRef(fileName: string): string {
  return `${BITACORA_REV_LOCAL_REF_PREFIX}${fileName}`;
}

export function bitacoraRevParseLocalImageRef(s: string | null | undefined): string | null {
  if (typeof s !== 'string' || !s.startsWith(BITACORA_REV_LOCAL_REF_PREFIX)) return null;
  const fn = s.slice(BITACORA_REV_LOCAL_REF_PREFIX.length).trim();
  return fn.length > 0 ? fn : null;
}

export function isBitacoraRevDataUrl(s: string | null | undefined): boolean {
  return typeof s === 'string' && s.startsWith('data:');
}

export function resolveBitacoraRevImageDisplayUri(
  raw: string | null | undefined,
  opts: {
    bitacoraId: number;
    hasIdLocal: boolean;
    getServerImageUrl: (fileName: string) => string;
  },
): string {
  if (raw == null || String(raw).trim() === '') return '';
  const s = String(raw);
  if (s.includes(BITACORA_REV_UPLOAD_PLACE_PREFIX)) return '';
  if (isBitacoraRevDataUrl(s)) return s;
  const localName = bitacoraRevParseLocalImageRef(s);
  if (localName) return getLocalFileDisplayUri(localName) || '';
  if (!opts.hasIdLocal && opts.bitacoraId > 0 && !s.startsWith('data:')) {
    return opts.getServerImageUrl(s);
  }
  return s;
}

export function revisionImagesFromInformacionRevision(infoRevision: unknown): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (!Array.isArray(infoRevision)) return out;
  for (const entry of infoRevision) {
    if (!entry || typeof entry !== 'object') continue;
    const key = String((entry as BitacoraRevisionEntry).key ?? '');
    if (!key || (entry as BitacoraRevisionEntry).kind === 'heading') continue;
    const imgs = (entry as BitacoraRevisionEntry).images;
    if (Array.isArray(imgs) && imgs.length > 0) {
      out[key] = imgs.filter((x) => typeof x === 'string' && String(x).trim() !== '') as string[];
    }
  }
  return out;
}

export function mergeRevisionImagesIntoArray(
  infoRevisionArr: BitacoraRevisionEntry[],
  revisionImages: Record<string, string[]>,
): BitacoraRevisionEntry[] {
  return infoRevisionArr.map((entry) => {
    if (entry.kind === 'heading') return entry;
    const imgs = revisionImages[entry.key];
    if (!Array.isArray(imgs) || imgs.length === 0) {
      const { images: _removed, ...rest } = entry;
      return rest as BitacoraRevisionEntry;
    }
    return { ...entry, images: [...imgs] };
  });
}

/**
 * Al editar: conserva imágenes ya guardadas en `existingRevision` y añade solo las nuevas
 * capturadas en el formulario (`newImagesByKey`). Los valores del formulario vienen en `formRevisionArr`.
 */
export function mergeNewRevisionImagesWithExisting(
  existingRevision: BitacoraRevisionEntry[],
  formRevisionArr: BitacoraRevisionEntry[],
  newImagesByKey: Record<string, string[]>,
): BitacoraRevisionEntry[] {
  const existingImagesByKey = new Map<string, string[]>();
  for (const entry of existingRevision) {
    if (!entry || entry.kind === 'heading') continue;
    const key = String(entry.key ?? '');
    if (!key) continue;
    const imgs = Array.isArray(entry.images)
      ? (entry.images.filter((x) => typeof x === 'string' && String(x).trim() !== '') as string[])
      : [];
    if (imgs.length > 0) existingImagesByKey.set(key, [...imgs]);
  }

  return formRevisionArr.map((entry) => {
    if (entry.kind === 'heading') return entry;
    const key = String(entry.key);
    const existing = existingImagesByKey.get(key) ?? [];
    const newOnes = newImagesByKey[key] ?? [];
    const merged = [...existing, ...newOnes];
    if (merged.length === 0) {
      const { images: _removed, ...rest } = entry;
      return rest as BitacoraRevisionEntry;
    }
    return { ...entry, images: merged };
  });
}

export async function deleteBitacoraRevLocalImageFilesFromMap(
  revisionImages: Record<string, string[]>,
): Promise<void> {
  const entries: BitacoraRevisionEntry[] = Object.entries(revisionImages).map(([key, images]) => ({
    key,
    images,
  }));
  await deleteBitacoraRevLocalImageFiles(entries);
}

export function removeImageFromRevisionArray(
  infoRevision: BitacoraRevisionEntry[],
  revisionKey: string,
  imageRef: string,
): BitacoraRevisionEntry[] {
  return infoRevision.map((entry) => {
    if (String(entry.key) !== String(revisionKey)) return entry;
    const imgs = Array.isArray(entry.images) ? entry.images : [];
    const next = imgs.filter((x) => String(x) !== String(imageRef));
    if (next.length === imgs.length) return entry;
    if (next.length === 0) {
      const { images: _removed, ...rest } = entry;
      return rest as BitacoraRevisionEntry;
    }
    return { ...entry, images: next };
  });
}

export function buildBitacoraRevisionForSubmit(infoRevisionArr: BitacoraRevisionEntry[]): {
  informacion_revision: string;
  fileSlots: BitacoraRevFileSlot[];
} {
  const copy = JSON.parse(JSON.stringify(infoRevisionArr)) as BitacoraRevisionEntry[];
  const fileSlots: BitacoraRevFileSlot[] = [];
  let nextIndex = 0;

  for (const entry of copy) {
    if (entry.kind === 'heading' || !Array.isArray(entry.images) || entry.images.length === 0) continue;
    const newImages: string[] = [];
    for (const raw of entry.images) {
      if (typeof raw !== 'string') continue;
      const local = bitacoraRevParseLocalImageRef(raw);
      if (local) {
        const idx = nextIndex++;
        const uri = getLocalFileDisplayUri(local);
        if (uri) {
          fileSlots.push({
            index: idx,
            fileName: local,
            uri,
            name: local.includes('.') ? local : `${local}.jpg`,
            type: 'image/jpeg',
          });
          newImages.push(`${BITACORA_REV_UPLOAD_PLACE_PREFIX}${idx}${BITACORA_REV_UPLOAD_PLACE_SUFFIX}`);
        } else {
          newImages.push(raw);
        }
      } else {
        newImages.push(raw);
      }
    }
    entry.images = newImages;
  }

  return { informacion_revision: JSON.stringify(copy), fileSlots };
}

export function bitacoraRevisionStringForActionPayload(jsonString: string): string {
  try {
    const arr = JSON.parse(jsonString) as BitacoraRevisionEntry[];
    if (!Array.isArray(arr)) return jsonString;
    for (const entry of arr) {
      if (!Array.isArray(entry.images)) continue;
      entry.images = entry.images.map((img) =>
        typeof img === 'string' && isBitacoraRevDataUrl(img) ? '' : img,
      );
    }
    return JSON.stringify(arr);
  } catch {
    return jsonString;
  }
}

export async function deleteBitacoraRevLocalImageFiles(
  infoRevisionArr: BitacoraRevisionEntry[] | undefined | null,
): Promise<void> {
  if (!Array.isArray(infoRevisionArr)) return;
  const seen = new Set<string>();
  for (const entry of infoRevisionArr) {
    const list = Array.isArray(entry.images) ? entry.images : [];
    for (const raw of list) {
      if (typeof raw !== 'string') continue;
      const local = bitacoraRevParseLocalImageRef(raw);
      if (local && !seen.has(local)) {
        seen.add(local);
        try {
          await deleteFile(local);
        } catch {
          /* idempotente */
        }
      }
    }
  }
}

export async function saveCameraPhotoToBitacoraRevFile(photoUri: string): Promise<string> {
  return saveFile({
    uri: photoUri,
    originalName: 'bitacora_rev_foto',
    extension: 'jpg',
    type: 'image' as StoredFileType,
    prefix: BITACORA_REV_FILE_PREFIX,
  });
}
