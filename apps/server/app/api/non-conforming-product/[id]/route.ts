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
            numero_corpo,
            responsable_cuenta,
            macroactividad,
            actividad,
            tipo_servicio_no_conforme,
            tipo_registro,
            responsable_registro,
            acciones_seguir,
            responsable_corregir,
            responsable_aprobar
        } = await req.json();

        const existingRecord = await prisma.c_producto_no_conforme_matriz.findUnique({
            where: { id }
        });

        if (!existingRecord) {
            return NextResponse.json(
                { status: false, message: "Registro no encontrado" },
                { status: 404 }
            );
        }

        const updatedRecord = await prisma.c_producto_no_conforme_matriz.update({
            where: { id },
            data: {
                cliente: cliente !== undefined ? cliente : existingRecord.cliente,
                numero_corpo: numero_corpo !== undefined ? numero_corpo : existingRecord.numero_corpo,
                responsable_cuenta: responsable_cuenta !== undefined ? responsable_cuenta : existingRecord.responsable_cuenta,
                macroactividad: macroactividad !== undefined ? macroactividad : existingRecord.macroactividad,
                actividad: actividad !== undefined ? actividad : existingRecord.actividad,
                tipo_servicio_no_conforme: tipo_servicio_no_conforme !== undefined ? tipo_servicio_no_conforme : existingRecord.tipo_servicio_no_conforme,
                tipo_registro: tipo_registro !== undefined ? tipo_registro : existingRecord.tipo_registro,
                responsable_registro: responsable_registro !== undefined ? responsable_registro : existingRecord.responsable_registro,
                acciones_seguir: acciones_seguir !== undefined ? acciones_seguir : existingRecord.acciones_seguir,
                responsable_corregir: responsable_corregir !== undefined ? responsable_corregir : existingRecord.responsable_corregir,
                responsable_aprobar: responsable_aprobar !== undefined ? responsable_aprobar : existingRecord.responsable_aprobar,
            }
        });

        return NextResponse.json({
            status: true,
            message: "Producto no conforme actualizado correctamente",
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

        const existingRecord = await prisma.c_producto_no_conforme_matriz.findUnique({
            where: { id }
        });

        if (!existingRecord) {
            return NextResponse.json(
                { status: false, message: "Registro no encontrado" },
                { status: 404 }
            );
        }

        await prisma.c_producto_no_conforme_matriz.delete({
            where: { id }
        });

        return NextResponse.json({
            status: true,
            message: "Producto no conforme eliminado correctamente"
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

