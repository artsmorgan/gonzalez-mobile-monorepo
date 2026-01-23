import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../utils/verifyToken";
import { toZonedTime } from "date-fns-tz";
import { prisma } from "../../../../utils/prismaClient";

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, expired, payload, message } = verifyAccessToken(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const id = resolvedParams.id;

        if (!id) {
            return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 400 });
        }

        const { 
            sociedad, 
            cliente, 
            zona, 
            cantidad_personal, 
            gira_ruta, 
            dia_entrega, 
            estatus,
            cumplimiento_supervision,
            cumplimiento_entrega_insumos,
            persona_refuerzo,
            notas_cambios,
            estado,
            nombre_persona_refuerzo
        } = await req.json();

        const record = await prisma.c_rutas_giras.findUnique({ where: { id } });
        if (!record) {
            return NextResponse.json({ status: false, message: "Ruta o gira no encontrada" }, { status: 404 });
        }

        // Actualizar el registro
        const updated_record = await prisma.c_rutas_giras.update({
            where: { id },
            data: {
                sociedad: sociedad !== undefined ? sociedad : record.sociedad,
                cliente: cliente !== undefined ? cliente : record.cliente,
                zona: zona !== undefined ? zona : record.zona,
                cantidad_personal: cantidad_personal !== undefined ? cantidad_personal : record.cantidad_personal,
                gira_ruta: gira_ruta !== undefined ? gira_ruta : record.gira_ruta,
                dia_entrega: dia_entrega !== undefined ? dia_entrega : record.dia_entrega,
                estatus: estatus !== undefined ? estatus : record.estatus,
                cumplimiento_supervision: cumplimiento_supervision !== undefined ? cumplimiento_supervision : record.cumplimiento_supervision,
                cumplimiento_entrega_insumos: cumplimiento_entrega_insumos !== undefined ? cumplimiento_entrega_insumos : record.cumplimiento_entrega_insumos,
                persona_refuerzo: persona_refuerzo !== undefined ? persona_refuerzo : record.persona_refuerzo,
                notas_cambios: notas_cambios !== undefined ? notas_cambios : record.notas_cambios,
                estado: estado !== undefined ? estado : record.estado,
                nombre_persona_refuerzo: nombre_persona_refuerzo !== undefined ? nombre_persona_refuerzo : record.nombre_persona_refuerzo,
            }
        });

        return NextResponse.json({ 
            status: true, 
            message: "Ruta o gira actualizada correctamente",
            data: {
                id: updated_record.id,
                empresa_id: updated_record.empresa_id,
                cliente_id: updated_record.cliente_id,
                contrato_id: updated_record.contrato_id,
                corpo_id: updated_record.corpo_id,
                puesto_id: updated_record.puesto_id,
                plaza_id: updated_record.plaza_id,
                sociedad: updated_record.sociedad,
                cliente: updated_record.cliente,
                zona: updated_record.zona,
                cantidad_personal: updated_record.cantidad_personal,
                gira_ruta: updated_record.gira_ruta,
                dia_entrega: updated_record.dia_entrega,
                estatus: updated_record.estatus,
                cumplimiento_supervision: updated_record.cumplimiento_supervision,
                cumplimiento_entrega_insumos: updated_record.cumplimiento_entrega_insumos,
                persona_refuerzo: updated_record.persona_refuerzo,
                notas_cambios: updated_record.notas_cambios,
                estado: updated_record.estado,
                nombre_persona_refuerzo: updated_record.nombre_persona_refuerzo,
                created_at: updated_record.created_at,
                created_by: updated_record.created_by,
            }
        }, { status: 200 });
    }
    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, expired, payload, message } = verifyAccessToken(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const id = resolvedParams.id;

        if (!id) {
            return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 400 });
        }

        const record = await prisma.c_rutas_giras.findUnique({ where: { id } });
        if (!record) {
            return NextResponse.json({ status: false, message: "Ruta o gira no encontrada" }, { status: 404 });
        }

        await prisma.c_rutas_giras.delete({ where: { id } });

        return NextResponse.json({ status: true, message: "Ruta o gira eliminada correctamente" }, { status: 200 });
    }
    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}

