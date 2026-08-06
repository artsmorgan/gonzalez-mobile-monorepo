import { File, Paths } from 'expo-file-system';

/** Prefijo único en Paths.document — no confundir con adjuntos de módulos. */
export const EMPLOYEE_PROFILE_PHOTO_PREFIX = 'employee_profile_photo';

function fileInDocumentDir(fileName: string): File {
  return new File(Paths.document, fileName);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function parseFotoBase64Payload(raw: string): { bytes: Uint8Array; extension: string } | null {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;

  let payload = trimmed;
  let extension = 'jpg';

  if (trimmed.startsWith('data:')) {
    const commaIdx = trimmed.indexOf(',');
    if (commaIdx < 0) return null;
    const meta = trimmed.slice(0, commaIdx);
    payload = trimmed.slice(commaIdx + 1);
    const mimeMatch = /^data:([^;,]+)/i.exec(meta);
    const mime = (mimeMatch?.[1] || '').toLowerCase();
    if (mime.includes('png')) extension = 'png';
    else if (mime.includes('webp')) extension = 'webp';
    else if (mime.includes('gif')) extension = 'gif';
    else extension = 'jpg';
  }

  try {
    return { bytes: base64ToUint8Array(payload), extension };
  } catch {
    return null;
  }
}

/** Nombre estable e inequívoco por empleado (un archivo por id). */
export function buildEmployeeProfilePhotoFileName(empleadoId: string | number, extension = 'jpg'): string {
  const id = String(empleadoId).trim();
  const ext = String(extension || 'jpg').replace(/^\./, '').toLowerCase() || 'jpg';
  return `${EMPLOYEE_PROFILE_PHOTO_PREFIX}_${id}.${ext}`;
}

export function isEmployeeProfilePhotoFileName(fileName: string): boolean {
  return String(fileName || '').startsWith(`${EMPLOYEE_PROFILE_PHOTO_PREFIX}_`);
}

/**
 * Persiste la foto de perfil (base64 o data-URL) en disco.
 * Sustituye cualquier archivo previo del mismo empleado con el prefijo fijo.
 */
export async function saveEmployeeProfilePhotoFromBase64(
  empleadoId: string | number,
  fotoBase64: string | null | undefined,
): Promise<string | null> {
  const id = String(empleadoId ?? '').trim();
  if (!id) return null;

  const parsed = parseFotoBase64Payload(String(fotoBase64 ?? ''));
  if (!parsed || parsed.bytes.byteLength === 0) {
    await deleteEmployeeProfilePhoto(id);
    return null;
  }

  await deleteEmployeeProfilePhoto(id);

  const fileName = buildEmployeeProfilePhotoFileName(id, parsed.extension);
  const dest = fileInDocumentDir(fileName);
  dest.create({ overwrite: true });
  dest.write(parsed.bytes);
  return fileName;
}

/** URI para `<Image source={{ uri }} />` si el archivo existe. */
export function getEmployeeProfilePhotoDisplayUri(fileName: string | null | undefined): string {
  const name = String(fileName || '').trim();
  if (!name || !isEmployeeProfilePhotoFileName(name)) return '';
  const f = fileInDocumentDir(name);
  if (!f.exists) return '';
  return f.uri;
}

/** Borra fotos de perfil del empleado (cualquier extensión). */
export async function deleteEmployeeProfilePhoto(empleadoId: string | number): Promise<void> {
  const id = String(empleadoId ?? '').trim();
  if (!id) return;
  const prefix = `${EMPLOYEE_PROFILE_PHOTO_PREFIX}_${id}.`;
  try {
    const entries = Paths.document.list();
    for (const entry of entries) {
      if (entry instanceof File && entry.name.startsWith(prefix)) {
        try {
          if (entry.exists) entry.delete();
        } catch {
          /* noop */
        }
      }
    }
  } catch {
    /* noop */
  }
}
