/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../utils/verifyToken";
import { prisma } from "../../../../utils/prismaClient";
import { toZonedTime } from "date-fns-tz";

function normalizeToStringifiedJson(value: any): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value ?? []);
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { valid, payload, message } = verifyAccessToken(req);
    if (!valid) {
      return NextResponse.json({ status: false, message }, { status: 401 });
    }

    const resolvedParams = await context.params;
    const id = parseInt(resolvedParams.id);
    if (!id) {
      return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });
    }

    const existing = await prisma.c_bitacora_vehiculo_detenido.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 200 });
    }

    const body = await req.json();
    const {
      tipo,
      informacion_general,
      informacion_revision,
      movimientos_vehiculos,
      observaciones,
      firma_responsable,
    } = body ?? {};

    const updated = await prisma.c_bitacora_vehiculo_detenido.update({
      where: { id },
      data: {
        tipo: typeof tipo === "string" ? tipo : existing.tipo,
        informacion_general: informacion_general !== undefined ? normalizeToStringifiedJson(informacion_general) : existing.informacion_general,
        informacion_revision: informacion_revision !== undefined ? normalizeToStringifiedJson(informacion_revision) : existing.informacion_revision,
        movimientos_vehiculos: movimientos_vehiculos !== undefined ? normalizeToStringifiedJson(movimientos_vehiculos) : existing.movimientos_vehiculos,
        observaciones: typeof observaciones === "string" ? observaciones : existing.observaciones,
        firma_responsable: typeof firma_responsable === "string" ? firma_responsable : existing.firma_responsable,
        // no cambiamos empresa/cliente/sucursal/created_by; pero podemos actualizar created_at si llega explícito (no por ahora)
        created_at: existing.created_at ?? (toZonedTime(new Date(), "America/Costa_Rica") as Date),
        created_by: existing.created_by ?? (parseInt(String((payload as any)?.id ?? 0)) || 0),
      },
    });

    return NextResponse.json({ status: true, message: "Bitácora actualizada correctamente" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in PUT /api/bitacora-vehiculo-detenido/[id]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { valid, message } = verifyAccessToken(req);
    if (!valid) {
      return NextResponse.json({ status: false, message }, { status: 401 });
    }

    const resolvedParams = await context.params;
    const id = parseInt(resolvedParams.id);
    if (!id) {
      return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });
    }

    const existing = await prisma.c_bitacora_vehiculo_detenido.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 200 });
    }

    await prisma.c_bitacora_vehiculo_detenido.delete({ where: { id } });
    return NextResponse.json({ status: true, message: "Bitácora eliminada correctamente" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in DELETE /api/bitacora-vehiculo-detenido/[id]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}


