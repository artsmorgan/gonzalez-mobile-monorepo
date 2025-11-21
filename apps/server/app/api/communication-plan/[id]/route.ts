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
            comunicaciones,
            responsable_aprobacion,
            puesto_aprobacion,
            fecha_aprobacion
        } = await req.json();

        const updated_record = await prisma.c_plan_comunicacion.update({
            where: { id },
            data: {
                comunicaciones: comunicaciones !== undefined ? comunicaciones : undefined,
                responsable_aprobacion: responsable_aprobacion !== undefined ? responsable_aprobacion : undefined,
                puesto_aprobacion: puesto_aprobacion !== undefined ? puesto_aprobacion : undefined,
                fecha_aprobacion: fecha_aprobacion !== undefined ? fecha_aprobacion : undefined,
            }
        });

        return NextResponse.json({
            status: true,
            message: "Plan de comunicación actualizado correctamente",
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

        await prisma.c_plan_comunicacion.delete({
            where: { id }
        });

        return NextResponse.json({
            status: true,
            message: "Plan de comunicación eliminado correctamente"
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

