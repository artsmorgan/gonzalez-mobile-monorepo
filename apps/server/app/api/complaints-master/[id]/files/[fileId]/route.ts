import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../../utils/callDynamicPrisma";
import fs from "fs";
import path from "path";
import { reportError } from "../../../../../../utils/reportError";

export const runtime = "nodejs";

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string; fileId: string }> }
) {
  try {
    // Nota: seguimos el patrón de incidentes/job-manuals donde el serving de archivos no requiere auth,
    // pero las mutaciones sí requieren auth normalmente. Aquí mantenemos auth (por seguridad).
    // Si necesitas sin-auth también para delete, lo ajustamos.
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });

    const { id, fileId } = await context.params;
    const complaintId = parseInt(id, 10);
    const anexId = parseInt(fileId, 10);
    if (!complaintId || !anexId) {
      await reportError(req, "api/complaints-master/[id]/files/[fileId]", "DELETE", 400, "IDs no especificados");
      return NextResponse.json({ status: false, message: "IDs no especificados" }, { status: 400 });
    }

    const anex = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_anexos_quejas",
        operation: "findFirst",
        where: { id: anexId, queja_id: complaintId },
      },
    });
    if (!anex) {
      await reportError(req, "api/complaints-master/[id]/files/[fileId]", "DELETE", 404, "Archivo no encontrado");
      return NextResponse.json({ status: false, message: "Archivo no encontrado" }, { status: 404 });
    }

    const anexObj = anex as any;
    await callDynamicPrisma({
      req,
      data: {
        action: "DELETE",
        table: "c_anexos_quejas",
        operation: "delete",
        where: { id: anexId },
      },
    });

    const dir = path.join(process.cwd(), "public", "uploads", "complaints-master", `${complaintId}`);
    const filePath = path.join(dir, anexObj.name);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        // ignore
      }
    }

    return NextResponse.json({ status: true, message: "Archivo eliminado correctamente" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in DELETE /api/complaints-master/[id]/files/[fileId]:", errorMessage);
    await reportError(req, "api/complaints-master/[id]/files/[fileId]", "DELETE", 500, errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}


