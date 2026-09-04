import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { fetchEjecutivoCoordinadorOptions } from "../../../../../utils/nomenclatorsEjecutivoCoordinador";
import { reportError } from "../../../../../utils/reportError";

export async function GET(req: NextRequest) {
    try {
        const { valid, expired, message } = await verifyAccessTokenByApi(req);
        if (!valid) {
            return NextResponse.json(
                { status: false, expired, message },
                { status: expired ? 401 : 403 }
            );
        }

        const options = await fetchEjecutivoCoordinadorOptions(req);
        return NextResponse.json({ status: true, ...options }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error("Error in GET /api/nomenclators/coordinadores-ejecutivos/options:", errorMessage);
        await reportError(req, "api/nomenclators/coordinadores-ejecutivos/options", "GET", 500, errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}
