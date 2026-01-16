import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../../utils/verifyToken";
import { prisma } from "../../../../../utils/prismaClient";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ corpo_id: string }> }
) {
  try {
    const { valid, message } = verifyAccessToken(req);
    if (!valid) {
      return NextResponse.json({ status: false, message }, { status: 401 });
    }

    const { corpo_id } = await context.params;
    const sucursalId = parseInt(String(corpo_id), 10);
    if (!sucursalId) {
      return NextResponse.json({ status: false, message: "Sucursal no especificada" }, { status: 400 });
    }

    const items = await prisma.c_vehiculos_corporativos.findMany({
      where: { sucursal_id: sucursalId },
      orderBy: { id: "desc" },
      include: { c_imagenes_vehiculos_corporativos: true, c_usos_vehiculos_corporativos: true },
    });

    // Adjuntamos el registro de bitácora a cada uso (si existe) - no hay relación Prisma declarada
    const bitacoraIds = Array.from(
      new Set(
        items
          .flatMap((v: any) => (v.c_usos_vehiculos_corporativos || []).map((u: any) => u.bitacora_id))
          .filter((id: any): id is number => typeof id === "number" && Number.isFinite(id))
      )
    );
    const bitacoras = bitacoraIds.length
      ? await prisma.c_bitacora_vehiculo_detenido.findMany({ where: { id: { in: bitacoraIds } } })
      : [];
    const bitacoraById = new Map(bitacoras.map((b: any) => [b.id, b]));

    const mapped = items.map((r: any) => ({
      ...r,
      id_local: "",
      corpo_id: r.sucursal_id, // compat con móvil
      images: (r.c_imagenes_vehiculos_corporativos || []).map((i: any) => ({
        id: i.id,
        name: i.name,
      })),
      usos: (r.c_usos_vehiculos_corporativos || []).map((u: any) => ({
        ...u,
        bitacora: u.bitacora_id ? bitacoraById.get(u.bitacora_id) ?? null : null,
      })),
    }));

    return NextResponse.json({ status: true, data: mapped }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in GET /api/corporate-vehicles/corpo/[corpo_id]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}


