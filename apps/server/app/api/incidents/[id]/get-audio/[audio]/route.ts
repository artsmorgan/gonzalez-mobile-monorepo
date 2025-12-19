import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

import { prisma } from '../../../../../../utils/prismaClient';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; audio: string }> }
) {
  try {
    const resolvedParams = await context.params;
    const id = parseInt(resolvedParams.id);
    const audio = resolvedParams.audio;

    if (!id || !audio) {
      return NextResponse.json(
        { status: false, message: 'ID o audio faltante' },
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
      where: { incidente_id: incident.id, name: audio },
    });

    if (!fileRecord) {
      return NextResponse.json(
        { status: false, message: 'Archivo de audio no encontrado' },
        { status: 404 }
      );
    }

    const filePath = path.join(
      process.cwd(),
      'public',
      'uploads',
      'incidents',
      `${incident.id}`,
      audio
    );

    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { status: false, message: 'Audio no encontrado' },
        { status: 404 }
      );
    }

    const file = await fs.promises.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();

    let contentType = 'audio/mpeg';
    if (ext === '.wav') contentType = 'audio/wav';
    if (ext === '.m4a') contentType = 'audio/mp4';
    if (ext === '.ogg') contentType = 'audio/ogg';
    if (ext === '.mp3') contentType = 'audio/mpeg';

    return new NextResponse(Buffer.from(file), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000',
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error in GET /api/incidents/[id]/get-audio/[audio]:', errorMessage);
    return NextResponse.json(
      { status: false, message: errorMessage },
      { status: 500 }
    );
  }
}

