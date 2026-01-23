import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../../utils/verifyToken";
import { prisma } from "../../../../../utils/prismaClient";
import { sendNotificationByEmployee } from "../../../../../utils/sendNotification";
import { toZonedTime } from "date-fns-tz";

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { valid, expired, payload, message } = verifyAccessToken(req);
    if (!valid) return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });

    const resolvedParams = await context.params;
    const idNum = parseInt(String(resolvedParams.id), 10);
    if (Number.isNaN(idNum) || idNum <= 0) {
      return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });
    }

    const body = await req.json();
    const firma = String(body?.firma_ejecutivo_cuenta ?? "").trim();
    if (!firma || firma.length < 10) {
      return NextResponse.json({ status: false, message: "firma_ejecutivo_cuenta es requerida" }, { status: 400 });
    }

    const existing = await prisma.e_mutuos_acuerdos.findUnique({ where: { id: idNum } });
    if (!existing) {
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
    }

    // Validación owned (misma lógica que incidencias): supervisor_id del empleado actual debe coincidir con ejecutivo_cuenta del registro
    const currentEmployeeId = parseInt(String((payload as any)?.id ?? 0), 10) || 0;
    const empleado = currentEmployeeId
      ? await prisma.c_empleado.findUnique({ where: { id: currentEmployeeId } })
      : null;
    const myEjecutivoCuentaId = empleado?.supervisor_id ?? null;
    const owned = myEjecutivoCuentaId !== null && myEjecutivoCuentaId === existing.ejecutivo_cuenta;
    if (!owned) {
      return NextResponse.json({ status: false, message: "No autorizado para firmar este registro" }, { status: 400 });
    }

    const updated = await prisma.e_mutuos_acuerdos.update({
      where: { id: idNum },
      data: { firma_ejecutivo_cuenta: firma },
    });

    if (updated) {
      const cliente = await prisma.e_estructura_cliente.findUnique({ where: { id: updated.cliente_id } });
      if (cliente) {
        const sucursal = await prisma.e_estructura_sucursal.findUnique({ where: { id: updated.corpo_id } });
        if (sucursal) {
          const now = toZonedTime(new Date(), "America/Costa_Rica");
          const fecha_string = now.toISOString().split("T")[0];
          const hora_string = now.toISOString().split("T")[1].split(".")[0];
          const description = `Se ha firmado el mutuo acuerdo en la sucursal ${sucursal.nombre} de la empresa ${cliente.nombre} el día ${fecha_string} a las ${hora_string}`;
          sendNotificationByEmployee(updated.corpo_id, [currentEmployeeId], "Mutuo acuerdo firmado", description, [updated.ejecutivo_cuenta]);
        }
      }
    }

    return NextResponse.json(
      { status: true, message: "Firma de ejecutivo guardada correctamente", data: { id: updated.id, firma_ejecutivo_cuenta: updated.firma_ejecutivo_cuenta } },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error(errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}


