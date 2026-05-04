import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../../utils/callDynamicPrisma";

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
    const boletaId = parseInt(String(resolved.id), 10);
    const imageId = parseInt(String(resolved.imageId), 10);
    if (!boletaId || !imageId) {
      return NextResponse.json({ status: false, message: "Parámetros inválidos" }, { status: 400 });
    }

    const boleta = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_apertura_cierre_puesto",
        operation: "findUnique",
        where: { id: boletaId, isActive: true },
      },
    });
    if (!boleta) {
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
    }

    const image = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_imagenes_apertura_cierre_puesto",
        operation: "findFirst",
        where: { id: imageId, apetura_cierre_id: boletaId },
      },
    });
    if (!image) {
      return NextResponse.json({ status: false, message: "Imagen no encontrada" }, { status: 404 });
    }

    const img = image as any;
    await callDynamicPrisma({
      req,
      data: {
        action: "DELETE",
        table: "c_imagenes_apertura_cierre_puesto",
        operation: "delete",
        where: { id: imageId },
      },
    });

    const apiUrl = req.nextUrl.origin;
    await fetch(`${apiUrl}/api/dynamic-prisma/files`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "Authorization": req.headers.get("authorization") || "",
        "ngrok-skip-browser-warning": "69420",
      },
      body: JSON.stringify({
        path: `opening-closing-position/${boletaId}/${String(img?.name || "")}`,
      }),
    }).catch(() => null);

    return NextResponse.json({ status: true, message: "Imagen eliminada correctamente" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error(errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}
