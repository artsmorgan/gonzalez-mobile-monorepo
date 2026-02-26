import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { fetchDynamicFile } from "../../../../../../../../utils/callDynamicFilesApi";
import { callDynamicPrisma } from "../../../../../../../../utils/callDynamicPrisma";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; contributionId: string; audio: string }> }
) {
  try {
    const { id, contributionId, audio } = await context.params;
    const incidentId = parseInt(id, 10);
    const aporteId = parseInt(contributionId, 10);
    const safeAudioName = path.basename(decodeURIComponent(audio));

    if (!incidentId || !aporteId || !safeAudioName) {
      return NextResponse.json({ status: false, message: "IDs o audio faltante" }, { status: 400 });
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
      if (!aporte) return NextResponse.json({ status: false, message: "Aporte no encontrado" }, { status: 404 });

      const fileRecord = await callDynamicPrisma({
        req,
        data: {
          action: "GET",
          table: "c_archivos_aporte_incidente",
          operation: "findFirst",
          where: { contribucion_id: aporteId, name: safeAudioName },
        },
      });
      if (!fileRecord) return NextResponse.json({ status: false, message: "Archivo no encontrado" }, { status: 404 });
    } catch (dbError: any) {
      const msg = String(dbError?.message || "");
      if (!msg.toLowerCase().includes("token no proporcionado")) {
        throw dbError;
      }
    }

    const fetched = await fetchDynamicFile({
      req,
      type: "audio",
      url: `incidents/${incidentId}/aportes/${aporteId}/${safeAudioName}`,
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
    console.error("Error in GET /api/incidents/[id]/contributions/[contributionId]/get-audio/[audio]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}


