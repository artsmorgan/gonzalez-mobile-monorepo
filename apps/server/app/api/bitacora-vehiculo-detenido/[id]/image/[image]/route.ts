import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../../utils/callDynamicPrisma";
import { deleteDynamicFile } from "../../../../../../utils/callDynamicFilesApi";
import {
  parseInformacionRevision,
  removeImageFromRevisionJson,
} from "../../../../../../utils/bitacoraRevisionImages";
import { reportError } from "../../../../../../utils/reportError";

export const runtime = "nodejs";

function revisionFolder(bitacoraId: number): string {
  return `bitacora-vehiculos-detenidos/${bitacoraId}/revision`;
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string; image: string }> }
) {
  try {
    const { valid, expired, message } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json({ status: false, expired, message }, { status: expired ? 401 : 403 });
    }

    const resolved = await context.params;
    const bitacoraId = parseInt(String(resolved.id), 10);
    const imageName = decodeURIComponent(String(resolved.image || "").trim());
    const revisionKey = String(req.nextUrl.searchParams.get("revisionKey") || "").trim();

    if (!bitacoraId || !imageName || !revisionKey) {
      await reportError(req, "api/bitacora-vehiculo-detenido/[id]/image/[image]", "DELETE", 400, "ID, imagen o revisionKey inválidos");
      return NextResponse.json(
        { status: false, message: "ID, imagen o revisionKey inválidos" },
        { status: 400 }
      );
    }

    const existing = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_bitacora_vehiculo_detenido",
        operation: "findUnique",
        where: { id: bitacoraId },
      },
    });
    if (!existing) {
      await reportError(req, "api/bitacora-vehiculo-detenido/[id]/image/[image]", "DELETE", 404, "Registro no encontrado");
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
    }

    const nextRevisionStr = removeImageFromRevisionJson(
      existing.informacion_revision,
      revisionKey,
      imageName
    );
    const prevArr = parseInformacionRevision(existing.informacion_revision);
    const nextArr = parseInformacionRevision(nextRevisionStr);
    const prevEntry = prevArr.find((e: any) => String(e?.key) === revisionKey);
    const prevImgs = Array.isArray(prevEntry?.images) ? prevEntry.images : [];
    if (!prevImgs.some((x: unknown) => String(x) === imageName)) {
      await reportError(req, "api/bitacora-vehiculo-detenido/[id]/image/[image]", "DELETE", 404, "Imagen no encontrada en revisión");
      return NextResponse.json({ status: false, message: "Imagen no encontrada en revisión" }, { status: 404 });
    }

    await callDynamicPrisma({
      req,
      data: {
        action: "UPDATE",
        table: "c_bitacora_vehiculo_detenido",
        where: { id: bitacoraId },
        data: { informacion_revision: nextRevisionStr },
      },
    });

    try {
      await deleteDynamicFile({
        req,
        url: `${revisionFolder(bitacoraId)}/${imageName}`,
        shouldVerifyAccessToken: true,
      });
    } catch (e) {
      console.warn("deleteDynamicFile bitacora revision (continuando):", e);
    }

    return NextResponse.json(
      {
        status: true,
        message: "Imagen eliminada",
        data: { informacion_revision: nextArr },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("DELETE bitacora revision image:", errorMessage);
    await reportError(req, "api/bitacora-vehiculo-detenido/[id]/image/[image]", "DELETE", 500, errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}
