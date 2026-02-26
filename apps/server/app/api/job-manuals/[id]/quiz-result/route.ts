import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { toZonedTime } from "date-fns-tz";
import { sendNotificationByEmployee } from "../../../../../utils/sendNotification";

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
      return NextResponse.json(
        { status: false, message: "Manual no especificado" },
        { status: 200 }
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
      return NextResponse.json(
        { status: false, message: "Manual o quiz no encontrado" },
        { status: 200 }
      );
    }

    const manualObj = manual as any;
    if (manualObj.quiz === null) {
      return NextResponse.json(
        { status: false, message: "Manual o quiz no encontrado" },
        { status: 200 }
      );
    }

    const body = await req.json();
    const marca_id = typeof body?.marca_id === "number" ? body.marca_id : parseInt(String(body?.marca_id ?? ""), 10);
    const empleado_id = typeof body?.empleado_id === "number" ? body.empleado_id : parseInt(String(body?.empleado_id ?? ""), 10);
    const approved = body?.approved;

    if (!marca_id || Number.isNaN(marca_id)) {
      return NextResponse.json(
        { status: false, message: "Marca no especificada" },
        { status: 200 }
      );
    }

    if (!empleado_id || Number.isNaN(empleado_id)) {
      return NextResponse.json(
        { status: false, message: "Empleado no especificado" },
        { status: 200 }
      );
    }

    if (typeof approved !== "boolean") {
      return NextResponse.json(
        { status: false, message: "El campo approved debe ser boolean" },
        { status: 200 }
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
      return NextResponse.json(
        { status: false, message: "Registro de visualización no encontrado" },
        { status: 200 }
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

    const marca = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_marca_dia",
        operation: "findUnique",
        where: { id: marca_id },
      },
    });
    if (!marca) {
      return NextResponse.json(
        { status: false, message: "Marca no encontrada" },
        { status: 200 }
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
    return NextResponse.json(
      { status: false, message: errorMessage },
      { status: 500 }
    );
  }
}


