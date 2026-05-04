/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../../utils/callDynamicPrisma";
import { deleteUploadsFileByRelativePath } from "../../../../../utils/deleteUploadsFileByRelativePath";

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string; imageId: string }> }
) {
  try {
    const { valid, expired, message } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json({ status: false, expired, message }, { status: expired ? 401 : 403 });
    }

    const { id, imageId } = await context.params;
    const controlId = parseInt(String(id), 10);
    const imgId = parseInt(String(imageId), 10);
    if (!Number.isFinite(controlId) || controlId <= 0 || !Number.isFinite(imgId) || imgId <= 0) {
      return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });
    }

    const existing = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_control_asistencia",
        operation: "findUnique",
        where: { id: controlId },
      },
    });
    if (!existing || !(existing as any).id) {
      return NextResponse.json({ status: false, message: "Control no encontrado" }, { status: 404 });
    }

    const rows = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_imagenes_control_asistencia",
        operation: "findMany",
        where: { id: imgId, control_id: controlId },
        take: 1,
      },
    });
    const rowsArray = Array.isArray(rows) ? rows : [];
    const row = rowsArray[0];
    if (!row || !(row as any).id) {
      return NextResponse.json({ status: false, message: "Imagen no encontrada" }, { status: 404 });
    }

    const fileName = String((row as any).name || "").trim();
    if (fileName) {
      const relative = `attendance-control/${controlId}/${fileName}`;
      const del = deleteUploadsFileByRelativePath(relative);
      if (!del.ok) {
        return NextResponse.json({ status: false, message: del.message || "No se pudo eliminar el archivo" }, { status: 400 });
      }
    }

    await callDynamicPrisma({
      req,
      data: {
        action: "DELETE",
        table: "c_imagenes_control_asistencia",
        operation: "delete",
        where: { id: imgId },
      },
    });

    return NextResponse.json(
      { status: true, message: "Imagen eliminada correctamente", data: { control_id: controlId, image_id: imgId } },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("DELETE /api/attendance-control/[id]/images/[imageId]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}
