import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { toZonedTime, format } from "date-fns-tz";

import { prisma } from "../../../../utils/prismaClient";
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);

        const voiceNote = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "c_notas_voz", operation: "findUnique", where: { id } }
        });
        if (!voiceNote) return NextResponse.json({ status: false, message: "Nota de voz no encontrada" }, { status: 200 });

        await callDynamicPrisma({
            req,
            data: { action: "DELETE", table: "c_notas_voz", where: { id }, returning: false }
        });
        return NextResponse.json({ status: true, message: "Nota de voz eliminada con éxito" }, { status: 200 });
    }
    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}