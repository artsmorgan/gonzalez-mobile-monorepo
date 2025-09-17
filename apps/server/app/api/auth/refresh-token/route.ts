/* eslint-disable @typescript-eslint/no-require-imports */
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
            include: { security_fos_user: { select: { id: true, username: true } } },
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
        try {
            jwt.verify(
                refreshToken,
                process.env.JWT_REFRESH_SECRET
            );
        } catch {
            return NextResponse.json(
                { status: false, message: "Refresh token inválido" },
                { status: 401 }
            );
        }

        // Generar nuevo access token para el usuario
        const newAccessToken = jwt.sign(
            { id: storedToken.usuarioId, username: storedToken.security_fos_user.username },
            process.env.JWT_SECRET,
            { expiresIn: "15m" }
        );

        // 👉 Opción: rotar refresh tokens (generar uno nuevo y guardar en DB)
        const newRefreshToken = jwt.sign(
            { id: storedToken.usuarioId },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: "7d" }
        );

        // Guardar el nuevo refresh token en DB
        await prisma.refresh_token.create({
            data: {
                token: newRefreshToken,
                usuarioId: storedToken.security_fos_user.id,
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
                user: {
                    id: storedToken.security_fos_user.id,
                    username: storedToken.security_fos_user.username,
                }
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
