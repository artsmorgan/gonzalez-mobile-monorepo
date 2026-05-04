import { NextRequest, NextResponse } from "next/server";
import { fetchDynamicFile } from "../../../../../../utils/callDynamicFilesApi";
import { callDynamicPrisma } from "../../../../../../utils/callDynamicPrisma";
import { verifyAccessTokenByApi } from "../../../../../../utils/verifyAccessTokenByApi";

export const runtime = "nodejs";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string; image: string }> }) {
  const { valid, expired, message } = await verifyAccessTokenByApi(req);
  if (!valid) {
    return NextResponse.json(
      { status: false, expired, message },
      { status: expired ? 401 : 403 }
    );
  }

  const resolvedParams = await context.params;
  const id = parseInt(resolvedParams.id);
  const image = resolvedParams.image;

  if (!id || !image) return NextResponse.json({ status: false, message: "ID o imagen faltante" }, { status: 400 });

  const authHeader = req.headers.get("authorization") || "";
  const tokenForPrisma =
    String(req.nextUrl.searchParams.get("token") || "").trim() ||
    (authHeader.startsWith("Bearer ") ? (authHeader.split(" ")[1] || "").trim() : "");

  const mantenimiento = await callDynamicPrisma({
    req,
    token: tokenForPrisma,
    data: { action: "GET", table: "c_articulo_mantenimiento", operation: "findUnique", where: { id } }
  });
  if (!mantenimiento) return NextResponse.json({ status: false, message: "Mantenimiento no encontrado" }, { status: 404 });

  const fileRecord = await callDynamicPrisma({
    req,
    token: tokenForPrisma,
    data: { action: "GET", table: "c_archivos_adjuntos_articulo_mantenimiento", operation: "findFirst", where: { activo_mantenimiento_id: mantenimiento.id, name: image } }
  });
  
  if (!fileRecord) return NextResponse.json({ status: false, message: "Archivo no encontrado" }, { status: 404 });

  const fetched = await fetchDynamicFile({
    req,
    type: "image",
    url: `articulo-mantenimiento/${mantenimiento.id}/${image}`,
    download: false,
  });

  return new NextResponse(fetched.buffer, {
    headers: {
      "Content-Type": fetched.headers.contentType,
      "Cache-Control": fetched.headers.cacheControl,
    },
  });
}


