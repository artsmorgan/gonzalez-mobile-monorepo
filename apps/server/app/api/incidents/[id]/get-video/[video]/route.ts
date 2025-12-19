import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

import { prisma } from '../../../../../../utils/prismaClient';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; video: string }> }
) {
  try {
    const resolvedParams = await context.params;
    const id = parseInt(resolvedParams.id);
    const video = resolvedParams.video;

    if (!id || !video) {
      return NextResponse.json(
        { status: false, message: 'ID o video faltante' },
        { status: 400 }
      );
    }

    const incident = await prisma.c_incidente.findUnique({ where: { id } });
    if (!incident) {
      return NextResponse.json(
        { status: false, message: 'Incidente no encontrado' },
        { status: 404 }
      );
    }

    const fileRecord = await prisma.c_archivos_incidente.findFirst({
      where: { incidente_id: incident.id, name: video },
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
      'incidents',
      `${incident.id}`,
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
    if (ext === '.avi') contentType = 'video/x-msvideo';

    return new NextResponse(Buffer.from(file), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000',
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error in GET /api/incidents/[id]/get-video/[video]:', errorMessage);
    return NextResponse.json(
      { status: false, message: errorMessage },
      { status: 500 }
    );
  }
}

