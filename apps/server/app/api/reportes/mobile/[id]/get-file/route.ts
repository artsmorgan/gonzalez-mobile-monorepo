import axios from "axios";
import { NextRequest, NextResponse } from "next/server";
import { fetchDynamicFile } from "../../../../../../utils/callDynamicFilesApi";
import {
    getAuthForDynamicReportesApi,
    resolveDynamicReportesApiUrl,
} from "../../../../../../utils/callDynamicReportesApi";

export const runtime = "nodejs";

/**
 * GET `/api/reportes/mobile/[id]/get-file` — patrón como incidentes + `fetchDynamicFile`:
 * 1) axios POST `/api/dynamic-prisma/reportes` (`mobileReportUploadsPath`)
 * 2) GET `/api/dynamic-prisma/files` con la ruta relativa devuelta
 */
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params;
        const reportId = parseInt(String(id), 10);
        if (!reportId) {
            return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });
        }

        const { authHeader, accessToken } = getAuthForDynamicReportesApi(req);
        const mobileAccessToken = (process.env.MOBILE_ACCESS_TOKEN || "").trim();
        if (!mobileAccessToken) {
            return NextResponse.json({ status: false, message: "MOBILE_ACCESS_TOKEN no configurado" }, { status: 500 });
        }

        const ultimateUrl = resolveDynamicReportesApiUrl(req);
        const prismaRes = await axios.post(
            ultimateUrl,
            {
                mobileAccessToken,
                shouldVerifyAccessToken: true,
                token: accessToken || undefined,
                operation: "mobileReportUploadsPath",
                reportId,
            },
            {
                headers: {
                    Authorization: authHeader,
                    "Content-Type": "application/json",
                },
                validateStatus: () => true,
            },
        );

        const prismaBody = prismaRes?.data;
        if (!prismaBody?.status || !prismaBody?.data?.url) {
            const msg =
                (prismaBody && typeof prismaBody === "object" && String((prismaBody as any).message || "")) ||
                `Error en dynamic-prisma/reportes (${prismaRes.status})`;
            const st =
                prismaRes.status === 404
                    ? 404
                    : prismaRes.status === 409
                      ? 409
                      : prismaRes.status >= 400 && prismaRes.status < 500
                        ? prismaRes.status
                        : 502;
            return NextResponse.json({ status: false, message: msg }, { status: st });
        }

        const fileUrl = String((prismaBody.data as { url: string }).url || "").trim();
        const fetched = await fetchDynamicFile({
            req,
            type: "file",
            url: fileUrl,
            download: true,
        });

        return new NextResponse(fetched.buffer, {
            headers: {
                "Content-Type": fetched.headers.contentType,
                ...(fetched.headers.contentDisposition
                    ? { "Content-Disposition": fetched.headers.contentDisposition }
                    : {}),
                "Cache-Control": fetched.headers.cacheControl,
            },
        });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error("Error in GET /api/reportes/mobile/[id]/get-file:", errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}
