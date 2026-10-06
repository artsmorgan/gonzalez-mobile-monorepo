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
    const agendaId = parseInt(String(resolved.id), 10);
    const imageId = parseInt(String(resolved.imageId), 10);
    if (!agendaId || !imageId) {
      await reportError(req, "api/agenda-minuta/[id]/image/[imageId]", "DELETE", 400, "ID inválido");
      return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });
    }

    const imageRow = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_imagenes_agenda_minuta",
        operation: "findFirst",
        where: { id: imageId, agenda_id: agendaId },
      },
    });
    if (!imageRow) {
      await reportError(req, "api/agenda-minuta/[id]/image/[imageId]", "DELETE", 404, "Imagen no encontrada");
      return NextResponse.json({ status: false, message: "Imagen no encontrada" }, { status: 404 });
    }

    await callDynamicPrisma({
      req,
      data: {
        action: "DELETE",
        table: "c_imagenes_agenda_minuta",
        operation: "delete",
        where: { id: imageId, agenda_id: agendaId },
      },
    });

    const img = imageRow as { name?: string };
    const name = String(img?.name || "").trim();
    if (name) {
      try {
        await deleteDynamicFile({ req, url: `agenda-minuta/${agendaId}/${name}` });
      } catch (e) {
        console.error("deleteDynamicFile agenda-minuta (continuando):", e);
      }
    }

    return NextResponse.json(
      { status: true, message: "Imagen eliminada", data: { id: imageId } },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("DELETE agenda-minuta image:", errorMessage);
    await reportError(req, "api/agenda-minuta/[id]/image/[imageId]", "DELETE", 400, errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}
