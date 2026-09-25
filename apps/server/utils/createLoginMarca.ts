import { callDynamicPrisma } from "./callDynamicPrisma";
import { NextRequest } from "next/server";
import { toZonedTime } from "date-fns-tz";
import { prisma } from "./prismaClient";

export async function createLoginMarca(req: NextRequest, id: number, now: Date, deviceName: string, sessionId: string, cords: { lat: string | null, lng: string | null }) {
    try {
        const now = toZonedTime(new Date(), "America/Costa_Rica");

        const empleado = await prisma.c_empleado.findUnique({ where: { id: id } });
        if (!empleado) {
            return { status: false, message: "Empleado no encontrado" };
        }

        const loginMarca = await callDynamicPrisma({
            req,
            data: { action: "POST", table: "c_login_marca_almuerzo", operation: "create", data: {
                nombre_empleado: empleado.nombre + " " + empleado.primer_apellido + " " + empleado.segundo_apellido,
                cedula_empleado: empleado.cedula,
                fecha_hora: now,
                device: deviceName,
                session_id: sessionId,
                lat: cords.lat,
                lng: cords.lng
            } }
        });

        return loginMarca;
    } catch (error: unknown) {
        console.error("Error al crear la marca de login", error);
        return null;
    }
}