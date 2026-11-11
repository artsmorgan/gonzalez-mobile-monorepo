import type { NextRequest } from "next/server";
import { uploadDynamicFiles } from "./callDynamicFilesApi";
import { fetchDynamicFile } from "./callDynamicFilesApi";

export const BITACORA_REV_UPLOAD_PLACE_PREFIX = "__BITACORA_REV_FILE__:";
export const BITACORA_REV_UPLOAD_PLACE_SUFFIX = "__";

type MultipartBody = { get(name: string): string | { arrayBuffer(): Promise<ArrayBuffer> } | null };

function revisionFolder(bitacoraId: number): string {
  return `bitacora-vehiculos-detenidos/${bitacoraId}/revision`;
}

export function parseInformacionRevision(raw: unknown): any[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export async function hydrateBitacoraRevisionImagesFromMultipart(
  req: NextRequest,
  bitacoraId: number,
  informacion_revision: unknown,
  multipartForm: MultipartBody | null,
): Promise<string> {
  let revStr =
    typeof informacion_revision === "string"
      ? informacion_revision
      : JSON.stringify(informacion_revision ?? []);

  if (!multipartForm || !revStr.includes(BITACORA_REV_UPLOAD_PLACE_PREFIX)) {
    return revStr;
  }

  const matches = Array.from(revStr.matchAll(/__BITACORA_REV_FILE__:(\d+)__/g));
  const uniqueSorted = [...new Set(matches.map((m) => parseInt(m[1], 10)))].sort((a, b) => a - b);
  if (uniqueSorted.length === 0) return revStr;

  const filePayload: { type: "image"; extension: string; file_base64: string }[] = [];
  for (const idx of uniqueSorted) {
    const part = multipartForm.get(`file_${idx}`);
    if (part == null || typeof part === "string") {
      throw new Error(`Archivo file_${idx} faltante`);
    }
    const fileBlob = part as unknown as Blob;
    const ab = await fileBlob.arrayBuffer();
    const mime = (fileBlob as { type?: string }).type || "image/jpeg";
    const b64 = Buffer.from(ab).toString("base64");
    const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
    filePayload.push({ type: "image", extension: ext, file_base64: `data:${mime};base64,${b64}` });
  }

  const uploadResp = await uploadDynamicFiles({
    req,
    folderPath: revisionFolder(bitacoraId),
    files: filePayload,
  });
  const uploaded = Array.isArray(uploadResp?.files) ? uploadResp.files : [];
  for (let i = 0; i < uniqueSorted.length; i++) {
    if (!uploaded[i]?.name) throw new Error("Error al subir imágenes de revisión");
  }
  for (let i = 0; i < uniqueSorted.length; i++) {
    const idx = uniqueSorted[i];
    const name = uploaded[i]!.name;
    const token = `${BITACORA_REV_UPLOAD_PLACE_PREFIX}${idx}${BITACORA_REV_UPLOAD_PLACE_SUFFIX}`;
    revStr = revStr.split(token).join(name);
  }
  return revStr;
}

/** Token de acceso vía `Authorization` o query `?token=` en `req` (ver getAccessToken en callDynamicFilesApi). */
export async function fetchBitacoraRevisionImage(
  req: NextRequest,
  bitacoraId: number,
  imageName: string,
) {
  return fetchDynamicFile({
    req,
    type: "image",
    url: `${revisionFolder(bitacoraId)}/${imageName}`,
    download: false,
  });
}

export function removeImageFromRevisionJson(
  informacion_revision: unknown,
  revisionKey: string,
  imageName: string,
): string {
  const arr = parseInformacionRevision(informacion_revision);
  const next = arr.map((entry: any) => {
    if (String(entry?.key) !== String(revisionKey)) return entry;
    const imgs = Array.isArray(entry.images) ? entry.images : [];
    const filtered = imgs.filter((x: unknown) => String(x) !== String(imageName));
    if (filtered.length === imgs.length) return entry;
    if (filtered.length === 0) {
      const { images: _removed, ...rest } = entry;
      return rest;
    }
    return { ...entry, images: filtered };
  });
  return JSON.stringify(next);
}
