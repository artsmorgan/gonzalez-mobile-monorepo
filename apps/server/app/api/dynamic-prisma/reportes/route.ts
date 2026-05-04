import { NextResponse } from "next/server";

/**
 * Ruta reservada para reportes vía dynamic-prisma.
 * Exportar handlers aquí evita fallos de tipos de Next (`route.ts` debe ser un módulo con GET/POST/…).
 */
export async function GET() {
    return NextResponse.json(
        { status: false, message: "Endpoint de reportes no implementado." },
        { status: 501 },
    );
}
