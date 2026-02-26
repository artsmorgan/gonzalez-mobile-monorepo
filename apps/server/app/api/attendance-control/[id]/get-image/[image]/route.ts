import { NextRequest, NextResponse } from "next/server";
import { fetchDynamicFile } from "../../../../../../utils/callDynamicFilesApi";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; image: string }> }
) {
  const resolvedParams = await context.params;
  const id = parseInt(resolvedParams.id, 10);
  const image = resolvedParams.image;

  if (!id || !image) {
    return NextResponse.json(
      { status: false, message: "ID o imagen faltante" },
      { status: 400 }
    );
  }

  const fetched = await fetchDynamicFile({
    req,
    type: "image",
    url: `attendance-control/${id}/${image}`,
    download: false,
  });

  return new NextResponse(fetched.buffer, {
    headers: {
      "Content-Type": fetched.headers.contentType,
      "Cache-Control": fetched.headers.cacheControl,
    },
  });
}

