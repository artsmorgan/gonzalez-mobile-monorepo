import { NextRequest, NextResponse } from "next/server";
import { toZonedTime } from "date-fns-tz";
import { prisma } from "../../../../../utils/prismaClient";
import { reportError } from "../../../../../utils/reportError";


export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const resolvedParams = await context.params;

        const id = parseInt(resolvedParams.id);

        // Params obtenidos con "?"
        const searchParams = req.nextUrl.searchParams;
        const endingTime = searchParams.get("endingTime");

        console.log("endingTime", endingTime);

        if (!endingTime) {
            await reportError(req, "api/lunch-time/[id]/test-ending-time", "GET", 400, "Tiempo de finalización no especificado");
            return NextResponse.json({ status: false, message: "Tiempo de finalización no especificado" }, { status: 400 });
        }

        const marcaDia = await prisma.c_marca_dia.findUnique({ where: { id } });
        if (!marcaDia) {
            await reportError(req, "api/lunch-time/[id]/test-ending-time", "GET", 404, "Marca del dia no encontrada");
            return NextResponse.json({ status: false, message: "Marca del dia no encontrada" }, { status: 404 });
        }

        if (!marcaDia.hora_fin || !marcaDia.hora_inicio) {
            await reportError(req, "api/lunch-time/[id]/test-ending-time", "GET", 400, "Hora de finalización o inicio no establecidas");
            return NextResponse.json({ status: false, message: "Hora de finalización o inicio no establecidas" }, { status: 400 });
        }

        if (!marcaDia.fecha) {
            await reportError(req, "api/lunch-time/[id]/test-ending-time", "GET", 400, "Fecha no establecida");
            return NextResponse.json({ status: false, message: "Fecha no establecida" }, { status: 400 });
        }

        const endDate = new Date(marcaDia.hora_fin);
        endDate.setFullYear(marcaDia.fecha.getFullYear(), marcaDia.fecha.getMonth(), marcaDia.hora_inicio > marcaDia.hora_fin ? marcaDia.fecha.getDate() + 1 : marcaDia.fecha.getDate());

        const endingTime_converted = toZonedTime(new Date(parseInt(endingTime)), "America/Costa_Rica");

        if (endingTime_converted.getTime() > endDate.getTime()) {
            await reportError(req, "api/lunch-time/[id]/test-ending-time", "GET", 400, "Tiempo de finalización de almuerzo es mayor a la hora de finalización");
            return NextResponse.json({ status: false, message: "Tiempo de finalización de almuerzo es mayor a la hora de finalización" }, { status: 400 });
        }

        return NextResponse.json({ status: true, message: "Tiempo de finalización de almuerzo es menor a la hora de finalización" }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        await reportError(req, "api/lunch-time/[id]/test-ending-time", "GET", 500, errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}