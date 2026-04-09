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
    const actividadId = Number(resolvedParams.id);
    if (!Number.isFinite(actividadId) || actividadId <= 0) {
      return NextResponse.json({ status: false, message: "Actividad inválida" }, { status: 200 });
    }

    const {
      nombre_actividad,
      descripcion_actividad,
      fecha_inicio,
      fecha_fin,
      frecuencia,
      es_revision_equipo,
      firma_responsable,
    } = await req.json();

    if (
      !nombre_actividad ||
      !descripcion_actividad ||
      !fecha_inicio ||
      !frecuencia ||
      es_revision_equipo === undefined ||
      !firma_responsable
    ) {
      return NextResponse.json({ status: false, message: "Datos incompletos" }, { status: 200 });
    }

    const existing = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "e_actividades",
        operation: "findUnique",
        where: { id: actividadId },
      },
    });
    if (!existing) {
      return NextResponse.json({ status: false, message: "Actividad no encontrada" }, { status: 200 });
    }

    await callDynamicPrisma({
      req,
      data: {
        action: "UPDATE",
        table: "e_actividades",
        operation: "update",
        where: { id: actividadId },
        data: {
          nombre_actividad,
          descripcion_actividad,
          fecha_inicio: new Date(fecha_inicio).toISOString(),
          fecha_fin: fecha_fin ? new Date(fecha_fin).toISOString() : new Date(fecha_inicio).toISOString(),
          frecuencia,
          es_revision_equipo,
          firma_responsable,
        },
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
              prop: "__updated__",
              before: {
                nombre_actividad: existing.nombre_actividad,
                descripcion_actividad: existing.descripcion_actividad,
                fecha_inicio: existing.fecha_inicio,
                fecha_fin: existing.fecha_fin,
                frecuencia: existing.frecuencia,
                es_revision_equipo: existing.es_revision_equipo,
              },
              after: {
                nombre_actividad,
                descripcion_actividad,
                fecha_inicio,
                fecha_fin: fecha_fin || fecha_inicio,
                frecuencia,
                es_revision_equipo,
              },
            },
          ]),
          created_at: toZonedTime(new Date(), "America/Costa_Rica").toISOString(),
          created_by: createdBy,
        },
      },
    });

    return NextResponse.json({ status: true, message: "Actividad actualizada correctamente" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json({ status: false, expired, message }, { status: expired ? 401 : 403 });
    }

    const resolvedParams = await context.params;
    const actividadId = Number(resolvedParams.id);
    if (!Number.isFinite(actividadId) || actividadId <= 0) {
      return NextResponse.json({ status: false, message: "Actividad inválida" }, { status: 200 });
    }

    const existing = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "e_actividades",
        operation: "findUnique",
        where: { id: actividadId },
      },
    });
    if (!existing) {
      return NextResponse.json({ status: false, message: "Actividad no encontrada" }, { status: 200 });
    }

    await callDynamicPrisma({
      req,
      data: {
        action: "DELETE",
        table: "e_actividades",
        operation: "delete",
        where: { id: actividadId },
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
          cambios: JSON.stringify([{ prop: "__deleted__", before: { id: actividadId }, after: null }]),
          created_at: toZonedTime(new Date(), "America/Costa_Rica").toISOString(),
          created_by: createdBy,
        },
      },
    });

    return NextResponse.json({ status: true, message: "Actividad eliminada correctamente" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}

