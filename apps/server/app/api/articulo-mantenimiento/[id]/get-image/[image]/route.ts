import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

import { prisma } from "../../../../../../utils/prismaClient";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string; image: string }> }) {
  const resolvedParams = await context.params;
  const id = parseInt(resolvedParams.id);
  const image = resolvedParams.image;

  if (!id || !image) return NextResponse.json({ status: false, message: "ID o imagen faltante" }, { status: 400 });

  const mantenimiento = await prisma.c_articulo_mantenimiento.findUnique({ where: { id } });
  if (!mantenimiento) return NextResponse.json({ status: false, message: "Mantenimiento no encontrado" }, { status: 404 });

  const fileRecord = await prisma.c_archivos_adjuntos_articulo_mantenimiento.findFirst({
    where: { activo_mantenimiento_id: mantenimiento.id, name: image },
  });
  if (!fileRecord) return NextResponse.json({ status: false, message: "Archivo no encontrado" }, { status: 404 });

  const filePath = path.join(process.cwd(), "public", "uploads", "articulo-mantenimiento", `${mantenimiento.id}`, image);
  if (!fs.existsSync(filePath)) return NextResponse.json({ status: false, message: "Imagen no encontrada" }, { status: 404 });

  const file = await fs.promises.readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();

  let contentType = "application/octet-stream";
  if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
  if (ext === ".png") contentType = "image/png";
  if (ext === ".webp") contentType = "image/webp";

  return new NextResponse(Buffer.from(file), {
    headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=31536000" },
  });
}


