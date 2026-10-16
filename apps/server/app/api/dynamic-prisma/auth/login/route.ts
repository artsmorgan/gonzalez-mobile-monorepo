/* Sesión y marca de login: Prisma (invocado desde /api/auth/login). */
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "../../../../../utils/prismaClient";

type DynamicAuthLoginBody = {
    empleadoId?: number;
    sessionId?: string;
    refreshToken?: string;
    deviceName?: string;
    loginMarca?: {
        nombre_empleado?: string;
        cedula_empleado?: string;
        fecha_hora?: string | Date;
    };
    firmaManualFallback?: string | null;
};

function hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
}

export async function POST(request: NextRequest) {
    try {
        const body = (await request.json()) as DynamicAuthLoginBody;
        const empleadoId = Number(body.empleadoId);
        const sessionId = String(body.sessionId ?? "").trim();
        const refreshToken = String(body.refreshToken ?? "").trim();
        const deviceName = body.deviceName != null ? String(body.deviceName) : null;

        if (!Number.isFinite(empleadoId) || empleadoId <= 0) {
            return NextResponse.json({ status: false, message: "empleadoId inválido" }, { status: 400 });
        }
        if (!sessionId || !refreshToken) {
            return NextResponse.json(
                { status: false, message: "sessionId y refreshToken son requeridos" },
                { status: 400 },
            );
        }

        const loginMarca = body.loginMarca ?? {};
        const fechaHora = loginMarca.fecha_hora ? new Date(loginMarca.fecha_hora) : new Date();
        const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        await prisma.refresh_token.updateMany({
            where: { empleadoId },
            data: { revoked: true },
        });

        await prisma.refresh_token.create({
            data: {
                token: hashToken(refreshToken),
                empleadoId,
                sessionId,
                createdAt: fechaHora,
                expiresAt: refreshExpiresAt,
                device: deviceName,
                revoked: false,
            },
        });

        await prisma.c_login_marca_almuerzo.create({
            data: {
                nombre_empleado: String(loginMarca.nombre_empleado ?? ""),
                cedula_empleado: String(loginMarca.cedula_empleado ?? ""),
                fecha_hora: fechaHora,
                device: deviceName ?? "",
                session_id: sessionId,
            },
        });

        return NextResponse.json(
            {
                status: true,
                firmaManual: body.firmaManualFallback ?? null,
            },
            { status: 200 },
        );
    } catch (error) {
        console.error("Error en login (dynamic-prisma/auth):", error);
        return NextResponse.json({ status: false, message: "Error interno del servidor" }, { status: 500 });
    }
}
