import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../utils/prismaClient";
import { createTokenPlanillas } from "../../../../utils/createTokenPlanillas";
import { verifyAccessToken } from "../../../../utils/verifyToken";

export async function POST(request: NextRequest) {
    try {
        const { valid, expired, payload, message } = verifyAccessToken(request);

        if (!valid || expired) {
            return NextResponse.json({ status: false, message }, { status: 401 });
        }

        const body = await request.json();
        const { password } = body;

        if (!password) {
            return NextResponse.json({ status: false, message: "Contraseña es requerida" }, { status: 400 });
        }

        const payloadId = Number(payload?.id);
        if (!Number.isFinite(payloadId) || payloadId <= 0) {
            return NextResponse.json({ status: false, message: "Token inválido" }, { status: 401 });
        }

        const empleado = await prisma.c_empleado.findFirst({ where: { id: payloadId } });

        if (!empleado) {
            return NextResponse.json({ status: false, message: "Empleado inválido" }, { status: 401 });
        }

        const token = await createTokenPlanillas(request, { id: empleado.id, cedula: empleado.cedula }, password);

        return NextResponse.json(
            {
                status: true,
                data: {
                    planillasToken: token.planillasToken,
                    planillasTokenExpiresAt: token.planillasTokenExpiresAt,
                },
            },
            { status: 200 },
        );
    } catch (error) {
        console.error("Error en planillas-token:", error);
        return NextResponse.json({ status: false, message: "Error interno del servidor" }, { status: 500 });
    }
}
