/* eslint-disable @typescript-eslint/no-require-imports */
import { NextRequest, NextResponse } from "next/server";
const jwt = require("jsonwebtoken");
import { prisma } from "../../../../utils/prismaClient";

export async function POST(req: NextRequest) {
    try {
        const { refreshToken } = await req.json();

        if (!refreshToken) {
            return NextResponse.json(
                { status: false, message: "Refresh token requerido" },
                { status: 400 }
            );
        }

        // Obtener el payload del token
        let decoded = null;
        try {
            decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        } catch (err) {
            return NextResponse.json(
                { status: false, message: "Token inválido" },
                { status: 401 }
            );
        }
        if (!decoded || !decoded.id) {
            return NextResponse.json(
                { status: false, message: "Token inválido" },
                { status: 401 }
            );
        }

        // Revocar el token
        await prisma.refresh_token.updateMany({
            where: { empleadoId: decoded.id, revoked: false },
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
    }
}
