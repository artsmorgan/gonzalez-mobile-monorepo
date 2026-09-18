import { Directory, File, Paths } from 'expo-file-system';
import authedFetch from './authedFetch';

export type DownloadReportFileResult =
  | { ok: true; savedUri: string; fileName: string }
  | { ok: false; cancelled: boolean; message?: string };

function decodeMaybeUriComponent(value: string): string {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return '';
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
}

export function parseContentDispositionFilename(header: string | null): string | null {
  if (!header) return null;

  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim());
    } catch {
      /* fall through */
    }
  }

  const quoted = /filename="([^"]+)"/i.exec(header);
  if (quoted?.[1]) {
    return decodeMaybeUriComponent(quoted[1]);
  }

  const plain = /filename=([^;]+)/i.exec(header);
  if (plain?.[1]) {
    return decodeMaybeUriComponent(plain[1].replace(/^"|"$/g, ''));
  }

  return null;
}

function sanitizeFileName(name: string): string {
  const trimmed = String(name ?? '').trim().replace(/[\\/:*?"<>|]+/g, '_');
  return trimmed || 'archivo';
}

/** Detecta nombres de almacenamiento tipo UUID (p. ej. `a1b2c3d4-....pdf`). */
function looksLikeStorageUuidFileName(name: string): boolean {
  const base = String(name || '')
    .trim()
    .replace(/\.[^.]+$/, '');
  if (!base) return false;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(base)) {
    return true;
  }
  if (/^[0-9a-f]{32}$/i.test(base)) {
    return true;
  }
  return false;
}

function inferExtension(contentType: string, fileName: string): string {
  const fromName = fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase() : '';
  if (fromName) return fromName;

  const mime = contentType.split(';')[0].trim().toLowerCase();
  const map: Record<string, string> = {
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-excel': 'xls',
    'application/zip': 'zip',
    'text/csv': 'csv',
  };
  return map[mime] || 'bin';
}

function isPickerCancelledError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /cancelled|canceled/i.test(message);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function parseDataUrl(url: string): { bytes: Uint8Array; contentType: string } | null {
  const commaIdx = url.indexOf(',');
  if (commaIdx < 0) return null;

  const meta = url.slice(0, commaIdx);
  const payload = url.slice(commaIdx + 1);
  const contentTypeMatch = /^data:([^;,]+)/i.exec(meta);
  const contentType = contentTypeMatch?.[1]?.trim() || 'application/octet-stream';
  const isBase64 = /;base64/i.test(meta);

  try {
    if (isBase64) {
      return { bytes: base64ToUint8Array(payload), contentType };
    }
    return { bytes: new TextEncoder().encode(decodeURIComponent(payload)), contentType };
  } catch {
    return null;
  }
}

/**
 * Prioriza el nombre real que manda el cliente (`fallbackFileName` / original_name).
 * El Content-Disposition del servidor suele traer el UUID de almacenamiento.
 */
function resolveFileName(params: {
  contentType: string;
  contentDisposition: string | null;
  fallbackFileName: string;
}): string {
  const { contentType, contentDisposition, fallbackFileName } = params;
  const fromHeaderRaw = parseContentDispositionFilename(contentDisposition);
  const fromHeader = fromHeaderRaw ? decodeMaybeUriComponent(fromHeaderRaw) : '';
  const fromFallback = String(fallbackFileName || '').trim();

  let preferred = '';
  if (fromFallback && !looksLikeStorageUuidFileName(fromFallback)) {
    preferred = fromFallback;
  } else if (fromHeader && !looksLikeStorageUuidFileName(fromHeader)) {
    preferred = fromHeader;
  } else {
    preferred = fromFallback || fromHeader || 'archivo';
  }

  let fileName = sanitizeFileName(preferred);
  if (!fileName.includes('.')) {
    const extFromHeader = fromHeader.includes('.') ? fromHeader.split('.').pop() : '';
    const ext = extFromHeader || inferExtension(contentType, fileName);
    fileName = `${fileName}.${ext}`;
  }
  return fileName;
}

async function saveBytesToUserSelectedFolder(params: {
  bytes: Uint8Array;
  fileName: string;
  contentType: string;
  tempPrefix: string;
}): Promise<DownloadReportFileResult> {
  const { bytes, fileName, contentType, tempPrefix } = params;

  if (bytes.byteLength === 0) {
    return { ok: false, cancelled: false, message: 'El archivo recibido está vacío' };
  }

  const tempFile = new File(Paths.cache, `${tempPrefix}_${Date.now()}_${fileName}`);

  const cleanupTemp = () => {
    try {
      if (tempFile.exists) {
        tempFile.delete();
      }
    } catch {
      /* idempotente */
    }
  };

  try {
    tempFile.create({ overwrite: true });
    tempFile.write(bytes);

    let pickedDirectory: Awaited<ReturnType<typeof Directory.pickDirectoryAsync>>;
    try {
      pickedDirectory = await Directory.pickDirectoryAsync();
    } catch (error) {
      cleanupTemp();
      if (isPickerCancelledError(error)) {
        return { ok: false, cancelled: true };
      }
      throw error;
    }

    const mimeType = contentType.split(';')[0].trim() || 'application/octet-stream';
    const destFile = pickedDirectory.createFile(fileName, mimeType) as File;
    destFile.write(bytes);
    cleanupTemp();

    return { ok: true, savedUri: destFile.uri, fileName };
  } catch (error) {
    cleanupTemp();
    const message = error instanceof Error ? error.message : 'No se pudo guardar el archivo';
    return { ok: false, cancelled: false, message };
  }
}

async function downloadBinaryFromAuthedUrl(params: {
  url: string;
  fallbackFileName: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<unknown>;
}): Promise<
  | { ok: true; bytes: Uint8Array; fileName: string; contentType: string }
  | { ok: false; cancelled: boolean; message?: string }
> {
  const response = await authedFetch({
    url: params.url,
    refreshAccessToken: params.refreshAccessToken,
    logout: params.logout,
  });

  if (!response) {
    return { ok: false, cancelled: false, message: 'Sesión no válida' };
  }

  if (!response.ok) {
    let message = `Error HTTP ${response.status}`;
    try {
      const json = await response.json();
      message = String(json?.message || message);
    } catch {
      /* cuerpo binario o vacío */
    }
    return { ok: false, cancelled: false, message };
  }

  const contentType = response.headers.get('content-type') || 'application/octet-stream';
  const fileName = resolveFileName({
    contentType,
    contentDisposition: response.headers.get('content-disposition'),
    fallbackFileName: params.fallbackFileName,
  });
  const bytes = new Uint8Array(await response.arrayBuffer());

  return { ok: true, bytes, fileName, contentType };
}

export async function downloadAuthedUrlToDevice(params: {
  url: string;
  fallbackFileName: string;
  tempPrefix: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<unknown>;
}): Promise<DownloadReportFileResult> {
  const url = String(params.url || '').trim();
  if (!url) {
    return { ok: false, cancelled: false, message: 'URL inválida para descargar el archivo' };
  }

  if (url.startsWith('data:')) {
    const parsed = parseDataUrl(url);
    if (!parsed) {
      return { ok: false, cancelled: false, message: 'URL de datos inválida para descargar el archivo' };
    }
    const fileName = resolveFileName({
      contentType: parsed.contentType,
      contentDisposition: null,
      fallbackFileName: params.fallbackFileName,
    });
    return saveBytesToUserSelectedFolder({
      bytes: parsed.bytes,
      fileName,
      contentType: parsed.contentType,
      tempPrefix: params.tempPrefix,
    });
  }

  // Archivo ya local (p. ej. adjunto offline): no pasa por authedFetch.
  if (url.startsWith('file://') || url.startsWith('/')) {
    try {
      const local = new File(url);
      if (!local.exists) {
        return { ok: false, cancelled: false, message: 'El archivo local no existe' };
      }
      const bytes = await local.bytes();
      const fileName = resolveFileName({
        contentType: 'application/octet-stream',
        contentDisposition: null,
        fallbackFileName: params.fallbackFileName,
      });
      return saveBytesToUserSelectedFolder({
        bytes,
        fileName,
        contentType: 'application/octet-stream',
        tempPrefix: params.tempPrefix,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo leer el archivo local';
      return { ok: false, cancelled: false, message };
    }
  }

  const downloaded = await downloadBinaryFromAuthedUrl({
    url,
    fallbackFileName: params.fallbackFileName,
    refreshAccessToken: params.refreshAccessToken,
    logout: params.logout,
  });

  if (!downloaded.ok) {
    return downloaded;
  }

  return saveBytesToUserSelectedFolder({
    bytes: downloaded.bytes,
    fileName: downloaded.fileName,
    contentType: downloaded.contentType,
    tempPrefix: params.tempPrefix,
  });
}

export async function downloadReportFileToDevice(params: {
  reportId: number;
  fallbackFileName: string;
  apiUrl: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<unknown>;
}): Promise<DownloadReportFileResult> {
  const { reportId, fallbackFileName, apiUrl, refreshAccessToken, logout } = params;
  const base = apiUrl.replace(/\/+$/, '');
  const url = `${base}/api/reportes/mobile/${reportId}/get-file?t=${Date.now()}`;

  const downloaded = await downloadBinaryFromAuthedUrl({
    url,
    fallbackFileName,
    refreshAccessToken,
    logout,
  });

  if (!downloaded.ok) {
    return downloaded;
  }

  return saveBytesToUserSelectedFolder({
    bytes: downloaded.bytes,
    fileName: downloaded.fileName,
    contentType: downloaded.contentType,
    tempPrefix: `reporte_${reportId}`,
  });
}

export async function downloadReportsBundleToDevice(params: {
  reportIds: number[];
  fallbackFileName: string;
  apiUrl: string;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<unknown>;
}): Promise<DownloadReportFileResult> {
  const ids = [
    ...new Set(
      (params.reportIds || [])
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  ];

  if (!ids.length) {
    return { ok: false, cancelled: false, message: 'No hay reportes válidos para descargar' };
  }

  const base = params.apiUrl.replace(/\/+$/, '');
  const url = `${base}/api/reportes/mobile/reports-download?ids=${encodeURIComponent(ids.join(','))}&t=${Date.now()}`;

  const downloaded = await downloadBinaryFromAuthedUrl({
    url,
    fallbackFileName: params.fallbackFileName,
    refreshAccessToken: params.refreshAccessToken,
    logout: params.logout,
  });

  if (!downloaded.ok) {
    return downloaded;
  }

  return saveBytesToUserSelectedFolder({
    bytes: downloaded.bytes,
    fileName: downloaded.fileName,
    contentType: downloaded.contentType,
    tempPrefix: `reportes_${ids.length}`,
  });
}
