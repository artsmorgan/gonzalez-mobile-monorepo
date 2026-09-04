import { NextRequest, NextResponse } from "next/server";
import { fetchDynamicFile } from "../../../../../../utils/callDynamicFilesApi";
import { reportError } from "../../../../../../utils/reportError";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; video: string }> }
) {
  const resolvedParams = await context.params;
  const id = parseInt(resolvedParams.id, 10);
  const video = resolvedParams.video;

  if (!id || !video) {
    await reportError(req, "api/incidents/[id]/get-video/[video]", "GET", 400, "ID o video faltante");
    return NextResponse.json(
      { status: false, message: "ID o video faltante" },
      { status: 400 }
    );
  }

  try {
    const fetched = await fetchDynamicFile({
      req,
      type: "video",
      url: `incidents/${id}/${video}`,
      download: false,
    });

    return new NextResponse(fetched.buffer, {
      headers: {
        "Content-Type": fetched.headers.contentType,
        "Cache-Control": fetched.headers.cacheControl,
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    await reportError(req, "api/incidents/[id]/get-video/[video]", "GET", 500, errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}
