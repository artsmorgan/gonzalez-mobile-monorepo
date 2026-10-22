import { NextRequest, NextResponse } from "next/server";
import { fetchDynamicFile } from "../../../../../../utils/callDynamicFilesApi";
import { getAuthForDynamicReportesApi } from "../../../../../../utils/callDynamicReportesApi";
import { executeReportesOperation } from "../../../create";
import { reportError } from "../../../../../../utils/reportError";

export const runtime = "nodejs";

/**
 * GET `/api/reportes/mobile/[id]/get-file`:
 * 1) `executeReportesOperation` (`mobileReportUploadsPath`)
 * 2) GET `/api/dynamic-prisma/files` con la ruta relativa devuelta
 */
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params;
        const reportId = parseInt(String(id), 10);
        if (!reportId) {
            await reportError(req, "api/reportes/mobile/[id]/get-file", "GET", 400, "ID inválido");
            return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });
        }

        const { accessToken } = getAuthForDynamicReportesApi(req);
        const mobileAccessToken = (process.env.MOBILE_ACCESS_TOKEN || "").trim();
        if (!mobileAccessToken) {
            await reportError(req, "api/reportes/mobile/[id]/get-file", "GET", 500, "MOBILE_ACCESS_TOKEN no configurado");
            return NextResponse.json({ status: false, message: "MOBILE_ACCESS_TOKEN no configurado" }, { status: 500 });
        }

        const prismaBody = await executeReportesOperation(req, {
            mobileAccessToken,
            shouldVerifyAccessToken: true,
            token: accessToken || undefined,
            operation: "mobileReportUploadsPath",
            reportId,
        });

        if (!prismaBody?.status || !prismaBody?.data || typeof prismaBody.data !== "object") {
            const msg = prismaBody?.message || "Error al resolver ruta del reporte";
            await reportError(req, "api/reportes/mobile/[id]/get-file", "GET", 404, msg);
            return NextResponse.json({ status: false, message: msg }, { status: 404 });
        }

        const fileUrl = String((prismaBody.data as { url?: string }).url || "").trim();
        if (!fileUrl) {
            await reportError(req, "api/reportes/mobile/[id]/get-file", "GET", 404, "Ruta de archivo no disponible");
            return NextResponse.json({ status: false, message: "Ruta de archivo no disponible" }, { status: 404 });
        }

        const fetched = await fetchDynamicFile({
            req,
            type: "file",
            url: fileUrl,
            download: true,
        });

        return new NextResponse(fetched.buffer, {
            headers: {
                "Content-Type": fetched.headers.contentType,
                "Content-Disposition":
                    fetched.headers.contentDisposition || "attachment",
                "Content-Length": String(fetched.buffer.length),
                "Cache-Control": fetched.headers.cacheControl,
            },
        });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error("Error in GET /api/reportes/mobile/[id]/get-file:", errorMessage);
        await reportError(req, "api/reportes/mobile/[id]/get-file", "GET", 500, errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}
