import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

import { fetchDynamicFile } from '../../../../../../../../utils/callDynamicFilesApi';
import { verifyAccessTokenByApi } from '../../../../../../../../utils/verifyAccessTokenByApi';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; visualizationId: string; image: string }> }
) {
  const resolvedParams = await context.params;
  const manualId = parseInt(resolvedParams.id, 10);
  const visualizationId = parseInt(resolvedParams.visualizationId, 10);
  const image = resolvedParams.image;

  if (!manualId || !visualizationId || !image) {
    return NextResponse.json(
      { status: false, message: 'Parámetros inválidos' },
      { status: 400 }
    );
  }

  const fetched = await fetchDynamicFile({
    req,
    type: 'image',
    url: `job-manuals/${manualId}/visualizaciones/${visualizationId}/${image}`,
    download: false,
  });

  return new NextResponse(fetched.buffer, {
    headers: {
      'Content-Type': fetched.headers.contentType,
      'Cache-Control': fetched.headers.cacheControl,
    },
  });
}


