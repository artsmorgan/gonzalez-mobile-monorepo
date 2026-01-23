import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../utils/prismaClient";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string; fileId: string }> }
) {
  try {
    // Nota: seguimos el patrón de incidentes/job-manuals donde el serving de archivos no requiere auth,
    // pero las mutaciones sí requieren auth normalmente. Aquí mantenemos auth (por seguridad).
    // Si necesitas sin-auth también para delete, lo ajustamos.
    const { verifyAccessToken } = await import("../../../../../../utils/verifyToken");
    const { valid, expired, payload, message } = verifyAccessToken(req);
    if (!valid) return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });

    const { id, fileId } = await context.params;
    const complaintId = parseInt(id, 10);
    const anexId = parseInt(fileId, 10);
    if (!complaintId || !anexId) {
      return NextResponse.json({ status: false, message: "IDs no especificados" }, { status: 200 });
    }

    const anex = await prisma.c_anexos_quejas.findFirst({
      where: { id: anexId, queja_id: complaintId },
    });
    if (!anex) return NextResponse.json({ status: false, message: "Archivo no encontrado" }, { status: 200 });

    await prisma.c_anexos_quejas.delete({ where: { id: anexId } });

    const dir = path.join(process.cwd(), "public", "uploads", "complaints-master", `${complaintId}`);
    const filePath = path.join(dir, anex.name);
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
    console.error("Error in DELETE /api/complaints-master/[id]/files/[fileId]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}


