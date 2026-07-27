/* eslint-disable @typescript-eslint/no-require-imports */
import { NextRequest, NextResponse } from "next/server";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { toZonedTime } from "date-fns-tz";
import { prisma } from "../../../../../utils/prismaClient";
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
        const empleado = await prisma.c_empleado.findUnique({ where: { id: token_recovery.empleadoId ?? 0 } });
        if (!empleado) return NextResponse.json({ status: false, message: "Empleado no encontrado" });
        const password_expires_at = empleado.password_expires_at;
        
        const now = toZonedTime(new Date(), "America/Costa_Rica");
        const newDateExpiresAt = toZonedTime(new Date(now.getTime() + 2 * 30 * 24 * 60 * 60 * 1000), "America/Costa_Rica");

        const hashedPassword = await bcrypt.hash(password, 10);
        await prisma.c_empleado.update({ where: { id: token_recovery.empleadoId ?? 0 }, data: { password: hashedPassword, password_expires_at: newDateExpiresAt } });
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