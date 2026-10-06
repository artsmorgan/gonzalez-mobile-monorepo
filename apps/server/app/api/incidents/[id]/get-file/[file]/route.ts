import { NextRequest, NextResponse } from "next/server";
import { fetchDynamicFile } from "../../../../../../utils/callDynamicFilesApi";
import { reportError } from "../../../../../../utils/reportError";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; file: string }> }
) {
  const resolvedParams = await context.params;
  const id = parseInt(resolvedParams.id, 10);
  const fileName = resolvedParams.file;

  if (!id || !fileName) {
    await reportError(req, "api/incidents/[id]/get-file/[file]", "GET", 400, "ID o archivo faltante");
    return NextResponse.json(
      { status: false, message: "ID o archivo faltante" },
      { status: 400 }
    );
  }

  try {
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
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    await reportError(req, "api/incidents/[id]/get-file/[file]", "GET", 500, errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}
