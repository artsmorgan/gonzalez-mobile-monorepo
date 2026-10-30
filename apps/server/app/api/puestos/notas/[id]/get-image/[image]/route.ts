import { NextRequest, NextResponse } from "next/server";
import { fetchDynamicFile } from "../../../../../../../utils/callDynamicFilesApi";
import { callDynamicPrisma } from "../../../../../../../utils/callDynamicPrisma";
import { verifyAccessTokenByApi } from "../../../../../../../utils/verifyAccessTokenByApi";
import { reportError } from "../../../../../../../utils/reportError";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; image: string }> }
) {
  try {
    const { valid, expired, message } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json({ status: false, expired, message }, { status: expired ? 401 : 403 });
    }

    const resolvedParams = await context.params;
    const id = parseInt(resolvedParams.id, 10);
    const image = resolvedParams.image;

    if (!id || !image) {
      await reportError(req, "api/puestos/notas/[id]/get-image/[image]", "GET", 400, "ID o imagen faltante");
      return NextResponse.json({ status: false, message: "ID o imagen faltante" }, { status: 400 });
    }

    const note = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_puesto_notas",
        operation: "findUnique",
        where: { id },
      },
    });
    if (!note) {
      await reportError(req, "api/puestos/notas/[id]/get-image/[image]", "GET", 404, "Nota no encontrada");
      return NextResponse.json({ status: false, message: "Nota no encontrada" }, { status: 404 });
    }

    const fileRecord = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_imagenes_puesto_notas",
        operation: "findFirst",
        where: { nota_id: id, name: image },
      },
    });
    if (!fileRecord) {
      await reportError(req, "api/puestos/notas/[id]/get-image/[image]", "GET", 404, "Archivo no encontrado");
      return NextResponse.json({ status: false, message: "Archivo no encontrado" }, { status: 404 });
    }

    const fetched = await fetchDynamicFile({
      req,
      type: "image",
      url: `puesto-notas/${id}/${image}`,
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
    await reportError(req, "api/puestos/notas/[id]/get-image/[image]", "GET", 500, errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}
