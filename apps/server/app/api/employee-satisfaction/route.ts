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
            nombre_empleado,
            cliente_sede,
            tiempo_laborado,
            recibe_uniformes_tiempo,
            llevo_induccion,
            calificacion_induccion,
            recibe_visitas_supervision,
            recibe_atencion_oficina,
            problemas_pago_resueltos,
            equipo_proteccion,
            que_mejorar,
            considera_empresa_debe_mejorar,
            conoce_reportar_accidente,
            le_gustaria_capacitado
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
        const new_record = await prisma.c_satisfaccion_personal.create({
            data: {
                empresa_id: marcaDia.empresa_id?.toString() || null,
                cliente_id: marcaDia.cliente_id?.toString() || null,
                contrato_id: marcaDia.contrato_id?.toString() || null,
                corpo_id: marcaDia.corpo_id?.toString() || null,
                puesto_id: marcaDia.puesto_id?.toString() || null,
                plaza_id: marcaDia.plaza_id?.toString() || null,
                nombre_empleado: nombre_empleado || null,
                cliente_sede: cliente_sede || null,
                tiempo_laborado: tiempo_laborado || null,
                recibe_uniformes_tiempo: recibe_uniformes_tiempo || null,
                llevo_induccion: llevo_induccion || null,
                calificacion_induccion: calificacion_induccion || null,
                recibe_visitas_supervision: recibe_visitas_supervision || null,
                recibe_atencion_oficina: recibe_atencion_oficina || null,
                problemas_pago_resueltos: problemas_pago_resueltos || null,
                equipo_proteccion: equipo_proteccion || null,
                que_mejorar: que_mejorar || null,
                considera_empresa_debe_mejorar: considera_empresa_debe_mejorar || null,
                conoce_reportar_accidente: conoce_reportar_accidente || null,
                le_gustaria_capacitado: le_gustaria_capacitado || null,
                created_at: toZonedTime(new Date(), "America/Costa_Rica"),
                created_by: payload.id?.toString() || null
            }
        });

        return NextResponse.json({ 
            status: true, 
            message: "Encuesta de satisfacción creada correctamente",
            data: {
                id: new_record.id,
                empresa_id: new_record.empresa_id,
                cliente_id: new_record.cliente_id,
                contrato_id: new_record.contrato_id,
                corpo_id: new_record.corpo_id,
                puesto_id: new_record.puesto_id,
                plaza_id: new_record.plaza_id,
                nombre_empleado: new_record.nombre_empleado,
                cliente_sede: new_record.cliente_sede,
                tiempo_laborado: new_record.tiempo_laborado,
                recibe_uniformes_tiempo: new_record.recibe_uniformes_tiempo,
                llevo_induccion: new_record.llevo_induccion,
                calificacion_induccion: new_record.calificacion_induccion,
                recibe_visitas_supervision: new_record.recibe_visitas_supervision,
                recibe_atencion_oficina: new_record.recibe_atencion_oficina,
                problemas_pago_resueltos: new_record.problemas_pago_resueltos,
                equipo_proteccion: new_record.equipo_proteccion,
                que_mejorar: new_record.que_mejorar,
                considera_empresa_debe_mejorar: new_record.considera_empresa_debe_mejorar,
                conoce_reportar_accidente: new_record.conoce_reportar_accidente,
                le_gustaria_capacitado: new_record.le_gustaria_capacitado,
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

