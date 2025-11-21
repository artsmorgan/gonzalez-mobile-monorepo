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
            ambitos,
            nombre_aprobado,
            firma_aprobado
        } = await req.json();

        const updated_record = await prisma.c_objetivos_empresariales_calidad.update({
            where: { id },
            data: {
                ambitos: ambitos !== undefined ? ambitos : undefined,
                nombre_aprobado: nombre_aprobado !== undefined ? nombre_aprobado : undefined,
                firma_aprobado: firma_aprobado !== undefined ? firma_aprobado : undefined,
            }
        });

        return NextResponse.json({
            status: true,
            message: "Objetivos empresariales de calidad actualizados correctamente",
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

        await prisma.c_objetivos_empresariales_calidad.delete({
            where: { id }
        });

        return NextResponse.json({
            status: true,
            message: "Objetivos empresariales de calidad eliminados correctamente"
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

