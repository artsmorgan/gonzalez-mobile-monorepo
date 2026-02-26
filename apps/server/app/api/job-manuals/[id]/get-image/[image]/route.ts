import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

import { fetchDynamicFile } from '../../../../../../utils/callDynamicFilesApi';
import { verifyAccessTokenByApi } from '../../../../../../utils/verifyAccessTokenByApi';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; image: string }> }
) {
  const resolvedParams = await context.params;
  const id = parseInt(resolvedParams.id);
  const image = resolvedParams.image;

  if (!id || !image) {
    return NextResponse.json(
      { status: false, message: 'ID o imagen faltante' },
      { status: 400 }
    );
  }

  const fetched = await fetchDynamicFile({
    req,
    type: 'image',
    url: `job-manuals/${id}/${image}`,
    download: false,
  });

  return new NextResponse(fetched.buffer, {
    headers: {
      'Content-Type': fetched.headers.contentType,
      'Cache-Control': fetched.headers.cacheControl,
    },
  });
}