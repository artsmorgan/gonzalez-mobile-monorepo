import { NextRequest, NextResponse } from "next/server";
import { toZonedTime } from "date-fns-tz";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { prisma } from "../../../../../utils/prismaClient";
import { reportError } from "../../../../../utils/reportError";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);

        const searchParams = req.nextUrl.searchParams;
        const endTime = searchParams.get("endTime");

        if (!endTime) {
            await reportError(req, "api/attendance/[id]/early-leaving", "GET", 400, "Tiempo de finalización no especificado");
            return NextResponse.json({ status: false, message: "Tiempo de finalización no especificado" }, { status: 400 });
        }

        const marcaDia = await prisma.c_marca_dia.findFirst({ where: { empleadoFijo_id: id }, orderBy: { id: "desc" } });
        if (!marcaDia) {
            await reportError(req, "api/attendance/[id]/early-leaving", "GET", 404, "No se encontró la marca del dia");
            return NextResponse.json({ status: false, message: "No se encontró la marca del dia" }, { status: 404 });
        }

        if (!marcaDia.hora_fin || !marcaDia.hora_inicio) {
            await reportError(req, "api/attendance/[id]/early-leaving", "GET", 400, "Hora de finalización no establecida");
            return NextResponse.json({ status: false, message: "Hora de finalización no establecida" }, { status: 400 });
        }

        if (!marcaDia.fecha) {
            await reportError(req, "api/attendance/[id]/early-leaving", "GET", 400, "Fecha no establecida");
            return NextResponse.json({ status: false, message: "Fecha no establecida" }, { status: 200 });
        }

        const endDate = new Date(marcaDia.hora_fin);
        endDate.setFullYear(marcaDia.fecha.getFullYear(), marcaDia.fecha.getMonth(), marcaDia.hora_inicio > marcaDia.hora_fin ? marcaDia.fecha.getDate() + 1 : marcaDia.fecha.getDate());

        const endingTime_converted = toZonedTime(new Date(parseInt(endTime)), "America/Costa_Rica");

        console.log("endDate", endDate);
        console.log("endingTime_converted", endingTime_converted);

        //  endingTime_converted no puede ser menor a endDate con 15 minutos menos
        endDate.setMinutes(endDate.getMinutes() - 15);
        if (endingTime_converted.getTime() < endDate.getTime()) {
            await reportError(req, "api/attendance/[id]/early-leaving", "GET", 500, "Tiempo de finalización es menor a la hora de finalización con 15 minutos menos");
            return NextResponse.json({ status: false, message: "Tiempo de finalización es menor a la hora de finalización con 15 minutos menos" }, { status: 500 });
        }

        return NextResponse.json({ status: true, message: "Tiempo de finalización es menor a la hora de finalización" }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        await reportError(req, "api/attendance/[id]/early-leaving", "GET", 500, errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}