import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../../../../../utils/verifyToken";
import { prisma } from "../../../../../../../../utils/prismaClient";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string; contributionId: string; fileId: string }> }
) {
  try {
    const { valid, expired, payload, message } = verifyAccessToken(req);
    if (!valid) return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });

    const { id, contributionId, fileId } = await context.params;
    const incidentId = parseInt(id, 10);
    const aporteId = parseInt(contributionId, 10);
    const archivoId = parseInt(fileId, 10);
    if (!incidentId || !aporteId || !archivoId) {
      return NextResponse.json({ status: false, message: "IDs no especificados" }, { status: 200 });
    }

    const file = await prisma.c_archivos_aporte_incidente.findFirst({
      where: { id: archivoId, contribucion_id: aporteId },
    });
    if (!file) return NextResponse.json({ status: false, message: "Archivo no encontrado" }, { status: 200 });

    await prisma.c_archivos_aporte_incidente.delete({ where: { id: archivoId } });

    const filePath = path.join(
      process.cwd(),
      "public",
      "uploads",
      "incidents",
      `${incidentId}`,
      "aportes",
      `${aporteId}`,
      file.name
    );
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
    console.error("Error in DELETE /api/incidents/[id]/contributions/[contributionId]/files/[fileId]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}


