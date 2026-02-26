/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { verifyAccessToken } from "../../../../utils/verifyToken";
import { verifyTokenFromBody } from "../../../../utils/verifyTokenFromBody";

export const runtime = "nodejs";

type FileKind = "image" | "video" | "audio" | "text" | "file" | "document";

type FileInput = {
    name?: string;
    original_name?: string;
    extension?: string;
    type?: FileKind;
    mime_type?: string;
    file_base64?: string;
    text_content?: string;
};

type FilesPayload = {
    token?: string;
    mobileAccessToken?: string;
    shouldVerifyAccessToken?: boolean;
    folder_path?: string;
    file?: FileInput;
    files?: FileInput[];
};

const MIME_BY_EXT: Record<string, string> = {
    // Images
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    bmp: "image/bmp",
    svg: "image/svg+xml",
    // Audio
    mp3: "audio/mpeg",
    wav: "audio/wav",
    m4a: "audio/mp4",
    ogg: "audio/ogg",
    opus: "audio/ogg",
    aac: "audio/aac",
    // Video
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
    avi: "video/x-msvideo",
    mkv: "video/x-matroska",
    // Text / docs
    txt: "text/plain; charset=utf-8",
    csv: "text/csv; charset=utf-8",
    json: "application/json; charset=utf-8",
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const DEFAULT_EXT_BY_KIND: Record<string, string> = {
    image: "jpg",
    video: "mp4",
    audio: "mp3",
    text: "txt",
    file: "bin",
    document: "bin",
};

const defaultMimeByKind = (kind: string): string => {
    if (kind === "image") return "image/jpeg";
    if (kind === "video") return "video/mp4";
    if (kind === "audio") return "audio/mpeg";
    if (kind === "text") return "text/plain; charset=utf-8";
    return "application/octet-stream";
};

const normalizeBase64 = (input: string): string => {
    const raw = String(input || "").trim();
    const idx = raw.indexOf("base64,");
    if (idx !== -1) return raw.slice(idx + "base64,".length);
    return raw;
};

const sanitizeExtension = (extRaw?: string): string => {
    const cleaned = String(extRaw || "")
        .toLowerCase()
        .replace(/^\./, "")
        .replace(/[^a-z0-9]/g, "");
    return cleaned.slice(0, 12);
};

const safeBasename = (nameRaw?: string): string => {
    const raw = String(nameRaw || "").trim();
    if (!raw) return "";
    const base = path.basename(raw);
    return base.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");
};

const parseBoolean = (value: string | null | undefined, defaultValue = false): boolean => {
    if (value == null) return defaultValue;
    const v = String(value).trim().toLowerCase();
    return v === "1" || v === "true" || v === "yes";
};

const resolveUploadsPath = (inputPath: string): { absolutePath: string; relativePath: string } => {
    const uploadsRoot = path.resolve(process.cwd(), "public", "uploads");
    let cleaned = decodeURIComponent(String(inputPath || ""))
        .replace(/\\/g, "/")
        .replace(/^\/+/, "")
        .trim();

    if (!cleaned) {
        throw new Error("La ruta del archivo/carpeta es obligatoria");
    }
    if (cleaned.startsWith("public/")) {
        cleaned = cleaned.slice("public/".length);
    }
    if (cleaned.startsWith("uploads/")) {
        cleaned = cleaned.slice("uploads/".length);
    }

    const normalizedPosix = path.posix.normalize(cleaned);
    if (
        normalizedPosix === "." ||
        normalizedPosix.startsWith("../") ||
        normalizedPosix.includes("/../") ||
        normalizedPosix.includes("\0")
    ) {
        throw new Error("Ruta inválida");
    }

    const absolutePath = path.resolve(uploadsRoot, normalizedPosix);
    if (!(absolutePath === uploadsRoot || absolutePath.startsWith(`${uploadsRoot}${path.sep}`))) {
        throw new Error("Ruta fuera del directorio permitido");
    }

    return { absolutePath, relativePath: normalizedPosix.replace(/^\/+/, "") };
};

const validateAccess = (
    req: NextRequest,
    mobileAccessTokenRaw?: string,
    tokenFromBodyOrQuery?: string,
    shouldVerifyAccessToken = true
): NextResponse | null => {
    const expectedMobileToken = process.env.MOBILE_ACCESS_TOKEN?.trim();
    const incomingMobileToken = String(
        mobileAccessTokenRaw || req.headers.get("x-mobile-access-token") || ""
    ).trim();

    if (!expectedMobileToken) {
        return NextResponse.json(
            { status: false, message: "MOBILE_ACCESS_TOKEN no configurado en el servidor" },
            { status: 500 }
        );
    }
    if (!incomingMobileToken) {
        return NextResponse.json(
            { status: false, message: "mobileAccessToken es obligatorio" },
            { status: 403 }
        );
    }
    if (incomingMobileToken !== expectedMobileToken) {
        return NextResponse.json(
            { status: false, message: "mobileAccessToken inválido" },
            { status: 403 }
        );
    }

    const tokenValidationHeader = verifyAccessToken(req);
    const tokenValidationAlt = verifyTokenFromBody(tokenFromBodyOrQuery);
    const tokenValidation = tokenValidationHeader.valid ? tokenValidationHeader : tokenValidationAlt;

    if (shouldVerifyAccessToken && !tokenValidation.valid) {
        return NextResponse.json(
            { status: false, expired: tokenValidation.expired, message: tokenValidation.message },
            { status: tokenValidation.expired ? 401 : 403 }
        );
    }

    return null;
};

export async function POST(req: NextRequest) {
    try {
        const payload = (await req.json()) as FilesPayload;
        if (!payload || typeof payload !== "object") {
            return NextResponse.json({ status: false, message: "Payload inválido" }, { status: 400 });
        }

        const shouldVerifyAccessToken = payload.shouldVerifyAccessToken !== false;
        const accessError = validateAccess(
            req,
            payload.mobileAccessToken,
            payload.token,
            shouldVerifyAccessToken
        );
        if (accessError) return accessError;

        const folderRaw = String(payload.folder_path || "").trim();
        if (!folderRaw) {
            return NextResponse.json(
                { status: false, message: "folder_path es obligatorio" },
                { status: 400 }
            );
        }

        const filesInput = Array.isArray(payload.files)
            ? payload.files
            : payload.file
                ? [payload.file]
                : [];
        if (!filesInput.length) {
            return NextResponse.json(
                { status: false, message: "Debe enviar file o files" },
                { status: 400 }
            );
        }

        const { absolutePath: folderAbsolute, relativePath: folderRelative } = resolveUploadsPath(folderRaw);
        if (!fs.existsSync(folderAbsolute)) fs.mkdirSync(folderAbsolute, { recursive: true });

        const savedFiles: any[] = [];
        for (const item of filesInput) {
            const kind = String(item?.type || "file").toLowerCase();
            const extensionFromName = path.extname(String(item?.name || item?.original_name || "")).replace(".", "");
            const extension = sanitizeExtension(
                item?.extension || extensionFromName || DEFAULT_EXT_BY_KIND[kind] || "bin"
            );

            const providedName = safeBasename(item?.name);
            const baseNameWithoutExt = providedName
                ? safeBasename(path.basename(providedName, path.extname(providedName)))
                : uuidv4();
            const finalName = `${baseNameWithoutExt || uuidv4()}.${extension || "bin"}`;

            let buffer: Buffer;
            if (kind === "text" && typeof item?.text_content === "string") {
                buffer = Buffer.from(item.text_content, "utf8");
            } else if (typeof item?.file_base64 === "string" && item.file_base64.trim().length > 0) {
                try {
                    buffer = Buffer.from(normalizeBase64(item.file_base64), "base64");
                } catch {
                    return NextResponse.json(
                        { status: false, message: `Base64 inválido para archivo ${finalName}` },
                        { status: 400 }
                    );
                }
            } else if (kind === "text" && typeof item?.text_content !== "string") {
                return NextResponse.json(
                    { status: false, message: `text_content es obligatorio para archivos de tipo text (${finalName})` },
                    { status: 400 }
                );
            } else {
                return NextResponse.json(
                    { status: false, message: `file_base64 es obligatorio para archivo ${finalName}` },
                    { status: 400 }
                );
            }

            const fullPath = path.join(folderAbsolute, finalName);
            fs.writeFileSync(fullPath, buffer);

            savedFiles.push({
                name: finalName,
                original_name: safeBasename(item?.original_name) || finalName,
                type: kind,
                extension: extension || "bin",
                mime_type: item?.mime_type || MIME_BY_EXT[extension] || defaultMimeByKind(kind),
                size_bytes: buffer.length,
                relative_path: `${folderRelative}/${finalName}`.replace(/\\/g, "/"),
                url: `/uploads/${folderRelative}/${finalName}`.replace(/\\/g, "/"),
            });
        }

        return NextResponse.json(
            {
                status: true,
                message: "Archivo(s) guardado(s) correctamente",
                folder_path: folderRelative,
                files: savedFiles,
            },
            { status: 200 }
        );
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error("Error in POST /api/dynamic-prisma/files:", errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    try {
        console.log("Procedemos a obtener el archivo");
        const { searchParams } = new URL(req.url);
        const type = String(searchParams.get("type") || "file").toLowerCase() as FileKind;
        const fileUrl = String(searchParams.get("url") || "").trim();
        const token = String(searchParams.get("token") || "").trim();
        const mobileAccessToken = String(searchParams.get("mobileAccessToken") || "").trim();
        const shouldVerifyAccessToken = parseBoolean(searchParams.get("shouldVerifyAccessToken"), true);
        const forceDownload = parseBoolean(searchParams.get("download"), type === "file" || type === "document");

        const accessError = validateAccess(
            req,
            mobileAccessToken,
            token,
            shouldVerifyAccessToken
        );
        if (accessError) return accessError;

        if (!fileUrl) {
            return NextResponse.json({ status: false, message: "url es obligatorio" }, { status: 400 });
        }

        const { absolutePath, relativePath } = resolveUploadsPath(fileUrl);
        if (!fs.existsSync(absolutePath)) {
            return NextResponse.json({ status: false, message: "Archivo no encontrado" }, { status: 404 });
        }

        const fileBuffer = await fs.promises.readFile(absolutePath);
        const ext = path.extname(absolutePath).toLowerCase().replace(".", "");
        const contentType = MIME_BY_EXT[ext] || defaultMimeByKind(type) || "application/octet-stream";
        const fileName = safeBasename(path.basename(absolutePath)) || "archivo";

        const headers: Record<string, string> = {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=31536000",
        };

        if (forceDownload) {
            headers["Content-Disposition"] = `attachment; filename="${encodeURIComponent(fileName)}"`;
        }

        if (type === "text" && !forceDownload) {
            return new NextResponse(fileBuffer.toString("utf8"), { headers });
        }

        return new NextResponse(Buffer.from(fileBuffer), {
            headers,
        });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error("Error in GET /api/dynamic-prisma/files:", errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}
