import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../utils/verifyToken";
import { prisma } from "../../../../utils/prismaClient";

export async function PUT(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
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
        const { id } = resolvedParams;
        const {
            edificio,
            supervisor,
            situaciones
        } = await req.json();

        const updated_record = await prisma.c_plan_atencion_situaciones_especiales.update({
            where: { id },
            data: {
                edificio: edificio !== undefined ? edificio : undefined,
                supervisor: supervisor !== undefined ? supervisor : undefined,
                situaciones: situaciones !== undefined ? situaciones : undefined,
            }
        });

        return NextResponse.json({
            status: true,
            message: "Plan para la atención de situaciones especiales actualizado correctamente",
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
    context: { params: Promise<{ id: string }> }
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
        const { id } = resolvedParams;

        await prisma.c_plan_atencion_situaciones_especiales.delete({
            where: { id }
        });

        return NextResponse.json({
            status: true,
            message: "Plan para la atención de situaciones especiales eliminado correctamente"
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

