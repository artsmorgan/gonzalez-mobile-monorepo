import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { prisma } from "../../../../../utils/prismaClient";
import { sendNotificationByEmployee } from "../../../../../utils/sendNotification";
import { toZonedTime } from "date-fns-tz";
import { reportError } from "../../../../../utils/reportError";

/**
 * Añade vínculos manual–empleado sin eliminar los existentes.
 * Solo crea relaciones en e_empleados_manual_puesto para empleados válidos aún no vinculados.
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
            await reportError(req, "api/job-manuals/[id]/empleados", "POST", 400, "Manual inválido");
            return NextResponse.json({ status: false, message: "Manual inválido" }, { status: 400 });
        }

        const { marca_id, empleados_ids } = await req.json();
        const marcaId = Number(marca_id);
        if (!Number.isFinite(marcaId) || marcaId <= 0) {
            await reportError(req, "api/job-manuals/[id]/empleados", "POST", 400, "Marca inválida");
            return NextResponse.json({ status: false, message: "Marca inválida" }, { status: 400 });
        }
        if (!Array.isArray(empleados_ids) || empleados_ids.length === 0) {
            await reportError(req, "api/job-manuals/[id]/empleados", "POST", 400, "Debes enviar al menos un empleado");
            return NextResponse.json({ status: false, message: "Debes enviar al menos un empleado" }, { status: 400 });
        }

        const requestedUnique = Array.from(
            new Set(
                empleados_ids
                    .map((p: unknown) => Number(p))
                    .filter((v: number) => Number.isFinite(v) && v > 0)
            )
        );

        if (requestedUnique.length === 0) {
            await reportError(req, "api/job-manuals/[id]/empleados", "POST", 400, "No hay identificadores de empleado válidos");
            return NextResponse.json({ status: false, message: "No hay identificadores de empleado válidos" }, { status: 400 });
        }

        const marcaRow = await prisma.c_marca_dia.findUnique({
            where: { id: marcaId },
            select: { id: true },
        });
        if (!marcaRow) {
            await reportError(req, "api/job-manuals/[id]/empleados", "POST", 404, "Marca no encontrada");
            return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 404 });
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
            await reportError(req, "api/job-manuals/[id]/empleados", "POST", 404, "Manual no encontrado");
            return NextResponse.json({ status: false, message: "Manual no encontrado" }, { status: 404 });
        }

        const existingRows = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "e_empleados_manual_puesto",
                operation: "findMany",
                where: { manual_puesto_id: manualId },
                select: { empleado_id: true },
            },
        });
        const alreadyLinked = new Set(
            (Array.isArray(existingRows) ? existingRows : [])
                .map((r: { empleado_id?: number }) => Number(r?.empleado_id))
                .filter((v: number) => Number.isFinite(v) && v > 0)
        );

        const existingEmpleados = await prisma.c_empleado.findMany({
            where: { id: { in: requestedUnique } },
            select: { id: true },
        });
        const confirmedIds = new Set(
            (Array.isArray(existingEmpleados) ? existingEmpleados : [])
                .map((p: { id?: number }) => Number(p?.id))
                .filter((v: number) => Number.isFinite(v) && v > 0)
        );

        const missing = requestedUnique.filter((id) => !confirmedIds.has(id));
        if (missing.length > 0) {
            const missingMessage = `Uno o más empleados no existen: ${missing.slice(0, 10).join(", ")}${missing.length > 10 ? "…" : ""}`;
            await reportError(req, "api/job-manuals/[id]/empleados", "POST", 404, missingMessage);
            return NextResponse.json(
                {
                    status: false,
                    message: missingMessage,
                },
                { status: 404 }
            );
        }

        const toCreate = requestedUnique.filter((id) => !alreadyLinked.has(id));
        const manualTitle = String((manual as { title?: string }).title || "manual");

        if (toCreate.length > 0) {
            await callDynamicPrisma({
                req,
                data: {
                    action: "POST",
                    table: "e_empleados_manual_puesto",
                    operation: "createMany",
                    many: true,
                    data: toCreate.map((empleado_id) => ({
                        manual_puesto_id: manualId,
                        empleado_id,
                    })),
                },
            });

            const created_at = toZonedTime(new Date(), "America/Costa_Rica");
            const fecha_string = created_at.toISOString().split("T")[0];
            const hora_string = created_at.toISOString().split("T")[1].split(".")[0];

            try {
                await sendNotificationByEmployee(
                    req,
                    marcaId,
                    [],
                    "Manual de puesto",
                    `Se te ha vinculado el manual «${manualTitle}» el día ${fecha_string} a las ${hora_string}`,
                    toCreate
                );
            } catch (err) {
                console.warn("Fallo enviando notificación a empleados vinculados (no bloquea el vínculo):", err);
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
                                prop: "__empleados_agregados__",
                                before: { empleados_vinculados: Array.from(alreadyLinked) },
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
                        ? `Se vincularon ${toCreate.length} empleado(s) nuevo(s). Los que ya estaban asignados no se modificaron.`
                        : "Todos los empleados indicados ya estaban vinculados; no hubo cambios.",
                created_count: toCreate.length,
                skipped_already_linked: requestedUnique.filter((id) => alreadyLinked.has(id)).length,
            },
            { status: 200 }
        );
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error("Error in POST /api/job-manuals/[id]/empleados:", errorMessage);
        await reportError(req, "api/job-manuals/[id]/empleados", "POST", 500, errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}
