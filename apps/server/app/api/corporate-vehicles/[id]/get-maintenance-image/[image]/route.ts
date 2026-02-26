import { NextRequest, NextResponse } from "next/server";
import { fetchDynamicFile } from "../../../../../../utils/callDynamicFilesApi";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; image: string }> }
) {
  const { id, image } = await context.params;
  const vehiculoId = parseInt(String(id), 10);
  if (!vehiculoId) {
    return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });
  }

  const fetched = await fetchDynamicFile({
    req,
    type: "image",
    url: `corporate-vehicles/${vehiculoId}/maintenances/${image}`,
    download: false,
  });

  return new NextResponse(fetched.buffer, {
    headers: {
      "Content-Type": fetched.headers.contentType,
      "Cache-Control": fetched.headers.cacheControl,
    },
  });
}

