import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { prisma } from "../../../../../../../../utils/prismaClient";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; contributionId: string; image: string }> }
) {
  try {
    const { id, contributionId, image } = await context.params;
    const incidentId = parseInt(id, 10);
    const aporteId = parseInt(contributionId, 10);

    if (!incidentId || !aporteId || !image) {
      return NextResponse.json({ status: false, message: "IDs o imagen faltante" }, { status: 400 });
    }

    const aporte = await prisma.c_contribucion_incidente.findFirst({
      where: { id: aporteId, incidente_id: incidentId },
    });
    if (!aporte) return NextResponse.json({ status: false, message: "Aporte no encontrado" }, { status: 404 });

    const fileRecord = await prisma.c_archivos_aporte_incidente.findFirst({
      where: { contribucion_id: aporteId, name: image },
    });
    if (!fileRecord) return NextResponse.json({ status: false, message: "Archivo no encontrado" }, { status: 404 });

    const filePath = path.join(
      process.cwd(),
      "public",
      "uploads",
      "incidents",
      `${incidentId}`,
      "aportes",
      `${aporteId}`,
      image
    );

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ status: false, message: "Imagen no encontrada" }, { status: 404 });
    }

    const file = await fs.promises.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();

    let contentType = "application/octet-stream";
    if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
    if (ext === ".png") contentType = "image/png";
    if (ext === ".webp") contentType = "image/webp";
    if (ext === ".gif") contentType = "image/gif";

    return new NextResponse(Buffer.from(file), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in GET /api/incidents/[id]/contributions/[contributionId]/get-image/[image]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}


