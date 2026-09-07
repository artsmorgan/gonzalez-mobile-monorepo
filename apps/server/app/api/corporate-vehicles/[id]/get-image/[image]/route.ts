import { NextRequest, NextResponse } from "next/server";
import { fetchDynamicFile } from "../../../../../../utils/callDynamicFilesApi";
import { reportError } from "../../../../../../utils/reportError";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; image: string }> }
) {
  const { id, image } = await context.params;
  const vehiculoId = parseInt(String(id), 10);
  if (!vehiculoId) {
    await reportError(req, "api/corporate-vehicles/[id]/get-image/[image]", "GET", 400, "ID no especificado");
    return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 400 });
  }

  try {
    const fetched = await fetchDynamicFile({
      req,
      type: "image",
      url: `corporate-vehicles/${vehiculoId}/${image}`,
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
    await reportError(req, "api/corporate-vehicles/[id]/get-image/[image]", "GET", 500, errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}

