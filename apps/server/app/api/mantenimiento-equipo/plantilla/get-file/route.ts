import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { buildMantenimientoEquipoPlantillaBuffer } from "../../../../../utils/mantenimientoEquipoPlantilla";

export const runtime = "nodejs";

function getAccessTokenFromRequest(req: NextRequest): string {
  const authHeader = req.headers.get("authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.split(" ")[1]?.trim() || "";
  }
  return req.nextUrl.searchParams.get("token")?.trim() || "";
}

export async function GET(req: NextRequest) {
  try {
    const { valid, expired, message } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json({ status: false, expired, message }, { status: expired ? 401 : 403 });
    }

    const accessToken = getAccessTokenFromRequest(req);

    const articulos = await callDynamicPrisma({
      req,
      token: accessToken,
      data: {
        action: "GET",
        table: "n_articulo_corpo_puesto",
        operation: "findMany",
        orderBy: { id: "asc" },
      },
    });

    const catalog = (Array.isArray(articulos) ? articulos : []).map((a: { id: number; nombre: string }) => ({
      id: Number(a.id),
      nombre: String(a.nombre ?? ""),
    }));

    const buffer = await buildMantenimientoEquipoPlantillaBuffer(catalog);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="plantilla_articulos_puesto.xlsx"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in GET /api/mantenimiento-equipo/plantilla/get-file:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}
