import { NextRequest, NextResponse } from "next/server";
import { reportError } from "../../../../../../utils/reportError";
export const runtime = "nodejs";
import { fetchDynamicFile } from "../../../../../../utils/callDynamicFilesApi";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; image: string }> }
) {
  const resolvedParams = await context.params;
  const id = parseInt(resolvedParams.id, 10);
  const image = resolvedParams.image;

  if (!id || !image) {
    await reportError(req, "api/attendance-control/[id]/get-image/[image]", "GET", 400, "ID o imagen faltante");
    return NextResponse.json(
      { status: false, message: "ID o imagen faltante" },
      { status: 400 }
    );
  }

  try {
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
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    await reportError(req, "api/attendance-control/[id]/get-image/[image]", "GET", 400, errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}
