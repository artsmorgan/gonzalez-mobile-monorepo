import { NextRequest, NextResponse } from "next/server";
import { toZonedTime } from "date-fns-tz";

export async function GET(req: NextRequest) {
    try {
        return NextResponse.json({ status: true, current_time: toZonedTime(new Date(), "America/Costa_Rica").getTime() }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}