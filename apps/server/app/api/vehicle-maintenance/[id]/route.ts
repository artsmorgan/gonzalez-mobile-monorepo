import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../utils/verifyToken";
import { prisma } from "../../../../utils/prismaClient";

export async function PUT(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { valid, expired, payload, message } = verifyAccessToken(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const { id } = resolvedParams;
        const {
            nombre_vehiculo,
            matricula_vehiculo,
            mantenimientos
        } = await req.json();

        const existingRecord = await prisma.c_planificacion_mantenimiento_vehiculo.findUnique({
            where: { id }
        });

        if (!existingRecord) {
            return NextResponse.json(
                { status: false, message: "Registro no encontrado" },
                { status: 404 }
            );
        }

        const updatedRecord = await prisma.c_planificacion_mantenimiento_vehiculo.update({
            where: { id },
            data: {
                nombre_vehiculo: nombre_vehiculo !== undefined ? nombre_vehiculo : existingRecord.nombre_vehiculo,
                matricula_vehiculo: matricula_vehiculo !== undefined ? matricula_vehiculo : existingRecord.matricula_vehiculo,
                mantenimientos: mantenimientos !== undefined ? (mantenimientos ? JSON.stringify(mantenimientos) : null) : existingRecord.mantenimientos,
            }
        });

        return NextResponse.json({
            status: true,
            message: "Planificación de mantenimiento actualizada correctamente",
            data: {
                ...updatedRecord,
                mantenimientos: updatedRecord.mantenimientos ? JSON.parse(updatedRecord.mantenimientos) : null,
            }
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
        const { valid, expired, payload, message } = verifyAccessToken(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const { id } = resolvedParams;

        const existingRecord = await prisma.c_planificacion_mantenimiento_vehiculo.findUnique({
            where: { id }
        });

        if (!existingRecord) {
            return NextResponse.json(
                { status: false, message: "Registro no encontrado" },
                { status: 404 }
            );
        }

        await prisma.c_planificacion_mantenimiento_vehiculo.delete({
            where: { id }
        });

        return NextResponse.json({
            status: true,
            message: "Planificación de mantenimiento eliminada correctamente"
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

