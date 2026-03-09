import { NextRequest, NextResponse } from "next/server";
import { fetchDynamicFile } from "../../../../../../utils/callDynamicFilesApi";
import { callDynamicPrisma } from "../../../../../../utils/callDynamicPrisma";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; name: string }> }
) {
  try {
    const { id, name } = await context.params;
    const checklistId = parseInt(String(id), 10);
    if (!checklistId || !name) {
      return NextResponse.json({ status: false, message: "ID o nombre de archivo no especificado" }, { status: 200 });
    }

    // Token desde querystring (estándar para consumo desde mobile, p. ej. Image source={{ uri: url?token=... }})
    const token = req.nextUrl.searchParams.get("token") || undefined;

    // Verificar que el checklist existe
    const checklist = await callDynamicPrisma({
      req,
      token,
      data: {
        action: "GET",
        table: "c_checklist_supervision",
        operation: "findUnique",
        where: { id: checklistId },
      },
    });
    if (!checklist) {
      return NextResponse.json({ status: false, message: "Checklist no encontrado" }, { status: 404 });
    }

    // Verificar que la imagen pertenece a este checklist
    const imageRecord = await callDynamicPrisma({
      req,
      token,
      data: {
        action: "GET",
        table: "c_imagenes_checklist_supervision",
        operation: "findFirst",
        where: { checklist_id: checklistId, name },
      },
    });
    if (!imageRecord) {
      return NextResponse.json({ status: false, message: "Imagen no encontrada" }, { status: 404 });
    }

    const fetched = await fetchDynamicFile({
      req,
      type: "image",
      url: `checklist-supervision/${checklistId}/${name}`,
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
    console.error("Error in GET /api/checklist-supervision/[id]/get-image/[name]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}

