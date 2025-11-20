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
            miscelaneo,
            capacitador,
            cedula,
            fecha,
            firma_miscelaneo,
            firma_capacitador
        } = await req.json();

        const updated_record = await prisma.c_guia_uso_cepillo_electrico.update({
            where: { id },
            data: {
                miscelaneo: miscelaneo !== undefined ? miscelaneo : undefined,
                capacitador: capacitador !== undefined ? capacitador : undefined,
                cedula: cedula !== undefined ? cedula : undefined,
                fecha: fecha !== undefined ? fecha : undefined,
                firma_miscelaneo: firma_miscelaneo !== undefined ? firma_miscelaneo : undefined,
                firma_capacitador: firma_capacitador !== undefined ? firma_capacitador : undefined,
            }
        });

        return NextResponse.json({
            status: true,
            message: "Guía de uso de cepillo eléctrico actualizada correctamente",
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

        await prisma.c_guia_uso_cepillo_electrico.delete({
            where: { id }
        });

        return NextResponse.json({
            status: true,
            message: "Guía de uso de cepillo eléctrico eliminada correctamente"
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

