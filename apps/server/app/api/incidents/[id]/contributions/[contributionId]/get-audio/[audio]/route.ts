import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { prisma } from "../../../../../../../../utils/prismaClient";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; contributionId: string; audio: string }> }
) {
  try {
    const { id, contributionId, audio } = await context.params;
    const incidentId = parseInt(id, 10);
    const aporteId = parseInt(contributionId, 10);

    if (!incidentId || !aporteId || !audio) {
      return NextResponse.json({ status: false, message: "IDs o audio faltante" }, { status: 400 });
    }

    const aporte = await prisma.c_contribucion_incidente.findFirst({
      where: { id: aporteId, incidente_id: incidentId },
    });
    if (!aporte) return NextResponse.json({ status: false, message: "Aporte no encontrado" }, { status: 404 });

    const fileRecord = await prisma.c_archivos_aporte_incidente.findFirst({
      where: { contribucion_id: aporteId, name: audio },
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
      audio
    );

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ status: false, message: "Audio no encontrado" }, { status: 404 });
    }

    const file = await fs.promises.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();

    let contentType = "audio/mpeg";
    if (ext === ".wav") contentType = "audio/wav";
    if (ext === ".m4a") contentType = "audio/mp4";
    if (ext === ".ogg" || ext === ".opus") contentType = "audio/ogg";
    if (ext === ".mp3") contentType = "audio/mpeg";

    return new NextResponse(Buffer.from(file), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in GET /api/incidents/[id]/contributions/[contributionId]/get-audio/[audio]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}


