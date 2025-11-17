import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../../utils/verifyToken";
import { toZonedTime } from "date-fns-tz";
import { prisma } from "../../../../../utils/prismaClient";


export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, payload, message } = verifyAccessToken(req);

        if (!valid) {
            return NextResponse.json(
                { status: false, message: message },
                { status: 401 }
            );
        }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);

        const { type, reason } = await req.json();

        // Obtener siempre la última marca agregada
        const marcaDia = await prisma.c_marca_dia.findFirst({ where: { empleadoFijo_id: id }, orderBy: { id: "desc" } });
        if (!marcaDia) {
            return NextResponse.json({ status: false, message: "No se encontró la marca del dia" }, { status: 200 });
        }

        marcaDia.motivo_ausente = reason;

        await prisma.c_marca_dia.update({ where: { id: marcaDia.id }, data: marcaDia });

        return NextResponse.json({ status: true, message: "Motivo de ausencia confirmado" }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.log(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}
