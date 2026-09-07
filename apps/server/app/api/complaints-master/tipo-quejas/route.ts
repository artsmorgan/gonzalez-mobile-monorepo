import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";
import { reportError } from "../../../../utils/reportError";

export async function GET(req: NextRequest) {
    try {
        const { valid, expired, message } = await verifyAccessTokenByApi(req);
        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const tipoQuejas = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "n_tipo_quejas",
                operation: "findMany",
                orderBy: { nombre: "asc" },
            },
        });
        const tipoQuejasArray = Array.isArray(tipoQuejas) ? tipoQuejas : [];
        return NextResponse.json({ status: true, tipoQuejas: tipoQuejasArray }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error("Error in GET /api/complaints-master/tipo-quejas:", errorMessage);
        await reportError(req, "api/complaints-master/tipo-quejas", "GET", 500, errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}

