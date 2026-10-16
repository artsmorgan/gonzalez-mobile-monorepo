import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../../utils/callDynamicPrisma";
import { deleteDynamicFile } from "../../../../../../utils/callDynamicFilesApi";
import { reportError } from "../../../../../../utils/reportError";

export const runtime = "nodejs";

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string; imageId: string }> }
) {
  try {
    const { valid, expired, message } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json({ status: false, expired, message }, { status: expired ? 401 : 403 });
    }

    const resolved = await context.params;
    const actaId = parseInt(String(resolved.id), 10);
    const imageId = parseInt(String(resolved.imageId), 10);
    if (!actaId || !imageId) {
      await reportError(req, "api/acta-entrega-productos/[id]/image/[imageId]", "DELETE", 400, "ID inválido");
      return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });
    }

    const imageRow = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_imagenes_acta_entrega_producto",
        operation: "findFirst",
        where: { id: imageId, acta_id: actaId },
      },
    });
    if (!imageRow) {
      await reportError(req, "api/acta-entrega-productos/[id]/image/[imageId]", "DELETE", 404, "Imagen no encontrada");
      return NextResponse.json({ status: false, message: "Imagen no encontrada" }, { status: 404 });
    }

    await callDynamicPrisma({
      req,
      data: {
        action: "DELETE",
        table: "c_imagenes_acta_entrega_producto",
        operation: "delete",
        where: { id: imageId, acta_id: actaId },
      },
    });

    const img = imageRow as { name?: string };
    const name = String(img?.name || "").trim();
    if (name) {
      try {
        await deleteDynamicFile({ req, url: `acta-entrega-productos/${actaId}/${name}` });
      } catch (e) {
        console.error("deleteDynamicFile acta-entrega (continuando):", e);
      }
    }

    return NextResponse.json(
      { status: true, message: "Adjunto eliminado", data: { id: imageId } },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("DELETE acta-entrega image:", errorMessage);
    await reportError(req, "api/acta-entrega-productos/[id]/image/[imageId]", "DELETE", 400, errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}
