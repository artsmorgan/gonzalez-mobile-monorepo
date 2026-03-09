import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../../utils/callDynamicPrisma";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { valid, expired, message } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json({ status: false, expired, message }, { status: expired ? 401 : 403 });
    }

    const resolvedParams = await context.params;
    const puestoId = Number(resolvedParams.id);
    if (!Number.isFinite(puestoId) || puestoId <= 0) {
      return NextResponse.json({ status: false, message: "Puesto inválido" }, { status: 200 });
    }

    const links = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "e_actividades_puesto",
        operation: "findMany",
        where: { puesto_id: puestoId },
        select: { actividad_id: true },
      },
    });

    const actividadIds = Array.from(
      new Set((Array.isArray(links) ? links : []).map((l: any) => Number(l.actividad_id)).filter((v) => v > 0))
    );

    if (actividadIds.length === 0) {
      return NextResponse.json({ status: true, actividades: [] }, { status: 200 });
    }

    const actividades = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "e_actividades",
        operation: "findMany",
        where: { id: { in: actividadIds } },
        orderBy: { id: "desc" },
      },
    });

    const items = Array.isArray(actividades) ? actividades : [];
    return NextResponse.json({ status: true, actividades: items }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}

