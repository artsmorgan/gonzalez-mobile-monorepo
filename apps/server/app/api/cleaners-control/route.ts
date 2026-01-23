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
            nombre_aseador,
            oficina_despacho,
            provincia,
            canton,
            distrito,
            direccion,
            metraje,
            horario,
            horas_dia,
            horas_semana,
            dias,
            cantidad_personal,
            detalle_supervision,
            fecha_inicio,
            lista_equipos_insumos,
            costo_mensual,
            costo_anual,
            codigo,
            plaza,
            observaciones
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
        const new_record = await prisma.c_control_aseadores.create({
            data: {
                empresa_id: marcaDia.empresa_id?.toString() || null,
                cliente_id: marcaDia.cliente_id?.toString() || null,
                contrato_id: marcaDia.contrato_id?.toString() || null,
                corpo_id: marcaDia.corpo_id?.toString() || null,
                puesto_id: marcaDia.puesto_id?.toString() || null,
                plaza_id: marcaDia.plaza_id?.toString() || null,
                nombre_aseador: nombre_aseador || null,
                oficina_despacho: oficina_despacho || null,
                provincia: provincia || null,
                canton: canton || null,
                distrito: distrito || null,
                direccion: direccion || null,
                metraje: metraje || null,
                horario: horario || null,
                horas_dia: horas_dia || null,
                horas_semana: horas_semana || null,
                dias: dias || null,
                cantidad_personal: cantidad_personal || null,
                detalle_supervision: detalle_supervision || null,
                fecha_inicio: fecha_inicio || null,
                lista_equipos_insumos: lista_equipos_insumos || null,
                costo_mensual: costo_mensual || null,
                costo_anual: costo_anual || null,
                codigo: codigo || null,
                plaza: plaza || null,
                observaciones: observaciones || null,
                created_at: toZonedTime(new Date(), "America/Costa_Rica"),
                created_by: payload.id?.toString() || null
            }
        });

        return NextResponse.json({ 
            status: true, 
            message: "Control de aseadores creado correctamente",
            data: {
                id: new_record.id,
                empresa_id: new_record.empresa_id,
                cliente_id: new_record.cliente_id,
                contrato_id: new_record.contrato_id,
                corpo_id: new_record.corpo_id,
                puesto_id: new_record.puesto_id,
                plaza_id: new_record.plaza_id,
                nombre_aseador: new_record.nombre_aseador,
                oficina_despacho: new_record.oficina_despacho,
                provincia: new_record.provincia,
                canton: new_record.canton,
                distrito: new_record.distrito,
                direccion: new_record.direccion,
                metraje: new_record.metraje,
                horario: new_record.horario,
                horas_dia: new_record.horas_dia,
                horas_semana: new_record.horas_semana,
                dias: new_record.dias,
                cantidad_personal: new_record.cantidad_personal,
                detalle_supervision: new_record.detalle_supervision,
                fecha_inicio: new_record.fecha_inicio,
                lista_equipos_insumos: new_record.lista_equipos_insumos,
                costo_mensual: new_record.costo_mensual,
                costo_anual: new_record.costo_anual,
                codigo: new_record.codigo,
                plaza: new_record.plaza,
                observaciones: new_record.observaciones,
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

