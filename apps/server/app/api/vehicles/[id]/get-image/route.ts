import { NextRequest, NextResponse } from 'next/server';
import { fetchDynamicFile } from "../../../../../utils/callDynamicFilesApi";
import { reportError } from "../../../../../utils/reportError";

export const runtime = 'nodejs'; // 👈 necesario para usar fs

import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {

    const resolvedParams = await context.params;
    const id = parseInt(resolvedParams.id);

    if (!id) {
        await reportError(req, "api/vehicles/[id]/get-image", "GET", 400, 'ID faltante');
        return NextResponse.json({ status: false, message: 'ID faltante' }, { status: 400 });
    }

    try {
        const vehicle = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "e_registro_vehiculos", operation: "findUnique", where: { id } }
        });
        if (!vehicle || !vehicle.file_name) {
            await reportError(req, "api/vehicles/[id]/get-image", "GET", 404, 'Vehículo no encontrado');
            return NextResponse.json({ status: false, message: 'Vehículo no encontrado' }, { status: 404 });
        }

        const fetched = await fetchDynamicFile({
            req,
            type: 'image',
            url: `vehicles/${vehicle.id}/${vehicle.file_name}`,
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
        await reportError(req, "api/vehicles/[id]/get-image", "GET", 500, errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}
