import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { prisma } from "../../../../../utils/prismaClient";
import { toZonedTime } from "date-fns-tz";
import { sendNotificationByEmployee } from "../../../../../utils/sendNotification";
import { reportError } from "../../../../../utils/reportError";

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });
    }

    const resolvedParams = await context.params;
    const manualId = parseInt(resolvedParams.id, 10);
    if (!manualId) {
      await reportError(req, "api/job-manuals/[id]/quiz-result", "PUT", 400, "Manual no especificado");
      return NextResponse.json(
        { status: false, message: "Manual no especificado" },
        { status: 400 }
      );
    }

    const manual = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "e_manual_puesto",
        operation: "findUnique",
        where: { id: manualId },
      },
    });

    if (!manual) {
      await reportError(req, "api/job-manuals/[id]/quiz-result", "PUT", 404, "Manual o quiz no encontrado");
      return NextResponse.json(
        { status: false, message: "Manual o quiz no encontrado" },
        { status: 404 }
      );
    }

    const manualObj = manual as any;
    if (manualObj.quiz === null) {
      await reportError(req, "api/job-manuals/[id]/quiz-result", "PUT", 404, "Manual o quiz no encontrado");
      return NextResponse.json(
        { status: false, message: "Manual o quiz no encontrado" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const marca_id = typeof body?.marca_id === "number" ? body.marca_id : parseInt(String(body?.marca_id ?? ""), 10);
    const empleado_id = typeof body?.empleado_id === "number" ? body.empleado_id : parseInt(String(body?.empleado_id ?? ""), 10);
    const approved = body?.approved;

    if (!marca_id || Number.isNaN(marca_id)) {
      await reportError(req, "api/job-manuals/[id]/quiz-result", "PUT", 400, "Marca no especificada");
      return NextResponse.json(
        { status: false, message: "Marca no especificada" },
        { status: 400 }
      );
    }

    if (!empleado_id || Number.isNaN(empleado_id)) {
      await reportError(req, "api/job-manuals/[id]/quiz-result", "PUT", 400, "Empleado no especificado");
      return NextResponse.json(
        { status: false, message: "Empleado no especificado" },
        { status: 400 }
      );
    }

    if (typeof approved !== "boolean") {
      await reportError(req, "api/job-manuals/[id]/quiz-result", "PUT", 400, "El campo approved debe ser boolean");
      return NextResponse.json(
        { status: false, message: "El campo approved debe ser boolean" },
        { status: 400 }
      );
    }

    const tokenEmpleadoId = payload?.id != null ? Number(payload.id) : NaN;
    if (
      Number.isFinite(tokenEmpleadoId) &&
      tokenEmpleadoId > 0 &&
      tokenEmpleadoId === empleado_id
    ) {
      await reportError(req, "api/job-manuals/[id]/quiz-result", "PUT", 400, "No puedes calificar tu propio intento de quiz");
      return NextResponse.json(
        { status: false, message: "No puedes calificar tu propio intento de quiz" },
        { status: 400 }
      );
    }

    const existing = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "e_empleado_visualizacion_manual_puesto",
        operation: "findFirst",
        where: {
          manual_puesto_id: manualId,
          empleado_id: empleado_id,
        },
      },
    });

    if (!existing) {
      await reportError(req, "api/job-manuals/[id]/quiz-result", "PUT", 404, "Registro de visualización no encontrado");
      return NextResponse.json(
        { status: false, message: "Registro de visualización no encontrado" },
        { status: 404 }
      );
    }

    const existingObj = existing as any;
    const nowCR = toZonedTime(new Date(), "America/Costa_Rica") as Date;

    await callDynamicPrisma({
      req,
      data: {
        action: "UPDATE",
        table: "e_empleado_visualizacion_manual_puesto",
        operation: "update",
        where: { id: existingObj.id },
        data: {
          approved,
          updated_at: nowCR.toISOString(),
        },
      },
    });

    const marca = await prisma.c_marca_dia.findUnique({
      where: { id: marca_id },
    });
    if (!marca) {
      await reportError(req, "api/job-manuals/[id]/quiz-result", "PUT", 404, "Marca no encontrada");
      return NextResponse.json(
        { status: false, message: "Marca no encontrada" },
        { status: 404 }
      );
    }

    const marcaObj = marca as any;
    // Notificar al usuario que respondió el quiz
    const notifTitle = "Resultado del quiz";
    const notifDesc = approved
      ? `Tu quiz del manual ${manualObj.title} fue aprobado.`
      : `Tu quiz del manual ${manualObj.title} fue reprobado. Podrás intentarlo nuevamente cuando corresponda.`;
    await sendNotificationByEmployee(req, marcaObj.corpo_id, [empleado_id], notifTitle, notifDesc, [empleado_id]);

    return NextResponse.json(
      { status: true, message: "Resultado del quiz actualizado" },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in PUT /api/job-manuals/[id]/quiz-result:", errorMessage);
    await reportError(req, "api/job-manuals/[id]/quiz-result", "PUT", 500, errorMessage);
    return NextResponse.json(
      { status: false, message: errorMessage },
      { status: 500 }
    );
  }
}


