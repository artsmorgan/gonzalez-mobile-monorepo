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
            datos_cambio,
            actividades,
            aprobado_por,
            firma_representante,
            fecha_aprobacion
        } = await req.json();

        const updated_record = await prisma.c_planificacion_cambios_sgc.update({
            where: { id },
            data: {
                datos_cambio: datos_cambio !== undefined ? datos_cambio : undefined,
                actividades: actividades !== undefined ? actividades : undefined,
                aprobado_por: aprobado_por !== undefined ? aprobado_por : undefined,
                firma_representante: firma_representante !== undefined ? firma_representante : undefined,
                fecha_aprobacion: fecha_aprobacion !== undefined ? fecha_aprobacion : undefined,
            }
        });

        return NextResponse.json({
            status: true,
            message: "Planificación de cambios del SGC actualizada correctamente",
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
        const { valid, expired, payload, message } = verifyAccessToken(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const { id } = resolvedParams;

        await prisma.c_planificacion_cambios_sgc.delete({
            where: { id }
        });

        return NextResponse.json({
            status: true,
            message: "Planificación de cambios del SGC eliminada correctamente"
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

