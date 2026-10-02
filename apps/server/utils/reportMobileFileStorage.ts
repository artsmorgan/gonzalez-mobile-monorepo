/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextRequest } from "next/server";
import type { ReportDataAccess } from "./reportDynamicPrisma";
import { uploadDynamicFiles } from "./callDynamicFilesApi";
import { resolveUserAccessToken } from "./resolveUserAccessToken";

function sanitizeFilePart(v: string): string {
    const s = String(v || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9_-]+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "");
    return s || "reporte";
}

export function mergeFiltersWithOutputFile(
    filtersJson: string | null,
    outputFile: string,
    outputUrl?: string,
): string {
    let obj: Record<string, unknown> = {};
    try {
        obj = JSON.parse(filtersJson || "{}") as Record<string, unknown>;
    } catch {
        obj = {};
    }
    const { serviceAccessToken: _removed, ...rest } = obj;
    return JSON.stringify({
        ...rest,
        outputFile,
        ...(outputUrl ? { outputUrl } : {}),
    });
}

/** Sube el reporte generado vía `dynamic-prisma/files` (mismo patrón que MantenimientoEquipo). */
export async function saveReportMobileFile(params: {
    req: NextRequest;
    reportId: number;
    buffer: Buffer;
    baseName: string;
    extension: string;
    shouldVerifyAccessToken?: boolean;
}): Promise<{ fileName: string; relativeUrl: string }> {
    const ext = String(params.extension || "xlsx").replace(/^\./, "").toLowerCase() || "xlsx";
    const safeBase = sanitizeFilePart(params.baseName);
    const originalName = `${safeBase}.${ext}`;

    const hasUserJwt = !!resolveUserAccessToken(params.req);
    const shouldVerifyAccessToken = params.shouldVerifyAccessToken ?? hasUserJwt;

    const uploadResp = await uploadDynamicFiles({
        req: params.req,
        folderPath: `reportes_mobile/${params.reportId}`,
        shouldVerifyAccessToken,
        files: [
            {
                type: "file",
                extension: ext,
                original_name: originalName,
                name: originalName,
                file_base64: params.buffer.toString("base64"),
            },
        ],
    });

    const uploaded = Array.isArray(uploadResp?.files) ? uploadResp.files[0] : null;
    const url = String(uploaded?.url || "").trim();
    const relativeUrl = url.startsWith("/uploads/")
        ? url.slice("/uploads/".length)
        : String(uploaded?.relative_path || `reportes_mobile/${params.reportId}/${uploaded?.name || originalName}`).replace(/\\/g, "/");

    return {
        fileName: String(uploaded?.name || originalName),
        relativeUrl,
    };
}

/** Marca el job como completado y guarda metadatos del archivo en `filters`. */
export async function completeReportJob(params: {
    req: NextRequest;
    reportDb: ReportDataAccess;
    reportId: number;
    row: { filters: string | null; nomenclatura: string };
    buffer: Buffer;
    extension: string;
}): Promise<void> {
    const { fileName, relativeUrl } = await saveReportMobileFile({
        req: params.req,
        reportId: params.reportId,
        buffer: params.buffer,
        baseName: params.row.nomenclatura,
        extension: params.extension,
    });

    await params.reportDb.e_reportes_mobile.update({
        where: { id: params.reportId },
        data: {
            estado: "completado",
            filters: mergeFiltersWithOutputFile(params.row.filters, fileName, relativeUrl),
        },
    });
}
