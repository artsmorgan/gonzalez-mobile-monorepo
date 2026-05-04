/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { toZonedTime } from "date-fns-tz";

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json({ status: false, expired, message }, { status: expired ? 401 : 403 });
    }

    const resolvedParams = await context.params;
    const id = parseInt(resolvedParams.id, 10);
    if (!id) {
      return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });
    }

    const body = await req.json().catch(() => ({}));
    const firmaSolicitante = typeof body?.firma_solicitante === "string" ? body.firma_solicitante.trim() : "";
    if (!firmaSolicitante) {
      return NextResponse.json({ status: false, message: "Firma del solicitante requerida" }, { status: 200 });
    }

    const existing = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_boleta_apreciacion_vulnerabilidad",
        operation: "findUnique",
        where: { id },
      },
    });
    if (!existing || existing.isActive === false) {
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 200 });
    }

    const updated = await callDynamicPrisma({
      req,
      data: {
        action: "UPDATE",
        table: "c_boleta_apreciacion_vulnerabilidad",
        operation: "update",
        where: { id },
        data: {
          firma_solicitante: firmaSolicitante,
        },
      },
    });

    const before = (existing as any).firma_solicitante ?? null;
    if (before !== firmaSolicitante) {
      await callDynamicPrisma({
        req,
        data: {
          action: "POST",
          table: "c_cambios_apps_modules",
          operation: "create",
          data: {
            nombre_tabla: "c_boleta_apreciacion_vulnerabilidad",
            registro_id: id,
            cambios: JSON.stringify([{ prop: "firma_solicitante", before, after: firmaSolicitante }]),
            created_at: toZonedTime(new Date(), "America/Costa_Rica").toISOString(),
            created_by: Number(payload?.id ?? 0),
          },
        },
      });
    }

    return NextResponse.json({
      status: true,
      message: "Firma del solicitante actualizada correctamente",
      data: updated,
    }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in PUT /api/apreciacion-vulnerabilidad/[id]/firma-solicitante:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}

