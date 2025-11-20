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
            sociedad,
            nombre_realiza_queja,
            cliente,
            empresa_presenta_queja,
            persona_presenta_queja,
            medio_recepcion_queja,
            tipo_queja,
            ubicacion,
            nivel_queja,
            fecha_queja,
            motivo_queja,
            descripcion_queja,
            fecha_inicio,
            fecha_revision,
            resolucion_queja,
            mes_queja,
            ano_queja,
            estado,
            accion_correctiva_preventiva,
            anexo_evidencia
        } = await req.json();

        const existingRecord = await prisma.c_maestro_quejas.findUnique({
            where: { id }
        });

        if (!existingRecord) {
            return NextResponse.json(
                { status: false, message: "Registro no encontrado" },
                { status: 404 }
            );
        }

        const updatedRecord = await prisma.c_maestro_quejas.update({
            where: { id },
            data: {
                sociedad: sociedad !== undefined ? sociedad : existingRecord.sociedad,
                nombre_realiza_queja: nombre_realiza_queja !== undefined ? nombre_realiza_queja : existingRecord.nombre_realiza_queja,
                cliente: cliente !== undefined ? cliente : existingRecord.cliente,
                empresa_presenta_queja: empresa_presenta_queja !== undefined ? empresa_presenta_queja : existingRecord.empresa_presenta_queja,
                persona_presenta_queja: persona_presenta_queja !== undefined ? persona_presenta_queja : existingRecord.persona_presenta_queja,
                medio_recepcion_queja: medio_recepcion_queja !== undefined ? medio_recepcion_queja : existingRecord.medio_recepcion_queja,
                tipo_queja: tipo_queja !== undefined ? tipo_queja : existingRecord.tipo_queja,
                ubicacion: ubicacion !== undefined ? ubicacion : existingRecord.ubicacion,
                nivel_queja: nivel_queja !== undefined ? nivel_queja : existingRecord.nivel_queja,
                fecha_queja: fecha_queja !== undefined ? fecha_queja : existingRecord.fecha_queja,
                motivo_queja: motivo_queja !== undefined ? motivo_queja : existingRecord.motivo_queja,
                descripcion_queja: descripcion_queja !== undefined ? descripcion_queja : existingRecord.descripcion_queja,
                fecha_inicio: fecha_inicio !== undefined ? fecha_inicio : existingRecord.fecha_inicio,
                fecha_revision: fecha_revision !== undefined ? fecha_revision : existingRecord.fecha_revision,
                resolucion_queja: resolucion_queja !== undefined ? resolucion_queja : existingRecord.resolucion_queja,
                mes_queja: mes_queja !== undefined ? mes_queja : existingRecord.mes_queja,
                ano_queja: ano_queja !== undefined ? ano_queja : existingRecord.ano_queja,
                estado: estado !== undefined ? estado : existingRecord.estado,
                accion_correctiva_preventiva: accion_correctiva_preventiva !== undefined ? accion_correctiva_preventiva : existingRecord.accion_correctiva_preventiva,
                anexo_evidencia: anexo_evidencia !== undefined ? anexo_evidencia : existingRecord.anexo_evidencia,
            }
        });

        return NextResponse.json({
            status: true,
            message: "Queja actualizada correctamente",
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

        const existingRecord = await prisma.c_maestro_quejas.findUnique({
            where: { id }
        });

        if (!existingRecord) {
            return NextResponse.json(
                { status: false, message: "Registro no encontrado" },
                { status: 404 }
            );
        }

        await prisma.c_maestro_quejas.delete({
            where: { id }
        });

        return NextResponse.json({
            status: true,
            message: "Queja eliminada correctamente"
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

