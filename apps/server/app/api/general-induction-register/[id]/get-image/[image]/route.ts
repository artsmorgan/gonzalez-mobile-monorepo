import { NextRequest, NextResponse } from "next/server";
import { fetchDynamicFile } from "../../../../../../utils/callDynamicFilesApi";
import { callDynamicPrisma } from "../../../../../../utils/callDynamicPrisma";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; image: string }> }
) {
  try {
    const resolvedParams = await context.params;
    const id = parseInt(resolvedParams.id, 10);
    const image = resolvedParams.image;

    if (!id || !image) {
      return NextResponse.json(
        { status: false, message: "ID o imagen faltante" },
        { status: 400 }
      );
    }

    const record = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_registro_induccion_general",
        operation: "findUnique",
        where: { id },
      },
    });
    if (!record) {
      return NextResponse.json(
        { status: false, message: "Registro no encontrado" },
        { status: 404 }
      );
    }

    const fileRecord = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_imagenes_registro_induccion_general",
        operation: "findFirst",
        where: { registro_id: id, name: image },
      },
    });
    if (!fileRecord) {
      return NextResponse.json(
        { status: false, message: "Archivo no encontrado" },
        { status: 404 }
      );
    }

    const fetched = await fetchDynamicFile({
      req,
      type: "image",
      url: `general-induction-register/${id}/${image}`,
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
    console.error("Error in GET /api/general-induction-register/[id]/get-image/[image]:", errorMessage);
    return NextResponse.json(
      { status: false, message: errorMessage },
      { status: 500 }
    );
  }
}
