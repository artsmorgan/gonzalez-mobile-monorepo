import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { prisma } from "../../../../../../../../utils/prismaClient";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; contributionId: string; video: string }> }
) {
  try {
    const { id, contributionId, video } = await context.params;
    const incidentId = parseInt(id, 10);
    const aporteId = parseInt(contributionId, 10);

    if (!incidentId || !aporteId || !video) {
      return NextResponse.json({ status: false, message: "IDs o video faltante" }, { status: 400 });
    }

    const aporte = await prisma.c_contribucion_incidente.findFirst({
      where: { id: aporteId, incidente_id: incidentId },
    });
    if (!aporte) return NextResponse.json({ status: false, message: "Aporte no encontrado" }, { status: 404 });

    const fileRecord = await prisma.c_archivos_aporte_incidente.findFirst({
      where: { contribucion_id: aporteId, name: video },
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
      video
    );

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ status: false, message: "Video no encontrado" }, { status: 404 });
    }

    const file = await fs.promises.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();

    let contentType = "video/mp4";
    if (ext === ".webm") contentType = "video/webm";
    if (ext === ".mov") contentType = "video/quicktime";
    if (ext === ".avi") contentType = "video/x-msvideo";

    return new NextResponse(Buffer.from(file), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in GET /api/incidents/[id]/contributions/[contributionId]/get-video/[video]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}


