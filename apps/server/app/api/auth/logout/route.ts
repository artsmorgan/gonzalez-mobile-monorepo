import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { refreshToken } = body;

        if (!refreshToken) {
            return NextResponse.json(
                { status: false, message: "Refresh token requerido" },
                { status: 400 }
            );
        }

        // Buscar y revocar el refresh token
        const storedToken = await prisma.refresh_token.findUnique({
            where: { token: refreshToken },
        });

        if (!storedToken) {
            return NextResponse.json(
                { status: false, message: "Token no encontrado" },
                { status: 404 }
            );
        }

        await prisma.refresh_token.update({
            where: { id: storedToken.id },
            data: { revoked: true },
        });

        return NextResponse.json(
            { status: true, message: "Sesión cerrada correctamente" },
            { status: 200 }
        );
    } catch (error) {
        console.error("Error en logout:", error);
        return NextResponse.json(
            { status: false, message: "Error interno del servidor" },
            { status: 500 }
        );
    } finally {
        await prisma.$disconnect();
    }
}
