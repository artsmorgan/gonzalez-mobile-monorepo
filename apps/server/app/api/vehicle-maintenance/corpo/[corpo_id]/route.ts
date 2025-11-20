import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../../utils/verifyToken";
import { prisma } from "../../../../../utils/prismaClient";

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ corpo_id: string }> }
) {
    try {
        const { valid, payload, message } = verifyAccessToken(req);

        if (!valid) {
            return NextResponse.json(
                { status: false, message: message },
                { status: 401 }
            );
        }

        const resolvedParams = await context.params;
        const { corpo_id } = resolvedParams;

        const records = await prisma.c_planificacion_mantenimiento_vehiculo.findMany({
            where: {
                corpo_id: corpo_id
            },
            orderBy: {
                created_at: 'desc'
            }
        });

        const recordsWithIdLocal = records.map(record => ({
            ...record,
            id_local: "",
            mantenimientos: record.mantenimientos ? JSON.parse(record.mantenimientos) : null,
        }));

        return NextResponse.json({
            status: true,
            message: "Planificaciones de mantenimiento obtenidas correctamente",
            data: recordsWithIdLocal
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

