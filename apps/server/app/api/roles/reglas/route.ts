import { NextRequest, NextResponse } from "next/server";
import { actions } from "../../../../public/actions";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";

import { prisma } from "../../../../utils/prismaClient";

export async function GET(request: NextRequest) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(request);

        return NextResponse.json([]);
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}