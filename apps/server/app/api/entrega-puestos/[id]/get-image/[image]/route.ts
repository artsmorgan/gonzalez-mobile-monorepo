import { NextRequest, NextResponse } from "next/server";
import { fetchDynamicFile } from "../../../../../../utils/callDynamicFilesApi";
import { callDynamicPrisma } from "../../../../../../utils/callDynamicPrisma";
import { verifyAccessTokenByApi } from "../../../../../../utils/verifyAccessTokenByApi";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; image: string }> }
) {
  try {
    const { valid, expired, message } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json(
        { status: false, expired, message },
        { status: expired ? 401 : 403 }
      );
    }

    const resolvedParams = await context.params;
    const id = parseInt(resolvedParams.id, 10);
    const image = decodeURIComponent(String(resolvedParams.image || "").trim());

    if (!id || !image) {
      return NextResponse.json(
        { status: false, message: "ID o imagen faltante" },
        { status: 400 }
      );
    }

    const authHeader = req.headers.get("authorization") || "";
    const tokenForPrisma =
      String(req.nextUrl.searchParams.get("token") || "").trim() ||
      (authHeader.startsWith("Bearer ") ? (authHeader.split(" ")[1] || "").trim() : "");

    const registro = await callDynamicPrisma({
      req,
      token: tokenForPrisma,
      data: {
        action: "GET",
        table: "e_registro_entrega_puesto",
        operation: "findUnique",
        where: { id },
      },
    });

    if (!registro) {
      return NextResponse.json(
        { status: false, message: "Registro no encontrado" },
        { status: 404 }
      );
    }

    const matchesDelivery =
      String((registro as { image_delivery?: string | null }).image_delivery || "").trim() === image;
    const matchesReceives =
      String((registro as { image_receives?: string | null }).image_receives || "").trim() === image;

    if (!matchesDelivery && !matchesReceives) {
      return NextResponse.json(
        { status: false, message: "Imagen no encontrada en el registro" },
        { status: 404 }
      );
    }

    const fetched = await fetchDynamicFile({
      req,
      type: "image",
      url: `entrega-puestos/${id}/${image}`,
      download: false,
    });

    return new NextResponse(fetched.buffer, {
      headers: {
        "Content-Type": fetched.headers.contentType,
        "Cache-Control": fetched.headers.cacheControl,
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in GET /api/entrega-puestos/[id]/get-image/[image]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}
