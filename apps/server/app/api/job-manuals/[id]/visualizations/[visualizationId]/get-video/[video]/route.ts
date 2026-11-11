import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

import { fetchDynamicFile } from '../../../../../../../../utils/callDynamicFilesApi';
import { verifyAccessTokenByApi } from '../../../../../../../../utils/verifyAccessTokenByApi';
import { reportError } from '../../../../../../../../utils/reportError';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; visualizationId: string; video: string }> }
) {
  const resolvedParams = await context.params;
  const manualId = parseInt(resolvedParams.id, 10);
  const visualizationId = parseInt(resolvedParams.visualizationId, 10);
  const video = resolvedParams.video;


  if (!manualId || !visualizationId || !video) {
    await reportError(req, "api/job-manuals/[id]/visualizations/[visualizationId]/get-video/[video]", "GET", 400, "Parámetros inválidos");
    return NextResponse.json(
      { status: false, message: 'Parámetros inválidos' },
      { status: 400 }
    );
  }

  try {
    const fetched = await fetchDynamicFile({
      req,
      type: 'video',
      url: `job-manuals/${manualId}/visualizaciones/${visualizationId}/${video}`,
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
    await reportError(req, "api/job-manuals/[id]/visualizations/[visualizationId]/get-video/[video]", "GET", 500, errorMessage);
    return NextResponse.json(
      { status: false, message: errorMessage },
      { status: 500 }
    );
  }
}
