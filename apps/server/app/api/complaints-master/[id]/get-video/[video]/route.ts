import { NextRequest, NextResponse } from "next/server";
import { fetchDynamicFile } from "../../../../../../utils/callDynamicFilesApi";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; video: string }> }
) {
  try {
    const { id, video } = await context.params;
    const complaintId = parseInt(id, 10);
    if (!complaintId) return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });

    const fetched = await fetchDynamicFile({
      req,
      type: "video",
      url: `complaints-master/${complaintId}/${video}`,
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
    console.error("Error in GET /api/complaints-master/[id]/get-video/[video]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}


