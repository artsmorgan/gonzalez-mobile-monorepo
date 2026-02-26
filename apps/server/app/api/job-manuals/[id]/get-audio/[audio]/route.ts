import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

import { fetchDynamicFile } from '../../../../../../utils/callDynamicFilesApi';
import { verifyAccessTokenByApi } from '../../../../../../utils/verifyAccessTokenByApi';

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

  const fetched = await fetchDynamicFile({
    req,
    type: 'audio',
    url: `job-manuals/${id}/${audio}`,
    download: false,
  });

  return new NextResponse(fetched.buffer, {
    headers: {
      'Content-Type': fetched.headers.contentType,
      'Cache-Control': fetched.headers.cacheControl,
    },
  });
}