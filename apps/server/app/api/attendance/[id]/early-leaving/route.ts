import { NextRequest, NextResponse } from "next/server";
import { toZonedTime } from "date-fns-tz";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);

        const searchParams = req.nextUrl.searchParams;
        const endTime = searchParams.get("endTime");

        if (!endTime) {
            return NextResponse.json({ status: false, message: "Tiempo de finalización no especificado" }, { status: 200 });
        }

        const marcaDia = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "c_marca_dia", operation: "findFirst", where: { empleadoFijo_id: id }, orderBy: { id: "desc" } }
        });
        if (!marcaDia) {
            return NextResponse.json({ status: false, message: "No se encontró la marca del dia" }, { status: 200 });
        }

        if (!marcaDia.hora_fin || !marcaDia.hora_inicio) {
            return NextResponse.json({ status: false, message: "Hora de finalización no establecida" }, { status: 200 });
        }

        if (!marcaDia.fecha) {
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
            return NextResponse.json({ status: false, message: "Tiempo de finalización es menor a la hora de finalización con 15 minutos menos" }, { status: 200 });
        }

        return NextResponse.json({ status: true, message: "Tiempo de finalización es menor a la hora de finalización" }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}