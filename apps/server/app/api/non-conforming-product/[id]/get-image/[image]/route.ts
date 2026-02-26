import { NextRequest, NextResponse } from "next/server";
import { fetchDynamicFile } from "../../../../../../utils/callDynamicFilesApi";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; image: string }> }
) {
  try {
    const { id, image } = await context.params;
    const pncId = parseInt(String(id), 10);
    if (!pncId) return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });

    const fetched = await fetchDynamicFile({
      req,
      type: "image",
      url: `non-conforming-product/${pncId}/${image}`,
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
    console.error("Error in GET /api/non-conforming-product/[id]/get-image/[image]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}


