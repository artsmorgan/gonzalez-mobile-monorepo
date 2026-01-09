import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

import { prisma } from '../../../../../../../../utils/prismaClient';

const CONTENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
  csv: 'text/csv',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
};

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; visualizationId: string; file: string }> }
) {
  const resolvedParams = await context.params;
  const manualId = parseInt(resolvedParams.id, 10);
  const visualizationId = parseInt(resolvedParams.visualizationId, 10);
  const fileName = resolvedParams.file;

  if (!manualId || !visualizationId || !fileName) {
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
    where: { visualizacion_id: visualizationId, name: fileName },
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
    fileName
  );

  if (!fs.existsSync(filePath)) {
    return NextResponse.json(
      { status: false, message: 'Archivo físico no encontrado' },
      { status: 404 }
    );
  }

  const fileBuffer = await fs.promises.readFile(filePath);
  const ext = path.extname(filePath).toLowerCase().replace('.', '');
  const contentType = CONTENT_TYPES[ext] || 'application/octet-stream';

  const downloadName = fileRecord.original_name || path.basename(filePath);

  return new NextResponse(Buffer.from(fileBuffer), {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(downloadName)}"`,
      'Cache-Control': 'public, max-age=31536000',
    },
  });
}


