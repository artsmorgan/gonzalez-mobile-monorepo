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

        const updated_record = await prisma.c_plan_trabajo_aseo_limpieza.update({
            where: { id },
            data: {
                ubicacion: ubicacion !== undefined ? ubicacion : undefined,
                objetivo: objetivo !== undefined ? objetivo : undefined,
                metodologia_trabajo_ambitos_accion: metodologia_trabajo_ambitos_accion !== undefined ? metodologia_trabajo_ambitos_accion : undefined,
                rol_horario_trabajo: rol_horario_trabajo !== undefined ? rol_horario_trabajo : undefined,
                uniformes: uniformes !== undefined ? uniformes : undefined,
                equipos: equipos !== undefined ? equipos : undefined,
                accesorios_varios: accesorios_varios !== undefined ? accesorios_varios : undefined,
                tiempo_respuesta_disposicion_imprevistos: tiempo_respuesta_disposicion_imprevistos !== undefined ? tiempo_respuesta_disposicion_imprevistos : undefined,
                distribucion_diaria_labores_personal: distribucion_diaria_labores_personal !== undefined ? distribucion_diaria_labores_personal : undefined,
                frecuencia_minima_limpieza_areas: frecuencia_minima_limpieza_areas !== undefined ? frecuencia_minima_limpieza_areas : undefined,
                supervision_metodo_rol_visitas: supervision_metodo_rol_visitas !== undefined ? supervision_metodo_rol_visitas : undefined,
                estrategia_adecuado_continuo_servicio: estrategia_adecuado_continuo_servicio !== undefined ? estrategia_adecuado_continuo_servicio : undefined,
                responsable_general_contrato: responsable_general_contrato !== undefined ? responsable_general_contrato : undefined,
                formularios_registro_control_puestos_equipos: formularios_registro_control_puestos_equipos !== undefined ? formularios_registro_control_puestos_equipos : undefined,
                plan_capacitacion: plan_capacitacion !== undefined ? plan_capacitacion : undefined,
            }
        });

        return NextResponse.json({
            status: true,
            message: "Plan de trabajo - Personal Aseo y limpieza actualizado correctamente",
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

        await prisma.c_plan_trabajo_aseo_limpieza.delete({
            where: { id }
        });

        return NextResponse.json({
            status: true,
            message: "Plan de trabajo - Personal Aseo y limpieza eliminado correctamente"
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

