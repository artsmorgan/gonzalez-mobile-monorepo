import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../../utils/callDynamicPrisma";
import { deleteDynamicFile } from "../../../../../../utils/callDynamicFilesApi";

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

    const resolvedParams = await context.params;
    const registroId = parseInt(String(resolvedParams.id), 10);
    const imageRowId = parseInt(String(resolvedParams.imageId), 10);
    if (Number.isNaN(registroId) || registroId <= 0 || Number.isNaN(imageRowId) || imageRowId <= 0) {
      return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });
    }

    const registro = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_registro_induccion_general",
        operation: "findUnique",
        where: { id: registroId },
      },
    });
    if (!registro || (registro as any).isActive === false) {
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
    }

    const imgRow = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_imagenes_registro_induccion_general",
        operation: "findFirst",
        where: { id: imageRowId, registro_id: registroId },
      },
    });
    if (!imgRow) {
      return NextResponse.json({ status: false, message: "Imagen no encontrada" }, { status: 404 });
    }

    const storedName = String((imgRow as any).name || "").trim();
    if (storedName) {
      try {
        await deleteDynamicFile({
          req,
          url: `general-induction-register/${registroId}/${storedName}`,
        });
      } catch (e) {
        console.warn("deleteDynamicFile general-induction image:", e);
      }
    }

    await callDynamicPrisma({
      req,
      data: {
        action: "DELETE",
        table: "c_imagenes_registro_induccion_general",
        operation: "delete",
        where: { id: imageRowId },
      },
    });

    return NextResponse.json({ status: true, message: "Imagen eliminada correctamente" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error(errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}
