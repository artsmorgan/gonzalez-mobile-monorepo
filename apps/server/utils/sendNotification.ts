import { NextRequest } from "next/server";
import { callDynamicPrisma } from "./callDynamicPrisma";
import { prisma } from "./prismaClient";
import { toZonedTime } from "date-fns-tz";
import { sendPushToEmpleados, sendPushToPlazas } from "./pushNotifications";

function resolveRoleNameFromCodigo(codigo: string | null | undefined): string {
    switch (codigo) {
        case "ADM":
            return "ADMINISTRATIVO";
        case "COO":
        case "SUP":
            return "SUPERVISOR";
        default:
            return "OPERATIVO";
    }
}

/** Plazas “vivas” alineadas con main_structure_cache (misma regla que dynamic-prisma/main-structure). */
export async function fetchActivePlazaIdsForPuestos(_req: NextRequest, puestoIds: number[]): Promise<number[]> {
    const ids = Array.from(
        new Set(puestoIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))
    );
    if (ids.length === 0) return [];

    const nowCostaRica = toZonedTime(new Date(), "America/Costa_Rica");
    const rows = await prisma.e_estructura_plazas.findMany({
        where: {
            puesto_id: { in: ids },
            deleted: null,
            OR: [{ fecha_inactivacion: null }, { fecha_inactivacion: { gte: nowCostaRica } }],
        },
        select: { id: true },
    });
    return Array.from(
        new Set(
            rows
                .map((p) => Number(p.id))
                .filter((id) => Number.isFinite(id) && id > 0)
        )
    );
}

export async function sendNotificationByRole(req: NextRequest, corpoId: number, plazaSenders: number[], title: string, description: string, roles: string[]) {

    const receiver: number[] = [];
    const corpo = await prisma.e_estructura_sucursal.findUnique({ where: { id: corpoId } });
    if (corpo?.id) {
        const puestos_corpo = await prisma.e_estructura_puesto.findMany({ where: { sucursal_id: corpo.id } });

        const puestos_corpo_ids = puestos_corpo.map((puesto) => puesto.id);
        const plazas_puestos = puestos_corpo_ids.length
            ? await prisma.e_estructura_plazas.findMany({ where: { puesto_id: { in: puestos_corpo_ids } } })
            : [];

        const plazas_puestos_categoria_salarial_ids = plazas_puestos
            .map((plaza) => (plaza.categoriaSalarial_id != null ? plaza.categoriaSalarial_id : 0))
            .filter((id) => id > 0);

        const categoria_salariales = plazas_puestos_categoria_salarial_ids.length
            ? await prisma.pg_categoria_salarial.findMany({
                where: { id: { in: plazas_puestos_categoria_salarial_ids } },
            })
            : [];

        const categoria_salariales_categoria_empleado_ids = categoria_salariales
            .map((categoria_salarial) =>
                categoria_salarial.categoriaEmpleado_id != null ? categoria_salarial.categoriaEmpleado_id : 0
            )
            .filter((id) => id > 0);

        const categoria_empleados = categoria_salariales_categoria_empleado_ids.length
            ? await prisma.pg_categoria_empleado.findMany({
                where: { id: { in: categoria_salariales_categoria_empleado_ids } },
            })
            : [];

        for (const plaza of plazas_puestos) {
            if (plaza.categoriaSalarial_id) {
                const categoria_salarial = categoria_salariales.find(
                    (cs) => cs.id === plaza.categoriaSalarial_id
                );

                if (categoria_salarial?.categoriaEmpleado_id) {
                    const categoria_empleado = categoria_empleados.find(
                        (ce) => ce.id === categoria_salarial.categoriaEmpleado_id
                    );

                    if (categoria_empleado) {
                        const role = resolveRoleNameFromCodigo(categoria_empleado.codigo);

                        if (roles.includes(role)) {
                            receiver.push(plaza.id);
                        }
                    }
                }
            }
        }
    }

    if (receiver.length > 0) {
        console.log("sendNotificationByRole");
        const notification = await callDynamicPrisma({
            req,
            data: {
                action: "POST",
                table: "c_notifications",
                data: {
                    title: title,
                    description: description,
                    created_at: toZonedTime(new Date(), "America/Costa_Rica").toISOString(),
                }
            }
        });

        if (notification) {
            const receiverIds = receiver.filter((plazaId) => !plazaSenders.includes(plazaId));
            if (receiverIds.length > 0) {
                await callDynamicPrisma({
                    req,
                    data: {
                        action: "POST",
                        table: "c_plaza_notification",
                        operation: "createMany",
                        many: true,
                        data: receiverIds.map((plazaId) => ({
                            plazaId: plazaId,
                            notificationId: notification.id,
                            watched: false,
                        })),
                    }
                });
            }
        }

        // Push FCM a dispositivos registrados en las plazas receptoras
        const fcmPlazaIds = receiver.filter((plazaId) => !plazaSenders.includes(plazaId));
        if (fcmPlazaIds.length > 0) {
            void sendPushToPlazas(req, fcmPlazaIds, {
                title,
                body: description,
                data: { type: "notification", action: "open", channelId: "general" },
                channelId: "general",
            })
                .then((r) =>
                    console.log("[sendNotificationByRole] FCM result", {
                        plazas: fcmPlazaIds.length,
                        ...r,
                    })
                )
                .catch((err) => console.error("[sendNotificationByRole] FCM:", err));
        }
    }
}

export async function sendNotificationByPlaza(req: NextRequest, marcaDiaId: number, title: string, description: string, plazaIds: number[]) {
    try {
        const marcaDia = await prisma.c_marca_dia.findUnique({ where: { id: marcaDiaId } });
        if (!marcaDia) {
            return;
        }

        const marcaDiaPlazaId = marcaDia.plaza_id;

        if (plazaIds.length > 0) {
            const notification = await callDynamicPrisma({
                req,
                data: {
                    action: "POST",
                    table: "c_notifications",
                    data: {
                        title: title,
                        description: description,
                        created_at: toZonedTime(new Date(), "America/Costa_Rica").toISOString(),
                    }
                }
            });

            if (notification) {
                const notificationObj = notification as { id?: number };
                const targetPlazaIds = Array.from(
                    new Set(
                        plazaIds
                            .map((id) => Number(id))
                            .filter((id) => Number.isFinite(id) && id > 0 && id !== Number(marcaDiaPlazaId))
                    )
                );

                if (targetPlazaIds.length > 0) {
                    await callDynamicPrisma({
                        req,
                        data: {
                            action: "POST",
                            table: "c_plaza_notification",
                            operation: "createMany",
                            many: true,
                            data: targetPlazaIds.map((plazaId) => ({
                                plazaId,
                                notificationId: notificationObj.id,
                                watched: false,
                            })),
                        }
                    });
                }
            }
        }

        // Push FCM a dispositivos de las plazas objetivo
        const fcmPlazaIds = Array.from(
            new Set(
                plazaIds
                    .map((id) => Number(id))
                    .filter((id) => Number.isFinite(id) && id > 0 && id !== Number(marcaDiaPlazaId))
            )
        );
        if (fcmPlazaIds.length > 0) {
            void sendPushToPlazas(req, fcmPlazaIds, {
                title,
                body: description,
                data: { type: "notification", action: "open", channelId: "general" },
                channelId: "general",
            })
                .then((r) =>
                    console.log("[sendNotificationByPlaza] FCM result", {
                        excludedSenderPlaza: marcaDiaPlazaId,
                        plazas: fcmPlazaIds.length,
                        ...r,
                    })
                )
                .catch((err) => console.error("[sendNotificationByPlaza] FCM:", err));
        } else {
            console.log(
                "[sendNotificationByPlaza] Sin destinatarios FCM (solo plaza emisor o sin plazas)",
                { excludedSenderPlaza: marcaDiaPlazaId }
            );
        }
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
    }
}

export async function sendNotificationByEmployee(req: NextRequest, corpoId: number, empleadoSenderIds: number[], title: string, description: string, employeeIds: number[]) {
    if (employeeIds.length > 0) {
        const notification = await callDynamicPrisma({
            req,
            data: {
                action: "POST",
                table: "c_notifications",
                data: {
                    title: title,
                    description: description,
                    created_at: toZonedTime(new Date(), "America/Costa_Rica").toISOString(),
                }
            }
        });

        if (notification) {
            for (const employeeId of employeeIds) {
                if (!empleadoSenderIds.includes(employeeId)) {
                    await callDynamicPrisma({
                        req,
                        data: {
                            action: "POST",
                            table: "c_empleado_notification",
                            data: {
                                empleadoId: employeeId,
                                notificationId: notification.id,
                                watched: false,
                            }
                        }
                    });
                }
            }
        }

        const fcmEmployeeIds = employeeIds.filter((id) => !empleadoSenderIds.includes(id));
        if (fcmEmployeeIds.length > 0) {
            void sendPushToEmpleados(req, fcmEmployeeIds, {
                title,
                body: description,
                data: { type: "notification", action: "open", channelId: "general" },
                channelId: "general",
            })
                .then((r) =>
                    console.log("[sendNotificationByEmployee] FCM result", {
                        empleados: fcmEmployeeIds.length,
                        ...r,
                    })
                )
                .catch((err) => console.error("[sendNotificationByEmployee] FCM:", err));
        }
    }
}
