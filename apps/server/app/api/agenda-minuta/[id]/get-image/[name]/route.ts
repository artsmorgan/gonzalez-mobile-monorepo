import { NextRequest, NextResponse } from "next/server";
import { fetchDynamicFile } from "../../../../../../utils/callDynamicFilesApi";
import { callDynamicPrisma } from "../../../../../../utils/callDynamicPrisma";
import { reportError } from "../../../../../../utils/reportError";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; name: string }> }
) {
  try {
    const { id, name } = await context.params;
    const agendaId = parseInt(String(id), 10);
    if (!agendaId || !name) {
      await reportError(req, "api/agenda-minuta/[id]/get-image/[name]", "GET", 500, "ID o nombre de archivo no especificado");
      return NextResponse.json({ status: false, message: "ID o nombre de archivo no especificado" }, { status: 500 });
    }

    const token = req.nextUrl.searchParams.get("token") || undefined;

    const agenda = await callDynamicPrisma({
      req,
      token,
      data: {
        action: "GET",
        table: "c_agenda_minuta",
        operation: "findUnique",
        where: { id: agendaId },
      },
    });
    if (!agenda) {
      await reportError(req, "api/agenda-minuta/[id]/get-image/[name]", "GET", 404, "Agenda minuta no encontrada");
      return NextResponse.json({ status: false, message: "Agenda minuta no encontrada" }, { status: 404 });
    }

    const imageRecord = await callDynamicPrisma({
      req,
      token,
      data: {
        action: "GET",
        table: "c_imagenes_agenda_minuta",
        operation: "findFirst",
        where: { agenda_id: agendaId, name },
      },
    });
    if (!imageRecord) {
      await reportError(req, "api/agenda-minuta/[id]/get-image/[name]", "GET", 404, "Imagen no encontrada");
      return NextResponse.json({ status: false, message: "Imagen no encontrada" }, { status: 404 });
    }

    const fetched = await fetchDynamicFile({
      req,
      type: "image",
      url: `agenda-minuta/${agendaId}/${name}`,
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
    console.error("Error in GET /api/agenda-minuta/[id]/get-image/[name]:", errorMessage);
    await reportError(req, "api/agenda-minuta/[id]/get-image/[name]", "GET", 500, errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}
