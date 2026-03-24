import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { toZonedTime } from "date-fns-tz";

const parseIntStrict = (value: any) => {
  const n = parseInt(String(value), 10);
  return Number.isNaN(n) ? null : n;
};

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) return NextResponse.json({ status: false, expired, message }, { status: expired ? 401 : 403 });

    const { id } = await context.params;
    const idNum = parseIntStrict(id);
    if (!idNum) return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });

    const existing = await callDynamicPrisma({
      req,
      data: { action: "GET", table: "e_mutuos_acuerdos", operation: "findUnique", where: { id: idNum } },
    });
    if (!existing) return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });

    const estadoActual = String((existing as any)?.estado || "").trim().toLowerCase() || "pendiente";
    if (estadoActual !== "pendiente") {
      return NextResponse.json({ status: false, message: "Solo se puede rechazar un mutuo acuerdo pendiente" }, { status: 400 });
    }

    const currentEmployeeId = parseIntStrict((payload as any)?.id);
    if (!currentEmployeeId) return NextResponse.json({ status: false, message: "Empleado inválido" }, { status: 400 });

    const empleado = await callDynamicPrisma({
      req,
      data: { action: "GET", table: "c_empleado", operation: "findUnique", where: { id: currentEmployeeId } },
    });
    const myEjecutivoCuentaId = empleado?.supervisor_id ?? null;
    const canReject = myEjecutivoCuentaId !== null && Number(myEjecutivoCuentaId) === Number(existing.ejecutivo_cuenta);
    if (!canReject) {
      return NextResponse.json({ status: false, message: "No autorizado para rechazar este mutuo acuerdo" }, { status: 403 });
    }

    if (!existing.ausente_acepta || !existing.reemplaza_acepta) {
      return NextResponse.json({ status: false, message: "Ambos empleados deben aceptar antes de rechazar" }, { status: 400 });
    }

    const updated = await callDynamicPrisma({
      req,
      data: {
        action: "UPDATE",
        table: "e_mutuos_acuerdos",
        where: { id: idNum },
        data: {
          estado: "rechazado",
        },
      },
    });

    const now = toZonedTime(new Date(), "America/Costa_Rica").toISOString();
    await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_cambios_apps_modules",
        data: {
          nombre_tabla: "e_mutuos_acuerdos",
          registro_id: idNum,
          cambios: JSON.stringify([
            { prop: "estado", before: (existing as any)?.estado || null, after: "rechazado" },
          ]),
          created_at: now,
          created_by: currentEmployeeId,
        },
      },
    });

    return NextResponse.json(
      {
        status: true,
        message: "Mutuo acuerdo rechazado correctamente",
        data: { id: updated.id, estado: "rechazado" },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}

