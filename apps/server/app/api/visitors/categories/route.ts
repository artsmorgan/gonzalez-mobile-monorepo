/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../utils/prismaClient";

export async function GET(req: NextRequest) {
    try {
        const categories = await prisma.n_tipo_activo_visitas.findMany();
        return NextResponse.json({ status: true, categories }, { status: 200 });
    }
    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}