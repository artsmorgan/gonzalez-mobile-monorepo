/* Refresh principal: tablas preexistentes (Prisma) + orquestación de rotación de sesión. */
import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import { toZonedTime } from "date-fns-tz";
import { prisma } from "../../../../utils/prismaClient";
import { resolveServerBaseUrl } from "../../../../utils/resolveServerBaseUrl";
import { guardifyDeviceGate } from "../../../../utils/guardifyDevices";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const jwt = require("jsonwebtoken");

export async function POST(request: NextRequest) {
    try {
        const { refreshToken, deviceName, guardifyDeviceId: bodyDeviceId, guardifySessionId: bodySessionId } = await request.json();

        if (!refreshToken) {
            return NextResponse.json({ status: false, message: "Refresh token requerido" }, { status: 400 });
        }

        if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
            throw new Error("JWT secrets not configured");
        }

        let payload: { id?: number; sessionId?: string; gdev?: string; gsid?: string };
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

        // El equipo y la sesión de Guardify se conservan al renovar; un refresh anterior a esta función no los trae y se adopta el equipo de Guardify que manda la app.
        const gdev = String(payload.gdev ?? "").trim() || String(bodyDeviceId ?? "").trim() || undefined;
        // La sesión de Guardify se abre después del login en la app: el primer refresh la incorpora al token.
        const gsid = String(payload.gsid ?? "").trim() || String(bodySessionId ?? "").trim() || undefined;

        // Si el equipo dejó de estar activo no se renueva la sesión (en `off` y `observe` nunca corta).
        const deviceDenied = await guardifyDeviceGate({ payload: { id: payload.id, gdev, gsid }, route: "/api/auth/refresh-token", method: "POST", stage: "refresh", appVersion: request.headers.get("x-app-version") });
        if (deviceDenied) {
            return NextResponse.json({ status: false, message: deviceDenied }, { status: 403 });
        }

        const nowCR = toZonedTime(new Date(), "America/Costa_Rica");
        const newSessionId = uuidv4();

        const newAccessToken = jwt.sign(
            {
                id: payload.id,
                cedula: empleado.cedula,
                sessionId: newSessionId,
                ...(gdev ? { gdev } : {}),
                ...(gsid ? { gsid } : {}),
            },
            process.env.JWT_SECRET!,
            { expiresIn: "1d" },
        );

        const newRefreshToken = jwt.sign(
            {
                id: payload.id,
                sessionId: newSessionId,
                ...(gdev ? { gdev } : {}),
                ...(gsid ? { gsid } : {}),
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
