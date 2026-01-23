import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string; name: string }> }
) {
    try {
        const { id, name } = await context.params;
        const intercambioLineaId = parseInt(String(id), 10);
        if (!intercambioLineaId) {
            return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });
        }

        const dir = path.join(process.cwd(), "public", "uploads", "traslado-plaza", `${intercambioLineaId}`);
        const filePath = path.join(dir, name);

        if (!fs.existsSync(filePath)) {
            return NextResponse.json({ status: false, message: "Archivo no encontrado" }, { status: 404 });
        }

        const fileBuffer = fs.readFileSync(filePath);

        // Determinar content type basado en la extensión
        const ext = name.split('.').pop()?.toLowerCase() || '';
        let contentType = 'application/octet-stream';

        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
            contentType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
        } else if (['mp3', 'wav', 'm4a', 'aac'].includes(ext)) {
            contentType = `audio/${ext === 'm4a' ? 'mp4' : ext}`;
        } else if (['mp4', 'mov', 'avi', 'mkv'].includes(ext)) {
            contentType = `video/${ext === 'mov' ? 'quicktime' : ext}`;
        } else if (ext === 'pdf') {
            contentType = 'application/pdf';
        } else if (ext === 'txt') {
            contentType = 'text/plain';
        } else if (ext === 'csv') {
            contentType = 'text/csv';
        }

        return new NextResponse(fileBuffer, {
            status: 200,
            headers: {
                "Content-Type": contentType,
                "Content-Disposition": `inline; filename="${name}"`,
                "Cache-Control": "public, max-age=31536000, immutable",
            },
        });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error("Error in GET /api/traslado-plaza/[id]/get-file/[name]:", errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}

