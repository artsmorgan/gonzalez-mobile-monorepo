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

        const controles = await prisma.c_control_kilometraje.findMany({ 
            where: { corpo_id: corpo_id },
            orderBy: { created_at: "desc" }
        });

        const controles_return = controles.map(control => ({
            id: control.id,
            id_local: "",
            empresa_id: control.empresa_id,
            cliente_id: control.cliente_id,
            contrato_id: control.contrato_id,
            corpo_id: control.corpo_id,
            puesto_id: control.puesto_id,
            plaza_id: control.plaza_id,
            chofer_id: control.chofer_id,
            chofer_nombre: control.chofer_nombre,
            total_km: control.total_km,
            ruta: control.ruta,
            prox_mant_km: control.prox_mant_km,
            km_para_mantenimiento: control.km_para_mantenimiento,
            km_actual: control.km_actual,
            estado: control.estado,
            vehiculo_id: control.vehiculo_id,
            registros_viaje: control.registros_viaje ? JSON.parse(control.registros_viaje) : [],
            created_at: control.created_at,
            created_by: control.created_by,
        }));

        return NextResponse.json({ status: true, data: controles_return }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}

