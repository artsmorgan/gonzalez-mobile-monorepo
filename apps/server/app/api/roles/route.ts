import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../utils/verifyAccessTokenByApi";

import { prisma } from "../../../utils/prismaClient";
import { reportError } from "../../../utils/reportError";

export async function GET(req: NextRequest) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);

        return NextResponse.json([
            { id: 1, name: "ADMINISTRATIVO" },
            { id: 2, name: "SUPERVISOR" },
            { id: 3, name: "OPERATIVO" }
        ], { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        await reportError(req, "api/roles", "GET", 500, errorMessage);
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        return NextResponse.json({});
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        await reportError(req, "api/roles", "POST", 500, errorMessage);
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}
