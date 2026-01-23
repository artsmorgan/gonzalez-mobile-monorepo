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
            metodologia,
            rol_horario,
            uniformes,
            equipos,
            accesorios_varios,
            tiempo_respuesta,
            distribucion_labores,
            frecuencia_limpieza,
            supervision,
            estrategia,
            responsable,
            formularios,
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
        const new_record = await prisma.c_plan_gestion_ambiental.create({
            data: {
                empresa_id: marcaDia.empresa_id?.toString() || null,
                cliente_id: marcaDia.cliente_id?.toString() || null,
                contrato_id: marcaDia.contrato_id?.toString() || null,
                corpo_id: marcaDia.corpo_id?.toString() || null,
                puesto_id: marcaDia.puesto_id?.toString() || null,
                plaza_id: marcaDia.plaza_id?.toString() || null,
                ubicacion: ubicacion || null,
                objetivo: objetivo || null,
                metodologia: metodologia || null,
                rol_horario: rol_horario || null,
                uniformes: uniformes || null,
                equipos: equipos || null,
                accesorios_varios: accesorios_varios || null,
                tiempo_respuesta: tiempo_respuesta || null,
                distribucion_labores: distribucion_labores || null,
                frecuencia_limpieza: frecuencia_limpieza || null,
                supervision: supervision || null,
                estrategia: estrategia || null,
                responsable: responsable || null,
                formularios: formularios || null,
                plan_capacitacion: plan_capacitacion || null,
                created_at: toZonedTime(new Date(), "America/Costa_Rica"),
                created_by: payload.id?.toString() || null
            }
        });

        return NextResponse.json({ 
            status: true, 
            message: "Plan de gestión ambiental creado correctamente",
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
                metodologia: new_record.metodologia,
                rol_horario: new_record.rol_horario,
                uniformes: new_record.uniformes,
                equipos: new_record.equipos,
                accesorios_varios: new_record.accesorios_varios,
                tiempo_respuesta: new_record.tiempo_respuesta,
                distribucion_labores: new_record.distribucion_labores,
                frecuencia_limpieza: new_record.frecuencia_limpieza,
                supervision: new_record.supervision,
                estrategia: new_record.estrategia,
                responsable: new_record.responsable,
                formularios: new_record.formularios,
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

