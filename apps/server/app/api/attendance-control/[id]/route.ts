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
            cliente,
            fecha,
            turno,
            area_piso,
            total_presentes,
            fijos,
            colaboradores
        } = await req.json();

        const updated_record = await prisma.c_control_asistencia.update({
            where: { id },
            data: {
                cliente: cliente !== undefined ? cliente : undefined,
                fecha: fecha !== undefined ? fecha : undefined,
                turno: turno !== undefined ? turno : undefined,
                area_piso: area_piso !== undefined ? area_piso : undefined,
                total_presentes: total_presentes !== undefined ? total_presentes : undefined,
                fijos: fijos !== undefined ? fijos : undefined,
                colaboradores: colaboradores !== undefined ? colaboradores : undefined,
            }
        });

        return NextResponse.json({
            status: true,
            message: "Control de asistencia actualizado correctamente",
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

        await prisma.c_control_asistencia.delete({
            where: { id }
        });

        return NextResponse.json({
            status: true,
            message: "Control de asistencia eliminado correctamente"
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

