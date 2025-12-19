import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../../utils/verifyToken";
import { prisma } from "../../../../../utils/prismaClient";
import { toZonedTime } from "date-fns-tz";
import { sendNotificationByEmployee } from "../../../../../utils/sendNotification";

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { valid, message } = verifyAccessToken(req);
    if (!valid) {
      return NextResponse.json({ status: false, message }, { status: 401 });
    }

    const resolvedParams = await context.params;
    const manualId = parseInt(resolvedParams.id, 10);
    if (!manualId) {
      return NextResponse.json(
        { status: false, message: "Manual no especificado" },
        { status: 200 }
      );
    }

    const manual = await prisma.e_manual_puesto.findUnique({
      where: { id: manualId }
    });

    if (!manual || manual.quiz === null) {
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

    const existing = await prisma.e_empleado_visualizacion_manual_puesto.findFirst({
      where: {
        manual_puesto_id: manualId,
        empleado_id: empleado_id,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { status: false, message: "Registro de visualización no encontrado" },
        { status: 200 }
      );
    }

    const nowCR = toZonedTime(new Date(), "America/Costa_Rica") as Date;

    await prisma.e_empleado_visualizacion_manual_puesto.update({
      where: { id: existing.id },
      data: {
        approved,
        updated_at: nowCR,
      },
    });

    // Notificar al usuario que respondió el quiz
    const notifTitle = "Resultado del quiz";
    const notifDesc = approved
      ? `Tu quiz del manual ${manual.title} fue aprobado.`
      : `Tu quiz del manual ${manual.title} fue reprobado. Podrás intentarlo nuevamente cuando corresponda.`;
    await sendNotificationByEmployee(marca_id, notifTitle, notifDesc, [empleado_id]);

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


