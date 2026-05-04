import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../../utils/callDynamicPrisma";
import { deleteDynamicFile } from "../../../../../../utils/callDynamicFilesApi";

export const runtime = "nodejs";

/**
 * DELETE imagen de vehículo corporativo: elimina fila en BD y archivo en uploads vía `dynamic-prisma/files`.
 */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string; imageId: string }> }
) {
  try {
    const { valid, expired, message } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json(
        { status: false, expired, message },
        { status: expired ? 401 : 403 }
      );
    }

    const { id, imageId } = await context.params;
    const vehiculoId = parseInt(String(id), 10);
    const imageRowId = parseInt(String(imageId), 10);
    if (!vehiculoId || !imageRowId) {
      return NextResponse.json({ status: false, message: "ID no válido" }, { status: 400 });
    }

    const row = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_imagenes_vehiculos_corporativos",
        operation: "findUnique",
        where: { id: imageRowId },
      },
    });
    if (!row || Number((row as any)?.vehiculo_id) !== vehiculoId) {
      return NextResponse.json({ status: false, message: "Imagen no encontrada" }, { status: 404 });
    }
    const name = String((row as any)?.name || "").trim();
    if (!name) {
      return NextResponse.json({ status: false, message: "Nombre de archivo inválido" }, { status: 400 });
    }

    const relative = `corporate-vehicles/${vehiculoId}/${name}`.replace(/\\/g, "/");
    try {
      await deleteDynamicFile({ req, url: relative, shouldVerifyAccessToken: true });
    } catch (e) {
      console.warn("deleteDynamicFile (corporate-vehicle image):", e);
    }

    await callDynamicPrisma({
      req,
      data: {
        action: "DELETE",
        table: "c_imagenes_vehiculos_corporativos",
        operation: "delete",
        where: { id: imageRowId },
      },
    });

    return NextResponse.json(
      { status: true, message: "Imagen eliminada correctamente", data: { id: imageRowId, vehiculo_id: vehiculoId } },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("DELETE /api/corporate-vehicles/[id]/image/[imageId]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}
