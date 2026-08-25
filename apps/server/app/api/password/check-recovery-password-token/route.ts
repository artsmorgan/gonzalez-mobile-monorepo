import { NextRequest, NextResponse } from "next/server";
import { toZonedTime } from 'date-fns-tz';
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";
import { prisma } from "../../../../utils/prismaClient";
import axios from "axios";

// Obtener la cédula de los parámetros de la URL que surgen de ?cedula=XXXXXXXXX
export async function GET(req: NextRequest) {
    try {
        const token = req.nextUrl.searchParams.get("token");
        const cedula = req.nextUrl.searchParams.get("cedula");

        if (!cedula) {
            return NextResponse.json({ message: "Cédula no válida" });
        }

        if (!token) {
            return NextResponse.json({ message: "Token no válido" });
        }

        const empleado = await prisma.c_empleado.findFirst({ where: { cedula: cedula } });
        if (!empleado) {
            return NextResponse.json({ message: "Empleado no encontrado" });
        }

        const planillasUrl = String(process.env.PLANILLAS_URL || "").trim().replace(/\/+$/, "");
        if (!planillasUrl) {
            return NextResponse.json(
                { status: false, message: "URL de Planillas no configurada" }
            );
        }


        const planillasResponse = await axios.post(`${planillasUrl}/recover-password/validate`, {
            correo_usuario: empleado.Email,
            codigo: token,
        });

        // Respuesta esperada: {"success":true,"data":{"valido":true,"expires_in":823}}

        if (planillasResponse.status !== 200 || !planillasResponse.data.success) {
            return NextResponse.json(
                { status: false, message: planillasResponse.data.message }
            );
        }

        let now = toZonedTime(new Date(), "America/Costa_Rica");
        //now = new Date(now.getTime() - 6 * 60 * 60 * 1000); // Restarle 6 horas para que sea en la zona horaria de Costa Rica
        // Crear el token de recuperación de contraseña
        const token_recovery = await callDynamicPrisma({
            req,
            shouldVerifyAccessToken: false,
            data: {
                action: "POST",
                table: "a_recovery_password_token",
                data: {
                    token: token,
                    empleadoId: empleado.id,
                    expira_en: planillasResponse.data.data.expires_in * 1000, // En milisegundos
                    creacion: now,
                },
            }
        });

        return NextResponse.json({ status: true, message: "Token de recuperación de contraseña encontrado", empleado: empleado });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}