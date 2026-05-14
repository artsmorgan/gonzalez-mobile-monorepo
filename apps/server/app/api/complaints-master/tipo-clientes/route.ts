import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";

export async function GET(req: NextRequest) {
    try {
        const { valid, expired, message } = await verifyAccessTokenByApi(req);
        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const tipoClientes = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "n_tipo_cliente_quejas",
                operation: "findMany",
                orderBy: { nombre: "asc" },
            },
        });
        const tipoClientesArray = Array.isArray(tipoClientes) ? tipoClientes : [];
        return NextResponse.json({ status: true, tipoClientes: tipoClientesArray }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error("Error in GET /api/complaints-master/tipo-clientes:", errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}

