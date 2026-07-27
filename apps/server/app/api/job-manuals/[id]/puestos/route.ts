import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { prisma } from "../../../../../utils/prismaClient";
import { fetchActivePlazaIdsForPuestos, sendNotificationByPlaza } from "../../../../../utils/sendNotification";
import { toZonedTime } from "date-fns-tz";

/**
 * Añade vínculos manual–puesto sin eliminar los existentes.
 * Solo crea relaciones en e_puestos_manual_puesto para puestos válidos aún no vinculados.
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
        if (!valid) {
            return NextResponse.json({ status: false, expired, message }, { status: expired ? 401 : 403 });
        }

        const resolvedParams = await context.params;
        const manualId = Number(resolvedParams.id);
        if (!Number.isFinite(manualId) || manualId <= 0) {
            return NextResponse.json({ status: false, message: "Manual inválido" }, { status: 200 });
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

        const marcaRow = await prisma.c_marca_dia.findUnique({
            where: { id: marcaId },
            select: { id: true },
        });
        if (!marcaRow) {
            return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 200 });
        }

        const manual = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "e_manual_puesto",
                operation: "findUnique",
                where: { id: manualId },
                select: { id: true, title: true },
            },
        });
        if (!manual) {
            return NextResponse.json({ status: false, message: "Manual no encontrado" }, { status: 200 });
        }

        const existingRows = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "e_puestos_manual_puesto",
                operation: "findMany",
                where: { manual_puesto_id: manualId },
                select: { puesto_id: true },
            },
        });
        const alreadyLinked = new Set(
            (Array.isArray(existingRows) ? existingRows : [])
                .map((r: { puesto_id?: number }) => Number(r?.puesto_id))
                .filter((v: number) => Number.isFinite(v) && v > 0)
        );

        const existingPuestos = await prisma.e_estructura_puesto.findMany({
            where: { id: { in: requestedUnique } },
            select: { id: true },
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
        const manualTitle = String((manual as { title?: string }).title || "manual");

        if (toCreate.length > 0) {
            await callDynamicPrisma({
                req,
                data: {
                    action: "POST",
                    table: "e_puestos_manual_puesto",
                    operation: "createMany",
                    many: true,
                    data: toCreate.map((puesto_id) => ({
                        manual_puesto_id: manualId,
                        puesto_id,
                    })),
                },
            });

            const existingPuestoIds = Array.from(alreadyLinked);
            const plazaIdsAlreadyOnManual = new Set(await fetchActivePlazaIdsForPuestos(req, existingPuestoIds));
            const newPlazaCandidates = await fetchActivePlazaIdsForPuestos(req, toCreate);
            const plazas_ids = newPlazaCandidates.filter((pid) => !plazaIdsAlreadyOnManual.has(pid));

            const created_at = toZonedTime(new Date(), "America/Costa_Rica");
            const fecha_string = created_at.toISOString().split("T")[0];
            const hora_string = created_at.toISOString().split("T")[1].split(".")[0];

            if (plazas_ids.length > 0) {
                await sendNotificationByPlaza(
                    req,
                    marcaId,
                    "Manual de puesto",
                    `Se te ha vinculado el manual «${manualTitle}» el día ${fecha_string} a las ${hora_string}`,
                    plazas_ids
                );
            }

            const createdBy = payload?.id ? Number(payload.id) : 0;
            await callDynamicPrisma({
                req,
                data: {
                    action: "POST",
                    table: "c_cambios_apps_modules",
                    data: {
                        nombre_tabla: "e_manual_puesto",
                        registro_id: manualId,
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
                        created_at: created_at.toISOString(),
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
        console.error("Error in POST /api/job-manuals/[id]/puestos:", errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}
