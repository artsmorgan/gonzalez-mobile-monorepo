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
            ubicacion,
            objetivo,
            metodologia_trabajo_ambitos_accion,
            rol_horario_trabajo,
            uniformes,
            equipos,
            accesorios_varios,
            tiempo_respuesta_disposicion_imprevistos,
            distribucion_diaria_labores_personal,
            frecuencia_minima_limpieza_areas,
            supervision_metodo_rol_visitas,
            estrategia_adecuado_continuo_servicio,
            responsable_general_contrato,
            formularios_registro_control_puestos_equipos,
            plan_capacitacion
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
        const new_record = await prisma.c_plan_trabajo_aseo_limpieza.create({
            data: {
                empresa_id: marcaDia.empresa_id?.toString() || null,
                cliente_id: marcaDia.cliente_id?.toString() || null,
                contrato_id: marcaDia.contrato_id?.toString() || null,
                corpo_id: marcaDia.corpo_id?.toString() || null,
                puesto_id: marcaDia.puesto_id?.toString() || null,
                plaza_id: marcaDia.plaza_id?.toString() || null,
                ubicacion: ubicacion || null,
                objetivo: objetivo || null,
                metodologia_trabajo_ambitos_accion: metodologia_trabajo_ambitos_accion || null,
                rol_horario_trabajo: rol_horario_trabajo || null,
                uniformes: uniformes || null,
                equipos: equipos || null,
                accesorios_varios: accesorios_varios || null,
                tiempo_respuesta_disposicion_imprevistos: tiempo_respuesta_disposicion_imprevistos || null,
                distribucion_diaria_labores_personal: distribucion_diaria_labores_personal || null,
                frecuencia_minima_limpieza_areas: frecuencia_minima_limpieza_areas || null,
                supervision_metodo_rol_visitas: supervision_metodo_rol_visitas || null,
                estrategia_adecuado_continuo_servicio: estrategia_adecuado_continuo_servicio || null,
                responsable_general_contrato: responsable_general_contrato || null,
                formularios_registro_control_puestos_equipos: formularios_registro_control_puestos_equipos || null,
                plan_capacitacion: plan_capacitacion || null,
                created_at: toZonedTime(new Date(), "America/Costa_Rica"),
                created_by: payload.id?.toString() || null
            }
        });

        return NextResponse.json({ 
            status: true, 
            message: "Plan de trabajo - Personal Aseo y limpieza creado correctamente",
            data: {
                id: new_record.id,
                empresa_id: new_record.empresa_id,
                cliente_id: new_record.cliente_id,
                contrato_id: new_record.contrato_id,
                corpo_id: new_record.corpo_id,
                puesto_id: new_record.puesto_id,
                plaza_id: new_record.plaza_id,
                ubicacion: new_record.ubicacion,
                objetivo: new_record.objetivo,
                metodologia_trabajo_ambitos_accion: new_record.metodologia_trabajo_ambitos_accion,
                rol_horario_trabajo: new_record.rol_horario_trabajo,
                uniformes: new_record.uniformes,
                equipos: new_record.equipos,
                accesorios_varios: new_record.accesorios_varios,
                tiempo_respuesta_disposicion_imprevistos: new_record.tiempo_respuesta_disposicion_imprevistos,
                distribucion_diaria_labores_personal: new_record.distribucion_diaria_labores_personal,
                frecuencia_minima_limpieza_areas: new_record.frecuencia_minima_limpieza_areas,
                supervision_metodo_rol_visitas: new_record.supervision_metodo_rol_visitas,
                estrategia_adecuado_continuo_servicio: new_record.estrategia_adecuado_continuo_servicio,
                responsable_general_contrato: new_record.responsable_general_contrato,
                formularios_registro_control_puestos_equipos: new_record.formularios_registro_control_puestos_equipos,
                plan_capacitacion: new_record.plan_capacitacion,
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

