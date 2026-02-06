import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

import { prisma } from "../../../../../../utils/prismaClient";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string; video: string }> }) {
  const resolvedParams = await context.params;
  const id = parseInt(resolvedParams.id);
  const video = resolvedParams.video;

  if (!id || !video) return NextResponse.json({ status: false, message: "ID o video faltante" }, { status: 400 });

  const mantenimiento = await prisma.c_articulo_mantenimiento.findUnique({ where: { id } });
  if (!mantenimiento) return NextResponse.json({ status: false, message: "Mantenimiento no encontrado" }, { status: 404 });

  const fileRecord = await prisma.c_archivos_adjuntos_articulo_mantenimiento.findFirst({
    where: { activo_mantenimiento_id: mantenimiento.id, name: video },
  });
  if (!fileRecord) return NextResponse.json({ status: false, message: "Archivo no encontrado" }, { status: 404 });

  const filePath = path.join(process.cwd(), "public", "uploads", "articulo-mantenimiento", `${mantenimiento.id}`, video);
  if (!fs.existsSync(filePath)) return NextResponse.json({ status: false, message: "Video no encontrado" }, { status: 404 });

  const file = await fs.promises.readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();

  let contentType = "application/octet-stream";
  if (ext === ".mp4") contentType = "video/mp4";
  if (ext === ".mov") contentType = "video/quicktime";
  if (ext === ".webm") contentType = "video/webm";

  return new NextResponse(Buffer.from(file), {
    headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=31536000" },
  });
}


