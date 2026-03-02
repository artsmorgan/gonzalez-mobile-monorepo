/* Auth refresh-token route using Prisma directly (no callDynamicPrisma) */
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../../../../../utils/prismaClient';
import { toZonedTime } from 'date-fns-tz';
import crypto from 'crypto';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const jwt = require('jsonwebtoken');

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    const { refreshToken } = await request.json();

    if (!refreshToken) {
      return NextResponse.json(
        { status: false, message: 'Refresh token requerido' },
        { status: 400 }
      );
    }

    let payload: any;
    try {
      payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!);
    } catch {
      return NextResponse.json(
        { status: false, message: 'Refresh token inválido' },
        { status: 401 }
      );
    }

    if (!payload?.id || !payload?.sessionId) {
      return NextResponse.json(
        { status: false, message: 'Refresh token inválido' },
        { status: 401 }
      );
    }

    const storedToken = await prisma.refresh_token.findFirst({
      where: { token: hashToken(refreshToken) },
    });

    if (!storedToken || storedToken.revoked) {
      return NextResponse.json(
        { status: false, message: 'Refresh token inválido' },
        { status: 401 }
      );
    }

    const nowCR = toZonedTime(new Date(), 'America/Costa_Rica');
    if (storedToken.expiresAt < nowCR) {
      return NextResponse.json(
        { status: false, message: 'Refresh token expirado' },
        { status: 403 }
      );
    }

    if (payload.sessionId !== storedToken.sessionId) {
      return NextResponse.json(
        { status: false, message: 'Sesión no válida' },
        { status: 401 }
      );
    }

    const newSessionId = uuidv4();

    const newAccessToken = jwt.sign(
      {
        id: payload.id,
        cedula: payload.cedula,
        sessionId: newSessionId,
      },
      process.env.JWT_SECRET!,
      { expiresIn: '15m' }
    );

    const newRefreshToken = jwt.sign(
      {
        id: payload.id,
        sessionId: newSessionId,
      },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: '7d' }
    );

    await prisma.refresh_token.update({
      where: { id: storedToken.id },
      data: { revoked: true },
    });

    await prisma.refresh_token.create({
      data: {
        token: hashToken(newRefreshToken),
        empleadoId: payload.id,
        sessionId: newSessionId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        revoked: false,
      },
    });

    return NextResponse.json(
      {
        status: true,
        message: 'Token renovado con éxito',
        newAccessToken,
        newRefreshToken,
        newSessionId,
        createdAt: nowCR.getTime(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error en refresh (dynamic-prisma/auth):', error);
    return NextResponse.json(
      { status: false, message: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

