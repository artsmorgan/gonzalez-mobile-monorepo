import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(req: NextRequest, context: { params: Promise<{ token: string }> }) {
    try {
        const resolvedParams = await context.params;
        const token = atob(resolvedParams.token);

        // Desconvertir el token de base64 a string
        const token_recovery = await prisma.a_recovery_password_token.findFirst({ where: { token: token } });
        if (!token_recovery) return NextResponse.json({ message: "Token no encontrado" });
        const expires_in_date = new Date(token_recovery.expira_en + token_recovery.creacion.getTime());
        if (expires_in_date < new Date()) {
            await prisma.a_recovery_password_token.delete({ where: { id: token_recovery.id } });
            return NextResponse.json({ status: false, message: "Token de recuperación de contraseña expirado" });
        }
        const usuario = await prisma.security_fos_user.findUnique({ where: { id: token_recovery.usuarioId } });
        if (!usuario) {
            await prisma.a_recovery_password_token.delete({ where: { id: token_recovery.id } });
            return NextResponse.json({ status: false, message: "Usuario no encontrado" });
        }
        return NextResponse.json({ status: true, message: "Token de recuperación de contraseña encontrado", user: usuario });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}