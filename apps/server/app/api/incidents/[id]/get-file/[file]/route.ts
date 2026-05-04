import { NextRequest, NextResponse } from "next/server";
import { fetchDynamicFile } from "../../../../../../utils/callDynamicFilesApi";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; file: string }> }
) {
  const resolvedParams = await context.params;
  const id = parseInt(resolvedParams.id, 10);
  const fileName = resolvedParams.file;

  if (!id || !fileName) {
    return NextResponse.json(
      { status: false, message: "ID o archivo faltante" },
      { status: 400 }
    );
  }

  const fetched = await fetchDynamicFile({
    req,
    type: "file",
    url: `incidents/${id}/${fileName}`,
    download: true,
  });

  return new NextResponse(fetched.buffer, {
    headers: {
      "Content-Type": fetched.headers.contentType,
      ...(fetched.headers.contentDisposition
        ? { "Content-Disposition": fetched.headers.contentDisposition }
        : {}),
      "Cache-Control": fetched.headers.cacheControl,
    },
  });
}
