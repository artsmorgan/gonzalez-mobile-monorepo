import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../../utils/verifyToken";
import { prisma } from "../../../../../utils/prismaClient";

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ corpo_id: string }> }
) {
    try {
        const { valid, expired, payload, message } = verifyAccessToken(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const { corpo_id } = resolvedParams;

        const records = await prisma.c_maestro_quejas.findMany({
            where: {
                corpo_id: parseInt(corpo_id)
            },
            orderBy: {
                created_at: 'desc'
            },
            include: {
                c_anexos_quejas: true,
            },
        });

        const recordsWithIdLocal = records.map(record => ({
            ...record,
            id_local: "",
            files: (record.c_anexos_quejas || []).map((f) => ({
                id: f.id,
                name: f.name,
                original_name: f.original_name,
                type: f.type,
                extension: f.extension,
            })),
        }));

        return NextResponse.json({
            status: true,
            message: "Quejas obtenidas correctamente",
            data: recordsWithIdLocal
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

