import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../utils/verifyToken";
import { toZonedTime } from "date-fns-tz";
import { prisma } from "../../../../utils/prismaClient";

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, payload, message } = verifyAccessToken(req);

        if (!valid) {
            return NextResponse.json(
                { status: false, message: message },
                { status: 401 }
            );
        }

        const resolvedParams = await context.params;
        const id = resolvedParams.id;

        if (!id) {
            return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 400 });
        }

        const { 
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

        const request = await prisma.c_solicitud_uniforme.findUnique({ where: { id } });
        if (!request) {
            return NextResponse.json({ status: false, message: "Solicitud de uniforme no encontrada" }, { status: 404 });
        }

        // Actualizar la solicitud
        const updated_request = await prisma.c_solicitud_uniforme.update({
            where: { id },
            data: {
                codigo: codigo !== undefined ? codigo : request.codigo,
                nombre_completo: nombre_completo !== undefined ? nombre_completo : request.nombre_completo,
                cliente_area: cliente_area !== undefined ? cliente_area : request.cliente_area,
                ultima_fecha_uniformes: ultima_fecha_uniformes !== undefined ? ultima_fecha_uniformes : request.ultima_fecha_uniformes,
                talla_scrub_naranja: talla_scrub_naranja !== undefined ? talla_scrub_naranja : request.talla_scrub_naranja,
                talla_pantalon: talla_pantalon !== undefined ? talla_pantalon : request.talla_pantalon,
                talla_zapatos: talla_zapatos !== undefined ? talla_zapatos : request.talla_zapatos,
                estado: estado !== undefined ? estado : request.estado,
                persona_designada_entrega: persona_designada_entrega !== undefined ? persona_designada_entrega : request.persona_designada_entrega,
                no_procede_hasta: no_procede_hasta !== undefined ? no_procede_hasta : request.no_procede_hasta,
                estatus_designado_entrega: estatus_designado_entrega !== undefined ? estatus_designado_entrega : request.estatus_designado_entrega,
            }
        });

        return NextResponse.json({ 
            status: true, 
            message: "Solicitud de uniforme actualizada correctamente",
            data: {
                id: updated_request.id,
                empresa_id: updated_request.empresa_id,
                cliente_id: updated_request.cliente_id,
                contrato_id: updated_request.contrato_id,
                corpo_id: updated_request.corpo_id,
                puesto_id: updated_request.puesto_id,
                plaza_id: updated_request.plaza_id,
                codigo: updated_request.codigo,
                nombre_completo: updated_request.nombre_completo,
                cliente_area: updated_request.cliente_area,
                ultima_fecha_uniformes: updated_request.ultima_fecha_uniformes,
                talla_scrub_naranja: updated_request.talla_scrub_naranja,
                talla_pantalon: updated_request.talla_pantalon,
                talla_zapatos: updated_request.talla_zapatos,
                estado: updated_request.estado,
                persona_designada_entrega: updated_request.persona_designada_entrega,
                no_procede_hasta: updated_request.no_procede_hasta,
                estatus_designado_entrega: updated_request.estatus_designado_entrega,
                created_at: updated_request.created_at,
                created_by: updated_request.created_by,
            }
        }, { status: 200 });
    }
    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, payload, message } = verifyAccessToken(req);

        if (!valid) {
            return NextResponse.json(
                { status: false, message: message },
                { status: 401 }
            );
        }

        const resolvedParams = await context.params;
        const id = resolvedParams.id;

        if (!id) {
            return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 400 });
        }

        const request = await prisma.c_solicitud_uniforme.findUnique({ where: { id } });
        if (!request) {
            return NextResponse.json({ status: false, message: "Solicitud de uniforme no encontrada" }, { status: 404 });
        }

        await prisma.c_solicitud_uniforme.delete({ where: { id } });

        return NextResponse.json({ status: true, message: "Solicitud de uniforme eliminada correctamente" }, { status: 200 });
    }
    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}

