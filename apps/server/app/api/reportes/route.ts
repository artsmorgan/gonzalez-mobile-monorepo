import { NextResponse } from "next/server";

/** Evita `route.ts` vacío (no es módulo válido para el generador de tipos de Next). */
export async function GET() {
    return NextResponse.json(
        { status: false, message: "Endpoint de reportes no implementado." },
        { status: 501 },
    );
}
