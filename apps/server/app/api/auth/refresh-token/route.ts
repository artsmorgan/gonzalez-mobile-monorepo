/* eslint-disable @typescript-eslint/no-require-imports */
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "../../../../utils/prismaClient";
const jwt = require("jsonwebtoken");
import crypto from "crypto";
import { toZonedTime } from "date-fns-tz";

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function POST(request: NextRequest) {
  try {
    const { refreshToken } = await request.json();

    if (!refreshToken) {
      console.log(1);
      return NextResponse.json(
        { status: false, message: "Refresh token requerido" },
        { status: 400 }
      );
    }

    // 1️⃣ Verificar JWT del refresh token
    let payload: any;
    try {
      payload = jwt.verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET!
      );
    } catch {
      console.log(2);
      return NextResponse.json(
        { status: false, message: "Refresh token inválido" },
        { status: 401 }
      );
    }

    if (!payload?.id || !payload?.sessionId) {
      console.log(2.5);
      return NextResponse.json(
        { status: false, message: "Refresh token inválido" },
        { status: 401 }
      );
    }


    // 2️⃣ Buscar token en BD (no revocado)
    const storedToken = await prisma.refresh_token.findFirst({
      where: { token: hashToken(refreshToken) },
    });

    if (!storedToken || storedToken.revoked) {
      console.log(3);
      console.log(storedToken);
      return NextResponse.json(
        { status: false, message: "Refresh token inválido" },
        { status: 401 }
      );
    }

    // 3️⃣ Validar expiración (UTC)
    if (storedToken.expiresAt < toZonedTime(new Date(), "America/Costa_Rica")) {
      console.log(4);
      console.log(storedToken.expiresAt);
      console.log(toZonedTime(new Date(), "America/Costa_Rica"));
      return NextResponse.json(
        { status: false, message: "Refresh token expirado" },
        { status: 403 }
      );
    }

    // 4️⃣ Validar sessionId
    if (payload.sessionId !== storedToken.sessionId) {
      console.log(5);
      console.log(payload.sessionId);
      console.log(storedToken.sessionId);
      return NextResponse.json(
        { status: false, message: "Sesión no válida" },
        { status: 401 }
      );
    }

    // 5️⃣ Generar nuevos tokens
    const newSessionId = uuidv4();

    const newAccessToken = jwt.sign(
      {
        id: payload.id,
        cedula: payload.cedula,
        sessionId: newSessionId,
      },
      process.env.JWT_SECRET!,
      { expiresIn: "15m" }
    );

    const newRefreshToken = jwt.sign(
      {
        id: payload.id,
        sessionId: newSessionId,
      },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: "7d" }
    );

    // 6️⃣ Transacción atómica
    await prisma.$transaction(async (tx) => {
      // Revocar SOLO el token usado
      await tx.refresh_token.update({
        where: { id: storedToken.id },
        data: { revoked: true },
      });

      // Crear nuevo refresh token
      await tx.refresh_token.create({
        data: {
          token: hashToken(newRefreshToken),
          empleadoId: payload.id,
          sessionId: newSessionId,
          expiresAt: new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000
          ),
        },
      });
    });

    console.log("Token renovado con éxito");

    // 7️⃣ Respuesta
    return NextResponse.json(
      {
        status: true,
        message: "Token renovado con éxito",
        newAccessToken: newAccessToken,
        newRefreshToken: newRefreshToken,
        newSessionId: newSessionId,
        createdAt: toZonedTime(new Date(), "America/Costa_Rica").getTime(), // Fecha en formato numérico
      },
      { status: 200 }
    );
  } catch (error) {
    console.log("Error en refresh:", error);
    return NextResponse.json(
      { status: false, message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
