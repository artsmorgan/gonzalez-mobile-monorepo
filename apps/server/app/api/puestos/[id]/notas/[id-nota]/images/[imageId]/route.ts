import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../../../../utils/callDynamicPrisma";

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string; "id-nota": string; imageId: string }> }
) {
  try {
    const { valid, expired, message } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json({ status: false, expired, message }, { status: expired ? 401 : 403 });
    }

    const p = await context.params;
    const puestoId = parseInt(String(p.id), 10);
    const noteId = parseInt(String(p["id-nota"]), 10);
    const imageId = parseInt(String(p.imageId), 10);
    if (!Number.isFinite(puestoId) || !Number.isFinite(noteId) || !Number.isFinite(imageId)) {
      return NextResponse.json({ status: false, message: "Parámetros inválidos" }, { status: 200 });
    }

    const note = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_puesto_notas",
        operation: "findUnique",
        where: { id: noteId },
      },
    });
    if (!note || Number(note.puesto_id) !== puestoId) {
      return NextResponse.json({ status: false, message: "Nota no encontrada" }, { status: 200 });
    }

    const image = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_imagenes_puesto_notas",
        operation: "findUnique",
        where: { id: imageId },
      },
    });
    if (!image || Number(image.nota_id) !== noteId) {
      return NextResponse.json({ status: false, message: "Archivo no encontrado" }, { status: 200 });
    }

    await callDynamicPrisma({
      req,
      data: {
        action: "DELETE",
        table: "c_imagenes_puesto_notas",
        where: { id: imageId },
        returning: false,
      },
    });

    try {
      const origin = req.nextUrl.origin;
      const urlPath = `/uploads/puesto-notas/${noteId}/${encodeURIComponent(String(image.name || ""))}`;
      const mobileAccessToken = process.env.MOBILE_ACCESS_TOKEN || "";
      const authHeader = req.headers.get("authorization") || "";
      await fetch(`${origin}/api/dynamic-prisma/files?url=${encodeURIComponent(urlPath)}`, {
        method: "DELETE",
        headers: {
          ...(authHeader ? { authorization: authHeader } : {}),
          ...(mobileAccessToken ? { "x-mobile-access-token": mobileAccessToken } : {}),
        },
      });
    } catch {
      // Eliminar DB es prioritario; si el archivo ya no existe o falla, no bloquea.
    }

    return NextResponse.json({ status: true, message: "Archivo eliminado con éxito" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}
