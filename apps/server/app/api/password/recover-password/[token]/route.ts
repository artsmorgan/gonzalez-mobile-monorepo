/* eslint-disable @typescript-eslint/no-require-imports */
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

export async function PUT(req: NextRequest, context: { params: Promise<{ token: string }> }) {
    try {
        const resolvedParams = await context.params;
        const token = atob(resolvedParams.token);
        const { password } = await req.json();
        const token_recovery = await prisma.a_recovery_password_token.findFirst({ where: { token: token } });
        if (!token_recovery) return NextResponse.json({ status: false, message: "Token de recuperación de contraseña no encontrado" });
        const usuario = await prisma.security_fos_user.findUnique({ where: { id: token_recovery.usuarioId } });
        if (!usuario) return NextResponse.json({ status: false, message: "Usuario no encontrado" });
        const hashedPassword = await bcrypt.hash(password, 10);
        await prisma.security_fos_user.update({ where: { id: token_recovery.usuarioId }, data: { password: hashedPassword } });
        await prisma.a_recovery_password_token.delete({ where: { id: token_recovery.id } });
        // Retornar éxito con la contraseña actualizada
        return NextResponse.json({ status: true, message: "Contraseña actualizada" });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ status: false, message: errorMessage });
    }
}