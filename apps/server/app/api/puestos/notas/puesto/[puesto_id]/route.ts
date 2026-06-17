import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../../utils/callDynamicPrisma";
import {
    mergeNotesWhereWithDateRange,
    validateNotesDateRange,
} from "../../../../../../utils/notesUpdatedAtDateFilter";

export async function GET(req: NextRequest, context: { params: Promise<{ puesto_id: string }> }) {
  try {
    const { valid, expired, message } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json({ status: false, expired, message }, { status: expired ? 401 : 403 });
    }

    const resolved = await context.params;
    const puestoId = parseInt(String(resolved.puesto_id), 10);
    if (!puestoId || Number.isNaN(puestoId)) {
      return NextResponse.json({ status: false, message: "Puesto inválido" }, { status: 400 });
    }

    const fechaInicio = req.nextUrl.searchParams.get("fecha_inicio");
    const fechaFin = req.nextUrl.searchParams.get("fecha_fin");
    const rangeValidation = validateNotesDateRange(fechaInicio, fechaFin);
    if (!rangeValidation.valid) {
      return NextResponse.json({ status: false, message: rangeValidation.message }, { status: 400 });
    }

    const puesto = await callDynamicPrisma({
      req,
      data: { action: "GET", table: "e_estructura_puesto", operation: "findUnique", where: { id: puestoId } },
    });
    if (!puesto) {
      return NextResponse.json({ status: false, message: "Puesto no encontrado" }, { status: 404 });
    }

    const notas = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_puesto_notas",
        operation: "findMany",
        where: mergeNotesWhereWithDateRange(
          { puesto_id: puestoId, isActive: true },
          fechaInicio,
          fechaFin
        ),
        orderBy: { updated_at: "desc" },
      },
    });

    const baseUrl = req.nextUrl.origin;
    const output: any[] = [];
    for (const nota of Array.isArray(notas) ? notas : []) {
      const images = await callDynamicPrisma({
        req,
        data: {
          action: "GET",
          table: "c_imagenes_puesto_notas",
          operation: "findMany",
          where: { nota_id: nota.id },
        },
      });
      output.push({
        ...nota,
        images: (Array.isArray(images) ? images : []).map((img: any) => ({
          id: Number(img.id),
          name: String(img.name || ""),
          url: baseUrl ? `${baseUrl}/api/puestos/${nota.puesto_id}/notas/${nota.id}/get-image/${encodeURIComponent(String(img.name || ""))}` : "",
        })),
      });
    }

    return NextResponse.json({ status: true, notas: output }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}
