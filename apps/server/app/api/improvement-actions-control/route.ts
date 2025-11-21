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
            numero_accion,
            causa_origen,
            fecha_deteccion_incidencia,
            mes_deteccion,
            tipo_accion,
            proceso_relacionado,
            encargado_proceso,
            origen_accion,
            fecha_elaboracion_plan,
            tiempo_plan_vs_deteccion,
            plan_elaborado_a_tiempo,
            detalle_nc_opr_dm,
            analisis_causas,
            accion_inmediata,
            accion_mejora,
            fecha_aprobacion,
            responsable_ejecucion,
            fecha_programada_ejecucion,
            fecha_real_ejecucion,
            mes_ejecucion,
            modif_fecha_ejecucion_motivo,
            aplica_seguimiento,
            seguimiento_meses,
            evidencias,
            estado_accion,
            a_tiempo,
            no_conformidades_similares,
            reincidencia,
            actualiza_matriz_riesgos,
            efectividad,
            no_efectiva,
            cambiar_al_8d,
            cerrada,
            dueño_proceso
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
        const new_record = await prisma.c_control_acciones_mejora.create({
            data: {
                empresa_id: marcaDia.empresa_id?.toString() || null,
                cliente_id: marcaDia.cliente_id?.toString() || null,
                contrato_id: marcaDia.contrato_id?.toString() || null,
                corpo_id: marcaDia.corpo_id?.toString() || null,
                puesto_id: marcaDia.puesto_id?.toString() || null,
                plaza_id: marcaDia.plaza_id?.toString() || null,
                numero_accion: numero_accion || null,
                causa_origen: causa_origen || null,
                fecha_deteccion_incidencia: fecha_deteccion_incidencia || null,
                mes_deteccion: mes_deteccion || null,
                tipo_accion: tipo_accion || null,
                proceso_relacionado: proceso_relacionado || null,
                encargado_proceso: encargado_proceso || null,
                origen_accion: origen_accion || null,
                fecha_elaboracion_plan: fecha_elaboracion_plan || null,
                tiempo_plan_vs_deteccion: tiempo_plan_vs_deteccion || null,
                plan_elaborado_a_tiempo: plan_elaborado_a_tiempo || null,
                detalle_nc_opr_dm: detalle_nc_opr_dm || null,
                analisis_causas: analisis_causas || null,
                accion_inmediata: accion_inmediata || null,
                accion_mejora: accion_mejora || null,
                fecha_aprobacion: fecha_aprobacion || null,
                responsable_ejecucion: responsable_ejecucion || null,
                fecha_programada_ejecucion: fecha_programada_ejecucion || null,
                fecha_real_ejecucion: fecha_real_ejecucion || null,
                mes_ejecucion: mes_ejecucion || null,
                modif_fecha_ejecucion_motivo: modif_fecha_ejecucion_motivo || null,
                aplica_seguimiento: aplica_seguimiento || null,
                seguimiento_meses: seguimiento_meses || null,
                evidencias: evidencias || null,
                estado_accion: estado_accion || null,
                a_tiempo: a_tiempo || null,
                no_conformidades_similares: no_conformidades_similares || null,
                reincidencia: reincidencia || null,
                actualiza_matriz_riesgos: actualiza_matriz_riesgos || null,
                efectividad: efectividad || null,
                no_efectiva: no_efectiva || null,
                cambiar_al_8d: cambiar_al_8d || null,
                cerrada: cerrada || null,
                dueño_proceso: dueño_proceso || null,
                created_at: toZonedTime(new Date(), "America/Costa_Rica"),
                created_by: payload.id?.toString() || null
            }
        });

        return NextResponse.json({ 
            status: true, 
            message: "Control de acciones de mejora creado correctamente",
            data: new_record
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

