import { NextRequest } from "next/server";
import { toZonedTime } from "date-fns-tz";
import { callDynamicPrisma } from "./callDynamicPrisma";
import { getMonitoringPreviousMinutes } from "./getMonitoringPreviousMinutes";

export async function getUserMarca(req: NextRequest, id: number) {
    try {
        const now = toZonedTime(new Date(), "America/Costa_Rica");
        const monitoringPreviousMinutes = await getMonitoringPreviousMinutes(req);
        const nowPlusMonitoringWindow = new Date(now.getTime() + monitoringPreviousMinutes * 60 * 1000);

        // Paso 1: Buscar si existe un registro dentro de la ventana previa al inicio
        const proximo = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_marca_dia",
                operation: "findFirst",
                where: {
                    empleadoFijo_id: id,
                    // fecha + hora_inicio >= now
                    OR: [
                        {
                            fecha: {
                                gt: now, // fecha futura
                            },
                        },
                        {
                            fecha: {
                                equals: new Date(now.toISOString().split("T")[0]),
                            },
                            hora_inicio: {
                                gte: new Date("1970-01-01 " + now.toTimeString().slice(0, 8)),
                            },
                        },
                    ],
                },
                orderBy: [
                    { fecha: "asc" },
                    { hora_inicio: "asc" },
                ],
            },
        });

        console.log("Primer paso");

        // Si existe uno futuro, validar si está dentro del rango configurado
        if (proximo) {
            // Convertimos la fecha + hora_inicio en un solo Date
            const proximoDateTime = new Date(`${proximo.fecha}T${proximo.hora_inicio}`);

            if (proximoDateTime <= nowPlusMonitoringWindow) {
                return proximo;
            }
        }

        // Paso 2: Si no hay ninguno dentro de la ventana, tomar el último anterior
        const ultimo = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_marca_dia",
                operation: "findFirst",
                where: {
                    empleadoFijo_id: id,
                    OR: [
                        {
                            fecha: {
                                lt: now, // fecha pasada
                            },
                        },
                        {
                            fecha: {
                                equals: new Date(now.toISOString().split("T")[0]),
                            },
                            hora_inicio: {
                                lt: new Date("1970-01-01 " + now.toTimeString().slice(0, 8)),
                            },
                        },
                    ],
                },
                orderBy: [
                    { fecha: "desc" },
                    { hora_inicio: "desc" },
                ],
            },
        });

        console.log("Segundo paso");

        if (!ultimo) {
            return null;
        }

        return ultimo;
    } catch (error) {
        console.error("Error al obtener la marca del usuario", error);
        return null;
    }
}