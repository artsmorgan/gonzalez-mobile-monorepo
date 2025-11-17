import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { verifyAccessToken } from '../../../../../../utils/verifyToken';

export const runtime = 'nodejs'; // 👈 necesario para usar fs

import { prisma } from "../../../../../../utils/prismaClient";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {

    const resolvedParams = await context.params;
    const id = parseInt(resolvedParams.id);

    const searchParams = req.nextUrl.searchParams;
    const name = searchParams.get("name");

    if (!id || !name) {
        return NextResponse.json({ status: false, message: 'ID o nombre faltante' }, { status: 400 });
    }

    const visitor = await prisma.e_registro_personas.findUnique({ where: { id } });
    if (!visitor || !visitor.foto_cedula) {
        return NextResponse.json({ status: false, message: 'Visita no encontrada' }, { status: 404 });
    }

    const filePath = path.join(
        process.cwd(),
        'public',
        'uploads',
        'visitors',
        visitor.id.toString(),
        'cedula',
        visitor.foto_cedula
    );

    console.log('📂 Buscando archivo en:', filePath);

    if (!fs.existsSync(filePath)) {
        return NextResponse.json({ status: false, message: 'Foto no encontrada' }, { status: 404 });
    }

    const file = await fs.promises.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();

    let contentType = 'application/octet-stream';
    if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    if (ext === '.png') contentType = 'image/png';
    if (ext === '.webp') contentType = 'image/webp';

    return new NextResponse(Buffer.from(file), {
        headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000',
        },
    });
}
