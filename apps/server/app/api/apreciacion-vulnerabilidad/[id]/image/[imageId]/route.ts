import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../../utils/callDynamicPrisma";

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string; imageId: string }> }
) {
  try {
    const { valid, expired, message } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json({ status: false, expired, message }, { status: expired ? 401 : 403 });
    }

    const p = await context.params;
    const boletaId = parseInt(String(p.id), 10);
    const imageId = parseInt(String(p.imageId), 10);
    if (!Number.isFinite(boletaId) || !Number.isFinite(imageId)) {
      return NextResponse.json({ status: false, message: "Parámetros inválidos" }, { status: 200 });
    }

    const boleta = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_boleta_apreciacion_vulnerabilidad",
        operation: "findUnique",
        where: { id: boletaId },
      },
    });
    if (!boleta || boleta.isActive === false) {
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 200 });
    }

    const image = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_imagenes_boleta_apreciacion_vulnerabilidad",
        operation: "findUnique",
        where: { id: imageId },
      },
    });
    if (!image || Number(image.boleta_id) !== boletaId) {
      return NextResponse.json({ status: false, message: "Archivo no encontrado" }, { status: 200 });
    }

    await callDynamicPrisma({
      req,
      data: {
        action: "DELETE",
        table: "c_imagenes_boleta_apreciacion_vulnerabilidad",
        where: { id: imageId },
        returning: false,
      },
    });

    try {
      const origin = req.nextUrl.origin;
      const urlPath = `/uploads/apreciacion-vulnerabilidad/${boletaId}/${encodeURIComponent(String(image.name || ""))}`;
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
      // remove from DB is priority
    }

    return NextResponse.json({ status: true, message: "Archivo eliminado con éxito" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}

