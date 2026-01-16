import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../../utils/verifyToken";
import { prisma } from "../../../../../utils/prismaClient";

export const runtime = "nodejs";

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ use_id: string }> }
) {
  try {
    const { valid, message } = verifyAccessToken(req);
    if (!valid) {
      return NextResponse.json({ status: false, message }, { status: 401 });
    }

    const { use_id } = await context.params;
    const usoId = parseInt(String(use_id), 10);
    if (!usoId) {
      return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 400 });
    }

    const existing = await prisma.c_usos_vehiculos_corporativos.findUnique({ where: { id: usoId } });
    if (!existing) {
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
    }

    const body = await req.json();
    const {
      nombre_conductor,
      fecha,
      hora_inicio,
      hora_fin,
      combustible_inicio,
      combustible_fin,
      km_inicio,
      km_fin,
      motivo,
      firma_responsable,
      // bitacora_id: ignorado por solicitud
    } = body || {};

    const updated = await prisma.c_usos_vehiculos_corporativos.update({
      where: { id: usoId },
      data: {
        nombre_conductor: nombre_conductor !== undefined ? String(nombre_conductor ?? "") : existing.nombre_conductor,
        fecha: fecha !== undefined ? (fecha ? new Date(fecha) : new Date()) : existing.fecha,
        hora_inicio: hora_inicio !== undefined ? (hora_inicio ? new Date(hora_inicio) : new Date()) : existing.hora_inicio,
        hora_fin: hora_fin !== undefined ? (hora_fin ? new Date(hora_fin) : new Date()) : existing.hora_fin,
        combustible_inicio:
          combustible_inicio !== undefined ? Number(combustible_inicio ?? 0) : existing.combustible_inicio,
        combustible_fin: combustible_fin !== undefined ? Number(combustible_fin ?? 0) : existing.combustible_fin,
        km_inicio: km_inicio !== undefined ? Number(km_inicio ?? 0) : existing.km_inicio,
        km_fin: km_fin !== undefined ? Number(km_fin ?? 0) : existing.km_fin,
        motivo: motivo !== undefined ? String(motivo ?? "") : existing.motivo,
        firma_responsable:
          firma_responsable !== undefined ? String(firma_responsable ?? "") : existing.firma_responsable,
      },
    });

    return NextResponse.json({ status: true, data: updated }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in PUT /api/corporate-vehicles/uses/[use_id]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ use_id: string }> }
) {
  try {
    const { valid, message } = verifyAccessToken(req);
    if (!valid) {
      return NextResponse.json({ status: false, message }, { status: 401 });
    }

    const { use_id } = await context.params;
    const usoId = parseInt(String(use_id), 10);
    if (!usoId) {
      return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 400 });
    }

    const existing = await prisma.c_usos_vehiculos_corporativos.findUnique({ where: { id: usoId } });
    if (!existing) {
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
    }

    await prisma.c_usos_vehiculos_corporativos.delete({ where: { id: usoId } });

    return NextResponse.json({ status: true, message: "Uso eliminado correctamente" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in DELETE /api/corporate-vehicles/uses/[use_id]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}


