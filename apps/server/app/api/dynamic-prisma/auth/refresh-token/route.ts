/* Rotación de sesión: refresh_token y c_login_marca_almuerzo (invocado desde /api/auth/refresh-token). */
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { toZonedTime } from "date-fns-tz";
import { prisma } from "../../../../../utils/prismaClient";

type DynamicRefreshTokenBody = {
    empleadoId?: number;
    oldRefreshToken?: string;
    newRefreshToken?: string;
    oldSessionId?: string;
    newSessionId?: string;
    deviceName?: string;
    loginMarca?: {
        nombre_empleado?: string;
        cedula_empleado?: string;
        fecha_hora?: string | Date;
    };
};

function hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
}

export async function POST(request: NextRequest) {
    try {
        const body = (await request.json()) as DynamicRefreshTokenBody;
        const empleadoId = Number(body.empleadoId);
        const oldRefreshToken = String(body.oldRefreshToken ?? "").trim();
        const newRefreshToken = String(body.newRefreshToken ?? "").trim();
        const oldSessionId = String(body.oldSessionId ?? "").trim();
        const newSessionId = String(body.newSessionId ?? "").trim();
        const deviceName = body.deviceName != null ? String(body.deviceName) : null;

        if (!Number.isFinite(empleadoId) || empleadoId <= 0) {
            return NextResponse.json({ status: false, message: "empleadoId inválido" }, { status: 400 });
        }
        if (!oldRefreshToken || !newRefreshToken || !oldSessionId || !newSessionId) {
            return NextResponse.json(
                { status: false, message: "Tokens y sessionId son requeridos" },
                { status: 400 },
            );
        }

        const storedToken = await prisma.refresh_token.findFirst({
            where: { token: hashToken(oldRefreshToken) },
        });

        if (!storedToken || storedToken.revoked) {
            return NextResponse.json({ status: false, message: "Refresh token inválido" }, { status: 401 });
        }

        if (storedToken.empleadoId !== empleadoId) {
            return NextResponse.json({ status: false, message: "Refresh token inválido" }, { status: 401 });
        }

        const nowCR = toZonedTime(new Date(), "America/Costa_Rica");
        if (storedToken.expiresAt < nowCR) {
            return NextResponse.json({ status: false, message: "Refresh token expirado" }, { status: 403 });
        }

        if (oldSessionId !== storedToken.sessionId) {
            return NextResponse.json({ status: false, message: "Sesión no válida" }, { status: 401 });
        }

        await prisma.refresh_token.update({
            where: { id: storedToken.id },
            data: { revoked: true },
        });

        const loginMarca = body.loginMarca ?? {};
        const fechaHora = loginMarca.fecha_hora ? new Date(loginMarca.fecha_hora) : nowCR;

        await prisma.refresh_token.create({
            data: {
                token: hashToken(newRefreshToken),
                empleadoId,
                sessionId: newSessionId,
                createdAt: fechaHora,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                revoked: false,
                device: deviceName,
            },
        });

        await prisma.c_login_marca_almuerzo.create({
            data: {
                nombre_empleado: String(loginMarca.nombre_empleado ?? ""),
                cedula_empleado: String(loginMarca.cedula_empleado ?? ""),
                fecha_hora: fechaHora,
                device: deviceName ?? "",
                session_id: newSessionId,
            },
        });

        return NextResponse.json({ status: true }, { status: 200 });
    } catch (error) {
        console.error("Error en refresh-token (dynamic-prisma/auth):", error);
        return NextResponse.json({ status: false, message: "Error interno del servidor" }, { status: 500 });
    }
}
