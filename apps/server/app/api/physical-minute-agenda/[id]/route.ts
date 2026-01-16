import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../utils/verifyToken";
import { prisma } from "../../../../utils/prismaClient";

export async function PUT(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        /*
        const { valid, payload, message } = verifyAccessToken(req);

        if (!valid) {
            return NextResponse.json(
                { status: false, message: message },
                { status: 401 }
            );
        }

        const resolvedParams = await context.params;
        const { id } = resolvedParams;
        const {
            fecha,
            puesto,
            hora_inicio,
            hora_fin,
            elaborado_por,
            minuta_numero,
            presentes,
            observaciones,
            temas_tratados,
            notas
        } = await req.json();

        const existingRecord = await prisma.c_agenda_minuta.findUnique({
            where: { id }
        });

        if (!existingRecord) {
            return NextResponse.json(
                { status: false, message: "Registro no encontrado" },
                { status: 404 }
            );
        }

        const updatedRecord = await prisma.c_agenda_minuta.update({
            where: { id },
            data: {
                fecha: fecha !== undefined ? fecha : existingRecord.fecha,
                puesto: puesto !== undefined ? puesto : existingRecord.puesto,
                hora_inicio: hora_inicio !== undefined ? hora_inicio : existingRecord.hora_inicio,
                hora_fin: hora_fin !== undefined ? hora_fin : existingRecord.hora_fin,
                elaborado_por: elaborado_por !== undefined ? elaborado_por : existingRecord.elaborado_por,
                minuta_numero: minuta_numero !== undefined ? minuta_numero : existingRecord.minuta_numero,
                presentes: presentes !== undefined ? presentes : existingRecord.presentes,
                observaciones: observaciones !== undefined ? observaciones : existingRecord.observaciones,
                temas_tratados: temas_tratados !== undefined ? temas_tratados : existingRecord.temas_tratados,
                notas: notas !== undefined ? notas : existingRecord.notas,
            }
        });

        return NextResponse.json({
            status: true,
            message: "Agenda minuta física actualizada correctamente",
            data: updatedRecord
        }, { status: 200 });
*/
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

export async function DELETE(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        /*
        const { valid, payload, message } = verifyAccessToken(req);

        if (!valid) {
            return NextResponse.json(
                { status: false, message: message },
                { status: 401 }
            );
        }

        const resolvedParams = await context.params;
        const { id } = resolvedParams;

        const existingRecord = await prisma.c_agenda_minuta.findUnique({
            where: { id }
        });

        if (!existingRecord) {
            return NextResponse.json(
                { status: false, message: "Registro no encontrado" },
                { status: 404 }
            );
        }

        await prisma.c_agenda_minuta.delete({
            where: { id }
        });

*/
        return NextResponse.json({
            status: true,
            message: "Agenda minuta física eliminada correctamente"
        }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

