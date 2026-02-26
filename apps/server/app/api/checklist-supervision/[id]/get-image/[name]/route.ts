import { NextRequest, NextResponse } from "next/server";
import { fetchDynamicFile } from "../../../../../../utils/callDynamicFilesApi";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; name: string }> }
) {
  const { id, name } = await context.params;
  const checklistId = parseInt(String(id), 10);
  if (!checklistId) {
    return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });
  }

  const fetched = await fetchDynamicFile({
    req,
    type: "image",
    url: `checklist-supervision/${checklistId}/${name}`,
    download: false,
  });

  return new NextResponse(fetched.buffer, {
    headers: {
      "Content-Type": fetched.headers.contentType,
      "Cache-Control": fetched.headers.cacheControl,
    },
  });
}

