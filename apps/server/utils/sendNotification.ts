import { prisma } from "./prismaClient";
import { toZonedTime } from "date-fns-tz";

export async function sendNotificationByRole(marcaDiaId: number, title: string, description: string, roles: string[]) {
    const marcaDia = await prisma.c_marca_dia.findUnique({ where: { id: marcaDiaId } });
    if (!marcaDia) {
        return;
    }

    const receiver: number[] = [];
    const corpo = await prisma.e_estructura_sucursal.findUnique({ where: { id: marcaDia.corpo_id } });
    if (corpo && corpo.id) {
        const puestos_corpo = await prisma.e_estructura_puesto.findMany({ where: { sucursal_id: corpo.id } });
        for (const puesto of puestos_corpo) {
            const plazas_puesto = await prisma.e_estructura_plazas.findMany({ where: { puesto_id: puesto.id } });
            for (const plaza of plazas_puesto) {
                if (plaza.categoriaSalarial_id) {
                    const categoria_salarial = await prisma.pg_categoria_salarial.findFirst({
                        where: {
                            id: plaza.categoriaSalarial_id
                        }
                    });

                    if (categoria_salarial && categoria_salarial.categoriaEmpleado_id) {
                        const categoria_empleado = await prisma.pg_categoria_empleado.findFirst({
                            where: {
                                id: categoria_salarial.categoriaEmpleado_id
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

                            if (roles.includes(role)) {
                                receiver.push(plaza.id);
                            }
                        }
                    }
                }
            }
        }
    }

    if (receiver.length > 0) {
        const notification = await prisma.c_notifications.create({
            data: {
                title: title,
                description: description,
                created_at: toZonedTime(new Date(), "America/Costa_Rica"),
            }
        });

        if (notification) {
            for (const plazaId of receiver) {
                if (plazaId != marcaDia.plaza_id) {
                    await prisma.c_plaza_notification.create({
                        data: {
                            plazaId: plazaId,
                            notificationId: notification.id,
                            watched: false,
                        }
                    });
                }
            }
        }
    }
}

export async function sendNotificationByPlaza(marcaDiaId: number, title: string, description: string, plazaIds: number[]) {
    const marcaDia = await prisma.c_marca_dia.findUnique({ where: { id: marcaDiaId } });
    if (!marcaDia) {
        return;
    }

    if (plazaIds.length > 0) {
        const notification = await prisma.c_notifications.create({
            data: {
                title: title,
                description: description,
                created_at: toZonedTime(new Date(), "America/Costa_Rica"),
            }
        });

        if (notification) {
            for (const plazaId of plazaIds) {
                if (plazaId != marcaDia.plaza_id) {
                    await prisma.c_plaza_notification.create({
                        data: {
                            plazaId: plazaId,
                            notificationId: notification.id,
                            watched: false,
                        }
                    });
                }
            }
        }
    }
}

export async function sendNotificationByEmployee(marcaDiaId: number, title: string, description: string, employeeIds: number[]) {
    const marcaDia = await prisma.c_marca_dia.findUnique({ where: { id: marcaDiaId } });
    if (!marcaDia) {
        return;
    }

    if (employeeIds.length > 0) {
        const notification = await prisma.c_notifications.create({
            data: {
                title: title,
                description: description,
                created_at: toZonedTime(new Date(), "America/Costa_Rica"),
            }
        });

        if (notification) {
            for (const employeeId of employeeIds) {
                if (employeeId != marcaDia.empleadoFijo_id) {
                    await prisma.c_empleado_notification.create({
                        data: {
                            empleadoId: employeeId,
                            notificationId: notification.id,
                            watched: false,
                        }
                    });
                }
            }
        }
    }
}