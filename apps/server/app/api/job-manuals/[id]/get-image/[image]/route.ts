import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

import { prisma } from '../../../../../../utils/prismaClient';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; image: string }> }
) {
  const resolvedParams = await context.params;
  const id = parseInt(resolvedParams.id);
  const image = resolvedParams.image;

  if (!id || !image) {
    return NextResponse.json(
      { status: false, message: 'ID o imagen faltante' },
      { status: 400 }
    );
  }

  const manual = await prisma.e_manual_puesto.findUnique({ where: { id } });
  if (!manual) {
    return NextResponse.json(
      { status: false, message: 'Manual no encontrado' },
      { status: 404 }
    );
  }

  const fileRecord = await prisma.e_archivos_manual_puesto.findFirst({
    where: { manual_puesto_id: manual.id, name: image },
  });

  if (!fileRecord) {
    return NextResponse.json(
      { status: false, message: 'Archivo no encontrado' },
      { status: 404 }
    );
  }

  const filePath = path.join(
    process.cwd(),
    'public',
    'uploads',
    'job-manuals',
    `${manual.id}`,
    image
  );

  if (!fs.existsSync(filePath)) {
    return NextResponse.json(
      { status: false, message: 'Imagen no encontrada' },
      { status: 404 }
    );
  }

  const file = await fs.promises.readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();

  let contentType = 'application/octet-stream';
  if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
  if (ext === '.png') contentType = 'image/png';
  if (ext === '.webp') contentType = 'image/webp';

  return new NextResponse(Buffer.from(file), {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000',
    },
  });
}