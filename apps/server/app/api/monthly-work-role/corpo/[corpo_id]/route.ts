import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../../utils/verifyToken";
import { prisma } from "../../../../../utils/prismaClient";

export async function GET(
    req: NextRequest,
    { params }: { params: { corpo_id: string } }
) {
    try {
        const { valid, payload, message } = verifyAccessToken(req);

        if (!valid) {
            return NextResponse.json(
                { status: false, message: message },
                { status: 401 }
            );
        }

        const { corpo_id } = params;

        const records = await prisma.c_rol_trabajo_mensual.findMany({
            where: {
                corpo_id: corpo_id
            },
            orderBy: {
                created_at: 'desc'
            }
        });

        const recordsWithIdLocal = records.map(record => ({
            ...record,
            id_local: ""
        }));

        return NextResponse.json({
            status: true,
            message: "Roles de trabajo mensual obtenidos correctamente",
            data: recordsWithIdLocal
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage, data: [] }, { status: 400 });
    }
}

