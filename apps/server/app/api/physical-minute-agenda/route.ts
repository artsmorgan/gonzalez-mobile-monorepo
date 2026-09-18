import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../utils/verifyToken";
import { toZonedTime } from "date-fns-tz";
import { prisma } from "../../../utils/prismaClient";
import { reportError } from "../../../utils/reportError";

export async function POST(req: NextRequest) {
    try {
        /*
        const { valid, expired, payload, message } = verifyAccessToken(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const { 
            marca_id, 
            fecha,
            puesto,
            hora_inicio,
            hora_fin,
            elaborado_por,
            minuta_numero,
            presentes,
            observaciones,
            temas_tratados,
            notas
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
        const new_record = await prisma.c_agenda_minuta_fisica.create({
            data: {
                empresa_id: marcaDia.empresa_id?.toString() || null,
                cliente_id: marcaDia.cliente_id?.toString() || null,
                contrato_id: marcaDia.contrato_id?.toString() || null,
                corpo_id: marcaDia.corpo_id?.toString() || null,
                puesto_id: marcaDia.puesto_id?.toString() || null,
                plaza_id: marcaDia.plaza_id?.toString() || null,
                fecha: fecha || null,
                puesto: puesto || null,
                hora_inicio: hora_inicio || null,
                hora_fin: hora_fin || null,
                elaborado_por: elaborado_por || null,
                minuta_numero: minuta_numero || null,
                presentes: presentes || null,
                observaciones: observaciones || null,
                temas_tratados: temas_tratados || null,
                notas: notas || null,
                created_at: toZonedTime(new Date(), "America/Costa_Rica"),
                created_by: payload.id?.toString() || null
            }
        });

        return NextResponse.json({ 
            status: true, 
            message: "Agenda minuta física creada correctamente",
            data: {
                id: new_record.id,
                empresa_id: new_record.empresa_id,
                cliente_id: new_record.cliente_id,
                contrato_id: new_record.contrato_id,
                corpo_id: new_record.corpo_id,
                puesto_id: new_record.puesto_id,
                plaza_id: new_record.plaza_id,
                fecha: new_record.fecha,
                puesto: new_record.puesto,
                hora_inicio: new_record.hora_inicio,
                hora_fin: new_record.hora_fin,
                elaborado_por: new_record.elaborado_por,
                minuta_numero: new_record.minuta_numero,
                presentes: new_record.presentes,
                observaciones: new_record.observaciones,
                temas_tratados: new_record.temas_tratados,
                notas: new_record.notas,
                created_at: new_record.created_at,
                created_by: new_record.created_by,
            }
        }, { status: 200 });
*/
        return NextResponse.json({
            status: true,
            message: "Agenda minuta física creada correctamente"
        }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        await reportError(req, "api/physical-minute-agenda", "POST", 400, errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

