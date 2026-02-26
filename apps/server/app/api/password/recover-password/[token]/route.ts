/* eslint-disable @typescript-eslint/no-require-imports */
import { NextRequest, NextResponse } from "next/server";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
const bcrypt = require('bcrypt');

export async function PUT(req: NextRequest, context: { params: Promise<{ token: string }> }) {
    try {
        const resolvedParams = await context.params;
        const token = resolvedParams.token;
        const { password } = await req.json();
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
        if (!token_recovery) return NextResponse.json({ status: false, message: "Token de recuperación de contraseña no encontrado" });
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
        if (!empleado) return NextResponse.json({ status: false, message: "Empleado no encontrado" });
        const hashedPassword = await bcrypt.hash(password, 10);
        await callDynamicPrisma({
            req,
            shouldVerifyAccessToken: false,
            data: {
                action: "UPDATE",
                table: "c_empleado",
                where: { id: token_recovery.empleadoId },
                data: { password: hashedPassword },
                returning: false
            }
        });
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
        // Retornar éxito con la contraseña actualizada
        return NextResponse.json({ status: true, message: "Contraseña actualizada" });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ status: false, message: errorMessage });
    }
}