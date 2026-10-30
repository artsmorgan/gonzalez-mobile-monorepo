import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";
import { toZonedTime } from "date-fns-tz";
import { prisma } from "../../../utils/prismaClient";
import { reportError } from "../../../utils/reportError";

export async function GET(req: NextRequest) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const executives = await prisma.n_ejecutivo_cuenta.findMany();

        return NextResponse.json({ status: true, executives: executives }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.log(errorMessage);
        await reportError(req, "api/executives", "GET", 500, errorMessage);
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}