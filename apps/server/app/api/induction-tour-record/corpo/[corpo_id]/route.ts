import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ corpo_id: string }> }
) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const { corpo_id } = resolvedParams;
        const corpoIdNum = parseInt(String(corpo_id), 10);
        if (Number.isNaN(corpoIdNum)) {
            return NextResponse.json({ status: false, message: "Corpo inválido", data: [] }, { status: 400 });
        }

        const records = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_registro_induccion_recorrido",
                operation: "findMany",
                where: {
                    corpo_id: corpoIdNum,
                    isActive: true,
                },
                orderBy: {
                    created_at: 'desc'
                }
            },
        });

        const recordsArray = Array.isArray(records) ? records : [];
        const recordsWithIdLocal = recordsArray.map((record: any) => ({
            ...record,
            id_local: ""
        }));

        return NextResponse.json({
            status: true,
            message: "Registros de inducción y recorrido obtenidos correctamente",
            data: recordsWithIdLocal
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage, data: [] }, { status: 400 });
    }
}

