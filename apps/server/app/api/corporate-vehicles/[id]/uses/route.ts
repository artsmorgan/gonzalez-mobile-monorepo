import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../../utils/verifyToken";
import { prisma } from "../../../../../utils/prismaClient";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { valid, message } = verifyAccessToken(req);
    if (!valid) {
      return NextResponse.json({ status: false, message }, { status: 401 });
    }

    const { id } = await context.params;
    const vehiculoId = parseInt(String(id), 10);
    if (!vehiculoId) {
      return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 400 });
    }

    const usos = await prisma.c_usos_vehiculos_corporativos.findMany({
      where: { vehiculo_id: vehiculoId },
      orderBy: { id: "desc" },
    });

    // Adjuntamos bitácora vinculada si existe (no hay relación Prisma declarada)
    const bitacoraIds = Array.from(
      new Set(usos.map((u: any) => u.bitacora_id).filter((id: any): id is number => typeof id === "number" && Number.isFinite(id)))
    );
    const bitacoras = bitacoraIds.length
      ? await prisma.c_bitacora_vehiculo_detenido.findMany({ where: { id: { in: bitacoraIds } } })
      : [];
    const bitacoraById = new Map(bitacoras.map((b: any) => [b.id, b]));

    const mapped = usos.map((u: any) => ({
      ...u,
      bitacora: u.bitacora_id ? bitacoraById.get(u.bitacora_id) ?? null : null,
    }));

    return NextResponse.json({ status: true, data: mapped }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in GET /api/corporate-vehicles/[id]/uses:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { valid, message } = verifyAccessToken(req);
    if (!valid) {
      return NextResponse.json({ status: false, message }, { status: 401 });
    }

    const { id } = await context.params;
    const vehiculoId = parseInt(String(id), 10);
    if (!vehiculoId) {
      return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 400 });
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

    const created = await prisma.c_usos_vehiculos_corporativos.create({
      data: {
        vehiculo_id: vehiculoId,
        nombre_conductor: String(nombre_conductor ?? ""),
        fecha: fecha ? new Date(fecha) : new Date(),
        hora_inicio: hora_inicio ? new Date(hora_inicio) : new Date(),
        hora_fin: hora_fin ? new Date(hora_fin) : new Date(),
        combustible_inicio: Number(combustible_inicio ?? 0),
        combustible_fin: Number(combustible_fin ?? 0),
        km_inicio: Number(km_inicio ?? 0),
        km_fin: Number(km_fin ?? 0),
        motivo: String(motivo ?? ""),
        firma_responsable: String(firma_responsable ?? ""),
      },
    });

    return NextResponse.json({ status: true, data: created }, { status: 201 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in POST /api/corporate-vehicles/[id]/uses:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}


