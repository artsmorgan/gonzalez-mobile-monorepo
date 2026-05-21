import { NextRequest, NextResponse } from "next/server";
import { callDynamicPrisma } from "../../../../../../utils/callDynamicPrisma";
import { fetchBitacoraRevisionImage } from "../../../../../../utils/bitacoraRevisionImages";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; image: string }> }
) {
  try {
    const resolvedParams = await context.params;
    const id = parseInt(resolvedParams.id, 10);
    const image = decodeURIComponent(resolvedParams.image || "");
    if (!id || !image) {
      return NextResponse.json({ status: false, message: "ID o imagen faltante" }, { status: 400 });
    }

    const token = req.nextUrl.searchParams.get("token") || undefined;

    const bitacora = await callDynamicPrisma({
      req,
      token,
      data: {
        action: "GET",
        table: "c_bitacora_vehiculo_detenido",
        operation: "findUnique",
        where: { id },
      },
    });
    if (!bitacora) {
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
    }

    const fetched = await fetchBitacoraRevisionImage(req, id, image);

    return new NextResponse(fetched.buffer, {
      headers: {
        "Content-Type": fetched.headers.contentType,
        "Cache-Control": fetched.headers.cacheControl,
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("GET bitacora revision image:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}
