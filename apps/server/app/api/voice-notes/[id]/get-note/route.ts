import { NextRequest, NextResponse } from 'next/server';
import { fetchDynamicFile } from "../../../../../utils/callDynamicFilesApi";
import { verifyAccessTokenByApi } from '../../../../../utils/verifyAccessTokenByApi';

export const runtime = 'nodejs'; // 👈 necesario para usar fs

import { callDynamicPrisma } from '../../../../../utils/callDynamicPrisma';

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {

    const resolvedParams = await context.params;
    const id = parseInt(resolvedParams.id);

    if (!id) {
        return NextResponse.json({ status: false, message: 'ID faltante' }, { status: 400 });
    }

    const voiceNote = await callDynamicPrisma({
        req,
        data: { action: "GET", table: "c_notas_voz", operation: "findUnique", where: { id } }
    });
    if (!voiceNote) {
        return NextResponse.json({ status: false, message: 'Nota de voz no encontrada' }, { status: 404 });
    }

    if (!voiceNote.path) {
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
}
