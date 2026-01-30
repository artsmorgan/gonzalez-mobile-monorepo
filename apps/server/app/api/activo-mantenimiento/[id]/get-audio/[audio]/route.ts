import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

import { prisma } from '../../../../../../utils/prismaClient';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; audio: string }> }
) {
  const resolvedParams = await context.params;
  const id = parseInt(resolvedParams.id);
  const audio = resolvedParams.audio;

  if (!id || !audio) {
    return NextResponse.json(
      { status: false, message: 'ID o audio faltante' },
      { status: 400 }
    );
  }

  const activo = await prisma.c_activo_mantenimiento.findUnique({ where: { id } });
  if (!activo) {
    return NextResponse.json(
      { status: false, message: 'Activo no encontrado' },
      { status: 404 }
    );
  }

  const fileRecord = await prisma.c_archivos_adjuntos_archivo_mantenimiento.findFirst({
    where: { activo_mantenimiento_id: activo.id, name: audio },
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
    'activo-mantenimiento',
    `${activo.id}`,
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

  let contentType = 'application/octet-stream';
  if (ext === '.mp3') contentType = 'audio/mpeg';
  if (ext === '.wav') contentType = 'audio/wav';
  if (ext === '.m4a') contentType = 'audio/mp4';

  return new NextResponse(Buffer.from(file), {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000',
    },
  });
}

