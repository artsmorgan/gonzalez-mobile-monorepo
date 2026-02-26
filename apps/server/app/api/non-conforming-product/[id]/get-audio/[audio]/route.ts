import { NextRequest, NextResponse } from "next/server";
import { fetchDynamicFile } from "../../../../../../utils/callDynamicFilesApi";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; audio: string }> }
) {
  try {
    const { id, audio } = await context.params;
    const pncId = parseInt(String(id), 10);
    if (!pncId) return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });

    const fetched = await fetchDynamicFile({
      req,
      type: "audio",
      url: `non-conforming-product/${pncId}/${audio}`,
      download: false,
    });

    return new NextResponse(fetched.buffer, {
      headers: {
        "Content-Type": fetched.headers.contentType,
        ...(fetched.headers.contentDisposition ? { "Content-Disposition": fetched.headers.contentDisposition } : {}),
        "Cache-Control": fetched.headers.cacheControl,
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in GET /api/non-conforming-product/[id]/get-audio/[audio]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}


