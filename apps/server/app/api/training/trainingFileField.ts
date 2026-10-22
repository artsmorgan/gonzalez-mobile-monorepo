/** Metadatos de adjuntos en `e_registro_capacitaciones.file` (JSON) o nombre legacy. */

export type TrainingFileItem = {
    name: string;
    type: string;
    originalName?: string;
};

const FILE_JSON_PREFIX = '{"v":';

export function parseTrainingFileField(raw: string | null | undefined): TrainingFileItem[] {
    if (raw == null || raw === undefined) return [];
    const s = String(raw).trim();
    if (s === "" || s === "-") return [];
    if (s.startsWith("{") || s.startsWith(FILE_JSON_PREFIX)) {
        try {
            const o = JSON.parse(s) as { v?: number; items?: TrainingFileItem[] };
            if (o && Array.isArray(o.items)) {
                return o.items
                    .filter((x) => x && typeof x.name === "string" && x.name.trim() !== "")
                    .map((x) => ({
                        name: String(x.name).trim(),
                        type: typeof x.type === "string" && x.type ? x.type : "file",
                        originalName: typeof x.originalName === "string" ? x.originalName : undefined,
                    }));
            }
        } catch {
            /* legacy below */
        }
    }
    return [{ name: s, type: "image" }];
}

export function serializeTrainingFileItems(items: TrainingFileItem[]): string {
    const clean = items.filter((x) => x.name && String(x.name).trim() !== "");
    if (clean.length === 0) return "-";
    return JSON.stringify({ v: 1, items: clean });
}

const MIME_TYPE_TO_EXT: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/bmp": "bmp",
    "image/heic": "heic",
    "image/heif": "heif",
    "image/svg+xml": "svg",
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.ms-powerpoint": "ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "text/plain": "txt",
    "text/csv": "csv",
    "text/html": "html",
    "application/json": "json",
    "application/rtf": "rtf",
    "application/octet-stream": "bin",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/wav": "wav",
    "audio/ogg": "ogg",
};

/**
 * Exti. corta para guardar (evita p.ej. `application/octet-stream` → "octet-stream" → "octetstream" al sanear).
 */
export function fileExtensionFromMimeType(mimeRaw: string): string {
    const mime = String(mimeRaw).split(";")[0].trim().toLowerCase();
    if (!mime) return "bin";
    if (MIME_TYPE_TO_EXT[mime]) return MIME_TYPE_TO_EXT[mime];
    if (mime.startsWith("text/")) return "txt";
    if (mime.startsWith("image/")) {
        const sub = mime.slice(6);
        if (sub === "jpeg") return "jpg";
        const short = sub.replace(/[^a-z0-9.+-]/g, "") || "img";
        return short.slice(0, 8);
    }
    if (mime.startsWith("video/")) {
        if (mime.includes("quicktime")) return "mov";
        const sub = mime.slice(6).split(/[+;]/)[0] || "mp4";
        return sub.replace(/[^a-z0-9]/g, "").slice(0, 6) || "mp4";
    }
    if (mime.startsWith("audio/")) {
        const sub = mime.slice(6).split(/[+;]/)[0] || "m4a";
        return sub.replace(/[^a-z0-9]/g, "").slice(0, 5) || "m4a";
    }
    if (mime.includes("wordprocessingml") || (mime.includes("word") && mime.includes("openxml"))) return "docx";
    if (mime.includes("spreadsheetml") || (mime.includes("excel") && mime.includes("openxml"))) return "xlsx";
    if (mime.includes("presentationml") || (mime.includes("powerpoint") && mime.includes("openxml"))) return "pptx";
    if (mime === "application/msword") return "doc";
    return "bin";
}

/** data URI → { base64, mime, ext } (admite parámetros como `;charset=…` antes de `;base64,`). */
export function parseDataUri(dataUri: string): { mime: string; ext: string; base64: string } | null {
    const s = String(dataUri).trim();
    const marker = ";base64,";
    const i = s.indexOf(marker);
    if (i < 0) return null;
    const header = s.slice(0, i);
    const base64 = s.slice(i + marker.length);
    const mimeM = header.match(/^data:([^;]+)/);
    if (!mimeM) return null;
    const mime = mimeM[1];
    const ext = fileExtensionFromMimeType(mime);
    return { mime, ext, base64 };
}

/**
 * `files[]` si trae entradas; si no, `file` (legacy, un solo adjunto). No mezcla ambas (evita duplicar el primero).
 */
/** Metadato opcional por adjunto (mismo orden que `files[]`). Acepta `files_meta` o `filesMeta` (cola offline). */
export type TrainingFileMetaPayload = {
    original_name?: string;
    originalName?: string;
    extension?: string;
};

export function resolveTrainingFilesMetaList(body: {
    files_meta?: unknown;
    filesMeta?: unknown;
}): TrainingFileMetaPayload[] {
    const raw = body?.files_meta ?? body?.filesMeta;
    if (!Array.isArray(raw)) return [];
    return raw.filter((x) => x != null && typeof x === "object") as TrainingFileMetaPayload[];
}

type UploadPart = {
    type: "image" | "video" | "audio" | "document" | "file";
    extension: string;
    file_base64: string;
    original_name?: string;
    mime_type?: string;
};

/**
 * Alinea data URIs con metadato del cliente (nombre original, extensión) para `uploadDynamicFiles`.
 */
export function buildTrainingUploadPartsFromDataUris(
    dataUriList: string[],
    metaList: TrainingFileMetaPayload[] | undefined
): UploadPart[] {
    const parts: UploadPart[] = [];
    for (let i = 0; i < dataUriList.length; i++) {
        const uri = dataUriList[i];
        const meta = Array.isArray(metaList) ? metaList[i] : undefined;
        const parsed = parseDataUri(uri);
        if (!parsed) {
            throw new Error("Formato data URI inválido (adjuntos)");
        }
        const kind = inferUploadType(parsed.mime);
        const extFromMeta = meta?.extension && String(meta.extension).trim().replace(/^\./, "");
        const ext =
            extFromMeta && /^[a-z0-9]{1,20}$/i.test(extFromMeta)
                ? String(extFromMeta).toLowerCase().slice(0, 20)
                : parsed.ext;
        const rawOrig = meta?.original_name ?? meta?.originalName;
        const orig =
            rawOrig != null && String(rawOrig).trim() !== "" ? String(rawOrig).trim() : undefined;
        parts.push({
            type: kind,
            extension: ext,
            file_base64: uri,
            original_name: orig,
            mime_type: parsed.mime,
        });
    }
    return parts;
}

export function collectTrainingUploadDataUrisFromBody(body: { files?: unknown; file?: unknown }): string[] {
    const out: string[] = [];
    if (Array.isArray(body?.files)) {
        for (const f of body.files) {
            if (typeof f === "string" && f.trim().length > 0) {
                out.push(f.trim());
            }
        }
    }
    if (out.length > 0) {
        return out;
    }
    if (body?.file != null && typeof body.file === "string" && body.file.trim().length > 0) {
        out.push(body.file.trim());
    }
    return out;
}

export function inferUploadType(mime: string): "image" | "video" | "audio" | "document" | "file" {
    const m = String(mime).split(";")[0].trim().toLowerCase();
    if (m.startsWith("image/")) return "image";
    if (m.startsWith("video/")) return "video";
    if (m.startsWith("audio/")) return "audio";
    if (m.startsWith("text/")) return "document";
    if (m === "application/pdf" || m.includes("word") || m.includes("sheet") || m.includes("msword") || m.includes("officedocument")) {
        return "document";
    }
    if (m.includes("powerpoint") || m.includes("presentationml")) return "document";
    if (m === "application/json" || m === "application/rtf") return "document";
    return "file";
}
