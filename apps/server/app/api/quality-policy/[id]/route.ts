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
            politica_contenido,
            nombre_aprobado,
            firma_aprobado
        } = await req.json();

        const updated_record = await prisma.c_politica_calidad.update({
            where: { id },
            data: {
                politica_contenido: politica_contenido !== undefined ? politica_contenido : undefined,
                nombre_aprobado: nombre_aprobado !== undefined ? nombre_aprobado : undefined,
                firma_aprobado: firma_aprobado !== undefined ? firma_aprobado : undefined,
            }
        });

        return NextResponse.json({
            status: true,
            message: "Política de calidad actualizada correctamente",
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

        await prisma.c_politica_calidad.delete({
            where: { id }
        });

        return NextResponse.json({
            status: true,
            message: "Política de calidad eliminada correctamente"
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

