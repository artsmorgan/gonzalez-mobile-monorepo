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
            fecha,
            renglon_edificio,
            supervisor_cliente,
            supervisor_corporacion,
            temas_desarrollados,
            aspectos_especificos,
            participantes,
            firma_supervisor
        } = await req.json();

        const updated_record = await prisma.c_registro_induccion_recorrido.update({
            where: { id },
            data: {
                fecha: fecha !== undefined ? fecha : undefined,
                renglon_edificio: renglon_edificio !== undefined ? renglon_edificio : undefined,
                supervisor_cliente: supervisor_cliente !== undefined ? supervisor_cliente : undefined,
                supervisor_corporacion: supervisor_corporacion !== undefined ? supervisor_corporacion : undefined,
                temas_desarrollados: temas_desarrollados !== undefined ? temas_desarrollados : undefined,
                aspectos_especificos: aspectos_especificos !== undefined ? aspectos_especificos : undefined,
                participantes: participantes !== undefined ? participantes : undefined,
                firma_supervisor: firma_supervisor !== undefined ? firma_supervisor : undefined,
            }
        });

        return NextResponse.json({
            status: true,
            message: "Registro de inducción y recorrido actualizado correctamente",
            data: updated_record
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

        await prisma.c_registro_induccion_recorrido.delete({
            where: { id }
        });

        return NextResponse.json({
            status: true,
            message: "Registro de inducción y recorrido eliminado correctamente"
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

