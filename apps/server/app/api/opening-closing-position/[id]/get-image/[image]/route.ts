import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

import { prisma } from "../../../../../../utils/prismaClient";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; image: string }> }
) {
  try {
    const resolvedParams = await context.params;
    const id = parseInt(resolvedParams.id, 10);
    const image = resolvedParams.image;

    if (!id || !image) {
      return NextResponse.json(
        { status: false, message: "ID o imagen faltante" },
        { status: 400 }
      );
    }

    const record = await prisma.c_apertura_cierre_puesto.findUnique({ where: { id } });
    if (!record) {
      return NextResponse.json(
        { status: false, message: "Registro no encontrado" },
        { status: 404 }
      );
    }

    const fileRecord = await prisma.c_imagenes_apertura_cierre_puesto.findFirst({
      where: { apetura_cierre_id: record.id, name: image },
    });
    if (!fileRecord) {
      return NextResponse.json(
        { status: false, message: "Archivo no encontrado" },
        { status: 404 }
      );
    }

    const filePath = path.join(
      process.cwd(),
      "public",
      "uploads",
      "opening-closing-position",
      `${record.id}`,
      image
    );

    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { status: false, message: "Imagen no encontrada" },
        { status: 404 }
      );
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
    console.error("Error in GET /api/opening-closing-position/[id]/get-image/[image]:", errorMessage);
    return NextResponse.json(
      { status: false, message: errorMessage },
      { status: 500 }
    );
  }
}


