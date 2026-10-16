import { NextRequest, NextResponse } from 'next/server';
import { fetchDynamicFile } from "../../../../../utils/callDynamicFilesApi";
import { verifyAccessTokenByApi } from '../../../../../utils/verifyAccessTokenByApi';
import { reportError } from '../../../../../utils/reportError';

export const runtime = 'nodejs'; // 👈 necesario para usar fs

import { callDynamicPrisma } from '../../../../../utils/callDynamicPrisma';

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {

    const resolvedParams = await context.params;
    const id = parseInt(resolvedParams.id);

    if (!id) {
        await reportError(req, "api/voice-notes/[id]/get-note", "GET", 400, 'ID faltante');
        return NextResponse.json({ status: false, message: 'ID faltante' }, { status: 400 });
    }

    // Permitir autenticación vía token en query (misma estrategia que JobManualsScreen / dynamic files)
    const tokenFromQuery = req.nextUrl.searchParams.get("token") || undefined;

    try {
        const voiceNote = await callDynamicPrisma({
            req,
            token: tokenFromQuery,
            data: { action: "GET", table: "c_notas_voz", operation: "findUnique", where: { id } }
        });
        if (!voiceNote) {
            await reportError(req, "api/voice-notes/[id]/get-note", "GET", 404, 'Nota de voz no encontrada');
            return NextResponse.json({ status: false, message: 'Nota de voz no encontrada' }, { status: 404 });
        }

        if (!voiceNote.path) {
            await reportError(req, "api/voice-notes/[id]/get-note", "GET", 404, 'Nota de voz no encontrada');
            return NextResponse.json({ status: false, message: 'Nota de voz no encontrada' }, { status: 404 });
        }

        const fetched = await fetchDynamicFile({
            req,
            type: 'audio',
            url: `voice-notes/${voiceNote.id}/${voiceNote.path}`,
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
        await reportError(req, "api/voice-notes/[id]/get-note", "GET", 500, errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}
