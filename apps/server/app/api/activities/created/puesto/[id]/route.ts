import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../../utils/callDynamicPrisma";
import { prisma } from "../../../../../../utils/prismaClient";

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

    const allLinks = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "e_actividades_puesto",
        operation: "findMany",
        where: { actividad_id: { in: actividadIds } },
        select: { actividad_id: true, puesto_id: true },
      },
    });

    const allPuestoIds = Array.from(
      new Set(
        (Array.isArray(allLinks) ? allLinks : [])
          .map((l: { puesto_id?: number }) => Number(l.puesto_id))
          .filter((v) => Number.isFinite(v) && v > 0),
      ),
    );

    const puestoById = new Map<number, { id: number; nombre: string; codigo: string | null }>();
    if (allPuestoIds.length > 0) {
      const puestosRows = await prisma.e_estructura_puesto.findMany({
        where: { id: { in: allPuestoIds } },
        select: { id: true, nombre: true, codigo: true },
      });
      for (const row of Array.isArray(puestosRows) ? puestosRows : []) {
        const id = Number((row as { id?: number }).id);
        if (!Number.isFinite(id) || id <= 0) continue;
        puestoById.set(id, {
          id,
          nombre: String((row as { nombre?: string }).nombre ?? "").trim() || `Puesto #${id}`,
          codigo: (row as { codigo?: string | null }).codigo ?? null,
        });
      }
    }

    const puestosByActividad = new Map<number, { id: number; nombre: string; codigo: string | null }[]>();
    for (const link of Array.isArray(allLinks) ? allLinks : []) {
      const actividadId = Number((link as { actividad_id?: number }).actividad_id);
      const puestoId = Number((link as { puesto_id?: number }).puesto_id);
      if (!Number.isFinite(actividadId) || actividadId <= 0) continue;
      if (!Number.isFinite(puestoId) || puestoId <= 0) continue;
      const puesto = puestoById.get(puestoId);
      if (!puesto) continue;
      const list = puestosByActividad.get(actividadId) ?? [];
      if (!list.some((p) => p.id === puesto.id)) list.push(puesto);
      puestosByActividad.set(actividadId, list);
    }

    const enriched = items.map((actividad: { id?: number }) => {
      const id = Number(actividad.id);
      const puestos = (puestosByActividad.get(id) ?? []).sort((a, b) =>
        a.nombre.localeCompare(b.nombre, "es"),
      );
      return { ...actividad, puestos_vinculados: puestos };
    });

    return NextResponse.json({ status: true, actividades: enriched }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}

