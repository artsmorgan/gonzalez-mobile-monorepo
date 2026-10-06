import { NextRequest, NextResponse } from 'next/server';
import { fetchDynamicFile } from '../../../../../../utils/callDynamicFilesApi';
import { callDynamicPrisma } from '../../../../../../utils/callDynamicPrisma';
import { reportError } from '../../../../../../utils/reportError';

export const runtime = 'nodejs'; // 👈 necesario para usar fs

export async function GET(req: NextRequest, context: { params: Promise<{ id: string, image: string }> }) {

    const resolvedParams = await context.params;
    const id = parseInt(resolvedParams.id);
    const image = resolvedParams.image;
    if (!id || !image) {
        await reportError(req, "api/evaluation/[id]/get-image/[image]", "GET", 400, 'ID o imagen faltante');
        return NextResponse.json({ status: false, message: 'ID o imagen faltante' }, { status: 400 });
    }

    // Obtener token desde el querystring (estándar para consumo desde mobile)
    const token = req.nextUrl.searchParams.get("token") || undefined;

    try {
        const evaluation = await callDynamicPrisma({
            req,
            token,
            data: { action: "GET", table: "c_evaluacion_empleado", operation: "findUnique", where: { id } }
        });
        if (!evaluation) {
            await reportError(req, "api/evaluation/[id]/get-image/[image]", "GET", 404, 'Evaluación no encontrada');
            return NextResponse.json({ status: false, message: 'Evaluación no encontrada' }, { status: 404 });
        }

        const fetched = await fetchDynamicFile({
            req,
            type: 'image',
            url: `evaluations/${evaluation.id}/images/${image}`,
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
        await reportError(req, "api/evaluation/[id]/get-image/[image]", "GET", 500, errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}