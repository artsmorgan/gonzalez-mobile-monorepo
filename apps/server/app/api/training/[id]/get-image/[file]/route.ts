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

    const ext = (file.split(".").pop() || "").toLowerCase();
    const isImageExt = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "heic", "heif"].includes(ext);
    if (!isImageExt && (check as { fileType: string }).fileType !== "image") {
        return NextResponse.json({ status: false, message: "No es imagen" }, { status: 400 });
    }

    const decoded = decodeURIComponent(file);
    const fetched = await fetchDynamicFile({
        req,
        type: "image",
        url: `training/${id}/${decoded}`,
        download: false,
    });

    return new NextResponse(fetched.buffer, {
        headers: {
            "Content-Type": fetched.headers.contentType,
            "Cache-Control": fetched.headers.cacheControl,
        },
    });
}
