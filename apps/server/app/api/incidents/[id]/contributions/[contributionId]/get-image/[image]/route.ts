import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { fetchDynamicFile } from "../../../../../../../../utils/callDynamicFilesApi";
import { callDynamicPrisma } from "../../../../../../../../utils/callDynamicPrisma";
import { reportError } from "../../../../../../../../utils/reportError";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; contributionId: string; image: string }> }
) {
  try {
    const { id, contributionId, image } = await context.params;
    const incidentId = parseInt(id, 10);
    const aporteId = parseInt(contributionId, 10);
    const safeImageName = path.basename(decodeURIComponent(image));

    if (!incidentId || !aporteId || !safeImageName) {
      await reportError(req, "api/incidents/[id]/contributions/[contributionId]/get-image/[image]", "GET", 400, "IDs o imagen faltante");
      return NextResponse.json({ status: false, message: "IDs o imagen faltante" }, { status: 400 });
    }

    try {
      const aporte = await callDynamicPrisma({
        req,
        data: {
          action: "GET",
          table: "c_contribucion_incidente",
          operation: "findFirst",
          where: { id: aporteId, incidente_id: incidentId },
        },
      });
      if (!aporte) {
        await reportError(req, "api/incidents/[id]/contributions/[contributionId]/get-image/[image]", "GET", 404, "Aporte no encontrado");
        return NextResponse.json({ status: false, message: "Aporte no encontrado" }, { status: 404 });
      }

      const fileRecord = await callDynamicPrisma({
        req,
        data: {
          action: "GET",
          table: "c_archivos_aporte_incidente",
          operation: "findFirst",
          where: { contribucion_id: aporteId, name: safeImageName },
        },
      });
      if (!fileRecord) {
        await reportError(req, "api/incidents/[id]/contributions/[contributionId]/get-image/[image]", "GET", 404, "Archivo no encontrado");
        return NextResponse.json({ status: false, message: "Archivo no encontrado" }, { status: 404 });
      }
    } catch (dbError: any) {
      // Estas rutas se consumen desde <Image/> sin token; en ese caso validamos solo archivo físico.
      const msg = String(dbError?.message || "");
      if (!msg.toLowerCase().includes("token no proporcionado")) {
        throw dbError;
      }
    }

    const fetched = await fetchDynamicFile({
      req,
      type: "image",
      url: `incidents/${incidentId}/aportes/${aporteId}/${safeImageName}`,
      download: false,
      shouldVerifyAccessToken: false,
    });

    return new NextResponse(fetched.buffer, {
      headers: {
        "Content-Type": fetched.headers.contentType,
        "Cache-Control": fetched.headers.cacheControl,
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in GET /api/incidents/[id]/contributions/[contributionId]/get-image/[image]:", errorMessage);
    await reportError(req, "api/incidents/[id]/contributions/[contributionId]/get-image/[image]", "GET", 500, errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}