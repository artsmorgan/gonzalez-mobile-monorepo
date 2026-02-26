import { NextRequest, NextResponse } from "next/server";
import { toZonedTime } from "date-fns-tz";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";


export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const resolvedParams = await context.params;

        const id = parseInt(resolvedParams.id);

        // Params obtenidos con "?"
        const searchParams = req.nextUrl.searchParams;
        const endingTime = searchParams.get("endingTime");

        console.log("endingTime", endingTime);

        if (!endingTime) {
            return NextResponse.json({ status: false, message: "Tiempo de finalización no especificado" }, { status: 200 });
        }

        const marcaDia = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "c_marca_dia", operation: "findUnique", where: { id } }
        });
        if (!marcaDia) {
            return NextResponse.json({ status: false, message: "Marca del dia no encontrada" }, { status: 200 });
        }

        if (!marcaDia.hora_fin || !marcaDia.hora_inicio) {
            return NextResponse.json({ status: false, message: "Hora de finalización o inicio no establecidas" }, { status: 200 });
        }

        if (!marcaDia.fecha) {
            return NextResponse.json({ status: false, message: "Fecha no establecida" }, { status: 200 });
        }

        const endDate = new Date(marcaDia.hora_fin);
        endDate.setFullYear(marcaDia.fecha.getFullYear(), marcaDia.fecha.getMonth(), marcaDia.hora_inicio > marcaDia.hora_fin ? marcaDia.fecha.getDate() + 1 : marcaDia.fecha.getDate());

        const endingTime_converted = toZonedTime(new Date(parseInt(endingTime)), "America/Costa_Rica");

        if (endingTime_converted.getTime() > endDate.getTime()) {
            return NextResponse.json({ status: false, message: "Tiempo de finalización de almuerzo es mayor a la hora de finalización" }, { status: 200 });
        }

        return NextResponse.json({ status: true, message: "Tiempo de finalización de almuerzo es menor a la hora de finalización" }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}