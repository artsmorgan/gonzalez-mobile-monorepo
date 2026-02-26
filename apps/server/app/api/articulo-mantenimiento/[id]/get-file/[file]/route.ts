import { NextRequest, NextResponse } from "next/server";
import { fetchDynamicFile } from "../../../../../../utils/callDynamicFilesApi";
import { callDynamicPrisma } from "../../../../../../utils/callDynamicPrisma";

export const runtime = "nodejs";


export async function GET(req: NextRequest, context: { params: Promise<{ id: string; file: string }> }) {
    const resolvedParams = await context.params;
    const mantenimientoId = parseInt(resolvedParams.id, 10);
    const fileName = resolvedParams.file;

    if (!mantenimientoId || !fileName) {
        return NextResponse.json({ status: false, message: "ID o archivo faltante" }, { status: 400 });
    }

    const mantenimiento = await callDynamicPrisma({
        req,
        data: { action: "GET", table: "c_articulo_mantenimiento", operation: "findUnique", where: { id: mantenimientoId } }
    });
    if (!mantenimiento) return NextResponse.json({ status: false, message: "Mantenimiento no encontrado" }, { status: 404 });

    const fileRecord = await callDynamicPrisma({
        req,
        data: { action: "GET", table: "c_archivos_adjuntos_articulo_mantenimiento", operation: "findFirst", where: { activo_mantenimiento_id: mantenimiento.id, name: fileName } }
    });
    if (!fileRecord) return NextResponse.json({ status: false, message: "Archivo no encontrado" }, { status: 404 });

    const fetched = await fetchDynamicFile({
        req,
        type: "file",
        url: `articulo-mantenimiento/${mantenimiento.id}/${fileName}`,
        download: true,
    });

    return new NextResponse(fetched.buffer, {
        headers: {
            "Content-Type": fetched.headers.contentType,
            ...(fetched.headers.contentDisposition ? { "Content-Disposition": fetched.headers.contentDisposition } : {}),
            "Cache-Control": fetched.headers.cacheControl,
        },
    });
}


