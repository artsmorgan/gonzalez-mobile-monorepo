import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

import { prisma } from '../../../../../../../../utils/prismaClient';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; visualizationId: string; video: string }> }
) {
  const resolvedParams = await context.params;
  const manualId = parseInt(resolvedParams.id, 10);
  const visualizationId = parseInt(resolvedParams.visualizationId, 10);
  const video = resolvedParams.video;

  if (!manualId || !visualizationId || !video) {
    return NextResponse.json(
      { status: false, message: 'Parámetros inválidos' },
      { status: 400 }
    );
  }

  const manual = await prisma.e_manual_puesto.findUnique({ where: { id: manualId } });
  if (!manual) {
    return NextResponse.json(
      { status: false, message: 'Manual no encontrado' },
      { status: 404 }
    );
  }

  const vis = await prisma.e_empleado_visualizacion_manual_puesto.findUnique({
    where: { id: visualizationId },
  });
  if (!vis || vis.manual_puesto_id !== manual.id) {
    return NextResponse.json(
      { status: false, message: 'Visualización no encontrada' },
      { status: 404 }
    );
  }

  const fileRecord = await prisma.e_empleado_visualizacion_archivos.findFirst({
    where: { visualizacion_id: visualizationId, name: video },
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
    'visualizaciones',
    `${visualizationId}`,
    video
  );

  if (!fs.existsSync(filePath)) {
    return NextResponse.json(
      { status: false, message: 'Video no encontrado' },
      { status: 404 }
    );
  }

  const fileBuffer = await fs.promises.readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();

  let contentType = 'application/octet-stream';
  if (ext === '.mp4') contentType = 'video/mp4';
  if (ext === '.webm') contentType = 'video/webm';
  if (ext === '.mov') contentType = 'video/quicktime';

  return new NextResponse(Buffer.from(fileBuffer), {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000',
    },
  });
}


