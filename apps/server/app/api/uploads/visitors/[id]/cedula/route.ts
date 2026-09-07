import { NextRequest, NextResponse } from 'next/server';
import { fetchDynamicFile } from '../../../../../../utils/callDynamicFilesApi';
import { callDynamicPrisma } from '../../../../../../utils/callDynamicPrisma';
import { reportError } from '../../../../../../utils/reportError';

export const runtime = 'nodejs'; // 👈 necesario para usar fs

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {

    const resolvedParams = await context.params;
    const id = parseInt(resolvedParams.id);

    const searchParams = req.nextUrl.searchParams;
    const name = searchParams.get("name");
    const tokenFromQuery = searchParams.get("token") || undefined;

    if (!id || !name) {
        await reportError(req, "api/uploads/visitors/[id]/cedula", "GET", 400, "ID o nombre faltante");
        return NextResponse.json({ status: false, message: 'ID o nombre faltante' }, { status: 400 });
    }

    try {
        const visitor = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "e_registro_personas", operation: "findUnique", where: { id } },
            token: tokenFromQuery,
        });
        if (!visitor || !visitor.foto_cedula) {
            await reportError(req, "api/uploads/visitors/[id]/cedula", "GET", 404, "Visita no encontrada");
            return NextResponse.json({ status: false, message: 'Visita no encontrada' }, { status: 404 });
        }

        const fetched = await fetchDynamicFile({
            req,
            type: 'image',
            url: `visitors/${visitor.id}/cedula/${visitor.foto_cedula}`,
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
        await reportError(req, "api/uploads/visitors/[id]/cedula", "GET", 500, errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}
