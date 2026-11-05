import { NextRequest, NextResponse } from "next/server";
import { Readable } from "stream";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { fetchDynamicFileStream } from "../../../../utils/callDynamicFilesApi";
import { apkFileCandidates } from "../../../../utils/apkFiles";

export const runtime = "nodejs";

const APP_VERSIONS_FOLDER = "app-versions";

/**
 * El instalador de cada versión se sube manualmente a `/app-versions` como `MonitoreApp-{version}-{abi}.apk` (uno por arquitectura, issue #179)
 * y, opcionalmente, `MonitoreApp-{version}.apk` (universal, usado cuando no hay uno para la arquitectura del equipo).
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
    // `?abi=` es la arquitectura del equipo (issue #179): se prueba primero el APK de esa arquitectura y, si no se subió, el universal.
    const candidates = apkFileCandidates(version, req.nextUrl.searchParams.get("abi"));
    if (!candidates) {
      return NextResponse.json({ status: false, message: "Versión no válida" }, { status: 400 });
    }

    let fileName = candidates[0]!;
    let fetched: Awaited<ReturnType<typeof fetchDynamicFileStream>> | null = null;
    let lastError: unknown = null;
    for (const candidate of candidates) {
      try {
        fetched = await fetchDynamicFileStream({
          req,
          type: "file",
          url: `${APP_VERSIONS_FOLDER}/${candidate}`,
          download: true,
        });
        fileName = candidate;
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (!fetched) throw lastError instanceof Error ? lastError : new Error("No se encontró el instalador");

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
