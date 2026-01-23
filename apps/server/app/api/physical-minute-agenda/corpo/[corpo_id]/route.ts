import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../../utils/verifyToken";
import { prisma } from "../../../../../utils/prismaClient";

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ corpo_id: string }> }
) {
    try {
        /*
        const { valid, expired, payload, message } = verifyAccessToken(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const { corpo_id } = resolvedParams;

        const records = await prisma.c_agenda_minuta_fisica.findMany({
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
            message: "Agendas minuta física obtenidas correctamente",
            data: recordsWithIdLocal
        }, { status: 200 });
*/
        return NextResponse.json({
            status: true,
            message: "Agendas minuta física obtenidas correctamente",
            data: []
        }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

