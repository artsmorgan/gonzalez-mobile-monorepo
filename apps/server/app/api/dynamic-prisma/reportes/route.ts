/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import {
    executeReportesOperation,
    type ReportesPayload,
} from "../../reportes/create";

/**
 * Compatibilidad: delega en `executeReportesOperation` (`app/api/reportes/create.ts`).
 */
export async function POST(req: NextRequest) {
    try {
        const payload = (await req.json()) as ReportesPayload;
        const result = await executeReportesOperation(req, payload);
        return NextResponse.json(result, { status: result.status ? 200 : 400 });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Error desconocido";
        console.error("POST /api/dynamic-prisma/reportes:", msg);
        return NextResponse.json({ status: false, message: msg }, { status: 500 });
    }
}
