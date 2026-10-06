/* Auth logout route using Prisma directly (no callDynamicPrisma) */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../utils/prismaClient';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const jwt = require('jsonwebtoken');

export async function POST(request: NextRequest) {
  try {
    const { refreshToken } = await request.json();

    if (!refreshToken) {
      return NextResponse.json(
        { status: false, message: 'Refresh token requerido' },
        { status: 400 }
      );
    }

    let decoded: any = null;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!);
    } catch {
      return NextResponse.json(
        { status: false, message: 'Token inválido' },
        { status: 401 }
      );
    }

    if (!decoded || !decoded.id) {
      return NextResponse.json(
        { status: false, message: 'Token inválido' },
        { status: 401 }
      );
    }

    await prisma.refresh_token.updateMany({
      where: { empleadoId: decoded.id, revoked: false },
      data: { revoked: true },
    });

    return NextResponse.json(
      { status: true, message: 'Logout exitoso. Refresh token revocado.' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error en logout (dynamic-prisma/auth):', error);
    return NextResponse.json(
      { status: false, message: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

