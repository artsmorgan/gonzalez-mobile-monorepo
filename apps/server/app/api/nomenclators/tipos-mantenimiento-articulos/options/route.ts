import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { fetchArticuloCorpoPuestoOptions } from "../../../../../utils/nomenclatorsTipoMantenimientoArticulo";

export async function GET(req: NextRequest) {
    try {
        const { valid, expired, message } = await verifyAccessTokenByApi(req);
        if (!valid) {
            return NextResponse.json(
                { status: false, expired, message },
                { status: expired ? 401 : 403 }
            );
        }

        const articulos = await fetchArticuloCorpoPuestoOptions(req);
        return NextResponse.json({ status: true, articulos }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error("Error in GET /api/nomenclators/tipos-mantenimiento-articulos/options:", errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}
