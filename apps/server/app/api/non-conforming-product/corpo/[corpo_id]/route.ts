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

        const corpoId = parseInt(String(corpo_id), 10);
        if (!corpoId) {
            return NextResponse.json({ status: false, message: "Sucursal (corpo) no especificada" }, { status: 400 });
        }

        const records = await prisma.c_producto_no_conforme.findMany({
            where: { corpo_id: corpoId },
            include: { e_archivos_producto_no_conforme: true },
            orderBy: { created_at: 'desc' }
        });

        const recordsWithExtras = records.map((record: any) => ({
            ...record,
            id_local: "",
            files: (record.e_archivos_producto_no_conforme || []).map((f: any) => ({
                id: f.id,
                name: f.name,
                original_name: f.original_name,
                type: f.type,
                extension: f.extension,
            })),
        }));

        return NextResponse.json({
            status: true,
            message: "Productos no conformes obtenidos correctamente",
            data: recordsWithExtras
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

