import { NextRequest, NextResponse } from "next/server";
import { fetchDynamicFile } from "../../../../../../utils/callDynamicFilesApi";
import { reportError } from "../../../../../../utils/reportError";
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
        await reportError(req, "api/training/[id]/get-image/[file]", "GET", 400, "ID o archivo faltante");
        return NextResponse.json({ status: false, message: "ID o archivo faltante" }, { status: 400 });
    }

    try {
        const check = await assertTrainingFileAccess(req, id, file);
        if (!check.allowed) {
            await reportError(req, "api/training/[id]/get-image/[file]", "GET", 404, "No autorizado");
            return NextResponse.json({ status: false, message: "No autorizado" }, { status: 404 });
        }

        const ext = (file.split(".").pop() || "").toLowerCase();
        const isImageExt = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "heic", "heif"].includes(ext);
        if (!isImageExt && (check as { fileType: string }).fileType !== "image") {
            await reportError(req, "api/training/[id]/get-image/[file]", "GET", 400, "No es imagen");
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
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        await reportError(req, "api/training/[id]/get-image/[file]", "GET", 500, errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}
