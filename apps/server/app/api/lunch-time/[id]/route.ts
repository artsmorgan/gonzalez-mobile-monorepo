import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../utils/verifyToken";
import { toZonedTime } from "date-fns-tz";
import { prisma } from "../../../../utils/prismaClient";
import { getUserMarca } from "../../../../utils/getUserMarca";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
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

        const marcaDia = await prisma.c_marca_dia.findUnique({ where: { id } });

        if (!marcaDia) return NextResponse.json({ message: "Marca no encontrada" }, { status: 404 });

        if (!marcaDia.empleadoFijo_id) {
            return NextResponse.json(
                { status: false, message: "Empleado no encontrado" },
                { status: 200 }
            );
        }

        const last_marca = await getUserMarca(marcaDia.empleadoFijo_id);
        if (!last_marca) return NextResponse.json({ message: "No se encontró la última marca" }, { status: 404 });
        if (marcaDia.id !== last_marca.id) return NextResponse.json({ message: "Hay una nueva marca más reciente" }, { status: 400 });

        const horario = await prisma.c_horario.findUnique({
            where: {
                id: marcaDia.horario_id
            }
        });

        if (!horario) return NextResponse.json({ message: "Horario no encontrado" }, { status: 404 });

        return NextResponse.json({ status: true, minutos: horario.minutos_almuerzo ? horario.minutos_almuerzo : 0 }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}