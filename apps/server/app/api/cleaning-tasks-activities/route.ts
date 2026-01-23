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
            miscelaneo,
            area_piso,
            turno_inicio,
            turno_fin,
            mes,
            supervisor,
            sucursal,
            area,
            cliente,
            actividades_ejecucion_diaria,
            actividades_ejecucion_semanal,
            actividades_quincenales,
            actividades_mensual,
            actividades_bimensual,
            actividades_trimestral,
            actividades_cuatrimestral,
            actividades_semestral,
            actividades_anual,
            otras_actividades,
            programa_eventos_especiales,
            firma_miscelaneo,
            firma_supervisor
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
        const new_record = await prisma.c_registro_tareas_actividades_limpieza.create({
            data: {
                empresa_id: marcaDia.empresa_id?.toString() || null,
                cliente_id: marcaDia.cliente_id?.toString() || null,
                contrato_id: marcaDia.contrato_id?.toString() || null,
                corpo_id: marcaDia.corpo_id?.toString() || null,
                puesto_id: marcaDia.puesto_id?.toString() || null,
                plaza_id: marcaDia.plaza_id?.toString() || null,
                miscelaneo: miscelaneo || null,
                area_piso: area_piso || null,
                turno_inicio: turno_inicio || null,
                turno_fin: turno_fin || null,
                mes: mes || null,
                supervisor: supervisor || null,
                sucursal: sucursal || null,
                area: area || null,
                cliente: cliente || null,
                actividades_ejecucion_diaria: actividades_ejecucion_diaria || null,
                actividades_ejecucion_semanal: actividades_ejecucion_semanal || null,
                actividades_quincenales: actividades_quincenales || null,
                actividades_mensual: actividades_mensual || null,
                actividades_bimensual: actividades_bimensual || null,
                actividades_trimestral: actividades_trimestral || null,
                actividades_cuatrimestral: actividades_cuatrimestral || null,
                actividades_semestral: actividades_semestral || null,
                actividades_anual: actividades_anual || null,
                otras_actividades: otras_actividades || null,
                programa_eventos_especiales: programa_eventos_especiales || null,
                firma_miscelaneo: firma_miscelaneo || null,
                firma_supervisor: firma_supervisor || null,
                created_at: toZonedTime(new Date(), "America/Costa_Rica"),
                created_by: payload.id?.toString() || null
            }
        });

        return NextResponse.json({ 
            status: true, 
            message: "Registro de tareas o actividades de limpieza creado correctamente",
            data: {
                id: new_record.id,
                empresa_id: new_record.empresa_id,
                cliente_id: new_record.cliente_id,
                contrato_id: new_record.contrato_id,
                corpo_id: new_record.corpo_id,
                puesto_id: new_record.puesto_id,
                plaza_id: new_record.plaza_id,
                miscelaneo: new_record.miscelaneo,
                area_piso: new_record.area_piso,
                turno_inicio: new_record.turno_inicio,
                turno_fin: new_record.turno_fin,
                mes: new_record.mes,
                supervisor: new_record.supervisor,
                sucursal: new_record.sucursal,
                area: new_record.area,
                cliente: new_record.cliente,
                actividades_ejecucion_diaria: new_record.actividades_ejecucion_diaria,
                actividades_ejecucion_semanal: new_record.actividades_ejecucion_semanal,
                actividades_quincenales: new_record.actividades_quincenales,
                actividades_mensual: new_record.actividades_mensual,
                actividades_bimensual: new_record.actividades_bimensual,
                actividades_trimestral: new_record.actividades_trimestral,
                actividades_cuatrimestral: new_record.actividades_cuatrimestral,
                actividades_semestral: new_record.actividades_semestral,
                actividades_anual: new_record.actividades_anual,
                otras_actividades: new_record.otras_actividades,
                programa_eventos_especiales: new_record.programa_eventos_especiales,
                firma_miscelaneo: new_record.firma_miscelaneo,
                firma_supervisor: new_record.firma_supervisor,
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

