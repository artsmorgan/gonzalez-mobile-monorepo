import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../../utils/callDynamicPrisma";
import { deleteDynamicFile } from "../../../../../../utils/callDynamicFilesApi";
import { reportError } from "../../../../../../utils/reportError";

export const runtime = "nodejs";

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string; archivoId: string }> }
) {
  try {
    const { valid, expired, message } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json(
        { status: false, expired, message },
        { status: expired ? 401 : 403 }
      );
    }

    const resolved = await context.params;
    const activoMantenimientoId = parseInt(String(resolved.id), 10);
    const archivoId = parseInt(String(resolved.archivoId), 10);

    if (!Number.isFinite(activoMantenimientoId) || activoMantenimientoId <= 0 || !Number.isFinite(archivoId) || archivoId <= 0) {
      await reportError(req, "api/articulo-mantenimiento/[id]/archivos/[archivoId]", "DELETE", 400, "Parámetros inválidos");
      return NextResponse.json({ status: false, message: "Parámetros inválidos" }, { status: 400 });
    }

    const fileRow = (await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_archivos_adjuntos_articulo_mantenimiento",
        operation: "findFirst",
        where: { id: archivoId, activo_mantenimiento_id: activoMantenimientoId },
      },
    })) as { id: number; name: string; activo_mantenimiento_id: number } | null;

    if (!fileRow) {
      await reportError(req, "api/articulo-mantenimiento/[id]/archivos/[archivoId]", "DELETE", 404, "Archivo no encontrado");
      return NextResponse.json({ status: false, message: "Archivo no encontrado" }, { status: 404 });
    }

    const storageRelPath = `articulo-mantenimiento/${activoMantenimientoId}/${fileRow.name}`;

    await callDynamicPrisma({
      req,
      data: {
        action: "DELETE",
        table: "c_archivos_adjuntos_articulo_mantenimiento",
        where: { id: archivoId },
      },
    });

    try {
      await deleteDynamicFile({ req, url: storageRelPath, shouldVerifyAccessToken: true });
    } catch (e) {
      console.error("deleteDynamicFile articulo-mantenimiento adjunto (continuando):", e);
    }

    return NextResponse.json(
      { status: true, message: "Archivo eliminado correctamente", data: { id: archivoId } },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("DELETE /api/articulo-mantenimiento/[id]/archivos/[archivoId]:", errorMessage);
    await reportError(req, "api/articulo-mantenimiento/[id]/archivos/[archivoId]", "DELETE", 500, errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}
