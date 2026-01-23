import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../utils/verifyToken";
import { toZonedTime, format } from "date-fns-tz";
import { prisma } from "../../../utils/prismaClient";


export async function POST(req: NextRequest) {
    try {
        const { valid, expired, payload, message } = verifyAccessToken(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const { empleadoId, inicio, fin, pausas, es_manual } = await req.json();

        const newLunchTime = await prisma.c_empleado_almuerzo.create({ data: { empleadoId, inicio, fin: new Date(fin), pausas, es_manual } });
        return NextResponse.json({ status: true, message: "Almuerzo registrado correctamente" }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.log(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}