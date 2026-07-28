import { NextRequest, NextResponse } from "next/server";
import { fetchDynamicReportsDownload } from "../../../../../utils/callDynamicFilesApi";
import { getAuthForDynamicReportesApi } from "../../../../../utils/callDynamicReportesApi";

export const runtime = "nodejs";

function parseReportIdsParam(raw: string | null): number[] {
    const values = String(raw ?? "")
        .split(/[,\s]+/)
        .map((value) => parseInt(String(value).trim(), 10))
        .filter((value) => Number.isFinite(value) && value > 0);

    return [...new Set(values)];
}

/**
 * GET `/api/reportes/mobile/reports-download?ids=12,11,10`:
 * proxy a GET `/api/dynamic-prisma/files/reports-download`.
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const ids = parseReportIdsParam(searchParams.get("ids") || searchParams.get("report_ids"));

        if (!ids.length) {
            return NextResponse.json({ status: false, message: "ids es obligatorio" }, { status: 400 });
        }

        const { accessToken } = getAuthForDynamicReportesApi(req);
        const mobileAccessToken = (process.env.MOBILE_ACCESS_TOKEN || "").trim();
        if (!mobileAccessToken) {
            return NextResponse.json({ status: false, message: "MOBILE_ACCESS_TOKEN no configurado" }, { status: 500 });
        }
        if (!accessToken) {
            return NextResponse.json({ status: false, message: "Token de acceso requerido" }, { status: 401 });
        }

        const fetched = await fetchDynamicReportsDownload({
            req,
            ids,
            shouldVerifyAccessToken: true,
        });

        return new NextResponse(fetched.buffer, {
            headers: {
                "Content-Type": fetched.headers.contentType,
                "Content-Disposition": fetched.headers.contentDisposition || "attachment",
                "Content-Length": String(fetched.buffer.length),
                "Cache-Control": fetched.headers.cacheControl,
            },
        });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error("Error in GET /api/reportes/mobile/reports-download:", errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}
