import { NextRequest } from "next/server";
import { callDynamicPrisma } from "./callDynamicPrisma";
import { toZonedTime } from "date-fns-tz";

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
        for (const puesto of puestos_corpo) {
            const plazas_puesto = await callDynamicPrisma({
                req,
                data: { action: "GET", table: "e_estructura_plazas", operation: "findMany", where: { puesto_id: puesto.id } }
            });
            for (const plaza of plazas_puesto) {
                if (plaza.categoriaSalarial_id) {
                    const categoria_salarial = await callDynamicPrisma({
                        req,
                        data: {
                            action: "GET",
                            table: "pg_categoria_salarial",
                            operation: "findFirst",
                            where: { id: plaza.categoriaSalarial_id }
                        }
                    });

                    if (categoria_salarial && categoria_salarial.categoriaEmpleado_id) {
                        const categoria_empleado = await callDynamicPrisma({
                            req,
                            data: {
                                action: "GET",
                                table: "pg_categoria_empleado",
                                operation: "findFirst",
                                where: { id: categoria_salarial.categoriaEmpleado_id }
                            }
                        });

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

                            console.log("role", role);

                            if (roles.includes(role)) {
                                console.log(8);
                                receiver.push(plaza.id);
                            }
                        }
                    }
                }
            }
        }
    }


    if (receiver.length > 0) {
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
            for (const plazaId of receiver) {
                if (!plazaSenders.includes(plazaId)) {
                    await callDynamicPrisma({
                        req,
                        data: {
                            action: "POST",
                            table: "c_plaza_notification",
                            data: {
                                plazaId: plazaId,
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

export async function sendNotificationByPlaza(req: NextRequest, marcaDiaId: number, title: string, description: string, plazaIds: number[]) {
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
            for (const plazaId of plazaIds) {
                if (plazaId != marcaDiaPlazaId) {
                    await callDynamicPrisma({
                        req,
                        data: {
                            action: "POST",
                            table: "c_plaza_notification",
                            data: {
                                plazaId: plazaId,
                                notificationId: notificationObj.id,
                                watched: false,
                            }
                        }
                    });
                }
            }
        }
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