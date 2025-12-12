import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

import { prisma } from '../../../../../../utils/prismaClient';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; video: string }> }
) {
  const resolvedParams = await context.params;
  const id = parseInt(resolvedParams.id);
  const video = resolvedParams.video;

  if (!id || !video) {
    return NextResponse.json(
      { status: false, message: 'ID o video faltante' },
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
    where: { manual_puesto_id: manual.id, name: video },
  });

  if (!fileRecord) {
    return NextResponse.json(
      { status: false, message: 'Archivo de video no encontrado' },
      { status: 404 }
    );
  }

  const filePath = path.join(
    process.cwd(),
    'public',
    'uploads',
    'job-manuals',
    `${manual.id}`,
    video
  );

  if (!fs.existsSync(filePath)) {
    return NextResponse.json(
      { status: false, message: 'Video no encontrado' },
      { status: 404 }
    );
  }

  const file = await fs.promises.readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();

  let contentType = 'video/mp4';
  if (ext === '.webm') contentType = 'video/webm';
  if (ext === '.mov') contentType = 'video/quicktime';

  return new NextResponse(Buffer.from(file), {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000',
    },
  });
}