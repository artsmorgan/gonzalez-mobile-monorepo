import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { verifyAccessToken } from '../../../../../utils/verifyToken';

export const runtime = 'nodejs'; // 👈 necesario para usar fs

import { prisma } from "../../../../../utils/prismaClient";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {

    const resolvedParams = await context.params;
    const id = parseInt(resolvedParams.id);

    if (!id) {
        return NextResponse.json({ status: false, message: 'ID faltante' }, { status: 400 });
    }

    const incident = await prisma.c_incidente.findUnique({ where: { id } });
    if (!incident || !incident.file_audio) {
        return NextResponse.json({ status: false, message: 'Nota de voz no encontrada' }, { status: 404 });
    }

    const filePath = path.join(
        process.cwd(),
        'public',
        'uploads',
        'incidents',
        `${incident.id}`,
        'audios',
        incident.file_audio
    );

    if (!fs.existsSync(filePath)) {
        return NextResponse.json({ status: false, message: 'Nota de voz no encontrada' }, { status: 404 });
    }

    const file = await fs.promises.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();

    let contentType = 'audio/mpeg';
    if (ext === '.wav') contentType = 'audio/wav';
    if (ext === '.m4a') contentType = 'audio/mp4';

    return new NextResponse(Buffer.from(file), {
        headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000',
        },
    });
}
