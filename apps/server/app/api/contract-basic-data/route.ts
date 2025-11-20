import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../utils/verifyToken";
import { toZonedTime } from "date-fns-tz";
import { prisma } from "../../../utils/prismaClient";

export async function POST(req: NextRequest) {
    try {
        const { valid, payload, message } = verifyAccessToken(req);

        if (!valid) {
            return NextResponse.json(
                { status: false, message: message },
                { status: 401 }
            );
        }

        const { 
            marca_id, 
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
        const new_record = await prisma.c_datos_basicos_contrato.create({
            data: {
                empresa_id: marcaDia.empresa_id?.toString() || null,
                cliente_id: marcaDia.cliente_id?.toString() || null,
                contrato_id: marcaDia.contrato_id?.toString() || null,
                corpo_id: marcaDia.corpo_id?.toString() || null,
                puesto_id: marcaDia.puesto_id?.toString() || null,
                plaza_id: marcaDia.plaza_id?.toString() || null,
                fecha_inicio_contrato: fecha_inicio_contrato || null,
                cliente_contrato: cliente_contrato || null,
                ejecutivo_gerente_asistente: ejecutivo_gerente_asistente || null,
                personal: personal || null,
                lugar_servicio: lugar_servicio || null,
                roles_horarios: roles_horarios || null,
                desglose_salarios: desglose_salarios || null,
                tipo_uniforme: tipo_uniforme || null,
                tipo_arma: tipo_arma || null,
                capacitaciones: capacitaciones || null,
                otros_datos: otros_datos || null,
                created_at: toZonedTime(new Date(), "America/Costa_Rica"),
                created_by: payload.id?.toString() || null
            }
        });

        return NextResponse.json({ 
            status: true, 
            message: "Datos básicos de contrato creados correctamente",
            data: {
                id: new_record.id,
                empresa_id: new_record.empresa_id,
                cliente_id: new_record.cliente_id,
                contrato_id: new_record.contrato_id,
                corpo_id: new_record.corpo_id,
                puesto_id: new_record.puesto_id,
                plaza_id: new_record.plaza_id,
                fecha_inicio_contrato: new_record.fecha_inicio_contrato,
                cliente_contrato: new_record.cliente_contrato,
                ejecutivo_gerente_asistente: new_record.ejecutivo_gerente_asistente,
                personal: new_record.personal,
                lugar_servicio: new_record.lugar_servicio,
                roles_horarios: new_record.roles_horarios,
                desglose_salarios: new_record.desglose_salarios,
                tipo_uniforme: new_record.tipo_uniforme,
                tipo_arma: new_record.tipo_arma,
                capacitaciones: new_record.capacitaciones,
                otros_datos: new_record.otros_datos,
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

