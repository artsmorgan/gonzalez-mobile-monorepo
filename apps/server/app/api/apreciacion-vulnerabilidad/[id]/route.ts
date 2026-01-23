/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../utils/verifyToken";
import { prisma } from "../../../../utils/prismaClient";

function parseDateTime(value: any): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  if (isNaN(d.getTime())) return null;
  return d;
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { valid, expired, payload, message } = verifyAccessToken(req);
    if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

    const resolvedParams = await context.params;
    const id = parseInt(resolvedParams.id);
    if (!id) {
      return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });
    }

    const existing = await prisma.c_boleta_apreciacion_vulnerabilidad.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 200 });
    }

    const body = await req.json();
    const {
      cliente_id,
      corpo_id,
      puesto_id,
      fecha,
      enlace,
      nombre_solicitante,
      boleta,
      metricas_vulnerablidad,
      observaciones,
      firma_solicitante,
      firma_responsable,
    } = body ?? {};

    const fechaDate = fecha ? parseDateTime(fecha) : null;
    if (fecha && !fechaDate) {
      return NextResponse.json({ status: false, message: "Fecha inválida" }, { status: 200 });
    }

    // Validar IDs si vienen
    if (cliente_id) {
      const cliente = await prisma.e_estructura_cliente.findUnique({ where: { id: parseInt(String(cliente_id)) } });
      if (!cliente) return NextResponse.json({ status: false, message: "Cliente inválido" }, { status: 200 });
    }
    if (corpo_id) {
      const corpo = await prisma.e_estructura_sucursal.findUnique({ where: { id: parseInt(String(corpo_id)) } });
      if (!corpo) return NextResponse.json({ status: false, message: "Corpo inválido" }, { status: 200 });
    }
    if (puesto_id) {
      const puesto = await prisma.e_estructura_puesto.findUnique({ where: { id: parseInt(String(puesto_id)) } });
      if (!puesto) return NextResponse.json({ status: false, message: "Puesto inválido" }, { status: 200 });
    }

    await prisma.c_boleta_apreciacion_vulnerabilidad.update({
      where: { id },
      data: {
        cliente_id: cliente_id ? parseInt(String(cliente_id)) : existing.cliente_id,
        corpo_id: corpo_id ? parseInt(String(corpo_id)) : existing.corpo_id,
        puesto_id: puesto_id ? parseInt(String(puesto_id)) : existing.puesto_id,
        fecha: fechaDate ?? existing.fecha,
        enlace: typeof enlace === "string" ? enlace : existing.enlace,
        nombre_solicitante: typeof nombre_solicitante === "string" ? nombre_solicitante : existing.nombre_solicitante,
        boleta: typeof boleta === "string" ? boleta : existing.boleta,
        metricas_vulnerablidad:
          typeof metricas_vulnerablidad === "string" ? metricas_vulnerablidad : existing.metricas_vulnerablidad,
        observaciones: typeof observaciones === "string" ? observaciones : existing.observaciones,
        firma_solicitante: typeof firma_solicitante === "string" ? firma_solicitante : existing.firma_solicitante,
        firma_responsable: typeof firma_responsable === "string" ? firma_responsable : existing.firma_responsable,
      },
    });

    return NextResponse.json({ status: true, message: "Registro actualizado correctamente" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in PUT /api/apreciacion-vulnerabilidad/[id]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { valid, expired, payload, message } = verifyAccessToken(req);
    if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

    const resolvedParams = await context.params;
    const id = parseInt(resolvedParams.id);
    if (!id) {
      return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });
    }

    const existing = await prisma.c_boleta_apreciacion_vulnerabilidad.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 200 });
    }

    await prisma.c_boleta_apreciacion_vulnerabilidad.delete({ where: { id } });
    return NextResponse.json({ status: true, message: "Registro eliminado correctamente" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in DELETE /api/apreciacion-vulnerabilidad/[id]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}


