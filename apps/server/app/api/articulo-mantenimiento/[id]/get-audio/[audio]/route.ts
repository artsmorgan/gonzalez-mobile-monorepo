import { NextRequest, NextResponse } from "next/server";
import { fetchDynamicFile } from "../../../../../../utils/callDynamicFilesApi";
import { callDynamicPrisma } from "../../../../../../utils/callDynamicPrisma";


export const runtime = "nodejs";


export async function GET(req: NextRequest, context: { params: Promise<{ id: string; audio: string }> }) {
  const resolvedParams = await context.params;
  const id = parseInt(resolvedParams.id);
  const audio = resolvedParams.audio;

  if (!id || !audio) return NextResponse.json({ status: false, message: "ID o audio faltante" }, { status: 400 });

  const mantenimiento = await callDynamicPrisma({
    req,
    data: { action: "GET", table: "c_articulo_mantenimiento", operation: "findUnique", where: { id } }
  });
  if (!mantenimiento) return NextResponse.json({ status: false, message: "Mantenimiento no encontrado" }, { status: 404 });

  const fileRecord = await callDynamicPrisma({
    req,
    data: { action: "GET", table: "c_archivos_adjuntos_articulo_mantenimiento", operation: "findFirst", where: { activo_mantenimiento_id: mantenimiento.id, name: audio } }
  });
  
  if (!fileRecord) return NextResponse.json({ status: false, message: "Archivo no encontrado" }, { status: 404 });

  const fetched = await fetchDynamicFile({
    req,
    type: "audio",
    url: `articulo-mantenimiento/${mantenimiento.id}/${audio}`,
    download: false,
  });

  return new NextResponse(fetched.buffer, {
    headers: {
      "Content-Type": fetched.headers.contentType,
      "Cache-Control": fetched.headers.cacheControl,
    },
  });
}


