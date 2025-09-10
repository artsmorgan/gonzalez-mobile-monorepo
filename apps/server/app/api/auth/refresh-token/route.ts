import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
dotenv.config();

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

        // Verificar que exista en BD y que no esté revocado
        const storedToken = await prisma.refresh_token.findUnique({
            where: { token: refreshToken },
            include: { empleado: true },
        });

        if (!storedToken || storedToken.revoked) {
            return NextResponse.json(
                { status: false, message: "Refresh token inválido o revocado" },
                { status: 401 }
            );
        }

        // Verificar expiración a nivel DB
        if (storedToken.expiresAt < new Date()) {
            return NextResponse.json(
                { status: false, message: "Refresh token expirado" },
                { status: 401 }
            );
        }

        // Verificar la firma del refresh token
        let decoded;
        try {
            decoded = jwt.verify(
                refreshToken,
                process.env.JWT_REFRESH_SECRET
            );
        } catch (err) {
            return NextResponse.json(
                { status: false, message: "Refresh token inválido" },
                { status: 401 }
            );
        }

        // Generar nuevo access token
        const newAccessToken = jwt.sign(
            { id: storedToken.empleado.id, cedula: storedToken.empleado.cedula },
            process.env.JWT_SECRET,
            { expiresIn: "15m" }
        );

        // 👉 Opción: rotar refresh tokens (generar uno nuevo y guardar en DB)
        const newRefreshToken = jwt.sign(
            { id: storedToken.empleado.id },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: "7d" }
        );

        // Guardar el nuevo refresh token en DB
        await prisma.refresh_token.create({
            data: {
                token: newRefreshToken,
                empleadoId: storedToken.empleado.id,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días
            },
        });

        // Revocar el viejo refresh token (buena práctica si haces rotación)
        await prisma.refresh_token.update({
            where: { id: storedToken.id },
            data: { revoked: true },
        });

        return NextResponse.json(
            {
                status: true,
                accessToken: newAccessToken,
                refreshToken: newRefreshToken,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("Error en refresh-token:", error);
        return NextResponse.json(
            { status: false, message: "Error interno del servidor" },
            { status: 500 }
        );
    } finally {
        await prisma.$disconnect();
    }
}
