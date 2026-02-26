import { NextRequest, NextResponse } from "next/server";
import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";

export async function GET(req: NextRequest) {
    try {
        const categories = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "n_novedades_categoria",
                operation: "findMany",
            }
        });
        return NextResponse.json({ status: true, categories }, { status: 200 });
    }

    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}