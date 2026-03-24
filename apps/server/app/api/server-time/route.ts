import { NextRequest, NextResponse } from "next/server";
import { toZonedTime } from "date-fns-tz";

export async function GET(req: NextRequest) {
    try {
        let serverTime = toZonedTime(new Date(), "America/Costa_Rica").getTime();
        //serverTime = serverTime - 6 * 60 * 60 * 1000; // Restarle 6 horas para que sea en la zona horaria de Costa Rica
        return NextResponse.json({ status: true, current_time: serverTime }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}