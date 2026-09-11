import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { prisma } from "../../../../../utils/prismaClient";
import { findContributionIncidents } from "../../../../../utils/findContributionIncidents";
import { sendNotificationByRole } from "../../../../../utils/sendNotification";
import { uploadDynamicFiles } from "../../../../../utils/callDynamicFilesApi";
import { reportError } from "../../../../../utils/reportError";

export const runtime = "nodejs";

type ContributionFileInput = {
  type: string; // image | audio | video | document
  extension: string;
  original_name?: string;
  file_base64: string; // base64 puro (sin data:)
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

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });

    const { id } = await context.params;
    const incidentId = parseInt(id, 10);
    if (!incidentId) {
      await reportError(req, "api/incidents/[id]/contributions", "GET", 400, "ID no especificado");
      return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 400 });
    }

    const incident = await callDynamicPrisma({
      req,
      data: { action: "GET", table: "c_incidente", operation: "findUnique", where: { id: incidentId } }
    });
    if (!incident) {
      await reportError(req, "api/incidents/[id]/contributions", "GET", 404, "Incidente no encontrado");
      return NextResponse.json({ status: false, message: "Incidente no encontrado" }, { status: 404 });
    }

    const mapped = await findContributionIncidents(req, incidentId);

    return NextResponse.json({ status: true, contributions: mapped }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in GET /api/incidents/[id]/contributions:", errorMessage);
    await reportError(req, "api/incidents/[id]/contributions", "GET", 500, errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });

    const { id } = await context.params;
    const incidentId = parseInt(id, 10);
    if (!incidentId) {
      await reportError(req, "api/incidents/[id]/contributions", "POST", 400, "ID no especificado");
      return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 400 });
    }

    const incident = await callDynamicPrisma({
      req,
      data: { action: "GET", table: "c_incidente", operation: "findUnique", where: { id: incidentId } }
    });
    if (!incident) {
      await reportError(req, "api/incidents/[id]/contributions", "POST", 404, "Incidente no encontrado");
      return NextResponse.json({ status: false, message: "Incidente no encontrado" }, { status: 404 });
    }

    const body = await req.json();
    const { aporte, rol_aporte, archivos, nombre_aporte, firma_aporte_tercero } = body ?? {};

    const empleadoId = parseInt(String((payload as any)?.id ?? (payload as any)?.empleado_id ?? "0"), 10);
    if (!empleadoId) {
      await reportError(req, "api/incidents/[id]/contributions", "POST", 400, "Empleado no identificado");
      return NextResponse.json({ status: false, message: "Empleado no identificado" }, { status: 400 });
    }

    if (!aporte || String(aporte).trim().length === 0) {
      await reportError(req, "api/incidents/[id]/contributions", "POST", 400, "Aporte requerido");
      return NextResponse.json({ status: false, message: "Aporte requerido" }, { status: 400 });
    }

    const roleStr = (typeof rol_aporte === "string" ? rol_aporte : "").trim();
    if (roleStr.length === 0) {
      await reportError(req, "api/incidents/[id]/contributions", "POST", 400, "Rol de aporte requerido");
      return NextResponse.json({ status: false, message: "Rol de aporte requerido" }, { status: 400 });
    }

    let filesParsed: ContributionFileInput[] = [];
    if (archivos) {
      filesParsed = safeParseJson<ContributionFileInput[]>(archivos, []);
    }

    const created = await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_contribucion_incidente",
        data: {
          incidente_id: incidentId,
          empleado_id: empleadoId,
          aporte: String(aporte),
          rol_aporte: roleStr,
          nombre_aporte: typeof nombre_aporte === "string" && nombre_aporte.trim().length > 0 ? nombre_aporte.trim() : null,
          firma_aporte_tercero: typeof firma_aporte_tercero === "string" && firma_aporte_tercero.trim().length > 0 ? firma_aporte_tercero.trim() : null,
          created_at: new Date().toISOString(),
        }
      }
    });

    if (filesParsed.length > 0) {
      const uploadResp = await uploadDynamicFiles({
        req,
        folderPath: `incidents/${incidentId}/aportes/${created.id}`,
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
              contribucion_id: created.id,
            },
          },
        });
      }
    }

    if (created) {
      let empleadoNombre = "Desconocido";
      let sucursalNombre = "Desconocida";
      const incidentData = await callDynamicPrisma({
        req,
        data: { action: "GET", table: "c_incidente", operation: "findUnique", where: { id: incidentId } }
      });
      if (incidentData) {
        let clasificacionNombre = "Desconocida";
        const emp = await prisma.c_empleado.findUnique({ where: { id: empleadoId } });
        if (emp) {
          empleadoNombre = emp.nombre + " " + emp.primer_apellido + " " + emp.segundo_apellido;
        }
        if (incidentData.clasificacion) {
          const clasificacion = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "n_clasificacion_incidente", operation: "findUnique", where: { id: incidentData.clasificacion } }
          });
          if (clasificacion) {
            clasificacionNombre = clasificacion.nombre;
          }
        }
        if (incidentData.corpo_id) {
          const sucursal = await prisma.e_estructura_sucursal.findUnique({ where: { id: incidentData.corpo_id } });
          if (sucursal) {
            sucursalNombre = sucursal.nombre;
          }
        }
        const fechaIncidente = incidentData.fecha_incidente instanceof Date
          ? incidentData.fecha_incidente.toISOString()
          : incidentData.fecha_incidente;
        let descriptionNotificacion = "El empleado " + empleadoNombre + " ha registrado un aporte al incidente de tipo " + clasificacionNombre + " en la sucursal " + sucursalNombre + " ocurrido el día " + fechaIncidente.split("T")[0];
        await sendNotificationByRole(req, incidentData.corpo_id, [empleadoId], "Aporte registrado", descriptionNotificacion, ["ADMINISTRATIVO", "SUPERVISOR"]);
      }
    }

    return NextResponse.json({ status: true, message: "Aporte creado con éxito", contributionId: created.id }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in POST /api/incidents/[id]/contributions:", errorMessage);
    await reportError(req, "api/incidents/[id]/contributions", "POST", 500, errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}


