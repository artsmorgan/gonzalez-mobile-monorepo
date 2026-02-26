import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

import { fetchDynamicFile } from '../../../../../../utils/callDynamicFilesApi';
import { verifyAccessTokenByApi } from '../../../../../../utils/verifyAccessTokenByApi';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; video: string }> }
) {
  const resolvedParams = await context.params;
  const id = parseInt(resolvedParams.id);
  const video = resolvedParams.video;

  if (!id || !video) {
    return NextResponse.json(
      { status: false, message: 'ID o video faltante' },
      { status: 400 }
    );
  }

  const fetched = await fetchDynamicFile({
    req,
    type: 'video',
    url: `job-manuals/${id}/${video}`,
    download: false,
  });

  return new NextResponse(fetched.buffer, {
    headers: {
      'Content-Type': fetched.headers.contentType,
      'Cache-Control': fetched.headers.cacheControl,
    },
  });
}