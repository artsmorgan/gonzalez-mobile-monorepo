import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";

import { prisma } from "../../../../utils/prismaClient";
import { reportError } from "../../../../utils/reportError";

export async function GET(request: NextRequest) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(request);

        return NextResponse.json([]);
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        await reportError(request, "api/reglas/roles", "GET", 500, errorMessage);
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}


export async function POST(request: NextRequest) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(request);

        return NextResponse.json({ message: "Acción actualizada correctamente" }, { status: 201 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        await reportError(request, "api/reglas/roles", "POST", 500, errorMessage);
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}
