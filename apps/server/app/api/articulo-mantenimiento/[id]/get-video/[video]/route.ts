import { NextRequest, NextResponse } from "next/server";
import { fetchDynamicFile } from "../../../../../../utils/callDynamicFilesApi";
import { callDynamicPrisma } from "../../../../../../utils/callDynamicPrisma";
import { verifyAccessTokenByApi } from "../../../../../../utils/verifyAccessTokenByApi";
import { reportError } from "../../../../../../utils/reportError";

export const runtime = "nodejs";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string; video: string }> }) {
  const { valid, expired, message } = await verifyAccessTokenByApi(req);
  if (!valid) {
    return NextResponse.json(
      { status: false, expired, message },
      { status: expired ? 401 : 403 }
    );
  }

  const resolvedParams = await context.params;
  const id = parseInt(resolvedParams.id);
  const video = resolvedParams.video;

  if (!id || !video) {
    await reportError(req, "api/articulo-mantenimiento/[id]/get-video/[video]", "GET", 400, "ID o video faltante");
    return NextResponse.json({ status: false, message: "ID o video faltante" }, { status: 400 });
  }

  const authHeader = req.headers.get("authorization") || "";
  const tokenForPrisma =
    String(req.nextUrl.searchParams.get("token") || "").trim() ||
    (authHeader.startsWith("Bearer ") ? (authHeader.split(" ")[1] || "").trim() : "");

  try {
    const mantenimiento = await callDynamicPrisma({
      req,
      token: tokenForPrisma,
      data: { action: "GET", table: "c_articulo_mantenimiento", operation: "findUnique", where: { id } }
    });
    if (!mantenimiento) {
      await reportError(req, "api/articulo-mantenimiento/[id]/get-video/[video]", "GET", 404, "Mantenimiento no encontrado");
      return NextResponse.json({ status: false, message: "Mantenimiento no encontrado" }, { status: 404 });
    }

    const fileRecord = await callDynamicPrisma({
      req,
      token: tokenForPrisma,
      data: { action: "GET", table: "c_archivos_adjuntos_articulo_mantenimiento", operation: "findFirst", where: { activo_mantenimiento_id: mantenimiento.id, name: video } }
    });

    if (!fileRecord) {
      await reportError(req, "api/articulo-mantenimiento/[id]/get-video/[video]", "GET", 404, "Archivo no encontrado");
      return NextResponse.json({ status: false, message: "Archivo no encontrado" }, { status: 404 });
    }

    const fetched = await fetchDynamicFile({
      req,
      type: "video",
      url: `articulo-mantenimiento/${mantenimiento.id}/${video}`,
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
    await reportError(req, "api/articulo-mantenimiento/[id]/get-video/[video]", "GET", 400, errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}

