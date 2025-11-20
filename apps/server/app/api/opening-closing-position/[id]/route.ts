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
            cliente,
            numero_corpo,
            numero_puesto,
            fecha_realizado,
            nombre_corpo,
            nombre_puesto,
            tipo,
            actividades,
            inventario,
            fotos,
            otras_observaciones,
            nombre_representante_cliente,
            firma_cliente
        } = await req.json();

        const updated_record = await prisma.c_apertura_cierre_puesto.update({
            where: { id },
            data: {
                cliente: cliente !== undefined ? cliente : undefined,
                numero_corpo: numero_corpo !== undefined ? numero_corpo : undefined,
                numero_puesto: numero_puesto !== undefined ? numero_puesto : undefined,
                fecha_realizado: fecha_realizado !== undefined ? fecha_realizado : undefined,
                nombre_corpo: nombre_corpo !== undefined ? nombre_corpo : undefined,
                nombre_puesto: nombre_puesto !== undefined ? nombre_puesto : undefined,
                tipo: tipo !== undefined ? tipo : undefined,
                actividades: actividades !== undefined ? actividades : undefined,
                inventario: inventario !== undefined ? inventario : undefined,
                fotos: fotos !== undefined ? fotos : undefined,
                otras_observaciones: otras_observaciones !== undefined ? otras_observaciones : undefined,
                nombre_representante_cliente: nombre_representante_cliente !== undefined ? nombre_representante_cliente : undefined,
                firma_cliente: firma_cliente !== undefined ? firma_cliente : undefined,
            }
        });

        return NextResponse.json({
            status: true,
            message: "Apertura-Cierre de Puesto actualizado correctamente",
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

        await prisma.c_apertura_cierre_puesto.delete({
            where: { id }
        });

        return NextResponse.json({
            status: true,
            message: "Apertura-Cierre de Puesto eliminado correctamente"
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

