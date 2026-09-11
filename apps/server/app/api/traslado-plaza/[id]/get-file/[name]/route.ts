import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { fetchDynamicFile } from "../../../../../../utils/callDynamicFilesApi";
import { reportError } from "../../../../../../utils/reportError";

export const runtime = "nodejs";

const safeBasename = (nameRaw?: string): string => {
    const raw = String(nameRaw || "").trim();
    if (!raw) return "";
    const base = path.basename(raw);
    return base.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");
};

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string; name: string }> }
) {
    const { id, name } = await context.params;
    const accionId = parseInt(String(id), 10);
    if (!accionId) {
        await reportError(req, "api/traslado-plaza/[id]/get-file/[name]", "GET", 400, "ID no especificado");
        return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 400 });
    }
    const storedFileName = safeBasename(name) || decodeURIComponent(name);

    try {
        const fetched = await fetchDynamicFile({
            req,
            type: "file",
            url: `archivos-acciones/${accionId}/${storedFileName}`,
            download: false,
        });

        return new NextResponse(fetched.buffer, {
            headers: {
                "Content-Type": fetched.headers.contentType,
                "Cache-Control": fetched.headers.cacheControl,
            },
        });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        await reportError(req, "api/traslado-plaza/[id]/get-file/[name]", "GET", 500, errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}
