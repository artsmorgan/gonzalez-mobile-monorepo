import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../../../utils/verifyToken";
import { prisma } from "../../../../../../utils/prismaClient";
import fs from "fs";
import path from "path";

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string; fileId: string }> }) {
    try {
        const { valid, expired, payload, message } = verifyAccessToken(req);
        if (!valid) {
            return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });
        }

        const resolvedParams = await context.params;
        const incidentId = parseInt(resolvedParams.id);
        const fileId = parseInt(resolvedParams.fileId);

        if (!incidentId || !fileId) {
            return NextResponse.json({ status: false, message: "Parámetros inválidos" }, { status: 200 });
        }

        const file = await prisma.c_archivos_incidente.findUnique({ where: { id: fileId } });
        if (!file || file.incidente_id !== incidentId) {
            return NextResponse.json({ status: false, message: "Archivo no encontrado" }, { status: 200 });
        }

        await prisma.c_archivos_incidente.delete({ where: { id: fileId } });

        const filePath = path.join(process.cwd(), "public", "uploads", "incidents", `${incidentId}`, file.name);
        if (fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
            } catch {
                // ignore
            }
        }

        return NextResponse.json({ status: true, message: "Archivo eliminado correctamente" }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error("Error in DELETE /api/incidents/[id]/files/[fileId]:", errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}


