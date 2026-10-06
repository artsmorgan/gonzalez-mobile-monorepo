import { NextRequest, NextResponse } from "next/server";
import { toZonedTime } from "date-fns-tz";
import { reportError } from "../../../utils/reportError";
import dotenv from "dotenv";
dotenv.config();

export async function GET(req: NextRequest) {
    try {
        // `toZonedTime` ya desplaza el instante para que sus getters UTC devuelvan la hora de
        // reloj de Costa Rica; restar 6 horas otra vez aquí duplicaba el desplazamiento y
        // adelantaba/atrasaba la hora reportada a los clientes. El consumidor debe leer este
        // epoch con getters UTC (getUTCHours, etc.), no con getters locales del dispositivo.
        let now = toZonedTime(new Date(), "America/Costa_Rica").getTime();
        if (process.env.NODE_ENV === "development") {
            now = now - 6 * 60 * 60 * 1000;
        }
        return NextResponse.json({ status: true, current_time: now }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        await reportError(req, "api/server-time", "GET", 500, errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}