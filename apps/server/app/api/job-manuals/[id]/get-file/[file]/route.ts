import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

import { fetchDynamicFile } from '../../../../../../utils/callDynamicFilesApi';
import { verifyAccessTokenByApi } from '../../../../../../utils/verifyAccessTokenByApi';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; file: string }> }
) {
  const resolvedParams = await context.params;
  const manualId = parseInt(resolvedParams.id, 10);
  const fileName = resolvedParams.file;

  if (!manualId || !fileName) {
    return NextResponse.json(
      { status: false, message: 'ID o archivo faltante' },
      { status: 400 }
    );
  }

  const fetched = await fetchDynamicFile({
    req,
    type: 'file',
    url: `job-manuals/${manualId}/${fileName}`,
    download: true,
  });

  return new NextResponse(fetched.buffer, {
    headers: {
      'Content-Type': fetched.headers.contentType,
      'Content-Disposition': fetched.headers.contentDisposition,
      'Cache-Control': fetched.headers.cacheControl,
    },
  });
}

