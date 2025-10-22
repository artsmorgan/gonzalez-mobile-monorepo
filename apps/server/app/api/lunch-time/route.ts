import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { verifyAccessToken } from "../../../utils/verifyToken";
import { toZonedTime, format } from "date-fns-tz";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
    try {
        const { valid, payload, message } = verifyAccessToken(req);

        if (!valid) {
            return NextResponse.json(
                { status: false, message: message },
                { status: 401 }
            );
        }

        const { empleadoId, inicio, fin, pausas, es_manual } = await req.json();

        const inicio_converted = toZonedTime(new Date(inicio), "America/Costa_Rica");
        const fin_converted = toZonedTime(new Date(fin), "America/Costa_Rica");

        const pausas_converted = JSON.parse(pausas);
        for (const pause of pausas_converted) {
            pause.startTime = toZonedTime(new Date(pause.startTime), "America/Costa_Rica");
            pause.endTime = toZonedTime(new Date(pause.endTime), "America/Costa_Rica");
        }

        const newLunchTime = await prisma.c_empleado_almuerzo.create({ data: { empleadoId, inicio: inicio_converted, fin: fin_converted, pausas: JSON.stringify(pausas_converted), es_manual } });
        return NextResponse.json({ status: true, message: "Almuerzo registrado correctamente" }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.log(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}