import { NextRequest } from "next/server";
import { callDynamicPrisma } from "./callDynamicPrisma";
import { toZonedTime } from "date-fns-tz";

/** Plazas “vivas” alineadas con main_structure_cache (misma regla que dynamic-prisma/main-structure). */
export async function fetchActivePlazaIdsForPuestos(req: NextRequest, puestoIds: number[]): Promise<number[]> {
    const ids = Array.from(
        new Set(puestoIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))
    );
    if (ids.length === 0) return [];

    const nowCostaRica = toZonedTime(new Date(), "America/Costa_Rica");
    const rows = await callDynamicPrisma({
        req,
        data: {
            action: "GET",
            table: "e_estructura_plazas",
            operation: "findMany",
            where: {
                puesto_id: { in: ids },
                deleted: null,
                OR: [{ fecha_inactivacion: null }, { fecha_inactivacion: { gte: nowCostaRica } }],
            },
            select: { id: true },
        },
    });
    const arr = Array.isArray(rows) ? rows : [];
    return Array.from(
        new Set(
            arr
                .map((p: { id?: unknown }) => Number(p?.id))
                .filter((id: number) => Number.isFinite(id) && id > 0)
        )
    );
}

export async function sendNotificationByRole(req: NextRequest, corpoId: number, plazaSenders: number[], title: string, description: string, roles: string[]) {

    const receiver: number[] = [];
    const corpo = await callDynamicPrisma({
        req,
        data: { action: "GET", table: "e_estructura_sucursal", operation: "findUnique", where: { id: corpoId } }
    });
    if (corpo && corpo.id) {
        const puestos_corpo = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "e_estructura_puesto", operation: "findMany", where: { sucursal_id: corpo.id } }
        });

        const puestos_corpo_ids = puestos_corpo.map((puesto: { id: number }) => puesto.id);
        const plazas_puestos = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "e_estructura_plazas", operation: "findMany", where: { puesto_id: { in: puestos_corpo_ids } } }
        });

        const plazas_puestos_categoria_salarial_ids = plazas_puestos.map((plaza: { categoriaSalarial_id: number }) => plaza.categoriaSalarial_id != null ? plaza.categoriaSalarial_id : 0).filter((id: number) => id > 0);

        const categoria_salariales = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "pg_categoria_salarial", operation: "findMany", where: { id: { in: plazas_puestos_categoria_salarial_ids } } }
        });

        const categoria_salariales_categoria_empleado_ids = categoria_salariales.map((categoria_salarial: { categoriaEmpleado_id: number }) => categoria_salarial.categoriaEmpleado_id != null ? categoria_salarial.categoriaEmpleado_id : 0).filter((id: number) => id > 0);

        const categoria_empleados = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "pg_categoria_empleado", operation: "findMany", where: { id: { in: categoria_salariales_categoria_empleado_ids } } }
        });

        for (const plaza of plazas_puestos) {
            if (plaza.categoriaSalarial_id) {
                const categoria_salarial = categoria_salariales.find((categoria_salarial: { id: number }) => categoria_salarial.id === plaza.categoriaSalarial_id);

                if (categoria_salarial && categoria_salarial.categoriaEmpleado_id) {
                    const categoria_empleado = categoria_empleados.find((categoria_empleado: { id: number }) => categoria_empleado.id === categoria_salarial.categoriaEmpleado_id);

                    if (categoria_empleado) {
                        let role = "OPERATIVO";
                        switch (categoria_empleado.codigo) {
                            case "OFI":
                                role = "OPERATIVO";
                                break;
                            case "MIS":
                                role = "OPERATIVO";
                                break;
                            case "ADM":
                                role = "ADMINISTRATIVO";
                                break;
                            case "COO":
                                role = "SUPERVISOR";
                                break;
                            case "SUP":
                                role = "SUPERVISOR";
                                break;
                            case "OFC":
                                role = "OPERATIVO";
                                break;
                        }

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
            // Crear lista que excluya los resultados de receiver que no estén en plazaSenders
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
    }
}

export async function sendNotificationByPlaza(req: NextRequest, marcaDiaId: number, title: string, description: string, plazaIds: number[]) {
    try {
        const marcaDia = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "c_marca_dia", operation: "findUnique", where: { id: marcaDiaId } }
        });
        if (!marcaDia) {
            return;
        }

        const marcaDiaObj = marcaDia as any;
        const marcaDiaPlazaId = marcaDiaObj?.plaza_id;

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
                const notificationObj = notification as any;
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
    }
}