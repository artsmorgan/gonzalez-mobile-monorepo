import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
    try {
        const { refreshToken } = await req.json();

        if (!refreshToken) {
            return NextResponse.json(
                { status: false, message: "Refresh token requerido" },
                { status: 400 }
            );
        }

        // Buscar el token en la BD
        const tokenRecord = await prisma.refresh_token.findUnique({
            where: { token: refreshToken },
        });

        if (!tokenRecord) {
            return NextResponse.json(
                { status: false, message: "Refresh token no encontrado" },
                { status: 404 }
            );
        }

        // Revocar el token
        await prisma.refresh_token.update({
            where: { id: tokenRecord.id },
            data: { revoked: true },
        });

        return NextResponse.json(
            { status: true, message: "Logout exitoso. Refresh token revocado." },
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
