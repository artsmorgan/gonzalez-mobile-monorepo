import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../utils/verifyToken";
import { toZonedTime } from "date-fns-tz";
import { prisma } from "../../../utils/prismaClient";

export async function POST(req: NextRequest) {
    try {
        const { valid, expired, payload, message } = verifyAccessToken(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const { 
            marca_id, 
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

        if (!marca_id) {
            return NextResponse.json({ status: false, message: "Marca no especificada" }, { status: 400 });
        }

        const marcaDia = await prisma.c_marca_dia.findUnique({ where: { id: parseInt(marca_id) } });
        if (!marcaDia) {
            return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 404 });
        }

        if (!marcaDia.empleadoFijo_id) {
            return NextResponse.json({ status: false, message: "Empleado no encontrado" }, { status: 404 });
        }

        // Autocompletar campos desde la marca
        const new_record = await prisma.c_rutas_giras.create({
            data: {
                empresa_id: marcaDia.empresa_id?.toString() || null,
                cliente_id: marcaDia.cliente_id?.toString() || null,
                contrato_id: marcaDia.contrato_id?.toString() || null,
                corpo_id: marcaDia.corpo_id?.toString() || null,
                puesto_id: marcaDia.puesto_id?.toString() || null,
                plaza_id: marcaDia.plaza_id?.toString() || null,
                sociedad: sociedad || null,
                cliente: cliente || null,
                zona: zona || null,
                cantidad_personal: cantidad_personal || null,
                gira_ruta: gira_ruta || null,
                dia_entrega: dia_entrega || null,
                estatus: estatus || null,
                cumplimiento_supervision: cumplimiento_supervision || null,
                cumplimiento_entrega_insumos: cumplimiento_entrega_insumos || null,
                persona_refuerzo: persona_refuerzo || null,
                notas_cambios: notas_cambios || null,
                estado: estado || null,
                nombre_persona_refuerzo: nombre_persona_refuerzo || null,
                created_at: toZonedTime(new Date(), "America/Costa_Rica"),
                created_by: payload.id?.toString() || null
            }
        });

        return NextResponse.json({ 
            status: true, 
            message: "Ruta o gira creada correctamente",
            data: {
                id: new_record.id,
                empresa_id: new_record.empresa_id,
                cliente_id: new_record.cliente_id,
                contrato_id: new_record.contrato_id,
                corpo_id: new_record.corpo_id,
                puesto_id: new_record.puesto_id,
                plaza_id: new_record.plaza_id,
                sociedad: new_record.sociedad,
                cliente: new_record.cliente,
                zona: new_record.zona,
                cantidad_personal: new_record.cantidad_personal,
                gira_ruta: new_record.gira_ruta,
                dia_entrega: new_record.dia_entrega,
                estatus: new_record.estatus,
                cumplimiento_supervision: new_record.cumplimiento_supervision,
                cumplimiento_entrega_insumos: new_record.cumplimiento_entrega_insumos,
                persona_refuerzo: new_record.persona_refuerzo,
                notas_cambios: new_record.notas_cambios,
                estado: new_record.estado,
                nombre_persona_refuerzo: new_record.nombre_persona_refuerzo,
                created_at: new_record.created_at,
                created_by: new_record.created_by,
            }
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

