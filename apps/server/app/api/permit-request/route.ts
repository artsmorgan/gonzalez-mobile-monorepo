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
            persona_solicita,
            codigo,
            contrato,
            horario,
            fecha_solicitud,
            motivo_permiso,
            permiso_sustituido_por,
            codigo_sustituto,
            firma_gerente,
            firma_encargado_monitoreo,
            permiso_coordinado_por
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
        const new_record = await prisma.c_solicitud_permiso.create({
            data: {
                empresa_id: marcaDia.empresa_id?.toString() || null,
                cliente_id: marcaDia.cliente_id?.toString() || null,
                contrato_id: marcaDia.contrato_id?.toString() || null,
                corpo_id: marcaDia.corpo_id?.toString() || null,
                puesto_id: marcaDia.puesto_id?.toString() || null,
                plaza_id: marcaDia.plaza_id?.toString() || null,
                persona_solicita: persona_solicita || null,
                codigo: codigo || null,
                contrato: contrato || null,
                horario: horario || null,
                fecha_solicitud: fecha_solicitud || null,
                motivo_permiso: motivo_permiso || null,
                permiso_sustituido_por: permiso_sustituido_por || null,
                codigo_sustituto: codigo_sustituto || null,
                firma_gerente: firma_gerente || null,
                firma_encargado_monitoreo: firma_encargado_monitoreo || null,
                permiso_coordinado_por: permiso_coordinado_por || null,
                created_at: toZonedTime(new Date(), "America/Costa_Rica"),
                created_by: payload.id?.toString() || null
            }
        });

        return NextResponse.json({ 
            status: true, 
            message: "Solicitud de permiso creada correctamente",
            data: {
                id: new_record.id,
                empresa_id: new_record.empresa_id,
                cliente_id: new_record.cliente_id,
                contrato_id: new_record.contrato_id,
                corpo_id: new_record.corpo_id,
                puesto_id: new_record.puesto_id,
                plaza_id: new_record.plaza_id,
                persona_solicita: new_record.persona_solicita,
                codigo: new_record.codigo,
                contrato: new_record.contrato,
                horario: new_record.horario,
                fecha_solicitud: new_record.fecha_solicitud,
                motivo_permiso: new_record.motivo_permiso,
                permiso_sustituido_por: new_record.permiso_sustituido_por,
                codigo_sustituto: new_record.codigo_sustituto,
                firma_gerente: new_record.firma_gerente,
                firma_encargado_monitoreo: new_record.firma_encargado_monitoreo,
                permiso_coordinado_por: new_record.permiso_coordinado_por,
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

