import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../utils/verifyToken";
import { prisma } from "../../../../utils/prismaClient";

export async function PUT(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { valid, expired, payload, message } = verifyAccessToken(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const { id } = resolvedParams;
        const {
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

        const updated_record = await prisma.c_control_acciones_mejora.update({
            where: { id },
            data: {
                numero_accion: numero_accion !== undefined ? numero_accion : undefined,
                causa_origen: causa_origen !== undefined ? causa_origen : undefined,
                fecha_deteccion_incidencia: fecha_deteccion_incidencia !== undefined ? fecha_deteccion_incidencia : undefined,
                mes_deteccion: mes_deteccion !== undefined ? mes_deteccion : undefined,
                tipo_accion: tipo_accion !== undefined ? tipo_accion : undefined,
                proceso_relacionado: proceso_relacionado !== undefined ? proceso_relacionado : undefined,
                encargado_proceso: encargado_proceso !== undefined ? encargado_proceso : undefined,
                origen_accion: origen_accion !== undefined ? origen_accion : undefined,
                fecha_elaboracion_plan: fecha_elaboracion_plan !== undefined ? fecha_elaboracion_plan : undefined,
                tiempo_plan_vs_deteccion: tiempo_plan_vs_deteccion !== undefined ? tiempo_plan_vs_deteccion : undefined,
                plan_elaborado_a_tiempo: plan_elaborado_a_tiempo !== undefined ? plan_elaborado_a_tiempo : undefined,
                detalle_nc_opr_dm: detalle_nc_opr_dm !== undefined ? detalle_nc_opr_dm : undefined,
                analisis_causas: analisis_causas !== undefined ? analisis_causas : undefined,
                accion_inmediata: accion_inmediata !== undefined ? accion_inmediata : undefined,
                accion_mejora: accion_mejora !== undefined ? accion_mejora : undefined,
                fecha_aprobacion: fecha_aprobacion !== undefined ? fecha_aprobacion : undefined,
                responsable_ejecucion: responsable_ejecucion !== undefined ? responsable_ejecucion : undefined,
                fecha_programada_ejecucion: fecha_programada_ejecucion !== undefined ? fecha_programada_ejecucion : undefined,
                fecha_real_ejecucion: fecha_real_ejecucion !== undefined ? fecha_real_ejecucion : undefined,
                mes_ejecucion: mes_ejecucion !== undefined ? mes_ejecucion : undefined,
                modif_fecha_ejecucion_motivo: modif_fecha_ejecucion_motivo !== undefined ? modif_fecha_ejecucion_motivo : undefined,
                aplica_seguimiento: aplica_seguimiento !== undefined ? aplica_seguimiento : undefined,
                seguimiento_meses: seguimiento_meses !== undefined ? seguimiento_meses : undefined,
                evidencias: evidencias !== undefined ? evidencias : undefined,
                estado_accion: estado_accion !== undefined ? estado_accion : undefined,
                a_tiempo: a_tiempo !== undefined ? a_tiempo : undefined,
                no_conformidades_similares: no_conformidades_similares !== undefined ? no_conformidades_similares : undefined,
                reincidencia: reincidencia !== undefined ? reincidencia : undefined,
                actualiza_matriz_riesgos: actualiza_matriz_riesgos !== undefined ? actualiza_matriz_riesgos : undefined,
                efectividad: efectividad !== undefined ? efectividad : undefined,
                no_efectiva: no_efectiva !== undefined ? no_efectiva : undefined,
                cambiar_al_8d: cambiar_al_8d !== undefined ? cambiar_al_8d : undefined,
                cerrada: cerrada !== undefined ? cerrada : undefined,
                dueño_proceso: dueño_proceso !== undefined ? dueño_proceso : undefined,
            }
        });

        return NextResponse.json({
            status: true,
            message: "Control de acciones de mejora actualizado correctamente",
            data: updated_record
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
        const { valid, expired, payload, message } = verifyAccessToken(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const { id } = resolvedParams;

        await prisma.c_control_acciones_mejora.delete({
            where: { id }
        });

        return NextResponse.json({
            status: true,
            message: "Control de acciones de mejora eliminado correctamente"
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

