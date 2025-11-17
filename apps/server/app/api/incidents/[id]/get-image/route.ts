import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs'; // 👈 necesario para usar fs

import { prisma } from "../../../../../utils/prismaClient";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {

    const resolvedParams = await context.params;
    const id = parseInt(resolvedParams.id);

    if (!id) {
        return NextResponse.json({ status: false, message: 'ID faltante' }, { status: 400 });
    }

    const incident = await prisma.c_incidente.findUnique({ where: { id } });
    if (!incident || !incident.file_image) {
        return NextResponse.json({ status: false, message: 'Vehículo no encontrado' }, { status: 404 });
    }

    const filePath = path.join(
        process.cwd(),
        'public',
        'uploads',
        'incidents',
        `${incident.id}`,
        'images',
        incident.file_image
    );

    console.log('📂 Buscando archivo en:', filePath);

    if (!fs.existsSync(filePath)) {
        return NextResponse.json({ status: false, message: 'Imagen no encontrada' }, { status: 404 });
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
