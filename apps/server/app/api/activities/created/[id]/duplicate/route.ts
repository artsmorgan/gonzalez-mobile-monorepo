import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../../utils/callDynamicPrisma";
import { toZonedTime } from "date-fns-tz";

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json({ status: false, expired, message }, { status: expired ? 401 : 403 });
    }

    const resolvedParams = await context.params;
    const sourceId = Number(resolvedParams.id);
    if (!Number.isFinite(sourceId) || sourceId <= 0) {
      return NextResponse.json({ status: false, message: "Actividad inválida" }, { status: 200 });
    }

    const existing = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "e_actividades",
        operation: "findUnique",
        where: { id: sourceId },
      },
    });
    if (!existing) {
      return NextResponse.json({ status: false, message: "Actividad no encontrada" }, { status: 200 });
    }

    const baseName = String(existing.nombre_actividad ?? "").trim();
    const copyName = baseName.endsWith(" (Copia)") ? baseName : `${baseName} (Copia)`;

    const newActivity = await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "e_actividades",
        data: {
          nombre_actividad: copyName,
          descripcion_actividad: existing.descripcion_actividad,
          fecha_inicio: existing.fecha_inicio,
          fecha_fin: existing.fecha_fin ?? existing.fecha_inicio,
          frecuencia: existing.frecuencia,
          es_revision_equipo: existing.es_revision_equipo,
          firma_responsable: existing.firma_responsable,
        },
      },
    });

    const newId = Number(newActivity?.id);
    if (!Number.isFinite(newId) || newId <= 0) {
      return NextResponse.json({ status: false, message: "No se pudo crear la actividad duplicada" }, { status: 200 });
    }

    const puestoLinks = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "e_actividades_puesto",
        operation: "findMany",
        where: { actividad_id: sourceId },
        select: { puesto_id: true },
      },
    });

    const puestoIds = Array.from(
      new Set(
        (Array.isArray(puestoLinks) ? puestoLinks : [])
          .map((l: { puesto_id?: number }) => Number(l.puesto_id))
          .filter((v) => Number.isFinite(v) && v > 0),
      ),
    );

    let puestosDuplicados = 0;
    if (puestoIds.length > 0) {
      await callDynamicPrisma({
        req,
        data: {
          action: "POST",
          table: "e_actividades_puesto",
          operation: "createMany",
          many: true,
          data: puestoIds.map((puesto_id) => ({
            actividad_id: newId,
            puesto_id,
          })),
        },
      });
      puestosDuplicados = puestoIds.length;
    }

    const createdBy = payload?.id ? Number(payload.id) : 0;
    await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_cambios_apps_modules",
        data: {
          nombre_tabla: "e_actividades",
          registro_id: newId,
          cambios: JSON.stringify([
            {
              prop: "__duplicated__",
              before: { source_actividad_id: sourceId },
              after: {
                id: newId,
                nombre_actividad: copyName,
                puestos_vinculados: puestosDuplicados,
              },
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
        message: "Actividad duplicada correctamente",
        actividad: newActivity,
        actividad_id: newId,
        puestos_duplicados: puestosDuplicados,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}
