import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { fetchDynamicFile } from "../../../../../../utils/callDynamicFilesApi";

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
        return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });
    }
    const storedFileName = safeBasename(name) || decodeURIComponent(name);
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
}

