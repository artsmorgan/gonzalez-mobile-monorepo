import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../../../utils/callDynamicPrisma";
import { toZonedTime } from "date-fns-tz";
import { reportError } from "../../../../../../../utils/reportError";

/**
 * Elimina el vínculo actividad–puesto (e_actividades_puesto).
 * Los registros e_actividades_puesto_plaza asociados se eliminan en cascada.
 */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string; puestoId: string }> },
) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json({ status: false, expired, message }, { status: expired ? 401 : 403 });
    }

    const resolvedParams = await context.params;
    const actividadId = Number(resolvedParams.id);
    const puestoId = Number(resolvedParams.puestoId);
    if (!Number.isFinite(actividadId) || actividadId <= 0) {
      await reportError(req, "api/activities/created/[id]/puestos/[puestoId]", "DELETE", 500, "Actividad inválida");
      return NextResponse.json({ status: false, message: "Actividad inválida" }, { status: 500 });
    }
    if (!Number.isFinite(puestoId) || puestoId <= 0) {
      await reportError(req, "api/activities/created/[id]/puestos/[puestoId]", "DELETE", 500, "Puesto inválido");
      return NextResponse.json({ status: false, message: "Puesto inválido" }, { status: 500 });
    }

    const actividad = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "e_actividades",
        operation: "findUnique",
        where: { id: actividadId },
        select: { id: true, nombre_actividad: true },
      },
    });
    if (!actividad) {
      await reportError(req, "api/activities/created/[id]/puestos/[puestoId]", "DELETE", 404, "Actividad no encontrada");
      return NextResponse.json({ status: false, message: "Actividad no encontrada" }, { status: 404 });
    }

    const links = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "e_actividades_puesto",
        operation: "findMany",
        where: { actividad_id: actividadId, puesto_id: puestoId },
        select: { id: true, puesto_id: true },
      },
    });
    const linkRows = Array.isArray(links) ? links : [];
    if (linkRows.length === 0) {
      await reportError(req, "api/activities/created/[id]/puestos/[puestoId]", "DELETE", 500, "El puesto no está vinculado a esta actividad");
      return NextResponse.json(
        { status: false, message: "El puesto no está vinculado a esta actividad" },
        { status: 200 },
      );
    }

    await callDynamicPrisma({
      req,
      data: {
        action: "DELETE",
        table: "e_actividades_puesto",
        operation: "deleteMany",
        where: { actividad_id: actividadId, puesto_id: puestoId },
      },
    });

    const createdBy = payload?.id ? Number(payload.id) : 0;
    await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_cambios_apps_modules",
        data: {
          nombre_tabla: "e_actividades",
          registro_id: actividadId,
          cambios: JSON.stringify([
            {
              prop: "__puesto_desvinculado__",
              before: {
                puesto_id: puestoId,
                vinculos_eliminados: linkRows.map((r: { id?: number }) => Number(r.id)).filter((v) => v > 0),
              },
              after: null,
            },
          ]),
          created_at: toZonedTime(new Date(), "America/Costa_Rica").toISOString(),
          created_by: createdBy,
        },
      },
    });

    return NextResponse.json(
      {
        status: true,
        message: "Puesto desvinculado correctamente",
        actividad_id: actividadId,
        puesto_id: puestoId,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    await reportError(req, "api/activities/created/[id]/puestos/[puestoId]", "DELETE", 500, errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}
