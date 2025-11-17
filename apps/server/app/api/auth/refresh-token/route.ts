/* eslint-disable @typescript-eslint/no-require-imports */
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from 'uuid';
import { toZonedTime } from 'date-fns-tz';
import { prisma } from "../../../../utils/prismaClient";
const jwt = require("jsonwebtoken");

export async function POST(request: NextRequest) {
    try {
        const { refreshToken } = await request.json();

        if (!refreshToken) {
            return NextResponse.json(
                { status: false, message: "Refresh token requerido" },
                { status: 400 }
            );
        }

        // Verificar si existe en BD
        const storedToken = await prisma.refresh_token.findFirst({
            where: { token: refreshToken, revoked: false },
        });

        if (!storedToken) {
            return NextResponse.json(
                { status: false, message: "Refresh token inválido" },
                { status: 401 }
            );
        }

        // Verificar expiración
        if (storedToken.expiresAt < toZonedTime(new Date(), "America/Costa_Rica")) {
            return NextResponse.json(
                { status: false, message: "Refresh token expirado" },
                { status: 403 }
            );
        }

        // Verificar JWT Refresh
        let payload = null;
        try {
            payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!);
        } catch (err) {
            return NextResponse.json(
                { status: false, message: "Refresh token inválido" },
                { status: 401 }
            );
        }

        // 🟢 Verificar que el sessionId del token coincida con el de BD
        if (payload.sessionId !== storedToken.sessionId) {
            return NextResponse.json(
                { status: false, message: "Sesión no válida" },
                { status: 401 }
            );
        }

        // Generar nuevo Access Token
        const accessToken = jwt.sign(
            { id: payload.id, cedula: payload.cedula, sessionId: payload.sessionId }, // payload mínimo
            process.env.JWT_SECRET,
            { expiresIn: "15m" }
        );

        // (Opcional) generar un nuevo refresh token y revocar el anterior
        const newRefreshToken = jwt.sign(
            { id: payload.id, sessionId: payload.sessionId },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: "7d" }
        );

        await prisma.refresh_token.updateMany({
            where: { empleadoId: payload.id, revoked: false },
            data: { revoked: true },
        });

        // Intentar crear el nuevo token, si ya existe (por condición de carrera), eliminarlo primero
        try {
            await prisma.refresh_token.deleteMany({
                where: { empleadoId: payload.id, revoked: false },
            });
            await prisma.refresh_token.create({
                data: {
                    token: newRefreshToken,
                    empleadoId: payload.id,
                    sessionId: payload.sessionId,
                    expiresAt: toZonedTime(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), "America/Costa_Rica"),
                },
            });
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Error desconocido";
            return NextResponse.json(
                { status: false, message: errorMessage },
                { status: 500 }
            );
        }

        return NextResponse.json(
            {
                status: true,
                message: "Token renovado con éxito",
                accessToken: accessToken,
                refreshToken: newRefreshToken,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("Error en refresh:", error);
        return NextResponse.json(
            { status: false, message: "Error interno del servidor" },
            { status: 500 }
        );
    }
}
