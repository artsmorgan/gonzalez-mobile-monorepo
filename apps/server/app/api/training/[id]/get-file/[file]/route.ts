import { NextRequest, NextResponse } from "next/server";
import { fetchDynamicFile } from "../../../../../../utils/callDynamicFilesApi";
import { assertTrainingFileAccess } from "../../../trainingArchivosHelpers";

export const runtime = "nodejs";

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string; file: string }> }
) {
    const resolvedParams = await context.params;
    const id = parseInt(resolvedParams.id, 10);
    const file = resolvedParams.file;

    if (!id || !file) {
        return NextResponse.json({ status: false, message: "ID o archivo faltante" }, { status: 400 });
    }

    const check = await assertTrainingFileAccess(req, id, file);
    if (!check.allowed) {
        return NextResponse.json({ status: false, message: "No autorizado" }, { status: 404 });
    }

    const t = (check as { fileType: string }).fileType;
    const fetchType = t === "document" ? "document" : "file";

    const decoded = decodeURIComponent(file);
    const fetched = await fetchDynamicFile({
        req,
        type: fetchType,
        url: `training/${id}/${decoded}`,
        download: true,
    });

    return new NextResponse(fetched.buffer, {
        headers: {
            "Content-Type": fetched.headers.contentType,
            "Content-Disposition": fetched.headers.contentDisposition,
            "Cache-Control": fetched.headers.cacheControl,
        },
    });
}
