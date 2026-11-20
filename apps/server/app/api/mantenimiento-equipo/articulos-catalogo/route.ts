import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { prisma } from "../../../../utils/prismaClient";
import { reportError } from "../../../../utils/reportError";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { valid, expired, message } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json({ status: false, expired, message }, { status: expired ? 401 : 403 });
    }

    const articulos = await prisma.n_articulo_corpo_puesto.findMany({
      orderBy: { id: "asc" },
    });

    const data = (Array.isArray(articulos) ? articulos : []).map((a) => ({
      id: Number(a.id),
      nombre: String(a.nombre ?? ""),
    }));

    return NextResponse.json({ status: true, data }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in GET /api/mantenimiento-equipo/articulos-catalogo:", errorMessage);
    await reportError(req, "api/mantenimiento-equipo/articulos-catalogo", "GET", 500, errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}
