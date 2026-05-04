import { NextRequest, NextResponse } from "next/server";
import { fetchDynamicFile } from "../../../../../../utils/callDynamicFilesApi";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; audio: string }> }
) {
  const resolvedParams = await context.params;
  const id = parseInt(resolvedParams.id, 10);
  const audio = resolvedParams.audio;

  if (!id || !audio) {
    return NextResponse.json(
      { status: false, message: "ID o audio faltante" },
      { status: 400 }
    );
  }

  const fetched = await fetchDynamicFile({
    req,
    type: "audio",
    url: `incidents/${id}/${audio}`,
    download: false,
  });

  return new NextResponse(fetched.buffer, {
    headers: {
      "Content-Type": fetched.headers.contentType,
      "Cache-Control": fetched.headers.cacheControl,
    },
  });
}
