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
            fecha,
            piso,
            area,
            aseador,
            supervisor,
            limpieza_general,
            cuarto_aseo,
            servicios_sanitarios,
            uniforme_presentacion,
            estado_equipos,
            calificacion_general,
            firma_aseador,
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
        const new_record = await prisma.c_informe_supervision.create({
            data: {
                empresa_id: marcaDia.empresa_id?.toString() || null,
                cliente_id: marcaDia.cliente_id?.toString() || null,
                contrato_id: marcaDia.contrato_id?.toString() || null,
                corpo_id: marcaDia.corpo_id?.toString() || null,
                puesto_id: marcaDia.puesto_id?.toString() || null,
                plaza_id: marcaDia.plaza_id?.toString() || null,
                fecha: fecha || null,
                piso: piso || null,
                area: area || null,
                aseador: aseador || null,
                supervisor: supervisor || null,
                limpieza_general: limpieza_general || null,
                cuarto_aseo: cuarto_aseo || null,
                servicios_sanitarios: servicios_sanitarios || null,
                uniforme_presentacion: uniforme_presentacion || null,
                estado_equipos: estado_equipos || null,
                calificacion_general: calificacion_general || null,
                firma_aseador: firma_aseador || null,
                firma_supervisor: firma_supervisor || null,
                created_at: toZonedTime(new Date(), "America/Costa_Rica"),
                created_by: payload.id?.toString() || null
            }
        });

        return NextResponse.json({ 
            status: true, 
            message: "Informe de Supervisión creado correctamente",
            data: {
                id: new_record.id,
                empresa_id: new_record.empresa_id,
                cliente_id: new_record.cliente_id,
                contrato_id: new_record.contrato_id,
                corpo_id: new_record.corpo_id,
                puesto_id: new_record.puesto_id,
                plaza_id: new_record.plaza_id,
                fecha: new_record.fecha,
                piso: new_record.piso,
                area: new_record.area,
                aseador: new_record.aseador,
                supervisor: new_record.supervisor,
                limpieza_general: new_record.limpieza_general,
                cuarto_aseo: new_record.cuarto_aseo,
                servicios_sanitarios: new_record.servicios_sanitarios,
                uniforme_presentacion: new_record.uniforme_presentacion,
                estado_equipos: new_record.estado_equipos,
                calificacion_general: new_record.calificacion_general,
                firma_aseador: new_record.firma_aseador,
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

