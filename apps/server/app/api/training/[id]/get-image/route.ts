import { NextRequest, NextResponse } from 'next/server';
import { fetchDynamicFile } from "../../../../../utils/callDynamicFilesApi";

export const runtime = 'nodejs'; // 👈 necesario para usar fs

import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {

    const resolvedParams = await context.params;
    const id = parseInt(resolvedParams.id);

    if (!id) {
        return NextResponse.json({ status: false, message: 'ID faltante' }, { status: 400 });
    }

    const capacitacion = await callDynamicPrisma({
        req,
        data: {
            action: "GET",
            table: "e_registro_capacitaciones",
            operation: "findUnique",
            where: { id },
        },
    });
    if (!capacitacion) {
        return NextResponse.json({ status: false, message: 'Capacitación no encontrada' }, { status: 404 });
    }

    const capacitacionObj = capacitacion as any;
    if (!capacitacionObj.file) {
        return NextResponse.json({ status: false, message: 'Capacitación no encontrada' }, { status: 404 });
    }

    const fetched = await fetchDynamicFile({
        req,
        type: 'image',
        url: `training/${capacitacionObj.id}/${capacitacionObj.file}`,
        download: false,
    });

    return new NextResponse(fetched.buffer, {
        headers: {
            'Content-Type': fetched.headers.contentType,
            'Cache-Control': fetched.headers.cacheControl,
        },
    });
}
