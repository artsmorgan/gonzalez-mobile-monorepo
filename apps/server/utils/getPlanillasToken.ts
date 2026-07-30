import { NextRequest } from "next/server";
import { callDynamicPrisma } from "./callDynamicPrisma";
import axios from "axios";
import { toZonedTime } from "date-fns-tz";
import { prisma } from "./prismaClient";

export async function getPlanillasToken(req: NextRequest, empleado_id: number) {
    // findFirst
    let mobile_token = await callDynamicPrisma({
        req,
        data: {
            action: "GET",
            table: "a_mobile_token_for_planillas",
            operation: "findFirst",
            where: { empleado_id: empleado_id }
        }
    });
    let now = toZonedTime(new Date(), "America/Costa_Rica");
    //now = new Date(now.getTime() - 6 * 60 * 60 * 1000); // Restarle 6 horas para que sea en la zona horaria de Costa Rica
    if (!mobile_token || new Date(mobile_token.expires_at) < now) {
        mobile_token = await createTokenPlanillas(req, empleado_id, mobile_token?.id ?? 0);
    }
    return mobile_token.token;
}

async function createTokenPlanillas(req: NextRequest, empleado_id: number, mobile_token_id: number) {
    const planillasUrl = process.env.PLANILLAS_URL;
    if (!planillasUrl) {
        throw new Error("PLANILLAS_URL no configurado");
    }
    const empleado = await prisma.c_empleado.findUnique({ where: { id: empleado_id } });
    if (!empleado) {
        throw new Error("Empleado no encontrado");
    }
    const response = await axios.post(`${planillasUrl}/login`, {
        username: empleado.cedula,
        password: ""
    });
    if (!response.data.success) {
        throw new Error("Error al iniciar sesión en Planillas");
    }
    let now = toZonedTime(new Date(), "America/Costa_Rica");
    //now = new Date(now.getTime() - 6 * 60 * 60 * 1000); // Restarle 6 horas para que sea en la zona horaria de Costa Rica
    let expires_at = new Date(now.getTime() + response.data.data.expires_in * 1000);

    // Crear o actualizar el token en la base de datos
    let new_mobile_token: any;
    if (mobile_token_id > 0) {
        new_mobile_token = await callDynamicPrisma({
            req,
            data: {
                action: "UPDATE",
                table: "a_mobile_token_for_planillas",
                where: { id: mobile_token_id },
                data: { token: response.data.data.token, created_at: now, expires_at: expires_at }
            }
        });
    }
    else {
        new_mobile_token = await callDynamicPrisma({
            req,
            data: {
                action: "POST",
                table: "a_mobile_token_for_planillas",
                data: { empleado_id: empleado_id, token: response.data.data.token, created_at: now, expires_at: expires_at }
            }
        });
    }
    if (!new_mobile_token) {
        throw new Error("Error al crear token en Planillas");
    }
    return new_mobile_token;
}