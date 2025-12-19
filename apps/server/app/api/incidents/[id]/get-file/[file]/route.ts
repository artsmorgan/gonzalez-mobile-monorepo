import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

import { prisma } from '../../../../../../utils/prismaClient';

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
  context: { params: Promise<{ id: string; file: string }> }
) {
  try {
    const resolvedParams = await context.params;
    const incidentId = parseInt(resolvedParams.id, 10);
    const fileName = resolvedParams.file;

    if (!incidentId || !fileName) {
      return NextResponse.json(
        { status: false, message: 'ID o archivo faltante' },
        { status: 400 }
      );
    }

    const incident = await prisma.c_incidente.findUnique({ where: { id: incidentId } });
    if (!incident) {
      return NextResponse.json(
        { status: false, message: 'Incidente no encontrado' },
        { status: 404 }
      );
    }

    const fileRecord = await prisma.c_archivos_incidente.findFirst({
      where: { incidente_id: incident.id, name: fileName },
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
      'incidents',
      `${incident.id}`,
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
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error in GET /api/incidents/[id]/get-file/[file]:', errorMessage);
    return NextResponse.json(
      { status: false, message: errorMessage },
      { status: 500 }
    );
  }
}

