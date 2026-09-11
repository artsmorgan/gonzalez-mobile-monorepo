import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

import { fetchDynamicFile } from '../../../../../../../../utils/callDynamicFilesApi';
import { verifyAccessTokenByApi } from '../../../../../../../../utils/verifyAccessTokenByApi';
import { reportError } from '../../../../../../../../utils/reportError';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; visualizationId: string; file: string }> }
) {
  const resolvedParams = await context.params;
  const manualId = parseInt(resolvedParams.id, 10);
  const visualizationId = parseInt(resolvedParams.visualizationId, 10);
  const fileName = resolvedParams.file;

  if (!manualId || !visualizationId || !fileName) {
    await reportError(req, "api/job-manuals/[id]/visualizations/[visualizationId]/get-file/[file]", "GET", 400, "Parámetros inválidos");
    return NextResponse.json(
      { status: false, message: 'Parámetros inválidos' },
      { status: 400 }
    );
  }

  try {
    const fetched = await fetchDynamicFile({
      req,
      type: 'file',
      url: `job-manuals/${manualId}/visualizaciones/${visualizationId}/${fileName}`,
      download: true,
    });

    return new NextResponse(fetched.buffer, {
      headers: {
        'Content-Type': fetched.headers.contentType,
        'Content-Disposition': fetched.headers.contentDisposition,
        'Cache-Control': fetched.headers.cacheControl,
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    await reportError(req, "api/job-manuals/[id]/visualizations/[visualizationId]/get-file/[file]", "GET", 500, errorMessage);
    return NextResponse.json(
      { status: false, message: errorMessage },
      { status: 500 }
    );
  }
}
