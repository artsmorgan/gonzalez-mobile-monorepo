import { NextRequest, NextResponse } from 'next/server';
import { fetchDynamicFile } from "../../../../../utils/callDynamicFilesApi";

export const runtime = 'nodejs'; // 👈 necesario para usar fs

import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { reportError } from "../../../../../utils/reportError";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {

    const resolvedParams = await context.params;
    const id = parseInt(resolvedParams.id);


    if (!id) {
        await reportError(req, "api/activities/[id]/get-image", "GET", 400, "ID faltante");
        return NextResponse.json({ status: false, message: 'ID faltante' }, { status: 400 });
    }

    try {
        const activity = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "e_actividades_puesto_plaza", operation: "findUnique", where: { id } }
        });
        if (!activity || !activity.file_name) {
            await reportError(req, "api/activities/[id]/get-image", "GET", 404, "Actividad no encontrada");
            return NextResponse.json({ status: false, message: 'Actividad no encontrada' }, { status: 404 });
        }

        const fetched = await fetchDynamicFile({
            req,
            type: 'image',
            url: `activities/${activity.id}/${activity.file_name}`,
            download: false,
        });

        return new NextResponse(fetched.buffer, {
            headers: {
                'Content-Type': fetched.headers.contentType,
                'Cache-Control': fetched.headers.cacheControl,
            },
        });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
        await reportError(req, "api/activities/[id]/get-image", "GET", 400, errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}
