import { NextRequest, NextResponse } from "next/server";
import { toZonedTime } from 'date-fns-tz';
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";

export async function GET(req: NextRequest, context: { params: Promise<{ token: string }> }) {
    try {
        const resolvedParams = await context.params;
        const token = resolvedParams.token;

        // Desconvertir el token de base64 a string
        const token_recovery = await callDynamicPrisma({
            req,
            shouldVerifyAccessToken: false,
            data: {
                action: "GET",
                table: "a_recovery_password_token",
                operation: "findFirst",
                where: { token: token }
            }
        });

        if (!token_recovery) return NextResponse.json({ message: "Token no encontrado" });

        const tokenCreationDate = new Date(token_recovery.creacion);
        const expires_in_date = new Date(token_recovery.expira_en + tokenCreationDate.getTime());
        if (expires_in_date < toZonedTime(new Date(), "America/Costa_Rica")) {
            await callDynamicPrisma({
                req,
                shouldVerifyAccessToken: false,
                data: {
                    action: "DELETE",
                    table: "a_recovery_password_token",
                    where: { id: token_recovery.id },
                    returning: false
                }
            });
            return NextResponse.json({ status: false, message: "Token de recuperación de contraseña expirado" });
        }

        const empleado = await callDynamicPrisma({
            req,
            shouldVerifyAccessToken: false,
            data: {
                action: "GET",
                table: "c_empleado",
                operation: "findUnique",
                where: { id: token_recovery.empleadoId }
            }
        });
        if (!empleado) {
            await callDynamicPrisma({
                req,
                shouldVerifyAccessToken: false,
                data: {
                    action: "DELETE",
                    table: "a_recovery_password_token",
                    where: { id: token_recovery.id },
                    returning: false
                }
            });
            return NextResponse.json({ status: false, message: "Empleado no encontrado" });
        }

        return NextResponse.json({ status: true, message: "Token de recuperación de contraseña encontrado", empleado: empleado });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}