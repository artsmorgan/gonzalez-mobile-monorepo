import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";
import { reportError } from "../../../../utils/reportError";

export async function GET(req: NextRequest) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
        if (!valid) {
            return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });
        }

        const classifications = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "n_clasificacion_incidente",
                operation: "findMany",
                orderBy: { nombre: "asc" }
            }
        });

        return NextResponse.json(
            {
                status: true,
                classifications: classifications.map((c: any) => ({
                    id: c.id,
                    nombre: c.nombre,
                })),
            },
            { status: 200 }
        );
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error("Error in GET /api/incidents/classification:", errorMessage);
        await reportError(req, "api/incidents/classification", "GET", 500, errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}


