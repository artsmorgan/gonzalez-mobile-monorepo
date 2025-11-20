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
            fecha_inicio_contrato,
            cliente_contrato,
            ejecutivo_gerente_asistente,
            personal,
            lugar_servicio,
            roles_horarios,
            desglose_salarios,
            tipo_uniforme,
            tipo_arma,
            capacitaciones,
            otros_datos
        } = await req.json();

        const existingRecord = await prisma.c_datos_basicos_contrato.findUnique({
            where: { id }
        });

        if (!existingRecord) {
            return NextResponse.json(
                { status: false, message: "Registro no encontrado" },
                { status: 404 }
            );
        }

        const updatedRecord = await prisma.c_datos_basicos_contrato.update({
            where: { id },
            data: {
                fecha_inicio_contrato: fecha_inicio_contrato !== undefined ? fecha_inicio_contrato : existingRecord.fecha_inicio_contrato,
                cliente_contrato: cliente_contrato !== undefined ? cliente_contrato : existingRecord.cliente_contrato,
                ejecutivo_gerente_asistente: ejecutivo_gerente_asistente !== undefined ? ejecutivo_gerente_asistente : existingRecord.ejecutivo_gerente_asistente,
                personal: personal !== undefined ? personal : existingRecord.personal,
                lugar_servicio: lugar_servicio !== undefined ? lugar_servicio : existingRecord.lugar_servicio,
                roles_horarios: roles_horarios !== undefined ? roles_horarios : existingRecord.roles_horarios,
                desglose_salarios: desglose_salarios !== undefined ? desglose_salarios : existingRecord.desglose_salarios,
                tipo_uniforme: tipo_uniforme !== undefined ? tipo_uniforme : existingRecord.tipo_uniforme,
                tipo_arma: tipo_arma !== undefined ? tipo_arma : existingRecord.tipo_arma,
                capacitaciones: capacitaciones !== undefined ? capacitaciones : existingRecord.capacitaciones,
                otros_datos: otros_datos !== undefined ? otros_datos : existingRecord.otros_datos,
            }
        });

        return NextResponse.json({
            status: true,
            message: "Datos básicos de contrato actualizados correctamente",
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

        const existingRecord = await prisma.c_datos_basicos_contrato.findUnique({
            where: { id }
        });

        if (!existingRecord) {
            return NextResponse.json(
                { status: false, message: "Registro no encontrado" },
                { status: 404 }
            );
        }

        await prisma.c_datos_basicos_contrato.delete({
            where: { id }
        });

        return NextResponse.json({
            status: true,
            message: "Datos básicos de contrato eliminados correctamente"
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

