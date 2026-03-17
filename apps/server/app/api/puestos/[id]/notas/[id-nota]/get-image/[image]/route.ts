import { NextRequest, NextResponse } from 'next/server';
import { fetchDynamicFile } from '../../../../../../../../utils/callDynamicFilesApi';

export const runtime = 'nodejs';

// Patrón simplificado, igual que job-manuals/[id]/get-image/[image]
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; "id-nota": string; image: string }> }
) {
  const resolvedParams = await context.params;
  const notaId = parseInt(resolvedParams['id-nota'], 10);
  const image = resolvedParams.image;

  if (!notaId || !image) {
    return NextResponse.json(
      { status: false, message: 'ID de nota o imagen faltante' },
      { status: 400 }
    );
  }

  const fetched = await fetchDynamicFile({
    req,
    type: 'image',
    url: `puesto-notas/${notaId}/${image}`,
    download: false,
  });

  return new NextResponse(fetched.buffer, {
    headers: {
      'Content-Type': fetched.headers.contentType,
      'Cache-Control': fetched.headers.cacheControl,
    },
  });
}

