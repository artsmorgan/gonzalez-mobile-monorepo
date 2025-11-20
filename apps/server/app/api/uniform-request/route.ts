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
            codigo, 
            nombre_completo, 
            cliente_area, 
            ultima_fecha_uniformes, 
            talla_scrub_naranja, 
            talla_pantalon, 
            talla_zapatos,
            estado,
            persona_designada_entrega,
            no_procede_hasta,
            estatus_designado_entrega
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
        const new_request = await prisma.c_solicitud_uniforme.create({
            data: {
                empresa_id: marcaDia.empresa_id?.toString() || null,
                cliente_id: marcaDia.cliente_id?.toString() || null,
                contrato_id: marcaDia.contrato_id?.toString() || null,
                corpo_id: marcaDia.corpo_id?.toString() || null,
                puesto_id: marcaDia.puesto_id?.toString() || null,
                plaza_id: marcaDia.plaza_id?.toString() || null,
                codigo: codigo || null,
                nombre_completo: nombre_completo || null,
                cliente_area: cliente_area || null,
                ultima_fecha_uniformes: ultima_fecha_uniformes || null,
                talla_scrub_naranja: talla_scrub_naranja || null,
                talla_pantalon: talla_pantalon || null,
                talla_zapatos: talla_zapatos || null,
                estado: estado || null,
                persona_designada_entrega: persona_designada_entrega || null,
                no_procede_hasta: no_procede_hasta || null,
                estatus_designado_entrega: estatus_designado_entrega || null,
                created_at: toZonedTime(new Date(), "America/Costa_Rica"),
                created_by: payload.id?.toString() || null
            }
        });

        return NextResponse.json({ 
            status: true, 
            message: "Solicitud de uniforme creada correctamente",
            data: {
                id: new_request.id,
                empresa_id: new_request.empresa_id,
                cliente_id: new_request.cliente_id,
                contrato_id: new_request.contrato_id,
                corpo_id: new_request.corpo_id,
                puesto_id: new_request.puesto_id,
                plaza_id: new_request.plaza_id,
                codigo: new_request.codigo,
                nombre_completo: new_request.nombre_completo,
                cliente_area: new_request.cliente_area,
                ultima_fecha_uniformes: new_request.ultima_fecha_uniformes,
                talla_scrub_naranja: new_request.talla_scrub_naranja,
                talla_pantalon: new_request.talla_pantalon,
                talla_zapatos: new_request.talla_zapatos,
                estado: new_request.estado,
                persona_designada_entrega: new_request.persona_designada_entrega,
                no_procede_hasta: new_request.no_procede_hasta,
                estatus_designado_entrega: new_request.estatus_designado_entrega,
                created_at: new_request.created_at,
                created_by: new_request.created_by,
            }
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

