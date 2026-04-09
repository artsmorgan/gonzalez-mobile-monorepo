import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../../utils/callDynamicPrisma";
import { fetchActivePlazaIdsForPuestos, sendNotificationByPlaza } from "../../../../../../utils/sendNotification";
import { toZonedTime } from "date-fns-tz";

/**
 * Añade vínculos actividad–puesto sin eliminar los existentes.
 * Solo crea relaciones para puestos válidos que aún no estén vinculados.
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
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

    const { marca_id, puestos_ids } = await req.json();
    const marcaId = Number(marca_id);
    if (!Number.isFinite(marcaId) || marcaId <= 0) {
      return NextResponse.json({ status: false, message: "Marca inválida" }, { status: 200 });
    }
    if (!Array.isArray(puestos_ids) || puestos_ids.length === 0) {
      return NextResponse.json({ status: false, message: "Debes enviar al menos un puesto" }, { status: 200 });
    }

    const requestedUnique = Array.from(
      new Set(
        puestos_ids
          .map((p: unknown) => Number(p))
          .filter((v: number) => Number.isFinite(v) && v > 0)
      )
    );

    if (requestedUnique.length === 0) {
      return NextResponse.json({ status: false, message: "No hay identificadores de puesto válidos" }, { status: 200 });
    }

    const marcaRow = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_marca_dia",
        operation: "findUnique",
        where: { id: marcaId },
        select: { id: true },
      },
    });
    if (!marcaRow) {
      return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 200 });
    }

    const actividad = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "e_actividades",
        operation: "findUnique",
        where: { id: actividadId },
      },
    });
    if (!actividad) {
      return NextResponse.json({ status: false, message: "Actividad no encontrada" }, { status: 200 });
    }

    const existingRows = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "e_actividades_puesto",
        operation: "findMany",
        where: { actividad_id: actividadId },
        select: { puesto_id: true },
      },
    });
    const alreadyLinked = new Set(
      (Array.isArray(existingRows) ? existingRows : [])
        .map((r: { puesto_id?: number }) => Number(r?.puesto_id))
        .filter((v: number) => Number.isFinite(v) && v > 0)
    );

    const existingPuestos = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "e_estructura_puesto",
        operation: "findMany",
        where: { id: { in: requestedUnique } },
        select: { id: true },
      },
    });
    const confirmedIds = new Set(
      (Array.isArray(existingPuestos) ? existingPuestos : [])
        .map((p: { id?: number }) => Number(p?.id))
        .filter((v: number) => Number.isFinite(v) && v > 0)
    );

    const missing = requestedUnique.filter((id) => !confirmedIds.has(id));
    if (missing.length > 0) {
      return NextResponse.json(
        {
          status: false,
          message: `Uno o más puestos no existen: ${missing.slice(0, 10).join(", ")}${missing.length > 10 ? "…" : ""}`,
        },
        { status: 200 }
      );
    }

    const toCreate = requestedUnique.filter((id) => !alreadyLinked.has(id));

    if (toCreate.length > 0) {
      await callDynamicPrisma({
        req,
        data: {
          action: "POST",
          table: "e_actividades_puesto",
          operation: "createMany",
          many: true,
          data: toCreate.map((puesto_id) => ({
            actividad_id: actividadId,
            puesto_id,
          })),
        },
      });

      const existingPuestoIds = Array.from(alreadyLinked);
      const plazaIdsAlreadyOnActivity = new Set(await fetchActivePlazaIdsForPuestos(req, existingPuestoIds));
      const newPlazaCandidates = await fetchActivePlazaIdsForPuestos(req, toCreate);
      const plazas_ids = newPlazaCandidates.filter((id) => !plazaIdsAlreadyOnActivity.has(id));

      let freqTitle = "según calendario";
      try {
        const raw = (actividad as { frecuencia?: string }).frecuencia;
        const fp = typeof raw === "string" && raw.trim() ? JSON.parse(raw) : raw;
        if (fp && typeof fp.title === "string" && fp.title.trim()) freqTitle = fp.title;
      } catch {
        /* ignore */
      }

      const nombre = String((actividad as { nombre_actividad?: string }).nombre_actividad || "actividad");
      if (plazas_ids.length > 0) {
        await sendNotificationByPlaza(
          req,
          marcaId,
          "Actividad asignada",
          `Se te ha asignado la actividad ${nombre}, la cual deberá realizarse "${freqTitle}"`,
          plazas_ids
        );
      }
    }

    if (toCreate.length > 0) {
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
                prop: "__puestos_agregados__",
                before: { puestos_vinculados: Array.from(alreadyLinked) },
                after: {
                  agregados: toCreate,
                  omitidos_ya_vinculados: requestedUnique.filter((id) => alreadyLinked.has(id)),
                },
              },
            ]),
            created_at: toZonedTime(new Date(), "America/Costa_Rica").toISOString(),
            created_by: createdBy,
          },
        },
      });
    }

    return NextResponse.json(
      {
        status: true,
        message:
          toCreate.length > 0
            ? `Se vincularon ${toCreate.length} puesto(s) nuevo(s). Los que ya estaban asignados no se modificaron.`
            : "Todos los puestos indicados ya estaban vinculados; no hubo cambios.",
        created_count: toCreate.length,
        skipped_already_linked: requestedUnique.filter((id) => alreadyLinked.has(id)).length,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}
