/* Refresh principal: tablas preexistentes (Prisma) + orquestación de rotación de sesión. */
import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import { toZonedTime } from "date-fns-tz";
import { prisma } from "../../../../utils/prismaClient";
import { resolveServerBaseUrl } from "../../../../utils/resolveServerBaseUrl";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const jwt = require("jsonwebtoken");

export async function POST(request: NextRequest) {
    try {
        const { refreshToken, deviceName } = await request.json();

        if (!refreshToken) {
            return NextResponse.json({ status: false, message: "Refresh token requerido" }, { status: 400 });
        }

        if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
            throw new Error("JWT secrets not configured");
        }

        let payload: { id?: number; sessionId?: string };
        try {
            payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!);
        } catch {
            return NextResponse.json({ status: false, message: "Refresh token inválido" }, { status: 401 });
        }

        if (!payload?.id || !payload?.sessionId) {
            return NextResponse.json({ status: false, message: "Refresh token inválido" }, { status: 401 });
        }

        const empleado = await prisma.c_empleado.findUnique({
            where: { id: payload.id },
        });

        if (!empleado) {
            return NextResponse.json({ status: false, message: "Empleado no encontrado" }, { status: 404 });
        }

        const nowCR = toZonedTime(new Date(), "America/Costa_Rica");
        const newSessionId = uuidv4();

        const newAccessToken = jwt.sign(
            {
                id: payload.id,
                cedula: empleado.cedula,
                sessionId: newSessionId,
            },
            process.env.JWT_SECRET!,
            { expiresIn: "1d" },
        );

        const newRefreshToken = jwt.sign(
            {
                id: payload.id,
                sessionId: newSessionId,
            },
            process.env.JWT_REFRESH_SECRET!,
            { expiresIn: "7d" },
        );

        const baseUrl = resolveServerBaseUrl(request);
        const dynamicRes = await axios.post(
            `${baseUrl}/api/dynamic-prisma/auth/refresh-token`,
            {
                empleadoId: payload.id,
                oldRefreshToken: refreshToken,
                newRefreshToken,
                oldSessionId: payload.sessionId,
                newSessionId,
                deviceName,
                loginMarca: {
                    nombre_empleado: `${empleado.nombre || ""} ${empleado.primer_apellido || ""} ${empleado.segundo_apellido || ""}`.trim(),
                    cedula_empleado: empleado.cedula || "",
                    fecha_hora: nowCR.toISOString(),
                },
            },
            {
                headers: {
                    Authorization: `Bearer ${newAccessToken}`,
                    "Content-Type": "application/json",
                },
                validateStatus: () => true,
            },
        );

        if (dynamicRes.status !== 200 || !dynamicRes.data?.status) {
            console.error(
                "Error en dynamic-prisma/auth/refresh-token:",
                dynamicRes.status,
                dynamicRes.data,
            );
            return NextResponse.json(
                {
                    status: false,
                    message: dynamicRes.data?.message || "Error al renovar la sesión",
                },
                { status: dynamicRes.status >= 400 ? dynamicRes.status : 500 },
            );
        }

        return NextResponse.json(
            {
                status: true,
                message: "Token renovado con éxito",
                newAccessToken,
                newRefreshToken,
                newSessionId,
                createdAt: nowCR.getTime(),
            },
            { status: 200 },
        );
    } catch (error) {
        console.error("Error en refresh-token (auth/refresh-token):", error);
        return NextResponse.json({ status: false, message: "Error interno del servidor" }, { status: 500 });
    }
}
