import { NextRequest } from "next/server";
import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";
import { parseTrainingFileField, type TrainingFileItem } from "./trainingFileField";

/** Mismo criterio que permit-request/get-*: token en Bearer o en `?token=` (app móvil). */
export function getTrainingFileAccessTokenFromRequest(req: NextRequest): string {
    const authHeader = req.headers.get("authorization") || "";
    if (authHeader.startsWith("Bearer ")) {
        const t = authHeader.slice(7).trim();
        if (t) return t;
    }
    return String(req.nextUrl.searchParams.get("token") || "").trim();
}

export function getRequestBaseUrl(req: NextRequest): string {
    return req.nextUrl.origin;
}

/** URL pública hacia el endpoint que sirve el binario (mismo criterio que job-manuals). */
export function buildCapacitacionArchivoClientUrl(
    baseUrl: string,
    capacitacionId: number,
    name: string,
    type: string
): string {
    const enc = encodeURIComponent(name);
    const t = (type || "").toLowerCase();
    let path = `/api/training/${capacitacionId}/get-file/${enc}`;
    if (t === "image") path = `/api/training/${capacitacionId}/get-image/${enc}`;
    else if (t === "audio") path = `/api/training/${capacitacionId}/get-audio/${enc}`;
    else if (t === "video") path = `/api/training/${capacitacionId}/get-video/${enc}`;
    return `${baseUrl}${path}`;
}

export type ArchivoDbRow = {
    id: number;
    name: string;
    original_name: string;
    type: string;
    extension: string;
    capacitacion_id: number;
};

/**
 * Comprueba que el archivo pertenezca a la capacitación: tabla nueva o metadato legacy en `file`.
 */
export async function assertTrainingFileAllowed(
    req: NextRequest,
    capacitacionId: number,
    fileName: string
): Promise<{ allowed: false } | { allowed: true; fileType: string }> {
    const accessToken = getTrainingFileAccessTokenFromRequest(req);
    const tokenOpt = accessToken ? accessToken : undefined;
    const decoded = decodeURIComponent(fileName);
    const directRows = await callDynamicPrisma({
        req,
        token: tokenOpt,
        data: {
            action: "GET",
            table: "c_archivos_adjuntos_capacitaciones",
            operation: "findMany",
            where: { capacitacion_id: capacitacionId, name: decoded },
        },
    });
    const direct = Array.isArray(directRows) && directRows[0] ? directRows[0] : null;
    if (direct) {
        const o = direct as any;
        return { allowed: true, fileType: String(o.type || "file") };
    }

    const cap = await callDynamicPrisma({
        req,
        token: tokenOpt,
        data: {
            action: "GET",
            table: "e_registro_capacitaciones",
            operation: "findUnique",
            where: { id: capacitacionId },
        },
    });
    if (!cap) return { allowed: false };
    const capObj = cap as any;
    const legacy: TrainingFileItem[] = parseTrainingFileField(capObj.file);
    const hit = legacy.find((x) => x.name === decoded);
    if (hit) return { allowed: true, fileType: hit.type || "file" };
    return { allowed: false };
}

/** Alias usado en rutas `get-image` / `get-file` / … */
export const assertTrainingFileAccess = assertTrainingFileAllowed;

export function mapArchivoRowToApiPayload(
    baseUrl: string,
    capacitacionId: number,
    row: ArchivoDbRow
) {
    return {
        id: row.id,
        name: row.name,
        original_name: row.original_name,
        type: row.type,
        extension: row.extension,
        url: buildCapacitacionArchivoClientUrl(baseUrl, capacitacionId, row.name, row.type),
    };
}

/** Fila API desde metadato legacy (sin id de tabla). */
export function mapLegacyFileItemToApiPayload(
    baseUrl: string,
    capacitacionId: number,
    item: TrainingFileItem
) {
    return {
        id: 0,
        name: item.name,
        original_name: item.originalName || item.name,
        type: item.type,
        extension: (item as any).extension || item.name.split(".").pop() || "bin",
        url: buildCapacitacionArchivoClientUrl(baseUrl, capacitacionId, item.name, item.type),
    };
}
