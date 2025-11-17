import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../utils/verifyToken";
import { toZonedTime, format } from "date-fns-tz";

import { prisma } from "../../../../utils/prismaClient";

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, payload, message } = verifyAccessToken(req);
        if (!valid) {
            return NextResponse.json(
                { status: false, message: message },
                { status: 401 }
            );
        }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);

        const voiceNote = await prisma.c_notas_voz.findUnique({ where: { id } });
        if (!voiceNote) return NextResponse.json({ status: false, message: "Nota de voz no encontrada" }, { status: 200 });

        await prisma.c_notas_voz.delete({ where: { id } });
        return NextResponse.json({ status: true, message: "Nota de voz eliminada con éxito" }, { status: 200 });
    }
    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}