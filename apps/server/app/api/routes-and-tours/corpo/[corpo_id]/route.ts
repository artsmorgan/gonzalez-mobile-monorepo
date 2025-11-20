import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../../utils/verifyToken";
import { prisma } from "../../../../../utils/prismaClient";

export async function GET(req: NextRequest, context: { params: Promise<{ corpo_id: string }> }) {
    try {
        const { valid, payload, message } = verifyAccessToken(req);

        if (!valid) {
            return NextResponse.json(
                { status: false, message: message },
                { status: 401 }
            );
        }

        const resolvedParams = await context.params;
        const corpo_id = resolvedParams.corpo_id;

        if (!corpo_id) {
            return NextResponse.json({ status: false, message: "Corpo ID no especificado" }, { status: 400 });
        }

        const registros = await prisma.c_rutas_giras.findMany({ 
            where: { corpo_id: corpo_id },
            orderBy: { created_at: "desc" }
        });

        const registros_return = registros.map(registro => ({
            id: registro.id,
            id_local: "",
            empresa_id: registro.empresa_id,
            cliente_id: registro.cliente_id,
            contrato_id: registro.contrato_id,
            corpo_id: registro.corpo_id,
            puesto_id: registro.puesto_id,
            plaza_id: registro.plaza_id,
            sociedad: registro.sociedad,
            cliente: registro.cliente,
            zona: registro.zona,
            cantidad_personal: registro.cantidad_personal,
            gira_ruta: registro.gira_ruta,
            dia_entrega: registro.dia_entrega,
            estatus: registro.estatus,
            cumplimiento_supervision: registro.cumplimiento_supervision,
            cumplimiento_entrega_insumos: registro.cumplimiento_entrega_insumos,
            persona_refuerzo: registro.persona_refuerzo,
            notas_cambios: registro.notas_cambios,
            estado: registro.estado,
            nombre_persona_refuerzo: registro.nombre_persona_refuerzo,
            created_at: registro.created_at,
            created_by: registro.created_by,
        }));

        return NextResponse.json({ status: true, data: registros_return }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}

