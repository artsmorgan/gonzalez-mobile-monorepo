import { deleteFile, getLocalFileDisplayUri, saveFile, type StoredFileType } from '@/hooks/fileStorage';

/** Placeholder en el JSON; el servidor reemplaza por el nombre almacenado y sirve vía get-image. */
export const STAFF_EVAL_UPLOAD_PLACE_PREFIX = '__STAFFEVAL_FILE__:';
export const STAFF_EVAL_UPLOAD_PLACE_SUFFIX = '__';

/** Marcador en `images[]` / `image` para archivo en disco (misma idea que acta, sin base64 en JSON). */
export const STAFF_EVAL_FILE_PREFIX = 'staff_eval_';
export const STAFF_EVAL_LOCAL_REF_PREFIX = 'staff_eval_local:';

export function staffEvalMakeLocalImageRef(fileName: string): string {
  return `${STAFF_EVAL_LOCAL_REF_PREFIX}${fileName}`;
}

export function staffEvalParseLocalImageRef(s: string | null | undefined): string | null {
  if (typeof s !== 'string' || !s.startsWith(STAFF_EVAL_LOCAL_REF_PREFIX)) return null;
  const fn = s.slice(STAFF_EVAL_LOCAL_REF_PREFIX.length).trim();
  return fn.length > 0 ? fn : null;
}

export function isStaffEvalDataUrl(s: string | null | undefined): boolean {
  return typeof s === 'string' && s.startsWith('data:');
}

/**
 * Resuelve un valor de imagen a URI para <Image source={{ uri }} /> (formulario o listado local).
 */
export function resolveStaffEvalImageDisplayUri(
  raw: string | null | undefined,
  opts: {
    evalId: number;
    hasIdLocal: boolean;
    getServerImageUrl: (fileName: string) => string;
  },
): string {
  if (raw == null || String(raw).trim() === '') return '';
  const s = String(raw);
  if (s.includes('__STAFFEVAL_FILE__:')) return '';
  if (isStaffEvalDataUrl(s)) return s;
  const localName = staffEvalParseLocalImageRef(s);
  if (localName) {
    return getLocalFileDisplayUri(localName) || '';
  }
  if (!opts.hasIdLocal && opts.evalId > 0 && !s.startsWith('data:')) {
    return opts.getServerImageUrl(s);
  }
  return s;
}

type EvalQuestion = {
  image?: string | null;
  images?: (string | null | undefined)[];
  [k: string]: any;
};

type EvalSection = { title: string; questions: EvalQuestion[]; [k: string]: any };

export type StaffEvalFileSlot = {
  index: number;
  fileName: string;
  uri: string;
  name: string;
  type: string;
};

/**
 * Prepara el JSON de evaluación para enviar sin data URLs: refs locales se sustituyen por
 * placeholders; los binarios van en multipart (`file_0`, `file_1`, …) vía `createStaffEvaluation`.
 */
export function buildStaffEvaluacionForSubmit(sections: EvalSection[]): {
  evaluacion: string;
  fileSlots: StaffEvalFileSlot[];
} {
  const copy = JSON.parse(JSON.stringify(sections)) as EvalSection[];
  const fileSlots: StaffEvalFileSlot[] = [];
  let nextIndex = 0;

  for (const sec of copy) {
    for (const q of sec.questions || []) {
      const hasImagesArray = Array.isArray(q.images) && q.images.length > 0;
      if (hasImagesArray) {
        const newImages: string[] = [];
        for (const raw of q.images as string[]) {
          if (typeof raw !== 'string') continue;
          const local = staffEvalParseLocalImageRef(raw);
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
              newImages.push(`${STAFF_EVAL_UPLOAD_PLACE_PREFIX}${idx}${STAFF_EVAL_UPLOAD_PLACE_SUFFIX}`);
            } else {
              newImages.push(raw);
            }
          } else {
            newImages.push(raw);
          }
        }
        q.images = newImages;
        if (newImages.length > 0) {
          q.image = newImages[newImages.length - 1] ?? q.image;
        }
        continue;
      }
      if (q.image && typeof q.image === 'string') {
        const local = staffEvalParseLocalImageRef(q.image);
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
            q.image = `${STAFF_EVAL_UPLOAD_PLACE_PREFIX}${idx}${STAFF_EVAL_UPLOAD_PLACE_SUFFIX}`;
            if (!Array.isArray(q.images) || q.images.length === 0) {
              q.images = [q.image];
            }
          }
        }
      }
    }
  }

  return { evaluacion: JSON.stringify(copy), fileSlots };
}

/**
 * Tras éxito en servidor o reemplazo por datos remotos: borra archivos `staff_eval_*` referenciados.
 */
export async function deleteStaffEvalLocalImageFiles(sections: EvalSection[] | undefined | null): Promise<void> {
  if (!Array.isArray(sections)) return;
  const seen = new Set<string>();
  for (const sec of sections) {
    for (const q of sec.questions || []) {
      const list = Array.isArray(q.images) ? q.images : q.image ? [q.image] : [];
      for (const raw of list) {
        if (typeof raw !== 'string') continue;
        const local = staffEvalParseLocalImageRef(raw);
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
}

/**
 * `requestData` para cola: quita cadenas data: (pesadas); mantiene refs locales o nombres de servidor.
 */
export function staffEvaluacionStringForActionPayload(jsonString: string): string {
  try {
    const arr = JSON.parse(jsonString) as EvalSection[];
    if (!Array.isArray(arr)) return jsonString;
    for (const sec of arr) {
      for (const q of sec.questions || []) {
        if (Array.isArray(q.images)) {
          q.images = q.images.map((img) =>
            typeof img === 'string' && isStaffEvalDataUrl(img) ? '' : img,
          );
        }
        if (q.image && typeof q.image === 'string' && isStaffEvalDataUrl(q.image)) {
          q.image = q.images && q.images.length > 0 ? String(q.images[0]) : null;
        }
      }
    }
    return JSON.stringify(arr);
  } catch {
    return jsonString;
  }
}

export async function saveCameraPhotoToStaffEvalFile(photoUri: string): Promise<string> {
  return saveFile({
    uri: photoUri,
    originalName: 'staff_eval_foto',
    extension: 'jpg',
    type: 'image' as StoredFileType,
    prefix: STAFF_EVAL_FILE_PREFIX,
  });
}
