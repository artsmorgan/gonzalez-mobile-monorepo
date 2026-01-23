import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../../utils/verifyToken";
import { prisma } from "../../../../../utils/prismaClient";

export async function GET(req: NextRequest, context: { params: Promise<{ corpo_id: string }> }) {
    try {
        const { valid, expired, payload, message } = verifyAccessToken(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const corpo_id = resolvedParams.corpo_id;

        if (!corpo_id) {
            return NextResponse.json({ status: false, message: "Corpo ID no especificado" }, { status: 400 });
        }

        const solicitudes = await prisma.c_solicitud_uniforme.findMany({ 
            where: { corpo_id: corpo_id },
            orderBy: { created_at: "desc" }
        });

        const solicitudes_return = solicitudes.map(solicitud => ({
            id: solicitud.id,
            id_local: "",
            empresa_id: solicitud.empresa_id,
            cliente_id: solicitud.cliente_id,
            contrato_id: solicitud.contrato_id,
            corpo_id: solicitud.corpo_id,
            puesto_id: solicitud.puesto_id,
            plaza_id: solicitud.plaza_id,
            codigo: solicitud.codigo,
            nombre_completo: solicitud.nombre_completo,
            cliente_area: solicitud.cliente_area,
            ultima_fecha_uniformes: solicitud.ultima_fecha_uniformes,
            talla_scrub_naranja: solicitud.talla_scrub_naranja,
            talla_pantalon: solicitud.talla_pantalon,
            talla_zapatos: solicitud.talla_zapatos,
            estado: solicitud.estado,
            persona_designada_entrega: solicitud.persona_designada_entrega,
            no_procede_hasta: solicitud.no_procede_hasta,
            estatus_designado_entrega: solicitud.estatus_designado_entrega,
            created_at: solicitud.created_at,
            created_by: solicitud.created_by,
        }));

        return NextResponse.json({ status: true, data: solicitudes_return }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}

