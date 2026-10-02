import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { reportError } from "../../../../../utils/reportError";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ corpo_id: string }> }
) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

    const { corpo_id } = await context.params;
    const sucursalId = parseInt(String(corpo_id), 10);
    if (!sucursalId) {
      await reportError(req, "api/corporate-vehicles/corpo/[corpo_id]", "GET", 400, "Sucursal no especificada");
      return NextResponse.json({ status: false, message: "Sucursal no especificada" }, { status: 400 });
    }

    const items = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_vehiculos_corporativos",
        operation: "findMany",
        where: { sucursal_id: sucursalId, isActive: true },
        orderBy: { id: "desc" },
        include: { c_imagenes_vehiculos_corporativos: true, c_usos_vehiculos_corporativos: true },
      },
    });

    const itemsArray = Array.isArray(items) ? items : [];
    // Adjuntamos el registro de bitácora a cada uso (si existe) - no hay relación Prisma declarada
    const bitacoraIds = Array.from(
      new Set(
        itemsArray
          .flatMap((v: any) => (Array.isArray(v.c_usos_vehiculos_corporativos) ? v.c_usos_vehiculos_corporativos : []).map((u: any) => u.bitacora_id))
          .filter((id: any): id is number => typeof id === "number" && Number.isFinite(id))
      )
    );
    const bitacoras = bitacoraIds.length
      ? await callDynamicPrisma({
          req,
          data: {
            action: "GET",
            table: "c_bitacora_vehiculo_detenido",
            operation: "findMany",
            where: { id: { in: bitacoraIds } },
          },
        })
      : [];
    const bitacorasArray = Array.isArray(bitacoras) ? bitacoras : [];
    const bitacoraById = new Map(bitacorasArray.map((b: any) => [b.id, b]));

    const mapped = itemsArray.map((r: any) => ({
      ...r,
      id_local: "",
      corpo_id: r.sucursal_id, // compat con móvil
      images: (Array.isArray(r.c_imagenes_vehiculos_corporativos) ? r.c_imagenes_vehiculos_corporativos : []).map((i: any) => ({
        id: i.id,
        name: i.name,
      })),
      usos: (Array.isArray(r.c_usos_vehiculos_corporativos) ? r.c_usos_vehiculos_corporativos : []).map((u: any) => ({
        ...u,
        bitacora: u.bitacora_id ? bitacoraById.get(u.bitacora_id) ?? null : null,
      })),
    }));

    return NextResponse.json({ status: true, data: mapped }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in GET /api/corporate-vehicles/corpo/[corpo_id]:", errorMessage);
    await reportError(req, "api/corporate-vehicles/corpo/[corpo_id]", "GET", 500, errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}


