import { NextRequest, NextResponse } from "next/server";
import { fetchDynamicFile } from "../../../../../../utils/callDynamicFilesApi";
import { reportError } from "../../../../../../utils/reportError";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; image: string }> }
) {
  try {
    const { id, image } = await context.params;
    const pncId = parseInt(String(id), 10);
    if (!pncId) {
      await reportError(req, "api/non-conforming-product/[id]/get-image/[image]", "GET", 400, "ID no especificado");
      return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 400 });
    }

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
    await reportError(req, "api/non-conforming-product/[id]/get-image/[image]", "GET", 500, errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}


