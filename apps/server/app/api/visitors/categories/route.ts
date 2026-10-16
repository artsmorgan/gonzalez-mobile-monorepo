/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";
import { reportError } from "../../../../utils/reportError";

export async function GET(req: NextRequest) {
    try {
        const categories = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "n_tipo_activo_visitas", operation: "findMany" }
        });
        return NextResponse.json({ status: true, categories }, { status: 200 });
    }
    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        await reportError(req, "api/visitors/categories", "GET", 500, errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}