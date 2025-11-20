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
            area,
            metraje,
            horario,
            personal,
            horarios
        } = await req.json();

        const existingRecord = await prisma.c_rol_trabajo.findUnique({
            where: { id }
        });

        if (!existingRecord) {
            return NextResponse.json(
                { status: false, message: "Registro no encontrado" },
                { status: 404 }
            );
        }

        const updatedRecord = await prisma.c_rol_trabajo.update({
            where: { id },
            data: {
                area: area !== undefined ? area : existingRecord.area,
                metraje: metraje !== undefined ? metraje : existingRecord.metraje,
                horario: horario !== undefined ? horario : existingRecord.horario,
                personal: personal !== undefined ? personal : existingRecord.personal,
                horarios: horarios !== undefined ? horarios : existingRecord.horarios,
            }
        });

        return NextResponse.json({
            status: true,
            message: "Rol de trabajo actualizado correctamente",
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

        const existingRecord = await prisma.c_rol_trabajo.findUnique({
            where: { id }
        });

        if (!existingRecord) {
            return NextResponse.json(
                { status: false, message: "Registro no encontrado" },
                { status: 404 }
            );
        }

        await prisma.c_rol_trabajo.delete({
            where: { id }
        });

        return NextResponse.json({
            status: true,
            message: "Rol de trabajo eliminado correctamente"
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

