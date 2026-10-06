import { NextRequest, NextResponse } from "next/server";
import { Readable } from "stream";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { fetchDynamicFileStream } from "../../../../utils/callDynamicFilesApi";

export const runtime = "nodejs";

const APP_VERSIONS_FOLDER = "app-versions";

/**
 * El instalador de cada versión se sube manualmente a `/app-versions` como `MonitoreApp-{version}.apk`.
 * Se usa la variante en streaming (`fetchDynamicFileStream`) en vez de bufferear el archivo completo:
 * con un .apk de decenas/cientos de MB, el buffer completo agrega suficiente latencia como para que el
 * cliente móvil agote su timeout de red esperando el primer byte.
 */
export async function GET(req: NextRequest, context: { params: Promise<{ version: string }> }) {
  try {
    const { valid, expired, message } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json({ status: false, expired, message }, { status: expired ? 401 : 403 });
    }

    const { version } = await context.params;
    const versionTrim = String(version || "").trim();
    if (!versionTrim) {
      return NextResponse.json({ status: false, message: "Versión no especificada" }, { status: 400 });
    }

    const fileName = `MonitoreApp-${versionTrim}.apk`;

    const fetched = await fetchDynamicFileStream({
      req,
      type: "file",
      url: `${APP_VERSIONS_FOLDER}/${fileName}`,
      download: true,
    });

    const headers: Record<string, string> = {
      "Content-Type": fetched.headers.contentType,
      "Content-Disposition":
        fetched.headers.contentDisposition || `attachment; filename="${encodeURIComponent(fileName)}"`,
      "Cache-Control": "no-store",
    };
    if (fetched.headers.contentLength) {
      headers["Content-Length"] = fetched.headers.contentLength;
    }

    return new NextResponse(Readable.toWeb(fetched.stream as Readable) as ReadableStream<Uint8Array>, {
      headers,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in GET /api/mobile-versions/[version]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}
