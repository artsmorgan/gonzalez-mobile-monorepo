import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

import { fetchDynamicFile } from '../../../../../../../../utils/callDynamicFilesApi';
import { verifyAccessTokenByApi } from '../../../../../../../../utils/verifyAccessTokenByApi';
import { reportError } from '../../../../../../../../utils/reportError';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; visualizationId: string; audio: string }> }
) {
  const resolvedParams = await context.params;
  const manualId = parseInt(resolvedParams.id, 10);
  const visualizationId = parseInt(resolvedParams.visualizationId, 10);
  const audio = resolvedParams.audio;


  if (!manualId || !visualizationId || !audio) {
    await reportError(req, "api/job-manuals/[id]/visualizations/[visualizationId]/get-audio/[audio]", "GET", 400, "Parámetros inválidos");
    return NextResponse.json(
      { status: false, message: 'Parámetros inválidos' },
      { status: 400 }
    );
  }

  try {
    const fetched = await fetchDynamicFile({
      req,
      type: 'audio',
      url: `job-manuals/${manualId}/visualizaciones/${visualizationId}/${audio}`,
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
    await reportError(req, "api/job-manuals/[id]/visualizations/[visualizationId]/get-audio/[audio]", "GET", 500, errorMessage);
    return NextResponse.json(
      { status: false, message: errorMessage },
      { status: 500 }
    );
  }
}
