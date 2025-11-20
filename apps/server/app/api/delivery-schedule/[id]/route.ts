import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../utils/verifyToken";
import { prisma } from "../../../../utils/prismaClient";

export async function PUT(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { valid, payload, message } = verifyAccessToken(req);

        if (!valid) {
            return NextResponse.json(
                { status: false, message: message },
                { status: 401 }
            );
        }

        const { id } = params;
        const {
            contrato,
            region,
            puesto,
            fecha_apertura_entrega,
            responsable_apertura_entrega,
            equipos_solicitados
        } = await req.json();

        const existingRecord = await prisma.c_cronograma_entrega_materiales_equipos.findUnique({
            where: { id }
        });

        if (!existingRecord) {
            return NextResponse.json(
                { status: false, message: "Registro no encontrado" },
                { status: 404 }
            );
        }

        const updatedRecord = await prisma.c_cronograma_entrega_materiales_equipos.update({
            where: { id },
            data: {
                contrato: contrato !== undefined ? contrato : existingRecord.contrato,
                region: region !== undefined ? region : existingRecord.region,
                puesto: puesto !== undefined ? puesto : existingRecord.puesto,
                fecha_apertura_entrega: fecha_apertura_entrega !== undefined ? fecha_apertura_entrega : existingRecord.fecha_apertura_entrega,
                responsable_apertura_entrega: responsable_apertura_entrega !== undefined ? responsable_apertura_entrega : existingRecord.responsable_apertura_entrega,
                equipos_solicitados: equipos_solicitados !== undefined ? equipos_solicitados : existingRecord.equipos_solicitados,
            }
        });

        return NextResponse.json({
            status: true,
            message: "Cronograma de entrega actualizado correctamente",
            data: updatedRecord
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { valid, payload, message } = verifyAccessToken(req);

        if (!valid) {
            return NextResponse.json(
                { status: false, message: message },
                { status: 401 }
            );
        }

        const { id } = params;

        const existingRecord = await prisma.c_cronograma_entrega_materiales_equipos.findUnique({
            where: { id }
        });

        if (!existingRecord) {
            return NextResponse.json(
                { status: false, message: "Registro no encontrado" },
                { status: 404 }
            );
        }

        await prisma.c_cronograma_entrega_materiales_equipos.delete({
            where: { id }
        });

        return NextResponse.json({
            status: true,
            message: "Cronograma de entrega eliminado correctamente"
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

