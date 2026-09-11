import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../../utils/callDynamicPrisma";
import fs from "fs";
import path from "path";
import { uploadDynamicFiles } from "../../../../../../utils/callDynamicFilesApi";
import { reportError } from "../../../../../../utils/reportError";

export const runtime = "nodejs";

type ContributionFileInput = {
  type: string;
  extension: string;
  original_name?: string;
  file_base64: string;
};

function safeParseJson<T>(value: any, fallback: T): T {
  try {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length === 0) return fallback;
      return JSON.parse(trimmed) as T;
    }
    if (value === null || value === undefined) return fallback;
    return value as T;
  } catch {
    return fallback;
  }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string; contributionId: string }> }) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });

    const { id, contributionId } = await context.params;
    const incidentId = parseInt(id, 10);
    const aporteId = parseInt(contributionId, 10);
    if (!incidentId || !aporteId) {
      await reportError(req, "api/incidents/[id]/contributions/[contributionId]", "PUT", 400, "IDs no especificados");
      return NextResponse.json({ status: false, message: "IDs no especificados" }, { status: 400 });
    }

    const empleadoId = parseInt(String((payload as any)?.id ?? (payload as any)?.empleado_id ?? "0"), 10);
    if (!empleadoId) {
      await reportError(req, "api/incidents/[id]/contributions/[contributionId]", "PUT", 400, "Empleado no identificado");
      return NextResponse.json({ status: false, message: "Empleado no identificado" }, { status: 400 });
    }

    const aporte = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_contribucion_incidente",
        operation: "findFirst",
        where: { id: aporteId, incidente_id: incidentId }
      }
    });
    if (!aporte) {
      await reportError(req, "api/incidents/[id]/contributions/[contributionId]", "PUT", 404, "Aporte no encontrado");
      return NextResponse.json({ status: false, message: "Aporte no encontrado" }, { status: 404 });
    }

    const body = await req.json();
    const { aporte: aporteText, archivos, nombre_aporte, firma_aporte_tercero } = body ?? {};

    if (
      typeof aporteText === "string" ||
      typeof nombre_aporte === "string" ||
      nombre_aporte === null ||
      typeof firma_aporte_tercero === "string" ||
      firma_aporte_tercero === null
    ) {
      await callDynamicPrisma({
        req,
        data: {
          action: "UPDATE",
          table: "c_contribucion_incidente",
          where: { id: aporteId },
          data: {
            ...(typeof aporteText === "string" ? { aporte: aporteText } : {}),
            ...(typeof nombre_aporte === "string" || nombre_aporte === null
              ? { nombre_aporte: typeof nombre_aporte === "string" && nombre_aporte.trim().length > 0 ? nombre_aporte.trim() : null }
              : {}),
            ...(typeof firma_aporte_tercero === "string" || firma_aporte_tercero === null
              ? { firma_aporte_tercero: typeof firma_aporte_tercero === "string" && firma_aporte_tercero.trim().length > 0 ? firma_aporte_tercero.trim() : null }
              : {}),
          }
        }
      });
    }

    let filesParsed: ContributionFileInput[] = [];
    if (archivos) {
      filesParsed = safeParseJson<ContributionFileInput[]>(archivos, []);
    }

    if (filesParsed.length > 0) {
      const uploadResp = await uploadDynamicFiles({
        req,
        folderPath: `incidents/${incidentId}/aportes/${aporteId}`,
        files: filesParsed
          .filter((f) => f?.file_base64 && f?.extension && f?.type)
          .map((f) => ({
            type: f.type,
            extension: f.extension,
            original_name: f.original_name,
            file_base64: f.file_base64,
          })),
      });

      const uploadedFiles = Array.isArray(uploadResp?.files) ? uploadResp.files : [];
      for (const uploaded of uploadedFiles) {
        await callDynamicPrisma({
          req,
          data: {
            action: "POST",
            table: "c_archivos_aporte_incidente",
            data: {
              name: uploaded.name,
              original_name: uploaded.original_name || uploaded.name,
              type: uploaded.type,
              extension: uploaded.extension,
              contribucion_id: aporteId,
            },
          },
        });
      }
    }

    return NextResponse.json({ status: true, message: "Aporte actualizado correctamente" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in PUT /api/incidents/[id]/contributions/[contributionId]:", errorMessage);
    await reportError(req, "api/incidents/[id]/contributions/[contributionId]", "PUT", 500, errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string; contributionId: string }> }) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });

    const { id, contributionId } = await context.params;
    const incidentId = parseInt(id, 10);
    const aporteId = parseInt(contributionId, 10);
    if (!incidentId || !aporteId) {
      await reportError(req, "api/incidents/[id]/contributions/[contributionId]", "DELETE", 400, "IDs no especificados");
      return NextResponse.json({ status: false, message: "IDs no especificados" }, { status: 400 });
    }

    const aporte = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_contribucion_incidente",
        operation: "findFirst",
        where: { id: aporteId, incidente_id: incidentId },
        include: { c_archivos_aporte_incidente: true }
      }
    });
    if (!aporte) {
      await reportError(req, "api/incidents/[id]/contributions/[contributionId]", "DELETE", 404, "Aporte no encontrado");
      return NextResponse.json({ status: false, message: "Aporte no encontrado" }, { status: 404 });
    }

    await callDynamicPrisma({
      req,
      data: { action: "DELETE", table: "c_contribucion_incidente", where: { id: aporteId } }
    });

    const dir = path.join(process.cwd(), "public", "uploads", "incidents", `${incidentId}`, "aportes", `${aporteId}`);
    if (fs.existsSync(dir)) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }

    return NextResponse.json({ status: true, message: "Aporte eliminado correctamente" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in DELETE /api/incidents/[id]/contributions/[contributionId]:", errorMessage);
    await reportError(req, "api/incidents/[id]/contributions/[contributionId]", "DELETE", 500, errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}


