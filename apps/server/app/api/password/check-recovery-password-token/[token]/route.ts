import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(req: NextRequest, context: { params: Promise<{ token: string }> }) {
    try {
        const resolvedParams = await context.params;
        const token = atob(resolvedParams.token);

        console.log(token);

        // Desconvertir el token de base64 a string
        const token_recovery = await prisma.a_recovery_password_token.findFirst({ where: { token: token } });

        console.log(1);

        if (!token_recovery) return NextResponse.json({ message: "Token no encontrado" });

        const expires_in_date = new Date(token_recovery.expira_en + token_recovery.creacion.getTime());

        console.log(2);

        if (expires_in_date < new Date()) {
            await prisma.a_recovery_password_token.delete({ where: { id: token_recovery.id } });
            return NextResponse.json({ status: false, message: "Token de recuperación de contraseña expirado" });
        }

        const empleado = await prisma.c_empleado.findUnique({ where: { id: token_recovery.empleado_id } });

        console.log(3);

        if (!empleado) {
            await prisma.a_recovery_password_token.delete({ where: { id: token_recovery.id } });
            return NextResponse.json({ status: false, message: "Empleado no encontrado" });
        }

        console.log(4);

        return NextResponse.json({ status: true, message: "Token de recuperación de contraseña encontrado", user: empleado });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.log(errorMessage);
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}