import { NextRequest, NextResponse } from 'next/server';
import { fetchDynamicFile } from '../../../../../../../../utils/callDynamicFilesApi';
import { reportError } from '../../../../../../../../utils/reportError';

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
    await reportError(req, "api/puestos/[id]/notas/[id-nota]/get-image/[image]", "GET", 400, 'ID de nota o imagen faltante');
    return NextResponse.json(
      { status: false, message: 'ID de nota o imagen faltante' },
      { status: 400 }
    );
  }

  try {
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
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    await reportError(req, "api/puestos/[id]/notas/[id-nota]/get-image/[image]", "GET", 500, errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}

